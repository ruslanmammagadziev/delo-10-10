/* =====================================================================
   HUD v2 — общий интерфейс поверх игры (город, регионы, улица, 2D): «аккуратно с телефона».
   Одна тонкая полоса сверху (☰ · цель · один значок), радар слева внизу, джойстик снизу по центру, справа внизу —
   главная кнопка P и дуга маленьких круглых кнопок. Спецификация — plan2/hud_spec.md (§1 токены, §2 геометрия, §8 API).
   Не зависит от THREE и WORLD при загрузке; окно — window.HUD (и WORLD.hud, если WORLD есть).

   HUD.v                                  — 1
   HUD.metrics(W, H)                      → { top, barBottom, g, B0, R0, L0, safe:{t,b,l,r}, radar:{x,y,d}, joy:{cx,cy,d,r,knob,travel},
                                              zone:{x1,y0}, P:{cx,cy,d}, slots:{s1..s4:{cx,cy}}, a2:{bottom,top}, gas, brake }
   HUD.joyZone(x, y, W, H)                → начинать ли джойстик с этого касания (кнопки проверяет вызывающий)
   HUD.joyPlace(x, y, W, H)               → { cx, cy } — центр круга под пальцем (зажат: радар, дуга, низ)
   HUD.joyRest(W, H)                      → { cx, cy } — место покоя
   HUD.layout(root?)                      — пишет --hud-joy-cx (px) на #app; зовётся сам на resize
   HUD.actFace(label)                     → { icon, short, full, known } — лицо главной кнопки по подписи
   HUD.paintAct(btn, label, soft)         — <i>значок</i><b>слово</b>, aria-label/title/data-full = подпись
   HUD.slot(el, name)                     — data-hud-slot = P | s1..s4 | a2 | gas | brake | joy | radar
   HUD.mode(root, mode)                   — data-hud-mode = walk|drive|drive-pedals|ride|fly|sit|look|dance|zip|sport|room|street|2d
   HUD.sbtn(host, { slot, icon, label, cls, onPress }) → кнопка 46 px в слоте (значок; подпись — aria-label)
   HUD.actions.set(host, [{ id, icon, label, onPress, slot?, main?, on?, soft? }]) — набор кнопок кластера (лишние прячутся)
   HUD.joystick.create(host, o?)          → J: { el, knob, zone(x,y), begin(x,y), drag(x,y) → {x,y,m}, end(), show(on), layout(), active }
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
   HUD.coach(el, text, key)               — первая подсказка у маленькой кнопки (3 раза за всё время)
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
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    const joy = { cx: jcx, cy: jcy, d: jd, r: jr, knob, travel: (jd - knob) / 2 + 4 };
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
  HUD.joyPlace = (x, y, W, H) => {
    const m = metrics(W, H), R = m.joy.r;
    const cx = clamp(x, m.L0 + R, Math.max(m.L0 + R, m.joy.cx));
    let cy = clamp(y, Math.min(m.H * 0.5 + R, m.joy.cy), m.joy.cy);
    const rd = m.radar;
    if (cx - R < rd.x + rd.d + GAP && cy + R > rd.y - GAP) cy = rd.y - GAP - R;
    return { cx, cy };
  };
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
  HUD.joystick = {
    create(host, o = {}) {
      const el = document.createElement('div');
      el.className = 'w-joy joy hud-joy rest hidden' + (o.cls ? ' ' + o.cls : '');
      el.dataset.hudSlot = 'joy';
      el.innerHTML = JOY_SVG + '<div class="joy-knob"></div>';
      if (host) host.appendChild(el);
      const knob = el.querySelector('.joy-knob');
      const dims = () => { const h = o.root || host || app(); return { W: h.clientWidth || app().clientWidth, H: h.clientHeight || app().clientHeight }; };
      const J = {
        el, knob, active: false, cx: 0, cy: 0, x: 0, y: 0, m: 0, want: false,
        zone(x, y) { const d = dims(); return HUD.joyZone(x, y, d.W, d.H); },
        layout() {
          if (J.active) return;
          const d = dims(), m = metrics(d.W, d.H), l = Math.round(m.joy.cx - m.joy.r) + 'px', t = Math.round(m.joy.cy - m.joy.r) + 'px';
          if (J._l === l && J._t === t && el.style.left === l) return;
          J._l = l; J._t = t;
          el.style.left = l; el.style.top = t; el.style.bottom = 'auto';
        },
        begin(x, y) {
          const d = dims(), p = HUD.joyPlace(x, y, d.W, d.H), m = metrics(d.W, d.H);
          J.active = true; J.cx = p.cx; J.cy = p.cy; J.x = J.y = J.m = 0;
          el.classList.remove('rest', 'back'); el.classList.add('live');
          el.style.left = Math.round(p.cx - m.joy.r) + 'px'; el.style.top = Math.round(p.cy - m.joy.r) + 'px'; el.style.bottom = 'auto'; J._l = J._t = null;
          J.travel = m.joy.travel;
          J.drag(x, y);
          return p;
        },
        drag(x, y) {
          if (!J.active) return { x: 0, y: 0, m: 0 };
          let dx = x - J.cx, dy = y - J.cy; const dd = Math.hypot(dx, dy), T = J.travel || 34;
          if (dd > T) { dx *= T / dd; dy *= T / dd; }
          knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
          if (dd < 8) { J.x = J.y = J.m = 0; } else { J.x = dx / T; J.y = dy / T; J.m = Math.min(1, Math.hypot(J.x, J.y)); }
          return { x: J.x, y: J.y, m: J.m };
        },
        end() {
          J.active = false; J.x = J.y = J.m = 0;
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
        dispose() { joys.delete(J); el.remove(); },
      };
      joys.add(J);
      J.layout();
      return J;
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
  HUD.coach = function (el, text, key) {
    if (!el || !text) return;
    const g = G_(), st = g && g.state ? g.state() : null;
    key = key || text;
    if (st) { st.hudSeen = st.hudSeen || {}; if ((st.hudSeen[key] || 0) >= 3) return; st.hudSeen[key] = (st.hudSeen[key] || 0) + 1; try { g.save(); } catch (e) { /* ignore */ } }
    const host = el.offsetParent || el.parentNode; if (!host) return;
    const t = document.createElement('div'); t.className = 'hud-coach'; t.textContent = text;
    const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    t.style.right = Math.round(hr.right - r.left + 8) + 'px'; t.style.top = Math.round(r.top - hr.top + r.height / 2) + 'px';
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2500);
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
      ? [['🕹', 'Кружок внизу — идти', 'палец в нижней половине слева — кружок встанет под него'], ['👆', 'Тап по двери — подойти', 'или по любому месту на земле'], ['🔴', 'Большая кнопка — действие', 'войти, поговорить, сесть; без дела — помахать'], ['🗺', 'Карта — слева внизу', 'тап по кружку карты — большая карта'], ['✌️', 'Камера', 'проведи пальцем вверху; двумя — ближе или дальше']]
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
