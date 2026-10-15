/* =====================================================================
   Место прогулки: stairs — Подъезд (дом с лестницей на крышу).
   Сюжетная комната js/rooms/roof.js (движок делает алиас stairs → roof),
   режим прогулки описан там в блоке «FREE MODE». Хозяева — голуби на подоконнике.
   Точки: stairs, echo (мини «Эхо»), mail, board (объявление недели §9), radiator, window.
   Секретики: l_echo (5-й зов эха за прогулку), l_box (ящики, когда кот рядом), l_cat (3-й раз у батареи с котом).
   Ступеньки вернутся во 2-й серии: каждая реплика «ступенек нет» — только пока !eps[2].done, иначе нейтральная.
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'stairs';

  G.addSpeakers({
    pigeons: { name: () => 'Голуби', art: () => (window.Art && Art.pigeon ? Art.pigeon() : G.emojiAvatar('🐦', '#DCE8F6')) },
    echo: { name: () => 'Эхо', art: null, italic: true },
  });

  // ступеньки ещё не вернулись (до финала 2-й серии)
  const noSteps = ctx => !(ctx.st.eps && ctx.st.eps[2] && ctx.st.eps[2].done);
  const hasSteps = ctx => !noSteps(ctx);
  const N = text => ({ who: 'narrator', text });   // рассказчик: в 3D — пузырёк над голубями, в 2D — реплика

  // объявления на доске по неделям (§9)
  const NOTICES = [
    'Жильцам: ступенек временно нет. Просьба не волноваться.',
    'Собрание голубей в четверг. Повестка и „разное“: крошки.',
    'Кто взял лейку фикуса — верните. Фикус молчит, но переживает.',
    'Енот из кв. 3 просит не обсуждать финалы в подъезде. Финалыч, это вам.',
    'Шарф на лавочке — Кашемиры. Не трогать: он сушится.',
    'Выпал снег. Голуби просят не лепить из него голубей.',
    'Фонари дежурят круглосуточно. Спасибо всем, кто светится.',
  ];
  const noticeText = ctx => {
    const w = Math.max(0, Math.min(6, ctx.week | 0));
    return w === 0 && hasSteps(ctx) ? NOTICES[1] : NOTICES[w];   // объявление о ступеньках — только пока их нет
  };

  // 3D: комната и кадры комнаты (в 2D api.room нет — всё молча пропускается)
  const room = ctx => (ctx.is3d && ctx.api && ctx.api.room) || null;
  const echoFx = (ctx, text) => { const r = room(ctx); if (r && r.echo) r.echo(text); };
  // наехать камерой на предмет, пока идёт реплика; потом вернуть
  async function lookAt(ctx, view, fn, hold) {
    const r = room(ctx), v = r && r.views && r.views[view];
    if (v) ctx.focus(v.pos, v.look);
    try { await fn(); if (v && hold) await ctx.wait(hold); } finally { if (v && !ctx.gone) ctx.release(); }
  }

  Town.place({
    id: P,
    kind: 'story',
    name: 'Подъезд',
    short: 'Подъезд',
    sign: 'ПОДЪЕЗД',
    motto: 'почта · перила · эхо',
    icon: '🪜',
    color: '#DCE8F6',
    street: { x: 23.7, w: 3.7, doorDx: 0, bkey: 'roof' },
    room: 'roof',
    opens: 2,
    host: { who: 'pigeons', npc: 'pigeons' },
    greet: {
      first: [{ who: 'pigeons', text: 'Гуль-гуль.' }, N('Голуби приветствуют. Официально.')],
      again: Town.v(N('Голуби узнали вас. Кивают синхронно.'), N('Голуби подвинулись на подоконнике. Это значит „привет“.'), N('Голуби здороваются: один — „гуль“, другой — „гуль-гуль“.')),
      regular: Town.v(N('Голуби освобождают вам подоконник. Высшая честь.'), N('Голуби даже не вспорхнули. Вы тут своя.'), N('Голуби кивают вам, как старой знакомой.')),
      away: N('Голуби провели собрание о вашем отсутствии. Решение: ждать.'),
    },
    bark: { who: 'pigeons', text: 'Гуль!' },
    weekly: { 1: N('На доске новое объявление. Голуби уже обсудили.'), 2: N('На доске новое объявление. Голуби уже обсудили.'), 3: N('На доске новое объявление. Голуби уже обсудили.'), 4: N('На доске новое объявление. Голуби уже обсудили.'), 5: N('На доске новое объявление. Голуби уже обсудили.'), 6: N('На доске новое объявление. Голуби уже обсудили.') },
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      cup: N('Голуби смотрят на какао, какао — на голубей. Переговоры зашли в тупик.'),
      popcorn: N('Голуби притворились, что им всё равно. Получилось плохо.'),
      bouquet: N('Голуби уважительно отходят от букета. Ценят флористику.'),
    },
    spots: {   // ПОРЯДОК ЗАМОРОЖЕН (биты town.u)
      stairs: {
        icon: '🪜', label: 'Где ступеньки?',
        lines: [
          { text: 'Перила есть, ступенек нет. Перила держатся молодцом.', if: noSteps },
          { text: 'Табличка: „Ступеньки на обеде“. Обед, видимо, из трёх блюд.', if: noSteps },
          { text: 'Наверх пока никак. Перила ждут ступеньки.', if: noSteps },
          { text: 'Ступеньки — дело тонкое. Голуби следят за ситуацией.', if: hasSteps },
        ],
      },
      echo: {
        icon: '🗣', label: 'Позвать эхо', secret: 'l_echo',
        onUse: async ctx => {
          // пятый зов за прогулку: эхо впервые говорит само
          if (ctx.n('echo') === 5 && !ctx.has('l_echo')) {
            echoFx(ctx, 'Привет!');
            await ctx.say([{ who: 'echo', text: '…а можно я сама? Привет!' }, { text: 'Первое собственное слово эха. Внесено в протокол.', s: 'l_echo' }]);
          }
          const v = await ctx.choose('Что крикнуть наверх?', [{ label: 'Ау!', value: 'au' }, { label: 'Какао!', value: 'cocoa' }, { label: 'Пирожок молодец?', value: 'cat' }]);
          if (!v) return true;
          const rep = { au: '…ау!', cocoa: '…као-као!', cat: '…лодец!' }[v];
          echoFx(ctx, rep);
          await ctx.say({ who: 'echo', text: rep });
          if (v === 'cat') await ctx.say({ who: 'cat', text: 'Слышала? Эхо подтверждает.', if: c => c.catHere });
          return true;
        },
      },
      mail: {
        icon: '📬', label: 'Почтовые ящики', secret: 'l_box',
        lines: [
          '„Енот, кв. 3. Платочки не присылать — есть“.',
          { f: 'penny' },
          '„Финалыч. Письма читает с последней строчки“.',
        ],
        onUse: async ctx => {
          if (!ctx.catHere || ctx.has('l_box')) { await lookAt(ctx, 'mail', () => ctx.line('mail'), 1200); return true; }
          // кот рядом: запрыгнул на ящики — открылась дверца «Ступенек»
          const r = room(ctx);
          if (r) { await Promise.race([ctx.api.catTo(-3.3, -2.75, { ry: -1.3 }), ctx.wait(2600)]); if (r.popMail) r.popMail(); }
          try {
            await lookAt(ctx, 'mail', () => ctx.say([{ text: 'Пирожок запрыгнул на ящики, и одна дверца открылась.' }, { text: 'Ящик „Ступеньки“. Переполнен: им пишут все жильцы.', s: 'l_box' }]));
          } finally { if (r && !ctx.gone) { if (r.closeMail) r.closeMail(); ctx.api.catFree(); } }
          return true;
        },
      },
      board: {
        icon: '📌', label: 'Объявления',
        lines: [[
          ctx => `Объявление недели: «${noticeText(ctx)}»`,
          { text: 'Разыскиваются ступеньки. Особые приметы: идут по порядку.', if: noSteps },
          { text: 'Объявление: „Перила протёрты. Не благодарите“.', if: hasSteps },
        ]],
        onUse: async ctx => { await lookAt(ctx, 'board', () => ctx.line('board'), 1400); return true; },
      },
      radiator: {
        icon: '♨️', label: 'Батарея', secret: 'l_cat',
        lines: [
          { text: 'Пирожок занял батарею. Это его официальный пост.', if: c => c.catHere },
          { text: 'Батарея тёплая. Кто-то пушистый её недавно грел.', if: c => !c.catHere },
        ],
        onUse: async ctx => {
          if (!ctx.catHere) return false;
          if (room(ctx)) Promise.resolve(ctx.api.catTo(3.5, -2.35, { ry: -0.5 })).catch(() => {});   // кот — на свой коврик у батареи
          if (ctx.n('radcat') >= 3 && !ctx.has('l_cat')) {
            await ctx.say({ who: 'cat', text: 'Батарея — это маленькое солнце. Я его сторожу, пока большое в розыске.', s: 'l_cat' });
            return true;
          }
          return false;
        },
      },
      window: {
        icon: '🪟', label: 'Окно',
        lines: [
          { f: 'cloud' },
          'Голубь на карнизе смотрит на облака, облака — на голубя. Ничья.',
        ],
        onUse: async ctx => { await lookAt(ctx, 'window', () => ctx.line('window'), 900); return true; },
      },
    },
    npc: {
      pigeons: [   // факт всё равно идёт первым, пока не выучен; после него цикл начнётся с «Гуль»
        'Гуль. (Голубь считает, что разговор удался.)',
        { f: 'monet' },
      ],
    },
    enter: async ctx => {
      const r = room(ctx);
      if (r && r.paintBoard) r.paintBoard(noticeText(ctx));
    },
    facts: {
      penny: { text: 'На ящике марка-сувенир: „Чёрный пенни“, Британия, 1840. Первая почтовая марка в мире.', wk: 0 },
      cloud: { text: 'Обычное кучевое облако весит около 500 тонн — и висит. Вот это выдержка.', wk: 0 },
      monet: { text: 'Голуби умеют отличать Моне от Пикассо. В 1995 году это проверили учёные — и получили Шнобелевскую премию.', wk: 0 },
    },
    secrets: [
      { id: 'l_echo', title: 'Первое слово эха', trigger: 'пятый зов эха за одну прогулку' },
      { id: 'l_box', title: 'Письма ступенькам', trigger: 'почтовые ящики, когда кот рядом' },
      { id: 'l_cat', title: 'Маленькое солнце', trigger: 'третий раз у батареи вместе с котом' },
    ],
    stamp: { title: 'Подъезд', icon: '🪜' },
  });
})();
