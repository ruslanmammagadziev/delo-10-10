#!/usr/bin/env python3
"""Зоны вершин 3D-героини (js/hero3d.js) для образов: js/hero_zones.js.

Запуск: python3 -I tools/hero_zones.py [--out js/hero_zones.js] [--debug папка]

У каждой вершины модели автора — одна зона (Uint8): лицо, уши, волосы на голове и длинные пряди, берет,
бант, воротник, тренч (верх и полы), рукав, хлястик манжеты, пояс, пуговицы, кисти, колготки, туфли, лупа,
шея и вырез (кожа). Зона — по главной кости скина, позе покоя (ноги на y = 0, лицом к +Z, +x — её левая
сторона) и цвету текстуры (CIE Lab, медиана по треугольникам вокруг вершины).
js/hero_outfits.js перекрашивает текстуру по зонам, прячет и перелепливает части модели.
Модель не перегенерируется; при замене js/hero3d.js — запустить заново (число вершин сверяется в рантайме).
Нужны numpy, Pillow, scikit-image (как у tools/hero_assets.py).
"""
import argparse, base64, io, json, os, re, struct, sys
import numpy as np
from PIL import Image
from skimage.color import rgb2lab

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = ['other', 'face', 'ears', 'hair_skull', 'hair_back', 'beret', 'bow', 'collar', 'coat_torso', 'coat_skirt',
         'sleeve', 'cuff', 'belt', 'buttons', 'hands', 'legs', 'shoes', 'mag', 'neck']
Z = {n: i for i, n in enumerate(NAMES)}
# пуговицы тренча (двубортный: два ряда по три), метры модели: центр (x, y)
BUTTONS = [(sx * 0.055, y) for y in (1.062, 0.929, 0.855) for sx in (-1, 1)]
BELT_Y = (0.958, 1.042)
CUFF_Y = (0.79, 0.875)


def load_model(path):
    src = open(path, encoding='utf-8').read()
    m = re.search(r'glb:\s*"data:model/gltf-binary;base64,([A-Za-z0-9+/=]+)"', src)
    glb = base64.b64decode(m.group(1))
    meta = json.loads('{' + re.search(r'^\s*("height".*?),\s*$', src, re.M).group(1) + '}')
    off, ch = 12, []
    while off < len(glb):
        cl, ct = struct.unpack('<II', glb[off:off + 8]); ch.append(glb[off + 8:off + 8 + cl]); off += 8 + cl
    js, BIN = json.loads(ch[0]), ch[1]
    CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def acc(i):
        a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
        dt = CT[a['componentType']]; n = NC[a['type']]
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize
        if stride and stride != n * isz:
            raw = np.frombuffer(BIN, dtype=np.uint8, count=stride * a['count'], offset=o).reshape(a['count'], stride)[:, :n * isz]
            arr = np.frombuffer(raw.tobytes(), dtype=dt).reshape(a['count'], n)
        else:
            arr = np.frombuffer(BIN, dtype=dt, count=a['count'] * n, offset=o).reshape(a['count'], n)
        arr = arr.astype(np.float64)
        if a.get('normalized'):
            arr = {np.int16: lambda v: np.maximum(v / 32767, -1), np.int8: lambda v: np.maximum(v / 127, -1),
                   np.uint16: lambda v: v / 65535, np.uint8: lambda v: v / 255}[dt](arr)
        return arr
    prim = js['meshes'][0]['primitives'][0]; at = prim['attributes']
    deq = meta['rig']['deq']
    P = acc(at['POSITION']) * deq[3] + np.array(deq[:3])
    UV = acc(at['TEXCOORD_0'])
    I = acc(prim['indices']).astype(np.int64).reshape(-1, 3)
    J = acc(at['JOINTS_0']).astype(np.int64); W = acc(at['WEIGHTS_0'])
    im = js['images'][0]; bv = js['bufferViews'][im['bufferView']]
    tex = Image.open(io.BytesIO(BIN[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
    bones = [b[0] for b in meta['rig']['bones']]
    return P, UV, I, J, W, tex, bones, meta


def classify(P, UV, I, J, W, tex, bones):
    n = len(P)
    img = np.asarray(tex).astype(np.float64) / 255
    H_, W_ = img.shape[:2]
    lab = rgb2lab(img)
    # цвет треугольника: медиана по 7 точкам внутри (у краёв островов текстуры один пиксель врёт)
    BW = np.array([[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6], [.45, .45, .1], [.45, .1, .45], [.1, .45, .45]])
    uvt = UV[I]
    smp = np.einsum('kj,tjd->tkd', BW, uvt)
    sx = np.clip((smp[..., 0] * W_).astype(int), 0, W_ - 1); sy = np.clip((smp[..., 1] * H_).astype(int), 0, H_ - 1)
    TL = np.median(lab[sy, sx], axis=1)
    e1 = uvt[:, 1] - uvt[:, 0]; e2 = uvt[:, 2] - uvt[:, 0]
    ok = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) > 1e-9
    acc = np.zeros((n, 3)); cnt = np.zeros(n)
    for k in range(3):
        np.add.at(acc, I[ok, k], TL[ok]); np.add.at(cnt, I[ok, k], 1)
    Lab = acc / np.maximum(cnt, 1)[:, None]
    L, a, b = Lab.T
    x, y, z = P.T
    main = J[np.arange(n), W.argmax(1)]
    bn = np.array([bones[k] for k in main])
    head = np.isin(bn, ['head', 'hair'])
    arm = np.isin(bn, ['shoulder_L', 'shoulder_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'])
    hand = np.isin(bn, ['hand_L', 'hand_R'])
    foot = np.isin(bn, ['foot_L', 'foot_R'])
    # цвета (Lab): кожа, волосы, малиновый берет, розовый бант, бежевый тренч, хаки (пояс, хлястики), колготки
    # кожа: тёплая (b не меньше ~0.75 a); розовый бант холоднее (b/a ≈ 0.4–0.6)
    skin = (L > 60) & (a > 7) & (a < 32) & (b > 10) & (b < 30) & (b > 0.72 * a)
    hair = (L < 42) & (a < 30) & ~((a > 25) & (a > 1.6 * np.maximum(b, 1)))
    beret = (a > 30) & (L < 62) & (a > 1.6 * np.maximum(b, 1))
    bowc = (a > 14) & (L > 50) & (a > 1.3 * np.maximum(b, 1))
    coat = (L > 33) & (np.abs(a) < 12) & (b > 8) & (b < 32)
    navy = (L < 22) & (b < -1)
    Zs = np.zeros(n, np.uint8)
    # лицо: рамка глаз, бровей, носа и губ из js/hero_look3d.js (там же — «лицо не трогаем никогда»)
    facebox = (z > 0.06) & (((y > 1.5) & (y < 1.58) & (x > -0.118) & (x < 0.142)) | ((y >= 1.58) & (y < 1.632) & (x > -0.101) & (x < 0.14)) | ((y > 1.36) & (y <= 1.5) & (np.abs(x) < 0.07)))
    for i in range(n):
        if head[i]:
            if facebox[i]: Zs[i] = Z['face']
            elif beret[i] and y[i] > 1.58: Zs[i] = Z['beret']
            elif bowc[i] and y[i] > 1.6 and x[i] > 0.08 and not skin[i]: Zs[i] = Z['bow']
            elif skin[i] and not hair[i]:
                Zs[i] = Z['ears'] if (abs(x[i]) > 0.168 and z[i] < 0.06) else Z['face']
            elif hair[i] or not skin[i]:
                Zs[i] = Z['hair_back'] if (bn[i] == 'hair' or y[i] < 1.36) else Z['hair_skull']
            else: Zs[i] = Z['face']
        elif hand[i] and bn[i] == 'hand_R' and y[i] < 0.735 and not skin[i]: Zs[i] = Z['mag']
        elif hand[i]: Zs[i] = Z['hands'] if (skin[i] or not coat[i]) else (Z['cuff'] if y[i] > CUFF_Y[0] else Z['sleeve'])
        elif hair[i] and y[i] > 0.85 and not navy[i] and (abs(x[i]) > 0.1 or z[i] < -0.02 or y[i] > 1.22): Zs[i] = Z['hair_back']
        elif foot[i] or y[i] < 0.11: Zs[i] = Z['shoes']
        elif navy[i] or (y[i] < 0.6 and np.isin(bn[i], ['shin_L', 'shin_R', 'thigh_L', 'thigh_R']) and not coat[i]): Zs[i] = Z['legs']
        elif skin[i] and not coat[i]: Zs[i] = Z['neck'] if y[i] > 1.05 else Z['hands']
        elif arm[i]: Zs[i] = Z['cuff'] if (CUFF_Y[0] < y[i] < CUFF_Y[1] and L[i] < 66) else Z['sleeve']
        elif y[i] < 0.80 or bn[i] in ('coat_L', 'coat_R'): Zs[i] = Z['coat_skirt']
        elif BELT_Y[0] < y[i] < BELT_Y[1] and L[i] < 68 and z[i] > -0.06: Zs[i] = Z['belt']
        elif y[i] > 1.235 and abs(x[i]) < 0.19: Zs[i] = Z['collar']
        else: Zs[i] = Z['coat_torso']
    # пуговицы — по месту (выпуклые диски на груди и животе)
    for cx, cy in BUTTONS:
        sel = (np.hypot(x - cx, y - cy) < 0.0205) & (z > 0.06) & np.isin(Zs, [Z['coat_torso'], Z['coat_skirt'], Z['belt']])
        Zs[sel] = Z['buttons']
    # чистка: одиночные вершины-«крапинки» — в зону большинства соседей (кроме лица, лупы, пуговиц)
    nb = [[] for _ in range(n)]
    for t in I:
        for p_ in range(3):
            nb[t[p_]].append(t[(p_ + 1) % 3]); nb[t[p_]].append(t[(p_ + 2) % 3])
    keep = {Z['face'], Z['mag'], Z['buttons'], Z['ears']}
    for _ in range(2):
        Zn = Zs.copy()
        for i in range(n):
            if Zs[i] in keep or not nb[i]: continue
            vals = Zs[nb[i]]
            c = np.bincount(vals, minlength=len(NAMES))
            if c[Zs[i]] == 0:
                m = c.argmax()
                if m not in keep: Zn[i] = m
        Zs = Zn
    return Zs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default=os.path.join(ROOT, 'js', 'hero3d.js'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'js', 'hero_zones.js'))
    ap.add_argument('--debug', default='')
    o = ap.parse_args()
    P, UV, I, J, W, tex, bones, meta = load_model(o.model)
    Zs = classify(P, UV, I, J, W, tex, bones)
    cnt = np.bincount(Zs, minlength=len(NAMES))
    for k, nm in enumerate(NAMES):
        s = Zs == k
        if cnt[k]: print(f'{nm:11s} {cnt[k]:6d}  y[{P[s, 1].min():.3f},{P[s, 1].max():.3f}]')
    if o.debug:
        os.makedirs(o.debug, exist_ok=True)
        Zs.tofile(os.path.join(o.debug, 'zones.bin'))
    b64 = base64.b64encode(Zs.tobytes()).decode('ascii')
    js = ('/* СГЕНЕРИРОВАНО tools/hero_zones.py — руками не править. Зоны вершин 3D-героини (js/hero3d.js) для образов\n'
          '   (js/hero_outfits.js): HERO_ZONES.names[k] — имя зоны k, b64 — Uint8 на вершину (n вершин). */\n'
          'window.HERO_ZONES = ' + json.dumps({'v': 1, 'n': int(len(P)), 'tris': int(len(I)), 'names': NAMES}, ensure_ascii=False)[:-1]
          + ', "b64": "' + b64 + '"};\n')
    open(o.out, 'w', encoding='utf-8').write(js)
    print('->', o.out, len(js), 'bytes')


if __name__ == '__main__':
    main()
