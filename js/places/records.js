/* =====================================================================
   Место прогулки: records — Пластинки «Сторона Б».
   Комната 6.4×4.8: масляно-жёлтые обои над лавандовыми панелями, пол в
   шахматку, прилавок с проигрывателем (за ним гусь Финалыч в наушниках),
   стеклянная будка прослушивания, ящики с пластинками, граммофон,
   саксофон на стене. Мини «Послушать»: сесть в будку, надеть наушники,
   выбрать пластинку (мелодия генерируется WebAudio, без записей).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'records';
  const W = 6.4, D = 4.8, H = 3.2;
  // пластинка недели (§9); магазин открывается с недели 1
  const REC = ['Шорох листьев', 'Вязаный блюз', 'Голубиный хор', 'Колыбельная для фонаря', 'Ноябрьский джаз', 'Скрип снега, live', 'Тёплые огни'];
  const recOf = w => REC[Math.max(0, Math.min(6, w))];
  const BOOTH = { x: 2.3, z: -2.6 };

  /* ---------- Комната ---------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#F8F0D8', gnd: '#B9A08A', hi: 0.64, sun: '#FFE6C8', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #4A3D5E 0%, #2A2236 72%)', rim: ['#FFE0C8', 0.22], fog: '#2A2236' },
    cam: { portrait: { dx: 0, y: 4.85, dz: 5.1, ly: 0.8, lz: -1.55, fov: 54 }, landscape: { dx: 0.2, y: 4.2, dz: 6.6, ly: 1.2, lz: -2.0, fov: 46 } },
    build(R) {
      const { T, PI, put, box, cyl, rbox, GEO } = R;
      const g = R.group;
      const tn = (c, x) => R.toon(c, x);
      const C = { wood: '#B98C6A', woodL: '#D6AC80', woodD: '#8E6248', cream: '#FFF4EC', plum: '#6E6272', lav: '#D9CCF4', lavD: '#B9A5E8', butter: '#FFF1A8', cherry: '#C2405B', ink: '#2E2A3B', gold: '#E8C770', pink: '#F7C9D3', mint: '#BFE6D3' };
      const M = {};
      ['wood', 'woodL', 'woodD', 'cream', 'plum', 'lav', 'lavD', 'butter', 'cherry', 'ink', 'pink', 'mint'].forEach(k => { M[k] = tn(C[k]); });
      M.gold = tn(C.gold);
      M.lamp = tn('#FFE9B8', { emissive: new T.Color('#FFC46B'), emissiveIntensity: 0.9 });
      M.leaf = tn('#8FC48A');
      const hidM = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const st = new T.Group(); g.add(st);   // мебель (с тенью)
      const dc = new T.Group(); g.add(dc);   // стены, пол, мелочи (без тени)
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
      const SLV = ['#F7C9D3', '#BFE6D3', '#D9CCF4', '#FFE08A', '#F6B7A0', '#B9D7F0', '#F08FA8', '#FFF4EC'];

      /* ---------- атлас надписей и картинок (один вызов отрисовки) ---------- */
      const [acv, ac] = R.cnv(1024, 1024);
      const atlasM = tn('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 });
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / 1024, u1 = (sx + sw) / 1024, v0 = 1 - (sy + sh) / 1024, v1 = 1 - sy / 1024;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      const A = {
        exit: [0, 0, 320, 96], sign: [0, 100, 640, 168], disc: [650, 0, 170, 170], plaque: [830, 0, 190, 70],
        rug: [0, 280, 640, 400], bin0: [650, 180, 180, 60], bin1: [650, 245, 180, 60], bin2: [650, 310, 180, 60],
        booth: [650, 380, 360, 70], newb: [830, 80, 190, 90], post1: [0, 690, 250, 330], post2: [260, 690, 250, 330], frame1: [520, 690, 200, 200], frame2: [730, 690, 200, 200],
      };
      { const c = ac;
        const rr = (x, y, w, h, r, f) => { c.fillStyle = f; R.rrect(c, x, y, w, h, r); c.fill(); };
        // ВЫХОД
        rr(0, 0, 320, 96, 18, '#2E2A3B'); R.text(c, 'ВЫХОД', 160, 50, 58, '#BFF0CE');
        // вывеска «СТОРОНА Б»
        rr(0, 100, 640, 168, 34, '#6E6272'); c.strokeStyle = '#FFF1A8'; c.lineWidth = 6; R.rrect(c, 12, 112, 616, 144, 26); c.stroke();
        R.text(c, 'СТОРОНА Б', 320, 170, 86, '#FFF1A8', { f: 'Comfortaa', w: 700, max: 560 });
        R.text(c, 'пластинки · будка · джаз', 320, 230, 34, '#F7C9D3', { w: 800, max: 520 });
        // пластинка-эмблема
        const disc = (x, y, r, lab) => { c.fillStyle = '#2E2A3B'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; for (let k = 0.45; k < 0.97; k += 0.09) { c.beginPath(); c.arc(x, y, r * k, 0, 7); c.stroke(); } c.fillStyle = lab; c.beginPath(); c.arc(x, y, r * 0.34, 0, 7); c.fill(); c.fillStyle = '#2E2A3B'; c.beginPath(); c.arc(x, y, r * 0.05, 0, 7); c.fill(); };
        disc(735, 85, 82, '#F7C9D3'); R.text(c, 'Б', 735, 78, 30, '#C2405B', { f: 'Comfortaa', w: 700 });
        rr(830, 80, 190, 90, 18, '#FFF1A8'); R.text(c, 'новинки', 925, 112, 30, '#C2405B', { f: 'Comfortaa', w: 700, max: 170 }); R.text(c, 'сторона А и Б', 925, 148, 20, '#6E6272', { w: 800, max: 170 });
        // табличка у саксофона
        rr(830, 0, 190, 70, 14, '#E8C770'); R.text(c, 'А. Сакс · 1846', 925, 37, 26, '#6B4A2E', { w: 800, max: 170 });
        // коврик: лавандовый овал с пластинкой
        { const cx = 320, cy = 480; const el = (rx, ry, f) => { c.fillStyle = f; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.fill(); };
          el(316, 196, '#FFF4EC'); el(300, 182, '#B9A5E8'); el(276, 160, '#D9CCF4');
          for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2; c.fillStyle = i % 2 ? '#F7C9D3' : '#FFF4EC'; c.beginPath(); c.arc(cx + Math.cos(a) * 288, cy + Math.sin(a) * 171, 6, 0, 7); c.fill(); }
          c.save(); c.translate(cx, cy); c.scale(1, 0.62); c.fillStyle = '#6E6272'; c.beginPath(); c.arc(0, 0, 170, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 4; for (let k = 60; k < 168; k += 18) { c.beginPath(); c.arc(0, 0, k, 0, 7); c.stroke(); } c.fillStyle = '#F7C9D3'; c.beginPath(); c.arc(0, 0, 56, 0, 7); c.fill(); c.fillStyle = '#FFF1A8'; c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill(); c.restore(); }
        // ярлыки ящиков
        [['ДЖАЗ', '#F7C9D3'], ['ОСЕНЬ', '#FFE08A'], ['ТИШИНА', '#BFE6D3']].forEach(([s, f], i) => { rr(650, 180 + i * 65, 180, 60, 14, f); R.text(c, s, 740, 211 + i * 65, 34, '#6E6272', { f: 'Comfortaa', w: 700, max: 160 }); });
        // будка
        rr(650, 380, 360, 70, 20, '#FFF4EC'); R.text(c, '♪ будка прослушивания', 830, 416, 30, '#6E6272', { w: 800, max: 330 });
        // афиши (придуманные, без реальных названий)
        const poster = (x, bg, title, sub, art) => { rr(x, 690, 250, 330, 18, '#FFF4EC'); rr(x + 12, 702, 226, 306, 12, bg); art(x + 125, 820); R.text(c, title, x + 125, 940, 30, '#FFF4EC', { f: 'Comfortaa', w: 700, max: 210 }); R.text(c, sub, x + 125, 980, 22, '#FFF1A8', { w: 800, max: 210 }); };
        poster(0, '#B9A5E8', 'Джаз для котов', 'сторона А и Б', (x, y) => { c.fillStyle = '#6E6272'; c.beginPath(); c.arc(x, y + 20, 60, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 52, y - 12); c.lineTo(x - 40, y - 70); c.lineTo(x - 14, y - 32); c.fill(); c.beginPath(); c.moveTo(x + 52, y - 12); c.lineTo(x + 40, y - 70); c.lineTo(x + 14, y - 32); c.fill(); c.fillStyle = '#FFF1A8'; [[-22, 10], [22, 10]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a, y + b, 9, 0, 7); c.fill(); }); });
        poster(260, '#F08FA8', 'Мелодрамы енота', 'сторона Б', (x, y) => { disc(x, y, 70, '#FFF1A8'); });
        // рамки с конвертами
        const sleeve = (x, bg, f2) => { rr(x, 690, 200, 200, 10, '#E8C770'); rr(x + 14, 704, 172, 172, 6, bg); c.fillStyle = f2; c.beginPath(); c.arc(x + 100, 790, 58, 0, 7); c.fill(); c.fillStyle = bg; c.beginPath(); c.arc(x + 100, 790, 18, 0, 7); c.fill(); };
        sleeve(520, '#BFE6D3', '#FFF4EC'); sleeve(730, '#FFE08A', '#F08FA8');
      }

      /* ---------- пол в шахматку ---------- */
      { const [fcv, fc] = R.cnv(256, 256);
        fc.fillStyle = '#FFF4EC'; fc.fillRect(0, 0, 256, 256);
        fc.fillStyle = '#8A7D8E'; fc.fillRect(0, 0, 128, 128); fc.fillRect(128, 128, 128, 128);
        fc.fillStyle = 'rgba(255,255,255,.07)'; fc.fillRect(4, 4, 120, 10); fc.fillRect(132, 132, 120, 10);
        fc.strokeStyle = 'rgba(110,98,114,.18)'; fc.lineWidth = 3; fc.strokeRect(129.5, 1.5, 125, 125); fc.strokeRect(1.5, 129.5, 125, 125);
        const ft = R.tex(fcv); ft.wrapS = ft.wrapT = T.RepeatWrapping;
        box(dc, M.plum, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
        const fl = put(dc, tiled(W, D, 1.2, 1.2), tn('#FFFFFF', { map: ft }), [0, 0.003, -D / 2], null, [-PI / 2, 0, 0]); fl.castShadow = false; fl.receiveShadow = true;
        aplane(dc, A.rug, [0.35, 0.008, -2.35], [3.0, 1.88, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      }

      /* ---------- стены: обои с нотками над лавандовыми панелями ---------- */
      { const [wcv, wc] = R.cnv(256, 256);
        wc.fillStyle = '#FFF1A8'; wc.fillRect(0, 0, 256, 256);
        wc.fillStyle = '#FFF7CC'; wc.fillRect(0, 0, 44, 256); wc.fillRect(128, 0, 44, 256);
        const note = (x, y, col) => { wc.fillStyle = col; wc.beginPath(); wc.ellipse(x, y, 9, 7, -0.4, 0, 7); wc.fill(); wc.fillRect(x + 6, y - 30, 3.5, 30); wc.beginPath(); wc.moveTo(x + 9, y - 30); wc.quadraticCurveTo(x + 22, y - 22, x + 18, y - 10); wc.lineTo(x + 9, y - 20); wc.fill(); };
        note(86, 70, '#D9CCF4'); note(214, 198, '#F7C9D3'); note(86, 198, '#F7C9D3'); note(214, 70, '#D9CCF4');
        const wT = R.tex(wcv); wT.wrapS = wT.wrapT = T.RepeatWrapping;
        const wallM = tn('#FFFFFF', { map: wT });
        rbox(dc, M.butter, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.04);
        put(dc, tiled(W, H - 1.0, 1.1, 1.1), wallM, [0, (H + 1.0) / 2, -D + 0.004]).castShadow = false;
        [-1, 1].forEach(sd => {
          rbox(dc, M.butter, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D, 0.04);
          put(dc, tiled(D, H - 1.0, 1.1, 1.1), wallM, [sd * (W / 2 - 0.004), (H + 1.0) / 2, -D / 2], null, [0, -sd * PI / 2, 0]).castShadow = false;
          rbox(dc, M.cream, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);     // торец разреза
          box(dc, M.cream, sd * (W / 2 - 0.04), H - 0.07, -D / 2, 0.1, 0.14, D);               // карниз
          box(dc, M.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
          // панели, перильце, плинтус
          box(dc, M.lav, sd * (W / 2 - 0.02), 0.5, -D / 2, 0.04, 1.0, D);
          box(dc, M.cream, sd * (W / 2 - 0.045), 1.0, -D / 2, 0.06, 0.06, D);
          box(dc, M.plum, sd * (W / 2 - 0.045), 0.06, -D / 2, 0.05, 0.12, D);
          for (let i = sd < 0 ? 1 : 0; i < 4; i++) box(dc, M.lavD, sd * (W / 2 - 0.042), 0.55, -0.6 - i * 1.15, 0.012, 0.56, 0.86);
        });
        box(dc, M.cream, 0, H - 0.07, -D + 0.04, W, 0.14, 0.1); box(dc, M.cream, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
        box(dc, M.lav, 0, 0.5, -D + 0.02, W, 1.0, 0.04); box(dc, M.cream, 0, 1.0, -D + 0.045, W, 0.06, 0.06); box(dc, M.plum, 0, 0.06, -D + 0.045, W, 0.12, 0.05);
        for (let i = 0; i < 6; i++) box(dc, M.lavD, -W / 2 + 0.55 + i * 1.06, 0.55, -D + 0.042, 0.82, 0.56, 0.012);
      }

      /* ---------- вывеска, афиши, рамки ---------- */
      rbox(dc, M.gold, 0, 2.62, -D + 0.04, 1.86, 0.52, 0.04, 0.03);
      aplane(dc, A.sign, [0, 2.62, -D + 0.065], [1.78, 0.468, 1]);
      { const q = grp(dc, -W / 2 + 0.01, 0, -3.65, PI / 2); aplane(q, A.post1, [0, 1.95, 0.02], [0.62, 0.82, 1]); }
      { const q = grp(dc, -W / 2 + 0.01, 0, -2.0, PI / 2); aplane(q, A.post2, [0, 1.95, 0.02], [0.62, 0.82, 1]); }
      aplane(dc, A.frame1, [-1.95, 1.75, -D + 0.012], [0.5, 0.5, 1]);
      aplane(dc, A.frame2, [-1.2, 2.05, -D + 0.012], [0.42, 0.42, 1]);
      { const q = grp(dc, W / 2 - 0.01, 0, -3.95, -PI / 2); aplane(q, A.frame1, [0, 1.85, 0.02], [0.46, 0.46, 1]); }

      { const cv = new T.QuadraticBezierCurve3(new T.Vector3(-2.9, 3.04, -D + 0.08), new T.Vector3(0, 2.96, -D + 0.12), new T.Vector3(2.9, 3.04, -D + 0.08));
        put(dc, R.keep(new T.TubeGeometry(cv, 24, 0.006, 4)), M.plum).castShadow = false;
        for (let i = 1; i < 14; i++) { const q = cv.getPoint(i / 14), c = SLV[i % SLV.length];
          put(dc, GEO.cyl, R.pm('#2E2A3B'), [q.x, q.y - 0.09, q.z + 0.01], [0.075, 0.012, 0.075], [PI / 2, 0, 0]); put(dc, GEO.cyl, R.pm(c), [q.x, q.y - 0.09, q.z + 0.02], [0.03, 0.012, 0.03], [PI / 2, 0, 0]); } }

      /* ---------- дверь на улицу (левая стена) ---------- */
      const DZ = -0.95;
      { const dv = grp(dc, -W / 2 + 0.01, 0, DZ, PI / 2);
        put(dv, R.extrude(R.archShape(1.2, 2.3), 0.06), M.cream, [0, 0, 0.01]);
        put(dv, R.extrude(R.archShape(1.0, 2.16), 0.06), M.cherry, [0, 0, 0.06]);
        [-0.22, 0.22].forEach(x => rbox(dv, M.pink, x, 0.6, 0.13, 0.32, 0.66, 0.03, 0.05));
        cyl(dv, M.lamp, 0, 1.55, 0.12, 0.15, 0.03, [PI / 2, 0, 0]); put(dv, R.ringG(0.16, 0.022), M.gold, [0, 1.55, 0.13]);
        R.sphS(dv, M.gold, 0.38, 1.02, 0.15, 0.045);
        rbox(dv, M.gold, 0, 2.62, 0.05, 0.74, 0.26, 0.04, 0.03); aplane(dv, A.exit, [0, 2.62, 0.075], [0.7, 0.21, 1]);
        const dg = grp(g, -W / 2 + 0.01, 0, DZ, PI / 2, 'exitDoor'); const hb = put(dg, GEO.box, hidM, [0, 1.25, 0.12], [1.25, 2.6, 0.3]); hb.castShadow = hb.receiveShadow = false;
        R.halo(g, -W / 2 + 0.25, 2.62, DZ, 0.7, '#BFF0CE', 0.35); }

      /* ---------- прилавок с проигрывателем ---------- */
      const CX = -0.3, CZ = -1.6, CT = 0.9;
      rbox(st, M.wood, CX, CT / 2 - 0.02, CZ, 1.6, CT - 0.04, 0.6, 0.05);
      rbox(st, M.woodL, CX, CT, CZ, 1.72, 0.06, 0.7, 0.03);
      box(dc, M.woodD, CX, 0.05, CZ + 0.31, 1.58, 0.1, 0.02);
      [-0.45, 0.45].forEach(dx => rbox(dc, M.cream, CX + dx, 0.47, CZ + 0.305, 0.62, 0.56, 0.02, 0.04));
      aplane(dc, A.disc, [CX - 0.45, 0.47, CZ + 0.32], [0.42, 0.42, 1]);
      aplane(dc, A.newb, [CX + 0.45, 0.47, CZ + 0.32], [0.5, 0.236, 1]);
      // проигрыватель: корпус, диск (вращается), тонарм
      rbox(st, M.cream, CX + 0.2, CT + 0.07, CZ, 0.56, 0.08, 0.44, 0.03);
      const [pcv, pc] = R.cnv(256, 256);
      { pc.fillStyle = '#2E2A3B'; pc.fillRect(0, 0, 256, 256); pc.strokeStyle = 'rgba(255,255,255,.15)'; pc.lineWidth = 2; for (let k = 50; k < 126; k += 9) { pc.beginPath(); pc.arc(128, 128, k, 0, 7); pc.stroke(); }
        pc.fillStyle = '#F7C9D3'; pc.beginPath(); pc.arc(128, 128, 42, 0, 7); pc.fill(); pc.fillStyle = '#C2405B'; pc.fillRect(110, 100, 36, 10); pc.fillStyle = '#FFF4EC'; pc.beginPath(); pc.arc(128, 128, 5, 0, 7); pc.fill(); }
      const platter = new T.Group(); platter.position.set(CX + 0.15, CT + 0.125, CZ); g.add(platter);
      put(platter, GEO.cyl, tn('#FFFFFF', { map: R.tex(pcv) }), [0, 0, 0], [0.18, 0.02, 0.18]).castShadow = false;
      cyl(st, M.gold, CX + 0.4, CT + 0.15, CZ - 0.12, 0.025, 0.06);
      { const ta = grp(st, CX + 0.4, CT + 0.175, CZ - 0.12, 0.55); cyl(ta, M.gold, 0, 0, 0.12, 0.009, 0.24, [PI / 2, 0, 0]); box(ta, M.ink, 0, -0.01, 0.25, 0.03, 0.02, 0.05); }
      // стопка конвертов и лампа-грибок
      [0, 1, 2].forEach(i => put(st, GEO.box, R.pm(SLV[i * 2]), [CX - 0.55, CT + 0.04 + i * 0.016, CZ + 0.02], [0.32, 0.014, 0.32], [0, 0.1 * (i - 1), 0]));
      cyl(st, M.gold, CX - 0.7, CT + 0.04, CZ - 0.2, 0.05, 0.02); cyl(st, M.gold, CX - 0.7, CT + 0.13, CZ - 0.2, 0.012, 0.18);
      put(st, GEO.hemi, M.lamp, [CX - 0.7, CT + 0.2, CZ - 0.2], [0.11, 0.08, 0.11]);
      R.halo(g, CX - 0.7, CT + 0.26, CZ - 0.12, 0.8, '#FFD39A', 0.5);
      // ступенька для Финалыча за прилавком
      rbox(st, M.woodD, CX, 0.22, -2.32, 0.72, 0.44, 0.52, 0.04);

      /* ---------- Финалыч: гусь в наушниках на шее ---------- */
      const goose = R.npc.goose({ popcorn: false });
      goose.root.position.set(CX, 0.44, -2.32); goose.root.scale.setScalar(1.12); g.add(goose.root);
      { const hp = new T.Group(); hp.position.set(0, 0.52, 0.1); goose.body.add(hp);
        put(hp, R.keep(new T.TorusGeometry(0.075, 0.016, 6, 18)), M.ink, [0, 0, 0], null, [PI / 2 + 0.15, 0, 0]);
        [-1, 1].forEach(s => put(hp, GEO.cyl, M.ink, [s * 0.078, -0.02, 0.03], [0.04, 0.03, 0.04], [0, 0, PI / 2]));
        [-1, 1].forEach(s => put(hp, GEO.cyl, M.pink, [s * 0.095, -0.02, 0.03], [0.03, 0.01, 0.03], [0, 0, PI / 2]));
        vcBake(hp, false); }
      goose.root.traverse(m => { if (m.isMesh) m.castShadow = false; });
      let playing = 0, bob = 0;
      { const ex0 = goose.extra; goose.extra = (t, dt) => { if (ex0) ex0(t, dt); bob += dt * (playing ? 7 : 2.4); if (goose.head) goose.head.rotation.x = Math.sin(bob) * (playing ? 0.16 : 0.07); }; }

      /* ---------- ящики с пластинками у задней стены ---------- */
      const BX = [-0.85, 0.12, 1.09], BZ = -4.2;
      BX.forEach((x, i) => {
        rbox(st, M.wood, x, 0.06, BZ, 0.72, 0.12, 0.5, 0.03);
        [-1, 1].forEach(s => box(st, M.wood, x + s * 0.345, 0.27, BZ, 0.03, 0.42, 0.5));
        box(st, M.woodL, x, 0.21, BZ + 0.235, 0.72, 0.3, 0.03); box(st, M.wood, x, 0.21, BZ - 0.235, 0.72, 0.3, 0.03);
        aplane(dc, A['bin' + i], [x, 0.24, BZ + 0.255], [0.42, 0.14, 1]);
        const q = R.rng(7 + i * 13);
        for (let k = 0; k < 8; k++) put(st, GEO.box, R.pm(SLV[Math.floor(q() * SLV.length)]), [x + (q() - 0.5) * 0.05, 0.34 + q() * 0.03, BZ + 0.17 - k * 0.048], [0.62, 0.6, 0.012], [-0.32 + k * 0.03, (q() - 0.5) * 0.06, 0]);
      });
      // пластинка недели — в рамке над ящиками (холст перерисовывается по неделе)
      const [wkv, wkc] = R.cnv(256, 256);
      const weekTex = R.tex(wkv);
      rbox(dc, M.gold, 0.12, 1.62, -D + 0.035, 0.7, 0.7, 0.03, 0.02);
      put(dc, GEO.plane, tn('#FFFFFF', { map: weekTex }), [0.12, 1.62, -D + 0.055], [0.62, 0.62, 1]).castShadow = false;
      const paintWeek = w => {
        const BG = ['#F6B7A0', '#F7C9D3', '#D9CCF4', '#B9D7F0', '#B9A5E8', '#E8EEF8', '#FFE08A'], c = wkc;
        c.fillStyle = BG[w] || BG[0]; c.fillRect(0, 0, 256, 256);
        const q = R.rng(100 + w);
        for (let i = 0; i < 14; i++) {
          const x = q() * 256, y = 20 + q() * 140, r = 6 + q() * 12;
          c.fillStyle = ['#FFF4EC', '#FFFFFF', '#F08FA8', '#6E6272'][i % 4]; c.globalAlpha = 0.55;
          if (w === 5) { c.fillRect(x - 1, y - r, 2, r * 2); c.fillRect(x - r, y - 1, r * 2, 2); }
          else if (w === 6) { c.beginPath(); c.ellipse(x, y, r * 0.55, r * 0.8, 0, 0, 7); c.fill(); }
          else if (w === 0 || w === 4) { c.beginPath(); c.ellipse(x, y, r, r * 0.5, q() * 3, 0, 7); c.fill(); }
          else { c.beginPath(); c.arc(x, y, r * 0.7, 0, 7); c.fill(); }
        }
        c.globalAlpha = 1;
        c.fillStyle = '#2E2A3B'; c.beginPath(); c.arc(196, 92, 46, 0, 7); c.fill(); c.fillStyle = '#FFF1A8'; c.beginPath(); c.arc(196, 92, 15, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,244,236,.9)'; R.rrect(c, 12, 168, 232, 76, 14); c.fill();
        R.text(c, recOf(w), 128, 196, 26, '#6E6272', { f: 'Comfortaa', w: 700, max: 220 });
        R.text(c, 'пластинка недели', 128, 228, 18, '#C2405B', { w: 800, max: 220 });
        weekTex.needsUpdate = true;
      };
      paintWeek(0);

      /* ---------- будка прослушивания ---------- */
      { const bx = BOOTH.x, bz = BOOTH.z, GAP = 0.66, Hb = 2.1;
        cyl(st, M.cream, bx, 0.04, bz, 0.86, 0.08);
        put(st, R.keep(new T.CylinderGeometry(0.86, 0.86, 0.14, 28, 1, false)), M.cream, [bx, Hb + 0.07, bz]);
        put(st, GEO.hemi, M.lav, [bx, Hb + 0.14, bz], [0.82, 0.28, 0.82]);
        R.sphS(st, M.gold, bx, Hb + 0.46, bz, 0.06);
        [-1, 1].forEach(s => cyl(st, M.cream, bx + s * Math.sin(GAP) * 0.8, Hb / 2, bz + Math.cos(GAP) * 0.8, 0.04, Hb));
        put(st, R.keep(new T.TorusGeometry(0.8, 0.02, 4, 32, PI * 2 - GAP * 2)), M.cream, [bx, 1.05, bz], null, [PI / 2, 0, PI / 2 + GAP]);
        const glass = put(g, R.keep(new T.CylinderGeometry(0.8, 0.8, Hb, 28, 1, true, GAP, PI * 2 - GAP * 2)), R.keep(new T.MeshToonMaterial({ color: new T.Color('#EAF6FF'), transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide })), [bx, Hb / 2 + 0.06, bz]);
        glass.castShadow = false; glass.receiveShadow = false; glass.renderOrder = 2; glass.raycast = () => {};
        // иллюминатор на стекле
        { const a = -1.25, pq = grp(dc, bx + Math.sin(a) * 0.81, 1.55, bz + Math.cos(a) * 0.81, a); put(pq, R.ringG(0.17, 0.03), M.gold, [0, 0, 0]); }
        // табурет, крючок с наушниками
        cyl(st, M.gold, bx, 0.02, bz - 0.05, 0.15, 0.03); cyl(st, M.gold, bx, 0.23, bz - 0.05, 0.028, 0.42); cyl(st, M.cherry, bx, 0.46, bz - 0.05, 0.2, 0.07);
        { const hk = grp(dc, bx, 0, bz - 0.74); cyl(hk, M.gold, 0, 1.62, 0.04, 0.012, 0.1, [PI / 2, 0, 0]); }
        { const sg = grp(dc, bx, Hb + 0.07, bz + 0.87); aplane(sg, A.booth, [0, 0, 0.001], [0.78, 0.15, 1]); }
        R.halo(g, bx, Hb - 0.15, bz, 1.2, '#FFE3B0', 0.32);
      }
      // наушники на крючке (снимаются, когда она садится) и наушники для героини
      const mkPhones = (par, s) => {
        const q = new T.Group(); par.add(q);
        put(q, R.keep(new T.TorusGeometry(0.315 * s, 0.028 * s, 6, 20, PI)), M.ink, [0, 0, 0]);
        [-1, 1].forEach(k => { put(q, GEO.cyl, M.ink, [k * 0.31 * s, -0.02 * s, 0], [0.085 * s, 0.07 * s, 0.085 * s], [0, 0, PI / 2]); put(q, GEO.cyl, M.pink, [k * 0.345 * s, -0.02 * s, 0], [0.06 * s, 0.012 * s, 0.06 * s], [0, 0, PI / 2]); });
        vcBake(q, false); return q;
      };
      const hookPh = mkPhones(g, 0.42); hookPh.position.set(BOOTH.x, 1.5, BOOTH.z - 0.68);
      const heroPh = mkPhones(new T.Group(), 1); heroPh.parent.remove(heroPh); heroPh.position.set(0, 0.04, 0.0);

      /* ---------- граммофон на тумбе ---------- */
      { const gx = -2.6, gz = -3.8;
        rbox(st, M.wood, gx, 0.37, gz, 0.56, 0.74, 0.56, 0.05); rbox(dc, M.cream, gx, 0.42, gz + 0.285, 0.4, 0.4, 0.02, 0.04);
        rbox(st, M.woodD, gx, 0.81, gz, 0.44, 0.14, 0.44, 0.03);
        cyl(st, M.ink, gx, 0.89, gz, 0.17, 0.02); cyl(dc, M.pink, gx, 0.9, gz, 0.06, 0.01);
        const tube = R.keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(gx + 0.16, 0.86, gz - 0.14), new T.Vector3(gx + 0.2, 1.05, gz - 0.12), new T.Vector3(gx + 0.12, 1.25, gz - 0.02), new T.Vector3(gx + 0.02, 1.32, gz + 0.06)]), 12, 0.022, 6));
        put(st, tube, M.gold);
        const horn = R.keep(new T.LatheGeometry([[0.02, 0], [0.035, 0.12], [0.07, 0.3], [0.15, 0.45], [0.27, 0.56], [0.34, 0.6]].map(([a, b]) => new T.Vector2(a, b)), 22));
        const hg = grp(st, gx + 0.02, 1.32, gz + 0.06); hg.rotation.set(1.05, 0.55, 0); put(hg, horn, tn(C.cherry, { side: T.DoubleSide }), [0, 0, 0]);
        put(hg, R.ringG(0.34, 0.022), M.gold, [0, 0.6, 0], null, [PI / 2, 0, 0]);
      }

      /* ---------- саксофон на стене ---------- */
      { const sx = 1.9, sy = 1.9, sz = -D + 0.02;
        rbox(st, M.woodL, sx, sy, sz + 0.02, 0.66, 1.0, 0.04, 0.06);
        aplane(dc, A.plaque, [sx, sy - 0.4, sz + 0.05], [0.34, 0.125, 1]);
        const curve = new T.CatmullRomCurve3([new T.Vector3(sx + 0.06, sy + 0.42, sz + 0.1), new T.Vector3(sx + 0.03, sy + 0.2, sz + 0.1), new T.Vector3(sx, sy - 0.08, sz + 0.11), new T.Vector3(sx + 0.03, sy - 0.24, sz + 0.12), new T.Vector3(sx + 0.13, sy - 0.27, sz + 0.12), new T.Vector3(sx + 0.2, sy - 0.16, sz + 0.12)]);
        put(st, R.keep(new T.TubeGeometry(curve, 24, 0.045, 10)), M.gold).castShadow = false;
        const bell = R.keep(new T.LatheGeometry([[0.045, 0], [0.06, 0.06], [0.09, 0.12], [0.13, 0.15]].map(([a, b]) => new T.Vector2(a, b)), 18));
        put(st, bell, tn(C.gold, { side: T.DoubleSide }), [sx + 0.2, sy - 0.17, sz + 0.12]).castShadow = false;
        put(st, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(sx + 0.06, sy + 0.42, sz + 0.1), new T.Vector3(sx + 0.02, sy + 0.5, sz + 0.1), new T.Vector3(sx - 0.1, sy + 0.52, sz + 0.1)]), 8, 0.016, 6)), M.gold).castShadow = false;
        cyl(st, M.ink, sx - 0.13, sy + 0.52, sz + 0.1, 0.014, 0.07, [0, 0, PI / 2]);
        for (let i = 0; i < 5; i++) R.sphS(st, M.cream, sx + 0.08 - i * 0.012, sy + 0.25 - i * 0.1, sz + 0.15, 0.018);
      }

      /* ---------- полка с пластинками на левой стене, бра, растение ---------- */
      { const q = grp(st, -W / 2 + 0.01, 0, -2.85, PI / 2);
        [1.3, 1.78].forEach(y => rbox(q, M.woodL, 0, y, 0.13, 0.9, 0.04, 0.26, 0.015)); }
      { const rq = R.rng(55); [1.32, 1.8].forEach(y => { let z = -3.25; while (z < -2.45) { const w = 0.012 + rq() * 0.01; put(dc, GEO.box, R.pm(SLV[Math.floor(rq() * SLV.length)]), [-W / 2 + 0.14, y + 0.17, z], [0.22, 0.32, w], [0, 0, (rq() - 0.5) * 0.08]); z += w + 0.012; } }); }
      [[-1, -1.45], [1, -1.2]].forEach(([sd, z]) => {
        const sg = grp(dc, sd * (W / 2 - 0.02), 0, z, -sd * PI / 2);
        box(sg, M.plum, 0, 2.35, 0.03, 0.07, 0.14, 0.05); cyl(sg, M.plum, 0, 2.38, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
        put(sg, GEO.cylLo, M.lamp, [0, 2.29, 0.26], [0.065, 0.15, 0.065]); put(sg, GEO.cone, M.gold, [0, 2.42, 0.26], [0.1, 0.08, 0.1]);
        R.halo(g, sd * (W / 2 - 0.3), 2.3, z, 0.95, '#FFC890', 0.45);
      });
      { const px = 2.8, pz = -4.25; cyl(st, M.cherry, px, 0.2, pz, 0.2, 0.4); cyl(st, M.cream, px, 0.41, pz, 0.21, 0.04);
        [[0, 0.75, 0, 0.26, 0.3], [-0.14, 0.95, 0.05, 0.2, 0.2], [0.13, 1.02, -0.04, 0.2, 0.24], [0.02, 1.2, 0.02, 0.16, 0.16]].forEach(([x, y, z, s, sy], i) => put(st, R.blobGeo, M.leaf, [px + x, y, pz + z], [s, sy, s], [0, i, 0])); }

      // ноты над будкой (видны, пока играет пластинка)
      const [ncv, nc] = R.cnv(64, 64);
      { nc.fillStyle = '#FFF4EC'; nc.strokeStyle = '#6E6272'; nc.lineWidth = 3; nc.beginPath(); nc.ellipse(24, 46, 11, 8, -0.4, 0, 7); nc.fill(); nc.stroke(); nc.fillRect(31, 10, 5, 36); nc.strokeRect(31, 10, 5, 36); nc.beginPath(); nc.moveTo(36, 10); nc.quadraticCurveTo(54, 18, 50, 34); nc.lineTo(36, 22); nc.fill(); }
      const noteM = R.keep(new T.SpriteMaterial({ map: R.tex(ncv), transparent: true, depthWrite: false, fog: false }));
      const notes = [0, 1, 2, 3, 4].map(i => { const s = new T.Sprite(noteM.clone()); R.keep(s.material); s.scale.setScalar(0.28); s.visible = false; s.renderOrder = 5; g.add(s); return { s, ph: i / 5 }; });

      vcBake(st, true);
      vcBake(dc, false);

      /* ---------- ловушки тапа ---------- */
      hit('spot:turntable', CX, 0.76, CZ, 1.74, 0.6, 0.72);
      hit('spot:booth', BOOTH.x, 1.1, BOOTH.z, 1.7, 2.3, 1.7);
      hit('spot:crates', 0.12, 0.4, BZ, 2.8, 0.8, 0.6);
      hit('spot:sax', 1.9, 1.9, -D + 0.12, 0.7, 1.05, 0.2);
      hit('spot:gramo', -2.55, 0.8, -3.75, 0.8, 1.6, 0.8);

      const blockers = [
        { x0: CX - 0.8, x1: CX + 0.8, z0: CZ - 0.3, z1: CZ + 0.3 },        // прилавок
        { x0: CX - 0.36, x1: CX + 0.36, z0: -2.6, z1: -2.06 },             // ступенька с гусем
        { x0: -1.21, x1: 1.45, z0: -4.47, z1: -3.95 },                     // ящики
        { x0: 1.5, x1: 3.1, z0: -3.4, z1: -2.75 },                         // будка (задняя часть)
        { x0: 1.48, x1: 1.75, z0: -2.75, z1: -1.98 },                      // будка, левая стойка
        { x0: 2.85, x1: 3.12, z0: -2.75, z1: -1.98 },                      // будка, правая стойка
        { x0: -2.88, x1: -2.32, z0: -4.08, z1: -3.52 },                    // граммофон
        { x0: 2.55, x1: 3.05, z0: -4.5, z1: -4.0 },                        // растение
        { x0: -3.2, x1: -2.9, z0: -3.3, z1: -2.4 },                        // полка на стене
      ];
      let spin = 0;
      return {
        W, D,
        bounds: { x0: -2.9, x1: 2.9, z0: -4.4, z1: -0.4 },
        exit: { x: -W / 2 + 0.45, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -W / 2 + 1.6, z: -1.7 },
        cam: { x0: -1.3, x1: 1.3, z: -1.0 },
        blockers,
        catSpot: { x: 1.2, z: -0.8, ry: -0.4 },
        spots: [
          { id: 'booth', x: 2.3, z: -1.6, act: 'Послушать', bubble: 'будка прослушивания' },
          { id: 'turntable', x: -0.3, z: -0.7, act: 'Посмотреть', bubble: 'проигрыватель' },
          { id: 'crates', x: -0.2, z: -3.6, act: 'Порыться', bubble: 'ящики с пластинками' },
          { id: 'sax', x: 1.9, z: -3.9, act: 'Рассмотреть', bubble: 'саксофон' },
          { id: 'gramo', x: -1.9, z: -3.5, act: 'Заглянуть', bubble: 'граммофон' },
        ],
        npcs: { goose },
        i3r: {
          paintWeek, heroPh, hookPh,
          setPlaying(on) { playing = on ? 1 : 0; },
        },
        tick(t, dt, ctx) {
          spin += dt * (playing ? 5.5 : 0.7); platter.rotation.y = -spin;
          notes.forEach((n, i) => {
            if (!playing) { n.s.visible = false; return; }
            const k = (t * 0.33 + n.ph) % 1; n.s.visible = true;
            n.s.position.set(BOOTH.x - 0.3 + Math.sin(t * 1.4 + i * 1.7) * 0.35 + i * 0.12, 1.2 + k * 1.6, BOOTH.z + 0.6 - i * 0.05);
            n.s.material.opacity = Math.min(1, k * 5) * (1 - k); n.s.material.rotation = Math.sin(t * 2 + i) * 0.3;
          });
        },
      };
    },
  });

  /* ---------- Говорящие ---------- */
  // Финалыч — уже зарегистрированный говорящий 'goose'

  /* ---------- Мелодии (генерируются, без записей) ---------- */
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const MOTIF = {
    // медленное минорное арпеджио
    sax: { type: 'triangle', seq: [[57, 0, 0.9], [60, 0.6, 0.9], [64, 1.2, 0.9], [69, 1.8, 1.4], [67, 2.9, 0.7], [64, 3.5, 0.9], [60, 4.2, 0.9], [62, 4.9, 0.9], [64, 5.6, 1.0], [57, 6.4, 1.5]], vol: 0.07 },
    // пентатоника вприпрыжку
    cats: { type: 'triangle', seq: [[60, 0, 0.3], [62, 0.35, 0.2], [64, 0.6, 0.3], [67, 0.95, 0.2], [69, 1.2, 0.45], [67, 1.8, 0.2], [64, 2.05, 0.3], [62, 2.4, 0.45], [60, 3.0, 0.3], [64, 3.35, 0.2], [67, 3.6, 0.3], [72, 3.95, 0.5], [69, 4.6, 0.3], [67, 4.95, 0.2], [64, 5.2, 0.3], [67, 5.55, 0.2], [62, 5.8, 0.45], [60, 6.4, 0.9]], vol: 0.065 },
    // нисходящая грустная линия
    drama: { type: 'sine', seq: [[76, 0, 1.0], [74, 0.9, 1.0], [72, 1.8, 1.0], [71, 2.7, 1.2], [69, 3.8, 1.0], [67, 4.7, 1.0], [65, 5.6, 1.0], [64, 6.5, 1.5]], vol: 0.075 },
  };
  function playMotif(gain, kind) {
    const m = MOTIF[kind]; if (!gain || !m) return;
    try {
      const ac = gain.context, t0 = ac.currentTime + 0.06;
      m.seq.forEach(([n, s, d]) => {
        const o = ac.createOscillator(), e = ac.createGain();
        o.type = m.type; o.frequency.setValueAtTime(NOTE(n), t0 + s);
        e.gain.setValueAtTime(0.0001, t0 + s); e.gain.linearRampToValueAtTime(m.vol, t0 + s + 0.05); e.gain.exponentialRampToValueAtTime(0.0006, t0 + s + d);
        o.connect(e); e.connect(gain); o.start(t0 + s); o.stop(t0 + s + d + 0.05);
      });
    } catch (e) { /* без звука */ }
  }

  /* ---------- Помощники ---------- */
  const room = ctx => (ctx.is3d && ctx.api && ctx.api.room && ctx.api.room.i3r ? ctx.api.room : null);
  const pop = m => { let n = 0; m = m >>> 0; while (m) { n += m & 1; m >>>= 1; } return n; };
  const RECS = [
    { label: '«Саксофон под дождём»', value: 'sax', bit: 1 },
    { label: '«Джаз для котов»', value: 'cats', bit: 2 },
    { label: '«Мелодрамы енота. Сторона Б»', value: 'drama', bit: 4 },
  ];

  async function listen(ctx) {
    const R3 = room(ctx);
    ctx.mark('sit');
    await ctx.sit({ x: BOOTH.x, z: BOOTH.z, ry: 0, from: [BOOTH.x, -1.6] });
    let head = null;
    const ph = R3 && R3.i3r.heroPh;
    const off = () => {   // снять наушники и встать (и при выходе посреди мини)
      try { if (head && ph) head.remove(ph); if (R3) { R3.i3r.hookPh.visible = true; R3.i3r.setPlaying(false); } } catch (e) { /* ignore */ }
    };
    try {
      if (R3 && ph) { try { head = ctx.api.heroHead(); head.add(ph); R3.i3r.hookPh.visible = false; } catch (e) { head = null; } }
      const v = await ctx.choose('Что поставить?', RECS.map(r => ({ label: r.label, value: r.value })));
      if (!v) return true;
      const rec = RECS.find(r => r.value === v);
      if (R3) R3.i3r.setPlaying(true);
      const gain = ctx.audio();
      if (gain) playMotif(gain, v); else ctx.toast('♪ Звук выключен. Представь саксофон — это он.');
      if (!ctx.is3d) ctx.toast(`♪ Играет ${rec.label}`);
      ctx.mark('listen');
      for (let i = 0; i < (ctx.is3d ? 32 : 14); i++) { await ctx.wait(250); if (ctx.is3d && !ctx.api.isSitting) break; }
      if (R3) R3.i3r.setPlaying(false);
      if (v === 'sax') await ctx.play('Дождь в записи, а уютно по-настоящему.');
      else if (v === 'cats') await ctx.play(ctx.catHere ? { who: 'cat', text: 'Не впечатлён. Но уши шевелятся.' } : 'Джаз для котов. Коты не пришли, но джаз хороший.');
      else await ctx.say({ who: 'goose', text: 'Енот записал мелодию между сеансами. На второй минуте слышно, как он достаёт платок.' });
      if (!ctx.has('a440')) await ctx.say({ f: 'a440' });
      const lr = (ctx.flag('lr') || 0) | rec.bit;
      if (lr !== ctx.flag('lr')) ctx.flag('lr', lr);
      if (pop(lr) >= 3 && !ctx.has('r_all')) await ctx.say({ who: 'goose', text: 'Ты прослушала всё до конца. Какая дисциплина! Мне бы такую.', s: 'r_all' });
      return true;
    } finally {
      off();
      if (!ctx.gone) { try { ctx.stand(); ctx.mark('mini-end'); } catch (e) { /* ignore */ } }
    }
  }

  /* ---------- Место ---------- */
  Town.place({
    id: P, kind: 'new',
    name: 'Пластинки «Сторона Б»', short: 'Пластинки',
    sign: 'СТОРОНА Б', motto: 'пластинки · будка · джаз',
    icon: '💿', color: '#FFF1A8',
    street: { x: 30.1, w: 3.4, doorDx: 0, bkey: null },
    room: P, opens: 1,
    host: { who: 'goose', npc: 'goose' },
    greet: {
      first: 'Га! Меня взяли работать с пластинками. Здесь хотя бы никто не жалуется на спойлеры.',
      again: Town.v('ГА! Я молчал о финале этой пластинки целых восемь секунд!', 'Га, {name}! Будка свободна — я проверил трижды.', 'Новая партия пластинок — и ни одной концовки я не выдал!'),
      regular: Town.v('Ваша будка свободна, наушники протёр — крылом.', 'Для вас — сторона А и сторона Б. Без спойлеров.', 'Постоянной слушательнице — игла помягче.'),
      away: 'Представляете, енот меня целую неделю не выгонял. Жизнь потеряла остроту.',
    },
    bark: 'Га! Снова вы!',
    weekly: [1, 2, 3, 4, 5, 6].reduce((o, w) => { o[w] = () => `Пластинка недели: „${recOf(w)}“. Концовку не скажу — честно-честно.`; return o; }, {}),
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      popcorn: 'Попкорн из кинотеатра? Енот знает, что вы здесь?',
      cup: 'Какао и пластинка. Шуршат в унисон.',
      bouquet: 'Га, цветы! В конце песни их всегда дарят — ой, это не спойлер.',
      look: 'Новый образ! Финал у него открытый — мне нравится.',
    },
    // цепочка «Финалыч сдержался»: f1 — кресло в кино, f2 — окно книжной, f3 — первый разговор здесь
    reactFirst: ctx => (ctx.flag('f1') && ctx.flag('f2') && ctx.flag('f3') && !ctx.has('r_fin') ? [
      { who: 'goose', text: 'ГА! А злодей-то в конце…', say: true },
      { who: 'goose', text: '…всем было хорошо.', say: true },
      { who: 'hero', text: 'Это не спойлер. Это пожелание.', s: 'r_fin' },
    ] : null),
    spots: {
      booth: { icon: '🎧', label: 'Будка прослушивания', onUse: ctx => listen(ctx) },
      turntable: {
        icon: '💿', label: 'Проигрыватель',
        lines: [
          [{ f: 'rpm' }, { who: 'goose', text: 'Я кручу на всех. Ищу концовку.' }],
          'Игла опустилась. Тишина перед музыкой — тоже музыка.',
        ],
        onUse: async ctx => {
          if (ctx.held !== 'popcorn') return false;
          ctx.sfx('wrong');
          if (ctx.has('r_scr')) { await ctx.play({ who: 'goose', text: 'Попкорн — к енотам! Игла любит тишину.' }); return true; }
          await ctx.say({ who: 'goose', text: 'Эй, попкорн убери! На пластинки крошить нельзя. Я это даже без спойлеров знаю.', s: 'r_scr' });
          return true;
        },
      },
      crates: {
        icon: '🗂', label: 'Ящики с пластинками',
        lines: [
          ctx => `Пластинка недели: „${recOf(ctx.week)}“.`,
          '„Шорох листьев, 45 минут“. Не музыка, а осень.',
          '„Звуки фонаря“. Тишина, но тёплая.',
          '„Лучшее Финалыча“. Одна песня, и та без конца.',
        ],
      },
      sax: {
        icon: '🎷', label: 'Саксофон на стене',
        lines: [{ f: 'sax' }, 'Саксофон висит молча. Но вид у него такой, будто вот-вот сыграет.'],
      },
      gramo: {
        icon: '📯', label: 'Граммофон',
        lines: [
          'Граммофон сипит. Финалыч: „Это не шум, это винтаж“.',
          { text: 'Пирожок сунул морду в граммофон и получил в ответ тишину. Оскорблён.', if: c => c.catHere },
          { text: 'В трубе граммофона живёт эхо. Двоюродное, из подъезда.', if: c => !c.catHere },
        ],
      },
    },
    npc: {
      goose: [
        { who: 'goose', text: 'А в конце… припев! Спокойно, это не спойлер, это музыкальная теория.' },
        { who: 'goose', text: 'Из кинотеатра ушёл по собственному желанию. Енот настоял.' },
        { who: 'goose', text: 'В музыке сложно молчать о концовке. Но я расту над собой.' },
      ],
    },
    onNpc: async (ctx, id) => {
      if (id !== 'goose' || ctx.flag('f3')) return false;
      await ctx.say({ who: 'goose', text: 'А в конце… припев! Спокойно, это не спойлер, это музыкальная теория.' });
      ctx.flag('f3', 1);
      return true;
    },
    enter: async ctx => {
      const R3 = room(ctx);
      if (R3) R3.i3r.paintWeek(ctx.week);
    },
    facts: {
      rpm: { text: 'Виниловые пластинки обычно крутятся со скоростью 33⅓ или 45 оборотов в минуту.' },
      sax: { text: 'Саксофон изобрёл Адольф Сакс. Патент — 1846 год, инструмент назван в его честь.' },
      a440: { text: 'Эталонная нота ля — 440 герц. Это международный стандарт настройки.' },
    },
    secrets: [
      { id: 'r_all', title: 'Дослушала всё', trigger: 'booth: all 3 records (k.lr = 7)' },
      { id: 'r_scr', title: 'Не крошить', trigger: 'turntable while holding popcorn' },
      { id: 'r_fin', title: 'Финалыч сдержался', trigger: 'enter with k.f1 && k.f2 && k.f3' },
    ],
    stamp: { title: 'Сторона Б', icon: '💿' },
  });
})();
