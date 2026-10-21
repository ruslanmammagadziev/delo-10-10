/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: игрушки улицы — цветочный бутик Жу, табло прогноза, почтовый ящик, лужа-солнце, секретное сердечко.
   Табло, киоск, ящик и лавочки стоят там же, где на улице (те же x/z точек: weather 3.1, kiosk 9.6, mailbox 13.6,
   лавочки 4.4 и 20.4), поэтому точки сюжета и прогулки (o.spots) работают в городе без правок. Бутик Жу — по L.flowerShop
   (map.js): там же его коллайдеры, а точку «Букет» под него переносит main.js. Статика склеена в один кусок.
   anchors[id] — где у точки «предмет» для тапа (x, y, z, r).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  WORLD.makeToys = function (H, scene, L) {
    const T = H.T, { put, box, sph, sphS, cyl, rbox, cnv, rrect, text, GEO, toon, keep } = H;
    const K = H.makeKitLit();
    const g = new T.Group(); g.name = 'toys'; scene.add(g);
    const FS = (L && L.flowerShop) || { x: -3.2, z: -1.05, ry: 0, anchor: { x: -3.2, y: 0.8, z: -1.05, r: 0.9 } };
    const anchors = {
      flowers: FS.anchor, weather: { x: 3.1, y: 1.3, z: -1.25, r: 0.7 }, kiosk: { x: 9.6, y: 1.1, z: -0.9, r: 1.0 },
      mailbox: { x: 13.6, y: 0.9, z: -1.3, r: 0.5 }, bench1: { x: 4.4, y: 0.5, z: -1.15, r: 0.8 }, bench2: { x: 20.4, y: 0.5, z: -1.15, r: 0.8 },
    };
    /* --- цветочный бутик Жу: розовый павильон 2,4 × 1,6 м, прилавок с вёдрами, стойки-лесенки по бокам, полосатый навес,
       большая двусторонняя вывеска «ЦВЕТЫ» на крыше и круглая табличка к дороге (обе не темнеют ночью — «подсвечены»).
       Локально перед — +z, ширина — по x; в мире павильон повёрнут на FS.ry --- */
    const shop = new T.Group(); shop.position.set(FS.x, 0, FS.z); shop.rotation.y = FS.ry; g.add(shop);
    { const c = shop;
      const wall = K.m('#F7C6D1'), cream = K.m('#FFF6EE'), wood = K.m('#C9946A'), woodD = K.m('#A9744E'), pink = K.m('#F08FA8'),
        berry = K.m('#C2405B'), tin = K.m('#9FB7C4'), leaf = K.m('#8FAE62'), glass = K.m('#CFE6F0');
      const FL = ['#F08FA8', '#F3CF73', '#C7A8DD', '#EFA3B5', '#F7B267', '#FFFDF9', '#E8789A'];
      // цветок — икосаэдр в 20 треугольников (сфера — 110): букетиков в бутике ~45, иначе это +24 тыс. треугольников с тенью
      const petalG = keep(new T.IcosahedronGeometry(1, 0)), dot = (m, x, y, z, s) => put(c, petalG, m, [x, y, z], [s, s, s]);
      const bunch = (x, y, z, r, n, i0) => { for (let k = 0; k < n; k++) { const a = k / n * PI * 2; dot(K.m(FL[(i0 + k) % FL.length]), x + Math.cos(a) * r, y + (k % 2) * 0.045, z + Math.sin(a) * r, r * 0.95); } dot(leaf, x, y - 0.06, z, r * 1.3); };
      rbox(c, K.m('#EADBD0'), 0, 0.06, 0, 2.5, 0.12, 1.7, 0.04);                                  // подиум
      rbox(c, wall, 0, 1.27, -0.45, 2.4, 2.3, 0.7, 0.06);                                        // задняя часть с полками
      [-1, 1].forEach(s => { rbox(c, wall, s * 1.08, 1.27, 0.15, 0.24, 2.3, 1.1, 0.05);          // боковые стенки
        rbox(c, cream, s * 1.2, 1.27, 0.7, 0.12, 2.3, 0.12, 0.03);                               // белые угловые стойки
        box(c, cream, s * 1.205, 1.5, 0.12, 0.03, 0.84, 0.84); box(c, glass, s * 1.215, 1.5, 0.12, 0.02, 0.7, 0.7);   // окошко в белой раме
        box(c, cream, s * 1.22, 1.5, 0.12, 0.02, 0.7, 0.04); box(c, cream, s * 1.22, 1.5, 0.12, 0.02, 0.04, 0.7);     // переплёт
        box(c, wood, s * 1.3, 1.02, 0.12, 0.2, 0.16, 0.86);                                   // ящик с цветами под окном
        [-0.3, -0.1, 0.1, 0.3].forEach((z, i) => bunch(s * 1.3, 1.18, 0.12 + z, 0.05, 5, i + (s > 0 ? 2 : 0))); });
      [1.3, 1.78].forEach((y, r) => { box(c, cream, 0, y, -0.06, 1.9, 0.05, 0.26);        // полки с банками цветов
        for (let i = 0; i < 6; i++) { const x = -0.8 + i * 0.32; cyl(c, K.m(i % 2 ? '#BFD8EA' : '#F3E3C9'), x, y + 0.1, -0.06, 0.06, 0.16); bunch(x, y + 0.25, -0.06, 0.045, 5, i * 2 + r); } });
      rbox(c, wood, 0, 0.48, 0.45, 1.6, 0.96, 0.5, 0.05); rbox(c, cream, 0, 0.98, 0.47, 1.7, 0.06, 0.56, 0.02);   // прилавок
      box(c, pink, 0, 0.56, 0.705, 1.3, 0.46, 0.02);
      [-0.55, -0.22, 0.6].forEach((x, i) => { cyl(c, tin, x, 1.11, 0.42, 0.1, 0.2); bunch(x, 1.3, 0.42, 0.07, 6, i); });   // вёдра на прилавке
      [-1, 1].forEach(s => [0, 1, 2].forEach(t => {                                              // стойки-лесенки по бокам
        const x0 = s * 0.88, y = 0.22 + t * 0.32, z = 1.0 - t * 0.13;
        box(c, woodD, x0, y, z, 0.52, 0.05, 0.3);
        [-0.13, 0.13].forEach((dx, j) => { cyl(c, tin, x0 + dx, y + 0.12, z, 0.08, 0.18); bunch(x0 + dx, y + 0.29, z, 0.055, 5, t * 2 + j + (s > 0 ? 3 : 0)); });
      }));
      for (let i = 0; i < 10; i++) box(c, i % 2 ? cream : pink, -1.17 + i * 0.26, 2.2, 0.98, 0.26, 0.05, 0.64, [0.42, 0, 0]);   // навес
      for (let i = 0; i < 10; i++) put(c, GEO.sphLo || GEO.sph, i % 2 ? cream : pink, [-1.17 + i * 0.26, 2.04, 1.27], [0.13, 0.07, 0.03]);       // фестон
      rbox(c, cream, 0, 2.45, -0.1, 2.6, 0.12, 1.5, 0.04);                                        // крыша
      const glow = m => { m.userData.dn = 'none'; return m; };
      // вывеска на крыше: видна со старта и с обеих сторон улицы
      const [cv, cx] = cnv(512, 160);
      cx.fillStyle = '#FFF6EE'; rrect(cx, 4, 4, 504, 152, 30); cx.fill(); cx.lineWidth = 8; cx.strokeStyle = '#C2405B'; rrect(cx, 12, 12, 488, 136, 24); cx.stroke();
      text(cx, 'ЦВЕТЫ', 256, 68, 76, '#C2405B', { f: 'Comfortaa', w: 700, max: 330 });
      text(cx, 'бутик пчёлки Жу', 256, 124, 30, '#8A5A6E', { f: 'Comfortaa', w: 700, max: 340 });
      [[62, 80, '#F08FA8'], [450, 80, '#F3CF73']].forEach(([fx, fy, col]) => { cx.fillStyle = col; for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; cx.beginPath(); cx.arc(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18, 13, 0, 7); cx.fill(); } cx.fillStyle = '#C2405B'; cx.beginPath(); cx.arc(fx, fy, 11, 0, 7); cx.fill(); });
      const signM = glow(K.t(cv));
      rbox(c, berry, 0, 2.86, 0.2, 2.2, 0.66, 0.06, 0.05);
      put(c, GEO.plane, signM, [0, 2.86, 0.235], [2.1, 0.62, 1]); put(c, GEO.plane, signM, [0, 2.86, 0.165], [2.1, 0.62, 1], [0, PI, 0]);
      [-1, 1].forEach(s => { const fx = s * 1.24; for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; put(c, GEO.sphLo || GEO.sph, K.m(s < 0 ? '#FFFDF9' : '#F3CF73'), [fx + Math.cos(a) * 0.17, 2.98 + Math.sin(a) * 0.17, 0.24], [0.1, 0.1, 0.04]); }
        put(c, GEO.sphLo || GEO.sph, K.m(s < 0 ? '#F3CF73' : '#C2405B'), [fx, 2.98, 0.27], [0.1, 0.1, 0.06]); });
      // круглая табличка-«флажок» к дороге: букет и «цветы»
      const [bv, bx] = cnv(256, 256);
      bx.fillStyle = '#FFF6EE'; bx.beginPath(); bx.arc(128, 128, 122, 0, 7); bx.fill(); bx.lineWidth = 10; bx.strokeStyle = '#C2405B'; bx.stroke();
      [[100, 92, '#F08FA8'], [156, 92, '#F3CF73'], [128, 70, '#C7A8DD']].forEach(([fx, fy, col]) => { bx.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; bx.beginPath(); bx.arc(fx + Math.cos(a) * 14, fy + Math.sin(a) * 14, 11, 0, 7); bx.fill(); } bx.fillStyle = '#FFFDF9'; bx.beginPath(); bx.arc(fx, fy, 8, 0, 7); bx.fill(); });
      bx.strokeStyle = '#8FAE62'; bx.lineWidth = 7; [[100, 104], [156, 104], [128, 84]].forEach(([fx, fy]) => { bx.beginPath(); bx.moveTo(fx, fy); bx.lineTo(128, 150); bx.stroke(); });
      bx.fillStyle = '#F08FA8'; bx.beginPath(); bx.moveTo(104, 140); bx.lineTo(152, 140); bx.lineTo(136, 168); bx.lineTo(120, 168); bx.closePath(); bx.fill();
      text(bx, 'цветы', 128, 202, 40, '#C2405B', { f: 'Comfortaa', w: 700, max: 200 });
      const bladeM = glow(K.t(bv, { alpha: true }));
      cyl(c, woodD, 1.36, 2.32, 0.7, 0.02, 0.36, [0, 0, PI / 2]);
      put(c, GEO.plane, bladeM, [1.5, 1.98, 0.7], [0.62, 0.62, 1], [0, PI / 2, 0]); put(c, GEO.plane, bladeM, [1.49, 1.98, 0.7], [0.62, 0.62, 1], [0, -PI / 2, 0]); }
    /* --- табло прогноза --- */
    { const b = new T.Group(); b.position.set(3.15, 0, -1.4); g.add(b);
      cyl(b, K.m('#6A5670'), -0.36, 0.75, 0, 0.03, 1.5); cyl(b, K.m('#6A5670'), 0.36, 0.75, 0, 0.03, 1.5);
      rbox(b, K.m('#5E7A8E'), 0, 1.38, 0, 0.92, 0.56, 0.06, 0.04);
      const [cv, cx] = cnv(256, 160); cx.fillStyle = '#EAF2F8'; rrect(cx, 0, 0, 256, 160, 18); cx.fill();
      text(cx, 'ПРОГНОЗ', 128, 34, 30, '#5E7A8E', { w: 900 });
      cx.fillStyle = '#B8C6D6'; [[96, 92, 26], [128, 80, 32], [160, 94, 24]].forEach(([x, y, r]) => { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }); cx.fillRect(72, 92, 112, 26);
      cx.fillStyle = '#9EC4E8'; [[92, 132], [124, 140], [156, 132]].forEach(([x, y]) => { cx.beginPath(); cx.ellipse(x, y, 4, 7, 0.3, 0, 7); cx.fill(); });
      put(b, GEO.plane, K.t(cv), [0, 1.38, 0.035], [0.84, 0.5, 1]); }
    /* --- почтовый ящик --- */
    { const m = new T.Group(); m.position.set(13.6, 0, -1.35); g.add(m);
      cyl(m, K.m('#6A5670'), 0, 0.42, 0, 0.035, 0.84); rbox(m, K.m('#7FA6C9'), 0, 0.98, 0, 0.34, 0.42, 0.26, 0.08);
      rbox(m, K.m('#FFF6EE'), 0, 1.06, 0.135, 0.2, 0.04, 0.02, 0.01); put(m, H.heartG ? H.heartG : GEO.sph, K.m('#F08FA8'), [0, 0.9, 0.135], [0.05, 0.05, 0.02]); }
    /* --- лужа-солнце у кондитерской: прыгнуть — брызги и строчка --- */
    const puddle = { x: 18.2, z: 0.8, r: 0.6 };
    { const pg = keep(new T.CircleGeometry(1, 28)); pg.rotateX(-PI / 2);
      const pm = toon('#BFD8EA', { emissive: new T.Color('#9EC4E8'), emissiveIntensity: 0.25 });
      const p = put(g, pg, pm, [puddle.x, 0.02, puddle.z], [0.72, 1, 0.5]); p.castShadow = false;
      const sun = put(g, pg, toon('#FFE08A', { emissive: new T.Color('#FFC94D'), emissiveIntensity: 0.5 }), [puddle.x + 0.12, 0.025, puddle.z - 0.05], [0.14, 1, 0.1]); sun.castShadow = false; }
    H.mergeChunk(g, { cast: true });
    /* --- пчёлка Жу у прилавка бутика (живая): летает вдоль витрины под навесом --- */
    shop.updateMatrixWorld(true);
    // база — сбоку от точки «Букет» (локально x 0,75): не над головой героини у прилавка
    const beeBase = shop.localToWorld(new T.Vector3(0.75, 1.72, 0.95)), beeAxis = new T.Vector3(1, 0, 0).applyQuaternion(shop.quaternion);
    const bee = new T.Group(); bee.position.copy(beeBase); scene.add(bee);
    { const yel = toon('#FFD45E'), ink = toon('#3A2E3F'), wingM = keep(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7, depthWrite: false }));
      const body = new T.Group(); bee.add(body);
      put(body, GEO.sph, yel, [0, 0, 0], [0.14, 0.12, 0.17]);
      [-0.05, 0.05].forEach(z => put(body, GEO.sph, ink, [0, 0, z], [0.142, 0.122, 0.03]));
      put(body, GEO.sph, yel, [0, 0.06, 0.15], [0.1, 0.1, 0.1]);
      [-1, 1].forEach(s => { put(body, GEO.sphLo || GEO.sph, ink, [s * 0.04, 0.09, 0.23], [0.018, 0.022, 0.012]); });
      const wings = [-1, 1].map(s => { const w = put(body, GEO.sph, wingM, [s * 0.12, 0.14, -0.02], [0.12, 0.02, 0.07]); w.castShadow = false; return w; });
      bee.userData = { body, wings }; }
    /* --- секретное сердечко у киоска (если o.secretAvailable) --- */
    let secret = null;
    const setSecret = on => {
      if (on && !secret) {
        const hs = new T.Shape(); hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.9, 0.1, -0.6, 0.85, 0, 0.45); hs.bezierCurveTo(0.6, 0.85, 0.9, 0.1, 0, -0.5);
        const hg = keep(new T.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 12 })); hg.center();
        secret = new T.Mesh(hg, toon('#A98BE8', { emissive: new T.Color('#7E5FD0'), emissiveIntensity: 0.35 }));
        secret.scale.setScalar(0.14); secret.position.set(9.6 + 0.62, 1.15, -1.1 + 0.42); secret.castShadow = true; scene.add(secret);
      } else if (!on && secret) { scene.remove(secret); secret = null; }
    };
    function update(t) {
      const u = bee.userData, sw = Math.sin(t * 0.7) * 0.25;
      bee.position.set(beeBase.x + beeAxis.x * sw, beeBase.y + Math.sin(t * 2.2) * 0.08, beeBase.z + beeAxis.z * sw); bee.rotation.y = FS.ry + Math.sin(t * 0.7) * 0.6 + 0.3;
      u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 38) * 0.5; });
      if (secret) secret.rotation.y = t * 1.6;
    }
    return { anchors, puddle, bee, update, setSecret, secretPos: () => (secret ? secret.position : null) };
  };
})();
