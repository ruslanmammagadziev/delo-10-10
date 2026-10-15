/* =====================================================================
   Место прогулки: cinema — Кинотеатр «Саспенс» (сюжетная комната L + расширение).
   Расширение зала (только mode 'free'): табличка «ФИНАЛЫЧ» на спинке кресла,
   ловушки тапа над креслами второго и первого ряда (seat / fseat), зёрна
   попкорна прыгают в стекле (один InstancedMesh), заставка «Фильм недели»
   на экране, мерцание луча проектора, кот садится в кресло рядом.
   Мини «Фильм недели»: сесть во второй ряд → экран целиком в кадре →
   титр + 4 карточки по 3 с (тап — дальше) → оценка x/10 (town.r).
   В 2D фильм идёт титрами Ep1.kit.intertitle.
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'cinema';
  const PI = Math.PI;

  /* ---------- Фильм недели (§9) ---------- */
  const FILMS = [
    { t: 'Бант, который улетел', c: ['Подул ветер.', 'Бант улетел. Без предупреждения.', 'За ним погнался весь город. Даже полиция.', 'Бант приземлился на Пирожка. Пирожок потребовал гонорар.'] },
    { t: 'Свитер для фонаря', c: ['Фонарь замёрз. Никто не заметил, как это произошло.', 'Кашемира взялась за спицы.', 'Три ночи, два клубка и один нервный срыв.', 'Теперь фонарь в свитере. И неожиданно стильный.'] },
    { t: 'Голубь и шляпа', c: ['Голубь нашёл шляпу. Решил, что это судьба.', 'Шляпа накрыла голубя целиком.', 'Голубь решил подрасти. Начал с самооценки.', 'Пока живёт внутри шляпы.'] },
    { t: 'Пирожок и клубок', c: ['На полу клубок.', 'Из-за угла выходит кот.', 'Взгляды встретились. Битва века.', 'Победила нитка. Оба в шоке.'] },
    { t: 'Упрямый листок', c: ['Последний лист держится из принципа.', 'Весь город за него болеет.', 'Он держится, как может.', 'Упал. Прямо в чей-то какао. Финал вызвал споры.'] },
    { t: 'Первая снежинка', c: ['Снежинка ищет идеальное место для посадки.', 'Голубь предложил нос. Снежинка отказалась.', 'Она выбрала берет следователя.', 'Вот теперь идеально.'] },
    { t: 'Пока горят фонари', c: ['Солнца нет.', 'Фонари не спят.', 'Звёзды помогают.', 'Город держится. Вместе.'] },
  ];
  const wkNow = () => { try { return Math.max(0, Math.min(6, Town.week())); } catch (e) { return 0; } };
  const film = w => FILMS[Math.max(0, Math.min(6, w | 0))];

  /* ---------- Рисунки для экрана 720×480 ---------- */
  const SERIF = 'Georgia, "Times New Roman", "PT Serif", serif';
  function wrap(c, s, maxW) {
    const words = String(s).split(' '), out = [];
    let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; });
    if (cur) out.push(cur);
    return out;
  }
  function textBlock(c, s, cx, cy, size, col, font, maxW, lh) {
    c.font = font; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = wrap(c, s, maxW), h = (lines.length - 1) * lh;
    lines.forEach((l, i) => {
      const w = c.measureText(l).width, y = cy - h / 2 + i * lh;
      if (w > maxW) { c.save(); c.translate(cx, y); c.scale(maxW / w, 1); c.fillText(l, 0, 0); c.restore(); } else c.fillText(l, cx, y);
    });
  }
  // подпись карточки под рисунком: кегль уменьшается, пока текст не уместится в рамку (maxH по высоте)
  function fitBlock(c, s, cx, cy, maxSize, minSize, col, style, maxW, maxH) {
    let size = maxSize;
    for (; size > minSize; size -= 2) {
      c.font = `${style} ${size}px ${SERIF}`;
      if ((wrap(c, s, maxW).length - 1) * Math.round(size * 1.14) + size <= maxH) break;
    }
    textBlock(c, s, cx, cy, size, col, `${style} ${size}px ${SERIF}`, maxW, Math.round(size * 1.14));
  }
  // простой рисунок недели линией (как в немом кино); s — масштаб, col — цвет
  function doodle(c, w, cx, cy, s, col) {
    c.save(); c.translate(cx, cy); c.scale(s, s);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    const L = (pts, close) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); c.stroke(); };
    const E = (x, y, rx, ry, r = 0, fill) => { c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, PI * 2); fill ? c.fill() : c.stroke(); };
    const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, q = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); };
    if (w === 0) {          // бант на ветру
      E(-40, -8, 42, 24, -0.35); E(40, -8, 42, 24, 0.35); E(0, -4, 12, 12, 0, true);
      L([[-6, 6], [-26, 58], [-12, 52]]); L([[6, 6], [24, 62], [12, 54]]);
      [[-95, -40], [-110, -10], [-92, 20]].forEach(([x, y]) => L([[x, y], [x - 34, y + 4]]));
    } else if (w === 1) {   // фонарь в свитере
      L([[0, 70], [0, -40]]); L([[-26, -40], [26, -40], [16, -70], [-16, -70]], true); E(0, -55, 6, 6, 0, true);
      c.lineWidth = 5; for (let i = 0; i < 4; i++) { const y = 0 + i * 14; L([[-14, y], [14, y]]); }
      L([[-14, -6], [-14, 50]]); L([[14, -6], [14, 50]]);
      c.globalAlpha = 0.35; E(0, -55, 34, 34); c.globalAlpha = 1;
      L([[-50, 70], [50, 70]]);
    } else if (w === 2) {   // голубь в шляпе
      E(0, 22, 48, 32); E(36, -18, 20, 18); L([[54, -16], [70, -10], [54, -6]]); E(40, -22, 3, 3, 0, true);
      L([[-46, 18], [-80, 4], [-62, 30]]); L([[-6, 52], [-6, 70]]); L([[12, 52], [12, 70]]);
      L([[10, -36], [64, -36]]); L([[18, -36], [20, -80], [54, -80], [56, -36]]);
    } else if (w === 3) {   // кот и клубок
      E(-36, 26, 34, 40); E(-36, -26, 24, 22); L([[-54, -40], [-50, -64], [-38, -46]]); L([[-18, -40], [-22, -64], [-34, -46]]);
      L([[-6, 52], [16, 40], [10, 20]]);
      E(58, 44, 26, 26); L([[38, 30], [76, 58]]); L([[36, 50], [70, 30]]); L([[50, 20], [62, 68]]);
      c.lineWidth = 3; L([[34, 50], [10, 66], [-20, 62]]);
    } else if (w === 4) {   // листок над какао
      L([[-44, 10], [-40, 70], [36, 70], [40, 10]], true); E(52, 36, 16, 18);
      c.lineWidth = 4; L([[-16, 0], [-10, -14], [-16, -28]]); L([[12, 0], [18, -14], [12, -28]]);
      c.lineWidth = 6; c.beginPath(); c.moveTo(-10, -86); c.quadraticCurveTo(30, -100, 34, -56); c.quadraticCurveTo(-6, -48, -10, -86); c.stroke(); L([[-10, -86], [26, -62]]);
    } else if (w === 5) {   // снежинка на берете
      E(0, 40, 70, 22); E(0, 22, 4, 6, 0, true); c.beginPath(); c.moveTo(-70, 40); c.quadraticCurveTo(0, -6, 70, 40); c.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; L([[0, -40], [Math.cos(a) * 34, -40 + Math.sin(a) * 34]]); const mx = Math.cos(a) * 22, my = -40 + Math.sin(a) * 22; L([[mx, my], [mx + Math.cos(a + 0.8) * 9, my + Math.sin(a + 0.8) * 9]]); L([[mx, my], [mx + Math.cos(a - 0.8) * 9, my + Math.sin(a - 0.8) * 9]]); }
    } else {                // три фонаря и звёздочки
      [-80, 0, 80].forEach(x => { L([[x, 72], [x, -10]]); L([[x - 14, -10], [x + 14, -10], [x + 9, -30], [x - 9, -30]], true); c.globalAlpha = 0.35; E(x, -20, 26, 26); c.globalAlpha = 1; });
      [[-110, -70], [-40, -84], [44, -76], [112, -64], [0, -52]].forEach(([x, y]) => star(x, y, 9));
    }
    c.restore();
  }
  // карточка фильма: тёмный фон, кремовая двойная рамка, виньетка, рисунок сверху, текст снизу
  function drawCard(c, w, card) {
    c.fillStyle = '#1E1620'; c.fillRect(0, 0, 720, 480);
    const g = c.createRadialGradient(360, 240, 110, 360, 240, 440); g.addColorStop(0, 'rgba(74,52,70,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = g; c.fillRect(0, 0, 720, 480);
    c.strokeStyle = '#FFF0CE'; c.lineWidth = 6; c.strokeRect(24, 24, 672, 432); c.lineWidth = 2; c.strokeRect(38, 38, 644, 404);
    [[38, 38], [682, 38], [38, 442], [682, 442]].forEach(([x, y]) => { c.fillStyle = '#FFF0CE'; c.beginPath(); c.arc(x, y, 7, 0, PI * 2); c.fill(); });
    if (card.title) {
      textBlock(c, 'ФИЛЬМ НЕДЕЛИ', 360, 124, 56, '#E8C770', `700 56px ${SERIF}`, 580, 60);
      c.strokeStyle = '#E8C770'; c.lineWidth = 3; c.beginPath(); c.moveTo(250, 172); c.lineTo(470, 172); c.stroke();
      textBlock(c, `„${card.title}“`, 360, 296, 64, '#FFF0CE', `italic 64px ${SERIF}`, 520, 74);
    } else {
      doodle(c, w, 360, 150, 0.9, '#FFF0CE');
      fitBlock(c, card.text, 360, 338, 58, 30, '#FFF0CE', 'italic', 560, 176);
    }
    // зерно плёнки
    c.fillStyle = 'rgba(255,240,206,0.06)';
    for (let i = 0; i < 70; i++) c.fillRect((i * 97) % 700 + 10, (i * 53) % 460 + 10, 2, 2);
  }
  // заставка между сеансами: «ФИЛЬМ НЕДЕЛИ / „…“ / сеанс — по тапу»
  function drawIdle(c, w) {
    const gr = c.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, '#FFF6E6'); gr.addColorStop(1, '#F6DCC8');
    c.fillStyle = gr; c.fillRect(0, 0, 720, 480);
    c.strokeStyle = '#C2405B'; c.lineWidth = 5; c.strokeRect(22, 22, 676, 436); c.lineWidth = 2; c.strokeRect(34, 34, 652, 412);
    textBlock(c, 'ФИЛЬМ НЕДЕЛИ', 360, 78, 56, '#9E2F47', '700 56px Comfortaa, Nunito, sans-serif', 600, 60);
    doodle(c, w, 360, 168, 0.5, '#C98A9A');
    textBlock(c, `„${film(w).t}“`, 360, 296, 72, '#5A2C44', '700 72px Caveat, cursive', 520, 68);
    textBlock(c, 'сеанс — по тапу', 360, 410, 56, '#B07A8A', '700 56px Caveat, cursive', 480, 60);
  }
  // тень-зайчик на кремовом луче
  function drawBunny(c) {
    c.fillStyle = '#FFF6E6'; c.fillRect(0, 0, 720, 480);
    const g = c.createRadialGradient(360, 230, 30, 360, 240, 380); g.addColorStop(0, '#FFFBF2'); g.addColorStop(1, '#EED3BC');
    c.fillStyle = g; c.fillRect(0, 0, 720, 480);
    c.fillStyle = 'rgba(58,42,52,0.88)';
    const E = (x, y, rx, ry, r) => { c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, PI * 2); c.fill(); };
    E(300, 128, 26, 88, -0.28); E(362, 118, 24, 92, 0.18);
    E(336, 252, 92, 72, 0.1); E(258, 274, 44, 32, -0.2);
    c.beginPath(); c.moveTo(372, 300); c.quadraticCurveTo(470, 330, 560, 480); c.lineTo(420, 480); c.quadraticCurveTo(390, 380, 330, 318); c.closePath(); c.fill();
    c.fillStyle = '#FFF6E6'; c.beginPath(); c.arc(300, 236, 9, 0, PI * 2); c.fill();
  }

  /* ---------- Расширение зала (только прогулка) ---------- */
  if (window.City3D && City3D.extendRoom) City3D.extendRoom(P, {
    build(R, base) {
      const { T, group: g, GEO } = R;
      const S = { goose: null, catSeat: null, flick: -1, waddle: false, hopT: -1, beam: base.beamMat || null, screen: base.screen || null };
      // точки базы: подписи для прогулки
      (base.spots || []).forEach(sp => {
        if (sp.id === 'screen') Object.assign(sp, { act: 'Смотреть', bubble: 'фильм недели' });
        if (sp.id === 'popcorn') Object.assign(sp, { act: 'Взять', bubble: 'попкорн' });
      });
      // гусь Финалыч базы (на прогулке скрыт) — для сцены у кресла с табличкой
      S.goose = g.children.find(c => c.userData && c.userData.key === 'npc:goose') || null;
      // заставка недели вместо сюжетного кадра
      if (S.screen) { try { drawIdle(S.screen.ctx, wkNow()); S.screen.commit(); } catch (e) { /* остаётся база */ } }
      // латунная табличка «ФИНАЛЫЧ» на спинке кресла (1.06, −4.7)
      { const [cv, c] = R.cnv(256, 64);
        const gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#F2D98A'); gr.addColorStop(1, '#C9A040');
        c.fillStyle = gr; R.rrect(c, 2, 2, 252, 60, 12); c.fill(); c.strokeStyle = '#8E6A2A'; c.lineWidth = 3; R.rrect(c, 8, 8, 240, 48, 9); c.stroke();
        R.text(c, 'ФИНАЛЫЧ', 128, 34, 34, '#5A3E1A', { max: 210 });
        const pl = R.plane(g, R.keep(new T.MeshBasicMaterial({ map: R.tex(cv) })), 1.06, 0.93, -4.385, 0.32, 0.08); pl.raycast = () => {}; pl.receiveShadow = false; }
      // невидимые ловушки тапа над креслами (ряды склеены без тапов)
      const hitM = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const hit = (key, x, z) => { const m = R.put(g, GEO.box, hitM, [x, 0.55, z + 0.08], [0.64, 1.1, 0.7]); m.castShadow = false; m.receiveShadow = false; m.userData.key = key; return m; };
      hit('spot:seat', 1.06, -3.5); hit('spot:fseat', 1.06, -4.7);
      // зёрна попкорна прыгают в стекле: один InstancedMesh
      const pg = g.children.find(c => c.userData && c.userData.key === 'spot:popcorn');
      let kern = null; const KP = [];
      if (pg) {
        kern = new T.InstancedMesh(GEO.sphLo, R.toon('#FFF0B8'), 6);   // центр — в стекле, сфера геометрии (r 1) накрывает все зёрна
        kern.position.y = 0.9; kern.castShadow = false; kern.receiveShadow = false;
        kern.raycast = () => {};
        for (let i = 0; i < 6; i++) KP.push({ x: -0.17 + (i % 3) * 0.17, z: i < 3 ? -0.08 : 0.08, ph: i * 1.37, sp: 2.2 + (i % 4) * 0.45 });
        pg.add(kern);
      }
      const dm = new T.Object3D();
      return {
        spots: [
          { id: 'seat', x: 0.35, z: -3.3, act: 'Присесть', bubble: 'второй ряд' },
          { id: 'fseat', x: 0.35, z: -4.55, act: 'Прочитать', bubble: 'кресло с табличкой' },
        ],
        catSpot: { x: -2.0, z: -1.5, ry: 0.4 },
        spawn: { x: -2.6, z: -1.3 },   // §7.1: 2.2 м от двери, 1.2 м от попкорна
        i2: S,
        tick(t, dt, c) {
          if (kern) {
            KP.forEach((k, i) => {
              const h = Math.pow(Math.max(0, Math.sin(t * k.sp + k.ph)), 6) * 0.26;
              dm.position.set(k.x, h, k.z); dm.rotation.set(t * 2 + i, t * 1.3, 0); dm.scale.setScalar(0.042); dm.updateMatrix(); kern.setMatrixAt(i, dm.matrix);
            });
            kern.instanceMatrix.needsUpdate = true;
          }
          if (S.flick >= 0 && S.beam) { S.flick += dt; const k = S.flick / 0.4; S.beam.opacity = k < 1 ? 0.1 + 0.12 * Math.sin(k * PI) : 0.1; if (k >= 1) S.flick = -1; }
          const gs = S.goose;
          if (gs && gs.visible) {
            gs.rotation.z = S.waddle ? Math.sin(t * 16) * 0.12 : 0;
            if (S.hopT >= 0) { S.hopT += dt; const k = Math.min(1, S.hopT / 0.42); gs.position.y = Math.sin(k * PI) * 0.16; if (k >= 1) { S.hopT = -1; gs.position.y = 0; } }
          }
          // кот запрыгивает в соседнее кресло
          if (S.catSeat && c && c.cat && c.cat.root.visible) {
            const cr = c.cat.root.position, d = Math.hypot(cr.x - S.catSeat.x, cr.z - S.catSeat.z);
            cr.y = d < 0.45 ? 0.43 * Math.sqrt(1 - d / 0.45) : 0;
          }
        },
      };
    },
  });

  /* ---------- Содержимое ---------- */
  const NOIR = new WeakSet();
  const SEAT2 = { x: 1.06, z: -3.5, ry: PI, from: [0.35, -3.5] };
  const SEAT1 = { x: 1.06, z: -4.7, ry: PI, from: [0.35, -4.7] };
  const HELD_DONE = { cup: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.', popcorn: 'Попкорн исчез. Пирожок клянётся, что ничего не трогал.' };
  const room = ctx => (ctx.is3d && ctx.api.room) || null;
  // уже сидит (например, во втором ряду) — сначала встать, иначе движок не поведёт к другому месту
  const standUp = ctx => { if (ctx.is3d && ctx.api.isSitting) ctx.stand(); };
  const st2 = ctx => { const r = room(ctx); return (r && r.i2) || null; };
  const paintIdle = ctx => { const S = st2(ctx); if (S && S.screen) { drawIdle(S.screen.ctx, ctx.week); S.screen.commit(); } };

  // 2D: титры немого кино; уход посреди титра не оставляет серый фильтр
  function intertitle2D(ctx, text) {
    const kit = (window.Ep1 && Ep1.kit) || {};
    if (!kit.intertitle) return ctx.play(text);
    return new Promise((res, rej) => {
      const iv = setInterval(() => { if (ctx.gone) { clearInterval(iv); try { G.app.classList.remove('silent-film'); } catch (e) { /* ignore */ } rej(Town.Gone); } }, 120);
      Promise.resolve(kit.intertitle(text)).then(() => { clearInterval(iv); if (ctx.gone) rej(Town.Gone); else res(); }, () => { clearInterval(iv); res(); });
    });
  }

  async function filmMini(ctx) {
    const w = ctx.week, F = film(w), R3 = room(ctx), S = st2(ctx), scr = S && S.screen;
    const held0 = ctx.held;
    ctx.mark('sit');
    standUp(ctx);
    await ctx.api.sit(SEAT2);               // напрямую: строчка «попкорн кончился» — после фильма
    if (S && ctx.catHere) { S.catSeat = { x: 1.72, z: -3.5 }; ctx.api.catTo(1.72, -3.5, { ry: PI }); }
    const cards = [{ title: F.t }].concat(F.c.map(text => ({ text })));
    if (scr && R3.screenMesh) {
      let tapped = false;
      try {
        await ctx.dim(0.55);
        ctx.api.fitScreen(R3.screenMesh, { margin: 1.06, y: 3.0 });
        ctx.api.focusMode(true);
        ctx.api.intercept(() => { tapped = true; return true; });
        ctx.mark('film');
        for (const cd of cards) {
          drawCard(scr.ctx, w, cd); scr.commit(); S.flick = 0; tapped = false;
          const hold = cd.text ? Math.max(3000, 1200 + 55 * cd.text.length) : 3000;
          for (let ms = 0; ms < hold && !tapped; ms += 100) await ctx.wait(100);
        }
      } finally {
        if (!ctx.gone) { try { ctx.api.intercept(null); ctx.api.camRelease(); ctx.api.focusMode(false); } catch (e) { /* ignore */ } paintIdle(ctx); }
      }
      await ctx.dim(NOIR.has(ctx) ? 0.75 : 1);
    } else {
      ctx.mark('film');
      for (const cd of cards) await intertitle2D(ctx, cd.title ? `ФИЛЬМ НЕДЕЛИ · „${cd.title}“` : cd.text);
    }
    const v = await ctx.choose('Оценка?', [{ label: '10/10', value: 10 }, { label: '9/10', value: 9 }, { label: '7/10 — без обид', value: 7 }], { who: 'raccoon' });
    const REPLY = { 10: 'Десять?! Сейчас расплачусь. Извините, привычка.', 9: 'Девять! Расскажите, где потеряли балл. Нет, не рассказывайте, я не выдержу.', 7: 'Семь! Больно, но по делу. Пойду переосмыслю финал.' };
    if (v === 10 || v === 9 || v === 7) {
      const t = ctx.town, r = String(t.r || '').padEnd(7, '-').slice(0, 7), ch = v === 10 ? 'a' : String(v);
      t.r = r.slice(0, w) + ch + r.slice(w + 1); G.save();
    }
    await ctx.say({ who: 'raccoon', text: REPLY[v] || 'Можно не ставить. После хорошего фильма иногда хочется помолчать.' });
    if (S) S.catSeat = null;
    ctx.api.catFree();
    ctx.stand();
    if (HELD_DONE[held0] && ctx.held === held0) { ctx.setHeld(null); ctx.toast(HELD_DONE[held0]); }
    return true;
  }

  async function seatUse(ctx) {
    standUp(ctx);
    await ctx.sit(SEAT2);
    await ctx.wait(ctx.is3d ? 1500 : 300);
    await ctx.line('seat');
    return true;
  }

  async function fseatUse(ctx) {
    if (ctx.flag('f1') || ctx.has('c_seat')) { await ctx.play('Место свободно. Владелец в очередной раз поспорил с охраной.'); return true; }
    if (ctx.n('fseat') === 1) { await ctx.play('Табличка: «Финалыч. Место занято даже в отсутствие гуся».'); return true; }
    standUp(ctx);
    await ctx.sit(SEAT1);
    const S = st2(ctx), gs = S && S.goose;
    if (gs) { gs.position.set(0.3, 0, -4.75); gs.rotation.set(0, PI / 2, 0); gs.visible = true; S.hopT = 0; }   // в проходе у первого ряда: видно из зала
    try {
      await ctx.say({ who: 'goose', text: 'ГА! Это моё место! И кстати, в финале…' });
      ctx.sfx('blip');
      if (gs) { S.waddle = true; await ctx.api.tween(gs, [[0.3, 0, -4.3], [0.3, 0, -1.0], [-3.9, 0, -1.2], [-4.4, 0, -2.7], [-5.4, 0, -2.7]], 3.2, { hide: true }); }
    } finally { if (S) S.waddle = false; if (gs && ctx.gone) gs.visible = false; }
    const t = ctx.town, g0 = t.g || 0;
    await ctx.say({ text: `Финалыча снова вывели. Счётчик изгнаний: ${215 + g0}.`, s: 'c_seat' });
    t.g = g0 + 1;
    ctx.flag('f1', 1);
    return true;
  }

  async function bunnyShow(ctx) {
    await ctx.say({ who: 'raccoon', text: 'Попкорн? Тогда с меня тень-зайчик.' });
    const S = st2(ctx);
    if (S && S.screen) {
      drawBunny(S.screen.ctx); S.screen.commit(); S.flick = 0;
      ctx.mark('bunny');
      try { await ctx.wait(4000); } finally { if (!ctx.gone) paintIdle(ctx); }
    }
    await ctx.say({ text: 'Зайка из кондитерской оценила бы.', s: 'c_bun' });
  }

  Town.place({
    id: P, kind: 'story',
    name: 'Кинотеатр «Саспенс»', short: 'Кинотеатр',
    sign: 'САСПЕНС', motto: 'кино · попкорн · платочки',
    icon: '🎬', color: '#F7C9D3',
    street: { x: 0, w: 4.6, doorDx: 0, bkey: null },
    room: 'cinema', opens: 0,
    host: { who: 'raccoon', npc: 'raccoon' },
    greet: {
      first: 'О, зрительница! Садитесь. На сегодня у нас короткое кино и длинные эмоции.',
      again: Town.v('Вы вернулись! А я репетировал, как спокойно вас встретить. Не вышло.', '{name}! Я как раз протёр экран. Платком для слёз, но он чистый.', 'О, снова вы. Даже кресла заскрипели от радости.'),
      regular: Town.v('Ваше место свободно. Гусь пытался занять, но сам же всё проспойлерил.', 'Постоянная зрительница! У нас уже можно получить платочек по подписке.', 'Проходите. Свет приглушён, эмоции подготовлены.'),
      away: 'Неделю вас не было! Я пережил три фильма и одно расставание. В кино, разумеется.',
    },
    bark: 'Снова в зал? Проходите!',
    weekly: { 1: 'Новый фильм! Короткий, но я на всякий случай взял два платка.', 2: 'Новый фильм! Короткий, но я на всякий случай взял два платка.', 3: 'Новый фильм! Короткий, но я на всякий случай взял два платка.', 4: 'Новый фильм! Короткий, но я на всякий случай взял два платка.', 5: 'Новый фильм! Короткий, но я на всякий случай взял два платка.', 6: 'Новый фильм! Короткий, но я на всякий случай взял два платка.' },
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      bouquet: 'Букет! Красиво, как в финальной сцене… Простите, мне надо к платочкам.',
      cup: 'С какао можно. Только, пожалуйста, не плачьте в чашку: у меня уже был случай.',
      look: 'Какой образ! Так, свет на главную героиню, срочно.',
    },
    reactFirst: ctx => {
      const st = ctx.st;
      if (st.bow === '#2E2A3B' && st.coat === '#6B6F7A' && !ctx.has('c_noir')) {
        NOIR.add(ctx);
        try { const p = ctx.dim(0.75); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
        return { who: 'raccoon', text: 'Чёрный бант и графитовый тренч? Всё. У нас сегодня нуар. Даже попкорн серьёзен.', s: 'c_noir' };
      }
      return null;
    },
    spots: {
      screen: { icon: '🎞', label: 'Фильм недели', onUse: filmMini },
      booth: {
        icon: '📽', label: 'Будка механика',
        lines: [
          { who: 'raccoon', text: 'Двадцать четыре кадра в секунду. На каждом втором мне грустно.' },
          { who: 'raccoon', f: 'fps24' },
          { who: 'raccoon', text: 'Проектор старенький. Люблю его, хоть он иногда заедает посреди признания.' },
        ],
      },
      popcorn: {
        icon: '🍿', label: 'Попкорн',
        // волна 4: в 3D героиня сама берёт ведёрко с прилавка у аппарата (настоящая рука) и сразу пробует зёрнышко; в 2D — как было
        onUse: async ctx => {
          const hands = ctx.is3d && ctx.api.hands && ctx.api.hands() && ctx.held !== 'popcorn';
          if (hands) await ctx.api.takeItem({ kind: 'popcorn', at: [-4.18, 0.66, -0.48], dist: 0.38, pose: { crouch: 0.9, bend: 0.55 } });   // тележка низкая: присесть
          ctx.setHeld('popcorn'); ctx.haptic('light');   // сначала — в руке (и в прогулке), потом первое зёрнышко
          if (hands) await ctx.api.nibble({ focus: true });
          return false;
        },
        lines: [
          { f: 'popc' },
          'Можно хрустеть. Енот всё равно громче всех в зале.',
          { who: 'cat', text: 'Попкорн не ем. Но за упавшим прослежу.', if: ctx => ctx.catHere },
        ],
      },
      posters: {
        icon: '🎭', label: 'Афиши',
        lines: [
          ctx => `Фильм недели: „${film(ctx.week).t}“. Сеанс — по тапу на экран.`,
          { f: 'lumie' },
          '„Гусь, который знал концовку“. Приписка енота: „снят с показа. Гусь — тоже“.',
          '„Унесённые сквозняком“. Три часа сорок минут, два платочка.',
          '„Поющие под дождём“. Афиша висит криво: кто-то пытался покружиться.',
        ],
      },
      clock: {
        icon: '🕛', label: 'Часы',
        lines: ['Теперь на часах двенадцать. Хоть кто-то умеет исправлять ошибки.', 'Часы тикают. Енот рыдает. Жизнь налаживается.'],
      },
      seat: {
        icon: '💺', label: 'Второй ряд', onUse: seatUse,
        lines: ['Пустой зал. Наконец-то никто не просит выключить телефон.', 'Кресло скрипнуло. Пирожок делает вид, что не слышал.', 'Со второго ряда отлично виден экран. И выход, если фильм не понравится.'],
      },
      fseat: { icon: '🪧', label: 'Кресло с табличкой', secret: 'c_seat', onUse: fseatUse },
    },
    npc: {
      raccoon: [
        { who: 'raccoon', text: 'В титрах столько имён. Всегда думаю: всех ли поблагодарили? И плачу.' },
        { who: 'raccoon', f: 'lotor' },
        { who: 'raccoon', text: 'В мелодраме всё было бы хорошо, если бы герои хотя бы раз нормально поговорили.' },
      ],
    },
    onNpc: async (ctx, id) => {
      if (id === 'raccoon' && ctx.held === 'popcorn' && !ctx.has('c_bun')) { await bunnyShow(ctx); return true; }
      return false;
    },
    enter: async ctx => { paintIdle(ctx); },
    facts: {
      fps24: { text: 'Стандарт 24 кадра в секунду закрепился с приходом звукового кино в конце 1920-х.' },
      lumie: { text: 'Первый платный киносеанс братья Люмьер устроили в Париже 28 декабря 1895 года.' },
      lotor: { text: 'По-латыни я Procyon lotor, а lotor значит „мойщик“. Поэтому я всегда с платочком.' },
      popc: { text: 'Зерно попкорна лопается, потому что вода внутри становится паром и разрывает оболочку.' },
    },
    secrets: [
      { id: 'c_seat', title: 'Место Финалыча', trigger: 'fseat: второй раз — сесть, гусь, свисток' },
      { id: 'c_bun', title: 'Тень-зайчик', trigger: 'тап по еноту с попкорном в руке' },
      { id: 'c_noir', title: 'Сегодня нуар', trigger: 'войти в чёрном банте и графитовом тренче' },
    ],
    stamp: { title: 'Саспенс', icon: '🎬' },
  });
})();
