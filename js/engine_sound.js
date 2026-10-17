/* =====================================================================
   ЗВУК МОТОРА (желание автора: «чтобы машина при езде издавала рёв мотора — в зависимости от машины и скорости»).
   Синтез WebAudio, без файлов. Два голоса:
     'cabrio' — жёлтый кабриолет с мотором сзади: оппозитная «шестёрка» — звонкий, с хрипотцой, на сбросе газа
                тихо «пф-пф» из труб;
     'sedan'  — красный седан: V8 — ниже и бархатнее, на холостых неровное «бу-бу-бу».
   Обороты считаются от скорости через три «передачи»: с места мотор раскручивается от газа (сцепление), на разгоне
   слышны переключения (короткий провал газа), газ отпущен — тише и глуше (мотор тормозит), назад — своя «передача».
   Громкость и яркость растут с оборотами и газом. Посадка — короткий «врум» стартера, выход — мотор затихает.
   Цепочка: импульсы выхлопа (PeriodicWave по порядку работы цилиндров) → «лопата» холостых (AM) → мягкое
   насыщение (рёв под нагрузкой) + шум впуска → срез низа (телефонный динамик) → фильтр яркости → «резонанс трубы» →
   громкость → шина фона игры G.audioBus('amb') (её приглушают голоса реплик) или свой AudioContext (стенды без игры).
   Уважает «Звук» игры (☰ → «Звук»; выключен — тишина), свёрнутую игру/Telegram (сразу тишина), iOS: контекст
   «просыпается» первым касанием. Кадры перестали приходить (пауза, загрузка сцены) — мотор сам затихает
   (автоматизация громкости внутри аудио: «мёртвая рука»), через 1,2 с тишины узлы останавливаются.

   API: window.EngineSound = {
     setKind(kind) — 'cabrio' | 'sedan' (прочие имена — 'cabrio');
     update({ speed, vmax, throttle, braking, onGround, driving, kind? }, dt) — каждый шаг езды (можно чаще кадра:
       запись в аудио — не чаще ~30 раз в секунду). speed — м/с со знаком; vmax — предел машины; throttle 0..1 —
       сколько газа просит игрок (цель / vmax); braking — тормоз; onGround (true); driving false — мотор глохнет;
     stop() — заглушить сразу; setMuted(bool) — свой выключатель поверх «Звук» игры;
     debug() → { awake, kind, rpm, gear, load, vol, cut, freq, ctx } · meter() → { rms, peak, centroid } (для проверки)
   }
   ===================================================================== */
(function () {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  // общая громкость: на выходе игры полный газ ≈ −26 дБFS RMS (речь голосов ≈ −22), холостые ≈ −37 дБFS в полосе динамика
  // телефона (300 Гц – 4 кГц); громче/ярче с оборотами и газом — от фильтров и насыщения, а не только от громкости
  const MASTER = 0.255;
  /* ---------- голоса моторов ----------
     cyl — цилиндров; fire — банк каждого выхлопа по порядку работы (1 — левый, 0 — правый); bankAmp/bankLag — второй
     банк чуть тише и позже (другая длина труб: отсюда «неровность» звука); tau — затухание импульса (доля интервала);
     bark — [порядок, глубина] «лая» внутри импульса; gears — верх каждой передачи (доля vmax); lp* — яркость (Гц);
     hp0 — срез низа на холостых (Гц; к красной зоне — 90): динамик телефона ниже ~300 Гц почти не играет;
     form — резонанс трубы [Гц, дБ, Q]; noise — шум впуска; lope — неровность холостых; rough — дрожь вспышек (от цикла
     к циклу); pre0 / drive — насыщение на холостых / прибавка под газом */
  const KINDS = {
    cabrio: {
      cyl: 6, fire: [1, 0, 1, 0, 1, 0], bankAmp: 0.86, bankLag: 0.006, tau: 0.14, bark: [5, 0.45], jit: 0.05,
      idle: 1000, red: 7200, gears: [0.42, 0.74, 1.3], lpBase: 1100, lpRpm: 2000, lpLoad: 1600, hp0: 170, form: [660, 6, 1.3],
      noise: 0.55, nbp: 3.2, lope: 0.06, rough: 0.2, pre0: 0.55, drive: 2.7, vol: 1.0, pops: true,
    },
    sedan: {
      cyl: 8, fire: [1, 0, 0, 1, 0, 1, 1, 0], bankAmp: 0.74, bankLag: 0.012, tau: 0.2, bark: [3, 0.4], jit: 0.03,
      idle: 820, red: 6800, gears: [0.4, 0.72, 1.28], lpBase: 1050, lpRpm: 1500, lpLoad: 1200, hp0: 175, form: [300, 5, 1.2],
      noise: 0.32, nbp: 2.4, lope: 0.22, rough: 0.26, pre0: 0.75, drive: 1.6, vol: 0.62, pops: false,
    },
  };
  const kindOf = k => (k === 'sedan' ? 'sedan' : 'cabrio');

  /* ---------- состояние ---------- */
  let kind = 'cabrio', K = KINDS.cabrio, muted = false, hidden = false;
  // модель мотора (идёт и без звука: включили «Звук» на ходу — обороты уже верные)
  const M = { rough: 0, rpm: 0, gear: 0, load: 0, shiftT: 0, popCd: 0, wasLoad: 0, startT: 9, on: 0, t: 0, vol: 0, cut: 0, freq: 0, pre: 0, lope: 0, nf: 0, nv: 0, driving: false };
  let src = null, lastUpd = 0, lastLive = 0, lastWrite = 0, awake = null, ownAC = null, ownOut = null, sleepTimer = 0;
  const waves = new WeakMap(), noises = new WeakMap(), curves = new WeakMap();

  // «Звук» игры выключен (или свой выключатель / игра свёрнута)
  function soundOff() {
    if (muted || hidden) return true;
    const g = window.G;
    if (g && typeof g.state === 'function') { try { const st = g.state(); if (st && !st.sound) return true; } catch (e) { return true; } }
    return false;
  }
  // куда играть: шина фона игры (её приглушают реплики) или свой контекст
  function output() {
    const g = window.G;
    if (g && typeof g.audioBus === 'function') {
      let b = null; try { b = g.audioBus('amb'); } catch (e) { b = null; }
      return b && b.context ? { ac: b.context, out: b, k: 1 } : null;
    }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      if (!ownAC) { ownAC = new AC(); ownOut = ownAC.createGain(); ownOut.gain.value = 0.45; ownOut.connect(ownAC.destination); }
      if (ownAC.state !== 'running' && !document.hidden) ownAC.resume();
    } catch (e) { return null; }
    return { ac: ownAC, out: ownOut, k: 1 };
  }

  /* ---------- импульсы выхлопа: одна «форма волны» на весь цикл (два оборота вала) ---------- */
  function waveOf(ac, kk) {
    let byK = waves.get(ac); if (!byK) { byK = {}; waves.set(ac, byK); }
    if (byK[kk]) return byK[kk];
    const P = KINDS[kk], N = P.cyl, NS = 1024, H = 200, w = new Float32Array(NS);
    const tau = P.tau / N, ta = 0.016 / N;
    for (let c = 0; c < N; c++) {
      const right = !P.fire[c], a = (right ? P.bankAmp : 1) * (1 - P.jit * ((c * 7) % 3) / 2);
      const ph = (c + (right ? P.bankLag * N : 0)) / N;
      for (let i = 0; i < NS; i++) {
        let d = i / NS - ph; if (d < 0) d += 1;
        w[i] += a * Math.exp(-d / tau) * (1 - Math.exp(-d / ta)) * (1 + P.bark[1] * Math.sin(TAU * d * N * P.bark[0]));
      }
    }
    const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) {
      // cos/sin поворотом (без тригонометрии в цикле)
      const dc = Math.cos(TAU * h / NS), ds = Math.sin(TAU * h / NS);
      let c = 1, s = 0, sc = 0, ss = 0;
      for (let i = 0; i < NS; i++) { sc += w[i] * c; ss += w[i] * s; const c2 = c * dc - s * ds; s = s * dc + c * ds; c = c2; }
      re[h] = sc * 2 / NS; im[h] = ss * 2 / NS;
    }
    return (byK[kk] = ac.createPeriodicWave(re, im));
  }
  function noiseOf(ac) {
    let b = noises.get(ac); if (b) return b;
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0); let lp = 0;
    // чуть «тёплый» шум (сглаженный белый): без шипения
    for (let i = 0; i < d.length; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.55; d[i] = lp * 1.6; }
    noises.set(ac, b); return b;
  }
  const SAT = 3.4, SATN = Math.tanh(SAT);
  function curveOf(ac) {
    let c = curves.get(ac); if (c) return c;
    c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(SAT * x) / SATN; }
    curves.set(ac, c); return c;
  }

  /* ---------- узлы: собираются при посадке, останавливаются через 1,2 с тишины ---------- */
  function wake() {
    if (awake) return awake;
    const o = output(); if (!o) return null;
    const ac = o.ac;
    try {
      const n = { ac, bus: o.out };
      n.osc = ac.createOscillator(); n.osc.setPeriodicWave(waveOf(ac, kind)); n.osc.frequency.value = 8; n.kind = kind;
      n.am = ac.createGain(); n.am.gain.value = 1;
      n.lfo = ac.createOscillator(); n.lfo.type = 'sine'; n.lfo.frequency.value = 4;
      n.lfoG = ac.createGain(); n.lfoG.gain.value = 0;
      n.pre = ac.createGain(); n.pre.gain.value = 0.3;
      n.sh = ac.createWaveShaper(); n.sh.curve = curveOf(ac);
      n.post = ac.createGain(); n.post.gain.value = 1;
      n.noise = ac.createBufferSource(); n.noise.buffer = noiseOf(ac); n.noise.loop = true;
      n.nbp = ac.createBiquadFilter(); n.nbp.type = 'bandpass'; n.nbp.Q.value = 1.1; n.nbp.frequency.value = 600;
      n.ng = ac.createGain(); n.ng.gain.value = 0;
      // дрожь вспышек: тот же шум, только низы — чуть «качает» громкость и высоту от цикла к циклу (живой, не «органный» звук)
      n.rlp = ac.createBiquadFilter(); n.rlp.type = 'lowpass'; n.rlp.Q.value = 0.7; n.rlp.frequency.value = 60;
      n.rg = ac.createGain(); n.rg.gain.value = 0; n.dg = ac.createGain(); n.dg.gain.value = 0;
      n.hp = ac.createBiquadFilter(); n.hp.type = 'highpass'; n.hp.frequency.value = 90; n.hp.Q.value = 0.7;
      n.lp = ac.createBiquadFilter(); n.lp.type = 'lowpass'; n.lp.Q.value = 0.9; n.lp.frequency.value = 900;
      n.pk = ac.createBiquadFilter(); n.pk.type = 'peaking';
      n.out = ac.createGain(); n.out.gain.value = 0;
      n.osc.connect(n.am); n.lfo.connect(n.lfoG); n.lfoG.connect(n.am.gain);
      n.am.connect(n.pre); n.pre.connect(n.sh); n.sh.connect(n.post);
      n.noise.connect(n.nbp); n.nbp.connect(n.ng); n.ng.connect(n.post);
      n.noise.connect(n.rlp); n.rlp.connect(n.rg); n.rg.connect(n.am.gain);
      // старые WebKit без osc.detune — без дрожи высоты (остальное звучит)
      if (n.osc.detune) { n.rlp.connect(n.dg); n.dg.connect(n.osc.detune); }
      n.post.connect(n.hp); n.hp.connect(n.lp); n.lp.connect(n.pk); n.pk.connect(n.out); n.out.connect(o.out);
      tunePk(n);
      const t = ac.currentTime;
      n.osc.start(t); n.lfo.start(t); n.noise.start(t, Math.random() * 0.5);
      if (meterOn) attachMeter(n);
      awake = n; lastWrite = 0;
      if (!sleepTimer) sleepTimer = setInterval(checkSleep, 400);
      return n;
    } catch (e) { console.warn('EngineSound: wake', e); return null; }
  }
  function tunePk(n) { const f = K.form; n.pk.frequency.value = f[0]; n.pk.gain.value = f[1]; n.pk.Q.value = f[2]; }
  function sleep() {
    const n = awake; awake = null;
    if (sleepTimer) { clearInterval(sleepTimer); sleepTimer = 0; }
    if (!n) return;
    try { const t = n.ac.currentTime; n.out.gain.cancelScheduledValues(t); n.out.gain.setValueAtTime(0, t); n.osc.stop(t + 0.05); n.lfo.stop(t + 0.05); n.noise.stop(t + 0.05); } catch (e) { /* уже остановлены */ }
    setTimeout(() => { try { n.out.disconnect(); if (n.meter) n.meter.disconnect(); } catch (e) { /* ignore */ } }, 120);
  }
  // тишина дольше 1,2 с (вышла из машины, кадры не идут, звук выключен) — узлы долой
  function checkSleep() { if (awake && performance.now() - lastLive > 1200) sleep(); }
  // сразу тихо (выключили звук, свернули игру)
  function hush(tc) {
    const n = awake; if (!n) return;
    try { const t = n.ac.currentTime; n.out.gain.cancelScheduledValues(t); n.out.gain.setTargetAtTime(0, t, tc || 0.03); } catch (e) { /* ignore */ }
  }

  /* ---------- «пф-пф» на сбросе газа (только кабриолет): два-три коротких хлопка шума из труб ---------- */
  function pops(n) {
    try {
      const ac = n.ac, t0 = ac.currentTime + 0.06, cnt = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < cnt; i++) {
        const t = t0 + i * (0.09 + Math.random() * 0.1), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noiseOf(ac); f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 500; f.Q.value = 1.4;
        const v = MASTER * 0.32 * (1 - i * 0.22);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        s.connect(f); f.connect(g); g.connect(n.bus); s.start(t, Math.random() * 0.8); s.stop(t + 0.09);
      }
    } catch (e) { /* без хлопков */ }
  }

  /* ---------- шаг: модель мотора + запись в аудио ---------- */
  // обороты по скорости на передаче g (верх передачи — 94 % красной зоны)
  function rpmAt(g, av, vmax) { return (av / Math.max(0.5, K.gears[g] * vmax)) * K.red * 0.94; }
  function update(o, dt) {
    if (!o) return;
    const nowMs = performance.now();
    // две машины сразу (стенды): «не за рулём» от чужой машины не глушит ту, что едет
    if (o !== src) { if (!o.driving && M.driving && nowMs - lastUpd < 250) return; src = o; }
    lastUpd = nowMs;
    if (o.kind && o.kind !== kind && KINDS[kindOf(o.kind)] !== K) setKind(o.kind);
    dt = clamp(+dt || 0, 0, 0.1);
    const driving = !!o.driving, v = +o.speed || 0, av = Math.abs(v), vmax = o.vmax > 1 ? o.vmax : 12;
    const thr = clamp(+o.throttle || 0, 0, 1), brk = !!o.braking, ground = o.onGround !== false;
    if (driving && !M.driving) { M.startT = M.rpm > K.idle * 0.6 ? 9 : 0; M.gear = 0; }
    M.driving = driving; M.t += dt;
    // газ «тянет»: цель выше скорости (держит или разгоняет); отпустила / тормоз — мотор тормозит машиной
    const pushing = driving && thr > 0.02 && !brk && thr * vmax > av - 0.6;
    const NG = K.gears.length, red = K.red, idle = K.idle;
    let rpmT, loadT;
    if (!driving) { rpmT = 0; loadT = 0; M.gear = 0; }
    else if (!ground) { rpmT = idle + thr * (0.85 * red - idle); loadT = thr * 0.8; }
    else {
      if (M.shiftT > 0) M.shiftT -= dt;
      else if (v < -0.2 || av < 0.6) M.gear = 0;
      else if (M.gear < NG - 1 && rpmAt(M.gear, av, vmax) > red * (0.6 + 0.3 * thr)) { M.gear++; M.shiftT = 0.17; }
      else if (M.gear > 0 && rpmAt(M.gear, av, vmax) < red * 0.3) { M.gear--; M.shiftT = 0.08; }
      // назад — своя короткая передача; с места — обороты от газа, пока сцепление не «схватит»
      const rpmW = v < -0.2 ? av / Math.max(0.5, K.gears[0] * vmax * 1.5) * red : rpmAt(M.gear, av, vmax);
      const slip = clamp(1 - av / (0.5 * K.gears[0] * vmax), 0, 1);
      const rpmFree = idle + (pushing ? thr : 0) * (0.5 * red - idle);
      rpmT = Math.max(idle, rpmW * (1 - slip) + Math.max(rpmW, rpmFree) * slip);
      loadT = pushing && M.shiftT <= 0 ? 0.35 + 0.65 * thr : 0;
    }
    // стартер и «врум» при посадке
    if (driving && M.startT < 0.8) {
      M.startT += dt;
      if (M.startT < 0.2) { rpmT = 300; loadT = 0.1; }
      else { const e = 1 - (M.startT - 0.2) / 0.6; rpmT = Math.max(rpmT, idle * (1 + 0.95 * e)); loadT = Math.max(loadT, 0.55 * e); }
    }
    const kr = M.shiftT > 0 ? 16 : !driving ? 2.6 : rpmT > M.rpm ? 6 + 7 * M.load : 4.5;
    M.rpm += (rpmT - M.rpm) * (1 - Math.exp(-dt * kr));
    M.load += (loadT - M.load) * (1 - Math.exp(-dt * (loadT > M.load ? 12 : 7)));
    M.on += ((driving ? 1 : 0) - M.on) * (1 - Math.exp(-dt * (driving ? 20 : 4.5)));
    // хлопки на резком сбросе газа с высоких оборотов
    if (M.popCd > 0) M.popCd -= dt;
    const rn = clamp((M.rpm - idle) / (red - idle), 0, 1);
    let popNow = false;
    if (K.pops && driving && M.wasLoad > 0.6 && loadT === 0 && M.shiftT <= 0 && rn > 0.4 && av > 4 && M.popCd <= 0) { popNow = true; M.popCd = 2.5; }
    M.wasLoad = loadT > 0 ? Math.max(M.wasLoad * 0.98, loadT) : 0;
    // звук выключен / игра свёрнута — модель идёт, узлы спят
    if (soundOff()) { if (awake) { hush(0.04); lastLive = 0; } return; }
    if (!driving && M.on < 0.02) return;
    lastLive = nowMs;
    const n = awake || wake(); if (!n) return;
    // запись в аудио — не чаще ~30 раз в секунду по настоящему времени (проверки гоняют шаг сотни раз за кадр)
    if (nowMs - lastWrite < 33 && !popNow) return;
    lastWrite = nowMs;
    if (popNow) pops(n);
    const L = M.load, wob = 1 + 0.006 * Math.sin(M.t * 5.3) + 0.004 * Math.sin(M.t * 11.7 + 1);
    M.freq = M.rpm / 120 * wob;
    M.pre = K.pre0 + 0.3 * K.drive * L * (0.5 + 0.5 * rn);
    const post = 0.85 / Math.max(0.2, Math.tanh(SAT * M.pre) / SATN);
    M.cut = Math.min(9000, K.lpBase + K.lpRpm * rn + K.lpLoad * L);
    M.lope = K.lope * (1 - rn) * (driving && !pushing ? 1.25 : 0.8);
    M.nf = clamp(M.rpm / 120 * K.cyl * K.nbp, 300, 4200);
    M.nv = K.noise * 0.45 * (0.25 + 0.75 * L) * (0.3 + 0.7 * rn) * M.on;
    M.vol = MASTER * K.vol * (0.85 + 0.05 * rn + 0.1 * L) * M.on * (M.rpm < idle * 0.5 ? M.rpm / (idle * 0.5) : 1);
    // дрожь: низы шума до ~4 вспышек цикла; глубина — с поправкой на полосу (уже полоса — тише шум): громкость ±12 %,
    // высота ±5 центов на холостых, вдвое меньше у красной зоны
    const rf = clamp(M.rpm / 120 * 4, 25, 400), rk = 7.6 / Math.sqrt(rf / 100);
    M.rough = K.rough * (1 - 0.5 * rn) * rk;
    try {
      const t = n.ac.currentTime;
      n.osc.frequency.setTargetAtTime(Math.max(1, M.freq), t, 0.03);
      n.lfo.frequency.setTargetAtTime(Math.max(0.5, M.freq * 0.5), t, 0.05);
      n.lfoG.gain.setTargetAtTime(M.lope, t, 0.08);
      n.pre.gain.setTargetAtTime(M.pre, t, 0.04);
      n.post.gain.setTargetAtTime(post, t, 0.04);
      n.lp.frequency.setTargetAtTime(M.cut, t, 0.04);
      n.hp.frequency.setTargetAtTime(90 + (K.hp0 - 90) * (1 - rn), t, 0.06);
      n.nbp.frequency.setTargetAtTime(M.nf, t, 0.05);
      n.ng.gain.setTargetAtTime(M.nv, t, 0.05);
      n.rlp.frequency.setTargetAtTime(rf, t, 0.05);
      n.rg.gain.setTargetAtTime(M.rough, t, 0.06);
      n.dg.gain.setTargetAtTime(M.rough * 40, t, 0.06);
      // «мёртвая рука»: следующие кадры не пришли (пауза, загрузка сцены) — через 0,35 с мотор сам затихает
      n.out.gain.cancelScheduledValues(t);
      n.out.gain.setTargetAtTime(M.vol, t, 0.05);
      n.out.gain.setTargetAtTime(0, t + 0.35, 0.1);
    } catch (e) { /* узел закрыт — пересоберём */ awake = null; }
  }

  function setKind(k) {
    const kk = kindOf(k);
    if (kk === kind && KINDS[kk] === K) return;
    kind = kk; K = KINDS[kk];
    const n = awake;
    if (n && n.kind !== kk) { try { n.osc.setPeriodicWave(waveOf(n.ac, kk)); n.kind = kk; tunePk(n); } catch (e) { /* ignore */ } }
  }
  function stop() { M.driving = false; M.on = 0; M.rpm = 0; M.load = 0; hush(0.03); setTimeout(() => { if (!M.driving) sleep(); }, 150); }
  function setMuted(b) { muted = !!b; if (muted) hush(0.04); }

  /* ---------- свёрнутая игра / Telegram: сразу тишина; iOS: контекст оживает первым касанием ---------- */
  function onHide(h) {
    hidden = !!h;
    if (hidden) { hush(0.02); if (ownAC) { try { ownAC.suspend(); } catch (e) { /* ignore */ } } }
    else if (ownAC && !muted) { try { ownAC.resume(); } catch (e) { /* ignore */ } }
  }
  document.addEventListener('visibilitychange', () => onHide(document.hidden));
  try { const TG = window.Telegram && window.Telegram.WebApp; if (TG && TG.onEvent) { TG.onEvent('deactivated', () => onHide(true)); TG.onEvent('activated', () => onHide(document.hidden)); } } catch (e) { /* ignore */ }
  const unlock = () => {
    const ac = awake ? awake.ac : ownAC;
    if (ac && ac.state !== 'running' && !document.hidden && !soundOff()) { try { ac.resume(); } catch (e) { /* ignore */ } }
  };
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));

  /* ---------- проверка: состояние и измеритель на выходе ---------- */
  let meterOn = false, meterBuf = null, meterFreq = null;
  function attachMeter(n) { try { n.meter = n.ac.createAnalyser(); n.meter.fftSize = 2048; n.out.connect(n.meter); } catch (e) { n.meter = null; } }
  function meter() {
    if (!meterOn) { meterOn = true; if (awake && !awake.meter) attachMeter(awake); }
    const n = awake; if (!n || !n.meter) return { rms: 0, peak: 0, centroid: 0, hiShare: 0 };
    if (!meterBuf) { meterBuf = new Float32Array(2048); meterFreq = new Float32Array(1024); }
    n.meter.getFloatTimeDomainData(meterBuf); n.meter.getFloatFrequencyData(meterFreq);
    let s = 0, p = 0; for (let i = 0; i < meterBuf.length; i++) { const x = meterBuf[i]; s += x * x; if (Math.abs(x) > p) p = Math.abs(x); }
    let e = 0, ef = 0, hi = 0; const bin = n.ac.sampleRate / 2048;
    for (let i = 1; i < meterFreq.length; i++) { const pw = Math.pow(10, meterFreq[i] / 10); e += pw; ef += pw * i * bin; if (i * bin > 300) hi += pw; }
    return { rms: Math.sqrt(s / meterBuf.length), peak: p, centroid: e > 0 ? ef / e : 0, hiShare: e > 0 ? hi / e : 0 };
  }
  function debug() {
    return { awake: !!awake, kind, rpm: Math.round(M.rpm), gear: M.gear, load: +M.load.toFixed(2), on: +M.on.toFixed(2), vol: +M.vol.toFixed(4), cut: Math.round(M.cut), freq: +M.freq.toFixed(2), noise: +M.nv.toFixed(4), driving: M.driving, muted: soundOff(), ctx: awake ? awake.ac.state : ownAC ? ownAC.state : null, gain: awake ? +awake.out.gain.value.toFixed(4) : 0 };
  }

  window.EngineSound = { setKind, update, stop, setMuted, debug, meter, KINDS, get kind() { return kind; } };
})();
