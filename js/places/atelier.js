/* =====================================================================
   Место прогулки: atelier — Ателье «Бант и берет» (новая комната 6.4×4.8).
   Пудровые обои, кремовые панели, золотой багет; паркет «ёлочкой», круглый
   ковёр. Овальное зеркало (примерка), стена лент с катушками, шляпная
   стойка, манекен в тренче с огромным карманом, зонтики, полочка с
   туфельками, раскройный стол; овечка Кашемира вяжет на табурете.
   Статика склеена (стены/пол без теней, мебель с тенью), у всех точек —
   невидимые «ловушки тапа». Мини «Примерка»: лист с живым зеркалом-овалом
   (Art.heroine), ряды образцов Ep1.kit.BOWS/COATS/HAIRS + цвета недели.
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'atelier';
  const PI = Math.PI;
  const BEIGE = '#E9D4B6';

  /* ---------- Комната ---------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#F6E4EA', gnd: '#C9A39A', hi: 0.66, sun: '#FFE4CC', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #6E3D57 0%, #3A2434 72%)', rim: ['#FFD9C8', 0.22], fog: '#3A2434' },
    cam: { portrait: { dx: 0, y: 3.9, dz: 5.6, ly: 0.75, lz: -2.3, fov: 52 }, landscape: { dx: 0.2, y: 3.7, dz: 6.2, ly: 1.2, lz: -2.0, fov: 46 } },
    build(R) {
      const { T, group: g, put, box, cyl, rbox, plane, toon, GEO } = R;
      const W = 6.4, D = 4.8, H = 3.2;
      const glow = (c, e, i) => toon(c, { emissive: new T.Color(e), emissiveIntensity: i });
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const M = {
        cream: toon('#FFFDF9'), creamD: toon('#F6E9DF'), gold: glow('#E8C770', '#B8903A', 0.14), wood: toon('#D2A77E'), woodD: toon('#A87E5C'),
        cherry: toon('#C2405B'), pink: toon('#F08FA8'), powder: toon('#F7C9D3'), mint: toon('#BFE6D3'), lav: toon('#D9CCF4'), beige: toon(BEIGE),
        beigeD: toon('#D2B994'), butter: toon('#FFE08A'), silver: toon('#DCE1E8'), ink: toon('#5B4A63'),
        glass: glow('#DDE6F2', '#DDE6F2', 0.15), lamp: glow('#FFE9B8', '#FFC46B', 0.9), 
      };
      const hitM = basic('#FFFFFF', { visible: false });
      const fx = new T.Group(); g.add(fx);   // стены, пол, настенное: без теней
      const st = new T.Group(); g.add(st);   // мебель: с тенью
      const grp = (par, x, y, z, ry) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; par.add(q); return q; };
      const hit = (key, x, y, z, w, h, d) => { const m = put(g, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; m.userData.key = key; return m; };

      /* --- атлас: паркет, ковёр, вывеска, «ВЫХОД», эскизы — одна текстура --- */
      // атлас мелочей 512×256: рисуем в логических координатах (x 1024…2048, y 0…512) с масштабом 0.5; пол — своя канва 512×384
      const [acv, ac0] = R.cnv(512, 256), [fcv, fc] = R.cnv(512, 384);
      ac0.setTransform(0.5, 0, 0, 0.5, -512, 0); fc.setTransform(0.5, 0, 0, 0.5, 0, 0);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 }), floorM = toon('#FFFFFF', { map: R.tex(fcv) });
      let ac = fc;   // сначала — пол
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = (sx - 1024) / 1024, u1 = (sx + sw - 1024) / 1024, v0 = 1 - (sy + sh) / 512, v1 = 1 - sy / 512;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      { // паркет «ёлочкой» (шеврон): колонки, дощечки с наклоном
        const q = R.rng(77), tones = ['#E8C9A8', '#E2BF9C', '#EDD2B4', '#DDB892', '#E6C4A2'];
        ac.fillStyle = '#C9A27E'; ac.fillRect(0, 0, 1024, 768);
        const cw = 64, ph = 26;
        for (let i = 0; i < 16; i++) {
          const x0 = i * cw, s = i % 2 ? 1 : -1;
          for (let k = -4; k < 34; k++) {
            const y = k * ph + (i % 2 ? 0 : ph / 2);
            ac.fillStyle = tones[Math.floor(q() * tones.length)];
            ac.beginPath(); ac.moveTo(x0 + 1.5, y + 1.5); ac.lineTo(x0 + cw - 1.5, y + s * cw * 0.5 + 1.5); ac.lineTo(x0 + cw - 1.5, y + s * cw * 0.5 + ph - 1.5); ac.lineTo(x0 + 1.5, y + ph - 1.5); ac.closePath(); ac.fill();
          }
        }
        ac.fillStyle = 'rgba(255,240,220,.18)'; ac.fillRect(0, 0, 1024, 768);
      }
      ac = ac0;   // дальше — атлас
      { // круглый ковёр: пудровый, кремовые фестоны, вишнёвая каёмка, цветочки
        const cx = 1024 + 256, cy = 256;
        ac.fillStyle = '#FFF4EC'; for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; ac.beginPath(); ac.arc(cx + Math.cos(a) * 232, cy + Math.sin(a) * 232, 22, 0, 7); ac.fill(); }
        ac.beginPath(); ac.arc(cx, cy, 236, 0, 7); ac.fill();
        ac.fillStyle = '#F7C9D3'; ac.beginPath(); ac.arc(cx, cy, 214, 0, 7); ac.fill();
        ac.strokeStyle = '#C2405B'; ac.lineWidth = 6; ac.beginPath(); ac.arc(cx, cy, 196, 0, 7); ac.stroke();
        ac.strokeStyle = '#FFF4EC'; ac.lineWidth = 4; ac.beginPath(); ac.arc(cx, cy, 120, 0, 7); ac.stroke();
        for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, x = cx + Math.cos(a) * 160, y = cy + Math.sin(a) * 160;
          ac.fillStyle = '#FFFDF9'; for (let k = 0; k < 5; k++) { const b = k / 5 * PI * 2; ac.beginPath(); ac.arc(x + Math.cos(b) * 9, y + Math.sin(b) * 9, 7, 0, 7); ac.fill(); }
          ac.fillStyle = '#E8C770'; ac.beginPath(); ac.arc(x, y, 5, 0, 7); ac.fill(); }
        ac.fillStyle = '#F08FA8'; [[-24, 0], [24, 0]].forEach(([dx]) => { ac.beginPath(); ac.ellipse(cx + dx, cy, 30, 18, dx > 0 ? 0.4 : -0.4, 0, 7); ac.fill(); });
        ac.fillStyle = '#C2405B'; ac.beginPath(); ac.arc(cx, cy, 10, 0, 7); ac.fill();
      }
      { // вывеска «ПРИМЕРОЧНАЯ»
        const x = 1536, y = 0; ac.fillStyle = '#FFFDF9'; R.rrect(ac, x + 4, y + 4, 504, 120, 30); ac.fill();
        ac.strokeStyle = '#E8C770'; ac.lineWidth = 6; R.rrect(ac, x + 14, y + 14, 484, 100, 24); ac.stroke();
        R.text(ac, 'ПРИМЕРОЧНАЯ', x + 256, y + 66, 54, '#C2405B', { f: 'Comfortaa', w: 700, max: 430 });
      }
      { // табличка «ВЫХОД»
        const x = 1536, y = 136; ac.fillStyle = '#3A2434'; R.rrect(ac, x, y, 320, 96, 18); ac.fill(); R.text(ac, 'ВЫХОД', x + 160, y + 50, 58, '#BFF0CE');
      }
      // эскизы мод в рамках: силуэты с бантом и беретом
      const sketch = (x, y, coat, bow) => {
        ac.fillStyle = '#FFF8F0'; ac.fillRect(x, y, 192, 256);
        ac.strokeStyle = '#C9A2AE'; ac.lineWidth = 3; ac.strokeRect(x + 10, y + 10, 172, 236);
        ac.fillStyle = coat; ac.beginPath(); ac.moveTo(x + 96, y + 92); ac.lineTo(x + 140, y + 220); ac.lineTo(x + 52, y + 220); ac.closePath(); ac.fill();
        ac.fillStyle = '#F7DCC8'; ac.beginPath(); ac.arc(x + 96, y + 72, 24, 0, 7); ac.fill();
        ac.fillStyle = bow; ac.beginPath(); ac.ellipse(x + 96, y + 50, 30, 10, -0.2, 0, 7); ac.fill();
        ac.strokeStyle = '#7A6A76'; ac.lineWidth = 2.5; ac.beginPath(); ac.moveTo(x + 76, y + 222); ac.lineTo(x + 74, y + 238); ac.moveTo(x + 116, y + 222); ac.lineTo(x + 118, y + 238); ac.stroke();
        R.text(ac, 'эскиз', x + 96, y + 30, 22, '#B48A9A', { f: 'Caveat', w: 700 });
      };
      sketch(1536, 256, '#E9D4B6', '#F08FA8'); sketch(1760, 256, '#D9CCF4', '#C2405B');

      /* --- пол, стены, панели, багет --- */
      box(fx, M.woodD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
      { const fl = put(fx, GEO.plane, floorM, [0, 0.002, -D / 2], [W, D, 1], [-PI / 2, 0, 0]); fl.castShadow = false; }
      aplane(fx, [1024, 0, 512, 512], [0.2, 0.008, -2.6], [2.2, 2.2, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      const [wcv, wc] = R.cnv(256, 256);
      wc.fillStyle = '#FBE1E7'; wc.fillRect(0, 0, 256, 256);
      wc.fillStyle = '#FDECEF'; wc.fillRect(0, 0, 64, 256); wc.fillRect(128, 0, 64, 256);
      const wbow = (x, y) => { wc.fillStyle = '#F4C3CF'; [-1, 1].forEach(s => { wc.beginPath(); wc.ellipse(x + s * 7, y, 7, 4.5, s * 0.4, 0, 7); wc.fill(); }); wc.beginPath(); wc.arc(x, y, 3, 0, 7); wc.fill(); };
      wbow(32, 64); wbow(160, 192); wbow(96, 128); wbow(224, 0); wbow(224, 256);
      const wT = R.tex(wcv); wT.wrapS = wT.wrapT = T.RepeatWrapping; wT.repeat.set(1.4, 1.4);
      const wallM = toon('#FFFFFF', { map: wT });
      rbox(fx, wallM, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.05);
      [-1, 1].forEach(sd => {
        rbox(fx, wallM, sd * (W / 2 + 0.1), H / 2, -D / 2, D, H, 0.2, 0.05, [0, PI / 2, 0]);
        rbox(fx, M.cream, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);                // торец разреза
        box(fx, M.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
        box(fx, M.cream, sd * (W / 2 - 0.04), H - 0.08, -D / 2, 0.1, 0.16, D);                         // карниз
      });
      box(fx, M.cream, 0, H - 0.08, -D + 0.04, W, 0.16, 0.1); box(fx, M.cream, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
      // кремовые панели до 1 м, золотой поясок и багет
      const wain = (x, z, len, ry) => {
        const q = grp(fx, x, 0, z, ry);
        rbox(q, M.cream, 0, 0.5, 0.04, len, 1.0, 0.08, 0.03);
        box(q, M.gold, 0, 1.02, 0.085, len, 0.04, 0.04); box(q, M.creamD, 0, 0.06, 0.09, len, 0.12, 0.03);
        const n = Math.max(1, Math.round(len / 0.9)), s = len / n;
        for (let i = 0; i < n; i++) box(q, M.creamD, -len / 2 + s * (i + 0.5), 0.56, 0.085, s - 0.22, 0.6, 0.012);
        box(q, M.gold, 0, 2.35, 0.03, len, 0.05, 0.05);
      };
      wain(0, -D, W, 0); wain(-W / 2, -3.12, 3.16, PI / 2); wain(W / 2, -D / 2, D, -PI / 2);
      // левая стена у двери: короткий кусок панели
      { const q = grp(fx, -W / 2, 0, -0.17, PI / 2); rbox(q, M.cream, 0, 0.5, 0.04, 0.3, 1.0, 0.08, 0.03); box(q, M.gold, 0, 1.02, 0.085, 0.3, 0.04, 0.04); box(q, M.gold, 0, 2.35, 0.03, 0.3, 0.05, 0.05); }

      /* --- дверь на улицу (левая стена) и «ВЫХОД» --- */
      { const dz = -0.95, dg = grp(fx, -W / 2 + 0.01, 0, dz, PI / 2);
        put(dg, R.extrude(R.archShape(1.18, 2.22), 0.06), M.gold, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(1.0, 2.1), 0.05), M.cherry, [0, 0, 0.06]);
        [-0.22, 0.22].forEach(x => box(dg, M.pink, x, 0.75, 0.115, 0.32, 0.7, 0.02));
        cyl(dg, M.glass, 0, 1.6, 0.12, 0.15, 0.03, [PI / 2, 0, 0]); put(dg, R.ringG(0.15, 0.025), M.gold, [0, 1.6, 0.13]);
        R.sph(dg, M.gold, 0.36, 1.0, 0.13, 0.045);
        aplane(dg, [1536, 136, 320, 96], [0, 2.52, 0.09], [0.7, 0.21, 1]);
        R.halo(g, -W / 2 + 0.25, 2.52, dz, 0.7, '#BFF0CE', 0.35);
        hit('exitDoor', -W / 2 + 0.06, 1.1, dz, 0.16, 2.2, 1.1);
      }

      /* --- зеркало: овальная золотая рама, стекло, вывеска, искорка --- */
      const ell = (rx, ry, hole) => { const s = hole ? new T.Path() : new T.Shape(); s.absellipse(0, 0, rx, ry, 0, PI * 2, !!hole, 0); return s; };
      { const mg = grp(fx, 0.6, 1.6, -D + 0.02);
        const ring = ell(0.5, 0.8); ring.holes.push(ell(0.42, 0.72, true));
        put(mg, R.extrude(ring, 0.06), M.gold, [0, 0, 0]);
        const [gcv, gc] = R.cnv(128, 256), gg = gc.createLinearGradient(0, 0, 128, 256);
        gg.addColorStop(0, '#F4F7FC'); gg.addColorStop(0.45, '#DCE5F2'); gg.addColorStop(1, '#C9D2EA'); gc.fillStyle = gg; gc.fillRect(0, 0, 128, 256);
        gc.fillStyle = 'rgba(247,201,211,.35)'; gc.beginPath(); gc.ellipse(64, 236, 70, 40, 0, 0, 7); gc.fill();
        gc.fillStyle = 'rgba(255,255,255,.7)'; gc.beginPath(); gc.moveTo(18, 120); gc.lineTo(60, 40); gc.lineTo(78, 40); gc.lineTo(36, 120); gc.closePath(); gc.fill();
        const glassG = R.keep(new T.ShapeGeometry(ell(0.43, 0.73), 28)); { const p = glassG.attributes.position, uv = glassG.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.86 + 0.5, p.getY(i) / 1.46 + 0.5); }
        put(mg, glassG, basic('#FFFFFF', { map: R.tex(gcv) }), [0, 0, 0.02]);
        const glint = basic('#FFFFFF', { transparent: true, opacity: 0.55, depthWrite: false });
        plane(mg, glint, -0.16, 0.18, 0.03, 0.06, 0.62, -0.5); plane(mg, glint, -0.04, 0.26, 0.03, 0.03, 0.34, -0.5);
        R.bowAt(mg, M.pink, M.cherry, 0, 0.86, 0.06, 1.6);
        [-1, 1].forEach(s => R.sph(mg, M.gold, s * 0.5, 0, 0.04, 0.05));
        aplane(fx, [1536, 0, 512, 128], [0.6, 2.78, -D + 0.04], [1.2, 0.3, 1]);
        hit('spot:mirror', 0.6, 1.6, -D + 0.1, 1.15, 1.75, 0.2);
      }
      const twinkle = R.halo(g, 0.38, 2.05, -D + 0.1, 0.32, '#FFFFFF', 0.0);

      /* --- стена лент: панель с катушками на колышках --- */
      const RIB = [M.cherry, M.pink, M.mint, M.lav, M.butter, M.beige, M.silver, M.powder, M.cream, M.gold, M.mint, M.pink];
      { const pg = grp(fx, -0.75, 1.5, -D + 0.02);
        rbox(pg, M.cream, 0, 0, 0.03, 1.1, 0.86, 0.05, 0.03);
        box(pg, M.gold, 0, 0.44, 0.06, 1.14, 0.04, 0.04); box(pg, M.gold, 0, -0.44, 0.06, 1.14, 0.04, 0.04);
        box(pg, M.gold, -0.56, 0, 0.06, 0.04, 0.9, 0.04); box(pg, M.gold, 0.56, 0, 0.06, 0.04, 0.9, 0.04);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
          const x = -0.39 + c * 0.26, y = 0.27 - r * 0.27, m = RIB[r * 4 + c];
          cyl(pg, M.gold, x, y + 0.075, 0.08, 0.01, 0.1, [PI / 2, 0, 0]);
          cyl(pg, m, x, y, 0.12, 0.06, 0.15, [0, 0, PI / 2]);
          [-1, 1].forEach(s => cyl(pg, M.woodD, x + s * 0.082, y, 0.12, 0.072, 0.014, [0, 0, PI / 2]));
        }
        hit('spot:ribbons', -0.75, 1.5, -D + 0.12, 1.2, 1.0, 0.25);
      }
      // концы лент, что колышутся
      const ribEnds = [[-1.14, '#C2405B'], [-0.36, '#9FD6BE']].map(([x, hex]) => {
        const pv = new T.Group(); pv.position.set(x, 1.19, -D + 0.17); g.add(pv);
        const mm = toon(hex, { side: T.DoubleSide });
        const pl = put(pv, GEO.plane, mm, [0, -0.2, 0], [0.05, 0.4, 1]); pl.castShadow = false; pl.raycast = () => {};
        return pv;
      });

      /* --- шляпная стойка: берет, шапка с двумя козырьками, клош --- */
      { const hs = grp(st, 2.5, 0, -3.9, -0.5), hf = grp(fx, 2.5, 0, -3.9, -0.5);
        cyl(hs, M.woodD, 0, 0.02, 0, 0.2, 0.04); cyl(hs, M.wood, 0, 0.9, 0, 0.026, 1.76); R.sph(hs, M.gold, 0, 1.8, 0, 0.04);
        // берет на макушке
        R.sph(hf, M.powder, 0, 1.84, 0, 0.17, 0.05, 0.17); R.sph(hf, M.pink, 0, 1.89, 0, 0.02, 0.025, 0.02);
        // рожки
        [[1.5, 0.55], [1.32, -1.6]].forEach(([y, a]) => { const ax = Math.cos(a) * 0.17, az = Math.sin(a) * 0.17; cyl(hs, M.gold, ax / 2, y, az / 2, 0.012, 0.19, [0, -a, PI / 2]); R.sph(hs, M.gold, ax, y + 0.02, az, 0.03); });
        // шапка Холмса (бежевая клетка): купол + два козырька
        { const ax = Math.cos(0.55) * 0.2, az = Math.sin(0.55) * 0.2;
          put(hf, GEO.hemi, M.beigeD, [ax, 1.55, az], [0.12, 0.1, 0.12]);
          put(hf, GEO.halfDisc, M.beigeD, [ax, 1.552, az + 0.07], [0.09, 0.012, 0.08], [0.25, 0, 0]);
          put(hf, GEO.halfDisc, M.beigeD, [ax, 1.552, az - 0.07], [0.09, 0.012, 0.08], [-0.25, PI, 0]);
          R.sph(hf, M.cherry, ax, 1.66, az, 0.02); }
        // клош: лавандовый, с вишнёвой лентой
        { const ax = Math.cos(-1.6) * 0.2, az = Math.sin(-1.6) * 0.2;
          put(hf, GEO.hemi, M.lav, [ax, 1.36, az], [0.13, 0.13, 0.13]); cyl(hf, M.lav, ax, 1.36, az, 0.18, 0.014);
          put(hf, R.ringG(0.13, 0.016), M.cherry, [ax, 1.38, az], null, [PI / 2, 0, 0]); }
        hit('spot:hats', 2.5, 1.0, -3.9, 0.62, 2.0, 0.62);
      }

      /* --- манекен в тренче с огромным карманом --- */
      { const mq = grp(st, -2.55, 0, -4.05, 0.45);
        cyl(mq, M.woodD, 0, 0.02, 0, 0.22, 0.04); cyl(mq, M.gold, 0, 0.42, 0, 0.022, 0.8);
        put(mq, R.keep(new T.CylinderGeometry(0.17, 0.25, 0.5, 18)), M.beige, [0, 1.02, 0]);
        cyl(mq, M.beige, 0, 1.3, 0, 0.15, 0.12);
        R.sph(mq, M.beige, 0, 1.46, 0, 0.2, 0.2, 0.15);
        put(mq, R.keep(new T.CapsuleGeometry(0.07, 0.28, 4, 10)), M.beige, [0, 1.58, 0], null, [0, 0, PI / 2]);
        cyl(mq, M.cream, 0, 1.72, 0, 0.045, 0.1); R.sph(mq, M.wood, 0, 1.8, 0, 0.06);
        put(mq, R.ringG(0.16, 0.025), M.beigeD, [0, 1.27, 0], [1, 1, 0.82], [PI / 2, 0, 0]);
        box(mq, M.beigeD, 0.05, 1.27, 0.14, 0.06, 0.05, 0.03);
        [-1, 1].forEach(s => { box(mq, M.beigeD, s * 0.07, 1.6, 0.11, 0.09, 0.14, 0.03, [0, 0, s * 0.5]); [1.42, 1.15].forEach(y => R.sph(mq, M.gold, s * 0.06, y, 0.17, 0.016)); });
        rbox(mq, M.beigeD, 0.09, 0.97, 0.225, 0.24, 0.26, 0.05, 0.03); box(mq, M.beige, 0.09, 1.09, 0.255, 0.25, 0.07, 0.03, [0.15, 0, 0]);
        R.sph(mq, M.gold, 0.09, 1.08, 0.275, 0.02);
        hit('spot:pockets', -2.55, 0.95, -4.05, 0.62, 1.9, 0.62);
      }

      /* --- зонтики: стойка, три сложенных, кружевной раскрытый над ними --- */
      { const ps = grp(st, 2.7, 0, -1.4), pf = grp(fx, 2.7, 0, -1.4);
        put(ps, R.keep(new T.CylinderGeometry(0.16, 0.13, 0.38, 16)), M.cream, [0, 0.19, 0]); put(ps, R.ringG(0.16, 0.018), M.gold, [0, 0.38, 0], null, [PI / 2, 0, 0]);
        [[M.cherry, -0.06, -0.05, 0.12], [M.mint, 0.06, -0.03, -0.1], [M.cream, 0, 0.07, 0.03]].forEach(([m, x, z, tilt]) => {
          const u = grp(ps, x, 0, z), uf = grp(pf, x, 0, z); u.rotation.set(tilt * 0.6, 0, tilt); uf.rotation.copy(u.rotation);
          put(uf, GEO.cone, m, [0, 0.72, 0], [0.055, 0.6, 0.055], [PI, 0, 0]);
          cyl(u, M.woodD, 0, 1.12, 0, 0.012, 0.22); put(u, R.keep(new T.TorusGeometry(0.045, 0.012, 6, 12, PI)), M.woodD, [0.045, 1.23, 0], null, [0, 0, 0]);
        });
        const op = grp(pf, 0.12, 2.5, 0.05); op.rotation.set(0.35, 0, 0.55);
        put(op, GEO.hemi, M.cream, [0, 0, 0], [0.32, 0.13, 0.32]);
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; R.sph(op, M.powder, Math.cos(a) * 0.32, -0.01, Math.sin(a) * 0.32, 0.035, 0.026, 0.035); }
        cyl(op, M.woodD, 0, -0.16, 0, 0.011, 0.36); R.sph(op, M.gold, 0, 0.14, 0, 0.022);
        hit('spot:parasols', 2.7, 1.2, -1.4, 0.62, 2.4, 0.62);
      }

      /* --- полочка с туфельками (левая стена): светлые и рубиновые --- */
      { const sh = grp(fx, -W / 2 + 0.02, 0, -2.6);
        rbox(sh, M.cream, 0.15, 1.05, 0, 0.3, 0.04, 0.85, 0.015);
        [-0.3, 0.3].forEach(z => box(sh, M.gold, 0.08, 0.96, z, 0.14, 0.14, 0.03));
        const shoe = (m, x, z) => { rbox(sh, m, x, 1.1, z, 0.15, 0.045, 0.065, 0.02); R.sph(sh, m, x + 0.07, 1.1, z, 0.04, 0.025, 0.035); cyl(sh, m, x - 0.06, 1.09, z, 0.012, 0.05); };
        [[M.silver, -0.24], [M.cherry, 0.2]].forEach(([m, z]) => { shoe(m, 0.16, z - 0.045); shoe(m, 0.16, z + 0.045); });
        hit('spot:shoes', -W / 2 + 0.2, 1.12, -2.6, 0.42, 0.45, 0.95);
      }

      /* --- шкафчик с отрезами ткани у правой стены, эскизы в рамках --- */
      { const cb = grp(st, W / 2 - 0.22, 0, -2.7);
        rbox(cb, M.cream, 0, 0.42, 0, 0.4, 0.84, 1.1, 0.04); box(cb, M.gold, -0.205, 0.62, 0, 0.01, 0.04, 0.9);
        [-0.28, 0.28].forEach(z => R.sph(cb, M.gold, -0.21, 0.5, z, 0.025));
        { const cf = grp(fx, W / 2 - 0.22, 0, -2.7); [M.pink, M.mint, M.lav, M.butter, M.beige, M.powder].forEach((m, i) => cyl(cf, m, 0, 0.84 + 0.28, -0.42 + i * 0.17, 0.07, 0.56)); }
      }
      [[W / 2 - 0.02, -2.7, -PI / 2, [1536, 256, 192, 256]], [-W / 2 + 0.02, -3.55, PI / 2, [1760, 256, 192, 256]]].forEach(([x, z, ry, rr]) => {
        const fg = grp(fx, x, 0, z, ry); rbox(fg, M.gold, 0, 1.85, 0.02, 0.5, 0.64, 0.04, 0.02); aplane(fg, rr, [0, 1.85, 0.045], [0.42, 0.56, 1]);
      });

      /* --- бра на задней стене --- */
      [-1.75, 1.75].forEach(x => {
        const sg = grp(fx, x, 0, -D + 0.02);
        box(sg, M.ink, 0, 2.05, 0.03, 0.07, 0.14, 0.05); cyl(sg, M.ink, 0, 2.08, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
        put(sg, GEO.cylLo, M.lamp, [0, 1.99, 0.26], [0.065, 0.15, 0.065]); put(sg, GEO.cone, M.pink, [0, 2.13, 0.26], [0.11, 0.09, 0.11]);
        R.halo(g, x, 2.0, -D + 0.3, 0.95, '#FFC890', 0.5);
      });

      /* --- раскройный стол: сантиметр, катушки, ножницы, игольница, отрез --- */
      { const tb = grp(st, 0.4, 0, -1.9), tf = grp(fx, 0.4, 0, -1.9);
        rbox(tb, M.wood, 0, 0.76, 0, 1.4, 0.06, 0.7, 0.025);
        [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]].forEach(([x, z]) => cyl(tb, M.woodD, x, 0.37, z, 0.03, 0.74));
        box(tb, M.woodD, 0, 0.2, 0, 1.24, 0.03, 0.5);
        plane(tf, M.powder, -0.22, 0.795, 0.02, 0.5, 0.36).rotation.set(-PI / 2, 0, 0.2);
        const tp = R.keep(new T.TorusGeometry(0.11, 0.012, 6, 24, PI * 1.6));
        put(tf, tp, M.butter, [0.35, 0.8, 0.08], null, [PI / 2, 0, 0.4]); cyl(tf, M.cherry, 0.47, 0.81, 0.12, 0.055, 0.04);
        box(tf, M.butter, 0.15, 0.795, 0.2, 0.36, 0.006, 0.03, [0, 0.3, 0]);
        [[M.lav, -0.55, -0.18], [M.mint, -0.45, -0.22], [M.cherry, -0.5, -0.1]].forEach(([m, x, z]) => { cyl(tf, m, x, 0.84, z, 0.04, 0.1); cyl(tf, M.woodD, x, 0.895, z, 0.048, 0.012); });
        R.sph(tf, M.cherry, 0.1, 0.83, -0.2, 0.07, 0.05, 0.07); [[0.08, -0.2], [0.13, -0.17], [0.1, -0.24]].forEach(([x, z]) => R.sph(tf, M.gold, x, 0.885, z, 0.012));
        [-1, 1].forEach(s => put(tf, R.ringG(0.03, 0.007), M.gold, [0.28 + s * 0.03, 0.795, -0.15], null, [PI / 2, 0, 0]));
        box(tf, M.silver, 0.36, 0.795, -0.18, 0.16, 0.006, 0.02, [0, -0.3, 0]);
        // табурет Кашемиры
        const sx = 0.9, sz = -0.4;
        cyl(tf, M.powder, sx, 0.31, sz, 0.17, 0.06); [0, 2.1, 4.2].forEach(a => cyl(tb, M.woodD, sx + Math.cos(a) * 0.11, 0.14, sz + Math.sin(a) * 0.11, 0.018, 0.28));
      }
      // низкий табурет у входа (на нём — маленький берет для кота)
      { const sg = grp(st, -0.6, 0, -1.3);
        cyl(fx, M.mint, -0.6, 0.3, -1.3, 0.16, 0.06); [0, 2.1, 4.2].forEach(a => cyl(sg, M.woodD, Math.cos(a) * 0.1, 0.14, Math.sin(a) * 0.1, 0.018, 0.27));
        hit('spot:catberet', -0.6, 0.32, -1.3, 0.46, 0.64, 0.46);
      }
      const catHere = !!R.o.catHelper;
      const stoolBeret = new T.Group(); stoolBeret.position.set(-0.6, 0.36, -1.3); stoolBeret.rotation.set(0.05, 0, -0.15); g.add(stoolBeret);
      put(stoolBeret, GEO.sph, M.powder, [0, 0.02, 0], [0.11, 0.035, 0.11]); put(stoolBeret, GEO.sphLo, M.pink, [0, 0.055, 0], [0.014, 0.018, 0.014]);
      stoolBeret.traverse(m => { if (m.isMesh) { m.castShadow = false; m.raycast = () => {}; } });
      stoolBeret.visible = catHere && !R.o.catBeret;
      // берет для кота (надевается в комнате после секретика)
      const catBeretG = new T.Group(); catBeretG.position.set(0.02, 0.12, -0.01); catBeretG.rotation.set(-0.1, 0, -0.3);
      put(catBeretG, GEO.sph, M.powder, [0, 0, 0], [0.11, 0.035, 0.11]); put(catBeretG, GEO.sphLo, M.pink, [0, 0.035, 0], [0.012, 0.016, 0.012]);
      catBeretG.traverse(m => { if (m.isMesh) m.raycast = () => {}; });

      // клубок на ковре: катается туда-обратно
      const [ycv, yc] = R.cnv(64, 64); yc.fillStyle = '#F08FA8'; yc.fillRect(0, 0, 64, 64); yc.strokeStyle = '#C2405B'; yc.lineWidth = 3;
      for (let i = -64; i < 128; i += 10) { yc.beginPath(); yc.moveTo(i, 0); yc.lineTo(i + 40, 64); yc.stroke(); }
      const yarn = put(g, GEO.sphLo, toon('#FFFFFF', { map: R.tex(ycv) }), [-0.25, 0.09, -2.55], [0.09, 0.09, 0.09]); yarn.raycast = () => {}; yarn.receiveShadow = false;

      // шапка Холмса для героини (секретик a_holm): на голову на 6 с
      const deer = new T.Group(); deer.visible = false;
      { const [ccv, cc] = R.cnv(64, 64); cc.fillStyle = '#C9B08A'; cc.fillRect(0, 0, 64, 64); cc.strokeStyle = '#8E7452'; cc.lineWidth = 3;
        for (let i = 0; i < 64; i += 16) { cc.beginPath(); cc.moveTo(i + 4, 0); cc.lineTo(i + 4, 64); cc.moveTo(0, i + 4); cc.lineTo(64, i + 4); cc.stroke(); }
        cc.strokeStyle = '#B04A4A'; cc.lineWidth = 1.5; for (let i = 0; i < 64; i += 16) { cc.beginPath(); cc.moveTo(i + 11, 0); cc.lineTo(i + 11, 64); cc.stroke(); }
        const tx = R.tex(ccv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(3, 3);
        const cm = toon('#FFFFFF', { map: tx });
        put(deer, GEO.hemi, cm, [0, 0, 0], [0.3, 0.24, 0.3]);
        put(deer, GEO.halfDisc, cm, [0, -0.01, 0.21], [0.2, 0.014, 0.17], [0.3, 0, 0]);
        put(deer, GEO.halfDisc, cm, [0, -0.01, -0.21], [0.2, 0.014, 0.17], [-0.3, PI, 0]);
        [-1, 1].forEach(s => box(deer, cm, s * 0.2, 0.17, 0, 0.1, 0.03, 0.14, [0, 0, s * 0.5]));
        R.sph(deer, M.beigeD, 0, 0.25, 0, 0.03);
        deer.traverse(m => { if (m.isMesh) { m.raycast = () => {}; m.castShadow = false; } });
      }

      /* --- овечка Кашемира на табурете, вяжет --- */
      const sheep = (R.npc.sheep || R.npc.bunny)();
      sheep.root.position.set(1.3, 0.34, -2.3); sheep.root.rotation.y = -0.75; g.add(sheep.root);

      R.bake(fx, null, { cast: false });
      R.bake(st, null, {});
      [fx, st].forEach(q => q.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));

      const S = { catBeret: false, catBeretOn: false, deer, catBeretG, stoolBeret };
      const blockers = [
        { x0: -0.35, x1: 1.15, z0: -2.3, z1: -1.5 },     // раскройный стол
        { x0: 1.1, x1: 1.55, z0: -2.55, z1: -2.05 },     // табурет Кашемиры
        { x0: 2.25, x1: 2.8, z0: -4.2, z1: -3.6 },       // шляпная стойка
        { x0: 2.48, x1: 2.95, z0: -1.65, z1: -1.15 },    // зонтики
        { x0: -2.85, x1: -2.25, z0: -4.35, z1: -3.75 },  // манекен
        { x0: -3.2, x1: -2.85, z0: -3.05, z1: -2.15 },   // полочка с туфельками
        { x0: -0.8, x1: -0.4, z0: -1.5, z1: -1.1 },      // табурет с беретом
        { x0: 2.78, x1: 3.2, z0: -3.25, z1: -2.15 },     // шкафчик с тканями
      ];
      return {
        W, D,
        bounds: { x0: -2.95, x1: 2.95, z0: -4.35, z1: -0.4 },
        exit: { x: -W / 2 + 0.45, z: -0.95 }, exitDir: [-0.9, 0],
        spawn: { x: -W / 2 + 1.6, z: -1.7 },
        cam: { x0: -1.8, x1: 1.8, z: -1.0 },
        blockers,
        catSpot: { x: -0.6, z: -2.4, ry: 0.3 },
        spots: [
          { id: 'mirror', x: 0.6, z: -3.9, act: 'Примерить', bubble: 'зеркало' },
          { id: 'ribbons', x: -0.7, z: -3.9, act: 'Смотреть', bubble: 'стена лент' },
          { id: 'hats', x: 1.8, z: -3.75, act: 'Смотреть', bubble: 'шляпы' },
          { id: 'pockets', x: -1.8, z: -3.75, act: 'Смотреть', bubble: 'манекен' },
          { id: 'parasols', x: 2.1, z: -1.4, act: 'Смотреть', bubble: 'зонтики' },
          { id: 'shoes', x: -2.45, z: -2.6, act: 'Смотреть', bubble: 'туфельки' },
          { id: 'catberet', x: 0.05, z: -0.95, act: 'Примерить коту', bubble: 'маленький берет' },
        ],
        npcs: { sheep },
        i2: S,
        tick(t, dt, c) {
          ribEnds.forEach((pv, i) => { pv.rotation.z = Math.sin(t * 1.7 + i * 1.9) * 0.16; pv.rotation.x = Math.sin(t * 1.3 + i) * 0.1; });
          const ph = (t % 8) / 8, k = ph < 0.25 ? Math.sin(ph / 0.25 * PI) : 0, dx = k * 0.2;
          yarn.position.x = -0.25 + dx; yarn.rotation.z = -dx / 0.09;
          const tw = (t % 3.2) / 3.2; twinkle.material.opacity = tw < 0.2 ? Math.sin(tw / 0.2 * PI) * 0.9 : 0; twinkle.scale.setScalar(0.2 + 0.18 * Math.sin(Math.min(1, tw / 0.2) * PI));
          if (S.catBeret && !S.catBeretOn && c && c.cat && c.cat.head) {
            const hg = c.cat.head.children.find(o => o.isGroup && o !== catBeretG); if (hg) hg.visible = false;
            c.cat.head.add(catBeretG); S.catBeretOn = true; stoolBeret.visible = false;
          }
        },
      };
    },
  });

  /* ---------- Содержимое ---------- */
  const FB = {
    BOWS: [['#F08FA8', 'розовый'], ['#FFF1E6', 'молочный'], ['#B0304A', 'вишнёвый'], ['#2E2A3B', 'чёрный'], ['#A98BE8', 'лавандовый']],
    COATS: [['#E9D4B6', 'бежевый'], ['#F2C4CE', 'пудровый'], ['#6B6F7A', 'графитовый'], ['#FFFDF9', 'молочный']],
    HAIRS: [['#4A3128', 'тёмные'], ['#1F1A1D', 'чёрные'], ['#7A4A2E', 'каштановые'], ['#D9B27A', 'светлые'], ['#F2A7C0', 'розовые']],
  };
  const KIT = () => (window.Ep1 && Ep1.kit) || {};
  const UNLOCK = [null,
    { k: 'bow', c: '#EE9A55', n: 'тыквенный' }, { k: 'coat', c: '#B0304A', n: 'вишнёвый' }, { k: 'bow', c: '#BFE6D3', n: 'мятный' },
    { k: 'coat', c: '#D9CCF4', n: 'лавандовый' }, { k: 'bow', c: '#C9CED6', n: 'жемчужный' }, { k: 'coat', c: '#3E4C72', n: 'звёздный' }];
  const unlockName = w => { const u = UNLOCK[w]; return u ? `${u.n} ${u.k === 'bow' ? 'бант' : 'тренч'}` : ''; };
  function palette(key, w) {
    const base = (KIT()[key === 'bow' ? 'BOWS' : key === 'coat' ? 'COATS' : 'HAIRS'] || FB[key === 'bow' ? 'BOWS' : key === 'coat' ? 'COATS' : 'HAIRS']).map(([c, n]) => ({ c, n }));
    if (key !== 'hair') for (let i = 1; i <= Math.min(6, w); i++) { const u = UNLOCK[i]; if (u && u.k === key && !base.some(x => x.c.toLowerCase() === u.c.toLowerCase())) base.push({ c: u.c, n: u.n, fresh: i === w }); }
    return base;
  }
  const LOOKS = new WeakMap();
  const room = ctx => (ctx.is3d && ctx.api.room) || null;
  const S2 = ctx => { const r = room(ctx); return (r && r.i2) || null; };

  Town.style(P, `
.at-fit { display: flex; flex-direction: column; gap: 2px; }
.at-oval { width: 118px; height: 156px; margin: 0 auto 4px; border-radius: 50%; border: 5px solid #E8C770; box-shadow: 0 0 0 3px #FFF4EC, 0 4px 12px rgba(58,46,63,.18);
  background: radial-gradient(120% 90% at 35% 25%, #FFFFFF 0%, #EEF2F8 45%, #DDE6F2 100%); overflow: hidden; display: grid; place-items: end center; position: relative; }
.at-oval::after { content: ""; position: absolute; left: 22%; top: 12%; width: 9px; height: 46%; border-radius: 9px; background: rgba(255,255,255,.65); transform: rotate(18deg); }
.at-oval svg { width: 96px; height: auto; display: block; margin-bottom: -10px; }
.at-row { display: flex; flex-wrap: wrap; gap: 9px; padding: 2px 0 4px; }
.at-row .swatch { width: 40px; height: 40px; position: relative; }
.at-row .swatch.fresh::after { content: "✦"; position: absolute; right: -6px; top: -8px; color: #E5A93B; font-size: 14px; font-weight: 900; text-shadow: 0 0 3px #fff; }
.at-note { font-size: 12.5px; color: var(--ink-2); font-weight: 700; text-align: center; margin: 2px 0 0; }
.modal.sheet.at-sheet { background: rgba(58,46,63,.08); }
.at-sheet .sheet-actions { flex-direction: row; }
.at-sheet .sheet-actions .btn { flex: 1 1 0; min-width: 0; }
`);

  function heroSvg(lk) { try { return Art.heroine({ bow: lk.bow, coat: lk.coat, hair: lk.hair }); } catch (e) { return ''; } }

  async function fitting(ctx) {
    const orig = ctx.look, look = { bow: orig.bow, coat: orig.coat, hair: orig.hair }, w = ctx.week;
    if (ctx.is3d) { if (ctx.api.isSitting) ctx.stand(); await ctx.api.walkTo(0.6, -3.6); ctx.api.faceCamera(); ctx.focus(0.6); }
    // в 3D зеркало — сама героиня: овал с рисунком не нужен, лист ниже и почти без затемнения, камера ставит её над листом
    const mini = ctx.is3d && typeof ctx.api.focusHeroIn === 'function';
    const row = key => palette(key, w).map(x => `<button class="swatch${look[key] && look[key].toLowerCase() === x.c.toLowerCase() ? ' on' : ''}${x.fresh ? ' fresh' : ''}" data-k="${key}" data-c="${x.c}" style="background:${x.c}" aria-label="${x.n}"></button>`).join('');
    const body = document.createElement('div'); body.className = 'at-fit';
    body.innerHTML = `${mini ? '' : `<div class="at-oval">${heroSvg(look)}</div>`}
      <div class="opt-label">Бант и берет</div><div class="at-row">${row('bow')}</div>
      <div class="opt-label">Тренч</div><div class="at-row">${row('coat')}</div>
      <div class="opt-label">Волосы</div><div class="at-row">${row('hair')}</div>
      ${UNLOCK[w] ? `<p class="at-note">✦ цвет недели: ${unlockName(w)}</p>` : ''}`;
    let r = null;
    try {
      r = await ctx.sheet({
        title: 'Примерочная', body, cls: mini ? 'at-sheet' : '',
        actions: [{ label: 'Готово', value: 'ok' }, { label: 'Как было', value: 'back', cls: 'soft' }],
        onMount(el, close, m) {
          if (mini && m) {
            try {
              const card = m.querySelector('.sheet-card'), hud = document.getElementById('hud');
              const top = hud && hud.offsetHeight ? hud.getBoundingClientRect().bottom : 0;
              ctx.api.focusHeroIn(top + 4, m.getBoundingClientRect().top + card.offsetTop - 4);
            } catch (e) { /* ушла */ }
          }
          el.addEventListener('click', e => {
            const b = e.target.closest('.swatch'); if (!b || ctx.gone) return;
            e.stopPropagation();
            const k = b.dataset.k, c = b.dataset.c;
            look[k] = c;
            el.querySelectorAll(`.swatch[data-k="${k}"]`).forEach(x => x.classList.toggle('on', x === b));
            const ov = el.querySelector('.at-oval'); if (ov) ov.innerHTML = heroSvg(look);
            try { ctx.setLook({ [k]: c }, false); ctx.haptic('select'); ctx.sfx('tap'); } catch (x) { return; }
            LOOKS.set(ctx, (LOOKS.get(ctx) || 0) + 1);
          });
        },
      });
    } finally { if (!ctx.gone && ctx.is3d) { try { ctx.release(); } catch (e) { /* ignore */ } } }
    if (r === 'ok') { ctx.setLook(look, true); await ctx.say({ who: 'sheep', text: 'Вот теперь идеально. Хотя было хорошо и до этого.' }); }
    else ctx.setLook(orig, false);
    if (ctx.catHere) await ctx.say({ who: 'cat', text: 'В зеркале какой-то кот. Симпатичный, но подозрительно похож на меня.' });
    if ((LOOKS.get(ctx) || 0) >= 5 && !ctx.has('a_show')) await ctx.say({ who: 'sheep', text: 'Пятый образ за визит! Ты не примеряешь, ты устраиваешь Неделю моды.', s: 'a_show' });
    return true;
  }

  // шапка Холмса на 6 секунд (берет героини прячем на это время)
  function wearDeer(ctx) {
    const S = S2(ctx); if (!S || !S.deer) return;
    try {
      const hh = ctx.api.heroHead(); if (!hh || !hh.parent) return;
      const beret = hh.parent.children.find(o => o.isGroup && o !== hh && Math.abs(o.position.y - 0.235) < 0.02);
      if (beret) beret.visible = false;
      S.deer.position.set(0, 0.12, -0.01); S.deer.rotation.set(-0.08, 0, 0); hh.add(S.deer); S.deer.visible = true;
      ctx.sparkle('star');
      clearTimeout(S.deerT);
      S.deerT = setTimeout(() => { S.deer.visible = false; if (beret) beret.visible = true; }, 6000);
    } catch (e) { /* ушла */ }
  }

  if (G.addSpeakers) G.addSpeakers({ sheep: { name: () => 'Кашемира', art: () => G.emojiAvatar('🐑', '#FBE1E7') } });

  Town.place({
    id: P, kind: 'new', storySafe: true,   // проверено: без спойлеров серии 1 — можно заходить во время дела
    name: 'Ателье «Бант и берет»', short: 'Ателье',
    sign: 'БАНТ и БЕРЕТ', motto: 'ателье · примерочная · зеркало',
    icon: '🎀', color: '#FBE1E7',
    street: { x: -11.0, w: 3.4, doorDx: 0, bkey: null },
    room: P, opens: 0,
    host: { who: 'sheep', npc: 'sheep' },
    greet: {
      first: 'Я Кашемира. Здесь можно передумать пять раз, и никто даже не закатит глаза.',
      again: Town.v('Вернулась? Отлично, я как раз спорила с клубком. Пока выигрывает он.', '{name}! Проходите, зеркало уже протёрто.', 'Снова к лентам? Они как раз распутались.'),
      regular: Town.v('Ленты сегодня шелковистые. Для постоянных — всегда.', 'Я отложила для вас самую мягкую ленту.', 'Петелька к петельке — а вот и вы.'),
      away: ctx => (ctx.week >= 1 ? 'Новости ателье: я связала фонарю свитер. Он мёрз.' : 'Новости ателье: распустила свитер и связала обратно. Для спокойствия.'),
    },
    bark: 'Снова вы! Ленты на месте.',
    weekly: [1, 2, 3, 4, 5, 6].reduce((o, w) => { o[w] = `В примерочной новый цвет: ${unlockName(w)}. Можешь примерить, если захочешь.`; return o; }, {}),
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      bouquet: 'Какая лента у букета! Говорю как специалист по лентам.',
      cup: 'Какао — на столик, пожалуйста. Шерсть впитывает всё, даже настроение.',
      popcorn: 'Попкорн — только не над лентами: они потом хрустят.',
      sweater: 'Кот в свитере! Какой важный. Я бы добавила помпон, но он не простит.',
    },
    spots: {
      mirror: { icon: '🪞', label: 'Зеркало', secret: 'a_show', onUse: fitting },
      ribbons: {
        icon: '🎀', label: 'Стена лент',
        lines: [{ f: 'bant' }, 'Ленты подписаны: «на выход», «на каждый день», «быть легендой».'],
      },
      hats: {
        icon: '🎩', label: 'Шляпная стойка', secret: 'a_holm',
        onUse: async ctx => {
          if (ctx.look.coat === BEIGE) {
            wearDeer(ctx);
            if (!ctx.has('a_holm')) { await ctx.say({ text: 'Бежевый тренч и шапка Холмса. Дедукция включилась автоматически.', s: 'a_holm' }); return true; }
          }
          return false;
        },
        lines: [
          { f: 'deer' },
          'Берет носят чуть набок. Ровно — только на очень серьёзном расследовании.',
          { text: 'Шапка Холмса просится к бежевому тренчу.', if: ctx => ctx.look.coat !== BEIGE },
        ],
      },
      pockets: {
        icon: '🧥', label: 'Манекен в тренче',
        lines: [
          [{ f: 'pockt' }, { who: 'sheep', text: 'Поэтому я всем пришиваю карманы. Улики должны быть под рукой.' }],
          { who: 'sheep', text: 'Ваши карманы бездонные — тут я бессильна и восхищена.', if: ctx => Array.isArray(ctx.st.stickers) && ctx.st.stickers.includes('pockets') },
          'Карман у манекена размером с блокнот. Для серьёзных улик.',
        ],
      },
      parasols: {
        icon: '☂️', label: 'Зонты',
        lines: [{ f: 'paras' }, 'Зонтик от солнца в ноябре — оптимизм в чистом виде.'],
      },
      shoes: {
        icon: '👠', label: 'Туфельки на полке',
        lines: [{ f: 'oz' }, 'Хрустальных туфелек нет: в них неудобно бегать за уликами.'],
      },
      catberet: {
        icon: '🐾', label: 'Маленький берет', secret: 'a_beret',
        when: ctx => ctx.catHere && !ctx.flag('cb'),
        onUse: async ctx => {
          ctx.flag('cb', 1);
          const S = S2(ctx); if (S) S.catBeret = true;
          ctx.sparkle('heart');
          await ctx.say({ text: 'Пирожок надел берет и заявил, что теперь художник. Первую выставку назвал «Пустая миска».', s: 'a_beret' });
          return true;
        },
      },
    },
    npc: {
      sheep: [
        { who: 'sheep', text: 'Шерсть своя, местная. Береты выходят тёплые и немного кудрявые.' },
        { who: 'sheep', f: 'cashm' },
        { who: 'sheep', text: 'Хороший бант говорит «я здесь главная» ещё до знакомства.' },
      ],
    },
    facts: {
      bant: { text: 'Слово „бант“ пришло из немецкого: Band — „лента“.' },
      deer: { text: 'У Конан Дойла нет слова „дирстокер“. Шапку с двумя козырьками Шерлоку нарисовал иллюстратор Сидни Пэджет.' },
      pockt: { text: 'Раньше дамские карманы не пришивали: их носили отдельным мешочком на завязках под юбкой.' },
      paras: { text: 'Первые зонты защищали от солнца, а не от дождя. Спрос, как видите, упал.' },
      oz: { text: 'В книге Баума туфельки были совсем другого цвета. Рубиновыми их сделали для фильма 1939 года, чтобы цвет сиял на плёнке.' },
      cashm: { text: 'Да, кашемир делают из козьего пуха. Я овечка. Я просто люблю красивое имя.' },
    },
    secrets: [
      { id: 'a_show', title: 'Показ мод', trigger: 'примерка: 5 образов за визит' },
      { id: 'a_holm', title: 'Шапка Холмса', trigger: 'шляпы в бежевом тренче' },
      { id: 'a_beret', title: 'Кот-художник', trigger: 'маленький берет, кот рядом' },
    ],
    stamp: { title: 'Ателье', icon: '🎀' },
  });
})();
