#!/usr/bin/env python3
"""Авториг героини: скелет по сетке, отделение рук от пальто, веса, GLB со скином.

    python3 tools/rig_heroine.py ../model3d/out/heroine_game.glb ../model3d/out/heroine_rigged.glb
        [--bpy PATH_TO_BLENDER_PYTHON] [--no-heat] [--debug DIR]

Что делает (по шагам, всё воспроизводимо, без случайности):
 1. Читает облегчённую модель (одна сетка, 27k треугольников, одна JPEG-текстура), ставит ногами на y = 0
    и осью ног в x = z = 0 (как tools/hero_assets.py), сваривает вершины по позиции.
 2. Скелет из 22 костей с именами для игры (hips, spine, chest, neck, head, hair; shoulder/upperarm/forearm/
    hand, thigh/shin/foot, coat — с суффиксами _L/_R; L — левая рука героини, +x; в правой руке, −x, лупа).
    Суставы подобраны по срезам сетки (см. JOINTS). У всех костей покой без поворота: локальные оси совпадают
    с осями модели (x — влево от героини, y — вверх, z — вперёд), процедурной анимации так проще.
 3. Руки у модели местами срослись с пальто (предплечье у бедра 0.79–0.96 м, плечо у бока 1.05–1.12 м).
    Сегментация min-cut по двойственному графу граней (дешевле резать по вогнутым рёбрам — по «ложбинке»
    между рукавом и пальто), затем разрез сетки по этой ложбинке и две заплатки на каждый разрез:
    «внутренняя сторона рукава» и «бок пальто» (дугами по цилиндру руки и по корпусу). В покое заплатки
    спрятаны внутри, сетка снова замкнутая; когда рука отходит, видно ткань, а не дыру.
 4. Веса: автоматические по «теплу» костей в Blender (bone heat, `--bpy`), затем чистка по областям:
    руки — только цепочка руки (плечо смешивается с грудью), кисть и лупа — жёстко на кисть, ноги под
    пальто — только цепочка ноги, низ пальто — на кости-полы coat_L/coat_R (их поворачивает анимация вслед
    за бёдрами, так полы не рвутся между ног), волосы — голова сверху, кость hair снизу, берет и бант —
    жёстко на голову. Сглаживание по сетке (через разрезы не протекает), не больше 4 влияний.
    Без Blender (или `--no-heat`) корпус взвешивается по высоте — результат почти тот же.
 5. Пишет GLB: позиции float32, нормали int8, UV uint16 (KHR_mesh_quantization), JOINTS_0 uint8,
    WEIGHTS_0 uint8 (сумма ровно 255), та же JPEG-текстура, кости — узлы с понятными именами.
"""
import argparse, io, json, os, struct, subprocess, sys, tempfile
import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import maximum_flow, breadth_first_order

HERE = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ скелет (м, оси игры: ноги на 0, лицом к +z)
# (имя, родитель, голова, хвост) — хвост нужен только Blender для тепла; s = +1 левая сторона (+x)
def joints():
    J = [
        ('hips', None, (0, 0.86, 0.005), (0, 0.97, 0.015)),
        ('spine', 'hips', (0, 0.97, 0.015), (0, 1.10, 0.005)),
        ('chest', 'spine', (0, 1.10, 0.005), (0, 1.255, -0.005)),
        ('neck', 'chest', (0, 1.255, -0.005), (0, 1.335, -0.012)),
        ('head', 'neck', (0, 1.335, -0.012), (0, 1.85, -0.01)),
        ('hair', 'chest', (0, 1.40, -0.10), (0, 1.0, -0.32)),
    ]
    for s, sfx in ((1, '_L'), (-1, '_R')):
        J += [
            ('shoulder' + sfx, 'chest', (0.025 * s, 1.215, -0.01), (0.11 * s, 1.195, -0.012)),
            ('upperarm' + sfx, 'shoulder' + sfx, (0.11 * s, 1.195, -0.012), (0.155 * s, 1.0, -0.012)),
            ('forearm' + sfx, 'upperarm' + sfx, (0.155 * s, 1.0, -0.012), (0.212 * s, 0.79, -0.012)),
            ('hand' + sfx, 'forearm' + sfx, (0.212 * s, 0.79, -0.012), (0.235 * s, 0.65, -0.01)),
            ('thigh' + sfx, 'hips', (0.068 * s, 0.80, 0.0), (0.058 * s, 0.43, 0.0)),
            ('shin' + sfx, 'thigh' + sfx, (0.058 * s, 0.43, 0.0), (0.038 * s, 0.09, -0.005)),
            ('foot' + sfx, 'shin' + sfx, (0.038 * s, 0.09, -0.005), (0.045 * s, 0.02, 0.13)),
            ('coat' + sfx, 'hips', (0.068 * s, 0.82, 0.0), (0.10 * s, 0.55, 0.0)),
        ]
    return J

JOINTS = joints()
BONES = [j[0] for j in JOINTS]
BI = {n: i for i, n in enumerate(BONES)}
HEADS = np.array([j[2] for j in JOINTS], float)
TAILS = np.array([j[3] for j in JOINTS], float)

Y_CUT = 1.12          # выше этой высоты рукав и пальто не разрезаем: там плечо, веса смешиваются
ARM_CHAIN = lambda s: [np.array(p) for p in [(0.11 * s, 1.195, -0.012), (0.155 * s, 1.0, -0.012),
                                             (0.212 * s, 0.79, -0.012), (0.235 * s, 0.65, -0.01)]]
LEG_CHAIN = lambda s: [np.array(p) for p in [(0.068 * s, 0.80, 0.0), (0.058 * s, 0.43, 0.0),
                                             (0.038 * s, 0.09, -0.005), (0.045 * s, 0.02, 0.13)]]


def sstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ GLB чтение
def read_glb(path):
    b = open(path, 'rb').read()
    n = struct.unpack_from('<I', b, 12)[0]
    J = json.loads(b[20:20 + n])
    B = b[20 + n + 8:]

    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
        k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
        arr = np.frombuffer(B, dt, a['count'] * k, bv.get('byteOffset', 0) + a.get('byteOffset', 0))
        return arr.reshape(-1, k) if k > 1 else arr
    p = J['meshes'][0]['primitives'][0]
    P = acc(p['attributes']['POSITION']).astype(np.float64)
    N = acc(p['attributes']['NORMAL']).astype(np.float64)
    UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64)
    F = acc(p['indices']).reshape(-1, 3).astype(np.int64)
    bv = J['bufferViews'][J['images'][0]['bufferView']]
    jpg = B[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    mat = J['materials'][0]
    return P, N, UV, F, jpg, mat


def to_game(P):
    """Как в hero_assets.glb_pack: ноги на y = 0, ось ног (по голеням) — x = z = 0."""
    P = P.copy()
    P[:, 1] -= P[:, 1].min()
    shin = (P[:, 1] > 0.1) & (P[:, 1] < 0.45)
    P[:, 0] -= (P[shin, 0].min() + P[shin, 0].max()) / 2
    P[:, 2] -= (P[shin, 2].min() + P[shin, 2].max()) / 2
    return P


# ------------------------------------------------------------------ геометрия
def seg_dist(X, A, B):
    ab = B - A
    t = np.clip(((X - A) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(X - (A + t[:, None] * ab), axis=1), t


def chain_coord(X, C):
    """Расстояние до ломаной C и координата u (длина вдоль цепочки до ближайшей точки)."""
    best = np.full(len(X), np.inf); u = np.zeros(len(X)); acc = 0.0
    for i in range(len(C) - 1):
        d, t = seg_dist(X, C[i], C[i + 1])
        L = np.linalg.norm(C[i + 1] - C[i])
        m = d < best
        best[m] = d[m]; u[m] = acc + t[m] * L
        acc += L
    cum = np.concatenate([[0], np.cumsum([np.linalg.norm(C[i + 1] - C[i]) for i in range(len(C) - 1)])])
    return best, u, cum


def face_graph(V, F):
    nf = len(F)
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    ef = np.tile(np.arange(nf), 3)
    es = np.sort(e, 1)
    k = es[:, 0] * len(V) + es[:, 1]
    o = np.argsort(k, kind='stable'); ks = k[o]
    same = np.nonzero(ks[1:] == ks[:-1])[0]
    return ef[o[same]], ef[o[same + 1]], es[o[same]]


def face_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    a = np.linalg.norm(n, axis=1)
    return n / np.maximum(a[:, None], 1e-15), a / 2


def segment_arm(V, F, s):
    """min-cut по двойственному графу: True — грань рукава/кисти/лупы стороны s."""
    fa, fb, ea = face_graph(V, F)
    fn, _ = face_normals(V, F)
    fc = V[F].mean(1)
    L = np.linalg.norm(V[ea[:, 0]] - V[ea[:, 1]], axis=1)
    th = np.arccos(np.clip((fn[fa] * fn[fb]).sum(1), -1, 1))
    concave = ((fc[fb] - fc[fa]) * fn[fa]).sum(1) > 0
    w = np.where(concave, 0.02 + np.exp(-(th / 0.35) ** 2), 1.0)
    cap = np.maximum(1, np.round(L * w * 1e6)).astype(np.int32)
    C = ARM_CHAIN(s)
    dv, _, _ = chain_coord(V, C)
    ax = np.interp(V[:, 1], [0.65, 0.79, 1.0, 1.195], [0.235 * s, 0.212 * s, 0.155 * s, 0.11 * s])
    lat = (V[:, 0] - ax) * s
    dh, _ = seg_dist(V, C[2], C[3])
    Y = V[F][:, :, 1]
    arm_seed = np.all((dv[F] < 0.075) & (lat[F] > 0.012) & (Y < 1.12) & (Y > 0.6), 1) \
        | np.all((dh[F] < 0.05) & (lat[F] > -0.005), 1)
    body_seed = np.all(dv[F] > 0.11, 1)
    nf = len(F); S, T = nf, nf + 1
    big = np.int32(2 ** 30)
    a_idx = np.nonzero(arm_seed)[0]; b_idx = np.nonzero(body_seed)[0]
    rows = np.concatenate([fa, fb, np.full(len(a_idx), S), b_idx])
    cols = np.concatenate([fb, fa, a_idx, np.full(len(b_idx), T)])
    caps = np.concatenate([cap, cap, np.full(len(a_idx), big), np.full(len(b_idx), big)]).astype(np.int32)
    G = sp.csr_matrix((caps, (rows, cols)), shape=(nf + 2, nf + 2))
    G.sum_duplicates()
    r = maximum_flow(G, S, T)
    R = (G - r.flow).tocsr(); R.data[R.data < 0] = 0; R.eliminate_zeros()
    lab = np.zeros(nf + 2, bool)
    lab[breadth_first_order(R, S, directed=True, return_predecessors=False)] = True
    return lab[:nf]


# ------------------------------------------------------------------ разрез и заплатки
def split_along(V, F, cut_edges):
    """Разрезает сетку по рёбрам: у вершины на разрезе — по копии на каждый «веер» граней.
    Возвращает новые V, F и src (из какой вершины сделана копия)."""
    cut = set(map(tuple, np.sort(np.asarray(cut_edges), 1).tolist()))
    vf = {}
    for f, tri in enumerate(F):
        for v in tri:
            vf.setdefault(int(v), []).append(f)
    cv = sorted({v for e in cut for v in e})
    V = list(map(tuple, V)); src = list(range(len(V)))
    F = F.copy()
    for v in cv:
        fs = vf[v]
        parent = {f: f for f in fs}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]; x = parent[x]
            return x
        # грани вокруг v, соседние через ребро (v, u), которое не режем
        by_u = {}
        for f in fs:
            for u in F[f]:
                u = int(u)
                if u != v:
                    by_u.setdefault(u, []).append(f)
        for u, ff in by_u.items():
            if tuple(sorted((v, u))) in cut:
                continue
            for f in ff[1:]:
                parent[find(f)] = find(ff[0])
        comps = {}
        for f in fs:
            comps.setdefault(find(f), []).append(f)
        groups = sorted(comps.values(), key=lambda g: -len(g))
        for g in groups[1:]:
            nv = len(V); V.append(V[v]); src.append(v)
            for f in g:
                F[f][F[f] == v] = nv
    return np.array(V), F, np.array(src)


def boundary_loops(F):
    """Петли границы (рёбра одной грани): список (вершины по порядку, грань каждого ребра)."""
    cnt = {}
    for f, t in enumerate(F):
        for i in range(3):
            a, b = int(t[i]), int(t[(i + 1) % 3])
            k = (min(a, b), max(a, b))
            cnt.setdefault(k, []).append((f, a, b))
    nxt = {}
    for k, lst in cnt.items():
        if len(lst) == 1:
            f, a, b = lst[0]
            nxt.setdefault(b, []).append((a, f))      # обходим дыру против хода грани
    loops, seen = [], set()
    for start in list(nxt.keys()):
        if start in seen:
            continue
        loop, fl, v = [], [], start
        while v not in seen:
            seen.add(v); loop.append(v)
            if len(nxt[v]) != 1:
                raise RuntimeError('неманифолдная граница у вершины %d' % v)
            v2, f = nxt[v][0]
            fl.append(f); v = v2
        loops.append((loop, fl))
    return loops


def resample_chain(P, n):
    """Точки ломаной P (m×3) по равным долям длины: (n×3) и доли исходных вершин."""
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    t = d / max(d[-1], 1e-12)
    q = np.linspace(0, 1, n)
    out = np.stack([np.interp(q, t, P[:, i]) for i in range(3)], 1)
    return out, t


def zipper(X, tx, Y, ty):
    """Полоса треугольников между цепочками X и Y (индексы) по параметрам tx, ty ∈ [0, 1]."""
    tris, i, j, p, q = [], 0, 0, len(X) - 1, len(Y) - 1
    while i < p or j < q:
        if j == q or (i < p and tx[i + 1] <= ty[j + 1]):
            t = (X[i], X[i + 1], Y[j]); i += 1
        else:
            t = (X[i], Y[j + 1], Y[j]); j += 1
        if len(set(t)) == 3:
            tris.append(t)
    return tris


def arc_points(a, b, c, axis, s):
    """Точка на дуге от a к b вокруг оси (c, axis), доля s; радиус — линейно."""
    ra = a - c; rb = b - c
    ra -= axis * (ra @ axis); rb -= axis * (rb @ axis)
    la, lb = np.linalg.norm(ra), np.linalg.norm(rb)
    if la < 1e-9 or lb < 1e-9:
        return a * (1 - s) + b * s
    ua, ub = ra / la, rb / lb
    om = np.arccos(np.clip(ua @ ub, -1, 1))
    if om < 1e-6:
        u = ua
    else:
        u = (np.sin((1 - s) * om) * ua + np.sin(s * om) * ub) / np.sin(om)
    h = (a - c) @ axis * (1 - s) + (b - c) @ axis * s
    return c + axis * h + u * (la * (1 - s) + lb * s)


def body_center(y):
    # центр корпуса по срезам (x = 0); z центра пальто чуть впереди оси ног
    return np.array([0.0, y, 0.025])


def arm_center(s, y):
    C = ARM_CHAIN(s)
    ys = [c[1] for c in C][::-1]; xs = [c[0] for c in C][::-1]; zs = [c[2] for c in C][::-1]
    return np.array([np.interp(y, ys, xs), y, np.interp(y, ys, zs)])


def build_patches(V, F, loops, face_side, face_arm):
    """Заплатки для каждой петли разреза. Возвращает новые вершины, грани заплаток и описание
    интерполяции весов: для каждой новой вершины — (i, j, s) = смесь весов вершин-краёв i и j."""
    newV, newF, interp, kinds = [], [], [], []
    nV = len(V)

    def add(p, rec):
        newV.append(p); interp.append(rec); return nV + len(newV) - 1

    for loop, fl in loops:
        loop = np.array(loop); fl = np.array(fl)
        is_arm = face_arm[fl]
        side = int(np.sign(np.median(V[loop, 0])))
        if is_arm.all() or (~is_arm).all():
            # замкнутый разрез: одна петля — одна заплатка; делим на две цепочки по верхней и нижней точке
            arm = bool(is_arm[0])
            top = int(np.argmax(V[loop, 1])); bot = int(np.argmin(V[loop, 1]))
            L = len(loop)
            ch1 = [loop[(top + i) % L] for i in range(((bot - top) % L) + 1)]
            ch2 = [loop[(top - i) % L] for i in range(((top - bot) % L) + 1)]
            groups = [(arm, ch1, ch2, None)]
        else:
            # открытый разрез (у подмышки): две губы — рукав и пальто, концы E1/E2 общие
            L = len(loop)
            k0 = [i for i in range(L) if is_arm[i] != is_arm[i - 1]]
            if len(k0) != 2:
                raise RuntimeError('ожидались 2 конца разреза, а их %d' % len(k0))
            lips = []
            for a, b in ((k0[0], k0[1]), (k0[1], k0[0])):
                idx = [(a + i) % L for i in range(((b - a) % L) + 1)]
                lips.append((bool(is_arm[idx[0]]), [loop[i] for i in idx]))
            # общая верхняя перекладина E1–E2
            E1, E2 = lips[0][1][0], lips[0][1][-1]
            nr = max(1, int(np.ceil(np.linalg.norm(V[E1] - V[E2]) / 0.012)) - 1)
            rung = [E1] + [add(V[E1] * (1 - q) + V[E2] * q, (E1, E2, q)) for q in np.linspace(0, 1, nr + 2)[1:-1]] + [E2]
            groups = []
            for arm, lip in lips:
                bot = int(np.argmin(V[lip, 1]))
                chA = lip[:bot + 1]                       # от своего конца вниз
                chB = lip[bot:][::-1]                     # от другого конца вниз
                if chA[0] != rung[0]:
                    groups.append((arm, chA, chB, rung[::-1]))
                else:
                    groups.append((arm, chA, chB, rung))
        for arm, chA, chB, rung in groups:
            A = V[chA]; B = V[chB]
            m = max(len(chA), len(chB), 3)
            Ar, tA = resample_chain(A, m)
            Br, tB = resample_chain(B, m)
            width = np.max(np.linalg.norm(Ar - Br, axis=1))
            k = int(np.clip(np.ceil(width / 0.011), 1, 6)) if rung is None else len(rung) - 2   # внутренних цепочек
            chains = [(list(chA), tA)]
            prev_w = None
            for j in range(1, k + 1):
                s_ = j / (k + 1)
                ids, ts = [], np.linspace(0, 1, m)
                for i in range(m):
                    if i == m - 1 and chA[-1] == chB[-1]:
                        ids.append(chA[-1]); continue
                    if i == 0 and rung is None and chA[0] == chB[0]:
                        ids.append(chA[0]); continue
                    if i == 0 and rung is not None:
                        # начало внутренней цепочки — на перекладине
                        ids.append(rung[j]); continue
                    a, b = Ar[i], Br[i]
                    y = (a[1] + b[1]) / 2
                    if arm:
                        c = arm_center(side, y); ax = ARM_CHAIN(side)
                        axis = ax[1] - ax[0] if y > 1.0 else ax[2] - ax[1]
                    else:
                        c = body_center(y); axis = np.array([0, 1.0, 0])
                    axis = axis / np.linalg.norm(axis)
                    p = arc_points(a, b, c, axis, s_)
                    # веса: смесь ближайших вершин двух цепочек
                    ia = chA[int(np.clip(np.searchsorted(tA, ts[i]), 0, len(chA) - 1))]
                    ib = chB[int(np.clip(np.searchsorted(tB, ts[i]), 0, len(chB) - 1))]
                    ids.append(add(p, (ia, ib, s_)))
                chains.append((ids, ts))
            chains.append((list(chB), tB))
            tris = []
            for (X, tx), (Y, ty) in zip(chains[:-1], chains[1:]):
                tris += zipper(X, tx, Y, ty)
            # верхний край: если цепочки начинаются на перекладине — между началами уже есть рёбра rung
            for t in tris:
                newF.append(t); kinds.append((arm, side))
    return np.array(newV).reshape(-1, 3), np.array(newF, np.int64).reshape(-1, 3), interp, kinds


# ------------------------------------------------------------------ веса
def heat_weights_bpy(bpy_python, V, F, debug=None):
    """Bone heat в Blender (отдельным процессом). None, если Blender нет или тепло не сошлось."""
    if not bpy_python or not os.path.exists(bpy_python):
        return None, 'нет Blender'
    with tempfile.TemporaryDirectory() as td:
        inp, out = os.path.join(td, 'in.npz'), os.path.join(td, 'out.npz')
        np.savez(inp, V=V, F=F, heads=HEADS, tails=TAILS, names=np.array(BONES),
                 parents=np.array([BI[j[1]] if j[1] else -1 for j in JOINTS]))
        r = subprocess.run([bpy_python, os.path.abspath(__file__), '--heat-stage', inp, out],
                           capture_output=True, text=True, timeout=900)
        log = r.stdout[-3000:] + r.stderr[-3000:]
        if debug:
            open(os.path.join(debug, 'heat.log'), 'w').write(r.stdout + '\n' + r.stderr)
        if r.returncode != 0 or not os.path.exists(out):
            return None, 'Blender: ошибка\n' + log
        d = np.load(out)
        return d['W'], d['msg'].item() if 'msg' in d else 'ok'


def heat_stage(inp, out):
    """Запускается под Python с bpy: тепло костей, веса в npz."""
    import bpy
    d = np.load(inp)
    V, F = d['V'], d['F']
    names = [str(n) for n in d['names']]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    me = bpy.data.meshes.new('heroine')
    me.from_pydata(V.tolist(), [], F.tolist())
    me.update()
    ob = bpy.data.objects.new('heroine', me)
    bpy.context.collection.objects.link(ob)
    am = bpy.data.armatures.new('rig')
    ao = bpy.data.objects.new('rig', am)
    bpy.context.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = []
    for i, n in enumerate(names):
        eb = am.edit_bones.new(n)
        eb.head = d['heads'][i].tolist(); eb.tail = d['tails'][i].tolist()
        eb.use_deform = True
        ebs.append(eb)
    for i, p in enumerate(d['parents']):
        if p >= 0:
            ebs[i].parent = ebs[p]; ebs[i].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True); ao.select_set(True)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    W = np.zeros((len(V), len(names)))
    gi = {g.index: names.index(g.name) for g in ob.vertex_groups if g.name in names}
    for v in me.vertices:
        for g in v.groups:
            if g.group in gi:
                W[v.index, gi[g.group]] = g.weight
    empty = int((W.sum(1) < 1e-6).sum())
    msg = 'bone heat: %d вершин, %d без весов' % (len(V), empty)
    print(msg)
    np.savez(out, W=W, msg=np.array(msg))


def laplacian(nv, F):
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    A = sp.coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(nv, nv)).tocsr()
    A.data[:] = 1
    deg = np.asarray(A.sum(1)).ravel()
    return sp.diags(1 / np.maximum(deg, 1)) @ A


def tex_sample(img, uv):
    S = img.shape[0]
    x = np.clip((uv[:, 0] * S).astype(int), 0, S - 1); y = np.clip((uv[:, 1] * S).astype(int), 0, S - 1)
    return img[y, x].astype(float)


def hsv(c):
    c = c / 255.0
    mx, mn = c.max(1), c.min(1); d = np.maximum(mx - mn, 1e-6)
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    H = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return H, S, mx


def compute_weights(V, F, vside, vcol, heat, is_patch):
    """vside: 0 — корпус/голова/ноги, +1/−1 — рука (рукав, кисть, лупа) стороны. vcol — цвет текстуры."""
    nv, nb = len(V), len(BONES)
    W = np.zeros((nv, nb))
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    H, S, Vv = hsv(vcol)
    hairc = (H > 8) & (H < 52) & (S > 0.42) & (Vv < 0.82) & (Vv > 0.12)
    body = vside == 0
    # --- руки: цепочка
    rigid = np.zeros(nv, bool)
    for s, sfx in ((1, '_L'), (-1, '_R')):
        m = vside == s
        C = ARM_CHAIN(s)
        d, u, cum = chain_coord(V[m], C)
        uE, uW = cum[1], cum[2]
        hand = sstep(uW - 0.022, uW + 0.018, u)
        fore = sstep(uE - 0.035, uE + 0.03, u) * (1 - hand)
        upper = 1 - hand - fore
        sh = (1 - sstep(0.0, 0.07, u)) * upper            # к плечу — часть на ключицу
        idx = np.nonzero(m)[0]
        W[idx, BI['hand' + sfx]] = hand
        W[idx, BI['forearm' + sfx]] = fore
        W[idx, BI['upperarm' + sfx]] = upper - sh * 0.45
        W[idx, BI['shoulder' + sfx]] = sh * 0.45
        rigid[idx[u > uW + 0.025]] = True                  # кисть (и лупа) — жёстко
    # --- ноги: под пальто, около оси ноги
    leg = np.zeros(nv, int)
    dLL = chain_coord(V, LEG_CHAIN(1))[0]; dLR = chain_coord(V, LEG_CHAIN(-1))[0]
    for s, sfx in ((1, '_L'), (-1, '_R')):
        C = LEG_CHAIN(s)
        d, u, cum = chain_coord(V, C)
        mine = (dLL < dLR) if s == 1 else (dLR <= dLL)      # своя нога — ближняя цепочка (ступни почти сходятся)
        # ниже подола (0.52 м) есть только ноги; у подола и в полости под пальто — тёмные колготки у оси ноги
        m = body & mine & ((y < 0.52) | ((y < 0.655) & (d < 0.085) & (Vv < 0.4)))
        # внутренняя оболочка пальто у подола дальше 8.5 см от оси ноги — не нога
        leg[m] = s
        idx = np.nonzero(m)[0]; uu = u[m]
        uK, uA = cum[1], cum[2]
        foot = sstep(uA - 0.03, uA + 0.015, uu)
        shin = sstep(uK - 0.045, uK + 0.045, uu) * (1 - foot)
        W[idx, BI['foot' + sfx]] = foot
        W[idx, BI['shin' + sfx]] = shin
        # верх бедра внутри пальто (выше подола) частью идёт за полой: бедро не протыкает пальто спереди,
        # излом прячется под подолом (приём «юбки»)
        a = 0.75 * sstep(0.47, 0.62, y[m])
        W[idx, BI['thigh' + sfx]] = (1 - foot - shin) * (1 - a)
        W[idx, BI['coat' + sfx]] = (1 - foot - shin) * a
        rigid[idx[uu > uK + 0.06]] = True
    # --- корпус: тепло костей (или высота), только кости корпуса и плеча
    torso_bones = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'upperarm_L', 'upperarm_R']
    tb = [BI[n] for n in torso_bones]
    tm = body & (leg == 0)
    if heat is not None:
        Wt = np.zeros((nv, nb)); Wt[:, tb] = heat[:, tb]
        # руки на корпусе — только у плечевого сустава
        for s, sfx in ((1, '_L'), (-1, '_R')):
            dsh = np.linalg.norm(V - HEADS[BI['upperarm' + sfx]], axis=1)
            k = 1 - sstep(0.06, 0.11, dsh)
            Wt[:, BI['upperarm' + sfx]] *= k
            Wt[:, BI['shoulder' + sfx]] *= 1 - sstep(0.09, 0.14, dsh)
        ok = Wt.sum(1) > 1e-4
    else:
        Wt = np.zeros((nv, nb)); ok = np.zeros(nv, bool)
    # запасной вариант (и там, где тепла нет): по высоте
    fb = np.zeros((nv, nb))
    a1 = sstep(0.90, 1.02, y); a2 = sstep(1.06, 1.18, y); a3 = sstep(1.24, 1.30, y); a4 = sstep(1.31, 1.36, y)
    fb[:, BI['hips']] = 1 - a1
    fb[:, BI['spine']] = a1 * (1 - a2)
    fb[:, BI['chest']] = a2 * (1 - a3)
    fb[:, BI['neck']] = a3 * (1 - a4)
    fb[:, BI['head']] = a4
    for s, sfx in ((1, '_L'), (-1, '_R')):
        dsh = np.linalg.norm(V - HEADS[BI['upperarm' + sfx]], axis=1)
        k = (1 - sstep(0.03, 0.09, dsh)) * (x * s > 0.07)
        fb[:, BI['upperarm' + sfx]] += k * 0.6
    use_fb = tm & ~ok
    Wt[use_fb] = fb[use_fb]
    Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    W[tm] = Wt[tm]
    # шея и голова: по высоте поверх тепла (тепло путает голову с волосами)
    neckz = tm & (y > 1.2)
    nb_ = np.zeros((nv, nb))
    nb_[:, BI['chest']] = 1 - sstep(1.245, 1.295, y)
    nb_[:, BI['head']] = sstep(1.315, 1.36, y)
    nb_[:, BI['neck']] = 1 - nb_[:, BI['chest']] - nb_[:, BI['head']]
    kk = sstep(1.2, 1.26, y)[:, None]
    W[neckz] = W[neckz] * (1 - kk[neckz]) + nb_[neckz] * kk[neckz]
    head = tm & (y > 1.36) & ~hairc
    W[head] = 0; W[head, BI['head']] = 1; rigid[head] = True
    # волосы: сверху голова, ниже — кость hair (её качает анимация), чуть груди у плеч
    hairm = tm & hairc & (y > 0.9) & ((z < 0.02) | (np.abs(x) > 0.2) | (y > 1.36))
    wh = sstep(1.26, 1.47, y)
    W[hairm] = 0
    W[hairm, BI['head']] = wh[hairm]
    W[hairm, BI['hair']] = (1 - wh[hairm]) * 0.85
    W[hairm, BI['chest']] = (1 - wh[hairm]) * 0.15
    # полы пальто: ниже бёдер — на кости-полы (поворот половиной бедра), центр поровну
    coat = tm & ~hairm & (y < 0.9)
    k = sstep(0.86, 0.6, y)
    gL = sstep(-0.09, 0.09, x)     # широкая полоса посередине: полы расходятся без ступеньки
    Wc = W[coat] * (1 - k[coat])[:, None]
    Wc[:, BI['coat_L']] += k[coat] * gL[coat]
    Wc[:, BI['coat_R']] += k[coat] * (1 - gL[coat])
    W[coat] = Wc
    # --- сглаживание: по связям сетки (через разрез не протекает), жёсткие части не трогаем
    Lm = laplacian(nv, F)
    free = ~rigid
    for it in range(6):
        Ws = Lm @ W
        W[free] = 0.5 * W[free] + 0.5 * Ws[free]
    # после сглаживания — запреты: на руке нет ног и пол, на ноге — нет рук, корпус без кистей
    for s, sfx in ((1, '_L'), (-1, '_R')):
        o = '_R' if s == 1 else '_L'
        for n in ('upperarm', 'forearm', 'hand', 'shoulder'):
            W[vside == -s, BI[n + sfx]] = 0
        W[body, BI['hand' + sfx]] = 0
        W[body, BI['forearm' + sfx]] = 0
        W[leg == s, BI['thigh' + o]] = 0; W[leg == s, BI['shin' + o]] = 0; W[leg == s, BI['foot' + o]] = 0
    W[leg == 0, BI['shin_L']] = 0; W[leg == 0, BI['shin_R']] = 0; W[leg == 0, BI['foot_L']] = 0; W[leg == 0, BI['foot_R']] = 0
    W[vside != 0, BI['thigh_L']] = 0; W[vside != 0, BI['thigh_R']] = 0
    W[vside != 0, BI['coat_L']] = 0; W[vside != 0, BI['coat_R']] = 0
    W[vside != 0, BI['hair']] = 0
    W = np.maximum(W, 0)
    lost = W.sum(1) < 1e-6
    if lost.any():          # страховка: ближайшая кость (по отрезку голова–хвост)
        D = np.stack([seg_dist(V[lost], HEADS[i], TAILS[i])[0] for i in range(nb)], 1)
        W[np.nonzero(lost)[0], D.argmin(1)] = 1
    W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
    return W, dict(leg=leg, hair=hairm, rigid=rigid)


def limit4(W):
    idx = np.argsort(-W, 1)[:, :4]
    w = np.take_along_axis(W, idx, 1)
    w[w < 0.01] = 0
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    q = np.floor(w * 255 + 0.5).astype(int)
    diff = 255 - q.sum(1)
    q[np.arange(len(q)), 0] += diff                    # сумма ровно 255 (самому большому)
    idx = np.where(q > 0, idx, 0)
    return idx.astype(np.uint8), q.astype(np.uint8)


# ------------------------------------------------------------------ GLB запись
def write_glb(path, P, N, UV, F, J4, W4, jpg, mat):
    chunks, views = [], []

    def add(data, target=None, stride=None):
        off = sum(len(c) for c in chunks)
        chunks.append(data + b'\0' * ((4 - len(data) % 4) % 4))
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        if stride: v['byteStride'] = stride
        views.append(v)
        return len(views) - 1
    Nn = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    Nq = np.zeros((len(N), 4), np.int8); Nq[:, :3] = np.round(Nn * 127)
    UVq = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
    vP = add(P.astype(np.float32).tobytes(), 34962)
    vN = add(Nq.tobytes(), 34962, 4)
    vU = add(UVq.tobytes(), 34962)
    vJ = add(J4.tobytes(), 34962)
    vW = add(W4.tobytes(), 34962)
    vI = add(F.astype(np.uint16 if len(P) < 65536 else np.uint32).reshape(-1).tobytes(), 34963)
    # кости: локальные смещения, покой без поворота; IBM — перенос на −голова
    ibm = np.zeros((len(BONES), 16), np.float32)
    for i in range(len(BONES)):
        m = np.eye(4); m[:3, 3] = -HEADS[i]
        ibm[i] = m.T.reshape(-1)                        # column-major
    vB = add(ibm.tobytes())
    vImg = add(jpg)
    nodes = [{'name': 'heroine', 'mesh': 0, 'skin': 0}]
    for i, (n, par, h, t) in enumerate(JOINTS):
        loc = np.array(h) - (np.array(HEADS[BI[par]]) if par else 0)
        nd = {'name': n, 'translation': [round(float(v), 6) for v in loc]}
        kids = [k + 1 for k, j in enumerate(JOINTS) if j[1] == n]
        if kids: nd['children'] = kids
        nodes.append(nd)
    g = {
        'asset': {'version': '2.0', 'generator': 'delo1010 tools/rig_heroine.py'},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': [0, 1]}],
        'nodes': nodes,
        'skins': [{'name': 'rig', 'joints': list(range(1, len(BONES) + 1)), 'inverseBindMatrices': 6, 'skeleton': 1}],
        'meshes': [{'name': 'heroine', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2, 'JOINTS_0': 3, 'WEIGHTS_0': 4}, 'indices': 5, 'material': 0}]}],
        'materials': [{'name': 'heroine', 'doubleSided': False, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': mat.get('pbrMetallicRoughness', {}).get('roughnessFactor', 0.85)}}],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': vImg, 'mimeType': 'image/jpeg', 'name': 'heroine_diffuse'}],
        'accessors': [
            {'bufferView': vP, 'componentType': 5126, 'count': len(P), 'type': 'VEC3',
             'min': P.min(0).astype(np.float32).tolist(), 'max': P.max(0).astype(np.float32).tolist()},
            {'bufferView': vN, 'componentType': 5120, 'normalized': True, 'count': len(P), 'type': 'VEC3'},
            {'bufferView': vU, 'componentType': 5123, 'normalized': True, 'count': len(P), 'type': 'VEC2'},
            {'bufferView': vJ, 'componentType': 5121, 'count': len(P), 'type': 'VEC4'},
            {'bufferView': vW, 'componentType': 5121, 'normalized': True, 'count': len(P), 'type': 'VEC4'},
            {'bufferView': vI, 'componentType': 5123 if len(P) < 65536 else 5125, 'count': int(F.size), 'type': 'SCALAR'},
            {'bufferView': vB, 'componentType': 5126, 'count': len(BONES), 'type': 'MAT4'},
        ],
        'bufferViews': views,
    }
    bin_ = b''.join(chunks)
    g['buffers'] = [{'byteLength': len(bin_)}]
    js = json.dumps(g, separators=(',', ':'), ensure_ascii=False).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js \
        + struct.pack('<II', len(bin_), 0x004E4942) + bin_
    open(path, 'wb').write(glb)
    return len(glb)


# ------------------------------------------------------------------ сборка
def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for i in range(3):
        np.add.at(N, F[:, i], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def rig(src, dst, bpy_python=None, debug=None):
    from PIL import Image
    if debug:
        os.makedirs(debug, exist_ok=True)
    P, N, UV, F, jpg, mat = read_glb(src)
    P = to_game(P)
    img = np.array(Image.open(io.BytesIO(jpg)).convert('RGB'))
    key = np.round(P / 1e-6).astype(np.int64)
    _, first, wid = np.unique(key, axis=0, return_index=True, return_inverse=True)
    wid = wid.ravel()
    V = P[first]; Fw = wid[F]
    info = {'src_tris': int(len(F)), 'src_verts': int(len(P)), 'welded': int(len(V))}
    # 1. руки: сегментация
    armL = segment_arm(V, Fw, 1); armR = segment_arm(V, Fw, -1)
    armR &= ~armL
    face_side = np.where(armL, 1, np.where(armR, -1, 0))
    # 2. разрез по ложбинке ниже Y_CUT
    fa, fb, ea = face_graph(V, Fw)
    bnd = (face_side[fa] != face_side[fb])
    cut = ea[bnd & (V[ea][:, :, 1].max(1) < Y_CUT)]
    info['cut_edges'] = int(len(cut))
    V2, F2, src_v = split_along(V, Fw, cut)
    loops = boundary_loops(F2)
    info['cut_loops'] = len(loops)
    face_arm = face_side != 0
    # 3. заплатки
    PV, PF, interp, kinds = build_patches(V2, F2, loops, face_side, face_arm)
    nV2 = len(V2)
    Vall = np.vstack([V2, PV])
    # грани заплаток — повернуть наружу: у рукава к корпусу, у пальто — к руке
    fixed = []
    for t, (arm, side) in zip(PF, kinds):
        a, b, c = Vall[t]
        n = np.cross(b - a, c - a); ctr = (a + b + c) / 3
        if arm:
            want = ctr - arm_center(side, ctr[1])         # внутренняя сторона рукава: наружу от оси руки, к корпусу
        else:
            want = ctr - body_center(ctr[1])               # бок пальто — наружу
        want[1] = 0
        fixed.append(t if n @ want >= 0 else t[::-1])
    PF = np.array(fixed, np.int64).reshape(-1, 3)
    Fall = np.vstack([F2, PF])
    info['patch_verts'] = int(len(PV)); info['patch_tris'] = int(len(PF))
    # проверка: сетка снова замкнутая
    try:
        rest = boundary_loops(Fall)
        info['open_loops_after'] = len(rest)
    except RuntimeError as e:
        info['open_loops_after'] = str(e)
    # сторона каждой вершины
    vside = np.zeros(len(Vall), int)
    for f, sd in enumerate(face_side):
        if sd:
            vside[F2[f]] = sd
    # вершины на неразрезанной части границы рукав/плечо: если у вершины есть грань корпуса — корпус
    body_v = np.zeros(len(Vall), bool); body_v[F2[face_side == 0].ravel()] = True
    vside[body_v] = 0
    for i, (arm, side) in enumerate(kinds):
        if arm:
            for v in PF[i]:
                if v >= nV2: vside[v] = side
    # цвет текстуры у сваренной вершины (по первой рендер-вершине)
    vcol = np.zeros((len(Vall), 3))
    vcol[:len(V)] = tex_sample(img, UV[first])
    vcol[len(V):nV2] = vcol[src_v[len(V):]]
    vcol[nV2:] = [200, 175, 140]
    is_patch = np.zeros(len(Vall), bool); is_patch[nV2:] = True
    # 4. тепло костей
    heat, msg = (None, 'выключено')
    if bpy_python:
        heat, msg = heat_weights_bpy(bpy_python, Vall, Fall, debug)
    info['heat'] = msg if heat is not None else 'нет: ' + str(msg)[:300]
    W, masks = compute_weights(Vall, Fall, vside, vcol, heat, is_patch)
    # веса заплаток — смесь краёв (по порядку создания: края уже посчитаны)
    for k, (i, j, s_) in enumerate(interp):
        W[nV2 + k] = W[i] * (1 - s_) + W[j] * s_
    # 5. рендер-вершины: исходные (UV, нормаль) по новой сварке + вершины заплаток
    corner_w = F2.reshape(-1)                         # сваренная вершина каждого угла исходных граней
    corner_r = F.reshape(-1)                          # исходная рендер-вершина угла
    pair = corner_r.astype(np.int64) * (len(Vall) + 1) + corner_w
    up, inv = np.unique(pair, return_inverse=True)
    r_src = up // (len(Vall) + 1); r_w = up % (len(Vall) + 1)
    RP = Vall[r_w]; RN = N[r_src]; RUV = UV[r_src]
    RF = inv.reshape(-1, 3)
    # заплатки: свои вершины (UV — тексель пальто изнутри), нормали по заплатке
    pv_ids = np.unique(PF)
    remap = {int(v): len(RP) + i for i, v in enumerate(pv_ids)}
    PN = vertex_normals(Vall, PF)
    # тексель: медианный по яркости цвет пальто у краёв разреза (чуть темнее — внутренняя сторона)
    lipv = np.unique(np.array([v for loop, _ in loops for v in loop]))
    lip_r = np.nonzero(np.isin(r_w, lipv))[0]
    cols = tex_sample(img, RUV[lip_r]); lum = cols @ [0.299, 0.587, 0.114]
    H_, S_, V_ = hsv(cols)
    good = (S_ > 0.12) & (S_ < 0.4) & (V_ > 0.55)
    cand = lip_r[good] if good.sum() > 10 else lip_r
    lumc = (tex_sample(img, RUV[cand]) @ [0.299, 0.587, 0.114])
    pick = cand[np.argsort(lumc)[int(len(cand) * 0.35)]]
    puv = RUV[pick].copy()
    info['patch_uv'] = puv.round(4).tolist(); info['patch_rgb'] = tex_sample(img, puv[None])[0].astype(int).tolist()
    RP = np.vstack([RP, Vall[pv_ids]]); RN = np.vstack([RN, PN[pv_ids]]); RUV = np.vstack([RUV, np.tile(puv, (len(pv_ids), 1))])
    RF = np.vstack([RF, np.vectorize(lambda v: remap[int(v)])(PF)])
    r_w_all = np.concatenate([r_w, pv_ids])
    J4, W4 = limit4(W[r_w_all])
    size = write_glb(dst, RP, RN, RUV, RF, J4, W4, jpg, mat)
    info.update({'verts': int(len(RP)), 'tris': int(len(RF)), 'bones': len(BONES), 'glb_bytes': size})
    if debug:
        os.makedirs(debug, exist_ok=True)
        np.savez(os.path.join(debug, 'rig_debug.npz'), V=Vall, F=Fall, W=W, vside=vside, face_side=face_side,
                 nV2=nV2, leg=masks['leg'], hair=masks['hair'], rigid=masks['rigid'], heads=HEADS, names=np.array(BONES))
    return info


def main():
    if '--heat-stage' in sys.argv:
        i = sys.argv.index('--heat-stage')
        heat_stage(sys.argv[i + 1], sys.argv[i + 2])
        return
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--bpy', default=os.path.join(HERE, '..', '..', 'glbprobe', 'bpyenv', 'bin', 'python'),
                    help='Python с модулем bpy (Blender) для bone heat')
    ap.add_argument('--no-heat', action='store_true', help='без Blender: корпус по высоте')
    ap.add_argument('--debug', help='папка для отладочных данных')
    a = ap.parse_args()
    info = rig(a.src, a.dst, None if a.no_heat else os.path.abspath(a.bpy), a.debug)
    print(json.dumps(info, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
