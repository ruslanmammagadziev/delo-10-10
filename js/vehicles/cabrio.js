/* =====================================================================
   ТРАНСПОРТ: жёлтый кабриолет (W7, желание автора «сделать прям как 911») — кузов городской машинки js/world/car.js.
   Силуэт классической заднемоторной спортивной машины с открытым верхом по двум фото автора (сзади и спереди, 3/4):
   низкий капот между крыльями, круглые фары на крыльях, ветровое стекло в чёрной рамке, короткий свес спереди и длинная
   покатая корма с «утиным хвостом» (губка на конце крышки мотора) и решёткой, широкие задние «бёдра» над колёсами, фонари
   на углах кормы, две овальные трубы, колёса-пятилучи вровень с крыльями, сложенный мягкий верх (чёрный чехол за задними
   местами), чёрный салон (спортивные кресла с подголовниками, пять круглых приборов, трёхспицевый руль).
   БЕЗ значков, гербов, надписей и цифр модели; номер пустой. Цвет по умолчанию — жёлтый (WORLD.CAR_COLORS[0]);
   подпись в игре — «Жёлтый кабриолет». Сзади маленький диванчик — места кота и собачки; на пассажирском кресле — папка «дела».
   Строится кодом (Three.js r149, офлайн). Кузов — «лофт» по сечениям: ключевые сечения по длине (полуширина борта и пять
   точек верха), между ними — монотонные кривые; борт по общей форме (низ подобран, выпуклость, завал к плечу); колёсные арки —
   вырез в низу сечения (у внутренней стенки ниши); нос и корма — сечения, сходящиеся к центру (скруглённые бамперы).
   5 вызовов отрисовки: краска · контур · отделка (SkinnedMesh: кость кузова и кость руля) · стекло · колёса (4 инстанса).

   Оси (как у машинки города): +z — вперёд, +x — влево (сторона водителя), y — вверх, y = 0 — земля.
   Размеры: длина 4,0 (z −2,02…1,98), ширина 1,86 (по задним «бёдрам»), верх рамки стекла 1,32; база 2,18 (оси z +1,13 / −1,05),
   колея 1,44 / 1,52, R колеса 0,33 (диски-пятилучи крупные, шины низкие). Места (героиня, кот, собачка), двери и коробки
   для ходьбы (js/move.js PROFILES.coupe) — как у прежнего купе: HeroAnim — прежняя поза «как на стуле», driveInput() без seat.
   ≈ 21,5 тыс. треугольников вместе с контуром и колёсами.

   API
     VEHICLES.cabrio.build(H, o) → кузов для WORLD.makeCar (H — набор строителя города WORLD.createKit):
       o = { color ('#FCD93A'), root, body } — сетки встают в body (колёса — в root), только когда всё построено
       → { paintMesh, outline, trimMesh (SkinnedMesh: кость 0 — кузов, 1 — руль), boneWheel, glass, plate (null),
           wheels (InstancedMesh ×4), WP [[x, z] ×4: FL, FR, RL, RR], WR, WB { f, r }, TRACK, WHEEL_C, COL_AX,
           seats { heroSeat, seatDriver, seatPass, seatDog, doorL, doorR } (Vector3, оси body), cockpit, lamps { head, tail },
           dims, driveCfg (поля CFG VILLAGE.drive: wb, track, wf, wr, halfW, halfL, wheelR), stats { tris, verts }, setColor(hex) }
     VEHICLES.cabrio.COCKPIT · HERO_SEAT · WHEEL_C · TILT · WHEEL_RAD · COLOR — те же числа без постройки
     car.cockpit (WORLD.makeCar кладёт его в машину) — для вида «из-за руля» (оси car.body):
       { eye: [x, y, z] — глаза героини за рулём, wheel: { c: [x, y, z] — центр руля, r — радиус, tilt — наклон плоскости руля
         от вертикали (рад; верх руля дальше от героини), axis: [x, y, z] — ось колонки к приборам },
         gripL / gripR: [x, y, z] — руки на ободе «на 10 и 2» при прямом руле (gripL — левая рука, +x) }
       У седана то же поле (js/vehicles/sedan.js).
   Подключение: после three.min.js, world/kit.js; до или после world/car.js (makeCar ищет VEHICLES.cabrio при постройке).
   ===================================================================== */
(function () {
  'use strict';
  const VEH = window.VEHICLES = window.VEHICLES || {};
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // монотонная кубическая кривая по ключам [[x, y], …] (x по возрастанию): без выбросов между ключами (как в sedan.js)
  function mono(keys) {
    const n = keys.length, X = keys.map(k => k[0]), Y = keys.map(k => k[1]), d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= X[0]) return Y[0];
      if (x >= X[n - 1]) return Y[n - 1];
      let i = 0; while (x > X[i + 1]) i++;
      const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  // центростремительный сплайн Катмулла — Рома (2D) на отрезке p1 → p2
  function crSeg(p0, p1, p2, p3, t) {
    const dd = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t1 = dd(p0, p1), t2 = t1 + dd(p1, p2), t3 = t2 + dd(p2, p3), u = t1 + (t2 - t1) * t;
    const L = (a, b, ta, tb) => { const k = (u - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
    return L(L(A1, A2, 0, t2), L(A2, A3, t1, t3), t1, t2);
  }

  /* ---------- место водителя и кабина ---------- */
  // корень героини за рулём и руль — как у прежнего купе (HeroAnim.DRIVE: руки «на 10 и 2», локти согнуты)
  const HERO_SEAT = [0.31, 0.2, 0.06], WHEEL_REL = [0, 0.92, 0.32], TILT = 0.95, WHEEL_RAD = 0.17;
  const WHEEL_C = [HERO_SEAT[0] + WHEEL_REL[0], HERO_SEAT[1] + WHEEL_REL[1], HERO_SEAT[2] + WHEEL_REL[2]];
  const COLOR = '#FCD93A';
  // руки на ободе «на 10 и 2»: ±60° от верха руля (как HeroAnim: руки едут вместе с рулём)
  const grip = sd => [WHEEL_C[0] + sd * Math.sin(PI / 3) * WHEEL_RAD, WHEEL_C[1] + Math.cos(TILT) * Math.cos(PI / 3) * WHEEL_RAD, WHEEL_C[2] + Math.sin(TILT) * Math.cos(PI / 3) * WHEEL_RAD];
  // глаза героини за рулём — замер по скину (между глаз, у поверхности лица): +1,53 над корнем, +0,17 вперёд.
  // Верх рамки стекла (1,32) ниже глаз (1,73): героиня смотрит поверх стекла, как в мультяшном кабриолете
  const COCKPIT = { eye: [0.31, 1.73, 0.23], wheel: { c: WHEEL_C.slice(), r: WHEEL_RAD, tilt: TILT, axis: [0, -Math.sin(TILT), Math.cos(TILT)] }, gripL: grip(1), gripR: grip(-1) };

  /* ---------- чертёж кузова ---------- */
  const D = {
    zF: 1.98, zR: -2.02, wf: 1.13, wr: -1.05, tf: 0.72, tr: 0.76, WR: 0.33, archR: 0.41, yb: 0.26, xi: 0.5,
    ws0: [0.8, 0.9], ws1: [0.52, 1.32], wsW: [0.64, 0.585],      // ветровое: низ (z, y), верх (z, y), полуширина низ/верх
  };
  // ключевые сечения: [z, xs — наибольшая полуширина борта, 5 точек верха [x, y] от плеча борта к середине]
  // салон (−0,9…0,72): плечо → кромка двери → внутренняя стенка вниз → пол (пол и стенки закрыты чёрной отделкой)
  const KEYS = [
    // корма: «утиный хвост» (губка на конце крышки мотора), ямка перед ней; углы кормы скруглены вниз
    [-1.95, 0.79, [0.71, 0.73], [0.6, 0.79], [0.42, 0.855], [0.2, 0.893], [0, 0.9]],
    [-1.87, 0.84, [0.77, 0.75], [0.64, 0.805], [0.44, 0.866], [0.2, 0.9], [0, 0.906]],
    [-1.76, 0.88, [0.80, 0.77], [0.67, 0.812], [0.45, 0.845], [0.2, 0.862], [0, 0.865]],
    [-1.5, 0.915, [0.84, 0.80], [0.69, 0.85], [0.46, 0.912], [0.2, 0.955], [0, 0.962]],
    // задние «бёдра»; крышка мотора горбом выше крыльев (покатая корма, круглая в сечении)
    [-1.15, 0.93, [0.855, 0.825], [0.70, 0.88], [0.47, 0.95], [0.2, 0.99], [0, 0.998]],
    [-0.98, 0.915, [0.85, 0.84], [0.70, 0.895], [0.47, 0.96], [0.2, 0.99], [0, 0.995]],
    // салон: «талия» уже крыльев
    [-0.9, 0.89, [0.825, 0.88], [0.715, 0.918], [0.635, 0.89], [0.61, 0.62], [0, 0.5]],
    [-0.45, 0.85, [0.795, 0.875], [0.70, 0.915], [0.62, 0.887], [0.6, 0.62], [0, 0.5]],
    [0.1, 0.825, [0.775, 0.873], [0.685, 0.912], [0.612, 0.885], [0.595, 0.62], [0, 0.5]],
    [0.72, 0.835, [0.78, 0.873], [0.685, 0.91], [0.615, 0.885], [0.6, 0.62], [0, 0.5]],
    // капот между крыльями (крылья выше капота — фары на них); крылья и капот плавно опускаются к носу
    [0.8, 0.84, [0.785, 0.865], [0.655, 0.905], [0.45, 0.88], [0.2, 0.862], [0, 0.858]],
    [1.13, 0.86, [0.805, 0.84], [0.64, 0.885], [0.44, 0.83], [0.2, 0.785], [0, 0.778]],
    [1.5, 0.835, [0.78, 0.80], [0.62, 0.845], [0.42, 0.76], [0.2, 0.715], [0, 0.705]],
    [1.72, 0.785, [0.73, 0.745], [0.585, 0.785], [0.40, 0.69], [0.2, 0.65], [0, 0.643]],
    [1.86, 0.71, [0.66, 0.665], [0.53, 0.685], [0.38, 0.62], [0.2, 0.597], [0, 0.592]],
    [1.93, 0.63, [0.59, 0.60], [0.48, 0.612], [0.35, 0.582], [0.2, 0.573], [0, 0.57]],
  ];
  // форма борта по высоте (доля xs): низ подобран, выпуклость на 0,64, к плечу заваливается внутрь
  const SIDE = mono([[0.2, 0.84], [0.3, 0.885], [0.42, 0.955], [0.56, 0.995], [0.64, 1.0], [0.74, 0.98], [0.84, 0.945], [0.92, 0.91]]);
  // низ кузова: у бамперов выше (короче «стенка» носа и кормы)
  const ybAt = z => D.yb + 0.07 * sst(1.6, 1.95, z) + 0.09 * sst(1.5, 1.98, -z);
  const KZ = KEYS.map(k => k[0]);
  const fXS = mono(KEYS.map(k => [k[0], k[1]]));
  const fTOP = [0, 1, 2, 3, 4].map(i => [0, 1].map(c => mono(KEYS.map(k => [k[0], k[2 + i][c]]))));
  const archY = z => { let y = ybAt(z); [D.wf, D.wr].forEach(zc => { const dz = z - zc; if (Math.abs(dz) < D.archR) y = Math.max(y, D.WR + Math.sqrt(D.archR * D.archR - dz * dz)); }); return y; };
  // подразбиение отрезков сечения (борт 3 + верх 4): точек на половине — 1 + сумма
  const SUB = [1, 2, 2, 2, 3, 2, 2];
  // половина сечения на z: точки от низа борта (порог или верх арки) до середины верха
  function halfSection(z) {
    const zz = clamp(z, KZ[0], KZ[KZ.length - 1]), xs = fXS(zz), ya = archY(z);
    const top = fTOP.map(f => [f[0](zz), f[1](zz)]);
    top[4][0] = 0;
    const y4 = top[0][1], ctrl = [];
    [0, 0.36, 0.7].forEach(t => { const y = ya + (y4 - ya) * t; ctrl.push([xs * SIDE(y), y]); });
    top.forEach(p => ctrl.push(p));
    const n = ctrl.length, P = i => (i < 0 ? [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]] : i >= n ? [-ctrl[2 * n - 2 - i][0], ctrl[2 * n - 2 - i][1]] : ctrl[i]);
    const out = [ctrl[0].slice()];
    for (let i = 0; i < n - 1; i++) for (let s = 1; s <= SUB[i]; s++) out.push(crSeg(P(i - 1), P(i), P(i + 1), P(i + 2), s / SUB[i]));
    out[out.length - 1][0] = 0;
    return { pts: out, ya, xs };
  }
  // высота верха кузова в точке (z, x) и x борта на высоте y (для деталей на поверхности)
  function topY(z, x) {
    const h = halfSection(z).pts; let best = h[h.length - 1][1];
    for (let i = h.length - 1; i > 0; i--) { const a = h[i], b = h[i - 1]; if (Math.abs(x) >= a[0] && Math.abs(x) <= b[0]) { const k = (Math.abs(x) - a[0]) / Math.max(1e-5, b[0] - a[0]); best = a[1] + (b[1] - a[1]) * k; break; } }
    return best;
  }
  function sideX(z, y) {
    const h = halfSection(z).pts;
    for (let i = 0; i < h.length - 1; i++) { const a = h[i], b = h[i + 1]; if (y >= a[1] && y <= b[1]) { const k = (y - a[1]) / Math.max(1e-5, b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; } }
    return h[0][0];
  }
  // станции по длине: шаг ~5 см + края арок, переходы салона, губка; нос и корма — сходящиеся сечения
  function stations() {
    const zs = [];
    for (let z = -1.95; z <= 1.93 + 1e-6; z += 0.07) zs.push(z);
    [D.wf, D.wr].forEach(zc => [-1, -0.88, -0.6, -0.3, 0, 0.3, 0.6, 0.88, 1].forEach(k => zs.push(zc + k * D.archR)));
    [-0.98, -0.94, -0.9, 0.72, 0.76, 0.8, -1.87, -1.91, -1.76, 1.86, 1.93, -1.95].forEach(z => zs.push(z));
    zs.push(D.wf - D.archR - 0.004, D.wf + D.archR + 0.004, D.wr - D.archR - 0.004, D.wr + D.archR + 0.004);
    const s = zs.filter(z => z >= -1.95 - 1e-6 && z <= 1.93 + 1e-6).sort((a, b) => a - b), out = [];
    s.forEach(z => { if (!out.length || z - out[out.length - 1].z > 0.018) out.push({ z, k: 1 }); });
    const tail = [[-1.968, 0.86], [-1.988, 0.66], [-2.006, 0.4], [-2.02, 0]], nose = [[1.948, 0.86], [1.964, 0.66], [1.975, 0.4], [1.98, 0]];
    return tail.reverse().map(([z, k]) => ({ z, k, base: -1.95, c: [0, 0.64] })).concat(out, nose.map(([z, k]) => ({ z, k, base: 1.93, c: [0, 0.47] })));
  }

  // склейка геометрий (позиция, нормаль, цвет, свечение); skin — жёсткие веса скелета: [[geo, bone], …]
  function mergeGeos(T, list, skin) {
    let n = 0, ni = 0; list.forEach(([g]) => { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const names = ['position', 'normal', 'color', 'emis'], arr = {}; names.forEach(k => { arr[k] = new Float32Array(n * 3); });
    const si = skin ? new Uint16Array(n * 4) : null, sw = skin ? new Float32Array(n * 4) : null, idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let off = 0, io = 0;
    list.forEach(([g, bone]) => {
      const c = g.attributes.position.count;
      names.forEach(k => { if (g.attributes[k]) arr[k].set(g.attributes[k].array, off * 3); else if (k === 'color') arr[k].fill(1, off * 3, (off + c) * 3); });
      if (skin) for (let i = 0; i < c; i++) { si[(off + i) * 4] = bone || 0; sw[(off + i) * 4] = 1; }
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + off; } else for (let i = 0; i < c; i++) idx[io++] = off + i;
      off += c; g.dispose();
    });
    const mg = new T.BufferGeometry();
    names.forEach(k => mg.setAttribute(k, new T.BufferAttribute(arr[k], 3)));
    if (skin) { mg.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); mg.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); }
    mg.setIndex(new T.BufferAttribute(idx, 1)); mg.computeBoundingBox(); mg.computeBoundingSphere();
    return mg;
  }

  /* ---------- кузов-лофт: обшивка (борт → верх → борт) и низ (порог → ниша колеса → днище), у каждой свои нормали ---------- */
  function loftGeo(T) {
    const ST = stations();
    const skin = [], bot = [];
    let baseF = null, baseR = null;
    ST.forEach(st => {
      let hs;
      if (st.k === 1) hs = halfSection(st.z);
      else { if (st.base > 0) baseF = baseF || halfSection(st.base); else baseR = baseR || halfSection(st.base); hs = st.base > 0 ? baseF : baseR; }
      const sh = p => (st.k === 1 ? p : [st.c[0] + (p[0] - st.c[0]) * st.k, st.c[1] + (p[1] - st.c[1]) * st.k]);
      const H = hs.pts.map(sh), m = H.length, ring = [];
      for (let i = 0; i < m - 1; i++) ring.push([-H[i][0], H[i][1]]);
      for (let i = m - 1; i >= 0; i--) ring.push([H[i][0], H[i][1]]);
      skin.push({ z: st.z, ring });
      // низ: от левого (+x) порога к правому — обход в обратную сторону, чтобы грани смотрели наружу
      const ya = hs.pts[0][1], xr = hs.pts[0][0], xi = Math.min(D.xi, xr - 0.02);
      const yb = ybAt(st.k === 1 ? st.z : st.base);
      bot.push({ z: st.z, ring: [[xr, ya], [xi, ya], [xi, yb], [0, yb], [-xi, yb], [-xi, ya], [-xr, ya]].map(sh) });
    });
    // низ борта чуть темнее (тень под «порогом»: кузов кажется ниже), днище и ниши колёс — тёмные
    const grid = (rows, shade) => {
      const nr = rows.length, nc = rows[0].ring.length, pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3), idx = [];
      rows.forEach((r, i) => r.ring.forEach((p, j) => { const q = (i * nc + j) * 3, k = shade < 1 ? shade : 0.8 + 0.2 * sst(0.3, 0.52, p[1]); pos[q] = p[0]; pos[q + 1] = p[1]; pos[q + 2] = r.z; col[q] = col[q + 1] = col[q + 2] = k; }));
      for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('emis', new T.BufferAttribute(new Float32Array(nr * nc * 3), 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const gs = grid(skin, 1), gb = grid(bot, 0.26);
    // грани должны смотреть наружу: середина верха (капот) — нормаль вверх; иначе перевернуть обход
    const fix = (g, test) => { if (!test(g)) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); } };
    const nc = skin[0].ring.length, mid = (nc - 1) / 2, row = Math.floor(skin.length * 0.8);
    fix(gs, g => g.attributes.normal.getY(row * nc + mid) > 0);
    const ncb = bot[0].ring.length;
    fix(gb, g => g.attributes.normal.getY(row * ncb + 3) < 0);
    return [gs, gb];
  }

  /* ---------- колесо: шина и пятилучевой диск с обеих сторон (ось вдоль x), одна сетка на 4 инстанса ---------- */
  function wheelGeo(H) {
    const T = H.T, { keep, GEO, put, toon } = H, g = new T.Group(), R = D.WR;
    const rubber = toon('#2E2A31'), rim = toon('#DCDFE6'), rimD = toon('#9EA2AE'), dark = toon('#3E3A44'), disc = toon('#8A8790');
    const tire = keep(new T.LatheGeometry([[0.68, -0.13], [0.9, -0.13], [0.978, -0.095], [1, -0.03], [1, 0.03], [0.978, 0.095], [0.9, 0.13], [0.68, 0.13]].map(([r, y]) => new T.Vector2(r * R, y)), 14));
    put(g, tire, rubber, [0, 0, 0], null, [0, 0, PI / 2]);
    put(g, GEO.cylLo, disc, [0, 0, 0], [0.16, 0.03, 0.16], [0, 0, PI / 2]);
    const lip = keep(new T.TorusGeometry(0.232, 0.014, 3, 16));
    [-1, 1].forEach(s => {
      put(g, GEO.cyl, dark, [s * 0.1, 0, 0], [0.232, 0.02, 0.232], [0, 0, PI / 2]);
      put(g, lip, rim, [s * 0.118, 0, 0], null, [0, PI / 2, 0]);
      // пять широких спиц (без значка на ступице)
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * PI * 2 + PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        put(g, GEO.box, rim, [s * 0.118, ca * 0.132, sa * 0.132], [0.022, 0.19, 0.07], [a, 0, 0]);
        put(g, GEO.box, rimD, [s * 0.112, ca * 0.132, sa * 0.132], [0.012, 0.19, 0.034], [a, 0, 0]);
      }
      put(g, GEO.cyl, rim, [s * 0.124, 0, 0], [0.052, 0.022, 0.052], [0, 0, PI / 2]);
    });
    return H.geoOf(g);
  }

  /* =====================================================================
     ПОСТРОЙКА: H — набор строителя города; o = { color, root, body }
     ===================================================================== */
  function build(H, o = {}) {
    const T = H.T, { keep, GEO, put, rbox, toon } = H;
    const color = o.color || COLOR;
    const v3 = a => new T.Vector3(a[0], a[1], a[2]);
    const bar = (par, mat, a, b, r, geo) => {
      const p = v3(a), q = v3(b), d = q.clone().sub(p), L = d.length(), m = put(par, geo || GEO.cylLo, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [r, L, r]);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m;
    };

    /* --- краска: кузов-лофт + зеркала (цвет вершин белый, цвет краски — у материала) --- */
    const [gSkin, gBot] = loftGeo(T);
    const pods = new T.Group(), white = toon('#FFFFFF');
    [-1, 1].forEach(s => {
      const m = put(pods, GEO.sph, white, [s * 0.87, 0.99, 0.6], [0.06, 0.05, 0.105], [0, s * 0.18, s * -0.08]);
      m.castShadow = true;
    });
    // «утиный хвост»: губка-спойлер на конце крышки мотора (профиль сбоку, вытянут по ширине и уложен по горбу крышки)
    {
      const sh = new T.Shape(), P = [[-1.68, 0.0], [-1.78, 0.022], [-1.88, 0.05], [-1.945, 0.064], [-1.962, 0.056], [-1.95, 0.036], [-1.86, 0.018], [-1.74, -0.004]];
      sh.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(q => sh.lineTo(q[0], q[1])); sh.closePath();
      const W = 1.22, g = new T.ExtrudeGeometry(sh, { depth: W, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4, steps: 8 });
      g.rotateY(-PI / 2); g.translate(W / 2, 0, 0);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = clamp(gp.getZ(i), -1.95, -1.68); gp.setY(i, gp.getY(i) + topY(z, x) - 0.004); }
      g.computeVertexNormals(); keep(g);
      put(pods, g, white);
    }
    const paintGeo = keep(mergeGeos(T, [[gSkin], [gBot], [H.geoOf(pods)]]));
    const paintMat = H.addRim(toon('#FFFFFF', { vertexColors: true }), 0.9); paintMat.color.set(color);
    const paintMesh = new T.Mesh(paintGeo, paintMat); paintMesh.castShadow = true; paintMesh.receiveShadow = false; paintMesh.name = 'cabrioPaint';
    const outline = new T.Mesh(paintGeo, H.outlineMat); outline.castShadow = false; outline.raycast = () => {};

    /* --- отделка: салон, рамка стекла, фары, фонари, решётки, трубы — один меш с цветами вершин --- */
    const trim = new T.Group();
    const blk = toon('#2C2830'), blkL = toon('#3B3641'), blkD = toon('#211E25'), chrome = toon('#E9ECF2'), chromeD = toon('#A9ADB8');
    const lens = toon('#FFF7E2', { emissive: new T.Color('#FFE6A8'), emissiveIntensity: 0.8 }), led = toon('#FFFBF0', { emissive: new T.Color('#FFF4D6'), emissiveIntensity: 0.9 });
    const amber = toon('#F7B267', { emissive: new T.Color('#F09A3E'), emissiveIntensity: 0.45 }), tail = toon('#E2405E', { emissive: new T.Color('#D9304E'), emissiveIntensity: 0.5 }), tailD = toon('#9C2236', { emissive: new T.Color('#8A1A2C'), emissiveIntensity: 0.3 });
    const gauge = toon('#F6EFE4'), needle = toon('#E2405E'), plateM = toon('#FBF7F0');
    // простая коробка (12 граней) — для скрытого и мелкого; скруглённые rbox — только там, где видно форму
    const bx = (mat, x, y, z, w, h, d, rot) => put(trim, GEO.box, mat, [x, y, z], [w, h, d], rot);
    // салон: пол, щит под приборами, внутренние панели дверей, тоннель с рычагом
    bx(blkD, 0, 0.535, -0.08, 1.2, 0.05, 1.62);
    bx(blkD, 0, 0.73, 0.735, 1.2, 0.42, 0.07);
    [-1, 1].forEach(s => bx(blk, s * 0.585, 0.73, -0.08, 0.04, 0.35, 1.58));
    bx(blk, 0, 0.69, 0.2, 0.22, 0.3, 0.8);
    bar(trim, chromeD, [0, 0.82, 0.3], [0, 0.91, 0.27], 0.012); put(trim, GEO.sphLo, blkL, [0, 0.92, 0.268], [0.032, 0.032, 0.032]);
    // приборная панель: козырёк над пятью круглыми приборами (стрелки, без цифр и надписей)
    rbox(trim, blk, 0, 0.965, 0.68, 1.24, 0.11, 0.25, 0.04);
    rbox(trim, blk, 0.31, 1.035, 0.63, 0.52, 0.05, 0.14, 0.025);
    [[-0.17, 0.034], [-0.085, 0.04], [0, 0.05], [0.085, 0.04], [0.17, 0.034]].forEach(([dx, r]) => {
      const g = new T.Group(); g.position.set(0.31 + dx, 0.972 + (r - 0.034) * 0.6, 0.553); g.rotation.x = -0.18; trim.add(g);
      put(g, GEO.cylLo, chromeD, [0, 0, 0], [r + 0.008, 0.012, r + 0.008], [PI / 2, 0, 0]);
      put(g, GEO.cylLo, gauge, [0, 0, -0.004], [r, 0.012, r], [PI / 2, 0, 0]);
      put(g, GEO.box, needle, [r * 0.3, r * 0.15, -0.012], [r * 0.7, 0.006, 0.004], [0, 0, 0.5]);
    });
    // кресла: подушка, спинка с боковинами, подголовник; основание до пола
    [-1, 1].forEach(s => {
      const x = s * 0.31;
      bx(blkD, x, 0.73, -0.07, 0.36, 0.36, 0.36);
      rbox(trim, blk, x, 0.915, -0.06, 0.48, 0.075, 0.5, 0.035);
      [-1, 1].forEach(b => bx(blkL, x + b * 0.2, 0.945, -0.08, 0.08, 0.07, 0.44));
      rbox(trim, blk, x, 1.1, -0.3, 0.46, 0.42, 0.12, 0.05, [-0.16, 0, 0]);
      [-1, 1].forEach(b => bx(blkL, x + b * 0.205, 1.08, -0.27, 0.08, 0.38, 0.15, [-0.16, 0, 0]));
      rbox(trim, blk, x, 1.355, -0.345, 0.26, 0.13, 0.1, 0.045, [-0.16, 0, 0]);
    });
    // задние места (2+2): подушка и низкая спинка — места кота и собачки
    rbox(trim, blk, 0, 0.975, -0.67, 0.94, 0.075, 0.32, 0.035);
    bx(blkD, 0, 0.75, -0.67, 0.94, 0.4, 0.3);
    rbox(trim, blk, 0, 1.09, -0.85, 0.94, 0.25, 0.1, 0.045, [-0.2, 0, 0]);
    // сложенный мягкий верх под чехлом: чёрный валик поперёк за задними местами, складки
    bx(blkD, 0, 0.97, -0.975, 1.3, 0.13, 0.2);
    put(trim, keep(new T.CapsuleGeometry(0.07, 1.14, 3, 10)), blk, [0, 1.04, -0.99], null, [0, 0, PI / 2]);
    [-0.35, 0, 0.35].forEach(x => bx(blkL, x, 1.09, -0.985, 0.012, 0.04, 0.13));
    // папка «дела» на пассажирском кресле: картон, красная тесёмка, белая наклейка
    bx(toon('#E6C79C'), -0.31, 0.963, -0.03, 0.24, 0.026, 0.31, [0, 0.18, 0]);
    bx(toon('#C2405B'), -0.31, 0.978, -0.03, 0.245, 0.006, 0.022, [0, 0.18, 0]);
    bx(toon('#FFFDF9'), -0.335, 0.978, 0.04, 0.1, 0.004, 0.06, [0, 0.18, 0]);
    // ветровое стекло в чёрной рамке: стойки, верхняя перекладина (по изгибу стекла), низ
    const wsAt = (x, t) => { const z = D.ws0[0] + (D.ws1[0] - D.ws0[0]) * t, y = D.ws0[1] + (D.ws1[1] - D.ws0[1]) * t, hw = D.wsW[0] + (D.wsW[1] - D.wsW[0]) * t, u = x * hw; return [u, y, z - 0.07 * (u / 0.6) * (u / 0.6)]; };
    [-1, 1].forEach(s => bar(trim, blk, wsAt(s * 1.02, -0.02), wsAt(s * 1.02, 1.03), 0.028));
    for (let i = 0; i < 4; i++) { bar(trim, blk, wsAt(-1.02 + i * 0.51, 1.0), wsAt(-1.02 + (i + 1) * 0.51, 1.0), 0.028); bar(trim, blkD, wsAt(-1 + i * 0.5, 0.0), wsAt(-1 + (i + 1) * 0.5, 0.0), 0.02); }
    // зеркала: чёрная ножка от двери и зеркальце (корпус зеркала — в краске)
    [-1, 1].forEach(s => { bar(trim, blk, [s * 0.74, 0.91, 0.64], [s * 0.84, 0.98, 0.61], 0.015); put(trim, GEO.sphLo, toon('#BFD3E2'), [s * 0.865, 0.99, 0.555], [0.07, 0.038, 0.01]); });
    // фары: большие круглые, на передних крыльях, чуть смотрят вверх; хромовое кольцо, внутри тёмный отражатель,
    // светлая линза-прожектор в своём колечке и четыре точки дневных огней
    const heads = [], ringL = keep(new T.TorusGeometry(0.16, 0.026, 5, 20)), ringS = keep(new T.TorusGeometry(0.062, 0.012, 4, 12)), refl = toon('#57545F');
    [-1, 1].forEach(s => {
      const x = s * 0.57, z = 1.78, y = topY(z, x) - 0.03;
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.set(-0.3, s * 0.22, 0); trim.add(g);
      put(g, ringL, chrome, [0, 0, 0.016]);
      put(g, GEO.sph, refl, [0, 0, 0], [0.155, 0.155, 0.05]);
      put(g, ringS, chrome, [s * 0.02, -0.025, 0.046]);
      put(g, GEO.sphLo, lens, [s * 0.02, -0.025, 0.044], [0.058, 0.058, 0.016]);
      for (let i = 0; i < 4; i++) { const a = PI * 0.3 + i * 0.32; put(g, GEO.box, led, [s * Math.cos(a) * 0.112, Math.sin(a) * 0.112 - 0.01, 0.042], [0.03, 0.022, 0.01], [0, 0, s * a]); }
      heads.push([x, y + 0.02, z + 0.1]);
    });
    // перед: три заборника в бампере (широкий посередине, боковые с полосками огней), поворотники по углам
    rbox(trim, blkD, 0, 0.415, 1.955, 0.62, 0.13, 0.06, 0.045);
    bx(blk, 0, 0.415, 1.96, 0.56, 0.012, 0.05);
    [-1, 1].forEach(s => {
      rbox(trim, blkD, s * 0.46, 0.425, 1.918, 0.27, 0.13, 0.07, 0.04, [0, s * 0.45, 0]);
      bx(led, s * 0.46, 0.515, 1.916, 0.24, 0.022, 0.05, [0, s * 0.45, 0]);
      put(trim, GEO.sphLo, amber, [s * 0.63, 0.53, 1.82], [0.03, 0.022, 0.045], [0, s * 0.9, 0]);
    });
    // корма: фонари на углах (обнимают углы), между ними тёмная полоса; решётка на крышке мотора перед «утиным хвостом»
    const tails = [];
    [-1, 1].forEach(s => {
      rbox(trim, tail, s * 0.55, 0.755, -1.985, 0.3, 0.105, 0.05, 0.035, [0, s * -0.32, 0]);
      bx(tailD, s * 0.55, 0.755, -1.99, 0.27, 0.04, 0.05, [0, s * -0.32, 0]);
      rbox(trim, tail, s * 0.72, 0.755, -1.89, 0.13, 0.095, 0.05, 0.03, [0, s * -1.05, 0]);
      tails.push([s * 0.55, 0.76, -2.0]);
    });
    bx(blkL, 0, 0.762, -2.006, 0.62, 0.028, 0.03);
    for (let i = 0; i < 7; i++) { const z = -1.5 - i * 0.04, y = topY(z, 0) + 0.003; bx(blk, 0, y, z, 0.6, 0.014, 0.024, [0.1, 0, 0]); }
    // бампер сзади: тёмная полоса снизу, две овальные трубы, пустой номер в тёмной рамке (без букв и цифр)
    rbox(trim, blkD, 0, 0.4, -1.962, 1.12, 0.1, 0.06, 0.035);
    [-1, 1].forEach(s => [0.47, 0.5].forEach(y => bx(blkD, s * 0.56, y, -1.972, 0.16, 0.012, 0.03, [0, s * -0.42, 0])));
    // щель под «утиным хвостом»
    bx(blkD, 0, 0.858, -1.972, 0.74, 0.016, 0.02);
    const pipe = keep(new T.TorusGeometry(0.045, 0.012, 4, 12));
    [-1, 1].forEach(s => {
      const g = new T.Group(); g.position.set(s * 0.4, 0.4, -1.982); g.scale.set(1.6, 1.05, 1); trim.add(g);
      put(g, pipe, chrome, [0, 0, 0]);
      put(g, GEO.cylLo, blkD, [0, 0, 0.01], [0.042, 0.04, 0.042], [PI / 2, 0, 0]);
    });
    bx(blkD, 0, 0.57, -2.008, 0.45, 0.17, 0.02);
    rbox(trim, plateM, 0, 0.57, -2.016, 0.42, 0.145, 0.012, 0.016);
    // швы дверей, ручки
    [[0.68, 0.38, 0.88], [-0.52, 0.36, 0.9]].forEach(([z, y0, y1]) => [-1, 1].forEach(s => bar(trim, blkD, [s * (sideX(z, y0) + 0.004), y0, z], [s * (sideX(z, y1) + 0.004), y1, z], 0.0045)));
    [-1, 1].forEach(s => { const y = 0.83, z = -0.36, x = sideX(z, y) + 0.008; bx(chromeD, s * x, y, z, 0.02, 0.022, 0.13); });
    // руль и колонка — отдельной костью (крутится вместе с колёсами): чёрный обод, три серебристые спицы, гладкая ступица
    const WC = v3(WHEEL_C), COL_AX = new T.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
    const wheelPart = new T.Group();
    put(wheelPart, keep(new T.TorusGeometry(WHEEL_RAD, 0.022, 6, 24)), blk, [WC.x, WC.y, WC.z], null, [TILT, 0, 0]);
    // спицы на «9», «3» и «6 часов» (в плоскости руля: +y — верх обода)
    [0, PI, -PI / 2].forEach(d => { const g = new T.Group(); g.position.copy(WC); g.rotation.x = TILT; wheelPart.add(g); put(g, GEO.box, chromeD, [Math.cos(d) * 0.085, Math.sin(d) * 0.085, 0.004], [0.026, 0.15, 0.012], [0, 0, d - PI / 2]); });
    { const g = new T.Group(); g.position.copy(WC); g.rotation.x = TILT; wheelPart.add(g); put(g, GEO.cyl, blkL, [0, 0, 0.008], [0.048, 0.03, 0.048], [PI / 2, 0, 0]); }
    bar(wheelPart, blk, [WC.x, WC.y, WC.z], [WC.x + COL_AX.x * 0.3, WC.y + COL_AX.y * 0.3, WC.z + COL_AX.z * 0.3], 0.024);
    const trimGeo = keep(mergeGeos(T, [[H.geoOf(trim), 0], [H.geoOf(wheelPart), 1]], true));
    const trimMesh = new T.SkinnedMesh(trimGeo, H.emisPatch(toon('#FFFFFF', { vertexColors: true }), 'car'));
    const boneRoot = new T.Bone(), boneWheel = new T.Bone(); boneWheel.position.copy(WC); boneRoot.add(boneWheel); trimMesh.add(boneRoot);
    trimMesh.castShadow = true; trimMesh.receiveShadow = false; trimMesh.name = 'cabrioTrim';
    trimMesh.updateMatrixWorld(true); trimMesh.bind(new T.Skeleton([boneRoot, boneWheel]));
    { const bb = trimGeo.boundingBox.clone(), bbW = new T.Box3(), hv = new T.Vector3(); trimMesh.raycast = (rc, out) => { bbW.copy(bb).applyMatrix4(trimMesh.matrixWorld); if (rc.ray.intersectBox(bbW, hv)) { const d = rc.ray.origin.distanceTo(hv); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hv.clone(), object: trimMesh }); } }; }

    /* --- ветровое стекло: трапеция, чуть изогнута по ширине --- */
    const gg = new T.PlaneGeometry(2, 1, 8, 1), gp = gg.attributes.position;
    for (let i = 0; i < gp.count; i++) { const p = wsAt(gp.getX(i), gp.getY(i) + 0.5); gp.setXYZ(i, p[0], p[1], p[2]); }
    gg.computeVertexNormals(); gg.computeBoundingSphere(); keep(gg);
    const glass = new T.Mesh(gg, keep(new T.MeshBasicMaterial({ color: 0xE4F3FF, transparent: true, opacity: 0.34, depthWrite: false, side: T.DoubleSide })));
    glass.renderOrder = 3; glass.castShadow = false; glass.name = 'cabrioGlass';

    /* --- колёса: инстансы одной сетки (FL, FR, RL, RR) --- */
    const wheels = new T.InstancedMesh(wheelGeo(H), H.VC.front, 4);
    wheels.castShadow = true; wheels.frustumCulled = false; wheels.name = 'cabrioWheels';
    const WP = [[D.tf, D.wf], [-D.tf, D.wf], [D.tr, D.wr], [-D.tr, D.wr]];

    if (o.body) { o.body.add(paintMesh); o.body.add(outline); o.body.add(trimMesh); o.body.add(glass); }
    if (o.root) o.root.add(wheels);
    const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const halfW = 0.93, halfL = 2.0;
    return {
      kind: 'cabrio', paintMesh, outline, trimMesh, boneWheel, glass, plate: null, wheels, WP, WR: D.WR, WB: { f: D.wf, r: D.wr }, TRACK: D.tf,
      WHEEL_C: WC, COL_AX, wheelR: WHEEL_RAD, wheelTilt: TILT,
      seats: {
        heroSeat: v3(HERO_SEAT), seatDriver: new T.Vector3(HERO_SEAT[0], HERO_SEAT[1] + 0.64, HERO_SEAT[2] - 0.18),
        seatPass: new T.Vector3(-0.24, 1.03, -0.68), seatDog: new T.Vector3(0.24, 1.03, -0.68),
        doorL: new T.Vector3(1.45, 0, 0.0), doorR: new T.Vector3(-1.45, 0, 0.0),
      },
      cockpit: JSON.parse(JSON.stringify(COCKPIT)),
      lamps: { head: heads, tail: tails },
      dims: { length: D.zF - D.zR, width: halfW * 2, height: D.ws1[1], wheelBase: D.wf - D.wr, track: D.tf * 2, trackR: D.tr * 2, wheelR: D.WR, halfW, halfL, wf: D.wf, wr: D.wr, front: D.zF, rear: D.zR },
      driveCfg: { wb: +(D.wf - D.wr).toFixed(3), track: D.tf, wf: D.wf, wr: D.wr, halfW: 0.88, halfL, wheelR: D.WR },
      stats: { tris: Math.round(tris(paintGeo) * 2 + tris(trimGeo) + tris(gg) + tris(wheels.geometry) * 4), verts: paintGeo.attributes.position.count + trimGeo.attributes.position.count, calls: 5 },
      setColor(hex) { paintMat.color.set(hex); },
    };
  }

  VEH.cabrio = { build, COCKPIT, HERO_SEAT, WHEEL_C, TILT, WHEEL_RAD, COLOR, D, halfSection, topY, sideX, version: 1 };
})();
