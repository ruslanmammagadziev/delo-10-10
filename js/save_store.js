/* =====================================================================
   СОХРАНЕНИЯ: слияние копий, счёт прогресса, кодирование, хранилища Telegram.
   Чистая часть (без DOM, проверяется в Node): score, hasProgress, merge, applyInPlace, encode, fnv1a, split, assemble,
   decodeCloud, gained, covers, sig, summary. Браузерная часть: SaveStore.runtime({...}) — DeviceStorage и CloudStorage
   Telegram: чтение с тайм-аутами и повторами, очередь, запись с паузой, повторы с растущей паузой, A/B-слоты облака.
   Главное правило: копии не заменяют друг друга целиком. Прогресс (чекпоинты серий и миссий, наклейки, находки,
   штампы прогулки, флаги города) объединяется; намеренный сброс (_s.ep) и «пройти заново» (eps[n].g) — метки
   времени, слияние их не отменяет: копия, начатая раньше сброса или перезапуска серии, отбрасывается.
   Облако: значение ключа ≤ 4096 символов, поэтому сохранение — ASCII-JSON кусками по 3800 в двух слотах (a/b).
   Пишется всегда НЕ текущий слот, а оглавление d2m хранит длину и хеш обоих слотов: куски и оглавление уходят
   одним заходом (одна задержка сети — важно, если приложение закрывают сразу после разгадки), и если долетела
   только часть, недописанный слот не примется (длина и хеш не сойдутся) — читатель возьмёт второй, целый.
   До первого удачного чтения облака сессия пишет только в отдельный слот u (его читают все и объединяют).
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SaveStore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------- Ключи и пределы ---------- */
  const K = {
    LS: 'delo1010_v1', LS_TOWN: 'delo1010_v1_town', LS_DEV: 'delo1010_dev', LS_BAD: 'delo1010_v1_bad', STASH: 'delo1010_stash',
    DS: 'delo1010_v2', CM: 'd2m', CU: 'd2um', LEGACY: 'delo1010_v1', LEGACY_TOWN: 'delo1010_v1_town',
  };
  const CHUNK = 3800, MAXN = 6;
  const slotKeys = s => Array.from({ length: MAXN }, (_, i) => `d2${s}${i}`);
  // одно чтение облака: оба оглавления, все куски трёх слотов и старые ключи (22 ключа из 1024)
  const CLOUD_KEYS = [K.CM, K.CU].concat(slotKeys('a'), slotKeys('b'), slotKeys('u'), [K.LEGACY, K.LEGACY_TOWN]);
  const T = {
    DS_READ: 1500, DS_OP: 3000, CLOUD_READ: 10000, CLOUD_OP: 8000,
    FLUSH: 150, DS_DEBOUNCE: 400, DS_MAXWAIT: 3000, CLOUD_DEBOUNCE: 2500, U_DEBOUNCE: 5000, CLOUD_MAXWAIT: 10000,
    RECHECK: 300000, AWAY: 5000,
  };
  const READ_RETRY = [3000, 10000, 30000, 60000, 120000];
  const CLOUD_RETRY = [2000, 5000, 15000, 30000, 60000];
  const DS_RETRY = [2000, 5000, 15000];
  const ROOMS1 = ['cinema', 'bureau', 'sweets', 'roof'];

  /* ---------- Мелочи ---------- */
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const isSet = v => v !== undefined && v !== null && v !== '';
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const num = v => (typeof v === 'number' && isFinite(v) ? v : +v || 0);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
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
  // _s = { ep: время последнего сброса, born: начало этой линии сохранений, seq, at: время записи, dev: устройство }
  function meta(s) {
    const m = isObj(s && s._s) ? s._s : {};
    return { ep: num(m.ep), born: num(m.born), seq: num(m.seq), at: Math.max(num(m.at), num(s && s.updated)), dev: typeof m.dev === 'string' ? m.dev : '' };
  }
  const isTown = t => isObj(t) && t.v === 2;
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
    'engHint', 'name', 'look', 'bow', 'coat', 'hair', 'world', 'town'].concat(PREFS, FLAGS, CHOICE));

  /* merge(copies, opts) — copies[0] — своя (живое состояние этого устройства), дальше — чужие копии.
     opts.dev — id этого устройства; opts.scalars === 'local' — выборы (имя, образ, настройки) остаются своими,
     объединяется только прогресс; opts.validLook(id) — образ годится. Результат — новый объект (входы не меняются). */
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
    const byNew = kept.slice().sort((a, b) => (b.m.at - a.m.at) || (b.m.seq - a.m.seq) || (b.sc - a.sc) || (a.i - b.i));
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
  // слот: куски prefix0..n-1, длина и хеш должны совпасть с оглавлением
  function assemble(items, m, prefix) {
    if (!isObj(items) || !isObj(m)) return null;
    const n = num(m.n);
    if (!(n >= 1 && n <= MAXN)) return null;
    let s = '';
    for (let i = 0; i < n; i++) { const v = items[prefix + i]; if (typeof v !== 'string' || !v) return null; s += v; }
    if (s.length !== num(m.len) || fnv1a(s) !== m.h) return null;
    return s;
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
  // ответ getItems → одна копия (слоты a/b, слот u, старые ключи) + оглавление + что приняли
  function decodeCloud(items, opts) {
    const info = { a: 'none', b: 'none', u: 'none', legacy: 'none' }, copies = [];
    const m = isObj(items) ? parse(items[K.CM]) : null;
    ['a', 'b'].forEach(s => {
      if (!m || !isObj(m[s])) return;
      const p = assemble(items, m[s], 'd2' + s);
      const c = p ? parse(p) : null;
      if (c) { copies.push(c); info[s] = 'ok'; } else info[s] = 'bad';
    });
    const um = isObj(items) ? parse(items[K.CU]) : null;
    if (um) { const p = assemble(items, um, 'd2u'); const c = p ? parse(p) : null; if (c) { copies.push(c); info.u = 'ok'; } else info.u = 'bad'; }
    const lm = isObj(items) ? parse(items[K.LEGACY]) : null, lt = isObj(items) ? parse(items[K.LEGACY_TOWN]) : null;
    if (lm || lt) {
      const c = lm || {};
      if (lt) c.town = lt;
      copies.push(c); info.legacy = 'ok';
    }
    if (m && isObj(m[m.cur]) && info[m.cur] !== 'ok') info.curBad = true;
    // сначала текущий слот (он новее), его выборы — основа
    if (m && m.cur === 'b' && info.a === 'ok' && info.b === 'ok') copies.splice(0, 2, copies[1], copies[0]);
    const copy = copies.length ? (copies.length === 1 ? copies[0] : merge(copies, Object.assign({}, opts || {}, { dev: undefined }))) : null;
    return { copy, meta: m && (m.cur === 'a' || m.cur === 'b') ? m : null, info };
  }
  // a уже содержит всё из b (кроме того, что в a отменено сбросом или перезапуском серии)
  function covers(a, b) { if (!isObj(b)) return true; return gained(a, merge([a, b], { scalars: 'local' })).length === 0; }
  function summary(s) {
    const e = isObj(s) && isObj(s.eps) ? s.eps[1] : null;
    if (e && e.done) return 'серия 1 пройдена';
    const n = e && Array.isArray(e.cp) ? ROOMS1.filter(r => e.cp.includes(r)).length : 0;
    if (n) return `серия 1, раскрыто дел: ${n} из ${ROOMS1.length}`;
    if (e && Array.isArray(e.cp) && e.cp.length) return 'серия 1 начата';
    return 'наклейки и находки';
  }

  /* =====================================================================
     Браузер: хранилища Telegram.
     cfg = { TG, useDS, useCloud, dev, snapshot: () => живое состояние, onCopy(src, copy) — пришла копия,
             validLook, log }
     ===================================================================== */
  function runtime(cfg) {
    const TG = cfg.TG, log = typeof cfg.log === 'function' ? cfg.log : function () {};
    const DSo = () => TG.DeviceStorage, CSo = () => TG.CloudStorage;
    let useDS = !!cfg.useDS, useCloud = !!cfg.useCloud;
    const S = { ds: useDS ? 'reading' : 'off', cloud: useCloud ? 'reading' : 'off', dsAt: 0, cloudAt: 0, uAt: 0, err: '', slots: null, size: 0, writes: 0 };
    let active = false, synced = false, remoteKnown = null, remoteMeta = null, checkedAt = 0, dsKnown = false;
    let lastDS = '', lastCloud = '', lastU = '', lastLegacy = null, readTry = 0, readTimer = 0, readPending = false, dsReadTry = 0;
    const mopts = () => ({ dev: cfg.dev, validLook: cfg.validLook });
    const unsupported = e => /unsupported/i.test(String(e || ''));
    const hidden = () => typeof document !== 'undefined' && !!document.hidden;

    // вызов Telegram: всегда с тайм-аутом (на iOS при ошибке ответа нет вовсе); поздний ответ — в onLate
    function call(fn, ms, onLate) {
      return new Promise(res => {
        let done = false;
        const t = setTimeout(() => { if (!done) { done = true; res({ err: 'TIMEOUT' }); } }, ms);
        try {
          fn((err, val) => {
            if (done) { if (onLate) { try { onLate(err, val); } catch (e) { log('late', e); } } return; }
            done = true; clearTimeout(t); res({ err: err || null, val });
          });
        } catch (e) { if (!done) { done = true; clearTimeout(t); res({ err: 'THROW ' + ((e && e.message) || e) }); } }
      });
    }
    // облако — одна очередь: чтение, запись, проверка оглавления не перекрываются
    let queue = Promise.resolve();
    function enqueue(fn) { const p = queue.then(() => fn()); queue = p.catch(() => {}); return p; }
    const set = (k, v) => { S.writes++; return call(cb => CSo().setItem(k, v, cb), T.CLOUD_OP); };
    const failed = r => !!(r.err || r.val === false);

    /* ---------- чтение ---------- */
    function gotDS(val) {
      dsKnown = true; S.ds = 'ok'; S.dsAt = Date.now();
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
    function gotCloud(items) {
      if (synced) return;
      const d = decodeCloud(items, mopts());
      synced = true; readTry = 0; clearTimeout(readTimer);
      remoteKnown = d.copy; remoteMeta = d.meta; checkedAt = Date.now();
      lastCloud = d.copy ? contentHash(forRemote(d.copy)) : '';
      S.cloud = 'synced'; S.cloudAt = Date.now(); S.slots = d.info;
      log('cloud read', JSON.stringify(d.info));
      if (d.copy) cfg.onCopy('cloud', d.copy);
      if (active) schedule({});
    }
    function readOnce() {
      if (synced || !useCloud) return Promise.resolve();
      if (!synced) S.cloud = 'reading';
      return call(cb => CSo().getItems(CLOUD_KEYS, cb), T.CLOUD_READ, (err, val) => { if (!err && isObj(val)) gotCloud(val); }).then(r => {
        if (synced) return;
        if (!r.err && isObj(r.val)) { gotCloud(r.val); return; }
        if (unsupported(r.err)) { useCloud = false; S.cloud = 'off'; log('cloud unsupported'); return; }
        // ошибка чтения — это не «облако пустое»: писать в основные слоты нельзя, пробуем ещё
        S.cloud = 'unsynced'; S.err = 'cloud ' + (r.err || 'bad reply'); log('cloud read', r.err);
        const d = READ_RETRY[Math.min(readTry, READ_RETRY.length - 1)]; readTry++;
        clearTimeout(readTimer);
        readTimer = setTimeout(() => { if (hidden()) { readPending = true; return; } enqueue(readOnce); }, d);
      });
    }
    const readCloud = () => (useCloud ? enqueue(readOnce) : Promise.resolve());

    /* ---------- запись ---------- */
    const liveSnap = () => forRemote(cfg.snapshot());
    // в облако — живое состояние, объединённое с последней прочитанной копией облака
    const mainSnap = () => forRemote(remoteKnown ? merge([cfg.snapshot(), remoteKnown], Object.assign(mopts(), { scalars: 'local' })) : cfg.snapshot());
    async function dsWrite(force) {
      if (!useDS || (!dsKnown && !force)) return true;
      const snap = liveSnap(), h = contentHash(snap);
      if (!force && h === lastDS) return true;
      const r = await call(cb => DSo().setItem(K.DS, encode(snap), cb), T.DS_OP);
      if (failed(r)) {
        if (unsupported(r.err)) { useDS = false; S.ds = 'unsupported'; return true; }
        S.ds = 'error'; S.err = 'ds ' + (r.err || 'false'); log('ds write', S.err); return false;
      }
      lastDS = h; S.ds = 'ok'; S.dsAt = Date.now(); return true;
    }
    // одна пачка setItem параллельно: [[ключ, значение], …]; ok — подтверждены все нужные (куски + оглавление),
    // extraOk — и дополнительные (старые ключи: их сбой запись не отменяет, они уйдут со следующей)
    async function writeBatch(pairs, extra) {
      extra = extra || [];
      const rs = await Promise.all(pairs.concat(extra).map(([k, v]) => set(k, v)));
      const bad = rs.slice(0, pairs.length).find(failed);
      if (bad) { S.err = 'cloud ' + (bad.err || 'false'); log('cloud write', S.err); return { ok: false }; }
      return { ok: true, extraOk: !rs.slice(pairs.length).some(failed) };
    }
    const slotPairs = (prefix, payload) => split(payload, CHUNK).map((p, i) => [prefix + i, p]);
    const slotMeta = (payload, n) => ({ n, len: payload.length, h: fnv1a(payload) });
    // старые ключи (для старых сборок и отката): при изменении чекпоинтов и первой записи сессии
    function legacyPairs(snap) {
      const sg = sig(snap) + '|' + snap._s.ep;
      if (sg === lastLegacy) return { pairs: [], sg };
      const main = Object.assign({}, snap); delete main.town;
      const raw = encode(main), rawT = isObj(snap.town) ? encode(snap.town) : '';
      if (raw.length >= CHUNK || rawT.length >= CHUNK) { log('legacy skip', raw.length, rawT.length); return { pairs: [], sg, skip: true }; }
      return { pairs: [[K.LEGACY, raw]].concat(rawT ? [[K.LEGACY_TOWN, rawT]] : []), sg };
    }
    // вернулись в приложение: не записало ли облако другое устройство (сверка оглавления в фоне)
    function recheck() {
      if (!synced || !useCloud) return Promise.resolve();
      return enqueue(async () => {
        const r = await call(cb => CSo().getItem(K.CM, cb), T.CLOUD_OP);
        if (r.err) return;
        checkedAt = Date.now();
        if (sameMeta(parse(r.val), remoteMeta)) return;
        const rr = await call(cb => CSo().getItems(CLOUD_KEYS, cb), T.CLOUD_READ);
        if (rr.err || !isObj(rr.val)) return;
        const d = decodeCloud(rr.val, mopts());
        remoteKnown = d.copy; remoteMeta = d.meta; S.slots = d.info;
        log('cloud changed elsewhere', JSON.stringify(d.info));
        if (d.copy) cfg.onCopy('cloud', d.copy);
        schedule({});
      });
    }
    const sameMeta = (a, b) => (!a && !b) || (isObj(a) && isObj(b) && a.cur === b.cur && isObj(a[a.cur]) && isObj(b[b.cur]) && a[a.cur].h === b[b.cur].h);
    async function writeMain() {
      let snap = mainSnap(), h = contentHash(snap);
      if (h === lastCloud) return true;
      // очень давно не сверялись с облаком (второе устройство могло записать): сначала оглавление
      if (Date.now() - checkedAt > T.RECHECK) {
        const r = await call(cb => CSo().getItem(K.CM, cb), T.CLOUD_OP);
        if (!r.err) {
          checkedAt = Date.now();
          if (!sameMeta(parse(r.val), remoteMeta)) {
            const rr = await call(cb => CSo().getItems(CLOUD_KEYS, cb), T.CLOUD_READ);
            if (rr.err || !isObj(rr.val)) return false;
            const d = decodeCloud(rr.val, mopts());
            remoteKnown = d.copy; remoteMeta = d.meta; S.slots = d.info;
            log('cloud changed elsewhere', JSON.stringify(d.info));
            if (d.copy) cfg.onCopy('cloud', d.copy);
            snap = mainSnap(); h = contentHash(snap);
          }
        }
      }
      snap._s.seq = Math.max(num(snap._s.seq), remoteKnown ? meta(remoteKnown).seq : 0) + 1;
      const payload = encode(snap);
      S.size = payload.length;
      if (payload.length > CHUNK * MAXN) {
        if (S.cloud !== 'too-big') console.error('[save] сохранение не помещается в облако Telegram:', payload.length);
        S.cloud = 'too-big'; lastCloud = h; return true;
      }
      if (remoteKnown && !covers(snap, remoteKnown)) {
        console.error('[save] guard: запись потеряла бы прогресс облака', gained(snap, remoteKnown).slice(0, 8));
        checkedAt = 0; return false;
      }
      // пишем НЕ текущий слот; оглавление сохраняет запись текущего — он остаётся целым при любом обрыве
      const slot = remoteMeta && remoteMeta.cur === 'a' ? 'b' : 'a';
      const parts = slotPairs('d2' + slot, payload);
      const m2 = { v: 2, cur: slot, a: (remoteMeta && remoteMeta.a) || null, b: (remoteMeta && remoteMeta.b) || null, ep: snap._s.ep, sc: score(snap), dev: cfg.dev || '', at: Date.now() };
      m2[slot] = Object.assign(slotMeta(payload, parts.length), { at: snap._s.at, seq: snap._s.seq });
      const leg = legacyPairs(snap);
      const wr = await writeBatch(parts.concat([[K.CM, JSON.stringify(m2)]]), leg.pairs);
      if (!wr.ok) return false;
      remoteMeta = m2; remoteKnown = JSON.parse(payload); lastCloud = h;
      if (wr.extraOk) lastLegacy = leg.sg;
      S.cloud = 'synced'; S.cloudAt = Date.now();
      return true;
    }
    // облако не прочитано: свой отдельный слот u (основные слоты не трогаем)
    async function writeU() {
      const live = cfg.snapshot();
      if (!hasProgress(live)) return true;
      const snap = forRemote(live), h = contentHash(snap);
      if (h === lastU) return true;
      const payload = encode(snap);
      if (payload.length > CHUNK * MAXN) return true;
      const parts = slotPairs('d2u', payload);
      const um = Object.assign(slotMeta(payload, parts.length), { v: 2, at: snap._s ? snap._s.at : 0, ep: snap._s ? snap._s.ep : 0, dev: cfg.dev || '' });
      if (!(await writeBatch(parts.concat([[K.CU, JSON.stringify(um)]]))).ok) return false;
      lastU = h; S.uAt = Date.now(); return true;
    }
    function cloudWrite() { if (!useCloud) return true; return synced ? writeMain() : writeU(); }

    /* ---------- расписание ---------- */
    const timers = {}, busy = {}, again = {}, fails = {}, firstAt = {};
    const enabled = k => (k === 'ds' ? useDS : useCloud);
    const debounce = k => (k === 'ds' ? T.DS_DEBOUNCE : synced ? T.CLOUD_DEBOUNCE : T.U_DEBOUNCE);
    function arm(k, ms, flush) {
      if (busy[k]) { again[k] = flush ? 'flush' : (again[k] || 'normal'); return; }
      if (fails[k] && timers[k]) return;   // пауза после ошибки: повтор возьмёт свежий снимок
      const now = Date.now();
      if (!firstAt[k]) firstAt[k] = now;
      let due = Math.min(now + ms, firstAt[k] + (k === 'ds' ? T.DS_MAXWAIT : T.CLOUD_MAXWAIT));
      const cur = timers[k];
      if (cur) {
        if (cur.flush && !flush) return;
        if (flush && cur.due <= due) return;
        clearTimeout(cur.id);   // обычная запись: пауза отсчитывается от последнего сохранения (но не дольше MAXWAIT)
      }
      timers[k] = { id: setTimeout(() => run(k), Math.max(0, due - now)), due, flush: !!flush };
    }
    async function run(k) {
      timers[k] = null;
      if (!enabled(k)) return;
      if (busy[k]) { again[k] = 'flush'; return; }
      busy[k] = true; again[k] = false;
      let ok = true;
      try { ok = await (k === 'ds' ? dsWrite() : enqueue(cloudWrite)); } catch (e) { ok = false; log(k, 'write', e); }
      busy[k] = false;
      if (ok === false) {
        fails[k] = (fails[k] || 0) + 1;
        const B = k === 'ds' ? DS_RETRY : CLOUD_RETRY;
        if (k === 'ds' && fails[k] > B.length) { fails[k] = 0; firstAt[k] = 0; return; }   // DS: три попытки, дальше — со следующим сохранением
        const d = B[Math.min(fails[k] - 1, B.length - 1)];
        timers[k] = { id: setTimeout(() => run(k), d), due: Date.now() + d, flush: true };
        return;
      }
      fails[k] = 0; firstAt[k] = 0;
      if (again[k]) { const f = again[k] === 'flush'; again[k] = false; arm(k, f ? T.FLUSH : debounce(k), f); }
    }
    function schedule(o) {
      o = o || {};
      if (!active) return;
      ['ds', 'cloud'].forEach(k => { if (enabled(k)) arm(k, o.flush ? T.FLUSH : debounce(k), !!o.flush); });
    }
    // свернули / закрывают: отправить сейчас (на iOS после закрытия вызовы уже не уходят)
    function flushAll() {
      if (!active) return;
      ['ds', 'cloud'].forEach(k => {
        if (!enabled(k)) return;
        if (busy[k]) { again[k] = 'flush'; return; }
        if (timers[k]) clearTimeout(timers[k].id);
        timers[k] = null; run(k);
      });
    }
    function activate() { if (active) return; active = true; schedule({}); }
    let hiddenAt = 0;
    function onHidden() { if (!hiddenAt) hiddenAt = Date.now(); flushAll(); }
    function onVisible() {
      const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0;
      if (readPending) { readPending = false; enqueue(readOnce); }
      else if (away > T.AWAY) recheck();
    }
    // намеренный сброс: пишем сразу везде, даже без чтения облака (старые копии отбросятся по _s.ep)
    function resetWrite() {
      if (useDS) dsWrite(true).then(ok => { if (ok) dsKnown = true; });
      if (!useCloud) return Promise.resolve(true);
      return enqueue(async () => {
        const snap = liveSnap(), payload = encode(snap);
        const slot = remoteMeta && remoteMeta.cur === 'a' ? 'b' : 'a';
        const parts = slotPairs('d2' + slot, payload);
        const m2 = { v: 2, cur: slot, a: null, b: null, ep: snap._s.ep, sc: 0, dev: cfg.dev || '', at: Date.now() };
        m2[slot] = Object.assign(slotMeta(payload, parts.length), { at: snap._s.at, seq: num(snap._s.seq) });
        const main = Object.assign({}, snap); delete main.town;
        const rm = call(cb => CSo().removeItem(K.LEGACY_TOWN, cb), T.CLOUD_OP);
        if (!(await writeBatch(parts.concat([[K.CM, JSON.stringify(m2)]]), [[K.LEGACY, encode(main)]])).ok) return false;
        await rm;
        synced = true; remoteKnown = JSON.parse(payload); remoteMeta = m2; lastCloud = contentHash(snap); checkedAt = Date.now();
        S.cloud = 'synced'; S.cloudAt = Date.now();
        return true;
      });
    }
    // DS перед перезагрузкой страницы: дождаться записи (не дольше ms)
    // (DS, ещё не прочитанный в этой сессии, не перезаписывается: в нём может быть прогресс, которого здесь нет)
    function flushDS(ms) { if (!useDS) return Promise.resolve(); return Promise.race([dsWrite(false), new Promise(r => setTimeout(r, ms || 1000))]); }
    function status() { return Object.assign({}, S, { synced, useDS, useCloud, dsKnown, meta: remoteMeta ? { cur: remoteMeta.cur } : null }); }
    return { readDS, readCloud, activate, schedule, flushAll, flushDS, onHidden, onVisible, recheck, resetWrite, status, isSynced: () => synced };
  }

  return {
    K, T, CHUNK, MAXN, CLOUD_KEYS, D32,
    parse, clone, meta, orBits, bitCount, bitList, score, hasProgress, sig, progressKeys, gained, covers, summary,
    merge, applyInPlace, encode, fnv1a, split, assemble, forRemote, canon, contentHash, decodeCloud, runtime,
  };
});
