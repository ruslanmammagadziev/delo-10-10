/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: дальний вид на востоке — хребты и село мастеров на склоне (желание автора: со стартового кадра
   за домами видно, куда ведёт дорога из города).
   Слой неба, а не часть города: своя маленькая сцена «на бесконечности» рисуется ДО города (камера в её центре
   поворачивается вместе с камерой города, но не двигается), потом глубина очищается и поверх рисуется город. Поэтому
   горы видны при любом качестве — их не обрезает дальность камеры (52–105 м) и не съедает туман города; дальняя
   земля, ушедшая в туман, ложится на подножие как дымка. Небо — CSS за прозрачным холстом (как и было).
   Состав (оси города: +x — восток, −z — север; азимут a — от востока к северу, высота e — угол над горизонтом):
     дальний хребет (сиреневый, снег на высоких вершинах) · средний хребет (сизый) · гора села (осенняя, полосы террас) ·
     село: дома рядами вверх по склону («амфитеатром»), плоские крыши, окна, деревянные балконы, наверху башня.
   Цвета — дневные, заранее смешанные с дымкой; вечер и ночь — общий грейд js/daynight.js (dn.attach(far.root)),
   окна — вид 'window' (теплеют к ночи; часть окон всегда тёмная).
   4 вызова отрисовки (хребты · дома · окна горящие · окна тёмные), ≈ 4,5 тыс. треугольников.

   API
     WORLD.makeFarView({ THREE, center? (азимут села, градусы; по умолчанию 1) }) → far:
       far.root (Group — для dn.attach), far.windows (материал окон — для dn.addWindows), far.scene, far.visible
       far.render(renderer, camera) — нарисовать слой (до города; renderer.autoClear выключает и чистит тот, кто зовёт)
       far.info() → { tris, calls }, far.dispose()
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  // детерминированный шум (одинаковый вид на всех устройствах)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const HAZE = hex('#E7DDE3');   // дневная дымка у горизонта (тёплая сирень — как низ CSS-неба)
  const C = {
    far: hex('#B7AFCF'), farLo: hex('#D3C9D9'), snow: hex('#F5F2F7'),
    mid: hex('#93A8B3'), midLo: hex('#C6C6CF'),
    hill: hex('#A0A68F'), hillHi: hex('#909E8C'), terrA: hex('#B0B296'), terrB: hex('#9CA188'), hillLo: hex('#C9C8B8'),
    stone: ['#DCCDB5', '#D2C2A8', '#E5D8C3', '#CBBBA2', '#E9D2C6', '#D8CBB9'].map(hex), roof: hex('#9B8873'),
    tower: hex('#BBA88E'), win: hex('#4F475E'), wood: hex('#7C5C49'),
  };

  WORLD.makeFarView = function (o = {}) {
    const T = o.THREE || window.THREE;
    const A0 = o.center == null ? 1 : o.center;   // село над концом Октябрьской (там над улицей открыто небо)
    const scene = new T.Scene(), root = new T.Group(); root.name = 'farView'; scene.add(root);
    const cam = new T.PerspectiveCamera(58, 1, 10, 6000);
    const R0 = rng(1010);
    // всё — на цилиндрах вокруг зрителя: по горизонтали радиус R, высота y = R·tg(e) (угол над горизонтом — ровно e)
    const yOf = (e, R) => R * Math.tan(e * D2R);

    /* ---------- хребты: «занавес» по дуге (сетка азимут × высота), цвет — функция высоты ---------- */
    const P = [], CL = [], IX = [];
    function curtain(R, a0, a1, na, rows, top, col, eBase) {
      const v0 = P.length / 3;
      for (let i = 0; i <= na; i++) {
        const a = a0 + (a1 - a0) * i / na, eT = top(a);
        for (let j = 0; j <= rows; j++) {
          const t = j / rows, e = eBase + (eT - eBase) * t;
          P.push(R * Math.cos(a * D2R), yOf(e, R), -R * Math.sin(a * D2R));
          const c = col(a, t, e, eT); CL.push(c[0], c[1], c[2]);
        }
      }
      for (let i = 0; i < na; i++) for (let j = 0; j < rows; j++) {
        const a = v0 + i * (rows + 1) + j, b = a + rows + 1;
        IX.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const peaks = (a, list, base) => list.reduce((m, [c, w, h]) => Math.max(m, base + h * Math.pow(Math.max(0, 1 - Math.abs(a - c) / w), 1.6)), base);
    const wob = (a, k, s) => Math.sin(a * k + s) * 0.35 + Math.sin(a * k * 2.7 + s * 1.7) * 0.18;
    // дальний хребет: высокие вершины, на самых высоких — снег
    const farTop = a => peaks(a, [[-24, 16, 6.2], [-6, 12, 4.6], [18, 14, 7.8], [34, 12, 6.6], [52, 16, 5.4]], 2.4) + wob(a, 0.21, 1);
    curtain(1900, -50, 66, 116, 3, farTop, (a, t, e, eT) => {
      const snow = eT > 7 && e > eT - 0.9 - 0.35 * Math.sin(a * 1.3) ? 1 : 0;
      const c = mix(C.farLo, C.far, sst(0, 1, t));
      return mix(mix(c, C.snow, snow * 0.92), HAZE, 0.42);
    }, -7);
    // средний хребет
    const midTop = a => peaks(a, [[-34, 18, 3.3], [-12, 14, 2.4], [44, 18, 3.6]], 0.6) + wob(a, 0.33, 4);
    curtain(1600, -52, 68, 96, 2, midTop, (a, t) => mix(mix(C.midLo, C.mid, t), HAZE, 0.3), -7);
    // гора села: широкое плечо, вершина над селом; полосы террас по склону
    const hillTop = a => peaks(a, [[A0 + 1, 26, 12.6], [A0 + 22, 14, 3.4]], -0.6) + wob(a, 0.5, 2) * 0.6;
    curtain(1250, A0 - 34, A0 + 40, 92, 14, hillTop, (a, t, e, eT) => {
      const band = Math.floor((e + 7) / 0.62 + Math.sin(a * 0.9) * 0.6) % 2 ? C.terrA : C.terrB;
      const terr = e < eT - 1.4 ? 1 : 0;
      const c = mix(terr ? band : C.hillHi, C.hill, terr ? 0.25 : 0.4);
      return mix(mix(c, C.hillLo, sst(0.25, 0, t) * 0.5), HAZE, 0.14);
    }, -7);
    const ridgeGeo = new T.BufferGeometry();
    ridgeGeo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    ridgeGeo.setAttribute('color', new T.Float32BufferAttribute(CL, 3));
    ridgeGeo.setIndex(IX);
    const ridgeMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
    root.add(new T.Mesh(ridgeGeo, ridgeMat));

    /* ---------- село: коробки-дома лицом к зрителю, ряд за рядом вверх по склону ---------- */
    const HP = [], HC = [], HI = [];
    // окна: горящие ночью (вид 'window') и всегда тёмные (вид 'world': балконы и часть окон) — два набора
    const WIN = { lit: { P: [], C: [], I: [] }, dark: { P: [], C: [], I: [] } };
    // коробка у азимута a: низ на высоте e0, ширина/высота/глубина в градусах; лицом к центру
    function house(a, e0, R, wd, hd, dd, col, roof) {
      const u = [Math.cos(a * D2R), 0, -Math.sin(a * D2R)], tg = [Math.sin(a * D2R), 0, Math.cos(a * D2R)];
      const w = yOf(wd, R) / 2, d = yOf(dd, R) / 2, y0 = yOf(e0, R), y1 = yOf(e0 + hd, R);
      const cx = u[0] * R, cz = u[2] * R;
      const pt = (s, f, y) => [cx + tg[0] * w * s + u[0] * d * f, y, cz + tg[2] * w * s + u[2] * d * f];
      const quad = (p, c) => { const b = HP.length / 3; p.forEach(q => { HP.push(q[0], q[1], q[2]); HC.push(c[0], c[1], c[2]); }); return b; };
      const faces = [];
      faces.push([[pt(-1, -1, y0), pt(1, -1, y0), pt(1, -1, y1), pt(-1, -1, y1)], col]);                 // лицо
      faces.push([[pt(1, -1, y0), pt(1, 1, y0), pt(1, 1, y1), pt(1, -1, y1)], mul(col, 0.84)]);          // бок
      faces.push([[pt(-1, 1, y0), pt(-1, -1, y0), pt(-1, -1, y1), pt(-1, 1, y1)], mul(col, 0.9)]);       // бок
      faces.push([[pt(-1.06, -1.08, y1), pt(1.06, -1.08, y1), pt(1.06, 1, y1), pt(-1.06, 1, y1)], roof]); // плоская крыша
      faces.forEach(([p, c]) => { const b = quad(p, c); HI.push(b, b + 1, b + 2, b, b + 2, b + 3); });
      return { u, tg, w, d, y0, y1, cx, cz };
    }
    // окно на лице дома: доля по ширине s (−1…1) и по высоте v (0…1), размер в долях; lit — светится ночью
    function windowOn(hs, s, v, ws, vs, lit, col) {
      const { u, tg, w, d, y0, y1, cx, cz } = hs, f = -d - yOf(0.006, 1000), W = lit ? WIN.lit : WIN.dark;
      const yA = y0 + (y1 - y0) * (v - vs / 2), yB = y0 + (y1 - y0) * (v + vs / 2), sA = (s - ws / 2) * w, sB = (s + ws / 2) * w;
      const p = (ss, y) => [cx + tg[0] * ss + u[0] * f, y, cz + tg[2] * ss + u[2] * f];
      const b = W.P.length / 3;
      [p(sA, yA), p(sB, yA), p(sB, yB), p(sA, yB)].forEach(q => { W.P.push(q[0], q[1], q[2]); W.C.push(col[0], col[1], col[2]); });
      W.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const R1 = 1060, ROWS = 7, E0 = -1.4, DE = 0.86;
    for (let r = 0; r < ROWS; r++) {
      const e0 = E0 + r * DE, R = R1 + r * 16, half = 8.2 - r * 0.85 + (r % 2) * 0.3;
      let a = A0 - half + R0() * 0.4;
      while (a < A0 + half) {
        const wd = 1.0 + R0() * 0.55, hd = 0.78 + R0() * 0.42 + (r === 0 ? 0.15 : 0), col = mix(C.stone[Math.floor(R0() * C.stone.length)], HAZE, 0.08);
        const hs = house(a + wd / 2, e0 + (R0() - 0.5) * 0.12, R, wd, hd, 0.9, col, mix(C.roof, HAZE, 0.1));
        const nW = wd > 1.05 ? 3 : 2;
        for (let k = 0; k < nW; k++) {
          const s = nW === 3 ? -0.55 + k * 0.55 : -0.4 + k * 0.8;
          windowOn(hs, s, 0.6, 0.2, 0.3, R0() < 0.45 ? 1 : 0, C.win);
        }
        if (R0() < 0.35) windowOn(hs, 0, 0.18, 1.1, 0.08, 0, mix(C.wood, HAZE, 0.05));   // деревянный балкон
        a += wd + 0.08 + R0() * 0.22;
      }
    }
    // башня над селом
    { const tw = house(A0 + 2.6, E0 + ROWS * DE - 0.35, R1 + ROWS * 16 + 8, 0.72, 2.4, 0.7, mix(C.tower, HAZE, 0.08), mix(C.roof, HAZE, 0.1));
      windowOn(tw, 0, 0.78, 0.3, 0.1, 1, C.win); windowOn(tw, 0, 0.52, 0.22, 0.08, 0, C.win); }
    const houseGeo = new T.BufferGeometry();
    houseGeo.setAttribute('position', new T.Float32BufferAttribute(HP, 3));
    houseGeo.setAttribute('color', new T.Float32BufferAttribute(HC, 3));
    houseGeo.setIndex(HI);
    const houseMat = new T.MeshBasicMaterial({ vertexColors: true });
    root.add(new T.Mesh(houseGeo, houseMat));
    // окна: горящие ночью — вид 'window' (тёплый свет к ночи, dn.addWindows), тёмные — общий грейд
    const winMesh = (W, kind) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(W.P, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(W.C, 3));
      g.setIndex(W.I);
      const m = new T.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.userData.dn = kind;
      root.add(new T.Mesh(g, m));
      return [g, m];
    };
    const [litGeo, winMat] = winMesh(WIN.lit, 'window'), [darkGeo, darkMat] = winMesh(WIN.dark, 'world');
    root.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.matrixAutoUpdate = false; m.updateMatrix(); } });

    const tris = (IX.length + HI.length + WIN.lit.I.length + WIN.dark.I.length) / 3;
    const far = {
      scene, root, windows: winMat, visible: true,
      render(renderer, camera) {
        if (!far.visible) return;
        if (cam.fov !== camera.fov || cam.aspect !== camera.aspect) { cam.fov = camera.fov; cam.aspect = camera.aspect; cam.updateProjectionMatrix(); }
        camera.getWorldQuaternion(cam.quaternion);
        renderer.render(scene, cam);
      },
      info: () => ({ tris, calls: 4 }),
      dispose() { [ridgeGeo, houseGeo, litGeo, darkGeo].forEach(g => g.dispose()); [ridgeMat, houseMat, winMat, darkMat].forEach(m => m.dispose()); },
    };
    return far;
  };
})();
