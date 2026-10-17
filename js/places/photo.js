/* =====================================================================
   Место прогулки: photo — Фотостудия «Светопись» (новая комната 6.4×4.8, opens 1).
   Кремовые стены, лавандовые панели, серо-голубые доски. Бумажный задник
   с плавным загибом к полу (сменная канва: звёзды / осенний парк /
   кинозал / снегопад с 5-й недели), крестик из скотча, деревянная камера
   на треноге, два софтбокса, верёвочка со снимками, сундук с реквизитом,
   «Проявочная» с красной табличкой, полка со старинной камерой.
   Черепаха Минутка стоит на ящике у камеры.
   Мини «Снимок следователя»: лист выбора (фон, реквизит, кот) → к крестику,
   «не шевелитесь…», 3-2-1, вспышка → фотокарточка (town.ph).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'photo';
  const PI = Math.PI;

  const BD = [
    { n: 'Звёзды', line: 'Звёзды. Ни одна не опоздала.', css: 'radial-gradient(circle at 18% 22%, #FFD98A 0 2px, transparent 3px), radial-gradient(circle at 72% 14%, #FFD98A 0 2.5px, transparent 3.5px), radial-gradient(circle at 84% 46%, #FFE9B8 0 2px, transparent 3px), radial-gradient(circle at 30% 58%, #FFE9B8 0 1.5px, transparent 2.5px), radial-gradient(circle at 58% 34%, #FFD98A 0 1.5px, transparent 2.5px), radial-gradient(circle at 12% 80%, #FFD98A 0 2px, transparent 3px), radial-gradient(circle at 90% 84%, #FFE9B8 0 1.5px, transparent 2.5px), linear-gradient(180deg, #252B4A, #3A4270)' },
    { n: 'Осенний парк', line: 'Осенний парк. Листья не падают — нарисованы.', css: 'radial-gradient(ellipse 9px 5px at 20% 24%, #F7B267 98%, transparent), radial-gradient(ellipse 8px 5px at 76% 18%, #C2405B 98%, transparent), radial-gradient(ellipse 9px 5px at 62% 52%, #9FD6BE 98%, transparent), radial-gradient(ellipse 8px 5px at 14% 66%, #C2405B 98%, transparent), radial-gradient(ellipse 9px 5px at 86% 74%, #F7B267 98%, transparent), radial-gradient(ellipse 7px 4px at 40% 86%, #9FD6BE 98%, transparent), linear-gradient(180deg, #FFF4E4, #F6E2C6)' },
    { n: 'Кинозал', line: 'Кинозал. Енот одобрил бы.', css: 'linear-gradient(180deg, rgba(232,199,112,.9) 0 7%, transparent 7%), repeating-linear-gradient(90deg, #B9364F 0 16px, #A12E45 16px 24px, #93283E 24px 30px, #A12E45 30px 36px)' },
    { n: 'Снегопад', line: 'Снегопад. Нарисованный — не тает.', wk: 5, css: 'radial-gradient(circle at 20% 20%, #fff 0 2.5px, transparent 3.5px), radial-gradient(circle at 70% 12%, #fff 0 2px, transparent 3px), radial-gradient(circle at 46% 40%, #fff 0 3px, transparent 4px), radial-gradient(circle at 86% 50%, #fff 0 2px, transparent 3px), radial-gradient(circle at 12% 62%, #fff 0 2px, transparent 3px), radial-gradient(circle at 60% 78%, #fff 0 2.5px, transparent 3.5px), radial-gradient(circle at 30% 88%, #fff 0 2px, transparent 3px), linear-gradient(180deg, #CFDDF0, #E8F0FA)' },
  ];
  const PROPS = [
    { e: '🔍', n: 'Лупа' }, { e: '🎀', n: 'Бант на палочке' }, { e: '10/10', n: 'Табличка «10/10»', sign: true },
    { e: '🌞', n: 'Картонное солнце' }, { e: '⭐', n: 'Звёздочка из фольги', when: st => Array.isArray(st.finds) && st.finds.includes('paperStar') }, { e: '', n: 'Без реквизита' },
  ];
  const bdAvail = w => BD.map((b, i) => i).filter(i => !BD[i].wk || w >= BD[i].wk);
  const wkNow = () => { try { return Math.max(0, Math.min(6, Town.week())); } catch (e) { return 0; } };

  // канва задника 384×512 (пропорции бумаги 2.6 × 3.45 м)
  function paintBackdrop(c, i) {
    const W = 384, H = 512, q = (() => { let s = 7 + i * 13; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    if (i === 0) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#252B4A'); g.addColorStop(0.75, '#3A4270'); g.addColorStop(1, '#4A5286'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let k = 0; k < 70; k++) { c.fillStyle = k % 3 ? '#FFD98A' : '#FFF1C8'; c.globalAlpha = 0.5 + q() * 0.5; c.beginPath(); c.arc(q() * W, q() * H * 0.85, 1 + q() * 2.4, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = '#FFD98A';
      for (let k = 0; k < 7; k++) { const x = 20 + q() * (W - 40), y = 20 + q() * H * 0.7, r = 7 + q() * 6; c.beginPath(); for (let j = 0; j < 8; j++) { const a = j / 8 * PI * 2, rr = j % 2 ? r * 0.35 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
    } else if (i === 1) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FFF4E4'); g.addColorStop(1, '#F3DDBE'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(201,138,92,.18)'; [[60, 120, 70], [300, 90, 80], [190, 200, 60]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
      const cols = ['#F7B267', '#C2405B', '#9FD6BE', '#E8955A'];
      for (let k = 0; k < 40; k++) { const x = q() * W, y = q() * H, s = 9 + q() * 8, a = q() * 6; c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = cols[k % 4]; c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.8, 0, 0, s); c.quadraticCurveTo(-s * 0.8, 0, 0, -s); c.fill(); c.restore(); }
    } else if (i === 2) {
      for (let x = 0; x < W; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#93283E'); g.addColorStop(0.45, '#C2405B'); g.addColorStop(1, '#93283E'); c.fillStyle = g; c.fillRect(x, 0, 32, H); }
      c.fillStyle = '#E8C770'; c.fillRect(0, 0, W, 34); c.fillStyle = '#B9364F'; for (let x = 0; x < W; x += 32) { c.beginPath(); c.arc(x + 16, 34, 16, 0, PI); c.fill(); }
      c.fillStyle = 'rgba(255,233,184,.25)'; c.beginPath(); c.ellipse(W / 2, H * 0.62, 150, 110, 0, 0, 7); c.fill();
    } else {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#CFDDF0'); g.addColorStop(1, '#EEF4FB'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFFFFF';
      for (let k = 0; k < 70; k++) { c.globalAlpha = 0.6 + q() * 0.4; c.beginPath(); c.arc(q() * W, q() * H, 1.5 + q() * 3, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.2; c.lineCap = 'round';
      for (let k = 0; k < 8; k++) { const x = 20 + q() * (W - 40), y = 20 + q() * (H - 60), r = 8 + q() * 6; for (let j = 0; j < 6; j++) { const a = j / 6 * PI * 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); } }
    }
  }

  /* ---------- Комната ---------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#EEEAF4', gnd: '#B9B4C4', hi: 0.7, sun: '#FFF0E0', si: 0.46, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #4E4468 0%, #2C2638 72%)', rim: ['#E8E0FF', 0.2], fog: '#2C2638' },
    cam: { portrait: { dx: 0, y: 3.9, dz: 5.6, ly: 0.75, lz: -2.3, fov: 52 }, landscape: { dx: 0.2, y: 3.7, dz: 6.2, ly: 1.2, lz: -2.0, fov: 46 } },
    build(R) {
      const { T, group: g, put, box, cyl, rbox, plane, toon, GEO } = R;
      const W = 6.4, D = 4.8, H = 3.2;
      const glow = (c, e, i) => toon(c, { emissive: new T.Color(e), emissiveIntensity: i });
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const M = {
        cream: toon('#FFF8F0'), lav: toon('#D9CCF4'), lavD: toon('#B9A8E0'), ink: toon('#3A2E3F'), wood: toon('#B98C6A'), woodD: toon('#8E6248'),
        gold: glow('#E8C770', '#B8903A', 0.16), cherry: toon('#C2405B'), pink: toon('#F08FA8'), plum: toon('#6E5A7E'), mint: toon('#BFE6D3'),
        soft: glow('#FFFDF9', '#FFF4DE', 0.55), glass: glow('#CFE0F0', '#CFE0F0', 0.2),
      };
      const hitM = basic('#FFFFFF', { visible: false });
      const fx = new T.Group(); g.add(fx);
      const st = new T.Group(); g.add(st);
      const grp = (par, x, y, z, ry) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; par.add(q); return q; };
      const hit = (key, x, y, z, w, h, d) => { const m = put(g, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; m.userData.key = key; return m; };

      /* --- атлас: доски, снимки, табличка «10/10», солнце, вывеска, «ВЫХОД» --- */
      // атлас мелочей 512×256: рисуем в логических координатах (x 1024…2048, y 0…512) с масштабом 0.5; пол — своя канва 512×384
      const [acv, ac0] = R.cnv(512, 256), [fcv, fc] = R.cnv(512, 384);
      ac0.setTransform(0.5, 0, 0, 0.5, -512, 0); fc.setTransform(0.5, 0, 0, 0.5, 0, 0);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 }), floorM = toon('#FFFFFF', { map: R.tex(fcv) });
      let ac = fc;   // сначала — пол
      const aplane = (par, [sx, sy, sw, sh], p, s, r, mat) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = (sx - 1024) / 1024, u1 = (sx + sw - 1024) / 1024, v0 = 1 - (sy + sh) / 512, v1 = 1 - sy / 512;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, mat || atlasM, p, s, r); m.castShadow = false; return m;
      };
      { // серо-голубые доски
        const q = R.rng(5), tones = ['#B9C0C9', '#C3CAD3', '#AFB7C2', '#BDC4CE', '#C8CED6'];
        ac.fillStyle = '#9AA2AE'; ac.fillRect(0, 0, 1024, 768);
        const rows = 14, rh = 768 / rows;
        for (let r = 0; r < rows; r++) {
          let x = -q() * 200;
          while (x < 1024) { const L = 180 + q() * 160; ac.fillStyle = tones[Math.floor(q() * tones.length)]; R.rrect(ac, x + 2, r * rh + 2, L - 4, rh - 4, 5); ac.fill();
            ac.fillStyle = 'rgba(80,90,110,.25)'; ac.beginPath(); ac.arc(x + 12, r * rh + rh / 2, 2.5, 0, 7); ac.arc(x + L - 12, r * rh + rh / 2, 2.5, 0, 7); ac.fill(); x += L; }
        }
      }
      ac = ac0;   // дальше — атлас
      // снимки на верёвочке: пчела, енот с платочком, Пудра и гусёнок, пустая рамка, голубь
      const PR = [0, 1, 2, 3, 4].map(i => [1024 + i * 168, 0, 160, 200]);
      PR.forEach(([x, y], i) => {
        ac.fillStyle = '#FFFFFF'; ac.fillRect(x, y, 160, 200);
        const bgc = ['#FFF1C8', '#E2E6F2', '#FBE1E7', '#F4F0EA', '#DCEBF5'][i]; ac.fillStyle = bgc; ac.fillRect(x + 10, y + 10, 140, 140);
        const cx = x + 80, cy = y + 84;
        if (i === 0) { // пчела, смазанная
          ac.globalAlpha = 0.35; for (let k = 0; k < 3; k++) { ac.fillStyle = '#F5C542'; ac.beginPath(); ac.ellipse(cx - 18 + k * 12, cy, 26, 18, 0, 0, 7); ac.fill(); }
          ac.globalAlpha = 1; ac.fillStyle = '#F5C542'; ac.beginPath(); ac.ellipse(cx + 8, cy, 26, 18, 0, 0, 7); ac.fill();
          ac.fillStyle = '#3A2E3F'; [-6, 8, 22].forEach(dx => ac.fillRect(cx + dx, cy - 17, 5, 34)); ac.fillStyle = 'rgba(255,255,255,.8)'; ac.beginPath(); ac.ellipse(cx + 4, cy - 22, 12, 8, -0.5, 0, 7); ac.fill();
        } else if (i === 1) { // енот с платочком
          ac.fillStyle = '#9AA1AB'; ac.beginPath(); ac.arc(cx, cy + 6, 34, 0, 7); ac.fill(); ac.beginPath(); ac.moveTo(cx - 30, cy - 14); ac.lineTo(cx - 22, cy - 40); ac.lineTo(cx - 10, cy - 24); ac.fill(); ac.beginPath(); ac.moveTo(cx + 30, cy - 14); ac.lineTo(cx + 22, cy - 40); ac.lineTo(cx + 10, cy - 24); ac.fill();
          ac.fillStyle = '#454B55'; ac.beginPath(); ac.ellipse(cx, cy, 30, 11, 0, 0, 7); ac.fill(); ac.fillStyle = '#fff'; [-12, 12].forEach(dx => { ac.beginPath(); ac.arc(cx + dx, cy, 5, 0, 7); ac.fill(); });
          ac.fillStyle = '#7FB3E0'; [-12, 12].forEach(dx => { ac.beginPath(); ac.ellipse(cx + dx, cy + 12, 3, 6, 0, 0, 7); ac.fill(); });
          ac.fillStyle = '#F7C9D3'; ac.beginPath(); ac.moveTo(cx + 20, cy + 26); ac.lineTo(cx + 52, cy + 18); ac.lineTo(cx + 42, cy + 46); ac.closePath(); ac.fill();
        } else if (i === 2) { // Пудра и гусёнок
          ac.fillStyle = '#F2C9A0'; ac.beginPath(); ac.ellipse(cx - 18, cy + 18, 30, 22, 0, 0, 7); ac.fill(); ac.beginPath(); ac.arc(cx - 34, cy - 6, 18, 0, 7); ac.fill(); ac.fillStyle = '#F8DCC0'; ac.beginPath(); ac.arc(cx - 34, cy - 22, 13, 0, 7); ac.fill();
          ac.fillStyle = '#F2A9BE'; ac.beginPath(); ac.ellipse(cx - 34, cy - 34, 8, 4, 0, 0, 7); ac.fill();
          ac.fillStyle = '#F7D65A'; ac.beginPath(); ac.arc(cx + 28, cy + 24, 15, 0, 7); ac.fill(); ac.beginPath(); ac.arc(cx + 30, cy + 2, 10, 0, 7); ac.fill(); ac.fillStyle = '#F0A040'; ac.beginPath(); ac.moveTo(cx + 38, cy + 2); ac.lineTo(cx + 48, cy + 5); ac.lineTo(cx + 38, cy + 8); ac.fill();
        } else if (i === 3) { // пустая рамка: «Солнце. Не проявилось»
          ac.strokeStyle = '#C9B8A6'; ac.setLineDash([8, 8]); ac.lineWidth = 3; ac.strokeRect(x + 26, y + 26, 108, 108); ac.setLineDash([]);
        } else { // голубь
          ac.fillStyle = '#9EA3B8'; ac.beginPath(); ac.ellipse(cx, cy + 14, 34, 24, 0, 0, 7); ac.fill(); ac.beginPath(); ac.arc(cx + 26, cy - 14, 14, 0, 7); ac.fill();
          ac.fillStyle = '#7FA38F'; ac.beginPath(); ac.ellipse(cx + 18, cy, 12, 9, 0, 0, 7); ac.fill(); ac.fillStyle = '#E6A15A'; ac.beginPath(); ac.moveTo(cx + 38, cy - 14); ac.lineTo(cx + 48, cy - 11); ac.lineTo(cx + 38, cy - 8); ac.fill();
        }
        R.text(ac, ['жу', 'енот', 'пудра', 'солнце?', 'голубь'][i], cx, y + 176, 30, '#8C7A88', { f: 'Caveat', w: 700 });
      });
      { const x = 1024, y = 220; ac.fillStyle = '#FFFDF9'; R.rrect(ac, x, y, 160, 110, 14); ac.fill(); ac.strokeStyle = '#C2405B'; ac.lineWidth = 6; R.rrect(ac, x + 8, y + 8, 144, 94, 10); ac.stroke(); R.text(ac, '10/10', x + 80, y + 58, 54, '#C2405B'); }
      { const x = 1200, y = 220, cx = x + 100, cy = y + 100; ac.fillStyle = '#F7B267';
        for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; ac.beginPath(); ac.moveTo(cx + Math.cos(a - 0.14) * 60, cy + Math.sin(a - 0.14) * 60); ac.lineTo(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96); ac.lineTo(cx + Math.cos(a + 0.14) * 60, cy + Math.sin(a + 0.14) * 60); ac.closePath(); ac.fill(); }
        ac.fillStyle = '#FFD45E'; ac.beginPath(); ac.arc(cx, cy, 64, 0, 7); ac.fill(); ac.strokeStyle = '#C98A5C'; ac.lineWidth = 3; ac.setLineDash([6, 6]); ac.beginPath(); ac.arc(cx, cy, 56, 0, 7); ac.stroke(); ac.setLineDash([]);
        ac.fillStyle = '#9E6B2E'; [-20, 20].forEach(dx => { ac.beginPath(); ac.arc(cx + dx, cy - 8, 6, 0, 7); ac.fill(); }); ac.strokeStyle = '#9E6B2E'; ac.lineWidth = 5; ac.lineCap = 'round'; ac.beginPath(); ac.arc(cx, cy + 4, 22, 0.3, PI - 0.3); ac.stroke(); }
      { const x = 1536, y = 220; ac.fillStyle = '#FFFDF9'; R.rrect(ac, x + 4, y + 4, 504, 120, 30); ac.fill(); ac.strokeStyle = '#B9A8E0'; ac.lineWidth = 6; R.rrect(ac, x + 14, y + 14, 484, 100, 24); ac.stroke();
        R.text(ac, 'СВЕТОПИСЬ', x + 256, y + 66, 56, '#3A2E3F', { f: 'Comfortaa', w: 700, max: 430 }); }
      { const x = 1536, y = 360; ac.fillStyle = '#2C2638'; R.rrect(ac, x, y, 320, 96, 18); ac.fill(); R.text(ac, 'ВЫХОД', x + 160, y + 50, 58, '#BFF0CE'); }

      /* --- пол, стены, панели --- */
      box(fx, M.woodD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
      { const fl = put(fx, GEO.plane, floorM, [0, 0.002, -D / 2], [W, D, 1], [-PI / 2, 0, 0]); fl.castShadow = false; }
      const [wcv, wc] = R.cnv(256, 256);
      wc.fillStyle = '#FFF4EC'; wc.fillRect(0, 0, 256, 256);
      wc.fillStyle = '#EFE6F6'; [[40, 40], [168, 40], [104, 120], [232, 120], [40, 200], [168, 200]].forEach(([x, y]) => { wc.beginPath(); wc.arc(x, y, 5, 0, 7); wc.fill(); });
      const wT = R.tex(wcv); wT.wrapS = wT.wrapT = T.RepeatWrapping; wT.repeat.set(1.4, 1.4);
      const wallM = toon('#FFFFFF', { map: wT });
      rbox(fx, wallM, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.05);
      [-1, 1].forEach(sd => {
        rbox(fx, wallM, sd * (W / 2 + 0.1), H / 2, -D / 2, D, H, 0.2, 0.05, [0, PI / 2, 0]);
        rbox(fx, M.cream, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);
        box(fx, M.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
        box(fx, M.lavD, sd * (W / 2 - 0.04), H - 0.08, -D / 2, 0.1, 0.16, D);
      });
      box(fx, M.lavD, 0, H - 0.08, -D + 0.04, W, 0.16, 0.1); box(fx, M.cream, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
      const wain = (x, z, len, ry) => {
        const q = grp(fx, x, 0, z, ry);
        rbox(q, M.lav, 0, 0.5, 0.04, len, 1.0, 0.08, 0.03);
        box(q, M.cream, 0, 1.02, 0.085, len, 0.04, 0.04); box(q, M.lavD, 0, 0.06, 0.09, len, 0.12, 0.03);
      };
      wain(0, -D, W, 0); wain(-W / 2, -3.12, 3.16, PI / 2); wain(W / 2, -1.45, 1.9, -PI / 2); wain(W / 2, -4.65, 0.3, -PI / 2);
      { const q = grp(fx, -W / 2, 0, -0.17, PI / 2); rbox(q, M.lav, 0, 0.5, 0.04, 0.3, 1.0, 0.08, 0.03); box(q, M.cream, 0, 1.02, 0.085, 0.3, 0.04, 0.04); }
      { const q = grp(fx, W / 2, 0, -2.96, -PI / 2); rbox(q, M.lav, 0, 0.5, 0.04, 0.82, 1.0, 0.08, 0.03); box(q, M.cream, 0, 1.02, 0.085, 0.82, 0.04, 0.04); }
      aplane(fx, [1536, 220, 512, 128], [-2.15, 2.62, -D + 0.04], [1.25, 0.31, 1]);

      /* --- дверь на улицу и «ВЫХОД» --- */
      { const dz = -0.95, dg = grp(fx, -W / 2 + 0.01, 0, dz, PI / 2);
        put(dg, R.extrude(R.archShape(1.18, 2.22), 0.06), M.lavD, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(1.0, 2.1), 0.05), M.plum, [0, 0, 0.06]);
        [-0.22, 0.22].forEach(x => box(dg, M.lav, x, 0.75, 0.115, 0.32, 0.7, 0.02));
        cyl(dg, M.glass, 0, 1.6, 0.12, 0.15, 0.03, [PI / 2, 0, 0]); put(dg, R.ringG(0.15, 0.025), M.gold, [0, 1.6, 0.13]);
        R.sph(dg, M.gold, 0.36, 1.0, 0.13, 0.045);
        aplane(dg, [1536, 360, 320, 96], [0, 2.52, 0.09], [0.7, 0.21, 1]);
        R.halo(g, -W / 2 + 0.25, 2.52, dz, 0.7, '#BFF0CE', 0.35);
        hit('exitDoor', -W / 2 + 0.06, 1.1, dz, 0.16, 2.2, 1.1);
      }

      /* --- задник: стойки, рулон, бумага с плавным загибом к полу --- */
      const [bcv, bc] = R.cnv(384, 512);
      const bdTex = R.tex(bcv); const bdM = toon('#FFFFFF', { map: bdTex });
      const setBackdrop = i => { paintBackdrop(bc, i); bdTex.needsUpdate = true; };
      setBackdrop(wkNow() >= 5 ? 3 : 0);
      { const bx = 0.3, zb = -D + 0.18, top = 2.82, r0 = 0.55, flat = 0.22, vert = top - r0, arc = PI / 2 * r0, L = vert + arc + flat;
        const ge = R.keep(new T.PlaneGeometry(2.6, 1, 1, 28)), pa = ge.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const s = (0.5 - pa.getY(i)) * L; let y, z;
          if (s <= vert) { y = top - s; z = zb; }
          else if (s <= vert + arc) { const a = (s - vert) / r0; y = r0 - Math.sin(a) * r0; z = zb + (1 - Math.cos(a)) * r0; }
          else { y = 0.004; z = zb + r0 + (s - vert - arc); }
          pa.setXYZ(i, pa.getX(i), y, z);
        }
        ge.computeVertexNormals(); ge.computeBoundingSphere();
        const paper = put(g, ge, bdM, [bx, 0, 0]); paper.castShadow = false; paper.receiveShadow = true; paper.raycast = () => {};
        cyl(fx, M.cream, bx, 2.9, zb, 0.08, 2.78, [0, 0, PI / 2]);
        [-1, 1].forEach(s => cyl(fx, M.ink, bx + s * 1.39, 2.9, zb, 0.085, 0.04, [0, 0, PI / 2]));
        [bx - 1.42, bx + 1.42].forEach(x => { cyl(st, M.ink, x, 1.47, zb, 0.022, 2.94); [0, 2.1, 4.2].forEach(a => cyl(st, M.ink, x + Math.cos(a) * 0.14, 0.12, zb + Math.sin(a) * 0.1, 0.014, 0.3, [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6])); });
        hit('spot:backdrop', bx, 1.5, zb + 0.08, 2.7, 3.0, 0.2);
      }
      // крестик из скотча на полу
      [0.785, -0.785].forEach(a => box(fx, M.cherry, 0.3, 0.008, -3.5, 0.38, 0.006, 0.05, [0, a, 0]));

      /* --- софтбоксы на стойках --- */
      [[-1.55, -3.6], [2.0, -3.7]].forEach(([x, z]) => {
        const sb = grp(st, x, 0, z, Math.atan2(0.3 - x, -1.6 - z) + PI);
        cyl(sb, M.ink, 0, 0.85, 0, 0.02, 1.7); [0, 2.1, 4.2].forEach(a => cyl(sb, M.ink, Math.cos(a) * 0.13, 0.12, Math.sin(a) * 0.13, 0.013, 0.3, [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]));
        const head = grp(sb, 0, 1.75, 0); head.rotation.x = 0.25;
        put(head, R.keep(new T.CylinderGeometry(0.2, 0.36, 0.26, 4, 1)), M.ink, [0, 0, 0.08], null, [-PI / 2, PI / 4, 0]);
        put(head, GEO.box, M.soft, [0, 0, -0.06], [0.5, 0.5, 0.02]);
        R.halo(g, x + (0.3 - x) * 0.08, 1.75, z - 0.05, 1.0, '#FFF6E6', 0.45);
      });

      /* --- камера на треноге (смотрит на задник) --- */
      { const cm = grp(st, 0.3, 0, -1.5);
        [0, 2.1, 4.2].forEach(a => cyl(cm, M.woodD, Math.cos(a + 0.5) * 0.16, 0.56, Math.sin(a + 0.5) * 0.16, 0.017, 1.15, [Math.sin(a + 0.5) * 0.28, 0, -Math.cos(a + 0.5) * 0.28]));
        cyl(cm, M.ink, 0, 1.13, 0, 0.07, 0.06);
        rbox(cm, M.wood, 0, 1.33, 0.02, 0.34, 0.3, 0.3, 0.03);
        put(cm, R.keep(new T.CylinderGeometry(0.09, 0.15, 0.22, 4, 1)), M.ink, [0, 1.33, -0.22], null, [PI / 2, PI / 4, 0]);
        cyl(cm, M.gold, 0, 1.33, -0.36, 0.07, 0.07, [PI / 2, 0, 0]); cyl(cm, M.glass, 0, 1.33, -0.4, 0.05, 0.012, [PI / 2, 0, 0]);
        [[-0.17, 1.47], [0.17, 1.47], [-0.17, 1.19], [0.17, 1.19]].forEach(([x, y]) => R.sph(cm, M.gold, x, y, -0.13, 0.018));
        rbox(cm, M.ink, 0, 1.38, 0.2, 0.4, 0.3, 0.16, 0.05);
        rbox(cm, M.ink, 0, 1.12, 0.27, 0.38, 0.32, 0.03, 0.015, [0.12, 0, 0]);
        hit('spot:camera', 0.3, 0.8, -1.5, 0.62, 1.7, 0.7);
      }
      // пуфик с альбомами у входа
      { const pf = grp(st, -2.72, 0, -1.78, 0.3);
        put(pf, R.keep(new T.CylinderGeometry(0.27, 0.25, 0.36, 18)), M.lav, [0, 0.18, 0]); put(pf, R.ringG(0.26, 0.03), M.lavD, [0, 0.36, 0], null, [PI / 2, 0, 0]);
        rbox(pf, M.cherry, 0.02, 0.39, 0, 0.26, 0.04, 0.2, 0.01, [0, 0.3, 0]); rbox(pf, M.mint, -0.01, 0.43, 0.01, 0.24, 0.04, 0.18, 0.01, [0, -0.2, 0]); rbox(pf, M.wood, 0.01, 0.47, 0, 0.22, 0.035, 0.17, 0.01, [0, 0.5, 0]); }
      // ящик, на котором стоит Минутка
      { const cr = grp(st, 1.2, 0, -1.6, 0.2); rbox(cr, M.wood, 0, 0.12, 0, 0.52, 0.24, 0.46, 0.03); [-0.13, 0.13].forEach(x => box(cr, M.woodD, x, 0.12, 0.232, 0.03, 0.2, 0.01)); }

      /* --- снимки на верёвочке (левая стена) --- */
      cyl(fx, M.woodD, -W / 2 + 0.07, 1.86, -2.85, 0.008, 1.8, [PI / 2, 0, 0]);
      [-2.0, -3.7].forEach(z => R.sph(fx, M.gold, -W / 2 + 0.05, 1.86, z, 0.025));
      const prints = PR.map((rr, i) => {
        const z = -2.15 - i * 0.35, pv = new T.Group(); pv.position.set(-W / 2 + 0.11, 1.86, z); pv.rotation.y = PI / 2 - 0.55; g.add(pv);
        const m = aplane(pv, rr, [0, -0.2, 0], [0.29, 0.36, 1]); m.raycast = () => {}; m.receiveShadow = false;
        box(fx, M.wood, -W / 2 + 0.1, 1.85, z, 0.03, 0.07, 0.025);
        return pv;
      });
      hit('spot:wall', -W / 2 + 0.12, 1.65, -2.85, 0.22, 0.65, 1.85);

      /* --- сундук с реквизитом: лупа, бант на палочке, «10/10», картонное солнце --- */
      { const ch = grp(st, 2.6, 0, -1.2, -0.35), cf = grp(fx, 2.6, 0, -1.2, -0.35);
        rbox(ch, M.wood, 0, 0.17, 0, 0.62, 0.34, 0.42, 0.03); box(ch, M.gold, 0, 0.3, 0.215, 0.64, 0.035, 0.01); box(ch, M.gold, 0, 0.18, 0.215, 0.07, 0.09, 0.012);
        rbox(ch, M.wood, 0, 0.44, -0.27, 0.62, 0.36, 0.06, 0.03, [-0.35, 0, 0]);
        put(cf, R.ringG(0.06, 0.012), M.gold, [-0.18, 0.6, 0.0], null, [0, 0.4, 0.3]); cyl(cf, M.woodD, -0.21, 0.45, 0, 0.012, 0.22, [0, 0, 0.3]);
        cyl(cf, M.woodD, -0.04, 0.5, 0.06, 0.008, 0.5, [0.1, 0, -0.1]); R.bowAt(cf, M.pink, M.cherry, -0.01, 0.8, 0.09, 1.2);
        cyl(cf, M.woodD, 0.1, 0.48, -0.02, 0.008, 0.46, [-0.1, 0, 0.15]); aplane(cf, [1024, 220, 160, 110], [0.07, 0.74, 0.0], [0.2, 0.14, 1], [0, 0, 0.15]);
        cyl(cf, M.woodD, 0.22, 0.52, 0.05, 0.008, 0.56, [0.05, 0, 0.2]); aplane(cf, [1200, 220, 200, 200], [0.17, 0.86, 0.06], [0.24, 0.24, 1], [0, 0, 0.2]);
        hit('spot:props', 2.6, 0.5, -1.2, 0.72, 1.0, 0.55);
      }

      /* --- «Проявочная»: дверь на правой стене и красная табличка --- */
      { const dg = grp(fx, W / 2 - 0.01, 0, -3.9, -PI / 2);
        rbox(dg, M.lavD, 0, 1.08, 0.03, 1.08, 2.16, 0.05, 0.03); rbox(dg, M.plum, 0, 1.04, 0.07, 0.92, 2.04, 0.05, 0.02);
        [0.55, 1.45].forEach(y => box(dg, M.lavD, 0, y, 0.1, 0.7, 0.55, 0.012)); R.sph(dg, M.gold, 0.34, 1.0, 0.12, 0.04);
        const [scv, sc] = R.cnv(512, 160); sc.fillStyle = '#5A1420'; R.rrect(sc, 2, 2, 508, 156, 26); sc.fill(); sc.strokeStyle = '#FF7A7A'; sc.lineWidth = 5; R.rrect(sc, 12, 12, 488, 136, 20); sc.stroke();
        R.text(sc, 'НЕ ВХОДИТЬ', 256, 56, 50, '#FF8A8A', { max: 440 }); R.text(sc, 'ПРОЯВЛЯЕТСЯ', 256, 112, 42, '#FFC2C2', { max: 440 });
        const sgn = grp(fx, W / 2 - 0.42, 2.42, -3.9); box(sgn, M.ink, 0.36, 0.13, 0, 0.1, 0.02, 0.02); box(sgn, M.ink, 0.36, -0.13, 0, 0.1, 0.02, 0.02);
        rbox(sgn, M.ink, 0, 0, -0.03, 0.74, 0.25, 0.05, 0.02);
        plane(sgn, basic('#FFFFFF', { map: R.tex(scv), fog: false }), 0, 0, 0.0, 0.7, 0.22);
        R.halo(g, W / 2 - 0.42, 2.42, -3.85, 0.9, '#FF6A6A', 0.38);
        hit('spot:darkroom', W / 2 - 0.08, 1.2, -3.9, 0.2, 2.4, 1.1);
      }

      /* --- полка со старинной камерой (правая стена) --- */
      { const sh = grp(fx, W / 2 - 0.02, 0, -2.2, -PI / 2);
        rbox(sh, M.cream, 0, 1.3, 0.15, 0.8, 0.04, 0.3, 0.015); [-0.3, 0.3].forEach(x => box(sh, M.gold, x, 1.22, 0.08, 0.03, 0.14, 0.14));
        rbox(sh, M.wood, 0.05, 1.45, 0.16, 0.24, 0.26, 0.2, 0.02);
        put(sh, R.keep(new T.CylinderGeometry(0.07, 0.11, 0.16, 4, 1)), M.cherry, [0.05, 1.45, 0.33], null, [PI / 2, PI / 4, 0]);
        cyl(sh, M.gold, 0.05, 1.45, 0.43, 0.05, 0.06, [PI / 2, 0, 0]); [[-0.07, 1.58], [0.17, 1.58], [-0.07, 1.32], [0.17, 1.32]].forEach(([x, y]) => R.sph(sh, M.gold, x, y, 0.26, 0.016));
        rbox(sh, M.gold, -0.27, 1.42, 0.08, 0.16, 0.2, 0.02, 0.01); aplane(sh, PR[4], [-0.27, 1.42, 0.095], [0.12, 0.15, 1]);
        rbox(sh, M.gold, 0.3, 1.4, 0.08, 0.14, 0.16, 0.02, 0.01); aplane(sh, PR[1], [0.3, 1.4, 0.095], [0.1, 0.125, 1]);
        hit('spot:oldcam', W / 2 - 0.2, 1.45, -2.2, 0.42, 0.5, 0.85);
      }

      /* --- Минутка на ящике у камеры --- */
      const turtle = (R.npc.turtle || R.npc.bunny)();
      turtle.root.position.set(1.2, 0.24, -1.6); turtle.root.rotation.y = -0.5; g.add(turtle.root);

      R.bake(fx, null, { cast: false });
      R.bake(st, null, {});
      [fx, st].forEach(q => q.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));

      const S = { cur: wkNow() >= 5 ? 3 : 0, flashT: -1 };
      S.setBackdrop = i => { S.cur = i; setBackdrop(i); };
      S.flash = () => { S.flashT = 0; };
      return {
        W, D,
        bounds: { x0: -2.95, x1: 2.95, z0: -4.35, z1: -0.4 },
        exit: { x: -W / 2 + 0.45, z: -0.95 }, exitDir: [-0.9, 0],
        spawn: { x: -W / 2 + 1.6, z: -1.7 },
        cam: { x0: -1.8, x1: 1.8, z: -1.0 },
        blockers: [
          { x0: 0.0, x1: 0.6, z0: -1.8, z1: -1.2 },        // камера на треноге
          { x0: 0.92, x1: 1.48, z0: -1.85, z1: -1.35 },    // ящик с Минуткой
          { x0: -1.8, x1: -1.3, z0: -3.85, z1: -3.35 },    // софтбокс слева
          { x0: 1.75, x1: 2.25, z0: -3.95, z1: -3.45 },    // софтбокс справа
          { x0: 2.32, x1: 2.95, z0: -1.45, z1: -0.95 },    // сундук
          { x0: -1.32, x1: -0.92, z0: -4.8, z1: -4.42 },   // стойки задника
          { x0: 1.52, x1: 1.92, z0: -4.8, z1: -4.42 },
          { x0: 2.9, x1: 3.2, z0: -2.55, z1: -1.85 },      // полка со старой камерой
          { x0: -3.05, x1: -2.42, z0: -2.08, z1: -1.48 },  // пуфик
        ],
        catSpot: { x: 0.9, z: -3.3, ry: -0.4 },
        spots: [
          { id: 'camera', x: 0.3, z: -0.85, act: 'Сняться', bubble: 'фотокамера' },
          { id: 'backdrop', x: -0.8, z: -3.9, act: 'Сменить', bubble: 'задник' },
          { id: 'wall', x: -2.5, z: -2.8, act: 'Смотреть', bubble: 'стена снимков' },
          { id: 'props', x: 2.0, z: -1.2, act: 'Смотреть', bubble: 'реквизит' },
          { id: 'darkroom', x: 2.6, z: -3.9, act: 'Постучать', bubble: 'проявочная' },
          { id: 'oldcam', x: 2.55, z: -2.4, act: 'Смотреть', bubble: 'старинная камера' },
        ],
        npcs: { turtle },
        i2: S,
        tick(t, dt) {
          prints.forEach((pv, i) => { pv.rotation.z = Math.sin(t * 1.1 + i * 1.3) * 0.06; });
          let e = 0.6 + Math.sin(t * 0.9) * 0.1;
          if (S.flashT >= 0) { S.flashT += dt; e = 2.6 * Math.max(0, 1 - S.flashT / 0.35) + e; if (S.flashT > 0.35) S.flashT = -1; }
          M.soft.emissiveIntensity = e;
        },
      };
    },
  });

  /* ---------- Содержимое ---------- */
  const room = ctx => (ctx.is3d && ctx.api.room) || null;
  const S2 = ctx => { const r = room(ctx); return (r && r.i2) || null; };
  const bdCycle = new WeakMap();

  Town.style(P, `
.ph-set { display: flex; flex-direction: column; gap: 4px; }
.ph-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 0 6px; }
.ph-chips .chip { font-size: 14px; min-height: 40px; padding: 8px 11px; display: inline-flex; align-items: center; gap: 6px; }
.ph-sw { width: 18px; height: 18px; border-radius: 6px; display: inline-block; box-shadow: inset 0 0 0 1.5px rgba(58,46,63,.15); }
.ph-card { background: #fff; width: min(300px, 80vw); margin: 6px auto 4px; padding: 12px 12px 10px; border-radius: 6px; box-shadow: 0 8px 22px rgba(58,46,63,.22); transform: rotate(-3.4deg); }
.ph-img { position: relative; aspect-ratio: 1; border-radius: 3px; overflow: hidden; }
.ph-img .ph-hero { position: absolute; left: 50%; bottom: -4%; width: 50%; transform: translateX(-50%); }
.ph-img .ph-hero svg, .ph-img .ph-cat svg { width: 100%; height: auto; display: block; }
.ph-img .ph-cat { position: absolute; left: 4%; bottom: 2%; width: 30%; }
.ph-img .ph-cat.ghost { opacity: .55; }
.ph-img .ph-cat.ghost.b { transform: translateX(14px); }
.ph-img .ph-prop { position: absolute; left: 66%; bottom: 30%; font-size: 30px; line-height: 1; transform: rotate(-8deg); filter: drop-shadow(0 2px 2px rgba(0,0,0,.2)); }
.ph-img .ph-prop.sign { font-size: 14px; font-weight: 900; color: #C2405B; background: #FFFDF9; border: 3px solid #C2405B; border-radius: 6px; padding: 3px 5px; font-family: var(--font); }
.ph-cap { font-family: var(--font-hand); font-size: 25px; font-weight: 700; text-align: center; color: #4A3A55; margin-top: 6px; line-height: 1.1; }
.ph-sub { font-size: 11.5px; font-weight: 800; color: #9A8EA0; text-align: center; letter-spacing: .03em; }
.ph-count { background: rgba(255,253,249,.18); }
.ph-count b { font-family: var(--font-title); font-weight: 700; font-size: 150px; color: #FFFDF9; text-shadow: 0 6px 0 rgba(58,46,63,.25), 0 0 40px rgba(255,240,206,.8); animation: phNum .9s ease both; }
@keyframes phNum { 0% { transform: scale(1.6); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 85% { opacity: 1; } 100% { transform: scale(.85); opacity: 0; } }
.ph-flash { background: #FFFFFF; animation: phFlash .14s ease-out both; }
@keyframes phFlash { from { opacity: 1; } to { opacity: .85; } }
`);

  const ddmm = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
  function cardHTML(ctx, o) {
    const lk = ctx.look, pr = PROPS[o.p], cat = (() => { try { return Art.cat({ noHat: !!ctx.flag('cb') }); } catch (e) { return ''; } })();
    let hero = ''; try { hero = Art.heroine({ look: lk.look, bow: lk.bow, coat: lk.coat, hair: lk.hair }); } catch (e) { hero = ''; }
    const prop = pr && pr.e ? `<div class="ph-prop${pr.sign ? ' sign' : ''}">${pr.e}</div>` : '';
    const cats = o.c ? `<div class="ph-cat ghost a">${cat}</div><div class="ph-cat ghost b">${cat}</div>` : '';
    return `<div class="ph-card"><div class="ph-img" style="background:${BD[o.b].css}">${cats}<div class="ph-hero">${hero}</div>${prop}</div>
      <div class="ph-cap">${G.esc(G.herName())} · ${ddmm()}</div><div class="ph-sub">Выдержка: одна Минутка.</div></div>`;
  }

  // лист выбора: фон, реквизит, кот в кадре
  async function setupSheet(ctx, o) {
    const w = ctx.week, st = ctx.st, catHere = ctx.catHere;
    const props = PROPS.map((x, i) => i).filter(i => !PROPS[i].when || PROPS[i].when(st));
    if (!props.includes(o.p)) o.p = 5;
    const body = document.createElement('div'); body.className = 'ph-set';
    const paint = () => {
      body.innerHTML = `<div class="opt-label">Фон</div><div class="ph-chips">${bdAvail(w).map(i => `<button class="chip${o.b === i ? ' on' : ''}" data-b="${i}"><span class="ph-sw" style="background:${BD[i].css}"></span>${BD[i].n}</button>`).join('')}</div>
        <div class="opt-label">Реквизит</div><div class="ph-chips">${props.map(i => `<button class="chip${o.p === i ? ' on' : ''}" data-p="${i}">${PROPS[i].sign ? '🪧' : PROPS[i].e} ${PROPS[i].n}</button>`).join('')}</div>
        ${catHere ? `<div class="ph-chips"><button class="chip${o.c ? ' on' : ''}" data-c>🐈 Кот в кадре</button></div>` : ''}`;
    };
    paint();
    return ctx.sheet({
      title: 'Снимок следователя', body,
      actions: [{ label: 'Снимаю!', value: 'go' }],
      onMount(el) {
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-b], [data-p], [data-c]'); if (!b || ctx.gone) return;
          e.stopPropagation();
          if (b.dataset.b !== undefined) o.b = +b.dataset.b; else if (b.dataset.p !== undefined) o.p = +b.dataset.p; else o.c = !o.c;
          try { ctx.haptic('select'); ctx.sfx('tap'); } catch (x) { return; }
          paint();
        });
      },
    });
  }

  async function portrait(ctx) {
    const w = ctx.week, S = S2(ctx);
    const o = { b: S ? S.cur : (w >= 5 ? 3 : 0), p: 5, c: !!ctx.catHere };
    if (!bdAvail(w).includes(o.b)) o.b = 0;
    for (;;) {
      ctx.mark('sheet');
      const go = await setupSheet(ctx, o);
      if (go !== 'go') return true;
      const catIn = o.c && ctx.catHere;
      if (S) S.setBackdrop(o.b);
      if (ctx.is3d) {
        if (ctx.api.isSitting) ctx.stand();
        await ctx.api.walkTo(0.3, -3.5);
        ctx.api.faceCamera();
        if (catIn) ctx.api.catTo(0.9, -3.4, { ry: -0.2 });
        ctx.focus([1.05, 1.6, -0.45], [0.3, 1.0, -3.6]);
      }
      try {
        await ctx.say({ who: 'turtle', text: 'Не двигайся… Да, знаю, тяжело. Ещё секундочку…' });
        ctx.mark('countdown');
        for (const n of ['3', '2', '1']) { const el = document.createElement('div'); el.className = 'ph-count'; el.innerHTML = `<b>${n}</b>`; ctx.sfx('tap'); await ctx.overlay(el, 1000); }
        if (S) S.flash();
        const fl = document.createElement('div'); fl.className = 'ph-flash'; await ctx.overlay(fl, 140);
        ctx.sfx('reveal'); ctx.haptic('rigid');
      } finally { if (!ctx.gone && ctx.is3d) { try { ctx.release(); ctx.api.catFree(); } catch (e) { /* ignore */ } } }
      ctx.flag('pb', (ctx.flag('pb') || 0) | (1 << o.b));
      const shot = { b: o.b, p: o.p, c: catIn ? 1 : 0 };
      ctx.mark('card');
      const v = await ctx.sheet({
        title: 'Фотокарточка', full: true, body: cardHTML(ctx, shot),
        actions: [{ label: 'В паспорт', value: 'keep' }, { label: 'Переснять', value: 'again', cls: 'soft' }],
      });
      const firstEver = !ctx.town.ph;
      if (v === 'keep') {
        ctx.town.ph = `b${shot.b}p${shot.p}c${shot.c}`;
        if (ctx.flag('dv') === undefined) ctx.flag('dv', w); else G.save();
        ctx.toast('Фото — в паспорте города');
      }
      if (shot.c && !ctx.has('p_ghost')) await ctx.say({ who: 'turtle', text: 'На снимке два кота. Пирожок клянётся, что оба — он и оба прекрасны.', s: 'p_ghost' });
      if (shot.c && shot.p === 3 && !ctx.has('p_sun')) await ctx.say({ who: 'turtle', text: 'Кот и картонное солнце. Для этого кадра я готова нарушить режим тишины.', s: 'p_sun' });
      if (((ctx.flag('pb') || 0) & 7) === 7 && !ctx.has('p_ser')) await ctx.say({ who: 'turtle', text: 'Три фона! Модель ты или следователь? Хотя кто сказал, что нельзя одновременно.', s: 'p_ser' });
      if (firstEver && !ctx.has('niep')) await ctx.say({ who: 'turtle', f: 'niep' });
      if (v !== 'again') return true;
    }
  }

  async function backdropUse(ctx) {
    const av = bdAvail(ctx.week), S = S2(ctx);
    let cur = S ? S.cur : bdCycle.has(ctx) ? bdCycle.get(ctx) : (ctx.week >= 5 ? 3 : 0);
    const k = av.indexOf(cur), nx = av[(k + 1) % av.length];
    bdCycle.set(ctx, nx);
    if (S) S.setBackdrop(nx);
    ctx.haptic('light');
    await ctx.play(BD[nx].line);
    return true;
  }

  async function darkroomUse(ctx) {
    const t = ctx.town;
    if (!t.ph || !ctx.has('photo')) return false;
    const dv = ctx.flag('dv'), stage = ctx.week - (typeof dv === 'number' ? dv : ctx.week);
    if (stage <= 0) await ctx.say({ who: 'turtle', text: 'Большой снимок ещё проявляется. Пока получилась одна лупа. Красивая, кстати.' });
    else if (stage === 1) await ctx.say({ who: 'turtle', text: 'Проступили причёска и фон. Проявляется… не спеша.' });
    else { await ctx.say({ who: 'turtle', text: 'Готово! Снимок в витрине. Теперь прохожие будут думать, что здесь снимается кино.' }); if (!ctx.flag('wp')) ctx.flag('wp', 1); }
    return true;
  }

  if (G.addSpeakers) G.addSpeakers({ turtle: { name: () => 'Минутка', art: () => G.emojiAvatar('🐢', '#BFE6D3') } });

  Town.place({
    id: P, kind: 'new', storySafe: true,   // проверено: без спойлеров серии 1 — можно заходить во время дела
    name: 'Фотостудия «Светопись»', short: 'Фотостудия',
    sign: 'СВЕТОПИСЬ', motto: 'фото · вспышка · без солнца',
    icon: '📷', color: '#D9CCF4',
    street: { x: -14.8, w: 3.4, doorDx: 0, bkey: null },
    room: P, opens: 1,
    host: { who: 'turtle', npc: 'turtle' },
    greet: {
      first: 'До-о-обро пожаловать. Я Минутка. Не волнуйся, тут никто никуда не спешит.',
      again: Town.v('Ты снова здесь? Отлично. Я как раз закончила настраивать камеру. Начала вчера.', '{name|Ой}… уже… здравствуйте.', 'О, вы… А я как раз… начала здороваться.'),
      regular: Town.v('Для своих — лучший свет. Я его специально берегла.', 'Софтбоксы уже тёплые. Включила их… с утра.', 'Для вас выдержка покороче. Почти минутка.'),
      away: 'О, ты вернулась! А я только что закончила моргать.',
    },
    bark: 'Снова… вы. Хорошо.',
    weekly: { 5: 'Новый задник: снегопад. Нарисованный — не тает.' },
    fresh: [5],
    react: {
      bouquet: 'С букетом? Отлично. Цветы хотя бы не будут моргать на каждом кадре.',
      cup: 'Какао в кадре — уютно. Только пар может смазаться.',
      popcorn: 'Хруста на снимке не видно. Можно.',
      beret: 'Кот в берете! Это надо снять. То есть сфотографировать.',
    },
    spots: {
      camera: { icon: '📷', label: 'Сфотографироваться', secrets: ['p_ghost', 'p_sun', 'p_ser'], onUse: portrait },
      backdrop: { icon: '🖼', label: 'Задник', onUse: backdropUse },
      wall: {
        icon: '🧷', label: 'Стена снимков',
        lines: [
          'Жу на снимке размазана: не умеет стоять на месте.',
          'На всех снимках енот плачет. Виновато, конечно, освещение.',
          'Пустая рамка: «Солнце». Даже фотографироваться не пришло.',
          { f: 'mona' },
        ],
      },
      props: {
        icon: '🎩', label: 'Сундук с реквизитом',
        lines: [
          'В сундуке лупа, бант и табличка «10/10». Актёрский состав не подвёл.',
          'Солнце из картона. Не греет, зато всегда в настроении.',
          'Реквизит остаётся в студии. Одного пропавшего солнца городу хватит.',
        ],
      },
      darkroom: {
        icon: '🚪', label: 'Проявочная', onUse: darkroomUse,
        lines: ['„Не входить — проявляется“. Изнутри слышно, как снимки становятся смелее.', { f: 'photo' }],
      },
      oldcam: {
        icon: '📦', label: 'Старинная камера',
        lines: [{ who: 'turtle', f: 'niep' }, 'Камера старше всех в студии — кроме Минутки. Наверное.'],
      },
    },
    npc: {
      turtle: [
        { who: 'turtle', text: 'Хорошие фотографии не любят спешки. Я тоже.' },
        { who: 'turtle', text: 'Попробуй не улыбаться специально. Лучшие кадры часто выходят случайно.' },
      ],
    },
    facts: {
      mona: { text: 'В 1911 году из Лувра украли „Мону Лизу“. Пока её искали, люди приходили смотреть на пустую стену.' },
      photo: { text: '„Фотография“ по-гречески — „светопись“: свет плюс письмо. Отсюда вывеска.' },
      niep: { text: 'Самый старый сохранившийся снимок с натуры — вид из окна Ньепса, 1820-е. Выдержка — много часов: я бы успела.' },
    },
    secrets: [
      { id: 'p_ghost', title: 'Два кота', trigger: 'снимок с котом в кадре' },
      { id: 'p_sun', title: 'Кот и солнце', trigger: 'снимок: картонное солнце и кот' },
      { id: 'p_ser', title: 'Фотосессия', trigger: 'снимки на трёх фонах (k.pb & 7)' },
    ],
    stamp: { title: 'Светопись', icon: '📷' },
  });
})();
