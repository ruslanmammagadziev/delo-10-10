/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: игрушки улицы — тележка Жу, табло прогноза, почтовый ящик, лужа-солнце, секретное сердечко.
   Стоят там же, где на улице (те же x/z точек: flowers −3.2, weather 3.1, kiosk 9.6, mailbox 13.6, лавочки 4.4 и 20.4),
   поэтому точки сюжета и прогулки (o.spots) работают в городе без правок. Статика склеена в один кусок.
   anchors[id] — где у точки «предмет» для тапа (x, y, z, r).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  WORLD.makeToys = function (H, scene) {
    const T = H.T, { put, box, sph, sphS, cyl, rbox, cnv, rrect, text, GEO, toon, keep } = H;
    const K = H.makeKitLit();
    const g = new T.Group(); g.name = 'toys'; scene.add(g);
    const anchors = {
      flowers: { x: -3.2, y: 0.8, z: -1.05, r: 0.9 }, weather: { x: 3.1, y: 1.3, z: -1.25, r: 0.7 }, kiosk: { x: 9.6, y: 1.1, z: -0.9, r: 1.0 },
      mailbox: { x: 13.6, y: 0.9, z: -1.3, r: 0.5 }, bench1: { x: 4.4, y: 0.5, z: -1.15, r: 0.8 }, bench2: { x: 20.4, y: 0.5, z: -1.15, r: 0.8 },
    };
    /* --- тележка Жу: ящик на колёсах, вёдра с цветами, полосатый навес --- */
    { const c = new T.Group(); c.position.set(-3.2, 0, -1.05); g.add(c);
      const wood = K.m('#C9946A'), woodD = K.m('#A9744E'), cream = K.m('#FFF6EE'), pink = K.m('#F08FA8'), tin = K.m('#9FB7C4');
      rbox(c, wood, 0, 0.62, 0, 1.3, 0.42, 0.62, 0.05); rbox(c, woodD, 0, 0.4, 0, 1.36, 0.06, 0.68, 0.02);
      [-0.5, 0.5].forEach(x => { cyl(c, K.m('#6A5670'), x, 0.2, 0.33, 0.2, 0.05, [PI / 2, 0, 0]); cyl(c, cream, x, 0.2, 0.36, 0.07, 0.02, [PI / 2, 0, 0]); });
      cyl(c, woodD, -0.78, 0.7, 0, 0.025, 0.5, [0, 0, PI / 2]);
      const FL = ['#F08FA8', '#F3CF73', '#C7A8DD', '#EFA3B5', '#F7B267', '#FFFDF9'];
      [-0.42, -0.14, 0.14, 0.42].forEach((x, i) => { cyl(c, tin, x, 0.92, -0.05, 0.11, 0.2); for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; sphS(c, K.m(FL[(i + k) % FL.length]), x + Math.cos(a) * 0.07, 1.1 + (k % 2) * 0.05, -0.05 + Math.sin(a) * 0.07, 0.06); } sphS(c, K.m('#8FAE62'), x, 1.04, -0.05, 0.09); });
      [-0.55, 0.55].forEach(x => cyl(c, woodD, x, 1.25, -0.28, 0.022, 1.3));
      for (let i = 0; i < 6; i++) rbox(c, i % 2 ? cream : pink, -0.6 + i * 0.24, 1.86, -0.12, 0.24, 0.05, 0.62, 0.02, [0.32, 0, 0]);
      const [cv, cx] = cnv(256, 80); cx.fillStyle = '#FFF6EE'; rrect(cx, 2, 2, 252, 76, 20); cx.fill(); text(cx, 'цветы от Жу', 128, 42, 34, '#C2405B', { f: 'Comfortaa', w: 700, max: 230 });
      put(c, GEO.plane, K.t(cv, { alpha: true }), [0, 0.62, 0.315], [0.9, 0.28, 1]); }
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
    /* --- пчёлка Жу над тележкой (живая) --- */
    const bee = new T.Group(); bee.position.set(-2.55, 1.55, -0.95); scene.add(bee);
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
      const u = bee.userData; bee.position.y = 1.55 + Math.sin(t * 2.2) * 0.08; bee.position.x = -2.55 + Math.sin(t * 0.7) * 0.25; bee.rotation.y = Math.sin(t * 0.7) * 0.6 + 0.3;
      u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 38) * 0.5; });
      if (secret) secret.rotation.y = t * 1.6;
    }
    return { anchors, puddle, bee, update, setSecret, secretPos: () => (secret ? secret.position : null) };
  };
})();
