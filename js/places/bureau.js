/* =====================================================================
   Место прогулки: bureau — Бюро переводов «Lost in Translation» (§7.2).
   Комната — сюжетная (js/rooms/bureau.js, L); здесь расширение для
   прогулки: настольная пробковая доска «Слово недели» (холст 256×180,
   перекрашивается по неделе), рамка вокруг записки вора, ловушки тапа
   для звонка и попугая, золотая звёздочка-значок «Стажёр месяца».
   Точки базы: note, books (словари), cabinet, lost, globe; свои: parrot,
   words, bell. Мини «Перевод с попугайского» — попугай тренируется, она
   помогает (один раунд за визит, без счёта и без проверок).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'bureau';

  // слово недели (§7.2, §9): факт + надпись на карточке
  const WORDS = [
    { f: 'detect', w: 'детектив', o: 'лат. detegere' },
    { f: 'robot', w: 'робот', o: 'из пьесы 1920 года' },
    { f: 'antr', w: 'антракт', o: 'франц. entracte' },
    { f: 'poodle', w: 'пудель', o: 'нем. pudeln' },
    { f: 'choco', w: 'шоколад', o: 'из науатля' },
    { f: 'butter', w: 'бутерброд', o: 'нем. Butterbrot' },
    { f: 'kanik', w: 'каникулы', o: 'лат. canicula' },
  ];
  const wordOf = w => WORDS[Math.max(0, Math.min(6, w))];

  /* ---------- Расширение сюжетной комнаты (только в режиме прогулки) ---------- */
  if (window.City3D && City3D.extendRoom) City3D.extendRoom(P, {
    build(R, base) {
      const { T, PI, put, box, GEO } = R;
      const g = R.group, TOP = 0.95;
      const hidM = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const hit = (key, x, y, z, w, h, d, ry = 0) => { const m = put(g, GEO.box, hidM, [x, y, z], [w, h, d], [0, ry, 0]); m.castShadow = m.receiveShadow = false; m.userData.key = key; return m; };
      const wood = R.pm('#8E6248'), gold = R.pm('#FFD45E');
      const ex = new T.Group(); g.add(ex);

      // записка вора — теперь экспонат: золотая рамка, свечение выключено
      try { if (base.noteGlow) base.noteGlow(false); } catch (e) { /* ignore */ }
      { const fr = new T.Group(); fr.position.set(0, TOP + 0.02, -4.25); fr.rotation.x = -0.55; ex.add(fr);
        [[0, 0.185 + 0.158, 0.46, 0.035], [0, 0.185 - 0.158, 0.46, 0.035]].forEach(([x, y, w, h]) => box(fr, gold, x, y, 0.012, w, h, 0.025));
        [-1, 1].forEach(s => box(fr, gold, s * 0.212, 0.185, 0.012, 0.035, 0.35, 0.025)); }

      // настольная пробковая доска «Слово недели» (стоит перед машинкой — та остаётся в сюжете)
      const [wcv, wc] = R.cnv(256, 180);
      const wTex = R.tex(wcv);
      const paintWord = wk => {
        const it = wordOf(wk), c = wc, q = R.rng(9 + wk);
        c.fillStyle = '#D9A66B'; c.fillRect(0, 0, 256, 180);
        for (let i = 0; i < 260; i++) { c.fillStyle = i % 3 ? 'rgba(140,90,40,.22)' : 'rgba(255,235,200,.25)'; c.fillRect(q() * 256, q() * 180, 2 + q() * 2, 2 + q() * 2); }
        c.save(); c.translate(128, 96); c.rotate(-0.04);
        c.fillStyle = 'rgba(80,50,30,.18)'; R.rrect(c, -100, -62, 204, 132, 8); c.fill();
        c.fillStyle = '#FFFBF0'; R.rrect(c, -104, -68, 204, 132, 8); c.fill();
        c.strokeStyle = '#E8D6B8'; c.lineWidth = 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-92, -10 + k * 18); c.lineTo(88, -10 + k * 18); c.stroke(); }
        R.text(c, 'Слово недели', -2, -46, 22, '#C2405B', { f: 'Caveat', w: 700, max: 180 });
        R.text(c, it.w, -2, 4, 34, '#2F3A5A', { f: 'Comfortaa', w: 700, max: 186 });
        R.text(c, it.o, -2, 42, 17, '#6C7BA8', { w: 800, max: 186 });
        c.restore();
        c.fillStyle = '#C2405B'; c.beginPath(); c.arc(128, 30, 8, 0, 7); c.fill(); c.fillStyle = '#FFD0DA'; c.beginPath(); c.arc(126, 28, 3, 0, 7); c.fill();
        wTex.needsUpdate = true;
      };
      paintWord(0);
      { const bd = new T.Group(); bd.position.set(1.15, TOP, -4.2); bd.rotation.y = -0.12; ex.add(bd);
        const tilt = new T.Group(); tilt.rotation.x = -0.22; bd.add(tilt);
        R.rbox(tilt, wood, 0, 0.27, 0, 0.66, 0.5, 0.035, 0.015);
        const face = put(tilt, GEO.plane, R.toon('#FFFFFF', { map: wTex }), [0, 0.27, 0.019], [0.6, 0.42, 1]); face.castShadow = false;
        box(bd, wood, 0, 0.012, 0.02, 0.5, 0.024, 0.16); }

      // значок «Стажёр месяца» на груди попугая (виден, когда секретик найден)
      const parrot = base.npcs && base.npcs.parrot;
      let star = null;
      if (parrot) {
        const sh = new T.Shape();
        for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? 0.022 : 0.052; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
        sh.closePath();
        star = put(parrot.body, R.keep(new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 })), R.toon('#FFD45E', { emissive: new T.Color('#C9A040'), emissiveIntensity: 0.35 }), [0.0, 0.47, 0.19], null, [-0.2, 0, 0]);
        star.castShadow = false; star.visible = false; star.raycast = () => {};
      }

      R.bake(ex, null, { cast: false });
      ex.traverse(m => { if (m.isMesh) m.raycast = () => {}; });

      // ловушки тапа: доска, звонок (он в склеенной статике базы), попугай с жёрдочкой
      hit('spot:words', 1.15, TOP + 0.28, -4.18, 0.72, 0.6, 0.3);
      hit('spot:bell', -0.74, TOP + 0.07, -4.08, 0.3, 0.22, 0.3);
      hit('spot:parrot', 1.95, 1.15, -4.35, 0.62, 1.55, 0.52);

      // кот запрыгивает на коробку «Потеряно при переводе» и сидит в ней
      const LX = 3.3, LZ = -1.0, LY = 1.0;
      let catY = 0;
      return {
        // в сюжетной базе спавн в 0.9 м от двери; в прогулке — дальше (≥ 1.3 м)
        spawn: { x: -2.6, z: -1.0 },
        catSpot: { x: LX, z: LZ, ry: -0.3 },
        spots: [
          { id: 'parrot', x: 2.35, z: -3.4, act: 'Поговорить', bubble: 'перевод с попугайского' },
          { id: 'words', x: 1.2, z: -3.45, act: 'Прочитать', bubble: 'слово недели' },
          { id: 'bell', x: -1.1, z: -3.5, act: 'Позвонить', bubble: 'звонок' },
        ],
        i3b: { paintWord, star },
        tick(t, dt, ctx) {
          if (!ctx || !ctx.cat || !ctx.cat.root.visible) return;
          const cp = ctx.cat.root.position, on = Math.hypot(cp.x - LX, cp.z - LZ) < 0.1;
          catY += ((on ? LY : 0) - catY) * Math.min(1, dt * (on ? 5 : 9)); cp.y = catY;
        },
      };
    },
  });

  /* ---------- Мини «Перевод с попугайского» ---------- */
  const IDIOMS = [
    { wk: 0, en: 'piece of cake', lit: 'Кусок торта!', ok: 'Проще пареной репы', no: ['Пора на десерт', 'Торт в розыске'] },
    { wk: 0, en: 'it’s raining cats and dogs', lit: 'С неба падают кошки и собаки!', ok: 'Льёт как из ведра', no: ['Животные потерялись', 'Кошки и собаки дружат'], cat: 'Кошки не падают. Кошки приземляются.' },
    { wk: 0, en: 'let the cat out of the bag', lit: 'Выпусти кота из мешка!', ok: 'Проболтаться', no: ['Освободить кота', 'Распаковать покупки'], cat: 'Меня никто не выпускал. Я вышел сам.' },
    { wk: 1, en: 'once in a blue moon', lit: 'Однажды в синюю луну!', ok: 'Раз в сто лет', no: ['Ночью', 'В плохую погоду'] },
    { wk: 2, en: 'when pigs fly', lit: 'Когда свинки полетят!', ok: 'Когда рак на горе свистнет', no: ['Весной', 'В выходные'] },
    { wk: 3, en: 'the ball is in your court', lit: 'Мяч на вашем корте!', ok: 'Твой ход', no: ['Пора на теннис', 'Мяч потерялся'] },
    { wk: 4, en: 'break the ice', lit: 'Разбить лёд молотком!', ok: 'Начать разговор', no: ['Устроить каток', 'Замёрзнуть'] },
    { wk: 5, en: 'it’s not rocket science', lit: 'Это не ракетная наука!', ok: 'Это несложно', no: ['Это про космос', 'Это скучно'] },
    { wk: 6, en: 'on cloud nine', lit: 'На девятом облаке!', ok: 'На седьмом небе', no: ['В самолёте', 'Считает облака'] },
  ];
  const PRACTICE = [
    { who: 'parrot', text: 'Hello — „привет“, goodbye — „пока“. А „пока“ — ещё и „пока что“!' },
    { who: 'parrot', text: 'Повторять полезно! Если не пойму, ещё громче повторю.' },
    { who: 'parrot', text: 'Сегодня выучил три слова. Два уже забыл. Но день отличный!' },
  ];
  const VS = new WeakMap();
  const vs = ctx => { let v = VS.get(ctx); if (!v) { v = {}; VS.set(ctx, v); } return v; };
  const room = ctx => (ctx.is3d && ctx.api && ctx.api.room && ctx.api.room.i3b ? ctx.api.room : null);
  const hopNpc = (ctx, id) => { try { const n = ctx.is3d && ctx.api.npcs && ctx.api.npcs[id]; if (n && n.hop) n.hop(); } catch (e) { /* ignore */ } };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  async function parrotMini(ctx) {
    const v = vs(ctx);
    hopNpc(ctx, 'parrot');
    if (ctx.catHere && ctx.n('catpie') === 1) {
      await ctx.say({ who: 'parrot', text: 'Кот — cat, пирожок — pie. Значит, он кот-пирог?' });
      await ctx.say({ who: 'cat', text: 'Я кот-загадка.', s: 'b_cat' });
    }
    if (v.round) { await ctx.say(PRACTICE[(v.prac = (v.prac || 0) + 1) % PRACTICE.length]); ctx.mark('mini-end'); return true; }
    const pool = IDIOMS.map((x, i) => [x, i]).filter(([x]) => x.wk <= ctx.week);
    const seen = ctx.flag('pq') || 0;
    let cand = pool.filter(([, i]) => !(seen & (1 << i)));
    if (!cand.length) cand = pool;
    const [it, idx] = cand[Math.floor(Math.random() * cand.length)];
    await ctx.say({ who: 'parrot', text: `${it.en.charAt(0).toUpperCase() + it.en.slice(1)}! ${it.lit}` });
    const opts = shuffle([{ label: it.ok, value: 'ok' }, { label: it.no[0], value: 'n1' }, { label: it.no[1], value: 'n2' }]);
    const r = await ctx.choose('Помогите стажёру: что он перевёл?', opts, { who: 'parrot' });
    if (!r) { ctx.mark('mini-end'); return true; }
    v.round = true;
    ctx.flag('pq', seen | (1 << idx));
    if (r === 'ok') {
      hopNpc(ctx, 'parrot'); ctx.sparkle('star'); ctx.haptic('success');
      await ctx.say({ who: 'parrot', text: 'О! Понял! Подождите, сейчас запишу, пока не забыл.' });
      const pr = Math.min(3, (ctx.flag('pr') || 0) + 1);
      if (pr !== ctx.flag('pr')) ctx.flag('pr', pr);
      if (pr >= 3 && !ctx.has('b_int')) {
        const R3 = room(ctx); if (R3 && R3.i3b.star) R3.i3b.star.visible = true;
        await ctx.say({ who: 'fox', text: 'Стажёр месяца! Награда действует до следующего перевода.', s: 'b_int' });
      }
    } else {
      await ctx.say({ who: 'parrot', text: 'Ой. Ладно. Словарь сегодня всё-таки открою.' });
      await ctx.say({ who: 'hero', text: `Это значит «${it.ok}». Готовься записывать.` });
    }
    if (it.cat && ctx.catHere) await ctx.say({ who: 'cat', text: it.cat });
    ctx.mark('mini-end');
    return true;
  }

  // точка, которую можно открыть и тапом по жителю: отметка, реплика и проверка штампа как у точки
  const pop = m => { let n = 0; m = m >>> 0; while (m) { n += m & 1; m >>>= 1; } return n; };
  async function asSpot(ctx, id) {
    const sp = ctx.place.spots[id]; if (!sp) return false;
    ctx.used(id);
    let h = false; if (sp.onUse) h = await sp.onUse(ctx, sp);
    if (!h) await ctx.line(id);
    if (pop(ctx.town.u[Town.REG.places.indexOf(P)] || 0) >= 3) await ctx.giveStamp();
    return true;
  }

  // «Потеряно при переводе»: сначала находка этой недели, потом — прошлых
  const LOST = [
    'Лишняя „н“ для слова „ветреный“. Её не звали — вот она и здесь.',
    'Слово hygge. Перевести не смогли — просто укрыли пледом.',
    'Мягкий знак: без него „мель“ становится „мел“. Мелко.',
    'Смысл фразы „ну такое“. Ищем переводчика с „ну“.',
    'Запятая. Без неё предложение запыхалось.',
    'Слово „уют“. Его не теряли — оно просто прилегло.',
    'Эхо. Вернули в подъезд.',
  ];

  /* ---------- Место ---------- */
  Town.place({
    id: P, kind: 'story',
    name: 'Бюро переводов «Lost in Translation»', short: 'Бюро',
    sign: 'БЮРО ПЕРЕВОДОВ', motto: 'переводы · словари · попугай',
    icon: '🦜', color: '#DCE6F6',
    street: { x: 6.2, w: 3.6, doorDx: 0, bkey: null },
    room: P, opens: 0,
    host: { who: 'fox', npc: 'fox' },
    greet: {
      first: ['Вне протокола? Тогда без печати — проходите.', { who: 'parrot', text: 'Добро пожаловать! Мы переводим всё — иногда даже правильно.' }],
      again: Town.v('Снова к нам. Попугай выучил новое слово ради вас: „снова“.', '{name}! Словари уже открыты на слове „уют“.', { who: 'parrot', text: 'С возвращением! Перевёл это как „с возвращением“ — расту.' }),
      regular: Town.v('Постоянным клиентам переводим без очереди. Очереди, правда, нет.', 'Для вас — без печати и без очереди. Как всегда.', { who: 'parrot', text: 'Я выучил ваше „здравствуйте“ на трёх языках. Путаю все три.' }),
      away: 'Новости бюро: попугай перевёл „hot dog“ как „горячая собачка“. Собачку укрыли пледом.',
    },
    bark: { who: 'parrot', text: 'Снова вы! Это я перевёл без ошибок.' },
    weekly: [1, 2, 3, 4, 5, 6].reduce((o, w) => { o[w] = { who: 'parrot', text: 'Новое слово недели! Уже перевёл — дважды и по-разному.' }; return o; }, {}),
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      bouquet: { who: 'parrot', text: 'По-английски bouquet, по-французски тоже bouquet. Скучно, когда совпадает!' },
      cup: 'Какао на документы не ставим. Ставим на подставку „Смысл“.',
      popcorn: { who: 'parrot', text: 'Попкорн — popcorn. Хоть что-то переводится само.' },
      look: 'Обновили образ? Отмечу в протоколе: „следствие в форме“.',
    },
    spots: {
      parrot: { icon: '🦜', label: 'Стажёр', onUse: ctx => parrotMini(ctx) },
      books: {
        icon: '📚', label: 'Словари',
        lines: [
          { f: 'yo' },
          'Словарь синонимов открыт на слове „уют“: плед, какао, „ещё пять минут“.',
          'Толковый словарь толкует. Бестолковый — отдыхает.',
        ],
      },
      words: {
        icon: '📌', label: 'Слово недели',
        // от слова этой недели к прошлым (невыученное — первым)
        lines: WORDS.slice().reverse().map(x => ({ f: x.f })),
      },
      lost: {
        icon: '📦', label: 'Потеряно при переводе',
        onUse: async ctx => {
          const R3 = room(ctx); if (R3 && R3.popLost) { try { R3.popLost(); } catch (e) { /* ignore */ } }
          const n = ctx.n('lost'), list = []; for (let w = Math.min(6, ctx.week); w >= 0; w--) list.push(LOST[w]);
          await ctx.play(list[(n - 1) % list.length]);
          return true;
        },
      },
      cabinet: {
        icon: '🗄', label: 'Тот самый шкаф',
        lines: [
          'Шкаф пуст. Опись белья висит в рамочке, как картина.',
          'Носок так и не объявился. Розыск продолжается.',
          'Табличка: „Не открывать грозовой ночью“. Сегодня просто облачно — можно.',
        ],
        onUse: async ctx => {
          const R3 = room(ctx);
          if (R3 && R3.openCabinet) { try { R3.openCabinet(900); } catch (e) { /* ignore */ } }
          await ctx.line('cabinet');
          if (R3 && R3.closeCabinet) { await ctx.wait(900); try { R3.closeCabinet(700); } catch (e) { /* ignore */ } }
          return true;
        },
      },
      bell: {
        icon: '🛎', label: 'Звонок',
        onUse: async ctx => {
          ctx.sfx('blip'); hopNpc(ctx, 'parrot');
          const n = ctx.n('bell');
          if (n === 5 && !ctx.has('b_bell')) {
            await ctx.say({ who: 'fox', text: 'Пять звонков — это уже мелодия. Вы позвали Пирожка?', s: 'b_bell' });
            if (ctx.catHere) await ctx.say({ who: 'cat', text: 'Звали?' });
            return true;
          }
          if (n === 1) await ctx.play(['Дзынь!', { who: 'parrot', text: 'Это „здравствуйте“ на языке звонков.' }]);
          else await ctx.play(['Дзынь!', 'Дзынь-дзынь!', 'Дзы-ы-ынь!'][n % 3]);
          return true;
        },
      },
      note: {
        icon: '📝', label: 'Записка вора',
        lines: [
          'Записка вора теперь в золотой рамке. Попугай гордится: „Настоящая улика!“',
          { who: 'parrot', text: 'Я её перевёл! С воровского почерка на русский.' },
          'Под рамкой табличка: „Экспонат. Хранить бережно, читать с удовольствием“.',
        ],
      },
      globe: {
        icon: '🌍', label: 'Глобус',
        lines: [
          'Глобус закрутился. Где остановится — туда и словарь.',
          'На глобусе нарисовано сердечко. Лиса уверяет, что это бюро — в масштабе.',
          { text: 'Пирожок тронул глобус лапой. Мир слегка закружился.', if: c => c.catHere },
        ],
        onUse: async ctx => { const R3 = room(ctx); if (R3 && R3.spinGlobe) { try { R3.spinGlobe(); } catch (e) { /* ignore */ } } return false; },
      },
    },
    npc: {
      fox: [
        { who: 'fox', f: 'ok' },
        { who: 'fox', text: 'С кошачьего не переводим. Пирожок запрещает публиковать стенограммы.' },
        { who: 'fox', text: 'Хороший перевод — когда смысл доехал, а шутка не потерялась по дороге.' },
      ],
    },
    onNpc: async (ctx, id) => (id === 'parrot' ? asSpot(ctx, 'parrot') : false),
    enter: async ctx => {
      const R3 = room(ctx);
      if (!R3) return;
      R3.i3b.paintWord(ctx.week);
      if (R3.i3b.star) R3.i3b.star.visible = ctx.has('b_int');
    },
    facts: {
      yo: { text: 'Букву ё начали печатать в 1790-х, а прославил её Карамзин. С тех пор её всё время теряют.' },
      ok: { text: 'В 1839 году бостонская газета пошутила: oll korrect вместо all correct. Так родилось OK.' },
      detect: { text: '„Детектив“ — от латинского detegere, „снимать покров“.', wk: 0 },
      robot: { text: '„Робот“ — слово из пьесы Карела Чапека 1920 года. Придумал его брат писателя, Йозеф.', wk: 1 },
      antr: { text: '„Антракт“ — от французского entracte, „между актами“.', wk: 2 },
      poodle: { text: '„Пудель“ — от немецкого pudeln, „плескаться“: раньше пудели были водными собаками. Пудра в курсе.', wk: 3 },
      choco: { text: '„Шоколад“ пришёл через испанский из науатля — языка ацтеков.', wk: 4 },
      butter: { text: '„Бутерброд“ — по-немецки просто „масло-хлеб“. Зайка проверила: хлеб на месте.', wk: 5 },
      kanik: { text: '„Каникулы“ — от латинского canicula, „собачка“: так звали Сириус. Жаркие дни его восхода римляне звали „собачьими“.', wk: 6 },
    },
    secrets: [
      { id: 'b_int', title: 'Стажёр месяца', trigger: 'parrot mini: 3rd right answer overall (k.pr)' },
      { id: 'b_bell', title: 'Пять звонков', trigger: 'bell: 5th ring in a session' },
      { id: 'b_cat', title: 'Кот-пирог', trigger: 'parrot with the cat here (first use in a session)' },
    ],
    stamp: { title: 'Бюро', icon: '🦜' },
  });
})();
