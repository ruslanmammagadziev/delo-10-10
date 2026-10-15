#!/usr/bin/env python3
"""
Генератор js/hero_assets.js из авторского рисунка героини (art_src/heroine.webp).

    python3 tools/hero_assets.py                 # пишет js/hero_assets.js
    python3 tools/hero_assets.py --debug DIR     # + отладочные картинки в DIR

Нужны Python 3.9+, Pillow (с поддержкой WebP), numpy, scipy, scikit-image.
Все координаты «руками» ниже заданы в пикселях ИСХОДНИКА (1584×2000) и
относятся только к этому рисунку: при замене art_src/heroine.webp на другой
их придётся перепроверить (см. --debug).
"""
import argparse, base64, io, json, math, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
from skimage.color import rgb2lab
from skimage.morphology import convex_hull_image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art_src', 'heroine.webp')
OUT = os.path.join(ROOT, 'js', 'hero_assets.js')

HAIR_VS_LIGHT, HAIR_VS_BERET = 0.6, 1.6   # см. refine_boundaries
BACK = True               # синтезировать вид со спины (False -> HERO.back = null)
OMBRE_SRC = (770, 905)    # по высоте исходника: тёмные волосы -> карамельные кончики (smoothstep)
OMBRE = False             # решение №10: кончики в цвет волос (рисунок перекрашивается при сборке); True — как нарисовано
FULL_H = 1000          # высота полноростовой картинки
PAD = 12               # поля вокруг фигуры (в пикселях исходника)

# значения карты меток (labels)
L_NONE, L_HAIR, L_COAT, L_BOW, L_BERET, L_SHOES, L_TIPS = 0, 1, 2, 3, 4, 5, 6
# внутренние классы сегментации (все, кроме волос/пальто/банта/берета/туфель, дают метку 0)
K_BG, K_HAIR, K_COAT, K_BOW, K_BERET, K_SHOES, K_SKIN, K_FEAT, K_TIGHTS, K_MAG, K_UNK = range(11)
K2LABEL = np.array([0, L_HAIR, L_COAT, L_BOW, L_BERET, L_SHOES, 0, 0, 0, 0, 0], np.uint8)
KNAMES = ['bg', 'hair', 'coat', 'bow', 'beret', 'shoes', 'skin', 'feat', 'tights', 'mag', 'unk']

# палитры игры (js/ep1.js) — только для превью
DEFAULT = {'bow': '#F08FA8', 'coat': '#E9D4B6', 'hair': '#4A3128'}
BOWS = ['#F08FA8', '#FFF1E6', '#B0304A', '#2E2A3B', '#A98BE8']
COATS = ['#E9D4B6', '#F2C4CE', '#6B6F7A', '#FFFDF9']
HAIRS = ['#4A3128', '#1F1A1D', '#7A4A2E', '#D9B27A', '#F2A7C0']
TIPS_MIX = ('#C8915E', 0.55)    # кончики = mix(волосы, #C8915E, 0.55) — как в art.js / city3d.js


# ---------------------------------------------------------------- утилиты
def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64)


def rgb2hex(c):
    # floor(x + 0.5) — как Math.round в JS (np.round округляет .5 к чётному)
    c = np.clip(np.floor(np.asarray(c, np.float64) + 0.5), 0, 255).astype(int)
    return '#%02X%02X%02X' % tuple(c)


def mix_hex(a, b, t):
    """Тот же mix, что в art.js: покомпонентно, с округлением."""
    pa, pb = hex2rgb(a), hex2rgb(b)
    return rgb2hex(pa * (1 - t) + pb * t)


def luma(rgb):
    rgb = np.asarray(rgb, np.float64)
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def largest(mask, k=1, minsize=0):
    lb, n = ndi.label(mask)
    if n == 0:
        return np.zeros_like(mask)
    sz = ndi.sum(np.ones(mask.shape), lb, range(1, n + 1))
    out = np.zeros_like(mask)
    for i in np.argsort(sz)[::-1][:k]:
        if sz[i] >= minsize:
            out |= lb == (i + 1)
    return out


def poly_mask(shape, pts):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
    return np.array(m) > 0


def data_uri(img, fmt, **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    mime = {'WEBP': 'image/webp', 'PNG': 'image/png'}[fmt]
    return 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode()), len(buf.getvalue())


# рамки черт лица в исходнике (x0, y0, x1, y1); подобраны по увеличенному лицу
FEATURE_BOXES = {
    'browL': (698, 416, 772, 456), 'browR': (810, 416, 912, 456),
    'eyeL': (684, 455, 770, 516), 'eyeR': (824, 455, 914, 516),
    'nose': (778, 488, 818, 556), 'mouth': (748, 558, 842, 610),
}


# ломаная вдоль прядей, перечёркивающих левый край лица: черты лица — только правее неё
FACE_CUT = [(707, 395), (706, 428), (706, 448), (701, 462), (694, 476), (687, 490), (680, 505), (668, 530), (650, 600), (650, 700)]


# ---------------------------------------------------------------- сегментация
def segment(src):
    """Классы K_* для каждого пикселя исходника."""
    H, W = src.shape[:2]
    rgb = src[..., :3] / 255.0
    al = src[..., 3]
    lab = rgb2lab(rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    yy, xx = np.mgrid[0:H, 0:W]
    op = al > 0

    # цветовые классы
    burg = op & (C > 14) & (hue > -40) & (hue < 32) & (L > 8) & (L < 58)       # бордовый: берет, туфли
    pink = op & (L > 50) & (a > 10) & (hue > -30) & (hue < 27)                   # розовый бант
    # кожа против пальто: кожа светлее (L*≈87 против ≈80) и краснее (h≈56–63° против 70–84°);
    # решаем по сглаженным L*/h, чтобы граница у выреза была ровной, а не «рваной»
    Ls, hs = ndi.gaussian_filter(L, 1.2), ndi.gaussian_filter(np.where(C > 4, hue, 70.0), 1.2)
    skin_score = (Ls - 83) / 3 + (66 - hs) / 4
    skinc = op & (C > 7) & (hue >= 20) & (((L > 62) & (hue < 82) & (skin_score > 0)) | ((L > 55) & (hue < 55) & (C > 12)))  # кожа, румянец, губы
    beige = op & (L > 45) & (hue >= 60) & (hue < 100) & (C > 5) & (C < 30) & ~skinc  # пальто и его тени
    gold = op & (C > 40) & (hue > 55) & (hue < 95) & (L > 30)                    # оправа лупы

    # пальто: самая большая бежевая область ниже воротника + мелкие дырки в ней (пуговицы, швы, пряжка)
    coat = largest(beige & (yy > 680))
    holes = ndi.binary_fill_holes(coat) & ~coat
    lb, n = ndi.label(holes)
    for i in range(1, n + 1):
        m = lb == i
        if m.sum() < 4000 and (L[m] < 30).mean() < 0.2 and skinc[m].mean() < 0.5:
            coat |= m

    # бант (в своей рамке) и берет (бордовое сверху, две компоненты: тулья и «хвостик»)
    bowbox = (xx > 880) & (xx < 1030) & (yy > 270) & (yy < 410)
    bow = ndi.binary_fill_holes(largest(pink & bowbox))
    beret = ndi.binary_fill_holes(largest(burg & (yy < 430), k=2, minsize=200)) & ~bow
    shoes = ndi.binary_fill_holes(largest(burg & (yy > 1730), k=2, minsize=200))

    # лупа: золото + стекло + ручка в своей рамке
    magbox = (xx > 480) & (xx < 640) & (yy > 1180) & (yy < 1360)
    ring = largest(gold & magbox)
    mag = ndi.binary_fill_holes(ring)                                    # оправа + стекло
    handle = magbox & op & (L < 55) & (hue > 30) & (hue < 90) & (C > 12) & ~coat
    handle = largest(handle | ring) & ~ring                              # ручка, примыкающая к оправе
    mag |= handle
    mag = ndi.binary_dilation(mag, iterations=1) & op & ~coat

    # кожа
    skin = skinc & ~coat & ~bow
    face = largest(skin & (yy > 350) & (yy < 800))
    facefill = ndi.binary_fill_holes(face)
    # черты лица: всё не-кожаное внутри выпуклой оболочки лица ниже линии бровей, правее
    # прядей, перечёркивающих левый край лица (ломаная подобрана по --debug z_face)
    hull = convex_hull_image(face & (yy < 640) & (xx < 922))          # без правого уха
    right_of_cut = poly_mask(src.shape, FACE_CUT + [(1000, 700), (1000, 395)])
    boxes = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in FEATURE_BOXES.values():
        boxes[y0:y1, x0:x1] = True
    feat = (hull & boxes & right_of_cut & ~skin) | (facefill & ~face)

    # колготки: тёмное ниже подола
    tights = op & (yy > 1360) & ~shoes & ~coat & ~mag & ~skin

    # волосы: всё остальное непрозрачное в верхней части фигуры
    hair = op & (yy < 1040) & ~coat & ~beret & ~bow & ~skin & ~feat & ~facefill
    hair = largest(hair, k=8, minsize=300)

    K = np.zeros((H, W), np.uint8)
    K[op] = K_UNK
    K[skin] = K_SKIN
    K[hair] = K_HAIR
    K[tights] = K_TIGHTS
    K[coat] = K_COAT
    K[beret] = K_BERET
    K[bow] = K_BOW
    K[shoes] = K_SHOES
    K[feat] = K_FEAT
    K[mag] = K_MAG
    K[~op] = K_BG
    # нераспознанные пиксели (сглаженные края между областями) — к ближайшей распознанной области
    unk = K == K_UNK
    if unk.any():
        _, (iy, ix) = ndi.distance_transform_edt((K == K_UNK) | (K == K_BG), return_indices=True)
        K[unk] = K[iy[unk], ix[unk]]
    return K


# ---------------------------------------------------------------- кадрирование и масштаб
def frame(src):
    """Рамка фигуры в исходнике и масштаб: возвращает (x0, y0, x1, y1, scale, W, H)."""
    al = src[..., 3]
    ys, xs = np.where(al > 8)
    x0, x1 = max(0, xs.min() - PAD), min(src.shape[1], xs.max() + 1 + PAD)
    y0, y1 = max(0, ys.min() - PAD), min(src.shape[0], ys.max() + 1 + PAD)
    s = FULL_H / (y1 - y0)
    W = int(round((x1 - x0) * s))
    return x0, y0, x1, y1, s, W, FULL_H


def resize_rgba(img, size):
    """Ресайз с премультиплицированной альфой (без тёмных/белых ореолов по краю)."""
    return img.convert('RGBa').resize(size, Image.LANCZOS, reducing_gap=3.0).convert('RGBA')


def downsample_classes(K, fr, alpha_out):
    """Классы в разрешении полной картинки: класс с наибольшим покрытием (взвешенным альфой)."""
    x0, y0, x1, y1, s, W, H = fr
    Kc = K[y0:y1, x0:x1]
    best = np.zeros((H, W), np.float32)
    out = np.zeros((H, W), np.uint8)
    for k in range(1, K_UNK):
        m = (Kc == k).astype(np.float32) * 255
        if not m.any():
            continue
        cov = np.array(Image.fromarray(m, 'F').resize((W, H), Image.BOX), np.float32)
        upd = cov > best
        out[upd] = k
        best[upd] = cov[upd]
    out[alpha_out == 0] = K_BG
    return out


def ombre_weight(y, oy):
    """Вес «кончиков» волос по вертикали: smoothstep(oy[0], oy[1], y)."""
    t = np.clip((y - oy[0]) / float(oy[1] - oy[0]), 0, 1)
    return t * t * (3 - 2 * t)


def region_base(rgba, mask):
    """Типичный цвет области: медиана RGB по средним тонам (25–75 перцентиль яркости), только непрозрачные."""
    m = mask & (rgba[..., 3] == 255)
    px = rgba[..., :3][m].astype(np.float64)
    if len(px) == 0:
        return np.array([128.0, 128, 128])
    Y = luma(px)
    lo, hi = np.percentile(Y, [25, 75])
    sel = px[(Y >= lo) & (Y <= hi)]
    return np.median(sel, axis=0)


# ---------------------------------------------------------------- перекраска (эталон для JS)
GAMMA_MIN = 0.45
Y_LIGHT, Y_DARK = 225.0, 25.0     # яркость «светлого» (кожа, пальто) и «тёмного» (волосы) соседа на стыке
# допустимый диапазон r = Y(пиксель)/Y(база) внутри области (по 0.5–99.5 перцентилям «ядра» области);
# всё, что за ним, — сглаженный стык с соседом: перекрашивается только «своя» доля пикселя
RANGE = {'hair': (0.0, 1.6), 'coat': (0.66, 1.06), 'bow': (0.66, 1.06), 'beret': (0.64, 1.12), 'shoes': (0.8, 1.1)}
GROUPS = [('hair', (L_HAIR, L_TIPS)), ('coat', (L_COAT,)), ('bow', (L_BOW,)), ('beret', (L_BERET,)), ('shoes', (L_SHOES,))]


def _paint(r, T, lb, lt):
    """T * r^g с уводом пересвета к белому (яркость сохраняется)."""
    g = np.clip(np.sqrt(lb / lt), GAMMA_MIN, 1.0)
    v = T * (r ** g)[:, None]
    mx = v.max(axis=1)
    over = mx > 255
    if over.any():
        Yo = np.minimum(luma(v[over]), 255.0)
        k = (255.0 - Yo) / np.maximum(mx[over] - Yo, 1e-6)
        v[over] = Yo[:, None] + (v[over] - Yo[:, None]) * k[:, None]
    return v


def recolor(rgba, labels, base, targets, oy, rng=RANGE):
    """Python-копия HERO.paint() из js/hero_assets.js (тот же алгоритм, см. ASSETS.md).
    targets: {'hair','hairTips','coat','bow','beret','shoes'} -> '#RRGGBB' или None (не трогать)."""
    out = rgba.astype(np.float64).copy()
    H, W = labels.shape
    yy = np.repeat(np.arange(H, dtype=np.float64)[:, None], W, axis=1)
    for key, labs in GROUPS:
        if not targets.get(key):
            continue
        m = np.isin(labels, labs) & (rgba[..., 3] > 0)
        if not m.any():
            continue
        p = out[..., :3][m]
        if key == 'hair':
            w = ombre_weight(yy[m], oy)[:, None]
            B = hex2rgb(base['hair']) * (1 - w) + hex2rgb(base['hairTips']) * w
            T = hex2rgb(targets['hair']) * (1 - w) + hex2rgb(targets['hairTips']) * w
        else:
            B = np.broadcast_to(hex2rgb(base[key]), p.shape).copy()
            T = np.broadcast_to(hex2rgb(targets[key]), p.shape).copy()
        lb, lt = np.maximum(luma(B), 1.0), np.maximum(luma(T), 1.0)
        Yp = luma(p)
        r = Yp / lb
        lo, hi = rng[key]
        v = _paint(np.clip(r, lo, hi), T, lb, lt)
        # стык со светлым соседом (r > hi) или с тёмным (r < lo): своя доля f, остальное — как было
        f = np.ones_like(r)
        up, dn = r > hi, r < lo
        f[up] = np.clip((Y_LIGHT - Yp[up]) / np.maximum(Y_LIGHT - lb[up], 1e-6), 0, 1)
        f[dn] = np.clip((Yp[dn] - Y_DARK) / np.maximum(lb[dn] - Y_DARK, 1e-6), 0, 1)
        e = up | dn
        v[e] = p[e] + f[e][:, None] * (T[e] - B[e])
        out[..., :3][m] = np.clip(np.floor(v + 0.5), 0, 255)
    return out.astype(np.uint8)


# ---------------------------------------------------------------- берет из банта (эталон для JS)
def _srgb2lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255.0


_M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
_WP = np.array([0.95047, 1.0, 1.08883])


def hex2lch(hx):
    xyz = _M @ _srgb2lin(hex2rgb(hx)) / _WP
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L, a, b = 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a))


def lch2hex(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    fy = (L + 16) / 116
    f = np.array([fy + a / 500, fy, fy - b / 200])
    xyz = np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27)) * _WP
    lin = np.linalg.solve(_M, xyz)
    # вне охвата sRGB: уменьшаем насыщенность, пока не влезет
    if (lin < -1e-4).any() or (lin > 1 + 1e-4).any():
        if C > 0.5:
            return lch2hex(L, C * 0.92, h)
    return rgb2hex(_lin2srgb(lin))


# розовый #F08FA8 (L*70, C 40, h 4°) -> бордовый с рисунка (L*34, C 38, h 9°): L*×0.48, C×0.95, h+5°
BERET_K = dict(l=0.48, c=0.95, dh=5.0, lmin=26.0, cmin=12.0, contrast=15.0, dark=30.0, lift=22.0)


def beret_of(bow, base_beret, default_bow=DEFAULT['bow']):
    """Цвет берета для банта. Для авторского розового — бордовый с рисунка (base.beret)."""
    if bow.upper() == default_bow.upper():
        return base_beret
    k = BERET_K
    L, C, h = hex2lch(bow)
    if L >= k['dark']:                    # обычный бант: берет темнее, но не сливается с тёмными волосами
        Lb = min(max(L * k['l'], k['lmin']), L - k['contrast'])
    else:                                 # тёмный бант (чёрный): берет светлее банта, иначе бант пропадёт
        Lb = L + k['lift']
    return lch2hex(Lb, max(C * k['c'], k['cmin']), h + k['dh'])


# ---------------------------------------------------------------- чистка краёв
def decontaminate(rgba, solid=250):
    """Полупрозрачные пиксели силуэта получают цвет ближайшего непрозрачного пикселя
    (у исходника по краю светлый ореол от вырезки фона — на тёмном фоне он был бы виден)."""
    out = rgba.copy()
    a = rgba[..., 3]
    semi = (a > 0) & (a < solid)
    if semi.any():
        _, (iy, ix) = ndi.distance_transform_edt(a < solid, return_indices=True)
        out[..., :3][semi] = rgba[..., :3][iy[semi], ix[semi]]
    return out


def refine_boundaries(rgba, Kd, width=2, sigma=2.5):
    """Пиксели на стыке областей (сглаживание) — к области, чей местный цвет ближе (а не просто ближайшей).
    Стык волос со светлыми соседями (кожа, пальто) отдаём волосам охотнее: такой пиксель при перекраске
    «разбирается» на долю волос и долю соседа (см. recolor), и край остаётся мягким. Стык с беретом/бантом,
    наоборот, отдаём берету/банту: их яркость близка к смешанному пикселю."""
    H, W = Kd.shape
    rgb = rgba[..., :3].astype(np.float32)
    classes = [k for k in range(1, K_UNK) if (Kd == k).any()]
    mx = ndi.maximum_filter(Kd, size=2 * width + 1)
    mn = ndi.minimum_filter(np.where(Kd == K_BG, 255, Kd).astype(np.uint8), size=2 * width + 1)
    border = (Kd != K_BG) & ((mx != Kd) | (mn != Kd)) & (rgba[..., 3] > 0)
    best_d = np.full((H, W), np.inf, np.float32)
    best_k = Kd.copy()
    d_hair = np.full((H, W), np.inf, np.float32)
    for k in classes:
        m = Kd == k
        core = ndi.binary_erosion(m, iterations=width) & (rgba[..., 3] >= 250)
        if not core.any():
            core = m
        wsum = ndi.gaussian_filter(core.astype(np.float32), sigma)
        near = ndi.binary_dilation(m, iterations=width) & border & (wsum > 1e-3)
        if not near.any():
            continue
        mean = np.stack([ndi.gaussian_filter(rgb[..., c] * core, sigma) for c in range(3)], -1) / np.maximum(wsum, 1e-6)[..., None]
        d = np.sqrt(((rgb - mean) ** 2).sum(-1))
        if k == K_HAIR:
            d_hair[near] = d[near]
            continue
        upd = near & (d < best_d)
        best_d[upd] = d[upd]
        best_k[upd] = k
    fac = np.ones(K_UNK + 1, np.float32)
    fac[[K_SKIN, K_COAT, K_FEAT, K_TIGHTS, K_MAG]] = HAIR_VS_LIGHT
    fac[[K_BERET, K_BOW, K_SHOES]] = HAIR_VS_BERET
    take_hair = np.isfinite(d_hair) & (d_hair * fac[best_k] < best_d)
    best_k[take_hair] = K_HAIR
    out = Kd.copy()
    out[border] = best_k[border]
    return out


# ---------------------------------------------------------------- лицо для 3D (наклейка на «маску» головы)
# Раскладка как у heroFaceCanvas() в js/city3d.js: холст 512×360, натянут на сферический сегмент
# (phi 30°..150°, theta 50°..135°); центр лица — x=256, глаза на y≈178, x≈139/373.
DECAL_W, DECAL_H = 512, 360
EYE_SRC = {'L': (733.0, 491.0), 'R': (858.0, 491.0)}      # центры радужек в исходнике
EYE_DST = {'L': (139.0, 178.0), 'R': (373.0, 178.0)}      # и на наклейке (как в heroFaceCanvas)
EYE_SCALE = (EYE_DST['R'][0] - EYE_DST['L'][0]) / (EYE_SRC['R'][0] - EYE_SRC['L'][0])
# остальные черты: (рамка в исходнике, якорь в исходнике, якорь на наклейке, масштаб)
# Лицо на рисунке — вытянутый овал, голова в 3D — шар: черты ниже глаз сдвинуты ближе к глазам
# (как у процедурного лица), сами черты не искажаются — только переносятся.
DECAL_PARTS = {
    'browL': ((700, 418, 776, 458), (733, 437), (139, 93), EYE_SCALE),
    'browR': ((806, 414, 912, 458), (859, 436), (373, 93), EYE_SCALE),
    'eyeL': ((680, 453, 774, 518), EYE_SRC['L'], EYE_DST['L'], EYE_SCALE),
    'eyeR': ((820, 453, 912, 518), EYE_SRC['R'], EYE_DST['R'], EYE_SCALE),
    'nose': ((776, 486, 822, 558), (801, 546), (262, 256), 1.55),
    'mouth': ((744, 556, 846, 612), (794, 585), (258, 306), 1.5),
    'blushL': ((684, 500, 766, 592), (712, 546), (98, 255), 1.6),
    'blushR': ((822, 500, 928, 592), (876, 546), (414, 255), 1.6),
}


# эллипсы глаз (центр, полуоси) в исходнике: глаз + складка века, без теней у края лица
EYE_ELLIPSE = {'eyeL': (728, 486, 47, 31), 'eyeR': (864, 486, 50, 31)}
# румянец с рисунка — мягкие круги: центр (исходник), радиус (исходник), цвет и непрозрачность в центре
BLUSH = {'L': ((712, 546), 40), 'R': ((877, 545), 40)}
BLUSH_COLOR, BLUSH_ALPHA = (242, 160, 146), 0.62


def color_to_alpha(p, S, lighter=True):
    """«Цвет в альфу» (как в GIMP): p = a*F + (1-a)*S, минимальная a. p, S: (...,3) 0..255.
    lighter=False — светлее кожи не бывает (блики кожи не переносим, только тёмное/розовое)."""
    p = p.astype(np.float64)
    S = np.broadcast_to(np.asarray(S, np.float64), p.shape)
    if not lighter:
        p = np.minimum(p, S)
    up = np.where(p > S, (p - S) / np.maximum(255 - S, 1e-6), 0)
    dn = np.where(p < S, (S - p) / np.maximum(S, 1e-6), 0)
    a = np.clip(np.maximum(up, dn).max(-1), 0, 1)
    return a


def face_sprites(src, K):
    """Черты лица на прозрачном фоне (исходное разрешение), по частям DECAL_PARTS."""
    H, W = K.shape
    rgb = src[..., :3].astype(np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    face = largest((K == K_SKIN) & (yy > 300) & (yy < 655) & (xx > 640) & (xx < 922))
    hull = convex_hull_image(face)
    # кожа лица без румянца: медиана «спокойной» кожи
    lab = rgb2lab(src[..., :3] / 255.0)
    calm = face & (lab[..., 1] < 12) & (lab[..., 0] > 82)
    S = np.median(rgb[calm], axis=0)
    hair = ndi.binary_dilation(K == K_HAIR, iterations=2)
    featm = K == K_FEAT
    right_of_cut = poly_mask(K.shape, FACE_CUT + [(1000, 700), (1000, 395)])
    inside = ndi.binary_erosion(ndi.binary_fill_holes(face) | ndi.binary_dilation(featm, iterations=2), iterations=3)
    inside &= ~hair & right_of_cut & hull
    out = {}
    for name, (box, anc, dst, sc) in DECAL_PARTS.items():
        if name.startswith('blush'):
            continue                                                # румянец рисуется (см. BLUSH), а не вырезается
        x0, y0, x1, y1 = box
        p = rgb[y0:y1, x0:x1]
        a = color_to_alpha(np.minimum(p, S), S, False)              # только то, что темнее/розовее кожи
        Yp, YS = luma(p), luma(S)
        a = np.maximum(a, np.clip((0.55 - Yp / YS) / 0.3, 0, 1))    # тёмное (зрачки, ресницы, брови) — непрозрачно
        m = inside[y0:y1, x0:x1].astype(np.float64)
        if name.startswith('eye'):
            # глаз = эллипс вокруг глаза и складки века; белки (светлее кожи) — только внутри контура глаза
            ex, ey, rx, ry = EYE_ELLIPSE[name]
            yy_, xx_ = np.mgrid[y0:y1, x0:x1]
            d = np.hypot((xx_ - ex) / rx, (yy_ - ey) / ry)
            m = m * np.clip((1.0 - d) / 0.08, 0, 1)
            L_ = lab[y0:y1, x0:x1, 0]
            C_ = np.hypot(lab[y0:y1, x0:x1, 1], lab[y0:y1, x0:x1, 2])
            dk = (L_ < 45) & inside[y0:y1, x0:x1]
            shape = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_dilation(dk, iterations=2), iterations=4))
            whites = (L_ > 86) & (C_ < 12) & ndi.binary_dilation(shape, iterations=8)
            eye_in = ndi.binary_fill_holes(shape | whites)
            aw = color_to_alpha(np.maximum(p, S), S, True) * ndi.gaussian_filter(eye_in.astype(np.float64), 0.8)
            a = np.maximum(a, aw)
        thr = 0.1
        a = np.clip((a - thr) / (1 - thr), 0, 1)                    # шум кожи — прочь
        m = ndi.gaussian_filter(m, 1.0)
        hh, ww = a.shape
        fy = np.minimum(np.arange(hh), np.arange(hh)[::-1])[:, None]
        fx = np.minimum(np.arange(ww), np.arange(ww)[::-1])[None, :]
        a = a * m * np.clip(np.minimum(fy, fx) / 5.0, 0, 1)
        F = S + (p - S) / np.maximum(a, 1e-3)[..., None]
        F = np.where(a[..., None] > 1e-3, F, p)
        spr = np.dstack([np.clip(F, 0, 255), a * 255]).round().astype(np.uint8)
        out[name] = (Image.fromarray(spr, 'RGBA'), (anc[0] - x0, anc[1] - y0), dst, sc)
    return out, S


def closed_eye_strokes(draw, cx, cy, sc, side, color, k=4):
    """Закрытый глаз: дуга века вниз + ресничка-«крылышко» снаружи + две реснички вниз.
    side = -1 левый глаз (крылышко влево), +1 правый. Координаты уже умножены на k (суперсэмплинг)."""
    hw = 33.0 * sc                     # полуширина глаза
    lw = max(2, int(round(4.2 * sc * k)))
    pts = []
    for i in range(41):
        t = i / 40.0
        x = cx + (t * 2 - 1) * hw
        y = cy + 4.0 * sc + math.sin(t * math.pi) * 7.5 * sc      # провисает вниз (◡)
        pts.append((x * k, y * k))
    draw.line(pts, fill=color, width=lw, joint='curve')
    for (x, y) in (pts[0], pts[-1]):
        r = lw / 2
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    # крылышко у внешнего уголка
    ox, oy = cx + side * hw, cy + 4.0 * sc
    wing = [(ox * k, oy * k), ((ox + side * 7 * sc) * k, (oy - 5 * sc) * k)]
    draw.line(wing, fill=color, width=max(2, int(lw * 0.8)))
    # реснички вниз
    for t in (0.42, 0.7) if side > 0 else (0.3, 0.58):
        x = cx + (t * 2 - 1) * hw
        y = cy + 4.0 * sc + math.sin(t * math.pi) * 7.5 * sc
        draw.line([(x * k, y * k), ((x + side * 2.2 * sc) * k, (y + 5.5 * sc) * k)], fill=color, width=max(2, int(lw * 0.55)))


LASH = (40, 26, 26, 255)


def build_decals(sprites):
    """Две наклейки 512×360: open / closed (глаза убраны — под ними просвечивает кожа головы; дуги-реснички)."""
    res = {}
    for closed in (False, True):
        cv = Image.new('RGBA', (DECAL_W, DECAL_H), (0, 0, 0, 0))
        # румянец: мягкие круги в тех же местах, что и вырезанные бы (якоря DECAL_PARTS blushL/R)
        yy, xx = np.mgrid[0:DECAL_H, 0:DECAL_W]
        bl = np.zeros((DECAL_H, DECAL_W))
        for side in ('L', 'R'):
            (_, _, (dx, dy), sc) = DECAL_PARTS['blush' + side]
            R = BLUSH[side][1] * sc
            t = np.clip((np.hypot(xx - dx, (yy - dy) * 1.08) - 0.4 * R) / (0.6 * R), 0, 1)
            bl = np.maximum(bl, BLUSH_ALPHA * (1 - t * t * (3 - 2 * t)))
        blush = np.dstack([np.broadcast_to(np.array(BLUSH_COLOR, np.float64), (DECAL_H, DECAL_W, 3)), bl * 255]).round().astype(np.uint8)
        cv.alpha_composite(Image.fromarray(blush, 'RGBA'))
        order = ['nose', 'mouth', 'browL', 'browR', 'eyeL', 'eyeR']
        for name in order:
            if closed and name.startswith('eye'):
                continue
            spr, (ax, ay), (dx, dy), sc = sprites[name]
            w, h = spr.size
            im = resize_rgba(spr, (max(1, int(round(w * sc))), max(1, int(round(h * sc)))))
            cv.alpha_composite(im, (int(round(dx - ax * sc)), int(round(dy - ay * sc))))
        if closed:
            k = 4
            big = Image.new('RGBA', (DECAL_W * k, DECAL_H * k), (0, 0, 0, 0))
            d = ImageDraw.Draw(big)
            for side, nm in ((-1, 'L'), (1, 'R')):
                cx, cy = EYE_DST[nm]
                closed_eye_strokes(d, cx, cy, EYE_SCALE, side, LASH, k)
            cv.alpha_composite(big.resize((DECAL_W, DECAL_H), Image.LANCZOS))
        res['closed' if closed else 'open'] = cv
    return res


# ---------------------------------------------------------------- моргание в 2D (заплатка на полную картинку)
def build_blink(src, K, S, fr):
    """Заплатка «глаза закрыты» в координатах полной картинки: кожа поверх глаз + дуги-реснички."""
    x0f, y0f, x1f, y1f, s, Wf, Hf = fr
    H, W = K.shape
    bx0, by0, bx1, by1 = 676, 450, 922, 522           # обе глазницы с запасом (исходник)
    rgb = src[by0:by1, bx0:bx1, :3].astype(np.float64)
    feat = (K[by0:by1, bx0:bx1] == K_FEAT)
    lab = rgb2lab(src[by0:by1, bx0:bx1, :3] / 255.0)
    # только сами глаза (без бровей — они выше рамки), чуть расширенные
    hairm = K[by0:by1, bx0:bx1] == K_HAIR
    C = np.hypot(lab[..., 1], lab[..., 2])
    dark = feat | ((lab[..., 0] < 60) & ~hairm)
    whites = (lab[..., 0] > 89) & (C < 9)                        # белки глаз
    eyes = ndi.binary_fill_holes(ndi.binary_dilation(dark, iterations=2))
    eyes |= whites & ndi.binary_dilation(eyes, iterations=12)
    eyes = ndi.binary_fill_holes(ndi.binary_closing(eyes, iterations=3))
    eyes = ndi.binary_dilation(eyes, iterations=2)
    eyes = (eyes & ~ndi.binary_dilation(hairm, iterations=1)) | (whites & ndi.binary_dilation(eyes, iterations=3))
    # белки у самого уголка (рядом с прядью) — тоже под заплатку
    yy_, xx_ = np.mgrid[by0:by1, bx0:bx1]
    for ex, ey, rx, ry in EYE_ELLIPSE.values():
        ell = np.hypot((xx_ - ex) / rx, (yy_ - ey) / (ry * 0.8)) < 1
        eyes |= ndi.binary_dilation((lab[..., 0] > 84) & (C < 14) & ell, iterations=2)
    # кожа под заплаткой: размытое «окружение» (нормированная свёртка по чистой коже вокруг)
    skin = (K[by0:by1, bx0:bx1] == K_SKIN) & ~ndi.binary_dilation(eyes, iterations=2) & (lab[..., 0] > 80)
    wsum = ndi.gaussian_filter(skin.astype(np.float64), 5)
    fill = np.stack([ndi.gaussian_filter(rgb[..., c] * skin, 5) for c in range(3)], -1) / np.maximum(wsum, 1e-6)[..., None]
    fill = np.where(wsum[..., None] > 0.02, fill, S)
    a = ndi.gaussian_filter(eyes.astype(np.float64), 1.5)
    patch = np.dstack([fill, a * 255]).round().astype(np.uint8)
    pim = Image.fromarray(patch, 'RGBA')
    k = 4
    big = Image.new('RGBA', (pim.size[0] * k, pim.size[1] * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for side, nm in ((-1, 'L'), (1, 'R')):
        cx, cy = EYE_SRC[nm]
        closed_eye_strokes(d, cx - bx0, cy - by0, 1.0, side, LASH, k)
    pim.alpha_composite(big.resize(pim.size, Image.LANCZOS))
    # в координаты полной картинки
    fx0, fy0 = (bx0 - x0f) * s, (by0 - y0f) * s
    ix0, iy0 = int(math.floor(fx0)), int(math.floor(fy0))
    ix1, iy1 = int(math.ceil((bx1 - x0f) * s)), int(math.ceil((by1 - y0f) * s))
    # пересэмплируем с субпиксельным сдвигом: исходник -> [ix0, ix1)
    big2 = Image.new('RGBA', (int(round((ix1 - ix0) / s)) + 2, int(round((iy1 - iy0) / s)) + 2), (0, 0, 0, 0))
    big2.alpha_composite(pim, (int(round(bx0 - (ix0 / s + x0f))), int(round(by0 - (iy0 / s + y0f)))))
    out = resize_rgba(big2, (int(round(big2.size[0] * s)), int(round(big2.size[1] * s))))
    out = out.crop((0, 0, ix1 - ix0, iy1 - iy0))
    return out, (ix0, iy0)


# ---------------------------------------------------------------- вид со спины (синтез из вида спереди)
BACK_CX = 793                        # ось симметрии фигуры (исходник)
BACK_SYM_Y = 1000                    # ниже — правая половина = зеркало левой (рука без лупы)
SKIRT_POLY = [(655, 985), (931, 985), (988, 1386), (598, 1386)]   # подол без рукавов
BELT_Y = (955, 992)
TIP_LOCKS = 13                       # прядей-«язычков» по нижнему краю волос сзади


def _noise1d(n, period, seed):
    rng = np.random.RandomState(seed)
    k = int(n / period) + 3
    pts = rng.uniform(-1, 1, k)
    x = np.arange(n) / period
    i0 = np.floor(x).astype(int)
    t = x - i0
    t = t * t * (3 - 2 * t)
    return pts[i0] * (1 - t) + pts[i0 + 1] * t


def build_back(src, K, fr, full, labels):
    """Вид со спины: зеркало вида спереди (бант — слева), низ симметричен по руке без лупы,
    пальто сзади гладкое (шлица и хлястик вместо пуговиц и кармана), волосы закрывают голову и спину."""
    H, W = K.shape
    cx = BACK_CX
    xs = np.arange(W)
    xm = 2 * cx - xs
    ok = (xm >= 0) & (xm < W)

    def mirror(a):
        o = np.zeros_like(a)
        o[:, ok] = a[:, xm[ok]]
        return o
    M = mirror(src).astype(np.float64)
    KM = mirror(K)
    # низ симметричный: справа — зеркало левой половины (там свободная рука)
    y0s = BACK_SYM_Y
    right = xs > cx
    src_x = np.clip(2 * cx - xs[right], 0, W - 1)
    M[y0s:, right] = M[y0s:, src_x]
    KM[y0s:, right] = KM[y0s:, src_x]
    yy, xx = np.mgrid[0:H, 0:W]

    # ---- пальто сзади: на подоле убрать пуговицы/карманы/борт (оставить крупную светотень)
    coat = KM == K_COAT
    skirt = poly_mask(K.shape, SKIRT_POLY) & coat
    base_coat = region_base(np.dstack([M[..., :3], M[..., 3]]).astype(np.uint8), coat & skirt)
    # гладкая спина: цвет пальто с мягкой светотенью (темнее к бокам и к подолу)
    f = 1 - 0.07 * ((xx - cx) / 190.0) ** 2 - 0.05 * np.clip((yy - 985) / 400.0, 0, 1)
    flat = base_coat[None, None, :] * f[..., None]
    soft = ndi.gaussian_filter(skirt.astype(np.float64), 1.5)[..., None]
    M[..., :3] = M[..., :3] * (1 - soft) + flat * soft
    line = np.array([180, 149, 117], np.float64)             # цвет швов пальто с рисунка
    belt = np.array([196, 169, 137], np.float64)
    def draw_layer(fn):
        big = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
        fn(ImageDraw.Draw(big), 2)
        return np.array(big.resize((W, H), Image.LANCZOS)).astype(np.float64)
    def details(d, s):
        # шлица по центру спины
        d.line([(cx * s, 1235 * s), (cx * s, 1384 * s)], fill=tuple(line.astype(int)) + (255,), width=5 * s)
        d.line([((cx - 2) * s, 1235 * s), ((cx + 16) * s, 1262 * s)], fill=tuple(line.astype(int)) + (220,), width=3 * s)
        for sd in (-1, 1):   # две мягкие складки от хлястика к подолу
            d.line([((cx + sd * 72) * s, 1000 * s), ((cx + sd * 112) * s, 1370 * s)], fill=tuple(line.astype(int)) + (90,), width=4 * s)
        # хлястик (пояс сзади, без пряжки) с двумя пуговками
        y0b, y1b = BELT_Y
        d.rectangle([(612 * s, y0b * s), (975 * s, y1b * s)], fill=tuple(belt.astype(int)) + (255,))
        d.line([(612 * s, y0b * s), (975 * s, y0b * s)], fill=tuple(line.astype(int)) + (255,), width=3 * s)
        d.line([(612 * s, y1b * s), (975 * s, y1b * s)], fill=tuple(line.astype(int)) + (255,), width=3 * s)
        for bx in (cx - 95, cx + 95):
            r = 8
            d.ellipse([((bx - r) * s, (973 - r) * s), ((bx + r) * s, (973 + r) * s)], fill=(173, 143, 115, 255))
    det = draw_layer(details)
    beltmask = coat & (yy >= BELT_Y[0] - 3) & (yy <= BELT_Y[1] + 3)
    a = det[..., 3:4] / 255.0 * (coat | beltmask)[..., None]
    M[..., :3] = M[..., :3] * (1 - a) + det[..., :3] * a

    # ---- волосы: закрывают голову, шею и спину до линии кончиков
    hairM = KM == K_HAIR
    headish = (KM == K_SKIN) & (yy < 780) | (KM == K_FEAT)
    U = hairM | headish
    rows = np.zeros((H, W), bool)
    for y in range(300, 1015):
        xr = np.where(U[y])[0]
        if len(xr):
            rows[y, xr.min():xr.max() + 1] = True
    # нижний край: «язычки» прядей
    L_, R_ = 470, 1118
    tip = np.full(W, -1.0)
    rng = np.random.RandomState(7)
    cxs = np.linspace(L_, R_, TIP_LOCKS)
    hw = (R_ - L_) / (TIP_LOCKS - 1) * 0.62
    for i, c in enumerate(cxs):
        yt = 985 + 22 * math.sin(i * 1.7) + rng.uniform(-6, 6)
        curl = rng.uniform(-6, 6)
        t = np.clip(1 - ((xs - c - curl) / hw) ** 2, 0, None)
        tip = np.maximum(tip, np.where(t > 0, yt - 70 * (1 - np.sqrt(t)), -1))
    below = yy > tip[None, :]
    region = (rows & ~below) | hairM
    region &= ~((KM == K_BERET) | (KM == K_BOW))
    region &= (yy > 250)
    # цвет: по строкам — средний цвет нарисованных волос по бокам (омбре и тон совпадают с рисунком)
    hair_all = K == K_HAIR
    side = hairM & (np.abs(xx - cx) > 215) & (np.abs(xx - cx) < 330)
    Mrgb = M[..., :3]
    cnt = side.sum(1)
    rowcol = np.zeros((H, 3))
    have = cnt > 40
    for y in np.where(have)[0]:
        rowcol[y] = np.median(Mrgb[y][side[y]], axis=0)
    ys_ = np.arange(H)
    for c in range(3):           # выше — как в первой надёжной строке (тёмные корни)
        rowcol[:, c] = np.interp(ys_, ys_[have], rowcol[have, c])
    rowcol = ndi.gaussian_filter1d(rowcol, 25, axis=0)
    # та же модель омбре, что у перекраски (база волос -> база кончиков по smoothstep), по яркости — как сбоку
    wy = ombre_weight(ys_.astype(np.float64), OMBRE_SRC)
    bd, bt = region_base(src, hair_all & (yy < OMBRE_SRC[0])), region_base(src, hair_all & (yy > OMBRE_SRC[1]))
    model = bd[None, :] * (1 - wy[:, None]) + bt[None, :] * wy[:, None]
    k_ = np.clip(luma(rowcol) / np.maximum(luma(model), 1), 0.75, 1.15)
    col = np.repeat((model * k_[:, None])[:, None, :], W, axis=1)
    yc = 300.0
    u = (xx - cx) * 420.0 / (np.maximum(yy - yc, 0) + 420.0)
    u = u + 10 * np.sin(yy / 85.0 + xx / 260.0)
    n1 = _noise1d(1400, 22, 3)
    n2 = _noise1d(1400, 9, 5)
    ui = np.clip((u + 700).astype(int), 0, 1399)
    streak = 1 + 0.20 * n1[ui] + 0.08 * n2[ui]
    shade = streak
    # тень под беретом и у краёв головы
    beret_m = ndi.binary_dilation((KM == K_BERET), iterations=1)
    dist_beret = ndi.distance_transform_edt(~beret_m)
    shade *= 1 - 0.45 * np.exp(-dist_beret / 10.0)
    syn = np.clip(col * shade[..., None], 0, 255)
    # стыки «язычков»: тёмные бороздки вверх от выемок
    big = Image.new('L', (W * 2, H * 2), 0)
    d = ImageDraw.Draw(big)
    for c0, c1 in zip(cxs[:-1], cxs[1:]):
        xm_ = (c0 + c1) / 2
        ytop = 985 - 70 - 30
        pts = [((xm_ + 5 * math.sin(t * 3)) * 2, (ytop + t * 120) * 2) for t in np.linspace(0, 1, 12)]
        d.line(pts, fill=120, width=4)
    # несколько длинных прядей-линий от макушки (тёмные) и пара светлых — как на рисунке
    light = Image.new('L', (W * 2, H * 2), 0)
    dl = ImageDraw.Draw(light)
    for j, ang in enumerate(np.linspace(-0.6, 0.6, 6)):
        pts = []
        for t in np.linspace(0.1, 1, 40):
            yv = yc + t * 650
            xv = cx + math.sin(ang) * t * 430 * (1 - 0.2 * t) + 16 * math.sin(t * 5 + j * 1.3) * t
            pts.append((xv * 2, yv * 2))
        (dl if j in (1, 4) else d).line(pts, fill=90 if j not in (1, 4) else 120, width=3)
    grooves = np.array(big.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255.0
    lights = np.array(light.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255.0
    syn *= (1 - 0.55 * grooves)[..., None]
    syn = syn + (np.minimum(syn * 1.6 + 12, 255) - syn) * lights[..., None]
    # нарисованные волосы оставляем только снаружи (боковые волны и кончики), с широким переходом
    soft_k = np.clip((np.abs(xx - cx) - 235) / 60.0, 0, 1) * hairM
    soft_k = ndi.gaussian_filter(soft_k, 3.0)
    hair_rgb = syn * (1 - soft_k[..., None]) + M[..., :3] * soft_k[..., None]
    reg_soft = ndi.gaussian_filter(region.astype(np.float64), 0.7)
    reg_soft = np.where(region | (reg_soft > 0.02), reg_soft, 0)
    # пиксели берета/банта сверху — без изменений
    top = (KM == K_BERET) | (KM == K_BOW)
    reg_soft[top] = 0
    out = M.copy()
    out[..., :3] = M[..., :3] * (1 - reg_soft[..., None]) + hair_rgb * reg_soft[..., None]
    # альфа: волосы непрозрачны внутри области, снаружи как было (контуры прядей)
    out[..., 3] = np.maximum(M[..., 3], reg_soft * 255 * (~below | hairM))
    KB = KM.copy()
    KB[region & (reg_soft >= 0.5)] = K_HAIR
    out = np.clip(out, 0, 255).astype(np.uint8)

    # ---- в кадр полной картинки (тот же кадр и масштаб, что у вида спереди)
    x0, y0, x1, y1, s, Wf, Hf = fr
    back = decontaminate(np.array(resize_rgba(Image.fromarray(out[y0:y1, x0:x1]), (Wf, Hf))))
    Kd = refine_boundaries(back, downsample_classes(KB, fr, back[..., 3]))
    lab = K2LABEL[Kd].copy()
    oyf = [int(round((OMBRE_SRC[0] - y0) * s)), int(round((OMBRE_SRC[1] - y0) * s))]
    wf = ombre_weight(np.repeat(np.arange(Hf)[:, None], Wf, axis=1), oyf)
    hm = np.isin(lab, (L_HAIR, L_TIPS))
    lab[hm & (wf >= 0.5)] = L_TIPS
    lab[hm & (wf < 0.5)] = L_HAIR
    return back, lab


# ---------------------------------------------------------------- сборка
HEAD_SQUARE = (490, 172, 600)        # кроп аватара в исходнике: x, y, сторона (берет + бант + голова + плечи)


def build(debug=None):
    src = np.array(Image.open(SRC).convert('RGBA'))
    K = segment(src)
    fr = frame(src)
    x0, y0, x1, y1, s, W, H = fr
    to_full = lambda x, y: [round((x - x0) * s, 1), round((y - y0) * s, 1)]

    full = np.array(resize_rgba(Image.fromarray(src[y0:y1, x0:x1]), (W, H)))
    full = decontaminate(full)
    Kd = refine_boundaries(full, downsample_classes(K, fr, full[..., 3]))
    labels = K2LABEL[Kd].copy()
    oy = [int(round((OMBRE_SRC[0] - y0) * s)), int(round((OMBRE_SRC[1] - y0) * s))]
    yy = np.repeat(np.arange(H)[:, None], W, axis=1)
    w = ombre_weight(yy, oy)
    hair = np.isin(labels, (L_HAIR, L_TIPS))
    labels[hair & (w >= 0.5)] = L_TIPS
    labels[hair & (w < 0.5)] = L_HAIR
    base = {
        'hair': rgb2hex(region_base(full, hair & (w == 0))),
        'hairTips': rgb2hex(region_base(full, hair & (w >= 1))),
        'coat': rgb2hex(region_base(full, labels == L_COAT)),
        'bow': rgb2hex(region_base(full, labels == L_BOW)),
        'beret': rgb2hex(region_base(full, labels == L_BERET)),
        'shoes': rgb2hex(region_base(full, labels == L_SHOES)),
    }

    # якоря (центры кистей — по коже ниже манжет)
    Hs, Ws = K.shape
    yys, xxs = np.mgrid[0:Hs, 0:Ws]
    sk = (K == K_SKIN) & (yys > 1100)
    lb, n = ndi.label(sk)
    sz = ndi.sum(sk, lb, range(1, n + 1))
    hands = []
    for i in np.argsort(sz)[::-1][:2]:
        ys, xs = np.where(lb == i + 1)
        hands.append((xs.mean(), ys.mean()))
    hands.sort()
    face = largest((K == K_SKIN) & (yys > 300) & (yys < 655) & (xxs > 640) & (xxs < 922))
    fys, fxs = np.where(face)
    hx, hy, hs = HEAD_SQUARE
    sys_, sxs = np.where(K == K_SHOES)
    anchors = {
        'handFree': to_full(*hands[1]),          # её левая рука (справа на картинке), свободная
        'handMag': to_full(*hands[0]),           # её правая рука (слева на картинке) с лупой
        'head': to_full(hx, hy) + [round(hs * s, 1), round(hs * s, 1)],
        'face': to_full(fxs.min(), fys.min()) + [round((fxs.max() + 1 - fxs.min()) * s, 1), round((fys.max() + 1 - fys.min()) * s, 1)],
        'eyes': [to_full(*EYE_SRC['L']), to_full(*EYE_SRC['R'])],
        'feet': to_full((sxs.min() + sxs.max()) / 2, sys_.max() + 1),
    }

    sprites, skin = face_sprites(src, K)
    decals = build_decals(sprites)
    blink, (bx, by) = build_blink(src, K, skin, fr)
    back = build_back(src, K, fr, full, labels) if BACK else None
    if not OMBRE:
        # кончики в цвет корней: та же перекраска, что в игре (recolor), с целью «кончики = волосы»;
        # прежний цвет кончиков остаётся в base.ombreTips — для омбре как варианта в ателье (HERO.ombreOn)
        flat = {'hair': base['hair'], 'hairTips': base['hair']}
        full = recolor(full, labels, base, flat, oy)
        if back is not None:
            back = (recolor(back[0], back[1], base, flat, oy), back[1])
        base['ombreTips'] = base['hairTips']
        base['hairTips'] = base['hair']

    A = {'W': W, 'H': H, 'full': full, 'labels': labels, 'base': base, 'ombre': oy, 'anchors': anchors,
         'decals': decals, 'blink': (blink, bx, by), 'back': back, 'K': K, 'Kd': Kd, 'fr': fr, 'skin': rgb2hex(skin)}
    return A


def png8(im):
    """RGBA -> палитровый PNG (256 цветов с альфой): наклейка лица весит в ~4 раза меньше, на глаз — то же."""
    a = np.array(im)
    a[a[..., 3] < 3] = 0
    return Image.fromarray(a).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)


def encode(A):
    full_uri, full_n = data_uri(Image.fromarray(A['full'], 'RGBA'), 'WEBP', quality=90, method=6, exact=False)
    lab_uri, lab_n = data_uri(Image.fromarray(A['labels'], 'L'), 'PNG', optimize=True)
    op_uri, op_n = data_uri(png8(A['decals']['open']), 'PNG', optimize=True)
    cl_uri, cl_n = data_uri(png8(A['decals']['closed']), 'PNG', optimize=True)
    bl, bx, by = A['blink']
    bl_uri, bl_n = data_uri(bl, 'PNG', optimize=True)
    back_uri, back_n, bl_lab_uri, bl_lab_n = None, 0, None, 0
    if A['back'] is not None:
        back_uri, back_n = data_uri(Image.fromarray(A['back'][0], 'RGBA'), 'WEBP', quality=90, method=6, exact=False)
        bl_lab_uri, bl_lab_n = data_uri(Image.fromarray(A['back'][1], 'L'), 'PNG', optimize=True)
    sizes = {'full': full_n, 'labels': lab_n, 'face3d.open': op_n, 'face3d.closed': cl_n, 'blink': bl_n, 'back': back_n, 'backLabels': bl_lab_n}
    return dict(full=full_uri, labels=lab_uri, open=op_uri, closed=cl_uri, blink=(bl_uri, bx, by, bl.size[0], bl.size[1]),
                back=back_uri, backLabels=bl_lab_uri), sizes


def write_js(A, U, path=OUT):
    tpl = JS_TEMPLATE
    bl_uri, bx, by, bw, bh = U['blink']
    data = {
        'w': A['W'], 'h': A['H'],
        'base': A['base'], 'ombre': A['ombre'], 'anchors': A['anchors'],
        'defaults': DEFAULT, 'tipsMix': list(TIPS_MIX),
        'range': {k: list(v) for k, v in RANGE.items()}, 'yLight': Y_LIGHT, 'yDark': Y_DARK, 'gammaMin': GAMMA_MIN,
        'beretK': BERET_K, 'skin': A['skin'],
    }
    js = tpl
    js = js.replace('/*@DATA@*/', json.dumps(data, ensure_ascii=False, separators=(',', ':'))[1:-1] + ',')
    js = js.replace("'@FULL@'", json.dumps(U['full'])).replace("'@LABELS@'", json.dumps(U['labels']))
    js = js.replace("'@BACK@'", json.dumps(U['back']) if U['back'] else 'null')
    js = js.replace("'@BACKLABELS@'", json.dumps(U['backLabels']) if U['backLabels'] else 'null')
    js = js.replace("'@OPEN@'", json.dumps(U['open'])).replace("'@CLOSED@'", json.dumps(U['closed']))
    js = js.replace("'@BLINK@'", json.dumps({'src': bl_uri, 'x': bx, 'y': by, 'w': bw, 'h': bh}))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(js)
    return len(js.encode('utf-8'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--debug', help='папка для отладочных картинок')
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--glb', help='GLB модели автора -> js/hero3d.js (рисунок при этом не пересобирается)')
    ap.add_argument('--out3d', default=OUT3D)
    ap.add_argument('--ombre', action='store_true', help='оставить карамельные кончики (по умолчанию — в цвет волос)')
    args = ap.parse_args()
    if args.glb:
        glb, meta, tex = glb_pack(args.glb, ombre=args.ombre)
        n = write_hero3d(glb, meta, args.out3d)
        print('hero3d.js: %.1f KB (GLB %.1f KB, JPEG %.1f KB, %d tris)' % (n / 1024, meta['glbBytes'] / 1024, meta['jpgBytes'] / 1024, meta['tris']))
        print('  anchors', meta['anchors'])
        if args.debug:
            os.makedirs(args.debug, exist_ok=True)
            Image.fromarray(tex).save(os.path.join(args.debug, 'hero3d_texture.png'))
        return meta
    A = build()
    U, sizes = encode(A)
    n = write_js(A, U, args.out)
    print('hero_assets.js: %.1f KB' % (n / 1024))
    for k, v in sizes.items():
        print('  %-14s %6.1f KB' % (k, v / 1024))
    print('  base', A['base'])
    print('  anchors', A['anchors'])
    if args.debug:
        debug_images(A, args.debug)
    return A


def debug_images(A, d):
    """Превью для проверки глазами: разметка, наклейки лица на «коже», аватар, вид со спины, моргание."""
    os.makedirs(d, exist_ok=True)
    pal = np.array([[0, 0, 0], [60, 40, 200], [230, 200, 120], [255, 120, 220], [200, 0, 80], [120, 0, 40], [255, 140, 0]], np.uint8)
    bgc = (255, 244, 236, 255)

    def overlay(img, lab):
        ov = (img[..., :3] * 0.35 + pal[lab] * 0.65).astype(np.uint8)
        ov[lab == 0] = img[..., :3][lab == 0]
        ov[img[..., 3] == 0] = (0, 160, 60)
        return Image.fromarray(ov)
    full = A['full']
    W, H = A['W'], A['H']
    lo = overlay(full, A['labels'])
    tiles = [Image.fromarray(full), lo]
    if A['back'] is not None:
        tiles += [Image.fromarray(A['back'][0]), overlay(*A['back'])]
    sh = Image.new('RGBA', (W * len(tiles) + 10 * (len(tiles) - 1), H), bgc)
    for i, t in enumerate(tiles):
        sh.alpha_composite(t.convert('RGBA'), (i * (W + 10), 0))
    sh.save(os.path.join(d, 'labels_overlay.png'))
    Image.fromarray(full).save(os.path.join(d, 'full.png'))
    if A['back'] is not None:
        Image.fromarray(A['back'][0]).save(os.path.join(d, 'back.png'))
    # наклейки лица на диске кожи (кожа 3D-модели #F7DCC8 и чуть темнее — как в тени)
    pv = Image.new('RGBA', (2 * 560 + 30, 2 * 400 + 60), bgc)
    dr = ImageDraw.Draw(pv)
    for col_i, k in enumerate(('open', 'closed')):
        for row_i, skin in enumerate(((247, 220, 200), (222, 184, 164))):
            disc = Image.new('RGBA', (560, 400), (0, 0, 0, 0))
            dd = ImageDraw.Draw(disc)
            dd.ellipse((10, -40, 550, 440), fill=skin + (255,))
            disc.alpha_composite(A['decals'][k], (24, 20))
            pv.alpha_composite(disc, (10 + col_i * 570, 40 + row_i * 410))
        dr.text((14 + col_i * 570, 10), 'face3d.%s (512x360, layout as heroFaceCanvas)' % k, fill=(58, 46, 63, 255))
    pv.save(os.path.join(d, 'face_decal_preview.png'))
    # аватар
    x, y, w, h = A['anchors']['head']
    av = Image.fromarray(full).crop((int(x), int(y), int(round(x + w)), int(round(y + h))))
    avb = Image.new('RGBA', av.size, bgc)
    avb.alpha_composite(av)
    m = Image.new('L', av.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, av.size[0] - 1, av.size[1] - 1), fill=255)
    circ = Image.new('RGBA', av.size, (0, 0, 0, 0))
    circ.paste(avb, (0, 0), m)
    sh = Image.new('RGBA', (av.size[0] * 2 + 30, av.size[1] + 20), bgc)
    sh.alpha_composite(avb, (10, 10))
    sh.alpha_composite(circ, (av.size[0] + 20, 10))
    sh.save(os.path.join(d, 'avatar_crop.png'))
    # моргание в 2D
    bl, bx, by = A['blink']
    fx, fy, fw, fh = A['anchors']['face']
    box = (int(fx) - 10, int(fy) - 10, int(fx + fw) + 10, int(fy + fh) + 10)
    a1 = Image.fromarray(full).crop(box)
    c2 = Image.fromarray(full)
    c2.alpha_composite(bl, (bx, by))
    a2 = c2.crop(box)
    sh = Image.new('RGBA', (a1.size[0] * 4 + 10, a1.size[1] * 2), bgc)
    sh.alpha_composite(a1.resize((a1.size[0] * 2, a1.size[1] * 2), Image.LANCZOS), (0, 0))
    sh.alpha_composite(a2.resize((a1.size[0] * 2, a1.size[1] * 2), Image.LANCZOS), (a1.size[0] * 2 + 10, 0))
    sh.save(os.path.join(d, 'blink_preview.png'))


JS_TEMPLATE = r'''/* =====================================================================
   ГЕРОИНЯ ПО РИСУНКУ АВТОРА: картинки (data:) и перекраска под образ.
   Файл сгенерирован tools/hero_assets.py из art_src/heroine.webp — руками не править.
   Описание: ASSETS.md (метки, алгоритм перекраски, якоря, размеры).
   ===================================================================== */
(function () {
  'use strict';
  const HERO = {
    /*@DATA@*/
    full: '@FULL@',
    labels: '@LABELS@',
    back: '@BACK@',
    backLabels: '@BACKLABELS@',
    face3d: { open: '@OPEN@', closed: '@CLOSED@', size: 512, w: 512, h: 360 },
    blink: '@BLINK@',
  };

  /* ---------- цвет ---------- */
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
  const same = (a, b) => !!a && !!b && a.toUpperCase() === b.toUpperCase();
  const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
  // sRGB <-> CIE LCh (D65) — для beretOf
  const M = [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]];
  const WP = [0.95047, 1.0, 1.08883], EPS = 216 / 24389, KAP = 24389 / 27;
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = c => { c = Math.max(0, Math.min(1, c)); return (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255; };
  function hex2lch(h) {
    const l = hex2rgb(h).map(toLin);
    const f = M.map((row, i) => { const t = (row[0] * l[0] + row[1] * l[1] + row[2] * l[2]) / WP[i]; return t > EPS ? Math.cbrt(t) : (KAP * t + 16) / 116; });
    const L = 116 * f[1] - 16, a = 500 * (f[0] - f[1]), b = 200 * (f[1] - f[2]);
    return [L, Math.hypot(a, b), Math.atan2(b, a) * 180 / Math.PI];
  }
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  const MI = inv3(M);
  function lch2hex(L, C, h) {
    for (;;) {
      const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180), fy = (L + 16) / 116;
      const xyz = [fy + a / 500, fy, fy - b / 200].map((f, i) => (f * f * f > EPS ? f * f * f : (116 * f - 16) / KAP) * WP[i]);
      const lin = MI.map(r => r[0] * xyz[0] + r[1] * xyz[1] + r[2] * xyz[2]);
      if (lin.some(v => v < -1e-4 || v > 1 + 1e-4) && C > 0.5) { C *= 0.92; continue; }
      return rgb2hex(lin.map(toSrgb));
    }
  }

  // Берет под цвет банта. Розовый бант с рисунка -> бордовый с рисунка; иначе тот же тон, темнее
  // (L*×0.48, но не темнее L*26 — иначе сольётся с тёмными волосами); тёмный бант -> берет светлее банта.
  HERO.beretOf = function (bow) {
    if (!bow || same(bow, HERO.defaults.bow)) return HERO.base.beret;
    const k = HERO.beretK, [L, C, h] = hex2lch(bow);
    const Lb = L >= k.dark ? Math.min(Math.max(L * k.l, k.lmin), L - k.contrast) : L + k.lift;
    return lch2hex(Lb, Math.max(C * k.c, k.cmin), h + k.dh);
  };
  // кончики волос: по умолчанию в цвет волос (решение автора); HERO.ombreOn = true — светлые кончики (вариант для ателье)
  HERO.ombreOn = false;
  HERO.tipsOf = hair => (HERO.ombreOn ? mix(hair, HERO.tipsMix[0], HERO.tipsMix[1]) : hair);

  // Цели перекраски для образа { bow, coat, hair, beret?, shoes? } (как в состоянии игры).
  // Совпадающее с цветом по умолчанию не трогаем — остаются пиксели автора.
  HERO.targets = function (look) {
    look = look || {}; const d = HERO.defaults, t = {};
    if (look.hair && !same(look.hair, d.hair)) { t.hair = look.hair; t.hairTips = HERO.tipsOf(look.hair); }
    else if (HERO.ombreOn && HERO.base.ombreTips && !same(HERO.base.hairTips, HERO.base.ombreTips)) { t.hair = HERO.base.hair; t.hairTips = HERO.base.ombreTips; }
    if (look.coat && !same(look.coat, d.coat)) t.coat = look.coat;
    if (look.bow && !same(look.bow, d.bow)) { t.bow = look.bow; t.beret = HERO.beretOf(look.bow); }
    if (look.beret && !same(look.beret, HERO.base.beret)) t.beret = look.beret;
    if (look.shoes && !same(look.shoes, HERO.base.shoes)) t.shoes = look.shoes;
    return t;
  };

  /* ---------- перекраска пикселей (эталон: recolor() в tools/hero_assets.py) ---------- */
  const GROUPS = { 1: 'hair', 6: 'hair', 2: 'coat', 3: 'bow', 4: 'beret', 5: 'shoes' };
  HERO.recolorPixels = function (px, lab, w, h, targets) {
    const B0 = {}, T0 = {};
    for (const k of ['coat', 'bow', 'beret', 'shoes']) if (targets[k]) { B0[k] = hex2rgb(HERO.base[k]); T0[k] = hex2rgb(targets[k]); }
    const doHair = !!targets.hair;
    const bH = hex2rgb(HERO.base.hair), bT = hex2rgb(HERO.base.hairTips);
    const tH = doHair ? hex2rgb(targets.hair) : null, tT = doHair ? hex2rgb(targets.hairTips || HERO.tipsOf(targets.hair)) : null;
    const [o0, o1] = HERO.ombre, R = HERO.range, yL = HERO.yLight, yD = HERO.yDark, gMin = HERO.gammaMin;
    const B = [0, 0, 0], T = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      let ww = Math.min(1, Math.max(0, (y - o0) / (o1 - o0))); ww = ww * ww * (3 - 2 * ww);
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4, lb_ = lab[j];
        if (!lb_ || !px[j + 3]) continue;
        const key = GROUPS[lb_];
        if (!key) continue;
        if (key === 'hair') {
          if (!doHair) continue;
          for (let c = 0; c < 3; c++) { B[c] = bH[c] * (1 - ww) + bT[c] * ww; T[c] = tH[c] * (1 - ww) + tT[c] * ww; }
        } else {
          if (!T0[key]) continue;
          for (let c = 0; c < 3; c++) { B[c] = B0[key][c]; T[c] = T0[key][c]; }
        }
        const lb = Math.max(luma(B[0], B[1], B[2]), 1), lt = Math.max(luma(T[0], T[1], T[2]), 1);
        const r0 = px[j], g0 = px[j + 1], b0 = px[j + 2], Yp = luma(r0, g0, b0), r = Yp / lb;
        const lo = R[key][0], hi = R[key][1];
        let v0, v1, v2;
        if (r > hi || r < lo) {
          // сглаженный стык с соседом: перекрашиваем только «свою» долю f пикселя
          const f = r > hi ? Math.min(1, Math.max(0, (yL - Yp) / Math.max(yL - lb, 1e-6)))
                           : Math.min(1, Math.max(0, (Yp - yD) / Math.max(lb - yD, 1e-6)));
          v0 = r0 + f * (T[0] - B[0]); v1 = g0 + f * (T[1] - B[1]); v2 = b0 + f * (T[2] - B[2]);
        } else {
          const g = Math.min(1, Math.max(gMin, Math.sqrt(lb / lt))), k = Math.pow(r, g);
          v0 = T[0] * k; v1 = T[1] * k; v2 = T[2] * k;
          const mx = Math.max(v0, v1, v2);
          if (mx > 255) {   // пересвет уводим к белому, сохраняя яркость
            const Y = Math.min(luma(v0, v1, v2), 255), s = (255 - Y) / Math.max(mx - Y, 1e-6);
            v0 = Y + (v0 - Y) * s; v1 = Y + (v1 - Y) * s; v2 = Y + (v2 - Y) * s;
          }
        }
        px[j] = Math.max(0, Math.min(255, Math.round(v0)));
        px[j + 1] = Math.max(0, Math.min(255, Math.round(v1)));
        px[j + 2] = Math.max(0, Math.min(255, Math.round(v2)));
      }
    }
    return px;
  };

  /* ---------- загрузка и готовые картинки ---------- */
  const img = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const loading = {};
  // Promise<{ full: Image, labels: Uint8ClampedArray (RGBA, метка в R) }>; view: 'front' (по умолчанию) | 'back'
  HERO.load = function (view) {
    const back = view === 'back' && !!HERO.back, k = back ? 'back' : 'front';
    if (!loading[k]) loading[k] = Promise.all([img(back ? HERO.back : HERO.full), img(back ? HERO.backLabels : HERO.labels)]).then(([f, l]) => {
      const cv = document.createElement('canvas'); cv.width = HERO.w; cv.height = HERO.h;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(l, 0, 0); const lab = c.getImageData(0, 0, HERO.w, HERO.h).data;
      return { full: f, labels: lab };
    });
    return loading[k];
  };
  const cache = {};
  // Promise<HTMLCanvasElement> героини в образе look ({ bow, coat, hair[, beret, shoes] }); view: 'front' | 'back'
  HERO.paint = function (look, view) {
    const t = HERO.targets(look), key = (view === 'back' && HERO.back ? 'back' : 'front') + JSON.stringify(t);
    if (!cache[key]) cache[key] = HERO.load(view).then(({ full, labels }) => {
      const cv = document.createElement('canvas'); cv.width = HERO.w; cv.height = HERO.h;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(full, 0, 0);
      if (Object.keys(t).length) {
        const d = c.getImageData(0, 0, HERO.w, HERO.h);
        HERO.recolorPixels(d.data, labels, HERO.w, HERO.h, t);
        c.putImageData(d, 0, 0);
      }
      return cv;
    });
    return cache[key];
  };
  // Promise<string> — data:-адрес картинки (для <img src> / SVG <image href>)
  HERO.paintURL = function (look, view, type) {
    return HERO.paint(look, view).then(cv => cv.toDataURL(type || 'image/png'));
  };

  window.HERO = HERO;
})();
'''


# ================================================================ 3D-модель автора -> js/hero3d.js
# python3 tools/hero_assets.py --glb ../model3d/out/heroine_game.glb      (пишет js/hero3d.js)
# Что делает: ставит модель ногами на y=0 и осью ног в x=z=0; по решению №10 убирает карамельные кончики
# из запечённой текстуры (OMBRE=False, кончики в цвет корней); сжимает вершины (KHR_mesh_quantization:
# позиции int16, нормали int8, UV uint16) и кладёт GLB в data:-адрес. Рядом — якоря для игры (руки, голова,
# край пальто) в метрах модели.
OUT3D = os.path.join(ROOT, 'js', 'hero3d.js')
GLB_JPEG_Q = 92


def _glb_read(path):
    import struct
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8: off + 8 + bl]


def _glb_acc(j, binc, i, raw=False):
    """Аксессор в numpy: float64 (с учётом normalized у квантованных), индексы — int64; raw — как лежит."""
    a = j['accessors'][i]
    bv = j['bufferViews'][a['bufferView']]
    dt = {5126: np.float32, 5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
    k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    isz = np.dtype(dt).itemsize
    st = bv.get('byteStride', k * isz)
    if st == k * isz:
        arr = np.frombuffer(binc, dt, a['count'] * k, o).reshape(a['count'], k)
    else:   # чередующиеся/выровненные данные (int8 VEC3 со stride 4 и т. п.)
        arr = np.lib.stride_tricks.as_strided(np.frombuffer(binc, np.uint8, len(binc) - o, o).view(np.uint8),
                                              (a['count'], k * isz), (st, 1)).copy().view(dt).reshape(a['count'], k)
    if raw:
        return arr if k > 1 else arr[:, 0]
    if k == 1:
        return arr[:, 0].astype(np.int64)
    out = arr.astype(np.float64)
    if a.get('normalized'):
        out = np.maximum(out / float(np.iinfo(dt).max), -1.0)
    return out


def _uv_raster(P, UV, I, S):
    """Для каждого текселя S×S: 3D-точка модели (пустые тексели — как у ближайшего острова)."""
    tid = Image.new('I', (S, S), -1)
    d = ImageDraw.Draw(tid)
    uvp = UV * S
    for t, (a, b, c) in enumerate(I):
        d.polygon([tuple(uvp[a]), tuple(uvp[b]), tuple(uvp[c])], fill=int(t))
    T = np.array(tid, np.int64)
    m = T >= 0
    ys, xs = np.nonzero(m)
    tt = T[m]
    A, B, C = uvp[I[tt, 0]], uvp[I[tt, 1]], uvp[I[tt, 2]]
    v0, v1 = B - A, C - A
    v2 = np.stack([xs + 0.5, ys + 0.5], 1) - A
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    den[den == 0] = 1e-12
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    bc = np.clip(np.stack([1 - v - w, v, w], 1), 0, 1)
    bc /= bc.sum(1, keepdims=True)
    pos = np.zeros((S, S, 3))
    pos[m] = (P[I[tt]] * bc[:, :, None]).sum(1)
    idx = ndi.distance_transform_edt(~m, return_distances=False, return_indices=True)
    return pos[idx[0], idx[1]], m


def _hsv(img):
    mx, mn = img.max(2) / 255, img.min(2) / 255
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    dd = np.maximum(mx - mn, 1e-6)
    r, g, b = img[..., 0] / 255, img[..., 1] / 255, img[..., 2] / 255
    H = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return H, S, mx


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def glb_deombre(img, pos, covered):
    """Кончики волос в цвет корней. Волосы — насыщенные тёплые тексели (тон 8–52°, S > 0.5, не светлее V 0.8)
    выше кистей и лупы; ожидаемый цвет волос на каждой высоте — медиана по «ядру» волос; новый цвет = цвет корней ×
    (яркость текселя / ожидаемая яркость)^g — пряди, блики и запечённые тени сохраняются, уходит только переход."""
    img = img.astype(np.float64)
    y = pos[..., 1]
    H, S, V = _hsv(img)
    W = _ss(8, 16, H) * _ss(52, 44, H) * _ss(0.42, 0.58, S) * _ss(0.82, 0.7, V) * _ss(0.75, 0.83, y)
    core = (W > 0.9) & covered
    lum = np.array([0.299, 0.587, 0.114])
    bins = np.linspace(0.75, 1.9, 47)
    cen = (bins[:-1] + bins[1:]) / 2
    E = np.zeros((len(cen), 3))
    ok = np.zeros(len(cen), bool)
    for i in range(len(cen)):
        s = core & (y >= bins[i]) & (y < bins[i + 1])
        if s.sum() > 200:
            E[i] = np.median(img[s], 0)
            ok[i] = True
    for c in range(3):
        E[:, c] = np.interp(cen, cen[ok], E[ok, c])
    E = ndi.gaussian_filter1d(E, 1.5, axis=0)
    R = np.median(img[core & (y > 1.45) & (y < 1.57)], 0)          # корни: макушка под беретом
    Ey = np.stack([np.interp(y, cen, E[:, c]) for c in range(3)], -1)
    top = _ss(1.37, 1.5, y)[..., None]                               # выше — корни, брови и ресницы не трогаем
    Ey = Ey * (1 - top) + R * top
    YE = np.maximum(Ey @ lum, 1)
    YR = max(float(R @ lum), 1.0)
    k = (img @ lum) / YE
    g = np.clip(np.sqrt(YE / YR), GAMMA_MIN, 1.0)
    new = R[None, None, :] * (np.clip(k, 0, 3) ** g)[..., None]
    out = img * (1 - W[..., None]) + new * W[..., None]
    return np.clip(np.floor(out + 0.5), 0, 255).astype(np.uint8), rgb2hex(R)


def glb_anchors(P, img, pos, covered):
    """Якоря в метрах модели (ноги на 0, ось ног — x = z = 0): свободная рука (левая у героини, +x), рука с лупой (−x),
    центр и радиус головы, верх берета, край пальто, высота бедра и колена для «посадки» статуэтки."""
    H, S, V = _hsv(img.astype(np.float64))
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    skin = covered & (S > 0.12) & (S < 0.42) & (V > 0.78) & ((H < 30) | (H > 340))
    def med(sel):
        return [round(float(np.median(a[sel])), 3) for a in (x, y, z)]
    hand_f = med(skin & (y < 1.0) & (y > 0.5) & (x > 0.1))
    hand_m = med(skin & (y < 1.0) & (y > 0.5) & (x < -0.1))
    vy = P[:, 1]
    band = (vy > 1.4) & (vy < 1.6)                   # голова с волосами (под беретом)
    head_r = float(np.percentile(np.abs(P[band, 0]), 95))
    hz = float(np.percentile(P[band, 2], 2) + np.percentile(P[band, 2], 98)) / 2
    legs = (vy > 0.1) & (vy < 0.45)
    coat = (vy > 0.45) & (vy < 0.7) & (np.abs(P[:, 0]) > 0.12) & (np.abs(P[:, 0]) < 0.18)   # край пальто по бокам, без кистей
    return {
        'handFree': hand_f, 'handMag': hand_m,
        'head': [0.0, 1.5, round(hz, 3)], 'headR': round(head_r, 3), 'top': round(float(vy.max()), 3),
        'hem': round(float(np.percentile(vy[coat], 1)), 3), 'hip': 0.8, 'knee': 0.45,
        'legX': round(float(np.percentile(np.abs(P[legs, 0]), 50)), 3), 'toe': round(float(P[vy < 0.1, 2].max()), 3),
    }


def glb_pack(src, ombre=False):
    import struct
    j, binc = _glb_read(src)
    pr = j['meshes'][0]['primitives'][0]
    P = _glb_acc(j, binc, pr['attributes']['POSITION'])
    N = _glb_acc(j, binc, pr['attributes']['NORMAL'])
    UV = _glb_acc(j, binc, pr['attributes']['TEXCOORD_0'])
    I = _glb_acc(j, binc, pr['indices']).reshape(-1, 3)
    # скин (модель после tools/rig_heroine.py): кости — узлы с именами, покой без поворотов
    skin = None
    if 'JOINTS_0' in pr['attributes'] and j.get('skins'):
        sk = j['skins'][0]
        JN = _glb_acc(j, binc, pr['attributes']['JOINTS_0'], raw=True).astype(np.uint8)
        WN = _glb_acc(j, binc, pr['attributes']['WEIGHTS_0'], raw=True)
        WN = WN.astype(np.float64) / (255.0 if WN.dtype == np.uint8 else 65535.0 if WN.dtype == np.uint16 else 1.0)
        parent = {}
        for ni, nd in enumerate(j['nodes']):
            for c in nd.get('children', []):
                parent[c] = ni
        heads = {}
        def world(ni):
            if ni in heads:
                return heads[ni]
            t = np.array(j['nodes'][ni].get('translation', [0, 0, 0]), float)
            heads[ni] = t + (world(parent[ni]) if ni in parent else 0)
            return heads[ni]
        jl = sk['joints']
        skin = {'J': JN, 'W': WN, 'bones': [[j['nodes'][ni].get('name', 'b%d' % k), jl.index(parent[ni]) if parent.get(ni) in jl else -1,
                                             world(ni)] for k, ni in enumerate(jl)]}
    bv = j['bufferViews'][j['images'][0]['bufferView']]
    o = bv.get('byteOffset', 0)
    img = np.array(Image.open(io.BytesIO(binc[o:o + bv['byteLength']])).convert('RGB'))
    # ноги на y = 0, ось ног (по голеням) — в x = z = 0 (у скина сдвигаются и суставы)
    sh0 = np.zeros(3)
    sh0[1] = -P[:, 1].min(); P[:, 1] += sh0[1]
    shin = (P[:, 1] > 0.1) & (P[:, 1] < 0.45)
    sh0[0] = -(P[shin, 0].min() + P[shin, 0].max()) / 2; P[:, 0] += sh0[0]
    sh0[2] = -(P[shin, 2].min() + P[shin, 2].max()) / 2; P[:, 2] += sh0[2]
    if skin:
        for b in skin['bones']:
            b[2] = [round(float(v), 5) for v in (np.array(b[2]) + sh0)]
    pos, covered = _uv_raster(P, UV, I, img.shape[0])
    hair_root = None
    if not ombre:
        img, hair_root = glb_deombre(img, pos, covered)
    anchors = glb_anchors(P, img, pos, covered)
    jb = io.BytesIO()
    Image.fromarray(img).save(jb, 'JPEG', quality=GLB_JPEG_Q, subsampling=0, optimize=True)
    jpg = jb.getvalue()
    # квантование: позиции — int16 в кубе [-1, 1] (масштаб и сдвиг — в узле), нормали — int8, UV — uint16
    c = (P.min(0) + P.max(0)) / 2
    sc = float((P.max(0) - P.min(0)).max() / 2)
    Pq = np.zeros((len(P), 4), np.int16)
    Pq[:, :3] = np.round((P - c) / sc * 32767)
    Nn = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    Nq = np.zeros((len(N), 4), np.int8)
    Nq[:, :3] = np.round(Nn * 127)
    UVq = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
    Iq = I.astype(np.uint16).reshape(-1)
    chunks, views = [], []
    def add(data, target=None, stride=None):
        off = sum(len(x) for x in chunks)
        chunks.append(data + b'\0' * ((4 - len(data) % 4) % 4))
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        if stride:
            v['byteStride'] = stride
        views.append(v)
        return len(views) - 1
    vP = add(Pq.tobytes(), 34962, 8)
    vN = add(Nq.tobytes(), 34962, 4)
    vU = add(UVq.tobytes(), 34962)
    vI = add(Iq.tobytes(), 34963)
    vJ = add(jpg)
    if skin:
        # веса uint8 (сумма ровно 255), индексы костей uint8; IBM = перенос(−сустав) · деквантование
        Wq = np.floor(skin['W'] * 255 + 0.5).astype(int)
        Wq[np.arange(len(Wq)), Wq.argmax(1)] += 255 - Wq.sum(1)
        vSJ = add(skin['J'].astype(np.uint8).tobytes(), 34962)
        vSW = add(Wq.astype(np.uint8).tobytes(), 34962)
        D = np.eye(4); D[:3, :3] *= sc; D[:3, 3] = c
        ibm = []
        for b in skin['bones']:
            M = np.eye(4); M[:3, 3] = -np.array(b[2])
            ibm.append((M @ D).T.reshape(-1))
        vIB = add(np.array(ibm, np.float32).tobytes())
    qmin, qmax = Pq[:, :3].min(0).tolist(), Pq[:, :3].max(0).tolist()
    g = {
        'asset': {'version': '2.0', 'generator': 'delo1010 tools/hero_assets.py'},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'heroine', 'translation': [float(v) for v in c], 'scale': [sc, sc, sc]}],
        'meshes': [{'name': 'heroine', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
        'materials': [{'name': 'heroine', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': vJ, 'mimeType': 'image/jpeg'}],
        'accessors': [
            {'bufferView': vP, 'componentType': 5122, 'normalized': True, 'count': len(P), 'type': 'VEC3', 'min': qmin, 'max': qmax},
            {'bufferView': vN, 'componentType': 5120, 'normalized': True, 'count': len(N), 'type': 'VEC3'},
            {'bufferView': vU, 'componentType': 5123, 'normalized': True, 'count': len(UV), 'type': 'VEC2'},
            {'bufferView': vI, 'componentType': 5123, 'count': len(Iq), 'type': 'SCALAR'},
        ],
        'bufferViews': views,
    }
    if skin:
        # скин: деквантование ушло в IBM, у узла сетки трансформа нет (по спецификации она у скина не учитывается)
        nb = len(skin['bones'])
        g['nodes'] = [{'mesh': 0, 'name': 'heroine', 'skin': 0}]
        for k, (nm, par, hd) in enumerate(skin['bones']):
            loc = np.array(hd) - (np.array(skin['bones'][par][2]) if par >= 0 else 0)
            nd = {'name': nm, 'translation': [round(float(v), 6) for v in loc]}
            kids = [q + 1 for q, b in enumerate(skin['bones']) if b[1] == k]
            if kids:
                nd['children'] = kids
            g['nodes'].append(nd)
        g['scenes'] = [{'nodes': [0] + [k + 1 for k, b in enumerate(skin['bones']) if b[1] < 0]}]
        g['skins'] = [{'joints': list(range(1, nb + 1)), 'inverseBindMatrices': 6, 'skeleton': 1}]
        g['meshes'][0]['primitives'][0]['attributes'].update({'JOINTS_0': 4, 'WEIGHTS_0': 5})
        g['accessors'] += [
            {'bufferView': vSJ, 'componentType': 5121, 'count': len(P), 'type': 'VEC4'},
            {'bufferView': vSW, 'componentType': 5121, 'normalized': True, 'count': len(P), 'type': 'VEC4'},
            {'bufferView': vIB, 'componentType': 5126, 'count': nb, 'type': 'MAT4'},
        ]
    bin_ = b''.join(chunks)
    g['buffers'] = [{'byteLength': len(bin_)}]
    js = json.dumps(g, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js \
        + struct.pack('<II', len(bin_), 0x004E4942) + bin_
    meta = {'height': round(float(P[:, 1].max()), 3), 'tris': int(len(I)), 'verts': int(len(P)), 'glbBytes': len(glb),
            'jpgBytes': len(jpg), 'ombre': bool(ombre), 'anchors': anchors}
    if hair_root:
        meta['hair'] = hair_root
    if skin:
        # деквантование позиций (у скина его нет в узле) и кости: [имя, родитель, сустав в метрах модели]
        meta['rig'] = {'deq': [round(float(v), 7) for v in c] + [round(sc, 7)], 'bones': skin['bones']}
    return glb, meta, img


def write_hero3d(glb, meta, path=OUT3D):
    uri = 'data:model/gltf-binary;base64,' + base64.b64encode(glb).decode('ascii')
    js = JS3D_TEMPLATE.replace('/*@DATA@*/', json.dumps(meta, ensure_ascii=False, separators=(',', ':'))[1:-1] + ',')
    js = js.replace("'@GLB@'", json.dumps(uri))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(js)
    return len(js.encode('utf-8'))


JS3D_TEMPLATE = r"""/* =====================================================================
   3D-ГЕРОИНЯ ПО МОДЕЛИ АВТОРА: облегчённый GLB (data:) и загрузка через THREE.GLTFLoader.
   Файл сгенерирован tools/hero_assets.py --glb — руками не править.
   Модель стоит ногами на y = 0, ось ног — x = z = 0, лицом к +Z, рост в метрах игры.
   anchors: handFree — свободная рука (левая у героини, +x), handMag — рука с лупой, head/headR — голова,
   top — верх берета, hem — край пальто, hip/knee — шарниры «посадки» статуэтки.
   rig (если модель со скелетом, tools/rig_heroine.py): bones — [имя, родитель, сустав], покой без поворотов;
   deq — деквантование позиций [cx, cy, cz, масштаб].
   HERO3D.load() -> Promise<{ geometry, map, rig } | null>: один раз за сессию; null — модель не открылась
   (тогда в 3D рисованная героиня, без WebGL — 2D-героиня с рисунка). У скина в geometry ещё skinIndex/skinWeight,
   кости город строит сам (js/hero_anim.js оживляет их); без скелета rig = null и героиня — «статуэтка».
   ===================================================================== */
(function () {
  'use strict';
  const HERO3D = {
    /*@DATA@*/
    glb: '@GLB@',
  };
  let pending = null;
  // позиции, нормали и UV в модели сжаты (int16/int8/uint16): разворачиваем во float и запекаем масштаб узла,
  // чтобы дальше это была обычная геометрия (контур, тени, рейкаст)
  function unpack(gltf) {
    const T = window.THREE;
    let mesh = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) return null;
    const src = mesh.geometry, g = new T.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(k => {
      const a = src.attributes[k]; if (!a) return;
      const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
      for (let i = 0; i < n; i++) {
        out[i * s] = a.getX(i); out[i * s + 1] = a.getY(i);
        if (s > 2) out[i * s + 2] = a.getZ(i);
      }
      g.setAttribute(k, new T.BufferAttribute(out, s));
    });
    g.setIndex(src.index ? new T.BufferAttribute(src.index.array.slice(), 1) : null);
    const rig = HERO3D.rig && src.attributes.skinIndex && src.attributes.skinWeight ? HERO3D.rig : null;
    if (rig) {
      // у скина деквантование не в узле, а в IBM: применяем его сами; индексы и веса костей — как есть (uint8)
      const d = rig.deq;
      g.applyMatrix4(new T.Matrix4().makeScale(d[3], d[3], d[3]).setPosition(d[0], d[1], d[2]));
      g.setAttribute('skinIndex', new T.BufferAttribute(src.attributes.skinIndex.array.slice(), 4));
      const sw = src.attributes.skinWeight;
      g.setAttribute('skinWeight', new T.BufferAttribute(sw.array.slice(), 4, !!sw.normalized));
    } else g.applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox(); g.computeBoundingSphere();
    const map = mesh.material && mesh.material.map;
    src.dispose();
    return map ? { geometry: g, map, rig } : null;
  }
  HERO3D.load = function () {
    if (pending) return pending;
    const T = window.THREE;
    if (!T || !T.GLTFLoader) return (pending = Promise.resolve(null));
    pending = new Promise(res => {
      let buf;
      try {
        const bin = atob(HERO3D.glb.slice(HERO3D.glb.indexOf(',') + 1)), n = bin.length, u8 = new Uint8Array(n);
        for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
        buf = u8.buffer;
      } catch (e) { res(null); return; }
      const t0 = performance.now();
      try {
        new T.GLTFLoader().parse(buf, '', gl => {
          let r = null;
          try { r = unpack(gl); } catch (e) { r = null; }
          HERO3D.ms = Math.round(performance.now() - t0);
          res(r);
        }, () => res(null));
      } catch (e) { res(null); }
    });
    return pending;
  };
  // уже загружена? (синхронно; для выбора героя на старте сцены)
  HERO3D.ready = null;
  HERO3D.whenReady = (ms = 0) => Promise.race([HERO3D.load().then(r => (HERO3D.ready = r)), new Promise(r => setTimeout(() => r(null), ms))]);
  window.HERO3D = HERO3D;
})();
"""


if __name__ == '__main__':
    main()
