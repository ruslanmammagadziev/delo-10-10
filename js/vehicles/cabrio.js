/* =====================================================================
   ТРАНСПОРТ: жёлтый кабриолет (W7, желание автора: «как на фото» — современный заднемоторный спортивный кабриолет) —
   кузов городской машинки js/world/car.js. Всё по фото автора (3/4 спереди с опущенным верхом, перед крупно, корма с
   антикрылом, колёса), в мультяшном стиле игры:
   низкий длинный капот плавно спускается к низкому носу между острыми гребнями передних крыльев (между ними — ложбина);
   овальные фары вровень с наклонной площадкой крыла (вид спереди — наклонные овалы: тонкое светлое кольцо, тёмное нутро, линза
   и квадратом четыре точки ходовых огней); передний бампер с тремя крупными заборниками — широкая низкая трапеция посередине,
   по краям трапеции с двумя тонкими полосками огней вдоль верха, чёрная губа снизу; ветровое стекло в тонкой чёрной рамке,
   заметно завалено назад; низкая линия дверей; зеркала цвета кузова; широкие задние «бёдра» и чёрный заборник на заднем
   крыле за дверью; высокие чёрные пороги; чёрный салон, сложенный верх за креслами под чёрной крышкой. Корма: большое
   неподвижное антикрыло цвета кузова на двух стойках (плоскость со щёками по краям) над чёрной решёткой крышки мотора,
   красные фонари на углах (заходят на бока), в бампере — чёрные горизонтальные прорези, две круглые трубы посередине над
   чёрным диффузором. Колёса: серебристые, пять широких спиц (между ними просветы), низкие чёрные шины, жёлтые
   суппорты. Салон: низкие спортивные кресла со встроенными подголовниками, пять круглых приборов, трёхспицевый руль.
   БЕЗ значков, гербов, надписей и цифр модели; номер пустой. Цвет по умолчанию — жёлтый (WORLD.CAR_COLORS[0]);
   подпись в игре — «Жёлтый кабриолет». Кот и собачка едут на крышке за креслами; на пассажирском кресле — папка «дела».
   Строится кодом (Three.js r149, офлайн). Кузов — «лофт» по сечениям: ключевые сечения по длине (полуширина борта и пять
   точек верха), между ними — монотонные кривые; борт по общей форме (низ подобран, почти отвесный, к плечу завал внутрь);
   колёсные арки — вырез в низу сечения (у внутренней стенки ниши); нос и корма — сечения, сходящиеся к точке («лицо» бампера:
   почти плоское, края скруглены). Детали на кузове (заборники, фонари, решётки, пороги) ложатся по его поверхности
   (faceZ / sideX / topY), без щелей и провалов.
   5 вызовов отрисовки: краска (кузов, зеркала, антикрыло) · контур · отделка (SkinnedMesh: кость кузова и кость руля; фары —
   пятна по поверхности крыльев) · стекло · колёса (4 инстанса).

   Оси (как у машинки города): +z — вперёд, +x — влево (сторона водителя), y — вверх, y = 0 — земля.
   Размеры: длина 4,0 (z −2,02…1,98; трубы — до −2,04), ширина 1,86 (по задним «бёдрам»), верх рамки стекла 1,32; антикрыло —
   до 1,22; база 2,18 (оси z +1,13 / −1,05), колея 1,44 / 1,52, R колеса 0,355 (диски крупные, шины низкие); пороги 0,2 над
   землёй. Места (героиня, кот, собачка), двери и коробки для ходьбы (js/move.js PROFILES.coupe) — как у прежнего купе:
   HeroAnim — прежняя поза «как на стуле», driveInput() без seat.
   ≈ 26,7 тыс. треугольников вместе с контуром и колёсами. Дальний вид (setFar(1 | 2) — стоящая машина далеко, js/world/main.js
   carLod): те же сетки и вызовы, но кузов по сечениям через одно и без мелочей отделки (≈ 12,1 тыс. без контура), дальше —
   и колёса без спиц (≈ 8,8 тыс.).

   API
     VEHICLES.cabrio.build(H, o) → кузов для WORLD.makeCar (H — набор строителя города WORLD.createKit):
       o = { color ('#FCD93A'), root, body } — сетки встают в body (колёса — в root), только когда всё построено
       → { paintMesh, outline, trimMesh (SkinnedMesh: кость 0 — кузов, 1 — руль), boneWheel, glass, plate (null),
           wheels (InstancedMesh ×4), WP [[x, z] ×4: FL, FR, RL, RR], WR, WB { f, r }, TRACK, WHEEL_C, COL_AX,
           seats { heroSeat, seatDriver, seatPass, seatDog, doorL, doorR } (Vector3, оси body), cockpit, lamps { head, tail },
           dims, driveCfg (поля CFG VILLAGE.drive: wb, track, wf, wr, halfW, halfL, wheelR), stats { tris, verts }, setColor(hex),
           setNight(k 0..1) — фары ночью (WORLD.makeCar отдаёт его машине: car.setNight),
           setFar(0 | 1 | 2) — дальний вид: 1 — реже индекс кузова, отделка без мелочей; 2 — ещё и колёса без спиц
           (drawRange, без новых сеток; car.setFar) }
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
  const DEG = PI / 180;

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
  // колёса R 0,355 (крупные диски, низкие шины); арки: спереди R 0,405, сзади 0,398 (над шиной 5 / 4,3 см); пороги — 0,2
  const D = {
    zF: 1.98, zR: -2.02, wf: 1.13, wr: -1.05, tf: 0.72, tr: 0.76, WR: 0.355, archR: 0.405, archRR: 0.398, yb: 0.2, xi: 0.5,
    // ветровое: низ (z, y) посередине, верх (z, y), полуширина низ/верх (низ стекла по краям выше и дальше назад — на крыльях);
    // wsR — толщина тонкой чёрной рамки
    ws0: [0.86, 0.85], ws1: [0.52, 1.32], wsW: [0.64, 0.585], wsR: 0.016,
  };
  // ключевые сечения: [z, xs — наибольшая полуширина борта, 5 точек верха [x, y] от плеча борта к середине]
  // салон (−0,44…0,78): плечо → кромка двери → внутренняя стенка вниз → пол (пол и стенки закрыты чёрной отделкой)
  const KEYS = [
    // корма: широкий почти плоский зад; крышка мотора полого спускается к кромке, углы кормы скруглены вниз (там фонари)
    [-1.95, 0.848, [0.78, 0.79], [0.645, 0.845], [0.42, 0.864], [0.2, 0.87], [0, 0.872]],
    [-1.87, 0.888, [0.818, 0.805], [0.672, 0.858], [0.44, 0.878], [0.2, 0.884], [0, 0.886]],
    [-1.76, 0.905, [0.835, 0.822], [0.69, 0.874], [0.45, 0.893], [0.2, 0.9], [0, 0.902]],
    [-1.5, 0.925, [0.858, 0.858], [0.70, 0.908], [0.46, 0.924], [0.2, 0.933], [0, 0.935]],
    // задние «бёдра» — самое широкое место, плечо над колесом выше линии дверей; крышка мотора плавно переходит в крылья
    [-1.15, 0.93, [0.866, 0.876], [0.71, 0.93], [0.47, 0.953], [0.2, 0.965], [0, 0.968]],
    [-0.98, 0.925, [0.86, 0.878], [0.71, 0.93], [0.47, 0.966], [0.2, 0.985], [0, 0.988]],
    // крышка сложенного верха (чёрная — отделкой поверх): от спинок кресел до крышки мотора; кот и собачка — на ней
    [-0.9, 0.912, [0.847, 0.876], [0.708, 0.926], [0.47, 0.968], [0.2, 0.989], [0, 0.993]],
    [-0.7, 0.885, [0.818, 0.866], [0.70, 0.912], [0.47, 0.962], [0.2, 0.985], [0, 0.988]],
    [-0.48, 0.862, [0.798, 0.862], [0.70, 0.898], [0.47, 0.955], [0.2, 0.978], [0, 0.98]],
    // салон: «талия» уже крыльев, линия дверей низкая; открыт от спинок кресел до ветрового стекла
    [-0.44, 0.855, [0.79, 0.86], [0.70, 0.894], [0.62, 0.866], [0.6, 0.62], [0, 0.5]],
    [0.1, 0.826, [0.768, 0.856], [0.686, 0.888], [0.612, 0.862], [0.595, 0.62], [0, 0.5]],
    [0.78, 0.838, [0.778, 0.868], [0.69, 0.9], [0.615, 0.874], [0.6, 0.62], [0, 0.5]],
    // капот между крыльями: острые гребни передних крыльев стоят заметно выше капота (между ними — ложбина), капот —
    // пологий купол, длинно и низко спускается к носу; по краям капота ложбинки (там шов)
    [0.86, 0.852, [0.79, 0.876], [0.665, 0.912], [0.5, 0.856], [0.2, 0.848], [0, 0.846]],
    [1.13, 0.872, [0.815, 0.874], [0.655, 0.918], [0.47, 0.764], [0.2, 0.77], [0, 0.772]],
    [1.5, 0.866, [0.806, 0.856], [0.615, 0.9], [0.455, 0.67], [0.2, 0.672], [0, 0.674]],
    // фары: перед крыла — наклонная площадка ≈ 44° от гребня (z 1,62, y 0,88) до верха бампера (z 1,86, y 0,65),
    // в неё вровень вписана овальная фара; внутрь от неё — ложбинка капота; ниже и впереди — отвесный бампер
    [1.645, 0.856, [0.79, 0.84], [0.585, 0.862], [0.43, 0.64], [0.2, 0.64], [0, 0.641]],
    [1.70, 0.846, [0.78, 0.79], [0.575, 0.806], [0.42, 0.625], [0.2, 0.624], [0, 0.624]],
    [1.755, 0.82, [0.765, 0.735], [0.565, 0.75], [0.41, 0.608], [0.2, 0.606], [0, 0.606]],
    // нос в плане скруглён (уже к середине), низкий: верх бампера заметно ниже фар
    [1.86, 0.765, [0.705, 0.645], [0.525, 0.652], [0.38, 0.588], [0.2, 0.582], [0, 0.58]],
    [1.92, 0.70, [0.64, 0.6], [0.48, 0.592], [0.35, 0.565], [0.2, 0.556], [0, 0.554]],
  ];
  // нос и корма: последние сечения сходятся к точке c («лицо» бампера); k — доля сечения на станции z.
  // Нос — пологий купол (середина бампера на 6 см впереди углов), корма — почти плоская
  const NOSE = { base: 1.92, c: [0, 0.38], k: [[1, 1.92], [0.86, 1.94], [0.66, 1.958], [0.4, 1.972], [0, 1.98]] };
  const TAIL = { base: -1.95, c: [0, 0.58], k: [[1, -1.95], [0.86, -1.968], [0.66, -1.988], [0.4, -2.006], [0, -2.02]] };
  // фара на площадке переднего крыла (левая, +x): овал в плане — центр, полуоси (a — вдоль длинной оси), поворот длинной оси
  // (наружный конец дальше назад); лежит вровень с поверхностью крыла (вид спереди — наклонный овал)
  const LAMP = { x: 0.632, z: 1.724, a: 0.14, b: 0.098, yaw: 0.42 };
  // форма борта по высоте (доля xs): низ подобран, почти отвесно до плеча, к плечу заваливается внутрь
  const SIDE = mono([[0.15, 0.89], [0.25, 0.93], [0.38, 0.968], [0.52, 0.994], [0.62, 1.0], [0.72, 0.988], [0.82, 0.958], [0.92, 0.92]]);
  // низ кузова: у бамперов выше (спереди губа, сзади — диффузор под бампером)
  const ybAt = z => D.yb + 0.02 * sst(1.55, 1.95, z) + 0.11 * sst(1.46, 1.98, -z);
  const KZ = KEYS.map(k => k[0]);
  const fXS = mono(KEYS.map(k => [k[0], k[1]]));
  const fTOP = [0, 1, 2, 3, 4].map(i => [0, 1].map(c => mono(KEYS.map(k => [k[0], k[2 + i][c]]))));
  const archY = z => { let y = ybAt(z); [[D.wf, D.archR], [D.wr, D.archRR]].forEach(([zc, r]) => { const dz = z - zc; if (Math.abs(dz) < r) y = Math.max(y, D.WR + Math.sqrt(r * r - dz * dz)); }); return y; };
  // подразбиение отрезков сечения (борт 3 + верх 4): точек на половине — 1 + сумма
  const SUB = [1, 2, 2, 2, 3, 2, 2];
  // половина сечения на z: точки от низа борта (порог или верх арки) до середины верха (кэш: детали кузова спрашивают часто)
  const HS = new Map();
  function halfSection(z) {
    const key = Math.round(z * 1e4), hit = HS.get(key);
    if (hit) return hit;
    const zz = clamp(z, KZ[0], KZ[KZ.length - 1]), xs = fXS(zz), ya = archY(z);
    const top = fTOP.map(f => [f[0](zz), f[1](zz)]);
    top[4][0] = 0;
    // у носа низ борта подобран сильнее: нижние углы бампера скруглены («улыбка» спереди); у кормы — наоборот, низ
    // шире (задний бампер почти во всю ширину, «коробкой»)
    const y4 = top[0][1], ctrl = [], tuck = 0.075 * sst(1.5, 1.86, z) - 0.035 * sst(-1.45, -1.9, z);
    [0, 0.36, 0.7].forEach(t => { const y = ya + (y4 - ya) * t; ctrl.push([xs * SIDE(y) * (1 - tuck * (1 - sst(0.24, 0.52, y))), y]); });
    top.forEach(p => ctrl.push(p));
    const n = ctrl.length, P = i => (i < 0 ? [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]] : i >= n ? [-ctrl[2 * n - 2 - i][0], ctrl[2 * n - 2 - i][1]] : ctrl[i]);
    const out = [ctrl[0].slice()];
    for (let i = 0; i < n - 1; i++) for (let s = 1; s <= SUB[i]; s++) out.push(crSeg(P(i - 1), P(i), P(i + 1), P(i + 2), s / SUB[i]));
    out[out.length - 1][0] = 0;
    const res = { pts: out, ya, xs };
    HS.set(key, res);
    return res;
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
  // «лицо» носа или кормы: точка (x, y) лица лежит на луче из c к контуру сечения base; доля пути r → z по таблице k
  function faceZ(F) {
    if (F.fn) return F.fn;
    const h = halfSection(F.base).pts, yb = ybAt(F.base), P = [[0, yb], [h[0][0], yb]].concat(h.slice(1));
    const [cx, cy] = F.c, K = F.k;
    F.fn = (x, y) => {
      const dx = Math.abs(x) - cx, dy = y - cy;
      if (Math.abs(dx) + Math.abs(dy) < 1e-6) return K[K.length - 1][1];
      let t = Infinity;
      for (let i = 0; i < P.length - 1; i++) {
        const ax = P[i][0] - cx, ay = P[i][1] - cy, ex = P[i + 1][0] - P[i][0], ey = P[i + 1][1] - P[i][1], den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const tt = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
        if (tt > 0 && u >= -1e-6 && u <= 1 + 1e-6 && tt < t) t = tt;
      }
      const r = 1 / t;
      if (!(r < 1)) return K[0][1];
      for (let i = 0; i < K.length - 1; i++) if (r >= K[i + 1][0]) { const u = (K[i][0] - r) / (K[i][0] - K[i + 1][0]); return K[i][1] + (K[i + 1][1] - K[i][1]) * u; }
      return K[K.length - 1][1];
    };
    return F.fn;
  }
  // контур кузова в плане на высоте y (x ≥ 0): от середины «лица» (нос или корма) к углу и дальше по борту к середине машины
  const PLAN = new Map();
  function planAt(y, F) {
    const key = F.base + '|' + y.toFixed(4); let out = PLAN.get(key);
    if (out) return out;
    const fz = faceZ(F), xe = sideX(F.base, y), dir = Math.sign(F.base);
    out = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16, x = xe * (1 - (1 - u) * (1 - u)) * 0.9995; out.push([x, fz(x, y)]); }
    for (let z = F.base - dir * 0.03; Math.abs(z) > 0.4; z -= dir * 0.04) out.push([sideX(z, y), z]);
    PLAN.set(key, out);
    return out;
  }
  // луч в плане из O под углом φ (направление (cos φ, sin φ) в осях x, z) до контура: точка и нормаль наружу
  function hitPlan(poly, O, phi) {
    const dx = Math.cos(phi), dz = Math.sin(phi), sx = dx < 0 ? -1 : 1, ax = Math.abs(dx);
    let best = null;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1], ox = a[0] - O[0], oz = a[1] - O[1], ex = b[0] - a[0], ez = b[1] - a[1], den = ax * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (ox * ez - oz * ex) / den, u = (ox * dz - oz * ax) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) {
        const L = Math.hypot(ex, ez) || 1; let nx = ez / L, nz = -ex / L;
        if (nx * ax + nz * dz < 0) { nx = -nx; nz = -nz; }
        best = { t, x: sx * (O[0] + ax * t), z: O[1] + dz * t, nx: sx * nx, nz };
      }
    }
    return best;
  }
  // станции по длине: шаг ~7 см + края арок, переходы салона; нос и корма — сходящиеся сечения
  function stations() {
    const zs = [];
    for (let z = TAIL.base; z <= NOSE.base + 1e-6; z += 0.07) zs.push(z);
    [[D.wf, D.archR], [D.wr, D.archRR]].forEach(([zc, r]) => [-1, -0.95, -0.85, -0.6, -0.3, 0, 0.3, 0.6, 0.85, 0.95, 1].forEach(k => zs.push(zc + k * r)));
    [-0.98, -0.9, -0.48, -0.44, 0.78, 0.82, 0.86, -1.87, -1.91, -1.76, 1.86, NOSE.base, TAIL.base].forEach(z => zs.push(z));
    // «лицо» фар на передних крыльях круто опускается — там сечения чаще
    [1.645, 1.67, 1.7, 1.725, 1.755, 1.79, 1.82].forEach(z => zs.push(z));
    zs.push(D.wf - D.archR - 0.004, D.wf + D.archR + 0.004, D.wr - D.archRR - 0.004, D.wr + D.archRR + 0.004);
    const s = zs.filter(z => z >= TAIL.base - 1e-6 && z <= NOSE.base + 1e-6).sort((a, b) => a - b), out = [];
    s.forEach(z => { if (!out.length || z - out[out.length - 1].z > 0.018) out.push({ z, k: 1 }); });
    const tail = TAIL.k.slice(1).reverse().map(([k, z]) => ({ z, k, base: TAIL.base, c: TAIL.c }));
    const nose = NOSE.k.slice(1).map(([k, z]) => ({ z, k, base: NOSE.base, c: NOSE.c }));
    return tail.concat(out, nose);
  }
  // дальний вид: сечения через одно (шаг ≥ 0,13), но края и скругления арок, переходы салона, «лицо» фар, нос и корма — всегда
  function farRows(ST) {
    const must = [TAIL.base, -1.87, -0.98, -0.9, -0.48, -0.44, 0.78, 0.86, 1.645, 1.7, 1.755, 1.86, NOSE.base];
    [[D.wf, D.archR], [D.wr, D.archRR]].forEach(([zc, r]) => { [-1, -0.85, -0.6, 0, 0.6, 0.85, 1].forEach(k => must.push(zc + k * r)); must.push(zc - r - 0.004, zc + r + 0.004); });
    let last = -9;
    return ST.map((st, i) => {
      const keep = i === 0 || i === ST.length - 1 || st.k < 1 || st.z - last >= 0.13 || must.some(z => Math.abs(z - st.z) < 0.019);
      if (keep) last = st.z;
      return keep;
    });
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

  /* ---------- детали по поверхности кузова ---------- */
  // разворот обхода всех граней (с индексом или без), нормали — заново
  function flipTris(g) {
    const p = g.attributes.position;
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
    else for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); }
    g.computeVertexNormals();
    return g;
  }
  // перенос заготовки (a, b — по поверхности, w — толщина) функцией f(a, b, w) → [x, y, z]; если перенос зеркалит
  // (определитель < 0) — обход граней разворачивается, чтобы грани смотрели наружу
  function conform(T, g, f) {
    const p = g.attributes.position;
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new T.Vector3()), e = 1e-3, f0 = f(c.x, c.y, c.z);
    const J = [f(c.x + e, c.y, c.z), f(c.x, c.y + e, c.z), f(c.x, c.y, c.z + e)].map(q => [q[0] - f0[0], q[1] - f0[1], q[2] - f0[2]]);
    const det = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);
    for (let i = 0; i < p.count; i++) { const q = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); }
    ['normal', 'uv'].forEach(k => { if (g.attributes[k]) g.deleteAttribute(k); });
    if (det < 0) flipTris(g); else g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  // каждую грань — на 4 (деталь ложится на изогнутую поверхность без провалов)
  function split4(T, g) {
    const p = g.attributes.position, n = p.count, out = new Float32Array(n * 12); let o = 0;
    const v = i => [p.getX(i), p.getY(i), p.getZ(i)], m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let i = 0; i < n; i += 3) {
      const a = v(i), b = v(i + 1), c = v(i + 2), ab = m(a, b), bc = m(b, c), ca = m(c, a);
      [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca].forEach(q => { out[o++] = q[0]; out[o++] = q[1]; out[o++] = q[2]; });
    }
    const r = new T.BufferGeometry(); r.setAttribute('position', new T.BufferAttribute(out, 3)); g.dispose(); return r;
  }
  // плита по контуру (толщина d), sub — сколько раз дробить грани
  function slab(T, shape, d, sub) {
    let g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 3 }); ['normal', 'uv'].forEach(k => g.deleteAttribute(k));
    for (let i = 0; i < (sub || 0); i++) g = split4(T, g);
    return g;
  }
  // контуры деталей: многоугольник, скруглённый прямоугольник, многоугольник со скруглёнными углами (радиус r вдоль сторон)
  function pshape(T, pts) { const s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => s.lineTo(q[0], q[1])); s.closePath(); return s; }
  const rrect = (T, a0, b0, a1, b1, r) => rpoly(T, [[a0, b0], [a1, b0], [a1, b1], [a0, b1]], r);
  function rpoly(T, pts, r) {
    const s = new T.Shape(), n = pts.length, cut = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.min(d, L / 2) / L; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = cut(p, pts[(i + n - 1) % n], r), b = cut(p, pts[(i + 1) % n], r);
      if (i) s.lineTo(a[0], a[1]); else s.moveTo(a[0], a[1]);
      s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    }
    s.closePath();
    return s;
  }
  // переносы: на «лицо» носа/кормы (a = x, b = y), на борт (a = z, b = y; s — сторона)
  const onFace = (F, s, w0) => { const fz = faceZ(F), dir = Math.sign(F.base); return (a, b, w) => [s * a, b, fz(a, b) + dir * (w0 + w)]; };
  const onSide = (s, w0) => (a, b, w) => [s * (sideX(a, b) + w0 + w), b, a];
  // сетка по верху кузова (крышки, решётки — по сетке, чтобы не проваливаться на выпуклой крышке): x ∈ ±xw, z от z0 к z1,
  // над поверхностью на w
  function topGrid(T, xw, z0, z1, nx, nz, w) {
    const g = new T.PlaneGeometry(1, 1, nx, nz);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    return conform(T, g, (a, b, ww) => { const x = a * 2 * xw, z = z0 + (b + 0.5) * (z1 - z0); return [x, topY(z, x) + w + ww, z]; });
  }
  // овальное пятно фары по верху крыла (вровень с поверхностью, на w над ней): кольцо r0…r1 долей полуосей a × b вокруг точки
  // (cu, cv) в осях фары (u — вдоль длинной оси, v — поперёк); r0 = 0 — диск. Строится левая фара (+x), правая — mirrorX
  function lampPatch(T, cu, cv, a, b, r0, r1, w, nSeg, nRing) {
    const cs = Math.cos(LAMP.yaw), sn = Math.sin(LAMP.yaw), pos = [], idx = [], rs = [];
    const at = (u, v) => { const x = LAMP.x + u * cs + v * sn, z = LAMP.z - u * sn + v * cs; return [x, topY(z, x) + w, z]; };
    for (let i = 0; i <= nRing; i++) rs.push(r0 + (r1 - r0) * i / nRing);
    const disc = r0 === 0, base = disc ? 1 : 0;
    if (disc) { pos.push(...at(cu, cv)); rs.shift(); }
    rs.forEach(r => { for (let j = 0; j < nSeg; j++) { const t = j / nSeg * PI * 2; pos.push(...at(cu + Math.cos(t) * a * r, cv + Math.sin(t) * b * r)); } });
    const vi = (i, j) => base + i * nSeg + (j % nSeg);
    if (disc) for (let j = 0; j < nSeg; j++) idx.push(0, vi(0, j), vi(0, j + 1));
    for (let i = 0; i < rs.length - 1; i++) for (let j = 0; j < nSeg; j++) idx.push(vi(i, j), vi(i + 1, j), vi(i + 1, j + 1), vi(i, j), vi(i + 1, j + 1), vi(i, j + 1));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // грани — наружу (вверх по площадке)
    return g.attributes.normal.getY(base) < 0 ? flipTris(g) : g;
  }
  // полоса вдоль кузова (фонари, губа, пороги): pt(j, y) → { x, z, nx, nz } — точка поверхности и нормаль в плане;
  // на якоре j — высоты y0, y1; outF — вынос наружу (число или функция якоря), inn — уход внутрь кузова
  // (внутренней стенки нет — она в кузове)
  function band(T, n, pt, yy, outF, inn) {
    const pos = [], idx = [], V = [];
    for (let j = 0; j < n; j++) {
      const [y0, y1] = yy(j), p0 = pt(j, y0), p1 = pt(j, y1), out = typeof outF === 'function' ? outF(j) : outF;
      V.push({ O0: [p0.x + p0.nx * out, y0, p0.z + p0.nz * out], O1: [p1.x + p1.nx * out, y1, p1.z + p1.nz * out], I1: [p1.x - p1.nx * inn, y1, p1.z - p1.nz * inn], I0: [p0.x - p0.nx * inn, y0, p0.z - p0.nz * inn], n: [p0.nx, 0, p0.nz] });
    }
    const add = q => { pos.push(q[0], q[1], q[2]); return pos.length / 3 - 1; };
    // грани по кругу сечения: O0 → O1 (лицо), O1 → I1 (верх), I0 → O0 (низ); торцы — на первом и последнем якоре
    [['O0', 'O1'], ['O1', 'I1'], ['I0', 'O0']].forEach(([R, S]) => {
      const b = pos.length / 3; V.forEach(v => { add(v[R]); add(v[S]); });
      for (let j = 0; j < n - 1; j++) { const r0 = b + j * 2, s0 = r0 + 1, r1 = r0 + 2, s1 = r0 + 3; idx.push(r0, r1, s1, r0, s1, s0); }
    });
    [[0, ['O0', 'O1', 'I1', 'I0']], [n - 1, ['I0', 'I1', 'O1', 'O0']]].forEach(([j, ks]) => { const q = ks.map(k => add(V[j][k])); idx.push(q[0], q[1], q[2], q[0], q[2], q[3]); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    // обход граней: лицо полосы должно смотреть наружу (по нормали поверхности)
    const a = V[0].O0, b = V[1].O0, c = V[1].O1, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (nn[0] * V[0].n[0] + nn[2] * V[0].n[2] < 0) return flipTris(g);
    g.computeVertexNormals();
    return g;
  }
  // зеркальная копия по x (правая сторона)
  function mirrorX(T, g) {
    const m = g.clone(), p = m.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
    return flipTris(m);
  }
  // профиль (z, y), вытянутый поперёк машины на ширину W (по центру x = 0): антикрыло, щёки, стойки
  function extrudeX(T, pts, W, bevel) {
    const g = new T.ExtrudeGeometry(pshape(T, pts), { depth: W, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 4 });
    g.rotateY(-PI / 2); g.translate(W / 2, 0, 0); g.deleteAttribute('uv');
    return g;
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
      skin.push({ z: st.z, ring, k: st.k });
      // низ: от левого (+x) порога к правому — обход в обратную сторону, чтобы грани смотрели наружу
      const ya = hs.pts[0][1], xr = hs.pts[0][0], xi = Math.min(D.xi, xr - 0.02);
      const yb = ybAt(st.k === 1 ? st.z : st.base);
      bot.push({ z: st.z, k: st.k, ring: [[xr, ya], [xi, ya], [xi, yb], [0, yb], [-xi, yb], [-xi, ya], [-xr, ya]].map(sh) });
    });
    // низ борта чуть темнее (тень под «порогом»: кузов кажется ниже); днище и ниши колёс — тёмные, но на «лице» носа и кормы
    // (там низ сходится к точке c) — цвета кузова, тёмная только нижняя кромка (губа, диффузор)
    const cSkin = p => 0.8 + 0.2 * sst(0.28, 0.5, p[1]), cBot = (p, r) => (r.k === 1 ? 0.26 : 1);
    const grid = (rows, colF) => {
      const nr = rows.length, nc = rows[0].ring.length, pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3), idx = [];
      rows.forEach((r, i) => r.ring.forEach((p, j) => { const q = (i * nc + j) * 3, k = colF(p, r); pos[q] = p[0]; pos[q + 1] = p[1]; pos[q + 2] = r.z; col[q] = col[q + 1] = col[q + 2] = k; }));
      for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('emis', new T.BufferAttribute(new Float32Array(nr * nc * 3), 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const gs = grid(skin, cSkin), gb = grid(bot, cBot);
    // грани должны смотреть наружу: середина верха (капот) — нормаль вверх; иначе перевернуть обход
    const fix = (g, test) => { if (test(g)) return false; flipTris(g); return true; };
    const nc = skin[0].ring.length, mid = (nc - 1) / 2, row = Math.floor(skin.length * 0.8);
    const flS = fix(gs, g => g.attributes.normal.getY(row * nc + mid) > 0);
    const ncb = bot[0].ring.length;
    const flB = fix(gb, g => g.attributes.normal.getY(row * ncb + 3) < 0);
    // на «лице» носа и кормы обшивка и низ сходятся по линиям от c к нижним углам — там общие нормали; в самой точке c все
    // вершины веера смотрят прямо вперёд / назад (без «звезды» и складки «V» на бампере)
    const nS = gs.attributes.normal, nB = gb.attributes.normal;
    skin.forEach((r, i) => {
      if (r.k === 0) { const dz = Math.sign(r.z); for (let j = 0; j < nc; j++) nS.setXYZ(i * nc + j, 0, 0, dz); for (let j = 0; j < ncb; j++) nB.setXYZ(i * ncb + j, 0, 0, dz); return; }
      if (r.k === 1) return;
      [[i * nc, i * ncb + 6], [i * nc + nc - 1, i * ncb]].forEach(([a, b]) => {
        const x = nS.getX(a) + nB.getX(b), y = nS.getY(a) + nB.getY(b), z = nS.getZ(a) + nB.getZ(b), L = Math.hypot(x, y, z) || 1;
        nS.setXYZ(a, x / L, y / L, z / L); nB.setXYZ(b, x / L, y / L, z / L);
      });
    });
    // дальний вид: те же вершины, сетка реже — сечения farRows, по кольцу только опорные точки сечения (без подразбиения SUB)
    const rows = [], ctl = new Set([0]), half = (nc + 1) / 2, colS = [];
    farRows(ST).forEach((k, i) => { if (k) rows.push(i); });
    SUB.reduce((a, n) => { ctl.add(a + n); return a + n; }, 0);
    for (let j = 0; j < nc; j++) if (ctl.has(j < half ? j : nc - 1 - j)) colS.push(j);
    const farIdx = (cols, w, flip) => {
      const out = [];
      for (let a = 0; a < rows.length - 1; a++) for (let b = 0; b < cols.length - 1; b++) {
        const p = rows[a] * w + cols[b], q = rows[a] * w + cols[b + 1], r = rows[a + 1] * w + cols[b], t = rows[a + 1] * w + cols[b + 1];
        if (flip) out.push(p, q, r, q, t, r); else out.push(p, r, q, q, r, t);
      }
      return out;
    };
    return [gs, gb, farIdx(colS, nc, flS), farIdx([0, 1, 2, 3, 4, 5, 6], ncb, flB)];
  }

  /* ---------- колесо: шина и диск «пять широких спиц» с обеих сторон (ось вдоль x), одна сетка на 4 инстанса ---------- */
  // в начале индекса — только дальний вид (простая шина и светлый диск: farN треугольников), за ним — колесо целиком:
  // ближний вид рисует индекс с farN, дальний — до farN. Суппорты — в отделке кузова (не крутятся), диск колеса глубокий:
  // между лицом диска и тёмной серединой им хватает места и при полном повороте руля
  function wheelGeo(H) {
    const T = H.T, { keep, GEO, put, toon } = H, gF = new T.Group(), g = new T.Group(), R = D.WR;
    const rubber = toon('#2E2A31'), rim = toon('#BEC3CD'), dark = toon('#26232B'), disc = toon('#6F6C77');
    // шина низкого профиля: боковина ≈ 0,22 R — обод крупный, колесо кажется больше; внутри — тёмная бочка обода
    const RR = 0.78 * R;
    const tire = keep(new T.LatheGeometry([[0.775, -0.13], [0.93, -0.13], [0.985, -0.1], [1, -0.045], [1, 0.045], [0.985, 0.1], [0.93, 0.13], [0.775, 0.13], [0.76, 0.115], [0.76, -0.115]].map(([r, y]) => new T.Vector2(r * R, y)), 16));
    put(g, tire, rubber, [0, 0, 0], null, [0, 0, PI / 2]);
    // дальний вид: шина на 10 граней и светлый диск без спиц
    put(gF, keep(new T.LatheGeometry([[0.775, -0.13], [0.985, -0.115], [1, 0], [0.985, 0.115], [0.775, 0.13]].map(([r, y]) => new T.Vector2(r * R, y)), 10)), rubber, [0, 0, 0], null, [0, 0, PI / 2]);
    [-1, 1].forEach(s => put(gF, GEO.cyl, rim, [s * 0.1, 0, 0], [RR - 0.004, 0.02, RR - 0.004], [0, 0, PI / 2]));
    // середина колеса: тёмный щит и тормозной диск (видны в просветах между спицами)
    put(g, GEO.cyl, dark, [0, 0, 0], [RR - 0.002, 0.02, RR - 0.002], [0, 0, PI / 2]);
    put(g, GEO.cyl, disc, [0, 0, 0], [0.205, 0.026, 0.205], [0, 0, PI / 2]);
    // лицо диска: круг с пятью окнами между широкими спицами (спица чуть шире к ободу); лицо вогнуто — ступица глубже обода
    const Ro = RR - 0.004, r1 = 0.082, r2 = 0.228, hw = r => 0.027 + 0.018 * (r - r1) / (r2 - r1), half = r => PI / 5 - Math.asin(hw(r) / r);
    const face = new T.Shape(); face.absarc(0, 0, Ro, 0, PI * 2, false);
    for (let k = 0; k < 5; k++) {
      const b = (k + 0.5) / 5 * PI * 2 + PI / 2, pts = [];
      [r1, 0.12, 0.16, 0.2, r2].forEach(r => pts.push([r, b - half(r)]));
      for (let i = 1; i < 4; i++) pts.push([r2 + 0.004, b - half(r2) + 2 * half(r2) * i / 4]);
      [r2, 0.2, 0.16, 0.12, r1].forEach(r => pts.push([r, b + half(r)]));
      pts.push([r1 - 0.008, b]);
      const hole = new T.Path(); pts.forEach(([r, a], i) => (i ? hole.lineTo(r * Math.cos(a), r * Math.sin(a)) : hole.moveTo(r * Math.cos(a), r * Math.sin(a))));
      hole.closePath(); face.holes.push(hole);
    }
    const FD = 0.016, xF = r => 0.104 + 0.018 * r / Ro;
    [-1, 1].forEach(s => {
      let fg = new T.ExtrudeGeometry(face, { depth: FD, bevelEnabled: false, curveSegments: 12 });
      // без задней крышки и без наружной стенки (её закрывает шина)
      const p = fg.attributes.position, keepT = [];
      for (let i = 0; i < p.count; i += 3) {
        const v = [0, 1, 2].map(j => [p.getX(i + j), p.getY(i + j), p.getZ(i + j)]);
        const wall = Math.max(v[0][2], v[1][2], v[2][2]) - Math.min(v[0][2], v[1][2], v[2][2]) > 1e-5;
        if (v.every(q => q[2] < 1e-5) || (wall && v.every(q => Math.hypot(q[0], q[1]) > Ro - 1e-3))) continue;
        v.forEach(q => keepT.push(q[0], q[1], q[2]));
      }
      fg.dispose(); fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(keepT, 3));
      put(g, keep(conform(T, fg, (u, v, w) => [s * (xF(Math.hypot(u, v)) - FD + w), v, u])), rim);
      // ступица: гладкий колпачок (без значка)
      put(g, GEO.cyl, rim, [s * 0.108, 0, 0], [0.05, 0.02, 0.05], [0, 0, PI / 2]);
      put(g, GEO.cylLo, dark, [s * 0.119, 0, 0], [0.018, 0.004, 0.018], [0, 0, PI / 2]);
    });
    const a = H.geoOf(gF), farN = a.index ? a.index.count : a.attributes.position.count;
    const geo = keep(mergeGeos(T, [[a], [H.geoOf(g)]]));
    geo.userData.farN = farN;
    return geo;
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
    // деталь по поверхности: контур shape (толщина d), перенос f; обе стороны — mirror (левую строим, правую отражаем)
    const decal = (par, mat, shape, d, f, sub, mirror) => {
      const g = keep(conform(T, slab(T, shape, d, sub), f));
      put(par, g, mat);
      if (mirror) put(par, keep(mirrorX(T, g)), mat);
    };
    // тонкая полоса на «лице» носа/кормы поперёк машины (ламели, полоски огней): над поверхностью от w0 до w1
    const faceStrip = (par, mat, F, x0, x1, y0, y1, w0, w1, mirror) => {
      const fz = faceZ(F), dir = Math.sign(F.base), N = 7, xj = j => x0 + (x1 - x0) * j / (N - 1);
      const g = keep(band(T, N, (j, y) => ({ x: xj(j), z: fz(xj(j), y) + dir * w0, nx: 0, nz: dir }), () => [y0, y1], w1 - w0, 0.004));
      put(par, g, mat);
      if (mirror) put(par, keep(mirrorX(T, g)), mat);
    };

    /* --- краска: кузов-лофт + зеркала, чашки фар, антикрыло (цвет вершин белый, цвет краски — у материала) --- */
    const [gSkin, gBot, fS, fB] = loftGeo(T);
    const nSV = gSkin.attributes.position.count, nIS = gSkin.index.count, nIB = gBot.index.count;
    const pods = new T.Group(), white = toon('#FFFFFF');
    // зеркала цвета кузова: корпус-капля на короткой ножке с угла двери у стойки стекла (зеркальце — в отделке)
    [-1, 1].forEach(s => {
      const m = put(pods, GEO.sph, white, [s * 0.852, 0.955, 0.7], [0.088, 0.043, 0.056], [0, s * 0.14, s * -0.05]); m.castShadow = true;
      bar(pods, white, [s * 0.765, topY(0.722, 0.765) - 0.012, 0.722], [s * 0.818, 0.948, 0.706], 0.017);
    });
    // антикрыло (как на фото сзади): широкая плоскость с подъёмом задней кромки на двух стойках, по краям — щёки
    {
      const W = 1.36, wing = [[-1.65, 1.104], [-1.685, 1.126], [-1.77, 1.138], [-1.87, 1.142], [-1.945, 1.148], [-1.966, 1.17], [-1.982, 1.172], [-1.98, 1.128], [-1.9, 1.108], [-1.78, 1.094], [-1.685, 1.089]];
      put(pods, keep(extrudeX(T, wing, W, 0.006)), white);
      const plate = keep(extrudeX(T, [[-1.615, 1.045], [-1.628, 1.17], [-1.996, 1.215], [-2.004, 1.06], [-1.93, 0.995], [-1.69, 0.995]], 0.014, 0.004));
      [-1, 1].forEach(s => put(pods, plate, white, [s * (W / 2 + 0.013), 0, 0]));
      const post = keep(extrudeX(T, [[-1.725, 0.87], [-1.885, 0.86], [-1.86, 1.108], [-1.762, 1.104]], 0.024, 0.004));
      [-1, 1].forEach(s => put(pods, post, white, [s * 0.3, 0, 0]));
    }
    const paintGeo = keep(mergeGeos(T, [[gSkin], [gBot], [H.geoOf(pods)]]));
    // дальний вид: свой индекс по тем же вершинам — обшивка и низ реже, зеркала, чашки фар и антикрыло как есть
    const fullIdx = paintGeo.index, fa = fullIdx.array, farA = new fa.constructor(fS.length + fB.length + fa.length - nIS - nIB);
    farA.set(fS, 0);
    for (let i = 0; i < fB.length; i++) farA[fS.length + i] = fB[i] + nSV;
    farA.set(fa.subarray(nIS + nIB), fS.length + fB.length);
    const farIdx = new T.BufferAttribute(farA, 1);
    const paintMat = H.addRim(toon('#FFFFFF', { vertexColors: true }), 0.9); paintMat.color.set(color);
    const paintMesh = new T.Mesh(paintGeo, paintMat); paintMesh.castShadow = true; paintMesh.receiveShadow = false; paintMesh.name = 'cabrioPaint';
    const outline = new T.Mesh(paintGeo, H.outlineMat); outline.castShadow = false; outline.raycast = () => {};

    /* --- отделка: салон, рамка стекла, фары, заборники, фонари, решётки, трубы — один меш с цветами вершин --- */
    // trim — видно и издали (рамка стекла, фары, заборники, фонари, пороги, решётки, чёрный салон и спинки кресел); trimN —
    // мелочи только вблизи (приборы, рычаг, папка, зеркальца, швы, ручки, руль, подушки кресел, ламели, огни в заборниках,
    // суппорты, хром труб): в индексе они после trim, дальний вид их не рисует (drawRange)
    const trim = new T.Group(), trimN = new T.Group();
    const blk = toon('#2C2830'), blkL = toon('#3B3641'), blkD = toon('#211E25'), chrome = toon('#E9ECF2'), chromeD = toon('#A9ADB8');
    const led = toon('#FFFBF0', { emissive: new T.Color('#FFF4D6'), emissiveIntensity: 0.9 });
    const tail = toon('#E2405E', { emissive: new T.Color('#D9304E'), emissiveIntensity: 0.5 }), tailD = toon('#9C2236', { emissive: new T.Color('#8A1A2C'), emissiveIntensity: 0.3 });
    const gauge = toon('#F6EFE4'), needle = toon('#E2405E'), plateM = toon('#FBF7F0'), caliper = toon('#F5C21B');
    // простая коробка (12 граней) — для скрытого и мелкого; скруглённые rbox — только там, где видно форму
    const bx = (mat, x, y, z, w, h, d, rot, par = trim) => put(par, GEO.box, mat, [x, y, z], [w, h, d], rot);
    // салон: пол, щит под приборами, внутренние панели дверей, тоннель с рычагом
    bx(blkD, 0, 0.535, -0.05, 1.2, 0.05, 1.68);
    bx(blkD, 0, 0.72, 0.8, 1.2, 0.4, 0.04);
    [-1, 1].forEach(s => bx(blk, s * 0.585, 0.7, 0.165, 0.04, 0.32, 1.21));
    bx(blk, 0, 0.69, 0.2, 0.22, 0.3, 0.8);
    bar(trimN, chromeD, [0, 0.82, 0.3], [0, 0.91, 0.27], 0.012); put(trimN, GEO.sphLo, blkL, [0, 0.92, 0.268], [0.032, 0.032, 0.032]);
    // приборная панель: козырёк над пятью круглыми приборами (стрелки, без цифр и надписей)
    rbox(trim, blk, 0, 0.955, 0.61, 1.12, 0.11, 0.2, 0.04);
    rbox(trimN, blk, 0.31, 1.03, 0.585, 0.52, 0.05, 0.13, 0.025);
    [[-0.17, 0.034], [-0.085, 0.04], [0, 0.05], [0.085, 0.04], [0.17, 0.034]].forEach(([dx, r]) => {
      const g = new T.Group(); g.position.set(0.31 + dx, 0.968 + (r - 0.034) * 0.6, 0.507); g.rotation.x = -0.18; trimN.add(g);
      put(g, GEO.cylLo, chromeD, [0, 0, 0], [r + 0.008, 0.012, r + 0.008], [PI / 2, 0, 0]);
      put(g, GEO.cylLo, gauge, [0, 0, -0.004], [r, 0.012, r], [PI / 2, 0, 0]);
      put(g, GEO.box, needle, [r * 0.3, r * 0.15, -0.012], [r * 0.7, 0.006, 0.004], [0, 0, 0.5]);
    });
    // кресла: низкие спортивные ковши — подушка с боковинами и цельная спинка со встроенным подголовником
    // (силуэт спереди: плечи сужаются к подголовнику; верх ≈ 1,22 — чуть выше линии дверей и ниже рамки стекла, как на фото)
    const backG = (() => {
      const sh = new T.Shape(), P = [[0.2, 0], [0.198, 0.145], [0.185, 0.185], [0.125, 0.214], [0.1, 0.23], [0.098, 0.268]];
      sh.moveTo(-P[0][0], P[0][1]); P.forEach(q => sh.lineTo(q[0], q[1]));
      sh.quadraticCurveTo(0.098, 0.3, 0, 0.3); sh.quadraticCurveTo(-0.098, 0.3, -0.098, 0.268);
      P.slice().reverse().forEach(q => sh.lineTo(-q[0], q[1]));
      const g = new T.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 4 });
      g.translate(0, 0, -0.025); return keep(g);
    })();
    [-1, 1].forEach(s => {
      const x = s * 0.31;
      bx(blkD, x, 0.73, -0.07, 0.34, 0.36, 0.34);
      rbox(trimN, blk, x, 0.915, -0.06, 0.44, 0.07, 0.48, 0.03);
      [-1, 1].forEach(b => rbox(trimN, blk, x + b * 0.185, 0.945, -0.08, 0.07, 0.06, 0.42, 0.025));
      put(trim, backG, blk, [x, 0.9, -0.29], null, [-0.2, 0, 0]);
      // светлая вставка по центру спинки
      put(trimN, GEO.box, blkL, [x, 1.016, -0.262], [0.17, 0.15, 0.012], [-0.2, 0, 0]);
    });
    // за креслами — чёрная перегородка салона; сложенный мягкий верх — под чёрной крышкой (как на фото: за креслами всё чёрное),
    // по её переднему краю — кант (передняя дуга верха)
    bx(blkD, 0, 0.72, -0.432, 1.18, 0.38, 0.02);
    {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const x = -0.67 + i * (1.34 / 12); pts.push(new T.Vector3(x, topY(-0.5, x) + 0.004, -0.468)); }
      const g = keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 14, 0.03, 5, false));
      put(trim, g, blkD);
      put(trim, topGrid(T, 0.665, -0.488, -1.03, 8, 6, 0.004), blk);
    }
    // папка «дела» на пассажирском кресле: картон, красная тесёмка, белая наклейка
    bx(toon('#E6C79C'), -0.31, 0.963, -0.03, 0.24, 0.026, 0.31, [0, 0.18, 0], trimN);
    bx(toon('#C2405B'), -0.31, 0.978, -0.03, 0.245, 0.006, 0.022, [0, 0.18, 0], trimN);
    bx(toon('#FFFDF9'), -0.335, 0.978, 0.04, 0.1, 0.004, 0.06, [0, 0.18, 0], trimN);
    // ветровое стекло в тонкой чёрной рамке: стойки, верхняя перекладина (по изгибу стекла), низ; низ по краям поднят на крылья
    const wsAt = (x, t) => {
      const z = D.ws0[0] + (D.ws1[0] - D.ws0[0]) * t, y = D.ws0[1] + (D.ws1[1] - D.ws0[1]) * t, hw = D.wsW[0] + (D.wsW[1] - D.wsW[0]) * t, u = x * hw, q = (u / 0.6) * (u / 0.6);
      return [u, y + 0.05 * q * (1 - t), z - 0.075 * q];
    };
    [-1, 1].forEach(s => bar(trim, blk, wsAt(s * 1.012, -0.015), wsAt(s * 1.012, 1.015), D.wsR));
    for (let i = 0; i < 4; i++) { bar(trim, blk, wsAt(-1.012 + i * 0.506, 1.0), wsAt(-1.012 + (i + 1) * 0.506, 1.0), D.wsR); bar(trim, blkD, wsAt(-1 + i * 0.5, 0.0), wsAt(-1 + (i + 1) * 0.5, 0.0), D.wsR * 0.8); }
    // под стеклом — чёрный верх приборной панели до самого низа стекла (крышка капота под стеклом не видна)
    {
      const g = new T.PlaneGeometry(2, 1, 8, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const q = wsAt(p.getX(i) * 0.98, (p.getY(i) + 0.5) * 0.47); p.setXYZ(i, q[0], q[1] - 0.022, q[2] - 0.01); }
      g.deleteAttribute('uv'); g.computeVertexNormals(); put(trim, keep(g), blk);
    }
    // зеркальца на задней стороне корпусов зеркал (корпуса и ножки — в краске)
    [-1, 1].forEach(s => put(trimN, GEO.sphLo, toon('#BFD3E2'), [s * 0.858, 0.955, 0.646], [0.074, 0.034, 0.008], [0, s * 0.14, 0]));
    // фары: овалы вровень с наклонной площадкой крыла (вид спереди — наклонные овалы), без тёмной обводки: тонкое светлое
    // кольцо-ободок, тёмное нутро, посередине линза, вокруг неё квадратом четыре точки ходовых огней
    const heads = [], LA = LAMP.a, LB = LAMP.b;
    const refl = toon('#CDD5E0', { emissive: new T.Color('#FFF8EE'), emissiveIntensity: 0.02 }), lensP = toon('#9AA6B8', { emissive: new T.Color('#FFF1D6'), emissiveIntensity: 0.08 });
    const lampIn = toon('#2F3341'), lampMod = toon('#4A5062');
    [[lampPatch(T, 0, 0, LA, LB, 0.885, 1, 0.005, 32, 1), refl, trim], [lampPatch(T, 0, 0, LA, LB, 0, 0.9, 0.0062, 32, 4), lampIn, trim],
      [lampPatch(T, 0, 0, LA, LB, 0.5, 0.6, 0.0074, 28, 1), lampMod, trimN], [lampPatch(T, 0, 0, 0.026, 0.026, 0, 1, 0.0082, 14, 1), lensP, trim]]
      .concat([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [lampPatch(T, i * 0.3 * LA, j * 0.42 * LB, 0.0105, 0.0105, 0, 1, 0.0088, 8, 1), led, trimN]))
      .forEach(([g, m, par]) => { put(par, keep(g), m); put(par, keep(mirrorX(T, g)), m); });
    [-1, 1].forEach(s => heads.push([s * LAMP.x, topY(LAMP.z, LAMP.x), LAMP.z + 0.06]));
    // перед (как на фото): широкий низкий заборник посередине (трапеция, книзу шире) и крупные боковые трапеции (книзу уже)
    // с двумя тонкими полосками огней вдоль верха; внутри — ламели; под всем — чёрная губа
    decal(trim, blkD, rpoly(T, [[-0.262, 0.372], [0.262, 0.372], [0.312, 0.252], [-0.312, 0.252]], 0.03), 0.012, onFace(NOSE, 1, -0.004), 1);
    const sideIn = [[0.334, 0.508], [0.66, 0.508], [0.574, 0.262], [0.362, 0.262]], inX = y => 0.574 + (0.66 - 0.574) * (y - 0.262) / 0.246;
    decal(trim, blkD, rpoly(T, sideIn, 0.032), 0.012, onFace(NOSE, 1, -0.004), 1, true);
    [0.293, 0.333].forEach(y => faceStrip(trimN, blkL, NOSE, -0.27, 0.27, y - 0.006, y + 0.006, 0.004, 0.011));
    [0.3, 0.34, 0.38, 0.42].forEach(y => faceStrip(trimN, blkL, NOSE, 0.37, inX(y) - 0.022, y - 0.006, y + 0.006, 0.004, 0.011, true));
    [0.462, 0.484].forEach(y => faceStrip(trim, led, NOSE, 0.354, inX(y) - 0.018, y - 0.0065, y + 0.0065, 0.004, 0.013, true));
    // чёрная губа под бампером: от арки до арки, впереди выступает, к аркам прижимается к кузову
    {
      const O = [0, 1.35], A = [90, 82, 74, 66, 59, 53, 48, 44, 40, 36, 32, 27, 22, 18, 15].map(d => d * DEG);
      const y0 = 0.205, y1 = 0.25, g = keep(band(T, A.length, (j, y) => hitPlan(planAt(y, NOSE), O, A[j]), () => [y0, y1], j => 0.012 + 0.036 * sst(22, 48, A[j] / DEG), 0.05));
      put(trim, g, blkD); put(trim, keep(mirrorX(T, g)), blkD);
    }
    // шов капота: по ложбинкам вдоль крыльев и дугой над бампером — капот читается отдельной крышкой между крыльями
    {
      const half = [[0.5, 0.9], [0.472, 1.13], [0.458, 1.45], [0.435, 1.62], [0.42, 1.71], [0.39, 1.785], [0.3, 1.832], [0.14, 1.856], [0, 1.86]].map(([x, z]) => new T.Vector3(x, topY(z, x) + 0.003, z));
      const pts = half.concat(half.slice(0, -1).reverse().map(p => new T.Vector3(-p.x, p.y, p.z)));
      put(trimN, keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.004, 3, false)), blk);
    }
    // бока: чёрные пороги между арками
    {
      const z0 = D.wf - D.archR - 0.012, z1 = D.wr + D.archRR + 0.012, N = 14, zj = j => z0 + (z1 - z0) * j / (N - 1);
      const pt = (j, y) => { const z = zj(j), x = sideX(z, y), e = 0.02, d = (sideX(z + e, y) - sideX(z - e, y)) / (2 * e), L = Math.hypot(1, d); return { x, z, nx: 1 / L, nz: -d / L }; };
      const g = keep(band(T, N, pt, () => [D.yb - 0.004, D.yb + 0.082], 0.008, 0.03));
      put(trim, g, blk); put(trim, keep(mirrorX(T, g)), blk);
    }
    // швы дверей, ручки
    [[0.665, 0.3, 0.86], [-0.52, 0.3, 0.865]].forEach(([z, y0, y1]) => [-1, 1].forEach(s => bar(trimN, blkD, [s * (sideX(z, y0) + 0.004), y0, z], [s * (sideX(z, y1) + 0.004), y1, z], 0.0045)));
    [-1, 1].forEach(s => { const y = 0.775, z = -0.33, x = sideX(z, y) + 0.006; put(trimN, GEO.box, blkL, [s * x, y, z], [0.014, 0.018, 0.12]); });
    // заборник на заднем крыле за дверью: чёрная наклонная «капля», внутри две ламели
    decal(trim, blkD, pshape(T, [[-0.555, 0.57], [-0.6, 0.57], [-0.78, 0.83], [-0.745, 0.85], [-0.615, 0.85], [-0.57, 0.83], [-0.542, 0.635]]), 0.01, onSide(1, -0.003), 1, true);
    [0.67, 0.755].forEach(y => { const k = (y - 0.57) / 0.28; decal(trimN, blkL, rrect(T, -0.59 - k * 0.165, y - 0.006, -0.555 - k * 0.035, y + 0.006, 0.004), 0.006, onSide(1, 0.004), 0, true); });
    // корма: на крышке мотора под антикрылом — чёрная решётка с ламелями поперёк
    put(trim, topGrid(T, 0.47, -1.27, -1.66, 6, 4, 0.004), blkD);
    for (let i = 0; i < 9; i++) { const z = -1.3 - i * 0.04; put(trimN, topGrid(T, 0.45, z, z - 0.016, 6, 1, 0.009), blkL); }
    // узкие красные фонари на углах кормы: от середины зада обходят угол и заходят на бок; внутри — тёмная полоса
    const tails = [];
    {
      const O = [0, -1.45], A = [-54, -50, -46, -42, -39, -36, -34, -32, -30, -28, -26, -24, -22, -20].map(d => d * DEG);
      const yy = j => { const k = sst(-46, -26, A[j] / DEG); return [0.768 - 0.034 * k, 0.852 - 0.03 * k]; };
      const g = keep(band(T, A.length, (j, y) => hitPlan(planAt(y, TAIL), O, A[j]), yy, 0.008, 0.03));
      put(trim, g, tail); put(trim, keep(mirrorX(T, g)), tail);
      const gi = keep(band(T, A.length - 2, (j, y) => hitPlan(planAt(y, TAIL), O, A[j + 1]), j => { const [a, b] = yy(j + 1); return [a + 0.026, b - 0.026]; }, 0.013, 0.01));
      put(trimN, gi, tailD); put(trimN, keep(mirrorX(T, gi)), tailD);
      [-1, 1].forEach(s => tails.push([s * 0.62, 0.81, -2.0]));
    }
    // бампер сзади: ряд чёрных горизонтальных прорезей под крышкой мотора, по углам — ещё по три прорези; пустой номер
    [0.055, 0.17, 0.285].forEach(x => decal(trim, blkD, rrect(T, x - 0.05, 0.722, x + 0.05, 0.746, 0.01), 0.01, onFace(TAIL, 1, -0.003), 0, true));
    [0.425, 0.46, 0.495].forEach(y => decal(trim, blkD, rrect(T, 0.5, y - 0.009, 0.7, y + 0.009, 0.008), 0.01, onFace(TAIL, 1, -0.003), 1, true));
    decal(trim, blkD, rrect(T, -0.235, 0.5, 0.235, 0.655, 0.02), 0.008, onFace(TAIL, 1, -0.002));
    decal(trim, plateM, rrect(T, -0.21, 0.513, 0.21, 0.642, 0.014), 0.01, onFace(TAIL, 1, 0.001));
    // диффузор: чёрный низ кормы с рёбрами, посередине две круглые трубы
    rbox(trim, blkD, 0, 0.27, -1.86, 1.2, 0.13, 0.26, 0.03);
    [-0.42, -0.26, 0.26, 0.42].forEach(x => put(trimN, GEO.box, blk, [x, 0.255, -1.94], [0.018, 0.1, 0.14]));
    {
      const pipe = keep(new T.CylinderGeometry(0.05, 0.05, 0.09, 14, 1, true)), lipG = keep(new T.TorusGeometry(0.05, 0.008, 4, 14));
      [-1, 1].forEach(s => {
        const x = s * 0.105, y = 0.305, z = -1.995;
        put(trim, pipe, chromeD, [x, y, z], null, [PI / 2, 0, 0]);
        put(trim, GEO.cylLo, blkD, [x, y, z - 0.02], [0.044, 0.05, 0.044], [PI / 2, 0, 0]);
        put(trimN, lipG, chrome, [x, y, z - 0.044]);
      });
    }
    // суппорты тормозов — жёлтые, видны в просветах между спицами (наверху колеса; не крутятся вместе с колесом)
    const cal = keep(new T.TorusGeometry(0.178, 0.032, 4, 6, 0.6));
    [[D.tf, D.wf], [-D.tf, D.wf], [D.tr, D.wr], [-D.tr, D.wr]].forEach(([x, z]) => put(trimN, cal, caliper, [x + Math.sign(x) * 0.06, D.WR, z], [1, 1, 0.42], [0, PI / 2, PI / 2 - 0.3]));
    // руль и колонка — отдельной костью (крутится вместе с колёсами): чёрный обод, три серебристые спицы, гладкая ступица
    const WC = v3(WHEEL_C), COL_AX = new T.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
    const wheelPart = new T.Group();
    put(wheelPart, keep(new T.TorusGeometry(WHEEL_RAD, 0.022, 6, 24)), blk, [WC.x, WC.y, WC.z], null, [TILT, 0, 0]);
    // спицы на «9», «3» и «6 часов» (в плоскости руля: +y — верх обода)
    [0, PI, -PI / 2].forEach(d => { const g = new T.Group(); g.position.copy(WC); g.rotation.x = TILT; wheelPart.add(g); put(g, GEO.box, chromeD, [Math.cos(d) * 0.085, Math.sin(d) * 0.085, 0.004], [0.026, 0.15, 0.012], [0, 0, d - PI / 2]); });
    { const g = new T.Group(); g.position.copy(WC); g.rotation.x = TILT; wheelPart.add(g); put(g, GEO.cyl, blkL, [0, 0, 0.008], [0.048, 0.03, 0.048], [PI / 2, 0, 0]); }
    bar(wheelPart, blk, [WC.x, WC.y, WC.z], [WC.x + COL_AX.x * 0.3, WC.y + COL_AX.y * 0.3, WC.z + COL_AX.z * 0.3], 0.024);
    const gTF = H.geoOf(trim), trimFarN = gTF.index ? gTF.index.count : gTF.attributes.position.count;
    const trimGeo = keep(mergeGeos(T, [[gTF, 0], [H.geoOf(trimN), 0], [H.geoOf(wheelPart), 1]], true));
    const trimMesh = new T.SkinnedMesh(trimGeo, H.emisPatch(toon('#FFFFFF', { vertexColors: true }), 'car'));
    const boneRoot = new T.Bone(), boneWheel = new T.Bone(); boneWheel.position.copy(WC); boneRoot.add(boneWheel); trimMesh.add(boneRoot);
    trimMesh.castShadow = true; trimMesh.receiveShadow = false; trimMesh.name = 'cabrioTrim';
    trimMesh.updateMatrixWorld(true); trimMesh.bind(new T.Skeleton([boneRoot, boneWheel]));
    // ночью фары горят (car.setNight(k), как у седана): светимость отражателей и линз фар — в атрибуте emis отделки,
    // без новых материалов и вызовов отрисовки; днём — едва заметная «метка», по которой находятся вершины фар
    const emA = trimGeo.attributes.emis, lampV = [[], []], eDay = [refl, lensP].map(m => m.emissive.clone().multiplyScalar(m.emissiveIntensity));
    const eNight = [new T.Color('#FFE9C2').multiplyScalar(0.45), new T.Color('#FFE6A8').multiplyScalar(0.95)];
    for (let i = 0; i < emA.count; i++) eDay.forEach((e, j) => { if (Math.abs(emA.getX(i) - e.r) + Math.abs(emA.getY(i) - e.g) + Math.abs(emA.getZ(i) - e.b) < 1e-5) lampV[j].push(i); });
    let nightK = 0;
    function setNight(k) {
      k = clamp(+k || 0, 0, 1); if (k === nightK) return; nightK = k;
      lampV.forEach((ids, j) => { const a = eDay[j], b = eNight[j]; ids.forEach(i => emA.setXYZ(i, a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k)); });
      emA.needsUpdate = true;
    }
    { const bb = trimGeo.boundingBox.clone(), bbW = new T.Box3(), hv = new T.Vector3(); trimMesh.raycast = (rc, out) => { bbW.copy(bb).applyMatrix4(trimMesh.matrixWorld); if (rc.ray.intersectBox(bbW, hv)) { const d = rc.ray.origin.distanceTo(hv); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hv.clone(), object: trimMesh }); } }; }

    /* --- ветровое стекло: трапеция, изогнута по ширине (края дальше назад и выше) --- */
    const gg = new T.PlaneGeometry(2, 1, 8, 1), gp = gg.attributes.position;
    for (let i = 0; i < gp.count; i++) { const p = wsAt(gp.getX(i), gp.getY(i) + 0.5); gp.setXYZ(i, p[0], p[1], p[2]); }
    gg.computeVertexNormals(); gg.computeBoundingSphere(); keep(gg);
    const glass = new T.Mesh(gg, keep(new T.MeshBasicMaterial({ color: 0xE4F3FF, transparent: true, opacity: 0.34, depthWrite: false, side: T.DoubleSide })));
    glass.renderOrder = 3; glass.castShadow = false; glass.name = 'cabrioGlass';

    /* --- колёса: инстансы одной сетки (FL, FR, RL, RR) --- */
    const wheels = new T.InstancedMesh(wheelGeo(H), H.VC.front, 4);
    wheels.geometry.setDrawRange(wheels.geometry.userData.farN, Infinity);
    // дальний вид (js/world/main.js carLod: стоит далеко): 1 — индекс кузова пореже и отделка без мелочей (начало индекса),
    // колёса как вблизи; 2 (или true) — ещё и колёса без спиц
    let farOn = 0;
    function setFar(k) {
      k = k === true ? 2 : +k || 0; if (k === farOn) return; farOn = k;
      paintGeo.setIndex(k ? farIdx : fullIdx);
      trimGeo.setDrawRange(0, k ? trimFarN : Infinity);
      const wf = wheels.geometry.userData.farN;
      if (k > 1) wheels.geometry.setDrawRange(0, wf); else wheels.geometry.setDrawRange(wf, Infinity);
    }
    wheels.castShadow = true; wheels.frustumCulled = false; wheels.name = 'cabrioWheels';
    const WP = [[D.tf, D.wf], [-D.tf, D.wf], [D.tr, D.wr], [-D.tr, D.wr]];
    HS.clear(); PLAN.clear();

    if (o.body) { o.body.add(paintMesh); o.body.add(outline); o.body.add(trimMesh); o.body.add(glass); }
    if (o.root) o.root.add(wheels);
    const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const halfW = 0.93, halfL = 2.0;
    return {
      kind: 'cabrio', paintMesh, outline, trimMesh, boneWheel, glass, plate: null, wheels, WP, WR: D.WR, WB: { f: D.wf, r: D.wr }, TRACK: D.tf,
      WHEEL_C: WC, COL_AX, wheelR: WHEEL_RAD, wheelTilt: TILT,
      seats: {
        heroSeat: v3(HERO_SEAT), seatDriver: new T.Vector3(HERO_SEAT[0], HERO_SEAT[1] + 0.64, HERO_SEAT[2] - 0.18),
        // кот и собачка едут на крышке за креслами (её верх там ≈ 0,99 вместе с чёрной обтяжкой)
        seatPass: new T.Vector3(-0.24, 1.0, -0.68), seatDog: new T.Vector3(0.24, 1.0, -0.68),
        doorL: new T.Vector3(1.45, 0, 0.0), doorR: new T.Vector3(-1.45, 0, 0.0),
      },
      cockpit: JSON.parse(JSON.stringify(COCKPIT)),
      lamps: { head: heads, tail: tails },
      dims: { length: D.zF - D.zR, width: halfW * 2, height: D.ws1[1], wheelBase: D.wf - D.wr, track: D.tf * 2, trackR: D.tr * 2, wheelR: D.WR, halfW, halfL, wf: D.wf, wr: D.wr, front: D.zF, rear: D.zR },
      driveCfg: { wb: +(D.wf - D.wr).toFixed(3), track: D.tf, wf: D.wf, wr: D.wr, halfW: 0.88, halfL, wheelR: D.WR },
      stats: { tris: Math.round(tris(paintGeo) * 2 + tris(trimGeo) + tris(gg) + (tris(wheels.geometry) - wheels.geometry.userData.farN / 3) * 4), farTris: Math.round((farA.length + trimFarN + wheels.geometry.userData.farN * 4) / 3 + tris(gg)), verts: paintGeo.attributes.position.count + trimGeo.attributes.position.count, calls: 5 },
      setColor(hex) { paintMat.color.set(hex); },
      setNight,
      setFar,
    };
  }

  VEH.cabrio = { build, COCKPIT, HERO_SEAT, WHEEL_C, TILT, WHEEL_RAD, COLOR, D, halfSection, topY, sideX, version: 2 };
})();
