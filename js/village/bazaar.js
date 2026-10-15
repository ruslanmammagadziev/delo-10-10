/* =====================================================================
   БАЗАРНАЯ ПЛОЩАДЬ (волна 4): VILLAGE.bazaar — строится изнутри VILLAGE.regions.kubachi.build() (необязательный скрипт:
   без него село прежнее). Вид — по фото автора p8–p10 (plan2/kubachi_ref): мощение из округлого камня в утоптанной земле,
   арочный мост на месте ворот (в kubachi.js) с коваными воротами под аркой, кованый столб с ЧЕТЫРЬМЯ фонарями (два столба),
   старые дома из крупного жёлто-серого и зелёно-серого тёсаного камня, голубая застеклённая галерея над аркой на тёмных
   балках, провода. Три лавки, в которые можно зайти (уютные комнаты внутри домов, вид изнутри — камера views.shop_*):
     shop_craft — «Лавка мастера» (серебро с чернью, медь), медвежонок-медник;
     shop_food  — «Фрукты с нижних склонов» (яблоки, груши, виноград, тёплый хлеб), козочка-лавочница;
     shop_cloth — «Платочки» (платочки, носочки, варежки), ягнёнок с пряжей — в доме у моста, под голубой галереей.
   Покупки делает игра через js/interact.js (pay → takeFrom → eat / admire): данные лавок — spot.use() → { kind:'sheet',
   activity, shop: { id, items, seller, inside, view, door, counter, paw } } (без interact.js старый путь показывает лист).
   Раз в неделю — большой базар (день недели в источниках разный, среда или четверг: в репликах говорим «раз в неделю»,
   в игре — среда, VILLAGE.bazaar.DAY): прилавки под полосатыми навесами (фрукты, овощи, творог и сметана, мёд и сладости,
   орехи и курага, медь, серебро, носочки и платки, свистульки), ящики, тележка с тыквами и ослик (выдумка, без реплик),
   толпа зверят (одна сетка, покачиваются в шейдере). В обычные дни — три прилавка. Ночью фонари теплеют (h.setNight).

   VILLAGE.bazaar.build(ctx) → { api, views, update(dt,t,hx,hy,hz,cam), setNight(k), setBig(b), collide(x,z,r,y), rayHit?, events, dispose }
   VILLAGE.bazaar.DAY, isDay(date), makeItem(THREE, name) → { mesh, hold } (платочек, носочки, варежки, медный кувшинчик —
   для Interact.items.wrap(mesh, hold)), ITEMS.
   Ванильный JS, three r149, без сети, без фото и брендов. Координаты — макро-координаты села (см. kubachi.js).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const DAY = 3;   // среда (Date.getDay: 0 — воскресенье). Источник «полный гид» — по средам, другой очерк — по четвергам (kubachi_spec2.md §5.2)
  const isDay = d => (d || new Date()).getDay() === DAY;

  /* ---------- предметы лавок, которых нет в js/interact.js: одна сетка, цвет в вершинах ---------- */
  const ITEMS = ['scarf', 'socks', 'mittens', 'copper_jug'];
  function makeItem(T, name) {
    const P = [], C = [], I = [];
    const add = (geo, col, m) => { geo = geo.index ? geo.toNonIndexed() : geo; if (m) geo.applyMatrix4(m); const p = geo.attributes.position, n0 = P.length / 3; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); const c = typeof col === 'function' ? col(p.getX(i), p.getY(i), p.getZ(i)) : col; C.push(c.r, c.g, c.b); I.push(n0 + i); } geo.dispose(); };
    const col = h => new T.Color(h), M = (x, y, z, rx, ry, rz, s) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(...(Array.isArray(s) ? s : [s || 1, s || 1, s || 1])));
    let hold = { in: 0.02, up: 0, fwd: 0.02 };
    if (name === 'scarf') {   // свёрнутый платочек с бахромой на одном конце, узор-цветочки
      add(new T.BoxGeometry(0.16, 0.035, 0.11, 4, 1, 3), (x, y, z) => ((Math.round(x * 40) + Math.round(z * 40)) % 4 === 0 ? col('#F4E8B8') : col('#C2405B')));
      add(new T.BoxGeometry(0.16, 0.035, 0.11, 2, 1, 2), col('#9E2F47'), M(0, 0.03, 0.01, 0, 0.12, 0, 0.98));
      for (let i = 0; i < 7; i++) add(new T.BoxGeometry(0.008, 0.004, 0.03), col('#F4E8B8'), M(-0.07 + i * 0.023, 0.0, 0.07, 0, 0, 0));
      hold = { in: 0.03, up: -0.01, fwd: 0.03, rot: [0, 0, 0.2] };
    } else if (name === 'socks') {   // пара шерстяных носочков с полосками
      [-0.035, 0.035].forEach((x, k) => { add(new T.CylinderGeometry(0.03, 0.032, 0.13, 8), (px, py) => (Math.floor((py + 0.07) * 40) % 3 === 0 ? col('#F4F1EA') : col(k ? '#5E8AC8' : '#E8A03A')), M(x, 0.06, 0, 0, 0, 0)); add(new T.SphereGeometry(0.034, 8, 6), col(k ? '#5E8AC8' : '#E8A03A'), M(x, -0.005, 0.02, 0, 0, 0, [1, 0.8, 1.6])); });
      hold = { in: 0.01, up: -0.04, fwd: 0.03 };
    } else if (name === 'mittens') {   // варежки на шнурке
      [-0.045, 0.045].forEach((x, k) => { add(new T.SphereGeometry(0.045, 10, 8), (px, py) => (py > 0.03 ? col('#F4F1EA') : col('#4F8F86')), M(x, 0.03, 0, 0, 0, 0, [1, 1.35, 0.55])); add(new T.SphereGeometry(0.018, 6, 4), col('#4F8F86'), M(x + (k ? -0.04 : 0.04), 0.03, 0, 0, 0, 0)); });
      add(new T.CylinderGeometry(0.004, 0.004, 0.1, 4), col('#C2405B'), M(0, 0.1, 0, 0, 0, PI / 2));
      hold = { in: 0.02, up: -0.03, fwd: 0.02 };
    } else {   // медный кувшинчик
      const pts = [[0.0, 0], [0.035, 0.002], [0.05, 0.03], [0.047, 0.07], [0.024, 0.1], [0.018, 0.13], [0.026, 0.14]].map(([r, y]) => new T.Vector2(r, y));
      add(new T.LatheGeometry(pts, 12), (x, y) => (y > 0.09 && y < 0.1 ? col('#E8C770') : col('#C77D4F')));
      add(new T.TorusGeometry(0.03, 0.006, 5, 10, PI), col('#A9603F'), M(0.045, 0.08, 0, 0, 0, -PI / 2));
      hold = { in: 0.02, up: -0.02, fwd: 0.0 };
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new T.Mesh(g, new T.MeshToonMaterial({ vertexColors: true })); mesh.name = 'item:' + name; mesh.castShadow = true;
    return { mesh, hold };
  }

  function build(ctx) {
    const { THREE: T, K, VK, S, C, rgb, mix, mul, rng, G, named, WIN, HI, FAR, root, chunk, detail, pb, glowB, lantB, glass, railSeg, roofGeo, props, colliders, camExtra, spots, placeNpc, addMesh, litMesh, night, SQUARE, MUSEUM, ARCH, SHOPS, houses, ST, P, clamp, lerp } = ctx;
    const ACT = V.activities ? V.activities(named) : {};
    const out = { api: null, views: {}, events: [], meshes: [] };
    const sqF = new K.Frame(SQUARE.x, 0, SQUARE.z, SQUARE.ry);
    const CDY = -0.26;   // прилавки в лавках ниже на 26 см
    const inB = new K.Baker('vc');   // прилавки, полки и товар внутри лавок — отдельной сеткой: видна, только когда камера рядом с лавкой
    const qd = (bk, F, pts, col, s) => bk.quad(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), F.p(...pts[3]), col, s);
    const qdF = (bk, F, pts, col, s, dir) => bk.quadF(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), F.p(...pts[3]), col, s, dir);
    const R0 = rng(4141);
    const TONE = { Y: [1.03, 0.98, 0.86], G: [0.86, 0.94, 0.86], H: [0.95, 0.94, 0.9] };

    /* ===== 1. Старые каменные дома лавок (северная сторона площади): крупный тёсаный камень, белые рамы, лавка внизу ===== */
    function stoneHouse(o) {
      const F = new K.Frame(o.x, 0, o.z, o.ry), bk = chunk(o.x, o.z), W = o.w, D = o.d, H = o.st * ST + 0.2, tone = TONE[o.tone] || TONE.Y, Rr = rng(o.seed || 7);
      const wc = mul(tone, 1.0), foot = 0.9;
      // стены: тёсаный камень, низ темнее; бока и зад — тоже (дом стоит на гребне, видно со всех сторон)
      const walls = [[[-W / 2, -foot, D / 2], [W / 2, -foot, D / 2], [W / 2, H, D / 2], [-W / 2, H, D / 2]], [[W / 2, -foot, D / 2], [W / 2, -foot, -D / 2], [W / 2, H, -D / 2], [W / 2, H, D / 2]],
        [[W / 2, -foot, -D / 2], [-W / 2, -foot, -D / 2], [-W / 2, H, -D / 2], [W / 2, H, -D / 2]], [[-W / 2, -foot, -D / 2], [-W / 2, -foot, D / 2], [-W / 2, H, D / 2], [-W / 2, H, -D / 2]]];
      walls.forEach((pp, i) => qd(bk, F, pp, p => mul(wc, (p[1] < 0.45 ? 0.8 : 1) * (i === 0 ? 1 : 0.96)), S.ASHLAR));
      // карнизная тяга между этажами и угловые камни посветлее
      bk.box(F, 0, ST + 0.05, D / 2 + 0.04, W + 0.06, 0.14, 0.1, { col: mul(tone, 1.08), s: S.ASHLAR, skip: { nz: 1 } });
      [-1, 1].forEach(sd => { for (let y = 0.45; y < H - 0.3; y += 0.52) { const w = (Math.floor(y / 0.52) & 1) ? 0.3 : 0.48, x = sd * W / 2;
        qd(bk, F, sd > 0 ? [[x - w, y, D / 2 + 0.008], [x, y, D / 2 + 0.008], [x, y + 0.3, D / 2 + 0.008], [x - w, y + 0.3, D / 2 + 0.008]] : [[x, y, D / 2 + 0.008], [x + w, y, D / 2 + 0.008], [x + w, y + 0.3, D / 2 + 0.008], [x, y + 0.3, D / 2 + 0.008]], mul(tone, 1.12), S.ASHLAR); } });
      roofGeo(bk, F, { roof: 'hip', roofMat: o.roofMat || 'silver' }, W, D, H, Rr, { crest: true, wall: { s: S.ASHLAR, c: wc } });
      // верхний этаж: окна в белых рамах (спереди 3, по бокам по 1, сзади 2), часть светится вечером
      const nF = Math.max(2, Math.floor((W - 0.6) / 1.6));
      for (let i = 0; i < nF; i++) glass(F, -W / 2 + (i + 0.5) * W / nF, ST + 1.35, D / 2 + 0.02, 0.8, 1.1, 1, C('frameWhite'), Rr() < 0.5 ? 1 : 0);
      [-1, 1].forEach(sd => glass(F, sd * (W / 2 + 0.02), ST + 1.35, 0, 0.8, 1.1, 1, C('frameWhite'), 0, sd * PI / 2));
      for (let i = 0; i < 2; i++) glass(F, -W / 4 + i * W / 2, ST + 1.35, -D / 2 - 0.02, 0.8, 1.1, 1, C('frameWhite'), 0, PI);
      // лавка внизу: дверь (коричневая, с плакатиком), витрина, ступенька, вывеска
      const dx = o.doorX, dc = rgb(o.doorCol || '#7A5236');
      qd(bk, F, [[dx - 0.48, 0, D / 2 + 0.02], [dx + 0.48, 0, D / 2 + 0.02], [dx + 0.48, 2.05, D / 2 + 0.02], [dx - 0.48, 2.05, D / 2 + 0.02]], p => mul(dc, p[1] > 1.9 ? 0.85 : 1), S.FLAT);
      qd(bk, F, [[dx - 0.6, 2.05, D / 2 + 0.012], [dx + 0.6, 2.05, D / 2 + 0.012], [dx + 0.6, 2.25, D / 2 + 0.012], [dx - 0.6, 2.25, D / 2 + 0.012]], mul(tone, 1.15), S.ASHLAR);
      qd(pb, F, [[dx - 0.22, 1.05, D / 2 + 0.03], [dx + 0.18, 1.05, D / 2 + 0.03], [dx + 0.18, 1.6, D / 2 + 0.03], [dx - 0.22, 1.6, D / 2 + 0.03]], rgb(o.poster || '#F2C14E'));
      pb.box(F, dx - 0.02, 1.33, D / 2 + 0.035, 0.28, 0.2, 0.004, { col: rgb('#C2405B') });
      pb.box(F, dx + 0.36, 1.0, D / 2 + 0.05, 0.05, 0.05, 0.05, { col: C('gilt') });
      bk.box(F, dx, 0.06, D / 2 + 0.25, 1.25, 0.12, 0.45, { col: mul(C('tread'), 0.95), s: S.SLAB, skip: { ny: 1 } });
      const wx = o.winX; glass(F, wx, 1.45, D / 2 + 0.02, 1.3, 1.25, 0, C('frameWhite'), 1);
      bk.box(F, wx, 0.78, D / 2 + 0.08, 1.45, 0.08, 0.16, { col: mul(tone, 1.12), s: S.ASHLAR });
      props.signs.push({ text: o.sign, p: F.p(o.signX !== undefined ? o.signX : (dx + wx) / 2, 2.55, D / 2 + 0.05), ry: o.ry, h: 0.42, bg: o.signBg || '#F4EEDF', fg: o.signFg || '#5A3E2E', size: 60 });
      colliders.push({ type: 'box', x: o.x, z: o.z, w: W, d: D, ry: o.ry, y0: -1, y1: H + 0.8, id: o.id });
      return { F, W, D, H, tone };
    }

    /* ===== 2. Комната лавки внутри дома: стены изнутри (снизу синяя полоса), потолок с балками, прилавок, полки, лампа ===== */
    // F — рамка комнаты: начало — середина пола (y = 0), +z — к двери; w × d — внутри
    function shopRoom(F, w, d, kind, o = {}) {
      const ib = chunk(F.ox, F.oz), hh = 2.65, plaster = C('creamPlain'), blue = C('blue'), wood = C('wood'), woodD = C('woodD');
      // стена изнутри: низ до 1 м — синяя побелка (как во дворах, p2), выше — светлая штукатурка
      const wall = (pts, dir) => { const lo = pts.map(q => [q[0], Math.min(q[1], 1.0), q[2]]), hi = pts.map(q => [q[0], Math.max(q[1], 1.0), q[2]]);
        qdF(ib, F, lo, mul(blue, 1.02), S.WASH, dir); qdF(ib, F, hi, mul(plaster, 0.96), S.PLASTER, dir); };
      wall([[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, hh, -d / 2], [-w / 2, hh, -d / 2]], F.dir(0, 1));
      wall([[w / 2, 0, -d / 2], [w / 2, 0, d / 2], [w / 2, hh, d / 2], [w / 2, hh, -d / 2]], F.dir(-1, 0));
      wall([[-w / 2, 0, d / 2], [-w / 2, 0, -d / 2], [-w / 2, hh, -d / 2], [-w / 2, hh, d / 2]], F.dir(1, 0));
      wall([[w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, hh, d / 2], [w / 2, hh, d / 2]], F.dir(0, -1));
      qdF(ib, F, [[-w / 2, hh, -d / 2], [w / 2, hh, -d / 2], [w / 2, hh, d / 2], [-w / 2, hh, d / 2]], mul(wood, 0.92), S.FLAT, [0, -1, 0]);
      qdF(ib, F, [[-w / 2, 0.015, -d / 2], [w / 2, 0.015, -d / 2], [w / 2, 0.015, d / 2], [-w / 2, 0.015, d / 2]], mul(wood, 0.82), S.SLAB, [0, 1, 0]);
      for (let i = -1; i <= 1; i++) ib.box(F, 0, hh - 0.09, i * d / 3, w, 0.16, 0.16, { col: woodD, s: S.FLAT, skip: { py: 1 } });
      // свет из двери и витрины (изнутри — светлые проёмы)
      qd(ib, F, [[o.doorX + 0.45, 0, d / 2 - 0.01], [o.doorX - 0.45, 0, d / 2 - 0.01], [o.doorX - 0.45, 2.0, d / 2 - 0.01], [o.doorX + 0.45, 2.0, d / 2 - 0.01]], rgb('#F2E8D2'), S.FLAT);
      qd(ib, F, [[o.winX + 0.62, 0.85, d / 2 - 0.01], [o.winX - 0.62, 0.85, d / 2 - 0.01], [o.winX - 0.62, 2.05, d / 2 - 0.01], [o.winX + 0.62, 2.05, d / 2 - 0.01]], rgb('#DCEBF5'), S.FLAT);
      // прилавок и полки за ним
      const cz = -d / 2 + 0.95;
      // прилавок низкий (0,73 м): из-за него видно зверят-продавцов (они ростом ≈ 1,1 м)
      inB.box(F, 0, 0.47 + CDY / 2, cz, w - 1.1, 0.94 + CDY, 0.5, { col: wood, cols: { py: mul(wood, 1.1), pz: mul(wood, 0.9) } });
      inB.box(F, 0, 0.96 + CDY, cz + 0.02, w - 1.0, 0.05, 0.6, { col: mul(woodD, 1.1) });
      [0.75, 1.3, 1.85].forEach(y => inB.box(F, 0, y, -d / 2 + 0.17, w - 0.4, 0.04, 0.3, { col: woodD }));
      inB.box(F, 0, hh - 0.35, 0, 0.04, 0.5, 0.04, { col: rgb('#3A3A40') });
      glowB.sph(...F.p(0, hh - 0.66, 0), 0.13, 0.11, 0.13, rgb('#FFE2A8'), { seg: 8, rings: 5 });
      goods(F, kind, w, d, cz);
      return { counterY: 0.99 + CDY, cz };
    }
    // товар на полках и на прилавке
    function goods(F, kind, w, d, cz) {
      const R = rng(kind.length * 31 + 7), jug = [[0, 0], [0.07, 0.01], [0.1, 0.07], [0.09, 0.14], [0.045, 0.2], [0.032, 0.26], [0.05, 0.29]];
      const lathe = (x, y, z, prof, col, k) => { const p = F.p(x, y, z); for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; inB.cyl(p[0], p[1] + y0 * k, p[2], r0 * k, r1 * k, (y1 - y0) * k, { seg: 9, col, cap: i === prof.length - 2 }); } };
      const shelf = [0.79, 1.34, 1.89], zS = -d / 2 + 0.17;
      if (kind === 'craft') {
        shelf.forEach((y, si) => { for (let x = -w / 2 + 0.45; x < w / 2 - 0.4; x += 0.42) { if (R() < 0.5) lathe(x, y + 0.02, zS, jug, si === 1 ? C('silverWare') : C('copper'), 0.9 + R() * 0.4); else { const p = F.p(x, y + 0.13, zS - 0.08); inB.cyl(p[0], p[1], p[2], 0.11, 0.11, 0.02, { seg: 12, col: si === 2 ? C('silverWare') : mul(C('copper'), 1.05) }); } } });
        for (let i = 0; i < 3; i++) { const p = F.p(-0.6 + i * 0.6, 0.99 + CDY, cz + 0.05); inB.box(new K.Frame(p[0], p[1], p[2], F.ry + (i - 1) * 0.3), 0, 0.04, 0, 0.16, 0.08, 0.12, { col: C('silverWare'), cols: { py: C('niello') } }); }
        props.glints.push({ p: F.p(-0.6, 1.12, cz + 0.05), ph: 0.7, s: 0.22 });
      } else if (kind === 'food') {
        shelf.forEach((y, si) => { for (let x = -w / 2 + 0.5; x < w / 2 - 0.45; x += 0.55) { const p = F.p(x, y + 0.02, zS); inB.box(new K.Frame(p[0], p[1], p[2], F.ry), 0, 0.08, 0, 0.44, 0.16, 0.26, { col: C('wood') });
          const fc = ['#C83A2E', '#8DBA48', '#D9C24A', '#E8792E', '#7A3E7A'][(((Math.floor(x * 3) + si) % 5) + 5) % 5]; for (let k = 0; k < 5; k++) { const q = F.p(x - 0.16 + k * 0.08, y + 0.2, zS + (k % 2 ? 0.05 : -0.05)); inB.sph(q[0], q[1], q[2], 0.05, 0.05, 0.05, rgb(fc), { seg: 6, rings: 4 }); } } });
        for (let i = 0; i < 3; i++) { const p = F.p(-0.55 + i * 0.4, 1.05 + CDY, cz); inB.sph(p[0], p[1], p[2], 0.13, 0.08, 0.1, rgb(i === 1 ? '#D9A55A' : '#C88A44'), { seg: 8, rings: 4 }); }
      } else {
        shelf.forEach((y, si) => { for (let x = -w / 2 + 0.4; x < w / 2 - 0.35; x += 0.3) { const p = F.p(x, y + 0.06, zS); inB.box(new K.Frame(p[0], p[1], p[2], F.ry), 0, 0, 0, 0.24, 0.1, 0.22, { col: rgb(['#C2405B', '#5E8AC8', '#E8A03A', '#4F8F86', '#F4E8B8', '#9E7BB5'][(((si * 3 + Math.round(x * 10)) % 6) + 6) % 6]) }); } });
        for (let i = 0; i < 4; i++) { const p = F.p(-0.75 + i * 0.5, 1.03 + CDY, cz); inB.box(new K.Frame(p[0], p[1], p[2], F.ry + 0.1 * i), 0, 0, 0, 0.3, 0.05, 0.22, { col: rgb(['#C2405B', '#F4E8B8', '#5E8AC8', '#E8A03A'][i]) }); }
        // моток пряжи и спицы
        { const p = F.p(0.9, 1.06 + CDY, cz + 0.05); inB.sph(p[0], p[1], p[2], 0.08, 0.08, 0.08, rgb('#E06A7A'), { seg: 8, rings: 5 }); }
      }
    }

    /* ===== 3. Лавки ===== */
    const shops = {};
    const npcBuild = makeSellers(K, T);
    function addShop(id, F, w, d, o) {
      const room = shopRoom(F, w, d, id, o), A = ACT['shop_' + id] || {};
      const seller = placeNpc(o.seller, ...(() => { const p = F.p(o.sellerX || 0.25, 0, -d / 2 + 0.42); return [p[0], p[2]]; })(), F.ry, { make: npcBuild[o.seller], headY: o.headY || 1.15, talkR: 2.6, visR: 13, seatYaw: 0.6 });
      seller.paw = o.paw;
      // героиня — чуть левее прилавка, лицом к продавцу; камера — от двери по центру: видно и её, и продавца за прилавком
      const sx = o.sellerX || 0.25, hxL = -0.5, hzL = -d / 2 + 1.6, yawIn = F.ry + Math.atan2(sx - hxL, (-d / 2 + 0.42) - hzL);
      const inside = F.p(hxL, 0, hzL).concat([yawIn]), door = F.p(o.doorX, 0, d / 2 + 0.9).concat([F.ry]);
      const vp = F.p(0.15, 1.8, d / 2 - 0.25), vt = F.p(-0.08, 0.95, -d / 2 + 0.9);
      out.views['shop_' + id] = { pos: vp, target: vt, fov: 64 };
      const counter = F.p(0.55, room.counterY, room.cz + 0.05);
      const shop = { id, activity: 'shop_' + id, title: A.title, seller: seller.id, items: (A.items || []).slice(), inside, door, view: 'shop_' + id, counter, paw: o.paw, thanks: A.thanks };
      shops[id] = shop;
      const sp = { id: 'shop_' + id, x: door[0], y: 0, z: door[2], r: 1.3, icon: '🛍️', label: A.title || 'Лавка', action: 'Зайти в лавку', shop };
      sp.use = () => { if (seller.hop) seller.hop(); return { id: sp.id, kind: 'sheet', activity: 'shop_' + id, npc: seller.id, shop }; };
      spots.push(sp);
      return shop;
    }
    if (!FAR) {
      // «Лавка мастера» — к западу от «Комнаты образцов»
      { const o = SHOPS.craft, hs = stoneHouse({ id: 'shop_craft', x: o.x, z: o.z, ry: o.ry, w: o.w, d: o.d, st: o.st, tone: 'Y', doorX: -1.15, winX: 0.85, sign: 'Лавка мастера', signBg: '#2F4A5A', signFg: '#F4EEDF', poster: '#F2C14E', seed: 31 });
        addShop('craft', new K.Frame(...hs.F.p(0, 0, 0), o.ry), o.w - 0.7, o.d - 0.7, { doorX: -1.15, winX: 0.85, seller: 'bear_craft', headY: 1.2, paw: { color: '#8A5A3E', height: 0.66, meetY: 1.02 } }); }
      // «Фрукты с нижних склонов» — к востоку
      { const o = SHOPS.food, hs = stoneHouse({ id: 'shop_food', x: o.x, z: o.z, ry: o.ry, w: o.w, d: o.d, st: o.st, tone: 'G', doorX: 1.25, winX: -0.9, sign: 'Фрукты с нижних склонов', signBg: '#F4E6CC', signFg: '#5E7A3A', poster: '#8DBA48', seed: 37, roofMat: 'silverRust' });
        addShop('food', new K.Frame(...hs.F.p(0, 0, 0), o.ry), o.w - 0.7, o.d - 0.7, { doorX: 1.25, winX: -0.9, seller: 'goat_grocer', headY: 1.2, paw: { color: '#F2EEE6', height: 0.66, meetY: 1.02 } });
        // ящики с фруктами под навесом у витрины
        const F = hs.F, D = o.d; pb.box(F, -0.9, 0.3, D / 2 + 0.55, 1.6, 0.06, 0.6, { col: C('wood') }); [-1, 1].forEach(sd => pb.box(F, -0.9 + sd * 0.72, 0.15, D / 2 + 0.55, 0.06, 0.3, 0.55, { col: C('woodD') }));
        [-1.4, -0.9, -0.4].forEach((x, i) => { const p = F.p(x, 0.33, D / 2 + 0.55); pb.box(new K.Frame(p[0], p[1], p[2], o.ry), 0, 0.1, 0, 0.42, 0.2, 0.42, { col: mul(C('wood'), 1.05) }); for (let k = 0; k < 6; k++) { const q = F.p(x - 0.13 + (k % 3) * 0.13, 0.48, D / 2 + 0.47 + Math.floor(k / 3) * 0.15); pb.sph(q[0], q[1], q[2], 0.065, 0.065, 0.065, rgb(['#C83A2E', '#D9C24A', '#E8792E'][i]), { seg: 6, rings: 4 }); } });
        detail.quadF(F.p(-1.8, 2.25, D / 2), F.p(0.0, 2.25, D / 2), F.p(0.0, 1.95, D / 2 + 0.95), F.p(-1.8, 1.95, D / 2 + 0.95), C('frameBlue'), S.FLAT, [0, 1, 0]);
        detail.quadF(F.p(-1.8, 2.25, D / 2), F.p(0.0, 2.25, D / 2), F.p(0.0, 1.95, D / 2 + 0.95), F.p(-1.8, 1.95, D / 2 + 0.95), mul(C('frameBlue'), 0.8), S.FLAT, [0, -1, 0]);
        colliders.push({ type: 'box', ...(() => { const c = F.p(-0.9, 0, D / 2 + 0.55); return { x: c[0], z: c[2] }; })(), w: 1.7, d: 0.7, ry: o.ry, y0: -0.5, y1: 0.6, id: 'crates' }); }
      // «Платочки» — верх дома у моста (h009): вход с площади (задний фасад), голубая галерея над аркой
      { const h = houses.find(q => q.id === 'h009');
        if (h) {
          const HF = new K.Frame(h.x, h.y0, h.z, h.ry), W = h.w, D = h.d, yS = 2 * ST;   // уровень площади в осях дома: +4,8
          const BF = new K.Frame(...HF.p(0, yS, -D / 2), h.ry + PI);   // рамка входа: +z — на площадь
          const tone = TONE.H, bk = chunk(h.x, h.z);
          qd(bk, BF, [[-0.55 - 0.48, 0, 0.02], [-0.55 + 0.48, 0, 0.02], [-0.55 + 0.48, 2.05, 0.02], [-0.55 - 0.48, 2.05, 0.02]], rgb('#6E4A36'), S.FLAT);
          qd(pb, BF, [[-0.75, 1.05, 0.03], [-0.38, 1.05, 0.03], [-0.38, 1.6, 0.03], [-0.75, 1.6, 0.03]], rgb('#9E7BB5'));   // витрина — окно дома (houseGeo, x = +W/4 в осях входа)
          bk.box(BF, -0.55, 0.06, 0.25, 1.25, 0.12, 0.45, { col: mul(C('tread'), 0.95), s: S.SLAB, skip: { ny: 1 } });
          props.signs.push({ text: 'Платочки', p: BF.p(0.2, 2.5, 0.05), ry: h.ry + PI, h: 0.42, bg: '#F2E2EA', fg: '#9E2F47', size: 62 });
          // комната: в осях входа — середина комнаты на 2,0 м вглубь
          const rd = Math.min(4.0, D - 0.9), RF = new K.Frame(...BF.p(0, 0, -rd / 2 - 0.3), h.ry + PI);
          addShop('cloth', RF, W - 0.7, rd, { doorX: -0.55, winX: W / 4, seller: 'lamb_cloth', headY: 1.15, sellerX: 0.3, paw: { color: '#F4EEE2', height: 0.62, meetY: 1.0 } });
          // голубая застеклённая галерея на тёмных балках — над аркой (западный бок дома, p10)
          const gF = new K.Frame(...HF.p(-W / 2, yS + 2.5, 0.0), h.ry), gx0 = -1.25, gz0 = 0.25, gz1 = 2.7, gh = 2.0, fb = C('frameBlue'), bl = rgb('#7FB6E2');
          bk.box(gF, gx0 / 2, 0.45, (gz0 + gz1) / 2, -gx0, 0.9, gz1 - gz0, { col: bl, s: S.WASH, skip: { px: 1 } });
          [[gx0, (gz0 + gz1) / 2, 0]].forEach(() => { for (let i = 0; i < 3; i++) glass(gF, gx0 - 0.01, 0.9 + 0.55, gz0 + (i + 0.5) * (gz1 - gz0) / 3, (gz1 - gz0) / 3, 1.05, 2, fb, i === 1 ? 1 : 0, -PI / 2); });
          glass(gF, gx0 / 2, 1.45, gz1 + 0.01, -gx0, 1.05, 2, fb, 0, 0); glass(gF, gx0 / 2, 1.45, gz0 - 0.01, -gx0, 1.05, 2, fb, 0, PI);
          bk.box(gF, gx0 / 2, gh + 0.06, (gz0 + gz1) / 2, -gx0 + 0.25, 0.12, gz1 - gz0 + 0.25, { col: C('silver'), s: S.ROOF });
          bk.box(gF, gx0 / 2, 0.9, (gz0 + gz1) / 2, -gx0 + 0.04, 0.06, gz1 - gz0 + 0.04, { col: fb, s: S.FLAT });
          [gz0 + 0.25, (gz0 + gz1) / 2, gz1 - 0.25].forEach(zz => detail.box(gF, gx0 / 2 - 0.1, -0.12, zz, -gx0 + 0.45, 0.16, 0.14, { col: rgb('#3E3026'), s: S.FLAT }));
          { const c = gF.p(gx0 / 2, 0, (gz0 + gz1) / 2); camExtra.push({ type: 'box', x: c[0], z: c[2], w: -gx0 + 0.4, d: gz1 - gz0 + 0.4, ry: h.ry, y0: c[1] - 0.3, y1: c[1] + gh + 0.3, id: 'camBay', cam: true }); }
        } }
    }

    /* ===== 4. Мощение площади: округлые камни в утоптанной земле (своя текстура, одна сетка поверх плит) ===== */
    let cobble = null;
    if (!FAR) {
      const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), R = rng(909);
      c.fillStyle = WIN ? '#E8ECEF' : '#B7A68A'; c.fillRect(0, 0, N, N);
      for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${120 + R() * 40},${100 + R() * 30},${70 + R() * 30},0.12)`; const x = R() * N, y = R() * N; c.fillRect(x, y, 2 + R() * 5, 2 + R() * 5); }
      const tones = WIN ? ['#F3F5F7', '#E6EAEE', '#EEF1F4', '#DCE2E8'] : ['#CFC8B8', '#BDB6A6', '#D8D1C0', '#ABA496', '#C6B9A0', '#B4AE9F'];
      for (let i = 0; i < 300; i++) {
        const x = R() * N, y = R() * N, rx = 9 + R() * 13, ry = rx * (0.6 + R() * 0.35), a = R() * PI, col = tones[Math.floor(R() * tones.length)];
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
          const X = x + ox, Y = y + oy; if (X < -30 || X > N + 30 || Y < -30 || Y > N + 30) continue;
          c.fillStyle = 'rgba(70,58,44,0.28)'; c.beginPath(); c.ellipse(X + 1.5, Y + 2.5, rx + 1.5, ry + 1.5, a, 0, TAU); c.fill();
          c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, rx, ry, a, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(X - rx * 0.25, Y - ry * 0.3, rx * 0.5, ry * 0.4, a, 0, TAU); c.fill();
        }
      }
      const tex = K.tex(cv, { repeat: true }); tex.anisotropy = HI ? 4 : 2;
      const g = new T.BufferGeometry(), Pp = [], Nn = [], Uu = [], Cc = [], Ii = [], nx = 14, nz = 10, X0 = -8.7, X1 = 11.3, Z0 = -5.7, Z1 = 5.35;
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const lx = X0 + (X1 - X0) * i / nx, lz = Z0 + (Z1 - Z0) * j / nz, p = sqF.p(lx, 0, lz), y = G(p[0], p[2]) + 0.02;
        Pp.push(p[0], y, p[2]); Nn.push(0, 1, 0); Uu.push(p[0] / 3.4, p[2] / 3.4); const e = Math.min(i, nx - i, j, nz - j) === 0 ? 0.92 : 1; Cc.push(e, e, e);
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; Ii.push(a, b, a + 1, a + 1, b, b + 1); }
      g.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(Uu, 2)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); g.setIndex(Ii); g.computeBoundingSphere();
      const mat = K.BAKED ? K.keep(new T.MeshBasicMaterial({ map: tex, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })) : K.toon('#FFFFFF', { map: tex, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      cobble = new T.Mesh(K.keep(g), mat); cobble.name = 'bazaar:cobbles'; cobble.renderOrder = 1; addMesh(litMesh(cobble), { receive: true });
    }

    /* ===== 5. Кованые ворота под аркой (открыты), провода ===== */
    if (!FAR) {
      const rTop = 96.5, ph = ARCH.ph, ox = rTop * Math.sin(ph), oz = 96 - rTop * Math.cos(ph), AF = new K.Frame(ox, 0, oz, -ph);
      const zf = (96.5 - ARCH.r) + ARCH.thick / 2 + 0.05, L = 7.3, rise = 4.8, yAt = z => -(z / L) * rise, hw = 1.3, iron = rgb('#2E2C30');
      [-1, 1].forEach(sd => {
        const x = sd * (hw - 0.06), z0 = zf, z1 = zf + 1.15, yb0 = yAt(z0) + 0.1, yb1 = yAt(z1) + 0.1, Hh = 1.75;
        railSeg(AF, [x, yb0, z0], [x, yb0 + Hh, z0], 0.05, iron); railSeg(AF, [x, yb1, z1], [x, yb1 + Hh, z1], 0.05, iron);
        railSeg(AF, [x, yb0 + Hh, z0], [x, yb1 + Hh, z1], 0.04, iron); railSeg(AF, [x, yb0 + 0.12, z0], [x, yb1 + 0.12, z1], 0.035, iron); railSeg(AF, [x, yb0 + Hh * 0.55, z0], [x, yb1 + Hh * 0.55, z1], 0.03, iron);
        for (let k = 1; k < 6; k++) { const t = k / 6, zz = lerp(z0, z1, t), yb = lerp(yb0, yb1, t); railSeg(AF, [x, yb + 0.12, zz], [x, yb + Hh, zz], 0.018, iron); }
        // завитки: по два «колечка» в верхней части створки
        [0.3, 0.7].forEach(t => { const zz = lerp(z0, z1, t), yc = lerp(yb0, yb1, t) + Hh * 0.78; for (let a = 0; a < 8; a++) { const a0 = a / 8 * TAU, a1 = (a + 1) / 8 * TAU; railSeg(AF, [x, yc + Math.sin(a0) * 0.14, zz + Math.cos(a0) * 0.14], [x, yc + Math.sin(a1) * 0.14, zz + Math.cos(a1) * 0.14], 0.015, iron); } });
      });
      // провода между домами (p8, p9): чуть провисают
      const wire = (a, b, sag) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2], F0 = new K.Frame(0, 0, 0, 0); railSeg(F0, a, m, 0.018, rgb('#3A3A40')); railSeg(F0, m, b, 0.018, rgb('#3A3A40')); };
      const cr = new K.Frame(SHOPS.craft.x, 0, SHOPS.craft.z, SHOPS.craft.ry), fd = new K.Frame(SHOPS.food.x, 0, SHOPS.food.z, SHOPS.food.ry), mu = new K.Frame(MUSEUM.x, 0, MUSEUM.z, MUSEUM.ry);
      wire(cr.p(SHOPS.craft.w / 2, 4.6, SHOPS.craft.d / 2), mu.p(-MUSEUM.w / 2, 4.8, MUSEUM.d / 2), 0.35);
      wire(mu.p(MUSEUM.w / 2, 4.8, MUSEUM.d / 2), fd.p(-SHOPS.food.w / 2, 4.6, SHOPS.food.d / 2), 0.35);
      wire(fd.p(-SHOPS.food.w / 2 + 0.3, 4.4, SHOPS.food.d / 2), [20.2, 3.55, -5.6], 0.5);
    }

    /* ===== 6. Кованые столбы с четырьмя фонарями (у моста и у въезда на площадь) ===== */
    const LAMPS = [[3.45, -1.25, 0.35], [20.2, -5.6, 0.1]];
    if (!FAR) LAMPS.forEach(([x, z, ry]) => {
      const y = G(x, z), F = new K.Frame(x, y, z, ry), iron = rgb('#2E2C30'), ironH = rgb('#4A474E');
      pb.box(F, 0, 0.15, 0, 0.5, 0.3, 0.5, { col: rgb('#8E877F') }); pb.box(F, 0, 0.36, 0, 0.32, 0.12, 0.32, { col: iron });
      pb.cyl(x, y + 0.4, z, 0.1, 0.075, 3.0, { seg: 8, col: iron }); pb.cyl(x, y + 1.0, z, 0.11, 0.11, 0.08, { seg: 8, col: ironH }); pb.cyl(x, y + 2.4, z, 0.1, 0.1, 0.08, { seg: 8, col: ironH });
      pb.sph(x, y + 3.45, z, 0.1, 0.1, 0.1, ironH, { seg: 6, rings: 4 });
      for (let k = 0; k < 4; k++) {
        const a = ry + k * PI / 2 + PI / 4, AF = new K.Frame(x, y, z, a), tip = AF.p(0, 3.1, 0.62);
        railSeg(AF, [0, 3.18, 0], [0, 3.12, 0.62], 0.05, iron, pb);
        for (let s = 0; s < 6; s++) { const a0 = s / 6 * PI, a1 = (s + 1) / 6 * PI; railSeg(AF, [0, 2.9 + Math.cos(a0) * 0.16, 0.3 + Math.sin(a0) * 0.16], [0, 2.9 + Math.cos(a1) * 0.16, 0.3 + Math.sin(a1) * 0.16], 0.025, iron, pb); }
        railSeg(AF, [0, 2.72, 0.08], [0, 3.1, 0.6], 0.025, iron, pb);
        // фонарь: подставка, стекло (тёплое ночью — общий материал фонарей), крышечка-«корона»
        const LF = new K.Frame(tip[0], tip[1], tip[2], a);
        pb.box(LF, 0, 0.03, 0, 0.24, 0.05, 0.24, { col: iron });
        lantB.box(LF, 0, 0.24, 0, 0.2, 0.36, 0.2, { col: rgb('#FFE2A8') });
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => pb.box(LF, sx * 0.105, 0.24, sz * 0.105, 0.025, 0.38, 0.025, { col: iron }));
        pb.cyl(tip[0], tip[1] + 0.43, tip[2], 0.18, 0.04, 0.16, { seg: 4, col: iron, a0: a + PI / 4 }); pb.cyl(tip[0], tip[1] + 0.59, tip[2], 0.03, 0.0, 0.1, { seg: 5, col: ironH });
        night.lamps.push([tip[0], tip[1] + 0.24, tip[2]]);
      }
      colliders.push({ type: 'circle', x, z, r: 0.34, y0: y - 0.5, y1: y + 3.6, id: 'lampPost' });
    });

    /* ===== 7. Прилавки (каждый день — 3, в базарный день — ещё 7, тележка с тыквами и ослик, толпа зверят) ===== */
    const STALL_COL = [['#C2405B', '#FFF4EE'], ['#3F78B8', '#F4F1EA'], ['#4F8F86', '#F4EEDF'], ['#E8A03A', '#FFF8EE'], ['#7A5AA8', '#F6F0FA']];
    const smallB = new K.Baker('vc'), bigB = new K.Baker('vc'), dyn = [];
    function stall(bk, lx, lz, ry, kind, ci, big) {
      const p = sqF.p(lx, 0, lz), F = new K.Frame(p[0], G(p[0], p[2]), p[2], SQUARE.ry + ry), [c1, c2] = STALL_COL[ci % STALL_COL.length].map(rgb), wood = C('wood'), woodD = C('woodD');
      bk.box(F, 0, 0.82, 0, 2.0, 0.07, 0.85, { col: wood }); [[-0.92, -0.36], [0.92, -0.36], [-0.92, 0.36], [0.92, 0.36]].forEach(([x, z]) => bk.box(F, x, 0.4, z, 0.06, 0.8, 0.06, { col: woodD }));
      bk.quadF(F.p(-1.0, 0.3, 0.43), F.p(1.0, 0.3, 0.43), F.p(1.0, 0.8, 0.43), F.p(-1.0, 0.8, 0.43), c1, 0, F.dir(0, 1).length === 2 ? [F.dir(0, 1)[0], 0, F.dir(0, 1)[1]] : [0, 0, 1]);
      [[-1.08, -0.55, 2.45], [1.08, -0.55, 2.45], [-1.08, 0.72, 2.15], [1.08, 0.72, 2.15]].forEach(([x, z, h]) => bk.box(F, x, h / 2, z, 0.06, h, 0.06, { col: woodD }));
      const NS = 6; for (let i = 0; i < NS; i++) { const x0 = -1.18 + 2.36 * i / NS, x1 = -1.18 + 2.36 * (i + 1) / NS, cc = i % 2 ? c2 : c1;
        bk.quadF(F.p(x0, 2.47, -0.6), F.p(x1, 2.47, -0.6), F.p(x1, 2.17, 0.8), F.p(x0, 2.17, 0.8), cc, 0, [0, 1, 0]); bk.quadF(F.p(x0, 2.46, -0.6), F.p(x1, 2.46, -0.6), F.p(x1, 2.16, 0.8), F.p(x0, 2.16, 0.8), mul(cc, 0.85), 0, [0, -1, 0]);
        bk.tri(F.p(x0, 2.17, 0.8), F.p(x1, 2.17, 0.8), F.p((x0 + x1) / 2, 1.98, 0.84), cc, 0); bk.tri(F.p(x1, 2.17, 0.8), F.p(x0, 2.17, 0.8), F.p((x0 + x1) / 2, 1.98, 0.84), mul(cc, 0.85), 0); }
      stallGoods(bk, F, kind);
      const col = { type: 'box', x: p[0], z: p[2], w: 2.3, d: 1.5, ry: F.ry, y0: F.oy - 0.5, y1: F.oy + 2.2, id: 'stall' };
      if (big) dyn.push(col); else colliders.push(col);
      return F;
    }
    function stallGoods(bk, F, kind) {
      const R = rng(kind.length * 17 + Math.round(F.ox * 10)), sph = (x, y, z, r, c, ry2) => { const q = F.p(x, y, z); bk.sph(q[0], q[1], q[2], r, ry2 || r, r, c, { seg: 7, rings: 4 }); }, crate = (x, z, y = 0.86) => { bk.box(F, x, y + 0.08, z, 0.46, 0.16, 0.32, { col: mul(C('wood'), 1.08) }); };
      const fruitRow = (x, z, cols, y = 0.86) => { crate(x, z, y); for (let k = 0; k < 6; k++) sph(x - 0.15 + (k % 3) * 0.15, y + 0.21, z - 0.07 + Math.floor(k / 3) * 0.14, 0.065, rgb(cols[k % cols.length])); };
      switch (kind) {
        case 'fruit': fruitRow(-0.6, 0, ['#C83A2E', '#D24A36']); fruitRow(0, 0, ['#D9C24A', '#C9B23A']); fruitRow(0.6, 0, ['#E8792E', '#F08A3A']);
          [[-0.5, 0.75], [0.1, 0.8], [0.55, 0.72]].forEach(([x, z]) => sph(x, 0.2, z, 0.24, rgb('#E07A2A'), 0.18)); break;
        case 'veg': for (let k = 0; k < 5; k++) sph(-0.7 + k * 0.32, 1.0, -0.05, 0.13, rgb('#7FA84A')); for (let k = 0; k < 10; k++) sph(-0.7 + (k % 5) * 0.3, 0.92, 0.22 + Math.floor(k / 5) * 0.08, 0.06, rgb('#A0784E'), 0.045);
          for (let k = 0; k < 4; k++) { const q = F.p(0.55 + k * 0.08, 0.9, 0.25); bk.cyl(q[0], q[1], q[2], 0.03, 0.0, 0.16, { seg: 5, col: rgb('#E8792E') }); } break;
        case 'dairy': for (let k = 0; k < 6; k++) { const q = F.p(-0.7 + k * 0.25, 0.86, -0.05); bk.cyl(q[0], q[1], q[2], 0.08, 0.08, 0.18, { seg: 9, col: rgb('#F6F2EA') }); bk.cyl(q[0], q[1] + 0.18, q[2], 0.085, 0.085, 0.03, { seg: 9, col: rgb(k % 2 ? '#C2405B' : '#3F78B8') }); }
          [0.3, 0.7].forEach(x => { const q = F.p(x, 0.86, 0.22); bk.cyl(q[0], q[1], q[2], 0.17, 0.17, 0.12, { seg: 12, col: rgb('#F2DFA8') }); });
          { const q = F.p(-0.3, 0.86, 0.25); bk.cyl(q[0], q[1], q[2], 0.17, 0.2, 0.12, { seg: 10, col: rgb('#B08A5A') }); for (let k = 0; k < 5; k++) sph(-0.36 + (k % 3) * 0.06, 1.02, 0.22 + Math.floor(k / 3) * 0.07, 0.04, rgb('#F8F2E2'), 0.05); } break;
        case 'honey': for (let k = 0; k < 6; k++) { const q = F.p(-0.75 + k * 0.22, 0.86, -0.1); bk.cyl(q[0], q[1], q[2], 0.07, 0.07, 0.15, { seg: 9, col: rgb('#E0A030') }); bk.cyl(q[0], q[1] + 0.15, q[2], 0.075, 0.075, 0.03, { seg: 9, col: rgb('#F4E8C8') }); }
          for (let k = 0; k < 8; k++) bk.box(F, 0.15 + (k % 4) * 0.17, 0.9, 0.18 + Math.floor(k / 4) * 0.14, 0.12, 0.06, 0.1, { col: rgb(['#F6B2C0', '#A8D8C4', '#F2D27A', '#C9B8E8'][k % 4]) }); break;
        case 'nuts': [[-0.55, '#9A6A3E'], [0, '#E8903A'], [0.55, '#C8A060']].forEach(([x, c]) => { const q = F.p(x, 0.86, 0); bk.cyl(q[0], q[1], q[2], 0.22, 0.16, 0.08, { seg: 10, col: rgb('#B08A5A') }); for (let k = 0; k < 9; k++) sph(x - 0.12 + (k % 3) * 0.12, 0.97, -0.12 + Math.floor(k / 3) * 0.12, 0.045, rgb(c)); }); break;
        case 'copper': [-0.6, -0.15, 0.3, 0.7].forEach((x, i) => { const q = F.p(x, 0.86, 0); const prof = i % 2 ? [[0, 0], [0.09, 0.01], [0.12, 0.08], [0.11, 0.17], [0.06, 0.24], [0.045, 0.31], [0.065, 0.34]] : [[0, 0], [0.16, 0.01], [0.18, 0.06], [0.17, 0.12], [0.18, 0.13]]; for (let k = 0; k < prof.length - 1; k++) bk.cyl(q[0], q[1] + prof[k][1], q[2], prof[k][0], prof[k + 1][0], prof[k + 1][1] - prof[k][1], { seg: 10, col: mul(C('copper'), 1 + (k % 2) * 0.08), cap: k === prof.length - 2 }); }); break;
        case 'silver': for (let k = 0; k < 7; k++) { const q = F.p(-0.75 + k * 0.25, 0.86, (k % 2) * 0.15 - 0.05); bk.cyl(q[0], q[1], q[2], 0.07, 0.05, 0.08 + (k % 3) * 0.04, { seg: 9, col: C('silverWare') }); } break;
        case 'cloth': { bk.box(F, 0, 1.9, -0.35, 2.0, 0.04, 0.04, { col: C('woodD') }); for (let k = 0; k < 6; k++) { const x0 = -0.9 + k * 0.32; bk.quadF(F.p(x0, 1.88, -0.33), F.p(x0 + 0.26, 1.88, -0.33), F.p(x0 + 0.26, 1.15, -0.33), F.p(x0, 1.15, -0.33), rgb(['#C2405B', '#F4E8B8', '#5E8AC8', '#E8A03A', '#4F8F86', '#9E7BB5'][k]), 0, [F.dir(0, 1)[0], 0, F.dir(0, 1)[1]]); }
          for (let k = 0; k < 6; k++) bk.box(F, -0.7 + k * 0.28, 0.9, 0.12, 0.2, 0.07, 0.24, { col: rgb(['#E8A03A', '#5E8AC8', '#F4F1EA', '#C2405B', '#4F8F86', '#E8A03A'][k]) }); break; }
        default: for (let k = 0; k < 6; k++) sph(-0.6 + k * 0.24, 0.95, 0, 0.08, rgb(['#C2405B', '#3F78B8', '#E8A03A', '#4F8F86', '#F2D27A', '#9E7BB5'][k]));   // свистульки и мячики
      }
      // ящики перед прилавком
      if (kind === 'fruit' || kind === 'veg' || kind === 'nuts') { bk.box(F, -0.55, 0.15, 0.78, 0.48, 0.3, 0.36, { col: C('wood') }); bk.box(F, 0.55, 0.15, 0.8, 0.48, 0.3, 0.36, { col: mul(C('wood'), 0.9) }); }
    }
    // раскладка в осях площади (16 × 11): проходы к «Комнате образцов», лавкам, мосту и к въезду остаются свободными
    const SMALL = [[-4.7, -2.4, 0, 'fruit', 0], [5.9, 2.7, PI, 'nuts', 3], [7.6, -2.4, 0, 'copper', 2]];
    // волна 4 (интегратор): второй овощной прилавок (−6.4, −0.2) стоял прямо перед окном пекарни — в базарный день камера у пекарни
    // смотрела сквозь его навес (полэкрана ткани); убран, вход в пекарню свободен
    const BIG = [[-1.7, -2.4, 0, 'veg', 2], [4.7, -2.4, 0, 'dairy', 1], [-3.3, 2.7, PI, 'honey', 3], [-0.3, 2.7, PI, 'cloth', 4], [2.8, 2.7, PI, 'silver', 1], [9.6, 0.4, -PI / 2, 'toys', 0]];
    const stallsInfo = [];
    if (!FAR) {
      SMALL.forEach(([lx, lz, ry, k, c]) => { stall(smallB, lx, lz, ry, k, c, false); stallsInfo.push({ kind: k, big: false, at: sqF.p(lx, 0, lz) }); });
      BIG.forEach(([lx, lz, ry, k, c]) => { stall(bigB, lx, lz, ry, k, c, true); stallsInfo.push({ kind: k, big: true, at: sqF.p(lx, 0, lz) }); });
      // тележка с тыквами и ослик (выдумка — без реплик)
      { const p = sqF.p(6.9, 0, 4.7), F = new K.Frame(p[0], G(p[0], p[2]), p[2], SQUARE.ry + 0.35), wd = C('wood');
        bigB.box(F, 0, 0.62, 0, 1.3, 0.1, 0.9, { col: wd }); [[0, 0.75, 0.45], [0, 0.75, -0.45]].forEach(([x, y, z]) => bigB.box(F, x, y, z, 1.3, 0.25, 0.05, { col: mul(wd, 0.9) }));
        [-1, 1].forEach(sd => { const q = F.p(0, 0.38, sd * 0.5); bigB.sph(q[0], q[1], q[2], 0.36, 0.36, 0.06, C('woodD'), { seg: 10, rings: 4 }); });
        bigB.box(F, 1.15, 0.6, 0.2, 1.1, 0.05, 0.05, { col: wd }); bigB.box(F, 1.15, 0.6, -0.2, 1.1, 0.05, 0.05, { col: wd });
        for (let k = 0; k < 6; k++) { const q = F.p(-0.4 + (k % 3) * 0.4, 0.86, -0.2 + Math.floor(k / 3) * 0.4); bigB.sph(q[0], q[1], q[2], 0.2, 0.15, 0.2, rgb(k % 2 ? '#E07A2A' : '#D9862E'), { seg: 8, rings: 4 }); }
        dyn.push({ type: 'box', x: p[0], z: p[2], w: 2.8, d: 1.2, ry: F.ry, y0: F.oy - 0.5, y1: F.oy + 1.5, id: 'cart' }); }
    }
    let smallM = null, bigM = null;

    /* ===== 8. Толпа зверят на базаре (одна сетка; покачиваются в шейдере) и белочка у орехов (живая, говорит) ===== */
    let crowd = null; const crowdT = { value: 0 };
    if (!FAR) {
      const bkC = new K.Baker('vc'), ranges = [], R = rng(77);
      const KINDS = [['#EDE4DA', '#F7B9C4', 'hare'], ['#B89474', '#F2DCC4', 'hedge'], ['#D9783A', '#F4EEE2', 'fox'], ['#8A5A3E', '#C9A27A', 'bear'], ['#F2EEE6', '#E8DCCB', 'goat'], ['#B9AFA8', '#F2B8C2', 'mouse'], ['#8E8A86', '#F2EEE8', 'badger'], ['#A7A9B0', '#F4F2EE', 'cat'], ['#9C8A7A', '#E8DED8', 'donkey']];
      const ACC = ['#C2405B', '#3F78B8', '#4F8F86', '#E8A03A', '#9E7BB5', '#F2D27A'];
      const fig = (x, z, ry, s, kind, acc, role, bkx) => {
        const bk = bkx || bkC, n0 = bk.n, y = G(x, z), F = new K.Frame(x, y, z, ry), [bc, lc, kk] = kind, sp = (lx, ly, lz, rx, ryy, rz, c) => { const q = F.p(lx * s, ly * s, lz * s); const m = Math.max(rx, ryy, rz) * s; bk.sph(q[0], q[1], q[2], rx * s, ryy * s, rz * s, c, m < 0.07 ? { seg: HI ? 5 : 4, rings: 3 } : m < 0.16 ? { seg: HI ? 6 : 5, rings: HI ? 4 : 3 } : { seg: HI ? 8 : 7, rings: HI ? 5 : 4 }); };   // 4B: на low — на грань меньше   // мелочь (глазки, носики, ушки) — меньше граней
        const B = rgb(bc), L = rgb(lc), A = rgb(acc), INK = rgb('#2E2A3B');
        if (kk === 'donkey') { sp(0, 0.62, 0, 0.24, 0.24, 0.45, B); sp(0, 0.98, 0.45, 0.15, 0.17, 0.2, B); sp(0, 0.92, 0.62, 0.1, 0.08, 0.09, L); [-1, 1].forEach(sd => { sp(sd * 0.07, 1.28, 0.4, 0.04, 0.16, 0.035, B); sp(sd * 0.07, 1.02, 0.6, 0.022, 0.022, 0.022, INK); }); [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]].forEach(([lx, lz]) => { const q = F.p(lx * s, 0, lz * s); bk.cyl(q[0], q[1], q[2], 0.05 * s, 0.05 * s, 0.42 * s, { seg: 6, col: B }); }); if (bk === bkC) ranges.push([n0, bk.n, R() * 6]); return; }
        sp(0, 0.42, 0, 0.24, 0.3, 0.22, B); sp(0, 0.38, 0.12, 0.14, 0.17, 0.11, L);
        [-1, 1].forEach(sd => sp(sd * 0.1, 0.07, 0.05, 0.08, 0.06, 0.11, mul(B, 0.85)));
        sp(0, 0.86, 0.02, 0.21, 0.2, 0.2, kk === 'hedge' || kk === 'badger' ? L : B);
        if (kk === 'hare') [-1, 1].forEach(sd => sp(sd * 0.08, 1.16, -0.03, 0.05, 0.17, 0.035, B));
        else if (kk === 'bear' || kk === 'mouse') [-1, 1].forEach(sd => sp(sd * 0.15, 1.02, -0.02, kk === 'mouse' ? 0.09 : 0.06, kk === 'mouse' ? 0.09 : 0.06, 0.03, B));
        else if (kk === 'fox' || kk === 'cat') [-1, 1].forEach(sd => { const q = F.p(sd * 0.1 * s, 1.0 * s, -0.01 * s); bk.cyl(q[0], q[1], q[2], 0.05 * s, 0.0, 0.12 * s, { seg: 5, col: B }); });
        else if (kk === 'goat') { [-1, 1].forEach(sd => { const q = F.p(sd * 0.08 * s, 1.0 * s, -0.04 * s); bk.cyl(q[0], q[1], q[2], 0.025 * s, 0.0, 0.12 * s, { seg: 5, col: rgb('#D8C8A8') }); sp(sd * 0.2, 0.86, -0.02, 0.08, 0.035, 0.04, B); }); }
        else if (kk === 'hedge') for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; const q = F.p(Math.sin(a) * 0.19 * s, (0.5 + (i % 3) * 0.12) * s, -0.14 * s); bk.cyl(q[0], q[1], q[2], 0.05 * s, 0.0, 0.15 * s, { seg: 4, col: rgb('#8E6E58') }); }
        else if (kk === 'badger') sp(0, 0.9, 0.12, 0.05, 0.12, 0.08, rgb('#4A4442'));
        [-1, 1].forEach(sd => sp(sd * 0.075, 0.9, 0.18, 0.028, 0.034, 0.02, INK));
        sp(0, 0.83, 0.2, 0.03, 0.022, 0.02, rgb(kk === 'cat' || kk === 'hare' || kk === 'mouse' ? '#E8798F' : '#3A2E3F'));
        if (role === 'seller') sp(0, 0.36, 0.17, 0.2, 0.2, 0.05, A);   // фартук
        else if (R() < 0.6) { const q = F.p(0.25 * s, 0.32 * s, 0.05 * s); bk.cyl(q[0], q[1], q[2], 0.1 * s, 0.12 * s, 0.14 * s, { seg: 8, col: rgb('#B08A5A') }); sp(0.25, 0.48, 0.05, 0.07, 0.05, 0.07, rgb(['#C83A2E', '#D9C24A', '#E8792E', '#8DBA48'][Math.floor(R() * 4)])); }
        else sp(0, 0.66, 0.02, 0.2, 0.06, 0.19, A);   // шарфик
        if (bk === bkC) ranges.push([n0, bk.n, R() * 6]);
      };
      // продавцы за большими прилавками и покупатели в проходах
      BIG.forEach(([lx, lz, ry], i) => { const d = 0.75, p = sqF.p(lx - Math.sin(ry) * d, 0, lz - Math.cos(ry) * d); fig(p[0], p[2], SQUARE.ry + ry, 1.0 + (i % 3) * 0.06, KINDS[(i * 4 + 1) % (KINDS.length - 1)], ACC[i % ACC.length], 'seller'); });
      // продавцы обычных дней (фрукты, медь) — неподвижные, в сетке прилавков
      [SMALL[0], SMALL[2]].forEach(([lx, lz, ry], i) => { const d = 0.75, p = sqF.p(lx - Math.sin(ry) * d, 0, lz - Math.cos(ry) * d); fig(p[0], p[2], SQUARE.ry + ry, 1.04, KINDS[i ? 4 : 1], ACC[i ? 3 : 2], 'seller', smallB); });
      const SHOP = [[-4.4, -0.9, PI], [-2.0, -0.7, PI + 0.4], [1.0, -0.4, PI - 0.3], [4.4, -0.8, PI], [7.2, -0.9, PI + 0.2], [-3.0, 1.2, 0.2], [0.4, 1.0, -0.3], [3.1, 1.3, 0], [5.6, 1.1, 0.3], [-6.0, 1.6, 0.9], [8.6, -0.4, -1.2], [1.8, -1.6, 2.6], [6.2, -3.8, -1.4], [10.4, 2.1, -2.2]];   // 14 покупателей (low-бюджет)
      SHOP.forEach(([lx, lz, ry], i) => { const p = sqF.p(lx, 0, lz); fig(p[0], p[2], SQUARE.ry + ry, 0.88 + R() * 0.28, KINDS[(i * 3 + 2) % (KINDS.length - 1)], ACC[(i + 2) % ACC.length], 'shopper'); });
      { const p = sqF.p(8.3, 0, 4.4); fig(p[0], p[2], SQUARE.ry + 0.35 + PI / 2, 1.05, KINDS[KINDS.length - 1], ACC[0], 'donkey'); }
      const g = bkC.build();
      if (g) {
        const ab = new Float32Array(g.attributes.position.count * 2); ranges.forEach(([a, b, ph]) => { for (let i = a; i < b; i++) { ab[i * 2] = ph; ab[i * 2 + 1] = 1; } }); g.setAttribute('aBob', new T.BufferAttribute(ab, 2));
        const mat = K.BAKED ? K.keep(new T.MeshBasicMaterial({ vertexColors: true })) : K.toon('#FFFFFF', { vertexColors: true });
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (sh, rr) => { if (prev) prev(sh, rr); sh.uniforms.uBobT = crowdT; sh.vertexShader = 'attribute vec2 aBob;\nuniform float uBobT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat bobK = max(0.0, sin(uBobT * 2.4 + aBob.x));\ntransformed.y += bobK * bobK * 0.045 * aBob.y;'); };
        mat.customProgramCacheKey = () => 'bazaarCrowd' + (K.BAKED ? 'b' : 't');
        crowd = new T.Mesh(g, mat); crowd.name = 'bazaar:crowd'; crowd.userData.dn = 'actor'; addMesh(litMesh(crowd), { cast: false });
      }
      // белочка с орехами — у прилавка с орехами и курагой (каждый день; говорит)
      { const [lx, lz, ry] = SMALL[1], d = 0.72, p = sqF.p(lx - Math.sin(ry) * d, 0, lz - Math.cos(ry) * d); const sq = placeNpc('squirrel_nuts', p[0], p[2], SQUARE.ry + ry, { make: npcBuild.squirrel_nuts, headY: 1.05, talkR: 2.4 }); sq.paw = { color: '#C8763A', height: 0.55, meetY: 1.0 }; }
    }

    if (!FAR) { smallM = smallB.mesh(K.vcMat); if (smallM) { smallM.name = 'bazaar:stalls'; addMesh(litMesh(smallM), { cast: false }); } bigM = bigB.mesh(K.vcMat); if (bigM) { bigM.name = 'bazaar:bigStalls'; addMesh(litMesh(bigM), { cast: false }); } }
    let inM = null; if (!FAR) { inM = inB.mesh(K.vcMat); if (inM) { inM.name = 'bazaar:shopGoods'; addMesh(litMesh(inM), { cast: false }); inM.visible = false; } }
    out.castMeshes = ctx.opts && ctx.opts.stallShadows ? [smallM, bigM].filter(Boolean) : [];   // тени лотков — по флагу (бюджет high): регион включает их только рядом с площадью

    /* ===== 9. Камеры площади ===== */
    out.views.bazaar = { pos: sqF.p(-9.5, 6.2, 9.0), target: sqF.p(2.5, 0.6, -2.5), fov: 52 };
    out.views.bridge = { pos: [6.6, -4.6, 13.2], target: [5.5, -1.6, 4.6], fov: 58 };   // арка снизу, ворота, голубая галерея (p10)
    out.views.lamp = { pos: sqF.p(-1.5, 1.6, 4.8), target: [3.45, 2.6, -1.25], fov: 55 };   // фонарь у моста на фоне домов (p9)

    /* ===== 10. Состояние: большой базар, ночь, покачивание толпы ===== */
    let big = false;
    const want = ctx.opts && ctx.opts.bazaar;
    function setBig(b) { big = b === undefined ? isDay() : !!b; if (bigM) bigM.visible = big && !api.inside; if (crowd) crowd.visible = big && nightK < 0.55 && camNear && !api.inside; api.big = big; return big; }
    let nightK = 0;
    function setNight(k) { nightK = k; if (crowd) crowd.visible = big && k < 0.55 && camNear && !api.inside; }
    function collide(x, z, r, y) {
      if (!big || !dyn.length) return [x, z];
      for (let pass = 0; pass < 2; pass++) for (const c of dyn) {
        if (y !== undefined && (y > c.y1 - 0.05 || y < c.y0 - 0.5)) continue;
        const co = Math.cos(c.ry || 0), si = Math.sin(c.ry || 0), dx = x - c.x, dz = z - c.z; let lx = dx * co - dz * si, lz = dx * si + dz * co;
        const hw = c.w / 2, hd = c.d / 2, cx = clamp(lx, -hw, hw), cz = clamp(lz, -hd, hd), ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
        if (d >= r) continue;
        if (d > 1e-6) { lx = cx + ex / d * r; lz = cz + ez / d * r; } else { const pl = lx + hw, pr = hw - lx, pn = lz + hd, pf = hd - lz, m = Math.min(pl, pr, pn, pf); if (m === pl) lx = -hw - r; else if (m === pr) lx = hw + r; else if (m === pn) lz = -hd - r; else lz = hd + r; }
        x = c.x + lx * co + lz * si; z = c.z - lx * si + lz * co;
      }
      return [x, z];
    }
    // толпа — только вблизи (издалека зверята — пара пикселей, а треугольников ~12 тыс.)
    let camNear = true;
    function update(dt, t, hx, hy, hz, cam) {
      crowdT.value = t;
      if (inM && cam && cam.position) { const c = cam.position; let nv = false, ins = false; for (const k in shops) { const q = shops[k].inside; const d = Math.hypot(c.x - q[0], c.z - q[2]); if (d < 9) nv = true; if (d < 2.6) ins = true; } inM.visible = nv;
        // 4B: камера внутри лавки (вид лавки) — площадь за стенами не видна: толпа и прилавки не рисуются (−15…20 тыс. треуг.)
        if (ins !== api.inside) { api.inside = ins; if (smallM) smallM.visible = !ins; if (bigM) bigM.visible = big && !ins; if (crowd) crowd.visible = big && nightK < 0.55 && camNear && !ins; } }
      if (crowd && cam && cam.position) { const c = cam.position, d = Math.hypot(c.x - SQUARE.x, c.z - SQUARE.z) - Math.max(0, c.y - (SQUARE.y || 0) - 25) * 0.4; const nn = camNear ? d < 95 : d < 85; if (nn !== camNear) { camNear = nn; crowd.visible = big && nightK < 0.55 && camNear && !api.inside; } }
    }
    const api = { big: false, inside: false, day: DAY, dayName: 'среда', isDay, setBig, shops, stalls: stallsInfo, lamps: LAMPS.map(([x, z]) => [x, G(x, z), z]), items: ITEMS };
    out.api = api;
    setBig(want === true || want === 'big' || want === 1 || want === '1' ? true : want === false || want === 'small' || want === 0 || want === '0' ? false : isDay());
    return Object.assign(out, { update, setNight, setBig, collide, dynamic: dyn, shops, dispose() { /* геометрия и материалы — в наборе kubachi (K.keep), освобождает h.dispose() */ } });
  }

  /* ---------- продавцы (зверята, как в kubachi.js: тело, голова поворачивается к героине, лицо-наклейка) ---------- */
  function makeSellers(K, T) {
    return {
      // козочка-лавочница: белая, рожки, бородка, зелёный фартук
      goat_grocer: () => K.npc('goat_grocer', ({ n, body, P, face, M, GEO }) => {
        const w = M('#F2EEE6'), wd = M('#E2D8C8'), hn = M('#D8C8A8'), ap = M('#6E9A4E'), pk = M('#F2B8B0');
        P(body, GEO.sph, w, [0, 0.4, 0], [0.23, 0.28, 0.21]); P(body, GEO.box, ap, [0, 0.34, 0.18], [0.3, 0.36, 0.04], [0.08, 0, 0], false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, wd, [sd * 0.1, 0.07, 0.05], [0.07, 0.06, 0.1]); P(body, GEO.sph, w, [sd * 0.22, 0.46, 0.1], [0.06, 0.14, 0.06], [0.8, 0, sd * 0.4]); });
        const head = new T.Group(); head.position.set(0, 0.84, 0.03); body.add(head); n.head = head;
        P(head, GEO.sph, w, [0, 0, 0], [0.2, 0.2, 0.21]); P(head, GEO.sph, pk, [0, -0.07, 0.15], [0.1, 0.07, 0.07], null, false);
        face(head, { nose: '#C9887E', noseW: 14, noseH: 9, mouth: 'smile', ey: 340, lash: true }, [0.2, 0.2, 0.21]);
        [-1, 1].forEach(sd => { P(head, GEO.cone, hn, [sd * 0.08, 0.2, -0.04], [0.035, 0.12, 0.035], [-0.3, 0, -sd * 0.3]); P(head, GEO.sph, w, [sd * 0.2, 0.02, -0.02], [0.09, 0.035, 0.05], [0, 0, -sd * 0.5]); });
        P(head, GEO.cone, wd, [0, -0.2, 0.08], [0.05, 0.12, 0.04], [PI, 0, 0], false);
        n.extra = t => { n.body.rotation.x = Math.max(0, Math.sin(t * 2.4)) * 0.04; };
      }),
      // медвежонок-медник: бурый, круглые ушки, кожаный фартук, молоточек
      bear_craft: () => K.npc('bear_craft', ({ n, body, P, face, M, GEO }) => {
        const b = M('#8A5A3E'), bl = M('#C9A27A'), ap = M('#5E4632'), mt = M('#C9CDD2'), wd = M('#7A5A40');
        P(body, GEO.sph, b, [0, 0.42, 0], [0.27, 0.3, 0.25]); P(body, GEO.sph, bl, [0, 0.4, 0.13], [0.15, 0.18, 0.11], null, false);
        P(body, GEO.box, ap, [0, 0.33, 0.22], [0.34, 0.36, 0.04], [0.1, 0, 0], false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, b, [sd * 0.12, 0.08, 0.06], [0.09, 0.07, 0.12]); P(body, GEO.sph, b, [sd * 0.24, 0.48, 0.1], [0.07, 0.15, 0.07], [0.9, 0, sd * 0.35]); });
        const head = new T.Group(); head.position.set(0, 0.88, 0.03); body.add(head); n.head = head;
        P(head, GEO.sph, b, [0, 0, 0], [0.23, 0.21, 0.21]); P(head, GEO.sph, bl, [0, -0.06, 0.15], [0.11, 0.08, 0.08], null, false);
        face(head, { nose: '#3A2E3F', noseW: 16, noseH: 11, mouth: 'smile', ey: 340 }, [0.23, 0.21, 0.21]);
        [-1, 1].forEach(sd => { P(head, GEO.sph, b, [sd * 0.16, 0.16, -0.02], [0.07, 0.07, 0.04]); P(head, GEO.sph, bl, [sd * 0.16, 0.16, 0.0], [0.04, 0.04, 0.02], null, false); });
        const tool = new T.Group(); tool.position.set(0.26, 0.55, 0.24); body.add(tool); n.tool = tool;
        P(tool, GEO.cyl, wd, [0, 0.08, 0], [0.015, 0.18, 0.015], null, false); P(tool, GEO.box, mt, [0, 0.18, 0.02], [0.05, 0.05, 0.1], null, false);
        n.extra = t => { tool.rotation.x = -0.4 + Math.pow(Math.max(0, Math.sin(t * 4.2)), 3) * 0.7; };
      }),
      // ягнёнок с пряжей: кремовые кудряшки, красный вязаный шарфик, моток в лапках
      lamb_cloth: () => K.npc('lamb_cloth', ({ n, body, P, face, M, GEO }) => {
        const wool = M('#F7F2E8'), woolD = M('#ECE4D6'), fc = M('#F2E2D2'), sc = M('#C2405B'), yarn = M('#7FA8D8');
        [[0, 0.4, 0, 0.18], [0.13, 0.42, 0.04, 0.12], [-0.13, 0.42, 0.04, 0.12], [0.1, 0.46, -0.1, 0.12], [-0.1, 0.46, -0.1, 0.12], [0, 0.5, 0.1, 0.12]].forEach(([x, y, z, r], i) => P(body, GEO.sph, i % 2 ? wool : woolD, [x, y, z], [r, r * 0.95, r], null, i < 3));
        P(body, GEO.torus, sc, [0, 0.66, 0.02], [0.15, 0.15, 0.12], [PI / 2, 0, 0], false); P(body, GEO.box, sc, [0.06, 0.5, 0.17], [0.07, 0.2, 0.03], [0.1, 0, 0.1], false);
        P(body, GEO.sph, yarn, [0, 0.4, 0.22], [0.08, 0.08, 0.08], null, false);
        [-1, 1].forEach(sd => P(body, GEO.sph, fc, [sd * 0.09, 0.07, 0.06], [0.06, 0.05, 0.09]));
        const head = new T.Group(); head.position.set(0, 0.8, 0.04); body.add(head); n.head = head;
        P(head, GEO.sph, fc, [0, 0, 0], [0.17, 0.17, 0.17]);
        face(head, { nose: '#C9887E', noseW: 13, noseH: 8, mouth: 'smile', ey: 345, lash: true }, [0.17, 0.17, 0.17]);
        P(head, GEO.sph, wool, [0, 0.13, -0.02], [0.13, 0.08, 0.13], null, false);
        [-1, 1].forEach(sd => P(head, GEO.sph, fc, [sd * 0.17, 0.03, -0.02], [0.08, 0.035, 0.05], [0, 0, -sd * 0.45], false));
        n.extra = t => { n.body.rotation.z += Math.sin(t * 1.3) * 0.01; };
      }),
      // белочка с орешками: пушистый хвост, кисточки на ушках, орешек в лапках
      squirrel_nuts: () => K.npc('squirrel_nuts', ({ n, body, P, face, M, GEO }) => {
        const f = M('#C8763A'), fl = M('#F2DCC4'), fd = M('#A85E2C'), nut = M('#8A5A2E'), ap = M('#E8C770');
        P(body, GEO.sph, f, [0, 0.36, 0], [0.19, 0.25, 0.18]); P(body, GEO.sph, fl, [0, 0.34, 0.1], [0.11, 0.16, 0.09], null, false);
        P(body, GEO.box, ap, [0, 0.3, 0.15], [0.24, 0.26, 0.03], [0.08, 0, 0], false);
        P(body, GEO.sph, nut, [0, 0.46, 0.2], [0.05, 0.06, 0.05], null, false);
        [-1, 1].forEach(sd => P(body, GEO.sph, fd, [sd * 0.08, 0.06, 0.05], [0.06, 0.05, 0.09]));
        n.tail = new T.Group(); n.tail.position.set(0, 0.25, -0.18); body.add(n.tail);
        [[0, 0.05, -0.05, 0.11], [0, 0.22, -0.14, 0.13], [0, 0.42, -0.14, 0.13], [0, 0.58, -0.06, 0.11]].forEach(([x, y, z, r], i) => P(n.tail, GEO.sph, i === 3 ? fd : f, [x, y, z], [r, r * 1.1, r]));
        const head = new T.Group(); head.position.set(0, 0.74, 0.03); body.add(head); n.head = head;
        P(head, GEO.sph, f, [0, 0, 0], [0.16, 0.15, 0.15]); P(head, GEO.sph, fl, [0, -0.05, 0.1], [0.09, 0.06, 0.06], null, false);
        face(head, { nose: '#3A2E3F', noseW: 12, noseH: 9, mouth: 'smile', ey: 345 }, [0.16, 0.15, 0.15]);
        [-1, 1].forEach(sd => { P(head, GEO.cone, f, [sd * 0.08, 0.15, -0.02], [0.04, 0.1, 0.03], [0, 0, -sd * 0.3]); P(head, GEO.cone, fd, [sd * 0.09, 0.22, -0.02], [0.015, 0.06, 0.015], [0, 0, -sd * 0.3], false); });
        n.extra = t => { n.tail.rotation.x = Math.sin(t * 2.2) * 0.12; };
      }),
    };
  }

  V.bazaar = { build, DAY, isDay, makeItem, ITEMS };
})();
