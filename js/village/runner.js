/* =====================================================================
   БЕГ ПО КУБАЧИ — бесконечный раннер в стиле Subway Surfers: ЯДРО (цикл, ввод, физика, препятствия, генератор, монеты,
   усилители, пальтар, камера, счёт, состояния). Отдельный режим поверх мира, сюжет не трогает.
   Обычный <script>: window.VILLAGE.runner. Нужен THREE r149. Графика — VILLAGE.runnerKit (js/village/runner_kit.js), героиня
   и пальтар — VILLAGE.runnerActors (runner_actors.js), экраны и HUD — VILLAGE.runnerUI (runner_ui.js). Нет модуля (или он упал
   в create) — своя простая заглушка (коробки по габаритам каталога, капсула, DOM-HUD): игра и логика те же.
   Подробности, тонкости и замеры — NOTES.md роли CORE (скретч волны «Бег по Кубачи»).

   VILLAGE.runner
     title(named, plain) → строка меню «🏃 Бег по Кубачи» (named === false — «🏃 Бег по горному селу»; plain — без значка)
     available()         → есть WebGL и открыт CONFIG.UNLOCK.runner (Missions.unlock('runner'); нет ключа или модуля — открыто)
     open(host, dbg?)    → Promise<api> (после первого кадра заставки). host = { THREE, renderer, root (DOM-контейнер раннера),
                           hero?, anim?, quality, named, season, save: { get(), set(obj) }, sfx(name, o), haptic(kind),
                           pauseWorld(), resumeWorld(), music?(cmd, o), onClose?(result) }. Рисует ТЕМ ЖЕ renderer: свои scene,
                           camera и rAF; мир на паузе (host.pauseWorld() — сразу). Повторный open, пока открыт, — тот же промис.
                           dbg (стенд): { seed, bot: true|{react, late, monkey, ghost}, stage, auto (сразу бежать), tut (подсказки
                           как в первый раз), stub: true|{kit, actors, ui} — свои заглушки вместо модулей, render: false — не
                           рисовать, warm: false — без прогрева }. При open — прогрев (пулы набора, все виды препятствий, шейдеры:
                           ≈ 0,3 с на заставке), в забеге сегмент впрок собирается в простое кадра (requestIdleCallback)
     close()             → освободить всё (сегменты, препятствия, монеты, материалы, слушатели, rAF), host.resumeWorld(),
                           host.onClose(result). Зовётся и само — кнопкой «Выйти»
     session             → api текущего забега или null;  CAT, CFG, STAGES, LANE — каталог и числа (общие с графикой и тестами)
   api (= window.__runner на стенде): state() → снимок; start(seed?) — новый забег; input(dir) — 'left'|'right'|'up'|'down'
     (или 'pause'); bot(on, {react, late, monkey, ghost}); setStage(n); stats(); sim(sec, {fps, render: N, restart, check,
     onCrash}) — промотать без rAF (тесты); near(m); pause(); resume(); close(); events — счётчики событий забега; game —
     внутренности (тесты)
   Генератор: связки рядов, планировщик по полосам — ряд ставится, только если он проходим с КАЖДОЙ полосы, где героиня может
   быть свободна, с запасом реакции ≥ 0,45 с на текущей скорости (см. «ГЕНЕРАТОР» ниже); автопилот и «мартышка» — тесты этого.

   Мир раннера (SPEC): метры, полосы x = −2,4 / 0 / +2,4, земля y = 0, вперёд −z. Логика — в «s» (пройденные метры, double):
   героиня всегда у z = 0 сцены, мир едет к ней (плавающее начало: track.position.z = s − origin, объект — z = −(s_obj − origin),
   origin переносится каждые 256 м; так и через 10 км координаты в кадре маленькие). Шаг физики фиксированный (1/120 с),
   отрисовка — с интерполяцией между двумя последними шагами (нет дрожи при 50/60/90/120 Гц экрана).
   Порядок кадра: шаги (ввод → скорость → движущиеся → полосы → высота → столкновения → монеты → пальтар → генератор)
   → интерполяция → позиции → актёры → камера → небо → HUD → render. В кадре нет выделений памяти (пулы, типизированные
   массивы, переиспользуемые объекты событий и HUD).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = t => t * t * (3 - 2 * t);
  const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
  const INF = Infinity;
  // своё зерно, если vkit ещё не загружен (тот же mulberry32, что VILLAGE.vkit.rng — одинаковые забеги по одному seed)
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rngOf = seed => (V.vkit && V.vkit.rng ? V.vkit.rng(seed) : mulberry(seed));

  /* ---------- числа: полосы, героиня, скорость, этапы ---------- */
  const LANE = 2.4, LX = [-LANE, 0, LANE];
  const CFG = {
    step: 1 / 120, maxSteps: 14,      // 120 Гц: на 20 м/с — 0,17 м за шаг, тонкие жерди (0,3 м) не проскочить без «стреловидных» проверок
    v0: 9, accel: 0.06, vMax: 20,     // SPEC: старт 9 м/с, +0,06 м/с², потолок 20 (≈ 2,7 км, этап 6)
    stageLen: 500, multEvery: 1000, multMax: 5, coinScore: 10,
    hw: 0.28, hd: 0.25,               // полуширина и полутолщина героини для столкновений
    height: 1.65, slideH: 0.9,        // рост и рост в подкате
    jumpH: 1.55, jumpT: 0.75,         // вершина над опорой и полёт на старте; на скорости полёт короче (jumpAt)
    slideT: 0.7, laneT: 0.15,         // подкат и смена полосы на старте (на скорости чуть быстрее)
    stepUp: 0.32,                     // «шагнуть» на опору, если стопы ниже верха опоры не больше чем на это (прыжок на сено, с крыши на лавку)
    // буфер ввода и «прыжок чуть после края крыши»; прыжок ждёт дольше (свайп вверх в воздухе за 0,15–0,25 с до приземления
    // в связке «сено — жердь» иначе молча пропадал: «я же нажала!»)
    buffer: 0.15, bufferUp: 0.25, coyote: 0.1,
    react: 0.45,                      // запас реакции генератора, с (SPEC ≥ 0,45)
    dropV: 17, dropG: 2.4,            // быстрое приземление: сразу вниз и тяжелее
    // «в стену дома» за крайней полосой: насколько качнуться к стене; второй такой же свайп из средней полосы раньше edgeEat
    // после первого — «проскочила», молча (паника «влево-влево» — не удар о стену)
    edgeBump: 0.42, edgeEat: 0.25,
    gapStart: 1.5, gapNear: 2.4, gapFar: 13, gapCatch: 0.85, nearT: 8,   // пальтар: дистанции, м; «рядом» после спотыкания, с
    // погоня видна (а не только слышна): первые openT с забега пальтар бежит прямо за ней (gapOpen), на каждом новом этапе —
    // «рывок» (dashT с на gapDash, со щелчком плётки, без штрафа); спотыкание — сразу не дальше gapStumble (в кадре за ≤ 0,4 с);
    // бубенцы слышно с jingleFar (тише вдали). orbitT — облёт камеры на старте (за спину), с
    gapOpen: 3.2, openT: 3, gapDash: 3.4, dashT: 2.5, gapStumble: 5.5, jingleFar: 16, orbitT: 1.3,
    glideY: 6.0, glideUp: 0.9, glideT: 8, glideDown: 1.4,                 // параплан: высота, подъём, полёт, спуск
    magnetT: 10, x2T: 15, magnetR: 15,
    // segBehindStart — улица позади старта (заставка и облёт смотрят назад: без неё за 30 м был «край света»)
    genAhead: 230, segAhead: 270, segPrefetch: 70, segView: 262, segBehind: 32, segBehindStart: 160, obBehind: 9, obView: 195,   // obView — дальше в тумане (60→250 м) препятствия не рисуем: −вызовы
    coinGap: 2.25, coinY: 0.85, coinsMax: 384,
    trig: 2.4,                        // движущееся начинает идти навстречу за столько секунд до встречи
    camFovP: 64, camFovL: 52, camFovK: 6,
  };
  const LOW = 1, MID = 2, HIGH = 3, BLOCK = 4, RAMP = 5;
  // каталог (SPEC): габарит столкновений w × (y0…y1) × d; top — верх — опора (бегать, «шагнуть»); move — скорость навстречу, м/с;
  // len — длина сарая (8…16). Без top сверху — «пружинка» (корова, бочки: отскок вверх, без штрафа)
  const CAT = {
    hay:     { cls: LOW,   w: 1.9, y0: 0,    y1: 0.9,  d: 1.0, top: true },
    bench:   { cls: LOW,   w: 2.0, y0: 0,    y1: 0.75, d: 0.5, top: true },
    baskets: { cls: LOW,   w: 1.8, y0: 0,    y1: 0.62, d: 0.8, top: true },   // по картинке (верх яблок 0,59): на 0,7 «вставала на воздух»
    barrels: { cls: LOW,   w: 1.6, y0: 0,    y1: 0.8,  d: 0.8, move: [3, 5] },
    gate:    { cls: MID,   w: 2.1, y0: 0.55, y1: 1.05, d: 0.3 },
    carpet:  { cls: HIGH,  w: 2.2, y0: 1.05, y1: 2.4,  d: 0.3 },
    beam:    { cls: HIGH,  w: 2.2, y0: 1.05, y1: 1.7,  d: 0.6 },
    stall:   { cls: BLOCK, w: 2.1, y0: 0,    y1: 2.6,  d: 2.5, top: true },
    cow:     { cls: BLOCK, w: 0.85, y0: 0,   y1: 1.5,  d: 1.8, move: [1.5, 3] },   // по картинке (0,76 × 1,54 × 1,67) — не «бьёт» мимо
    shed:    { cls: BLOCK, w: 2.1, y0: 0,    y1: 2.4,  d: 12,  top: true, len: [8, 16] },
    ramp:    { cls: RAMP,  w: 2.1, y0: 0,    y1: 2.4,  d: 4.0 },
    cart:    { cls: BLOCK, w: 2.0, y0: 0,    y1: 2.2,  d: 4.5, top: true, move: [4, 8] },
  };
  Object.keys(CAT).forEach(k => { CAT[k].id = k; CAT[k].cname = ['', 'low', 'mid', 'high', 'block', 'ramp'][CAT[k].cls]; });
  // этапы (SPEC): gap — «свободная улица» между связками, с; coin — доля связок с дорожкой монет; pats — веса паттернов;
  // inner — зазор внутри многорядной связки сверх минимума генератора, с; пулы — что ставить на этом этапе
  // Этап 1 — «легко, но весело»: связки чаще (2,3–3,1 с между ними давали 2,6 обязательных действия за первые 30 с и паузы
  // до 12 с), половина — двойные (одна полоса из трёх) и сплошные низкие (прыжок); этап 2 — тоже плотнее. Этапы 5–6: меньше
  // прилавков-стен (треть препятствий сводила игру к смене полос), больше прыжков, подкатов и жердей
  const STAGES = [
    { gap: [1.2, 1.7], inner: 0.7, coin: 0.95, low: ['hay', 'bench'], high: [], mid: [], block: ['stall'],
      pats: { one: 0.8, two: 3, lows: 2, wall: 1.2 } },
    { gap: [1.3, 1.9], inner: 0.6, coin: 0.85, low: ['baskets', 'hay', 'bench'], high: ['carpet'], mid: ['gate'], block: ['stall'],
      pats: { one: 3.5, two: 3, wall: 2, highs: 1.4, gates: 1.6, lows: 0.8 } },
    { gap: [1.5, 2.2], inner: 0.5, coin: 0.8, low: ['hay', 'bench', 'baskets'], high: ['carpet', 'beam'], mid: ['gate'], block: ['stall', 'shed'],
      pats: { one: 2.5, two: 3, wall: 2, gates: 1.2, highs: 1, roof: 2.2, cow: 1.4, zig: 0.8 } },
    { gap: [1.3, 2.0], inner: 0.45, coin: 0.75, low: ['hay', 'bench', 'baskets', 'barrels'], high: ['carpet', 'beam'], mid: ['gate'], block: ['stall', 'shed'],
      pats: { two: 2.5, wall: 2, roof: 2, roofs: 3.5, barrels: 1.6, cow: 1, combo: 1.2, zig: 1, lows: 0.8, highs: 0.8, gates: 0.8 } },
    { gap: [1.1, 1.7], inner: 0.4, coin: 0.7, low: ['hay', 'bench', 'baskets', 'barrels'], high: ['carpet', 'beam'], mid: ['gate'], block: ['stall', 'shed'],
      pats: { two: 2, wall: 1.4, roof: 1.5, roofs: 1.5, barrels: 1.2, cow: 1, cart: 2, combo: 1.6, zig: 1.1, lows: 1, highs: 1, gates: 1 } },
    { gap: [0.95, 1.5], inner: 0.35, coin: 0.7, low: ['hay', 'bench', 'baskets', 'barrels'], high: ['carpet', 'beam'], mid: ['gate'], block: ['stall', 'shed'],
      pats: { two: 2, wall: 1.4, roof: 1.4, roofs: 1.6, barrels: 1.2, cow: 1.1, cart: 2, combo: 1.8, zig: 1.1, lows: 1, highs: 1, gates: 1 } },
  ];
  // пулы паттернов этапа — заранее (генератор не создаёт массивы на ходу)
  STAGES.forEach(st => {
    st.lowS = st.low.filter(i => !CAT[i].move); if (!st.lowS.length) st.lowS = ['hay'];
    st.highS = st.high.length ? st.high : ['carpet'];
    st.oneP = st.lowS.concat(st.high, st.mid, st.block);
    st.twoP = st.lowS.concat(st.high, st.block, st.block);
    st.passP = st.lowS.concat(st.high, st.mid);
    st.zigP = st.lowS.concat(st.high);
    st.shed = st.block.indexOf('shed') >= 0;
  });
  // темы этапов по умолчанию (если у набора графики нет своих): порядок этапов, час неба
  const THEMES = [
    { id: 'masters', title: 'Улица мастеров', titleN: 'Улица мастеров', hour: 11 },
    { id: 'bazaar', title: 'Базарная площадь', titleN: 'Базарная площадь', hour: 13 },
    { id: 'school', title: 'У школы', titleN: 'У школы', hour: 15 },
    { id: 'kombinat', title: 'Комбинат и крыши', titleN: 'Мастерские и крыши', hour: 16.5 },
    { id: 'tower', title: 'Вечер у башни', titleN: 'Вечер у башни', hour: 18.6 },
    { id: 'night', title: 'Ночь над селом', titleN: 'Ночь над селом', hour: 22.5 },
  ];
  const POWERS = ['magnet', 'x2', 'glide'];

  // параметры прыжка/подката на скорости v (полёт на 20 м/с ≈ 0,55 с вместо 0,75: дистанция растёт, но не в 2,2 раза)
  const JP = { T: 0, H: 0, g: 0, vj: 0 };
  function jumpAt(v, out) { const o = out || JP; o.T = CFG.jumpT * clamp(Math.pow(CFG.v0 / v, 0.4), 0.72, 1); o.H = CFG.jumpH; o.g = 8 * o.H / (o.T * o.T); o.vj = 4 * o.H / o.T; return o; }
  const slideDur = v => CFG.slideT * clamp(Math.pow(CFG.v0 / v, 0.3), 0.78, 1);
  const laneDur = v => CFG.laneT * clamp(Math.pow(CFG.v0 / v, 0.2), 0.85, 1);
  // время подъёма до высоты h от отрыва (∞ — не достать)
  function riseT(J, h) { const D = J.vj * J.vj - 2 * J.g * h; return D < 0 ? INF : (J.vj - Math.sqrt(D)) / J.g; }

  function title(named, plain) { return (plain ? '' : '🏃 ') + (named === false ? 'Бег по горному селу' : 'Бег по Кубачи'); }
  // WebGL — без проверочного контекста: available() зовёт строка меню ☰ прямо в мире, у которого уже живой контекст, а второй
  // (даже на миг) на телефоне — риск вылета. Хост с рендерером и так знает, что WebGL есть; здесь — только «есть ли API вообще»
  function available() {
    if (typeof window.WebGLRenderingContext === 'undefined' && typeof window.WebGL2RenderingContext === 'undefined') return false;
    try { if (window.CONFIG && CONFIG.UNLOCK && CONFIG.UNLOCK.runner !== undefined && window.Missions && Missions.unlock) return !!Missions.unlock('runner').ok; } catch (e) { /* ниже */ }
    return true;
  }

  /* =====================================================================
     ЗАГЛУШКИ (пока нет набора графики, актёров, интерфейса — или они упали): те же контракты, что в SPEC
     ===================================================================== */
  function stubKit(ctx) {
    const T = ctx.THREE, P = (V.vkit && V.vkit.PAL) || {};
    const col = (k, d) => new T.Color(P[k] || d);
    const M = {
      road: new T.MeshLambertMaterial({ color: col('slab', '#BDB2A0') }), walk: new T.MeshLambertMaterial({ color: col('tread', '#B5AA98') }),
      wallA: new T.MeshLambertMaterial({ color: col('ochre', '#C4A878') }), wallB: new T.MeshLambertMaterial({ color: col('cream', '#EDE3CF') }),
      gal: new T.MeshLambertMaterial({ color: col('blue', '#4A90D8') }), roof: new T.MeshLambertMaterial({ color: col('rubble', '#A89A84') }),
      hay: new T.MeshLambertMaterial({ color: col('hay', '#D9C27A') }), wood: new T.MeshLambertMaterial({ color: col('wood', '#8A6A4E') }),
      cloth: new T.MeshLambertMaterial({ color: '#B8434E' }), stall: new T.MeshLambertMaterial({ color: '#C98A4A' }), awn: new T.MeshLambertMaterial({ color: '#E8D9B0' }),
      cow: new T.MeshLambertMaterial({ color: '#7A5A44' }), white: new T.MeshLambertMaterial({ color: '#F4F1EA' }),
      coin: new T.MeshStandardMaterial({ color: '#D7DCE2', metalness: 0.85, roughness: 0.28, emissive: '#3A3E44' }),
      pw: { magnet: new T.MeshLambertMaterial({ color: '#C77D4F', emissive: '#40200C' }), x2: new T.MeshLambertMaterial({ color: '#E8C770', emissive: '#4A3810' }), glide: new T.MeshLambertMaterial({ color: '#63AEB0', emissive: '#103838' }) },
    };
    const box = new T.BoxGeometry(1, 1, 1), cyl = new T.CylinderGeometry(0.5, 0.5, 1, 14), oct = new T.OctahedronGeometry(0.42, 0);
    // настил: клин — низ спереди (z = +d/2), верх сзади (z = −d/2), как в каталоге «0 → 2,4 за 4 м»
    const wedge = new T.BufferGeometry();
    wedge.setAttribute('position', new T.Float32BufferAttribute([
      -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 1, -0.5, -0.5, 1, -0.5,      // скат
      -0.5, 0, 0.5, -0.5, 1, -0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, -0.5,     // бока
      -0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, -0.5, 0, -0.5, 0.5, 1, -0.5, 0.5, 0, -0.5], 3)); // зад
    wedge.computeVertexNormals();
    const pools = {};
    const put = (g, geo, mat, x, y, z, sx, sy, sz) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.matrixAutoUpdate = false; m.updateMatrix(); g.add(m); return m; };
    function pooled(key, make) {
      const p = pools[key] || (pools[key] = []);
      const h = p.pop() || make();
      h.release = h.release || (() => { if (h.group.parent) h.group.parent.remove(h.group); p.push(h); });
      return h;
    }
    const themes = THEMES.map(t => Object.assign({}, t));
    function segment(themeId, len, rng) {
      const v = Math.floor(rng() * 3);
      return pooled('seg' + len + ':' + v + ':' + themeId, () => {
        const g = new T.Group(), ti = Math.max(0, themes.findIndex(t => t.id === themeId));
        put(g, box, M.road, 0, -0.05, -len / 2, 7.6, 0.1, len);
        [-1, 1].forEach(sd => {
          put(g, box, M.walk, sd * 4.6, 0.06, -len / 2, 1.4, 0.12, len);
          let z = 0; let i = 0;
          while (z < len - 4) {
            const w = 7 + ((i * 37 + v * 11 + ti * 5) % 6), h = 4.5 + ((i * 53 + v * 7) % 5) * 1.1; if (z + w > len) break;
            put(g, box, (i + v) % 2 ? M.wallA : M.wallB, sd * 7.6, h / 2, -(z + w / 2), 4.4, h, w - 0.4);
            put(g, box, M.gal, sd * 5.32, h * 0.62, -(z + w / 2), 0.16, 0.9, w - 1.4);
            put(g, box, M.roof, sd * 7.6, h + 0.1, -(z + w / 2), 4.6, 0.2, w - 0.2);
            z += w; i++;
          }
        });
        return { group: g, len };
      });
    }
    function obstacle(id, opts) {
      const c = CAT[id], len = id === 'shed' ? Math.round((opts && opts.len) || 12) : c.d, key = id + ':' + len;
      return pooled(key, () => {
        const g = new T.Group(), w = c.w, d = len;
        if (id === 'hay') { put(g, box, M.hay, -0.48, 0.45, 0, 0.92, 0.9, 1.0); put(g, box, M.hay, 0.48, 0.45, 0, 0.92, 0.9, 1.0); }
        else if (id === 'bench') { put(g, box, M.roof, 0, 0.62, 0, w, 0.26, d); put(g, box, M.roof, -0.8, 0.25, 0, 0.3, 0.5, d * 0.8); put(g, box, M.roof, 0.8, 0.25, 0, 0.3, 0.5, d * 0.8); }
        else if (id === 'baskets') { for (let i = 0; i < 3; i++) put(g, cyl, M.wood, -0.6 + i * 0.6, 0.35, 0, 0.55, 0.7, 0.7); }
        else if (id === 'barrels') { put(g, cyl, M.wood, -0.4, 0.4, 0, 0.8, 0.78, 0.8).rotation.z = PI / 2; g.children[0].updateMatrix(); put(g, cyl, M.wood, 0.4, 0.4, 0, 0.8, 0.78, 0.8).rotation.z = PI / 2; g.children[1].updateMatrix(); }
        else if (id === 'gate') { put(g, box, M.wood, -0.98, 0.6, 0, 0.14, 1.2, 0.14); put(g, box, M.wood, 0.98, 0.6, 0, 0.14, 1.2, 0.14); put(g, box, M.white, 0, 0.8, 0, w, 0.5, 0.18); }
        else if (id === 'carpet') { put(g, box, M.wood, -1.05, 1.25, 0, 0.1, 2.5, 0.1); put(g, box, M.wood, 1.05, 1.25, 0, 0.1, 2.5, 0.1); put(g, box, M.cloth, 0, 1.72, 0, w - 0.2, 1.3, 0.06); }
        else if (id === 'beam') { put(g, box, M.wood, 0, 1.38, 0, w, 0.64, d); put(g, box, M.wood, -1.0, 0.7, 0, 0.16, 1.4, 0.16); put(g, box, M.wood, 1.0, 0.7, 0, 0.16, 1.4, 0.16); }
        else if (id === 'stall') { put(g, box, M.stall, 0, 1.0, 0, w, 2.0, d); put(g, box, M.awn, 0, 2.3, 0, w, 0.6, d); }
        else if (id === 'cow') { put(g, box, M.cow, 0, 0.95, 0, 0.9, 0.85, 1.7); put(g, box, M.cow, 0, 1.2, 0.95, 0.5, 0.5, 0.5); put(g, box, M.cow, 0, 0.3, 0, 0.7, 0.6, 1.3); }
        else if (id === 'shed') { put(g, box, M.wallB, 0, 1.15, 0, w, 2.3, d); put(g, box, M.roof, 0, 2.35, 0, w + 0.1, 0.1, d); }
        else if (id === 'ramp') { put(g, wedge, M.wood, 0, 0, 0, w, 2.4, d); }
        else if (id === 'cart') { put(g, box, M.wood, 0, 0.75, 0, w, 0.5, d); put(g, box, M.hay, 0, 1.6, 0, w, 1.2, d * 0.9); put(g, cyl, M.wood, -1.0, 0.45, 0, 0.9, 0.12, 0.9).rotation.z = PI / 2; g.children[2].updateMatrix(); }
        return { group: g };
      });
    }
    function coins(max) {
      const geo = new T.CylinderGeometry(0.25, 0.25, 0.07, 18); geo.rotateX(PI / 2);   // ребром вперёд — вращается вокруг вертикали
      const m = new T.InstancedMesh(geo, M.coin, max); m.count = 0; m.frustumCulled = false; m.userData.own = geo; return m;
    }
    function powerup(id) { return pooled('pw:' + id, () => { const g = new T.Group(); put(g, oct, M.pw[id] || M.pw.magnet, 0, 0, 0, 1, 1, 1); return { group: g }; }); }
    function sky(scene) {
      const hemi = new T.HemisphereLight('#DCE8F4', '#8C8A80', 0.85), sun = new T.DirectionalLight('#FFF7EE', 0.75);
      sun.position.set(-30, 50, 20); scene.add(hemi, sun);
      const bg = new T.Color('#A6C8EA'), fog = new T.Fog('#D6E2EE', 70, 240); scene.background = bg; scene.fog = fog;
      const dayC = new T.Color('#A6C8EA'), eveC = new T.Color('#F0C9A6'), nightC = new T.Color('#1E2A44'), fDay = new T.Color('#D6E2EE'), fEve = new T.Color('#F3D2C0'), fNight = new T.Color('#2A3550');
      return {
        update(hour) {
          const ev = sst(16, 18.5, hour) * (1 - sst(19.5, 21, hour)), ni = sst(19.5, 21.5, hour) + (1 - sst(5, 7, hour));
          bg.copy(dayC).lerp(eveC, ev).lerp(nightC, clamp(ni, 0, 1)); fog.color.copy(fDay).lerp(fEve, ev).lerp(fNight, clamp(ni, 0, 1));
          hemi.intensity = lerp(0.85, 0.42, clamp(ni, 0, 1)); sun.intensity = lerp(0.75, 0.12, clamp(ni, 0, 1));
        },
        dispose() { scene.remove(hemi, sun); scene.background = null; scene.fog = null; },
      };
    }
    function stats() { return { tris: 0, calls: 0 }; }
    function dispose() {
      [box, cyl, oct, wedge].forEach(g => g.dispose());
      Object.keys(M).forEach(k => { if (M[k].dispose) M[k].dispose(); }); Object.keys(M.pw).forEach(k => M.pw[k].dispose());
      Object.keys(pools).forEach(k => { pools[k].forEach(h => { if (h.group.parent) h.group.parent.remove(h.group); }); pools[k].length = 0; });
    }
    return { stub: true, LANE, SEG_LENS: [40, 60], themes, segment, obstacle, coins, powerup, sky, fx: { coinBurst() {}, dust() {} }, stats, dispose };
  }

  // актёры-заглушки: настоящая героиня хоста (если дали) — бег из HeroAnim и простые наклоны тела на прыжок/подкат; без неё —
  // капсула. Пальтар — высокая фигура из примитивов (2,1 м). Блоб-тени под обоими
  function stubActors(ctx) {
    const T = ctx.THREE, scene = ctx.scene, own = [];
    const mat = c => { const m = new T.MeshLambertMaterial({ color: c }); own.push(m); return m; };
    const geo = g => { own.push(g); return g; };
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(60,48,62,.38)'); gr.addColorStop(1, 'rgba(60,48,62,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    const btex = new T.CanvasTexture(cv); own.push(btex);
    const bmat = new T.MeshBasicMaterial({ map: btex, transparent: true, depthWrite: false }); own.push(bmat);
    const bgeo = geo(new T.PlaneGeometry(1, 1));
    const blob = (sx, sz) => { const m = new T.Mesh(bgeo, bmat); m.rotation.x = -PI / 2; m.scale.set(sx, sz, 1); m.renderOrder = 1; scene.add(m); return m; };
    const H = ctx.hero && ctx.hero.root ? ctx.hero : null, A = ctx.anim || (H && H.rig && H.rig.anim) || null;
    let keep = null, kazOn = false, root, body, pose = 'idle', pk = 0, pt = 0;
    if (H) {
      root = H.root; body = H.body || null;
      keep = { parent: root.parent, p: root.position.clone(), r: root.rotation.clone(), s: root.scale.clone(), vis: root.visible, by: body ? body.position.y : 0, brx: body ? body.rotation.x : 0 };
      scene.add(root); root.visible = true;
      // каз — та же примерка, что в селе (VILLAGE.kaz.wear); если уже надет — не трогаем и не снимаем
      try { if (ctx.kazApi && ctx.kazApi.wear && H.rig && !(ctx.kazApi.isWorn && ctx.kazApi.isWorn())) { ctx.kazApi.wear(H, A, { instant: true, quality: ctx.quality }); kazOn = true; } } catch (e) { console.warn('runner: kaz', e); }
    } else {
      root = new T.Group(); body = new T.Group(); root.add(body); scene.add(root);
      const cap = new T.Mesh(geo(new T.CapsuleGeometry(0.26, 1.05, 4, 10)), mat('#C2405B')); cap.position.y = 0.78; body.add(cap);
      const head = new T.Mesh(geo(new T.SphereGeometry(0.2, 12, 9)), mat('#F7DCC8')); head.position.y = 1.46; body.add(head);
      const kaz = new T.Mesh(geo(new T.SphereGeometry(0.235, 12, 9, 0, PI * 2, 0, PI * 0.62)), mat('#FFFDF8')); kaz.position.y = 1.5; body.add(kaz);
    }
    const hb = blob(0.95, 0.6);
    // пальтар: кольчуга (серая), высокая маска-шапка, бубенцы; руки — для «погрозить пальцем»
    const proot = new T.Group(), pbody = new T.Group(); proot.add(pbody); scene.add(proot);
    const pp = (g, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); pbody.add(o); return o; };
    const pbox = geo(new T.BoxGeometry(1, 1, 1)), psph = geo(new T.SphereGeometry(0.5, 12, 9)), pcone = geo(new T.ConeGeometry(0.5, 1, 12));
    const mMail = mat('#8E928E'), mFelt = mat('#3B3330'), mMask = mat('#E9E1D2'), mRed = mat('#A04E44');
    pp(pbox, mFelt, -0.13, 0.48, 0, 0.18, 0.96, 0.2); pp(pbox, mFelt, 0.13, 0.48, 0, 0.18, 0.96, 0.2);
    pp(pbox, mMail, 0, 1.3, 0, 0.62, 0.8, 0.34); pp(pbox, mRed, 0, 0.95, 0, 0.64, 0.12, 0.36);
    const armL = pp(pbox, mMail, 0.4, 1.32, 0, 0.14, 0.7, 0.16), armR = pp(pbox, mMail, -0.4, 1.32, 0, 0.14, 0.7, 0.16);
    pp(psph, mMask, 0, 1.86, 0.02, 0.36, 0.42, 0.36); pp(pcone, mFelt, 0, 2.22, 0, 0.3, 0.42, 0.3);
    const pblob = blob(1.0, 0.7);
    let ppose = 'idle', ptm = 0;
    const hero = {
      root,
      set(p, k) { pose = p; pk = k || 0; pt = 0; },
      update(dt, s) {
        pt += dt;
        hb.position.set(root.position.x, s.ground + 0.02, root.position.z); hb.visible = root.visible;
        const fall = clamp(1 - (s.y - s.ground) / 4, 0.25, 1); hb.scale.set(0.95 * fall, 0.6 * fall, 1); bmat.opacity = 1;
        if (A) {
          const run = pose === 'run' || pose === 'jump' || pose === 'slide' || pose === 'stumble';
          A.update(dt, { speed: run ? Math.min(s.speed * 0.62, 6.8) : 0, idle: pose === 'idle', turnRate: -s.lat * 0.5, sitting: false, celebrate: false });
          if (ctx.kazApi && ctx.kazApi.update && kazOn) { try { ctx.kazApi.update(dt, { speed: s.speed, turnRate: 0 }); } catch (e) { /* каз не главное */ } }
        }
        if (body) {
          const sl = s.slide, air = s.air ? 1 : 0;
          body.rotation.x = -0.62 * sl + 0.22 * air * (s.vy > 0 ? 1 : 0.4) + (pose === 'stumble' ? 0.35 * Math.sin(Math.min(1, pt / 0.5) * PI) : 0) - (pose === 'caught' ? 0.25 : 0);
          body.position.y = -0.3 * sl + (pose === 'caught' ? 0.25 * sst(0, 0.5, pt) : 0);
          body.position.z = 0.25 * sl;
          body.rotation.z = pose === 'glide' ? Math.sin(pt * 1.7) * 0.05 : 0;
        }
      },
    };
    const paltar = {
      root: proot,
      set(p) { ppose = p; ptm = 0; },
      update(dt, s) {
        ptm += dt;
        const w = s.speed > 0.5 ? 1 : 0, ph = s.t * 9;
        pbody.position.y = Math.abs(Math.sin(ph)) * 0.07 * w + (ppose === 'catch' ? 0.1 : 0);
        armL.rotation.x = Math.sin(ph) * 0.8 * w; armR.rotation.x = ppose === 'near' || ppose === 'catch' ? -2.4 + Math.sin(s.t * 14) * 0.3 : -Math.sin(ph) * 0.8 * w;
        if (ppose === 'cheer') { armL.rotation.x = -2.6 + Math.sin(ptm * 9) * 0.3; armR.rotation.x = -2.6 - Math.sin(ptm * 9) * 0.3; pbody.rotation.y = Math.sin(ptm * 3) * 0.4; } else pbody.rotation.y = 0;
        pblob.position.set(proot.position.x, s.pground + 0.02, proot.position.z); pblob.visible = proot.visible;
      },
      jingle() {}, crack() {},
    };
    function dispose() {
      [hb, pblob, proot].forEach(m => { if (m.parent) m.parent.remove(m); });
      if (H) {
        if (kazOn && ctx.kazApi && ctx.kazApi.remove) { try { ctx.kazApi.remove(); } catch (e) { /* ok */ } }
        if (root.parent) root.parent.remove(root);
        if (keep.parent) keep.parent.add(root);
        root.position.copy(keep.p); root.rotation.copy(keep.r); root.scale.copy(keep.s); root.visible = keep.vis;
        if (body) { body.position.y = keep.by; body.position.z = 0; body.rotation.x = keep.brx; body.rotation.z = 0; }
        if (A && A.reset) { try { A.reset(); } catch (e) { /* ok */ } }
      } else if (root.parent) root.parent.remove(root);
      own.forEach(o => o.dispose());
    }
    return { stub: true, hero, paltar, dispose };
  }

  // интерфейс-заглушка: счёт, монеты, метры, множитель, пауза, баннер, карточки «старт / пауза / конец», подсказки свайпов
  function stubUI(ctx) {
    const root = ctx.root, el = document.createElement('div'); el.className = 'rnr-stub';
    const css = document.createElement('style');
    css.textContent = '.rnr-stub{position:absolute;inset:0;pointer-events:none;font-family:Nunito,system-ui,sans-serif;color:#3A2E3F;-webkit-user-select:none;user-select:none}' +
      '.rnr-stub button{pointer-events:auto;font:inherit;border:0;cursor:pointer}' +
      '.rnr-top{position:absolute;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:8px;align-items:flex-start}' +
      '.rnr-pill{background:rgba(255,253,249,.92);border-radius:14px;padding:6px 11px;font-weight:900;font-size:15px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap}' +
      '.rnr-pill small{display:block;font-size:11px;font-weight:800;color:#6E6272}.rnr-coin::before{content:"";display:inline-block;width:13px;height:13px;margin-right:5px;vertical-align:-1px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#C2C6BF 55%,#8E928E)}' +
      '.rnr-sp{flex:1}.rnr-pause{width:42px;height:42px;border-radius:14px!important;background:rgba(255,253,249,.92);font-size:18px!important;box-shadow:0 3px 0 rgba(58,46,63,.12)}' +
      '.rnr-pw{position:absolute;left:12px;top:calc(64px + env(safe-area-inset-top,0px));display:flex;gap:6px}.rnr-pw span{background:rgba(255,253,249,.9);border-radius:12px;padding:4px 8px;font-weight:900;font-size:12px}' +
      '.rnr-ban{position:absolute;left:50%;top:22%;transform:translateX(-50%) scale(.8);background:#FFF6D8;border:3px dashed #E2B04E;color:#7A5418;font-weight:900;font-size:17px;padding:10px 16px;border-radius:18px;opacity:0;transition:opacity .3s,transform .35s;white-space:nowrap}' +
      '.rnr-ban.on{opacity:1;transform:translateX(-50%) scale(1)}' +
      '.rnr-tut{position:absolute;left:50%;top:56%;transform:translateX(-50%);background:rgba(58,46,63,.82);color:#fff;font-weight:900;font-size:17px;padding:10px 16px;border-radius:16px;display:none;white-space:nowrap}' +
      '.rnr-card{position:absolute;inset:0;display:none;place-items:center;background:rgba(58,46,63,.28);pointer-events:auto}.rnr-card.on{display:grid}' +
      '.rnr-box{background:#FFFDF9;border-radius:20px;padding:16px;width:min(340px,86vw);box-shadow:0 8px 30px rgba(58,46,63,.25);text-align:center}' +
      '.rnr-box h2{margin:0 0 6px;color:#C2405B;font-size:22px;font-weight:900}.rnr-box p{margin:6px 0;font-weight:700;font-size:14.5px}' +
      '.rnr-row{display:flex;gap:8px;margin-top:12px}.rnr-row button{flex:1;border-radius:14px;padding:12px 8px;font-weight:900;font-size:15px;background:#F6E7EB;color:#3A2E3F}.rnr-row button.main{background:#C2405B;color:#fff;box-shadow:0 4px 0 #9E2F47}';
    el.innerHTML = '<div class="rnr-top"><div class="rnr-pill" data-k="score">0<small>очки</small></div><div class="rnr-pill rnr-coin" data-k="coins">0</div>' +
      '<div class="rnr-pill" data-k="dist">0 м<small>×1</small></div><div class="rnr-sp"></div><button class="rnr-pause" aria-label="Пауза">⏸</button></div>' +
      '<div class="rnr-pw"></div><div class="rnr-ban"></div><div class="rnr-tut"></div><div class="rnr-card"><div class="rnr-box"></div></div>';
    root.appendChild(css); root.appendChild(el);
    const q = s => el.querySelector(s), card = q('.rnr-card'), box = q('.rnr-box'), top = q('.rnr-top');
    const last = { score: -1, coins: -1, dist: -1, mult: -1, pw: '' };
    q('.rnr-pause').addEventListener('click', () => ctx.onPause && ctx.onPause());
    const NAMES = { magnet: 'Кувшин-магнит', x2: 'Серебро ×2', glide: 'Параплан' };
    function screen(name, d) {
      d = d || {};
      top.style.display = name === 'start' ? 'none' : ''; q('.rnr-pw').style.display = name === 'run' ? '' : 'none';
      if (name === 'run') { card.classList.remove('on'); return; }
      const t = name === 'start' ? (d.title || 'Бег') : name === 'pause' ? 'Пауза' : ctx.named !== false ? 'Пальтар догнал!' : 'Ряженый догнал!';
      let h = '<h2>' + t + '</h2>';
      if (name === 'start') h += '<p>Свайп влево-вправо — полоса, вверх — прыжок, вниз — подкат.</p><p>' + (ctx.named !== false ? 'Собирай серебряные монетки и не попадись пальтару!' : 'Собирай серебряные монетки и не попадись ряженому!') + '</p>' + (d.best ? '<p>Рекорд: ' + d.best + '</p>' : '');
      if (name === 'pause') h += '<p>Очки: ' + (d.score || 0) + '</p>';
      if (name === 'over') h += (d.record ? '<p>✨ Новый рекорд!</p>' : '') + '<p>Очки: <b>' + d.score + '</b> · монеты: ' + d.coins + ' · ' + d.dist + ' м</p><p>Рекорд: ' + d.best + '</p>';
      h += '<div class="rnr-row">' + (name === 'pause' ? '<button class="main" data-a="resume">Дальше</button>' : '<button class="main" data-a="start">' + (name === 'over' ? 'Ещё раз' : 'Бежать!') + '</button>') + '<button data-a="exit">Выйти</button></div>';
      box.innerHTML = h; card.classList.add('on');
      box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.a; if (ctx.haptic) ctx.haptic('light');
        if (a === 'start' && ctx.onStart) ctx.onStart(); else if (a === 'resume' && ctx.onResume) ctx.onResume(); else if (a === 'exit' && ctx.onExit) ctx.onExit();
      }));
    }
    function hud(h) {
      if (h.score !== last.score) { last.score = h.score; q('[data-k=score]').firstChild.nodeValue = String(h.score); }
      if (h.coins !== last.coins) { last.coins = h.coins; q('[data-k=coins]').textContent = String(h.coins); }
      if (h.dist !== last.dist || h.mult !== last.mult) { last.dist = h.dist; last.mult = h.mult; q('[data-k=dist]').innerHTML = h.dist + ' м<small>×' + h.mult + '</small>'; }
      let pw = ''; for (let i = 0; i < h.power.length; i++) pw += h.power[i].id + Math.ceil(h.power[i].t);
      if (pw !== last.pw) { last.pw = pw; q('.rnr-pw').innerHTML = h.power.map(p => '<span>' + (NAMES[p.id] || p.id) + ' ' + Math.ceil(p.t) + '</span>').join(''); }
    }
    let banT = 0;
    function banner(t) { const b = q('.rnr-ban'); b.textContent = t; b.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('on'), 2200); }
    function tutorial(step) { const t = q('.rnr-tut'); if (!step) { t.style.display = 'none'; return; } t.textContent = step === 'lr' ? '👆 Свайп влево или вправо' : step === 'up' ? '👆 Свайп вверх — прыжок' : '👇 Свайп вниз — подкат'; t.style.display = 'block'; }
    function dispose() { clearTimeout(banT); el.remove(); css.remove(); }
    return { stub: true, screen, hud, banner, tutorial, dispose };
  }

  /* =====================================================================
     ЗАБЕГ: состояние, шаг физики, генератор, кадр
     ===================================================================== */
  function createGame(o) {
    const T = o.THREE, scene = o.scene, camera = o.camera, kit = o.kit, actors = o.actors, ui = o.ui, host = o.host;
    const named = o.named !== false;
    const themes = (kit.themes && kit.themes.length ? kit.themes : THEMES);
    const segLens = kit.SEG_LENS && kit.SEG_LENS.length ? kit.SEG_LENS : [40, 60];
    const track = new T.Group(); track.name = 'runnerTrack'; scene.add(track);
    const coinMesh = kit.coins(CFG.coinsMax); track.add(coinMesh); coinMesh.frustumCulled = false;
    const sky = kit.sky ? kit.sky(scene) : null;
    const fx = kit.fx || { coinBurst() {}, dust() {} };

    /* ---------- события: звук, haptic, счётчики (объекты данных переиспользуются — без мусора) ---------- */
    const EV = {}, EVD = { n: 0, id: '', pitch: 0, x: 0, y: 0, z: 0, kind: '' };
    const HAPTIC = { jump: null, lane: null, coin: null, stumble: 'medium', crash: 'heavy', caught: 'error', power: 'success', record: 'success', stage: 'light', glideEnd: 'light', edge: 'light' };
    function emit(name, d) {
      EV[name] = (EV[name] || 0) + 1;
      if (G.sim && !G.simSound) return;
      if (host.sfx) { try { host.sfx(name, d || EVD); } catch (e) { /* звук не главное */ } }
      const hk = HAPTIC[name]; if (hk && host.haptic) { try { host.haptic(hk); } catch (e) { /* ok */ } }
    }

    /* ---------- состояние ---------- */
    const G = {
      mode: 'intro', modeT: 0, t: 0, runT: 0, seed: 1, rng: mulberry(1),
      s: 0, ps: 0, s0: 0, origin: 0, vBase: CFG.v0, v: 0, dip: 0, timeK: 1, timeTarget: 1,
      dist: 0, scoreD: 0, coins: 0, score: 0, mult: 1, stage: 1, theme: 0, hour: themes[0].hour || 11, hourT: themes[0].hour || 11,
      magT: 0, x2T: 0, stumbles: 0, nearT: 0, crashT: 0, caught: false, crashBy: '', overT: 0, record: false,
      tut: null, tutStep: 0, tutWait: null, sim: false, simSound: false, best: 0, bot: null, runs: 0, totalCoins: 0, bestDist: 0, lmBias: 0, dashT: 0, caughtT: 0, bestDist0: 0,
    };
    const Hh = { lane: 1, lane0: 1, x: 0, px: 0, x0: 0, x1: 0, lt: 1, ld: 0.16, vx: 0, y: 0, py: 0, vy: 0, ground: true, sup: 0, ph: CFG.height,
      g: 22, jT: 0.75, slideT: 0, slideD: 0.7, drop: false, slideOnLand: false, coyote: 0, bumpT: 0, bumpDir: 0, airT: 0, stepT: 0,
      glide: 0, glT: 0, glY0: 0, ceil: CFG.glideY, pose: 'idle', laneAt: -9, laneDir: 0, xs: 0 };
    const P = { gap: CFG.gapStart, pgap: CFG.gapStart, x: 0, y: 0, pose: 'idle', jingleT: 0, crackT: 2, side: 1, off: 0 };
    // история героини для пальтара: он бежит по следу героини (прыгает там же, где прыгала она), отставая на gap метров
    const HN = 1024, hS = new Float64Array(HN), hX = new Float32Array(HN), hY = new Float32Array(HN); let hI = 0, hCount = 0;

    /* ---------- ввод: буфер ≈ 0,15 с ---------- */
    const INQ = new Array(6), inq = { n: 0 };
    for (let i = 0; i < INQ.length; i++) INQ[i] = { d: '', t: 0 };
    function input(dir) {
      if (dir === 'pause') { if (G.mode === 'run' || G.mode === 'start') pause(); else if (G.mode === 'pause') resume(); return; }
      if (G.mode !== 'run' && G.mode !== 'start') return;
      if (G.tutWait) tutInput(dir);
      if (inq.n >= INQ.length) { for (let i = 1; i < INQ.length; i++) { INQ[i - 1].d = INQ[i].d; INQ[i - 1].t = INQ[i].t; } inq.n--; }
      INQ[inq.n].d = dir; INQ[inq.n].t = G.t; inq.n++;
    }
    function dropInput(i) { for (let k = i + 1; k < inq.n; k++) { INQ[k - 1].d = INQ[k].d; INQ[k - 1].t = INQ[k].t; } inq.n--; }

    /* ---------- препятствия: записи из пула ---------- */
    function Ob() { this.on = false; this.c = null; this.id = ''; this.cls = 0; this.lane = 1; this.x = 0; this.s = 0; this.ps = 0; this.d = 1; this.w = 1; this.y0 = 0; this.y1 = 1; this.top = false; this.u = 0; this.meet = 0; this.h = null; this.zc = 0; this.hitT = 0; this.ramped = false; this.len = 0; this.started = false; this.tut = 0; this.variant = 0; this.gone = false; }
    const OBP = []; for (let i = 0; i < 128; i++) OBP.push(new Ob());
    const obs = [];
    const bbox = new T.Box3(), zcCache = {}, OBO = { variant: 0, len: undefined, dir: 0, lane: 1, quality: o.quality };
    function spawnOb(id, lane, s, opts) {
      const c = CAT[id]; let r = null;
      for (let i = 0; i < OBP.length; i++) if (!OBP[i].on) { r = OBP[i]; break; }
      if (!r) { r = new Ob(); OBP.push(r); }
      r.on = true; r.c = c; r.id = id; r.cls = c.cls; r.lane = lane; r.x = LX[lane]; r.s = s; r.ps = s; r.w = c.w; r.y0 = c.y0; r.y1 = c.y1; r.top = !!c.top;
      r.len = id === 'shed' ? (opts && opts.len) || 12 : 0; r.d = id === 'shed' ? r.len : c.d; r.u = (opts && opts.u) || 0; r.meet = s; r.started = false; r.hitT = 0;
      r.ramped = !!(opts && opts.ramped); r.tut = (opts && opts.tut) || 0; r.variant = (opts && opts.variant) || 0; r.gone = false;
      if (r.u > 0) r.s = r.ps = s + r.u * CFG.trig;   // ждёт на месте встречи + путь за trig секунд (см. moveObs)
      r.h = null;
      const t0 = performance.now();
      OBO.variant = r.variant; OBO.len = r.len || undefined; OBO.dir = r.u > 0 ? 1 : 0; OBO.lane = lane;
      try { r.h = kit.obstacle(id, OBO); } catch (e) { console.warn('runner: obstacle', id, e); r.h = null; }
      { const dt = performance.now() - t0; PERF.obMs += dt; PERF.obN++; if (dt > PERF.obMax) PERF.obMax = dt; }
      if (r.h && r.h.group) {
        // набор графики может строить препятствие от центра или от переднего края: ставим по середине его рамки по z
        const zk = zcCache[id] || (zcCache[id] = {}), key = (r.len | 0) * 16 + (r.variant & 15);
        if (zk[key] === undefined) { const g = r.h.group; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true); bbox.setFromObject(g); zk[key] = bbox.isEmpty() ? 0 : -(bbox.min.z + bbox.max.z) / 2; }
        r.zc = zk[key];
        track.add(r.h.group); r.h.group.visible = true;
      }
      obs.push(r);
      return r;
    }
    function freeOb(i) {
      const r = obs[i];
      if (r.h) { try { if (r.h.release) r.h.release(); else if (r.h.group.parent) r.h.group.parent.remove(r.h.group); } catch (e) { /* ok */ } }
      r.h = null; r.on = false;
      obs[i] = obs[obs.length - 1]; obs.pop();
    }
    const rampH = (r, s) => clamp((s - r.s) / r.d, 0, 1) * r.y1;

    /* ---------- монеты: типизированные массивы, один InstancedMesh (видимые — подряд, count) ---------- */
    const NC = CFG.coinsMax, cS = new Float64Array(NC), cX = new Float32Array(NC), cY = new Float32Array(NC), cSt = new Uint8Array(NC), cPh = new Float32Array(NC);
    let cFree = NC;
    function addCoin(s, x, y) {
      if (cFree <= 0) return -1;
      for (let i = 0; i < NC; i++) if (cSt[i] === 0) { cSt[i] = 1; cS[i] = s; cX[i] = x; cY[i] = y; cPh[i] = (s * 0.37) % 6.283; cFree--; return i; }
      return -1;
    }
    function freeCoin(i) { if (cSt[i]) { cSt[i] = 0; cFree++; } }

    /* ---------- усилители ---------- */
    function Pw() { this.on = false; this.id = ''; this.s = 0; this.x = 0; this.y = 1; this.h = null; }
    const PWS = []; for (let i = 0; i < 6; i++) PWS.push(new Pw());
    function spawnPw(id, lane, s) {
      let r = null; for (let i = 0; i < PWS.length; i++) if (!PWS[i].on) { r = PWS[i]; break; }
      if (!r) return null;
      r.on = true; r.id = id; r.s = s; r.x = LX[lane]; r.y = 1.05; r.h = null;
      try { r.h = kit.powerup(id); if (r.h && r.h.group) track.add(r.h.group); } catch (e) { console.warn('runner: powerup', id, e); r.h = null; }
      return r;
    }
    function freePw(r) { if (r.h) { try { if (r.h.release) r.h.release(); else if (r.h.group.parent) r.h.group.parent.remove(r.h.group); } catch (e) { /* ok */ } } r.h = null; r.on = false; }

    /* ---------- сегменты улицы ---------- */
    function Sg() { this.on = false; this.s = 0; this.len = 40; this.h = null; this.theme = ''; this.clear = null; }
    const SGP = []; for (let i = 0; i < 16; i++) SGP.push(new Sg());
    const segs = []; let segEnd = 0, segK = 0;
    const SGO = { s: 0, stage: 1, k: 0, first: true, named, season: o.season, quality: o.quality };
    const PERF = { segMs: 0, segMax: 0, segN: 0, obMs: 0, obMax: 0, obN: 0, pre: 0 };
    function addSegment() {
      const t0 = performance.now();
      try { addSegment0(); } finally { const dt = performance.now() - t0; PERF.segMs += dt; PERF.segN++; if (dt > PERF.segMax) PERF.segMax = dt; }
    }
    function addSegment0() {
      let r = null; for (let i = 0; i < SGP.length; i++) if (!SGP[i].on) { r = SGP[i]; break; }
      if (!r) { r = new Sg(); SGP.push(r); }
      const st = stageAt(segEnd), th = themes[(st - 1) % themes.length];
      const len = segLens.length > 1 && gen.rngS() < 0.35 ? segLens[1] : segLens[0];
      r.on = true; r.s = segEnd; r.len = len; r.theme = th.id; r.h = null; r.clear = null;
      try {
        SGO.s = segEnd; SGO.stage = st; SGO.k = segK; SGO.first = segK === 0;
        r.h = kit.segment(th.id, len, gen.rngS, SGO);
        if (r.h && r.h.group) { track.add(r.h.group); r.h.group.visible = true; r.len = r.h.len || len; r.clear = r.h.over && r.h.over.length ? r.h.over : (r.h.clear || null); }
      } catch (e) { console.warn('runner: segment', th.id, e); r.h = null; }
      segs.push(r); segEnd += r.len; segK++;
    }
    // дом-мост (seg.over: [{ z0, z1, y0 — свод, y1 — верх }], z — локальные, ≤ 0): конец первого моста на [a, b] в «s» или −1;
    // topOut — верх самого высокого моста на отрезке (для параплана)
    const BR = { top: 0 };
    function bridgeEnd(a, b) {
      let end = -1; BR.top = 0;
      for (let i = 0; i < segs.length; i++) {
        const c = segs[i].clear; if (!c) continue;
        for (let k = 0; k < c.length; k++) {
          const p = segs[i].s - c[k].z0, q = segs[i].s - c[k].z1, lo = p < q ? p : q, hi = p < q ? q : p;
          if (hi < a || lo > b) continue;
          if (hi > end) end = hi;
          const top = c[k].y1 != null ? c[k].y1 : (c[k].y0 != null ? c[k].y0 + 3.8 : 8.4); if (top > BR.top) BR.top = top;
        }
      }
      return end;
    }
    function freeSeg(i) {
      const r = segs[i];
      if (r.h) { try { if (r.h.release) r.h.release(); else if (r.h.group.parent) r.h.group.parent.remove(r.h.group); } catch (e) { /* ok */ } }
      r.h = null; r.on = false; segs.splice(i, 1);   // ≤ 10 сегментов, сдвиг дешёвый и без выделений
    }

    /* =====================================================================
       ГЕНЕРАТОР: связки рядов; планировщик по полосам гарантирует проходимость с запасом реакции
       R[L] — самая ранняя «s», когда героиня может быть свободна на полосе L (после всех поставленных рядов);
       LAT[L] — до какой «s» по полосе L нельзя пройти вбок (зад последнего препятствия в осях героини);
       OCC[L] — до какой «s» полоса занята (с учётом пути движущихся навстречу) — новый ряд туда не ставится.
       ===================================================================== */
    const R_FREE = 0, R_JUMP = 1, R_SLIDE = 2, R_EITHER = 3, R_BLOCK = 4, R_RAMP = 5;
    const gen = { rng: mulberry(1), rngS: mulberry(2), front: 0, prevEnd: 0, coinEnd: 0, coinLane: 1, nextPw: 400, lastGlide: -1e9, rows: 0, minSlack: INF, slackSum: 0, fails: 0, pushes: 0 };
    const R = new Float64Array(3), R2 = new Float64Array(3), LAT = new Float64Array(3), OCC = new Float64Array(3), LS = new Float64Array(3), BE = new Float64Array(3), RQ = new Uint8Array(3);
    const SLK = new Float64Array(3), SRC = new Uint8Array(3);
    // ramp: len — вся крыша после настила; chain — сколько сараев подряд (parts — их длины, между ними щель ROOFGAP)
    function Ent() { this.on = false; this.id = ''; this.len = 0; this.u = 0; this.off = 0; this.variant = 0; this.tut = 0; this.chain = 1; this.parts = new Float64Array(3); }
    const ROWS = []; for (let k = 0; k < 4; k++) ROWS.push([new Ent(), new Ent(), new Ent()]);
    let nRows = 0;
    const PERM = [0, 1, 2];
    const ri = n => Math.floor(gen.rng() * n);
    const rr = (a, b) => a + (b - a) * gen.rng();
    const pick = arr => arr[ri(arr.length)];
    function shuffle() { for (let i = 2; i > 0; i--) { const j = ri(i + 1), t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t; } }
    function clearRows(n) { nRows = n; for (let k = 0; k < n; k++) for (let l = 0; l < 3; l++) ROWS[k][l].on = false; }
    function ent(k, lane, id, len, u, off) { const e = ROWS[k][lane]; e.on = true; e.id = id; e.len = len || 0; e.u = u || 0; e.off = off || 0; e.variant = ri(4); e.tut = 0; e.chain = 1; e.parts[0] = e.len; return e; }
    // настил + n сараев подряд в одной полосе (бег по крышам 2–3 с, а не < 1 с): щель между крышами — ROOFGAP (0,9 м — видно
    // «перебежала с крыши на крышу», но не ловушка: на любой скорости ≥ 9 м/с за щель она опускается меньше stepUp — и
    // просто бежит дальше; перепрыгнуть — тоже можно). Спрыгнуть вниз в щель нельзя — значит, тупика нет
    const ROOFGAP = 0.9;
    function roofChain(k, lane, n) {
      const e = ent(k, lane, 'ramp', 0); e.chain = n; let tot = 0;
      for (let i = 0; i < n; i++) { const L = n > 1 ? Math.round(rr(12, 16)) : Math.round(rr(8, 14)); e.parts[i] = L; tot += L + (i ? ROOFGAP : 0); }
      e.len = tot; return e;
    }
    function stageAt(s) { return 1 + Math.max(0, Math.floor((s - G.s0) / CFG.stageLen)); }
    const stCfg = st => STAGES[Math.min(STAGES.length, st) - 1];
    function vAt(s) { const ds = Math.max(0, s - G.s); return Math.min(CFG.vMax, Math.sqrt(G.vBase * G.vBase + 2 * CFG.accel * ds)); }
    const moveU = (id, st) => { const m = CAT[id].move; return m ? lerp(m[0], m[1], clamp(gen.rng() * 0.7 + (st - 3) * 0.12, 0, 1)) : 0; };
    // глубина ряда для полосы в осях героини (движущееся навстречу проходит быстрее: d·v/(v+u))
    function effD(e, v) { if (!e.on) return 0; const c = CAT[e.id]; const d = e.id === 'shed' ? e.len : e.id === 'ramp' ? c.d + e.len : c.d; return e.u > 0 ? d * v / (v + e.u) : d; }
    const JJ = { T: 0, H: 0, g: 0, vj: 0 };
    // требования ряда к полосам: RQ, LS (позже всего начать действие), BE (когда освободится, если начать в LS)
    function rowReq(row, f, v) {
      const J = jumpAt(v, JJ), Ts = slideDur(v), hd = CFG.hd;
      for (let L = 0; L < 3; L++) {
        const e = row[L]; LS[L] = INF; BE[L] = -INF;
        if (!e.on) { RQ[L] = R_FREE; continue; }
        const c = CAT[e.id], fr = f + e.off, d = effD(e, v);
        if (c.cls === RAMP) { RQ[L] = R_RAMP; LS[L] = fr - hd - v * 0.08; BE[L] = fr + d + v * Math.sqrt(2 * 2.4 / J.g) + 1.5; continue; }
        if (c.cls === BLOCK) { RQ[L] = R_BLOCK; continue; }
        let lsJ = INF, beJ = INF, lsS = INF, beS = INF;
        if (c.cls === LOW || c.cls === MID) {
          const tc = riseT(J, c.y1 + 0.07);
          if (tc < INF && v * (J.T - 2 * tc) >= d + 2 * hd + 0.35) { lsJ = fr - hd - v * tc - 0.15; beJ = lsJ + v * J.T; }
        }
        if (c.cls === HIGH || c.cls === MID) {
          if (v * Ts >= d + 2 * hd + v * 0.05 + 0.35) { lsS = fr - hd - v * 0.05 - 0.15; beS = lsS + v * Ts; }
        }
        if (beJ <= beS && lsJ < INF) { RQ[L] = c.cls === MID ? R_EITHER : R_JUMP; LS[L] = lsJ; BE[L] = beJ; }
        else if (lsS < INF) { RQ[L] = c.cls === MID ? R_EITHER : R_SLIDE; LS[L] = lsS; BE[L] = beS; }
        else RQ[L] = R_BLOCK;   // не перепрыгнуть/не пролезть на этой скорости — как стена
      }
    }
    // можно ли поставить ряд с фронтом f: пишет R2 (новые R) и SLK (запас реакции по полосам, с); true — проходимо
    function planRow(row, f) {
      const v = vAt(f), react = CFG.react * v, lt = laneDur(v) * 1.12 * v, hd = CFG.hd;
      rowReq(row, f, v);
      let ok = false;
      SRC[0] = SRC[1] = SRC[2] = 0;
      for (let L2 = 0; L2 < 3; L2++) {
        R2[L2] = INF; SLK[L2] = -INF;
        const rq = RQ[L2]; if (rq === R_BLOCK) continue;
        for (let L = 0; L < 3; L++) {
          if (R[L] === INF) continue;
          let arrive, ms, base;
          if (L === L2) { arrive = R[L]; ms = base = R[L]; if (rq !== R_FREE && R[L] + react > LS[L2]) continue; }
          else {
            const lo = L < L2 ? L : L2, hi = L < L2 ? L2 : L, n = hi - lo;
            // свободна с base: и сама героиня (R), и полосы на пути вбок (LAT прежних рядов); + запас реакции
            base = R[L];
            for (let k = lo; k <= hi; k++) if (k !== L && LAT[k] > base) base = LAT[k];
            ms = base + react; arrive = ms + lt * n;
            // уйти со своей полосы надо до препятствия этого ряда на ней; промежуточные полосы с препятствием — пересечь до него
            if (row[L].on && ms + lt * 0.6 > f + row[L].off - hd) continue;
            let bad = false; for (let k = lo + 1; k < hi; k++) if (row[k].on && ms + lt * (Math.abs(k - L) + 0.6) > f + row[k].off - hd) bad = true;
            if (bad) continue;
            if (rq !== R_FREE && arrive > LS[L2]) continue;
          }
          const r = rq === R_FREE ? arrive : BE[L2];
          if (r < R2[L2]) R2[L2] = r;
          SRC[L] = 1;
          // запас реакции: от «свободна» до последнего момента начать (смена полосы — внутри), с
          const sl = rq === R_FREE ? INF : (LS[L2] - (arrive - ms) - base) / v;
          if (sl > SLK[L2]) SLK[L2] = sl;
          ok = true;
        }
      }
      // без тупиков: с КАЖДОЙ полосы, где героиня может быть свободна, ряд проходим (иначе «заманчивая» полоса — ловушка:
      // перепрыгнула сено — а за ним ковёр впритык; забежала на крышу — а под спуском жердь)
      for (let L = 0; L < 3; L++) if (R[L] < INF && !SRC[L]) return false;
      return ok;
    }
    function commitRow(row, f) {
      const v = vAt(f);
      let end = f, best = -INF;
      for (let L = 0; L < 3; L++) {
        const e = row[L]; R[L] = R2[L];
        if (SLK[L] > best) best = SLK[L];
        if (!e.on) continue;
        const fr = f + e.off, d = effD(e, v), c = CAT[e.id];
        LAT[L] = Math.max(LAT[L], fr + d + CFG.hd);
        const dReal = e.id === 'shed' ? e.len : e.id === 'ramp' ? c.d + e.len : c.d;
        OCC[L] = Math.max(OCC[L], fr + dReal + (e.u > 0 ? e.u * CFG.trig + 2 : 0) + 1.2);
        // крыша — необязательный путь, но ловушкой быть не должна: после спрыгивания с конца сарая на этой полосе —
        // свободно на время падения + запас реакции (иначе забежавший наверх упадёт прямо на жердь)
        if (c.cls === RAMP) OCC[L] = Math.max(OCC[L], fr + dReal + v * (Math.sqrt(2 * 2.4 / jumpAt(v, JJ).g) + CFG.react) + 2);
        if (fr + d > end) end = fr + d;
        if (e.id === 'ramp') {
          spawnOb('ramp', L, fr, { variant: e.variant });
          let sp = fr + c.d;
          for (let i = 0; i < e.chain; i++) { spawnOb('shed', L, sp, { len: e.parts[i], ramped: true, variant: (e.variant + i) & 3 }); sp += e.parts[i] + ROOFGAP; }
        } else spawnOb(e.id, L, fr, { len: e.len, u: e.u, variant: e.variant, tut: e.tut });
      }
      if (best < INF) { if (best < gen.minSlack) gen.minSlack = best; gen.slackSum += best; }
      gen.rows++;
      return end;
    }
    // поставить ряд не раньше f0 (сдвигает вперёд до проходимости); возвращает конец ряда или −1
    const R0 = new Float64Array(3), OCC0 = new Float64Array(3);
    function placeRow(row, f0) {
      let f = f0;
      for (let L = 0; L < 3; L++) if (row[L].on && OCC[L] + 1.5 > f + row[L].off) f = OCC[L] + 1.5 - row[L].off;
      // настил с крышей — не под домом-мостом: прыжок с крыши (2,4 + 1,55 + рост) достал бы до свода (4,6 м), камера — тоже
      for (let L = 0; L < 3; L++) {
        const e = row[L]; if (!e.on || e.id !== 'ramp') continue;
        for (let k = 0; k < 4; k++) { const a = f + e.off - 3, b = f + e.off + CAT.ramp.d + e.len + 12, end = bridgeEnd(a, b); if (end < 0) break; f = end + 3 - e.off; }
      }
      for (let i = 0; i < 260; i++) {
        if (planRow(row, f)) {
          if (i) gen.pushes++;
          for (let L = 0; L < 3; L++) { R0[L] = R[L]; OCC0[L] = OCC[L]; }
          const end = commitRow(row, f);
          coinsForRow(row, f, end);
          return end;
        }
        f += 0.6;
      }
      gen.fails++;
      gen.prevEnd = f;   // не застревать на одном месте (так быть не должно — счётчик в stats().plan.fails)
      return -1;
    }
    // дорожка монет к ряду и через него — по полосе, которой можно пройти (дуга над прыжком, низко под коврами, по крыше)
    function coinsForRow(row, f, end) {
      const st = stCfg(stageAt(f));
      if (gen.rng() > st.coin) return;
      // полоса: крыша (настил есть и можно — бег по крышам за монетами, главный «вау»); усилитель впереди — дорожка ведёт к
      // нему; иначе та же, что у прошлой дорожки (если проходима), а через раз — другая (тогда «змейка», см. ниже)
      const L0 = gen.coinLane;
      let L = L0;
      const okL = l => R[l] < INF && !(row[l].on && row[l].u > 0) && RQ[l] !== R_BLOCK;
      let rampL = -1; for (let l = 0; l < 3; l++) if (RQ[l] === R_RAMP && okL(l)) rampL = l;
      const pwL = gen.pwS > gen.coinEnd - 2 && gen.pwS < f && gen.pwL >= 0 && okL(gen.pwL) ? gen.pwL : -1;
      if (rampL >= 0 && gen.rng() < 0.85) L = rampL;
      else if (pwL >= 0) L = pwL;
      else if (!okL(L) || gen.rng() < 0.5) { let n = 0; for (let l = 0; l < 3; l++) if (okL(l)) n++; if (!n) return; let k = ri(n); for (let l = 0; l < 3; l++) if (okL(l) && k-- === 0) L = l; }
      gen.coinLane = L;
      const x = LX[L], gap = CFG.coinGap, e = row[L], v = vAt(f);
      let s = Math.max(gen.coinEnd + gap * 1.5, OCC0[L] + 2, f - 34);
      // «змейка»: дорожка сменила полосу — диагональ из монет через свободный просвет перед рядом (≈ 0,32 с бега): монеты
      // зовут сменить полосу заранее. Только если все пересекаемые полосы свободны от прошлых рядов и до ряда есть место
      if (L !== L0) {
        const lo = L < L0 ? L : L0, hi = L < L0 ? L0 : L;
        let s0 = gen.coinEnd + gap; for (let l = lo; l <= hi; l++) if (OCC0[l] + 2 > s0) s0 = OCC0[l] + 2;
        const len = v * 0.32 * (hi - lo), n = 2 * (hi - lo) + 1;
        if (s0 + len + gap < f - 3) { for (let i = 0; i < n; i++) addTrail(s0 + len * i / (n - 1), lerp(LX[L0], x, i / (n - 1)), CFG.coinY); if (s0 + len + gap > s) s = s0 + len + gap; }
      }
      const rq = RQ[L];
      let stop = rq === R_FREE ? end + 2 : f + (e.on ? e.off : 0) - 2.5;
      if (rq === R_JUMP || rq === R_EITHER) {
        const J = jumpAt(v, JJ), mid = f + e.off + effD(e, v) / 2, take = mid - v * J.T / 2;
        stop = take - 1.2;
        for (; s < stop; s += gap) addTrail(s, x, CFG.coinY);
        const n = Math.max(3, Math.round(v * J.T / 1.9));
        for (let i = 0; i <= n; i++) { const t = i / n; addTrail(take + v * J.T * t, x, 4 * J.H * t * (1 - t) + 0.62); }
        gen.coinEnd = take + v * J.T; return;
      }
      if (rq === R_SLIDE) { stop = f + e.off + effD(e, v) + 2.5; for (; s < stop; s += gap) addTrail(s, x, 0.48); gen.coinEnd = stop; return; }
      if (rq === R_RAMP) {
        const fr = f + e.off; stop = fr - 0.5;
        for (; s < stop; s += gap) addTrail(s, x, CFG.coinY);
        for (s = fr + 0.6; s < fr + 4; s += gap) addTrail(s, x, rampHs(fr, s) + CFG.coinY);
        for (; s < fr + 4 + e.len - 0.8; s += gap) addTrail(s, x, 2.4 + CFG.coinY);
        gen.coinEnd = fr + 4 + e.len; return;
      }
      for (; s < stop; s += gap) addTrail(s, x, CFG.coinY);
      gen.coinEnd = stop;
    }
    // монета дорожки — но не поверх усилителя (кувшин в монетах не читается)
    function addTrail(s, x, y) { if (gen.pwL >= 0 && Math.abs(s - gen.pwS) < 1.3 && Math.abs(x - LX[gen.pwL]) < 0.5) return; addCoin(s, x, y); }
    const rampHs = (fr, s) => clamp((s - fr) / 4, 0, 1) * 2.4;
    // усилитель — в просвете перед рядом, на полосе, куда можно успеть
    function powerForGap(a, b) {
      if (b - a < 14 || a < gen.nextPw || G.tut) return;
      const mid = (a + b) / 2;
      // на полосе дорожки монет (она и приведёт к нему); нельзя — на любой свободной
      let L = -1, n = 0;
      const okP = l => R[l] + 4 < mid && OCC[l] + 3 < mid;
      if (okP(gen.coinLane)) L = gen.coinLane;
      else for (let l = 0; l < 3; l++) if (okP(l)) { n++; if (ri(n) === 0) L = l; }
      if (L < 0) return;
      const st = stageAt(mid);
      let id = gen.rng() < 0.42 ? 'magnet' : gen.rng() < 0.6 ? 'x2' : 'glide';
      if (id === 'glide' && (st < 2 || mid - gen.lastGlide < 900)) id = 'magnet';
      if (id === 'glide') gen.lastGlide = mid;
      spawnPw(id, L, mid); gen.pwS = mid; gen.pwL = L;
      // чаще (раз в ~40–50 с игрок их не встречал — «есть ли они вообще»): цель — хотя бы один за ~30 с, если идти по монетам
      gen.nextPw = mid + (st >= 5 ? rr(400, 650) : rr(250, 450));
    }

    /* ---------- паттерны (заполняют ROWS, возвращают число рядов) ---------- */
    function patOne(st) { clearRows(1); const id = pick(st.oneP); ent(0, ri(3), id, id === 'shed' ? Math.round(rr(8, 16)) : 0); return 1; }
    function patTwo(st) {
      clearRows(1); shuffle();
      const a = pick(st.twoP), b = pick(st.twoP);
      ent(0, PERM[0], a, a === 'shed' ? Math.round(rr(8, 16)) : 0); ent(0, PERM[1], b, b === 'shed' ? Math.round(rr(8, 16)) : 0); return 1;
    }
    function patWall(st) { clearRows(1); shuffle(); ent(0, PERM[0], 'stall'); ent(0, PERM[1], gen.rng() < 0.3 && st.shed ? 'shed' : 'stall', 12); ent(0, PERM[2], pick(st.passP)); return 1; }
    function patLows(st) { clearRows(1); for (let l = 0; l < 3; l++) ent(0, l, pick(st.lowS)); return 1; }
    function patHighs(st) { clearRows(1); for (let l = 0; l < 3; l++) ent(0, l, pick(st.highS)); if (gen.rng() < 0.35) ent(0, ri(3), 'stall'); return 1; }
    function patGates() { clearRows(1); for (let l = 0; l < 3; l++) ent(0, l, 'gate'); if (gen.rng() < 0.4) ent(0, ri(3), 'stall'); return 1; }
    function patRoof(st) {
      clearRows(1); shuffle();
      const sn = stageNum(st), cp = sn <= 3 ? 0.35 : sn === 4 ? 0.85 : 0.5;   // этап 4 «крыши»: цепочкой почти всегда (доля на крышах ≈ 9 → 10+ %)
      const len = roofChain(0, PERM[0], gen.rng() < cp ? 2 + ri(2) : 1).parts[0];
      const r = gen.rng();
      if (r < 0.45) ent(0, PERM[1], 'shed', len + Math.round(rr(0, 4)), 0, 4); else if (r < 0.8) ent(0, PERM[1], 'stall', 0, 0, rr(0, 4));
      if (gen.rng() < 0.32) ent(0, PERM[2], 'stall', 0, 0, rr(1, 6));
      return 1;
    }
    function patRoofs() {
      clearRows(2); shuffle();
      const len = roofChain(0, PERM[0], 2 + ri(2)).parts[0];
      ent(0, PERM[1], 'shed', len, 0, 4); if (gen.rng() < 0.5) ent(0, PERM[2], 'stall', 0, 0, rr(2, 6));
      // второй ряд: на месте спуска с крыш — что-то низкое или жердь
      ent(1, PERM[0], gen.rng() < 0.5 ? 'hay' : 'gate'); ent(1, PERM[1], 'stall');
      return 2;
    }
    function patZig(st) {
      const n = 3; clearRows(n); let l = ri(3);
      for (let k = 0; k < n; k++) { ent(k, l, k === 1 && st.shed && gen.rng() < 0.3 ? 'shed' : 'stall', 8); if (gen.rng() < 0.45) { const l2 = (l + 1 + ri(2)) % 3; ent(k, l2, pick(st.zigP)); } l = (l + 1 + ri(2)) % 3; }
      return n;
    }
    function patCow(st) { clearRows(1); shuffle(); ent(0, PERM[0], 'cow', 0, moveU('cow', stageNum(st))); if (gen.rng() < 0.5) ent(0, PERM[1], gen.rng() < 0.5 ? 'stall' : pick(st.lowS)); return 1; }
    function patBarrels(st) { clearRows(1); shuffle(); const u = moveU('barrels', stageNum(st)); ent(0, PERM[0], 'barrels', 0, u); if (gen.rng() < 0.5) ent(0, PERM[1], 'barrels', 0, u); else if (gen.rng() < 0.5) ent(0, PERM[1], 'stall'); return 1; }
    function patCart(st) { clearRows(1); shuffle(); ent(0, PERM[0], 'cart', 0, moveU('cart', stageNum(st))); if (gen.rng() < 0.6) ent(0, PERM[1], 'stall'); return 1; }
    function patCombo(st) {
      clearRows(2); shuffle();
      ent(0, PERM[0], pick(st.lowS)); ent(0, PERM[1], 'stall'); ent(0, PERM[2], 'stall');
      ent(1, PERM[0], pick(st.highS)); ent(1, PERM[1], 'stall'); if (gen.rng() < 0.5) ent(1, PERM[2], 'stall');
      return 2;
    }
    const stageNum = st => STAGES.indexOf(st) + 1;
    const PAT = { one: patOne, two: patTwo, wall: patWall, lows: patLows, highs: patHighs, gates: patGates, roof: patRoof, roofs: patRoofs, zig: patZig, cow: patCow, barrels: patBarrels, cart: patCart, combo: patCombo };
    const PATK = Object.keys(PAT);
    function choosePat0(st) { let sum = 0; for (let i = 0; i < PATK.length; i++) sum += st.pats[PATK[i]] || 0; let r = gen.rng() * sum; for (let i = 0; i < PATK.length; i++) { r -= st.pats[PATK[i]] || 0; if (r <= 0) return PAT[PATK[i]]; } return patOne; }
    // тот же паттерн подряд — один перебор (повторы «ряд как прошлый» приедались)
    function choosePat(st) { let p = choosePat0(st); if (p === gen.lastPat) p = choosePat0(st); gen.lastPat = p; return p; }

    // первая связка первого забега — обучение: прилавок в середине (полоса), сено (прыжок), ковры (подкат)
    function genTutorial() {
      clearRows(1); ent(0, 1, 'stall').tut = 1; gen.prevEnd = placeRow(ROWS[0], gen.front + 32);
      clearRows(1); for (let l = 0; l < 3; l++) ent(0, l, 'hay').tut = 2; gen.prevEnd = placeRow(ROWS[0], gen.prevEnd + 9 * 3.0);
      clearRows(1); for (let l = 0; l < 3; l++) ent(0, l, 'carpet').tut = 3; gen.prevEnd = placeRow(ROWS[0], gen.prevEnd + 9 * 3.0);
      gen.front = gen.prevEnd + 9 * 2;
    }
    function genPattern() {
      const st0 = stageAt(gen.front), st = stCfg(st0), cyc = Math.max(0, st0 - STAGES.length);
      const gk = Math.max(0.78, Math.pow(0.95, cyc));       // после 6-го этапа — по кругу тем, связки плотнее (скорость уже 20)
      const v = vAt(gen.front);
      const n = choosePat(st)(st);
      let f = gen.prevEnd + v * rr(st.gap[0], st.gap[1]) * gk;
      const a = gen.prevEnd;
      for (let k = 0; k < n; k++) {
        if (k === 0) powerForGap(a, f);
        const end = placeRow(ROWS[k], f);
        if (end < 0) break;
        gen.prevEnd = end; f = end + v * st.inner * gk * rr(0.8, 1.3);
      }
      gen.front = Math.max(gen.prevEnd, gen.front + 1);
    }
    function genReset(from) {
      gen.front = from; gen.prevEnd = from; gen.coinEnd = from;
      const v = vAt(from), react = CFG.react * v, lt = laneDur(v) * v;
      for (let L = 0; L < 3; L++) { R[L] = from + (L === Hh.lane ? 0 : react + lt * Math.abs(L - Hh.lane)); LAT[L] = from; OCC[L] = from; }
    }

    /* =====================================================================
       ШАГ ФИЗИКИ
       ===================================================================== */
    const SCR = { y: 0 };
    function supportAt(x, s, feet) {
      let best = 0;
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i];
        if (!r.top && r.cls !== RAMP) continue;
        if (s < r.s - 0.05 || s > r.s + r.d + 0.05) continue;
        if (Math.abs(x - r.x) > r.w * 0.5 + 0.12) continue;
        const h = r.cls === RAMP ? rampH(r, s) : r.y1;
        if (h <= feet + CFG.stepUp && h > best) best = h;
      }
      return best;
    }
    function overhead() {   // над головой ковёр или балка — встать/прыгнуть нельзя (подкат тянется)
      const s = G.s, x = Hh.x;
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i];
        if (r.cls !== HIGH) continue;
        if (s + CFG.hd + 0.25 <= r.s || s - CFG.hd >= r.s + r.d) continue;
        if (Math.abs(x - r.x) >= r.w * 0.5 + CFG.hw) continue;
        if (r.y0 < Hh.y + CFG.height && r.y1 > Hh.y) return true;
      }
      return false;
    }
    function setPose(p, k) { if (Hh.pose === p && p !== 'jump' && p !== 'slide') return; Hh.pose = p; try { actors.hero.set(p, k); } catch (e) { /* ok */ } }
    function setPPose(p) { if (P.pose === p) return; P.pose = p; try { actors.paltar.set(p); } catch (e) { /* ok */ } }
    function laneTo(l, dur) { Hh.lane0 = Hh.lane; Hh.lane = l; Hh.x0 = Hh.x; Hh.x1 = LX[l]; Hh.lt = 0; Hh.ld = dur; Hh.xs = Hh.x; }
    function doJump() {
      const J = jumpAt(G.v);
      Hh.ground = false; Hh.vy = J.vj; Hh.g = J.g; Hh.jT = J.T; Hh.drop = false; Hh.slideT = 0; Hh.coyote = 0; Hh.slideOnLand = false;
      setPose('jump', J.T); emit('jump');
    }
    function doSlide() {
      Hh.slideD = slideDur(G.v); Hh.slideT = Hh.slideD; setPose('slide', Hh.slideD); emit('slide');
    }
    function tryInput(d) {   // true — выполнено (или не нужно ждать)
      if (Hh.glide) return d === 'left' || d === 'right' ? laneInput(d) : true;
      if (d === 'left' || d === 'right') return laneInput(d);
      if (d === 'up') {
        if (!(Hh.ground || Hh.coyote > 0)) return false;          // в воздухе — подождёт до приземления (буфер)
        if (overhead()) return false;                              // под ковром — после него
        doJump(); return true;
      }
      if (d === 'down') {
        if (!Hh.ground) { Hh.drop = true; Hh.slideOnLand = true; if (Hh.vy > -CFG.dropV) Hh.vy = -CFG.dropV; emit('drop'); return true; }
        doSlide(); return true;
      }
      return true;
    }
    function laneInput(d) {
      const dir = d === 'left' ? -1 : 1, nl = Hh.lane + dir;
      if (nl < 0 || nl > 2) {
        // «влево-влево» из середины (второй свайп раньше edgeEat после первого) — проскочила лишний раз, молча
        if (Hh.laneDir === dir && G.t - Hh.laneAt < CFG.edgeEat) return true;
        edgeBump(dir); return true;
      }
      laneTo(nl, laneDur(G.v)); Hh.laneAt = G.t; Hh.laneDir = dir; emit('lane'); return true;
    }
    // в стену дома за крайней полосой — только качок к стене, звук и лёгкий haptic. НЕ спотыкание: раньше это включало
    // «пальтар рядом» на 8 с, и два случайных свайпа к краю давали поимку без единого препятствия
    function edgeBump(dir) {
      if (Hh.bumpT > 0) return;
      Hh.bumpT = 0.32; Hh.bumpDir = dir; EVD.kind = 'edge'; emit('edge', EVD);
    }
    function stumble(r, edge) {
      if (G.mode !== 'run' || (r && r.tut)) { if (r) { r.hitT = 0.5; if (!edge) laneTo(Hh.lane0, 0.22); } return; }
      if (r) { r.hitT = 0.5; laneTo(Hh.lane0, 0.22); }
      G.stumbles++; G.dip = Math.max(G.dip, 0.22);
      setPose('stumble', 0.5); EVD.kind = edge ? 'edge' : r ? r.id : ''; emit('stumble', EVD);
      if (G.nearT > 0 && G.runT > 2.5) { crash(r, 'stumble2'); return; }   // второе спотыкание, пока пальтар рядом, — поймал
      G.nearT = CFG.nearT;
      // он «тут как тут» сразу: был за камерой (13 м) — теперь у нижнего края кадра и догоняет быстро (в кадре за ≤ 0,4 с,
      // а не через 1,8 с, когда спотыкание уже забылось); с 13 до 5,5 м переход не виден — оба положения за кадром
      if (P.gap > CFG.gapStumble) P.gap = P.pgap = CFG.gapStumble;
      P.crackT = Math.min(P.crackT, 0.6);
    }
    function crash(r, why) {
      if (G.mode !== 'run') return;
      // тесты («мартышка» до поздних этапов): авария считается, препятствие становится «призраком», бег продолжается
      if (G.bot && G.bot.ghost) { EVD.kind = why || (r ? r.id : ''); emit('crash', EVD); G.ghostHits = (G.ghostHits || 0) + 1; if (r) r.hitT = 1e9; return; }
      if (r && r.tut) { stumble(r); return; }                                // на обучении — без поимки
      G.mode = 'crash'; G.modeT = 0; G.crashT = 0; G.crashBy = why || (r ? r.id : ''); CC.ok = false;
      G.crashStop = why !== 'stumble2';
      if (r && G.crashStop && G.s + CFG.hd > r.s - 0.05 && r.cls !== RAMP) G.s = G.ps = Math.min(G.s, r.s - CFG.hd - 0.06);
      for (let i = 0; i < obs.length; i++) obs[i].u = 0;   // корова и повозки останавливаются (не наезжают на пойманную)
      Hh.slideT = 0; Hh.drop = false;
      setPose('stumble', 0.6); EVD.kind = G.crashBy; emit('crash', EVD);
      inq.n = 0;
    }
    function landOn(h) {
      const was = !Hh.ground;
      Hh.y = h; Hh.vy = 0; Hh.ground = true; Hh.sup = h; Hh.drop = false;
      if (was) {
        EVD.kind = h > 0.3 ? 'top' : 'ground'; emit('land', EVD);
        SCR.y = h; if (Hh.airT > 0.25 && fx.dust) { try { fx.dust(V3.set(Hh.x, h, 0)); } catch (e) { /* ok */ } }
        if (Hh.slideOnLand) { Hh.slideOnLand = false; doSlide(); } else if (G.mode === 'run' && !Hh.glide) setPose('run');
      }
      Hh.airT = 0;
    }
    function collide() {
      const hx = Hh.x, s = G.s, hd = CFG.hd, hw = CFG.hw, f0 = Hh.y + 0.04, f1 = Hh.y + (Hh.slideT > 0 ? CFG.slideH : CFG.height);
      const px = Hh.px, ps = G.ps, pf0 = Hh.py + 0.04, pf1 = Hh.py + Hh.ph;
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i]; if (r.hitT > 0) continue;
        if (s + hd <= r.s || s - hd >= r.s + r.d) continue;
        const wx = r.w * 0.5 + hw; if (Math.abs(hx - r.x) >= wx) continue;
        const pxOv = Math.abs(px - r.x) < wx, psOv = ps + hd > r.ps && ps - hd < r.ps + r.d;
        if (r.cls === RAMP) {
          const rh = rampH(r, s);
          if (Hh.y >= rh - CFG.stepUp) continue;                            // по настилу — это опора
          if (!pxOv) stumble(r); else crash(r);
          if (G.mode !== 'run') return; continue;
        }
        if (r.cls === MID && Hh.slideT > 0) continue;                       // жердь: подкат проходит
        if (f1 <= r.y0 || f0 >= r.y1) continue;
        const pyOv = !(pf1 <= r.y0 || pf0 >= r.y1);
        if (!pyOv) {
          if (Hh.py >= r.y1 - 0.08) { if (r.top) landOn(r.y1); else { Hh.y = r.y1 + 0.01; Hh.vy = 7.2; Hh.ground = false; Hh.g = jumpAt(G.v).g; emit('boing'); setPose('jump', 0.6); } continue; }
          crash(r, 'head'); return;                                         // головой в низ ковра — прыгнула под ним
        }
        if (r.top && Hh.y >= r.y1 - CFG.stepUp) { landOn(r.y1); continue; }   // «шагнула» на сено, лавку, крышу, повозку
        if (!psOv) { crash(r); return; }                                     // в лоб
        if (!pxOv) { stumble(r); if (G.mode !== 'run') return; continue; }   // боком при смене полосы — отскок
        crash(r); return;
      }
    }
    function moveObs(dt) {
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i]; r.ps = r.s; if (r.hitT > 0) r.hitT -= dt;
        if (r.u <= 0) continue;
        // идёт навстречу за trig секунд до встречи: положение привязано к героине — встретятся ровно в точке ряда
        const ds = r.meet - G.s, v = Math.max(1, G.vBase);
        if (ds < v * CFG.trig) { if (!r.started) { r.started = true; EVD.id = r.id; emit('moveStart', EVD); } r.s = r.meet + r.u * Math.max(-3, ds / v); if (ds < 0) r.s = Math.min(r.s, r.ps - r.u * dt); }
      }
    }
    function stepRun(dt) {
      // скорость: разгон, провал после спотыкания (восстанавливается за ~1,5 с)
      if (G.mode === 'run') G.vBase = Math.min(CFG.vMax, G.vBase + CFG.accel * dt);
      G.dip = Math.max(0, G.dip - dt * 0.16);
      let v = G.vBase * (1 - G.dip);
      if (G.mode === 'start') v *= sst(0, 0.75, G.modeT);
      if (G.mode === 'crash') v = G.crashStop ? 0 : G.vBase * Math.max(0, 1 - G.crashT / 0.35) * 0.6;
      G.v = v;
      G.ps = G.s; Hh.px = Hh.x; Hh.py = Hh.y; Hh.ph = Hh.slideT > 0 ? CFG.slideH : CFG.height;
      G.s += v * dt;
      moveObs(dt);
      // ввод: исполнить, что можно; невыполнимое ждёт ≤ buffer
      for (let i = 0; i < inq.n;) {
        if (G.mode !== 'run' && G.mode !== 'start') { inq.n = 0; break; }
        if (tryInput(INQ[i].d) || G.t - INQ[i].t > (INQ[i].d === 'up' ? CFG.bufferUp : CFG.buffer)) dropInput(i); else i++;
      }
      // полосы: сам сдвиг — «с места» (easeOutCubic: 28 / 50 / 67 % пути за 1 / 2 / 3 кадра 60 Гц — отклик как в Subway Surfers;
      // smoothstep трогался медленно: 3 / 11 / 23 %); наклон тела, поворот и крен камеры — по прежней мягкой кривой (Hh.xs),
      // иначе на рывке они упирались бы в предел
      if (Hh.lt < 1) {
        Hh.lt = Math.min(1, Hh.lt + dt / Hh.ld); const u = 1 - Hh.lt;
        Hh.x = lerp(Hh.x0, Hh.x1, 1 - u * u * u);
        const xs = lerp(Hh.x0, Hh.x1, ease(Hh.lt)); Hh.vx = (xs - Hh.xs) / dt; Hh.xs = xs;
      } else { Hh.vx = (Hh.x - Hh.px) / dt; Hh.xs = Hh.x; }
      if (Hh.bumpT > 0) Hh.bumpT = Math.max(0, Hh.bumpT - dt);
      // высота: опора, полёт, подкат, параплан
      if (Hh.glide) stepGlide(dt);
      else if (Hh.ground) {
        const sup = supportAt(Hh.x, G.s, Hh.y);
        if (sup < Hh.y - 0.03) { Hh.ground = false; Hh.vy = 0; Hh.coyote = CFG.coyote; Hh.g = jumpAt(v).g; Hh.airT = 0; }
        else { Hh.y = sup; Hh.sup = sup; }
      } else {
        Hh.airT += dt; if (Hh.coyote > 0) Hh.coyote -= dt;
        Hh.vy -= Hh.g * dt * (Hh.drop ? CFG.dropG : 1); Hh.y += Hh.vy * dt;
        if (Hh.vy <= 0) { const sup = supportAt(Hh.x, G.s, Hh.py); Hh.sup = sup; if (Hh.y <= sup) landOn(sup); }
        if (Hh.y < 0) landOn(0);
      }
      if (Hh.slideT > 0) { Hh.slideT -= dt; if (Hh.slideT <= 0) { if (overhead()) Hh.slideT = 0.03; else if (G.mode === 'run' && Hh.ground) setPose('run'); } }
      if (G.mode === 'run' && !Hh.glide) collide();
      // шаги — для звука (на земле, не в подкате)
      if (Hh.ground && Hh.slideT <= 0 && v > 1 && !Hh.glide) { Hh.stepT -= dt; if (Hh.stepT <= 0) { Hh.stepT = 0.34 * Math.sqrt(CFG.v0 / v); EVD.kind = Hh.y > 0.3 ? 'wood' : 'stone'; emit('step', EVD); } }
      // монеты и усилители
      stepCoins(dt); stepPowers(dt);
      // счёт
      const ds = G.s - G.ps; G.dist += ds;
      G.mult = Math.min(CFG.multMax, 1 + Math.floor(G.dist / CFG.multEvery));
      if (G.mode === 'run') G.scoreD += ds * G.mult;
      G.score = Math.floor(G.scoreD) + G.coins * CFG.coinScore;
      // этап
      const st = stageAt(G.s);
      if (st !== G.stage) {
        G.stage = st; G.theme = (st - 1) % themes.length; G.hourT = themes[G.theme].hour != null ? themes[G.theme].hour : 12; stageBanner();
        // «рывок» пальтара на новом этапе: догоняет до gapDash со щелчком плётки и снова отстаёт — без штрафа, но погоню видно
        if (G.mode === 'run' && G.nearT <= 0) { G.dashT = CFG.dashT; P.crackT = Math.min(P.crackT, 0.9); }
      }
      // прошла свою лучшую дистанцию — баннер и звон (рекорд не только на карточке в конце)
      if (!G.recPass && G.mode === 'run' && G.bestDist0 > 60 && G.dist - G.s0 > G.bestDist0) {
        G.recPass = true; try { if (ui.banner) ui.banner('✨ Рекорд — ' + Math.floor(G.bestDist0) + ' м позади!'); } catch (e) { /* ok */ } EVD.kind = 'pass'; emit('record', EVD);
      }
      // след для пальтара
      hI = (hI + 1) % HN; hS[hI] = G.s; hX[hI] = Hh.x; hY[hI] = Hh.glide ? 0 : Hh.y; if (hCount < HN) hCount++;
    }
    function stageBanner() {
      const th = themes[G.theme], n = G.stage;
      if (ui.banner) { try { ui.banner('Этап ' + n + ' — ' + (named ? th.title : (th.titleN || th.title))); } catch (e) { /* ok */ } }
      EVD.n = n; emit('stage', EVD);
    }
    /* ---------- параплан: подъём → полёт над улицей (с дорожкой монет) → мягкий спуск на расчищенную полосу ---------- */
    function startGlide() {
      const v = G.vBase;
      // спуск — не в дом-мост: полёт продлевается, пока место спуска не за мостом
      let fly = CFG.glideT;
      for (let k = 0; k < 6; k++) { const d0 = G.s + v * (CFG.glideUp + fly) - 4, end = bridgeEnd(d0, d0 + v * CFG.glideDown + 8); if (end < 0) break; fly = (end + 6 - G.s) / v - CFG.glideUp; }
      Hh.glFly = fly;
      const tot = CFG.glideUp + fly + CFG.glideDown, sLand = G.s + v * tot;
      Hh.glide = 1; Hh.glT = 0; Hh.glY0 = Hh.y; Hh.ground = false; Hh.vy = 0; Hh.slideT = 0; Hh.drop = false; Hh.slideOnLand = false; Hh.ceil = glideTop(G.s, v);
      setPose('glide', tot); EVD.id = 'glide'; emit('glideStart', EVD);
      // место посадки и всё за ним — заново: препятствия дальше sLand − 1,8 с пути убираем (они в тумане), генератор — с чистого
      const cut = sLand - v * 1.8;
      for (let i = obs.length - 1; i >= 0; i--) if (obs[i].s + obs[i].d > cut) freeOb(i);
      for (let i = 0; i < NC; i++) if (cSt[i] && cS[i] > cut) freeCoin(i);
      for (let i = 0; i < PWS.length; i++) if (PWS[i].on && PWS[i].s > cut) freePw(PWS[i]);
      const from = sLand + v * 1.0;
      genReset(from); gen.nextPw = Math.max(gen.nextPw, from + 300);
      for (let L = 0; L < 3; L++) R[L] = sLand;   // приземлиться можно на любую полосу
      // дорожка монет на высоте полёта: змейкой по полосам
      let L = Hh.lane, s = G.s + v * (CFG.glideUp + 0.3);
      const s1 = G.s + v * (CFG.glideUp + fly - 0.2);
      let k = 0;
      while (s < s1) { addCoin(s, LX[L], glideTop(s, v) + 0.35); s += 2.6; if (++k % 9 === 0) L = clamp(L + (gen.rng() < 0.5 ? -1 : 1), 0, 2); }
    }
    // высота полёта в точке s: над домом-мостом — выше его верха (подъём заранее, за ~1,3 с)
    function glideTop(s, v) { return bridgeEnd(s - 3, s + v * 1.3) < 0 ? CFG.glideY : Math.max(CFG.glideY, BR.top + 0.55); }
    function stepGlide(dt) {
      Hh.glT += dt;
      const t = Hh.glT, u = CFG.glideUp, f = Hh.glFly || CFG.glideT, d = CFG.glideDown;
      Hh.ceil = damp(Hh.ceil, glideTop(G.s, Math.max(1, G.v)), 3.2, dt);   // над домом-мостом — плавно выше
      const top = Hh.ceil;
      if (t < u) Hh.y = lerp(Hh.glY0, top, ease(t / u));
      else if (t < u + f) Hh.y = top + Math.sin((t - u) * 2.2) * 0.12;
      else if (t < u + f + d) { const sup = supportAt(Hh.x, G.s, 9); Hh.y = lerp(top, sup, ease((t - u - f) / d)); Hh.sup = sup; }
      else { Hh.glide = 0; landOn(supportAt(Hh.x, G.s, 9)); emit('glideEnd'); setPose('run'); }
    }
    /* ---------- монеты ---------- */
    function collectCoin(i) {
      const add = G.x2T > 0 ? 2 : 1; G.coins += add; G.coinStreak++;
      EVD.n = G.coinStreak; EVD.pitch = Math.min(12, G.coinStreak % 13); EVD.x = cX[i]; EVD.y = cY[i]; EVD.kind = add > 1 ? 'x2' : '';
      emit('coin', EVD);
      if (fx.coinBurst) { try { fx.coinBurst(V3.set(cX[i], cY[i], -(cS[i] - G.s))); } catch (e) { /* ok */ } }
      freeCoin(i);
    }
    function stepCoins(dt) {
      const s = G.s, hx = Hh.x, f0 = Hh.y - 0.3, f1 = Hh.y + (Hh.slideT > 0 ? CFG.slideH : CFG.height) + 0.35, mag = G.magT > 0;
      G.coinIdle += dt; if (G.coinIdle > 1.2) G.coinStreak = 0;
      for (let i = 0; i < NC; i++) {
        const st = cSt[i]; if (!st) continue;
        const ds = cS[i] - s;
        if (ds < -3) { freeCoin(i); continue; }
        if (st === 1 && mag && ds < CFG.magnetR && ds > -1 && Math.abs(cY[i] - Hh.y) < 5) cSt[i] = 2;
        if (cSt[i] === 2) {   // летит к героине (кувшин-магнит)
          const k = 1 - Math.exp(-11 * dt);
          cS[i] += (s + 0.3 - cS[i]) * k + G.v * dt * 0.5; cX[i] += (hx - cX[i]) * k; cY[i] += (Hh.y + 0.95 - cY[i]) * k;
          if (Math.abs(cS[i] - s) < 0.7 && Math.abs(cX[i] - hx) < 0.6) { G.coinIdle = 0; collectCoin(i); }
          continue;
        }
        if (ds > CFG.hd + 0.35 || ds < -CFG.hd - 0.35) continue;
        if (Math.abs(cX[i] - hx) > 0.78) continue;
        if (cY[i] < f0 || cY[i] > f1) continue;
        G.coinIdle = 0; collectCoin(i);
      }
    }
    function stepPowers(dt) {
      if (G.magT > 0) { G.magT -= dt; if (G.magT <= 0) { G.magT = 0; EVD.id = 'magnet'; emit('powerEnd', EVD); } }
      if (G.x2T > 0) { G.x2T -= dt; if (G.x2T <= 0) { G.x2T = 0; EVD.id = 'x2'; emit('powerEnd', EVD); } }
      const s = G.s;
      for (let i = 0; i < PWS.length; i++) {
        const r = PWS[i]; if (!r.on) continue;
        const ds = r.s - s;
        if (ds < -4) { freePw(r); continue; }
        if (G.mode !== 'run' || Math.abs(ds) > CFG.hd + 0.45 || Math.abs(r.x - Hh.x) > 0.9 || r.y < Hh.y - 0.4 || r.y > Hh.y + CFG.height + 0.5) continue;
        if (r.id === 'magnet') G.magT = CFG.magnetT; else if (r.id === 'x2') G.x2T = CFG.x2T; else if (!Hh.glide) startGlide();
        EVD.id = r.id; emit('power', EVD);
        freePw(r);
      }
    }
    /* ---------- пальтар: на старте рядом и отстаёт; после спотыкания догоняет; при аварии — ловит ---------- */
    function stepPaltar(dt) {
      // погоня ВИДНА: облёт камеры на старте — он в 2,6 м сбоку (камера облетает с другой стороны, не сквозь него), потом до
      // openT бежит прямо за ней (gapOpen) и отстаёт; на новом этапе — «рывок» (gapDash) со щелчком плётки; после спотыкания —
      // рядом (gapNear); без ошибок он за камерой (gapFar), но бубенцы слышно (jingleFar)
      const orbit = (G.mode === 'start' || G.mode === 'run') && G.runT < CFG.orbitT;
      let target = CFG.gapFar;
      if (G.mode === 'intro') target = CFG.gapStart;
      else if (orbit) target = 2.6;
      else if (G.mode === 'crash' || G.mode === 'over') target = CFG.gapCatch;
      else if (G.nearT > 0) target = CFG.gapNear;
      else if (G.dashT > 0) target = CFG.gapDash;
      else if (G.runT < CFG.openT) target = CFG.gapOpen;
      if (G.mode === 'run' && G.nearT > 0) G.nearT -= dt;
      if (G.mode === 'run' && G.dashT > 0) G.dashT -= dt;
      P.pgap = P.gap;
      // догоняет быстро (после спотыкания — 9 м/с: в кадре сразу; на поимке — 16 м/с: сцена короче), отстаёт мягко
      // (на старте — как будто выдохся: 2 м/с)
      const d = target - P.gap, rate = d < 0 ? (G.mode === 'crash' ? 16 : G.nearT > 0 ? 9 : G.dashT > 0 ? 8 : 5.5) : (G.runT < 6 ? 2.0 : 2.8);
      P.gap += clamp(d * 3, -rate, rate) * dt;
      // сторона: рядом — чуть сбоку от героини (иначе он закрыл бы героиню от камеры), к середине улицы; на облёте — с той
      // стороны, куда камера НЕ летит (камера идёт через +x)
      const sideT = G.mode === 'intro' ? 0 : orbit ? -1 : Hh.lane === 0 ? 1 : Hh.lane === 2 ? -1 : P.side;
      P.side = sideT === 0 ? P.side : sideT;
      const near = P.gap < 6 && G.mode !== 'intro';
      // на заставке выглядывает из-за плеча героини (слева в кадре), при поимке — прямо за ней. Сбоку: вплотную (2,4 м) — на
      // 1,05 м (виден по пояс снизу сбоку, как в Subway Surfers), дальше (3–4 м: старт, рывок) — ближе к оси, 0,5 м: в портрете
      // по горизонтали видно ±16°, и на 1,65 м он уходил за край кадра целиком (погоню было только слышно)
      const offT = G.mode === 'intro' ? -0.75 : orbit ? -1.6 : G.mode === 'crash' || G.mode === 'over' ? 0.25 * P.side : near ? P.side * lerp(1.05, 0.5, clamp(P.gap - 2.4, 0, 1)) : 0;
      P.off = damp(P.off, offT, G.mode === 'intro' ? 40 : 3, dt);
      if (P.gap < CFG.jingleFar && G.mode !== 'intro' && G.mode !== 'over') {
        // бубенцы — всегда, пока он ближе jingleFar (громкость — по дистанции, у звука: EVD.n), чаще, когда близко
        P.jingleT -= dt; if (P.jingleT <= 0) { P.jingleT = P.gap < 5 ? 0.55 : P.gap < 9 ? 1.1 : 1.6; EVD.n = P.gap; emit('jingle', EVD); try { actors.paltar.jingle(); } catch (e) { /* ok */ } }
        P.crackT -= dt; if (P.gap < 5.5 && P.crackT <= 0) { P.crackT = 2.2 + G.rng() * 1.6; emit('crack'); try { actors.paltar.crack(); } catch (e) { /* ok */ } }
      }
      // «почти догнал» (тянет руки) — когда он правда догоняет (после спотыкания, рывок этапа); на старте отстаёт и просто бежит
      if (G.mode === 'run' || G.mode === 'start') setPPose(P.gap < 5 && G.runT > 1.2 && (G.nearT > 0 || G.dashT > 0) ? 'near' : 'run');
    }
    // след героини в точке s (бинарный поиск по кольцу истории; нет — текущее)
    function trailAt(s) {
      if (hCount < 2 || s >= hS[hI]) { SCR.x = Hh.x; SCR.y = Hh.glide ? 0 : Hh.y; return SCR; }
      let lo = 0, hi = hCount - 1;   // индексы назад от hI: 0 — новейший
      if (s <= hS[(hI - hi + HN) % HN]) { const j = (hI - hi + HN) % HN; SCR.x = hX[j]; SCR.y = hY[j]; return SCR; }
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (hS[(hI - m + HN) % HN] > s) lo = m; else hi = m; }
      const a = (hI - lo + HN) % HN, b = (hI - hi + HN) % HN, k = (s - hS[b]) / Math.max(1e-6, hS[a] - hS[b]);
      SCR.x = lerp(hX[b], hX[a], k); SCR.y = lerp(hY[b], hY[a], k); return SCR;
    }

    /* ---------- обучение (первый забег): замедление перед рядом, пока не сделала нужный свайп ---------- */
    function stepTutorial() {
      if (!G.tut || G.mode !== 'run') return;
      if (!G.tutWait) {
        for (let i = 0; i < obs.length; i++) {
          const r = obs[i]; if (r.tut !== G.tutStep + 1) continue;
          // в лучший момент для действия (от груди героини до препятствия): полоса — за 6,5 м, прыжок — 3,1 (середина окна
          // отрыва), подкат — 3,2; на время подсказки — почти стоп-кадр (×0,04), пока не сделает нужный свайп
          const need = r.tut === 1 ? 'lr' : r.tut === 2 ? 'up' : 'down', df = r.s - (G.s + CFG.hd);
          if (df > (need === 'lr' ? 6.5 : need === 'up' ? 3.1 : 3.2) || df < 0) continue;
          // уже делает нужное (сменила полосу, в воздухе, в подкате) — шаг засчитан без подсказки
          if ((need === 'lr' && Hh.lane !== r.lane) || (need === 'up' && !Hh.ground) || (need === 'down' && Hh.slideT > 0)) { G.tutStep++; if (G.tutStep >= 3) { G.tut = false; G.tutDone = true; } break; }
          G.tutWait = need; G.timeTarget = 0.04; try { if (ui.tutorial) ui.tutorial(need); } catch (e) { /* ok */ }
          break;
        }
      }
    }
    function tutInput(dir) {
      const w = G.tutWait, ok = (w === 'lr' && (dir === 'left' || dir === 'right')) || (w === 'up' && dir === 'up') || (w === 'down' && dir === 'down');
      if (!ok) return;
      G.tutWait = null; G.timeTarget = 1; G.tutStep++; try { if (ui.tutorial) ui.tutorial(null); } catch (e) { /* ok */ }
      if (G.tutStep >= 3) { G.tut = false; G.tutDone = true; }
    }

    /* =====================================================================
       СОСТОЯНИЯ: заставка → старт → забег ↔ пауза → авария/поимка → конец
       ===================================================================== */
    function releaseAll() {
      for (let i = obs.length - 1; i >= 0; i--) freeOb(i);
      for (let i = segs.length - 1; i >= 0; i--) freeSeg(i);
      for (let i = 0; i < NC; i++) cSt[i] = 0; cFree = NC;
      for (let i = 0; i < PWS.length; i++) if (PWS[i].on) freePw(PWS[i]);
    }
    function reset(seed, stage) {
      releaseAll();
      for (const k in EV) EV[k] = 0;   // счётчики событий — на забег
      G.seed = (seed >>> 0) || 1; G.rng = mulberry(G.seed ^ 0x9E37); gen.rng = mulberry(G.seed); gen.rngS = mulberry(G.seed * 7 + 13);
      const st = Math.max(1, stage | 0 || 1);
      G.s0 = 0; G.s = G.ps = (st - 1) * CFG.stageLen; G.origin = Math.floor(G.s / 256) * 256;
      G.vBase = Math.min(CFG.vMax, Math.sqrt(CFG.v0 * CFG.v0 + 2 * CFG.accel * G.s)); G.v = 0; G.dip = 0;
      G.dist = G.s; G.scoreD = 0; G.coins = 0; G.score = 0; G.mult = 1; G.stage = st; G.theme = (st - 1) % themes.length;
      G.hour = G.hourT = themes[G.theme].hour != null ? themes[G.theme].hour : 12;
      G.magT = G.x2T = 0; G.stumbles = 0; G.nearT = 0; G.crashT = 0; G.caught = false; G.crashBy = ''; G.overT = 0; G.record = false;
      G.runT = 0; G.coinStreak = 0; G.coinIdle = 0; G.timeK = G.timeTarget = 1; G.tutWait = null; G.tutStep = 0; G.tutDone = false;
      try { if (ui.tutorial) ui.tutorial(null); } catch (e) { /* ok */ }
      Object.assign(Hh, { lane: 1, lane0: 1, x: 0, px: 0, x0: 0, x1: 0, lt: 1, vx: 0, y: 0, py: 0, vy: 0, ground: true, sup: 0, slideT: 0, drop: false, slideOnLand: false, coyote: 0, bumpT: 0, airT: 0, glide: 0, glT: 0, ceil: CFG.glideY, pose: '', laneAt: -9, laneDir: 0, xs: 0 });
      P.gap = P.pgap = CFG.gapStart; P.off = 0; P.pose = ''; P.jingleT = 0.4; P.crackT = 2; P.side = -1;
      G.dashT = 0; G.caughtT = 0; G.recPass = false;
      hI = 0; hCount = 0; inq.n = 0;
      // улица и позади старта (segBehindStart): заставка и облёт камеры смотрят назад — там село, а не обрыв мостовой
      segEnd = Math.floor((G.s - CFG.segBehindStart) / 40) * 40; segK = 0;
      gen.rows = 0; gen.minSlack = INF; gen.slackSum = 0; gen.fails = 0; gen.pushes = 0; gen.coinLane = 1; gen.lastGlide = -1e9; gen.lastPat = null; gen.pwS = -1e9; gen.pwL = -1;
      // первый ряд — ближе (было +34 и связки реже: первое обязательное действие — на 6–12-й секунде)
      genReset(G.s + 24);
      gen.nextPw = G.s + rr(200, 320);
      // первые метры: монетки по середине (бежать сразу весело) — до первого ряда; обучение — если первый забег
      for (let s = G.s + 8; s < G.s + 30; s += CFG.coinGap) addCoin(s, 0, CFG.coinY);
      gen.coinEnd = G.s + 30;
      if (G.tut) genTutorial();
      while (segEnd < G.s + CFG.segAhead) addSegment();
      while (gen.front < G.s + CFG.genAhead) genPattern();
      setPose('idle'); setPPose('idle');
    }
    function intro() { G.mode = 'intro'; G.modeT = 0; setPose('idle'); setPPose('idle'); screen('start', startData()); musicCmd('stop'); }
    function startRun(seed) {
      const sv = loadSave();
      G.tut = (o.dbg.tut === true) || (o.dbg.tut !== false && !sv.tut && !G.bot);
      G.bestDist0 = sv.bestDist || 0;
      reset(seed != null ? seed : G.seed, G.stageStart || 1);
      G.mode = 'start'; G.modeT = 0;
      setPose('run'); setPPose('run');
      screen('run', null); emit('start'); musicCmd('play');
    }
    function pause() {
      if (G.mode !== 'run' && G.mode !== 'start') return;
      G.pausedFrom = G.mode; G.mode = 'pause'; inq.n = 0; screen('pause', { score: G.score, coins: G.coins, dist: Math.floor(G.dist) }); emit('pause'); musicCmd('pause');
    }
    function resume() {
      if (G.mode !== 'pause') return;
      G.mode = G.pausedFrom || 'run'; G.timeK = 0.05; screen('run', null); emit('resume'); musicCmd('play');
    }
    function finish() {
      if (P.pose !== 'catch' && P.pose !== 'cheer') { setPPose('catch'); setPose('caught', 0); }
      G.mode = 'over'; G.modeT = 0;
      const sv = loadSave(), score = G.score, dist = Math.floor(G.dist - G.s0);
      G.record = score > (sv.best || 0) && score > 0;
      sv.best = Math.max(sv.best || 0, score); sv.bestDist = Math.max(sv.bestDist || 0, dist);
      sv.coins = (sv.coins || 0) + G.coins; sv.runs = (sv.runs || 0) + 1; if (G.tutDone || !G.tut) sv.tut = true; sv.last = score;
      if (!G.sim || G.simSave) writeSave(sv);
      G.best = sv.best; G.runs = sv.runs; G.totalCoins = sv.coins; G.bestDist = sv.bestDist;
      if (G.record) emit('record');
      emit('over');
      screen('over', { score, coins: G.coins, dist, best: sv.best, bestDist: sv.bestDist, record: G.record, stage: G.stage, totalCoins: sv.coins, runs: sv.runs, named });
      musicCmd('stop');
      if (G.onOver) G.onOver();
    }
    // поимка — коротко (≈ 2,2 с от аварии до карточки, было 3,7): подбегает (16 м/с), «поднял — покружил» (0,8 с), грозит
    // пальцем — и карточка; под карточкой сцена идёт дальше (она смеётся, он радуется). Тап после 0,8 с — сразу карточка
    function stepCrash(dt) {
      G.crashT += dt;
      if (!G.caught && P.gap < CFG.gapCatch + 0.35) {
        G.caught = true; G.caughtT = 0; setPPose('catch'); setPose('caught', 0); emit('caught');
        // «ой!» — звёздочки над головой (те же искры, что у монеты)
        if (fx.coinBurst) { try { fx.coinBurst(V3.set(Hh.x, Hh.y + 1.85, 0)); } catch (e) { /* ok */ } }
      }
      if (G.caught) G.caughtT += dt;
      if (G.caught && G.caughtT > 1.3) finish();
      if (G.crashT > 3) { G.caught = true; finish(); }
    }
    function skipCrash() { if (G.mode === 'crash' && G.crashT > 0.8) { G.caught = true; finish(); } }
    function screen(name, d) { try { if (ui.screen) ui.screen(name, d); } catch (e) { console.warn('runner: ui', e); } }
    function musicCmd(c) { if (host.music && !G.sim) { try { host.music(c, { speed: G.v }); } catch (e) { /* ok */ } } }
    function loadSave() {
      let sv = null; try { sv = host.save && host.save.get ? host.save.get() : null; } catch (e) { sv = null; }
      const o2 = sv && typeof sv === 'object' ? sv : {};
      const num = k => (typeof o2[k] === 'number' && isFinite(o2[k]) && o2[k] >= 0 ? o2[k] : 0);
      return { best: num('best'), bestDist: num('bestDist'), coins: num('coins'), runs: num('runs'), tut: o2.tut === true, last: num('last') };
    }
    function writeSave(sv) { try { if (host.save && host.save.set) host.save.set(sv); } catch (e) { console.warn('runner: save', e); } }
    function startData() { const sv = loadSave(); return { title: title(named, true), best: sv.best, bestDist: sv.bestDist, coins: sv.coins, runs: sv.runs, first: !sv.tut, named }; }

    /* =====================================================================
       КАДР: шаги + интерполяция + позиции + актёры + камера + небо + HUD
       ===================================================================== */
    let acc = 0;
    const V3 = new T.Vector3(), CAM = { x: 0, y: 3.4, z: 6, tx: 0, ty: 1, tz: -8, roll: 0, fov: CFG.camFovP, init: false, lb: 0 };
    const AS = { camX: 0, camZ: 6, mode: 'intro', speed: 0, x: 0, y: 0, vy: 0, lat: 0, air: false, slide: 0, ground: 0, t: 0, glide: 0, near: false, gap: 0, pground: 0, caught: false, stage: 1, lane: 1 };
    const PS = { mode: 'intro', speed: 0, x: 0, y: 0, t: 0, gap: 0, pground: 0, near: false, ground: 0, lat: 0, slide: 0, air: false, vy: 0, cdx: 0.45, cdz: 0.75, camX: 0, camZ: 6 };
    const HUDD = { score: 0, coins: 0, dist: 0, mult: 1, power: [], stage: 1 };
    const HUDP = [{ id: 'magnet', t: 0, T: CFG.magnetT }, { id: 'x2', t: 0, T: CFG.x2T }, { id: 'glide', t: 0, T: CFG.glideT }];
    let slideVis = 0;
    function step(dt) {
      G.t += dt; G.modeT += dt;
      if (G.mode === 'run' || G.mode === 'start' || G.mode === 'crash') {
        if (G.mode !== 'crash') G.runT += dt;
        if (G.mode === 'start' && G.modeT > 0.75) { G.mode = 'run'; G.modeT = 0; if (!G.sim) stageBanner(); }   // «Этап 1 — Улица мастеров»
        stepRun(dt);
        if (G.mode === 'crash') stepCrash(dt);
        if (G.bot) botStep(dt);
        stepTutorial();
        // генератор и уборка
        while (gen.front < G.s + CFG.genAhead) genPattern();
        while (segEnd < G.s + CFG.segAhead) addSegment();
        for (let i = obs.length - 1; i >= 0; i--) if (obs[i].s + obs[i].d < G.s - CFG.obBehind) freeOb(i);
        // позади старта улица держится, пока камера облетает героиню (смотрит и назад), потом — обычные 32 м
        const behind = G.runT < CFG.orbitT + 0.6 ? CFG.segBehindStart : CFG.segBehind;
        for (let i = segs.length - 1; i >= 0; i--) if (segs[i].s + segs[i].len < G.s - behind) freeSeg(i);
      } else {
        G.ps = G.s; Hh.px = Hh.x; Hh.py = Hh.y;
        // под карточкой «догнал!» сцена идёт: погрозил пальцем — и радуется
        if (G.mode === 'over') { G.caughtT += dt; if (G.caughtT > 2.0 && P.pose === 'catch') setPPose('cheer'); }
      }
      if (G.mode !== 'pause') stepPaltar(dt);
      if (G.s - G.origin > 256) G.origin += 256;
    }
    function frame(dtReal, render) {
      const t0 = performance.now();
      let dt = Math.min(0.1, Math.max(0, dtReal));
      G.timeK = damp(G.timeK, G.mode === 'pause' ? 0 : G.timeTarget, G.timeTarget < 1 ? 9 : 4, dt);
      const dts = G.mode === 'pause' ? 0 : dt * (G.timeK > 0.985 ? 1 : G.timeK);
      acc += dts;
      let n = 0;
      while (acc >= CFG.step && n < CFG.maxSteps) { step(CFG.step); acc -= CFG.step; n++; }
      if (n === CFG.maxSteps) acc = 0;
      G.hour = damp(G.hour, G.hourT, 0.35, dts);
      const a = clamp(acc / CFG.step, 0, 1);
      visuals(dt, dts, a);
      G.lastLogic = performance.now() - t0;
      if (render !== false && o.render) o.render();
      G.frames = (G.frames || 0) + 1;
    }
    function visuals(dt, dts, a) {
      const sR = lerp(G.ps, G.s, a), xR = lerp(Hh.px, Hh.x, a) + (Hh.bumpT > 0 ? Math.sin((1 - Hh.bumpT / 0.32) * PI) * CFG.edgeBump * Hh.bumpDir : 0), yR = lerp(Hh.py, Hh.y, a);
      track.position.z = sR - G.origin;
      // гирлянды (seg.overhead, 5,1…5,8 м): прячем, только пока героиня на параплане проходит их высоту (подъём и спуск)
      const band = Hh.glide && yR > 3.4 && yR < 5.95;
      // ориентир сбоку (башня, комбинат, кофейня, школа) на подходе 30…80 м — камера чуть доворачивает к нему (≈ 3,5°): в
      // портрете по горизонтали видно ≈ 34°, и без доворота они мелькали обрывками у края кадра
      let lb = 0;
      for (let i = 0; i < segs.length; i++) {
        const r = segs[i]; if (!r.h || !r.h.group) continue;
        const lm = r.h.lm;
        if (lm && lm.side) { const d = r.s - (lm.z0 + lm.z1) * 0.5 - sR; if (d > 10 && d < 130) { const w = sst(130, 80, d) * sst(10, 28, d); if (w > Math.abs(lb)) lb = lm.side * w; } }
        r.h.group.position.z = -(r.s - G.origin);
        const sv = r.s - sR < CFG.segView; if (r.h.group.visible !== sv) r.h.group.visible = sv;   // заготовка впрок — за туманом не рисуем
        if (r.h.overhead) { const hide = band && r.s < sR + 30 && r.s + r.len > sR - 8; if (r.h.overhead.visible === hide) r.h.overhead.visible = !hide; }
      }
      const runV = G.mode === 'run' || G.mode === 'start';
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i]; if (!r.h || !r.h.group) continue;
        const sm = lerp(r.ps, r.s, a) + r.d * 0.5;
        r.h.group.position.set(r.x, 0, -(sm - G.origin) + r.zc);
        // высокое пройденное (прилавок, ковёр, балка, сарай, повозка) рядом по x — между камерой (y ≈ 4) и героиней: закрывало
        // её целиком ~12 раз в минуту ровно тогда, когда надо видеть, где она. Прячем, как только оно целиком позади (на 0,4 м);
        // низкое (сено, лавки) остаётся до obBehind. Флаг защёлкивается: в сцене поимки ничего не «выпрыгивает» обратно.
        // Тонкое подвесное (ковёр, жердь) — сразу за спиной (0,05 м): иначе 0,1 с после подката оно ровно на луче камера → голова
        if (runV && !r.gone && r.y1 > 1.6 && r.s + r.d < sR - (r.cls === HIGH ? 0.05 : 0.4) && Math.abs(r.x - xR) < 2.6) r.gone = true;
        const vis = r.s - sR < CFG.obView && !r.gone; if (r.h.group.visible !== vis) r.h.group.visible = vis;
      }
      for (let i = 0; i < PWS.length; i++) { const r = PWS[i]; if (!r.on || !r.h || !r.h.group) continue; r.h.group.position.set(r.x, r.y + Math.sin(G.t * 3 + i) * 0.12, -(r.s - G.origin)); r.h.group.rotation.y = G.t * 2.2; }
      // монеты: видимые — подряд в InstancedMesh, вращение вокруг вертикали
      const arr = coinMesh.instanceMatrix.array; let n = 0;
      const spin = G.t * 3.4;
      for (let i = 0; i < NC; i++) {
        if (!cSt[i]) continue;
        const ds = cS[i] - sR; if (ds < -6 || ds > 150) continue;
        const an = spin + cPh[i], c = Math.cos(an), s = Math.sin(an), k = n * 16;
        arr[k] = c; arr[k + 1] = 0; arr[k + 2] = -s; arr[k + 3] = 0; arr[k + 4] = 0; arr[k + 5] = 1; arr[k + 6] = 0; arr[k + 7] = 0;
        arr[k + 8] = s; arr[k + 9] = 0; arr[k + 10] = c; arr[k + 11] = 0; arr[k + 12] = cX[i]; arr[k + 13] = cY[i]; arr[k + 14] = -(cS[i] - G.origin); arr[k + 15] = 1;
        n++;
      }
      coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true;
      // героиня
      slideVis = damp(slideVis, Hh.slideT > 0 ? 1 : 0, 18, dts);
      const hr = actors.hero.root;
      if (hr) { hr.position.set(xR, yR, 0); hr.rotation.y = PI - clamp(Hh.vx * 0.018, -0.3, 0.3) + (G.mode === 'intro' ? 0 : 0); }
      AS.mode = G.mode; AS.speed = G.v; AS.x = xR; AS.y = yR; AS.vy = Hh.vy; AS.lat = Hh.vx; AS.air = !Hh.ground && !Hh.glide; AS.slide = slideVis; AS.ground = Math.min(yR, supportAt(xR, sR, yR));   // под тенью-пятном: земля, крыша, верх сена
      AS.t = G.t; AS.glide = Hh.glide ? 1 : 0; AS.near = P.gap < 5; AS.gap = P.gap; AS.caught = G.caught; AS.stage = G.stage; AS.lane = Hh.lane;
      // пальтар — по следу героини
      const gR = lerp(P.pgap, P.gap, a), tr = trailAt(sR - gR);
      const pr = actors.paltar.root;
      if (pr) { pr.position.set(tr.x + P.off, tr.y, gR); pr.rotation.y = PI + (G.mode === 'over' ? Math.sin(G.modeT * 1.3) * 0.2 : 0); pr.visible = gR < 30; }
      PS.mode = G.mode; PS.speed = G.mode === 'over' ? 0 : G.mode === 'intro' ? 0 : Math.max(G.v, G.mode === 'crash' ? 3 : 0); PS.x = tr.x; PS.y = tr.y; PS.t = G.t; PS.gap = gR; PS.near = gR < 5;
      PS.ground = PS.pground = AS.pground = Math.min(tr.y, supportAt(tr.x + P.off, sR - gR, tr.y));
      PS.cdx = CC.pdx; PS.cdz = CC.pdz;   // поимка: где встать рядом с ней (выбор камеры поимки)
      AS.camX = PS.camX = CAM.x; AS.camZ = PS.camZ = CAM.z;   // конец забега: оба поворачиваются «в кадр»
      try { actors.hero.update(dts, AS); } catch (e) { if (!G.warnA) { G.warnA = true; console.warn('runner: actors.hero', e); } }
      try { actors.paltar.update(dts, PS); } catch (e) { if (!G.warnP) { G.warnP = true; console.warn('runner: actors.paltar', e); } }
      G.lmBias = lb;
      camUpdate(dt, xR, yR);
      if (sky) { try { sky.update(G.hour, dts, camera); } catch (e) { if (!G.warnS) { G.warnS = true; console.warn('runner: sky', e); } } }
      // HUD (объект переиспользуется; интерфейс сам решает, что перерисовать)
      if (G.mode === 'run' || G.mode === 'start' || G.mode === 'crash') {
        HUDD.score = G.score; HUDD.coins = G.coins; HUDD.dist = Math.floor(G.dist - G.s0); HUDD.mult = G.mult; HUDD.stage = G.stage;
        HUDD.power.length = 0;
        if (G.magT > 0) { HUDP[0].t = G.magT; HUDD.power.push(HUDP[0]); }
        if (G.x2T > 0) { HUDP[1].t = G.x2T; HUDD.power.push(HUDP[1]); }
        if (Hh.glide) { HUDP[2].T = CFG.glideUp + (Hh.glFly || CFG.glideT) + CFG.glideDown; HUDP[2].t = Math.max(0, HUDP[2].T - Hh.glT); HUDD.power.push(HUDP[2]); }
        try { if (ui.hud) ui.hud(HUDD); } catch (e) { if (!G.warnU) { G.warnU = true; console.warn('runner: ui.hud', e); } }
      }
    }
    const CC = { ok: false, px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 60, pdx: 0.45, pdz: 0.75 };
    // точка не внутри препятствия (с запасом) и отрезок до неё от груди героини не пересекает ни одного габарита
    function camClear(px, py, pz, tx, ty, tz) {
      if (Math.abs(px) > 4.6 || py < 0.4) return false;   // в фасадах и под мостовой — нельзя
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i], y0 = r.y0 - 0.1, y1 = (r.cls === RAMP ? 2.4 : r.y1) + 0.2, zf = -(r.s - G.s), zb = -(r.s + r.d - G.s);
        // сама точка — с запасом 0,45 м (камера не в лавке), сверху — 0,8 м (иначе жердь или ковёр соседней полосы ложились
        // прямо под объектив и перечёркивали кадр поимки), луч — 0,15 м
        if (px > r.x - r.w * 0.5 - 0.45 && px < r.x + r.w * 0.5 + 0.45 && py > y0 - 0.3 && py < y1 + 0.8 && pz > zb - 0.45 && pz < zf + 0.45) return false;
        const x0 = r.x - r.w * 0.5 - 0.15, x1 = r.x + r.w * 0.5 + 0.15, z0 = zb - 0.15, z1 = zf + 0.15;
        for (let k = 3; k <= 16; k++) {
          const t = k / 16, x = lerp(tx, px, t), y = lerp(ty, py, t), z = lerp(tz, pz, t);
          if (x > x0 && x < x1 && y > y0 && y < y1 && z > z0 && z < z1) return false;
        }
      }
      return true;
    }
    function crashCam(xR, yR, port) {
      // cs — сторона камеры (к середине улицы); пальтар на поимке встаёт ЗА героиней (+z 0,75) и чуть вбок (P.side): спереди
      // видно оба лица (он выше — голова над её плечом), сбоку они не загораживают друг друга (разнесены по глубине)
      const cs = xR > 0.5 ? -1 : xR < -0.5 ? 1 : -(P.side || 1), d = port ? 3.7 : 3.4, ty = yR + 1.1;
      // кандидаты [x, y, z, fov] — первый свободный: спереди (лица обоих; лобовой удар в прилавок или ковёр закрывает —
      // дальше) → спереди-сбоку → сбоку к середине улицы (низко и повыше — над сеном или жердью соседней полосы) → сзади
      // сверху (оба со спины) → с другой стороны → сверху
      const far = Math.min(d, 4.4 + xR * cs);   // место до края улицы с другой стороны
      // [x, y, z, fov, где встаёт пальтар: 0 — за ней (+z 0,75, вбок 0,45), 1 — рядом с ней с дальней от камеры стороны]
      // сбоку-сзади (z +1,3) — для лобового в прилавок, когда соседняя полоса тоже занята прилавком: точка позади их передних
      // стенок, луч к героине их не задевает; сзади пальтар стоял бы между камерой и героиней — поэтому он рядом
      const C = [[xR + cs * 1.4, yR + 2.1, -4.8, port ? 50 : 40, 0], [xR + cs * 3.3, yR + 2.0, -2.4, port ? 54 : 44, 0],
        [xR + cs * d, yR + 1.8, -0.5, port ? 56 : 46, 0], [xR + cs * d, yR + 2.8, -0.6, port ? 56 : 46, 0], [xR + cs * 3.5, yR + 2.2, 1.3, port ? 56 : 46, 1],
        [xR + cs * 1.4, yR + 3.9, 4.6, port ? 56 : 44, 1],
        far > 3 ? [xR - cs * far, yR + 1.8, -0.5, port ? 58 : 46, 0] : [xR, yR + 6.5, 3.2, port ? 58 : 46, 1], [xR, yR + 6.5, 3.2, port ? 58 : 46, 1]];
      // по x — не дальше 4,4 м от оси улицы (фонари на 4,72, фасады дальше)
      for (let i = 0; i < C.length; i++) C[i][0] = clamp(C[i][0], -4.4, 4.4);
      let pick = C[C.length - 1];
      for (let i = 0; i < C.length; i++) if (camClear(C[i][0], C[i][1], C[i][2], xR, ty, 0.3)) { pick = C[i]; break; }
      // куда встать пальтару (смещение от героини в мире) — актёрам через PS.cdx/cdz
      if (pick[4]) { CC.pdx = -cs * 0.95; CC.pdz = 0.1; } else { CC.pdx = 0.45 * (P.side || 1); CC.pdz = 0.75; }
      if (Math.abs(xR + CC.pdx) > 3.9) CC.pdx = -CC.pdx;   // не в тротуар
      CC.px = clamp(pick[0], -4.4, 4.4); CC.py = pick[1]; CC.pz = pick[2]; CC.tx = xR; CC.ty = ty; CC.tz = 0.3; CC.fov = pick[3]; CC.ok = true;
      // облёт — дугой вокруг героини (угол вокруг вертикали, радиус, высота), не прямой через верх: прямая из-за спины вперёд
      // проходила почти над головой (вид сверху на +0,35…+0,9 с, ориентиры терялись)
      CC.a0 = Math.atan2(CAM.x - xR, CAM.z); CC.r0 = Math.hypot(CAM.x - xR, CAM.z); CC.y0 = CAM.y;
      CC.a1 = Math.atan2(CC.px - xR, CC.pz); CC.r1 = Math.hypot(CC.px - xR, CC.pz);
      let da = CC.a1 - CC.a0; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI; CC.da = da;
      // «конец забега» (под карточкой сверху — 35 % экрана, кнопки — снизу): взгляд выше (на лица), чуть дальше и шире
      CC.ox = xR + CC.pdx * 0.45; CC.oy = yR + 1.85; CC.oz = CC.pdz * 0.45;
    }
    /* ---------- камера в стиле Subway Surfers: сзади-сверху, мягкий наклон при смене полосы, fov растёт со скоростью ---------- */
    function camUpdate(dt, xR, yR) {
      const asp = camera.aspect || 0.5, port = asp < 0.8;
      const vk = clamp((G.v - CFG.v0) / (CFG.vMax - CFG.v0), 0, 1);
      const near = clamp(1 - (P.gap - 2) / 4, 0, 1) * (G.mode === 'run' || G.mode === 'start' ? 1 : 0);
      const supY = Hh.glide ? yR : Math.min(Hh.sup, yR), airY = yR - supY;
      // забег: позиция и точка взгляда
      let px = xR * 0.72, py = (port ? 3.45 : 3.0) + supY * 0.82 + airY * 0.3 + near * 0.55 + (Hh.glide ? 1.2 : 0), pz = (port ? 5.9 : 5.3) + vk * 0.5 + near * 0.6 + (Hh.glide ? 1.4 : 0);
      CAM.lb = damp(CAM.lb, G.mode === 'run' && !Hh.glide ? G.lmBias : 0, 1.2, dt);
      px -= CAM.lb * 0.15;
      let tx = xR * 0.82 + CAM.lb * 0.9, ty = 0.75 + supY * 0.85 + airY * 0.45 + (Hh.glide ? -0.6 : 0), tz = -8.5;
      let fov = (port ? CFG.camFovP : CFG.camFovL) + vk * CFG.camFovK;
      const m = G.mode, orbit = (m === 'start' || m === 'run') && G.runT < CFG.orbitT;
      if (m === 'intro' || orbit) {
        // заставка: спереди и чуть справа — героиня лицом к нам, пальтар за плечом героини; старт — облёт за спину (1,3 с, не
        // «вжик» за 0,95): по эллипсу через +x (пальтар на это время — с другой стороны), посередине облёта камера дальше и
        // выше (R + 1,2, +1,3 м): иначе на +0,3…+0,5 с она упиралась в фасад, героиня — на пол-экрана; взгляд держится на
        // героине до 3/4 облёта и только потом уходит вперёд по улице. Облёт идёт и после старта (в беге) — по времени забега.
        // (R + 1,6 и +1,7 м вверх посередине — камера дальше ≈ 5 м, героиня не на пол-экрана)
        const k = m === 'intro' ? 0 : ease(clamp(G.runT / CFG.orbitT, 0, 1)), bow = Math.sin(k * PI);
        // кадр заставки: пара — чуть выше середины экрана (сверху — заголовок, снизу — кнопки интерфейса)
        const a0 = 0.3, ang = lerp(a0, PI, k), R = lerp(port ? 5.6 : 4.8, pz, k) + 1.6 * bow;
        const ox = Math.sin(ang) * R * 0.46, oz = -Math.cos(ang) * R;
        const h0 = port ? 1.3 : 1.25;
        px = lerp(ox, px, k * k * k); py = lerp(h0, py, k) + bow * 1.7; pz = oz;
        const kt = m === 'intro' ? 0 : sst(0.75, 1, k), kh = m === 'intro' ? 0 : sst(0, 0.35, k);
        tx = lerp(lerp(0.1, xR, kh), tx, kt); ty = lerp(lerp(port ? 0.62 : 0.85, 1.0, kh), ty, kt); tz = lerp(lerp(0.9, 0, kh), tz, kt); fov = lerp(port ? 52 : 42, fov, k);
      } else if (m === 'crash' || m === 'over') {
        // поимка: точка выбирается один раз (crashCam) — спереди, спереди-сбоку, сбоку, сзади-сверху, другая сторона, сверху;
        // первая, у которой сама точка и луч до героини не задевают препятствий. Путь — дуга вокруг героини (crashCam)
        if (!CC.ok) crashCam(xR, yR, port);
        const k = m === 'over' ? 1 : ease(clamp(G.modeT / 0.9, 0, 1)), bow = Math.sin(k * PI);
        // взгляд переводится на героиню быстрее, чем едет камера (0,3 с против 0,9): иначе ~0,4 с камера смотрела в мостовую
        const kt = m === 'over' ? 1 : ease(clamp(G.modeT / 0.3, 0, 1));
        const a = CC.a0 + CC.da * k, r = lerp(CC.r0, CC.r1, k) * (1 - 0.18 * bow);
        px = clamp(xR + Math.sin(a) * r, -4.4, 4.4); pz = Math.cos(a) * r; py = lerp(CC.y0, CC.py, k) + 0.7 * bow;
        tx = lerp(tx, CC.tx, kt); ty = lerp(ty, CC.ty, kt); tz = lerp(tz, CC.tz, kt); fov = lerp(fov, CC.fov, k);
        // конец забега: под карточкой «догнал!» (верхние 35 % экрана) — оба лица в средней трети: взгляд выше (на лица) и
        // на середину пары, камера чуть дальше; переезд мягкий, 0,7 с (в 'over' G.modeT — с нуля)
        if (m === 'over') {
          const ko = ease(clamp(G.modeT / 0.7, 0, 1)), dx = CC.px - CC.ox, dy = CC.py - CC.oy, dz = CC.pz - CC.oz;
          px = lerp(px, clamp(CC.ox + dx * 1.15, -4.4, 4.4), ko); py = lerp(py, CC.oy + dy * 1.15, ko); pz = lerp(pz, CC.oz + dz * 1.15, ko);
          tx = lerp(tx, CC.ox, ko); ty = lerp(ty, CC.oy, ko); tz = lerp(tz, CC.oz, ko); fov = lerp(fov, CC.fov + 2, ko);
        }
      }
      if (!CAM.init) { CAM.x = px; CAM.y = py; CAM.z = pz; CAM.tx = tx; CAM.ty = ty; CAM.tz = tz; CAM.fov = fov; CAM.init = true; }
      const fast = m === 'intro' || orbit ? 40 : 1, fastT = m === 'crash' || m === 'over' ? 4 : fast;
      // по x — быстрее (12): смена полосы «с места» — камера не отстаёт
      CAM.x = damp(CAM.x, px, 12 * fast, dt); CAM.y = damp(CAM.y, py, 5.5 * fast, dt); CAM.z = damp(CAM.z, pz, 4 * fast, dt);
      CAM.tx = damp(CAM.tx, tx, 10 * fastT, dt); CAM.ty = damp(CAM.ty, ty, 6 * fastT, dt); CAM.tz = damp(CAM.tz, tz, 4 * fastT, dt);
      CAM.fov = damp(CAM.fov, fov, 2.5 * fast, dt);
      CAM.roll = damp(CAM.roll, m === 'run' ? clamp(-Hh.vx * 0.0045, -0.06, 0.06) : 0, 7, dt);
      camera.position.set(CAM.x, CAM.y, CAM.z);
      camera.up.set(Math.sin(CAM.roll), Math.cos(CAM.roll), 0);
      camera.lookAt(CAM.tx, CAM.ty, CAM.tz);
      if (Math.abs(camera.fov - CAM.fov) > 0.01) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
    }

    /* =====================================================================
       АВТОПИЛОТ (?bot=1): читает препятствия из состояния и проходит; react/late — «как человек» (тесты генератора)
       Таблица по времени: 3 полосы × 72 слота по 0,05 с; 0 — свободно, 1 — проходимо действием (сено, ковёр, жердь:
       стоять можно, войти сбоку нельзя), 2 — стена, 3 — настил с крышей (только если уже на полосе до начала настила).
       Поиск пути по слотам (стоять / сменить полосу за laneT) → первая смена полосы; действие на своей полосе — по окну
       прыжка/подката (середина окна; late — как можно позже).
       ===================================================================== */
    const BS = 144, BDT = 0.025, BT = new Uint8Array(3 * BS), BC = new Float32Array(3 * BS), BP = new Int8Array(3 * BS);
    function botOn(on, opt) {
      if (!on) { G.bot = null; return; }
      G.bot = Object.assign({ react: 0, late: false, monkey: false, next: 0, wait: 0, acts: 0, lastAct: -9, busy: -9, rk: 0, plans: 0, miss: 0, log: [] }, opt || {});
    }
    function botTable() {
      BT.fill(0);
      const s = G.s, v = Math.max(1, G.v), hd = CFG.hd, hw = CFG.hw, high = Hh.y > 1.5;
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i];
        const vr = r.u > 0 && r.started ? v + r.u : v;
        const t0 = (r.s - (s + hd)) / vr, t1 = (r.s + r.d - (s - hd)) / vr;
        if (t1 < 0 || t0 > BS * BDT) continue;
        let val = r.cls === BLOCK ? 2 : r.cls === RAMP ? 3 : 1;
        if (r.cls === BLOCK && r.ramped) val = 3;
        if (high && r.top && r.y1 <= Hh.y + 0.3) val = r.ramped || r.id === 'shed' ? 3 : 1;
        if (r.u > 0 && !r.started) { /* ещё стоит: начнёт идти — время встречи по точке встречи */ const tm = (r.meet - (s + hd)) / v; const dd = r.d * v / (v + r.u); const a0 = tm, a1 = tm + (dd + 2 * hd) / v; fill(r, Math.floor(a0 / BDT), Math.ceil(a1 / BDT), val); continue; }
        fill(r, Math.floor(t0 / BDT), Math.ceil(t1 / BDT), val);
      }
      function fill(r, i0, i1, val) {
        for (let L = 0; L < 3; L++) {
          if (Math.abs(LX[L] - r.x) >= r.w * 0.5 + hw) continue;
          for (let k = Math.max(0, i0); k <= Math.min(BS - 1, i1); k++) { const j = L * BS + k, cur = BT[j]; if (cur === 2) continue; if (val === 2 || val === 1 || cur === 0) BT[j] = val; }
        }
      }
    }
    function botPlan() {
      // динамика по слотам назад: BC — стоимость дойти до конца горизонта из (полоса, слот); BP — куда (−1/0/+1)
      const lk = Math.max(1, Math.ceil(laneDur(G.v) * 1.05 / BDT));
      for (let L = 0; L < 3; L++) { BC[L * BS + BS - 1] = BT[L * BS + BS - 1] === 2 ? 1e6 : 0; BP[L * BS + BS - 1] = 0; }
      for (let k = BS - 2; k >= 0; k--) {
        for (let L = 0; L < 3; L++) {
          const j = L * BS + k; let best = 1e6, bp = 0;
          const here = BT[j], nxt = BT[j + 1];
          // остаться: нельзя в стену; в настил — только продолжая (здесь уже 3 или свободно перед его началом)
          // крайняя полоса — чуть дороже (0,002 за слот: держаться середины), но не настолько, чтобы тянуть уход от прилавка
          // до последнего (при 0,02 за слот автопилот уходил за 0,13 с до прилавка — «честно» только для робота)
          if (here !== 2 && nxt !== 2 && !(nxt === 3 && here !== 3 && here !== 0)) { const c = BC[j + 1] + (nxt === 1 && here !== 1 ? 0.35 : 0) + (L !== 1 ? 0.002 : 0); if (c < best) { best = c; bp = 0; } }
          for (let dl = -1; dl <= 1; dl += 2) {
            const L2 = L + dl; if (L2 < 0 || L2 > 2 || k + lk >= BS) continue;
            let ok = here !== 2;
            for (let q = k + 1; q <= k + lk && ok; q++) if (BT[L2 * BS + q] !== 0) ok = false;        // войти вбок — только на свободное
            for (let q = k; q <= k + (lk >> 1) && ok; q++) if (BT[L * BS + q] === 2) ok = false;    // со своей — уйти до стены
            if (!ok) continue;
            const c = BC[L2 * BS + k + lk] + 1.0 + k * 0.012;   // раньше — лучше (как человек: уйти от стены заранее, не в последний слот)
            if (c < best) { best = c; bp = dl; }
          }
          BC[j] = here === 2 && best >= 1e6 ? 1e6 : best; BP[j] = bp;
        }
      }
    }
    // ближайшее препятствие на полосе героини (для действия)
    function botNext() {
      let best = null, bs = INF;
      for (let i = 0; i < obs.length; i++) {
        const r = obs[i]; if (r.cls === BLOCK || r.cls === RAMP) continue;
        if (Math.abs(Hh.x - r.x) >= r.w * 0.5 + CFG.hw - 0.05 && Math.abs(LX[Hh.lane] - r.x) >= r.w * 0.5 + CFG.hw) continue;
        if (r.s + r.d < G.s - CFG.hd) continue;
        if (r.y1 <= Hh.sup + 0.05) continue;          // ниже опоры (на крыше) — не мешает
        if (r.s < bs) { bs = r.s; best = r; }
      }
      return best;
    }
    function botStep(dt) {
      const B = G.bot; if (G.mode !== 'run') return;
      if (B.monkey) {   // «ввод мартышки»: случайные свайпы со случайными паузами (тест на зависания, NaN, провалы)
        B.next -= dt; if (B.next <= 0) { B.next = 0.04 + G.rng() * 0.55; const r = G.rng(); input(r < 0.3 ? 'left' : r < 0.6 ? 'right' : r < 0.82 ? 'up' : 'down'); }
        return;
      }
      if (B.wait > 0) { B.wait -= dt; }
      B.t = (B.t || 0) - dt;
      if (B.t > 0) return;
      B.t = 1 / 60;
      if (Hh.glide) { botGlide(); return; }
      // «как человек»: после прыжка/подката новое решение — не раньше react после их конца; смена полосы + действие
      // сразу за ней — одна связка (как и считает генератор: запас реакции — перед решением, не между свайпами связки)
      const free = !B.react || G.t >= B.busy + B.rk;
      if (Hh.lt >= 1 && free) {
        botTable(); botPlan(); B.plans++;
        const L = Hh.lane, mv = BP[L * BS];
        if (mv !== 0) { binp(mv < 0 ? 'left' : 'right'); B.lastAct = G.t; B.busy = G.t; B.rk = 0; B.acts++; return; }
      }
      if (!free) return;
      // действие на своей полосе
      const r = botNext();
      if (B.trace) { B.log.push(G.t.toFixed(3) + ' tick L' + Hh.lane + ' lt' + Hh.lt.toFixed(2) + ' g' + (Hh.ground ? 1 : 0) + ' mv' + BP[Hh.lane * BS] + ' next ' + (r ? r.id + '@' + (r.s - G.s).toFixed(2) + ' L' + r.lane : '-')); if (B.log.length > 40) B.log.shift(); }
      if (!r) return;
      const v = Math.max(1, G.v), vr = r.u > 0 && r.started ? v + r.u : v;
      const tf = (r.s - (G.s + CFG.hd)) / vr, tb = (r.s + r.d - (G.s - CFG.hd)) / vr;
      if (tf > 1.6) return;
      const J = jumpAt(v, JJ), Ts = slideDur(v);
      let wantJ = r.cls === LOW || (r.cls === MID && !(r.y1 > 0 && nextHighSoon(r)));
      if (r.cls === MID && Hh.y > 0.3) wantJ = true;
      if (r.cls === HIGH) wantJ = false;
      if (wantJ) {
        if (!Hh.ground) return;
        const tc = riseT(J, r.y1 - Hh.y + 0.06);
        const lo = tb - (J.T - tc), hi = tf - tc;       // окно отрыва (от сейчас)
        if (hi < -0.01) { B.miss++; return; }
        const at = B.late ? hi - 0.02 : (lo + hi) / 2;
        if (at <= 0.009) { binp('up', r, tf); B.lastAct = G.t; B.busy = G.t + J.T; B.rk = B.react; B.acts++; }
      } else {
        if (Hh.slideT > 0 && Hh.slideT > tb + 0.02) return;   // подкат и так накроет
        const lo = tb - Ts, hi = tf - 0.05;
        if (!Hh.ground) { const tl = (Hh.y - Hh.sup) > 0.05 ? Math.sqrt(2 * (Hh.y - Hh.sup) / Hh.g) : 0; if (tl > hi - 0.03 && hi < 0.6) { binp('drop', r, tf); B.lastAct = G.t; B.busy = G.t + tl + Ts; B.rk = B.react; B.acts++; } return; }
        const at = B.late ? hi - 0.02 : Math.max(lo + 0.02, (lo + hi) / 2);
        if (at <= 0.009 && (Hh.slideT <= 0 || Hh.slideT < tb)) { binp('down', r, tf); B.lastAct = G.t; B.busy = G.t + Ts; B.rk = B.react; B.acts++; }
      }
    }
    // ввод автопилота + короткий журнал (последние 16 решений — для разбора аварий в тестах)
    function binp(d, r, tf) {
      // B.out — «руки» теста: автопилот только решает, а свайп/клавишу шлёт тест настоящим вводом (t_play интегратора)
      const B = G.bot; if (B && B.out) B.out(d === 'drop' ? 'down' : d); else input(d === 'drop' ? 'down' : d);
      if (!B) return;
      B.log.push(G.t.toFixed(3) + ' ' + d + ' L' + Hh.lane + ' x' + Hh.x.toFixed(2) + ' y' + Hh.y.toFixed(2) + (r ? ' ' + r.id + '@' + (r.s - G.s).toFixed(2) + ' tf' + tf.toFixed(3) : ''));
      if (B.log.length > 16) B.log.shift();
    }
    function nextHighSoon(r0) { for (let i = 0; i < obs.length; i++) { const r = obs[i]; if (r.cls === HIGH && r.lane === r0.lane && r.s > r0.s && r.s - r0.s < G.v * 1.2) return true; } return false; }
    function botGlide() {   // в полёте — к монетам
      let bl = Hh.lane, bd = INF;
      for (let i = 0; i < NC; i++) if (cSt[i] === 1 && cY[i] > 3) { const ds = cS[i] - G.s; if (ds > 2 && ds < bd) { bd = ds; bl = clamp(Math.round(cX[i] / LANE) + 1, 0, 2); } }
      if (bl >= 0 && bl !== Hh.lane && bd < G.v * 1.2) binp(bl < Hh.lane ? 'left' : 'right');
    }

    /* ---------- снимок состояния (тесты) ---------- */
    function state() {
      return { mode: G.mode, t: +G.t.toFixed(3), s: +G.s.toFixed(3), dist: Math.floor(G.dist - G.s0), v: +G.v.toFixed(3), vBase: +G.vBase.toFixed(3), stage: G.stage, theme: themes[G.theme].id,
        hour: +G.hour.toFixed(2), score: G.score, coins: G.coins, mult: G.mult, lane: Hh.lane, x: +Hh.x.toFixed(3), y: +Hh.y.toFixed(3), vy: +Hh.vy.toFixed(3), ground: Hh.ground, sup: Hh.sup,
        slide: Hh.slideT > 0, glide: !!Hh.glide, magnet: +G.magT.toFixed(2), x2: +G.x2T.toFixed(2), gap: +P.gap.toFixed(2), near: G.nearT > 0, stumbles: G.stumbles, crashBy: G.crashBy,
        caught: G.caught, record: G.record, pose: Hh.pose, ppose: P.pose, tut: G.tut ? G.tutStep : null, tutWait: G.tutWait, seed: G.seed,
        obs: obs.length, segs: segs.length, coinsLive: NC - cFree, bot: !!G.bot, botLog: G.bot ? G.bot.log.slice() : null, timeK: +G.timeK.toFixed(2) };
    }
    function near(n) {   // ближайшие препятствия (для отладки и тестов)
      const out = [];
      for (let i = 0; i < obs.length; i++) { const r = obs[i]; if (r.s + r.d > G.s - 2 && r.s - G.s < (n || 60)) out.push({ id: r.id, lane: r.lane, s: +(r.s - G.s).toFixed(2), d: r.d, u: r.u, top: r.y1 }); }
      return out.sort((a, b) => a.s - b.s);
    }
    function invariants() {   // для «мартышки»: нет NaN, не внутри опоры, не ниже земли
      const bad = [];
      const fin = [G.s, G.v, Hh.x, Hh.y, Hh.vy, P.gap, G.score];
      for (let i = 0; i < fin.length; i++) if (!isFinite(fin[i])) bad.push('nan' + i);
      if (Hh.y < -0.001) bad.push('below');
      if (G.mode === 'run' && !Hh.glide) {
        for (let i = 0; i < obs.length; i++) {
          const r = obs[i]; if (!r.top || r.hitT > 0) continue;
          if (G.s > r.s + 0.3 && G.s < r.s + r.d - 0.3 && Math.abs(Hh.x - r.x) < r.w * 0.5 - 0.3 && Hh.y < r.y1 - 0.4 && Hh.y + 0.3 > r.y0) bad.push('inside:' + r.id);
        }
      }
      return bad;
    }

    return { G, H: Hh, P, gen, obs, segs, track, coinMesh, sky, input, frame, step, reset, intro, startRun, pause, resume, finish, skipCrash, state, near, invariants, botOn, emit, EV,
      releaseAll, stageAt, setStage(n) { G.stageStart = Math.max(1, n | 0); },
      // сегмент впрок (в простое кадра): сборка сегмента набором — 7–30 мс, в простое она не съедает кадр
      prefetch() { if (G.mode === 'intro' || G.mode === 'over' || segEnd >= G.s + CFG.segAhead + CFG.segPrefetch) return false; PERF.pre++; addSegment(); return true; }, forceGlide() { if (G.mode === 'run' && !Hh.glide) startGlide(); }, planStats: () => ({ rows: gen.rows, minSlack: gen.minSlack, avgSlack: gen.rows ? gen.slackSum / gen.rows : 0, fails: gen.fails, pushes: gen.pushes }), perf: PERF,
      dispose() { releaseAll(); if (sky && sky.dispose) { try { sky.dispose(); } catch (e) { /* ok */ } } scene.remove(track); coinMesh.dispose && coinMesh.dispose(); if (coinMesh.userData.own) coinMesh.userData.own.dispose(); } };
  }

  /* =====================================================================
     СЕССИЯ: хост, сцена, модули (или заглушки), ввод, rAF, освобождение
     ===================================================================== */
  let SESSION = null;
  function open(host, dbg) {
    if (SESSION) return SESSION.ready;
    try { SESSION = createSession(host || {}, dbg || {}); } catch (e) { console.error('runner: open', e); SESSION = null; try { if (host && host.resumeWorld) host.resumeWorld(); } catch (e2) { /* ok */ } return Promise.reject(e); }
    return SESSION.ready;
  }
  function close() { if (SESSION) SESSION.close(); }

  function createSession(host, dbg) {
    const T = host.THREE || window.THREE, renderer = host.renderer;
    if (!T || !renderer) throw new Error('runner: нужен host.THREE и host.renderer');
    const quality = host.quality === 'high' ? 'high' : 'low', named = host.named !== false, season = host.season || 'autumn';
    try { if (host.pauseWorld) host.pauseWorld(); } catch (e) { console.warn('runner: pauseWorld', e); }
    const scene = new T.Scene(); scene.name = 'runner';
    const camera = new T.PerspectiveCamera(CFG.camFovP, 0.5, 0.15, 900);
    const root = host.root || document.body;
    // хост дал свой контейнер — раннер в нём; без хоста (стенд) — весь экран
    const stubs = dbg.stub === true ? { kit: true, actors: true, ui: true } : (dbg.stub || {});
    const K = V.vkit || null;
    let kit = null, actors = null, ui = null;
    const kctx = { THREE: T, K, quality, named, season, rng: K && K.rng ? K.rng : mulberry };
    if (!stubs.kit && V.runnerKit && V.runnerKit.create) { try { kit = V.runnerKit.create(kctx); } catch (e) { console.warn('runner: runnerKit.create', e); kit = null; } }
    if (!kit) kit = stubKit(kctx);
    const actx = { THREE: T, scene, quality, hero: host.hero || null, anim: host.anim || (host.hero && host.hero.rig ? host.hero.rig.anim : null), kazApi: V.kaz || null, named, kit };
    if (!stubs.actors && V.runnerActors && V.runnerActors.create) { try { actors = V.runnerActors.create(actx); } catch (e) { console.warn('runner: runnerActors.create', e); actors = null; } }
    if (!actors || !actors.hero || !actors.paltar) actors = stubActors(actx);
    let game = null, closed = false, raf = 0, last = 0, readyRes = null;
    const uctx = { root, named, haptic: k => { try { if (host.haptic) host.haptic(k); } catch (e) { /* ok */ } }, sfx: (n, d) => { try { if (host.sfx) host.sfx(n, d); } catch (e) { /* ok */ } },
      onStart: () => { if (!game) return; game.startRun(game.G.mode === 'over' ? (game.G.seed + 1) >>> 0 : undefined); },
      onExit: () => close(), onPause: () => game && game.pause(), onResume: () => game && game.resume() };
    if (!stubs.ui && V.runnerUI && V.runnerUI.create) { try { ui = V.runnerUI.create(uctx); } catch (e) { console.warn('runner: runnerUI.create', e); ui = null; } }
    if (!ui) ui = stubUI(uctx);
    // одинаковые заглушки и модули отдают одинаковые имена: модули могут падать поодиночке (тогда — заглушка только для него)
    const render = () => { if (renderer.info && renderer.info.autoReset === false) renderer.info.reset(); renderer.render(scene, camera); };
    game = createGame({ THREE: T, scene, camera, kit, actors, ui, host, named, season, quality, dbg, render: dbg.render === false ? null : render });
    const seed0 = dbg.seed != null ? (+dbg.seed >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    game.G.seed = seed0 || 1;
    if (dbg.stage) game.setStage(+dbg.stage);
    if (dbg.bot) game.botOn(true, typeof dbg.bot === 'object' ? dbg.bot : null);
    game.reset(game.G.seed, game.G.stageStart || 1);
    // прогрев (один раз, пока на экране заставка): сегменты всех тем из пула набора, по одному препятствию каждого вида и
    // усилители; renderer.compile — шейдеры сразу, иначе первая встреча с повозкой или ковром дёрнула бы кадр (замер: первая
    // сборка сегмента — до 30–40 мс, препятствия — до 13 мс; из пула — доли миллисекунды)
    const warmMs = (function warm() {
      const t0 = performance.now(), tmp = [];
      if (dbg.warm === false) return 0;
      try { if (kit.prewarm) kit.prewarm(null, 1); } catch (e) { console.warn('runner: prewarm', e); }
      const ids = Object.keys(CAT);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try { const h = kit.obstacle(id, { variant: 0, len: id === 'shed' ? 12 : undefined, dir: CAT[id].move ? 1 : 0, lane: 1, quality }); if (h && h.group) { h.group.position.set(0, -40, -30); game.track.add(h.group); tmp.push(h); } } catch (e) { /* ok */ }
      }
      for (let len = 8; len <= 16; len++) { try { const h = kit.obstacle('shed', { variant: 0, len, dir: 0, lane: 1, quality }); if (h && h.group) { h.group.position.set(0, -40, -30); game.track.add(h.group); tmp.push(h); } } catch (e) { /* ok */ } }
      for (let i = 0; i < POWERS.length; i++) { try { const h = kit.powerup(POWERS[i]); if (h && h.group) { h.group.position.set(0, -40, -30); game.track.add(h.group); tmp.push(h); } } catch (e) { /* ok */ } }
      try { if (dbg.render !== false) renderer.compile(scene, camera); } catch (e) { /* ok */ }
      for (let i = 0; i < tmp.length; i++) { try { if (tmp[i].release) tmp[i].release(); else if (tmp[i].group.parent) tmp[i].group.parent.remove(tmp[i].group); } catch (e) { /* ok */ } }
      return performance.now() - t0;
    })();

    /* ---------- размер холста ---------- */
    const sz = new T.Vector2();
    let pauseDraw = 2, half = 0;
    function fit() {   // true — размер поменялся
      const c = renderer.domElement, w = c.clientWidth || window.innerWidth || 390, h = c.clientHeight || window.innerHeight || 844;
      renderer.getSize(sz); let ch = false;
      if (Math.abs(sz.x - w) > 0.5 || Math.abs(sz.y - h) > 0.5) { renderer.setSize(w, h, false); ch = true; }
      if (Math.abs(camera.aspect - w / h) > 1e-4) { camera.aspect = w / h; camera.updateProjectionMatrix(); ch = true; }
      return ch;
    }
    /* ---------- ввод: свайпы с порогом (по движению, не по отпусканию), клавиши ---------- */
    // Свайпы — у КАЖДОГО пальца свои (до 5 касаний): лежащий на экране палец (второй большой) не глушит свайпы другого, а
    // новый свайп, начатый до того, как оторван прошлый палец, не теряется. Срабатывает по движению (не по отпусканию) —
    // отклик сразу; одно касание — одно направление один раз (длинный свайп ≠ две полосы, как в Subway Surfers).
    // Второе направление в том же касании («вправо и сразу вверх») — только нарочно: от точки поворота (где ход по первому
    // направлению был наибольшим) не меньше 2,5 порога поперёк и поперёк ≥ 2 × вдоль. Иначе дуга большого пальца (крючок
    // вбок 20 px в конце флика) давала лишнее действие: прыжок + полоса
    const SW = []; for (let i = 0; i < 5; i++) SW.push({ id: null, x: 0, y: 0, cx: 0, cy: 0, ax: 0, ay: 0, t: 0, done: 0, n: 0 });
    const DBIT = { left: 1, right: 2, up: 4, down: 8 };
    const isUI = t => !!(t && t.closest && t.closest('button, a, input, select, textarea, [data-runner-ui]'));
    const thr = () => clamp(Math.min(window.innerWidth, window.innerHeight) * 0.05, 16, 40);
    const slotOf = id => { for (let i = 0; i < SW.length; i++) if (SW[i].id === id) return SW[i]; return null; };
    const onDown = e => {
      if (isUI(e.target) || !game) return;
      // поимка: тап по сцене (после 0,8 с) — сразу карточка «догнал!» (цикл «ещё раз» короче)
      if (game.G.mode === 'crash') { game.skipCrash(); return; }
      let s = slotOf(e.pointerId);
      if (!s) { for (let i = 0; i < SW.length && !s; i++) if (SW[i].id === null) s = SW[i]; }
      if (!s) { s = SW[0]; for (let i = 1; i < SW.length; i++) if (SW[i].t < s.t) s = SW[i]; }   // все заняты — самое старое
      s.id = e.pointerId; s.x = s.cx = e.clientX; s.y = s.cy = e.clientY; s.t = performance.now(); s.done = 0; s.n = 0; s.ax = s.ay = 0;
    };
    const onMove = e => {
      if (!game) return;
      const s = slotOf(e.pointerId); if (!s) return;
      const th = thr();
      if (!s.n) {
        const dx = e.clientX - s.x, dy = e.clientY - s.y, ax = Math.abs(dx), ay = Math.abs(dy);
        if (Math.max(ax, ay) < th) return;
        const d = ax > ay ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        s.done |= DBIT[d]; s.n = 1; s.ax = ax > ay ? Math.sign(dx) : 0; s.ay = ax > ay ? 0 : Math.sign(dy); s.cx = e.clientX; s.cy = e.clientY;
        game.input(d);
        if (e.cancelable) e.preventDefault();
        return;
      }
      // точка поворота ползёт, пока палец идёт дальше по уже сработавшему направлению
      const ux = s.ax, uy = s.ay, along = (e.clientX - s.cx) * ux + (e.clientY - s.cy) * uy;
      if (along > 0) { s.cx += along * ux; s.cy += along * uy; }
      const dx = e.clientX - s.cx, dy = e.clientY - s.cy, ax = Math.abs(dx), ay = Math.abs(dy);
      const big = Math.max(ax, ay), small = Math.min(ax, ay);
      if (big < th * 2.5 || big < small * 2) return;
      const d = ax > ay ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      if (s.done & DBIT[d]) return;
      s.done |= DBIT[d]; s.n++; s.ax = ax > ay ? Math.sign(dx) : 0; s.ay = ax > ay ? 0 : Math.sign(dy); s.cx = e.clientX; s.cy = e.clientY;
      game.input(d);
      if (e.cancelable) e.preventDefault();
    };
    const onUp = e => { const s = slotOf(e.pointerId); if (s) s.id = null; };
    const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', Escape: 'pause', KeyP: 'pause' };
    const onKey = e => {
      if (!game) return;
      const d = KEYS[e.code] || (e.code === 'Enter' || e.code === 'NumpadEnter' ? 'enter' : null); if (!d) return;
      if (e.repeat) { e.preventDefault(); return; }
      if (isUI(e.target) && (e.code === 'Space' || d === 'enter')) return;
      if (game.G.mode === 'intro' && (d === 'up' || e.code === 'Enter')) { uctx.onStart(); e.preventDefault(); return; }
      // конец забега: ↑ / пробел / Enter — «Ещё раз» (как на заставке; не сразу — иначе зажатый прыжок перезапускал бы забег)
      if (game.G.mode === 'over' && (d === 'up' || e.code === 'Enter') && game.G.modeT > 0.6) { uctx.onStart(); e.preventDefault(); return; }
      if (game.G.mode === 'crash' && d !== 'pause') { game.skipCrash(); e.preventDefault(); return; }
      if (d === 'enter') return;
      game.input(d); e.preventDefault();
    };
    const onVis = () => { if (document.hidden && game) game.pause(); };
    const onBlur = () => { if (game && !game.G.bot) game.pause(); };
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur);
    const prevTouch = root.style.touchAction; root.style.touchAction = 'none';

    /* ---------- цикл ---------- */
    // заготовка сегментов впрок: в requestIdleCallback (если есть и простоя ≥ 8 мс) или сразу после дешёвого кадра (iOS без rIC)
    const hasRIC = typeof window.requestIdleCallback === 'function';
    let ric = 0;
    const idle = dl => { ric = 0; if (!closed && game && dl.timeRemaining() >= 8) game.prefetch(); };
    function loop(now) {
      if (closed) return;
      raf = requestAnimationFrame(loop);
      const dt = last ? (now - last) / 1000 : 1 / 60; last = now;
      const t0 = performance.now();
      // на паузе кадр стоит: рисуем только первый кадр после входа в паузу и после смены размера (110 тыс. треугольников
      // 60 раз в секунду под карточкой «Пауза» — батарея и нагрев телефона зря). Заставка и карточка конца — 30 к/с (через
      // кадр): там медленный облёт и позы, а логика и анимация всё равно идут каждый кадр (visuals), рывков не будет
      const sized = fit(), md = game.G.mode;
      let draw = true;
      if (md === 'pause') { draw = pauseDraw > 0 || sized; if (pauseDraw > 0) pauseDraw--; }
      else { pauseDraw = 2; if (md === 'intro' || md === 'over') { half ^= 1; draw = half === 1 || sized; } }
      game.frame(dt, draw);
      if (hasRIC) { if (!ric) ric = window.requestIdleCallback(idle, { timeout: 400 }); }
      else if (performance.now() - t0 < 6) game.prefetch();
      if (readyRes) { const r = readyRes; readyRes = null; r(api); }
    }
    /* ---------- api ---------- */
    const logic = new Float32Array(240); let li = 0, ln = 0;
    function stats() {
      const info = renderer.info || { render: {} }, ks = kit.stats ? kit.stats() : {};
      let sum = 0, mx = 0; for (let i = 0; i < ln; i++) { sum += logic[i]; if (logic[i] > mx) mx = logic[i]; }
      return { tris: info.render ? info.render.triangles : 0, calls: info.render ? info.render.calls : 0, kit: ks, geometries: info.memory ? info.memory.geometries : 0, textures: info.memory ? info.memory.textures : 0,
        logicMs: ln ? +(sum / ln).toFixed(3) : 0, logicMax: +mx.toFixed(3), lastLogic: +(game.G.lastLogic || 0).toFixed(3), plan: game.planStats(), events: Object.assign({}, game.EV),
        perf: { segMax: +game.perf.segMax.toFixed(2), segAvg: game.perf.segN ? +(game.perf.segMs / game.perf.segN).toFixed(2) : 0, obMax: +game.perf.obMax.toFixed(2), obAvg: game.perf.obN ? +(game.perf.obMs / game.perf.obN).toFixed(3) : 0, segN: game.perf.segN, segPre: game.perf.pre, obN: game.perf.obN },
        warmMs: +warmMs.toFixed(1), modules: { kit: kit.stub ? 'stub' : 'kit', actors: actors.stub ? 'stub' : 'actors', ui: ui.stub ? 'stub' : 'ui' }, obs: game.obs.length, segs: game.segs.length, frames: game.G.frames || 0 };
    }
    function sim(sec, op) {
      // промотать без rAF (виртуально, фиксированный dt): для тестов проходимости, кучи и времени логики
      op = op || {};
      const fps = op.fps || 60, dt = 1 / fps, n = Math.round(sec * fps), every = op.render ? Math.max(1, op.render | 0) : 0;
      const G = game.G, out = { frames: 0, crashes: 0, overs: 0, bad: [], maxLogic: 0, sumLogic: 0, stages: G.stage, maxStage: G.stage, restarts: 0 };
      G.sim = true; G.simSave = !!op.save;
      for (let i = 0; i < n; i++) {
        if (G.mode === 'over' || G.mode === 'intro') { if (op.restart === false) break; out.restarts++; game.startRun((G.seed + 1) >>> 0); }
        const was = G.mode;
        game.frame(dt, every > 0 && i % every === 0);   // явный bool: 0 уходил в frame как «не false» — sim рисовал каждый кадр
        const lg = G.lastLogic || 0; out.sumLogic += lg; if (lg > out.maxLogic) out.maxLogic = lg;
        logic[li] = lg; li = (li + 1) % logic.length; if (ln < logic.length) ln++;
        if (was !== 'crash' && G.mode === 'crash') { out.crashes++; if (op.onCrash) op.onCrash(game.state(), game.near(30)); if (op.stopOnCrash) { out.frames = i + 1; break; } }
        if (G.mode === 'over' && was !== 'over') out.overs++;
        if (G.stage > out.maxStage) out.maxStage = G.stage;
        if (op.check && i % 3 === 0) { const b = game.invariants(); if (b.length && out.bad.length < 20) out.bad.push({ t: +G.t.toFixed(2), b, st: game.state() }); }
        out.frames = i + 1;
      }
      G.sim = false;
      out.avgLogic = out.frames ? +(out.sumLogic / out.frames).toFixed(4) : 0; out.maxLogic = +out.maxLogic.toFixed(3); delete out.sumLogic;
      out.state = game.state(); out.plan = game.planStats(); out.events = Object.assign({}, game.EV);
      return out;
    }
    const api = {
      state: () => game.state(), near: n => game.near(n), stats, sim,
      start(seed) { game.startRun(seed != null ? seed >>> 0 : (game.G.seed + 1) >>> 0); return game.state(); },
      input(d) { game.input(d); },
      bot(on, op) { game.botOn(on !== false, op); return !!game.G.bot; },
      setStage(n) { game.setStage(n); game.startRun(game.G.seed); return game.state(); },
      pause() { game.pause(); }, resume() { game.resume(); }, close: () => close(),
      events: game.EV, game, scene, camera, kit, actors, ui,
    };
    const ready = new Promise(res => { readyRes = res; });
    if (dbg.auto) game.startRun(game.G.seed); else game.intro();
    // логика кадра — в кольцо для stats()
    const frame0 = game.frame;
    game.frame = (dt, rend) => { frame0(dt, rend); if (!game.G.sim) { logic[li] = game.G.lastLogic || 0; li = (li + 1) % logic.length; if (ln < logic.length) ln++; } };
    raf = requestAnimationFrame(loop);

    function closeSession() {
      if (closed) return; closed = true;
      cancelAnimationFrame(raf); if (ric && window.cancelIdleCallback) window.cancelIdleCallback(ric);
      window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur);
      root.style.touchAction = prevTouch;
      const result = { score: game.G.score, coins: game.G.coins, dist: Math.floor(game.G.dist - game.G.s0), best: game.G.best };
      try { if (host.music) host.music('stop', {}); } catch (e) { /* ok */ }
      try { game.dispose(); } catch (e) { console.warn('runner: dispose game', e); }
      try { actors.dispose(); } catch (e) { console.warn('runner: dispose actors', e); }
      try { ui.dispose(); } catch (e) { console.warn('runner: dispose ui', e); }
      try { kit.dispose(); } catch (e) { console.warn('runner: dispose kit', e); }
      // всё, что ещё висит в сцене (наше), — освободить; героиню актёры уже вернули хосту
      while (scene.children.length) scene.remove(scene.children[0]);
      scene.background = null; scene.fog = null;
      game = null; SESSION = null;
      try { if (host.resumeWorld) host.resumeWorld(); } catch (e) { console.warn('runner: resumeWorld', e); }
      try { if (host.onClose) host.onClose(result); } catch (e) { /* ok */ }
    }
    return { ready, close: closeSession, api };
  }

  V.runner = {
    title, available, open, close, CAT, CFG, STAGES, THEMES, LANE, version: 1,
    get session() { return SESSION ? SESSION.api : null; },
    // для набора графики и тестов: параметры прыжка/подката на скорости
    jumpAt: v => Object.assign({}, jumpAt(v, {})), slideDur, laneDur,
  };
})();
