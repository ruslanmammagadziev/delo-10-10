/* =====================================================================
   ПЕСНЯ ДВОРА СВАДЬБЫ (просьба автора: «чтобы при входе на танцпол играла песня» — его запись, audio/wedding.<хэш>.mp3,
   7 мин 20 с, 96 ударов в минуту; запись склеена на ~97 с — вступление на ~0,1 с позже остальной сетки и чуть быстрее,
   поэтому сетка ударов из двух отрезков (GRID), проверена по окнам 10 с по всей записи: уход не больше ±10 мс).
   Музыканты двора (зурна и барабан, js/village/wedding.js) как будто играют эту песню: своей синтезированной музыки у двора нет,
   барабан мини-игры «в такт» при живой песне молчит — удары и нажатия идут по песне (beat(), wedding.js dance.sync); удары
   барабанщика, зурна, круг танцоров и хлопки гостей — тоже по beat() (часы двора wedding.js: 96 в минуту, удар — на бочку).
   Громкость — по месту героини: громче всего в круге танца и у музыкантов, к стенам двора тише (до −9 дБ), за стеной —
   глухо (низкие частоты: стена «съедает» верх) и едва слышно, напротив ворот — чуть яснее; дальше ~38 м от ограды — тишина.
   Всё плавно: громкость и «глухость» едут к цели экспонентой (вверх ~0,35 с, вниз ~0,45 с — выход за ворота затихает за
   1–2 с), без скачков. Вышла из слышимости дольше 2,5 с — песня на паузе и ждёт: вернулась — продолжает с того же места.
   По кругу без щелчка: конец записи сам уходит в тишину (затухание 4 с); громкость стыка в ноль расписывается заранее по
   часам аудио (за ~1 с до конца, не по кадрам), после стыка начало входит за 80 мс (начало записи — сразу со звука).
   Цепочка (WebAudio): <audio> (поток, файл целиком в память не раскладывается: 7 мин PCM ≈ 160 МБ) →
   MediaElementAudioSourceNode → «глухость» (lowpass) → стык → громкость → шина музыки игры G.audioBus('music') (у шины
   ограничитель общий со всеми звуками). Стенд без игры (village.html) — свой AudioContext с тем же ограничителем.
   iPhone: HTMLMediaElement.volume там не работает — громкость только узлами WebAudio. play() со звуком WebKit разрешает
   только элементу, которого хоть раз касались в жесте, — поэтому элемент (ещё без файла и без узлов) создаётся первым же
   касанием игры, где бы ни была героиня, и «разрешается» в нём load() (файла нет — ничего не грузится): во двор можно
   попасть и без касания (большая карта «Поехать сюда» из города, шторка). Файл и узлы — потом, по LOAD_R. Элемент с файлом,
   ещё ни разу не игравший, касание прогревает с выключенным звуком элемента (muted): play и снова пауза — беззвучный элемент
   сессию звука не берёт и чужую музыку не останавливает. Отказ play() без жеста — повтор на следующем касании, без
   второго экземпляра: элемент и узлы — одни на всю игру. Сессию звука (navigator.audioSession) модуль сам не трогает: ею
   управляет js/engine.js — модуль только говорит, когда песня РЕАЛЬНО играет: G.bgActive('song', true) после настоящего
   play() (не прогрева), false — на паузе, остановке, ошибке файла и dispose(). Пока фон звучит (мотор или песня) — 'playback'
   (звук и при беззвучном переключателе, чужая музыка встаёт), смолк — через 3 с снова 'auto'. Свёрнутая игра — пауза
   элемента сразу, в том же обработчике (иначе <audio> мог бы играть в фоне при 'playback').
   Нет WebAudio (или страница открыта файлом — там MediaElementSource отдаёт нули) — запасной путь: громкость самого
   элемента; там, где и громкости элемента нет (iOS), — тишина, а не песня на полную громкость поверх игры.
   Файл грузится лениво: только когда героиня ближе LOAD_R к двору и фон игры звучит (не при старте игры и не в городе;
   пустой элемент первого касания сети не трогает). Стенд без игры — элемент с первым касанием после первого шага update().
   Песня — фон игры, как мотор машин (желание автора: «песня на свадьбе звучит сама, без кнопки „Звук“»): режим звука
   js/engine.js — G.ambOn(): 'bg' («Звук» не трогали — так у всех по умолчанию и у старых сохранений) и 'on' — играет;
   'off' (выключила сама) — тишина за ~0,15 с и пауза (G.onSound — сразу, не ждать шага); включили во дворе — песня плавно
   появляется в том же касании. Уважает свёрнутую игру /
   Telegram (сразу пауза, вернулась — продолжение), окна диалога и карточки (o.duck: приглушение до 0,45 ≈ −7 дБ), выход из
   региона и раннер (stop / pause), «мёртвую руку»: шаги перестали приходить (пауза, шторка, карусель образов) — громкость
   сама уходит в ноль внутри аудио через 0,9 с, через 1,6 с без шагов элемент встаёт на паузу.
   CONFIG.WEDDING_SONG: false — песни нет совсем; строка — другой путь к файлу (по умолчанию FILE ниже).

   API: window.VILLAGE.weddingSong = {
     update(dt, hero{x,y,z} | null, yard, o?) — каждый кадр региона. yard — ручка VILLAGE.wedding.build (поле acoustics) или
       сами acoustics { x, y, z, ry, hx, z0, z1, top, circle:[x,z,r], band:[x,z,r]|null, gate:[x,w]|null } (оси двора);
       hero/yard = null — героиня не у двора (другой регион): песня затихает. o.duck — окно диалога / карточка;
     pause(sec?) — затихнуть за sec (0,4) и встать на паузу (раннер, шторка); место в песне помнит;
     stop(sec?) — ушла из места: то же и забыть двор; dispose() — отпустить всё (элемент, узлы, слушатели);
     beat() → доля удара песни (растёт монотонно и через стык; целое — удар бочки) или null, если песню сейчас не слышно;
     level(hero, yard) → { k, db, cut, dOut, dLoud, inYard, open } — громкость по месту без звука (для проверок);
     setMuted(b) — свой выключатель поверх «Звук»; debug() → состояние; meter() → { rms, peak } после громкости; _seek(t) — проверки;
     FILE, BPM, LOAD_R }
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // файл — в audio/ рядом со страницей (index.html, world.html, village.html и сборка site/index.html + site/audio/):
  // имя с хэшем содержимого (sha1, 8 знаков) — кэш навсегда (vercel.json), новая запись — новое имя
  const FILE = 'audio/wedding.af6f4bc4.mp3';
  // сетка ударов записи: [с какого времени, удар № 0 сетки, период], с. Запись склеена на ~97 с (между ударами 96,92 и
  // 97,46 — 0,54 с вместо 0,625): вступление — 0,696 + k·0,62486, дальше — 0,58 + k·0,62505 (96,0 в минуту). Номера ударов
  // по обе стороны склейки подряд (154 → 155), доля при переходе прыгает вперёд на 0,14 — без лишнего и без пропавшего удара.
  // Одной сеткой (0,58) все удары вступления (22 % петли) шли на 0,09–0,12 с позже — нажатие точно в удар было «good»
  const BPM = 96, GRID = [[0, 0.696, 0.62486], [97.0, 0.58, 0.62505]];
  const beatAt = t => { const s = t < GRID[1][0] ? GRID[0] : GRID[1]; return (t - s[1]) / s[2]; };
  // громкость у круга (мерено на выходе игры, после ограничителя игры; вся цепочка — шина музыки 0,55 и ограничитель): у круга
  // −21…−21,5 LUFS (запись −15,4 LUFS), у ворот внутри −24, в углу двора −28, за стеной −36, в 12 м за стеной −48. Для сравнения
  // на том же выходе: мотор на полном ходу −19,5 LUFS, звук «ok» — до −25 LUFS за 85 мс. Тише песню не делали: у круга она —
  // главное, а реплики в игре текстом (голоса выключены, CONFIG.VOICES) — заглушать нечего; окна диалога песню приглушают (DUCK)
  const BASE = 0.47;
  // запасной путь без WebAudio: громкость элемента у круга (мимо шины и ограничителя игры: запись −15,4 LUFS × 0,5 ≈ −21 LUFS —
  // как у круга на главном пути)
  const EL_K = 0.5;
  // м от середины двора: ближе — файл начинает грузиться. Не 80: въезд (стоянка за комбинатом) — в 67 м от двора, а песню
  // слышно с ~48 м (38 м от ограды) — грузится, когда героиня пошла к площади, а не сразу по приезде (и не по дороге к отелю)
  const LOAD_R = 60;
  const DUCK = 0.45;            // окно диалога / карточка
  const ON = 0.002, OFF = 0.0012;   // играть громче ON (≈ −54 дБ); тише OFF дольше QUIET_S — пауза
  const QUIET_S = 2.5;
  // «мёртвая рука»: шагов нет дольше DEAD_S — громкость сама уходит в ноль (внутри аудио); дольше HALT_S — пауза. Не 0,35 с, как
  // у мотора: долгий кадр (сборка шейдера, сборщик мусора, слабый телефон) не должен «проваливать» песню посреди двора
  const DEAD_S = 0.9, HALT_S = 1.6;
  const T_UP = 0.35, T_DN = 0.45;   // постоянные времени громкости (с)

  /* ---------- состояние ---------- */
  let el = null, path = null, ac = null, src = null, lp = null, lg = null, g = null, out = null, ownAC = null, ownOut = null, an = null;
  let muted = false, hidden = !!document.hidden, disposed = false;
  let pending = false, pauseAfter = false, needGesture = false, unlocked = false, primed = false;
  let target = 0, cur = 0, cut = 20000, quietAt = 0, lastUpd = 0, lastWrite = 0, lastT = 0, loops = 0, seamMuted = false, pos = 0;
  let fails = 0, failT = 0, watch = 0, lastLv = null, yardRef = null, expectAt = -1, holdUntil = 0;
  const stats = { creates: 0, sources: 0, plays: 0, playOk: 0, pauses: 0, rejects: 0, errors: 0, warms: 0, primes: 0, wraps: 0, gestures: 0, seamOut: 0, seamIn: 0, seamBy: null };

  const conf = () => (window.CONFIG ? CONFIG.WEDDING_SONG : undefined);
  const fileUrl = () => (typeof conf() === 'string' && conf() ? conf() : FILE);
  // фон игры звучит (G.ambOn: «Звук» не выключали — режимы 'bg' и 'on'; старая игра без режимов — «Звук» вкл; стенд без
  // игры — всегда «да»), свой выключатель, свёрнутая игра, автор выключил песню
  function soundOn() {
    if (muted || hidden || disposed || conf() === false) return false;
    const gg = window.G;
    if (gg && typeof gg.ambOn === 'function') { try { return !!gg.ambOn(); } catch (e) { return false; } }
    if (gg && typeof gg.state === 'function') { try { const st = gg.state(); return !!(st && st.sound); } catch (e) { return false; } }
    return true;
  }
  // песня реально играет (не прогрев) — игре (js/engine.js): iPhone держит режим «воспроизведение», пока фон звучит.
  // Ключ один — повторы безвредны (множество, не счётчик)
  let bgOn = false;
  function bg(on) {
    on = !!on; if (on === bgOn) return; bgOn = on;
    const gg = window.G; if (gg && typeof gg.bgActive === 'function') { try { gg.bgActive('song', on); } catch (e) { /* ок */ } }
  }
  // смена режима звука (тап «Звук», облако, сброс): «выкл» — тишина и пауза сразу, не дожидаясь шага (ворота игры фон и так
  // закрыли); «вкл»/«не трогали» — песню вернёт шаг (у двора — плавно). Подписка — один раз, при первом шаге
  let unsub = null;
  function subscribe() {
    const gg = window.G; if (unsub || !gg || typeof gg.onSound !== 'function') return;
    try { unsub = gg.onSound(m => { if (m === 'off' && el) pause(0.15); }); } catch (e) { unsub = null; }
  }

  /* ---------- громкость по месту ----------
     Оси двора: x — поперёк (−hx…hx, с галереями), z — вглубь (z0 — фасад дома, z1 — стена с воротами). Громкое место —
     круг танца и музыканты (до их края — 0 дБ), от него −0,75 дБ на метр, не тише −9 дБ (дальний угол двора ≈ −8).
     Снаружи: уровень у ближайшей точки ограды − стена (до 16 дБ, набирается за 2 м от неё; напротив ворот и сверху, над
     стенами, — открыто: до 6,4 дБ) − 0,5 дБ на метр, и к 38 м от ограды — в ноль. «Глухость»: срез верха 20 кГц во дворе,
     1,5 кГц за стеной (лог-шкала), открытое место — посередине */
  function acoustics(yard) {
    if (!yard) return null;
    if (yard.acoustics) return yard.acoustics;
    if (yard.circle && isFinite(yard.hx)) return yard;
    // старый модуль двора без acoustics: середина двора — круг, ограда — двор с галереями (places.wedding)
    if (isFinite(yard.x) && isFinite(yard.w) && isFinite(yard.d)) {
      const hx = yard.w / 2 + (yard.gal || 0) + (yard.wall || 0), hd = yard.d / 2;
      return { x: yard.x, y: yard.y || 0, z: yard.z, ry: yard.ry || 0, hx, z0: -hd, z1: hd + (yard.wall || 0), top: 5, circle: [0, 0, 2.5], band: null, gate: null };
    }
    return null;
  }
  const loudAt = (A, lx, lz) => {
    const c = A.circle, b = A.band;
    let d = Math.max(0, Math.hypot(lx - c[0], lz - c[1]) - c[2]);
    if (b) d = Math.min(d, Math.max(0, Math.hypot(lx - b[0], lz - b[1]) - b[2]));
    return d;
  };
  function level(hero, yard) {
    const A = acoustics(yard);
    if (!A || !hero || !isFinite(hero.x) || !isFinite(hero.z)) return { k: 0, db: -120, cut: 1500, dOut: 1e9, dLoud: 1e9, dCenter: 1e9, inYard: false, open: 0 };
    const c = Math.cos(A.ry || 0), s = Math.sin(A.ry || 0), dx = hero.x - A.x, dz = hero.z - A.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c, ly = (isFinite(hero.y) ? hero.y : A.y) - A.y;
    const cx = clamp(lx, -A.hx, A.hx), cz = clamp(lz, A.z0, A.z1);
    const up = Math.max(0, ly - (A.top || 5));
    const dOut = Math.hypot(lx - cx, lz - cz, up);
    const base = -Math.min(9, 0.75 * loudAt(A, cx, cz));
    let open = sst(0, 3, up);
    if (A.gate && lz > A.z1 - 0.3) {
      // проём ворот: «конус» от проёма наружу — чем дальше от стены, тем шире
      const half = A.gate[1] / 2, lat = Math.abs(lx - A.gate[0]);
      open = Math.max(open, 1 - sst(half, half + 1.0 + 0.6 * Math.max(0, lz - A.z1), lat));
    }
    const wall = 16 * (1 - 0.6 * open) * sst(0, 2, dOut);
    const db = base - wall - 0.5 * dOut;
    const k = Math.pow(10, db / 20) * (1 - sst(10, 38, dOut));
    const o2 = Math.max(1 - sst(0, 2, dOut), 0.55 * open);
    return { k, db: k > 0 ? 20 * Math.log10(k) : -120, cut: 1500 * Math.pow(20000 / 1500, o2), dOut, dLoud: dOut > 0 ? 1e9 : loudAt(A, lx, lz), dCenter: Math.hypot(dx, dz), inYard: dOut === 0, open };
  }

  /* ---------- куда играть: шина музыки игры или свой контекст (стенд) ---------- */
  function output() {
    const gg = window.G;
    if (gg && typeof gg.audioBus === 'function') {
      let b = null; try { b = gg.audioBus('music'); } catch (e) { b = null; }
      return b && b.context ? { ac: b.context, out: b } : null;
    }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      if (!ownAC) {
        ownAC = new AC();
        // как у игры (engine.js): ограничитель на выходе, шина музыки 0,55 — громкость стенда та же, что в игре
        const comp = ownAC.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
        ownOut = ownAC.createGain(); ownOut.gain.value = 0.55; ownOut.connect(comp); comp.connect(ownAC.destination);
      }
    } catch (e) { return null; }
    return { ac: ownAC, out: ownOut };
  }

  /* ---------- элемент и узлы: один раз за игру ---------- */
  function volOk(e) { try { e.volume = 0.5; const ok = Math.abs(e.volume - 0.5) < 0.01; e.volume = 1; return ok; } catch (x) { return false; } }
  // сам элемент — без файла и без узлов (первое касание игры его «разрешает», см. onGesture)
  function makeEl() {
    if (el || disposed) return !!el;
    try {
      el = document.createElement('audio');
      el.preload = 'auto'; el.loop = true; el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
      try { el.disableRemotePlayback = true; } catch (e) { /* ок */ }
      el.addEventListener('playing', onPlaying);
      el.addEventListener('seeked', onSeeked);
      el.addEventListener('pause', onPauseEv);
      el.addEventListener('error', onError);
      stats.creates++;
      return true;
    } catch (e) { console.warn('WeddingSong: create', e); el = null; return false; }
  }
  // файл и узлы (героиня ближе LOAD_R): путь звука выбирается здесь, один раз
  function create() {
    if (path || disposed) return !!path;
    const o = output(); if (!o) return false;   // фон выключен («Звук» — 'off') или касания ещё не было — ни файла, ни контекста
    if (!makeEl()) { path = 'none'; return false; }
    try {
      // WebAudio — главный путь; страница файлом (file://): MediaElementSource там молчит (CORS) — громкость элемента
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && location.protocol !== 'file:') {
        try {
          ac = o.ac; out = o.out;
          src = ac.createMediaElementSource(el); stats.sources++;
          lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 20000;
          lg = ac.createGain(); lg.gain.value = 1;
          g = ac.createGain(); g.gain.value = 0;
          src.connect(lp); lp.connect(lg); lg.connect(g); g.connect(out);
          if (meterOn) attachMeter();
          path = 'webaudio';
        } catch (e) { console.warn('WeddingSong: WebAudio', e); src = null; path = null; }
      }
      if (!path) path = volOk(el) ? 'element' : 'none';   // iOS без WebAudio: громкость не задать — молчим
      if (path === 'element') el.volume = 0;
      el.src = fileUrl();
      if (!watch) watch = setInterval(checkAlive, 400);
      return true;
    } catch (e) { console.warn('WeddingSong: create', e); path = 'none'; return false; }
  }
  // iOS после долгого фона мог выгрузить данные, и play() пошёл с нуля — вернуть место. Только первый 'playing' после нашего
  // play(): Chrome шлёт 'playing' и на стыке петли — там время законно с нуля, старое место туда не тянем
  function onPlaying() {
    const at = expectAt; expectAt = -1;
    if (at > 2 && el.currentTime < 1 && at < (el.duration || 1e9) - 2) { try { el.currentTime = at; } catch (e) { /* ок */ } }
  }
  // неудача загрузки считается только здесь (событие 'error' элемента): play() в ту же минуту отказывает с NotSupportedError —
  // второй раз неудачу не считаем, иначе «три попытки» таяли до одной повторной
  function onError() {
    stats.errors++; fails++; failT = performance.now(); pending = false; bg(false);
    console.warn('WeddingSong: файл не загрузился (' + fails + ')', el && el.error ? el.error.code : '');
  }
  // элемент встал не нашей паузой (iOS: звонок, другое приложение забрало звук) — фон больше не звучит. Пока ждём свой
  // play() (pending) — не верим: это запоздавшее событие прошлой паузы
  function onPauseEv() { if (el && el.paused && !pending) bg(false); }
  // перемотка завершилась — в том числе петля (браузер на конце записи перематывает в начало): вход после стыка сразу по
  // событию, а не на следующем кадре (на медленных кадрах начало песни ждало бы кадр в тишине)
  function onSeeked() {
    if (!el) return;
    const tc = el.currentTime;
    if (tc < lastT - 1) { loops++; stats.wraps++; }
    lastT = tc;
    if (seamMuted) seamIn('seeked');
  }

  /* ---------- игра / пауза: без двойного запуска ---------- */
  const ctxRunning = () => path !== 'webaudio' || (ac && ac.state === 'running');
  // warm — беззвучный прогрев в жесте (элемент ещё ни разу не играл): play и сразу пауза на прежнем месте. Контекст тут может
  // ещё спать — не важно, громкость всё равно ноль. Настоящий запуск — только в живой контекст (спит — ждём касания, шаг
  // проверяет каждый кадр), иначе элемент шёл бы молча и песня «убегала» вперёд
  function tryPlay(warm) {
    if (!el || !path || pending || path === 'none' || !el.paused || el.error || performance.now() < holdUntil) return;
    if (!warm && !ctxRunning()) return;
    const p0 = el.currentTime;
    expectAt = warm ? -1 : Math.max(p0, pos);
    pending = true; pauseAfter = !!warm; stats.plays++; if (warm) stats.warms++;
    // прогрев — с выключенным звуком элемента: на iPhone беззвучный элемент не берёт сессию звука (чужая музыка не встаёт),
    // а play() в жесте всё равно снимает с него запрет «только по касанию»
    if (warm) { try { el.muted = true; } catch (e) { /* ок */ } }
    let p = null;
    try { p = el.play(); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(() => {
      pending = false; unlocked = true; needGesture = false; stats.playOk++;
      // прогрев (или, пока ждали, вышла из слышимости) — снова пауза; после прогрева — на то место, где была
      if (pauseAfter || target < OFF) { pauseAfter = false; halt(); if (warm) { pos = p0; try { el.currentTime = p0; } catch (e) { /* ок */ } } }
      else bg(true);   // настоящий запуск: песня звучит
      if (warm) { try { el.muted = false; } catch (e) { /* ок */ } }
    }).catch(e => {
      pending = false; pauseAfter = false;
      if (warm) { try { el.muted = false; } catch (x) { /* ок */ } }
      const n = e && e.name;
      // без жеста (iOS, автозапуск) — повтор на следующем касании; файл не загрузился (NotSupportedError, el.error) — уже
      // посчитало событие 'error'; прочее — передышка 3 с, чтобы шаг не звал play() каждый кадр
      if (n === 'NotAllowedError') { needGesture = true; stats.rejects++; }
      else if (n !== 'AbortError' && n !== 'NotSupportedError' && !(el && el.error)) { holdUntil = performance.now() + 3000; stats.rejects++; console.warn('WeddingSong: play()', n || e); }
    });
  }
  function halt() {
    if (!el) return;
    if (pending) { pauseAfter = true; return; }
    if (!el.paused) { pos = el.currentTime; try { el.pause(); } catch (e) { /* ок */ } stats.pauses++; }
    bg(false);
  }
  // сразу тихо (свернули, выключили звук), потом пауза
  function hush(tc) {
    target = 0; cur = 0;
    if (path === 'webaudio' && g) { try { const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, tc || 0.03); } catch (e) { /* ок */ } }
    else if (path === 'element' && el) el.volume = 0;
  }
  // стык петли: громкость стыка (lg) в ноль — заранее, по часам аудио (left — сколько осталось до конца записи, с): с 0,3 до
  // 0,06 с до конца, там затухание записи уже ниже −65 дБ — не слышно. Расписание не зависит от кадров: прежде заглушение
  // ждало кадр на последних 0,12 с, на медленном кадре начало песни успевало прозвучать, потом провал, потом вход — «запинка»
  function seamOut(left) {
    try {
      const t = ac.currentTime, a = Math.max(t, t + left - 0.3), b = Math.max(a + 0.02, t + left - 0.06);
      lg.gain.cancelScheduledValues(t); lg.gain.setValueAtTime(1, a); lg.gain.linearRampToValueAtTime(0, b);
      seamMuted = true; stats.seamOut++;
    } catch (e) { /* узел закрыт */ }
  }
  // вход после стыка — за 80 мс от того, что есть сейчас (ноль после seamOut; перемотали до заглушения — 1, провала нет)
  function seamIn(why) {
    seamMuted = false; stats.seamIn++; stats.seamBy = why;
    try { const t = ac.currentTime, v = lg.gain.value; lg.gain.cancelScheduledValues(t); lg.gain.setValueAtTime(v, t); lg.gain.linearRampToValueAtTime(1, t + 0.08); } catch (e) { /* узел закрыт */ }
  }

  /* ---------- шаг ---------- */
  function update(dt, hero, yard, o) {
    if (disposed) return;
    const now = performance.now();
    lastUpd = now; dt = clamp(+dt || 0, 0, 0.1);
    yardRef = yard || null;
    if (!unsub) subscribe();
    const on = soundOn();
    const lv = yard && hero ? level(hero, yard) : null; lastLv = lv;
    // ленивая загрузка: фон звучит (и в 'bg' — «Звук» не трогали) и героиня ближе LOAD_R к двору (повтор после ошибки —
    // через 30 с, не больше трёх раз)
    if (on && lv && lv.dCenter < LOAD_R && !path) create();
    if (el && fails && fails < 3 && now - failT > 30000 && el.error) { failT = now; try { el.src = fileUrl(); el.load(); } catch (e) { /* ок */ } }
    target = on && lv && el && path && !(el.error) ? BASE * lv.k * (o && o.duck ? DUCK : 1) : 0;
    if (!el || !path) return;   // элемента ещё нет или он пустой (файла ещё не просили)
    // тишина считается по часам, а не по шагам (dt шага обрезан 0,1 с: на медленных кадрах пауза затянулась бы)
    if (target > ON) { quietAt = 0; if (el.paused && !needGesture) tryPlay(false); }   // отказ без жеста — ждём касания (onGesture)
    else if (target < OFF) { if (!quietAt) quietAt = now; if (now - quietAt > QUIET_S * 1000 && (!el.paused || pending)) halt(); }
    if (lv) cut = lv.cut;
    // стык петли: за ~1,2 с до конца — заглушение по часам аудио (seamOut, хватит и 2 кадров в секунду), вход — по 'seeked'
    // (onSeeked), здесь — запасной путь: стык пройден (время прыгнуло назад), а события не было. Если кадров перед концом
    // не было вовсе (заглушить не успели) — начало уже звучит, его не глушим: провал посреди звука хуже резкого начала
    if (!el.paused) {
      const tc = el.currentTime, dur = el.duration;
      if (tc < lastT - 1) { loops++; stats.wraps++; if (seamMuted) seamIn('frame'); }
      lastT = tc;
      if (path === 'webaudio' && lg && isFinite(dur) && dur > 2) {
        const left = dur - tc;
        if (!seamMuted && left < 1.2 && left > 0.005) seamOut(left);
        else if (seamMuted && left > 1.5) seamIn('away');   // заглушили, а песня уже не у конца (перемотка)
      }
    }
    // запись громкости — не чаще ~30 раз в секунду (проверки гоняют шаг сотни раз за кадр)
    if (now - lastWrite < 33) return;
    lastWrite = now;
    if (path === 'webaudio' && g) {
      try {
        const t = ac.currentTime, v = g.gain.value;
        g.gain.cancelScheduledValues(t);
        // ещё не играет (ждёт файл, касание или живой контекст) — держим ноль: пойдёт — песня появится, а не включится
        if (el.paused || pending) { g.gain.setValueAtTime(0, t); cur = 0; }
        else {
          // фон выключили («Звук» — 'off', свернули) — тишина сразу (~0,3 с), а не уходом за ворота
          g.gain.setTargetAtTime(target, t, !on ? 0.08 : target > v ? T_UP : T_DN);
          // «мёртвая рука»: шаги не пришли (пауза, шторка, раннер) — через DEAD_S громкость сама уходит в ноль
          g.gain.setTargetAtTime(0, t + DEAD_S, 0.2);
        }
        lp.frequency.setTargetAtTime(cut, t, 0.3);
      } catch (e) { /* узел закрыт */ }
    } else if (path === 'element') {
      // без WebAudio — та же плавность шагом кадра (громкость элемента — линейная доля 0..1)
      const k = 1 - Math.exp(-dt / (target > cur ? T_UP : T_DN));
      el.volume = clamp((cur + (target - cur) * k) * EL_K / BASE, 0, 1);
    }
    if (path === 'webaudio' && g) cur = el.paused || pending ? 0 : g.gain.value;
    else cur = el.paused ? 0 : cur + (target - cur) * (1 - Math.exp(-Math.max(dt, 0.033) / (target > cur ? T_UP : T_DN)));
  }
  // шаги перестали приходить дольше HALT_S (раннер, шторка, карусель образов, вышла из региона) — пауза, место помнит
  function checkAlive() {
    if (!el) return;
    if (performance.now() - lastUpd > HALT_S * 1000) { target = 0; cur = 0; if (!el.paused || pending) halt(); if (path === 'element') el.volume = 0; }
  }
  function pause(sec) { hush(Math.max(0.01, (sec == null ? 0.4 : sec) / 3)); setTimeout(() => { if (target < OFF) halt(); }, Math.max(60, (sec == null ? 0.4 : sec) * 1000 + 80)); }
  function stop(sec) { yardRef = null; lastLv = null; pause(sec); }
  function setMuted(b) { muted = !!b; if (muted) pause(0.3); }
  function dispose() {
    disposed = true; hush(0.01); bg(false);
    if (unsub) { try { unsub(); } catch (e) { /* ок */ } unsub = null; }
    if (watch) { clearInterval(watch); watch = 0; }
    document.removeEventListener('visibilitychange', onVis);
    GEST.forEach(ev => { document.removeEventListener(ev, onGesture, true); document.removeEventListener(ev, onGesture, false); });
    if (el) { try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) { /* ок */ } el.removeEventListener('playing', onPlaying); el.removeEventListener('seeked', onSeeked); el.removeEventListener('pause', onPauseEv); el.removeEventListener('error', onError); }
    setTimeout(() => { try { if (g) g.disconnect(); if (src) src.disconnect(); if (lp) lp.disconnect(); if (lg) lg.disconnect(); if (an) an.disconnect(); } catch (e) { /* ок */ } src = lp = lg = g = an = null; }, 80);
    if (ownAC) { try { ownAC.close(); } catch (e) { /* ок */ } ownAC = null; }
    el = null; yardRef = null;
  }

  // часы ритма для мини-игры «в такт»: только пока песню слышно (иначе барабан игры, как раньше)
  function beat() {
    if (!el || !path || el.paused || pending || path === 'none' || el.readyState < 2 || target < 0.02) return null;
    return loops * 10000 + beatAt(el.currentTime);
  }

  /* ---------- свёрнутая игра / Telegram: пауза сразу; касание — «будит» ----------
     Пауза — в том же обработчике, не таймером: на iOS после ухода в фон JS и таймеры могут встать сразу, а <audio> при
     сессии 'playback' (сессией владеет js/engine.js) — играть дальше в усыплённый контекст (место «убегает», плашка «Сейчас играет»).
     Обрыв без затухания — в ту же секунду, когда игру сворачивают (контекст игры движок в этом событии и так усыпляет) */
  function onHide(h) {
    hidden = !!h;
    if (hidden) { hush(0.02); halt(); if (ownAC) { try { ownAC.suspend(); } catch (e) { /* ок */ } } }
    else if (ownAC && !muted) { try { ownAC.resume(); } catch (e) { /* ок */ } }
  }
  const onVis = () => onHide(document.hidden);
  document.addEventListener('visibilitychange', onVis);
  try { const TG = window.Telegram && window.Telegram.WebApp; if (TG && TG.onEvent) { TG.onEvent('deactivated', () => onHide(true)); TG.onEvent('activated', () => onHide(document.hidden)); } } catch (e) { /* ок */ }
  // касание: контекст просыпается (iOS), отказанный play() — повтор в жесте, а элемент, ещё ни разу не игравший, —
  // беззвучный прогрев (play и сразу пауза): дальше play() без жеста разрешён (iOS снимает запрет с элемента после первого)
  // Слушаем и до, и после обработчиков кнопок: «🔊» нажали у двора — в том же касании (после переключения) элемент
  // создаётся и запускается, iPhone не ждёт следующего касания.
  // Далеко от двора (город, дорога, другой край региона) — элемент без файла: load() в жесте снимает с него запрет WebKit
  // «звук только по касанию» (как тихий элемент js/engine.js), файла нет — сети нет. Во двор можно попасть без касания
  // (большая карта «Поехать сюда», шторка) — песня всё равно пойдёт сама. В игре — с первого касания; на стенде — после
  // первого шага (стенд с ?song=0 модуль не зовёт — элемента нет)
  function onGesture() {
    if (disposed || hidden) return;
    const on = soundOn(), want = on && lastLv && yardRef && BASE * lastLv.k > ON;
    if (on && !path && lastLv && yardRef && lastLv.dCenter < LOAD_R) create();
    else if (on && !el && (window.G || lastUpd > 0)) makeEl();
    if (!el) return;
    if (!path) { if (on && !primed) { primed = true; stats.primes++; try { el.load(); } catch (e) { /* ок */ } } return; }
    stats.gestures++;
    const a = path === 'webaudio' ? ac : null;
    if (a && a.state !== 'running' && on) { try { a.resume(); } catch (e) { /* ок */ } }
    if (!el.paused || pending) return;
    if (want && (needGesture || target <= ON)) { needGesture = false; target = Math.max(target, ON * 1.01); tryPlay(!ctxRunning()); }
    else if (!unlocked && on) { needGesture = false; tryPlay(true); }
  }
  const GEST = ['touchend', 'pointerup', 'click', 'keydown'];
  GEST.forEach(ev => { document.addEventListener(ev, onGesture, { capture: true, passive: true }); document.addEventListener(ev, onGesture, { passive: true }); });

  /* ---------- проверка: состояние и измеритель после громкости ---------- */
  let meterOn = false, meterBuf = null;
  function attachMeter() { try { an = ac.createAnalyser(); an.fftSize = 2048; g.connect(an); } catch (e) { an = null; } }
  function meter() {
    if (!meterOn) { meterOn = true; if (g && !an) attachMeter(); }
    if (!an) return { rms: 0, peak: 0 };
    if (!meterBuf) meterBuf = new Float32Array(2048);
    an.getFloatTimeDomainData(meterBuf);
    let s = 0, p = 0; for (let i = 0; i < meterBuf.length; i++) { const x = meterBuf[i]; s += x * x; if (Math.abs(x) > p) p = Math.abs(x); }
    return { rms: Math.sqrt(s / meterBuf.length), peak: p };
  }
  function debug() {
    return {
      path, loaded: !!(el && path), el: !!el, primed, src: el ? el.currentSrc || el.src : null, ready: el ? el.readyState : 0, paused: el ? el.paused : true, pending, needGesture, unlocked,
      t: el ? +el.currentTime.toFixed(2) : 0, dur: el && isFinite(el.duration) ? +el.duration.toFixed(2) : null, loops, pos: +pos.toFixed(2),
      target: +target.toFixed(4), cur: +cur.toFixed(4), gain: g ? +g.gain.value.toFixed(4) : el && path === 'element' ? +el.volume.toFixed(4) : 0, seam: lg ? +lg.gain.value.toFixed(3) : 1,
      cut: lp ? Math.round(lp.frequency.value) : null, ctx: ac ? ac.state : null, own: !!ownAC, on: soundOn(), bg: bgOn, elMuted: el ? el.muted : null, hidden, muted,
      lv: lastLv ? { k: +lastLv.k.toFixed(4), db: +lastLv.db.toFixed(1), dOut: +lastLv.dOut.toFixed(1), dCenter: +lastLv.dCenter.toFixed(1), inYard: lastLv.inYard, open: +lastLv.open.toFixed(2) } : null,
      beat: beat(), yard: !!yardRef, stats: Object.assign({}, stats),
    };
  }

  // для проверок: перемотать песню (с) — замеры громкости в одном и том же месте записи, стык петли
  function seek(t) { if (!el) return false; try { el.currentTime = Math.max(0, +t || 0); pos = el.currentTime; lastT = pos; return true; } catch (e) { return false; } }

  V.weddingSong = { update, pause, stop, dispose, beat, level, setMuted, debug, meter, _seek: seek, FILE, BPM, LOAD_R, get BASE() { return BASE; } };
})();
