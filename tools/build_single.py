"""Собирает игру в один самодостаточный HTML (шрифты, стили, скрипты внутри).

Запуск:
  python3 tools/build_single.py           ->  dist/delo-10-10.html       (dev: как раньше, для тестов)
  python3 tools/build_single.py --prod    ->  dist/delo-10-10.prod.html  (для выкладки)

--prod делает поверх dev-сборки:
  1) вырезает отладку: выражения-проверки «?debug=1» заменяются на false, переопределения недели/дня
     (?wk, ?day) — на null; после этого минификатор сам выбрасывает мёртвые ветки (стенды ?room/?mode/?free,
     window.__c3d, window.__town, TOWNWARN). Список правил — STRIP_RULES ниже: только точные, однозначные замены;
  2) минифицирует каждый встроенный скрипт (terser, по умолчанию; или esbuild: --minifier esbuild).
     Уже сжатые *.min.js не трогает. Инструмент ставится один раз в tools/node_modules (npm, версии закреплены).
     Любая ошибка минификации — громкая остановка, старый prod-файл удаляется, чтобы не выложить устаревший;
  3) CSS: убирает комментарии и лишние пробелы; один файл шрифта на несколько весов встраивает один раз;
  4) после сборки ищет следы отладки в итоговом файле и печатает их (WARN). Запретные слова — tools/scan_words.py.

Другие флаги: --keep-debug (минифицировать, но отладку не вырезать; по умолчанию -> dist/delo-10-10.prod.debug.html,
  для прогона play3d.js и других тестов с ?debug=1 по сжатому коду), --out PATH (другой путь итогового файла).
Даты серий меняются только в сборке, исходник config.js не трогается (dev и prod одинаково):
  --ep2-date 2026-11-28      вариант Б для серии 2 (вместо даты из config.js)
  --finale-date 2026-12-10   сборка 19.11: у финала появляется дата, «в декабре» убирается
  Каждая замена должна найти ровно одно место, иначе — громкая остановка.
STORY_ONLY=1 — промежуточная сборка без прогулки (только сюжет серии 1), работает и с --prod.
--no-world — сборка без открытого города (js/world/* кроме hub.js, missions.js и trip2d.js; без js/village/*): серия 1
  и прогулка идут на улице с теми же миссиями (правило отката 26.10), работает и с --prod.
Волна 3:
  --unlock-all      ПРЕДПРОСМОТР АВТОРА: в сборке CONFIG.UNLOCK.all = true (машина, велосипед, собачка, поездка — сразу),
                    в углу экрана маленькая плашка «предпросмотр автора», в заголовке вкладки — «[предпросмотр]».
                    Файл по умолчанию другой: dist/delo-10-10.preview.html (--prod) / dist/delo-10-10.preview.dev.html,
                    поэтому её сборку (dist/delo-10-10.prod.html, открытие по датам) он не перезаписывает.
  --village-neutral в сборке CONFIG.VILLAGE_NAMED = false: «Горное село мастеров», указатель «В горы ↑». Кроме того, из модулей
                    села (js/village/*) вырезаются строки и комментарии только для названного режима (название села и
                    этнографические слова — VILLAGE.BANNED_NEUTRAL): в файле их нет вообще. То же делается, если в
                    config.js уже стоит VILLAGE_NAMED: false. Файл по умолчанию — с суффиксом .neutral.
  Скрипты села встраиваются как <script data-village="js/village/…">: tools/scan_words.py --allow-village разрешает
  слова поездки (кубач, село, горы, серебр) только внутри этих блоков; prod-сборка сама прогоняет такой скан в конце.
Волна 4:
  --embed-voices    «ВСЁ В ОДНОМ»: голоса (voice/manifest.json и все записи из него) встраиваются внутрь файла как
                    window.__VOICE_INLINE (base64) перед js/voice.js; voice.js берёт их оттуда без сети — файл работает
                    и по file:// (двойной клик, отправка файлом). Папка voice/ рядом не копируется. Имя файла — с суффиксом
                    .all-in-one (например, dist/delo-10-10.preview.all-in-one.html). Файл большой (≈ +20 МБ)."""
import argparse, base64, json, os, re, shutil, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, 'tools')
NODE_MODULES = os.path.join(TOOLS, 'node_modules')
# закреплённые версии (обе старше двух недель на момент выбора; меняются только здесь)
MINIFIERS = {'terser': 'terser@5.46.2', 'esbuild': 'esbuild@0.28.1'}
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

# ---------- правила вырезания отладки (только --prod) ----------
# (имя, файл или '*', регулярка, замена). Каждая замена даёт ровно то значение, которое выражение имеет
# в обычной ссылке без параметров, поэтому поведение игры для неё не меняется — пропадают только стенды.
STRIP_RULES = [
    # /debug=1/.test(location.search), /[?&]debug=1/.test(location.search)
    ('debug-regex', '*', r'/(?:\[\?&\])?debug=1/\.test\(\s*location\.search\s*\)', 'false'),
    # QS.get('debug') === '1', new URLSearchParams(location.search).get("debug") == '1'
    ('debug-param', '*', r'(?:\bQS|\bqs|new URLSearchParams\(\s*location\.search\s*\))\.get\(\s*([\'"])debug\1\s*\)\s*===?\s*([\'"])1\2', 'false'),
    # city3d.js: ?hq=1 — запрет автоснижения качества для замеров
    ('debug-hq', '*', r'/(?:\[\?&\])?hq=1/\.test\(\s*location\.search\s*\)', 'false'),
    # «window.ОТЛАДОЧНЫЙ_ФЛАГ && false» (остаётся после первого правила): чтение флага с window без побочных
    # эффектов, иначе terser оставляет одинокое «window.HERO3D_NOOUTLINE;»
    ('debug-window-flag', '*', r'\bwindow\.[A-Z][A-Z0-9_]*\s*&&\s*false\b', 'false'),
    # town.js: переопределение недели и дня из адреса (?wk=, ?day=) — работает даже без ?debug=1
    ('town-wk-day', 'town.js', r'\bnumParam\(\s*([\'"])(?:wk|day)\1\s*\)', 'null'),
]
# следы отладки в итоговом prod-файле (ищутся после минификации; terser меняет кавычки на двойные)
RESIDUE = [
    ('debug=1', r'debug=1'),
    ('window.__c3d / __town / __swRoom / __lastDoor', r'__(?:c3d|town|swRoom|lastDoor)\b'),
    ('?mode=free / ?free=1', r'mode=free|free=1'),
    ('?wk / ?day override', r'\w\(\s*["\'](?:wk|day)["\']\s*\)'),
    ('URL param room/mode/debug', r'\.get\(\s*["\'](?:room|mode|debug|wk|day|free)["\']\s*\)'),
    ('HERO3D_LOOK / HERO3D_NOOUTLINE', r'HERO3D_(?:LOOK|NOOUTLINE)'),
    ('?hq=1', r'hq=1'),
    ('room/free harness labels', r'нараспашку \(стенд\)|Комната: '),
]


def build_html(script_hook=None, css_hook=None):
    """dev-сборка как раньше. Для --prod: script_hook({имя: код}) -> {имя: код}, css_hook(имя, css) -> css."""
    html = rd('index.html')
    if os.environ.get('STORY_ONLY') == '1':
        html = re.sub(r'\s*<script src="js/(town|places/[^"]+)\.js"></script>', '', html)
    if NO_WORLD['on']:   # WORLD-CORE: --no-world — без открытого города (остаются WorldHub и таблица миссий, улица ведёт серию)
        html = re.sub(r'\s*<script src="js/world/(?!hub\.js|missions\.js|trip2d\.js)[^"]+\.js"></script>', '', html)
        html = re.sub(r'\s*<script src="js/village/[^"]+\.js"></script>', '', html)   # поездка в 3D — вместе с городом
        html = re.sub(r'\s*<script src="js/vehicles/[^"]+\.js"></script>', '', html)  # волна 4: седан — тоже только с городом (interact/daynight остаются)
        html = html.replace('<script src="js/config.js"></script>', '<script>window.WORLD_OFF = true;</script>\n  <script src="js/config.js"></script>', 1)
    if EMBED['on']:   # волна 4: --embed-voices — записи внутри файла, до js/voice.js
        assert html.count('<script src="js/voice.js"></script>') == 1, '--embed-voices: нет тега js/voice.js в index.html'
        html = html.replace('<script src="js/voice.js"></script>', voice_inline_tag() + '\n  <script src="js/voice.js"></script>', 1)
    fonts = rd('css/fonts.css')
    if css_hook:
        fonts = css_hook('fonts.css', fonts)

    def font_data(m):
        fn = m.group(1)
        b = base64.b64encode(open(os.path.join(ROOT, 'fonts', fn), 'rb').read()).decode()
        return f"url(data:font/woff2;base64,{b})"
    fonts = re.sub(r"url\(\.\./fonts/([^)]+)\)", font_data, fonts)
    html = re.sub(r'\s*<link rel="preload" as="font"[^>]*>', '', html)
    html = html.replace('<link rel="stylesheet" href="css/fonts.css" />', f'<style>{fonts}</style>')
    style = rd('css/style.css')
    if css_hook:
        style = css_hook('style.css', style)
    html = html.replace('<link rel="stylesheet" href="css/style.css" />', f"<style>{style}</style>")
    # список скриптов — из index.html, в его порядке; пропавший файл — громкая ошибка
    names = re.findall(r'<script src="js/([^"]+)\.js"></script>', html)
    codes = {js: rd(f'js/{js}.js') for js in names}
    if DATES and 'config' in codes:
        codes['config'] = set_dates(codes['config'], **DATES)
    if 'config' in codes:
        codes['config'] = set_flags(codes['config'])
    if VILLAGE['neutral'] is None:   # режим села из config.js сборки (после --village-neutral)
        VILLAGE['neutral'] = bool(re.search(r'\bVILLAGE_NAMED:\s*false\b', codes.get('config', '')))
    if VILLAGE['neutral']:
        codes = neutralize_village(codes)
    if script_hook:
        codes = script_hook(codes)
    for js in names:
        code = codes[js].replace('</script>', '<\\/script>')
        attr = f' data-village="js/{js}.js"' if js.startswith('village/') else ''
        html = html.replace(f'<script src="js/{js}.js"></script>', f'<script{attr}>\n{code}\n</script>', 1)
    if FLAGS['unlock_all']:   # предпросмотр автора: плашка в углу и пометка во вкладке
        html = re.sub(r'<title>', '<title>[предпросмотр] ', html, count=1)
        badge = ('<div id="authorPreview" aria-hidden="true" style="position:fixed;left:6px;bottom:calc(4px + env(safe-area-inset-bottom,0px));'
                 'z-index:2147483000;padding:2px 7px;border-radius:9px;background:rgba(58,46,63,.72);color:#fff;'
                 'font:800 10px/1.45 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none">предпросмотр автора</div>')
        assert html.count('</body>') == 1, 'нет </body> для плашки предпросмотра'
        html = html.replace('</body>', badge + '\n</body>', 1)
    assert '<script src="js/' not in html, 'не все скрипты встроены'
    return html


DATES = {}   # заполняется из --ep2-date / --finale-date
NO_WORLD = {'on': False}   # WORLD-CORE: --no-world
FLAGS = {'unlock_all': False}   # волна 3: --unlock-all (предпросмотр автора)
VILLAGE = {'neutral': None}     # волна 3: --village-neutral (True) или по config.js (None → смотрим VILLAGE_NAMED)
EMBED = {'on': False, 'stats': None}   # волна 4: --embed-voices (голоса внутри файла)


def voice_inline_tag():
    """--embed-voices: <script>window.__VOICE_INLINE = {'manifest.json': b64, '<файл>.mp3': b64, …}</script>.
    Встраиваются только записи, на которые ссылается манифест; нет файла из манифеста — громкая остановка."""
    vdir = os.path.join(ROOT, 'voice')
    mp = os.path.join(vdir, 'manifest.json')
    if not os.path.isfile(mp):
        raise SystemExit('ОШИБКА СБОРКИ: --embed-voices: нет voice/manifest.json (сначала python3 tools/voice_build.py)')
    raw = open(mp, 'rb').read()
    man = json.loads(raw.decode('utf-8'))
    used = set(v[0] for v in (man.get('lines') or {}).values())
    for ps in (man.get('pats') or {}).values():
        used |= {p[1] for p in ps}
    missing = sorted(f for f in used if not os.path.isfile(os.path.join(vdir, f)))
    if missing:
        raise SystemExit(f'ОШИБКА СБОРКИ: --embed-voices: в voice/ нет {len(missing)} записей из манифеста: {missing[:5]}')
    files = {'manifest.json': base64.b64encode(raw).decode('ascii')}
    size = len(raw)
    for f in sorted(used):
        b = open(os.path.join(vdir, f), 'rb').read(); size += len(b)
        files[f] = base64.b64encode(b).decode('ascii')
    blob = json.dumps(files, separators=(',', ':'))
    assert '</' not in blob
    EMBED['stats'] = {'lines': len(man.get('lines') or {}), 'files': len(files) - 1, 'mb': size / 1048576, 'b64mb': len(blob) / 1048576}
    return f'<script id="voiceInline">window.__VOICE_INLINE={blob};</script>'


def set_flags(cfg):
    """--unlock-all / --village-neutral: точные замены в config.js сборки, каждая ровно один раз."""
    def one(rx, repl, what):
        nonlocal cfg
        cfg, n = re.subn(rx, repl, cfg, flags=re.S)
        if n != 1:
            raise SystemExit(f'ОШИБКА СБОРКИ: {what}: в js/config.js найдено {n} мест вместо одного')
    if FLAGS['unlock_all']:
        one(r'(UNLOCK:\s*\{[^{}]*?\ball:\s*)false\b', lambda m: m.group(1) + 'true', '--unlock-all (UNLOCK.all)')
    if VILLAGE['neutral'] is True:
        one(r'(\bVILLAGE_NAMED:\s*)(?:true|false)\b', lambda m: m.group(1) + 'false', '--village-neutral (VILLAGE_NAMED)')
    return cfg


# нейтральный режим села: строки/шаблоны/комментарии модулей js/village/*, где есть название села или этнографические
# слова (VILLAGE.BANNED_NEUTRAL из js/village/lines.js + «кубач»), заменяются пустыми — в режиме named=false они не
# показываются (это проверяет REGION/QA: в шапке, местах, выходах, именах и 2D-карточках их нет). VILLAGE.BANNED_NEUTRAL
# становится []. Разбор — acorn (стоит вместе с terser в tools/node_modules); после замены код снова разбирается.
NEUTRAL_DRIVER = r"""
const fs = require('fs');
const acorn = require('acorn');
const [jobsPath] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const out = [];
for (const j of jobs) {
  const src = fs.readFileSync(j.src, 'utf8');
  const rx = new RegExp(j.rx, 'i');
  const comments = [];
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', ranges: true, onComment: (block, text, start, end) => comments.push({ start, end, text }) }); }
  catch (e) { console.error('NEUTRAL PARSE FAIL ' + j.name + ': ' + e.message); process.exit(1); }
  const reps = [];
  const walk = (n, parent) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' && n.left.property && n.left.property.name === 'BANNED_NEUTRAL' && n.right.type === 'ArrayExpression') { reps.push([n.right.start, n.right.end, '[]', 'BANNED_NEUTRAL']); return; }
    if (n.type === 'Literal' && typeof n.value === 'string' && rx.test(n.value)) {
      if (parent && (parent.type === 'Property' && parent.key === n && !parent.computed)) return;   // ключ объекта — не трогаем
      const q = src[n.start]; reps.push([n.start, n.end, q + q, n.value]); return;
    }
    if (n.type === 'TemplateElement' && rx.test(n.value.cooked || n.value.raw)) { reps.push([n.start, n.end, '', n.value.raw]); return; }
    for (const k of Object.keys(n)) { if (k === 'start' || k === 'end' || k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => walk(c, n)); else if (v && typeof v.type === 'string') walk(v, n); }
  };
  walk(ast, null);
  comments.forEach(c => { if (rx.test(c.text)) reps.push([c.start, c.end, src.slice(c.start, c.start + 2) === '//' ? '//' : '/**/', 'comment']); });
  reps.sort((a, b) => b[0] - a[0]);
  let code = src, last = Infinity;
  for (const [a, b, r] of reps) { if (b > last) continue; code = code.slice(0, a) + r + code.slice(b); last = a; }
  try { acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' }); } catch (e) { console.error('NEUTRAL REPARSE FAIL ' + j.name + ': ' + e.message); process.exit(1); }
  fs.writeFileSync(j.out, code);
  out.push({ name: j.name, n: reps.length, strings: reps.filter(r => r[3] !== 'comment').length, comments: reps.filter(r => r[3] === 'comment').length });
}
console.log(JSON.stringify(out));
"""


def neutralize_village(codes):
    """VILLAGE_NAMED = false: из js/village/* — строки и комментарии только для названного режима (см. NEUTRAL_DRIVER)."""
    # волна 4: и загрузчик гор / 2D-поездка / карта — у них строки «для названного режима» в ветках named (каз, пальтары, чуду)
    vill = [js for js in codes if js.startswith('village/') or js in ('world/regions', 'world/trip2d', 'world/minimap')]
    if not vill:
        return codes
    m = re.search(r'BANNED_NEUTRAL\s*=\s*\[([^\]]*)\]', codes.get('village/lines', ''))
    words = re.findall(r"'([^']+)'", m.group(1)) if m else []
    words = sorted({w.lower() for w in words} | {'кубач'}, key=len, reverse=True)
    rx = '|'.join(r'(?<![а-яё])' + re.escape(w) + (r'(?![а-яё])' if w in ('чуду', 'тутта', 'каз') else '') for w in words)
    if not shutil.which('node'):
        raise SystemExit('ОШИБКА СБОРКИ: --village-neutral: нужен node (acorn в tools/node_modules)')
    tmp = tempfile.mkdtemp(prefix='delo_neutral_')
    try:
        jobs = []
        for i, js in enumerate(vill):
            src = os.path.join(tmp, f'{i}.in.js'); open(src, 'w', encoding='utf-8').write(codes[js])
            jobs.append({'name': js + '.js', 'src': src, 'out': os.path.join(tmp, f'{i}.out.js'), 'rx': rx})
        jp = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jp, 'w'))
        drv = os.path.join(tmp, 'neutral.js'); open(drv, 'w').write(NEUTRAL_DRIVER)
        r = subprocess.run(['node', drv, jp], capture_output=True, text=True, env=dict(os.environ, NODE_PATH=NODE_MODULES), timeout=300)
        if r.returncode != 0:
            raise SystemExit('ОШИБКА СБОРКИ: --village-neutral:\n' + (r.stderr or r.stdout)[-2000:])
        for i, js in enumerate(vill):
            codes[js] = open(os.path.join(tmp, f'{i}.out.js'), encoding='utf-8').read()
        rep = json.loads(r.stdout.strip().splitlines()[-1])
        print('село без названия (VILLAGE_NAMED = false): ' + ', '.join(f"{x['name']} строк {x['strings']}, комментариев {x['comments']}" for x in rep))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return codes


def set_dates(cfg, ep2=None, finale=None):
    """Даты серий в тексте config.js — точные замены, каждая ровно один раз."""
    def one(rx, repl, what):
        nonlocal cfg
        cfg, n = re.subn(rx, repl, cfg, flags=re.S)
        if n != 1:
            raise SystemExit(f'ОШИБКА СБОРКИ: {what}: в js/config.js найдено {n} мест вместо одного')
    if ep2:
        one(r"(\{\s*n:\s*2\s*,[^{}]*?release:\s*)'[^']*'", lambda m: m.group(1) + f"'{ep2}'", '--ep2-date')
    if finale:
        one(r"(\{\s*n:\s*3\s*,[^{}]*?release:\s*)'[^']*'(\s*,\s*when:\s*'[^']*')?", lambda m: m.group(1) + f"'{finale}'", '--finale-date')
    return cfg


def min_css(css):
    """Осторожное сжатие CSS: убирает комментарии и лишние пробелы; строки в кавычках не трогает,
    пробелы вокруг «:» оставляет (в селекторах «a :hover» ≠ «a:hover»)."""
    out = []
    for m in re.finditer(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|(/\*.*?\*/)|([^"\'/]+|/)', css, re.S):
        if m.group(1):
            out.append(m.group(1))
        elif m.group(3):
            out.append(m.group(3))
    s = ''.join(out)
    parts = re.split(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')', s)
    for i in range(0, len(parts), 2):
        t = re.sub(r'\s+', ' ', parts[i])
        parts[i] = re.sub(r'\s*([{};,>])\s*', r'\1', t).replace(';}', '}')
    return ''.join(parts).strip()


def dedupe_fonts(css):
    """Один и тот же файл шрифта, объявленный для нескольких весов (вариативный Nunito 600/700/800/900),
    встраивался бы в base64 по разу на вес. Сливаем такие @font-face в один с диапазоном «font-weight: 600 900».
    Вызывается до встраивания, пока в src ещё короткие url(../fonts/…)."""
    faces = list(re.finditer(r'@font-face\s*\{([^}]*)\}', css))
    groups, order = {}, []
    for m in faces:
        d = {}
        for part in m.group(1).split(';'):
            if ':' in part:
                k, v = part.split(':', 1)
                d[k.strip().lower()] = v.strip()
        w = d.get('font-weight', '')
        key = tuple(sorted((k, v) for k, v in d.items() if k != 'font-weight'))
        if not re.fullmatch(r'\d{3}', w):
            key = ('__keep__', m.start())
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append((m, d, w))
    out = []
    for key in order:
        g = groups[key]
        if len(g) == 1 or key[0] == '__keep__':
            out += [m.group(0) for m, _, _ in g]
            continue
        ws = sorted(int(w) for _, _, w in g)
        d = dict(g[0][1])
        d['font-weight'] = f'{ws[0]} {ws[-1]}'
        out.append('@font-face{' + ';'.join(f'{k}:{v}' for k, v in d.items()) + '}')
    rest = re.sub(r'@font-face\s*\{[^}]*\}', '', css).strip()
    return '\n'.join(out) + ('\n' + rest if rest else '')


def die(msg, stale=None):
    if stale and os.path.exists(stale):
        os.remove(stale)
        msg += f'\n  старый файл удалён, чтобы не выложить устаревший: {stale}'
    sys.stderr.write(f'\nОШИБКА СБОРКИ (--prod): {msg}\n')
    sys.exit(2)


def ensure_tool(kind, out):
    pkg = MINIFIERS[kind]
    name, ver = pkg.rsplit('@', 1)
    pj = os.path.join(NODE_MODULES, name, 'package.json')
    if os.path.exists(pj) and json.load(open(pj)).get('version') == ver:
        return
    if not shutil.which('npm') or not shutil.which('node'):
        die('нужны node и npm, чтобы поставить ' + pkg, out)
    print(f'ставлю {pkg} в tools/node_modules …', flush=True)
    r = subprocess.run(['npm', 'install', '--prefix', TOOLS, '--no-save', '--no-package-lock', '--no-audit', '--no-fund', pkg],
                       capture_output=True, text=True, timeout=600)
    if r.returncode != 0 or not os.path.exists(pj):
        die(f'npm install {pkg} не удался:\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}', out)


# драйвер минификации: читает список заданий, пишет результаты; любая ошибка — код 1 и имя файла
NODE_DRIVER = r"""
const fs = require('fs');
const [kind, jobsPath] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
(async () => {
  for (const j of jobs) {
    const src = fs.readFileSync(j.src, 'utf8');
    let code;
    try {
      if (kind === 'terser') {
        const { minify } = require('terser');
        const r = await minify(src, {
          compress: { passes: 2, drop_debugger: true },
          mangle: true,                 // локальные имена; глобальные (верхний уровень скрипта) не трогаем
          toplevel: false, module: false, safari10: true,
          format: { comments: /^!|@license|@preserve/, ascii_only: false },
        });
        code = r.code;
      } else {
        const esb = require('esbuild');
        const r = await esb.transform(src, { minify: true, charset: 'utf8', legalComments: 'inline', target: 'es2019' });
        code = r.code;
      }
      if (!code || !code.trim()) throw new Error('пустой результат');
    } catch (e) {
      console.error('MINIFY FAIL ' + j.name + ': ' + (e && (e.message + (e.line ? ' (строка ' + e.line + ':' + e.col + ')' : '')) || e));
      process.exit(1);
    }
    fs.writeFileSync(j.out, code);
  }
})().catch(e => { console.error('MINIFY FAIL: ' + (e && e.stack || e)); process.exit(1); });
"""


def prod(args):
    # с --keep-debug файл по умолчанию другой: выкладываемый .prod.html никогда не содержит отладку
    dflt = 'delo-10-10.prod.debug.html' if args.keep_debug else 'delo-10-10.prod.html'
    if args.unlock_all:   # предпросмотр автора никогда не ложится на место её сборки
        dflt = 'delo-10-10.preview.debug.html' if args.keep_debug else 'delo-10-10.preview.html'
    if args.village_neutral:
        dflt = dflt.replace('.html', '.neutral.html')
    if args.embed_voices:
        dflt = dflt.replace('.html', '.all-in-one.html')
    out = os.path.abspath(args.out or os.path.join(ROOT, 'dist', dflt))
    args._out = out
    try:
        _prod(args, out)
    except SystemExit:
        raise
    except Exception as e:  # noqa — любая ошибка сборки: громко и без устаревшего файла
        die(f'{type(e).__name__}: {e}', out)


def _prod(args, out):
    ensure_tool(args.minifier, out)
    report = {'strip': {}, 'sizes': []}

    def hook(codes):
        # 1) вырезание отладки
        if not args.keep_debug:
            for name, where, rx, repl in STRIP_RULES:
                for js in codes:
                    if where != '*' and os.path.basename(js + '.js') != where:
                        continue
                    codes[js], n = re.subn(rx, repl, codes[js])
                    if n:
                        report['strip'].setdefault(name, []).append(f'{js}.js×{n}')
        # 2) минификация
        tmp = tempfile.mkdtemp(prefix='delo_min_')
        try:
            jobs = []
            for i, js in enumerate(codes):
                if js.endswith('.min'):
                    continue
                src = os.path.join(tmp, f'{i}.in.js')
                open(src, 'w', encoding='utf-8').write(codes[js])
                jobs.append({'name': js + '.js', 'src': src, 'out': os.path.join(tmp, f'{i}.out.js')})
            jp = os.path.join(tmp, 'jobs.json')
            json.dump(jobs, open(jp, 'w'))
            drv = os.path.join(tmp, 'driver.js')
            open(drv, 'w').write(NODE_DRIVER)
            env = dict(os.environ, NODE_PATH=NODE_MODULES)
            t0 = time.time()
            r = subprocess.run(['node', drv, args.minifier, jp], capture_output=True, text=True, env=env, timeout=900)
            if r.returncode != 0:
                die(f'минификация ({args.minifier}) не удалась:\n{(r.stderr or r.stdout)[-3000:]}', out)
            report['min_s'] = round(time.time() - t0, 1)
            for i, js in enumerate(codes):
                if js.endswith('.min'):
                    report['sizes'].append((js, len(codes[js].encode()), len(codes[js].encode()), 'как есть'))
                    continue
                o = os.path.join(tmp, f'{i}.out.js')
                if not os.path.exists(o):
                    die(f'нет результата минификации для {js}.js', out)
                code = open(o, encoding='utf-8').read()
                before = len(codes[js].encode())
                # минификатор мог развернуть '<\/script>' обратно — для HTML это конец тега
                code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)
                if re.search(r'<!--', code) and re.search(r'<script', code, re.I):
                    print(f'WARN: {js}.js содержит и «<!--», и «<script» — проверь, что тег закрывается', flush=True)
                codes[js] = code
                report['sizes'].append((js, before, len(code.encode()), ''))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return codes

    def css_hook(name, css):
        before = len(css.encode())
        if name == 'fonts.css':
            n0 = len(re.findall(r'@font-face', css))
            css = dedupe_fonts(css)
            report['fonts'] = f'@font-face {n0} -> {len(re.findall(r"@font-face", css))}'
        css = min_css(css)
        report['sizes'].append(('css/' + name[:-4], before, len(css.encode()), 'css'))
        return css

    html = build_html(hook, css_hook)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out + '.tmp', 'w', encoding='utf-8').write(html)
    os.replace(out + '.tmp', out)

    # отчёт
    print(f'минификатор: {MINIFIERS[args.minifier]} ({report.get("min_s", "?")} с)')
    tb = ta = 0
    for js, b, a, note in report['sizes']:
        if note == 'css':
            print(f'  {js + ".css":28s} {b / 1024:8.1f} KB -> {a / 1024:8.1f} KB')
            continue
        tb += b; ta += a
        print(f'  {js + ".js":28s} {b / 1024:8.1f} KB -> {a / 1024:8.1f} KB {note}')
    print(f'  {"скрипты всего":28s} {tb / 1024:8.1f} KB -> {ta / 1024:8.1f} KB')
    if report.get('fonts'):
        print('шрифты: ' + report['fonts'] + ' (один файл вариативного шрифта на все веса встраивается один раз)')
    if args.keep_debug:
        print('отладка: НЕ вырезана (--keep-debug)')
    else:
        print('вырезано: ' + ('; '.join(f'{k}: {", ".join(v)}' for k, v in report['strip'].items()) or 'ничего'))
    left = []
    for label, rx in ([] if args.keep_debug else RESIDUE):
        hits = re.findall(rx, html)
        if hits:
            left.append(f'{label} ×{len(hits)}')
    if left:
        print('WARN: в prod-файле остались следы отладки: ' + '; '.join(left))
        print('      (правило не сработало или проверка не обёрнута в ?debug=1 — см. STRIP_RULES и отчёт QA)')
    elif not args.keep_debug:
        print('следов отладки нет')
    print(out, round(len(html.encode()) / 1024), 'KB')
    embed_report()
    scan_built(out)


def embed_report():
    st = EMBED.get('stats')
    if st:
        print(f"голоса внутри файла (--embed-voices): {st['lines']} реплик, {st['files']} записей, {st['mb']:.1f} МБ (base64 {st['b64mb']:.1f} МБ); папка voice/ не нужна, работает по file://")


def scan_built(out):
    """Поиск запретных слов по готовому файлу (как tools/scan_words.py): слова поездки разрешены только в блоках села,
    в нейтральном режиме — только «село / горы / серебр», «кубач» — нигде. Печатает итог, сборку не останавливает."""
    try:
        sys.path.insert(0, TOOLS)
        import scan_words as SW
        mode = 'neutral' if VILLAGE['neutral'] else 'named'
        class A: context = 50; blobs = False; finale_date_ok = False; allow_village = mode
        r = SW.scan_file(out, list(SW.TERMS), SW.load_allow(SW.DEFAULT_ALLOW), A)
        live = [h for h in r['hits'] if not h['allowed']]
        print(f'скан запретных слов (--allow-village {mode}): ' + ('чисто' if not live else f'попаданий {len(live)}: ' + ', '.join(sorted({h["term"] for h in live}))))
    except Exception as e:  # noqa
        print(f'скан запретных слов не запустился: {e}')


# ===== ГОЛОСА (VOICE, волна 2) — единственная правка VOICE в этом файле ==========================================
# Папка voice/ (mp3 + manifest.json, собирает tools/voice_build.py) копируется рядом с итоговым файлом:
# dist/delo-10-10.html + dist/voice/. Выкладывать её рядом с index.html. Без неё игра тоже работает —
# вместо голосов мягкий «лепет» (js/voice.js сам это понимает).
def voices_off():
    # js/config.js: VOICES: false — автор выключил голоса совсем; папку voice/ рядом со сборкой не кладём
    try:
        return re.search(r'^\s*VOICES:\s*false\b', open(os.path.join(ROOT, 'js', 'config.js'), encoding='utf-8').read(), re.M) is not None
    except OSError:
        return False


def copy_voice(out_file):
    src = os.path.join(ROOT, 'voice')
    if voices_off():
        dst = os.path.join(os.path.dirname(os.path.abspath(out_file)), 'voice')
        if os.path.abspath(dst) != os.path.abspath(src) and os.path.isdir(dst):
            shutil.rmtree(dst)
        print('голоса: выключены в js/config.js (VOICES: false) — папка voice/ рядом со сборкой не нужна')
        return
    if not os.path.isfile(os.path.join(src, 'manifest.json')):
        print('голоса: папки voice/ нет — сборка без озвучки (в игре «лепет»)')
        return
    dst = os.path.join(os.path.dirname(os.path.abspath(out_file)), 'voice')
    if os.path.abspath(dst) == os.path.abspath(src):
        return
    os.makedirs(dst, exist_ok=True)
    names, n, size = set(os.listdir(src)), 0, 0
    for fn in names:
        a, b = os.path.join(src, fn), os.path.join(dst, fn)
        size += os.path.getsize(a)
        if not os.path.exists(b) or os.path.getsize(b) != os.path.getsize(a) or os.path.getmtime(b) < os.path.getmtime(a):
            shutil.copy2(a, b); n += 1
    for fn in os.listdir(dst):
        if fn not in names:
            os.remove(os.path.join(dst, fn))
    print(f'голоса: {len(names) - 1} реплик, {size / 1048576:.1f} МБ -> {dst} (обновлено {n}); выкладывать папку voice/ рядом с index.html')
# ===== /ГОЛОСА ===================================================================================================


def main():
    ap = argparse.ArgumentParser(description='Сборка игры в один HTML')
    ap.add_argument('--prod', action='store_true', help='минифицированная сборка без отладки -> dist/delo-10-10.prod.html')
    ap.add_argument('--minifier', choices=sorted(MINIFIERS), default='terser')
    ap.add_argument('--keep-debug', action='store_true', help='(--prod) не вырезать отладку')
    ap.add_argument('--out', help='(--prod) путь итогового файла')
    ap.add_argument('--ep2-date', help='дата серии 2 в сборке (вариант Б: 2026-11-28)')
    ap.add_argument('--finale-date', help='дата финала в сборке (с 19.11: 2026-12-10)')
    ap.add_argument('--no-world', action='store_true', help='без открытого города: серия и прогулка идут на улице (WORLD-CORE)')
    ap.add_argument('--unlock-all', action='store_true', help='предпросмотр автора: всё открыто сразу, плашка «предпросмотр автора» (другой файл)')
    ap.add_argument('--village-neutral', action='store_true', help='село без названия (VILLAGE_NAMED = false), строки только для названного режима вырезаны')
    ap.add_argument('--embed-voices', action='store_true', help='«всё в одном»: голоса внутри файла (window.__VOICE_INLINE), работает по file://; суффикс .all-in-one')
    args = ap.parse_args()
    EMBED['on'] = bool(args.embed_voices)
    NO_WORLD['on'] = bool(args.no_world)
    FLAGS['unlock_all'] = bool(args.unlock_all)
    VILLAGE['neutral'] = True if args.village_neutral else None
    for k in ('ep2_date', 'finale_date'):
        v = getattr(args, k)
        if v:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
                ap.error(f'--{k.replace("_", "-")}: нужен формат ГГГГ-ММ-ДД')
            DATES[k.split('_')[0]] = v
    if args.prod:
        r = prod(args)
        if not args.embed_voices:   # «всё в одном» — голоса уже внутри, папка рядом не нужна
            copy_voice(args.out or os.path.join(ROOT, 'dist', 'x.html'))   # ГОЛОСА (VOICE)
        return r
    html = build_html()
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    name = 'delo-10-10.preview.dev.html' if args.unlock_all else 'delo-10-10.html'
    if args.village_neutral:
        name = name.replace('.html', '.neutral.html')
    if args.embed_voices:
        name = name.replace('.html', '.all-in-one.html')
    out = os.path.abspath(args.out) if args.out else os.path.join(ROOT, 'dist', name)
    open(out, 'w', encoding='utf-8').write(html)
    print(out, round(len(html.encode()) / 1024), 'KB')
    embed_report()
    if not args.embed_voices:
        copy_voice(out)   # ГОЛОСА (VOICE)


if __name__ == '__main__':
    main()
