/* =====================================================================
   Место прогулки: books — Книжная лавка «Закладка».
   Комната 6.4×4.8: кремовые стены, пол из досок, во всю заднюю стену —
   стеллажи с пастельными книгами и лесенка на колёсиках; слева прилавок,
   за ним Матушка Гусыня (очки и вишнёвая шаль), полка «Виноват дворецкий»;
   справа уголок для чтения: пудровое кресло, торшер, столик; в правом
   пролёте стеллажа окно — в нём иногда показывается голова Финалыча.
   Мини «Глава недели».
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'books';
  const W = 6.4, D = 4.8, H = 3.2;
  const CHAIR = { x: 1.9, z: -1.5, ry: -0.5 };
  const ARM = (() => { const a = CHAIR.ry, lx = -0.37, lz = 0.02; return { x: CHAIR.x + lx * Math.cos(a) + lz * Math.sin(a), z: CHAIR.z - lx * Math.sin(a) + lz * Math.cos(a) }; })();
  const LADDER = { x: 1.4, z: -4.08 };

  /* ---------- Комната ---------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#F6EEE2', gnd: '#B89878', hi: 0.6, sun: '#FFE2BE', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #5A3A4A 0%, #2E2028 72%)', rim: ['#FFDCC0', 0.24], fog: '#2E2028' },
    cam: { portrait: { dx: 0, y: 4.85, dz: 5.1, ly: 0.8, lz: -1.55, fov: 54 }, landscape: { dx: 0.2, y: 4.2, dz: 6.6, ly: 1.2, lz: -2.0, fov: 46 } },
    build(R) {
      const { T, PI, put, box, cyl, rbox, GEO } = R;
      const g = R.group;
      const tn = (c, x) => R.toon(c, x);
      const C = { wood: '#B98C6A', woodL: '#D9B48F', woodD: '#8E6248', cream: '#FFF4EC', cherry: '#C2405B', cherryD: '#9E2F47', navy: '#3E4C72', gold: '#E8C770', powder: '#F7C9D3', powderD: '#E8A6B6', mint: '#BFE6D3', ink: '#5B4A3E' };
      const M = {};
      Object.keys(C).forEach(k => { M[k] = tn(C[k]); });
      M.lamp = tn('#FFE3A6', { emissive: new T.Color('#FFC46B'), emissiveIntensity: 0.85, side: T.DoubleSide });
      M.leaf = tn('#8FC48A');
      const hidM = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const st = new T.Group(); g.add(st);   // мебель (с тенью)
      const dc = new T.Group(); g.add(dc);   // стены, пол, книги, мелочи (без тени)
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (key, x, y, z, w, h, d, ry = 0) => { const m = put(g, GEO.box, hidM, [x, y, z], [w, h, d], [0, ry, 0]); m.castShadow = m.receiveShadow = false; m.userData.key = key; return m; };
      const tiled = (w, h, tw, th) => { const ge = R.keep(new T.PlaneGeometry(w, h)), uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tw, uv.getY(i) * h / th); return ge; };
      // одноцветная статика склеивается в одну сетку с цветами вершин: один вызов отрисовки на группу
      const vcM = tn('#FFFFFF', { vertexColors: true });
      const vcBake = (group, cast) => {
        group.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(group.matrixWorld).invert(), parts = [], gone = [];
        let n = 0;
        group.traverse(m => {
          if (!m.isMesh || m.userData.dyn) return;
          for (let q = m.parent; q && q !== group; q = q.parent) if (q.userData.dyn) return;
          const mt = m.material;
          if (!mt || !mt.isMeshToonMaterial || mt.map || mt.transparent || mt.vertexColors || mt.alphaTest || mt.side !== T.FrontSide || (mt.emissiveIntensity > 0 && mt.emissive && mt.emissive.getHex())) return;
          const ge = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          ge.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
          parts.push([ge, mt.color]); n += ge.attributes.position.count; gone.push(m);
        });
        gone.forEach(m => m.parent.remove(m));
        if (n) {
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
          let off = 0;
          parts.forEach(([ge, c]) => { const k = ge.attributes.position.count; pos.set(ge.attributes.position.array, off * 3); nor.set(ge.attributes.normal.array, off * 3); for (let i = 0; i < k; i++) { col[(off + i) * 3] = c.r; col[(off + i) * 3 + 1] = c.g; col[(off + i) * 3 + 2] = c.b; } off += k; ge.dispose(); });
          const mg = R.keep(new T.BufferGeometry()); mg.setAttribute('position', new T.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T.BufferAttribute(nor, 3)); mg.setAttribute('color', new T.BufferAttribute(col, 3)); mg.computeBoundingSphere();
          const mesh = new T.Mesh(mg, vcM); mesh.castShadow = !!cast; mesh.receiveShadow = true; mesh.userData.dyn = true; group.add(mesh);
        }
        R.bake(group, null, { cast: !!cast });
        group.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      };
      const BK = ['#F7C9D3', '#BFE6D3', '#D9CCF4', '#FFE08A', '#B9D7F0', '#F6B7A0', '#C2405B', '#3E4C72', '#FFF4EC', '#E8A6B6'];
      // ряд книг: корешки разной высоты, иногда наклонённая книга или стопка лёжа
      const books = (par, x0, x1, y0, z, hmax, seed, depth = 0.24) => {
        const q = R.rng(seed); let x = x0;
        while (x < x1 - 0.05) {
          const r = q();
          if (r < 0.06 && x1 - x > 0.3) {   // лёжа стопкой
            let y = y0; for (let k = 0; k < 3; k++) { const h = 0.04 + q() * 0.02; box(par, R.pm(BK[Math.floor(q() * BK.length)]), x + 0.13, y + h / 2, z, 0.26, h, depth - 0.03); y += h; }
            x += 0.3; continue;
          }
          const w = 0.045 + q() * 0.04, h = hmax * (0.72 + q() * 0.28), c = BK[Math.floor(q() * BK.length)];
          const tilt = r > 0.94 ? -0.18 : 0;
          box(par, R.pm(c), x + w / 2 + (tilt ? 0.03 : 0), y0 + h / 2, z, w, h, depth, [0, 0, tilt]);
          if (q() < 0.35) box(par, M.gold, x + w / 2, y0 + h * 0.8, z + depth / 2 + 0.002, w * 0.8, 0.012, 0.004);
          x += w + 0.004 + (tilt ? 0.06 : 0);
        }
      };

      /* ---------- атлас надписей и картинок ---------- */
      const [acv, ac] = R.cnv(1024, 1024);
      const atlasM = tn('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 });
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / 1024, u1 = (sx + sw) / 1024, v0 = 1 - (sy + sh) / 1024, v1 = 1 - sy / 1024;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      const A = { exit: [0, 0, 320, 96], sign: [0, 100, 640, 130], butler: [0, 240, 420, 110], newb: [430, 240, 220, 90], rug: [0, 360, 520, 520], view: [530, 360, 300, 420], page: [660, 0, 300, 200], frame: [840, 360, 180, 230] };
      { const c = ac, rr = (x, y, w, h, r, f) => { c.fillStyle = f; R.rrect(c, x, y, w, h, r); c.fill(); };
        rr(0, 0, 320, 96, 18, '#2E2028'); R.text(c, 'ВЫХОД', 160, 50, 58, '#BFF0CE');
        rr(0, 100, 640, 130, 30, '#9E2F47'); c.strokeStyle = '#FFF4EC'; c.lineWidth = 5; R.rrect(c, 10, 110, 620, 110, 24); c.stroke();
        R.text(c, 'ЗАКЛАДКА', 300, 152, 70, '#FFF4EC', { f: 'Comfortaa', w: 700, max: 470 });
        R.text(c, 'книги · тишина · кресло', 300, 200, 28, '#F7C9D3', { w: 800, max: 470 });
        c.fillStyle = '#E8C770'; c.beginPath(); c.moveTo(560, 100); c.lineTo(600, 100); c.lineTo(600, 225); c.lineTo(580, 205); c.lineTo(560, 225); c.fill();
        rr(0, 240, 420, 110, 18, '#3E4C72'); c.strokeStyle = '#E8C770'; c.lineWidth = 4; R.rrect(c, 8, 248, 404, 94, 14); c.stroke();
        R.text(c, 'Виноват дворецкий', 210, 284, 40, '#FFF4EC', { f: 'Caveat', w: 700, max: 380 }); R.text(c, '🔍 детективы', 210, 322, 22, '#E8C770', { w: 800, max: 380 });
        rr(430, 240, 220, 90, 14, '#FFF4EC'); c.strokeStyle = '#C2405B'; c.lineWidth = 4; R.rrect(c, 436, 246, 208, 78, 10); c.stroke();
        R.text(c, 'Новинки', 540, 285, 40, '#C2405B', { f: 'Caveat', w: 700, max: 190 });
        // коврик: вишнёвый круг с кремовым узором
        { const cx = 260, cy = 620; c.fillStyle = '#FFF4EC'; c.beginPath(); c.arc(cx, cy, 256, 0, 7); c.fill(); c.fillStyle = '#C2405B'; c.beginPath(); c.arc(cx, cy, 244, 0, 7); c.fill();
          c.strokeStyle = '#FFF4EC'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 214, 0, 7); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 120, 0, 7); c.stroke();
          for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; c.fillStyle = i % 2 ? '#F7C9D3' : '#FFF4EC'; c.beginPath(); c.ellipse(cx + Math.cos(a) * 168, cy + Math.sin(a) * 168, 26, 12, a, 0, 7); c.fill(); }
          c.fillStyle = '#F7C9D3'; c.beginPath(); c.moveTo(cx, cy + 40); c.bezierCurveTo(cx - 70, cy - 10, cx - 40, cy - 70, cx, cy - 34); c.bezierCurveTo(cx + 40, cy - 70, cx + 70, cy - 10, cx, cy + 40); c.fill(); }
        // вид из окна: вечерний квартал, фонари (солнца нет)
        { const x = 530, y = 360, gr = c.createLinearGradient(0, y, 0, y + 420); gr.addColorStop(0, '#8E86B8'); gr.addColorStop(0.6, '#C8B4D6'); gr.addColorStop(1, '#E9C9D2'); c.fillStyle = gr; c.fillRect(x, y, 300, 420);
          c.fillStyle = '#6A5E88'; [[0, 300, 80], [70, 260, 70], [130, 320, 90], [210, 280, 90]].forEach(([dx, yy, w]) => c.fillRect(x + dx, y + yy, w, 420 - yy));
          c.fillStyle = '#FFD98A'; [[20, 330], [95, 290], [100, 340], [160, 350], [235, 310], [255, 360]].forEach(([dx, yy]) => c.fillRect(x + dx, y + yy, 14, 18));
          c.fillStyle = 'rgba(255,255,255,.6)'; [[60, 60], [200, 40], [240, 120], [120, 110]].forEach(([dx, yy]) => { c.beginPath(); c.arc(x + dx, y + yy, 2.5, 0, 7); c.fill(); });
          c.fillStyle = 'rgba(255,240,250,.55)'; c.beginPath(); c.ellipse(x + 90, y + 170, 70, 18, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + 210, y + 210, 60, 15, 0, 0, 7); c.fill(); }
        // страница раскрытой книги
        { rr(660, 0, 300, 200, 10, '#FFFBF2'); c.fillStyle = '#E8DCC6'; c.fillRect(808, 6, 4, 188); c.strokeStyle = 'rgba(91,74,62,.45)'; c.lineWidth = 3; for (let k = 0; k < 7; k++) { [680, 826].forEach(x0 => { c.beginPath(); c.moveTo(x0, 30 + k * 22); c.lineTo(x0 + 112 - (k === 6 ? 50 : 0), 30 + k * 22); c.stroke(); }); } }
        // рамка с силуэтом лупы
        { rr(840, 360, 180, 230, 12, '#E8C770'); rr(852, 372, 156, 206, 8, '#BFE6D3'); c.strokeStyle = '#3E4C72'; c.lineWidth = 10; c.beginPath(); c.arc(915, 455, 34, 0, 7); c.stroke(); c.lineWidth = 14; c.beginPath(); c.moveTo(940, 480); c.lineTo(975, 530); c.stroke(); }
      }

      /* ---------- пол из досок, коврик ---------- */
      { const [fcv, fc] = R.cnv(512, 512), q = R.rng(21);
        fc.fillStyle = '#B98C6A'; fc.fillRect(0, 0, 512, 512);
        const tones = ['#D9B48F', '#DDB892', '#D2AA84', '#E0BE98', '#D6AF88'], rows = 8, rh = 512 / rows;
        for (let r = 0; r < rows; r++) { let x = -q() * 200; while (x < 512) { const L = 160 + q() * 180; fc.fillStyle = tones[Math.floor(q() * tones.length)]; R.rrect(fc, x + 2, r * rh + 2, L - 4, rh - 4, 6); fc.fill(); fc.strokeStyle = 'rgba(140,96,60,.14)'; fc.lineWidth = 2; fc.beginPath(); fc.moveTo(x + 14, r * rh + rh * 0.45); fc.bezierCurveTo(x + L * 0.4, r * rh + rh * 0.3, x + L * 0.6, r * rh + rh * 0.62, x + L - 14, r * rh + rh * 0.5); fc.stroke(); x += L; } }
        const ft = R.tex(fcv); ft.wrapS = ft.wrapT = T.RepeatWrapping;
        box(dc, M.woodD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
        const fl = put(dc, tiled(W, D, 2.4, 2.4), tn('#FFFFFF', { map: ft }), [0, 0.003, -D / 2], null, [-PI / 2, 0, 0]); fl.castShadow = false; fl.receiveShadow = true;
        aplane(dc, A.rug, [1.4, 0.008, -1.8], [2.0, 2.0, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      }

      /* ---------- стены: кремовые обои в мелкий цветочек, вишнёвые панели ---------- */
      { const [wcv, wc] = R.cnv(256, 256);
        wc.fillStyle = '#FFF4EC'; wc.fillRect(0, 0, 256, 256);
        wc.fillStyle = '#FBE9E4'; wc.fillRect(0, 0, 256, 6); wc.fillRect(0, 128, 256, 6);
        const fl = (x, y) => { wc.fillStyle = '#F4C7D0'; for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; wc.beginPath(); wc.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5.5, 0, 7); wc.fill(); } wc.fillStyle = '#E8C770'; wc.beginPath(); wc.arc(x, y, 3.5, 0, 7); wc.fill(); wc.fillStyle = '#BFE6D3'; wc.beginPath(); wc.ellipse(x + 13, y + 9, 6, 3, 0.6, 0, 7); wc.fill(); };
        fl(64, 64); fl(192, 192); fl(192, 64); fl(64, 192);
        const wT = R.tex(wcv); wT.wrapS = wT.wrapT = T.RepeatWrapping;
        const wallM = tn('#FFFFFF', { map: wT });
        rbox(dc, M.cream, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.04);
        [-1, 1].forEach(sd => {
          rbox(dc, M.cream, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D, 0.04);
          put(dc, tiled(D, H - 0.95, 1.0, 1.0), wallM, [sd * (W / 2 - 0.004), (H + 0.95) / 2, -D / 2], null, [0, -sd * PI / 2, 0]).castShadow = false;
          rbox(dc, M.cherryD, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);
          box(dc, M.cream, sd * (W / 2 - 0.04), H - 0.07, -D / 2, 0.1, 0.14, D);
          box(dc, M.cherryD, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
          box(dc, M.powder, sd * (W / 2 - 0.02), 0.47, -D / 2, 0.04, 0.95, D);
          box(dc, M.cherryD, sd * (W / 2 - 0.045), 0.95, -D / 2, 0.06, 0.05, D);
          box(dc, M.cherryD, sd * (W / 2 - 0.045), 0.06, -D / 2, 0.05, 0.12, D);
          for (let i = sd < 0 ? 1 : 0; i < 4; i++) box(dc, M.powderD, sd * (W / 2 - 0.042), 0.52, -0.6 - i * 1.15, 0.012, 0.52, 0.86);
        });
        box(dc, M.cherryD, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
      }

      /* ---------- стеллажи во всю заднюю стену ---------- */
      const SZ = -4.6, SH = 2.8, ROWS = [0.12, 0.66, 1.2, 1.74, 2.28];
      { rbox(st, M.wood, 0, SH / 2, SZ - 0.15, W, SH, 0.06, 0.02);   // задник
        [-3.17, -1.6, 0, 1.6, 3.17].forEach(x => rbox(st, M.wood, x, SH / 2, SZ, 0.06, SH, 0.38, 0.015));
        ROWS.concat([SH - 0.02]).forEach(y => { if (y > 1.0 && y < 2.7) rbox(st, M.woodL, -0.79, y, SZ + 0.01, W - 1.58, 0.04, 0.4, 0.012); else rbox(st, M.woodL, 0, y, SZ + 0.01, W, 0.04, 0.4, 0.012); });
        rbox(st, M.cherryD, 0, SH + 0.1, SZ + 0.02, W + 0.1, 0.16, 0.46, 0.04);
        box(dc, M.gold, 0, SH + 0.1, SZ + 0.26, W, 0.02, 0.01);
        aplane(dc, A.sign, [-0.2, SH + 0.36, SZ + 0.05], [1.6, 0.325, 1]);
        [[-3.14, -1.63], [-1.57, -0.03], [0.03, 1.57], [1.63, 3.14]].forEach(([a, b], k) => ROWS.forEach((y, i) => { if ((k === 2 && i === 0) || (k === 3 && i >= 2)) return; books(dc, a, b, y + 0.02, SZ + 0.02, 0.44, 100 + k * 10 + i); }));
        // нижняя полка над витриной «самый первый» оставлена под глобус и вазу
        cyl(dc, M.navy, 0.8, 0.27, SZ + 0.02, 0.12, 0.26); cyl(dc, M.gold, 0.8, 0.41, SZ + 0.02, 0.05, 0.03);
        R.sphS(dc, M.mint, 0.45, 0.28, SZ + 0.02, 0.14);
        // латунный рельс для лесенки
        cyl(dc, M.gold, 0, 2.55, SZ + 0.26, 0.018, W - 0.3, [0, 0, PI / 2]);
        [-2.8, 0, 2.8].forEach(x => box(dc, M.gold, x, 2.55, SZ + 0.18, 0.03, 0.03, 0.16));
      }
      // лесенка на колёсиках
      { const lg = grp(st, LADDER.x, 0, LADDER.z); lg.rotation.x = -0.15;
        [-1, 1].forEach(s => cyl(lg, M.woodD, s * 0.2, 1.33, 0, 0.025, 2.66));
        for (let i = 1; i <= 7; i++) cyl(lg, M.woodD, 0, i * 0.34, 0, 0.018, 0.4, [0, 0, PI / 2]);
        [-1, 1].forEach(s => { cyl(lg, M.gold, s * 0.2, 0.04, 0.02, 0.04, 0.03, [0, 0, PI / 2]); put(lg, R.keep(new T.TorusGeometry(0.035, 0.008, 4, 10, PI)), M.gold, [s * 0.2, 2.66, -0.04], null, [0, PI / 2, 0]); }); }

      /* ---------- полка «Виноват дворецкий» на левой стене ---------- */
      const BUT = { x: -3.02, z: -4.0 };
      { const bg2 = grp(st, -W / 2 + 0.01, 0, BUT.z, PI / 2);
        rbox(bg2, M.navy, 0, 0.8, 0.17, 0.82, 1.6, 0.34, 0.02);
        [0.1, 0.55, 1.0, 1.45].forEach(y => box(bg2, M.cream, 0, y, 0.2, 0.76, 0.03, 0.3));
        rbox(bg2, M.navy, 0, 1.62, 0.18, 0.88, 0.06, 0.36, 0.02);
        [0.13, 0.58, 1.03].forEach((y, i) => { const q = new T.Group(); q.rotation.y = 0; bg2.add(q); books(q, -0.36, 0.34, y + 0.015, 0.21, 0.38, 300 + i, 0.24); }); }
      // табличка над полкой — повёрнута к залу, чтобы читалась
      { const sg = grp(dc, -W / 2 + 0.5, 0, BUT.z + 0.05, 0.42); rbox(sg, M.gold, 0, 1.9, -0.012, 0.82, 0.25, 0.02, 0.02); aplane(sg, A.butler, [0, 1.9, 0.002], [0.78, 0.205, 1]); box(sg, M.gold, -0.3, 1.72, -0.02, 0.02, 0.14, 0.02); box(sg, M.gold, 0.3, 1.72, -0.02, 0.02, 0.14, 0.02); }
      // книжка, которая выезжает (k_but)
      const slideBook = new T.Group(); slideBook.position.set(-W / 2 + 0.22, 1.03 + 0.2, BUT.z + 0.33); g.add(slideBook);
      box(slideBook, R.pm('#E8C770'), 0, 0, 0, 0.24, 0.34, 0.035); box(slideBook, R.pm('#C2405B'), 0.121, 0, 0, 0.004, 0.3, 0.03);
      vcBake(slideBook, false);
      let slideK = 0, slideOn = false;

      /* ---------- витрина «самый первый детектив» ---------- */
      const FX = -0.4, FZ = -3.6;
      rbox(st, M.wood, FX, 0.42, FZ, 0.46, 0.84, 0.46, 0.04); rbox(st, M.woodL, FX, 0.86, FZ, 0.54, 0.05, 0.54, 0.02);
      cyl(st, M.cherry, FX, 0.92, FZ, 0.16, 0.06);
      { const ob = grp(st, FX, 0.98, FZ, 0.2); ob.rotation.x = -0.25;
        [-1, 1].forEach(s => { const pg = grp(ob, 0, 0, 0, 0); pg.rotation.z = s * 0.12; box(pg, R.pm('#7A4A3A'), s * 0.085, 0, 0, 0.17, 0.012, 0.22); box(pg, R.pm('#FFF4E0'), s * 0.08, 0.012, 0, 0.155, 0.012, 0.2); });
        box(ob, M.gold, 0, 0.022, 0, 0.012, 0.004, 0.2); }
      const gl = put(g, GEO.box, R.keep(new T.MeshToonMaterial({ color: new T.Color('#EAF6FF'), transparent: true, opacity: 0.22, depthWrite: false })), [FX, 1.06, FZ], [0.46, 0.36, 0.46]);
      gl.castShadow = gl.receiveShadow = false; gl.renderOrder = 2; gl.raycast = () => {};
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(st, M.gold, FX + a * 0.23, 1.06, FZ + b * 0.23, 0.02, 0.36, 0.02));
      box(st, M.gold, FX, 1.245, FZ, 0.5, 0.02, 0.5);

      /* ---------- стол «Новинки» с книгами в лентах ---------- */
      const NX = 0.6, NZ = -2.3;
      rbox(st, M.cream, NX, 0.74, NZ, 0.94, 0.05, 0.64, 0.02);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(st, M.woodD, NX + a * 0.4, 0.36, NZ + b * 0.25, 0.025, 0.72));
      box(st, M.powder, NX, 0.7, NZ + 0.33, 0.94, 0.12, 0.012);
      [[-0.28, 0.02, 4], [0.05, -0.08, 3], [0.3, 0.1, 5]].forEach(([dx, dz, n], k) => {
        let y = 0.765; const q = R.rng(400 + k), ww = 0.24 + q() * 0.04, dd = 0.17;
        for (let i = 0; i < n; i++) { const h = 0.035 + q() * 0.02; box(st, R.pm(BK[Math.floor(q() * 8)]), NX + dx, y + h / 2, NZ + dz, ww - i * 0.008, h, dd - i * 0.006, [0, (q() - 0.5) * 0.2, 0]); y += h; }
        box(st, M.cherry, NX + dx, (0.765 + y) / 2, NZ + dz, 0.02, y - 0.765 + 0.01, dd + 0.012);
        box(st, M.cherry, NX + dx, y + 0.004, NZ + dz, 0.02, 0.008, dd + 0.012);
        [-1, 1].forEach(s => R.sphS(st, M.cherry, NX + dx + s * 0.03, y + 0.02, NZ + dz, 0.028, 0.018, 0.012));
      });
      { const sg = grp(st, NX + 0.05, 0.765, NZ + 0.2, 0); const cd = grp(sg, 0, 0, 0, 0); cd.rotation.x = -0.25; aplane(cd, A.newb, [0, 0.07, 0], [0.26, 0.106, 1]); }

      /* ---------- уголок для чтения: кресло, торшер, столик, окно ---------- */
      { const ch = grp(st, CHAIR.x, 0, CHAIR.z, CHAIR.ry);
        rbox(ch, M.powder, 0, 0.36, 0.03, 0.76, 0.22, 0.66, 0.09);
        rbox(ch, M.powder, 0, 0.76, -0.28, 0.8, 0.8, 0.2, 0.1);
        [-1, 1].forEach(s => rbox(ch, M.powderD, s * 0.38, 0.52, 0.0, 0.16, 0.36, 0.72, 0.07));
        [[-0.3, 0.26], [0.3, 0.26], [-0.3, -0.24], [0.3, -0.24]].forEach(([x, z]) => put(ch, GEO.cylLo, M.woodD, [x, 0.12, z], [0.03, 0.24, 0.03]));
        R.sphS(ch, M.cream, 0.1, 0.62, -0.14, 0.17, 0.15, 0.07);
        put(ch, R.heartG, M.cherry, [0.1, 0.63, -0.06], [0.07, 0.07, 0.05]);
        box(ch, R.pm('#BFE6D3'), 0.38, 0.715, 0.12, 0.13, 0.04, 0.18, [0, 0.2, 0]); }   // томик на подлокотнике
      { cyl(st, M.gold, 2.7, 0.02, -1.1, 0.16, 0.04); cyl(st, M.gold, 2.7, 0.82, -1.1, 0.018, 1.6);
        put(st, R.keep(new T.CylinderGeometry(0.15, 0.26, 0.3, 18, 1, true)), M.lamp, [2.7, 1.72, -1.1]);
        R.sphS(st, M.lamp, 2.7, 1.62, -1.1, 0.05);
        R.halo(g, 2.6, 1.6, -1.05, 1.4, '#FFD49A', 0.5); }
      { cyl(st, M.woodD, 2.6, 0.27, -2.2, 0.04, 0.54); cyl(st, M.woodL, 2.6, 0.56, -2.2, 0.26, 0.04); cyl(st, M.woodD, 2.6, 0.02, -2.2, 0.14, 0.04);
        let y = 0.58; const q = R.rng(77); for (let i = 0; i < 3; i++) { const h = 0.04 + q() * 0.02; box(st, R.pm(BK[i + 1]), 2.62, y + h / 2, -2.25, 0.22 - i * 0.02, h, 0.16, [0, 0.3 + i * 0.15, 0]); y += h; } }
      // раскрытая книга на столике: страница перелистывается
      const openBook = grp(g, 2.52, 0.6, -2.08, 0.4);
      { aplane(openBook, A.page, [0, 0.015, 0], [0.3, 0.2, 1], [-PI / 2, 0, 0]); box(openBook, R.pm('#C2405B'), 0, 0.004, 0, 0.32, 0.008, 0.21); }
      const pagePivot = new T.Group(); pagePivot.position.set(0, 0.02, 0); openBook.add(pagePivot);
      const pageMesh = put(pagePivot, GEO.plane, R.pm('#FFFBF2'), [0.075, 0, 0], [0.15, 0.2, 1], [-PI / 2, 0, 0]); pageMesh.castShadow = false;
      R.pm('#FFFBF2').side = T.DoubleSide;
      // окно в правом пролёте стеллажа (в вертикальном кадре боковые стены видны вскользь — окно смотрит в камеру)
      const WX = 2.4, WY = 1.98, WZb = SZ - 0.115;
      { const wg = grp(dc, WX, 0, WZb, 0);
        aplane(wg, A.view, [0, WY, 0], [0.92, 1.24, 1]);
        put(wg, R.frameGeo(0.92, 1.24, 0.07, false), M.cream, [0, WY, 0.005]);
        box(wg, M.cream, 0, WY, 0.06, 0.035, 1.24, 0.03); box(wg, M.cream, 0, WY + 0.14, 0.06, 0.92, 0.035, 0.03);
        rbox(wg, M.cream, 0, WY - 0.7, 0.16, 1.2, 0.06, 0.3, 0.02);
        cyl(wg, M.cherry, 0.36, WY - 0.6, 0.18, 0.06, 0.12); R.sphS(wg, M.leaf, 0.36, WY - 0.5, 0.18, 0.09, 0.07, 0.08);
        [-1, 1].forEach(s2 => { for (let i = 0; i < 3; i++) put(wg, GEO.cylLo, i % 2 ? M.powderD : M.powder, [s2 * (0.55 + i * 0.045), WY + 0.02, 0.2], [0.032, 1.36, 0.032]); });
        cyl(wg, M.gold, 0, WY + 0.72, 0.2, 0.014, 1.38, [0, 0, PI / 2]); }
      { const q = grp(dc, W / 2 - 0.01, 0, -3.3, -PI / 2); aplane(q, A.frame, [0, 1.8, 0.02], [0.4, 0.51, 1]); }
      // Финалыч заглядывает в окно (голова) — выезжает из-за стекла
      const peek = R.npc.goose({ headOnly: true, popcorn: false });
      peek.root.position.set(WX - 0.05, WY - 0.97, WZb - 0.62); peek.root.scale.setScalar(1.15); peek.root.visible = false; peek.root.userData.key = 'spot:window'; g.add(peek.root);
      peek.root.traverse(m => { if (m.isMesh) m.castShadow = false; });

      /* ---------- прилавок и Матушка Гусыня ---------- */
      const KX = -2.0, KZ = -2.6;
      rbox(st, M.wood, KX, 0.46, KZ, 1.4, 0.92, 0.6, 0.05);
      rbox(st, M.cream, KX, 0.95, KZ, 1.5, 0.06, 0.68, 0.03);
      [-0.36, 0.36].forEach(dx => rbox(dc, M.cherryD, KX + dx, 0.48, KZ + 0.305, 0.56, 0.6, 0.02, 0.04));
      box(dc, M.gold, KX, 0.85, KZ + 0.31, 1.36, 0.02, 0.01);
      { let y = 0.98; const q = R.rng(88); for (let i = 0; i < 4; i++) { const h = 0.035 + q() * 0.02; box(st, R.pm(BK[Math.floor(q() * BK.length)]), KX - 0.45, y + h / 2, KZ, 0.24, h, 0.17, [0, (q() - 0.5) * 0.3, 0]); y += h; } }
      // корзиночка с закладками
      rbox(st, M.woodL, KX + 0.42, 1.03, KZ + 0.05, 0.22, 0.1, 0.14, 0.03);
      ['#C2405B', '#BFE6D3', '#FFE08A', '#D9CCF4', '#F7C9D3'].forEach((c, i) => box(st, R.pm(c), KX + 0.34 + i * 0.04, 1.13, KZ + 0.05, 0.025, 0.16, 0.004, [0, 0, (i - 2) * 0.08]));
      rbox(st, M.woodD, KX - 0.1, 0.21, -3.25, 0.66, 0.42, 0.46, 0.04);
      const aunt = R.npc.goose({ popcorn: false });
      aunt.root.position.set(KX - 0.1, 0.42, -3.25); aunt.root.scale.setScalar(1.15); aunt.root.userData.key = 'npc:gaunt'; g.add(aunt.root);
      { const gq = new T.Group(); aunt.head.add(gq);
        [-1, 1].forEach(s => put(gq, R.ringG(0.034, 0.007), M.ink, [s * 0.045, 0.005, 0.1], null, [0, s * 0.25, 0]));
        box(gq, M.ink, 0, 0.008, 0.108, 0.025, 0.006, 0.006);
        vcBake(gq, false); }
      { const sq = new T.Group(); aunt.body.add(sq);
        put(sq, R.keep(new T.TorusGeometry(0.15, 0.05, 8, 20)), M.cherry, [0, 0.47, 0.0], [1, 1, 0.9], [PI / 2 - 0.25, 0, 0]);
        box(sq, M.cherry, 0.07, 0.36, 0.15, 0.07, 0.18, 0.03, [0.15, 0, -0.2]);
        vcBake(sq, false); }
      aunt.root.traverse(m => { if (m.isMesh) m.castShadow = false; });
      let tiltT = 0;
      { const ex0 = aunt.extra; aunt.extra = (t, dt) => { if (ex0) ex0(t, dt); tiltT += dt; const k = (tiltT % 7) / 7, e = k > 0.85 ? Math.sin((k - 0.85) / 0.15 * PI) : 0; if (aunt.head) { aunt.head.rotation.x = e * 0.22; aunt.head.rotation.z += e * 0.12; } }; }

      /* ---------- дверь на улицу ---------- */
      const DZ = -0.95;
      { const dv = grp(dc, -W / 2 + 0.01, 0, DZ, PI / 2);
        put(dv, R.extrude(R.archShape(1.2, 2.3), 0.06), M.cream, [0, 0, 0.01]);
        put(dv, R.extrude(R.archShape(1.0, 2.16), 0.06), M.cherryD, [0, 0, 0.06]);
        [-0.22, 0.22].forEach(x => rbox(dv, M.cherry, x, 0.6, 0.13, 0.32, 0.66, 0.03, 0.05));
        cyl(dv, M.lamp, 0, 1.55, 0.12, 0.15, 0.03, [PI / 2, 0, 0]); put(dv, R.ringG(0.16, 0.022), M.gold, [0, 1.55, 0.13]);
        R.sphS(dv, M.gold, 0.38, 1.02, 0.15, 0.045);
        rbox(dv, M.gold, 0, 2.62, 0.05, 0.74, 0.26, 0.04, 0.03); aplane(dv, A.exit, [0, 2.62, 0.075], [0.7, 0.21, 1]);
        const dg = grp(g, -W / 2 + 0.01, 0, DZ, PI / 2, 'exitDoor'); const hb = put(dg, GEO.box, hidM, [0, 1.25, 0.12], [1.25, 2.6, 0.3]); hb.castShadow = hb.receiveShadow = false;
        R.halo(g, -W / 2 + 0.25, 2.62, DZ, 0.7, '#BFF0CE', 0.35); }
      // рамка на левой стене, бра, лампа над столом новинок
      { const q = grp(dc, -W / 2 + 0.01, 0, -2.3, PI / 2); aplane(q, A.frame, [0, 1.9, 0.02], [0.4, 0.51, 1]); }
      { const sg = grp(dc, -W / 2 + 0.02, 0, -1.75, PI / 2);
        box(sg, M.cherryD, 0, 2.35, 0.03, 0.07, 0.14, 0.05); cyl(sg, M.cherryD, 0, 2.38, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
        put(sg, GEO.cylLo, M.lamp, [0, 2.29, 0.26], [0.065, 0.15, 0.065]); put(sg, GEO.cone, M.gold, [0, 2.42, 0.26], [0.1, 0.08, 0.1]);
        R.halo(g, -W / 2 + 0.3, 2.3, -1.75, 0.95, '#FFC890', 0.45); }
      { cyl(dc, M.ink, NX, 2.75, NZ, 0.006, 0.9); put(dc, GEO.hemi, M.powder, [NX, 2.3, NZ], [0.22, 0.16, 0.22]); R.sphS(dc, M.lamp, NX, 2.28, NZ, 0.07);
        R.halo(g, NX, 2.2, NZ + 0.05, 1.1, '#FFD49A', 0.4); }

      // пылинки под торшером
      const DN = 4, dpos = new Float32Array(DN * 3);
      for (let i = 0; i < DN; i++) { dpos[i * 3] = 2.5 + Math.random() * 0.3; dpos[i * 3 + 1] = 0.8 + Math.random() * 0.7; dpos[i * 3 + 2] = -1.2 + Math.random() * 0.3; }
      const dgeo = R.keep(new T.BufferGeometry()); dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
      const dust = new T.Points(dgeo, R.keep(new T.PointsMaterial({ map: R.haloTex, color: 0xFFF0C8, size: 0.08, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
      dust.frustumCulled = false; g.add(dust);

      vcBake(st, true);
      vcBake(dc, false);

      /* ---------- ловушки тапа ---------- */
      hit('spot:chair', CHAIR.x, 0.55, CHAIR.z, 0.95, 1.1, 0.95, CHAIR.ry);
      hit('spot:butler', -W / 2 + 0.2, 1.0, BUT.z, 0.4, 2.0, 0.95);
      hit('spot:first', FX, 0.65, FZ, 0.6, 1.3, 0.6);
      hit('spot:ribboned', NX, 0.55, NZ, 1.05, 1.1, 0.75);
      hit('spot:ladder', LADDER.x, 1.3, LADDER.z, 0.6, 2.6, 0.5);
      hit('spot:window', WX, WY, SZ + 0.12, 1.05, 1.35, 0.3);

      const blockers = [
        { x0: -3.2, x1: 3.2, z0: -4.8, z1: -4.4 },                         // стеллажи
        { x0: LADDER.x - 0.25, x1: LADDER.x + 0.25, z0: -4.4, z1: -4.0 },  // лесенка
        { x0: -3.2, x1: -2.85, z0: -4.4, z1: -3.6 },                       // полка дворецкого
        { x0: FX - 0.25, x1: FX + 0.25, z0: FZ - 0.25, z1: FZ + 0.25 },    // витрина
        { x0: NX - 0.47, x1: NX + 0.47, z0: NZ - 0.32, z1: NZ + 0.32 },    // стол новинок
        { x0: CHAIR.x - 0.38, x1: CHAIR.x + 0.38, z0: CHAIR.z - 0.38, z1: CHAIR.z + 0.32 },   // кресло
        { x0: 2.55, x1: 2.85, z0: -1.25, z1: -0.95 },                      // торшер
        { x0: 2.34, x1: 2.86, z0: -2.46, z1: -1.94 },                      // столик
        { x0: KX - 0.7, x1: KX + 0.7, z0: KZ - 0.3, z1: KZ + 0.3 },        // прилавок
        { x0: KX - 0.43, x1: KX + 0.23, z0: -3.48, z1: -3.0 },             // Гусыня на ступеньке
      ];
      // голова в окне: выглядывает через 15 с, прячется через 6 с или по тапу
      let peekT = 0, peekNext = 15, peekK = 0, peekOn = false, peekLeft = 0;
      let hop = -1, catY = 0;
      const out = {
        W, D,
        bounds: { x0: -2.9, x1: 2.9, z0: -4.15, z1: -0.4 },
        exit: { x: -W / 2 + 0.45, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -1.4, z: -1.2 },
        cam: { x0: -1.35, x1: 1.35, z: -1.0 },
        blockers,
        catSpot: { x: 0.9, z: -1.2, ry: -0.3 },
        spots: [
          { id: 'chair', x: 1.2, z: -1.0, act: 'Почитать', bubble: 'кресло для чтения' },
          { id: 'butler', x: -2.5, z: -4.0, act: 'Посмотреть', bubble: '«Виноват дворецкий»' },
          { id: 'first', x: -0.4, z: -2.95, act: 'Рассмотреть', bubble: 'самый первый детектив' },
          { id: 'ribboned', x: 0.1, z: -1.6, act: 'Посмотреть', bubble: 'новинки в лентах' },
          { id: 'ladder', x: 1.4, z: -3.6, act: 'Залезть', bubble: 'лесенка' },
          { id: 'window', x: 2.62, z: -3.85, act: 'Выглянуть', bubble: 'окно' },
        ],
        npcs: { gaunt: aunt },
        i3k: {
          peeking: () => peekOn,
          hidePeek() { peekOn = false; },
          slideBook() { slideOn = true; },
          hop() { hop = 0; },
        },
        tick(t, dt, ctx) {
          // страница раскрытой книги
          { const k = (t % 6) / 6, f = k > 0.8 ? (k - 0.8) / 0.2 : 0; pagePivot.rotation.z = f * PI; pageMesh.visible = f > 0.001; }
          // дворецкий: книжка выезжает
          if (slideOn && slideK < 1) { slideK = Math.min(1, slideK + dt * 2.5); slideBook.position.x = -W / 2 + 0.22 + slideK * 0.12; }
          // пылинки
          for (let i = 0; i < DN; i++) { let y = dpos[i * 3 + 1] + dt * 0.05; if (y > 1.6) y = 0.8; dpos[i * 3 + 1] = y; dpos[i * 3] = 2.6 + Math.sin(t * 0.6 + i * 1.7) * 0.15; }
          dgeo.attributes.position.needsUpdate = true;
          // Финалыч в окне
          // по настоящим часам: на медленном телефоне dt урезается, а 15 секунд должны быть секундами
          const now = performance.now() / 1000; if (!peekT) peekT = now;
          if (!peekOn && now - peekT >= peekNext) { peekOn = true; peekLeft = now + 6; peekNext = now - peekT + 50; }
          if (peekOn && now >= peekLeft) peekOn = false;
          peekK += ((peekOn ? 1 : 0) - peekK) * Math.min(1, dt * 5);
          peek.root.visible = peekK > 0.02; peek.root.position.z = WZb - 0.62 + peekK * 0.45;
          if (peek.root.visible) peek.anim(t, dt, ctx ? ctx.px : 0, ctx ? ctx.pz : 0);
          // героиня на нижней ступеньке лесенки
          if (ctx && ctx.hero) {
            if (hop >= 0) { hop += dt; const e = hop < 0.25 ? hop / 0.25 : hop > 1.5 ? Math.max(0, 1 - (hop - 1.5) / 0.25) : 1; ctx.hero.root.position.y = e * 0.3; ctx.hero.root.position.z += e * -0.18; if (hop > 1.75) { hop = -1; ctx.hero.root.position.y = 0; } }
            // кот на подлокотнике кресла
            if (ctx.cat && ctx.cat.root.visible) {
              const cp = ctx.cat.root.position, on = Math.hypot(cp.x - ARM.x, cp.z - ARM.z) < 0.12;
              catY += ((on ? 0.56 : 0) - catY) * Math.min(1, dt * 7); cp.y = catY;
            }
          }
        },
      };
      return out;
    },
  });

  /* ---------- Говорящие ---------- */
  if (G.addSpeakers) G.addSpeakers({ gaunt: { name: () => 'Матушка Гусыня', art: () => G.emojiAvatar('🪿', '#F7C9D3') } });

  /* ---------- Глава недели: «Дело о пропавшей варежке» ---------- */
  const CHAPTERS = [
    ['На лавочке осталась одна варежка. Вторая исчезла без следа.', 'Ветер всё отрицает, но шуршит подозрительно.', 'Продолжение следует.'],
    ['Голуби видели что-то пушистое. Описать не смогли: отвлеклись на крошки.', 'Пушистое ушло в сторону парка.', 'Продолжение следует.'],
    ['У кота алиби: спал. Улика — отлежанное ухо.', 'Кот обижен, что его вообще спросили.', 'Продолжение следует.'],
    ['У скамейки нашлись крошечные следы: четыре лапки и хвостик.', 'Хвостик — пушистый. Круг сужается.', 'Продолжение следует.'],
    ['Кто в парке запасает всё на зиму?', 'Следствие идёт по дорожке из ореховых скорлупок.', 'Продолжение следует.'],
    ['Варежка нашлась в дупле. Белочка спала в ней, как в спальнике.', 'Белочка не крала. Она утеплялась.', 'Продолжение следует.'],
    ['Варежку вернули хозяйке. Белочке связали свою, по размеру.', 'Дело закрыто. Все в тепле.', 'Конец. Белочка передаёт спасибо — тёплое, варежковое.'],
  ];
  // следующая непрочитанная глава, доступная к этой неделе (не больше week()+1), иначе последняя доступная
  const chapterFor = ctx => { const cap = Math.max(1, Math.min(7, ctx.week + 1)), ch = ctx.town.ch || 0; return ch + 1 <= cap ? ch + 1 : cap; };
  Town.style(P, `
    .modal.sheet.bk-sheet .sheet-card { background: #FFF8EC; }
    .bk-book { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }
    .bk-head { text-align: center; }
    .bk-title { font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: #7A3A44; line-height: 1.2; }
    .bk-ch { font-family: Georgia, 'Times New Roman', serif; font-style: italic; color: #A0707A; font-size: 15px; margin-top: 2px; }
    .bk-page { flex: 1; position: relative; background: #FFFDF6; border: 1px solid #EADFCB; border-radius: 6px 14px 14px 6px; box-shadow: inset 10px 0 14px -10px rgba(122,80,60,.35), 0 2px 0 #E8DCC6, 0 4px 0 #F3EADA; padding: 26px 20px 34px 26px; min-height: 220px; display: flex; align-items: center; cursor: pointer; transform-origin: left center; }
    .bk-page p { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 1.5; color: #4A3A40; font-weight: 400; }
    .bk-page.turn { animation: bkTurn .38s ease; }
    @keyframes bkTurn { 0% { transform: perspective(700px) rotateY(0); opacity: 1; } 45% { transform: perspective(700px) rotateY(-70deg); opacity: .25; } 100% { transform: perspective(700px) rotateY(0); opacity: 1; } }
    .bk-page::before { content: '❦'; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); color: #E2B4BE; font-size: 22px; }
    .bk-page::after { content: '· · ·'; position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); color: #D8C4B4; font-size: 14px; letter-spacing: 2px; }
    .bk-num { position: absolute; right: 16px; bottom: 10px; font-family: Georgia, serif; font-size: 13px; color: #B09A8A; }
    .bk-mark { position: absolute; top: -4px; right: 26px; width: 14px; height: 46px; background: #C2405B; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); }
    .bk-next { width: 100%; min-height: 48px; }
  `);
  function readChapter(ctx, N) {
    const pages = CHAPTERS[N - 1];
    const el = document.createElement('div'); el.className = 'bk-book';
    el.innerHTML = `<div class="bk-head"><div class="bk-title">Дело о пропавшей варежке</div><div class="bk-ch">глава ${N}</div></div><div class="bk-page"><i class="bk-mark"></i><p></p><span class="bk-num"></span></div><button class="btn bk-next">дальше</button>`;
    return ctx.sheet({
      title: 'Глава недели', body: el, full: true, cls: 'bk-sheet',
      onMount(body, close) {
        let i = 0;
        const pg = body.querySelector('.bk-page'), p = pg.querySelector('p'), num = pg.querySelector('.bk-num'), btn = body.querySelector('.bk-next');
        const show = () => { p.textContent = pages[i]; num.textContent = `${i + 1} / ${pages.length}`; btn.textContent = i < pages.length - 1 ? 'дальше' : 'закрыть книгу'; };
        const next = e => {
          if (e) e.stopPropagation();
          G.haptic('light');
          if (i < pages.length - 1) { i++; pg.classList.remove('turn'); void pg.offsetWidth; pg.classList.add('turn'); setTimeout(show, 160); if (window.Town && Town.log) Town.log('page'); }
          else close('done');
        };
        pg.addEventListener('click', next); btn.addEventListener('click', next);
        show();
      },
    });
  }

  /* ---------- Помощники ---------- */
  const room = ctx => (ctx.is3d && ctx.api && ctx.api.room && ctx.api.room.i3k ? ctx.api.room : null);
  const VS = new WeakMap();
  const vs = ctx => { let v = VS.get(ctx); if (!v) { v = {}; VS.set(ctx, v); } return v; };

  async function readMini(ctx) {
    ctx.mark('sit');
    await ctx.sit({ x: CHAIR.x, z: CHAIR.z, ry: CHAIR.ry, from: [1.2, -1.0] });
    if (ctx.is3d && ctx.catHere) { try { ctx.api.catTo(ARM.x, ARM.z, { ry: CHAIR.ry }); } catch (e) { /* ignore */ } }
    if (!ctx.has('austen')) await ctx.say({ f: 'austen' });
    const N = chapterFor(ctx), t = ctx.town;
    if ((t.ch || 0) < N) { t.ch = N; G.save(); }
    await readChapter(ctx, N);
    if (ctx.catHere) {
      if (!ctx.has('k_cat')) await ctx.say({ text: 'Пирожок уснул на подлокотнике на второй странице. Читает во сне.', s: 'k_cat' });
      else await ctx.play('Пирожок дочитал главу до конца. Во сне, но всё же.');
    }
    ctx.mark('mini-end');
    return true;
  }

  /* ---------- Место ---------- */
  Town.place({
    id: P, kind: 'new',
    name: 'Книжная лавка «Закладка»', short: 'Книжная лавка',
    sign: 'ЗАКЛАДКА', motto: 'книги · тишина · кресло',
    icon: '📚', color: '#F6D5DC',
    street: { x: 33.9, w: 3.4, doorDx: 0, bkey: null },
    room: P, opens: 2,
    host: { who: 'gaunt', npc: 'gaunt' },
    greet: {
      first: 'Добро пожаловать. Я тётя Финалыча. Да, фамильный талант к спойлерам — наша боль.',
      again: Town.v('Заходи! Лучшее кресло свободно, книга тебя ждёт.', '{name}, здравствуйте. Глава на кресле, лампа включена.', 'Проходи. Финалыча здесь нет. Это лучшая новость дня.'),
      regular: Town.v('Ваше кресло свободно: я не пускала даже племянника.', 'Для постоянной читательницы закладка уже на месте.', 'Тише… это я книгам. А вам — здравствуйте.'),
      away: 'Пока тебя не было, я переставила детективы. Дворецкого поставила отдельно. За поведение.',
    },
    bark: 'Снова вы. Тихонько проходите.',
    weekly: { 1: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.', 2: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.', 3: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.', 4: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.', 5: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.', 6: 'Новая глава „Дела о пропавшей варежке“ уже на кресле.' },
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      popcorn: 'С попкорном в книжный? Только не над редкими изданиями, пожалуйста.',
      cup: 'Какао — на подставку. Книги любят какао, но издалека.',
      bouquet: 'С букетом так красиво, будто книжная сама себя украсила.',
      look: 'Новый образ! Хорошая история достойна красивой обложки.',
    },
    spots: {
      chair: { icon: '🛋', label: 'Кресло для чтения', onUse: ctx => readMini(ctx) },
      butler: {
        icon: '🔍', label: 'Полка «Виноват дворецкий»',
        lines: ['На полке жалоба дворецких: «Почему всегда мы?!»', { f: 'watsn' }],
        onUse: async ctx => {
          if (ctx.n('butler') !== 3 || ctx.has('k_but')) return false;
          const R3 = room(ctx); if (R3) R3.i3k.slideBook();
          await ctx.say({ text: 'Выдвинулась тонкая книжка: «Дворецкий. Прошу считать меня невиновным».', s: 'k_but' });
          return true;
        },
      },
      first: {
        icon: '📖', label: 'Самый первый детектив',
        lines: [{ f: 'poe' }, 'Книга под стеклом: даже Финалыч не знает, чем она кончается. Не дотянулся.'],
      },
      ribboned: {
        icon: '🎀', label: 'Новинки в лентах',
        lines: ['Книги перевязаны лентами. Иначе Финалыч листает их с конца.', [{ f: 'mouse' }, { who: 'gaunt', text: 'Финалыча туда не пускают. Давно.' }]],
      },
      ladder: {
        icon: '🪜', label: 'Лесенка на колёсиках',
        onUse: async ctx => {
          const R3 = room(ctx);
          if (R3) { try { ctx.api.face(Math.PI); R3.i3k.hop(); } catch (e) { /* ignore */ } }
          const n = ctx.n('ladder');
          if (n === 1) await ctx.play('Лесенка на колёсиках. Ступеньки на месте — все до одной.');
          else if (!ctx.has('k_udol')) await ctx.say({ text: 'На верхней полке толстый роман с закладкой на середине. Табличка: „Читать при свете лампы“.', s: 'k_udol' });
          else await ctx.play(n % 2 ? 'Лесенка на колёсиках. Ступеньки на месте — все до одной.' : 'С нижней ступеньки видно всю лавку. И немножко — верхнюю полку.');
          if (R3) await ctx.wait(400);
          if (R3) { try { ctx.api.faceCamera(); } catch (e) { /* ignore */ } }
          return true;
        },
      },
      window: {
        icon: '🪟', label: 'Окно',
        onUse: async ctx => {
          const R3 = room(ctx), v = vs(ctx);
          // в 3D — если в окне голова Финалыча; в 2D он «выглядывает» при первом взгляде в окно за визит
          const peeking = R3 ? R3.i3k.peeking() : !v.peeked;
          if (!peeking) { await ctx.play('За окном тихо. Значит, Финалыч где-то рядом.'); return true; }
          v.peeked = true;
          if (!R3) await ctx.play('В окне показалась знакомая голова. Белая, с клювом.');
          await ctx.say({ who: 'goose', text: 'Га! В этой книге в конце…' });
          await ctx.say({ who: 'gaunt', text: 'Финалыч, домой! С закрытым клювом.' });
          if (R3) R3.i3k.hidePeek();
          if (!ctx.flag('f2')) ctx.flag('f2', 1);
          return true;
        },
      },
    },
    npc: {
      gaunt: [
        { who: 'gaunt', f: 'goose' },
        { who: 'gaunt', f: 'chrst' },
        { who: 'gaunt', text: 'Закладка — маленькое обещание вернуться. Хорошее, между прочим.' },
      ],
    },
    facts: {
      austen: { text: 'На подлокотнике — томик Остин. „Гордость и предубеждение“ сначала называлось „Первые впечатления“.' },
      watsn: { text: 'Фразы „Элементарно, Ватсон“ у Конан Дойла нет. Слова есть, а вместе не встречаются.' },
      poe: { text: 'Первым детективом считают рассказ Эдгара По 1841 года. Сыщик Дюпен появился на 46 лет раньше Шерлока.' },
      mouse: { text: 'Пьеса Кристи „Мышеловка“ идёт в Лондоне с 1952 года. Зрителей просят не выдавать развязку.' },
      goose: { text: 'Моё имя — на книжке Перро 1697 года: „Сказки матушки Гусыни“. Писала не я, но приятно.' },
      chrst: { text: 'Агату Кристи переводят чаще всех авторов в мире. Так считает ЮНЕСКО.' },
    },
    secrets: [
      { id: 'k_but', title: 'Версия дворецкого', trigger: 'butler shelf: 3rd use in a session' },
      { id: 'k_udol', title: 'Роман с закладкой', trigger: 'ladder: 2nd climb' },
      { id: 'k_cat', title: 'Кот-читатель', trigger: 'read a chapter with the cat here' },
    ],
    stamp: { title: 'Закладка', icon: '📚' },
  });
})();
