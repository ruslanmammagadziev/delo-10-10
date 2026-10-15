/* =====================================================================
   ОТКРЫТЫЙ ГОРОД (прототип): фасады Октябрьской.
   Строители кинотеатра, бюро, кондитерской, подъезда и киоска — копия из js/city3d.js
   (без изменений формы; у подъезда убраны мелочи, которых в открытом городе нет).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  WORLD.makeFacades = function (H, SIGN) {
    const { T, PI, keep, GEO, put, box, sph, sphS, cyl, plane, rbox, extrude, smoothCrease, archShape, triShape, windowF, cornice,
      lace, curtains, flowerBox, IVY, ivy, wreath, bow, bowAt, sconce, ringG, blobGeo, bake, toon, tex } = H;
    function buildCinema(K) {
      const g = new T.Group(), W = 3.7, H = 4.4, D = 3.2;
      const red = K.m('#B9475F'), redD = K.m('#9E2F47'), cream = K.m('#FFF0CE'), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.55 }),
        dark = K.m('#2F2834'), wine = K.m('#73304A'), glass = K.m('#FFE4B0', { glow: '#FFC870', gi: 0.45 }), rope = K.m('#8E2340');
      const bulbA = K.m('#FFE7A0', { glow: '#FFC94A', gi: 0.9, id: 'A' }), bulbB = K.m('#FFE7A0', { glow: '#FFC94A', gi: 0.9, id: 'B' });
      rbox(g, red, 0, H / 2, -D / 2, W, H, D, 0.14);
      rbox(g, redD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
      cornice(g, redD, H, W, D);
      // круглые башенки с куполками по углам — силуэт игрушечного театра
      [-1, 1].forEach(sd => {
        const x = sd * 1.98, z = -0.1, R0 = 0.27, TH = H + 0.6;
        cyl(g, red, x, TH / 2, z, R0, TH);
        [0.36, 1.6, 2.9, H + 0.45].forEach(y => cyl(g, cream, x, y, z, R0 + 0.018, 0.07));
        put(g, GEO.hemi, redD, [x, TH, z], [R0 + 0.03, 0.42, R0 + 0.03]);
        cyl(g, gold, x, TH + 0.5, z, 0.012, 0.16); sphS(g, gold, x, TH + 0.63, z, 0.06);
        cyl(g, glass, x, 3.55, z + R0 - 0.005, 0.09, 0.03, [PI / 2, 0, 0]); put(g, ringG(0.1, 0.02), cream, [x, 3.55, z + R0 + 0.01]);
      });
      // корона-полукруг с солнцем — его и ищем всю серию
      const ped = keep(new T.ExtrudeGeometry(archShape(2.4, 1.2), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 })); smoothCrease(ped, 50);
      put(g, ped, redD, [0, H + 0.36, -0.42]);
      put(g, extrude(archShape(1.96, 0.98), 0.03), cream, [0, H + 0.4, -0.03]);
      for (let i = 0; i <= 12; i++) { const a = PI * i / 12; sphS(g, i % 2 ? bulbA : bulbB, Math.cos(a) * 1.09, H + 0.38 + Math.sin(a) * 1.09, 0.03, 0.05); }
      cyl(g, gold, 0, H + 0.84, 0.02, 0.2, 0.05, [PI / 2, 0, 0]);
      put(g, ringG(0.2, 0.025), gold, [0, H + 0.84, 0.05]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; rbox(g, gold, Math.cos(a) * 0.31, H + 0.84 + Math.sin(a) * 0.31, 0.03, 0.13, 0.045, 0.035, 0.015, [0, 0, a]); }
      lace(g, cream, -1.68, 1.68, H - 0.02, 0.1, 0.09, redD);
      ivy(g, K, W, H, 1, 13, 44, ['#E9A94B', '#E07A45', '#F0C05A', '#C8613F'], [[-1.55, 0.9], [-2.75, 0.8]], false);
      // вывеска с лампочками
      const sy = 3.3;
      rbox(g, cream, 0, sy, 0.14, 3.3, 1.12, 0.26, 0.11);
      plane(g, K.t(SIGN.cinema), 0, sy, 0.272, 3.14, 1.03);
      for (let i = 0; i < 14; i++) { const x = -1.56 + i * 0.24; [sy + 0.6, sy - 0.6].forEach(y => sphS(g, i % 2 ? bulbA : bulbB, x, y, 0.2, 0.048)); }
      [-1, 1].forEach(s => { for (let j = 0; j < 4; j++) sphS(g, j % 2 ? bulbA : bulbB, s * 1.72, sy - 0.36 + j * 0.24, 0.2, 0.048); });
      // козырёк «КАССА»
      rbox(g, redD, 0, 2.28, 0.46, 1.3, 0.34, 0.92, 0.08);
      plane(g, K.t(SIGN.kassa), 0, 2.28, 0.925, 0.9, 0.24);
      box(g, gold, 0, 2.11, 0.93, 1.3, 0.03, 0.03); box(g, gold, 0, 2.45, 0.93, 1.3, 0.03, 0.03);
      [-0.45, 0, 0.45].forEach(x => sphS(g, bulbA, x, 2.08, 0.62, 0.045));
      const swg = [K.m('#D9774F'), K.m('#E8A84F'), K.m('#E7A3A0')];
      for (let i = 0; i <= 10; i++) put(g, GEO.sphLo, swg[i % 3], [-0.6 + i * 0.12, 2.06 - 0.09 * Math.sin(PI * i / 10), 0.95], [0.06, 0.042, 0.028], [0, 0, i * 0.9]);
      // двери (створки открываются)
      box(g, dark, 0, 0.88, 0.02, 1.22, 1.76, 0.04);
      box(g, redD, 0, 1.82, 0.06, 1.34, 0.1, 0.12);
      const doors = [];
      [-1, 1].forEach(s => {
        const p = new T.Group(); p.position.set(s * 0.56, 0, 0.06); p.userData.dyn = true; g.add(p);
        box(p, wine, -s * 0.275, 0.84, 0.03, 0.53, 1.68, 0.06);
        cyl(p, glass, -s * 0.275, 1.24, 0.07, 0.13, 0.03, [PI / 2, 0, 0]);
        const wr = wreath(K, 0.17, '#E8879E'); wr.position.set(-s * 0.275, 1.24, 0.075); p.add(wr);
        box(p, gold, -s * 0.07, 0.82, 0.08, 0.03, 0.26, 0.03);
        doors.push({ p, open: s * 1.35 });
      });
      // афиши
      [[-1.12, SIGN.poster1], [1.12, SIGN.poster2]].forEach(([x, cv]) => {
        rbox(g, dark, x, 1.98, 0.05, 0.98, 1.34, 0.1, 0.045);
        plane(g, K.t(cv), x, 1.98, 0.102, 0.82, 1.18);
        box(g, gold, x, 2.72, 0.12, 0.5, 0.06, 0.14);
      });
      // бархатные канаты
      [-1, 1].forEach(s => {
        [0.85, 1.55].forEach(x => { cyl(g, gold, s * x, 0.36, 0.42, 0.03, 0.72); sph(g, gold, s * x, 0.75, 0.42, 0.05); cyl(g, gold, s * x, 0.02, 0.42, 0.09, 0.04); });
        const c = new T.QuadraticBezierCurve3(new T.Vector3(s * 0.85, 0.7, 0.42), new T.Vector3(s * 1.2, 0.46, 0.42), new T.Vector3(s * 1.55, 0.7, 0.42));
        put(g, keep(new T.TubeGeometry(c, 12, 0.022, 6)), rope);
      });
      return { g, doors, bulbs: [bulbA, bulbB] };
    }
    function buildBureau(K) {
      const g = new T.Group(), W = 3.7, H = 4.6, D = 3.2;
      const blue = K.m('#8FB3D9'), blueD = K.m('#6F93BC'), cream = K.m('#FFFDF9'), navy = K.m('#2F3A5A'), mint = K.m('#BFE6D3'),
        glass = K.m('#E9F1F9', { glow: '#FFE7BC', gi: 0.35 }), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }), wood = K.m('#B98C6A'), green = K.m('#7FB07A'), pipe = K.m('#7E8B99');
      const books = ['#F08FA8', '#8FB3D9', '#F7B267', '#BFE6D3', '#B9A5E8', '#C2405B'].map(c => K.m(c));
      const flowers = [K.m('#EFA3B5'), K.m('#F3CF73'), K.m('#D9774F')];
      rbox(g, blue, 0, H / 2, -D / 2, W, H, D, 0.14);
      rbox(g, blueD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
      cornice(g, cream, H, W, D);
      for (let i = 0; i < 15; i++) { put(g, GEO.halfDisc, cream, [-1.68 + i * 0.24, H - 0.02, 0.09], [0.12, 0.04, 0.12], [PI / 2, 0, 0]); sph(g, cream, -1.56 + i * 0.24, H - 0.1, 0.1, 0.025); }
      const slate = K.m('#6F8DB8');
      { const ms = new T.Shape(), bw = W / 2 + 0.2, tw = W / 2 - 0.35, mh = 0.95, rc = 0.18;
        ms.moveTo(-bw, 0); ms.lineTo(bw, 0); ms.lineTo(tw + rc * 0.4, mh - rc); ms.quadraticCurveTo(tw, mh, tw - rc, mh); ms.lineTo(-tw + rc, mh); ms.quadraticCurveTo(-tw, mh, -tw - rc * 0.4, mh - rc); ms.closePath();
        const mg = keep(new T.ExtrudeGeometry(ms, { depth: D + 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 8 })); smoothCrease(mg, 50);
        put(g, mg, slate, [0, H + 0.38, -D - 0.1]); }
      [-0.8, 0.8].forEach(x => {
        rbox(g, cream, x, H + 0.8, -0.3, 0.62, 0.6, 0.5, 0.08);
        put(g, GEO.halfCyl, slate, [x, H + 1.1, -0.3], [0.36, 0.56, 0.36], [0, PI / 2, PI / 2]);
        windowF(g, cream, glass, x, H + 0.8, 0.28, 0.32, { arch: true, sill: false });
      });
      cyl(g, pipe, W / 2 - 0.08, H / 2, 0.08, 0.05, H);
      ivy(g, K, W, H, 1, 11, 60, IVY, [[-2.2, 0.8], [-2.95, 0.95]], true);
      rbox(g, cream, 0, 3.72, 0.1, 3.4, 0.95, 0.2, 0.09);
      plane(g, K.t(SIGN.bureau), 0, 3.72, 0.202, 3.3, 0.88);
      bow(g, K.m('#F08FA8'), 1.55, 4.15, 0.24, 0.3);
      rbox(g, navy, 0, 3.0, 0.06, 1.66, 0.36, 0.12, 0.055);
      plane(g, K.t(SIGN.bureauSmall), 0, 3.0, 0.122, 1.56, 0.32);
      // глобус на кронштейне — крутится
      cyl(g, navy, -1.25, 3.72, 0.27, 0.03, 0.16, [PI / 2, 0, 0]);
      const globe = new T.Group(); globe.position.set(-1.25, 3.72, 0.62); globe.userData.dyn = true; g.add(globe);
      const spin = new T.Group(); spin.rotation.z = 0.35; globe.add(spin);
      sph(spin, mint, 0, 0, 0, 0.3);
      const ring = keep(new T.TorusGeometry(0.31, 0.014, 6, 32));
      put(spin, ring, navy, [0, 0, 0], null, [PI / 2, 0, 0]); put(spin, ring, navy); put(spin, ring, navy, [0, 0, 0], null, [0, PI / 2, 0]);
      [[0.1, 0.12, 0.25], [-0.15, -0.05, 0.24], [0.05, -0.18, -0.22], [-0.2, 0.15, -0.15], [0.24, -0.04, -0.12]].forEach(([x, y, z]) => sph(spin, green, x * 0.95, y * 0.95, z * 0.95, 0.1, 0.075, 0.07));
      bake(spin, null, { cast: false });
      // витрины с книгами
      [-1.08, 1.08].forEach((x, wi) => {
        windowF(g, cream, glass, x, 1.82, 1.0, 1.3, { arch: true });
        [1.42, 1.98].forEach((y, si) => {
          box(g, cream, x, y, 0.1, 0.96, 0.035, 0.16);
          for (let i = 0; i < 8; i++) { const h = 0.26 + ((i + si + wi) % 3) * 0.05; box(g, books[(i + si * 2 + wi) % 6], x - 0.4 + i * 0.105, y + 0.0175 + h / 2, 0.1, 0.08, h, 0.13, [0, 0, i === 7 ? -0.2 : 0]); }
        });
        flowerBox(g, wood, green, flowers, x, 0.92, 1.0);
      });
      // арочная дверь
      const dw = 0.96, dh = 1.8;
      put(g, extrude(archShape(dw + 0.2, dh + 0.1), 0.06), cream);
      const p = new T.Group(); p.position.set(-dw / 2, 0, 0.06); p.userData.dyn = true; g.add(p);
      put(p, extrude(archShape(dw, dh, dw / 2), 0.07), navy);
      put(p, extrude(archShape(0.56, 0.6, dw / 2), 0.02), glass, [0, 1.06, 0.07]);
      sph(p, gold, dw - 0.13, 0.9, 0.1, 0.035);
      const wr = wreath(K, 0.2, '#E8879E'); wr.position.set(dw / 2, 1.36, 0.115); p.add(wr);
      box(p, cream, dw / 2, 0.72, 0.075, 0.52, 0.17, 0.01);
      plane(p, K.t(SIGN.open), dw / 2, 0.72, 0.081, 0.5, 0.156);
      return { g, doors: [{ p, open: -1.35 }], globe: spin };
    }
    function buildSweets(K) {
      const g = new T.Group(), W = 3.7, H = 4.5, D = 3.2;
      const pink = K.m('#F6C6D0'), pinkD = K.m('#E7A6B6'), cream = K.m('#FFFDF9'), cherry = K.m('#C2405B'), stripe = K.m('#F08FA8'),
        glass = K.m('#FFF3F5', { glow: '#FFE0CC', gi: 0.35 }), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }), caramel = K.m('#E7B47C'),
        lav = K.m('#C9B6F0'), mint = K.m('#BFE6D3'), stem = K.m('#5E7A4A');
      rbox(g, pink, 0, H / 2, -D / 2, W, H, D, 0.14);
      rbox(g, pinkD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
      cornice(g, cream, H, W, D);
      const DRP = [0.05, 0.1, 0.15, 0.2, 0.25].map(L => keep(new T.CapsuleGeometry(0.075, L, 2, 7)));
      for (let i = 0; i < 16; i++) { const k = (i * 7) % 5, L = 0.05 + k * 0.05; put(g, DRP[k], cream, [-1.8 + i * 0.24, H + 0.04 - (L / 2 + 0.075), 0.11], [1, 1, 0.8]); }
      rbox(g, pinkD, -1.25, H + 0.35, -2.4, 0.34, 0.7, 0.34, 0.05); rbox(g, cream, -1.25, H + 0.74, -2.4, 0.44, 0.08, 0.44, 0.03);
      // торт на крыше
      const cx = 0.55, cz = -1.5;
      cyl(g, stripe, cx, H + 0.62, cz, 0.75, 0.5); cyl(g, cream, cx, H + 0.89, cz, 0.78, 0.06);
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; sph(g, cream, cx + Math.cos(a) * 0.75, H + 0.81, cz + Math.sin(a) * 0.75, 0.07, 0.11, 0.07); }
      cyl(g, cream, cx, H + 1.13, cz, 0.52, 0.42); cyl(g, stripe, cx, H + 1.36, cz, 0.55, 0.05);
      sph(g, cherry, cx, H + 1.53, cz, 0.14); cyl(g, stem, cx + 0.04, H + 1.71, cz, 0.012, 0.16, [0, 0, -0.4]);
      bow(g, cherry, cx, H + 0.65, cz + 0.78, 0.38);
      // вывеска-пилюля
      put(g, keep(new T.CapsuleGeometry(0.46, 2.2, 4, 14)), cream, [0, 3.72, 0.14], [1, 1, 0.3], [0, 0, PI / 2]);
      plane(g, K.t(SIGN.sweets, { alpha: true }), 0, 3.72, 0.285, 2.7, 0.9);
      // полосатая маркиза
      rbox(g, cherry, 0, 2.98, 0.1, 3.86, 0.14, 0.2, 0.06);
      const awG = keep(new T.CylinderGeometry(1, 1, 0.37, 10, 1, false, 0, PI / 2));
      for (let i = 0; i < 10; i++) {
        const x = -1.665 + i * 0.37, m = i % 2 ? cream : stripe;
        put(g, awG, m, [x, 2.45, 0.08], [0.53, 1, 0.86], [0, 0, PI / 2]);
        put(g, GEO.halfDisc, m, [x, 2.45, 0.94], [0.185, 0.03, 0.185], [PI / 2, 0, 0]);
      }
      // витрина со сладостями
      const vit = K.m('#E2B6C0', { glow: '#FFBFA0', gi: 0.18 });
      windowF(g, cream, vit, -0.69, 1.3, 1.9, 1.3, { sill: false });
      curtains(g, stripe, -0.69, 1.3, 1.9, 1.3);
      plane(g, K.t(SIGN.sweetsWin, { alpha: true }), -0.69, 1.76, 0.066, 0.78, 0.125);
      box(g, cream, -0.69, 0.62, 0.15, 2.04, 0.08, 0.3);
      // этажерка с капкейками
      { const cs = -0.6; cyl(g, gold, cs, 1.11, 0.2, 0.014, 0.9);
        [[1.0, 0.27], [1.25, 0.2], [1.46, 0.13]].forEach(([y, r], t) => { put(g, GEO.cyl, cream, [cs, y, 0.2], [r, 0.025, r * 0.55]);
          for (let j = 0; j < 3 - t; j++) { const x = cs + (j - (2 - t) / 2) * r * 0.62;
            cyl(g, [stripe, mint, lav][j % 3], x, y + 0.05, 0.21, 0.042, 0.07); sphS(g, cream, x, y + 0.1, 0.21, 0.048, 0.034, 0.048); sphS(g, cherry, x, y + 0.14, 0.21, 0.016); } }); }
      put(g, GEO.hemi, stripe, [-1.35, 0.66, 0.16], [0.2, 0.2, 0.2]); sph(g, cherry, -1.35, 0.89, 0.16, 0.05); cyl(g, cream, -1.35, 0.67, 0.16, 0.22, 0.02);
      cyl(g, caramel, -0.85, 0.73, 0.16, 0.19, 0.14); cyl(g, cream, -0.85, 0.82, 0.16, 0.19, 0.04);
      box(g, lav, -0.35, 0.77, 0.16, 0.3, 0.22, 0.24); box(g, cream, -0.35, 0.89, 0.16, 0.3, 0.04, 0.24);
      [stripe, mint, lav].forEach((m, i) => { cyl(g, m, 0.05, 0.69 + i * 0.065, 0.16, 0.085, 0.04); cyl(g, cream, 0.05, 0.715 + i * 0.065, 0.16, 0.075, 0.015); });
      // вишнёвая дверь с круглым окошком и колокольчик
      const dx = 1.05, dw = 0.98, dh = 2.0;
      put(g, extrude(archShape(dw + 0.18, dh + 0.09, dx), 0.05), cream);
      const p = new T.Group(); p.position.set(dx - dw / 2, 0, 0.05); p.userData.dyn = true; g.add(p);
      put(p, extrude(archShape(dw, dh, dw / 2), 0.07), cherry);
      cyl(p, vit, dw / 2, 1.5, 0.08, 0.24, 0.03, [PI / 2, 0, 0]);
      const wr = wreath(K, 0.29, '#FFFDF9'); wr.position.set(dw / 2, 1.5, 0.11); p.add(wr);
      sph(p, gold, dw - 0.14, 0.95, 0.1, 0.035);
      box(g, gold, dx, 2.36, 0.1, 0.02, 0.02, 0.2);
      put(g, GEO.cone, gold, [dx, 2.27, 0.2], [0.06, 0.1, 0.06]); sph(g, gold, dx, 2.21, 0.2, 0.02);
      sconce(g, K, 1.74, 1.95);
      return { g, doors: [{ p, open: -1.35 }] };
    }
    function buildRoof(K) {
      const g = new T.Group(), W = 3.7, H = 5.1, D = 3.2;
      const wall = K.m('#A3AEBB'), wallD = K.m('#8A95A3'), frame = K.m('#F2F5F8'), glass = K.m('#DDE6F0', { glow: '#FFE6B0', gi: 0.38 }),
        metal = K.m('#4F5966'), metalL = K.m('#6C7682'), doorM = K.m('#5C6673'), cream = K.m('#FFFDF9'), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }),
        pot = K.m('#C96F4A'), green = K.m('#7FB07A'), pinkF = K.m('#F08FA8'), vent = K.m('#C9D1DA');
      rbox(g, wall, 0, H / 2, -D / 2, W, H, D, 0.14);
      rbox(g, wallD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
      cornice(g, wallD, H, W, D);
      cyl(g, metalL, -W / 2 + 0.08, H / 2, 0.08, 0.05, H);
      cyl(g, metalL, -0.9, H + 0.8, -1.3, 0.03, 1.2);
      [0.35, 0.6].forEach((yy, i) => cyl(g, metalL, -0.9, H + 0.6 + yy, -1.3, 0.02, 0.6 - i * 0.2, [0, 0, PI / 2]));
      { const tx = 0.95, tz = -2.2, ty = H + 0.38, tank = K.m('#C98F6B'), hat = K.m('#D9776B');
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, metal, tx + a * 0.24, ty + 0.3, tz + b * 0.24, 0.035, 0.6));
        cyl(g, tank, tx, ty + 0.9, tz, 0.38, 0.62);
        [0.72, 1.08].forEach(y => put(g, keep(new T.TorusGeometry(0.385, 0.022, 6, 24)), metal, [tx, ty + y, tz], null, [PI / 2, 0, 0]));
        put(g, GEO.cone, hat, [tx, ty + 1.41, tz], [0.47, 0.4, 0.47]); sph(g, gold, tx, ty + 1.66, tz, 0.06); }
      rbox(g, wallD, -1.35, H + 0.75, -2.4, 0.34, 0.8, 0.34, 0.06); rbox(g, metal, -1.35, H + 1.18, -2.4, 0.42, 0.08, 0.42, 0.03);
      // окна 2×4, на некоторых — цветы
      const shutP = K.m('#E7A6B6'), shutM = K.m('#BFE6D3'), curtP = K.m('#F7C9D3'), mumR = K.m('#D9774F'), mumY = K.m('#F3CF73');
      ivy(g, K, W, H, 1, 12, 44, IVY, [[-1.5, 0.6], [-2.7, 0.75]], false);
      [-1.23, -0.31].forEach((x, c) => [4.32, 3.32, 2.32, 1.32].forEach((y, r) => {
        windowF(g, frame, glass, x, y, 0.6, 0.7, r === 0 ? { arch: true } : { cross: true, shut: (c === 0 && r === 1) ? shutP : (c === 1 && r === 3) ? shutM : null });
        if (r > 0) curtains(g, (r + c) % 2 ? curtP : cream, x, y, 0.6, 0.7); else curtains(g, cream, x, y - 0.05, 0.6, 0.6, false);
        if (r > 0 && (r + c) % 2 === 0) flowerBox(g, pot, green, [mumR, mumY, pinkF], x, y - 0.365, 0.52);
      }));
      // пожарная лестница: первого пролёта нет
      const fx = 0.95, fw = 1.3, PL = [2.25, 3.2, 4.15];
      PL.forEach(y => {
        box(g, metal, fx, y, 0.33, fw, 0.05, 0.62);
        box(g, metal, fx, y + 0.45, 0.63, fw, 0.035, 0.035);
        box(g, metal, fx, y + 0.22, 0.63, fw, 0.02, 0.02);
        [-1, -0.33, 0.33, 1].forEach(t => box(g, metal, fx + t * fw / 2, y + 0.225, 0.63, 0.03, 0.45, 0.03));
        [-1, 1].forEach(s => box(g, metal, fx + s * fw / 2, y + 0.45, 0.33, 0.03, 0.03, 0.62));
      });
      for (let f = 1; f < PL.length; f++) {
        const y0 = PL[f - 1] + 0.025, y1 = PL[f], dir = f % 2 ? 1 : -1, x0 = fx - dir * 0.45, x1 = fx + dir * 0.45;
        const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
        [0.14, 0.5].forEach(z => box(g, metal, (x0 + x1) / 2, (y0 + y1) / 2, z, len, 0.05, 0.025, [0, 0, ang]));
        for (let s = 1; s < 7; s++) { const t = s / 7; box(g, metalL, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.32, 0.12, 0.025, 0.36); }
      }
      [0.14, 0.5].forEach(z => box(g, metal, fx - 0.5, PL[0] - 0.16, z, 0.4, 0.05, 0.025, [0, 0, 0.95]));
      box(g, metal, fx + 0.55, 0.12, 0.3, 0.34, 0.05, 0.025, [0, 0, 0.7]);
      const sg = new T.Group(); sg.position.set(fx - 0.33, PL[0] - 0.36, 0.62); sg.rotation.z = -0.07; g.add(sg);
      box(sg, cream, 0, 0, 0, 0.8, 0.33, 0.03); plane(sg, K.t(SIGN.stairs), 0, 0, 0.016, 0.78, 0.32);
      [-0.28, 0.28].forEach(x => cyl(sg, metalL, x, 0.27, 0, 0.008, 0.22));
      // кто-то проветривает ковёр
      box(g, K.m('#8E2B40'), fx + 0.15, PL[1] + 0.2, 0.66, 0.62, 0.5, 0.02);
      plane(g, K.t(SIGN.carpet), fx + 0.15, PL[1] + 0.2, 0.672, 0.6, 0.48);
      // дверь «ВЫХОД НА КРЫШУ»
      const dx = 1.1, dw = 0.94, dh = 1.6;
      box(g, metal, dx, dh / 2 + 0.03, 0.015, dw + 0.14, dh + 0.1, 0.03);
      const p = new T.Group(); p.position.set(dx - dw / 2, 0, 0.03); p.userData.dyn = true; g.add(p);
      box(p, doorM, dw / 2, dh / 2, 0.03, dw, dh, 0.06);
      box(p, cream, dw / 2, 1.32, 0.065, 0.66, 0.26, 0.01); plane(p, K.t(SIGN.exit), dw / 2, 1.32, 0.071, 0.64, 0.25);
      sph(p, gold, dw - 0.12, 0.82, 0.08, 0.035);
      rbox(g, vent, -0.77, 0.4, 0.06, 1.3, 0.62, 0.12, 0.05);
      for (let i = 0; i < 5; i++) box(g, wallD, -0.77, 0.18 + i * 0.11, 0.13, 1.2, 0.03, 0.03);
      sconce(g, K, 1.78, 1.75);
      return { g, doors: [{ p, open: -1.35 }] };
    }
    function buildKiosk(K) {
      const g = new T.Group(), W = 1.3, D = 1.1;
      const green = K.m('#7FB59A'), greenD = K.m('#5E9A7E'), cream = K.m('#FFFDF9'), paper = K.m('#F2EEE6'), inside = K.m('#3F6B57');
      const mags = [K.m('#F08FA8'), K.m('#8FB3D9'), K.m('#F7B267')];
      rbox(g, green, 0, 0.28, -D / 2, W, 0.56, D, 0.08);
      box(g, cream, 0, 0.585, 0.06, W + 0.08, 0.05, 0.32);
      box(g, inside, 0, 0.88, -0.6, W - 0.16, 0.6, 0.04);
      [-1, 1].forEach(s => box(g, greenD, s * (W / 2 - 0.05), 0.88, -D / 2, 0.1, 0.62, D));
      rbox(g, green, 0, 1.31, -D / 2, W, 0.26, D, 0.06);
      plane(g, K.t(SIGN.gazety, { alpha: true }), 0, 1.31, 0.002, 1.05, 0.23);
      put(g, GEO.halfCyl, greenD, [0, 1.44, -D / 2], [0.38, W + 0.16, 0.66], [0, 0, PI / 2]);
      [-0.38, -0.05, 0.3].forEach((x, i) => { for (let j = 0; j < 3 + (i % 2); j++) box(g, paper, x, 0.625 + j * 0.03, 0.08, 0.3, 0.025, 0.22, [0, j % 2 ? 0.08 : -0.06, 0]); });
      mags.forEach((m, i) => box(g, m, -0.4 + i * 0.4, 0.9, -0.52, 0.26, 0.34, 0.02, [-0.1, 0, 0]));
      [-0.3, 0.3].forEach(x => box(g, paper, x, 1.0, -0.2, 0.3, 0.36, 0.01));
      const crate = (wood, woodD, ap, leaf, x, y, z, ry) => {
        const c = new T.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
        rbox(c, wood, 0, 0.13, 0, 0.5, 0.26, 0.34, 0.03); [0.06, 0.19].forEach(yy => box(c, woodD, 0, yy, 0.172, 0.52, 0.035, 0.01));
        for (let i = 0; i < 8; i++) put(c, GEO.sphLo, ap[i % ap.length], [-0.17 + (i % 4) * 0.115, 0.27, -0.07 + (i >> 2) * 0.14], [0.058, 0.055, 0.058]);
        put(c, GEO.sphLo, leaf, [0.1, 0.33, 0.05], [0.03, 0.008, 0.018]);
      };
      const wd = K.m('#D2A274'), wdD = K.m('#B07F55'), lf = K.m('#8FAE62');
      crate(wd, wdD, [K.m('#E05A5A'), K.m('#F0A94B'), K.m('#C5D07A')], lf, 1.0, 0, -0.58, 0.08);
      crate(wd, wdD, [K.m('#D9C25A'), K.m('#C5D07A')], lf, 0.98, 0.27, -0.66, -0.12);
      return { g };
    }
    return { cinema: buildCinema, bureau: buildBureau, sweets: buildSweets, roof: buildRoof, kiosk: buildKiosk };
  };

  /* =====================================================================
     ВОЛНА 3 (EXPAND): строители нового города — WORLD.makeProps(H) → P.
     Каждый строитель возвращает группу в своих координатах: начало у фасада/основания, перед смотрит на +z.
     K — набор материалов дома (H.makeKitLit()); вывески — канвасы из P.sign(...) (их заранее кладут в общий атлас).
       P.sign(big, small, col, bg) → canvas 384×112 · P.board(l1, l2) → canvas 512×160 (указатель)
       P.stall(K, { w, cv, aw, goods, kind })   — рыночный прилавок (ширина w, глубина 2,2, маркиза, товар)
       P.garage(K, { w, d, h, door, num, open, cv }) — гараж с круглой крышей; open — открыт, внутри полка и ящик
       P.rental(K, cv)                         — будка велопроката с маркизой
       P.gate(K, { span, cv })                 — каменные столбы с фонарями и кованая арка над дорогой (вдоль x)
       P.parkArch(K, { span, cv })             — арка входа в парк с листьями и вывеской
       P.bridge(K, { len, w })                 — деревянный мостик вдоль z (настил плоский, перила дугой)
       P.pier(K, { len, w })                   — пирс вдоль +z: настил, сваи, канат, фонарь в конце
       P.boat(K) · P.duck(K) · P.duckHouse(K)   — лодка, уточка, домик для уток на плотике (их качает main/map)
       P.telescope(K)                          — смотровой телескоп на ножке
       P.hurdle(K) · P.tunnel(K) · P.ramp(K) · P.bowl(K) — собачья площадка
       P.barrier(K, cv)                        — полосатые козлы с табличкой
       P.lantern(K)                            — фонарь-столбик на камне (для лестницы и пирса)
     ===================================================================== */
  WORLD.makeProps = function (H) {
    const { T, PI, keep, GEO, put, box, sphS, cyl, rbox, archShape, cnv, rrect, text } = H;
    const q01 = v => Math.round(v * 20) / 20;   // размеры скруглённых коробок — шагом 5 см: общий кэш геометрии
    const rb = (g, m, x, y, z, w, h, d, r, rot) => rbox(g, m, x, y, z, q01(w), q01(h), q01(d), r, rot);
    const P = {};
    P.sign = (big, small, col = '#C2405B', bg = '#FFF6EE') => {
      const [cv, c] = cnv(384, 112);
      c.fillStyle = bg; rrect(c, 2, 2, 380, 108, 26); c.fill();
      c.strokeStyle = col; c.lineWidth = 7; rrect(c, 11, 11, 362, 90, 20); c.stroke();
      text(c, big, 192, small ? 46 : 58, small ? 44 : 50, col, { f: 'Comfortaa', w: 700, max: 330 });
      if (small) text(c, small, 192, 84, 24, '#6E6272', { w: 800, max: 330 });
      return cv;
    };
    P.board = (l1, l2, col = '#C2405B') => {
      const [cv, c] = cnv(512, 160); c.fillStyle = '#FFF6EE'; rrect(c, 4, 4, 504, 152, 30); c.fill(); c.strokeStyle = col; c.lineWidth = 8; rrect(c, 16, 16, 480, 128, 22); c.stroke();
      text(c, l1, 256, l2 ? 64 : 82, l2 ? 54 : 64, col, { f: 'Comfortaa', w: 700, max: 440 }); if (l2) text(c, l2, 256, 116, 34, '#6E6272', { w: 800, max: 440 });
      return cv;
    };
    const awning = (g, K, x, y, z, w, d, c1, c2 = '#FFFDF9', n) => {
      n = n || Math.max(3, Math.round(w / 0.32)); const sw = w / n, a = K.m(c1), b = K.m(c2);
      for (let i = 0; i < n; i++) rb(g, i % 2 ? b : a, x - w / 2 + sw * (i + 0.5), y, z, sw, 0.07, d, 0.02, [0.42, 0, 0]);
      // фестоны по краю маркизы
      for (let i = 0; i < n; i++) put(g, GEO.halfDisc, i % 2 ? b : a, [x - w / 2 + sw * (i + 0.5), y - Math.sin(0.42) * d / 2 - 0.02, z + Math.cos(0.42) * d / 2], [sw / 2, 0.025, 0.09], [PI / 2, 0, 0]);
    };
    const GOODS = {
      apples: ['#E05A5A', '#F0A94B', '#C5D07A', '#E57A5A'], pumpkins: ['#EE9A55', '#F3D2B0', '#EBB3BA'], flowers: ['#EFA3B5', '#F3CF73', '#C7A8DD', '#F7C9D4', '#E99A6E'],
      bread: ['#E2B276', '#D69A5C', '#F0CF9A'], paper: ['#FFFDF9', '#9DB8E0', '#F08FA8', '#F7D27A'], badges: ['#F08FA8', '#8FB3D9', '#F3CF73', '#9FC2A8', '#C7A8DD'],
      cards: ['#FFF0CE', '#F7C9D4', '#CFE0D2', '#D9CCE6'], mittens: ['#C2405B', '#9DB8E0', '#F3CF73', '#9FC2A8', '#EFA3B5'],
    };
    P.stall = (K, o = {}) => {
      // лёгкий прилавок (≈1,5 тыс. треугольников): простые коробки, скругление — только у столешницы
      const g = new T.Group(), W = o.w || 3.0, D = 2.2, wood = K.m(o.wood || '#D9B08A'), woodD = K.m('#B98C6A'), cream = K.m('#FFF6EE');
      const goods = (GOODS[o.goods] || GOODS.apples).map(c => K.m(c));
      box(g, wood, 0, 0.45, -0.45, W, 0.9, 0.8);
      rb(g, cream, 0, 0.93, -0.38, W + 0.08, 0.06, 0.96, 0.03);
      box(g, woodD, 0, 1.25, -D + 0.08, W, 2.5, 0.1);
      [0.95, 1.55].forEach(y => box(g, wood, 0, y, -D + 0.3, W - 0.2, 0.06, 0.4));
      [-1, 1].forEach(s => { box(g, woodD, s * (W / 2 - 0.06), 1.3, -0.08, 0.1, 2.6, 0.1); box(g, woodD, s * (W / 2 - 0.06), 1.3, -D + 0.12, 0.1, 2.6, 0.1); box(g, wood, s * (W / 2 - 0.05), 1.55, -D / 2, 0.05, 1.7, D - 0.2); });
      box(g, woodD, 0, 2.62, -D / 2, W + 0.2, 0.12, D + 0.1);
      // маркиза: полосы и фестоны
      { const n = 7, sw = (W + 0.16) / n, a = K.m(o.aw || '#F08FA8'); for (let i = 0; i < n; i++) { const x = -(W + 0.16) / 2 + sw * (i + 0.5); box(g, i % 2 ? cream : a, x, 2.38, 0.18, sw, 0.06, 0.7, [0.42, 0, 0]); put(g, GEO.halfDisc, i % 2 ? cream : a, [x, 2.38 - Math.sin(0.42) * 0.35 - 0.02, 0.18 + Math.cos(0.42) * 0.35], [sw / 2, 0.025, 0.09], [PI / 2, 0, 0]); } }
      if (o.cv) { box(g, K.m(o.col || '#C2405B'), 0, 2.98, -0.05, 1.7, 0.52, 0.06); put(g, GEO.plane, K.t(o.cv, { alpha: true }), [0, 2.98, -0.015], [1.6, 0.47, 1]).castShadow = false; }
      // товар: горки на прилавке (мелочь — прячется издали), на полках — коробочки
      const k = o.goods || 'apples', N = 6;
      for (let i = 0; i < N; i++) {
        const x = -W / 2 + 0.4 + i * (W - 0.8) / (N - 1), m = goods[i % goods.length], zz = -0.3 + (i % 2) * 0.16;
        if (k === 'paper' || k === 'cards' || k === 'badges') box(g, m, x, 0.99 + (i % 2) * 0.02, zz, 0.26, 0.05 + (i % 2) * 0.03, 0.3, [0, (i % 3 - 1) * 0.2, 0]);
        else if (k === 'bread') put(g, GEO.sphLo, m, [x, 1.03, zz], [0.14, 0.08, 0.1], [0, i, 0]);
        else if (k === 'flowers') { put(g, GEO.cylLo, woodD, [x, 1.04, zz], [0.08, 0.14, 0.08]); sphS(g, m, x, 1.18, zz, 0.12, 0.1, 0.12); }
        else if (k === 'mittens') box(g, m, x, 1.0, zz, 0.18, 0.06, 0.26);
        else { sphS(g, m, x - 0.08, 1.03, zz, k === 'pumpkins' ? 0.12 : 0.085); sphS(g, goods[(i + 1) % goods.length], x + 0.08, 1.03, zz + 0.04, k === 'pumpkins' ? 0.1 : 0.08); }
      }
      [0.98, 1.58].forEach((y, r) => { for (let i = 0; i < 5; i++) box(g, goods[(i + r) % goods.length], -W / 2 + 0.45 + i * (W - 0.9) / 4, y + 0.1, -D + 0.32, 0.24, 0.16, 0.18); });
      [-1, 1].forEach(s => { box(g, woodD, s * (W / 2 + 0.28), 0.2, -0.3, 0.46, 0.4, 0.4); sphS(g, goods[s > 0 ? 1 : 0], s * (W / 2 + 0.28) - 0.1, 0.45, -0.3, 0.09); sphS(g, goods[s > 0 ? 2 % goods.length : 1], s * (W / 2 + 0.28) + 0.1, 0.45, -0.28, 0.09); });
      return g;
    };
    P.garage = (K, o = {}) => {
      const g = new T.Group(), W = o.w || 4, D = o.d || 5, Hh = o.h || 2.5;
      const wall = K.m(o.wall || '#EAD9CC'), trim = K.m('#FFFDF9'), roof = K.m(o.roof || '#B9A3B8'), door = K.m(o.door || '#9FC2A8'), doorD = K.m(H.mixHex(o.door || '#9FC2A8', '#3A2E3F', 0.18));
      rb(g, wall, 0, Hh / 2, -D / 2, W, Hh, D, 0.08);
      put(g, GEO.halfCyl, roof, [0, Hh, -D / 2], [0.8, D + 0.2, W / 2 + 0.12], [0, PI / 2, PI / 2]);   // свод вдоль глубины
      rb(g, trim, 0, Hh + 0.02, 0.02, W + 0.1, 0.1, 0.14, 0.03);
      if (o.open) {
        rb(g, K.m('#5A4E62'), 0, 1.05, 0.0, W - 0.7, 2.1, 0.04, 0.03);
        rb(g, door, 0, 2.08, 0.08, W - 0.6, 0.3, 0.1, 0.03);
        // внутри: полка с банками и тыквой, ящик с инструментами
        rb(g, K.m('#B98C6A'), -W / 2 + 0.75, 1.0, 0.02, 0.8, 0.06, 0.3, 0.02); [K.m('#F08FA8'), K.m('#8FB3D9'), K.m('#F3CF73')].forEach((m, i) => cyl(g, m, -W / 2 + 0.5 + i * 0.25, 1.12, 0.05, 0.06, 0.18));
        rb(g, K.m('#C2405B'), W / 2 - 0.75, 0.2, 0.18, 0.6, 0.36, 0.34, 0.04);
        put(g, GEO.sphLo, K.m('#EE9A55'), [W / 2 - 0.75, 0.48, 0.18], [0.16, 0.12, 0.16]);
      } else {
        rb(g, door, 0, 1.0, 0.02, W - 0.6, 2.0, 0.06, 0.03);
        for (let i = 0; i < 6; i++) box(g, doorD, 0, 0.25 + i * 0.32, 0.06, W - 0.8, 0.035, 0.02);
        rb(g, trim, 0, 0.55, 0.07, 0.36, 0.06, 0.04, 0.015);
      }
      // табличка с номером и фонарик над воротами
      if (o.num) { const [cv, c] = cnv(128, 96); c.fillStyle = '#FFF6EE'; rrect(c, 4, 4, 120, 88, 20); c.fill(); text(c, String(o.num), 64, 50, 56, '#6E6272', { f: 'Comfortaa', w: 700 }); o.numCv = cv; }
      if (o.numCv) put(g, GEO.plane, K.t(o.numCv, { alpha: true }), [W / 2 - 0.42, 2.24, 0.09], [0.36, 0.27, 1]).castShadow = false;
      if (o.cv) { rb(g, K.m(o.col || '#DD7E63'), 0, Hh + 0.62, 0.02, 2.2, 0.62, 0.08, 0.04); put(g, GEO.plane, K.t(o.cv, { alpha: true }), [0, Hh + 0.62, 0.065], [2.08, 0.58, 1]).castShadow = false; }
      sphS(g, K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 }), -W / 2 + 0.4, 2.25, 0.12, 0.09);
      return g;
    };
    P.rental = (K, cv) => {
      const g = new T.Group(), teal = K.m('#8EC3C0'), tealD = K.m('#6BA5A2'), cream = K.m('#FFFDF9');
      rb(g, teal, 0, 0.55, -0.7, 2.2, 1.1, 1.4, 0.08); rb(g, cream, 0, 1.13, -0.6, 2.3, 0.06, 1.6, 0.03);
      [-1, 1].forEach(s => rb(g, tealD, s * 1.04, 1.6, -0.7, 0.1, 1.0, 1.4, 0.03));
      rb(g, K.m('#4F7D7A'), 0, 1.6, -1.35, 2.0, 0.95, 0.06, 0.03);
      rb(g, tealD, 0, 2.15, -0.7, 2.4, 0.14, 1.6, 0.05);
      awning(g, K, 0, 1.98, 0.22, 2.36, 0.6, '#F7B267');
      if (cv) { rb(g, K.m('#DE9A34'), 0, 2.58, -0.4, 1.9, 0.56, 0.06, 0.03); put(g, GEO.plane, K.t(cv, { alpha: true }), [0, 2.58, -0.36], [1.8, 0.52, 1]).castShadow = false; }
      // шлемы на полочке и колесо у стенки
      [K.m('#F08FA8'), K.m('#8FB3D9'), K.m('#F3CF73')].forEach((m, i) => put(g, GEO.hemi, m, [-0.6 + i * 0.6, 1.17, -0.3], [0.14, 0.11, 0.16]));
      put(g, H.ringG(0.32, 0.05), K.m('#584862'), [1.25, 0.36, -0.3], null, [0, PI / 2, 0]);
      return g;
    };
    const stone = K => [K.m('#E2D3CA'), K.m('#CDB9AE'), K.m('#F1E6DE')];
    P.lantern = K => {
      const g = new T.Group(), iron = K.m('#584862'), glow = K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 });
      cyl(g, iron, 0, 0.6, 0, 0.04, 1.2); put(g, GEO.cylLo, glow, [0, 1.32, 0], [0.11, 0.22, 0.11]); put(g, GEO.cone, iron, [0, 1.5, 0], [0.17, 0.14, 0.17]); sphS(g, iron, 0, 1.6, 0, 0.035);
      return g;
    };
    P.gate = (K, o = {}) => {
      const g = new T.Group(), span = o.span || 11.4, [s0, s1, s2] = stone(K), iron = K.m('#584862'), glow = K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 });
      [-1, 1].forEach(sd => {
        const x = sd * span / 2;
        rb(g, s1, x, 0.25, 0, 1.4, 0.5, 1.4, 0.08); rb(g, s0, x, 1.85, 0, 1.1, 2.9, 1.1, 0.1); rb(g, s2, x, 3.38, 0, 1.4, 0.2, 1.4, 0.06); rb(g, s1, x, 3.6, 0, 1.0, 0.26, 1.0, 0.06);
        // камни кладки — светлые пятна на столбе
        for (let i = 0; i < 6; i++) rb(g, i % 2 ? s2 : s1, x + (i % 2 ? 0.2 : -0.18) * sd, 0.8 + i * 0.42, 0.56, 0.42, 0.2, 0.04, 0.02);
        put(g, GEO.cylLo, glow, [x, 4.0, 0], [0.16, 0.34, 0.16]); put(g, GEO.cone, iron, [x, 4.28, 0], [0.26, 0.2, 0.26]); sphS(g, iron, x, 4.42, 0, 0.05);
      });
      // кованая арка: дуга из отрезков, завитки и сердечко посередине
      const N = 16, R0 = span / 2, rise = 1.5;
      for (let i = 0; i < N; i++) {
        const a0 = PI * i / N, a1 = PI * (i + 1) / N, x0 = -Math.cos(a0) * R0, x1 = -Math.cos(a1) * R0, y0 = 3.75 + Math.sin(a0) * rise, y1 = 3.75 + Math.sin(a1) * rise;
        const len = Math.hypot(x1 - x0, y1 - y0); box(g, iron, (x0 + x1) / 2, (y0 + y1) / 2, 0, len + 0.02, 0.07, 0.07, [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
        if (i % 2 === 0 && i > 1 && i < N - 2) cyl(g, iron, (x0 + x1) / 2, ((y0 + y1) / 2 + 3.75) / 2, 0, 0.018, (y0 + y1) / 2 - 3.75);
      }
      box(g, iron, 0, 3.75, 0, span, 0.06, 0.06);
      put(g, H.heartG, K.m('#E58FA6'), [0, 4.95, -0.1], [0.36, 0.36, 1]);
      if (o.cv) { rb(g, K.m('#C2405B'), 0, 4.3, 0.05, 2.4, 0.66, 0.06, 0.03); const m = K.t(o.cv, { alpha: true }); put(g, GEO.plane, m, [0, 4.3, 0.09], [2.3, 0.62, 1]).castShadow = false; put(g, GEO.plane, m, [0, 4.3, 0.01], [2.3, 0.62, 1], [0, PI, 0]).castShadow = false; }
      return g;
    };
    P.parkArch = (K, o = {}) => {
      const g = new T.Group(), span = o.span || 3.4, iron = K.m('#6A5670'), leaf = [K.m('#E98A5F'), K.m('#E9B04F'), K.m('#C4574A'), K.m('#9DA765')];
      [-1, 1].forEach(sd => { cyl(g, iron, sd * span / 2, 1.5, 0, 0.06, 3.0); sphS(g, iron, sd * span / 2, 3.05, 0, 0.09); rb(g, K.m('#E2D3CA'), sd * span / 2, 0.15, 0, 0.4, 0.3, 0.4, 0.05); });
      const N = 12;
      for (let i = 0; i < N; i++) { const a0 = PI * i / N, a1 = PI * (i + 1) / N, x0 = -Math.cos(a0) * span / 2, x1 = -Math.cos(a1) * span / 2, y0 = 3.0 + Math.sin(a0) * 0.9, y1 = 3.0 + Math.sin(a1) * 0.9; box(g, iron, (x0 + x1) / 2, (y0 + y1) / 2, 0, Math.hypot(x1 - x0, y1 - y0) + 0.02, 0.06, 0.06, [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
        put(g, H.blobGeo, leaf[i % 4], [(x0 + x1) / 2, (y0 + y1) / 2 + 0.05, 0.02], [0.24, 0.16, 0.2]); }
      if (o.cv) { const m = K.t(o.cv, { alpha: true }); rb(g, K.m('#76AA62'), 0, 2.62, 0, 1.9, 0.56, 0.06, 0.03); put(g, GEO.plane, m, [0, 2.62, 0.04], [1.8, 0.52, 1]).castShadow = false; put(g, GEO.plane, m, [0, 2.62, -0.04], [1.8, 0.52, 1], [0, PI, 0]).castShadow = false; }
      return g;
    };
    P.bridge = (K, o = {}) => {
      const g = new T.Group(), len = o.len || 8, w = o.w || 2.6, wood = K.m('#D2A274'), woodD = K.m('#B07F55'), rail = K.m('#FFF6EE');
      const n = Math.round(len / 0.32);
      for (let i = 0; i < n; i++) box(g, i % 2 ? wood : woodD, 0, 0.04, -len / 2 + (i + 0.5) * len / n, w, 0.08, len / n - 0.03);
      [-1, 1].forEach(sd => {
        box(g, woodD, sd * (w / 2 - 0.08), -0.04, 0, 0.16, 0.12, len);
        const NP = 7, rise = 0.32;
        for (let i = 0; i <= NP; i++) { const t = i / NP, z = -len / 2 + t * len, h = 0.75 + Math.sin(t * PI) * rise; cyl(g, woodD, sd * (w / 2 - 0.08), h / 2, z, 0.05, h); }
        for (let i = 0; i < 12; i++) { const t0 = i / 12, t1 = (i + 1) / 12, z0 = -len / 2 + t0 * len, z1 = -len / 2 + t1 * len, y0 = 0.8 + Math.sin(t0 * PI) * rise, y1 = 0.8 + Math.sin(t1 * PI) * rise;
          box(g, rail, sd * (w / 2 - 0.08), (y0 + y1) / 2, (z0 + z1) / 2, 0.1, 0.07, Math.hypot(z1 - z0, y1 - y0) + 0.02, [-Math.atan2(y1 - y0, z1 - z0), 0, 0]); }
        // ящики с цветами на середине перил
        rb(g, K.m('#C96F4A'), sd * (w / 2 + 0.06), 0.95, 0, 0.2, 0.16, 0.9, 0.03); [-0.3, -0.1, 0.1, 0.3].forEach((dz, i) => sphS(g, K.m(['#EFA3B5', '#F3CF73', '#F7C9D4', '#E99A6E'][i]), sd * (w / 2 + 0.06), 1.08, dz, 0.075));
      });
      return g;
    };
    P.pier = (K, o = {}) => {
      const g = new T.Group(), len = o.len || 9, w = o.w || 3, wood = K.m('#CFA27A'), woodD = K.m('#A9805C'), post = K.m('#8A6A55'), rope = K.m('#E9D7B9');
      const n = Math.round(len / 0.3);
      for (let i = 0; i < n; i++) box(g, i % 3 ? wood : woodD, 0, -0.02, (i + 0.5) * len / n, w, 0.1, len / n - 0.03);
      // площадка в конце пошире
      box(g, wood, 0, -0.02, len + 1.2, w + 1.8, 0.1, 2.4);
      const posts = [];
      for (let i = 0; i <= 4; i++) { const z = i * len / 4; [-1, 1].forEach(sd => posts.push([sd * (w / 2 - 0.1), z])); }
      [-1, 1].forEach(sd => posts.push([sd * (w / 2 + 0.8), len + 0.1], [sd * (w / 2 + 0.8), len + 2.3])); posts.push([-0.8, len + 2.3], [0.8, len + 2.3]);
      posts.forEach(([x, z]) => { cyl(g, post, x, -0.55, z, 0.09, 2.1); sphS(g, post, x, 0.52, z, 0.1); });
      // канат между столбиками
      for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => { const z0 = i * len / 4, z1 = (i + 1) * len / 4; for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4, sag = t => 0.42 - Math.sin(t * PI) * 0.12; box(g, rope, sd * (w / 2 - 0.1), (sag(t0) + sag(t1)) / 2, z0 + (z1 - z0) * (t0 + t1) / 2, 0.04, 0.04, (z1 - z0) / 4 + 0.02); } });
      // спасательный круг
      put(g, H.ringG(0.26, 0.07), K.m('#F08FA8'), [w / 2 - 0.06, 0.55, len * 0.5], null, [0, PI / 2, 0]);
      for (let k = 0; k < 4; k++) put(g, GEO.box, K.m('#FFFDF9'), [w / 2 - 0.02, 0.55 + Math.sin(k * PI / 2) * 0.26, len * 0.5 + Math.cos(k * PI / 2) * 0.26], [0.05, 0.08, 0.08], [k * PI / 2, 0, 0]);
      return g;
    };
    P.boat = K => {
      const g = new T.Group(), hull = K.m('#F7F0E6'), stripe = K.m('#8FB3D9'), wood = K.m('#C99A6E');
      const sh = new T.Shape(); sh.moveTo(0, -1.3); sh.quadraticCurveTo(0.75, -0.6, 0.62, 0.9); sh.lineTo(-0.62, 0.9); sh.quadraticCurveTo(-0.75, -0.6, 0, -1.3);
      const hg = keep(new T.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 8 })); hg.rotateX(PI / 2); hg.translate(0, 0.35, 0);
      put(g, hg, hull); box(g, stripe, 0, 0.2, 0, 1.3, 0.08, 1.9);
      box(g, wood, 0, 0.34, -0.1, 1.15, 0.06, 0.3); box(g, wood, 0, 0.34, 0.55, 1.0, 0.06, 0.26);
      [-1, 1].forEach(sd => { cyl(g, wood, sd * 0.7, 0.42, 0.1, 0.025, 1.6, [0.35, 0, sd * 1.3]); });
      return g;
    };
    P.duck = K => {
      const g = new T.Group(), body = K.m(['#FFF6EE', '#F3D9A0', '#E9E0D6'][Math.floor(Math.random() * 3)]), bill = K.m('#F0A94B'), ink = K.m('#3A2E3F');
      put(g, GEO.sph, body, [0, 0.13, 0], [0.2, 0.14, 0.26]); put(g, GEO.sph, body, [0, 0.31, 0.15], [0.11, 0.11, 0.11]);
      put(g, GEO.sphLo, bill, [0, 0.29, 0.27], [0.055, 0.025, 0.07]); [-1, 1].forEach(sd => sphS(g, ink, sd * 0.06, 0.34, 0.23, 0.018));
      put(g, GEO.cone, body, [0, 0.2, -0.27], [0.08, 0.14, 0.06], [-1.2, 0, 0]);
      return g;
    };
    P.duckHouse = K => {
      const g = new T.Group(), wood = K.m('#E7C9A9'), roof = K.m('#C98F86'), raft = K.m('#B98C6A');
      rb(g, raft, 0, 0.06, 0, 1.4, 0.12, 1.1, 0.04); rb(g, wood, 0, 0.45, -0.1, 0.8, 0.66, 0.7, 0.05);
      put(g, keep(new T.ExtrudeGeometry(H.triShape(1, 0.5), { depth: 1, bevelEnabled: false })), roof, [0, 0.78, 0.3], [1.0, 0.7, 0.86]);
      put(g, H.extrude(archShape(0.32, 0.4), 0.04), K.m('#5A4E62'), [0, 0.12, 0.26]);
      return g;
    };
    P.telescope = K => {
      const g = new T.Group(), iron = K.m('#6A5670'), brass = K.m('#E8C770'), ink = K.m('#3A2E3F');
      cyl(g, iron, 0, 0.55, 0, 0.06, 1.1); rb(g, iron, 0, 0.05, 0, 0.5, 0.1, 0.5, 0.04); put(g, GEO.sphLo, iron, [0, 1.12, 0], [0.12, 0.1, 0.12]);
      const tube = new T.Group(); tube.position.set(0, 1.2, 0); tube.rotation.x = -0.25; g.add(tube);
      cyl(tube, brass, 0, 0, 0.1, 0.11, 0.7, [PI / 2, 0, 0]); cyl(tube, brass, 0, 0, 0.5, 0.15, 0.18, [PI / 2, 0, 0]); cyl(tube, ink, 0, 0, -0.28, 0.06, 0.1, [PI / 2, 0, 0]);
      [-1, 1].forEach(sd => cyl(tube, iron, sd * 0.15, -0.02, -0.05, 0.02, 0.3, [0, 0, PI / 2]));
      return g;
    };
    P.hurdle = K => { const g = new T.Group(), a = K.m('#F08FA8'), b = K.m('#FFFDF9'); [-1, 1].forEach(sd => { cyl(g, b, sd * 0.6, 0.3, 0, 0.04, 0.6); rb(g, a, sd * 0.6, 0.03, 0, 0.24, 0.06, 0.24, 0.02); }); for (let i = 0; i < 4; i++) cyl(g, i % 2 ? a : b, -0.45 + i * 0.3, 0.38, 0, 0.035, 0.3, [0, 0, PI / 2]); return g; };
    P.tunnel = K => { const g = new T.Group(); const cols = ['#8FB3D9', '#F3CF73', '#9FC2A8', '#F08FA8']; for (let i = 0; i < 6; i++) put(g, GEO.halfCyl, K.m(cols[i % 4]), [0, 0, -1.0 + i * 0.4], [0.42, 0.4, 0.42], [0, PI / 2, PI / 2]); return g; };
    P.ramp = K => { const g = new T.Group(), w = K.m('#E7C9A9'), s = K.m('#F7B267'); [-1, 1].forEach(sd => box(g, w, 0, 0.32, sd * 0.55, 0.9, 0.06, 1.25, [sd * -0.55, 0, 0])); for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => box(g, s, 0, 0.12 + i * 0.13, sd * (0.95 - i * 0.24), 0.9, 0.03, 0.05)); return g; };
    P.bowl = K => { const g = new T.Group(); put(g, GEO.pot, K.m('#8FB3D9'), [0, 0.05, 0], [0.18, 0.1, 0.18], [PI, 0, 0]); put(g, GEO.cylLo, K.m('#BFE0F2', { glow: '#9FD0EE', gi: 0.2 }), [0, 0.09, 0], [0.14, 0.01, 0.14]); return g; };
    P.barrier = (K, cv) => {
      const g = new T.Group(), wd = K.m('#B98C6A'), st = K.m('#FFFDF9'), rd = K.m('#E58FA6');
      [-1.2, 1.2].forEach(dx => [-1, 1].forEach(s => box(g, wd, dx + s * 0.25, 0.4, 0, 0.06, 0.85, 0.06, [0, 0, s * 0.3])));
      for (let i = 0; i < 6; i++) rb(g, i % 2 ? st : rd, -1.0 + i * 0.4, 0.78, 0, 0.4, 0.16, 0.05, 0.02);
      if (cv) { cyl(g, wd, 0, 0.6, -0.1, 0.04, 1.2); rb(g, wd, 0, 1.25, -0.06, 0.8, 0.36, 0.06, 0.03); put(g, GEO.plane, K.t(cv, { alpha: true }), [0, 1.25, -0.02], [0.74, 0.32, 1]).castShadow = false; }
      return g;
    };
    return P;
  };
})();
