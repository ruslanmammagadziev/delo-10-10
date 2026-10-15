/* =====================================================================
   3D-КОМНАТА: кондитерская «Сахарная пудра».
   Розовые полоски, мятные панели, с карниза стекает глазурь. Витрина
   с пирожными, на ней три свидетеля (синнабон, макарон, бабл-ти); за ней
   зайка-кондитер, кофемашина, банки, стеклянный колпак с тортиком,
   бабл-ти-станция и часы-вишенка. Меню-доска, столик у окна с полосатыми
   шторами, трёхъярусный торт, пуделиха Пудра спит на подушке.
   ===================================================================== */
(function () {
  if (!window.City3D || !City3D.registerRoom) return;
  City3D.registerRoom('sweets', {
    look: { sky: '#FBEFF2', gnd: '#D9A7A0', hi: 0.64, sun: '#FFE2D0', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #5C2C46 0%, #33202C 72%)', rim: ['#FFD6CC', 0.22], fog: '#33202C' },
    cam: { portrait: { dx: 0, y: 7.4, dz: 6.2, ly: 0.7, lz: -3.1, fov: 60 }, landscape: { dx: 0.2, y: 4.1, dz: 7.2, ly: 1.35, lz: -2.4, fov: 48 } },
    build(R) {
      const { T, PI, group: g, put, box, cyl, GEO } = R;
      const W = 9, D = 6.5, H = 3.6;
      const HEX = {
        pink: '#F6C6D0', pinkD: '#E7A6B6', cream: '#FFFDF9', cherry: '#C2405B', stripe: '#F08FA8', rose: '#F3A2B6',
        mint: '#BFE6D3', mintL: '#D3F0E2', lav: '#C9B6F0', lavL: '#E2D8FA', caramel: '#E7B47C', caramelD: '#C88D52',
        white: '#FFFFFF', berry: '#E2405E', leaf: '#8FC48A', leafD: '#6FA375', ink: '#4A3A48', butter: '#F7DE8E',
      };
      const mm = {}; Object.keys(HEX).forEach(k => { mm[k] = R.pm(HEX[k]); }); // близкие оттенки — один материал (меньше вызовов отрисовки)
      mm.choc = mm.caramelD; mm.lavL = mm.lav; mm.rose = mm.stripe; mm.berry = mm.cherry; mm.white = mm.cream; mm.leafD = mm.leaf; mm.ink = mm.caramelD;
      const gold = R.toon('#E8C770', { emissive: new T.Color('#B8903A'), emissiveIntensity: 0.12 });
      const glass = R.toon('#F4FBFF', { transparent: true, opacity: 0.22, depthWrite: false });
      const hidden = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const haloM = R.keep(new T.MeshBasicMaterial({ map: R.haloTex, color: new T.Color('#FFD2A0'), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6, fog: false }));
      // венок и бра — из палитры комнаты (меньше вызовов отрисовки)
      const KMAP = { '#C2405B': mm.cherry, '#F08FA8': mm.stripe, '#5B4A63': mm.ink, '#FFE3A3': mm.butter };
      const K = { lit: true, m: c => KMAP[c] || R.pm(c) };

      const st = new T.Group(); g.add(st);   // мебель, посуда, настенный декор: отбрасывают тени
      const sw = new T.Group(); g.add(sw);   // пол, стены, панели, лампы, стекло, ореолы: без теней

      /* ---------- мелкие помощники ---------- */
      const dotG = R.keep(new T.SphereGeometry(1, 8, 6)), tinyG = R.keep(new T.SphereGeometry(1, 6, 4));
      const dot = (par, m, x, y, z, sx, sy = sx, sz = sx) => put(par, Math.max(sx, sy, sz) < 0.03 ? tinyG : dotG, m, [x, y, z], [sx, sy, sz]);
      const halfG = R.keep(new T.CylinderGeometry(1, 1, 1, 7, 1, false, -PI / 2, PI));
      const discG = R.keep(new T.CylinderGeometry(1, 1, 1, 12));
      const hemiG = R.keep(new T.SphereGeometry(1, 12, 6, 0, PI * 2, 0, PI / 2));
      // бантик (как R.bowAt, но из лёгких шариков)
      const bow = (par, m, md, x, y, z, s = 1) => { [-1, 1].forEach(k => { put(par, dotG, m, [x + k * 0.06 * s, y, z], [0.065 * s, 0.038 * s, 0.025 * s], [0, 0, k * 0.45]); box(par, m, x + k * 0.035 * s, y - 0.09 * s, z - 0.005, 0.026 * s, 0.13 * s, 0.008 * s, [0, 0, k * 0.28]); }); put(par, tinyG, md, [x, y, z + 0.01 * s], [0.026 * s, 0.026 * s, 0.02 * s]); };
      const sph = (par, m, x, y, z, sx, sy = sx, sz = sx) => put(par, GEO.sphLo, m, [x, y, z], [sx, sy, sz]);
      const medG = R.keep(new T.SphereGeometry(1, 16, 12));
      // капля глазури: верх спрятан в валике, видна только «слезинка» снизу (лёгкая геометрия)
      const CAPS = new Map();
      const capG = (r, L) => { const k = r + '|' + L; if (!CAPS.has(k)) CAPS.set(k, R.keep(new T.LatheGeometry([[0.001, -L / 2 - r], [r * 0.72, -L / 2 - r * 0.7], [r, -L / 2], [r, L / 2 + r * 0.6], [0.001, L / 2 + r * 0.6]].map(([a, b]) => new T.Vector2(a, b)), 5))); return CAPS.get(k); };
      const RS = new Map(), ringS = (r, t) => { const k = r + '|' + t; if (!RS.has(k)) RS.set(k, R.keep(new T.TorusGeometry(r, t, 4, 8))); return RS.get(k); };
      // комковатая «листва» попроще, чем R.blobGeo
      const leafBlob = R.keep(new T.SphereGeometry(1, 9, 7)); { const p = leafBlob.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.09 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7) * Math.sin(z * 4.4 + 0.7); p.setXYZ(i, x * k, y * k, z * k); } leafBlob.computeVertexNormals(); }
      const lathe = (pts, seg = 20) => R.keep(new T.LatheGeometry(pts.map(([a, b]) => new T.Vector2(a, b)), seg));
      const tiled = (w, h, tw, th) => { const ge = R.keep(new T.PlaneGeometry(w, h)), uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tw, uv.getY(i) * h / th); return ge; };
      const repTex = cv => { const t = R.tex(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
      // скруглённый бокс полегче, чем R.rbox (фаска в 1 сегмент + сглаженные нормали)
      const RBL = new Map();
      const rbGeo = (w, h, d, r) => {
        r = Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)); const k = [w, h, d, r].map(v => v.toFixed(3)).join('|'); if (RBL.has(k)) return RBL.get(k);
        const b = r * 0.6, sw2 = w - 2 * b, sh2 = h - 2 * b, c = Math.min(r - b * 0.4, sw2 / 2 - 0.001, sh2 / 2 - 0.001), s2 = new T.Shape();
        s2.moveTo(-sw2 / 2 + c, -sh2 / 2); s2.lineTo(sw2 / 2 - c, -sh2 / 2); s2.quadraticCurveTo(sw2 / 2, -sh2 / 2, sw2 / 2, -sh2 / 2 + c);
        s2.lineTo(sw2 / 2, sh2 / 2 - c); s2.quadraticCurveTo(sw2 / 2, sh2 / 2, sw2 / 2 - c, sh2 / 2);
        s2.lineTo(-sw2 / 2 + c, sh2 / 2); s2.quadraticCurveTo(-sw2 / 2, sh2 / 2, -sw2 / 2, sh2 / 2 - c);
        s2.lineTo(-sw2 / 2, -sh2 / 2 + c); s2.quadraticCurveTo(-sw2 / 2, -sh2 / 2, -sw2 / 2 + c, -sh2 / 2);
        const ge = R.keep(new T.ExtrudeGeometry(s2, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 2 }));
        ge.center(); R.smoothCrease(ge, 50); RBL.set(k, ge); return ge;
      };
      const rb = (par, m, x, y, z, w, h, d, r = 0.05, rot) => put(par, rbGeo(w, h, d, r), m, [x, y, z], null, rot);
      const at = (par, x, y, z, ry = 0) => { const q = new T.Group(); q.position.set(x, y, z); q.rotation.y = ry; par.add(q); return q; };
      const hit = (key, x, y, z, w, h, d, ry = 0) => { const b = put(g, GEO.box, hidden, [x, y, z], [w, h, d], [0, ry, 0]); b.castShadow = b.receiveShadow = false; b.userData.key = key; return b; };
      const halo = (x, y, z, s) => put(sw, GEO.plane, haloM, [x, y, z], [s, s, 1], [-0.33, 0, 0]);
      // глазурь: капли, стекающие вниз от линии y (вдоль локальной оси x)
      const drips = (par, mat, x0, x1, y, z, step, r, seed, maxL = 0.16) => {
        const q = R.rng(seed);
        for (let x = x0 + step * 0.5; x < x1 - step * 0.3; x += step * (0.75 + q() * 0.5)) { const L = +(0.03 + q() * maxL).toFixed(2); put(par, capG(r, L), mat, [x, y - L / 2, z]); }
      };
      const ringDrips = (par, mat, x, y, z, rr, n, r, seed, maxL = 0.08) => {
        const q = R.rng(seed);
        for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + q() * 0.2, L = +(0.02 + q() * maxL).toFixed(2); put(par, capG(r, L), mat, [x + Math.cos(a) * rr, y - L / 2, z + Math.sin(a) * rr]); }
      };
      // фестоны: в линию (вдоль x) и по кругу
      const scallops = (par, m, x0, x1, y, z, r, m2) => { const n = Math.max(2, Math.round((x1 - x0) / (1.9 * r))), s = (x1 - x0) / n; for (let i = 0; i < n; i++) put(par, halfG, m2 && i % 2 ? m2 : m, [x0 + s * (i + 0.5), y, z], [s / 2, 0.02, r], [PI / 2, 0, 0]); };
      const ringLace = (par, m, cx, y, cz, r, n, d) => { for (let i = 0; i < n; i++) put(at(par, cx, 0, cz, i / n * PI * 2), halfG, m, [0, y, r], [PI * r / n, 0.02, d], [PI / 2, 0, 0]); };
      const disc = (par, m, x, y, z, r, h) => (r < 0.1 ? put(par, discG, m, [x, y, z], [r, h, r]) : cyl(par, m, x, y, z, r, h));
      const cup = (par, x, y, z, ry, col, coffee = true) => {
        disc(par, mm.white, x, y + 0.006, z, 0.075, 0.012);
        put(par, GEO.pot, col, [x, y + 0.045, z], [0.045, 0.065, 0.045]);
        if (coffee) disc(par, mm.choc, x, y + 0.075, z, 0.041, 0.004);
        put(par, ringS(0.024, 0.007), col, [x + Math.cos(ry) * 0.05, y + 0.045, z - Math.sin(ry) * 0.05], null, [0, ry, 0]);
      };
      let mug = (par, x, y, z, col) => { put(par, GEO.cylLo, col, [x, y + 0.05, z], [0.048, 0.1, 0.048]); put(par, ringS(0.028, 0.008), col, [x + 0.05, y + 0.05, z]); };
      let teapot = (par, x, y, z, col, lidC) => {
        sph(par, col, x, y + 0.08, z, 0.1, 0.08, 0.1);
        put(par, GEO.cone, col, [x + 0.11, y + 0.1, z], [0.025, 0.1, 0.025], [0, 0, -0.9]);
        put(par, ringS(0.04, 0.012), col, [x - 0.1, y + 0.09, z]);
        dot(par, lidC, x, y + 0.155, z, 0.055, 0.025, 0.055); dot(par, lidC, x, y + 0.185, z, 0.02);
      };
      let plateUp = (par, x, y, z, col, rim) => { put(par, GEO.cylLo, col, [x, y + 0.11, z], [0.11, 0.012, 0.11], [PI / 2 - 0.22, 0, 0]); put(par, ringS(0.1, 0.008), rim, [x, y + 0.11, z + 0.008], null, [-0.22, 0, 0]); };
      // прогулка: чайники и сервиз прячем (чай — подпись вора, посуда — сюжет будущей серии); на полках банки с посыпкой и коробочки
      if (R.o && R.o.mode === 'free') {
        mug = (par, x, y, z, col) => { put(par, GEO.cylLo, col, [x, y + 0.05, z], [0.04, 0.1, 0.04]); dot(par, mm.cream, x, y + 0.105, z, 0.043, 0.015, 0.043); };
        teapot = (par, x, y, z, col, lidC) => { put(par, GEO.cylLo, col, [x, y + 0.07, z], [0.07, 0.14, 0.07]); dot(par, lidC, x, y + 0.145, z, 0.074, 0.02, 0.074); dot(par, mm.cherry, x, y + 0.165, z, 0.018); };
        plateUp = (par, x, y, z, col, rim) => { box(par, col, x, y + 0.06, z + 0.02, 0.15, 0.12, 0.1); box(par, rim, x, y + 0.06, z + 0.072, 0.155, 0.02, 0.005); };
      }
      const leafM = [mm.leaf, mm.leafD];
      const plant = (par, x, y, z, s, potM) => {
        put(par, GEO.pot, potM, [x, y + 0.09 * s, z], [0.1 * s, 0.18 * s, 0.1 * s]);
        put(par, leafBlob, mm.leafD, [x, y + 0.25 * s, z], [0.13 * s, 0.11 * s, 0.13 * s]);
        [[-0.07, 0.32, 0.03], [0.06, 0.35, 0.01], [0.02, 0.29, 0.08]].forEach(([a, b, c], i) => put(par, leafBlob, leafM[(i + 1) % 2], [x + a * s, y + b * s, z + c * s], [0.08 * s, 0.07 * s, 0.08 * s]));
      };

      /* ---------- атлас надписей: меню мелом, циферблат, картина, ярлык ---------- */
      const [acv, ac] = R.cnv(1024, 1024);
      const AT = { menu: [0, 0, 512, 672], clock: [528, 0, 784, 256], pic: [784, 0, 1040, 256], label: [528, 272, 784, 352] };
      const atlasUV = (ge, r) => { const uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (r[0] + uv.getX(i) * (r[2] - r[0])) / 1024, 1 - (r[3] - uv.getY(i) * (r[3] - r[1])) / 1024); return ge; };
      { // меню: «Меню дня», «Хлеб без хлеба»
        const c = ac, gr = c.createRadialGradient(256, 300, 40, 256, 336, 440); gr.addColorStop(0, '#506460'); gr.addColorStop(1, '#3A4A49'); c.fillStyle = gr; c.fillRect(0, 0, 512, 672);
        c.globalAlpha = 0.07; c.fillStyle = '#FFFFFF'; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(60 + (i * 97) % 400, 80 + (i * 173) % 520, 70, 20, (i % 5) * 0.4, 0, 7); c.fill(); } c.globalAlpha = 1;
        c.setLineDash([16, 12]); c.strokeStyle = 'rgba(255,214,224,.75)'; c.lineWidth = 6; R.rrect(c, 22, 22, 468, 628, 30); c.stroke(); c.setLineDash([]);
        R.text(c, 'Меню дня', 256, 112, 112, '#FFF6EE', { f: 'Caveat', w: 700, max: 440 });
        c.strokeStyle = '#BFE6D3'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); for (let x = 110; x <= 402; x += 4) { const y = 178 + Math.sin(x / 13) * 6; x === 110 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
        R.text(c, 'Хлеб', 256, 300, 136, '#F9BFCB', { f: 'Caveat', w: 700 });
        R.text(c, 'без хлеба', 256, 420, 120, '#F9BFCB', { f: 'Caveat', w: 700, max: 450 });
        c.strokeStyle = '#FFF6EE'; c.lineWidth = 6;
        c.beginPath(); c.moveTo(196, 540); c.lineTo(204, 600); c.lineTo(252, 600); c.lineTo(260, 540); c.closePath(); c.stroke();
        c.beginPath(); c.arc(266, 562, 13, -1.3, 1.3); c.stroke();
        [212, 230, 248].forEach(x => { c.beginPath(); c.moveTo(x, 528); c.quadraticCurveTo(x - 8, 512, x, 498); c.quadraticCurveTo(x + 8, 486, x, 474); c.stroke(); });
        const heart = (x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s * 1.0, x, y - s * 0.3); c.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.4, y, x, y + s * 0.9); c.fill(); };
        heart(110, 560, 22, '#F9BFCB'); heart(400, 575, 18, '#F9BFCB'); heart(350, 520, 12, '#BFE6D3');
        const star = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
        star(80, 230, 16, '#F7DE8E'); star(440, 250, 13, '#F7DE8E'); star(150, 620, 11, '#F7DE8E');
        // циферблат часов-вишенки
        c.fillStyle = '#FFF6EE'; c.beginPath(); c.arc(656, 128, 126, 0, 7); c.fill(); c.fillStyle = '#F08FA8';
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.beginPath(); c.arc(656 + Math.sin(a) * 100, 128 - Math.cos(a) * 100, i % 3 ? 7 : 12, 0, 7); c.fill(); }
        // картина: кекс
        c.save(); c.translate(784, 0);
        c.fillStyle = '#BFE6D3'; c.fillRect(0, 0, 256, 256);
        c.fillStyle = '#FFFDF9'; c.globalAlpha = 0.5; [[40, 50], [210, 70], [60, 200], [200, 210]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); }); c.globalAlpha = 1;
        c.fillStyle = '#C2405B'; c.beginPath(); c.moveTo(78, 150); c.lineTo(178, 150); c.lineTo(166, 214); c.lineTo(90, 214); c.closePath(); c.fill();
        c.strokeStyle = '#F08FA8'; c.lineWidth = 6; [100, 128, 156].forEach(x => { c.beginPath(); c.moveTo(x, 154); c.lineTo(x - 2, 210); c.stroke(); });
        c.fillStyle = '#F6A9BC'; [[128, 132, 56], [108, 112, 36], [148, 112, 36], [128, 92, 34]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
        c.fillStyle = '#C2405B'; c.beginPath(); c.arc(128, 58, 16, 0, 7); c.fill();
        c.fillStyle = '#C9B6F0'; [[100, 120], [150, 96], [134, 130], [112, 92]].forEach(([x, y]) => c.fillRect(x, y, 10, 4));
        c.restore();
        // ярлык бабл-ти-станции
        c.fillStyle = '#FFFDF9'; R.rrect(c, 530, 274, 252, 76, 24); c.fill(); R.text(c, 'бабл-ти', 656, 314, 54, '#C2405B', { f: 'Caveat', w: 700 }); }
      const atlasM = R.toon('#FFFFFF', { map: R.tex(acv) });

      /* ---------- пол: пастельная шахматка ---------- */
      const [fcv, fc] = R.cnv(256, 256);
      fc.fillStyle = '#FFF6EF'; fc.fillRect(0, 0, 256, 256);
      fc.fillStyle = '#F8D2DA'; fc.fillRect(0, 0, 128, 128); fc.fillRect(128, 128, 128, 128);
      fc.strokeStyle = 'rgba(214,150,165,.32)'; fc.lineWidth = 3;
      [0, 128, 256].forEach(v => { fc.beginPath(); fc.moveTo(v, 0); fc.lineTo(v, 256); fc.stroke(); fc.beginPath(); fc.moveTo(0, v); fc.lineTo(256, v); fc.stroke(); });
      box(sw, mm.pink, 0, -0.06, -D / 2, W + 0.4, 0.12, D + 0.2);
      put(sw, tiled(W, D, 1, 1), R.toon('#FFFFFF', { map: repTex(fcv) }), [0, 0.003, -D / 2], null, [-PI / 2, 0, 0]);

      /* ---------- стены: полосатые обои, мятные панели, глазурь ---------- */
      const [wcv, wc] = R.cnv(256, 256);
      wc.fillStyle = '#FCE2E7'; wc.fillRect(0, 0, 256, 256);
      wc.fillStyle = '#F7C6D1'; [0, 128].forEach(x => wc.fillRect(x, 0, 64, 256));
      wc.fillStyle = 'rgba(240,143,168,.4)'; [0, 64, 128, 192].forEach(x => wc.fillRect(x - 1, 0, 3, 256));
      wc.fillStyle = '#FFFFFF'; [[96, 40], [96, 168], [224, 104], [224, 232]].forEach(([x, y]) => { wc.beginPath(); wc.arc(x, y, 6, 0, 7); wc.fill(); });
      const paperM = R.toon('#FFFFFF', { map: repTex(wcv) });
      box(sw, mm.pink, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2);
      [-1, 1].forEach(sd => box(sw, mm.pink, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D));
      // крем по срезу стен — «кукольный домик-торт»
      rb(sw, mm.cream, 0, H + 0.03, -D - 0.1, W + 0.46, 0.09, 0.28, 0.04);
      [-1, 1].forEach(sd => { rb(sw, mm.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 + 0.02, 0.28, 0.09, D + 0.04, 0.04); rb(sw, mm.cream, sd * (W / 2 + 0.1), H / 2, -0.01, 0.28, H, 0.06, 0.03); });
      // группы стен: локальная x — вдоль стены, +z — в комнату (левая: x = −z мира, правая: x = z мира)
      const back = at(sw, 0, 0, -D), left = at(sw, -W / 2, 0, 0, PI / 2), right = at(sw, W / 2, 0, 0, -PI / 2);
      const backS = at(st, 0, 0, -D), leftS = at(st, -W / 2, 0, 0, PI / 2), rightS = at(st, W / 2, 0, 0, -PI / 2);
      put(back, tiled(W, H, 0.5, 0.5), paperM, [0, H / 2, 0.004]);
      put(left, tiled(D, H, 0.5, 0.5), paperM, [D / 2, H / 2, 0.004]);
      put(right, tiled(D, H, 0.5, 0.5), paperM, [-D / 2, H / 2, 0.004]);
      const wains = (wg, x0, x1, panels = true) => {
        const w = x1 - x0, cx = (x0 + x1) / 2;
        box(wg, mm.mint, cx, 0.48, 0.025, w, 0.96, 0.05);
        box(wg, mm.cream, cx, 0.97, 0.05, w + 0.02, 0.07, 0.1);
        box(wg, mm.cream, cx, 0.06, 0.045, w + 0.02, 0.12, 0.09);
        if (panels) { const n = Math.max(1, Math.round(w / 0.9)), pw = w / n; for (let i = 0; i < n; i++) box(wg, mm.cream, x0 + pw * (i + 0.5), 0.53, 0.058, pw - 0.24, 0.54, 0.02); }
      };
      wains(back, -W / 2, W / 2, false);
      wains(left, 0, 0.86); wains(left, 2.14, D);
      wains(right, -D, 0);
      const glaze = (wg, x0, x1, seed) => { rb(wg, mm.cream, (x0 + x1) / 2, H - 0.1, 0.06, x1 - x0, 0.2, 0.12, 0.05); drips(wg, mm.cream, x0, x1, H - 0.19, 0.075, 0.38, 0.045, seed, 0.2); };
      glaze(back, -W / 2, W / 2, 11); glaze(left, 0, D, 12); glaze(right, -D, 0, 13);
      // гирлянда флажков
      const flagG = R.keep(new T.ShapeGeometry(R.triShape(0.16, 0.21))); flagG.rotateZ(PI);
      const FLAGS = [mm.stripe, mm.mint, mm.lav, mm.butter, mm.cream, mm.cherry];
      const bunting = (wg, x0, y0, x1, y1, sag, seed) => {
        const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 0.3));
        const cv = new T.QuadraticBezierCurve3(new T.Vector3(x0, y0, 0.1), new T.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - sag * 2, 0.1), new T.Vector3(x1, y1, 0.1));
        put(wg, R.keep(new T.TubeGeometry(cv, 14, 0.008, 4)), mm.cherry);
        for (let i = 1; i < n; i++) { const p = cv.getPoint(i / n), tg = cv.getTangent(i / n); put(wg, flagG, FLAGS[(i + seed) % 6], [p.x, p.y + 0.004, p.z + 0.006], null, [0, 0, Math.atan2(tg.y, tg.x)]); }
      };
      bunting(backS, -4.4, 3.2, 0, 3.25, 0.2, 0); bunting(backS, 0, 3.25, 4.4, 3.2, 0.2, 3);
      bunting(leftS, 0.15, 3.15, 3.2, 3.15, 0.17, 1); bunting(leftS, 3.2, 3.15, 6.35, 3.15, 0.17, 4);
      bunting(rightS, -6.35, 3.15, -3.2, 3.15, 0.17, 2); bunting(rightS, -3.2, 3.15, -0.15, 3.15, 0.17, 5);

      /* ---------- вид в окнах: вечерняя улица ---------- */
      const [vcv, vc] = R.cnv(256, 320);
      { vc.save(); vc.beginPath(); vc.moveTo(0, 320); vc.lineTo(0, 128); vc.arc(128, 128, 128, PI, 0); vc.lineTo(256, 320); vc.closePath(); vc.clip();
        const gr = vc.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#5D4C8E'); gr.addColorStop(0.5, '#B48CC4'); gr.addColorStop(0.85, '#F7B9A6'); gr.addColorStop(1, '#F7C9A8');
        vc.fillStyle = gr; vc.fillRect(0, 0, 256, 320);
        vc.fillStyle = '#FFF4D6'; vc.beginPath(); vc.arc(176, 70, 22, 0, 7); vc.fill(); vc.fillStyle = '#6A5896'; vc.beginPath(); vc.arc(186, 62, 20, 0, 7); vc.fill();
        vc.fillStyle = 'rgba(255,244,214,.85)'; [[40, 40], [90, 90], [60, 140], [210, 130], [140, 30], [228, 60], [120, 70]].forEach(([x, y]) => { vc.beginPath(); vc.arc(x, y, 2.4, 0, 7); vc.fill(); });
        vc.fillStyle = '#4E3D63';
        vc.beginPath(); vc.moveTo(0, 320); vc.lineTo(0, 230); vc.lineTo(40, 205); vc.lineTo(80, 230); vc.lineTo(80, 200); vc.lineTo(130, 200); vc.lineTo(130, 175); vc.lineTo(165, 150); vc.lineTo(200, 175); vc.lineTo(200, 215); vc.lineTo(256, 215); vc.lineTo(256, 320); vc.closePath(); vc.fill();
        vc.fillStyle = '#FFD98A'; [[22, 250], [52, 250], [100, 228], [150, 196], [150, 236], [178, 236], [222, 240]].forEach(([x, y]) => vc.fillRect(x, y, 13, 16));
        vc.fillStyle = 'rgba(255,214,150,.45)'; vc.beginPath(); vc.arc(118, 270, 26, 0, 7); vc.fill();
        vc.restore(); }
      const viewM = R.keep(new T.MeshBasicMaterial({ map: R.tex(vcv), alphaTest: 0.5 }));

      /* ---------- дверь на улицу: вишнёвая, круглое окошко, венок ---------- */
      const DZ = -1.5;
      const dg = at(leftS, -DZ, 0, 0);
      put(dg, R.extrude(R.archShape(1.26, 2.36), 0.07), mm.cream, [0, 0, 0]);
      put(dg, R.extrude(R.archShape(1.04, 2.22), 0.05), mm.cherry, [0, 0, 0.05]);
      [-0.22, 0.22].forEach(x => box(dg, mm.rose, x, 0.55, 0.105, 0.3, 0.6, 0.02));
      { const ge = R.keep(new T.CircleGeometry(0.17, 20)), uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.35 + uv.getX(i) * 0.6, 0.55 + uv.getY(i) * 0.45); put(at(left, -DZ, 0, 0), ge, viewM, [0, 1.6, 0.104]); }
      put(dg, R.ringG(0.18, 0.026), mm.cream, [0, 1.6, 0.115]);
      { const WRM = [mm.leaf, mm.leafD, mm.butter]; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; put(dg, dotG, WRM[i % 3], [Math.cos(a) * 0.26, 1.6 + Math.sin(a) * 0.26, 0.15], [0.06, 0.042, 0.03], [0, 0, a + 0.6]); }
        for (let i = 0; i < 6; i++) { const a = 0.4 + i * 1.05; dot(dg, mm.cherry, Math.cos(a) * 0.28, 1.6 + Math.sin(a) * 0.28, 0.175, 0.022); }
        bow(dg, mm.stripe, mm.cherry, 0, 1.34, 0.185, 1); }
      dot(dg, gold, 0.38, 1.02, 0.13, 0.045);
      put(dg, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0.66, 2.3, 0.01), new T.Vector3(0.66, 2.36, 0.12), new T.Vector3(0.6, 2.33, 0.24), new T.Vector3(0.55, 2.27, 0.26)]), 10, 0.012, 5)), gold);
      box(sw, mm.mint, -4.05, 0.012, DZ, 0.6, 0.02, 1.0);
      put(sw, R.heartG, mm.cream, [-4.05, 0.024, DZ - 0.02], [0.24, 0.24, 0.05], [-PI / 2, 0, 0]);

      /* ---------- окно у столика, полосатые шторы ---------- */
      const WZ = -3.3;
      const wgS = at(leftS, -WZ, 0, 0), wgW = at(left, -WZ, 0, 0);
      put(wgW, R.frameGeo(1.0, 1.25, 0.09, true), mm.cream, [0, 1.95, 0]);
      box(wgW, mm.cream, 0, 1.95 + 1.25 * 0.12, 0.05, 1.0, 0.04, 0.05); box(wgW, mm.cream, 0, 1.95, 0.05, 0.04, 1.25, 0.05);
      rb(wgW, mm.cream, 0, 1.95 - 0.625 - 0.13, 0.11, 1.36, 0.09, 0.24, 0.04);
      put(wgW, GEO.plane, viewM, [0, 1.95, 0.012], [1.0, 1.25, 1]);
      [-1, 1].forEach(sd => {
        for (let i = 0; i < 5; i++) { const x = sd * (0.6 + i * 0.066), wv = Math.sin(i * 1.9) * 0.022; put(wgS, GEO.cylLo, i % 2 ? mm.cream : mm.stripe, [x, 1.92, 0.13 + wv], [0.04, 1.6, 0.04]); }
        bow(wgS, mm.cherry, mm.cherry, sd * 0.73, 1.62, 0.19, 1.2);
      });
      cyl(wgS, gold, 0, 2.78, 0.13, 0.022, 1.95, [0, 0, PI / 2]);
      [-1, 1].forEach(sd => dot(wgS, gold, sd * 0.98, 2.78, 0.13, 0.04));
      scallops(wgS, mm.stripe, -0.84, 0.84, 2.74, 0.18, 0.1, mm.cream);
      plant(wgS, 0.28, 1.24, 0.12, 0.55, mm.lav);
      [[0.25, 1.48, 0.17], [0.32, 1.45, 0.11]].forEach(([x, y, z]) => dot(wgS, mm.rose, x, y, z, 0.022));

      /* ---------- столик у окна: стулья-сердечки, чашки, вазочка ---------- */
      const TX = -2.2, TZ = -2.45;
      const rugSh = new T.Shape(); for (let i = 0; i <= 64; i++) { const a = i / 64 * PI * 2, r = 1 + 0.05 * Math.cos(a * 14); i ? rugSh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : rugSh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const rugG = R.keep(new T.ShapeGeometry(rugSh)); rugG.rotateX(-PI / 2);
      put(sw, rugG, mm.mint, [TX, 0.007, TZ - 0.28], [1.1, 1, 0.9]);
      put(sw, rugG, mm.cream, [TX, 0.009, TZ - 0.28], [0.9, 1, 0.72]);
      disc(st, gold, TX, 0.015, TZ, 0.2, 0.03);
      cyl(st, gold, TX, 0.38, TZ, 0.032, 0.72);
      disc(st, mm.cream, TX, 0.75, TZ, 0.43, 0.045);
      put(st, R.ringG(0.43, 0.022), mm.cherry, [TX, 0.75, TZ], null, [PI / 2, 0, 0]);
      const TT = 0.7725;
      put(st, GEO.cylLo, mm.white, [TX, TT + 0.002, TZ - 0.12], [0.15, 0.004, 0.15]);
      put(st, lathe([[0.001, 0], [0.034, 0], [0.045, 0.03], [0.03, 0.08], [0.017, 0.1], [0.026, 0.12], [0.001, 0.12]], 12), mm.lav, [TX, TT + 0.004, TZ - 0.12]);
      put(st, GEO.cylLo, mm.leafD, [TX, TT + 0.2, TZ - 0.12], [0.006, 0.2, 0.006]);
      put(st, lathe([[0.001, -0.03], [0.028, -0.026], [0.04, 0], [0.036, 0.034], [0.02, 0.046], [0.001, 0.04]], 10), mm.stripe, [TX, TT + 0.32, TZ - 0.12]);
      put(st, R.leafUp, mm.leaf, [TX + 0.035, TT + 0.19, TZ - 0.12], [0.05, 0.12, 0.05], [0, 0, -0.55]);
      cup(st, TX - 0.22, TT, TZ + 0.1, 0.3, mm.white);
      cup(st, TX + 0.22, TT, TZ + 0.08, PI - 0.3, mm.pink);
      disc(st, mm.white, TX, TT + 0.006, TZ + 0.22, 0.09, 0.012);
      [[-0.035, mm.rose], [0.035, mm.mint]].forEach(([dx, sm]) => { dot(st, sm, TX + dx, TT + 0.025, TZ + 0.22, 0.032, 0.012, 0.032); disc(st, mm.cream, TX + dx, TT + 0.036, TZ + 0.22, 0.029, 0.01); dot(st, sm, TX + dx, TT + 0.047, TZ + 0.22, 0.032, 0.012, 0.032); });
      const chair = (x, z, ry) => {
        const c = at(st, x, 0, z, ry);
        [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].forEach(([a, b]) => put(c, GEO.cylLo, gold, [a, 0.22, b], [0.014, 0.44, 0.014]));
        disc(c, gold, 0, 0.445, 0, 0.2, 0.02);
        sph(c, mm.stripe, 0, 0.47, 0, 0.2, 0.045, 0.2);
        [-0.11, 0.11].forEach(a => put(c, GEO.cylLo, gold, [a, 0.64, -0.16], [0.012, 0.38, 0.012]));
        put(c, R.heartG, gold, [0, 0.88, -0.2], [0.42, 0.42, 0.12]);
        put(c, R.heartG, mm.pink, [0, 0.885, -0.19], [0.35, 0.35, 0.2]);
      };
      chair(TX - 0.5, TZ - 0.62, 0.4); chair(TX + 0.5, TZ - 0.62, -0.4);

      /* ---------- меню-доска (раскладная, мелом) ---------- */
      const MX = -3.42, MZ = -4.62, MR = 0.45;
      const mg = at(st, MX, 0, MZ, MR), mgW = at(sw, MX, 0, MZ, MR);
      const fp = at(mg, 0, 1.34, 0); fp.rotation.x = -0.16;
      const fpW = at(mgW, 0, 1.34, 0); fpW.rotation.x = -0.16;
      rb(fp, mm.caramel, 0, -0.66, 0, 0.92, 1.32, 0.05, 0.03);
      put(fpW, atlasUV(R.keep(new T.PlaneGeometry(0.78, 1.02)), AT.menu), atlasM, [0, -0.6, 0.029]);
      box(fp, mm.caramelD, 0, -1.15, 0.05, 0.8, 0.035, 0.08);
      const bp = at(mg, 0, 1.34, 0); bp.rotation.x = 0.16;
      rb(bp, mm.caramel, 0, -0.66, 0, 0.92, 1.32, 0.05, 0.03);
      cyl(mg, mm.caramelD, 0, 1.35, 0, 0.032, 0.96, [0, 0, PI / 2]);
      bow(mg, mm.stripe, mm.cherry, 0, 1.43, 0.05, 1.3);

      /* ---------- витрина: цоколь с глазурью, стекло, пирожные ---------- */
      const CZ = -4.35, CF = -3.95;
      box(st, mm.cherry, 0, 0.04, CZ, 3.3, 0.08, 0.72);
      R.rbox(st, mm.stripe, 0, 0.27, CZ, 3.4, 0.42, 0.8, 0.06);
      box(st, mm.cream, 0, 0.455, CZ, 3.44, 0.05, 0.84);
      drips(st, mm.cream, -1.7, 1.7, 0.44, CF, 0.15, 0.026, 7, 0.12);
      [-1.2, -0.4, 0.4, 1.2].forEach(x => put(st, R.heartG, mm.cream, [x, 0.21, CF - 0.012], [0.13, 0.13, 0.1]));
      box(st, mm.cream, 0, 0.72, CZ - 0.38, 3.38, 0.5, 0.04);
      [[-1.68, CF], [1.68, CF], [-1.68, CZ - 0.38], [1.68, CZ - 0.38]].forEach(([x, z]) => put(st, GEO.cylLo, gold, [x, 0.72, z], [0.018, 0.5, 0.018]));
      box(sw, glass, 0, 0.72, CF - 0.005, 3.34, 0.48, 0.012);
      [-1, 1].forEach(sd => box(sw, glass, sd * 1.68, 0.72, CZ - 0.02, 0.012, 0.48, 0.74));
      box(sw, glass, 0, 0.972, CZ - 0.02, 3.32, 0.012, 0.74);
      rb(st, mm.cream, 0, 0.975, CF, 3.46, 0.05, 0.07, 0.02);
      box(st, mm.cream, 0, 0.975, CZ - 0.39, 3.46, 0.05, 0.1);
      [-1, 1].forEach(sd => box(st, mm.cream, sd * 1.71, 0.975, CZ - 0.02, 0.07, 0.05, 0.84));
      box(st, mm.white, 0, 0.57, CZ - 0.2, 3.28, 0.18, 0.3);
      // пирожные (без теней: они под стеклом)
      const P2 = st;
      const doily = (x, y, z, r = 0.12) => put(P2, GEO.cylLo, mm.white, [x, y + 0.003, z], [r, 0.006, r]);
      const PS = {
        tart: (x, y, z) => { disc(P2, mm.caramel, x, y + 0.02, z, 0.08, 0.04); disc(P2, mm.cream, x, y + 0.042, z, 0.068, 0.008); [[0, 0], [0.035, 0.02], [-0.03, 0.025], [0.005, -0.035]].forEach(([a, b]) => dot(P2, mm.berry, x + a, y + 0.058, z + b, 0.024)); },
        cupcake: (x, y, z, c) => { put(P2, GEO.pot, c, [x, y + 0.03, z], [0.05, 0.06, 0.05], [PI, 0, 0]); dot(P2, mm.cream, x, y + 0.075, z, 0.058, 0.03, 0.058); dot(P2, mm.cream, x, y + 0.1, z, 0.042, 0.026, 0.042); dot(P2, mm.cream, x, y + 0.122, z, 0.025, 0.02, 0.025); dot(P2, mm.cherry, x, y + 0.15, z, 0.018); },
        eclair: (x, y, z) => [-0.035, 0.035].forEach((d, i) => { put(P2, capG(0.024, 0.14), mm.caramel, [x - 0.01 + i * 0.02, y + 0.026, z + d], null, [0, 0.2, PI / 2]); put(P2, capG(0.018, 0.13), i ? mm.rose : mm.choc, [x - 0.01 + i * 0.02, y + 0.044, z + d], [1, 1, 0.8], [0, 0.2, PI / 2]); }),
        macarons: (x, y, z) => { const C = [mm.mint, mm.rose, mm.lav]; [[-0.04, 0], [0.04, 0], [0, 0.045]].forEach(([a, b], i) => { const c = C[i], yy = y + b; dot(P2, c, x + a, yy + 0.013, z, 0.035, 0.013, 0.035); put(P2, GEO.cylLo, mm.cream, [x + a, yy + 0.024, z], [0.031, 0.01, 0.031]); dot(P2, c, x + a, yy + 0.035, z, 0.035, 0.013, 0.035); }); },
        donuts: (x, y, z) => { [[-0.03, 0.02, mm.rose], [0.04, -0.03, mm.choc]].forEach(([a, b, c]) => { put(P2, ringS(0.045, 0.024), mm.caramel, [x + a, y + 0.022, z + b], null, [PI / 2, 0, 0]); put(P2, ringS(0.045, 0.02), c, [x + a, y + 0.03, z + b], [1, 1, 0.8], [PI / 2, 0, 0]); }); },
        slice: (x, y, z) => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0.1, -0.035); sh.lineTo(0.1, 0.035); sh.closePath(); put(P2, R.keep(new T.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false })), mm.pink, [x - 0.05, y, z], null, [-PI / 2, 0, 0.3]); put(P2, R.keep(new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false })), mm.cream, [x - 0.05, y + 0.07, z], null, [-PI / 2, 0, 0.3]); dot(P2, mm.berry, x + 0.03, y + 0.095, z - 0.01, 0.02); },
        puffs: (x, y, z) => [[-0.04, 0, 0.02], [0.04, 0, 0.02], [0, 0, -0.035], [0, 0.05, 0]].forEach(([a, b, c]) => { dot(P2, mm.caramel, x + a, y + 0.03 + b, z + c, 0.035, 0.03, 0.035); dot(P2, mm.cream, x + a, y + 0.055 + b, z + c, 0.02, 0.01, 0.02); }),
        croissant: (x, y, z) => { for (let i = 0; i < 5; i++) { const a = PI * (0.15 + i * 0.175), s = 1 - Math.abs(i - 2) * 0.22; dot(P2, mm.caramel, x + Math.cos(a) * 0.06, y + 0.025 * s, z - Math.sin(a) * 0.04 + 0.02, 0.032 * s, 0.026 * s, 0.03 * s); } },
        mini: (x, y, z, c, top) => { disc(P2, c, x, y + 0.04, z, 0.055, 0.08); ringDrips(P2, mm.cream, x, y + 0.08, z, 0.052, 7, 0.012, Math.round(x * 10 + 30), 0.03); disc(P2, mm.cream, x, y + 0.082, z, 0.054, 0.008); dot(P2, top, x, y + 0.1, z, 0.02); },
        roll: (x, y, z) => { cyl(P2, mm.pink, x, y + 0.045, z, 0.045, 0.16, [0, 0, PI / 2]); [-1, 1].forEach(s => put(P2, ringS(0.025, 0.01), mm.cream, [x + s * 0.081, y + 0.045, z], null, [0, PI / 2, 0])); },
      };
      const Y1 = 0.48, Z1 = CF - 0.17, Y2 = 0.66, Z2 = CZ - 0.2;
      [[-1.44, 'tart'], [-1.08, 'cupcake', mm.rose], [-0.72, 'eclair'], [-0.36, 'macarons'], [0, 'donuts'], [0.36, 'slice'], [0.72, 'puffs'], [1.08, 'cupcake', mm.mint], [1.44, 'croissant']].forEach(([x, k, c]) => { doily(x, Y1, Z1); PS[k](x, Y1 + 0.006, Z1, c); });
      [[-1.4, 'mini', mm.pink, mm.berry], [-1.0, 'roll'], [-0.6, 'mini', mm.lavL, mm.butter], [-0.2, 'tart'], [0.2, 'mini', mm.mint, mm.berry], [0.6, 'roll'], [1.0, 'mini', mm.butter, mm.cherry], [1.4, 'tart']].forEach(([x, k, c, c2]) => { doily(x, Y2, Z2, 0.1); PS[k](x, Y2 + 0.006, Z2, c, c2); });
      // подставки-тарелочки для свидетелей
      const WX = [-0.8, 0, 0.8], WY = 1.072, WZn = CZ;
      [mm.mint, mm.pink, mm.lavL].forEach((pm2, i) => { const x = WX[i]; disc(st, pm2, x, 0.985, WZn, 0.09, 0.012); put(st, GEO.cylLo, gold, [x, 1.015, WZn], [0.025, 0.05, 0.025]); disc(st, pm2, x, 1.052, WZn, 0.2, 0.02); put(st, ringS(0.2, 0.012), mm.cream, [x, 1.062, WZn], null, [PI / 2, 0, 0]); });
      halo(-0.8, 0.72, CF - 0.1, 1.2); halo(0.8, 0.72, CF - 0.1, 1.2);

      /* ---------- кухня за витриной: дверцы, ступенька, задняя стойка ---------- */
      [-1, 1].forEach(sd => { const x = sd * 1.8; box(st, mm.pink, x, 0.45, -5.32, 0.06, 0.82, 1.1); box(st, mm.cream, x, 0.88, -5.32, 0.09, 0.05, 1.14); });
      box(st, mm.caramelD, 0, 0.215, -5.3, 0.62, 0.43, 0.5);
      const BZ = -6.18, BT = 0.925;
      rb(st, mm.cream, 0, 0.44, BZ, 5.4, 0.88, 0.62, 0.05);
      [-2.0, -1.0, 1.0, 2.0].forEach(x => { box(st, mm.mint, x, 0.46, BZ + 0.315, 0.86, 0.64, 0.02); dot(st, gold, x + (x < 0 ? 0.33 : -0.33), 0.6, BZ + 0.33, 0.02); });
      box(st, mm.caramel, 0, 0.9, BZ + 0.01, 5.5, 0.05, 0.68);
      scallops(st, mm.pink, -2.7, 2.7, 0.87, BZ + 0.355, 0.1, mm.cream);
      // кофемашина
      { const x = -1.85, z = BZ - 0.04;
        rb(st, mm.mint, x, BT + 0.25, z - 0.03, 0.62, 0.5, 0.38, 0.07);
        box(st, mm.cream, x, BT + 0.52, z - 0.03, 0.66, 0.05, 0.42);
        box(st, mm.white, x, BT + 0.02, z + 0.12, 0.5, 0.03, 0.2);
        [-0.13, 0.13].forEach(dx => { put(st, GEO.cylLo, mm.white, [x + dx, BT + 0.3, z + 0.2], [0.035, 0.07, 0.035]); put(st, GEO.cylLo, mm.ink, [x + dx, BT + 0.245, z + 0.2], [0.012, 0.05, 0.012]); cup(st, x + dx, BT + 0.035, z + 0.17, PI / 2, mm.white, false); });
        cyl(st, mm.white, x, BT + 0.4, z + 0.165, 0.05, 0.02, [PI / 2, 0, 0]); put(st, ringS(0.05, 0.01), gold, [x, BT + 0.4, z + 0.175]);
        box(st, mm.cherry, x, BT + 0.4, z + 0.178, 0.006, 0.04, 0.004, [0, 0, 0.6]);
        [mm.white, mm.rose, mm.white].forEach((c, i) => put(st, GEO.pot, c, [x - 0.18 + i * 0.18, BT + 0.575, z - 0.03], [0.042, 0.055, 0.042], [PI, 0, 0])); }
      // банки с конфетами
      const jar = (x, z, h, r, cols, lidM) => {
        put(sw, lathe([[0.001, 0], [r, 0], [r, h], [r * 0.82, h + 0.025], [0.001, h + 0.025]], 16), glass, [x, BT, z]);
        let i = 0; for (let y = 0.025; y < h * 0.8; y += 0.05) for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + y * 9 + 0.5; dot(st, cols[(i++) % cols.length], x + Math.cos(a) * r * 0.62, BT + y, z + Math.sin(a) * r * 0.62, 0.024); }
        disc(st, lidM, x, BT + h + 0.04, z, r * 0.88, 0.03); dot(st, lidM, x, BT + h + 0.065, z, 0.022);
      };
      jar(-1.2, BZ - 0.02, 0.22, 0.09, [mm.rose, mm.mint, mm.butter, mm.lav], mm.cherry);
      jar(-0.9, BZ + 0.06, 0.16, 0.075, [mm.caramel, mm.choc, mm.cream], mm.mint);
      // миска с венчиком
      { const x = 0.42, z = BZ + 0.06; put(st, hemiG, mm.lav, [x, BT + 0.1, z], [0.13, 0.1, 0.13], [PI, 0, 0]); disc(st, mm.cream, x, BT + 0.095, z, 0.115, 0.01);
        put(st, GEO.cylLo, mm.white, [x + 0.05, BT + 0.19, z], [0.01, 0.16, 0.01], [0, 0, -0.5]); [0, PI / 2].forEach(a => put(st, ringS(0.03, 0.004), mm.white, [x + 0.005, BT + 0.12, z], [1, 1.5, 1], [0, a, -0.5])); }
      // тортик под стеклянным колпаком
      { const x = 1.0, z = BZ; disc(st, mm.white, x, BT + 0.012, z, 0.2, 0.02);
        disc(st, mm.pink, x, BT + 0.09, z, 0.13, 0.14); disc(st, mm.cream, x, BT + 0.163, z, 0.132, 0.012); ringDrips(st, mm.cream, x, BT + 0.16, z, 0.13, 10, 0.014, 21, 0.05);
        [[0, 0], [0.06, 0.03], [-0.06, 0.02], [0.02, -0.06]].forEach(([a, b]) => dot(st, mm.berry, x + a, BT + 0.185, z + b, 0.024));
        put(sw, hemiG, glass, [x, BT + 0.022, z], [0.19, 0.27, 0.19]); dot(st, gold, x, BT + 0.3, z, 0.026); }
      // бабл-ти-станция
      { const x = 1.95, z = BZ - 0.04;
        rb(st, mm.stripe, x, BT + 0.22, z - 0.04, 0.62, 0.44, 0.38, 0.07);
        box(st, mm.cream, x, BT + 0.465, z - 0.04, 0.66, 0.05, 0.42);
        put(sw, atlasUV(R.keep(new T.PlaneGeometry(0.38, 0.12)), AT.label), atlasM, [x, BT + 0.31, z + 0.152]);
        [-0.12, 0.12].forEach(dx => put(st, GEO.cylLo, mm.cream, [x + dx, BT + 0.14, z + 0.16], [0.022, 0.05, 0.022]));
        [mm.lav, mm.mint, mm.cherry, mm.caramel].forEach((c, i) => { put(st, GEO.cylLo, c, [x - 0.21 + i * 0.14, BT + 0.57, z - 0.07], [0.034, 0.16, 0.034]); put(st, GEO.cylLo, mm.white, [x - 0.21 + i * 0.14, BT + 0.665, z - 0.07], [0.016, 0.03, 0.016]); });
        put(sw, lathe([[0.001, 0], [0.075, 0], [0.075, 0.16], [0.06, 0.18], [0.001, 0.18]], 14), glass, [x + 0.48, BT, z + 0.05]);
        for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = (i % 3) * 0.022 + 0.012; dot(st, mm.ink, x + 0.48 + Math.cos(a) * rr, BT + 0.025 + Math.floor(i / 5) * 0.035, z + 0.05 + Math.sin(a) * rr, 0.02); }
        disc(st, mm.cherry, x + 0.48, BT + 0.19, z + 0.05, 0.065, 0.025);
        const cupG = R.keep(new T.CylinderGeometry(0.06, 0.048, 0.12, 12, 1, true));
        for (let i = 0; i < 4; i++) put(st, cupG, mm.white, [x - 0.5, BT + 0.06 + i * 0.03, z + 0.06]);
        [mm.stripe, mm.mint, mm.lav, mm.butter].forEach((c, i) => put(st, GEO.cylLo, c, [x - 0.5 + (i - 1.5) * 0.02, BT + 0.25, z + 0.06 + (i % 2) * 0.015], [0.008, 0.2, 0.008], [0.1 * (i - 1.5), 0, 0.12 * (i - 1.5)])); }
      // полки с посудой над стойкой
      [-1.75, 1.75].forEach((cx, si) => [1.72, 2.22].forEach((y, li) => {
        box(st, mm.cream, cx, y, -D + 0.14, 1.6, 0.045, 0.26);
        [-0.62, 0.62].forEach(dx => box(st, mm.stripe, cx + dx, y - 0.08, -D + 0.07, 0.04, 0.12, 0.12));
        scallops(st, mm.pink, cx - 0.8, cx + 0.8, y - 0.024, -D + 0.272, 0.08);
        const yy = y + 0.0225, zz = -D + 0.15;
        if ((si + li) % 2 === 0) { mug(st, cx - 0.55, yy, zz, mm.rose); mug(st, cx - 0.38, yy, zz, mm.mint); mug(st, cx - 0.21, yy, zz, mm.lav); teapot(st, cx + 0.15, yy, zz, mm.white, mm.stripe); plateUp(st, cx + 0.52, yy, zz - 0.05, mm.butter, mm.cream); }
        else { plateUp(st, cx - 0.55, yy, zz - 0.05, mm.mint, mm.cream); plateUp(st, cx - 0.36, yy, zz - 0.05, mm.rose, mm.cream); teapot(st, cx, yy, zz, mm.lavL, mm.cherry); mug(st, cx + 0.33, yy, zz, mm.butter); mug(st, cx + 0.5, yy, zz, mm.rose); }
      }));
      // часы-вишенка
      const CKX = 0, CKY = 2.5, CKZ = -D + 0.07;
      put(st, GEO.sph, mm.cherry, [CKX, CKY, CKZ + 0.05], [0.31, 0.3, 0.1]);
      dot(st, mm.rose, CKX - 0.17, CKY + 0.16, CKZ + 0.11, 0.05, 0.03, 0.02);
      sph(st, mm.cherry, CKX + 0.44, CKY + 0.06, CKZ + 0.04, 0.13, 0.13, 0.08);
      put(st, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(CKX, CKY + 0.28, CKZ + 0.06), new T.Vector3(CKX + 0.08, CKY + 0.5, CKZ + 0.06), new T.Vector3(CKX + 0.24, CKY + 0.66, CKZ + 0.06), new T.Vector3(CKX + 0.38, CKY + 0.42, CKZ + 0.05), new T.Vector3(CKX + 0.44, CKY + 0.18, CKZ + 0.04)]), 18, 0.018, 5)), mm.caramelD);
      put(st, R.leafUp, mm.leaf, [CKX + 0.36, CKY + 0.72, CKZ + 0.06], [0.2, 0.3, 0.2], [0, 0, -1.0]);
      put(sw, atlasUV(R.keep(new T.CircleGeometry(0.21, 24)), AT.clock), atlasM, [CKX, CKY, CKZ + 0.152]);
      dot(st, mm.cherry, CKX, CKY, CKZ + 0.175, 0.02);
      box(st, mm.ink, CKX - 0.045, CKY + 0.026, CKZ + 0.16, 0.022, 0.11, 0.008, [0, 0, 1.05]);
      const hM = new T.Group(); hM.position.set(CKX, CKY, CKZ + 0.164); g.add(hM);
      box(hM, mm.ink, 0, 0.075, 0, 0.016, 0.16, 0.008).castShadow = false;
      // буфет с тарелками (слева)
      { const x = -3.62, z = -D, w = 1.45;
        rb(st, mm.cream, x, 0.45, z + 0.24, w, 0.9, 0.46, 0.05);
        [-0.35, 0.35].forEach(dx => { box(st, mm.lav, x + dx, 0.46, z + 0.475, 0.6, 0.66, 0.02); dot(st, gold, x + dx * 0.25, 0.52, z + 0.49, 0.022); });
        box(st, mm.caramel, x, 0.92, z + 0.25, w + 0.06, 0.05, 0.5);
        box(sw, mm.mint, x, 1.62, z + 0.05, w - 0.08, 1.34, 0.04);
        [-1, 1].forEach(sd => rb(st, mm.cream, x + sd * (w / 2 - 0.04), 1.62, z + 0.15, 0.08, 1.4, 0.26, 0.03));
        [1.38, 1.86].forEach(y => box(st, mm.cream, x, y, z + 0.15, w - 0.1, 0.035, 0.24));
        rb(st, mm.cream, x, 2.34, z + 0.16, w + 0.06, 0.08, 0.3, 0.03);
        scallops(st, mm.stripe, x - w / 2, x + w / 2, 2.3, z + 0.31, 0.07, mm.cream);
        [mm.rose, mm.white, mm.mint, mm.white, mm.lav].forEach((c, i) => plateUp(st, x - 0.5 + i * 0.25, 1.3975, z + 0.12, c, mm.stripe));
        [mm.lav, mm.rose, mm.mint, mm.butter].forEach((c, i) => mug(st, x - 0.45 + i * 0.3, 1.8775, z + 0.15, c));
        teapot(st, x - 0.3, 0.945, z + 0.25, mm.mint, mm.cream); plant(st, x + 0.35, 0.945, z + 0.25, 0.8, mm.pink); }
      // стеллаж с коробками для тортов (справа)
      { const x = 3.62, z = -D, w = 1.45;
        rb(st, mm.cream, x, 0.3, z + 0.24, w, 0.6, 0.46, 0.05);
        [-0.35, 0.35].forEach(dx => box(st, mm.mint, x + dx, 0.31, z + 0.475, 0.6, 0.42, 0.02));
        box(sw, mm.mint, x, 1.42, z + 0.05, w - 0.08, 1.7, 0.04);
        [-1, 1].forEach(sd => rb(st, mm.cream, x + sd * (w / 2 - 0.04), 1.42, z + 0.17, 0.08, 1.75, 0.3, 0.03));
        [0.62, 1.2, 1.78].forEach(y => box(st, mm.cream, x, y, z + 0.17, w - 0.1, 0.035, 0.28));
        rb(st, mm.cream, x, 2.3, z + 0.18, w + 0.06, 0.08, 0.34, 0.03);
        scallops(st, mm.stripe, x - w / 2, x + w / 2, 2.26, z + 0.35, 0.07, mm.cream);
        const cakeBox = (bx, by, bw, bh, c, rib) => { rb(st, c, bx, by + bh / 2, z + 0.18, bw, bh, 0.24, 0.02); box(st, rib, bx, by + bh / 2, z + 0.302, 0.03, bh + 0.004, 0.006); box(st, rib, bx, by + bh + 0.001, z + 0.18, 0.03, 0.006, 0.245); bow(st, rib, rib, bx, by + bh + 0.03, z + 0.24, 0.7); };
        cakeBox(x - 0.36, 0.6375, 0.5, 0.26, mm.pink, mm.cherry); cakeBox(x + 0.3, 0.6375, 0.6, 0.2, mm.lavL, mm.stripe);
        cakeBox(x - 0.3, 1.2175, 0.56, 0.22, mm.mint, mm.stripe); cakeBox(x + 0.33, 1.2175, 0.4, 0.3, mm.butter, mm.cherry);
        cakeBox(x - 0.25, 1.7975, 0.46, 0.18, mm.rose, mm.cherry);
        plant(st, x + 0.32, 1.7975, z + 0.18, 0.75, mm.mint); plant(st, x - 0.1, 2.34, z + 0.2, 0.7, mm.lav); }

      /* ---------- трёхъярусный торт на тумбе ---------- */
      const KX = 3.4, KZ = -4.6;
      put(st, lathe([[0.001, 0], [0.42, 0], [0.42, 0.06], [0.33, 0.1], [0.3, 0.16], [0.3, 0.74], [0.34, 0.79], [0.43, 0.82], [0.43, 0.88], [0.001, 0.88]], 24), mm.pink, [KX, 0, KZ]);
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; box(st, mm.cream, KX + Math.cos(a) * 0.302, 0.45, KZ + Math.sin(a) * 0.302, 0.05, 0.56, 0.012, [0, -a + PI / 2, 0]); }
      ringLace(st, mm.cream, KX, 0.8, KZ, 0.432, 16, 0.06);
      disc(st, gold, KX, 0.89, KZ, 0.12, 0.02); put(st, GEO.cylLo, gold, [KX, 0.93, KZ], [0.035, 0.08, 0.035]); disc(st, mm.white, KX, 0.98, KZ, 0.38, 0.025);
      const tier = (r, h, y, c, seed) => { disc(st, c, KX, y + h / 2, KZ, r, h); disc(st, mm.cream, KX, y + h + 0.004, KZ, r + 0.004, 0.012); ringDrips(st, mm.cream, KX, y + h, KZ, r + 0.002, Math.round(r * 36), 0.018, seed, 0.07); const n = Math.round(r * 38); for (let i = 0; i < n; i++) { const a = i / n * PI * 2; dot(st, mm.cream, KX + Math.cos(a) * r, y + 0.014, KZ + Math.sin(a) * r, 0.017); } };
      tier(0.3, 0.2, 0.993, mm.pink, 31); tier(0.22, 0.17, 1.205, mm.lavL, 32); tier(0.14, 0.14, 1.387, mm.pink, 33);
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; dot(st, mm.berry, KX + Math.cos(a) * 0.255, 1.215, KZ + Math.sin(a) * 0.255, 0.026); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; dot(st, mm.cream, KX + Math.cos(a) * 0.1, 1.55, KZ + Math.sin(a) * 0.1, 0.03, 0.025, 0.03); }
      sph(st, mm.cherry, KX, 1.6, KZ, 0.065); put(st, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(KX, 1.65, KZ), new T.Vector3(KX + 0.03, 1.73, KZ), new T.Vector3(KX + 0.08, 1.78, KZ)]), 8, 0.008, 4)), mm.caramelD);
      dot(st, mm.rose, KX - 0.025, 1.625, KZ + 0.05, 0.016);

      /* ---------- подушка Пудры, мисочка, косточка ---------- */
      const PX = 3.2, PZ = -1.2;
      put(st, lathe([[0.001, 0], [0.3, 0], [0.36, 0.04], [0.375, 0.09], [0.35, 0.14], [0.27, 0.16], [0.18, 0.13], [0.001, 0.12]], 22), mm.stripe, [PX, 0, PZ]);
      put(st, R.ringG(0.32, 0.03), mm.cream, [PX, 0.15, PZ], null, [PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; dot(st, mm.cream, PX + Math.cos(a) * 0.37, 0.09, PZ + Math.sin(a) * 0.37, 0.03); }
      { const bx = 3.72, bz = -0.72, ca = Math.cos(0.5), sa = Math.sin(0.5); put(st, GEO.cylLo, mm.cream, [bx, 0.025, bz], [0.016, 0.12, 0.016], [0, 0.5, PI / 2]); [-1, 1].forEach(s => [-1, 1].forEach(t2 => dot(st, mm.cream, bx + s * 0.055 * ca + t2 * 0.012 * sa, 0.025, bz - s * 0.055 * sa + t2 * 0.012 * ca, 0.022))); }
      { const bx = 3.82, bz = -1.42; put(st, lathe([[0.001, 0], [0.09, 0], [0.11, 0.06], [0.1, 0.066], [0.075, 0.025], [0.001, 0.025]], 16), mm.mint, [bx, 0, bz]); [[0, 0], [0.025, 0.02], [-0.02, 0.018], [0.01, -0.025]].forEach(([a, b]) => dot(st, mm.caramelD, bx + a, 0.035, bz + b, 0.018)); }

      /* ---------- балки, подвесные лампы, бра, картина ---------- */
      [-4.35, -2.45].forEach(z => box(sw, mm.cream, 0, 3.48, z, W + 0.1, 0.1, 0.12));
      const lamp = (x, z, y, col) => {
        put(sw, GEO.cylLo, mm.cream, [x, (y + 3.43) / 2 + 0.14, z], [0.008, 3.43 - y - 0.28, 0.008]);
        put(sw, hemiG, col, [x, y + 0.12, z], [0.2, 0.17, 0.2]);
        put(sw, R.ringG(0.2, 0.016), mm.cream, [x, y + 0.12, z], null, [PI / 2, 0, 0]);
        dot(sw, mm.cream, x, y + 0.3, z, 0.035);
        put(sw, dotG, mm.cream, [x, y + 0.08, z], [0.065, 0.065, 0.065]);
        halo(x, y + 0.03, z + 0.02, 1.25);
      };
      lamp(-1.35, -4.35, 2.45, mm.mint); lamp(1.35, -4.35, 2.45, mm.cream); lamp(KX, -4.35, 2.55, mm.mint); lamp(TX, TZ, 2.4, mm.cream);
      // подвесное кашпо над правым проходом
      { const x = 1.6, z = -2.45; put(st, GEO.cylLo, mm.caramelD, [x, 3.08, z], [0.006, 0.7, 0.006]); put(st, hemiG, mm.cream, [x, 2.73, z], [0.13, 0.11, 0.13], [PI, 0, 0]); put(st, leafBlob, mm.leafD, [x, 2.76, z], [0.15, 0.08, 0.15]);
        for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; put(st, leafBlob, leafM[i % 2], [x + Math.cos(a) * 0.12, 2.64 - (i % 3) * 0.12, z + Math.sin(a) * 0.12], [0.05, 0.08, 0.05]); } }
      [[-1, -5.0], [1, -3.3], [1, -5.75]].forEach(([sd, z]) => {
        const sg = new T.Group(); sg.position.set(sd * (W / 2 - 0.02), 0, z); sg.rotation.y = -sd * PI / 2; st.add(sg); R.sconce(sg, K, 0, 2.35);
        halo(sd * (W / 2 - 0.3), 2.3, z, 1.0);
      });
      { const pg = at(rightS, -4.55, 2.2, 0.03);
        put(pg, R.ringG(0.3, 0.035), gold, [0, 0, 0.02]);
        put(at(right, -4.55, 2.2, 0.03), atlasUV(R.keep(new T.CircleGeometry(0.29, 24)), AT.pic), atlasM, [0, 0, 0.012]);
        bow(pg, mm.stripe, mm.cherry, 0, 0.33, 0.05, 1.3); }

      /* ---------- склейка статики ---------- */
      if (/debug=1/.test(location.search)) { const acc = {}; [['st', st], ['sw', sw]].forEach(([nm, gr]) => gr.traverse(o => { if (!o.isMesh) return; const ge = o.geometry, tr = (ge.index ? ge.index.count : ge.attributes.position.count) / 3, pp = ge.parameters || {}, k = nm + ' ' + ge.type + (pp.widthSegments ? ' ' + pp.widthSegments + 'x' + pp.heightSegments : '') + (pp.radialSegments ? ' r' + pp.radialSegments : '') + (pp.tubularSegments ? ' t' + pp.tubularSegments : ''); acc[k] = acc[k] || [0, 0]; acc[k][0]++; acc[k][1] += tr; })); window.__swAcc = Object.entries(acc).sort((x, y) => y[1][1] - x[1][1]).slice(0, 30); }   // DEV
      R.bake(st, null, {});
      R.bake(sw, null, { cast: false });
      [st, sw].forEach(gr => gr.traverse(o => { if (o.isMesh) o.raycast = () => {}; }));
      if (/debug=1/.test(location.search)) window.__swRoom = { g, st, sn: sw };   // DEV

      /* ---------- живые мелочи (не склеены) ---------- */
      // колокольчик над дверью: звенит, когда героиня подходит
      const bell = new T.Group(); bell.position.set(-W / 2 + 0.01 + 0.26, 2.27, DZ - 0.55); g.add(bell);
      put(bell, lathe([[0.001, -0.1], [0.06, -0.1], [0.05, -0.07], [0.035, -0.02], [0.02, 0], [0.001, 0.005]], 12), gold, [0, 0, 0]);
      dot(bell, gold, 0, -0.105, 0, 0.018);
      R.bake(bell, null, { cast: false });
      // пар над кофемашиной и «з-з-з» над Пудрой
      const [scv, sctx] = R.cnv(64, 64); { const gr = sctx.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sctx.fillStyle = gr; sctx.fillRect(0, 0, 64, 64); }
      const steamTex = R.tex(scv);
      const steam = [0].map(i => { const s = new T.Sprite(R.keep(new T.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.5, fog: false }))); s.renderOrder = 4; g.add(s); return { s, ph: i / 2 }; });
      const [zcv, zc] = R.cnv(64, 64); zc.strokeStyle = '#FFFDF9'; zc.lineWidth = 9; zc.lineCap = 'round'; zc.lineJoin = 'round'; zc.beginPath(); zc.moveTo(16, 16); zc.lineTo(48, 16); zc.lineTo(16, 48); zc.lineTo(48, 48); zc.stroke();
      const zTex = R.tex(zcv);
      const zz = [0, 1].map(i => { const s = new T.Sprite(R.keep(new T.SpriteMaterial({ map: zTex, color: new T.Color('#E2D8FA'), transparent: true, depthWrite: false, opacity: 0.8, fog: false }))); s.renderOrder = 4; g.add(s); return { s, ph: i / 2 }; });

      /* ---------- жители: зайка-кондитер и Пудра ---------- */
      const isOutline = m => m.material && m.material.type === 'ShaderMaterial';
      // зайка стоит на ступеньке за витриной — над стеклом видна вся голова и колпак
      const bunny = R.npc.bunny(); bunny.root.position.set(0, 0.43, -5.3); g.add(bunny.root);
      // Пудра спит, утонув в мягкой подушке (лапки скрыты в ней), глаза закрыты
      const poodle = R.npc.poodle(); poodle.root.position.set(PX, -0.07, PZ - 0.02); poodle.root.rotation.y = -0.75; poodle.root.scale.setScalar(1.15); g.add(poodle.root);
      poodle.noLook = true; poodle.blinkT = 1e9; poodle.closed = true; if (poodle.faceMat) poodle.faceMat.map = poodle.faceClosed;
      poodle.head.rotation.x = 0.28; poodle.head.position.y -= 0.03; poodle.head.position.z += 0.02;

      /* ---------- свидетели: синнабон, макарон, бабл-ти ---------- */
      const INK = '#3A2E3F';
      const faceCv = (closed, mouth) => {
        const [cv, c] = R.cnv(256, 256), ex = 50, ey = 108, er = 24;
        c.fillStyle = 'rgba(246,140,166,.62)'; [-1, 1].forEach(s => { c.beginPath(); c.ellipse(128 + s * (ex + 36), ey + 42, 24, 14, 0, 0, 7); c.fill(); });
        [-1, 1].forEach(s => { const x = 128 + s * ex;
          if (closed) { c.strokeStyle = INK; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - er * 0.9, ey + 4); c.quadraticCurveTo(x, ey - er * 0.9, x + er * 0.9, ey + 4); c.stroke(); }
          else { c.fillStyle = INK; c.beginPath(); c.ellipse(x, ey, er * 0.82, er, 0, 0, 7); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x + er * 0.3, ey - er * 0.38, er * 0.34, 0, 7); c.fill(); }
        });
        c.strokeStyle = '#6B3A48'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
        if (mouth === 'wobble') { c.moveTo(100, ey + 56); for (let i = 1; i <= 6; i++) c.lineTo(100 + i * 9.3, ey + 56 + (i % 2 ? -8 : 6)); }
        else { c.moveTo(128 - 20, ey + 46); c.quadraticCurveTo(128, ey + 66, 128 + 20, ey + 46); }
        c.stroke();
        if (mouth === 'wobble') { c.fillStyle = '#BFE3F7'; c.beginPath(); c.moveTo(206, 40); c.quadraticCurveTo(222, 66, 206, 74); c.quadraticCurveTo(190, 66, 206, 40); c.fill(); }
        return cv;
      };
      const mkFace = (n, par, geo, pos, scale) => {
        const fo = R.tex(faceCv(false)), fc = R.tex(faceCv(true)), fw = R.tex(faceCv(false, 'wobble'));
        const fm = R.keep(new T.MeshBasicMaterial({ map: fo, transparent: true, depthWrite: false }));
        const m = put(par, geo, fm, pos, scale); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.userData.dyn = true;
        n.faceMat = fm; n.faceOpen = fo; n.faceClosed = fc; n.faceWob = fw; n.faceOpen0 = fo; return m;
      };
      // наклейка-лицо: квадрат стороной size без искажений — на боку цилиндра или на сфероиде
      const decalCyl = (rT, rB, size) => { const th = 2 * size / (rT + rB); return R.keep(new T.CylinderGeometry(rT, rB, size, 12, 1, true, -th / 2, th)); };
      const decalEll = (a, b, thC, size) => { const s = Math.sin(thC), c = Math.cos(thC), dph = size / (a * s), dth = size / Math.hypot(a * c, b * s); return R.keep(new T.SphereGeometry(1.012, 14, 12, PI / 2 - dph / 2, dph, thC - dth / 2, dth)); };

      const cinnabon = R.makeNpc('cinnabon', ({ n, body, P, M }) => {
        const dough = M('#E7B47C'), swirl = M('#C88D52'), icing = M('#FFF8F0');
        const head = new T.Group(); body.add(head); n.head = head;
        const prof = [[0.001, 0], [0.17, 0], [0.2, 0.03], [0.212, 0.08], [0.212, 0.19], [0.2, 0.23], [0.17, 0.255], [0.1, 0.268], [0.001, 0.272]];
        P(head, lathe(prof, 20), dough, [0, 0, 0]);
        const topY = r => { for (let i = prof.length - 1; i > 0; i--) { const [r0, y0] = prof[i], [r1, y1] = prof[i - 1]; if (r >= r0 && r <= r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 0.2; };
        const deco = new T.Group(); head.add(deco);
        const pts = []; for (let i = 0; i <= 60; i++) { const k = i / 60, a = k * PI * 2 * 2.6 + 1.2, r = 0.03 + k * 0.165; pts.push(new T.Vector3(Math.cos(a) * r, topY(r) + 0.003, Math.sin(a) * r)); }
        put(deco, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 64, 0.013, 4)), swirl);
        put(deco, GEO.sphLo, icing, [0, 0.27, 0], [0.11, 0.035, 0.105]);
        [[0.4, 0.05], [1.0, 0.03], [2.3, 0.04], [2.9, 0.06], [3.6, 0.05], [4.3, 0.07], [5.1, 0.04], [5.8, 0.05]].forEach(([a, L]) => put(deco, capG(0.016, L), icing, [Math.cos(a) * 0.1, 0.27 - L / 2 + 0.01, Math.sin(a) * 0.098]));
        mkFace(n, head, decalCyl(0.215, 0.215, 0.24), [0, 0.14, 0]);
      });
      const macaron = R.makeNpc('macaron', ({ n, body, P, M }) => {
        const shB = M('#C9B6F0'), shT = M('#DDC4F2'), fill = M('#FFF4E4');
        const head = new T.Group(); body.add(head); n.head = head;
        P(head, medG, shB, [0, 0.075, 0], [0.18, 0.075, 0.18]);
        P(head, GEO.cyl, fill, [0, 0.152, 0], [0.165, 0.055, 0.165], null, false);
        P(head, medG, shT, [0, 0.245, 0], [0.185, 0.1, 0.185]);
        const deco = new T.Group(); head.add(deco);
        [0.12, 0.188].forEach(y => put(deco, R.ringG(0.17, 0.022), shB, [0, y, 0], null, [PI / 2, 0, 0]));
        put(deco, GEO.sphLo, fill, [-0.07, 0.315, 0.07], [0.05, 0.016, 0.028], [0, 0.7, 0]);
        mkFace(n, head, decalEll(0.185, 0.1, 1.5, 0.2), [0, 0.245, 0], [0.185, 0.1, 0.185]);
      });
      const bubbletea = R.makeNpc('bubbletea', ({ n, body, P, M }) => {
        const tea = M('#D9B08C'), cupTop = M('#FFFFFF'), straw = M('#F08FA8'), pearl = M('#3A2B2B');
        const head = new T.Group(); body.add(head); n.head = head;
        P(head, R.keep(new T.CylinderGeometry(0.125, 0.1, 0.22, 20)), tea, [0, 0.11, 0]);
        const deco = new T.Group(); head.add(deco);
        put(deco, R.keep(new T.CylinderGeometry(0.133, 0.125, 0.06, 20)), cupTop, [0, 0.25, 0]);
        put(deco, GEO.hemi, cupTop, [0, 0.293, 0], [0.135, 0.065, 0.135]);
        put(deco, GEO.cyl, cupTop, [0, 0.285, 0], [0.142, 0.022, 0.142]);
        for (let i = 0; i < 11; i++) { const a = i / 11 * PI * 2, y = 0.026 + (i % 2) * 0.03; put(deco, dotG, pearl, [Math.sin(a) * 0.097, y, Math.cos(a) * 0.097], [0.022, 0.022, 0.022]); }
        n.straw = put(head, GEO.cylLo, straw, [0.035, 0.39, -0.01], [0.016, 0.22, 0.016], [0.05, 0, -0.2]); n.straw.userData.dyn = true;
        mkFace(n, head, decalCyl(0.1286, 0.1104, 0.16), [0, 0.145, 0]);
      });
      const witnesses = { cinnabon, macaron, bubbletea };
      [cinnabon, macaron, bubbletea].forEach((n, i) => { n.root.position.set(WX[i], WY, WZn); n.root.userData.key = 'spot:showcase'; g.add(n.root); n.root.traverse(o => { if (o.isMesh && isOutline(o)) o.castShadow = false; }); });
      const wob = {};
      // пойманный свидетель трясётся ~1 с (вызывается, когда лжец найден)
      const witnessWobble = id => { const n = witnesses[id]; if (!n) return; wob[id] = 0; n.hop(); n.faceOpen = n.faceWob; n.faceMat.map = n.faceWob; };

      /* ---------- тапы: невидимые зоны поверх склеенной мебели ---------- */
      hit('spot:showcase', 0, 0.5, CZ, 3.44, 1.0, 0.84);
      hit('spot:menu', MX, 0.75, MZ, 1.0, 1.5, 0.55, MR);
      hit('spot:table', TX, 0.55, TZ - 0.25, 1.65, 1.1, 1.35);
      hit('spot:cake', KX, 0.85, KZ, 0.9, 1.7, 0.9);
      hit('exitDoor', -W / 2 + 0.1, 1.15, DZ, 0.2, 2.35, 1.3);

      const blockers = [
        { x0: -1.7, x1: 1.7, z0: -4.75, z1: -3.95 },     // витрина
        { x0: -1.9, x1: 1.9, z0: -6.5, z1: -4.75 },      // кухня за витриной
        { x0: -4.5, x1: -2.85, z0: -6.5, z1: -5.95 },    // буфет
        { x0: 2.85, x1: 4.5, z0: -6.5, z1: -5.95 },      // стеллаж с коробками
        { x0: MX - 0.45, x1: MX + 0.45, z0: MZ - 0.35, z1: MZ + 0.35 },  // меню-доска
        { x0: 3.0, x1: 3.8, z0: -5.0, z1: -4.2 },        // тумба с тортом
        { x0: TX - 0.45, x1: TX + 0.45, z0: TZ - 0.45, z1: TZ + 0.45 },   // столик
        { x0: TX - 0.75, x1: TX - 0.25, z0: TZ - 0.87, z1: TZ - 0.37 },   // стул
        { x0: TX + 0.25, x1: TX + 0.75, z0: TZ - 0.87, z1: TZ - 0.37 },   // стул
        { x0: PX - 0.35, x1: PX + 0.35, z0: PZ - 0.35, z1: PZ + 0.35 },   // подушка Пудры
        { x0: 3.7, x1: 3.95, z0: -1.55, z1: -1.3 },      // мисочка
      ];
      let bellT = -1, nearDoor = false;
      return {
        W, D,
        bounds: { x0: -4.1, x1: 4.1, z0: -5.6, z1: -0.4 },
        exit: { x: -3.95, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -2.6, z: -0.9 },   // ≥ 1,3 м от двери: «Выйти» не всплывает сразу
        cam: { x0: -2.2, x1: 2.2, z: -1.2 },
        blockers,
        spots: [
          { id: 'showcase', x: 1.75, z: -3.3, act: 'Свидетели', bubble: 'витрина' },   // сбоку: героиня не заслоняет свидетелей
          { id: 'menu', x: -2.7, z: -3.9, act: 'Читать', bubble: 'меню дня' },
          { id: 'table', x: -1.2, z: -2.0, act: 'Присесть', bubble: 'столик у окна' },
          { id: 'cake', x: 2.7, z: -3.9, act: 'Смотреть', bubble: 'торт' },
        ],
        npcs: { bunny, poodle },
        witnesses, witnessWobble,
        tick(t, dt, ctx) {
          const hx = ctx ? ctx.px : 0, hz = ctx ? ctx.pz : 0;
          // свидетели: дышат, моргают, смотрят на героиню; пойманный — трясётся
          Object.keys(witnesses).forEach(id => {
            const n = witnesses[id]; n.anim(t, dt, hx, hz);
            if (wob[id] !== undefined) {
              wob[id] += dt; const k = wob[id], e = Math.max(0, 1 - k / 1.1), s = Math.sin(k * 26);
              n.root.rotation.z = Math.sin(k * 32) * 0.22 * e; n.root.scale.set(1 + s * 0.07 * e, 1 - s * 0.09 * e, 1 + s * 0.07 * e);
              if (k > 1.1) { delete wob[id]; n.root.rotation.z = 0; n.root.scale.set(1, 1, 1); n.faceOpen = n.faceOpen0; n.faceMat.map = n.closed ? n.faceClosed : n.faceOpen; }
            }
          });
          bubbletea.straw.rotation.z = -0.2 + Math.sin(t * 1.7) * 0.06;
          // Пудра спит; если Пудру потрогать (прыжок) — приоткрывает глаза
          if (poodle.faceMat) poodle.faceMat.map = poodle.hopT >= 0 ? poodle.faceOpen : poodle.faceClosed;
          zz.forEach(q => { const k = (t * 0.32 + q.ph) % 1; q.s.position.set(PX - 0.12 + k * 0.25 + Math.sin(t * 2 + q.ph * 6) * 0.03, 0.55 + k * 0.6, PZ + 0.05); q.s.scale.setScalar(0.08 + k * 0.1); q.s.material.opacity = 0.85 * Math.min(1, k * 4) * (1 - k); });
          steam.forEach((q, i) => { const k = (t * 0.45 + q.ph) % 1; q.s.position.set(-1.85 + (i % 2 ? 0.13 : -0.13) + Math.sin(t * 1.3 + q.ph * 5) * 0.04, 1.02 + k * 0.5, BZ + 0.15); q.s.scale.setScalar(0.1 + k * 0.22); q.s.material.opacity = 0.5 * Math.min(1, k * 5) * (1 - k); });
          // часы идут (по-кондитерски быстро)
          hM.rotation.z = -t * 0.35;
          // колокольчик над дверью
          const nd = Math.hypot(hx + 3.95, hz - DZ) < 1.3;
          if (nd && !nearDoor) bellT = 0; nearDoor = nd;
          if (bellT >= 0) { bellT += dt; bell.rotation.x = Math.sin(bellT * 14) * 0.45 * Math.max(0, 1 - bellT / 1.6); if (bellT > 1.6) bellT = -1; } else bell.rotation.x = Math.sin(t * 1.1) * 0.03;
          if (window.__swCam && ctx) { const c = window.__swCam; ctx.camera.position.set(c[0], c[1], c[2]); ctx.camera.lookAt(c[3], c[4], c[5]); }   // DEV
        },
      };
    },
  });
})();
