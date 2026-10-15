/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: лавки по одному шаблону (§2.5 world_unify).
   Каждая лавка — комната движка (City3D.registerRoom('g_…')) 7 × 5 м: прилавок у задней стены, за ним хозяин —
   «круглый зверёк» (уши, мордочка, фартук), полка с реквизитом темы, окно, столик с двумя стульями (на втором — подушка,
   на неё садится кот: пустого второго места нет), дверь-выход слева.
   Точки: host — поговорить (приветствие, потом правдивый факт), thing — маленькое дело на 5–10 с, shelf — посмотреть,
   sit — присесть, buy (волна 4, у «Кренделя» и «Зефира») — купить: хозяин протягивает крендель / какао через прилавок,
   героиня берёт его настоящей рукой (js/interact.js через api.takeItem комнаты) и сама откусывает / отпивает; купленное
   выходит с ней на улицу (City3D.lastHeld → WORLD.visitShop отдаёт { v, held }). Штампов паспорта лавки не дают; первое посещение — бит в st.world.g (пишет город).
   Реплики — литералом { who, text } (их собирает tools/voice_lines.js; голоса хозяев — пресеты VOICE).
   Правила: мило и коротко; чая нет (в кафе — какао); брендов и романтики нет; имя героини голосом не звучит.
   Факты (проверены): крендель ← нем. Kringel «колечко»; у ацтеков какао-бобы были деньгами; teddy bear — в честь Теодора
   «Тедди» Рузвельта; «почта» ← польск. poczta ← итал. posta; радуга на пузыре — свет, отражённый от двух сторон тонкой плёнки;
   «натюрморт» ← фр. nature morte «мёртвая природа»; «зонтик» ← голл. zondek «навес от солнца»; sweater ← sweat «потеть».
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;

  const I = WORLD.INTERIORS = {
    g_bakery: {
      label: '«Крендель» · пекарня', short: 'Пекарня', theme: 'bakery',
      front: { sign: 'Крендель', sub: 'пекарня', col: '#C27A3E', awning: '#F3CF73', door: '#A9693A', goods: ['#E3A55E', '#F3D9A8', '#C98A4A'] },
      look: { wall: '#F7E4CF', wall2: '#EBCBA9', floor: '#C79B74', accent: '#E3A55E', bg: 'radial-gradient(130% 90% at 50% 30%, #6E4A3A 0%, #3B2A2A 72%)' },
      host: { id: 'g_mouse', name: 'Мышка Сайка', emoji: '🐭', body: '#CFC6D2', belly: '#F3EEF2', ear: 'round', apron: '#FFF6EE', hat: 'chef', nose: '#E8798F' },
      hello: [{ who: 'g_mouse', text: 'Заходи, заходи! Только что из печи — пахнет так, что даже часы идут медленнее.' }],
      again: [{ who: 'g_mouse', text: 'Снова ты! Крендель тебя узнал. Ну, почти.' }],
      fact: [{ who: 'g_mouse', text: 'Знаешь, откуда «крендель»? От немецкого Kringel — «колечко». Вот оно, колечко, только вкусное.' }],
      talk: [{ who: 'g_mouse', text: 'Я встаю раньше солнца. Сейчас это, правда, несложно.' }, { who: 'g_mouse', text: 'Корица — на удачу. Шучу, на вкус.' }],
      thing: { act: 'Посыпать', bubble: 'крендель', lines: [{ who: 'g_mouse', text: 'Чуть-чуть сахарной пудры — и крендель как в первом снегу!' }] },
      buy: { act: 'Крендель', bubble: 'тёплый крендель', kind: 'pretzel', lines: [{ who: 'g_mouse', text: 'Крендель с пылу с жару! Держи, только осторожно: сахарная пудра любит носы.' }] },
      shelf: { act: 'Смотреть', bubble: 'полка с хлебом', lines: [{ text: 'Батоны стоят по росту. Самый маленький — бублик — делает вид, что он тоже батон.' }] },
    },
    g_cocoa: {
      label: '«Зефир» · какао', short: 'Какао', theme: 'cocoa',
      front: { sign: 'Зефир', sub: 'какао', col: '#9C5B4A', awning: '#F7C9D3', door: '#8A4E40', goods: ['#F7C9D3', '#FFFDF9', '#B07A5A'] },
      look: { wall: '#F6E1E4', wall2: '#E8C3C8', floor: '#B9876E', accent: '#F7C9D3', bg: 'radial-gradient(130% 90% at 50% 30%, #6A3F48 0%, #3A2430 72%)' },
      host: { id: 'g_llama', name: 'Лама Мокко', emoji: '🦙', body: '#F3E6D2', belly: '#FFF7EC', ear: 'long', apron: '#9C5B4A', hat: 'none', nose: '#B07A5A', neck: true },
      hello: [{ who: 'g_llama', text: 'Добро пожаловать в «Зефир»! Какао горячее, зефирки мягкие, настроение — по желанию.' }],
      again: [{ who: 'g_llama', text: 'О, снова ты! Твоя чашка уже соскучилась.' }],
      fact: [{ who: 'g_llama', text: 'У ацтеков какао-бобы ходили вместо денег. Так что у меня тут, считай, маленький банк.' }],
      talk: [{ who: 'g_llama', text: 'Секрет хорошего какао — не торопиться. И зефирка сверху. Две зефирки — это уже праздник.' }],
      thing: { act: 'Рисовать', bubble: 'листик на пенке', lines: [{ who: 'g_llama', text: 'Листик на пенке! Ровненький. Можно я сфотографирую на память?' }] },
      buy: { act: 'Какао', bubble: 'какао с зефирками', kind: 'cup', data: { liquid: '#8B5A3C', foam: true }, lines: [{ who: 'g_llama', text: 'Какао с двумя зефирками. Держи крепче — оно тёплое.' }] },
      shelf: { act: 'Смотреть', bubble: 'полка с чашками', lines: [{ text: 'Чашки в горошек, в полоску и одна с кошачьими ушками. Её, говорят, всегда выбирают первой.' }] },
    },
    g_toys: {
      label: '«Юла» · игрушки', short: 'Игрушки', theme: 'toys',
      front: { sign: 'Юла', sub: 'игрушки', col: '#5E8FC2', awning: '#9DB8E0', door: '#4E78A8', goods: ['#F08FA8', '#F3CF73', '#9DB8E0'] },
      look: { wall: '#E6EEF8', wall2: '#C9D8EC', floor: '#C9A27E', accent: '#9DB8E0', bg: 'radial-gradient(130% 90% at 50% 30%, #3E4E6E 0%, #252C42 72%)' },
      host: { id: 'g_bear', name: 'Медвежонок Мишутка', emoji: '🧸', body: '#C79A6E', belly: '#EBD3B6', ear: 'round', apron: '#5E8FC2', hat: 'none', nose: '#5A3E36' },
      hello: [{ who: 'g_bear', text: 'Ой, покупатель! То есть друг. У нас можно просто смотреть — игрушкам нравится, когда на них смотрят.' }],
      again: [{ who: 'g_bear', text: 'Привет! Юлы спрашивали, придёшь ли ты. Я сказал: обязательно.' }],
      fact: [{ who: 'g_bear', text: 'Плюшевого мишку по-английски зовут teddy bear — в честь Теодора «Тедди» Рузвельта. Мы, медведи, этим гордимся.' }],
      talk: [{ who: 'g_bear', text: 'Самая важная игрушка — та, которую обнимают. Остальные просто стоят красиво.' }],
      thing: { act: 'Завести', bubble: 'юла', spin: true, lines: [{ who: 'g_bear', text: 'Юла жужжит и танцует! И ты тоже немножко. Это заразно.' }] },
      // волна 5: пищащий молоточек для «Бум!» понарошку (js/playfight.js): в руке — кнопка «Пиу!»
      buy: { act: 'Молоточек', bubble: 'пищащий молоточек', kind: 'squeaky_hammer', lines: [{ who: 'g_bear', text: 'Пищащий молоточек! Стучит только «пиу-пиу». Проверено на мне — щекотно.' }] },
      shelf: { act: 'Смотреть', bubble: 'полка с игрушками', lines: [{ text: 'Кубики сложены в башню. Сверху сидит заяц и уверяет, что так и задумано.' }] },
    },
    g_post: {
      label: '«Почта»', short: 'Почта', theme: 'post',
      front: { sign: 'Почта', sub: 'письма и посылки', col: '#3E7FA6', awning: '#BFD8EA', door: '#356C8E', goods: ['#E8D3B6', '#F08FA8', '#BFD8EA'] },
      look: { wall: '#E3EFF4', wall2: '#C3DBE6', floor: '#B79678', accent: '#7FA6C9', bg: 'radial-gradient(130% 90% at 50% 30%, #35506A 0%, #222E40 72%)' },
      host: { id: 'g_stork', name: 'Аист Депеша', emoji: '🕊', body: '#FFFDF9', belly: '#FFFFFF', ear: 'none', apron: '#3E7FA6', hat: 'cap', nose: '#F3A65A', beak: true },
      hello: [{ who: 'g_stork', text: 'Почта открыта! Письма сортирую по настроению: весёлые — наверх.' }],
      again: [{ who: 'g_stork', text: 'А, снова ты! Писем пока нет. Зато есть я.' }],
      fact: [{ who: 'g_stork', text: 'Слово «почта» пришло к нам через польское poczta, а туда — из итальянского posta. Длинный путь, как у хорошего письма.' }],
      talk: [{ who: 'g_stork', text: 'Самая быстрая почта — открытка, отправленная с улыбкой. Проверено на голубях.' }],
      thing: { act: 'Штемпель', bubble: 'открытка', lines: [{ who: 'g_stork', text: 'Бам! Штемпель стоит. Открытка «Солнцу, лично в руки» ждёт адресата.' }] },
      shelf: { act: 'Смотреть', bubble: 'посылки', lines: [{ text: 'Посылки перевязаны бечёвкой. На одной написано «Не трясти: внутри хорошее настроение».' }] },
    },
    g_wash: {
      label: '«Пузырь» · прачечная', short: 'Прачечная', theme: 'wash',
      front: { sign: 'Пузырь', sub: 'прачечная', col: '#5AA0B8', awning: '#CDEAF2', door: '#4A8AA0', goods: ['#CDEAF2', '#FFFDF9', '#F7C9D3'] },
      look: { wall: '#E6F4F6', wall2: '#C6E2E8', floor: '#B7A08C', accent: '#9FD4E2', bg: 'radial-gradient(130% 90% at 50% 30%, #2F5662 0%, #1F3540 72%)' },
      host: { id: 'g_hippo', name: 'Бегемотик Плюх', emoji: '🦛', body: '#B8A9D9', belly: '#D9CFEE', ear: 'small', apron: '#5AA0B8', hat: 'none', nose: '#8E7DB8', wide: true },
      hello: [{ who: 'g_hippo', text: 'Плюх! Ой, это я, а не стиралка. Заходи, тут тепло и пахнет чистотой.' }],
      again: [{ who: 'g_hippo', text: 'Привет-привет! Носки ещё сохнут. Носки — дело неторопливое.' }],
      fact: [{ who: 'g_hippo', text: 'Видишь радугу на пузыре? Это свет отражается от двух сторон тонкой плёнки — и цвета складываются.' }],
      talk: [{ who: 'g_hippo', text: 'Я люблю пену. Пена любит меня. У нас взаимопонимание.' }],
      thing: { act: 'Сложить', bubble: 'шарф', lines: [{ who: 'g_hippo', text: 'Шарф сложен ровно-ровно! Хоть сейчас на витрину.' }] },
      shelf: { act: 'Смотреть', bubble: 'полотенца', lines: [{ text: 'Полотенца сложены стопками по цвету. Розовое выглядит самым довольным.' }] },
    },
    g_gallery: {
      label: '«Рама» · галерея', short: 'Галерея', theme: 'gallery',
      front: { sign: 'Рама', sub: 'галерея', col: '#8A6AA8', awning: '#D8CCEA', door: '#745A90', goods: ['#E8C770', '#D8CCEA', '#9DB08E'] },
      look: { wall: '#F3EEF6', wall2: '#DDD2E8', floor: '#B89A82', accent: '#E8C770', bg: 'radial-gradient(130% 90% at 50% 30%, #4E3E62 0%, #2E2640 72%)' },
      host: { id: 'g_giraffe', name: 'Жираф Штрих', emoji: '🦒', body: '#F2CF7E', belly: '#FBE7B8', ear: 'small', apron: '#8A6AA8', hat: 'beret', nose: '#B98A4A', neck: true, spots: '#C9915A' },
      hello: [{ who: 'g_giraffe', text: 'Добро пожаловать в «Раму». Смотреть можно долго, трогать — глазами.' }],
      again: [{ who: 'g_giraffe', text: 'О, наш постоянный зритель! Картины рады тебя видеть. Особенно груши.' }],
      fact: [{ who: 'g_giraffe', text: '«Натюрморт» — от французского nature morte, буквально «мёртвая природа». А на картине просто груши. Живые и весёлые.' }],
      talk: [{ who: 'g_giraffe', text: 'С моим ростом я вижу каждую картину сверху. Снизу, говорят, тоже красиво.' }],
      thing: { act: 'Поправить', bubble: 'косая картина', lines: [{ who: 'g_giraffe', text: 'Ровно! Груши на картине, кажется, выдохнули с облегчением.' }] },
      shelf: { act: 'Смотреть', bubble: 'наброски', lines: [{ text: 'Папка с набросками: облака, коты, ещё облака. Видно, что художник смотрел вверх.' }] },
    },
    g_umbrella: {
      label: '«Капля» · зонтики', short: 'Зонтики', theme: 'umbrella',
      front: { sign: 'Капля', sub: 'зонтики', col: '#D9657E', awning: '#F7C9D3', door: '#B85068', goods: ['#F08FA8', '#9DB8E0', '#F3CF73'] },
      look: { wall: '#FBEAEE', wall2: '#F0CCD5', floor: '#B98F7C', accent: '#F08FA8', bg: 'radial-gradient(130% 90% at 50% 30%, #6A3A4C 0%, #3A2230 72%)' },
      host: { id: 'g_duck', name: 'Утка Капа', emoji: '🦆', body: '#FFE58A', belly: '#FFF4C2', ear: 'none', apron: '#D9657E', hat: 'none', nose: '#F3A65A', beak: true },
      hello: [{ who: 'g_duck', text: 'Кря! Заходи под крышу. Зонтики любой расцветки, даже в горошек.' }],
      again: [{ who: 'g_duck', text: 'Кря-кря, снова ты! Зонтик в горошек всё ещё ждёт.' }],
      fact: [{ who: 'g_duck', text: 'Слово «зонтик» — от голландского zondek, «навес от солнца». Так что зонтики — родственники солнца.' }],
      talk: [{ who: 'g_duck', text: 'Мне самой зонтик не нужен: вода с утки скатывается. Но красиво же!' }],
      thing: { act: 'Раскрыть', bubble: 'зонтик в горошек', lines: [{ who: 'g_duck', text: 'Хлоп! Раскрылся, как цветок. Тебе очень идёт горошек.' }] },
      shelf: { act: 'Смотреть', bubble: 'подставка', lines: [{ text: 'В подставке стоят зонтики-трости. Один, с ручкой-уточкой, явно здешний любимчик.' }] },
    },
    g_yarn: {
      label: '«Клубок» · пряжа', short: 'Пряжа', theme: 'yarn',
      front: { sign: 'Клубок', sub: 'пряжа', col: '#B0705A', awning: '#F3D2B0', door: '#965E4A', goods: ['#EFA3B5', '#C7A8DD', '#F3CF73'] },
      look: { wall: '#FAEDE4', wall2: '#EED5C4', floor: '#B48E76', accent: '#EFA3B5', bg: 'radial-gradient(130% 90% at 50% 30%, #644036 0%, #3A2622 72%)' },
      host: { id: 'g_alpaca', name: 'Альпака Пряжа', emoji: '🦙', body: '#FFF6EE', belly: '#FFFFFF', ear: 'long', apron: '#B0705A', hat: 'none', nose: '#C9A08A', neck: true, fluffy: true },
      hello: [{ who: 'g_alpaca', text: 'Привет! Пряжа своя, тёплая, немножко с характером. Смотри, выбирай, гладь.' }],
      again: [{ who: 'g_alpaca', text: 'Ты вернулась! Клубки сразу повеселели.' }],
      fact: [{ who: 'g_alpaca', text: 'Английское sweater — от sweat, «потеть»: сначала в свитерах тренировались спортсмены. А теперь в них просто уютно.' }],
      talk: [{ who: 'g_alpaca', text: 'Вяжу шарфики фонарям. Фонари не жалуются, значит, нравится.' }],
      thing: { act: 'Смотать', bubble: 'клубок', lines: [{ who: 'g_alpaca', text: 'Клубок смотан! У тебя лёгкая рука, это сразу видно.' }] },
      shelf: { act: 'Смотреть', bubble: 'корзина пряжи', lines: [{ text: 'Корзина клубков всех цветов осени. Один клубок укатился и делает вид, что так и было.' }] },
    },
  };
  // говорящие лавок: имя и значок в окне диалога
  const regSpeakers = () => {
    const G = window.G; if (!G || !G.addSpeakers) return;
    const sp = {};
    Object.keys(I).forEach(id => { const h = I[id].host; sp[h.id] = { name: () => h.name, art: () => G.emojiAvatar(h.emoji || '✦', '#FBE1E7') }; });
    G.addSpeakers(sp);
  };
  regSpeakers();

  /* ---------- шаблон комнаты ---------- */
  if (!window.City3D || !City3D.registerRoom) return;
  const W = 7, D = 5, HGT = 3.2;
  const P_BUY = [-0.75, -2.75];   // точка «купить» (волна 4) — левый край прилавка
  function host3d(R, id, h) {
    const { T, GEO } = R;
    return R.makeNpc(h.id, ({ n, body, P, face, M }) => {
      const fur = M(h.body), belly = M(h.belly), ap = M(h.apron), dark = M('#5A4A55');
      const wide = h.wide ? 1.25 : 1;
      P(body, GEO.sph, fur, [0, 0.42, 0], [0.25 * wide, 0.3, 0.23]);
      P(body, GEO.sph, belly, [0, 0.4, 0.12], [0.16 * wide, 0.19, 0.11], null, false);
      P(body, R.keep(new T.CylinderGeometry(0.22 * wide, 0.26 * wide, 0.32, 16, 1, true, -1.1, 2.2)), ap, [0, 0.36, 0.01], [1, 1, 0.98], null, false).material.side = T.DoubleSide;
      [-1, 1].forEach(sd => { P(body, GEO.sph, fur, [sd * 0.1, 0.06, 0.05], [0.08, 0.06, 0.1]); P(body, GEO.sph, fur, [sd * 0.24 * wide, 0.46, 0.06], [0.06, 0.13, 0.06], [0.3, 0, sd * 0.5]); });
      const head = new T.Group(); head.position.set(0, h.neck ? 1.05 : 0.88, 0.02); body.add(head); n.head = head;
      if (h.neck) { P(body, GEO.cyl, fur, [0, 0.8, 0.02], [0.09, 0.4, 0.09]); if (h.spots) [[0.05, 0.72, 0.08], [-0.06, 0.86, 0.07], [0.04, 0.95, 0.075]].forEach(q => P(body, GEO.sph, M(h.spots), q, [0.035, 0.035, 0.02], null, false)); }
      if (h.fluffy) [[0, 0.15, 0], [0.1, 0.12, 0.02], [-0.1, 0.12, 0.02]].forEach(q => P(head, GEO.sph, fur, q, [0.1, 0.08, 0.1]));
      P(head, GEO.sph, fur, [0, 0, 0], [0.23 * (h.wide ? 1.15 : 1), 0.21, 0.21]);
      const f = { nose: h.beak ? null : h.nose, mouth: h.beak ? null : 'smile', ey: 352, lash: true, muzzle: h.wide ? h.belly : null, muzzleW: 120 };
      face(head, f, [0.23 * (h.wide ? 1.15 : 1), 0.21, 0.21]);
      if (h.beak) { P(head, GEO.cone, M(h.nose), [0, -0.04, 0.22], [0.06, 0.12, 0.04], [PI / 2, 0, 0]); }
      if (h.ear === 'round') n.ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(sd * 0.15, 0.16, -0.02); head.add(e); P(e, GEO.sph, fur, [0, 0, 0], [0.08, 0.08, 0.03]); P(e, GEO.sph, M('#F7B9C4'), [0, 0, 0.015], [0.05, 0.05, 0.02], null, false); return e; });
      else if (h.ear === 'long') n.ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(sd * 0.1, 0.17, -0.03); e.rotation.z = -sd * 0.18; head.add(e); P(e, GEO.sph, fur, [0, 0.1, 0], [0.04, 0.12, 0.035]); return e; });
      else if (h.ear === 'small') n.ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(sd * 0.15, 0.17, -0.02); head.add(e); P(e, GEO.sph, fur, [0, 0, 0], [0.045, 0.05, 0.03]); return e; });
      if (h.hat === 'chef') { const hg = new T.Group(); hg.position.set(0, 0.19, 0.03); head.add(hg); P(hg, GEO.cyl, M('#F2EBE6'), [0, 0, 0], [0.13, 0.07, 0.13]); [[-0.06, 0.09, 0], [0.06, 0.09, 0], [0, 0.12, 0.02], [0, 0.1, -0.05]].forEach(q => P(hg, GEO.sph, M('#FFFDF9'), q, [0.08, 0.07, 0.08])); }
      else if (h.hat === 'cap') { const hg = new T.Group(); hg.position.set(0, 0.17, 0); hg.rotation.x = -0.12; head.add(hg); P(hg, GEO.hemi, M(h.apron), [0, 0, 0], [0.17, 0.1, 0.17]); P(hg, GEO.box, M(h.apron), [0, 0.005, 0.14], [0.2, 0.025, 0.12], null, false); }
      else if (h.hat === 'beret') { const hg = new T.Group(); hg.position.set(0.03, 0.18, 0); hg.rotation.z = -0.25; head.add(hg); P(hg, GEO.sph, M(h.apron), [0, 0, 0], [0.16, 0.05, 0.16]); }
      void dark;
      n.extra = t => { (n.ears || []).forEach((e, i) => { e.rotation.x = Math.max(0, Math.sin(t * 1.1 + i + n.ph)) * 0.18; }); };
    });
  }
  // реквизит темы на полке (левая стена) и на прилавке
  function props(R, g, theme, P) {
    const { put, sph, cyl, rbox, box, toon, GEO, T } = R;
    const S = (x, y, z, r, c) => sph(g, toon(c), x, y, z, r, r, r);
    const shelfX = -W / 2 + 0.32;
    const rows = [0.75, 1.35, 1.95];
    const cell = (i, j) => [shelfX, rows[j] + 0.05, -3.8 + i * 0.42];
    const each = fn => { for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) fn(...cell(i, j), i, j); };
    if (theme === 'bakery') {
      each((x, y, z, i, j) => { if ((i + j) % 2) { put(g, GEO.sph, toon('#D9965A'), [x, y + 0.08, z], [0.16, 0.09, 0.09]); } else { put(g, R.keep(new T.TorusGeometry(0.08, 0.035, 8, 16)), toon('#C98A4A'), [x, y + 0.06, z], null, [0, PI / 2, 0]); } });
      put(g, R.keep(new T.TorusGeometry(0.13, 0.05, 10, 20)), toon('#C27A3E'), [P.thing[0], 0.96, P.thing[1] - 0.45], null, [-PI / 2.4, 0, 0]);
    } else if (theme === 'cocoa') {
      each((x, y, z, i, j) => { const c = ['#F7C9D3', '#FFFDF9', '#9DB8E0', '#F3CF73'][(i + j) % 4]; cyl(g, toon(c), x, y + 0.08, z, 0.07, 0.15); });
      cyl(g, toon('#FFFDF9'), P.thing[0], 0.97, P.thing[1] - 0.45, 0.09, 0.16); cyl(g, toon('#C9A27E'), P.thing[0], 1.055, P.thing[1] - 0.45, 0.08, 0.01);
    } else if (theme === 'toys') {
      each((x, y, z, i, j) => { const c = ['#F08FA8', '#F3CF73', '#9DB8E0', '#9DB08E'][(i + j) % 4]; if (j === 1) { put(g, GEO.cone, toon(c), [x, y + 0.12, z], [0.09, 0.16, 0.09], [PI, 0, 0]); } else box(g, toon(c), x, y + 0.08, z, 0.14, 0.14, 0.14); });
      put(g, GEO.cone, toon('#F08FA8'), [P.thing[0], 0.98, P.thing[1] - 0.45], [0.12, 0.18, 0.12], [PI, 0, 0]); S(P.thing[0], 1.09, P.thing[1] - 0.45, 0.03, '#F3CF73');
    } else if (theme === 'post') {
      each((x, y, z, i, j) => { const c = ['#E8D3B6', '#F6E7D0', '#D9B98E'][(i + j) % 3]; rbox(g, toon(c), x, y + 0.08, z, 0.22, 0.16, 0.32, 0.02); box(g, toon('#B0705A'), x + 0.112, y + 0.08, z, 0.005, 0.17, 0.02); });
      rbox(g, toon('#FFF6EE'), P.thing[0], 0.9, P.thing[1] - 0.45, 0.3, 0.012, 0.2, 0.004); cyl(g, toon('#3E7FA6'), P.thing[0] + 0.25, 0.95, P.thing[1] - 0.45, 0.035, 0.12);
    } else if (theme === 'wash') {
      each((x, y, z, i, j) => { const c = ['#F7C9D3', '#CDEAF2', '#FFFDF9', '#F3CF73'][(i + j) % 4]; rbox(g, toon(c), x, y + 0.07, z, 0.26, 0.12, 0.34, 0.04); });
      for (let k = 0; k < 6; k++) { const m = sph(g, R.keep(new T.MeshBasicMaterial({ color: ['#CDEAF2', '#F7C9D3', '#D8CCEA'][k % 3], transparent: true, opacity: 0.55, depthWrite: false })), 1.6 + Math.sin(k) * 0.5, 2.2 + k * 0.12, -4.4 + Math.cos(k * 2) * 0.3, 0.06 + (k % 3) * 0.02); m.castShadow = false; }
      rbox(g, toon('#F08FA8'), P.thing[0], 0.91, P.thing[1] - 0.45, 0.32, 0.05, 0.2, 0.02);
    } else if (theme === 'gallery') {
      each((x, y, z, i, j) => { if (j === 2) return; rbox(g, toon('#E8C770'), x, y + 0.18, z, 0.04, 0.32, 0.28, 0.01); put(g, GEO.plane, toon(['#9DB08E', '#F3CF73', '#9DB8E0', '#F08FA8'][(i + j) % 4]), [x + 0.025, y + 0.18, z], [0.22, 0.25, 1], [0, PI / 2, 0]).castShadow = false; });
    } else if (theme === 'umbrella') {
      each((x, y, z, i, j) => { if (j === 2) return; const c = ['#F08FA8', '#9DB8E0', '#F3CF73', '#9DB08E'][(i + j) % 4]; put(g, GEO.cone, toon(c), [x, y + 0.25, z], [0.07, 0.42, 0.07]); });
      put(g, GEO.hemi, toon('#F08FA8'), [P.thing[0], 1.2, P.thing[1] - 0.45], [0.36, 0.2, 0.36]); cyl(g, toon('#6A5670'), P.thing[0], 1.0, P.thing[1] - 0.45, 0.012, 0.4);
    } else if (theme === 'yarn') {
      each((x, y, z, i, j) => { const c = ['#EFA3B5', '#C7A8DD', '#F3CF73', '#9DB08E', '#F7B267'][(i + j * 2) % 5]; S(x, y + 0.1, z, 0.1, c); });
      S(P.thing[0], 0.97, P.thing[1] - 0.45, 0.1, '#EFA3B5');
    }
  }

  Object.keys(I).forEach(id => {
    const def = I[id], L = def.look;
    City3D.registerRoom(id, {
      look: { sky: '#F6E8EC', gnd: '#C9A39A', hi: 0.7, sun: '#FFE4C8', si: 0.46, off: [-3, 7.5, 6], bg: L.bg, rim: ['#FFD9C0', 0.2], fog: '#3B2A3C' },
      cam: { portrait: { dx: 0, y: 7.4, dz: 5.4, ly: 0.7, lz: -1.0, fov: 58 }, landscape: { dx: 0, y: 4.8, dz: 7.0, ly: 1.1, lz: -1.5, fov: 46 } },
      build(R) {
        const { T, group: g, put, box, sph, cyl, rbox, plane, toon, GEO } = R;
        const st = new T.Group(); g.add(st);
        const wall = toon(L.wall), wall2 = toon(L.wall2), floor = toon(L.floor), acc = toon(L.accent), cream = toon('#FFFDF9'), wood = toon('#B98C6A'), woodD = toon('#9A7052');
        // пол, стены, плинтус, пояс
        rbox(st, floor, 0, -0.05, -D / 2, W + 0.4, 0.1, D + 0.2, 0.03);
        for (let i = 0; i < 6; i++) put(st, GEO.plane, toon(i % 2 ? L.floor : L.wall2), [-W / 2 + 0.6 + i * 1.16, 0.006, -D / 2], [0.04, D, 1], [-PI / 2, 0, 0]).castShadow = false;
        rbox(st, wall, 0, HGT / 2, -D - 0.1, W + 0.4, HGT, 0.2, 0.05);
        [-1, 1].forEach(sd => { rbox(st, wall, sd * (W / 2 + 0.1), HGT / 2, -D / 2, 0.2, HGT, D, 0.05); rbox(st, wall2, sd * (W / 2 - 0.02), 0.45, -D / 2, 0.06, 0.9, D, 0.02); });
        rbox(st, wall2, 0, 0.45, -D + 0.02, W, 0.9, 0.06, 0.02);
        box(st, acc, 0, 0.92, -D + 0.05, W, 0.05, 0.03);
        // вывеска лавки на задней стене
        const [cv, c] = R.cnv(512, 128); c.fillStyle = L.wall; c.fillRect(0, 0, 512, 128); c.fillStyle = '#FFF6EE'; R.rrect(c, 4, 4, 504, 120, 30); c.fill(); c.strokeStyle = def.front.col; c.lineWidth = 8; R.rrect(c, 16, 16, 480, 96, 22); c.stroke();
        R.text(c, def.front.sign, 256, 66, 64, def.front.col, { f: 'Comfortaa', w: 700, max: 440 });
        plane(st, toon('#FFFFFF', { map: R.tex(cv) }), 0.3, 2.65, -D + 0.02, 2.0, 0.5);
        // прилавок
        const P = { host: [0.3, -2.75], thing: [1.45, -2.75], shelf: [-2.55, -2.75], sit: [1.55, -1.25], buy: [-0.75, -2.75] };
        rbox(st, wood, 0.3, 0.42, -3.55, 2.8, 0.84, 0.6, 0.05); rbox(st, cream, 0.3, 0.86, -3.55, 2.95, 0.06, 0.7, 0.03); rbox(st, acc, 0.3, 0.42, -3.24, 2.6, 0.56, 0.02, 0.01);
        rbox(st, woodD, 0.3, 0.12, -4.35, 1.6, 0.24, 0.9, 0.04);   // ступенька хозяина: из-за прилавка видно мордочку
        // полка слева
        const sx = -W / 2 + 0.32;
        rbox(st, woodD, sx, 1.2, -3.2, 0.42, 2.4, 1.9, 0.03);
        [0.75, 1.35, 1.95].forEach(y => rbox(st, wood, sx + 0.05, y, -3.2, 0.44, 0.05, 1.86, 0.015));
        props(R, st, def.theme, P);
        // волна 4: что купить — на левом краю прилавка (корзинка кренделей / кувшин какао и стаканчики)
        if (def.buy) {
          const bx = P.buy[0], bz = -3.5;
          if (def.theme === 'bakery') {
            cyl(st, toon('#C9946A'), bx, 0.93, bz, 0.2, 0.08); cyl(st, toon('#FFF6EE'), bx, 0.975, bz, 0.17, 0.01);
            [[-0.07, 0.02], [0.07, -0.02], [0, 0.07]].forEach(([dx, dz], i) => put(st, R.keep(new T.TorusGeometry(0.055, 0.024, 8, 14)), toon(i === 2 ? '#D9965A' : '#C98A4A'), [bx + dx, 1.0 + i * 0.012, bz + dz], null, [-PI / 2 + 0.3 * (i - 1), 0, 0]));
          } else if (def.theme === 'cocoa') {
            cyl(st, toon('#9C5B4A'), bx - 0.08, 1.0, bz, 0.09, 0.22); cyl(st, toon('#7E4638'), bx - 0.08, 1.12, bz, 0.07, 0.03);
            put(st, GEO.cone, toon('#9C5B4A'), [bx + 0.02, 1.06, bz], [0.025, 0.08, 0.025], [0, 0, -1.1]);
            [[0.12, 0.05], [0.16, -0.08]].forEach(([dx, dz]) => { cyl(st, toon('#FFFDF9'), bx + dx, 0.95, bz + dz, 0.04, 0.1); cyl(st, toon('#F6C6D0'), bx + dx, 0.95, bz + dz, 0.042, 0.035); });
          } else if (def.theme === 'toys' && window.PlayFight && PlayFight.makeHammer) {
            // волна 5: пищащие молоточки на подставке (один лежит, второй стоит в стаканчике); сетка — одна на молоточек
            cyl(st, toon('#9DB8E0'), bx + 0.12, 0.95, bz, 0.06, 0.1);
            [[bx + 0.12, 1.06, bz, 0, 0, 0.08], [bx - 0.1, 0.915, bz + 0.02, PI / 2, 0, 1.2]].forEach(([x, y, z, rx, ry, rz]) => {
              const hm = PlayFight.makeHammer(T, null); hm.position.set(x, y, z); hm.rotation.set(rx, ry, rz); hm.castShadow = false;
              R.keep(hm.geometry); R.keep(hm.material); hm.raycast = () => {}; g.add(hm);
            });
          }
        }
        // окно со шторами (правая стена)
        { const wg = new T.Group(); wg.position.set(W / 2 - 0.02, 0, -2.9); wg.rotation.y = -PI / 2; st.add(wg);
          rbox(wg, cream, 0, 1.75, 0.02, 1.3, 1.25, 0.06, 0.04);
          put(wg, GEO.plane, toon('#CFE3F2', { emissive: new T.Color('#BFD8EA'), emissiveIntensity: 0.4 }), [0, 1.75, 0.06], [1.1, 1.05, 1]).castShadow = false;
          box(wg, cream, 0, 1.75, 0.07, 0.04, 1.05, 0.02); box(wg, cream, 0, 1.75, 0.07, 1.1, 0.04, 0.02);
          [-1, 1].forEach(s => rbox(wg, toon(def.front.awning), s * 0.6, 1.8, 0.12, 0.26, 1.4, 0.06, 0.03)); }
        // столик и два стула; на втором — вязаная подушка (кот садится на неё)
        { const tx = 2.2, tz = -1.25;
          cyl(st, wood, tx, 0.72, tz, 0.42, 0.05); cyl(st, woodD, tx, 0.36, tz, 0.05, 0.7); cyl(st, woodD, tx, 0.03, tz, 0.22, 0.04);
          cyl(st, cream, tx, 0.76, tz, 0.07, 0.02); sph(st, toon(def.front.goods[0]), tx + 0.06, 0.8, tz + 0.05, 0.045);
          [[tx - 0.65, PI / 2], [tx + 0.65, -PI / 2]].forEach(([x, ry], i) => {
            const cg = new T.Group(); cg.position.set(x, 0, tz); cg.rotation.y = ry; st.add(cg);
            rbox(cg, acc, 0, 0.45, 0, 0.42, 0.06, 0.42, 0.03); rbox(cg, acc, 0, 0.78, -0.19, 0.42, 0.62, 0.05, 0.03);
            [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => cyl(cg, woodD, a, 0.22, b, 0.02, 0.44));
            if (i === 1) { put(cg, GEO.sph, toon('#FFF1E2'), [0, 0.52, 0.02], [0.17, 0.05, 0.17]); }
          }); }
        // дверь-выход (левая стена, спереди)
        const dz = -1.1, dg = new T.Group(); dg.position.set(-W / 2 + 0.01, 0, dz); dg.rotation.y = PI / 2; dg.userData.key = 'exitDoor'; g.add(dg);
        put(dg, R.extrude(R.archShape(1.1, 2.2), 0.06), cream, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(0.94, 2.08), 0.05), toon(def.front.door), [0, 0, 0.06]);
        sph(dg, toon('#E8C770'), 0.32, 1.0, 0.13, 0.04);
        const [ecv, ec] = R.cnv(320, 96); ec.fillStyle = '#FFF6EE'; ec.fillRect(0, 0, 320, 96); R.text(ec, 'на улицу', 160, 50, 46, def.front.col, { w: 900 });
        plane(dg, toon('#FFFFFF', { map: R.tex(ecv) }), 0, 2.45, 0.08, 0.66, 0.2);
        // лампы с тёплым ореолом
        [[-1.4, -2.4], [1.6, -2.4]].forEach(([x, z]) => { cyl(st, toon('#6A5670'), x, HGT - 0.25, z, 0.01, 0.5); put(st, GEO.hemi, acc, [x, HGT - 0.55, z], [0.22, 0.16, 0.22], [PI, 0, 0]); R.halo(g, x, HGT - 0.62, z, 1.1, '#FFC890', 0.5); });
        // точки — невидимые ловушки тапа поверх предметов
        const trap = (spot, x, y, z, sx2, sy2, sz2) => { const m = box(g, R.keep(new T.MeshBasicMaterial({ visible: false })), x, y, z, sx2, sy2, sz2); m.userData.key = 'spot:' + spot; m.castShadow = false; };
        trap('thing', P.thing[0], 1.05, -3.55, 0.7, 0.5, 0.6);
        trap('shelf', sx + 0.1, 1.3, -3.2, 0.5, 1.8, 1.9);
        trap('sit', 1.55, 0.6, -1.25, 0.5, 0.9, 0.5);
        if (def.buy) trap('buy', P.buy[0], 1.05, -3.55, 0.6, 0.5, 0.6);
        R.bake(st, null, {});
        st.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
        // хозяин за прилавком
        const hostN = host3d(R, id, def.host);
        hostN.root.position.set(0.3, 0.24, -4.05); hostN.root.rotation.y = 0; g.add(hostN.root);   // волна 4: ближе к прилавку (−4,3 → −4,05) — лапка с покупкой короче
        if (def.host.neck) hostN.root.scale.setScalar(0.95);
        return {
          W, D,
          bounds: { x0: -W / 2 + 0.3, x1: W / 2 - 0.45, z0: -3.05, z1: -0.45 },
          exit: { x: -W / 2 + 0.4, z: dz }, exitDir: [-0.9, 0],
          spawn: { x: -2.3, z: -1.45 },
          cam: { x0: -1.25, x1: 1.25, z: -1.6 },
          blockers: [{ x0: 1.55, x1: 2.85, z0: -1.75, z1: -0.75 }, { x0: -W / 2, x1: -W / 2 + 0.6, z0: -4.2, z1: -2.2 }],
          spots: [
            { id: 'host', x: P.host[0], z: P.host[1], act: 'Поговорить', bubble: def.host.name },
            { id: 'thing', x: P.thing[0], z: P.thing[1], act: def.thing.act, bubble: def.thing.bubble },
            { id: 'shelf', x: P.shelf[0], z: P.shelf[1], act: def.shelf.act, bubble: def.shelf.bubble },
            { id: 'sit', x: P.sit[0] - 0.05, z: P.sit[1] + 0.45, act: 'Присесть', bubble: 'столик у окна' },
          ].concat(def.buy ? [{ id: 'buy', x: P.buy[0], z: P.buy[1], act: def.buy.act, bubble: def.buy.bubble }] : []),
          npcs: { [def.host.id]: hostN },
          catSpot: { x: 2.85, z: -1.25, ry: -PI / 2, y: 0.5 },
        };
      },
    });
  });

  /* ---------- визит: комната движка, сценарий лавки, назад в город ---------- */
  const say = l => (window.G ? G.say(l) : Promise.resolve());
  WORLD.visitShop = function (id, ctx = {}) {
    const def = I[id];
    if (!def || !window.City3D) return Promise.resolve('closed');
    const mem = { talk: 0, thing: 0, shelf: 0, buy: 0, factSaid: false };
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; res(v); };
      try {
        const pr = City3D.run({
          room: id, mode: 'free', hudLabel: '🏠 ' + def.short,
          hero: ctx.hero || {}, catHelper: !!ctx.catHelper, catSweater: !!ctx.catSweater, held: ctx.held || null,
          onSpot: async (sid, api) => {
            if (sid === 'host') {
              if (!mem.factSaid) { mem.factSaid = true; await say(def.fact); return; }
              await say(def.talk[mem.talk++ % def.talk.length]); return;
            }
            if (sid === 'thing') {
              mem.thing++;
              if (def.thing.spin && api.spin) api.spin(); else if (api.celebrate) api.celebrate();
              await new Promise(r => setTimeout(r, 900));
              await say(def.thing.lines); return;
            }
            if (sid === 'shelf') { await say(def.shelf.lines[mem.shelf++ % def.shelf.lines.length]); return; }
            if (sid === 'buy' && def.buy) {
              const B = def.buy; mem.buy++;
              await say(B.lines);
              // хозяин протягивает покупку через прилавок; героиня — к краю прилавка, лицом к хозяину, берёт рукой и пробует
              const toy = B.kind === 'squeaky_hammer';   // волна 5: игрушка — не пробует на вкус, а радуется и пищит «пиу»
              if (api.hands && api.hands() && api.takeItem) await api.takeItem({ kind: B.kind, data: B.data, npc: def.host.id, color: def.host.body, height: 0.55, meetY: 1.08, chestFwd: 0.5, walkTo: [1.0, -2.95], face: Math.atan2(0.3 - 1.0, -4.05 + 2.95), eatNow: !toy });   // справа от хозяина: камера видит лапку и руку
              else if (api.setHeld) api.setHeld(B.kind, B.data || null);
              if (toy) { try { if (window.PlayFight && PlayFight.synth) PlayFight.synth('piu'); } catch (e) { /* без звука */ } if (api.celebrate) api.celebrate(); await new Promise(r => setTimeout(r, 700)); await say([{ who: def.host.id, text: 'Теперь на улице можно понарошку: «Пиу!» — и все смеются.' }]); }
              return;
            }
            if (sid === 'sit') {
              if (api.sit) { await api.sit({ x: 1.55, z: -1.25, ry: PI / 2, h: 0.45, from: [1.5, -0.75] }); }
              if (api.catHere && api.catHere() && api.catTo) api.catTo(2.85, -1.25, { ry: -PI / 2, y: 0.5 });
            }
          },
          onNpc: async sid => { if (sid === def.host.id) await say(def.talk[mem.talk++ % def.talk.length]); },
          beforeActive: async () => { await say(ctx.first === false ? def.again : def.hello); },
          // волна 4: что в руке на выходе (купленный крендель, недопитое какао) — городу (main.js забирает на улицу)
          done: v => fin(City3D.lastHeld ? { v, held: City3D.lastHeld() } : v),
          fallback: () => fin('fallback'),
        });
        if (pr && typeof pr.catch === 'function') pr.catch(() => fin('error'));
      } catch (e) { fin('error'); }
    });
  };
})();
