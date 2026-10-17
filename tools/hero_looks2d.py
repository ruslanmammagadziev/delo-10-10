#!/usr/bin/env python3
"""
Генератор js/hero_looks2d.js: героиня в шести образах в 2D (вид спереди и со спины).

    python3 tools/hero_looks2d.py                    # пишет js/hero_looks2d.js
    python3 tools/hero_looks2d.py --only rust --png DIR --no-js   # превью одного образа
    python3 tools/hero_looks2d.py --check            # + жёсткие проверки (лицо, моргание, кроп)

Источники:
  art_src/heroine.webp                 — рисунок автора (лицо, уши, шея, кисти и лупа берутся отсюда пикселями);
  art_src/looks2d/<id>.front.svg       — одежда, причёска и аксессуары образа в кадре полной картинки (405×1000);
  art_src/looks2d/<id>.back.svg        — то же со спины (полностью вектор, кисти — пикселями).
В SVG группы (по id): hairBack, body, neck, hairFront, acc — каждая растрируется отдельно.
Порядок слоёв спереди: hairBack → body → основа головы (ровная кожа) → лицо/уши/шея автора → neck →
hairFront → кисти и лупа автора → acc. Со спины: hairBack → body → hairFront → кисти → acc.
Параметры образа — атрибуты корневого <svg>: data-neck (нижняя граница шеи автора, y кадра),
data-wrist (кисти — только ниже этой линии: для голых рук), data-head (кроп аватара «x y w h»).

Растр: SVG рисуется headless Chromium (Playwright) в разрешении исходника, слои складываются
там же и уменьшаются тем же ресайзом, что и в tools/hero_assets.py, поэтому пиксели лица внутри
маски совпадают с js/hero_assets.js (до сжатия WebP). tools/hero_assets.py не меняется.
Нужны: Python 3.9+, Pillow (WebP), numpy, scipy, scikit-image; node + playwright + chromium
(пути — переменные окружения NODE_PATH и PW_CHROME, по умолчанию как на машине сборки).
"""
import argparse, base64, io, json, os, re, subprocess, sys, tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_assets as HA  # noqa: E402

ROOT = HA.ROOT
SVG_DIR = os.path.join(ROOT, 'art_src', 'looks2d')
OUT = os.path.join(ROOT, 'js', 'hero_looks2d.js')
LOOKS = ['aurora', 'suede', 'pink', 'rust', 'cream', 'floral']
GROUPS = ['hairBack', 'body', 'neck', 'hairFront', 'acc']
PW_CHROME = os.environ.get('PW_CHROME', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
NODE_PATH = os.environ.get('NODE_PATH', '/opt/node22/lib/node_modules')

NECK_CUT = 316.0        # шея автора — до этой линии кадра (ниже ровная кожа без тени от подбородка)
SKIN = (248, 212, 190)  # ровная кожа лица и шеи с рисунка (основа головы и вектор под ней)
# череп под бывшим беретом: эллипс (кадр) — кожа там, где старые пряди закрывали висок и лоб;
# только выше SKULL_Y (ниже — контур щёк и челюсти из маски лица)
SKULL = (206.0, 168.0, 80.0, 98.0)
SKULL_Y = 204.0
DESHADOW, DESHADOW_Y = 18.0, 176.0   # px исходника от бывших волос и граница по высоте кадра (выше глаз)
Q_FRONT, Q_BACK = 90, 84   # перед — как HERO.full в hero_assets.py (q90): лицо без лишних артефактов сжатия


# ---------------------------------------------------------------- растр SVG (Chromium)
RENDER_JS = r'''
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch({ executablePath: job.chrome, args: ['--disable-gpu', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const it of job.items) {
    await page.setViewportSize({ width: it.w, height: it.h });
    await page.setContent('<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>' + it.svg + '</body></html>');
    for (const g of it.groups) {
      const ok = await page.evaluate(([g, all]) => {
        const has = !!document.getElementById(g);
        for (const id of all) { const el = document.getElementById(id); if (el) el.style.display = id === g ? '' : 'none'; }
        return has;
      }, [g, it.groups]);
      if (!ok) continue;
      await page.locator('svg').first().screenshot({ path: it.out + '.' + g + '.png', omitBackground: true });
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
'''


def svg_attrs(text):
    m = re.search(r'<svg\b[^>]*>', text)
    return dict(re.findall(r'([\w:-]+)="([^"]*)"', m.group(0))) if m else {}


def render_groups(items, tmp):
    """items: [{svg, w, h, out}] -> слои RGBA (np.float64, 0..1, премультиплицированные) по группам."""
    job = {'chrome': PW_CHROME, 'items': []}
    for it in items:
        # кадр 405×1000 -> пиксели исходника (ширина/высота кропа)
        svg = re.sub(r'<svg\b[^>]*>', lambda m: re.sub(r'\s(width|height)="[^"]*"', '', m.group(0)).replace(
            '<svg', '<svg width="%d" height="%d" preserveAspectRatio="none"' % (it['w'], it['h']), 1), it['svg'], count=1)
        job['items'].append({'svg': svg, 'w': it['w'], 'h': it['h'], 'out': it['out'], 'groups': GROUPS})
    jp = os.path.join(tmp, 'job.json')
    with open(jp, 'w') as f:
        json.dump(job, f)
    js = os.path.join(tmp, 'render.js')
    with open(js, 'w') as f:
        f.write(RENDER_JS)
    env = dict(os.environ, NODE_PATH=NODE_PATH)
    subprocess.run(['node', js, jp], check=True, env=env)
    res = []
    for it in items:
        L = {}
        for g in GROUPS:
            p = it['out'] + '.' + g + '.png'
            if os.path.exists(p):
                a = np.asarray(Image.open(p).convert('RGBA'), np.float64) / 255.0
                if a.shape[:2] != (it['h'], it['w']):
                    a = np.asarray(Image.open(p).convert('RGBA').resize((it['w'], it['h']), Image.LANCZOS), np.float64) / 255.0
                a[..., :3] *= a[..., 3:4]
                L[g] = a
        res.append(L)
    return res


# ---------------------------------------------------------------- слои автора
def over(dst, src):
    """dst, src — премультиплицированные RGBA 0..1; src поверх dst."""
    return src + dst * (1 - src[..., 3:4])


def pix_layer(rgb, alpha):
    a = np.clip(alpha, 0, 1)[..., None]
    return np.concatenate([rgb * a, a], -1)


class Source:
    """Рисунок автора в кадре исходника: маски лица и кистей, кадр, перевод координат."""

    def __init__(self):
        src = np.array(Image.open(HA.SRC).convert('RGBA'))
        self.K = HA.segment(src)
        self.fr = HA.frame(src)
        x0, y0, x1, y1, s, W, H = self.fr
        self.s, self.W, self.H = s, W, H
        self.crop = src[y0:y1, x0:x1].copy()
        self.Kc = self.K[y0:y1, x0:x1]
        self.h, self.w = self.Kc.shape
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        self.fy, self.fx = yy * s, xx * s          # координаты кадра для каждого пикселя кропа
        self.rgb = self.crop[..., :3] / 255.0
        self.alpha = self.crop[..., 3] / 255.0
        K = self.Kc
        skin = K == HA.K_SKIN
        # лицо, уши, шея (до data-neck), черты лица; без кистей
        head = (skin | (K == HA.K_FEAT)) & (self.fy < 420)
        self.head = ndi.binary_fill_holes(HA.largest(head))
        # основа головы: лицо + череп под бывшим беретом (выше линии висков)
        cx, cy, rx, ry = SKULL
        ell = (((self.fx - cx) / rx) ** 2 + ((self.fy - cy) / ry) ** 2 <= 1) & (self.fy < SKULL_Y)
        self.base = self.head | ell
        # край маски сегментации у бывших прядей рваный (особенно у ушей) — контур основы сглажен,
        # и пиксели лица не выходят за него
        op = ndi.binary_opening(self.base, structure=np.ones((3, 3)), iterations=3)
        self.base_s = ndi.gaussian_filter(op.astype(np.float64), 2.2) > 0.5
        self.in_base = np.clip((ndi.distance_transform_edt(self.base_s) - 1.5) / 1.6, 0, 1)
        # тень от бывших прядей на виске и лбу (выше глаз, у самых волос) — к ровной коже: новая причёска
        # открывает лоб по-своему, а старая тень выглядела бы полосой. Черты лица (брови) не трогаем.
        dh = ndi.distance_transform_edt(K != HA.K_HAIR)
        w = np.clip((DESHADOW - dh) / 6.0, 0, 1) * (self.fy < DESHADOW_Y) * skin * self.head
        # левый висок и ухо (слева на картинке): у автора их наполовину закрывала прядь, и под ней — тёплая тень
        # (темнее и оранжевее румянца). Открытые уши (rust, cream) дорисовываются вектором в группе neck.
        R8 = self.rgb[..., 0] * 255
        w2 = np.clip((246 - R8) / 6.0, 0, 1) * (self.fx < 156) * (self.fy > 150) * (self.fy < 242) * skin * self.head
        w2 *= np.clip((156 - self.fx) / 4.0, 0, 1)
        w = np.maximum(w, w2)
        self.deshadow = w > 0
        self.rgb_face = self.rgb * (1 - w[..., None]) + (np.array(SKIN) / 255.0) * w[..., None]
        # кисти (кожа ниже манжет) и лупа
        self.hands = (skin & (self.fy > 540)) | (K == HA.K_MAG)
        self.hands = ndi.binary_fill_holes(self.hands)
        # для вида со спины: свободная кисть (справа на картинке) и её зеркало слева
        free = skin & (self.fy > 540) & (self.fx > 250)
        self.free = HA.largest(free)
        self.cxs = (HA.BACK_CX - x0)                # ось симметрии фигуры в пикселях кропа

    def soft(self, m, erode=2, blur=0.8):
        if erode:
            m = ndi.binary_erosion(m, iterations=erode)
        return np.clip(ndi.gaussian_filter(m.astype(np.float64), blur), 0, 1) * (m | ndi.binary_dilation(m, iterations=2))

    def face_layer(self, neck):
        cut = np.clip((neck - self.fy) / (2.5 * self.s) + 0.5, 0, 1)   # мягкий горизонтальный срез шеи (~2.5 px кадра)
        # край маски: у бывших прядей пиксели смешаны с тёмными волосами — там срезаем глубже
        # (под лицом — ровная кожа основы, так что контур щёк и лба остаётся прежним, без тёмной каймы)
        d = ndi.distance_transform_edt(self.head)
        near_hair = ndi.distance_transform_edt(self.Kc != HA.K_HAIR) < 7
        m = np.where(near_hair, 3.2, 1.6)
        a = np.clip((d - m) / 1.6, 0, 1) * self.in_base * cut * self.alpha
        return pix_layer(self.rgb_face, a)

    def base_layer(self, neck):
        m = self.base_s & (self.fy < neck + 6)
        a = np.clip(ndi.gaussian_filter(m.astype(np.float64), 0.7), 0, 1)
        return pix_layer(np.broadcast_to(np.array(SKIN) / 255.0, self.rgb.shape), a)

    def hands_layer(self, wrist=None):
        a = self.soft(self.hands, erode=1, blur=0.6) * self.alpha
        if wrist is not None:
            a = a * np.clip((self.fy - wrist) / (3.0 * self.s) + 0.5, 0, 1)
        return pix_layer(self.rgb, a)

    def back_hands_layer(self, wrist=None):
        """Со спины: свободная кисть справа как есть и её зеркало слева (как в js/hero_assets.js)."""
        a = self.soft(self.free, erode=1, blur=0.6) * self.alpha
        if wrist is not None:
            a = a * np.clip((self.fy - wrist) / (3.0 * self.s) + 0.5, 0, 1)
        L = pix_layer(self.rgb, a)
        xs = np.arange(self.w)
        xm = np.round(2 * self.cxs - xs).astype(int)
        ok = (xm >= 0) & (xm < self.w)
        M = np.zeros_like(L)
        M[:, ok] = L[:, xm[ok]]
        left = (np.arange(self.w) < self.cxs)[None, :, None]
        return np.where(left, M, L)


def downsample(S, P):
    """Премультиплицированный слой кропа -> RGBA uint8 полной картинки (тот же ресайз, что у hero_assets)."""
    a = P[..., 3:4]
    rgb = np.where(a > 1e-6, P[..., :3] / np.maximum(a, 1e-6), 0)
    im = np.dstack([np.clip(rgb * 255 + 0.5, 0, 255), np.clip(a * 255 + 0.5, 0, 255)]).astype(np.uint8)
    out = np.array(HA.resize_rgba(Image.fromarray(im, 'RGBA'), (S.W, S.H)))
    return HA.decontaminate(out)


def uri(img, q):
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=q, method=6, exact=False)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


# ---------------------------------------------------------------- сборка образа
def build_look(S, lid, tmp, keep_layers=False):
    fsvg = os.path.join(SVG_DIR, lid + '.front.svg')
    bsvg = os.path.join(SVG_DIR, lid + '.back.svg')
    ft = open(fsvg, encoding='utf-8').read()
    bt = open(bsvg, encoding='utf-8').read() if os.path.exists(bsvg) else None
    at = svg_attrs(ft)
    neck = float(at.get('data-neck', NECK_CUT))
    wrist = float(at['data-wrist']) if 'data-wrist' in at else None
    items = [{'svg': ft, 'w': S.w, 'h': S.h, 'out': os.path.join(tmp, lid + '.front')}]
    if bt:
        items.append({'svg': bt, 'w': S.w, 'h': S.h, 'out': os.path.join(tmp, lid + '.back')})
    Ls = render_groups(items, tmp)
    z = np.zeros((S.h, S.w, 4))
    F = Ls[0]
    lay = {
        'hairBack': F.get('hairBack', z), 'body': F.get('body', z), 'base': S.base_layer(neck),
        'face': S.face_layer(neck), 'neck': F.get('neck', z), 'hairFront': F.get('hairFront', z),
        'hands': S.hands_layer(wrist), 'acc': F.get('acc', z),
    }
    P = z.copy()
    for k in ('hairBack', 'body', 'base', 'face', 'neck', 'hairFront', 'hands', 'acc'):
        P = over(P, lay[k])
    front = downsample(S, P)
    back = None
    if bt:
        B = Ls[1]
        Q = z.copy()
        for k in ('hairBack', 'body', 'hairFront'):
            Q = over(Q, B.get(k, z))
        Q = over(Q, S.back_hands_layer(wrist))
        Q = over(Q, B.get('acc', z))
        back = downsample(S, Q)
    # кроп аватара: квадрат того же размера, что HERO.anchors.head; верх — на 6 px выше макушки
    if 'data-head' in at:
        head = [float(v) for v in at['data-head'].split()]
    else:
        al = front[..., 3]
        rows = np.where((al[:, 60:345] > 40).any(1))[0]
        top = float(rows.min()) if len(rows) else 0.0
        hx, hy, hw, hh = HA_ANCH['head']
        head = [hx, round(max(0.0, top - 6), 1), hw, hh]
    R = {'id': lid, 'front': front, 'back': back, 'head': head, 'neck': neck}
    if keep_layers:
        R['layers'] = {k: downsample(S, v) for k, v in lay.items()}
        R['P'] = P
    return R


HA_ANCH = {'head': [24.3, 1.8, 355.7, 355.7]}


def load_hero_anchors():
    """Якоря из js/hero_assets.js (кроп аватара — того же размера)."""
    p = os.path.join(ROOT, 'js', 'hero_assets.js')
    try:
        t = open(p, encoding='utf-8').read(4000)
        m = re.search(r'"anchors":(\{.*?\}\}?)\s*,"defaults"', t)
        if m:
            HA_ANCH.update(json.loads(m.group(1)))
    except Exception:
        pass


# ---------------------------------------------------------------- проверки
def checks(S, R, hero_full):
    """Лицо совпадает с рисунком автора (до сжатия), моргание не задевает пряди и аксессуары, кроп с макушкой."""
    out = {}
    f = R['front']
    # внутренность маски лица (вдали от среза шеи и от края маски — ресайз видит ~5 px исходника)
    inner = ndi.binary_erosion(S.head & (S.fy < R['neck'] - 8) & ~ndi.binary_dilation(S.deshadow, iterations=6), iterations=9)
    inner_f = np.array(Image.fromarray((inner * 255).astype(np.uint8)).resize((S.W, S.H), Image.BOX)) == 255
    # пряди и аксессуары поверх лица — не «изменение лица», их считаем отдельно (доля лица под ними)
    L = R['layers']
    cov = np.zeros((S.H, S.W), bool)
    for k in ('hairFront', 'acc', 'neck'):
        cov |= L[k][..., 3] > 0
    vis = inner_f & ~ndi.binary_dilation(cov, iterations=4)
    d = np.abs(f[..., :3].astype(int) - hero_full[..., :3].astype(int))[vis]
    out['face_px'] = int(vis.sum())
    out['face_covered'] = round(1 - vis.sum() / max(1, inner_f.sum()), 3)
    out['face_maxdiff'] = int(d.max()) if d.size else -1
    out['face_identical'] = bool(d.size and d.max() <= 1)
    # глаза и брови (рамки автора) — не под прядями
    ex = [(HA.FEATURE_BOXES[k], k) for k in ('browL', 'browR', 'eyeL', 'eyeR', 'nose', 'mouth')]
    x0, y0 = S.fr[0], S.fr[1]
    hit = []
    for (bx0, by0, bx1, by1), k in ex:
        fx0, fy0 = int((bx0 - x0) * S.s), int((by0 - y0) * S.s)
        fx1, fy1 = int(np.ceil((bx1 - x0) * S.s)), int(np.ceil((by1 - y0) * S.s))
        if cov[fy0:fy1, fx0:fx1].any():
            hit.append(k)
    out['features_covered'] = hit
    # моргание: заплатка HERO.blink поверх; под непрозрачной её частью — только кожа лица
    bl = R.get('blink')
    if bl is not None:
        bimg, bx, by = bl
        ba = np.asarray(bimg)[..., 3] > 8
        cov2 = np.zeros((S.H, S.W), bool)
        for k in ('hairFront', 'acc', 'neck'):
            cov2 |= L[k][..., 3] > 24
        sub = cov2[by:by + ba.shape[0], bx:bx + ba.shape[1]][:ba.shape[0], :ba.shape[1]]
        out['blink_hits'] = int((sub & ba[:sub.shape[0], :sub.shape[1]]).sum())
    hx, hy, hw, hh = R['head']
    al = f[..., 3]
    rows = np.where((al[:, 60:345] > 40).any(1))[0]
    out['hair_top'] = int(rows.min())
    out['crop_ok'] = bool(hy <= rows.min() and hy + hh >= 290)
    return out


def hero_full_ref(S):
    """Полная картинка так, как её делает hero_assets.build (до перекраски волос и сжатия): для сверки лица."""
    full = np.array(HA.resize_rgba(Image.fromarray(S.crop), (S.W, S.H)))
    return HA.decontaminate(full)


def hero_blink():
    p = os.path.join(ROOT, 'js', 'hero_assets.js')
    t = open(p, encoding='utf-8').read()
    m = re.search(r'blink:\s*(\{"src":\s*"data:image/png;base64,([^"]+)",\s*"x":\s*(\d+),\s*"y":\s*(\d+)[^}]*\})', t)
    if not m:
        return None
    im = Image.open(io.BytesIO(base64.b64decode(m.group(2)))).convert('RGBA')
    return im, int(m.group(3)), int(m.group(4))


# ---------------------------------------------------------------- JS
JS_HEAD = '''/* =====================================================================
   ОБРАЗЫ ГЕРОИНИ В 2D: шесть рисунков (спереди и со спины) — window.HERO_LOOKS2D.
   Файл сгенерирован tools/hero_looks2d.py из art_src/looks2d/*.svg и art_src/heroine.webp — руками не править.
   Лицо, уши, шея, кисти и лупа — пиксели рисунка автора; одежда, причёска и аксессуары — по роликам образов.
   Кадр и якоря — как у window.HERO (405×1000, ноги в той же точке); head — кроп аватара этого образа.
   ===================================================================== */
'''


def write_js(res, path=OUT):
    items = {}
    sizes = {}
    for R in res:
        fu, fn = uri(Image.fromarray(R['front'], 'RGBA'), Q_FRONT)
        it = {'full': fu, 'head': [round(v, 1) for v in R['head']]}
        bn = 0
        if R['back'] is not None:
            bu, bn = uri(Image.fromarray(R['back'], 'RGBA'), Q_BACK)
            it['back'] = bu
        items[R['id']] = it
        sizes[R['id']] = (fn, bn)
    data = {'v': 1, 'w': res[0]['front'].shape[1], 'h': res[0]['front'].shape[0], 'items': items}
    js = JS_HEAD + "(function () {\n  'use strict';\n  window.HERO_LOOKS2D = " + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n})();\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(js)
    return len(js.encode('utf-8')), sizes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='образы через запятую (по умолчанию все)')
    ap.add_argument('--png', help='папка для PNG: образы, слои и превью')
    ap.add_argument('--no-js', action='store_true', help='не писать js/hero_looks2d.js')
    ap.add_argument('--check', action='store_true', help='жёсткие проверки (лицо, моргание, кроп)')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    load_hero_anchors()
    ids = a.only.split(',') if a.only else LOOKS
    S = Source()
    ref = hero_full_ref(S) if a.check else None
    blink = hero_blink() if a.check else None
    res = []
    with tempfile.TemporaryDirectory() as tmp:
        for lid in ids:
            if not os.path.exists(os.path.join(SVG_DIR, lid + '.front.svg')):
                print('  нет art_src/looks2d/%s.front.svg — пропуск' % lid)
                continue
            R = build_look(S, lid, tmp, keep_layers=bool(a.png or a.check))
            if a.check:
                R['blink'] = blink
                R['check'] = checks(S, R, ref)
                print('  %-7s %s' % (lid, json.dumps(R['check'], ensure_ascii=False)))
            if a.png:
                os.makedirs(a.png, exist_ok=True)
                Image.fromarray(R['front'], 'RGBA').save(os.path.join(a.png, lid + '.front.png'))
                if R['back'] is not None:
                    Image.fromarray(R['back'], 'RGBA').save(os.path.join(a.png, lid + '.back.png'))
                for k, v in R['layers'].items():
                    Image.fromarray(v, 'RGBA').save(os.path.join(a.png, '%s.L_%s.png' % (lid, k)))
            res.append(R)
    if not res:
        print('нечего собирать')
        return 1
    if not a.no_js:
        if len(res) < len(LOOKS) and not a.only:
            print('  внимание: собрано %d образов из %d' % (len(res), len(LOOKS)))
        n, sizes = write_js(res, a.out)
        print('hero_looks2d.js: %.1f KB' % (n / 1024))
        for k, (fn, bn) in sizes.items():
            print('  %-7s front %5.1f KB  back %5.1f KB  head %s' % (k, fn / 1024, bn / 1024, next(r['head'] for r in res if r['id'] == k)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
