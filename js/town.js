/* =====================================================================
   «ГОРОД НАРАСПАШКУ» — свободная прогулка после серии 1.
   Ядро: реестр мест, состояние st.town, реплики, штампы, секретики,
   факты, нижние листы, прогулка по 3D-улице и комнатам (или 2D-карточки),
   «Паспорт города» в блокноте. Места подключаются файлами
   js/places/<id>.js через Town.place(def).
   ===================================================================== */
(function () {
  if (!window.G) return;
  const S = () => G.state();
  const esc = G.esc;
  const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } })();
  const DEBUG = QS.get('debug') === '1';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P0 = () => Promise.resolve();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- Реестры: порядок заморожен, только дописывать в конец ---------- */
  const words = s => Object.freeze(s.trim().split(/\s+/));
  const REG = Object.freeze({
    places: words('cinema bureau sweets stairs silver kiosk orangery atelier photo records books planet'),
    facts: words(`fps24 lumie lotor popc yo ok detect robot antr poodle choco butter kanik vanil white marsh catsw cocoa
      penny cloud monet filig silvr gazeta pumpb leaves wool graph snow rubber orang mimos waggl pumpk
      bant deer pockt paras oz cashm mona photo niep rpm sax a440 austen watsn poe mouse goose chrst
      mass 8min planet venus dipper pigsn`),
    secrets: words(`c_seat c_bun c_noir b_int b_bell b_cat s_syr s_tab s_gos l_echo l_box l_cat v_curl v_snl v_watch
      n_cross n_knock o_bud o_bow o_sun a_show a_holm a_beret p_ghost p_sun p_ser r_all r_scr r_fin k_but k_udol k_cat
      z_bow z_star z_cat`),
  });
  const NP = REG.places.length;
  const PIDX = id => REG.places.indexOf(id);
  const SEC_PREFIX = { cinema: 'c_', bureau: 'b_', sweets: 's_', stairs: 'l_', silver: 'v_', kiosk: 'n_', orangery: 'o_', atelier: 'a_', photo: 'p_', records: 'r_', books: 'k_', planet: 'z_' };

  /* ---------- Битсеты: 5 бит на символ, цифры 0-9a-v, младший символ первым ---------- */
  const D32 = '0123456789abcdefghijklmnopqrstuv';
  const bits = {
    get(str, i) { const ch = String(str || '')[Math.floor(i / 5)]; const v = ch ? D32.indexOf(ch) : -1; return v > 0 && !!(v & (1 << (i % 5))); },
    set(str, i, on = true) {
      const a = String(str || '').split(''), c = Math.floor(i / 5);
      while (a.length <= c) a.push('0');
      let v = Math.max(0, D32.indexOf(a[c]));
      v = on ? v | (1 << (i % 5)) : v & ~(1 << (i % 5));
      a[c] = D32[v];
      return a.join('').replace(/0+$/, '');
    },
    count(str) { let n = 0; for (const ch of String(str || '')) { let v = Math.max(0, D32.indexOf(ch)); while (v) { n += v & 1; v >>= 1; } } return n; },
    list(str, reg) { return reg.filter((_, i) => bits.get(str, i)); },
  };
  const pop = m => { let n = 0; m = m >>> 0; while (m) { n += m & 1; m >>>= 1; } return n; };

  /* ---------- Календарь: неделя и день прогулки ---------- */
  const WEEK_STARTS = ['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05'];
  const DAY0 = '2026-10-24';
  const ymd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); };
  const numParam = k => { const v = QS.get(k); return v !== null && v !== '' && isFinite(+v) ? +v : null; };
  let wkOv = DEBUG ? numParam('wk') : null, dayOv = DEBUG ? numParam('day') : null;
  function day() {
    if (dayOv !== null) return Math.max(0, Math.floor(dayOv));
    return Math.max(0, Math.round((today0() - ymd(DAY0)) / 864e5));
  }
  function week() {
    if (wkOv !== null) return clamp(Math.floor(wkOv), 0, 6);
    const t = dayOv !== null ? ymd(DAY0) + day() * 864e5 + 36e5 : today0();
    return WEEK_STARTS.filter(s => ymd(s) <= t).length;
  }
  const dateStr = d => { const x = new Date(ymd(DAY0) + (d || 0) * 864e5 + 36e5); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}`; };

  /* ---------- Состояние st.town (слияние сейва неглубокое — проверяем каждый ключ) ---------- */
  const freshTown = () => ({ v: 2, at: 'cinema', cat: null, hi: 0, seen: Array(NP).fill(0), u: Array(NP).fill(0), stp: '', f: '', s: '', w: '-'.repeat(NP), r: '-'.repeat(7), ph: '', ch: 0, g: 0, nb: 0, k: {}, h: null });
  function ensure() {
    const st = S();
    let t = st.town;
    if (!t || typeof t !== 'object' || Array.isArray(t) || t.v !== 2) t = st.town = freshTown();
    if (!REG.places.includes(t.at) || t.at === 'kiosk') t.at = 'cinema';
    if (t.cat !== 0 && t.cat !== 1) t.cat = null;
    t.hi = t.hi ? 1 : 0;
    const arr = (a, ok, def) => { const o = Array.isArray(a) ? a.slice(0, NP) : []; for (let i = 0; i < NP; i++) if (!ok(o[i])) o[i] = def; return o; };
    if (!(Array.isArray(t.seen) && t.seen.length === NP)) t.seen = arr(t.seen, x => x === 0 || (Array.isArray(x) && x.length === 3 && x.every(n => typeof n === 'number' && isFinite(n))), 0);
    if (!(Array.isArray(t.u) && t.u.length === NP)) t.u = arr(t.u, x => typeof x === 'number' && isFinite(x) && x >= 0, 0);
    ['stp', 'f', 's', 'ph'].forEach(k => { if (typeof t[k] !== 'string') t[k] = ''; });
    const strN = (val, n) => (typeof val === 'string' ? val : '').slice(0, n).padEnd(n, '-');
    if (typeof t.w !== 'string' || t.w.length !== NP) t.w = strN(t.w, NP);
    if (typeof t.r !== 'string' || t.r.length !== 7) t.r = strN(t.r, 7);
    ['ch', 'g', 'nb'].forEach(k => { if (typeof t[k] !== 'number' || !isFinite(t[k])) t[k] = 0; });
    if (!t.k || typeof t.k !== 'object' || Array.isArray(t.k)) t.k = {};
    if (t.h === undefined) t.h = null;
    return t;
  }
  const save = () => G.save();
  const unlocked = () => { const st = S(); return !!(st.eps && st.eps[1] && st.eps[1].done); };

  /* ---------- Места: реестр, патчи будущих серий ---------- */
  const ORIG = {}, DEFS = {}, PATCHES = {};
  const plain = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
  function cloneDef(d) {
    const c = Object.assign({}, d);
    Object.keys(c).forEach(k => { if (plain(c[k])) c[k] = Object.assign({}, c[k]); });
    if (plain(c.spots)) Object.keys(c.spots).forEach(k => { if (plain(c.spots[k])) c.spots[k] = Object.assign({}, c.spots[k]); });
    return c;
  }
  function applyPatch(id) {
    if (!ORIG[id]) return;
    const d = cloneDef(ORIG[id]);
    (PATCHES[id] || []).forEach(fn => { try { fn(d); } catch (e) { console.warn('Town.patch', id, e); } });
    DEFS[id] = d;
  }
  const applyPatches = () => Object.keys(ORIG).forEach(applyPatch);
  function place(def) {
    if (!def || typeof def.id !== 'string') { townWarn('Town.place without id'); return; }
    if (!plain(def.spots)) def.spots = {};
    ORIG[def.id] = def; applyPatch(def.id);
    if (DEBUG) setTimeout(() => validate(DEFS[def.id]), 0);
  }
  function patch(id, fn) { (PATCHES[id] = PATCHES[id] || []).push(fn); applyPatch(id); }
  const get = id => DEFS[id] || null;
  const sx = p => (p && p.street && typeof p.street.x === 'number' ? p.street.x : 0);
  const list = () => Object.keys(DEFS).map(k => DEFS[k]).sort((a, b) => sx(a) - sx(b));
  function style(id, css) {
    if (document.querySelector(`style[data-town="${id}"]`)) return;
    const s = document.createElement('style'); s.dataset.town = id; s.textContent = css; document.head.appendChild(s);
  }
  // вариант реплики: выбирается по номеру визита (visits % n)
  function Variants(ls) { this.list = ls; }
  const variants = (...ls) => new Variants(ls);

  /* ---------- Поиск фактов и секретиков по местам ---------- */
  function factOf(id) { for (const k in DEFS) { const p = DEFS[k]; if (p.facts && p.facts[id]) return { p, f: p.facts[id] }; } return null; }
  const factOpen = id => { const x = factOf(id); return !!x && (x.f.wk || 0) <= week() && (x.p.opens || 0) <= week(); };
  function secretOf(id) { for (const k in DEFS) { const p = DEFS[k], s = (p.secrets || []).find(z => z && z.id === id); if (s) return { p, s }; } return null; }
  const hasFact = id => { const i = REG.facts.indexOf(id); return i >= 0 && bits.get(ensure().f, i); };
  const hasSecret = id => { const i = REG.secrets.indexOf(id); return i >= 0 && bits.get(ensure().s, i); };
  const hasStamp = id => { const i = PIDX(id); return i >= 0 && bits.get(ensure().stp, i); };
  function placeSecrets(id) {
    const p = get(id);
    if (p && Array.isArray(p.secrets) && p.secrets.length) return p.secrets.map(s => s.id);
    return REG.secrets.filter(s => s.indexOf(SEC_PREFIX[id]) === 0);
  }
  // HUD v2: строка прогресса в шапке меню ☰ (бывший чип «🏙 N/12»)
  const progressLine = () => { const c = counts(); return `Штампы ${c.stamps}/12 · Факты ${c.facts}/${c.factsAvail} · Секретики ${c.secrets}/${c.secretsTotal}`; };
  function counts() {
    const t = ensure(), w = week();
    let factsAvail = 0;
    for (const k in DEFS) {
      const p = DEFS[k]; if (!p.facts || (p.opens || 0) > w) continue;
      for (const f in p.facts) if ((p.facts[f].wk || 0) <= w) factsAvail++;
    }
    return { stamps: bits.count(t.stp), stampsTotal: 12, facts: bits.count(t.f), factsAvail, secrets: bits.count(t.s), secretsTotal: REG.secrets.length };
  }
  // отметки места: не была (розовая точка), «НОВОЕ» (изменилось на неделе), закрыто до субботы, штамп, секретики
  function status(id) {
    const t = ensure(), i = PIDX(id), p = get(id), w = week(), sn = i >= 0 ? t.seen[i] : 0;
    const wi = i >= 0 && t.w[i] !== '-' ? +t.w[i] : -1;
    const secs = placeSecrets(id);
    return {
      shut: !p || w < (p.opens || 0), unvisited: !sn, fresh: !!sn && !!p && Array.isArray(p.fresh) && p.fresh.some(x => x > wi && x <= w),
      stamped: hasStamp(id), secrets: secs.filter(hasSecret).length, secretsTotal: secs.length,
    };
  }

  /* ---------- Сессия одной прогулки, журнал отладки ---------- */
  let SESS = null;
  const newSession = () => ({ entered: {}, cur: {}, n: {}, last: {}, bench: [], hd: null, visit: null, jump: null, weatherI: 0, no3d: false, street: new Set() });
  const sess = () => SESS || (SESS = newSession());
  const Gone = Object.freeze({ name: 'TownGone', toString: () => 'Town.Gone' });
  window.addEventListener('unhandledrejection', e => { if (e.reason === Gone) e.preventDefault(); });
  const LOG = [], WARN = [];
  const log = (type, data) => { if (!DEBUG) return; LOG.push({ t: Math.round(performance.now()), type, data }); if (LOG.length > 1200) LOG.splice(0, 300); };
  function townWarn(...a) {
    const msg = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (!WARN.includes(msg)) WARN.push(msg);
    console.warn('TOWNWARN', msg);
  }

  /* ---------- Мелочи ---------- */
  // Имя в репликах жителей — только после того, как она им помахала (G.waved из engine.js).
  // До этого та же реплика звучит без имени: «{name}! Проходите» → «Проходите», «Га, {name}!» → «Га!»,
  // «{name|Ой}… здравствуйте» → «Ой… здравствуйте». Нет G.waved — имени в приветствиях нет вовсе.
  const NAME_RE = /\{name(?:\|[^}]*)?\}/;
  const waved = () => { try { return !!(window.G && typeof G.waved === 'function' && G.waved()); } catch (e) { return false; } };
  function unnamed(s) {
    s = s.replace(/\{name\|([^}]*)\}/g, '$1');
    const lead = /^\s*\{name\}[\s!,.:…]*/;
    if (lead.test(s)) { s = s.replace(lead, ''); s = s.charAt(0).toUpperCase() + s.slice(1); }
    return s.replace(/,\s*\{name\},\s*/g, ' ').replace(/,\s*\{name\}(?=[\s!?.…]|$)/g, '').replace(/\s*\{name\}/g, '');
  }
  const fill = s => {
    const x = String(s == null ? '' : s);
    if (!NAME_RE.test(x)) return x;
    return waved() ? x.replace(/\{name(?:\|[^}]*)?\}/g, () => G.herName()) : unnamed(x);
  };
  const toastMs = s => clamp(1900 + 45 * String(s).length, 2300, 4200);
  // образ героини: id (js/hero_looks.js) + старые цвета (запасная перекраска тренча, лента букета, вывески)
  const heroLook = () => {
    const st = S(), H = window.HeroLooks;
    if (H && G.look) { const id = G.look(); return Object.assign({ look: id }, H.legacy(id)); }
    return { bow: st.bow || '#F08FA8', coat: st.coat || '#E9D4B6', hair: st.hair || '#4A3128' };
  };
  const catFollows = () => S().catHelper === true || ensure().cat === 1;
  const inkOf = c => { try { return Art.shade(c || '#F7C9D3', -38); } catch (e) { return '#C2405B'; } };
  const seededRot = id => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return (h % 13) - 6; };
  const closeLayer = () => document.querySelectorAll('#layer .dlg-wrap, #layer .modal, #layer .remark, #layer .intertitle, #layer .town-ov').forEach(el => el.remove());
  const syncSheetClass = () => document.body.classList.toggle('sheet-on', !!document.querySelector('#layer .modal.sheet:not(.out)'));
  const bumpBadge = () => { try { G.bumpNb(); } catch (e) { /* ignore */ } };
  const Ep1kit = () => (window.Ep1 && Ep1.kit) || {};
  const qToast = (text, ms) => { const tx = fill(text); G.toast(tx, ms || toastMs(tx), { queue: true, onShow: () => log('toast', tx) }); return ms || toastMs(tx); };

  /* ---------- Заглушка api для 2D: любой метод есть и сразу «выполнен» ---------- */
  const STUB_BASE = {
    finish() {}, leave() {}, heroPos: () => ({ x: 0, z: 0 }), walkTo: () => P0(), room: null, npcs: {},
    sit: () => Promise.resolve(true), stand() {}, isSitting: false, setLook() {}, look: () => heroLook(), setHeld() {},
    heroHead: () => (window.THREE ? new THREE.Group() : { add() {}, remove() {}, children: [] }), dim: () => P0(), tween: () => P0(),
    catHere: () => catFollows(), catTo: () => P0(), catFree() {}, face() {}, faceCamera() {}, focusHero() {}, camFocus() {}, camFit() {}, camRelease() {},
    fitScreen: () => P0(), focusMode() {}, intercept() {}, spin() {}, catSweater() {}, spawnCat() {},
    toScreen: () => { const r = G.app.getBoundingClientRect(); return { x: r.width / 2, y: r.height * 0.45 }; },
    celebrate() { G.haptic('success'); G.sparkle(undefined, undefined, { kind: 'heart', n: 14, dist: 80 }); },
  };
  const STUB = new Proxy(STUB_BASE, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol' || k === 'then' || k === 'toJSON') return undefined; return () => P0(); } });
  const call = (a, k, ...args) => { try { return a && typeof a[k] === 'function' ? a[k](...args) : undefined; } catch (e) { console.warn('api.' + k, e); return undefined; } };

  /* ---------- Визит: одно посещение места (или уличный киоск) ---------- */
  function makeVisit(p, o = {}) {
    const t = ensure(), i = PIDX(p.id), sn = i >= 0 ? t.seen[i] : 0;
    const V = { p, id: p.id, is3d: !!o.is3d, gone: false, api: o.api || STUB, visits: sn ? sn[0] : 0, lastDay: sn ? sn[2] : null, gain: null, timers: [], spotIds: null, root: null };
    let rej; V.goneP = new Promise((_, r) => { rej = r; }); V.goneP.catch(() => {});
    V.race = pr => Promise.race([Promise.resolve(pr), V.goneP]);
    V.later = (fn, ms) => { const h = setTimeout(() => { if (!V.gone) fn(); }, ms); V.timers.push(h); return h; };
    V.end = () => {
      if (V.gone) return;
      V.gone = true; rej(Gone); V.timers.forEach(clearTimeout);
      if (V.gain) {
        try { const g = V.gain.gain, now = V.gain.context.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.15); const gg = V.gain; setTimeout(() => { try { gg.disconnect(); } catch (e) { /* ignore */ } }, 300); } catch (e) { /* ignore */ }
        lastGain = V.gain;
      }
      if (SESS && SESS.visit === V) SESS.visit = null;
      document.querySelectorAll('.town-bark, .town-dot').forEach(el => { if (!V.root || V.root.contains(el)) el.remove(); });
      setTimeout(syncSheetClass, 260);
      log('gone', V.id);
    };
    V.ctx = makeCtx(V);
    return V;
  }
  let lastGain = null;
  function apiProxy(V) {
    return new Proxy({}, {
      get(_, k) {
        const a = V.api || STUB;
        if (typeof k === 'symbol' || k === 'then') return undefined;
        const val = a[k];
        if (typeof val !== 'function') return val;
        return (...args) => {
          if (V.gone) throw Gone;
          const r = val.apply(a, args);
          return r && typeof r.then === 'function' ? Promise.race([r, V.goneP]) : r;
        };
      },
      has(_, k) { return k in (V.api || STUB); },
    });
  }
  function makeCtx(V) {
    const p = V.p;
    const live = () => { if (V.gone) throw Gone; };
    const ctx = {
      place: p, id: p.id, is3d: V.is3d, week: week(), day: day(), name: G.herName(), visits: V.visits, first: V.visits === 0,
      get st() { return S(); },
      get town() { return ensure(); },
      api: apiProxy(V),
      get gone() { return V.gone; },
      async say(L) { live(); await V.race(playLines(V, L, 'say')); live(); },
      async play(L) { live(); await V.race(playLines(V, L, 'play')); live(); },
      toast(text, ms) { live(); qToast(text, ms); },
      async choose(prompt, options, o = {}) {
        live();
        const opts = (options || []).filter(Boolean).map(x => Object.assign({}, x, { label: fill(x.label) }));
        if (!opts.some(x => x.value === null)) opts.push({ label: 'Потом', value: null, cls: 'soft' });
        log('await', 'choose');
        const r = await V.race(G.choose(prompt ? fill(prompt) : '', opts, o));
        live(); return r === undefined ? null : r;
      },
      async line(spotId) { live(); await V.race(spotLine(V, spotId)); live(); },
      n(key) { live(); const s = sess(), k = p.id + ':' + key; s.n[k] = (s.n[k] || 0) + 1; return s.n[k]; },
      fact(id) { live(); return grantFact(id); },
      secret(id) { live(); return grantSecret(V, id); },
      has(id) { return hasFact(id) || hasSecret(id); },
      flag(k, val) {
        const t = ensure();
        if (arguments.length < 2) return t.k[k];
        live();
        if (val === null || val === undefined) delete t.k[k]; else t.k[k] = val;
        save(); return val;
      },
      used(spotId) { live(); markUsed(V, spotId); },
      async giveStamp() { live(); await V.race(grantStamp(V)); },
      get held() { return ensure().h; },
      setHeld(kind, data) { live(); setHeldNow(V, kind, data); },
      get look() { const lk = V.is3d && V.api && typeof V.api.look === 'function' ? call(V.api, 'look') : null; return Object.assign(heroLook(), lk || {}); },
      setLook(lk, persist) {
        live(); lk = lk || {};
        const H = window.HeroLooks;
        // образ целиком: { look } -> вместе со старыми цветами (3D меняет одежду сразу, 2D — по G.look())
        if (H && H.valid(lk.look)) lk = Object.assign({}, H.legacy(lk.look), lk);
        call(V.api, 'setLook', lk);
        if (persist) {
          const st = S(); let changed = false;
          if (H && H.valid(lk.look)) { changed = G.look() !== lk.look; if (changed) G.setLook(lk.look, { save: false }); }
          else ['bow', 'coat', 'hair'].forEach(k => { if (lk[k] && st[k] !== lk[k]) { st[k] = lk[k]; changed = true; } });
          if (changed) { ensure().k.lc = 1; save(); }
        }
      },
      get catHere() { return V.is3d ? !!call(V.api, 'catHere') : catFollows(); },
      async sit(seat) { live(); log('await', 'sit'); await V.race(doSit(V, seat)); live(); },
      stand() { live(); call(V.api, 'stand'); },
      async dim(k, ms) { live(); await V.race(call(V.api, 'dim', k, ms)); },
      focus(pos, look) { live(); if (pos && look) call(V.api, 'camFocus', pos, look); else call(V.api, 'focusHero', typeof pos === 'number' ? pos : undefined); },
      release() { live(); call(V.api, 'camRelease'); },
      sparkle(kind = 'star') { live(); sparkleHero(V, kind); },
      haptic(k) { live(); G.haptic(k); },
      sfx(n) { live(); G.sfx(n); },
      async sheet(o) { live(); log('await', 'sheet'); const r = await V.race(sheet(o)); live(); return r; },
      async overlay(el, ms) { live(); const r = await V.race(overlay(el, ms)); live(); return r; },
      finish() { live(); finishVisit(V); },
      audio() { live(); return gainFor(V); },
      mark(name) { log('await', name); },
      wait(ms) { live(); return V.race(sleep(ms)).then(() => live()); },
    };
    return ctx;
  }
  function finishVisit(V) {
    if (V.finish2D) { V.finish2D(); return; }
    if (V.is3d && V.api) { if (typeof V.api.leave === 'function') V.api.leave(); else call(V.api, 'finish', 'exit'); }
  }
  function gainFor(V) {
    if (V.gain) return V.gain;
    const a = G.audio(); if (!a) return null;
    try { V.gain = a.createGain(); V.gain.gain.value = 1; V.gain.connect((G.audioBus && G.audioBus('music')) || a.destination); } catch (e) { V.gain = null; }
    return V.gain;
  }
  function sparkleHero(V, kind) {
    try {
      if (V && V.is3d && V.api && typeof V.api.toScreen === 'function' && typeof V.api.heroPos === 'function') {
        const h = V.api.heroPos(), s = V.api.toScreen(h.x, 1.5, h.z);
        G.sparkle(s.x, s.y, { kind, n: 12, dist: 70 }); return;
      }
    } catch (e) { /* ignore */ }
    G.sparkle(undefined, undefined, { kind, n: 12, dist: 70 });
  }

  /* ---------- Реплики (§2.3) ---------- */
  // строка → тост в очереди; { who, text } → G.say; { f } → факт; { s } → секретик (после реплики); { if } → условие
  function resolveLine(V, L, defWho) {
    if (L == null || L === false) return null;
    if (typeof L === 'function') { let x = null; try { x = L(V.ctx); } catch (e) { console.warn('Town line', e); } return resolveLine(V, x, defWho); }
    if (L instanceof Variants) return L.list.length ? resolveLine(V, L.list[V.visits % L.list.length], defWho) : null;
    if (Array.isArray(L)) return { kind: 'seq', list: L };
    if (typeof L === 'string') return defWho ? { kind: 'say', who: defWho, text: fill(L) } : { kind: 'toast', text: fill(L) };
    if (typeof L !== 'object') return null;
    if (L.if) { let ok = false; try { ok = !!L.if(V.ctx); } catch (e) { ok = false; } if (!ok) return null; }
    let text = typeof L.text === 'function' ? L.text(V.ctx) : L.text;
    if (!text && L.f) { const x = factOf(L.f); text = x ? x.f.text : ''; }
    const who = L.who || defWho;
    const isSay = !!(who || L.f || L.s || L.say);
    return { kind: isSay ? 'say' : 'toast', who: who || 'narrator', text: fill(text || ''), f: L.f || null, s: L.s || null, ms: L.ms, fast: L.fast, say: !!L.say };
  }
  async function playLines(V, L, mode, defWho) {
    const r = resolveLine(V, L, defWho);
    if (!r) return;
    if (r.kind === 'seq') { for (const x of r.list) { if (V.gone) throw Gone; await playLines(V, x, mode, defWho); } return; }
    if (V.gone) throw Gone;
    if (r.text) {
      if (r.kind === 'toast' && mode !== 'say') {
        log('line', { id: V.id, kind: 'toast', text: r.text });
        const ms = qToast(r.text, r.ms);
        await V.race(sleep(ms * 0.6));
      } else {
        log('line', { id: V.id, kind: 'say', who: r.who, text: r.text });
        await G.say({ who: r.who || 'narrator', text: r.text, fast: r.fast });
      }
    }
    if (V.gone) throw Gone;
    if (r.f) grantFact(r.f);
    if (r.s) grantSecret(V, r.s);
  }
  function lineEligible(V, L) {
    if (L == null || L === false) return false;
    if (typeof L === 'function' || typeof L === 'string' || L instanceof Variants) return true;
    if (Array.isArray(L)) return L.some(x => lineEligible(V, x));
    if (typeof L !== 'object') return false;
    if (L.if) { try { if (!L.if(V.ctx)) return false; } catch (e) { return false; } }
    if (L.f && !factOpen(L.f)) return false;
    if (typeof L.wk === 'number' && week() < L.wk) return false;
    return true;
  }
  const unlearned = (V, L) => (Array.isArray(L) ? L.some(x => unlearned(V, x)) : !!(L && typeof L === 'object' && !(L instanceof Variants) && L.f && !hasFact(L.f) && lineEligible(V, L)));
  // следующая реплика точки: невыученный факт — первым; иначе цикл со сдвигом (визиты + номер точки)
  function pickNext(V, key, lines, mode, offset) {
    if (!Array.isArray(lines) || !lines.length) return null;
    const ok = lines.map(L => lineEligible(V, L));
    if (!ok.some(Boolean)) return null;
    const s = sess();
    const fi = lines.findIndex((L, i) => ok[i] && unlearned(V, L));
    if (fi >= 0) { if (mode === 'random') s.last[key] = fi; else s.cur[key] = (fi + 1) % lines.length; return lines[fi]; }   // после факта цикл идёт дальше, а не повторяет его
    if (mode === 'random') {
      let cand = lines.map((_, i) => i).filter(i => ok[i] && i !== s.last[key]);
      if (!cand.length) cand = lines.map((_, i) => i).filter(i => ok[i]);
      const i = cand[Math.floor(Math.random() * cand.length)];
      s.last[key] = i; return lines[i];
    }
    let cur = s.cur[key];
    if (cur === undefined) cur = (V.visits + (offset || 0)) % lines.length;
    for (let k = 0; k < lines.length; k++) { const i = (cur + k) % lines.length; if (ok[i]) { s.cur[key] = (i + 1) % lines.length; return lines[i]; } }
    return null;
  }
  async function spotLine(V, spotId) {
    const p = V.p, sp = p.spots && p.spots[spotId]; if (!sp) return;
    const L = pickNext(V, p.id + '/' + spotId, sp.lines, sp.mode, Object.keys(p.spots).indexOf(spotId));
    if (L) await playLines(V, L, 'play');
  }

  /* ---------- Факты, секретики, штампы ---------- */
  function factChip() {
    const el = document.createElement('div'); el.className = 'fact-chip'; el.textContent = '📒 Новый факт';
    G.app.appendChild(el);
    setTimeout(() => {
      const nb = document.querySelector('#hudMenu') || document.querySelector('#hudNb');   // HUD v2: блокнот — в меню ☰
      if (nb && !document.querySelector('#hud.hidden')) {
        const b = nb.getBoundingClientRect(), c = el.getBoundingClientRect();
        el.style.transform = `translate(${b.left + b.width / 2 - (c.left + c.width / 2)}px, ${b.top + b.height / 2 - (c.top + c.height / 2)}px) scale(.3)`;
        el.classList.add('fly');
      } else el.classList.add('out');
      setTimeout(() => { el.remove(); bumpBadge(); }, 700);
    }, 1300);
  }
  function grantFact(id) {
    const i = REG.facts.indexOf(id);
    if (i < 0) { townWarn('fact not in REG', id); return false; }
    const t = ensure(); if (bits.get(t.f, i)) return false;
    t.f = bits.set(t.f, i); save(); log('fact', id);
    factChip();
    return true;
  }
  function grantSecret(V, id) {
    const i = REG.secrets.indexOf(id);
    if (i < 0) { townWarn('secret not in REG', id); return false; }
    const t = ensure(); if (bits.get(t.s, i)) return false;
    t.s = bits.set(t.s, i); save(); log('secret', id);
    const so = secretOf(id);
    sparkleHero(V, 'heart'); G.sfx('sticker'); G.haptic('success');
    qToast(`✦ Нашла секрет: ${so ? so.s.title : id}`, 2800);
    bumpBadge();
    if (bits.count(t.s) >= 25 && !S().stickers.includes('sleuth')) setTimeout(() => G.giveSticker('sleuth', 'Ты нашла 25 секретов. Город нервно проверяет тайники.'), 1400);
    return true;
  }
  async function grantStamp(V) {
    const p = V.p, i = PIDX(p.id), t = ensure();
    if (i < 0 || bits.get(t.stp, i)) return false;
    t.stp = bits.set(t.stp, i); save(); log('stamp', p.id);
    const sd = p.stamp || {}, title = sd.title || p.short || p.id, icon = sd.icon || p.icon || '✦';
    const el = document.createElement('div'); el.className = 'stamp-slam';
    el.innerHTML = `<div class="ss-stamp" style="--ink:${inkOf(p.color)}"><div class="ss-em">${esc(icon)}</div><div class="ss-cap">${esc(title)}</div><div class="ss-date">${dateStr(day())}</div></div>`;
    await overlay(el, 950);
    G.haptic('rigid'); G.sfx('sticker');
    const n = bits.count(t.stp);
    qToast(`Штамп получен: ${title} · ${n}/12`, 3000);
    bumpBadge();
    if (n >= 12 && !S().stickers.includes('citizen')) {
      if (t.ph) { t.k.wp = 1; save(); }
      setTimeout(() => G.giveSticker('citizen', 'Все 12 мест исследованы! Теперь здесь тебе могут доверить даже ключи.'), 1300);
    }
    return true;
  }
  function markUsed(V, spotId) {
    const keys = Object.keys(V.p.spots || {}), bi = keys.indexOf(spotId), i = PIDX(V.p.id);
    if (bi < 0 || i < 0) return;
    const t = ensure(), m = 1 << bi;
    if (t.u[i] & m) return;
    t.u[i] |= m; save(); log('used', V.id + '/' + spotId);
    if (V.onUsed) V.onUsed(spotId);
  }
  async function stampCheck(V) {
    if (V.gone) return;
    const i = PIDX(V.id);
    if (i >= 0 && pop(ensure().u[i] || 0) >= 3) await grantStamp(V);
  }

  /* ---------- Что в руке: какао, попкорн, лейка; иначе — букет ---------- */
  const heldNow = () => { const t = ensure(), st = S(); if (t.h) return { kind: t.h, data: sess().hd }; return st.bouquet ? { kind: 'bouquet', data: st.bouquet } : null; };
  function setHeldNow(V, kind, data) {
    const t = ensure(), st = S();
    t.h = kind || null; sess().hd = kind ? (data || null) : null;
    const a = V && V.api;
    if (a && typeof a.setHeld === 'function') {
      try { if (kind) a.setHeld(kind, data); else if (st.bouquet) a.setHeld('bouquet', st.bouquet); else a.setHeld(null); } catch (e) { /* ignore */ }
    }
  }
  const HELD_DONE = { cup: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.', popcorn: 'Попкорн исчез. Пирожок клянётся, что ничего не трогал.' };
  function sitFinish(V) {
    const kind = ensure().h;
    if (!HELD_DONE[kind]) return;
    V.later(() => {
      if (ensure().h !== kind) return;
      if (V.is3d && V.api && V.api.isSitting === false) return;
      setHeldNow(V, null);
      qToast(HELD_DONE[kind]);
    }, V.is3d ? 3000 : 1200);
  }
  async function doSit(V, seat) {
    const a = V.api;
    if (V.is3d && a) {
      if (typeof a.sit === 'function') await a.sit(seat || {});
      else if (typeof a.walkTo === 'function' && seat) await a.walkTo(seat.x, seat.z + 0.35);
    }
    if (!V.gone) sitFinish(V);
  }

  /* ---------- Нижний лист и полноэкранные эффекты ---------- */
  function sheet(o = {}) {
    return new Promise(res => {
      const m = document.createElement('div');
      m.className = 'modal sheet' + (o.dark ? ' dark' : '') + (o.full ? ' full' : '') + (o.cls ? ' ' + o.cls : '');
      const acts = o.actions || [];
      m.innerHTML = `<div class="sheet-card" role="dialog"><div class="sheet-head"><div class="sheet-title">${esc(o.title || '')}</div><button class="sheet-x" aria-label="Закрыть">✕</button></div><div class="sheet-body"></div>${acts.length ? '<div class="sheet-actions"></div>' : ''}</div>`;
      const body = m.querySelector('.sheet-body');
      if (o.body instanceof Element) body.appendChild(o.body); else if (o.body != null) body.innerHTML = o.body;
      let closed = false;
      const close = v => {
        if (closed) return; closed = true; off();
        m.classList.add('out'); setTimeout(() => { m.remove(); syncSheetClass(); }, 230);
        log('sheet-close', v === undefined ? null : v);
        res(v === undefined ? null : v);
      };
      const off = G.onSkip(() => close(null));
      if (acts.length) {
        const box = m.querySelector('.sheet-actions');
        acts.forEach((a, i) => {
          const b = document.createElement('button');
          b.className = 'btn ' + (a.cls !== undefined ? a.cls : i ? 'soft' : '');
          b.textContent = a.label;
          b.addEventListener('click', e => { e.stopPropagation(); G.haptic('light'); G.sfx('tap'); close(a.value !== undefined ? a.value : a.label); });
          box.appendChild(b);
        });
      }
      m.querySelector('.sheet-x').addEventListener('click', e => { e.stopPropagation(); G.haptic('light'); close(null); });
      m.addEventListener('click', e => { if (e.target === m && !o.sticky) close(null); });
      G.layer.appendChild(m); document.body.classList.add('sheet-on');
      if (o.onMount) { try { o.onMount(body, close, m); } catch (e) { console.warn('sheet onMount', e); } }
    });
  }
  function overlay(el, ms = 900) {
    return new Promise(res => {
      el.classList.add('town-ov');
      let done = false;
      const fin = () => { if (done) return; done = true; off(); clearTimeout(tm); el.remove(); res(); };
      const off = G.onSkip(fin), tm = setTimeout(fin, ms);
      G.layer.appendChild(el);
    });
  }

  /* ---------- Вход: приветствие, оценка фильма, реакция, девиз ---------- */
  function greetLine(V) {
    const p = V.p, g = p.greet || {}, t = ensure(), i = PIDX(p.id);
    if (sess().entered[p.id]) return p.bark || null;
    const w = week(), wi = t.w[i] === '-' ? -1 : +t.w[i];
    if (V.visits === 0) return g.first || g.again || null;
    if (V.lastDay !== null && day() - V.lastDay >= 7 && g.away) return g.away;
    if (p.weekly && p.weekly[w] && wi < w) return p.weekly[w];
    if (V.visits >= 5 && g.regular) return g.regular;
    return g.again || g.regular || null;
  }
  function ratingLine(V) {
    if (typeof V.p.mention === 'function') { try { return V.p.mention(V.ctx); } catch (e) { return null; } }
    if (V.p.id !== 'cinema' || sess().entered.cinema) return null;
    const t = ensure(), w = week();
    let rw = -1;
    for (let k = w - 1; k >= 0; k--) if (t.r[k] && t.r[k] !== '-') { rw = k; break; }
    if (rw < 0 || t.k.rn === rw) return null;
    t.k.rn = rw; save();
    const ch = t.r[rw], n = ch === 'a' ? 10 : +ch;
    return isFinite(n) && n > 0 ? { who: 'raccoon', text: `Ваша прошлая оценка — ${n}/10. Режиссёр обдумывал её всю неделю. Режиссёр — это я.` } : null;
  }
  function reactLine(V) {
    const p = V.p, r = p.react || {}, t = ensure(), st = S();
    if (typeof p.reactFirst === 'function') { let L = null; try { L = p.reactFirst(V.ctx); } catch (e) { console.warn('reactFirst', p.id, e); } if (L) return L; }
    if (t.k.lc && r.look && p.id !== 'atelier') { delete t.k.lc; save(); return r.look; }
    if (t.h === 'cup' && r.cup) return r.cup;
    if (t.h === 'popcorn' && r.popcorn) return r.popcorn;
    const catH = V.ctx.catHere;
    if (catH && t.k.cb && r.beret) return r.beret;
    if (catH && st.catSweater && r.sweater) return r.sweater;
    if (!t.h && st.bouquet && r.bouquet) {
      const bit = 1 << PIDX(p.id), rb = t.k.rb || 0;
      if (!(rb & bit)) { t.k.rb = rb | bit; save(); return r.bouquet; }
    }
    return null;
  }
  function planWelcome(V) {
    const items = [];
    const g = greetLine(V); if (g) items.push(g);
    const rm = ratingLine(V); if (rm) items.push(rm);
    const rc = reactLine(V); if (rc) items.push(rc);
    return { items, motto: V.visits === 0 && !sess().entered[V.id] ? V.p.motto : null };
  }
  function markEntered(V) {
    const t = ensure(), i = PIDX(V.id), s = sess();
    if (i < 0) return;
    if (!s.entered[V.id]) { const sn = t.seen[i], d = day(); t.seen[i] = sn ? [sn[0] + 1, sn[1], d] : [1, d, d]; }
    s.entered[V.id] = (s.entered[V.id] || 0) + 1;
    t.w = t.w.slice(0, i) + String(week()) + t.w.slice(i + 1);
    save();
  }
  const dialogsClear = async V => { for (let k = 0; k < 400 && document.querySelector('#layer .dlg-wrap, #layer .modal'); k++) { if (V.gone) throw Gone; await sleep(150); } };
  // реплика-пузырёк над хозяином: не мешает ходить, гаснет сама
  async function barkLine(V, L, host) {
    const r = resolveLine(V, L, null);
    if (!r) return;
    if (r.kind === 'seq') { for (const x of r.list) { if (V.gone) return; await barkLine(V, x, host); } return; }
    if (!r.text) return;
    if (r.s || r.say) { await dialogsClear(V); await playLines(V, L, 'say'); return; }
    const hostWho = V.p.host && V.p.host.who;
    log('line', { id: V.id, kind: 'bark', who: r.who, text: r.text });
    // голос пузырька (js/voice.js): говорящий — тот, чья реплика, иначе хозяин места; наблюдатель voice.js этот пузырёк пропустит
    try { if (G.voiceLine && window.Voice) { Voice.markVoiced(r.text); G.voiceLine(r.who && r.who !== 'narrator' ? r.who : (hostWho || 'narrator'), r.text, { mode: 'bubble' }); } } catch (e) { /* без голоса */ }
    if (!host || !V.root || !window.THREE) { const ms = qToast(r.text); await V.race(sleep(ms * 0.8)); }
    else {
      const el = document.createElement('div'); el.className = 'town-bark';
      const sp = r.who && r.who !== hostWho && r.who !== 'narrator' && G.speakers && G.speakers[r.who];
      el.innerHTML = (sp ? `<b>${esc(sp.name())}:</b> ` : '') + esc(r.text);
      V.root.appendChild(el);
      let top = 1.3; const wp = new THREE.Vector3();
      try { const bx = new THREE.Box3().setFromObject(host.root || host); if (isFinite(bx.max.y)) top = bx.max.y + 0.12; } catch (e) { /* ignore */ }
      const W = () => V.root.clientWidth || 390;
      const upd = () => {
        if (!el.isConnected || V.gone) return;
        try {
          (host.root || host).getWorldPosition(wp);
          const s = V.api.toScreen(wp.x, top, wp.z), half = Math.min(el.offsetWidth / 2, W() / 2 - 8);
          el.style.left = clamp(s.x, half + 8, W() - half - 8) + 'px'; el.style.top = Math.max(70, s.y) + 'px';
        } catch (e) { /* ignore */ }
        requestAnimationFrame(upd);
      };
      upd();
      try { await V.race(sleep(clamp(1400 + 50 * r.text.length, 3000, 5200))); } finally { el.classList.add('out'); setTimeout(() => el.remove(), 320); }
    }
    if (r.f) grantFact(r.f);
  }
  async function runWelcome3D(V, plan) {
    const host = V.p.host && V.p.host.npc ? (V.api.npcs || {})[V.p.host.npc] : null;
    try {
      for (const L of plan.items) { if (V.gone) return; await barkLine(V, L, host); }
      if (plan.motto && !V.gone) qToast(plan.motto);
    } catch (e) { if (e !== Gone) console.warn('Town welcome', V.id, e); }
  }
  async function runWelcome2D(V, plan) {
    const who = V.p.host && V.p.host.who;
    for (const L of plan.items) { if (V.gone) return; await playLines(V, L, 'say', who || null); }
    if (plan.motto && !V.gone) qToast(plan.motto);
  }
  // ✦ над точками, где она ещё не была: 1,5 с пульсирует, потом — маленькая точка
  function spotDots(V) {
    const room = V.api.room, root = V.root;
    if (!room || !root) return;
    const keys = Object.keys(V.p.spots), i = PIDX(V.id);
    const els = (room.spots || []).filter(sp => !V.spotIds || V.spotIds.includes(sp.id)).map(sp => {
      const el = document.createElement('div'); el.className = 'town-dot pulse'; el.textContent = '✦'; root.appendChild(el);
      return { sp, el, bi: keys.indexOf(sp.id) };
    });
    setTimeout(() => els.forEach(d => d.el.classList.remove('pulse')), 1500);
    const upd = () => {
      if (V.gone || !root.isConnected) { els.forEach(d => d.el.remove()); return; }
      const hide = root.classList.contains('focus-on') || !!root.querySelector('.room-puzzle') || document.body.classList.contains('sheet-on');
      const u = ensure().u[i] || 0, Wd = root.clientWidth, Hd = root.clientHeight;
      els.forEach(d => {
        if (hide || (d.bi >= 0 && (u & (1 << d.bi)))) { d.el.style.display = 'none'; return; }
        try {
          const s = V.api.toScreen(d.sp.x, 1.9, d.sp.z - 0.6);
          if (s.x < 0 || s.x > Wd || s.y < 60 || s.y > Hd) { d.el.style.display = 'none'; return; }
          d.el.style.display = ''; d.el.style.left = s.x + 'px'; d.el.style.top = s.y + 'px';
        } catch (e) { d.el.style.display = 'none'; }
      });
      requestAnimationFrame(upd);
    };
    upd();
  }

  /* ---------- Точки и герои места ---------- */
  function spotOn(V, id) {
    const sp = V.p.spots && V.p.spots[id];
    if (!sp) return false;
    if (sp.cat && !V.ctx.catHere) return false;
    if (sp.when) { try { return !!sp.when(V.ctx); } catch (e) { return false; } }
    return true;
  }
  async function runSpot(V, id) {
    const p = V.p, sp = p.spots && p.spots[id];
    if (!sp || V.gone || !spotOn(V, id)) return;
    log('spot', V.id + '/' + id);
    try {
      markUsed(V, id);
      let handled = false;
      if (sp.onUse) handled = await V.race(sp.onUse(V.ctx, sp));
      if (!handled && !V.gone) await V.ctx.line(id);
      await stampCheck(V);
    } catch (e) { if (e !== Gone) console.warn('Town spot', p.id, id, e); }
  }
  async function runNpc(V, id) {
    if (V.gone) return;
    const p = V.p; log('npc', V.id + '/' + id);
    try {
      if (p.onNpc && await V.race(p.onNpc(V.ctx, id))) return;
      const lines = p.npc && p.npc[id];
      if (Array.isArray(lines) && lines.length) { const L = pickNext(V, p.id + '/npc:' + id, lines, 'cycle', 0); if (L) await playLines(V, L, 'play'); }
    } catch (e) { if (e !== Gone) console.warn('Town npc', p.id, id, e); }
  }

  /* ---------- Комната в 3D ---------- */
  function enter3D(p) {
    return new Promise(resolve => {
      const V = makeVisit(p, { is3d: true }); sess().visit = V;
      const st = S(), t = ensure(), catF = catFollows();
      V.spotIds = Object.keys(p.spots).filter(id => spotOn(V, id));
      let early = false, fell = false, settled = false;
      const settle = r => { if (settled) return; settled = true; V.end(); log('left', { id: p.id, r }); resolve(r); };
      const label = `${p.icon || ''} ${p.short || p.name || p.id}`.trim();
      log('enter', p.id);
      let pr = null;
      try {
        pr = City3D.run({
          room: p.room || p.id, mode: 'free', hudLabel: label,
          hero: heroLook(), catHelper: catF, catSweater: !!st.catSweater && catF, catBeret: !!t.k.cb && catF,
          held: heldNow(), spotIds: V.spotIds,
          // ☰ → «Образ» в комнате (js/city3d.js, Looks.change): путь гардероба ателье — героиня комнаты, сохранение, реплика про обновку
          onLook: id => { if (V.gone) return false; V.ctx.setLook({ look: id }, true); return true; },
          onSpot: (id, api) => { V.api = api; return runSpot(V, id); },
          onNpc: (id, api) => { V.api = api; return runNpc(V, id); },
          beforeActive: async api => {
            V.api = api;
            if (early || V.gone) { try { api.leave(); } catch (e) { /* ignore */ } return; }
            V.root = document.querySelector('#stage .screen:not(.out) .city3d.room3d') || document.querySelector('#stage .city3d.room3d');
            if (DEBUG) validate(p, api.room);
            const plan = planWelcome(V);
            markEntered(V);
            try { if (p.enter) await V.race(p.enter(V.ctx)); } catch (e) { if (e !== Gone) console.warn('Town enter', p.id, e); }
            if (V.gone) return;
            log('active', p.id);
            setTimeout(() => { if (!V.gone) { spotDots(V); runWelcome3D(V, plan); } }, 0);
          },
          done: r => settle(r),
          fallback: () => { fell = true; settle({ fallback: true }); },
        });
      } catch (e) { console.error('Town room', p.id, e); settle({ error: true }); return; }
      if (pr && typeof pr.catch === 'function') pr.catch(e => { console.error('Town room', p.id, e); settle({ error: true }); });
      // выйти можно с первой секунды — ещё во время «заходим…» (движок поставит свою кнопку, когда комната соберётся)
      if (!fell && !settled) {
        G.setHud({
          label, exitText: '← на улицу', top: true,
          onExit: () => {
            if (early || settled) return; early = true; V.end();
            const ld = document.querySelector('#stage .c3d-loading'); if (ld) ld.textContent = 'Возвращаемся на улицу…';
            log('early-exit', p.id);
          },
        });
      }
    });
  }

  /* ---------- Комната в 2D: карточки точек ---------- */
  function spotChips(V) {
    const p = V.p, t = ensure(), i = PIDX(p.id), u = t.u[i] || 0;
    return Object.keys(p.spots).map((id, bi) => {
      if (!spotOn(V, id)) return '';
      const sp = p.spots[id];
      const lab = typeof sp.label === 'function' ? sp.label(V.ctx) : sp.label || id;
      const ic = typeof sp.icon === 'function' ? sp.icon(V.ctx) : sp.icon || '✦';
      const secs = spotSecrets(sp), found = secs.some(hasSecret);
      return `<button class="tr-chip ${u & (1 << bi) ? 'used' : ''}" data-spot="${esc(id)}"><span class="tr-ic">${esc(ic)}</span><span class="tr-lb">${esc(fill(lab))}</span><span class="tr-mk">${u & (1 << bi) ? '✓' : ''}${found ? '<i>✦</i>' : ''}</span></button>`;
    }).join('');
  }
  function spotSecrets(sp) {
    const out = [];
    const walk = L => { if (!L) return; if (Array.isArray(L)) L.forEach(walk); else if (L instanceof Variants) L.list.forEach(walk); else if (typeof L === 'object' && L.s) out.push(L.s); };
    walk(sp.lines); if (sp.secret) out.push(sp.secret); if (Array.isArray(sp.secrets)) out.push(...sp.secrets);
    return out;
  }
  function speakerArt(who) { try { const sp = G.speakers && G.speakers[who]; return sp && sp.art ? sp.art() : ''; } catch (e) { return ''; } }
  function speakerName(who) { try { const sp = G.speakers && G.speakers[who]; return sp ? sp.name() : ''; } catch (e) { return ''; } }
  function cardHTML(V) {
    const p = V.p, who = p.host && p.host.who, sts = status(p.id);
    return `<div class="town-room-wrap" style="--band:${esc(p.color || '#FBE1E7')};--ink:${inkOf(p.color)}">
      <div class="tr-band"><div class="tr-icon">${esc(p.icon || '✦')}</div><div class="tr-sign">${esc(p.sign || p.name || p.id)}</div>${p.motto ? `<div class="tr-motto">${esc(p.motto)}</div>` : ''}</div>
      ${who ? `<button class="tr-host" data-host><div class="tr-ava">${speakerArt(who)}</div><div class="tr-hn"><b>${esc(speakerName(who))}</b><span>поговорить</span></div></button>` : `<div class="tr-host quiet"><div class="tr-hn"><b>${esc(p.name || '')}</b><span>${p.id === 'silver' ? 'Тихо. Только часы тикают.' : 'Хозяин куда-то отошёл'}</span></div></div>`}
      <div class="tr-grid">${spotChips(V)}</div>
      <p class="tr-foot">✦ ${sts.secrets}/${sts.secretsTotal} · ${sts.stamped ? 'штамп в паспорте' : 'штамп — за три разные точки'}</p>
    </div>`;
  }
  function enter2D(p) {
    return new Promise(resolve => {
      const V = makeVisit(p, { is3d: false }); sess().visit = V;
      const plan = planWelcome(V); markEntered(V);
      const scr = G.show(cardHTML(V), 'town-room');
      V.root = scr;
      let closed = false, busy = false;
      const close = () => {
        if (closed) return; closed = true; V.end();
        if (window.HUD && HUD.menu) HUD.menu.remove('t-look');
        G.skipDialogs(true); closeLayer(); syncSheetClass(); setTimeout(() => G.skipDialogs(false), 400);
        log('left', { id: p.id, r: 'exit' }); resolve('exit');
      };
      V.finish2D = close;
      G.setHud({ label: `${p.icon || ''} ${p.short || p.id}`.trim(), onExit: close, exitText: '← на улицу' });
      // ☰ → «Образ» и в 2D-комнате (js/looks_picker.js Looks.change): героиня здесь — в репликах (рисунок героини — по G.look()),
      // путь — тот же, что у зеркала ателье (ctx.setLook). Пока идёт реплика (и приветствие хозяйки) или открыт лист — «минутку»,
      // как в 3D-сценах (их blocked()): карусель поверх реплики прятала бы её, а Enter листал бы невидимую
      if (window.HUD && HUD.menu && window.Looks && Looks.menuItem) {
        const talk = () => !!document.querySelector('#layer .dlg-wrap, #layer .modal, .img-full');
        HUD.menu.add(Looks.menuItem({ id: 't-look', when: () => !closed && !V.gone, gone: () => closed || V.gone, busy: () => (busy || talk() ? 'wait' : ''),
          apply: id => { if (closed) return false; V.ctx.setLook({ look: id }, true); return true; } }));
      }
      const paint = () => {
        if (closed) return;
        const g = scr.querySelector('.tr-grid'); if (g) g.innerHTML = spotChips(V);
        const sts = status(p.id), f = scr.querySelector('.tr-foot'); if (f) f.textContent = `✦ ${sts.secrets}/${sts.secretsTotal} · ${sts.stamped ? 'штамп в паспорте' : 'штамп — за три разные точки'}`;
      };
      V.onUsed = () => setTimeout(paint, 0);
      scr.addEventListener('click', async e => {
        const b = e.target.closest('[data-spot], [data-host]');
        if (!b || closed || busy) return;
        busy = true; V.busy = true; G.haptic('light'); G.sfx('tap');
        try {
          if (b.dataset.host !== undefined) await runNpc(V, p.host.npc || p.host.who);
          else await runSpot(V, b.dataset.spot);
        } finally { busy = false; V.busy = false; paint(); }
      });
      log('enter', p.id); log('active', p.id);
      (async () => {
        try { if (p.enter) await V.race(p.enter(V.ctx)); await runWelcome2D(V, plan); } catch (e) { if (e !== Gone) console.warn('Town 2D enter', p.id, e); }
        paint();
      })();
    });
  }

  /* ---------- Улица: двери, точки, кот ---------- */
  const DOOR_X = { cinema: 0, bureau: 6.2, silver: 12.47, sweets: 17.25, stairs: 23.7, orangery: -7.2, atelier: -11.0, photo: -14.8, records: 30.1, books: 33.9, planet: 38.1 };
  const SHORT0 = { cinema: 'Кинотеатр', bureau: 'Бюро', silver: 'Часовщик', sweets: 'Кондитерская', stairs: 'Подъезд', orangery: 'Оранжерея', atelier: 'Ателье', photo: 'Фотостудия', records: 'Пластинки', books: 'Книжная лавка', planet: 'Планетарий' };
  const BOUNDS = { x0: -16.2, x1: 39.6 };
  const SHUT_TEXT = 'Откроется в субботу';
  function doorList() {
    return REG.places.filter(id => id !== 'kiosk').map(id => {
      const p = get(id);
      if (p && p.kind === 'counter') return null;
      const s = status(id), x = p && p.street && typeof p.street.x === 'number' ? p.street.x + (p.street.doorDx || 0) : DOOR_X[id];
      return {
        id, x, bkey: (p && p.street && p.street.bkey) || (id === 'stairs' ? 'roof' : null),
        label: (p ? p.short : SHORT0[id]) + (p && s.shut ? ' · откроется в субботу' : ''),
        mark: s.shut ? null : s.unvisited ? 'new' : s.fresh ? 'fresh' : null, open: !s.shut,
      };
    }).filter(Boolean);
  }
  const STREET_SPOTS = [
    { id: 'flowers', x: -3.2, z: -0.3, act: 'Букет', bubble: 'цветы от Жу' },
    { id: 'weather', x: 3.1, z: -0.6, act: 'Прогноз', bubble: 'табло прогноза' },
    { id: 'bench1', x: 4.4, z: -0.55, act: 'Присесть', bubble: 'лавочка' },
    { id: 'kiosk', x: 9.6, z: -0.3, act: 'Газета', bubble: 'свежий номер' },
    { id: 'mailbox', x: 13.6, z: -0.9, act: 'Почта', bubble: 'почтовый ящик' },
    { id: 'bench2', x: 20.4, z: -0.55, act: 'Присесть', bubble: 'лавочка' },
    { id: 'endL', x: -16.6, z: -0.5, act: 'Смотреть', bubble: 'конец улицы' },
    { id: 'endR', x: 39.9, z: -0.5, act: 'Смотреть', bubble: 'конец улицы' },
  ].map(sp => Object.assign({}, sp, { x: clamp(sp.x, BOUNDS.x0 + 0.05, BOUNDS.x1 - 0.05) }));   // подход к концам улицы — внутри границ
  const SEATS = { bench1: { x: 4.4, z: -1.15, ry: 0 }, bench2: { x: 20.4, z: -1.15, ry: 0 } };
  const FLOWER_W = ['тюльпаны', 'хризантемы', 'астры', 'вереск', 'веточки хлопка', 'эвкалипт', 'амариллис'];
  const BENCH = [
    'Финалыч пробежал мимо, енот — следом, с платочком. Театр без билетов.',
    'Пудра гуляет, гусёнок — за Пудрой. Всё по плану.',
    'Голубь сел рядом и молчит. Хороший собеседник.',
    'Жу пролетела с ромашкой. Срочная доставка.',
    'Лист упал прямо на макушку. Осень ставит печать.',
    { wk: 5, text: 'Снежинка села на рукав. Шесть лучей, как положено.' },
    { wk: 6, text: 'Над улицей зажглась гирлянда. Город держится — вместе.' },
  ];
  function nextBench() {
    const s = sess(), w = week();
    const ok = BENCH.map((b, i) => [b, i]).filter(([b]) => typeof b === 'string' || w >= b.wk);
    let cand = ok.filter(([, i]) => !s.bench.includes(i));
    if (!cand.length) { s.bench = []; cand = ok; }
    const [b, i] = cand[0]; s.bench.push(i);
    return typeof b === 'string' ? b : b.text;
  }
  function streetVisit(p, api, is3d) { const V = makeVisit(p, { is3d, api }); sess().street.add(V); return V; }
  function endStreetVisits() { if (!SESS) return; SESS.street.forEach(V => V.end()); SESS.street.clear(); }
  // уличный «визит» без места: для лавочек и чашки в руке
  const STREET_PLACE = { id: 'street', spots: {}, short: 'Улица', name: 'Улица' };
  async function streetSpot(id, api, is3d) {
    const st = S(), t = ensure();
    log('street', id);
    try {
      if (id === 'flowers') {
        const kit = Ep1kit();
        const v = await G.choose('Ж-ж-ж! Что выберем?', [
          { label: st.bouquet ? 'Пересобрать букет' : 'Собрать букет', value: 'b' }, { label: 'Цветок недели', value: 'w', cls: 'soft' }, { label: 'Потом', value: null, cls: 'soft' }], { who: 'bee' });
        if (v === 'b') {
          const had = st.bouquet;
          if (kit.bouquetFlow) await kit.bouquetFlow(is3d ? api : null);
          else if (kit.flowerCart) await kit.flowerCart(is3d ? api : null);
          if (S().bouquet !== had && t.h) { t.h = null; sess().hd = null; }   // новый букет — в руке он
        } else if (v === 'w') await G.say({ who: 'bee', text: `На этой неделе у нас ${FLOWER_W[week()]}. Взять? Красота сама себя не понесёт.` });
        return;
      }
      if (id === 'kiosk') {
        const p = get('kiosk');
        if (!p || typeof p.open !== 'function') { qToast('Редакция на совещании. Слышно, как кто-то хрустит печеньем.'); return; }
        const V = streetVisit(p, api, is3d);
        if (!sess().entered.kiosk) markEntered(V);
        try { await V.race(p.open(V.ctx)); } catch (e) { if (e !== Gone) console.warn('kiosk', e); }
        V.end(); sess().street.delete(V);
        return;
      }
      if (id === 'mailbox') { qToast('Почтовый ящик. Писем нет — все ушли гулять.'); return; }
      if (id === 'weather') {
        const L = week() >= 5 ? ['Снег. Идеальное оправдание для ещё одного какао.', 'Солнце пока не нашлось. Кондитерская работает без перебоев.'] : ['Пасмурно. Зато идеальная погода зайти за какао.', 'Солнце пока не нашлось. Кондитерская работает без перебоев.'];
        qToast(L[sess().weatherI++ % L.length]); return;
      }
      if (id === 'bench1' || id === 'bench2') {
        const V = streetVisit(STREET_PLACE, api, is3d);
        try {
          if (is3d && api) { if (typeof api.sit === 'function') await V.race(api.sit(SEATS[id])); else if (typeof api.walkTo === 'function') await V.race(api.walkTo(SEATS[id].x, SEATS[id].z + 0.35)); }
          sitFinish(V);
          await V.race(sleep(is3d ? 3000 : 400));
          if (is3d && api && api.isSitting === false) return;
          qToast(nextBench());
          await V.race(sleep(is3d ? 1800 : 600));
        } catch (e) { if (e !== Gone) console.warn('bench', e); }
        finally { V.end(); sess().street.delete(V); }
        return;
      }
      if (id === 'endR' && tripOk()) { await tripCards(); return; }   // волна 3: прежняя улица — поездка карточками
      if (id === 'endL' || id === 'endR') { qToast('Дальше — туман. Следствие туда пока не ходит.'); return; }
    } catch (e) { console.warn('Town street spot', id, e); }
  }
  async function catOffer(api, is3d) {
    const t = ensure();
    if (t.cat === 1 || S().catHelper === true) { qToast('Мур. Выходной идёт по плану.'); return; }
    await G.say({ who: 'cat', text: 'Я на выходном. Но гулять рядом могу — без советов.' });
    if (G.isSkipping()) return;
    const v = await G.choose('', [{ label: 'Пойдём', value: 1 }, { label: 'Гуляю одна', value: 0, cls: 'soft' }], { who: 'cat' });
    if (v === 1) { t.cat = 1; save(); if (is3d && api) call(api, 'catFree'); G.haptic('success'); }
    else if (v === 0) { t.cat = 0; save(); }
  }
  async function firstWalkHints() {
    const t = ensure();
    if (t.hi) return;
    await G.say({ text: 'Добро пожаловать обратно. На этот раз никаких срочных расследований.' });
    if (G.isSkipping()) return;
    if (catFollows()) { await G.say({ who: 'cat', text: 'Ура, выходной. Я планирую зайти в кондитерскую и ничего не расследовать.' }); if (G.isSkipping()) return; }
    qToast('Выбирай дом и нажимай: героиня сама подойдёт к двери.', 3200);
    qToast('В домах спрятаны секреты ✦. За исследование получишь штампы в блокнот.', 3600);
    t.hi = 1; save();
  }
  function hintDoorFrom(x0) {
    let best = null, bd = 1e9;
    doorList().forEach(d => { if (!d.open || !d.mark) return; const dd = Math.abs(d.x - x0); if (dd < bd) { bd = dd; best = d.id; } });
    return best;
  }

  /* ---------- Улица в 3D ---------- */
  function streetOpts3D(spawnAt, done, fallback) {
    const t = ensure(), st = S(), w = week(), catF = catFollows(), kit = Ep1kit();
    const doors = doorList();
    const sd = doors.find(d => d.id === spawnAt);
    let picks = [];
    try { picks = kit.stageFinds ? kit.stageFinds(3).map(f => ({ id: f.id, kind: f.kind, x: f.x, z: f.z, held: !!f.held })) : []; } catch (e) { picks = []; }
    return {
      idx: 4,
      free: {
        doors: doors.map(d => ({ id: d.id, bkey: d.bkey, x: d.x, label: d.label, mark: d.mark })),
        spawnAt, bounds: Object.assign({}, BOUNDS), cam: { x0: -14.6, x1: 37.6 },
        catAt: catF ? null : t.cat === 0 ? { x: 3.5, z: -0.7 } : { x: 1.3, z: -0.9 },
        hintDoor: hintDoorFrom(sd ? sd.x : 0),
        decor: { sweaters: w >= 2 ? 2 : w >= 1 ? 1 : 0, snow: w >= 5, garlands: w >= 6, portrait: t.k.wp && t.ph ? heroLook() : null },
        exitText: '← в меню', menuSub: progressLine,
      },
      openDoors: doors.filter(d => d.open).map(d => d.id), closedText: SHUT_TEXT,
      hero: heroLook(), catHelper: catF, catSweater: !!st.catSweater && catF, catBeret: !!t.k.cb && catF, held: heldNow(),
      spots: STREET_SPOTS.map(sp => Object.assign({}, sp)),
      onSpot: (id, api) => streetSpot(id, api, true),
      onNpc: (id, api) => (id === 'cat' ? catOffer(api, true) : null),
      pickups: picks, onPickup: (id, api) => (kit.pickFind ? kit.pickFind(id, api) : null),
      lines: kit.STREET_LINES || {}, hudLabel: 'Город нараспашку',
      heroLine: 'Образ держится. Планов нет. Какое счастье.',
      beforeActive: async () => { await firstWalkHints(); },
      done, fallback,
    };
  }
  const M = () => window.Missions || null;
  // дела сезона в прогулке: метки (открытые — луч и 🔍, будущие — замок с датой) и карточка «Сегодняшнее дело»
  function withMissions(o) {
    const m = M();
    if (!m) return o;
    o.world = Object.assign(m.worldExtras({ mode: 'free' }), o.world || {});
    if (m.debug) m.debug.last = o.world;
    // улица-запас: миссии вне полосы — точки-указатели у края улицы (тап отдаёт дверь, как в городе)
    const ms = m.streetSpots();
    if (ms.length) {
      o.spots = (o.spots || []).concat(ms);
      const os = o.onSpot;
      o.onSpot = (id, api) => { const door = m.spotDoor(id); if (door && api && typeof api.finish === 'function') { api.finish({ door }); return null; } return os ? os(id, api) : null; };
    }
    let card = null;
    const drop = () => { if (card) { card.remove(); card = null; } };
    const ba = o.beforeActive;
    o.beforeActive = async api => { drop(); if (!m.inWorld(api)) card = m.mountCard(o.world.hud, { onTap: c => qToast(c.lock ? 'Новое дело откроется само — дата на карточке.' : 'Ищи дверь со светящейся меткой.') }); if (ba) return ba(api); };
    const done = o.done, fb = o.fallback;
    o.done = r => { drop(); done(r); };
    o.fallback = () => { drop(); fb(); };
    return o;
  }
  function street3D(spawnAt) {
    return new Promise(res => {
      let settled = false;
      const fin = r => { if (settled) return; settled = true; endStreetVisits(); log('street-done', r); res(r); };
      const o = withMissions(streetOpts3D(spawnAt, r => fin(r), () => { S().force2d = true; save(); fin('2d'); }));
      let pr;
      try { pr = M() ? M().runStreet(o) : City3D.run(o); } catch (e) { console.error('Town street', e); sess().no3d = true; fin('2d'); return; }
      if (pr && typeof pr.catch === 'function') pr.catch(e => { console.error('Town street', e); sess().no3d = true; fin('2d'); });
      log('street', spawnAt);
    });
  }

  /* ---------- Волна 3: карта и поездка без 3D-города (2D-прогулка и прежняя улица) ---------- */
  const mapOk2d = () => !!(window.WORLD && WORLD.Minimap && WORLD.LAYOUT && WORLD.doorsStatic);
  // поездка открыта вместе с машиной (CONFIG.UNLOCK.trip = 'car'); карточки — js/world/trip2d.js
  const tripOk = () => { try { return !!(window.WORLD && WORLD.Trip2D && (!M() || !M().unlock || M().unlock('trip').ok)); } catch (e) { return false; } };
  async function tripCards() {
    const v = await G.choose('Серпантин, облака и башня над ними. Поехали?', [{ label: 'Поехали!', value: 1 }, { label: 'Не сейчас', value: 0, cls: 'soft' }], { who: 'narrator' });
    if (v !== 1 || G.isSkipping()) return;
    try { await WORLD.Trip2D.run({ from: 'city' }); } catch (e) { console.warn('trip2d', e); }
  }
  function openMap2d(scr) {
    const ids = new Set([...scr.querySelectorAll('[data-place],[data-shut]')].map(x => x.dataset.place || x.dataset.shut));
    const pois = WORLD.doorsStatic().filter(d => ids.has(d.id)).map(d => ({ id: d.id, kind: d.kind === 'story' ? 'mission' : 'place', x: d.x, z: d.z, label: d.label }));
    WORLD.Minimap.openSheet({ pois, onlyPois: true, travelLabel: 'Зайти', onTravel: p => { const t = scr.querySelector(`[data-place="${p.id}"], [data-shut="${p.id}"]`); if (t) t.click(); },
      tripOpen: () => tripOk(), onTravelRegion: () => tripCards() });   // волна 4 (MAP): точка в горах → поездка карточками
  }

  /* ---------- Улица в 2D: список мест в порядке улицы ---------- */
  function street2DHTML() {
    const t = ensure(), st = S(), c = counts(), kit = Ep1kit();
    const m = M();
    const mCard = m ? m.cardHTML(m.caseCard(), { inline: true }) : '';
    const mDoors = {};
    if (m) (m.worldExtras({ mode: 'free' }).markers || []).forEach(k => { mDoors[k.door] = k; });
    const mTag = id => { const k = mDoors[id]; return !k ? '' : k.style === 'soon' ? `<i class="tc-mis soon">🔒 ${esc(k.sub || '')}</i>` : `<i class="tc-mis">🔍 дело</i>`; };
    const mCards = m ? m.cards2d().filter(d => !REG.places.includes(d.door)).map(d => `<button class="town-card mis" data-place="${esc(d.door)}" style="--band:#FFE7A8"><div class="tc-ic">🔍</div><div class="tc-tx"><b>${esc(d.title)}</b><span>${esc(d.task)}</span></div></button>`).join('') : '';
    let left = [];
    try { left = kit.stageFinds ? kit.stageFinds(3) : []; } catch (e) { left = []; }
    const cards = list().filter(p => REG.places.includes(p.id)).map(p => {
      const s = status(p.id);
      if (s.shut) return `<button class="town-card shut" data-shut="${esc(p.id)}" style="--band:${esc(p.color || '#EEE')}"><div class="tc-ic">${esc(p.icon || '✦')}</div><div class="tc-tx"><b>${esc(p.name || p.short)}</b><span>${SHUT_TEXT}</span></div>${mTag(p.id) ? `<div class="tc-mk">${mTag(p.id)}</div>` : ''}</button>`;
      const marks = mTag(p.id) + (s.unvisited ? '<i class="tc-new" title="ещё не была"></i>' : '') + (s.fresh ? '<i class="tc-fresh">НОВОЕ</i>' : '') + (s.stamped ? '<i class="tc-ok">✓</i>' : '') + (s.secrets ? `<i class="tc-sec">✦ ${s.secrets}/${s.secretsTotal}</i>` : '');
      return `<button class="town-card" data-place="${esc(p.id)}" style="--band:${esc(p.color || '#FBE1E7')}"><div class="tc-ic">${esc(p.icon || '✦')}</div><div class="tc-tx"><b>${esc(p.name || p.short)}</b><span>${esc(p.motto || '')}</span></div><div class="tc-mk">${marks}</div></button>`;
    }).join('');
    const chips = [['flowers', '🌸 Тележка Жу'], ['kiosk', '📰 Киоск'], ['mailbox', '📮 Почтовый ящик'], ['weather', '🌦 Погода'], ['bench', '🪑 Лавочка']]
      .concat(left.length ? [['finds', '🔍 Осмотреть тротуар']] : [])
      .concat(mapOk2d() ? [['map', '🗺 Карта']] : [])     // волна 3: большая карта без 3D (MAPUI)
      .concat(tripOk() ? [['trip', '⛰ Дорога наверх']] : [])   // волна 3: поездка карточками (REGION, trip2d.js)
      .map(([k, l]) => `<button class="chip town-chip" data-chip="${k}">${l}</button>`).join('');
    const catCard = t.cat === null && st.catHelper !== true ? `<button class="town-card cat" data-chip="cat" style="--band:#FFE3C8"><div class="tc-ic">🐈</div><div class="tc-tx"><b>Пирожок сидит у кинотеатра</b><span>Нажми — спросить, гуляет ли он</span></div></button>` : '';
    return `<div class="town2d-wrap grow">
      <div class="t2-head"><div class="case-badge">Город нараспашку</div><div class="t2-count">Штампы ${c.stamps}/12 · Факты ${c.facts}/${c.factsAvail} · Секретики ${c.secrets}/${c.secretsTotal}</div></div>
      ${mCard ? `<div class="t2-case">${mCard}</div>` : ''}
      ${catCard}
      <div class="t2-list">${mCards}${cards}</div>
      <div class="t2-chips">${chips}</div>
      <p class="tiny muted t2-foot">Двери открыты. Дело подождёт.</p>
    </div>`;
  }
  function street2D() {
    return new Promise(res => {
      let closed = false, busy = false;
      const scr = G.show(street2DHTML(), 'town2d');
      const hud = () => G.setHud({ label: 'Город нараспашку', menuSub: progressLine, onExit: () => close('menu'), exitText: '← в меню', exitPlace: 'menu' });
      const close = r => {
        if (closed) return; closed = true; endStreetVisits();
        if (r === 'menu') { G.skipDialogs(true); closeLayer(); syncSheetClass(); setTimeout(() => G.skipDialogs(false), 400); }
        log('street-done', r); res(r);
      };
      const repaint = () => { if (!closed) { scr.innerHTML = street2DHTML(); hud(); } };
      hud();
      scr.addEventListener('click', async e => {
        if (e.target.closest('.w-case')) { G.haptic('light'); const c = M() && M().caseCard(); if (c) qToast(c.lock ? 'Новое дело откроется само — дата на карточке.' : 'Дело ждёт: карточка с 🔍 в списке.'); return; }
        const b = e.target.closest('[data-place], [data-shut], [data-chip]');
        if (!b || closed || busy) return;
        G.haptic('light'); G.sfx('tap');
        if (b.dataset.shut) { qToast(SHUT_TEXT); return; }
        if (b.dataset.place) { close({ door: b.dataset.place }); return; }
        if (b.dataset.chip === 'map') { try { openMap2d(scr); } catch (err) { console.warn('town2d map', err); } return; }
        busy = true;
        try {
          const k = b.dataset.chip;
          if (k === 'bench') await streetSpot('bench1', STUB, false);
          else if (k === 'cat') await catOffer(STUB, false);
          else if (k === 'finds') { const kit = Ep1kit(), f = kit.stageFinds ? kit.stageFinds(3)[0] : null; if (f && kit.pickFind) await kit.pickFind(f.id, null); }
          else if (k === 'trip') await tripCards();
          else await streetSpot(k, STUB, false);
        } catch (err) { console.warn('town2d chip', err); } finally { busy = false; repaint(); }
      });
      log('street', '2d');
      firstWalkHints().catch(() => {});
    });
  }

  /* ---------- Прогулка целиком (§2.7) ---------- */
  const use3D = () => !!(window.City3D && City3D.supported && !S().force2d && !(SESS && SESS.no3d));
  async function loop3D() {
    const t = ensure();
    let spawn = t.at;
    for (;;) {
      let door = sess().jump; sess().jump = null;
      if (!door) {
        const r = await street3D(spawn);
        if (r === '2d') return loop2D();
        if (r === 'menu' || !r) { if (sess().jump) continue; return 'menu'; }
        door = r.door;
      }
      const mis = M() && M().atDoor(door);
      if (mis) { await M().run(mis.id); await G.untilNotSkipping(); if (DOOR_X[door] !== undefined) spawn = door; continue; }
      const p = get(door);
      if (!p) { spawn = door && DOOR_X[door] !== undefined ? door : spawn; continue; }
      if (p.kind !== 'counter') { t.at = door; save(); }
      if (!use3D()) return loop2D();
      const r2 = await enter3D(p);
      if (r2 && r2.fallback) {
        if (window.City3D && City3D.hasRoom && !City3D.hasRoom(p.room || p.id)) await enter2D(p);   // комнаты ещё нет — карточная
        else { S().force2d = true; save(); await G.untilNotSkipping(); return loop2D(); }
      }
      await G.untilNotSkipping();
      if (p.kind !== 'counter') spawn = door;
    }
  }
  async function loop2D() {
    for (;;) {
      let door = sess().jump; sess().jump = null;
      if (!door) {
        const r = await street2D();
        if (r === 'menu' || !r) { if (sess().jump) continue; return 'menu'; }
        door = r.door;
      }
      const mis = M() && M().atDoor(door);
      if (mis) { await M().run(mis.id); await G.untilNotSkipping(); continue; }
      const p = get(door); if (!p) continue;
      if (p.kind !== 'counter') { ensure().at = door; save(); }
      await enter2D(p);
      await G.untilNotSkipping();
    }
  }
  async function run(opts = {}) {
    if (!unlocked() || Town.running) return 'menu';
    Town.running = true;
    try {
      ensure(); applyPatches();
      SESS = newSession();
      const t = ensure(); t.h = null;
      if (opts.place && get(opts.place)) SESS.jump = opts.place;
      log('run', opts.from || '');
      if (use3D()) await loop3D(); else await loop2D();
      save();
      return 'menu';
    } catch (e) { console.error('Town.run', e); return 'menu'; } finally {
      if (SESS) endStreetVisits();
      Town.running = false; SESS = null;
      syncSheetClass();
    }
  }

  /* ---------- Один заход в место без уличного цикла (боковые двери во время дела) ---------- */
  // Во время серии 1 — только места, проверенные на спойлеры (storySafe: true в описании места).
  const storySafe = id => { const p = get(id); return !!p && p.kind !== 'story' && p.kind !== 'counter' && p.storySafe === true; };
  async function visit(id, o = {}) {
    const p = get(id);
    if (!p || p.kind === 'counter' || !REG.places.includes(id)) return 'closed';
    ensure(); applyPatches();
    if (status(id).shut) return 'closed';
    if (!unlocked() && !(o.story && storySafe(id))) return 'closed';
    if (Town.running && SESS && SESS.visit) return 'closed';
    const own = !SESS; if (own) SESS = newSession();
    const t = ensure(); if (o.story) t.h = null;
    log('visit', { id, story: !!o.story });
    try {
      if (use3D()) {
        const r = await enter3D(p);
        await G.untilNotSkipping();
        if (r && r.fallback) {
          if (window.City3D && City3D.hasRoom && !City3D.hasRoom(p.room || p.id)) { await enter2D(p); await G.untilNotSkipping(); return 'ok'; }
          return 'fallback';
        }
        return r && r.error ? 'fallback' : 'ok';
      }
      await enter2D(p); await G.untilNotSkipping();
      return 'ok';
    } catch (e) { console.error('Town.visit', id, e); return 'fallback'; }
    finally {
      if (o.story) t.h = null;
      if (own) { endStreetVisits(); SESS = null; syncSheetClass(); }
    }
  }
  // один уличный отрезок прогулки (общий цикл дел серии 2 и дальше): { door } | 'menu'
  async function walkOnce(spawnAt) {
    if (!unlocked()) return 'menu';
    ensure(); applyPatches();
    const own = !SESS; if (own) SESS = newSession();
    try {
      const sp = spawnAt && DOOR_X[spawnAt] !== undefined ? spawnAt : ensure().at;
      const r = use3D() ? await street3D(sp) : await street2D();
      return r === '2d' ? await street2D() : r;
    } finally { if (own) { endStreetVisits(); SESS = null; syncSheetClass(); } }
  }

  /* ---------- Паспорт города в блокноте (§8) ---------- */
  const PH_BG = ['#FBE1E7', '#D9CCF4', '#BFE6D3', '#FFF1A8', '#FFE3C8', '#DCE8F6'];
  function photoCardHTML(cls = '') {
    const t = ensure(), lk = heroLook(), m = /b(\d)/.exec(t.ph || ''), bg = PH_BG[(m ? +m[1] : 0) % PH_BG.length];
    let art = '';
    try { art = Art.heroine({ crop: true, look: lk.look, bow: lk.bow, coat: lk.coat, hair: lk.hair }); } catch (e) { art = ''; }
    return `<div class="town-photocard ${cls}"><div class="tp-photo" style="background:${bg}">${art}</div><div class="tp-cap">Фотокарточка</div></div>`;
  }
  function passportHTML() {
    const st = S();
    if (!unlocked()) return '';
    const t = ensure(), c = counts();
    const cells = REG.places.map((id, i) => {
      const p = get(id), sn = t.seen[i], s = status(id), icon = p ? (p.stamp && p.stamp.icon) || p.icon || '✦' : '✦';
      let inner, cls;
      if (s.stamped) { cls = 'got'; inner = `<div class="ps-em">${esc(icon)}</div><div class="ps-cap">${esc(p ? (p.stamp && p.stamp.title) || p.short : id)}</div><div class="ps-date">${dateStr(sn ? sn[1] : day())}</div>`; }
      else if (sn) { cls = 'seen'; inner = `<div class="ps-em">${esc(icon)}</div>`; }
      else { cls = 'none'; inner = '?'; }
      return `<button class="ps-cell" data-ps="${id}"><div class="ps-stamp ${cls}" style="--ink:${inkOf(p && p.color)};--r:${seededRot(id)}deg">${inner}</div><div class="ps-sec">✦ ${s.secrets}/${s.secretsTotal}</div></button>`;
    }).join('');
    const keep = [];
    if (t.ph) keep.push(`<div class="ps-keep">${photoCardHTML('mini')}<span>📷 Фотокарточка</span></div>`);
    if (t.k.curl) keep.push('<div class="ps-keep"><i>✨</i><span>Завиток</span></div>');
    if (t.k.bud) keep.push('<div class="ps-keep"><i>🌼</i><span>Цветок-дежурный</span></div>');
    if (t.k.cb) keep.push('<div class="ps-keep"><i>🐾</i><span>Пирожок в берете</span></div>');
    const rates = t.r.split('').filter(ch => ch !== '-').map(ch => (ch === 'a' ? 10 : +ch) + '/10');
    if (rates.length) keep.push(`<div class="ps-keep wide"><i>🎞</i><span>Оценки недели: ${esc(rates.join(' · '))}</span></div>`);
    if (t.ch) keep.push(`<div class="ps-keep wide"><i>📖</i><span>Глав прочитано: ${Math.min(7, t.ch)} из 7</span></div>`);
    const stk = ['citizen', 'sleuth'].filter(k => st.stickers.includes(k) && G.STICKERS[k]).map((k, i) => `<div class="nb-slot got ps-sticker" style="--r:${i ? 4 : -3}deg">${G.STICKERS[k].art()}<div class="cap">${esc(G.STICKERS[k].title)}</div></div>`).join('');
    return `<div class="town-passport">
      <div class="nb-sub">Паспорт города · ${c.stamps}/12</div>
      <div class="ps-grid">${cells}</div>
      <p class="ps-line small muted">Узнала <button class="ps-facts" data-psf>фактов: ${c.facts} из ${c.factsAvail}</button> · Секретиков: ${c.secrets} из ${c.secretsTotal}</p>
      ${keep.length ? `<div class="ps-keeps">${keep.join('')}</div>` : ''}
      ${stk ? `<div class="ps-stickers">${stk}</div>` : ''}
    </div>`;
  }
  const psCycle = {};
  function bindPassport(root) {
    if (!unlocked() || !root) return;
    const t = ensure(), c = counts(), nb = c.stamps + c.secrets;
    if (t.nb !== nb) { t.nb = nb; save(); }
    root.querySelectorAll('[data-ps]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ps, p = get(id), s = status(id);
      G.haptic('light');
      if (!p || s.shut) { G.toast(SHUT_TEXT, 2200); return; }
      if (s.unvisited) { G.toast('Ещё не была здесь', 2000); return; }
      const fs = Object.keys(p.facts || {}).filter(hasFact);
      if (fs.length) { const k = (psCycle[id] = ((psCycle[id] === undefined ? -1 : psCycle[id]) + 1) % fs.length); G.toast(fill(p.facts[fs[k]].text), 4200); }
      else G.toast(p.motto || p.name || id, 2600);
      G.sparkleAt(b, { kind: 'heart', n: 5, dist: 26 });
    }));
    const fb = root.querySelector('[data-psf]');
    if (fb) fb.addEventListener('click', () => {
      const all = REG.facts.filter(hasFact).map(factOf).filter(Boolean);
      G.haptic('light');
      if (!all.length) { G.toast('Фактов пока нет. Загляни в любой дом и поболтай с жителями.', 2600); return; }
      const x = all[Math.floor(Math.random() * all.length)]; G.toast(fill(x.f.text), 4200);
    });
  }
  function exportLine() {
    if (!unlocked() || !S().town) return '';
    const c = counts();
    return `Паспорт города: ${c.stamps}/12 · фактов ${c.facts} · секретиков ${c.secrets}`;
  }
  G.nbExtras = passportHTML;
  G.nbBind = bindPassport;
  G.nbExtraCount = () => { const st = S(); if (!st.town || !unlocked()) return 0; const t = ensure(); return Math.max(0, bits.count(t.stp) + bits.count(t.s) - (t.nb || 0)); };

  /* ---------- Проверка места и комнаты (только ?debug=1): TOWNWARN ---------- */
  function validate(p, room) {
    if (!p) return;
    const warn = (...a) => townWarn(p.id + ':', ...a);
    if (!REG.places.includes(p.id)) warn('place id not in REG');
    if (p.id.length > 8) warn('place id too long');
    Object.keys(p.facts || {}).forEach(f => {
      if (!REG.facts.includes(f)) warn('fact not in REG', f);
      if (f.length > 6) warn('fact id too long', f);
      const owners = Object.keys(DEFS).filter(k => DEFS[k].facts && DEFS[k].facts[f]);
      if (owners.length > 1) warn('fact duplicated', f, owners.join(','));
    });
    (p.secrets || []).forEach(s => {
      if (!s || !REG.secrets.includes(s.id)) warn('secret not in REG', s && s.id);
      else if (s.id.length > 8) warn('secret id too long', s.id);
    });
    if (!room) return;
    const HR = 0.24, B = room.bounds || {}, bl = room.blockers || [];
    const inBl = q => bl.some(b => q.x > b.x0 - HR && q.x < b.x1 + HR && q.z > b.z0 - HR && q.z < b.z1 + HR);
    const outB = q => q.x < B.x0 - 1e-6 || q.x > B.x1 + 1e-6 || q.z < B.z0 - 1e-6 || q.z > B.z1 + 1e-6;
    const content = Object.keys(p.spots || {}), geo = (room.spots || []).map(s => s.id);
    geo.forEach(id => { if (!content.includes(id)) warn('room spot without content', id); });
    content.forEach(id => { const sp = p.spots[id]; if (!geo.includes(id) && !sp.when && !sp.cat) warn('content spot without room geometry', id); });
    [['spawn', room.spawn], ['exit', room.exit]].forEach(([n, q]) => { if (!q) return; if (inBl(q)) warn(n + ' inside an inflated blocker'); if (n === 'spawn' && outB(q)) warn(n + ' outside bounds'); });
    (room.spots || []).forEach(s => {
      if (inBl(s)) warn('spot approach inside an inflated blocker', s.id);
      if (outB(s)) warn('spot approach outside bounds', s.id);
      if (room.spawn && Math.hypot(s.x - room.spawn.x, s.z - room.spawn.z) < 0.95) warn('spot approach within 0.95 m of spawn', s.id);
    });
    if (room.spawn && room.exit && Math.hypot(room.spawn.x - room.exit.x, room.spawn.z - room.exit.z) < 1.3) warn('spawn closer than 1.3 m to exit');
    const ss = room.spots || [];
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) if (Math.hypot(ss[i].x - ss[j].x, ss[i].z - ss[j].z) < 1.0) warn('spot approaches closer than 1.0 m', ss[i].id, ss[j].id);
    if (room.look) warn('build() returned look (belongs to the registerRoom definition)');
    if (room.cam && room.cam.y !== undefined) warn('build() returned cam.y (belongs to the registerRoom definition)');
  }

  /* ---------- API ---------- */
  const Town = window.Town = {
    run, running: false, place, patch, get, list, week, day, calendar: { DAY0, WEEK_STARTS: WEEK_STARTS.slice() }, state: ensure, counts, status, sheet, overlay, REG, bits, style, visit, storySafe, walkOnce,
    passportHTML, bindPassport, exportLine, validate, v: variants, Variants, Gone, heroLook, log: name => log('await', name), mark: name => log('await', name),
    // образ сменили прямо в игре (☰ → «Образ», js/looks_picker.js): следующее место заметит обновку (реплика react.look, как
    // после зеркала ателье). Без сохранения — его делает G.setLook следом
    lookChanged() { ensure().k.lc = 1; },
  };

  /* ---------- Отладка (?debug=1, §11) ---------- */
  if (DEBUG) {
    const cur = () => (SESS && SESS.visit) || null;
    const dbg = {
      state: () => JSON.parse(JSON.stringify(ensure())),
      size: () => (G.saveSizes ? G.saveSizes() : { town: JSON.stringify(ensure()).length, main: 0 }),
      log: LOG,
      unlock() { const st = S(); st.eps = st.eps || {}; st.eps[1] = Object.assign({ cp: [], start: 1, time: 1000 }, st.eps[1] || {}, { done: true }); G.save(); return true; },
      reset() { S().town = null; ensure(); G.save(); return true; },
      week(n) { wkOv = n === undefined || n === null ? null : n; applyPatches(); return week(); },
      day(n) { dayOv = n === undefined || n === null ? null : n; return day(); },
      run: o => Town.run(o || { from: 'menu' }),
      enter(id) {
        if (!get(id)) return false;
        if (!Town.running) { Town.run({ from: 'menu', place: id }); return true; }
        sess().jump = id;
        const b = document.querySelector('#hudExit');
        if (b) b.click();
        else if (window.HUD && HUD.topBar) { const f = HUD.topBar.opts().onExit; if (f) f(); }   // HUD v2: выход с улицы — строка меню
        return true;
      },
      spot(id) {
        const V = cur();
        if (V && !V.is3d) { const b = document.querySelector(`#stage .screen:not(.out) [data-spot="${id}"]`); if (b) { b.click(); return true; } return false; }
        if (window.__c3d && window.__c3d.use) return window.__c3d.use(id);
        const b = document.querySelector(`#stage .screen:not(.out) [data-chip="${id}"]`); if (b) { b.click(); return true; }
        return false;
      },
      npc(id) { const V = cur(); if (!V) return false; runNpc(V, id); return true; },
      counts, warnings: () => WARN.slice(), visit: () => { const V = cur(); return V ? { id: V.id, is3d: V.is3d, gone: V.gone, spotIds: V.spotIds, busy: !!V.busy } : null; },
      gain: () => (lastGain ? lastGain.gain.value : null),
      validateAll: () => { Object.keys(DEFS).forEach(k => validate(DEFS[k])); return WARN.slice(); },
    };
    Town.debug = dbg;
    window.__town = dbg;
  }
})();
