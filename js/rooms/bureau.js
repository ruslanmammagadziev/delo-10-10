/* =====================================================================
   3D-КОМНАТА: бюро переводов «Lost in Translation».
   Голубые обои и кремовые панели, стеллажи с пастельными книгами и
   лесенкой, арочное окно под вывеской, большая конторка с запиской вора,
   старый шкаф (створки открываются: openCabinet), глобус на подставке,
   коробка «Потеряно при переводе», попугай на жёрдочке, лиса с книгой.
   Статика склеена в два bake (мебель с тенью / декор без тени);
   у интерактивных групп — невидимые «ловушки тапа», чтобы мелочь легко нажималась.
   ===================================================================== */
(function () {
  if (!window.City3D || !City3D.registerRoom) return;
  City3D.registerRoom('bureau', {
    look: { sky: '#EEF2FA', gnd: '#B8A08A', hi: 0.62, sun: '#FFE6C8', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #3D4068 0%, #241F38 72%)', rim: ['#FFE0C8', 0.22], fog: '#2A2C40' },
    cam: { portrait: { dx: 0, y: 7.4, dz: 6.2, ly: 0.7, lz: -3.1, fov: 60 }, landscape: { dx: 0.2, y: 4.1, dz: 7.2, ly: 1.35, lz: -2.4, fov: 48 } },
    build(R) {
      const { T, PI, group: g, put, box, sphS, cyl, rbox, plane, toon, GEO } = R;
      const W = 9, D = 6.5, H = 4.2;
      const glow = (c, e, i, x) => toon(c, Object.assign({ emissive: new T.Color(e), emissiveIntensity: i }, x || {}));
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const texM = (cv, x) => toon('#FFFFFF', Object.assign({ map: R.tex(cv) }, x || {}));
      const addM = (map, c, op) => basic(c || '#FFFFFF', { map, transparent: true, opacity: op === undefined ? 1 : op, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const hitM = basic('#FFFFFF', { visible: false });
      const BOOK = ['#F08FA8', '#8FB3D9', '#F7B267', '#BFE6D3', '#B9A5E8', '#C2405B', '#FFE08A'].map(c => toon(c));
      // близкие цвета — общими материалами: после склейки каждый материал = один вызов отрисовки
      const M = {
        cream: toon('#FFF6E8'), navy: toon('#2F3A5A'), navyL: toon('#44568A'),
        gold: glow('#FFD45E', '#C9A040', 0.2), wood: toon('#B98C6A'), woodD: toon('#8E6248'), woodL: toon('#D6AC80'),
        leaf: toon('#7FB07A'), leafD: toon('#5E9A6A'),
        lamp: glow('#FFE9B8', '#FFC46B', 0.9, { side: T.DoubleSide }), card: toon('#DDBB90'),
      };
      BOOK.push(M.leaf);
      Object.assign(M, { creamD: BOOK[1], paper: M.cream, caseM: M.navyL, drape: M.navyL, drapeD: M.navy, ink: M.navy, rasp: BOOK[5], rose: BOOK[0], roseD: BOOK[0], mint: BOOK[3], pot: BOOK[2] });
      const st = new T.Group(); g.add(st);   // статика с тенью (мебель)
      const dc = new T.Group(); g.add(dc);   // статика без тени: стены, пол, книги, мелочи
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (par, x, y, z, w, h, d) => { const m = put(par, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; return m; };
      // фестоны без бусин (лёгкие по треугольникам)
      const scallop = (par, m, x0, x1, y, z, r, m2) => { const n = Math.max(2, Math.round((x1 - x0) / (1.9 * r))), s = (x1 - x0) / n; for (let i = 0; i < n; i++) put(par, GEO.halfDisc, m2 && i % 2 ? m2 : m, [x0 + s * (i + 0.5), y, z], [s / 2, 0.025, r], [PI / 2, 0, 0]); };
      const shadeG = R.keep(new T.CylinderGeometry(0.62, 1, 1, 18, 1, true)), shadeM = M.lamp;
      // бра (как R.sconce, но из материалов комнаты)
      const sconce = (par, x, y) => { box(par, M.navy, x, y, 0.03, 0.07, 0.14, 0.05); cyl(par, M.navy, x, y + 0.03, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
        put(par, GEO.cylLo, M.lamp, [x, y - 0.06, 0.26], [0.065, 0.15, 0.065]); put(par, GEO.cone, M.gold, [x, y + 0.07, 0.26], [0.1, 0.08, 0.1]); sphS(par, M.gold, x, y + 0.13, 0.26, 0.02); };
      // атлас: вывески, циферблат, карта, ковёр и коврик — одна текстура, один вызов
      const [acv, ac] = R.cnv(2048, 1024), AX = 1024;   // x < 1024 — паркет, дальше всё остальное
      const atlasM = toon('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 });
      const draw = (fn, x, y, k = 1) => { ac.save(); ac.translate(AX + x, y); ac.scale(k, k); fn(ac); ac.restore(); };
      const aplane = (par, [sx, sy, sw, sh], p, s, r, raw) => {
        if (!raw) sx += AX;
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / 2048, u1 = (sx + sw) / 2048, v0 = 1 - (sy + sh) / 1024, v1 = 1 - sy / 1024;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };

      /* ---------- пол: паркет, ковёр, коврик у двери ---------- */
      { const c = ac, q = R.rng(31);
        c.fillStyle = '#B48A64'; c.fillRect(0, 0, 1024, 1024);
        const tones = ['#DDB892', '#D6AE86', '#E2C09A', '#D9B28A', '#D1A77F'], rows = 34, rh = 1024 / rows;
        for (let r = 0; r < rows; r++) {
          let x = -q() * 180;
          while (x < 1024) {
            if (x + 120 > 1024) { c.fillStyle = tones[Math.floor(q() * tones.length)]; R.rrect(c, x + 2, r * rh + 1.5, 1024 - x - 4, rh - 3, 4); c.fill(); break; }
            const L = 110 + q() * 120; c.fillStyle = tones[Math.floor(q() * tones.length)]; R.rrect(c, x + 2, r * rh + 1.5, L - 4, rh - 3, 4); c.fill();
            c.strokeStyle = 'rgba(150,100,60,.13)'; c.lineWidth = 1.5;
            for (let k = 0; k < 2; k++) { const yy = r * rh + 7 + q() * (rh - 14); c.beginPath(); c.moveTo(x + 10, yy); c.bezierCurveTo(x + L * 0.35, yy + 3, x + L * 0.65, yy - 3, x + L - 10, yy); c.stroke(); }
            x += L;
          }
        }
        box(dc, M.woodD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
        aplane(dc, [2, 2, 1020, 1020], [0, 0.002, -D / 2], [W, D, 1], [-PI / 2, 0, 0], true).receiveShadow = true;
      }
      draw(c => {
        const el = (rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(512, 256, rx, ry, 0, 0, PI * 2); c.fill(); };
        c.strokeStyle = '#FFF3E0'; c.lineWidth = 6; c.lineCap = 'round';
        for (let i = 0; i < 96; i++) { const a = i / 96 * PI * 2; c.beginPath(); c.moveTo(512 + Math.cos(a) * 480, 256 + Math.sin(a) * 232); c.lineTo(512 + Math.cos(a) * 504, 256 + Math.sin(a) * 250); c.stroke(); }
        el(488, 236, '#FFF3E0'); el(466, 216, '#6C8BC2'); el(436, 190, '#FFF3E0'); el(426, 182, '#8FAFDD');
        for (let i = 0; i < 44; i++) { const a = i / 44 * PI * 2; c.fillStyle = i % 2 ? '#FFD45E' : '#FFF6E8'; c.beginPath(); c.arc(512 + Math.cos(a) * 451, 256 + Math.sin(a) * 203, 7, 0, 7); c.fill(); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, x = 512 + Math.cos(a) * 330, y = 256 + Math.sin(a) * 128;
          c.fillStyle = '#F4C7D0'; for (let k = 0; k < 5; k++) { const b = k / 5 * PI * 2; c.beginPath(); c.arc(x + Math.cos(b) * 11, y + Math.sin(b) * 11, 9, 0, 7); c.fill(); }
          c.fillStyle = '#FFE08A'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
        el(170, 80, '#6C8BC2'); el(150, 66, '#FFF3E0');
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; c.fillStyle = i % 2 ? '#F4C7D0' : '#BFE6D3'; c.beginPath(); c.ellipse(512 + Math.cos(a) * 82, 256 + Math.sin(a) * 34, 30, 15, a, 0, 7); c.fill(); }
        c.fillStyle = '#FFD45E'; c.beginPath(); c.ellipse(512, 256, 30, 16, 0, 0, 7); c.fill();
      }, 0, 512);
      aplane(dc, [0, 512, 1024, 512], [0, 0.008, -2.5], [4.6, 2.3, 1], [-PI / 2, 0, 0]);
      draw(c => {
        c.fillStyle = '#44568A'; R.rrect(c, 4, 4, 248, 376, 40); c.fill();
        c.strokeStyle = '#FFF3E0'; c.lineWidth = 10; R.rrect(c, 24, 24, 208, 336, 26); c.stroke();
        c.fillStyle = '#F4C7D0'; c.beginPath(); c.moveTo(128, 236); c.bezierCurveTo(70, 190, 86, 136, 128, 162); c.bezierCurveTo(170, 136, 186, 190, 128, 236); c.fill();
      }, 900, 262, 0.42);
      aplane(dc, [900, 262, 107.5, 161.3], [-4.02, 0.01, -1.6], [0.72, 1.08, 1], [-PI / 2, 0, 0]);

      /* ---------- стены: обои в полоску, кремовые панели, карниз ---------- */
      const [wcv, wc] = R.cnv(256, 256);
      wc.fillStyle = '#B2C8E6'; wc.fillRect(0, 0, 256, 256);
      wc.fillStyle = '#C1D4EE'; wc.fillRect(96, 0, 64, 256);
      wc.fillStyle = '#E2EAF6'; wc.fillRect(90, 0, 4, 256); wc.fillRect(162, 0, 4, 256);
      const wflower = (x, y) => { wc.fillStyle = '#EEF3FA'; for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; wc.beginPath(); wc.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5.5, 0, 7); wc.fill(); } wc.fillStyle = '#F2D488'; wc.beginPath(); wc.arc(x, y, 3.5, 0, 7); wc.fill(); };
      wflower(128, 64); wflower(128, 192);
      wc.fillStyle = '#C9D9EF'; [[44, 40], [44, 168], [212, 104], [212, 232]].forEach(([x, y]) => { wc.beginPath(); wc.arc(x, y, 4, 0, 7); wc.fill(); });
      const wT = R.tex(wcv); wT.wrapS = wT.wrapT = T.RepeatWrapping; wT.repeat.set(1.3, 1.3);
      const wallM = toon('#FFFFFF', { map: wT });
      rbox(dc, wallM, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.05);
      [-1, 1].forEach(sd => {
        rbox(dc, wallM, sd * (W / 2 + 0.1), H / 2, -D / 2, D, H, 0.2, 0.05, [0, PI / 2, 0]);
        rbox(dc, M.cream, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);                 // торец разреза
        box(dc, M.cream, sd * (W / 2 - 0.04), H - 0.08, -D / 2, 0.1, 0.16, D);                          // карниз
        box(dc, M.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
      });
      box(dc, M.cream, 0, H - 0.08, -D + 0.04, W, 0.16, 0.1); box(dc, M.cream, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
      const wain = (x, z, len, ry, insets = true) => {
        const q = grp(dc, x, 0, z, ry);
        rbox(q, M.cream, 0, 0.6, 0.04, len, 1.2, 0.08, 0.03);
        box(q, M.navy, 0, 1.22, 0.085, len, 0.06, 0.05); box(q, M.gold, 0, 1.18, 0.11, len, 0.016, 0.01);
        box(q, M.navy, 0, 0.07, 0.09, len, 0.14, 0.04);
        if (insets) { const n = Math.max(1, Math.round(len / 0.95)), s = len / n; for (let i = 0; i < n; i++) box(q, M.creamD, -len / 2 + s * (i + 0.5), 0.68, 0.085, s - 0.24, 0.68, 0.012); }
      };
      wain(0, -D, W, 0, false); [-0.75, 0, 0.75].forEach(x => box(dc, M.creamD, x, 0.68, -D + 0.085, 0.5, 0.68, 0.012));
      wain(-W / 2, -4.4, 4.2, PI / 2); wain(-W / 2, -0.48, 0.96, PI / 2);
      wain(W / 2, -D / 2, D, -PI / 2);

      /* ---------- задняя стена: арочное окно, шторы, вывеска ---------- */
      const [ocv, oc] = R.cnv(256, 384);
      { const gr = oc.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#4A5A92'); gr.addColorStop(0.55, '#7C8CC0'); gr.addColorStop(1, '#D9B6CB');
        oc.fillStyle = gr; oc.fillRect(0, 0, 256, 384);
        const q = R.rng(9); oc.fillStyle = '#FFF6E0';
        for (let i = 0; i < 28; i++) { oc.globalAlpha = 0.45 + q() * 0.55; oc.beginPath(); oc.arc(q() * 256, q() * 230, 1 + q() * 1.8, 0, 7); oc.fill(); }
        oc.globalAlpha = 1; oc.fillStyle = '#FFF1C8'; oc.beginPath(); oc.arc(178, 92, 22, 0, 7); oc.fill(); oc.fillStyle = gr; oc.beginPath(); oc.arc(189, 84, 20, 0, 7); oc.fill();
        oc.fillStyle = 'rgba(160,170,214,.55)'; [[60, 200, 34], [92, 192, 26], [40, 210, 22]].forEach(([x, y, r]) => { oc.beginPath(); oc.arc(x, y, r, 0, 7); oc.fill(); });
        oc.fillStyle = '#56609A';
        [[0, 300, 60], [52, 286, 54], [100, 312, 50], [146, 290, 62], [204, 304, 56]].forEach(([x, y, w]) => { oc.fillRect(x, y, w, 384 - y); oc.beginPath(); oc.moveTo(x - 4, y); oc.lineTo(x + w / 2, y - 26); oc.lineTo(x + w + 4, y); oc.fill(); });
        oc.fillStyle = '#FFE3A8'; [[18, 320], [70, 306], [84, 336], [118, 330], [160, 312], [178, 340], [222, 324]].forEach(([x, y]) => oc.fillRect(x, y, 9, 12));
      }
      const outM = (() => { const t = R.tex(ocv); t.repeat.set(1 / 1.3, 1 / 1.75); t.offset.set(0.5, 0.5); return basic('#FFFFFF', { map: t, fog: false }); })();
      const bw = grp(dc, 0, 0, -D + 0.01);
      R.windowF(bw, M.cream, outM, 0, 2.2, 1.3, 1.75, { arch: true, cross: true });
      [-1, 1].forEach(sd => {   // шторы-«песочные часы», подхваченные золотом
        put(bw, GEO.cone, M.drape, [sd * 0.86, 2.6, 0.17], [0.2, 1.42, 0.07], [PI, 0, 0]);
        put(bw, GEO.cone, M.drapeD, [sd * 0.92, 2.6, 0.14], [0.13, 1.42, 0.05], [PI, 0, 0]);
        put(bw, GEO.cone, M.drape, [sd * 0.86, 1.36, 0.17], [0.22, 1.06, 0.07]);
        put(bw, GEO.cone, M.drapeD, [sd * 0.93, 1.36, 0.14], [0.15, 1.06, 0.05]);
        sphS(bw, M.gold, sd * 0.86, 1.88, 0.2, 0.06, 0.05, 0.05);
      });
      rbox(bw, M.drape, 0, 3.36, 0.17, 2.2, 0.22, 0.14, 0.06);
      scallop(bw, M.drape, -1.06, 1.06, 3.26, 0.2, 0.09, M.drapeD);
      cyl(bw, M.gold, 0, 3.49, 0.17, 0.02, 2.4, [0, 0, PI / 2]); [-1.22, 1.22].forEach(x => sphS(bw, M.gold, x, 3.49, 0.17, 0.045));
      draw(c => {
        c.fillStyle = '#2F3A5A'; R.rrect(c, 0, 0, 768, 176, 34); c.fill();
        c.strokeStyle = '#FFD45E'; c.lineWidth = 6; R.rrect(c, 14, 14, 740, 148, 24); c.stroke();
        R.text(c, 'Бюро переводов', 384, 92, 74, '#FFF6E8', { f: 'Comfortaa', w: 700, max: 600 });
        [56, 712].forEach(x => { c.fillStyle = '#FFD45E'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 - PI / 2, r = i % 2 ? 7 : 18; c.lineTo(x + Math.cos(a) * r, 88 + Math.sin(a) * r); } c.fill(); });
      }, 0, 0);
      rbox(bw, M.gold, 0, 3.8, 0.04, 2.0, 0.5, 0.06, 0.05); aplane(bw, [0, 0, 768, 176], [0, 3.8, 0.074], [1.9, 0.436, 1]);
      [-1, 1].forEach(sd => { const sg = grp(dc, sd * 1.12, 0, -D + 0.01); sconce(sg, 0, 2.55); });
      R.halo(g, 0, 2.5, -D + 0.35, 2.7, '#FFC890', 0.3);   // один общий ореол на два бра и окно

      /* ---------- стеллажи с книгами ---------- */
      const shelfDeco = (par, x, y0, z, q) => {
        if (q() < 0.5) { cyl(par, M.pot, x, y0 + 0.045, z, 0.05, 0.09); sphS(par, M.leaf, x - 0.03, y0 + 0.13, z, 0.06, 0.05, 0.05); sphS(par, M.leafD, x + 0.035, y0 + 0.15, z + 0.01, 0.05, 0.06, 0.05); }
        else { const fr = grp(par, x, y0, z + 0.06); fr.rotation.x = -0.18; box(fr, M.gold, 0, 0.09, 0, 0.13, 0.17, 0.02); box(fr, BOOK[0], 0, 0.09, 0.011, 0.09, 0.12, 0.004); }
      };
      const fillShelf = (par, xa, xb, y0, hmax, zf, q, deco) => {
        let x = xa;
        while (x < xb - 0.05) {
          const r = q(), left = xb - x;
          if (deco && r < 0.06 && left > 0.24) { deco(par, x + 0.11, y0, zf - 0.16, q); x += 0.23; continue; }
          if (r < 0.13 && left > 0.32) {   // стопка лёжа
            let yy = y0; const n = 2 + Math.floor(q() * 2);
            for (let i = 0; i < n; i++) { const bh = 0.045 + q() * 0.03, bwd = 0.22 + q() * 0.06; box(par, BOOK[Math.floor(q() * BOOK.length)], x + 0.15 + (q() - 0.5) * 0.03, yy + bh / 2, zf - 0.14, bwd, bh, 0.24); yy += bh; }
            x += 0.31; continue;
          }
          const bwd = 0.045 + q() * 0.04, bh = Math.min(hmax, 0.27 + q() * 0.15), bd = 0.22 + q() * 0.07, mat = BOOK[Math.floor(q() * BOOK.length)];
          if (left < 0.17 && left > 0.1 && q() < 0.7) {   // последняя книжка завалилась на соседку
            const a = 0.32; box(par, mat, x + 0.005 + bwd / 2 * Math.cos(a) + bh / 2 * Math.sin(a), y0 + bwd / 2 * Math.sin(a) + bh / 2 * Math.cos(a), zf - bd / 2, bwd, bh, bd, [0, 0, a]);
            break;
          }
          box(par, mat, x + bwd / 2, y0 + bh / 2, zf - bd / 2, bwd, bh, bd);
          if (q() < 0.4) box(par, M.gold, x + bwd / 2, y0 + bh - 0.045, zf + 0.002, bwd * 0.92, 0.014, 0.004);
          x += bwd + (q() < 0.1 ? 0.025 : 0.003);
        }
      };
      const SH_Y = [0.74, 1.26, 1.78, 2.3, 2.82], SH_H = 3.3;
      const bookcase = (x0, x1, bays, seed) => {
        const q = R.rng(seed), w = x1 - x0, cx = (x0 + x1) / 2, dz = 0.44, zf = -D + 0.02 + dz, zc = zf - dz / 2;
        box(dc, M.navy, cx, SH_H / 2, -D + 0.05, w, SH_H, 0.06);
        for (let i = 0; i <= bays; i++) rbox(dc, M.caseM, x0 + i * w / bays, SH_H / 2, zc, 0.08, SH_H, dz, 0.03);
        rbox(dc, M.cream, cx, SH_H + 0.07, zc + 0.03, w + 0.2, 0.14, dz + 0.12, 0.05);
        scallop(dc, M.cream, x0 + 0.02, x1 - 0.02, SH_H, zf + 0.07, 0.075, M.gold);
        rbox(dc, M.caseM, cx, 0.37, zc + 0.01, w, 0.74, dz, 0.03);
        for (let b = 0; b < bays; b++) {
          const bx = x0 + (b + 0.5) * w / bays, bwid = w / bays;
          [-1, 1].forEach(s2 => { rbox(dc, M.cream, bx + s2 * bwid / 4, 0.4, zf + 0.012, bwid / 2 - 0.1, 0.5, 0.03, 0.03); sphS(dc, M.gold, bx + s2 * 0.05, 0.42, zf + 0.04, 0.022); });
          SH_Y.forEach((y, r) => fillShelf(dc, x0 + b * bwid + 0.06, x0 + (b + 1) * bwid - 0.05, y + 0.035, (r < 4 ? SH_Y[r + 1] : SH_H) - y - 0.08, zf - 0.03, q, shelfDeco));
        }
        SH_Y.forEach(y => box(dc, M.cream, cx, y + 0.0175, zc + 0.01, w - 0.04, 0.035, dz));
        return { cx, w, zc, zf };
      };
      const BL = bookcase(-4.32, -1.48, 2, 101); bookcase(1.48, 3.5, 2, 202);
      // латунная штанга и лесенка
      cyl(dc, M.gold, BL.cx, 3.14, -6.0, 0.018, BL.w, [0, 0, PI / 2]);
      { const lad = grp(dc, -1.98, 0, -5.7); lad.rotation.x = -0.1;
        [-1, 1].forEach(s2 => { cyl(lad, M.wood, s2 * 0.19, 1.6, 0, 0.026, 3.2); cyl(lad, M.gold, s2 * 0.19, 0.03, 0.02, 0.035, 0.03, [0, 0, PI / 2]); sphS(lad, M.gold, s2 * 0.19, 3.22, -0.02, 0.04); });
        for (let i = 1; i <= 8; i++) cyl(lad, M.wood, 0, i * 0.37, 0, 0.018, 0.38, [0, 0, PI / 2]); }
      // плющ на стеллаже
      { cyl(dc, M.pot, -3.95, SH_H + 0.22, -6.2, 0.11, 0.18); sphS(dc, M.leaf, -3.95, SH_H + 0.35, -6.2, 0.15, 0.1, 0.13);
        for (let i = 0; i < 9; i++) sphS(dc, i % 2 ? M.leaf : M.leafD, -3.86 + Math.sin(i * 1.3) * 0.05, SH_H + 0.12 - i * 0.13, -5.98 + (i < 2 ? -0.08 : 0), 0.05, 0.04, 0.03); }
      // книжка, которая сама выезжает (живая мелочь)
      const peek = new T.Group(); peek.position.set(-3.28, SH_Y[2] + 0.035, -6.17); g.add(peek);
      box(peek, BOOK[5], 0, 0.17, 0, 0.07, 0.34, 0.26);
      R.bake(peek, null, { cast: false });
      // ловушка тапа для левого стеллажа
      const sB = grp(g, 0, 0, 0, 0, 'spot:books'); hit(sB, BL.cx, 1.75, BL.zc + 0.05, BL.w + 0.1, 3.5, 0.6);

      /* ---------- напольные часы с маятником ---------- */
      const ck = grp(dc, 3.98, 0, -6.12);
      rbox(ck, M.woodD, 0, 0.19, 0, 0.6, 0.38, 0.44, 0.04);
      rbox(ck, M.wood, 0, 1.04, 0, 0.46, 1.34, 0.36, 0.04);
      box(ck, M.navy, 0, 1.06, 0.175, 0.28, 0.9, 0.02);
      [[0, 1.52, 0.33, 0.04], [0, 0.6, 0.33, 0.04]].forEach(([x, y, w, h]) => box(ck, M.gold, x, y, 0.19, w, h, 0.02)); [-0.15, 0.15].forEach(x => box(ck, M.gold, x, 1.06, 0.19, 0.03, 0.94, 0.02));
      rbox(ck, M.woodD, 0, 2.02, 0, 0.62, 0.66, 0.44, 0.05);
      put(ck, GEO.halfCyl, M.woodD, [0, 2.34, 0], [0.31, 0.44, 0.31], [0, PI / 2, PI / 2]);
      sphS(ck, M.gold, 0, 2.69, 0, 0.05); [-0.27, 0.27].forEach(x => sphS(ck, M.gold, x, 2.38, 0.18, 0.035));
      draw(c => {
        c.fillStyle = '#FFF6E8'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill(); c.strokeStyle = '#2F3A5A'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 112, 0, 7); c.stroke();
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.fillStyle = '#2F3A5A'; c.beginPath(); c.arc(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92, i % 3 ? 4 : 8, 0, 7); c.fill(); }
        c.strokeStyle = '#2F3A5A'; c.lineCap = 'round'; c.lineWidth = 9; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 - 44, 128 - 30); c.stroke();
        c.lineWidth = 6; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 52, 128 - 50); c.stroke(); c.fillStyle = '#E8B84A'; c.beginPath(); c.arc(128, 128, 10, 0, 7); c.fill();
      }, 772, 4, 248 / 256);
      aplane(ck, [772, 4, 248, 248], [0, 2.02, 0.225], [0.44, 0.44, 1]); put(ck, R.ringG(0.225, 0.02), M.gold, [0, 2.02, 0.225]);
      const pend = grp(g, 3.98, 1.5, -6.12 + 0.2);
      box(pend, M.gold, 0, -0.27, 0, 0.016, 0.54, 0.01); cyl(pend, M.gold, 0, -0.58, 0.005, 0.075, 0.02, [PI / 2, 0, 0]);
      R.bake(pend, null, { cast: false });

      /* ---------- конторка и всё, что на ней ---------- */
      const TOP = 0.95;
      { const dk = grp(st, 0, 0, -4.325);
        rbox(dk, M.wood, 0, 0.47, 0, 3.0, 0.82, 0.68, 0.05);
        rbox(dk, M.woodD, 0, 0.06, 0, 3.08, 0.12, 0.74, 0.04);
        rbox(dk, M.woodL, 0, 0.915, 0.02, 3.16, 0.07, 0.8, 0.03);
        const dp = grp(dc, 0, 0, -4.325);
        [-0.98, 0, 0.98].forEach(x => { rbox(dp, M.cream, x, 0.5, 0.345, 0.84, 0.56, 0.03, 0.04); box(dp, M.creamD, x, 0.5, 0.362, 0.7, 0.42, 0.02); });
        box(dp, M.gold, 0, 0.82, 0.35, 2.96, 0.022, 0.02);
        [-1.5, 1.5].forEach(x => { cyl(dp, M.woodD, x, 0.47, 0.33, 0.045, 0.8); sphS(dp, M.gold, x, 0.86, 0.34, 0.04); });
      }
      draw(c => {
        c.fillStyle = '#2F3A5A'; R.rrect(c, 0, 0, 512, 150, 30); c.fill(); c.strokeStyle = '#FFD45E'; c.lineWidth = 5; R.rrect(c, 10, 10, 492, 130, 22); c.stroke();
        R.text(c, 'Тихо: идёт перевод', 256, 78, 64, '#FFF6E8', { f: 'Caveat', w: 700, max: 460 });
      }, 0, 184);
      { const sg = grp(dc, 0.98, 0.52, -3.935); sg.rotation.z = -0.04; rbox(sg, M.gold, 0, 0, 0, 0.8, 0.245, 0.02, 0.02); aplane(sg, [0, 184, 512, 150], [0, 0, 0.012], [0.78, 0.228, 1]); }
      // стопка словарей (страницы видны с трёх сторон)
      { let y = TOP; [[0.4, 0.085, 0.29, 1, -0.08], [0.36, 0.075, 0.27, 0, 0.14], [0.32, 0.08, 0.24, 4, -0.02]].forEach(([w, h, d, ci, ry], i) => {
        const bg = grp(dc, -1.3, y + h / 2, -4.38, ry);
        rbox(bg, BOOK[ci], 0, 0, 0, w, h, d, 0.014); box(bg, M.paper, 0.01, 0, 0, w - 0.012, h * 0.7, d + 0.008);
        box(bg, M.gold, -w / 2 + 0.06, 0, d / 2 + 0.006, 0.02, h * 0.75, 0.004);
        if (i === 2) { box(bg, M.rasp, 0.06, h / 2 + 0.002, 0.03, 0.022, 0.004, d * 0.8); box(bg, M.rasp, 0.06, 0, d / 2 + 0.03, 0.022, h + 0.03, 0.004, [0.35, 0, 0]); }
        y += h; }); }
      // лампа с абажуром
      cyl(dc, M.gold, 0.52, TOP + 0.015, -4.52, 0.1, 0.03); cyl(dc, M.gold, 0.52, TOP + 0.21, -4.52, 0.014, 0.4);
      sphS(dc, M.lamp, 0.52, TOP + 0.36, -4.52, 0.055); put(dc, shadeG, shadeM, [0.52, TOP + 0.44, -4.52], [0.2, 0.18, 0.2]);
      scallop(dc, M.cream, 0.33, 0.71, TOP + 0.35, -4.32, 0.04);
      const lampHalo = R.halo(g, 0.52, TOP + 0.4, -4.44, 1.1, '#FFD39A', 0.5);
      // чернильница с пером
      cyl(dc, M.ink, -0.42, TOP + 0.035, -4.32, 0.055, 0.07); cyl(dc, M.gold, -0.42, TOP + 0.08, -4.32, 0.03, 0.025);
      { const qg = grp(dc, -0.4, TOP + 0.2, -4.33); qg.rotation.set(0.15, 0, -0.38); sphS(qg, BOOK[0], 0, 0.03, 0, 0.03, 0.15, 0.01); cyl(qg, M.cream, 0, -0.11, 0, 0.005, 0.14); }
      // штемпель и подушечка
      { const sg = grp(dc, 0.78, TOP, -4.12, 0.3); rbox(sg, M.gold, 0, 0.015, 0, 0.1, 0.03, 0.08, 0.01); cyl(sg, M.woodD, 0, 0.07, 0, 0.018, 0.08); sphS(sg, M.woodD, 0, 0.125, 0, 0.038); }
      box(dc, M.navy, 1.0, TOP + 0.012, -4.12, 0.15, 0.025, 0.1); box(dc, M.rasp, 1.0, TOP + 0.026, -4.12, 0.12, 0.004, 0.075);
      // звонок
      cyl(dc, M.cream, -0.74, TOP + 0.008, -4.08, 0.065, 0.016); put(dc, GEO.hemi, M.gold, [-0.74, TOP + 0.016, -4.08], [0.055, 0.05, 0.055]); sphS(dc, M.gold, -0.74, TOP + 0.075, -4.08, 0.014);
      // пишущая машинка (только в сюжете: на прогулке машинки нет — она понадобится в одной из будущих серий)
      if (!(R.o && R.o.mode === 'free')) { const tw = grp(dc, 1.17, TOP, -4.38, -0.3);
        rbox(tw, M.mint, 0, 0.06, 0.02, 0.44, 0.12, 0.3, 0.04); rbox(tw, M.mint, 0, 0.12, -0.08, 0.42, 0.08, 0.13, 0.03);
        cyl(tw, M.ink, 0, 0.17, -0.09, 0.035, 0.47, [0, 0, PI / 2]); [-1, 1].forEach(s2 => cyl(tw, M.cream, s2 * 0.25, 0.17, -0.09, 0.03, 0.03, [0, 0, PI / 2]));
        put(tw, GEO.plane, M.paper, [0, 0.28, -0.11], [0.24, 0.22, 1], [-0.22, 0, 0]);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) put(tw, GEO.cylLo, M.cream, [-0.15 + i * 0.06 + r * 0.015, 0.125 + r * 0.008, 0.11 - r * 0.045], [0.017, 0.02, 0.017]);
        box(tw, M.cream, 0, 0.12, 0.155, 0.22, 0.02, 0.03); }
      // подставка для записки
      { const ns = grp(dc, 0, TOP, -4.2);
        rbox(ns, M.woodD, 0, 0.015, 0.02, 0.48, 0.03, 0.22, 0.012); box(ns, M.woodD, 0, 0.045, 0.115, 0.46, 0.035, 0.02);
        const bk = grp(ns, 0, 0.02, -0.05); bk.rotation.x = -0.55; box(bk, M.woodD, 0, 0.17, -0.012, 0.44, 0.34, 0.02); }

      /* ---------- записка вора: светится и пульсирует ---------- */
      const nG = grp(g, 0, TOP, -4.2, 0, 'spot:note');
      let noteOn = true;
      const noteIn = grp(nG, 0, 0.02, -0.05); noteIn.rotation.x = -0.55;
      { const [cv, c] = R.cnv(320, 240);
        c.fillStyle = '#FFFBF0'; R.rrect(c, 4, 4, 312, 232, 14); c.fill(); c.strokeStyle = '#F0DFC0'; c.lineWidth = 3; R.rrect(c, 4, 4, 312, 232, 14); c.stroke();
        c.strokeStyle = '#3E4C7A'; c.lineWidth = 4; c.lineCap = 'round';
        const wave = (x0, x1, y, k) => { c.beginPath(); for (let x = x0; x <= x1; x += 4) { const yy = y + Math.sin(x * 0.11 + k) * 3 + Math.sin(x * 0.037 + k * 2) * 2; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); };
        wave(26, 150, 44, 0); wave(26, 286, 86, 1); wave(26, 270, 120, 2); wave(26, 290, 154, 3); wave(26, 180, 188, 4);
        c.strokeStyle = '#C2405B'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(214, 200); c.bezierCurveTo(232, 176, 250, 214, 268, 190); c.bezierCurveTo(278, 178, 290, 196, 296, 186); c.stroke();
        c.strokeStyle = '#E8B84A'; c.lineWidth = 3; c.beginPath(); c.arc(270, 40, 14, 0, 7); c.stroke();
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; c.beginPath(); c.moveTo(270 + Math.cos(a) * 19, 40 + Math.sin(a) * 19); c.lineTo(270 + Math.cos(a) * 26, 40 + Math.sin(a) * 26); c.stroke(); }
        R.text(c, '?', 270, 42, 20, '#C2405B', { w: 900 });
        const paper = plane(noteIn, toon('#FFFFFF', { map: R.tex(cv) }), 0, 0.185, 0.004, 0.38, 0.285, 0.05); paper.receiveShadow = false; }
      const [ngv, ngc] = R.cnv(256, 200);
      ngc.shadowColor = 'rgba(255,205,110,1)'; ngc.shadowBlur = 26; ngc.fillStyle = 'rgba(255,226,150,1)'; R.rrect(ngc, 40, 36, 176, 128, 12); ngc.fill(); ngc.fill();
      const noteGlowM = addM(R.tex(ngv), '#FFD98A', 0.6);
      const noteGlow = plane(noteIn, noteGlowM, 0, 0.185, -0.002, 0.62, 0.48, 0.05); noteGlow.receiveShadow = false; noteGlow.renderOrder = 3;
      const [spv, spc] = R.cnv(64, 64);
      { const gr = spc.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,230,150,.9)'); gr.addColorStop(1, 'rgba(255,210,120,0)');
        spc.fillStyle = gr; spc.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, r = i % 2 ? 6 : 31; spc.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } spc.fill(); }
      const spark = new T.Sprite(R.keep(new T.SpriteMaterial({ map: R.tex(spv), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
      spark.position.set(0.2, 0.46, 0.02); spark.scale.setScalar(0.14); spark.renderOrder = 5; nG.add(spark);
      hit(nG, 0, 0.2, 0, 0.62, 0.48, 0.4);

      /* ---------- попугай на жёрдочке ---------- */
      cyl(st, M.woodD, 1.95, 0.025, -4.35, 0.2, 0.05); cyl(st, M.wood, 1.95, 0.42, -4.35, 0.03, 0.78);
      cyl(st, M.woodL, 1.95, 0.8, -4.35, 0.025, 0.58, [0, 0, PI / 2]); [-0.29, 0.29].forEach(x => sphS(dc, M.gold, 1.95 + x, 0.8, -4.35, 0.035));
      cyl(dc, M.cream, 2.17, 0.85, -4.35, 0.05, 0.06); sphS(dc, BOOK[6], 2.17, 0.88, -4.35, 0.04, 0.015, 0.04);
      const parrot = R.npc.parrot(); parrot.root.position.set(1.92, 0.82, -4.35); parrot.root.rotation.y = -0.35; g.add(parrot.root);

      /* ---------- лиса за конторкой (на ступеньке), с книгой ---------- */
      rbox(dc, M.woodD, -0.9, 0.11, -5.12, 0.62, 0.22, 0.5, 0.04);
      const fox = R.npc.fox(); fox.root.position.set(-0.9, 0.22, -5.1); fox.root.rotation.y = 0.18; g.add(fox.root);
      { const fb = new T.Group(); fb.position.set(0.27, 0.76, 0.2); fb.rotation.set(-0.25, -0.5, 0.06); fox.body.add(fb);
        box(fb, M.cream, 0, 0, -0.012, 0.27, 0.18, 0.012);
        [-1, 1].forEach(s2 => { const pg = grp(fb, 0, 0, 0, -s2 * 0.22); box(pg, M.paper, s2 * 0.065, 0, 0, 0.12, 0.165, 0.014); });
        R.bake(fb, null, {}); }
      // лапы и хвост лисы целиком за конторкой — не рисуем их (минус 7 вызовов)
      fox.body.children.forEach(m => { if (m.isMesh && Math.abs(m.position.y - 0.07) < 0.012) m.visible = false; });
      if (fox.tail) fox.tail.visible = false;
      // жители стоят за мебелью — их тени не видны, а вызовов отрисовки съедают много
      [parrot, fox].forEach(n => n.root.traverse(m => { if (m.isMesh) m.castShadow = false; }));

      /* ---------- старый шкаф: чуть развёрнут к залу, створки — отдельные группы ---------- */
      const WA = -PI / 2 + 0.22, WX = 4.3, WZ = -3.75;
      const wS = grp(st, WX, 0, WZ, WA), wD = grp(dc, WX, 0, WZ, WA);
      rbox(wD, M.navy, 0, 1.34, 0.05, 1.5, 2.16, 0.04, 0.02);
      [-1, 1].forEach(sd => rbox(wS, M.woodD, sd * 0.775, 1.34, 0.31, 0.07, 2.36, 0.6, 0.025));
      rbox(wS, M.woodD, 0, 0.2, 0.31, 1.62, 0.14, 0.6, 0.03);
      rbox(wS, M.woodD, 0, 2.47, 0.32, 1.66, 0.12, 0.62, 0.03);
      rbox(wS, M.wood, 0, 2.6, 0.34, 1.8, 0.14, 0.68, 0.05);
      put(wD, R.extrude(R.archShape(0.84, 0.42), 0.05), M.woodD, [0, 2.66, 0.52]); sphS(wD, M.gold, 0, 2.86, 0.58, 0.045);
      [-0.68, 0.68].forEach(x => [0.12, 0.52].forEach(z => sphS(wD, M.woodD, x, 0.07, z, 0.07, 0.07, 0.07)));
      box(wD, M.wood, 0, 0.95, 0.3, 1.48, 0.03, 0.52); box(wD, M.wood, 0, 1.72, 0.3, 1.48, 0.03, 0.52);
      { const sc = grp(wD, 0, 1.02, 0.36); cyl(sc, M.paper, 0, 0, 0, 0.05, 0.52, [0, 0, PI / 2]); [-0.28, 0.28].forEach(x => cyl(sc, M.gold, x, 0, 0, 0.022, 0.06, [0, 0, PI / 2]));
        cyl(sc, M.rasp, 0, 0, 0, 0.053, 0.04, [0, 0, PI / 2]); cyl(sc, M.rasp, 0, 0.0, 0.055, 0.03, 0.012, [PI / 2, 0, 0]); }
      [[0.28, 0], [0.31, 1], [0.34, 6]].forEach(([y, ci], i) => box(wD, BOOK[ci], -0.35 + i * 0.03, y + 0.03, 0.3, 0.42, 0.06, 0.32));
      [[0.28, 3], [0.31, 4]].forEach(([y, ci], i) => box(wD, BOOK[ci], 0.35 - i * 0.02, y + 0.03, 0.3, 0.4, 0.06, 0.3));
      cyl(wD, M.rose, 0.3, 1.88, 0.3, 0.17, 0.3); cyl(wD, M.cream, 0.3, 2.04, 0.3, 0.18, 0.04);
      // шляпная коробка и плющ сверху
      cyl(wD, BOOK[1], -0.35, 2.82, 0.32, 0.17, 0.2); cyl(wD, M.cream, -0.35, 2.93, 0.32, 0.18, 0.04); box(wD, M.rasp, -0.35, 2.82, 0.32, 0.36, 0.035, 0.03);
      cyl(wD, M.pot, 0.45, 2.78, 0.35, 0.09, 0.14); sphS(wD, M.leaf, 0.45, 2.9, 0.35, 0.12, 0.08, 0.1);
      for (let i = 0; i < 7; i++) sphS(wD, i % 2 ? M.leaf : M.leafD, 0.83, 2.7 - i * 0.13, 0.45 + Math.sin(i * 1.4) * 0.06, 0.03, 0.045, 0.045);   // плеть по боковине

      const wI = grp(g, WX, 0, WZ, WA, 'spot:cabinet');
      const doorTex = knobLeft => {   // филёнки, сердечко и ручка нарисованы: створка = один вызов отрисовки
        const [cv, c] = R.cnv(128, 384), kx = knobLeft ? 22 : 106;
        c.fillStyle = '#B98C6A'; c.fillRect(0, 0, 128, 384); c.strokeStyle = '#9A7052'; c.lineWidth = 4; c.strokeRect(2, 2, 124, 380);
        [[20, 70, 88, 186], [20, 276, 88, 88]].forEach(([x, y, w, h]) => { c.fillStyle = '#9A7052'; R.rrect(c, x - 3, y - 3, w + 6, h + 6, 14); c.fill(); c.fillStyle = '#D6AC80'; R.rrect(c, x, y, w, h, 12); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; R.rrect(c, x + 6, y + 6, w - 12, 10, 5); c.fill(); });
        c.fillStyle = '#FFD45E'; c.beginPath(); c.moveTo(64, 50); c.bezierCurveTo(44, 36, 50, 18, 64, 28); c.bezierCurveTo(78, 18, 84, 36, 64, 50); c.fill();
        c.fillStyle = '#C9A040'; R.rrect(c, kx - 6, 236, 12, 30, 5); c.fill(); c.fillStyle = '#FFD45E'; c.beginPath(); c.arc(kx, 232, 9, 0, 7); c.fill(); c.fillStyle = '#FFF4C8'; c.beginPath(); c.arc(kx - 3, 229, 3, 0, 7); c.fill();
        return toon('#FFFFFF', { map: R.tex(cv) });
      };
      const door = sd => {
        const p = new T.Group(); p.position.set(sd * 0.74, 0, 0.62); p.userData.dyn = true; wI.add(p);
        const m = put(p, GEO.box, doorTex(sd > 0), [-sd * 0.37, 1.34, 0.025], [0.73, 2.12, 0.05]); m.castShadow = false;
        return p;
      };
      const doorA = door(1), doorB = door(-1);
      const [cgv, cgc] = R.cnv(256, 256);
      { const gr = cgc.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,236,170,1)'); gr.addColorStop(0.45, 'rgba(255,205,120,.55)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); cgc.fillStyle = gr; cgc.fillRect(0, 0, 256, 256); }
      const cabGlowM = addM(R.tex(cgv), '#FFD98A', 0);
      const cabGlow = put(wI, GEO.plane, cabGlowM, [0, 1.35, 0.1], [1.5, 2.1, 1]); cabGlow.castShadow = false; cabGlow.receiveShadow = false; cabGlow.visible = false; cabGlow.renderOrder = 3;
      const cabHalo = R.halo(wI, 0, 1.3, 0.75, 1.6, '#FFD98A', 0); cabHalo.visible = false;
      hit(wI, 0, 1.4, 0.32, 1.72, 2.85, 0.7);
      let cabK = 0, cabOpen = false, cabRun = 0;
      const setCab = k => {
        const e = k < 1 ? 1 - Math.pow(1 - k, 3) * (1 - 2.2 * k * (1 - k)) : 1;   // мягкий выезд с лёгким перелётом
        doorA.rotation.y = e * 1.95; doorB.rotation.y = -e * 1.95;
        cabK = Math.min(1, Math.max(0, k * 1.4 - 0.15)); cabGlow.visible = cabHalo.visible = cabK > 0.01;
        cabGlowM.opacity = cabK * 0.62; cabHalo.material.opacity = cabK * 0.7;
      };
      const animCab = (to, dur) => new Promise(res => {
        const id = ++cabRun, from = to ? 0 : 1, t0 = performance.now();
        const step = () => { if (id !== cabRun) return res(); const k = Math.min(1, (performance.now() - t0) / dur); setCab(from + (to - from) * k); if (k < 1) requestAnimationFrame(step); else res(); };
        step(); setTimeout(() => { if (id === cabRun) { setCab(to); res(); } }, dur + 400);
      });
      const openCabinet = (dur = 1000) => { if (cabOpen) return Promise.resolve(); cabOpen = true; return animCab(1, dur); };
      const closeCabinet = (dur = 700) => { if (!cabOpen) return Promise.resolve(); cabOpen = false; return animCab(0, dur); };

      /* ---------- глобус на деревянной треноге ---------- */
      const GX = -3.0, GZ = -3.6;
      { const gs = grp(st, GX, 0, GZ), up = new T.Vector3(0, 1, 0);
        for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.5, b = new T.Vector3(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27), t2 = new T.Vector3(Math.cos(a) * 0.09, 0.64, Math.sin(a) * 0.09);
          const dv = t2.clone().sub(b), L = dv.length(), lg = put(gs, GEO.cylLo, M.woodD, [(b.x + t2.x) / 2, 0.32, (b.z + t2.z) / 2], [0.025, L, 0.025]);
          lg.quaternion.setFromUnitVectors(up, dv.normalize()); sphS(dc, M.gold, GX + b.x, 0.02, GZ + b.z, 0.035); }
        put(gs, R.ringG(0.24, 0.028), M.wood, [0, 0.64, 0], null, [PI / 2, 0, 0]);
        cyl(gs, M.wood, 0, 0.67, 0, 0.04, 0.07); }
      const gI = grp(g, GX, 0, GZ, 0, 'spot:globe');
      const tilt = grp(gI, 0, 1.02, 0); tilt.rotation.z = 0.41; tilt.userData.dyn = true;
      put(tilt, R.keep(new T.TorusGeometry(0.34, 0.016, 6, 28, PI * 1.25)), M.gold, [0, 0, 0], null, [0, 0, -PI * 0.125]);
      [-1, 1].forEach(s2 => sphS(tilt, M.gold, 0, s2 * 0.34, 0, 0.025));
      const spin = new T.Group(); spin.userData.dyn = true; tilt.add(spin);
      { const [cv, c] = R.cnv(512, 256);
        c.fillStyle = '#A6D2EE'; c.fillRect(0, 0, 512, 256);
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; [64, 128, 192].forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); });
        const q = R.rng(12), land = (x, y, n, col) => { c.fillStyle = col; for (let i = 0; i < n; i++) { c.beginPath(); c.ellipse(x + (q() - 0.5) * 70, y + (q() - 0.5) * 40, 18 + q() * 26, 12 + q() * 16, q() * 3, 0, 7); c.fill(); } };
        land(80, 80, 7, '#BFE3A6'); land(110, 170, 6, '#F3E2A6'); land(250, 70, 8, '#BFE3A6'); land(290, 150, 6, '#F4C7D0'); land(410, 100, 7, '#BFE3A6'); land(450, 190, 4, '#F3E2A6');
        c.fillStyle = '#C2405B'; c.beginPath(); c.moveTo(300, 98); c.bezierCurveTo(286, 84, 292, 72, 300, 80); c.bezierCurveTo(308, 72, 314, 84, 300, 98); c.fill();
        put(spin, GEO.sph, toon('#FFFFFF', { map: R.tex(cv) }), [0, 0, 0], [0.3, 0.3, 0.3]); }
      R.bake(tilt, null, {});
      hit(gI, 0, 0.75, 0, 0.75, 1.5, 0.75);
      let globeV = 0.35;
      const spinGlobe = () => { globeV = 6; };

      /* ---------- уголок для чтения: кресло, торшер, окно со шторками ---------- */
      { const ac = grp(dc, -3.78, 0, -5.05, 0.62);
        rbox(ac, M.rose, 0, 0.36, 0.03, 0.74, 0.22, 0.66, 0.09);
        rbox(ac, M.rose, 0, 0.74, -0.27, 0.78, 0.78, 0.2, 0.1);
        [-1, 1].forEach(sd => rbox(ac, M.roseD, sd * 0.37, 0.52, 0.0, 0.16, 0.36, 0.72, 0.07));
        [[-0.3, 0.26], [0.3, 0.26], [-0.3, -0.24], [0.3, -0.24]].forEach(([x, z]) => put(ac, GEO.cylLo, M.woodD, [x, 0.12, z], [0.03, 0.24, 0.03]));
        const ad = grp(dc, -3.78, 0, -5.05, 0.62);
        sphS(ad, M.cream, 0.08, 0.6, -0.12, 0.17, 0.15, 0.07);
        put(ad, R.heartG, M.rasp, [0.08, 0.61, -0.04], [0.07, 0.07, 0.05]);
        box(ad, BOOK[3], -0.37, 0.62, 0.05, 0.2, 0.05, 0.5); box(ad, BOOK[3], -0.47, 0.45, 0.05, 0.04, 0.32, 0.5); }
      cyl(dc, M.gold, -4.15, 0.02, -5.85, 0.17, 0.04); cyl(dc, M.gold, -4.15, 0.85, -5.85, 0.018, 1.66);
      sphS(dc, M.lamp, -4.15, 1.72, -5.85, 0.07); put(dc, shadeG, shadeM, [-4.15, 1.8, -5.85], [0.27, 0.28, 0.27]);
      scallop(dc, M.cream, -4.4, -3.9, 1.67, -5.6, 0.05);
      R.halo(g, -4.1, 1.78, -5.7, 1.3, '#FFC890', 0.5);
      { const lw = grp(dc, -W / 2 + 0.005, 0, -4.3, PI / 2);
        R.windowF(lw, M.cream, outM, 0, 2.25, 1.0, 1.5, { arch: true, cross: true });
        R.curtains(lw, M.rose, 0, 2.25, 1.0, 1.5);
        cyl(lw, M.pot, 0.28, 1.43, 0.12, 0.07, 0.11); sphS(lw, M.leaf, 0.26, 1.54, 0.12, 0.09, 0.07, 0.08); sphS(lw, M.leafD, 0.32, 1.57, 0.14, 0.06);
        sphS(lw, BOOK[2], 0.24, 1.6, 0.16, 0.025); sphS(lw, BOOK[0], 0.31, 1.63, 0.18, 0.025);
        cyl(lw, M.cream, -0.3, 1.4, 0.12, 0.05, 0.07); }

      /* ---------- дверь на улицу (визуал в статике, тап — по ловушке) ---------- */
      const DZ = -1.6, dv = grp(dc, -W / 2 + 0.01, 0, DZ, PI / 2);
      put(dv, R.extrude(R.archShape(1.3, 2.42), 0.06), M.cream, [0, 0, 0.01]);
      put(dv, R.extrude(R.archShape(1.06, 2.28), 0.06), M.navy, [0, 0, 0.06]);
      [-0.24, 0.24].forEach(x => rbox(dv, M.navyL, x, 0.62, 0.13, 0.36, 0.7, 0.03, 0.05));
      put(dv, R.extrude(R.archShape(0.64, 0.74), 0.02), outM, [0, 1.3, 0.12]);
      { // венок из тех же материалов, что и комната
        for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2; put(dv, GEO.sphLo, [M.leaf, M.leafD, BOOK[2]][i % 3], [Math.cos(a) * 0.16, 1.6 + Math.sin(a) * 0.16, 0.16], [0.06, 0.042, 0.03], [0, 0, a + 0.6]); }
        for (let i = 0; i < 6; i++) { const a = 0.4 + i * 1.05; sphS(dv, M.rasp, Math.cos(a) * 0.173, 1.6 + Math.sin(a) * 0.173, 0.185, 0.022); }
        R.bowAt(dv, BOOK[0], M.rasp, 0, 1.44, 0.19, 1); }
      sphS(dv, M.gold, 0.4, 1.02, 0.15, 0.045); rbox(dv, M.gold, 0.4, 1.02, 0.125, 0.07, 0.2, 0.02, 0.02);
      rbox(dv, M.gold, 0, 1.1, 0.13, 0.28, 0.05, 0.02, 0.015);
      draw(c => { c.fillStyle = '#2F3A5A'; R.rrect(c, 0, 0, 320, 96, 18); c.fill(); R.text(c, 'ВЫХОД', 160, 50, 58, '#FFD45E'); }, 0, 342);
      rbox(dv, M.gold, 0, 2.66, 0.05, 0.74, 0.26, 0.04, 0.03); aplane(dv, [0, 342, 320, 96], [0, 2.66, 0.075], [0.7, 0.21, 1]);
      box(dv, M.gold, 0.42, 2.42, 0.16, 0.03, 0.03, 0.2); put(dv, GEO.cone, M.gold, [0.42, 2.3, 0.26], [0.05, 0.08, 0.05]); sphS(dv, M.gold, 0.42, 2.25, 0.26, 0.018);
      const dg = grp(g, -W / 2 + 0.01, 0, DZ, PI / 2, 'exitDoor'); hit(dg, 0, 1.3, 0.12, 1.3, 2.9, 0.3);
      R.halo(g, -W / 2 + 0.25, 2.66, DZ, 0.7, '#FFE3A0', 0.35);
      // вешалка и подставка для зонтов
      { const hk = grp(dc, -W / 2 + 0.005, 0, -0.62, PI / 2);
        rbox(hk, M.wood, 0, 1.86, 0.03, 0.56, 0.1, 0.04, 0.02); [-0.18, 0, 0.18].forEach(x => sphS(hk, M.gold, x, 1.85, 0.08, 0.025));
        box(hk, M.rasp, -0.18, 1.5, 0.09, 0.09, 0.66, 0.025); box(hk, M.rasp, -0.12, 1.42, 0.1, 0.09, 0.8, 0.025);
        sphS(hk, M.navyL, 0.18, 1.8, 0.12, 0.13, 0.08, 0.12); sphS(hk, M.navyL, 0.18, 1.86, 0.12, 0.09, 0.06, 0.09); }
      cyl(dc, M.navyL, -4.2, 0.24, -0.66, 0.13, 0.48); put(dc, R.ringG(0.13, 0.015), M.gold, [-4.2, 0.4, -0.66], null, [PI / 2, 0, 0]);
      put(dc, GEO.cone, M.rasp, [-4.22, 0.72, -0.66], [0.065, 0.56, 0.065], [PI, 0, 0.08]);
      put(dc, R.keep(new T.TorusGeometry(0.045, 0.014, 6, 12, PI)), M.navy, [-4.205, 1.02, -0.66], null, [0, 0, 0.08]);

      /* ---------- бра с тёплыми ореолами ---------- */
      [[-1, -2.85], [1, -2.05], [1, -5.15]].forEach(([sd, z]) => {
        const sg = grp(dc, sd * (W / 2 - 0.02), 0, z, -sd * PI / 2); sconce(sg, 0, 2.75);
        R.halo(g, sd * (W / 2 - 0.3), 2.72, z, 1.0, '#FFC890', 0.5);
      });
      // карта в рамке на правой стене
      draw(c => { c.fillStyle = '#F6E9CF'; c.fillRect(0, 0, 384, 256);
        c.fillStyle = '#BFD8EE'; c.fillRect(0, 160, 384, 96); c.beginPath(); c.ellipse(300, 60, 60, 40, 0.3, 0, 7); c.fill();
        c.fillStyle = '#CFE5B8'; c.beginPath(); c.ellipse(120, 110, 90, 50, -0.2, 0, 7); c.fill(); c.beginPath(); c.ellipse(260, 140, 50, 26, 0.4, 0, 7); c.fill();
        c.strokeStyle = '#C2405B'; c.setLineDash([10, 9]); c.lineWidth = 5; c.beginPath(); c.moveTo(60, 120); c.bezierCurveTo(130, 40, 200, 190, 272, 130); c.stroke(); c.setLineDash([]);
        c.lineWidth = 7; c.beginPath(); c.moveTo(262, 120); c.lineTo(284, 142); c.moveTo(284, 120); c.lineTo(262, 142); c.stroke();
      }, 520, 262, 0.95);
      { const mg = grp(dc, W / 2 - 0.02, 0, -1.2, -PI / 2); rbox(mg, M.gold, 0, 2.05, 0.02, 0.92, 0.66, 0.04, 0.03); aplane(mg, [520, 262, 364.8, 243.2], [0, 2.05, 0.045], [0.82, 0.56, 1]); }

      /* ---------- столик с коробкой «ПОТЕРЯНО ПРИ ПЕРЕВОДЕ» ---------- */
      const LX = 3.3, LZ = -1.0;
      cyl(st, M.woodL, LX, 0.6, LZ, 0.37, 0.05); cyl(dc, M.cream, LX, 0.575, LZ, 0.39, 0.03);
      scallop(dc, M.cream, LX - 0.36, LX + 0.36, 0.56, LZ + 0.37, 0.06);
      cyl(st, M.wood, LX, 0.32, LZ, 0.045, 0.56); cyl(st, M.woodD, LX, 0.03, LZ, 0.2, 0.05);
      const lI = grp(g, LX, 0.625, LZ, -0.22, 'spot:lost');
      const lbox = new T.Group(); lbox.userData.dyn = true; lI.add(lbox);
      { rbox(lbox, M.card, 0, 0.19, 0, 0.6, 0.38, 0.44, 0.02);
        const flap = (x, z, w, rx) => { const f = grp(lbox, x, 0.38, z); f.rotation.set(rx, 0, 0); box(f, M.card, 0, 0.08, 0, w, 0.16, 0.012); };
        flap(0, 0.215, 0.58, 0.55); flap(0, -0.215, 0.58, -0.45);
        [-1, 1].forEach(s2 => { const f = grp(lbox, s2 * 0.295, 0.38, 0); f.rotation.set(0, 0, -s2 * 0.5); box(f, M.card, 0, 0.08, 0, 0.012, 0.16, 0.42); });
        const [cv, c] = R.cnv(512, 512), lm = toon('#FFFFFF', { map: R.tex(cv), alphaTest: 0.5 });
        c.fillStyle = '#FFFDF5'; R.rrect(c, 6, 6, 500, 244, 22); c.fill(); c.setLineDash([14, 10]); c.strokeStyle = '#C7A276'; c.lineWidth = 5; R.rrect(c, 18, 18, 476, 220, 16); c.stroke(); c.setLineDash([]);
        R.text(c, 'ПОТЕРЯНО', 256, 98, 92, '#C2405B', { max: 440 }); R.text(c, 'ПРИ ПЕРЕВОДЕ', 256, 180, 62, '#2F3A5A', { max: 440 });
        const sub = (sx, sy, sw, sh, p, sc, rz) => { const ge = R.keep(new T.PlaneGeometry(1, 1)); ge.attributes.uv.array.set([sx / 512, 1 - sy / 512, (sx + sw) / 512, 1 - sy / 512, sx / 512, 1 - (sy + sh) / 512, (sx + sw) / 512, 1 - (sy + sh) / 512]); const m = put(lbox, ge, lm, p, sc, [0, 0, rz || 0]); m.castShadow = false; };
        sub(0, 0, 512, 256, [0, 0.2, 0.222], [0.54, 0.27, 1]);
        // что потерялось: носок, варежка, карточки с буквами
        const sock = grp(lbox, -0.16, 0.36, 0.04); sock.rotation.z = 0.35;
        const capA = R.keep(new T.CapsuleGeometry(0.045, 0.2, 3, 8)), capB = R.keep(new T.CapsuleGeometry(0.046, 0.1, 3, 8));
        put(sock, capA, M.rose, [0, 0.1, 0]);
        put(sock, capB, M.rose, [-0.06, 0.24, 0], null, [0, 0, PI / 2]);
        [['?', '#C2405B', 8], ['Ё', '#44568A', 120]].forEach(([ch, col, x]) => { c.fillStyle = '#FFFBF0'; R.rrect(c, x, 290, 96, 108, 12); c.fill(); c.strokeStyle = '#E8D6B8'; c.lineWidth = 3; R.rrect(c, x, 290, 96, 108, 12); c.stroke(); R.text(c, ch, x + 48, 348, 76, col, { f: 'Comfortaa', w: 700 }); });
        sub(0, 280, 224, 128, [0.09, 0.46, 0.07], [0.26, 0.15, 1], 0.05);
      }
      R.bake(lbox, null, { cast: false });
      hit(lI, 0, 0.3, 0, 0.75, 0.75, 0.6);
      // буквы, сбежавшие при переводе, кружат над коробкой
      const letters = ['й'].map((ch, i) => {
        const [lv, lc] = R.cnv(96, 96); lc.font = '700 72px Comfortaa, sans-serif'; lc.textAlign = 'center'; lc.textBaseline = 'middle'; lc.lineWidth = 10; lc.lineJoin = 'round'; lc.strokeStyle = '#FFFDF5'; lc.strokeText(ch, 48, 52); lc.fillStyle = ['#C2405B', '#44568A'][i]; lc.fillText(ch, 48, 52);
        const s = new T.Sprite(R.keep(new T.SpriteMaterial({ map: R.tex(lv), transparent: true, depthWrite: false, fog: false }))); s.scale.setScalar(0.17); s.renderOrder = 4; g.add(s); return s;
      });
      let lostHop = -1;
      const popLost = () => { lostHop = 0; };

      /* ---------- фикус в горшке ---------- */
      { cyl(dc, M.pot, 4.05, 0.18, -5.32, 0.21, 0.36); cyl(dc, M.cream, 4.05, 0.37, -5.32, 0.22, 0.04);
        [[0, 0.62, 0, 0.26, 0.24], [-0.14, 0.86, 0.04, 0.2, 0.2], [0.13, 0.95, -0.03, 0.2, 0.22], [0.0, 1.15, 0.05, 0.17, 0.17], [-0.06, 0.48, 0.16, 0.18, 0.12]]
          .forEach(([x, y, z, s, sy], i) => put(dc, R.blobGeo, i % 2 ? M.leafD : M.leaf, [4.05 + x, y, -5.32 + z], [s, sy, s])); }

      /* ---------- пылинки в свете окна ---------- */
      const DN = 26, dpos = new Float32Array(DN * 3), dph = [];
      for (let i = 0; i < DN; i++) { dpos[i * 3] = (Math.random() - 0.5) * 1.8; dpos[i * 3 + 1] = 1.2 + Math.random() * 2; dpos[i * 3 + 2] = -6.2 + Math.random() * 1.1; dph.push(Math.random() * 6); }
      const dgeo = R.keep(new T.BufferGeometry()); dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
      const dust = new T.Points(dgeo, R.keep(new T.PointsMaterial({ map: R.haloTex, color: 0xFFF0C8, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
      dust.frustumCulled = false; g.add(dust);

      R.bake(st, null, {});
      R.bake(dc, null, { cast: false });
      window.__bureauG = g;   // DEBUG
      [st, dc].forEach(gr => gr.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));   // мебель не перехватывает тапы

      const blockers = [
        { x0: -1.5, x1: 1.5, z0: -4.7, z1: -3.95 },     // конторка
        { x0: -1.5, x1: 1.5, z0: -6.5, z1: -4.7 },      // за конторкой — служебное
        { x0: 1.72, x1: 2.2, z0: -4.6, z1: -4.1 },      // жёрдочка
        { x0: 3.66, x1: 4.5, z0: -4.65, z1: -2.75 },    // шкаф (чуть развёрнут)
        { x0: 2.9, x1: 3.7, z0: -1.4, z1: -0.6 },       // столик с коробкой
        { x0: -3.3, x1: -2.7, z0: -3.9, z1: -3.3 },     // глобус
        { x0: -4.4, x1: -3.2, z0: -5.65, z1: -4.45 },   // кресло
        { x0: -4.42, x1: -3.98, z0: -0.86, z1: -0.44 }, // зонты
        { x0: 3.8, x1: 4.4, z0: -5.6, z1: -5.0 },       // фикус
        { x0: -4.5, x1: 4.5, z0: -6.5, z1: -5.95 },     // стеллажи и часы
      ];
      const OUT = {
        W, D,
        bounds: { x0: -4.1, x1: 4.1, z0: -5.6, z1: -0.4 },
        exit: { x: -3.95, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -2.6, z: -1.0 },   // ≥ 1,3 м от двери: «Выйти» не всплывает сразу
        cam: { x0: -2.2, x1: 2.2, z: -1.2 },
        blockers,
        spots: [
          { id: 'note', x: 0, z: -3.45, act: 'Читать', bubble: 'записка' },
          { id: 'books', x: -2.6, z: -5.2, act: 'Смотреть', bubble: 'книжные полки' },
          { id: 'cabinet', x: 3.35, z: -3.7, act: 'Шкаф', bubble: 'шкаф' },
          { id: 'lost', x: 2.55, z: -1.2, act: 'Заглянуть', bubble: 'потеряно при переводе' },
          { id: 'globe', x: -2.3, z: -3.0, act: 'Покрутить', bubble: 'глобус' },
        ],
        npcs: { parrot, fox },
        openCabinet, closeCabinet,
        noteGlow: on => { noteOn = !!on; noteGlow.visible = spark.visible = noteOn; },
        spinGlobe, popLost,
        // кадры для api.camFocus(pos, look)
        views: {
          note: { pos: [0.2, 2.3, -0.9], look: [0, 1.05, -4.2] },
          cabinet: { pos: [0.65, 2.5, -0.95], look: [3.64, 1.35, -3.6] },
          books: { pos: [-2.3, 2.3, -0.8], look: [-2.9, 1.65, -6.1] },
          globe: { pos: [-1.9, 1.8, -1.2], look: [-3.0, 0.95, -3.6] },
          lost: { pos: [2.3, 1.75, 1.2], look: [3.3, 0.85, -1.0] },
        },
        tick(t, dt, ctx) {
          if (window.__bureauDbg) window.__bureauDbg.ctx = ctx;   // DEBUG
          globeV += (0.35 - globeV) * Math.min(1, dt * 0.8); spin.rotation.y += dt * globeV;
          pend.rotation.z = Math.sin(t * 2.3) * 0.2;
          if (noteOn) {
            const p = 0.5 + 0.5 * Math.sin(t * 3.1);
            noteGlowM.opacity = 0.4 + p * 0.6;
            spark.position.y = 0.46 + Math.sin(t * 2) * 0.03; spark.material.rotation = t * 0.9; spark.scale.setScalar(0.1 + p * 0.07);
          }
          lampHalo.material.opacity = 0.48 + Math.sin(t * 2.1) * 0.03 + Math.sin(t * 7.7) * 0.015;
          for (let i = 0; i < DN; i++) { let y = dpos[i * 3 + 1] + dt * 0.06; if (y > 3.2) y = 1.2; dpos[i * 3 + 1] = y; dpos[i * 3] += Math.sin(t * 0.7 + dph[i]) * dt * 0.05; }
          dgeo.attributes.position.needsUpdate = true;
          letters.forEach((s, i) => { const a = t * 0.7 + i * PI; s.position.set(LX + Math.cos(a) * 0.3, 1.32 + Math.sin(t * 1.6 + i) * 0.08, LZ + Math.sin(a) * 0.22); s.material.rotation = Math.sin(t + i) * 0.3; });
          { const k = (t % 9) / 9, out = k > 0.8 ? Math.sin((k - 0.8) / 0.2 * PI) : 0; peek.position.z = -6.17 + out * 0.09; peek.rotation.z = out * 0.05; }
          if (lostHop >= 0) { lostHop += dt; const h = Math.sin(Math.min(1, lostHop / 0.5) * PI); lbox.position.y = h * 0.08; lbox.rotation.z = Math.sin(lostHop * 22) * 0.04 * (1 - Math.min(1, lostHop / 0.5)); if (lostHop > 0.5) { lostHop = -1; lbox.position.y = 0; lbox.rotation.z = 0; } }
          if (cabK > 0.01) { cabGlowM.opacity = cabK * (0.5 + 0.12 * Math.sin(t * 9) * Math.sin(t * 3.3)); }
        },
      };
      window.__bureauDbg = { out: OUT };   // DEBUG
      return OUT;
    },
  });
})();
