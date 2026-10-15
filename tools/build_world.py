"""Собирает стенд единого города (world.html) в один офлайн-файл: шрифты, стили, скрипты и модель героини внутри.
Запуск: python3 tools/build_world.py  ->  dist/world-proto.html (ссылка для «Замера» на телефоне автора)
Файлы игры не трогает: читает world.html (список скриптов — как в index.html, без js/main.js), css/*, js/**.
Проверяет, что world.html не отстал от index.html (все скрипты игры, кроме js/main.js, на месте).
Если js/hero3d.js нет — модель берётся из model3d/out/heroine_game.glb (рядом с проектом) и кладётся
в маленькую обёртку с тем же HERO3D.load(); нет и этого файла — город откроется с запасной куклой."""
import base64, os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB_FALLBACK = os.path.join(os.path.dirname(ROOT), 'model3d', 'out', 'heroine_game.glb')
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

SHIM = """(function () {
  'use strict';
  // обёртка модели для прототипа города (js/hero3d.js в сборке не было): тот же HERO3D.load() -> { geometry, map }
  const HERO3D = { anchors: { handFree: [0.21, 0.71, 0], handMag: [-0.21, 0.73, 0], head: [0, 1.5, -0.09], hem: 0.54, hip: 0.8, knee: 0.45 }, glb: "data:model/gltf-binary;base64,__B64__" };
  let pending = null;
  HERO3D.load = function () {
    if (pending) return pending;
    const T = window.THREE;
    if (!T || !T.GLTFLoader) return (pending = Promise.resolve(null));
    pending = new Promise(res => {
      try {
        const bin = atob(HERO3D.glb.slice(HERO3D.glb.indexOf(',') + 1)), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        new T.GLTFLoader().parse(u8.buffer, '', gl => {
          let mesh = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
          if (!mesh || !mesh.material || !mesh.material.map) { res(null); return; }
          const src = mesh.geometry, g = new T.BufferGeometry();
          ['position', 'normal', 'uv'].forEach(k => { const a = src.attributes[k]; if (!a) return; const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
            for (let i = 0; i < n; i++) { out[i * s] = a.getX(i); out[i * s + 1] = a.getY(i); if (s > 2) out[i * s + 2] = a.getZ(i); } g.setAttribute(k, new T.BufferAttribute(out, s)); });
          if (src.index) g.setIndex(new T.BufferAttribute(src.index.array.slice(), 1));
          g.applyMatrix4(mesh.matrixWorld); g.computeBoundingBox();
          // ноги на нуле, рост 1.9 — как в игре
          const bb = g.boundingBox, k = 1.9 / Math.max(1e-3, bb.max.y - bb.min.y), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
          g.translate(-cx, -bb.min.y, -cz); g.scale(k, k, k); g.computeBoundingSphere();
          res({ geometry: g, map: mesh.material.map });
        }, () => res(null));
      } catch (e) { res(null); }
    });
    return pending;
  };
  HERO3D.whenReady = (ms = 0) => Promise.race([HERO3D.load(), new Promise(r => setTimeout(() => r(null), ms))]);
  window.HERO3D = HERO3D;
})();"""


def main():
    html = rd('world.html')
    fonts = rd('css/fonts.css')
    fonts = re.sub(r"url\(\.\./fonts/([^)]+)\)",
                   lambda m: 'url(data:font/woff2;base64,%s)' % base64.b64encode(open(os.path.join(ROOT, 'fonts', m.group(1)), 'rb').read()).decode(), fonts)
    html = html.replace('<link rel="stylesheet" href="css/fonts.css" />', '<style>%s</style>' % fonts)
    html = html.replace('<link rel="stylesheet" href="css/style.css" />', '<style>%s</style>' % rd('css/style.css'))
    idx = set(re.findall(r'<script src="(js/[^"]+\.js)"></script>', rd('index.html'))) - {'js/main.js'}
    have = set(re.findall(r'<script src="(js/[^"]+\.js)"></script>', html))
    if idx - have:
        raise SystemExit('world.html отстал от index.html: нет ' + ', '.join(sorted(idx - have)))
    stamp = time.strftime('%Y-%m-%d %H:%M')
    html = html.replace('</head>', '  <script>window.WORLD_BUILD = %r;</script>\n</head>' % stamp, 1)
    hero_note = 'js/hero3d.js'
    for js in re.findall(r'<script src="(js/[^"]+\.js)"></script>', html):
        path = os.path.join(ROOT, js)
        if os.path.exists(path):
            code = open(path, encoding='utf-8').read()
        elif js == 'js/hero3d.js' and os.path.exists(GLB_FALLBACK):
            code = SHIM.replace('__B64__', base64.b64encode(open(GLB_FALLBACK, 'rb').read()).decode())
            hero_note = 'model3d/out/heroine_game.glb (обёртка)'
        elif js == 'js/hero3d.js':
            code = '/* модели нет: город откроется с запасной куклой */'
            hero_note = 'нет (запасная кукла)'
        else:
            raise SystemExit('нет файла: ' + js)
        code = code.replace('</script>', '<\\/script>')
        html = html.replace('<script src="%s"></script>' % js, '<script>\n%s\n</script>' % code, 1)
    assert '<script src="js/' not in html and 'href="css/' not in html, 'не всё встроено'
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', 'world-proto.html')
    open(out, 'w', encoding='utf-8').write(html)
    print(out, round(len(html.encode('utf-8')) / 1024), 'KB · героиня:', hero_note, '· сборка', stamp)


if __name__ == '__main__':
    main()
