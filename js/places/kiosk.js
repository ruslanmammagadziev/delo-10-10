/* =====================================================================
   Место прогулки: kiosk — Газетный киоск «Октябрьский вестник» (kind 'counter').
   Внутрь не заходят (интерьер — у будущей серии). Тап по киоску на улице →
   open(ctx): нижний лист-газета. Выпуск недели (§9): два заголовка, погода,
   «Знаете ли вы?» (факт засчитывается при открытии), уголок кроссворда
   (✦ n_cross), листание выпусков, «Постучать в окошко» (3-й стук — ✦ n_knock).
   Первое открытие — штамп. В 2D-карточке — точки paper / archive / knock.
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'kiosk';
  const esc = s => G.esc(String(s == null ? '' : s));
  // имя — только после «Помахать» (G.waved из engine.js), иначе «Следователь»
  const waved = () => { try { return typeof G.waved === 'function' && !!G.waved(); } catch (e) { return false; } };

  const ISSUES = [
    { d: 'суббота, 24 октября', f: 'gazeta', h: ['Следователь уже в городе! Местные жители делают вид, что совершенно спокойны.', 'Солнце не вернулось. Горожане требуют скидку на отопление.'] },
    { d: 'суббота, 31 октября', f: 'pumpb', h: ['Фонарь вышел в свет в новом свитере. Остальные фонари обсуждают образ.', 'Тыквы объявили ноябрю бойкот. Ноябрь пока не ответил.'] },
    { d: 'суббота, 7 ноября', f: 'leaves', h: ['Енот посмотрел комедию и заплакал. Говорит, смешно и обидно одновременно.', 'Пирожок признал себя котом года. Конкурентов к голосованию не допустили.'] },
    { d: 'суббота, 14 ноября', f: 'wool', h: ['Мимоза опять свернула листья. Жители просят не трогать интроверта.', 'В книжной лавке новая глава. Финалычу не выдали последний лист.'] },
    { d: 'суббота, 21 ноября', f: 'graph', h: ['Первый иней. Голуби официально переходят на зимнюю походку.', 'Финалыч устроился в музыкальный магазин. У музыкантов началась тревога.'] },
    { d: 'суббота, 28 ноября', f: 'snow', h: ['Снеговик прошёл собеседование. Провалил вопрос о стрессоустойчивости.', 'Голуби на снегу оставили следы. По их версии, это современное искусство.'] },
    { d: 'суббота, 5 декабря', f: 'rubber', h: ['Город зажёг гирлянды. Солнцу передали: можем и без тебя, но лучше возвращайся.', 'Поиски солнца продолжаются. Фонари требуют премию за переработки.'] },
  ];
  const KNOCK = ['Тук-тук. За окошком подозрительная тишина.', 'Тук-тук. За ставней зашуршали газеты. Или упаковка от печенья.'];
  const KNOCK3 = 'Из-за ставни: «У нас совещание!» И хруст печенья на весь квартал.';
  const KNOCK_MORE = 'Из-за ставни: «Мы всё ещё обсуждаем важное!» Хрустит громче.';

  Town.style(P, `
.kz-sheet .sheet-card { background: #FFFDF9; }
.kz-paper { font-family: Georgia, "Times New Roman", "PT Serif", serif; font-weight: 500; color: #2E2A33; display: flex; flex-direction: column; gap: 10px; padding-bottom: 6px; }
.kz-mast { text-align: center; border-bottom: 3px double #3A2E3F; padding-bottom: 6px; }
.kz-name { font-weight: 700; font-size: 25px; letter-spacing: .04em; line-height: 1.05; }
.kz-meta { display: flex; justify-content: space-between; gap: 6px; font-size: 11.5px; font-style: italic; color: #6E6272; border-top: 1px solid #3A2E3F; margin-top: 6px; padding-top: 4px; }
.kz-shut { font-family: var(--font-hand); font-size: 18px; color: #8C6A4F; text-align: center; margin-top: -2px; }
.kz-h1 { font-weight: 700; font-size: 21px; line-height: 1.18; margin: 2px 0 0; }
.kz-h2 { font-weight: 700; font-size: 17px; line-height: 1.22; margin: 0; padding-top: 8px; border-top: 1px solid #D9CFC6; }
.kz-cols { display: grid; grid-template-columns: 1fr 1.45fr; gap: 10px; }
.kz-box { border: 1.5px solid #3A2E3F; border-radius: 4px; padding: 7px 9px; font-size: 13.5px; line-height: 1.35; background: #FFF8EC; }
.kz-box b { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; font-family: var(--font); font-weight: 900; color: #9E2F47; }
.kz-cross { display: flex; align-items: center; gap: 10px; border-top: 1px dashed #B9A9A0; padding-top: 9px; }
.kz-clue { flex: 1; font-size: 13.5px; line-height: 1.3; }
.kz-clue i { display: block; font-family: var(--font-hand); font-style: normal; font-size: 19px; color: #C2405B; line-height: 1.1; margin-top: 2px; }
.kz-cells { appearance: none; border: 0; background: none; padding: 0; display: flex; cursor: pointer; flex: none; }
.kz-cells span { width: 34px; height: 34px; border: 1.5px solid #3A2E3F; margin-left: -1.5px; display: grid; place-items: center; font-family: var(--font-hand); font-size: 26px; font-weight: 700; color: #4A4A6A; background: #fff; }
.kz-cells span:first-child { margin-left: 0; }
.kz-cells.on span { animation: kzPen .35s ease both; }
.kz-cells.on span:nth-child(2) { animation-delay: .18s; } .kz-cells.on span:nth-child(3) { animation-delay: .36s; }
@keyframes kzPen { from { color: transparent; transform: scale(.7); } }
.kz-nav { display: flex; justify-content: space-between; gap: 8px; font-family: var(--font); }
.kz-nav button { appearance: none; border: 0; background: #F4ECE4; color: #3A2E3F; border-radius: 12px; padding: 9px 12px; font: inherit; font-weight: 800; font-size: 13.5px; cursor: pointer; }
.kz-nav button:disabled { opacity: .35; cursor: default; }
.kz-knock { align-self: center; font-family: var(--font); }
.kz-bubble { align-self: center; max-width: 92%; background: #fff; border: 2px solid #E8DCCF; border-radius: 16px; padding: 8px 12px; font-family: var(--font); font-weight: 700; font-size: 14px; text-align: center; color: #3A2E3F; animation: pop .3s cubic-bezier(.2,1.5,.4,1) both; }
.kz-bubble.hidden { display: none; }
`);

  // выпуск i в лист (первый — текущей недели); факты засчитываются при просмотре
  function renderIssue(ctx, body, i, ui) {
    const w = ctx.week, is = ISSUES[i], st = ctx.st;
    const h2 = i === w && Array.isArray(st.stickers) && st.stickers.includes('citizen') ? `${waved() ? G.herName() : 'Следователь'} обошла весь город. Жители требуют назначить её мэром.` : is.h[1];
    const fact = ctx.place.facts[is.f];
    const solved = ctx.has('n_cross');
    body.innerHTML = `<div class="kz-paper">
      <div class="kz-mast"><div class="kz-name">ОКТЯБРЬСКИЙ ВЕСТНИК</div>
        <div class="kz-meta"><span>вып. №${i + 1}</span><span>${esc(is.d)}</span><span>выходит по субботам</span></div></div>
      <div class="kz-shut">Редакция на совещании. Слышно, как кто-то хрустит печеньем.</div>
      <h3 class="kz-h1">${esc(is.h[0])}</h3>
      <h4 class="kz-h2">${esc(h2)}</h4>
      <div class="kz-cols">
        <div class="kz-box"><b>Погода</b>${i >= 5 ? 'Снежно. Местами уютно.' : 'Пасмурно. Местами уютно.'}</div>
        <div class="kz-box"><b>Знаете ли вы?</b>${esc(fact ? fact.text : '')}</div>
      </div>
      <div class="kz-cross"><div class="kz-clue">Кто тут главная героиня? Три буквы.${solved ? '<i>Три буквы. И ни одной ошибки. Случайность? Конечно нет.</i>' : ''}</div>
        <button class="kz-cells${solved ? ' done' : ''}" data-cross aria-label="Вписать ответ">${solved ? '<span>О</span><span>Н</span><span>А</span>' : '<span></span><span></span><span></span>'}</button></div>
      <div class="kz-nav"><button data-prev ${i > 0 ? '' : 'disabled'}>← прошлый выпуск</button><button data-next ${i < w ? '' : 'disabled'}>следующий →</button></div>
      <button class="chip kz-knock" data-knock>✊ Постучать в окошко</button>
      <div class="kz-bubble ${ui.bubble ? '' : 'hidden'}" data-bubble>${esc(ui.bubble || '')}</div>
    </div>`;
    if (ui.title) ui.title.textContent = i === w ? 'Свежий номер' : `Выпуск №${i + 1}`;
    try { if (fact) ctx.fact(is.f); } catch (e) { /* ушла */ }
  }

  async function knock(ctx, ui) {
    const n = ctx.n('knock');
    ctx.haptic('light'); ctx.sfx('tap');
    const text = n <= 2 ? KNOCK[n - 1] : n === 3 ? KNOCK3 : KNOCK_MORE;
    if (ui) {   // внутри газеты: ответ из-за ставни — пузырёк в листе
      ui.bubble = text;
      const b = ui.body && ui.body.querySelector('[data-bubble]');
      if (b) { b.textContent = text; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
      if (n === 3) ctx.secret('n_knock');
      return;
    }
    if (n === 3) await ctx.say({ text: KNOCK3, s: 'n_knock' });
    else await ctx.play(text);
  }

  // газета: лист на весь экран (ниже HUD); start — номер выпуска
  async function open(ctx, start) {
    const w = ctx.week;
    let cur = typeof start === 'number' ? Math.max(0, Math.min(w, start)) : w;
    const ui = { bubble: '', body: null, title: null };
    let stampP = null;
    const r = ctx.sheet({
      title: cur === w ? 'Свежий номер' : `Выпуск №${cur + 1}`, full: true, cls: 'kz-sheet',
      onMount(body, close, m) {
        ui.body = body; ui.title = m && m.querySelector('.sheet-title');
        renderIssue(ctx, body, cur, ui);
        body.addEventListener('click', e => {
          if (ctx.gone) return;
          const b = e.target.closest('[data-prev], [data-next], [data-cross], [data-knock]');
          if (!b) return;
          e.stopPropagation();
          try {
            if (b.dataset.prev !== undefined && cur > 0) { cur--; ctx.haptic('light'); ctx.sfx('tap'); renderIssue(ctx, body, cur, ui); body.scrollTop = 0; }
            else if (b.dataset.next !== undefined && cur < w) { cur++; ctx.haptic('light'); ctx.sfx('tap'); renderIssue(ctx, body, cur, ui); body.scrollTop = 0; }
            else if (b.dataset.cross !== undefined && !b.classList.contains('done')) {
              b.classList.add('done', 'on'); b.innerHTML = '<span>О</span><span>Н</span><span>А</span>';
              const clue = body.querySelector('.kz-clue'); if (clue && !clue.querySelector('i')) clue.insertAdjacentHTML('beforeend', '<i>Три буквы. И ни одной ошибки. Случайность? Конечно нет.</i>');
              ctx.haptic('select'); ctx.sfx('tap');
              setTimeout(() => { try { if (!ctx.gone) ctx.secret('n_cross'); } catch (x) { /* ушла */ } }, 700);
            } else if (b.dataset.knock !== undefined) knock(ctx, ui).catch(() => {});
          } catch (x) { /* ушла */ }
        });
        // штамп — при первом прочтении, поверх газеты
        const i = Town.REG.places.indexOf(P);
        if (i >= 0 && !Town.bits.get(ctx.town.stp, i)) setTimeout(() => { try { if (!ctx.gone) stampP = ctx.giveStamp().catch(() => {}); } catch (x) { /* ушла */ } }, 650);
      },
    });
    const v = await r;
    if (stampP) await stampP;
    return v;
  }

  Town.place({
    id: P, kind: 'counter',
    name: 'Газетный киоск «Октябрьский вестник»', short: 'Киоск',
    sign: 'ОКТЯБРЬСКИЙ ВЕСТНИК', motto: 'газеты · кроссворд · самообслуживание',
    icon: '📰', color: '#FFF1C8',
    street: { x: 9.6, w: 1.4, doorDx: 0, bkey: 'kiosk' },
    room: null, opens: 0,
    host: null,
    fresh: [1, 2, 3, 4, 5, 6],
    spots: {
      paper: { icon: '📰', label: 'Свежий номер', secret: 'n_cross', onUse: async ctx => { await open(ctx, ctx.week); return true; } },
      archive: {
        icon: '🗞', label: 'Прошлые выпуски',
        onUse: async ctx => {
          if (ctx.week < 1) { await ctx.play('Это первый выпуск. Архив пока тоненький.'); await open(ctx, 0); }
          else await open(ctx, ctx.week - 1);
          return true;
        },
      },
      knock: { icon: '✊', label: 'Постучать в окошко', secret: 'n_knock', onUse: async ctx => { await knock(ctx, null); return true; } },
    },
    open: ctx => open(ctx),
    facts: {
      gazeta: { text: '„Газета“ — от венецианской монетки gazzetta: столько стоил листок с новостями.', wk: 0 },
      pumpb: { text: 'Ботаники считают плод тыквы особой ягодой — тыквиной.', wk: 1 },
      leaves: { text: 'Осенью листья желтеют, потому что зелёный хлорофилл разрушается. Жёлтые пигменты были в листе всё лето — просто прятались.', wk: 2 },
      wool: { text: 'Шерсть греет, потому что между волокнами держится воздух. А воздух плохо проводит тепло.', wk: 3 },
      graph: { text: 'В карандаше нет свинца. Только графит и глина.', wk: 4 },
      snow: { text: 'У снежинок шесть лучей: так устроен кристалл льда.', wk: 5 },
      rubber: { text: 'До ластиков карандаш стирали хлебным мякишем. Резиновые ластики начали продавать в Лондоне около 1770 года.', wk: 6 },
    },
    secrets: [
      { id: 'n_cross', title: 'Три буквы', trigger: 'газета: тап по клеткам кроссворда' },
      { id: 'n_knock', title: 'Планёрка с печеньем', trigger: 'третий стук в окошко за прогулку' },
    ],
    stamp: { title: 'Киоск', icon: '📰' },
  });
})();
