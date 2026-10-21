/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: жители — реплики, имена и ЖИЗНЬ (волна 3, LIFE).
   Реплики — литералом { who, text }: их собирает tools/voice_lines.js, голоса играют через G.voiceLine(who, text).
   Без имени героини (знакомство — только через «Помахать», имя — только в облачке). Чая, брендов и романтики нет.
   Факты правдивые: «эклер» — фр. «молния»; «фонтан» — от лат. fons «источник»; «бульвар» — фр. boulevard от голл. bolwerk «вал»;
   «шпиц» — нем. spitz «острый»; Dachshund — нем. «барсучья собака»; корги — пастушьи собаки (пасли коров); кошки спят 12–16 ч;
   медленное моргание кошки — знак доверия; узор носа у кошки свой у каждой; кошки мурлычут и чтобы успокоиться; хвост трубой —
   приветствие; кошка прыгает в ~5 раз выше своего роста; капибары — самые крупные грызуны и хорошо плавают; утята ходят за мамой
   вереницей; перья утки не намокают (смазка из железы у хвоста); у ёжика 5–7 тыс. иголок; «ёжик с яблоком на иголках» — почти миф;
   балалайка треугольная.

   WORLD.makeLife(o) → life — живой город: 8 жителей волны 2 + зверята (3 собачки, 3 кошки, капибара, утка с утятами,
   мышиное трио, ёжик) гуляют по дорожкам (WORLD.LAYOUT.paths; нет — свои петли по тротуарам карты), останавливаются
   (витрина, лавочка, понюхать фонарь, поболтать парой), уступают героине дорогу, здороваются облачком и голосом,
   отвечают на «Помахать» (G.onWave), гудок и звонок; собачек и кошек можно погладить. Компаньон — js/world/companion.js.
     o = { H, scene, A (WORLD.makeActors), MAP (buildMap), L (WORLD.LAYOUT), ui (WORLD.makeUI — облачка), root (корень
           города — для сердечек), camera }
     life.npcs              — массив жителей в формате w.npcs (x, z, id, root, hop(), headY, li, greetT, honkT, faceHero,
                              faceCar, anim — пусто, outlines — пусто: видимость, поворот, анимацию и контур ведёт сама жизнь)
     life.update(dt, t, ctx) — раз в кадр, ПОСЛЕ animNpcs(dt, t) прогулки. ctx = { hx, hz, ha, mode: 'walk'|'drive'|'ride',
                              car: { x, z, v, ry }, bike, cat: { x, z, on }, active, busy, blocked, cam, q (w.Q), vis (жители:
                              id → false — скрыть), companion (false — компаньона спрятать), api (WalkApi: face, faceCamera, toScreen) }
     life.session(ctx|null) — начало / конец отрезка прогулки (сброс знакомств «Помахать», возврат собачки к героине)
     life.actionFor(x, z)   → { label: 'Погладить', n, run() } | null — для кнопки действия (собачки, кошки, капибара)
     life.hit(ray, camPos)  → { kind: 'life', ref, t } | null — тап по компаньону (его нет в life.npcs)
     life.tap(ref)          — открыть меню компаньона
     life.talk(n)           → [{ who, text }…] — диалог по тапу (2–3 реплики, по кругу)
     life.pet(n)            → Promise — погладить: собачка виляет и подпрыгивает, кошка мурчит, сердечки
     life.canGreet(n)       — общий ограничитель облачков «привет» (не чаще раза в 9 с по всем)
     life.circles(out)      — круги жителей для столкновений героини (без мелких и без компаньона)
     life.honkLine(n, d)    — ответ на гудок (у шпица — «Тяф!», у утят — «Пи-пи!»)
     life.say(n, text, ms)  — облачко над зверьком с голосом
     life.stats()           → { agents, visible, animated, ms, msAvg, calls }
     life.companion         — см. companion.js (null, если файла нет)
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI, TAU = PI * 2;
  WORLD.RESIDENT_NAMES = { raccoon: 'Енот-киномеханик', poodle: 'Пудра', sheep: 'Кашемира', bunny: 'Зайка', goose: 'Финалыч', hedgehog: 'Ёжик', fox: 'Лиса', pigeon: 'Голубь',
    dog_spitz: 'Шпиц Зефирка', dog_dachshund: 'Такса Багет', dog_corgi: 'Корги Пельмень', cat_ginger: 'Кот Бублик', cat_tabby: 'Кот Тапок', cat_tux: 'Кот Сажа',
    capybara: 'Капибара Пауза', ducks: 'Утка Кряквина', mice: 'Трио «До-Ре-Мышь»', hedgehog_leaf: 'Ёжик Шуршик' };
  WORLD.RESIDENT_LINES = {
    raccoon: [
      { who: 'raccoon', text: 'Ой! Привет! Сеанс вечером, а я уже с платочком. На всякий случай.' },
      { who: 'raccoon', text: 'Кинобудка открыта. Плёнка намотана, настроение тоже.' },
    ],
    poodle: [
      { who: 'poodle', text: 'Тяф! Привет! Я Пудра. Охраняю эклеры. Пока все целы.' },
      { who: 'poodle', text: 'Тяф-тяф! Сегодня пахнет корицей. Это хороший знак.' },
    ],
    sheep: [
      { who: 'sheep', text: 'Привет! Вяжу шарф для фонаря. Ему зимой будет тепло.' },
      { who: 'sheep', text: 'Петля за петлёй — и уже уютно.' },
    ],
    bunny: [
      { who: 'bunny', text: 'Ой, привет! «Эклер» по-французски — «молния». Их и съедают как молнию.' },
      { who: 'bunny', text: 'Привет! У фонтана думается про десерты. Проверено.' },
    ],
    goose: [
      { who: 'goose', text: 'Га! Привет! Хочешь, расскажу, чем всё кончится?.. Молчу-молчу.' },
      { who: 'goose', text: 'В этом фонтане ничего не тонет. Отличная концовка, кстати.' },
    ],
    hedgehog: [
      { who: 'hedgehog', text: 'Привет! Тсс… Записываю, как тикают часы. Получается отлично.' },
      { who: 'hedgehog', text: 'Слышишь фонтан? Я тоже. Пишу его на плёнку.' },
    ],
    fox: [
      { who: 'fox', text: 'Привет! Слово «бульвар» пришло из французского, а туда — из голландского bolwerk, «вал».' },
      { who: 'fox', text: 'Привет! «Фонтан» — от латинского fons, «источник». Записала в архив.' },
    ],
    pigeon: [
      { who: 'pigeon', text: 'Курлы! Привет!' },
      { who: 'pigeon', text: 'Я сегодня видел три фонаря. Или один, но я кружился.' },
    ],
    // зверята волны 3: мимоходом — короткое облачко
    dog_spitz: [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_spitz', text: 'Тяф-тяф!' }],
    dog_dachshund: [{ who: 'dog_dachshund', text: 'Гав! Привет! От тебя до меня — три таксы.' }, { who: 'dog_dachshund', text: 'Привет! Я тут кое-что мерю.' }],
    dog_corgi: [{ who: 'dog_corgi', text: 'Хрр… А? Привет.' }, { who: 'dog_corgi', text: 'Привет. Я тут лежу. Это тоже дело.' }],
    cat_ginger: [{ who: 'cat_ginger', text: 'Мр-р. Привет.' }, { who: 'cat_ginger', text: 'Мяу. Тут солнце. Я его грею.' }],
    cat_tabby: [{ who: 'cat_tabby', text: 'Мяу. Я смотрю витрины. Ничего не покупаю.' }, { who: 'cat_tabby', text: 'Привет. Я здесь по делу.' }],
    cat_tux: [{ who: 'cat_tux', text: 'Мяу. Я во фраке. Всегда готов к празднику.' }, { who: 'cat_tux', text: 'Привет. Река сегодня гладкая.' }],
    capybara: [{ who: 'capybara', text: 'При-и-вет.' }, { who: 'capybara', text: 'Тс-с. Река шуршит.' }],
    ducks: [{ who: 'ducks', text: 'Кря! Привет! Мы на прогулке.' }, { who: 'ducks', text: 'Тише, тише. Утята считают волны.' }],
    mice: [{ who: 'mice', text: 'Пи! Привет! Играем всё, кроме грустного.' }, { who: 'mice', text: 'Пи-пи! Грустное — по средам.' }],
    hedgehog_leaf: [{ who: 'hedgehog_leaf', text: 'Шур-шур! Привет!' }, { who: 'hedgehog_leaf', text: 'Привет! Собираю самые красивые листья.' }],
  };
  // диалог по тапу: 2–3 реплики, по кругу (narrator — рассказчик: его можно выключить, тогда только облачко)
  WORLD.RESIDENT_TALK = {
    raccoon: [[{ who: 'raccoon', text: 'Гуляю до угла и обратно. Разминка перед сеансом.' }, { who: 'raccoon', text: 'Киномеханик должен быть в форме. Особенно мизинцы.' }]],
    poodle: [[{ who: 'poodle', text: 'Тяф! Я обошла все витрины. Самая вкусная — наша.' }, { who: 'poodle', text: 'Это не хвастовство. Это нюх.' }]],
    sheep: [[{ who: 'sheep', text: 'Гуляю и вяжу. Так шарф получается длиннее.' }, { who: 'sheep', text: 'Если что, это шарф для фонаря. Он высокий.' }]],
    bunny: [[{ who: 'bunny', text: 'Обхожу фонтан по кругу. Три круга — и можно печь безе.' }, { who: 'bunny', text: 'Это не примета. Это разминка для ушей.' }]],
    goose: [[{ who: 'goose', text: 'Га! Я знаю, чем кончится эта прогулка!' }, { who: 'goose', text: 'Хорошо кончится. Всё. Больше ни слова.' }]],
    hedgehog: [[{ who: 'hedgehog', text: 'Тсс. Записываю, как шуршат листья под часами.' }, { who: 'hedgehog', text: 'Под часами шуршат ровно. По секундам.' }]],
    fox: [[{ who: 'fox', text: 'В парке я записываю названия деревьев. Каштан, клён, липа.' }, { who: 'fox', text: 'Липа — самая пушистая на слух.' }]],
    pigeon: [[{ who: 'pigeon', text: 'Курлы! На набережной лучшие крошки. И вид.' }, { who: 'pigeon', text: 'Вид даже лучше крошек. Но ненамного.' }]],
    dog_spitz: [
      [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'narrator', text: 'Зефирка нашла лист. Лучший лист в городе. Она уверена.' }],
      [{ who: 'dog_spitz', text: 'Тяф-тяф!' }, { who: 'narrator', text: '«Шпиц» по-немецки — «острый». Это про ушки и мордочку.' }],
      [{ who: 'dog_spitz', text: 'Тяф?' }, { who: 'narrator', text: 'Зефирка проверяет, нет ли у тебя второго листа. Нет? Всё равно друзья.' }],
    ],
    dog_dachshund: [
      [{ who: 'dog_dachshund', text: 'Привет! Я Багет. Всё в городе меряю в таксах.' }, { who: 'dog_dachshund', text: 'До фонтана — сорок две таксы. Мерил лично.' }],
      [{ who: 'dog_dachshund', text: 'По-немецки такса — Dachshund. Это значит «барсучья собака».' }, { who: 'dog_dachshund', text: 'Это я так, к слову. Барсуков не обижаю.' }],
      [{ who: 'dog_dachshund', text: 'Скамейка в парке длиной в шесть такс. Удобная.' }, { who: 'hero', text: 'А до кинотеатра?' }, { who: 'dog_dachshund', text: 'Сто такс с хвостиком. Мой хвостик тоже считается.' }],
    ],
    dog_corgi: [
      [{ who: 'dog_corgi', text: 'Хрр… Я не сплю. Я жду, когда станет интересно.' }, { who: 'dog_corgi', text: 'О. Ты пришла. Стало интересно.' }],
      [{ who: 'dog_corgi', text: 'Корги раньше пасли коров. И не боялись копыт.' }, { who: 'dog_corgi', text: 'Я пасу скамейку. Она никуда не уходит.' }],
      [{ who: 'dog_corgi', text: 'Лапы короткие — зато до земли близко. Удобно нюхать.' }, { who: 'dog_corgi', text: 'Философия, между прочим.' }],
    ],
    cat_ginger: [
      [{ who: 'cat_ginger', text: 'Мр-р. Я занял тёплую скамейку. Сидеть рядом можно, на мне — нет.' }, { who: 'cat_ginger', text: 'Это правило всех котов. Не я придумал.' }],
      [{ who: 'cat_ginger', text: 'Коты спят по двенадцать-шестнадцать часов в день.' }, { who: 'cat_ginger', text: 'Я стараюсь на восемнадцать. Пока не выходит.' }],
      [{ who: 'cat_ginger', text: 'Если кот медленно моргает — это «я тебе доверяю». Смотри.' }, { who: 'narrator', text: 'Бублик медленно моргнул.' }],
    ],
    cat_tabby: [
      [{ who: 'cat_tabby', text: 'У каждого кота свой узор на носике. Как отпечаток пальца.' }, { who: 'cat_tabby', text: 'Мой — обычный. Но красивый.' }],
      [{ who: 'cat_tabby', text: 'Мяу. В той витрине клубки. Я просто смотрю.' }, { who: 'cat_tabby', text: 'Ничего не трогаю. Почти.' }],
      [{ who: 'cat_tabby', text: 'Коты мурлычут не только от радости, но и чтобы успокоиться.' }, { who: 'cat_tabby', text: 'Сейчас — от радости.' }],
    ],
    cat_tux: [
      [{ who: 'cat_tux', text: 'Говорят, я во фраке. На самом деле это моя обычная шёрстка.' }, { who: 'cat_tux', text: 'Но выгляжу торжественно, согласен.' }],
      [{ who: 'cat_tux', text: 'Хвост трубой — значит, кот рад. Мой сейчас трубой.' }, { who: 'cat_tux', text: 'Проверь, если не веришь.' }],
      [{ who: 'cat_tux', text: 'Коты запрыгивают в пять раз выше своего роста.' }, { who: 'cat_tux', text: 'Перила — это мне на один прыжок.' }],
    ],
    capybara: [
      [{ who: 'capybara', text: 'Привет. Ничего делать не надо. Это и есть занятие.' }, { who: 'capybara', text: 'Апельсин? Он просто тут лежит. Ему нравится.' }],
      [{ who: 'capybara', text: 'Капибары — самые крупные грызуны на свете.' }, { who: 'capybara', text: 'А ещё мы умеем долго-долго сидеть. Это второй талант.' }],
      [{ who: 'capybara', text: 'Капибары отлично плавают.' }, { who: 'capybara', text: 'Но сегодня я отдыхаю от воды. И от суши немножко.' }],
    ],
    ducks: [
      [{ who: 'ducks', text: 'Кря! Это мои утята. Плывём строго по порядку.' }, { who: 'ducks', text: 'Первый — самый смелый. Третий — самый любопытный.' }],
      [{ who: 'ducks', text: 'Утята с первого дня плавают за мамой вереницей. Так никто не теряется.' }, { who: 'ducklings', text: 'Пи-пи!' }],
      [{ who: 'ducks', text: 'Перья у уток не промокают. Мы их смазываем клювом.' }, { who: 'ducks', text: 'Красота и дело одновременно.' }],
    ],
    mice: [
      [{ who: 'mice', text: 'Привет! Мы — трио «До-Ре-Мышь». Играем всё, кроме грустного.' }, { who: 'mice', text: 'Грустное — по средам. Но по средам мы отдыхаем.' }],
      [{ who: 'mice', text: 'Балалайка треугольная, а звенит кругло. Послушай!' }, { who: 'narrator', text: 'Мышки сыграли что-то очень весёлое и очень короткое.' }],
      [{ who: 'mice', text: 'Если хлопать в такт, музыка звучит громче.' }, { who: 'mice', text: 'Проверено на голубях.' }],
    ],
    hedgehog_leaf: [
      [{ who: 'hedgehog_leaf', text: 'Говорят, ёжики носят яблоки на иголках. На самом деле почти никогда.' }, { who: 'hedgehog_leaf', text: 'Я ношу листик. Для красоты.' }],
      [{ who: 'hedgehog_leaf', text: 'У ёжика пять-семь тысяч иголок.' }, { who: 'hedgehog_leaf', text: 'Я не считал. Это мне мама сказала.' }],
      [{ who: 'hedgehog_leaf', text: 'Листья шуршат по-разному. Кленовый — звонко, дубовый — басом.' }, { who: 'hedgehog_leaf', text: 'Шур-шур. Это был кленовый.' }],
    ],
  };
  // кот спит — диалог тише
  WORLD.RESIDENT_SLEEP_TALK = [{ who: 'narrator', text: 'Кот спит. Будить не будем — можно тихонько погладить.' }];
  // подслушанные разговоры пар (облачка, не чаще раза в 45 с, когда она рядом)
  WORLD.LIFE_PAIRS = [
    { a: 'dog_dachshund', b: 'dog_corgi', lines: [{ who: 'dog_dachshund', text: 'Я обежал весь парк!' }, { who: 'dog_corgi', text: 'Ты обежал скамейку.' }, { who: 'dog_dachshund', text: 'Она длинная! Шесть такс!' }] },
    { a: 'dog_spitz', b: 'dog_corgi', lines: [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_corgi', text: 'Да, я тоже рад.' }, { who: 'dog_spitz', text: 'Тяф-тяф!' }, { who: 'dog_corgi', text: 'Согласен. Отличный лист.' }] },
    { a: 'dog_spitz', b: 'dog_dachshund', lines: [{ who: 'dog_dachshund', text: 'Зефирка, ты ростом в полтаксы.' }, { who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_dachshund', text: 'Понял. Ровно в таксу. С бантиком.' }] },
    { a: 'bunny', b: 'goose', lines: [{ who: 'goose', text: 'Хочешь, скажу, чем кончится прогулка?' }, { who: 'bunny', text: 'Не надо!' }, { who: 'goose', text: 'Хорошо кончится. Всё, молчу.' }] },
    { a: 'fox', b: 'hedgehog_leaf', lines: [{ who: 'hedgehog_leaf', text: 'А этот лист — какой?' }, { who: 'fox', text: 'Кленовый. Записала в архив.' }, { who: 'hedgehog_leaf', text: 'Тогда я его поношу. Для архива.' }] },
    { a: 'raccoon', b: 'sheep', lines: [{ who: 'raccoon', text: 'Сегодня кино про дружбу.' }, { who: 'sheep', text: 'Тогда вяжу два шарфа.' }, { who: 'raccoon', text: 'Я уже плачу. От счастья.' }] },
    { a: 'poodle', b: 'cat_tabby', lines: [{ who: 'poodle', text: 'Тяф! Ты опять у витрины?' }, { who: 'cat_tabby', text: 'Я не у витрины. Я рядом с витриной.' }, { who: 'poodle', text: 'Тяф-тяф! Понятно.' }] },
    { a: 'capybara', b: 'ducks', lines: [{ who: 'ducks', text: 'Кря! Поплаваешь с нами?' }, { who: 'capybara', text: 'Завтра. Сегодня я сижу.' }, { who: 'ducks', text: 'Тоже хорошее дело!' }] },
    { a: 'pigeon', b: 'cat_tux', lines: [{ who: 'pigeon', text: 'Курлы! Ты на перилах?' }, { who: 'cat_tux', text: 'На перилах. Тут вид.' }, { who: 'pigeon', text: 'Тогда и я посмотрю. С краю.' }] },
    { a: 'cat_ginger', b: 'mice', lines: [{ who: 'mice', text: 'Бублик, сыграть тебе колыбельную?' }, { who: 'cat_ginger', text: 'Мр-р. Только тихую.' }, { who: 'mice', text: 'Самую тихую. Почти без нот.' }] },
  ];
  // ответ на «Помахать» тем, у кого он особенный (имя — только в облачке, голосом не звучит)
  WORLD.LIFE_WAVE = {
    dog_spitz: { plain: [{ who: 'dog_spitz', text: 'Тяф-тяф!' }] },
    // утка отвечает сама, утята — следом своим голосом (по-английски, только после её «Помахать»)
    ducks: { plain: [{ who: 'ducks', text: 'Кря! Утята, поздоровайтесь!' }], after: { name: [{ who: 'ducklings', text: 'Hello, {name}!' }], plain: [{ who: 'ducklings', text: 'Hello! Hello!' }] } },
    mice: { plain: [{ who: 'mice', text: 'Пи! Сыграем тебе приветик!' }] },
    capybara: { plain: [{ who: 'capybara', text: 'При-и-вет. Не спеши.' }] },
  };
  // погладить: реакция (облачко с голосом)
  WORLD.LIFE_PET = {
    dog_spitz: [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_spitz', text: 'Тяф-тяф-тяф!' }],
    dog_dachshund: [{ who: 'dog_dachshund', text: 'Ещё! На две таксы левее!' }, { who: 'dog_dachshund', text: 'Хвост вилял на три таксы в секунду.' }],
    dog_corgi: [{ who: 'dog_corgi', text: 'Хрр… За ушком. Да. Вот так.' }, { who: 'dog_corgi', text: 'Я проснулся. Ради такого — можно.' }],
    cat_ginger: [{ who: 'cat_ginger', text: 'Мрррр.' }, { who: 'cat_ginger', text: 'Мр-р. Можно ещё минутку.' }],
    cat_tabby: [{ who: 'cat_tabby', text: 'Мрр. Вот здесь, у ушка.' }, { who: 'cat_tabby', text: 'Мур-мур. Почти как солнышко.' }],
    cat_tux: [{ who: 'cat_tux', text: 'Мрр. Фрак не помнём.' }, { who: 'cat_tux', text: 'Мур. Торжественно и приятно.' }],
    capybara: [{ who: 'capybara', text: 'Ммм. Хорошо. Можно не останавливаться.' }],
    poodle: [{ who: 'poodle', text: 'Тяф! Только бантик не трогай.' }],
  };
  // ответ на гудок и «би-би» прохожих — тоже литералом { who, text } (у каждого жителя свой голос)
  WORLD.RESIDENT_HONK = ['Ой! Привет!', 'Би-би!'];
  WORLD.RESIDENT_HONK_LINES = [
    { who: 'raccoon', text: 'Ой! Привет!' }, { who: 'raccoon', text: 'Би-би!' },
    { who: 'poodle', text: 'Ой! Привет!' }, { who: 'poodle', text: 'Би-би!' },
    { who: 'sheep', text: 'Ой! Привет!' }, { who: 'sheep', text: 'Би-би!' },
    { who: 'bunny', text: 'Ой! Привет!' }, { who: 'bunny', text: 'Би-би!' },
    { who: 'goose', text: 'Ой! Привет!' }, { who: 'goose', text: 'Би-би!' },
    { who: 'hedgehog', text: 'Ой! Привет!' }, { who: 'hedgehog', text: 'Би-би!' },
    { who: 'fox', text: 'Ой! Привет!' }, { who: 'fox', text: 'Би-би!' },
    { who: 'pigeon', text: 'Ой! Привет!' }, { who: 'pigeon', text: 'Би-би!' },
    { who: 'dog_dachshund', text: 'Ой! Привет!' }, { who: 'dog_dachshund', text: 'Би-би!' },
    { who: 'dog_corgi', text: 'Ой! Привет!' }, { who: 'dog_corgi', text: 'Би-би!' },
    { who: 'cat_ginger', text: 'Ой! Привет!' }, { who: 'cat_ginger', text: 'Би-би!' },
    { who: 'cat_tabby', text: 'Ой! Привет!' }, { who: 'cat_tabby', text: 'Би-би!' },
    { who: 'cat_tux', text: 'Ой! Привет!' }, { who: 'cat_tux', text: 'Би-би!' },
    { who: 'capybara', text: 'Ой! Привет!' }, { who: 'capybara', text: 'Би-би!' },
    { who: 'ducks', text: 'Ой! Привет!' }, { who: 'ducks', text: 'Би-би!' },
    { who: 'mice', text: 'Ой! Привет!' }, { who: 'mice', text: 'Би-би!' },
    { who: 'hedgehog_leaf', text: 'Ой! Привет!' }, { who: 'hedgehog_leaf', text: 'Би-би!' },
  ];
  // у кого ответ на гудок свой (остальным — RESIDENT_HONK)
  WORLD.LIFE_HONK = { dog_spitz: { who: 'dog_spitz', text: 'Тяф!' }, ducks: { who: 'ducklings', text: 'Пи-пи!' } };
  WORLD.honkLine = (id, near) => { const h = WORLD.LIFE_HONK[id]; return h ? h.text : WORLD.RESIDENT_HONK[near ? 0 : 1]; };
  // говорящие для окна диалога (тап по жителю): кого ещё нет в игре — с именем и значком
  (function () {
    const G = window.G; if (!G || !G.addSpeakers || !G.speakers) return;
    const add = {};
    [['poodle', 'Пудель Пудра', '🐩'], ['sheep', 'Кашемира', '🐑'], ['pigeon', 'Голубь', '🐦'],
      ['dog_spitz', 'Шпиц Зефирка', '🐶', '#FFF1DE'], ['dog_dachshund', 'Такса Багет', '🐕', '#F6DCC6'], ['dog_corgi', 'Корги Пельмень', '🐕', '#FBE3CB'],
      ['cat_ginger', 'Кот Бублик', '🐱', '#FDE2C6'], ['cat_tabby', 'Кот Тапок', '🐈', '#EDE3D6'], ['cat_tux', 'Кот Сажа', '🐈‍⬛', '#E9E3EE'],
      ['capybara', 'Капибара Пауза', '🍊', '#F3E2D0'], ['ducks', 'Утка Кряквина', '🦆', '#E3EEF6'], ['ducklings', 'Утята', '🐥', '#FFF3C4'],
      ['mice', 'Трио «До-Ре-Мышь»', '🐭', '#EEE7F3'], ['hedgehog_leaf', 'Ёжик Шуршик', '🦔', '#F6E6D6']]
      .forEach(([id, nm, em, bg]) => { if (!G.speakers[id]) add[id] = { name: () => (WORLD._lifeName ? WORLD._lifeName(id) : null) || nm, art: () => G.emojiAvatar(em, bg || '#FBE1E7') }; });
    G.addSpeakers(add);
  })();
  // где стоят (если карта не сказала): x, z, поворот
  WORLD.RESIDENT_SPOTS = {
    raccoon: { x: 2.3, z: 0.9, ry: 0.4 }, poodle: { x: 18.6, z: 0.5, ry: -0.3 }, sheep: { x: -9.4, z: 0.95, ry: 0.2 },
    bunny: { x: 6.2, z: 25.6, ry: 2.3 }, goose: { x: 15.8, z: 37.6, ry: -2.4 }, hedgehog: { x: 34.8, z: 23.0, ry: -2.6 },
    fox: { x: -41.6, z: 34.6, ry: 2.2 }, pigeon: { x: 19.8, z: 63.0, ry: 0.6 },
  };

  /* ---------- состав и характеры ----------
     beh: npc — житель волны 2 (держится у своего места), dog, cat, capy, ducks, mice, hedge
     move: path — по дорожке (ближайшей к дому, в пределах roam м), area — по точкам в круге/прямоугольнике */
  WORLD.LIFE_CAST = [
    { id: 'raccoon', kind: 'npc:raccoon', beh: 'npc', move: 'path', roam: 7, speed: 0.6, r: 0.34, headY: 1.25, pair: 'sheep' },
    { id: 'poodle', kind: 'npc:poodle', beh: 'npc', move: 'path', roam: 6, speed: 0.75, r: 0.26, headY: 0.6, scale: 1.25, pet: 'dog' },
    { id: 'sheep', kind: 'npc:sheep', beh: 'npc', move: 'path', roam: 7, speed: 0.55, r: 0.34, headY: 1.25 },
    { id: 'bunny', kind: 'npc:bunny', beh: 'npc', move: 'area', roam: 4.5, speed: 0.6, r: 0.32, headY: 1.25 },
    { id: 'goose', kind: 'npc:goose', beh: 'npc', move: 'area', roam: 4.5, speed: 0.6, r: 0.3, headY: 1.25 },
    { id: 'hedgehog', kind: 'npc:hedgehog', beh: 'npc', move: 'area', roam: 4, speed: 0.5, r: 0.32, headY: 1.25 },
    { id: 'fox', kind: 'npc:fox', beh: 'npc', move: 'area', roam: 4, speed: 0.6, r: 0.32, headY: 1.25 },
    { id: 'pigeon', kind: 'npc:pigeon', beh: 'npc', move: 'area', roam: 5, speed: 0.55, r: 0.16, headY: 0.55, small: true },
    { id: 'dog_spitz', kind: 'spitz', beh: 'dog', move: 'area', home: 'dogpark', speed: 1.05, r: 0.22, headY: 0.42, pet: 'dog', dogpark: true },
    { id: 'dog_dachshund', kind: 'dachshund', beh: 'dog', move: 'area', home: 'dogpark', speed: 1.0, r: 0.24, headY: 0.36, pet: 'dog', dogpark: true },
    { id: 'dog_corgi', kind: 'corgi', beh: 'dog', move: 'area', home: 'dogpark', speed: 0.9, r: 0.24, headY: 0.42, pet: 'dog', dogpark: true, lazy: true },
    { id: 'cat_ginger', kind: 'cat_ginger', beh: 'cat', move: 'area', home: { x: 11, z: 24.3 }, roam: 9, speed: 0.6, r: 0.2, headY: 0.4, pet: 'cat', perch: 'rim' },
    { id: 'cat_tabby', kind: 'cat_tabby', beh: 'cat', move: 'path', home: { x: 8.9, z: 1.6 }, roam: 22, speed: 0.6, r: 0.2, headY: 0.4, pet: 'cat', window: true },
    { id: 'cat_tux', kind: 'cat_tux', beh: 'cat', move: 'path', home: { x: 26, z: 62.6 }, roam: 18, speed: 0.6, r: 0.2, headY: 0.4, pet: 'cat', perch: 'rail' },
    { id: 'capybara', kind: 'capybara', beh: 'capy', move: 'area', home: { x: 9, z: 65.0 }, area: { x0: 6.5, x1: 12, z0: 61.8, z1: 65.4 }, speed: 0.35, r: 0.36, headY: 0.55, pet: 'capy' },
    { id: 'ducks', kind: 'ducks', beh: 'ducks', move: 'swim', home: { x: 10, z: 67.7 }, speed: 0.38, r: 0.3, headY: 0.32, small: true },
    { id: 'mice', kind: 'mice', beh: 'mice', move: 'path', home: { x: 11, z: 23.1 }, roam: 30, speed: 0.75, r: 0.32, headY: 0.32, small: true },
    { id: 'hedgehog_leaf', kind: 'hedgehog2', beh: 'hedge', move: 'path', home: { x: -43.2, z: 46 }, roam: 9, speed: 0.32, r: 0.17, headY: 0.3, small: true },
  ];

  /* =====================================================================
     ЖИЗНЬ ГОРОДА
     ===================================================================== */
  WORLD.makeLife = function (o) {
    const T = window.THREE, H = o.H, A = o.A, MAP = o.MAP || {}, L = o.L || WORLD.LAYOUT || {}, scene = o.scene;
    const C = A && A.critters; if (!T || !C) return null;
    const G_ = () => window.G || null;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const now = () => performance.now() / 1000;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const B0 = L.bounds || { x0: -48.6, x1: 69.2, z0: -1.55, z1: 65.85 };

    /* ---------- препятствия: сетка 8 м по коллайдерам карты (как у героини) ---------- */
    const CELL = 8, cells = new Map(), key = (i, j) => i * 4096 + j, big = [];
    const COL = MAP.colliders || { boxes: [], circles: [] };
    const addTo = (x0, x1, z0, z1, it) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); if (!cells.has(k)) cells.set(k, { c: [], b: [] }); cells.get(k)[it.r !== undefined ? 'c' : 'b'].push(it); } };
    COL.circles.forEach(c => addTo(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, c));
    COL.boxes.forEach(b => { if (b.noWalk === false) return; if ((b.x1 - b.x0) * (b.z1 - b.z0) > 900) big.push(b); else addTo(b.x0, b.x1, b.z0, b.z1, b); });
    // предметы улицы без коллайдера (табло, почтовый ящик): тоже обходить; у бутика Жу — свои коллайдеры в map.js
    (o.extraCircles || [{ x: 3.1, z: -1.25, r: 0.45 }, { x: 13.6, z: -1.3, r: 0.35 }]).forEach(c => addTo(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, c));
    function forNear(x, z, r, fc, fb) {
      for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const c = cells.get(key(i, j)); if (!c) continue; if (fc) c.c.forEach(fc); if (fb) c.b.forEach(fb);
      }
      if (fb) big.forEach(fb);
    }
    const out2 = [0, 0];
    function collide(x, z, r) {
      for (let pass = 0; pass < 2; pass++) {
        forNear(x, z, r + 1, c => { const dx = x - c.x, dz = z - c.z, m = c.r + r; if (Math.abs(dx) < m && Math.abs(dz) < m) { const d = Math.hypot(dx, dz); if (d < m && d > 1e-5) { x = c.x + dx / d * m; z = c.z + dz / d * m; } } },
          b => { if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) { const dl = x - (b.x0 - r), dr = (b.x1 + r) - x, dn = z - (b.z0 - r), ds = (b.z1 + r) - z, m = Math.min(dl, dr, dn, ds); if (m === dl) x = b.x0 - r; else if (m === dr) x = b.x1 + r; else if (m === dn) z = b.z0 - r; else z = b.z1 + r; } });
      }
      out2[0] = clamp(x, B0.x0 + 0.3, B0.x1 - 0.3); out2[1] = clamp(z, B0.z0 + 0.2, B0.z1 - 0.15);
      return out2;
    }
    function blockedAt(x, z, r) {
      let hit = false;
      forNear(x, z, r + 1, c => { if (!hit && Math.hypot(x - c.x, z - c.z) < c.r + r) hit = true; }, b => { if (!hit && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) hit = true; });
      if (!hit && typeof L.walkable === 'function') { try { if (L.walkable(x, z) === false) hit = true; } catch (e) { /* без карты проходимости */ } }
      if (!hit && typeof L.drivable === 'function' && L.drivable(x, z, -0.3)) hit = true;   // на проезжую часть не выходим
      return hit || x < B0.x0 + 0.3 || x > B0.x1 - 0.3 || z < B0.z0 + 0.2 || z > B0.z1 - 0.15;
    }
    const clearLine = (x0, z0, x1, z1, r) => { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.4)); for (let k = 1; k <= n; k++) { const t = k / n; if (blockedAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r)) return false; } return true; };

    /* ---------- дорожки: WORLD.LAYOUT.paths, иначе свои петли по тротуарам карты волны 2 ---------- */
    function mkPath(id, pts, closed) {
      const P = pts.map(p => [p[0], p[1]]), segs = [];
      let len = 0; const n = closed ? P.length : P.length - 1;
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue; segs.push({ a, b, l, s0: len, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }); len += l; }
      const at = (s, out) => {
        if (closed) s = ((s % len) + len) % len; else s = clamp(s, 0, len);
        let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].s0 <= s) lo = m; else hi = m - 1; }
        const g = segs[lo], k = s - g.s0; out.x = g.a[0] + g.tx * k; out.z = g.a[1] + g.tz * k; out.tx = g.tx; out.tz = g.tz; return out;
      };
      const nearest = (x, z) => { let best = 0, bd = 1e9; segs.forEach(g => { const k = clamp((x - g.a[0]) * g.tx + (z - g.a[1]) * g.tz, 0, g.l), px = g.a[0] + g.tx * k, pz = g.a[1] + g.tz * k, d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = g.s0 + k; } }); return { s: best, d: bd }; };
      return { id, pts: P, closed, len, segs, at, nearest };
    }
    const circlePts = (cx, cz, r, n = 28) => { const o2 = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o2.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o2; };
    const F = L.fountain || { x: 11, z: 31.9, r: 3.05 };
    const FALLBACK = {
      oct: [[[-46, 1.5], [-20, 1.5], [0, 1.45], [20, 1.45], [44, 1.5], [66, 1.5]], false],
      block: [[[-24.2, 13.6], [46.4, 13.6], [46.4, 50.3], [-24.2, 50.3]], true],
      square: [circlePts(F.x, F.z, 8.85, 32), true],
      squareIn: [circlePts(F.x, F.z, 5.2, 24), true],
      park: [[[-43.2, 19.5], [-43.2, 31.6], [-41.4, 33.4], [-41.2, 36], [-41.6, 38.4], [-43.2, 40.3], [-43.2, 52.5]], false],
      prom: [[[-45, 62.4], [-20, 62.2], [0, 62.2], [20, 62.2], [44, 62.2], [66, 62.4]], false],
      east: [[[58.8, 14], [58.8, 58]], false],
    };
    const PATHS = [];
    // путь чистим: точки внутри препятствий — выталкиваем, слишком далёкие от исходной — выбрасываем
    const fixPts = (pts, r) => pts.map(p => { if (!blockedAt(p[0], p[1], r)) return p; const q = collide(p[0], p[1], r + 0.05); return Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.2 && !blockedAt(q[0], q[1], r) ? [q[0], q[1]] : null; }).filter(Boolean);
    try { if (L.paths && typeof L.paths === 'object') Object.keys(L.paths).forEach(id => { const pts = L.paths[id]; if (!Array.isArray(pts) || pts.length < 2) return; const cl = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1.5; const fp = fixPts(cl ? pts.slice(0, -1) : pts, 0.2); if (fp.length >= 2) PATHS.push(mkPath(id, fp, cl || pts.length > 3 && /loop|ring|круг/i.test(id))); }); } catch (e) { /* без дорожек карты */ }
    const ownPaths = {}; Object.keys(FALLBACK).forEach(id => { const [pts, cl] = FALLBACK[id], fp = fixPts(pts, 0.2); if (fp.length >= 2) ownPaths[id] = mkPath('own:' + id, fp, cl); });
    const pathNear = (x, z, maxD = 6, pref) => {
      let best = null, bd = maxD;
      PATHS.forEach(p => { const n = p.nearest(x, z); if (n.d < bd) { bd = n.d; best = p; } });
      // своя петля «по характеру» (кольцо площади для мышек, тротуар Октябрьской для Тапка) — если она ближе
      if (pref && ownPaths[pref] && ownPaths[pref].nearest(x, z).d <= Math.min(bd, 6)) return ownPaths[pref];
      if (best) return best;
      bd = 1e9; Object.values(ownPaths).forEach(p => { const n = p.nearest(x, z); if (n.d < bd) { bd = n.d; best = p; } });
      return best;
    };
    // пруд в парке (L.pond, волна 3): утки плавают по нему, капибара сидит на берегу; без пруда — река у набережной
    const POND = L.pond && L.pond.b ? L.pond : null;
    const RAILZ = L.river && typeof L.river.z === 'number' ? L.river.z - 0.2 : 66.3;
    function shoreSpot(c, r, d, rad) {
      for (let k = 0; k < 24; k++) { const a = PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * TAU / 24, x = c.x + Math.cos(a) * (r + d), z = c.z + Math.sin(a) * (r + d); if (!blockedAt(x, z, rad) && !blockedAt(x + Math.cos(a) * 0.8, z + Math.sin(a) * 0.8, rad)) return { x, z, ry: Math.atan2(c.x - x, c.z - z) }; }
      return null;
    }
    // собачья площадка: точка карты (pois.kind === 'dogpark'), иначе — северная часть парка
    const poi = k => { try { return (L.pois || []).find(q => q && q.kind === k) || null; } catch (e) { return null; } };
    const DP = (() => { const p = poi('dogpark'); return p ? { x: p.x, z: p.z, area: { cx: p.x, cz: p.z, r: 5.5 } } : { x: -43.2, z: 23.5, area: { x0: -47.4, x1: -39, z0: 17, z1: 30 } }; })();

    // лавочки: по два места на каждой (MAP.seats — { x, z, ry }; лицом по +z лавочки)
    const SLOTS = [];
    (MAP.seats || []).forEach(sd => { const fx = Math.sin(sd.ry), fz = Math.cos(sd.ry), ax = Math.cos(sd.ry), az = -Math.sin(sd.ry);
      [-0.36, 0.36].forEach(k => SLOTS.push({ x: sd.x + ax * k + fx * 0.03, z: sd.z + az * k + fz * 0.03, ry: sd.ry, fx, fz, occ: null, ax: sd.x + ax * k + fx * 0.8, az: sd.z + az * k + fz * 0.8 })); });
    // фонари и стволы рядом с дорожкой — понюхать
    const SNIFF = COL.circles.filter(c => c.r >= 0.12 && c.r <= 0.45);

    /* ---------- облачка и голоса ---------- */
    const SAYOBJ = n => (n.obj || (n.obj = { getPos: v => v.set(n.x, (n.y || 0) + n.headY * (n.root.scale.y || 1) + 0.55, n.z) }));
    function say(n, text, ms, title) {
      if (!text || !o.ui) return;
      const g = G_(), nm = title === undefined ? null : title;
      let tx = text; if (/\{name\}/.test(tx)) tx = tx.replace(/\{name\}/g, g && g.state ? ((g.state().name || '').trim()) : '');
      o.ui.say(SAYOBJ(n), (nm ? `<b>${esc(nm)}</b>` : '') + `<span>${esc(tx)}</span>`, ms || Math.max(2400, Math.min(5000, 1400 + tx.length * 45)), '');
      if (g && g.voiceLine) { try { const v = g.voiceLine(n.voice || n.id, text, { mode: 'bubble' }); for (let i = 0; i < tx.length; i++) setTimeout(() => v(i), 120 + i * 38); } catch (e) { /* без голоса */ } }
    }
    const sayLine = (n, line, ms) => { if (!line) return; const who = line.who, holder = who === n.id || !WHO[who] ? n : WHO[who]; holder.voice = who; say(holder, line.text, ms); holder.voice = null; };

    /* ---------- жители ---------- */
    const SP = MAP.npcSpots || WORLD.RESIDENT_SPOTS;
    const agents = [], WHO = {};
    const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-PI / 2);
    let blobs = null;
    const cast = (o.cast || WORLD.LIFE_CAST).filter(c => !c.kind.startsWith('npc:') || (A.NPC && A.NPC[c.kind.slice(4)]));
    cast.forEach(c => {
      const spot = c.beh === 'npc' ? (SP[c.id] || WORLD.RESIDENT_SPOTS[c.id]) : null;
      let home = spot ? { x: spot.x, z: spot.z, ry: spot.ry } : c.home === 'dogpark' ? { x: DP.x + rnd(-2.5, 2.5), z: DP.z + rnd(-3, 3), ry: rnd(-PI, PI) } : c.home ? { x: c.home.x, z: c.home.z, ry: c.home.ry || 0 } : null;
      let capyArea = null;
      if (c.beh === 'ducks' && POND) home = { x: POND.b.x, z: POND.b.z - (POND.b.r - 1.8), ry: PI / 2 };
      if (c.beh === 'capy' && POND) { const sp = shoreSpot(POND.a, POND.a.r, 1.3, c.r); if (sp) { home = sp; capyArea = { cx: sp.x, cz: sp.z, r: 1.6 }; } }
      if (!home) return;
      if (c.move !== 'swim' && blockedAt(home.x, home.z, c.r)) { const q = collide(home.x, home.z, c.r + 0.05); home = { x: q[0], z: q[1], ry: home.ry }; }
      let I = null; try { I = C.make(c.kind); } catch (e) { console.warn('life critter', c.kind, e); }
      if (!I) return;
      if (c.scale) I.root.scale.setScalar(c.scale);
      I.root.userData.dn = 'actor';   // волна 4 (DayNight): ночью зверята темнеют на ⅔, как героиня, — их видно
      scene.add(I.root);
      const n = {
        id: c.id, c, I, root: I.root, x: home.x, z: home.z, y: 0, ry: home.ry, home, headY: c.headY || 0.5, r: c.r || 0.3, small: !!c.small,
        li: 0, ti: 0, greetT: -99, honkT: -99, faceHero: 0, faceCar: 0, ry0: home.ry, outlines: [], anim: () => {},
        act: 'stand', actT: rnd(1, 4), tx: home.x, tz: home.z, spd: 0, want: 0, dir: Math.random() < 0.5 ? 1 : -1, lane: 0, s: 0, path: null, area: null,
        stuckT: 0, stuckN: 0, lx: home.x, lz: home.z, chkT: 0, noticeT: 0, noticeCd: 0, bench: null, perch: null, partner: null, pairCd: rnd(10, 30),
        vis: false, lod: 2, acc: 0, lastHop: 0, follow: false, petT: 0, members: null, sitHome: false, lookT: 0, lookA: 0,
      };
      n.hop = () => { I.hop(); const t = now(); if (Math.abs(n.greetT - t) < 0.08) onGreet(n); };
      if (c.move === 'path') { n.path = pathNear(home.x, home.z, c.id === 'cat_tux' || c.id === 'mice' ? 1e9 : 6, c.id === 'cat_tux' ? 'prom' : c.id === 'mice' ? 'square' : c.id === 'hedgehog_leaf' ? 'park' : c.id === 'cat_tabby' ? 'oct' : null); if (n.path) { n.s = n.path.nearest(home.x, home.z).s; n.s0 = n.s; } else c.move = 'area'; }
      if (c.move === 'area') n.area = capyArea || (c.area ? { x0: c.area.x0, x1: c.area.x1, z0: c.area.z0, z1: c.area.z1 } : c.home === 'dogpark' ? DP.area : { cx: home.x, cz: home.z, r: c.roam || 4 });
      if (capyArea) n.faceTo = { x: POND.a.x, z: POND.a.z };
      if (c.beh === 'ducks') { n.y = POND ? (POND.y || 0) - 0.03 : -0.56; n.members = [{ x: 0, z: 0, ry: 0 }, { x: 0, z: -0.5, ry: 0 }, { x: 0, z: -0.88, ry: 0 }, { x: 0, z: -1.26, ry: 0 }]; n.trail = []; n.swimDir = 1; n.swimA = -PI / 2; I.st.swim = 1; }
      if (c.beh === 'mice') { n.members = [{ x: -0.32, z: 0.02, ry: 0 }, { x: 0, z: 0.12, ry: 0 }, { x: 0.32, z: 0.02, ry: 0 }]; n.trail = []; }
      if (c.dogpark) n.dogpark = true;
      n.root.position.set(n.x, n.y, n.z); n.root.rotation.y = n.ry;
      if (I.outline) I.outline.visible = true;
      agents.push(n); WHO[n.id] = n;
    });
    // утята говорят от утки (облачко над мамой)
    if (WHO.ducks) WHO.ducklings = WHO.ducks;
    // тени-пятна: одна пачка инстансов на всех
    if (H && H.blobMat) {
      blobs = new T.InstancedMesh(blobGeo, H.blobMat, agents.length + 2);
      blobs.frustumCulled = false; blobs.castShadow = false; blobs.receiveShadow = false; blobs.renderOrder = 1; blobs.raycast = () => {};
      const z0 = new T.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < agents.length + 2; i++) blobs.setMatrixAt(i, z0);
      scene.add(blobs);
    }
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _v = new T.Vector3();
    const setBlob = (i, x, y, z, sx, sz, ry) => { if (!blobs) return; _q.setFromAxisAngle(_up, ry || 0); _s.set(sx, 1, sz); _p.set(x, y + 0.025, z); blobs.setMatrixAt(i, _m.compose(_p, _q, _s)); };
    const hideBlob = i => { if (!blobs) return; _s.set(0, 0, 0); _p.set(0, -50, 0); blobs.setMatrixAt(i, _m.compose(_p, _q.identity(), _s)); };

    const npcs = agents.slice();   // то, что видит прогулка как w.npcs (компаньона в нём нет)
    const life = { npcs, agents, WHO, DP, SLOTS, paths: PATHS, ownPaths, collide, blockedAt, clearLine, say, sayLine, companion: null, critters: C };
    WORLD._lifeName = id => (life.companion && life.companion.nameOf ? life.companion.nameOf(id) : null);

    /* ---------- «привет» мимоходом: не чаще раза в 9 с по всем ---------- */
    let lastGreet = -99;
    const GREET_GAP = 9;
    function onGreet(n) { lastGreet = now(); n.noticeT = Math.max(n.noticeT, 2.2); }
    life.canGreet = n => now() - lastGreet > GREET_GAP && !(n && (n.act === 'sleep' || n.follow));
    function guardGreet() {
      const t = now();
      agents.forEach(n => {
        // прогулка зовёт greet(n, true), если now − greetT ≥ 25: «подвинуть» greetT, пока общий ограничитель занят или зверёк спит
        if (n.act === 'sleep' || n.act === 'chat' || n.follow || t - lastGreet < GREET_GAP) { if (t - n.greetT >= 24) n.greetT = t - 24; }
      });
    }

    /* ---------- поведение ---------- */
    const CTX = { hx: 0, hz: 0, hvx: 0, hvz: 0, hs: 0, mode: 'walk', active: false };
    let prevH = null;
    function partnerOf(n) { for (const p of WORLD.LIFE_PAIRS) { if (p.a === n.id && WHO[p.b]) return { o: WHO[p.b], p }; if (p.b === n.id && WHO[p.a]) return { o: WHO[p.a], p }; } return null; }
    const pairsOf = n => WORLD.LIFE_PAIRS.filter(p => (p.a === n.id && WHO[p.b]) || (p.b === n.id && WHO[p.a])).map(p => ({ o: WHO[p.a === n.id ? p.b : p.a], p }));
    const free = n => !n.follow && !n.bench && !n.perch && n.act !== 'chat' && n.act !== 'sleep' && n.act !== 'pet' && n.faceHero <= 0;
    function pickArea(n) {
      const A2 = n.area;
      for (let k = 0; k < 12; k++) {
        let x, z;
        if (A2.r !== undefined) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * A2.r; x = A2.cx + Math.cos(a) * rr; z = A2.cz + Math.sin(a) * rr; }
        else { x = rnd(A2.x0, A2.x1); z = rnd(A2.z0, A2.z1); }
        if (Math.hypot(x - n.x, z - n.z) < 1.2) continue;
        if (!blockedAt(x, z, n.r) && clearLine(n.x, n.z, x, z, n.r * 0.8)) return [x, z];
      }
      return null;
    }
    function goTo(n, x, z, act, then) { n.act = 'goto'; n.tx = x; n.tz = z; n.then = then || null; n.actT = 25; n.goAct = act || null; n.want = n.c.speed; }
    function next(n) {
      const c = n.c, b = c.beh, r = Math.random();
      n.then = null; n.goAct = null; n.want = 0;
      I_st(n, { sit: 0, lie: 0, sleep: 0, sniff: 0, play: 0, lookUp: 0 });
      // утки: всегда плывут
      if (b === 'ducks') { n.act = 'swim'; n.actT = rnd(10, 18); n.want = c.speed; return; }
      // к собеседнику (пары): иногда идём поболтать
      if (r < 0.18 && !n.perch) { const ps = pairsOf(n).filter(q => free(q.o) && !q.o.follow && Math.hypot(q.o.x - n.x, q.o.z - n.z) < 10 && n.pairCd <= 0 && q.o.pairCd <= 0); if (ps.length) { const q = ps[0]; const dx = q.o.x - n.x, dz = q.o.z - n.z, d = Math.hypot(dx, dz) || 1; const tx = q.o.x - dx / d * 1.1, tz = q.o.z - dz / d * 1.1; if (!blockedAt(tx, tz, n.r) && clearLine(n.x, n.z, tx, tz, n.r * 0.8)) { goTo(n, tx, tz, 'meet'); n.meet = q; return; } } }
      // лавочка: кошки — поспать, жители — посидеть
      if ((b === 'cat' && r < 0.42) || (b === 'npc' && !c.small && r > 0.86) || (b === 'dog' && c.lazy && r > 0.9)) { const sl = freeSlot(n, b === 'cat' ? 11 : 6); if (sl) { goTo(n, sl.ax, sl.az, 'bench'); n.slot = sl; sl.occ = n; return; } }
      // кошки на бортике фонтана или перилах
      if (b === 'cat' && c.perch && r > 0.42 && r < 0.72) { const pc = perchStart(n); if (pc) { goTo(n, pc.ax, pc.az, 'perch'); n.perchPlan = pc; return; } }
      // жители: домой, постоять на своём месте
      if (b === 'npc' && (r < 0.35 || Math.hypot(n.x - n.home.x, n.z - n.home.z) > (c.roam || 5) + 1.5)) { goTo(n, n.home.x, n.home.z, 'home'); return; }
      // витрина: на тротуаре Октябрьской — встать лицом к фасадам
      if ((c.window || (b === 'npc' && n.path && n.path.id.indexOf('oct') >= 0)) && r > 0.72 && n.z < 3.5) { const tz = 0.25, tx = n.x + rnd(-1.5, 1.5); if (!blockedAt(tx, tz, n.r)) { goTo(n, tx, tz, 'window'); return; } }
      // понюхать фонарь или ствол (собачки, ёжики)
      if ((b === 'dog' || b === 'hedge') && r > 0.55 && r < 0.8) { let best = null, bd = 6; SNIFF.forEach(q => { const d = Math.hypot(q.x - n.x, q.z - n.z); if (d < bd && d > 0.8) { bd = d; best = q; } }); if (best) { const dx = n.x - best.x, dz = n.z - best.z, d = Math.hypot(dx, dz) || 1, tx = best.x + dx / d * (best.r + n.r + 0.12), tz = best.z + dz / d * (best.r + n.r + 0.12); if (!blockedAt(tx, tz, n.r) && clearLine(n.x, n.z, tx, tz, n.r * 0.8)) { goTo(n, tx, tz, 'sniff'); n.sniffAt = best; return; } } }
      // мышки: играют
      if (b === 'mice' && r < 0.45) { n.act = 'play'; n.actT = rnd(9, 16); return; }
      // постоять / посидеть / полежать
      if (r < (b === 'capy' ? 0.7 : b === 'npc' ? 0.3 : c.lazy ? 0.55 : 0.32)) {
        n.act = b === 'capy' ? (Math.random() < 0.5 ? 'lie' : 'sit') : b === 'dog' ? (c.lazy && Math.random() < 0.5 ? 'lie' : Math.random() < 0.6 ? 'sit' : 'stand') : b === 'cat' ? (Math.random() < 0.6 ? 'sit' : 'wash') : 'stand';
        n.actT = b === 'capy' ? rnd(18, 40) : rnd(3, 8); n.lookT = 0;
        if (b === 'capy') n.lookAt = n.faceTo ? Math.atan2(n.faceTo.x - n.x, n.faceTo.z - n.z) + rnd(-0.4, 0.4) : rnd(-0.5, 0.5);   // капибара сидит лицом к воде
        return;
      }
      // идти
      if (n.path && c.move === 'path') { n.act = 'walk'; n.actT = rnd(5, 12); n.walkSpd = c.speed * rnd(0.85, 1.1); n.want = n.walkSpd; if (Math.random() < 0.3) n.dir = -n.dir; return; }
      if (n.area || c.move === 'area') { const p = pickArea(n); if (p) { goTo(n, p[0], p[1], null); return; } }
      n.act = 'stand'; n.actT = rnd(2, 5);
    }
    const I_st = (n, st) => Object.assign(n.I.st, st);
    function freeSlot(n, maxD) { let best = null, bd = maxD; SLOTS.forEach(sl => { if (sl.occ) return; const d = Math.hypot(sl.ax - n.x, sl.az - n.z); if (d < bd && !blockedAt(sl.ax, sl.az, n.r) && clearLine(n.x, n.z, sl.ax, sl.az, n.r * 0.8)) { if (n.area && n.area.r !== undefined && Math.hypot(sl.x - n.area.cx, sl.z - n.area.cz) > n.area.r + 3) return; bd = d; best = sl; } }); return best; }
    // возвышения: бортик фонтана (кот Бублик), перила набережной (кот Сажа)
    function perchStart(n) {
      if (n.c.perch === 'rim') { const a = Math.atan2(n.z - F.z, n.x - F.x) + rnd(-0.4, 0.4), R1 = (F.r || 3.05) + 0.65, R0 = (F.r || 3.05) - 0.06; const ax = F.x + Math.cos(a) * R1, az = F.z + Math.sin(a) * R1; if (blockedAt(ax, az, n.r)) return null; return { kind: 'rim', a, ax, az, x: F.x + Math.cos(a) * R0, z: F.z + Math.sin(a) * R0, y: 0.7 }; }
      if (n.c.perch === 'rail') { const zr = RAILZ, x = clamp(n.x + rnd(-1, 1), -44, 64); if (B0.z1 < 64 || Math.abs(n.z - zr) > 8) return null; const ax = x, az = Math.min(B0.z1 - 0.35, zr - 0.7); if (blockedAt(ax, az, n.r)) return null; return { kind: 'rail', ax, az, x, z: zr, y: 0.99 }; }
      return null;
    }

    // шаг по поведению (dt) — цель скорости и направления
    const tmpP = { x: 0, z: 0, tx: 0, tz: 0 };
    function think(n, dt) {
      const c = n.c;
      n.actT -= dt; n.pairCd -= dt; n.noticeCd -= dt;
      if (n.petT > 0) { n.petT -= dt; n.want = 0; return null; }
      // реплика героини с жителем / гудок: стоим и смотрим
      if (n.faceHero > 0 || n.faceCar > 0) { n.faceHero = Math.max(0, n.faceHero - dt); n.faceCar = Math.max(0, n.faceCar - dt); if (!n.bench && !n.perch && c.beh !== 'ducks') { n.want = 0; return null; } }
      // заметить героиню: идёт навстречу — остановиться и посмотреть, потом уступить
      if (n.noticeT > 0) { n.noticeT -= dt; n.want = 0; if (n.noticeT <= 0) n.lane = n.sideAway || 0; return null; }
      if (CTX.active && CTX.mode !== 'drive' && n.noticeCd <= 0 && !n.bench && !n.perch && c.beh !== 'ducks' && n.act !== 'sleep' && n.act !== 'chat' && n.goAct !== 'present') {
        const dx = n.x - CTX.hx, dz = n.z - CTX.hz, d = Math.hypot(dx, dz), R = CTX.mode === 'ride' ? 3.6 : 2.3;
        if (d < R && CTX.hs > 0.6 && (dx * CTX.hvx + dz * CTX.hvz) / (d * CTX.hs + 1e-6) > 0.55) {
          n.noticeT = rnd(0.9, 1.6); n.noticeCd = rnd(7, 12); n.lookHero = 1.8;
          n.sideAway = (dx * CTX.hvz - dz * CTX.hvx) > 0 ? 0.8 : -0.8;
          if (c.beh === 'dog') n.I.st.wag = 0.9;
          return null;
        }
      }
      switch (n.act) {
        case 'walk': {
          if (n.actT <= 0) { next(n); return null; }
          const p = n.path; if (!p) { next(n); return null; }
          n.want = n.walkSpd || c.speed;   // после «заметила её» — снова в путь
          const roam = c.roam || 6;
          if (!p.closed || roam < p.len / 2) { const ds = n.s - n.s0; if ((ds > roam && n.dir > 0) || (ds < -roam && n.dir < 0)) n.dir = -n.dir; if (!p.closed && ((n.s >= p.len - 0.5 && n.dir > 0) || (n.s <= 0.5 && n.dir < 0))) n.dir = -n.dir; }
          n.s += n.dir * n.spd * dt;
          p.at(n.s + n.dir * 1.0, tmpP);
          const lane = (n.lane || 0) + n.dir * (n.small ? 0.15 : 0.32);
          return [tmpP.x - tmpP.tz * lane, tmpP.z + tmpP.tx * lane];
        }
        case 'goto': {
          const d = Math.hypot(n.tx - n.x, n.tz - n.z);
          if (d < 0.25 || n.actT <= 0) { arrive(n, d < 0.6); return null; }
          n.want = (n.goSpeed || c.speed) * (d < 0.8 ? 0.6 : 1);
          return [n.tx, n.tz];
        }
        case 'swim': {
          if (n.actT <= 0) { n.actT = rnd(10, 18); if (Math.random() < 0.35) { n.act = 'float'; n.actT = rnd(4, 8); n.want = 0; return null; } }
          n.want = c.speed;
          if (POND) {
            // по кругу в «утиной» половине пруда, иногда — в соседнюю и обратно
            const lobe = n.lobe === 'a' ? POND.a : POND.b, R0 = Math.max(1.5, lobe.r - 1.8);
            n.swimA += n.swimDir * c.speed * dt / R0;
            if (Math.random() < dt * 0.01) n.lobe = n.lobe === 'a' ? 'b' : 'a';
            return [lobe.x + Math.cos(n.swimA) * R0, lobe.z + Math.sin(n.swimA) * R0];
          }
          const x0 = -40, x1 = 60; if ((n.x > x1 && n.swimDir > 0) || (n.x < x0 && n.swimDir < 0)) n.swimDir = -n.swimDir;
          return [n.x + n.swimDir * 2, n.home.z + Math.sin(n.x * 0.15) * 0.25];
        }
        case 'float': if (n.actT <= 0) { n.act = 'swim'; n.actT = rnd(10, 18); } n.want = 0; return null;
        case 'bench': case 'perchWalk': case 'perch': return benchTick(n, dt);
        case 'chat': {
          n.want = 0;
          const q = n.partner; if (q) n.lookAt = Math.atan2(q.x - n.x, q.z - n.z);
          if (n.actT <= 0) { n.partner = null; n.lookAt = null; next(n); }
          return null;
        }
        case 'sleep': n.want = 0; if (n.actT <= 0) { I_st(n, { sleep: 0, lie: 0, stretch: 1 }); n.act = 'stretch'; n.actT = 1.6; } return null;
        case 'stretch': n.want = 0; if (n.actT <= 0) { I_st(n, { stretch: 0 }); next(n); } return null;
        case 'play': n.want = 0; I_st(n, { play: 1 }); if (n.actT <= 0) { I_st(n, { play: 0 }); next(n); } return null;
        case 'sit': case 'lie': case 'stand': case 'wash': case 'window': case 'sniff': case 'home': default: {
          n.want = 0;
          if (n.act === 'sit') I_st(n, { sit: 1 }); else if (n.act === 'lie') I_st(n, { lie: 1 }); else if (n.act === 'wash') I_st(n, { sit: 1, wash: n.actT % 3 < 1.6 ? 1 : 0 });
          else if (n.act === 'sniff') I_st(n, { sniff: 1 }); else if (n.act === 'window') n.lookAt = PI;
          else if (n.act === 'home') n.lookAt = n.home.ry;
          // оглядывается
          n.lookT -= dt; if (n.lookT <= 0) { n.lookT = rnd(1.5, 3.5); n.lookA = Math.random() < 0.4 ? 0 : rnd(-0.8, 0.8); }
          if (n.actT <= 0) { I_st(n, { sit: 0, lie: 0, wash: 0, sniff: 0 }); n.lookAt = null; next(n); }
          return null;
        }
      }
    }
    function arrive(n, ok) {
      const ga = n.goAct; n.goAct = null; n.goSpeed = 0;
      if (!ok) { if (n.slot && n.slot.occ === n) n.slot.occ = null; n.slot = null; n.perchPlan = null; next(n); return; }
      if (ga === 'bench') { startBench(n); return; }
      if (ga === 'perch') { startPerch(n); return; }
      if (ga === 'meet') { const q = n.meet && n.meet.o; n.meet = null; if (q && free(q) && Math.hypot(q.x - n.x, q.z - n.z) < 2.6) startChat(n, q); else next(n); return; }
      if (ga === 'window') { n.act = 'window'; n.actT = rnd(3, 6); return; }
      if (ga === 'sniff') { n.act = 'sniff'; n.actT = rnd(2, 4); if (n.sniffAt) n.lookAt = Math.atan2(n.sniffAt.x - n.x, n.sniffAt.z - n.z); return; }
      if (ga === 'home') { n.act = 'home'; n.actT = rnd(6, 14); return; }
      if (ga === 'present') { n.goSpeed = 0; n.act = 'sit'; n.actT = rnd(12, 15); n.faceHero = 12; I_st(n, { sit: 1 }); n.I.st.wag = 1; n.I.hop(); return; }   // встреча на площадке (companion.js): сидят и ждут, кого погладят
      next(n);
    }
    // лавочка и возвышения: запрыгнуть, посидеть/поспать, спрыгнуть
    function startBench(n) {
      const sl = n.slot; if (!sl) { next(n); return; }
      n.bench = { sl, k: 0, phase: 'up', a0: { x: n.x, z: n.z, y: 0 }, a1: { x: sl.x, z: sl.z, y: n.c.beh === 'cat' ? 0.5 : 0.44 } };
      n.act = 'bench'; n.actT = n.c.beh === 'cat' ? rnd(25, 55) : rnd(10, 20);
    }
    function startPerch(n) {
      const pp = n.perchPlan; if (!pp) { next(n); return; }
      n.perch = { pp, k: 0, phase: 'up', a0: { x: n.x, z: n.z, y: 0 }, a1: { x: pp.x, z: pp.z, y: pp.y }, a: pp.a, walkT: rnd(6, 12), dir: Math.random() < 0.5 ? 1 : -1 };
      n.act = 'perch'; n.actT = rnd(30, 50);
    }
    function benchTick(n, dt) {
      const P = n.bench || n.perch; if (!P) { next(n); return null; }
      n.want = 0;
      if (P.phase === 'up' || P.phase === 'down') {
        // прыжок: дуга из A0 в A1 за 0,45 с
        P.k = Math.min(1, P.k + dt / 0.45);
        const e = P.k * P.k * (3 - 2 * P.k), A0 = P.a0, A1 = P.a1;
        n.x = A0.x + (A1.x - A0.x) * e; n.z = A0.z + (A1.z - A0.z) * e; n.y = A0.y + (A1.y - A0.y) * e + Math.sin(P.k * PI) * 0.25;
        if (Math.hypot(A1.x - A0.x, A1.z - A0.z) > 0.05) n.lookAt = Math.atan2(A1.x - A0.x, A1.z - A0.z);
        n.hardHead = true;
        if (P.k < 1) return null;
        if (P.phase === 'up') {
          P.phase = 'on'; n.y = A1.y;
          if (n.bench) { n.lookAt = P.sl.ry; I_st(n, n.c.beh === 'cat' ? { lie: 1, sleep: 1 } : { sit: 1 }); }
          return null;
        }
        // спрыгнул
        n.y = 0; if (n.bench && n.bench.sl.occ === n) n.bench.sl.occ = null;
        n.bench = null; n.perch = null; n.slot = null; n.perchPlan = null; n.hardHead = false; n.lookAt = null;
        I_st(n, { sit: 0, lie: 0, sleep: 0, stretch: 0 }); next(n);
        return null;
      }
      // на возвышении: ходит по бортику / перилам, потом садится или засыпает
      if (n.perch && P.walkT > 0) {
        P.walkT -= dt; I_st(n, { sit: 0, sleep: 0, lie: 0 });
        const sp = 0.42;
        if (P.pp.kind === 'rim') { const R0 = (F.r || 3.05) - 0.06; P.a += P.dir * sp * dt / R0; n.x = F.x + Math.cos(P.a) * R0; n.z = F.z + Math.sin(P.a) * R0; n.lookAt = Math.atan2(-Math.sin(P.a) * P.dir, Math.cos(P.a) * P.dir); }
        else { n.x = clamp(n.x + P.dir * sp * dt, -44, 64); if (n.x <= -44 || n.x >= 64) P.dir = -P.dir; n.z = P.pp.z; n.lookAt = P.dir > 0 ? PI / 2 : -PI / 2; }
        n.perchSpd = sp;
        if (P.walkT <= 0) { n.perchSpd = 0; I_st(n, Math.random() < 0.5 ? { sit: 1 } : { lie: 1, sleep: 1 }); }
        return null;
      }
      n.perchSpd = 0;
      if (n.actT > 0) return null;
      // проснуться и потянуться, потом спрыгнуть
      if (n.I.st.sleep > 0.5) { I_st(n, { sleep: 0, lie: 0, stretch: 1 }); n.actT = 1.4; return null; }
      I_st(n, { stretch: 0, sit: 0, lie: 0 });
      let gx, gz;
      if (n.bench) { gx = P.sl.ax; gz = P.sl.az; }
      else if (P.pp.kind === 'rim') { const a = Math.atan2(n.z - F.z, n.x - F.x), R1 = (F.r || 3.05) + 0.65; gx = F.x + Math.cos(a) * R1; gz = F.z + Math.sin(a) * R1; }
      else { gx = n.x; gz = P.pp.z - 0.7; }
      if (blockedAt(gx, gz, n.r)) { const q = collide(gx, gz, n.r); gx = q[0]; gz = q[1]; }
      P.a0 = { x: n.x, z: n.z, y: n.y }; P.a1 = { x: gx, z: gz, y: 0 }; P.phase = 'down'; P.k = 0;
      return null;
    }
    function startChat(a, b) {
      const T1 = rnd(6, 9);
      a.act = b.act = 'chat'; a.actT = b.actT = T1; a.partner = b; b.partner = a; a.pairCd = b.pairCd = rnd(60, 90); a.want = b.want = 0;
      if (b.bench || b.perch) return;
      const p = (WORLD.LIFE_PAIRS.find(q => (q.a === a.id && q.b === b.id) || (q.a === b.id && q.b === a.id)) || {}).lines;
      if (p && CTX.active && CTX.mode !== 'drive' && !CTX.blocked && now() - lastOverheard > 45 && Math.hypot(a.x - CTX.hx, a.z - CTX.hz) < 6) {
        lastOverheard = now();
        p.forEach((line, i) => setTimeout(() => { if (!sessionOn) return; const holder = WHO[line.who] || a; holder.voice = line.who; say(holder, line.text, 2400); holder.voice = null; }, 300 + i * 1900));
      }
    }
    let lastOverheard = -99, sessionOn = false;

    /* ---------- движение: к цели, обход друг друга и героини, столкновения ---------- */
    function steer(n, dt, tgt) {
      const c = n.c;
      // утки — по воде, без препятствий
      const want = tgt ? n.want : 0;
      let vx = 0, vz = 0;
      if (tgt) { const dx = tgt[0] - n.x, dz = tgt[1] - n.z, d = Math.hypot(dx, dz) || 1; vx = dx / d * want; vz = dz / d * want; }
      // волна 4: пока гладят (n.petT) — стоит на месте: не отступает от героини и соседей (иначе ладонь не достанет макушку)
      if (c.beh !== 'ducks' && !n.bench && !n.perch && !(n.petT > 0)) {
        // соседи
        agents.forEach(m => {
          if (m === n || m.bench || m.perch || m.c.beh === 'ducks' || !m.root) return;
          const dx = n.x - m.x, dz = n.z - m.z, d = Math.hypot(dx, dz), R = n.r + m.r + 0.18;
          if (d < R && d > 1e-4) { const k = (R - d) / R; vx += dx / d * k * 1.6; vz += dz / d * k * 1.6; }
        });
        if (life.companion && life.companion.n && life.companion.n !== n && life.companion.active()) { const m = life.companion.n, dx = n.x - m.x, dz = n.z - m.z, d = Math.hypot(dx, dz), R = n.r + m.r + 0.15; if (d < R && d > 1e-4) { const k = (R - d) / R; vx += dx / d * k * 1.5; vz += dz / d * k * 1.5; } }
        // героиня (и велосипед): шагнуть в сторону
        if (CTX.active && CTX.mode !== 'drive') {
          const dx = n.x - CTX.hx, dz = n.z - CTX.hz, d = Math.hypot(dx, dz), R = n.r + (CTX.mode === 'ride' ? 0.75 : 0.32) + 0.35;
          if (d < R && d > 1e-4) { const k = (R - d) / R; vx += dx / d * k * 2.4; vz += dz / d * k * 2.4; }
        }
      }
      const sp = Math.hypot(vx, vz), maxS = Math.max(want, 0.9) * 1.6;
      if (sp > maxS) { vx *= maxS / sp; vz *= maxS / sp; }
      const ox = n.x, oz = n.z;
      let nx = n.x + vx * dt, nz = n.z + vz * dt;
      if (c.beh !== 'ducks' && !n.bench && !n.perch) { const q = collide(nx, nz, n.r); nx = q[0]; nz = q[1]; }
      n.x = nx; n.z = nz;
      const moved = Math.hypot(nx - ox, nz - oz) / Math.max(dt, 1e-4);
      n.spd += (Math.min(moved, 3) - n.spd) * Math.min(1, dt * 8);
      if (tgt && moved > 0.08) n.head = Math.atan2(nx - ox, nz - oz);
      // застрял: хотел идти, но почти стоит
      n.chkT += dt;
      if (n.chkT > 1.6) {
        const dd = Math.hypot(n.x - n.lx, n.z - n.lz);
        if (want > 0.2 && dd < 0.2 * want * n.chkT) { n.stuckN++; unstick(n); } else if (dd > 0.3) n.stuckN = 0;
        n.lx = n.x; n.lz = n.z; n.chkT = 0;
      }
    }
    function unstick(n) {
      if (n.goAct === 'present') return;   // бежит знакомиться (companion.js сам подправит цель)
      if (n.act === 'walk') { n.dir = -n.dir; n.lane = -(n.lane || 0); }
      else if (n.act === 'goto') { if (n.slot && n.slot.occ === n) n.slot.occ = null; n.slot = null; n.perchPlan = null; n.goAct = null; n.act = 'stand'; n.actT = rnd(0.5, 1.5); }
      if (n.stuckN >= 3) {
        // совсем застрял (зажали): тихо вернуться на дорожку / к дому, если не на глазах
        const far = Math.hypot(n.x - CTX.hx, n.z - CTX.hz) > 9 || !n.vis;
        if (far) { if (n.path) { const p = n.path.at(n.s, tmpP); n.x = p.x; n.z = p.z; } else { n.x = n.home.x; n.z = n.home.z; } const q = collide(n.x, n.z, n.r); n.x = q[0]; n.z = q[1]; n.stuckN = 0; }
      }
    }
    // стайка: утята и мышки идут цепочкой по следу ведущего
    function flock(n, dt) {
      if (!n.members) return;
      const tr = n.trail; const last = tr[tr.length - 1];
      if (!last || Math.hypot(last[0] - n.x, last[1] - n.z) > 0.08) { tr.push([n.x, n.z]); if (tr.length > 60) tr.shift(); }
      const cs = Math.cos(n.root.rotation.y), sn = Math.sin(n.root.rotation.y);
      const toLocal = (wx, wz, ry) => { const dx = wx - n.x, dz = wz - n.z; return { x: dx * cs - dz * sn, z: dx * sn + dz * cs, ry: ry - n.root.rotation.y }; };
      if (n.c.beh === 'ducks') {
        const gaps = [0, 0.5, 0.88, 1.26];
        for (let i = 1; i < 4; i++) { const p = trailAt(tr, gaps[i]); if (!p) continue; const q = trailAt(tr, gaps[i] - 0.15) || [n.x, n.z]; const ry = Math.atan2(q[0] - p[0], q[1] - p[1]); const m = toLocal(p[0], p[1], ry); const M = n.members[i]; M.x += (m.x - M.x) * Math.min(1, dt * 6); M.z += (m.z - M.z) * Math.min(1, dt * 6); M.ry = m.ry; }
      } else {
        // мышки: играют — в ряд (как в заготовке), идут — цепочкой
        const playing = n.act === 'play' || n.act === 'chat' || n.act === 'stand';
        const gaps = [0.32, 0, 0.64];
        for (let i = 0; i < 3; i++) {
          let m;
          if (playing || n.spd < 0.1) m = [{ x: -0.32, z: 0.02, ry: 0 }, { x: 0, z: 0.12, ry: 0 }, { x: 0.32, z: 0.02, ry: 0 }][i];
          else { const p = i === 1 ? [n.x, n.z] : trailAt(tr, gaps[i]); if (!p) continue; const q = trailAt(tr, Math.max(0, gaps[i] - 0.15)) || [n.x, n.z]; m = toLocal(p[0], p[1], i === 1 ? n.root.rotation.y : Math.atan2(q[0] - p[0], q[1] - p[1])); }
          const M = n.members[i]; M.x += (m.x - M.x) * Math.min(1, dt * 5); M.z += (m.z - M.z) * Math.min(1, dt * 5); M.ry += angDiff(m.ry, M.ry) * Math.min(1, dt * 6);
        }
      }
      n.I.members = n.members;
    }
    function trailAt(tr, dist) {
      let acc = 0;
      for (let i = tr.length - 1; i > 0; i--) { const a = tr[i], b = tr[i - 1], l = Math.hypot(a[0] - b[0], a[1] - b[1]); if (acc + l >= dist) { const k = (dist - acc) / l; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; } acc += l; }
      return tr.length ? tr[0] : null;
    }

    /* ---------- кадр ---------- */
    let msAvg = 0, msLast = 0, frame = 0, lastReal = 0, pairT = 0, statVis = 0, statAnim = 0;
    const camP = new T.Vector3(), frustum = new T.Frustum(), projM = new T.Matrix4(), sph = new T.Sphere();
    life.update = (dt, t, ctx = {}) => {
      const t0 = performance.now();
      frame++;
      // пауза (комната, диалог в паузе): компаньон встречает героиню у двери
      const real = t0 / 1000, gap = lastReal ? real - lastReal : 0; lastReal = real;
      const hx = ctx.hx !== undefined ? ctx.hx : CTX.hx, hz = ctx.hz !== undefined ? ctx.hz : CTX.hz;
      if (prevH && dt > 0 && gap < 0.5) { const vx = (hx - prevH.x) / dt, vz = (hz - prevH.z) / dt; if (Math.hypot(vx, vz) < 12) { CTX.hvx += (vx - CTX.hvx) * Math.min(1, dt * 8); CTX.hvz += (vz - CTX.hvz) * Math.min(1, dt * 8); } }
      else { CTX.hvx = CTX.hvz = 0; }
      prevH = { x: hx, z: hz };
      Object.assign(CTX, { hx, hz, ha: ctx.ha || 0, mode: ctx.mode || 'walk', active: ctx.active !== false, blocked: !!ctx.blocked, busy: !!ctx.busy, car: ctx.car || null, bike: ctx.bike || null, cat: ctx.cat || null, api: ctx.api || CTX.api, cam: ctx.cam || o.camera, gap });
      CTX.hs = Math.hypot(CTX.hvx, CTX.hvz);
      const Q = ctx.q || { npcR: 34, outline: true }, vis = ctx.vis || {};
      const cam = CTX.cam;
      if (cam) { cam.getWorldPosition(camP); cam.updateMatrixWorld(); projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(projM); }
      const R1 = 14, R2 = Q.npcR <= 16 ? 12 : 24, olR = Q.outline === false ? 0 : (Q.npcR <= 16 ? 12 : 18 + (Q.npcR >= 34 ? 10 : 0));
      statVis = 0; statAnim = 0;
      agents.forEach((n, i) => {
        if (n.follow) { hideBlob(i); return; }
        const dH = Math.hypot(n.x - hx, n.z - hz);
        const show = vis[n.id] !== false && dH < (Q.npcR || 34) + 6;
        n.root.visible = show; n.vis = show;
        // далеко и не видно: жизнь идёт реже (4 раза в секунду)
        let step = dt;
        if (!show) { n.acc += dt; if (n.acc < 0.25) { hideBlob(i); return; } step = Math.min(n.acc, 0.5); n.acc = 0; }
        const tgt = think(n, step);
        if (!n.bench && !n.perch) steer(n, step, tgt);
        else { n.spd = n.perchSpd || 0; }
        if (n.members) flock(n, step);
        // поворот: к цели / к собеседнику / к героине (реплика, гудок)
        let want = n.root.rotation.y;
        const walking = n.spd > 0.12;
        if (n.faceHero > 0 || n.lookHero > 0) { want = Math.atan2(hx - n.x, hz - n.z); n.lookHero = Math.max(0, (n.lookHero || 0) - step); }
        else if (n.faceCar > 0 && CTX.car) want = Math.atan2(CTX.car.x - n.x, CTX.car.z - n.z);
        else if (n.lookAt !== null && n.lookAt !== undefined && (!walking || n.hardHead)) want = n.lookAt;
        else if (walking && n.head !== undefined) want = n.head;
        const turnK = n.c.beh === 'npc' ? 5 : 7;
        n.root.rotation.y += angDiff(want, n.root.rotation.y) * Math.min(1, step * turnK);
        n.ry0 = n.root.rotation.y;
        n.root.position.set(n.x, n.y, n.z);
        if (!show) { hideBlob(i); return; }
        statVis++;
        // поза
        const st = n.I.st;
        st.spd = n.pfRun > 0 ? n.pfRun : n.spd;   // волна 5: догонялки «Бум!» (playfight.js ставит n.pfRun) — шагает лапками, а не скользит
        // голова смотрит на неё, если рядом
        let look = 0;
        if (dH < 3.2 && n.act !== 'sleep') look = clamp(angDiff(Math.atan2(hx - n.x, hz - n.z), n.root.rotation.y), -0.9, 0.9);
        else if (!walking) look = n.lookA || 0;
        st.look = look;
        if (n.c.beh === 'dog') st.wag = Math.max(0.25, dH < 3 ? 0.8 : 0.3);
        // LOD: близко — каждый кадр; средне — через кадр; далеко — скелет не трогаем
        const dc = cam ? Math.hypot(n.x - camP.x, n.z - camP.z) : dH;
        let inView = true;
        if (cam) { sph.center.set(n.x, n.y + 0.3, n.z); sph.radius = n.members ? 1.8 : 0.6; inView = frustum.intersectsSphere(sph); }
        n.lod = !inView ? 3 : dc < R1 ? 0 : dc < R2 ? 1 : 2;
        if (n.lod === 0 || (n.lod === 1 && (frame + i) % 2 === 0)) { n.I.anim(n.lod === 1 ? step * 2 : step, t, 0); statAnim++; }
        else if (n.lod === 2) n.I.anim(step, t, 2);
        if (n.I.outline) n.I.outline.visible = dc < olR;
        // тень-пятно
        const sz = (n.r || 0.3) * 2.4 * (n.root.scale.x || 1);
        if (n.c.beh === 'ducks' || n.members) { if (n.c.beh === 'mice') setBlob(i, n.x, n.y, n.z, 1.3, 0.55, n.root.rotation.y); else hideBlob(i); }
        else setBlob(i, n.x, n.y, n.z, sz * (n.I.sp.rig === 'quad' ? 0.7 : 1), sz * (n.I.sp.rig === 'quad' ? 1.15 : 0.8), n.root.rotation.y);
        // настоящая тень — только трём ближайшим крупным (на «среднем» и выше), остальным хватает пятна
        n.shadowD = ctx.shadows && !n.small && dH < 6.5 ? dH : 1e9;
      });
      { const near = agents.filter(n => n.vis && !n.follow && n.shadowD < 1e8).sort((a, b) => a.shadowD - b.shadowD).slice(0, 3); agents.forEach(n => n.I.setShadow(near.indexOf(n) >= 0)); }
      // пары: болтать, если встретились
      pairT -= dt;
      if (pairT <= 0) {
        pairT = 0.5;
        WORLD.LIFE_PAIRS.forEach(p => { const a = WHO[p.a], b = WHO[p.b]; if (!a || !b || a === b || a.follow || b.follow) return; if (!free(a) || !free(b) || a.pairCd > 0 || b.pairCd > 0) return; if ([a, b].some(q => q.act === 'goto' && q.goAct && q.goAct !== 'meet')) return; if (Math.hypot(a.x - b.x, a.z - b.z) < 2.2) startChat(a, b); });
      }
      guardGreet();
      if (life.companion) life.companion.update(dt, t, ctx, CTX);
      if (blobs) blobs.instanceMatrix.needsUpdate = true;
      msLast = performance.now() - t0; msAvg += (msLast - msAvg) * 0.05;
    };

    /* ---------- снаружи: тап, «Погладить», диалог, гудок ---------- */
    const pettable = n => n && (n.c.pet || n.isCompanion) && n.act !== 'swim';
    life.actionFor = (x, z) => {
      // сначала зверята вокруг (кошка, собачки на площадке, капибара), и только если рядом никого — своя собачка:
      // она всегда в шаге от героини и иначе перехватывала «Погладить» у любой кошки (верификатор волны 3).
      // Свою собачку всегда можно погладить и тапом по ней (меню компаньона).
      let best = null, bd = 1.7;
      agents.forEach(n => { if (n.follow || !n.root.visible || !pettable(n)) return; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } });
      if (!best && life.companion && life.companion.active()) { const m = life.companion.n; const d = Math.hypot(m.x - x, m.z - z); if (d < 2.0) best = m; }
      if (!best) return null;
      return { label: 'Погладить', n: best, run: () => life.pet(best) };
    };
    life.circles = (outA = []) => { agents.forEach(n => { if (n.root.visible && !n.small && !n.follow && !n.bench && !n.perch && n.c.beh !== 'ducks') outA.push({ x: n.x, z: n.z, r: n.r }); }); return outA; };
    life.honkLine = (n, d) => WORLD.honkLine(n.id, d < 9);
    life.talk = n => {
      if (!n) return null;
      if (n.act === 'sleep' || (n.I.st.sleep > 0.5)) return WORLD.RESIDENT_SLEEP_TALK.slice();
      const T2 = WORLD.RESIDENT_TALK[n.id];
      // собачке дали новое имя — в репликах тоже оно (запись голоса тогда не найдётся — прозвучит «лепет»)
      const nm = WORLD._lifeName && WORLD._lifeName(n.id), def = (WORLD.COMPANION_DOGS || {})[n.id];
      const fix = d => (nm && def ? d.map(l => (l.text.indexOf(def) >= 0 ? Object.assign({}, l, { text: l.text.split(def).join(nm) }) : l)) : d.slice());
      if (T2 && T2.length) { const d = T2[n.ti % T2.length]; n.ti++; return fix(d); }
      const L2 = WORLD.RESIDENT_LINES[n.id] || [];
      return L2.length ? [L2[n.li % L2.length]] : null;
    };
    // экранная точка (для сердечек)
    function screenOf(x, y, z) {
      const cam = CTX.cam; if (!cam) return null;
      if (CTX.api && CTX.api.toScreen) { try { return CTX.api.toScreen(x, y, z); } catch (e) { /* дальше сами */ } }
      _v.set(x, y, z).project(cam); const g = G_(), rr = o.root ? o.root.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }, ap = g && g.app ? g.app.getBoundingClientRect() : { left: 0, top: 0 };
      return { x: (_v.x + 1) / 2 * rr.width + rr.left - ap.left, y: (1 - _v.y) / 2 * rr.height + rr.top - ap.top };
    }
    // «Погладить» (волна 4): героиня со скелетом приседает и гладит по-настоящему — ладонь на макушку, три поглаживания
    // (js/interact.js через CTX.api.petHands); зверёк ждёт на месте, радуется сразу и ещё раз, когда ладонь легла. Без слоя — как в волне 3.
    life.pet = n => new Promise(res => {
      if (!n) return res(false);
      const g = G_(), isCat = n.c.pet === 'cat', sleeping = n.I.st.sleep > 0.5;
      let reacted = false, handsOn = false;
      // радость зверька: мурчит / виляет и подпрыгивает, сердечки, ответ облачком
      const react = () => {
        if (reacted) return; reacted = true;
        if (isCat || n.c.pet === 'capy') { n.I.st.purr = 1; try { if (g && isCat) g.sfx('purr'); } catch (e) { /* ignore */ } setTimeout(() => { n.I.st.purr = 0; }, 2400); }
        else if (handsOn) { n.I.st.happy = 1; setTimeout(() => { n.I.st.happy = 0; }, 4200); }   // гладят — виляет хвостом, не прыгает (подпрыгнет после)
        else { n.I.st.happy = 1; n.I.hop(); setTimeout(() => n.I.hop(), 450); setTimeout(() => { n.I.st.happy = 0; }, 1700); }
        const sc = screenOf(n.x, (n.y || 0) + n.headY * (n.root.scale.y || 1), n.z);
        if (sc && g && g.sparkle) { try { g.sparkle(sc.x, sc.y, { kind: 'heart', n: 8, dist: 46 }); } catch (e) { /* ignore */ } }
        const P2 = WORLD.LIFE_PET[n.id] || (isCat ? [{ who: n.id, text: 'Мрр.' }] : [{ who: n.id, text: 'Тяф!' }]);
        n.pi = (n.pi || 0) + 1;
        if (!sleeping) { const line = P2[(n.pi - 1) % P2.length]; setTimeout(() => sayLine(n, line, 2200), 250); }
        else setTimeout(() => say(n, 'Мрр… (не просыпаясь)', 2200), 250);
      };
      // ладонь легла на макушку — ещё горсть сердечек и снова виляет (первая радость — сразу, как только она подошла гладить)
      const patJoy = () => {
        if (isCat || n.c.pet === 'capy') { n.I.st.purr = 1; setTimeout(() => { n.I.st.purr = 0; }, 2000); }
        else { n.I.st.happy = 1; setTimeout(() => { n.I.st.happy = 0; }, 2600); }
        const sc = screenOf(n.x, (n.y || 0) + n.headY * (n.root.scale.y || 1), n.z);
        if (sc && g && g.sparkle) { try { g.sparkle(sc.x, sc.y, { kind: 'heart', n: 6, dist: 40 }); } catch (e) { /* ignore */ } }
      };
      // героиня со скелетом — гладит по-настоящему (js/interact.js через CTX.api.petHands)
      let hands = null;
      try { hands = CTX.api && CTX.api.petHands ? CTX.api.petHands(n, { onPet: k => { if (k === 0) patJoy(); } }) : null; } catch (e) { hands = null; }
      handsOn = !!hands;
      n.petT = hands ? 30 : isCat ? 2.6 : 2.0; n.lookHero = sleeping ? 0 : hands ? 30 : 2.2; n.noticeT = 0;   // с руками — ждёт, пока гладят
      if (!sleeping && !n.bench && !n.perch) n.want = 0;
      try { if (g) g.haptic('light'); } catch (e) { /* ignore */ }
      if (!hands && CTX.api && CTX.api.face) { try { CTX.api.face(Math.atan2(n.x - CTX.hx, n.z - CTX.hz)); setTimeout(() => { try { CTX.api.faceCamera(); } catch (e) { /* ignore */ } }, 1800); } catch (e) { /* ignore */ } }
      react();   // радуется сразу (с руками — виляет и мурчит без прыжков: прыгнет, когда догладят)
      n.petN = (n.petN || 0) + 1;
      try { window.dispatchEvent(new CustomEvent('life:pet', { detail: { id: n.id, companion: !!n.isCompanion, hands: !!hands } })); } catch (e) { /* старый браузер */ }
      const done = () => {
        if (!reacted) react();
        if (hands) { n.petT = isCat ? 1.2 : 0.8; n.lookHero = sleeping ? 0 : 1.5; if (!isCat && n.c.pet !== 'capy' && !sleeping) n.I.hop(); }   // погладили — подпрыгнул от радости
        res(true); if (life.companion && life.companion.afterPet) life.companion.afterPet(n);
      };
      if (hands && hands.then) hands.then(() => setTimeout(done, 350), () => setTimeout(done, 350));
      else setTimeout(done, isCat ? 1500 : 1200);
    });
    life.hit = (ray, camPos) => {
      const cp = life.companion; if (!cp || !cp.active()) return null;
      const m = cp.n; _v.set(m.x, (m.y || 0) + 0.25, m.z);
      if (ray.distanceSqToPoint(_v) < 0.42 * 0.42) return { kind: 'life', ref: m, t: _v.distanceTo(camPos) };
      return null;
    };
    life.tap = ref => { if (life.companion && ref && ref.isCompanion) return life.companion.menu(); return null; };
    life.say = say;
    life.stats = () => ({ agents: agents.length, visible: statVis, animated: statAnim, ms: msLast, msAvg, frame });
    // «Помахать»: все рядом поворачиваются, собачки радуются; у некоторых ответ свой
    let waved = new Set();
    const offWave = (G_() && G_().onWave) ? G_().onWave(info => {
      if (!info || info.where !== 'world') return null;
      agents.forEach(n => { if (n.follow) return; const d = Math.hypot(n.x - CTX.hx, n.z - CTX.hz); if (d < 7 && n.act !== 'sleep') { n.faceHero = Math.max(n.faceHero, 2.2); if (n.c.beh === 'dog') { n.I.st.happy = 1; setTimeout(() => { n.I.st.happy = 0; }, 1200); } if (d < 4.5) setTimeout(() => n.I.hop(), 300 + d * 60); } });
      if (life.companion && life.companion.onWave) life.companion.onWave(info);
      const n = info.npc && WHO[info.npc]; if (!n) return null;
      const W2 = WORLD.LIFE_WAVE[n.id]; if (!W2) return null;
      const intro = !waved.has(n.id); waved.add(n.id);
      const g = G_(), nm = info.name || '';
      const useName = intro && nm && W2.name && (g && g.nameOk ? g.nameOk() : true);
      const list = useName ? W2.name : W2.plain || W2.name;
      const line = list[(n.wi = (n.wi || 0) + 1) % list.length];
      if (W2.after) {
        const okName = intro && nm && W2.after.name && (g && g.nameOk ? g.nameOk() : true), L2 = okName ? W2.after.name : W2.after.plain, l2 = L2[0];
        setTimeout(() => { if (!sessionOn) return; n.voice = l2.who; say(n, l2.text, 2600); n.voice = null; }, 2600);
      }
      return line.text.replace('{name}', nm);
    }) : null;
    life.session = sctx => {
      sessionOn = !!sctx; waved = new Set();
      if (life.companion) life.companion.session(sctx, CTX);
    };
    life.dispose = () => { if (offWave) offWave(); agents.forEach(n => n.I.dispose()); if (blobs) { scene.remove(blobs); blobs.dispose(); } };
    life.setBlob = (x, y, z, s) => { const i = agents.length; if (s) setBlob(i, x, y, z, s * 0.75, s, 0); else hideBlob(i); };

    // компаньон (companion.js)
    if (WORLD.makeCompanion) { try { life.companion = WORLD.makeCompanion(life, o); } catch (e) { console.warn('life companion', e); life.companion = null; } }
    // начальное поведение — у всех разное
    agents.forEach(n => { n.actT = rnd(0.2, 3); });
    return life;
  };
})();
