/* =====================================================================
   СЕРИЯ 1 «ПРОПАЖА»
   Все реплики — прочитай вслух и перепиши своими словами то, что звучит не как ты.
   ===================================================================== */
(function () {
  const { esc, wait, show, say, choose, ask, toast, suspicion, sparkleAt, confetti, haptic, sfx } = G;
  const S = () => G.state();
  const C = G.C;
  const NB = ' ';
  const DARK = '#2F2834', LIGHT = '#FFF4EC';

  /* ---------- Утилиты ---------- */
  // героиня в выбранном образе (look — новый рисунок; bow/coat/hair — запасная перекраска тренча)
  const heroArt = (o = {}) => Art.heroine(Object.assign({ look: G.look(), bow: S().bow, coat: S().coat, hair: S().hair }, o));
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const RU_DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  // «суббота, 21 ноября»; noDay — без дня недели («21 ноября»)
  function ruDate(iso, noDay) {
    const [y, m, d] = String(iso || '').split('-').map(Number); const dt = new Date(y, m - 1, d);
    if (!d || isNaN(dt.getTime())) return '';
    return noDay ? `${d} ${RU_MONTHS[m - 1]}` : `${RU_DAYS[dt.getDay()]}, ${d} ${RU_MONTHS[m - 1]}`;
  }
  // когда выйдет серия: «в декабре» (пока дата не объявлена) → дата (у финала без дня недели) → «совсем скоро»
  const isFinale = epObj => !!epObj && epObj.n === C.EPISODES[C.EPISODES.length - 1].n;
  const whenText = epObj => {
    if (!epObj) return '';
    if (epObj.when) return epObj.when;
    if (G.isReleased(epObj) && !epObj.built) return 'совсем скоро';
    return ruDate(epObj.release, isFinale(epObj)) || 'совсем скоро';
  };
  const RIDDLE = 'Что можно заварить, но нельзя выпить?';
  // память внутри сессии: можно выйти из здания и вернуться, улики не теряются
  const mem = { seen: {}, cinema: null, bureau: null };
  const resetMem = () => { mem.seen = {}; mem.cinema = null; mem.bureau = null; };

  function hintKit(scr, { hint, task, onSkip, dark }) {
    const st = S();
    const bar = scr.querySelector('.puzzle-bar');
    bar.innerHTML = `
      <div class="hint-col"><button class="paw-hint" aria-label="Подсказка">🐾</button><div class="paw-cap">подсказка</div></div>
      <div class="mid"><div class="counter-dots ${dark ? 'dark' : ''}"></div><div class="task">${esc(task)}</div></div>
      <button class="skip ${dark ? 'dark' : ''}">пропустить</button>`;
    const paw = bar.querySelector('.paw-hint'), skip = bar.querySelector('.skip');
    let misses = 0, busy = false, off = false;
    const giveHint = async () => {
      if (busy || off) return; busy = true;
      paw.classList.remove('pulse');
      await say({ who: 'cat', text: hint });
      busy = false;
    };
    paw.addEventListener('click', () => { if (off) return; haptic('light'); giveHint(); });
    skip.addEventListener('click', async () => {
      if (off || busy) return;
      haptic('light'); busy = true;
      const v = await choose('Пропустим? Это игра, а не экзамен.', [
        { label: 'Пропустить', value: true }, { label: 'Нет, я разберусь', value: false }]);
      busy = false;
      if (v && !off) onSkip();
    });
    return {
      dots: bar.querySelector('.counter-dots'),
      off() { off = true; bar.style.pointerEvents = 'none'; bar.style.opacity = '.45'; },
      async miss() {
        misses++;
        if (misses === 2) {
          if (st.catHelper) await giveHint();
          else paw.classList.add('pulse');
        }
      },
    };
  }
  function dots(el, n, total) { el.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); }

  /* ---------- ТИТУЛ ---------- */
  function title() {
    return new Promise(res => {
      G.setHud({ hidden: true }); G.tgHeader(LIGHT);
      const scr = show(`
        <div class="grow col center pad title-screen film-grain" style="gap:10px;position:relative">
          <button class="hud-btn" id="snd" style="position:absolute;top:calc(12px + var(--safe-top));right:12px" aria-label="Звук">${G.soundIcon()}</button>
          <div class="case-badge">Сезон&nbsp;1 · Серия&nbsp;1</div>
          <div class="title h1" style="margin-top:8px">Дело №${NB}10/10</div>
          <div class="title h3 cherry">Главная роль занята. Тобой.</div>
          <div style="position:relative;width:230px;margin:0 auto">
            <div class="char title-hero bob">${heroArt({ magnifier: true })}</div>
            <div class="char title-cat" style="right:-4px;bottom:2px">${Art.cat()}</div>
          </div>
          <p class="small muted" style="font-weight:800;margin-top:2px">Небольшой детектив. Большая вероятность встретить говорящего${NB}кота.<br/>Нажимай на экран, чтобы продолжать. Звук можно включить справа.</p>
          <button class="btn" id="go" style="margin-top:8px;min-width:240px">Ну что, начнём?</button>
          <button class="link" id="recap">Очень спешу — перескажите</button>
          <p class="tiny muted" style="margin-top:2px;font-weight:700">Снято без участия здравого смысла. Кот отказался от${NB}комментариев.</p>
        </div>`, '');
      const cat = scr.querySelector('.title-cat');
      let pets = 0;
      cat.addEventListener('click', () => { pets++; haptic('light'); cat.classList.remove('hop'); void cat.offsetWidth; cat.classList.add('hop'); sparkleAt(cat, { kind: 'heart', n: 6, dist: 40 }); if (pets === 5) toast('Кот просит перестать его гладить. Через секунду передумал.'); });
      scr.querySelector('#snd').addEventListener('click', e => G.toggleSound(e.currentTarget));
      scr.querySelector('#go').addEventListener('click', () => { haptic('medium'); sfx('ok'); res('play'); });
      scr.querySelector('#recap').addEventListener('click', () => { haptic('light'); res('recap'); });
    });
  }

  /* ---------- ПРОЛОГ ---------- */
  async function cards(list) {
    G.setHud({ hidden: true }); G.tgHeader(DARK);
    const scr = show(`<div class="grow col center prologue film-grain" style="position:relative"><div class="dots"></div><div class="pcard"></div><div class="tap-hint">тап — дальше</div></div>`);
    const box = scr.querySelector('.pcard'), dt = scr.querySelector('.dots'), root = scr.firstElementChild;
    for (let i = 0; i < list.length; i++) {
      dt.innerHTML = list.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
      box.innerHTML = list[i];
      if (i === 3 && list.length === 5) sfx('drum');
      await wait(350);
      await G.tapOnce(root);
    }
    G.tgHeader(LIGHT);
  }
  const prologue = () => cards([
    'Октябрь.<br/>Солнце вышло из чата.',
    'Синоптики сказали: «Ну, бывает».<br/>Горожане потребовали другого синоптика.',
    'Завели дело № 10/10.<br/>Пока это единственное, что здесь на десять из десяти.',
    'Тогда позвали ту, кто вычисляет злодея раньше, чем герои успевают представиться.',
    'Совпадения случайны.<br/>Образ — нет.',
  ]);

  /* ---------- КАСТИНГ ---------- */
  // образ — один из шести роликов (js/looks_picker.js: карусель -> имя следователя), затем команда
  async function casting() {
    const st = S();
    if (window.Looks && window.HeroLooks) await Looks.casting();
    else if (!st.name) { st.name = G.tgUserFirstName() || C.HER_NAME_DEFAULT || ''; G.save(); }
    await teamScreen();
  }
  // пересказ: образа ещё нет — карусель и имя, без команды
  async function castingLook() {
    if (window.Looks && window.HeroLooks && !HeroLooks.valid(S().look)) await Looks.casting({ recap: true });
  }
  function teamScreen() {
    return new Promise(res => {
      const st = S();
      const row = k => `
        <div class="team-row">
          <div class="ava">${G.team[k].art({ crop: true })}</div>
          <div class="grow">
            <div class="role">${esc(G.team[k].role)}</div>
            <input data-k="${k}" maxlength="16" placeholder="${esc(G.team[k].def)}" value="${esc(st.team[k] || '')}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done"/>
          </div>
        </div>`;
      const scr = show(`
        <div class="grow casting pad" style="padding-bottom:calc(16px + var(--safe-bottom))">
          <div style="text-align:center"><div class="case-badge">Кастинг</div></div>
          <div class="title h2" style="text-align:center;margin:10px 0 6px">Команда следствия</div>
          <p class="muted" style="text-align:center;font-weight:700;margin-bottom:16px">Можешь дать этим троим имена своих подруг. Или оставить как есть: зверята уже прошли собеседование. Кое-как.</p>
          <div class="col">${row('bunny')}${row('fox')}${row('hedgehog')}</div>
          <p class="tiny muted" style="text-align:center;font-weight:700;margin-top:12px">Имена останутся в игре и титрах. Сценарист их не увидит.</p>
          <button class="btn block sticky-cta" id="next" style="margin-top:14px">Берём этих</button>
        </div>`);
      scr.querySelectorAll('input[data-k]').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); }));
      scr.querySelector('#next').addEventListener('click', () => {
        scr.querySelectorAll('input[data-k]').forEach(i => { st.team[i.dataset.k] = i.value.trim(); });
        G.save(); haptic('medium'); sfx('ok'); res();
      });
    });
  }

  /* ---------- УЛИЦА ---------- */
  // порядок домов серии — из таблицы дел (js/world/missions.js): цель улицы у каждой миссии с дверью
  const M = () => window.Missions || null;
  const ORDER = (() => {
    const fromTable = window.Missions ? Missions.list(1).filter(m => m.door && m.street && m.street.target).map(m => m.street.target) : [];
    return fromTable.length === 4 ? fromTable : ['cinema', 'bureau', 'sweets', 'roof'];
  })();
  const label = target => `Серия\u00A01 · ${ORDER.indexOf(target) + 1}/4`;
  const HEADLINE_PAIRS = [
    ['«Октябрьский вестник»: Солнце пропало. Виновные будут найдены. Или хотя бы согреты.', '«Октябрьский вестник»: Синоптики отключили телефоны и уехали в отпуск. Там тоже пасмурно.'],
    ['«Октябрьский вестник»: Кинотеатр спасён. Билеты снова продают, гуся — нет.', '«Октябрьский вестник»: Гуся выгнали за спойлеры. Он попытался заспойлерить собственное изгнание.'],
    ['«Октябрьский вестник»: Попугай дал интервью на трёх языках. Ни на одном не понял вопрос.', '«Октябрьский вестник»: В архиве раскрыли дело об одном носке. Второй отказался сотрудничать.'],
    ['«Октябрьский вестник»: Бабл-ти соврал. На допросе расплакался жемчужинками.', '«Октябрьский вестник»: Булочка просит защиту свидетелей. Особенно от голодных.'],
  ];
  const WEATHER_LINES = [
    'ПРОГНОЗ: солнце не явилось на работу. Проводится проверка.',
    'РАССВЕТ: обещал прийти. Телефон недоступен.',
    'ВЕТЕР: лёгкий. ЗЕФИР: закончился. Это разные новости.',
    'РОЗЫСК: солнце. Круглое, яркое. Последний раз видели на небе.',
    'ПОГОДА: надень свитер. ГОЛУБИ: надели второй пух.',
    'ОБЛАКА: заявили, что просто проходили мимо.',
  ];
  const HEADLINES = [
    '«Октябрьский вестник»: Солнце пропало. Виновные будут найдены. Или хотя бы согреты.',
    '«Октябрьский вестник»: Кинотеатр спасён. Билеты снова продают, гуся — нет.',
    '«Октябрьский вестник»: Попугай дал интервью на трёх языках. Ни на одном не понял вопрос.',
    '«Октябрьский вестник»: Бабл-ти соврал. На допросе расплакался жемчужинками.',
  ];
  const SKIES = [
    'linear-gradient(180deg,#A6AFBC 0%,#C9D0D9 100%)',
    'linear-gradient(180deg,#AEB6C8 0%,#D6D6E0 100%)',
    'linear-gradient(180deg,#B6B6D0 0%,#E4D8E0 100%)',
    'linear-gradient(180deg,#BDB2D2 0%,#F2DAE0 100%)',
  ];
  function buildingWidth() {
    const W = G.app.clientWidth, H = G.app.clientHeight;
    const maxByH = (H * .85 - 8 - 170) * 300 / 404;
    return Math.max(200, Math.min(W * .8, 330, maxByH));
  }
  function layoutStreet() {
    const W = G.app.clientWidth, H = G.app.clientHeight;
    const bw = buildingWidth(), bh = bw * 364 / 300, rh = bw * 404 / 300;
    const L = { W, H, bw, bh, rh };
    L.cart = 36;
    L.cinema = L.cart + 170;
    L.weather = L.cinema + bw + 18;
    L.bureau = L.weather + 110;
    L.kiosk = L.bureau + bw + 18;
    L.silver = L.kiosk + 140;
    L.sweets = L.silver + 166;
    L.lamp = L.sweets + bw + 26;
    L.roof = L.lamp + 70;
    L.worldW = L.roof + bw + 60;
    L.door = k => L[k] + bw / 2;
    return L;
  }
  const BNAME = { cinema: 'кинотеатр', bureau: 'бюро переводов', sweets: 'кондитерскую', roof: 'лестницу на крышу' };
  const ARROW = { cinema: 'в кинотеатр', bureau: 'в бюро', sweets: 'в кондитерскую', roof: 'к лестнице' };
  const blocked = () => !!document.querySelector('#layer .dlg-wrap, #layer .modal, .img-full');
  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return true; } };

  /* ---------- Находки на улице (Карманы следователя) ---------- */
  const TULIP_BUNCH = ['tulip', 'chamomile', 'tulip'];
  // stage — на какой прогулке появляется (0 до кинотеатра … 3 до крыши); x, z — место на 3D-улице
  const FINDS = [
    { id: 'ticket13', kind: 'ticket13', stage: 0, x: -1.0, z: 1.4, title: 'Билет: ряд 3, место 13', art: () => Art.findTicket(),
      line: 'Билет: ряд 3, место 13. Места 13 в этом кинотеатре нет. А на обороте — отпечаток лапы. Перепончатой.',
      cap: 'Билет в третий ряд, место 13. Места не существует, отпечаток лапы — существует. Владелец, по всей видимости, знает, чем всё закончится.' },
    { id: 'pigeonUmbrella', kind: 'pigeonUmbrella', stage: 0, x: -3.0, z: 2.3, title: 'Зонтик для голубя', art: () => Art.findUmbrella(),
      line: 'Зонтик. Размер — для голубя. Голубь вежливо отказался: крыльями зонтик не удержать.',
      cap: 'Коктейльный зонтик. От дождя не спасает, от плохого настроения — вполне. Изъят как вещдок хорошего вкуса.' },
    { id: 'tulipBunch', kind: 'tulipBunch', stage: 1, x: 4.4, z: -0.75, title: 'Букетик тюльпанов', art: () => Art.bouquet({ f: TULIP_BUNCH, paper: '#E8D3B6', ribbon: '#F08FA8' }, { shadow: false }),
      cap: 'Букетик тюльпанов с ромашкой. Бирка: «Следователю. От жителей улицы». Тюльпаны и в вазе продолжают расти и тянутся к свету. Солнца нет — тянутся к фонарям.' },
    { id: 'catSweater', kind: 'catSweater', stage: 1, x: 3.7, z: -0.7, title: 'Свитер размера «кот»', art: () => Art.findSweater(),
      cap: 'Свитер с вязаным солнышком. Погода официально свитерная. Пока настоящего солнца нет — это запасное.' },
    { id: 'watch13', kind: 'watch13', stage: 2, x: 11.4, z: -0.85, title: 'Карманные часы на 13:00', art: () => Art.findWatch(),
      line: 'Карманные часы. Стоят ровно на 13:00. Похоже, сбежали из того кадра в кинотеатре.',
      cap: 'Карманные часы с цифрой 13. Пусть идут как хотят: тринадцать — тоже время, просто редкое.' },
    { id: 'featherFinal', kind: 'featherFinal', stage: 2, x: 8.7, z: 2.1, title: 'Перо Финалыча', art: () => Art.findFeather(),
      line: 'Перо. Белое, гусиное. Финалыч был здесь и, судя по перу, всё ещё возмущается.',
      cap: 'Перо Финалыча. Выпало от возмущения. Пишет само — в основном спойлеры.' },
    { id: 'blueSaucer', kind: 'blueSaucer', stage: 3, x: 21.6, z: -0.7, title: 'Блюдце в горошек', art: () => Art.findSaucer(),
      line: 'Блюдце. Тёплое. А чашки нет. Кто-то пил чай и очень спешил. Или очень не спешил — это ещё подозрительнее.',
      cap: 'Блюдце в розовый горошек. Пахнет бергамотом и чужими планами. Пометка карандашом: «Чашку найти. Вежливо».' },
    { id: 'paperStar', kind: 'paperStar', stage: 3, x: 20.7, z: -0.75, title: 'Звёздочка из фольги', art: () => Art.findStar(),
      line: 'Звёздочка из блестящей фольги. Пока солнце в розыске, звёзды выходят на дежурство пораньше. По одной.',
      cap: 'Звёздочка из конфетной фольги. Конфету, по данным следствия, съел кот. Кот: «Не съел, а продегустировал».' },
  ];
  G.registerFinds(FINDS.map(f => ({ id: f.id, title: f.title, art: f.art, cap: f.cap })));
  const STREET_LINES = {
    lampList: [
      'Закружилась вокруг фонаря. Где-то должен был заиграть оркестр. Не заиграл.',
      'Фонарь молчит. Очень удобный собеседник.',
      'Голова кругом. Красиво, конечно, но хватит.',
      'Небо покраснело. Потом вспомнило, что оно сиреневое.',
    ],
    puddle: 'Плюх. Дело о мокром ботинке открыто.',
    petrichor: 'Запах дождя называется «петрикор». Звучит как герой мифа, который забыл зонтик.',
    puddleSun: [
      'В луже есть солнце. На небе — нет. Лужа, у нас вопросы.',
      'Прыгнула. Мокрая? Да. Жалеешь? Ни секунды.',
      'Дождь давно закончился, а лужа всё на месте. Постоянство ей к лицу.',
    ],
    catTooMuch: 'Кот просит перестать его гладить. Через секунду передумал.',
    catPets: ['Мурчит. Видимо, всё расследование он и планировал.', 'Поглажено: 1. По версии кота: 14. Кот ведёт свой учёт.', 'Кот считает: ты только начала его гладить.'],
    poodle: [
      'ПУДЕЛЬ В БАНТЕ. Всё, на пять секунд детектив отменяется.',
      'Ошейник: «Пудра. Не потерялась. Просто занята».',
      'Гусёнок зовёт пуделя мамой. Пудель не готов к разговору.',
      'Племянник Финалыча. Пока умеет говорить только «пи». Город надеется, что на этом всё.',
      'Погладила Пудру дважды. Она выставила счёт ещё на три.',
    ],
    sunflower: [
      'Подсолнух потерял солнце. Теперь разворачивается на каждый фонарь.',
      'Helianthus — «солнечный цветок». Очень личное для этого подсолнуха расследование.',
      'Подсолнух смотрит на крышу. Впервые за день у нас свидетель с конкретным адресом.',
    ],
  };
  const stageFinds = idx => FINDS.filter(f => f.stage <= idx && !(S().finds || []).includes(f.id));
  async function pickFind(id, api) {
    const st = S(), f = FINDS.find(x => x.id === id); if (!f) return;
    const r = G.giveFind(id);
    if (id === 'tulipBunch') {
      if (!st.bouquet) {
        st.bouquet = { f: TULIP_BUNCH.slice(), paper: '#E8D3B6', ribbon: st.bow }; G.save(); G.giveFind('bouquet');
        if (api) { api.setHeld('bouquet', st.bouquet); api.celebrate(); }
        await say({ who: 'hero', text: 'Тюльпаны от жителей. Улица, это взятка? Принято — в интересах следствия.' });
      } else {
        st.bouquet.f = st.bouquet.f.concat(['tulip', 'tulip']).slice(0, 11); G.save();
        if (api) { api.setHeld('bouquet', st.bouquet); api.celebrate(); }
        await say({ who: 'hero', text: 'Ещё два тюльпана — в общий букет. Следствие цветёт.' });
      }
    } else if (id === 'catSweater') {
      st.catSweater = true; G.save();
      if (st.catHelper) {
        if (api && api.catSweater) api.catSweater();
        await say([{ who: 'hero', text: 'Свитер размера «кот». Пирожок, стой смирно. Да, тебе идёт. Нет, сниматься для журнала не будем.' }, { who: 'cat', text: 'Жмёт на самолюбие. Остальное идеально.' }]);
      } else await say({ who: 'hero', text: 'Свитер коту. Пусть потом не говорит, что о нём не заботятся.' });
    } else toast(f.line, 3600);
    if (r.isNew && r.got === r.total && !st.stickers.includes('pockets')) {
      await wait(400);
      if (api && api.spin) api.spin(); if (api) api.celebrate(); confetti();
      await say([{ text: 'В карманах больше сокровищ, чем у некоторых музеев.' },
        st.catHelper ? { who: 'cat', text: 'Ты собрала всю улицу. Вопросов нет. Только восхищение.' } : { text: 'Улица опустела. Самые красивые мелочи — теперь у тебя.' }]);
      await G.giveSticker('pockets', 'Выдаётся тем, кто замечает мелочи. То есть следователям.');
    }
  }


  /* ---------- БУКЕТ: цветочная тележка пчёлки Жу ---------- */
  const PAPERS = [['#E8D3B6', 'крафт'], ['#F6C6D0', 'пудровая'], ['#FFF6EC', 'молочная'], ['#DCCFF2', 'лавандовая']];
  const ribbons = () => [[S().bow, 'в тон образу'], ['#FFFDF9', 'белая'], ['#B0304A', 'вишнёвая'], ['#9DBFA8', 'шалфей']];
  const MAX_STEMS = 9, MIN_STEMS = 3;
  const flName = id => (Art.FLOWERS.find(f => f.id === id) || {}).name || '';
  const stemsWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'веточка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'веточки' : 'веточек');
  G.registerFinds([{
    id: 'bouquet', title: 'Букет следователя', art: () => Art.bouquet(S().bouquet || {}),
    cap: () => { const b = S().bouquet; if (!b) return 'Букет следователя.'; const names = [...new Set(b.f.map(flName))].join(', ').toLowerCase(); return `Ты сама выбрала: ${names}. Пахнет замечательно.`; },
  }]);
  function bouquetBuilder() {
    return new Promise(res => {
      const st = S();
      const b = st.bouquet ? { f: st.bouquet.f.slice(), paper: st.bouquet.paper, ribbon: st.bouquet.ribbon } : { f: [], paper: PAPERS[0][0], ribbon: st.bow };
      const sw = (arr, key) => arr.map(([v, l]) => `<button class="chip sw ${b[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}"><i style="background:${v}"></i>${l}</button>`).join('');
      const m = document.createElement('div'); m.className = 'modal bq-modal';
      m.innerHTML = `
        <div class="modal-card bq-card">
          <div class="row" style="justify-content:space-between;align-items:center"><div class="title h2">Собери букет</div><button class="hud-btn" data-x aria-label="Закрыть">✕</button></div>
          <div class="bq-preview" id="bqp"></div>
          <div class="bq-count" id="bqc"></div>
          <div class="bq-flowers">${Art.FLOWERS.map(f => `<button class="bq-fl" data-f="${f.id}">${Art.flowerIcon(f.id)}<span>${esc(f.name)}</span><i class="n"></i></button>`).join('')}</div>
          <div class="opt-label">Обёртка</div><div class="opts">${sw(PAPERS, 'paper')}</div>
          <div class="opt-label">Лента</div><div class="opts">${sw(ribbons(), 'ribbon')}</div>
          <div class="row" style="gap:10px;margin-top:16px"><button class="btn soft" id="undo">↶ Убрать</button><button class="btn grow" id="ok">Букет готов</button></div>
        </div>`;
      G.layer.appendChild(m);
      const prev = m.querySelector('#bqp'), cnt = m.querySelector('#bqc');
      const draw = pop => {
        prev.innerHTML = b.f.length ? Art.bouquet(b) : `<div class="bq-empty">Выбирай цветы<br/>по одному</div>`;
        if (pop) { prev.classList.remove('hop'); void prev.offsetWidth; prev.classList.add('hop'); }
        const n = b.f.length;
        cnt.textContent = n ? `${n} ${stemsWord(n)} из ${MAX_STEMS}${n < MIN_STEMS ? ` · добавь ещё ${MIN_STEMS - n}` : ''}` : `от ${MIN_STEMS} до ${MAX_STEMS} веточек`;
        m.querySelectorAll('.bq-fl').forEach(el => { const k = b.f.filter(x => x === el.dataset.f).length; el.querySelector('.n').textContent = k ? k : ''; el.classList.toggle('on', k > 0); });
      };
      draw(false);
      let closed = false;
      const close = v => { if (closed) return; closed = true; m.classList.add('out'); setTimeout(() => { m.remove(); res(v); }, 250); };
      m.querySelectorAll('.bq-fl').forEach(el => el.addEventListener('click', () => {
        if (b.f.length >= MAX_STEMS) { haptic('error'); toast('Букет полон. Вторая рука нужна для расследования.', 2200); return; }
        haptic('select'); sfx('tap'); b.f.push(el.dataset.f); draw(true); sparkleAt(el, { kind: 'heart', n: 4, dist: 26 });
      }));
      m.querySelectorAll('.chip.sw').forEach(el => el.addEventListener('click', () => {
        haptic('select'); b[el.dataset.k] = el.dataset.v;
        m.querySelectorAll(`.chip.sw[data-k="${el.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === el)); draw(true);
      }));
      m.querySelector('#undo').addEventListener('click', () => { if (!b.f.length) return; haptic('light'); b.f.pop(); draw(true); });
      m.querySelector('[data-x]').addEventListener('click', () => { haptic('light'); close(null); });
      m.querySelector('#ok').addEventListener('click', () => {
        if (b.f.length < MIN_STEMS) { haptic('error'); toast('Ещё немного: для букета нужно хотя бы три веточки.', 2200); return; }
        haptic('medium'); sfx('ok'); close(b);
      });
    });
  }
  function bouquetReveal(b) {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card">
          <div class="tiny muted" style="font-weight:900;letter-spacing:.12em;text-transform:uppercase">Ура, цветы!</div>
          <div class="bq-big float">${Art.bouquet(b)}</div>
          <div class="title h3">Букет следователя</div>
          <p class="muted" style="margin-top:6px;font-weight:700">${b.f.length} ${stemsWord(b.f.length)}. Теперь он с тобой до конца серии.</p>
          <button class="btn block" style="margin-top:14px">Взять букет</button>
        </div>`;
      G.layer.appendChild(m);
      haptic('success'); sfx('sticker'); confetti();
      setTimeout(() => sparkleAt(m.querySelector('.bq-big'), { kind: 'heart', n: 16, dist: 100 }), 250);
      let closed = false;
      m.querySelector('.btn').addEventListener('click', () => { if (closed) return; closed = true; haptic('light'); m.classList.add('out'); setTimeout(() => { m.remove(); res(); }, 250); });
    });
  }
  function beeLine(b) {
    const f = b.f, has = id => f.includes(id), round = f.filter(id => !['hyacinth', 'lavender', 'eucalyptus', 'pampas'].includes(id));
    if (has('hyacinth')) return 'Гиацинт! Пахнет весной, даже в октябре.';
    if (f.length >= MAX_STEMS) return 'Девять веточек! Ты собирала букет или маленький ботанический сад?';
    if (!round.length) return 'Минимализм! Даже цветы у тебя знают меру.';
    if (has('peony') && has('ranunculus')) return 'Пышная парочка. Букет явно пришёл на премьеру.';
    if (has('pampas')) return 'Пампасная трава — осень в одном стебле. Очень красиво, очень непрактично. Люблю.';
    return 'Бери. Мне приятно, когда красивые букеты уходят к хорошим людям.';
  }
  const bouquetFlow = api => flowerCart(api, { direct: true });
  async function flowerCart(api, fo = {}) {
    const st = S(), first = !st.metBee;
    if (first) {
      st.metBee = true; G.save();
      await say({ who: 'bee', text: 'Ой, следователь! Я Жу. Цветы выбирай любые. День такой, что без букета нельзя.' });
    }
    const v = fo.direct ? true : await choose(st.bouquet ? 'Пересобрать букет?' : 'Собрать букет?', [
      { label: st.bouquet ? 'Пересобрать' : 'Собрать букет', value: true }, { label: 'Потом', value: false }], { who: 'bee' });
    if (!v) { if (first) await say({ who: 'bee', text: 'Заходи, когда захочешь. Я отсюда никуда: рабочее место, нектар, всё как у людей.' }); return; }
    const b = await bouquetBuilder();
    if (!b) return;
    const had = !!st.bouquet;
    st.bouquet = b; G.save(); G.giveFind('bouquet');
    if (!had) await intertitle('СЛЕДОВАТЕЛЬ ПОЛУЧИЛА БУКЕТ. БЕЗ ПОВЕСТКИ.');
    await bouquetReveal(b);
    if (api) { api.setHeld('bouquet', b); api.celebrate(); }
    await say([
      { who: 'hero', text: had ? 'Пересобрала. Нет предела совершенству, особенно цветочному.' : 'Так. Теперь я ещё и с цветами. Прекрасный рабочий день.' },
      { who: 'bee', text: beeLine(b) },
    ]);
    if (!had && st.catHelper) await say({ who: 'cat', text: b.f.includes('chamomile') ? 'Ромашка? Ничего не скажу. Я сегодня культурный.' : 'А мне бантик? Нет? Ладно, буду просто красивым.' });
  }

  // Улица: 3D-город, если устройство тянет WebGL, иначе 2D-прогулка.
  const FOGS = ['#C9D0D9', '#D6D6E0', '#E4D8E0', '#F2DAE0'];
  // карточка «Сегодняшнее дело» поверх улицы-запаса и 2D-улицы (в городе карточку рисует сам город)
  function caseCardOn(target, card, host) {
    const m = M();
    if (!m || !card) return null;
    return m.mountCard(card, { host, onTap: () => toast(`Нам ${ARROW[target]}. Иди к светящейся метке.`, 2400) });
  }
  function streetTo(target, opts = {}) {
    if (!window.City3D || !City3D.supported || S().force2d || (M() && M().engine() === '2d')) return streetTo2D(target, opts);
    return new Promise(res => {
      const st = S(), idx = ORDER.indexOf(target);
      const o = {
        target, idx, again: !!opts.again,
        justLit: idx > 0 && !opts.again ? ORDER[idx - 1] : null,
        isLit: k => ORDER.indexOf(k) < idx,
        hero: { look: G.look(), bow: st.bow, coat: st.coat, hair: st.hair, cup: st.drink && idx >= 3 ? st.drink : null },
        catHelper: !!st.catHelper && !opts.intro,
        hudLabel: label(target), sky: SKIES[Math.min(idx, 3)], fogColor: FOGS[Math.min(idx, 3)], leafColor: idx > 1 ? '#8FB88A' : '#A6B3A2',
        rain: idx === 0,
        arrowText: ARROW[target], nameText: BNAME[target],
        headline: HEADLINES[Math.min(idx, 3)],
        weatherText: idx >= 3 ? 'Прогноз: прояснение откладывается до серии\u00A02.' : 'Прогноз: пасмурно, местами подозрительно. К вечеру прояснение.',
        heroLine: st.drink && idx >= 3 ? 'Сначала глоток. Потом подвиги.' : 'Проверка образа. Всё прекрасно. Можно спасать мир.',
        secretAvailable: !!C.ENABLE_SECRET_STICKER && !st.stickers.includes('secret'),
        held: st.bouquet ? { kind: 'bouquet', data: st.bouquet } : null,
        spots: [{ id: 'flowers', x: -3.2, z: -0.3, act: 'Букет', bubble: 'собрать букет', bubble2: 'пересобрать букет', auto: !st.metBee && !opts.intro }],
        onSpot: (id, api) => (id === 'flowers' ? flowerCart(api) : null),
        pickups: stageFinds(idx).map(f => ({ id: f.id, kind: f.kind, x: f.x, z: f.z, held: !!f.held })),
        onPickup: (id, api) => pickFind(id, api),
        catSweater: !!st.catSweater && !!st.catHelper,
        headlines: HEADLINE_PAIRS[Math.min(idx, 3)],
        weatherLines: idx >= 3 ? ['ПРОГНОЗ: без солнца. Но есть надежда и ближайшая кондитерская.'].concat(WEATHER_LINES.slice(1)) : WEATHER_LINES,
        lines: STREET_LINES,
        onSecret: () => G.giveSticker('secret', 'Значение знают только посвящённые.'),
        showHint: !st.walked3d || !!opts.intro,
        beforeActive: async api => {
          if (opts.intro) await streetIntro3D(api);
          if (target === 'roof' && !mem.seen.hedgehog) { mem.seen.hedgehog = true; await hedgehogCameo(); }
          if (opts.again) toast('Ты на улице. Всё найденное сохранено — продолжишь, когда захочешь.', 2600);
          st.walked3d = true; G.save();
        },
        done: res,
        fallback: () => { st.force2d = true; streetTo2D(target, opts).then(res); },
      };
      const m = M();
      if (!m) { City3D.run(o); return; }
      // город: метка на двери дела, карточка, боковые двери, подсказка кота (WorldHub читает o.world, улица — нет)
      o.world = m.worldExtras({ mode: 'story', target, idx, again: !!opts.again, justLit: o.justLit });
      if (m.debug) m.debug.last = o.world;
      let card = null;
      const drop = () => { if (card) { card.remove(); card = null; } };
      const ba = o.beforeActive;
      o.beforeActive = async api => { drop(); if (!m.inWorld(api)) card = caseCardOn(target, o.world.hud); return ba(api); };
      o.done = v => { drop(); res(v); };
      const fb = o.fallback;
      o.fallback = () => { drop(); fb(); };
      m.runStreet(o);
    });
  }
  async function streetIntro3D(api) {
    const st = S();
    st.catHelper = null;
    await say({ who: 'cat', text: 'Мяу. Перевожу: я Пирожок, местный информатор. Работаю за еду. Уважение можешь оставить себе.' });
    const v = await choose('Пойдём вместе? Я иногда полезный.', [
      { label: 'Идём, хвостатый', value: true }, { label: 'Я сама', value: false }], { who: 'cat' });
    st.catHelper = v; G.save();
    if (v) { api.spawnCat(); await say({ who: 'cat', text: 'Отлично. Всё равно я уже пошёл за тобой.' }); }
    else await say({ who: 'cat', text: 'Договорились. Если передумаешь — жми на лапку. Я буду очень занят сном.' });
    await say({ who: 'cat', text: 'Солнце исчезло утром. Последний раз его видели над кинотеатром. Пойдём туда — ищи светящуюся метку.' });
    if (!st.bouquet) await say({ who: 'cat', text: M() && M().inWorld(api) ? 'Впереди цветочный бутик — это Жу. Она всем дарит букеты. Мне однажды подарила кактус. Намёк понял.' : 'Слева цветы. Жу всем дарит букеты. Мне однажды подарила кактус. Намёк понял.' });
  }

  // 2D-прогулка (запасной вариант): стрелки/AD, кнопки ◀ ▶ и тап по тротуару.
  function streetTo2D(target, opts = {}) {
    return new Promise(async res => {
      const st = S();
      const idx = ORDER.indexOf(target);
      const L = layoutStreet();
      const lit = k => ORDER.indexOf(k) < idx;
      const justLit = idx > 0 && !opts.again ? ORDER[idx - 1] : null;
      const bld = (k, art, h) => `<div class="bld ${lit(k) && k !== justLit ? 'lit' : ''}" data-b="${k}" style="left:${L[k]}px;width:${L.bw}px;height:${h}px">${art}</div>`;
      let rain = '';
      if (idx === 0) for (let i = 0; i < 26; i++) rain += `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .9}s;animation-duration:${.7 + Math.random() * .5}s"></i>`;
      // голуби: один поджимает лапку
      const pigeons = [L.weather + 40, L.kiosk + 160, L.lamp - 40, L.bureau + L.bw * .2].map((x, i) => ({ x, oneLeg: i === 1, flown: false }));
      const HW = 80;
      const to2d = x3 => { // координата 3D-улицы → пиксели 2D-улицы
        const A = [[-4, 30], [0, L.door('cinema')], [3.1, L.weather + 48], [6.2, L.door('bureau')], [9.6, L.kiosk + 58], [11.9, L.silver + 70], [16.2, L.door('sweets')], [22.6, L.door('roof')], [26.5, L.worldW - 30]];
        for (let i = 1; i < A.length; i++) if (x3 <= A[i][0]) { const [a0, b0] = A[i - 1], [a1, b1] = A[i]; return b0 + (b1 - b0) * (x3 - a0) / (a1 - a0); }
        return L.worldW - 30;
      };
      const picks2d = stageFinds(idx).map(f => Object.assign({}, f, { x2: Math.round(to2d(f.x)) }));
      const scr = show(`
        <div class="sky" style="background:${SKIES[Math.min(idx, 3)]}"></div>
        <div class="sun-slot" style="right:22px;top:calc(86px + var(--safe-top))">здесь<br/>было<br/>солнце</div>
        <div class="cloud" style="left:12%;top:calc(120px + var(--safe-top));width:110px">${Art.cloud()}</div>
        <div class="cloud" style="left:58%;top:calc(170px + var(--safe-top));width:80px;animation-duration:40s">${Art.cloud()}</div>
        <div class="far" id="far" style="width:${Math.round(L.W * 2.4)}px;bottom:calc(15% + ${Math.round(L.bh * .72)}px)">${Art.mountains()}</div>
        ${idx === 0 ? `<div class="rain" style="position:absolute;inset:0;pointer-events:none">${rain}</div>` : ''}
        <div class="world free" style="width:${L.worldW}px">
          <div class="ground"></div><div class="curb"></div>
          <div class="prop" style="left:12px;width:28px">${Art.lamp()}</div>
          <div class="prop" data-p="cart" style="left:${L.cart}px;width:132px;cursor:pointer">${Art.flowerCart()}<div class="cart-bee float">${Art.bee()}</div></div>
          ${bld('cinema', Art.cinemaB(), L.bh)}
          <div class="prop ${idx > 2 ? '' : 'grey'}" data-p="weather" style="left:${L.weather}px;width:96px;cursor:pointer">${Art.weatherBoard()}</div>
          ${bld('bureau', Art.bureauB(), L.bh)}
          <div class="prop ${idx > 1 ? '' : 'grey'}" data-p="kiosk" style="left:${L.kiosk}px;width:116px;cursor:pointer">${Art.kiosk()}
            ${C.ENABLE_SECRET_STICKER && !st.stickers.includes('secret') ? `<div data-p="secret" style="position:absolute;right:2px;top:32px;width:40px;height:40px;display:grid;place-items:center;cursor:pointer"><svg viewBox="0 0 20 20" width="13" height="13"><path d="M10,18 C2,12 1,6 5,3.6 C7.4,2.2 9.2,3.6 10,5.2 C10.8,3.6 12.6,2.2 15,3.6 C19,6 18,12 10,18 Z" fill="#A98BE8"/></svg></div>` : ''}
          </div>
          <div class="prop ${idx > 2 ? '' : 'grey'}" data-p="silver" style="left:${L.silver}px;width:140px;cursor:pointer">${Art.silverShop()}</div>
          ${bld('sweets', Art.sweetsB(), L.bh)}
          <div class="prop" style="left:${L.lamp}px;width:28px">${Art.lamp()}</div>
          ${bld('roof', Art.roofB({ broken: true, note: true }), L.rh)}
          ${pigeons.map((p, i) => `<div class="pigeon" data-pg="${i}" style="left:${p.x}px">${Art.pigeon({ oneLeg: p.oneLeg })}</div>`).join('')}
          ${picks2d.map(f => `<button class="pick2d" data-find="${f.id}" style="left:${f.x2}px" aria-label="${esc(f.title)}">${f.art()}</button>`).join('')}
          <button class="go-arrow" id="goArrow" style="left:${L.door(target)}px;bottom:calc(15% + ${8 + (target === 'roof' ? L.rh * .26 : L.bh * .34)}px)">${ARROW[target]}</button>
          <div class="near-bubble hidden" id="nearBubble"></div>
          <div class="walker"><div class="char">${heroArt({ cup: st.drink && idx >= 3 ? st.drink : null, bouquet: st.bouquet || null })}</div></div>
          ${st.catHelper && !opts.intro ? `<div class="catwalker"><div class="char">${Art.cat()}</div></div>` : ''}
        </div>
        <div class="edge-arrow hidden" id="edge"></div>
        <div class="pad-ctl hidden" id="pad"><button class="ctl" data-dir="left" aria-label="Влево">◀</button><button class="ctl" data-dir="right" aria-label="Вправо">▶</button></div>
        <button class="ctl act hidden" id="act" data-hud-slot="P">Войти</button>
        <div class="ctl-hint hidden" id="hint"></div>`, 'street');
      G.setHud({ label: label(target) }); G.tgHeader(LIGHT);
      if (M()) caseCardOn(target, M().worldExtras({ mode: 'story', target, idx }).hud, scr);
      const world = scr.querySelector('.world'), walker = scr.querySelector('.walker');
      const heroChar = walker.querySelector('.char');
      let catw = scr.querySelector('.catwalker');
      const pad = scr.querySelector('#pad'), act = scr.querySelector('#act'), hint = scr.querySelector('#hint');
      const edge = scr.querySelector('#edge'), bubble = scr.querySelector('#nearBubble'), goArrow = scr.querySelector('#goArrow');
      const far = scr.querySelector('#far');
      const cup = st.drink && idx >= 3 ? st.drink : null;

      let heroX = opts.again ? L.door(target) + 30 : justLit ? L.door(justLit) : L.cart + 175, catX = heroX - 50, facing = 1;
      let moveTo = null, pendingEnter = false, active = false, finished = false, walking = false;
      const held = { left: false, right: false };
      const clampX = x => Math.max(30, Math.min(L.worldW - 30, x));
      const clampCam = x => Math.max(-(L.worldW - L.W), Math.min(0, -(x - L.W / 2)));
      let camX = clampCam(heroX);
      const nearDoor = () => ORDER.find(k => Math.abs(heroX - L.door(k)) < 48) || null;
      const render = () => {
        walker.style.left = (heroX - HW / 2) + 'px';
        if (catw) catw.style.left = (catX - 22) + 'px';
        world.style.transform = `translateX(${camX}px)`;
        far.style.transform = `translateX(${camX * .25}px)`;
      };
      render();

      // идёт — в профиль по направлению движения, стоит — лицом к нам
      const setWalking = w => {
        if (w === walking) return; walking = w;
        heroChar.innerHTML = heroArt({ view: w ? 'side' : 'front', cup, bouquet: S().bouquet || null });
        heroChar.classList.toggle('walk', w);
        heroChar.classList.toggle('flip', w && facing < 0);
        if (catw) catw.querySelector('.char').classList.toggle('walk', w);
      };
      const finish = async () => {
        if (finished) return; finished = true;
        cleanup(); haptic('medium'); sfx('ok');
        // поворачивается спиной и заходит в дверь
        act.classList.add('hidden'); bubble.classList.add('hidden'); edge.classList.add('hidden');
        heroChar.classList.remove('walk', 'flip');
        heroChar.innerHTML = heroArt({ view: 'back' });
        await wait(180);
        heroChar.classList.add('enter');
        await wait(480);
        res();
      };
      const tryEnter = () => {
        if (!active || finished || blocked()) return;
        const k = nearDoor();
        if (k === target) { finish(); return; }
        if (!k && Math.abs(heroX - (L.cart + 66)) < 50) { useCart(); return; }
        haptic('light');
        if (k && lit(k)) toast('Здесь уже всё выяснили. Смотри, куда ведёт следующая метка.', 2000);
        else if (k) toast('Пока закрыто. Сюда ещё вернёмся.', 1800);
        else toast(`Тут не войти. Ищи ${BNAME[target]} по стрелке.`, 2200);
      };

      // клавиатура
      const kd = e => {
        if (finished) return;
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') { held.left = true; e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') { held.right = true; e.preventDefault(); }
        else if (k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'w' || k === 'W' || k === 'e' || k === 'E') {
          if (e.defaultPrevented || blocked()) return; // Enter/пробел в диалогах обрабатывает сам диалог
          e.preventDefault(); tryEnter();
        }
      };
      const ku = e => {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') held.left = false;
        if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') held.right = false;
      };
      const blur = () => { held.left = held.right = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      window.addEventListener('blur', blur);

      // экранные кнопки (держать — идти)
      pad.querySelectorAll('.ctl').forEach(b => {
        const dir = b.dataset.dir;
        const on = e => { e.preventDefault(); held[dir] = true; b.classList.add('on'); moveTo = null; try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } haptic('select'); };
        const off = () => { held[dir] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on);
        ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => b.addEventListener(ev, off));
        b.addEventListener('contextmenu', e => e.preventDefault());
      });
      act.addEventListener('click', e => { e.stopPropagation(); tryEnter(); });
      goArrow.addEventListener('click', e => { e.stopPropagation(); if (!active) return; if (nearDoor() === target) finish(); else { moveTo = L.door(target); pendingEnter = true; } });

      // тап по тротуару / зданию — идти туда
      world.addEventListener('click', e => {
        if (!active || finished || blocked()) return;
        const r = world.getBoundingClientRect();
        const x = clampX(e.clientX - r.left);
        const b = e.target.closest('.bld');
        if (b && b.dataset.b === target) { moveTo = L.door(target); pendingEnter = true; return; }
        if (b) { moveTo = L.door(b.dataset.b); pendingEnter = true; return; }
        moveTo = x; pendingEnter = false;
      });

      // пропсы
      scr.querySelector('[data-p="weather"]').addEventListener('click', e => {
        e.stopPropagation(); haptic('light');
        toast(idx >= 3 ? 'Прогноз: прояснение откладывается до серии\u00A02.' : 'Прогноз: пасмурно, местами подозрительно. К вечеру прояснение.', 3200);
      });
      scr.querySelector('[data-p="kiosk"]').addEventListener('click', e => { e.stopPropagation(); haptic('light'); toast(HEADLINES[Math.min(idx, 3)], 3400); });
      scr.querySelector('[data-p="silver"]').addEventListener('click', e => {
        e.stopPropagation(); haptic('light');
        toast('За стеклом часы. Все показывают разное время, и каждые уверены, что правы.', 3600);
      });
      const sec = scr.querySelector('[data-p="secret"]');
      if (sec) sec.addEventListener('click', async e => { e.stopPropagation(); sec.remove(); await G.giveSticker('secret', 'Значение знают только посвящённые.'); });
      heroChar.addEventListener('click', e => {
        e.stopPropagation();
        if (active && nearDoor() === target) { finish(); return; }
        haptic('light');
        heroChar.classList.remove('hop'); void heroChar.offsetWidth; heroChar.classList.add('hop');
        sparkleAt(heroChar, { n: 6, dist: 36 });
        toast(st.drink && idx >= 3 ? 'Сначала глоток. Потом подвиги.' : 'Проверка образа. Всё прекрасно. Можно спасать мир.', 2200);
      });
      const cartX = L.cart + 66;
      let cartBusy = false, cartAuto = !st.metBee && !opts.intro;
      const api2d = {
        setHeld: () => { heroChar.innerHTML = heroArt({ view: walking ? 'side' : 'front', cup, bouquet: S().bouquet || null }); },
        celebrate: () => { heroChar.classList.remove('hop'); void heroChar.offsetWidth; heroChar.classList.add('hop'); sparkleAt(heroChar, { kind: 'heart', n: 14, dist: 70 }); haptic('success'); },
      };
      const useCart = async () => { if (cartBusy || finished) return; cartBusy = true; moveTo = null; pendingEnter = false; await flowerCart(api2d); cartBusy = false; };
      scr.querySelector('[data-p="cart"]').addEventListener('click', e => {
        e.stopPropagation(); if (!active || finished) return;
        if (Math.abs(heroX - cartX) < 70) useCart(); else { moveTo = cartX + 20; pendingEnter = false; }
      });
      let picking2d = false;
      const collect2d = async el => {
        if (!el || picking2d || el.classList.contains('taken')) return;
        picking2d = true;
        el.classList.add('taken'); haptic('success'); sfx('sticker'); sparkleAt(el, { kind: 'heart', n: 10, dist: 50 });
        heroChar.classList.remove('hop'); void heroChar.offsetWidth; heroChar.classList.add('hop');
        await wait(420); el.remove();
        await pickFind(el.dataset.find, api2d); api2d.setHeld();
        picking2d = false;
      };
      scr.querySelectorAll('.pick2d').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation(); if (!active || finished) return;
        const x = +el.style.left.replace('px', '');
        if (Math.abs(heroX - x) < 60) collect2d(el); else { moveTo = clampX(x); pendingEnter = false; }
      }));
      const petCat = el => {
        let pets = 0;
        el.addEventListener('click', e => { e.stopPropagation(); pets++; haptic('light'); sparkleAt(el, { kind: 'heart', n: 5, dist: 30 }); toast(pets >= 5 ? 'Кот просит перестать его гладить. Через секунду передумал.' : 'Мрр.', 1600); });
      };
      if (catw) petCat(catw);

      // игровой цикл
      const SPEED = 240;
      let last = performance.now(), raf = 0;
      const pgEls = [...scr.querySelectorAll('.pigeon')];
      const tick = now => {
        if (finished) return;
        const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
        let dir = 0;
        if (active && !blocked()) {
          dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
          if (dir) { moveTo = null; pendingEnter = false; }
          else if (moveTo !== null) {
            const d = moveTo - heroX;
            if (Math.abs(d) < 5) { moveTo = null; if (pendingEnter) { pendingEnter = false; tryEnter(); } }
            else dir = Math.sign(d);
          }
          if (dir) {
            heroX = clampX(heroX + dir * SPEED * dt);
            if (dir !== facing) { facing = dir; heroChar.classList.toggle('flip', walking && dir < 0); }
          }
        }
        setWalking(!!dir);
        if (catw) { const tgt = heroX - 52 * facing; catX += (tgt - catX) * Math.min(1, dt * 3.2); }
        camX += (clampCam(heroX) - camX) * Math.min(1, dt * 5);
        render();
        // тележка с цветами: в первый раз Жу сама окликнет
        if (active && cartAuto && !cartBusy && !blocked() && Math.abs(heroX - cartX) < 50) { cartAuto = false; useCart(); }
        // находки: подходишь — подбираешь
        if (active && !picking2d && !blocked()) scr.querySelectorAll('.pick2d:not(.taken)').forEach(el => { if (Math.abs(heroX - +el.style.left.replace('px', '')) < 30) collect2d(el); });
        // голуби вспархивают
        pigeons.forEach((p, i) => {
          if (!p.flown && Math.abs(heroX - p.x) < 70) {
            p.flown = true; const el = pgEls[i];
            el.style.setProperty('--fx', (p.x < heroX ? -1 : 1) * (80 + Math.random() * 60) + 'px');
            el.classList.add('fly'); if (st.sound) sfx('blip');
          }
        });
        // подсказки у двери и стрелка у края экрана
        if (active) {
          const k = nearDoor();
          const atTarget = k === target;
          const atCart = !k && !cartBusy && Math.abs(heroX - cartX) < 50;
          // HUD v2: главная кнопка P — значок + слово (HUD.paintAct), полная подпись — aria-label
          const aL = atTarget ? (target === 'roof' ? 'Войти · к лестнице' : 'Войти') : atCart ? '💐 Букет' : '';
          if (aL !== act.dataset.lbl) { act.dataset.lbl = aL; if (aL) { if (window.HUD) HUD.paintAct(act, aL); else act.textContent = aL; } }
          act.classList.toggle('hidden', !aL);
          if (k && !blocked()) {
            bubble.classList.remove('hidden');
            bubble.style.left = L.door(k) + 'px';
            bubble.style.bottom = `calc(15% + ${(k === 'roof' ? L.rh * .26 : L.bh * .34) + 52}px)`;
            bubble.textContent = atTarget ? (coarse() ? 'жми «Войти»' : '↑ — войти') : lit(k) ? 'уже раскрыто' : 'закрыто';
            goArrow.classList.toggle('hidden', atTarget);
          } else { bubble.classList.add('hidden'); goArrow.classList.remove('hidden'); }
          const sx = L.door(target) + camX, eSide = sx > L.W - 30 ? 'r' : sx < 30 ? 'l' : null;
          if (window.HUD) HUD.chevAt(edge, eSide, { label: ARROW[target] });
          else if (eSide === 'r') { edge.className = 'edge-arrow r'; edge.textContent = `${ARROW[target]} →`; }
          else if (eSide === 'l') { edge.className = 'edge-arrow l'; edge.textContent = `← ${ARROW[target]}`; }
          else edge.className = 'edge-arrow hidden';
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      function cleanup() {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        window.removeEventListener('blur', blur);
      }

      await wait(500);
      if (justLit) {
        const jb = scr.querySelector(`[data-b="${justLit}"]`);
        jb.classList.add('lit'); haptic('success'); sfx('reveal');
        setTimeout(() => sparkleAt(jb, { n: 16, dist: 110 }), 300);
        await wait(1300);
        toast(HEADLINES[Math.min(idx, 3)], 3000);
      }
      if (opts.intro) {
        catw = await streetIntro(scr, heroX);
        if (catw) { catX = heroX - 120; petCat(catw); }
      }
      if (target === 'roof' && !mem.seen.hedgehog) { mem.seen.hedgehog = true; await hedgehogCameo(); }
      if (opts.again) toast('Ты на улице. Всё найденное сохранено — продолжишь, когда захочешь.', 2600);

      active = true;
      pad.classList.remove('hidden');
      if (!st.walkedOnce || opts.intro) {
        // подсказка управления — тостом (HUD v2)
        toast(coarse() ? 'Держи ◀ ▶ внизу или тапни по тротуару' : '← → — ходить, ↑ — войти', 4000);
        st.walkedOnce = true; G.save();
      }
    });
  }
  async function streetIntro(scr, heroX) {
    const st = S();
    st.catHelper = null;
    await say({ who: 'cat', text: 'Мяу. Перевожу: я Пирожок, местный информатор. Работаю за еду. Уважение можешь оставить себе.' });
    const v = await choose('Пойдём вместе? Я иногда полезный.', [
      { label: 'Идём, хвостатый', value: true }, { label: 'Я сама', value: false }], { who: 'cat' });
    st.catHelper = v; G.save();
    let cw = null;
    if (v) {
      await say({ who: 'cat', text: 'Отлично. Всё равно я уже пошёл за тобой.' });
      cw = document.createElement('div'); cw.className = 'catwalker';
      cw.innerHTML = `<div class="char">${Art.cat()}</div>`;
      cw.style.left = (heroX - 140) + 'px';
      scr.querySelector('.world').appendChild(cw);
    } else {
      await say({ who: 'cat', text: 'Договорились. Если передумаешь — жми на лапку. Я буду очень занят сном.' });
    }
    await say({ who: 'cat', text: 'Солнце исчезло утром. Последний раз его видели над кинотеатром. Пойдём туда — смотри на стрелку.' });
    if (!st.bouquet) await say({ who: 'cat', text: 'Слева цветы. Жу всем дарит букеты. Мне однажды подарила кактус. Намёк понял.' });
    return cw;
  }
  async function hedgehogCameo() {
    await say([
      { who: 'hedgehog', text: 'Стоп! Я слышала утром странное «пшш» над крышей. Думала, кто-то открыл газировку. Но газировка обычно не светится.' },
      { who: 'hero', text: 'Убедительно. Особенно часть, где газировка летает.' },
      { who: 'hedgehog', text: 'Я за звук отвечаю, не за здравый смысл. Увидимся в следующей серии!' },
    ]);
  }


  /* ---------- Маленькие сценические эффекты ---------- */
  // ремарка внизу экрана, как в тексте пьесы
  // Кнопка «← на улицу» доступна сразу. Если нажать кнопку во время вступления, реплики пропускаются,
  // а вступление покажется заново при следующем входе.
  function earlyExit(labelText) {
    const ctl = { out: false, done: false };
    G.setHud({ label: labelText, onExit: () => { if (ctl.done || ctl.out) return; ctl.out = true; G.skipDialogs(true); } });
    ctl.settle = () => { ctl.done = true; G.skipDialogs(false); return ctl.out; };
    return ctl;
  }
  function stageDirection(lines) {
    if (G.isSkipping()) return Promise.resolve();
    return new Promise(res => {
      const el = document.createElement('div'); el.className = 'remark';
      G.layer.appendChild(el);
      let i = 0, timer = null, done = false;
      const off = G.onSkip(() => { clearTimeout(timer); done = true; el.remove(); res(); });
      const next = () => {
        clearTimeout(timer);
        if (i >= lines.length) { if (done) return; done = true; off(); el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 300); return; }
        el.textContent = lines[i++]; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
        timer = setTimeout(next, Math.max(2300, 1200 + 40 * el.textContent.length));
      };
      el.addEventListener('click', next);
      next();
    });
  }
  // титр немого кино на весь экран
  function intertitle(text) {
    if (G.isSkipping()) return Promise.resolve();
    return new Promise(res => {
      const el = document.createElement('div'); el.className = 'intertitle';
      el.innerHTML = `<div class="it-card"><svg class="it-orn" viewBox="0 0 100 20"><path d="M2,10 Q20,0 38,10 Q50,16 62,10 Q80,0 98,10" stroke="#F5F1EA" stroke-width="1.6" fill="none"/><circle cx="50" cy="12" r="2" fill="#F5F1EA"/></svg><div class="it-text">${esc(text)}</div><svg class="it-orn flip" viewBox="0 0 100 20"><path d="M2,10 Q20,0 38,10 Q50,16 62,10 Q80,0 98,10" stroke="#F5F1EA" stroke-width="1.6" fill="none"/><circle cx="50" cy="12" r="2" fill="#F5F1EA"/></svg></div>`;
      G.layer.appendChild(el); G.app.classList.add('silent-film'); sfx('tap');
      let closed = false;
      const close = () => { if (closed) return; closed = true; el.classList.add('out'); G.app.classList.remove('silent-film'); setTimeout(() => { el.remove(); res(); }, 400); };
      el.addEventListener('click', close); setTimeout(close, Math.max(2200, 1000 + 55 * String(text).length));
    });
  }
  // шкаф в бюро: створки, мигание света, свиток и чек на обороте
  function cabinetModal() {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card cab-card">
          <div class="tiny muted cab-cap" style="font-weight:900;letter-spacing:.08em">Шкаф (cabinet)</div>
          <div class="cabinet" id="cab">
            <div class="cab-inside"><div class="scroll" id="scr"><div class="scroll-front hand">
              <div class="scroll-title">ОПИСЬ СТИРКИ</div>
              <div>~ Рубашек — 4</div><div>~ Чулок — 2 пары</div><div>~ Шейных платков — 3</div><div>~ Жилет — 1 (в пятнах от чая)</div><div>~ Носок — 1 (второй в розыске)</div>
              <div class="seal"><svg viewBox="0 0 60 60">${Art.teacup('#FFF3D6', 3)}</svg></div>
            </div><div class="scroll-back">
              <div class="mini-receipt"><b>САХАРНАЯ ПУДРА</b><br/>кассовый чек<br/>— — — — —<br/>«Солнечный» латте … 1<br/>С собой, без сахара<br/>— — — — —<br/>Спасибо, заходите!</div>
            </div></div></div>
            <div class="cab-door l"></div><div class="cab-door r"></div>
            <div class="cab-flash"></div>
          </div>
          <p class="muted cab-text" id="cabText" style="font-weight:800;margin:10px 0 4px">Створки поддаются…</p>
          <button class="btn block" id="cabBtn" disabled>…</button>
        </div>`;
      G.layer.appendChild(m);
      const cab = m.querySelector('#cab'), btn = m.querySelector('#cabBtn'), txt = m.querySelector('#cabText');
      sfx('drum'); haptic('medium');
      setTimeout(() => cab.classList.add('open'), 350);
      setTimeout(() => { cab.classList.add('flash'); txt.textContent = 'Шкаф открылся. Внутри свиток. Пожалуйста, пусть это будет не рецепт стирки.'; }, 900);
      setTimeout(() => { cab.classList.add('unroll'); btn.disabled = false; btn.textContent = 'Перевернуть'; }, 1700);
      let step = 0;
      btn.addEventListener('click', () => {
        haptic('light');
        if (step === 0) { step = 1; cab.classList.add('flip'); txt.textContent = 'Перевернула. Тут чек из «Сахарной пудры». Наконец-то полезная бумажка.'; btn.textContent = 'Подшить к делу'; return; }
        m.classList.add('out'); setTimeout(() => { m.remove(); res(); }, 250);
      });
    });
  }

  /* ---------- КИНОТЕАТР ---------- */
  const FRAME_TARGETS = [
    { id: 'clock', x: 272, y: 44, r: 30, msg: 'Тринадцать на часах! У времени начались проблемы с математикой.' },
    { id: 'mirror', x: 200, y: 58, r: 36, msg: 'Ваза есть, отражения нет. Надеюсь, у вазы просто плохой день.' },
    // id 'bow' — внутренний (хранится в прогрессе кадра cin.f), реплика — про вещь из выбранного образа
    { id: 'bow', x: 322, y: 116, r: 26, who: 'hero', get msg() { return 'Секундочку. Это ' + (window.HeroLooks ? HeroLooks.get(G.look()).sig.my : 'МОЙ бант') + '. Я теперь ещё и актриса без гонорара?'; } },
  ];
  const FRAME_DECOYS = [
    { x: 170, y: 148, r: 12, free: true, msgs: ['Пахнет яблоком с корицей. Виновница — свеча. Обидно.', 'Свеча делает вид, что она пирог. Не верим.'] },
    { x: 60, y: 160, r: 18, free: true, msg: 'Толстый роман, закладка на середине. Кто-то не дочитал. Подозрительно.' },
    { x: 268, y: 106, r: 26, msg: 'Кот в кадре — норма. Здесь же снимают кино.' },
    { x: 200, y: 138, r: 22, msg: 'Обычная ваза. А вот в зеркале с ней что-то не так.' },
    { x: 60, y: 74, r: 34, msg: 'Окно. А за ним октябрь, которому всё равно.' },
    { x: 142, y: 51, r: 20, msg: 'На картине солнце. Кажется, художник последний, кто его видел.' },
    { x: 268, y: 140, r: 34, msg: 'Кресло. Очень хочется присесть и больше ничего не расследовать.' },
    { x: 126, y: 150, r: 24, msg: 'Фикус. Он ничего не видел. Но очень старался.' },
  ];
  // F = { busy, finished } — общие флаги сцены; onDone(skipped) — когда все три найдены (или пропуск)
  function framePuzzle(frame, kit, m, F, onDone) {
    const found = m.found, targets = FRAME_TARGETS, decoys = FRAME_DECOYS.map(d => Object.assign({}, d));
    let lastToast = 0;
    const svgEl = frame.querySelector('svg');
    const toPx = (x, y) => { const r = svgEl.getBoundingClientRect(), f = frame.getBoundingClientRect(); return [x / 360 * r.width + (r.left - f.left), y / 240 * r.height + (r.top - f.top), r.width / 360]; };
    const ring = t => {
      const [px, py, k] = toPx(t.x, t.y);
      const el = document.createElement('div'); el.className = 'found-ring';
      const rr = t.r * k; el.style.left = (px - rr) + 'px'; el.style.top = (py - rr) + 'px'; el.style.width = el.style.height = rr * 2 + 'px';
      frame.appendChild(el);
      const a = G.app.getBoundingClientRect(), f = frame.getBoundingClientRect();
      G.sparkle(f.left - a.left + px, f.top - a.top + py, { n: 10, dist: 50 });
    };
    found.forEach(id => { const t = targets.find(x => x.id === id); if (t) ring(t); });
    dots(kit.dots, found.size, 3);
    const finishAll = async skipped => {
      if (F.finished) return; F.finished = true; kit.off();
      targets.forEach(t => { if (!found.has(t.id)) { found.add(t.id); ring(t); } });
      dots(kit.dots, 3, 3);
      await wait(600);
      onDone(skipped);
    };
    svgEl.addEventListener('click', async e => {
      if (F.busy || F.finished) return;
      const r = svgEl.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 360, y = (e.clientY - r.top) / r.height * 240;
      const hit = targets.find(t => !found.has(t.id) && Math.hypot(t.x - x, t.y - y) <= t.r);
      if (hit) {
        F.busy = true; found.add(hit.id); ring(hit); haptic('success'); sfx('ok');
        dots(kit.dots, found.size, 3);
        if (found.size === 3) { F.finished = true; kit.off(); }
        await say({ who: hit.who || 'narrator', text: hit.msg });
        F.busy = false;
        if (found.size === 3) { await wait(300); onDone(false); }
        return;
      }
      if (targets.some(t => found.has(t.id) && Math.hypot(t.x - x, t.y - y) <= t.r)) return;
      const d = decoys.find(t => Math.hypot(t.x - x, t.y - y) <= t.r);
      if (d && d.free) {
        haptic('light');
        toast(d.msgs ? d.msgs[(d.n = (d.n || 0) + 1) % d.msgs.length === 1 ? 0 : 1] : d.msg, 2800);
        return;
      }
      haptic('light'); sfx('wrong');
      if (Date.now() - lastToast > 2000) { lastToast = Date.now(); toast(d ? d.msg : 'Тут пока ничего. Попробуй посмотреть внимательнее.', 2000); }
      await kit.miss();
    });
    return { finishAll };
  }
  // сценка в 3D: житель идёт (или бежит) по точкам; промис — когда дошёл
  function tweenNpc(n, pts, speed = 1.6, opt = {}) {
    return new Promise(res => {
      if (!n || !n.root) return res();
      const P = [n.root.position.clone()].concat(pts.map(q => new window.THREE.Vector3(q[0], q[1] !== undefined && q.length > 2 ? q[1] : n.root.position.y, q.length > 2 ? q[2] : q[1])));
      let i = 0, last = performance.now(); n.bob = true; n.noLook = true;
      const step = now => {
        const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
        const a = n.root.position, b = P[i + 1];
        if (!b) { n.bob = false; n.noLook = false; if (opt.hide) n.root.visible = false; return res(); }
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), st = speed * dt * (G.isSkipping() ? 50 : 1);
        if (d <= st) { a.copy(b); i++; } else { a.x += dx / d * st; a.y += dy / d * st; a.z += dz / d * st; }
        if (Math.hypot(dx, dz) > 0.01) n.root.rotation.y = Math.atan2(dx, dz);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  const use3dRooms = () => !!(window.City3D && City3D.supported && City3D.hasRoom && !S().force2d);

  /* ---------- 3D-комнаты сюжета: общее окно загадки и сцены бюро, кондитерской, лестницы ---------- */
  function puzzleModal({ html, task, hint, dark }) {
    const md = document.createElement('div'); md.className = 'modal frame-modal';
    md.innerHTML = `<div class="frame-wrap"><button class="frame-close" aria-label="Закрыть">✕</button>${html}<div class="puzzle-bar"></div></div>`;
    G.layer.appendChild(md);
    const F = { busy: false, finished: false };
    let onSkip = () => {}, resolve;
    const kit = hintKit(md, { task, hint, dark, onSkip: () => onSkip() });
    const result = new Promise(r => { resolve = r; });
    const close = v => { md.classList.add('out'); setTimeout(() => md.remove(), 250); resolve(v); };
    md.querySelector('.frame-close').addEventListener('click', () => { if (F.busy || F.finished || document.querySelector('#layer .dlg-wrap')) return; haptic('light'); close('closed'); });
    return { md, F, kit, close, result, setSkip: f => { onSkip = f; } };
  }
  const heroOf = st => ({ look: G.look(), bow: st.bow, coat: st.coat, hair: st.hair, cup: null });
  const cycler = () => { const c = {}; return (k, list) => { const i = c[k] || 0; c[k] = i + 1; return list[i % list.length]; }; };
  // f2 — 2D-версия сцены на случай, если 3D не запустилось
  function room3D(id, o, f2) {
    return new Promise(res => {
      const st = S();
      City3D.run(Object.assign({
        room: id, hudLabel: label(id),
        hero: heroOf(st), catHelper: !!st.catHelper, catSweater: !!st.catSweater && !!st.catHelper,
        held: st.bouquet ? { kind: 'bouquet', data: st.bouquet } : null,
        done: v => { if (o.onDone) o.onDone(v); res(v === 'exit' ? 'exit' : undefined); },
        fallback: () => { S().force2d = true; G.save(); f2().then(res); },
      }, o));
    });
  }

  function bureau3D() {
    const st = S(), m = mem.bureau || (mem.bureau = { fixed: new Set() }), nx = cycler();
    let left = false, solving = false, lostI = 0;
    return room3D('bureau', {
      onDone: v => { left = v === 'exit'; },
      onSpot: async (id, api) => {
        if (id === 'note') {
          if (solving) return; solving = true;
          const pm = puzzleModal({ html: bureauNoteHTML(), task: 'Нажми на жёлтые слова и помоги с переводом', hint: 'Эти слова похожи на русские, но это ловушка. Не верь первым впечатлениям.' });
          const finishAll = skipped => { if (pm.F.finished) return; pm.F.finished = true; pm.kit.off(); BUREAU_WORDS.forEach(w => m.fixed.add(w.id)); pm.md.querySelector('#tr').innerHTML = bureauTr(m.fixed); dots(pm.kit.dots, 4, 4); setTimeout(() => pm.close(skipped ? 'skipped' : 'solved'), 700); };
          pm.setSkip(() => finishAll(true));
          notePuzzle(pm.md, pm.kit, m, pm.F, () => finishAll(false));
          const r = await pm.result;
          if (r === 'closed') { solving = false; return; }
          mem.bureau = null; confetti(); api.celebrate();
          await bureauAfter(r === 'skipped', null);
          if (api.room.openCabinet) api.room.openCabinet();
          api.camFocus([1.6, 2.6, 0.4], [4.0, 1.3, -3.7]); await wait(900);
          await bureauCabinet();
          api.camRelease(); api.finish('solved');
          return;
        }
        if (id === 'cabinet') { haptic('light'); toast(nx('cab', ['Шкаф закрыт. Попугай клянётся, что это «кабинет». Не верь попугаю.', 'Шкаф не открывается. Кажется, обиделся, что его назвали кабинетом.']), 2600); return; }
        if (id === 'lost') { haptic('light'); toast(BUREAU_LOST[lostI++ % BUREAU_LOST.length][1], 3200); return; }
        if (id === 'books') { haptic('light'); toast(nx('books', ['На полке двадцать словарей. Попугай открывал только тот, что с картинками.', 'Книга «Как переводить шутки». Первая страница: «Сочувствуем». Остальные пустые.', '«Ложные друзья переводчика». Кто-то обвёл слово magazine красным и написал: «НЕ МАГАЗИН».']), 3200); return; }
        if (id === 'globe') { haptic('light'); toast(nx('globe', ['Покрутила глобус. Отпуск нашёлся, солнце — нет.', 'Глобус предлагает океан. К сожалению, начальство не отпускает.']), 3000); }
      },
      onNpc: async id => {
        if (id === 'parrot') await say({ who: 'parrot', text: nx('parrot', ['Чувствую, скоро меня повысят. Или уволят. Это одно из двух.', 'Hello — это «привет». Видите? Я уже почти свободно говорю.']) });
        if (id === 'fox') await say({ who: 'fox', text: nx('fox', ['Архив открыт. Боюсь, это самая радостная новость за день.', 'Словарь здесь главный. Даже я с ним не спорю.']) });
      },
      beforeActive: async () => {
        await wait(400);
        if (!mem.seen.bureau) {
          await say([
            { who: 'parrot', text: 'Здравствуйте! Я переводчик. То есть стажёр. То есть меня пока не выгнали.' },
            { who: 'hero', text: 'Пока ты делаешь мне головную боль.' },
            { who: 'parrot', text: 'Я уже перевёл записку похитителя. Очень точно! Ну… я так чувствую.' },
            ...(st.bouquet ? [{ who: 'parrot', text: 'О, какой красивый… пучок? Нет, «букет»! Запишите, у меня прогресс.' }] : []),
            { who: 'fox', text: 'Я принесла словарь. На всякий случай. Попугай сегодня особенно уверен в себе.' },
            { who: 'hero', text: 'Оставь. Может, ему пригодится.' },
          ]);
          if (!left) mem.seen.bureau = true;
          if (!left && !G.isSkipping()) toast('Записка лежит на столе. Подойди и прочитай.', 3000);
        } else await say({ who: 'parrot', text: 'Вы вернулись! Я решил больше ничего не переводить без свидетелей.' });
      },
    }, bureau);
  }

  function sweets3D() {
    const st = S(), nx = cycler();
    let left = false, solving = false;
    return room3D('sweets', {
      onDone: v => { left = v === 'exit'; },
      onSpot: async (id, api) => {
        if (id === 'showcase') {
          if (solving) return; solving = true;
          const pm = puzzleModal({ html: witnessHTML(), task: 'Врёт только один из трёх. Кто?', hint: 'Проверь каждого: если он врёт, могут ли остальные двое говорить правду?' });
          dots(pm.kit.dots, 0, 1);
          const done = (btn) => {
            if (pm.F.finished) return; pm.F.finished = true; pm.kit.off();
            const bt = btn || pm.md.querySelector('[data-w="bubbletea"]');
            bt.classList.add('picked'); bt.querySelector('.w-art').innerHTML = Art.bubbletea({ mouth: 'wobble' });
            dots(pm.kit.dots, 1, 1); haptic('success'); sfx('ok'); sparkleAt(bt, { n: 12, dist: 60 });
            setTimeout(() => pm.close('solved'), 900);
          };
          pm.setSkip(() => done(null));
          witnessPuzzle(pm.md, pm.kit, pm.F, done);
          const r = await pm.result;
          if (r === 'closed') { solving = false; return; }
          if (api.room.witnessWobble) api.room.witnessWobble('bubbletea');
          await sweetsAfter();
          api.finish('solved');
          return;
        }
        if (id === 'menu') { haptic('light'); toast('Меню дня: хлеб без хлеба. Зайка называет это высокой кухней. Я называю это соусом.', 3400); return; }
        if (id === 'table') { haptic('light'); toast(nx('table', ['Место у окна. Идеально для кофе и осуждения прохожих. Мысленно.', 'Присела. Всем срочно перестать пропадать на одну минуту.']), 3000); return; }
        if (id === 'cake') { haptic('light'); toast(nx('cake', ['Торт в три яруса. Красивее некоторых архитектурных проектов.', 'Вишенка на торте. Да-да, буквально. И что?']), 3000); }
      },
      onNpc: async id => {
        if (id === 'bunny') await say({ who: 'bunny', text: nx('bunny', ['Обычно у меня десерты просто едят. А тут они дают показания!', 'Рецепт честного десерта: сахар, масло и не врать следователю.']) });
        if (id === 'poodle') toast(nx('poodle', ['Пудра спит. Даже во сне она элегантнее нас.', 'Пудра открыла глаз, убедилась, что скандал без неё, и уснула.']), 2800);
      },
      beforeActive: async () => {
        await wait(400);
        if (!mem.seen.sweets) {
          await say({ who: 'bunny', text: 'Заходи! Свидетели на витрине. Прошу не есть их до окончания допроса.' });
          if (st.bouquet) await say({ who: 'bunny', text: 'Какие цветы! Только осторожнее с булочкой: она на красоту очень впечатлительная.' });
          if (!left) mem.seen.sweets = true;
          if (!left && !G.isSkipping()) toast('Свидетели — на витрине. Подойди к ним.', 3000);
        } else await say({ who: 'bunny', text: 'Ты вернулась! Отлично. Бабл-ти уже собирался менять показания.' });
      },
    }, sweets);
  }

  function roof3D() {
    const st = S(), nx = cycler();
    let left = false, reading = false, ei = 0, echoBusy = false;
    return room3D('roof', {
      onDone: v => { left = v === 'exit'; },
      onSpot: async (id, api) => {
        if (id === 'note') {
          if (reading) return; reading = true;
          await noteModal();
          if (api.room.hideNote) api.room.hideNote();
          await roofAfterNote();
          api.finish('solved');
          return;
        }
        if (id === 'stairs') {
          if (echoBusy) return;
          if (ei >= ROOF_ECHO.length) { toast('Эхо больше не отвечает. Кажется, и у него рабочий день закончился.', 2600); return; }
          echoBusy = true; haptic('light');
          const E = ROOF_ECHO[ei++];
          await say({ who: 'hero', text: E.hero }); toast(E.echo, 1500); await wait(1200);
          if (E.cat) await say(st.catHelper ? { who: 'cat', text: E.cat } : { text: E.alt });
          if (ei >= ROOF_ECHO.length) await say({ text: ECHO_NYMPH });
          echoBusy = false;
          return;
        }
        if (id === 'mailboxes') { haptic('light'); toast(nx('mail', ['Ящики жильцов. Один подписан «Эхо». Второй — «Ступеньки». Давно не вынимали почту.', 'Из седьмого ящика торчит открытка с котиком. На этот раз правда просто котик.']), 3400); return; }
        if (id === 'radiator') { haptic('light'); toast(nx('rad', ['Батарея тёплая. Пирожок просит не мешать его работе. Работе спать.', 'Погрелась у батареи. Иногда это лучший план.']), 3000); }
      },
      beforeActive: async () => {
        await wait(500);
        if (!mem.seen.roof) {
          await say({ who: 'cat', text: 'Так. Крыша есть. Перила есть. А ступенек нет. Табличка: «Ушли на обед». Великолепная организация пространства.' });
          if (!left) mem.seen.roof = true;
        } else await say({ who: 'cat', text: 'Удивительно: мы вернулись, а ступеньки — нет.' });
        if (!left && !G.isSkipping()) toast('На дальней двери записка. Подойди и прочитай.', 3000);
      },
    }, roof);
  }

  /* ---------- КИНОТЕАТР в 3D: зал, экран с кадром, будка енота, гусь ---------- */
  function cinema3D() {
    return new Promise(res => {
      const st = S(), E = G.ep(1), cin = E.cin || (E.cin = { f: [], i: 0 });
      let left = false, solving = false;
      const ROTATE = { booth: 0, popcorn: 0, posters: 0, goose: 0 };
      const next = (k, list) => list[ROTATE[k]++ % list.length];
      const BOOTH = ['Слёз было столько, что я дважды протирал глаза платком. Экран — ни разу.', 'Проектор старый, но честный. Показывает только то, что было.', 'Если кадр заело — ищите, что в нём лишнее. Так учил мой учитель. Тоже енот.'];
      City3D.run({
        room: 'cinema', hudLabel: label('cinema'),
        hero: { look: G.look(), bow: st.bow, coat: st.coat, hair: st.hair, cup: null },
        catHelper: !!st.catHelper, catSweater: !!st.catSweater && !!st.catHelper,
        held: st.bouquet ? { kind: 'bouquet', data: st.bouquet } : null,
        onSpot: async (id, api) => {
          if (id === 'screen') {
            if (solving) return; solving = true;
            const scr = api.room.screen, found = new Set(cin.f), F = { busy: false, finished: false };
            let lastToast = 0;
            if (api.fitScreen && api.room.screenMesh) api.fitScreen(api.room.screenMesh, { margin: 1.06, y: 2.6 }); else api.camFocus([0.25, 2.5, -2.3], [0.15, 2.4, -6.9]);
            // тонкая полоска загадки внизу (не модалка: HUD и выход остаются доступны)
            const strip = document.createElement('div'); strip.className = 'room-puzzle';
            strip.innerHTML = '<div class="puzzle-bar"></div><button class="chip room-back">↩ отойти</button>';
            const c3 = document.querySelector('.city3d') || G.app; c3.appendChild(strip); if (api.focusMode) api.focusMode(true);
            const endFocus = () => { api.intercept(null); api.camRelease(); strip.remove(); if (api.focusMode) api.focusMode(false); solving = false; };
            const finishAll = async skipped => {
              if (F.finished) return; F.finished = true; kit.off();
              FRAME_TARGETS.forEach(t => { if (!found.has(t.id)) { found.add(t.id); scr.mark(t.x, t.y, t.r); } });
              cin.f = [...found]; G.save(); dots(kit.dots, 3, 3);
              await wait(700); solved(skipped);
            };
            const kit = hintKit(strip, { task: 'Найди три странности на кадре', hint: 'Начни с зеркала, часов и кулисы. Да, кино умеет прятать детали.', onSkip: () => finishAll(true) });
            dots(kit.dots, found.size, 3);
            strip.querySelector('.room-back').addEventListener('click', () => { if (!F.busy && !F.finished) { haptic('light'); endFocus(); } });
            const decoys = FRAME_DECOYS.map(d => Object.assign({}, d));
            const flicker = () => { const bm = api.room.beamMat; if (!bm) return; const t0 = performance.now(); const st2 = () => { const k = Math.min(1, (performance.now() - t0) / 400); bm.opacity = 0.1 + Math.sin(k * Math.PI) * 0.12; if (k < 1) requestAnimationFrame(st2); }; st2(); };
            const hitAt = async (x, y, point) => {
              if (F.busy || F.finished) return;
              const hit = FRAME_TARGETS.find(t => !found.has(t.id) && Math.hypot(t.x - x, t.y - y) <= t.r);
              if (hit) {
                F.busy = true; found.add(hit.id); cin.f = [...found]; G.save();
                scr.mark(hit.x, hit.y, hit.r); haptic('success'); sfx('ok'); flicker();
                if (point) { const sp = api.toScreen(point.x, point.y, point.z); G.sparkle(sp.x, sp.y, { n: 10, dist: 50 }); }
                if (api.npcs.raccoon) api.npcs.raccoon.hop();
                dots(kit.dots, found.size, 3);
                if (found.size === 3) { F.finished = true; kit.off(); }
                await say({ who: hit.who || 'narrator', text: hit.msg });
                F.busy = false;
                if (found.size === 3) { await wait(300); solved(false); }
                return;
              }
              if (FRAME_TARGETS.some(t => found.has(t.id) && Math.hypot(t.x - x, t.y - y) <= t.r)) return;
              const d = decoys.find(t => Math.hypot(t.x - x, t.y - y) <= t.r);
              if (d && d.free) { haptic('light'); toast(d.msgs ? d.msgs[(d.n = (d.n || 0) + 1) % d.msgs.length === 1 ? 0 : 1] : d.msg, 2800); return; }
              haptic('light'); sfx('wrong');
              if (Date.now() - lastToast > 2000) { lastToast = Date.now(); toast(d ? d.msg : 'Тут пока ничего. Попробуй посмотреть внимательнее.', 2000); }
              await kit.miss();
            };
            api.intercept(h => {
              if (h.name === 'screen' && h.uv) { hitAt(h.uv.x * 360, (1 - h.uv.y) * 240, h.point); return true; }
              if (!F.busy && !F.finished) endFocus();   // тап мимо экрана — отойти, находки сохранены
              return false;
            });
            const solved = async skipped => {
              endFocus(); solving = true;
              scr.showFrame(true);
              G.haptic('success'); confetti(); api.celebrate();
              await say({ text: skipped
                ? 'Плёнка снова идёт. Иногда даже величайшим сыщицам помогает кнопка «Пропустить».'
                : 'Кадр снова движется! Сцена спасена. Енот рыдает от счастья. Ну или по привычке.' });
              suspicion(21, 'Финалыч впервые не успел рассказать концовку.');
              await G.giveSticker('film', 'На плёнке проступила вывеска бюро переводов. Кажется, следующий адрес найден.');
              api.finish('solved');
            };
            return;
          }
          if (id === 'booth') { await say({ who: 'raccoon', text: next('booth', BOOTH) }); return; }
          if (id === 'popcorn') { haptic('light'); toast(next('popcorn', ['Попкорн хрустит в самый страшный момент. Это закон жанра.', 'Солёный или сладкий? Следствие берёт оба. Для объективности.']), 2800); return; }
          if (id === 'posters') { haptic('light'); toast(next('posters', ['Афиша: «Тихий вечер». Жанр: подозрительно спокойный.', 'Афиша: «Скоро». Просто «Скоро». Самый интригующий фильм сезона.']), 3000); return; }
          if (id === 'clock') { haptic('light'); toast('Здесь на часах честные 12. А в кадре на экране — подозрительные 13.', 3200); }
        },
        onNpc: async (id, api) => {
          if (id === 'raccoon') await say({ who: 'raccoon', text: next('booth', BOOTH) });
          if (id === 'goose') await say({ who: 'goose', text: next('goose', ['Га! Я ничего не скажу. Почти ничего. Ладно, ничего.', 'Га. (Финалыч многозначительно показывает крылом на экран.)']) });
        },
        beforeActive: async api => {
          const N = api.npcs;
          await wait(500);
          // найденное в прошлый раз — снова кольцами на экране
          FRAME_TARGETS.forEach(t => { if (cin.f.includes(t.id) && api.room && api.room.screen) api.room.screen.mark(t.x, t.y, t.r); });
          if (!cin.i) {
            await say({ who: 'raccoon', text: 'Вы киномеханика ищете? Это я. Солнце? Не видел. У нас мелодрама, я весь сеанс плакал. А потом свет погас и кадр замер. И вот я плачу уже по другой причине.' });
            suspicion(12, 'Платочек у свидетеля мокрый насквозь.');
            N.goose.hop(); await wait(300);
            await say({ who: 'goose', text: 'ГА! А злодей-то в конце…' });
            sfx('wrong');
            const run1 = tweenNpc(N.goose, [[2.4, -1.25], [-3.6, -1.6], [-4.4, -2.7], [-5.4, -2.7]], 3.2, { hide: true });
            const run2 = tweenNpc(N.raccoon, [[3.9, 1.66, -1.2], [3.4, 0, -1.0], [-3.4, 0, -1.7], [-4.4, 0, -2.7], [-5.4, 0, -2.7]], 3.0);
            await Promise.all([stageDirection(['(Енот выносит Финалыча из зала. Финалыч продолжает кричать концовку.)', '(Енот возвращается в будку. На экране кто-то плачет. Енот присоединяется.)']), run1, run2]);
            const back = tweenNpc(N.raccoon, [[-4.4, 0, -2.7], [-3.4, 0, -1.7], [3.4, 0, -1.0], [3.9, 1.66, -1.2], [4.3, 1.66, -1.45]], 3.4);
            await say([
              { text: 'Финалыча выгнали. В 214-й раз. Кажется, он воспринимает это как абонемент.' },
              { who: 'raccoon', text: 'Он даже погоду спойлерит. «ГА! Завтра дождь!»' },
            ]);
            await back; N.raccoon.root.rotation.y = -0.55;
            if (st.bouquet) await say({ who: 'raccoon', text: 'Цветы! Как в финале моего любимого фильма… Всё, не могу, сейчас заплачу.' });
            if (!left) { cin.i = 1; G.save(); }
            if (!left && !G.isSkipping()) toast('Плёнка застряла. Подойди к экрану: на кадре что-то не так.', 3200);
          } else {
            N.goose.root.visible = false;
            await say({ who: 'raccoon', text: 'Вы вернулись! Только не говорите, чем закончится этот день. Я ещё не готов.' });
          }
        },
        done: v => { left = v === 'exit'; res(v === 'exit' ? 'exit' : undefined); },
        fallback: () => { cinema().then(res); },
      });
    });
  }

  function cinema() {
    return new Promise(async res => {
      const st = S();
      const scr = show(`
        <div class="loc-title" style="color:#F7C9D3">Кинотеатр «Саспенс»</div>
        <div class="screen-frame film-grain" id="frame"><div class="frame-tag">❚❚ кадр заело</div>${Art.cinemaFrame({ bow: st.bow, look: G.look() })}</div>
        <div class="puzzle-bar" id="pbar"></div>
        <div class="beam" id="beam"></div>
        <div class="booth" id="booth">${Art.booth()}</div>
        <div class="seats">${Art.seats()}</div>
        <div class="char" id="goose" style="position:absolute;width:86px;left:40%;bottom:62px;transition:transform .7s cubic-bezier(.5,-0.3,.6,1),opacity .7s;opacity:0;transform:translateY(40px)">${Art.goose()}</div>`, 'loc cinema');
      G.setHud({ label: label('cinema') }); G.tgHeader(DARK);
      const frame = scr.querySelector('#frame'), pbar = scr.querySelector('#pbar'), goose = scr.querySelector('#goose');
      const place = () => {
        const r = frame.getBoundingClientRect(), a = G.app.getBoundingClientRect();
        pbar.style.top = (r.bottom - a.top + 14) + 'px';
        const booth = scr.querySelector('#booth'), seatsEl = scr.querySelector('.seats');
        const seatsTop = seatsEl.getBoundingClientRect().top - a.top;
        const free = seatsTop - (r.bottom - a.top + 100);
        booth.style.top = (r.bottom - a.top + 100 + Math.max(0, (free - booth.offsetHeight) / 2)) + 'px';
        booth.style.display = free > 90 ? '' : 'none';
        const beam = scr.querySelector('#beam'), bb = booth.getBoundingClientRect();
        const lx = bb.left - a.left + bb.width * .76, ly = bb.top - a.top + bb.height * .37;
        const fy = r.bottom - a.top - 6, fx1 = r.left - a.left + r.width * .18, fx2 = r.right - a.left - r.width * .12;
        beam.innerHTML = `<svg width="100%" height="100%" style="position:absolute;inset:0"><defs><linearGradient id="bm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF0C8" stop-opacity=".28"/><stop offset="1" stop-color="#FFF0C8" stop-opacity=".04"/></linearGradient></defs><polygon points="${lx},${ly} ${fx1},${fy} ${fx2},${fy}" fill="url(#bm)"/></svg>`;
        beam.style.display = booth.style.display;
      };
      let finishAll = () => {};
      const kit = hintKit(scr, {
        task: 'Найди три странности на кадре',
        hint: 'Начни с зеркала, часов и кулисы. Да, кино умеет прятать детали.',
        onSkip: () => finishAll(true),
      });
      dots(kit.dots, 0, 3);
      place();
      const m = mem.cinema || (mem.cinema = { found: new Set() });
      let busy = false, finished = false;
      const exit = () => { if (finished || busy || blocked()) return; finished = true; kit.off(); res('exit'); };
      const early = earlyExit(label('cinema'));
      await wait(400);
      if (!mem.seen.cinema) {
        mem.seen.cinema = true;
        await say({ who: 'raccoon', text: 'Вы киномеханика ищете? Это я. Солнце? Не видел. У нас мелодрама, я весь сеанс плакал. А потом свет погас и кадр замер. И вот я плачу уже по другой причине.' });
        suspicion(12, 'Платочек у свидетеля мокрый насквозь.');
        goose.style.opacity = '1'; goose.style.transform = 'translateY(0)';
        await wait(500);
        await say({ who: 'goose', text: 'ГА! А злодей-то в конце…' });
        goose.style.transform = 'translate(240px, 10px) rotate(12deg)'; goose.style.opacity = '0';
        sfx('wrong');
        await stageDirection(['(Енот выносит Финалыча из зала. Финалыч продолжает кричать концовку.)', '(Енот возвращается в будку. На экране кто-то плачет. Енот присоединяется.)']);
        await say([
          { text: 'Финалыча выгнали. В 214-й раз. Кажется, он воспринимает это как абонемент.' },
          { who: 'raccoon', text: 'Он даже погоду спойлерит. «ГА! Завтра дождь!»' },
        ]);
        if (st.bouquet) await say({ who: 'raccoon', text: 'Цветы! Как в финале моего любимого фильма… Всё, не могу, сейчас заплачу.' });
      } else {
        await say({ who: 'raccoon', text: 'Вы снова здесь? Отлично. А то я уже начал обсуждать кадр с попкорном.' });
      }
      if (early.settle()) { if (m.found.size === 0) mem.seen.cinema = false; finished = true; kit.off(); res('exit'); return; }
      G.setHud({ label: label('cinema'), onExit: exit });

      const F = { get busy() { return busy; }, set busy(v) { busy = v; }, get finished() { return finished; }, set finished(v) { finished = v; } };
      const fp = framePuzzle(frame, kit, m, F, skipped => done(skipped));
      finishAll = skipped => fp.finishAll(skipped);
      async function done(skipped) {
        G.setHud({ label: label('cinema') }); mem.cinema = null;
        G.haptic('success'); confetti();
        frame.querySelector('.frame-tag').textContent = '▶ кадр снова движется';
        await say({ text: skipped
          ? 'Плёнка снова идёт. Иногда даже величайшим сыщицам помогает кнопка «Пропустить».'
          : 'Кадр снова движется! Сцена спасена. Енот рыдает от счастья. Ну или по привычке.' });
        suspicion(21, 'Финалыч впервые не успел рассказать концовку.');
        await G.giveSticker('film', 'На плёнке проступила вывеска бюро переводов. Кажется, следующий адрес найден.');
        res();
      }
    });
  }

  /* ---------- БЮРО ПЕРЕВОДОВ ---------- */
  const BUREAU_WORDS = [
    { id: 'symp', en: 'sympathetic', wrong: 'симпатичный', right: 'сочувствующий',
      parrot: 'Он пишет, что очень симпатичный! Согласитесь, смелое заявление.', hero: 'Самооценка — десять из десяти. Перевод — пересдача.', ok: 'Sympathetic — «сочувствующий». А комплимент отменяется.' },
    { id: 'mag', en: 'magazine', wrong: 'магазин', right: 'журнал',
      parrot: 'В магазине солнце закончилось. Могу предложить фонарик.', hero: 'А скидка на солнце по карте есть?', ok: 'Magazine — «журнал». Солнце на обложке, видимо, тоже скрывается.' },
    { id: 'cab', en: 'cabinet', wrong: 'кабинет', right: 'шкаф',
      parrot: 'Перевожу: немедленно зайдите в кабинет министров.', hero: 'Нет, спасибо. Начнём с мебели попроще.', ok: 'Cabinet — «шкаф». Министры могут не беспокоиться.' },
    { id: 'acc', en: 'accurately', wrong: 'аккуратно', right: 'точно',
      parrot: 'Я переводил аккуратно! Даже запятые ровно стоят.', hero: 'Красиво написано. Жаль, совсем не то.', ok: 'Accurately — «точно». Попугай, ну ты ирония в перьях.' },
  ];
  const BUREAU_LOST = [['the', 'Артикль the. В русском ему не нашлось работы. Сидит здесь, составляет резюме.'],
    ['ё', 'Буква «ё». Требует, чтобы её перестали заменять кем попало.'],
    ['☁', 'Английская шутка. Перевели. Перестали смеяться. Положили обратно.'],
    ['✦', 'Найден смысл! Попугай просит не трогать: он его только что придумал.']];
  const bureauTr = fixed => {
    const f = id => fixed.has(id);
    return `Перевод стажёра: «Дорогой детектив, ${f('symp') ? 'я вам очень <b>сочувствую</b>' : 'я очень <b>симпатичный</b>'}, но солнца нет в ${f('mag') ? '<b>журнале</b>' : '<b>магазине</b>'}. Загляните в ${f('cab') ? '<b>шкаф</b>' : '<b>кабинет</b>'}. P.S. Переводите ${f('acc') ? '<b>точно</b>' : '<b>аккуратно</b>'}».`;
  };
  const bureauNoteHTML = () => { const ff = w => `<span class="ff pulse" data-w="${w.id}">${w.en}</span>`, W = BUREAU_WORDS;
    return `<div class="note-paper">Dear Detective,<br/>I am very ${ff(W[0])}, but the sun is not in the ${ff(W[1])}. Look in the ${ff(W[2])}.<br/>P.S. Translate ${ff(W[3])}.</div><div class="trans-line" id="tr"></div>`; };
  // записка с «ложными друзьями переводчика»: жёлтые слова → выбор перевода; onDone() — когда исправлены все четыре
  function notePuzzle(root, kit, m, F, onDone) {
    const fixed = m.fixed, words = BUREAU_WORDS, trEl = root.querySelector('#tr');
    const tr = () => bureauTr(fixed);
    trEl.innerHTML = tr();
    fixed.forEach(id => { const sp = root.querySelector(`.ff[data-w="${id}"]`); if (sp) { sp.classList.remove('pulse'); sp.classList.add('ok'); } });
    dots(kit.dots, fixed.size, 4);
    root.querySelectorAll('.ff').forEach(span => span.addEventListener('click', async () => {
      if (F.busy || F.finished) return;
      const w = words.find(x => x.id === span.dataset.w);
      if (fixed.has(w.id)) return;
      F.busy = true; haptic('light'); sfx('tap');
      const opts = shuffle([{ label: w.wrong, value: false }, { label: w.right, value: true }]);
      const v = await choose(`В этой записке ${w.en} — это…`, opts.map(o => ({ label: o.label, value: o.value, cls: 'soft' })));
      if (v) {
        fixed.add(w.id); span.classList.remove('pulse'); span.classList.add('ok');
        haptic('success'); sfx('ok'); sparkleAt(span, { n: 8, dist: 40 });
        trEl.innerHTML = tr(); dots(kit.dots, fixed.size, 4);
        if (fixed.size === 4) { F.busy = false; onDone(); return; }
        toast(w.ok, 2400);
      } else {
        haptic('error'); sfx('wrong');
        await say([{ who: 'parrot', text: w.parrot }, { who: 'hero', text: w.hero }]);
        await kit.miss();
      }
      F.busy = false;
    }));
  }
  // после записки: P.P.S. «took off», вывод и подводка к шкафу (общая часть 2D и 3D)
  async function bureauAfter(skipped, noteEl) {
    await say({ who: 'parrot', text: skipped ? 'Ладно. Я всё-таки открою словарь. Без паники.' : 'Понял! Я бы и сам всё исправил. Примерно к декабрю.' });
    if (!skipped) suspicion(33, 'Попугай признал ошибку. Исторический момент.');
    if (noteEl && !noteEl.querySelector('.pps')) { noteEl.insertAdjacentHTML('beforeend', '<div class="pps">P.P.S. The sun just took off.</div>'); await wait(500); }
    else if (!noteEl) await say({ text: 'На обороте записки — приписка: «P.P.S. The sun just took off».' });
    await say({ who: 'parrot', text: 'О, я знаю! Солнце…' });
    const v = await choose('The sun just took off — солнце…', [
      { label: 'сняло шляпу', value: 'hat', cls: 'soft' }, { label: 'взлетело', value: 'fly', cls: 'soft' },
      { label: 'внезапно прославилось', value: 'fame', cls: 'soft' }, { label: 'смылось', value: 'gone', cls: 'soft' }]);
    if (v === 'hat') await say([{ who: 'parrot', text: 'Сняло шляпу!' }, { who: 'fox', text: 'Где ты здесь увидел шляпу?' }].concat(S().catHelper ? [{ who: 'cat', text: 'Мою шляпу вообще никто не обсуждал.' }] : []));
    else if (v === 'fly') await say({ who: 'parrot', text: 'Взлетело! Значит, искать надо наверху!' });
    else if (v === 'fame') await say({ who: 'hero', text: 'Знаменитость. Теперь даже солнце не дозовёшься.' });
    else await say({ who: 'fox', text: 'По смыслу подходит. По тону — весьма.' });
    await say([{ text: 'Всё, кроме шляпы, годится. Шляпу попугай явно придумал сам.' }, { who: 'hero', text: 'Итак, солнце куда-то взлетело. Надо искать выше.' }]);
    await say({ who: 'fox', text: 'Стоп, у нас же шкаф! Кстати, magazine и «магазин» — родня: оба от арабского «склады».' });
  }
  // шкаф, свиток и опись стирки
  async function bureauCabinet() {
    await cabinetModal();
    await say([{ who: 'fox', text: 'Двести лет хранили опись стирки. Ну что ж, секрет действительно хорошо сохранился.' }]
      .concat([{ who: 'hero', text: 'Вместо древней тайны — чек на латте. Я слегка разочарована.' }, { who: 'parrot', text: 'А второй носок искать будем? Я готов.' }, { who: 'fox', text: 'Нет. Это дело не по зубам даже нам.' }]));
    await G.giveSticker('scroll', 'На обороте описи — чек из кондитерской «Сахарная пудра».');
  }
  function bureau() {
    return new Promise(async res => {
      const words = BUREAU_WORDS;
      const m = mem.bureau || (mem.bureau = { fixed: new Set() });
      const fixed = m.fixed;
      const tr = () => bureauTr(fixed);
      const ff = w => `<span class="ff pulse" data-w="${w.id}">${w.en}</span>`;
      const scr = show(`
        <div class="loc-title" style="color:#2F3A5A">Lost in Translation</div>
        <div class="top-space" style="height:calc(108px + var(--safe-top))"></div>
        <div class="note-paper">Dear Detective,<br/>I am very ${ff(words[0])}, but the sun is not in the ${ff(words[1])}. Look in the ${ff(words[2])}.<br/>P.S. Translate ${ff(words[3])}.</div>
        <div class="trans-line" id="tr"></div>
        <div class="puzzle-bar" id="pbar" style="position:relative;left:auto;right:auto;margin:6px 14px 0"></div>
        <div class="stage-area">
          <div class="char bob">${Art.parrot()}</div>
          <div class="char bob" style="animation-delay:-1.2s">${Art.fox()}</div>
        </div>
        <div class="counter-block" style="background:#C9AA8B">${Art.counter('bureau')}
          <button class="lost-box" id="lostBox" aria-label="Потеряно при переводе"><svg viewBox="0 0 80 64"><rect x="8" y="22" width="64" height="38" rx="4" fill="#D9B88F"/><path d="M8,22 L18,10 L62,10 L72,22 Z" fill="#E7C9A0"/>
            <path d="M40,10 L40,60 M8,40 L72,40" stroke="#8A6A55" stroke-width="2.4"/><rect x="46" y="44" width="20" height="11" rx="2" fill="#FFFDF9"/><text x="56" y="52" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="5" fill="#8A6A55">?!</text></svg>
            <span class="lost-tag">ПОТЕРЯНО ПРИ ПЕРЕВОДЕ</span><i class="lost-pop" id="lostPop"></i></button>
        </div>`, 'loc bureau loc-flex');
      G.setHud({ label: label('bureau') }); G.tgHeader(LIGHT);
      const trEl = scr.querySelector('#tr');
      trEl.innerHTML = tr();
      const kit = hintKit(scr, {
        dark: true, task: 'Нажми на жёлтые слова и помоги с переводом',
        hint: 'Эти слова похожи на русские, но это ловушка. Не верь первым впечатлениям.',
        onSkip: () => finish(true),
      });
      fixed.forEach(id => { const sp = scr.querySelector(`.ff[data-w="${id}"]`); if (sp) { sp.classList.remove('pulse'); sp.classList.add('ok'); } });
      dots(kit.dots, fixed.size, 4);
      const LOST = BUREAU_LOST;
      let lostI = 0;
      scr.querySelector('#lostBox').addEventListener('click', e => {
        e.stopPropagation(); haptic('light');
        const [glyph, msg] = LOST[lostI++ % LOST.length], pop = scr.querySelector('#lostPop');
        pop.textContent = glyph; pop.classList.remove('go'); void pop.offsetWidth; pop.classList.add('go'); toast(msg, 3000);
      });
      let finished = false, busy = false;
      const exit = () => { if (finished || busy || blocked()) return; finished = true; kit.off(); res('exit'); };
      const early = earlyExit(label('bureau'));
      await wait(400);
      if (!mem.seen.bureau) {
        mem.seen.bureau = true;
        await say([
          { who: 'parrot', text: 'Здравствуйте! Я переводчик. То есть стажёр. То есть меня пока не выгнали.' },
          { who: 'hero', text: 'Пока ты делаешь мне головную боль.' },
          { who: 'parrot', text: 'Я уже перевёл записку похитителя. Очень точно! Ну… я так чувствую.' },
          ...(S().bouquet ? [{ who: 'parrot', text: 'О, какой красивый… пучок? Нет, «букет»! Запишите, у меня прогресс.' }] : []),
          { who: 'fox', text: 'Я принесла словарь. На всякий случай. Попугай сегодня особенно уверен в себе.' },
          { who: 'hero', text: 'Оставь. Может, ему пригодится.' },
        ]);
      } else {
        await say({ who: 'parrot', text: 'Вы вернулись! Я решил больше ничего не переводить без свидетелей.' });
      }
      if (early.settle()) { if (!m.fixed.size) mem.seen.bureau = false; finished = true; kit.off(); res('exit'); return; }
      G.setHud({ label: label('bureau'), onExit: exit });
      const F = { get busy() { return busy; }, set busy(v) { busy = v; }, get finished() { return finished; }, set finished(v) { finished = v; } };
      notePuzzle(scr, kit, m, F, () => finish(false));
      async function finish(skipped) {
        if (finished) return; finished = true; kit.off();
        G.setHud({ label: label('bureau') }); mem.bureau = null;
        words.forEach(w => fixed.add(w.id));
        scr.querySelectorAll('.ff').forEach(s => { s.classList.remove('pulse'); s.classList.add('ok'); });
        trEl.innerHTML = tr(); dots(kit.dots, 4, 4);
        confetti();
        await bureauAfter(skipped, scr.querySelector('.note-paper'));
        await bureauCabinet();
        res();
      }
    });
  }

  /* ---------- КОНДИТЕРСКАЯ ---------- */
  const SWEETS_WIT = [
    { id: 'cinnabon', name: 'Булочка', say: '«Солнце унесли на крышу»', art: o => Art.cinnabon(o) },
    { id: 'macaron', name: 'Макарон', say: '«Булочка говорит правду»', art: o => Art.macaron(o) },
    { id: 'bubbletea', name: 'Бабл-ти', say: '«Макарон врёт»', art: o => Art.bubbletea(o) },
  ];
  const witnessHTML = () => `<div class="showcase"><div class="witnesses">
    ${SWEETS_WIT.map(w => `<button class="witness" data-w="${w.id}"><div class="char w-art bob" style="animation-delay:${Math.random() * -2}s">${w.art({})}</div><div class="w-name">${w.name}</div><div class="w-say">${w.say}</div></button>`).join('')}
  </div></div>`;
  // ровно один свидетель врёт: нажать на него; onSolved(btn) — когда пойман бабл-ти
  function witnessPuzzle(root, kit, F, onSolved) {
    root.querySelectorAll('.witness').forEach(b => b.addEventListener('click', async () => {
      if (F.busy || F.finished) return;
      F.busy = true; haptic('light');
      const id = b.dataset.w;
      if (id === 'bubbletea') { F.busy = false; onSolved(b); return; }
      b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 450);
      haptic('error'); sfx('wrong');
      await say({ text: id === 'cinnabon'
        ? 'Если булочка врёт, макарон тоже: он ведь уверяет, что она честна. А лжец должен быть один.'
        : 'Если соврал макарон, булочка тоже должна врать. Получается двое. Не подходит.' });
      await kit.miss();
      F.busy = false;
    }));
  }
  async function sweetsAfter() {
    await say([
      { who: 'bubbletea', text: 'Ладно, это я соврал. Но прежде чем осуждать, посмотрите на мои жемчужинки.' },
      { who: 'bunny', text: 'Ага! Значит, булочка сказала правду: солнце унесли на крышу.' },
    ]);
    await G.giveSticker('desserts', 'Показания сходятся: солнце унесли на крышу.');
    await drinkBuilder();
  }
  function sweets() {
    return new Promise(async res => {
      const wit = SWEETS_WIT;
      const scr = show(`
        <div class="loc-title" style="color:#C2405B">«Сахарная пудра»</div>
        <div class="top-space" style="height:calc(104px + var(--safe-top))"></div>
        <div class="showcase"><div class="witnesses">
          ${wit.map(w => `<button class="witness" data-w="${w.id}"><div class="char w-art bob" style="animation-delay:${Math.random() * -2}s">${w.art({})}</div><div class="w-name">${w.name}</div><div class="w-say">${w.say}</div></button>`).join('')}
        </div></div>
        <div class="puzzle-bar" id="pbar" style="position:relative;left:auto;right:auto;margin:16px 14px 0"></div>
        <div class="stage-area" style="justify-content:flex-start;padding-left:10%">
          <div class="char bob" id="bunnyChar">${Art.bunny()}</div>
          <button class="menu-board" id="menuBoard" aria-label="Меню дня"><span class="hand">Меню дня</span><svg viewBox="0 0 40 24"><path d="M6,10 L34,10 L30,22 L10,22 Z" fill="none" stroke="#F3EFE8" stroke-width="2"/><path d="M6,10 Q20,2 34,10" stroke="#F3EFE8" stroke-width="2" fill="none"/></svg></button>
        </div>
        <div class="counter-block" style="background:#F8CBD5">${Art.counter('sweets')}</div>`, 'loc sweets loc-flex');
      G.setHud({ label: label('sweets') }); G.tgHeader(LIGHT);
      const kit = hintKit(scr, {
        dark: true, task: 'Врёт только один из трёх. Кто?',
        hint: 'Проверь каждого: если он врёт, могут ли остальные двое говорить правду?',
        onSkip: () => solved(true),
      });
      dots(kit.dots, 0, 1);
      let finished = false, busy = false;
      const exit = () => { if (finished || busy || blocked()) return; finished = true; kit.off(); res('exit'); };
      const early = earlyExit(label('sweets'));
      await wait(400);
      if (!mem.seen.sweets) {
        mem.seen.sweets = true;
        await say({ who: 'bunny', text: 'Заходи! Свидетели на витрине. Прошу не есть их до окончания допроса.' });
        if (S().bouquet) await say({ who: 'bunny', text: 'Какие цветы! Только осторожнее с булочкой: она на красоту очень впечатлительная.' });
      } else {
        await say({ who: 'bunny', text: 'Ты вернулась! Отлично. Бабл-ти уже собирался менять показания.' });
      }
      if (early.settle()) { mem.seen.sweets = false; finished = true; kit.off(); res('exit'); return; }
      G.setHud({ label: label('sweets'), onExit: exit });
      scr.querySelector('#menuBoard').addEventListener('click', e => { e.stopPropagation(); haptic('light'); toast('Меню дня: хлеб без хлеба. Зайка называет это высокой кухней. Я называю это соусом.', 3400); });
      const F = { get busy() { return busy; }, set busy(v) { busy = v; }, get finished() { return finished; }, set finished(v) { finished = v; } };
      witnessPuzzle(scr, kit, F, b => solved(false, b));
      async function solved(skipped, btn) {
        if (finished) return; finished = true; kit.off();
        G.setHud({ label: label('sweets') });
        const bt = btn || scr.querySelector('[data-w="bubbletea"]');
        bt.classList.add('picked');
        bt.querySelector('.w-art').innerHTML = Art.bubbletea({ mouth: 'wobble' });
        dots(kit.dots, 1, 1);
        haptic('success'); sfx('ok'); sparkleAt(bt, { n: 12, dist: 60 });
        await sweetsAfter();
        res();
      }
    });
  }
  function drinkBuilder() {
    return new Promise(async res => {
      const st = S();
      const BASES = [['milk', 'молочный чай', '#D9B08C'], ['matcha', 'матча', '#A9C98A'], ['noir', 'кофе без надежды (чёрный)', '#4A3128'], ['surprise', 'удиви меня', '#F3A6C0']];
      const TOPS = [['pearls', 'тапиока'], ['marsh', 'взбитые сливки'], ['none', 'ничего']];
      const SUGAR = [['0', '0 ложек'], ['2', '2 ложки'], ['1e6', 'миллион ложек (не надо)']];
      const d = { base: 'milk', top: 'pearls', sugar: '2' };
      const liquid = () => BASES.find(b => b[0] === d.base)[2];
      const shortName = G.herName().slice(0, 10);
      // хлопок шефа: витрина замирает
      const bunnyEl = document.querySelector('#bunnyChar');
      document.querySelectorAll('.witness .w-art').forEach(w => { w.style.animationPlayState = 'paused'; });
      if (bunnyEl) { bunnyEl.classList.add('clap'); sparkleAt(bunnyEl, { n: 6, dist: 34 }); }
      haptic('medium'); sfx('tap');
      await say([
        { text: 'Зайка хлопает в лапки. Десерты мгновенно делают вид, что всегда вели себя прилично.' },
        { who: 'bunny', text: 'А теперь — напиток! После допроса сладостей ты заслужила что-нибудь нормальное.' },
      ]);
      document.querySelectorAll('.witness .w-art').forEach(w => { w.style.animationPlayState = ''; });
      if (bunnyEl) bunnyEl.classList.remove('clap');
      await say({ who: 'bunny', text: 'Напиток за мой счёт. Выбирай, что налить.' });
      const chips = (arr, key) => arr.map(([v, l]) => `<button class="chip ${d[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('');
      const scr = show(`
        <div class="grow casting pad" style="padding-top:calc(78px + var(--safe-top));padding-bottom:calc(16px + var(--safe-bottom))">
          <div class="title h2" style="text-align:center">Напиток за мой счёт</div>
          <div class="char cup-preview float" id="cup" style="margin-top:10px">${Art.bubbletea({ liquid: liquid(), top: d.top, name: shortName, face: false })}</div>
          <div class="builder" style="margin-top:6px">
            <div class="opt-label">Основа</div><div class="opts">${chips(BASES, 'base')}</div>
            <div class="opt-label">Добавка</div><div class="opts">${chips(TOPS, 'top')}</div>
            <div class="opt-label">Сахар</div><div class="opts">${chips(SUGAR, 'sugar')}</div>
          </div>
          <button class="btn block sticky-cta" id="ok" style="margin-top:18px">Готово</button>
        </div>`, 'loc sweets');
      const cup = scr.querySelector('#cup');
      scr.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
        haptic('select'); sfx('tap');
        d[b.dataset.k] = b.dataset.v;
        scr.querySelectorAll(`.chip[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b));
        cup.innerHTML = Art.bubbletea({ liquid: liquid(), top: d.top, name: shortName, face: false });
        cup.classList.remove('hop'); void cup.offsetWidth; cup.classList.add('hop');
      }));
      let clicked = false;
      scr.querySelector('#ok').addEventListener('click', async () => {
        if (clicked) return; clicked = true;
        haptic('medium'); sfx('ok');
        st.drink = { base: d.base, top: d.top, sugar: d.sugar, liquid: liquid(), label: BASES.find(b => b[0] === d.base)[1] };
        G.save();
        if (d.sugar === '1e6') await say({ who: 'bunny', text: 'Миллион? Положу две. Я же кондитер, а не злодей.' });
        else if (d.base === 'noir') await say({ who: 'bunny', text: 'Чёрный кофе? Ясно, главная героиня сегодня в нуаре.' });
        suspicion(47, 'Имя на стакане написали правильно. Это точно сказка.');
        const sy = await choose('Что-нибудь ещё?', [{ label: 'А можно обычный сырник?', value: true, cls: 'soft' }, { label: 'Нет, всё идеально', value: false, cls: 'soft' }], { who: 'bunny' });
        if (sy) { st.syrnik = true; G.save(); await say([{ who: 'hero', text: 'Сырник, пожалуйста. Обычный. Я верю в простые радости.' }, { who: 'bunny', text: '(прослезившись) Наконец-то человек, который понимает мою кухню.' }]); }
        else { st.syrnik = false; G.save(); await say({ who: 'bunny', text: 'Тогда официально желаю приятного аппетита!' }); }
        await receipt();
        res();
      });
    });
  }
  function receipt() {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card" style="background:#FFFDF9;max-width:320px;border-radius:10px;padding:20px 18px;font-family:'Courier New',monospace;text-align:left">
          <div style="text-align:center;font-weight:900;letter-spacing:.1em">САХАРНАЯ ПУДРА</div>
          <div style="text-align:center;font-size:12px;margin-bottom:10px">кассовый чек · следствие</div>
          <div style="border-top:2px dashed #E3D3D8;margin:8px 0"></div>
          <div class="row" style="justify-content:space-between;font-weight:700"><span>Напиток следователя</span><span>1 шт</span></div>
          <div class="row" style="justify-content:space-between;font-weight:700"><span>Показания десертов</span><span>3 шт</span></div>
          ${S().syrnik ? `<div class="row" style="justify-content:space-between;font-weight:700"><span>Сырник. Просто сырник</span><span>1 шт</span></div>` : ''}
          <div style="border-top:2px dashed #E3D3D8;margin:8px 0"></div>
          <div style="font-weight:900;text-align:center;margin:8px 0">Оплачено заведением. Чаевые — коту, если он настаивает.</div>
          ${S().syrnik ? `<div style="font-weight:900;text-align:center;margin:-2px 0 8px">Сырник с собой. И ничего лишнего. <span style="color:#F08FA8">♥</span></div>` : ''}
          ${C.ENABLE_RECEIPT_FACT ? `<div style="font-size:12px;color:#6E6272;text-align:center;line-height:1.35">Макарон и макароны — родня: оба восходят к итальянскому maccarone. Макарон просил не распространяться.</div>` : ''}
          <div style="font-size:12px;color:#6E6272;text-align:center;line-height:1.35;margin-top:6px">Булочка попросила приложить к чеку охранную грамоту. Мы обещали подумать.</div>
          <button class="btn block sticky-cta" style="margin-top:14px;font-family:var(--font)">Спасибо!</button>
        </div>`;
      G.layer.appendChild(m);
      let closed = false;
      m.querySelector('.btn').addEventListener('click', () => { if (closed) return; closed = true; haptic('light'); m.classList.add('out'); setTimeout(() => { m.remove(); res(); }, 250); });
    });
  }

  /* ---------- КРЫША (клиффхэнгер) ---------- */
  const ROOF_ECHO = [
    { hero: 'Эй! Кто-нибудь живой?', echo: '…живой… живой…', cat: 'Я здесь, но меня не вызывали.', alt: 'Эхо повторяет последнее. Удобно ему.' },
    { hero: 'Это всё-таки проделки кота?', echo: '…кота… кота…', cat: 'Пока нет доказательств, я сплю спокойно.', alt: 'Кот на батарее. Подозрения отложены до его пробуждения.' },
    { hero: 'А ступеньки хоть когда-нибудь вернутся?', echo: '…вернутся… вернутся…' },
  ];
  const ECHO_NYMPH = 'Эхо, кстати, в древних мифах была нимфой. И даже мифология не придумала, как заставить её ответить по существу.';
  async function roofAfterNote() {
    suspicion(99, 'У чашки чая на удивление много власти.');
    await G.giveSticker('note', 'Вместо подписи — чашка. У преступника явно свой стиль.');
    await say({ who: 'cat', text: 'Чай. Ну конечно. Это многое объясняет. Ничего не объясняет.' });
    if ((S().finds || []).includes('blueSaucer')) await say({ who: 'cat', text: 'Мы нашли блюдце, а тут чашка. Если они встретятся — я ухожу в отпуск.' });
  }
  function roof() {
    return new Promise(async res => {
      const st = S();
      const W = G.app.clientWidth;
      const bw = buildingWidth(), bh = bw * 404 / 300;
      const left = (W - bw) / 2;
      const noteW = bw * .16;
      const scr = show(`
        <div class="sky" style="position:absolute;inset:0;background:linear-gradient(180deg,#BDB2D2 0%,#F2DAE0 100%)"></div>
        <div class="sun-slot" style="right:22px;top:calc(86px + var(--safe-top))">здесь<br/>было<br/>солнце</div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:15%;background:repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,255,255,.22) 46px 48px),linear-gradient(180deg,#A9B0BA 0 10px,#BCC3CC 10px 100%)"></div>
        <div style="position:absolute;left:0;right:0;bottom:15%;height:8px;background:#9AA2AD"></div>
        <div style="position:absolute;left:${left}px;width:${bw}px;bottom:calc(15% + 8px)">${Art.roofB({ broken: true, note: false })}
          <div id="note" class="char" style="position:absolute;width:${noteW}px;left:${bw * 220 / 300}px;bottom:${bh * 3 / 404}px;cursor:pointer;opacity:0;transition:opacity .4s">${Art.noteMini()}</div>
        </div>
        <div class="char" style="position:absolute;width:74px;left:${left + bw * .3}px;bottom:calc(15% - 16px)">${heroArt({ cup: st.drink || null, mood: 'think', bouquet: st.bouquet || null })}</div>
        ${st.catHelper ? `<div class="char bob" style="position:absolute;width:44px;left:${left + bw * .3 - 46}px;bottom:calc(15% - 12px)">${Art.cat()}</div>` : ''}`, 'loc roofside');
      G.setHud({ label: label('roof') }); G.tgHeader(LIGHT);
      let gone = false;
      const early = earlyExit(label('roof'));
      await wait(500);
      if (!mem.seen.roof) {
        mem.seen.roof = true;
        await say({ who: 'cat', text: 'Так. Крыша есть. Перила есть. А ступенек нет. Табличка: «Ушли на обед». Великолепная организация пространства.' });
      } else {
        await say({ who: 'cat', text: 'Удивительно: мы вернулись, а ступеньки — нет.' });
      }
      if (early.settle()) { mem.seen.roof = false; gone = true; res('exit'); return; }
      const note = scr.querySelector('#note');
      G.setHud({ label: label('roof'), onExit: () => { if (blocked() || gone) return; gone = true; res('exit'); } });
      // эхо в пустом пролёте (необязательно)
      const chip = document.createElement('button'); chip.className = 'echo-chip';
      chip.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3,10 L3,14 L7,14 L13,19 L13,5 L7,10 Z" fill="#C2405B"/><path d="M16,8 Q19,12 16,16 M18.5,5.5 Q23.5,12 18.5,18.5" stroke="#C2405B" stroke-width="2" fill="none" stroke-linecap="round"/></svg>Крикнуть в пролёт`;
      chip.style.left = (left + bw * 0.63) + 'px'; chip.style.bottom = `calc(15% + ${bh * 0.14 + 10}px)`;
      scr.appendChild(chip);
      const ECHO = ROOF_ECHO;
      let ei = 0, echoBusy = false;
      const flyEcho = t => { const e2 = document.createElement('div'); e2.className = 'echo-word'; e2.textContent = t; e2.style.left = (left + bw * 0.7) + 'px'; e2.style.bottom = `calc(15% + ${bh * 0.25}px)`; scr.appendChild(e2); setTimeout(() => e2.remove(), 1500); };
      chip.addEventListener('click', async e => {
        e.stopPropagation(); if (echoBusy || gone) return; echoBusy = true; haptic('light');
        const E = ECHO[ei++];
        await say({ who: 'hero', text: E.hero }); flyEcho(E.echo); await wait(1100);
        if (E.cat) await say(st.catHelper ? { who: 'cat', text: E.cat } : { text: E.alt });
        if (ei >= ECHO.length) { chip.remove(); await say({ text: ECHO_NYMPH }); }
        echoBusy = false;
      });
      note.style.opacity = '1'; note.classList.add('pulse');
      toast('На двери записка — нажми на неё', 2600);
      await G.tapOnce(note);
      if (gone) return;
      gone = true;
      G.setHud({ label: label('roof') });
      note.classList.remove('pulse');
      await noteModal();
      await roofAfterNote();
      chip.remove();
      res();
    });
  }
  function noteModal() {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card" style="background:#FFFBF2;border-radius:6px;transform:rotate(-1.5deg);text-align:left;padding:24px 22px">
          <div class="hand" style="font-size:clamp(22px, 4.2vh, 30px);line-height:1.12;color:#3B2F4F">
            Следователь,<br/>вы быстрее, чем я рассчитывал.<br/>Ступеньки вернутся. Не сразу: обед у них долгий.<br/><br/>
            А пока вопрос: что можно заварить, но нельзя выпить?<br/><br/>
            P.S. Солнце в порядке. Сидит, пьёт чай. Да, серьёзно.
          </div>
          <div style="width:64px;margin:8px 0 0 auto"><svg viewBox="0 0 60 60">${Art.teacup('#3B2F4F', 2.6)}</svg></div>
          <button class="btn block sticky-cta" style="margin-top:10px">Подшить к делу</button>
        </div>`;
      G.layer.appendChild(m);
      sfx('drum'); haptic('medium');
      let closed = false;
      m.querySelector('.btn').addEventListener('click', () => { if (closed) return; closed = true; haptic('light'); m.classList.add('out'); setTimeout(() => { m.remove(); res(); }, 250); });
    });
  }

  /* ---------- ВЕРСИЯ СЛЕДСТВИЯ ---------- */
  async function version() {
    const st = S();
    G.setHud({ hidden: true }); G.tgHeader(DARK);
    show(`<div class="grow col pad" style="background:linear-gradient(180deg,#2F2834,#4A3550);color:#FFF4EC;align-items:center;text-align:center;padding-top:calc(40px + var(--safe-top))">
      <div class="char float" style="width:96px">${Art.stNote()}</div>
      <div class="title h2" style="margin-top:8px">Версия следствия</div>
      <p style="opacity:.8;font-weight:700;margin-top:6px">Кто всё это устроил? Выбери подозреваемого. В финале проверим твою версию.</p></div>`);
    await wait(300);
    const v = await choose('И всё-таки: кто стоит за пропажей солнца?', [
      { label: 'Кот Пирожок', value: 'cat', cls: 'soft' },
      { label: 'Попугай-стажёр', value: 'parrot', cls: 'soft' },
      { label: 'Енот-киномеханик', value: 'raccoon', cls: 'soft' },
      { label: 'Гусь Финалыч из третьего ряда', value: 'goose', cls: 'soft' },
      { label: 'Сценарист (слишком много чая)', value: 'author', cls: 'soft' },
      { label: 'Своя версия…', value: 'own', cls: 'powder' },
    ]);
    let text = { cat: 'Кот Пирожок', parrot: 'Попугай-стажёр', raccoon: 'Енот-киномеханик', goose: 'Гусь Финалыч', author: 'Сценарист' }[v];
    if (v === 'own') text = await ask('Твоя версия:', { placeholder: 'Например: синоптики', max: 60, ok: 'Подшить' }) || 'Секрет следствия';
    st.versions[1] = text; G.save();
    const react = {
      cat: { who: 'cat', text: 'Я? Как тебе не стыдно. Я весь день был красивый.' },
      parrot: { who: 'parrot', text: 'Подозреваемый? Я прочёл «уважаемый»!' },
      raccoon: { who: 'raccoon', text: 'Я?! Даже утренние сеансы не люблю! Зачем мне ещё и солнце?' },
      goose: { who: 'goose', text: 'Га! Я вам всё расскажу! Но тогда опять выгонят.' },
      author: { text: 'Сценарист от комментариев отказался. Чайник — тоже.' },
      own: { text: 'Версия принята. Посмотрим, кто кого переиграет.' },
    }[v];
    await say(react);
  }

  /* ---------- ОЦЕНКА ---------- */
  function rating() {
    return new Promise(res => {
      const st = S();
      G.tgHeader(DARK);
      const scr = show(`
        <div class="grow col center pad endcard" style="gap:14px">
          <div class="title h2">Оцени серию</div>
          <p style="opacity:.8;font-weight:700">Как тебе первая серия? Сценарист морально готов. Почти.</p>
          <div class="card" style="width:100%">
            <div class="rating">${Array.from({ length: 10 }, (_, i) => `<button data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
            <div class="rating-legend"><span>1 — где кнопка<br/>«верните время»</span><span style="text-align:center">5 — кот<br/>вытянул</span><span style="text-align:right">10 — дайте<br/>следующую серию</span></div>
          </div>
          <div id="react" style="min-height:48px;font-weight:800"></div>
          <button class="btn block hidden" id="next">Дальше</button>
          <button class="link" id="skipRate" style="color:#F7C9D3">без оценки</button>
        </div>`);
      const reactEl = scr.querySelector('#react'), next = scr.querySelector('#next');
      scr.querySelectorAll('.rating button').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n; st.ratings[1] = n; G.save();
        haptic('select'); sfx('tap');
        scr.querySelectorAll('.rating button').forEach(x => x.classList.toggle('on', x === b));
        reactEl.textContent = n <= 4 ? 'Ой. Спасибо за честность. Сценарист пошёл переписывать шутки.'
          : n <= 7 ? 'Принято. Есть над чем поработать. Пирожок предлагает добавить котов.'
          : n <= 9 ? 'Ого! Пирожок требует премию.'
          : '10/10?! Пирожок требует часть славы. Енот уже плачет.';
        if (n === 10) { confetti(); haptic('success'); }
        next.classList.remove('hidden');
      }));
      let doneOnce = false;
      const fin = () => { if (doneOnce) return; doneOnce = true; haptic('medium'); res(); };
      next.addEventListener('click', fin);
      scr.querySelector('#skipRate').addEventListener('click', fin);
    });
  }

  /* ---------- КОНЕЦ СЕРИИ ---------- */
  async function endCard() {
    const st = S(), e = G.ep(1);
    const nxt = C.EPISODES[1];
    G.setHud({ hidden: true }); G.tgHeader(DARK);
    const scr = show(`
      <div class="grow endcard pad col" style="gap:14px;padding-bottom:calc(28px + var(--safe-bottom))">
        <div style="text-align:center;margin-top:6px"><div class="case-badge">Дело №${NB}10/10</div></div>
        <div class="title h1" style="text-align:center">Конец серии&nbsp;1</div>
        <p style="text-align:center;opacity:.85;font-weight:800">${e.recap ? 'Ты прочитала пересказ. Хочешь — теперь гуляй по городу и находи то, что осталось за кадром.' : `Прошла за ${G.fmtTime(e.time || 0)}${st.ratings[1] ? ` · оценка ${st.ratings[1]}/10` : ''}`}</p>
        <div class="ep-next">
          <div class="tiny" style="font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.7">Загадка до серии&nbsp;2</div>
          <div class="hand" style="font-size:26px;line-height:1.15;margin:4px 0 2px">${esc(RIDDLE)}</div>
          <div class="tiny" style="opacity:.7;font-weight:700">Ответ&nbsp;— в серии&nbsp;2. Времени на версию хватит с запасом.</div>
        </div>
        <div class="ep-next">
          <div class="tiny" style="font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.7">Следующая серия</div>
          <div class="title h3" style="margin:4px 0">Серия&nbsp;${nxt.n} «${esc(nxt.title)}»</div>
          <div style="font-weight:800;color:var(--powder)">${esc(whenText(nxt))}</div>
          ${nxt.teaser ? `<p style="margin-top:6px;opacity:.85;font-weight:700">${esc(nxt.teaser)}</p>` : ''}
        </div>
        ${window.Town ? `<button class="btn block" id="town">🏙 Город нараспашку</button>
        <p class="tiny" style="text-align:center;opacity:.7;font-weight:700;margin-top:-6px">Заглядывай в дома, разговаривай с жителями, собирай находки. Тут уже без спешки.</p>` : ''}
        <div class="row" style="gap:10px">
          <button class="btn soft grow" id="nb">📒 Блокнот</button>
          <button class="btn soft grow" id="cr">🎬 Титры</button>
        </div>
        <div class="col" style="align-items:center;gap:6px">
          <button class="link" id="again" style="color:#F7C9D3">пройти заново</button>
          <button class="link" id="inv" style="color:#F7C9D3;opacity:.8">отправить подружке её роль</button>
        </div>
        <p class="tiny" style="text-align:center;opacity:.6;font-weight:700">Никаких обязательных заданий. Даже кот никого не контролирует.</p>
      </div>`);
    const tb = scr.querySelector('#town');
    if (tb) tb.addEventListener('click', () => { if (Town.running) return; haptic('medium'); Town.run({ from: 'end' }).then(endCard); });
    scr.querySelector('#nb').addEventListener('click', () => { haptic('light'); G.notebook(); });
    scr.querySelector('#cr').addEventListener('click', () => { haptic('light'); credits().then(endCard); });
    scr.querySelector('#inv').addEventListener('click', () => { haptic('light'); inviteModal(); });
    scr.querySelector('#again').addEventListener('click', async () => {
      const v = await choose('Пройти серию 1 заново? Образ и команда сохранятся.', [{ label: 'Да, заново', value: true }, { label: 'Нет', value: false }]);
      if (!v) return;
      restart(); run();
    });
  }
  function restart() {
    resetMem();
    const old = G.ep(1), st = S();
    const keep = (old.recap || !st.name) ? [] : ['prologue', 'casting'];
    st.eps[1] = { cp: keep, done: false, start: Date.now(), time: 0 };
    G.save();
  }
  function inviteModal() {
    const st = S();
    const m = document.createElement('div'); m.className = 'modal';
    const row = k => `<button class="team-row" data-k="${k}" style="border:0;width:100%;text-align:left;cursor:pointer"><div class="ava">${G.team[k].art({ crop: true })}</div><div class="grow"><div style="font-weight:900;font-size:17px">${esc(G.teamName(k))}</div><div class="role">${esc(G.team[k].role)}</div></div><span style="font-size:20px">↗</span></button>`;
    m.innerHTML = `
      <div class="modal-card" style="text-align:left">
        <div class="row" style="justify-content:space-between"><div class="title h2">Чью роль отправить?</div><button class="hud-btn" data-x aria-label="Закрыть">✕</button></div>
        <p class="small muted" style="font-weight:700;margin:6px 0 12px">Отправь подруге ссылку — она увидит свою роль и сможет сыграть отдельно.</p>
        <div class="col">${row('bunny')}${row('fox')}${row('hedgehog')}</div>
      </div>`;
    G.layer.appendChild(m);
    const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 250); };
    m.querySelector('[data-x]').addEventListener('click', close);
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, nm = (st.team[k] || '').trim();
      haptic('medium');
      const url = G.inviteLink(k, nm);
      const text = `${nm ? nm + ', ты' : 'Ты'} теперь ${G.team[k].title} в моём «Деле №${NB}10/10» 🕵️‍♀️ Без тебя не раскрыть, заходи:`;
      G.openTgLink(G.shareLink(url, text));
      close();
    }));
  }
  function credits() {
    return new Promise(res => {
      G.tgHeader('#241E28');
      const teamStr = ['bunny', 'fox', 'hedgehog'].map(k => G.teamName(k)).join(', ');
      const fill = s => s.replace(/\{HEROINE\}/, () => G.herName()).replace('{AUTHOR}', () => C.AUTHOR_NAME).replace('{TEAM}', () => teamStr);
      const rows = C.CREDITS.map(([a, b]) => `<p><b>${esc(a)}</b>${esc(fill(b))}</p>`).join('');
      const scr = show(`
        <div class="grow credits film-grain" style="position:relative;overflow:hidden">
          <div class="roll">
            <div class="title h2" style="margin-bottom:26px">Дело №${NB}10/10</div>
            ${rows}
            <p style="margin-top:30px"><b>Серия&nbsp;2</b>${esc(whenText(C.EPISODES[1]))}</p>
            <div class="char" style="width:90px;margin:20px auto 0">${Art.cat({ sleep: true })}</div>
          </div>
          <button class="btn soft" id="back" style="position:absolute;left:50%;transform:translateX(-50%);bottom:calc(20px + var(--safe-bottom))">Назад</button>
        </div>`);
      scr.querySelector('#back').addEventListener('click', () => { haptic('light'); res(); });
    });
  }

  /* ---------- КРАТКИЙ ПЕРЕСКАЗ ---------- */
  async function recap() {
    const st = S();
    if (!st.name) st.name = G.tgUserFirstName() || C.HER_NAME_DEFAULT || '';
    await cards([
      'В городе пропало солнце. На дело вызвали девушку с безупречным образом. Солнце уже нервничает.',
      'В кинотеатре завис кадр: тринадцатый час, невидимая в зеркале ваза и кое-что подозрительно знакомое.',
      'Попугай перевёл послание так, что пришлось спасать не только солнце, но и английский язык.',
      'Три десерта дали показания. Бабл-ти прокололся. След ведёт на крышу.',
      'Но ступеньки куда-то делись. Кто-то оставил на двери загадку и вместо подписи нарисовал чашку чая.',
    ]);
    await castingLook();
    const e = G.ep(1);
    e.recap = true;
    ['prologue', 'casting', 'cinema', 'bureau', 'sweets', 'roof'].forEach(c => { if (!e.cp.includes(c)) e.cp.push(c); });
    G.save();
  }

  /* ---------- ЗАПУСК ---------- */
  // комната дома k: 3D, если устройство тянет, иначе 2D; итог — undefined (раскрыто) или 'exit' (вышла раньше)
  const SCENES = { cinema: [cinema3D, cinema], bureau: [bureau3D, bureau], sweets: [sweets3D, sweets], roof: [roof3D, roof] };
  function scene(k) {
    const f = SCENES[k] || SCENES[{ stairs: 'roof' }[k]];
    if (!f) return Promise.resolve('exit');
    return use3dRooms() && City3D.hasRoom(k) ? f[0]() : f[1]();
  }
  async function run(opts = {}) {
    const e = G.ep(1);
    if (!e.start) { e.start = Date.now(); G.save(); }
    if (opts.recap) await recap();
    // «время расследования»: без боковых визитов в городе (оранжерея, ателье, лавки)
    const sideMs = () => (M() ? M().sideMs() : 0);
    const timed = (id, fn) => G.step(1, id, async () => { const t0 = G.activeNow(), s0 = sideMs(); await fn(); e.time = (e.time || 0) + Math.max(0, Math.min(G.activeNow() - t0 - (sideMs() - s0), 10 * 60 * 1000)); });
    await timed('prologue', prologue);
    await timed('casting', casting);
    const st = S();
    // дома серии по порядку таблицы дел: улица (город) до двери → комната → снова улица
    const LOCS = ORDER.map(k => [k, () => scene(k)]);
    for (const [k, fn] of LOCS) {
      await timed(k, async () => {
        let again = false;
        for (;;) {
          await streetTo(k, { intro: k === ORDER[0] && !st.introDone, again });
          if (k === ORDER[0] && !st.introDone) { st.introDone = true; G.save(); }
          const r = await fn();
          if (r !== 'exit') break;
          again = true;
        }
      });
      if (M()) { const d = M().list(1).find(x => x.street && x.street.target === k); if (d) M().complete(d.id); }
    }
    await G.step(1, 'version', version);
    await G.step(1, 'rating', rating);
    e.done = true; G.save();
    // один раз: город открывается для прогулки (ошибка прогулки серию не ломает)
    try {
      const T = window.Town && Town.state();
      if (T && !T.k.op) { await intertitle('СЛЕДСТВИЕ НА ПАУЗЕ. ГОРОД — В ТВОЁМ РАСПОРЯЖЕНИИ.'); T.k.op = 1; G.save(); }
    } catch (err) { console.warn('town intertitle', err); }
    await endCard();
  }

  window.Ep1 = { run, title, endCard, credits, ruDate, whenText, restart, scene, ORDER };
  // набор для прогулки «Город нараспашку» (js/town.js)
  window.Ep1.kit = { stageFinds, pickFind, flowerCart, bouquetFlow, FINDS, STREET_LINES, intertitle, stageDirection, hintKit, framePuzzle };
})();
