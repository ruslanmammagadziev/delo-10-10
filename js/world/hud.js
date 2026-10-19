/* =====================================================================
   HUD v2 — общий интерфейс поверх игры (город, регионы, улица, 2D): «аккуратно с телефона».
   Одна тонкая полоса сверху (☰ · цель · один значок), радар слева внизу, джойстик снизу по центру, справа внизу —
   главная кнопка P и дуга маленьких круглых кнопок. Спецификация — plan2/hud_spec.md (§1 токены, §2 геометрия, §8 API).
   Не зависит от THREE и WORLD при загрузке; окно — window.HUD (и WORLD.hud, если WORLD есть).

   HUD.v                                  — 1
   HUD.metrics(W, H)                      → { top, barBottom, g, B0, R0, L0, safe:{t,b,l,r}, radar:{x,y,d}, joy:{cx,cy,d,r,knob,travel},
                                              zone:{x1,y0}, P:{cx,cy,d}, slots:{s1..s4:{cx,cy}}, a2:{bottom,top}, gas, brake }
   HUD.joyZone(x, y, W, H)                → начинать ли джойстик с этого касания (кнопки проверяет вызывающий)
   HUD.joyPlace(x, y, W, H)               → { cx, cy } — где нарисовать кружок под пальцем (только чтобы весь был на экране)
   HUD.joyRest(W, H)                      → { cx, cy } — место покоя
   HUD.joyGuard(x, y, W, H)               → касание на кружке покоя или рядом (r + 16 px): короткий тап тут — не «идти туда»
   HUD.JOY                                — все числа джойстика (ход, мёртвая зона, кривая, сглаживание, бег); HUD.joyShape(n) → сила 0…1
   HUD.layout(root?)                      — пишет --hud-joy-cx (px) на #app; зовётся сам на resize
   HUD.actFace(label)                     → { icon, short, full, known } — лицо главной кнопки по подписи
   HUD.paintAct(btn, label, soft)         — <i>значок</i><b>слово</b>, aria-label/title/data-full = подпись
   HUD.slot(el, name)                     — data-hud-slot = P | s1..s4 | a2 | gas | brake | joy | radar
   HUD.mode(root, mode)                   — data-hud-mode = walk|drive|drive-pedals|ride|fly|sit|look|dance|zip|sport|room|street|2d
   HUD.sbtn(host, { slot, icon, label, cls, onPress }) → кнопка 46 px в слоте (значок; подпись — aria-label)
   HUD.actions.set(host, [{ id, icon, label, onPress, slot?, main?, on?, soft? }]) — набор кнопок кластера (лишние прячутся)
   HUD.joystick.create(host, o?)          → J: { el, knob, zone(x,y), guard(x,y), begin(x,y), drag(x,y) → {x,y,m,r}, frame(ok) → bool,
                                              end(), show(on), layout(), dispose(), active, x, y, m, lx, ly, r, run } — центр — сам палец
                                              (на касании сила 0); drag — палец и ручка (мгновенно, для «палец пошёл»); frame — раз в
                                              кадр: x/y/m — сглаженная сила по кривой (ходьба, полёт, лестница, машина города), lx/ly —
                                              без кривой (руль в горах); бег — палец за краем кружка (r ≥ 1,4 хода) 0,3 с в одну сторону
                                              (класс .edge — пунктир порога, .arm — золотое кольцо, .run — бег), назад внутрь хода — шаг.
                                              running(ok) = frame
   HUD.driveCtl.create(host, { pedals?, always? }) → D: { el, btn, frame(dt) → { str, gas, brake }, show(on), release(), dispose() } —
                                              за рулём: слева «‹‹» «››» (руль плавно, HUD.DRV), справа «газ» и «тормоз» (pedals: false — свои);
                                              показан — body.hud-driving (джойстика нет, радар над кнопками руля)
   HUD.radarSlot(el)                      — радар в угол (класс + data-hud-slot=radar)
   HUD.menu.add({ id, icon, label, sub?, value?, badge?, toggle?, when?|visible?, onTap|onClick, onLong?, order?, keepOpen? })
             .remove(id) .update(id, patch) .open() .close() .isOpen() .news(id, on) .info(fn|text) .note(text|null)
   HUD.help()                             — лист «Как играть»; HUD.helpTop = () => { icon, title, sub, onTap } | null — строка сверху от сцены
   HUD.objective.set(o | null)            — o: { icon, text, title?, full?, progress?:[a,b], dist?, onTap?, lock? } — пилюля + карточка
                .dist(m) .expand(ms) .get()
   HUD.status(o | null)                   — правый слот: null → звук; { kind:'exit', icon, label, onTap } | { kind:'chip', text } |
                                            { kind:'close', label, onTap } | { kind:'none' }
   HUD.topBar.render(hudEl, opts)         — полоса (зовёт G.setHud); HUD.topBar.el()
   HUD.toast(text, ms? | { ms }, { kind?:'place'|'sticker', replace? }) — через G.toast, очередь
   HUD.arrive(title, sub?)                — тост «place» при въезде в место
   HUD.coach(el, text, key, o?) → bool    — первая подсказка у маленькой кнопки (o.max раз за всё время, по умолчанию 3; o.above — над,
                                            на o.gap px выше, по умолчанию 8); true — показана
   HUD.chev(el, { on, x, y, side, rot, dist }) — шеврон у края; HUD.chevY(y, H), HUD.labelY(y, H) — зажим по высоте
   HUD.rects(root?)                       → [{ k, el, x0, y0, x1, y1, round }] видимых элементов HUD — для тестов перекрытий
   HUD.build()                            → «версия 16.10 14:05 · 1a2b3c4d» (window.BUILD_INFO из tools/build_single.py) | «версия dev»
   body.hud-quiet — сам модуль, пока в #layer открыт диалог, лист или карта.
   ===================================================================== */
(function () {
  'use strict';
  const HUD = window.HUD = window.HUD || {};
  HUD.v = 1;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angW = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  const esc =s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G_ = () => window.G || null;
  const app = () => document.getElementById('app') || document.body;
  const layerEl = () => document.getElementById('layer');
  const haptic = k => { const g = G_(); if (g && g.haptic) g.haptic(k || 'light'); };
  const tapSfx = () => { const g = G_(); if (g && g.sfx) g.sfx('tap'); };
  const coarse = () => { try { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } };
  HUD.coarse = coarse;

  /* ---------- Геометрия (§2): те же числа, что в CSS-токенах ---------- */
  const SLOT = { s1: [0, 70], s2: [49.5, 49.5], s3: [70, 0], s4: [46, 115] };
  const ACT = 64, BTN = 46, GAP = 8;
  HUD.SLOT = SLOT;
  // джойстик «удобно с телефона» (все числа — тут): ход ручки T = 0,44 диаметра кружка (390 px — 45,8, 360 — 42,3);
  // мёртвая зона с запасом — включается с 16 % хода, гаснет ниже 10 %; кривая — с 0,10 у края зоны (DZ0), степень 1,4,
  // полная сила с 80 % хода; сила сглажена 60 мс, курс держится, пока палец дрожит в пределах ~2 px дуги (2°…8°);
  // палец дальше 1,6 хода — центр едет следом; бег — палец за порогом (1,4 хода: ~11 px за кольцом, там пунктир) 0,3 с в
  // одну сторону (±30°), назад внутрь хода ручки — шаг; мелкие (до 0,02 хода, ~1 px) и короткие (< 150 мс) нырки внутрь
  // порога удержание не сбрасывают, глубже или дольше — сбрасывают, как и круг по краю быстрее ~100°/с (отставание курса
  // > 11° при 0,1 с); золотое кольцо горит с 80 мс удержания — и тогда бег через ≤ 0,22 с; пунктир порога виден, пока ручка
  // у края (≥ 1 хода, гаснет ниже 0,85); тап на кружке покоя (r + 16 px) — не «идти туда»; подсказка про бег — 2 раза за всё время
  const JOY = HUD.JOY = {
    TRAVEL: 0.44, DZ_ON: 0.16, DZ_OFF: 0.10, DZ0: 0.12, SAT: 0.80, EXPO: 1.4, M0: 0.10, TAU_M: 0.06,
    HEAD_ARC: 2.0, HEAD_MIN: 0.035, HEAD_MAX: 0.14, HEAD_T: 0.25, FOLLOW: 1.6,
    RUN_ON: 1.4, RUN_OFF: 1.0, RUN_T: 300, RUN_ANG: 0.52, RUN_DIP: 0.02, ARM_ON: 80, ARM_OFF: 150, SWEEP: 0.19, SWEEP_T: 0.1, EDGE: 0.85,
    GUARD: 16, TIP_T: 2.5, TIP_N: 2,
  };
  // сила по отклонению n = d / ход (0…1): с 0,10 у края мёртвой зоны, мягко (степень 1,4), полная — с 80 % хода
  const joyShape = HUD.joyShape = n => JOY.M0 + (1 - JOY.M0) * Math.pow(clamp((n - JOY.DZ0) / (JOY.SAT - JOY.DZ0), 0, 1), JOY.EXPO);
  let probe = null, probeKey = '', probeVal = null;
  // замер env(safe-area-inset-*) и clamp(…vw…) через невидимый элемент (как их видит CSS)
  function measure() {
    const a = app();
    const key = (window.innerWidth | 0) + 'x' + (window.innerHeight | 0) + ':' + (a.clientWidth | 0) + ':' + (document.documentElement.getAttribute('style') || '').length;
    if (probeVal && key === probeKey && probe && probe.isConnected) return probeVal;
    if (!probe || !probe.isConnected) {
      probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;box-sizing:content-box;' +
        'padding:var(--hud-safe-t,0px) var(--hud-safe-r,0px) var(--hud-safe-b,0px) var(--hud-safe-l,0px);' +
        'width:var(--hud-radar,96px);height:var(--hud-joy,104px);margin-top:var(--tg-content-top,0px)';
      a.appendChild(probe);
    }
    let cs = null; try { cs = getComputedStyle(probe); } catch (e) { cs = null; }
    const px = v => { const n = parseFloat(v); return n === n ? n : 0; };
    probeVal = cs ? { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft), radar: px(cs.width) || 96, joy: px(cs.height) || 104, tgTop: px(cs.marginTop) }
      : { t: 0, r: 0, b: 0, l: 0, radar: 96, joy: 104, tgTop: 0 };
    probeKey = key;
    return probeVal;
  }
  function metrics(W, H) {
    const a = app();
    W = W || a.clientWidth || 390; H = H || a.clientHeight || 844;
    const s = measure();
    const g = 12, top = s.t + s.tgTop + 8, barBottom = top + 44;
    const B0 = s.b + g, L0 = s.l + g, R0 = s.r + g;
    const rd = s.radar, radar = { x: L0, y: H - B0 - rd, d: rd };
    const P = { cx: W - R0 - ACT / 2, cy: H - B0 - ACT / 2, d: ACT };
    const slots = {};
    Object.keys(SLOT).forEach(k => { slots[k] = { cx: P.cx - SLOT[k][0], cy: P.cy - SLOT[k][1], d: BTN }; });
    const jd = s.joy, jr = jd / 2, knob = jd * 0.42;
    const jcy = H - (B0 + 4) - jr;
    const s3 = slots.s3, dy = Math.abs(jcy - s3.cy), need = jr + BTN / 2 + GAP;
    const jcx = Math.min(W / 2, s3.cx - Math.sqrt(Math.max(0, need * need - dy * dy)));
    const joy = { cx: jcx, cy: jcy, d: jd, r: jr, knob, travel: Math.round(jd * JOY.TRAVEL * 10) / 10 };
    const zone = { x1: s3.cx - BTN / 2 - 4, y0: H * 0.5 };
    const a2b = B0 + 180;
    return {
      W, H, top, barBottom, g, B0, L0, R0, safe: { t: s.t, b: s.b, l: s.l, r: s.r },
      radar, joy, zone, P, slots, a2: { bottom: a2b, top: H - a2b - 44 },
      gas: { x: W - R0 - 64, y: H - B0 - 76, w: 64, h: 76 }, brake: { x: W - R0 - 64, y: H - B0 - 86 - 56, w: 64, h: 56 },
    };
  }
  HUD.metrics = metrics;
  HUD.joyRest = (W, H) => { const m = metrics(W, H); return { cx: m.joy.cx, cy: m.joy.cy }; };
  HUD.joyZone = (x, y, W, H) => { const m = metrics(W, H); return y >= m.zone.y0 && x <= m.zone.x1; };
  // центр джойстика — сам палец; кружок рисуется под ним, зажат только краями экрана (у нижнего края — чуть выше пальца)
  HUD.joyPlace = (x, y, W, H) => {
    const m = metrics(W, H), R = m.joy.r;
    const cx = clamp(x, m.safe.l + R + 2, Math.max(m.safe.l + R + 2, m.W - m.safe.r - R - 2));
    const cy = clamp(y, m.barBottom + R, Math.max(m.barBottom + R, m.H - m.safe.b - R - 2));
    return { cx, cy };
  };
  HUD.joyGuard = (x, y, W, H) => { const m = metrics(W, H); return Math.hypot(x - m.joy.cx, y - m.joy.cy) <= m.joy.r + JOY.GUARD; };
  HUD.layout = function (root) {
    const a = root || app();
    try {
      const m = metrics(a.clientWidth, a.clientHeight);
      app().style.setProperty('--hud-joy-cx', Math.round(m.joy.cx * 10) / 10 + 'px');
    } catch (e) { /* без замера — 50 % из CSS */ }
    joys.forEach(j => { try { j.layout(); } catch (e) { /* ignore */ } });
  };
  window.addEventListener('resize', () => { probeVal = null; HUD.layout(); });

  /* ---------- Лицо главной кнопки (§3.6) ---------- */
  const FACES = [
    // подписи поездки (REGION-HUD; раньше дописывались из regions.js — теперь в общей таблице)
    [/^сесть в машину/i, '🚗', 'В машину'], [/^посидеть/i, '🪑', 'Посидеть'], [/^пристегнуться/i, '🎢', 'Поехали'], [/^пробить/i, '⚽', 'Удар'],
    [/^гравировать/i, '✨', 'Узор'], [/^полетать/i, '🪂', 'Лететь'], [/^попить/i, '💧', 'Попить'], [/^в круг/i, '💃', 'Танец'],
    [/^угоститься/i, '😋', 'Угощение'], [/^поздравить/i, '💐', 'Ура!'], [/^в город/i, '🏙', 'В город'], [/^к отелю/i, '🏨', 'К отелю'],
    [/^сама порулю/i, '🕹', 'Рулить'],
    [/^войти/i, '🚪', 'Войти'], [/^зайти/i, '🚪', 'Войти'], [/^закрыто/i, '🔒', 'Закрыто'], [/^постучать/i, '✊', 'Тук-тук'],
    [/^поговорить/i, '💬', 'Говорить'], [/^говорить/i, '💬', 'Говорить'], [/^спросить/i, '💬', 'Спросить'], [/^поздороваться/i, '👋', 'Привет'],
    [/^помахать/i, '👋', 'Помахать'], [/^погладить/i, '🤍', 'Гладить'], [/^сесть за руль/i, '🚗', 'За руль'], [/^за руль/i, '🚗', 'За руль'],
    [/^выбрать машину/i, '🚗', 'Гараж'], [/^гараж/i, '🚗', 'Гараж'], [/^другая машина/i, '🔁', 'Другая'], [/^сесть на вел/i, '🚲', 'Поехать'],
    [/^слезть/i, '🚲', 'Слезть'], [/^выйти/i, '🚪', 'Выйти'], [/^сесть/i, '🪑', 'Сесть'], [/^встать/i, '⬆️', 'Встать'],
    [/^(?:посмотреть|смотреть|осмотреться|осмотреть|глянуть|взглянуть)/i, '👀', 'Смотреть'], [/^почитать|^читать|^прочитать/i, '📖', 'Читать'],
    [/^купить/i, '🛍', 'Купить'], [/^позвать/i, '🐱', 'Позвать'], [/^хватит/i, '✋', 'Хватит'], [/^пропустить/i, '⏭', 'Дальше'],
    [/^дальше/i, '⏭', 'Дальше'], [/^набрать/i, '🫙', 'Набрать'], [/^примерить|^надеть/i, '🧣', 'Надеть'], [/^снять/i, '🧣', 'Снять'],
    [/^приземлиться/i, '⬇️', 'Вниз'], [/^сыграть в падел|^играть в падел/i, '🎾', 'Играть'], [/^сыграть в футбол|^играть в футбол/i, '⚽', 'Играть'],
    [/^сыграть в гольф|^играть в гольф|^мини-гольф/i, '⛳', 'Играть'], [/^сыграть|^играть/i, '🎲', 'Играть'], [/^взять/i, '✋', 'Взять'],
    [/^поднять/i, '✋', 'Поднять'], [/^угостить/i, '🍬', 'Угостить'], [/^подарить/i, '🎁', 'Подарить'], [/^покормить/i, '🍪', 'Кормить'],
    [/^полить/i, '💧', 'Полить'], [/^сфотограф|^снять фото|^фото/i, '📷', 'Фото'], [/^потанцевать|^танцевать/i, '💃', 'Танец'],
    [/^обнять/i, '🤗', 'Обнять'], [/^позвонить/i, '☎️', 'Звонок'], [/^открыть/i, '🗝', 'Открыть'], [/^подняться|^наверх/i, '⬆️', 'Наверх'],
    [/^спуститься|^вниз/i, '⬇️', 'Вниз'], [/^поехать|^ехать/i, '🚗', 'Поехать'], [/^лететь|^полететь|^взлететь/i, '🪂', 'Лететь'],
    [/^кататься|^прокатиться/i, '🎢', 'Кататься'], [/^поставить на дорогу|^на дорогу/i, '🛟', 'На дорогу'], [/^тур|^экскурс/i, '💬', 'Тур'],
    [/^послушать|^слушать/i, '🎵', 'Слушать'], [/^попробовать/i, '😋', 'Пробовать'], [/^отдохнуть/i, '🪑', 'Отдых'], [/^загадать/i, '✨', 'Желание'],
    [/^бросить|^кинуть/i, '🪙', 'Бросить'], [/^ждать|^подождать/i, '⏳', 'Ждать'], [/^назад|^вернуться/i, '↩️', 'Назад'],
    [/^букет/i, '💐', 'Букет'], [/^газета/i, '📰', 'Газета'], [/^почта/i, '✉️', 'Почта'], [/^прогноз/i, '⛅', 'Прогноз'], [/^прыгнуть|^прыг/i, '💦', 'Прыг!'],
    [/^выглянуть|^заглянуть/i, '👀', 'Глянуть'], [/^завести/i, '🔑', 'Завести'], [/^зажечь/i, '🕯', 'Зажечь'], [/^заказать/i, '🧾', 'Заказать'],
    [/^залезть/i, '🧗', 'Залезть'], [/^какао/i, '☕', 'Какао'], [/^коснуться|^потрогать/i, '✋', 'Тронуть'], [/^крендель/i, '🥨', 'Крендель'],
    [/^крикнуть/i, '📣', 'Крикнуть'], [/^молоточ/i, '🔨', 'Молоток'], [/^погреться/i, '🔥', 'Греться'], [/^покрутить/i, '🔄', 'Крутить'],
    [/^понюхать/i, '👃', 'Нюхать'], [/^попкорн/i, '🍿', 'Попкорн'], [/^поправить/i, '🪄', 'Поправить'], [/^порыться/i, '🔎', 'Порыться'],
    [/^посыпать/i, '🧂', 'Посыпать'], [/^прилечь/i, '🛋', 'Прилечь'], [/^присесть|^отдохнуть/i, '🪑', 'Сесть'], [/^разглядеть|^рассмотреть/i, '🔍', 'Смотреть'],
    [/^раскрыть/i, '✨', 'Раскрыть'], [/^рисовать|^нарисовать/i, '🎨', 'Рисовать'], [/^свидетел/i, '🕵️', 'Свидетели'], [/^сложить/i, '🧺', 'Сложить'],
    [/^сменить/i, '🔁', 'Сменить'], [/^смотать/i, '🧶', 'Смотать'], [/^сняться|^сфоткаться/i, '📸', 'Фото'], [/^шкаф/i, '🗄', 'Шкаф'],
    [/^штемпель/i, '📮', 'Штемпель'], [/^гуляем|^гулять/i, '🐕', 'Гулять'], [/^домой/i, '🏠', 'Домой'], [/^новое имя|^имя/i, '✏️', 'Имя'],
    [/^просто погладить/i, '🤍', 'Гладить'], [/^(?:в|на|к|ко)\s/i, '🚶', 'Идти'], [/^пиу|^бум/i, '💫', 'Бум!'], [/^дзынь|^звонок/i, '🔔', 'Дзынь'],
  ];
  const EMOJI_HEAD = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic})|[\u{1F3FB}-\u{1F3FF}])*)\s*/u;
  function actFace(label) {
    const full = String(label == null ? '' : label).trim();
    let rest = full, icon = '';
    try { const m = rest.match(EMOJI_HEAD); if (m) { icon = m[1]; rest = rest.slice(m[0].length); } } catch (e) { /* старый движок без \p — без значка */ }
    rest = rest.replace(/^[←→↑↓⬅➡⬆⬇]\s*/, '');
    const head = rest.split(/\s*[:·—|]\s*/)[0].trim();
    for (let i = 0; i < FACES.length; i++) {
      const f = FACES[i];
      if (f[0].test(head)) return { icon: icon || f[1], short: f[2], full, known: true };
    }
    const w = head.split(/\s+/)[0] || '';
    const short = w.length && w.length <= 9 ? w.charAt(0).toUpperCase() + w.slice(1) : (w ? w.slice(0, 7) + '…' : '');
    return { icon: icon || '✨', short, full, known: !!(w && w.length <= 9) };
  }
  HUD.actFace = actFace;
  HUD.FACES = FACES;
  function paintAct(btn, label, soft) {
    if (!btn) return null;
    const f = actFace(label);
    const key = f.full + (soft ? '~' : '');
    if (btn.dataset.full !== f.full || btn.dataset.faceKey !== key) {
      btn.innerHTML = `<i aria-hidden="true">${esc(f.icon)}</i><b aria-hidden="true">${esc(f.short)}</b>`;
      btn.setAttribute('aria-label', f.full); btn.title = f.full; btn.dataset.full = f.full; btn.dataset.faceKey = key;
      btn.dataset.long = f.short.length > 8 ? '2' : f.short.length > 6 ? '1' : '';
    }
    btn.classList.toggle('soft', !!soft);
    btn.classList.add('hud-act');
    return f;
  }
  HUD.paintAct = paintAct;
  // одна кнопка в любом слоте: P — значок + слово, a2 — пилюля «значок + подпись», s1…s4 — круг 46 со значком (подпись — aria-label)
  HUD.paintSlot = function (el, label, slot, soft) {
    if (!el) return null;
    HUD.slot(el, slot);
    if (slot === 'P') { el.classList.remove('hud-a2', 'hud-sbtn'); return paintAct(el, label, soft); }
    const f = actFace(label), L0 = String(label == null ? '' : label).trim();
    const txt = f.icon && L0.indexOf(f.icon) === 0 ? L0.slice(f.icon.length).replace(/^[\uFE0F\s]+/, '') : L0;
    el.classList.remove('hud-act');
    if (slot === 'a2') { el.classList.add('hud-a2'); el.classList.remove('hud-sbtn'); el.innerHTML = `<i aria-hidden="true">${esc(f.icon)}</i><span>${esc(txt)}</span>`; }
    else { el.classList.add('hud-sbtn'); el.classList.remove('hud-a2'); el.innerHTML = `<i aria-hidden="true">${esc(f.icon)}</i>`; }
    el.setAttribute('aria-label', L0); el.title = L0; el.dataset.full = L0;
    el.classList.toggle('soft', !!soft);
    return f;
  };
  // полоса без ☰ и/или без пилюли цели (мини-игра, зиплайн: любое касание — игре): HUD.bar({ menu: false, obj: false }); HUD.bar() — всё вернуть
  HUD.bar = function (o) {
    o = o || {};
    const b = document.body.classList;
    b.toggle('hud-bare-menu', o.menu === false); b.toggle('hud-bare-obj', o.obj === false);
  };
  HUD.slot = (el, name) => { if (el) { if (name) el.dataset.hudSlot = name; else delete el.dataset.hudSlot; } return el; };
  HUD.mode = (root, mode) => { if (root) { if (mode) root.dataset.hudMode = mode; else delete root.dataset.hudMode; } return root; };
  HUD.radarSlot = el => { if (el) { el.classList.add('hud-radar'); el.dataset.hudSlot = 'radar'; } return el; };

  /* ---------- Маленькие кнопки дуги и набор действий ---------- */
  function sbtn(host, o = {}) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hud-sbtn' + (o.cls ? ' ' + o.cls : '');
    if (o.slot) b.dataset.hudSlot = o.slot;
    b.innerHTML = `<i aria-hidden="true">${esc(o.icon || '✨')}</i>`;
    if (o.label) { b.setAttribute('aria-label', o.label); b.title = o.label; }
    if (o.onPress) b.addEventListener('click', e => { e.stopPropagation(); o.onPress(e); });
    if (host) host.appendChild(b);
    return b;
  }
  HUD.sbtn = sbtn;
  HUD.sicon = (b, icon, label) => {
    if (!b) return b;
    const i = b.querySelector('i'); if (i) i.textContent = icon; else b.innerHTML = `<i aria-hidden="true">${esc(icon)}</i>`;
    if (label) { b.setAttribute('aria-label', label); b.title = label; }
    return b;
  };
  const ACTS = new WeakMap();
  HUD.actions = {
    set(host, list) {
      if (!host) return [];
      let reg = ACTS.get(host); if (!reg) { reg = {}; ACTS.set(host, reg); }
      const seen = {};
      (list || []).forEach((a, i) => {
        if (!a) return;
        const id = a.id || 'a' + i; seen[id] = 1;
        let r = reg[id];
        const slot = a.slot || (a.main ? 'P' : ['s1', 's2', 's3', 's4'][i] || 'a2');
        if (!r) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.hudAct = id;
          b.addEventListener('click', e => { e.stopPropagation(); const rr = reg[id]; if (rr && rr.a.onPress) rr.a.onPress(e); });
          host.appendChild(b); r = reg[id] = { b, a };
        }
        r.a = a; r.b.dataset.hudSlot = slot;
        if (slot === 'P') { r.b.className = 'hud-act'; paintAct(r.b, a.label, a.soft); } else if (slot === 'a2') {
          r.b.className = 'hud-a2'; r.b.innerHTML = `<i aria-hidden="true">${esc(a.icon || '✨')}</i><span>${esc(a.label || '')}</span>`; r.b.setAttribute('aria-label', a.label || '');
        } else { r.b.className = 'hud-sbtn'; HUD.sicon(r.b, a.icon || '✨', a.label); }
        r.b.classList.toggle('on', !!a.on);
        r.b.classList.remove('hidden');
      });
      Object.keys(reg).forEach(id => { if (!seen[id]) reg[id].b.classList.add('hidden'); });
      return Object.keys(seen).map(id => reg[id].b);
    },
    clear(host) { const reg = host && ACTS.get(host); if (reg) Object.keys(reg).forEach(id => reg[id].b.classList.add('hidden')); },
  };

  /* ---------- Джойстик (§3.5): кружок в покое по центру снизу, под пальцем — плавающий ---------- */
  const joys = new Set();
  const JOY_SVG = '<svg class="hud-joy-ch" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M44,15 L50,9 L56,15"/><path d="M44,85 L50,91 L56,85"/><path d="M15,44 L9,50 L15,56"/><path d="M85,44 L91,50 L85,56"/></g></svg>';
  // бег — самим джойстиком (кнопки «Бег» больше нет): палец за порогом (≥ JOY.RUN_ON хода) держит одно направление
  // JOY.RUN_T мс — бег (J.run, класс .run: ручка и кольцо золотые, стрелки ярче); ручка упёрлась в край — пунктир порога
  // (класс .edge: куда тянуться); идёт удержание — золотое кольцо (класс .arm, с JOY.ARM_ON мс; кольцо и удержание — одно
  // и то же, так что горит — значит, скоро бег); вернула палец внутрь хода ручки (< JOY.RUN_OFF) или отпустила — шаг.
  // Центр — всегда сам палец (и при позднем начале), так что первый же кадр за краем — честное начало удержания
  HUD.joystick = {
    create(host, o = {}) {
      const el = document.createElement('div');
      el.className = 'w-joy joy hud-joy rest hidden' + (o.cls ? ' ' + o.cls : '');
      el.dataset.hudSlot = 'joy';
      el.innerHTML = JOY_SVG + '<div class="joy-knob"></div>';
      if (host) host.appendChild(el);
      const knob = el.querySelector('.joy-knob');
      const dims = () => { const h = o.root || host || app(); return { W: h.clientWidth || app().clientWidth, H: h.clientHeight || app().clientHeight }; };
      const runCls = b => { J.run = b; el.classList.toggle('run', b); if (b) J._ran = true; };
      const armCls = b => { if (b !== J._armV) { J._armV = b; el.classList.toggle('arm', b); } };
      const edgeCls = b => { if (b !== J._edV) { J._edV = b; el.classList.toggle('edge', b); } };
      // кружок рисуется целиком на экране (у края — чуть выше пальца), центр джойстика — сам палец; ручка — отклонение от центра,
      // пунктир порога бега — вокруг кружка (вся картинка — одна и та же, у края она просто чуть сдвинута от пальца)
      const place = () => {
        const d = dims(), m = metrics(d.W, d.H), p = HUD.joyPlace(J.cx, J.cy, d.W, d.H);
        el.style.left = Math.round(p.cx - m.joy.r) + 'px'; el.style.top = Math.round(p.cy - m.joy.r) + 'px'; el.style.bottom = 'auto'; J._l = J._t = null;
      };
      const J = {
        el, knob, active: false, cx: 0, cy: 0, fx: 0, fy: 0, x: 0, y: 0, m: 0, lx: 0, ly: 0, r: 0, run: false, want: false, travel: 34,
        _on: false, _hd: 0, _m: 0, _n: 0, _rt: 0, _ro: 0, _ra: 0, _rf: 0, _ft: 0, _fullT: 0, _armV: false, _edV: false, _tipEnd: 0, _ran: false, _tip: false,
        zone(x, y) { const d = dims(); return HUD.joyZone(x, y, d.W, d.H); },
        guard(x, y) { const d = dims(); return HUD.joyGuard(x, y, d.W, d.H); },
        layout() {
          if (J.active) return;
          const d = dims(), m = metrics(d.W, d.H), l = Math.round(m.joy.cx - m.joy.r) + 'px', t = Math.round(m.joy.cy - m.joy.r) + 'px';
          if (J._l === l && J._t === t && el.style.left === l) return;
          J._l = l; J._t = t;
          el.style.left = l; el.style.top = t; el.style.bottom = 'auto';
        },
        // палец коснулся: центр — точка касания (сила 0), кружок — под пальцем
        begin(x, y) {
          const d = dims(), m = metrics(d.W, d.H);
          J.active = true; J.cx = J.fx = x; J.cy = J.fy = y; J.travel = m.joy.travel;
          J.x = J.y = J.m = J.lx = J.ly = J.r = J._m = J._n = 0; J._on = false; J._rt = J._ro = J._tipEnd = 0; J._fullT = 0; J._ft = performance.now();
          if (J.run) runCls(false);
          armCls(false); edgeCls(false);
          el.classList.remove('rest', 'back'); el.classList.add('live');
          el.style.setProperty('--hud-joy-run', (2 * JOY.RUN_ON * J.travel).toFixed(1) + 'px');
          place(); knob.style.transform = '';
          return { cx: x, cy: y };
        },
        // палец едет: ручка — сразу за пальцем; ответ — мгновенная сила без сглаживания (для «палец пошёл»: отменить «идти туда»)
        drag(x, y) {
          if (!J.active) return { x: 0, y: 0, m: 0, r: 0 };
          J.fx = x; J.fy = y;
          let dx = x - J.cx, dy = y - J.cy, dd = Math.hypot(dx, dy);
          const T = J.travel || 34, F = JOY.FOLLOW * T;
          // палец ушёл дальше 1,6 хода — центр тянется следом: вернула палец — тише, но в ту же сторону
          if (dd > F) { const k = (dd - F) / dd; J.cx += dx * k; J.cy += dy * k; dx = x - J.cx; dy = y - J.cy; dd = F; place(); }
          const c = dd > T ? T / dd : 1;
          knob.style.transform = `translate(${(dx * c).toFixed(1)}px, ${(dy * c).toFixed(1)}px)`;
          const n = Math.min(1, dd / T), on = J._on ? n >= JOY.DZ_OFF : n >= JOY.DZ_ON, s = on ? joyShape(n) : 0;
          J.r = dd / T;
          return { x: dd > 0 ? dx / dd * s : 0, y: dd > 0 ? dy / dd * s : 0, m: s, r: J.r };
        },
        // раз в кадр: сглаженная сила, удержанный курс, бег (ok — можно ли бежать: пешком, есть Move). Возвращает J.run
        frame(ok) {
          const now = performance.now(), dt = clamp((now - (J._ft || now)) / 1000, 0, 0.1);
          J._ft = now;
          if (!J.active) { J.x = J.y = J.m = J.lx = J.ly = 0; armCls(false); edgeCls(false); if (J.run) runCls(false); return false; }
          const dx = J.fx - J.cx, dy = J.fy - J.cy, d = Math.hypot(dx, dy), T = J.travel || 34, n = Math.min(1, d / T), th = Math.atan2(dx, -dy);
          // мёртвая зона с запасом: включается с 16 % хода, гаснет ниже 10 % — дрожь у края не мигает «стоит — идёт»
          if (!J._on && n >= JOY.DZ_ON) { J._on = true; J._hd = th; } else if (J._on && n < JOY.DZ_OFF) J._on = false;
          if (J._on) {
            // курс держится, пока палец дрожит в пределах ~2 px дуги; дальше — тянется за пальцем (отставание не больше полосы)
            const band = clamp(JOY.HEAD_ARC / Math.max(1, d), JOY.HEAD_MIN, JOY.HEAD_MAX);
            let e = angW(th - J._hd);
            if (Math.abs(e) > band) { J._hd += e - Math.sign(e) * band; e = angW(th - J._hd); }
            J._hd += e * (1 - Math.exp(-dt / JOY.HEAD_T));
          }
          const k = 1 - Math.exp(-dt / JOY.TAU_M);
          J._m += ((J._on ? joyShape(n) : 0) - J._m) * k; J._n += ((J._on ? n : 0) - J._n) * k;
          if (!J._on && J._m < 0.02) J._m = J._n = 0;
          const ux = Math.sin(J._hd), uy = -Math.cos(J._hd);
          J.x = ux * J._m; J.y = uy * J._m; J.m = J._m; J.lx = ux * J._n; J.ly = uy * J._n;
          // бег: палец за порогом (1,4 хода) держит одно направление 0,3 с; назад внутрь хода ручки — шаг. Удержание терпит
          // мелкие и короткие нырки внутрь порога (≤ 0,02 хода и < 150 мс — шум касания), а гаснет сразу, если нырок глубже или
          // палец ведёт по кругу: курс отстаёт от сглаженного (0,1 с) больше 11° — это ~100°/с, то же «30° за 0,3 с», но без
          // мигания кольца на каждом новом отсчёте
          const r = d / T, ea = r < JOY.RUN_OFF ? 0 : angW(th - J._rf);
          J._rf = r < JOY.RUN_OFF ? th : J._rf + ea * (1 - Math.exp(-dt / JOY.SWEEP_T));
          if (!ok || r < JOY.RUN_OFF) { J._rt = J._ro = 0; if (J.run) runCls(false); }
          else if (!J.run) {
            if (Math.abs(ea) > JOY.SWEEP) J._rt = J._ro = 0;
            else if (r >= JOY.RUN_ON) {
              if (!J._rt || Math.abs(angW(th - J._ra)) > JOY.RUN_ANG) { J._rt = now; J._ra = th; }
              J._ro = 0;
            } else if (J._rt) { J._ro = J._ro || now; if (r < JOY.RUN_ON - JOY.RUN_DIP || now - J._ro >= JOY.ARM_OFF) J._rt = J._ro = 0; }
            if (J._rt && now - J._rt >= JOY.RUN_T) runCls(true);
          }
          // золотое кольцо = само удержание (с 80 мс): горит — значит, бег через ≤ 0,22 с; удержание сорвалось — гаснет сразу
          armCls(!!(ok && J._rt && !J.run && now - J._rt >= JOY.ARM_ON));
          // пунктир порога: ручка упёрлась в край (или висит подсказка про бег) — видно, куда тянуться за бегом
          edgeCls(!!(ok && !J.run && (r >= (J._edV ? JOY.EDGE : JOY.RUN_OFF) || now < J._tipEnd)));
          // подсказка: долго идёт «до упора» и ещё не бегала — «За край кружка — бег» над кружком (2 раза за всё время)
          if (ok && !J.run && !J._ran && J._m >= 0.98) {
            J._fullT += dt;
            if (J._fullT >= JOY.TIP_T && !J._tip) {
              // над кружком, выше ручки «до упора» (она выходит за кольцо), чтобы подпись не легла на ручку
              const dd = dims(), mm = metrics(dd.W, dd.H), gap = Math.max(8, Math.round(J.travel + mm.joy.knob / 2 - mm.joy.r + 8));
              J._tip = true;
              if (HUD.coach(el, 'За край кружка — бег', 'joy-run', { above: true, gap, max: JOY.TIP_N })) J._tipEnd = now + 2500;
            }
          } else J._fullT = 0;
          return J.run;
        },
        running(ok) { return J.frame(ok); },
        end() {
          J.active = false; J.x = J.y = J.m = J.lx = J.ly = J.r = 0; J._m = J._n = 0; J._on = false; J._rt = J._ro = J._tipEnd = 0; J._fullT = 0;
          if (J.run) runCls(false);
          armCls(false); edgeCls(false);
          knob.style.transform = '';
          el.classList.remove('live'); el.classList.add('rest', 'back');
          J.layout();
          clearTimeout(J._bt); J._bt = setTimeout(() => el.classList.remove('back'), 220);
        },
        // в покое — только на сенсорных экранах; под пальцем — всегда
        show(on) {
          const vis = !!(on && (coarse() || J.active || o.always));
          if (vis !== J.vis) { J.vis = vis; el.classList.toggle('hidden', !vis); }
          J.want = !!on; if (vis && !J.active) J.layout();
        },
        dispose() { clearTimeout(J._bt); joys.delete(J); el.remove(); },
      };
      joys.add(J);
      J.layout();
      return J;
    },
  };

  /* ---------- За рулём: кнопки руля слева, педали справа (как в гонках на телефоне) ---------- */
  // руль: держать «‹‹»/«››» — поворот сразу с DRV.KICK (короткий тап — лёгкая поправка), дальше доворачивается DRV.IN в секунду
  // (до упора ≈ 0,3 с); отпустила — руль сам к центру (DRV.OUT в секунду); обе сразу — прямо. Педали: «газ» — ехать, «тормоз» —
  // тормозить, на месте — назад (это решает игра). Каждая кнопка — свой палец (мультитач). Пока показан — на <body> класс
  // .hud-driving: джойстик спрятан, радар поднят над кнопками руля (style.css)
  const DRV = HUD.DRV = { KICK: 0.3, IN: 2.6, OUT: 5 };
  const drives = new Set();   // показанные сейчас (у города и у гор — свои): body.hud-driving, пока есть хоть один
  const drivingCls = () => document.body.classList.toggle('hud-driving', drives.size > 0);
  const STEER_SVG = d => `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">` +
    (d < 0 ? '<path d="M24,12 L12,24 L24,36"/><path d="M36,12 L24,24 L36,36"/>' : '<path d="M12,12 L24,24 L12,36"/><path d="M24,12 L36,24 L24,36"/>') + '</g></svg>';
  HUD.driveCtl = {
    // o.pedals: false — без своих педалей (у гор свои .wr-pedal); o.always — показывать и без сенсорного экрана
    create(host, o = {}) {
      const el = document.createElement('div');
      el.className = 'hud-drive hidden';
      el.innerHTML = `<button type="button" class="hud-steer l" data-hud-slot="steerL" aria-label="Руль влево" title="Руль влево">${STEER_SVG(-1)}</button>` +
        `<button type="button" class="hud-steer r" data-hud-slot="steerR" aria-label="Руль вправо" title="Руль вправо">${STEER_SVG(1)}</button>` +
        (o.pedals === false ? '' : '<button type="button" class="hud-pedal" data-hud-slot="brake" aria-label="Тормоз">тормоз</button>' +
          '<button type="button" class="hud-pedal" data-hud-slot="gas" aria-label="Газ">газ</button>');
      if (host) host.appendChild(el);
      const q = s => el.querySelector(s);
      const btn = { l: q('.hud-steer.l'), r: q('.hud-steer.r'), gas: q('[data-hud-slot="gas"]'), brake: q('[data-hud-slot="brake"]') };
      const down = { l: null, r: null, gas: null, brake: null };   // id пальца на кнопке (или null)
      const D = { el, btn, vis: false, str: 0, gas: false, brake: false };
      const set = (k, id) => { down[k] = id; if (btn[k]) btn[k].classList.toggle('down', id !== null); };
      Object.keys(btn).forEach(k => {
        const b = btn[k]; if (!b) return;
        b.addEventListener('pointerdown', e => {
          e.preventDefault(); e.stopPropagation(); set(k, e.pointerId);
          try { b.setPointerCapture(e.pointerId); } catch (er) { /* старый браузер */ }
          try { if (navigator.vibrate) navigator.vibrate(6); } catch (er) { /* нет */ }
        });
        const up = e => { e.stopPropagation(); if (down[k] === e.pointerId) set(k, null); };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
        ['touchstart', 'touchend', 'mousedown', 'click', 'contextmenu'].forEach(t => b.addEventListener(t, ev => { ev.stopPropagation(); if (ev.cancelable && t !== 'touchstart') ev.preventDefault(); }, { passive: false }));
      });
      D.release = () => { Object.keys(down).forEach(k => set(k, null)); D.str = 0; D.gas = D.brake = false; };
      // раз в кадр → { str −1…1 (вправо +), gas, brake }; спрятан — всё отпущено
      D.frame = dt => {
        dt = clamp(dt || 0, 0, 0.1);
        if (!D.vis) { if (D.str || D.gas || D.brake) D.release(); return { str: 0, gas: false, brake: false }; }
        const t = (down.r !== null ? 1 : 0) - (down.l !== null ? 1 : 0);
        if (t) { if (D.str * t < DRV.KICK) D.str = t * DRV.KICK; D.str = clamp(D.str + t * DRV.IN * dt, -1, 1); }
        else { const k = DRV.OUT * dt; D.str = Math.abs(D.str) <= k ? 0 : D.str - Math.sign(D.str) * k; }
        D.gas = down.gas !== null; D.brake = down.brake !== null;
        return { str: D.str, gas: D.gas, brake: D.brake };
      };
      // показать за рулём (только на сенсорных экранах: на компьютере — стрелки); спрятать — отпустить всё
      D.show = on => {
        const vis = !!(on && (coarse() || o.always));
        if (vis === D.vis) return;
        D.vis = vis; el.classList.toggle('hidden', !vis);
        if (vis) drives.add(D); else drives.delete(D);
        drivingCls();
        if (!vis) D.release();
      };
      D.dispose = () => { D.show(false); el.remove(); };
      return D;
    },
  };

  /* ---------- Тост (§3.3) ---------- */
  HUD.toast = function (text, ms, o) {
    const g = G_(); if (!g || !g.toast || !text) return;
    if (ms && typeof ms === 'object') { o = ms; ms = ms.ms; }
    o = o || {};
    g.toast(text, ms, Object.assign({ queue: !o.replace }, o));
  };
  HUD.arrive = (title, sub) => HUD.toast(sub ? title + '\n' + sub : title, 3000, { kind: 'place', sub: sub || '' });

  /* ---------- Первая подсказка у маленькой кнопки ---------- */
  // o.max — сколько раз за всё время (по умолчанию 3); o.above — над элементом по центру (джойстик; o.gap — зазор, px), иначе — слева от кнопки
  HUD.coach = function (el, text, key, o) {
    if (!el || !text) return false;
    o = o || {};
    const g = G_(), st = g && g.state ? g.state() : null, max = o.max || 3;
    key = key || text;
    if (st) { st.hudSeen = st.hudSeen || {}; if ((st.hudSeen[key] || 0) >= max) return false; st.hudSeen[key] = (st.hudSeen[key] || 0) + 1; try { g.save(); } catch (e) { /* ignore */ } }
    const host = el.offsetParent || el.parentNode; if (!host) return false;
    const t = document.createElement('div'); t.className = 'hud-coach'; t.textContent = text;
    const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (o.above) { t.style.left = Math.round(r.left - hr.left + r.width / 2) + 'px'; t.style.top = Math.round(r.top - hr.top - (o.gap || 8)) + 'px'; t.style.transform = 'translate(-50%, -100%)'; }
    else { t.style.right = Math.round(hr.right - r.left + 8) + 'px'; t.style.top = Math.round(r.top - hr.top + r.height / 2) + 'px'; }
    host.appendChild(t);
    // над кружком у края экрана — подпись целиком на экране (не ближе 8 px к краю)
    if (o.above) { const w = t.offsetWidth || 0, c = r.left - hr.left + r.width / 2; t.style.left = Math.round(clamp(c, 8 + w / 2, Math.max(8 + w / 2, hr.width - 8 - w / 2))) + 'px'; }
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2500);
    return true;
  };

  /* ---------- Шеврон у края и зажим ярлыков (§3.7) ---------- */
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  HUD.chevY = (y, H) => { const m = metrics(null, H); return clamp(y, m.barBottom + 30, Math.max(m.barBottom + 30, Math.min(m.H - m.B0 - 284, m.H * 0.5 - 60))); };
  HUD.labelY = (y, H) => { const m = metrics(null, H); return clamp(y, m.barBottom + 72, Math.max(m.barBottom + 72, m.H - m.B0 - 232)); };
  HUD.chev = function (el, o) {
    if (!el) return;
    if (!o || !o.on) { el.classList.add('hidden'); return; }
    el.classList.add('hud-chev'); el.classList.remove('hidden');
    if (!el.querySelector('.hud-chev-c')) el.innerHTML = `<span class="hud-chev-c">${CHEV}</span><b class="hud-chev-d"></b>`;
    el.dataset.side = o.side;
    el.style.left = Math.round(o.x) + 'px'; el.style.top = Math.round(o.y) + 'px';
    el.querySelector('.hud-chev-c').style.setProperty('--rot', (o.rot || 0).toFixed(1) + 'deg');
    // ближе 4 м пилюля цели пишет «ты на месте» — у шеврона тогда без числа (только направление)
    const d = el.querySelector('.hud-chev-d'); const t = o.dist == null ? '' : (typeof o.dist === 'number' ? (o.dist < 4 ? '' : Math.round(o.dist) + ' м') : String(o.dist));
    if (d.textContent !== t) d.textContent = t;
    d.classList.toggle('hidden', !t);
    if (o.label) el.setAttribute('aria-label', o.label);
  };

  // шеврон у левого/правого края экрана (улица-запас, 2D-улица): side 'l' | 'r' | null (спрятать); y — по умолчанию 46 % высоты
  HUD.chevAt = function (el, side, o) {
    if (!el) return;
    if (!side) { HUD.chev(el, null); return; }
    o = o || {};
    const host = el.offsetParent || el.parentNode || app(), W = host.clientWidth || app().clientWidth, H = host.clientHeight || app().clientHeight, m = metrics(W, H);
    const x = side === 'l' ? 26 + m.safe.l : W - 26 - m.safe.r;
    HUD.chev(el, { on: true, x, y: HUD.chevY(o.y == null ? H * 0.46 : o.y, H), side, rot: side === 'l' ? 180 : 0, dist: o.dist, label: o.label });
  };

  /* ---------- Лист меню ☰ (§3.2) ---------- */
  const ITEMS = new Map();
  let menuEl = null, menuInfo = null, menuNote = null, hudTitle = '';
  const val = (v, d) => { try { return typeof v === 'function' ? v() : (v === undefined ? d : v); } catch (e) { return d; } };
  const visibleItem = it => { const f = it.when || it.visible; if (!f) return true; try { return !!f(); } catch (e) { return false; } };
  function menuRow(it) {
    const on = it.toggle ? !!val(it.on, false) : null;
    const lab = val(it.label, ''), sub = val(it.sub, ''), value = val(it.value, ''), badge = val(it.badge, '');
    return `<button type="button" class="hud-mrow${it.tint ? ' t-' + esc(it.tint) : ''}${on ? ' on' : ''}" data-id="${esc(it.id)}"${it.elId ? ` id="${esc(it.elId)}"` : ''}${it.toggle ? ` role="switch" aria-checked="${on}"` : ''}>` +
      `<span class="hud-mi" aria-hidden="true">${esc(val(it.icon, '•'))}</span>` +
      `<span class="hud-mt"><b>${esc(lab)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>` +
      (badge !== '' && badge != null && badge !== 0 ? `<span class="hud-mb">${esc(badge)}</span>` : '') +
      (value ? `<span class="hud-mv">${esc(value)}</span>` : '') +
      (it.toggle ? '<span class="lc-sw" aria-hidden="true"></span>' : '') +
      (it.news ? '<span class="hud-dot" aria-hidden="true"></span>' : '') + '</button>';
  }
  function menuList() { return [...ITEMS.values()].filter(visibleItem).sort((a, b) => (a.order || 50) - (b.order || 50)); }
  // метка сборки внизу листа: мелко и тихо, в нижнем отступе списка (лист выше всего на 7 px); автор читает её и пересылает нам
  const buildText = () => { const b = window.BUILD_INFO; return b && b.id ? 'версия ' + (b.at ? b.at + ' · ' : '') + b.id : 'версия dev'; };
  HUD.build = buildText;
  const VER_CSS = 'margin:-1px 0 -10px;font-size:10.5px;font-weight:700;line-height:12px;text-align:center;color:var(--ink-2);opacity:.85;letter-spacing:.02em';
  function menuDraw() {
    if (!menuEl) return;
    const info = val(menuInfo, ''), note = val(menuNote, '');
    menuEl.querySelector('.sheet-title').textContent = hudTitle || 'Меню';
    const sub = menuEl.querySelector('.hud-msub');
    sub.innerHTML = (info ? `<div>${esc(info)}</div>` : '') + (note ? `<div class="hud-mnote">${esc(note)}</div>` : '');
    sub.classList.toggle('hidden', !info && !note);
    menuEl.querySelector('.hud-mlist').innerHTML = menuList().map(menuRow).join('') + `<div class="hud-mver" style="${VER_CSS}">${esc(buildText())}</div>`;
  }
  function menuOpen() {
    if (menuEl && menuEl.isConnected) return menuEl;
    const L = layerEl(); if (!L) return null;
    const m = document.createElement('div'); m.className = 'modal sheet hud-menu';
    m.innerHTML = '<div class="sheet-card" role="dialog" aria-label="Меню"><div class="sheet-head"><div class="hud-mhead"><div class="sheet-title"></div><div class="hud-msub hidden"></div></div>' +
      '<button class="sheet-x" type="button" aria-label="Закрыть">✕</button></div><div class="sheet-body hud-mlist"></div></div>';
    menuEl = m; menuDraw();
    let lp = null, long = false;
    const rowOf = e => e.target.closest && e.target.closest('.hud-mrow');
    m.addEventListener('pointerdown', e => {
      const r = rowOf(e); if (!r) return; const it = ITEMS.get(r.dataset.id); long = false; clearTimeout(lp);
      if (it && it.onLong) lp = setTimeout(() => { long = true; haptic('medium'); menuClose(); try { it.onLong(); } catch (er) { console.warn('hud menu', er); } }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => m.addEventListener(ev, () => clearTimeout(lp)));
    m.addEventListener('contextmenu', e => { if (rowOf(e)) e.preventDefault(); });
    m.addEventListener('click', e => {
      if (e.target === m || (e.target.closest && e.target.closest('.sheet-x'))) { haptic('light'); menuClose(); return; }
      const r = rowOf(e); if (!r) return;
      if (long) { long = false; return; }
      const it = ITEMS.get(r.dataset.id); if (!it) return;
      haptic('select'); tapSfx(); it.news = false;
      const f = it.onTap || it.onClick;
      if (it.keepOpen || it.toggle) { try { if (f) f(); } catch (er) { console.warn('hud menu', er); } menuDraw(); return; }
      // действие — когда лист меню уже убран из #layer: пока он там (уезжает 230 мс), город и регион считают экран занятым
      // (blocked() видит #layer .modal) — и, например, «🗺 Карта» не открывалась
      menuClose(() => { try { if (f) f(); } catch (er) { console.warn('hud menu', er); } });
    });
    L.appendChild(m); document.body.classList.add('sheet-on');
    news(false);
    return m;
  }
  function menuClose(after) {
    const m = menuEl; menuEl = null;
    if (!m || !m.isConnected) { if (after) after(); return; }
    m.classList.add('out'); setTimeout(() => { m.remove(); if (!document.querySelector('#layer .modal.sheet')) document.body.classList.remove('sheet-on'); if (after) after(); }, 230);
  }
  function news(on) {
    const b = document.getElementById('hudMenu'); if (b) b.classList.toggle('news', !!on);
    HUD._news = !!on;
  }
  HUD.menu = {
    add(it) { if (!it || !it.id) return () => {}; const prev = ITEMS.get(it.id); ITEMS.set(it.id, Object.assign({}, prev && prev._keep ? prev : {}, it)); if (menuEl) menuDraw(); return () => HUD.menu.remove(it.id); },
    remove(id) { ITEMS.delete(id); if (menuEl) menuDraw(); },
    update(id, patch) { const it = ITEMS.get(id); if (it) Object.assign(it, patch || {}); if (menuEl) menuDraw(); },
    get: id => ITEMS.get(id) || null,
    list: () => menuList().map(it => ({ id: it.id, label: val(it.label, ''), icon: val(it.icon, '') })),
    open: menuOpen, close: menuClose, redraw: menuDraw,
    isOpen: () => !!(menuEl && menuEl.isConnected),
    // точка-новость: на ☰ (без id) или у строки
    news(id, on) { if (id === undefined || id === null || id === true || id === false) { news(id !== false); return; } const it = ITEMS.get(id); if (it) it.news = on !== false; if (on !== false) news(true); if (menuEl) menuDraw(); },
    info(f) { menuInfo = f; if (menuEl) menuDraw(); },
    note(t) { menuNote = t || null; if (menuEl) menuDraw(); },
    noteText: () => val(menuNote, '') || '', infoText: () => val(menuInfo, '') || '', titleText: () => hudTitle,
    title(t) { hudTitle = t || ''; if (menuEl) menuDraw(); },
  };

  /* ---------- Цель: пилюля в полосе + карточка по тапу (§3.1) ---------- */
  let OBJ = null, objDist = null, objEl = null, cardEl = null, cardT = 0, objKey = '';
  function objEnsure() {
    const hud = document.getElementById('hud');
    if (!objEl) {
      objEl = document.createElement('button'); objEl.type = 'button'; objEl.id = 'hudObj'; objEl.className = 'hud-obj hidden';
      objEl.innerHTML = '<i aria-hidden="true"></i><b></b><em></em>';
      objEl.addEventListener('click', e => { e.stopPropagation(); haptic('light'); if (cardEl && !cardEl.classList.contains('hidden')) objCardTap(); else objExpand(4000); });
    }
    if (!cardEl) {
      cardEl = document.createElement('div'); cardEl.className = 'hud-card w-case hidden';
      cardEl.innerHTML = '<div class="w-case-t"><span class="w-case-i"></span><span class="hud-card-tt"></span></div><div class="w-case-x"></div><div class="w-case-d"></div><div class="w-case-p"></div>';
      cardEl.addEventListener('click', e => { e.stopPropagation(); objCardTap(); });
    }
    if (hud) {
      const sp = hud.querySelector('.hud-sp');
      if (objEl.parentNode !== hud) { if (sp) hud.insertBefore(objEl, sp); else hud.appendChild(objEl); }
      if (cardEl.parentNode !== hud) hud.appendChild(cardEl);
    }
  }
  function objCardTap() {
    haptic('light');
    const o = OBJ; objCollapse();
    if (o && o.onTap) { try { o.onTap(); } catch (e) { console.warn('hud obj', e); } }
  }
  function objPaint() {
    objEnsure();
    const o = OBJ;
    if (!o) { objEl.classList.add('hidden'); objCollapse(); return; }
    objEl.classList.remove('hidden');
    objEl.querySelector('i').textContent = o.icon || '🔍';
    objEl.querySelector('b').textContent = o.text || '';
    const dt = objDist == null ? (o.dist == null ? '' : o.dist) : objDist;
    const ds = typeof dt === 'number' ? (dt < 4 ? 'ты на месте' : Math.round(dt) + ' м') : String(dt || '');
    const em = objEl.querySelector('em'); em.textContent = ds; em.classList.toggle('hidden', !ds);
    objEl.setAttribute('aria-label', (o.title ? o.title + ': ' : '') + (o.full || o.text || '') + (ds ? ' · ' + ds : ''));
    // карточка
    cardEl.querySelector('.w-case-i').textContent = o.icon || '🔍';
    cardEl.querySelector('.hud-card-tt').textContent = o.title || 'Сегодняшнее дело';
    cardEl.querySelector('.w-case-x').textContent = o.full || o.text || '';
    cardEl.querySelector('.w-case-d').textContent = ds;
    const p = o.progress;
    cardEl.querySelector('.w-case-p').innerHTML = p && p[1] ? Array.from({ length: p[1] }, (_, i) => `<i class="${i < p[0] ? 'on' : ''}"></i>`).join('') : '';
    cardEl.classList.toggle('lock', !!o.lock);
  }
  function objExpand(ms) {
    if (!OBJ) return;
    objEnsure(); objPaint();
    cardEl.classList.remove('hidden'); document.body.classList.add('hud-card-on');
    try { document.body.style.setProperty('--hud-card-h', Math.round(cardEl.offsetHeight || 96) + 'px'); } catch (e) { /* ignore */ }
    clearTimeout(cardT); cardT = setTimeout(objCollapse, ms || 4000);
  }
  function objCollapse() { clearTimeout(cardT); if (cardEl) cardEl.classList.add('hidden'); document.body.classList.remove('hud-card-on'); }
  HUD.objective = {
    set(o) {
      const key = o ? [o.icon, o.text, o.title, o.full, o.progress && o.progress.join('/')].join('|') : '';
      const fresh = key && key !== objKey;
      OBJ = o || null; objKey = key; if (!o || fresh) objDist = o && o.dist != null ? o.dist : null;
      objPaint();
      if (fresh && o && o.bounce !== false) {
        objEl.classList.remove('hop'); void objEl.offsetWidth; objEl.classList.add('hop');
        if (o.expand !== false) objExpand(3500);
      }
    },
    dist(m) {
      const v = m == null ? null : (typeof m === 'number' ? Math.round(m) : m);
      if (v === objDist) return; objDist = v; if (OBJ) objPaint();
    },
    expand: objExpand, collapse: objCollapse,
    get: () => OBJ,
    el: () => objEl, card: () => cardEl,
  };

  /* ---------- Правый слот полосы ---------- */
  let STATUS = null;
  function statusPaint() {
    const box = document.getElementById('hudStatus'); if (!box) return;
    const g = G_(), s = STATUS;
    const hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('hud-top', !!(s && s.kind === 'exit' && s.top !== false));
    if (!s) {
      if (box.dataset.kind === 'sound' && box.querySelector('#hudSound')) { box.querySelector('#hudSound').textContent = g ? g.soundIcon() : '🔊'; return; }
      box.dataset.kind = 'sound';
      box.innerHTML = `<button class="hud-ib" id="hudSound" type="button" aria-label="Звук">${g ? g.soundIcon() : '🔊'}</button>`;
      if (g && g.bindSoundBtn) g.bindSoundBtn(box.querySelector('#hudSound'));
      return;
    }
    box.dataset.kind = s.kind;
    if (s.kind === 'exit' || s.kind === 'close') {
      const icon = s.icon || (s.kind === 'close' ? '✕' : '🚪');
      box.innerHTML = `<button class="hud-ib ${s.kind === 'exit' ? 'exit' : 'close'}" id="${s.kind === 'exit' ? 'hudExit' : 'hudClose'}" type="button" aria-label="${esc(s.label || (s.kind === 'exit' ? 'Выйти' : 'Закрыть'))}" title="${esc(s.label || '')}">${esc(icon)}</button>`;
      box.firstChild.addEventListener('click', e => { e.stopPropagation(); haptic('light'); if (s.onTap) s.onTap(); });
    } else if (s.kind === 'chip') {
      box.innerHTML = `<div class="hud-chip-speed" role="status">${esc(s.text || '')}</div>`;
    } else box.innerHTML = '';
  }
  HUD.status = function (o) {
    if (o && o.kind === 'chip' && STATUS && STATUS.kind === 'chip') {
      STATUS = o; const c = document.querySelector('#hudStatus .hud-chip-speed'); if (c) { if (c.textContent !== o.text) c.textContent = o.text || ''; return; }
    }
    STATUS = o || null; statusPaint();
  };
  HUD.status.get = () => STATUS;

  /* ---------- Верхняя полоса (рисует G.setHud) ---------- */
  const MENU_SVG = '<svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><g stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M2 2h14"/><path d="M2 7h14"/><path d="M2 12h14"/></g></svg>';
  let barOpts = {};
  function exitMenuLabel(t) {
    const s = String(t || '').replace(/^[←⬅\s]+/, '').trim();
    if (/меню/i.test(s)) return { icon: '📖', label: 'В меню сезона' };
    if (/улиц/i.test(s)) return { icon: '🚪', label: 'На улицу' };
    if (/город/i.test(s)) return { icon: '🏙', label: s.charAt(0).toUpperCase() + s.slice(1) };
    return { icon: '↩️', label: s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Выйти' };
  }
  HUD.topBar = {
    render(hud, opts = {}) {
      hud = hud || document.getElementById('hud'); if (!hud) return;
      barOpts = opts;
      hud.classList.add('hud2'); hud.classList.remove('hidden');
      hud.innerHTML = `<button class="hud-ib" id="hudMenu" type="button" aria-label="Меню">${MENU_SVG}<span class="hud-dot" aria-hidden="true"></span></button><div class="hud-sp"></div><div id="hudStatus"></div>`;
      const mb = hud.querySelector('#hudMenu');
      let lp = null;
      mb.addEventListener('pointerdown', () => { clearTimeout(lp); lp = setTimeout(() => { lp = null; }, 550); });
      mb.addEventListener('click', e => { e.stopPropagation(); haptic('light'); tapSfx(); if (HUD.menu.isOpen()) menuClose(); else menuOpen(); });
      mb.classList.toggle('news', !!HUD._news);
      hudTitle = opts.label ? String(opts.label) : '';
      menuInfo = opts.menuSub || null;
      // выход: строка меню (город, регионы, 2D) и/или 🚪 в правом слоте (комнаты и места)
      const place = opts.exitPlace || (opts.onExit && /улиц/i.test(opts.exitText || '← на улицу') ? 'bar' : 'menu');
      if (opts.onExit) {
        const em = opts.exitMenu || exitMenuLabel(opts.exitText || '← на улицу');
        ITEMS.set('exit', { id: 'exit', icon: em.icon, label: em.label, order: 90, onTap: () => { const f = barOpts.onExit; if (f) f(); } });
      } else ITEMS.delete('exit');
      (opts.menu || []).forEach(it => HUD.menu.add(it));
      objEnsure(); objPaint();
      if (opts.status !== undefined) STATUS = opts.status;
      else if (opts.onExit && place === 'bar') STATUS = { kind: 'exit', icon: '🚪', label: String(opts.exitText || '← на улицу').replace(/^[←\s]+/, ''), onTap: () => { const f = barOpts.onExit; if (f) f(); }, top: opts.top !== false };
      else STATUS = null;
      statusPaint();
      if (opts.top !== undefined && !(STATUS && STATUS.kind === 'exit')) hud.classList.toggle('hud-top', !!opts.top);
      if (menuEl) menuDraw();
    },
    el: () => document.getElementById('hud'),
    opts: () => barOpts,
    refreshSound() { statusPaint(); if (menuEl) menuDraw(); },
  };

  /* ---------- Встроенные строки меню: блокнот, звук, как играть ---------- */
  function builtins() {
    HUD.menu.add({ id: 'nb', elId: 'hudNb', icon: '📒', label: 'Блокнот', order: 20, badge: () => { const g = G_(); return g && g.nbCount ? g.nbCount() || '' : ''; }, onTap: () => { const g = G_(); if (g && g.notebook) g.notebook(); } });
    HUD.menu.add({ id: 'sound', icon: () => { const g = G_(); return g ? g.soundIcon() : '🔊'; }, label: 'Звук', sub: 'долгое нажатие — настройки', order: 30, toggle: true,
      on: () => { const g = G_(); return !!(g && g.state && g.state().sound); },
      onTap: () => { const g = G_(); if (g && g.toggleSound) g.toggleSound(null); },
      onLong: () => { const g = G_(); if (g && g.soundSheet) g.soundSheet(); } });
    HUD.menu.add({ id: 'help', icon: '❓', label: 'Как играть', order: 80, onTap: helpSheet });
  }
  function helpSheet() {
    const L = layerEl(); if (!L) return;
    const touch = coarse();
    // HUD.helpTop() → { icon, title, sub, onTap } | null — строка сверху от сцены (город: «Что тут делать?»)
    let top = null; try { top = typeof HUD.helpTop === 'function' ? HUD.helpTop() : null; } catch (e) { top = null; }
    const m = document.createElement('div'); m.className = 'modal sheet hud-help';
    const rows = touch
      ? [['🕹', 'Кружок — идти', 'палец внизу слева — кружок встанет под него; дальше от центра — быстрее'],
        ['👟', 'За край кружка — бег', 'дотянись подальше за край кружка и подержи — кружок засияет'],
        ['🦘', 'Прыжок — кнопка справа', 'над большой кнопкой'],
        ['🚗', 'За рулём — кнопки', 'слева «‹‹» «››» — руль, справа — газ и тормоз; стоишь и жмёшь тормоз — назад'],
        ['👆', 'Тап по двери — подойти', 'или по любому месту на земле'],
        ['🔴', 'Большая кнопка — действие', 'войти, поговорить, сесть; без дела — помахать'],
        ['🗺', 'Карта — слева внизу', 'тап по кружку карты — большая карта'],
        ['✌️', 'Камера', 'проведи пальцем вверху; двумя — ближе или дальше']]
      : [['⌨️', 'WASD или стрелки — идти', 'Shift — бег, пробел — прыжок'], ['⏎', 'Enter — действие', 'войти, поговорить, сесть'], ['🖱', 'Мышь — камера', 'Q/E — повернуть, колёсико — ближе'], ['🗺', 'Карта — слева внизу', 'клик по кружку карты — большая карта']];
    m.innerHTML = '<div class="sheet-card" role="dialog"><div class="sheet-head"><div class="sheet-title">Как играть</div><button class="sheet-x" type="button" aria-label="Закрыть">✕</button></div><div class="sheet-body hud-mlist">' +
      (top ? `<button type="button" class="hud-mrow t-sun hud-help-top"><span class="hud-mi" aria-hidden="true">${esc(top.icon || '💡')}</span><span class="hud-mt"><b>${esc(top.title)}</b><span>${esc(top.sub || '')}</span></span></button>` : '') +
      rows.map(r => `<div class="hud-mrow static"><span class="hud-mi" aria-hidden="true">${r[0]}</span><span class="hud-mt"><b>${esc(r[1])}</b><span>${esc(r[2])}</span></span></div>`).join('') + '</div></div>';
    const close = () => { m.classList.add('out'); setTimeout(() => { m.remove(); if (!document.querySelector('#layer .modal.sheet')) document.body.classList.remove('sheet-on'); }, 230); };
    m.addEventListener('click', e => { if (e.target === m || (e.target.closest && e.target.closest('.sheet-x'))) close(); });
    const tb = top && m.querySelector('.hud-help-top');
    if (tb) tb.addEventListener('click', e => { e.stopPropagation(); haptic('light'); tapSfx(); close(); setTimeout(() => { try { top.onTap(); } catch (x) { /* сцена ушла */ } }, 260); });
    L.appendChild(m); document.body.classList.add('sheet-on');
  }
  HUD.help = helpSheet;

  /* ---------- Тише, когда открыт диалог, лист или карта (§3.8) ---------- */
  const QUIET_SEL = '.dlg-wrap, .modal, .wr-sheet, .img-full, .wmm-sheet';
  function quietSync() {
    const L = layerEl(); if (!L) return;
    let q = false;
    try { q = !!L.querySelector(QUIET_SEL); } catch (e) { q = false; }
    document.body.classList.toggle('hud-quiet', q);
  }
  HUD.quietSync = quietSync;
  function watch() {
    const L = layerEl(); if (!L || L._hudObs) return;
    try { const ob = new MutationObserver(quietSync); ob.observe(L, { childList: true, subtree: false }); L._hudObs = ob; } catch (e) { /* ignore */ }
    quietSync();
  }

  /* ---------- Прямоугольники для тестов перекрытий ---------- */
  const RECT_SEL = [
    ['menu', '#hudMenu'], ['obj', '#hudObj'], ['status', '#hudStatus > *'], ['card', '#hud .hud-card'], ['toast', '.toast'],
    ['radar', '.wmm-wrap'], ['joy', '.hud-joy, .city3d .joy'], ['pad', '.pad-ctl .ctl'], ['slot', '[data-hud-slot]:not(.hud-joy):not(.wmm-wrap)'], ['chev', '.hud-chev'],
    ['edge', '.w-edge:not(.hud-chev), .edge-arrow:not(.hud-chev)'], ['act', '.w-act, .ctl.act'], ['near', '.w-near, .near-bubble'],
  ];
  HUD.rects = function (root) {
    root = root || app();
    const A = app().getBoundingClientRect(), out = [], seen = new Set();
    RECT_SEL.forEach(([k, sel]) => {
      let list = []; try { list = root.querySelectorAll(sel); } catch (e) { list = []; }
      list.forEach(el => {
        if (seen.has(el)) return;
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        let cs; try { cs = getComputedStyle(el); } catch (e) { return; }
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        let op = 1; for (let n = el; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none') return; op *= parseFloat(c.opacity); }
        if (op < 0.05) return;
        seen.add(el);
        const round = /50%/.test(cs.borderRadius) || parseFloat(cs.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 1;
        out.push({ k, el, slot: el.dataset ? el.dataset.hudSlot || '' : '', x0: r.left - A.left, y0: r.top - A.top, x1: r.right - A.left, y1: r.bottom - A.top, round });
      });
    });
    return out;
  };

  /* ---------- Telegram: края (Bot API 8.0+) ---------- */
  function tgSafe() {
    const TG = window.Telegram && window.Telegram.WebApp;
    if (!TG) return;
    const put = () => {
      try {
        const s = TG.safeAreaInset || {}, c = TG.contentSafeAreaInset || {}, R = document.documentElement.style;
        R.setProperty('--tg-safe-top', (s.top | 0) + 'px'); R.setProperty('--tg-safe-bottom', (s.bottom | 0) + 'px');
        R.setProperty('--tg-content-top', (c.top | 0) + 'px');
        probeVal = null; HUD.layout();
      } catch (e) { /* ignore */ }
    };
    try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0')) { put(); TG.onEvent('safeAreaChanged', put); TG.onEvent('contentSafeAreaChanged', put); } } catch (e) { /* ignore */ }
  }
  HUD.tgSafe = tgSafe;

  function boot() { watch(); builtins(); tgSafe(); HUD.layout(); console.info('[delo1010] build', buildText().replace(/^версия /, '')); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  if (window.WORLD) window.WORLD.hud = HUD;
})();
