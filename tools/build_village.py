"""Волна 4/4B: собирает стенд горного села (village.html + js/village/**) в один офлайн-файл.

Запуск:
  python3 tools/build_village.py            ->  dist/village-proto.html
  python3 tools/build_village.py --layout   ->  ещё и обновить блок раскладки в js/village/kubachi.js
                                                  из plan2/kubachi_blockout/layout.json (рядом с проектом)
Файлы игры не трогает (кроме блока раскладки по --layout). Необязательные скрипты стенда берутся, если они есть:
js/village/{serpentine,drive,bazaar,kaz,wedding,hotel,zipline}.js, js/interact.js (руки), js/daynight.js (день/ночь),
js/vehicles/sedan.js (красный седан по ?car=sedan), модель героини, js/world/*; нет файла — стенд откроется без него.
Параметры готового файла — как у village.html: ?region=kubachi|serpentine|hotel &named=0 &season=winter &view=p1..p5 &kaz=auto|offer|off &clock=час &zip=1 &zipdur=сек
&debug=1 &q=low|high &bazaar=1|0 &night=1 &h=час &look=tower_top &climb=bottom|top &car=sedan
"""
import base64, json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUT = os.path.join(os.path.dirname(ROOT), 'plan2', 'kubachi_blockout', 'layout.json')
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
OPTIONAL = {'js/hero3d.js', 'js/hero_anim.js', 'js/world/kit.js', 'js/world/actors.js', 'js/world/car.js',
            'js/village/serpentine.js', 'js/village/drive.js', 'js/village/bazaar.js', 'js/village/kaz.js',
            'js/village/wedding.js', 'js/village/hotel.js', 'js/village/zipline.js', 'js/village/summit.js',
            'js/interact.js', 'js/daynight.js', 'js/vehicles/sedan.js'}


def layout_block():
    """Сжатый блок данных раскладки (те же поля, что в layout.json; коды — см. комментарий в блоке)."""
    d = json.load(open(LAYOUT, encoding='utf-8'))
    W = {'rubble': 'r', 'rubbleY': 'y', 'ochre': 'o', 'cream': 'c', 'white': 'w', 'pink': 'p', 'lilac': 'l', 'blueFull': 'b', 'creamPlain': 'c'}
    RF = {'flat': 'f', 'hip': 'h', 'shed': 's', 'gable': 'g'}
    RM = {'yard': 'Y', 'silver': 'S', 'silverRust': 'R', 'rust': 'U', 'slate': 'L', 'red': 'D'}
    FR = {'white': 'w', 'blue': 'b', 'turq': 't', 'greyblue': 'g'}
    js = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    out = []
    for h in d['houses']:
        g = h.get('gallery')
        gs = ''.join(str(s) for s in g['storeys']) if g else ''
        code = W[h['wall']] + ('1' if h['blueBand'] else '0') + RF[h['roof']] + RM[h['roofMat']] + (('|' + gs + '|' + str(g['bays']) + '|' + str(g['proj']) + '|' + FR[g['frame']]) if gs else '')
        out.append([h['id'][1:], h['row'], h['type'][1], round(h['phi'], 4), h['x'], h['z'], round(h['ry'], 4), h['w'], h['d'], h['y0'], h['storeys'], code, h.get('tag', '')])
    L = ['  // @layout-begin (tools/build_village.py --layout)',
         '  // дома ядра: [номер, ряд, тип K, phi, x, z, ry, ширина, глубина, y0, этажей, "стена+синяя полоса+крыша+кровля|галерея: этажи|пролёты|вынос|рама", метка]',
         '  const HOUSES = ' + js(out) + ';',
         '  const SHEDS = ' + js([[s['x'], s['z'], s['ry'], s['w'], s['d'], s['y0'], RM[s['roofMat']]] for s in d['sheds']]) + ';',
         '  const SPUR = ' + js([[s['x'], s['z'], s['y0'], s['w'], s['d'], s['h'], s['ry'], RM[s['roofMat']], W[s['wall']]] for s in d['spur']]) + ';',
         '  const FLANK = ' + js([[s['x'], s['z'], s['y0'], s['w'], s['d'], s['h'], s['ry'], RM[s['roofMat']], W[s['wall']]] for s in d['flank']]) + ';',
         '  // @layout-end']
    return '\n'.join(L)


def update_layout():
    p = os.path.join(ROOT, 'js', 'village', 'kubachi.js')
    src = open(p, encoding='utf-8').read()
    a, b = src.find('  // @layout-begin'), src.find('  // @layout-end')
    if a < 0 or b < 0:
        raise SystemExit('в kubachi.js нет меток @layout-begin / @layout-end')
    b = src.index('\n', b) + 1
    src = src[:a] + layout_block() + '\n' + src[b:]
    open(p, 'w', encoding='utf-8').write(src)
    print('раскладка обновлена:', p)


def main():
    if '--layout' in sys.argv:
        update_layout()
    html = rd('village.html')
    fonts = rd('css/fonts.css')
    fonts = re.sub(r"url\(\.\./fonts/([^)]+)\)", lambda m: 'url(data:font/woff2;base64,%s)' % base64.b64encode(open(os.path.join(ROOT, 'fonts', m.group(1)), 'rb').read()).decode(), fonts)
    html = html.replace('<link rel="stylesheet" href="css/fonts.css" />', '<style>%s</style>' % fonts)
    stamp = time.strftime('%Y-%m-%d %H:%M')
    html = html.replace('</head>', '  <script>window.VILLAGE_BUILD = %r;</script>\n</head>' % (stamp + ' w4'), 1)
    used, skipped = [], []
    for tag, js in re.findall(r'(<script src="(js/[^"]+\.js)"(?: onerror="void 0")?></script>)', html):
        path = os.path.join(ROOT, js)
        if os.path.exists(path):
            code = open(path, encoding='utf-8').read().replace('</script>', '<\\/script>')
            html = html.replace(tag, '<script>\n%s\n</script>' % code, 1)
            used.append(js)
        elif js in OPTIONAL:
            html = html.replace(tag, '<!-- %s: нет в сборке -->' % js, 1)
            skipped.append(js)
        else:
            raise SystemExit('нет обязательного файла: ' + js)
    assert '<script src="js/' not in html and 'href="css/' not in html, 'не всё встроено'
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', 'village-proto.html')
    open(out, 'w', encoding='utf-8').write(html)
    print(out, round(len(html.encode('utf-8')) / 1024), 'KB · скриптов', len(used), '· без:', ', '.join(skipped) or '—', '· сборка', stamp)


if __name__ == '__main__':
    main()
