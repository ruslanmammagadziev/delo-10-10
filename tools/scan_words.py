#!/usr/bin/env python3
"""Поиск запретных слов в итоговом файле (план v2, §7.5) — после вырезания блоков base64.

Запуск:
  python3 tools/scan_words.py dist/delo-10-10.prod.html [ещё файлы…]
  python3 tools/scan_words.py FILE --allow tools/scan_words.allow   (по умолчанию берётся этот файл, если он есть)
  python3 tools/scan_words.py FILE --terms-file ~/private_terms.txt (свои слова, по регулярке в строке — например,
                                                                     все написания имени; файл держи вне проекта)
  python3 tools/scan_words.py FILE --blobs     (ещё и метаданные внутри base64: имена в GLB, тексты PNG/WebP, теги звука)
  python3 tools/scan_words.py FILE --release   (ещё и незаполненные заглушки: SITE_URL, example.github.io)
  python3 tools/scan_words.py FILE --json      (машиночитаемый итог)
  python3 tools/scan_words.py --selftest       (проверка самого сканера на синтетическом файле)
  python3 tools/scan_words.py FILE --finale-date-ok  (сборка 19.11 с --finale-date: release финала в config разрешён)
  python3 tools/scan_words.py FILE --allow-village   (волна 3, поездка в горы — решение автора: слова «кубач», «село»,
                                                     «горы», «серебр» разрешены ТОЛЬКО внутри блоков <script data-village=…>
                                                     — модулей js/village/* в собранном файле; везде ещё — запрещены)
  python3 tools/scan_words.py FILE --allow-village neutral   (сборка --village-neutral: в блоках села — только «село»,
                                                     «горы», «серебр» («Горное село мастеров»); «кубач» — нигде)
Что делает:
  1) вырезает data:…;base64,… и длинные «голые» base64-строки (≥200 символов), переводы строк не трогает;
  2) раскрывает \\uXXXX, \\u{…} и &#…; (чтобы слово не пряталось за экранированием);
  3) ищет без учёта регистра список TERMS ниже и «её» в комментариях кода; печатает каждое попадание с контекстом.
Код выхода: 0 — чисто, 1 — есть попадания (кроме разрешённых), 2 — ошибка запуска.

Файл разрешений (--allow): строка «ТЕРМИН :: ПОДСТРОКА» — попадание термина разрешено, если ПОДСТРОКА стоит в файле
так, что накрывает само попадание (то есть содержит его вместе с соседними символами). «*» вместо термина — любой
термин. Пустые строки и «#…» пропускаются.
Разрешать только намеренные места и с комментарием «почему»."""
import argparse, base64, json, os, re, signal, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ALLOW = os.path.join(HERE, 'scan_words.allow')
I = re.IGNORECASE

# (id, [регулярки]) — все без учёта регистра. \b в Python работает и для кириллицы.
TERMS = [
    ('кубач', [r'кубач']),
    ('село', [r'\bсело\b']),
    ('горы', [r'\bгоры\b']),
    ('серебр', [r'серебр']),
    ('гортенз', [r'гортенз']),
    ('kevin', [r'kevin']),
    ('town_spec', [r'town_spec']),
    ('портрет', [r'портрет']),
    ('гость', [r'гость']),
    ('BTS', [r'\bbts\b']),
    ('день рожд', [r'\b(?:день|дня|дню|днём|днем|дне)\s+рожд', r'\bbirthday', r'именин']),
    ('Porsche', [r'porsche', r'порше']),
    ('911', [r'(?<![\d.#,])911(?!\d)']),
    ('поршик', [r'поршик']),
    ('рилс', [r'\bрилс']),
    ('ноготоч', [r'ноготоч']),
    ('одной ноге', [r'одной\s+ноге']),
    ('праздник огней', [r'праздник\w*\s+огн']),
    ('she/her', [r'\bshe\b', r'\bher\b']),
    ('TODO', [r'(?<![a-z])todo']),
    # отладочные параметры адреса и хуки: ?wk= ?day= ?room= ?mode= ?free= ?debug= ?hq= (и в регулярках вида /[?&]mode=…/),
    # чтение их из URLSearchParams, window.__c3d / __town / __swRoom / __lastDoor
    ('debug-param', [r'[?&\]](?:wk|day|room|mode|free|debug|hq)=', r'\bdebug=1', r'\bhq=1',
                     r'\.get\(\s*[\'"](?:wk|day|room|mode|free|debug|hq)[\'"]\s*\)', r'\bnumParam\(\s*[\'"](?:wk|day)[\'"]',
                     r'__(?:c3d|town|swRoom|lastDoor)\b']),
    ('10 декабря', [r'\b10\s*декабр', r'2026-12-10']),
    # «Солнце» рядом с её именем (плейсхолдеры {name}/{HEROINE}) — ни разу
    ('солнце+имя', [r'солн\w*\W{1,8}\{(?:name|HEROINE)\}', r'\{(?:name|HEROINE)\}\W{1,8}солн']),
]
# «её» в комментариях кода (JS /*…*/ и //…, CSS, HTML <!--…-->): в prod-сборке комментарии вырезает минификатор
COMMENT_RX = re.compile(r'/\*[\s\S]*?\*/|(?<![:\'"\\/\w])//[^\n]*|<!--[\s\S]*?-->')
COMMENT_TERM = ('её в комментарии', r'\bе[её]\b')
RELEASE_TERMS = [('заглушка', [r'SITE_URL', r'example\.github\.io', r'TODO_\w+'])]

DATA_B64 = re.compile(r'data:([\w.+-]+/[\w.+-]+)((?:;[\w.+-]+=[\w.+"-]+)*);base64,([A-Za-z0-9+/=]+)')
BARE_B64 = re.compile(r'(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{200,}={0,2}')


def looks_b64(s):
    return re.search(r'\d', s) and re.search(r'[A-Z]', s) and re.search(r'[a-z]', s)


def strip_b64(text):
    """-> (текст без base64, список блобов [(mime, base64)])"""
    blobs = []

    def d(m):
        blobs.append((m.group(1), m.group(3)))
        return f'data:{m.group(1)};base64,<b64:{len(m.group(3))}>'
    text = DATA_B64.sub(d, text)

    def b(m):
        s = m.group(0)
        if not looks_b64(s):
            return s
        blobs.append(('?', s))
        return f'<b64:{len(s)}>'
    return BARE_B64.sub(b, text), blobs


def unescape(text):
    def u(m):
        try:
            c = chr(int(m.group(1) or m.group(2), 16))
        except (ValueError, OverflowError):
            return m.group(0)
        return m.group(0) if c in '\r\n' else c
    text = re.sub(r'\\u(?:([0-9a-fA-F]{4})|\{([0-9a-fA-F]{1,6})\})', u, text)

    def h(m):
        try:
            c = chr(int(m.group(1), 16) if m.group(1) else int(m.group(2)))
        except (ValueError, OverflowError):
            return m.group(0)
        return m.group(0) if c in '\r\n' else c
    return re.sub(r'&#(?:x([0-9a-fA-F]{1,6})|(\d{1,7}));', h, text)


def load_allow(path):
    rules = []
    if not path or not os.path.exists(path):
        return rules
    for ln in open(path, encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln.strip() or ln.lstrip().startswith('#') or '::' not in ln:
            continue
        term, sub = ln.split('::', 1)
        rules.append((term.strip(), sub.strip()))
    return rules


def load_terms_file(path):
    out = []
    for ln in open(path, encoding='utf-8'):
        ln = ln.strip()
        if ln and not ln.startswith('#'):
            out.append(('свой: ' + ln[:24], [ln]))
    return out


def is_allowed(text, a, z, tid, allow):
    """Разрешено, если ПОДСТРОКА из файла разрешений встречается в тексте так, что накрывает само попадание."""
    for t, sub in allow:
        if (t != '*' and t != tid) or not sub:
            continue
        lo = max(0, z - len(sub))
        i = text.find(sub, lo, a + len(sub))
        while i != -1 and i <= a:
            if i + len(sub) >= z:
                return True
            i = text.find(sub, i + 1, a + len(sub))
    return False


# волна 3: слова поездки — только внутри модулей села (build_single.py встраивает их как <script data-village="js/village/…">)
VILLAGE_TERMS = {'named': {'кубач', 'село', 'горы', 'серебр'}, 'neutral': {'село', 'горы', 'серебр'}}
VILLAGE_BLOCK = re.compile(r'<script\s+data-village="js/village/[\w.-]+\.js"\s*>[\s\S]*?</script>')


def village_ranges(text):
    return [(m.start(), m.end()) for m in VILLAGE_BLOCK.finditer(text)]


def scan_text(text, terms, allow, ctx=50, comments=False, finale_ok=False, village=None):
    import bisect
    hits = []
    vterms = VILLAGE_TERMS.get(village or '', set())
    vr = village_ranges(text) if vterms else []
    in_v = lambda a: any(x0 <= a < x1 for x0, x1 in vr)
    line_starts = [0] + [m.end() for m in re.finditer('\n', text)]
    if comments:
        tid, pat = COMMENT_TERM
        for cm in COMMENT_RX.finditer(text):
            for m in re.finditer(pat, cm.group(0), I):
                a = cm.start() + m.start()
                c = (text[max(0, a - ctx):a] + '»' + m.group(0) + '«' + text[a + len(m.group(0)):a + len(m.group(0)) + ctx]).replace('\n', '⏎')
                hits.append({'term': tid, 'line': bisect.bisect_right(line_starts, a), 'match': m.group(0), 'ctx': c,
                             'allowed': is_allowed(text, a, a + len(m.group(0)), tid, allow)})
    for tid, pats in terms:
        for pat in pats:
            for m in re.finditer(pat, text, I):
                a, z = m.start(), m.end()
                allowed = is_allowed(text, a, z, tid, allow) or (tid in vterms and in_v(a))
                # сборка 19.11 (--finale-date): дата финала разрешена только как release в config.js
                if finale_ok and tid == '10 декабря' and m.group(0) == '2026-12-10' and re.search(r'release\W{0,4}$', text[max(0, a - 12):a]):
                    allowed = True
                line = bisect.bisect_right(line_starts, a)
                c = (text[max(0, a - ctx):a] + '»' + text[a:z] + '«' + text[z:z + ctx]).replace('\n', '⏎')
                hits.append({'term': tid, 'line': line, 'match': m.group(0), 'ctx': c, 'allowed': allowed})
    hits.sort(key=lambda h: (h['term'], h['line']))
    return hits


# ---------- метаданные внутри блобов (--blobs) ----------
def printable_runs(b, n=5):
    return [s.decode('latin-1') for s in re.findall(rb'[\x20-\x7e]{%d,}' % n, b)]


def blob_meta(mime, raw):
    """-> (тип, [строки метаданных]) — только то, что может нести имена/теги."""
    out = []
    if raw[:4] == b'glTF':
        try:
            ln = struct.unpack('<I', raw[12:16])[0]
            js = json.loads(raw[20:20 + ln].decode('utf-8'))
            a = js.get('asset', {})
            out.append('asset: ' + json.dumps(a, ensure_ascii=False))
            for k in ('nodes', 'meshes', 'materials', 'images', 'textures', 'animations', 'skins', 'scenes'):
                names = sorted({x.get('name', '') for x in js.get(k, []) if x.get('name')})
                if names:
                    out.append(f'{k}: ' + ', '.join(names[:40]) + (' …' if len(names) > 40 else ''))
            ex = [k for k in ('extras', 'extensionsUsed') if js.get(k)]
            if ex:
                out.append('top-level: ' + json.dumps({k: js[k] for k in ex}, ensure_ascii=False)[:300])
            for x in js.get('images', []):
                if x.get('uri') and not str(x['uri']).startswith('data:'):
                    out.append('image uri: ' + x['uri'])
        except Exception as e:  # noqa
            out.append(f'GLB не разобран: {e}')
        return 'glb', out
    if raw[:8] == b'\x89PNG\r\n\x1a\n':
        p = 8
        while p + 8 <= len(raw):
            ln, typ = struct.unpack('>I4s', raw[p:p + 8])
            body = raw[p + 8:p + 8 + ln]
            if typ in (b'tEXt', b'iTXt'):
                out.append(typ.decode() + ': ' + body.replace(b'\x00', b' | ').decode('utf-8', 'replace')[:200])
            elif typ == b'zTXt':
                k, _, rest = body.partition(b'\x00')
                try:
                    out.append('zTXt: ' + k.decode('latin-1') + ' | ' + zlib.decompress(rest[1:]).decode('utf-8', 'replace')[:200])
                except Exception:  # noqa
                    out.append('zTXt: ' + k.decode('latin-1'))
            elif typ in (b'eXIf',):
                out.append('eXIf: ' + ' '.join(printable_runs(body))[:200])
            p += 12 + ln
        return 'png', out
    if raw[:4] == b'RIFF' and raw[8:12] == b'WEBP':
        p = 12
        while p + 8 <= len(raw):
            typ, ln = struct.unpack('<4sI', raw[p:p + 8])
            if typ in (b'EXIF', b'XMP '):
                out.append(typ.decode().strip() + ': ' + ' '.join(printable_runs(raw[p + 8:p + 8 + ln]))[:300])
            p += 8 + ln + (ln & 1)
        return 'webp', out
    if raw[:3] == b'ID3' or raw[:4] in (b'OggS', b'fLaC') or (raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'):
        return 'audio', ['строки: ' + ' | '.join(printable_runs(raw[:65536], 4)[:30])[:400]]
    if raw[:2] == b'\xff\xd8':
        segs = []
        p = 2
        while p + 4 <= len(raw) and raw[p] == 0xFF:
            mk, ln = raw[p + 1], struct.unpack('>H', raw[p + 2:p + 4])[0]
            if 0xE1 <= mk <= 0xEF or mk == 0xFE:
                segs.append(f'APP{mk - 0xE0 if mk != 0xFE else "COM"}: ' + ' '.join(printable_runs(raw[p + 4:p + 2 + ln]))[:200])
            if mk == 0xDA:
                break
            p += 2 + ln
        return 'jpeg', segs
    if raw[:4] == b'wOF2' or raw[:4] == b'wOFF':
        return 'font', []      # таблица name сжата; имена шрифтов публичные
    if b'<svg' in raw[:2000]:
        return 'svg', ['svg-текст сканируется целиком']
    return mime, []


def scan_file(path, terms, allow, args):
    raw = open(path, encoding='utf-8', errors='replace').read()
    stripped, blobs = strip_b64(raw)
    text = unescape(stripped)
    hits = scan_text(text, terms, allow, args.context, comments=True, finale_ok=args.finale_date_ok, village=getattr(args, 'allow_village', None))
    blob_rows, blob_hits = [], []
    if args.blobs:
        for i, (mime, b64) in enumerate(blobs):
            try:
                data = base64.b64decode(b64 + '=' * (-len(b64) % 4))
            except Exception:  # noqa
                continue
            kind, meta = blob_meta(mime, data)
            blob_rows.append({'i': i, 'mime': mime, 'kind': kind, 'kb': round(len(data) / 1024, 1), 'meta': meta})
            body = data.decode('utf-8', 'replace') if kind == 'svg' else '\n'.join(meta)
            for h in scan_text(body, terms, allow, args.context):
                h['blob'] = f'#{i} {mime}'
                blob_hits.append(h)
    return {'file': path, 'bytes': len(raw.encode('utf-8')), 'b64_blocks': len(blobs),
            'scanned_chars': len(text), 'hits': hits, 'blobs': blob_rows, 'blob_hits': blob_hits}


def selftest():
    """Синтетические случаи: base64 не считается, экранирование раскрывается, границы слов, разрешения."""
    import tempfile
    b64 = base64.b64encode(b'BTS Kubachi \xd0\xba\xd1\x83\xd0\xb1\xd0\xb0\xd1\x87 ' * 40).decode()
    body = ('<style>@font-face{src:url(data:font/woff2;base64,QlRTQlRTQlRT' + 'QlRT' * 60 + ')}</style>\n'
            '<img src="data:image/png;base64,' + b64 + '">\n'
            '<script>const B = "' + ('QlRTa2V2aW4' * 30) + '9QlRT";\n'
            'say("\\u041a\\u0443\\u0431\\u0430\\u0447\\u0438");   // её комментарий\n'
            'say("договорились, горный, село, 1911, 9110, #911, Porsche"); x = "TODO_Имя"; y = /TODO|example\\./i;\n'
            'if (/[?&]mode=free/.test(location.search)) {} z = "{name}, солнце";\n</script>')
    want = {'кубач': 1, 'село': 1, 'Porsche': 1, 'TODO': 1, 'debug-param': 1, 'её в комментарии': 1, 'солнце+имя': 1}
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, 't.html')
        open(f, 'w', encoding='utf-8').write(body)
        class A: context = 50; blobs = True; finale_date_ok = False
        r = scan_file(f, list(TERMS), [('TODO', 'TODO|example\\.')], A)
    got = {}
    for h in r['hits']:
        if not h['allowed']:
            got[h['term']] = got.get(h['term'], 0) + 1
    ok = got == want and r['b64_blocks'] == 3 and not r['blob_hits']
    # область села: в блоке data-village слова поездки разрешены, снаружи — нет; neutral — без «кубач»
    vb = ('<script data-village="js/village/lines.js">\nsay("Кубачи, горное село, серебро, горы");\n</script>\n'
          '<script>\nsay("село");\n</script>')
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, 'v.html'); open(f, 'w', encoding='utf-8').write(vb)
        class B: context = 50; blobs = False; finale_date_ok = False; allow_village = 'named'
        rn = scan_file(f, list(TERMS), [], B)
        B.allow_village = 'neutral'; rx = scan_file(f, list(TERMS), [], B)
        B.allow_village = None; r0 = scan_file(f, list(TERMS), [], B)
    cnt = lambda rr: sorted(h['term'] for h in rr['hits'] if not h['allowed'])
    vok = cnt(rn) == ['село'] and cnt(rx) == ['кубач', 'село'] and len(cnt(r0)) == 5
    print('selftest village', 'OK' if vok else 'FAIL', cnt(rn), cnt(rx), cnt(r0))
    ok = ok and vok
    print('selftest', 'OK' if ok else 'FAIL', json.dumps({'got': got, 'want': want, 'b64': r['b64_blocks'], 'blob_hits': len(r['blob_hits'])}, ensure_ascii=False))
    return ok


def main():
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    if hasattr(signal, 'SIGPIPE'):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)   # «| head» не должен давать трассу
    ap = argparse.ArgumentParser(description='Поиск запретных слов после вырезания base64 (план v2, §7.5)')
    ap.add_argument('files', nargs='+')
    ap.add_argument('--allow', default=DEFAULT_ALLOW, help='файл разрешений (по умолчанию tools/scan_words.allow)')
    ap.add_argument('--no-allow', action='store_true', help='не применять разрешения')
    ap.add_argument('--terms-file', action='append', default=[], help='доп. регулярки, по одной в строке')
    ap.add_argument('--release', action='store_true', help='ещё и заглушки перед выкладкой')
    ap.add_argument('--blobs', action='store_true', help='ещё и метаданные внутри base64')
    ap.add_argument('--finale-date-ok', action='store_true', help='сборка 19.11: разрешить release финала 2026-12-10 в config')
    ap.add_argument('--allow-village', nargs='?', const='named', choices=['named', 'neutral'], default=None,
                    help='слова поездки в горы — только внутри <script data-village> (neutral: без «кубач»)')
    ap.add_argument('--context', type=int, default=50)
    ap.add_argument('--max', type=int, default=25, help='сколько попаданий показывать на термин')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()
    terms = list(TERMS) + (RELEASE_TERMS if args.release else [])
    for tf in args.terms_file:
        terms += load_terms_file(tf)
    allow = [] if args.no_allow else load_allow(args.allow)
    results, bad = [], 0
    for f in args.files:
        if not os.path.exists(f):
            sys.stderr.write(f'нет файла: {f}\n')
            sys.exit(2)
        r = scan_file(f, terms, allow, args)
        results.append(r)
        bad += sum(1 for h in r['hits'] + r['blob_hits'] if not h['allowed'])
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=1))
        sys.exit(1 if bad else 0)
    for r in results:
        live = [h for h in r['hits'] if not h['allowed']]
        okd = [h for h in r['hits'] if h['allowed']]
        print(f"== {r['file']}  ({r['bytes'] / 1024:.0f} KB, вырезано base64-блоков: {r['b64_blocks']})")
        counts = {}
        for h in live:
            counts[h['term']] = counts.get(h['term'], 0) + 1
        if not live:
            print('   чисто' + (f' (разрешённых попаданий: {len(okd)})' if okd else ''))
        else:
            print(f'   попаданий: {len(live)}' + (f' (+ разрешённых: {len(okd)})' if okd else '') + ' — ' +
                  ', '.join(f'{k} {v}' for k, v in sorted(counts.items(), key=lambda kv: -kv[1])))
            shown = {}
            for h in live:
                shown[h['term']] = shown.get(h['term'], 0) + 1
                if shown[h['term']] <= args.max:
                    print(f"   {h['term']:>14} :{h['line']:<6} {h['ctx']}")
                elif shown[h['term']] == args.max + 1:
                    print(f"   {h['term']:>14}  … ещё {counts[h['term']] - args.max}")
        if args.blobs:
            print(f"   блобы: {len(r['blobs'])}")
            for b in r['blobs']:
                print(f"     #{b['i']} {b['mime']} [{b['kind']}] {b['kb']} KB")
                for m in b['meta']:
                    print('        ' + m[:300])
            for h in r['blob_hits']:
                if not h['allowed']:
                    print(f"   В БЛОБЕ {h['blob']}: {h['term']} — {h['ctx']}")
    print(f'ИТОГО попаданий: {bad}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
