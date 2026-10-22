/* =====================================================================
   ОТЕЛЬ НА ВЕРШИНЕ (регион VILLAGE.regions.hotel): горный курорт на холме через долину от горного села. Корпус — по фото автора
   (h1–h5, 16.10, чертёж v2): сливочный объём 39,7 × 21 м, широкий фронтон к двору, бледно-розовая кровля с терракотовой кромкой, тёмные рамы,
   балконы во фронтоне, LED-контур «домика» ночью; ниже двора — длинная лестница по газонному склону к пруду. Без бренда.
   Желания автора (волна 4): отель высоко на холме, к нему можно подъехать; белый, с красивым двором; гольф; крытый бассейн;
   снаружи футбольное поле и падел; большой банный комплекс с джакузи (только смотреть); костровая зона; виды на горы
   в террасах и село вдали; зиплайн от отеля до села (js/village_w4/zipline.js).

   Правда и выдумка (research — plan2/kubachi_spec2.md §1, уровни A/B/C):
     · настоящий SPA-отель с тем же названием, что и село, стоит в самом селе — это коммерческий бренд, поэтому вывеска
       нейтральная: «Отель», в заголовке — «Отель на вершине» (одинаково при named = true/false), без звёзд и логотипов;
     · подтверждено и в репликах: крытый бассейн с подогревом, 18 м, панорамные окна [A]; падел, мини-футбол, мини-гольф [A]
       (не «гольф-клуб» — здесь паттинг-грин с флажками и мини-игра); инвентарь бесплатно [A/B]; копия сельской башни во
       дворе — смотровая [A]; 4 этажа корпуса [B]; коттеджи со стеклом во всю стену и террасами [A]; баня (сауна, хамам) [A];
       вид на горы, особенно на закате [A];
     · стилизация без реплик-фактов: холм, белый фасад, двор с фонтаном, купели-«джакузи» с паром, костровой круг,
       зиплайн, село на склоне через долину.

   Координаты — СВОИ (локальные): метры, x — вправо, y — вверх, z — назад; вперёд (−z) — вид на село через долину.
   y = 0 — двор (верхний уровень). Связь с макро-осями села и серпантина (x — восток, z — юг):
     макро = FRAME + повёрнутое локальное (локальное +z → (sin ry, cos ry)), FRAME = VILLAGE.ZIP_GEO.frame = {490, 38, 500, 0.722}.
     Село в регионе — настоящее (VILLAGE.regions.kubachi.distant), поставлено группой-«шарниром» с обратным переводом.

   Интерфейс — как у села (js/village_w4/README.md, «Интерфейс региона»), только добавления:
     VILLAGE.regions.hotel.build({ THREE, scene, named, season, quality, mood, clouds, from?, village?: false }) → handle
     handle: id 'hotel', title, mapLabel, spawn, carSpawn, ground, groundInfo, collide, rayHit, path, walkable, colliders,
       camColliders, npcs, spots, exits, camera {views, near, far, fogNear, fogFar}, update(dt, heroPos, camera),
       setMood, mood, setClouds, setNight(k), night {lamps, glow, sky, lampSize}, nightMaterials, lights {hemi, sun},
       places, stats(), dispose();
       волна 4: zipline — маршрут для VILLAGE.zipline.ride (локальные оси), golf — мини-игра «паттинг» (см. ниже),
       frame {x,y,z,ry, toMacro(x,y,z), toLocal(X,Y,Z)}, village (группа далёкого села), pollEvents().
     Места: hotel_view (sit — скамья на смотровой: вид на село), fire_pit (sit, вечер, медвежонок), golf_putt (kind 'golf'),
       pool_look (view — бассейн через стекло), hotel_tower → наверх (teleport, level 'top'), zipline_start (level 'top',
       kind 'zipline'), tower_down, spa_look (view — купели с паром, внутрь не заходим), pond_look (view 'pond' — пруд под лестницей).
     Выходы: toRoad (к машине → серпантин, конец ветки к отелю), zipline { id:'zipline', to:'kubachi', spawn:'zipline_landing' }.
     golf: { start() → {stand, view, ball, hole}, stance(angle) → {x,y,z,ry}, aim(angle, power), shoot(angle, power) → Promise
       <{holed, tries, left, text, who}>, stop(), heroPose(anim, dt) (стойка и замах — после anim.update), state, tries, maxTries }.
     VILLAGE.regions.hotel.distant(THREE, season) → группа в макро-осях (холм; корпус, пруд, лестница, башня — отдельной сеткой без
       полос террас; трос) — для вида из села.
     VILLAGE.hotel = { LINES, SPEAKERS, EVENTS, linesFor(named), FRAME }.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  V.regions = V.regions || {};
  const PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- общая география (то же — в zipline.js; кто первый загрузился, тот и задал) ---------- */
  const GEO = V.ZIP_GEO = V.ZIP_GEO || {
    frame: { x: 490, y: 38, z: 500, ry: 0.722 },
    tower: { x: -26, z: -24, floor: 8.6 },
    landing: { x: 53, y: 0, z: 5 },
  };
  const FR = GEO.frame, FC = Math.cos(FR.ry), FS = Math.sin(FR.ry);
  const toMacro = (x, y, z) => ({ x: FR.x + x * FC + z * FS, y: FR.y + y, z: FR.z - x * FS + z * FC });
  const toLocal = (X, Y, Z) => { const dx = X - FR.x, dz = Z - FR.z; return { x: dx * FC - dz * FS, y: Y - FR.y, z: dx * FS + dz * FC }; };
  const dirToLocal = (x, y, z) => [x * FC - z * FS, y, x * FS + z * FC];

  /* =====================================================================
     1. РЕПЛИКИ (литералы { who, text } — их найдёт озвучка; n — вариант без названия села и этнографических слов)
     Факты — только подтверждённые (spec2 §1.3, §10): бассейн под крышей, с подогревом, 18 м; падел, мини-футбол, мини-гольф;
     инвентарь бесплатно; башня — копия старой; вид на горы на закате. Зиплайн, костёр — без фактов.
     ===================================================================== */
  const LINES = {
    hotel_goat: [
      { who: 'hotel_goat', text: 'Добро пожаловать! Отсюда горы видно лучше всего — особенно на закате.' },
      { who: 'hotel_goat', text: 'Бассейн у нас под крышей. Плывёшь — а за стеклом горы.' },
      { who: 'hotel_goat', text: 'Башня во дворе — копия старой, сельской. Поднимись, вид чудесный!', n: { who: 'hotel_goat', text: 'Башню во дворе построили по образцу старой. Поднимись, вид чудесный!' } },
      { who: 'hotel_goat', text: 'Вечером приходи к костру — там тепло и уютно.' },
    ],
    hotel_raccoon: [
      { who: 'hotel_raccoon', text: 'Падел, мини-футбол, мини-гольф. Мячик выдам бесплатно!' },
      { who: 'hotel_raccoon', text: 'Падел — как теннис, только в стеклянной коробке!' },
      { who: 'hotel_raccoon', text: 'Попробуй мини-гольф: три удара — и мячик в лунке!' },
    ],
    hotel_otter: [
      { who: 'hotel_otter', text: 'Вода в бассейне тёплая — с подогревом!' },
      { who: 'hotel_otter', text: 'Восемнадцать метров туда, восемнадцать обратно — вот и разминка!' },
      { who: 'hotel_otter', text: 'Загляни в окно: вода голубая-голубая!' },
    ],
    hotel_bear: [
      { who: 'hotel_bear', text: 'Садись к огню, тут тепло!' },
      { who: 'hotel_bear', text: 'Поленья сухие — горят и потрескивают.' },
      { who: 'hotel_bear', text: 'Видишь село на том склоне? Вечером там зажигаются огоньки.' },
    ],
    hotel_marmot: [
      { who: 'hotel_marmot', text: 'Держись крепче — и вжу-у-ух, через всю долину!' },
      { who: 'hotel_marmot', text: 'Руки — на ручку, сама — в обвязку. Готова?' },
      { who: 'hotel_marmot', text: 'Внизу террасы — ступеньки для великана!' },
    ],
  };
  const SPEAKERS = {
    hotel_goat: { name: 'Козочка-администратор', icon: '🐐', voice: 'приветливая, звонкая, чуть торжественная' },
    hotel_raccoon: { name: 'Енот-тренер', icon: '🦝', voice: 'бодрый, спортивный, с улыбкой' },
    hotel_otter: { name: 'Выдра у бассейна', icon: '🦦', voice: 'весёлая, быстрая, «мокрая» интонация' },
    hotel_bear: { name: 'Медвежонок у костра', icon: '🐻', voice: 'тёплый, басовитый, неторопливый' },
    hotel_marmot: { name: 'Сурок-инструктор', icon: '🐿️', voice: 'задорный, уверенный, чуть с хрипотцой' },
  };
  // события (реплики на действие): гольф, костёр, зиплайн, бассейн
  const EVENTS = {
    golfHoled: { who: 'hotel_raccoon', text: 'Прямо в лунку! Вот это удар!' },
    golfMiss: { who: 'hotel_raccoon', text: 'Почти! Ещё разок?' },
    golfOut: { who: 'hotel_raccoon', text: 'Мячик почти дома. В другой раз точно попадёшь!' },
    fireSit: { who: 'hotel_bear', text: 'Грейся! Смотри, как искорки летят.' },
    zipReady: { who: 'hotel_marmot', text: 'Пристегнула? Тогда — вперёд!' },
    poolLook: { who: 'hotel_otter', text: 'Внутрь сегодня только смотреть. Красиво же!' },
    spaLook: { who: 'hotel_goat', text: 'Купели парят — значит, вода горячая!' },
  };
  const HERO = { view: 'Какая даль!', pool: 'Голубая вода и горы за стеклом!', fire: 'Тепло…', spa: 'Сколько пара!', golfStart: 'Так, прицелимся…', zip: 'Ух, как высоко!' };
  function linesFor(named) {
    const out = {};
    Object.keys(LINES).forEach(k => { out[k] = LINES[k].map(l => (named === false && l.n ? l.n : { who: l.who, text: l.text })); });
    return out;
  }

  /* =====================================================================
     2. РАСКЛАДКА (локальные оси): три уровня-террасы на вершине, лестницы, парковка
     ===================================================================== */
  const PADS = [
    { id: 'top', x0: -34, x1: 54, z0: -30, z1: 40, y: 0, kind: 'yard' },
    { id: 'park', x0: -68, x1: -34, z0: -4, z1: 30, y: 0, kind: 'park' },
    { id: 'mid', x0: -4, x1: 86, z0: -94, z1: -40, y: -4, kind: 'sport' },
    { id: 'low', x0: -98, x1: -12, z0: -102, z1: -46, y: -8, kind: 'relax' },
    { id: 'deck', x0: -8.5, x1: -1.5, z0: -38.5, z1: -30, y: 0, kind: 'deck', float: true },   // смотровая на консоли над склоном
  ];
  // лестницы-пандусы: прямоугольник, ось подъёма, высота на меньшей и большей стороне
  const STAIRS = [
    { id: 'st_mid', x0: 34, x1: 42, z0: -40, z1: -30, axis: 'z', ya: -4, yb: 0 },
    { id: 'st_low', x0: -12, x1: -4, z0: -56, z1: -47, axis: 'x', ya: -8, yb: -4 },   // ближе к холму: со смотровой не загораживает долину
    // длинная прямая лестница по фото (h3–h5): с края двора вниз по склону к пруду, площадка посередине (land — доли длины)
    { id: 'st_top', x0: -21.5, x1: -17.5, z0: -46, z1: -30, axis: 'z', ya: -8, yb: 0, land: [0.45, 0.55] },
  ];
  // профиль лестницы: доля высоты по доле длины (с площадкой — два марша)
  const stairK = (s, t) => (s.land ? (t < s.land[0] ? t / s.land[0] * 0.5 : t < s.land[1] ? 0.5 : 0.5 + (t - s.land[1]) / (1 - s.land[1]) * 0.5) : t);
  const TW = { x: GEO.tower.x, z: GEO.tower.z, rB: 1.85, rT: 1.7, floor: GEO.tower.floor, rIn: 1.38 };
  // корпус по фото (чертёж v2 по h1–h5): стены 39,7 × 21 м, фронтон к двору (z0), карниз 12,0 м; apex — верх стены фронтона
  // под ветровой доской (уклон 20°: 12,0 + 19,85 · tg 20°)
  const MAIN = { x0: -21.85, x1: 17.85, z0: 15, z1: 36, eave: 12.0, apex: 19.22 };
  // кровля корпуса (общая для mainBuilding и distant): свес по бокам ov и над фронтонами og, толщина th; трубы chim —
  // [X от оси (вправо, если смотреть на фронтон снаружи), расстояние от фронтона назад, ширина поперёк ската, высота над скатом]
  const MROOF = { ov: 1.5, og: 0.9, th: 0.45, chim: [[-11.0, 8, 0.9, 1.7], [-6.2, 14, 1.6, 1.5], [4.3, 14, 0.9, 1.5], [10.1, 8, 1.6, 1.7]] };
  // пруд под лестницей (нижняя площадка): вытянутая линза rx × rz (к концам уже на долю lens), вода чуть ниже каменного борта;
  // с дорожкой и фонарями — между тропой к костру (x −36) и краем площадки (x −12)
  const POND = { x: -24.5, z: -80, rx: 9.5, rz: 4.5, lens: 0.35 };
  const POOL = { x0: 24, x1: 48, z0: 6, z1: 30, h: 6.4, px0: 27, px1: 45, pz0: 15, pz1: 22 };
  const FOUNT = { x: -3, z: -3, r: 3.3 };
  const PARKING = { x: -50, z: 13, ry: PI / 2 };
  // волна 6 (дороги села): приезд из села по нижней дороге — у ворот парковки (машина носом во двор), выход toVillage — там же
  const FROM_VILLAGE = { car: { x: -61.0, z: 18.6, ry: PI / 2 }, hero: { x: -60.4, z: 16.2, ry: PI / 2 }, exit: { x: -66.0, z: 19.4, r: 2.0 } };
  const PADEL = { x0: 2, x1: 14, z0: -91, z1: -67 };
  const PITCH = { x0: 46, x1: 82, z0: -91, z1: -67 };
  const GREEN = { x: 27, z: -56, rx: 9.5, rz: 7, tee: [21.6, -51.6], hole: [29.4, -58.4], holes: [[29.4, -58.4], [33.5, -53.2], [24.2, -60.6]] };
  const SPA = { x0: -66, x1: -42, z0: -62, z1: -48, h: 4.2 };
  const TUBS = [[-36.5, -52.5], [-31, -57.5], [-25.5, -52.5]];
  const FIRE = { x: -40, z: -86, r: 1.25 };
  const COTT = [[-90, -60], [-90, -77], [-90, -94]];   // 4B: на краю нижней площадки — тыл на каменном цоколе над склоном
  const HC = { x: -6, z: -34 };                  // центр холма (для полярных сеток рельефа и террас)

  /* ---------- земля: площадки, лестницы, холм с террасами, естественный склон (макро) ---------- */
  function padAt(x, z) {
    for (const s of STAIRS) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) { const t = s.axis === 'z' ? (z - s.z0) / (s.z1 - s.z0) : (x - s.x0) / (s.x1 - s.x0); return { y: lerp(s.ya, s.yb, stairK(s, t)), kind: 'stairs', id: s.id }; }
    for (const p of PADS) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return p;
    return null;
  }
  const sdRect = (x, z, R, r = 5) => { const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, hx = (R.x1 - R.x0) / 2 - r, hz = (R.z1 - R.z0) / 2 - r, qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
  // профиль склона от края площадки: крутизна по расстоянию (сад у края → крутые террасы → положе к низу)
  const PROF = (() => { const N = 700, a = new Float32Array(N + 1); let y = 0.55; a[0] = y; for (let i = 1; i <= N; i++) { const d = i * 0.5, s = 0.2 + 0.46 * sst(3, 26, d) - 0.24 * sst(60, 130, d); y += s * 0.5; a[i] = y; } return a; })();
  const prof = d => { if (d <= 0) return 0; const f = Math.min(699.9, d * 2), i = Math.floor(f); return lerp(PROF[i], PROF[i + 1], f - i); };
  // естественный склон: тот же рельеф, что у серпантина/села (макро), в локальных осях
  function natMacro(X, Z) {
    const SP = V.regions.serpentine, KD = V.regions.kubachi && V.regions.kubachi.data;
    if (SP && SP.groundMacro) return SP.groundMacro(X, Z);
    if (KD && KD.OPP) return KD.OPP.y(X, Z);
    const rho = Math.hypot(X + 11.2, Z + 15.4); return rho < 300 ? -45 - Math.max(0, rho - 90) * 0.5 : rho < 330 ? -150 : rho < 480 ? -150 + (rho - 330) * 0.8 : -30 + (rho - 480) * 0.09;
  }
  const natLocal = (x, z) => { const m = toMacro(x, 0, z); return natMacro(m.x, m.z) - FR.y; };
  // дорога к отелю: от ворот парковки вниз по западному склону двумя шпильками к концу ветки серпантина
  const ROAD = (() => {
    const E = toLocal(342.1, -14.1, 435.7);   // конец ветки серпантина (выход toHotel) — низ нашей дороги
    const W = [[-68, 0.0, 12], [-80, -0.6, 13], [-96, -2.2, 9], [-106, -4.5, -6], [-110, -9.5, -42], [-114, -13.2, -62], [-124, -15.6, -72], [-133, -17.4, -66], [-134, -21.5, -40], [-136, -26, -12], [-144, -28.2, -2], [-153, -30, -8], [-154, -34, -30], [-146, -40.5, -78], [-128, -46.5, -112], [-100, -50.5, -134], [E.x, E.y, E.z]];
    // Catmull-Rom → шаг 1 м
    const raw = [];
    for (let i = 0; i < W.length - 1; i++) { const p0 = W[Math.max(0, i - 1)], p1 = W[i], p2 = W[i + 1], p3 = W[Math.min(W.length - 1, i + 2)]; const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]))); for (let j = 0; j < n; j++) { const t = j / n, t2 = t * t, t3 = t2 * t, f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3); raw.push([f(0), f(1), f(2)]); } }
    raw.push(W[W.length - 1].slice());
    const pts = [raw[0]]; let acc = 0; for (let i = 1; i < raw.length; i++) { acc += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][2] - raw[i - 1][2]); if (acc >= 1.0) { pts.push(raw[i]); acc = 0; } }
    // профиль высоты — сглаженный, монотонно вниз
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < pts.length - 1; i++) pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
    const N = pts.length, S = { N, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), th: new Float32Array(N), len: N - 1, end: E, w: 2.4 };
    pts.forEach((p, i) => { S.x[i] = p[0]; S.y[i] = p[1]; S.z[i] = p[2]; });
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); S.th[i] = Math.atan2(S.x[b] - S.x[a], S.z[b] - S.z[a]); }
    // ближайшая точка оси (сетка 8 м)
    const Q = new Map(), CS = 16; for (let i = 0; i < N - 1; i++) { const kx = Math.floor(S.x[i] / CS), kz = Math.floor(S.z[i] / CS); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = (kx + a) + ',' + (kz + b); if (!Q.has(k)) Q.set(k, []); Q.get(k).push(i); } }
    S.near = (x, z) => { const l = Q.get(Math.floor(x / CS) + ',' + Math.floor(z / CS)); if (!l) return null; let bd = 1e9, by = 0, bi = -1, bt = 0; for (const i of l) { const ax = S.x[i], az = S.z[i], vx = S.x[i + 1] - ax, vz = S.z[i + 1] - az, L2 = vx * vx + vz * vz || 1, t = clamp(((x - ax) * vx + (z - az) * vz) / L2, 0, 1), d = Math.hypot(x - ax - vx * t, z - az - vz * t); if (d < bd) { bd = d; by = S.y[i] + (S.y[i + 1] - S.y[i]) * t; bi = i; bt = t; } } return { d: bd, y: by, i: bi, t: bt }; };
    return S;
  })();
  function hillRaw(x, z) {
    let h = -1e9;
    for (const p of PADS) { if (p.float) continue; const d = Math.max(0, sdRect(x, z, p, 6)); const c = p.y - prof(d); if (c > h) h = c; }
    return h;
  }
  // фото-лестница лежит на склоне: в 5 м по бокам склон плавно подводится к её высоте (без высоких подпорных стенок)
  const ST_TOP = STAIRS.find(s => s.id === 'st_top');
  function stairCut(x, z, y) {
    const s = ST_TOP; if (z < s.z0 || z > s.z1) return y;
    const dx = Math.max(s.x0 - x, x - s.x1, 0); if (dx > 5) return y;
    const t = (z - s.z0) / (s.z1 - s.z0), ys = lerp(s.ya, s.yb, stairK(s, t)) - 0.06;
    return lerp(ys, y, sst(0.3, 5, dx));
  }
  // фото h3/h4: от двора к нижней и средней площадкам — травяные откосы, а не подпорные стенки. Склон над ними в EMB м от края
  // подведён к их уровню; между нижней (x ≤ −12) и средней (x ≥ −4) — ровный скат (западный край средней тоже без стенки)
  const EMB = 8, P_LOW = PADS.find(p => p.id === 'low'), P_MID = PADS.find(p => p.id === 'mid');
  const outD = (x, z, p) => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));
  function embank(x, z, y) {
    for (const p of [P_LOW, P_MID]) { if (y <= p.y) continue; const d = outD(x, z, p); if (d < EMB) y = lerp(p.y, y, sst(0, EMB, d)); }
    const m = P_MID; if (x < m.x0 && x > m.x0 - EMB && z > m.z0 && z < m.z1 && y < m.y) { const w = sst(m.z1, m.z1 - 4, z) * sst(m.z0, m.z0 + 4, z); y = lerp(y, lerp(m.y, y, sst(0, EMB, m.x0 - x)), w); }
    return y;
  }
  function hillY(x, z) {
    let y = stairCut(x, z, embank(x, z, Math.max(hillRaw(x, z), natLocal(x, z))));
    const r = ROAD.near(x, z);
    if (r && r.d < 30) { const e = Math.max(0, r.d - ROAD.w - 0.6) * 0.9; y = r.d < ROAD.w + 0.6 ? r.y - 0.08 : lerp(clamp(y, r.y - 0.08 - e, r.y - 0.08 + e), y, sst(21, 30, r.d)); }   // 4B: плавный выход из «выемки» дороги (без ступеньки-обрыва на 30 м)
    return y;
  }
  function groundInfo(x, z) {
    // площадка башни (верх) — круг на высоте пола
    if (Math.hypot(x - TW.x, z - TW.z) < TW.rT) return { y: TW.floor, kind: 'tower' };
    const p = padAt(x, z); if (p) return { y: p.y, kind: p.kind };
    const r = ROAD.near(x, z); if (r && r.d < ROAD.w) return { y: r.y, kind: 'road' };
    return { y: hillY(x, z), kind: 'slope' };
  }
  const groundY = (x, z) => groundInfo(x, z).y;

  /* ---------- столкновения: края площадок (стены над обрывом), коробки и круги (дома, фонтан, лавки) ---------- */
  function edgeSegments() {
    // граница объединения площадок и лестниц — отрезки по осям; кусок открыт, если по ту сторону — другая площадка рядом по высоте
    const rects = PADS.map(p => ({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, y: p.y, id: p.id })).concat(STAIRS.map(s => ({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, stair: s, id: s.id })));
    const yAt = (R, x, z) => (R.stair ? padAt(clamp(x, R.x0, R.x1), clamp(z, R.z0, R.z1)).y : R.y);
    const inside = (x, z, not) => rects.find(R => R !== not && x >= R.x0 - 1e-6 && x <= R.x1 + 1e-6 && z >= R.z0 - 1e-6 && z <= R.z1 + 1e-6);
    const segs = [];
    rects.forEach(R => {
      const edges = [['z', R.z0, R.x0, R.x1, -1], ['z', R.z1, R.x0, R.x1, 1], ['x', R.x0, R.z0, R.z1, -1], ['x', R.x1, R.z0, R.z1, 1]];
      edges.forEach(([ax, c, a, b, sgn]) => {
        let run = null; const st = 0.25;
        for (let t = a; t <= b + 1e-6; t += st) {
          const tt = Math.min(t, b), px = ax === 'z' ? tt : c + sgn * 0.08, pz = ax === 'z' ? c + sgn * 0.08 : tt;
          const o = inside(px, pz, R), yHere = yAt(R, ax === 'z' ? tt : c, ax === 'z' ? c : tt), open = o && Math.abs(yAt(o, px, pz) - yHere) < 0.6;
          if (!open) { if (!run) run = { ax, c, a: tt, b: tt, sgn, y: yHere, id: R.id }; else { run.b = tt; run.y = Math.max(run.y, yHere); } }
          else if (run) { segs.push(run); run = null; }
        }
        if (run) segs.push(run);
      });
    });
    return segs.filter(s => s.b - s.a > 0.05);
  }
  function makeCollide(cols, segs) {
    const C = 8, grid = new Map();
    const addG = (o, x0, x1, z0, z1) => { for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = i + ',' + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); } };
    cols.forEach(c => { const r = c.type === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2; addG(c, c.x - r - 1, c.x + r + 1, c.z - r - 1, c.z + r + 1); });
    segs.forEach(s => { const o = Object.assign({ type: 'seg' }, s); if (s.ax === 'z') addG(o, s.a - 1, s.b + 1, s.c - 1, s.c + 1); else addG(o, s.c - 1, s.c + 1, s.a - 1, s.b + 1); });
    const near = (x, z) => grid.get(Math.floor(x / C) + ',' + Math.floor(z / C)) || [];
    const yOk = (c, y) => y === undefined || !((c.y1 !== undefined && y > c.y1 - 0.05) || (c.y0 !== undefined && y < c.y0 - 0.5));
    function inUnion(x, z) { if (padAt(x, z)) return true; return false; }
    function collide(x, z, r = 0.3, y) {
      // верх башни: внутри парапета
      if (y !== undefined && y > TW.floor - 1.5 && Math.hypot(x - TW.x, z - TW.z) < TW.rB + 1) { const dx = x - TW.x, dz = z - TW.z, d = Math.hypot(dx, dz) || 1e-6, m = TW.rIn - r; if (d > m) { x = TW.x + dx / d * m; z = TW.z + dz / d * m; } return [x, z]; }
      for (let it = 0; it < 3; it++) {
        const L = near(x, z);
        for (const c of L) {
          if (c.type === 'seg') {
            if (y !== undefined && Math.abs(y - c.y) > 2.5) continue;
            if (c.ax === 'z') { if (x < c.a - r || x > c.b + r) continue; const d = (z - c.c) * c.sgn; if (d > -r && d < 1.5) { const px = clamp(x, c.a, c.b), dd = Math.hypot(x - px, z - c.c); if (x >= c.a && x <= c.b) z = c.c - c.sgn * r; else if (dd < r) { const k = r / (dd || 1e-6); x = px + (x - px) * k; z = c.c + (z - c.c) * k; } } }
            else { if (z < c.a - r || z > c.b + r) continue; const d = (x - c.c) * c.sgn; if (d > -r && d < 1.5) { const pz = clamp(z, c.a, c.b), dd = Math.hypot(x - c.c, z - pz); if (z >= c.a && z <= c.b) x = c.c - c.sgn * r; else if (dd < r) { const k = r / (dd || 1e-6); x = c.c + (x - c.c) * k; z = pz + (z - pz) * k; } } }
            continue;
          }
          if (!yOk(c, y)) continue;
          if (c.type === 'circle') { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m) { const k = d > 1e-6 ? m / d : 1; x = c.x + (d > 1e-6 ? dx : m) * (d > 1e-6 ? k : 1); z = c.z + (d > 1e-6 ? dz * k : 0); } }
          else { const co = Math.cos(c.ry || 0), si = Math.sin(c.ry || 0), dx = x - c.x, dz = z - c.z, lx = dx * co - dz * si, lz = dx * si + dz * co, hw = c.w / 2 + r, hd = c.d / 2 + r;
            if (Math.abs(lx) < hw && Math.abs(lz) < hd) { const px = hw - Math.abs(lx), pz = hd - Math.abs(lz); let nx = lx, nz = lz; if (px < pz) nx = Math.sign(lx || 1) * hw; else nz = Math.sign(lz || 1) * hd; x = c.x + nx * co + nz * si; z = c.z - nx * si + nz * co; } }
        }
      }
      // страховка: центр вне площадок — к ближайшей площадке (внутрь на r)
      if (!inUnion(x, z) && !(y !== undefined && y > TW.floor - 1.5)) {
        let best = null, bd = 1e9;
        PADS.concat(STAIRS).forEach(R => { const px = clamp(x, R.x0 + r, R.x1 - r), pz = clamp(z, R.z0 + r, R.z1 - r), d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz]; } });
        if (best) { x = best[0]; z = best[1]; }
      }
      return [x, z];
    }
    // луч камеры по коробкам (стены корпусов, павильонов, башни) — доля отрезка до первой коробки
    function rayHit(a, b) {
      let tMin = 1; const boxes = cols.filter(c => c.type === 'box' && c.y1 - (c.y0 || 0) > 1.6 || c.cam);
      for (const c of boxes) {
        const co = Math.cos(c.ry || 0), si = Math.sin(c.ry || 0);
        const L = (p) => { const dx = p.x - c.x, dz = p.z - c.z; return [dx * co - dz * si, p.y, dx * si + dz * co]; };
        const A = L(a), Bq = L(b), hw = c.w / 2, hd = c.d / 2, y0 = c.y0 === undefined ? -1e9 : c.y0, y1 = c.y1 === undefined ? 1e9 : c.y1;
        let t0 = 0, t1 = tMin; const dir = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]], lo = [-hw, y0, -hd], hi = [hw, y1, hd];
        let ok = true;
        for (let k = 0; k < 3 && ok; k++) { if (Math.abs(dir[k]) < 1e-9) { if (A[k] < lo[k] || A[k] > hi[k]) ok = false; continue; } let ta = (lo[k] - A[k]) / dir[k], tb = (hi[k] - A[k]) / dir[k]; if (ta > tb) { const q = ta; ta = tb; tb = q; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; }
        if (ok && t0 < tMin) tMin = t0;
      }
      return tMin;
    }
    return { collide, rayHit };
  }

  // ROAD2 («деревья висят в воздухе»): высота видимой земли под точками — по треугольникам самих сеток (как в kubachi.js).
  // pts — [{ x, z }] (сюда пишется top — верхняя земля под точкой или −∞); srcs — [{ P: позиции, I: индексы | null, minNy }]:
  // грани круче minNy (отвесные стенки) и изнанка — не земля. Точки — в сетку 8 м, треугольники — один проход
  function dropOnto(pts, srcs) {
    const CS = 8, cell = new Map(), key = (i, j) => (i + 4096) * 8192 + j + 4096;
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
    pts.forEach((p, k) => { p.top = -Infinity; X0 = Math.min(X0, p.x); X1 = Math.max(X1, p.x); Z0 = Math.min(Z0, p.z); Z1 = Math.max(Z1, p.z);
      const kk = key(Math.floor(p.x / CS), Math.floor(p.z / CS)); let l = cell.get(kk); if (!l) cell.set(kk, l = []); l.push(k); });
    if (!pts.length) return;
    srcs.forEach(({ P, I, minNy = 0.1 }) => {
      const n = I ? I.length : P.length / 3;
      for (let t = 0; t + 2 < n; t += 3) {
        const a = (I ? I[t] : t) * 3, b = (I ? I[t + 1] : t + 1) * 3, c = (I ? I[t + 2] : t + 2) * 3;
        const ax = P[a], az = P[a + 2], bx = P[b], bz = P[b + 2], cx = P[c], cz = P[c + 2];
        const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
        if (x1 < X0 || x0 > X1 || z1 < Z0 || z0 > Z1) continue;
        const ay = P[a + 1], by = P[b + 1], cy = P[c + 1], ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        // изнанка (грань вниз — сверху её не видно, материал односторонний) — не земля
        if (ny < minNy * Math.hypot(nx, ny, nz) || ny < 1e-9) continue;
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        for (let i = Math.floor(x0 / CS); i <= Math.floor(x1 / CS); i++) for (let j = Math.floor(z0 / CS); j <= Math.floor(z1 / CS); j++) {
          const l = cell.get(key(i, j)); if (!l) continue;
          for (let q = 0; q < l.length; q++) {
            const p = pts[l[q]], l1 = ((bz - cz) * (p.x - cx) + (cx - bx) * (p.z - cz)) / d; if (l1 < -1e-6 || l1 > 1 + 1e-6) continue;
            const l2 = ((cz - az) * (p.x - cx) + (ax - cx) * (p.z - cz)) / d; if (l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue;
            const y = l1 * ay + l2 * by + (1 - l1 - l2) * cy; if (y > p.top) p.top = y;
          }
        }
      }
    });
  }

  /* =====================================================================
     3. СБОРКА РЕГИОНА
     ===================================================================== */
  function build(opts = {}) {
    const T = opts.THREE || window.THREE, scene = opts.scene;
    if (!T || !scene) throw new Error('VILLAGE.hotel.build: нужен THREE и scene');
    const VK = V.vkit; if (!VK) throw new Error('hotel.js: сначала подключите vkit.js');
    const PAL = VK.PAL, S = VK.S, rgb = VK.rgb, mix = VK.mix, mul = VK.mul, rng = VK.rng;
    const named = opts.named !== undefined ? !!opts.named : V.named !== false;
    const season = opts.season === 'winter' ? 'winter' : 'autumn', WIN = season === 'winter';
    const quality = opts.quality === 'high' ? 'high' : 'low', HI = quality === 'high';
    const t0 = (window.performance || Date).now();
    const K = VK.makeKit(T, { rim: ['#FFE8D0', 0.2], aniso: HI ? 4 : 1, grad: HI, hi: HI, baked: !HI });
    const C = n => rgb(PAL[n] || n), SNOW = C('snow');
    const root = new T.Group(); root.name = 'village:hotel'; scene.add(root);
    const R = rng(4321);
    const at = new K.Baker('atlas');    // камень: башня, подпорные стенки, плитка двора
    const vc = new K.Baker('vc');       // всё цветное: корпуса, корты, мебель, кабинки, флажки
    const vcD = new K.Baker('vc');      // двусторонние тонкие: сетки, навесы, флажки
    const glassB = new K.Baker('vc');   // стекло (прозрачное)
    const glowB = new K.Baker('vc');    // изнутри светится ночью (зал бассейна) — свой материал
    const paneB = new K.Baker('vc');    // 4B: большие стёкла (коттеджи, баня, фронтон): днём — холодное стекло с отблеском неба, ночью теплеют
    const waterB = { P: [], U: [], C: [], I: [], n: 0 };
    const lantB = new K.Baker('vc');    // плафоны фонарей
    const glaz = [], crowns = [], trunks = [], rocks = [], flowers = [];
    const colliders = [], camColliders = [];
    const NIGHT = { lamps: [], mats: [], t: 0 };
    const props = { puffs: [], lamps: [], signs: [] };
    const npcs = [], spots = [], exits = [];
    const box = (bk, F, x, y, z, w, h, d, col, o = {}) => bk.box(F, x, y + h / 2, z, w, h, d, Object.assign({ col }, o));
    const F0 = new K.Frame(0, 0, 0, 0);
    const colBox = (x, z, w, d, y0, y1, id, ry) => colliders.push({ type: 'box', x, z, w, d, ry: ry || 0, y0, y1, id });
    const colCirc = (x, z, r, y0, y1, id) => colliders.push({ type: 'circle', x, z, r, y0, y1, id });
    const snowTop = (c, k = 0.85) => (WIN ? mix(c, SNOW, k) : c);

    /* ---------- 3.1 земля: площадки (покрытия), рельеф холма (полярная сетка), дальний склон, дорога ---------- */
    const WHITE = rgb('#F6F3EC'), CREAM = rgb('#EFE8DA'), WOOD = rgb('#A9805A'), WOODD = rgb('#7E5A3E'), STEEL = rgb('#9AA0A8'), DARK = rgb('#3E3A44');
    const LAWN = WIN ? rgb('#EEF2F6') : rgb('#93A65A'), LAWN2 = WIN ? rgb('#E6ECF2') : rgb('#86994F'), GRAVEL = WIN ? rgb('#E9EDF1') : rgb('#CFC6B4');
    function padSurfaces() {
      // t — плитками ≤ t м: склейка режется на куски по центрам треугольников, и один квад во весь верх раздувал сферы кусков
      // ('main', 'topF', 'topB'): со смотровой и с башни они не отсекались
      const q = (x0, z0, x1, z1, y, col, s = S.FLAT, bk = vc, t = 0) => { const nx = t ? Math.max(1, Math.round((x1 - x0) / t)) : 1, nz = t ? Math.max(1, Math.round((z1 - z0) / t)) : 1;
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = lerp(x0, x1, i / nx), b = lerp(x0, x1, (i + 1) / nx), c = lerp(z0, z1, j / nz), d = lerp(z0, z1, (j + 1) / nz); bk.quad([a, y, d], [b, y, d], [b, y, c], [a, y, c], col, s); } };
      // верх: двор — светлые бетонные плиты (атлас «плиты», серо-бежевые, как на h1/h3), газон по бокам, деревянная терраса у бассейна
      const PAVE = WIN ? rgb('#E9EDF2') : rgb('#D6CFC2');
      q(-34, -30, 54, 40, 0.0, LAWN, S.FLAT, vc, 12);
      q(-27, -21, 23, 15.5, 0.04, PAVE, S.SLAB, at, 12);            // двор
      q(-34, -30, 24, -21, 0.04, PAVE, S.SLAB, at, 12);             // смотровая
      // дорожка от парковки во двор
      q(-34, 2, -27, 10, 0.04, PAVE, S.SLAB, at);
      // и под перголой — к дверям бока
      q(-34, 21, -25.45, 31, 0.04, PAVE, S.SLAB, at);
      q(23, -6, 24, 6, 0.04, PAVE, S.SLAB, at); q(24, -30, 46, -21, 0.04, PAVE, S.SLAB, at, 12); q(33, -21, 43, -6, 0.04, PAVE, S.SLAB, at);   // к бассейну и к лестнице на спорт
      q(24, -6, 48, 6, 0.06, WIN ? mix(WOOD, SNOW, 0.6) : rgb('#B58B62'), S.FLAT, vc, 12);
      // парковка: тёмный асфальт с белыми линиями
      q(-68, -4, -34, 30, 0.01, WIN ? rgb('#D9DEE4') : rgb('#6E6C70'));
      for (let i = 0; i < 6; i++) { const z = 0 + i * 4.6; q(-60, z - 0.06, -54, z + 0.06, 0.03, rgb('#F2F2EE')); q(-46, z - 0.06, -40, z + 0.06, 0.03, rgb('#F2F2EE')); }
      // средний: газон, гравийные дорожки
      q(-4, -94, 86, -40, 0.0, LAWN, S.FLAT);
      q(16, -66, 44, -62, 0.02, GRAVEL); q(36, -62, 42, -40, 0.02, GRAVEL); q(-4, -56, 16, -47, 0.02, GRAVEL); q(44, -64, 86, -60, 0.02, GRAVEL); q(46, -56, 62, -46, 0.02, WIN ? rgb('#DDE3E9') : rgb('#8C8A88'));
      // нижний: газон, каменные дорожки, настил у купелей
      q(-98, -102, -12, -46, 0.0, LAWN, S.FLAT);
      // от фото-лестницы — прямая дорожка к пруду
      q(-20.75, POND.z + POND.rz + 0.8, -18.25, -46, 0.02, GRAVEL); q(-86, -66, -12, -63, 0.02, GRAVEL); q(-22, -56, -12, -47, 0.02, GRAVEL); q(-44, -100, -36, -66, 0.02, GRAVEL);
      q(-40, -62, -22, -48, 0.05, WIN ? mix(WOOD, SNOW, 0.5) : rgb('#B58B62'));
    }
    // покрытия кладём на свои высоты (у каждой площадки — своя y): сдвигаем вершины по padAt после постройки
    function liftToPads(bk, from) { for (let i = from * 3; i < bk.P.length; i += 3) { const p = padAt(bk.P[i], bk.P[i + 2]); if (p && bk.N[i + 1] > 0.9) bk.P[i + 1] += p.y; } }
    const vc0 = vc.n, at0 = at.n;
    padSurfaces();
    liftToPads(vc, vc0); liftToPads(at, at0);
    // бетон (фото-лестница, бортик двора) и тёмный металл (поручни, ограды, перила)
    const CONC = WIN ? rgb('#E4E8EC') : rgb('#D4D2CA'), METAL = rgb('#2E2D31');
    // лестницы: ступени и бортики — светлый бетон, как фото-лестница (своя, photoStair)
    STAIRS.forEach(s => {
      if (s.land) { photoStair(s); return; }
      const run = s.axis === 'z' ? s.z1 - s.z0 : s.x1 - s.x0, rise = s.yb - s.ya, n = Math.max(4, Math.round(Math.abs(rise) / 0.17)), w = s.axis === 'z' ? s.x1 - s.x0 : s.z1 - s.z0;
      for (let i = 0; i < n; i++) {
        const y = s.ya + rise * (i + 1) / n, a = run * i / n, b = run * (i + 1) / n;
        const tc = WIN ? mix(CONC, SNOW, 0.5) : CONC, tco = { col: tc, cols: { nz: mul(tc, 0.82), nx: mul(tc, 0.82) }, s: S.FLAT };
        if (s.axis === 'z') { const cz = s.z0 + (a + b) / 2, bot = Math.min(y - 0.45, hillY((s.x0 + s.x1) / 2, cz) - 0.25, hillY(s.x0, cz) - 0.25, hillY(s.x1, cz) - 0.25); at.box(F0, (s.x0 + s.x1) / 2, (y + bot) / 2, cz, w, y - bot, b - a, tco); }
        else { const cx = s.x0 + (a + b) / 2, bot = Math.min(y - 0.45, hillY(cx, (s.z0 + s.z1) / 2) - 0.25, hillY(cx, s.z0) - 0.25, hillY(cx, s.z1) - 0.25); at.box(F0, cx, (y + bot) / 2, (s.z0 + s.z1) / 2, b - a, y - bot, w, tco); }
      }
      // бортики по сторонам (бетон) с тёмной стойкой поручня
      [0, 1].forEach(k => { const steps = 6; for (let i = 0; i < steps; i++) { const t0_ = i / steps, t1_ = (i + 1) / steps, ya = lerp(s.ya, s.yb, t0_) + 0.85, yb = lerp(s.ya, s.yb, t1_) + 0.85;
        const lo = Math.min(ya, yb) - 0.85 - 0.6, hi = Math.max(ya, yb) - 0.85 + 0.45, cc = WIN ? mix(CONC, SNOW, 0.4) : mul(CONC, 0.95);
        if (s.axis === 'z') { const x = k ? s.x1 - 0.12 : s.x0 + 0.12, z0 = lerp(s.z0, s.z1, t0_), z1 = lerp(s.z0, s.z1, t1_); at.box(F0, x, (lo + hi) / 2, (z0 + z1) / 2, 0.24, hi - lo, z1 - z0, { col: cc, s: S.FLAT }); if (k) vc.cyl(x, (ya + yb) / 2 - 0.85 + 0.45, (z0 + z1) / 2, 0.035, 0.035, 0.5, { seg: 5, col: DARK }); }
        else { const z = k ? s.z1 - 0.12 : s.z0 + 0.12, x0 = lerp(s.x0, s.x1, t0_), x1 = lerp(s.x0, s.x1, t1_); at.box(F0, (x0 + x1) / 2, (lo + hi) / 2, z, x1 - x0, hi - lo, 0.24, { col: cc, s: S.FLAT }); } } });
    });

    // лестница по фото (h3–h5): длинная прямая из светлого бетона, площадка посередине, наклонные бетонные бортики,
    // тёмные поручни с обеих сторон, низкие тёплые столбики-фонари через ~3 м по обе стороны
    function photoStair(s) {
      const W = s.x1 - s.x0, xm = (s.x0 + s.x1) / 2, L = s.z1 - s.z0, cc = WIN ? mix(CONC, SNOW, 0.5) : CONC, ym = (s.ya + s.yb) / 2;
      const yAt = t => lerp(s.ya, s.yb, stairK(s, t)), zAt = t => s.z0 + L * t;
      const bottom = (cz, y) => Math.min(y - 0.45, hillY(xm, cz) - 0.25, hillY(s.x0 - 0.3, cz) - 0.25, hillY(s.x1 + 0.3, cz) - 0.25);
      [[0, s.land[0], s.ya, ym], [s.land[1], 1, ym, s.yb]].forEach(([t0, t1, y0, y1]) => { const n = Math.round(Math.abs(y1 - y0) / 0.17);
        for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * (i + 1) / n, za = zAt(lerp(t0, t1, i / n)), zb = zAt(lerp(t0, t1, (i + 1) / n)), cz = (za + zb) / 2, bot = bottom(cz, y);
          at.box(F0, xm, (y + bot) / 2, cz, W - 0.3, y - bot, zb - za, { col: cc, cols: { nz: mul(cc, 0.8) }, s: S.FLAT, skip: { pz: true, px: true, nx: true, ny: true } }); } });
      { const za = zAt(s.land[0]), zb = zAt(s.land[1]), cz = (za + zb) / 2, bot = bottom(cz, ym); at.box(F0, xm, (ym + bot) / 2, cz, W - 0.3, ym - bot, zb - za, { col: cc, s: S.FLAT }); }
      // бортики (наклонные по маршам) и поручни на стойках
      const T4 = [0, s.land[0], s.land[1], 1];
      [-1, 1].forEach(sd => { const xk = sd < 0 ? s.x0 + 0.075 : s.x1 - 0.075, xr = sd < 0 ? s.x0 + 0.1 : s.x1 - 0.1;
        for (let i = 0; i < 3; i++) { const za = zAt(T4[i]), zb = zAt(T4[i + 1]), ya = yAt(T4[i]), yb = yAt(T4[i + 1]), ga = Math.min(ya, hillY(xk + sd * 0.6, za)) - 0.5, gb = Math.min(yb, hillY(xk + sd * 0.6, zb)) - 0.5;
          vc.quadF([xk - 0.075, ya + 0.16, za], [xk + 0.075, ya + 0.16, za], [xk + 0.075, yb + 0.16, zb], [xk - 0.075, yb + 0.16, zb], cc, S.FLAT, [0, 1, 0]);
          [-1, 1].forEach(o => vc.quadF([xk + o * 0.075, ga, za], [xk + o * 0.075, gb, zb], [xk + o * 0.075, yb + 0.16, zb], [xk + o * 0.075, ya + 0.16, za], mul(cc, o === sd ? 0.92 : 0.86), S.FLAT, [o, 0, 0]));
          // поручень 0,95 м
          const h = 0.95; vc.quadF([xr - 0.025, ya + h, za], [xr + 0.025, ya + h, za], [xr + 0.025, yb + h, zb], [xr - 0.025, yb + h, zb], METAL, S.FLAT, [0, 1, 0]);
          [-1, 1].forEach(o => vc.quadF([xr + o * 0.025, ya + h - 0.05, za], [xr + o * 0.025, yb + h - 0.05, zb], [xr + o * 0.025, yb + h, zb], [xr + o * 0.025, ya + h, za], METAL, S.FLAT, [o, 0, 0])); }
        for (let z = s.z0 + 0.25; z < s.z1; z += 1.9) { const y = padAt(xr, z).y; vc.cyl(xr, y + 0.1, z, 0.025, 0.025, 0.85, { seg: 4, col: METAL, cap: false }); }
        // столбики-фонари снаружи бортика
        for (let z = s.z0 + 1.2; z < s.z1 - 0.5; z += 3.0) { const x = sd < 0 ? s.x0 - 0.4 : s.x1 + 0.4; bollard(x, hillY(x, z) - 0.03, z); } });
    }
    // металлическая ограда (фото h3): стойки через ~2,5 м, две перекладины, частые прутья — по краю двора к долине
    function fence(x0, x1, z, y) {
      const H = 1.3, fc = METAL, L = x1 - x0; if (L < 0.4) return;
      const np = Math.max(1, Math.round(L / 2.5));
      for (let i = 0; i <= np; i++) box(vc, F0, x0 + L * i / np, y, z, 0.06, H + 0.06, 0.06, fc, { skip: { ny: true } });
      [0.1, H - 0.05].forEach(h => vcD.quad([x0, y + h, z], [x1, y + h, z], [x1, y + h + 0.045, z], [x0, y + h + 0.045, z], fc));
      const nb = Math.round(L / 0.24); for (let i = 1; i < nb; i++) { const x = x0 + L * i / nb; vcD.quad([x - 0.012, y + 0.1, z], [x + 0.012, y + 0.1, z], [x + 0.012, y + H - 0.03, z], [x - 0.012, y + H - 0.03, z], fc); }
    }

    // края площадок: подпорная стенка до склона (вверх или вниз) + низкий парапет над обрывом
    const SEGS = edgeSegments();
    // смотровая площадка: настил, стеклянные перила с деревянным поручнем, опоры до склона
    { const P = PADS.find(q => q.id === 'deck'), cx = (P.x0 + P.x1) / 2, w = P.x1 - P.x0;
      for (let i = 0; i < 14; i++) { const z0 = P.z0 + i * (P.z1 - P.z0) / 14, z1 = z0 + (P.z1 - P.z0) / 14 - 0.03; vc.box(F0, cx, -0.04, (z0 + z1) / 2, w, 0.16, z1 - z0, { col: snowTop(i % 2 ? rgb('#B58B62') : rgb('#A9805A'), 0.8) }); }
      vc.box(F0, cx, -0.3, (P.z0 + P.z1) / 2, w - 0.2, 0.32, P.z1 - P.z0, { col: rgb('#7E5A3E'), skip: { py: true } });
      [[P.x0, 'x'], [P.x1, 'x'], [P.z0, 'z']].forEach(([c, ax]) => {
        if (ax === 'x') { glassB.quad([c, 0.08, P.z1], [c, 0.08, P.z0], [c, 1.05, P.z0], [c, 1.05, P.z1], rgb('#CFEAF5')); vc.box(F0, c, 1.08, (P.z0 + P.z1) / 2, 0.09, 0.07, P.z1 - P.z0, { col: rgb('#B58B62') }); }
        else { glassB.quad([P.x0, 0.08, c], [P.x1, 0.08, c], [P.x1, 1.05, c], [P.x0, 1.05, c], rgb('#CFEAF5')); vc.box(F0, cx, 1.08, c, w, 0.07, 0.09, { col: rgb('#B58B62') }); }
      });
      [[P.x0 + 0.3, P.z0 + 0.3], [P.x1 - 0.3, P.z0 + 0.3], [P.x0 + 0.3, (P.z0 + P.z1) / 2], [P.x1 - 0.3, (P.z0 + P.z1) / 2]].forEach(([x, z]) => { const g = hillY(x, z); vc.cyl(x, g - 0.3, z, 0.14, 0.14, -0.45 - g + 0.3, { seg: 6, col: rgb('#6E523C') }); vc.box(new K.Frame(x, 0, z, 0), 0, (g - 0.45) / 2 - 0.1, 0, 0.06, Math.max(0.5, -g * 0.7), 0.06, { col: rgb('#6E523C'), rot: 0.6 }); });
    }
    SEGS.forEach(sg => {
      if (sg.id === 'deck') return;
      // край двора к долине — низкий бетонный бортик и металлическая ограда (фото h3); бортики фото-лестницы — в photoStair
      const fenceEdge = sg.id === 'top' && sg.ax === 'z' && sg.sgn < 0, photo = sg.id === 'st_top', stE = /^st_/.test(sg.id);
      const n = Math.max(1, Math.ceil((sg.b - sg.a) / 2)), step = (sg.b - sg.a) / n;
      for (let i = 0; i < n; i++) {
        const a = sg.a + i * step, b = a + step, m = (a + b) / 2;
        // у лестницы — высота её проступи у этого куска (sg.y — максимум по всему краю)
        const ox = sg.ax === 'x' ? sg.c + sg.sgn * 0.6 : m, oz = sg.ax === 'z' ? sg.c + sg.sgn * 0.6 : m, hOut = hillY(ox, oz), st = stE && padAt(sg.ax === 'x' ? sg.c - sg.sgn * 0.05 : m, sg.ax === 'z' ? sg.c - sg.sgn * 0.05 : m), yP = st ? st.y : sg.y;
        const rd = ROAD.near(ox, oz), road = !!rd && rd.d < ROAD.w + 1.2;
        // снаружи склон вровень с площадкой или выше (откосы embank, у фото-лестницы — stairCut, стенки вверх): коллайдер края
        // 'edge' (Move: 'ledge') прыжок пропускает, а стенки рельефа, как раньше, тут нет — героиня скакала вверх по траве. Тонкая
        // сплошная коробка до y + 1,35 (выше прыжка; ниже 1,6 — камера её не видит), у дороги (ворота парковки) — нет. У лестниц —
        // кусками по 0,5 м от высоты верхнего конца куска (на 2 м марш поднимается на метр — через низкий конец перепрыгнула бы)
        // (склон «вровень» — по самой высокой из точек в 0,6 / 1,5 / 3 м: у мелкого уступа с горкой за ним скакала вверх по траве)
        const hUp = Math.max(hOut, ...[1.5, 3].map(o => hillY(sg.ax === 'x' ? sg.c + sg.sgn * o : m, sg.ax === 'z' ? sg.c + sg.sgn * o : m)));
        if (!fenceEdge && !road) { const ns = stE ? 4 : 1, sl = step / ns, yIn = t => { const p = padAt(sg.ax === 'x' ? sg.c - sg.sgn * 0.05 : t, sg.ax === 'z' ? sg.c - sg.sgn * 0.05 : t); return p ? p.y : yP; };
          for (let k = 0; k < ns; k++) { const q0 = a + k * sl, qm = q0 + sl / 2, yLo = stE ? Math.min(yIn(q0), yIn(q0 + sl)) : yP, yHi = stE ? Math.max(yIn(q0), yIn(q0 + sl)) : yP, ho = stE ? hillY(sg.ax === 'x' ? ox : qm, sg.ax === 'z' ? oz : qm) : hUp;
            if (ho > yLo - 0.35) colliders.push({ type: 'box', x: sg.ax === 'x' ? sg.c + sg.sgn * 0.15 : qm, z: sg.ax === 'z' ? sg.c + sg.sgn * 0.15 : qm, w: sg.ax === 'z' ? sl + 0.02 : 0.3, d: sg.ax === 'z' ? 0.3 : sl + 0.02, ry: 0, y0: yHi - 0.2, y1: yHi + 1.35, id: 'edgeUp', move: 'solid', noCar: true }); } }
        if (photo) continue;
        const lo = Math.min(hOut, yP) - 0.6, hi = fenceEdge ? yP + 0.14 : Math.max(hOut, yP) + (hOut < yP - 0.8 ? 0.7 : 0.05);
        const cx = sg.ax === 'x' ? sg.c + sg.sgn * 0.2 : m, cz = sg.ax === 'z' ? sg.c + sg.sgn * 0.2 : m, w = sg.ax === 'z' ? step + 0.02 : 0.4, d = sg.ax === 'z' ? 0.4 : step + 0.02;
        // склон подведён к площадке (откос, embank): вместо стенки — низкая стриженая изгородь по краю газона (граница видна:
        // за ней коробка края), у лестниц и дороги — травяной бортик вровень (у лестниц границу держат их бетонные бортики)
        if (!fenceEdge && Math.abs(hOut - yP) < 0.35) { const hg = !stE && !road, top = yP + (hg ? 0.55 : 0.02), gc = WIN ? rgb('#EEF2F6') : hg ? mix(LAWN, rgb('#5E8A4E'), 0.5) : mix(LAWN, rgb('#6E9636'), 0.3), gt = WIN ? SNOW : hg ? mix(LAWN, rgb('#6E9A58'), 0.3) : gc;
          vc.box(F0, cx, (lo + top) / 2, cz, w, top - lo, d, { col: gc, cols: { py: gt }, skip: { ny: true } }); continue; }
        at.box(F0, cx, (lo + hi) / 2, cz, w, hi - lo, d, fenceEdge || stE ? { col: stE ? (WIN ? mix(CONC, SNOW, 0.4) : mul(CONC, 0.95)) : CONC, s: S.FLAT } : { col: mix(hOut < yP ? C('rubbleY') : C('rubble'), rgb('#F4EFE4'), 0.42), s: hOut < yP - 3 ? S.BIG : S.ASHLAR });
        if (hOut < yP - 0.8 && !fenceEdge) { at.box(F0, cx, hi + 0.04, cz, w + (sg.ax === 'z' ? 0 : 0.12), 0.08, d + (sg.ax === 'z' ? 0.12 : 0), stE ? { col: WIN ? SNOW : CONC, s: S.FLAT } : { col: snowTop(C('parapetCap'), 0.9), s: S.ASHLAR }); }
      }
      if (fenceEdge) fence(sg.a, sg.b, sg.c - 0.2, sg.y + 0.14);
      const cx = sg.ax === 'x' ? sg.c : (sg.a + sg.b) / 2, cz = sg.ax === 'z' ? sg.c : (sg.a + sg.b) / 2;
      colliders.push({ type: 'box', x: cx, z: cz, w: sg.ax === 'z' ? sg.b - sg.a : 0.3, d: sg.ax === 'z' ? 0.3 : sg.b - sg.a, ry: 0, y0: sg.y - 1, y1: sg.y + 0.75, id: 'edge' });
    });

    // рельеф холма: полярная сетка от центра холма; под площадками — чуть ниже покрытия
    const TERR = {};
    function terrainNear() {
      const rings = []; { let r = 0, st = 2.0; while (r < 300) { rings.push(r); r += st; st = Math.min(9, st * 1.035 + 0.03); } rings.push(300); }
      const NA = HI ? 200 : 128, pos = [], col = [], idx = [];   // 4B: low — реже по кругу (−2 тыс. тр.)
      for (let i = 0; i < rings.length; i++) for (let j = 0; j <= NA; j++) {
        const a = j / NA * TAU, x = HC.x + Math.sin(a) * rings[i], z = HC.z + Math.cos(a) * rings[i], p0 = padAt(x, z), p = p0 && !p0.float ? p0 : null, y = p ? p.y - 0.35 : hillY(x, z);
        pos.push(x, y, z); col.push(...slopeCol(x, z, y, p));
      }
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      TERR.rings = rings; TERR.NA = NA;
      // волна 6: свой материал рельефа — со ступенями террас по горизонталям (шейдер terraceStripes, уровни как у HGRID)
      const tm = K.keep(K.vcMat.clone()); if (!K.BAKED) K.addRim(tm, 0.6);
      TERR.stripes = VK.terraceStripes(tm, { THREE: T, step: HGRID.step, phase: HGRID.phase, far: 700, dark: WIN ? [0.6, 0.62, 0.64] : [0.6, 0.7, 0.5], shrub: WIN ? 0.2 : 0.5 });
      return meshFrom(pos, col, idx, 'terrainNear', tm);
    }
    function slopeCol(x, z, y, p) {
      const n = VK.fbm(x * 0.03 + 3, z * 0.03 - 1, 3), m = VK.vnoise(x * 0.12, z * 0.12);
      if (WIN) return mix(rgb('#F2F5F8'), rgb('#C9D3DD'), n > 0.6 ? 0.55 : 0.08 * m);
      const r = ROAD.near(x, z);
      if (r && r.d < ROAD.w + 0.4) return mix(rgb('#B3A68E'), rgb('#9E927C'), m);      // дорога: укатанный щебень с колеями
      if (r && r.d < ROAD.w + 1.6) return mix(rgb('#9C9478'), rgb('#857E62'), m);      // обочина, камни (ограждений нет)
      // волна 6 (p11): сочная трава террас (тон ступеней), светлее и темнее пятнами
      let c = mix(rgb(VK.TPAL.bg[0]), rgb(VK.TPAL.bg[1]), m);
      c = mix(c, rgb('#6E9636'), sst(0.5, 0.7, n) * 0.4);
      return mul(c, 0.9 + 0.12 * m);
    }
    function meshFrom(pos, col, idx, name, mat) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new T.Mesh(K.keep(g), mat || K.vcMat); m.name = name; return m;
    }
    // дальний рельеф: естественный склон (как у серпантина), под селом — ниже (у далёкого села своя чаша), дымка по дальности
    function terrainFar() {
      const SP = V.regions.serpentine, rings = [], pos = [], col = [], idx = [], NA = HI ? 150 : 96;
      { let r = 280, st = 8; while (r < 1500) { rings.push(r); r += st; st = Math.min(60, st * (r < 760 ? 1.045 : 1.1)); } rings.push(1500); }
      const haze = WIN ? rgb('#E3EAF1') : rgb('#9DB4C4');
      for (let i = 0; i < rings.length; i++) for (let j = 0; j <= NA; j++) {
        const a = j / NA * TAU, x = HC.x + Math.sin(a) * rings[i], z = HC.z + Math.cos(a) * rings[i], M = toMacro(x, 0, z);
        const rho = Math.hypot(M.x + 11.2, M.z + 15.4), be = Math.atan2(M.x + 11.2, M.z + 15.4) / D2R;
        const serpW = SP && SP.groundCut ? sst(282, 300, rho) * sst(552, 534, rho) * sst(-9, 1, be) * sst(67, 57, be) : 0;
        let y = (serpW > 0 ? lerp(natMacro(M.x, M.z), SP.groundCut(M.x, M.z), serpW) : natMacro(M.x, M.z)) - FR.y;
        // чаша под селом и ядро села: ниже (там далёкое село со своим рельефом)
        const rC = Math.hypot(M.x, M.z - 96), sink = Math.max(9 * sst(305, 288, rho), M.z < 94 ? 16 * sst(150, 132, rC) : 0);
        y -= sink;
        if (rings[i] < 300) y = Math.min(y, hillY(x, z) - 0.8);   // стык с ближней сеткой — чуть ниже
        y = Math.max(y, hillRaw(x, z) - 1.2);
        // дальние склоны чуть волнистые (хребты ближе к горизонту)
        y += (VK.fbm(M.x * 0.004, M.z * 0.004, 3) - 0.5) * 40 * sst(700, 1100, rings[i]);
        pos.push(x, y, z);
        const d = rings[i], n = VK.fbm(M.x * 0.006 + 3.1, M.z * 0.006 - 1.7, 4);
        let c;
        if (WIN) c = mix(rgb('#F2F5F8'), rgb('#B9C4CF'), n > 0.56 ? 0.75 : 0.06);
        else { c = mix(mix(rgb('#88A946'), rgb('#5C803E'), sst(0.42, 0.62, n)), rgb('#B39A44'), sst(0.66, 0.78, VK.fbm(M.x * 0.009 - 4, M.z * 0.009, 3)) * 0.3); if (y < -120) c = mix(c, rgb('#5E8C44'), 0.4); }   // волна 6: зелёные склоны (p11)
        col.push(...mix(c, haze, clamp((d - 420) / 1100, 0, 0.75)));
      }
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const fm = K.keep(new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
      TERR.stripesFar = VK.terraceStripes(fm, { THREE: T, step: HGRID.step, phase: HGRID.phase, far: 1100, near: [30, 90], dark: WIN ? [0.6, 0.62, 0.64] : [0.6, 0.7, 0.5], shrub: WIN ? 0.2 : 0.5 });   // волна 6
      const m = meshFrom(pos, col, idx, 'terrainFar', fm);
      TERR.farBase = Float32Array.from(col); TERR.far = m; m.renderOrder = 6;
      return m;
    }

    /* ---------- 3.2 террасы на склонах холма — волна 6 (TERRACES, фото p11): мягкие зелёные ступени по горизонталям (общий
       построитель VILLAGE.vkit.terraces, стиль 'soft'): светлая проступь, скруглённая бровка, тёмный травяной откос с кустами
       (точки-спрайты), редкие одинокие деревья; стожки — изредка. Уровни — на сетке HGRID (как полосы шейдера на рельефе) ---------- */
    const TB = new K.Baker('vc'); let nBands = 0, nStacks = 0, nShrubs = 0;
    const TWb = new K.Baker('atlas');   // (прежние стенки сухой кладки; в стиле 'soft' пусто)
    // STACKS — стожки [x, z, r] (ROAD2: в них деревья и камни не ставим)
    const HGRID = { step: 2.1, phase: 0.3 }, SHR = [], SHRF = [], STACKS = [];
    function terraces() {
      const snowT = rgb('#F2F5F9');
      // у фото-лестницы — гладкий газонный склон с саженцами (h4), без ступеней
      const lawn = (x, z) => Math.abs(x - (ST_TOP.x0 + ST_TOP.x1) / 2) < 12.5 && z > ST_TOP.z0 - 1.5 && z < ST_TOP.z1 + 1;
      // (и не на травяных откосах у нижней и средней площадок — embank: там склон круче, ступени шли бы чаще, а на фото — газон)
      const ok = (x, z, f) => { if (f && (f.near ? !inNear(x, z) : f.outer && inNear(x, z))) return false; if (padAt(x, z) || sdUnion(x, z) < 2.5 || lawn(x, z)) return false; if (outD(x, z, P_LOW) < EMB || outD(x, z, P_MID) < EMB) return false; const rn = ROAD.near(x, z); if (rn && rn.d < 13) return false; return hillY(x, z) > -84; };   // волна 6: ниже по склону — до облаков (−90)
      // волна 6: одно поле по настоящим горизонталям вокруг холма (±300 м): ступени и на пологих холмах вокруг, как на p11
      // ближе к холму (±140 м) — полный профиль со скруглённой бровкой; дальше (до ±300 м) — проще (2 квада, реже точки)
      // (low: шаг ступени вдоль горизонтали 6,4 м у холма и 8,5 м дальше — виды со смотровой и с лестницы ≤ 200 тыс. треугольников
      // вместе с селом вдали)
      const NB = 140, inNear = (x, z) => Math.abs(x - HC.x) < NB && Math.abs(z - HC.z) < NB;
      const fields = [{ contour: { x0: HC.x - NB - 6, z0: HC.z - NB - 6, x1: HC.x + NB + 6, z1: HC.z + NB + 6, cell: 3 }, octaves: HI ? 2 : 1, near: true },
        { contour: { x0: HC.x - 300, z0: HC.z - 300, x1: HC.x + 300, z1: HC.z + 300, cell: 4 }, octaves: 2, far: true, lift: 0.3, segL: HI ? 6 : 8.5, outer: true }];
      const res = VK.terraces({ cx: HC.x, cz: HC.z, fields, surf: hillY, ok, tread: TB, wall: TB, winter: WIN, seed: 4343, segL: HI ? 4.0 : 6.4, dr: 1.5, lift: 0.3, shrubFar: true, wallDrop: 1.1, grid: HGRID, shrubs: SHR, shrubEvery: 8, pathEvery: 0,
        onBand: ({ pts }) => {
          const wide = pts.filter(q => q.okp && q.ww > 3.2);
          if (wide.length && R() < 0.05 && nStacks < 10) { const q = wide[Math.floor(R() * wide.length)], x = q.xm, z = q.zm, hh = 1.9 + R() * 0.6, rr = 0.85 + R() * 0.2, yy = q.y - 0.05;
            TB.cyl(x, yy, z, rr, 0.06, hh, { seg: 7, col: p => (WIN && p[1] > yy + hh * 0.45 ? snowT : mul(C('hay'), 0.82 + 0.22 * (p[1] - yy) / hh)) }); TB.cyl(x, yy + hh - 0.25, z, 0.04, 0.04, 0.7, { seg: 4, col: C('woodD') }); nStacks++; STACKS.push([x, z, rr]); }
          if (wide.length > 2 && R() < 0.16) { const q = wide[Math.floor(R() * wide.length)], t2 = 0.35 + R() * 0.3; addTree(lerp(q.xi, q.xo, t2), lerp(q.zi, q.zo, t2), 0.9 + R() * 0.45, 'lone', q.y - 0.1); }
        } });
      nBands = res.bands; nShrubs += res.shrubs;
    }
    // террасы на дальних склонах (макро, по горизонталям вокруг башни села, как поля села): склон с серпантином под отелем,
    // склоны слева и справа; полосы обходят дорогу серпантина и ветку к отелю, холм отеля и ядро села
    const FB = new K.Baker('vc'); let nFar = 0;
    function farFields() {
      const SP = V.regions.serpentine, TXo = -11.2, TZo = -15.4;
      const pts = SP ? (typeof SP.path === 'function' ? SP.path() : []).concat(typeof SP.hotelRoad === 'function' ? (SP.hotelRoad().points || []) : []) : [];
      const RQ = new Map(), RC = 16; pts.forEach(q => { const k = Math.floor(q.x / RC) + ',' + Math.floor(q.z / RC); if (!RQ.has(k)) RQ.set(k, []); RQ.get(k).push(q); });
      const nearRoad = (x, z, m) => { const kx = Math.floor(x / RC), kz = Math.floor(z / RC); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = RQ.get((kx + a) + ',' + (kz + b)); if (l) for (const q of l) if (Math.abs(q.x - x) < m && Math.abs(q.z - z) < m && Math.hypot(q.x - x, q.z - z) < m) return true; } return false; };
      const surfM = (X, Z) => { const rho = Math.hypot(X - TXo, Z - TZo), be = Math.atan2(X - TXo, Z - TZo) / D2R, w = SP && SP.groundCut ? sst(282, 300, rho) * sst(552, 534, rho) * sst(-9, 1, be) * sst(67, 57, be) : 0; return w > 0 ? lerp(natMacro(X, Z), SP.groundCut(X, Z), w) : natMacro(X, Z); };
      const okXZ = (X, Z) => { const L = toLocal(X, 0, Z); if (sdUnion(L.x, L.z) < 60) return false; if (Math.hypot(X, Z - 96) < 140 && Z < 100) return false; return !nearRoad(X, Z, 10); };
      // 4B: тот же общий построитель (дальние поля — проще: одна полоса проступи, стенки цветом)
      const rf = VK.terraces({ cx: TXo, cz: TZo, fields: [{ b0: 14, b1: 72, r0: 340, r1: 514, far: true }, { b0: 72, b1: 112, r0: 430, r1: 640, far: true }, { b0: -46, b1: 12, r0: 372, r1: 540, far: true }],
        surf: surfM, ok: okXZ, tread: FB, wall: FB, winter: WIN, seed: 4545, segL: HI ? 10 : 18, dr: 2.5, pathEvery: 0, grid: { step: HGRID.step, phase: HGRID.phase + FR.y }, shrubs: SHRF, shrubFar: true, shrubEvery: 16 });
      nFar = rf.bands; nShrubs += rf.shrubs;
      if (!FB.n) return null;
      const g = FB.build(); pivot.updateMatrix(); g.applyMatrix4(pivot.matrix); g.computeBoundingSphere();
      // дымка по дальности от отеля
      const pA = g.attributes.position, cA = g.attributes.color, hz = WIN ? rgb('#E3EAF1') : rgb('#9DB4C4');
      for (let i = 0; i < pA.count; i++) { const d = Math.hypot(pA.getX(i) - HC.x, pA.getZ(i) - HC.z), k = clamp((d - 380) / 1100, 0, 0.6); cA.setXYZ(i, lerp(cA.getX(i), hz[0], k), lerp(cA.getY(i), hz[1], k), lerp(cA.getZ(i), hz[2], k)); }
      // кусты дальних полей — в локальные оси и в ту же дымку
      { const v = new T.Vector3(); SHRF.forEach(q => { v.set(q[0], q[1], q[2]).applyMatrix4(pivot.matrix); q[0] = v.x; q[1] = v.y; q[2] = v.z; const k = clamp((Math.hypot(v.x - HC.x, v.z - HC.z) - 380) / 1100, 0, 0.6); q[4] = lerp(q[4], hz[0], k); q[5] = lerp(q[5], hz[1], k); q[6] = lerp(q[6], hz[2], k); }); }
      const m = new T.Mesh(g, K.vcMat); m.name = 'terracesFar'; return m;
    }
    const sdUnion = (x, z) => { let d = 1e9; PADS.forEach(p => { d = Math.min(d, sdRect(x, z, p, p.float ? 1 : 6)); }); STAIRS.forEach(s => { d = Math.min(d, sdRect(x, z, s, 0.5)); }); return d; };

    /* ---------- 3.3 деревья, камни ---------- */
    const TREE_COL = { young: ['#8FB04A', '#7FA040', '#9AB850'], lone: ['#2F5523', '#3A6229', '#284A1F'], fruit: ['#D9A23A', '#C8702A', '#B9A04A'], rowan: ['#D9682E', '#C8502A', '#E08A3A'], pine: ['#3E5E40', '#36533A', '#46684A'], birch: ['#E0B040', '#D9C050', '#C8A040'] };
    function treeItem(x, y, z, s, kind, rr = R) { const c = WIN ? (kind === 'pine' ? rgb('#E9EEF3') : rgb('#9A8E84')) : rgb(TREE_COL[kind][Math.floor(rr() * 3)]); return { p: [x, y, z], s: [s, s, s], r: [0, rr() * TAU, 0], c, kind }; }
    // ROAD2: пары крона+ствол (лоза перголы — крона без ствола, по индексу не сопоставить) — для посадки на видимую землю
    const TREES = [];
    function addTree(x, z, s, kind, y, rr) { const yy = y !== undefined ? y : groundY(x, z), c = treeItem(x, yy, z, s, kind, rr), t = { p: [x, yy, z], s: [s, s * (kind === 'pine' ? 0.8 : 1.6), s], c: [1, 1, 1] }; crowns.push(c); trunks.push(t); TREES.push({ c, t }); }

    /* ---------- общие помощники построек (баня, сауна, коттеджи): цвета, стекло, наличник, двускатная кровля ---------- */
    const WALLC = WIN ? [1.1, 1.08, 1.04] : [1.13, 1.04, 0.87], TRIMC = [1.16, 1.13, 1.05], ROOFC = WIN ? rgb('#9C5A48') : rgb('#9A4E3C'), ROOFD = rgb('#743A2E');
    const WOODW = rgb('#A86C43'), WOODL = rgb('#C99363'), WOODK = rgb('#7A4C30'), STONEW = [1.0, 0.95, 0.86], RUBC = mix(C('rubbleY'), [1, 1, 1], 0.42);
    const FLOWER_C = ['#D9455A', '#E8607A', '#F2B544', '#FFFFFF', '#C8507A'];
    // большое стекло: снизу темнее (отражение склона), кверху — небо; ночью DayNight ('window') и setNight теплят
    const PANE_T = WIN ? rgb('#CFDDE8') : rgb('#AFCBDD'), PANE_B = WIN ? rgb('#7E8E9A') : mix(rgb('#5F7383'), rgb('#8E7E6A'), 0.25);
    const paneCol = (yy, y0, y1) => { const t = clamp((yy - y0) / Math.max(0.1, y1 - y0), 0, 1); return mix(PANE_B, PANE_T, t * t * 0.9 + 0.05); };
    // кольцо-«крышка» (верх бортика): плоские четырёхугольники вверх (у вырожденного цилиндра нормаль огромная — пересвет)
    const ringTop = (bk, cx, y, cz, r0, r1, seg, col, st) => { for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU; bk.quadF([cx + Math.sin(a) * r0, y, cz + Math.cos(a) * r0], [cx + Math.sin(b) * r0, y, cz + Math.cos(b) * r0], [cx + Math.sin(b) * r1, y, cz + Math.cos(b) * r1], [cx + Math.sin(a) * r1, y, cz + Math.cos(a) * r1], col, st, [0, 1, 0]); } };
    // треугольник лицом к направлению dir (как quadF)
    const triF = (bk, a, b, c, col, dir) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) bk.tri(a, c, b, col); else bk.tri(a, b, c, col); };
    // наличник окна на плоскости фасада: 4 полосы (рамка) + подоконник; nrm — нормаль фасада (x, z), p — центр окна (мир)
    function casing(p, nrm, w, h, o = {}) {
      const t = o.t || 0.13, col = o.col || WOODW, lx = -nrm[1], lz = nrm[0], d = 0.05;   // lx/lz — вправо по фасаду (если смотреть на фасад)
      const P = (u, v, k = d) => [p[0] + lx * u + nrm[0] * k, p[1] + v, p[2] + lz * u + nrm[1] * k];
      const q = (u0, v0, u1, v1) => vc.quadF(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1), col, S.FLAT, [nrm[0], 0, nrm[1]]);
      q(-w / 2 - t, h / 2, w / 2 + t, h / 2 + t); q(-w / 2 - t, -h / 2 - t * 0.6, w / 2 + t, -h / 2); q(-w / 2 - t, -h / 2, -w / 2, h / 2); q(w / 2, -h / 2, w / 2 + t, h / 2);
      if (o.mull) q(-0.035, -h / 2, 0.035, h / 2);
      if (o.sill !== false) { const c = P(0, -h / 2 - t * 0.6 - 0.05, 0.1); vc.box(new K.Frame(c[0], c[1], c[2], Math.atan2(nrm[0], nrm[1])), 0, 0, 0, w + 0.36, 0.1, 0.2, { col: o.sillCol || TRIMC, skip: { nz: true } }); }
      if (o.flowers && !WIN) {   // ящик с геранью под окном
        const c = P(0, -h / 2 - 0.32, 0.2), F = new K.Frame(c[0], c[1], c[2], Math.atan2(nrm[0], nrm[1]));
        vc.box(F, 0, 0, 0, w + 0.1, 0.26, 0.24, { col: WOODK, skip: { nz: true } });
        for (let i = 0; i < 5; i++) { const q2 = F.p(-w / 2 + 0.1 + i * (w - 0.2) / 4, 0.2, 0.02); flowers.push({ p: q2, s: [0.13, 0.16, 0.13], c: rgb(FLOWER_C[(i + (o.seed | 0)) % FLOWER_C.length]) }); }
        const g = F.p(0, -0.18, 0.12); vc.box(new K.Frame(g[0], g[1], g[2], F.ry), 0, 0, 0, w * 0.8, 0.22, 0.06, { col: rgb('#5E8A4E'), skip: { nz: true } });
      }
    }
    // двускатная кровля над прямоугольником (мир): конёк вдоль оси ax ('x' | 'z'), карниз y0, конёк y1, свес o; ends — фронтоны (цвет стены)
    function gableRoof(x0, x1, z0, z1, y0, y1, ax, o, ends, ec) {
      const rc = snowTop(ROOFC, 0.9), th = 0.22, EC = ec || WALLC;
      if (ax === 'x') {
        const zm = (z0 + z1) / 2, hz = (z1 - z0) / 2, k = (y1 - y0) / hz, ye = y0 - k * o, xa = x0 - (ends ? o * 0.6 : 0), xb = x1 + (ends ? o * 0.6 : 0);
        vc.quadF([xa, ye, z0 - o], [xb, ye, z0 - o], [xb, y1, zm], [xa, y1, zm], rc, S.FLAT, [0, 1, -k]);
        vc.quadF([xa, ye, z1 + o], [xb, ye, z1 + o], [xb, y1, zm], [xa, y1, zm], rc, S.FLAT, [0, 1, k]);
        vc.quadF([xa, ye - th, z0 - o], [xb, ye - th, z0 - o], [xb, y1 - th, zm], [xa, y1 - th, zm], WOODK, S.FLAT, [0, -1, k]);
        vc.quadF([xa, ye - th, z1 + o], [xb, ye - th, z1 + o], [xb, y1 - th, zm], [xa, y1 - th, zm], WOODK, S.FLAT, [0, -1, -k]);
        vc.quadF([xa, ye - th, z0 - o], [xb, ye - th, z0 - o], [xb, ye, z0 - o], [xa, ye, z0 - o], WOODW, S.FLAT, [0, 0, -1]);
        vc.quadF([xa, ye - th, z1 + o], [xb, ye - th, z1 + o], [xb, ye, z1 + o], [xa, ye, z1 + o], WOODW, S.FLAT, [0, 0, 1]);
        vc.box(F0, (xa + xb) / 2, y1 + 0.05, zm, xb - xa, 0.14, 0.3, { col: snowTop(ROOFD, 0.9) });
        if (ends) [[x0, -1], [x1, 1]].forEach(([x, s]) => { triF(vc, [x, y0, z0], [x, y0, z1], [x, y1, zm], EC, [s, 0, 0]);
          [[z0 - o, ye], [z1 + o, ye]].forEach(([ze, yy]) => { vc.quadF([x + s * 0.62 * o, yy - th, ze], [x + s * 0.62 * o, y1 - th, zm], [x + s * 0.62 * o, y1 + 0.02, zm], [x + s * 0.62 * o, yy + 0.02, ze], WOODW, S.FLAT, [s, 0, 0]); }); });
      } else {
        const xm = (x0 + x1) / 2, hx = (x1 - x0) / 2, k = (y1 - y0) / hx, ye = y0 - k * o, za = z0 - (ends ? o * 0.6 : 0), zb = z1 + (ends ? o * 0.6 : 0);
        vc.quadF([x0 - o, ye, za], [x0 - o, ye, zb], [xm, y1, zb], [xm, y1, za], rc, S.FLAT, [-k, 1, 0]);
        vc.quadF([x1 + o, ye, za], [x1 + o, ye, zb], [xm, y1, zb], [xm, y1, za], rc, S.FLAT, [k, 1, 0]);
        vc.quadF([x0 - o, ye - th, za], [x0 - o, ye - th, zb], [xm, y1 - th, zb], [xm, y1 - th, za], WOODK, S.FLAT, [k, -1, 0]);
        vc.quadF([x1 + o, ye - th, za], [x1 + o, ye - th, zb], [xm, y1 - th, zb], [xm, y1 - th, za], WOODK, S.FLAT, [-k, -1, 0]);
        vc.quadF([x0 - o, ye - th, za], [x0 - o, ye - th, zb], [x0 - o, ye, zb], [x0 - o, ye, za], WOODW, S.FLAT, [-1, 0, 0]);
        vc.quadF([x1 + o, ye - th, za], [x1 + o, ye - th, zb], [x1 + o, ye, zb], [x1 + o, ye, za], WOODW, S.FLAT, [1, 0, 0]);
        vc.box(F0, xm, y1 + 0.05, (za + zb) / 2, 0.3, 0.14, zb - za, { col: snowTop(ROOFD, 0.9) });
        if (ends) [[z0, -1], [z1, 1]].forEach(([z, s]) => { if (ends === 'front' && s > 0) return; triF(vc, [x0, y0, z], [x1, y0, z], [xm, y1, z], EC, [0, 0, s]);
          [[x0 - o, -1], [x1 + o, 1]].forEach(([xe]) => { const zz = z + s * 0.62 * o; vc.quadF([xe, ye - th, zz], [xm, y1 - th, zz], [xm, y1 + 0.02, zz], [xe, ye + 0.02, zz], WOODW, S.FLAT, [0, 0, s]); }); });
      }
    }
    /* ---------- 3.4 главный корпус по фото (h1–h5, чертёж v2): один сливочный объём 39,7 × 21 м, широкий фронтон — к двору (−z),
       конёк вдоль z. По бокам три полных этажа (0–3,8 / 3,8–7,2 / 7,2–10,55 м, карниз 12,0 м), во фронтоне ещё два уровня
       (балконы 10,55 м, мансарда 13,95 м; стена до 19,2 м, конёк 19,7 м, уклон 20°). Бледно-розовая фальцевая кровля со
       снегозадержателями, терракотовые карнизные и ветровые доски 0,4 м, тёмный софит, желоба, 4 водостока на боковых стенах,
       4 кирпичные трубы с бетонными шапками. Тёмно-серые рамы без наличников, светлые отливы, у французских окон внизу
       решётка-ограждение; поясок над первым этажом; во фронтоне 4 широких окна с тёмными балконами; внизу — только 2 стеклянных
       портала со ступенями. Светло-серые рельефы: ступенчатый «домик» с плоским верхом, овальный медальон, ромбовые решётки,
       сбоку ромб-узел; пилястры и «домик» — с LED-линией (днём светлый рельеф, ночью тёплое золото в ночной сетке; углы не светятся).
       Без надписей, эмблем и знаков на фасаде ---------- */
    // штукатурка (множитель белой плитки атласа; на low свет запечён — множитель выше), рельефы и цоколь — в долях штукатурки
    // (low: свет запечён; стена на солнце ≈ 1,0 — без пересвета в белое, иначе рельефы на боку и зимой пропадают)
    // зимой — тёплая сливочная, а не белая (на снегу корпус не светлее снега)
    const HWALL = HI ? (WIN ? [0.98, 0.93, 0.85] : [0.96, 0.92, 0.86]) : WIN ? [0.85, 0.8, 0.71] : [1.06, 1.02, 0.95];
    const HREL = WIN ? mul(HWALL, 0.95) : [HWALL[0] * 0.95, HWALL[1] * 0.97, HWALL[2] * 1.0], HPLI = WIN ? mul(HWALL, 0.92) : [HWALL[0] * 0.88, HWALL[1] * 0.86, HWALL[2] * 0.8], HSILL = mix(HREL, [1.1, 1.1, 1.1], 0.4);
    const HFRAME = rgb('#3A393F'), HDOOR = rgb('#3A3934'), HROOF = HI ? rgb('#E2B3A9') : rgb('#EDC9C1'), HFASC = rgb('#CF6249'), HSOFF = rgb('#8A4A3B'), HGUT = rgb('#9C5B45');
    const HRAIL = rgb('#3F3432'), HSLAT = rgb('#5A4E46'), HBRICK = rgb('#B07468'), HCAP = rgb('#9A8F88');
    // стекло (цвет инстанса × плитка 3 атласа окон): небо в стекле; дверь балкона темнее; портал — тёмный холл; остеклённый низ — бирюзово-серый
    const GLASS = [1.28, 1.1, 1.14], GLASS_D = [0.86, 0.8, 0.88], PORTAL = [0.95, 0.92, 0.78], GLASS_CY = [0.95, 1.18, 1.22];
    // (сложением поверх ночной стены: зелёный и синий — с запасом ниже, иначе линия выходит белой, а не золотой)
    const LEDC = rgb('#FF8A10'), LEDGLOW = rgb('#FF9428');
    // ночная сетка (сложение, только ночью): LED-линии корпуса тёплым золотом с мягким ореолом, отблески фонарей на пруду
    const ledGlowB = new K.Baker('vc');
    function mainBuilding() {
      const M = MAIN, cx = (M.x0 + M.x1) / 2, zf = M.z0, zb = M.z1, HW = (M.x1 - M.x0) / 2, DEP = zb - zf, EV = M.eave, AP = M.apex, KP = (AP - EV) / HW;
      // свой генератор (какие окна горят ночью): число окон не сдвигает случайную раскладку двора и склонов
      const RB = rng(1610);
      // стены: P(u, v, k) — u вдоль стены (фронтон и тыл — от оси вправо, если смотреть снаружи; бока — от переднего угла назад),
      // v — вверх, k — наружу; n — нормаль (x, z); ry — поворот рамки (её +z — наружу)
      const FACE = {
        front: { P: (u, v, k = 0) => [cx - u, v, zf - k], n: [0, -1], ry: PI },
        back: { P: (u, v, k = 0) => [cx + u, v, zb + k], n: [0, 1], ry: 0 },
        west: { P: (u, v, k = 0) => [M.x0 - k, v, zf + u], n: [-1, 0], ry: -PI / 2 },
        east: { P: (u, v, k = 0) => [M.x1 + k, v, zf + u], n: [1, 0], ry: PI / 2 },
      };
      const DIR = f => [f.n[0], 0, f.n[1]];
      const nrm3 = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
      // прямоугольник на стене u0..u1 × v0..v1 (отступ k), четырёхугольник и треугольник по точкам стены
      const fq = (bk, f, u0, v0, u1, v1, k, col, s) => bk.quadF(f.P(u0, v0, k), f.P(u1, v0, k), f.P(u1, v1, k), f.P(u0, v1, k), col, s === undefined ? S.FLAT : s, DIR(f));
      const fq4 = (f, a, b, c, d, k, col, bk = vc) => bk.quadF(f.P(a[0], a[1], k), f.P(b[0], b[1], k), f.P(c[0], c[1], k), f.P(d[0], d[1], k), col, S.FLAT, DIR(f));
      const ftri = (bk, f, a, b, c, k, col, s) => { const A = f.P(a[0], a[1], k), B = f.P(b[0], b[1], k), Cc = f.P(c[0], c[1], k), n = nrm3(A, B, Cc), d = DIR(f); if (n[0] * d[0] + n[2] * d[2] < 0) bk.tri(A, Cc, B, col, s); else bk.tri(A, B, Cc, col, s); };
      // коробка у стены: центр по u, низ v, середина выноса k; w — вдоль стены, d — наружу
      const fb = (bk, f, u, v, k, w, h, d, o) => { const c = f.P(u, v, k); bk.box(new K.Frame(c[0], c[1], c[2], f.ry), 0, h / 2, 0, w, h, d, o); };
      // полоса по отрезку a→b (u, v) шириной wd в плоскости стены; концы продлены на полширины — стыки без щелей
      const fseg = (bk, f, a, b, wd, k, col) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy * wd / 2, py = ux * wd / 2, ex = ux * wd / 2, ey = uy * wd / 2;
        bk.quadF(f.P(a[0] - ex + px, a[1] - ey + py, k), f.P(a[0] - ex - px, a[1] - ey - py, k), f.P(b[0] + ex - px, b[1] + ey - py, k), f.P(b[0] + ex + px, b[1] + ey + py, k), col, S.FLAT, DIR(f)); };
      // LED-линия: днём — светлая полоса рельефа в общей сетке корпуса; ночью поверх — светящаяся полоса и ореол (две полосы
      // от оси к краям: у края чёрный — при сложении не виден) в ночной сетке
      const led = (f, a, b, k) => {
        fseg(vc, f, a, b, 0.14, k - 0.004, HSILL);
        fseg(ledGlowB, f, a, b, 0.16, k + 0.006, LEDC);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = -dy / L * 0.45, py = dx / L * 0.45, z0 = [0, 0, 0];
        [1, -1].forEach(sg => ledGlowB.quad(f.P(a[0], a[1], k + 0.01), f.P(b[0], b[1], k + 0.01), f.P(b[0] + sg * px, b[1] + sg * py, k + 0.01), f.P(a[0] + sg * px, a[1] + sg * py, k + 0.01), [LEDGLOW, LEDGLOW, z0, z0]));
      };
      // цоколь высотой h (на 3 см вперёд), с разрывами под порталами и дверями
      const plinth = (f, u0, u1, holes = [], h = 0.6) => { let a = u0; holes.concat([[u1, u1]]).forEach(([h0, h1]) => { if (h0 - a > 0.05) fb(vc, f, (a + h0) / 2, 0, 0.015, h0 - a, h, 0.03, { col: HPLI, skip: { nz: true, ny: true } }); a = h1; }); };

      // стены — гладкая сливочная штукатурка; фронтоны — пятиугольник
      ['front', 'back'].forEach(id => { const f = FACE[id]; fq(at, f, -HW, 0, HW, EV, 0, HWALL, S.FLAT); ftri(at, f, [-HW, EV], [HW, EV], [0, AP], 0, HWALL, S.FLAT); });
      ['west', 'east'].forEach(id => fq(at, FACE[id], 0, 0, DEP, EV, 0, HWALL, S.FLAT));
      plinth(FACE.front, -HW - 0.03, HW + 0.03, [[-9.7, -4.5], [4.5, 9.7]]); plinth(FACE.back, -HW - 0.03, HW + 0.03);
      plinth(FACE.west, -0.03, DEP + 0.03, [[5.7, 8.3], [14.5, 16.7]], 0.7); plinth(FACE.east, -0.03, DEP + 0.03, [], 0.4);
      // поясок над первым этажом (только фронтон): тонкая тяга в цвет стены — читается линией тени
      fb(vc, FACE.front, 0, 3.8, 0.02, 2 * HW, 0.15, 0.04, { col: HWALL, cols: { ny: mul(HWALL, 0.6) }, skip: { nz: true } });

      // кровля: два ската от конька (x = cx), свесы MROOF (1,5 м по бокам, 0,9 м над фронтонами), толщина 0,45; стоячие фальцы
      // каждые 0,5 м вниз по скату (полоса ROOF, своя развёртка: u — вдоль z); снизу тёмный терракотовый софит; по кромкам
      // терракотовые доски 0,5 м
      const OV = MROOF.ov, OG = MROOF.og, TH = MROOF.th, FD = 0.5, za = zf - OG, zz = zb + OG, yR = AP + TH, xE = HW + OV, yE = yR - KP * xE, sl = Math.hypot(xE, yR - yE);
      const roofY = x => yR - KP * Math.abs(x - cx);
      const quv = (bk, a, b, c, d, col, s, uv, dir) => { const n = nrm3(a, b, c); if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) bk.quad(d, c, b, a, col, s, [uv[3], uv[2], uv[1], uv[0]]); else bk.quad(a, b, c, d, col, s, uv); };
      [-1, 1].forEach(sx => {
        const xe = cx + sx * xE, fc2 = mul(HFASC, 0.8), fc3 = mul(HFASC, 0.68), xi = xe - sx * 0.04;
        quv(at, [xe, yE, za], [xe, yE, zz], [cx, yR, zz], [cx, yR, za], HROOF, S.ROOF, [[za / 2, 0], [zz / 2, 0], [zz / 2, sl / 0.5], [za / 2, sl / 0.5]], [sx * KP, 1, 0]);
        vc.quadF([xe, yE - TH, za], [xe, yE - TH, zz], [cx, yR - TH, zz], [cx, yR - TH, za], HSOFF, S.FLAT, [-sx * KP, -1, 0]);
        // карнизная доска (с изнанкой и нижней кромкой) и желоб
        vc.quadF([xe, yE - FD, za], [xe, yE - FD, zz], [xe, yE + 0.03, zz], [xe, yE + 0.03, za], HFASC, S.FLAT, [sx, 0, 0]);
        vc.quadF([xi, yE - FD, za], [xi, yE - FD, zz], [xi, yE - TH, zz], [xi, yE - TH, za], fc2, S.FLAT, [-sx, 0, 0]);
        vc.quadF([xi, yE - FD, za], [xi, yE - FD, zz], [xe, yE - FD, zz], [xe, yE - FD, za], fc3, S.FLAT, [0, -1, 0]);
        box(vc, F0, xe + sx * 0.11, yE - 0.5, (za + zz) / 2, 0.2, 0.17, zz - za - 0.1, HGUT, { skip: { pz: true, nz: true } });
        // ветровые доски над фронтонами (спереди и сзади), тоже с изнанкой и кромкой
        [[za, -1], [zz, 1]].forEach(([z, sz]) => { const zi = z - sz * 0.04;
          vc.quadF([xe, yE - FD, z], [cx, yR - FD, z], [cx, yR + 0.03, z], [xe, yE + 0.03, z], HFASC, S.FLAT, [0, 0, sz]);
          vc.quadF([xe, yE - FD, zi], [cx, yR - FD, zi], [cx, yR - TH, zi], [xe, yE - TH, zi], fc2, S.FLAT, [0, 0, -sz]);
          vc.quadF([xe, yE - FD, z], [cx, yR - FD, z], [cx, yR - FD, zi], [xe, yE - FD, zi], fc3, S.FLAT, [-sx * KP, -1, 0]); });
        // водосточные трубы на боковых стенах (в 0,4 м от углов); отвод к низу желоба — наклонный, вдоль софита (как на h2;
        // длинное горизонтальное плечо ниже софита бросало на стену тень-«флаг»)
        [zf + 0.4, zb - 0.4].forEach(z => { const x = cx + sx * (HW + 0.14), xg = xe + sx * 0.11, y1 = yE - 0.75, y2 = yE - 0.45, e = 0.05;
          vc.cyl(x, 0.15, z, 0.08, 0.08, y1 - 0.1, { seg: 6, col: HGUT, cap: false });
          [1, -1].forEach(sy => vc.quadF([x, y1 + sy * e, z - e], [xg, y2 + sy * e, z - e], [xg, y2 + sy * e, z + e], [x, y1 + sy * e, z + e], HGUT, S.FLAT, [0, sy, 0]));
          [-1, 1].forEach(sz => vc.quadF([x, y1 - e, z + sz * e], [xg, y2 - e, z + sz * e], [xg, y2 + e, z + sz * e], [x, y1 + e, z + sz * e], HGUT, S.FLAT, [0, 0, sz])); });
        // снегозадержатели: светлая трубка вдоль ската в ~3 м от карниза
        { const d = xE - 2.8; box(vc, F0, cx + sx * d, roofY(cx + sx * d) + 0.06, (za + zz) / 2, 0.06, 0.06, zz - za - 0.8, rgb('#DAD6D0'), { skip: { pz: true, nz: true, ny: true } }); }
      });
      // конёк — тонкая планка чуть темнее кровли
      box(at, F0, cx, yR - 0.04, (za + zz) / 2, 0.34, 0.12, zz - za + 0.04, mul(HROOF, 0.84), { s: S.FLAT, skip: { ny: true } });
      // кирпичные трубы: по две на скат (одна — вытянутая), бетонная шапка с выносом, поясок под ней
      MROOF.chim.forEach(([X, dz, w, hh]) => { const x = cx - X, z = zf + dz, ys = roofY(x) + KP * w / 2;
        box(vc, F0, x, ys - 0.9, z, w, hh + 0.9, 0.9, HBRICK, { skip: { ny: true } });
        box(vc, F0, x, ys + hh, z, w + 0.2, 0.15, 1.1, HCAP);
        box(vc, F0, x, ys + hh - 0.3, z, w + 0.04, 0.07, 0.94, mul(HBRICK, 0.8), { skip: { ny: true, py: true } }); });

      // ---- окна: стекло — плитка 3 атласа окон (ночью ~15 % теплеют), рамы, решётки и отливы — поверх ----
      const lit = () => (RB() < 0.15 ? 1 : 0);
      // рама по краю проёма — закрывает белую кромку плитки
      const frame4 = (f, u, v0, w, h, t, k, col) => { const u0 = u - w / 2, u1 = u + w / 2, v1 = v0 + h; fq(vc, f, u0, v0, u1, v0 + t, k, col); fq(vc, f, u0, v1 - t, u1, v1, k, col); fq(vc, f, u0, v0 + t, u0 + t, v1 - t, k, col); fq(vc, f, u1 - t, v0 + t, u1, v1 - t, k, col); };
      // flip — плитка повёрнута на 180° (её фрамуга внизу, за ограждением)
      const glass = (f, u, v0, w, h, flip, col, glow) => glaz.push({ p: f.P(u, v0 + h / 2, 0.02), r: [0, f.ry, flip ? PI : 0], s: [w, h, 1], tile: 3, c: col || GLASS, glow: glow === undefined ? lit() : glow });
      // перемычка поверх линии фрамуги плитки (25–28 % высоты от её верха)
      const tileBar = (f, u, v0, w, h, flip, t, k, col) => { const a = flip ? v0 + h * 0.25 : v0 + h * 0.718, b = flip ? v0 + h * 0.282 : v0 + h * 0.75; fq(vc, f, u - w / 2 + t, a, u + w / 2 - t, b, k, col); };
      // светлый отлив под окном
      const sill = (f, u, v0, w) => fq(vc, f, u - w / 2 - 0.05, v0 - 0.06, u + w / 2 + 0.05, v0, 0.055, HSILL);
      // французское окно (h1): рама, импост, низкая фрамуга, решётка-ограждение до bars м (5 прутьев на low, 9 на high)
      function frWin(f, u, v0, w, h, o = {}) {
        const t = 0.09, k = 0.045, fl = o.flip !== false;
        glass(f, u, v0, w, h, fl, o.glass, o.glow);
        frame4(f, u, v0, w, h, t, k, HFRAME); tileBar(f, u, v0, w, h, fl, t, k, HFRAME);
        if (o.mull !== false) fq(vc, f, u - 0.035, v0 + t, u + 0.035, v0 + h - t, k, HFRAME);
        if (o.bars) { const gh = o.bars, nb = HI ? 9 : 5; fq(vc, f, u - w / 2 + t, v0 + gh - 0.03, u + w / 2 - t, v0 + gh + 0.03, k + 0.012, HRAIL);
          for (let i = 1; i <= nb; i++) { const ub = u - w / 2 + t + (w - 2 * t) * i / (nb + 1); fq(vc, f, ub - 0.014, v0 + t, ub + 0.014, v0 + gh, k + 0.012, HRAIL); } }
        if (o.sill !== false) sill(f, u, v0, w);
      }
      // маленькое горизонтальное окно (колонки C/L): две равные створки (по плитке на створку, фрамуга плитки — вверху), импост посередине
      function smWin(f, u, v0, w, h) {
        const g = lit();
        [-1, 1].forEach(sg => { glass(f, u + sg * w / 4, v0, w / 2, h, false, GLASS, g); tileBar(f, u + sg * w / 4, v0, w / 2, h, false, 0.06, 0.045, HFRAME); });
        frame4(f, u, v0, w, h, 0.08, 0.045, HFRAME); fq(vc, f, u - 0.045, v0 + 0.08, u + 0.045, v0 + h - 0.08, 0.045, HFRAME); sill(f, u, v0, w);
      }
      // широкое окно уровня 4: n створок, вторая слева — дверь на балкон (темнее)
      function wideWin(f, u, v0, w, h, n) {
        const wl = w / n, g = lit();
        for (let i = 0; i < n; i++) glass(f, u - w / 2 + wl * (i + 0.5), v0, wl, h, true, i === 1 ? GLASS_D : GLASS, g);
        frame4(f, u, v0, w, h, 0.1, 0.045, HFRAME);
        for (let i = 1; i < n; i++) fq(vc, f, u - w / 2 + wl * i - 0.06, v0 + 0.1, u - w / 2 + wl * i + 0.06, v0 + h - 0.1, 0.045, HFRAME);
        for (let i = 0; i < n; i++) tileBar(f, u - w / 2 + wl * (i + 0.5), v0, wl, h, true, 0.05, 0.045, HFRAME);
      }
      // стеклянная дверь (ночью тёплая, фрамуга светится) со светильником над ней
      function doorGl(f, u, v0, w, h, dbl) {
        glass(f, u, v0, w, h, false, PORTAL, 1); frame4(f, u, v0, w, h, 0.1, 0.05, HDOOR); tileBar(f, u, v0, w, h, false, 0.1, 0.05, HDOOR);
        if (dbl) fq(vc, f, u - 0.04, v0 + 0.1, u + 0.04, v0 + h * 0.72, 0.05, HDOOR);
        fb(vc, f, u, v0 + h + 0.28, 0.08, 0.16, 0.07, 0.16, { col: HFRAME, skip: { nz: true } }); NIGHT.lamps.push(f.P(u, v0 + h + 0.24, 0.35));
      }
      // балкон: плита (низ v), ограждение высотой H из n горизонтальных планок спереди и по бокам, стойки, поручень (тёмный металл)
      function balcony(f, u, v, w, d, col, n, H) {
        fb(vc, f, u, v, d / 2, w, 0.15, d, { col: mul(col, 1.3), skip: { nz: true } });
        const y0 = v + 0.15, sh = 0.11, st = (H - 0.16) / n;
        for (let i = 0; i < n; i++) { const yy = y0 + 0.1 + i * st;
          fb(vc, f, u, yy, d - 0.02, w, sh, 0.04, { col, skip: { nz: true, ny: true } });
          [-1, 1].forEach(sg => fb(vc, f, u + sg * (w / 2 - 0.02), yy, d / 2, 0.04, sh, d - 0.04, { col, skip: { nz: true, ny: true } })); }
        fb(vc, f, u, y0 + H - 0.06, d - 0.03, w + 0.04, 0.06, 0.07, { col: mul(col, 0.9), skip: { nz: true } });
        [-1, 1].forEach(sg => fb(vc, f, u + sg * (w / 2 - 0.02), y0 + H - 0.06, d / 2, 0.06, 0.06, d, { col: mul(col, 0.9), skip: { nz: true } }));
        [-1, 0, 1].forEach(sg => fb(vc, f, u + sg * (w / 2 - 0.03), y0, d - 0.02, 0.05, H - 0.06, 0.05, { col, skip: { nz: true, py: true, ny: true } }));
      }
      // ---- рельефы (светло-серые, чуть выступают; под каждым — тёмная кайма-тень, иначе светлое на сливочном не читается):
      // эллипс-кольцо, ромб ----
      const RSH = mul(HWALL, 0.76);
      const rring = (f, u, v, rx, ry, t, n, k, col, sh = true) => { if (sh) rring(f, u, v, rx + 0.06, ry + 0.06, t + 0.12, n, k - 0.025, RSH, false); for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU; fq4(f, [u + Math.cos(a) * rx, v + Math.sin(a) * ry], [u + Math.cos(b) * rx, v + Math.sin(b) * ry], [u + Math.cos(b) * (rx - t), v + Math.sin(b) * (ry - t)], [u + Math.cos(a) * (rx - t), v + Math.sin(a) * (ry - t)], k, col); } };
      // ромб с r1 = 0 — сплошной: четыре треугольника к центру (вырожденный квад на обращённой грани давал нулевую нормаль — чёрное пятно на high)
      const rdiamond = (f, u, v, r0, r1, k, col, sh = true) => { if (sh) rdiamond(f, u, v, r0 + 0.09, Math.max(0, r1 - 0.09), k - 0.025, RSH, false); const P4 = r => [[u, v + r], [u + r, v], [u, v - r], [u - r, v]], A = P4(r0), B = P4(r1);
        for (let i = 0; i < 4; i++) { if (r1 > 0.005) fq4(f, A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i], k, col); else ftri(vc, f, A[i], A[(i + 1) % 4], [u, v], k, col); } };
      // ромбовая решётка: серое поле, светлые ромбы в шахматном порядке
      function lattice(f, u, v, w, h) {
        fq(vc, f, u - w / 2, v - h / 2, u + w / 2, v + h / 2, 0.03, mul(HWALL, 0.84));
        const u0 = u - w / 2 + 0.12, u1 = u + w / 2 - 0.12, v0 = v - h / 2 + 0.12, v1 = v + h / 2 - 0.12, hx = 0.21, hy = 0.21;
        for (let j = 0; v0 + hy + j * 0.25 + hy <= v1 + 1e-6; j++) for (let i = 0; ; i++) { const cu = u0 + hx + (j % 2) * 0.25 + i * 0.5, cv = v0 + hy + j * 0.25; if (cu + hx > u1 + 1e-6) break; fq4(f, [cu, cv + hy], [cu + hx, cv], [cu, cv - hy], [cu - hx, cv], 0.045, HREL); }
      }

      // ---- фронтон к двору (фото h1, симметричен; колонки — по чертежу v2) ----
      const Fr = FACE.front, L2 = 4.3, L3 = 7.65, WH = 2.45;
      [-1, 1].forEach(s => {
        // этажи 2–3: французские окна 1,6 × 2,45 — 4 пары в середине (D–I) и колонки B/M, A/N; решётка-ограждение по нижний 1,0 м
        [1.15, 3.5, 6.0, 8.55, 14.1, 17.9].forEach(X => [L2, L3].forEach(v0 => frWin(Fr, s * X, v0, 1.6, WH, { bars: 1.0 })));
        // колонки C/L: по два малых окна 2,1 × 0,8 на этажах 2, 3 и на уровне 4
        [[4.3, 5.1], [5.95, 6.75], [7.65, 8.5], [9.25, 10.1], [11.1, 11.9], [12.7, 13.5]].forEach(([a, b]) => smWin(Fr, s * 11.35, a, 2.1, b - a));
        // уровень 4: короткое окно B/M под скатом; широкие окна с балконами 4,3 × 1,1 над парами окон
        frWin(Fr, s * 14.1, 11.0, 1.6, 2.0, { bars: 1.0 });
        [[2.3, 4.0], [7.3, 4.15]].forEach(([X, w]) => { wideWin(Fr, s * X, 10.9, w, 2.6, 4); balcony(Fr, s * X, 10.55, 4.3, 1.1, HRAIL, HI ? 6 : 5, 1.15); });
        // портал под парой D–E: светлое обрамление 0,25, 4 стекла в тёмной раме (двери — средняя пара), тёмная фрамуга 0,5 м;
        // две ступени по 0,17 и площадка 5,3 × 1,5 (коллайдер — к стеклу не подходим); ночью тёплый холл и два светильника
        { const u = s * 7.1, w = 4.7, v0 = 0.4, h = 2.9, hg = h - 0.5;
          fq(vc, Fr, u - w / 2 - 0.25, 0.3, u + w / 2 + 0.25, v0 + h + 0.25, 0.012, HREL);
          for (let i = 0; i < 4; i++) glass(Fr, u - w / 2 + w / 4 * (i + 0.5), v0, w / 4, hg, true, PORTAL, 1);
          fq(vc, Fr, u - w / 2, v0 + hg, u + w / 2, v0 + h, 0.04, HDOOR);
          frame4(Fr, u, v0, w, h, 0.12, 0.05, HDOOR);
          for (let i = 1; i < 4; i++) fq(vc, Fr, u - w / 2 + w / 4 * i - 0.05, v0 + 0.12, u - w / 2 + w / 4 * i + 0.05, v0 + hg, 0.05, HDOOR);
          for (let i = 0; i < 4; i++) tileBar(Fr, u - w / 2 + w / 4 * (i + 0.5), v0, w / 4, hg, true, 0.05, 0.05, HDOOR);
          [-1.4, 1.4].forEach(du => fb(vc, Fr, u + du, v0 + h + 0.36, 0.08, 0.18, 0.07, 0.16, { col: HFRAME, skip: { nz: true } }));
          const stc = snowTop(mix(HPLI, [1.05, 1.05, 1.05], 0.35), 0.9);
          fb(vc, Fr, u, 0, 0.75, 5.3, 0.34, 1.5, { col: stc, skip: { nz: true, ny: true } });
          fb(vc, Fr, u, 0, 1.675, 5.3, 0.17, 0.35, { col: stc, skip: { nz: true, ny: true } });
          // две ступени — два коллайдера (подъём по 0,17 < boxStep: заходит шагом)
          const c1 = Fr.P(u, 0, 0.75), c2 = Fr.P(u, 0, 1.675); colBox(c1[0], c1[2], 5.4, 1.5, -1, 0.34, 'steps'); colBox(c2[0], c2[2], 5.4, 0.37, -1, 0.17, 'steps'); }
        // пилястра с LED-линией (в 3,9 м от угла; сам угол не светится) и светильник у подножия
        { const u = s * 16.0; fb(vc, Fr, u, 1.1, 0.03, 0.5, 11.9, 0.06, { col: HREL, skip: { nz: true } }); led(Fr, [u, 1.18], [u, 12.92], 0.068);
          fb(vc, Fr, u, 0, 0.2, 0.32, 0.16, 0.32, { col: HFRAME, skip: { nz: true } }); }
        // ромбовые решётки 2,1 × 1,3 во фронтоне над внешними широкими окнами
        lattice(Fr, s * 7.45, 14.95, 2.1, 1.3);
      });
      // ступенчатый «домик» (полоса 0,4 м, плоский верх) с LED-линией по оси; ореол — ровный, вдоль линии в ночной сетке (без точек
      // NIGHT.lamps: их ореолы и «звёздочки» делали из линии гирлянду из пяти шаров, на h2/h5 линия ровная)
      const HOUSE = [[-4.2, 13.95], [-4.2, 15.1], [-1.3, 16.4], [-1.3, 17.7], [1.3, 17.7], [1.3, 16.4], [4.2, 15.1], [4.2, 13.95]];
      for (let i = 0; i < HOUSE.length - 1; i++) { fseg(vc, Fr, HOUSE[i], HOUSE[i + 1], 0.52, 0.02, RSH); fseg(vc, Fr, HOUSE[i], HOUSE[i + 1], 0.4, 0.05, HREL); led(Fr, HOUSE[i], HOUSE[i + 1], 0.066); }
      // овальный медальон под «башенкой» домика: поле, два кольца и лепестки (обычный орнамент, без букв)
      { const u = 0, v = 15.0, rx = 1.9, ry = 0.85, fill = mul(HWALL, 0.93);
        for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, b = (i + 1) / 20 * TAU; ftri(vc, Fr, [u, v], [u + Math.cos(a) * rx, v + Math.sin(a) * ry], [u + Math.cos(b) * rx, v + Math.sin(b) * ry], 0.035, fill); }
        rring(Fr, u, v, rx, ry, 0.13, 20, 0.05, HREL); rring(Fr, u, v, rx * 0.42, ry * 0.42, 0.08, 12, 0.05, HREL);
        for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; fseg(vc, Fr, [u + Math.cos(a) * rx * 0.46, v + Math.sin(a) * ry * 0.46], [u + Math.cos(a) * rx * 0.84, v + Math.sin(a) * ry * 0.84], 0.07, 0.05, HREL); } }

      // ---- тыл (фото нет): та же сетка окон, без порталов, балконов и рельефов ----
      const Bk = FACE.back;
      [-1, 1].forEach(s => {
        [1.15, 3.5, 6.0, 8.55, 14.1, 17.9].forEach(X => [L2, L3].forEach(v0 => frWin(Bk, s * X, v0, 1.6, WH, {})));
        [[4.3, 5.1], [5.95, 6.75], [7.65, 8.5], [9.25, 10.1]].forEach(([a, b]) => smWin(Bk, s * 11.35, a, 2.1, b - a));
        [[2.3, 4.0], [7.3, 4.15]].forEach(([X, w]) => { wideWin(Bk, s * X, 11.0, w, 2.3, 4); frWin(Bk, s * X, 0.9, 1.6, 2.1, {}); });
        frWin(Bk, s * 14.1, 11.0, 1.6, 2.0, {});
      });

      // ---- бок к парковке (фото h2, u — от переднего угла): ромб-узел, колонка окон с балконом, две стеклянные двери;
      // место надписи под ромбом — пустая штукатурка; LED на этом боку нет ----
      const Wf = FACE.west;
      { const u = 4.8, v = 9.25; rdiamond(Wf, u, v, 1.5, 1.32, 0.05, HREL); rdiamond(Wf, u, v, 1.17, 1.02, 0.05, HREL);
        [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]].forEach(([du, dv]) => rring(Wf, u + du, v + dv, 0.32, 0.32, 0.07, 12, 0.05, HREL));
        rdiamond(Wf, u, v, 0.22, 0.0, 0.05, HREL); }
      frWin(Wf, 10.3, 7.9, 1.6, 2.4, { bars: 1.0 });
      frWin(Wf, 10.3, 4.0, 1.6, 2.9, {});
      balcony(Wf, 11.2, 3.65, 3.6, 1.2, HSLAT, HI ? 6 : 4, 1.2);
      // балкон низко над полосой у бока (из-под перголы камера за героиней заходила в него)
      { const c = Wf.P(11.2, 0, 0.6); camColliders.push({ type: 'box', x: c[0], z: c[2], w: 1.4, d: 3.8, ry: 0, y0: 3.5, y1: 5.2, id: 'balconyCam', cam: true }); }
      doorGl(Wf, 7.0, 0.15, 2.4, 3.15, true); doorGl(Wf, 15.6, 0.15, 2.0, 3.15, true);

      // ---- бок к бассейну (фото h4/h5, u — от переднего угла): остеклённый низ во всю длину (5 пролётов, светлые импосты,
      // ночью тёплый), две колонки окон, две LED-пилястры у углов — до софита ----
      const Ef = FACE.east;
      [7.5, 13.5].forEach(u => [L2, L3].forEach(v0 => frWin(Ef, u, v0, 1.5, WH, {})));
      { const CW = (19.8 - 1.2) / 5, LGT = mix(HREL, [1.1, 1.1, 1.1], 0.3);
        for (let i = 0; i < 5; i++) { const u = 1.2 + CW * (i + 0.5);
          glass(Ef, u, 0.4, CW, 3.0, false, GLASS_CY, 1); frame4(Ef, u, 0.4, CW, 3.0, 0.08, 0.045, LGT); tileBar(Ef, u, 0.4, CW, 3.0, false, 0.08, 0.045, LGT);
          fq(vc, Ef, u - 0.04, 0.48, u + 0.04, 0.4 + 3.0 * 0.718, 0.045, LGT); } }
      [2.2, 18.8].forEach(u => { fb(vc, Ef, u, 1.0, 0.07, 0.45, 10.6, 0.06, { col: HREL, skip: { nz: true } }); led(Ef, [u, 1.08], [u, 11.52], 0.108); });

      // ---- у фасада (фото h1): газонные полосы с бордюром, колоновидные туи, молодая ель; к порталам — мощение двора ----
      const lawnC = WIN ? rgb('#EEF2F6') : rgb('#7E9E3E'), kerbC = WIN ? rgb('#DDE3E9') : rgb('#D2CBBE'), thC = WIN ? rgb('#5E7060') : rgb('#3E5A34');
      const pg = s => cx - s * 7.1;
      [[M.x0 + 0.25, Math.min(pg(1), pg(-1)) - 2.9], [Math.min(pg(1), pg(-1)) + 2.9, Math.max(pg(1), pg(-1)) - 2.9], [Math.max(pg(1), pg(-1)) + 2.9, M.x1 - 0.25]].forEach(([x0, x1]) => {
        vc.quad([x0, 0.075, zf - 0.04], [x1, 0.075, zf - 0.04], [x1, 0.075, zf - 1.6], [x0, 0.075, zf - 1.6], lawnC); box(vc, F0, (x0 + x1) / 2, 0, zf - 1.64, x1 - x0, 0.11, 0.1, kerbC); });
      [-14, -20, 10, 16].forEach(x => { const z = zf - 0.8; vc.cyl(x, 0.07, z, 0.3, 0.03, 1.7, { seg: 7, col: p => mul(thC, 0.82 + 0.3 * clamp((p[1] - 0.07) / 1.7, 0, 1)) }); colCirc(x, z, 0.3, -1, 1.8, 'thuja'); });
      addTree(cx + 0.5, zf - 0.8, 0.62, 'pine', 0.07); colCirc(cx + 0.5, zf - 0.8, 0.45, -1, 2.5, 'fir');
      // вдоль бока к парковке — мощёная полоса 3,6 м к двум дверям (фото h2), от двора до заднего угла
      at.quadF([M.x0 - 3.6, 0.045, zf - 0.6], [M.x0, 0.045, zf - 0.6], [M.x0, 0.045, zb + 0.5], [M.x0 - 3.6, 0.045, zb + 0.5], WIN ? rgb('#E9EDF2') : rgb('#D9CDB8'), S.SLAB, [0, 1, 0]);

      // один коллайдер на корпус (id 'main' — его рисует карта региона)
      colBox(cx, (zf + zb) / 2, 2 * HW + 0.6, DEP + 0.6, -1, AP + 1, 'main');
    }

    /* ---------- 3.5 крытый бассейн: стеклянный зал на деревянных стойках, вода, шезлонги; терраса снаружи ---------- */
    function poolHall() {
      const P = POOL, W = P.x1 - P.x0, D = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
      // пол и стенка у корпуса (свет изнутри ночью)
      glowB.quad([P.x0 + 0.2, 0.06, P.z1 - 0.2], [P.x1 - 0.2, 0.06, P.z1 - 0.2], [P.x1 - 0.2, 0.06, P.z0 + 0.2], [P.x0 + 0.2, 0.06, P.z0 + 0.2], rgb('#D9D2C2'));
      for (let i = 0; i < 12; i++) { const x0 = P.x0 + 0.3 + i * (W - 0.6) / 12, x1 = x0 + (W - 0.6) / 12; glowB.quad([x0, 0.06, P.z1 - 0.3], [x1, 0.06, P.z1 - 0.3], [x1, P.h - 0.4, P.z1 - 0.3], [x0, P.h - 0.4, P.z1 - 0.3], i % 2 ? rgb('#C9A27A') : rgb('#BE9670')); }
      glowB.quad([P.x0 + 0.25, 0.06, P.z1 - 0.3], [P.x0 + 0.25, 0.06, P.z0 + 0.3], [P.x0 + 0.25, P.h - 0.4, P.z0 + 0.3], [P.x0 + 0.25, P.h - 0.4, P.z1 - 0.3], rgb('#E9E1D2'));
      // чаша: бортик из светлого камня, вода
      const rim = rgb('#EFE6D6');
      box(vc, F0, (P.px0 + P.px1) / 2, 0, P.pz0 - 0.35, P.px1 - P.px0 + 1.4, 0.18, 0.7, rim);
      box(vc, F0, (P.px0 + P.px1) / 2, 0, P.pz1 + 0.35, P.px1 - P.px0 + 1.4, 0.18, 0.7, rim);
      box(vc, F0, P.px0 - 0.35, 0, (P.pz0 + P.pz1) / 2, 0.7, 0.18, P.pz1 - P.pz0, rim);
      box(vc, F0, P.px1 + 0.35, 0, (P.pz0 + P.pz1) / 2, 0.7, 0.18, P.pz1 - P.pz0, rim);
      water(P.px0, P.pz0, P.px1, P.pz1, 0.08, rgb('#4FB8E0'), 6);
      for (let i = 1; i < 3; i++) { const z = P.pz0 + i * (P.pz1 - P.pz0) / 3; for (let k = 0; k < 18; k++) vc.sph(P.px0 + 0.5 + k, 0.11, z, 0.09, 0.05, 0.09, k % 2 ? rgb('#FFFFFF') : rgb('#D9455A'), { seg: 6, rings: 3 }); }
      for (let i = 0; i < 6; i++) { const x = P.x0 + 2.5 + i * 3.6, z = P.z0 + 3.4; box(vc, F0, x, 0.25, z, 0.75, 0.12, 1.9, rgb('#F6EFE2')); box(vc, F0, x, 0.32, z + 0.75, 0.75, 0.55, 0.12, rgb('#F6EFE2'), { rot: 0 }); }
      [[P.x0 + 1.4, P.z1 - 1.6], [P.x1 - 1.4, P.z1 - 1.6], [P.x0 + 1.4, P.z0 + 1.4], [P.x1 - 1.4, P.z0 + 1.4]].forEach(([x, z]) => { vc.cyl(x, 0.05, z, 0.42, 0.36, 0.7, { seg: 8, col: rgb('#B9744A') }); vc.sph(x, 1.3, z, 0.6, 0.75, 0.6, rgb('#5E8A4E'), { seg: 8, rings: 5 }); });
      // каркас: тёплые деревянные стойки, стекло во всю высоту, кровля со свесом и деревянным карнизом, каменный цоколь
      const H = P.h;
      for (let i = 0; i <= 8; i++) { const x = P.x0 + i * W / 8; box(vc, F0, x, 0, P.z0, 0.24, H, 0.24, WOODW); }
      for (let i = 1; i < 8; i++) { const z = P.z0 + i * D / 8; box(vc, F0, P.x1, 0, z, 0.24, H, 0.24, WOODW); }
      box(vc, F0, P.x1, 0, P.z1, 0.24, H, 0.24, WOODW);
      box(vc, F0, cx, H, cz, W + 1.6, 0.25, D + 1.6, snowTop(rgb('#E9DDC6'), 0.95), { cols: { ny: WOODK } });
      box(vc, F0, cx, H + 0.25, cz, W + 1.7, 0.3, D + 1.7, WOODW, { cols: { py: snowTop(rgb('#8E9A5A'), 0.95) } });   // зелёная кровля, деревянный карниз
      at.box(F0, cx, 0.22, P.z0, W, 0.44, 0.34, { col: STONEW, s: S.ASHLAR }); at.box(F0, P.x1, 0.22, cz, 0.34, 0.44, D, { col: STONEW, s: S.ASHLAR });
      glassB.quad([P.x0, 0.44, P.z0], [P.x1, 0.44, P.z0], [P.x1, H, P.z0], [P.x0, H, P.z0], rgb('#A9D6EA'));
      box(vc, F0, cx, 2.6, P.z0, W, 0.12, 0.16, WOODW); box(vc, F0, P.x1, 2.6, cz, 0.16, 0.12, D, WOODW);
      glassB.quad([P.x1, 0.44, P.z0], [P.x1, 0.44, P.z1], [P.x1, H, P.z1], [P.x1, H, P.z0], rgb('#BFE3F2'));
      glassB.quad([P.x0, 0.44, P.z0], [P.x0, H, P.z0], [P.x0, H, P.z1 - 1], [P.x0, 0.44, P.z1 - 1], rgb('#BFE3F2'));
      glowB.quad([P.x0 + 0.2, H - 0.03, P.z0 + 0.2], [P.x1 - 0.2, H - 0.03, P.z0 + 0.2], [P.x1 - 0.2, H - 0.03, P.z1 - 0.2], [P.x0 + 0.2, H - 0.03, P.z1 - 0.2], rgb('#D2AE84'));   // 4B: тёплый деревянный потолок
      for (let i = 0; i < 4; i++) glowB.quad([P.x0 + 2 + i * 5.5, H - 0.25, P.z0 + 4], [P.x0 + 4 + i * 5.5, H - 0.25, P.z0 + 4], [P.x0 + 4 + i * 5.5, H - 0.25, P.z0 + 14], [P.x0 + 2 + i * 5.5, H - 0.25, P.z0 + 14], rgb('#FFF4DA'));
      colBox(cx, cz, W + 0.4, D + 0.4, -1, H + 1, 'poolHall');
      // терраса бассейна снаружи: шезлонги, зонтики, кадки с цветами
      for (let i = 0; i < 4; i++) { const x = 27 + i * 5.6, z = -2.5; box(vc, F0, x, 0.29, z, 0.75, 0.12, 1.9, rgb('#F6EFE2')); box(vc, F0, x, 0.36, z - 0.75, 0.75, 0.5, 0.12, rgb('#F6EFE2')); colBox(x, z, 0.9, 2.1, -1, 0.7, 'lounger');
        if (i % 2 === 0) { vc.cyl(x + 2.8, 0.05, z, 0.04, 0.04, 2.3, { seg: 5, col: WOODD }); vcD.cyl(x + 2.8, 2.05, z, 1.35, 0.05, 0.5, { seg: 8, col: snowTop(i ? rgb('#F2E8D6') : rgb('#E8B48C'), 0.9), cap: false }); colCirc(x + 2.8, z, 0.12, -1, 2.4, 'umbrella'); } }
    }
    /* ---------- вода: одна сетка (бассейн, фонтан, купели), рябь текстурой ---------- */
    function water(x0, z0, x1, z1, y, col, rep) {
      const i0 = waterB.n; [[x0, z1], [x1, z1], [x1, z0], [x0, z0]].forEach(([x, z]) => { waterB.P.push(x, y, z); waterB.U.push(x / rep, z / rep); waterB.C.push(...col); waterB.n++; });
      waterB.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
    function waterDisc(cx, cz, r, y, col, seg = 16) {
      const i0 = waterB.n; waterB.P.push(cx, y, cz); waterB.U.push(cx / 3, cz / 3); waterB.C.push(...col); waterB.n++;
      for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r; waterB.P.push(x, y, z); waterB.U.push(x / 3, z / 3); waterB.C.push(...mul(col, 0.92)); waterB.n++; }
      for (let i = 0; i < seg; i++) waterB.I.push(i0, i0 + 1 + i, i0 + 2 + i);
    }

    /* ---------- 3.6 двор: открытая бетонная площадь, как на фото h1/h3 — светлые плиты, круг у фонтана в тон, дорожки-лучи
       чуть темнее; фонтан-чаша в два яруса, газонные островки с бордюром и саженцами на кольях (на одном — молодая ель),
       молодые деревца в кадках, пергола с вьюнком у входа с парковки, гирлянды по краям двора, фонари, лавки у фонтана ---------- */
    function courtyard() {
      const f = FOUNT, yP = 0.055;
      // мощение: у фонтана — узкий круглый фартук в тон двора (дальше — прямоугольные плиты двора, как на h1: круга на оси
      // фасада нет), лучи-дорожки к входу, смотровой, парковке и бассейну, бордюр по краю двора
      const ringC = WIN ? [rgb('#E2E8EE'), rgb('#EEF2F6')] : [rgb('#D3CCBF')];
      const RR = [3.75, 4.6, 5.5], NSg = 36;
      for (let i = 0; i < RR.length - 1; i++) for (let j = 0; j < NSg; j++) {
        const a = j / NSg * TAU, b = (j + 1) / NSg * TAU, r0 = RR[i], r1 = RR[i + 1], c = ringC[i % ringC.length];
        at.quadF([f.x + Math.sin(a) * r0, yP, f.z + Math.cos(a) * r0], [f.x + Math.sin(b) * r0, yP, f.z + Math.cos(b) * r0], [f.x + Math.sin(b) * r1, yP, f.z + Math.cos(b) * r1], [f.x + Math.sin(a) * r1, yP, f.z + Math.cos(a) * r1], c, S.SLAB, [0, 1, 0]);
      }
      const pathC = WIN ? rgb('#DCE3EA') : rgb('#CBC4B6'), edgeC = WIN ? rgb('#C9D3DD') : rgb('#BDB5A7');
      const band = (x0, z0, x1, z1, c) => at.quadF([x0, yP - 0.004, z0], [x1, yP - 0.004, z0], [x1, yP - 0.004, z1], [x0, yP - 0.004, z1], c, S.SLAB, [0, 1, 0]);
      band(f.x - 1.3, f.z + 5.5, f.x + 1.3, 14.6, pathC); band(f.x - 1.3, -21, f.x + 1.3, f.z - 5.5, pathC);
      band(-27, f.z - 1.3, f.x - 5.5, f.z + 1.3, pathC); band(f.x + 5.5, f.z - 1.3, 23, f.z + 1.3, pathC);
      [[-27, -21, 23, -20.4], [-27, 14.9, 23, 15.5], [-27, -21, -26.4, 15.5], [22.4, -21, 23, 15.5]].forEach(([a, b, c, d]) => band(a, b, c, d, edgeC));
      // фонтан: восьмигранная чаша из светлого камня, вода, колонна, верхняя чаша, струя
      const fc = mul(CONC, 0.97), fcD = mul(CONC, 0.88);
      at.cyl(f.x, 0, f.z, f.r + 0.15, f.r, 0.55, { seg: 16, col: fcD, s: S.FLAT, cap: false });
      at.cyl(f.x, 0.55, f.z, f.r + 0.28, f.r + 0.28, 0.14, { seg: 16, col: snowTop(fc, 0.9), s: S.FLAT });
      waterDisc(f.x, f.z, f.r - 0.1, 0.42, rgb('#6BC4E0'), 24);
      at.cyl(f.x, 0.42, f.z, 0.36, 0.28, 1.25, { seg: 10, col: fc, s: S.FLAT });
      at.cyl(f.x, 1.6, f.z, 0.3, 1.1, 0.36, { seg: 14, col: fc, s: S.FLAT });
      waterDisc(f.x, f.z, 1.0, 1.94, rgb('#7FD0E8'), 14);
      at.cyl(f.x, 1.94, f.z, 0.12, 0.08, 0.5, { seg: 8, col: fc, s: S.FLAT });
      colCirc(f.x, f.z, f.r + 0.3, -1, 0.7, 'fountain');
      // газонные островки (фото h1): низкий бетонный бордюр, газон вровень с ним, по два саженца на кольях; на одном — молодая
      // ель. Газон низкий — на него можно зайти (коллайдер по бордюр), саженцы и ель — свои круги
      // (свой генератор RY; из общего R — тот же отрезок, что брали прежние клумбы с цветами: раскладка склонов не сдвигается)
      const beds = [[-18, -9, 7, 2.6], [12, -9, 7, 2.6], [-18, 5, 7, 2.6], [12, 5, 7, 2.6]], kerbB = WIN ? rgb('#DDE3E9') : rgb('#CFC6B8'), lawnB = WIN ? rgb('#EEF2F6') : rgb('#6F8E2E'), RY = rng(946);
      if (!WIN) for (let i = 0; i < 4 * 51 * 6; i++) R();
      beds.forEach(([x, z, w, d], bi) => {
        at.box(F0, x, 0.09, z, w, 0.18, d, { col: kerbB, s: S.FLAT, skip: { ny: true } });
        vc.quad([x - w / 2 + 0.16, 0.185, z + d / 2 - 0.16], [x + w / 2 - 0.16, 0.185, z + d / 2 - 0.16], [x + w / 2 - 0.16, 0.185, z - d / 2 + 0.16], [x - w / 2 + 0.16, 0.185, z - d / 2 + 0.16], lawnB);
        if (bi === 3) { addTree(x - w / 4, z, 0.8, 'pine', 0.185, RY); colCirc(x - w / 4, z, 0.55, -1, 2.5, 'fir'); sapling(x + w / 4, 0.185, z, 2.5, true, RY); }
        else [-1, 1].forEach(sg => sapling(x + sg * w / 4 + (RY() - 0.5) * 0.4, 0.185, z + (RY() - 0.5) * 0.4, 2.3 + RY() * 0.6, true, RY));
        colBox(x, z, w, d, -1, 0.18, 'bed');
      });
      // молодые деревца в круглых кадках
      [[-22, -14], [18, -14], [-22, 10], [18, 10]].forEach(([x, z]) => { at.cyl(x, 0, z, 0.95, 0.95, 0.55, { seg: 12, col: mix(kerbB, [1, 1, 1], 0.2), s: S.FLAT }); vc.cyl(x, 0.55, z, 0.85, 0.85, 0.02, { seg: 12, col: WIN ? SNOW : rgb('#6E5A44') }); addTree(x, z, 0.62, 'young', 0.55); colCirc(x, z, 1.0, -1, 0.7, 'planter'); });
      // живая изгородь вдоль мощения (с проходами) и деревья на газонах
      const hedge = (x0, z0, x1, z1) => { const w = Math.abs(x1 - x0) || 0.7, d = Math.abs(z1 - z0) || 0.7; vc.box(F0, (x0 + x1) / 2, 0.42, (z0 + z1) / 2, w, 0.84, d, { col: WIN ? rgb('#E8EEF2') : rgb('#5E8A4E'), cols: { py: WIN ? SNOW : rgb('#6E9A58') } }); colBox((x0 + x1) / 2, (z0 + z1) / 2, w, d, -1, 0.9, 'hedge'); };
      // у западного края двора — только южный кусок: угол корпуса с парковки (h2) открыт
      hedge(-27.4, -19, -27.4, -1); hedge(23.4, -19, 23.4, -7); hedge(23.4, 7, 23.4, 15);
      [[-31, -14], [-31, -19.5], [-31, -8], [50, -18], [50, -8], [51, 12], [51, 24], [28, -16], [44, -16]].forEach(([x, z], i) => addTree(x, z, 0.95 + (i % 3) * 0.12, i % 3 === 0 ? 'birch' : 'rowan'));
      // лавка за фонтаном (со стороны корпуса её закрывает чаша; на оси перед фасадом пусто, как на h1) и вдоль смотровой
      bench(f.x, 0, f.z + 6.2, PI);
      [[-18, -19.6, PI], [12, -19.6, PI]].forEach(([x, z, ry]) => bench(x, 0, z, ry));
      // фонари-торшеры
      [[-26, -18], [-10, -18], [6, -18], [20, -18], [-26, 13], [20, 13], [-12.9, 12.4], [8.9, 12.4]].forEach(([x, z]) => lampPost(x, 0, z));
      // пергола над дорожкой от парковки к дверям бока (фото h2: вход с парковки — в этом боку): деревянные стойки, балки,
      // обрешётка, вьюнок с цветами; гирлянда. Стоит у бока корпуса, а не у двора: из угла парковки (вид hotel_corner, h2)
      // угол корпуса открыт целиком
      { const xs = [-33.4, -31.1, -28.8], zs = [21.4, 30.6], hh = 3.5, wc = WIN ? mix(WOODW, SNOW, 0.2) : WOODW, xa = xs[0], xb = xs[2], za = zs[0], zb = zs[1];   // 4B: высоко и редкая обрешётка — камера за героиней не смотрит сквозь брусья
        xs.forEach(x => zs.forEach(z => { vc.box(F0, x, hh / 2, z, 0.2, hh, 0.2, { col: wc }); vc.box(F0, x, 0.2, z, 0.34, 0.4, 0.34, { col: STONEW }); colCirc(x, z, 0.2, -1, hh, 'pergola'); }));
        zs.forEach(z => vc.box(F0, (xa + xb) / 2, hh + 0.12, z, xb - xa + 0.9, 0.24, 0.16, { col: wc }));
        for (let i = 0; i < 4; i++) { const x = xa - 0.2 + i * (xb - xa + 0.4) / 3; vc.box(F0, x, hh + 0.3, (za + zb) / 2, 0.09, 0.12, zb - za + 0.8, { col: snowTop(WOODL, 0.8) }); }
        if (!WIN) { [[xa + 0.4, za + 0.2], [xb - 0.4, za + 0.2], [xa + 0.4, zb - 0.2], [xb - 0.4, zb - 0.2], [lerp(xa, xb, 0.32), lerp(za, zb, 0.35)], [lerp(xa, xb, 0.68), lerp(za, zb, 0.65)]].forEach(([x, z], i) => { crowns.push({ p: [x, hh + 0.35 - 2.1 * 0.42, z], s: [0.75, 0.42, 0.9], r: [0, i, 0], c: rgb(i % 2 ? '#5E8A4E' : '#6E9A58'), kind: 'vine' });
            for (let k = 0; k < 4; k++) flowers.push({ p: [x + (R() - 0.5) * 1.2, hh + 0.42 + R() * 0.12, z + (R() - 0.5) * 1.4], s: [0.12, 0.1, 0.12], c: rgb(['#E87A9A', '#FFFFFF', '#D9455A'][k % 3]) }); });
          // вьюнок по стойкам — только у дальних от корпуса (у ближних он закрывал с парковки двери бока)
          [[xa, za], [xa, zb]].forEach(([x, z]) => { crowns.push({ p: [x, -0.4, z], s: [0.3, 0.85, 0.3], r: [0, 1, 0], c: rgb('#5E8A4E'), kind: 'vine' }); }); }
        festoon([xa, hh + 0.05, za], [xb, hh + 0.05, za], 0.3); festoon([xa, hh + 0.05, zb], [xb, hh + 0.05, zb], 0.3);
        // кровля перголы — для камеры (у бока корпуса камера за героиней иначе смотрела сверху сквозь брусья и вьюнок)
        camColliders.push({ type: 'box', x: (xa + xb) / 2, z: (za + zb) / 2, w: xb - xa + 1.2, d: zb - za + 1.0, ry: 0, y0: hh - 0.15, y1: hh + 0.75, id: 'pergolaCam', cam: true }); }
      // гирлянда над двором: нить между деревянными столбами вдоль восточного края двора (поперёк двора нитей нет — фронтон
      // с площади виден целиком, как на фото h1; у западного края нет — с угла парковки она висела в небе над корпусом)
      { const poles = [[[22.6, -14], [22.6, -6.6]]], hp = 4.3;
        poles.forEach(([a, b]) => { [a, b].forEach(([x, z]) => { vc.cyl(x, 0, z, 0.09, 0.07, hp + 0.15, { seg: 6, col: WOODK }); vc.cyl(x, 0, z, 0.16, 0.14, 0.35, { seg: 6, col: STONEW }); colCirc(x, z, 0.14, -1, hp, 'festoonPole'); });
          festoon([a[0], hp, a[1]], [b[0], hp, b[1]], 0.45, false); }); }
      // смотровая у переднего края: лавка «вид на село» и бинокль на стойке
      bench(-5, 0, -36.9, PI, 'view');
      { const x = -2.4, z = -37.7; vc.cyl(x, 0, z, 0.07, 0.07, 1.25, { seg: 6, col: DARK }); vc.box(F0, x, 1.32, z, 0.34, 0.2, 0.3, { col: rgb('#4A90D8') }); [-1, 1].forEach(s => vc.cyl(x + s * 0.08, 1.32, z - 0.18, 0.06, 0.07, 0.12, { seg: 8, col: DARK })); colCirc(x, z, 0.25, -1, 1.5, 'binoc'); }
    }
    // гирлянда: тёплые лампочки-ромбики по провисающей нити (в сетке плафонов — ночью светятся); в точки ночи (ореолы) — каждая
    // восьмая, если lamps
    function festoon(a, b, sag, lamps = true) {
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(3, Math.round(L / 1.1)), r = 0.075;
      for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[2], b[2], t), y = lerp(a[1], b[1], t) - sag * 4 * t * (1 - t) - 0.12;
        const c = rgb(['#FFE2A8', '#FFD08A', '#FFF0C8'][i % 3]), P = [[x, y + r * 1.3, z], [x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r], [x, y - r * 1.3, z]];
        [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]].forEach(([p, q, s2]) => lantB.tri(P[p], P[q], P[s2], c));
        if (lamps && i % 8 === 4) NIGHT.lamps.push([x, y, z]); }
      // нить — тонкая тёмная лента
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) - sag * 4 * t0 * (1 - t0), lerp(a[2], b[2], t0)], p1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) - sag * 4 * t1 * (1 - t1), lerp(a[2], b[2], t1)];
        vcD.quad([p0[0], p0[1], p0[2]], [p1[0], p1[1], p1[2]], [p1[0], p1[1] - 0.016, p1[2]], [p0[0], p0[1] - 0.016, p0[2]], rgb('#6A6470')); }
    }
    function bench(x, y, z, ry, tag) {
      const F = new K.Frame(x, y, z, ry), w = WIN ? mix(WOOD, SNOW, 0.35) : rgb('#B07A4E');
      box(vc, F, 0, 0.42, 0, 1.7, 0.08, 0.48, w, { cols: { py: snowTop(w, 0.7) } });
      box(vc, F, 0, 0.55, -0.24, 1.7, 0.12, 0.06, w); box(vc, F, 0, 0.75, -0.25, 1.7, 0.12, 0.06, w);
      [-0.7, 0.7].forEach(xx => { box(vc, F, xx, 0, 0, 0.08, 0.42, 0.42, DARK); box(vc, F, xx, 0.42, -0.25, 0.07, 0.5, 0.07, DARK); });
      colliders.push({ type: 'box', x, z, w: 1.75, d: 0.55, ry, y0: y - 1, y1: y + 0.55, id: tag ? 'bench_' + tag : 'bench' });
    }
    // фонарь: каменная тумба, тонкий тёмный столб, четырёхгранный фонарь со стеклом (в сетке плафонов) и шатровой шапочкой
    function lampPost(x, y, z, h = 3.0) {
      vc.cyl(x, y, z, 0.17, 0.14, 0.32, { seg: 6, col: DARK }); vc.cyl(x, y, z, 0.06, 0.05, h, { seg: 6, col: DARK });
      const F = new K.Frame(x, y, z, 0.4); lantB.box(F, 0, h + 0.2, 0, 0.26, 0.38, 0.26, { col: rgb('#FFE2A8') });
      vc.box(F, 0, h + 0.02, 0, 0.32, 0.05, 0.32, { col: DARK }); vc.cyl(x, y + h + 0.39, z, 0.24, 0.03, 0.2, { seg: 4, col: DARK, a0: 0.4 + PI / 4 });
      NIGHT.lamps.push([x, y + h + 0.2, z]); colCirc(x, z, 0.16, y - 1, y + h, 'lamp');
    }
    function bollard(x, y, z) { vc.cyl(x, y, z, 0.09, 0.09, 0.55, { seg: 6, col: DARK }); lantB.cyl(x, y + 0.55, z, 0.1, 0.1, 0.12, { seg: 6, col: rgb('#FFE2A8') }); NIGHT.lamps.push([x, y + 0.6, z]); }
    /* ---------- 3.7 башня-копия (волна 4B — как сельская: тёсаный камень пятнами, цоколь, карниз на консолях с тенью,
       парапет и крупные зубцы, бойницы; смотровая и старт зиплайна: проём со шлагбаумом к тросу, мачта) ---------- */
    function tower() {
      const t = TW, top = t.floor, seg = 22, tc = [1.03, 0.99, 0.93];
      const mott = p => { const a = Math.atan2(p[0] - t.x, p[2] - t.z), hy = p[1]; const n = VK.fbm(Math.cos(a) * 1.4 + 3.3 + hy * 0.06, Math.sin(a) * 1.4 + hy * 0.32, 3); return mul(tc, (0.9 + 0.1 * clamp(hy / 3, 0, 1)) * (0.93 + 0.13 * n)); };
      const per = TAU * t.rB / 4, rAt = hy => lerp(t.rB, t.rT, clamp(hy / top, 0, 1));
      at.cyl(t.x, -0.6, t.z, t.rB + 0.16, t.rB + 0.1, 1.0, { seg, col: p => mul(mott(p), 0.86), s: S.RUBBLE, cap: false, uvW: per });   // цоколь
      const bands = [0.4, 2.2, 4.0, 5.8, 7.4, top - 0.36];
      for (let i = 0; i < bands.length - 1; i++) at.cyl(t.x, bands[i], t.z, rAt(bands[i]), rAt(bands[i + 1]), bands[i + 1] - bands[i], { seg, col: mott, s: S.ASHLAR, cap: false, uvW: per });
      const ring = (y, r0, r1, up, col) => { for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU; at.quadF([t.x + Math.sin(a) * r0, y, t.z + Math.cos(a) * r0], [t.x + Math.sin(b) * r0, y, t.z + Math.cos(b) * r0], [t.x + Math.sin(b) * r1, y, t.z + Math.cos(b) * r1], [t.x + Math.sin(a) * r1, y, t.z + Math.cos(a) * r1], col, S.ASHLAR, [0, up ? 1 : -1, 0]); } };
      // пояс-карниз на консолях: выступ, тёмная тень снизу, ряд консолей
      const yB0 = top - 0.36, yB1 = top - 0.1, rBand = t.rT + 0.17;
      ring(yB0, rAt(yB0), rBand, false, mul(tc, 0.5));
      at.cyl(t.x, yB0, t.z, rBand, rBand, yB1 - yB0, { seg, col: mul(mott([t.x, top, t.z + 1]), 1.07), s: S.ASHLAR, cap: false, uvW: per });
      for (let i = 0; i < 18; i++) { const a = (i + 0.5) / 18 * TAU, F = new K.Frame(t.x + Math.sin(a) * (t.rT + 0.06), yB0 - 0.1, t.z + Math.cos(a) * (t.rT + 0.06), a); at.box(F, 0, 0, 0, 0.13, 0.2, 0.16, { col: mul(tc, 0.98), cols: { ny: mul(tc, 0.55) }, s: S.ASHLAR, skip: { nz: 1 } }); }
      vc.cyl(t.x, top, t.z, t.rT, t.rT, 0.06, { seg, col: WIN ? SNOW : rgb('#B9A584') });                           // пол площадки
      const R0 = route(), dirA = Math.atan2(R0.dir.x, R0.dir.z);
      // парапет с крупными зубцами; со стороны троса — проём со шлагбаумом
      const nm = 12, rO = t.rT + 0.04, rI = t.rT - 0.24;
      for (let i = 0; i < nm; i++) {
        const a = (i + 0.5) / nm * TAU, gap = Math.abs(((a - dirA + PI) % TAU + TAU) % TAU - PI) < 0.42;
        const a0 = i / nm * TAU, a1 = (i + 1) / nm * TAU;
        if (gap) continue;
        const p0 = [t.x + Math.sin(a0) * t.rT, t.z + Math.cos(a0) * t.rT], p1 = [t.x + Math.sin(a1) * t.rT, t.z + Math.cos(a1) * t.rT];
        const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        at.box(new K.Frame(mx, top, mz, a), 0, 0.34, -0.11, len + 0.03, 0.68, rO - rI, { col: mott([mx, top + 0.3, mz]), cols: { py: snowTop(mul(tc, 1.08), 0.9), nz: mul(tc, 0.85) }, s: S.ASHLAR });
        if (i % 2 === 0) at.box(new K.Frame(mx, top, mz, a), 0, 0.68 + 0.27, -0.11, len * 0.66, 0.54, rO - rI + 0.02, { col: mott([mx, top + 0.9, mz]), cols: { py: snowTop(mul(tc, 1.12), 0.9), nz: mul(tc, 0.88) }, s: S.ASHLAR, skip: { ny: 1 } });
      }
      // шлагбаум старта и деревянный настил-выступ
      { const gx = t.x + R0.dir.x * (t.rT - 0.1), gz = t.z + R0.dir.z * (t.rT - 0.1), F = new K.Frame(gx, top, gz, dirA);
        box(vc, F, 0, 0, 0.35, 1.4, 0.08, 0.8, WOOD); [-0.62, 0.62].forEach(s => box(vc, F, s, 0, 0, 0.1, 1.05, 0.1, rgb('#D9455A'))); box(vc, F, 0, 0.95, 0, 1.3, 0.07, 0.07, rgb('#F2B544')); }
      // окна-бойницы (тёмные, с каменной обводкой)
      [[40, 3.2], [160, 5.6], [260, 2.6], [320, 6.4], [100, 7.2]].forEach(([az, hy]) => { const a = az * D2R, r = rAt(hy) + 0.03, cs = Math.cos(a), sn = Math.sin(a);
        const Q = (u, v, k = 0) => [t.x + sn * (r + k) - cs * u, hy + v, t.z + cs * (r + k) + sn * u];
        at.quadF(Q(-0.26, -0.42, -0.01), Q(0.26, -0.42, -0.01), Q(0.26, 0.42, -0.01), Q(-0.26, 0.42, -0.01), mul(tc, 1.12), S.ASHLAR, [sn, 0, cs]);
        at.quadF(Q(-0.15, -0.3), Q(0.15, -0.3), Q(0.15, 0.3), Q(-0.15, 0.3), rgb('#2B2622'), S.FLAT, [sn, 0, cs]); });
      // дверь (к двору, +x): арка из светлого камня, синяя дверь, табличка «Зиплайн»
      { const a = PI / 2, r = t.rB + 0.02; at.quadF([t.x + r + 0.01, 0, t.z + 0.72], [t.x + r + 0.01, 0, t.z - 0.72], [t.x + r + 0.01, 2.45, t.z - 0.72], [t.x + r + 0.01, 2.45, t.z + 0.72], mul(tc, 1.12), S.ASHLAR, [1, 0]);
        at.quadF([t.x + r + 0.02, 0, t.z + 0.55], [t.x + r + 0.02, 0, t.z - 0.55], [t.x + r + 0.02, 2.1, t.z - 0.55], [t.x + r + 0.02, 2.1, t.z + 0.55], rgb('#3F78B8'), S.FLAT, [1, 0]);
        props.signs.push({ text: 'Зиплайн', p: [t.x + r + 0.06, 2.75, t.z], ry: a, h: 0.4, bg: '#FFF6E6', fg: '#3A2E3F', border: '#D9455A' });
        lampBracket([t.x + r + 0.3, 2.3, t.z + 0.95], [1, 0]); }
      // мачта троса: стальная А-рама на площадке
      const mast = R0.from;   // локальные оси
      [-1, 1].forEach(s => { const px = TW.x - R0.dir.z * s * 0.75 - R0.dir.x * 0.3, pz = TW.z + R0.dir.x * s * 0.75 - R0.dir.z * 0.3; vc.cyl(px, top, pz, 0.07, 0.05, mast.y - top + 0.15, { seg: 6, col: STEEL }); });
      vc.box(new K.Frame(mast.x, mast.y + 0.1, mast.z, dirA), 0, 0, 0, 1.6, 0.12, 0.14, { col: STEEL });
      // у подножия — клумба полукругом и две лавки
      if (!WIN) for (let i = 0; i < 18; i++) { const a = -0.9 + i / 17 * 1.8 + PI / 2, rr = t.rB + 0.55 + (i % 2) * 0.25; if (Math.abs(a - PI / 2) < 0.32) continue; flowers.push({ p: [t.x + Math.sin(a) * rr, 0.05, t.z + Math.cos(a) * rr], s: [0.14, 0.2, 0.14], c: rgb(['#D9455A', '#F2B544', '#E87A9A', '#FFFFFF'][i % 4]) }); }
      colCirc(t.x, t.z, t.rB + 0.1, -1, top, 'tower');
      camColliders.push({ type: 'box', x: t.x, z: t.z, w: t.rB * 1.8, d: t.rB * 1.8, ry: 0, y0: -1, y1: top + 1.1, id: 'towerCam', cam: true });
      camColliders.push({ type: 'box', x: t.x, z: t.z, w: t.rB * 1.8, d: t.rB * 1.8, ry: PI / 4, y0: -1, y1: top + 1.1, id: 'towerCam', cam: true });
    }
    // фонарь-бра на стене: кронштейн, стекло (плафоны), шапочка
    function lampBracket(p, dir) {
      const F = new K.Frame(p[0], p[1], p[2], Math.atan2(dir[0], dir[1]));
      vc.box(F, 0, 0.3, -0.18, 0.05, 0.05, 0.36, { col: DARK }); lantB.box(F, 0, 0, 0, 0.2, 0.32, 0.2, { col: rgb('#FFE2A8') });
      vc.cyl(p[0], p[1] + 0.16, p[2], 0.17, 0.02, 0.14, { seg: 4, col: DARK }); NIGHT.lamps.push([p[0], p[1], p[2]]);
    }
    /* ---------- 3.8 парковка и въезд: каменные столбы ворот, щит «Отель», гольф-кары у спорта ---------- */
    function parking() {
      [[-67, 1.5], [-67, 22.5]].forEach(([x, z]) => { at.box(F0, x, 1.3, z, 1.0, 2.6, 1.0, { col: C('rubbleY'), s: S.RUBBLE }); vc.box(F0, x, 2.65, z, 1.2, 0.12, 1.2, { col: snowTop(rgb('#D8D2C6'), 0.9) }); lantB.sph(x, 2.95, z, 0.2, 0.24, 0.2, rgb('#FFE2A8'), { seg: 8, rings: 5 }); NIGHT.lamps.push([x, 2.95, z]); colBox(x, z, 1.1, 1.1, -1, 3, 'gate'); });
      props.signs.push({ text: 'Отель', p: [-66.4, 2.0, 12], ry: -PI / 2, h: 0.7, bg: '#6E4A36', fg: '#FFF6E6', border: '#B58B62' });
      vc.box(F0, -66.9, 1.9, 12, 0.14, 1.1, 2.6, { col: rgb('#6E4A36') });
      vc.cyl(-66.9, 0, 10.2, 0.08, 0.08, 1.9, { seg: 5, col: WOODD }); vc.cyl(-66.9, 0, 13.8, 0.08, 0.08, 1.9, { seg: 5, col: WOODD });
      colBox(-66.9, 12, 0.3, 4.0, -1, 2.6, 'gateSign');
      // бордюр и кусты вдоль парковки
      for (let i = 0; i < 7; i++) addTree(-36 - i * 4.5, 28.5, 0.75, WIN ? 'pine' : 'birch');
      // волна 6: машина стоит там, где её поставили (из села — у ворот); указатель «в село» у южного столба ворот
      { const cs = opts.from === 'kubachi' ? FROM_VILLAGE.car : PARKING; colBox(cs.x, cs.z, 2.1, 4.8, -1, 1.6, 'car', cs.ry); }   // коробка вдоль машины (раньше стояла поперёк)
      { const x = -66.3, z = 19.4; vc.cyl(x, 0, z, 0.06, 0.05, 2.3, { seg: 5, col: WOODD }); vc.box(F0, x + 0.05, 2.0, z, 0.05, 0.34, 1.2, { col: rgb('#F4E6CC') });
        props.signs.push({ text: named ? 'Кубачи ↓' : 'Село ↓', p: [x + 0.09, 2.0, z], ry: PI / 2, h: 0.3, bg: '#F4E6CC', fg: '#5A3E2E', border: '#B58B62' });
        props.signs.push({ text: named ? 'Кубачи ↓' : 'Село ↓', p: [x - 0.01, 2.0, z], ry: -PI / 2, h: 0.3, bg: '#F4E6CC', fg: '#5A3E2E', border: '#B58B62' });
        colBox(x, z, 0.2, 0.2, -1, 2.4, 'sign'); }
    }
    function golfCart(x, y, z, ry, col) {
      const F = new K.Frame(x, y, z, ry), bodyC = col || rgb('#F6F3EC');
      box(vc, F, 0, 0.32, 0, 1.15, 0.42, 2.2, bodyC, { cols: { py: snowTop(bodyC, 0.6) } });
      box(vc, F, 0, 0.74, -0.25, 1.05, 0.12, 0.7, rgb('#3E5E8E'));                 // сиденье
      box(vc, F, 0, 0.86, -0.62, 1.05, 0.55, 0.12, rgb('#3E5E8E'));
      [[-0.52, 0.7], [0.52, 0.7], [-0.52, -0.95], [0.52, -0.95]].forEach(([lx, lz]) => box(vc, F, lx, 0.62, lz, 0.05, 1.3, 0.05, rgb('#CFCAC2')));
      box(vc, F, 0, 1.92, -0.12, 1.3, 0.08, 2.0, snowTop(rgb('#2F7A5E'), 0.95));      // крыша
      [[-0.55, 0.72], [0.55, 0.72], [-0.55, -0.72], [0.55, -0.72]].forEach(([lx, lz]) => { const p = F.p(lx, 0.2, lz); const g = new K.Frame(p[0], p[1], p[2], ry + PI / 2); box(vc, g, 0, -0.2, 0, 0.42, 0.42, 0.18, DARK); });
      box(vc, F, 0, 0.55, 0.95, 0.9, 0.35, 0.25, bodyC);
      colliders.push({ type: 'box', x, z, w: 1.3, d: 2.4, ry, y0: y - 1, y1: y + 2, id: 'cart' });
    }

    /* ---------- 3.9 спорт: падел (стеклянные стенки), мини-футбол, паттинг-грин с флажками, кары, кольцо, пинг-понг ---------- */
    function sports() {
      const y = -4;
      // падел 10 × 20: синий газон, белые линии, сетка, стекло на торцах и по бокам у торцов, сетка-ограда выше
      { const P = PADEL, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, x0 = cx - 5, x1 = cx + 5, z0 = cz - 10, z1 = cz + 10, blue = WIN ? mix(rgb('#3E7CC0'), SNOW, 0.35) : rgb('#3E7CC0');
        vc.quad([x0, y + 0.03, z1], [x1, y + 0.03, z1], [x1, y + 0.03, z0], [x0, y + 0.03, z0], blue);
        const line = (a, b, c, d) => vc.quad([a, y + 0.045, d], [b, y + 0.045, d], [b, y + 0.045, c], [a, y + 0.045, c], rgb('#F6F6F2'));
        line(x0, x1, z0, z0 + 0.06); line(x0, x1, z1 - 0.06, z1); line(x0, x0 + 0.06, z0, z1); line(x1 - 0.06, x1, z0, z1); line(x0, x1, cz - 6.95, cz - 6.89); line(x0, x1, cz + 6.89, cz + 6.95); line(cx - 0.03, cx + 0.03, cz - 6.9, cz + 6.9);
        vcD.quad([x0, y + 0.0, cz], [x1, y + 0.0, cz], [x1, y + 0.88, cz], [x0, y + 0.88, cz], rgb('#2F3440')); vc.box(F0, cx, y + 0.9, cz, 10, 0.06, 0.06, { col: rgb('#F6F6F2') });
        [x0, x1].forEach(x => vc.cyl(x, y, cz, 0.05, 0.05, 0.95, { seg: 5, col: DARK }));
        const glassWall = (ax, c, a, b, h) => { if (ax === 'z') glassB.quad([a, y, c], [b, y, c], [b, y + h, c], [a, y + h, c], rgb('#CFEAF5')); else glassB.quad([c, y, a], [c, y, b], [c, y + h, b], [c, y + h, a], rgb('#CFEAF5')); };
        glassWall('z', z0, x0, x1, 3); glassWall('z', z1, x0, x1, 3);
        [x0, x1].forEach(x => { glassWall('x', x, z0, z0 + 2, 3); glassWall('x', x, z1 - 2, z1, 3); glassWall('x', x, z0 + 2, cz - 1.2, 2); glassWall('x', x, cz + 1.2, z1 - 2, 2); });
        for (let i = 0; i <= 10; i++) { const z = z0 + i * 2; [x0, x1].forEach(x => vc.cyl(x, y, z, 0.05, 0.05, 4, { seg: 5, col: DARK })); }
        for (let i = 0; i <= 5; i++) { const x = x0 + i * 2; [z0, z1].forEach(z => vc.cyl(x, y, z, 0.05, 0.05, 4, { seg: 5, col: DARK })); }
        vcD.quad([x0, y + 3, z0], [x1, y + 3, z0], [x1, y + 4, z0], [x0, y + 4, z0], rgb('#2F5A3E')); vcD.quad([x0, y + 3, z1], [x1, y + 3, z1], [x1, y + 4, z1], [x0, y + 4, z1], rgb('#2F5A3E'));
        // коллайдеры стенок (дверцы — посередине боков)
        colBox(cx, z0, 10.2, 0.2, y - 1, y + 4, 'padel'); colBox(cx, z1, 10.2, 0.2, y - 1, y + 4, 'padel');
        [x0, x1].forEach(x => { colBox(x, (z0 + cz - 1.2) / 2, 0.2, cz - 1.2 - z0, y - 1, y + 4, 'padel'); colBox(x, (cz + 1.2 + z1) / 2, 0.2, z1 - cz - 1.2, y - 1, y + 4, 'padel'); });
        colBox(cx, cz, 10, 0.12, y - 1, y + 0.95, 'padelNet');
        props.signs.push({ text: 'Падел', p: [x1 + 0.08, y + 3.3, cz - 4], ry: PI / 2, h: 0.5, bg: '#FFFDF8', fg: '#3E5E8E', border: '#3E7CC0' }); }
      // мини-футбол: газон полосами, линии, двое ворот с сетками, ограда-сетка
      { const P = PITCH, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, x0 = P.x0 + 1, x1 = P.x1 - 1, z0 = P.z0 + 1, z1 = P.z1 - 1;
        for (let i = 0; i < 8; i++) { const a = x0 + i * (x1 - x0) / 8, b = a + (x1 - x0) / 8, c = WIN ? (i % 2 ? rgb('#E8EEF2') : rgb('#DEE6EC')) : (i % 2 ? rgb('#5F9E4E') : rgb('#6FAE58')); vc.quad([a, y + 0.03, z1], [b, y + 0.03, z1], [b, y + 0.03, z0], [a, y + 0.03, z0], c); }
        const line = (a, b, c, d) => vc.quad([a, y + 0.045, d], [b, y + 0.045, d], [b, y + 0.045, c], [a, y + 0.045, c], rgb('#F6F6F2'));
        line(x0, x1, z0, z0 + 0.1); line(x0, x1, z1 - 0.1, z1); line(x0, x0 + 0.1, z0, z1); line(x1 - 0.1, x1, z0, z1); line(cx - 0.05, cx + 0.05, z0, z1);
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, b = (i + 1) / 24 * TAU; vc.quad([cx + Math.sin(a) * 3, y + 0.046, cz + Math.cos(a) * 3], [cx + Math.sin(b) * 3, y + 0.046, cz + Math.cos(b) * 3], [cx + Math.sin(b) * 2.9, y + 0.046, cz + Math.cos(b) * 2.9], [cx + Math.sin(a) * 2.9, y + 0.046, cz + Math.cos(a) * 2.9], rgb('#F6F6F2')); }
        [[x0 + 0.1, 1], [x1 - 0.1, -1]].forEach(([gx, s]) => { const gz0 = cz - 1.5, gz1 = cz + 1.5, gy = 2.0, bk = gx - s * 1.0;
          [gz0, gz1].forEach(z => { vc.cyl(gx, y, z, 0.06, 0.06, gy, { seg: 6, col: rgb('#FFFFFF') }); vcD.quad([gx, y, z], [bk, y, z], [bk, y + gy * 0.7, z], [gx, y + gy, z], rgb('#E6E6E0')); });
          vc.box(F0, gx, y + gy, cz, 0.12, 0.12, 3.1, { col: rgb('#FFFFFF') }); vcD.quad([bk, y, gz0], [bk, y, gz1], [bk, y + gy * 0.7, gz1], [bk, y + gy * 0.7, gz0], rgb('#E6E6E0')); vcD.quad([gx, y + gy, gz0], [gx, y + gy, gz1], [bk, y + gy * 0.7, gz1], [bk, y + gy * 0.7, gz0], rgb('#E6E6E0'));
          colBox((gx + bk) / 2, cz, 1.2, 3.2, y - 1, y + 2.1, 'goal'); });
        // ограда: стойки и тёмная сетка 2,5 м (проходы на длинной стороне)
        const fx0 = P.x0, fx1 = P.x1, fz0 = P.z0, fz1 = P.z1, fh = 2.6, net = rgb('#3E5E4A');
        for (let x = fx0; x <= fx1 + 1e-6; x += 3) [fz0, fz1].forEach(z => vc.cyl(x, y, z, 0.05, 0.05, fh, { seg: 5, col: DARK }));
        for (let z = fz0; z <= fz1 + 1e-6; z += 3) [fx0, fx1].forEach(x => vc.cyl(x, y, z, 0.05, 0.05, fh, { seg: 5, col: DARK }));
        vcD.quad([fx0, y + 0.3, fz0], [fx1, y + 0.3, fz0], [fx1, y + fh, fz0], [fx0, y + fh, fz0], net);
        vcD.quad([fx0, y + 0.3, fz1], [cx - 2, y + 0.3, fz1], [cx - 2, y + fh, fz1], [fx0, y + fh, fz1], net); vcD.quad([cx + 2, y + 0.3, fz1], [fx1, y + 0.3, fz1], [fx1, y + fh, fz1], [cx + 2, y + fh, fz1], net);
        vcD.quad([fx0, y + 0.3, fz0], [fx0, y + 0.3, fz1], [fx0, y + fh, fz1], [fx0, y + fh, fz0], net); vcD.quad([fx1, y + 0.3, fz0], [fx1, y + 0.3, fz1], [fx1, y + fh, fz1], [fx1, y + fh, fz0], net);
        colBox(cx, fz0, fx1 - fx0, 0.2, y - 1, y + fh, 'pitchFence'); colBox((fx0 + cx - 2) / 2, fz1, cx - 2 - fx0, 0.2, y - 1, y + fh, 'pitchFence'); colBox((cx + 2 + fx1) / 2, fz1, fx1 - cx - 2, 0.2, y - 1, y + fh, 'pitchFence');
        colBox(fx0, cz, 0.2, fz1 - fz0, y - 1, y + fh, 'pitchFence'); colBox(fx1, cz, 0.2, fz1 - fz0, y - 1, y + fh, 'pitchFence');
        props.signs.push({ text: 'Мини-футбол', p: [cx, y + 2.15, fz1 + 0.1], ry: 0, h: 0.5, bg: '#FFFDF8', fg: '#2F7A5E', border: '#5F9E4E' }); }
      // паттинг-грин (мини-гольф): гладкий газон-эллипс с каймой, три флажка, коврик-старт, камешки-бортики
      { const G = GREEN, seg = 40, fr = WIN ? rgb('#E3EAF0') : rgb('#4F7E3C'), gc = WIN ? rgb('#EDF2F6') : rgb('#86C764');
        for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU, wob = q => 1 + 0.07 * Math.sin(q * 3 + 1) + 0.04 * Math.sin(q * 5);
          const p = (q, k) => [G.x + Math.sin(q) * G.rx * k * wob(q), y + 0.08, G.z + Math.cos(q) * G.rz * k * wob(q)];
          vc.quad(p(a, 1.12), p(b, 1.12), p(b, 1.0), p(a, 1.0), fr); vc.tri([G.x, y + 0.09, G.z], p(a, 1.0), p(b, 1.0), (pp, vi) => (WIN ? gc : (Math.floor((pp[0] - G.x + 40) / 1.6) % 2 ? gc : mul(gc, 0.9))));
          if (i % 2 === 0) { const q = p(a, 1.13); vc.sph(q[0], y + 0.1, q[2], 0.18, 0.12, 0.16, rgb('#C9C0B0'), { seg: 6, rings: 3 }); } }
        { const bx = G.x + 6.2, bz = G.z + 5.6; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, b = (i + 1) / 14 * TAU; vc.tri([bx, y + 0.1, bz], [bx + Math.sin(a) * 1.6, y + 0.1, bz + Math.cos(a) * 1.0], [bx + Math.sin(b) * 1.6, y + 0.1, bz + Math.cos(b) * 1.0], WIN ? rgb('#F4F6F8') : rgb('#E8D7A8')); } }   // бункер с песком
        G.holes.forEach(([hx, hz], k) => { vc.cyl(hx, y + 0.1, hz, 0.11, 0.11, 0.01, { seg: 10, col: rgb('#20242A') }); vc.cyl(hx, y + 0.1, hz, 0.02, 0.02, 1.6, { seg: 4, col: rgb('#F6F6F2') }); vcD.quad([hx, y + 1.3, hz], [hx + 0.5, y + 1.42, hz], [hx + 0.5, y + 1.68, hz], [hx, y + 1.7, hz], rgb(['#D9455A', '#F2B544', '#4A90D8'][k])); });
        vc.quad([G.tee[0] - 0.5, y + 0.1, G.tee[1] + 0.5], [G.tee[0] + 0.5, y + 0.1, G.tee[1] + 0.5], [G.tee[0] + 0.5, y + 0.1, G.tee[1] - 0.5], [G.tee[0] - 0.5, y + 0.1, G.tee[1] - 0.5], rgb('#2F6A3E'));
        props.signs.push({ text: 'Мини-гольф', p: [G.x - 4.5, y + 1.6, G.z + G.rz + 1.6], ry: PI, h: 0.45, bg: '#FFFDF8', fg: '#2F7A5E', border: '#7DBA5E' });
        vc.cyl(G.x - 4.5, y, G.z + G.rz + 1.65, 0.05, 0.05, 1.4, { seg: 5, col: WOODD }); }
      // гольф-кары, кольцо, пинг-понг, лавки, фонари
      golfCart(50, y, -51, -PI / 2); golfCart(50, y, -48.2, -PI / 2, rgb('#FFF6E6'));
      { const x = 82, z = -50; vc.cyl(x, y, z, 0.09, 0.09, 3.2, { seg: 6, col: DARK }); vc.box(F0, x - 0.55, y + 3.05, z, 0.12, 1.0, 1.6, { col: rgb('#FFFFFF') }); vc.cyl(x - 0.85, y + 3.0, z, 0.24, 0.24, 0.03, { seg: 12, col: rgb('#E87A3A') }); colCirc(x, z, 0.2, y - 1, y + 3.3, 'hoop'); }
      { const x = 66, z = -50; box(vc, F0, x, y + 0.7, z, 1.52, 0.06, 2.74, snowTop(rgb('#3E6EB0'), 0.5)); box(vc, F0, x, y + 0.76, z, 1.6, 0.15, 0.02, rgb('#F6F6F2')); [[-0.6, -1.1], [0.6, -1.1], [-0.6, 1.1], [0.6, 1.1]].forEach(([a, b]) => box(vc, F0, x + a, y, z + b, 0.06, 0.7, 0.06, DARK)); colBox(x, z, 1.6, 2.8, y - 1, y + 0.8, 'pingpong'); }
      bench(36, y, -64.4, 0); bench(20, y, -64.4, 0); bench(56, y, -63.2, PI);
      [[18, -62], [44, -62], [16, -44], [44, -44], [86 - 2, -62], [-2, -62]].forEach(([x, z]) => lampPost(x, y, z));
      [[6, -60], [72, -44], [84, -44], [-2, -92], [30, -92]].forEach(([x, z]) => addTree(x, z, 1.0, R() < 0.5 ? 'pine' : 'rowan'));
    }

    /* ---------- 3.10 банный комплекс (волна 4B): каменный корпус с деревом и большими окнами, купол хамама, бревенчатая
       сауна с трубой и паром; купели-«чаны» с паром на настиле; костровой круг на мощёной площадке; стеклянные коттеджи
       на краю склона (два этажа, стекло во всю стену, террасы, каменный цоколь уходит вниз по склону) ---------- */
    function relax() {
      const y = -8;
      { const P = SPA, W = P.x1 - P.x0, D = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, F = new K.Frame(cx, y, cz, 0);
        // корпус: низ — тёплый бут, верх — сливочная штукатурка; деревянный карниз и плоская кровля
        at.box(F, 0, 0.75, 0, W + 0.1, 1.5, D + 0.1, { col: C('rubbleY'), s: S.RUBBLE, skip: { py: true, ny: true } });
        box(vc, F, 0, 1.5, 0, W, P.h - 1.5, D, WALLC, { skip: { ny: true } });
        box(vc, F, 0, P.h, 0, W + 0.9, 0.32, D + 0.9, WOODW, { cols: { py: snowTop(rgb('#8E9A5A'), 0.95), ny: WOODK } });
        // большие окна к купелям (юг и восток): тёплый свет изнутри, деревянные рамы
        for (let i = 0; i < 5; i++) { const x = -W / 2 + 2.6 + i * 4.7, p = F.p(x, 2.7, -D / 2 - 0.04);
          paneB.quad(F.p(x + 1.6, 1.65, -D / 2 - 0.04), F.p(x - 1.6, 1.65, -D / 2 - 0.04), F.p(x - 1.6, 3.75, -D / 2 - 0.04), F.p(x + 1.6, 3.75, -D / 2 - 0.04), pp => paneCol(pp[1], y + 1.65, y + 3.75));
          casing(p, [0, -1], 3.2, 2.1, { t: 0.14, mull: true, sill: false }); }
        for (let i = 0; i < 2; i++) { const z = -D / 2 + 3.6 + i * 6.8, p = F.p(W / 2 + 0.04, 2.7, z);
          paneB.quad(F.p(W / 2 + 0.04, 1.65, z - 1.6), F.p(W / 2 + 0.04, 1.65, z + 1.6), F.p(W / 2 + 0.04, 3.75, z + 1.6), F.p(W / 2 + 0.04, 3.75, z - 1.6), pp => paneCol(pp[1], y + 1.65, y + 3.75));
          casing(p, [1, 0], 3.2, 2.1, { t: 0.14, mull: true, sill: false }); }
        // купол хамама: сливочный, с рёбрами и фонариком-шпилем
        const dx = cx + 5.5, dz = cz + 0.5, dy = y + P.h + 0.3;
        vc.cyl(dx, dy - 0.05, dz, 3.25, 3.25, 0.5, { seg: 16, col: WALLC, cap: false });
        vc.sph(dx, dy + 0.45, dz, 3.1, 2.3, 3.1, p => snowTop(mul(rgb('#F4E8D2'), 0.96 + 0.06 * Math.sin(Math.atan2(p[0] - dx, p[2] - dz) * 8)), 0.7), { seg: 16, rings: 6, cut: 0.0 });
        vc.cyl(dx, dy + 2.65, dz, 0.28, 0.22, 0.5, { seg: 8, col: rgb('#E9DCC4') }); vc.cyl(dx, dy + 3.1, dz, 0.07, 0.02, 0.6, { seg: 5, col: rgb('#C9A04A') });
        // бревенчатая сауна у западного торца: брёвна полосами, двускатная кровля, каменная труба с паром
        { const sx0 = P.x0 - 5.2, sx1 = P.x0 - 0.2, sz0 = P.z0 + 2.5, sz1 = P.z1 - 2.5, hh = 3.0;
          for (let k = 0; k < 10; k++) { const y0 = y + 0.3 + k * 0.27; vc.box(F0, (sx0 + sx1) / 2, y0 + 0.135, (sz0 + sz1) / 2, sx1 - sx0 + (k % 2 ? 0.3 : 0.18), 0.26, sz1 - sz0 + (k % 2 ? 0.18 : 0.3), { col: mul(rgb('#B07A4E'), k % 2 ? 0.92 : 1.02), skip: { ny: true } }); }
          at.box(F0, (sx0 + sx1) / 2, y + 0.15, (sz0 + sz1) / 2, sx1 - sx0 + 0.4, 0.3, sz1 - sz0 + 0.4, { col: C('rubble'), s: S.RUBBLE });
          gableRoof(sx0, sx1, sz0, sz1, y + hh, y + hh + 1.6, 'x', 0.45, true, rgb('#A8744A'));
          vc.box(F0, sx0 - 0.02, y + 1.15, (sz0 + sz1) / 2, 0.06, 1.9, 0.9, { col: WOODK });   // дверь
          at.box(F0, sx0 + 1.2, y + hh + 1.4, sz1 - 1.2, 0.7, 2.2, 0.7, { col: STONEW, s: S.ASHLAR });
          props.puffs.push({ p: [sx0 + 1.2, y + hh + 2.6, sz1 - 1.2], rate: 0.5, big: 1.3 });
          colBox((sx0 + sx1) / 2, (sz0 + sz1) / 2, sx1 - sx0 + 0.6, sz1 - sz0 + 0.6, y - 1, y + hh + 2, 'sauna'); }
        props.signs.push({ text: 'Баня', p: [cx - 8, y + 4.0, P.z0 - 0.5], ry: PI, h: 0.6, bg: '#6E4A36', fg: '#FFF6E6', border: '#B58B62' });
        lampBracket([cx - 3.6, y + 2.0, P.z0 - 0.3], [0, -1]); lampBracket([cx + 6.2, y + 2.0, P.z0 - 0.3], [0, -1]);
        colBox(cx, cz, W + 0.4, D + 0.4, y - 1, y + P.h + 1, 'spa');
        camColliders.push({ type: 'box', x: cx, z: cz, w: W, d: D, ry: 0, y0: y - 1, y1: y + P.h + 2, id: 'spaCam', cam: true }); }
      // купели: деревянные «чаны» с горячей водой и паром, обручи, ступеньки; на настиле — каменная кромка, фонарики, полотенца
      TUBS.forEach(([x, z], i) => {
        vc.cyl(x, y + 0.05, z, 1.35, 1.35, 0.85, { seg: 16, col: rgb('#A8774E'), cap: false }); vc.cyl(x, y + 0.86, z, 1.42, 1.42, 0.08, { seg: 16, col: snowTop(rgb('#D9C2A0'), 0.6), cap: false }); ringTop(vc, x, y + 0.94, z, 1.22, 1.42, 16, rgb('#D9C2A0'), S.FLAT);
        for (let k = 0; k < 2; k++) vc.cyl(x, y + 0.2 + k * 0.45, z, 1.38, 1.38, 0.07, { seg: 16, col: DARK, cap: false });
        waterDisc(x, z, 1.24, y + 0.8, rgb('#7FE6EE'), 16);
        vc.box(new K.Frame(x, y, z + 1.55, 0), 0, 0.25, 0, 0.7, 0.5, 0.5, { col: WOOD });
        props.puffs.push({ p: [x, y + 1.0, z], rate: WIN ? 1.4 : 1.0, big: WIN ? 1.7 : 1.25, tub: true });
        props.puffs.push({ p: [x + 0.4, y + 1.0, z - 0.3], rate: WIN ? 1.2 : 0.8, big: WIN ? 1.4 : 1.0, tub: true });
        colCirc(x, z, 1.45, y - 1, y + 1.0, 'tub');
      });
      for (let i = 0; i < 3; i++) { const x = -38 + i * 3.4, z = -60.2; box(vc, F0, x, y + 0.3, z, 0.75, 0.12, 1.9, rgb('#F6EFE2')); box(vc, F0, x, y + 0.36, z + 0.75, 0.75, 0.5, 0.12, rgb('#F6EFE2')); box(vc, F0, x, y + 0.42, z - 0.4, 0.6, 0.06, 0.5, rgb(['#E8B48C', '#9CC4D8', '#E8A0A8'][i])); colBox(x, z, 0.9, 2.1, y - 1, y + 0.7, 'lounger'); }
      [[-40.2, -49], [-22.6, -49], [-22.6, -61.2]].forEach(([x, z]) => lampPost(x, y, z, 2.2));
      if (!WIN) [[-39.4, -61.4], [-24.1, -47.8]].forEach(([x, z]) => { vc.cyl(x, y + 0.05, z, 0.42, 0.36, 0.62, { seg: 8, col: rgb('#B9744A') }); vc.sph(x, y + 1.15, z, 0.55, 0.6, 0.55, rgb('#5E8A4E'), { seg: 8, rings: 5 }); colCirc(x, z, 0.45, y - 1, y + 1.5, 'planter'); });
      // костровой круг: мощёная площадка из плитняка, каменное кольцо очага, поленья, огонь; лавки-брёвна полукругом; поленница
      { const f = FIRE, Rp = 5.2;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 18 + i * 6; j++) { const n = 18 + i * 6, r0 = 1.5 + i * (Rp - 1.5) / 3, r1 = 1.5 + (i + 1) * (Rp - 1.5) / 3, a = j / n * TAU + i * 0.3, b = (j + 1) / n * TAU + i * 0.3, gp = 0.035;
          const c = WIN ? rgb('#E6ECF1') : mul(rgb(['#C9B89A', '#B8A68A', '#D2C3A6'][(i + j) % 3]), 0.95 + 0.1 * R());
          vc.quadF([f.x + Math.sin(a + gp) * (r0 + 0.05), y + 0.04, f.z + Math.cos(a + gp) * (r0 + 0.05)], [f.x + Math.sin(b - gp) * (r0 + 0.05), y + 0.04, f.z + Math.cos(b - gp) * (r0 + 0.05)], [f.x + Math.sin(b - gp) * (r1 - 0.05), y + 0.04, f.z + Math.cos(b - gp) * (r1 - 0.05)], [f.x + Math.sin(a + gp) * (r1 - 0.05), y + 0.04, f.z + Math.cos(a + gp) * (r1 - 0.05)], c, S.FLAT, [0, 1, 0]); }
        vc.cyl(f.x, y + 0.02, f.z, Rp + 0.15, Rp + 0.15, 0.015, { seg: 28, col: WIN ? rgb('#D9E0E6') : rgb('#8E8170') });
        at.cyl(f.x, y, f.z, f.r + 0.28, f.r + 0.22, 0.3, { seg: 14, col: [0.92, 0.88, 0.82], s: S.RUBBLE, cap: false });
        ringTop(at, f.x, y + 0.3, f.z, f.r + 0.04, f.r + 0.26, 14, [0.62, 0.58, 0.54], S.RUBBLE);
        vc.cyl(f.x, y + 0.03, f.z, f.r, f.r, 0.06, { seg: 12, col: rgb('#3A302A') });
        [[0, 0.6], [1.2, 0.6], [2.4, 0.6]].forEach(([a, l]) => { const F = new K.Frame(f.x, y + 0.22, f.z, a); box(vc, F, 0, -0.08, 0, 0.16, 0.16, l + 0.5, rgb('#6E4A36')); });
        colCirc(f.x, f.z, f.r + 0.35, y - 1, y + 0.6, 'fire');
        logBench(f.x, y, f.z + 3.3, 0, 'fire');
        logBench(f.x - 3.1, y, f.z + 1.0, PI / 2 + 0.35, 'fireSide1');
        logBench(f.x + 3.1, y, f.z + 1.0, -PI / 2 - 0.35, 'fireSide2');
        // пледы на бревне (уют), поленница
        if (!WIN) { const F = new K.Frame(f.x + 0.6, y, f.z + 3.3, 0); box(vc, F, 0, 0.44, 0, 0.55, 0.08, 0.42, rgb('#C2405B')); box(vc, F, 0.05, 0.52, 0, 0.5, 0.07, 0.4, rgb('#E8C770')); }
        { const wx = f.x + 5.4, wz = f.z - 1.0; for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) { const F = new K.Frame(wx, y + 0.13 + r * 0.24, wz - 0.75 + 0.5 * k + r * 0.25, 0); for (let q = 0; q < 6; q++) { const a0 = q / 6 * TAU, a1 = (q + 1) / 6 * TAU; vc.quadF(F.p(-0.6, Math.cos(a0) * 0.12, Math.sin(a0) * 0.12), F.p(0.6, Math.cos(a0) * 0.12, Math.sin(a0) * 0.12), F.p(0.6, Math.cos(a1) * 0.12, Math.sin(a1) * 0.12), F.p(-0.6, Math.cos(a1) * 0.12, Math.sin(a1) * 0.12), mul(rgb('#8A5E3E'), 0.9 + 0.1 * (q % 2)), S.FLAT, [0, Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)]); } } colBox(wx, wz, 1.4, 2.2, y - 1, y + 0.8, 'woodpile'); }
        [[f.x - 4.6, f.z - 3.2], [f.x + 4.6, f.z - 3.2], [f.x - 4.9, f.z + 2.4]].forEach(([x, z]) => bollard(x, y, z)); }
      // коттеджи: два этажа, стеклянный фронтон-«домик» во всю стену в деревянной раме, бока из тёплого дерева,
      // крутая двускатная кровля, терраса с перилами и балкон; каменный цоколь уходит вниз — дом стоит на краю склона
      COTT.forEach(([x, z], i) => {
        const F = new K.Frame(x, y, z, 2.45), W = 8, D = 9, Hw = 4.4, Hr = 8.4, fz = D / 2 + 0.02, woodS = rgb(['#B07A4E', '#A86F45', '#B8845A'][i]);
        const P = (a, b, c) => F.p(a, b, c), nF = F.dir(0, 1), nS = F.dir(1, 0);
        // цоколь: от пола до склона позади (на краю площадки) — камень
        const back = F.p(0, 0, -D / 2), gB = Math.max(-2.6, hillY(back[0], back[2]) - y); at.box(F, 0, Math.min(-0.4, gB) / 2 - 0.05, -0.6, W + 0.4, Math.max(0.6, -gB + 0.5), D + 1.6, { col: C('rubble'), s: S.RUBBLE, skip: { py: true } });
        // стены-бока и тыл: дерево, торцевые полосы-доски
        box(vc, F, 0, 0, 0, W, Hw, D, woodS, { skip: { py: true, pz: true } });
        for (let k = 1; k < 5; k++) [[-1, 'nx'], [1, 'px']].forEach(([sd]) => box(vc, F, sd * (W / 2 + 0.01), k * 0.88 - 0.05, 0, 0.04, 0.06, D, mul(woodS, 0.8)));
        // кровля: конёк вперёд-назад (фронтон к виду), тёмная черепица, деревянные ветровые доски
        { const c = F, A = (a, b, d) => c.p(a, b, d), rc = snowTop(rgb('#5E4A44'), 0.9), o = 0.6, k = (Hr - Hw) / (W / 2), ye = Hw - k * o;
          vc.quadF(A(-W / 2 - o, ye, -D / 2 - 0.5), A(-W / 2 - o, ye, D / 2 + 0.8), A(0, Hr, D / 2 + 0.8), A(0, Hr, -D / 2 - 0.5), rc, S.FLAT, [-nS[0] * k, 1, -nS[1] * k]);
          vc.quadF(A(W / 2 + o, ye, -D / 2 - 0.5), A(W / 2 + o, ye, D / 2 + 0.8), A(0, Hr, D / 2 + 0.8), A(0, Hr, -D / 2 - 0.5), rc, S.FLAT, [nS[0] * k, 1, nS[1] * k]);
          vc.quadF(A(-W / 2 - o, ye - 0.2, -D / 2 - 0.5), A(-W / 2 - o, ye - 0.2, D / 2 + 0.8), A(0, Hr - 0.2, D / 2 + 0.8), A(0, Hr - 0.2, -D / 2 - 0.5), WOODK, S.FLAT, [nS[0] * k, -1, nS[1] * k]);
          vc.quadF(A(W / 2 + o, ye - 0.2, -D / 2 - 0.5), A(W / 2 + o, ye - 0.2, D / 2 + 0.8), A(0, Hr - 0.2, D / 2 + 0.8), A(0, Hr - 0.2, -D / 2 - 0.5), WOODK, S.FLAT, [-nS[0] * k, -1, -nS[1] * k]);
          triF(vc, A(-W / 2, Hw, -D / 2), A(W / 2, Hw, -D / 2), A(0, Hr - 0.1, -D / 2), woodS, [-nF[0], 0, -nF[1]]);
          [[-1], [1]].forEach(([sd]) => vc.quadF(A(sd * (W / 2 + o), ye - 0.2, D / 2 + 0.82), A(0, Hr - 0.2, D / 2 + 0.82), A(0, Hr + 0.05, D / 2 + 0.82), A(sd * (W / 2 + o), ye + 0.05, D / 2 + 0.82), WOODW, S.FLAT, [nF[0], 0, nF[1]]));
          at.box(F, W / 4, Hr - k * (W / 4) + 0.5, -D / 4, 0.7, 2.2, 0.7, { col: STONEW, s: S.ASHLAR }); }
        // фасад к виду: стекло на два этажа и в треугольнике фронтона, деревянные стойки и ригели; тёплый свет внутри
        { const gl = [P(-W / 2 + 0.2, 0.25, fz), P(W / 2 - 0.2, 0.25, fz), P(W / 2 - 0.2, Hw, fz), P(-W / 2 + 0.2, Hw, fz)], tri = [P(-W / 2 + 0.5, Hw, fz), P(W / 2 - 0.5, Hw, fz), P(0, Hr - 0.5, fz)];
          const gin = q => [q[0] - nF[0] * 0.5, q[1], q[2] - nF[1] * 0.5];
          void gin; const pc = pp => paneCol(pp[1], y + 0.25, y + Hr - 0.5);
          paneB.quad(...gl, pc); paneB.tri(...tri, pc);
          [-W / 2 + 0.2, -W / 6, W / 6, W / 2 - 0.2].forEach(xx => box(vc, F, xx, 0.25, fz + 0.04, 0.16, Math.min(Hr - 0.5 - (Hr - 0.5 - Hw) * Math.abs(xx) / (W / 2 - 0.5), Hr) - 0.3, 0.12, WOODW));
          box(vc, F, 0, Hw - 0.08, fz + 0.04, W - 0.2, 0.16, 0.14, WOODW); box(vc, F, 0, 2.3, fz + 0.04, W - 0.3, 0.12, 0.12, WOODW); }
        // терраса 1-го этажа с перилами, балкон 2-го этажа со стеклянным ограждением, лестница-ступени
        box(vc, F, 0, -0.05, fz + 1.5, W + 0.4, 0.3, 3.0, snowTop(rgb('#B58B62'), 0.75), { cols: { ny: WOODK } });
        for (let k = 0; k <= 12; k++) { const xx = -W / 2 - 0.1 + k * (W + 0.2) / 12; if (Math.abs(xx) < 0.7) continue; box(vc, F, xx, 0.25, fz + 2.92, 0.06, 0.8, 0.06, WOODW, { skip: { py: true, ny: true } }); }
        box(vc, F, -W / 4 - 0.35, 1.05, fz + 2.92, W / 2 - 0.5, 0.08, 0.12, snowTop(WOODL, 0.7)); box(vc, F, W / 4 + 0.35, 1.05, fz + 2.92, W / 2 - 0.5, 0.08, 0.12, snowTop(WOODL, 0.7));
        box(vc, F, 0, 2.38, fz + 0.75, W - 0.4, 0.14, 1.5, snowTop(WOODL, 0.8), { cols: { ny: WOODK } });
        glassB.quad(P(-W / 2 + 0.3, 2.52, fz + 1.5), P(W / 2 - 0.3, 2.52, fz + 1.5), P(W / 2 - 0.3, 3.45, fz + 1.5), P(-W / 2 + 0.3, 3.45, fz + 1.5), rgb('#CFEAF5'));
        box(vc, F, 0, 3.45, fz + 1.5, W - 0.5, 0.07, 0.09, WOODL);
        if (!WIN) { box(vc, F, -2.2, 0.1, fz + 1.7, 0.75, 0.42, 0.75, rgb('#C9A27A')); box(vc, F, 2.4, 0.1, fz + 1.4, 0.55, 0.12, 1.7, rgb('#F2E8D6')); const pq = P(3.6, 0.1, fz + 2.5); vc.cyl(pq[0], pq[1], pq[2], 0.3, 0.26, 0.45, { seg: 7, col: rgb('#B9744A') }); const pp = P(3.6, 0.9, fz + 2.5); vc.sph(pp[0], pp[1], pp[2], 0.42, 0.45, 0.42, rgb('#5E8A4E'), { seg: 7, rings: 4 }); }
        lampBracket(P(-W / 2 + 0.5, 2.0, fz + 0.12), nF);
        const c = F.p(0, 0, 0.6); colliders.push({ type: 'box', x: c[0], z: c[2], w: W + 0.4, d: D + 4.2, ry: F.ry, y0: y - 1, y1: y + Hr + 1, id: 'cottage' });
        camColliders.push({ type: 'box', x: c[0], z: c[2], w: W, d: D, ry: F.ry, y0: y - 1, y1: y + Hr, id: 'cottageCam', cam: true });
      });
      [[-74, -47.5], [-60, -98], [-20, -98], [-94, -48], [-16, -60], [-74, -86], [-52, -76]].forEach(([x, z]) => addTree(x, z, 1.0 + R() * 0.3, R() < 0.55 ? 'pine' : 'birch'));
      [[-30, -70], [-50, -70], [-60, -86]].forEach(([x, z]) => lampPost(x, y, z, 2.6));
    }
    function logBench(x, y, z, ry, tag) {
      const F = new K.Frame(x, y, z, ry), c = WIN ? mix(rgb('#8A5E3E'), SNOW, 0.25) : rgb('#8A5E3E');
      const p0 = F.p(-1.0, 0.32, 0), p1 = F.p(1.0, 0.32, 0), a = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);
      const g = new K.Frame((p0[0] + p1[0]) / 2, y, (p0[2] + p1[2]) / 2, a);
      // бревно лёжа (8 граней), торцы светлее
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU, r = 0.24, q = (aa, l) => g.p(Math.cos(aa) * r, 0.24 + Math.sin(aa) * r, l); vc.quad(q(a0, -1.0), q(a1, -1.0), q(a1, 1.0), q(a0, 1.0), i === 2 && WIN ? SNOW : mul(c, 0.9 + 0.12 * Math.sin(a0 + 1))); }
      [-1.0, 1.0].forEach(l => { const ctr = g.p(0, 0.24, l), pts = []; for (let i = 0; i < 8; i++) { const aa = i / 8 * TAU; pts.push(g.p(Math.cos(aa) * 0.24, 0.24 + Math.sin(aa) * 0.24, l)); } for (let i = 0; i < 8; i++) vc.tri(ctr, pts[(i + 1) % 8], pts[i], C('logEnd')); });
      colliders.push({ type: 'box', x, z, w: 2.1, d: 0.6, ry, y0: y - 1, y1: y + 0.5, id: 'log_' + tag });
    }
    /* ---------- 3.10б окрестности по фото (h3–h5): фонари по краю двора, ряды саженцев на газонном склоне у лестницы,
       пруд-линза под холмом — каменный борт, тёмная вода с отражением неба, низкие перила, кольцевая дорожка, шары-фонари ---------- */
    // саженец (фото h1/h4): тонкий ствол, два кола с жёлтой подвязкой, редкая крона (зимой — голый); col — свой круг-коллайдер
    function sapling(x, y, z, h, col, rr = R) {
      const stake = rgb('#B9A27E'), tie = rgb('#E8C547'), bark = rgb('#7A6A55');
      vc.cyl(x, y, z, 0.05, 0.03, h, { seg: 4, col: bark, cap: false });
      [-1, 1].forEach(sg => vcD.quad([x + sg * 0.22 - 0.025, y, z + sg * 0.05], [x + sg * 0.22 + 0.025, y, z + sg * 0.05], [x + sg * 0.22 + 0.025, y + 1.35, z + sg * 0.05], [x + sg * 0.22 - 0.025, y + 1.35, z + sg * 0.05], stake));
      vcD.quad([x - 0.24, y + 1.06, z], [x + 0.24, y + 1.06, z + 0.1], [x + 0.24, y + 1.11, z + 0.1], [x - 0.24, y + 1.11, z], tie);
      if (!WIN) vc.sph(x, y + h - 0.05, z, 0.42, 0.58, 0.42, rr() < 0.5 ? rgb('#8FB04A') : rgb('#AFBE52'), { seg: 5, rings: 2 });
      if (col) colCirc(x, z, 0.3, y - 1, y + 2, 'sapling');
    }
    function photoGrounds() {
      // фонари по краю двора у ограды и столбики-огоньки между ними (ночью — пунктир огней по краю плато, как на h5)
      [[-28, -28.6], [-12.9, -28.6], [12, -28.6], [27, -28.6], [47, -28.6]].forEach(([x, z]) => lampPost(x, 0, z));
      [-31.5, -24, 2, 7, 19.5, 31, 44, 51.5].forEach(x => { bollard(x, 0.04, -29.35); colCirc(x, -29.35, 0.12, -1, 0.7, 'bollard'); });
      // саженцы рядами по склону по обе стороны лестницы
      const xm = (ST_TOP.x0 + ST_TOP.x1) / 2;
      for (let j = 0; j < 5; j++) for (const i of [-3, -2, -1, 1, 2, 3]) {
        const x = xm + i * 3.2 + Math.sign(i) * 0.6 + (R() - 0.5) * 0.5, z = -32.6 - j * 3.0 + (R() - 0.5) * 0.5;
        sapling(x, hillY(x, z) - 0.05, z, 2.3 + R() * 0.7);
      }
      // пруд: контур-линза (к концам уже), кольца — борт, перила, дорожка, фонари
      const P = POND, N = 36, yW = -8 + 0.08, yR = -8 + 0.16;
      const ring = k => { const out = []; for (let i = 0; i < N; i++) { const a = i / N * TAU, ca = Math.cos(a), sa = Math.sin(a); out.push([P.x + ca * (P.rx + k), P.z + sa * (P.rz * (1 - P.lens * ca * ca) + k)]); } return out; };
      const Ri = ring(0), Ro = ring(0.4), Rr = ring(0.25), Rp = ring(1.6);
      // вода — в общей освещённой сетке (не в сетке бассейна: та ночью светится сама): светлее в середине — небо, к берегу
      // темнее; ночью темнеет вместе со склоном (h5), отблески фонарей — полосы в ночной сетке LED; зимой — лёд
      { const wc = WIN ? rgb('#E6EEF5') : rgb('#6F8499'), we = WIN ? rgb('#C9D6E2') : rgb('#3E4C5A'), C3 = [P.x, yW, P.z];
        for (let i = 0; i < N; i++) { const j = (i + 1) % N; vc.tri(C3, [Ri[j][0], yW, Ri[j][1]], [Ri[i][0], yW, Ri[i][1]], [wc, we, we], S.FLAT, null, [0, 1, 0]); } }
      const rimC = WIN ? rgb('#E2E6EA') : rgb('#C9C3B6'), pathC = WIN ? rgb('#E9EDF1') : rgb('#C2BEB2');
      for (let i = 0; i < N; i++) { const j = (i + 1) % N, P3 = (q, y) => [q[0], y, q[1]];
        at.quadF(P3(Ri[i], yR), P3(Ri[j], yR), P3(Ro[j], yR), P3(Ro[i], yR), rimC, S.SLAB, [0, 1, 0]);
        at.quadF(P3(Ri[i], yW - 0.03), P3(Ri[j], yW - 0.03), P3(Ri[j], yR), P3(Ri[i], yR), mul(rimC, 0.8), S.SLAB, [P.x - Ri[i][0], 0, P.z - Ri[i][1]]);
        at.quadF(P3(Ro[i], -8), P3(Ro[j], -8), P3(Ro[j], yR), P3(Ro[i], yR), mul(rimC, 0.86), S.SLAB, [Ro[i][0] - P.x, 0, Ro[i][1] - P.z]);
        vc.quadF(P3(Ro[i], -8 + 0.035), P3(Ro[j], -8 + 0.035), P3(Rp[j], -8 + 0.035), P3(Rp[i], -8 + 0.035), pathC, S.FLAT, [0, 1, 0]);
        // низкие перила по борту: стойки через 2 м, две перекладины
        if (i % 2 === 0) vc.cyl(Rr[i][0], yR, Rr[i][1], 0.03, 0.03, 1.0, { seg: 4, col: METAL, cap: false });
        [0.5, 0.95].forEach(h => vcD.quad(P3(Rr[i], yR + h), P3(Rr[j], yR + h), P3(Rr[j], yR + h + 0.04), P3(Rr[i], yR + h + 0.04), METAL)); }
      // шары-фонари по внешнему краю дорожки; под каждым на воде — тёплая полоса отблеска (ночная сетка LED: днём её нет)
      const Rl = ring(1.9);
      for (let k = 0; k < 6; k++) { const ik = Math.round((k + 0.5) / 6 * N) % N, q = Rl[ik], x = q[0], z = q[1];
        vc.cyl(x, -8, z, 0.06, 0.05, 2.0, { seg: 5, col: METAL, cap: false }); lantB.sph(x, -8 + 2.12, z, 0.2, 0.2, 0.2, rgb('#FFE6B8'), { seg: 6, rings: 4 });
        NIGHT.lamps.push([x, -8 + 2.12, z]); colCirc(x, z, 0.12, -9, -6, 'lamp');
        const e = Ri[ik], dx = P.x - e[0], dz = P.z - e[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, w = 0.13, a0 = 0.25, a1 = Math.min(2.4, L * 0.6), y = yW + 0.012, hot = mul(LEDGLOW, 0.8), dim = [0, 0, 0];
        ledGlowB.quad([e[0] + ux * a0 + uz * w, y, e[1] + uz * a0 - ux * w], [e[0] + ux * a0 - uz * w, y, e[1] + uz * a0 + ux * w], [e[0] + ux * a1 - uz * w * 0.5, y, e[1] + uz * a1 + ux * w * 0.5], [e[0] + ux * a1 + uz * w * 0.5, y, e[1] + uz * a1 - ux * w * 0.5], [hot, hot, dim, dim], S.FLAT, null, [0, 1, 0]); }
      // у подножия лестницы — киоск из тёмно-красного кирпича с плоской крышей (h4): дверь к лестнице, окошко на юг
      { const x = -14.5, z = -47.6, y = -8, kc = rgb('#8E4A3E');
        box(at, F0, x, y, z, 2.2, 2.4, 2.2, kc, { s: S.ASHLAR, skip: { ny: true } });
        box(vc, F0, x, y + 2.4, z, 2.6, 0.16, 2.6, snowTop(rgb('#5A4E46'), 0.9));
        vc.quadF([x - 1.11, y, z + 0.45], [x - 1.11, y, z - 0.45], [x - 1.11, y + 2.0, z - 0.45], [x - 1.11, y + 2.0, z + 0.45], HDOOR, S.FLAT, [-1, 0, 0]);
        vc.quadF([x - 0.6, y + 1.1, z - 1.11], [x + 0.6, y + 1.1, z - 1.11], [x + 0.6, y + 1.8, z - 1.11], [x - 0.6, y + 1.8, z - 1.11], rgb('#4A4E58'), S.FLAT, [0, 0, -1]);
        colBox(x, z, 2.3, 2.3, y - 1, y + 2.6, 'kiosk'); }
      // вода и борт — непроходимы: круги вдоль линзы (радиус — полуширина воды у центра круга + борт); выше прыжка (перила не
      // перепрыгнуть), камера сквозь круги смотрит
      [0, 0.3, -0.3, 0.55, -0.55, 0.78, -0.78].forEach(fx => { const hz = P.rz * (1 - P.lens * fx * fx) * Math.sqrt(1 - fx * fx); colCirc(P.x + fx * P.rx, P.z, hz + 0.35, -9, -6.6, 'pond'); });
    }

    /* ---------- 3.11 вывески — один атлас-канвас, одна сетка ---------- */
    function signsMesh() {
      if (!props.signs.length) return null;
      const cvs = props.signs.map(s => VK.signCanvas(s.text, { bg: s.bg, fg: s.fg, border: s.border, size: 56, pad: 24 }));
      const W = 1024, rows = []; let y = 0; cvs.forEach(c => { const h = Math.round(c.height * Math.min(1, W / c.width)); rows.push({ y, h, w: Math.min(W, c.width) }); y += h + 4; });
      const [cv, cx] = K.cnv(W, Math.max(64, Math.pow(2, Math.ceil(Math.log2(y))))); cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, cv.width, cv.height);
      cvs.forEach((c, i) => cx.drawImage(c, 0, rows[i].y, rows[i].w, rows[i].h));
      const P = [], U = [], I = [], Hh = cv.height;
      props.signs.forEach((s, i) => {
        const r = rows[i], asp = r.w / r.h, h = s.h, w = h * asp, c = Math.cos(s.ry), sn = Math.sin(s.ry), rx = c, rz = -sn, nx = sn * 0.02, nz = c * 0.02;
        const p = s.p, b = P.length / 3; [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].forEach(([a, bb]) => P.push(p[0] + rx * a + nx, p[1] + bb, p[2] + rz * a + nz));
        U.push(0, 1 - (r.y + r.h) / Hh, r.w / W, 1 - (r.y + r.h) / Hh, r.w / W, 1 - r.y / Hh, 0, 1 - r.y / Hh); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
      const m = new T.Mesh(K.keep(g), K.keep(new T.MeshBasicMaterial({ map: K.tex(cv), side: T.DoubleSide }))); m.name = 'signs'; return m;
    }

    /* ---------- 3.12 небо, хребты, облака, море облаков в долине ---------- */
    const BG = {};
    function backdrop() {
      // хребты: три кольца вокруг холма (внутри camera.far)
      { const P3 = [], C3 = [], I3 = [];
        // волна 6 (p11): горы выше, острее, ближний хребет — зеленее (травяные склоны в дымке)
        const rings = WIN ? [[1220, [80, 220], '#C9D6E2'], [1360, [110, 260], '#D9E3EC'], [1480, [140, 300], '#E4EBF2']] : [[1220, [80, 220], '#7F9E8C'], [1360, [110, 260], '#9DB4BE'], [1480, [140, 300], '#BFCED8']];
        rings.forEach(([R0, [h0, h1], cc], li) => { const n = 180, c = rgb(cc), base = P3.length / 3;
          for (let i = 0; i <= n; i++) { const a = i / n * TAU, w = 0.5 + 0.28 * Math.sin(a * 5 + li * 1.7) + 0.16 * Math.sin(a * 13 + li * 2.3) + 0.06 * Math.sin(a * 31 + li), hh = h0 + (h1 - h0) * Math.pow(clamp(w, 0, 1), 1.6) - 30;
            P3.push(HC.x + Math.sin(a) * R0, -200, HC.z + Math.cos(a) * R0, HC.x + Math.sin(a) * R0, hh, HC.z + Math.cos(a) * R0); C3.push(...(li === 0 && !WIN ? mix(c, rgb('#5F845A'), 0.45) : mul(c, 0.94)), ...c);
            if (i) { const o = base + (i - 1) * 2; I3.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } } });
        const g3 = new T.BufferGeometry(); g3.setAttribute('position', new T.Float32BufferAttribute(P3, 3)); g3.setAttribute('color', new T.Float32BufferAttribute(C3, 3)); g3.setIndex(I3); g3.computeBoundingSphere();
        BG.ridges = new T.Mesh(K.keep(g3), K.basicVCD); BG.ridges.renderOrder = 7; root.add(BG.ridges); }
      { const g4 = new T.SphereGeometry(1580, 32, 14), n = g4.attributes.position.count; g4.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
        BG.sky = new T.Mesh(K.keep(g4), K.keep(new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
        BG.sky.renderOrder = 9; BG.sky.frustumCulled = false; root.add(BG.sky); }
      BG.puffs = VK.skyClouds(T, { keep: K.keep, radius: 1420, count: 14, order: 10, seed: 515, az0: 40, hero: [[318, 9, 0.6], [300, 14, 0.9], [340, 6, 0.4]] }); root.add(BG.puffs);
      // море облаков в долине (верх на макро −90, как у села)
      const cl = (yM, rep, op) => { const tx = K.cloudTex.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(rep, rep); K.keep(tx);
        const m = new T.Mesh(K.keep(new T.PlaneGeometry(3200, 3200)), K.keep(new T.MeshBasicMaterial({ map: tx, color: new T.Color('#F6F8FA'), transparent: true, opacity: op, fog: false, depthWrite: false })));
        m.rotation.x = -PI / 2; const c = toLocal(-11.2, yM, 280); m.position.set(c.x, c.y, c.z); m.renderOrder = 1; root.add(m); return m; };
      BG.cloudA = cl(-90, 7, 0.94); BG.cloudB = HI ? cl(-97, 4.3, 0.82) : null;
      BG.clouds = opts.clouds !== false; if (!BG.clouds) { BG.cloudA.visible = false; if (BG.cloudB) BG.cloudB.visible = false; }
    }

    /* ---------- 3.13 село вдали (настоящее, макро-оси через шарнир), лента серпантина, площадка финиша ---------- */
    const pivot = new T.Group(); pivot.name = 'hotel:macro'; pivot.rotation.y = -FR.ry; { const o = toLocal(0, 0, 0); pivot.position.set(o.x, o.y, o.z); } root.add(pivot);
    let village = null, serpRib = null, landing = null;
    function farWorld() {
      const KR = V.regions.kubachi, SP = V.regions.serpentine;
      if (opts.village !== false && KR && KR.distant) { try { village = KR.distant(T, season, { named, lite: true }); pivot.add(village); } catch (e) { console.warn('hotel: distant village', e); village = null; } }
      if (SP && SP.distant) { try { serpRib = SP.distant(T, season, { w: 1.4, col: WIN ? '#E6EAEE' : '#C8C2B0', wall: WIN ? '#DDE3E9' : '#9A9078', skirt: 1.6 }); serpRib.material.dispose(); serpRib.material = K.keep(new T.MeshBasicMaterial({ vertexColors: true, fog: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 })); K.keep(serpRib.geometry); serpRib.renderOrder = 7; pivot.add(serpRib); } catch (e) { serpRib = null; } }
      if (V.zipline && V.zipline.buildLanding) { try { landing = V.zipline.buildLanding({ THREE: T, season, quality, cable: false }); pivot.add(landing.group); } catch (e) { console.warn('hotel: landing', e); landing = null; } }
    }
    // маршрут зиплайна (локальные оси); без zipline.js — свой расчёт по той же формуле
    function route() { if (V.zipline && V.zipline.route) return V.zipline.route('hotel'); const t = toMacro(TW.x, 0, TW.z), L = GEO.landing, dl = Math.hypot(L.x - t.x, L.z - t.z), d = [(L.x - t.x) / dl, (L.z - t.z) / dl], dir = { x: d[0] * FC - d[1] * FS, z: d[0] * FS + d[1] * FC }; const to = toLocal(L.x + d[0] * 2.4, 2.45, L.z + d[1] * 2.4); return { from: { x: TW.x - dir.x * 0.3, y: TW.floor + 2.6, z: TW.z - dir.z * 0.3 }, to, sag: dl * 0.02, dir, heading: Math.atan2(dir.x, dir.z), launch: { x: TW.x + dir.x * 1.2, y: TW.floor, z: TW.z + dir.z * 1.2, ry: Math.atan2(dir.x, dir.z) }, u0: 0.002, uStop: 0.996, lenH: dl }; }

    /* ---------- 3.14 жители: козочка, енот, выдра, медвежонок, сурок (+ выдра плавает в бассейне, молча) ---------- */
    const NPCB = {
      hotel_goat: () => K.npc('hotel_goat', ({ n, body, P, face, M, GEO: G }) => {
        const w = M('#F4EFE6'), wd = M('#E2D8C8'), horn = M('#D9C7A2'), vest = M('#3E5E8E'), badge = M('#E8C770', { emissive: '#C9A040', emissiveIntensity: 0.15 }), hoof = M('#6E5A4E'), sc = M('#D9455A');
        P(body, G.sph, vest, [0, 0.42, 0], [0.25, 0.3, 0.23]); P(body, G.sph, w, [0, 0.46, 0.1], [0.12, 0.2, 0.12], null, false); P(body, G.sph, w, [0, 0.7, 0.0], [0.16, 0.08, 0.15], null, false);
        P(body, G.sph, badge, [0.09, 0.55, 0.22], [0.035, 0.035, 0.015], null, false);
        [-1, 1].forEach(sd => { P(body, G.sph, hoof, [sd * 0.1, 0.07, 0.05], [0.07, 0.06, 0.1]); P(body, G.sph, w, [sd * 0.24, 0.48, 0.08], [0.06, 0.16, 0.06], [0.6, 0, sd * 0.3]); });
        const head = new T.Group(); head.position.set(0, 0.88, 0.04); body.add(head); n.head = head;
        P(head, G.sph, w, [0, 0, 0], [0.2, 0.21, 0.21]); P(head, G.sph, wd, [0, -0.06, 0.13], [0.11, 0.09, 0.09], null, false);
        face(head, { er: 30, ex: 86, ey: 330, nose: '#B9776E', noseW: 14, noseH: 9, mouth: 'smile', lash: true, white: true }, [0.2, 0.21, 0.21]);
        [-1, 1].forEach(sd => { P(head, G.cone, horn, [sd * 0.08, 0.2, -0.04], [0.035, 0.12, 0.035], [-0.35, 0, -sd * 0.25]); P(head, G.sph, w, [sd * 0.21, 0.03, -0.02], [0.09, 0.035, 0.05], [0, 0, -sd * 0.35]); });
        P(head, G.sph, wd, [0, -0.2, 0.08], [0.04, 0.07, 0.04], null, false);   // бородка
        P(body, G.torus, sc, [0, 0.66, 0.02], [0.15, 0.15, 0.11], [PI / 2, 0, 0], false);
      }),
      hotel_raccoon: () => K.npc('hotel_raccoon', ({ n, body, P, face, M, GEO: G }) => {
        const g = M('#9A9690'), gd = M('#5E5A58'), w = M('#F2EEE8'), cap = M('#D9455A'), wh = M('#E8E8E2'), whistle = M('#E8C770', { emissive: '#C9A040', emissiveIntensity: 0.12 });
        P(body, G.sph, g, [0, 0.4, 0], [0.26, 0.28, 0.24]); P(body, G.sph, w, [0, 0.38, 0.13], [0.15, 0.17, 0.11], null, false);
        P(body, G.torus, M('#3E7CC0'), [0, 0.3, 0.0], [0.25, 0.25, 0.4], [PI / 2, 0, 0], false);   // спортивный пояс
        [-1, 1].forEach(sd => P(body, G.sph, gd, [sd * 0.11, 0.07, 0.06], [0.08, 0.06, 0.11]));
        n.tail = new T.Group(); n.tail.position.set(0, 0.25, -0.24); body.add(n.tail);
        for (let i = 0; i < 5; i++) P(n.tail, G.sph, i % 2 ? gd : g, [0, 0.02 + i * 0.02, -0.07 - i * 0.075], [0.085, 0.085, 0.07]);
        P(body, G.cyl, whistle, [0.08, 0.6, 0.22], [0.025, 0.06, 0.025], [PI / 2, 0, 0], false);
        const head = new T.Group(); head.position.set(0, 0.84, 0.04); body.add(head); n.head = head;
        P(head, G.sph, g, [0, 0, 0], [0.24, 0.21, 0.22]);
        face(head, { mask: '#4A4442', white: true, nose: '#2E2A3B', mouth: 'w', ey: 350, er: 30 }, [0.24, 0.21, 0.22]);
        [-1, 1].forEach(sd => { P(head, G.cone, g, [sd * 0.15, 0.16, -0.04], [0.06, 0.1, 0.04], [0, 0, -sd * 0.4]); P(head, G.cone, wh, [sd * 0.145, 0.15, -0.025], [0.035, 0.06, 0.02], [0, 0, -sd * 0.4], false); });
        P(head, G.hemi, cap, [0, 0.07, -0.01], [0.235, 0.17, 0.225], [-0.15, 0, 0]); P(head, G.box, cap, [0, 0.08, 0.2], [0.26, 0.025, 0.16], [0.1, 0, 0], false);
      }),
      hotel_otter: () => K.npc('hotel_otter', ({ n, body, P, face, M, GEO: G }) => {
        const b = M('#8A6248'), bl = M('#D9BFA0'), cap = M('#4AB0D8'), ring = M('#F6F2EA'), ringR = M('#D9455A');
        P(body, G.sph, b, [0, 0.44, 0], [0.21, 0.34, 0.2]); P(body, G.sph, bl, [0, 0.42, 0.11], [0.13, 0.24, 0.1], null, false);
        [-1, 1].forEach(sd => { P(body, G.sph, b, [sd * 0.1, 0.07, 0.06], [0.07, 0.05, 0.1]); P(body, G.sph, b, [sd * 0.2, 0.5, 0.1], [0.05, 0.14, 0.05], [0.4, 0, sd * 0.4]); });
        n.tail = new T.Group(); n.tail.position.set(0, 0.16, -0.18); body.add(n.tail); P(n.tail, G.cone, b, [0, -0.05, -0.18], [0.07, 0.36, 0.05], [-1.3, 0, 0]);
        // спасательный круг на боку
        P(body, G.torus, ring, [0.26, 0.35, 0.02], [0.2, 0.2, 0.2], [0, PI / 2, 0], false);
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; P(body, G.sph, ringR, [0.26, 0.35 + Math.sin(a) * 0.2, 0.02 + Math.cos(a) * 0.2], [0.06, 0.07, 0.07], null, false); }
        const head = new T.Group(); head.position.set(0, 0.9, 0.03); body.add(head); n.head = head;
        P(head, G.sph, b, [0, 0, 0], [0.18, 0.17, 0.17]); P(head, G.sph, bl, [0, -0.05, 0.11], [0.11, 0.08, 0.08], null, false);
        face(head, { er: 28, ex: 80, ey: 330, nose: '#3A2E3F', noseW: 16, noseH: 10, mouth: 'w', white: true }, [0.18, 0.17, 0.17]);
        P(head, G.hemi, cap, [0, 0.03, -0.01], [0.19, 0.17, 0.185], [-0.25, 0, 0]);
        [-1, 1].forEach(sd => P(head, G.sph, b, [sd * 0.15, 0.08, -0.02], [0.04, 0.04, 0.03], null, false));
        n.extra = t => { n.tail.rotation.x = Math.sin(t * 2.2) * 0.12; };
      }),
      hotel_bear: () => K.npc('hotel_bear', ({ n, body, P, face, M, GEO: G }) => {
        const b = M('#9C6B4E'), bl = M('#D9B99A'), hat = M('#4F8F86'), pom = M('#F6F2EA'), sc = M('#F2B544');
        P(body, G.sph, b, [0, 0.38, 0], [0.27, 0.3, 0.25]); P(body, G.sph, bl, [0, 0.36, 0.14], [0.16, 0.19, 0.11], null, false);
        [-1, 1].forEach(sd => { P(body, G.sph, b, [sd * 0.13, 0.1, 0.13], [0.09, 0.08, 0.14]); P(body, G.sph, b, [sd * 0.24, 0.42, 0.14], [0.07, 0.14, 0.07], [0.9, 0, sd * 0.3]); });
        P(body, G.torus, sc, [0, 0.62, 0.02], [0.17, 0.17, 0.12], [PI / 2, 0, 0], false); P(body, G.box, sc, [0.1, 0.5, 0.18], [0.07, 0.18, 0.03], [0.1, 0, 0.1], false);
        const head = new T.Group(); head.position.set(0, 0.84, 0.03); body.add(head); n.head = head;
        P(head, G.sph, b, [0, 0, 0], [0.23, 0.21, 0.21]); P(head, G.sph, bl, [0, -0.06, 0.15], [0.11, 0.08, 0.08], null, false);
        face(head, { er: 28, ex: 84, ey: 340, nose: '#3A2E3F', noseW: 18, noseH: 12, mouth: 'smile', white: true }, [0.23, 0.21, 0.21]);
        [-1, 1].forEach(sd => P(head, G.sph, b, [sd * 0.17, 0.15, -0.03], [0.07, 0.07, 0.05]));
        P(head, G.hemi, hat, [0, 0.06, -0.01], [0.235, 0.19, 0.225], [-0.2, 0, 0]); P(head, G.sph, pom, [0, 0.25, -0.05], [0.07, 0.07, 0.07], null, false);
        n.extra = t => { n.body.rotation.x = Math.sin(t * 0.8) * 0.03; };
      }),
      hotel_marmot: () => K.npc('hotel_marmot', ({ n, body, P, face, M, GEO: G }) => {
        const b = M('#C49A6A'), bd = M('#9C7448'), bl = M('#EAD6B8'), helmet = M('#F2B544'), strap = M('#D9455A'), steel = M('#A9AEB5');
        P(body, G.sph, b, [0, 0.36, 0], [0.22, 0.3, 0.2]); P(body, G.sph, bl, [0, 0.34, 0.11], [0.13, 0.2, 0.1], null, false);
        P(body, G.box, strap, [0, 0.3, 0.0], [0.47, 0.06, 0.42], null, false); P(body, G.box, strap, [0.1, 0.45, 0.19], [0.05, 0.3, 0.03], [0, 0, 0.35], false); P(body, G.torus, steel, [0, 0.3, 0.22], [0.04, 0.04, 0.04], null, false);
        [-1, 1].forEach(sd => { P(body, G.sph, bd, [sd * 0.09, 0.06, 0.06], [0.06, 0.05, 0.09]); P(body, G.sph, b, [sd * 0.19, 0.46, 0.1], [0.05, 0.12, 0.05], [0.5, 0, sd * 0.4]); });
        n.tail = new T.Group(); n.tail.position.set(0, 0.14, -0.18); body.add(n.tail); P(n.tail, G.sph, bd, [0, 0.0, -0.08], [0.05, 0.05, 0.12]);
        const head = new T.Group(); head.position.set(0, 0.8, 0.03); body.add(head); n.head = head;
        P(head, G.sph, b, [0, 0, 0], [0.18, 0.17, 0.17]); P(head, G.sph, bl, [0, -0.06, 0.11], [0.1, 0.08, 0.08], null, false);
        face(head, { er: 28, ex: 80, ey: 340, nose: '#4A3A30', noseW: 15, noseH: 10, mouth: 'w', white: true }, [0.18, 0.17, 0.17]);
        P(head, G.hemi, helmet, [0, 0.04, -0.01], [0.2, 0.19, 0.2], [-0.15, 0, 0]); P(head, G.box, M('#2F3440'), [0, -0.02, 0.17], [0.04, 0.05, 0.02], null, false);
        [-1, 1].forEach(sd => P(head, G.sph, bd, [sd * 0.13, 0.1, -0.03], [0.035, 0.035, 0.025], null, false));
        n.extra = t => { n.body.position.y += Math.max(0, Math.sin(t * 1.9)) * 0.02; };
      }),
    };
    const NPC_SCALE = { hotel_goat: 1.18, hotel_raccoon: 1.16, hotel_otter: 1.12, hotel_bear: 1.2, hotel_marmot: 1.12 };
    const NPC_SEAT = { hotel_bear: 0.6 };
    function placeNpc(id, x, z, ry, o = {}) {
      const LN = linesFor(named), n = NPCB[o.kind || id](), y = o.y !== undefined ? o.y : groundY(x, z), sc = o.scale || NPC_SCALE[o.kind || id] || 1;
      n.root.position.set(x, y, z); n.root.rotation.y = ry; root.add(n.root);
      if (sc !== 1) { const sg = new T.Group(); sg.name = 'npcScale'; sg.scale.setScalar(sc); n.root.remove(n.body); sg.add(n.body); n.root.add(sg); }
      const sp = SPEAKERS[o.kind || id] || { name: id };
      const rec = Object.assign(n, { id: o.uid || id, speaker: o.speaker || id, name: o.name || sp.name, x, y, z, ry0: ry, home: [x, y, z, ry], headY: (o.headY || 1.1) * sc, talkR: (o.talkR || 2.3) + (sc - 1) * 1.2,
        lines: o.silent ? [] : (LN[id] || []).map(l => l.text), lineObjs: o.silent ? [] : (LN[id] || []), silent: !!o.silent, scale: sc, seatYaw: o.seatYaw !== undefined ? o.seatYaw : (NPC_SEAT[id] || 0), faceHero: 0, level: o.level || 'ground' });
      npcs.push(rec); if (!o.silent) colliders.push({ type: 'circle', x, z, r: 0.38 * sc, y0: y - 1, y1: y + 1.4, id: 'npc' });
      return rec;
    }
    function residents() {
      placeNpc('hotel_goat', -1.8, 12.4, PI, { headY: 1.25 });
      placeNpc('hotel_raccoon', 39.2, -59.6, -PI / 2 - 0.4, { headY: 1.2 });
      placeNpc('hotel_otter', 30.5, -3.6, PI + 0.3, { y: 0.04, headY: 1.2 });
      { const f = FIRE; placeNpc('hotel_bear', f.x - 3.05, f.z + 1.2, PI / 2 + 0.3, { y: -8 + 0.38, headY: 1.15, talkR: 3.0 }); }
      { const R0 = route(), x = TW.x - R0.dir.z * 0.95 - R0.dir.x * 0.25, z = TW.z + R0.dir.x * 0.95 - R0.dir.z * 0.25; placeNpc('hotel_marmot', x, z, Math.atan2(R0.launch.x - x, R0.launch.z - z), { y: TW.floor + 0.04, headY: 1.0, level: 'top', talkR: 1.8 }); }
      // выдра плавает в бассейне (молча, за стеклом)
      const sw = placeNpc('hotel_otter', 30, 18.5, PI / 2, { uid: 'pool_swimmer', y: -0.25, silent: true, headY: 1.0 }); sw.swim = 0;
    }

    /* =====================================================================
       СБОРКА
       ===================================================================== */
    const bTri0 = vc.count() + at.count() + ledGlowB.count(), bWin0 = glaz.length;
    mainBuilding();
    const mainTris = vc.count() + at.count() + ledGlowB.count() - bTri0 + (glaz.length - bWin0) * 2;
    poolHall(); courtyard(); tower(); parking(); sports(); relax(); photoGrounds();
    // деревья на склонах и у подножия (не на дороге, не на площадках)
    { let k = 0; for (let tries = 0; tries < 2600 && k < (HI ? 170 : 120); tries++) { const a = R() * TAU, r = 30 + Math.pow(R(), 0.8) * 200, x = HC.x + Math.sin(a) * r, z = HC.z + Math.cos(a) * r;
        if (sdUnion(x, z) < 4) continue; const rn = ROAD.near(x, z); if (rn && rn.d < 5) continue; if (Math.abs(x - TW.x) < 12 && z < -20 && z > -200 && Math.abs(x + 20) < 30) continue;   // под тросом — пусто
        const y = hillY(x, z); if (y < -60) continue; addTree(x, z, 0.9 + R() * 0.6, R() < 0.45 ? 'pine' : R() < 0.5 ? 'rowan' : 'birch', y - 0.1); k++; }
      // камни на склоне (low — реже: бюджет видов со смотровой и с лестницы)
      for (let i = 0; i < (HI ? 70 : 50); i++) { const a = R() * TAU, r = 25 + R() * 160, x = HC.x + Math.sin(a) * r, z = HC.z + Math.cos(a) * r; if (sdUnion(x, z) < 3) continue; const rn = ROAD.near(x, z); if (rn && rn.d < 3.4) continue; rocks.push({ x, z, r: 0.4 + R() * 0.9, h: 0.35 + R() * 0.6 }); }
      // камни на обочине дороги (старая горная дорога, без ограждений — только камни по краю)
      for (let i = 0; i < ROAD.N; i += 7) { const s = R() < 0.5 ? 1 : -1, d = ROAD.w + 0.6 + R() * 1.4, x = ROAD.x[i] + Math.cos(ROAD.th[i]) * s * d, z = ROAD.z[i] - Math.sin(ROAD.th[i]) * s * d; if (sdUnion(x, z) < 2) continue; rocks.push({ x, z, r: 0.25 + R() * 0.45, h: 0.2 + R() * 0.3 }); }
    }
    terraces();
    residents();
    backdrop();
    farWorld();

    // снег на верхних гранях (зима), как в селе
    const snowify = bk => { if (!WIN) return; for (let i = 0; i < bk.n; i++) { const ny = bk.N[i * 3 + 1]; if (ny > 0.55) { const k = 0.88 * sst(0.55, 0.8, ny); for (let c = 0; c < 3; c++) bk.C[i * 3 + c] = lerp(bk.C[i * 3 + c], SNOW[c] * 1.08, k); } } };
    const add = (m, o = {}) => { if (!m) return null; m.castShadow = !!o.cast && HI; m.receiveShadow = o.receive !== false && HI; if (o.order) m.renderOrder = o.order; if (o.name) m.name = o.name; root.add(m); return m; };
    const LIT = [];
    const litMesh = m => { if (!m || !K.BAKED) return m; const g = m.geometry; if (g.attributes.color && g.attributes.normal) LIT.push({ col: g.attributes.color, alb: Float32Array.from(g.attributes.color.array), nor: g.attributes.normal }); return m; };
    // 4B: склеенные сетки — кусками по 40 м (отсечение по пирамиде камеры: со смотровой корпус за спиной не рисуется)
    // ключ куска: 'zone' — по площадкам (двор у фасада / двор у смотровой / парковка / спорт / отдых / прочее), 'quad' — четверти вокруг холма
    // корпус вместе с залом бассейна — свой кусок (со смотровой и с башни, спиной к ним, не рисуется; один кусок, а не два —
    // −2 вызова в видах на корпус). Земля (газон, плиты, настил — грани не выше 0,1 м) — в 'topB': кусок 'main' ночью
    // приглушается, и плитка газона, разрезанная по центрам треугольников, светилась клином рядом с тёмным треугольником
    // на high кровля корпуса (всё выше 11 м над пятном с выносами: скаты, софит, доски, желоба, отводы труб, щипцы) — кусок без
    // отбрасывания тени: при солнце сбоку вынос карниза клал на стены широкую тёмную полосу (на h1/h2 стены ровно светлые)
    const ZONE = (x, z, hy, ly) => (z < -36 ? (x > -6 ? 'mid' : 'low') : x < -34 ? 'park' : z < -6 ? 'topF' : HI && ly > MAIN.eave - 0.95 && x > MAIN.x0 - 1.7 && x < MAIN.x1 + 1.7 && z > MAIN.z0 - 1.1 && z < MAIN.z1 + 1.1 ? 'roof' : ((z > MAIN.z0 - 1.7 && x > MAIN.x0 - 1.5 && x < MAIN.x1 + 1.5) || x >= 23) && !(hy < 0.1) ? 'main' : 'topB');
    const QUAD = (x, z) => String(Math.floor((Math.atan2(x - HC.x, z - HC.z) + PI) / (PI / 2)) % 4);
    function splitGeo(g, keyFn) {
      const P = g.attributes.position.array, names = Object.keys(g.attributes), nIdx = g.index ? g.index.count : g.attributes.position.count, IX = g.index ? g.index.array : null, groups = new Map();
      for (let t = 0; t < nIdx; t += 3) { const a = IX ? IX[t] : t, b = IX ? IX[t + 1] : t + 1, c = IX ? IX[t + 2] : t + 2, cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
        const k = keyFn(cx, cz, Math.max(P[a * 3 + 1], P[b * 3 + 1], P[c * 3 + 1]), Math.min(P[a * 3 + 1], P[b * 3 + 1], P[c * 3 + 1])); let L = groups.get(k); if (!L) groups.set(k, L = []); L.push(a, b, c); }
      if (groups.size < 2) return [g];
      const out = [];
      groups.forEach((L, key) => { const map = new Map(), ni = new Array(L.length); let n = 0; for (let i = 0; i < L.length; i++) { let v = map.get(L[i]); if (v === undefined) { v = n++; map.set(L[i], v); } ni[i] = v; }
        const ng = new T.BufferGeometry(); names.forEach(nm => { const A = g.attributes[nm], sz = A.itemSize, src = A.array, dst = new src.constructor(n * sz); map.forEach((v, o) => { for (let q = 0; q < sz; q++) dst[v * sz + q] = src[o * sz + q]; }); ng.setAttribute(nm, new T.BufferAttribute(dst, sz)); });
        ng.setIndex(n > 65535 ? new T.Uint32BufferAttribute(ni, 1) : new T.Uint16BufferAttribute(ni, 1)); ng.computeBoundingSphere(); ng.userData.zone = key; out.push(K.keep(ng)); });
      g.dispose(); return out;
    }
    // корпус ночью темнее (h5: тёмный объём с золотыми линиями): у куска 'main' — свой экземпляр материала (тот же шейдер, 0
    // новых вызовов), setNight приглушает его цвет
    const mainMats = [];
    const mainMat = src => { const m2 = K.keep(src.clone()); ['onBeforeCompile', 'customProgramCacheKey'].forEach(k => { if (src.hasOwnProperty(k)) m2[k] = src[k]; }); mainMats.push(m2); return m2; };
    const addSplit = (m, o = {}, keyFn = ZONE) => { if (!m) return null; if (!keyFn) { add(litMesh(m), o); return m; } const gs = splitGeo(m.geometry, keyFn); const list = gs.map((g, i) => { const zn = g.userData.zone, mm = gs.length > 1 ? new T.Mesh(g, (zn === 'main' || zn === 'roof') && (m.material === K.vcMat || m.material === K.atlasMat) ? mainMat(m.material) : m.material) : m; if (gs.length > 1) Object.assign(mm.userData, m.userData); add(litMesh(mm), Object.assign({}, o, { name: (o.name || 'part') + (gs.length > 1 ? '#' + i : ''), cast: o.cast && zn !== 'roof' })); return mm; }); return list[0]; };
    snowify(at); snowify(vc);
    const meshAt = addSplit(at.mesh(K.atlasMat), { cast: true, name: 'stone' });
    const meshVC = addSplit(vc.mesh(K.vcMat), { cast: true, name: 'hotelVC' });
    const meshVCD = addSplit(vcD.mesh(K.vcMatD), { cast: false, name: 'hotelVCD' }, null);
    const meshT = add(litMesh(terrainNear()), { cast: false, name: 'terrainNear' });
    const meshTF = add(terrainFar(), { receive: false });
    const meshTB = addSplit(TB.mesh(K.vcMat), { cast: false, name: 'terraces' }, QUAD);
    // ROAD2 («деревья висят в воздухе», щель под камнями у дороги): деревья и камни вне площадок — на видимую землю. Полярная
    // сетка холма (кольца до 9 м) расходится с hillY на метры (у выемки дороги — до 5,5 м), проступи террас лежат над склоном
    // на ступень. На площадках, лестницах и башне — как было
    {
      const nat = (x, z) => !padAt(x, z) && Math.hypot(x - TW.x, z - TW.z) >= TW.rT, g = meshT.geometry, items = [], pts = [], gone = new Set();
      // под каждым — центр и 4 точки по кругу (ствол 0,4 м, камень — полрадиуса): на кромке ступени (разброс высот больше
      // ~0,8 м) половина основания висела бы над откосом — такое дерево или камень не ставим
      const probe = (x, z, rr, it) => { const o = { it, s: [] }; items.push(o); [[0, 0], [rr, 0], [-rr, 0], [0, rr], [0, -rr]].forEach(([dx, dz]) => { const p = { x: x + dx, z: z + dz }; o.s.push(p); pts.push(p); }); };
      TREES.forEach(q => { if (nat(q.t.p[0], q.t.p[2])) probe(q.t.p[0], q.t.p[2], 0.4, { q }); });
      rocks.forEach(r => { if (nat(r.x, r.z)) probe(r.x, r.z, 0.5 * r.r, { r }); });
      // проступи и откосы террас — земля (и дальний рельеф за 300 м, куда заходят крайние поля); в стожке дерево или камень не ставим
      dropOnto(pts, [{ P: g.attributes.position.array, I: g.index ? g.index.array : null }, { P: TB.P, I: TB.I }, { P: meshTF.geometry.attributes.position.array, I: meshTF.geometry.index.array }]);
      const drop = it => { if (it.r) gone.add(it.r); else { gone.add(it.q.t); gone.add(it.q.c); } };
      items.forEach(({ it, s: S }) => {
        const c = S[0], x = c.x, z = c.z;
        if (STACKS.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + 0.6)) { drop(it); return; }
        if (!S.every(p => p.top > -1e6)) return;
        const lo = Math.min(...S.map(p => p.top)), hi = Math.max(...S.map(p => p.top));
        if (hi - lo > (it.r ? 0.5 + 0.4 * it.r.r : 0.8)) { drop(it); return; }
        if (it.r) { it.r.y = c.top; return; }
        const dy = c.top - 0.1 - it.q.t.p[1]; it.q.t.p[1] += dy; it.q.c.p[1] += dy;
      });
      if (gone.size) [crowns, trunks, rocks].forEach(A => { let k = 0; for (let i = 0; i < A.length; i++) if (!gone.has(A[i])) A[k++] = A[i]; A.length = k; });
    }
    addSplit(TWb.mesh(K.atlasMat), { cast: false, name: 'terraceWalls' }, QUAD);
    { const m = farFields(); if (m) { K.keep(m.geometry); add(litMesh(m), { cast: false, receive: false }); } }
    // волна 6: кусты вдоль откосов террас — точки-спрайты (холм и дальние поля: 2 вызова, 0 треугольников)
    const shrubMeshes = [];
    [[SHR, 'terraceShrubs', 220, true], [SHRF, 'terraceShrubsFar', 60, false]].forEach(([L, nm, mx, fg]) => { const sp = L.length ? VK.shrubPoints(T, L, { name: nm, keep: K.keep, maxPx: mx, fog: fg }) : null; if (sp) { root.add(sp); shrubMeshes.push(sp); } });
    const glassMat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide }));
    const meshGlass = add(glassB.mesh(glassMat), { cast: false, receive: false, order: 4, name: 'glass' });
    const glowMat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })); glowMat.userData.dn = 'lamp'; NIGHT.mats.push(glowMat);
    const meshGlow = add(glowB.mesh(glowMat), { cast: false, name: 'indoorGlow' });
    const paneMat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })); paneMat.userData.dn = 'window'; NIGHT.mats.push(paneMat);
    add(paneB.mesh(paneMat), { cast: false, receive: false, name: 'panes' });
    const lanternMat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, color: new T.Color(0.78, 0.76, 0.72) })); NIGHT.mats.push(lanternMat);
    // плафоны — вид DayNight 'glow' (не 'lamp'): иначе второй проход dn.attach(scene) ищет лампы в сетке по скоплениям вершин и
    // вешает ореол на каждую лампочку гирлянд (шары перед фасадом в виде hotel_corner); ореолы — только в точках NIGHT.lamps
    const meshLant = add(lantB.mesh(lanternMat), { cast: false, receive: false, name: 'lanterns' }); if (meshLant) meshLant.userData.dn = 'glow';
    // ночная сетка: LED-линии корпуса с ореолом и отблески фонарей на пруду — одной сеткой сложением (DayNight её не трогает),
    // днём скрыта (рельеф LED — в общей сетке корпуса): ночью +1 вызов, днём 0
    const ledGlowMat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false })); ledGlowMat.userData.dn = 'none';
    // издалека (h5, из села) фонари ночью — цепочки тёплых точек по краю площадок, лестнице и пруду: у каждой точки
    // NIGHT.lamps — две скрещённые «звёздочки» 0,7 м (яркий центр, края гаснут) в той же ночной сетке: 0 вызовов, 8 тр. на фонарь
    { const hot = rgb('#FFC870'), z0 = [0, 0, 0], r = 0.35;
      NIGHT.lamps.forEach(([x, y, z]) => [[1, 0], [0, 1]].forEach(([ux, uz]) => { const c = [x, y, z], P = [[x + ux * r, y, z + uz * r], [x, y + r, z], [x - ux * r, y, z - uz * r], [x, y - r, z]];
        for (let k = 0; k < 4; k++) ledGlowB.tri(c, P[k], P[(k + 1) % 4], [hot, z0, z0]); })); }
    const meshLedGlow = add(ledGlowB.mesh(ledGlowMat), { cast: false, receive: false, order: 5, name: 'ledGlow' }); if (meshLedGlow) { meshLedGlow.visible = false; meshLedGlow.userData.dn = 'none'; }
    // вода: рябь — мягкие волны на канвасе
    const waterTex = (() => { const [cv, c] = K.cnv(128, 128); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(255,255,255,0.0)'; const R2 = rng(77); for (let i = 0; i < 60; i++) { const x = R2() * 128, y = R2() * 128, r = 6 + R2() * 18; c.strokeStyle = `rgba(${200 + R2() * 55 | 0},${235},${255},0.55)`; c.lineWidth = 1.5 + R2() * 2; for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0.3, 2.4); c.stroke(); } } const t = K.tex(cv, { repeat: true }); return t; })();
    let meshWater = null;
    if (waterB.n) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(waterB.P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(waterB.U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(waterB.C, 3)); g.setIndex(waterB.I); g.computeVertexNormals();
      const wm = K.keep(new T.MeshBasicMaterial({ vertexColors: true, map: waterTex, color: new T.Color(1, 1, 1) })); NIGHT.mats.push(wm); wm.userData.dn = 'glow';
      meshWater = add(new T.Mesh(K.keep(g), wm), { cast: false, name: 'water', order: 2 }); }
    // окна (общий материал села: тёплый свет ночью через K.GLOW)
    const planeG = K.keep(new T.PlaneGeometry(1, 1));
    const glazM = glaz.length ? add(litMesh(K.merged(planeG, K.glazMatV, glaz, { tiles: true })), { name: 'windows' }) : null;
    // деревья: кроны — ёлки конусами, лиственные — «облачками»; стволы
    const crownGeo = kind => { const bk = new K.Baker('vc'); if (kind === 'pine') { bk.cyl(0, 1.0, 0, 1.0, 0.0, 2.6, { seg: 7, col: [1, 1, 1] }); bk.cyl(0, 2.3, 0, 0.75, 0.0, 1.9, { seg: 7, col: [1.05, 1.05, 1.05] }); } else { return null; } return K.keep(bk.build()); };
    const blobGeo = () => { const a = new T.IcosahedronGeometry(1, 0), b = new T.IcosahedronGeometry(1, 0); a.scale(1.15, 1.05, 1.15); a.translate(0, 2.1, 0); b.scale(0.72, 0.66, 0.72); b.translate(0.5, 2.62, 0.2); const P = [], N = [], Cc = []; [[a, 1], [b, 1.07]].forEach(([g, k]) => { const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals(); const pp = ng.attributes.position, nn = ng.attributes.normal; for (let i = 0; i < pp.count; i++) { P.push(pp.getX(i), pp.getY(i), pp.getZ(i)); N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); Cc.push(k, k, k); } if (ng !== g) ng.dispose(); g.dispose(); }); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); return K.keep(g); };
    const pineC = crowns.filter(c => c.kind === 'pine'), leafC = crowns.filter(c => c.kind !== 'pine');
    const meshPine = addSplit(K.merged(crownGeo('pine'), K.instMat, pineC), { cast: true, name: 'pines' }, null);
    const meshLeaf = addSplit(K.merged(blobGeo(), K.instMat, leafC), { cast: true, name: 'crowns' }, QUAD);
    const trunkG = (() => { const g = new T.CylinderGeometry(0.09, 0.14, 1, 5, 1, true); g.translate(0, 0.5, 0); const n = g.attributes.position.count, c = new Float32Array(n * 3); const tc = C('trunk'); for (let i = 0; i < n; i++) c.set(tc, i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); return K.keep(g); })();
    addSplit(K.merged(trunkG, K.instMat, trunks), { name: 'trunks' }, null);
    const flowerG = (() => { const g = new T.OctahedronGeometry(1, 0); const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(1); g.setAttribute('color', new T.BufferAttribute(c, 3)); return K.keep(g); })();
    if (flowers.length) addSplit(K.merged(flowerG, K.instMat, flowers), { name: 'flowers' });
    const rockG = (() => { const g = new T.DodecahedronGeometry(1, 0), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setY(i, yy < 0 ? yy * 0.4 : yy); } g.computeVertexNormals(); const n = p.count, c = new Float32Array(n * 3); const rc = C('rock'); for (let i = 0; i < n; i++) c.set(mul(rc, 0.9 + 0.2 * (p.getY(i) > 0 ? 1 : 0)), i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); return K.keep(g); })();
    addSplit((K.merged(rockG, K.instMat, rocks.map(r => ({ p: [r.x, (r.y !== undefined ? r.y : hillY(r.x, r.z)) - 0.15, r.z], r: [0, r.x * 3.1, 0], s: [r.r, r.h, r.r * 0.8], c: WIN ? [1.12, 1.14, 1.16] : [1, 1, 1] })))), { name: 'rocks' }, null);
    add(signsMesh(), { cast: false, receive: false });
    // трос зиплайна (от мачты на башне до стойки у края села)
    const ZR = route();
    let cableG = null; if (V.zipline && V.zipline.cable && V.zipline.cableMesh) { cableG = V.zipline.cableMesh(T, V.zipline.cable(ZR.from, ZR.to, ZR.sag), { color: '#4E4A52' }); root.add(cableG); }
    // ролик ждёт на старте (декор; во время поездки его скрывают — он «уезжает» с героиней)
    const idleTrolley = new T.Group(); { const m1 = new T.Mesh(K.keep(new T.BoxGeometry(0.16, 0.2, 0.34)), K.tm('#D9455A')); m1.position.y = -0.06; idleTrolley.add(m1); const st = new T.Mesh(K.keep(new T.CylinderGeometry(0.012, 0.012, 0.5, 5)), K.tm('#2F3440')); st.position.y = -0.4; idleTrolley.add(st); const bar = new T.Mesh(K.keep(new T.CylinderGeometry(0.02, 0.02, 0.6, 6)), K.tm('#3E3A44')); bar.rotation.z = PI / 2; bar.position.y = -0.66; idleTrolley.add(bar);
      if (V.zipline && V.zipline.cable) { const cab = V.zipline.cable(ZR.from, ZR.to, ZR.sag), p = cab.at(ZR.u0); idleTrolley.position.set(p.x, p.y, p.z); idleTrolley.rotation.y = ZR.heading; } root.add(idleTrolley); }

    // пар (купели, баня): мягкие точки; снег — точки у камеры; огонь — скрещённые плоскости с мягким градиентом
    let puffPts = null; const puffSrc = props.puffs;
    if (puffSrc.length) { const per = 9, N = puffSrc.length * per, pos = new Float32Array(N * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      puffPts = new T.Points(K.keep(g), K.keep(new T.PointsMaterial({ map: K.puffTex, color: 0xFFFFFF, size: 1.5, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true })));
      puffPts.frustumCulled = false; puffPts.userData.ph = Array.from({ length: N }, () => R()); puffPts.userData.per = per; puffPts.name = 'steam'; root.add(puffPts); }
    let snowPts = null;
    if (WIN) { const N = HI ? 800 : 420, p = new Float32Array(N * 3), R2 = rng(3); for (let i = 0; i < N; i++) { p[i * 3] = R2() * 40 - 20; p[i * 3 + 1] = R2() * 22 - 6; p[i * 3 + 2] = R2() * 40 - 20; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); snowPts = new T.Points(K.keep(g), K.keep(new T.PointsMaterial({ map: K.snowTex, color: 0xFFFFFF, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }))); snowPts.frustumCulled = false; root.add(snowPts); }
    const fire = (() => {
      const [cv, c] = K.cnv(64, 128), g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(0.45, 'rgba(255,120,50,0.95)'); g.addColorStop(1, 'rgba(255,80,40,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(32, 2); c.quadraticCurveTo(62, 70, 52, 110); c.quadraticCurveTo(32, 128, 12, 110); c.quadraticCurveTo(2, 70, 32, 2); c.fill();
      const mat = K.keep(new T.MeshBasicMaterial({ map: K.tex(cv), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); mat.userData.dn = 'lamp';
      const grp = new T.Group(); grp.position.set(FIRE.x, -8 + 0.12, FIRE.z); grp.name = 'fire';
      const pl = K.keep(new T.PlaneGeometry(0.9, 1.4)); pl.translate(0, 0.7, 0);
      for (let i = 0; i < 3; i++) { const m = new T.Mesh(pl, mat); m.rotation.y = i * PI / 3; grp.add(m); }
      const glowSpr = new T.Sprite(K.keep(new T.SpriteMaterial({ map: K.puffTex, color: new T.Color('#FF9A5A'), transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending }))); glowSpr.scale.setScalar(4.2); glowSpr.position.y = 0.6; glowSpr.material.userData.dn = 'lamp'; grp.add(glowSpr);
      root.add(grp); NIGHT.lamps.push([FIRE.x, -8 + 0.9, FIRE.z]);
      return { grp, mat, glowSpr };
    })();
    // огоньки далёкого села ночью: тёплые точки на фасадах (дома села — из kubachi.js), видны, только когда стемнело
    const vLights = (() => {
      const KR = V.regions.kubachi; if (!village || !KR || !KR._test || !KR._test.unpackHouses) return null;
      let houses = []; try { houses = KR._test.unpackHouses(); } catch (e) { return null; }
      const R2 = rng(2027), P = [];
      houses.forEach(hh => { if (hh.y0 === undefined || hh.row < 0 || R2() > 0.55) return; const n = 1 + (R2() < 0.4 ? 1 : 0); for (let k = 0; k < n; k++) { const fx = Math.sin(hh.ry), fz = Math.cos(hh.ry), lx = Math.cos(hh.ry), lz = -Math.sin(hh.ry), u = (R2() - 0.5) * hh.w * 0.7, st = Math.floor(R2() * Math.max(1, hh.storeys)), X = hh.x + fx * (hh.d / 2 + 0.3) + lx * u, Z = hh.z + fz * (hh.d / 2 + 0.3) + lz * u, Y = hh.y0 + 1.25 + st * 2.4; const L = toLocal(X, Y, Z); P.push(L.x, L.y, L.z); } });
      if (!P.length) return null;
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      const [cv, c] = K.cnv(32, 32), gr = c.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.35, 'rgba(255,200,120,0.85)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
      const m = new T.PointsMaterial({ map: K.tex(cv), color: 0xFFFFFF, size: 2.6, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false, blending: T.AdditiveBlending }); m.userData.dn = 'lamp'; K.keep(m); K.keep(g);
      const pts = new T.Points(g, m); pts.name = 'villageLights'; pts.visible = false; pts.renderOrder = 8; root.add(pts); return pts;
    })();
    // фонтан: струйка — тонкий светлый конус
    const jet = (() => { const m = new T.Mesh(K.keep(new T.CylinderGeometry(0.04, 0.12, 1.1, 8, 1, true)), K.keep(new T.MeshBasicMaterial({ color: new T.Color('#E8F6FC'), transparent: true, opacity: 0.75, depthWrite: false }))); m.position.set(FOUNT.x, 2.4, FOUNT.z); m.name = 'jet'; root.add(m); return m; })();

    /* ---------- свет и настроение ---------- */
    const hemi = new T.HemisphereLight('#CFE0F0', '#B9A27E', 0.62), sun = new T.DirectionalLight('#FFE2BE', 0.62);
    root.add(hemi); root.add(sun); root.add(sun.target);
    const prevFog = scene.fog, prevBg = scene.background;
    scene.fog = new T.Fog('#D6E2EE', 220, 1900);
    if (HI) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; }
    let mood = null; const sunDir = new T.Vector3(-0.55, 0.62, 0.56);
    // свет «под отель»: днём солнце спереди-слева (фасад к долине — светлый), вечером — закат слева, как в селе
    const SUN_LOCAL = { day: [-0.62, 0.6, -0.5], winter: [-0.58, 0.4, -0.62], fog: [-0.45, 0.72, -0.45] };
    function relight(M) {
      if (!K.BAKED) return;
      const hs = new T.Color(M.hs), hg = new T.Color(WIN ? '#DCE3EA' : M.hg), sc = new T.Color(M.sun), d = sunDir, r0 = 0.39, r1 = 0.27;
      const lit = (nx, ny, nz, out) => { const hk = ny * 0.5 + 0.5, L = nx * d.x + ny * d.y + nz * d.z, ramp = r0 + r1 * sst(0.0, 0.18, L) + (1 - r0 - r1) * sst(0.42, 0.72, L);
        out[0] = (hg.r + (hs.r - hg.r) * hk) * M.hi + sc.r * M.si * ramp; out[1] = (hg.g + (hs.g - hg.g) * hk) * M.hi + sc.g * M.si * ramp; out[2] = (hg.b + (hs.b - hg.b) * hk) * M.hi + sc.b * M.si * ramp; return out; };
      const o3 = [0, 0, 0];
      LIT.forEach(L => { const c = L.col.array, n = L.nor.array; for (let i = 0; i < c.length; i += 3) { lit(n[i], n[i + 1], n[i + 2], o3); c[i] = L.alb[i] * o3[0]; c[i + 1] = L.alb[i + 1] * o3[1]; c[i + 2] = L.alb[i + 2] * o3[2]; } L.col.needsUpdate = true; });
    }
    function setMood(name) {
      const M = VK.MOODS[name] || VK.MOODS.day; mood = name;
      hemi.color.set(M.hs); hemi.groundColor.set(WIN ? '#DCE3EA' : M.hg); hemi.intensity = M.hi;
      sun.color.set(M.sun); sun.intensity = M.si; const dl = SUN_LOCAL[name] || dirToLocal(M.dir[0], M.dir[1], M.dir[2]); sunDir.set(dl[0], dl[1], dl[2]).normalize();
      scene.fog.color.set(M.fog);
      K.RIM.col.value.set(M.rim[0]); K.RIM.str.value = M.rim[1];
      K.GLOW.amt.value = Math.max(M.glow * 0.42, NIGHT.t * 0.9);
      if (BG.sky) { const p = BG.sky.geometry.attributes.position, c = BG.sky.geometry.attributes.color, zen = new T.Color(M.zen), hor = new T.Color(M.hor), tmp = new T.Color(), sd = sunDir.clone(), sunC = new T.Color(name === 'evening' ? '#FFE0C0' : '#FFF6EA');
        for (let i = 0; i < p.count; i++) { const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize(), t = Math.max(0, v.y); tmp.copy(hor).lerp(zen, Math.pow(t, 0.32)); if (v.y < 0) tmp.copy(hor).multiplyScalar(0.97); const k = Math.pow(Math.max(0, v.dot(sd)), 10) * (name === 'evening' ? 0.75 : 0.25); tmp.lerp(sunC, k); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
        c.needsUpdate = true; }
      [BG.cloudA, BG.cloudB].forEach((m, i) => { if (m) m.material.color.set(i ? M.cloudSh : M.cloud); });
      if (TERR.far && TERR.farBase) { const g = TERR.far.geometry, nA = g.attributes.normal, cA = g.attributes.color, base = TERR.farBase, hsC = new T.Color(M.hs), hgC = new T.Color(WIN ? '#DCE3EA' : M.hg), scC = new T.Color(M.sun), d = sunDir;
        for (let i = 0; i < nA.count; i++) { const nx = nA.getX(i), ny = nA.getY(i), nz = nA.getZ(i), hk = ny * 0.5 + 0.5, l = Math.max(0, nx * d.x + ny * d.y + nz * d.z);
          const r = (hgC.r + (hsC.r - hgC.r) * hk) * M.hi * 1.15 + scC.r * M.si * (0.32 + 0.68 * l), gg = (hgC.g + (hsC.g - hgC.g) * hk) * M.hi * 1.15 + scC.g * M.si * (0.32 + 0.68 * l), b = (hgC.b + (hsC.b - hgC.b) * hk) * M.hi * 1.15 + scC.b * M.si * (0.32 + 0.68 * l);
          cA.setXYZ(i, base[i * 3] * r, base[i * 3 + 1] * gg, base[i * 3 + 2] * b); }
        cA.needsUpdate = true; }
      if (BG.puffs) BG.puffs.userData.setMood(name, WIN);
      // волна 6: кусты террас (точки без освещения) — общий множитель света, как у запечённого рельефа
      if (shrubMeshes.length) { const hs = new T.Color(M.hs), hgC = new T.Color(WIN ? '#DCE3EA' : M.hg), sc = new T.Color(M.sun), l = clamp(0.35 + 0.65 * sunDir.y, 0, 1);
        const lc = ['r', 'g', 'b'].map(k => (hgC[k] + (hs[k] - hgC[k]) * 0.8) * M.hi * 1.15 + sc[k] * M.si * (0.32 + 0.68 * l)); shrubMeshes.forEach(sp => sp.userData.setLight(lc)); }
      scene.background = new T.Color(M.hor);
      relight(M);
    }
    setMood(opts.mood || (WIN ? 'winter' : 'day'));
    function setNight(k) {
      k = clamp(+k || 0, 0, 1); NIGHT.t = k;
      lanternMat.color.setRGB(lerp(0.78, 1.3, k), lerp(0.76, 1.18, k), lerp(0.72, 0.92, k));
      glowMat.color.setRGB(lerp(0.88, 1.25, k), lerp(0.88, 1.12, k), lerp(0.88, 0.95, k));
      paneMat.color.setRGB(lerp(1, 2.1, k), lerp(1, 1.75, k), lerp(1, 1.05, k));
      mainMats.forEach(m => m.color.setScalar(lerp(1, 0.7, k)));
      // LED и отблески — когда зажглись фонари (village.html: с фонарями k ≥ 0,65; до них в сумерках k ≤ 0,5)
      ledGlowMat.opacity = sst(0.5, 0.7, k) * 0.95; if (meshLedGlow) meshLedGlow.visible = k > 0.55;
      if (meshWater) meshWater.material.color.setRGB(lerp(1, 0.95, k), lerp(1, 1.15, k), lerp(1, 1.3, k));
      glassMat.opacity = lerp(0.4, 0.26, k);
      fire.glowSpr.material.opacity = lerp(0.45, 0.85, k); fire.glowSpr.scale.setScalar(lerp(4.2, 7.5, k));
      if (vLights) { vLights.material.opacity = sst(0.25, 0.75, k) * 0.95; vLights.visible = k > 0.25; }
      const M = VK.MOODS[mood] || VK.MOODS.day; K.GLOW.amt.value = Math.max(M.glow * 0.42, k * 0.9);
      return k;
    }

    /* ---------- ходьба, столкновения, пути ---------- */
    const COL = makeCollide(colliders.concat(camColliders.filter(() => false)), SEGS);
    const COLR = makeCollide(colliders.concat(camColliders), []);
    const walkable = (x, z) => { const p = padAt(x, z); if (!p) return false; const [cx, cz] = COL.collide(x, z, 0.05, p.y); return Math.hypot(cx - x, cz - z) < 0.02; };
    // A* по сетке 0,5 м внутри площадок (для «иди туда»)
    function path(x0, z0, x1, z1) {
      const CS = 0.5, X0 = -100, Z0 = -104, NX = 380, NZ = 290, idx = (i, j) => j * NX + i, ix = x => Math.round((x - X0) / CS), iz = z => Math.round((z - Z0) / CS);
      const s = [ix(x0), iz(z0)], g = [ix(x1), iz(z1)]; if (s[0] < 0 || s[0] >= NX || g[0] < 0 || g[0] >= NX || s[1] < 0 || s[1] >= NZ || g[1] < 0 || g[1] >= NZ) return null;
      const ok = new Map(), okAt = (i, j) => { const k = idx(i, j); if (!ok.has(k)) ok.set(k, walkable(X0 + i * CS, Z0 + j * CS)); return ok.get(k); };
      // клетка уже героини (ближе 0,3 м к препятствию) — проходима, но вчетверо дороже: путь не продевается в щель между кадкой и фонарём
      const wide = new Map(), wideAt = (i, j) => { const k = idx(i, j); if (!wide.has(k)) { const x = X0 + i * CS, z = Z0 + j * CS, [cx, cz] = COL.collide(x, z, 0.3, padAt(x, z).y); wide.set(k, Math.hypot(cx - x, cz - z) < 0.02); } return wide.get(k); };
      if (!okAt(g[0], g[1])) return null;
      // двоичная куча по f
      const H = [], push = e => { H.push(e); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; const t = H[p]; H[p] = H[i]; H[i] = t; i = p; } };
      const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; const t = H[m]; H[m] = H[i]; H[i] = t; i = m; } } return top; };
      push([0, s[0], s[1]]); const gS = new Map([[idx(s[0], s[1]), 0]]), from = new Map(); let it = 0;
      while (H.length && it++ < 80000) {
        const [, i, j] = pop(); if (i === g[0] && j === g[1]) break;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || !okAt(ni, nj)) continue; const ya = groundY(X0 + i * CS, Z0 + j * CS), yb = groundY(X0 + ni * CS, Z0 + nj * CS); if (Math.abs(ya - yb) > 0.45) continue; const c = gS.get(idx(i, j)) + Math.hypot(di, dj) * (wideAt(ni, nj) ? 1 : 4); const k = idx(ni, nj); if (!gS.has(k) || c < gS.get(k)) { gS.set(k, c); from.set(k, idx(i, j)); push([c + Math.hypot(g[0] - ni, g[1] - nj), ni, nj]); } }
      }
      const gk = idx(g[0], g[1]); if (!from.has(gk) && gk !== idx(s[0], s[1])) return null;
      const out = []; let k = gk, n = 0; while (k !== undefined && n++ < 5000) { const i = k % NX, j = Math.floor(k / NX), x = X0 + i * CS, z = Z0 + j * CS; out.unshift([x, z, groundY(x, z)]); k = from.get(k); }
      return out.filter((p, i) => i % 3 === 0 || i === out.length - 1);
    }

    /* ---------- места, выходы, камеры ---------- */
    const GOLF = makeGolf();
    const viewDir = (() => { const v = toLocal(-11.2, 12, -15.4); return v; })();   // башня села — куда смотрят виды «на село»
    {
      const R0 = ZR;
      spots.push({ id: 'hotel_view', x: -5, y: 0, z: -35.5, r: 1.5, icon: '🏞️', label: 'Смотровая: вид на село', action: 'Посидеть', seat: [-5, 0.45, -36.9], ry: PI, view: 'hotel_view' });
      spots.push({ id: 'pool_look', x: 34, y: 0, z: 4.7, r: 1.5, icon: '🏊', label: 'Бассейн за стеклом', action: 'Заглянуть в окно', view: 'pool_look' });
      spots.push({ id: 'golf_putt', x: GREEN.tee[0] - 0.7, y: -4, z: GREEN.tee[1] + 0.6, r: 1.6, icon: '⛳', label: 'Мини-гольф', action: 'Сыграть: три лунки', play: true });
      spots.push({ id: 'fire_pit', x: FIRE.x, y: -8, z: FIRE.z + 4.3, r: 1.5, icon: '🔥', label: 'Костровой круг', action: 'Посидеть у огня', seat: [FIRE.x, -8 + 0.46, FIRE.z + 3.3], ry: PI, view: 'fire_pit' });
      spots.push({ id: 'spa_look', x: -31, y: -8, z: -47.2, r: 1.6, icon: '♨️', label: 'Купели с паром', action: 'Посмотреть', view: 'spa' });
      spots.push({ id: 'sports_look', x: 40, y: -4, z: -62, r: 1.6, icon: '⚽', label: 'Падел и мини-футбол', action: 'Сыграть', view: 'sports', play: true });   // 4B (NEEDS REGION 1); у енота-тренера — выбор игры
      spots.push({ id: 'pond_look', x: -19.5, y: -8, z: POND.z + POND.rz + 1.3, r: 1.5, icon: '🦆', label: 'Пруд под холмом', action: 'Посмотреть', view: 'pond' });
      spots.push({ id: 'hotel_tower', x: TW.x + TW.rB + 0.8, y: 0, z: TW.z, r: 1.3, icon: '🏰', label: 'Башня во дворе', action: 'Подняться наверх' });
      spots.push({ id: 'zipline_start', x: R0.launch.x, y: TW.floor, z: R0.launch.z, r: 1.0, icon: '🪂', label: 'Зиплайн — в село', action: 'Пристегнуться и ехать!', level: 'top' });
      spots.push({ id: 'tower_down', x: TW.x - R0.dir.x * 0.85, y: TW.floor, z: TW.z - R0.dir.z * 0.85, r: 0.75, icon: '⬇️', label: 'Спуститься', action: 'Вниз', level: 'top' });
      const npcHop = id => { const n = npcs.find(q => q.id === id); if (n && n.hop) n.hop(); };
      const ev = (k) => { const e = EVENTS[k]; return e ? { who: e.who, text: e.text } : null; };
      const USE = {
        hotel_view: s => ({ kind: 'sit', seat: s.seat, ry: s.ry, view: 'hotel_view', activity: 'hotel_view', text: 'Через долину — село с башней. А за ним — горы в террасах.', hero: HERO.view }),
        pool_look: () => { npcHop('hotel_otter'); return { kind: 'view', view: 'pool_look', npc: 'hotel_otter', line: ev('poolLook'), text: 'Бассейн под крышей: голубая вода, а за стеклом — горы.', hero: HERO.pool }; },
        golf_putt: () => ({ kind: 'golf', golf: GOLF, tries: GOLF.maxTries, stand: GOLF.stance(GOLF.aimAngle()), view: 'golf', npc: 'hotel_raccoon', text: 'Мини-гольф: три лунки — попади мячиком в лунку!', hero: HERO.golfStart }),
        fire_pit: s => { npcHop('hotel_bear'); return { kind: 'sit', seat: s.seat, ry: s.ry, view: 'fire_pit', mood: 'evening', npc: 'hotel_bear', line: ev('fireSit'), activity: 'fire_pit', text: 'Огонь потрескивает, а вдали — огоньки села.', hero: HERO.fire }; },
        pond_look: () => ({ kind: 'view', view: 'pond', text: 'Тихий пруд под холмом: в воде — небо, а наверху — отель.', hero: 'Как спокойно!' }),
        spa_look: () => ({ kind: 'view', view: 'spa', line: ev('spaLook'), text: 'Купели парят! Внутрь бани сегодня не заходим — только любуемся.', hero: HERO.spa }),
        // у енота-тренера — не только посмотреть: «Во что сыграем?» → игра на своём корте (VILLAGE.sports, места *_court / *_play);
        // без модуля игр (стенд) — подпись text тостом
        sports_look: () => { npcHop('hotel_raccoon'); return { kind: 'sport', view: 'sports', npc: 'hotel_raccoon', line: { who: 'hotel_raccoon', text: LINES.hotel_raccoon[1].text }, title: 'Во что сыграем?', text: 'Падел — в стеклянной коробке, рядом — мини-футбол, у дорожки — мини-гольф. Мячик выдают бесплатно.',
          pick: [{ label: '⚽ Мини-футбол', spots: ['football_court', 'football_play'] }, { label: '🎾 Падел', spots: ['padel_court', 'padel_play'] }, { label: '⛳ Мини-гольф', spots: ['golf_putt', 'golf_green'] }] }; },
        hotel_tower: () => ({ kind: 'teleport', level: 'top', to: [R0.launch.x - R0.dir.x * 0.9, TW.floor, R0.launch.z - R0.dir.z * 0.9], fade: 'Наверх по лестнице…', activity: 'hotel_tower', npc: 'hotel_marmot' }),
        tower_down: () => ({ kind: 'teleport', level: 'ground', to: [TW.x + TW.rB + 0.9, 0, TW.z], fade: '' }),
        zipline_start: () => { npcHop('hotel_marmot'); return { kind: 'zipline', route: ZR, exit: { id: 'zipline', to: 'kubachi', spawn: 'zipline_landing' }, npc: 'hotel_marmot', line: ev('zipReady'), text: 'Держись крепче — и вжу-у-ух, через всю долину!', hero: HERO.zip }; },
      };
      spots.forEach(s => { s.use = (ctx = {}) => Object.assign({ id: s.id }, (USE[s.id] || (() => ({ kind: 'toast', text: s.label })))(s, ctx)); });
      // волна 6: нижняя дорога у ворот — вниз, в село (регион kubachi, from: 'hotel' — наверху дороги мимо школы, за рулём).
      // Приехала из села — у двери машины «вниз, в село» (откуда приехала), «на серпантин» — у кормы; с серпантина — как раньше:
      // у машины на парковке «на дорогу», «Вниз, в село» — у ворот с указателем
      if (opts.from === 'kubachi') {
        const cs = FROM_VILLAGE.car;
        exits.push({ id: 'toRoad', to: 'serpentine', x: cs.x - 1.6, y: 0, z: cs.z - 2.9, r: 1.4, label: 'Сесть в машину — на серпантин', icon: '🚗' });
        exits.push({ id: 'toVillage', to: 'kubachi', via: 'hotel', x: cs.x + 1.6, y: 0, z: cs.z - 2.9, r: 1.4, label: 'Сесть в машину — вниз, в село', icon: '🚗' });
      } else {
        exits.push({ id: 'toRoad', to: 'serpentine', x: PARKING.x + 1.6, y: 0, z: PARKING.z - 2.9, r: 1.8, label: 'Сесть в машину — на дорогу', icon: '🚗' });
        exits.push({ id: 'toVillage', to: 'kubachi', via: 'hotel', x: FROM_VILLAGE.exit.x, y: 0, z: FROM_VILLAGE.exit.z, r: FROM_VILLAGE.exit.r, label: 'Вниз, в село', icon: '🚗' });
      }
      exits.push({ id: 'zipline', to: 'kubachi', spawn: 'zipline_landing', via: 'zipline', x: R0.launch.x, y: TW.floor, z: R0.launch.z, r: 1.0, level: 'top', label: 'Зиплайн — в село', icon: '🪂' });
    }
    const vT = viewDir;
    const views = {
      arrival: { pos: [-175, -12, -90], target: [-40, 0, -15], fov: 40 },
      facade: { pos: [-4, 2.4, -25], target: [-2, 6.2, 22], fov: 56 },
      courtyard: { pos: [26, 13, -27], target: [-4, 0, 2], fov: 50 },
      sports: { pos: [94, 20, -30], target: [36, -6, -72], fov: 50 },
      spa: { pos: [-13.5, -3.2, -79], target: [-43, -6.4, -52], fov: 50 },
      fire_pit: { pos: [FIRE.x + 1.4, -8 + 2.35, FIRE.z + 6.2], target: [FIRE.x - 0.5, -11.5, FIRE.z - 60], fov: 52, mood: 'evening' },
      hotel_view: { pos: [-5 + 0.25, 2.75, -32.2], target: [vT.x, vT.y - 62, vT.z], fov: 34 },
      pool_look: { pos: [33.5, 1.55, 4.4], target: [36, 0.1, 18.5], fov: 56 },
      golf: { pos: [GREEN.tee[0] - 4.6, -4 + 2.7, GREEN.tee[1] + 4.9], target: [(GREEN.tee[0] + GREEN.hole[0]) / 2, -4.2, (GREEN.tee[1] + GREEN.hole[1]) / 2], fov: 52 },
      tower_top: { pos: [TW.x - ZR.dir.x * 0.9, TW.floor + 1.75, TW.z - ZR.dir.z * 0.9], target: [vT.x, vT.y - 6, vT.z], fov: 42 },
      overview: { pos: [62, 48, -150], target: [-8, -4, -12], fov: 46 },
      zip_start: { pos: [TW.x + 7, TW.floor + 3.5, TW.z - 6], target: [TW.x, TW.floor + 1.5, TW.z], fov: 50 },
      winter_overview: { pos: [86, 64, 64], target: [-12, -10, -40], fov: 50, season: 'winter' },
      village_far: { pos: [-5, 1.8, -37.0], target: [vT.x, vT.y - 14, vT.z], fov: 9 },
      // по фото: фронтон с двора (h1), угол со стороны парковки (h2), пруд и лестница снизу (h4)
      hotel_front: { pos: [-2, 4.5, -64], target: [-2, 9.5, MAIN.z0], fov: 64 },
      hotel_corner: { pos: [-38.1, 1.7, 2.2], target: [-18.8, 8.7, 16.5], fov: 50 },
      // пруд: камера за прудом, с запада от лестницы — в портрете целиком фронтон, лестница, склон с саженцами и пруд с оградой
      pond: { pos: [-27, -4.4, -106], target: [-9, 2.5, -8], fov: 56 },
    };

    /* ---------- обновление кадра ---------- */
    let tAll = 0;
    const tmpV = new T.Vector3();
    function update(dt, hero, cam) {
      dt = Math.min(0.1, dt || 0); tAll += dt; const t = tAll;
      const hx = hero ? hero.x : 0, hz = hero ? hero.z : 0, hy = hero ? (hero.y || 0) : 0;
      const cx = cam ? cam.position.x : hx, cz = cam ? cam.position.z : hz;
      npcs.forEach(n => {
        const d = Math.hypot(n.root.position.x - hx, n.root.position.z - hz), dc = Math.hypot(n.root.position.x - cx, n.root.position.z - cz);
        const vis = n.id === 'pool_swimmer' ? dc < 60 : (d < (HI ? 60 : 46) || dc < (HI ? 90 : 70)) && !(n.level === 'top' && dc > 80);
        n.root.visible = vis; if (!vis) return;
        n.outlines.forEach(o => { o.visible = dc < 20; });
        if (n.faceHero > 0) { n.faceHero -= dt; const want = Math.atan2(hx - n.root.position.x, hz - n.root.position.z); let da = want - n.root.rotation.y; da = ((da % TAU) + TAU + PI) % TAU - PI; const lim = n.seatYaw || 1.4; n.root.rotation.y += clamp(da, -lim, lim) * Math.min(1, dt * 4) * (Math.abs(da) > lim ? 0 : 1); }
        else if (n.ry0 !== undefined && n.id !== 'pool_swimmer') { let da = n.ry0 - n.root.rotation.y; da = ((da % TAU) + TAU + PI) % TAU - PI; n.root.rotation.y += da * Math.min(1, dt * 1.5); }
        if (n.id === 'pool_swimmer') { n.swim += dt * 0.11; const u = n.swim % 2, k = u < 1 ? u : 2 - u, x = lerp(POOL.px0 + 1.2, POOL.px1 - 1.2, sst(0, 1, k)); n.root.position.set(x, -0.42 + Math.sin(t * 3) * 0.03, lerp(POOL.pz0 + 1.4, POOL.pz0 + 3.2, 0.5 + 0.5 * Math.sin(n.swim * 2))); n.root.rotation.y = u < 1 ? PI / 2 : -PI / 2; n.root.rotation.z = Math.sin(t * 2.5) * 0.08; }
        n.anim(t, dt, hx, hz);
      });
      // вода, струя фонтана, огонь
      waterTex.offset.set(Math.sin(t * 0.15) * 0.3, t * 0.04);
      jet.scale.y = 1 + Math.sin(t * 7) * 0.06; jet.material.opacity = 0.6 + Math.sin(t * 11) * 0.08;
      fire.grp.children.forEach((m, i) => { if (m.isMesh) { m.scale.y = 0.85 + 0.25 * Math.abs(Math.sin(t * (6 + i * 1.7) + i)); m.scale.x = 0.9 + 0.12 * Math.sin(t * 9 + i * 2); } });
      fire.glowSpr.material.opacity = lerp(0.45, 0.85, NIGHT.t) * (0.85 + 0.15 * Math.sin(t * 13));
      // пар
      if (puffPts) { const pa = puffPts.geometry.attributes.position, ph = puffPts.userData.ph, per = puffPts.userData.per;
        puffSrc.forEach((s, si) => { for (let k = 0; k < per; k++) { const i = si * per + k, u = (ph[i] + t * s.rate * 0.18) % 1; pa.setXYZ(i, s.p[0] + Math.sin(i * 1.7 + t * 0.6) * 0.35 * u * s.big + u * 0.6, s.p[1] + u * 3.2 * s.big, s.p[2] + Math.cos(i * 2.3) * 0.35 * u * s.big); } });
        pa.needsUpdate = true; puffPts.material.opacity = 0.42 + 0.2 * (WIN ? 1 : 0) + 0.1 * NIGHT.t; if (WIN) puffPts.material.color.setRGB(0.86, 0.9, 0.95); }
      if (snowPts && cam) { const p = snowPts.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 1.2; if (y < -6) y += 22; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.2); } p.needsUpdate = true; snowPts.position.set(cam.position.x, cam.position.y, cam.position.z); }
      // небо и облака — за камерой
      if (cam) { BG.sky.position.copy(cam.position); BG.puffs.position.copy(cam.position); }
      if (BG.cloudA) { BG.cloudA.material.map.offset.x = t * 0.0012; if (BG.cloudB) BG.cloudB.material.map.offset.x = -t * 0.0008; }
      // тень на high — за героиней
      if (HI && hero) { sun.target.position.set(hx, hy, hz); sun.position.set(hx + sunDir.x * 60, hy + sunDir.y * 60, hz + sunDir.z * 60); }
      else { sun.position.set(sunDir.x * 100, sunDir.y * 100, sunDir.z * 100); }
      GOLF.tick(dt);
    }

    /* ---------- мини-гольф: паттинг на грине, 3 удара (физика шарика, бортики, лунка) ---------- */
    function makeGolf() {
      const G = GREEN, yG = -4 + 0.1, ev = [];
      const ball = new T.Mesh(K.keep(new T.SphereGeometry(0.06, 10, 8)), K.keep(new T.MeshBasicMaterial({ color: '#FFFFFF' }))); ball.position.set(G.tee[0], yG + 0.06, G.tee[1]); ball.name = 'golfBall'; root.add(ball);
      const arrowM = K.keep(new T.MeshBasicMaterial({ color: '#F2B544', transparent: true, opacity: 0.85, depthWrite: false })), arrow = new T.Group(); arrow.visible = false; root.add(arrow);
      { const sh = new T.Mesh(K.keep(new T.BoxGeometry(0.07, 0.02, 1)), arrowM); sh.position.z = 0.5; arrow.add(sh); const hd = new T.Mesh(K.keep(new T.ConeGeometry(0.16, 0.32, 3)), arrowM); hd.rotation.x = PI / 2; hd.position.z = 1.1; arrow.add(hd); arrow.userData.sh = sh; arrow.userData.hd = hd; }
      // клюшка (паттер): рукоять, стержень, голова — держат обе кисти (стойка — heroPose)
      const putter = new T.Group(); putter.visible = false; root.add(putter);
      { const sh = new T.Mesh(K.keep(new T.CylinderGeometry(0.012, 0.012, 0.86, 6)), K.tm('#B9BEC5')); sh.position.y = -0.43; putter.add(sh); const gp = new T.Mesh(K.keep(new T.CylinderGeometry(0.02, 0.018, 0.24, 6)), K.tm('#2F3440')); gp.position.y = -0.06; putter.add(gp); const hd = new T.Mesh(K.keep(new T.BoxGeometry(0.11, 0.04, 0.05)), K.tm('#3E3A44')); hd.position.set(0.035, -0.88, 0); putter.add(hd); }
      const holeAt = G.hole, HR = 0.115, DTG = 1 / 120, SLOPE = [-0.03, 0.04], FRIC = 0.95;
      // один шаг шарика: трение, лёгкий уклон грина, лунка (поймала — если медленно), отскок от бортика-эллипса
      function ballStep(st) {
        const sp = Math.hypot(st.vx, st.vz), dec = Math.min(sp, FRIC * DTG);
        if (sp > 1e-4) { st.vx -= st.vx / sp * dec; st.vz -= st.vz / sp * dec; }
        st.vx += SLOPE[0] * DTG; st.vz += SLOPE[1] * DTG; st.x += st.vx * DTG; st.z += st.vz * DTG;
        const dh = Math.hypot(st.x - holeAt[0], st.z - holeAt[1]);
        if (dh < HR) { if (sp < 1.9) return 'holed'; st.vx *= 0.985; st.vz *= 0.985; }
        const ex = (st.x - G.x) / (G.rx * 1.08), ez = (st.z - G.z) / (G.rz * 1.08), er = Math.hypot(ex, ez); let bump = false;
        if (er > 1) { const nx = ex / er / (G.rx * 1.08), nz = ez / er / (G.rz * 1.08), nl = Math.hypot(nx, nz), ux = nx / nl, uz = nz / nl, dot = st.vx * ux + st.vz * uz; if (dot > 0) { st.vx -= 1.5 * dot * ux; st.vz -= 1.5 * dot * uz; bump = true; } st.x = G.x + ex / er * G.rx * 1.08 * 0.999; st.z = G.z + ez / er * G.rz * 1.08 * 0.999; }
        if (Math.hypot(st.vx, st.vz) < 0.05) return 'stop';
        return bump ? 'bump' : null;
      }
      const v0Of = power => 0.7 + clamp(power, 0, 1) * 4.3;
      const g = { active: false, tries: 0, maxTries: 3, holed: false, rolling: false, ball, putter, arrow, swing: 0, swingT: -1, power: 0, angle: 0, res: null,
        state: () => ({ active: g.active, tries: g.tries, holed: g.holed, rolling: g.rolling, ball: [+ball.position.x.toFixed(2), +ball.position.z.toFixed(2)], hole: holeAt.slice(), dist: +Math.hypot(ball.position.x - holeAt[0], ball.position.z - holeAt[1]).toFixed(2) }),
        aimAngle: () => Math.atan2(holeAt[0] - ball.position.x, holeAt[1] - ball.position.z),
        // где встать: боком к линии удара, мяч перед носками (героиня смотрит перпендикулярно удару)
        stance(angle) { const a = angle === undefined ? g.aimAngle() : angle, sx = Math.cos(a), sz = -Math.sin(a); return { x: ball.position.x + sx * 0.5, y: -4, z: ball.position.z + sz * 0.5, ry: a - PI / 2 }; },
        start() { g.active = true; g.tries = 0; g.holed = false; g.rolling = false; g.res = null; ball.visible = true; ball.position.set(G.tee[0], yG + 0.06, G.tee[1]); g.angle = g.aimAngle(); g.aim(g.angle, 0.4); putter.visible = true; return { stand: g.stance(g.angle), view: 'golf', ball: [G.tee[0], yG, G.tee[1]], hole: [holeAt[0], yG, holeAt[1]], tries: g.maxTries }; },
        aim(angle, power) { if (!g.active || g.rolling) return; g.angle = angle; g.power = clamp(power, 0, 1); arrow.visible = true; arrow.position.set(ball.position.x, yG + 0.03, ball.position.z); arrow.rotation.y = angle; const L = 0.5 + g.power * 2.6; arrow.userData.sh.scale.z = L; arrow.userData.sh.position.z = L / 2 + 0.12; arrow.userData.hd.position.z = L + 0.25; g.swing = -g.power * 0.55; },
        shoot(angle, power) {
          return new Promise(res => {
            if (!g.active || g.rolling || g.tries >= g.maxTries || g.holed) { res(Object.assign({ ok: false }, g.state())); return; }
            if (angle !== undefined) g.aim(angle, power === undefined ? g.power : power);
            g.tries++; arrow.visible = false; g.swingT = 0; g.res = res;
            const v0 = v0Of(g.power); g.vel = [Math.sin(g.angle) * v0, Math.cos(g.angle) * v0]; g.launchIn = 0.32; g.acc = 0; ev.push({ type: 'golf', what: 'swing' });
          });
        },
        simulate(angle, power, from) { const st = { x: from ? from[0] : ball.position.x, z: from ? from[1] : ball.position.z, vx: Math.sin(angle) * v0Of(power), vz: Math.cos(angle) * v0Of(power) }; for (let i = 0; i < 120 * 30; i++) { const r = ballStep(st); if (r === 'holed') return { holed: true, x: holeAt[0], z: holeAt[1], t: i * DTG }; if (r === 'stop') break; } return { holed: false, x: +st.x.toFixed(2), z: +st.z.toFixed(2), dist: +Math.hypot(st.x - holeAt[0], st.z - holeAt[1]).toFixed(2) }; },
        // W5: «Встать» посреди замаха — мяч не покатится после выхода, обещание удара разрешится (раньше висело)
        stop() { g.active = false; arrow.visible = false; putter.visible = false; g.rolling = false; g.swingT = -1; g.launchIn = 0;
          if (g.res) { const r = g.res; g.res = null; try { r(Object.assign({ ok: false, stopped: true }, g.state ? g.state() : {})); } catch (e) { /* ok */ } }
          ball.position.set(G.tee[0], yG + 0.06, G.tee[1]); },
        tick(dt) {
          if (g.swingT >= 0) { g.swingT += dt; const u = g.swingT; g.swing = u < 0.32 ? lerp(-g.power * 0.55, 0.12, sst(0, 0.32, u)) : lerp(0.12 + g.power * 0.3, 0, sst(0.32, 1.1, u)); if (u > 1.2) g.swingT = -1; }
          if (g.launchIn > 0) { g.launchIn -= dt; if (g.launchIn <= 0) { g.rolling = true; ev.push({ type: 'golf', what: 'hit' }); } }
          if (!g.rolling) return;
          // фиксированный шаг 1/120 с — результат не зависит от частоты кадров (и совпадает с g.simulate)
          g.acc = (g.acc || 0) + dt; let n = 0;
          while (g.acc >= DTG && g.rolling && n++ < 60) { g.acc -= DTG; const st = { x: ball.position.x, z: ball.position.z, vx: g.vel[0], vz: g.vel[1] }, r = ballStep(st); ball.position.x = st.x; ball.position.z = st.z; g.vel[0] = st.vx; g.vel[1] = st.vz; ball.rotation.x += st.vz * DTG * 8; ball.rotation.z -= st.vx * DTG * 8;
            if (r === 'holed') { g.rolling = false; g.holed = true; ball.position.set(holeAt[0], yG - 0.05, holeAt[1]); ev.push({ type: 'golf', what: 'holed' }); }
            else if (r === 'stop') g.rolling = false; else if (r === 'bump') ev.push({ type: 'golf', what: 'bump' }); }
          if (!g.rolling && g.res) {
            const left = g.maxTries - g.tries, e2 = g.holed ? EVENTS.golfHoled : left > 0 ? EVENTS.golfMiss : EVENTS.golfOut, st = g.state();
            const r = g.res; g.res = null; if (!g.holed) ev.push({ type: 'golf', what: left > 0 ? 'miss' : 'out' });
            if (!g.holed && left > 0) g.aim(g.aimAngle(), 0.4);
            if (g.holed || left <= 0) { arrow.visible = false; }
            r(Object.assign({ ok: true, holed: g.holed, left, who: e2.who, text: e2.text, done: g.holed || left <= 0 }, st));
          }
        },
        // стойка «паттинг» поверх HeroAnim: корпус наклонён, руки вниз к рукоятке, маятник плеч; клюшка — в кистях
        heroPose(anim, dt, heroRoot) {
          if (!g.active || !anim || !anim.bones || !V.zipline || !V.zipline.ik) return false;
          const B = anim.bones, root = heroRoot || (B.hips && B.hips.parent && B.hips.parent.parent);
          if (B.spine) B.spine.rotation.x += 0.32; if (B.neck) B.neck.rotation.x += 0.18; if (B.head) B.head.rotation.x += 0.28;
          B.hips.updateMatrixWorld(true);
          // рукоять — перед животом, качается вдоль линии удара (боком к героине → по её оси x)
          const rootO = root || B.hips.parent;
          const q = new T.Quaternion(); rootO.getWorldQuaternion(q);
          const lat = new T.Vector3(1, 0, 0).applyQuaternion(q), fwd = new T.Vector3(0, 0, 1).applyQuaternion(q);
          const sh = new T.Vector3(); B.upperarm_L.getWorldPosition(sh); const sh2 = new T.Vector3(); B.upperarm_R.getWorldPosition(sh2); sh.add(sh2).multiplyScalar(0.5);
          const L = 0.58, a = g.swing;   // длина «маятника» плечи → рукоять; a — угол (+ к цели: цель слева от героини, т. е. +x модели)
          const grip = new T.Vector3().copy(sh).addScaledVector(new T.Vector3(0, -1, 0), L * Math.cos(a)).addScaledVector(lat, L * Math.sin(a)).addScaledVector(fwd, 0.2);
          V.zipline.ik.arm(anim, 'L', new T.Vector3().copy(grip).addScaledVector(new T.Vector3(0, 1, 0), 0.045), new T.Vector3().copy(lat).multiplyScalar(0.6).addScaledVector(fwd, -0.4), 1, 0.06);
          V.zipline.ik.arm(anim, 'R', new T.Vector3().copy(grip).addScaledVector(new T.Vector3(0, -1, 0), 0.05), new T.Vector3().copy(lat).multiplyScalar(-0.6).addScaledVector(fwd, -0.4), 1, 0.06);
          // клюшка: от рукояти вниз к мячу, в плоскости удара
          putter.position.copy(grip).addScaledVector(new T.Vector3(0, 1, 0), 0.06);
          const down = new T.Vector3(0, -1, 0).applyAxisAngle(fwd, -a * 1.0).addScaledVector(fwd, 0.18).normalize();
          putter.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), down);
          putter.rotateY(0);
          return true;
        },
        events: ev,
      };
      return g;
    }

    /* ---------- ручка региона ---------- */
    const buildMs = Math.round((window.performance || Date).now() - t0);
    let disposed = false;
    const fromVillage = opts.from === 'kubachi';   // волна 6: приехала из села по нижней дороге (выход toHotel наверху сельской дороги)
    const carSpawn = fromVillage ? { x: FROM_VILLAGE.car.x, y: 0, z: FROM_VILLAGE.car.z, ry: FROM_VILLAGE.car.ry } : { x: PARKING.x, y: 0, z: PARKING.z, ry: PARKING.ry };
    const spawn = opts.from === 'zipline' ? { x: ZR.launch.x, y: TW.floor, z: ZR.launch.z, ry: ZR.heading } : fromVillage ? { x: FROM_VILLAGE.hero.x, y: 0, z: FROM_VILLAGE.hero.z, ry: FROM_VILLAGE.hero.ry } : { x: PARKING.x + 3.4, y: 0, z: PARKING.z - 3.2, ry: PI / 2 };
    const evQueue = [];
    const handle = {
      id: 'hotel', named, season, quality, root, buildMs,
      title: 'Отель на вершине', mapLabel: 'Отель на вершине',
      spawn, carSpawn,
      colliders, camColliders,
      ground: groundY, groundInfo,
      collide: (x, z, r, y) => COL.collide(x, z, r, y),
      rayHit: (a, b) => COLR.rayHit(a, b),
      path, walkable,
      npcs, spots, exits,
      camera: { views, near: 0.1, far: 1600, fogNear: 220, fogFar: 1900 },
      lights: { hemi, sun },
      update,
      setMood, mood: () => mood,
      setClouds(on) { BG.clouds = !!on; if (BG.cloudA) BG.cloudA.visible = !!on; if (BG.cloudB) BG.cloudB.visible = !!on; },
      night: { lamps: NIGHT.lamps, glow: K.GLOW.amt, sky: BG.sky, lampSize: 1.2 },
      nightMaterials: NIGHT.mats,
      setNight,
      places: { tower: { x: TW.x, z: TW.z, floor: TW.floor, door: [TW.x + TW.rB + 0.9, 0, TW.z] }, courtyard: { x: FOUNT.x, z: FOUNT.z }, pool: POOL, green: GREEN, fire: FIRE, spa: SPA, park: carSpawn, view: { x: -5, z: -36.9 }, main: MAIN, pond: POND, road: { len: ROAD.len, end: ROAD.end },
        village: { x: FROM_VILLAGE.exit.x, z: FROM_VILLAGE.exit.z, car: FROM_VILLAGE.car, hero: FROM_VILLAGE.hero }, parking: { x: PARKING.x, z: PARKING.z, ry: PARKING.ry } },   // волна 6: приезд из села
      zipline: ZR, golf: GOLF,
      frame: { x: FR.x, y: FR.y, z: FR.z, ry: FR.ry, toMacro, toLocal },
      village, landing, pivot, idleTrolley,
      road: { len: ROAD.len, points: () => { const o = []; for (let i = 0; i < ROAD.N; i++) o.push({ x: ROAD.x[i], y: ROAD.y[i], z: ROAD.z[i] }); return o; } },
      pollEvents() { const e = evQueue.splice(0); e.push(...GOLF.events.splice(0)); return e; },
      linesFor: () => linesFor(named), events: EVENTS, heroLines: HERO,
      stats: () => ({ colliders: colliders.length, edges: SEGS.length, npcs: npcs.length, terraces: nBands, terracesFar: nFar, mainTris, stacks: nStacks, shrubs: nShrubs, trees: crowns.length, rocks: rocks.length, windows: glaz.length, village: village ? village.userData : null, buildMs }),
      dispose() {
        if (disposed) return; disposed = true;
        if (village && village.userData && village.userData.dispose) { try { village.userData.dispose(); } catch (e) { /* ok */ } }
        if (landing && landing.dispose) { try { landing.dispose(); } catch (e) { /* ok */ } }
        if (serpRib && serpRib.userData && serpRib.userData.dispose) { try { serpRib.userData.dispose(); } catch (e) { /* ok */ } }
        if (cableG && cableG.userData.dispose) cableG.userData.dispose();
        scene.remove(root); scene.fog = prevFog; scene.background = prevBg;
        root.traverse(o => { if (o.geometry) { try { o.geometry.dispose(); } catch (e) { /* ok */ } } });
        K.dispose();
      },
    };
    return handle;
  }

  /* =====================================================================
     4. ОТЕЛЬ ИЗДАЛЕКА (для села): холм (полосы террас) и постройки (корпус по фото, бассейн, баня, коттеджи, пруд, лестница, башня),
        трос — макро-оси, 2 сетки
     ===================================================================== */
  function distant(THREE, season, o = {}) {
    const T = THREE || window.THREE, VK = V.vkit, rgb = VK.rgb, mix = VK.mix, WIN = season === 'winter';
    // две сетки: холм (полосы террас — шейдером) и постройки (без полос: стены и кровли читаются цветом)
    const mk = () => { const B = { P: [], C: [], I: [], n: 0 };
      B.put = (p, c) => { const m = toMacro(p[0], p[1], p[2]); B.P.push(m.x, m.y, m.z); B.C.push(c[0], c[1], c[2]); return B.n++; };
      B.quad = (a, b, c, d, col) => { const i0 = B.put(a, col); B.put(b, col); B.put(c, col); B.put(d, col); B.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
      B.tri = (a, b, c, col) => { const i0 = B.put(a, col); B.put(b, col); B.put(c, col); B.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 1); };
      B.box = (x0, x1, y0, y1, z0, z1, col, top) => { B.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col); B.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col); B.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], VK.mul(col, 0.9)); B.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], VK.mul(col, 0.9)); B.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top || col); };
      B.prismZ = (x0, x1, z0, z1, y0, y1, col, wall) => { const xm = (x0 + x1) / 2; B.quad([x0, y0, z1], [x0, y0, z0], [xm, y1, z0], [xm, y1, z1], VK.mul(col, 0.9)); B.quad([x1, y0, z0], [x1, y0, z1], [xm, y1, z1], [xm, y1, z0], col); if (wall) { B.tri([x0, y0, z0], [x1, y0, z0], [xm, y1, z0], wall); B.tri([x1, y0, z1], [x0, y0, z1], [xm, y1, z1], wall); } };
      B.geo = () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(B.P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(B.C, 3)); g.setIndex(B.I); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };
      return B; };
    const H = mk(), Bd = mk();
    // холм: полярная сетка (те же площадки и профиль, что в регионе), снаружи — опускается под естественный склон
    // (смотровая на консоли — не площадка: центр сетки на склоне под ней, без светлого клина плитки на вершине)
    const rings = [0, 10, 20, 40, 60, 80, 100, 125, 150, 180, 210], NA = 48;
    for (let i = 0; i < rings.length; i++) for (let j = 0; j <= NA; j++) { const a = j / NA * TAU, x = HC.x + Math.sin(a) * rings[i], z = HC.z + Math.cos(a) * rings[i]; const p0 = padAt(x, z), p = p0 && !p0.float ? p0 : null; const y = p ? p.y : Math.max(hillRaw(x, z), natLocal(x, z)) - (i === rings.length - 1 ? 8 : 0); const c = WIN ? rgb('#EEF2F6') : p ? (p.id === 'mid' || p.id === 'low' ? rgb('#93A65A') : rgb('#D9D0BE')) : mix(rgb(VK.TPAL.bg[0]), rgb(VK.TPAL.bg[1]), 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05)); H.put([x, y, z], c); }   // волна 6: зелёный холм (полосы террас — шейдером)
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; H.I.push(a, b, a + 1, a + 1, b, b + 1); }
    // корпус по фото (чертёж v2): сливочный объём 39,7 × 21 × 12, низкий бледно-розовый фронтон 20° к двору (конёк вдоль z, свесы
    // MROOF), терракотовые кромки, 4 трубы; LED-линии («домик» и 4 вертикали) — своей сеткой Ld: днём в цвет корпуса, ночью
    // DayNight села теплит её как окна ('window') — золотой контур виден через долину (h5)
    const M = MAIN, cxm = (M.x0 + M.x1) / 2, HW = (M.x1 - M.x0) / 2, KP = (M.apex - M.eave) / HW, yR = M.apex + MROOF.th, xE = HW + MROOF.ov, yE = yR - KP * xE;
    const W = WIN ? rgb('#F6F0E4') : rgb('#F2E6CF'), roofC = WIN ? rgb('#F4F7FA') : rgb('#E2B3A9'), fasc = rgb('#CF6249');
    Bd.box(M.x0, M.x1, 0, M.eave, M.z0, M.z1, W, W);
    [M.z0, M.z1].forEach(z => Bd.tri([M.x0, M.eave, z], [M.x1, M.eave, z], [cxm, M.apex, z], W));
    { const za = M.z0 - MROOF.og, zz = M.z1 + MROOF.og; Bd.prismZ(cxm - xE, cxm + xE, za, zz, yE, yR, roofC);
      // терракотовые доски по скатам фронтонов и карнизам
      [za, zz].forEach(z => [-1, 1].forEach(sx => Bd.quad([cxm + sx * xE, yE - 0.45, z], [cxm, yR - 0.45, z], [cxm, yR + 0.05, z], [cxm + sx * xE, yE + 0.05, z], fasc)));
      [-1, 1].forEach(sx => Bd.quad([cxm + sx * xE, yE - 0.45, za], [cxm + sx * xE, yE - 0.45, zz], [cxm + sx * xE, yE + 0.05, zz], [cxm + sx * xE, yE + 0.05, za], fasc));
      MROOF.chim.forEach(([X, dz, w, hh]) => { const x = cxm - X, z = M.z0 + dz, ys = yR - KP * (Math.abs(X) - w / 2); Bd.box(x - w / 2, x + w / 2, ys - 0.6, ys + hh, z - 0.45, z + 0.45, rgb('#B07468')); }); }
    // окна фронтона (колонки чертежа v2): 2 этажа × 12 французских окон, 4 широких окна с балконами, 2 портала — тёмные
    // проёмы; несколько окон — в сетке Ld (ночью теплеют вместе с LED)
    // Ld — без света и тумана (ночью DayNight теплит её как окна), поэтому днём у LED, окон Ld и ромбиков фонарей — цвет
    // корпуса, окон и склона в дымке с села: днём не выделяются
    const Ld = mk(), ledC = WIN ? rgb('#C8CDD3') : rgb('#8C8F91'), winL = WIN ? rgb('#777B83') : rgb('#61676D'), winC = rgb('#4A4E58'), balC = rgb('#3F3432'), porC = rgb('#4C4A3E');
    { const zf = M.z0 - 0.05, q = (B, u, v, w, h, c) => B.quad([cxm - u + w / 2, v, zf], [cxm - u - w / 2, v, zf], [cxm - u - w / 2, v + h, zf], [cxm - u + w / 2, v + h, zf], c);
      [-1, 1].forEach(s => { [1.15, 3.5, 6.0, 8.55, 14.1, 17.9].forEach((X, i) => [4.3, 7.65].forEach((v, j) => { const lit = !((i + 2 * j + (s > 0 ? 3 : 0)) % 5); q(lit ? Ld : Bd, s * X, v, 1.6, 2.45, lit ? winL : winC); }));
        [2.3, 7.3].forEach(X => { q(Bd, s * X, 10.9, 4.2, 2.6, winC); q(Bd, s * X, 10.55, 4.3, 1.3, balC); });
        q(Bd, s * 7.1, 0.4, 4.7, 2.9, porC); }); }
    // LED-линии (шире настоящих: издалека — 1–2 пикселя)
    { const seg = (P, a, b, wd) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = -dy / L * wd / 2, py = dx / L * wd / 2, ex = dx / L * wd / 2, ey = dy / L * wd / 2;
        Ld.quad(P(a[0] - ex + px, a[1] - ey + py), P(a[0] - ex - px, a[1] - ey - py), P(b[0] + ex - px, b[1] + ey - py), P(b[0] + ex + px, b[1] + ey + py), ledC); };
      const Pf = (u, v) => [cxm - u, v, M.z0 - 0.08], Pe = (u, v) => [M.x1 + 0.08, v, M.z0 + u];
      const HOUSE = [[-4.2, 13.95], [-4.2, 15.1], [-1.3, 16.4], [-1.3, 17.7], [1.3, 17.7], [1.3, 16.4], [4.2, 15.1], [4.2, 13.95]];
      for (let i = 0; i < HOUSE.length - 1; i++) seg(Pf, HOUSE[i], HOUSE[i + 1], 0.8);
      [-16, 16].forEach(u => seg(Pf, [u, 1.1], [u, 13.0], 0.8));
      [2.2, 18.8].forEach(u => seg(Pe, [u, 1.0], [u, 11.6], 0.8)); }
    // фонари (h5): ночью из села — цепочки тёплых точек по краю двора, вдоль фото-лестницы и вокруг пруда. Ромбик 1,2 м
    // лицом к селу в сетке Ld (ночью теплеет вместе с окнами), 2 тр. на фонарь
    { const vt = toLocal(-11.2, 12, -15.4), s = STAIRS.find(q => q.id === 'st_top'), L = [];
      const rim = WIN ? rgb('#CDD4DA') : rgb('#9A9C98'); [-28, -12.9, 12, 27, 47].forEach(x => L.push([x, 3.2, -28.6, rim])); [-31.5, -24, 2, 7, 19.5, 31, 44, 51.5].forEach(x => L.push([x, 0.6, -29.35, rim]));
      for (let z = s.z0 + 1.2; z < s.z1 - 0.5; z += 3.0) { const y = lerp(s.ya, s.yb, stairK(s, (z - s.z0) / (s.z1 - s.z0))) + 0.6; L.push([s.x0 - 0.4, y, z], [s.x1 + 0.4, y, z]); }
      for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6 * TAU, c = Math.cos(t); L.push([POND.x + c * (POND.rx + 2.2), -8 + 2.12, POND.z + Math.sin(t) * (POND.rz * (1 - POND.lens * c * c) + 2.2)]); }
      const dc = WIN ? rgb('#CDD4DA') : rgb('#8EA071'), r = 0.6;
      L.forEach(([x, y, z, c]) => { const dx = vt.x - x, dz = vt.z - z, l = Math.hypot(dx, dz) || 1, ux = -dz / l * r, uz = dx / l * r; Ld.quad([x - ux, y, z - uz], [x, y + r, z], [x + ux, y, z + uz], [x, y - r, z], c || dc); }); }
    Bd.box(POOL.x0, POOL.x1, 0, POOL.h, POOL.z0, POOL.z1, WIN ? rgb('#D6E6EE') : rgb('#9CC8DC'), WIN ? rgb('#F4F7FA') : rgb('#8E9A5A'));
    Bd.box(SPA.x0, SPA.x1, -8, -8 + SPA.h, SPA.z0, SPA.z1, W, WIN ? rgb('#F4F7FA') : rgb('#8E9A5A'));
    COTT.forEach(([x, z]) => { Bd.box(x - 4, x + 4, -8, -3.6, z - 4.5, z + 4.5, WIN ? rgb('#E9E2DA') : rgb('#B07A4E'), rgb('#5E4A44')); Bd.prismZ(x - 4.5, x + 4.5, z - 5, z + 5, -3.6, 0.4, WIN ? rgb('#F4F7FA') : rgb('#5E4A44'), rgb('#9FC0D6')); });
    // пруд под холмом (тёмная вода; зимой лёд) и светлая лестница по склону
    { const yy = -8 + 0.12, c = WIN ? rgb('#E2EAF2') : rgb('#4E657A'), n = 12; for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU; const P2 = t => [POND.x + Math.cos(t) * POND.rx, yy, POND.z + Math.sin(t) * POND.rz * (1 - POND.lens * Math.cos(t) * Math.cos(t))]; Bd.tri([POND.x, yy, POND.z], P2(b), P2(a), c); } }
    { const s = STAIRS.find(q => q.id === 'st_top'), c = WIN ? rgb('#F4F6F8') : rgb('#D8D6CE'), L = s.z1 - s.z0, y = t => lerp(s.ya, s.yb, stairK(s, t)) + 0.1; [[0, s.land[0]], [s.land[0], s.land[1]], [s.land[1], 1]].forEach(([t0, t1]) => Bd.quad([s.x0, y(t0), s.z0 + L * t0], [s.x1, y(t0), s.z0 + L * t0], [s.x1, y(t1), s.z0 + L * t1], [s.x0, y(t1), s.z0 + L * t1], c)); }
    // башня-копия (12 граней) с поясом зубцов
    { const seg = 12, tc = WIN ? rgb('#E6E2DA') : rgb('#D8C29A'); for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU; Bd.quad([TW.x + Math.sin(a) * TW.rB, 0, TW.z + Math.cos(a) * TW.rB], [TW.x + Math.sin(b) * TW.rB, 0, TW.z + Math.cos(b) * TW.rB], [TW.x + Math.sin(b) * (TW.rT + 0.15), TW.floor + 0.7, TW.z + Math.cos(b) * (TW.rT + 0.15)], [TW.x + Math.sin(a) * (TW.rT + 0.15), TW.floor + 0.7, TW.z + Math.cos(a) * (TW.rT + 0.15)], VK.mul(tc, 0.92 + 0.1 * Math.cos(a)));
        if (i % 2 === 0) Bd.quad([TW.x + Math.sin(a) * (TW.rT + 0.15), TW.floor + 0.7, TW.z + Math.cos(a) * (TW.rT + 0.15)], [TW.x + Math.sin(b) * (TW.rT + 0.15), TW.floor + 0.7, TW.z + Math.cos(b) * (TW.rT + 0.15)], [TW.x + Math.sin(b) * (TW.rT + 0.15), TW.floor + 1.25, TW.z + Math.cos(b) * (TW.rT + 0.15)], [TW.x + Math.sin(a) * (TW.rT + 0.15), TW.floor + 1.25, TW.z + Math.cos(a) * (TW.rT + 0.15)], VK.mul(tc, 0.95 + 0.1 * Math.cos(a))); } }
    const gH = H.geo(), gB = Bd.geo(), gL = Ld.geo();
    const matH = new T.MeshLambertMaterial({ vertexColors: true }), matB = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
    VK.terraceStripes(matH, { THREE: T, step: 2.5, phase: 0.3, far: 1400, dark: WIN ? [0.6, 0.62, 0.64] : [0.6, 0.7, 0.5], shrub: WIN ? 0.2 : 0.5 });   // волна 6: ступени террас на холме отеля
    const grp = new T.Group(); grp.name = 'hotel:distant';
    const mesh = new T.Mesh(gH, matH); mesh.name = 'hotelDistant'; grp.add(mesh);
    const meshB = new T.Mesh(gB, matB); meshB.name = 'hotelDistantBuildings'; grp.add(meshB);
    // без тумана: ночью золотой контур и окна доходят до села тёплыми, а не персиковой дымкой
    const matL = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false }); matL.userData.dn = 'window';
    const meshL = new T.Mesh(gL, matL); meshL.name = 'hotelDistantLed'; grp.add(meshL);
    // трос — линия до площадки у села
    let cm = null; if (V.zipline && V.zipline.route) { const R = V.zipline.route('macro'); cm = V.zipline.cableMesh(T, V.zipline.cable(R.from, R.to, R.sag), { color: '#4E4A52' }); grp.add(cm); }
    grp.userData = { tris: (H.I.length + Bd.I.length + Ld.I.length) / 3, dispose() { gH.dispose(); gB.dispose(); gL.dispose(); matH.dispose(); matB.dispose(); matL.dispose(); if (cm && cm.userData.dispose) cm.userData.dispose(); } };
    return grp;
  }

  V.hotel = { LINES, SPEAKERS, EVENTS, HERO, linesFor, FRAME: FR, toMacro, toLocal, PADS, STAIRS };
  V.regions.hotel = {
    id: 'hotel', build, distant,
    title: () => 'Отель на вершине',
    data: { FRAME: FR, toMacro, toLocal, PADS, STAIRS, TOWER: TW, MAIN, POND, ground: groundY, road: () => ROAD },
  };
})();
