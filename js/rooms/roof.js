/* =====================================================================
   3D-КОМНАТА: подъезд дома «Крыша» (лестница без ступенек).
   Двухцветные стены (мятная панель, розовая полоска, кремовый верх),
   старая плитка «восьмиугольники», вдоль задней стены — косоуры и перила
   БЕЗ ступенек (на стене остались светлые следы ступенек), табличка
   «Ступеньки на обеде», площадка наверху с дверью «ВЫХОД НА КРЫШУ» —
   туда не попасть. Справа окно с широким подоконником (осенний вечер),
   под ним батарея и вязаный коврик, фикус; слева почтовые ящики 2×4
   с именами жильцов и дверь на улицу; под площадкой доска объявлений;
   в глубине справа дверь кв. 1 (в сюжете на ней записка). Тёплый свет:
   лампа на шнуре и два бра.
   Статика склеена в два bake (каркас лестницы с тенью / всё остальное без тени);
   надписи, коврики, ящики, дверь кв. 1 и следы ступенек — один атлас (один вызов).

   СЮЖЕТ (ep1 roof3D): точки stairs (0.6, −4.5) «Крикнуть», note (2.9, −4.6) «Прочитать»
   (записка на двери кв. 1, светится), mailboxes (−3.1, −3.4), radiator (3.0, −1.6).
   api.room.hideNote() — спрятать записку (после чтения).

   FREE MODE: (R.o.mode === 'free', место прогулки 'stairs' — движок делает алиас stairs → roof)
   - Размер 8×6, высота стен 5; дверь на улицу — левая стена, exit {x:-3.45, z:-1.2}, exitDir [-0.9, 0];
     spawn {x:-2.1, z:-1.05} (1.36 м от выхода); bounds x −3.6…3.6, z −5.1…−0.4.
   - Записки на двери нет. Точки: stairs (0.6, −4.5) «Посмотреть», echo (−0.9, −4.6) «Позвать» (под пролётом,
     меловое «Ау!» на стене), mail (−3.1, −3.4) «Прочитать», board (−2.7, −4.8) «Прочитать» (доска под площадкой),
     radiator (3.0, −1.6) «Погреться», window (3.0, −2.75) «Выглянуть». У каждой точки — невидимая «ловушка тапа».
   - Жители: npcs.pigeons — два голубя на подоконнике (составной объект: root — якорь над ними с ловушкой тапа, hop/anim — обоим);
     тап по любому из них или по ловушке над ними → onNpc('pigeons').
   - catSpot {x:3.5, z:-2.35} — вязаный коврик у батареи под окном (кот в движке всегда на полу).
   - api.room.paintBoard(text) — перерисовать карточку на доске объявлений (объявление недели);
     api.room.popMail() — открыть дверцу ящика «Ступеньки» (там письма); api.room.closeMail();
     api.room.echo(text) — слово эха всплывает вверх по пролёту и тает.
   - Блокеры: низ пролёта и столб площадки, фикус (3.25…3.9, −4.0…−3.4), подоконник с батареей (3.45…4, −3.05…−1.35).
   ===================================================================== */
(function () {
  if (!window.City3D || !City3D.registerRoom) return;
  City3D.registerRoom('roof', {
    look: { sky: '#FFF1E6', gnd: '#B49C8C', hi: 0.64, sun: '#FFE2C4', si: 0.5, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #4E4A70 0%, #282438 72%)', rim: ['#FFE0C8', 0.22], fog: '#282438' },
    cam: { portrait: { dx: 0, y: 4.0, dz: 5.5, ly: 1.1, lz: -3.1, fov: 57 }, landscape: { dx: 0.2, y: 4.0, dz: 7.6, ly: 1.9, lz: -2.6, fov: 48 } },
    build(R) {
      const { T, PI, group: g, put, box, sphS, cyl, rbox, plane, toon, GEO } = R;
      const FREE = R.o.mode === 'free';
      const W = 8, D = 6, H = 5.0;
      const glow = (c, e, i, x) => toon(c, Object.assign({ emissive: new T.Color(e), emissiveIntensity: i }, x || {}));
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const addM = (map, c, op) => basic(c || '#FFFFFF', { map, transparent: true, opacity: op === undefined ? 1 : op, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const hitM = basic('#FFFFFF', { visible: false });
      // близкие цвета — общими материалами: после склейки каждый материал = один вызов отрисовки
      const M = {
        cream: toon('#FFF6E8'), wood: toon('#C9946C'), woodD: toon('#9C6D50'), steel: toon('#8FA4C4'), ink: toon('#5B4A63'),
        pink: toon('#F2A9B8'), leaf: toon('#7FB07A'), leafD: toon('#5E9A6A'),
        brass: glow('#FFD45E', '#C9A040', 0.22), lamp: glow('#FFE9B8', '#FFC46B', 0.95),
      };
      const st = new T.Group(); g.add(st);   // каркас лестницы: с тенью
      const dc = new T.Group(); g.add(dc);   // всё прочее статичное: без тени
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (par, x, y, z, w, h, d, r) => { const m = put(par, GEO.box, hitM, [x, y, z], [w, h, d], r); m.castShadow = false; m.receiveShadow = false; return m; };

      /* ---------- атлас: надписи, коврики, ящики, дверь кв. 1, следы ступенек ---------- */
      const AW = 1024, [acv, ac] = R.cnv(AW, AW);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv), alphaTest: 0.5 });
      const aplane = (par, [sx, sy, sw, sh], p, s, r) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / AW, u1 = (sx + sw) / AW, v0 = 1 - (sy + sh) / AW, v1 = 1 - sy / AW;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]); const m = put(par, ge, atlasM, p, s, r); m.castShadow = false; return m;
      };
      const RG = {
        sign: [0, 0, 512, 200], roofPlate: [512, 0, 512, 200], exit: [0, 206, 320, 96], mat: [326, 206, 256, 144], rug: [588, 206, 256, 256],
        door1: [850, 206, 174, 348], mail: [0, 360, 512, 256], mailDoor: [588, 470, 128, 128], note: [724, 470, 120, 100], decal: [0, 620, 532, 404], floorNo: [560, 640, 200, 200],
      };
      const at = ([x, y], fn) => { ac.save(); ac.translate(x, y); fn(ac); ac.restore(); };
      const CH = '#C2405B';
      // «СТУПЕНЬКИ НА ОБЕДЕ» — вилка и ложка по бокам
      at(RG.sign, c => {
        c.fillStyle = '#FFFDF6'; R.rrect(c, 4, 4, 504, 192, 26); c.fill();
        c.strokeStyle = CH; c.lineWidth = 10; R.rrect(c, 14, 14, 484, 172, 18); c.stroke();
        R.text(c, 'СТУПЕНЬКИ', 256, 72, 56, CH, { max: 340 }); R.text(c, 'НА ОБЕДЕ', 256, 134, 56, CH, { max: 340 });
        c.strokeStyle = CH; c.lineCap = 'round'; c.lineWidth = 7;
        [[-10, 0], [0, 0], [10, 0]].forEach(([dx]) => { c.beginPath(); c.moveTo(56 + dx, 58); c.lineTo(56 + dx, 88); c.stroke(); });
        c.beginPath(); c.moveTo(46, 88); c.quadraticCurveTo(56, 104, 66, 88); c.stroke(); c.beginPath(); c.moveTo(56, 98); c.lineTo(56, 146); c.stroke();
        c.fillStyle = CH; c.beginPath(); c.ellipse(456, 76, 14, 20, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(456, 92); c.lineTo(456, 146); c.stroke();
      });
      at(RG.roofPlate, c => { c.drawImage(R.signs.exit, 0, 0, 512, 200); });
      at(RG.exit, c => { c.fillStyle = '#3F4A66'; R.rrect(c, 0, 0, 320, 96, 18); c.fill(); R.text(c, 'ВЫХОД', 160, 50, 58, '#BFF0CE'); });
      at(RG.mat, c => { c.drawImage(R.signs.mat, 0, 0, 256, 144); });
      // вязаный коврик кота: кольца
      at(RG.rug, c => {
        ['#F2A9B8', '#FFF6E8', '#BFE6D3', '#FFF6E8', '#F7C9D3', '#FFE7A8'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(128, 128, 124 - i * 20, 0, 7); c.fill(); });
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; for (let r = 18; r < 124; r += 9) { c.setLineDash([5, 6]); c.beginPath(); c.arc(128, 128, r, 0, 7); c.stroke(); } c.setLineDash([]);
      });
      // дверь кв. 1: стёганая обивка с латунными гвоздиками, номер и глазок
      at(RG.door1, c => {
        const w = 174, h = 348;
        c.fillStyle = '#B8697D'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#C97A8D'; R.rrect(c, 10, 10, w - 20, h - 20, 10); c.fill();
        c.strokeStyle = 'rgba(120,50,70,.35)'; c.lineWidth = 2;
        for (let i = -6; i < 12; i++) { c.beginPath(); c.moveTo(10, 10 + i * 40); c.lineTo(w - 10, 10 + i * 40 + (w - 20)); c.stroke(); c.beginPath(); c.moveTo(w - 10, 10 + i * 40); c.lineTo(10, 10 + i * 40 + (w - 20)); c.stroke(); }
        c.fillStyle = '#F4D27A';
        for (let y = 30; y < h - 12; y += 40) for (let x = 30; x < w - 12; x += 40) { c.beginPath(); c.arc(x - 10 + 10, y, 3.4, 0, 7); c.fill(); }
        for (let y = 10; y < h; y += 14) { c.beginPath(); c.arc(8, y, 2.6, 0, 7); c.fill(); c.beginPath(); c.arc(w - 8, y, 2.6, 0, 7); c.fill(); }
        c.fillStyle = '#E8C770'; R.rrect(c, w / 2 - 22, 40, 44, 34, 6); c.fill(); R.text(c, '1', w / 2, 58, 26, '#5B4A63');
        c.fillStyle = '#3F3550'; c.beginPath(); c.arc(w / 2, 108, 6, 0, 7); c.fill(); c.fillStyle = '#E8C770'; c.beginPath(); c.arc(w / 2, 108, 3, 0, 7); c.fill();
      });
      // почтовые ящики 2×4: цветные дверцы, щель, номер и карточка с именем
      const MAILN = ['Голуби', 'Эхо', 'Енот', 'Финалыч', 'Ёжик', 'Сова', 'Белка', 'Ступеньки'];
      const MAILC = ['#F7C9D3', '#BFE6D3', '#D9CCF4', '#FFE7A8', '#FFD9C2', '#C9DDF2', '#F2A9B8', '#E7EFD0'];
      const mailDoor = (c, i, x, y) => {
        c.fillStyle = 'rgba(70,60,90,.25)'; R.rrect(c, x + 6, y + 8, 116, 116, 12); c.fill();
        c.fillStyle = MAILC[i]; R.rrect(c, x + 6, y + 4, 116, 116, 12); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; R.rrect(c, x + 12, y + 9, 104, 8, 4); c.fill();
        c.fillStyle = '#4A3F5C'; R.rrect(c, x + 26, y + 24, 76, 9, 4); c.fill();
        c.fillStyle = '#FFFDF6'; R.rrect(c, x + 14, y + 46, 100, 34, 6); c.fill(); c.strokeStyle = 'rgba(90,74,99,.35)'; c.lineWidth = 2; R.rrect(c, x + 14, y + 46, 100, 34, 6); c.stroke();
        R.text(c, MAILN[i], x + 64, y + 64, 26, '#5B4A63', { f: 'Caveat', w: 700, max: 92 });
        c.fillStyle = '#E8C770'; c.beginPath(); c.arc(x + 100, y + 100, 7, 0, 7); c.fill();
        R.text(c, String(i + 1), x + 28, y + 101, 22, '#5B4A63', { w: 800 });
        if (i === 4) {   // марка-сувенир «чёрный пенни» на дверце (факт penny)
          c.fillStyle = '#FFFDF6'; c.fillRect(x + 50, y + 86, 30, 30);
          c.fillStyle = '#2E2A3B'; c.fillRect(x + 53, y + 89, 24, 24);
          c.fillStyle = '#E8E2EE'; c.beginPath(); c.ellipse(x + 65, y + 100, 6, 8, 0, 0, 7); c.fill();
          c.fillStyle = '#FFFDF6'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 52 + k * 6.5, y + 86, 1.6, 0, 7); c.fill(); c.beginPath(); c.arc(x + 52 + k * 6.5, y + 116, 1.6, 0, 7); c.fill(); }
        }
      };
      at(RG.mail, c => {
        c.fillStyle = '#7F93B5'; c.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 8; i++) {
          const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
          if (i === 7) {   // ящик «Ступеньки»: внутри — письма (дверца — отдельная, открывается)
            c.fillStyle = '#3F3550'; R.rrect(c, x + 8, y + 6, 112, 114, 10); c.fill();
            [[18, 36, -0.12, '#FFFDF6'], [30, 52, 0.1, '#FFF1D6'], [16, 70, -0.04, '#FFFDF6']].forEach(([lx, ly, a, col]) => {
              c.save(); c.translate(x + lx + 46, y + ly + 18); c.rotate(a); c.fillStyle = col; c.fillRect(-46, -18, 92, 36);
              c.strokeStyle = '#E3CDB0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-46, -18); c.lineTo(0, 4); c.lineTo(46, -18); c.stroke();
              c.fillStyle = CH; c.beginPath(); c.arc(0, 4, 5, 0, 7); c.fill(); c.restore();
            });
          } else mailDoor(c, i, x, y);
        }
        // из ящика №7 торчит открытка с котиком
        c.save(); c.translate(256 + 64, 128 + 26); c.rotate(-0.08); c.fillStyle = '#FFFDF6'; c.fillRect(-30, -22, 60, 26); c.fillStyle = '#F2A9B8'; c.fillRect(-26, -18, 52, 18);
        c.fillStyle = '#FFFDF6'; c.beginPath(); c.arc(0, -9, 6, 0, 7); c.fill(); c.beginPath(); c.moveTo(-6, -13); c.lineTo(-3, -19); c.lineTo(-1, -13); c.fill(); c.beginPath(); c.moveTo(6, -13); c.lineTo(3, -19); c.lineTo(1, -13); c.fill(); c.restore();
      });
      at(RG.mailDoor, c => mailDoor(c, 7, 0, 0));
      // записка вора (только сюжет): строчки и чашечка-подпись
      if (!FREE) at(RG.note, c => {
        c.fillStyle = '#FFFBF0'; R.rrect(c, 2, 2, 116, 96, 6); c.fill(); c.strokeStyle = '#EADBC0'; c.lineWidth = 2; R.rrect(c, 2, 2, 116, 96, 6); c.stroke();
        c.strokeStyle = '#3E4C7A'; c.lineWidth = 3; c.lineCap = 'round';
        [[12, 70, 20], [12, 104, 36], [12, 96, 52], [12, 60, 68]].forEach(([x0, x1, y], k) => { c.beginPath(); for (let x = x0; x <= x1; x += 3) { const yy = y + Math.sin(x * 0.2 + k) * 2; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); });
        c.strokeStyle = '#3B2F4F'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(78, 70); c.lineTo(80, 86); c.lineTo(96, 86); c.lineTo(98, 70); c.closePath(); c.stroke();
        c.beginPath(); c.arc(100, 77, 5, -1.4, 1.4); c.stroke(); c.beginPath(); c.moveTo(74, 90); c.lineTo(102, 90); c.stroke();
      });
      // следы ушедших ступенек на задней стене и меловое «Ау!» под пролётом
      const SX0 = 1.75, SX1 = -1.45, LY = 2.75, NST = 9;   // пролёт: низ справа, верх (площадка) слева
      const DX0 = -1.9, DX1 = 1.9, DYM = 2.88, PPM = 140;   // 532×404 px
      at(RG.decal, c => {
        const X = x => (x - DX0) * PPM, Y = y => (DYM - y) * PPM, r = (SX0 - SX1) / NST, h = LY / NST;
        for (let i = 0; i < NST; i++) {
          const xa = SX0 - i * r, xb = SX0 - (i + 1) * r, ya = i * h, yb = (i + 1) * h;
          c.fillStyle = '#FCE3DD'; c.beginPath(); c.moveTo(X(xa) + 4, Y(ya) - 2); c.lineTo(X(xa) + 4, Y(yb) - 4); c.lineTo(X(xb) - 2, Y(yb) - 4); c.closePath(); c.fill();
          c.strokeStyle = '#D98A9A'; c.lineWidth = 4; c.setLineDash([10, 7]);
          c.beginPath(); c.moveTo(X(xa) + 4, Y(ya) - 2); c.lineTo(X(xa) + 4, Y(yb) - 4); c.lineTo(X(xb) - 2, Y(yb) - 4); c.stroke(); c.setLineDash([]);
        }
        c.save(); c.translate(X(-1.0), Y(1.2)); c.rotate(-0.12);
        R.text(c, 'Ау!', 0, 0, 64, '#FFFFFF', { f: 'Caveat', w: 700 });
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; c.lineCap = 'round';
        [34, 50].forEach(rr => { c.beginPath(); c.arc(30, -6, rr, -0.9, -0.15); c.stroke(); });
        c.restore();
      });

      // номер этажа, нарисованный по трафарету
      at(RG.floorNo, c => {
        c.fillStyle = '#FFFDF6'; c.beginPath(); c.arc(100, 100, 96, 0, 7); c.fill();
        c.strokeStyle = '#8FC0B0'; c.lineWidth = 10; c.beginPath(); c.arc(100, 100, 84, 0, 7); c.stroke();
        R.text(c, '1', 100, 88, 104, '#C2405B', { f: 'Comfortaa', w: 700 }); R.text(c, 'ЭТАЖ', 100, 152, 30, '#5B4A63', { w: 900 });
      });
      /* ---------- пол: плитка «восьмиугольники с ромбиками» ---------- */
      { const [fcv, fc] = R.cnv(256, 256), q = R.rng(7);
        fc.fillStyle = '#E2D2C2'; fc.fillRect(0, 0, 256, 256);
        const oct = (cx, cy, s, col) => { const k = s * 0.29; fc.fillStyle = col; fc.beginPath(); [[-s + k, -s], [s - k, -s], [s, -s + k], [s, s - k], [s - k, s], [-s + k, s], [-s, s - k], [-s, -s + k]].forEach(([x, y], i) => (i ? fc.lineTo(cx + x, cy + y) : fc.moveTo(cx + x, cy + y))); fc.closePath(); fc.fill(); };
        [[64, 64], [192, 64], [64, 192], [192, 192]].forEach(([x, y], i) => oct(x, y, 61, i % 3 ? '#F4E9DB' : '#F1E3D2'));
        const dia = (x, y, s, col) => { fc.fillStyle = col; fc.beginPath(); fc.moveTo(x, y - s); fc.lineTo(x + s, y); fc.lineTo(x, y + s); fc.lineTo(x - s, y); fc.closePath(); fc.fill(); };
        [[0, 0], [128, 0], [256, 0], [0, 128], [128, 128], [256, 128], [0, 256], [128, 256], [256, 256]].forEach(([x, y], i) => dia(x, y, 16, i % 2 ? '#A9D0C2' : '#EDB2BA'));
        for (let i = 0; i < 70; i++) { fc.fillStyle = `rgba(255,255,255,${0.12 + q() * 0.18})`; fc.beginPath(); fc.arc(q() * 256, q() * 256, 1 + q() * 2, 0, 7); fc.fill(); }
        const ft = R.tex(fcv); ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(8.4, 6.2);
        box(dc, toon('#FFFFFF', { map: ft }), 0, -0.06, -D / 2, W + 0.4, 0.12, D + 0.2);
      }

      /* ---------- стены: мятная панель, розовая полоска, кремовый верх ---------- */
      { const [wcv, wc] = R.cnv(32, 512), split = Math.round(512 * (1 - 1.4 / H)), q = R.rng(3);
        wc.fillStyle = '#FFF3E2'; wc.fillRect(0, 0, 32, 512);
        wc.fillStyle = '#A8D3C3'; wc.fillRect(0, split, 32, 512 - split);
        wc.fillStyle = '#E8A3B0'; wc.fillRect(0, split - 7, 32, 7);
        wc.fillStyle = '#FFF9F0'; wc.fillRect(0, split - 9, 32, 2);
        for (let i = 0; i < 40; i++) { wc.fillStyle = `rgba(255,255,255,${0.08 + q() * 0.1})`; wc.fillRect(q() * 32, q() * split, 2, 4 + q() * 8); }
        const wallM = toon('#FFFFFF', { map: R.tex(wcv) });
        box(dc, wallM, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2);
        [-1, 1].forEach(sd => {
          box(dc, wallM, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D);
          rbox(dc, M.cream, sd * (W / 2 + 0.1), H / 2, -0.02, 0.3, H + 0.04, 0.08, 0.03);                 // торец разреза
          box(dc, M.cream, sd * (W / 2 - 0.04), H - 0.08, -D / 2, 0.1, 0.16, D);                          // карниз
          box(dc, M.cream, sd * (W / 2 + 0.1), H + 0.03, -D / 2 - 0.05, 0.3, 0.06, D + 0.1);
          box(dc, M.woodD, sd * (W / 2 - 0.02), 0.06, -D / 2, 0.05, 0.12, D);                           // плинтус
        });
        box(dc, M.cream, 0, H - 0.08, -D + 0.04, W, 0.16, 0.1); box(dc, M.cream, 0, H + 0.03, -D - 0.1, W + 0.5, 0.06, 0.3);
        box(dc, M.woodD, 0, 0.06, -D + 0.02, W, 0.12, 0.05);
      }
      aplane(dc, RG.decal, [(DX0 + DX1) / 2, DYM / 2, -D + 0.015], [DX1 - DX0, DYM, 1]).receiveShadow = true;
      aplane(dc, RG.floorNo, [1.55, 3.3, -D + 0.015], [0.5, 0.5, 1]);

      /* ---------- лестница без ступенек: косоуры, крепления, балясины, перила ---------- */
      const ang = Math.atan2(LY, SX0 - SX1), cs = Math.cos(ang), sn = Math.sin(ang), LEN = Math.hypot(SX0 - SX1, LY);
      const pitchY = x => (SX0 - x) * Math.tan(ang);   // высота линии марша над полом
      const ZF = -5.0, ZB = -5.95;                      // передний и задний косоур
      [ZF, ZB].forEach(z => rbox(st, M.steel, (SX0 + SX1) / 2 + 0.08 * sn, LY / 2 - 0.08 * cs, z, LEN + 0.5, 0.24, 0.07, 0.025, [0, 0, -ang]));
      // крепления, на которых раньше лежали ступеньки (видны между косоурами)
      for (let i = 0; i < NST; i++) {
        const x = SX0 - (i + 0.5) * (SX0 - SX1) / NST, y = pitchY(x) + 0.02;
        box(st, M.steel, x, y, ZB + 0.07, 0.16, 0.03, 0.08); box(st, M.steel, x, y, ZF - 0.07, 0.16, 0.03, 0.08);
        sphS(dc, M.brass, x, y + 0.02, ZB + 0.1, 0.014);
      }
      // балясины и поручень вдоль марша
      for (let i = 0; i < 8; i++) { const x = SX0 - 0.15 - i * (SX0 - SX1 - 0.1) / 7.6, y0 = pitchY(x); cyl(st, M.steel, x, y0 + 0.45, ZF, 0.016, 0.9); }
      { const xa = SX0 + 0.12, xb = SX1 - 0.02, ya = pitchY(xa) + 0.92, yb = pitchY(xb) + 0.92, L2 = Math.hypot(xa - xb, ya - yb);
        cyl(st, M.wood, (xa + xb) / 2, (ya + yb) / 2, ZF, 0.045, L2, [0, 0, PI / 2 - ang]); }
      // столбик внизу марша с шариком
      rbox(st, M.wood, SX0 + 0.14, 0.5, ZF, 0.13, 1.0, 0.13, 0.03); sphS(st, M.cream, SX0 + 0.14, 1.06, ZF, 0.085);
      cyl(dc, M.cream, SX0 + 0.14, 0.97, ZF, 0.085, 0.04);
      // площадка наверху: плита, перила вдоль края, столб
      rbox(st, M.cream, (-W / 2 + SX1 + 0.05) / 2, LY - 0.09, -5.475, SX1 + 0.05 + W / 2, 0.18, 1.05, 0.03);
      box(dc, M.woodD, (-W / 2 + SX1 + 0.05) / 2, LY + 0.01, -4.96, SX1 + 0.05 + W / 2, 0.035, 0.05);
      for (let x = SX1 - 0.05; x > -W / 2 + 0.1; x -= 0.32) cyl(dc, M.steel, x, LY + 0.45, -4.98, 0.016, 0.9);   // перила площадки — без тени (иначе полоса тени на стене)
      cyl(dc, M.wood, (-W / 2 + SX1) / 2, LY + 0.92, -4.98, 0.045, SX1 + W / 2, [0, 0, PI / 2]);
      cyl(st, M.cream, SX1 + 0.02, LY / 2, -5.0, 0.07, LY);
      // табличка «Ступеньки на обеде» висит на верёвочках под поручнем
      { const sx = 0.95, sy = 1.18, sg = grp(dc, sx, sy, ZF + 0.05); sg.rotation.z = 0.04;
        rbox(sg, M.cream, 0, 0, -0.01, 0.66, 0.27, 0.02, 0.012); aplane(sg, RG.sign, [0, 0, 0.002], [0.64, 0.25, 1]);
        [-0.24, 0.24].forEach(dx => { const top = pitchY(sx + dx) + 0.92 - sy; box(sg, M.ink, dx, (0.12 + top) / 2, -0.005, 0.008, top - 0.12, 0.008); }); }

      /* ---------- дверь «ВЫХОД НА КРЫШУ» на площадке (туда не попасть) ---------- */
      { const rd = grp(dc, -2.75, LY, -D + 0.01);
        [-1, 1].forEach(sd => box(rd, M.cream, sd * 0.53, 0.88, 0.03, 0.1, 1.82, 0.06)); box(rd, M.cream, 0, 1.82, 0.03, 1.16, 0.1, 0.06);
        box(rd, M.steel, 0, 0.86, 0.04, 0.96, 1.72, 0.05);
        [[0, 0.52], [0, 1.16]].forEach(([x, y]) => box(rd, M.cream, x, y, 0.07, 0.72, 0.012, 0.01));
        rbox(rd, M.cream, 0, 1.32, 0.07, 0.7, 0.29, 0.02, 0.012); aplane(rd, RG.roofPlate, [0, 1.32, 0.082], [0.66, 0.26, 1]);
        sphS(rd, M.brass, 0.36, 0.86, 0.1, 0.04); box(rd, M.brass, 0.36, 0.78, 0.075, 0.05, 0.1, 0.02);
        // горшок с плющом у двери, плети свисают с края площадки
        cyl(rd, M.pink, -0.95, 0.13, 0.55, 0.13, 0.26); R.put(rd, R.blobGeo, M.leaf, [-0.95, 0.33, 0.55], [0.17, 0.12, 0.15]);
        for (let i = 0; i < 7; i++) sphS(rd, i % 2 ? M.leaf : M.leafD, -0.75 + Math.sin(i * 1.9) * 0.08, 0.05 - i * 0.12, 1.06, 0.05, 0.045, 0.035); }
      // бра у двери наверху
      const sconce = (par, x, y) => { box(par, M.ink, x, y, 0.03, 0.07, 0.14, 0.05); cyl(par, M.ink, x, y + 0.03, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
        put(par, GEO.cylLo, M.lamp, [x, y - 0.06, 0.26], [0.065, 0.15, 0.065]); put(par, GEO.cone, M.pink, [x, y + 0.07, 0.26], [0.11, 0.09, 0.11]); sphS(par, M.ink, x, y + 0.13, 0.26, 0.02); };
      sconce(grp(dc, -1.85, 0, -D + 0.01), 0, LY + 1.55);
      R.halo(g, -1.85, LY + 1.5, -D + 0.3, 1.0, '#FFC890', 0.5);

      /* ---------- вид за окнами: осенний вечер, крыши, фонарь, рыжее дерево ---------- */
      const [ocv, oc] = R.cnv(256, 256);
      { const gr = oc.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5E5B92'); gr.addColorStop(0.45, '#9C87B8'); gr.addColorStop(0.78, '#EDB3A3'); gr.addColorStop(1, '#F6CBA8');
        oc.fillStyle = gr; oc.fillRect(0, 0, 256, 256);
        const q = R.rng(21); oc.fillStyle = '#FFF6E0';
        for (let i = 0; i < 16; i++) { oc.globalAlpha = 0.4 + q() * 0.5; oc.beginPath(); oc.arc(q() * 256, q() * 110, 0.8 + q() * 1.4, 0, 7); oc.fill(); }
        oc.globalAlpha = 1; oc.fillStyle = 'rgba(255,214,214,.55)'; [[70, 92, 30], [100, 86, 22], [180, 70, 26], [206, 76, 18]].forEach(([x, y, r]) => { oc.beginPath(); oc.ellipse(x, y, r, r * 0.45, 0, 0, 7); oc.fill(); });
        oc.fillStyle = '#56537E';
        [[0, 170, 70], [60, 182, 56], [110, 160, 60], [168, 176, 52], [214, 166, 46]].forEach(([x, y, w]) => { oc.fillRect(x, y, w, 256 - y); oc.beginPath(); oc.moveTo(x - 4, y); oc.lineTo(x + w / 2, y - 22); oc.lineTo(x + w + 4, y); oc.fill(); });
        oc.fillStyle = '#FFE3A8'; [[14, 190], [36, 214], [76, 200], [124, 182], [140, 210], [182, 196], [228, 186], [232, 216]].forEach(([x, y]) => oc.fillRect(x, y, 9, 11));
        oc.fillStyle = '#6E4A4A'; oc.fillRect(32, 150, 7, 106);
        [['#E8955A', 30, 132, 34], ['#E07A5F', 50, 120, 26], ['#EDBB5A', 18, 112, 24], ['#E8955A', 42, 100, 20]].forEach(([col, x, y, r]) => { oc.fillStyle = col; oc.beginPath(); oc.arc(x, y, r, 0, 7); oc.fill(); });
        const lg = oc.createRadialGradient(196, 150, 0, 196, 150, 30); lg.addColorStop(0, 'rgba(255,236,180,1)'); lg.addColorStop(1, 'rgba(255,220,160,0)'); oc.fillStyle = lg; oc.fillRect(160, 116, 72, 72);
        oc.fillStyle = '#3F3A5A'; oc.fillRect(195, 152, 3, 104);
        oc.fillStyle = '#E8955A'; [[96, 120], [140, 100], [150, 150], [86, 160]].forEach(([x, y], i) => { oc.save(); oc.translate(x, y); oc.rotate(i); oc.beginPath(); oc.ellipse(0, 0, 4, 2, 0, 0, 7); oc.fill(); oc.restore(); });
      }
      const outM = basic('#FFFFFF', { map: R.tex(ocv), fog: false });
      /* ---------- дверь кв. 1 в глубине справа, коврик «привет», окно над ней ---------- */
      const DX = 2.9;
      { const d1 = grp(dc, DX, 0, -D + 0.01);
        [-1, 1].forEach(sd => box(d1, M.cream, sd * 0.53, 1.1, 0.035, 0.11, 2.2, 0.07)); box(d1, M.cream, 0, 2.2, 0.035, 1.17, 0.12, 0.07);
        box(d1, M.woodD, 0, 1.05, 0.03, 0.97, 2.1, 0.05);
        aplane(d1, RG.door1, [0, 1.05, 0.058], [0.95, 2.08, 1]);
        sphS(d1, M.brass, -0.34, 1.0, 0.09, 0.035); box(d1, M.brass, -0.34, 0.92, 0.07, 0.04, 0.12, 0.02);
        aplane(d1, RG.mat, [0, 0.006, 0.42], [0.8, 0.45, 1], [-PI / 2, 0, 0]).receiveShadow = true;
        R.windowF(d1, M.cream, outM, 0, 3.75, 0.95, 1.15, { cross: true }); }


      /* ---------- справа: окно с широким подоконником, батарея, коврик, фикус ---------- */
      const WZ = -2.2;
      { const wg = grp(dc, W / 2 - 0.005, 0, WZ, -PI / 2);
        R.windowF(wg, M.cream, outM, 0, 2.0, 1.4, 1.45, { cross: true, sill: false });
        R.curtains(wg, M.pink, 0, 2.0, 1.4, 1.45);
        rbox(wg, M.cream, 0, 1.2, 0.25, 1.75, 0.08, 0.52, 0.03); box(wg, M.cream, 0, 1.11, 0.04, 1.55, 0.1, 0.04);
        // батарея: секции, трубы, вентиль
        for (let i = 0; i < 9; i++) rbox(wg, M.cream, -0.52 + i * 0.13, 0.5, 0.12, 0.085, 0.6, 0.15, 0.03);
        [0.76, 0.22].forEach(y => cyl(wg, M.cream, 0, y, 0.12, 0.028, 1.16, [0, 0, PI / 2]));
        [-0.62, 0.62].forEach(x => cyl(wg, M.cream, x, 0.1, 0.12, 0.022, 0.24));
        sphS(wg, M.brass, 0.66, 0.76, 0.12, 0.04); cyl(wg, M.brass, 0.7, 0.76, 0.12, 0.05, 0.02, [0, 0, PI / 2]);
        // горшочек с цветком на дальнем конце подоконника
        cyl(wg, M.pink, 0.66, 1.31, 0.3, 0.07, 0.14); R.put(wg, R.blobGeo, M.leaf, [0.66, 1.43, 0.3], [0.09, 0.07, 0.09]);
        [[0.62, 1.49, 0.33], [0.7, 1.5, 0.27], [0.66, 1.52, 0.36]].forEach(p => sphS(wg, M.brass, p[0], p[1], p[2], 0.025)); }
      R.halo(g, W / 2 - 0.35, 2.0, WZ, 1.5, '#FFD2B0', 0.3);
      aplane(dc, RG.rug, [3.48, 0.007, -2.3], [0.7, 0.7, 1], [-PI / 2, 0, 0]).receiveShadow = true;
      { const fx = 3.55, fz = -3.7;
        put(dc, GEO.pot, M.pink, [fx, 0.21, fz], [0.22, 0.42, 0.22]); cyl(dc, M.woodD, fx, 0.43, fz, 0.19, 0.02);
        cyl(dc, M.woodD, fx, 0.75, fz, 0.025, 0.7);
        [[0, 0.95, 0, 0.27, 0.22], [-0.16, 1.18, 0.05, 0.22, 0.2], [0.15, 1.3, -0.04, 0.22, 0.22], [0.0, 1.52, 0.04, 0.18, 0.17], [-0.08, 0.76, 0.17, 0.2, 0.13], [0.12, 0.82, -0.12, 0.17, 0.12]]
          .forEach(([x, y, z, s, sy], i) => put(dc, R.blobGeo, i % 2 ? M.leafD : M.leaf, [fx + x, y, fz + z], [s, sy, s])); }

      /* ---------- слева: почтовые ящики 2×4, бра, дверь на улицу ---------- */
      const MZ = -3.4;
      const mg = grp(dc, -W / 2 + 0.005, 0, MZ, PI / 2);
      box(mg, M.steel, 0, 1.42, 0.13, 1.66, 0.86, 0.26);
      aplane(mg, RG.mail, [0, 1.42, 0.262], [1.6, 0.8, 1]);
      rbox(mg, M.cream, 0, 1.88, 0.15, 1.76, 0.06, 0.32, 0.02);
      [-0.6, 0.6].forEach(x => box(mg, M.ink, x, 0.98, 0.05, 0.04, 0.1, 0.06));
      // дверца ящика «Ступеньки» — отдельно, на петле (popMail)
      const mH = grp(g, -W / 2 + 0.005, 0, MZ, PI / 2);
      const hinge = new T.Group(); hinge.position.set(0.4 + 0.0125, 1.22 - 0.005, 0.27); mH.add(hinge);
      { const dm = aplane(hinge, RG.mailDoor, [0.175, 0, 0.002], [0.35, 0.35, 1]); dm.receiveShadow = false; }
      sconce(grp(dc, -W / 2 + 0.01, 0, -2.25, PI / 2), 0, 2.7);
      R.halo(g, -W / 2 + 0.3, 2.66, -2.25, 1.0, '#FFC890', 0.5);
      // дверь на улицу: арка, филёнки, окошко, табличка «ВЫХОД», мятный ореол
      const EZ = -1.2;
      { const dv = grp(dc, -W / 2 + 0.01, 0, EZ, PI / 2);
        put(dv, R.extrude(R.archShape(1.26, 2.42), 0.06), M.cream, [0, 0, 0.01]);
        put(dv, R.extrude(R.archShape(1.04, 2.28), 0.06), M.wood, [0, 0, 0.06]);
        [-0.24, 0.24].forEach(x => rbox(dv, M.woodD, x, 0.6, 0.13, 0.36, 0.68, 0.03, 0.05));
        box(dv, outM, 0, 1.6, 0.125, 0.5, 0.5, 0.02); box(dv, M.cream, 0, 1.6, 0.14, 0.03, 0.52, 0.02); box(dv, M.cream, 0, 1.6, 0.14, 0.52, 0.03, 0.02);
        put(dv, R.ringG(0.27, 0.025), M.cream, [0, 1.6, 0.14]);
        sphS(dv, M.brass, 0.4, 1.02, 0.15, 0.045); rbox(dv, M.brass, 0.4, 1.02, 0.125, 0.07, 0.2, 0.02, 0.02);
        rbox(dv, M.ink, 0, 2.66, 0.05, 0.74, 0.26, 0.04, 0.03); aplane(dv, RG.exit, [0, 2.66, 0.075], [0.7, 0.21, 1]); }
      { const dg = grp(g, -W / 2 + 0.01, 0, EZ, PI / 2, 'exitDoor'); hit(dg, 0, 1.3, 0.12, 1.3, 2.9, 0.3); }
      R.halo(g, -W / 2 + 0.25, 2.66, EZ, 0.7, '#BFF0CE', 0.35);

      /* ---------- лампа на длинном шнуре над пролётом ---------- */
      { const lx = 0.35, lz = -4.45, ly = 3.62;
        cyl(dc, M.ink, lx, (ly + 0.2 + H + 0.6) / 2, lz, 0.008, H + 0.6 - ly - 0.2);
        put(dc, GEO.cone, M.pink, [lx, ly + 0.12, lz], [0.26, 0.2, 0.26]); sphS(dc, M.brass, lx, ly + 0.24, lz, 0.03);
        sphS(dc, M.lamp, lx, ly - 0.01, lz, 0.075);
        R.halo(g, lx, ly - 0.02, lz, 1.5, '#FFC890', 0.6); }

      /* ---------- доска объявлений под площадкой ---------- */
      const BX = -2.7;
      const [bcv, bc] = R.cnv(512, 384), boardTex = R.tex(bcv);
      const wrapText = (c, s, maxW) => { const out = []; let cur = ''; String(s).split(/\s+/).forEach(w => { const t2 = cur ? cur + ' ' + w : w; if (cur && c.measureText(t2).width > maxW) { out.push(cur); cur = w; } else cur = t2; }); if (cur) out.push(cur); return out; };
      const paintBoard = text => {
        const c = bc, q = R.rng(5);
        c.fillStyle = '#D9A877'; c.fillRect(0, 0, 512, 384);
        for (let i = 0; i < 260; i++) { c.fillStyle = q() < 0.5 ? 'rgba(160,110,70,.35)' : 'rgba(255,230,190,.35)'; c.beginPath(); c.arc(q() * 512, q() * 384, 1 + q() * 2.2, 0, 7); c.fill(); }
        // мелкие бумажки по краям: график уборки и рисунок с голубиными следами
        c.save(); c.translate(70, 92); c.rotate(-0.08); c.fillStyle = '#FFFDF6'; c.fillRect(-48, -60, 96, 120);
        c.strokeStyle = '#B9C9E0'; c.lineWidth = 2; for (let y = -36; y < 56; y += 16) { c.beginPath(); c.moveTo(-40, y); c.lineTo(40, y); c.stroke(); } c.beginPath(); c.moveTo(-10, -44); c.lineTo(-10, 52); c.stroke();
        c.fillStyle = '#E59AA6'; [[-24, -28], [10, -12], [26, 20], [-24, 36]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }); c.restore();
        c.save(); c.translate(448, 300); c.rotate(0.1); c.fillStyle = '#E7EFD0'; c.fillRect(-46, -46, 92, 92);
        c.strokeStyle = '#8E8AA6'; c.lineWidth = 3; c.lineCap = 'round';
        [[-20, 18], [0, -2], [20, -22]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x, y); c.moveTo(x, y); c.lineTo(x - 7, y - 8); c.moveTo(x, y); c.lineTo(x + 7, y - 8); c.moveTo(x, y); c.lineTo(x, y - 10); c.stroke(); }); c.restore();
        c.fillStyle = '#C2405B'; [[70, 36], [448, 258]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); });
        // главная карточка недели
        c.save(); c.translate(282, 196); c.rotate(-0.025);
        c.fillStyle = 'rgba(90,60,40,.25)'; c.fillRect(-150, -138, 312, 290); c.fillStyle = '#FFFBF0'; c.fillRect(-156, -146, 312, 290);
        R.text(c, 'ОБЪЯВЛЕНИЕ', 0, -112, 26, '#C2405B', { w: 900 });
        c.fillStyle = '#E8A3B0'; c.fillRect(-90, -94, 180, 3);
        let fs = 46, lines = [];
        for (; fs >= 28; fs -= 2) { c.font = `700 ${fs}px Caveat, cursive`; lines = wrapText(c, text || '', 270); if (lines.length * fs * 1.02 <= 200) break; }
        const y0 = 10 - (lines.length - 1) * fs * 0.51;
        lines.forEach((ln, i) => R.text(c, ln, 0, y0 + i * fs * 1.02, fs, '#3E3550', { f: 'Caveat', w: 700, max: 290 }));
        c.fillStyle = '#7FB07A'; c.beginPath(); c.arc(0, -146, 8, 0, 7); c.fill();
        c.restore();
        boardTex.needsUpdate = true;
      };
      paintBoard(FREE ? 'Объявления меняются по субботам. Голуби следят.' : 'Жильцам: ступенек временно нет. Просьба не волноваться.');
      { const bg = grp(dc, BX, 0, -D + 0.01);
        rbox(bg, M.wood, 0, 1.72, 0.025, 1.22, 0.94, 0.05, 0.03);
        plane(bg, toon('#FFFFFF', { map: boardTex }), 0, 1.72, 0.055, 1.1, 0.82); }

      /* ---------- записка на двери кв. 1 (только сюжет): светится и пульсирует ---------- */
      let noteG = null, noteGlowM = null, spark = null, noteHit = null;
      if (!FREE) {
        noteG = grp(g, DX + 0.2, 1.6, -D + 0.1, 0, 'spot:note');
        const pap = aplane(noteG, RG.note, [0, 0, 0.004], [0.27, 0.225, 1], [0, 0, 0.06]); pap.receiveShadow = false;
        sphS(noteG, M.pink, -0.01, 0.1, 0.012, 0.018);
        const [ngv, ngc] = R.cnv(256, 200);
        ngc.shadowColor = 'rgba(255,205,110,1)'; ngc.shadowBlur = 26; ngc.fillStyle = 'rgba(255,226,150,1)'; R.rrect(ngc, 40, 36, 176, 128, 12); ngc.fill(); ngc.fill();
        noteGlowM = addM(R.tex(ngv), '#FFD98A', 0.6);
        const ng = plane(noteG, noteGlowM, 0, 0, -0.002, 0.5, 0.4, 0.06); ng.receiveShadow = false; ng.renderOrder = 3;
        const [spv, spc] = R.cnv(64, 64);
        { const gr = spc.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,230,150,.9)'); gr.addColorStop(1, 'rgba(255,210,120,0)');
          spc.fillStyle = gr; spc.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, r = i % 2 ? 6 : 31; spc.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } spc.fill(); }
        spark = new T.Sprite(R.keep(new T.SpriteMaterial({ map: R.tex(spv), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
        spark.position.set(0.15, 0.17, 0.03); spark.scale.setScalar(0.14); spark.renderOrder = 5; noteG.add(spark);
        noteHit = hit(noteG, -0.2, -0.4, 0.1, 1.0, 1.8, 0.4);
      }

      /* ---------- голуби на подоконнике (только прогулка) ---------- */
      let pigeons = null;
      if (FREE && R.npc.pigeon) {
        const pg = new T.Group(); pg.userData.key = 'npc:pigeons'; g.add(pg);   // голуби — в координатах комнаты
        const birds = [[-0.42, -PI / 2 + 0.35], [0.16, -PI / 2 - 0.45]].map(([lz, ry]) => {
          const n = R.npc.pigeon(); n.root.position.set(W / 2 - 0.3, 1.24, WZ + lz); n.root.rotation.y = ry; n.root.userData.key = 'npc:pigeons'; pg.add(n.root);
          n.root.traverse(m => { if (m.isMesh) m.castShadow = false; });
          return n;
        });
        // якорь над подоконником: ловушка тапа и точка для пузырька реплики (Town берёт root.getWorldPosition)
        const anchor = grp(g, W / 2 - 0.3, 0, WZ - 0.13, 0, 'npc:pigeons'); hit(anchor, 0, 1.45, 0, 0.5, 0.5, 1.0);
        pigeons = { id: 'pigeons', root: anchor, body: birds[0].body, head: birds[0].head, birds,
          hop() { birds.forEach((b, i) => setTimeout(() => b.hop(), i * 140)); },
          anim(t, dt, hx, hz) { birds.forEach(b => b.anim(t, dt, hx, hz)); } };
      }

      /* ---------- слово эха: всплывает вверх по пролёту и тает ---------- */
      const [ecv, ecx] = R.cnv(256, 80), echoTex = R.tex(ecv);
      const echoS = new T.Sprite(R.keep(new T.SpriteMaterial({ map: echoTex, transparent: true, depthWrite: false, fog: false })));
      echoS.scale.set(1.0, 0.31, 1); echoS.renderOrder = 6; echoS.visible = false; g.add(echoS);
      let echoT = -1;
      const echo = text => {
        ecx.clearRect(0, 0, 256, 80); ecx.font = '700 54px Caveat, cursive'; ecx.textAlign = 'center'; ecx.textBaseline = 'middle';
        ecx.lineWidth = 10; ecx.lineJoin = 'round'; ecx.strokeStyle = 'rgba(255,253,246,.95)'; ecx.strokeText(text, 128, 42); ecx.fillStyle = '#7A6A9A'; ecx.fillText(text, 128, 42);
        echoTex.needsUpdate = true; echoT = 0; echoS.visible = true;
      };

      /* ---------- ловушки тапа для точек ---------- */
      const spotHit = (key, x, y, z, w, h, d, r) => { const q = grp(g, 0, 0, 0, 0, key); hit(q, x, y, z, w, h, d, r); return q; };
      spotHit('spot:stairs', (SX0 + SX1) / 2 + 0.2, LY / 2 + 0.35, -5.45, LEN + 0.3, 1.5, 1.1, [0, 0, -ang]);
      spotHit(FREE ? 'spot:mail' : 'spot:mailboxes', -W / 2 + 0.2, 1.42, MZ, 0.4, 1.1, 1.9);
      spotHit('spot:radiator', W / 2 - 0.15, 0.5, WZ, 0.4, 0.85, 1.3);
      if (FREE) {
        spotHit('spot:window', W / 2 - 0.05, 2.0, WZ, 0.2, 1.6, 1.5);
        spotHit('spot:board', BX, 1.72, -D + 0.1, 1.3, 1.0, 0.25);
        spotHit('spot:echo', -1.0, 1.2, -5.55, 1.0, 1.8, 0.8);
      }

      R.bake(st, null, {});
      R.bake(dc, null, { cast: false });
      [st, dc].forEach(gr => gr.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));   // мебель не перехватывает тапы

      const blockers = [
        { x0: -0.35, x1: 2.05, z0: -6, z1: -4.88 },    // низ пролёта и столбик
        { x0: -1.55, x1: -1.25, z0: -5.15, z1: -4.85 }, // столб площадки
        { x0: 3.25, x1: 3.9, z0: -4.0, z1: -3.4 },      // фикус
        { x0: 3.45, x1: 4.0, z0: -3.05, z1: -1.35 },    // подоконник и батарея
      ];
      const spots = FREE ? [
        { id: 'stairs', x: 0.6, z: -4.5, act: 'Посмотреть', bubble: 'где ступеньки?' },
        { id: 'echo', x: -0.9, z: -4.6, act: 'Позвать', bubble: 'эхо в пролёте' },
        { id: 'mail', x: -3.1, z: -3.4, act: 'Прочитать', bubble: 'почтовые ящики' },
        { id: 'board', x: -2.7, z: -4.8, act: 'Прочитать', bubble: 'объявления' },
        { id: 'radiator', x: 3.0, z: -1.6, act: 'Погреться', bubble: 'батарея' },
        { id: 'window', x: 3.0, z: -2.75, act: 'Выглянуть', bubble: 'окно' },
      ] : [
        { id: 'stairs', x: 0.6, z: -4.5, act: 'Крикнуть', bubble: 'лестница без ступенек' },
        { id: 'note', x: 2.9, z: -4.6, act: 'Прочитать', bubble: 'записка на двери' },
        { id: 'mailboxes', x: -3.1, z: -3.4, act: 'Посмотреть', bubble: 'почтовые ящики' },
        { id: 'radiator', x: 3.0, z: -1.6, act: 'Погреться', bubble: 'батарея' },
      ];
      let mailK = 0, mailTo = 0, pigT = 4;
      return {
        W, D,
        bounds: { x0: -3.6, x1: 3.6, z0: -5.1, z1: -0.4 },
        exit: { x: -3.45, z: EZ }, exitDir: [-0.9, 0],
        spawn: { x: -2.1, z: -1.05 },
        cam: { x0: -2.9, x1: 2.9, z: -1.5 },
        blockers,
        catSpot: { x: 3.5, z: -2.35, ry: -0.5 },
        spots,
        npcs: pigeons ? { pigeons } : {},
        hideNote: () => { if (noteG) { noteG.visible = false; noteG.userData.key = null; if (noteHit) noteHit.visible = false; } },
        paintBoard,
        popMail: () => { mailTo = 1; },
        closeMail: () => { mailTo = 0; },
        echo,
        // кадры для api.camFocus(pos, look)
        views: {
          note: { pos: [2.4, 2.2, -1.6], look: [2.9, 1.3, -6.0] },
          stairs: { pos: [0.4, 2.6, -0.8], look: [0.0, 1.9, -5.6] },
          board: { pos: [-2.2, 2.9, -2.4], look: [-2.7, 1.75, -6.0] },
          mail: { pos: [-2.0, 3.3, -0.5], look: [-3.95, 1.4, -3.5] },
          window: { pos: [1.4, 2.2, -1.0], look: [4.0, 1.6, -2.2] },
        },
        tick(t, dt) {
          if (noteG && noteG.visible) {
            const p = 0.5 + 0.5 * Math.sin(t * 3.1);
            noteGlowM.opacity = 0.4 + p * 0.6;
            spark.position.y = 0.17 + Math.sin(t * 2) * 0.03; spark.material.rotation = t * 0.9; spark.scale.setScalar(0.1 + p * 0.07);
          }
          if (mailK !== mailTo) { mailK += Math.sign(mailTo - mailK) * Math.min(Math.abs(mailTo - mailK), dt * 2.4); hinge.rotation.y = -1.9 * (mailK < 1 ? 1 - Math.pow(1 - mailK, 3) : 1); }
          if (echoT >= 0) {
            echoT += dt; const k = Math.min(1, echoT / 1.8);
            echoS.position.set(-0.7 + Math.sin(echoT * 3) * 0.12, 2.0 + k * 2.2, -5.3);
            echoS.material.opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
            if (k >= 1) { echoT = -1; echoS.visible = false; }
          }
          if (pigeons) { pigT -= dt; if (pigT <= 0) { pigT = 5 + Math.random() * 6; pigeons.birds[Math.floor(Math.random() * 2)].hop(); } }
        },
      };
    },
  });
})();
