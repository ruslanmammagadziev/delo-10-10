/* =====================================================================
   ДЕЛА СЕЗОНА: таблица миссий и всё, что из неё следует для города,
   улицы и 2D. Миссия — подсвеченная дверь (луч, кольцо, 🔍), карточка
   «Сегодняшнее дело» и стрелка у края экрана.
   Пройдена миссия ⇔ чекпоинт миссии есть в st.eps[ep].cp (сохранения прежние).
   Серия 1 играется своим циклом в ep1.js (двери, метки и тексты — отсюда),
   серия 2 и финал — общим циклом Missions.play(ep).
   При загрузке файл не трогает Ep1 / Town / World / WorldHub — только внутри функций.
   ===================================================================== */
(function () {
  'use strict';
  const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } })();
  const DEBUG = /debug=1/.test(location.search);
  const DEFS = [], BY = Object.create(null);
  const S = () => (window.G && typeof G.state === 'function' ? G.state() : { eps: {} });
  const CFG = () => (window.G && G.C) || window.CONFIG || { EPISODES: [] };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lcFirst = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* старый браузер */ } };

  /* ---------- Время: даты открытия по часам телефона ---------- */
  const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function parseWhen(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(s || ''));
    if (!m) return null;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
    return isNaN(t) ? null : t;
  }
  let nowOv = null;   // только для проверок: адрес с отладкой и date=ГГГГ-ММ-ДД[TЧЧ:ММ], или Missions.debug.now(...)
  if (DEBUG) nowOv = parseWhen(QS.get('date'));
  const now = () => (nowOv !== null ? nowOv : Date.now());
  const ddmm = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
  // волна 4: неразрывные пробелы — «21 ноября» и «серии 2» не разрываются переносом строки (тосты, карточки, метки)
  const NB = '\u00A0';
  const dayMonth = t => { const d = new Date(t); return `${d.getDate()}${NB}${RU_MONTHS[d.getMonth()]}`; };
  const epInfo = n => (CFG().EPISODES || []).find(e => e.n === n) || null;
  const epReleased = e => !!e && (e.n === 1 || (!!e.release && parseWhen(e.release) !== null && now() >= parseWhen(e.release)));
  // «21 ноября» / «в декабре» / «совсем скоро» — как на карточках серий в меню
  function epWhen(e) {
    if (!e) return '';
    if (e.when) return e.when;
    if (epReleased(e) && !e.built) return 'совсем скоро';
    const t = parseWhen(e.release);
    return t !== null ? dayMonth(t) : 'совсем скоро';
  }
  // когда открывается миссия: { ok, at, sub } (sub — подпись метки «скоро»: «21.11» или «декабрь»)
  function gate(d) {
    const o = d.opens;
    if (!o) return { ok: true, at: 0, sub: '' };
    if (typeof o === 'string') { const t = parseWhen(o); return { ok: t !== null && now() >= t, at: t, sub: t !== null ? ddmm(t) : '' }; }
    if (typeof o === 'object' && o.ep) {
      const e = epInfo(o.ep);
      if (!e) return { ok: false, at: null, sub: '' };
      if (e.n === 1) return { ok: true, at: 0, sub: '' };
      const t = parseWhen(e.release);
      return { ok: t !== null && now() >= t, at: t, sub: t !== null ? ddmm(t) : (e.when || 'скоро') };
    }
    return { ok: false, at: null, sub: '' };
  }

  /* ---------- Что открыто в городе: CONFIG.UNLOCK (волна 3) ----------
     Значение ключа: 'ГГГГ-ММ-ДД' — с этого дня; 'always' — всегда; имя другого ключа — вместе с ним (trip: 'car').
     all: true — всё открыто (предпросмотр автора, build_single.py --unlock-all). Календарь — тот же, что у прогулки:
     если дата — начало недели прогулки (Town.calendar.WEEK_STARTS), сравнивается неделя Town.week() (в отладке её
     двигает ?wk=), иначе день Town.day() от DAY0 (?day=); адрес с отладкой и date=ГГГГ-ММ-ДД — точная дата.
     Машина: если серия 2 уже собрана (built), чехол снимает её дело e2.car, а не дата. */
  const LOCK_TEXT = {
    car: w => `Чехол снимут в серии${NB}2${NB}— ${w}.`,
    bike: w => `Велосипед отдыхает до ${w}. Звонок уже начищен.`,
    companion: w => `Собачки пока привыкают к площадке. Гулять вместе${NB}— с${NB}${w}.`,
    trip: w => `Дорога наверх откроется вместе с машиной${NB}— ${w}.`,
    sedan: w => `Красный седан ждёт в гараже${NB}— с${NB}${w}.`,
    hotel: w => `Отель на вершине откроется вместе с дорогой наверх${NB}— ${w}.`,
    zipline: w => `Зиплайн откроется вместе с дорогой наверх${NB}— ${w}.`,
  };
  function calOk(when, t) {
    if (nowOv !== null) return nowOv >= t;
    const T = window.Town, C = T && T.calendar;
    try {
      if (C && typeof T.week === 'function') {
        const wi = (C.WEEK_STARTS || []).indexOf(when);
        if (wi >= 0) return T.week() >= wi + 1;
        if (typeof T.day === 'function' && C.DAY0) { const d = new Date(parseWhen(C.DAY0)); d.setDate(d.getDate() + T.day()); return d.getTime() >= t; }
      }
    } catch (e) { /* ниже — часы телефона */ }
    return Date.now() >= t;
  }
  function unlock(key, seen) {
    const U = (CFG() && CFG().UNLOCK) || {};
    const OPEN = { ok: true, at: 0, when: '', text: '' };
    if (U.all === true) return Object.assign({ all: true }, OPEN);
    let v = U[key];
    if (v === undefined || v === null || v === 'always' || v === true) return OPEN;
    if (v === false || v === 'never') return { ok: false, at: null, when: '', text: LOCK_TEXT[key] ? LOCK_TEXT[key]('позже') : 'Пока закрыто.' };
    if (typeof v === 'string' && !parseWhen(v) && U[v] !== undefined) {
      seen = seen || {}; if (seen[key]) return OPEN; seen[key] = 1;
      const r = unlock(v, seen);
      return r.ok ? r : Object.assign({}, r, { via: v, text: LOCK_TEXT[key] && r.when ? LOCK_TEXT[key](r.when) : r.text });
    }
    if (key === 'car' && BY['e2.car']) {
      const e2 = epInfo(2);
      if (e2 && e2.built === true) { const done = state('e2.car') === 'done'; return { ok: done, at: parseWhen(e2.release), when: epWhen(e2), text: done ? '' : LOCK_TEXT.car(epWhen(e2)) }; }
    }
    const t = parseWhen(v);
    if (t === null) return OPEN;
    const ok = calOk(v, t), w = dayMonth(t);
    return { ok, at: t, when: w, text: ok ? '' : (LOCK_TEXT[key] ? LOCK_TEXT[key](w) : `Откроется ${w}.`) };
  }
  const unlocked = key => unlock(key).ok;

  /* ---------- Таблица ---------- */
  const DEF0 = { needs: [], opens: null, door: null, marker: null, lit: null, mood: null, sideDoors: 'none', street: null, d2: null, start: null, after: null, nudge: null, title: '', short: '', task: '' };
  function define(def) {
    if (!def || typeof def.id !== 'string' || !def.ep) { console.warn('Missions.define: нужен id и ep', def); return null; }
    const d = Object.assign({}, DEF0, def);
    d.cp = d.cp || d.id.replace(/^e\d+\./, '');
    d.needs = Array.isArray(d.needs) ? d.needs.slice() : d.needs ? [d.needs] : [];
    if (d.door && !d.marker) d.marker = { style: 'case', icon: '🔍' };
    if (!d.short) d.short = d.title;
    if (typeof d.n !== 'number') d.n = DEFS.filter(x => x.ep === d.ep).length + 1;
    const i = DEFS.findIndex(x => x.id === d.id);
    if (i >= 0) DEFS[i] = d; else DEFS.push(d);
    DEFS.sort((a, b) => a.ep - b.ep || a.n - b.n);
    BY[d.id] = d;
    return d;
  }
  const list = ep => DEFS.filter(d => ep == null || d.ep === ep);
  const get = id => BY[id] || null;
  const doorDefs = ep => list(ep).filter(d => d.door);

  /* ---------- Состояние ---------- */
  function isDone(d) {
    const e = S().eps && S().eps[d.ep];
    return !!e && Array.isArray(e.cp) && e.cp.includes(d.cp);
  }
  // нужное заранее: id миссии, «epN» (серия N пройдена) или имя чекпоинта той же серии
  function needMet(d, n) {
    if (BY[n]) return isDone(BY[n]);
    const m = /^ep(\d+)$/.exec(n);
    if (m) { const e = S().eps && S().eps[+m[1]]; return !!(e && e.done); }
    const e = S().eps && S().eps[d.ep];
    return !!e && Array.isArray(e.cp) && e.cp.includes(n);
  }
  // серия собрана (в config.js built) — миссии серии можно играть; шаги серии 1 без сцены ведёт свой цикл ep1.js
  const playable = d => { const e = epInfo(d.ep); return !!e && e.built !== false; };
  function state(id) {
    const d = BY[id];
    if (!d) return 'locked';
    if (isDone(d)) return 'done';
    if (!d.needs.every(n => needMet(d, n))) return 'locked';
    if (!gate(d).ok || !playable(d)) return 'soon';
    return 'open';
  }
  const open = ep => list(ep).filter(d => state(d.id) === 'open');
  const progressOf = ep => { const ds = doorDefs(ep); return [ds.filter(isDone).length, ds.length]; };
  // ближайшее дело с дверью: открытое, иначе — следующее «скоро» (дата на карточке)
  function today(ep) {
    const ds = doorDefs(ep);
    const o = ds.find(d => state(d.id) === 'open');
    // «скоро»: первая миссия следующей серии (у финала первая сцена без двери — карточка всё равно нужна)
    const d = o || ds.find(d2 => state(d2.id) === 'soon') || list(ep).find(d2 => d2.ep > 1 && state(d2.id) === 'soon');
    if (!d) return null;
    return { id: d.id, ep: d.ep, title: d.title, task: d.task, door: d.door, progress: progressOf(d.ep), state: o ? 'open' : 'soon', sub: gate(d).sub, when: epWhen(epInfo(d.ep)) };
  }
  // цель улицы серии 1 ('roof') или id миссии → дверь города ('stairs')
  function doorOf(x) {
    if (!x) return null;
    if (BY[x]) return BY[x].door;
    const d = DEFS.find(m => m.street && (m.street.target === x || m.cp === x) && m.door);
    if (d) return d.door;
    return x === 'roof' ? 'stairs' : x;
  }
  const byTarget = (ep, target) => doorDefs(ep).find(d => (d.street && d.street.target === target) || d.cp === target || d.door === target) || null;
  // открытая миссия у этой двери (серия 2 и дальше; серию 1 ведёт ep1.js)
  const atDoor = door => DEFS.find(d => d.ep > 1 && d.door === door && state(d.id) === 'open') || null;

  function complete(id) {
    const d = BY[id];
    if (!d || !window.G) return false;
    const e = G.ep(d.ep), fresh = !e.cp.includes(d.cp);
    if (fresh) { e.cp.push(d.cp); G.save(); }
    emit('missions:change', { id, state: 'done' });
    return fresh;
  }

  /* ---------- Что видит город: метки, карточка, двери ---------- */
  const T_SOLVED = 'Здесь уже всё выяснили. Смотри, куда ведёт метка.';
  const T_FIRST = 'Закрыто. Сначала — сегодняшнее дело.';
  const T_SHUT = 'Откроется в субботу';
  const T_AFTER = 'Откроется, когда раскроем дело.';
  const markerOf = (d, style) => Object.assign({ id: d.id, door: d.door, label: d.short }, d.marker || {}, style ? { style } : {});
  function soonMarker(d) {
    const g = gate(d), e = epInfo(d.ep);
    return { id: d.id, door: d.door, style: 'soon', icon: '🔒', label: e && e.n > 1 ? `Серия${NB}${e.n}` : d.short, sub: g.sub || epWhen(e) };
  }
  function cardOf(t) {
    if (!t) return null;
    if (t.state === 'open') return { title: 'Сегодняшнее дело', text: `${t.title}: ${lcFirst(t.task)}`, door: t.door, progress: t.progress, tap: 'focus', icon: '🔍' };
    const e = epInfo(t.ep), last = (CFG().EPISODES || []).slice(-1)[0];
    const text = e && last && e.n === last.n && e.n > 2 ? `Финал${NB}— ${t.when}` : `Серия${NB}${t.ep}${e ? ` «${e.title}»` : ''}${NB}— ${t.when}`;
    return { title: 'Следующее дело', text, door: null, progress: null, tap: 'none', icon: '🔒', lock: true };
  }
  const caseCard = ep => cardOf(today(ep));
  // открытые миссии всех серий — «case»; у серии без открытых — ближайшая «скоро» этой серии
  function freeMarkers() {
    const out = [];
    [...new Set(DEFS.map(d => d.ep))].forEach(n => {
      const ds = doorDefs(n), op = ds.filter(d => state(d.id) === 'open');
      if (op.length) op.forEach(d => out.push(markerOf(d)));
      else { const s = ds.find(d => state(d.id) === 'soon'); if (s) out.push(soonMarker(s)); }
    });
    return out;
  }
  // машина: под чехлом, пока не открыта (CONFIG.UNLOCK.car; при собранной серии 2 — её дело «Гараж»)
  const vehicles = () => (unlocked('car') ? 'drive' : 'covered');
  // боковые двери во время дела серии: раскрытые и будущие сюжетные — закрыты с объяснением,
  // места прогулки — по неделе и по проверке на спойлеры (Town.storySafe)
  function sideDoors(cur) {
    const out = [], seen = new Set([cur.door]);
    doorDefs(cur.ep).forEach(d => {
      if (seen.has(d.door)) return; seen.add(d.door);
      out.push({ id: d.door, open: false, label: d.short, closedText: isDone(d) ? T_SOLVED : T_FIRST });
    });
    if (cur.sideDoors === 'none') return out;
    const T = window.Town;
    if (!T || typeof T.list !== 'function') return out;
    T.list().forEach(p => {
      if (!p || seen.has(p.id) || p.kind === 'counter' || !T.REG || !T.REG.places.includes(p.id)) return;
      seen.add(p.id);
      const shut = !!(T.status && T.status(p.id).shut);
      const allowed = Array.isArray(cur.sideDoors) ? cur.sideDoors.includes(p.id) : !!(T.storySafe && T.storySafe(p.id));
      if (shut) out.push({ id: p.id, open: false, label: p.short, closedText: T_SHUT });
      else if (!allowed) out.push({ id: p.id, open: false, label: p.short, closedText: T_AFTER });
      else out.push({ id: p.id, open: true, label: p.short });
    });
    return out;
  }
  // боковой визит во время дела: комната места и назад к той же двери (мир ждёт промис)
  async function sideVisit(doorId) {
    const T = window.Town;
    if (!T || typeof T.visit !== 'function') return 'closed';
    try { return await T.visit(doorId, { story: true }); } catch (e) { console.warn('Missions: боковой визит', doorId, e); return 'fallback'; }
  }
  function nudgeOf(d) {
    const cat = !!S().catHelper;
    const ls = (d.nudge && (cat ? d.nudge.cat : d.nudge.hero)) || [];
    if (!ls.length) return null;
    return { after: 90, dist: 25, every: 60, who: cat ? 'cat' : 'hero', lines: ls.map(x => (typeof x === 'string' ? x : x.text)) };
  }
  // ctx = { mode: 'story' | 'free', target?, idx?, again?, justLit?, ep? }
  function worldExtras(ctx = {}) {
    if (ctx.mode !== 'story') {
      return { marker: null, markers: freeMarkers(), hud: caseCard(), doors: [], generic: true, vehicles: vehicles(), mood: 'free', nudge: null };
    }
    const d = byTarget(ctx.ep || 1, ctx.target);
    if (!d) return { marker: null, markers: [], hud: null, doors: [], generic: true, vehicles: vehicles(), mood: typeof ctx.idx === 'number' ? ctx.idx : 0, nudge: null };
    const doneN = doorDefs(d.ep).filter(x => x.n < d.n).length, total = doorDefs(d.ep).length;
    return {
      marker: markerOf(d),
      markers: [],
      hud: { title: 'Сегодняшнее дело', text: `${d.title}: ${lcFirst(d.task)}`, door: d.door, progress: [doneN, total], tap: 'focus', icon: '🔍' },
      doors: sideDoors(d),
      onDoor: sideVisit,
      generic: true,
      residents: { hedgehog: false },
      vehicles: vehicles(),
      mood: typeof d.mood === 'number' ? d.mood : (typeof ctx.idx === 'number' ? ctx.idx : 0),
      spawn: ctx.again ? d.door : ctx.justLit ? doorOf(ctx.justLit) : 'start',
      nudge: nudgeOf(d),
    };
  }

  /* ---------- Движок уличного отрезка ---------- */
  function engine() {
    const H = window.WorldHub;
    if (H && typeof H.engine === 'function') { try { return H.engine(); } catch (e) { /* ниже */ } }
    return window.City3D && City3D.supported && !S().force2d ? 'street' : '2d';
  }
  // единственный вход в уличный отрезок: город, если есть, иначе улица (тот же объект o, тот же o.done)
  function runStreet(o) {
    const H = window.WorldHub;
    if (H && typeof H.runStreet === 'function') return H.runStreet(o);
    return window.City3D.run(o);
  }
  const sideMs = () => { const H = window.WorldHub; try { return H && typeof H.sideMs === 'function' ? +H.sideMs() || 0 : 0; } catch (e) { return 0; } };
  const inWorld = api => !!api && typeof api.setMarkers === 'function';

  /* ---------- Карточка дела на улице и в 2D (в городе карточку рисует сам город) ---------- */
  function cardHTML(c, o = {}) {
    if (!c) return '';
    const p = Array.isArray(c.progress) ? `<div class="w-case-p" aria-label="${c.progress[0]} из ${c.progress[1]}">${Array.from({ length: c.progress[1] }, (_, i) => `<i class="${i < c.progress[0] ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `<button class="w-case${c.lock ? ' lock' : ''}${o.inline ? ' inline' : ''}" type="button" data-tap="${esc(c.tap || 'none')}">
      <div class="w-case-t"><span class="w-case-i">${esc(c.icon || '🔍')}</span>${esc(c.title)}</div>
      <div class="w-case-x">${esc(c.text)}</div>${p}</button>`;
  }
  // карточка поверх экрана улицы: host — экран (по умолчанию — текущий), onTap — что делать по тапу
  function mountCard(c, o = {}) {
    if (!c) return { el: null, remove() {} };
    const host = o.host || document.querySelector('#stage .screen:not(.out)') || (window.G && G.app) || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'm-case-host';
    wrap.innerHTML = cardHTML(c);
    host.appendChild(wrap);
    const btn = wrap.querySelector('.w-case');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (window.G) G.haptic('light');
      btn.classList.remove('hop'); void btn.offsetWidth; btn.classList.add('hop');
      if (o.onTap) o.onTap(c);
    });
    let mini = null;
    if (o.miniAfter) mini = setTimeout(() => btn.classList.add('mini'), o.miniAfter);
    return { el: wrap, remove() { clearTimeout(mini); wrap.remove(); } };
  }

  /* ---------- Общий цикл серии 2 и дальше ---------- */
  async function runMission(d, extra) {
    if (!d || typeof d.start !== 'function') return 'exit';
    emit('missions:change', { id: d.id, state: 'started' });
    let r;
    try { r = await d.start(Object.assign({ def: d }, extra || {})); } catch (e) { console.error('Missions: сцена', d.id, e); r = 'exit'; }
    if (r !== 'done') return 'exit';
    complete(d.id);
    if (typeof d.after === 'function') { try { await d.after({ def: d }); } catch (e) { console.warn('Missions: after', d.id, e); } }
    return 'done';
  }
  // метки → дошла до двери → start() → 'done' / 'exit' → complete(); сцены без двери идут сразу
  async function play(ep) {
    const T = window.Town;
    let spawn = null;
    for (let guard = 0; guard < 400; guard++) {
      const op = open(ep);
      if (!op.length) return list(ep).length && list(ep).every(isDone) ? 'done' : 'menu';
      const scene = op.find(d => !d.door);
      if (scene) { if (await runMission(scene) !== 'done') return 'menu'; continue; }
      if (!T || typeof T.walkOnce !== 'function') return 'menu';
      const r = await T.walkOnce(spawn);
      if (!r || r === 'menu' || r === '2d-menu') return 'menu';
      const m = op.find(d => d.door === r.door);
      if (m) await runMission(m, { again: false });
      else if (typeof T.visit === 'function') await T.visit(r.door, {});
      spawn = r.door;
    }
    return 'menu';
  }
  // для улицы-запаса: точки-указатели к миссиям вне полосы (тап → spotApi.finish({ door }))
  const streetSpots = () => DEFS.filter(d => d.ep > 1 && d.street && d.street.spot && state(d.id) === 'open').map(d => Object.assign({}, d.street.spot));
  const spotDoor = id => { const d = DEFS.find(m => m.street && m.street.spot && m.street.spot.id === id && state(m.id) === 'open'); return d ? d.door : null; };
  // для 2D-списка прогулки: открытые миссии с карточкой
  const cards2d = () => DEFS.filter(d => d.ep > 1 && d.d2 === 'card' && d.door && state(d.id) === 'open');

  /* ============================== ТАБЛИЦА ============================== */
  // Серия 1 «Пропажа». Тексты карточек — по сюжету: каждый адрес следствие получает в прошлом доме.
  const e1Scene = k => async ctx => ((await window.Ep1.scene(k, ctx)) === 'exit' ? 'exit' : 'done');
  define({ id: 'e1.prologue', ep: 1, n: 0, cp: 'prologue', title: 'Пролог' });
  define({ id: 'e1.casting', ep: 1, n: 0.5, cp: 'casting', needs: ['e1.prologue'], title: 'Кастинг' });
  define({
    id: 'e1.cinema', ep: 1, n: 1, cp: 'cinema', door: 'cinema', needs: ['e1.casting'], opens: { ep: 1 },
    title: 'Кинотеатр «Саспенс»', short: 'Кинотеатр', task: 'Солнце в последний раз видели здесь',
    lit: 'cinema', mood: 0, sideDoors: 'safe', street: { door: 'cinema', target: 'cinema' }, d2: 'street', start: e1Scene('cinema'),
    nudge: {
      cat: [{ who: 'cat', text: 'Кинотеатр — там, где луч. Я бы пошёл. Если бы не лень.' }, { who: 'cat', text: 'Луч над кинотеатром горит не для красоты. Хотя и для красоты тоже.' }],
      hero: [{ who: 'hero', text: 'Так, мне туда, где светится луч! Кинотеатр ждёт.' }],
    },
  });
  define({
    id: 'e1.bureau', ep: 1, n: 2, cp: 'bureau', door: 'bureau', needs: ['e1.cinema'], opens: { ep: 1 },
    title: 'Бюро переводов', short: 'Бюро', task: 'Вывеска с плёнки ведёт сюда',
    lit: 'bureau', mood: 1, sideDoors: 'safe', street: { door: 'bureau', target: 'bureau' }, d2: 'street', start: e1Scene('bureau'),
    nudge: {
      cat: [{ who: 'cat', text: 'Бюро — под лучом. Попугай сам себя не переведёт.' }, { who: 'cat', text: 'Нам в бюро переводов. Луч видно издалека. Даже мне.' }],
      hero: [{ who: 'hero', text: 'Бюро переводов — там, где луч. Бегу!' }],
    },
  });
  define({
    id: 'e1.sweets', ep: 1, n: 3, cp: 'sweets', door: 'sweets', needs: ['e1.bureau'], opens: { ep: 1 },
    title: 'Кондитерская «Сахарная пудра»', short: 'Кондитерская', task: 'Чек из бюро ведёт сюда',
    lit: 'sweets', mood: 2, sideDoors: 'safe', street: { door: 'sweets', target: 'sweets' }, d2: 'street', start: e1Scene('sweets'),
    nudge: {
      cat: [{ who: 'cat', text: 'Кондитерская светится. Свидетели ждут. Десерты — тоже.' }, { who: 'cat', text: 'Туда, где луч. Пахнет ванилью и уликами.' }],
      hero: [{ who: 'hero', text: 'Кондитерская под лучом. Свидетели, я иду!' }],
    },
  });
  define({
    id: 'e1.roof', ep: 1, n: 4, cp: 'roof', door: 'stairs', needs: ['e1.sweets'], opens: { ep: 1 },
    title: 'Подъезд', short: 'Подъезд', task: 'Солнце унесли на крышу',
    lit: 'roof', mood: 3, sideDoors: 'safe', street: { door: 'stairs', target: 'roof' }, d2: 'street', start: e1Scene('roof'),
    nudge: {
      cat: [{ who: 'cat', text: 'Подъезд под лучом. Крыша ждёт. Я тоже жду, но скромнее.' }, { who: 'cat', text: 'Наверх. Туда, где светится. Лапы сами не дойдут.' }],
      hero: [{ who: 'hero', text: 'Подъезд — там, где луч. Наверх, на крышу!' }],
    },
  });
  define({ id: 'e1.version', ep: 1, n: 5, cp: 'version', needs: ['e1.roof'], title: 'Версия следствия' });
  define({ id: 'e1.rating', ep: 1, n: 6, cp: 'rating', needs: ['e1.version'], title: 'Оценка серии' });

  // Серия 2 «Свидетели» (заготовка: сцены появятся вместе с серией; до даты и до прохождения серии 1 — закрыто).
  // Свидетелей обходят в любом порядке: четыре метки сразу.
  const later = (ep, k) => async ctx => { const E = window['Ep' + ep]; return E && typeof E.scene === 'function' ? E.scene(k, ctx) : 'exit'; };
  const E2 = { ep: 2, opens: { ep: 2 }, d2: 'card', sideDoors: 'safe' };
  define(Object.assign({}, E2, { id: 'e2.intro', n: 1, cp: 'intro', door: 'stairs', needs: ['ep1'], title: 'Подъезд', short: 'Подъезд', task: 'Ступеньки вернулись. Почти все', start: later(2, 'intro') }));
  define(Object.assign({}, E2, { id: 'e2.car', n: 2, cp: 'car', door: 'garage', needs: ['e2.intro'], title: 'Гараж', short: 'Гараж', task: 'Машина под чехлом', start: later(2, 'car') }));
  define(Object.assign({}, E2, { id: 'e2.step7', n: 3, cp: 'step7', door: 'stairs', needs: ['e2.car'], title: 'Ступенька № 7', short: 'Подъезд', task: 'Выслушать свидетеля', start: later(2, 'step7') }));
  define(Object.assign({}, E2, { id: 'e2.pigeons', n: 4, cp: 'pigeons', door: 'square_pigeons', needs: ['e2.car'], title: 'Голуби на площади', short: 'Площадь', task: 'Выслушать свидетелей', start: later(2, 'pigeons'), street: { spot: { id: 'm_pigeons', x: -15.6, z: -0.5, act: 'На площадь', bubble: 'голуби' } } }));
  define(Object.assign({}, E2, { id: 'e2.ducks', n: 5, cp: 'ducks', door: 'embank_ducks', needs: ['e2.car'], title: 'Утки на набережной', short: 'Набережная', task: 'Выслушать свидетелей', start: later(2, 'ducks'), street: { spot: { id: 'm_ducks', x: 39.2, z: -0.5, act: 'На набережную', bubble: 'утки' } } }));
  define(Object.assign({}, E2, { id: 'e2.tourist', n: 6, cp: 'tourist', door: 'embank_tourist', needs: ['e2.car'], title: 'Туристка у фонтана', short: 'Туристка', task: 'Поговорить по-английски', start: later(2, 'tourist'), street: { spot: { id: 'm_tourist', x: 39.2, z: 0.6, act: 'Поговорить', bubble: 'туристка' } } }));
  define(Object.assign({}, E2, { id: 'e2.studio', n: 7, cp: 'studio', door: 'square_van', needs: ['e2.step7', 'e2.pigeons', 'e2.ducks', 'e2.tourist'], title: 'Фургон звукорежиссёра', short: 'Фургон', task: 'Послушать запись утра', start: later(2, 'studio'), street: { spot: { id: 'm_studio', x: -15.6, z: 0.6, act: 'Послушать', bubble: 'фургон' } } }));
  define(Object.assign({}, E2, { id: 'e2.editorial', n: 8, cp: 'editorial', door: 'editorial', needs: ['e2.studio'], title: 'Редакция', short: 'Редакция', task: 'Три поручения за один снимок', start: later(2, 'editorial'), street: { spot: { id: 'm_editorial', x: 39.2, z: -1.4, act: 'В редакцию', bubble: 'редакция' } } }));
  define(Object.assign({}, E2, { id: 'e2.market', n: 9, cp: 'market', door: 'market', needs: ['e2.editorial'], title: 'Рынок', short: 'Рынок', task: 'Поговорить с хозяином лавки', start: later(2, 'market'), street: { spot: { id: 'm_market', x: -15.6, z: -1.4, act: 'На рынок', bubble: 'рынок' } } }));
  define(Object.assign({}, E2, { id: 'e2.archive', n: 10, cp: 'archive', door: 'archive', needs: ['e2.market'], title: 'Архив', short: 'Архив', task: 'Сузить список подозреваемых', start: later(2, 'archive'), street: { spot: { id: 'm_archive', x: -15.6, z: 1.5, act: 'В архив', bubble: 'архив' } } }));
  define({ id: 'e2.final', ep: 2, n: 11, cp: 'final', needs: ['e2.archive'], opens: { ep: 2 }, title: 'Записка и версия', start: later(2, 'final') });

  // Финал (заготовка: дата появится в сборке, до неё — «в декабре»; после серии 2).
  const E3 = { ep: 3, opens: { ep: 3 }, d2: 'card', sideDoors: 'safe', marker: { style: 'case', icon: '✨' } };
  define({ id: 'e3.intro', ep: 3, n: 1, cp: 'intro', needs: ['ep2'], opens: { ep: 3 }, title: 'Ранее в деле', start: later(3, 'intro') });
  [['lamp_square', 'square_lamp', 'Площадь', -15.6, -0.5], ['lamp_embank', 'embank_lamp', 'Набережная', 39.2, -0.5], ['lamp_market', 'market_lamp', 'Рынок', -15.6, 0.6], ['lamp_terrace', 'terrace', 'Холм', 39.2, 0.6], ['lamp_street', 'cinema', 'Октябрьская', null, null]]
    .forEach(([k, door, short, x, z], i) => define(Object.assign({}, E3, {
      id: 'e3.' + k, n: 2 + i, cp: k, door, needs: ['e3.intro'], title: `Фонарь: ${short}`, short, task: 'Зажечь большой фонарь',
      start: later(3, k), street: x === null ? { door } : { spot: { id: 'm_' + k, x, z, act: 'Зажечь', bubble: 'фонарь' } },
    })));
  define(Object.assign({}, E3, { id: 'e3.stairs', n: 8, cp: 'stairs', door: 'stairs', needs: ['e3.lamp_square', 'e3.lamp_embank', 'e3.lamp_market', 'e3.lamp_terrace', 'e3.lamp_street'], title: 'Подъезд', short: 'Подъезд', task: 'Последний пролёт', start: later(3, 'stairs') }));
  define({ id: 'e3.final', ep: 3, n: 9, cp: 'final', needs: ['e3.stairs'], opens: { ep: 3 }, title: 'Дело закрыто', start: later(3, 'final') });

  /* ---------- API ---------- */
  const Missions = window.Missions = {
    define, list, get, state, open, today, doorOf, worldExtras, complete, play,
    caseCard, cardOf, atDoor, run: id => runMission(BY[id]), engine, runStreet, sideMs, inWorld,
    cardHTML, mountCard, streetSpots, spotDoor, cards2d, progress: progressOf, gate, epWhen: n => epWhen(epInfo(n)),
    now, T: { SOLVED: T_SOLVED, FIRST: T_FIRST, SHUT: T_SHUT, AFTER: T_AFTER },
    unlock, unlocked, vehicles,
  };

  /* ---------- Отладка (только адрес с отладкой; в prod вырезается) ---------- */
  if (DEBUG) {
    Missions.debug = {
      now: v => { nowOv = v === undefined || v === null ? null : typeof v === 'number' ? v : parseWhen(v); return now(); },
      table: () => DEFS.map(d => ({ id: d.id, ep: d.ep, cp: d.cp, door: d.door, state: state(d.id) })),
      unlocks: () => ['companion', 'bike', 'car', 'trip', 'minimap'].reduce((o, k) => { o[k] = unlock(k); return o; }, {}),
      extras: ctx => { const w = worldExtras(ctx); return JSON.parse(JSON.stringify(Object.assign({}, w, { onDoor: typeof w.onDoor === 'function' }))); },
      last: null,   // последний o.world, отданный уличному отрезку (пишут ep1.js и town.js)
      // двери таблицы, которых нет в реестре города (пустой реестр — город ещё не подключён): { missing, future }
      checkDoors: () => {
        let reg = [];
        try { reg = window.WorldHub && WorldHub.doors ? WorldHub.doors() || [] : []; } catch (e) { reg = []; }
        if (!reg.length) return { registry: 0, missing: [], future: [] };
        const ids = new Set(reg.map(d => d.id));
        const doors = [...new Set(DEFS.filter(d => d.door).map(d => d.door))];
        return { registry: reg.length, missing: doors.filter(x => !ids.has(x) && DEFS.some(d => d.door === x && d.ep === 1)), future: doors.filter(x => !ids.has(x) && !DEFS.some(d => d.door === x && d.ep === 1)) };
      },
    };
    window.__missions = Missions.debug;
  }
})();
