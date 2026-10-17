/* =====================================================================
   ДВИЖОК: состояние, экраны, диалоги, выборы, наклейки, звук, Telegram.
   ===================================================================== */
(function () {
  const C = window.CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app'), stage = $('#stage'), hud = $('#hud'), fx = $('#fx'), layer = $('#layer');
  const esc = Art.esc;
  // «Пропустить»: если героиня уходит посреди вступления, реплики закрываются, а паузы не ждут
  let skipping = false; const cancels = new Set(), notSkipWaiters = [];
  const skipDialogs = on => {
    skipping = !!on;
    if (on) [...cancels].forEach(f => { try { f(); } catch (e) { /* ignore */ } });
    else notSkipWaiters.splice(0).forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  };
  const isSkipping = () => skipping;
  // ждёт, пока закончится окно «пропуска» после выхода (чтобы первая реплика следующего экрана не проскочила)
  const untilNotSkipping = () => (skipping ? new Promise(r => notSkipWaiters.push(r)) : Promise.resolve());
  const onSkip = f => { cancels.add(f); return () => cancels.delete(f); };
  const wait = ms => new Promise(r => setTimeout(r, skipping ? 0 : ms));

  /* ---------- Проверка настроек ---------- */
  const CFG_BAD = ['AUTHOR_NAME', 'GAME_URL'].filter(k => !C[k] || /TODO|example\./i.test(C[k]));
  if (CFG_BAD.length) console.error('[delo1010] CONFIG не заполнен:', CFG_BAD.join(', '));

  /* ---------- Telegram ---------- */
  const TG = window.Telegram && window.Telegram.WebApp;
  const inTG = !!(TG && TG.initData);
  const tgAt = v => { try { return !!(TG && TG.isVersionAtLeast && TG.isVersionAtLeast(v)); } catch (e) { return false; } };
  function tgInit() {
    if (!TG) return;
    try { TG.ready(); TG.expand(); } catch (e) { /* ignore */ }
    try { if (tgAt('7.7')) TG.disableVerticalSwipes(); } catch (e) { /* ignore */ }
    tgHeader('#FFF4EC');
  }
  function tgHeader(color) {
    try { if (inTG && tgAt('6.9')) { TG.setHeaderColor(color); TG.setBackgroundColor(color); } } catch (e) { /* ignore */ }
  }
  function setAppHeight() {
    let h = window.innerHeight;
    if (inTG && TG.viewportStableHeight) h = TG.viewportStableHeight;
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  tgInit(); setAppHeight();
  window.addEventListener('resize', setAppHeight);
  if (inTG && TG.onEvent) TG.onEvent('viewportChanged', setAppHeight);
  // Enter / пробел листают реплики на компьютере
  window.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const d = document.querySelector('#layer .dlg-wrap:not(.choice)');
    if (d) { e.preventDefault(); d.click(); }
  });
  // iOS: после закрытия клавиатуры страница может остаться сдвинутой
  document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 60));

  const hashParams = () => { try { return new URLSearchParams(location.hash.slice(1)); } catch (e) { return new URLSearchParams(); } };
  function tgUserFirstName() {
    try {
      const n = TG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.first_name;
      if (n) return n;
      const d = hashParams().get('tgWebAppData');
      const u = d && new URLSearchParams(d).get('user');
      return u ? (JSON.parse(u).first_name || '') : '';
    } catch (e) { return ''; }
  }
  function tgStartParam() {
    try {
      const sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param;
      if (sp) return sp;
      return new URLSearchParams(location.search).get('tgWebAppStartParam') || hashParams().get('tgWebAppStartParam') || '';
    } catch (e) { return ''; }
  }
  function openTgLink(url) {
    if (!url) { toast('Сценарист забыл вписать свой username. Бывает.'); return; }
    try {
      if (inTG && TG.openTelegramLink && /^https:\/\/t\.me\//.test(url)) { TG.openTelegramLink(url); return; }
    } catch (e) { /* fallthrough */ }
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Активное время (без свёрнутого приложения) ---------- */
  let away = 0, awayAt = 0;
  const goAway = () => { if (!awayAt) awayAt = Date.now(); };
  const back = () => { if (awayAt) { away += Date.now() - awayAt; awayAt = 0; } };
  document.addEventListener('visibilitychange', () => (document.hidden ? goAway() : back()));
  if (inTG && TG.onEvent) { try { TG.onEvent('deactivated', goAway); TG.onEvent('activated', back); } catch (e) { /* ignore */ } }
  const activeNow = () => Date.now() - away - (awayAt ? Date.now() - awayAt : 0);

  /* ---------- Хаптика и звук ---------- */
  function haptic(kind = 'light') {
    try {
      if (inTG && TG.HapticFeedback) {
        if (kind === 'success' || kind === 'error' || kind === 'warning') TG.HapticFeedback.notificationOccurred(kind);
        else if (kind === 'select') TG.HapticFeedback.selectionChanged();
        else TG.HapticFeedback.impactOccurred(kind);
      } else if (navigator.vibrate && kind !== 'select') navigator.vibrate(kind === 'success' ? [12, 40, 18] : 8);
    } catch (e) { /* ignore */ }
  }
  /* ---------- Звук: мягкая синтезированная палитра, «лепет» персонажей ----------
     Всё синтезируется WebAudio, файлов нет. Цепочка: группы (эффекты, голоса, музыка мест, фон) → общий
     ограничитель → выход. По умолчанию звук выключен (CONFIG.SOUND_DEFAULT), «Голоса» — отдельный переключатель
     (долгое нажатие на 🔊). sfx(kind) — те же имена, что раньше (tap, ok, wrong, sticker, reveal, drum, blip) и новые
     (door, step, chime, wave, flutter, pop, purr, meow). */
  let actx = null, BUS = null, noiseBuf = null;
  function audio() {
    if (!state.sound) return null;
    try {
      if (!actx) {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = actx.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
        const master = actx.createGain(); master.gain.value = 1;
        master.connect(comp); comp.connect(actx.destination);
        const grp = v => { const g = actx.createGain(); g.gain.value = v; g.connect(master); return g; };
        BUS = { master, sfx: grp(0.85), voice: grp(0.8), music: grp(0.55), amb: grp(0.45) };
      }
      if (actx.state !== 'running' && !document.hidden) actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  // группа для своих звуков мест (музыка пластинок, мелодии): громкость общая, через ограничитель
  function audioBus(kind = 'music') { const a = audio(); return a && BUS ? BUS[kind] || BUS.sfx : null; }
  // свёрнута игра — звук на паузе
  document.addEventListener('visibilitychange', () => { try { if (!actx) return; if (document.hidden) actx.suspend(); else if (state.sound) actx.resume(); } catch (e) { /* ignore */ } });
  const env = (g, t, vol, att, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur); };
  function osc(type, f, t, dur, vol, out, o = {}) {
    const a = actx, s = a.createOscillator(), g = a.createGain();
    s.type = type; s.frequency.setValueAtTime(f * (o.bend || 1), t);
    if (o.bend) s.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.toT || dur));
    env(g, t, vol, o.att || 0.004, dur);
    let node = s;
    if (o.lp) { const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; node.connect(f2); node = f2; }
    node.connect(g); g.connect(out); s.start(t); s.stop(t + (o.att || 0.004) + dur + 0.05);
    return s;
  }
  // калимба: основной тон и тихий негармоничный обертон, короткий «щипок»
  const kalimba = (f, t, vol, out) => { osc('sine', f, t, 0.55, vol, out, { bend: 1.006 }); osc('sine', f * 5.95, t, 0.09, vol * 0.18, out); };
  // маримба: тёплое дерево (тон + 4-й обертон, быстро гаснет)
  const marimba = (f, t, vol, out, dur = 0.38) => { osc('sine', f, t, dur, vol, out); osc('sine', f * 4, t, 0.06, vol * 0.22, out); };
  // колокольчик / музыкальная шкатулка
  const bell = (f, t, vol, out, dur = 1.1) => { osc('sine', f, t, dur, vol, out, { lp: 4200 }); osc('sine', f * 2.76, t, dur * 0.45, vol * 0.28, out, { lp: 4200 }); osc('sine', f * 5.4, t, dur * 0.2, vol * 0.1, out, { lp: 4200 }); };
  function noise(t, dur, vol, out, type, f, q = 1, f2) {
    const a = actx;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, vol, Math.min(0.06, dur * 0.3), dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1);
  }
  // кнопки: ноты пентатоники складываются в простую мелодию
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const TUNE = [0, 2, 4, 2, 3, 1, 2, 0, 4, 3, 5, 3, 2, 1];
  let tuneI = 0;
  const lastAt = {};
  function sfx(kind, o = {}) {
    if (!state.sound) return;
    const a = audio(); if (!a || !BUS) return;
    const now = a.currentTime, out = BUS.sfx;
    // без пулемёта: одинаковый звук не чаще раза в 60 мс (шаги — 120 мс)
    if (lastAt[kind] && now - lastAt[kind] < (kind === 'step' ? 0.12 : 0.06)) return;
    lastAt[kind] = now;
    const t = now + 0.005;
    const S = {
      tap: () => kalimba(PENTA[TUNE[tuneI++ % TUNE.length]], t, 0.05, out),
      ok: () => { marimba(783.99, t, 0.06, out); marimba(1046.5, t + 0.1, 0.06, out, 0.5); },
      wrong: () => { marimba(220, t, 0.055, out, 0.16); marimba(262, t + 0.13, 0.05, out, 0.22); },   // мягкое деревянное «хм?»
      sticker: () => [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(f, t + i * 0.09, 0.042, out, 0.9)),
      reveal: () => {
        [261.63, 329.63, 392].forEach(f => osc('triangle', f, t, 1.6, 0.03, out, { att: 0.18, lp: 1400 }));
        [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, t + 0.25 + i * 0.16, 0.022, out, 1.2));
      },
      drum: () => { marimba(196, t, 0.08, out, 0.3); marimba(261.63, t + 0.14, 0.07, out, 0.45); noise(t, 0.12, 0.02, out, 'bandpass', 900, 0.8); },
      blip: () => osc('sine', 520, t, 0.07, 0.035, out, { to: 880, toT: 0.05 }),
      pop: () => osc('sine', 480, t, 0.06, 0.03, out, { to: 820, toT: 0.04 }),
      flutter: () => { for (let i = 0; i < 6; i++) noise(t + i * 0.04, 0.03, 0.025, out, 'bandpass', 1300 + (i % 2) * 300, 2); },
      door: () => { noise(t, 0.55, 0.05, out, 'bandpass', 380, 0.9, 1500); bell(1318.5, t + 0.12, 0.018, out, 0.8); },
      chime: () => bell(o.f || 1174.66, t, 0.035, out, 1.0),
      step: () => {   // шаги — едва слышно: камень звонче, дерево глуше
        const wood = o.surface === 'wood', k = (tuneI++ % 2) ? 1 : 0.86;
        noise(t, wood ? 0.05 : 0.035, wood ? 0.02 : 0.014, out, wood ? 'lowpass' : 'bandpass', (wood ? 650 : 1900) * k, wood ? 0.7 : 1.6);
      },
      wave: () => { kalimba(659.25, t, 0.05, out); kalimba(880, t + 0.11, 0.05, out); bell(1760, t + 0.22, 0.012, out, 0.6); },
      purr: () => { const s = osc('sawtooth', 92, t, 0.9, 0.035, out, { att: 0.12, lp: 420 }); const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 24; lg.gain.value = 12; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + 1.1); },
      meow: () => { const s = osc('triangle', 620, t, 0.38, 0.035, out, { att: 0.03, lp: 1800, to: 880, toT: 0.12 }); s.frequency.exponentialRampToValueAtTime(520, t + 0.38); },
    };
    try { (S[kind] || S.tap)(); } catch (e) { /* звук не главное */ }
  }

  /* --- «лепет»: у каждого свой голос, по слогу на гласную (как в Animal Crossing) --- */
  // f — основной тон, sp — разброс в полутонах, w — тембр, lp — «рот» (фильтр), d — длина слога, end — куда уходит конец фразы
  const VOICES = {
    hero: { f: 300, sp: 4, w: 'triangle', lp: 2300, d: 0.07, end: 3, vol: 0.055 },            // светлый голос взрослой девушки, концы вверх
    cat: { f: 168, sp: 3, w: 'triangle', lp: 1150, d: 0.1, end: -2, vol: 0.045, purr: 26 },    // лениво и ниже, с мурчанием
    goose: { f: 240, sp: 3, w: 'sawtooth', lp: 1500, d: 0.065, end: 0, vol: 0.038, nasal: 950 },   // «га»
    raccoon: { f: 205, sp: 3, w: 'triangle', lp: 1600, d: 0.075, end: -1, vol: 0.055 },
    parrot: { f: 500, sp: 6, w: 'square', lp: 2200, d: 0.05, end: 4, vol: 0.024 },
    bunny: { f: 410, sp: 4, w: 'sine', lp: 2600, d: 0.065, end: 2, vol: 0.06 },
    fox: { f: 265, sp: 3, w: 'triangle', lp: 1900, d: 0.075, end: -1, vol: 0.055 },
    hedgehog: { f: 350, sp: 3, w: 'triangle', lp: 2100, d: 0.05, end: 1, vol: 0.05 },
    bee: { f: 470, sp: 3, w: 'sawtooth', lp: 1700, d: 0.055, end: 2, vol: 0.026, buzz: 42 },
    cinnabon: { f: 440, sp: 4, w: 'sine', lp: 2500, d: 0.06, end: 2, vol: 0.055 },
    macaron: { f: 500, sp: 4, w: 'sine', lp: 2700, d: 0.055, end: 3, vol: 0.05 },
    bubbletea: { f: 470, sp: 5, w: 'sine', lp: 2600, d: 0.055, end: 2, vol: 0.05 },
  };
  const SILENT = { narrator: 1, note: 1 };
  function voiceOf(who) {
    who = who || 'narrator';
    if (SILENT[who]) return null;
    const sp = speakers[who];
    if (sp && sp.voice === false) return null;
    if (sp && sp.voice) return Object.assign({ f: 300, sp: 3, w: 'triangle', lp: 2000, d: 0.07, end: 0, vol: 0.05 }, sp.voice);
    if (VOICES[who]) return VOICES[who];
    let h = 0; for (let i = 0; i < who.length; i++) h = (h * 31 + who.charCodeAt(i)) >>> 0;   // новый житель — свой стабильный голос
    return { f: 190 + (h % 230), sp: 3 + (h >> 3) % 3, w: (h >> 5) % 3 ? 'triangle' : 'sine', lp: 1500 + (h >> 7) % 1100, d: 0.06 + ((h >> 9) % 4) * 0.01, end: ((h >> 11) % 5) - 2, vol: 0.05 };
  }
  const VOW = { 'а': 0, 'о': -2, 'у': -4, 'ы': -3, 'э': 1, 'е': 2, 'ё': 0, 'и': 4, 'ю': -1, 'я': 1, a: 0, e: 2, i: 4, o: -2, u: -4, y: 3 };
  const VOW_LP = { 'и': 1.25, 'е': 1.15, 'э': 1.1, 'я': 1.05, i: 1.25, e: 1.15, 'у': 0.75, 'о': 0.85, 'ю': 0.8, u: 0.75, o: 0.85, 'ы': 0.9 };
  const isVowel = ch => VOW[(ch || '').toLowerCase()] !== undefined;
  let voiceN = 0;
  const voicesOff = () => !!(window.CONFIG && CONFIG.VOICES === false);   // автор выключил голоса совсем
  function babble(v, ch, k) {
    if (voicesOff() || !state.sound || state.voices === false || !v) return;
    const a = audio(); if (!a || !BUS) return;
    const lo = (ch || 'а').toLowerCase(), t = a.currentTime + 0.003;
    const jit = [0, 1, -1, 0, 2, -1, 1, 0][voiceN++ % 8];
    const semi = ((VOW[lo] || 0) * v.sp / 4) + jit + (k.name ? 2 : 0) + (k.last ? v.end : 0);
    const f = v.f * Math.pow(2, semi / 12), d = v.d * (k.last ? 1.5 : 1);
    const s = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
    s.type = v.w; s.frequency.setValueAtTime(f * 0.97, t); s.frequency.exponentialRampToValueAtTime(f * (k.last && v.end > 0 ? 1.08 : 1), t + d * 0.6);
    fl.type = 'lowpass'; fl.frequency.value = v.lp * (VOW_LP[lo] || 1); fl.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v.vol, t + 0.012); g.gain.setValueAtTime(v.vol * 0.85, t + d * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
    let node = s; node.connect(fl); node = fl;
    if (v.nasal) { const pk = a.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = v.nasal; pk.Q.value = 3; pk.gain.value = 9; node.connect(pk); node = pk; }
    node.connect(g);
    const mod = v.purr || v.buzz;
    if (mod) {   // мурчание / жужжание: лёгкая модуляция громкости
      const am = a.createGain(), l = a.createOscillator(), lg = a.createGain();
      am.gain.value = 1; l.frequency.value = mod; lg.gain.value = v.purr ? 0.35 : 0.25;
      g.connect(am); am.connect(BUS.voice); l.connect(lg); lg.connect(am.gain); l.start(t); l.stop(t + d + 0.08);
    } else g.connect(BUS.voice);
    s.start(t); s.stop(t + d + 0.08);
  }
  // голос строки: {who, text} → функция «напечатан символ i»; слоги только на гласных, не больше 24 за строку,
  // слоги имени героини — на тон выше (само имя голосом не звучит)
  // ГОЛОСА (js/voice.js): если у реплики есть запись — играет она, «лепет» молчит; запись не загрузилась — «лепет».
  // o.mode: 'line' — окно диалога (перебивает других), иначе облачко (ждёт очереди). Возвращает f(i) с f.stop(fade).
  function voiceLine(who, text, o = {}) {
    let vh = null, failed = false;
    if (voicesOff()) { const f0 = () => {}; f0.stop = () => {}; f0.voiced = false; return f0; }
    if (window.Voice && state.sound && state.voices !== false) { try { vh = Voice.line(who || 'narrator', text, { mode: o.mode || 'bubble', onFail: () => { failed = true; } }); } catch (e) { vh = null; } }
    const bab = babbleLine(who, text);
    const f = vh ? (i => { if (failed) bab(i); }) : bab;
    f.stop = fade => { if (vh) vh.stop(fade); };
    f.voiced = !!vh;
    return f;
  }
  function babbleLine(who, text) {
    const v = voiceOf(who);
    if (!v || !state.sound || state.voices === false) return () => {};
    const nm = (state.name || '').trim().toLowerCase(), low = text.toLowerCase(), inName = new Uint8Array(text.length);
    if (nm.length > 1) for (let p = low.indexOf(nm); p >= 0; p = low.indexOf(nm, p + nm.length)) inName.fill(1, p, p + nm.length);
    let lastV = -1; for (let q = text.length - 1; q >= 0; q--) if (isVowel(text[q])) { lastV = q; break; }
    let n = 0, lastT = 0;
    return i => {
      const ch = text[i];
      if (!isVowel(ch) || n >= 24) return;
      const now = performance.now();
      if (now - lastT < v.d * 900 && i !== lastV) return;
      lastT = now; n++;
      babble(v, ch, { name: !!inName[i], last: i === lastV && /[!?]\s*$/.test(text) });
    };
  }
  const soundIcon = () => (state.sound ? '🔊' : '🔇');
  function toggleSound(btn) {
    state.sound = !state.sound; save(); haptic('select');
    if (btn) btn.textContent = soundIcon();
    const hb = $('#hudSound'); if (hb) hb.textContent = soundIcon();
    if (window.HUD && HUD.topBar) HUD.topBar.refreshSound();
    if (state.sound) { audio(); sfx('ok'); if (window.Voice) Voice.warm(); } else if (window.Voice) Voice.stop(0.05);
    toast(state.sound ? 'Звук включён (на iPhone — если не стоит беззвучный режим)' + (voicesOff() ? '' : '. Долгое нажатие на 🔊 — голоса') : 'Звук выключен', 2000, { replace: true });
  }
  // кнопка звука: тап — вкл/выкл, долгое нажатие — настройки (звук, голоса)
  function bindSoundBtn(btn) {
    if (!btn) return;
    let lp = null, long = false;
    btn.addEventListener('pointerdown', () => { long = false; clearTimeout(lp); lp = setTimeout(() => { long = true; haptic('medium'); soundSheet(); }, 550); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => clearTimeout(lp)));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('click', e => { if (long) { long = false; return; } toggleSound(e.currentTarget); });
  }
  // настройки звука (долгое нажатие на 🔊): звук и голоса персонажей
  function soundSheet() {
    if (document.querySelector('#layer .snd-sheet')) return;
    const m = document.createElement('div'); m.className = 'modal snd-sheet';
    const row = (k, label, on) => `<button class="btn ${on ? '' : 'soft'} block" data-k="${k}" style="margin-top:10px">${label}: ${on ? 'вкл' : 'выкл'}</button>`;
    const draw = () => {
      m.innerHTML = `<div class="modal-card"><div class="title h3">Звук</div>
        ${row('sound', '🔊 Звук', !!state.sound)}${voicesOff() ? '' : row('voices', '💬 Голоса', state.voices !== false) + row('narr', '📖 Рассказчик', state.narr !== false && state.voices !== false)}
        ${voicesOff() ? '' : '<p class="muted tiny" style="margin-top:10px;font-weight:700">Голоса — герои говорят вслух (где записи нет — мягкий «лепет»). Рассказчик читает текст без героя.</p>'}
        <button class="btn soft block" data-k="x" style="margin-top:12px">Готово</button></div>`;
    };
    draw();
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) { if (e.target === m) m.remove(); return; }
      const k = b.dataset.k; haptic('select');
      if (k === 'x') { m.remove(); return; }
      if (k === 'sound') toggleSound(null);
      if (k === 'voices') { state.voices = state.voices === false; save(); if (state.voices && state.sound) babble(voiceOf('hero'), 'а', { last: true }); else if (window.Voice) Voice.stop(0.05); }
      if (k === 'narr') { state.narr = state.narr === false; save(); if (!state.narr && window.Voice) Voice.stop(0.05); }
      draw();
    });
    layer.appendChild(m);
  }

  /* ---------- Состояние ---------- */
  const KEY = 'delo1010_v1';
  const defaults = () => ({
    v: 1, sound: !!C.SOUND_DEFAULT,
    name: '', bow: '#F08FA8', coat: '#E9D4B6', hair: '#4A3128',
    // образ героини (js/hero_looks.js): один из шести id; null — ещё не выбран (старый сейв берёт ближайший по bow/coat)
    look: null,
    team: { bunny: '', fox: '', hedgehog: '' },
    catHelper: null, drink: null, stickers: [], finds: [], versions: {}, ratings: {}, riddles: {},
    eps: {}, // eps[1] = { cp: [...], done, start, time, recap }
    invite: null, updated: 0,
    town: null, // прогулка «Город нараспашку» (js/town.js); хранится под своим ключом delo1010_town
  });
  let state = defaults();
  let cloudRead = !inTG; // вне Telegram облака нет
  const prog = s => { const e = s && s.eps && s.eps[1]; return e ? (e.done ? 100 : 0) + (e.cp || []).length : 0; };
  const KEY_TOWN = KEY + '_town';
  // прогулка пишется отдельно: основной сейв не съедает объём прогулки (лимит облака Telegram — 4096 символов на ключ)
  const townRaw = () => {
    const t = state.town;
    if (!t || typeof t !== 'object') return null;
    const c = Object.assign({}, t); delete c.h; // h — то, что в руке: только на одну прогулку
    return JSON.stringify(c);
  };
  const mainRaw = () => { const c = Object.assign({}, state); delete c.town; return JSON.stringify(c); };
  const parseTown = raw => { try { const t = raw ? JSON.parse(raw) : null; return t && typeof t === 'object' && !Array.isArray(t) ? t : null; } catch (e) { return null; } };
  const townProg = t => (t && typeof t === 'object' ? String(t.stp || '').length * 4 + String(t.s || '').length * 2 + String(t.f || '').length + (Array.isArray(t.seen) ? t.seen.filter(Boolean).length : 0) : -1);
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(defaults(), JSON.parse(raw));
      const t = parseTown(localStorage.getItem(KEY_TOWN));
      if (t) state.town = t;
    } catch (e) { /* приватный режим */ }
  }
  function save() {
    state.updated = Date.now();
    const raw = mainRaw(), rawT = townRaw();
    if (raw.length >= 3800) console.warn('save size', raw.length);
    if (rawT && rawT.length >= 3800) console.warn('save size (town)', rawT.length);
    try { localStorage.setItem(KEY, raw); if (rawT) localStorage.setItem(KEY_TOWN, rawT); } catch (e) { /* ignore */ }
    try {
      if (inTG && TG.CloudStorage && cloudRead) {
        if (raw.length < 4000) TG.CloudStorage.setItem(KEY, raw, () => {});
        if (rawT && rawT.length < 4000) TG.CloudStorage.setItem(KEY_TOWN, rawT, () => {});
      }
    } catch (e) { /* ignore */ }
  }
  function loadCloud() {
    return new Promise(res => {
      try {
        if (!(inTG && TG.CloudStorage)) { cloudRead = true; return res(); }
        let done = false;
        const t = setTimeout(() => { if (!done) { done = true; res(); } }, 700);
        TG.CloudStorage.getItem(KEY, (err, val) => {
          let s = null;
          try { s = !err && val ? JSON.parse(val) : null; } catch (e) { s = null; }
          if (!done) {
            done = true; clearTimeout(t); cloudRead = true;
            if (s && (prog(s) > prog(state) || (prog(s) === prog(state) && (s.updated || 0) > (state.updated || 0)))) { const keepT = state.town, keepW = state.world; state = Object.assign(defaults(), s); if (!state.town) state.town = keepT; if (!state.world && keepW) state.world = keepW; }
            res();
          } else if (!s || prog(s) <= prog(state)) cloudRead = true; // иначе облако не трогаем до следующего запуска
        });
        // прогулка — отдельным ключом; берём облачную, если в ней больше прогресса
        TG.CloudStorage.getItem(KEY_TOWN, (err, val) => {
          const t = !err ? parseTown(val) : null;
          if (t && townProg(t) > townProg(state.town)) state.town = t;
        });
      } catch (e) { res(); }
    });
  }
  load();
  // образ героини: всегда один из шести id (st.look, иначе ближайший по старым цветам, иначе образ по умолчанию)
  const LK = () => window.HeroLooks || null;
  // стенды: ?debug=1&look=<id> — показать образ, не трогая сейв (в --prod отладка вырезана)
  const dbgLook = () => { try { const q = new URLSearchParams(location.search).get('look'); return /[?&]debug=1/.test(location.search) && LK() && LK().valid(q) ? q : null; } catch (e) { return null; } };
  function look() { const H = LK(); return dbgLook() || (H ? H.current(state) : 'suede'); }
  // смена образа: старые bow/coat/hair тоже пишутся (старые сборки и читатели видят близкий цвет); событие herolook — 3D/2D
  function setLook(id, o = {}) {
    const H = LK();
    if (!H || !H.valid(id)) return false;
    state.look = id; Object.assign(state, H.legacy(id));
    if (o.save !== false) save();
    try { window.dispatchEvent(new CustomEvent('herolook', { detail: { id } })); } catch (e) { /* ignore */ }
    return true;
  }
  function resetAll() {
    state = defaults();
    try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_TOWN); } catch (e) { /* ignore */ }
    try { if (inTG && TG.CloudStorage) { TG.CloudStorage.removeItem(KEY, () => {}); TG.CloudStorage.removeItem(KEY_TOWN, () => {}); } } catch (e) { /* ignore */ }
    cloudRead = true;
  }
  function wantsReset() {
    try {
      if (sessionStorage.getItem('delo_reset_done')) return false;
      return new URLSearchParams(location.search).get('reset') === '1' || tgStartParam() === 'reset';
    } catch (e) { return false; }
  }
  function markResetDone() {
    try { sessionStorage.setItem('delo_reset_done', '1'); } catch (e) { /* ignore */ }
    try { if (!inTG) history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
  }

  const team = {
    bunny: { def: 'Зайка', role: 'кондитер, эксперт по десертам', title: 'кондитер', art: o => Art.bunny(o) },
    fox: { def: 'Лиса', role: 'архивариус, знаток всех слов', title: 'архивариус', art: o => Art.fox(o) },
    hedgehog: { def: 'Ёжик', role: 'звукорежиссёр с абсолютным слухом', title: 'звукорежиссёр', art: o => Art.hedgehog(o) },
  };
  const teamName = k => (state.team[k] || '').trim() || team[k].def;
  const herName = () => (state.name || '').trim() || 'Следователь';

  /* ---------- Говорящие ---------- */
  const speakers = {
    hero: { name: () => herName(), art: () => Art.heroine({ crop: true, look: look(), bow: state.bow, coat: state.coat, hair: state.hair }) },
    cat: { name: () => 'Пирожок', art: () => Art.cat({ crop: true }) },
    raccoon: { name: () => 'Енот-киномеханик', art: () => Art.raccoon({ crop: true }) },
    parrot: { name: () => 'Попугай-стажёр', art: () => Art.parrot({ crop: true }) },
    goose: { name: () => 'Гусь Финалыч', art: () => Art.goose({ crop: true, popcorn: false }) },
    bunny: { name: () => teamName('bunny'), art: () => Art.bunny({ crop: true }) },
    fox: { name: () => teamName('fox'), art: () => Art.fox({ crop: true }) },
    hedgehog: { name: () => teamName('hedgehog'), art: () => Art.hedgehog({ crop: true }) },
    cinnabon: { name: () => 'Булочка', art: () => Art.cinnabon() },
    macaron: { name: () => 'Макарон', art: () => Art.macaron() },
    bubbletea: { name: () => 'Бабл-ти', art: () => Art.bubbletea() },
    bee: { name: () => 'Пчёлка Жу, флористка', art: () => Art.bee({ crop: true }) },
    note: { name: () => 'Записка', art: null, note: true },
    narrator: { name: () => '', art: null },
  };
  // места прогулки регистрируют своих говорящих сами
  const addSpeakers = o => Object.assign(speakers, o || {});
  // круглый значок с эмодзи — аватар для новых героев
  const emojiAvatar = (emoji, bg = '#FBE1E7') => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${esc(bg)}"/><circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/><text x="50" y="55" font-size="52" text-anchor="middle" dominant-baseline="middle">${esc(emoji)}</text></svg>`;

  /* ---------- Экраны ---------- */
  function show(html, cls = '') {
    const old = stage.querySelectorAll('.screen:not(.out)');
    const s = document.createElement('div');
    s.className = 'screen ' + cls;
    s.innerHTML = html;
    stage.appendChild(s);
    old.forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 320); });
    return s;
  }
  function tapOnce(el) {
    return new Promise(res => {
      const h = e => { e.stopPropagation(); el.removeEventListener('click', h); haptic('light'); sfx('tap'); res(e); };
      el.addEventListener('click', h);
    });
  }

  /* ---------- Диалоги ---------- */
  function dlgHead(sp) {
    const nm = sp.name();
    if (!sp.art && !nm) return '';
    return `<div class="dlg-head">${sp.art ? `<div class="dlg-ava">${sp.art()}</div>` : ''}${nm ? `<div class="dlg-name">${esc(nm)}</div>` : ''}</div>`;
  }
  function sayOne(line) {
    if (skipping) return Promise.resolve();
    return new Promise(res => {
      const sp = speakers[line.who || 'narrator'] || speakers.narrator;
      const wrap = document.createElement('div');
      wrap.className = 'dlg-wrap';
      wrap.innerHTML = `<div class="dlg">${dlgHead(sp)}<div class="dlg-text ${sp.note ? 'note' : ''} ${sp.italic || line.italic ? 'italic' : ''}"></div><div class="dlg-more hidden">▾</div></div>`;
      layer.appendChild(wrap);
      const tx = wrap.querySelector('.dlg-text'), more = wrap.querySelector('.dlg-more');
      const text = line.text;
      let i = 0, typing = true, timer;
      const speed = line.fast ? 12 : 22, voice = voiceLine(line.who, text, { mode: 'line' });   // голос или лепет; закрыть реплику — голос гаснет
      const tick = () => {
        i += 1;
        tx.textContent = text.slice(0, i);
        voice(i - 1);
        if (i >= text.length) { typing = false; more.classList.remove('hidden'); return; }
        timer = setTimeout(tick, /[.,!?…—:]/.test(text[i - 1]) ? speed * 5 : speed);
      };
      tick();
      const off = onSkip(() => { clearTimeout(timer); voice.stop(0.05); off(); wrap.remove(); res(); });
      wrap.addEventListener('click', () => {
        if (typing) { clearTimeout(timer); typing = false; tx.textContent = text; more.classList.remove('hidden'); return; }
        haptic('select');
        voice.stop(0.08); off(); wrap.remove(); res();
      });
    });
  }
  async function say(lines) {
    if (!Array.isArray(lines)) lines = [lines];
    if (window.Voice) { try { Voice.preload(lines); } catch (e) { /* ignore */ } }
    for (let k = 0; k < lines.length; k++) {
      if (skipping) break;
      if (k && window.Voice) { try { Voice.preload(lines.slice(k + 1, k + 3)); } catch (e) { /* ignore */ } }
      const l = lines[k];
      await sayOne(typeof l === 'string' ? { text: l } : l);
    }
  }
  function choose(prompt, options, opts = {}) {
    return new Promise(res => {
      const sp = speakers[opts.who || 'narrator'] || speakers.narrator;
      const wrap = document.createElement('div');
      wrap.className = 'dlg-wrap choice';
      wrap.innerHTML = `<div class="dlg">${dlgHead(sp)}${prompt ? `<div class="dlg-text">${esc(prompt)}</div>` : ''}<div class="dlg-choices"></div></div>`;
      const box = wrap.querySelector('.dlg-choices');
      let picked = false;
      const vq = prompt ? voiceLine(opts.who || 'narrator', prompt, { mode: 'line' }) : null;
      // выход посреди выбора (кнопка HUD): окно убираем, ответ — null
      const off = onSkip(() => { if (picked) return; picked = true; if (vq) vq.stop(0.05); off(); wrap.remove(); res(null); });
      options.forEach((o, idx) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (o.cls || (idx === 0 ? '' : 'soft'));
        b.textContent = o.label;
        b.addEventListener('click', e => {
          e.stopPropagation();
          if (picked) return; picked = true; off();
          if (vq) vq.stop(0.1);
          haptic('light'); sfx('tap');
          wrap.remove(); res(o.value !== undefined ? o.value : o.label);
        });
        box.appendChild(b);
      });
      layer.appendChild(wrap);
    });
  }
  function ask(prompt, opts = {}) {
    return new Promise(res => {
      const sp = speakers[opts.who || 'narrator'] || speakers.narrator;
      const wrap = document.createElement('div');
      wrap.className = 'dlg-wrap choice';
      wrap.innerHTML = `
        <div class="dlg">${dlgHead(sp)}
          <div class="dlg-text">${esc(prompt)}</div>
          <div class="dlg-input"><input type="text" maxlength="${opts.max || 60}" placeholder="${esc(opts.placeholder || '')}" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false"/><button class="btn">${esc(opts.ok || 'Готово')}</button></div>
          ${opts.skip ? `<div style="text-align:center"><button class="link">${esc(opts.skip)}</button></div>` : ''}
        </div>`;
      const inp = wrap.querySelector('input'), ok = wrap.querySelector('.btn'), sk = wrap.querySelector('.link');
      const vv = window.visualViewport;
      const fit = () => { if (!vv) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); wrap.style.paddingBottom = `calc(${kb + 14}px + var(--safe-bottom))`; };
      if (vv) vv.addEventListener('resize', fit);
      let fin = false;
      const vq = prompt ? voiceLine(opts.who || 'narrator', prompt, { mode: 'line' }) : null;
      const done = v => {
        if (fin) return; fin = true;
        if (vq) vq.stop(0.1);
        haptic('light'); sfx('tap'); inp.blur();
        if (vv) vv.removeEventListener('resize', fit);
        wrap.remove(); window.scrollTo(0, 0); res(v);
      };
      ok.addEventListener('click', () => { const v = inp.value.trim(); if (v) done(v); else inp.focus(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = inp.value.trim(); if (v) done(v); } });
      if (sk) sk.addEventListener('click', () => done(''));
      layer.appendChild(wrap);
      try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Тосты, «подозрительность», частицы ---------- */
  // HUD v2 (plan2/hud_spec.md §3.3): один тост за раз, по центру под верхней полосой (место — CSS, токен --hud-bar-b).
  // По умолчанию — очередь: текущий держится не меньше 1,4 с, ждут не больше трёх (лишний старый выпадает), новый никогда
  // не стирает текущий. { replace: true } — заменить сразу («Звук выключен» и т. п.). { kind: 'place' | 'sticker' | 'sus' } —
  // вид: название места при въезде (вторая строка текста — подпись), наклейка, шкала «Подозрительность».
  // Время: 1,2 с + 40 мс на знак, от 2,5 до 3,5 с (длинный текст — до 4,5 с).
  const TQ = []; let tCur = null;
  function toastMs(text, ms) {
    const n = String(text).length, cap = n > 64 ? 4500 : 3500;
    return Math.max(2500, Math.min(cap, Math.max(ms || 0, 1200 + 40 * n)));
  }
  function toastShow(item) {
    const t = document.createElement('div'); t.className = 'toast' + (item.kind ? ' ' + item.kind : '');
    t.setAttribute('role', 'status');
    if (item.kind === 'place') {
      const [ttl, sub] = String(item.text).split('\n');
      t.textContent = ttl;
      if (sub || item.sub) { const sp = document.createElement('span'); sp.className = 'sub'; sp.textContent = sub || item.sub; t.appendChild(sp); }
    } else if (item.html) t.innerHTML = item.html; else t.textContent = item.text;
    app.appendChild(t);
    const cur = { el: t, at: Date.now(), ms: item.ms, timer: 0 };
    tCur = cur;
    const end = () => {
      if (tCur === cur) tCur = null;
      t.classList.add('out'); setTimeout(() => t.remove(), 320);
      if (!tCur && TQ.length) toastShow(TQ.shift());
    };
    cur.end = end;
    cur.timer = setTimeout(end, TQ.length ? Math.min(item.ms, 1400) : item.ms);
    if (item.onShow) { try { item.onShow(); } catch (e) { /* ignore */ } }
  }
  function toast(text, ms = 2600, o = {}) {
    if (text == null || text === '') return;
    ms = toastMs(text, ms);
    const item = { text, ms, kind: o.kind || '', sub: o.sub || '', html: o.html || '', onShow: o.onShow };
    if (o.replace || o.queue === false) {
      if (tCur) { clearTimeout(tCur.timer); tCur = null; }
      TQ.length = 0;
      app.querySelectorAll('.toast').forEach(t => t.remove());
      toastShow(item);
      return;
    }
    if (!tCur) { toastShow(item); return; }
    // тот же текст уже на экране или в очереди — не повторять
    if (tCur.el.textContent === String(text) || TQ.some(q => q.text === text)) return;
    if (TQ.length >= 3) TQ.shift();
    TQ.push(item);
    // кто-то ждёт — текущий уступает, но не раньше чем через 1,4 с после появления
    const c = tCur; clearTimeout(c.timer);
    c.timer = setTimeout(c.end, Math.max(0, Math.min(c.ms, 1400) - (Date.now() - c.at)));
  }
  // шкала серии 1 — строкой тоста (тем же местом под полосой)
  function suspicion(pct, caption) {
    if (C.ENABLE_SUSPICION_METER === false) return;
    toast(`Подозрительность: ${pct}%. ${caption}`, 3400, { kind: 'sus', html: `Подозрительность: <b>${esc(String(pct))}%</b>. ${esc(caption)}` });
  }
  const SPARK = {
    star: c => `<svg viewBox="0 0 20 20"><path d="M10,0 L12.5,7.5 L20,10 L12.5,12.5 L10,20 L7.5,12.5 L0,10 L7.5,7.5 Z" fill="${c}"/></svg>`,
    heart: c => `<svg viewBox="0 0 20 20"><path d="M10,18 C2,12 1,6 5,3.6 C7.4,2.2 9.2,3.6 10,5.2 C10.8,3.6 12.6,2.2 15,3.6 C19,6 18,12 10,18 Z" fill="${c}"/></svg>`,
  };
  function sparkle(x, y, opts = {}) {
    const n = opts.n || 12, colors = opts.colors || ['#FFD25E', '#F08FA8', '#BFE6D3', '#B9A5E8', '#FFFFFF'];
    const r = app.getBoundingClientRect();
    if (x === undefined) { x = r.width / 2; y = r.height / 2; }
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'); s.className = 'spark';
      const kind = opts.kind || (i % 3 === 0 ? 'heart' : 'star');
      s.innerHTML = SPARK[kind](colors[i % colors.length]);
      const ang = (Math.PI * 2 * i) / n + Math.random() * .5, dist = (opts.dist || 70) + Math.random() * 40;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 20 + 'px');
      s.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
      const sz = 10 + Math.random() * 10; s.style.width = s.style.height = sz + 'px';
      fx.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
  function sparkleAt(el, opts) {
    const a = app.getBoundingClientRect(), b = el.getBoundingClientRect();
    sparkle(b.left - a.left + b.width / 2, b.top - a.top + b.height / 2, opts);
  }
  function confetti() {
    const r = app.getBoundingClientRect();
    for (let k = 0; k < 4; k++) setTimeout(() => sparkle(r.width * (.2 + .2 * k), r.height * .35, { n: 14, dist: 110 }), k * 120);
  }

  /* ---------- HUD и блокнот ---------- */
  const STICKERS = {
    film: { title: 'Засвеченная плёнка', art: () => Art.stFilm(), ep: 1 },
    scroll: { title: 'Свиток из шкафа', art: () => Art.stScroll(), ep: 1 },
    desserts: { title: 'Показания десертов', art: () => Art.stDesserts(), ep: 1 },
    note: { title: 'Записка с чашкой', art: () => Art.stNote(), ep: 1 },
    secret: { title: 'Секретная улика', art: () => Art.stSecret(), ep: 1, secret: true },
    pockets: { title: 'Бездонные карманы', art: () => Art.stPockets(), ep: 1, secret: true },
    // наклейки прогулки: только в «Паспорте города», не в слотах сезона
    citizen: { title: 'Почётная горожанка', art: () => stCitizen(), ep: 0, secret: true, town: true },
    sleuth: { title: 'Лупа на всё', art: () => stSleuth(), ep: 0, secret: true, town: true },
  };
  function stCitizen() {
    let edge = '';
    for (let i = 0; i < 9; i++) { const k = 12 + i * 9.5; edge += `<circle cx="${k}" cy="8" r="3.2"/><circle cx="${k}" cy="92" r="3.2"/><circle cx="8" cy="${k}" r="3.2"/><circle cx="92" cy="${k}" r="3.2"/>`; }
    return `<svg viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="4" fill="#FFFDF9"/><g fill="#fff">${edge}</g><rect x="14" y="14" width="72" height="72" rx="6" fill="#FBE1E7"/>
      <path d="M30,74 L30,50 L50,34 L70,50 L70,74 Z" fill="#FFF1A8" stroke="#3A2E3F" stroke-width="2.4" stroke-linejoin="round"/><path d="M26,52 L50,31 L74,52" fill="none" stroke="#C2405B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="44" y="58" width="12" height="16" rx="6" fill="#C2405B"/><rect x="34" y="54" width="7" height="7" rx="1.5" fill="#BFE6D3"/><rect x="59" y="54" width="7" height="7" rx="1.5" fill="#BFE6D3"/>
      <path d="M50,24 C44,16 34,18 38,25 C40,28 46,26 50,24 C54,26 60,28 62,25 C66,18 56,16 50,24 Z" fill="#F08FA8" stroke="#C2405B" stroke-width="1.6"/><circle cx="50" cy="24" r="3" fill="#C2405B"/></svg>`;
  }
  function stSleuth() {
    return `<svg viewBox="0 0 100 100"><circle cx="42" cy="42" r="24" fill="#E8F4FF" stroke="#3A2E3F" stroke-width="6"/><circle cx="42" cy="42" r="24" fill="none" stroke="#C9A24A" stroke-width="2.4"/>
      <path d="M34,32 Q40,26 48,28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M60,60 L82,82" stroke="#3A2E3F" stroke-width="11" stroke-linecap="round"/><path d="M61,61 L80,80" stroke="#B98C6A" stroke-width="6" stroke-linecap="round"/>
      <path d="M42,14 C34,4 22,8 28,15 C31,18 38,16 42,14 C46,16 53,18 56,15 C62,8 50,4 42,14 Z" fill="#F08FA8" stroke="#C2405B" stroke-width="1.6"/><circle cx="42" cy="14" r="3" fill="#C2405B"/></svg>`;
  }
  // по два места под улики каждой будущей серии
  const SEASON_SLOTS = ['film', 'scroll', 'desserts', 'note', 'secret', 'pockets']
    .concat(C.EPISODES.filter(e => e.n > 1).flatMap(e => [`${e.n}a`, `${e.n}b`]));

  // opts: { label, onExit, exitText = '← на улицу', top, hidden } и HUD v2: exitPlace ('menu' | 'bar'; по умолчанию «на улицу» —
  // 🚪 в правом слоте полосы, остальное — строкой меню ☰), menuSub (строка под заголовком меню), status, menu: [строки]
  // Полосу рисует js/world/hud.js (HUD.topBar): ☰ · цель · один значок. Без модуля — та же полоса попроще: ☰ (блокнот) · выход/звук.
  function setHud(opts = {}) {
    if (opts.hidden) {
      hud.classList.add('hidden'); hud.classList.remove('hud-top');
      if (window.HUD && HUD.objective) HUD.objective.set(null);
      return;
    }
    hud.classList.remove('hidden');
    if (window.HUD && HUD.topBar) {
      if (window.HUD.objective && !('objective' in opts)) HUD.objective.set(null);
      HUD.topBar.render(hud, opts);
      if ('objective' in opts && HUD.objective) HUD.objective.set(opts.objective);
      return;
    }
    hud.classList.add('hud2');
    hud.classList.toggle('hud-top', opts.top !== undefined ? !!opts.top : !!opts.onExit);
    hud.innerHTML = `<button class="hud-ib" id="hudMenu" type="button" aria-label="Блокнот">📒</button><div class="hud-sp"></div><div id="hudStatus">${opts.onExit
      ? `<button class="hud-ib exit" id="hudExit" type="button" aria-label="${esc(String(opts.exitText || '← на улицу').replace(/^[←\s]+/, ''))}">🚪</button>`
      : `<button class="hud-ib" id="hudSound" type="button" aria-label="Звук">${soundIcon()}</button>`}</div>`;
    if (opts.onExit) $('#hudExit').addEventListener('click', () => { haptic('light'); opts.onExit(); });
    else bindSoundBtn($('#hudSound'));
    $('#hudMenu').addEventListener('click', () => { haptic('light'); notebook(); });
  }
  const nbCount = () => {
    let n = state.stickers.length + (Array.isArray(state.finds) ? state.finds.length : 0);
    try { if (window.G && window.G.nbExtraCount) n += Math.max(0, window.G.nbExtraCount() || 0); } catch (e) { /* ignore */ }
    return n;
  };
  // новое в блокноте: точка на ☰ (строка «Блокнот» в меню — со счётчиком); quiet — только счётчик, без точки
  function bumpNb(quiet) {
    if (window.HUD && HUD.menu) HUD.menu.redraw();
    const b = $('#hudMenu'); if (!b) return;
    if (quiet) return;
    if (window.HUD && HUD.menu) HUD.menu.news('nb', true);
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
  function stickerModal(id, caption, had) {
    return new Promise(res => {
      const st = STICKERS[id];
      const m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = `
        <div class="modal-card">
          <div class="tiny muted" style="font-weight:900;letter-spacing:.12em;text-transform:uppercase">${had ? 'Уже в блокноте' : 'Новая находка'}</div>
          <div style="margin:14px 0 10px"><div class="sticker big">${st.art()}</div></div>
          <div class="title h3">${esc(st.title)}</div>
          ${caption ? `<p class="muted" style="margin-top:6px;font-weight:700">${esc(caption)}</p>` : ''}
          <button class="btn block" style="margin-top:16px">${had ? 'Дальше' : 'В блокнот'}</button>
        </div>`;
      layer.appendChild(m);
      haptic('success'); if (!had) sfx('sticker');
      setTimeout(() => sparkleAt(m.querySelector('.sticker'), { n: 14, dist: 90 }), 250);
      let closed = false;
      m.querySelector('.btn').addEventListener('click', () => {
        if (closed) return; closed = true;
        haptic('light');
        const stEl = m.querySelector('.sticker'), nb = $('#hudMenu');
        if (nb && !had) {
          const a = stEl.getBoundingClientRect(), b = nb.getBoundingClientRect();
          stEl.classList.add('fly');
          stEl.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.15) rotate(20deg)`;
          stEl.style.opacity = '.4';
        }
        setTimeout(() => { m.classList.add('out'); setTimeout(() => { m.remove(); bumpNb(); res(); }, 250); }, nb && !had ? 650 : 0);
      });
    });
  }
  // Находки с улицы: «Карманы следователя» (не улики, просто милые вещи)
  const FINDS = [];
  function registerFinds(list) { list.forEach(f => { if (!FINDS.some(x => x.id === f.id)) FINDS.push(f); }); }
  function giveFind(id) {
    if (!Array.isArray(state.finds)) state.finds = [];
    const isNew = !state.finds.includes(id);
    if (isNew) { state.finds.push(id); save(); bumpNb(); }
    return { isNew, got: FINDS.filter(f => state.finds.includes(f.id)).length, total: FINDS.length };
  }
  async function giveSticker(id, caption) {
    const had = state.stickers.includes(id);
    if (!had) { state.stickers.push(id); save(); }
    await stickerModal(id, caption, had);
  }

  function notebook() {
    const m = document.createElement('div'); m.className = 'modal';
    const slots = SEASON_SLOTS.map((k, i) => {
      const st = STICKERS[k];
      const got = st && state.stickers.includes(k);
      const r = ((i * 37) % 9) - 4;
      if (got) return `<div class="nb-slot got" style="--r:${r}deg">${st.art()}<div class="cap">${esc(st.title)}</div></div>`;
      if (st && st.secret) return `<div class="nb-slot">✦</div>`;
      return `<div class="nb-slot">${st ? '1' : esc(k.replace(/[ab]$/, ''))}</div>`;
    }).join('');
    m.innerHTML = `
      <div class="modal-card" style="text-align:left">
        <div class="row" style="justify-content:space-between">
          <div><div class="title h2">Блокнот</div><div class="small muted" style="font-weight:800">следователь ${esc(herName())}</div></div>
          <button class="hud-btn" data-x aria-label="Закрыть">✕</button>
        </div>
        <div class="nb-grid">${slots}</div>
        <p class="small muted" style="margin-top:22px;font-weight:700">Цифры — номера серий. Секретная улика прячется где-то в городе.</p>
        ${FINDS.length ? `<div class="nb-sub">Карманы следователя <span>${FINDS.every(f => (state.finds || []).includes(f.id)) ? 'полный комплект ✦' : `${FINDS.filter(f => (state.finds || []).includes(f.id)).length}/${FINDS.length}`}</span></div>
        <div class="nb-finds">${FINDS.map((f, i) => (state.finds || []).includes(f.id)
          ? `<button class="nb-find got" data-f="${f.id}" style="--r:${((i * 53) % 9) - 4}deg">${f.art()}<div class="cap">${esc(f.title)}</div></button>`
          : `<div class="nb-find">?</div>`).join('')}</div>
        <p class="small muted" style="margin-top:20px;font-weight:700">Находки лежат на улице. Нажми на находку — прочитаешь подпись.</p>` : ''}
        ${(() => { try { return window.G.nbExtras ? window.G.nbExtras() || '' : ''; } catch (e) { console.warn('nbExtras', e); return ''; } })()}
        <button class="btn block powder" data-save style="margin-top:14px">Сохранить картинку блокнота</button>
      </div>`;
    layer.appendChild(m);
    const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 250); };
    m.querySelector('[data-x]').addEventListener('click', close);
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelector('[data-save]').addEventListener('click', () => { haptic('light'); exportNotebook(); });
    m.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      const f = FINDS.find(x => x.id === b.dataset.f); if (!f) return;
      haptic('light'); sparkleAt(b, { kind: 'heart', n: 5, dist: 30 }); toast(typeof f.cap === 'function' ? f.cap() : f.cap, 3600);
    }));
    try { if (window.G.nbBind) window.G.nbBind(m); } catch (e) { console.warn('nbBind', e); }
    bumpNb(true);
  }

  /* ---------- Экспорт картинки блокнота ---------- */
  function svgToImg(svgStr) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      let s = svgStr;
      if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  let exporting = false;
  async function exportNotebook() {
    if (exporting) return; exporting = true;
    try {
      toast('Рисуем блокнот…', 1400);
      try { await Promise.all(['700 64px Caveat', '900 34px Nunito', '800 26px Nunito', '700 40px Comfortaa'].map(f => document.fonts.load(f, 'Аб' + herName()))); } catch (e) { /* ignore */ }
      const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FCE4EA'); g.addColorStop(1, '#FFF4EC');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFFDF9'; roundRect(c, 70, 150, W - 140, H - 300, 48); c.fill();
      c.strokeStyle = '#EEF1F6'; c.lineWidth = 2;
      for (let y = 230; y < H - 170; y += 44) { c.beginPath(); c.moveTo(100, y); c.lineTo(W - 100, y); c.stroke(); }
      for (let x = 100; x < W - 100; x += 44) { c.beginPath(); c.moveTo(x, 190); c.lineTo(x, H - 170); c.stroke(); }
      c.fillStyle = 'rgba(247,201,211,.9)'; c.save(); c.translate(W / 2, 150); c.rotate(-.04); c.fillRect(-120, -26, 240, 52); c.restore();
      c.fillStyle = '#C2405B'; c.textAlign = 'center';
      c.font = '700 40px Comfortaa, Nunito, sans-serif'; c.fillText('ДЕЛО № 10/10', W / 2, 290);
      c.fillStyle = '#3A2E3F'; c.font = '900 34px Nunito, sans-serif'; c.fillText('Блокнот следователя', W / 2, 345);
      c.font = '700 64px Caveat, Nunito, sans-serif'; c.fillStyle = '#4A3A55'; c.fillText(herName(), W / 2, 440, W - 200);
      // героиня по рисунку — сразу растром (SVG с вложенной картинкой Safari рисует на canvas ненадёжно); кадр 120×188 без растяжения
      const lk = { look: look(), bow: state.bow, coat: state.coat, hair: state.hair, mood: 'happy', magnifier: true };
      const hero = (Art.heroineRaster && await Art.heroineRaster(lk)) || await svgToImg(Art.heroine(lk));
      if (hero) c.drawImage(hero, W / 2 - 154, 470, 308, 482);
      const got = SEASON_SLOTS.filter(k => STICKERS[k] && state.stickers.includes(k));
      let i = 0;
      for (const k of got) {
        const im = await svgToImg(STICKERS[k].art());
        const col = i % 3, row = Math.floor(i / 3);
        const x = 160 + col * 270, y = 1010 + row * 300;
        c.save(); c.translate(x + 110, y + 110); c.rotate((((i * 37) % 9) - 4) * Math.PI / 180);
        c.fillStyle = '#fff'; c.shadowColor = 'rgba(58,46,63,.15)'; c.shadowBlur = 20; c.shadowOffsetY = 8;
        roundRect(c, -110, -110, 220, 220, 44); c.fill(); c.shadowColor = 'transparent';
        if (im) c.drawImage(im, -90, -90, 180, 180);
        c.restore();
        c.fillStyle = '#6E6272'; c.font = '800 26px Nunito, sans-serif'; c.fillText(STICKERS[k].title, x + 110, y + 260, 250);
        i++;
      }
      const ep = state.eps[1];
      c.fillStyle = '#3A2E3F'; c.font = '900 32px Nunito, sans-serif';
      const line = ep && ep.recap ? 'Серия\u00A01: краткий пересказ' : ep && ep.done ? `Серия\u00A01 пройдена за ${fmtTime(ep.time || 0)}` : 'Серия\u00A01: расследование идёт';
      c.fillText(line, W / 2, H - 230);
      try {
        const tl = window.Town && Town.exportLine ? Town.exportLine() : '';
        if (tl) { c.fillStyle = '#6E6272'; c.font = '800 28px Nunito, sans-serif'; c.fillText(tl, W / 2, H - 282, W - 200); }
      } catch (e) { /* ignore */ }
      if (state.ratings[1]) { c.fillStyle = '#C2405B'; c.font = '700 40px Comfortaa, Nunito, sans-serif'; c.fillText(`Оценка серии: ${state.ratings[1]}/10`, W / 2, H - 175); }
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (!blob) throw new Error('no blob');
      try {
        const file = new File([blob], 'delo-10-10.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Дело № 10/10' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      const url = URL.createObjectURL(blob);
      const ov = document.createElement('div'); ov.className = 'img-full';
      ov.innerHTML = `<img src="${url}" alt="Блокнот"/><div style="font-weight:800">${inTG ? 'Сделай скриншот: картинка уже под размер экрана' : 'Удержи палец на картинке, чтобы сохранить'}</div><button class="btn soft" style="position:absolute;top:calc(12px + var(--safe-top));right:12px;min-height:44px;padding:8px 14px">✕</button>`;
      app.appendChild(ov);
      ov.querySelector('.btn').addEventListener('click', () => { ov.remove(); URL.revokeObjectURL(url); });
    } catch (e) {
      toast('Не получилось нарисовать. Сделай скриншот блокнота', 3000);
    } finally { exporting = false; }
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  /* ---------- Чекпоинты серий ---------- */
  function ep(n) { if (!state.eps[n]) state.eps[n] = { cp: [], done: false, start: 0, time: 0 }; return state.eps[n]; }
  async function step(n, id, fn) {
    const e = ep(n);
    if (e.cp.includes(id)) return;
    await fn();
    if (!e.cp.includes(id)) e.cp.push(id);
    save();
  }

  /* ---------- Ссылки ---------- */
  function b64url(str) {
    const bytes = new TextEncoder().encode(str); let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const clip = (s, n) => Array.from(String(s || '').replace(/\|/g, ' ').trim()).slice(0, n).join('').trim();
  function inviteLink(role, friend) {
    let nm = clip(friend, 12), from = clip(state.name, 12);
    const r = { bunny: 'b', fox: 'f', hedgehog: 'h' }[role];
    if (C.MINIAPP_URL) {
      let p = b64url(`${nm}|${from}`);
      while (p.length > 62 && (nm || from)) {
        nm = Array.from(nm).slice(0, -1).join('');
        from = Array.from(from).slice(0, -1).join('');
        p = b64url(`${nm}|${from}`);
      }
      return `${C.MINIAPP_URL.replace(/\/$/, '')}?startapp=${r}_${p}`;
    }
    const u = new URL(C.GAME_URL && !CFG_BAD.includes('GAME_URL') ? C.GAME_URL : (location.origin + location.pathname));
    u.hash = ''; u.search = '';
    u.searchParams.set('r', r); if (nm) u.searchParams.set('n', nm); if (from) u.searchParams.set('f', from);
    return u.toString();
  }
  function readInvite() {
    try {
      const roleOf = { b: 'bunny', f: 'fox', h: 'hedgehog' };
      const sp = tgStartParam();
      if (sp && /^[bfh]_/.test(sp)) {
        const [nm, from] = unb64url(sp.slice(2)).split('|');
        return { role: roleOf[sp[0]], name: clip(nm, 16), from: clip(from, 16) };
      }
      const q = new URLSearchParams(location.search);
      if (q.get('r') && roleOf[q.get('r')]) return { role: roleOf[q.get('r')], name: clip(q.get('n'), 16), from: clip(q.get('f'), 16) };
    } catch (e) { /* ignore */ }
    return null;
  }
  function shareLink(url, text) {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  }
  function releaseDate(epObj) { const [y, m, d] = epObj.release.split('-').map(Number); return new Date(y, m - 1, d); }
  function isReleased(epObj) { const t = new Date(); t.setHours(0, 0, 0, 0); return releaseDate(epObj) <= t; }

  /* ---------- «Помахать» ----------
     Героиня машет: в облачке героини «Hi, I'm {имя}!» (имя только текстом, голосом не звучит). После первого раза
     жители могут звать героиню по имени: G.waved() — уже знакомилась, G.onWave(cb) — подписка: cb(info) может вернуть
     ответ жителя (строку) вместо обычного. G.nameOk() — общий ограничитель имени: не чаще раза в ~2 минуты. */
  const waveCbs = [];
  let nameAt = 0;
  const waved = () => !!state.waved;
  function onWave(cb) { if (typeof cb === 'function') waveCbs.push(cb); return () => { const i = waveCbs.indexOf(cb); if (i >= 0) waveCbs.splice(i, 1); }; }
  function nameOk(peek) { const t = Date.now(); if (t - nameAt < 120000) return false; if (!peek) nameAt = t; return true; }
  const heroHi = () => { const nm = (state.name || '').trim(); return nm ? `Hi, I'm ${nm}!` : 'Hi!'; };
  // info: { where: 'street' | 'room', room, npc } → { first, hi, reply, name }
  function wave(info = {}) {
    const first = !state.waved;
    if (first) { state.waved = true; save(); }
    sfx('wave');
    const inf = Object.assign({ first, name: (state.name || '').trim() }, info);
    let reply = null;
    waveCbs.slice().forEach(cb => { try { const r = cb(inf); if (r && !reply) reply = r; } catch (e) { /* ignore */ } });
    return { first, hi: heroHi(), reply, name: inf.name };
  }

  window.G = {
    C, TG, inTG, CFG_BAD, state: () => state, setState: s => { state = s; }, save, loadCloud, defaults, resetAll, wantsReset, markResetDone, look, setLook,
    $, esc, wait, skipDialogs, isSkipping, untilNotSkipping, onSkip, show, tapOnce, say, choose, ask, toast, suspicion, sparkle, sparkleAt, confetti,
    haptic, sfx, audio, audioBus, babble: (who, ch) => babble(voiceOf(who), ch || 'а', {}), voiceLine, soundSheet, bindSoundBtn, toggleSound, soundIcon, setHud, giveSticker, registerFinds, giveFind, FINDS, notebook, exportNotebook, STICKERS, team, teamName, herName,
    addSpeakers, emojiAvatar, speakers, bumpNb, nbCount, nbExtras: null, nbBind: null, nbExtraCount: null, saveSizes: () => ({ main: mainRaw().length, town: (townRaw() || '').length }),
    wave, waved, onWave, nameOk, heroHi,
    tgUserFirstName, tgHeader, openTgLink, inviteLink, readInvite, shareLink, ep, step, fmtTime, activeNow, isReleased, layer, app,
  };
})();
