/* =====================================================================
   ЗВУК МОТОРА (желание автора: «чтобы машина при езде издавала рёв мотора — в зависимости от машины и скорости»).
   Синтез WebAudio, без файлов. Два голоса:
     'cabrio' — жёлтый кабриолет с мотором сзади: оппозитная «шестёрка» — звонкий, с хрипотцой, на сбросе газа
                тихо «пф-пф» из труб;
     'sedan'  — красный седан: V8 — ниже и бархатнее, на холостых неровное «бу-бу-бу».
   Обороты считаются от скорости через три «передачи» автомата: на ровном ходу он переходит выше пораньше — чем быстрее
   едет, тем выше обороты (медленно — спокойные ~2100, быстро — ~5500); на разгоне тянет передачи до ~90 % красной зоны,
   слышны переключения (короткий провал газа). С места мотор раскручивается от газа (сцепление), газ отпущен — тише и
   глуше (мотор тормозит), назад — своя «передача». Громче и ярче — со скоростью (плюс шорох ветра), с оборотами и с
   разгоном. Посадка — короткий «врум» стартера, выход — мотор затихает. Гудок на миг приглушает мотор (duck).
   Цепочка: импульсы выхлопа (PeriodicWave по порядку работы цилиндров) → «лопата» холостых (AM) → мягкое
   насыщение (рёв под нагрузкой) + шум впуска → срез низа (телефонный динамик) → фильтр яркости → «резонанс трубы» →
   громкость (+ шорох ветра) → «приглушка» гудка → шина фона игры G.audioBus('amb') или свой AudioContext (стенды без
   игры). Шину фона приглушают голоса реплик, но голоса в игре выключены (CONFIG.VOICES false) — приглушения нет.
   Уважает «Звук» игры (☰ → «Звук»; выключен — тишина), свёрнутую игру/Telegram (сразу тишина), iOS: контекст
   «просыпается» первым касанием. «Звук» выключен, а она села за руль — один раз тост «включи звук — услышишь мотор»
   (st.engHint; на стендах с ?debug=1 — только с ?enghint=1). Кадры перестали приходить (пауза, загрузка сцены) — мотор
   сам затихает (автоматизация громкости внутри аудио: «мёртвая рука»), через 1,2 с тишины узлы останавливаются.

   API: window.EngineSound = {
     setKind(kind) — 'cabrio' | 'sedan' (прочие имена — 'cabrio');
     update({ speed, vmax, throttle, braking, onGround, driving, kind? }, dt) — каждый шаг езды (можно чаще кадра:
       запись в аудио — не чаще ~30 раз в секунду). speed — м/с со знаком; vmax — предел машины; throttle 0..1 —
       сколько газа просит игрок (цель / vmax); braking — тормоз; onGround (true); driving false — мотор глохнет;
       шаги от другой машины после 0,6 с тишины (или от той же после 4 с) — мотор был заглохшим (при посадке стартер);
     park(o, dt) — шаг машины не за рулём (тот же объект o): только что ехала — мотор затихает с падением оборотов;
     duck(k, sec) — на sec секунд приглушить мотор до доли k (гудок: 0,4 на 0,5 с ≈ −8 дБ), потом плавно вернуть;
     stop() — заглушить сразу; setMuted(bool) — свой выключатель поверх «Звук» игры;
     debug() → { awake, kind, rpm, gear, load, dem, vol, cut, freq, wind, ctx } · meter() → { rms, peak, centroid }
     (для проверки; meter — после «приглушки», до шины игры)
   }
   ===================================================================== */
(function () {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  // общая громкость (мерено на выходе игры, после её ограничителя — он сам добавляет ~9 дБ): полный ход ≈ −22 дБFS RMS у
  // кабриолета, −23 у седана (громкие звуки игры: «ok» ≈ −25, «tap» ≈ −27, гудок ≈ −24), холостые ≈ −34; медленный ход
  // (четверть vmax) ≈ −28. Громче/ярче со скоростью, оборотами и разгоном
  const MASTER = 0.15;
  // шорох ветра на ходу (доля громкости мотора на полной скорости; растёт как квадрат скорости)
  const WIND = 0.4;
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
      idle: 1000, red: 7200, gears: [0.42, 0.8, 1.22], lpBase: 1100, lpRpm: 2000, lpLoad: 1600, hp0: 170, form: [660, 6, 1.3],
      noise: 0.55, nbp: 3.2, lope: 0.06, rough: 0.2, pre0: 0.55, drive: 2.7, vol: 1.0, pops: true,
    },
    sedan: {
      cyl: 8, fire: [1, 0, 0, 1, 0, 1, 1, 0], bankAmp: 0.74, bankLag: 0.012, tau: 0.2, bark: [3, 0.4], jit: 0.03,
      idle: 820, red: 6800, gears: [0.4, 0.78, 1.2], lpBase: 1050, lpRpm: 1500, lpLoad: 1200, hp0: 175, form: [300, 5, 1.2],
      noise: 0.32, nbp: 2.4, lope: 0.22, rough: 0.26, pre0: 0.75, drive: 1.6, vol: 0.68, pops: false,
    },
  };
  const kindOf = k => (k === 'sedan' ? 'sedan' : 'cabrio');

  /* ---------- состояние ---------- */
  let kind = 'cabrio', K = KINDS.cabrio, muted = false, hidden = false;
  // модель мотора (идёт и без звука: включили «Звук» на ходу — обороты уже верные)
  const M = { rough: 0, rpm: 0, gear: 0, load: 0, dem: 0, av: 0, acc: 0, shiftT: 0, popCd: 0, wasLoad: 0, startT: 9, on: 0, t: 0, vol: 0, cut: 0, freq: 0, pre: 0, lope: 0, nf: 0, nv: 0, wv: 0, wf: 0, duckK: 1, duckT: 0, driving: false };
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
      // шорох ветра: тот же шум, медленнее (другой период петли), широкая полоса мимо фильтров мотора; громче со скоростью
      n.wind = ac.createBufferSource(); n.wind.buffer = noiseOf(ac); n.wind.loop = true; n.wind.playbackRate.value = 0.77;
      n.wbp = ac.createBiquadFilter(); n.wbp.type = 'bandpass'; n.wbp.Q.value = 0.55; n.wbp.frequency.value = 500;
      n.wg = ac.createGain(); n.wg.gain.value = 0;
      // «приглушка» (гудок): своя громкость после n.out — шаг езды её не перезаписывает
      n.dk = ac.createGain(); n.dk.gain.value = 1;
      n.osc.connect(n.am); n.lfo.connect(n.lfoG); n.lfoG.connect(n.am.gain);
      n.am.connect(n.pre); n.pre.connect(n.sh); n.sh.connect(n.post);
      n.noise.connect(n.nbp); n.nbp.connect(n.ng); n.ng.connect(n.post);
      n.noise.connect(n.rlp); n.rlp.connect(n.rg); n.rg.connect(n.am.gain);
      // старые WebKit без osc.detune — без дрожи высоты (остальное звучит)
      if (n.osc.detune) { n.rlp.connect(n.dg); n.dg.connect(n.osc.detune); }
      n.post.connect(n.hp); n.hp.connect(n.lp); n.lp.connect(n.pk); n.pk.connect(n.out);
      n.wind.connect(n.wbp); n.wbp.connect(n.wg); n.wg.connect(n.out); n.out.connect(n.dk); n.dk.connect(o.out);
      tunePk(n);
      const t = ac.currentTime;
      n.osc.start(t); n.lfo.start(t); n.noise.start(t, Math.random() * 0.5); n.wind.start(t, Math.random() * 0.9);
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
    // гаснет за ~10 мс, а не скачком (звук выключили на ходу — без щелчка)
    try { const t = n.ac.currentTime; n.out.gain.cancelScheduledValues(t); n.out.gain.setTargetAtTime(0, t, 0.008); n.osc.stop(t + 0.07); n.lfo.stop(t + 0.07); n.noise.stop(t + 0.07); n.wind.stop(t + 0.07); } catch (e) { /* уже остановлены */ }
    setTimeout(() => { try { n.out.disconnect(); n.dk.disconnect(); if (n.meter) n.meter.disconnect(); } catch (e) { /* ignore */ } }, 160);
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
    const driving = !!o.driving, v = +o.speed || 0, av = Math.abs(v), vmax = o.vmax > 1 ? o.vmax : 12;
    // мотор уже смолк: шаги пошли от другой машины, а прежняя молчит дольше 0,6 с (переезд город ↔ горы, загрузка сцены),
    // или от той же, но шагов не было дольше 4 с (страховка: вышла без park) — считаем заглохшим, при посадке снова стартер.
    // Машина катится — обороты прежние, без стартера. Редкие кадры (медленный телефон) под правило не попадают
    if (M.driving && lastUpd && nowMs - lastUpd > (o !== src ? 600 : 4000)) { M.driving = false; M.on = 0; M.load = 0; M.wasLoad = 0; if (av < 1.5) M.rpm = 0; }
    // две машины сразу (стенды): «не за рулём» от чужой машины не глушит ту, что едет
    if (o !== src) { if (!driving && M.driving && nowMs - lastUpd < 250) return; src = o; }
    lastUpd = nowMs;
    if (o.kind && o.kind !== kind && KINDS[kindOf(o.kind)] !== K) setKind(o.kind);
    dt = clamp(+dt || 0, 0, 0.1);
    const thr = clamp(+o.throttle || 0, 0, 1), brk = !!o.braking, ground = o.onGround !== false;
    const NG = K.gears.length, red = K.red, idle = K.idle;
    // посадка / мотор снова заведён: стоит — стартер; катится (после паузы) — сразу своя передача, без «вскрика» на первой
    if (driving && !M.driving) {
      M.startT = M.rpm > idle * 0.6 || av > 1.5 ? 9 : 0; M.gear = 0; M.shiftT = 0; M.dem = 0; M.av = av; M.acc = 0;
      while (M.gear < NG - 1 && rpmAt(M.gear, av, vmax) > red * 0.44 && rpmAt(M.gear + 1, av, vmax) > red * 0.24) M.gear++;
      if (gameSoundOff()) soundHint();
    }
    M.driving = driving; M.t += dt;
    // газ «тянет»: цель выше скорости (держит или разгоняет); отпустила / тормоз — мотор тормозит машиной
    const pushing = driving && thr > 0.02 && !brk && thr * vmax > av - 0.6;
    // доля скорости и «спрос на разгон»: цель заметно выше скорости — 0..1; доехала — спадает за ~0,3 с
    const sp = Math.min(1, av / vmax), demT = pushing ? clamp((thr * vmax - av) / (0.18 * vmax), 0, 1) : 0;
    M.dem += (demT - M.dem) * (1 - Math.exp(-dt * (demT > M.dem ? 10 : 3)));
    // ускорение машины (сглажено): резко сбавляет ход — автомат выше не переходит (иначе на остановке обороты «прыгают»)
    if (dt > 0) M.acc += ((av - M.av) / dt - M.acc) * (1 - Math.exp(-dt * 8));
    M.av = av;
    let rpmT, loadT;
    if (!driving) { rpmT = 0; loadT = 0; M.gear = 0; }
    else if (!ground) { rpmT = idle + thr * (0.85 * red - idle); loadT = thr * 0.8; }
    else {
      // автомат: на ровном ходу — выше пораньше (у ~44 % красной зоны), чем сильнее разгон — тем позже (до ~90 %); вниз — у
      // ~20 %; на тормозе и резком сбросе хода выше не переходит. Медленно — спокойные обороты, быстрее — выше, на разгоне —
      // «пила» переключений
      const up = red * (0.44 + 0.46 * M.dem * (0.5 + 0.5 * thr)), dn = red * 0.2;
      if (M.shiftT > 0) M.shiftT -= dt;
      else if (v < -0.2 || av < 0.6) M.gear = 0;
      else if (M.gear < NG - 1 && !brk && (pushing || M.acc > -3) && rpmAt(M.gear, av, vmax) > up && rpmAt(M.gear + 1, av, vmax) > dn * 1.2) { M.gear++; M.shiftT = 0.17; }
      else if (M.gear > 0 && rpmAt(M.gear, av, vmax) < dn) { M.gear--; M.shiftT = 0.08; }
      // назад — своя короткая передача; с места — обороты от газа, пока сцепление не «схватит»
      const rpmW = v < -0.2 ? av / Math.max(0.5, K.gears[0] * vmax * 1.5) * red : rpmAt(M.gear, av, vmax);
      const slip = clamp(1 - av / (0.5 * K.gears[0] * vmax), 0, 1);
      const rpmFree = idle + (pushing ? thr : 0) * (0.5 * red - idle);
      rpmT = Math.max(idle, rpmW * (1 - slip) + Math.max(rpmW, rpmFree) * slip);
      // нагрузка: на ровном ходу растёт со скоростью (воздух), на разгоне — от газа
      const Lc = 0.24 + 0.62 * sp * sp, La = 0.5 + 0.5 * thr;
      loadT = pushing && M.shiftT <= 0 ? Math.min(1, Lc + Math.max(0, La - Lc) * M.dem) : 0;
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
    if (hintNews) hintClear();
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
    // ярче и громче со скоростью (не только от оборотов и газа): с места до полного хода ≈ +4 дБ одной громкостью
    M.cut = Math.min(9000, K.lpBase + K.lpRpm * rn + K.lpLoad * L + 1200 * sp);
    M.lope = K.lope * (1 - rn) * (driving && !pushing ? 1.25 : 0.8);
    M.nf = clamp(M.rpm / 120 * K.cyl * K.nbp, 300, 4200);
    M.nv = K.noise * 0.45 * (0.25 + 0.75 * L) * (0.3 + 0.7 * rn) * M.on;
    M.vol = MASTER * K.vol * (0.68 + 0.28 * sp + 0.05 * rn + 0.08 * L) * M.on * (M.rpm < idle * 0.5 ? M.rpm / (idle * 0.5) : 1);
    // ветер: квадрат скорости (одинаковый у обеих машин), полоса выше с ходом, лёгкие «порывы» — петли шума не слышно
    M.wv = WIND * sp * sp * (1 + 0.12 * Math.sin(M.t * 0.83) + 0.07 * Math.sin(M.t * 2.1 + 1)) / K.vol;
    M.wf = 380 + 900 * sp;
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
      n.wbp.frequency.setTargetAtTime(M.wf, t, 0.1);
      n.wg.gain.setTargetAtTime(M.wv, t, 0.1);
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
  // машина не за рулём (выходит, стоит): каждый шаг контроллера посадки, где не зовётся update. Та, что ехала, глохнет —
  // обороты падают, звук затихает (~0,9 с), потом — ничего не делает; чужие машины не трогает
  function park(o, dt) {
    if (!o) return;
    if (o.driving) { o.driving = false; o.throttle = 0; o.braking = false; o.speed = 0; }
    if (o === src && (M.driving || M.on >= 0.02)) update(o, dt);
  }
  function stop() { M.driving = false; M.on = 0; M.rpm = 0; M.load = 0; hush(0.03); setTimeout(() => { if (!M.driving) sleep(); }, 150); }
  function setMuted(b) { muted = !!b; if (muted) hush(0.04); }
  // гудок и т. п.: на sec секунд мотор тише (доля k), потом плавно обратно — своим узлом после громкости (шаг его не трогает)
  function duck(k, sec) {
    k = clamp(+k || 0, 0, 1); sec = clamp(+sec || 0, 0, 3);
    M.duckK = k; M.duckT = performance.now() + sec * 1000;
    const n = awake; if (!n) return;
    try { const t = n.ac.currentTime; n.dk.gain.cancelScheduledValues(t); n.dk.gain.setTargetAtTime(k, t, 0.015); n.dk.gain.setTargetAtTime(1, t + sec, 0.12); } catch (e) { /* ignore */ }
  }

  /* ---------- «Звук» игры выключен, а она села за руль: один раз тост «включи звук — услышишь мотор» ----------
     В городе справа на полосе кнопка 🔇 — её коротко «качнёт»; в горах там скорость — тогда к ☰ → «Звук» (точка на строке
     меню). Один раз за игру (st.engHint); на стендах с ?debug=1 — только с ?enghint=1, чтобы тост не мешал проверкам */
  let hintTimer = 0, hintNews = false;
  function gameSoundOff() {
    const g = window.G; if (!g || typeof g.state !== 'function') return false;
    try { const st = g.state(); return !!st && !st.sound; } catch (e) { return false; }
  }
  function soundHint() {
    const g = window.G;
    if (hintTimer || !g || typeof g.toast !== 'function') return;
    if (/debug=1/.test(location.search) && !/enghint=1/.test(location.search)) return;
    try { if (g.state().engHint) return; } catch (e) { return; }
    // через ~2,5 с за рулём (посадка доиграла, тосты въезда успели встать в очередь); вышла или уже включила звук — до
    // следующей посадки. На экране другой тост (в горах — название дороги, подсказка про газ) — ждём, пока уйдёт, иначе
    // очередь сократит этот до 1,4 с
    let tries = 0;
    const show = () => {
      hintTimer = 0;
      let st = null; try { st = g.state(); } catch (e) { st = null; }
      if (!st || st.engHint || !M.driving || !gameSoundOff()) return;
      if (document.querySelector('.toast:not(.out)') && ++tries < 10) { hintTimer = setTimeout(show, 1500); return; }
      st.engHint = 1; try { g.save(); } catch (e) { /* ignore */ }
      const b = document.getElementById('hudSound'), r = b ? b.getBoundingClientRect() : null;
      const vis = !!(r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(b).visibility !== 'hidden');
      try { g.toast(vis ? 'Нажми 🔇 справа вверху — и услышишь мотор' : 'Включи «Звук» в меню ☰ — и услышишь мотор', 3600); } catch (e) { /* ignore */ }
      if (vis) { try { if (b.animate) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 560, iterations: 3, delay: 250 }); } catch (e) { /* ignore */ } }
      else if (window.HUD && HUD.menu && HUD.menu.news) { try { HUD.menu.news('sound', true); hintNews = true; } catch (e) { /* ignore */ } }
    };
    hintTimer = setTimeout(show, 2500);
  }
  // звук включили — точка на строке «Звук» больше не нужна
  function hintClear() { hintNews = false; try { if (window.HUD && HUD.menu && HUD.menu.news) HUD.menu.news('sound', false); } catch (e) { /* ignore */ } }

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
  function attachMeter(n) { try { n.meter = n.ac.createAnalyser(); n.meter.fftSize = 2048; n.dk.connect(n.meter); } catch (e) { n.meter = null; } }
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
    return { awake: !!awake, kind, rpm: Math.round(M.rpm), gear: M.gear, start: +Math.min(9, M.startT).toFixed(2), load: +M.load.toFixed(2), on: +M.on.toFixed(2), vol: +M.vol.toFixed(4), cut: Math.round(M.cut), freq: +M.freq.toFixed(2), noise: +M.nv.toFixed(4), dem: +M.dem.toFixed(2), wind: +M.wv.toFixed(4), duck: performance.now() < M.duckT ? M.duckK : 1, driving: M.driving, muted: soundOff(), ctx: awake ? awake.ac.state : ownAC ? ownAC.state : null, gain: awake ? +awake.out.gain.value.toFixed(4) : 0, dk: awake ? +awake.dk.gain.value.toFixed(3) : 1 };
  }

  window.EngineSound = { setKind, update, park, duck, stop, setMuted, debug, meter, KINDS, get kind() { return kind; } };
})();
