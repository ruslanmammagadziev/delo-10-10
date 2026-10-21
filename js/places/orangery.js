/* =====================================================================
   МЕСТО ПРОГУЛКИ: orangery — Оранжерея «Тепло» (kind new, x −7.2), семья Жу.
   Хозяйка — тётушка Жужа (пчела с лавандовыми полосками и круглыми очками),
   сама Жу остаётся в своём цветочном бутике на улице. Стеклянные стены в белой
   раме, кирпичная дорожка, три лампы «вместо солнца», апельсиновое дерево,
   стыдливая мимоза (складывает листья), подсолнух (оборот за 40 с), полка
   с мёдом (Жужа танцует восьмёрку), три горшка (мини «Полить»: бутон
   светится и «временно исполняет обязанности солнца»), тыквы с недели 1.
   Комната 7×5: дверь — левая стена (exit −3.05, −0.9), spawn (−1.9, −1.7).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'orangery';
  const wk = () => { try { return Math.max(0, Math.min(6, Town.week())); } catch (e) { return 0; } };
  const POTS = [{ x: 1.2, z: -1.2 }, { x: 1.8, z: -1.2 }, { x: 2.4, z: -1.2 }];
  const CAN_YAW = -Math.PI / 2;   // лейка на полу — носиком к залу (+z): рука берёт лейку, не поворачивая в воздухе

  /* ---------------------------- 3D-комната ---------------------------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#F2F6EE', gnd: '#C9A98C', hi: 0.72, sun: '#FFEED8', si: 0.42, off: [-2.6, 7.5, 5.5], bg: 'linear-gradient(180deg, #CBD7DB 0%, #E3EAE6 45%, #EEF1E8 100%)', rim: ['#FFF4DC', 0.2], fog: '#E3EAE6' },
    cam: { portrait: { dx: 0, y: 7.8, dz: 5.2, ly: 0.6, lz: -0.8, fov: 58 }, landscape: { dx: 0, y: 5.0, dz: 7.2, ly: 1.1, lz: -1.4, fov: 46 } },
    build(R) {
      const { T, PI, group: g, put, box, cyl, rbox, sphS, GEO } = R;
      const W = 7, D = 5, H = 3.3, week = wk();
      const toon = R.toon;
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const hitM = basic('#FFFFFF', { visible: false });
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (par, x, y, z, w, h, d) => { const m = put(par, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; return m; };
      const prox = (key, x, y, z, w, h, d) => { const q = grp(g, x, y, z, 0, key); hit(q, 0, 0, 0, w, h, d); return q; };
      const M = {
        white: toon('#FFFDF9'), glass: toon('#BFE6D3', { transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide }),
        brick: toon('#C98A5C'), wood: toon('#B98C6A'), soil: toon('#7A5A44'),
        leaf: toon('#7FB08A'), leafD: toon('#5E9A6A'), orange: toon('#F7A24A'), mint: toon('#BFE6D3'),
        amber: toon('#F7B267', { emissive: new T.Color('#F7A24A'), emissiveIntensity: 0.15 }),
        lamp: toon('#FFE3A6', { emissive: new T.Color('#FFD27A'), emissiveIntensity: 1.0 }),
        pink: toon('#F7C9D3'), gold: toon('#FFD98A', { emissive: new T.Color('#FFC85A'), emissiveIntensity: 0.9 }),
      };

      /* ---------- атлас: пол (дорожка и гравий), вид за стеклом, медовая табличка, «ВЫХОД» ---------- */
      const AW = 1024, AH = 1024, [acv, ac] = R.cnv(AW, AH);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv) });
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / AW, u1 = (sx + sw) / AW, v0 = 1 - (sy + sh) / AH, v1 = 1 - sy / AH;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
        const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      { const c = ac, q = R.rng(5);   // пол 7×5 → 512×512: гравий по бокам, кирпичная дорожка посередине
        c.fillStyle = '#E8DCC8'; c.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 2600; i++) { const x = q() * 512, y = q() * 512, r = 1 + q() * 2.4; c.fillStyle = ['#D9C9B0', '#F2E8D8', '#CDBBA0', '#E0D2BC'][i % 4]; c.beginPath(); c.ellipse(x, y, r * 1.2, r, q() * 3, 0, 7); c.fill(); }
        const px0 = 206, px1 = 306; c.fillStyle = '#B7774D'; c.fillRect(px0 - 6, 0, px1 - px0 + 12, 512);
        const bw = 32, bh = 18;
        for (let r = 0; r * bh < 512; r++) for (let k = -1; k * bw < px1 - px0 + bw; k++) {
          const x = px0 + k * bw + (r % 2) * bw / 2, y = r * bh;
          c.fillStyle = ['#C98A5C', '#E8B98A', '#D69A6C', '#DFA97A'][(r * 3 + k * 7) & 3];
          c.save(); c.beginPath(); c.rect(px0, 0, px1 - px0, 512); c.clip(); R.rrect(c, x + 1.5, y + 1.5, bw - 3, bh - 3, 3); c.fill(); c.restore();
        }
        c.fillStyle = 'rgba(122,90,68,.35)'; c.fillRect(px0 - 6, 0, 4, 512); c.fillRect(px1 + 2, 0, 4, 512);
        for (let i = 0; i < 26; i++) { const x = q() < 0.5 ? q() * (px0 - 30) : px1 + 24 + q() * (512 - px1 - 30), y = q() * 512; c.fillStyle = ['rgba(143,174,98,.35)', 'rgba(127,176,138,.3)', 'rgba(238,154,85,.35)'][i % 3]; c.beginPath(); c.ellipse(x, y, 10 + q() * 16, 6 + q() * 8, q() * 3, 0, 7); c.fill(); } }
      { const c = ac, ox = 512, oy = 0, w = 512, h = 256;   // за стеклом: кусты и дома улицы, мягко
        const gr = c.createLinearGradient(0, oy, 0, oy + h); gr.addColorStop(0, '#D6DEE4'); gr.addColorStop(1, '#EAE6DE'); c.fillStyle = gr; c.fillRect(ox, oy, w, h);
        [['#E6D2DA', 30, 70, 90], ['#F0DEC8', 140, 52, 80], ['#DCD4EA', 236, 80, 96], ['#F2D7CF', 352, 60, 84], ['#E2E0EC', 450, 74, 70]].forEach(([col, x, y, ww]) => {
          c.fillStyle = col; c.fillRect(ox + x, oy + y, ww, h - y); c.fillStyle = '#C9B8C8'; c.beginPath(); c.moveTo(ox + x - 6, oy + y); c.lineTo(ox + x + ww / 2, oy + y - 26); c.lineTo(ox + x + ww + 6, oy + y); c.fill();
          c.fillStyle = '#FFE3B0'; for (let i = 0; i < 2; i++) c.fillRect(ox + x + 14 + i * (ww - 40), oy + y + 24, 12, 16);
        });
        const q = R.rng(11);
        for (let i = 0; i < 40; i++) { c.fillStyle = ['#A9C9A4', '#9BBF98', '#B8D4B0'][i % 3]; c.beginPath(); c.arc(ox + q() * 512, oy + 190 + q() * 40, 22 + q() * 22, 0, 7); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(ox, oy, w, h); }
      { const c = ac, ox = 512, oy = 256;   // медовая табличка-соты «ТЕПЛО»
        const hx = (x, y, r) => { c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2 + PI / 6; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
        c.fillStyle = '#9E6B2E'; R.rrect(c, ox + 6, oy + 6, 500, 180, 40); c.fill();
        c.fillStyle = '#FFD98A'; R.rrect(c, ox + 16, oy + 16, 480, 160, 32); c.fill();
        c.strokeStyle = 'rgba(158,107,46,.28)'; c.lineWidth = 3; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { hx(ox + 40 + i * 54 + (j % 2) * 27, oy + 40 + j * 47, 26); c.stroke(); }
        R.text(c, 'ТЕПЛО', ox + 256, oy + 98, 92, '#9E6B2E', { f: 'Comfortaa', w: 700, max: 420 }); }
      { const c = ac; c.fillStyle = '#4C6B5C'; R.rrect(c, 4, 516, 312, 88, 18); c.fill(); R.text(c, 'ВЫХОД', 160, 562, 58, '#E4FFE9'); }

      const S = new T.Group(); g.add(S);   // статика без тени
      const F = new T.Group(); g.add(F);   // мебель и растения с тенью

      /* ---------- пол, кирпичный цоколь, стеклянные стены в белой раме ---------- */
      box(S, M.soil, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
      aplane(S, [0, 0, 512, 512], [0, 0.002, -D / 2], [W, D, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      aplane(S, [512, 0, 512, 256], [0, 2.3, -D - 0.9], [9.6, 4.8, 1]);
      const PL = 0.45;
      rbox(S, M.brick, 0, PL / 2, -D - 0.06, W + 0.24, PL, 0.16, 0.04);
      [-1, 1].forEach(sd => rbox(S, M.brick, sd * (W / 2 + 0.06), PL / 2, -D / 2, 0.16, PL, D, 0.04));
      box(S, M.white, 0, PL + 0.02, -D - 0.06, W + 0.3, 0.05, 0.2); [-1, 1].forEach(sd => box(S, M.white, sd * (W / 2 + 0.06), PL + 0.02, -D / 2, 0.2, 0.05, D));
      // стекло: три плоскости — одна склейка, один вызов
      { const gp = (x, y, z, w, h, ry) => { const m = put(S, GEO.plane, M.glass, [x, y, z], [w, h, 1], [0, ry, 0]); m.castShadow = false; m.receiveShadow = false; };
        gp(0, (H + PL) / 2, -D - 0.04, W, H - PL, 0); gp(-W / 2 - 0.04, (H + PL) / 2, -D / 2, D, H - PL, PI / 2); gp(W / 2 + 0.04, (H + PL) / 2, -D / 2, D, H - PL, -PI / 2); }
      // переплёт: стойки, ригели, верхняя балка
      { const nB = 8; for (let i = 0; i <= nB; i++) { const x = -W / 2 + i * W / nB; box(S, M.white, x, (H + PL) / 2, -D - 0.04, 0.06, H - PL, 0.06); }
        [-1, 1].forEach(sd => { for (let i = 0; i <= 5; i++) box(S, M.white, sd * (W / 2 + 0.04), (H + PL) / 2, -i * D / 5, 0.06, H - PL, 0.06); });
        [1.45, 2.4, H].forEach(y => { box(S, M.white, 0, y, -D - 0.04, W, y === H ? 0.1 : 0.04, 0.06); [-1, 1].forEach(sd => box(S, M.white, sd * (W / 2 + 0.04), y, -D / 2, 0.06, y === H ? 0.1 : 0.04, D)); });
        // полукруглые фрамуги над задней стеной
        for (let i = 0; i < 4; i++) put(S, R.keep(new T.TorusGeometry(0.42, 0.025, 6, 20, PI)), M.white, [-2.625 + i * 1.75, 2.4, -D - 0.04]); }
      // медовая табличка «ТЕПЛО» на задней раме
      rbox(S, M.white, 0, 2.86, -D + 0.02, 1.3, 0.5, 0.04, 0.02); aplane(S, [512, 256, 512, 192], [0, 2.86, -D + 0.05], [1.24, 0.465, 1]);

      /* ---------- дверь (левая стена) с табличкой «ВЫХОД» ---------- */
      const DZ = -0.9;
      { const dg = grp(S, -W / 2 + 0.03, 0, DZ, PI / 2);
        put(dg, R.extrude(R.archShape(1.12, 2.2), 0.06), M.white, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(0.96, 2.08), 0.04), M.mint, [0, 0, 0.06]);
        box(dg, M.white, 0, 1.15, 0.1, 0.05, 1.7, 0.03); box(dg, M.white, 0, 1.2, 0.1, 0.9, 0.05, 0.03);
        sphS(dg, M.gold, 0.34, 1.0, 0.13, 0.04);
        aplane(dg, [4, 516, 312, 88], [0, 2.42, 0.09], [0.66, 0.19, 1]);
        prox('exitDoor', -W / 2 + 0.12, 1.15, DZ, 0.2, 2.3, 1.1);
        R.halo(g, -W / 2 + 0.28, 2.42, DZ, 0.7, '#BFF0CE', 0.35); }

      /* ---------- три лампы «вместо солнца» на тросах ---------- */
      box(S, M.white, 0, H + 0.02, -3.0, W + 0.1, 0.07, 0.07);
      const lampX = [-2, 0, 2];
      lampX.forEach(x => { cyl(S, M.white, x, 3.0, -3.0, 0.008, 0.6); put(S, GEO.cone, M.white, [x, 2.82, -3.0], [0.12, 0.1, 0.12]); sphS(S, M.lamp, x, 2.7, -3.0, 0.085); });
      const halos = lampX.map(x => R.halo(g, x, 2.66, -3.0, 1.25, '#FFD9A0', 0.6));

      /* ---------- грядки у стен: папоротники, листья, цветочки ---------- */
      { const q = R.rng(21), bush = (x, z, s) => { [[0, 0.16, 0, 0.2], [0.14, 0.12, 0.05, 0.15], [-0.13, 0.12, -0.04, 0.14], [0.03, 0.26, -0.03, 0.13]].forEach(([dx, y, dz, r], i) => put(S, R.blobGeo, i % 2 ? M.leafD : M.leaf, [x + dx * s, y * s, z + dz * s], [r * s, r * 0.85 * s, r * s])); };
        // бортики грядок
        rbox(S, M.wood, 0, 0.1, -4.5, W - 0.1, 0.2, 0.08, 0.02);
        rbox(S, M.wood, -2.88, 0.1, -2.35, 0.08, 0.2, 1.5, 0.02); rbox(S, M.wood, -3.18, 0.1, -1.62, 0.6, 0.2, 0.08, 0.02); rbox(S, M.wood, -3.18, 0.1, -3.08, 0.6, 0.2, 0.08, 0.02);
        [[-3.05, -4.72, 1.25], [-2.1, -4.75, 0.9], [-1.2, -4.72, 1.1], [-0.3, -4.75, 0.85], [0.55, -4.7, 1.0], [2.6, -4.7, 1.25], [3.15, -4.0, 1.1], [3.15, -3.3, 0.95],
          [-3.2, -2.75, 1.0], [-3.2, -1.95, 0.85], [3.15, -0.55, 0.9]].forEach(([x, z, s]) => bush(x, z, s));
        for (let i = 0; i < 26; i++) { const back = i < 16, x = back ? -3.3 + q() * 6.6 : -3.4 + q() * 0.45, z = back ? -4.62 - q() * 0.3 : -3.0 + q() * 1.3; sphS(S, [M.pink, M.amber, M.white][i % 3], x, 0.3 + q() * 0.18, z, 0.04 + q() * 0.015); }
        // папоротники: розетки из листьев
        const fern = (x, z, s) => { for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; put(S, R.leafUp, i % 2 ? M.leaf : M.leafD, [x + Math.cos(a) * 0.12 * s, 0.22 * s, z + Math.sin(a) * 0.12 * s], [0.14 * s, 0.4 * s, 0.14 * s], [Math.sin(a) * 0.7, -a + PI / 2, Math.cos(a) * 0.7]).castShadow = false; } };
        [[-1.65, -4.7, 1.2], [1.6, -4.72, 1.0], [-3.25, -2.35, 1.0], [2.0, -4.7, 0.9]].forEach(([x, z, s]) => fern(x, z, s));
        // лимончики в горшках у задних углов
        [[-2.55, -4.72], [3.2, -4.7]].forEach(([x, z]) => { put(F, GEO.pot, M.brick, [x, 0.42, z], [0.16, 0.24, 0.16]); cyl(F, M.wood, x, 0.75, z, 0.02, 0.5);
          put(F, R.blobGeo, M.leaf, [x, 1.08, z], [0.26, 0.24, 0.26]); [[0.12, 1.02, 0.17], [-0.15, 1.12, 0.12], [0.03, 1.2, 0.2]].forEach(([dx, y, dz]) => sphS(F, M.gold, x + dx, y, z + dz, 0.045)); });
        // большое растение в кадке у правого переднего угла
        { const x = 3.1, z = -0.55; put(F, GEO.pot, M.white, [x, 0.26, z], [0.24, 0.42, 0.24]); cyl(F, M.mint, x, 0.38, z, 0.245, 0.06);
          for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; put(F, R.leafUp, i % 2 ? M.leaf : M.leafD, [x + Math.cos(a) * 0.16, 0.85, z + Math.sin(a) * 0.16], [0.3, 0.62, 0.3], [Math.sin(a) * 0.55, -a + PI / 2, Math.cos(a) * 0.55]); } } }
      // подвесное кашпо с плетями
      { const hg = grp(S, -0.95, 0, -4.2); cyl(hg, M.white, 0, 2.9, 0, 0.006, 0.8); put(hg, GEO.pot, M.brick, [0, 2.45, 0], [0.16, 0.16, 0.16]);
        put(hg, R.blobGeo, M.leaf, [0, 2.58, 0], [0.2, 0.12, 0.2]);
        for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; put(hg, R.leafUp, i % 2 ? M.leafD : M.leaf, [Math.cos(a) * 0.15, 2.32 - (i % 3) * 0.1, Math.sin(a) * 0.15], [0.09, 0.22, 0.09], [0, a, PI]).castShadow = false; } }

      // ящики с рассадой у входа и горшочки вдоль дорожки
      { const cx = -2.6, cz = -0.42; rbox(F, M.wood, cx, 0.15, cz, 0.5, 0.3, 0.32, 0.02); rbox(F, M.wood, cx + 0.05, 0.42, cz - 0.02, 0.44, 0.24, 0.28, 0.02);
        for (let i = 0; i < 6; i++) put(S, R.leafUp, i % 2 ? M.leaf : M.leafD, [cx - 0.15 + (i % 3) * 0.15, 0.6, cz - 0.08 + Math.floor(i / 3) * 0.12], [0.07, 0.13, 0.07], [0.3, i, 0.2]).castShadow = false; }
      [[-1.3, -3.6, 0.12], [0.78, -3.72, 0.1], [-1.55, -1.05, 0.1]].forEach(([x, z, r]) => { put(F, GEO.pot, M.brick, [x, r, z], [r, r * 2, r]); put(S, R.blobGeo, M.leaf, [x, r * 2.4, z], [r * 1.3, r * 1.1, r * 1.3]); sphS(S, M.pink, x + r * 0.5, r * 2.9, z + r * 0.6, 0.035); });
      /* ---------- апельсиновое дерево в кадке ---------- */
      const OX = -2.3, OZ = -3.7;
      { const tf = grp(F, OX, 0, OZ);
        put(tf, GEO.pot, M.white, [0, 0.27, 0], [0.34, 0.54, 0.34]);
        cyl(tf, M.mint, 0, 0.42, 0, 0.345, 0.08);
        cyl(tf, M.soil, 0, 0.545, 0, 0.3, 0.02);
        cyl(tf, M.wood, 0, 1.0, 0, 0.05, 0.95);
        [[0, 1.75, 0, 0.55], [0.32, 1.6, 0.12, 0.4], [-0.3, 1.62, -0.05, 0.42], [0.05, 2.02, -0.08, 0.4], [-0.1, 1.55, 0.3, 0.32]].forEach(([x, y, z, r], i) => put(tf, R.blobGeo, i % 2 ? M.leafD : M.leaf, [x, y, z], [r, r * 0.86, r]));
        [[0.28, 1.5, 0.36], [-0.34, 1.78, 0.3], [0.1, 1.95, 0.42]].forEach(([x, y, z]) => { sphS(tf, M.orange, x, y, z, 0.085); sphS(tf, M.leafD, x, y + 0.08, z, 0.02); }); }
      prox('spot:orange', OX, 1.1, OZ, 1.2, 2.3, 1.1);
      // туман из распылителя над деревом (3 облачка — одни Points)
      { cyl(S, M.white, OX + 0.4, 2.62, -4.75, 0.012, 0.5, [PI / 2, 0, 0]); cyl(S, M.white, OX + 0.4, 2.62, -4.5, 0.03, 0.06); }
      const mpos = new Float32Array(9), mgeo = R.keep(new T.BufferGeometry()); mgeo.setAttribute('position', new T.BufferAttribute(mpos, 3));
      const mist = new T.Points(mgeo, R.keep(new T.PointsMaterial({ map: R.haloTex, color: 0xFFFFFF, size: 0.55, transparent: true, opacity: 0, depthWrite: false, fog: false })));
      mist.frustumCulled = false; g.add(mist);

      /* ---------- стыдливая мимоза: 8 половинок листьев — один InstancedMesh ---------- */
      const MX = -0.6, MZ = -2.4, MY = 1.15;
      { const mf = grp(F, MX, 0, MZ);
        rbox(mf, M.wood, 0, 0.36, 0, 0.36, 0.72, 0.36, 0.03); rbox(mf, M.white, 0, 0.74, 0, 0.42, 0.05, 0.42, 0.02);
        put(mf, GEO.pot, M.brick, [0, 0.86, 0], [0.15, 0.2, 0.15]); cyl(mf, M.soil, 0, 0.955, 0, 0.13, 0.01);
        cyl(mf, M.leafD, 0, 1.05, 0, 0.012, 0.22); }
      if (week >= 3) [[0.1, 1.24, 0.06], [-0.12, 1.2, 0.08], [0.04, 1.26, -0.12], [-0.06, 1.3, -0.02]].forEach(([x, y, z]) => put(S, R.blobGeo, M.pink, [MX + x, y, MZ + z], [0.045, 0.045, 0.045]));
      const [fcv, fc] = R.cnv(128, 256);
      fc.strokeStyle = '#5E9A6A'; fc.lineWidth = 5; fc.beginPath(); fc.moveTo(4, 250); fc.lineTo(4, 8); fc.stroke();
      for (let i = 0; i < 11; i++) { const y = 236 - i * 21; fc.fillStyle = i % 2 ? '#7FB08A' : '#8FC09A'; fc.beginPath(); fc.ellipse(56, y, 52, 9, -0.2, 0, 7); fc.fill(); }
      const frondG = R.keep(new T.PlaneGeometry(0.15, 0.4)); frondG.translate(0.075, 0.2, 0);
      const frondM = toon('#FFFFFF', { map: R.tex(fcv), alphaTest: 0.5, side: T.DoubleSide });
      const fronds = new T.InstancedMesh(frondG, frondM, 8); fronds.castShadow = true; fronds.frustumCulled = false; g.add(fronds);
      const FR = []; for (let i = 0; i < 8; i++) { const pair = i >> 1, yaw = pair * PI / 2 + 0.35, mx = i % 2 ? -1 : 1, pt = 0.32 + (pair % 2) * 0.12; FR.push({ mx, yaw, pitch: pt, fold: 0, y: MY + (pair % 2) * 0.06, cur: { yaw, pitch: pt, fold: 0 }, tgt: null }); }
      const BOW = [[-1.2, 0.5, 1.45], [-1.7, 0.5, 1.45], [1.2, 0.5, 1.45], [1.7, 0.5, 1.45], [-2.7, -0.7, 0.4], [2.7, -0.7, 0.4], [0, 0.2, 1.55], [PI, 0.2, 1.55]];   // [yaw, pitch, fold] — поза «бантик»
      let foldT = -1, bowT = -1;
      const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(0, 0, 0, 'YXZ'), _p = new T.Vector3(), _s = new T.Vector3(), _r = new T.Matrix4();
      const placeFronds = () => {
        FR.forEach((f, i) => {
          _e.set(f.cur.pitch - PI / 2, f.cur.yaw, 0, 'YXZ'); _q.setFromEuler(_e);
          _m.compose(_p.set(MX, f.y, MZ), _q, _s.set(1, 1, 1));
          _r.makeRotationY(-f.cur.fold * f.mx); _m.multiply(_r); _m.multiply(_r.makeScale(f.mx, 1, 1));
          fronds.setMatrixAt(i, _m);
        });
        fronds.instanceMatrix.needsUpdate = true;
      };
      placeFronds();
      prox('spot:mimosa', MX, 0.75, MZ, 0.75, 1.55, 0.75);

      /* ---------- подсолнух: голова делает оборот за 40 с ---------- */
      const SFX = 1.6, SFZ = -3.8, SFY = 2.0;
      { const sf = grp(F, SFX, 0, SFZ);
        put(sf, GEO.pot, M.brick, [0, 0.25, 0], [0.32, 0.5, 0.32]); cyl(sf, M.soil, 0, 0.495, 0, 0.27, 0.02);
        cyl(sf, M.leafD, 0, 1.25, 0, 0.035, 1.5);
        [[0.9, 0.5], [1.3, -0.6], [1.6, 2.4]].forEach(([y, a]) => put(sf, R.leafUp, M.leaf, [Math.cos(a) * 0.14, y, Math.sin(a) * 0.14], [0.22, 0.34, 0.22], [0.9, -a + PI / 2, 0])); }
      const [hcv, hc] = R.cnv(256, 256);
      for (let i = 0; i < 22; i++) { const a = i / 22 * PI * 2; hc.save(); hc.translate(128, 128); hc.rotate(a); hc.fillStyle = i % 2 ? '#F7B267' : '#F9C774'; hc.beginPath(); hc.ellipse(0, -84, 18, 44, 0, 0, 7); hc.fill(); hc.restore(); }
      hc.fillStyle = '#6B4A3A'; hc.beginPath(); hc.arc(128, 128, 58, 0, 7); hc.fill();
      hc.fillStyle = '#8A6448'; for (let i = 0; i < 70; i++) { const a = i * 2.4, r = Math.sqrt(i) * 6.6; hc.beginPath(); hc.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3, 0, 7); hc.fill(); }
      const head = grp(g, SFX, SFY, SFZ), tilt = grp(head, 0, 0, 0); tilt.rotation.x = -0.25;
      const face = R.plane(tilt, toon('#FFFFFF', { map: R.tex(hcv), alphaTest: 0.5, side: T.DoubleSide }), 0, 0, 0.03, 0.78, 0.78); face.castShadow = true;
      const back = put(tilt, R.keep(new T.CircleGeometry(0.25, 18)), M.leafD, [0, 0, 0.0], null, [0, PI, 0]); back.castShadow = false;
      head.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      prox('spot:sunflower', SFX, 1.2, SFZ, 0.9, 2.5, 0.9);

      /* ---------- полка с мёдом у правой стены ---------- */
      const HX = 3.18, HZ = -2.2;
      { const hf = grp(F, HX, 0, HZ), hs = grp(S, HX, 0, HZ);
        rbox(hf, M.wood, 0, 0.42, 0, 0.5, 0.84, 1.0, 0.03); rbox(hf, M.white, 0, 0.86, 0, 0.56, 0.05, 1.06, 0.02);
        [-0.25, 0.25].forEach(z => rbox(hs, M.white, -0.252, 0.42, z, 0.02, 0.6, 0.42, 0.01));
        box(hs, M.wood, 0.05, 1.62, 0, 0.4, 0.04, 1.1); [-0.45, 0.45].forEach(z => box(hs, M.wood, 0.15, 1.52, z, 0.2, 0.18, 0.03));
        const jar = (x, y, z, s) => { cyl(hs, M.amber, x, y + 0.08 * s, z, 0.07 * s, 0.16 * s); cyl(hs, M.white, x, y + 0.175 * s, z, 0.075 * s, 0.03 * s); sphS(hs, M.white, x - 0.07 * s, y + 0.09 * s, z, 0.004, 0.04 * s, 0.035 * s); };
        [[-0.05, 0.89, -0.32, 1], [-0.08, 0.89, 0.02, 1.15], [-0.04, 0.89, 0.33, 0.9], [0.0, 1.64, -0.25, 1], [0.0, 1.64, 0.2, 1.1]].forEach(([x, y, z, s]) => jar(x, y, z, s));
        // соты на полке
        put(hs, R.keep(new T.CylinderGeometry(0.1, 0.1, 0.04, 6)), M.amber, [0.0, 1.66, 0.48], null, [PI / 2, 0, 0]); }
      prox('spot:honey', HX, 0.9, HZ, 0.6, 1.8, 1.15);

      /* ---------- три горшка на скамейке, лейка ---------- */
      { const bf = grp(F, 1.8, 0, -1.2);
        rbox(bf, M.wood, 0, 0.5, 0, 2.0, 0.06, 0.44, 0.02);
        [-0.9, 0.9].forEach(x => { box(bf, M.white, x, 0.25, 0.15, 0.06, 0.5, 0.06); box(bf, M.white, x, 0.25, -0.15, 0.06, 0.5, 0.06); });
        box(bf, M.white, 0, 0.18, 0, 1.8, 0.04, 0.3); }
      POTS.forEach((pt, i) => { put(F, GEO.pot, M.brick, [pt.x, 0.68, pt.z], [0.15, 0.28, 0.15]); cyl(S, M.soil, pt.x, 0.815, pt.z, 0.13, 0.01);
        if (i < 2) for (let k = 0; k < 4; k++) put(S, R.leafUp, k % 2 ? M.leafD : M.leaf, [pt.x + (k - 1.5) * 0.035, 0.89, pt.z + (k % 2) * 0.025], [0.07, 0.13, 0.07], [0.25 * (k - 1.5), k * 1.3, 0.3 * (k - 1.5)]).castShadow = false; });
      // бутон в третьем горшке → золотой цветок
      const P3 = POTS[2];
      cyl(S, M.leafD, P3.x, 0.88, P3.z, 0.008, 0.16);
      const bud = put(g, GEO.sphLo, M.leaf, [P3.x, 0.99, P3.z], [0.06, 0.09, 0.06]); bud.castShadow = false;
      const flower = grp(g, P3.x, 0.98, P3.z); flower.visible = false;
      for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; put(flower, GEO.sphLo, M.gold, [Math.cos(a) * 0.085, 0.015, Math.sin(a) * 0.085], [0.07, 0.03, 0.045], [0, -a, 0.25]); }
      sphS(flower, M.orange, 0, 0.03, 0, 0.045);
      R.bake(flower, null, { cast: false });
      const budHalo = R.halo(g, P3.x, 1.04, P3.z + 0.05, 1.0, '#FFE08A', 0); budHalo.visible = false;
      [bud, flower].forEach(o => o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));
      // капли из лейки (10 точек)
      const DN = 10, dpos = new Float32Array(DN * 3), dvel = new Float32Array(DN * 3), dgeo = R.keep(new T.BufferGeometry()); dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
      const drops = new T.Points(dgeo, R.keep(new T.PointsMaterial({ color: 0x9FD4F0, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false })));
      drops.visible = false; drops.frustumCulled = false; g.add(drops);
      let dropT = -1;
      // лейка на полу (волна 5: носиком к залу — так лейку и берут рукой, без доворота в воздухе)
      const can = grp(g, 0.62, 0, -0.5, CAN_YAW);
      cyl(can, M.mint, 0, 0.12, 0, 0.1, 0.22); cyl(can, M.mint, 0.13, 0.17, 0, 0.016, 0.24, [0, 0, -0.95]); put(can, GEO.cone, M.mint, [0.23, 0.26, 0], [0.035, 0.05, 0.035], [0, 0, -0.95]);
      put(can, R.keep(new T.TorusGeometry(0.07, 0.014, 6, 14, PI)), M.mint, [-0.03, 0.24, 0], null, [0, 0, 0.2]);
      R.bake(can, null, { cast: true }); can.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      prox('spot:pots', 1.8, 0.55, -1.2, 2.1, 1.1, 0.6);

      /* ---------- тыквы (с недели 1): без лиц, только бока ---------- */
      const PUMP = week >= 1;
      if (PUMP) {
        const pg = new T.SphereGeometry(1, 20, 12), pp = pg.attributes.position;
        for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.cos(a * 8); pp.setXYZ(i, x * k, y * 0.72, z * k); }
        pg.computeVertexNormals(); R.keep(pg);
        [[-1.18, -0.72, 0.24, M.orange], [-0.84, -0.6, 0.19, M.white], [-0.98, -0.88, 0.15, M.pink]].forEach(([x, z, r, m]) => { put(F, pg, m, [x, r * 0.72, z], [r, r, r]); cyl(F, M.leafD, x, r * 1.4, z, 0.02, 0.08); });
        prox('spot:pumpkins', -1.0, 0.25, -0.72, 0.85, 0.6, 0.6);
      }

      /* ---------- тётушка Жужа: пчела в лавандовую полоску, с круглыми очками ---------- */
      const zz = R.npc.bee({ stripe: '#B9A5E8' });
      zz.id = 'zhuzha'; zz.root.userData.key = 'npc:zhuzha';
      const ink = toon('#4A3A48');
      (zz.root.userData.wings || []).forEach(w => { w.userData.dyn = true; });
      zz.body.traverse(m => { if (m.isMesh && Math.abs(m.scale.x - 0.012) < 1e-4) m.material = ink; });
      [-1, 1].forEach(sd => put(zz.body, R.ringG(0.028, 0.006), ink, [sd * 0.033, 0.128, 0.145], null, [0, sd * 0.25, 0]));
      box(zz.body, ink, 0, 0.13, 0.15, 0.016, 0.005, 0.005);
      R.bake(zz.body, null, { cast: false });
      put(zz.root, GEO.sph, hitM, [0, 0.06, 0], [0.17, 0.17, 0.17]).castShadow = false;
      zz.root.scale.setScalar(2.4); g.add(zz.root);
      const hover = t => { const w = t * PI * 2 / 18; return [-0.15 + 1.45 * Math.sin(w), 2.05 + 0.1 * Math.sin(3 * w), -3.15 + 0.38 * Math.sin(2 * w)]; };
      const HC = [2.72, 1.85, -2.35];   // где танцевать у полки с мёдом
      let zMode = 'hover', zT = 0, zFrom = null;
      const zPos = new T.Vector3(...hover(0)), zPrev = new T.Vector3();
      const danceAt = q => {   // восьмёрка в вертикальной плоскости, прямой пробег — с покачиванием
        const cyc = Math.floor(q), f = q - cyc, sd = cyc % 2 ? -1 : 1;
        if (f < 0.45) { const k = f / 0.45; return [HC[0] + Math.sin(k * 70) * 0.035, HC[1] - 0.22 + k * 0.44, HC[2]]; }
        const k = (f - 0.45) / 0.55; return [HC[0] + sd * 0.26 * Math.sin(k * PI), HC[1] + 0.22 * Math.cos(k * PI), HC[2]];
      };

      const blockers = [
        { x0: OX - 0.38, x1: OX + 0.38, z0: OZ - 0.38, z1: OZ + 0.38 },       // кадка
        { x0: MX - 0.25, x1: MX + 0.25, z0: MZ - 0.25, z1: MZ + 0.25 },       // мимоза
        { x0: SFX - 0.32, x1: SFX + 0.32, z0: SFZ - 0.32, z1: SFZ + 0.32 },   // подсолнух
        { x0: HX - 0.25, x1: W / 2, z0: HZ - 0.55, z1: HZ + 0.55 },           // полка с мёдом
        { x0: 0.78, x1: 2.82, z0: -1.44, z1: -0.96 },                          // скамейка с горшками
        { x0: -W / 2, x1: W / 2, z0: -D, z1: -4.45 },                          // грядки у задней стены
        { x0: -W / 2, x1: -2.86, z0: -3.1, z1: -1.6 },                         // грядка у левой стены
        { x0: 2.84, x1: W / 2, z0: -0.82, z1: -0.28 },                         // кадка в правом углу
        { x0: -2.86, x1: -2.34, z0: -0.6, z1: -0.25 },                         // ящики с рассадой
        { x0: -1.42, x1: -1.18, z0: -3.72, z1: -3.48 }, { x0: 0.67, x1: 0.89, z0: -3.83, z1: -3.61 }, { x0: -1.66, x1: -1.44, z0: -1.16, z1: -0.94 },
      ];
      if (PUMP) blockers.push({ x0: -1.42, x1: -0.62, z0: -1.0, z1: -0.46 });

      R.bake(F, null, { cast: true });
      R.bake(S, null, { cast: false });
      [F, S].forEach(q => q.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));
      fronds.raycast = () => {};

      const spots = [
        { id: 'orange', x: -2.3, z: -2.85, act: 'Посмотреть', bubble: 'апельсиновое дерево' },
        { id: 'mimosa', x: 0.25, z: -2.35, act: 'Коснуться', bubble: 'стыдливая мимоза' },
        { id: 'sunflower', x: 1.15, z: -3.05, act: 'Посмотреть', bubble: 'подсолнух' },
        { id: 'honey', x: 2.45, z: -2.25, act: 'Спросить', bubble: 'мёд' },
        { id: 'pots', x: 0.3, z: -1.25, act: 'Полить', bubble: 'три горшка' },
      ];
      if (PUMP) spots.push({ id: 'pumpkins', x: -0.85, z: -1.5, act: 'Посмотреть', bubble: 'тыквы' });
      let budK = 1, budTgt = 1, bloom = 0;
      return {
        W, D,
        bounds: { x0: -3.2, x1: 3.2, z0: -4.2, z1: -0.3 },
        exit: { x: -3.05, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -1.9, z: -1.7 },
        cam: { x0: -1.25, x1: 1.25, z: -1.6 },
        blockers,
        catSpot: { x: 0.2, z: -3.0, ry: 0.3 },
        spots,
        npcs: { zhuzha: zz },
        // для содержимого места
        pots: POTS,
        touchMimosa(bow) { if (bow) { bowT = 0; FR.forEach((f, i) => { f.tgt = { yaw: BOW[i][0], pitch: BOW[i][1], fold: BOW[i][2] }; }); } else { foldT = 0; FR.forEach(f => { f.tgt = { yaw: f.yaw, pitch: f.pitch - 0.45, fold: 1.2 }; }); } },
        faceDot(hx, hz) { const a = head.rotation.y, dx = hx - SFX, dz = hz - SFZ, l = Math.hypot(dx, dz) || 1; return (Math.sin(a) * dx + Math.cos(a) * dz) / l; },
        waggle() { if (zMode === 'hover') { zMode = 'go'; zT = 0; zFrom = zPos.clone(); } },
        canOnFloor(on) { can.visible = !!on; },
        // волна 5: лейка для настоящих рук (js/interact.js) — та же мятная лейка, в осях хвата: начало — кулак на верхней ручке,
        // +y — носик (вперёд), +z — вниз (так она висит в опущенной руке). canAt — где стоит лейка на полу (верх ручки)
        canAt: [0.62, 0.31, -0.5],
        // где встать, чтобы взять левой рукой: за лейкой, лицом к залу (носик смотрит туда же), лейка — перед левым плечом
        canStand: { pos: [0.54, 0, -0.82], yaw: 0 },
        canItem() {
          const it = new T.Group(); it.name = 'can'; it.userData.roomItem = true;
          const body = new T.Mesh(R.keep(new T.CylinderGeometry(0.1, 0.1, 0.22, 16)), M.mint); body.rotation.x = PI / 2; body.position.set(0, 0, 0.18); it.add(body);
          const lid = new T.Mesh(R.keep(new T.CylinderGeometry(0.075, 0.1, 0.04, 16)), M.mint); lid.rotation.x = PI / 2; lid.position.set(0, 0, 0.055); it.add(lid);
          const arc = new T.CatmullRomCurve3([[0, -0.07, 0.06], [0, -0.05, 0.012], [0, 0, -0.006], [0, 0.05, 0.012], [0, 0.07, 0.06]].map(q => new T.Vector3(q[0], q[1], q[2])));
          it.add(new T.Mesh(R.keep(new T.TubeGeometry(arc, 12, 0.014, 6)), M.mint));
          const a0 = new T.Vector3(0, 0.07, 0.2), a1 = new T.Vector3(0, 0.24, 0.1), sp = new T.Mesh(R.keep(new T.CylinderGeometry(0.014, 0.018, a0.distanceTo(a1), 8)), M.mint);
          sp.position.copy(a0).add(a1).multiplyScalar(0.5); sp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), a1.clone().sub(a0).normalize()); it.add(sp);
          const rose = new T.Mesh(R.keep(new T.ConeGeometry(0.035, 0.05, 10)), M.mint); rose.position.copy(a1); rose.quaternion.copy(sp.quaternion); it.add(rose);
          it.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; m.raycast = () => {}; } });
          // как стоит на полу: тело вниз, носик — туда же, куда у лейки на полу (поворот CAN_YAW)
          const dirS = new T.Vector3(Math.cos(CAN_YAW), 0, -Math.sin(CAN_YAW)), dn = new T.Vector3(0, -1, 0), ax = new T.Vector3().crossVectors(dirS, dn);
          it.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(ax, dirS, dn));
          if (window.Interact && Interact.items && Interact.items.wrap) {
            Interact.items.wrap(it, { in: 0, up: 0, fwd: 0 });
            const d = it.userData.it; d.name = 'can'; d.def.reachRot = { itemY: [0, 0, 1], itemZ: [0, -1, 0] }; d.def.pour = { key: [0, 0.25, 0.1] };
            d.dispose = () => { if (it.parent) it.parent.remove(it); };   // геометрии — комнаты (R.keep), материал — общий
          }
          return it;
        },
        water(i) { const pt = POTS[i]; dropT = 0; drops.visible = true; for (let k = 0; k < DN; k++) { dpos.set([pt.x - 0.12 + Math.random() * 0.06, 1.12 + Math.random() * 0.06, pt.z + (Math.random() - 0.5) * 0.06], k * 3); dvel.set([0.25 + Math.random() * 0.2, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2], k * 3); } budTgt = [1.18, 1.36, 1.55][i] || 1.55; },
        bloom(on) { bloom = on ? 1 : 0; flower.visible = !!on; bud.visible = !on; budHalo.visible = !!on; if (on) { flower.scale.setScalar(0.2); budHalo.material.opacity = 0; } },
        tick(t, dt, ctx) {
          // лампы чуть дышат
          halos.forEach((h, i) => { h.material.opacity = 0.56 + Math.sin(t * 1.3 + i * 2) * 0.04; });
          // мимоза: складывается за 0,3 с и раскрывается через 3 с
          const lerpF = (k) => FR.forEach(f => { const s = f.tgt || { yaw: f.yaw, pitch: f.pitch, fold: 0 }; ['yaw', 'pitch', 'fold'].forEach(p => { f.cur[p] += (s[p] - f.cur[p]) * Math.min(1, dt * k); }); });
          if (bowT >= 0) { bowT += dt; if (bowT > 3.4) { bowT = -1; FR.forEach(f => { f.tgt = null; }); } lerpF(bowT < 0 ? 3 : 6); placeFronds(); }
          else if (foldT >= 0) { foldT += dt; if (foldT > 3.3) { foldT = -1; FR.forEach(f => { f.tgt = null; }); } lerpF(foldT < 0.3 && foldT >= 0 ? 12 : 3); placeFronds(); }
          else if (FR.some(f => Math.abs(f.cur.fold) > 0.002 || Math.abs(f.cur.pitch - f.pitch) > 0.002 || Math.abs(f.cur.yaw - f.yaw) > 0.002)) { lerpF(3); placeFronds(); }
          // подсолнух: оборот за 40 с
          head.rotation.y = t * PI * 2 / 40;
          // туман раз в 6 с
          const mk = (t % 6) / 6;
          if (mk < 0.4) { const q = mk / 0.4; for (let i = 0; i < 3; i++) mpos.set([OX + 0.4 + (i - 1) * 0.18 * q, 2.55 - q * 0.6 - i * 0.05, -4.45 + q * 0.3], i * 3); mgeo.attributes.position.needsUpdate = true; mist.material.opacity = Math.sin(q * PI) * 0.55; mist.material.size = 0.3 + q * 0.5; }
          else mist.material.opacity = 0;
          // капли
          if (dropT >= 0) { dropT += dt; for (let k = 0; k < DN; k++) { dvel[k * 3 + 1] -= 4.5 * dt; for (let j = 0; j < 3; j++) dpos[k * 3 + j] += dvel[k * 3 + j] * dt; if (dpos[k * 3 + 1] < 0.82) dpos[k * 3 + 1] = 0.82; } dgeo.attributes.position.needsUpdate = true; if (dropT > 1.1) { dropT = -1; drops.visible = false; } }
          budK += (budTgt - budK) * Math.min(1, dt * 3); bud.scale.set(0.06 * budK, 0.09 * budK, 0.06 * budK);
          if (bloom && flower.scale.x < 1) { const s = Math.min(1, flower.scale.x + dt * 1.2); flower.scale.setScalar(s); budHalo.material.opacity = 0.75 * s; }
          if (bloom) { budHalo.material.opacity = 0.62 + Math.sin(t * 2.2) * 0.1; flower.rotation.y = t * 0.3; }
          // Жужа: медленная восьмёрка между деревом и горшками; у мёда — танец
          zPrev.copy(zPos);
          if (zMode === 'hover') zPos.set(...hover(t));
          else if (zMode === 'go') { zT += dt; const k = Math.min(1, zT / 0.9), e = k * k * (3 - 2 * k); zPos.copy(zFrom).lerp(new T.Vector3(HC[0], HC[1] - 0.22, HC[2]), e); if (k >= 1) { zMode = 'dance'; zT = 0; } }
          else if (zMode === 'dance') { zT += dt; zPos.set(...danceAt(zT / 1.5)); if (zT > 4.5) { zMode = 'back'; zT = 0; zFrom = zPos.clone(); } }
          else if (zMode === 'back') { zT += dt; const k = Math.min(1, zT / 1.1), e = k * k * (3 - 2 * k), tg = new T.Vector3(...hover(t)); zPos.copy(zFrom).lerp(tg, e); if (k >= 1) zMode = 'hover'; }
          zz.root.position.copy(zPos);
          const vx = zPos.x - zPrev.x, vz = zPos.z - zPrev.z;
          if (zMode === 'dance') zz.root.rotation.y += (0 - zz.root.rotation.y) * Math.min(1, dt * 6);
          else if (Math.hypot(vx, vz) > 1e-4) { const a = Math.atan2(vx, vz); let d = a - zz.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); zz.root.rotation.y += d * Math.min(1, dt * 4); }
          // кот под средней лампой — просто сидит; ничего не подставляем
          void ctx;
        },
      };
    },
  });

  /* ---------------------------- содержимое ---------------------------- */
  G.addSpeakers({
    zhuzha: { name: () => 'Тётушка Жужа', art: () => { try { return Art.bee({ crop: true }).replace(/#4A3A48/g, '#9C86D8').replace('</svg>', '<g fill="none" stroke="#5B4A3E" stroke-width="1.6"><circle cx="40" cy="38" r="4.6"/><circle cx="50" cy="38" r="4.6"/><path d="M44.6,38 L45.4,38"/></g></svg>'); } catch (e) { return G.emojiAvatar('🐝', '#FFF1A8'); } } },
  });
  // шаг мини «Полить» внутри визита: 0 — не начато, 1 — лейка в руке, 2..4 — политы горшки 1..3
  let water = 0;
  const potsLabel = ctx => `Три горшка ${ctx.flag('bud') ? '🌼' : water >= 3 ? '🌿' : '🌱'}`;
  async function potsUse(ctx) {
    const room = ctx.is3d ? ctx.api.room : null;
    if (ctx.flag('bud')) { await ctx.play('Цветок светится. Дежурство идёт по плану.'); return true; }
    if (water === 0) {
      water = 1;
      // волна 5: лейку берёт настоящая рука (наклонилась, взяла за верхнюю ручку); без слоя рук — как раньше
      if (room) {
        const hands = ctx.api.hands && ctx.api.hands() && ctx.api.takeItem && room.canItem && window.Interact;
        room.canOnFloor(false);
        let ok = false;
        if (hands) { try { ok = await ctx.api.takeItem({ kind: 'can', obj: room.canItem(), at: room.canAt, stand: room.canStand, pose: { crouch: 1.25, bend: 0.9 } }); } catch (e) { ok = false; } }
        if (!ok) ctx.api.setHeld('can');
      }
      await ctx.play('Лейка у следствия. Цветы — под наблюдением.');
      return true;
    }
    const i = water - 1; water++;
    if (room) {
      const pt = room.pots[i]; await ctx.api.walkTo(pt.x, -1.85);
      // волна 5: настоящая рука наклоняет лейку носиком к горшку — вода идёт, когда носик опустился
      if (ctx.api.pour && ctx.api.heldItem && ctx.api.heldItem()) { let went = false; await ctx.api.pour([pt.x - 0.1, 1.08, pt.z], () => { went = true; room.water(i); }); if (!went) room.water(i); }
      else room.water(i);
    }
    ctx.haptic('light');
    if (i < 2) { await ctx.play(i === 0 ? 'Первый горшок полит. Росток выпрямился.' : 'Второй — тоже. Бутон в третьем прислушивается.'); return true; }
    await ctx.wait(room ? 900 : 200);
    if (room) room.bloom(true);
    ctx.sparkle('star');
    await ctx.say({ who: 'zhuzha', text: 'Он светится! Всё, назначаем его временным солнцем. Зарплата — полив.', s: 'o_bud' });
    ctx.flag('bud', 1);
    water = 0;
    if (room) { const h = ctx.held, b = ctx.st.bouquet; if (h === 'cup') ctx.api.setHeld('cup', { liquid: '#8B5A3C', foam: true }); else if (h) ctx.api.setHeld(h); else if (b) ctx.api.setHeld('bouquet', b); else ctx.api.setHeld(null); room.canOnFloor(true); }
    return true;
  }
  async function mimosaUse(ctx) {
    const room = ctx.is3d ? ctx.api.room : null;
    const n = ctx.n('mimosa');
    if (n === 3 && !ctx.has('o_bow')) {
      if (room) room.touchMimosa(true);
      ctx.haptic('light');
      await ctx.wait(room ? 700 : 100);
      await ctx.say({ text: 'Мимоза сложилась бантиком. Случайность — следствие сомневается.', s: 'o_bow' });
      return true;
    }
    if (room) room.touchMimosa(false);
    ctx.haptic('light');
    await ctx.line('mimosa');
    return true;
  }
  async function sunflowerUse(ctx) {
    const room = ctx.is3d ? ctx.api.room : null;
    let faces = false;
    if (room) { const hp = ctx.api.heroPos(); faces = room.faceDot(hp.x, hp.z) > 0.9; }
    else faces = Math.random() < 1 / 3;
    if (faces && !ctx.has('o_sun')) { await ctx.say({ text: 'Подсолнух повернулся прямо к тебе. Кажется, ты ему понравилась.', s: 'o_sun' }); return true; }
    await ctx.line('sunflower');
    return true;
  }
  async function honeyUse(ctx) {
    const room = ctx.is3d ? ctx.api.room : null;
    if (room) room.waggle();
    await ctx.line('honey');
    return true;
  }

  Town.place({
    id: P, kind: 'new', storySafe: true,   // проверено: без спойлеров серии 1 — можно заходить во время дела
    name: 'Оранжерея «Тепло»', short: 'Оранжерея',
    sign: 'ТЕПЛО', motto: 'оранжерея семьи Жу',
    icon: '🌿', color: '#BFE6D3',
    street: { x: -7.2, w: 3.4, doorDx: 0, bkey: null },
    room: P, opens: 0,
    host: { who: 'zhuzha', npc: 'zhuzha' },
    greet: {
      first: ['Заходи погреться! Солнце пропало, но растения отказываться от жизни не собираются.', 'Я Жужа, тётя Жу. Она продаёт готовую красоту, а я выращиваю будущую.'],
      again: Town.v('Заглянула согреться? Правильно. У нас всегда лето, только за электричество платим.', '{name}! Лампы как раз разогрелись.', 'О, ты! Мимоза увидела тебя и тут же сложила листья. Не принимай на свой счёт.'),
      regular: Town.v('Вы тут уже своя. Мимоза при вас почти не стесняется.', 'Ж-ж-жизнь кипит: рассада растёт, лампы греют.', 'Лейка уже полная. Просто совпадение.'),
      away: 'У лимона новый листочек! Да, здесь это повод устроить праздник.',
    },
    bark: 'Ж-ж-жду у ламп!',
    weekly: { 1: 'Тыквы приехали погреться. Говорят, ненадолго.', 3: 'Мимоза зацвела. Я так радовалась, что она снова закрыла листья.' },
    fresh: [1, 3],
    react: {
      bouquet: 'Букет в оранжерее! Передай цветам, что родные здоровы.',
      cup: 'Какао пахнет чудесно. Даже апельсин заинтересовался.',
      popcorn: 'Попкорн? Это же кукуруза — почти родственница!',
      look: 'Ж-ж-жизнерадостный образ. Цветы одобряют, я только передаю.',
    },
    spots: {
      orange: { icon: '🍊', label: 'Апельсиновое дерево',
        lines: [{ f: 'orang' }, 'Три апельсина на дереве. У Жужи на каждого свои планы.'] },
      mimosa: { icon: '🌿', label: 'Стыдливая мимоза', secret: 'o_bow',
        lines: [{ f: 'mimos' }, 'Мимоза свернула листья. Социальная батарейка на нуле.'], onUse: mimosaUse },
      sunflower: { icon: '🌻', label: 'Подсолнух', secret: 'o_sun',
        lines: ['Подсолнух смотрит на лампу. Временная замена солнца принята.', 'Подсолнух крутится не спеша: один оборот — сорок секунд.'], onUse: sunflowerUse },
      honey: { icon: '🍯', label: 'Мёд',
        lines: [
          [{ f: 'waggl' }, { who: 'zhuzha', text: 'А пока солнца нет — танцую по лампе. Коллеги не жалуются.' }],
          'Мёд с прошлого лета. Иногда счастье действительно в банке.',
          { if: ctx => ctx.catHere, text: 'Пирожок повторил танец. Пчёлы перевели: „до миски — прямо“.' },
        ], onUse: honeyUse },
      pots: { icon: '🪴', label: potsLabel, secret: 'o_bud', lines: [], onUse: potsUse },
      pumpkins: { icon: '🎃', label: 'Тыквы', when: ctx => ctx.week >= 1,
        lines: [{ f: 'pumpk' }, 'Тыквы греются под лампами. Отказываются комментировать планы на ноябрь.'] },
    },
    npc: {
      zhuzha: [
        { who: 'zhuzha', text: 'Я читаю растениям прогноз. Им нравится, что он оптимистичный.' },
        { who: 'zhuzha', text: 'Цветочный бутик по соседству — это Жу. Ж-живой филиал.' },
      ],
    },
    enter: async ctx => {
      water = 0;
      const room = ctx.is3d ? ctx.api.room : null;
      if (room && room.bloom) room.bloom(!!ctx.flag('bud'));
    },
    facts: {
      orang: { text: '„Оранжерея“ — от французского orange: такие дома строили, чтобы апельсиновые деревья пережили зиму.', wk: 0 },
      mimos: { text: 'Мимоза стыдливая и правда складывает листья от прикосновения. Считается, что так она защищается.', wk: 0 },
      waggl: { text: 'Пчёлы танцуют восьмёрку: угол танца показывает, куда лететь относительно солнца.', wk: 0 },
      pumpk: { text: 'Тыквы родом из Америки. В Европу они попали после плаваний Колумба.', wk: 1 },
    },
    secrets: [
      { id: 'o_bud', title: 'Цветок-дежурный', trigger: 'три горшка: полить все три' },
      { id: 'o_bow', title: 'Мимоза-бантик', trigger: 'мимоза: третье касание за визит' },
      { id: 'o_sun', title: 'Взгляд подсолнуха', trigger: 'подсолнух смотрит на героиню (2D: 1 из 3)' },
    ],
    stamp: { title: 'Оранжерея', icon: '🌿' },
  });
})();
