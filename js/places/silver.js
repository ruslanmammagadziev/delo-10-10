/* =====================================================================
   МЕСТО ПРОГУЛКИ: silver — Часовая мастерская (kind existing, дверь x 12.47).
   Тихая мастерская без хозяина: витрина со старинными часами под стеклянным
   колпаком, верстак с лампой-лупой и тонкой проволокой, окно на холмы над
   верстаком, табличка у входа (каждую неделю — обычная рабочая надпись),
   карманные часы на бархате, этажерка с часами. Мастер вышел и не появляется;
   ничего здесь не обращено к героине и не спрятано для неё.
   Комната 4.6×3.6: дверь на улицу — левая стена (exit −1.85, −0.8),
   spawn (−0.5, −0.9). Мини «Волосок» — тапы по проволоке (api.intercept).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'silver';
  const SIGNS = [
    'Открыто. Смотреть можно, трогать — глазами.',
    'Просьба не стучать по колпаку: часы думают.',
    'Тише: здесь слушают, как тикает.',
    'Мастерская на обеде. Часы — нет.',
    'Чиним время. Терпение прилагается.',
    'Не дышите на витрину: запотеет от восхищения.',
    'Часы работы: пока горит лампа.',
  ];
  const wk = () => { try { return Math.max(0, Math.min(6, Town.week())); } catch (e) { return 0; } };

  /* ---------------------------- 3D-комната ---------------------------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#EEE6EE', gnd: '#8E786C', hi: 0.66, sun: '#FFE9D4', si: 0.4, off: [-2.4, 7, 5.5], bg: 'radial-gradient(120% 80% at 50% 28%, #6E6474 0%, #3B3442 74%)', rim: ['#E6EEF8', 0.24], fog: '#3B3442' },
    cam: { portrait: { dx: 0, y: 6.2, dz: 4.4, ly: 1.0, lz: -0.4, fov: 58 }, landscape: { dx: 0, y: 4.6, dz: 6.0, ly: 1.1, lz: -0.9, fov: 46 } },
    build(R) {
      const { T, PI, group: g, put, box, cyl, rbox, sphS, GEO } = R;
      const W = 4.6, D = 3.6, H = 3.2;
      const toon = R.toon;
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const hitM = basic('#FFFFFF', { visible: false });
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (par, x, y, z, w, h, d) => { const m = put(par, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; return m; };
      const [pcv, pc] = R.cnv(128, 128);
      pc.fillStyle = '#FFF4EC'; pc.fillRect(0, 0, 128, 128); pc.fillStyle = '#F8E9DF'; pc.fillRect(40, 0, 48, 128);
      pc.fillStyle = '#E2E1E8'; [[64, 32], [64, 96], [12, 64], [116, 64]].forEach(([x, y]) => { pc.beginPath(); pc.moveTo(x, y - 6); pc.lineTo(x + 4, y); pc.lineTo(x, y + 6); pc.lineTo(x - 4, y); pc.fill(); });
      const paperT = R.tex(pcv); paperT.wrapS = paperT.wrapT = T.RepeatWrapping; paperT.repeat.set(1.8, 1.8);
      const M = {
        wall: toon('#FFFFFF', { map: paperT }), wain: toon('#C9CED6'), trim: toon('#A9B0BC'),
        wood: toon('#B98C6A'), woodD: toon('#8E6248'),
        velvet: toon('#9E2F47'), steel: toon('#B9C1CD', { emissive: new T.Color('#E8F0FF'), emissiveIntensity: 0.1 }),
        brass: toon('#E8C770', { emissive: new T.Color('#B8903A'), emissiveIntensity: 0.14 }), ink: toon('#5A4C5C'),
        lamp: toon('#FFF6DE', { emissive: new T.Color('#FFE2A0'), emissiveIntensity: 0.95 }),
        glass: toon('#FFFFFF', { transparent: true, opacity: 0.26, depthWrite: false }),
        sand: toon('#E8D7B5'),
      };
      // циферблат: кремовый круг, 12 делений, стрелки на 10:10 (вне круга — прозрачно)
      const dialM = (() => {
        const N = 256, [cv, c] = R.cnv(N, N), h = N / 2, r = h * 0.94;
        c.fillStyle = '#FFF8EC'; c.beginPath(); c.arc(h, h, r, 0, 7); c.fill();
        c.strokeStyle = '#C9A24A'; c.lineWidth = N * 0.05; c.beginPath(); c.arc(h, h, r - N * 0.025, 0, 7); c.stroke();
        c.strokeStyle = '#5A4C5C'; c.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * PI * 2, big = i % 3 === 0, r0 = r * (big ? 0.64 : 0.7);
          c.lineWidth = N * (big ? 0.035 : 0.02); c.beginPath(); c.moveTo(h + Math.sin(a) * r0, h - Math.cos(a) * r0); c.lineTo(h + Math.sin(a) * r * 0.8, h - Math.cos(a) * r * 0.8); c.stroke();
        }
        const hand = (a, len, w) => { c.lineWidth = N * w; c.beginPath(); c.moveTo(h, h); c.lineTo(h + Math.sin(a) * r * len, h - Math.cos(a) * r * len); c.stroke(); };
        hand((10 + 10 / 60) / 12 * PI * 2, 0.42, 0.05); hand(10 / 60 * PI * 2, 0.62, 0.035);
        c.fillStyle = '#C9A24A'; c.beginPath(); c.arc(h, h, N * 0.045, 0, 7); c.fill();
        return toon('#FFFFFF', { map: R.tex(cv), alphaTest: 0.5 });
      })();
      const dialAt = (par, x, y, z, d) => R.plane(par, dialM, x, y, z, d, d);

      /* ---------- атлас: пол, вид из окна, табличка, коврик, эскизы ---------- */
      const AW = 1024, AH = 1024, [acv, ac] = R.cnv(AW, AH);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv) });
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / AW, u1 = (sx + sw) / AW, v0 = 1 - (sy + sh) / AH, v1 = 1 - sy / AH;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
        const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      // пол: тёмные доски
      { const q = R.rng(7), c = ac; c.fillStyle = '#7E604E'; c.fillRect(0, 0, 512, 512);
        const tones = ['#8A6B57', '#937360', '#856652', '#8F6E5A', '#9A7964'], rows = 18, rh = 512 / rows;
        for (let r = 0; r < rows; r++) { let x = -q() * 160; while (x < 512) { const L = 120 + q() * 170; c.fillStyle = tones[Math.floor(q() * tones.length)]; R.rrect(c, x + 2, r * rh + 1.5, L - 4, rh - 3, 3); c.fill();
          c.strokeStyle = 'rgba(70,45,30,.16)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 8, r * rh + rh * 0.5); c.bezierCurveTo(x + L * 0.3, r * rh + rh * 0.35, x + L * 0.7, r * rh + rh * 0.65, x + L - 8, r * rh + rh * 0.5); c.stroke(); x += L; } } }
      // вид из окна: мягкие осенние холмы, облака и круглые деревца
      { const c = ac, ox = 512, oy = 0, w = 512, h = 416;
        c.save(); c.translate(ox, oy); c.beginPath(); c.rect(0, 0, w, h); c.clip();
        const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#C9C6DE'); sky.addColorStop(0.6, '#E6DCE8'); sky.addColorStop(1, '#F1E2E6'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,.55)'; [[90, 70, 44], [140, 62, 30], [380, 96, 36], [420, 90, 26]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.55, 0, 0, 7); c.fill(); });
        c.fillStyle = '#C3B9D2'; c.beginPath(); c.moveTo(0, 250); c.quadraticCurveTo(110, 178, 230, 232); c.quadraticCurveTo(330, 278, 420, 210); c.quadraticCurveTo(470, 178, 512, 196); c.lineTo(512, h); c.lineTo(0, h); c.fill();
        c.fillStyle = '#D6C7A0'; c.beginPath(); c.moveTo(0, 330); c.quadraticCurveTo(140, 256, 290, 312); c.quadraticCurveTo(400, 350, 512, 292); c.lineTo(512, h); c.lineTo(0, h); c.fill();
        c.fillStyle = '#C8B58C'; c.beginPath(); c.moveTo(0, 392); c.quadraticCurveTo(200, 334, 512, 382); c.lineTo(512, h); c.lineTo(0, h); c.fill();
        [[96, 300, 16, '#E0A46E'], [128, 293, 12, '#D9B36A'], [352, 330, 14, '#E3A070'], [382, 336, 10, '#D9B36A'], [452, 302, 13, '#E0A46E']].forEach(([x, y, r, col]) => {
          c.fillStyle = '#8A6B57'; c.fillRect(x - 2, y, 4, r * 0.9);
          c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
          c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.42, 0, 7); c.fill();
        });
        c.restore(); }
      // табличка у входа: обычная рабочая надпись недели (Caveat)
      { const c = ac, ox = 512, oy = 416, w = 512, h = 384;
        c.fillStyle = '#FFF8EE'; c.fillRect(ox, oy, w, h);
        c.strokeStyle = '#C9CED6'; c.lineWidth = 10; R.rrect(c, ox + 18, oy + 18, w - 36, h - 36, 22); c.stroke();
        const words = SIGNS[wk()].split(' '), lines = [], maxW = 400;
        c.font = '700 54px Caveat, cursive'; let cur = '';
        words.forEach(wd => { const t2 = cur ? cur + ' ' + wd : wd; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t2; }); if (cur) lines.push(cur);
        const lh = 58, y0 = oy + h / 2 - (lines.length - 1) * lh / 2;
        lines.forEach((ln, i) => R.text(c, ln, ox + w / 2, y0 + i * lh, 54, '#5A4C5C', { f: 'Caveat', w: 700, max: 430 }));
        c.strokeStyle = '#A9B0BC'; c.lineWidth = 3; c.beginPath(); c.arc(ox + w / 2, oy + 44, 9, 0, 7); c.stroke(); }
      // коврик: кремовый, с серой каймой и завитками
      { const c = ac, ox = 0, oy = 512, w = 512, h = 256;
        c.fillStyle = '#E9E3EC'; R.rrect(c, ox + 4, oy + 4, w - 8, h - 8, 26); c.fill();
        c.fillStyle = '#FFF6EE'; R.rrect(c, ox + 22, oy + 22, w - 44, h - 44, 18); c.fill();
        c.strokeStyle = '#B9BFCB'; c.lineWidth = 5; c.lineCap = 'round';
        const curl = (x, y, s, dir) => { c.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * PI * 2.6, r = s * (1 - k / 46); const px = x + dir * Math.cos(a) * r, py = y + Math.sin(a) * r; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); };
        curl(ox + 120, oy + 128, 46, 1); curl(ox + 392, oy + 128, 46, -1);
        c.beginPath(); c.moveTo(ox + 170, oy + 128); c.bezierCurveTo(ox + 220, oy + 80, ox + 292, oy + 176, ox + 342, oy + 128); c.stroke();
        c.fillStyle = '#C9A2AE'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(ox + 40 + i * 17.3, oy + 14, 3.2, 0, 7); c.fill(); c.beginPath(); c.arc(ox + 40 + i * 17.3, oy + h - 14, 3.2, 0, 7); c.fill(); } }
      // два чертежа в рамках (левая стена): шестерёнка и циферблат
      [[512, 800], [768, 800]].forEach(([ox, oy], k) => {
        const c = ac, w = 248, h = 216; c.fillStyle = '#FBF5EA'; c.fillRect(ox + 4, oy + 4, w, h);
        c.strokeStyle = '#8C8FA0'; c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round';
        const cx = ox + 4 + w / 2, cy = oy + 4 + h / 2;
        if (!k) {
          const n = 12, r0 = 54, r1 = 68; c.beginPath();
          for (let i = 0; i < n * 2; i++) { const a0 = i / (n * 2) * PI * 2, a1 = (i + 1) / (n * 2) * PI * 2, rr = i % 2 ? r0 : r1; c.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr); c.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr); }
          c.closePath(); c.stroke(); c.beginPath(); c.arc(cx, cy, 16, 0, 7); c.stroke();
          for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; c.beginPath(); c.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16); c.lineTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); c.stroke(); }
        } else {
          c.beginPath(); c.arc(cx, cy, 68, 0, 7); c.stroke();
          for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.beginPath(); c.moveTo(cx + Math.sin(a) * 54, cy - Math.cos(a) * 54); c.lineTo(cx + Math.sin(a) * 63, cy - Math.cos(a) * 63); c.stroke(); }
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(-PI / 3) * 30, cy - Math.cos(-PI / 3) * 30); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(PI / 3) * 46, cy - Math.cos(PI / 3) * 46); c.stroke();
        }
      });
      // табличка «ВЫХОД» — тоже в атласе
      { const c = ac; c.fillStyle = '#3B3442'; R.rrect(c, 4, 772, 312, 88, 18); c.fill(); R.text(c, 'ВЫХОД', 160, 818, 58, '#BFF0CE'); }

      /* ---------- всё статичное склеивается в две группы: S — без тени, F — мебель с тенью;
         у точек — невидимые «ловушки тапа» (0 вызовов отрисовки) ---------- */
      const S = new T.Group(); g.add(S);
      const F = new T.Group(); g.add(F);
      const prox = (key, x, y, z, w, h, d, ry) => { const q = grp(g, x, y, z, ry || 0, key); hit(q, 0, 0, 0, w, h, d); return q; };

      /* ---------- оболочка: пол, стены с серо-голубыми панелями ---------- */
      box(S, M.woodD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
      aplane(S, [0, 0, 512, 512], [0, 0.002, -D / 2], [W, D, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      aplane(S, [0, 512, 512, 256], [-0.15, 0.006, -1.45], [1.7, 0.85, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      rbox(S, M.wall, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.05);
      [-1, 1].forEach(sd => {
        rbox(S, M.wall, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D + 0.2, 0.05);
        rbox(S, M.trim, sd * (W / 2 + 0.1), H / 2, 0.02, 0.28, H + 0.04, 0.07, 0.03);       // торец разреза
        box(S, M.trim, sd * (W / 2 - 0.04), H - 0.07, -D / 2, 0.08, 0.12, D);               // карниз
      });
      box(S, M.trim, 0, H - 0.07, -D + 0.04, W, 0.12, 0.08);
      // панели до 1 м: серо-голубые, с тонкими рамками и поручнем
      const wain = (x, z, len, ry) => {
        const q = grp(S, x, 0, z, ry);
        rbox(q, M.wain, 0, 0.5, 0.035, len, 1.0, 0.07, 0.025);
        box(q, M.trim, 0, 1.02, 0.07, len, 0.05, 0.05); box(q, M.trim, 0, 0.06, 0.075, len, 0.12, 0.04);
        const n = Math.max(1, Math.round(len / 0.75)), s = len / n;
        for (let i = 0; i < n; i++) box(q, M.trim, -len / 2 + s * (i + 0.5), 0.56, 0.072, s - 0.2, 0.6, 0.012);
      };
      wain(0, -D, W, 0); wain(-W / 2, -2.45, 2.3, PI / 2); wain(W / 2, -D / 2, D, -PI / 2);
      wain(-W / 2, -0.12, 0.24, PI / 2);
      [-2.25, 2.25].forEach(x => box(S, M.trim, x, 2.62, -D / 2, 0.04, 0.035, D));   // рейка для картин
      box(S, M.trim, 0, 2.62, -D + 0.02, W, 0.035, 0.04);

      /* ---------- дверь на улицу (левая стена) с табличкой «ВЫХОД» ---------- */
      const DZ = -0.8;
      { const dg = grp(S, -W / 2 + 0.01, 0, DZ, PI / 2);
        put(dg, R.extrude(R.archShape(1.14, 2.2), 0.06), M.trim, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(0.98, 2.08), 0.05), M.woodD, [0, 0, 0.06]);
        cyl(dg, M.lamp, 0, 1.58, 0.12, 0.12, 0.03, [PI / 2, 0, 0]); sphS(dg, M.brass, 0.34, 1.0, 0.13, 0.04);
        box(dg, M.wood, 0, 0.62, 0.115, 0.6, 0.5, 0.02);
        aplane(dg, [4, 772, 312, 88], [0, 2.45, 0.08], [0.66, 0.19, 1]);
        prox('exitDoor', -W / 2 + 0.1, 1.15, DZ, 0.2, 2.3, 1.1);
        R.halo(g, -W / 2 + 0.25, 2.45, DZ, 0.7, '#BFF0CE', 0.35); }
      { const bg2 = grp(S, -W / 2 + 0.12, 2.42, DZ - 0.62); cyl(bg2, M.trim, 0, 0.1, 0, 0.008, 0.2); put(bg2, GEO.cone, M.brass, [0, -0.02, 0], [0.06, 0.09, 0.06]); sphS(bg2, M.brass, 0, -0.07, 0, 0.018); }

      /* ---------- витрина: бархатный постамент, стеклянный колпак, старинные часы ---------- */
      const CX = -1.1, CZ = -1.8, TOP = 0.9;
      { const cg = grp(F, CX, 0, CZ);
        rbox(cg, M.woodD, 0, 0.06, 0, 0.72, 0.12, 0.72, 0.04);
        rbox(cg, M.velvet, 0, 0.48, 0, 0.6, 0.76, 0.6, 0.05);
        box(cg, M.brass, 0, TOP - 0.03, 0, 0.66, 0.05, 0.66);
        const dg2 = grp(S, CX, 0, CZ);
        box(dg2, M.brass, 0, 0.2, 0.302, 0.4, 0.02, 0.01);
        cyl(dg2, M.velvet, 0, TOP + 0.005, 0, 0.2, 0.01);
        put(dg2, R.keep(new T.TorusGeometry(0.36, 0.022, 6, 32)), M.brass, [0, TOP + 0.01, 0], null, [PI / 2, 0, 0]);
        sphS(dg2, M.brass, 0, TOP + 0.45, 0, 0.03); }
      // каминные часы: подставка, корпус-барабан, ободок, навершие; стрелки на 10:10
      { const ck = grp(F, CX, TOP, CZ, 0.25);
        rbox(ck, M.woodD, 0, 0.035, 0, 0.34, 0.06, 0.2, 0.02);
        [-0.13, 0.13].forEach(x => sphS(ck, M.brass, x, 0.006, 0.06, 0.018));
        cyl(ck, M.wood, 0, 0.2, 0, 0.13, 0.1, [PI / 2, 0, 0]);
        put(ck, R.keep(new T.TorusGeometry(0.118, 0.014, 6, 28)), M.brass, [0, 0.2, 0.052]);
        cyl(ck, M.brass, 0, 0.335, 0, 0.012, 0.03); sphS(ck, M.brass, 0, 0.355, 0, 0.02);
        dialAt(grp(S, CX, TOP, CZ, 0.25), 0, 0.2, 0.053, 0.22); }
      const dome = put(g, GEO.hemi, M.glass, [CX, TOP + 0.01, CZ], [0.35, 0.42, 0.35]); dome.castShadow = false; dome.receiveShadow = false; dome.renderOrder = 3; dome.raycast = () => {};
      prox('spot:jug', CX, 0.7, CZ, 0.76, 1.4, 0.76);
      // блик пробегает по колпаку раз в 4 с
      const [gcv, gc] = R.cnv(64, 64); { const gr = gc.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gc.fillStyle = gr; gc.fillRect(0, 0, 64, 64);
        gc.fillStyle = 'rgba(255,255,255,.9)'; gc.fillRect(30, 4, 4, 56); gc.fillRect(4, 30, 56, 4); }
      const glint = new T.Sprite(R.keep(new T.SpriteMaterial({ map: R.tex(gcv), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, fog: false })));
      glint.scale.setScalar(0.16); glint.renderOrder = 5; g.add(glint);
      // линза (скрыта): увеличенный механизм — шестерёнки и ступенчатая «улитка» часового боя
      const lens = grp(g, CX + 0.05, 1.32, -1.28); lens.visible = false;
      { const [ncv, nc] = R.cnv(256, 256);
        nc.save(); nc.beginPath(); nc.arc(128, 128, 120, 0, 7); nc.clip();
        nc.fillStyle = '#F3EEE4'; nc.fillRect(0, 0, 256, 256);
        const gear = (x, y, r0, n, col) => {
          nc.fillStyle = col; nc.beginPath();
          for (let i = 0; i < n * 2; i++) { const a0 = i / (n * 2) * PI * 2, a1 = (i + 1) / (n * 2) * PI * 2, rr = i % 2 ? r0 : r0 * 1.16; nc.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr); nc.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr); }
          nc.closePath(); nc.fill();
          nc.fillStyle = 'rgba(90,76,92,.22)'; nc.beginPath(); nc.arc(x, y, r0 * 0.24, 0, 7); nc.fill();
        };
        gear(58, 66, 42, 14, '#E2C27A'); gear(200, 198, 48, 16, '#D9B86A'); gear(208, 58, 28, 10, '#C9CED6'); gear(44, 210, 26, 9, '#C9CED6');
        // улитка: ступенчатый кулачок-спираль на оси
        const ux = 118, uy = 136, st = 12;
        nc.fillStyle = '#B9C1CD'; nc.strokeStyle = '#7E8696'; nc.lineWidth = 3; nc.lineJoin = 'round';
        nc.beginPath(); nc.moveTo(ux, uy);
        for (let i = 0; i < st; i++) { const a0 = -PI / 2 + i / st * PI * 2, a1 = -PI / 2 + (i + 1) / st * PI * 2, r = 24 + i * 3.4; nc.lineTo(ux + Math.cos(a0) * r, uy + Math.sin(a0) * r); nc.arc(ux, uy, r, a0, a1); }
        nc.closePath(); nc.fill(); nc.stroke();
        nc.fillStyle = '#7E8696'; nc.beginPath(); nc.arc(ux, uy, 6, 0, 7); nc.fill();
        nc.restore();
        const lm = basic('#FFFFFF', { map: R.tex(ncv), transparent: true, depthWrite: false, fog: false });
        const disc = R.plane(lens, lm, 0, 0, 0, 0.5, 0.5); disc.renderOrder = 6;
        const ring = put(lens, R.keep(new T.TorusGeometry(0.25, 0.022, 8, 40)), M.brass, [0, 0, 0.005]); ring.castShadow = false; ring.renderOrder = 6;
        put(lens, GEO.box, M.ink, [0.24, -0.24, 0], [0.04, 0.22, 0.03], [0, 0, 0.78]).castShadow = false; }
      lens.traverse(m => { if (m.isMesh) m.raycast = () => {}; });

      /* ---------- верстак у задней стены, окно на холмы над ним ---------- */
      const BX = 0.9, BZ = -3.28, BT = 0.86;
      { const bf = grp(F, BX, 0, BZ), bs = grp(S, BX, 0, BZ);
        rbox(bf, M.wood, 0, BT - 0.04, 0, 1.86, 0.08, 0.62, 0.025);
        rbox(bf, M.wood, -0.62, (BT - 0.08) / 2, 0, 0.5, BT - 0.08, 0.56, 0.03);
        [-0.8, 0.84].forEach(x => box(bf, M.wood, x, (BT - 0.08) / 2, 0, 0.07, BT - 0.08, 0.5));
        box(bs, M.wood, 0.4, 0.14, -0.2, 1.1, 0.05, 0.05);
        [0.2, 0.47, 0.74].forEach(y => { box(bs, M.woodD, -0.62, y, 0.285, 0.42, 0.18, 0.02); sphS(bs, M.brass, -0.62, y, 0.3, 0.018); });
        // лампа-лупа: основание, локоть, кольцо и светлое стекло
        const lx = 0.58, lz = -0.12;
        cyl(bs, M.ink, lx, BT + 0.02, lz, 0.07, 0.04);
        cyl(bs, M.ink, lx, BT + 0.24, lz, 0.012, 0.44, [0, 0, -0.08]);
        cyl(bs, M.ink, lx - 0.13, BT + 0.47, lz + 0.05, 0.012, 0.34, [0.25, 0, 1.15]);
        put(bs, R.keep(new T.TorusGeometry(0.09, 0.016, 6, 24)), M.ink, [lx - 0.27, BT + 0.5, lz + 0.12], null, [1.2, 0, 0]);
        put(bs, GEO.cyl, M.lamp, [lx - 0.27, BT + 0.5, lz + 0.12], [0.085, 0.012, 0.085], [1.2 - PI / 2, 0, 0]);
        // моток тонкой проволоки, крошечные тиски, пинцет
        const sx = -0.62, sz = -0.06;
        cyl(bs, M.steel, sx, BT + 0.06, sz, 0.05, 0.08, [PI / 2, 0, 0]);
        [-1, 1].forEach(k => cyl(bs, M.brass, sx, BT + 0.06, sz + k * 0.045, 0.07, 0.01, [PI / 2, 0, 0]));
        box(bs, M.ink, 0.15, BT + 0.025, -0.1, 0.12, 0.05, 0.08); box(bs, M.ink, 0.15, BT + 0.075, -0.1, 0.16, 0.04, 0.07);
        put(bs, GEO.cone, M.ink, [0.26, BT + 0.075, -0.1], [0.025, 0.08, 0.025], [0, 0, -PI / 2]);
        box(bs, M.steel, -0.15, BT + 0.006, 0.12, 0.16, 0.008, 0.012, [0, 0.4, 0]); }
      prox('spot:bench', BX, 0.5, BZ + 0.03, 1.9, 1.05, 0.7);
      // бархатный коврик для волоска и сама проволока (перестраивается по стадиям)
      const COIL = { x: -0.32, z: 0.1 };
      box(S, M.velvet, BX + COIL.x, BT + 0.005, BZ + COIL.z, 0.26, 0.012, 0.2);
      const coilHit = hit(g, BX + COIL.x, BT + 0.05, BZ + COIL.z, 0.3, 0.12, 0.26); coilHit.userData.tap = 'coil'; coilHit.userData.key = 'spot:bench';
      const coilMesh = new T.Mesh(new T.BufferGeometry(), M.steel);
      coilMesh.position.set(BX + COIL.x, BT + 0.02, BZ + COIL.z); coilMesh.userData.tap = 'coil'; coilMesh.userData.key = 'spot:bench'; g.add(coilMesh);
      let coilGeo = null, coilStage = -1;
      const setCoil = s => {
        s = Math.max(0, Math.min(3, s | 0)); if (s === coilStage) return; coilStage = s;
        const pts = [];
        if (s === 0) for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new T.Vector3((t - 0.5) * 0.2, 0.004, Math.sin(t * PI * 2) * 0.02)); }
        else {
          const turns = [0, 0.9, 1.7, 2.6][s], rMax = [0, 0.07, 0.06, 0.055][s], N = 48;
          for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * PI * 2, r = rMax * (1 - t * 0.82); pts.push(new T.Vector3(Math.cos(a) * r - 0.01, 0.004, Math.sin(a) * r)); }
          pts.unshift(new T.Vector3(rMax + 0.05, 0.004, -0.02));
          if (s === 3) { for (let i = 0; i <= 18; i++) { const t = i / 18, a = PI + t * PI * 1.6, r = 0.03 * (1 - t * 0.7); pts.unshift(new T.Vector3(rMax + 0.08 + Math.cos(a) * r, 0.004, -0.05 + Math.sin(a) * r)); } }
        }
        const ng = new T.TubeGeometry(new T.CatmullRomCurve3(pts), s ? 90 : 30, s === 3 ? 0.0055 : 0.0045, 6);
        coilMesh.geometry = ng; if (coilGeo) coilGeo.dispose(); coilGeo = ng;
      };
      setCoil(0);
      // окно над верстаком: холмы и облака (без надписей)
      { const wg = grp(S, BX, 2.02, -D + 0.02);
        put(wg, R.frameGeo(0.96, 0.78, 0.07, false), M.trim, [0, 0, 0]);
        aplane(wg, [512, 0, 512, 416], [0, 0, 0.03], [0.96, 0.78, 1]);
        box(wg, M.trim, 0, 0, 0.07, 0.035, 0.78, 0.03); box(wg, M.trim, 0, 0.06, 0.07, 0.96, 0.03, 0.03);
        rbox(wg, M.wall, 0, -0.5, 0.1, 1.2, 0.07, 0.2, 0.03); }
      prox('spot:window', BX, 2.02, -D + 0.1, 1.12, 0.94, 0.12);

      /* ---------- табличка у входа на мольберте ---------- */
      const SGX = 0.42, SGZ = -0.56;
      { const sg = grp(F, SGX, 0, SGZ, -0.18);
        [-1, 1].forEach(k => cyl(sg, M.woodD, k * 0.16, 0.42, 0.02, 0.016, 0.88, [0.12, 0, k * 0.14]));
        cyl(sg, M.woodD, 0, 0.42, -0.14, 0.014, 0.86, [-0.32, 0, 0]);
        box(sg, M.woodD, 0, 0.42, 0.06, 0.42, 0.03, 0.05);
        const card = grp(sg, 0, 0.62, 0.075); card.rotation.x = -0.12;
        rbox(card, M.wood, 0, 0, -0.012, 0.5, 0.39, 0.02, 0.01);
        aplane(card, [512, 416, 512, 384], [0, 0, 0.002], [0.46, 0.345, 1]); }
      prox('spot:sign', SGX, 0.55, SGZ, 0.6, 1.1, 0.4, -0.18);

      /* ---------- столик у правой стены: карманные часы на бархатном подносе ---------- */
      const TX = 1.95, TZ = -1.25, TT = 0.84;
      { const tf = grp(F, TX, 0, TZ), ts = grp(S, TX, 0, TZ);
        rbox(tf, M.woodD, 0, TT / 2, 0, 0.66, TT, 0.78, 0.035);
        rbox(tf, M.wood, 0, TT + 0.02, 0, 0.72, 0.04, 0.84, 0.02);
        box(ts, M.wood, -0.334, 0.45, 0, 0.01, 0.5, 0.6);
        sphS(ts, M.brass, -0.34, 0.6, 0, 0.022);
        rbox(ts, M.velvet, -0.12, TT + 0.055, 0, 0.36, 0.03, 0.3, 0.012);
        // карманные часы лежат циферблатом вверх, крышка откинута, цепочка петлёй
        const pw = grp(ts, -0.12, TT + 0.075, 0.0, 0.5);
        cyl(pw, M.brass, 0, 0, 0, 0.065, 0.016);
        const dl = dialAt(pw, 0, 0.0085, 0, 0.11); dl.rotation.x = -PI / 2;
        cyl(pw, M.brass, 0, 0.004, -0.07, 0.06, 0.006, [-0.5, 0, 0]);
        cyl(pw, M.brass, 0.075, 0, 0, 0.012, 0.012, [0, 0, PI / 2]); put(pw, R.ringG(0.016, 0.004), M.brass, [0.095, 0, 0], null, [PI / 2, 0, 0]);
        // баночка с винтиками и заводная пружина
        cyl(ts, M.glass, 0.18, TT + 0.08, -0.2, 0.05, 0.08); cyl(ts, M.brass, 0.18, TT + 0.125, -0.2, 0.052, 0.012);
        put(ts, R.ringG(0.05, 0.012), M.steel, [0.16, TT + 0.05, 0.18], null, [PI / 2, 0, 0]); }
      prox('spot:spoon', TX - 0.1, TT / 2 + 0.1, TZ, 0.75, TT + 0.25, 0.85);

      /* ---------- табурет (для кота), полка с часами, чертежи, инструменты ---------- */
      const SX = 1.92, SZ = -2.08, SH = 0.5;
      cyl(F, M.wood, SX, SH, SZ, 0.19, 0.06); cyl(S, M.velvet, SX, SH + 0.045, SZ, 0.17, 0.03);
      [0, 1, 2].forEach(i => { const a = i / 3 * PI * 2 + 0.4; cyl(F, M.woodD, SX + Math.cos(a) * 0.12, SH / 2, SZ + Math.sin(a) * 0.12, 0.018, SH, [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]); });
      { const sx = W / 2 - 0.13, sy = 1.72;
        box(S, M.wood, sx, sy, -1.25, 0.24, 0.04, 0.9);
        [-0.3, 0.3].forEach(dz => box(S, M.woodD, sx + 0.06, sy - 0.08, -1.25 + dz, 0.12, 0.14, 0.03));
        // настенные часы стоят на полке, рядом будильник и стопка карманных часов
        { const wc = grp(S, sx - 0.03, sy + 0.12, -1.55, -PI / 2);
          cyl(wc, M.wood, 0, 0, 0, 0.1, 0.03, [PI / 2, 0, 0]); dialAt(wc, 0, 0, 0.016, 0.17); }
        { const al = grp(S, sx - 0.02, sy + 0.02, -1.22, -PI / 2);
          cyl(al, M.velvet, 0, 0.075, 0, 0.055, 0.04, [PI / 2, 0, 0]); dialAt(al, 0, 0.075, 0.021, 0.09);
          [-1, 1].forEach(k => { put(al, GEO.hemi, M.brass, [k * 0.035, 0.125, 0], [0.026, 0.024, 0.026], [0, 0, -k * 0.5]); sphS(al, M.brass, k * 0.03, 0.02, 0, 0.012); }); }
        [0, 1].forEach(i => cyl(S, M.brass, sx - 0.02, sy + 0.03 + i * 0.018, -0.95, 0.045, 0.014)); }
      [-2.3, -3.02].forEach((z, i) => {
        const fg = grp(S, -W / 2 + 0.02, 1.85, z, PI / 2);
        rbox(fg, M.woodD, 0, 0, 0.015, 0.5, 0.45, 0.03, 0.012);
        aplane(fg, [512 + i * 256, 800, 256, 224], [0, 0, 0.032], [0.42, 0.37, 1]);
      });
      { const tg = grp(S, -W / 2 + 0.02, 1.25, -1.72, PI / 2);
        rbox(tg, M.wood, 0, 0, 0.012, 0.62, 0.36, 0.025, 0.01);
        [-0.2, -0.07, 0.06, 0.19].forEach((x, i) => { box(tg, M.ink, x, -0.02, 0.035, 0.018, 0.2 - i * 0.02, 0.012); box(tg, M.steel, x, 0.1 - i * 0.01, 0.035, 0.03, 0.05, 0.014); }); }   // отвёртки часовщика
      // этажерка у задней стены: часы на ребре, будильники, песочные часы, шкатулка, карманные часы
      { const ex = -1.58, ez = -D + 0.18, ew = 1.36, eh = 2.36;
        const ef = grp(F, ex, 0, ez), es = grp(S, ex, 0, ez);
        [-1, 1].forEach(k => rbox(ef, M.woodD, k * ew / 2, eh / 2, 0, 0.06, eh, 0.34, 0.02));
        box(es, M.woodD, 0, eh / 2, -0.16, ew, eh, 0.02);
        const SY = [0.12, 0.66, 1.2, 1.74, 2.3];
        SY.forEach(y => rbox(ef, M.wood, 0, y, 0, ew + 0.04, 0.05, 0.36, 0.015));
        put(es, GEO.halfDisc, M.woodD, [0, eh - 0.02, 0.02], [ew / 2, 0.03, 0.14], [PI / 2, 0, 0]);
        // полка 1: круглые часы стоят на ребре, чуть откинуты назад
        [-0.42, 0.02, 0.44].forEach((x, i) => {
          const r = 0.15 - i * 0.02, q = grp(es, x, SY[1] + 0.025 + r, -0.04); q.rotation.x = -0.15;
          cyl(q, i === 1 ? M.wood : M.brass, 0, 0, 0, r, 0.04, [PI / 2, 0, 0]); dialAt(q, 0, 0, 0.021, r * 1.7);
        });
        // полка 2: будильники на ножках и песочные часы
        [[-0.44, 0.6], [0.1, 0.75], [0.46, 0.55]].forEach(([x, k]) => {
          const q = grp(es, x, SY[2] + 0.025, 0.02); const y = 0.13 * k;
          cyl(q, M.velvet, 0, y, 0, 0.1 * k, 0.07 * k, [PI / 2, 0, 0]); dialAt(q, 0, y, 0.036 * k, 0.16 * k);
          [-1, 1].forEach(sd => { put(q, GEO.hemi, M.brass, [sd * 0.065 * k, y + 0.095 * k, 0], [0.045 * k, 0.042 * k, 0.045 * k], [0, 0, -sd * 0.5]); sphS(q, M.brass, sd * 0.06 * k, 0.018 * k, 0, 0.018 * k); });
        });
        { const q = grp(es, -0.17, SY[2] + 0.025, 0);
          cyl(q, M.woodD, 0, 0.008, 0, 0.055, 0.016); cyl(q, M.woodD, 0, 0.21, 0, 0.055, 0.016);
          put(q, GEO.cone, M.sand, [0, 0.06, 0], [0.042, 0.09, 0.042]); put(q, GEO.cone, M.sand, [0, 0.155, 0], [0.042, 0.09, 0.042], [PI, 0, 0]);
          [0, 1, 2].forEach(i => { const a = i / 3 * PI * 2; cyl(q, M.woodD, Math.cos(a) * 0.048, 0.11, Math.sin(a) * 0.048, 0.006, 0.2); }); }
        // полка 3: шкатулка с винтиками и стопка карманных часов
        rbox(es, M.velvet, -0.3, SY[3] + 0.08, 0, 0.3, 0.12, 0.2, 0.02); rbox(es, M.brass, -0.3, SY[3] + 0.155, 0, 0.32, 0.03, 0.22, 0.01);
        [0, 1, 2].forEach(i => cyl(es, M.brass, 0.25 + (i % 2) * 0.012, SY[3] + 0.04 + i * 0.022, 0, 0.055, 0.018));
        // нижняя полка: две корзинки с деталями
        [-0.3, 0.3].forEach(x => { rbox(es, M.wood, x, SY[0] + 0.12, 0, 0.36, 0.2, 0.26, 0.03); cyl(es, M.steel, x, SY[0] + 0.22, 0, 0.1, 0.03); }); }
      // бра по сторонам окна
      const SCX = [BX - 0.82, BX + 0.82];
      SCX.forEach(x => { const q = grp(S, x, 2.2, -D + 0.01); box(q, M.brass, 0, 0, 0.03, 0.07, 0.14, 0.05); cyl(q, M.brass, 0, 0.03, 0.14, 0.012, 0.2, [PI / 2, 0, 0]);
        put(q, GEO.cylLo, M.lamp, [0, -0.04, 0.24], [0.06, 0.14, 0.06]); put(q, GEO.cone, M.brass, [0, 0.08, 0.24], [0.09, 0.07, 0.09]); });
      SCX.forEach(x => R.halo(g, x, 2.16, -D + 0.3, 0.95, '#FFD9A8', 0.42));
      // мягкий свет лампы над верстаком
      const lampHalo = R.halo(g, BX + 0.31, BT + 0.47, BZ + 0.16, 0.9, '#FFE2B0', 0.55);
      // пылинки в луче лампы (одни Points)
      const DN = 4, dpos = new Float32Array(DN * 3), dph = [];
      for (let i = 0; i < DN; i++) { dpos.set([BX + 0.2 + Math.random() * 0.25, BT + 0.15 + Math.random() * 0.3, BZ + 0.1 + Math.random() * 0.2], i * 3); dph.push(Math.random() * 6); }
      const dgeo = R.keep(new T.BufferGeometry()); dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
      const dust = new T.Points(dgeo, R.keep(new T.PointsMaterial({ map: R.haloTex, color: 0xFFF0D0, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
      dust.frustumCulled = false; g.add(dust);

      R.bake(F, null, { cast: true });
      R.bake(S, null, { cast: false });
      [F, S].forEach(q => q.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));

      const blockers = [
        { x0: CX - 0.36, x1: CX + 0.36, z0: CZ - 0.36, z1: CZ + 0.36 },     // витрина
        { x0: BX - 0.95, x1: BX + 0.95, z0: -D, z1: BZ + 0.32 },             // верстак
        { x0: TX - 0.36, x1: W / 2, z0: TZ - 0.42, z1: TZ + 0.42 },          // столик с подносом
        { x0: SX - 0.2, x1: SX + 0.2, z0: SZ - 0.2, z1: SZ + 0.2 },          // табурет
        { x0: SGX - 0.14, x1: SGX + 0.14, z0: SGZ - 0.12, z1: SGZ + 0.06 },  // мольберт
        { x0: -W / 2, x1: -0.86, z0: -D, z1: -D + 0.36 },                     // этажерка
      ];
      const glintPath = [new T.Vector3(CX - 0.28, TOP + 0.12, CZ + 0.24), new T.Vector3(CX, TOP + 0.4, CZ + 0.2), new T.Vector3(CX + 0.28, TOP + 0.12, CZ + 0.24)];
      return {
        W, D,
        bounds: { x0: -2.05, x1: 2.05, z0: -3.3, z1: -0.25 },
        exit: { x: -1.85, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -0.5, z: -0.9 },
        cam: { x0: -0.6, x1: 0.35, z: -1.25 },
        blockers,
        catSpot: { x: SX, z: SZ, ry: 0.05 },
        spots: [
          { id: 'jug', x: -0.45, z: -1.95, act: 'Рассмотреть', bubble: 'часы под колпаком' },
          { id: 'bench', x: 0.45, z: -2.55, act: 'Посмотреть', bubble: 'верстак' },
          { id: 'window', x: 1.5, z: -2.62, act: 'Выглянуть', bubble: 'окно' },
          { id: 'sign', x: 0.98, z: -0.38, act: 'Прочитать', bubble: 'табличка у входа' },
          { id: 'spoon', x: 0.96, z: -1.42, act: 'Рассмотреть', bubble: 'часы на бархате' },
        ],
        npcs: {},
        // для содержимого места
        setCoil, coilStage: () => coilStage,
        lens: on => { lens.visible = !!on; },
        views: {
          dome: { pos: [CX + 0.2, 1.58, 0.05], look: [CX + 0.05, 1.27, -1.28] },
          bench: { pos: [BX + 0.72, 2.1, -2.32], look: [BX + COIL.x + 0.02, BT + 0.02, BZ + COIL.z] },
        },
        tick(t, dt, ctx) {
          // блик по колпаку
          const k = (t % 4) / 4;
          if (k < 0.32) { const q = k / 0.32, a = glintPath[0], b = glintPath[1], c = glintPath[2], u = 1 - q;
            glint.position.set(u * u * a.x + 2 * u * q * b.x + q * q * c.x, u * u * a.y + 2 * u * q * b.y + q * q * c.y, u * u * a.z + 2 * u * q * b.z + q * q * c.z);
            glint.material.opacity = Math.sin(q * PI) * 0.9; glint.material.rotation = q * 1.4; }
          else glint.material.opacity = 0;
          lampHalo.material.opacity = 0.52 + Math.sin(t * 1.9) * 0.03;
          for (let i = 0; i < DN; i++) { let y = dpos[i * 3 + 1] + dt * 0.03; if (y > BT + 0.55) y = BT + 0.12; dpos[i * 3 + 1] = y; dpos[i * 3] += Math.sin(t * 0.8 + dph[i]) * dt * 0.02; }
          dgeo.attributes.position.needsUpdate = true;
          // кот на табурете: подсаживаем его на сиденье
          const c = ctx && ctx.cat;
          if (c && c.root.visible) { const d = Math.hypot(c.root.position.x - SX, c.root.position.z - SZ); if (d < 0.45) c.root.position.y = (SH + 0.06) * Math.min(1, (0.45 - d) / 0.25); }
        },
      };
    },
  });

  /* ---------------------------- содержимое ---------------------------- */
  // тихий звон колокольчика над дверью (через звук места — Town его приглушит при выходе)
  function chime(ctx) {
    try {
      const gn = ctx.audio(); if (!gn) { ctx.sfx('blip'); return; }
      const a = gn.context, t0 = a.currentTime + 0.05;
      [1318.5, 1975.5, 2637].forEach((f, i) => {
        const o = a.createOscillator(), v = a.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, t0 + i * 0.09);
        v.gain.setValueAtTime(0, t0 + i * 0.09); v.gain.linearRampToValueAtTime(0.035 / (i + 1), t0 + i * 0.09 + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 1.2);
        o.connect(v).connect(gn); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 1.3);
      });
    } catch (e) { /* без звука */ }
  }
  // полоска мини-занятия внизу 3D-комнаты (класс .room-puzzle из общих стилей)
  const roomRoot = () => document.querySelector('#stage .screen:not(.out) .city3d.room3d');
  function strip(text, chips) {
    const root = roomRoot();
    const el = document.createElement('div'); el.className = 'room-puzzle i4-strip';
    el.innerHTML = `<div class="i4-task">${G.esc(text)}</div><div class="i4-row"></div>`;
    chips.forEach(c => { const b = document.createElement('button'); b.className = 'chip room-back'; b.textContent = c.label; b.addEventListener('click', e => { e.stopPropagation(); G.haptic('light'); c.fn(); }); el.querySelector('.i4-row').appendChild(b); });
    if (root) root.appendChild(el);
    return el;
  }
  Town.style('i4-strip', `.i4-strip .i4-task{font-weight:800;font-size:14px;text-align:center;line-height:1.3}
.i4-strip .i4-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.i4-strip .room-back{min-height:40px;font-size:14px;padding:8px 14px}
.i4-coil{display:flex;flex-direction:column;align-items:center;gap:6px}
.i4-coil svg{width:min(70vw,260px);height:auto;cursor:pointer;touch-action:manipulation}
.i4-coil p{margin:0;font-weight:800;font-size:14px;color:var(--ink-2)}`);

  // спираль для 2D: три тапа — три стадии
  function spiralSVG(s) {
    const pts = [];
    if (!s) for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([20 + t * 160, 100 + Math.sin(t * Math.PI * 2) * 22]); }
    else {
      const turns = [0, 0.9, 1.7, 2.6][s], rMax = [0, 70, 62, 56][s], N = 80;
      pts.push([100 + rMax + 40, 84]);
      for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * Math.PI * 2, r = rMax * (1 - t * 0.82); pts.push([100 + Math.cos(a) * r, 100 + Math.sin(a) * r]); }
    }
    const d = 'M' + pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' L');
    return `<svg viewBox="0 0 200 200" role="img" aria-label="проволока"><rect x="8" y="8" width="184" height="184" rx="26" fill="#9E2F47" opacity=".16"/><path d="${d}" fill="none" stroke="#AEB4C0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#EEF1F5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`;
  }
  async function curlDone(ctx) {
    await ctx.say({ text: 'Получилось! Такая спиралька в часах зовётся «волосок». Это она задаёт ритм тиканью.', s: 'v_curl' });
    ctx.flag('curl', 1);
  }
  // мини «Волосок»: 3D — тапы по проволоке на верстаке; 2D — три тапа по спирали
  async function benchMini(ctx) {
    if (ctx.flag('curl')) { await ctx.play('На верстаке твой волосок. Маленький, но свёрнут своими руками.'); return true; }
    await ctx.play('Тонкая проволока и пинцет. Три движения — и получится спиралька, как в настоящих часах.');
    const room = ctx.is3d ? ctx.api.room : null;
    if (!room || !room.setCoil) {
      let stage = 0;
      const r = await ctx.sheet({
        title: 'Волосок', body: `<div class="i4-coil">${spiralSVG(0)}<p>Волосок: три тапа по проволоке</p></div>`,
        onMount(el, close) {
          const box = el.querySelector('.i4-coil');
          box.addEventListener('click', () => {
            if (stage >= 3) return;
            stage++; G.haptic('select'); G.sfx('tap');
            box.querySelector('svg').outerHTML = spiralSVG(stage);
            if (stage >= 3) { box.querySelector('p').textContent = 'Готово!'; setTimeout(() => close('done'), 650); }
          });
        },
      });
      if (r === 'done') await curlDone(ctx);
      return true;
    }
    let stage = 0, done = false, quit = false, el = null;
    const rr = roomRoot();
    room.setCoil(0);
    const v = room.views.bench;
    try {
      ctx.focus(v.pos, v.look); ctx.api.focusMode(true);
      el = strip('Волосок: три тапа по проволоке', [{ label: '↩ отойти', fn: () => { quit = true; } }]);
      ctx.api.intercept(h => {
        if (done || quit) return true;
        if (h && h.name === 'coil') {
          stage++; room.setCoil(stage); G.haptic('select'); G.sfx('tap');
          if (stage >= 3) done = true;
        }
        return true;   // пока смотрим на верстак, тапы не уводят героиню
      });
      ctx.mark('intercept');
      while (!done && !quit) await ctx.wait(80);
      if (done) { if (el) el.querySelector('.i4-task').textContent = 'Готово!'; ctx.sparkle('star'); await ctx.wait(500); await curlDone(ctx); }
      else room.setCoil(0);
    } finally {
      if (el) el.remove();
      if (rr) rr.classList.remove('focus-on');
      if (!ctx.gone) { ctx.api.intercept(null); ctx.api.focusMode(false); ctx.release(); }
    }
    return true;
  }
  // часы под колпаком: взгляд → лупа (улитка в механизме) → факт; на новом визите круг начинается с другого места
  async function jugUse(ctx) {
    const k = ctx.n('jug') - 1, i = (k + (ctx.visits || 0)) % 3;
    if (i === 0) { await ctx.play('Старинные часы под стеклянным колпаком. Тикают так тихо, будто извиняются.'); return true; }
    if (i === 2) { await ctx.say({ f: 'filig' }); return true; }
    const room = ctx.is3d ? ctx.api.room : null;
    const line = { text: 'Под лупой — механизм. Одна деталь закручена, как раковина. Её так и зовут: улитка. Она подсказывает часам, сколько раз пробить.', s: 'v_snl' };
    if (!room || !room.lens) { await ctx.say(line); return true; }
    const t0 = Date.now(), rr = roomRoot();
    try {
      room.lens(true); ctx.focus(room.views.dome.pos, room.views.dome.look); ctx.api.focusMode(true);
      await ctx.wait(1100);
      await ctx.say(line);
      const rest = 4000 - (Date.now() - t0); if (rest > 0) await ctx.wait(rest);
    } finally {
      if (rr) rr.classList.remove('focus-on');
      if (!ctx.gone) { room.lens(false); ctx.api.focusMode(false); ctx.release(); }
    }
    return true;
  }

  Town.place({
    id: P, kind: 'existing', storySafe: true,   // проверено: без спойлеров серии 1 — можно заходить во время дела
    name: 'Часовая мастерская', short: 'Часовщик',
    sign: 'ЧАСЫ', motto: 'часы · верстак · тишина',
    icon: '🕰', color: '#E9E1D6',
    street: { x: 11.9, w: 1.93, doorDx: 0.57, bkey: null },
    room: P, opens: 0,
    host: null,
    greet: {
      first: 'Мастер куда-то вышел. В мастерской тихо, только часы тикают. Вразнобой.',
      again: Town.v('Тихо. Часы под колпаком делают вид, что не заметили тебя.', 'Под колпаком всё те же часы. Очень стараются не выглядеть музейным экспонатом.', 'Лампа горит. На верстаке идеальный порядок. Даже неловко.'),
      regular: Town.v('Витрина узнала вас. Часы тикнули чуть громче.', 'Блик пробежал по колпаку — точно по расписанию.', 'Всё на своих местах: часы, верстак, тишина.'),
      away: 'Часы всё так же идут. У них стабильная карьера.',
    },
    bark: 'Тихо звякнул колокольчик над дверью.',
    weekly: { 1: 'На табличке у входа новая надпись.', 2: 'На табличке у входа новая надпись.', 3: 'На табличке у входа новая надпись.', 4: 'На табличке у входа новая надпись.', 5: 'На табличке у входа новая надпись.', 6: 'На табличке у входа новая надпись.' },
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      bouquet: 'С букетом мастерская выглядит наряднее. Часы одобрительно тикают.',
      cup: 'Какао — подальше от витрины. Механизмы не любят брызг.',
    },
    reactFirst: ctx => (Array.isArray(ctx.st.finds) && ctx.st.finds.includes('watch13') && !ctx.has('v_watch')
      ? { text: 'Часы в кармане звякнули возле витрины. Кажется, встретили своих.', s: 'v_watch' } : null),
    spots: {
      jug: { icon: '🕰', label: 'Часы под колпаком', secret: 'v_snl',
        lines: ['Старинные часы под стеклянным колпаком. Тикают так тихо, будто извиняются.', { f: 'filig' }], onUse: jugUse },
      bench: { icon: '🔧', label: 'Верстак', secret: 'v_curl', lines: [], onUse: benchMini },
      window: { icon: '🪟', label: 'Окно',
        lines: ['За окном холмы и облака. Хочется просто смотреть.', 'Вот бы всем рабочим местам такой вид.'] },
      sign: { icon: '🪧', label: 'Табличка у входа',
        lines: [ctx => `На табличке у входа: „${SIGNS[Math.max(0, Math.min(6, ctx.week))]}“`] },
      spoon: { icon: '⏱', label: 'Карманные часы на бархате',
        lines: [{ f: 'silvr' }, 'Карманные часы на бархате. Крышка открыта, стрелки на 10:10. Позируют.'] },
    },
    npc: {},
    enter: async ctx => {
      const room = ctx.is3d ? ctx.api.room : null;
      if (room && room.setCoil) room.setCoil(ctx.flag('curl') ? 3 : 0);
      chime(ctx);
    },
    facts: {
      filig: { text: 'Стрелки идут «по часовой», потому что так ползёт тень на солнечных часах в северном полушарии. Пока солнца нет, солнечные часы взяли отгул.', wk: 0 },
      silvr: { text: 'На витринах часы почти всегда показывают 10:10: стрелки не закрывают надпись на циферблате и похожи на улыбку.', wk: 0 },
    },
    secrets: [
      { id: 'v_curl', title: 'Свой волосок', trigger: 'верстак: три тапа по проволоке' },
      { id: 'v_snl', title: 'Улитка в механизме', trigger: 'часы под колпаком: взгляд через лупу' },
      { id: 'v_watch', title: 'Часы к часам', trigger: 'вход с часами watch13 в кармане' },
    ],
    stamp: { title: 'Часовщик', icon: '🕰' },
  });
})();
