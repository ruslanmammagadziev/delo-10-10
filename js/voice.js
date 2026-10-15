/* =====================================================================
   ГОЛОСА: озвученные реплики персонажей из папки ./voice/ (собирает tools/voice_build.py).

   Реплика показана (G.say / облачко / вопрос) → есть запись в voice/manifest.json — играет запись,
   нет — остаётся мягкий «лепет» из engine.js. Папки voice/ нет (однофайловая сборка без неё, file://,
   нет сети) — тихо работает «лепет». Сборка «всё в одном» (--embed-voices) кладёт записи в window.__VOICE_INLINE —
   тогда они берутся из самого файла, без сети и с file://.
   • Ключ записи: FNV-1a(who + '|' + текст) с затравкой man.seed, где имя героини заменено на {name}
     (то же в voice_build.py).
     Имя голосом не звучит никогда: в записи на его месте мягкое «мм-м».
   • Звук и «Голоса» — переключатели engine.js (по умолчанию звук выключен); «Рассказчик» — отдельно.
   • Одновременно говорит один: новая реплика в окне диалога гасит предыдущую; облачка встают в очередь.
   • Реплика закрыта / «пропустить» — голос гаснет за ~0,08 с. Пока говорит голос, музыка мест чуть тише.
   • Файлы грузятся лениво, с кэшем (последние 16) и предзагрузкой следующих реплик сцены.
   • iOS / Telegram: аудио «разблокируется» первым касанием; при включённом звуке — audioSession 'playback'
     (на iPhone голос слышен и при беззвучном режиме, где это поддерживается).
   API: Voice.line(who, text, { mode: 'line'|'bubble', onFail }) → ручка { stop(fade) } или null (нет записи);
        Voice.preload(lines), Voice.stop(), Voice.has(who, text), Voice.ready (Promise манифеста),
        Voice.stats(), Voice.misses() — реплики без записи (для tools/voice_harvest.json), Voice.log.
   ===================================================================== */
(function () {
  'use strict';
  const BASE = 'voice/';
  const VOL = 0.38;          // громкость голоса: пики на выходе ≈ −10 дБFS, речь ≈ −22 дБFS RMS (эффекты пикуют на −17…−28)
  const DUCK = 0.55;         // музыка и фон мест во время реплики
  const LRU = 16;            // декодированные записи (48 кГц на iPhone: ≈0,5 МБ на реплику)
  const G_ = () => window.G || null;
  const st = () => { try { return G_() ? G_().state() : {}; } catch (e) { return {}; } };

  /* ---------- ключ (как в tools/voice_build.py) ---------- */
  function fnv(s, seed) {
    let h = seed == null ? 0x811c9dc5 : seed >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const norm = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  let isL = null;
  try { isL = new RegExp('\\p{L}', 'u'); } catch (e) { isL = /[A-Za-zА-Яа-яЁё]/; }
  // имя героини (как она его ввела) → {name}; только целым словом
  function slotName(text) {
    const nm = norm(st().name || '');
    if (!nm) return text;
    const low = text.toLowerCase(), q = nm.toLowerCase();
    const exact = low.length !== text.length;   // редкие буквы меняют длину при toLowerCase — ищем как есть
    const hay = exact ? text : low, ndl = exact ? nm : q;
    let out = '', i = 0;
    for (let p = hay.indexOf(ndl); p >= 0; p = hay.indexOf(ndl, p + 1)) {
      const a = text[p - 1], b = text[p + ndl.length];
      if ((a && isL.test(a)) || (b && isL.test(b))) continue;
      out += text.slice(i, p) + '{name}'; i = p + ndl.length; p = i - 1;
    }
    return out + text.slice(i);
  }
  const keyOf = (who, text) => fnv((who || 'narrator') + '|' + norm(slotName(norm(text))), man && man.seed);

  /* ---------- голоса внутри файла (сборка «всё в одном»: build_single.py --embed-voices) ---------- */
  // window.__VOICE_INLINE = { 'manifest.json': base64, '<файл>.mp3': base64, … } — тогда в сеть не ходим вовсе
  // (работает и с file://); нет карты — как раньше: voice/ рядом с игрой по http/https.
  const INL = () => { const v = window.__VOICE_INLINE; return v && typeof v === 'object' ? v : null; };
  function b64buf(b) { const s = atob(b), n = s.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  function inlineGet(file, json) {
    const v = INL(); if (!v || typeof v[file] !== 'string') return null;
    const ab = b64buf(v[file]);
    if (!json) return ab;
    let txt = ''; try { txt = new TextDecoder('utf-8').decode(ab); } catch (e) { const u = new Uint8Array(ab); txt = decodeURIComponent(escape(String.fromCharCode.apply(null, u))); }
    return JSON.parse(txt);
  }

  /* ---------- манифест ---------- */
  let man = null, manFail = false, manP = null, pats = {};
  const httpOk = /^https?:$/.test(location.protocol);
  function loadManifest() {
    if (manP) return manP;
    const inl = INL();
    if (!inl && (!httpOk || !window.fetch)) { manFail = true; manP = Promise.resolve(null); return manP; }
    const src = inl ? new Promise(res => res(inlineGet('manifest.json', true))) : fetch(BASE + 'manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null));
    manP = src.then(m => {
      if (!m || !m.lines) { manFail = true; return null; }
      man = m;
      Object.keys(m.pats || {}).forEach(w => {
        pats[w] = m.pats[w].map(([parts, file, d]) => [new RegExp('^' + parts.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'), file, d]);
      });
      return m;
    }).catch(() => { manFail = true; return null; });
    return manP;
  }
  function lookup(who, text) {
    if (!man) return null;
    who = who || 'narrator';
    const raw = norm(text), t = norm(slotName(raw));
    // сначала с {name}; не нашлось — текст как есть (имя совпало с обычным словом: «А», «Ия»… и союз «а»)
    for (const x of t === raw ? [t] : [t, raw]) {
      const e = man.lines[fnv(who + '|' + x, man.seed)];
      if (e) return { file: e[0], d: e[1] };
      const ps = pats[who];
      if (ps) for (const [re, file, d] of ps) if (re.test(x)) return { file, d };
    }
    return null;
  }

  /* ---------- аудио ---------- */
  const actx = () => { try { const G = G_(); return G && G.audio ? G.audio() : null; } catch (e) { return null; } };
  const bus = k => { try { const G = G_(); return G && G.audioBus ? G.audioBus(k) : null; } catch (e) { return null; } };
  function enabled(who) {
    const s = st();
    if (!s.sound || s.voices === false) return false;
    if ((who || 'narrator') === 'narrator' && s.narr === false) return false;
    return true;
  }
  const buffers = new Map(), inflight = new Map();
  function remember(file, buf) {
    buffers.delete(file); buffers.set(file, buf);
    while (buffers.size > LRU) buffers.delete(buffers.keys().next().value);
  }
  function fetchBuf(file) {
    if (buffers.has(file)) { const b = buffers.get(file); remember(file, b); return Promise.resolve(b); }
    if (inflight.has(file)) return inflight.get(file);
    const a = actx();
    if (!a) return Promise.resolve(null);
    const inl = INL();
    const raw = inl ? new Promise((res, rej) => { const ab = inlineGet(file, false); if (ab) res(ab); else rej(new Error('нет в файле: ' + file)); })
      : fetch(BASE + file).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))));
    const p = raw
      .then(ab => new Promise((res, rej) => { try { const q = a.decodeAudioData(ab, res, rej); if (q && q.catch) q.catch(rej); } catch (e) { rej(e); } }))
      .then(buf => { remember(file, buf); inflight.delete(file); return buf; })
      .catch(e => { inflight.delete(file); S.err++; note('fail', null, file, String(e && e.message || e)); return null; });
    inflight.set(file, p);
    return p;
  }

  /* ---------- журнал (для тестов и пополнения озвучки) ---------- */
  const S = { req: 0, hit: 0, miss: 0, play: 0, err: 0, stop: 0, bubbleDrop: 0 };
  const log = [], missed = new Map();
  function note(ev, who, file, extra) { log.push({ t: Math.round(performance.now()), ev, who, file, extra }); if (log.length > 300) log.splice(0, 100); }

  /* ---------- воспроизведение: один голос за раз ---------- */
  let cur = null, lastLine = null;   // cur: { h, src, g, mode, endsAt }
  const queue = [];              // облачка ждут, пока договорит предыдущее
  let ducked = null;
  function duck(on) {
    const a = actx(); if (!a) return;
    ['music', 'amb'].forEach(k => {
      const b = bus(k); if (!b || !b.gain) return;
      if (on) { if (!ducked) ducked = {}; if (ducked[k] == null) ducked[k] = b.gain.value; b.gain.setTargetAtTime(ducked[k] * DUCK, a.currentTime, 0.08); }
      else if (ducked && ducked[k] != null) { b.gain.setTargetAtTime(ducked[k], a.currentTime, 0.25); }
    });
    if (!on) ducked = null;
  }
  function stopCur(fade) {
    if (!cur) return;
    const c = cur; cur = null;
    const a = actx();
    try {
      if (a && c.g) { const t = a.currentTime, f = fade == null ? 0.08 : fade; c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0.0001, t + f); c.src.stop(t + f + 0.02); }
      else if (c.src) c.src.stop();
    } catch (e) { /* уже остановлен */ }
    c.h.playing = false;
  }
  function startBuf(h, buf) {
    const a = actx(), out = bus('voice');
    if (!a || !out || h.stopped || !enabled(h.who)) return false;
    stopCur(0.06);
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf;
    const t = a.currentTime + 0.01;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(VOL, t + 0.025);
    src.connect(g); g.connect(out);
    src.onended = () => { if (cur && cur.src === src) { cur = null; h.playing = false; duck(false); next(); } };
    src.start(t);
    cur = { h, src, g, mode: h.mode, endsAt: performance.now() + buf.duration * 1000 };
    h.playing = true; S.play++; note('play', h.who, h.file);
    duck(true);
    return true;
  }
  function next() {
    while (queue.length) {
      const q = queue.shift();
      if (q.stopped || performance.now() - q.at > 2600) { S.bubbleDrop++; continue; }
      run(q); return;
    }
  }
  function run(h) {
    fetchBuf(h.file).then(buf => {
      if (h.stopped) return;
      if (!buf) { if (h.onFail) try { h.onFail(); } catch (e) { /* ignore */ } return; }
      // облачко, а в окне уже кто-то говорит — не перебиваем (облачко молча)
      if (h.mode === 'bubble' && cur && cur.mode === 'line') { S.bubbleDrop++; return; }
      if (h.mode === 'bubble' && cur && cur.mode === 'bubble') { queue.push(h); return; }
      startBuf(h, buf);
    });
  }

  // реплика: ручка, если запись есть (запись заменяет «лепет»), иначе null
  function line(who, text, o) {
    o = o || {};
    who = who || 'narrator';
    if (!enabled(who)) return null;
    if (!man) { if (!manFail) loadManifest(); return null; }
    S.req++;
    const e = lookup(who, text);
    if (!e) {
      S.miss++;
      const k = who + '|' + norm(slotName(norm(text)));
      if (!missed.has(k) && missed.size < 400) missed.set(k, { who, text: norm(slotName(norm(text))) });
      note('miss', who, null, norm(text).slice(0, 60));
      return null;
    }
    S.hit++;
    const h = { who, file: e.file, d: e.d, mode: o.mode === 'line' ? 'line' : 'bubble', onFail: o.onFail, at: performance.now(), stopped: false, playing: false,
      stop(fade) { if (h.stopped) return; h.stopped = true; S.stop++; const qi = queue.indexOf(h); if (qi >= 0) queue.splice(qi, 1); if (cur && cur.h === h) { stopCur(fade); duck(false); next(); } } };
    note('req', who, e.file);
    if (h.mode === 'line') {
      queue.length = 0;
      if (lastLine && lastLine !== h) lastLine.stopped = true;   // прежняя реплика ещё грузилась — она уже не нужна
      lastLine = h;
      if (cur && cur.h !== h) stopCur(0.06);
    }
    run(h);
    return h;
  }
  function preload(lines) {
    if (!man || !st().sound || st().voices === false) return;
    (Array.isArray(lines) ? lines : [lines]).slice(0, 4).forEach(l => {
      if (!l) return;
      const who = typeof l === 'string' ? 'narrator' : (l.who || 'narrator'), text = typeof l === 'string' ? l : l.text;
      if (!text || !enabled(who)) return;
      const e = lookup(who, text);
      if (e) fetchBuf(e.file);
    });
  }
  function stop(fade) { queue.length = 0; if (cur) { stopCur(fade); duck(false); } }

  /* ---------- iOS / Telegram: разблокировка первым касанием ---------- */
  let unlocked = false;
  function unlock() {
    if (unlocked || !st().sound) return;
    const a = actx(); if (!a) return;
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch (e) { /* ignore */ }
    try {
      if (a.state !== 'running') a.resume();
      const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0);
    } catch (e) { /* ignore */ }
    if (a.state === 'running') { unlocked = true; ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.removeEventListener(ev, unlock, true)); }
    if (!man && !manFail) loadManifest();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, true));

  /* ---------- пузырьки прогулки (town.js рисует .town-bark сам) ---------- */
  // Если town.js сам позовёт G.voiceLine(who, text) — пузырёк уже озвучен, здесь он пропускается.
  const recent = new Map();
  function speakerByName(name) {
    const sp = (G_() && G_().speakers) || {};
    for (const id in sp) { try { if (sp[id].name && sp[id].name() === name) return id; } catch (e) { /* ignore */ } }
    return null;
  }
  function barkWho(text) {
    if (!man) return null;
    const sp = (G_() && G_().speakers) || {};
    const ids = Object.keys(sp).concat(['poodle', 'owl']);
    for (const id of ids) if (lookup(id, text)) return id;
    return null;
  }
  function onBark(el) {
    const b = el.querySelector('b');
    let who = null, text = el.textContent || '';
    if (b) { who = speakerByName((b.textContent || '').replace(/:\s*$/, '').trim()); text = text.slice((b.textContent || '').length); }
    text = norm(text);
    if (!text) return;
    if (recent.has(text) && performance.now() - recent.get(text) < 1500) return;
    if (!who) who = barkWho(text);
    if (!who) return;
    line(who, text, { mode: 'bubble' });
  }
  function watchBarks() {
    const root = document.getElementById('stage');
    if (!root || !window.MutationObserver) return;
    new MutationObserver(ms => {
      if (!man || !enabled('x')) return;
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains('town-bark')) onBark(n);
        else if (n.querySelectorAll) n.querySelectorAll('.town-bark').forEach(onBark);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  /* ---------- старт ---------- */
  const boot = () => {
    watchBarks();
    // манифест (≈25 КБ) — только при включённом звуке: со звуком «выкл» игра в сеть за голосами не ходит
    // (engine.js зовёт Voice.warm(), когда звук включают)
    if (st().sound) loadManifest();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.Voice = {
    line, preload, stop, key: keyOf, warm: () => { if (!man && !manFail) loadManifest(); }, has: (who, text) => !!lookup(who || 'narrator', text), get ready() { return loadManifest(); },
    available: () => !!man, enabled, inline: () => !!INL(),
    stats: () => Object.assign({ manifest: man ? Object.keys(man.lines).length : (manFail ? -1 : 0), cached: buffers.size, playing: !!cur, queue: queue.length }, S),
    misses: () => [...missed.values()],
    markVoiced: text => recent.set(norm(text), performance.now()),
    log,
  };
})();
