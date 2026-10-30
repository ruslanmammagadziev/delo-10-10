/* =====================================================================
   СОХРАНЕНИЯ: слияние копий, счёт прогресса, кодирование, хранилища Telegram.
   Чистая часть (без DOM, проверяется в Node): score, hasProgress, merge, applyInPlace, encode, fnv1a, split, packSlot,
   readSlot, decodeCloud, gained, covers, sig, summary, scalarVals, stampScalars, compact, legacyMain. Браузерная часть:
   SaveStore.runtime({...}) — DeviceStorage и CloudStorage Telegram.
   Главное правило: копии не заменяют друг друга целиком. Прогресс (чекпоинты серий и миссий, наклейки, находки,
   штампы прогулки, флаги города) объединяется; намеренный сброс (_s.ep) и «пройти заново» (eps[n].g) — метки
   времени, слияние их не отменяет: копия, начатая раньше сброса или перезапуска серии, отбрасывается.
   Выборы игрока (имя, образ, имена команды и питомцев, версии, оценки, выборы в сюжете) — с меткой времени
   изменения в _s.t: побеждает изменённое позже, а не «своё» (старая копия на другом устройстве не откатывает образ).
   Облако: значение ключа ≤ 4096 символов, поэтому сохранение — ASCII-JSON кусками по 3800. Каждый слот описывает
   себя сам: в первом куске заголовок (число кусков, длина, хеш, seq, сессия); недописанный слот не примется
   (длина и хеш не сойдутся), а слот из одного куска пишется за один вызов — целиком или никак. Общего оглавления
   нет, поэтому запись одного устройства не может «потерять» слот, записанный другим.
   Большое сохранение (больше одного куска) идёт в быстрый слот сжатой копией: весь прогресс, одним setItem.
   Основные слоты a/b/c: пишется всегда не самый новый целый слот — последняя целая копия не трогается никогда.
   Перед записью основного слота облако перечитывается, если читали больше 3 с назад (второе устройство могло
   записать за это время). Срочная запись (чекпоинт, сворачивание) не ждёт ни чтения, ни ответа на прошлую запись:
   она сразу уходит в быстрые слоты x0..x3 (их читают все и объединяют), основной слот — следом. Несколько срочных
   изменений подряд быстрее ответа облака уходят каждое сразу: в свободный быстрый слот, а если все свои ещё пишутся —
   поверх своей же записи в пути (новое содержит всё старое). Сессия, ещё ни разу не прочитавшая облако, пишет только
   в «слепые» слоты y0..y3 — быстрые слоты x других сессий (там может быть чекпоинт, ещё не попавший в основной)
   она не трогает.
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SaveStore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------- Ключи и пределы ---------- */
  const K = {
    LS: 'delo1010_v1', LS_TOWN: 'delo1010_v1_town', LS_DEV: 'delo1010_dev', LS_BAD: 'delo1010_v1_bad', STASH: 'delo1010_stash', STASH_VIEW: 'delo1010_stash_v',
    DS: 'delo1010_v2', LEGACY: 'delo1010_v1', LEGACY_TOWN: 'delo1010_v1_town', PFX: 'd3',
  };
  const CHUNK = 3800, MAXN = 4, XN = 3;
  // быстрые слоты: x — у сессий, видевших облако; y — «слепые», для сессии, которая облако ещё ни разу не прочитала
  // (их пишут только такие сессии, а читают и объединяют все)
  const MAIN = ['a', 'b', 'c'], XS = ['x0', 'x1', 'x2', 'x3'], YS = ['y0', 'y1', 'y2', 'y3'], FAST = XS.concat(YS);
  const slotKeys = (s, n) => Array.from({ length: n }, (_, i) => `${K.PFX}${s}${i}`);
  // одно чтение облака: все куски основных и быстрых слотов и старые ключи (38 ключей из 1024)
  const CLOUD_KEYS = [].concat(...MAIN.map(s => slotKeys(s, MAXN)), ...FAST.map(s => slotKeys(s, XN)), [K.LEGACY, K.LEGACY_TOWN]);
  const T = {
    DS_READ: 1500, DS_OP: 3000, READ0: 1500, WRITE0: 4000,
    FLUSH: 150, DS_DEBOUNCE: 400, DS_MAXWAIT: 3000, CLOUD_DEBOUNCE: 2500, X_DEBOUNCE: 4000, CLOUD_MAXWAIT: 10000,
    FRESH: 3000, AWAY: 5000, VIEW_TTL: 120000, SLOW: 1000,
  };
  // чтение: два повтора сразу, потом с растущей паузой (на iOS ошибка — это тишина, ждём не дольше тайм-аута;
  // ответ на прошлое чтение, пришедший позже, всё равно засчитается, а сбоем облака тайм-аут не считается)
  const READ_RETRY = [0, 0, 1000, 3000, 10000, 30000, 60000];
  const CLOUD_RETRY = [300, 2000, 5000, 15000, 30000, 60000];
  const DS_RETRY = [2000, 5000, 15000];
  const ROOMS1 = ['cinema', 'bureau', 'sweets', 'roof'];

  /* ---------- Мелочи ---------- */
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const isSet = v => v !== undefined && v !== null && v !== '';
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const num = v => (typeof v === 'number' && isFinite(v) ? v : +v || 0);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // '' / null / 'null' / битый JSON — «значения нет»
  function parse(raw) {
    if (typeof raw !== 'string' || !raw || raw === 'null') return null;
    try { const v = JSON.parse(raw); return isObj(v) ? v : null; } catch (e) { return null; }
  }

  /* ---------- Битсеты: base32, 5 бит на символ, младший символ первым (как town.js и world/main.js) ---------- */
  const D32 = '0123456789abcdefghijklmnopqrstuv';
  const d32 = ch => (ch ? Math.max(0, D32.indexOf(ch)) : 0);
  function orBits(a, b) {
    a = typeof a === 'string' ? a : ''; b = typeof b === 'string' ? b : '';
    if (a === b || !b) return a;
    if (!a) return b;
    let out = '';
    for (let i = 0; i < Math.max(a.length, b.length); i++) out += D32[d32(a[i]) | d32(b[i])];
    return out;
  }
  function bitCount(s) { let n = 0; for (const ch of String(s || '')) { let v = d32(ch); while (v) { n += v & 1; v >>= 1; } } return n; }
  function bitList(s) { const out = []; String(s || '').split('').forEach((ch, i) => { const v = d32(ch); for (let b = 0; b < 5; b++) if (v & (1 << b)) out.push(i * 5 + b); }); return out; }

  /* ---------- Метаданные копии ---------- */
  // _s = { ep: время последнего сброса, born: начало этой линии сохранений, seq, at: время записи, dev: устройство,
  //        t: { путь выбора: секунда изменения } }
  function meta(s) {
    const m = isObj(s && s._s) ? s._s : {};
    return { ep: num(m.ep), born: num(m.born), seq: num(m.seq), at: Math.max(num(m.at), num(s && s.updated)), dev: typeof m.dev === 'string' ? m.dev : '' };
  }
  const isTown = t => isObj(t) && t.v === 2;
  const isLite = c => (isObj(c) && isObj(c._s) && c._s.lite ? 1 : 0);   // сжатая копия (см. compact)
  const uniqLen = a => (Array.isArray(a) ? new Set(a.map(x => JSON.stringify(x))).size : 0);
  const setKeys = o => (isObj(o) ? Object.keys(o).filter(k => isSet(o[k])).length : 0);
  const WFLAGS = ['hotel', 'road', 'hammer', 'guide'];

  /* ---------- Один счёт прогресса на всё ---------- */
  function score(s) {
    if (!isObj(s)) return 0;
    let n = 0;
    const eps = isObj(s.eps) ? s.eps : {};
    Object.keys(eps).forEach(k => { const e = eps[k]; if (isObj(e)) n += (e.done ? 100 : 0) + 10 * uniqLen(e.cp); });
    n += 3 * uniqLen(s.stickers) + 2 * uniqLen(s.finds) + setKeys(s.versions) + setKeys(s.ratings);
    const t = s.town;
    if (isTown(t)) n += 3 * bitCount(t.stp) + 2 * bitCount(t.s) + bitCount(t.f) + (Array.isArray(t.seen) ? t.seen.filter(x => x && x !== 0).length : 0);
    const w = s.world;
    if (isObj(w)) n += 2 * WFLAGS.filter(k => w[k]).length + bitCount(w.g) + (isObj(w.pet) && w.pet.met ? 2 : 0);
    return n;
  }
  function hasProgress(s) {
    if (!isObj(s)) return false;
    const eps = isObj(s.eps) ? s.eps : {};
    if (Object.keys(eps).some(k => isObj(eps[k]) && Array.isArray(eps[k].cp) && eps[k].cp.length > 0)) return true;
    if (Array.isArray(s.stickers) && s.stickers.length > 0) return true;
    return isTown(s.town) && bitCount(s.town.stp) > 0;
  }
  // подпись чекпоинтов: изменилась — пишем сразу, без паузы (факты прогулки — мелочь, они идут обычной записью с паузой)
  function sig(s) {
    if (!isObj(s)) return '';
    const eps = isObj(s.eps) ? s.eps : {};
    const e = Object.keys(eps).sort().map(k => (isObj(eps[k]) ? `${k}:${uniqLen(eps[k].cp)}${eps[k].done ? 'd' : ''}` : k)).join(',');
    const t = isTown(s.town) ? `${bitCount(s.town.stp)}.${bitCount(s.town.s)}` : '-';
    const w = isObj(s.world) ? WFLAGS.map(k => (s.world[k] ? 1 : 0)).join('') + '.' + bitCount(s.world.g) + (isObj(s.world.pet) && s.world.pet.met ? 'p' : '') : '-';
    return `${e}|${uniqLen(s.stickers)}|${uniqLen(s.finds)}|${t}|${w}`;
  }
  // всё, что считается прогрессом, — набором строк (для «нашлось новое» и проверки записи)
  function progressKeys(s) {
    const out = new Set();
    if (!isObj(s)) return out;
    const eps = isObj(s.eps) ? s.eps : {};
    Object.keys(eps).forEach(n => {
      const e = eps[n]; if (!isObj(e)) return;
      (Array.isArray(e.cp) ? e.cp : []).forEach(c => out.add(`cp:${n}:${c}`));
      if (e.done) out.add(`done:${n}`);
    });
    (Array.isArray(s.stickers) ? s.stickers : []).forEach(x => out.add('st:' + x));
    (Array.isArray(s.finds) ? s.finds : []).forEach(x => out.add('fd:' + x));
    if (isTown(s.town)) ['stp', 's', 'f'].forEach(k => bitList(s.town[k]).forEach(i => out.add(`t${k}:${i}`)));
    if (isObj(s.world)) {
      WFLAGS.forEach(k => { if (s.world[k]) out.add('w:' + k); });
      bitList(s.world.g).forEach(i => out.add('wg:' + i));
      if (isObj(s.world.pet) && s.world.pet.met) out.add('w:pet');
    }
    return out;
  }
  // что есть в b и нет в a
  function gained(a, b) { const A = progressKeys(a); return [...progressKeys(b)].filter(k => !A.has(k)); }

  /* ---------- Выборы игрока с меткой времени ----------
     Путь → значение: name, look (вместе с bow/coat/hair), team.<роль>, ver.<серия>, rat.<серия>, catHelper, drink,
     syrnik, bouquet, invite, car (world.car), pet.<id> (world.pet.names). Метка — секунда изменения, «гибридные часы»:
     не меньше самой поздней метки, которую копия уже видела, + 1 (смена после чтения чужой копии всегда новее неё). */
  const SC_FIXED = ['name', 'look', 'catHelper', 'drink', 'syrnik', 'bouquet', 'invite'];
  function scalarPaths(s) {
    if (!isObj(s)) return [];
    const out = SC_FIXED.filter(p => p === 'look' || has(s, p));
    const sub = (o, pre) => { if (isObj(o)) Object.keys(o).forEach(k => out.push(pre + k)); };
    sub(s.team, 'team.'); sub(s.versions, 'ver.'); sub(s.ratings, 'rat.');
    if (isObj(s.world)) {
      if (has(s.world, 'car')) out.push('car');
      if (isObj(s.world.pet)) sub(s.world.pet.names, 'pet.');
    }
    return out;
  }
  function getS(s, p) {
    if (!isObj(s)) return undefined;
    if (p === 'look') return [s.look === undefined ? null : s.look, s.bow === undefined ? null : s.bow, s.coat === undefined ? null : s.coat, s.hair === undefined ? null : s.hair];
    const dot = p.indexOf('.');
    if (dot < 0) return p === 'car' ? (isObj(s.world) ? s.world.car : undefined) : s[p];
    const pre = p.slice(0, dot), k = p.slice(dot + 1);
    const box = pre === 'team' ? s.team : pre === 'ver' ? s.versions : pre === 'rat' ? s.ratings
      : pre === 'pet' ? (isObj(s.world) && isObj(s.world.pet) ? s.world.pet.names : null) : null;
    return isObj(box) ? box[k] : undefined;
  }
  function setS(o, p, v) {
    v = clone(v);
    if (p === 'look') { ['look', 'bow', 'coat', 'hair'].forEach((k, i) => { o[k] = Array.isArray(v) ? v[i] : null; }); return; }
    const dot = p.indexOf('.');
    if (dot < 0) { if (p === 'car') { if (!isObj(o.world)) o.world = {}; o.world.car = v; } else o[p] = v; return; }
    const pre = p.slice(0, dot), k = p.slice(dot + 1);
    let box;
    if (pre === 'pet') { if (!isObj(o.world)) o.world = {}; if (!isObj(o.world.pet)) o.world.pet = {}; if (!isObj(o.world.pet.names)) o.world.pet.names = {}; box = o.world.pet.names; }
    else { const key = pre === 'team' ? 'team' : pre === 'ver' ? 'versions' : 'ratings'; if (!isObj(o[key])) o[key] = {}; box = o[key]; }
    box[k] = v;
  }
  // годится ли значение в победители (пустое имя и пустое имя в команде не побеждают никогда)
  function okS(p, v, validLook) {
    if (p === 'look') return Array.isArray(v) && validLook(v[0]);
    if (p === 'name' || p.startsWith('team.') || p.startsWith('pet.')) return typeof v === 'string' && !!v.trim();
    return isSet(v);
  }
  const stampsOf = s => (isObj(s) && isObj(s._s) && isObj(s._s.t) ? s._s.t : {});
  function scalarVals(s) {
    const out = {};
    scalarPaths(s).forEach(p => { const v = getS(s, p); out[p] = v === undefined ? 'u' : JSON.stringify(v); });
    return out;
  }
  // сравнить с прошлыми значениями и поставить метку изменённым; вернуть новые значения
  function stampScalars(s, prev, nowMs) {
    const vals = scalarVals(s);
    if (!isObj(s) || !isObj(prev)) return vals;
    const changed = Object.keys(vals).filter(p => prev[p] !== vals[p] && !(prev[p] === undefined && vals[p] === 'u'));
    if (!changed.length) return vals;
    if (!isObj(s._s)) s._s = {};
    if (!isObj(s._s.t)) s._s.t = {};
    const t = s._s.t;
    const maxT = Math.max(0, ...Object.keys(t).map(k => num(t[k])));
    const st = Math.max(Math.floor(num(nowMs || Date.now()) / 1000), maxT + 1);
    changed.forEach(p => { t[p] = st; });
    return vals;
  }

  /* ---------- Слияние ---------- */
  function unionArr(arrs) {
    const out = [], seen = new Set();
    arrs.forEach(a => { if (Array.isArray(a)) a.forEach(v => { const k = JSON.stringify(v); if (!seen.has(k)) { seen.add(k); out.push(clone(v)); } }); });
    return out;
  }
  // по ключу: первое заданное значение в порядке «новее — раньше», иначе любое
  function perKeyNewest(objs) {
    const list = objs.filter(isObj), keys = [];
    list.forEach(o => Object.keys(o).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
    const out = {};
    keys.forEach(k => {
      const src = list.find(o => isSet(o[k])) || list.find(o => has(o, k));
      out[k] = clone(src[k]);
    });
    return out;
  }
  const firstWith = (objs, k, ok) => objs.find(o => isObj(o) && ok(o[k]));

  function mergeEps(inp, ord) {
    // inp — копии в порядке аргументов (своя первой), ord — от новой к старой
    const keys = [];
    inp.forEach(c => { if (isObj(c.eps)) Object.keys(c.eps).forEach(k => { if (!keys.includes(k)) keys.push(k); }); });
    const out = {};
    keys.forEach(n => {
      const o1 = ord.map(c => c.eps && c.eps[n]).filter(isObj), i1 = inp.map(c => c.eps && c.eps[n]).filter(isObj);
      if (!o1.length) return;
      const G = Math.max(0, ...o1.map(e => num(e.g)));
      // серию перезапустили: копии серии, начатые раньше перезапуска, не участвуют
      let o2 = o1.filter(e => num(e.b) >= G);
      if (!o2.length) o2 = o1.filter(e => num(e.g) === G);
      const i2 = i1.filter(e => o2.includes(e));
      const e = Object.assign({}, clone(o2[0]));
      e.cp = unionArr(i2.map(x => x.cp));
      if (i2.some(x => x.done)) e.done = true;
      const starts = i2.map(x => num(x.start)).filter(v => v > 0);
      if (starts.length) e.start = Math.min(...starts);
      if (i2.some(x => has(x, 'time'))) e.time = Math.max(...i2.map(x => num(x.time)));
      if (i2.some(x => x.recap)) e.recap = true;
      if (G) e.g = G;
      if (i2.some(x => has(x, 'b'))) e.b = Math.min(...i2.map(x => num(x.b)));
      const cins = i2.map(x => x.cin).filter(isObj);
      if (cins.length) e.cin = Object.assign({}, clone(cins[0]), { f: unionArr(cins.map(c => c.f)), i: Math.max(...cins.map(c => num(c.i))) });
      const burs = i2.map(x => x.bur).filter(isObj);
      if (burs.length) e.bur = Object.assign({}, clone(burs[0]), { fixed: unionArr(burs.map(b => b.fixed)) });
      out[n] = e;
    });
    return out;
  }

  function mergeWorld(ord, local, prefsLocal) {
    const ws = ord.map(c => c.world).filter(isObj);
    if (!ws.length) return undefined;
    const out = clone(ws[0]);
    WFLAGS.forEach(k => { const w = ws.find(x => x[k]); if (w) out[k] = w[k]; });
    const g = ws.reduce((acc, w) => orBits(acc, w.g), '');
    if (g || has(out, 'g')) out.g = g || out.g;
    const car = ws.find(w => isSet(w.car)); if (car) out.car = car.car;
    if (prefsLocal && isObj(local)) ['tier', 'why', 'q'].forEach(k => { if (has(local, k)) out[k] = clone(local[k]); });
    const pets = ws.map(w => w.pet).filter(isObj);
    if (pets.length) {
      const p = clone(pets[0]);
      const met = pets.find(x => x.met); if (met) p.met = met.met;
      if (pets.some(x => has(x, 'walks'))) p.walks = Math.max(...pets.map(x => num(x.walks)));
      p.names = perKeyNewest(pets.map(x => x.names));
      const id = pets.find(x => isSet(x.id)); if (id) p.id = id.id;
      out.pet = p;
    }
    return out;
  }

  function mergeTown(ord, localTown) {
    const ts = ord.map(c => c.town).filter(isTown);
    if (!ts.length) { const any = ord.find(c => has(c, 'town')); return any ? clone(any.town) : undefined; }
    const out = clone(ts[0]);
    ['stp', 'f', 's'].forEach(k => { out[k] = ts.reduce((acc, t) => orBits(acc, t[k]), typeof out[k] === 'string' ? out[k] : ''); });
    const L = k => Math.max(...ts.map(t => (Array.isArray(t[k]) ? t[k].length : 0)));
    if (ts.some(t => Array.isArray(t.seen))) {
      out.seen = Array.from({ length: L('seen') }, (_, i) => { const t = ts.find(x => Array.isArray(x.seen) && x.seen[i] && x.seen[i] !== 0); return t ? clone(t.seen[i]) : 0; });
    }
    // u[i] — битовая маска использованных точек места: объединяем по OR
    if (ts.some(t => Array.isArray(t.u))) out.u = Array.from({ length: L('u') }, (_, i) => ts.reduce((acc, t) => acc | (Array.isArray(t.u) ? num(t.u[i]) : 0), 0));
    ['w', 'r'].forEach(k => {
      const ss = ts.map(t => (typeof t[k] === 'string' ? t[k] : '')).filter(Boolean);
      if (!ss.length) return;
      const n = Math.max(...ss.map(s => s.length));
      let r = '';
      for (let i = 0; i < n; i++) r += ss.map(s => s[i] || '-').reduce((a, b) => (b > a ? b : a), '-');   // «-» меньше цифр и букв
      out[k] = r;
    });
    const ph = ts.find(t => isSet(t.ph)); if (ph) out.ph = ph.ph;
    ['ch', 'g', 'nb'].forEach(k => { if (ts.some(t => has(t, k))) out[k] = Math.max(...ts.map(t => num(t[k]))); });
    if (ts.some(t => t.hi)) out.hi = 1;
    const k0 = isObj(out.k) ? out.k : {};
    ts.slice(1).forEach(t => {
      if (!isObj(t.k)) return;
      ['cb', 'curl', 'bud', 'wp', 'op'].forEach(x => { if (t.k[x] && !k0[x]) k0[x] = clone(t.k[x]); });
    });
    const rb = ts.reduce((acc, t) => acc | (isObj(t.k) ? num(t.k.rb) : 0), 0);
    if (rb) k0.rb = rb;
    out.k = k0;
    // в руке — только на эту прогулку: своё, в облако не уходит
    if (isObj(localTown) && has(localTown, 'h')) out.h = clone(localTown.h); else if (has(out, 'h')) out.h = null;
    return out;
  }

  const PREFS = ['sound', 'voices', 'narr', 'force2d'];
  const FLAGS = ['waved', 'introDone', 'walkedOnce', 'walked3d', 'catSweater', 'metBee'];
  const CHOICE = ['catHelper', 'drink', 'syrnik', 'bouquet'];
  const HANDLED = new Set(['v', '_s', 'updated', 'eps', 'stickers', 'finds', 'versions', 'ratings', 'riddles', 'team', 'invite', 'hudSeen',
    'engHint', 'name', 'look', 'bow', 'coat', 'hair', 'world', 'town', 'runner'].concat(PREFS, FLAGS, CHOICE));
  // раннер «Бег» (state.runner { best, bestDist, coins, runs, tut, last, bestLevel, finds }): рекорды и счётчики — максимум по копиям (сыграли
  // позже на втором устройстве — рекорд первого не пропадает), подсказки пройдены — если хоть где-то, last — из самой новой
  // копии. Ключ «знакомый» — и в сжатую облачную копию попадает (≈ 80 символов)
  function mergeRunner(ord) {
    const rs = ord.map(c => c.runner).filter(isObj);
    if (!rs.length) return undefined;
    const nn = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0), mx = k => Math.max(...rs.map(r => nn(r[k])));
    // bestLevel (уровни раннера) — тоже максимум; в старых копиях его нет — 1
    return { best: mx('best'), bestDist: mx('bestDist'), coins: mx('coins'), runs: mx('runs'), tut: rs.some(r => r.tut === true), last: nn(rs[0].last), bestLevel: Math.max(1, mx('bestLevel')),
      finds: rs.reduce((m, r) => (m | nn(r.finds)) >>> 0, 0) };   // находки и секреты раннера (биты) — «или» по копиям: найденное на любом устройстве не теряется
  }

  /* merge(copies, opts) — copies[0] — своя (живое состояние этого устройства), дальше — чужие копии.
     opts.dev — id этого устройства; opts.scalars === 'local' — без меток времени выборы (имя, образ, настройки) остаются
     своими; с метками побеждает изменённое позже (своё — только при равной метке); opts.validLook(id) — образ годится.
     Результат — новый объект (входы не меняются). */
  function merge(copies, opts) {
    opts = opts || {};
    const validLook = typeof opts.validLook === 'function' ? opts.validLook : (x => typeof x === 'string' && !!x);
    const list = (Array.isArray(copies) ? copies : []).map((c, i) => (isObj(c) ? { c: clone(c), i } : null)).filter(Boolean);
    if (!list.length) return null;
    list.forEach(x => { x.m = meta(x.c); x.sc = score(x.c); });
    const EP = Math.max(...list.map(x => x.m.ep));
    // был сброс: копии, начатые до него, не участвуют
    let kept = list.filter(x => x.m.born >= EP);
    if (!kept.length) kept = list.filter(x => x.m.ep === EP);
    const local = list[0].i === 0 ? list[0] : null;
    const localKept = local && kept.includes(local) ? local : null;
    // сжатые копии (_s.lite) — после целых: их урезанные выборы не перебивают целые
    const byNew = kept.slice().sort((a, b) => (isLite(a.c) - isLite(b.c)) || (b.m.at - a.m.at) || (b.m.seq - a.m.seq) || (b.sc - a.sc) || (a.i - b.i));
    const newest = opts.scalars === 'local' && localKept ? localKept : byNew[0];
    const ord = [newest].concat(byNew.filter(x => x !== newest)).map(x => x.c);
    const inp = kept.map(x => x.c);
    const N = newest.c;
    const out = {};
    // прочие ключи (новые в будущих версиях): из самой новой копии, иначе из первой, где есть
    ord.forEach(c => Object.keys(c).forEach(k => { if (!HANDLED.has(k) && !has(out, k)) out[k] = clone(c[k]); }));
    out.v = Math.max(...inp.map(c => num(c.v))) || N.v;
    out.updated = Math.max(...inp.map(c => num(c.updated)));
    out._s = {
      ep: EP, born: Math.min(...kept.map(x => x.m.born)), seq: Math.max(...kept.map(x => x.m.seq)),
      at: Math.max(...kept.map(x => x.m.at)), dev: opts.dev !== undefined ? opts.dev : newest.m.dev,
    };
    out.eps = mergeEps(inp, ord);
    out.stickers = unionArr(inp.map(c => c.stickers));
    out.finds = unionArr(inp.map(c => c.finds));
    ['versions', 'ratings', 'riddles'].forEach(k => { if (ord.some(c => has(c, k))) out[k] = perKeyNewest(ord.map(c => c[k])); });
    if (ord.some(c => isObj(c.team))) out.team = perKeyNewest(ord.map(c => c.team));
    if (ord.some(c => has(c, 'invite'))) { const inv = ord.find(c => isSet(c.invite)); out.invite = inv ? clone(inv.invite) : clone(N.invite === undefined ? null : N.invite); }
    if (ord.some(c => isObj(c.hudSeen))) {
      const hs = {};
      ord.forEach(c => { if (isObj(c.hudSeen)) Object.keys(c.hudSeen).forEach(k => { hs[k] = Math.max(num(hs[k]), num(c.hudSeen[k])); }); });
      out.hudSeen = hs;
    }
    FLAGS.forEach(k => { const c = ord.find(x => x[k]); if (c) out[k] = clone(c[k]); else { const a = ord.find(x => has(x, k)); if (a) out[k] = clone(a[k]); } });
    if (ord.some(c => has(c, 'engHint'))) out.engHint = Math.max(...ord.map(c => num(c.engHint)));
    // имя: последнее заданное; пустое имя никогда не побеждает
    { const c = ord.find(x => typeof x.name === 'string' && x.name.trim()); if (c) out.name = c.name; else if (has(N, 'name')) out.name = N.name; }
    // образ и его старые цвета — из одной копии
    {
      const L = firstWith(ord, 'look', validLook) || N;
      ['look', 'bow', 'coat', 'hair'].forEach(k => { if (has(L, k)) out[k] = clone(L[k]); else { const a = ord.find(x => has(x, k)); if (a) out[k] = clone(a[k]); } });
    }
    CHOICE.forEach(k => { const c = ord.find(x => x[k] !== undefined && x[k] !== null); if (c) out[k] = clone(c[k]); else if (ord.some(x => has(x, k))) out[k] = null; });
    // настройки устройства: свои, если это устройство уже сохранялось, иначе — из самой новой копии
    const L0 = list[0].c, prefsLocal = !!(list[0].i === 0 && opts.dev !== undefined && meta(L0).dev === opts.dev && num(L0.updated) > 0) || opts.scalars === 'local';
    PREFS.forEach(k => {
      const src = prefsLocal && has(L0, k) ? L0 : (has(N, k) ? N : ord.find(x => has(x, k)));
      if (src) out[k] = clone(src[k]);
    });
    const w = mergeWorld(ord, L0.world, prefsLocal);
    if (w !== undefined) out.world = w;
    const t = mergeTown(ord, L0.town);
    if (t !== undefined) out.town = t;
    const rn = mergeRunner(ord);
    if (rn !== undefined) out.runner = rn;
    // выборы с метками: побеждает самая поздняя метка с годным значением (при равных — порядок выше: новее / своё)
    const paths = [];
    ord.forEach(c => Object.keys(stampsOf(c)).forEach(p => { if (!paths.includes(p)) paths.push(p); }));
    if (paths.length) {
      const TT = {};
      paths.forEach(p => {
        const ranked = ord.map((c, i) => ({ c, i, t: num(stampsOf(c)[p]) })).filter(x => x.t > 0).sort((a, b) => (b.t - a.t) || (a.i - b.i));
        if (!ranked.length) return;
        TT[p] = ranked[0].t;
        const win = ranked.find(x => okS(p, getS(x.c, p), validLook));
        if (win) setS(out, p, getS(win.c, p));
      });
      if (Object.keys(TT).length) out._s.t = TT;
    }
    return out;
  }

  // перенести src в target, сохранив объекты target (state, eps[n], cp, town, world, stickers — те же ссылки)
  function applyInPlace(target, src) {
    if (!isObj(target) || !isObj(src)) return target;
    Object.keys(target).forEach(k => { if (!has(src, k)) delete target[k]; });
    Object.keys(src).forEach(k => {
      const a = target[k], b = src[k];
      if (isObj(a) && isObj(b)) applyInPlace(a, b);
      else if (Array.isArray(a) && Array.isArray(b)) a.splice(0, a.length, ...clone(b));
      else target[k] = clone(b);
    });
    return target;
  }

  /* ---------- Кодирование ---------- */
  // только ASCII: всё выше 0x7e — \uXXXX (в облаке неясно, символы это или байты)
  const encode = x => JSON.stringify(x).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function split(payload, size) { size = size || CHUNK; const out = []; for (let i = 0; i < payload.length; i += size) out.push(payload.slice(i, i + size)); return out.length ? out : ['']; }
  /* Слот, описывающий сам себя: куски d3<слот>0..n-1; в первом — заголовок JSON и перевод строки (encode() перевода
     строки не даёт, первый \n всегда конец заголовка). Заголовок: v:3, n, len, h (fnv1a всего), seq, at, sid, ep, sc. */
  function packSlot(slot, payload, hdr) {
    const parts = split(payload, CHUNK);
    const h = Object.assign({ v: 3, n: parts.length, len: payload.length, h: fnv1a(payload) }, hdr || {});
    return { hdr: h, pairs: parts.map((p, i) => [`${K.PFX}${slot}${i}`, i === 0 ? JSON.stringify(h) + '\n' + p : p]) };
  }
  // { st: 'none' | 'bad' | 'ok', hdr, copy }
  function readSlot(items, slot, maxn) {
    if (!isObj(items)) return { st: 'none' };
    const c0 = items[`${K.PFX}${slot}0`];
    if (typeof c0 !== 'string' || !c0) return { st: 'none' };
    const nl = c0.indexOf('\n');
    const hdr = nl > 0 ? parse(c0.slice(0, nl)) : null;
    if (!hdr || hdr.v !== 3) return { st: 'bad' };
    const n = num(hdr.n);
    if (!(n >= 1 && n <= (maxn || MAXN))) return { st: 'bad', hdr };
    let s = c0.slice(nl + 1);
    for (let i = 1; i < n; i++) { const v = items[`${K.PFX}${slot}${i}`]; if (typeof v !== 'string' || !v) return { st: 'bad', hdr }; s += v; }
    if (s.length !== num(hdr.len) || fnv1a(s) !== hdr.h) return { st: 'bad', hdr };
    const copy = parse(s);
    return copy ? { st: 'ok', hdr, copy } : { st: 'bad', hdr };
  }
  // копия для хранилищ вне localStorage: целиком, с прогулкой, но без того, что в руке
  function forRemote(s) { const c = clone(s); if (isObj(c) && isObj(c.town)) delete c.town.h; return c; }
  // хеш содержимого без времени записи и счётчиков (одинаковое не пишем второй раз); порядок ключей и наборов не важен
  function canon(x) {
    if (Array.isArray(x)) { const a = x.map(canon); return '[' + (x.every(v => typeof v === 'string') ? a.slice().sort() : a).join(',') + ']'; }
    if (isObj(x)) return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  function contentHash(s) {
    if (!isObj(s)) return '';
    const c = Object.assign({}, s, { updated: 0 });
    c._s = Object.assign({}, isObj(s._s) ? s._s : {}, { at: 0, seq: 0, dev: '' });
    if (isObj(c.town)) { c.town = Object.assign({}, c.town); delete c.town.h; }
    return fnv1a(canon(c));
  }
  const hdrNewer = (a, b) => (num(b.seq) - num(a.seq)) || (num(b.at) - num(a.at)) || String(b.sid || '').localeCompare(String(a.sid || ''));
  // ответ getItems → одна копия (основные и быстрые слоты, старые ключи) + что в каждом слоте
  function decodeCloud(items, opts) {
    const info = {}, slots = {}, mainOk = [], xOk = [];
    MAIN.forEach(s => { const r = readSlot(items, s, MAXN); slots[s] = r; info[s] = r.st; if (r.st === 'ok') mainOk.push(r); });
    FAST.forEach(s => { const r = readSlot(items, s, XN); slots[s] = r; info[s] = r.st; if (r.st === 'ok') xOk.push(r); });
    mainOk.sort((a, b) => hdrNewer(a.hdr, b.hdr));
    xOk.sort((a, b) => num(b.hdr.at) - num(a.hdr.at));
    const lm = isObj(items) ? parse(items[K.LEGACY]) : null, lt = isObj(items) ? parse(items[K.LEGACY_TOWN]) : null;
    let legacy = null;
    info.legacy = 'none';
    if (lm || lt) { legacy = lm || {}; if (lt) legacy.town = lt; info.legacy = 'ok'; }
    const mo = Object.assign({}, opts || {}, { dev: undefined });
    const one = list => (!list.length ? null : list.length === 1 ? list[0] : merge(list, mo));
    const mainList = mainOk.map(r => r.copy);
    // сначала самый новый основной слот (его выборы — основа), потом быстрые слоты (x и слепые y) и старые ключи
    const all = mainList.concat(xOk.map(r => r.copy), legacy ? [legacy] : []);
    return { copy: one(all), mainCopy: one(mainList), slots, info, newest: mainOk.length ? mainOk[0].hdr : null };
  }
  // a уже содержит всё из b (кроме того, что в a отменено сбросом или перезапуском серии)
  function covers(a, b) { if (!isObj(b)) return true; return gained(a, merge([a, b], { scalars: 'local' })).length === 0; }
  function summary(s) {
    const e = isObj(s) && isObj(s.eps) ? s.eps[1] : null;
    if (e && e.done) return 'серия 1 пройдена';
    const n = e && Array.isArray(e.cp) ? ROOMS1.filter(r => e.cp.includes(r)).length : 0;
    if (n) return `серия 1, раскрыто дел: ${n} из ${ROOMS1.length}`;
    if (e && Array.isArray(e.cp) && e.cp.length) return 'серия 1 начата';
    return 'наклейки и находки';
  }
  /* Сжатая копия меньше 3800 символов (один кусок облака): сначала незнакомые ключи, потом длинные тексты (версии,
     имена питомцев), метки выборов, служебное; прогресс (чекпоинты, наклейки, находки, город) остаётся всегда.
     Ужатая копия помечена _s.lite: при слиянии её выборы — последние по старшинству (урезанный текст не побеждает
     целый), а метки времени у неё остаются только у неурезанных выборов. null — не влезает даже так. */
  function compact(snap, keepTown) {
    if (!isObj(snap)) return null;
    const m = clone(snap); if (!keepTown) delete m.town;
    const fits = () => encode(m).length < CHUNK;
    const steps = [
      () => Object.keys(m).forEach(k => { if (!HANDLED.has(k)) delete m[k]; }),
      () => { if (isObj(m.versions)) Object.keys(m.versions).forEach(k => { if (typeof m.versions[k] === 'string' && m.versions[k].length > 40) m.versions[k] = m.versions[k].slice(0, 40); }); },
      () => { if (isObj(m.world) && isObj(m.world.pet)) m.world.pet.names = {}; },
      () => { if (isObj(m._s)) delete m._s.t; },
      () => { delete m.hudSeen; delete m.riddles; if (isObj(m.eps)) Object.keys(m.eps).forEach(n => { if (isObj(m.eps[n])) { delete m.eps[n].cin; delete m.eps[n].bur; } }); },
      () => { if (isObj(m.versions)) Object.keys(m.versions).forEach(k => { m.versions[k] = '…'; }); if (isObj(m.drink)) m.drink = { base: m.drink.base || null }; },
      () => { if (isObj(m.bouquet) && Array.isArray(m.bouquet.f)) m.bouquet.f = m.bouquet.f.slice(0, 3); delete m.invite; },
    ];
    for (let i = 0; !fits() && i < steps.length; i++) {
      if (!i) { if (!isObj(m._s)) m._s = {}; m._s.lite = 1; }
      steps[i]();
    }
    if (!fits()) return null;
    if (isObj(m._s) && m._s.lite && isObj(m._s.t)) {
      const a = scalarVals(snap), b = scalarVals(m);
      Object.keys(m._s.t).forEach(p => { if (a[p] !== b[p]) delete m._s.t[p]; });
    }
    return m;
  }
  // старый ключ delo1010_v1 (его читают старые сборки и откат): сжатая копия без прогулки
  function legacyMain(snap) { const m = compact(snap, false); return m ? encode(m) : null; }

  /* =====================================================================
     Браузер: хранилища Telegram.
     cfg = { TG, useDS, useCloud, dev, sid, view0, snapshot: () => живое состояние, onCopy(src, copy) — пришла копия,
             validLook, log }
     ===================================================================== */
  function runtime(cfg) {
    const TG = cfg.TG, log = typeof cfg.log === 'function' ? cfg.log : function () {};
    const DSo = () => TG.DeviceStorage, CSo = () => TG.CloudStorage;
    let useDS = !!cfg.useDS, useCloud = !!cfg.useCloud;
    const SID = typeof cfg.sid === 'string' && /^[a-z0-9]{8}$/.test(cfg.sid) ? cfg.sid : (Math.random().toString(36).slice(2, 10) + '00000000').slice(0, 8);
    const S = { ds: useDS ? 'reading' : 'off', cloud: useCloud ? 'reading' : 'off', dsAt: 0, cloudAt: 0, xAt: 0, err: '', slots: null, size: 0, writes: 0, reads: 0, rtt: 0 };
    let active = false, dsKnown = false, lastDS = '', dsReadTry = 0;
    const mopts = () => ({ dev: cfg.dev, validLook: cfg.validLook });
    const unsupported = e => /unsupported/i.test(String(e || ''));
    const hidden = () => typeof document !== 'undefined' && !!document.hidden;
    const now = () => Date.now();

    // вызов Telegram: всегда с тайм-аутом (на iOS при ошибке ответа нет вовсе); поздний ответ — в onLate
    function call(fn, ms, onLate) {
      return new Promise(res => {
        let done = false;
        const t0 = now();
        const t = setTimeout(() => { if (!done) { done = true; res({ err: 'TIMEOUT', ms: now() - t0 }); } }, ms);
        try {
          fn((err, val) => {
            if (done) { if (onLate) { try { onLate(err, val, now() - t0); } catch (e) { log('late', e); } } return; }
            done = true; clearTimeout(t); res({ err: err || null, val, ms: now() - t0 });
          });
        } catch (e) { if (!done) { done = true; clearTimeout(t); res({ err: 'THROW ' + ((e && e.message) || e), ms: 0 }); } }
      });
    }
    // время ответа облака (скользящее): по нему — тайм-ауты чтения и записи
    let rtt = 0;
    const seen = ms => { if (!(ms > 0)) return; rtt = rtt ? Math.round(rtt * 0.7 + ms * 0.3) : ms; S.rtt = rtt; };
    // (на iOS ошибка — тишина: ждём 2,5–3 времени ответа, но и не меньше медленного облака, иначе удачное — «ошибка»)
    // Первое чтение — 1,5 с: медленное облако ответит позже (ответ засчитается, параллельно уже идёт повтор),
    // а молча потерянное чтение (iOS) повторится быстро — у запуска всего 6 с.
    const readTO = () => (rtt ? clamp(rtt * 2.5, 1200, 15000) : T.READ0);
    const writeTO = () => (rtt ? clamp(rtt * 3, 800, 15000) : T.WRITE0);
    const failed = r => !!(r.err || r.val === false);
    /* Облако сбоит: за 2 мин была явная ошибка или запрос, так и оставшийся без ответа (iOS: ошибка — тишина).
       Тайм-аут, на который ответ потом пришёл, — не сбой, облако просто медленное: раньше первое же медленное чтение
       при запуске включало «сбоит» на 2 мин, и каждое срочное изменение занимало два быстрых слота сразу.
       В режиме «сбоит» срочное уходит и вторым экземпляром — в другой слот. Так же — на медленном облаке (ответ
       дольше 1 с): молча потерянную запись там видно только через 3 ответа, а закрыть приложение успевают раньше. */
    let lastFailAt = 0, suspect = 0;
    const noteFail = () => { lastFailAt = now(); };
    const flaky = () => lastFailAt > 0 && now() - lastFailAt < 120000;
    // вторым экземпляром: облако сбоит, есть запрос без ответа дольше тайм-аута (может, уже потерян) или облако медленное
    const twice = () => flaky() || suspect > 0 || rtt >= T.SLOW;
    // вызов облака: как call, но с учётом сбоев (явная ошибка — сразу; тайм-аут — если ответа так и не было)
    function ccall(fn, ms, onLate) {
      let answered = false, gT = 0, sus = false;
      const unsus = () => { if (sus) { sus = false; suspect--; } };
      return call(fn, ms, (err, val, t) => {
        answered = true; clearTimeout(gT); unsus();
        if ((err || val === false) && !unsupported(err)) noteFail();
        if (onLate) onLate(err, val, t);
      }).then(r => {
        if (r.err === 'TIMEOUT') {
          sus = true; suspect++;
          gT = setTimeout(() => { unsus(); if (!answered) noteFail(); }, Math.max(2000, rtt * 2));
        } else if (failed(r) && !unsupported(r.err)) noteFail();
        return r;
      });
    }

    /* ---------- что мы знаем об облаке ----------
       view[слот] = { st: none|bad|ok|unk (запись не подтвердилась)|pend (пишется), hdr, t: когда узнали, cov: быстрый слот уже
       в основном }. synced — облако хоть раз прочитано; readAt — когда пришёл последний ответ чтения. */
    const ALL = MAIN.concat(FAST);
    const view = {};
    ALL.forEach(s => { view[s] = { st: 'none', hdr: null, t: 0 }; });
    let synced = false, viewKnown = false, readAt = 0, remoteKnown = null, mainHash = '', tooBig = false;
    let ownX = [];   // быстрые слоты x, которые пишет эта сессия и чьё содержимое ещё не в основном
    // перезагрузка «Продолжить с сохранения»: что знали о слотах до неё (выбор быстрого слота — не вслепую)
    if (isObj(cfg.view0) && now() - num(cfg.view0.at) < T.VIEW_TTL && isObj(cfg.view0.slots)) {
      ALL.forEach(s => { const v = cfg.view0.slots[s]; if (isObj(v) && ['none', 'bad', 'ok', 'unk'].includes(v.st)) view[s] = { st: v.st, hdr: isObj(v.hdr) ? v.hdr : null, t: num(cfg.view0.at), cov: !!v.cov }; });
      viewKnown = true;
    }

    /* ---------- DeviceStorage ---------- */
    function gotDS(val) {
      dsKnown = true; S.ds = 'ok'; S.dsAt = now();
      const c = parse(val);
      if (c) { lastDS = contentHash(forRemote(c)); cfg.onCopy('ds', c); }
      if (active) schedule({});
    }
    function readDS() {
      if (!useDS) return Promise.resolve();
      return call(cb => DSo().getItem(K.DS, cb), T.DS_READ, (err, val) => { if (!err && !dsKnown) gotDS(val); }).then(r => {
        if (dsKnown) return;
        if (!r.err) { gotDS(r.val); return; }
        if (unsupported(r.err)) { useDS = false; S.ds = 'unsupported'; log('ds unsupported'); return; }
        S.ds = r.err === 'TIMEOUT' ? 'slow' : 'error'; S.err = 'ds ' + r.err; log('ds read', r.err);
        if (dsReadTry++ < 3) setTimeout(() => { if (!dsKnown && useDS) readDS(); }, [3000, 10000, 30000][dsReadTry - 1]);
      });
    }
    const liveSnap = () => forRemote(cfg.snapshot());
    async function dsWrite(force) {
      if (!useDS || (!dsKnown && !force)) return true;
      const snap = liveSnap(), h = contentHash(snap);
      if (!force && h === lastDS) return true;
      const r = await call(cb => DSo().setItem(K.DS, encode(snap), cb), T.DS_OP);
      if (failed(r)) {
        if (unsupported(r.err)) { useDS = false; S.ds = 'unsupported'; return true; }
        S.ds = 'error'; S.err = 'ds ' + (r.err || 'false'); log('ds write', S.err); return false;
      }
      lastDS = h; S.ds = 'ok'; S.dsAt = now(); return true;
    }

    /* ---------- чтение облака (своя очередь: записи его не ждут) ---------- */
    let readBusy = false, readFails = 0, hardFails = 0, readNextAt = 0, readTimer = 0, readPending = false, lastApplied = 0;
    let bootRes = null;
    const bootDone = () => { if (bootRes) { const r = bootRes; bootRes = null; r(); } };
    function applyRead(items, sentAt) {
      if (sentAt < lastApplied) return;   // старое чтение ответило поздно — у нас уже свежее
      lastApplied = sentAt;
      const d = decodeCloud(items, mopts());
      ALL.forEach(s => {
        const v = view[s], r = d.slots[s];
        if (v.st === 'pend') return;   // пишем туда сейчас
        // наша запись в этот слот могла быть позже, чем облако ответило на чтение
        if (v.sent && v.sent >= sentAt - 1000) {
          if (r.st === 'ok' && v.hdr && r.hdr.sid === v.hdr.sid && r.hdr.h === v.hdr.h) view[s] = Object.assign({}, v, { st: 'ok', t: now() });
          return;
        }
        view[s] = { st: r.st, hdr: r.hdr || null, t: now(), cov: FAST.includes(s) && r.st === 'ok' ? covers(d.mainCopy, r.copy) : false };
      });
      // свои быстрые слоты, чьё содержимое уже в основном, — больше не «свои»: их может взять любая сессия
      ownX = ownX.filter(s => !(view[s].st === 'ok' && view[s].cov));
      remoteKnown = d.copy;
      mainHash = d.mainCopy ? contentHash(forRemote(d.mainCopy)) : '';
      synced = true; viewKnown = true; readAt = now(); readFails = 0; hardFails = 0; readNextAt = 0;
      S.cloud = tooBig ? 'too-big' : 'synced'; S.cloudAt = now(); S.slots = d.info;
      log('cloud read', JSON.stringify(d.info));
      if (d.copy) cfg.onCopy('cloud', d.copy);
      bootDone(); kick();
    }
    function readOnce() {
      readBusy = true; S.reads++;
      const sentAt = now();
      if (!synced) S.cloud = 'reading';
      ccall(cb => CSo().getItems(CLOUD_KEYS, cb), readTO(), (err, val, ms) => { if (!err && isObj(val)) { seen(ms); applyRead(val, sentAt); } }).then(r => {
        readBusy = false;
        if (!r.err && isObj(r.val)) { seen(r.ms); applyRead(r.val, sentAt); return; }
        if (unsupported(r.err)) { useCloud = false; S.cloud = 'off'; log('cloud unsupported'); bootDone(); return; }
        // тайм-аут, а свежий ответ уже есть (пришёл ответ на это или более позднее чтение) — не ошибка
        if (r.err === 'TIMEOUT' && synced && readAt >= sentAt) { kick(); return; }
        // ошибка чтения — это не «облако пустое»: основные слоты без чтения не пишем, пробуем ещё
        // (сбоем облака тайм-аут станет, только если ответа так и не будет — см. ccall)
        readFails++;
        S.err = 'cloud ' + (r.err || 'bad reply'); log('cloud read', S.err);
        if (!synced) S.cloud = 'unsynced';
        readNextAt = now() + READ_RETRY[Math.min(readFails - 1, READ_RETRY.length - 1)];
        // три явных ошибки подряд — запуск дальше не ждёт; тишину (тайм-аут) ограничивает предел самого запуска
        if (r.err !== 'TIMEOUT') { hardFails++; if (hardFails >= 3) bootDone(); }
        if (!synced) requestRead();
        kick();
      });
    }
    function requestRead(force) {
      if (!useCloud || readBusy) return;
      const w = readNextAt - now();
      if (w > 0) { if (!readTimer) readTimer = setTimeout(() => { readTimer = 0; requestRead(); }, w); return; }
      if (hidden() && !force) { readPending = true; return; }
      readOnce();
    }
    const readCloud = () => (useCloud ? new Promise(res => { bootRes = res; requestRead(true); }) : Promise.resolve());

    /* ---------- запись облака ---------- */
    // одна пачка setItem параллельно: [[ключ, значение], …]; ok — подтверждены все нужные; extraOk — и старые ключи
    // (поздний ответ на запись тоже учит время ответа облака: следующие тайм-ауты будут по нему)
    const set = (k, v) => { S.writes++; return ccall(cb => CSo().setItem(k, v, cb), writeTO(), (err, val, ms) => { if (!err) seen(ms); }); };
    async function writeBatch(pairs, extra) {
      extra = extra || [];
      const rs = await Promise.all(pairs.concat(extra).map(([k, v]) => set(k, v)));
      rs.forEach(r => { if (!r.err) seen(r.ms); });
      const bad = rs.slice(0, pairs.length).find(failed);
      if (bad) { S.err = 'cloud ' + (bad.err || 'false'); log('cloud write', S.err); return { ok: false }; }
      return { ok: true, extraOk: !rs.slice(pairs.length).some(failed) };
    }
    // в основной слот — живое состояние, объединённое с последней прочитанной копией облака
    const mainSnap = () => forRemote(remoteKnown ? merge([cfg.snapshot(), remoteKnown], Object.assign(mopts(), { scalars: 'local' })) : cfg.snapshot());
    // куда писать основной: не в самый новый целый слот (последняя целая копия не трогается) и не туда, куда пишем;
    // лучше всего — в пустой или битый, потом — в старый целый, в последнюю очередь — в неподтверждённый
    function pickMain() {
      const ok = MAIN.filter(s => view[s].st === 'ok' && view[s].hdr).sort((a, b) => hdrNewer(view[a].hdr, view[b].hdr));
      const newest = ok[0];
      const rank = s => (['none', 'bad'].includes(view[s].st) ? 0 : view[s].st === 'ok' ? 1 : 2);
      const age = s => (view[s].hdr ? num(view[s].hdr.at) : num(view[s].sent));
      return MAIN.filter(s => s !== newest && view[s].st !== 'pend').sort((a, b) => (rank(a) - rank(b)) || (age(a) - age(b)))[0] || null;
    }
    const maxSeq = () => Math.max(0, ...MAIN.map(s => (view[s].hdr ? num(view[s].hdr.seq) : 0)));
    // старые ключи (для старых сборок и отката): при изменении чекпоинтов и первой записи сессии
    let lastLegacy = null;
    function legacyPairs(snap) {
      const sg = sig(snap) + '|' + num(snap._s && snap._s.ep);
      if (sg === lastLegacy) return { pairs: [], sg };
      const raw = legacyMain(snap), rawT = isObj(snap.town) ? encode(snap.town) : '';
      if (!raw) log('legacy skip (too big)');
      const pairs = (raw ? [[K.LEGACY, raw]] : []).concat(rawT && rawT.length < CHUNK ? [[K.LEGACY_TOWN, rawT]] : []);
      return { pairs, sg };
    }
    // срочность: uq растёт с каждым чекпоинтом / сворачиванием; закрыта, когда запись с ним подтвердилась или в пути
    let uq = 0, uqAck = 0, ackLive = '';
    // в пути: счётчики (одно и то же может лететь дважды — в два быстрых слота)
    const bag = () => { const m = new Map(); return { add: k => m.set(k, (m.get(k) || 0) + 1), del: k => { const n = (m.get(k) || 0) - 1; if (n > 0) m.set(k, n); else m.delete(k); }, has: k => m.has(k), keys: () => [...m.keys()] }; };
    const fly = bag();
    const covered = () => Math.max(uqAck, ...fly.keys());
    let mainBusy = false, mainAgain = false, mainFails = 0, mainTimer = 0;
    async function writeMain() {
      const slot = pickMain();
      if (!slot) return;
      const snap = mainSnap(), h = contentHash(snap), live = contentHash(liveSnap()), myUq = uq;
      if (h === mainHash) { if (myUq > uqAck && live === ackLive) uqAck = myUq; return; }
      if (remoteKnown && !covers(snap, remoteKnown)) {
        console.error('[save] guard: запись потеряла бы прогресс облака', gained(snap, remoteKnown).slice(0, 8));
        readAt = 0; requestRead(); return;
      }
      snap._s.seq = Math.max(num(snap._s.seq), maxSeq()) + 1;
      const payload = encode(snap);
      S.size = payload.length;
      if (payload.length > CHUNK * MAXN) {
        if (!tooBig) console.error('[save] сохранение не помещается в облако Telegram:', payload.length);
        tooBig = true; S.cloud = 'too-big'; return;
      }
      const p = packSlot(slot, payload, { seq: snap._s.seq, at: now(), sid: SID, ep: num(snap._s.ep), sc: score(snap) });
      const leg = legacyPairs(snap);
      const sent = now();
      view[slot] = { st: 'pend', hdr: p.hdr, sent, t: sent };
      mainBusy = true; fly.add(myUq);
      let wr;
      try { wr = await writeBatch(p.pairs, leg.pairs); } catch (e) { wr = { ok: false }; log('main write', e); }
      mainBusy = false; fly.del(myUq);
      if (!wr.ok) {
        view[slot] = { st: 'unk', hdr: null, sent, t: now() };
        mainFails++;
        const d = CLOUD_RETRY[Math.min(mainFails - 1, CLOUD_RETRY.length - 1)];
        clearTimeout(mainTimer); mainTimer = setTimeout(() => { mainTimer = 0; kick(); }, d);
        kick();   // срочное — сразу в быстрый слот
        return;
      }
      mainFails = 0;
      view[slot] = { st: 'ok', hdr: p.hdr, sent, t: now() };
      // всё, что знали к снимку, теперь в основном слоте: быстрые слоты можно переписывать (и свои больше не «свои»)
      FAST.forEach(x => { if (view[x].st === 'ok' && num(view[x].t) <= sent) view[x].cov = true; });
      ownX = ownX.filter(s => !(view[s].st === 'ok' && view[s].cov));
      remoteKnown = JSON.parse(payload); mainHash = h;
      if (wr.extraOk) lastLegacy = leg.sg;
      uqAck = Math.max(uqAck, myUq); ackLive = live;
      S.cloud = 'synced'; S.cloudAt = now();
      // пока писали, могло появиться новое: срочное — сразу, мелочи — обычной паузой
      if (uq > covered()) kick(); else if (mainAgain) { mainAgain = false; arm('cloud', debounceC(), false); }
    }
    /* Быстрые слоты.
       Сессия, видевшая облако, пишет в x: в свои (до двух, по очереди — пока один пишется, второй цел), пустые, битые,
       уже перенесённые в основной. Если все свои ещё пишутся (облако отвечает дольше, чем идут изменения), срочное
       не ждёт ответа: уходит в другой свободный слот, а если свободных нет — поверх своей же записи в пути, сначала
       «зависшей» (ответа нет дольше времени ответа облака; на iOS ошибка — тишина), потом самой старой. Новое
       содержит всё старое: дошла новая запись — в слоте и старое; пропала целиком — осталась старая; порвалась
       (часть кусков пропала) — старое есть в более новых слотах этой же сессии.
       Сессия, ещё ни разу не прочитавшая облако, пишет только в свою пару «слепых» слотов y (по номеру сессии):
       в x может лежать чекпоинт другой сессии, ещё не попавший в основной, а прочитать его она не может. */
    let lastOwnX = '', lastOwnY = '', lastX = '', xBusy = 0, xFails = 0, xTimer = 0, xFailUq = 0, wseq = 0;
    const xFly = bag();
    const sidNum = () => parseInt(fnv1a(SID).slice(0, 6), 16);
    const pend = s => view[s].st === 'pend';
    // запись в слот «зависла»: ответа нет дольше времени ответа облака с запасом
    const stale = s => pend(s) && now() - num(view[s].sent) > (rtt || T.READ0) + Math.max(1000, rtt / 2);
    const blindPair = () => { const h = sidNum(); return [YS[h % YS.length], YS[(h + 1) % YS.length]]; };
    const xRank = s => {
      const v = view[s];
      if (ownX.includes(s)) return s === lastOwnX ? 4 : 0;
      if (v.st === 'none' || v.st === 'bad') return 1;
      if (v.st === 'ok' && v.cov) return 2;
      if (v.st === 'unk') return 3;
      return 5;   // чужой, ещё не в основном: его содержимое у нас уже есть (прочитали), но лучше не трогать
    };
    // avoid — слоты, куда эта же запись уже ушла
    function pickX(avoid) {
      const ok = s => !(avoid && avoid.includes(s));
      const over = list => list.filter(s => ok(s) && pend(s))
        .sort((a, b) => (stale(b) - stale(a)) || (num(view[a].sent) - num(view[b].sent)))[0] || null;
      if (!viewKnown) {
        const pair = blindPair();
        return pair.filter(s => ok(s) && !pend(s)).sort((a, b) => (a === lastOwnY) - (b === lastOwnY))[0] || over(pair);
      }
      const age = s => (view[s].hdr ? num(view[s].hdr.at) : num(view[s].sent));
      const best = list => list.sort((a, b) => (xRank(a) - xRank(b)) || (age(a) - age(b)))[0] || null;
      const free = XS.filter(s => ok(s) && !pend(s));
      return best(free.filter(s => ownX.length < 2 || ownX.includes(s)))   // свой (или пока своих меньше двух — любой)
        || best(free.filter(s => !ownX.includes(s) && xRank(s) <= 3))      // свои все пишутся — другой свободный
        || over(XS.filter(s => ownX.includes(s)));                          // свободных нет — поверх своей записи в пути
    }
    // → слот, куда ушла запись, или null
    function writeX(dup, avoid) {
      const live0 = cfg.snapshot();
      if (score(live0) <= 0) return null;
      const snap = forRemote(remoteKnown ? merge([live0, remoteKnown], Object.assign(mopts(), { scalars: 'local' })) : live0);
      const h = contentHash(snap), live = contentHash(liveSnap()), myUq = uq;
      if (h === lastX || (xFly.has(h) && !dup)) { if (myUq > uqAck && live === ackLive) uqAck = myUq; return null; }
      // не влезает в один кусок — в быстрый слот сжатая копия (весь прогресс, одним setItem); целая — в основной
      let payload = encode(snap);
      if (payload.length >= CHUNK) { const lite = compact(snap, true); if (lite) payload = encode(lite); }
      if (payload.length > CHUNK * XN) { log('x skip (too big)', payload.length); return null; }
      const slot = pickX(avoid);
      if (!slot) return null;
      const p = packSlot(slot, payload, { at: now(), sid: SID, ep: num(snap._s && snap._s.ep), sc: score(snap) });
      const sent = now(), w = ++wseq;
      view[slot] = { st: 'pend', hdr: p.hdr, sent, t: sent, w };
      if (XS.includes(slot)) { if (!ownX.includes(slot)) ownX.push(slot); lastOwnX = slot; } else lastOwnY = slot;
      xBusy++; fly.add(myUq); xFly.add(h);
      (async () => {
        let wr;
        try { wr = await writeBatch(p.pairs); } catch (e) { wr = { ok: false }; log('x write', e); }
        xBusy--; fly.del(myUq); xFly.del(h);
        // поверх уже ушла запись новее (в ней всё это есть): слот — её, повтор не нужен
        if (view[slot].w !== w) { if (wr.ok) uqAck = Math.max(uqAck, myUq); kick(); return; }
        if (!wr.ok) {
          view[slot] = { st: 'unk', hdr: null, sent, t: now() };
          xFails++; xFailUq = uq;
          const d = CLOUD_RETRY[Math.min(xFails - 1, CLOUD_RETRY.length - 1)];
          clearTimeout(xTimer); xTimer = setTimeout(() => { xTimer = 0; kick(); }, d);
          return;
        }
        xFails = 0;
        view[slot] = { st: 'ok', hdr: p.hdr, sent, t: now(), cov: false };
        lastX = h; S.xAt = now();
        uqAck = Math.max(uqAck, myUq); ackLive = live;
        kick();
      })();
      return slot;
    }
    /* Один шаг: основной слот — если облако прочитано недавно (иначе сначала чтение); срочное, которое основной
       сейчас не возьмёт (чтение в пути, основной пишется, пауза после ошибки), — сразу в быстрый слот; пока облако
       не читается — всё в быстрый слот. Облако сбоит или медленное — срочное ещё и вторым экземпляром в другой
       быстрый слот. */
    let kickT = 0;
    function kick() { if (!kickT) kickT = setTimeout(() => { kickT = 0; pump(); }, 0); }
    function pump() {
      if (!active || !useCloud) return;
      if (uq > covered() && contentHash(liveSnap()) === ackLive) uqAck = uq;   // срочно, но всё уже записано
      let urgent = uq > covered(), mainWent = false;
      if (synced && !tooBig) {
        const dirty = contentHash(mainSnap()) !== mainHash;
        if (!dirty && !mainBusy) { uqAck = uq; urgent = false; }   // всё уже в основном слоте — срочного нет
        if (dirty && mainBusy) mainAgain = true;
        if (dirty && !mainBusy && !mainTimer) {
          if (now() - readAt < T.FRESH && pickMain()) {
            writeMain(); mainWent = true;
            if (!(urgent && twice())) return;   // срочное ушло в основной; облако сбоит или медленное — ещё и в быстрый
          } else requestRead(true);
        }
      } else if (!synced) requestRead();
      const lazy = (!synced || readFails > 0) && !xBusy;   // «лениво» — по одной; срочное — сразу, хоть и третьим
      // после сбоя записи быстрого слота — пауза перед повтором; новое срочное (чекпоинт после сбоя) её не ждёт
      if (urgent ? (!xTimer || uq > xFailUq) : (lazy && !xTimer)) {
        const slot = writeX(false);
        // вторым экземпляром — в другой слот (если первый экземпляр — не основной слот); следующему изменению место
        // всё равно найдётся — поверх своей записи в пути
        if (slot && urgent && twice() && !mainWent) writeX(true, [slot]);
      }
    }

    /* ---------- расписание ---------- */
    const timers = {}, firstAt = {};
    let dsBusy = false, dsAgain = false, dsFails = 0;
    function arm(k, ms, flush) {
      const nw = now();
      if (!firstAt[k]) firstAt[k] = nw;
      const due = Math.min(nw + ms, firstAt[k] + (k === 'ds' ? T.DS_MAXWAIT : T.CLOUD_MAXWAIT));
      const cur = timers[k];
      if (cur) {
        if (cur.flush && !flush) return;
        if (flush && cur.due <= due) return;
        clearTimeout(cur.id);   // обычная запись: пауза отсчитывается от последнего сохранения (но не дольше MAXWAIT)
      }
      timers[k] = { id: setTimeout(() => fire(k), Math.max(0, due - nw)), due, flush: !!flush };
    }
    function fire(k) { timers[k] = null; firstAt[k] = 0; if (k === 'ds') runDS(); else pump(); }
    async function runDS() {
      if (!useDS) return;
      if (dsBusy) { dsAgain = true; return; }
      dsBusy = true; dsAgain = false;
      let ok = true;
      try { ok = await dsWrite(); } catch (e) { ok = false; log('ds write', e); }
      dsBusy = false;
      if (!ok) {
        dsFails++;
        if (dsFails > DS_RETRY.length) { dsFails = 0; return; }   // три попытки, дальше — со следующим сохранением
        setTimeout(runDS, DS_RETRY[dsFails - 1]);
        return;
      }
      dsFails = 0;
      if (dsAgain) arm('ds', T.FLUSH, true);
    }
    const debounceC = () => (synced ? T.CLOUD_DEBOUNCE : T.X_DEBOUNCE);
    function schedule(o) {
      o = o || {};
      if (!active) return;
      if (o.flush) uq++;
      if (useDS) arm('ds', o.flush ? T.FLUSH : T.DS_DEBOUNCE, !!o.flush);
      if (useCloud) arm('cloud', o.flush ? T.FLUSH : debounceC(), !!o.flush);
    }
    // свернули / закрывают: отправить сейчас (на iOS после закрытия вызовы уже не уходят)
    function flushAll() {
      if (!active) return;
      if (useDS) { if (timers.ds) clearTimeout(timers.ds.id); timers.ds = null; firstAt.ds = 0; runDS(); }
      if (useCloud) { uq++; if (timers.cloud) clearTimeout(timers.cloud.id); timers.cloud = null; firstAt.cloud = 0; pump(); }
    }
    function activate() { if (active) return; active = true; schedule({}); }
    // вернулись в приложение: не записало ли облако другое устройство (свежее чтение в фоне)
    function recheck() { if (synced && useCloud) requestRead(true); }
    let hiddenAt = 0;
    function onHidden() { if (!hiddenAt) hiddenAt = now(); flushAll(); }
    function onVisible() {
      const away = hiddenAt ? now() - hiddenAt : 0; hiddenAt = 0;
      if (readPending) { readPending = false; requestRead(true); } else if (away > T.AWAY) recheck();
    }
    // намеренный сброс: пишем сразу во все основные слоты и старый ключ, даже без чтения облака
    // (старые копии везде отбросятся по _s.ep — и быстрые слоты других сессий тоже)
    function resetWrite() {
      if (useDS) dsWrite(true).then(ok => { if (ok) dsKnown = true; });
      if (!useCloud) return Promise.resolve(true);
      const snap = liveSnap(), payload = encode(snap), sent = now();
      const packs = MAIN.map((s, i) => packSlot(s, payload, { seq: num(snap._s && snap._s.seq) + 1 + i, at: sent, sid: SID, ep: num(snap._s && snap._s.ep), sc: 0 }));
      MAIN.forEach((s, i) => { view[s] = { st: 'pend', hdr: packs[i].hdr, sent, t: sent }; });
      const main = Object.assign({}, snap); delete main.town;
      const rm = ccall(cb => CSo().removeItem(K.LEGACY_TOWN, cb), writeTO());
      return writeBatch([].concat(...packs.map(p => p.pairs)), [[K.LEGACY, encode(main)]]).then(async wr => {
        await rm;
        MAIN.forEach((s, i) => { view[s] = { st: wr.ok ? 'ok' : 'unk', hdr: wr.ok ? packs[i].hdr : null, sent, t: now() }; });
        if (!wr.ok) return false;
        synced = true; viewKnown = true; readAt = now(); remoteKnown = JSON.parse(payload); mainHash = contentHash(snap);
        S.cloud = 'synced'; S.cloudAt = now();
        return true;
      });
    }
    // DS перед перезагрузкой страницы: дождаться записи (не дольше ms)
    // (DS, ещё не прочитанный в этой сессии, не перезаписывается: в нём может быть прогресс, которого здесь нет)
    function flushDS(ms) { if (!useDS) return Promise.resolve(); return Promise.race([dsWrite(false), new Promise(r => setTimeout(r, ms || 1000))]); }
    // для перезагрузки «Продолжить с сохранения»: что знаем о слотах (без содержимого)
    function exportView() {
      if (!viewKnown) return null;
      const slots = {};
      ALL.forEach(s => { const v = view[s]; slots[s] = { st: v.st === 'pend' ? 'unk' : v.st, hdr: v.hdr || null, cov: !!v.cov }; });
      return { at: now(), slots };
    }
    function status() {
      const sl = {}; ALL.forEach(s => { sl[s] = view[s].st; });
      return Object.assign({}, S, { synced, useDS, useCloud, dsKnown, sid: SID, view: sl, own: ownX.slice(), flaky: !!flaky(), suspect, readAgo: readAt ? now() - readAt : -1 });
    }
    return { readDS, readCloud, activate, schedule, flushAll, flushDS, onHidden, onVisible, recheck, resetWrite, status, exportView, isSynced: () => synced, sid: SID };
  }

  return {
    K, T, CHUNK, MAXN, XN, MAIN, XS, YS, FAST, CLOUD_KEYS, D32,
    parse, clone, meta, orBits, bitCount, bitList, score, hasProgress, sig, progressKeys, gained, covers, summary,
    merge, applyInPlace, encode, fnv1a, split, packSlot, readSlot, forRemote, canon, contentHash, decodeCloud, legacyMain, compact,
    scalarPaths, scalarVals, stampScalars, runtime,
  };
});
