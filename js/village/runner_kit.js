/* =====================================================================
   «БЕГ ПО КУБАЧИ» — НАБОР ГРАФИКИ РАННЕРА (роль KIT): window.VILLAGE.runnerKit
   Обычный <script>, без модулей; нужен THREE r149 и js/village/vkit.js (палитра, атлас полос, Baker, остекление, облака).
   Необязательные: js/village/markharai_sign.js (вывеска кофейни), js/village/kombinat_sign.js (панель комбината) — без них
   свои простые доски.

   Что внутри: бесконечная улица села из сегментов (каменные дома с синими галереями, плоские крыши-дворы, балконы,
   лестницы, двери, окна — тем же атласом и теми же правилами, что дома kubachi.js), мостовая, тротуары, фонари, гирлянды,
   ниже по склону — каскад крыш нижних рядов и террасы, выше — дома верхних рядов; ориентиры по темам этапов (сторожевая
   башня, художественный комбинат с панелью, школа, кофейня «МАРХАРАЙ», лавки базара, свадебные гирлянды, дом-мост);
   небо, туман и свет по часу (день → закат → ночь с огнями в окнах), панорама гор с террасами и морем облаков;
   препятствия по каталогу техзадания, монета с кубачинским узором (InstancedMesh), усилители, дешёвые частицы.

   Контракт (SPEC.md, «Контракты между частями»):
     create(ctx) → kit        ctx: { THREE, K: VILLAGE.vkit, quality: 'low'|'high', named, season: 'autumn'|'winter', rng(seed) }
     kit.LANE (2,4), kit.SEG_LENS ([40, 60]), kit.themes: [{ id, title, titleN, hour }] — порядок этапов
     kit.segment(themeId, len, rng, opts) → { group, len, release() }   группа в локальных: z 0 … −len, x поперёк, y вверх
     kit.obstacle(id, opts) → { group, release() }                       по каталогу (CAT); opts.variant, opts.len (shed), opts.dir
     kit.coins(max) → THREE.InstancedMesh                                ядро ставит матрицы (монета — диск в плоскости XY, Ø 0,5)
     kit.powerup(id) → { group, release() }                              'magnet' | 'x2' | 'glide'
     kit.sky(scene) → { update(hour, dt, camera), dispose() }            небо, туман, свет (полусфера + солнце для актёров), горы
     kit.fx: { coinBurst(pos), dust(pos) }                               дешёвые частицы (пул, Points)
     kit.stats() → { tris, calls }; kit.dispose()

   Соглашения (общие с ядром — см. scratchpad run/kit/NOTES.md):
     • Улица: полотно мостовой |x| ≤ 4,0 (три полосы x = −2,4 / 0 / +2,4), бордюр до 4,25, тротуар до 5,6 (y 0,12), фасады
       с |x| ≈ 5,6…6,2. Слева (−x) — склон вверх (ряды домов выше), справа (+x) — вниз (каскад крыш, долина). Над полотном
       до 4,6 м ничего нет; гирлянды — 5,1…5,8 м, флажки свисают до ≈ 4,7 — отдельной сеткой seg.overhead (ядро прячет эту сетку,
       пока героиня на параплане проходит их высоту), seg.garlands — их z;
       дом-мост — свод над полосами ≥ 3,4 м, в середине 4,6, верх 8,9 м (seg.over: [{ z0, z1, y0, y1 }]).
     • Препятствие: начало координат группы — середина габарита на земле (x — середина полосы, y = 0, z — середина глубины);
       «вперёд» бега — −z, движущиеся (cow, cart, barrels) смотрят мордой/дышлом на +z (к героине). shed: z ∈ [−len/2, len/2],
       крыша y 2,4; ramp: низ на z = +2, верх (2,4) на z = −2.
     • Анимация (ноги коровы и ослика, колёса, кувшин и значки усилителей, частицы, флажки на ветру) — внутри kit:
       время идёт от sky.update(hour, dt) (или kit.update(dt), если неба нет).

   Почему так (главное):
     • Свет — НЕ сцена и НЕ «запекание в вершины на сборке»: у всех материалов мира один патч (relit) — освещение полусферой и
       солнцем считается в вершинном шейдере по нормали из uniform-ов (та же формула, что relight села на q=low), а «грейд»
       ночи (насыщенность × множитель + подъём, как js/daynight.js) — во фрагментном. Сегменты из пула не перекрашиваются
       при смене часа, переход заката — только uniform-ы, 0 выделений памяти.
     • Сегмент — 3–5 сеток (обычно 4): атлас (дома, тротуары, фонари, мелочь — один материал на всё), остекление (свечение
       окон ночью — штатный glazMatV из vkit), мостовая (своя текстура), вывески (щиты лавок и ориентиров — свой атлас) и,
       если есть гирлянды, отдельная сетка над головой (ядро прячет эту сетку). 5,5–12 тыс. треугольников, ≈ 0,9 МБ геометрии.
       Пулы по ключу «тема|длина|ориентир», общий предел построенных (CAP, вытеснение — сначала «чужие» темы, из них та, что
       вернётся позже всех по кругу) — без роста памяти. Весь круг тем (≈ 60 сегментов) в предел low не влезает (≈ 2,4 МБ
       кучи на сегмент), поэтому фон достраивает тему к её возвращению — в фоне, не в кадре.
     • Постройка — генератор шагов (segSteps): segment() из пула отдаёт готовый мгновенно, а tick в фоне по ~3 мс за кадр
       достраивает «про запас» — ориентир, который скоро выпадет (решён заранее), по два сегмента каждой длины текущей
       темы и по одному — следующей (ядро идёт по темам по порядку). Синхронная постройка (8–40 мс на слабом CPU) остаётся
       только на старте забега. ctx.background === false — без фона (замеры). kit.prewarm(null, 1) — ещё и препятствия.
     • Лампы ночью — атрибут aFx.x (свечение вершины тёплым), ореолы — Points (1 вызов на сегмент, днём материал скрыт —
       0 вызовов), пятна света на мостовой — тот же атрибут у вершин мостовой (сетка 1 × 2,5 м).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- улица: поперечный профиль (м) ---------- */
  const LANE = 2.4, SEG_LENS = [40, 60];
  const ROAD = 4.0, CURB = 4.25, WALK = 5.6, WALK_Y = 0.12;   // полотно, бордюр, тротуар (верх)
  const GAR = { y0: 5.1, y1: 5.8 };                          // гирлянды над полотном (низ провиса, крепления)
  const ST = 2.4;                                            // этаж
  const LAMP_DZ = 10;                                        // фонари через 10 м, по сторонам поочерёдно (длины 40/60 делятся на 20)

  /* ---------- каталог препятствий (SPEC.md): габарит ш × в × г, м — графика не шире и не выше ---------- */
  const CAT = {
    hay: { cls: 'low', w: 1.9, h: 0.9, d: 1.0 },
    bench: { cls: 'low', w: 2.0, h: 0.75, d: 0.5 },
    baskets: { cls: 'low', w: 1.8, h: 0.7, d: 0.8 },
    barrels: { cls: 'low', moving: true, w: 1.6, h: 0.8, d: 0.8 },
    gate: { cls: 'mid', w: 2.1, y0: 0.55, y1: 1.05, h: 1.05, d: 0.3 },
    carpet: { cls: 'high', w: 2.2, y0: 1.05, y1: 2.4, h: 2.4, d: 0.3 },
    beam: { cls: 'high', w: 2.2, y0: 1.05, y1: 1.7, h: 1.7, d: 0.6 },
    stall: { cls: 'block', w: 2.1, h: 2.6, d: 2.5 },
    cow: { cls: 'block', moving: true, w: 1.0, h: 1.5, d: 2.2 },
    shed: { cls: 'block', roof: 2.4, w: 2.1, h: 2.4, d: 8, dMin: 8, dMax: 16 },
    ramp: { cls: 'ramp', w: 2.1, h: 2.4, d: 4.0 },
    cart: { cls: 'block', moving: true, w: 2.0, h: 2.2, d: 4.5 },
    // уровни 6–8 (волна 2)
    table: { cls: 'low', w: 2.0, h: 0.8, d: 0.9 },
    dancer: { cls: 'block', lateral: true, w: 0.8, h: 1.85, d: 0.6 },
    sled: { cls: 'low', lateral: true, w: 1.4, h: 0.9, d: 1.0 },
    rock: { cls: 'low', w: 1.5, h: 0.75, d: 0.9 },
    goat: { cls: 'block', moving: true, w: 0.8, h: 1.25, d: 1.3 },
    snowman: { cls: 'low', w: 1.9, h: 0.9, d: 0.9 },
    icicles: { cls: 'high', w: 2.2, y0: 1.05, y1: 1.7, h: 1.7, d: 0.6 },
  };

  /* ---------- темы уровней (порядок — уровни 1…9, дальше «Мастерский круг» по кругу с первой) ---------- */
  // hour — час для неба (sky.update), lm — ориентиры темы (какие могут встретиться), right — правая сторона: 'open' чаще
  // (вид на долину) или 'houses'; garl — доля сегментов с гирляндами (garlN — сколько их тогда минимум); trees — деревья у домов.
  // Волна 2 (уровни): kind 'road' — не улица, а горная дорога (серпантин: скала слева, обрыв и море облаков справа); snow — зима
  // своей темы (снег на крышах и уступах, белая мостовая, сугробы, снегопад — независимо от сезона игры); feast/music — свадебные
  // столы во дворах справа и музыканты на тротуаре слева; mood — настроение неба (туман, оттенок, снегопад — MOOD).
  // «Подпись» темы — чтобы уровни 1–4 (все дневные, на одной улице) различались с первого взгляда, а не только ориентиром раз в
  // 3–5 сегментов: road — своя мостовая под ногами (b — терракотовая «ёлочка» базара, s — серые плиты школьного двора с мелом,
  // k — тёмная брусчатка мастерских), walls — свой набор стен (синие и бут у мастеров, тёплые охра и штукатурка на базаре,
  // белые и голубые у школы, тёсаный камень мастерских), flags — цвета флажков, bulbs — доля гирлянд-лампочек; carpet/rugs —
  // ковры на стенах и на парапетах (базар), fence/chalk — ограда школьного двора вместо парапета и «классики» мелом на мостовой,
  // stack/copper — кирпичные трубы мастерских на крышах и медные кувшины у дверей (комбинат). Всё — в сетках сегмента (0 вызовов)
  const THEMES = [
    { id: 'masters', title: 'Улица мастеров', titleN: 'Улица мастеров', hour: 10.5, lm: ['bridge', 'tower'], lmEvery: 5, open: 0.3, garl: 0.15, shops: 0.5,
      walls: ['rubble', 'rubble', 'rubble', 'rubbleY', 'blueFull', 'blueFull', 'blueFull', 'big', 'white', 'sky'] },
    { id: 'bazaar', title: 'Базарная площадь', titleN: 'Базарная площадь', hour: 12.5, lm: ['bazaar', 'cafe', 'wedding'], lmEvery: 2, open: 0.25, garl: 0.6, shops: 0.8,
      road: 'b', walls: ['ochre', 'ochre', 'cream', 'cream', 'pink', 'rubbleY', 'rubbleY', 'lilac', 'big', 'blueFull'], flags: ['#C8372D', '#F2C94C', '#E87A2E', '#2F8F6B', '#F5F0E6', '#8E2A2A'],
      carpet: 0.75, rugs: 0.7 },
    { id: 'school', title: 'У школы', titleN: 'У школы', hour: 14.5, lm: ['school'], lmEvery: 2, open: 0.45, garl: 0.35, shops: 0.2,
      road: 's', walls: ['white', 'white', 'sky', 'sky', 'blueFull', 'cream', 'rubble', 'lilac'], flags: ['#3F78B8', '#F5F0E6', '#F2C94C', '#5FB3B3', '#E8455A'], fence: 0.8, chalk: 0.75 },
    { id: 'kombinat', title: 'Комбинат и крыши', titleN: 'Мастерские и крыши', hour: 16.5, lm: ['kombinat', 'bridge'], lmEvery: 3, open: 0.5, garl: 0.3, bulbs: 0.8, shops: 0.5,
      road: 'k', walls: ['big', 'big', 'rubble', 'rubble', 'rubbleY', 'ochre', 'rubble', 'blueFull'], stack: 0.55, copper: 0.5 },
    { id: 'tower', title: 'Вечер у башни', titleN: 'Вечер у башни', hour: 18.7, lm: ['tower', 'wedding', 'cafe'], lmEvery: 3, open: 0.6, garl: 0.5, shops: 0.3 },
    { id: 'wedding', title: 'Свадебный двор', titleN: 'Свадебный двор', hour: 16.3, lm: ['wedding', 'cafe'], lmEvery: 2, open: 0.3, garl: 1, garlN: 2, shops: 0.25, feast: 0.6, music: 0.55 },
    { id: 'serp', title: 'Серпантин над облаками', titleN: 'Серпантин над облаками', hour: 8.3, kind: 'road', lm: ['view'], lmEvery: 3, open: 1, garl: 0, shops: 0 },
    { id: 'winter', title: 'Зимние Кубачи', titleN: 'Зимняя улица', hour: 12.6, snow: true, lm: ['tower', 'bridge', 'school', 'cafe'], lmEvery: 3, open: 0.4, garl: 0.3, shops: 0.35 },
    { id: 'night', title: 'Ночь над селом', titleN: 'Ночные огни', hour: 22.3, lm: ['bridge', 'cafe', 'tower'], lmEvery: 3, open: 0.55, garl: 0.45, shops: 0.3 },
  ];
  // настроение неба по теме (sky.update(hour, dt, camera, themeId) плавно переходит к нему): fog — туман ближе/дальше, tint —
  // оттенок мира (множитель грейда), snow — снегопад (0…1), pano — «зима» на панораме гор (снег на зелёных склонах). Туман
  // серпантина плотнее, но препятствия видны ≥ 6 с на 21 м/с (до 140 м — меньше 75 % тумана)
  // Дневные уровни 1–4 — каждый своим светом: мастера — свежее утро, базар — жаркий полдень (тёплый, туман дальше), школа —
  // прохладный ясный день, мастерские — янтарная дымка горнов (туман ближе: ≥ 6 с видимости на 16 м/с сохраняется)
  const MOOD = {
    base: { fog: [60, 240], tint: [1, 1, 1], snow: 0, pano: 0 },
    masters: { fog: [58, 236], tint: [0.99, 1.0, 1.02], snow: 0, pano: 0 },
    bazaar: { fog: [72, 252], tint: [1.07, 1.0, 0.9], snow: 0, pano: 0 },
    school: { fog: [64, 244], tint: [0.94, 1.01, 1.06], snow: 0, pano: 0 },
    kombinat: { fog: [42, 210], tint: [1.08, 0.97, 0.88], snow: 0, pano: 0 },
    wedding: { fog: [60, 240], tint: [1.04, 0.99, 0.95], snow: 0, pano: 0 },
    serp: { fog: [30, 168], tint: [0.97, 0.99, 1.04], snow: 0, pano: 0 },
    winter: { fog: [46, 210], tint: [0.98, 1.0, 1.05], snow: 1, pano: 1 },
  };
  const THEME = {}; THEMES.forEach(t => { THEME[t.id] = t; });

  /* ---------- свет по часу: опорные точки (кольцо суток) ----------
     zen/hor — небо, fog — туман и фон, hs/hg/hi — полусфера (небо/земля/сила), sun/si/el/az — солнце (луна ночью):
     el — высота над горизонтом (°), az — азимут (° от −z к +x: 0 — прямо по ходу бега), mul/add/sat — грейд мира,
     glow — окна, lamps — фонари, stars — звёзды и луна, cloud — оттенок облаков [цвет, непрозрачность].
     Солнце днём — справа-сзади-сверху (фасады левой стороны и препятствия спереди освещены), к закату — низко справа
     спереди (тёплый контровой свет, небо у горизонта по ходу бега горит), ночью луна слева впереди. */
  const LK = [
    { h: 0, zen: '#0B1430', hor: '#24305C', fog: '#202B52', hs: '#6A7CC0', hg: '#2A3054', hi: 0.62, sun: '#A8B8F0', si: 0.34, el: 38, az: -40, mul: [0.6, 0.66, 0.92], add: [0.02, 0.03, 0.07], sat: 0.72, glow: 1, lamps: 1, stars: 1, cloud: ['#3A4670', 0.5] },
    { h: 5.2, zen: '#14204A', hor: '#3C4A7E', fog: '#36416E', hs: '#7484C0', hg: '#343A5C', hi: 0.6, sun: '#A8B8F0', si: 0.3, el: 30, az: -40, mul: [0.64, 0.68, 0.9], add: [0.02, 0.03, 0.07], sat: 0.74, glow: 1, lamps: 1, stars: 0.8, cloud: ['#4C5680', 0.55] },
    { h: 6.6, zen: '#5A78B8', hor: '#F4C2A4', fog: '#EEC6B4', hs: '#F0D2C8', hg: '#9A8A84', hi: 0.5, sun: '#FFC9A0', si: 0.66, el: 8, az: 110, mul: [1.0, 0.95, 0.95], add: [0.03, 0.02, 0.03], sat: 0.92, glow: 0.35, lamps: 0.4, stars: 0, cloud: ['#FFE2D6', 0.9] },
    { h: 9, zen: '#4A82C8', hor: '#B6D2EE', fog: '#D2E0EE', hs: '#D9E4F0', hg: '#8E8A80', hi: 0.44, sun: '#FFF2E2', si: 0.7, el: 34, az: 140, mul: [1, 1, 1], add: [0, 0, 0], sat: 1, glow: 0, lamps: 0, stars: 0, cloud: ['#FFFFFF', 0.95] },
    { h: 12, zen: '#3F78C2', hor: '#A6C8EA', fog: '#D6E2EE', hs: '#D6E2EE', hg: '#8C8A80', hi: 0.42, sun: '#FFF7EE', si: 0.72, el: 52, az: 150, mul: [1, 1, 1], add: [0, 0, 0], sat: 1, glow: 0, lamps: 0, stars: 0, cloud: ['#FFFFFF', 0.95] },
    { h: 16, zen: '#4A7EC4', hor: '#B2CCE8', fog: '#D8E2EC', hs: '#DCE4EE', hg: '#928A7E', hi: 0.44, sun: '#FFF0DC', si: 0.72, el: 30, az: 125, mul: [1, 1, 1], add: [0, 0, 0], sat: 1, glow: 0, lamps: 0, stars: 0, cloud: ['#FFFFFF', 0.95] },
    { h: 17.8, zen: '#6A94CC', hor: '#F0D6BE', fog: '#F3D2C0', hs: '#F5D6C2', hg: '#B99A7E', hi: 0.5, sun: '#FFCC96', si: 0.8, el: 16, az: 72, mul: [1.03, 0.96, 0.88], add: [0.03, 0.014, 0.005], sat: 0.98, glow: 0.3, lamps: 0.3, stars: 0, cloud: ['#FFE6D6', 0.9] },
    { h: 18.9, zen: '#5A6AAE', hor: '#F6A880', fog: '#EBA48C', hs: '#ECBCB0', hg: '#8A6A72', hi: 0.52, sun: '#FFB078', si: 0.7, el: 7, az: 62, mul: [0.96, 0.86, 0.84], add: [0.04, 0.025, 0.035], sat: 0.92, glow: 0.75, lamps: 1, stars: 0.15, cloud: ['#FFC2A8', 0.92] },
    { h: 19.8, zen: '#26346A', hor: '#8A6E9A', fog: '#5E5A88', hs: '#9C94C4', hg: '#463E5C', hi: 0.6, sun: '#E0A0B8', si: 0.4, el: 20, az: -30, mul: [0.74, 0.68, 0.86], add: [0.03, 0.02, 0.06], sat: 0.84, glow: 1, lamps: 1, stars: 0.6, cloud: ['#8A7AA0', 0.7] },
    { h: 21, zen: '#0D1736', hor: '#283462', fog: '#232E58', hs: '#6A7CC0', hg: '#2A3054', hi: 0.62, sun: '#A8B8F0', si: 0.34, el: 38, az: -40, mul: [0.6, 0.66, 0.92], add: [0.02, 0.03, 0.07], sat: 0.72, glow: 1, lamps: 1, stars: 1, cloud: ['#3A4670', 0.5] },
  ];

  function create(ctx) {
    ctx = ctx || {};
    const T = ctx.THREE || window.THREE, VK = ctx.K || V.vkit;
    if (!T || !VK) throw new Error('VILLAGE.runnerKit.create: нужен THREE и VILLAGE.vkit');
    const HI = ctx.quality === 'high', Q = HI ? 'high' : 'low';
    const named = ctx.named !== undefined ? !!ctx.named : V.named !== false;
    const WIN = ctx.season === 'winter';
    const RNGF = typeof ctx.rng === 'function' ? ctx.rng : VK.rng;
    const PAL = VK.PAL, S = VK.S, rgb = VK.rgb, mix = VK.mix, mul = VK.mul;
    const C = n => rgb(PAL[n] || n);
    const SNOW = rgb('#F4F7FB');
    // свой набор vkit: «запечённые» материалы (MeshBasic + цвет вершин) — свет даёт патч relit (см. шапку); high — textureGrad и анизотропия
    const K = VK.makeKit(T, { baked: true, grad: HI, aniso: HI ? 4 : 1, hi: HI, rim: ['#FFE8D0', 0.2] });
    const own = [];                                           // всё своё, что освобождает dispose()
    const keepO = x => { own.push(x); return x; };
    // геометрия сегментов живёт столько, сколько сегмент: из общего списка vkit геометрию убираем (иначе держится до dispose и не
    // освобождается при вытеснении из пула)
    const unkeep = g => { const i = K.disposables.lastIndexOf(g); if (i >= 0) K.disposables.splice(i, 1); return g; };

    /* =================================================================
       1. СВЕТ И ГРЕЙД: общие uniform-ы и патч материалов мира
       ================================================================= */
    const LU = {
      rlHs: { value: new T.Color(0.4, 0.4, 0.42) }, rlHg: { value: new T.Color(0.3, 0.3, 0.3) }, rlSun: { value: new T.Color(0.6, 0.6, 0.6) },
      rlDir: { value: new T.Vector3(0.4, 0.7, 0.5).normalize() }, rlMul: { value: new T.Color(1, 1, 1) }, rlAdd: { value: new T.Color(0, 0, 0) },
      rlP: { value: new T.Vector4(1, 0, 0, 0) },   // x — насыщенность, y — фонари (0…1), z — время (ветер), w — запас
      rlLamp: { value: new T.Color('#FFD08A') },
    };
    // relit(mat, o): освещение в вершинах (полусфера + солнце, тун-рампа как relight села), грейд и свечение ламп во фрагменте.
    // Атрибут aFx (vec2): x — свечение вершины ночью (стекло фонаря, лампочки, лайтбокс вывески), y — ветер (флажки, ковры).
    // Нет атрибута у геометрии — значения по умолчанию 0 (ничего не светит и не качается).
    // Грейд ставится сразу после <envmap_fragment>: свечение окон vkit (glazPatch дописывает его туда же, следом) — уже после
    // грейда, ночью окна не гаснут
    function relit(mat, o = {}) {
      const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey, inst = !!o.inst;
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        Object.assign(sh.uniforms, LU);
        sh.vertexShader = 'uniform vec3 rlHs;\nuniform vec3 rlHg;\nuniform vec3 rlSun;\nuniform vec3 rlDir;\nuniform vec4 rlP;\nattribute vec2 aFx;\nvarying vec3 vRl;\nvarying float vRlLamp;\n' + sh.vertexShader
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            transformed.x += sin(rlP.z * 3.1 + position.z * 1.3 + position.y * 2.1) * aFx.y * 0.07;
            transformed.z += sin(rlP.z * 2.3 + position.x * 1.7) * aFx.y * 0.05;`)
          .replace('#include <fog_vertex>', `#include <fog_vertex>
            vec3 rlN = normalize(mat3(modelMatrix) * ${inst ? 'mat3(instanceMatrix) * ' : ''}normal);
            float rlL = dot(rlN, rlDir);
            vRl = mix(rlHg, rlHs, rlN.y * 0.5 + 0.5) + rlSun * (0.39 + 0.27 * smoothstep(0.0, 0.18, rlL) + 0.34 * smoothstep(0.42, 0.72, rlL));
            vRlLamp = aFx.x;`);
        sh.fragmentShader = 'uniform vec3 rlMul;\nuniform vec3 rlAdd;\nuniform vec4 rlP;\nuniform vec3 rlLamp;\nvarying vec3 vRl;\nvarying float vRlLamp;\n' + sh.fragmentShader.replace('#include <envmap_fragment>', `#include <envmap_fragment>
          { vec3 rlB = outgoingLight, rlC = rlB * vRl; float rlG = dot(rlC, vec3(0.299, 0.587, 0.114));
            outgoingLight = mix(vec3(rlG), rlC, rlP.x) * rlMul + rlAdd + rlB * rlLamp * (vRlLamp * rlP.y); }`);
      };
      mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|rl' + (inst ? 'i' : '');
      mat.needsUpdate = true;
      return mat;
    }
    // материалы мира: атлас (вся каменная улица), двусторонний атлас (флажки, ковры, бельё), остекление (vkit, ночью теплеет)
    const matA = relit(K.atlasMat), matAD = relit(K.atlasMatD), matG = relit(K.glazMatV);
    matG.userData.rk = 'glaz';
    // мостовая: округлые камни в утоптанной земле (как roadTex села), повтор 4 м; цвет вершин — пятна и тень у бордюров
    // mode: 'c' — камни (осень), 'w' — камни под снегом (зима: сезон игры или зимняя тема уровня), 'a' — горная дорога
    // (серпантин): серый укатанный щебень с пятнами и мелкими камешками, без булыжников
    function makeRoadTex(mode) {
      const N = HI ? 512 : 256, k = N / 256, [cv, c] = K.cnv(N, N), R = VK.rng(mode === 'a' ? 2207 : 1606), W2 = mode === 'w';
      // подписи тем (уровни 2–4): мостовая из прямоугольных камней по сетке, которая укладывается в плитку N × N без шва;
      // tones — цвета камней, joint — шов, bw/bh — камень (в 1/256 плитки), herr — «ёлочка» парами (базар), run — перевязка рядов
      const setts = (joint, tones, bw, bh, herr, run) => {
        c.fillStyle = joint; c.fillRect(0, 0, N, N);
        const sp = 1.6 * k, col = () => tones[Math.floor(R() * tones.length)];
        const stone = (x, y, w, h) => { c.fillStyle = col(); c.fillRect(x + sp / 2, y + sp / 2, w - sp, h - sp); c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x + sp / 2, y + sp / 2, w - sp, (h - sp) * 0.3); c.fillStyle = 'rgba(40,30,20,0.12)'; c.fillRect(x + sp / 2, y + h - sp / 2 - (h - sp) * 0.22, w - sp, (h - sp) * 0.22); };
        if (herr) { const u = bh * k, n = Math.round(N / (2 * u));   // корзинка: пары кирпичей 2u × u, лёжа и стоя через клетку
          for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i * 2 * u, y = j * 2 * u; if ((i + j) % 2) { stone(x, y, 2 * u, u); stone(x, y + u, 2 * u, u); } else { stone(x, y, u, 2 * u); stone(x + u, y, u, 2 * u); } } }
        else { const h = bh * k, rows = Math.round(N / h), w = bw * k, cols = Math.round(N / w);
          for (let j = 0; j < rows; j++) { const off = run ? ((j % 2) * w / 2) : 0; for (let i = -1; i < cols; i++) stone(i * w + off, j * h, w, h); } }
        for (let i = 0; i < 1400; i++) { const g = 80 + R() * 120; c.fillStyle = `rgba(${g},${g * 0.95},${g * 0.88},${0.08 + R() * 0.16})`; c.fillRect(R() * N, R() * N, (0.8 + R() * 1.8) * k, (0.8 + R() * 1.6) * k); }
        const t = keepO(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = HI ? 4 : 2; return t;
      };
      if (mode === 'b') return setts('#7E5644', ['#C98E6E', '#B97C60', '#D49C7A', '#A86F57', '#C4977C', '#D8B08E', '#BF8466'], 0, 16, true);
      if (mode === 's') return setts('#8C9196', ['#BCC1C5', '#B1B6BB', '#C5C9CC', '#AAB0B6', '#B8BCC0'], 64, 64, false, false);
      if (mode === 'k') return setts('#3C3936', ['#6E6A66', '#7A746D', '#625E5A', '#837A70', '#8A6A58', '#746C64'], 21.33, 12.8, false, true);
      if (mode === 'a') {
        c.fillStyle = '#8C8880'; c.fillRect(0, 0, N, N);
        for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${96 + R() * 40},${92 + R() * 36},${84 + R() * 30},0.22)`; c.beginPath(); c.ellipse(R() * N, R() * N, (8 + R() * 30) * k, (5 + R() * 18) * k, R() * PI, 0, TAU); c.fill(); }
        for (let i = 0; i < 2600; i++) { const g = 90 + R() * 110; c.fillStyle = `rgba(${g},${g * 0.97},${g * 0.92},${0.25 + R() * 0.45})`; c.fillRect(R() * N, R() * N, (0.8 + R() * 2.2) * k, (0.8 + R() * 2) * k); }
        const t = keepO(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = HI ? 4 : 2; return t;
      }
      c.fillStyle = W2 ? '#E6EBEF' : '#B2A284'; c.fillRect(0, 0, N, N);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${110 + R() * 40},${92 + R() * 30},${64 + R() * 30},0.16)`; c.fillRect(R() * N, R() * N, (1 + R() * 4) * k, (1 + R() * 4) * k); }
      const tones = W2 ? ['#F3F5F7', '#E6EAEE', '#EEF1F4', '#DCE2E8'] : ['#CFC8B8', '#BDB6A6', '#D8D1C0', '#ABA496', '#C6B9A0', '#B4AE9F', '#C9BBA2'];
      for (let i = 0; i < 230; i++) {
        const x = R() * N, y = R() * N, rx = (5 + R() * 6) * k, ry = rx * (0.62 + R() * 0.32), a = R() * PI, col = tones[Math.floor(R() * tones.length)];
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
          const X = x + ox, Y = y + oy; if (X < -24 * k || X > N + 24 * k || Y < -24 * k || Y > N + 24 * k) continue;
          c.fillStyle = 'rgba(70,58,44,0.22)'; c.beginPath(); c.ellipse(X + 1 * k, Y + 1.6 * k, rx + 1.2 * k, ry + 1.2 * k, a, 0, TAU); c.fill();
          c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, rx, ry, a, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.ellipse(X - rx * 0.25, Y - ry * 0.3, rx * 0.5, ry * 0.4, a, 0, TAU); c.fill();
        }
      }
      const t = keepO(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = HI ? 4 : 2; return t;
    }
    const roadTex = makeRoadTex(WIN ? 'w' : 'c');
    const matRoad = keepO(relit(new T.MeshBasicMaterial({ map: roadTex, vertexColors: true })));
    // зимняя тема и серпантин — свои мостовые (та же программа шейдера, другая карта); строятся при первой нужде
    // (и мостовые-подписи уровней 2–4: b, s, k). Одна сетка на сегмент — как и было: другая карта вызовов не добавляет
    const RMAT = { c: matRoad }; if (WIN) RMAT.w = matRoad;
    const roadMat = kind => RMAT[kind] || (RMAT[kind] = keepO(relit(new T.MeshBasicMaterial({ map: makeRoadTex(kind), vertexColors: true }))));
    // все мостовые — сразу, при открытии (вместе с прочей подготовкой): рисовались на первом сегменте темы, прямо в беге, и
    // шаг фонового строителя на смене уровня доходил до 15–55 мс (зима, базар, школа)
    if (!WIN) ['b', 's', 'k', 'w', 'a'].forEach(roadMat); else roadMat('a');
    // вывески ориентиров: свой атлас (МАРХАРАЙ, панель комбината, баннер и табличка школы, щиты лавок) — один материал
    const SIGN = buildSignAtlas();
    const matSign = keepO(relit(new T.MeshBasicMaterial({ map: SIGN.tex, vertexColors: true })));
    // ореолы фонарей ночью: точки-спрайты (днём материал скрыт — 0 вызовов)
    const haloTex = (() => { const [cv, c] = K.cnv(64, 64), g = c.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.18, 'rgba(255,214,150,0.75)'); g.addColorStop(0.5, 'rgba(255,190,110,0.22)'); g.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); const t = keepO(new T.CanvasTexture(cv)); return t; })();
    const matHalo = keepO(new T.PointsMaterial({ map: haloTex, size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, fog: true, opacity: 0 }));
    matHalo.visible = false;

    // тарелка для стены лавки (атлас вывесок, круг вписан в квадрат t): 0 — белая глазурь с кобальтом и бирюзой (как старинные
    // расписные тарелки на стенах домов), 1 — бирюзовая с листьями, 2 — серебряное блюдо с чернью
    function paintPlate(c, x0, y0, t, kind) {
      const cx = x0 + t / 2, cy = y0 + t / 2, r = t / 2 - 1, P = [['#F6F2E6', '#2F57A8', '#3FA7A0'], ['#E4F1EC', '#2E8A86', '#C77D2E'], ['#DCE0E6', '#3A3F4E', '#F2F4F7']][kind];
      const circ = (rr, col, lw) => { c.beginPath(); c.arc(cx, cy, rr, 0, TAU); if (lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); } else { c.fillStyle = col; c.fill(); } };
      circ(r, P[0]); circ(r * 0.9, P[1], r * 0.1); circ(r * 0.6, P[1], r * 0.04);
      for (let i = 0; i < (kind === 2 ? 8 : 6); i++) { const a = i / (kind === 2 ? 8 : 6) * TAU; c.save(); c.translate(cx, cy); c.rotate(a);
        c.fillStyle = P[1]; c.beginPath(); c.ellipse(0, -r * 0.33, r * 0.09, r * 0.2, 0, 0, TAU); c.fill();
        c.fillStyle = P[2]; c.beginPath(); c.arc(0, -r * 0.74, r * 0.06, 0, TAU); c.fill(); c.restore(); }
      circ(r * 0.12, P[2]); circ(r * 0.99, 'rgba(58,46,63,0.35)', r * 0.03);
    }
    /* --- атлас вывесок: canvas один на набор, места — rect в долях (u0, v0, u1, v1); flipY по умолчанию --- */
    function buildSignAtlas() {
      const W = HI ? 2048 : 1024, k = W / 1024, [cv, c] = K.cnv(W, W), rect = {};
      let y = 0;
      const put = (id, src, h, x0 = 0, w = W) => { c.drawImage(src, 0, 0, src.width, src.height, x0, y, w, h); rect[id] = [x0 / W, 1 - (y + h) / W, (x0 + w) / W, 1 - y / W, w / h]; };
      c.fillStyle = '#2A2B2E'; c.fillRect(0, 0, W, W);
      // кофейня: вывеска по фото (без модуля — тёмная доска с белой надписью шрифтом игры)
      { const fn = window.markharaiSignCanvas, h = Math.round(W * 440 / 2048);
        const src = fn ? fn({ width: W, night: false, word: !!named }) : K.signCanvas(named ? 'МАРХАРАЙ' : 'КОФЕЙНЯ', { bg: '#2A2B2E', fg: '#F4F2EC', size: 120, r: 0 });
        put('cafe', src, h); y += h + 4; }
      // художественный комбинат: панель 3,2 : 1 (нейтральная сборка — без названия села, это решает сам модуль вывески)
      { const fn = window.kombinatSignCanvas, h = Math.round(W / 3.2);
        let src = null; try { if (fn) src = fn({ kind: 'facade', width: W, height: h, named: !!named }); } catch (e) { src = null; }
        if (!src) src = K.signCanvas('ХУДОЖЕСТВЕННЫЙ\nКОМБИНАТ', { bg: '#F8F6EF', fg: '#1B2A6B', border: '#24419D', size: 90 });
        put('kombinat', src, h); y += h + 4; }
      // школа: баннер над входом (как в селе) и табличка
      { const src = K.signCanvas('ДОБРО ПОЖАЛОВАТЬ В МИР ЗНАНИЙ', { bg: '#C4202F', fg: '#FFFFFF', size: 72, pad: 10, r: 4 }), h = Math.round(64 * k);
        put('banner', src, h, 0, Math.min(W, Math.round(h * src.width / src.height))); y += h + 4; }
      // щиты лавок и мастерских: по 4 в ряд, светлая доска с тёмной надписью или наоборот
      const SH = [['shopM', 'Мастерская', '#F4EEDF', '#5A4A3E'], ['shopL', 'Лавка мастера', '#3F78B8', '#FFFFFF'], ['shopF', 'Фрукты', '#F2E2B8', '#7A4A2E'], ['shopP', 'Платочки', '#E8C3CF', '#6A2E4A'],
        ['shopB', 'Хлеб', '#F4EEDF', '#8A5A3E'], ['shopK', 'Ковры', '#8E3A3A', '#F7E8C8'], ['school', 'Школа', '#8A8A86', '#F4F4F0'], ['shopS', 'Сувениры', '#2E6E6A', '#F4F0E4']];
      const sw = W / 4, sh = Math.round(sw / 3.2);
      SH.forEach(([id, text, bg, fg], i) => { if (i % 4 === 0 && i) y += sh + 4; const src = K.signCanvas(text, { bg, fg, size: 64, pad: 26, r: 12, border: fg }); put(id, src, sh, (i % 4) * sw, sw - 4); });
      y += sh + 4;
      // серпантин (волна 2, как щиты дороги к селу в игре): «Осторожно, камушки» — жёлтый треугольник, три круглых камушка с
      // глазками катятся со скалы (мило, не страшно), белая табличка; «Смотровая» — деревянная доска
      { const [pc, q] = K.cnv(380, 300), cx = 190, top = 8, base = 196, rr = (x, yy, w, h, r) => K.rrect ? K.rrect(q, x, yy, w, h, r) : (q.beginPath(), q.rect(x, yy, w, h));
        q.fillStyle = '#FFFDF9'; rr(2, 2, 376, 296, 26); q.fill();
        q.fillStyle = '#F6C445'; q.beginPath(); q.moveTo(cx, top + 14); q.lineTo(334, base); q.lineTo(46, base); q.closePath(); q.lineJoin = 'round'; q.lineWidth = 14; q.strokeStyle = '#E4A92E'; q.stroke(); q.fill();
        q.fillStyle = '#5A4A3E'; q.beginPath(); q.moveTo(cx - 70, base - 14); q.lineTo(cx - 70, top + 92); q.lineTo(cx - 30, top + 70); q.lineTo(cx - 34, base - 14); q.closePath(); q.fill();
        [[cx - 8, top + 104, 15], [cx + 30, top + 132, 19], [cx + 72, base - 26, 22]].forEach(([x, yy, r], i) => {
          q.fillStyle = ['#9C8E80', '#B3A596', '#8E8072'][i]; q.beginPath(); q.arc(x, yy, r, 0, TAU); q.fill();
          q.fillStyle = '#FFFFFF'; q.beginPath(); q.arc(x - r * 0.32, yy - r * 0.12, r * 0.24, 0, TAU); q.arc(x + r * 0.28, yy - r * 0.12, r * 0.24, 0, TAU); q.fill();
          q.fillStyle = '#3A2E3F'; q.beginPath(); q.arc(x - r * 0.28, yy - r * 0.08, r * 0.12, 0, TAU); q.arc(x + r * 0.32, yy - r * 0.08, r * 0.12, 0, TAU); q.fill(); });
        q.fillStyle = '#FFFDF9'; rr(18, 214, 344, 80, 16); q.fill(); q.strokeStyle = '#3A2E3F'; q.lineWidth = 5; rr(26, 222, 328, 64, 11); q.stroke();
        q.fillStyle = '#3A2E3F'; q.font = '800 38px Nunito, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('Осторожно, камушки', cx, 255, 300);
        const h2 = Math.round(170 * k); put('pebbles', pc, h2, 0, Math.round(h2 * 380 / 300)); }
      { const src = K.signCanvas('Смотровая', { bg: '#8A6A4E', fg: '#FFF3DC', size: 64, pad: 22, r: 14 }), h2 = Math.round(64 * k); put('view', src, h2, Math.round(230 * k), Math.min(W - Math.round(230 * k), Math.round(h2 * src.width / src.height))); }
      y += Math.round(174 * k);
      // пасхалки (роль EGGS) — свободный низ атласа (без новых материалов и вызовов: щиты сегмента уже рисуются этим атласом):
      // ряд A (y 852, 104 × 104, правее таблички камушков): резные камни — те же четыре, что в селе (vkit.carvedTex: парные
      // львы с одной головой, олень, две птицы, ветка), три тарелки (расписная кобальтом, бирюзовая, с чернью — висят в глубине
      // лавок); ряд B (y 960): указатели к лестницам между домами (названия — только в named) и табличка «10/10» — номер дома,
      // кивок названию игры
      { const R4 = (id, x0, y0, w, h) => { rect[id] = [x0 / W, 1 - (y0 + h) / W, (x0 + w) / W, 1 - y0 / W, w / h]; };
        const t = Math.round(104 * k), ya = Math.round(852 * k), xa = Math.round(232 * k), cimg = K.carvedTex && K.carvedTex.image;
        for (let i = 0; i < 4; i++) { const x0 = xa + i * (t + 4);
          if (cimg) c.drawImage(cimg, i * 128, 0, 128, 128, x0, ya, t, t); else { c.fillStyle = '#C4B596'; c.fillRect(x0, ya, t, t); }
          R4('carv' + i, x0, ya, t, t); }
        for (let i = 0; i < 3; i++) { const x0 = xa + (4 + i) * (t + 4); paintPlate(c, x0, ya, t, i); R4('plate' + i, x0, ya, t, t); }
        const yb = Math.round(960 * k), hb = Math.round(58 * k), wb = Math.round(150 * k);
        const board = (x0, w, s, bg, fg) => { c.fillStyle = bg; if (K.rrect) K.rrect(c, x0 + 1, yb + 1, w - 2, hb - 2, 10 * k); else { c.beginPath(); c.rect(x0 + 1, yb + 1, w - 2, hb - 2); } c.fill();
          c.strokeStyle = fg; c.lineWidth = 2.5 * k; if (K.rrect) K.rrect(c, x0 + 5 * k, yb + 5 * k, w - 10 * k, hb - 10 * k, 7 * k); c.stroke();
          c.fillStyle = fg; c.font = `800 ${Math.round(hb * 0.46)}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x0 + w / 2, yb + hb / 2 + 1 * k, w - 16 * k); };
        (named ? ['← Годекан', '← К роднику', '← К башне', '← Комбинат'] : ['← Площадь', '← К роднику', '← К башне', '← Мастерские'])
          .forEach((s, i) => { const x0 = i * (wb + 4); board(x0, wb, s, '#8A6A4E', '#FFF3DC'); R4('post' + i, x0, yb, wb, hb); });
        { const x0 = 4 * (wb + 4), w0 = Math.round(92 * k); board(x0, w0, '10/10', '#3F78B8', '#FFFFFF'); R4('num', x0, yb, w0, hb); } }
      const tex = keepO(new T.CanvasTexture(cv)); tex.anisotropy = HI ? 4 : 2;
      return { tex, rect, cv };
    }

    /* =================================================================
       2. ПОМОЩНИКИ ГЕОМЕТРИИ (поверх Baker/Frame из vkit)
       ================================================================= */
    const qv = (bk, F, pts, col, s) => bk.quad(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), F.p(...pts[3]), col, s);
    const vgrad = (c, y0, y1, k0 = 0.8) => p => mul(c, lerp(k0, 1, clamp((p[1] - y0) / (y1 - y0), 0, 1)));
    // брус между двумя точками (перила, столбы, провода) — 4 грани, без торцов; a, b — в координатах Baker
    const _d = new T.Vector3(), _u = new T.Vector3(), _s1 = new T.Vector3(), _s2 = new T.Vector3();
    function bar(bk, A, B, t, col, s = S.FLAT) {
      _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (_d.lengthSq() < 1e-10) return; _d.normalize(); _u.set(Math.abs(_d.y) > 0.95 ? 1 : 0, Math.abs(_d.y) > 0.95 ? 0 : 1, 0);
      _s1.crossVectors(_d, _u).normalize().multiplyScalar(t / 2); _s2.crossVectors(_s1, _d).normalize().multiplyScalar(t / 2);
      const c = (v, k1, k2) => [v[0] + _s1.x * k1 + _s2.x * k2, v[1] + _s1.y * k1 + _s2.y * k2, v[2] + _s1.z * k1 + _s2.z * k2];
      const Q = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      for (let i = 0; i < 4; i++) { const [p1, p2] = Q[i], [q1, q2] = Q[(i + 1) % 4]; bk.quad(c(A, p1, p2), c(A, q1, q2), c(B, q1, q2), c(B, p1, p2), col, s); }
    }
    const barF = (bk, F, a, b, t, col) => bar(bk, F.p(...a), F.p(...b), t, col);
    // квад в рамке F лицом к локальному направлению d [x, y, z]; треугольник лицом к мировому dir
    const qvd = (bk, F, pts, col, s, d) => { const w = F.dir(d[0], d[2]); bk.quadF(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), F.p(...pts[3]), col, s, [w[0], d[1], w[1]]); };
    const trd = (bk, a, b, c, col, s, dir) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) bk.tri(a, c, b, col, s); else bk.tri(a, b, c, col, s); };
    // диапазоны вершин со свечением/ветром: bk.fxR = [[от, до, свет, ветер]]
    const fxMark = (bk, n0, lamp, wave) => { if (bk.n > n0) (bk.fxR = bk.fxR || []).push([n0, bk.n, lamp || 0, wave || 0]); };
    // атрибут aFx геометрии: диапазоны + функция пятен света (мостовая)
    function addFx(g, ranges, lampFn) {
      if (!ranges && !lampFn) return;
      const n = g.attributes.position.count, a = new Float32Array(n * 2), P = g.attributes.position.array;
      if (lampFn) for (let i = 0; i < n; i++) a[i * 2] = lampFn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      (ranges || []).forEach(([i0, i1, l, w]) => { for (let i = i0; i < i1 && i < n; i++) { a[i * 2] = Math.max(a[i * 2], l); a[i * 2 + 1] = w; } });
      g.setAttribute('aFx', new T.BufferAttribute(a, 2));
    }
    // зима: верхние грани — снег (вершинным цветом), как snowify села; bk.noSnow — диапазоны, окрашенные заранее
    // on — снег своей темы (зимний уровень); amt — сила (препятствиям меньше: белая крыша сарая на белой мостовой — «дыра»)
    const snowify = (bk, on, amt) => { if (!WIN && !on) return; const A = amt || 0.9; for (let i = 0; i < bk.n; i++) { const ny = bk.N[i * 3 + 1]; if (ny > 0.42) { const k = A * sst(0.42, 0.7, ny); for (let q = 0; q < 3; q++) bk.C[i * 3 + q] = lerp(bk.C[i * 3 + q], SNOW[q] * 1.08, k); } } };
    function meshOf(bk, mat, o = {}) {
      if (!bk || !bk.n) return null;
      snowify(bk, o.snow);
      const g = bk.build(); if (!g) return null; unkeep(g); addFx(g, bk.fxR, o.lampFn);
      const m = new T.Mesh(g, mat); m.matrixAutoUpdate = false; m.updateMatrix(); m.castShadow = m.receiveShadow = false; if (o.name) m.name = o.name; return m;
    }
    const planeG = keepO(new T.PlaneGeometry(1, 1));
    function glazOf(list, name) {
      if (!list.length) return null;
      const m = K.merged(planeG, matG, list, { tiles: true }); unkeep(m.geometry); m.matrixAutoUpdate = false; m.updateMatrix(); m.castShadow = m.receiveShadow = false; m.name = name || 'glazing'; return m;
    }

    /* =================================================================
       3. ДОМА (по правилам houseGeo/roofGeo/galleryGeo села, без коллайдеров и ходьбы)
       ================================================================= */
    function wallLook(kind, R) {
      const j = 0.93 + R() * 0.12, w = (R() - 0.5) * 0.07;
      switch (kind) {
        case 'rubbleY': return { s: S.RUBBLE, c: [1.04 * j, 1.01 * j, 0.93 * j] };
        case 'ochre': return { s: S.ASHLAR, c: [j * 0.98, j * 0.95, j * 0.9] };
        case 'cream': return { s: S.PLASTER, c: mul(C('cream'), 0.97 + R() * 0.05) };
        case 'white': return { s: S.PLASTER, c: mul(C('white'), 0.97 + R() * 0.04) };
        case 'pink': return { s: S.PLASTER, c: C('pink') };
        case 'lilac': return { s: S.PLASTER, c: C('lilac') };
        case 'sky': return { s: S.PLASTER, c: C('skyWall') };
        case 'blueFull': return { s: S.WASH, c: C('blue'), side: { s: S.RUBBLE, c: [j, j, j] } };
        case 'big': return { s: S.BIG, c: [j, j * 0.98, j * 0.94] };
        default: return { s: S.RUBBLE, c: [j * (1 + w), j, j * (1 - w)] };
      }
    }
    // стены: как в селе — бут чаще всего, потом синие, охра, светлые штукатурки
    const WALLS = ['rubble', 'rubble', 'rubble', 'rubble', 'rubbleY', 'big', 'ochre', 'blueFull', 'blueFull', 'cream', 'white', 'pink', 'sky', 'lilac'];
    const ROOFM = ['silver', 'silver', 'silver', 'silverRust', 'rust', 'slate', 'red'];
    const FRAMES = ['frameWhite', 'frameWhite', 'frameBlue', 'frameBlue', 'frameTurq', 'frameGreyblue'];
    function glass(gz, F, x, y, z, w, h, tile, col, glow, ry) { gz.push({ p: F.p(x, y, z), r: [0, F.ry + (ry || 0), 0], s: [w, h, 1], tile, c: col, glow }); }

    // крыша: плоская (двор с парапетом), вальма, односкатная, двускатная — высота конька над стеной
    function roofGeo(bk, F, h, W, D, H, R, o = {}) {
      const mat = h.roofMat;
      const rc = mat === 'rust' ? mul(mix(C('rust'), C('brown'), R()), 1.07) : mat === 'slate' ? mix(C('slate'), C('silver'), 0.3) : mat === 'red' ? mul(R() < 0.5 ? C('red') : C('bordo'), 1.07) : mul(C(['silver', 'silver2', 'silver3', 'silverOld', 'silver2'][Math.floor(R() * 5)]), 0.95 + R() * 0.06);
      if (h.roof === 'flat') {
        const yc = H + 0.1;
        qv(bk, F, [[-W / 2, yc, D / 2], [W / 2, yc, D / 2], [W / 2, yc, -D / 2], [-W / 2, yc, -D / 2]], mul(C('yard'), 0.95 + R() * 0.08), S.SLAB);
        const pc = { s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.12) } };
        bk.box(F, 0, yc + 0.22, D / 2 - 0.15, W, 0.44, 0.3, Object.assign({ col: [0.98, 0.98, 0.98], skip: { ny: 1 } }, pc));
        if (o.sideL) bk.box(F, -W / 2 + 0.15, yc + 0.2, 0, 0.3, 0.4, D - 0.6, Object.assign({ col: [0.98, 0.98, 0.98], skip: { ny: 1 } }, pc));
        if (o.sideR) bk.box(F, W / 2 - 0.15, yc + 0.2, 0, 0.3, 0.4, D - 0.6, Object.assign({ col: [0.98, 0.98, 0.98], skip: { ny: 1 } }, pc));
        if (o.back) bk.box(F, 0, yc + 0.2, -D / 2 + 0.15, W, 0.4, 0.3, Object.assign({ col: [0.98, 0.98, 0.98], skip: { ny: 1 } }, pc));
        // на крыше-дворе: изредка бельё на верёвке, ящики, скамья — жизнь (видно с дороги сверху вниз у нижних рядов)
        if (o.yardLife && R() < 0.5) { const x0 = -W / 2 + 0.6, x1 = W / 2 - 0.6, z = (R() - 0.5) * D * 0.4;
          [x0, x1].forEach(x => bk.box(F, x, yc + 0.6, z, 0.05, 1.2, 0.05, { col: C('woodD') }));
          const n0 = bk.n, cols = ['#F4F1EA', '#E8455A', '#5FB3B3', '#F2C94C', '#C9DCEF'];
          for (let x = x0 + 0.3; x < x1 - 0.3; x += 0.55) { const c = rgb(cols[Math.floor(R() * cols.length)]); qv(bk, F, [[x, yc + 0.6, z], [x + 0.42, yc + 0.6, z], [x + 0.42, yc + 1.15, z], [x, yc + 1.15, z]], c, S.FLAT); qv(bk, F, [[x + 0.42, yc + 0.6, z], [x, yc + 0.6, z], [x, yc + 1.15, z], [x + 0.42, yc + 1.15, z]], c, S.FLAT); }
          fxMark(bk, n0, 0, 0.6); }
        return 0.55;
      }
      const of = 0.45, os = 0.25, ob = o.crest ? 0.25 : 0.04;
      const xa = -W / 2 - os, xb = W / 2 + os, za = -D / 2 - ob, zb = D / 2 + of, y0 = H + 0.08;
      const Wr = xb - xa, Dr = zb - za, zc = (za + zb) / 2;
      const under = mul(rc, 0.55), fasc = mul(rc, 0.72);
      qv(bk, F, [[xa, H + 0.01, za], [xb, H + 0.01, za], [xb, H + 0.01, zb], [xa, H + 0.01, zb]], under, S.FLAT);
      const ruv = (pts, ex, ez) => pts.map(p => { const w = F.p(...p), e = F.dir(ex, ez); return [(w[0] * e[0] + w[2] * e[1]) / 2.0, (w[0] * -e[1] + w[2] * e[0]) / 0.5 + w[1] * 1.5]; });
      const rq = (pts, ex, ez, col) => bk.quad(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), F.p(...pts[3]), col || rc, S.ROOF, ruv(pts, ex, ez));
      const rt = (pts, ex, ez, col) => bk.tri(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), col || rc, S.ROOF, ruv(pts, ex, ez).slice(0, 3));
      [[[xa, H + 0.01, zb], [xb, H + 0.01, zb], [xb, y0, zb], [xa, y0, zb]], [[xb, H + 0.01, za], [xa, H + 0.01, za], [xa, y0, za], [xb, y0, za]],
        [[xb, H + 0.01, zb], [xb, H + 0.01, za], [xb, y0, za], [xb, y0, zb]], [[xa, H + 0.01, za], [xa, H + 0.01, zb], [xa, y0, zb], [xa, y0, za]]].forEach(pp => qv(bk, F, pp, fasc, S.FLAT));
      let rh = 0; const plates = [];
      if (h.roof === 'hip') {
        rh = 0.18 * Math.min(Wr, Dr) / 2;
        if (Wr >= Dr) { const rx = (Wr - Dr) / 2, yr = y0 + rh;
          rq([[xa, y0, zb], [xb, y0, zb], [rx, yr, zc], [-rx, yr, zc]], 1, 0); rq([[xb, y0, za], [xa, y0, za], [-rx, yr, zc], [rx, yr, zc]], -1, 0);
          rt([[xb, y0, zb], [xb, y0, za], [rx, yr, zc]], 0, -1, mul(rc, 0.97)); rt([[xa, y0, za], [xa, y0, zb], [-rx, yr, zc]], 0, 1, mul(rc, 0.97));
          plates.push({ a: [xa, y0, zb], b: [xb, y0, zb], top: [0, yr, zc] });
        } else { const rz = (Dr - Wr) / 2, yr = y0 + rh;
          rq([[xb, y0, zb], [xb, y0, za], [0, yr, zc - rz], [0, yr, zc + rz]], 0, -1); rq([[xa, y0, za], [xa, y0, zb], [0, yr, zc + rz], [0, yr, zc - rz]], 0, 1);
          rt([[xa, y0, zb], [xb, y0, zb], [0, yr, zc + rz]], 1, 0, mul(rc, 0.97)); rt([[xb, y0, za], [xa, y0, za], [0, yr, zc - rz]], -1, 0, mul(rc, 0.97));
          plates.push({ a: [xb, y0, zb], b: [xb, y0, za], top: [0, yr, zc] }); }
      } else if (h.roof === 'gable') {
        rh = 0.2 * Dr / 2; const yr = y0 + rh;
        rq([[xa, y0, zb], [xb, y0, zb], [xb, yr, zc], [xa, yr, zc]], 1, 0); rq([[xb, y0, za], [xa, y0, za], [xa, yr, zc], [xb, yr, zc]], -1, 0);
        const wl = o.wall; [-1, 1].forEach(sd => { const x = sd * W / 2; const pts = sd > 0 ? [[x, H, zb - of], [x, H, za + ob], [x, yr - 0.05, zc]] : [[x, H, za + ob], [x, H, zb - of], [x, yr - 0.05, zc]]; bk.tri(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), wl.c, wl.s); });
        plates.push({ a: [xa, y0, zb], b: [xb, y0, zb], top: [0, yr, zc] });
      } else { // односкатная: падает к фасаду
        rh = 0.62; const yb = y0 + rh;
        rq([[xa, y0, zb], [xb, y0, zb], [xb, yb, za], [xa, yb, za]], 1, 0);
        qv(bk, F, [[xb, y0, za], [xa, y0, za], [xa, yb, za], [xb, yb, za]], fasc, S.FLAT);
        const wl = o.wall; [-1, 1].forEach(sd => { const x = sd * (W / 2); const pts = sd > 0 ? [[x, H, D / 2], [x, H, -D / 2], [x, yb - 0.04, -D / 2]] : [[x, H, -D / 2], [x, H, D / 2], [x, yb - 0.04, -D / 2]]; bk.tri(F.p(...pts[0]), F.p(...pts[1]), F.p(...pts[2]), wl.c, wl.s); });
        plates.push({ a: [xa, y0, zb], b: [xb, y0, zb], top: [0, yb, za] });
      }
      // ржавые полосы по стыкам листов (p5: «лоскутное море крыш») — тонкими квадами прямо в атлас (high и ближние ряды)
      if (o.rust !== false && (mat === 'silverRust' || (mat === 'silver' && R() < 0.6))) plates.forEach(pl => {
        const A = F.p(...pl.a), Bp = F.p(...pl.b), Tp = F.p(...pl.top);
        const e = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], len = Math.hypot(...e); e[0] /= len; e[1] /= len; e[2] /= len;
        const mid = [(A[0] + Bp[0]) / 2, A[1], (A[2] + Bp[2]) / 2], up = [Tp[0] - mid[0], Tp[1] - mid[1], Tp[2] - mid[2]], ul = Math.hypot(...up); up[0] /= ul; up[1] /= ul; up[2] /= ul;
        const at = (a, b) => [mid[0] + e[0] * a + up[0] * b, mid[1] + e[1] * a + up[1] * b + 0.025, mid[2] + e[2] * a + up[2] * b];
        const n = mat === 'silverRust' ? 3 : 1 + Math.floor(R() * 2);
        for (let i = 0; i < n; i++) { const a0 = (R() - 0.5) * (len - 1.4), w = 0.55 + R() * 0.7, b0 = ul * (0.15 + R() * 0.3), b1 = Math.min(ul * 0.95, b0 + 1 + R() * 1.4), cc = mul(mix(C('rust'), C('rustStripe'), R() * 0.7), 0.92 + R() * 0.12);
          bk.quad(at(a0, b0), at(a0 + w, b0), at(a0 + w, b1), at(a0, b1), cc, S.ROOF); }
      });
      return rh;
    }

    // галерея (G1 — мелкая расстекловка, G2 — высокие створки): фартук, рама, кронштейны — в атлас, стёкла — в остекление
    function galleryGeo(bk, gz, F, h, W, D, s, R, wl) {
      const g = h.gallery, G1 = g.g1 !== undefined ? g.g1 : R() < 0.6, bw = G1 ? 0.9 : 0.75;
      let n = G1 ? (g.bays || Math.floor((W - 0.6) / 0.9)) : Math.floor((W - 0.6) / 0.75); n = Math.max(2, Math.min(n, Math.floor((W - 0.3) / bw)));
      const gw = n * bw, x0 = -gw / 2, yb = s * ST + 0.12, ap = G1 ? 0.75 : 0.7, gh = G1 ? 1.35 : 1.5, top = yb + ap + gh;
      const p = g.proj || 0, zf = D / 2 + (p > 0 ? p : 0.035), fc = C(g.frame || 'frameWhite');
      const apronLook = h.blue || h.wall === 'blueFull' ? { s: S.WASH, c: C('blue') } : R() < 0.55 ? { s: S.FLAT, c: mul(fc, 0.9) } : R() < 0.6 ? { s: S.PLASTER, c: C('cream') } : { s: S.WASH, c: C('blueHi') };
      qv(bk, F, [[x0, yb, zf], [x0 + gw, yb, zf], [x0 + gw, yb + ap, zf], [x0, yb + ap, zf]], apronLook.c, apronLook.s);
      qv(bk, F, [[x0 - 0.04, top, zf + 0.01], [x0 + gw + 0.04, top, zf + 0.01], [x0 + gw + 0.04, top + 0.12, zf + 0.01], [x0 - 0.04, top + 0.12, zf + 0.01]], mul(fc, 0.95), S.FLAT);
      qv(bk, F, [[x0 - 0.04, yb + ap - 0.05, zf + 0.012], [x0 + gw + 0.04, yb + ap - 0.05, zf + 0.012], [x0 + gw + 0.04, yb + ap + 0.02, zf + 0.012], [x0 - 0.04, yb + ap + 0.02, zf + 0.012]], fc, S.FLAT);
      const glow = R() < 0.55 ? 1 : 0;
      for (let i = 0; i < n; i++) glass(gz, F, x0 + (i + 0.5) * bw, yb + ap + gh / 2, zf + 0.008, bw, gh, G1 ? 2 : 3, fc, glow * (R() < 0.8 ? 1 : 0));
      if (p > 0) {
        [-1, 1].forEach(sd => {
          const x = sd > 0 ? x0 + gw : x0, zs = D / 2;
          qv(bk, F, sd > 0 ? [[x, yb, zf], [x, yb, zs], [x, top + 0.12, zs], [x, top + 0.12, zf]] : [[x, yb, zs], [x, yb, zf], [x, top + 0.12, zf], [x, top + 0.12, zs]], mul(fc, 0.86), S.FLAT);
          glass(gz, F, x + sd * 0.008, yb + ap + gh / 2, zs + p / 2, p, gh, G1 ? 2 : 3, fc, 0, sd * PI / 2);
        });
        qv(bk, F, [[x0, yb, D / 2], [x0 + gw, yb, D / 2], [x0 + gw, yb, zf], [x0, yb, zf]], mul(fc, 0.6), S.FLAT);
        qv(bk, F, [[x0 - 0.05, yb - 0.02, zf + 0.12], [x0 + gw + 0.05, yb - 0.02, zf + 0.12], [x0 + gw + 0.05, yb + 0.06, zf], [x0 - 0.05, yb + 0.06, zf]], C('silver2'), S.FLAT);
        [x0 + 0.25, 0, x0 + gw - 0.25].forEach(bx => bk.box(F, bx, yb - 0.18, D / 2 + p / 2, 0.11, 0.11, p, { col: C('bracket'), s: S.FLAT, skip: { nz: 1 } }));
        if (s < h.storeys - 1) qv(bk, F, [[x0 - 0.06, top + 0.12, zf + 0.06], [x0 + gw + 0.06, top + 0.12, zf + 0.06], [x0 + gw + 0.06, top + 0.3, D / 2], [x0 - 0.06, top + 0.3, D / 2]], C('silver'), S.ROOF);
      }
    }

    // синяя каменная лестница вдоль фасада на 2-й этаж: подступёнки синие, середина проступи — голый камень (p2)
    function blueStair(bk, F, h, W, D, o = {}) {
      const x0 = o.x0 !== undefined ? o.x0 : -W / 2 + 0.3, x1 = o.x1 !== undefined ? o.x1 : W / 2 - 1.5, rise = o.rise || ST, n = Math.round(rise / 0.2), run = (x1 - x0) / n, z0 = D / 2, z1 = D / 2 + (o.w || 0.95);
      const blue = C('blue'), tread = C('tread');
      for (let i = 0; i < n; i++) {
        const xa = x0 + i * run, xb = xa + run, y = (i + 1) * 0.2;
        qv(bk, F, [[xa, y - 0.2, z0], [xa, y - 0.2, z1], [xa, y, z1], [xa, y, z0]], blue, S.WASH);
        qv(bk, F, [[xa, y, z1], [xb, y, z1], [xb, y, z0], [xa, y, z0]], tread, S.SLAB);
        qv(bk, F, [[xa, y + 0.004, z1], [xb, y + 0.004, z1], [xb, y + 0.004, z1 - 0.16], [xa, y + 0.004, z1 - 0.16]], mul(blue, 1.05), S.WASH);
        qv(bk, F, [[xa, 0, z1], [xb, 0, z1], [xb, y, z1], [xa, y, z1]], blue, S.WASH);   // щека ступенями
      }
      const xl = Math.min(W / 2 - 0.2, x1 + 1.2);
      bk.box(F, (x1 + xl) / 2, rise / 2, (z0 + z1) / 2, xl - x1, rise, z1 - z0, { col: blue, s: S.WASH, cols: { py: tread }, ss: { py: S.SLAB }, skip: { nz: 1, ny: 1 } });
      const railC = C('rail'), zr = z1 - 0.06;
      barF(bk, F, [x0, 1.1, zr], [x1, rise + 0.9, zr], 0.045, railC);
      if (HI) for (let i = 0; i <= n; i += 3) { const x = x0 + i * run; barF(bk, F, [x, i * 0.2 + 0.2, zr], [x, i * 0.2 + 1.1, zr], 0.03, railC); }
    }

    // фонарь на стене (как wallLantern села): кронштейн, корпус, стекло со свечением, шапочка; halo — точка ореола
    function wallLantern(bk, F, x, y, z, halos) {
      const met = rgb('#3A3A40'), q = F.p(x, y, z);
      bk.box(F, x, y + 0.32, z - 0.2, 0.05, 0.05, 0.4, { col: met });
      bk.box(F, x, y + 0.27, z, 0.26, 0.04, 0.26, { col: met }); bk.cyl(q[0], q[1] + 0.29, q[2], 0.16, 0.02, 0.14, { seg: 5, col: met });
      bk.box(F, x, y - 0.2, z, 0.2, 0.05, 0.2, { col: met });
      const n0 = bk.n; bk.box(F, x, y + 0.03, z, 0.2, 0.42, 0.2, { col: rgb('#FFE6B0'), skip: { ny: 1, py: 1 } }); fxMark(bk, n0, 1, 0);
      if (halos) halos.push(q[0], q[1] + 0.03, q[2], 1);
    }

    // дом целиком. h: { x, y0, z, ry, w, d, h, storeys, wall, roof, roofMat, gallery?, blueBand, blue, stair, lod, foot, nbL, nbR,
    //   shop ('M'…'S' — щит), lantern, side (−1 слева / +1 справа), yardLife }; gz — список стёкол; halos — точки ореолов
    function houseGeo(bk, gz, h, R, halos) {
      const F = new K.Frame(h.x, h.y0, h.z, h.ry), W = h.w, D = h.d, H = h.h, lod = !!h.lod;
      const wl = wallLook(h.wall, R), side = wl.side || wl;
      const foot = h.foot !== undefined ? h.foot : 0.6, ao = 0.9;
      // фасад (+z): низ темнее (мягкая «тень у земли»)
      qv(bk, F, [[-W / 2, -foot, D / 2], [W / 2, -foot, D / 2], [W / 2, ao, D / 2], [-W / 2, ao, D / 2]], p => mul(wl.c, p[1] > h.y0 + 0.1 ? 1 : 0.8), wl.s);
      qv(bk, F, [[-W / 2, ao, D / 2], [W / 2, ao, D / 2], [W / 2, H, D / 2], [-W / 2, H, D / 2]], wl.c, wl.s);
      const sc = side.c;
      // бока: открытый бок — целиком, у соседа — только выше его крыши (меньше треугольников и перерисовки)
      const sideFrom = (nb) => (nb > -50 ? clamp(nb - h.y0 - 0.2, -foot, H) : -foot);
      { const yL = sideFrom(h.nbR); if (H > yL + 0.05) qv(bk, F, [[W / 2, yL, D / 2], [W / 2, yL, -D / 2], [W / 2, H, -D / 2], [W / 2, H, D / 2]], vgrad(mul(sc, 0.97), h.y0 - 0.2, h.y0 + 1.2, 0.78), side.s); }
      { const yL = sideFrom(h.nbL); if (H > yL + 0.05) qv(bk, F, [[-W / 2, yL, -D / 2], [-W / 2, yL, D / 2], [-W / 2, H, D / 2], [-W / 2, H, -D / 2]], vgrad(mul(sc, 0.97), h.y0 - 0.2, h.y0 + 1.2, 0.78), side.s); }
      // зад — одной гранью (с дороги не виден; нужен для вида назад на заставке и для нижних рядов, что смотрят в долину)
      if (h.back !== false) qv(bk, F, [[W / 2, -foot, -D / 2], [-W / 2, -foot, -D / 2], [-W / 2, H, -D / 2], [W / 2, H, -D / 2]], mul(side.c, 0.93), side.s);
      // замковые углы у бута
      if (!lod && side.s === S.RUBBLE && R() < 0.3) [-1, 1].forEach(sd => { for (let y = 0.1; y < H - 0.3; y += 0.5) { const w = (Math.floor(y / 0.5) & 1) ? 0.32 : 0.48; const x = sd * W / 2;
        qv(bk, F, sd > 0 ? [[x - w, y, D / 2 + 0.006], [x, y, D / 2 + 0.006], [x, y + 0.26, D / 2 + 0.006], [x - w, y + 0.26, D / 2 + 0.006]] : [[x, y, D / 2 + 0.006], [x + w, y, D / 2 + 0.006], [x + w, y + 0.26, D / 2 + 0.006], [x, y + 0.26, D / 2 + 0.006]], C('ochre2'), S.ASHLAR); } });
      if (h.blueBand && h.wall !== 'blueFull') qv(bk, F, [[-W / 2, -0.05, D / 2 + 0.012], [W / 2, -0.05, D / 2 + 0.012], [W / 2, 1.0, D / 2 + 0.012], [-W / 2, 1.0, D / 2 + 0.012]], C('blue'), S.WASH);
      // этажи: галереи / окна (ночью горит примерно каждое третье окно)
      const gs = h.gallery ? h.gallery.storeys : [], fWin = R() < 0.2 ? C('frameBlue') : C('frameWhite'), gl = h.glow !== undefined ? h.glow : 0.4;
      for (let s = 0; s < h.storeys; s++) {
        const yb = s * ST;
        if (gs.includes(s)) { galleryGeo(bk, gz, F, h, W, D, s, R, wl); continue; }
        if (s === 0 && !lod) continue;   // первый этаж — дверь и окошки ниже
        const n = Math.max(1, Math.floor((W - 0.3) / 1.75));
        for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; glass(gz, F, x, yb + 1.31, D / 2 + 0.02, 0.78, 1.08, R() < 0.3 ? 0 : 1, fWin, R() < gl ? 1 : 0); }
      }
      if (lod) {
        // дальние ряды: окна и на заду (нижние ряды смотрят в долину задом к дороге) и на открытом боку
        if (h.backWin) for (let s = 0; s < h.storeys; s++) { const nb = Math.max(1, Math.floor((W - 0.3) / 2.2)); for (let i = 0; i < nb; i++) if (R() < 0.8) glass(gz, F, -W / 2 + (i + 0.5) * W / nb, s * ST + 1.31, -D / 2 - 0.02, 0.78, 1.08, 1, fWin, R() < gl ? 1 : 0, PI); }
        const rh = roofGeo(bk, F, h, W, D, H, R, { crest: true, wall: side, rust: HI, sideL: h.nbL < h.y0 + H - 0.3, sideR: h.nbR < h.y0 + H - 0.3, back: true, yardLife: h.yardLife });
        h.roofTop = h.y0 + H + rh; return;
      }
      // первый этаж: дверь, окошко, иногда — лавка/мастерская (широкий проём со ставнями и щитом)
      const dx = clamp((R() - 0.5) * (W - 1.8), -W / 2 + 0.8, W / 2 - 0.8), zd = D / 2 + 0.02;
      if (h.shop && W >= 3.4) shopFront(bk, gz, F, h, W, D, R, dx);
      else {
        const dc = h.blue || h.wall === 'blueFull' || R() < 0.2 ? C('doorBlue') : R() < 0.08 ? C('doorTeal') : (R() < 0.5 ? C('wood') : C('woodD'));
        qv(bk, F, [[dx - 0.45, 0, zd], [dx + 0.45, 0, zd], [dx + 0.45, 1.75, zd], [dx - 0.45, 1.75, zd]], p => mul(dc, p[1] > h.y0 + 1.6 ? 0.8 : 1), S.FLAT);
        qv(bk, F, [[dx - 0.08, 0.85, zd + 0.01], [dx + 0.08, 0.85, zd + 0.01], [dx + 0.08, 0.9, zd + 0.01], [dx - 0.08, 0.9, zd + 0.01]], C('gilt'), S.FLAT);
        qv(bk, F, [[dx - 0.58, 1.75, zd + 0.004], [dx + 0.58, 1.75, zd + 0.004], [dx + 0.58, 1.97, zd + 0.004], [dx - 0.58, 1.97, zd + 0.004]], mul(C('ochre2'), 0.95), S.ASHLAR);
        bk.box(F, dx, 0.05, D / 2 + 0.2, 1.1, 0.1, 0.36, { col: mul(C('tread'), 0.95), s: S.SLAB, skip: { ny: 1 } });
        // пасхалки: резной камень над дверью (как камни с рельефом в стенах домов села: львы, олень, птицы, ветка) или
        // табличка «10/10» у двери — номер дома и кивок названию игры
        if (h.eg) { const eg = h.eg, pr = R();
          if (pr < 0.22 && eg.carved < 2) { eg.carved++; const tl = 'carv' + Math.floor(R() * 4); eg.egg.push(() => decal(h.bs, F, dx, 2.19, zd + 0.012, 0.42, 0.42, tl)); }
          else if (pr > 0.95) { const nx = dx + (dx > 0 ? -0.72 : 0.72); eg.egg.push(() => decal(h.bs, F, nx, 1.55, zd + 0.012, 0.3, 0.3 / SIGN.rect.num[4], 'num')); } }
        if (W > 3.6) { const wx = dx > 0 ? dx - 1.5 : dx + 1.5; if (Math.abs(wx) < W / 2 - 0.4) glass(gz, F, wx, 1.45, D / 2 + 0.02, 0.55, 0.66, 1, C('frameWhite'), R() < gl ? 1 : 0); }
        if (h.lantern) wallLantern(bk, F, dx + (dx > 0 ? -0.85 : 0.85), 2.05, D / 2 + 0.24, halos);
        if (h.copper) copperJugs(bk, F, dx + (dx > 0 ? -1.0 : 1.0), D / 2 + 0.32, R);
        // герань на подоконнике и в горшках у двери (p2: красные пятнышки у синих стен) — high
        if (HI && R() < 0.5) { const q = F.p(dx + 0.75, 0.2, D / 2 + 0.25); bk.cyl(q[0], q[1] - 0.2, q[2], 0.13, 0.16, 0.26, { seg: 6, col: C('rust') }); bk.sph(q[0], q[1] + 0.2, q[2], 0.2, 0.15, 0.2, C('geraniumLeaf'), { seg: 6, rings: 3 }); bk.sph(q[0], q[1] + 0.3, q[2], 0.12, 0.08, 0.12, C('geranium'), { seg: 5, rings: 3 }); }
      }
      // боковые окна у открытого бока
      for (let s = 1; s < h.storeys; s++) {
        const top = h.y0 + (s + 1) * ST;
        if (h.nbR < top - 0.6) glass(gz, F, W / 2 + 0.02, s * ST + 1.31, 0.3, 0.78, 1.08, 1, fWin, R() < gl * 0.7 ? 1 : 0, PI / 2);
        if (h.nbL < top - 0.6) glass(gz, F, -W / 2 - 0.02, s * ST + 1.31, 0.3, 0.78, 1.08, 1, fWin, R() < gl * 0.7 ? 1 : 0, -PI / 2);
      }
      // балкон с деревянными перилами (2-й этаж без галереи, иногда)
      if (h.balcony && h.storeys > 1 && !gs.includes(1)) { const bx = (R() - 0.5) * (W - 2.4), bw2 = 1.8, y = ST + 0.05;
        bk.box(F, bx, y, D / 2 + 0.4, bw2, 0.12, 0.8, { col: C('woodD'), cols: { py: C('wood') } });
        barF(bk, F, [bx - bw2 / 2, y + 0.95, D / 2 + 0.78], [bx + bw2 / 2, y + 0.95, D / 2 + 0.78], 0.06, C('wood'));
        for (let k2 = 0; k2 <= 5; k2++) { const x = bx - bw2 / 2 + bw2 * k2 / 5; barF(bk, F, [x, y + 0.06, D / 2 + 0.78], [x, y + 0.95, D / 2 + 0.78], 0.04, C('woodD')); }
        [-1, 1].forEach(sd => barF(bk, F, [bx + sd * bw2 / 2, y + 0.95, D / 2 + 0.05], [bx + sd * bw2 / 2, y + 0.95, D / 2 + 0.78], 0.06, C('wood')));
        // пасхалка: барсук-гравёр (житель игры, лупа на лбу) машет с балкона
        if (h.eg && h.eg.cameo < 1 && R() < 0.45) { h.eg.cameo++; const q = F.p(bx + 0.4, y + 0.06, D / 2 + 0.42); cameo(bk, new K.Frame(q[0], q[1], q[2], F.ry), 'badger'); } }
      const rh = roofGeo(bk, F, h, W, D, H, R, { wall: side, sideL: h.nbL < h.y0 + H - 0.3, sideR: h.nbR < h.y0 + H - 0.3, back: true, rust: true, yardLife: h.yardLife });
      h.roofTop = h.y0 + H + rh + 0.1;
      // трубы: металлические (оцинковка) и изредка каменная
      const np = h.roof === 'flat' ? (R() < 0.5 ? 1 : 0) : 1 + (R() < 0.4 ? 1 : 0);
      for (let i = 0; i < np; i++) { const lx = (R() - 0.5) * W * 0.6, lz = -D / 2 + 0.6 + R() * 1.2, q = F.p(lx, H + 0.1 + rh * 0.55, lz), hh = 0.6 + R() * 0.4;
        bk.cyl(q[0], q[1], q[2], 0.06, 0.06, hh, { seg: 5, col: rgb('#8E918C'), cap: false }); bk.cyl(q[0], q[1] + hh, q[2], 0.13, 0.0, 0.16, { seg: 5, col: rgb('#6E716D') }); }
      if (R() < 0.15) bk.box(F, W / 2 - 0.6, H + 0.4 + rh * 0.4, -D / 2 + 0.6, 0.42, 0.85, 0.42, { col: [0.95, 0.95, 0.95], s: S.RUBBLE, cols: { py: C('parapetCap') } });
      // мастерские: высокая кирпичная труба горна с тёмным оголовком (видна на фоне неба — силуэт улицы мастерских)
      if (h.stack) { const sx = clamp((R() - 0.5) * W * 0.5, -W / 2 + 0.5, W / 2 - 0.5), sh = 1.7 + R() * 0.7, y0 = H + rh * 0.3;
        bk.box(F, sx, y0 + sh / 2, -D / 4, 0.56, sh, 0.56, { col: p => mul(BRICK, 0.9 + 0.1 * Math.sin(p[1] * 9)), skip: { ny: 1 } });
        bk.box(F, sx, y0 + sh + 0.08, -D / 4, 0.7, 0.16, 0.7, { col: mul(BRICK, 0.62) }); }
      if (h.stair && W >= 4.4) blueStair(bk, F, h, W, D);
    }

    // лавка/мастерская на первом этаже: широкий проём (тёплая глубина), деревянные ставни, прилавок с товаром, щит с надписью
    function shopFront(bk, gz, F, h, W, D, R, dx) {
      const ow = Math.min(2.4, W - 1.2), ox = clamp(dx, -W / 2 + ow / 2 + 0.3, W / 2 - ow / 2 - 0.3), zd = D / 2 + 0.02, dark = rgb('#4A3A30');
      qv(bk, F, [[ox - ow / 2, 0.05, zd - 0.01], [ox + ow / 2, 0.05, zd - 0.01], [ox + ow / 2, 2.05, zd - 0.01], [ox - ow / 2, 2.05, zd - 0.01]], p => mul(dark, p[1] > h.y0 + 1.2 ? 0.75 : 1.1), S.FLAT);
      const n0 = bk.n; qv(bk, F, [[ox - ow / 2 + 0.15, 0.9, zd], [ox + ow / 2 - 0.15, 0.9, zd], [ox + ow / 2 - 0.15, 1.85, zd], [ox - ow / 2 + 0.15, 1.85, zd]], rgb('#B08A5A'), S.FLAT); fxMark(bk, n0, 0.55, 0);   // тёплый свет изнутри (ночью)
      // ставни, раскрытые к стене
      const shc = R() < 0.5 ? C('doorBlue') : C('wood');
      [-1, 1].forEach(sd => { const xs = ox + sd * (ow / 2 + 0.35); qv(bk, F, [[xs - 0.33, 0.25, zd + 0.02], [xs + 0.33, 0.25, zd + 0.02], [xs + 0.33, 2.0, zd + 0.02], [xs - 0.33, 2.0, zd + 0.02]], shc, S.FLAT);
        qv(bk, F, [[xs - 0.24, 0.4, zd + 0.03], [xs + 0.24, 0.4, zd + 0.03], [xs + 0.24, 1.0, zd + 0.03], [xs - 0.24, 1.0, zd + 0.03]], mul(shc, 0.85), S.FLAT); });
      // перемычка, прилавок, товар: медь и серебро (кувшины, тарелки), ткани
      qv(bk, F, [[ox - ow / 2 - 0.1, 2.05, zd + 0.01], [ox + ow / 2 + 0.1, 2.05, zd + 0.01], [ox + ow / 2 + 0.1, 2.28, zd + 0.01], [ox - ow / 2 - 0.1, 2.28, zd + 0.01]], mul(C('ochre2'), 0.95), S.ASHLAR);
      bk.box(F, ox, 0.45, D / 2 + 0.3, ow, 0.9, 0.55, { col: C('wood'), cols: { py: C('woodD') }, skip: { ny: 1 } });
      const ware = [C('silverWare'), C('copper'), C('silverWare'), C('gilt'), C('copper')];
      for (let i = 0; i < 4; i++) { const x = ox - ow / 2 + 0.35 + i * (ow - 0.7) / 3, q = F.p(x, 0.9, D / 2 + 0.3), c = ware[(i + Math.floor(R() * 5)) % 5];
        if (i % 2) { bk.cyl(q[0], q[1], q[2], 0.09, 0.12, 0.18, { seg: 6, col: c }); bk.cyl(q[0], q[1] + 0.18, q[2], 0.12, 0.05, 0.12, { seg: 6, col: c }); }
        else bk.cyl(q[0], q[1], q[2], 0.17, 0.17, 0.03, { seg: 8, col: c }); }
      // пасхалка: в глубине лавки на стене — расписные тарелки (старинные тарелки на стенах — примета здешних домов)
      if (h.eg) { const n = ow > 1.8 ? 3 : 2, ks = Math.floor(R() * 3); for (let j = 0; j < n; j++) { const px = ox + (j - (n - 1) / 2) * 0.56, py = 1.5 + (j % 2) * 0.08, id = 'plate' + ((ks + j) % 3); h.eg.egg.push(() => plateDecal(h.bs, F, px, py, zd + 0.006, 0.17, id)); } }
      // вывеска-«флажок» поперёк тротуара (лицом вдоль улицы — читается на подходе, в отличие от щита на фасаде): кованый
      // кронштейн, деревянная доска, надпись — в сетке вывесок сегмента (h.bs)
      if (h.bs) { const ids = { M: 'shopM', L: 'shopL', F: 'shopF', P: 'shopP', B: 'shopB', K: 'shopK', S: 'shopS' }, id = ids[h.shop] || 'shopM', r = SIGN.rect[id];
        const bx = clamp(ox + (ox > 0 ? -ow / 2 - 0.55 : ow / 2 + 0.55), -W / 2 + 0.3, W / 2 - 0.3), z0 = D / 2 + 0.2, z1 = D / 2 + 1.35, hh = (z1 - z0) / r[4], y1 = 3.05, y0 = y1 - hh;
        bk.box(F, bx, (y0 + y1) / 2, (z0 + z1) / 2, 0.06, hh + 0.08, z1 - z0 + 0.08, { col: C('woodD') });
        barF(bk, F, [bx, y1 + 0.14, D / 2], [bx, y1 + 0.14, z1 + 0.08], 0.04, rgb('#34343A')); barF(bk, F, [bx, y1 + 0.14, z0 + 0.1], [bx, y1, z0 + 0.1], 0.02, rgb('#34343A')); barF(bk, F, [bx, y1 + 0.14, z1 - 0.1], [bx, y1, z1 - 0.1], 0.02, rgb('#34343A'));
        barF(bk, F, [bx, y1 + 0.5, D / 2], [bx, y1 + 0.14, z1 * 0.5 + D / 4], 0.03, rgb('#34343A'));
        const bs = h.bs, col = [1.15, 1.15, 1.15], q = (xx, zz, yy) => F.p(xx, yy, zz);
        bs.quad(q(bx - 0.035, z0, y0), q(bx - 0.035, z1, y0), q(bx - 0.035, z1, y1), q(bx - 0.035, z0, y1), col, S.FLAT, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
        bs.quad(q(bx + 0.035, z1, y0), q(bx + 0.035, z0, y0), q(bx + 0.035, z0, y1), q(bx + 0.035, z1, y1), col, S.FLAT, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]); }
    }

    /* =================================================================
       4. УЛИЦА: мостовая, бордюры, тротуары, фонари, парапеты, лестницы-проходы, гирлянды, деревья, террасы
       ================================================================= */
    // мостовая: сетка 1 × 2,5 м (пятна света фонарей — цветом свечения вершин), uv в метрах / 4 (длины сегментов делятся на 4)
    const RT = 2.5;   // метров на плитку мостовой (камень ≈ 12–20 см; длины сегментов кратны 20 — шва нет)
    function roadGeo(len, lamps, extra, kind) {
      const bk = new K.Baker('atlas'), xs = [-4, -3.4, -2.4, -1.4, -0.6, 0, 0.6, 1.4, 2.4, 3.4, 4], dz = 2.5, nz = Math.round(len / dz);
      // тон: у бордюров темнее (сток), посередине полос — светлее (натоптано); пятна — периодом 20 м (без шва между сегментами)
      const tone = (x, z) => { const ax = Math.abs(x), w = Math.sin(z * TAU / 20 + x * 0.9) * Math.sin(z * TAU / 40 - x * 0.6);
        const k = (ax > 3.5 ? lerp(1, 0.8, (ax - 3.5) / 0.5) : 1) * (1 + 0.05 * Math.cos(((x + 7.2) % 2.4) / 2.4 * TAU)) * (0.95 + 0.05 * w); return WIN ? [k, k, k * 1.02] : [k, k * 0.99, k * 0.97]; };
      for (let j = 0; j < nz; j++) { const z0 = -j * dz, z1 = -(j + 1) * dz;
        for (let i = 0; i < xs.length - 1; i++) { const x0 = xs[i], x1 = xs[i + 1];
          bk.quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], p => tone(p[0], p[2]), S.FLAT, [[x0 / RT, z0 / RT], [x1 / RT, z0 / RT], [x1 / RT, z1 / RT], [x0 / RT, z1 / RT]], [0, 1, 0]); } }
      // горная дорога: белая кромка и пунктир между полосами (полосы читаются и в тумане)
      if (kind === 'a') { const wc = [1.55, 1.55, 1.5];
        for (let j = 0; j < nz; j++) { const z0 = -j * dz, z1 = -(j + 1) * dz;
          [-3.85, 3.85].forEach(x => bk.quad([x - 0.07, 0.004, z0], [x + 0.07, 0.004, z0], [x + 0.07, 0.004, z1], [x - 0.07, 0.004, z1], wc, S.FLAT, [[0.3, 0.3], [0.31, 0.3], [0.31, 0.31], [0.3, 0.31]], [0, 1, 0]));
          if (j % 2 === 0) [-1.2, 1.2].forEach(x => bk.quad([x - 0.06, 0.004, z0 - 0.3], [x + 0.06, 0.004, z0 - 0.3], [x + 0.06, 0.004, z1 - 0.3], [x - 0.06, 0.004, z1 - 0.3], wc, S.FLAT, [[0.3, 0.3], [0.31, 0.3], [0.31, 0.31], [0.3, 0.31]], [0, 1, 0])); } }
      // площади (базар): та же мостовая клетками 2,5 м, у краёв темнее
      (extra || []).forEach(([xa, xb, za, zb]) => { const nx = Math.max(1, Math.round((xb - xa) / 2.5)), nzz = Math.max(1, Math.round((za - zb) / 2.5));
        for (let j = 0; j < nzz; j++) for (let i = 0; i < nx; i++) { const x0 = lerp(xa, xb, i / nx), x1 = lerp(xa, xb, (i + 1) / nx), z0 = lerp(za, zb, j / nzz), z1 = lerp(za, zb, (j + 1) / nzz);
          const tn = p => { const e = Math.min(p[0] - xa, xb - p[0], za - p[2], p[2] - zb); return mul([1, 0.99, 0.97], (e < 0.8 ? 0.84 : 1) * (0.95 + 0.05 * Math.sin(p[0] * 0.7 + p[2] * 0.5))); };
          bk.quad([x0, 0.005, z0], [x1, 0.005, z0], [x1, 0.005, z1], [x0, 0.005, z1], tn, S.FLAT, [[x0 / RT, z0 / RT], [x1 / RT, z0 / RT], [x1 / RT, z1 / RT], [x0 / RT, z1 / RT]], [0, 1, 0]); } });
      const lampFn = lamps.length ? (x, y, z) => { let a = 0; for (let i = 0; i < lamps.length; i += 4) { const dx = x - lamps[i] * 0.82, dzz = z - lamps[i + 2]; a += lamps[i + 3] * Math.exp(-(dx * dx + dzz * dzz) / 9); } return Math.min(0.6, a * 0.5); } : null;
      // зимой (сезон игры) мостовые тем под снегом — общая белая
      return meshOf(bk, roadMat(kind === 'a' ? 'a' : WIN ? 'c' : kind || 'c'), { lampFn, name: 'road' });
    }
    // бордюр, тротуар, плитняк-«дорожки» между полосами (подсказка полос, как старые плиты в мостовой)
    function curbsGeo(bk, len, R) {
      const tread = C('tread'), slab = C('slab');
      [-1, 1].forEach(sd => {
        for (let z = 0; z > -len + 0.01; z -= 2) { const t = mul(tread, 0.9 + R() * 0.14), z1 = z - 2, xi = sd * ROAD, xo = sd * CURB;
          bk.quadF([xi, 0.14, z], [xo, 0.14, z], [xo, 0.14, z1], [xi, 0.14, z1], t, S.SLAB, [0, 1, 0]);
          bk.quadF([xi, -0.02, z], [xi, 0.14, z], [xi, 0.14, z1], [xi, -0.02, z1], mul(t, 0.82), S.SLAB, [-sd, 0, 0]); }
        for (let z = 0; z > -len + 0.01; z -= 10) { const xi = sd * CURB, xo = sd * 6.6;
          bk.quadF([xi, WALK_Y, z], [xo, WALK_Y, z], [xo, WALK_Y, z - 10], [xi, WALK_Y, z - 10], p => mul(slab, 0.95 + 0.05 * Math.sin(p[2] * 0.7 + p[0])), S.SLAB, [0, 1, 0]); }
        for (let z = 0; z > -len + 0.01; z -= 4) { const xc = sd * LANE / 2, c = mul(C('slab'), 1.02 + R() * 0.06);
          bk.quadF([xc - 0.2, 0.012, z], [xc + 0.2, 0.012, z], [xc + 0.2, 0.012, z - 4], [xc - 0.2, 0.012, z - 4], c, S.SLAB, [0, 1, 0]); }
      });
    }
    // фонарный столб у бордюра: база, ствол, кольцо, кронштейн к полотну, шестигранный фонарь со свечением
    function lampPost(bk, x, z, halos, kind) {
      const sd = Math.sign(x), met = rgb('#34343A'), met2 = rgb('#4A4A52');
      bk.box(new K.Frame(x, 0, z, 0), 0, WALK_Y + 0.2, 0, 0.32, 0.4, 0.32, { col: met2, skip: { ny: 1 } });
      bk.cyl(x, WALK_Y + 0.4, z, 0.08, 0.06, 3.4, { seg: 6, col: met, cap: false });
      bk.cyl(x, WALK_Y + 2.2, z, 0.11, 0.11, 0.12, { seg: 6, col: met2 });
      const top = WALK_Y + 3.8;
      if (kind === 'four') {   // столб базарной площади: четыре фонаря на крестовине (как bazaar.js)
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, az]) => { const lx = x + ax * 0.55, lz = z + az * 0.55; bar(bk, [x, top, z], [lx, top, lz], 0.05, met); lantern(bk, lx, top - 0.35, lz, halos, 0.9); });
        bk.cyl(x, top, z, 0.1, 0.02, 0.4, { seg: 6, col: met });
        return;
      }
      bk.cyl(x, top - 0.2, z, 0.06, 0.03, 0.4, { seg: 5, col: met });
      const ax = x - sd * 0.95; bar(bk, [x, top, z], [ax, top, z], 0.05, met); bar(bk, [x, top - 0.45, z], [x - sd * 0.5, top - 0.02, z], 0.035, met);
      lantern(bk, ax, top - 0.42, z, halos, 1);
    }
    function lantern(bk, x, y, z, halos, k) {
      const met = rgb('#34343A');
      bk.cyl(x, y + 0.36, z, 0.02, 0.02, 0.06, { seg: 4, col: met, cap: false });
      bk.cyl(x, y + 0.26, z, 0.08, 0.2, 0.1, { seg: 6, col: met });   // шапка (раструб вниз — как у кованых фонарей)
      bk.cyl(x, y + 0.36, z, 0.2, 0.04, 0.06, { seg: 6, col: met });
      const n0 = bk.n; bk.cyl(x, y - 0.08, z, 0.1, 0.15, 0.34, { seg: 6, col: rgb('#FFE6B0'), cap: false }); fxMark(bk, n0, 1, 0);
      bk.cyl(x, y - 0.14, z, 0.04, 0.11, 0.06, { seg: 6, col: met });
      if (halos) halos.push(x, y + 0.08, z, k || 1);
    }
    // парапет у обрыва справа: каменная стенка 0,7 м с шапкой и голубые трубчатые перила (как ограды села над террасами)
    function parapet(bk, z0, z1, R) {
      const x0 = WALK + 0.05, x1 = WALK + 0.42, yT = WALK_Y + 0.72, cap = mul(C('parapetCap'), 1.1), rail = C('pipeRail');
      bk.quadF([x0, -0.3, z0], [x0, yT, z0], [x0, yT, z1], [x0, -0.3, z1], p => mul([0.97, 0.96, 0.93], 0.92 + 0.08 * Math.sin(p[2] * 1.3)), S.RUBBLE, [-1, 0, 0]);
      bk.quadF([x0 - 0.03, yT, z0], [x1 + 0.03, yT, z0], [x1 + 0.03, yT, z1], [x0 - 0.03, yT, z1], cap, S.SLAB, [0, 1, 0]);
      bk.quadF([x0 - 0.03, yT - 0.08, z0], [x0 - 0.03, yT + 0.001, z0], [x0 - 0.03, yT + 0.001, z1], [x0 - 0.03, yT - 0.08, z1], mul(cap, 0.85), S.FLAT, [-1, 0, 0]);
      const xr = (x0 + x1) / 2;
      bar(bk, [xr, yT + 0.62, z0], [xr, yT + 0.62, z1], 0.05, rail);
      if (HI) bar(bk, [xr, yT + 0.32, z0], [xr, yT + 0.32, z1], 0.035, rail);
      const n = Math.max(1, Math.round(Math.abs(z1 - z0) / 2));
      for (let i = 0; i <= n; i++) { const z = lerp(z0, z1, i / n); bar(bk, [xr, yT, z], [xr, yT + 0.64, z], 0.045, rail); }
      // герань в ящике на парапете — изредка (тёплое пятно у голубых перил)
      if (R() < 0.35) { const z = lerp(z0, z1, 0.3 + R() * 0.4); bk.box(new K.Frame(xr, yT, z, 0), 0, 0.1, 0, 0.3, 0.2, 0.7, { col: C('rust') }); bk.sph(xr, yT + 0.28, z, 0.18, 0.12, 0.34, C('geraniumLeaf'), { seg: 5, rings: 3 }); bk.sph(xr, yT + 0.36, z, 0.12, 0.07, 0.24, C('geranium'), { seg: 5, rings: 2 }); }
      // пасхалка: голуби на шапке парапета (житель игры: «Курлы. Это наше метро»), по двое-трое, смотрят кто куда
      if (EGG && Math.abs(z1 - z0) > 2.5 && R() < 0.24) { const n = 2 + Math.floor(R() * 2), dz = z1 < z0 ? -1 : 1, zc = lerp(z0, z1, 0.2 + R() * 0.4);
        for (let i = 0; i < n; i++) cameo(bk, new K.Frame(xr + (R() - 0.5) * 0.1, yT, zc + dz * i * (0.38 + R() * 0.2), (R() < 0.5 ? -PI / 2 : PI / 2) + (R() - 0.5) * 1.2), 'pigeon'); }
    }
    // проход-лестница вверх между домами слева: каменные ступени к верхнему ряду (иногда синие подступёнки)
    function stairLane(bk, z0, z1, yTop, R) {
      const xa = -WALK - 0.2, xb = -12.0, n = Math.max(8, Math.round(yTop / 0.21)), run = (xb - xa) / n, rise = (yTop - WALK_Y) / n, blue = R() < 0.4;
      const tr = C('tread'), rs = blue ? C('blue') : mul(C('tread'), 0.8);
      for (let i = 0; i < n; i++) { const x = xa + run * i, y = WALK_Y + rise * (i + 1);
        bk.quadF([x, y - rise, z0], [x, y, z0], [x, y, z1], [x, y - rise, z1], rs, blue ? S.WASH : S.SLAB, [1, 0, 0]);
        bk.quadF([x, y, z0], [x + run, y, z0], [x + run, y, z1], [x, y, z1], mul(tr, 0.94 + (i % 2) * 0.06), S.SLAB, [0, 1, 0]); }
      if (R() < 0.6) { const xm = lerp(xa, xb, 0.5), ym = WALK_Y + yTop * 0.5; bar(bk, [xa, WALK_Y + 1.0, z1 + 0.12], [xb, yTop + 0.95, z1 + 0.12], 0.045, C('rail')); bar(bk, [xm, ym, z1 + 0.12], [xm, ym + 0.95, z1 + 0.12], 0.04, C('rail')); }
    }
    // гирлянда поперёк улицы (свадебные флажки или лампочки) — в сетку «над головой» (ядро прячет эту сетку на время параплана)
    const FLAGC = ['#E8455A', '#F2C94C', '#5FB3B3', '#F5F0E6', '#8E3A7A', '#3F78B8', '#F28C3A'].map(rgb);
    const FLAGT = {}; THEMES.forEach(t => { if (t.flags) FLAGT[t.id] = t.flags.map(rgb); });   // флажки темы (базар — красно-золотые, школа — сине-белые)
    function garland(bk, z, kind, halos, R, pal) {
      const FC = pal || FLAGC;
      const xa = -5.9, xb = 5.9, yA = GAR.y1 + (R() - 0.5) * 0.2, yB = GAR.y1 + (R() - 0.5) * 0.2, sag = yA - GAR.y0, zj = (R() - 0.5) * 1.2;
      const at = t => { const x = lerp(xa, xb, t), u = 2 * t - 1; return [x, lerp(yA, yB, t) - sag * (1 - u * u), z + zj * Math.sin(t * PI)]; };
      const N = 10; for (let i = 0; i < N; i++) bar(bk, at(i / N), at((i + 1) / N), 0.025, rgb('#3A3A40'));
      if (kind === 'bulbs') {
        for (let i = 1; i < 18; i++) { const p = at(i / 18), n0 = bk.n; bk.sph(p[0], p[1] - 0.09, p[2], 0.07, 0.09, 0.07, rgb(i % 3 ? '#FFE2A0' : '#FFC6A0'), { seg: 4, rings: 2 }); fxMark(bk, n0, 1, 0); if (halos && i % 2) halos.push(p[0], p[1] - 0.09, p[2], 0.45); }
        return;
      }
      const n0 = bk.n, k0 = Math.floor(R() * 7);
      for (let i = 1; i < 21; i++) { const t = i / 21, p = at(t), c = FC[(i + k0) % FC.length], a = [p[0] - 0.16, p[1], p[2]], b = [p[0] + 0.16, p[1], p[2]], d = [p[0], p[1] - 0.38, p[2] + 0.02];
        bk.tri(a, b, d, c, S.FLAT, null, [0, 0, 1]); bk.tri(b, a, d, mul(c, 0.82), S.FLAT, null, [0, 0, -1]); }
      fxMark(bk, n0, 0, 1);
    }
    // деревья: тополь (тёмно-зелёный конус) и осеннее дерево (рыжая крона) — несколько граней, цвет вершин (FLAT)
    function tree(bk, x, y, z, kind, s, R) {
      if (kind === 'poplar') { const h = (8 + R() * 3) * s;
        bk.cyl(x, y, z, 0.12 * s, 0.1 * s, 1.2 * s, { seg: 5, col: C('trunk'), cap: false });
        bk.cyl(x, y + 0.9 * s, z, 0.85 * s, 0.0, h, { seg: 7, col: p => mul(mix(C('poplar'), C('poplar2'), clamp((p[1] - y) / h, 0, 1)), 1.0) });
        return; }
      const h = (2.2 + R()) * s, cr = (1.5 + R() * 0.7) * s, lc = [C('leafA'), C('leafB'), C('leafC'), C('leafD'), C('grass2')][Math.floor(R() * 5)];
      bk.cyl(x, y, z, 0.16 * s, 0.11 * s, h, { seg: 5, col: C('trunk'), cap: false });
      bk.sph(x, y + h + cr * 0.6, z, cr, cr * 0.85, cr, (p, ny) => mul(lc, 0.78 + 0.3 * Math.max(0, ny)), { seg: HI ? 8 : 6, rings: HI ? 5 : 4 });
      if (R() < 0.5) bk.sph(x + cr * 0.6, y + h + cr * 0.25, z + cr * 0.3, cr * 0.6, cr * 0.5, cr * 0.6, (p, ny) => mul(lc, 0.74 + 0.3 * Math.max(0, ny)), { seg: 5, rings: 3 });
    }
    // мягкие зелёные ступени террас (палитра p11 из vkit.TPAL): проступь, светлая бровка, тёмный откос — полосами вдоль z
    const TP = VK.TPAL;
    function terraceStep(bk, xIn, xOut, yTop, yBot, z0, z1, k, dir) {
      // dir: +1 — склон вниз к +x (справа), −1 — вверх к −x (слева: ступень поднимается от дороги)
      const pc = TP.tread[k % TP.tread.length], cT = WIN ? SNOW : rgb(pc[0]), cT2 = WIN ? rgb('#E6EDF4') : rgb(pc[1]), cR = WIN ? rgb('#7C8672') : rgb(TP.riser[0]), cR2 = WIN ? rgb('#59624F') : rgb(TP.riser[1]), cHL = WIN ? SNOW : mix(cT2, rgb(TP.hl), 0.6);
      const per = z => 0.95 + 0.06 * Math.sin(z * TAU / 20 + k * 1.7);
      const lip = Math.min(0.8, Math.abs(xOut - xIn) * 0.18), xl = xOut - dir * lip, rw = Math.min(Math.abs(yTop - yBot) * 0.5, 2.2);
      bk.quadF([xIn, yTop, z0], [xl, yTop, z0], [xl, yTop, z1], [xIn, yTop, z1], p => mul(Math.abs(p[0] - xIn) < 0.01 ? cT : cT2, per(p[2])), S.FLAT, [0, 1, 0]);
      bk.quadF([xl, yTop, z0], [xOut, yTop - 0.15, z0], [xOut, yTop - 0.15, z1], [xl, yTop, z1], p => mul(Math.abs(p[0] - xl) < 0.01 ? cT2 : cHL, per(p[2])), S.FLAT, [dir * 0.3, 1, 0]);
      bk.quadF([xOut, yTop - 0.15, z0], [xOut + dir * rw, yBot, z0], [xOut + dir * rw, yBot, z1], [xOut, yTop - 0.15, z1], p => mul(p[1] > yBot + 0.01 ? cR : cR2, per(p[2])), S.FLAT, [dir, 0.5, 0]);
    }
    // подпорная стенка уступа (бут), лицом к ±x
    function retain(bk, x, y0, y1, z0, z1, dir) { bk.quadF([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], p => mul([0.95, 0.94, 0.9], p[1] > y1 - 0.05 ? 1.04 : 0.86 + 0.1 * (p[1] - y0) / Math.max(0.5, y1 - y0)), S.RUBBLE, [dir, 0, 0]); }

    /* --- ряды домов --- */
    const RIGHT_ROWS = [{ xa: 13.0, y0: -4.0, st: [1, 2] }, { xa: 21.0, y0: -8.8, st: [1, 2] }, { xa: 29.0, y0: -13.6, st: [1, 2] }];
    const LEFT_ROWS = [{ xa: -12.6, y0: 4.8, st: [2, 3] }, { xa: -20.0, y0: 9.6, st: [2, 3] }];
    // спецификация дома ряда; side −1 — фасад на +x, +1 — на −x; xf — линия фасада (|x|)
    function houseSpec(R, th, side, xf, zc, w, y0, st, o = {}) {
      const WL = (th && th.walls) || WALLS, d = o.d || 5.4 + R() * 1.6, storeys = st, H = storeys * ST + (R() < 0.3 ? 0.3 : 0), wall = o.wall || WL[Math.floor(R() * WL.length)];
      const flat = R() < (o.flat !== undefined ? o.flat : 0.5), roof = flat ? 'flat' : ['hip', 'hip', 'shed', 'gable'][Math.floor(R() * 4)];
      const h = { x: side < 0 ? -(xf + d / 2) : xf + d / 2, y0, z: zc, ry: side < 0 ? PI / 2 : -PI / 2, w, d, h: H, storeys, wall, roof, roofMat: flat ? 'yard' : ROOFM[Math.floor(R() * ROOFM.length)], side,
        blue: wall === 'blueFull' || R() < 0.15, blueBand: R() < 0.25, nbL: -99, nbR: -99, glow: o.glow !== undefined ? o.glow : 0.4, lod: !!o.lod, foot: o.foot, back: o.back, backWin: o.backWin, yardLife: flat && o.yardLife };
      if (storeys > 1 && R() < (o.gal !== undefined ? o.gal : 0.55)) { const gst = storeys > 2 && R() < 0.4 ? [1, 2] : [storeys - 1]; h.gallery = { storeys: gst, proj: R() < 0.55 ? 0.45 : 0, frame: FRAMES[Math.floor(R() * FRAMES.length)], g1: R() < 0.6 }; }
      if (!o.lod) { h.stair = R() < 0.18 && w >= 4.4 && storeys > 1 && !(h.gallery && h.gallery.storeys.includes(1) && h.gallery.proj > 0); h.balcony = R() < 0.18; h.lantern = R() < 0.35; if (R() < (o.shops || 0)) h.shop = 'MLFPBKS'[Math.floor(R() * 7)];
        // мастерские: кирпичная труба горна на крыше и медные кувшины у двери (лишние R() — только у этой темы: улицы прочих
        // тем при том же зерне не меняются)
        if (th && th.stack) { h.stack = R() < th.stack; h.copper = R() < th.copper; } }
      return h;
    }
    // соседи по ряду: высота соседа со стороны локального −x / +x (слева локальный +x → мир −z, справа → +z)
    function linkRow(list) {
      list.sort((a, b) => b.z - a.z);   // от z = 0 к −len
      for (let i = 0; i < list.length; i++) { const h = list[i], prev = list[i - 1], next = list[i + 1];
        const near = o => o && Math.abs(Math.abs(o.z - h.z) - (o.w + h.w) / 2) < 0.6;
        const tp = near(prev) ? prev.y0 + prev.h : -99, tn = near(next) ? next.y0 + next.h : -99;
        if (h.side < 0) { h.nbL = tp; h.nbR = tn; } else { h.nbL = tn; h.nbR = tp; } }
      return list;
    }

    /* =================================================================
       5. ОРИЕНТИРЫ: башня, комбинат, школа, кофейня, базар, свадебные ворота, дом-мост
       c: { bk, bo (над головой), bs (вывески), gz, halos, R, zc, len, ex (исключения рядов), lampsOff, over, roadX (доп. мостовая) }
       ================================================================= */
    // вывеска из атласа: квад в рамке F лицом к +z; glow — лайтбокс ночью
    function signQuad(bs, F, x, y, z, w, h, id, glow) {
      const r = SIGN.rect[id]; if (!r) return; const n0 = bs.n, col = [1.18, 1.18, 1.18];
      bs.quad(F.p(x - w / 2, y - h / 2, z), F.p(x + w / 2, y - h / 2, z), F.p(x + w / 2, y + h / 2, z), F.p(x - w / 2, y + h / 2, z), col, S.FLAT, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
      if (glow) fxMark(bs, n0, glow, 0);
    }
    const retainZ = (bk, z, x0, x1, y0, y1, d) => bk.quadF([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], p => mul([0.94, 0.93, 0.89], p[1] > y1 - 0.05 ? 1.04 : 0.84), S.RUBBLE, [0, 0, d]);
    const exclude = (c, rows, z0, z1) => rows.forEach(k => (c.ex[k] = c.ex[k] || []).push([Math.max(z0, z1), Math.min(z0, z1)]));
    const qvF = qv;

    // рамка ориентира, развёрнутого к набегающей героине: вертикальная камера (390 × 844) видит фасады вдоль улицы почти с ребра — панели и
    // вывески не читаются; поворот фасада на A к +z открывает его на подходе. side −1 — слева, +1 — справа; E — дальний край
    // фасада (у тротуара) [x, z]; W — ширина фасада, D — глубина. F — в середине фасада (локальный +z — наружу, корпус в −z),
    // Fc — в середине корпуса (фасад на +D/2); far — знак локального x к дальнему краю; n — нормаль фасада [x, z]
    function turnFrame(side, A, E, W, D, y0) {
      const ry = side < 0 ? PI / 2 - A : -(PI / 2 - A), nx = Math.sin(ry), nz = Math.cos(ry);
      const fd = side < 0 ? [Math.sin(A), -Math.cos(A)] : [-Math.sin(A), -Math.cos(A)];
      const C = [E[0] - fd[0] * W / 2, E[1] - fd[1] * W / 2], N = [E[0] - fd[0] * W, E[1] - fd[1] * W];
      const F = new K.Frame(C[0], y0 || 0, C[1], ry), Fc = new K.Frame(C[0] - nx * D / 2, y0 || 0, C[1] - nz * D / 2, ry);
      const zs = [E[1], N[1], E[1] - nz * D, N[1] - nz * D];
      return { F, Fc, C, N, E, ry, far: side < 0 ? 1 : -1, n: [nx, nz], zMax: Math.max(...zs) + 1, zMin: Math.min(...zs) - 1 };
    }
    // площадка перед развёрнутым фасадом: четырёхугольник между тротуаром и фасадом (плиты или асфальт)
    function plaza(bk, side, tf, col, s) {
      const xs = side * (WALK + 0.02), y = WALK_Y + 0.004, E = tf.E, N = tf.N, P3 = p => [p[0], y, p[1]];
      const pts = [[xs, E[1] - 0.6], [E[0], E[1]], [N[0], N[1]], [xs, N[1] + 0.8]];
      trd(bk, P3(pts[0]), P3(pts[1]), P3(pts[2]), col, s || S.SLAB, [0, 1, 0]); trd(bk, P3(pts[0]), P3(pts[2]), P3(pts[3]), col, s || S.SLAB, [0, 1, 0]);
      return pts;
    }
    // ограда вдоль тротуара (столбики и прутья) от za до zb с проёмом [g0, g1]
    function fenceAlong(bk, side, za, zb, g0, g1, col, post) {
      const fx = side * (WALK + 0.22);
      const run = (a, b) => { if (a - b < 0.4) return; bar(bk, [fx, WALK_Y + 1.15, a], [fx, WALK_Y + 1.15, b], 0.05, col); bar(bk, [fx, WALK_Y + 0.3, a], [fx, WALK_Y + 0.3, b], 0.05, col);
        for (let z = a; z > b; z -= (HI ? 0.24 : 0.48)) bar(bk, [fx, WALK_Y + 0.3, z], [fx, WALK_Y + 1.15, z], 0.022, col);
        for (let z = a; z > b - 0.01; z -= 3) bk.box(new K.Frame(fx, 0, z, 0), 0, WALK_Y + 0.65, 0, 0.16, 1.3, 0.16, { col: post || rgb('#C9C6BE') }); };
      if (g0 === undefined) run(za, zb); else { run(za, g0); run(g1, zb); }
    }

    // сторожевая башня (по towerGeo села: тёсаный камень пятнами, пояс-карниз на консолях, парапет, зубцы, окна, дверь) — на первом
    // уступе слева, над крышами нижнего ряда (башню видно издалека); к ней — лестница между домами
    function lmTower(c) {
      // ствол 16,5 м (было 11,6): с камеры забега башня стоит над крышами верхнего ряда, а не прячется за ними до 50 м
      const { bk, R, zc } = c, x = -15.7, z = zc, y0 = LEFT_ROWS[0].y0, rB = 3.7, rT = 3.3, shaft = 16.5, seg = HI ? 28 : 18, tc = [1.03, 0.99, 0.93], per = TAU * rB / 6;
      exclude(c, ['L2'], zc + 7, zc - 7); exclude(c, ['L3'], zc + 6, zc - 6); exclude(c, ['L1'], zc + 6.4, zc + 3.6);
      stairLane(bk, zc + 6.3, zc + 3.7, y0, R);
      const mott = p => { const a = Math.atan2(p[0] - x, p[2] - z), hy = p[1] - y0, n = VK.fbm(Math.cos(a) * 1.5 + 7.3 + hy * 0.05, Math.sin(a) * 1.5 + hy * 0.3, 3); return mul(tc, (0.9 + 0.1 * clamp(hy / 3, 0, 1)) * (0.93 + 0.13 * n)); };
      bk.cyl(x, y0 - 1.2, z, rB + 0.12, rB, 1.2, { seg, s: S.ASHLAR, col: p => mul(mott(p), 0.9), cap: false, uvW: per });
      const bands = [0, 1.4, 3.2, 5.2, 7.2, 9.2, 11.2, 13.2, 15.2, shaft], rAt = hy => lerp(rB, rT, hy / shaft);
      for (let i = 0; i < bands.length - 1; i++) bk.cyl(x, y0 + bands[i], z, rAt(bands[i]), rAt(bands[i + 1]), bands[i + 1] - bands[i], { seg, s: S.ASHLAR, col: mott, cap: false, uvW: per });
      const yS = y0 + shaft, ring = (y, r0, r1, up, col) => { for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU; bk.quadF([x + Math.sin(a) * r0, y, z + Math.cos(a) * r0], [x + Math.sin(b) * r0, y, z + Math.cos(b) * r0], [x + Math.sin(b) * r1, y, z + Math.cos(b) * r1], [x + Math.sin(a) * r1, y, z + Math.cos(a) * r1], col, S.ASHLAR, [0, up ? 1 : -1, 0]); } };
      const yB0 = yS - 0.06, yB1 = yS + 0.24, rBand = rT + 0.22;
      ring(yB0, rT, rBand, false, mul(tc, 0.5));
      bk.cyl(x, yB0, z, rBand, rBand, yB1 - yB0, { seg, s: S.ASHLAR, col: mul(tc, 1.07), cap: false, uvW: per });
      ring(yB1, rT + 0.1, rBand, true, mul(tc, 1.1));
      const NC = HI ? 36 : 22; for (let i = 0; i < NC; i++) { const a = (i + 0.5) / NC * TAU, F = new K.Frame(x + Math.sin(a) * (rT + 0.1), yB0 - 0.13, z + Math.cos(a) * (rT + 0.1), a); bk.box(F, 0, 0, 0, 0.17, 0.26, 0.2, { col: mul(tc, 0.98), cols: { ny: mul(tc, 0.55) }, s: S.ASHLAR, skip: { nz: 1, py: 1 } }); }
      const yP = yB1, yQ = yP + 0.64, rO = rT + 0.1, rI = rT - 0.28;
      bk.cyl(x, yP, z, rO, rO, yQ - yP, { seg, s: S.ASHLAR, col: mul(tc, 1.02), cap: false, uvW: per });
      bk.cyl(x, yP - 0.02, z, rI, rI, yQ - yP + 0.02, { seg, s: S.ASHLAR, col: mul(tc, 0.85), cap: false, inward: true, uvW: per * 0.9 });
      ring(yQ, rI, rO, true, mul(tc, 1.06));
      { const N = 20, rm = (rO + rI) / 2, mw = 0.6 * TAU * rm / N, mh = 0.62; for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * TAU, F = new K.Frame(x + Math.sin(a) * rm, yQ, z + Math.cos(a) * rm, a); bk.box(F, 0, mh / 2, 0, mw, mh, rO - rI, { col: mul(tc, 1.03), cols: { py: mul(tc, 1.12), nz: mul(tc, 0.88) }, s: S.ASHLAR, skip: { ny: 1 } }); } }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, b = (i + 1) / 12 * TAU; bk.tri([x, yS + 0.2, z], [x + Math.sin(a) * rI, yS + 0.2, z + Math.cos(a) * rI], [x + Math.sin(b) * rI, yS + 0.2, z + Math.cos(b) * rI], C('slab'), S.SLAB); }
      const winAt = (az, hy, w, h) => { const a = az * PI / 180, y = y0 + hy, r = rAt(hy) + 0.014, F = new K.Frame(x + Math.sin(a) * r, y, z + Math.cos(a) * r, a);
        qvF(bk, F, [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]], rgb('#2B2622'), S.FLAT);
        qvF(bk, F, [[-w / 2 - 0.09, h / 2, 0.006], [w / 2 + 0.09, h / 2, 0.006], [w / 2 + 0.09, h / 2 + 0.13, 0.006], [-w / 2 - 0.09, h / 2 + 0.13, 0.006]], mul(tc, 1.12), S.ASHLAR);
        qvF(bk, F, [[-w / 2 - 0.06, -h / 2 - 0.09, 0.006], [w / 2 + 0.06, -h / 2 - 0.09, 0.006], [w / 2 + 0.06, -h / 2, 0.006], [-w / 2 - 0.06, -h / 2, 0.006]], mul(tc, 1.08), S.ASHLAR); };
      [[60, 4.4], [110, 7.6], [150, 2.6], [20, 9.8], [-20, 6.0], [80, 9.4], [40, 12.8], [130, 13.6], [-10, 14.6]].forEach(([a, hy]) => winAt(a, hy, 0.46, 0.66));
      { const a = PI / 2, r = rB + 0.015, F = new K.Frame(x + Math.sin(a) * r, y0, z + Math.cos(a) * r, a), w = 0.95, hh = 1.8, sg = 8, dc = C('woodD');
        qvF(bk, F, [[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, hh - w / 2, 0], [-w / 2, hh - w / 2, 0]], dc, S.FLAT);
        for (let i = 0; i < sg; i++) { const a0 = PI * i / sg, a1 = PI * (i + 1) / sg; bk.tri(F.p(0, hh - w / 2, 0), F.p(Math.cos(a0) * w / 2, hh - w / 2 + Math.sin(a0) * w / 2, 0), F.p(Math.cos(a1) * w / 2, hh - w / 2 + Math.sin(a1) * w / 2, 0), dc, S.FLAT);
          const r0 = w / 2, r1 = w / 2 + 0.22; bk.quadF(F.p(Math.cos(a0) * r0, hh - w / 2 + Math.sin(a0) * r0, 0.004), F.p(Math.cos(a0) * r1, hh - w / 2 + Math.sin(a0) * r1, 0.004), F.p(Math.cos(a1) * r1, hh - w / 2 + Math.sin(a1) * r1, 0.004), F.p(Math.cos(a1) * r0, hh - w / 2 + Math.sin(a1) * r0, 0.004), mul(tc, 1.1), S.ASHLAR, F.dir(0, 1)); }
        wallLantern(bk, F, 0.9, 2.1, 0.22, c.halos); }
      [[2.6, -3.2, 1.0], [-1.2, 3.4, 0.8], [3.0, 2.8, 0.7]].forEach(([dx, dz, r]) => bk.sph(x + dx, y0 + 0.05, z + dz, r, r * 0.5, r * 0.8, C('rock'), { seg: 6, rings: 3 }));
      tree(bk, x + 2.6, y0, z - 5.2, 'round', 0.8, R);
      return { side: -1, z0: zc + 7, z1: zc - 7 };
    }

    // художественный комбинат (по kombinat.js): двухэтажный корпус из жёлто-песочного кирпича, каменный цоколь, окна в тёмных рамах,
    // на верхней половине фасада — панель с синей кубачинской рамкой (kombinatSignCanvas), стеклянный тамбур у дальнего края,
    // площадь перед фасадом: плиты, дорожка-«ковёр», газоны, ажурная ограда вдоль тротуара, скамьи, фонари, молодые деревья
    function lmKombinat(c) {
      const { bk, bs, gz, R } = c, W = 20, D = 11, A = 0.6, tf = turnFrame(-1, A, [-6.6, -c.len + 6.9], W, D), F = tf.Fc;
      const BR = WIN ? [0.9, 0.79, 0.6] : [0.95, 0.8, 0.56], BRl = mul(BR, 1.07), STONE = [0.62, 0.59, 0.55], CAP = [0.31, 0.32, 0.35], ALU = rgb('#34383E');
      exclude(c, ['L1', 'L2', 'L3', 'TL'], tf.zMax + 2, tf.zMin); c.lampsOff.push([-1, tf.zMax + 2, tf.zMin]); c.approach.push([-1, tf.zMax + 2, tf.zMax + 18]);
      const PARA = 9.4, zF = D / 2;
      qv(bk, F, [[-W / 2, 0.6, zF], [W / 2, 0.6, zF], [W / 2, PARA, zF], [-W / 2, PARA, zF]], BR, S.WASH);
      qv(bk, F, [[-W / 2 - 0.05, -0.4, zF + 0.05], [W / 2 + 0.05, -0.4, zF + 0.05], [W / 2 + 0.05, 0.6, zF + 0.05], [-W / 2 - 0.05, 0.6, zF + 0.05]], STONE, S.RUBBLE);
      [-1, 1].forEach(sd => { const x = sd * W / 2; qv(bk, F, sd > 0 ? [[x, -0.4, zF], [x, -0.4, -zF], [x, PARA, -zF], [x, PARA, zF]] : [[x, -0.4, -zF], [x, -0.4, zF], [x, PARA, zF], [x, PARA, -zF]], mul(BR, 0.96), S.WASH);
        [-3.0, 0.4, 3.4].forEach(zz => [1.0, 4.6].forEach(yb => glass(gz, F, x + sd * 0.02, yb + 0.9, zz, 1.4, 1.75, 3, ALU, R() < 0.5 ? 1 : 0, sd * PI / 2))); });
      qv(bk, F, [[W / 2, -0.4, -zF], [-W / 2, -0.4, -zF], [-W / 2, PARA, -zF], [W / 2, PARA, -zF]], mul(BR, 0.9), S.WASH);
      bk.box(F, 0, PARA + 0.06, zF - 0.15, W + 0.1, 0.12, 0.34, { col: CAP, skip: { ny: 1 } });
      qv(bk, F, [[-W / 2, PARA - 0.3, zF], [W / 2, PARA - 0.3, zF], [W / 2, PARA - 0.3, -zF], [-W / 2, PARA - 0.3, -zF]], rgb('#5A5C60'), S.ROOF);
      qv(bk, F, [[-W / 2, 3.95, zF + 0.04], [W / 2, 3.95, zF + 0.04], [W / 2, 4.2, zF + 0.04], [-W / 2, 4.2, zF + 0.04]], BRl, S.WASH);
      [-8.6, -6.0, -3.4, -0.8, 8.6].forEach(x => { glass(gz, F, x, 2.0, zF + 0.03, 1.6, 1.8, 3, ALU, R() < 0.6 ? 1 : 0); qv(bk, F, [[x - 0.9, 1.04, zF + 0.06], [x + 0.9, 1.04, zF + 0.06], [x + 0.9, 1.12, zF + 0.06], [x - 0.9, 1.12, zF + 0.06]], [0.86, 0.84, 0.8], S.FLAT); });
      { const pw = 16.2, ph = 5.06, py = 4.3 + ph / 2; bk.box(F, 0, py, zF + 0.08, pw + 0.16, ph + 0.16, 0.14, { col: ALU, skip: { nz: 1 } }); signQuad(bs, F, 0, py, zF + 0.16, pw, ph, 'kombinat', 0.75); }
      // тамбур (локальный x 2,6…7,4 — ближе к дальнему краю, у улицы): стекло, стойки, козырёк с тёплыми лампами
      const x0 = 2.0, x1 = 6.6, z1 = zF + 2.2, top = 3.6;
      { qv(bk, F, [[x0, top, zF], [x1, top, zF], [x1, top, z1], [x0, top, z1]], ALU, S.FLAT);
        bk.box(F, (x0 + x1) / 2, top + 0.15, (zF + z1 + 1.2) / 2, x1 - x0 + 0.6, 0.3, z1 - zF + 1.2, { col: ALU, cols: { ny: rgb('#C9A57A') } });
        const n0 = bk.n; qv(bk, F, [[x0, 0.05, z1], [x1, 0.05, z1], [x1, top, z1], [x0, top, z1]], rgb('#6E8A96'), S.FLAT); fxMark(bk, n0, 0.7, 0);
        [x0, (x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 0.9, x1].forEach(x => bk.box(F, x, top / 2, z1 + 0.03, 0.09, top, 0.09, { col: ALU }));
        [-1, 1].forEach(sd => { const x = sd > 0 ? x1 : x0; const n1 = bk.n; qv(bk, F, sd > 0 ? [[x, 0.05, z1], [x, 0.05, zF], [x, top, zF], [x, top, z1]] : [[x, 0.05, zF], [x, 0.05, z1], [x, top, z1], [x, top, zF]], rgb('#6A8692'), S.FLAT); fxMark(bk, n1, 0.5, 0); });
        [x0 + 1.0, (x0 + x1) / 2, x1 - 1.0].forEach(x => { const p = F.p(x, top - 0.02, z1 + 0.5); c.halos.push(p[0], p[1], p[2], 0.6); });
        // пасхалка: сова-хранительница музея комбината сидит на козырьке и смотрит на улицу
        if (EGG) { const q = F.p((x0 + x1) / 2 + 1.4, top + 0.3, z1 + 0.3); cameo(bk, new K.Frame(q[0], q[1], q[2], F.ry), 'owl'); } }
      // площадь: плиты, дорожка-«ковёр» от тротуара к тамбуру, газоны, ограда с проёмом, скамьи, фонари, деревья
      plaza(bk, -1, tf, mul(C('slab'), 1.03));
      { const yy = WALK_Y + 0.012, n = tf.n, a = F.p((x0 + x1) / 2 - 1.3, 0, z1 + 0.3), b = F.p((x0 + x1) / 2 + 1.3, 0, z1 + 0.3), ta = (-WALK - a[0]) / n[0], tb = (-WALK - b[0]) / n[0];
        const A2 = [a[0] + n[0] * ta, yy, a[2] + n[1] * ta], B2 = [b[0] + n[0] * tb, yy, b[2] + n[1] * tb];
        trd(bk, [a[0], yy, a[2]], [b[0], yy, b[2]], B2, rgb('#B0645A'), S.WASH, [0, 1, 0]); trd(bk, [a[0], yy, a[2]], B2, A2, rgb('#B0645A'), S.WASH, [0, 1, 0]);
        const gz0 = Math.max(A2[2], B2[2]) + 0.3, gz1 = Math.min(A2[2], B2[2]) - 0.3;
        fenceAlong(bk, -1, tf.N[1] + 0.6, tf.E[1] - 0.4, gz0, gz1, rgb('#3E4A56'), STONE);
        // газон у ближнего края, деревья и скамьи вдоль фасада
        const g = F.p(-W / 2 + 4, 0, zF + 2.5), g2 = F.p(-W / 2 + 0.6, 0, zF + 0.6), g3 = F.p(-W / 2 + 8, 0, zF + 0.6);
        trd(bk, [g[0], yy + 0.02, g[2]], [g2[0], yy + 0.02, g2[2]], [g3[0], yy + 0.02, g3[2]], WIN ? SNOW : mix(C('grass'), C('grass2'), 0.3), S.FLAT, [0, 1, 0]);
        [-W / 2 + 3, -3.5].forEach(lx => { const p = F.p(lx, 0, zF + 1.8); tree(bk, p[0], WALK_Y, p[2], 'round', 0.7, R); });
        [-5.5, -0.8].forEach(lx => { const p = F.p(lx, 0, zF + 1.4); bench(bk, p[0], p[2], tf.ry + PI); });
        [F.p(-W / 2 + 1.2, 0, zF + 5.0), F.p(0.5, 0, zF + 4.0)].forEach(p => { if (p[0] < -WALK) lampPost(bk, p[0], p[2], c.halos); }); }
      return { side: -1, z0: tf.zMax, z1: tf.zMin };
    }
    function bench(bk, x, z, ry) { const F = new K.Frame(x, WALK_Y, z, ry), wd = C('wood'), met = rgb('#3A3A40');
      bk.box(F, 0, 0.45, 0, 1.6, 0.06, 0.42, { col: wd }); bk.box(F, 0, 0.75, -0.2, 1.6, 0.3, 0.05, { col: wd });
      [-0.7, 0.7].forEach(lx => bk.box(F, lx, 0.22, 0, 0.06, 0.45, 0.4, { col: met })); }
    /* --- пасхалки в сегменте (роль EGGS, js/village/runner_eggs.js): жители-камео запекаются в сетку улицы (0 вызовов), наклейки
       (резные камни, тарелки в лавках, указатели, «10/10») — в сетку вывесок и ТОЛЬКО если она в сегменте уже есть: c.egg — список
       отложенных постановок, выполняется в конце сборки при bs.n > 0 (лишнего вызова отрисовки на сегмент без щитов нет) --- */
    const EGG = V.runnerEggs || null;
    const EH = { tube, bar, rgb, mul, mix, Frame: K.Frame, S, fx: (bk, n0, l, w) => fxMark(bk, n0, l, w) };
    let cameoWarn = false;
    const CAMEO_N = {};   // сколько жителей каждого вида запечено (стенд и заметки: seg.eggs)
    let TRACE = null;     // стенд пасхалок: [вид, x, y, z, поворот] — где стоят жители и наклейки (в игре null — ничего не копится)
    function cameo(bk, F, kind) { if (!EGG || !EGG.critter) return; CAMEO_N[kind] = (CAMEO_N[kind] || 0) + 1; if (TRACE) TRACE.push([kind, F.ox, F.oy, F.oz, F.ry]); try { EGG.critter(bk, F, kind, EH); } catch (e) { if (!cameoWarn) { cameoWarn = true; console.warn('runnerKit: cameo', kind, e); } } }
    // наклейка из атласа вывесок в рамке F лицом к локальному +z (центр x, y, z; размер w × h)
    function decal(bs, F, x, y, z, w, h, id) { const r = SIGN.rect[id]; if (!r) return; const col = [1.1, 1.1, 1.1]; if (TRACE) TRACE.push([id].concat(F.p(x, y, z), [F.ry]));
      bs.quad(F.p(x - w / 2, y - h / 2, z), F.p(x + w / 2, y - h / 2, z), F.p(x + w / 2, y + h / 2, z), F.p(x - w / 2, y + h / 2, z), col, S.FLAT, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]); }
    // тарелка — круг из веера треугольников (квадрат атласа дал бы тёмные углы на стене)
    function plateDecal(bs, F, x, y, z, rad, id) { const r = SIGN.rect[id]; if (!r) return; if (TRACE) TRACE.push([id].concat(F.p(x, y, z), [F.ry])); const cu = (r[0] + r[2]) / 2, cv = (r[1] + r[3]) / 2, ru = (r[2] - r[0]) / 2, rv = (r[3] - r[1]) / 2, n = 14, col = [1.1, 1.1, 1.1];
      for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
        bs.tri(F.p(x, y, z), F.p(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad, z), F.p(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad, z), col, S.FLAT, [[cu, cv], [cu + Math.cos(a0) * ru, cv + Math.sin(a0) * rv], [cu + Math.cos(a1) * ru, cv + Math.sin(a1) * rv]]); } }
    // указатель у лестницы между домами слева: столбик на тротуаре, доска лицом к набегающей героине, стрелка — к лестнице
    function signPost(bk, bs, z, i) {
      const x = -WALK + 0.32, F = new K.Frame(x, WALK_Y, z, 0), wd = C('woodD'), r = SIGN.rect['post' + i]; if (!r) return;
      const w = 1.0, h = w / r[4], y = 2.3;
      bk.cyl(x, WALK_Y, z, 0.05, 0.045, y + h / 2 + 0.1, { seg: 5, col: wd, cap: false });
      bk.box(F, 0.34, y, 0, w + 0.07, h + 0.07, 0.05, { col: wd });
      decal(bs, F, 0.34, y, 0.028, w, h, 'post' + i);
    }

    // школа (по schoolGeo села, проще): силикатный кирпич, терракотовые филёнки в нишах, ризалит с фронтоном, вальма, козырёк с красным
    // баннером, бордовые двери; справа, фасадом к набегающей героине, перед ней — асфальтовый двор, зелёная ограда, ворота с мячом
    function lmSchool(c) {
      const { bk, bs, gz, R } = c, WX = 10, D = 10, A = 0.6, y0 = WALK_Y + 0.6, tf = turnFrame(1, A, [6.8, -c.len + 6.4], 2 * WX, D, y0), F = tf.F;
      exclude(c, ['R1', 'R2', 'R3', 'R4', 'TR'], tf.zMax + 2, tf.zMin); c.approach.push([1, tf.zMax + 2, tf.zMax + 18]);
      const brick = WIN ? [0.69, 0.69, 0.695] : [0.8, 0.78, 0.765], brickL = mul(brick, 1.065), redP = [0.62, 0.42, 0.39], plinth = [0.93, 0.92, 0.89], white = rgb('#F3F3EF'), roofC = rgb('#918390'), dark = rgb('#3C3B42');
      const EAVE = 6.75, APEX = 8.94, RIDGE = 8.25, RX = 3.8, RZ = 0.5, AX = [5.05, 7.65], NW = 1.25, zf = 0;
      const rectZ = (x0, x1, ya, yb, z, col, s, back) => (back ? qv(bk, F, [[x1, ya, z], [x0, ya, z], [x0, yb, z], [x1, yb, z]], col, s) : qv(bk, F, [[x0, ya, z], [x1, ya, z], [x1, yb, z], [x0, yb, z]], col, s));
      rectZ(-WX, WX, 0, EAVE, -D, brick, S.WASH, true);
      rectZ(-WX - 0.03, WX + 0.03, -0.9, 0, 0.03, plinth, S.FLAT);
      [-1, 1].forEach(sd => {
        const xo = sd * WX;
        qv(bk, F, sd > 0 ? [[xo, -0.9, 0], [xo, -0.9, -D], [xo, EAVE, -D], [xo, EAVE, 0]] : [[xo, -0.9, -D], [xo, -0.9, 0], [xo, EAVE, 0], [xo, EAVE, -D]], brick, S.WASH);
        const ed = [RX]; AX.forEach(a => ed.push(a - NW / 2, a + NW / 2)); ed.push(WX);
        for (let k = 0; k < ed.length - 1; k += 2) { const xa = sd * ed[k], xb = sd * ed[k + 1]; rectZ(Math.min(xa, xb), Math.max(xa, xb), 0, 6.1, zf, brick, S.WASH); }
        rectZ(Math.min(sd * RX, xo), Math.max(sd * RX, xo), 6.1, EAVE, zf, brick, S.WASH);
        AX.forEach(a => { const xc = sd * a, x0 = xc - NW / 2, x1 = xc + NW / 2, z = -0.09;
          [[0, 0.88, redP], [0.88, 2.6, brick], [2.6, 4.25, redP], [4.25, 6.1, brick]].forEach(([ya, yb, cc]) => rectZ(x0, x1, ya, yb, z, cc, S.WASH));
          qv(bk, F, [[x0, 0, z], [x0, 0, 0], [x0, 6.1, 0], [x0, 6.1, z]], brickL, S.WASH); qv(bk, F, [[x1, 0, 0], [x1, 0, z], [x1, 6.1, z], [x1, 6.1, 0]], brickL, S.WASH);
          glass(gz, F, xc, 0.88 + 0.86, z + 0.03, 1.1, 1.72, 3, white, R() < 0.35 ? 1 : 0); glass(gz, F, xc, 4.25 + 0.83, z + 0.03, 1.1, 1.65, 3, white, R() < 0.35 ? 1 : 0); });
        [-2.8, -7.0].forEach(zz => [0.88, 4.25].forEach(yb => glass(gz, F, xo + sd * 0.03, yb + 0.83, zz, 1.1, 1.65, 3, white, R() < 0.3 ? 1 : 0, sd * PI / 2)));
      });
      rectZ(-RX, RX, 0, EAVE, RZ, brick, S.WASH);
      [-1, 1].forEach(sd => { const xa = sd * RX; qv(bk, F, sd > 0 ? [[xa, 0, 0], [xa, 0, RZ], [xa, EAVE, RZ], [xa, EAVE, 0]] : [[xa, 0, RZ], [xa, 0, 0], [xa, EAVE, 0], [xa, EAVE, RZ]], brickL, S.WASH);
        rectZ(Math.min(xa, sd * (RX - 0.4)), Math.max(xa, sd * (RX - 0.4)), 0, EAVE, RZ + 0.03, brickL, S.WASH); });
      bk.tri(F.p(-RX, EAVE, RZ), F.p(RX, EAVE, RZ), F.p(0, APEX, RZ), brick, S.WASH);
      glass(gz, F, 0, 7.8, RZ + 0.03, 0.42, 1.05, 1, white, 0);
      [-2.57, -1.03, 1.03, 2.57].forEach(x => glass(gz, F, x, 4.25 + 0.83, RZ + 0.03, 1.1, 1.65, 3, white, R() < 0.4 ? 1 : 0));
      [-2.62, 2.62].forEach(x => glass(gz, F, x, 0.95 + 0.83, RZ + 0.03, 1.1, 1.65, 3, white, R() < 0.4 ? 1 : 0));
      const T30 = Math.tan(PI / 6), T14 = Math.tan(14 * PI / 180), yA = APEX + 0.12, xE = RX + 0.35, yE = yA - xE * T30, zFr = RZ + 0.35, zB = -D - 0.45;
      const rqd = (pts, ex, ez, dir) => { const w = pts.map(q => F.p(...q)), uv = pts.map(q => [(q[0] * ex + q[2] * ez) / 1.33, (q[0] * ez - q[2] * ex) * 0.8 + q[1]]); const d = F.dir(dir[0], dir[2]);
        const e1 = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]], e2 = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]], ny = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (ny[0] * d[0] + ny[1] * dir[1] + ny[2] * d[1] < 0) bk.quad(w[3], w[2], w[1], w[0], roofC, S.ROOF, [uv[3], uv[2], uv[1], uv[0]]); else bk.quad(w[0], w[1], w[2], w[3], roofC, S.ROOF, uv); };
      [-1, 1].forEach(sd => { rqd([[sd * xE, yE, zFr], [0, yA, zFr], [0, yA, zB], [sd * xE, yE, zB]], 0, 1, [sd * 0.5, 0.87, 0]);
        qv(bk, F, sd > 0 ? [[0, yA - 0.18, zFr], [xE, yE - 0.18, zFr], [xE, yE, zFr], [0, yA, zFr]] : [[-xE, yE - 0.18, zFr], [0, yA - 0.18, zFr], [0, yA, zFr], [-xE, yE, zFr]], white, S.FLAT); });
      const yeE = EAVE - 0.45 * T14, zf2 = 0.45, zb2 = -D - 0.45, zr = -D / 2, xo2 = WX + 0.45, xr = xo2 - (D / 2 + 0.45);
      [-1, 1].forEach(sd => { const xi = sd * 3.9, xo = sd * xo2, xri = sd * 1.1, xro = sd * xr;
        rqd([[xi, yeE, zf2], [xo, yeE, zf2], [xro, RIDGE, zr], [xri, RIDGE, zr]], 1, 0, [0, 1, 0.25]);
        rqd([[xo, yeE, zb2], [xi, yeE, zb2], [xri, RIDGE, zr], [xro, RIDGE, zr]], 1, 0, [0, 1, -0.25]);
        const w = [[xo, yeE, zf2], [xo, yeE, zb2], [xro, RIDGE, zr]].map(q => F.p(...q)), dW = F.dir(sd, 0); trd(bk, w[0], w[1], w[2], mul(roofC, 0.96), S.ROOF, [dW[0], 1, dW[1]]);
        qv(bk, F, [[Math.min(xi, xo), yeE - 0.16, zf2 + 0.01], [Math.max(xi, xo), yeE - 0.16, zf2 + 0.01], [Math.max(xi, xo), yeE + 0.02, zf2 + 0.01], [Math.min(xi, xo), yeE + 0.02, zf2 + 0.01]], rgb('#3B3132'), S.FLAT); });
      bk.box(F, 0, -0.45, 1.55, 10.6, 0.9, 3.1, { col: rgb('#8E8880'), s: S.PLASTER, skip: { ny: 1, nz: 1 } });
      for (let k = 0; k < 4; k++) { const z = 3.1 + 0.32 * k, ya = -0.15 * (k + 1), yb = -0.15 * k; rectZ(-3.1, 3.1, ya, yb, z, rgb('#7E7870'), S.PLASTER); if (k < 3) qv(bk, F, [[-3.1, ya, z + 0.32], [3.1, ya, z + 0.32], [3.1, ya, z], [-3.1, ya, z]], rgb('#8A847C'), S.PLASTER); }
      const CY = 2.75; bk.box(F, 0, CY + 0.15, 1.5, 8, 0.3, 2.0, { col: rgb('#E0E2E4'), cols: { py: dark } });
      bk.box(F, 0, CY + 0.6, 2.46, 6.0, 0.62, 0.06, { col: rgb('#C4202F'), skip: { nz: 1 } });
      { const r = SIGN.rect.banner; signQuad(bs, F, 0, CY + 0.6, 2.5, Math.min(5.6, 0.5 * r[4]), 0.5, 'banner', 0.3); }
      [-2.65, 2.65].forEach(x => { const p = F.p(x, 0, 2.35); bk.cyl(p[0], y0, p[2], 0.08, 0.08, CY, { seg: 6, col: rgb('#6B1E24'), cap: false }); });
      [-1.05, 1.05].forEach(x => rectZ(x - 0.675, x + 0.675, 0, 2.55, RZ + 0.012, rgb('#5E1A1E'), S.FLAT));
      rectZ(6.15, 6.55, 2.3, 2.8, 0.012, rgb('#2A2A2E'), S.FLAT); signQuad(bs, F, 6.35, 2.55, 0.02, 0.7, 0.22, 'school', 0);
      [-1.05, 1.05].forEach(x => { const p = F.p(x, CY - 0.06, 1.3); const n0 = bk.n; bk.box(new K.Frame(p[0], p[1], p[2], 0), 0, 0, 0, 0.24, 0.05, 0.24, { col: rgb('#FFE2A8') }); fxMark(bk, n0, 1, 0); c.halos.push(p[0], p[1] - 0.1, p[2], 0.6); });
      // двор: асфальт, газоны у фасада, ограда с воротами, футбольные ворота, мяч, деревья, скамьи
      plaza(bk, 1, tf, rgb('#9A968E'));
      { const yy = WALK_Y + 0.02;
        [[-WX + 0.6, -RX - 1.2], [RX + 1.2, WX - 0.6]].forEach(([xa, xb]) => { const a = F.p(xa, -y0, 0.3), b = F.p(xb, -y0, 0.3), b2 = F.p(xb, -y0, 1.6), a2 = F.p(xa, -y0, 1.6);
          bk.quadF([a[0], yy, a[2]], [b[0], yy, b[2]], [b2[0], yy, b2[2]], [a2[0], yy, a2[2]], WIN ? SNOW : C('grass'), S.FLAT, [0, 1, 0]); });
        const fc = rgb('#3F7A4A'), gate = F.p(0, -y0, 6.0);
        fenceAlong(bk, 1, tf.N[1] + 0.6, tf.E[1] - 0.4, gate[2] + 2.2, gate[2] - 2.2, fc);
        const g = F.p(-WX + 3.2, -y0, 5.5), gd = F.dir(1, 0); [-1.5, 1.5].forEach(k => bar(bk, [g[0] + gd[0] * k, WALK_Y, g[2] + gd[1] * k], [g[0] + gd[0] * k, WALK_Y + 1.6, g[2] + gd[1] * k], 0.08, white)); bar(bk, [g[0] - gd[0] * 1.5, WALK_Y + 1.6, g[2] - gd[1] * 1.5], [g[0] + gd[0] * 1.5, WALK_Y + 1.6, g[2] + gd[1] * 1.5], 0.08, white);
        const bp = F.p(-WX + 5.6, -y0, 3.4); bk.sph(bp[0], WALK_Y + 0.12, bp[2], 0.12, 0.12, 0.12, p => (Math.sin(p[0] * 40) * Math.sin(p[2] * 40) > 0 ? [0.95, 0.95, 0.95] : [0.25, 0.25, 0.3]), { seg: 8, rings: 5 });
        [F.p(-WX + 0.5, -y0, 3.0), F.p(WX - 1.0, -y0, 2.6)].forEach(p => tree(bk, p[0], WALK_Y, p[2], 'round', 0.75, R));
        [F.p(-6.0, -y0, 2.6), F.p(6.4, -y0, 2.4)].forEach(p => bench(bk, p[0], p[2], tf.ry + PI)); }
      // пасхалка: школьники (зайчонок и котёнок с рюкзаками) у тротуара машут — уроки кончились
      if (EGG) { const zm = (tf.zMax + tf.zMin) / 2; cameo(bk, new K.Frame(WALK - 0.7, WALK_Y, zm + 0.5, -PI / 2 + 0.5), 'bunny'); cameo(bk, new K.Frame(WALK - 0.75, WALK_Y, zm - 0.3, -PI / 2 + 0.35), 'kitten'); }
      return { side: 1, z0: tf.zMax, z1: tf.zMin };
    }

    // кофейня «МАРХАРАЙ» (по cafeGeo/вывеске села): графитовый короб, витрины в пол, вывеска-лайтбокс; над ней — жилой этаж с
    // галереей; развёрнута к набегающей героине, перед ней — столики на площадке
    function lmCafe(c) {
      const { bk, bs, gz, R, halos } = c, W = 11.2, D = 6.6, H = 3.9, A = 0.6, tf = turnFrame(-1, A, [-6.4, -c.len + 4.6], W, D, WALK_Y), F = tf.Fc, gr = rgb('#3A3B40'), gr2 = rgb('#2A2B2E');
      exclude(c, ['L1', 'L2', 'TL'], tf.zMax + 1.5, tf.zMin); c.lampsOff.push([-1, tf.zMax + 1, tf.zMin]); c.approach.push([-1, tf.zMax + 1.5, tf.zMax + 16]);
      qv(bk, F, [[-W / 2, -0.4, D / 2], [W / 2, -0.4, D / 2], [W / 2, 0.35, D / 2], [-W / 2, 0.35, D / 2]], gr2, S.PLASTER);
      [-1, 1].forEach(sd => { const x = sd * W / 2; qv(bk, F, sd > 0 ? [[x, -0.4, D / 2], [x, -0.4, -D / 2], [x, H, -D / 2], [x, H, D / 2]] : [[x, -0.4, -D / 2], [x, -0.4, D / 2], [x, H, D / 2], [x, H, -D / 2]], gr, S.PLASTER); });
      qv(bk, F, [[W / 2, -0.4, -D / 2], [-W / 2, -0.4, -D / 2], [-W / 2, H, -D / 2], [W / 2, H, -D / 2]], gr, S.PLASTER);
      [[-W / 2 + 0.25, -1.9], [-1.6, 1.4], [1.9, W / 2 - 0.25]].forEach(([x0, x1], i) => { const n0 = bk.n; qv(bk, F, [[x0, 0.35, D / 2 - 0.02], [x1, 0.35, D / 2 - 0.02], [x1, H - 1.15, D / 2 - 0.02], [x0, H - 1.15, D / 2 - 0.02]], p => (p[1] > WALK_Y + 1.8 ? rgb('#7E7A6E') : rgb('#9A8A70')), S.FLAT); fxMark(bk, n0, 0.85, 0);
        if (i === 1) qv(bk, F, [[x0 + 0.3, 0.35, D / 2 - 0.01], [x1 - 0.3, 0.35, D / 2 - 0.01], [x1 - 0.3, 2.4, D / 2 - 0.01], [x0 + 0.3, 2.4, D / 2 - 0.01]], rgb('#6E6658'), S.FLAT); });
      [-W / 2 + 0.12, -1.9, -1.6, 1.4, 1.9, W / 2 - 0.12].forEach(x => bk.box(F, x, (H - 1.15 + 0.35) / 2, D / 2 + 0.02, 0.12, H - 1.5, 0.08, { col: gr2 }));
      bk.box(F, 0, H - 0.62, D / 2 + 0.06, W + 0.1, 1.16, 0.16, { col: gr2, skip: { nz: 1 } });
      signQuad(bs, F, 0, H - 0.62, D / 2 + 0.15, Math.min(W - 0.4, 1.0 * SIGN.rect.cafe[4]), 1.0, 'cafe', 0.9);
      const up = { x: 0, y0: 0, z: 0, w: W, d: D, h: H + 3.4, storeys: 3, wall: R() < 0.5 ? 'rubble' : 'blueFull', roof: 'flat', roofMat: 'yard', gallery: { storeys: [2], proj: 0.35, frame: 'frameWhite', g1: true }, nbL: -99, nbR: -99 };
      { const wl = wallLook(up.wall, R);
        qv(bk, F, [[-W / 2, H, D / 2], [W / 2, H, D / 2], [W / 2, up.h, D / 2], [-W / 2, up.h, D / 2]], wl.c, wl.s);
        [-1, 1].forEach(sd => { const x = sd * W / 2; qv(bk, F, sd > 0 ? [[x, H, D / 2], [x, H, -D / 2], [x, up.h, -D / 2], [x, up.h, D / 2]] : [[x, H, -D / 2], [x, H, D / 2], [x, up.h, D / 2], [x, up.h, -D / 2]], mul(wl.c, 0.95), wl.s); });
        qv(bk, F, [[W / 2, H, -D / 2], [-W / 2, H, -D / 2], [-W / 2, up.h, -D / 2], [W / 2, up.h, -D / 2]], mul(wl.c, 0.92), wl.s);
        galleryGeo(bk, gz, F, up, W, D, 2, R, wl); roofGeo(bk, F, up, W, D, up.h, R, { sideL: true, sideR: true, back: true, wall: wl }); }
      plaza(bk, -1, tf, mul(C('slab'), 0.98));
      for (let i = 0; i < 3; i++) { const p = F.p(-3.6 + i * 3.6, 0, D / 2 + 1.9), met = rgb('#2E2E33'), x = p[0], z = p[2];
        bk.cyl(x, WALK_Y, z, 0.04, 0.04, 0.72, { seg: 5, col: met, cap: false }); bk.cyl(x, WALK_Y + 0.72, z, 0.36, 0.36, 0.03, { seg: 10, col: rgb('#E8E2D6') });
        [-0.62, 0.62].forEach(dx => { const q = F.p(-3.6 + i * 3.6 + dx, 0, D / 2 + 1.9), F3 = new K.Frame(q[0], WALK_Y, q[2], tf.ry + (dx > 0 ? -PI / 2 : PI / 2)); bk.box(F3, 0, 0.45, 0, 0.4, 0.04, 0.4, { col: rgb('#B07A4A') }); bk.box(F3, 0, 0.7, 0.18, 0.4, 0.5, 0.04, { col: rgb('#B07A4A') }); [-0.17, 0.17].forEach(lx => bk.box(F3, lx, 0.22, 0, 0.03, 0.45, 0.36, { col: met, skip: { py: 1, ny: 1 } })); }); }
      [F.p(-W / 2 - 0.5, 0, D / 2 + 0.6), F.p(W / 2 + 0.5, 0, D / 2 + 0.6)].forEach(p => { bk.cyl(p[0], WALK_Y, p[2], 0.26, 0.3, 0.5, { seg: 6, col: gr2 }); tree(bk, p[0], WALK_Y + 0.5, p[2], 'round', 0.45, R); });
      wallLantern(bk, F, -W / 2 + 0.3, 2.6, D / 2 + 0.24, halos); wallLantern(bk, F, W / 2 - 0.3, 2.6, D / 2 + 0.24, halos);
      // пасхалка: лисичка-бариста вышла к двери и поднимает чашку (кофейня игры)
      if (EGG) { const q = F.p(2.75, 0, D / 2 + 0.8); cameo(bk, new K.Frame(q[0], q[1], q[2], F.ry), 'fox'); }
      return { side: -1, z0: tf.zMax, z1: tf.zMin };
    }

    // базарная площадь справа: мощёная площадка вровень с улицей, лавки под полосатыми навесами развёрнуты к набегающей героине,
    // столб с четырьмя фонарями (bazaar.js), ковры на верёвке, за площадью — старые дома с галереями и лавками
    function lmBazaar(c) {
      const { bk, R } = c, L2 = 13, xb = 22, zc = -c.len + L2 + 0.5;
      exclude(c, ['R1', 'R2', 'R3', 'TR'], zc + L2, zc - L2); c.approach.push([1, zc + L2, zc + L2 + 14]);
      c.roadX.push([6.6, xb, zc + L2, zc - L2]);
      const back = []; let z = zc + L2 - 0.2;
      while (z > zc - L2 + 3) { const w = Math.min(z - (zc - L2), 4.4 + R() * 3); back.push(houseSpec(R, null, 1, xb, z - w / 2, w, WALK_Y, R() < 0.5 ? 2 : 3, { foot: 0.6, shops: 0.6, gal: 0.7 })); z -= w + 0.05; }
      linkRow(back).forEach(h => { h.lantern = true; h.bs = c.bs; houseGeo(bk, c.gz, h, R, c.halos); });
      const ry = -(PI / 2 - 0.7);
      const stall = (x, z, cA, cB, ware) => { const F = new K.Frame(x, WALK_Y, z, ry), wd = C('wood');
        bk.box(F, 0, 0.45, 0, 2.4, 0.9, 1.0, { col: wd, cols: { py: C('woodD') }, skip: { ny: 1 } });
        [[-1.15, -0.45], [1.15, -0.45], [-1.15, 0.8], [1.15, 0.8]].forEach(([lx, lz]) => barF(bk, F, [lx, 0, lz], [lx, lz > 0 ? 2.15 : 2.45, lz], 0.06, C('woodD')));
        for (let i = 0; i < 6; i++) { const x0 = -1.3 + i * (2.6 / 6), x1 = x0 + 2.6 / 6; qv(bk, F, [[x0, 2.15, 1.05], [x1, 2.15, 1.05], [x1, 2.5, -0.55], [x0, 2.5, -0.55]], i % 2 ? cA : cB, S.FLAT); qv(bk, F, [[x1, 2.13, 1.05], [x0, 2.13, 1.05], [x0, 2.48, -0.55], [x1, 2.48, -0.55]], mul(i % 2 ? cA : cB, 0.75), S.FLAT); qv(bk, F, [[x0, 1.95, 1.08], [x1, 1.95, 1.08], [x1, 2.16, 1.06], [x0, 2.16, 1.06]], i % 2 ? cA : cB, S.FLAT); }
        for (let i = 0; i < 7; i++) { const p = F.p(-0.95 + i * 0.32, 0.98, 0.1 + (i % 2) * 0.2); bk.sph(p[0], p[1], p[2], 0.15, 0.1, 0.15, ware[i % ware.length], { seg: 5, rings: 3 }); }
        const q = F.p(0.6, 0, 1.4); bk.box(new K.Frame(q[0], WALK_Y, q[2], ry), 0, 0.2, 0, 0.6, 0.4, 0.45, { col: C('wood') }); bk.sph(q[0], WALK_Y + 0.45, q[2], 0.26, 0.1, 0.2, ware[0], { seg: 5, rings: 2 }); };
      stall(8.6, zc + 8.0, rgb('#C2405B'), rgb('#F4EEE2'), [rgb('#E0663A'), rgb('#F2B33D'), rgb('#C9405A')]);
      stall(11.8, zc + 2.4, rgb('#3F78B8'), rgb('#F4EEE2'), [rgb('#8E3A7A'), rgb('#6E9A3E'), rgb('#E8C770')]);
      stall(15.0, zc - 3.2, rgb('#2E8A6A'), rgb('#F4EEE2'), [rgb('#D9455A'), rgb('#F28C3A'), rgb('#F2C94C')]);
      stall(18.2, zc - 8.8, rgb('#E8A040'), rgb('#F4EEE2'), [rgb('#C9405A'), rgb('#8EB84A'), rgb('#F2B33D')]);
      lampPost(bk, 9.2, zc - 2.0, c.halos, 'four');
      // ковры на верёвке между двумя жердями поперёк площади (к набегающей — лицом)
      { const pa = [8.0, zc - 9.0], pb = [14.5, zc - 12.5], n0 = bk.n, pals = [['#8E2A2A', '#B8403A', '#F2C94C'], ['#1F4E8C', '#3F78B8', '#F4EEE2'], ['#6A2E4A', '#A04E6A', '#E8C770']].map(p => p.map(rgb));
        [pa, pb].forEach(p => bk.box(new K.Frame(p[0], 0, p[1], 0), 0, 1.45, 0, 0.09, 2.9, 0.09, { col: C('woodD') })); bar(bk, [pa[0], 2.85, pa[1]], [pb[0], 2.85, pb[1]], 0.03, rgb('#D8CFC0'));
        for (let i = 0; i < 3; i++) { const t0 = 0.08 + i * 0.31, t1 = t0 + 0.26, P = t => [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t)], A2 = P(t0), B2 = P(t1), pl = pals[i];
          [1, -1].forEach(sd => { const o = sd * 0.01, q = (p, y) => [p[0] + o, y, p[1] + o * 1.6]; bk.quadF(q(A2, 1.2), q(B2, 1.2), q(B2, 2.8), q(A2, 2.8), pl[0], S.FLAT, [0.45 * sd, 0, 0.9 * sd]);
            const mA = P(t0 + 0.04), mB = P(t1 - 0.04); bk.quadF(q(mA, 1.32), q(mB, 1.32), q(mB, 2.68), q(mA, 2.68), pl[1], S.FLAT, [0.45 * sd, 0.01, 0.9 * sd]); }); }
        fxMark(bk, n0, 0, 0.5); }
      [zc + 11, zc - 11.5].forEach(z => tree(bk, 20.0, WALK_Y, z, 'round', 0.85, R));
      bench(bk, 19.0, zc - 4.2, -PI / 2);
      return { side: 1, z0: zc + L2, z1: zc - L2 };
    }

    // свадебные ворота: стена двора с аркой, синие створки настежь, ковёр над аркой, флажки по гребню — развёрнуты к набегающей
    // героине; во дворе — дом с синими галереями; над улицей — гирлянды гуще
    function lmWedding(c) {
      const { bk, R } = c, W = 16, A = 0.6, yT = 2.8, gw = 2.6, gh = 3.2, tf = turnFrame(-1, A, [-6.2, -c.len + 7.6], W, 0.5, 0), F = tf.F, wc = [0.95, 0.93, 0.89];
      exclude(c, ['L1', 'L2', 'L3', 'TL'], tf.zMax + 1.5, tf.zMin - 6); c.approach.push([-1, tf.zMax + 1.5, tf.zMax + 15]);
      [[-W / 2, -gw / 2], [gw / 2, W / 2]].forEach(([xa, xb]) => bk.box(F, (xa + xb) / 2, (yT + 0.6) / 2 - 0.6, -0.25, xb - xa, yT + 0.6, 0.5, { col: wc, s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.1) }, ss: { py: S.SLAB } }));
      const seg = 10;
      for (let i = 0; i < seg; i++) { const a0 = PI * i / seg, a1 = PI * (i + 1) / seg, r = gw / 2, yc = gh - r;
        const p0 = [Math.cos(a0) * r, yc + Math.sin(a0) * r], p1 = [Math.cos(a1) * r, yc + Math.sin(a1) * r], top = yT + 0.9;
        qv(bk, F, [[p1[0], p1[1], 0.01], [p0[0], p0[1], 0.01], [p0[0], top, 0.01], [p1[0], top, 0.01]], wc, S.ASHLAR);
        const am = (a0 + a1) / 2; qvd(bk, F, [[p0[0], p0[1], 0.01], [p1[0], p1[1], 0.01], [p1[0], p1[1], -0.5], [p0[0], p0[1], -0.5]], mul(wc, 0.7), S.ASHLAR, [-Math.cos(am), -Math.sin(am), 0]); }
      bk.box(F, 0, yT + 1.0, -0.2, gw + 0.6, 0.2, 0.6, { col: mul(C('parapetCap'), 1.1) });
      [-1, 1].forEach(sd => { qv(bk, F, [[sd * gw / 2, 0, 0.0], [sd * (gw / 2 + 0.9), 0, -0.9], [sd * (gw / 2 + 0.9), 2.5, -0.9], [sd * gw / 2, 2.5, 0.0]], C('doorBlue'), S.FLAT);
        qv(bk, F, [[sd * (gw / 2 + 0.9), 0, -0.9], [sd * gw / 2, 0, 0.0], [sd * gw / 2, 2.5, 0.0], [sd * (gw / 2 + 0.9), 2.5, -0.9]], mul(C('doorBlue'), 0.8), S.FLAT); });
      { const n0 = bk.n, z0 = 0.06, cw = 2.2, ch = 1.1, yc = yT + 0.15;
        qv(bk, F, [[-cw / 2, yc - ch / 2, z0], [cw / 2, yc - ch / 2, z0], [cw / 2, yc + ch / 2, z0], [-cw / 2, yc + ch / 2, z0]], rgb('#8E2A2A'), S.FLAT);
        qv(bk, F, [[-cw / 2 + 0.12, yc - ch / 2 + 0.12, z0 + 0.005], [cw / 2 - 0.12, yc - ch / 2 + 0.12, z0 + 0.005], [cw / 2 - 0.12, yc + ch / 2 - 0.12, z0 + 0.005], [-cw / 2 + 0.12, yc + ch / 2 - 0.12, z0 + 0.005]], rgb('#B8403A'), S.FLAT);
        [-0.6, 0, 0.6].forEach((x, i) => { const r = 0.28, cc = rgb(['#F2C94C', '#1F4E8C', '#F2C94C'][i]); bk.quad(F.p(x, yc - r, z0 + 0.01), F.p(x + r * 0.7, yc, z0 + 0.01), F.p(x, yc + r, z0 + 0.01), F.p(x - r * 0.7, yc, z0 + 0.01), cc, S.FLAT); });
        fxMark(bk, n0, 0, 0.25); }
      { const n0 = bk.n; for (let x = -W / 2 + 0.3; x < W / 2; x += 0.6) { if (Math.abs(x) < gw / 2 + 0.3) continue; const cc = FLAGC[Math.floor(Math.abs(x * 3)) % FLAGC.length], y = yT + 0.02;
        bk.quad(F.p(x - 0.17, y, 0.02), F.p(x + 0.17, y, 0.02), F.p(x + 0.02, y - 0.36, 0.03), F.p(x - 0.02, y - 0.36, 0.03), cc, S.FLAT); bk.quad(F.p(x + 0.17, y, -0.02), F.p(x - 0.17, y, -0.02), F.p(x - 0.02, y - 0.36, -0.03), F.p(x + 0.02, y - 0.36, -0.03), mul(cc, 0.8), S.FLAT); } fxMark(bk, n0, 0, 1); }
      // двор за стеной и дом с синими галереями (тот же разворот), фонарики у ворот
      const n = tf.n, hc = [tf.C[0] - n[0] * 9.0, tf.C[1] - n[1] * 9.0];
      const hh = { x: hc[0], y0: WALK_Y, z: hc[1], ry: tf.ry, w: 13, d: 6, h: 3 * ST, storeys: 3, wall: 'blueFull', roof: 'flat', roofMat: 'yard', side: -1, blue: true, nbL: -99, nbR: -99, gallery: { storeys: [1, 2], proj: 0.45, frame: 'frameWhite', g1: true }, stair: true, lantern: true, glow: 0.5 };
      houseGeo(bk, c.gz, hh, R, c.halos);
      wallLantern(bk, F, -gw / 2 - 0.5, 2.3, 0.24, c.halos); wallLantern(bk, F, gw / 2 + 0.5, 2.3, 0.24, c.halos);
      c.garlands = (c.garlands || 0) + 3;
      return { side: -1, z0: tf.zMax, z1: tf.zMin };
    }

    // дом-мост над улицей: пилоны на тротуарах, пологий свод (над полосами ≥ 3,4 м, в середине 4,6), комната с синей галереей
    // на обе стороны, плоская крыша; свод — в seg.over (параплан и прыжки с крыши — ядру)
    function lmBridge(c) {
      const { bk, gz, R, zc } = c, dz = 2.3, yS = 3.4, yK = 4.6, yR = 8.4, xs = 4.35, stone = [0.92, 0.94, 0.88];
      c.lampsOff.push([-1, zc + 4, zc - 4], [1, zc + 4, zc - 4]);
      const Rr = (xs * xs + (yK - yS) * (yK - yS)) / (2 * (yK - yS)), yc = yK - Rr, arc = x => yc + Math.sqrt(Math.max(0, Rr * Rr - x * x)), N = 10;
      [zc + dz, zc - dz].forEach((z, fi) => {
        const dir = [0, 0, fi ? -1 : 1];
        for (let i = 0; i < N; i++) { const x0 = -xs + 2 * xs * i / N, x1 = -xs + 2 * xs * (i + 1) / N;
          bk.quadF([x0, arc(x0), z], [x1, arc(x1), z], [x1, yR, z], [x0, yR, z], stone, S.ASHLAR, dir);
          bk.quadF([x0, arc(x0) - 0.01, z + (fi ? -0.01 : 0.01)], [x1, arc(x1) - 0.01, z + (fi ? -0.01 : 0.01)], [x1, arc(x1) + 0.32, z + (fi ? -0.01 : 0.01)], [x0, arc(x0) + 0.32, z + (fi ? -0.01 : 0.01)], (i & 1) ? mul(stone, 0.93) : stone, S.ASHLAR, dir); }
        [-1, 1].forEach(sd => bk.quadF([sd * xs, -0.1, z], [sd * 6.8, -0.1, z], [sd * 6.8, yR, z], [sd * xs, yR, z], stone, S.ASHLAR, dir));
      });
      for (let i = 0; i < N; i++) { const x0 = -xs + 2 * xs * i / N, x1 = -xs + 2 * xs * (i + 1) / N; bk.quadF([x0, arc(x0), zc + dz], [x1, arc(x1), zc + dz], [x1, arc(x1), zc - dz], [x0, arc(x0), zc - dz], mul(stone, 0.66), S.RUBBLE, [0, -1, 0]); }
      [-1, 1].forEach(sd => bk.quadF([sd * xs, -0.1, zc + dz], [sd * xs, yS, zc + dz], [sd * xs, yS, zc - dz], [sd * xs, -0.1, zc - dz], mul(stone, 0.8), S.ASHLAR, [-sd, 0, 0]));
      // комната: галерея с обеих сторон (на подходе видна торцом к камере), крыша-двор
      const yg = 5.3, gh = 1.6, gwid = 6.4;
      [zc + dz + 0.03, zc - dz - 0.03].forEach((z, fi) => { const F = new K.Frame(0, 0, z, fi ? PI : 0);
        qv(bk, F, [[-gwid / 2, yg - 0.7, 0.01], [gwid / 2, yg - 0.7, 0.01], [gwid / 2, yg, 0.01], [-gwid / 2, yg, 0.01]], C('blue'), S.WASH);
        for (let i = 0; i < 7; i++) glass(gz, F, -gwid / 2 + (i + 0.5) * gwid / 7, yg + gh / 2, 0.02, gwid / 7, gh, 2, C('frameWhite'), R() < 0.7 ? 1 : 0);
        qv(bk, F, [[-gwid / 2 - 0.05, yg + gh, 0.02], [gwid / 2 + 0.05, yg + gh, 0.02], [gwid / 2 + 0.05, yg + gh + 0.12, 0.02], [-gwid / 2 - 0.05, yg + gh + 0.12, 0.02]], C('frameWhite'), S.FLAT); });
      bk.box(new K.Frame(0, 0, zc, 0), 0, yR + 0.05, 0, 13.6, 0.1, 2 * dz, { col: mul(C('yard'), 0.98), s: S.SLAB, skip: { ny: 1 } });
      [[0, dz - 0.15, 13.6, 0.3], [0, -dz + 0.15, 13.6, 0.3]].forEach(([x, z, w, d]) => bk.box(new K.Frame(0, 0, zc + z, 0), x, yR + 0.3, 0, w, 0.4, d, { col: [0.98, 0.98, 0.98], s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.12) } }));
      { const F = new K.Frame(0, 0, zc + dz + 0.05, 0); wallLantern(bk, F, -3.9, 3.0, 0.2, c.halos); wallLantern(bk, F, 3.9, 3.0, 0.2, c.halos); }
      c.over.push({ z0: zc + dz, z1: zc - dz, y0: yS, y1: yR + 0.5 });
      exclude(c, ['L1', 'R1'], zc + dz + 0.4, zc - dz - 0.4);
      return { side: 0, z0: zc + dz, z1: zc - dz };
    }
    const LM = { tower: lmTower, kombinat: lmKombinat, school: lmSchool, cafe: lmCafe, bazaar: lmBazaar, wedding: lmWedding, bridge: lmBridge, view: lmView };

    /* --- волна 2 (уровни): свадебный двор, музыканты, зимние сугробы, серпантин над облаками --- */
    // фигурка в национальном (музыканты, декор): черкеска с газырями, пояс с серебряной пряжкой, папаха; s — масштаб.
    // Статичная, в общей сетке улицы; ветер (aFx.y) слегка качает — «играют, пританцовывая»
    function folkFigure(bk, x, z, ry, s, coat, hat, R) {
      const F = new K.Frame(x, WALK_Y, z, ry), n0 = bk.n, skin = rgb('#F2D2BC'), boot = rgb('#2E2A2C');
      [-0.1, 0.1].forEach(lx => bk.box(F, lx * s, 0.4 * s, 0, 0.13 * s, 0.8 * s, 0.15 * s, { col: boot }));
      bk.cyl(...F.p(0, 0.55 * s, 0), 0.3 * s, 0.2 * s, 0.9 * s, { seg: 8, col: coat, cap: false });   // полы черкески
      bk.cyl(...F.p(0, 1.05 * s, 0), 0.2 * s, 0.17 * s, 0.42 * s, { seg: 8, col: coat });
      [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) { const q = F.p(sd * 0.1 * s, (1.18 + i * 0.06) * s, 0.17 * s); bk.cyl(q[0], q[1], q[2], 0.012 * s, 0.012 * s, 0.07 * s, { seg: 4, col: rgb('#E8E2D2'), cap: false }); } });   // газыри
      bk.box(F, 0, 1.06 * s, 0.01, 0.42 * s, 0.05 * s, 0.4 * s, { col: rgb('#3A2A22') }); bk.box(F, 0, 1.06 * s, 0.2 * s, 0.09 * s, 0.07 * s, 0.03 * s, { col: C('silverWare') });   // пояс, пряжка
      bk.sph(...F.p(0, 1.62 * s, 0), 0.12 * s, 0.14 * s, 0.12 * s, skin, { seg: 7, rings: 5 });
      bk.cyl(...F.p(0, 1.68 * s, 0), 0.14 * s, 0.15 * s, 0.17 * s, { seg: 8, col: hat });   // папаха
      fxMark(bk, n0, 0, 0.35);
      return F;
    }
    // музыканты: барабанщик с большим барабаном и двое с дудочками (зурна) — на тротуаре слева, лицом к улице и чуть к героине
    function musicians(bk, zc, R) {
      const coats = [rgb('#3E3A44'), rgb('#5A3A34'), rgb('#2F3A4E')], hats = [rgb('#F4F0E8'), rgb('#2A2624'), rgb('#6A5A4A')], ry = PI / 2 + 0.45;
      [-1.2, 0, 1.2].forEach((dz, i) => {
        const F = folkFigure(bk, -5.0 - (i === 1 ? 0.25 : 0), zc + dz, ry, 1, coats[i], hats[(i + Math.floor(R() * 3)) % 3], R), n0 = bk.n;
        if (i === 1) { const q = F.p(0, 1.05, 0.32); bk.cyl(q[0], q[1] - 0.24, q[2], 0.3, 0.3, 0.48, { seg: 12, col: p => (p[1] > q[1] + 0.2 || p[1] < q[1] - 0.2 ? rgb('#B8403A') : rgb('#F2E8D4')) }); }   // барабан (кожа и красный обод)
        else { const a = F.p(0.02, 1.58, 0.14), b = F.p(0.02, 1.22, 0.62); tube(bk, a, b, 0.025, 6, rgb('#8A5A2E'), { r1: 0.07, cap: true }); }   // дудочка
        fxMark(bk, n0, 0, 0.35);
      });
    }
    // свадебный двор справа (в просвете между домами): плиты вровень с тротуаром, низкая стенка, длинный стол под белой скатертью с
    // фруктами и лепёшками, скамьи, над ним — нитка лампочек на двух шестах; за двором — обрыв к нижним рядам (подпорная стенка)
    function feastYard(bk, z0, z1, R, halos) {
      const xa = WALK + 0.05, xb = 11.0, y = WALK_Y, cl = rgb('#F6F2EA'), wd = C('wood');
      bk.quadF([xa, y, z0], [xb, y, z0], [xb, y, z1], [xa, y, z1], p => mul(C('slab'), 0.94 + 0.06 * Math.sin(p[0] * 1.7 + p[2] * 0.9)), S.SLAB, [0, 1, 0]);
      retain(bk, xb, -4.0, y, z0, z1, 1);
      bk.box(new K.Frame(xa + 0.2, 0, (z0 + z1) / 2, 0), 0, 0.25, 0, 0.35, 0.5, Math.abs(z0 - z1) - 0.4, { col: [0.95, 0.94, 0.9], s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.1) }, ss: { py: S.SLAB } });
      const L = Math.abs(z0 - z1) - 2.2, zc = (z0 + z1) / 2, tx = 8.0, F = new K.Frame(tx, y, zc, 0);
      bk.box(F, 0, 0.74, 0, 1.1, 0.06, L, { col: cl }); bk.box(F, 0, 0.55, 0, 1.14, 0.36, L + 0.04, { col: mul(cl, 0.93), skip: { py: 1, ny: 1 } });
      [-1, 1].forEach(sd => bk.box(F, sd * 0.95, 0.42, 0, 0.32, 0.08, L, { col: wd, cols: { py: mul(wd, 1.08) } }));
      const fr = [rgb('#D9455A'), rgb('#F2B33D'), rgb('#8EB84A'), rgb('#8E3A7A')];
      for (let z = -L / 2 + 0.6; z < L / 2 - 0.4; z += 0.9) { const q = F.p(0, 0.78, z); if (R() < 0.5) { bk.cyl(q[0], q[1], q[2], 0.17, 0.17, 0.02, { seg: 8, col: C('silverWare') }); for (let k2 = 0; k2 < 4; k2++) bk.sph(q[0] + (k2 % 2 - 0.5) * 0.12, q[1] + 0.07, q[2] + (k2 > 1 ? 0.06 : -0.06), 0.06, 0.05, 0.06, fr[(k2 + Math.floor(R() * 4)) % 4], { seg: 5, rings: 3 }); } else bk.cyl(q[0], q[1], q[2], 0.16, 0.15, 0.05, { seg: 8, col: rgb('#D8A860') }); }
      // нитка лампочек вдоль стола
      const pa = [tx, WALK_Y + 3.3, z0 - 0.6], pb = [tx, WALK_Y + 3.3, z1 + 0.6];
      [pa, pb].forEach(p => bk.cyl(p[0], WALK_Y, p[2], 0.05, 0.05, 3.3, { seg: 5, col: C('woodD'), cap: false }));
      bar(bk, pa, pb, 0.02, rgb('#3A3A40'));
      for (let i = 1; i < 10; i++) { const t = i / 10, x = tx, yy = WALK_Y + 3.3 - Math.sin(t * PI) * 0.45, z = lerp(pa[2], pb[2], t), n0 = bk.n; bk.sph(x, yy - 0.08, z, 0.07, 0.09, 0.07, rgb(i % 3 ? '#FFE2A0' : '#FFC6A0'), { seg: 4, rings: 2 }); fxMark(bk, n0, 1, 0); if (i % 2) halos.push(x, yy - 0.08, z, 0.45); }
    }
    // зима: мягкие сугробы у бордюров и на тротуарах, изредка — снеговик у стены
    function snowDrifts(bk, len, R) {
      const sn = rgb('#F4F7FB');
      [-1, 1].forEach(sd => { for (let z = -1 - R() * 3; z > -len + 1; z -= 3 + R() * 4) { const r = 0.5 + R() * 0.7; bk.sph(sd * (4.5 + R() * 0.7), WALK_Y - 0.05, z, r, 0.22 + R() * 0.18, r * (1.2 + R() * 0.8), sn, { seg: 7, rings: 3, cut: 0 }); } });
      if (R() < 0.55) { const x = (R() < 0.5 ? -1 : 1) * 5.15, z = -len * (0.2 + R() * 0.6);
        bk.sph(x, WALK_Y + 0.3, z, 0.34, 0.32, 0.34, sn, { seg: 8, rings: 5 }); bk.sph(x, WALK_Y + 0.78, z, 0.24, 0.23, 0.24, sn, { seg: 8, rings: 5 }); bk.sph(x, WALK_Y + 1.12, z, 0.16, 0.16, 0.16, sn, { seg: 7, rings: 4 });
        tube(bk, [x, WALK_Y + 1.12, z], [x - Math.sign(x) * 0.22, WALK_Y + 1.1, z], 0.035, 5, rgb('#F08A2E'), { r1: 0.005 }); bk.cyl(x, WALK_Y + 1.24, z, 0.13, 0.12, 0.14, { seg: 7, col: rgb('#C2405B') }); }
    }
    // смотровая площадка над обрывом справа (серпантин): дощатый настил на консолях, перила, скамья, подзорная труба, доска
    // «Смотровая» — как на дороге к селу в игре
    function lmView(c) {
      const { bk, bs, zc } = c, x0 = 5.2, x1 = 9.2, z0 = zc + 3.2, z1 = zc - 3.2, y = 0.05, wd = C('wood'), wdD = C('woodD');
      for (let i = 0; i < 8; i++) { const za = lerp(z0, z1, i / 8), zb = lerp(z0, z1, (i + 1) / 8) + 0.03; bk.quadF([x0, y + 0.08, za], [x1, y + 0.08, za], [x1, y + 0.08, zb], [x0, y + 0.08, zb], mul(wd, 0.92 + (i % 2) * 0.1), S.FLAT, [0, 1, 0]); }
      bk.box(new K.Frame((x0 + x1) / 2, 0, zc, 0), 0, y - 0.1, 0, x1 - x0, 0.2, z0 - z1, { col: wdD, skip: { py: 1 } });
      [[x1 - 0.2, z0 - 0.2], [x1 - 0.2, z1 + 0.2], [x0 + 1.6, z0 - 0.2], [x0 + 1.6, z1 + 0.2]].forEach(([x, z]) => bar(bk, [x, y, z], [x - 1.4, -5.5, z], 0.14, wdD));   // консоли в скалу
      const rail = (A, B) => { bar(bk, [A[0], 1.0, A[1]], [B[0], 1.0, B[1]], 0.06, wd); const n = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.8)); for (let i = 0; i <= n; i++) { const x = lerp(A[0], B[0], i / n), z = lerp(A[1], B[1], i / n); bar(bk, [x, y + 0.08, z], [x, 1.02, z], 0.05, wdD); } };
      rail([x0 + 0.1, z0], [x1, z0]); rail([x1, z0], [x1, z1]); rail([x1, z1], [x0 + 0.1, z1]);
      bench(bk, x1 - 0.7, zc + 1.1, -PI / 2);
      { const tx = x1 - 0.6, tz = zc - 1.4, met = rgb('#4A6A8A'); bk.cyl(tx, y + 0.08, tz, 0.05, 0.05, 1.1, { seg: 6, col: rgb('#3A3A40'), cap: false }); tube(bk, [tx - 0.25, 1.32, tz], [tx + 0.3, 1.42, tz], 0.09, 8, met, { r1: 0.11 }); }
      { const px = x0 + 0.5, pz = z0 + 0.6, r = SIGN.rect.view; bk.cyl(px, 0, pz, 0.05, 0.05, 2.1, { seg: 5, col: wdD, cap: false }); if (r) { const F = new K.Frame(px, 0, pz, -0.5), w = 1.4, h = w / r[4]; signQuad(bs, F, 0, 2.2, 0.04, w, h, 'view', 0); signQuad(bs, new K.Frame(px, 0, pz, PI - 0.5), 0, 2.2, 0.04, w, h, 'view', 0); } }
      return { side: 1, z0, z1 };
    }
    // СЕРПАНТИН НАД ОБЛАКАМИ (тема 'serp'): вместо улицы — горная дорога. Слева скальная стенка (выщербленный камень, наверху
    // зелёные террасы и кусты; изредка щит «Осторожно, камушки»), справа — бровка со столбиками и низким парапетом, за ней обрыв
    // и море облаков внизу. Без домов, фонарей и гирлянд — 2–3 сетки и меньше треугольников, чем у улицы. Рельеф — периодический
    // с шагом 20 м (длины сегментов кратны 20): стыки сегментов без ступенек
    function* serpSteps(th, len, R, lmId, opts) {
      const bk = new K.Baker('atlas'), bs = new K.Baker('atlas'), halos = [];
      const c = { bk, bo: null, bs, gz: [], halos, R, len, ex: {}, lampsOff: [], over: [], roadX: [], garlands: 0, garZ: [], approach: [], zc: -len / 2 };
      if (lmId && LM[lmId]) { c.lmInfo = LM[lmId](c) || null; yield 1; }
      const w = (z, k) => 0.22 * Math.sin(z * TAU / 20 * 3 + k * 1.3) + 0.12 * Math.sin(z * TAU / 10 + k * 2.1) + 0.06 * Math.sin(z * TAU / 4 + k);
      const rockC = (p, k) => { const t = 0.5 + 0.5 * Math.sin(p[2] * TAU / 20 * 2 + p[1] * 0.9 + k), u = 0.5 + 0.5 * Math.sin(p[2] * TAU / 5 + p[1] * 2.3); return mul(mix(rgb('#9C9082'), rgb('#7C7268'), t), 0.9 + 0.16 * u); };
      // 1. скальная стенка слева: профиль (x, y) снизу вверх, выщербины — периодическим шумом; наверху — уступ травы
      const PX = [-4.7, -4.95, -5.35, -5.85, -6.4, -7.3, -12.0], PY = [-0.05, 1.4, 3.1, 4.9, 6.6, 7.7, 8.0], dz = 2.5, nz = Math.round(len / dz);
      for (let j = 0; j < nz; j++) { const za = -j * dz, zb = -(j + 1) * dz;
        for (let k = 0; k < PX.length - 1; k++) { const A = [PX[k] - (k ? w(za, k) : 0), PY[k], za], B = [PX[k] - (k ? w(zb, k) : 0), PY[k], zb], C2 = [PX[k + 1] - w(zb, k + 1), PY[k + 1], zb], D = [PX[k + 1] - w(za, k + 1), PY[k + 1], za];
          bk.quadF(A, B, C2, D, k === PX.length - 2 ? (p => mix(C('grass'), C('grass2'), 0.4)) : (p => rockC(p, k)), k === PX.length - 2 ? S.FLAT : S.RUBBLE, [1, 0.2, 0]); } }
      yield 2;
      // обочина слева (щебень и канавка), справа — бровка
      bk.quadF([-4.0, 0.01, 0], [-4.75, -0.05, 0], [-4.75, -0.05, -len], [-4.0, 0.01, -len], rgb('#8E877C'), S.FLAT, [0, 1, 0]);
      bk.quadF([4.0, 0.01, 0], [5.3, 0.0, 0], [5.3, 0.0, -len], [4.0, 0.01, -len], rgb('#948C80'), S.FLAT, [0, 1, 0]);
      // 2. террасы над стенкой (вверх, к −x) и кусты
      for (let z = 0; z > -len + 0.01; z -= 20) { const z1 = Math.max(-len, z - 20); for (let k = 0; k < 8; k++) { const xOut = -12 - 6.4 * k, yT = 8.0 + 2.6 * (k + 1); terraceStep(bk, xOut - 5.2, xOut, yT, yT - 2.6, z, z1, k + 3, 1); } }
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) { const z = -R() * len, x = -6.2 - R() * 5, yy = x < -7.2 ? 7.9 : 5 + R() * 2; bk.sph(x, yy, z, 0.6 + R() * 0.5, 0.45, 0.6 + R() * 0.4, (p, ny) => mul(C('leafB'), 0.75 + 0.3 * Math.max(0, ny)), { seg: 6, rings: 3 }); }
      yield 3;
      // 3. справа: столбики (белые с красной полосой) каждые 5 м, местами низкий каменный парапет; обрыв вниз и облака
      for (let z = -2.5; z > -len; z -= 5) { const F = new K.Frame(4.85, 0, z, 0); bk.box(F, 0, 0.42, 0, 0.18, 0.84, 0.18, { col: [0.96, 0.96, 0.95], skip: { ny: 1 } }); bk.box(F, 0, 0.62, 0, 0.19, 0.16, 0.19, { col: rgb('#C2403A'), skip: { ny: 1, py: 1 } }); }
      if (R() < 0.6) { const za = -R() * len * 0.4, zb = za - 6 - R() * 8; bk.box(new K.Frame(5.15, 0, (za + zb) / 2, 0), 0, 0.28, 0, 0.36, 0.56, za - zb, { col: [0.94, 0.93, 0.89], s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.1) }, ss: { py: S.SLAB } }); }
      const CX = [5.3, 5.8, 7.4, 10.4, 14.6, 20.5, 28.0], CY = [0.0, -0.6, -4.2, -10.5, -17.5, -23.5, -27.0];
      for (let j = 0; j < nz; j++) { const za = -j * dz, zb = -(j + 1) * dz;
        for (let k = 0; k < CX.length - 1; k++) { const A = [CX[k] + (k ? w(za, k + 7) * 1.5 : 0), CY[k], za], B = [CX[k] + (k ? w(zb, k + 7) * 1.5 : 0), CY[k], zb], C2 = [CX[k + 1] + w(zb, k + 8) * 1.5, CY[k + 1], zb], D = [CX[k + 1] + w(za, k + 8) * 1.5, CY[k + 1], za];
          bk.quadF(A, B, C2, D, k === 0 ? rgb('#8E8678') : (p => (k % 2 ? mix(rockC(p, k), C('grass2'), 0.35) : rockC(p, k + 3))), k === 0 ? S.FLAT : S.RUBBLE, [1, 0.6, 0]); } }
      yield 4;
      // море облаков: пухлые приплюснутые клубы ниже обрыва (на свету — белые, снизу голубоватые); туман делает их дымкой
      const cloudC = (p, ny) => mix(rgb('#C4D2E4'), rgb('#FFFFFF'), clamp(ny * 0.8 + 0.4, 0, 1));
      for (let i = 0, n = HI ? 14 : 10; i < n; i++) { const x = 12 + R() * 60, z = -R() * len, r = 4 + R() * 6; bk.sph(x, -24 + R() * 3, z, r, r * 0.38, r * (0.8 + R() * 0.5), cloudC, { seg: 8, rings: 4 }); }
      yield 5;
      // щит «Осторожно, камушки» на столбике у стенки (как у дороги к селу) — лицом к набегающей
      if (R() < 0.45) { const z = -len * (0.3 + R() * 0.4), r = SIGN.rect.pebbles; bk.cyl(-4.55, 0, z, 0.05, 0.05, 2.3, { seg: 5, col: rgb('#5A5A60'), cap: false }); if (r) { const F = new K.Frame(-4.55, 0, z, 0.25), hh = 1.05; signQuad(bs, F, 0, 2.2 + hh / 2 - 0.4, 0.05, hh * r[4], hh, 'pebbles', 0); } }
      // сетки
      const group = new T.Group(); group.name = 'runner:seg:' + th.id + (lmId ? ':' + lmId : '');
      const meshes = [], add = m => { if (m) { group.add(m); meshes.push(m); } return m; };
      add(roadGeo(len, [], [], 'a')); yield 6;
      add(meshOf(bk, matA, { name: 'street' })); yield 7;
      add(meshOf(bs, matSign, { name: 'signs' }));
      let tris = 0; meshes.forEach(m => { const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
      const seg = { group, len, theme: th.id, landmark: lmId || null, lm: c.lmInfo || null, over: c.over, garlands: [], overhead: null, meshes, tris, calls: meshes.length, buildMs: 0, key: '', live: false, used: 0 };
      seg.release = () => releaseSeg(seg);
      lodOf(seg, meshes.filter(m => m.name === 'signs'));
      return seg;
    }

    /* =================================================================
       6. СЕГМЕНТ: сборка, ряды, рельеф; пул и вытеснение
       ================================================================= */
    const now = () => (window.performance || Date).now();
    // постройка — генератор: шаги (ориентир, ряды, рельеф, сетки) отдаются по yield. Синхронно (buildSegment) — все шаги подряд;
    // в фоне (tick → bgStep) — по нескольку шагов за кадр, пока не выйдет ~3 мс: сегмент «про запас» строится без рывка
    function buildSegment(th, len, R, lmId, opts) { const t0 = now(), g = segSteps(th, len, R, lmId, opts); let r = g.next(); while (!r.done) r = g.next(); r.value.buildMs = now() - t0; return r.value; }
    function* segSteps(th, len, R, lmId, opts) {
      if (th.kind === 'road') return yield* serpSteps(th, len, R, lmId, opts);
      const bk = new K.Baker('atlas'), bo = new K.Baker('atlas'), bs = new K.Baker('atlas'), gz = [], halos = [];
      const c = { bk, bo, bs, gz, halos, R, len, ex: {}, lampsOff: [], over: [], roadX: [], garlands: 0, garZ: [], approach: [], zc: -len / 2, egg: [], cameo: 0, carved: 0, cn0: Object.assign({}, CAMEO_N) };
      const glow = th.id === 'night' ? 0.55 : 0.4;
      if (lmId && LM[lmId]) { c.lmInfo = LM[lmId](c) || null; yield 1; }
      // подход к ориентиру: на его стороне первый ряд домов убран (иначе вертикальная камера видит ориентир только поверх крыш) —
      // низкая садовая стенка с деревьями (слева, за ней видны верхние ряды) или парапет с видом на долину (справа)
      c.approach.forEach(([sd, za0, zb0]) => { const za = Math.min(-0.2, Math.max(za0, zb0)), zb = Math.max(-len + 0.2, Math.min(za0, zb0)); if (za - zb < 2) return;
        exclude(c, [sd < 0 ? 'L1' : 'R1'], za, zb);
        if (sd > 0) { parapet(bk, za, zb, R); bench(bk, WALK - 0.55, (za + zb) / 2, -PI / 2); return; }
        const xw = -WALK - 0.2; bk.box(new K.Frame(xw, 0, (za + zb) / 2, 0), 0, 0.35, 0, 0.4, 0.9, za - zb, { col: [0.95, 0.94, 0.9], s: S.RUBBLE, cols: { py: mul(C('parapetCap'), 1.1) }, ss: { py: S.SLAB } });
        for (let z = za - 2.5; z > zb + 1; z -= 5 + R() * 2) tree(bk, -8.6 - R() * 2, WALK_Y, z, R() < 0.3 ? 'poplar' : 'round', 0.8 + R() * 0.25, R);
        bench(bk, -WALK + 0.55, (za + zb) / 2, PI / 2); });
      const free = (key, a, b) => {   // свободные промежутки ряда [a > b] за вычетом исключений ориентиров
        let segs = [[a, b]]; (c.ex[key] || []).forEach(([e0, e1]) => { const out = []; segs.forEach(([s0, s1]) => { if (e1 >= s0 || e0 <= s1) { out.push([s0, s1]); return; } if (e0 < s0) out.push([s0, e0]); if (e1 > s1) out.push([e1, s1]); }); segs = out; });
        return segs.filter(([s0, s1]) => s0 - s1 > 2.5);
      };
      // --- ряд вдоль улицы слева (склон вверх): 2–3 этажа, проходы-лестницы к верхнему ряду ---
      { const list = [];
        free('L1', -0.15, -len + 0.15).forEach(([a, b]) => { let z = a;
          while (z - b > 3.2) {
            if (list.length && R() < 0.14 && z - b > 7) { const gw = 1.6 + R() * 0.6; stairLane(bk, z - 0.02, z - gw + 0.02, LEFT_ROWS[0].y0, R);
              if (EGG && R() < 0.5) { const zp = z - gw / 2, pi = Math.floor(R() * 4); c.egg.push(() => signPost(bk, bs, zp, pi)); }   // пасхалка: указатель
              z -= gw; continue; }
            let w = 4 + R() * 3.6; if (z - w - b < 3.2) w = z - b;
            list.push(houseSpec(R, th, -1, WALK + R() * 0.35, z - w / 2, w - 0.04, WALK_Y, R() < 0.2 ? 1 : R() < 0.8 ? 2 : 3, { shops: th.shops * 0.6, glow }));
            z -= w;
          } });
        let k = 0; for (const h of linkRow(list)) { if (th.carpet && h.storeys > 1 && R() < th.carpet) h.carpet = true; h.bs = bs; h.eg = EGG ? c : null; houseGeo(bk, gz, h, R, halos); if (h.carpet) carpetOnWall(bk, h, R); if (++k % 3 === 0) yield 2; } }
      yield 2;
      // --- ряд вдоль улицы справа (склон вниз): 1–2 этажа, просветы с парапетом — вид на долину и каскад крыш ---
      { const list = [];
        free('R1', -0.15, -len + 0.15).forEach(([a, b]) => { let z = a;
          while (z - b > 2.5) {
            if (R() < th.open) { let gw = Math.min(z - b, 4 + R() * 8); if (z - gw - b < 2.5) gw = z - b;
              // свадьба: в просвете — двор с длинным столом под лампочками (вместо парапета с видом)
              if (th.feast && gw > 6 && R() < th.feast) { feastYard(bk, z, z - gw, R, halos); z -= gw; continue; }
              // школа: в просвете — школьный двор за зелёной оградой (вместо парапета с видом)
              if (th.fence && gw > 4 && R() < th.fence) { schoolYard(bk, z, z - gw, R); z -= gw; continue; }
              parapet(bk, z, z - gw, R);
              // базар: ковры сушатся на парапете (яркие пятна у края улицы)
              if (th.rugs && gw > 3 && R() < th.rugs) rugsOnParapet(bk, z, z - gw, R);
              if (gw > 5 && R() < 0.5) { const zb = z - gw / 2; bench(bk, WALK - 0.55, zb, -PI / 2);
                // пасхалка: бабушка-ежиха с медным кувшином отдыхает на скамье (житель игры)
                if (EGG && c.cameo < 1 && R() < 0.4) { c.cameo++; cameo(bk, new K.Frame(WALK - 0.6, WALK_Y + 0.46, zb + 0.35, -PI / 2), 'hedgehog'); } }
              z -= gw; continue; }
            let w = 4 + R() * 3.4; if (z - w - b < 3) w = z - b;
            list.push(houseSpec(R, th, 1, WALK + R() * 0.3, z - w / 2, w - 0.04, WALK_Y, th.id === 'masters' && R() < 0.25 ? 3 : R() < 0.5 ? 1 : 2, { shops: th.shops, glow, foot: 4.6 }));
            z -= w;
          } });
        let k = 0; for (const h of linkRow(list)) { h.bs = bs; h.eg = EGG ? c : null; houseGeo(bk, gz, h, R, halos); if (th.carpet && h.storeys > 1 && R() < th.carpet * 0.6) carpetOnWall(bk, h, R); if (++k % 3 === 0) yield 3; } }
      yield 3;
      // --- верхние ряды слева и нижние справа (упрощённые дома: без дверей, окна на фасаде; нижние смотрят в долину) ---
      const backRow = function* (key, side, xa, y0, st, o) { const list = [];
        free(key, -0.1, -len + 0.1).forEach(([a, b]) => { let z = a - R() * 1.2;
          while (z - b > 3.5) { let w = 4 + R() * 3.2; if (z - w - b < 3.5) w = z - b;
            const h = houseSpec(R, th, -1, Math.abs(xa), z - w / 2, w - 0.04, y0, st[0] + (R() < 0.5 ? 0 : st[1] - st[0]), Object.assign({ lod: true, glow, flat: 0.6, gal: 0.5 }, o));
            if (side > 0) h.x = xa + h.d / 2;
            list.push(h); z -= w + (R() < 0.3 ? 0.8 + R() * 2 : 0); } });
        let k = 0; for (const h of linkRow(list)) { houseGeo(bk, gz, h, R, halos); if (++k % 4 === 0) yield 4; } };
      yield* backRow('L2', -1, -LEFT_ROWS[0].xa, LEFT_ROWS[0].y0, [2, 3], { foot: 4.0 }); yield 4;
      yield* backRow('L3', -1, -LEFT_ROWS[1].xa, LEFT_ROWS[1].y0, [2, 3], { foot: 4.0 }); yield 5;
      for (let i = 0; i < RIGHT_ROWS.length; i++) { const rw = RIGHT_ROWS[i]; yield* backRow('R' + (i + 2), 1, rw.xa, rw.y0, rw.st, { backWin: true, yardLife: true, foot: 2.6, flat: 0.7 }); yield 6 + i; }
      terrainGeo(c, len); yield 9;
      // деревья: тополя между нижними рядами и за верхним, рыжие кроны на уступах
      for (let i = 0, n = 1 + Math.floor(R() * 2.5); i < n; i++) tree(bk, 20.0 + R() * 0.3, -4.0, -R() * len, 'poplar', 0.9 + R() * 0.3, R);
      for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) tree(bk, 28.0, -8.8, -R() * len, R() < 0.5 ? 'round' : 'poplar', 1.0, R);
      if (R() < 0.6) tree(bk, -12.4, LEFT_ROWS[0].y0, -R() * len, 'poplar', 1.1, R);
      for (let i = 0, n = Math.floor(R() * 3); i < n; i++) tree(bk, 40 + R() * 30, -16 - R() * 10, -R() * len, 'round', 1.2, R);
      yield 9;   // рельеф + деревья + бордюры + фонари + гирлянды одним шагом доходили до 15–30 мс (фон резал кадр) — режем мельче
      // --- бордюры, тротуары, фонари ---
      curbsGeo(bk, len, R);
      for (let k = 0; k < Math.round(len / LAMP_DZ); k++) { const z = -(LAMP_DZ / 2 + LAMP_DZ * k), sd = (k % 2 === 0) ? -1 : 1;
        if (c.lampsOff.some(([s0, a, b]) => s0 === sd && z <= a && z >= b)) continue; lampPost(bk, sd * 4.72, z, halos); }
      // свадьба: музыканты на тротуаре слева (барабан и две дудочки — играют, покачиваясь); зима: сугробы у бордюров и снеговички
      if (th.music && R() < th.music) musicians(bk, -len * (0.25 + R() * 0.5), R);
      if (th.snow) snowDrifts(bk, len, R);
      // школа: «классики» мелом на мостовой — на случайной полосе (бегут прямо по ним)
      if (th.chalk && R() < th.chalk) hopscotch(bk, (Math.floor(R() * 3) - 1) * LANE, -len * (0.2 + R() * 0.6), R);
      yield 9;
      // --- гирлянды поперёк улицы (над головой — отдельная сетка) ---
      { const n = c.garlands + (R() < th.garl ? (th.garlN || 1) + Math.floor(R() * 2) : 0), bulbs = th.hour > 18 || R() < (th.bulbs || (th.feast ? 0.5 : 0.25));
        for (let i = 0; i < n; i++) { const z = -len * (i + 0.5 + (R() - 0.5) * 0.4) / n; if (c.over.some(o => z <= o.z0 + 1 && z >= o.z1 - 1)) continue; garland(bo, z, bulbs && i % 2 === 0 ? 'bulbs' : 'flags', halos, R, FLAGT[th.id]); c.garZ.push(z); } }
      yield 10;
      // пасхалки-наклейки: только если щиты в сегменте уже есть (иначе это был бы лишний вызов отрисовки ради пары наклеек)
      const eggDecals = bs.n ? c.egg.length : 0;
      if (eggDecals) c.egg.forEach(f => f());
      // --- сетки ---
      const group = new T.Group(); group.name = 'runner:seg:' + th.id + (lmId ? ':' + lmId : '');
      const meshes = [];
      const add = m => { if (m) { group.add(m); meshes.push(m); } return m; };
      add(roadGeo(len, halos, c.roadX, th.snow ? 'w' : th.road || '')); yield 11;
      add(meshOf(bk, matA, { name: 'street', snow: th.snow })); yield 12;
      add(glazOf(gz));
      add(meshOf(bs, matSign, { name: 'signs' }));
      const overhead = add(meshOf(bo, matA, { name: 'overhead', snow: th.snow }));   // флажки — по два треугольника (лицо и изнанка), двусторонний материал не нужен
      if (halos.length) { const n = halos.length / 4, P = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { P.set([halos[i * 4], halos[i * 4 + 1], halos[i * 4 + 2]], i * 3); const k = halos[i * 4 + 3]; Cc.set([k, k * 0.92, k * 0.8], i * 3); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); g.computeBoundingSphere();
        const pts = new T.Points(g, matHalo); pts.name = 'halos'; pts.matrixAutoUpdate = false; pts.renderOrder = 4; add(pts); }
      let tris = 0; meshes.forEach(m => { const g = m.geometry; if (!m.isPoints) tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
      // lm: { side (−1 слева, +1 справа, 0 — над улицей), z0, z1 } — где ориентир (ядро доворачивает камеру к нему на подходе:
      // в портрете по горизонтали видно ≈ 34°, и башня, комбинат, кофейня и школа иначе мелькали обрывками у края кадра)
      const seg = { group, len, theme: th.id, landmark: lmId || null, lm: c.lmInfo || null, over: c.over, garlands: c.garZ, overhead, meshes, tris, calls: meshes.length, buildMs: 0, key: '', live: false, used: 0 };
      // пасхалки сегмента (стенд, заметки): жители по видам и сколько наклеек поставлено
      seg.eggs = { decals: eggDecals, cameos: {} }; Object.keys(CAMEO_N).forEach(k => { const d = CAMEO_N[k] - (c.cn0[k] || 0); if (d > 0) seg.eggs.cameos[k] = d; });
      seg.release = () => releaseSeg(seg);
      lodOf(seg, meshes.filter(m => m.name === 'signs' || m.name === 'halos'));
      return seg;
    }
    // рельеф по промежуткам z: обычный (уступы рядов, подпорные стенки, террасы склона) и «ровный» под развёрнутым ориентиром
    // (зоны TL/TR из exclude): площадка вровень с тротуаром, за ней подпорная стенка; на стыках — торцевые стенки уступов
    // (иначе видно пустоту под площадкой справа и разрез уступов слева)
    function terrainGeo(c, len) {
      const bk = c.bk, L0 = LEFT_ROWS[0].y0, L1 = LEFT_ROWS[1].y0;
      const zones = key => { const ex = (c.ex[key] || []).map(([a, b]) => [clamp(a, -len, 0), clamp(b, -len, 0)]), cuts = [0, -len]; ex.forEach(([a, b]) => cuts.push(a, b));
        const u = [...new Set(cuts.map(v => Math.round(v * 1000) / 1000))].sort((p, q) => q - p), out = [];
        for (let i = 0; i < u.length - 1; i++) { const a = u[i], b = u[i + 1]; if (a - b < 0.01) continue; const m = (a + b) / 2; out.push([a, b, ex.some(([e0, e1]) => m <= e0 && m >= e1)]); }
        return out; };
      const chunks = (a, b, fn) => { for (let z = a; z > b + 0.01; z -= 20) fn(z, Math.max(b, z - 20)); };
      const yardC = i => p => mul(WIN ? SNOW : mix(C('yard'), C('grass2'), 0.35 + 0.3 * i), 0.92 + 0.08 * Math.sin(p[2] * TAU / 20 + p[0]));
      const ledge = (xa, xb, y, z, z1, k) => bk.quadF([xa, y, z], [xb, y, z], [xb, y, z1], [xa, y, z1], yardC(k), S.FLAT, [0, 1, 0]);
      // справа: дворики уступов нижних рядов и террасы вниз; ровная зона — площадка на уровне улицы до x = 31
      zones('TR').forEach(([a, b, flat]) => {
        chunks(a, b, (z, z1) => {
          if (!flat) { ledge(WALK + 0.42, 20.4, -4.0, z, z1, 0); ledge(20.4, 28.4, -8.8, z, z1, 1); ledge(28.4, 36.0, -13.6, z, z1, 2); }
          else { ledge(6.6, 31.0, 0.0, z, z1, 0); ledge(31.0, 36.0, -13.6, z, z1, 2); retain(bk, 31.0, -13.7, 0.0, z1, z, 1); }
          for (let k = 0; k < 14; k++) { const xIn = 36 + 6.4 * k, yT = -13.6 - 2.6 * k; terraceStep(bk, xIn, xIn + 5.2, yT, yT - 2.6, z, z1, k, 1); }
        });
        if (flat) [[a, 1], [b, -1]].forEach(([zz, d]) => retainZ(bk, zz, WALK + 0.3, 31.0, -14.5, 0.0, d));
      });
      // слева: земля за домами, стенки уступов, ступени склона вверх; ровная зона — площадка до x = −31,5 и стенка до второго уступа
      zones('TL').forEach(([a, b, flat]) => {
        chunks(a, b, (z, z1) => {
          const x0 = flat ? -31.5 : -12.0;
          bk.quadF([x0, WALK_Y, z], [-WALK, WALK_Y, z], [-WALK, WALK_Y, z1], [x0, WALK_Y, z1], mix(C('yard'), C('grass2'), 0.3), S.FLAT, [0, 1, 0]);
          if (!flat) { retain(bk, -12.0, WALK_Y - 0.1, L0, z, z1, 1); ledge(-19.4, -12.0, L0, z, z1, 1); retain(bk, -19.4, L0 - 0.1, L1, z, z1, 1); ledge(-27.0, -19.4, L1, z, z1, 2); }
          else { retain(bk, -31.5, WALK_Y - 0.1, L1, z, z1, 1); ledge(-39.0, -31.5, L1, z, z1, 2); }
          const xs = flat ? -39 : -27;
          for (let k = 0; k < 10; k++) { const xOut = xs - 6.4 * k - 1.2, yT = L1 + 2.6 * (k + 1); terraceStep(bk, xOut - 5.2, xOut, yT, yT - 2.6, z, z1, k + 3, 1); }
        });
        if (flat) [[a, -1], [b, 1]].forEach(([zz, d]) => { retainZ(bk, zz, -19.4, -12.0, WALK_Y - 0.1, L0, d); retainZ(bk, zz, -31.5, -19.4, WALK_Y - 0.1, L1, d); });
      });
    }
    // ковёр на стене (базар): рамка, поле, ромбы — цветом вершин, чуть «дышит» на ветру
    // --- подписи тем уровней 2–4 (всё в сетку улицы сегмента) ---
    const BRICK = rgb('#A2624A'), CHALK = [1.32, 1.32, 1.3], CHALKC = [[1.35, 1.05, 1.12], [1.35, 1.28, 0.9], [1.0, 1.18, 1.38]];
    // ковры, перекинутые через парапет (сушатся на солнце): лицом к улице, низом почти до тротуара
    function rugsOnParapet(bk, z0, z1, R) {
      const x = WALK + 0.02, yT = WALK_Y + 1.36, n = Math.min(2, Math.floor((z0 - z1) / 1.8));
      for (let i = 0; i < n; i++) { const zc = lerp(z0, z1, (i + 0.5) / n) + (R() - 0.5) * 0.4, w = 1.1 + R() * 0.3, hh = 1.05;
        const pal = [['#8E2A2A', '#C8452E', '#F2C94C'], ['#1F4E8C', '#3F78B8', '#F4EEE2'], ['#6A2E4A', '#B0506E', '#E8C770'], ['#2F6B4F', '#4F9A72', '#F2C94C']][Math.floor(R() * 4)].map(rgb), n0 = bk.n;
        bk.quadF([x, yT - hh, zc + w / 2], [x, yT - hh, zc - w / 2], [x, yT, zc - w / 2], [x, yT, zc + w / 2], pal[0], S.FLAT, [-1, 0, 0]);
        bk.quadF([x - 0.004, yT - hh + 0.09, zc + w / 2 - 0.09], [x - 0.004, yT - hh + 0.09, zc - w / 2 + 0.09], [x - 0.004, yT - 0.09, zc - w / 2 + 0.09], [x - 0.004, yT - 0.09, zc + w / 2 - 0.09], pal[1], S.FLAT, [-1, 0, 0]);
        const yc = yT - hh / 2, r = 0.2; bk.quadF([x - 0.008, yc - r, zc], [x - 0.008, yc, zc - r * 0.8], [x - 0.008, yc + r, zc], [x - 0.008, yc, zc + r * 0.8], pal[2], S.FLAT, [-1, 0, 0]);
        fxMark(bk, n0, 0, 0.25); }
    }
    // школьный двор в просвете справа: площадка на уровне тротуара (подпорная стенка к долине), зелёная ограда с калиткой,
    // деревья, скамейка и мяч
    function schoolYard(bk, z0, z1, R) {
      const xa = WALK + 0.3, xb = WALK + 5.2, y = WALK_Y + 0.01;
      bk.quadF([xa, y, z0], [xb, y, z0], [xb, y, z1], [xa, y, z1], p => mul(C('grass2'), 0.92 + 0.08 * Math.sin(p[2] * 0.8 + p[0])), S.FLAT, [0, 1, 0]);
      retain(bk, xb, -3.2, y, z0, z1, 1);
      const g = (z0 + z1) / 2 + (R() - 0.5) * 1.2;
      fenceAlong(bk, 1, z0 - 0.1, z1 + 0.1, g + 0.7, g - 0.7, rgb('#3E8E5A'), rgb('#F1EFE8'));
      for (let zt = z0 - 1.4; zt > z1 + 1; zt -= 3.2 + R() * 1.5) tree(bk, xa + 2.6 + R() * 1.8, y, zt, 'round', 0.7 + R() * 0.2, R);
      if (R() < 0.6) bench(bk, xa + 0.8, g, -PI / 2);
      if (R() < 0.7) { const bx = xa + 1.6 + R() * 2, bz = lerp(z0, z1, 0.25 + R() * 0.5); bk.sph(bx, y + 0.11, bz, 0.11, 0.11, 0.11, (p, ny) => (Math.sin(p[0] * 40 + p[2] * 30) > 0 ? [1.25, 1.25, 1.25] : rgb('#D23B3B')), { seg: 6, rings: 4 }); }
    }
    // «классики» мелом: 1-1-2-1-2-1 клеток по 0,55 м и «небо» дугой; пара клеток закрашена цветным мелом
    function hopscotch(bk, xc, zc, R) {
      const c = 0.55, t = 0.035, y = 0.016, LAY = [[0], [0], [-1, 1], [0], [-1, 1], [0]];
      const line = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L * t, nz = dx / L * t; bk.quadF([x0 - nx, y, z0 - nz], [x1 - nx, y, z1 - nz], [x1 + nx, y, z1 + nz], [x0 + nx, y, z0 + nz], CHALK, S.FLAT, [0, 1, 0]); };
      LAY.forEach((row, j) => row.forEach(sd => { const x = xc + sd * c / 2, za = zc - j * c, zb = za - c, xa = x - c / 2, xb = x + c / 2;
        if (R() < 0.22) { const fc = CHALKC[Math.floor(R() * 3)]; bk.quadF([xa + 0.05, y - 0.002, za - 0.05], [xb - 0.05, y - 0.002, za - 0.05], [xb - 0.05, y - 0.002, zb + 0.05], [xa + 0.05, y - 0.002, zb + 0.05], fc, S.FLAT, [0, 1, 0]); }
        line(xa, za, xb, za); line(xb, za, xb, zb); line(xb, zb, xa, zb); line(xa, zb, xa, za); }));
      const zt = zc - LAY.length * c; let p0 = [xc - c / 2, zt];   // «небо» — полукруг
      for (let i = 1; i <= 6; i++) { const a = PI - i / 6 * PI, p1 = [xc + Math.cos(a) * c / 2, zt - Math.sin(a) * c * 0.8]; line(p0[0], p0[1], p1[0], p1[1]); p0 = p1; }
    }
    // медные кувшины у двери мастерской (2–3, разной высоты)
    function copperJugs(bk, F, x, z, R) {
      const n = 2 + (R() < 0.5 ? 1 : 0), cu = C('copper');
      for (let i = 0; i < n; i++) { const q = F.p(x + (i - (n - 1) / 2) * 0.34, 0, z + (i % 2) * 0.12), s = 0.8 + R() * 0.4, y = WALK_Y;
        bk.sph(q[0], y + 0.2 * s, q[2], 0.14 * s, 0.2 * s, 0.14 * s, (p, ny) => mul(cu, 0.78 + 0.35 * Math.max(0, ny)), { seg: 6, rings: 3 });
        bk.cyl(q[0], y + 0.36 * s, q[2], 0.06 * s, 0.08 * s, 0.14 * s, { seg: 6, col: mul(cu, 0.9), cap: false }); }
    }
    function carpetOnWall(bk, h, R) {
      const F = new K.Frame(h.x, h.y0, h.z, h.ry), z = h.d / 2 + 0.03, cw = 1.3 + R() * 0.4, ch = 1.9, x = (R() - 0.5) * (h.w - cw - 0.4), y = ST + 0.25 + ch / 2;
      const pal = [['#8E2A2A', '#B8403A', '#F2C94C'], ['#1F4E8C', '#3F78B8', '#F4EEE2'], ['#6A2E4A', '#A04E6A', '#E8C770']][Math.floor(R() * 3)].map(rgb), n0 = bk.n;
      qv(bk, F, [[x - cw / 2, y - ch / 2, z], [x + cw / 2, y - ch / 2, z], [x + cw / 2, y + ch / 2, z], [x - cw / 2, y + ch / 2, z]], pal[0], S.FLAT);
      qv(bk, F, [[x - cw / 2 + 0.1, y - ch / 2 + 0.1, z + 0.004], [x + cw / 2 - 0.1, y - ch / 2 + 0.1, z + 0.004], [x + cw / 2 - 0.1, y + ch / 2 - 0.1, z + 0.004], [x - cw / 2 + 0.1, y + ch / 2 - 0.1, z + 0.004]], pal[1], S.FLAT);
      [-0.55, 0, 0.55].forEach(dy => { const r = 0.24; bk.quad(F.p(x, y + dy - r, z + 0.008), F.p(x + r * 0.75, y + dy, z + 0.008), F.p(x, y + dy + r, z + 0.008), F.p(x - r * 0.75, y + dy, z + 0.008), pal[2], S.FLAT); });
      fxMark(bk, n0, 0, 0.2);
    }

    // дальний сегмент (начало дальше LOD_FAR, там он уже наполовину в тумане): щиты и ореолы фонарей не рисуем — −2 вызова на
    // сегмент ночью (бюджет 90); ядро зовёт seg.lod(расстояние до начала сегмента) каждый кадр, видимость меняется на пороге
    const LOD_FAR = 150;
    function lodOf(seg, list) {
      seg.lodMeshes = list; seg.lodFar = false;
      seg.lod = d => { const far = d > LOD_FAR; if (far === seg.lodFar) return; seg.lodFar = far; for (let i = 0; i < list.length; i++) list[i].visible = !far; };
    }
    const POOL = new Map(), ALL = new Set(), BUILT = new Map(), LMC = {};
    // предел построенных: живые (≈ 9: 32 м позади … 340 м впереди) + запас текущей и следующей темы с ориентирами (≈ 16) + ещё
    // одна-две темы. При 22 на low запас текущей темы не влезал: вытеснялись её же сегменты и тут же строились заново (пила
    // кучи ≈ 3,5 МБ/с мусора Baker и синхронные сборки в кадре); 34 × ≈ 0,9 МБ — терпимо и для слабого телефона
    const CAP = HI ? 48 : 34, PER_KEY = HI ? 4 : 3;
    let segTick = 0;
    function releaseSeg(seg) {
      if (!seg.live) return;
      seg.live = false; if (seg.group.parent) seg.group.parent.remove(seg.group);
      seg.group.position.set(0, 0, 0); seg.group.visible = true; if (seg.overhead) seg.overhead.visible = true;
      if (seg.lodMeshes) { seg.lodFar = false; for (let i = 0; i < seg.lodMeshes.length; i++) seg.lodMeshes[i].visible = true; }
      let L = POOL.get(seg.key); if (!L) POOL.set(seg.key, L = []); L.push(seg);
    }
    function disposeSeg(seg) {
      seg.meshes.forEach(m => m.geometry.dispose()); ALL.delete(seg);
      const L = POOL.get(seg.key); if (L) { const i = L.indexOf(seg); if (i >= 0) L.splice(i, 1); }
      BUILT.set(seg.key, Math.max(0, (BUILT.get(seg.key) || 1) - 1));
    }
    // фон: пока бежим, tick достраивает «про запас» — ориентир, который скоро выпадет (решён заранее: LMN), сегменты обеих длин
    // текущей темы и первые сегменты следующей по порядку. Тогда segment() почти всегда берёт готовый из пула, без рывка в кадре
    const LMN = {}, BGS = { built: 0, maxSlice: 0, ms: 0, sync: 0, lastSync: '' }; let lastTh = null, BG = null;
    const SLICE = HI ? 4 : 3;
    const poolPush = seg => { let L = POOL.get(seg.key); if (!L) POOL.set(seg.key, L = []); L.push(seg); };
    // вытеснение сверх CAP: сначала простаивающие «чужих» тем (не текущей и не следующей). Темы идут по кругу, и «давно не
    // нужная» — как раз ближайшая следующая: выбрасывая давно не виденное (LRU), набор каждый круг строил всё заново (bg.built
    // рос линейно, 0,5 сегмента/с, и синхронные сборки в кадре). Поэтому выбрасываем то, что понадобится ПОЗЖЕ всего: тему,
    // пройденную только что (дальше всех по кругу), в ней сначала ориентиры (ключей много, тот же — нескоро) и лишние копии
    const nextTh = th => THEMES[(THEMES.indexOf(th) + 1) % THEMES.length];
    const mine = s => !!lastTh && (s.theme === lastTh.id || s.theme === nextTh(lastTh).id);
    const thDist = s => lastTh ? (THEMES.indexOf(THEME[s.theme]) - THEMES.indexOf(lastTh) + THEMES.length) % THEMES.length : 0;
    const evPrio = s => thDist(s) * 4 + (s.landmark ? 2 : 0) + (avail(s.key) > 1 ? 1 : 0);
    function evict(keep) { if (ALL.size <= CAP) return; const idle = [...ALL].filter(s => !s.live && s !== keep).sort((a, b) => (mine(a) - mine(b)) || (evPrio(b) - evPrio(a)) || (a.used - b.used)); for (let i = 0; i < idle.length && ALL.size > CAP; i++) disposeSeg(idle[i]); }
    // планировщик фона зовётся каждый кадр, пока строить нечего: без замыканий и склейки строк в кадре (ключи — заранее)
    const KEYS = {};
    const keyOf = (thId, len, lm) => { const a = KEYS[thId] || (KEYS[thId] = {}), b = a[len] || (a[len] = {}), l = lm || ''; return b[l] || (b[l] = thId + '|' + len + '|' + l); };
    const avail = k => { const L = POOL.get(k); return L ? L.length : 0; }, built = k => BUILT.get(k) || 0;
    const PLAN = { th: null, len: 40, lm: null, key: '' };
    const plan = (th, len, lm, key) => { PLAN.th = th; PLAN.len = len; PLAN.lm = lm; PLAN.key = key; return PLAN; };
    let _hf = false; const _hfCb = s => { if (!_hf && !s.live && !mine(s)) _hf = true; };
    function hasForeign() { _hf = false; ALL.forEach(_hfCb); return _hf; }
    function bgPlan() {
      const th = lastTh; if (!th) return null;
      // ориентир, который скоро выпадет, — первым и даже при полном наборе (вытеснится простаивающий): все синхронные сборки
      // в кадре за 16 мин были именно ориентирами — фон стоял на «места нет», а через 2 сегмента ориентир строился в кадре
      // Счётчик ориентиров у темы живёт между кругами: следующая тема может начаться сразу с ориентира — его тоже заранее
      for (let q = 0; q < 2; q++) { const t = q ? nextTh(th) : th;
        if (t.lm.length && (LMC[t.id] || 0) >= t.lmEvery - 2) { if (!LMN[t.id]) LMN[t.id] = t.lm[Math.floor(fxR() * t.lm.length)];
          for (let i = 0; i < SEG_LENS.length; i++) { const len = SEG_LENS[i], k = keyOf(t.id, len, LMN[t.id]); if (!avail(k)) return plan(t, len, LMN[t.id], k); } } }
      if (ALL.size >= CAP - 1 && !hasForeign()) return null;   // остальное — только за счёт чужих тем
      // запас текущей темы: по одному каждой длины, потом по второму — пока построено не больше PER_KEY (без «+1»: тот лишний и
      // вытеснялся первым, и строился снова)
      for (let want = 1; want <= 2; want++) for (let i = 0; i < SEG_LENS.length; i++) { const len = SEG_LENS[i], k = keyOf(th.id, len, null); if (avail(k) < want && (want === 1 || built(k) < PER_KEY)) return plan(th, len, null, k); }
      const nx = nextTh(th);
      for (let i = 0; i < SEG_LENS.length; i++) { const len = SEG_LENS[i], k = keyOf(nx.id, len, null); if (!avail(k)) return plan(nx, len, null, k); }
      return null;
    }
    function bgDone(seg) { seg.key = BG.key; seg.buildMs = BG.ms; ALL.add(seg); BUILT.set(seg.key, (BUILT.get(seg.key) || 0) + 1); seg.used = segTick - 1; poolPush(seg); BGS.built++; BG = null; evict(null); }
    function bgStep() {
      if (!BG) { const p = bgPlan(); if (!p) return; BG = { th: p.th, len: p.len, lm: p.lm, key: p.key, g: null, ms: 0 }; BG.g = segSteps(p.th, p.len, RNGF((fxR() * 4294967296) >>> 0), p.lm, {}); }
      const t0 = now(); let r;
      do { r = BG.g.next(); if (r.done) break; } while (now() - t0 < SLICE);
      const dt = now() - t0; BG.ms += dt; BGS.ms += dt; if (dt > BGS.maxSlice) BGS.maxSlice = dt;
      if (r.done) bgDone(r.value);
    }
    function segment(themeId, len, rng, opts) {
      opts = opts || {};
      const th = THEME[themeId] || THEMES[0];
      len = Math.max(20, Math.round((+len || 40) / 20) * 20);   // кратно 20 (фонари, пятна, развёртка мостовой)
      // из ГСЧ ядра — одно число: дальше свой ГСЧ (постройка не сбивает последовательность игры, а зерно игры повторяет улицу)
      const R = RNGF(Math.floor((typeof rng === 'function' ? rng() : Math.random()) * 4294967296) >>> 0);
      let lm = null;
      if (opts.landmark !== undefined) lm = LM[opts.landmark] ? opts.landmark : null;
      else if (!opts.start && !opts.first) { LMC[th.id] = (LMC[th.id] || 0) + 1; if (LMC[th.id] >= th.lmEvery && R() < 0.7) { lm = LMN[th.id] || th.lm[Math.floor(R() * th.lm.length)]; LMN[th.id] = null; LMC[th.id] = 0; } }
      if (lm === 'bridge' && (opts.noOver || opts.glide)) lm = null;
      const key = keyOf(th.id, len, lm), L = POOL.get(key) || [];
      if (!L.length && BG && BG.key === key) { let r = BG.g.next(); while (!r.done) r = BG.g.next(); bgDone(r.value); }   // фон как раз строил его — достроить
      let seg = null;
      if (L.length || (POOL.get(key) || []).length) { const P = POOL.get(key); let bi = 0; for (let i = 1; i < P.length; i++) if ((P[i].seen ? P[i].used : -1) < (P[bi].seen ? P[bi].used : -1)) bi = i; seg = P.splice(bi, 1)[0]; }   // не виденный, затем давно не виденный
      else { seg = buildSegment(th, len, R, lm, opts); seg.key = key; ALL.add(seg); BUILT.set(key, (BUILT.get(key) || 0) + 1); evict(seg); BGS.sync++; BGS.lastSync = key; }
      seg.live = true; seg.seen = true; seg.used = ++segTick; lastTh = th;
      return seg;
    }

    /* =================================================================
       7. СВЕТ ПО ЧАСУ И НЕБО
       ================================================================= */
    // опорные точки — в числа один раз; в кадре — интерполяция в готовые массивы (без выделений)
    const LKN = LK.map(k => ({ h: k.h, zen: rgb(k.zen), hor: rgb(k.hor), fog: rgb(k.fog), hs: rgb(k.hs), hg: rgb(k.hg), sun: rgb(k.sun), cl: rgb(k.cloud[0]), n: [k.hi, k.si, k.el, k.az, k.sat, k.glow, k.lamps, k.stars, k.cloud[1]], mul: k.mul, add: k.add }));
    const LFIELDS = ['zen', 'hor', 'fog', 'hs', 'hg', 'sun', 'cl', 'mul', 'add'];
    const LV = { zen: [0, 0, 0], hor: [0, 0, 0], fog: [0, 0, 0], hs: [0, 0, 0], hg: [0, 0, 0], sun: [0, 0, 0], cl: [0, 0, 0], mul: [0, 0, 0], add: [0, 0, 0], n: new Float32Array(9), dir: [0, 1, 0], h: -1 };
    function lightAt(hour) {
      let h = ((+hour || 0) % 24 + 24) % 24, i = 0; for (let k = 0; k < LKN.length; k++) if (h >= LKN[k].h) i = k;
      const A = LKN[i], B = LKN[(i + 1) % LKN.length], hb = B.h <= A.h ? B.h + 24 : B.h; let t = (h - A.h) / (hb - A.h); t = sst(0, 1, t);
      for (let q = 0; q < LFIELDS.length; q++) { const f = LFIELDS[q], a = A[f], b = B[f], o = LV[f]; o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; }   // без нового массива и замыкания в кадре
      for (let k = 0; k < 9; k++) LV.n[k] = A.n[k] + (B.n[k] - A.n[k]) * t;
      const el = LV.n[2] * PI / 180, az = LV.n[3] * PI / 180; LV.dir[0] = Math.sin(az) * Math.cos(el); LV.dir[1] = Math.sin(el); LV.dir[2] = -Math.cos(az) * Math.cos(el);
      LV.h = h; return LV;
    }
    // uniform-ы мира, свечение окон и фонарей, оттенок монет — от одного часа
    function applyLight(L) {
      const hi = L.n[0], si = L.n[1];
      LU.rlHs.value.setRGB(L.hs[0] * hi, L.hs[1] * hi, L.hs[2] * hi); LU.rlHg.value.setRGB(L.hg[0] * hi, L.hg[1] * hi, L.hg[2] * hi);
      LU.rlSun.value.setRGB(L.sun[0] * si, L.sun[1] * si, L.sun[2] * si); LU.rlDir.value.set(L.dir[0], Math.max(0.08, L.dir[1]), L.dir[2]).normalize();
      LU.rlMul.value.setRGB(L.mul[0], L.mul[1], L.mul[2]); LU.rlAdd.value.setRGB(L.add[0], L.add[1], L.add[2]);
      LU.rlP.value.x = L.n[4]; LU.rlP.value.y = L.n[6];
      K.GLOW.amt.value = L.n[5] * 0.8;
      matHalo.opacity = clamp(L.n[6], 0, 1) * 0.9; matHalo.visible = L.n[6] > 0.04;
      if (coinMat) { const k = 0.92 + 0.12 * (1 - L.n[7]); coinMat.color.setRGB(k * (0.96 + 0.04 * L.mul[0]), k * (0.96 + 0.04 * L.mul[1]), k); }
    }
    const SKY = { list: [] };
    function sky(scene) {
      if (SKY.live) SKY.live.dispose();
      const root = new T.Group(); root.name = 'runner:sky';
      const items = [];
      const prevFog = scene.fog, prevBg = scene.background;
      // туман до 240 м — чуть ближе края видимых сегментов (262): новый сегмент появляется уже целиком в тумане
      const fog = new T.Fog(0xD6E2EE, 60, 240); scene.fog = fog; scene.background = new T.Color(0xA6C8EA);
      // купол: цвет вершин (зенит → горизонт, сияние у солнца)
      const domeG = new T.SphereGeometry(1, 32, 16), nV = domeG.attributes.position.count;
      domeG.setAttribute('color', new T.BufferAttribute(new Float32Array(nV * 3), 3));
      const dome = new T.Mesh(domeG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
      dome.renderOrder = -20; dome.frustumCulled = false; root.add(dome); items.push(dome);
      // горы: панорама на кольце (вперёд по ходу — середина зеркальной копии, швы зеркала далеко сбоку)
      const panoTex = paintPanorama(); const pano = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 64, 1, true), new T.MeshBasicMaterial({ map: panoTex, side: T.BackSide, fog: false, alphaTest: 0.5, color: 0xFFFFFF }));
      // нижний пояс панорамы (у горизонта, куда уходит улица) — в цвет тумана часа: дальние сегменты (200–260 м) целиком в
      // тумане и иначе стояли «белыми призраками» на зелёном склоне, а новый сегмент «выпрыгивал» белым блоком посреди экрана.
      // Высота над глазом: y кольца 0…0,5 ↔ tg(el) = y·0,62/0,84 — туман целиком до ≈ 2°, сходит на нет к ≈ 5,5° (снежные пики
      // выше — как были)
      const PU = { uFogC: { value: new T.Color(0xD6E2EE) }, uBand: { value: new T.Vector3(0.045, 0.13, 1) }, uSnow: { value: 0 } };
      pano.material.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, PU);
        sh.vertexShader = 'varying float vPanoY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanoY = position.y;');
        // uSnow — зимняя тема уровня: склоны и террасы панорамы светлеют до снега (полосы террас остаются оттенком)
        sh.fragmentShader = 'uniform vec3 uFogC;\nuniform vec3 uBand;\nuniform float uSnow;\nvarying float vPanoY;\n' + sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n{ float sl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.84, 0.9) + vec3(0.2) * sl, uSnow * 0.82);\n  float fb = 1.0 - smoothstep(uBand.x, uBand.y, vPanoY); diffuseColor.rgb = mix(diffuseColor.rgb, uFogC, fb * uBand.z); }');
      };
      pano.material.customProgramCacheKey = () => 'rk-pano';
      pano.renderOrder = -19; pano.frustumCulled = false; root.add(pano); items.push(pano);
      // облака (vkit): оттенок по часу
      const clouds = VK.skyClouds(T, { radius: 1, count: 12, elMin: 6, seed: 919, az0: 170, hero: [[180, 9, 1.2], [200, 15, 1.0], [150, 6, 1.1]] });
      clouds.renderOrder = -18; clouds.material.fog = false; root.add(clouds); items.push(clouds);
      // солнце-сияние и луна (спрайты), звёзды (точки)
      const disc = (inner, rim) => { const [cv, c] = K.cnv(128, 128), g = c.createRadialGradient(64, 64, 0, 64, 64, 63); g.addColorStop(0, inner); g.addColorStop(0.22, inner); g.addColorStop(0.28, rim); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); return new T.CanvasTexture(cv); };
      const sunS = new T.Sprite(new T.SpriteMaterial({ map: disc('rgba(255,252,240,1)', 'rgba(255,236,200,0.45)'), fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending }));
      const moonT = (() => { const [cv, c] = K.cnv(128, 128); const g = c.createRadialGradient(64, 64, 20, 64, 64, 63); g.addColorStop(0, 'rgba(190,205,255,0.35)'); g.addColorStop(1, 'rgba(190,205,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        c.fillStyle = '#F4F1E4'; c.beginPath(); c.arc(64, 64, 22, 0, TAU); c.fill(); c.fillStyle = 'rgba(180,176,160,0.45)'; [[56, 58, 5], [70, 70, 4], [66, 52, 3], [58, 72, 2.5]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); return new T.CanvasTexture(cv); })();
      const moon = new T.Sprite(new T.SpriteMaterial({ map: moonT, fog: false, depthWrite: false, transparent: true }));
      sunS.renderOrder = moon.renderOrder = -17; root.add(sunS); root.add(moon); items.push(sunS, moon);
      const starG = (() => { const N = HI ? 520 : 320, P = new Float32Array(N * 3), Cc = new Float32Array(N * 3), R = VK.rng(77); for (let i = 0; i < N; i++) { const a = R() * TAU, e = Math.asin(0.12 + R() * 0.88), r = 1; P.set([Math.cos(e) * Math.sin(a) * r, Math.sin(e) * r, Math.cos(e) * Math.cos(a) * r], i * 3); const b = 0.5 + R() * 0.5; Cc.set([b, b, b * (0.9 + R() * 0.2)], i * 3); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); return g; })();
      const stars = new T.Points(starG, new T.PointsMaterial({ size: HI ? 2.2 : 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
      stars.renderOrder = -19.5; stars.frustumCulled = false; root.add(stars); items.push(stars);
      // огоньки дальних сёл на склонах панорамы (ночью): точки по линии склонов
      const vill = (() => { const L = PANO.lights, N = Math.max(1, L.length), P = new Float32Array(N * 3), Cc = new Float32Array(N * 3), R = VK.rng(55); for (let i = 0; i < L.length; i++) { const [a, v] = L[i]; P.set([Math.sin(a) * 0.84, v * 0.62, Math.cos(a) * 0.84], i * 3); const b = 0.75 + R() * 0.25; Cc.set([b, b * 0.82, b * 0.55], i * 3); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); return new T.Points(g, new T.PointsMaterial({ size: HI ? 2.6 : 2.0, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false })); })();
      vill.renderOrder = -18.5; vill.frustumCulled = false; root.add(vill); items.push(vill);
      // снегопад (зимняя тема): хлопья вокруг камеры, падают и летят навстречу со скоростью бега; один вызов, только зимой
      const SNN = HI ? 420 : 260, snP = new Float32Array(SNN * 3), snR = VK.rng(808), snPh = new Float32Array(SNN);
      for (let i = 0; i < SNN; i++) { snP[i * 3] = (snR() - 0.5) * 26; snP[i * 3 + 1] = -4 + snR() * 16; snP[i * 3 + 2] = -34 + snR() * 40; snPh[i] = snR() * TAU; }
      const snG = new T.BufferGeometry(); snG.setAttribute('position', new T.BufferAttribute(snP, 3).setUsage(T.DynamicDrawUsage)); snG.boundingSphere = new T.Sphere(new T.Vector3(), 1e4);
      const snow = new T.Points(snG, new T.PointsMaterial({ map: K.snowTex, size: HI ? 0.16 : 0.2, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, color: 0xFFFFFF, fog: true }));
      snow.frustumCulled = false; snow.visible = false; snow.renderOrder = 7; root.add(snow); items.push(snow);
      // настроение темы (MOOD): текущие значения плавно (≈ 2 с) идут к цели — переход у ворот уровня без скачка
      const MC = { n: 60, f: 240, t: [1, 1, 1], snow: 0, pano: 0, k: 0, ch: false };
      // шаг к цели (без замыканий в кадре: коэффициент и флаг «изменилось» — в MC)
      const mv = (cur, to) => { const d = to - cur; if (Math.abs(d) > 0.002) { MC.ch = true; return cur + d * MC.k; } return to; };
      // свет для актёров (героиня, пальтар, звери — тун-материалы со светом сцены)
      const hemi = new T.HemisphereLight(0xCFE0F0, 0xB9A27E, 0.62), sunL = new T.DirectionalLight(0xFFE2BE, 0.62);
      root.add(hemi); root.add(sunL); root.add(sunL.target);
      scene.add(root);
      if (FX.root && !FX.root.parent) scene.add(FX.root);
      let lastH = -99, R0 = 0, tSky = 0;
      const tmp = new T.Color(), sunC = new T.Color(), dv = new T.Vector3();
      function paintDome(L) {
        const p = domeG.attributes.position, c = domeG.attributes.color, d = L.dir, warm = sst(30, 4, L.n[2]) * (L.n[7] < 0.5 ? 1 : 0);
        sunC.setRGB(1, lerp(0.96, 0.78, warm), lerp(0.9, 0.62, warm));
        for (let i = 0; i < nV; i++) { dv.set(p.getX(i), p.getY(i), p.getZ(i)).normalize(); const t = Math.max(0, dv.y);
          tmp.setRGB(lerp(L.hor[0], L.zen[0], Math.pow(t, 0.32)), lerp(L.hor[1], L.zen[1], Math.pow(t, 0.32)), lerp(L.hor[2], L.zen[2], Math.pow(t, 0.32)));
          if (dv.y < 0) tmp.setRGB(L.hor[0] * 0.97, L.hor[1] * 0.97, L.hor[2] * 0.97);
          const k = Math.pow(Math.max(0, dv.x * d[0] + dv.y * d[1] + dv.z * d[2]), 8) * (0.25 + 0.55 * warm) * (1 - L.n[7]); tmp.lerp(sunC, k);
          c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
        c.needsUpdate = true;
      }
      const api = {
        fog, hemi, sun: sunL, root,
        update(hour, dt, camera, mood, speed) {
          dt = +dt || 0; tSky += dt; tick(dt);
          const L = lightAt(hour);
          // настроение темы уровня: туман, оттенок, снегопад, снег на панораме
          const MT = MOOD[mood] || MOOD.base; MC.k = dt > 0 ? 1 - Math.exp(-dt * 1.4) : 0; MC.ch = false;
          MC.n = mv(MC.n, MT.fog[0]); MC.f = mv(MC.f, MT.fog[1]); MC.t[0] = mv(MC.t[0], MT.tint[0]); MC.t[1] = mv(MC.t[1], MT.tint[1]); MC.t[2] = mv(MC.t[2], MT.tint[2]); MC.snow = mv(MC.snow, MT.snow); MC.pano = mv(MC.pano, MT.pano);
          if (Math.abs(L.h - lastH) > 0.004 || MC.ch) {
            lastH = L.h; applyLight(L); paintDome(L);
            LU.rlMul.value.setRGB(LU.rlMul.value.r * MC.t[0], LU.rlMul.value.g * MC.t[1], LU.rlMul.value.b * MC.t[2]);
            fog.near = MC.n; fog.far = MC.f; PU.uSnow.value = MC.pano;
            fog.color.setRGB(L.fog[0] * lerp(1, MC.t[0], 0.6), L.fog[1] * lerp(1, MC.t[1], 0.6), L.fog[2] * lerp(1, MC.t[2], 0.6)); scene.background.setRGB(L.hor[0], L.hor[1], L.hor[2]); PU.uFogC.value.copy(fog.color);
            const nk = L.n[7];
            pano.material.color.setRGB(lerp(1, L.fog[0] * 0.55 + 0.12, nk) * lerp(1, L.mul[0], 0.5), lerp(1, L.fog[1] * 0.55 + 0.12, nk) * lerp(1, L.mul[1], 0.5), lerp(1, L.fog[2] * 0.6 + 0.16, nk) * lerp(1, L.mul[2], 0.5));
            if (L.n[2] < 20 && nk < 0.5) { const w = sst(20, 4, L.n[2]); pano.material.color.multiply(tmp.setRGB(1, lerp(1, 0.86, w), lerp(1, 0.74, w))); }
            clouds.material.color.setRGB(L.cl[0], L.cl[1], L.cl[2]); clouds.material.opacity = L.n[8];
            stars.material.opacity = L.n[7] * 0.9; stars.visible = L.n[7] > 0.02;
            vill.material.opacity = L.n[7]; vill.visible = L.n[7] > 0.02;
            sunS.visible = L.n[7] < 0.6 && L.n[2] > -2; sunS.material.opacity = (1 - L.n[7]) * 0.85;
            moon.visible = L.n[7] > 0.3; moon.material.opacity = sst(0.3, 0.9, L.n[7]);
            // актёры: тот же свет, грейд ночи — прямо в цвет ламп (их материалы патч мира не получают)
            // актёры (тун-материалы со светом сцены): ночью свет неба и луны — серо-голубой, а не насыщенный синий (белый каз иначе
            // светился барвинковым: насыщенность 0,57 против 0,06 днём), снизу-сбоку — тёплый отсвет фонарей и окон (L.n[6] — сколько
            // горят лампы). nd — «сколько ночи»: днём свет как был
            const lk = L.n[6], nd = clamp(L.n[7] * 1.2, 0, 1), dS = lerp(1, 0.3, nd);
            const hr = L.hs[0] * L.mul[0] + L.add[0], hg2 = L.hs[1] * L.mul[1] + L.add[1], hb = L.hs[2] * L.mul[2] + L.add[2], hl = 0.299 * hr + 0.587 * hg2 + 0.114 * hb;
            hemi.color.setRGB(lerp(hl, hr, dS) * lerp(1, 1.12, nd), lerp(hl, hg2, dS) * lerp(1, 1.1, nd), lerp(hl, hb, dS) * lerp(1, 1.04, nd));
            hemi.groundColor.setRGB(L.hg[0] * L.mul[0] + 0.40 * lk, L.hg[1] * L.mul[1] + 0.27 * lk, L.hg[2] * L.mul[2] + 0.11 * lk); hemi.intensity = L.n[0] * 1.45;
            const sr = L.sun[0] * L.mul[0], sg = L.sun[1] * L.mul[1], sb = L.sun[2] * L.mul[2], sl = 0.299 * sr + 0.587 * sg + 0.114 * sb;
            sunL.color.setRGB(lerp(sl, sr, dS) + 0.06 * lk * nd, lerp(sl, sg, dS) + 0.04 * lk * nd, lerp(sl, sb, dS)); sunL.intensity = L.n[1] * 0.9;
          }
          LU.rlP.value.z = tSky;
          // снегопад: падает ~1,3 м/с с покачиванием, по ходу — навстречу со скоростью бега (в координатах у камеры)
          const sk = MC.snow; snow.visible = sk > 0.02; snow.material.opacity = sk * 0.9;
          if (snow.visible && dt > 0) { const sp = (+speed || 0) * dt;
            for (let i = 0; i < SNN; i++) { const j = i * 3; snP[j + 1] -= (1.1 + (i % 5) * 0.12) * dt; snP[j] += Math.sin(tSky * 1.3 + snPh[i]) * 0.35 * dt; snP[j + 2] += sp;
              if (snP[j + 1] < -4) snP[j + 1] += 16; if (snP[j + 2] > 6) snP[j + 2] -= 40; }
            snG.attributes.position.needsUpdate = true; }
          if (camera) {
            const cp = camera.position, far = camera.far || 1000, Rr = Math.min(900, far * 0.9);
            if (Rr !== R0) { R0 = Rr; dome.scale.setScalar(Rr); pano.scale.set(Rr * 0.84, Rr * 0.62, Rr * 0.84); clouds.scale.setScalar(Rr * 0.92); stars.scale.setScalar(Rr * 0.96); vill.scale.setScalar(Rr * 0.995); sunS.scale.setScalar(Rr * 0.12); moon.scale.setScalar(Rr * 0.07); }
            root.position.set(cp.x, cp.y, cp.z);
            pano.position.y = 0;   // горизонт панорамы (середина кольца) — на уровне глаз
            const d = LV.dir; sunS.position.set(d[0] * Rr * 0.9, Math.max(0.02, d[1]) * Rr * 0.9, d[2] * Rr * 0.9); moon.position.set(-0.45 * Rr * 0.9, 0.42 * Rr * 0.9, -0.78 * Rr * 0.9);
            sunL.position.set(cp.x + d[0] * 50, cp.y + Math.max(0.1, d[1]) * 50, cp.z + d[2] * 50); sunL.target.position.set(cp.x, cp.y, cp.z);
            sunL.position.sub(root.position); sunL.target.position.sub(root.position);
          }
        },
        dispose() {
          scene.remove(root); scene.fog = prevFog; scene.background = prevBg;
          items.forEach(m => { if (m.geometry && m.geometry !== clouds.geometry) m.geometry.dispose(); const mt = m.material; if (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); } });
          clouds.geometry.dispose();
          if (FX.root && FX.root.parent === scene) scene.remove(FX.root);
          if (SKY.live === api) SKY.live = null;
        },
      };
      SKY.live = api;
      api.update(THEMES[0].hour, 0, null);
      return api;
    }

    // панорама гор (кольцо вокруг камеры, 360° без зеркала): по сторонам света разная — справа (вниз по склону) долина с морем
    // облаков и через неё зелёный склон в террасах, впереди — седловина перевала со снежными пиками в дымке, слева — близкий склон
    // с крупными террасами и кустами; на склонах — дальние сёла (днём — светлые домики, ночью — огоньки, точки PANO.lights).
    // Альфа 0 — небо (alphaTest). Пиксель x ↔ азимут θ = 2πx/W (θ = 0 — назад, π/2 — вправо, π — вперёд; на экране x растёт влево),
    // строка y ↔ высота над глазом: tg(el) = (0,5 − y/H)·0,738 (кольцо: высота 0,62 R на радиусе 0,84 R)
    const PANO = { lights: [] };
    function paintPanorama() {
      const W = HI ? 4096 : 2048, H = 512, [cv, c] = K.cnv(W, H), R = VK.rng(4242), sh = 1;
      const Yel = d => (0.5 - Math.tan(d * PI / 180) / 0.738) * H, th = x => x / W * TAU;
      const per = (x, f, ph) => Math.sin(th(x) * f + ph);   // периодические по кругу
      const nz = (x, s) => 0.5 * per(x, 7, s) + 0.3 * per(x, 13, s * 1.7) + 0.2 * per(x, 29, s * 2.3) + 0.1 * per(x, 53, s * 3.1);
      const right = x => Math.max(0, Math.sin(th(x))), left = x => Math.max(0, -Math.sin(th(x))), fwd = x => Math.max(0, -Math.cos(th(x)));
      const layer = (fn, fill) => { c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 2) c.lineTo(x, fn(x)); c.lineTo(W, H); c.closePath(); c.fillStyle = fill; c.fill(); };
      const clipTo = fn => { c.save(); c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 2) c.lineTo(x, fn(x)); c.lineTo(W, H); c.closePath(); c.clip(); };
      const stripes = (fn, n, d0, gap, cols, wd, amp) => { for (let k = 1; k < n; k++) { const off = d0 + k * gap + k * k * gap * 0.02; c.strokeStyle = cols[k % cols.length]; c.lineWidth = wd[k % wd.length]; c.beginPath();
        for (let x = 0; x <= W; x += 4) { const y = fn(x) + off + Math.sin(x * 0.011 + k * 0.9) * amp; if (!x) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); } };
      // 1. дальние хребты — два плана: самый дальний бледный (дымка) и ближний — цепь пиков (по списку: азимут, высота, ширина);
      //    вершины «максимумом» гауссов — острые гребни между пиками, сверху мелкий шум. Снег — гладкие многоугольники вдоль
      //    гребня (языки по кулуарам вниз), теневой склон (правый по x — от солнца) — полупрозрачная синева: объём без света
      const ridge = (pk, base, rough) => x => { const a = th(x); let e = base + rough * nz(x, 2.1);
        for (const [c0, h, w] of pk) { let d = Math.abs(a - c0); d = Math.min(d, TAU - d); e = Math.max(e, base + h * Math.exp(-(d / w) * (d / w)) + rough * 0.6 * nz(x, 4.3 + c0)); } return e; };
      const snow = (fn, line, fill) => { c.beginPath(); for (let x = 0; x <= W; x += 2) c.lineTo(x, Yel(fn(x)) - 1);
        for (let x = W; x >= 0; x -= 2) { const e = fn(x), dd = 0.7 + 0.45 * Math.sin(x * 0.083) + 0.35 * Math.sin(x * 0.217 + 1.3) + 0.25 * Math.sin(x * 0.61); c.lineTo(x, Yel(e > line ? Math.max(line - 0.4, e - Math.max(0.15, (e - line) * 0.55 + dd)) : e)); }
        c.closePath(); c.fillStyle = fill; c.fill(); };
      const shade = (fn, fill, depth) => { c.beginPath(); for (let x = 0; x <= W; x += 2) c.lineTo(x, Yel(fn(x))); for (let x = W; x >= 0; x -= 2) { const s = fn(x + 3) - fn(x - 3); c.lineTo(x, Yel(fn(x) - (s < 0 ? Math.min(depth, -s * 9) : 0))); } c.closePath(); c.fillStyle = fill; c.fill(); };
      const PK0 = [[2.62, 4.4, 0.16], [2.95, 5.6, 0.12], [3.5, 5.0, 0.14], [3.85, 4.2, 0.12], [0.3, 3.6, 0.2], [5.6, 3.8, 0.18], [1.5, 3.0, 0.22], [4.6, 3.3, 0.2]];
      const PK1 = [[2.78, 6.4, 0.075], [3.08, 4.6, 0.06], [3.32, 7.2, 0.07], [3.62, 5.2, 0.06], [3.98, 5.8, 0.08], [2.4, 4.4, 0.07], [0.15, 4.8, 0.09], [0.55, 3.8, 0.07], [5.85, 4.6, 0.08], [5.3, 3.4, 0.07], [1.2, 3.0, 0.1], [4.9, 3.6, 0.09]];
      const farA = ridge(PK0, 2.6, 0.35), farB = ridge(PK1, 2.2, 0.45);
      // зима (WIN): снег на хребтах ниже, склоны белые с серо-голубыми полосами террас (как зимние террасы vkit), тёмные сосны —
      // иначе под заснеженной улицей у горизонта стояла летняя зелёная равнина
      layer(x => Yel(farA(x)), WIN ? '#D3DBE8' : '#C3CDE0'); clipTo(x => Yel(farA(x))); snow(farA, WIN ? 3.2 : 5.2, 'rgba(240,244,252,0.9)'); shade(farA, 'rgba(150,166,200,0.25)', 1.4); c.restore();
      const far = x => Yel(farB(x));
      { const g = c.createLinearGradient(0, Yel(9), 0, Yel(1)); g.addColorStop(0, WIN ? '#C6D0E0' : '#A9B6CF'); g.addColorStop(1, WIN ? '#B4C2D6' : '#95A8C2'); layer(far, g); }
      clipTo(far);
      shade(farB, 'rgba(96,112,150,0.32)', 2.6);
      snow(farB, WIN ? 2.9 : 4.9, 'rgba(250,251,255,0.97)'); shade(farB, 'rgba(160,178,214,0.45)', 0.9);
      c.fillStyle = 'rgba(120,136,168,0.16)'; for (let i = 0; i < 90; i++) { const x = R() * W, y = far(x) + 10 + R() * 18; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14 + R() * 20, y + 20); c.lineTo(x - 4, y + 20); c.fill(); }   // тени-гряды
      c.restore();
      // 2. склон за долиной: зелёный, седловиной к перевалу впереди, террасы по горизонталям, перелески, дальние сёла
      const midEl = x => 1.2 + 6.6 * Math.pow(Math.abs(Math.sin(th(x) - PI)), 1.15) * (0.75 + 0.25 * nz(x, 3.7)) + 0.6 * nz(x, 5.2);
      const mid = x => Yel(midEl(x));
      { const g = c.createLinearGradient(0, Yel(9), 0, Yel(-2)); g.addColorStop(0, WIN ? '#EEF2F6' : '#9DB466'); g.addColorStop(0.6, WIN ? '#DFE6EE' : '#86A255'); g.addColorStop(1, WIN ? '#E6ECF2' : '#93AA70'); layer(mid, g); }
      clipTo(mid);
      stripes(mid, 46, 4, 3.4, WIN ? ['rgba(120,136,156,0.38)', 'rgba(255,255,255,0.55)'] : ['rgba(64,92,40,0.42)', 'rgba(216,230,138,0.32)'], [1.6, 1.0], 1.2);
      for (let i = 0; i < 420; i++) { const x = R() * W, y = mid(x) + 3 + R() * 70, a = R(), b = R(); c.fillStyle = WIN ? `rgba(${36 + a * 14},${52 + b * 16},${50},${0.35 + R() * 0.3})` : `rgba(${44 + a * 18},${70 + b * 20},${36},${0.35 + R() * 0.35})`; c.beginPath(); c.ellipse(x, y, 2 + R() * 4, 1.2 + R() * 2, 0, 0, TAU); c.fill(); }
      for (let i = 0; i < 26; i++) { const x = R() * W, y = mid(x) + 8 + R() * 40; c.fillStyle = WIN ? 'rgba(52,70,68,0.42)' : 'rgba(62,92,52,0.5)'; c.beginPath(); c.ellipse(x, y, 10 + R() * 24, 4 + R() * 6, 0, 0, TAU); c.fill(); }   // перелески
      PANO.lights.length = 0;
      for (let i = 0; i < 34; i++) { const x = R() * W, y = mid(x) + 10 + R() * 36, n = 4 + Math.floor(R() * 7);   // сёла: кучки домиков
        for (let j = 0; j < n; j++) { const hx = x + (R() - 0.5) * 22, hy = y + (R() - 0.5) * 7; c.fillStyle = R() < 0.6 ? 'rgba(238,232,218,0.92)' : R() < 0.5 ? 'rgba(120,160,206,0.9)' : 'rgba(178,160,136,0.9)'; c.fillRect(hx, hy, 3, 2.2); c.fillStyle = 'rgba(150,154,150,0.9)'; c.fillRect(hx - 0.4, hy - 0.8, 3.8, 0.9);
          if (R() < 0.55) PANO.lights.push([th(hx + 1.5), 0.5 - (hy + 1) / H]); } }
      c.restore();
      // 3. близкий склон слева (вверх от улицы): крупные террасы, тёмные кусты по откосам
      const nearEl = x => -1 + 15 * Math.pow(left(x), 1.6) * (0.85 + 0.15 * nz(x, 7.7)) + 2.2 * Math.pow(fwd(x), 3) * left(x);
      const near = x => Yel(nearEl(x));
      { const g = c.createLinearGradient(0, Yel(14), 0, Yel(-2)); g.addColorStop(0, WIN ? '#F2F5F8' : '#93B23C'); g.addColorStop(1, WIN ? '#DCE3EA' : '#7FA02E'); layer(near, g); }
      clipTo(near);
      stripes(near, 40, 3, 6, [WIN ? 'rgba(118,132,150,0.5)' : 'rgba(52,84,22,0.55)'], [2.4], 2.0); stripes(near, 40, 1, 6, [WIN ? 'rgba(255,255,255,0.6)' : 'rgba(214,228,108,0.45)'], [1.1], 2.0);
      for (let i = 0; i < 700; i++) { const x = R() * W, y = near(x) + 3 + R() * 160, a = R(), b = R(); c.fillStyle = WIN ? `rgba(${30 + a * 14},${46 + b * 16},${44},${0.45 + R() * 0.3})` : `rgba(${32 + a * 16},${56 + b * 20},${24},${0.5 + R() * 0.3})`; c.beginPath(); c.arc(x, y, 1.5 + R() * 3.2, 0, TAU); c.fill(); }
      c.restore();
      // 4. море облаков в долине (справа и впереди — под склоном), ниже — дымка
      { const base = x => Yel(-1.2 - 1.4 * (1 - right(x) * 0.6) + 0.5 * nz(x, 9.1));
        for (let i = 0; i < 520; i++) { const x = R() * W, k = 0.35 + 0.65 * Math.max(right(x), fwd(x) * 0.8), r = (4 + R() * 12) * k, y = base(x) - r * (0.2 + R() * 0.4); if (k < 0.4 && R() < 0.6) continue;
          c.fillStyle = 'rgba(206,218,234,1)'; c.beginPath(); c.arc(x, y + 2, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(250,251,253,1)'; c.beginPath(); c.arc(x - r * 0.15, y - r * 0.1, r * 0.86, 0, TAU); c.fill(); }
        c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 4) c.lineTo(x, base(x) + 2); c.lineTo(W, H); c.closePath(); const g = c.createLinearGradient(0, Yel(-2), 0, H); g.addColorStop(0, 'rgba(236,241,247,1)'); g.addColorStop(1, 'rgba(214,226,238,1)'); c.fillStyle = g; c.fill(); }
      const t = keepO(new T.CanvasTexture(cv)); t.anisotropy = HI ? 4 : 2;
      return t;
    }

    /* =================================================================
       8. ПРЕПЯТСТВИЯ (каталог CAT): общая геометрия на вид, экземпляры — из пула; звери — K.npc (как корова села)
       ================================================================= */
    // труба между точками A и B (оси любые): кольца по seg, крышки-веера (capCol) — бревно, тюк, бочка, колесо, жердь
    function tube(bk, A, B, r, seg, col, o = {}) {
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...d); if (!(L > 1e-5)) return; d[0] /= L; d[1] /= L; d[2] /= L;
      const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]], l1 = Math.hypot(...e1); e1[0] /= l1; e1[1] /= l1; e1[2] /= l1;
      const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
      const P = (C0, a, rr) => [C0[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * rr, C0[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * rr, C0[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * rr];
      const r1 = o.r1 !== undefined ? o.r1 : r, s = o.s !== undefined ? o.s : S.FLAT;
      for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, am = (a0 + a1) / 2, n = [e1[0] * Math.cos(am) + e2[0] * Math.sin(am), e1[1] * Math.cos(am) + e2[1] * Math.sin(am), e1[2] * Math.cos(am) + e2[2] * Math.sin(am)];
        bk.quadF(P(A, a0, r), P(A, a1, r), P(B, a1, r1), P(B, a0, r1), typeof col === 'function' ? col : col, s, n);
        if (o.cap !== false) { const cc = o.capCol || col; trd(bk, B, P(B, a0, r1), P(B, a1, r1), cc, s, d); trd(bk, A, P(A, a1, r), P(A, a0, r), cc, s, [-d[0], -d[1], -d[2]]); } }
    }
    const HAY = rgb('#D9C27A'), HAY2 = rgb('#C9AE62'), WOOD = C('wood'), WOODD = C('woodD');
    const hayCol = p => mul(HAY, 0.9 + 0.12 * Math.sin(p[0] * 13 + p[1] * 7 + p[2] * 11));
    const OB = {
      // тюки сена: два рулона лёжа (ось x), торцы — спираль темнее, перевязь; сверху — пучок соломы
      hay(bk) { [-0.47, 0.47].forEach(x => { tube(bk, [x - 0.44, 0.42, 0], [x + 0.44, 0.42, 0], 0.42, HI ? 14 : 10, hayCol, { capCol: HAY2 });
          [-1, 1].forEach(sd => { for (let k = 1; k <= 2; k++) tube(bk, [x + sd * 0.446, 0.42, 0], [x + sd * 0.45, 0.42, 0], 0.42 * k / 3, 8, mul(HAY2, 0.86), { cap: false }); });
          tube(bk, [x - 0.15, 0.42, 0], [x - 0.11, 0.42, 0], 0.425, 10, rgb('#8A6A3A'), { cap: false }); tube(bk, [x + 0.11, 0.42, 0], [x + 0.15, 0.42, 0], 0.425, 10, rgb('#8A6A3A'), { cap: false }); });
        for (let i = 0; i < 5; i++) bar(bk, [-0.2 + i * 0.1, 0.8, 0.05], [-0.25 + i * 0.12, 0.89, 0.12], 0.02, HAY); },
      // каменная скамья с синей подушкой; на краю спит котик (круглый «хлебушек» с ушками)
      bench(bk) { const st = mul(C('tread'), 1.02), F = new K.Frame(0, 0, 0, 0);
        bk.box(F, 0, 0.42, 0.02, 2.0, 0.12, 0.42, { col: st, s: S.SLAB }); [-0.75, 0.75].forEach(x => bk.box(F, x, 0.18, 0.02, 0.3, 0.36, 0.36, { col: mul(st, 0.9), s: S.RUBBLE, skip: { py: 1 } }));
        bk.box(F, 0, 0.62, -0.2, 2.0, 0.3, 0.1, { col: st, s: S.SLAB }); bk.box(F, -0.35, 0.52, 0.03, 1.0, 0.08, 0.36, { col: C('blue'), cols: { py: C('blueHi') } });
        const cx = 0.6, cc = rgb('#E8A050'), cw = rgb('#F4EEE2'); bk.sph(cx, 0.6, 0.02, 0.22, 0.13, 0.16, cc, { seg: 7, rings: 4 }); bk.sph(cx - 0.2, 0.62, 0.04, 0.12, 0.11, 0.11, cc, { seg: 6, rings: 4 }); bk.sph(cx - 0.25, 0.6, 0.12, 0.05, 0.04, 0.03, cw, { seg: 5, rings: 3 });
        [-1, 1].forEach(sd => trd(bk, [cx - 0.24 + sd * 0.05, 0.69, 0.02], [cx - 0.2 + sd * 0.1, 0.69, 0.02], [cx - 0.22 + sd * 0.08, 0.76, 0.02], cc, S.FLAT, [0, 0, 1]));
        tube(bk, [cx + 0.2, 0.55, 0.12], [cx - 0.1, 0.53, 0.16], 0.035, 5, cc, {}); },
      // корзины с яблоками и медный кувшин между ними
      baskets(bk) { const wk = rgb('#B98A4E'), wk2 = rgb('#9A6E3A');
        [-0.6, 0.6].forEach((x, i) => { bk.cyl(x, 0, 0, 0.26, 0.34, 0.42, { seg: 10, col: p => mul(Math.sin(p[1] * 50) > 0 ? wk : wk2, 1), cap: false }); bk.cyl(x, 0.02, 0, 0.27, 0.27, 0.01, { seg: 10, col: wk2 });
          bk.cyl(x, 0.4, 0, 0.35, 0.36, 0.05, { seg: 10, col: wk2, cap: false });
          for (let k = 0; k < 9; k++) { const a = k * 2.4, r = k ? 0.18 : 0, ax = x + Math.cos(a) * r, az = Math.sin(a) * r; bk.sph(ax, 0.44 + (k ? 0 : 0.06), az, 0.1, 0.09, 0.1, rgb(i ? (k % 3 ? '#D9455A' : '#F2B33D') : (k % 2 ? '#8EB84A' : '#D9455A')), { seg: 5, rings: 3 }); } });
        // медный кувшин (профиль по точкам [r, y]) и ручка
        const cu = C('copper'), prof = [[0.11, 0], [0.17, 0.15], [0.15, 0.3], [0.07, 0.42], [0.055, 0.5], [0.08, 0.56]];
        for (let i = 0; i < prof.length - 1; i++) bk.cyl(0, prof[i][1], 0.1, prof[i][0], prof[i + 1][0], prof[i + 1][1] - prof[i][1], { seg: 8, col: mul(cu, 0.95 + 0.1 * (i % 2)), cap: i === prof.length - 2 });
        tube(bk, [0.06, 0.5, 0.1], [0.19, 0.38, 0.1], 0.022, 5, cu, {}); tube(bk, [0.19, 0.38, 0.1], [0.15, 0.22, 0.1], 0.022, 5, cu, {}); },
      // две бочки на боку (ось x) — катятся к героине: обручи, торцы досками
      barrels(bk) { [-0.4, 0.4].forEach(x => { const r = 0.39;
          for (let k = 0; k < 4; k++) { const xa = x - 0.37 + k * 0.185, xb = xa + 0.185, ra = r * (0.88 + 0.12 * Math.sin((k / 4) * PI)), rb = r * (0.88 + 0.12 * Math.sin(((k + 1) / 4) * PI)); tube(bk, [xa, 0, 0], [xb, 0, 0], ra, 10, k % 3 === 0 ? WOOD : mul(WOOD, 1.08), { r1: rb, cap: false }); }
          [-0.3, 0.3].forEach(dx => tube(bk, [x + dx - 0.03, 0, 0], [x + dx + 0.03, 0, 0], r * 0.97 + 0.012, 10, rgb('#4A4A52'), { cap: false }));
          [-1, 1].forEach(sd => tube(bk, [x + sd * 0.36, 0, 0], [x + sd * 0.37, 0, 0], r * 0.88, 10, WOODD, { cap: true, capCol: mul(WOODD, 0.9) })); }); },
      // жердь-шлагбаум на каменных столбиках (синие и белые полосы), красная ленточка
      gate(bk) { const st = mul(C('tread'), 0.98), F = new K.Frame(0, 0, 0, 0);
        [-0.96, 0.96].forEach(x => { bk.box(F, x, 0.5, 0, 0.18, 1.0, 0.18, { col: st, s: S.RUBBLE, cols: { py: mul(st, 1.1) } }); bk.box(F, x, 1.02, 0, 0.22, 0.05, 0.22, { col: mul(st, 1.12), s: S.SLAB }); });
        for (let i = 0; i < 8; i++) { const xa = -0.95 + i * 1.9 / 8, xb = xa + 1.9 / 8; tube(bk, [xa, 0.86, 0], [xb, 0.86, 0], 0.07, 8, i % 2 ? C('blue') : rgb('#F4F2EC'), { cap: false }); }
        tube(bk, [-0.95, 0.64, 0.02], [0.95, 0.64, 0.02], 0.045, 6, WOOD, { cap: false });
        const n0 = bk.n; trd(bk, [0.1, 0.86, 0.08], [0.24, 0.86, 0.08], [0.2, 0.62, 0.1], rgb('#C2405B'), S.FLAT, [0, 0, 1]); trd(bk, [0.24, 0.86, 0.06], [0.1, 0.86, 0.06], [0.2, 0.62, 0.05], rgb('#A2304B'), S.FLAT, [0, 0, -1]); fxMark(bk, n0, 0, 0.8); },
      // ковры и бельё на верёвке между жердями: низ 1,05, верх 2,4
      carpet(bk, v) { const F = new K.Frame(0, 0, 0, 0);
        [-1.05, 1.05].forEach(x => bk.box(F, x, 1.2, 0, 0.09, 2.4, 0.09, { col: WOODD }));
        bar(bk, [-1.05, 2.34, 0], [1.05, 2.34, 0], 0.03, rgb('#D8CFC0'));
        const pals = [['#8E2A2A', '#B8403A', '#F2C94C'], ['#1F4E8C', '#3F78B8', '#F4EEE2'], ['#6A2E4A', '#A04E6A', '#E8C770'], ['#2E6E6A', '#5FB3B3', '#F2EADA']].map(p => p.map(rgb));
        const n0 = bk.n;
        [[-0.52, 0.92, 1.12], [0.5, 0.95, 1.08]].forEach(([x, w, y0], i) => { const pl = pals[(i + (v || 0)) % pals.length], y1 = 2.32, z = 0.0;
          [1, -1].forEach(sd => { const zz = z + sd * 0.012, dir = [0, 0, sd];
            bk.quadF([x - w / 2, y0, zz], [x + w / 2, y0, zz], [x + w / 2, y1, zz], [x - w / 2, y1, zz], pl[0], S.FLAT, dir);
            bk.quadF([x - w / 2 + 0.08, y0 + 0.08, zz + sd * 0.004], [x + w / 2 - 0.08, y0 + 0.08, zz + sd * 0.004], [x + w / 2 - 0.08, y1 - 0.08, zz + sd * 0.004], [x - w / 2 + 0.08, y1 - 0.08, zz + sd * 0.004], pl[1], S.FLAT, dir);
            [0.32, 0, -0.32].forEach(dy => { const yc = (y0 + y1) / 2 + dy, r = 0.2; bk.quadF([x, yc - r, zz + sd * 0.008], [x + r * 0.8, yc, zz + sd * 0.008], [x, yc + r, zz + sd * 0.008], [x - r * 0.8, yc, zz + sd * 0.008], pl[2], S.FLAT, dir); });
            for (let k = 0; k < 6; k++) { const fx = x - w / 2 + 0.08 + k * (w - 0.16) / 5; bk.quadF([fx - 0.015, y0 - 0.07, zz], [fx + 0.015, y0 - 0.07, zz], [fx + 0.015, y0, zz], [fx - 0.015, y0, zz], pl[2], S.FLAT, dir); } }); });
        fxMark(bk, n0, 0, 0.55);
        [-0.3, 0.3].forEach(x => { const yA = 2.34; bk.box(F, x, yA - 0.05, 0.02, 0.04, 0.12, 0.03, { col: rgb('#C8A070') }); }); },
      // низкая балка с навесом из досок (как у лавки): столбы по краям, брус, скат досок 1,25…1,7
      beam(bk) { const F = new K.Frame(0, 0, 0, 0);
        [-1.04, 1.04].forEach(x => bk.box(F, x, 0.85, 0.0, 0.12, 1.7, 0.12, { col: WOODD }));
        bk.box(F, 0, 1.16, 0.12, 2.2, 0.2, 0.2, { col: WOOD, cols: { ny: mul(WOOD, 0.8) } });
        for (let i = 0; i < 7; i++) { const xa = -1.1 + i * 2.2 / 7, xb = xa + 2.2 / 7 - 0.02; bk.quadF([xa, 1.3, 0.3], [xb, 1.3, 0.3], [xb, 1.68, -0.3], [xa, 1.68, -0.3], mul(WOOD, 0.92 + (i % 3) * 0.06), S.FLAT, [0, 1, 0.6]); bk.quadF([xb, 1.27, 0.3], [xa, 1.27, 0.3], [xa, 1.65, -0.3], [xb, 1.65, -0.3], mul(WOODD, 0.8), S.FLAT, [0, -1, -0.6]); }
        bk.box(F, 0, 1.3, 0.29, 2.2, 0.06, 0.04, { col: C('blue') });
        for (let i = 0; i < 9; i++) { const x = -0.9 + i * 0.225; bk.sph(x, 1.12 + (i % 2) * 0.02, 0.27, 0.05, 0.08, 0.05, rgb(i % 3 ? '#C9302C' : '#E8C770'), { seg: 5, rings: 2 }); } },
      // лавка базара: прилавок с фруктами, полосатый навес, вывесочка-флажок, ящики
      stall(bk, v) { const F = new K.Frame(0, 0, 0, 0), cols = [['#C2405B', '#F4EEE2'], ['#3F78B8', '#F4EEE2'], ['#2E8A6A', '#F4EEE2']][(v || 0) % 3].map(rgb);
        bk.box(F, 0, 0.47, 0.55, 2.0, 0.94, 1.0, { col: WOOD, cols: { py: WOODD }, skip: { ny: 1 } });
        for (let k = 0; k < 4; k++) bk.box(F, 0, 0.2 + k * 0.22, 1.055, 2.0, 0.02, 0.01, { col: mul(WOOD, 0.8) });
        [[-1.0, 1.0], [1.0, 1.0], [-1.0, -1.15], [1.0, -1.15]].forEach(([x, z]) => bk.box(F, x, z > 0 ? 1.1 : 1.25, z, 0.08, z > 0 ? 2.2 : 2.5, 0.08, { col: WOODD }));
        for (let i = 0; i < 7; i++) { const xa = -1.05 + i * 2.1 / 7, xb = xa + 2.1 / 7; bk.quadF([xa, 2.2, 1.25], [xb, 2.2, 1.25], [xb, 2.58, -1.25], [xa, 2.58, -1.25], cols[i % 2], S.FLAT, [0, 1, 0.3]); bk.quadF([xb, 2.18, 1.25], [xa, 2.18, 1.25], [xa, 2.56, -1.25], [xb, 2.56, -1.25], mul(cols[i % 2], 0.75), S.FLAT, [0, -1, -0.3]);
          bk.quadF([xa, 1.98, 1.25], [xb, 1.98, 1.25], [xb, 2.2, 1.25], [xa, 2.2, 1.25], cols[i % 2], S.FLAT, [0, 0, 1]); }
        const ware = [['#E0663A', '#F2B33D', '#C9405A'], ['#8E3A7A', '#6E9A3E', '#E8C770'], ['#D9455A', '#8EB84A', '#F2C94C']][(v || 0) % 3].map(rgb);
        for (let i = 0; i < 12; i++) { const x = -0.8 + (i % 6) * 0.32, z = 0.3 + Math.floor(i / 6) * 0.35; bk.sph(x, 0.98 + (i % 2) * 0.03, z, 0.13, 0.11, 0.13, ware[i % 3], { seg: 5, rings: 3 }); }
        bk.box(F, -0.45, 0.2, -0.6, 0.6, 0.4, 0.5, { col: WOOD }); bk.box(F, 0.35, 0.2, -0.7, 0.55, 0.4, 0.45, { col: mul(WOOD, 0.9) });
        bk.cyl(0.6, 0.94, 0.7, 0.16, 0.2, 0.24, { seg: 8, col: C('silverWare') }); },
      // сарай/хлев с плоской крышей (по крыше бегут): бут, деревянные ворота спереди, окошки, край крыши; длина — len
      shed(bk, v, len) { const L = len || 8, F = new K.Frame(0, 0, 0, 0), wl = [0.96, 0.95, 0.91], top = 2.4;
        bk.box(F, 0, top / 2 - 0.15, 0, 2.1, top - 0.3 + 0.0, L, { col: wl, s: S.RUBBLE, skip: { py: 1, ny: 1 } });
        bk.box(F, 0, top - 0.08, 0, 2.12, 0.16, L + 0.04, { col: mul(C('parapetCap'), 1.05), s: S.SLAB, cols: { py: mul(C('yard'), 1.02) }, ss: { py: S.SLAB } });
        const dz = L / 2 + 0.01; qvF(bk, F, [[-0.75, 0.0, dz], [0.75, 0.0, dz], [0.75, 1.85, dz], [-0.75, 1.85, dz]], WOODD, S.FLAT);
        for (let k = 0; k < 5; k++) { const x = -0.7 + k * 0.35; qvF(bk, F, [[x + 0.02, 0.05, dz + 0.01], [x + 0.31, 0.05, dz + 0.01], [x + 0.31, 1.8, dz + 0.01], [x + 0.02, 1.8, dz + 0.01]], mul(WOOD, 0.9 + (k % 2) * 0.12), S.FLAT); }
        bar(bk, [-0.7, 1.25, dz + 0.03], [0.7, 0.45, dz + 0.03], 0.06, WOODD); bar(bk, [-0.7, 0.45, dz + 0.03], [0.7, 1.25, dz + 0.03], 0.06, WOODD);
        for (let z = L / 2 - 2; z > -L / 2 + 1; z -= 3) [-1, 1].forEach(sd => { const x = sd * 1.06; qvF(bk, F, sd > 0 ? [[x, 1.3, z + 0.35], [x, 1.3, z - 0.35], [x, 1.8, z - 0.35], [x, 1.8, z + 0.35]] : [[x, 1.3, z - 0.35], [x, 1.3, z + 0.35], [x, 1.8, z + 0.35], [x, 1.8, z - 0.35]], rgb('#2E3F4A'), S.FLAT); });
        for (let i = 0; i < Math.floor(L / 3); i++) { const z = L / 2 - 1.2 - i * 3, x = (i % 2 ? 0.5 : -0.5); bk.sph(x, top + 0.02, z, 0.22, 0.08, 0.22, mix(C('grass2'), C('moss'), 0.5), { seg: 5, rings: 2 }); }
        bk.box(F, 0, top - 0.25, dz + 0.12, 2.2, 0.12, 0.24, { col: WOODD }); },
      // дощатый настил к крыше: низ на z = +2, верх 2,4 на z = −2; бортики, поперечины, опоры
      ramp(bk) { const F = new K.Frame(0, 0, 0, 0), n = 12, top = 2.4;
        for (let i = 0; i < n; i++) { const z0 = 2 - 4 * i / n, z1 = 2 - 4 * (i + 1) / n, y0 = top * i / n, y1 = top * (i + 1) / n, c = mul(WOOD, 0.9 + (i % 2) * 0.1);
          bk.quadF([-1.0, y0 + 0.06, z0], [1.0, y0 + 0.06, z0], [1.0, y1 + 0.06, z1], [-1.0, y1 + 0.06, z1], c, S.FLAT, [0, 1, 0.6]);
          bk.quadF([-1.0, y0 + 0.06, z0], [1.0, y0 + 0.06, z0], [1.0, y0 - 0.02, z0 + 0.02], [-1.0, y0 - 0.02, z0 + 0.02], mul(WOODD, 0.9), S.FLAT, [0, -0.5, 1]); }
        [-1.02, 1.02].forEach(x => { trd(bk, [x, 0, 2], [x, 0, -2], [x, top, -2], WOODD, S.FLAT, [Math.sign(x), 0, 0]); bar(bk, [x, 0.12, 2], [x, top + 0.12, -2], 0.09, WOOD); });
        [[0.6, 0.72], [-0.6, 1.8], [-1.9, top - 0.05]].forEach(([z, h]) => [-0.85, 0.85].forEach(x => bk.box(F, x, h / 2, z, 0.12, h, 0.12, { col: WOODD, skip: { py: 1 } }))); },
      // свадебный стол: белая скатерть до земли, блюда с фруктами, круглые лепёшки и серебряный кувшин с чернью — кубачинский
      // (в кувшине — компот)
      table(bk) { const F = new K.Frame(0, 0, 0, 0), cl = rgb('#F6F2EA'), sv = C('silverWare');
        bk.box(F, 0, 0.76, 0, 2.0, 0.06, 0.9, { col: cl }); bk.box(F, 0, 0.4, 0, 1.96, 0.7, 0.86, { col: mul(cl, 0.92), skip: { py: 1, ny: 1 } });
        for (let i = 0; i < 4; i++) bk.box(F, -0.75 + i * 0.5, 0.5, 0.435, 0.3, 0.42, 0.01, { col: rgb(i % 2 ? '#C2405B' : '#3F78B8') });   // вышитые ленты по краю
        const fr = [rgb('#D9455A'), rgb('#F2B33D'), rgb('#8EB84A'), rgb('#8E3A7A')];
        [-0.65, 0.05].forEach((x, j) => { bk.cyl(x, 0.79, 0.05, 0.22, 0.24, 0.03, { seg: 10, col: sv }); for (let k = 0; k < 7; k++) { const a = k * 2.4, r = k ? 0.12 : 0; bk.sph(x + Math.cos(a) * r, 0.86 + (k ? 0 : 0.03), 0.05 + Math.sin(a) * r, 0.06, 0.055, 0.06, fr[(k + j) % 4], { seg: 5, rings: 3 }); } });
        bk.cyl(-0.3, 0.79, -0.22, 0.17, 0.16, 0.04, { seg: 9, col: rgb('#D8A860') }); bk.cyl(0.4, 0.79, -0.25, 0.16, 0.15, 0.04, { seg: 9, col: rgb('#C99A50') });
        const prof = [[0.08, 0], [0.12, 0.08], [0.1, 0.2], [0.05, 0.28], [0.04, 0.34], [0.06, 0.38]];
        for (let i = 0; i < prof.length - 1; i++) bk.cyl(0.62, 0.79 + prof[i][1], 0.0, prof[i][0], prof[i + 1][0], prof[i + 1][1] - prof[i][1], { seg: 9, col: i === 2 ? rgb('#4A4E58') : sv, cap: i === prof.length - 2 }); },
      // танцоры: v0 — парень в черкеске с газырями и папахе, руки в стороны (лезгинка); v1 — девушка в длинном бордовом платье с
      // золотой каймой и белым платком, руки плавно вверх. Габарит 0,8 × 1,85 × 0,6
      dancer(bk, v) { const F = new K.Frame(0, 0, 0, 0), skin = rgb('#F2D2BC');
        if (v % 2 === 0) { const coat = rgb('#2F3A4E'), boot = rgb('#2A2624');
          [-0.1, 0.1].forEach(x => bk.box(F, x, 0.4, 0, 0.13, 0.8, 0.15, { col: boot }));
          bk.cyl(0, 0.55, 0, 0.3, 0.2, 0.62, { seg: 9, col: coat, cap: false }); bk.cyl(0, 1.1, 0, 0.2, 0.17, 0.45, { seg: 9, col: coat });
          [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) bk.cyl(sd * 0.1, 1.2 + i * 0.06, 0.17, 0.012, 0.012, 0.07, { seg: 4, col: rgb('#E8E2D2'), cap: false }); });
          bk.box(F, 0, 1.1, 0, 0.42, 0.05, 0.38, { col: rgb('#3A2A22') }); bk.box(F, 0, 1.1, 0.19, 0.1, 0.08, 0.03, { col: C('silverWare') });
          tube(bk, [0.17, 1.47, 0], [0.38, 1.62, 0.02], 0.055, 6, coat, {}); tube(bk, [0.38, 1.62, 0.02], [0.38, 1.82, 0.05], 0.05, 6, coat, {});   // правая — вверх
          tube(bk, [-0.17, 1.47, 0], [-0.4, 1.42, 0.05], 0.055, 6, coat, {}); tube(bk, [-0.4, 1.42, 0.05], [-0.4, 1.4, 0.32], 0.05, 6, coat, {});   // левая — вперёд
          bk.sph(0, 1.62, 0, 0.11, 0.13, 0.11, skin, { seg: 7, rings: 5 }); bk.cyl(0, 1.67, 0, 0.13, 0.14, 0.17, { seg: 9, col: rgb('#F4F0E8') }); }
        else { const dr = rgb('#8E2A3A'), gold = rgb('#E8C770'), sc = rgb('#FBF8F2');
          bk.cyl(0, 0.0, 0, 0.36, 0.17, 1.15, { seg: 10, col: p => (p[1] < 0.12 ? gold : dr), cap: false }); bk.cyl(0, 1.15, 0, 0.17, 0.15, 0.32, { seg: 9, col: dr });
          bk.box(F, 0, 1.1, 0, 0.36, 0.04, 0.3, { col: gold });
          tube(bk, [0.15, 1.42, 0], [0.33, 1.6, 0.06], 0.045, 6, dr, {}); tube(bk, [0.33, 1.6, 0.06], [0.28, 1.8, 0.12], 0.04, 6, dr, {});
          tube(bk, [-0.15, 1.42, 0], [-0.36, 1.5, 0.05], 0.045, 6, dr, {}); tube(bk, [-0.36, 1.5, 0.05], [-0.38, 1.68, 0.12], 0.04, 6, dr, {});
          bk.sph(0, 1.6, 0, 0.11, 0.13, 0.11, skin, { seg: 7, rings: 5 });
          bk.sph(0, 1.64, -0.02, 0.135, 0.15, 0.135, sc, { seg: 8, rings: 5, cut: 0 }); bk.cyl(0, 1.0, -0.08, 0.14, 0.24, 0.66, { seg: 8, col: sc, cap: false });   // платок на голове и по спине
        } },
      // санки: деревянные полозья с красными загибами, сиденье; на санках — малыш в красной шапке с помпоном и шарфе, машет
      sled(bk) { const F = new K.Frame(0, 0, 0, 0), wd = C('wood'), red = rgb('#C2403A');
        [-0.45, 0.45].forEach(x => { tube(bk, [x, 0.06, 0.45], [x, 0.06, -0.45], 0.035, 5, red, {}); tube(bk, [x, 0.06, 0.45], [x, 0.2, 0.55], 0.035, 5, red, {}); [0.3, -0.3].forEach(z => bar(bk, [x, 0.06, z], [x, 0.26, z], 0.04, wd)); });
        for (let i = 0; i < 4; i++) bk.box(F, 0, 0.28, -0.36 + i * 0.24, 1.0, 0.04, 0.18, { col: mul(wd, 0.95 + (i % 2) * 0.08) });
        const jk = rgb('#3F78B8'), skin = rgb('#F2D2BC');
        bk.sph(0, 0.5, -0.05, 0.22, 0.22, 0.2, jk, { seg: 8, rings: 5 }); bk.sph(0, 0.76, -0.02, 0.12, 0.12, 0.12, skin, { seg: 7, rings: 5 });
        bk.sph(0, 0.81, -0.03, 0.13, 0.08, 0.13, red, { seg: 8, rings: 4, cut: 0 }); bk.sph(0, 0.86, -0.03, 0.04, 0.04, 0.04, rgb('#FFFFFF'), { seg: 5, rings: 3 });
        bk.box(F, 0, 0.66, 0.0, 0.26, 0.06, 0.24, { col: rgb('#F2C94C') });
        tube(bk, [0.18, 0.58, 0], [0.34, 0.8, 0.05], 0.045, 6, jk, {}); tube(bk, [-0.18, 0.56, 0], [-0.3, 0.42, 0.22], 0.045, 6, jk, {}); },
      // камушки с глазками (как на щите «Осторожно, камушки» дороги к селу): три круглых валуна, у каждого — глазки
      rock(bk) { const RC = [rgb('#9C8E80'), rgb('#B3A596'), rgb('#8E8072')];
        [[-0.42, 0.3, 0.05, 0.36], [0.38, 0.33, -0.05, 0.38], [0.0, 0.25, 0.22, 0.27]].forEach(([x, y, z, r], i) => {
          bk.sph(x, y, z, r, r * 0.95, r * 0.9, (p, ny) => mul(RC[i], 0.84 + 0.22 * Math.max(0, ny)), { seg: 9, rings: 6 });
          [-1, 1].forEach(sd => { bk.sph(x + sd * r * 0.3, y + r * 0.2, z + r * 0.84, r * 0.2, r * 0.22, r * 0.08, rgb('#FFFFFF'), { seg: 6, rings: 3 }); bk.sph(x + sd * r * 0.3 + sd * 0.01, y + r * 0.19, z + r * 0.9, r * 0.1, r * 0.11, r * 0.05, rgb('#3A2E3F'), { seg: 5, rings: 3 }); }); }); },
      // снеговики: сугроб и на нём два снеговичка (морковки, угольки, шарфики разного цвета, на одном — маленькая папаха)
      snowman(bk) { const sn = rgb('#F4F7FB');
        bk.sph(0, 0.0, 0, 0.95, 0.32, 0.45, sn, { seg: 9, rings: 4, cut: 0 });
        [[-0.48, '#C2405B', 1], [0.5, '#3F78B8', 0]].forEach(([x, scf, hat]) => { const y0 = 0.2;
          bk.sph(x, y0 + 0.18, 0, 0.22, 0.2, 0.22, sn, { seg: 8, rings: 5 }); bk.sph(x, y0 + 0.47, 0, 0.15, 0.14, 0.15, sn, { seg: 8, rings: 5 });
          bk.cyl(x, y0 + 0.33, 0, 0.13, 0.13, 0.05, { seg: 8, col: rgb(scf) });
          tube(bk, [x, y0 + 0.48, 0.13], [x, y0 + 0.47, 0.28], 0.025, 5, rgb('#F08A2E'), { r1: 0.004 });
          [-1, 1].forEach(sd => bk.sph(x + sd * 0.05, y0 + 0.53, 0.13, 0.018, 0.018, 0.018, rgb('#2A2624'), { seg: 4, rings: 2 }));
          if (hat) bk.cyl(x, y0 + 0.58, 0, 0.1, 0.11, 0.1, { seg: 8, col: rgb('#2A2624') }); }); },
      // сосульки: заснеженная балка галереи на столбах, с неё свисают сосульки (до 1,1 м) — подкат
      icicles(bk) { const F = new K.Frame(0, 0, 0, 0), ice = rgb('#CFE6F4');
        [-1.04, 1.04].forEach(x => bk.box(F, x, 0.85, 0, 0.14, 1.7, 0.14, { col: WOODD }));
        bk.box(F, 0, 1.42, 0, 2.2, 0.28, 0.5, { col: C('blue'), cols: { py: rgb('#F4F7FB') } }); bk.box(F, 0, 1.62, 0, 2.24, 0.1, 0.56, { col: rgb('#F4F7FB') });
        for (let i = 0; i < 11; i++) { const x = -0.95 + i * 0.19, L = 0.12 + ((i * 7) % 5) * 0.045 + (i % 3 === 0 ? 0.08 : 0); bk.cyl(x, 1.28 - L, 0.16, 0.0, 0.035 + (i % 2) * 0.01, L, { seg: 5, col: ice, cap: false }); } },
    };
    // метки поперечных: круг-ковёр танцора (красный с золотой каймой и розеткой) и ледяная дорожка санок (с горки слева до конца,
    // в конце — снежный валик-«тормоз»). Обе — отдельной сеткой в группе препятствия; ядро двигает фигуру, метка стоит на месте
    function rugGeo(bk) { const n = 18, R0 = 0.95, y = 0.015;
      for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU;
        bk.quadF([Math.sin(a) * R0, y, Math.cos(a) * R0], [Math.sin(b) * R0, y, Math.cos(b) * R0], [Math.sin(b) * R0 * 0.82, y, Math.cos(b) * R0 * 0.82], [Math.sin(a) * R0 * 0.82, y, Math.cos(a) * R0 * 0.82], rgb('#E8C770'), S.FLAT, [0, 1, 0]);
        trd(bk, [0, y, 0], [Math.sin(a) * R0 * 0.82, y, Math.cos(a) * R0 * 0.82], [Math.sin(b) * R0 * 0.82, y, Math.cos(b) * R0 * 0.82], i % 2 ? rgb('#B8303A') : rgb('#A82A34'), S.FLAT, [0, 1, 0]); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, x = Math.sin(a) * 0.42, z = Math.cos(a) * 0.42; bk.quadF([x - 0.09, y + 0.004, z], [x, y + 0.004, z - 0.14], [x + 0.09, y + 0.004, z], [x, y + 0.004, z + 0.14], rgb('#F2C94C'), S.FLAT, [0, 1, 0]); } }
    function trackGeo(bk, lane) { const xf = (lane - 1) * LANE, x0 = -6.2, L = xf - x0, ice = rgb('#7FB4DA'), y = 0.012;
      // в локальных координатах группы с x = xf (санки в конце): дорожка от x0 − xf до 0
      bk.quadF([x0 - xf, y, 0.55], [0.35, y, 0.55], [0.35, y, -0.55], [x0 - xf, y, -0.55], p => mul(ice, 0.92 + 0.1 * Math.sin(p[0] * 3.1)), S.FLAT, [0, 1, 0]);
      for (let x = x0 - xf + 0.6; x < -0.3; x += 1.2) bk.quadF([x, y + 0.004, 0.12], [x + 0.5, y + 0.004, 0], [x, y + 0.004, -0.12], [x - 0.1, y + 0.004, 0], rgb('#FFFFFF'), S.FLAT, [0, 1, 0]);   // стрелки по ходу санок
      bk.sph(0.85, 0, 0, 0.32, 0.26, 0.6, rgb('#F4F7FB'), { seg: 7, rings: 3, cut: 0 });   // валик в конце
      // флажок на валике: красно-белый, на шесте 1,6 м — «санки остановятся здесь» видно издалека, и на белом снегу
      bk.cyl(0.85, 0, 0, 0.025, 0.025, 1.65, { seg: 5, col: rgb('#5A4A3E'), cap: false });
      trd(bk, [0.85, 1.65, 0], [0.85, 1.25, 0], [1.4, 1.45, 0], rgb('#D8343C'), S.FLAT, [0, 0, 1]); trd(bk, [0.85, 1.65, 0], [1.4, 1.45, 0], [0.85, 1.25, 0], rgb('#B82A32'), S.FLAT, [0, 0, -1]); }
    // повозка без ослика (ослик — свой npc): кузов на колёсах, сено горкой; оглобли вперёд (к +z); колёса — отдельной сеткой (крутятся)
    function cartGeo(bk) { const F = new K.Frame(0, 0, -0.9, 0);
      bk.box(F, 0, 0.75, 0, 1.7, 0.12, 2.6, { col: WOOD, cols: { py: WOODD } });
      [-0.85, 0.85].forEach(x => bk.box(F, x, 1.05, 0, 0.08, 0.5, 2.6, { col: WOOD, cols: { px: mul(WOOD, 0.9), nx: mul(WOOD, 0.9) } }));
      [-1.3, 1.3].forEach(z => bk.box(F, 0, 1.05, z, 1.7, 0.5, 0.08, { col: mul(WOOD, 0.95) }));
      bk.sph(0, 1.3, -0.9, 0.95, 0.9, 1.3, hayCol, { seg: HI ? 10 : 8, rings: 5, cut: 0 }); bk.sph(0.2, 1.75, -1.0, 0.6, 0.45, 0.8, hayCol, { seg: 7, rings: 4 });
      [-0.45, 0.45].forEach(x => bar(bk, [x, 0.8, 0.4], [x * 0.75, 0.85, 1.8], 0.07, WOODD)); bar(bk, [-0.34, 0.85, 1.8], [0.34, 0.85, 1.8], 0.06, WOODD); }
    function wheelGeo(bk) { tube(bk, [-0.06, 0, 0], [0.06, 0, 0], 0.46, 12, WOODD, { cap: false }); for (let k = 0; k < 6; k++) { const a = k / 6 * PI; bar(bk, [0, -Math.cos(a) * 0.42, -Math.sin(a) * 0.42], [0, Math.cos(a) * 0.42, Math.sin(a) * 0.42], 0.06, WOOD); } tube(bk, [-0.1, 0, 0], [0.1, 0, 0], 0.1, 6, rgb('#4A4A52'), {}); }

    // звери (vkit K.npc: тун, контур, лицо с морганием, ноги-группы): корова (как в селе) и ослик
    function makeCow() {
      return K.npc('cow', ({ n, body, P, face, M, GEO, capG }) => {
        const w = M('#F4F1EA'), sp = M('#8A5A3E'), spD = M('#6E4632'), pk = M('#F2B8B0'), hoof = M('#5E4A40'), horn = M('#EFE4CC'), bell = M('#E8C770', { emissive: '#C9A040', emissiveIntensity: 0.12 }), strap = M('#C2405B');
        P(body, capG(0.27, 0.5), w, [0, 0.66, 0], null, [PI / 2, 0, 0]);
        P(body, GEO.sph, sp, [0.2, 0.74, -0.08], [0.11, 0.17, 0.2], null, false); P(body, GEO.sph, sp, [-0.21, 0.62, 0.14], [0.1, 0.14, 0.15], null, false); P(body, GEO.sph, spD, [0.0, 0.92, -0.25], [0.16, 0.06, 0.14], null, false);
        P(body, GEO.sph, pk, [0, 0.42, -0.12], [0.09, 0.06, 0.09], null, false);
        n.legsF = new T.Group(); n.legsF.position.set(0, 0.46, 0.26); body.add(n.legsF);
        n.legsB = new T.Group(); n.legsB.position.set(0, 0.46, -0.26); body.add(n.legsB);
        [n.legsF, n.legsB].forEach(lg => [-1, 1].forEach(sd => { P(lg, GEO.cyl, w, [sd * 0.13, -0.2, 0], [0.065, 0.4, 0.065]); P(lg, GEO.sph, hoof, [sd * 0.13, -0.41, 0.01], [0.07, 0.04, 0.075], null, false); }));
        n.extraDyn = [n.legsF, n.legsB];
        n.tail = new T.Group(); n.tail.position.set(0, 0.84, -0.5); body.add(n.tail); P(n.tail, GEO.cyl, w, [0, -0.17, -0.02], [0.022, 0.34, 0.022], [0.15, 0, 0]); P(n.tail, GEO.sph, spD, [0, -0.36, -0.05], [0.05, 0.08, 0.05], null, false);
        P(body, GEO.torus, strap, [0, 0.9, 0.42], [0.13, 0.13, 0.1], [PI / 2 - 0.5, 0, 0], false); P(body, GEO.cyl, bell, [0, 0.75, 0.52], [0.045, 0.07, 0.045], null, false);
        const head = new T.Group(); head.position.set(0, 1.0, 0.5); body.add(head); n.head = head;
        P(head, GEO.sph, w, [0, 0, 0], [0.2, 0.19, 0.21]); P(head, GEO.sph, pk, [0, -0.08, 0.15], [0.15, 0.1, 0.1], null, false);
        P(head, GEO.sph, sp, [0.1, 0.08, 0.07], [0.09, 0.08, 0.12], null, false);
        face(head, { er: 30, ex: 86, ey: 318, nose: '#B9776E', noseW: 18, noseH: 9, mouth: 'smile', white: true }, [0.2, 0.19, 0.21]);
        [-1, 1].forEach(sd => { P(head, GEO.sph, w, [sd * 0.22, 0.06, -0.04], [0.09, 0.04, 0.06], [0, 0, -sd * 0.3]); P(head, GEO.cone, horn, [sd * 0.11, 0.2, -0.04], [0.035, 0.1, 0.035], [0, 0, -sd * 0.5], false); });
        n.walk = 1; n.noTilt = true;
        n.extra = (t) => { const k = n.walk, f = n.gait || 6; n.legsF.rotation.x = Math.sin(t * f) * 0.42 * k; n.legsB.rotation.x = -Math.sin(t * f) * 0.42 * k; n.body.position.y += Math.abs(Math.sin(t * f)) * 0.02 * k;
          n.tail.rotation.z = Math.sin(t * 1.9 + n.ph) * 0.35; n.tail.rotation.x = 0.1 + Math.pow(Math.max(0, Math.sin(t * 0.7 + n.ph)), 6) * 0.5; head.rotation.x = Math.sin(t * f * 0.5) * 0.06; };
      });
    }
    function makeDonkey() {
      return K.npc('donkey', ({ n, body, P, face, M, GEO, capG }) => {
        const g = M('#9C8A7A'), gl = M('#E8DED8'), dk = M('#5E5048'), hoof = M('#4A3E38'), strap = M('#3F78B8'), red = M('#C2405B');
        P(body, capG(0.24, 0.55), g, [0, 0.72, 0], null, [PI / 2, 0, 0]); P(body, GEO.sph, gl, [0, 0.6, 0], [0.2, 0.12, 0.42], null, false);
        P(body, GEO.box, strap, [0, 0.78, 0.12], [0.5, 0.22, 0.12], null, false); P(body, GEO.box, red, [0, 0.98, -0.05], [0.36, 0.05, 0.5], null, false);
        n.legsF = new T.Group(); n.legsF.position.set(0, 0.5, 0.28); body.add(n.legsF);
        n.legsB = new T.Group(); n.legsB.position.set(0, 0.5, -0.28); body.add(n.legsB);
        [n.legsF, n.legsB].forEach(lg => [-1, 1].forEach(sd => { P(lg, GEO.cyl, g, [sd * 0.12, -0.22, 0], [0.055, 0.44, 0.055]); P(lg, GEO.sph, hoof, [sd * 0.12, -0.45, 0.01], [0.06, 0.035, 0.065], null, false); }));
        n.extraDyn = [n.legsF, n.legsB];
        n.tail = new T.Group(); n.tail.position.set(0, 0.86, -0.52); body.add(n.tail); P(n.tail, GEO.cyl, g, [0, -0.16, -0.02], [0.02, 0.32, 0.02], [0.15, 0, 0]); P(n.tail, GEO.sph, dk, [0, -0.34, -0.04], [0.045, 0.08, 0.045], null, false);
        P(body, GEO.sph, g, [0, 0.98, 0.42], [0.13, 0.2, 0.14], [0.5, 0, 0]);
        const head = new T.Group(); head.position.set(0, 1.18, 0.6); body.add(head); n.head = head;
        P(head, GEO.sph, g, [0, 0, 0], [0.16, 0.17, 0.19]); P(head, GEO.sph, gl, [0, -0.07, 0.15], [0.12, 0.09, 0.1], null, false);
        face(head, { er: 30, ex: 84, ey: 330, nose: '#5E4A48', noseW: 16, noseH: 9, mouth: 'smile', white: true }, [0.16, 0.17, 0.19]);
        n.ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(sd * 0.08, 0.13, -0.04); head.add(e); P(e, GEO.sph, g, [0, 0.15, 0], [0.045, 0.17, 0.035], null); P(e, GEO.sph, M('#F2C8C8'), [0, 0.15, 0.02], [0.025, 0.12, 0.02], null, false); e.rotation.z = -sd * 0.2; return e; });
        P(head, GEO.sph, dk, [0, 0.17, 0.02], [0.05, 0.06, 0.12], null, false);
        n.extraDyn = n.extraDyn.concat(n.ears);
        n.walk = 1; n.noTilt = true;
        n.extra = (t) => { const k = n.walk, f = n.gait || 7; n.legsF.rotation.x = Math.sin(t * f) * 0.45 * k; n.legsB.rotation.x = -Math.sin(t * f) * 0.45 * k; n.body.position.y += Math.abs(Math.sin(t * f)) * 0.025 * k;
          n.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 2.3 + i * 1.7) * 0.18; }); n.tail.rotation.z = Math.sin(t * 2.6 + n.ph) * 0.4; };
      });
    }

    // коза (серпантин): белая с рыжими пятнами, рожки назад, бородка, колокольчик — как корова, только меньше и шустрее
    function makeGoat() {
      return K.npc('goat', ({ n, body, P, face, M, GEO, capG }) => {
        const w = M('#F2EEE6'), sp = M('#C98A4A'), hoof = M('#4A3E38'), horn = M('#D8C8A8'), bell = M('#E8C770', { emissive: '#C9A040', emissiveIntensity: 0.12 }), strap = M('#3F78B8');
        P(body, capG(0.2, 0.42), w, [0, 0.6, 0], null, [PI / 2, 0, 0]); P(body, GEO.sph, sp, [0.12, 0.68, -0.12], [0.1, 0.12, 0.16], null, false);
        n.legsF = new T.Group(); n.legsF.position.set(0, 0.42, 0.2); body.add(n.legsF);
        n.legsB = new T.Group(); n.legsB.position.set(0, 0.42, -0.2); body.add(n.legsB);
        [n.legsF, n.legsB].forEach(lg => [-1, 1].forEach(sd => { P(lg, GEO.cyl, w, [sd * 0.1, -0.19, 0], [0.045, 0.38, 0.045]); P(lg, GEO.sph, hoof, [sd * 0.1, -0.38, 0.01], [0.05, 0.03, 0.055], null, false); }));
        n.extraDyn = [n.legsF, n.legsB];
        n.tail = new T.Group(); n.tail.position.set(0, 0.78, -0.4); body.add(n.tail); P(n.tail, GEO.sph, w, [0, 0.05, -0.03], [0.04, 0.08, 0.04], [-0.6, 0, 0]);
        P(body, GEO.torus, strap, [0, 0.82, 0.32], [0.1, 0.1, 0.08], [PI / 2 - 0.4, 0, 0], false); P(body, GEO.cyl, bell, [0, 0.7, 0.4], [0.035, 0.055, 0.035], null, false);
        const head = new T.Group(); head.position.set(0, 0.95, 0.42); body.add(head); n.head = head;
        P(head, GEO.sph, w, [0, 0, 0], [0.13, 0.14, 0.17]); P(head, GEO.sph, w, [0, -0.15, 0.06], [0.04, 0.08, 0.04], null, false);   // бородка
        face(head, { er: 30, ex: 84, ey: 320, nose: '#B9776E', noseW: 14, noseH: 8, mouth: 'smile', white: true }, [0.13, 0.14, 0.17]);
        [-1, 1].forEach(sd => { P(head, GEO.sph, w, [sd * 0.15, 0.04, -0.03], [0.08, 0.03, 0.05], [0, 0, -sd * 0.4]); P(head, GEO.cone, horn, [sd * 0.06, 0.18, -0.07], [0.028, 0.14, 0.028], [-0.6, 0, -sd * 0.2], false); });
        n.walk = 1; n.noTilt = true;
        n.extra = (t) => { const k = n.walk, f = n.gait || 8; n.legsF.rotation.x = Math.sin(t * f) * 0.45 * k; n.legsB.rotation.x = -Math.sin(t * f) * 0.45 * k; n.tail.rotation.x = Math.sin(t * 6 + n.ph) * 0.3; };
      });
    }
    // зверь из K.npc → одна сетка тела (тун + rim, как жители села) и одна сетка контура; части (ноги спереди/сзади, хвост, голова)
    // помечены атрибутом aPart и качаются в вершинном шейдере вокруг своих осей (uniform-ы — свои у экземпляра: клон материала,
    // программа общая). Было ~12–16 вызовов на корову (каждая подвижная группа — тело + контур), стало 3 (тело, контур, лицо)
    const ANIM_V = `uniform vec4 uAn; uniform vec4 uPv0; uniform vec4 uPv1; uniform vec4 uPv2; attribute float aPart;
      vec3 rkAnim(vec3 p) {
        float k = floor(aPart + 0.5);
        if (k > 0.5 && k < 2.5) { float a = (k < 1.5 ? 1.0 : -1.0) * sin(uAn.x) * 0.42 * uAn.y; vec2 pv = k < 1.5 ? uPv0.xy : uPv0.zw; vec2 q = p.yz - pv; float c = cos(a), s = sin(a); p.yz = pv + vec2(q.x * c - q.y * s, q.x * s + q.y * c); }
        else if (k > 2.5 && k < 3.5) { float a = sin(uAn.z) * 0.35; vec2 q = p.xy - uPv1.xy; float c = cos(a), s = sin(a); p.xy = uPv1.xy + vec2(q.x * c - q.y * s, q.x * s + q.y * c); }
        else if (k > 3.5 && k < 4.5) { float a = sin(uAn.x * 0.5) * 0.06 * uAn.y + uAn.w; vec2 q = p.yz - uPv1.zw; float c = cos(a), s = sin(a); p.yz = uPv1.zw + vec2(q.x * c - q.y * s, q.x * s + q.y * c); }
        else if (k > 4.5) { float a = sin(uAn.z * 1.3 + k) * 0.18; vec2 q = p.yz - uPv2.xy; float c = cos(a), s = sin(a); p.yz = uPv2.xy + vec2(q.x * c - q.y * s, q.x * s + q.y * c); }
        return p; }`;
    function animUniforms() { return { uAn: { value: new T.Vector4() }, uPv0: { value: new T.Vector4() }, uPv1: { value: new T.Vector4() }, uPv2: { value: new T.Vector4() } }; }
    function animMat(U) {
      const m = K.addRim(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: K.GRAD }), 1), prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
      m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, U); sh.vertexShader = ANIM_V + '\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = rkAnim(vec3(position));').replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);'); };
      m.customProgramCacheKey = () => (pk ? pk.call(m) : '') + '|rkanim'; own.push(m); return m;
    }
    function animOutline(U) {
      const m = new T.ShaderMaterial({ uniforms: Object.assign({ thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } }, U), side: T.BackSide,
        vertexShader: ANIM_V + '\nuniform float thick; void main(){ vec3 p = rkAnim(position); vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }' }); own.push(m); return m;
    }
    function bakeAnimal(n, parts, headPv) {
      const root = n.root; root.updateMatrixWorld(true); const inv = new T.Matrix4().copy(root.matrixWorld).invert(), body = [], ol = []; let face = null;
      const partOf = m => { for (let p = m; p && p !== root; p = p.parent) { const i = parts.indexOf(p); if (i >= 0) return i + 1; } return 0; };
      root.traverse(m => { if (!m.isMesh) return; if (m.material && m.material.transparent) { face = face || m; return; } (m.userData.outline ? ol : body).push(m); });
      const cat = list => { let nv = 0; list.forEach(m => { nv += m.geometry.attributes.position.count; }); const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3), A = new Float32Array(nv); let o = 0;
        list.forEach(m => { const g = m.geometry, mm = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld), nm = new T.Matrix3().getNormalMatrix(mm), pa = partOf(m), c = g.attributes.color, cnt = g.attributes.position.count, v = new T.Vector3();
          for (let i = 0; i < cnt; i++) { v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(mm); P.set([v.x, v.y, v.z], (o + i) * 3); v.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], (o + i) * 3); if (c) Cc.set([c.getX(i), c.getY(i), c.getZ(i)], (o + i) * 3); else Cc.fill(1, (o + i) * 3, (o + i) * 3 + 3); A[o + i] = pa; }
          o += cnt; });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); g.setAttribute('aPart', new T.BufferAttribute(A, 1)); g.computeBoundingSphere(); own.push(g); return g; };
      const gB = cat(body), gO = ol.length ? cat(ol) : null;
      let faceT = null; if (face) { face.updateMatrixWorld(true); faceT = new T.Matrix4().multiplyMatrices(inv, face.matrixWorld); }
      [...root.children].forEach(ch => root.remove(ch));
      const U = animUniforms(), mB = new T.Mesh(gB, animMat(U)); root.add(mB);
      if (gO) { const mO = new T.Mesh(gO, animOutline(U)); root.add(mO); }
      // лицо (прозрачная наклейка с морганием) — на шарнире головы: кивает вместе с ней (угол — тот же, что в шейдере)
      let fp = null; if (face) { face.parent && face.parent.remove(face); fp = new T.Group(); fp.position.set(0, headPv[0], headPv[1]); root.add(fp);
        faceT.premultiply(new T.Matrix4().makeTranslation(0, -headPv[0], -headPv[1])); faceT.decompose(face.position, face.quaternion, face.scale); fp.add(face); }
      return { U, body: mB, facePivot: fp };
    }
    const OGEO = new Map(), OPOOL = new Map(), OLIVE = new Set();
    function obGeo(key, fn, snow) { let g = OGEO.get(key); if (!g) { const bk = new K.Baker('atlas'); fn(bk); snowify(bk, snow, 0.55); g = bk.build(); unkeep(g); addFx(g, bk.fxR); OGEO.set(key, g); } return g; }
    const obMesh = (g, mat) => { const m = new T.Mesh(g, mat || matA); m.castShadow = m.receiveShadow = false; return m; };
    // скорости по умолчанию (м/с навстречу; ядро может задать ob.speed) — для анимации: бочки катятся, звери шагают, колёса крутятся
    const OSPEED = { barrels: 4, cow: 2.2, cart: 6, goat: 1.6 };
    // opts.theme — тема уровня: у зимней — снег на верхних гранях (свой ключ пула и своя геометрия), opts.lane — для санок (длина
    // ледяной дорожки до конечной полосы)
    function obstacle(id, opts) {
      opts = opts || {};
      const cat = CAT[id]; if (!cat) throw new Error('runnerKit.obstacle: нет в каталоге ' + id);
      const v = (opts.variant | 0) % 3, len = id === 'shed' ? clamp(Math.round((+opts.len || cat.dMin) / 2) * 2, cat.dMin, cat.dMax) : 0;
      const snow = !WIN && !!(THEME[opts.theme] && THEME[opts.theme].snow) && !cat.moving && !cat.lateral && id !== 'snowman' && id !== 'icicles', lane = clamp(opts.lane | 0, 0, 2);
      const key = id + '|' + (id === 'stall' || id === 'carpet' || id === 'dancer' ? (id === 'dancer' ? v % 2 : v) : 0) + '|' + len + (snow ? '|w' : '') + (id === 'sled' ? '|' + lane : ''), L = OPOOL.get(key);
      let ob = L && L.length ? L.pop() : null;
      if (!ob) {
        const group = new T.Group(); group.name = 'runner:ob:' + id;
        ob = { id, key, group, cat, speed: OSPEED[id] || 0, dir: 1, t: Math.random() * 10, live: false, anim: null, meshes: [] };
        if (id === 'cow') { const n = makeCow(); const A = bakeAnimal(n, [n.legsF, n.legsB, n.tail, n.head], [1.0, 0.5]); A.U.uPv0.value.set(0.46, 0.26, 0.46, -0.26); A.U.uPv1.value.set(0, 0.84, 1.0, 0.5);
          n.root.scale.setScalar(1.24); n.root.position.set(0, 0, 0.05); group.add(n.root); ob.npc = n; ob.an = A; }
        else if (id === 'cart') {
          const body = obMesh(obGeo('cart', cartGeo)); group.add(body); ob.meshes.push(body);
          const wg = obGeo('wheel', wheelGeo); ob.wheels = [-0.98, 0.98].map(x => { const m = obMesh(wg); m.position.set(x, 0.46, -0.9); group.add(m); return m; });
          const n = makeDonkey(); const A = bakeAnimal(n, [n.legsF, n.legsB, n.tail, n.head].concat(n.ears), [1.18, 0.6]); A.U.uPv0.value.set(0.5, 0.28, 0.5, -0.28); A.U.uPv1.value.set(0, 0.86, 1.18, 0.6); A.U.uPv2.value.set(1.31, 0.56, 0, 0);
          n.root.position.set(0, 0, 1.42); n.root.scale.setScalar(1.05); group.add(n.root); ob.npc = n; ob.an = A; n.gait = 8;
        } else if (id === 'barrels') {
          const g = obGeo('barrels', OB.barrels); ob.roll = [-0.4, 0.4].map(() => null);
          const m = obMesh(g); m.position.y = 0.4; group.add(m); ob.meshes.push(m); ob.rollMesh = m;
        } else if (id === 'goat') { const n = makeGoat(); const A = bakeAnimal(n, [n.legsF, n.legsB, n.tail, n.head], [0.95, 0.42]); A.U.uPv0.value.set(0.42, 0.2, 0.42, -0.2); A.U.uPv1.value.set(0, 0.78, 0.95, 0.42);
          n.root.scale.setScalar(1.2); group.add(n.root); ob.npc = n; ob.an = A; n.gait = 8;
        } else {
          const g = obGeo(key, bk => OB[id](bk, v, len), snow); const m = obMesh(g); group.add(m); ob.meshes.push(m); ob.body = m;
          // поперечные: метка на конечной полосе (ядро: ob.lat(x, xf) — фигура идёт, метка стоит); камушек: ob.fall(y, warn)
          if (id === 'dancer') { const r = obMesh(obGeo('rug', rugGeo)); r.renderOrder = 1; group.add(r); ob.meshes.push(r); ob.mark = r; }
          if (id === 'sled') { const r = obMesh(obGeo('track|' + lane, bk => trackGeo(bk, lane))); r.renderOrder = 1; group.add(r); ob.meshes.push(r); ob.mark = r; }
          if (id === 'dancer' || id === 'sled') ob.lat = (x, xf) => { if (ob.mark) ob.mark.position.x = xf - x; ob.moving = Math.abs(x - xf) > 0.05; };
          // предупреждение (warn ≥ 0, за 2,6 с): камень уже виден наверху, у кромки скалы, и покачивается — «вот-вот сорвётся»
          // (тень на дороге за 50 м в портрете — пара пикселей по высоте, одной её мало); тень: до предупреждения её нет, с
          // него — сразу 0,7 размера и растёт до 1,15 к падению (0,25 в начале на телефоне не читалась)
          if (id === 'rock') ob.fall = (y, warn) => { const m2 = ob.body, k = y / 14, teeter = y > 13.9 && warn >= 0; m2.position.set(-4.2 * k, y, 0); m2.rotation.set(y * 0.35, 0, y * 0.2 + (teeter ? Math.sin(warn * 60) * 0.3 : 0)); m2.visible = y < 13.9 || warn >= 0; ob.shadowK = y > 0.01 ? (warn < 0 ? 0 : 0.7 + 0.45 * warn) : 1; };
        }
        // тень-пятно (vkit blobMat): размер — по габариту; рисуют все одним InstancedMesh (см. tick)
        ob.shadow = [cat.w * 1.1, (id === 'shed' ? len : id === 'cart' ? 4.0 : cat.d) * 1.08];
        ob.release = () => { if (!ob.live) return; ob.live = false; OLIVE.delete(ob); if (group.parent) group.parent.remove(group); group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); group.visible = true; let P2 = OPOOL.get(key); if (!P2) OPOOL.set(key, P2 = []); P2.push(ob); };
      }
      ob.live = true; OLIVE.add(ob); ob.shadowK = 1; if (ob.mark) ob.mark.position.x = 0; if (ob.body && id === 'rock') { ob.body.position.set(0, 0, 0); ob.body.rotation.set(0, 0, 0); ob.body.visible = true; }
      ob.dir = opts.dir === -1 ? -1 : 1; ob.speed = opts.speed !== undefined ? +opts.speed : opts.dir === 0 ? 0 : (OSPEED[id] || 0);   // ядро: dir 0 — стоит (корова щиплет травку), 1 — навстречу
      ob.group.rotation.y = ob.dir < 0 ? PI : 0;   // dir −1 — уходит от героини (попутно)
      if (ob.npc) ob.npc.walk = ob.speed > 0.05 ? 1 : 0;
      return ob;
    }
    const blobG = keepO((() => { const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2); return g; })());

    /* =================================================================
       9. МОНЕТА: серебро с кубачинским узором (розетка, «тутта» по кругу, бусины, чернь), блеск — matcap
       ================================================================= */
    // matcap «серебро»: светлое небо сверху, тёплая земля снизу, яркий блик слева сверху — металл читается без света сцены
    const matcapTex = (() => { const N = 256, [cv, c] = K.cnv(N, N);
      const g = c.createLinearGradient(0, 0, 0, N); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.36, '#F0F4FA'); g.addColorStop(0.55, '#C2CAD8'); g.addColorStop(0.68, '#E2DACA'); g.addColorStop(1, '#8C8678');
      c.fillStyle = '#3A3C44'; c.fillRect(0, 0, N, N); c.save(); c.beginPath(); c.arc(N / 2, N / 2, N / 2 - 1, 0, TAU); c.clip(); c.fillStyle = g; c.fillRect(0, 0, N, N);
      const r = c.createRadialGradient(N / 2, N / 2, N * 0.3, N / 2, N / 2, N / 2); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.75, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(30,32,40,0.5)'); c.fillStyle = r; c.fillRect(0, 0, N, N);
      const h = c.createRadialGradient(N * 0.34, N * 0.3, 0, N * 0.34, N * 0.3, N * 0.26); h.addColorStop(0, 'rgba(255,255,255,1)'); h.addColorStop(0.25, 'rgba(255,255,255,0.75)'); h.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = h; c.fillRect(0, 0, N, N);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(N * 0.68, N * 0.7, N * 0.08, N * 0.04, -0.6, 0, TAU); c.fill(); c.restore();
      return keepO(new T.CanvasTexture(cv)); })();
    // узор лица монеты (u, v — круг в квадрате); углы квадрата — ровное серебро (ими закрашен ребро)
    function paintCoin(x2) {
      const N = HI ? 512 : 256, k = N / 256, [cv, c] = K.cnv(N, N), cx = N / 2, R0 = N / 2, ink = '#475066', ink2 = 'rgba(71,80,102,0.7)';
      c.fillStyle = '#D6DAE0'; c.fillRect(0, 0, N, N);
      const g = c.createRadialGradient(cx * 0.8, cx * 0.7, 0, cx, cx, R0); g.addColorStop(0, '#FCFDFE'); g.addColorStop(1, '#D2D8E1'); c.fillStyle = g; c.beginPath(); c.arc(cx, cx, R0 * 0.98, 0, TAU); c.fill();
      c.strokeStyle = ink; c.lineWidth = 3 * k; c.beginPath(); c.arc(cx, cx, R0 * 0.84, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cx, R0 * 0.62, 0, TAU); c.stroke();
      // бусины по краю
      c.fillStyle = ink2; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; c.beginPath(); c.arc(cx + Math.cos(a) * R0 * 0.91, cx + Math.sin(a) * R0 * 0.91, 3.2 * k, 0, TAU); c.fill(); }
      // «тутта»: вьющийся побег по кругу — волна с завитками и листиками (чернь в углублениях)
      c.lineWidth = 2.4 * k; c.strokeStyle = ink; c.beginPath();
      for (let i = 0; i <= 240; i++) { const a = i / 240 * TAU, rr = R0 * (0.73 + 0.06 * Math.sin(a * 10)); const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr; if (!i) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
      for (let i = 0; i < 10; i++) { const a = (i + 0.25) / 10 * TAU, up = i % 2 ? 1 : -1, rr = R0 * (0.73 + 0.05 * up), x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
        c.beginPath(); c.arc(x, y, 6.5 * k, a, a + PI * 1.5 * up, up < 0); c.stroke();
        c.fillStyle = ink2; c.beginPath(); c.ellipse(cx + Math.cos(a + 0.16) * R0 * 0.73, cx + Math.sin(a + 0.16) * R0 * 0.73, 5 * k, 2.4 * k, a + 0.9, 0, TAU); c.fill(); }
      if (x2) {   // «двойное серебро»: в середине — «×2» чернью по серебру
        c.fillStyle = ink; c.font = `900 ${Math.round(R0 * 0.78)}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('×2', cx, cx + R0 * 0.04);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillText('×2', cx - 2 * k, cx + R0 * 0.04 - 2 * k);
      } else {
        // розетка: восемь лепестков-капель, между ними — тонкие стрелки; середина — цветок с чернью и светлой точкой
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.save(); c.translate(cx, cx); c.rotate(a);
          c.fillStyle = i % 2 ? '#C6CDD8' : '#F4F6F9'; c.strokeStyle = ink; c.lineWidth = 2.4 * k; c.beginPath(); c.moveTo(0, -R0 * 0.14); c.quadraticCurveTo(R0 * 0.17, -R0 * 0.33, 0, -R0 * 0.56); c.quadraticCurveTo(-R0 * 0.17, -R0 * 0.33, 0, -R0 * 0.14); c.fill(); c.stroke();
          c.fillStyle = ink2; c.beginPath(); c.ellipse(0, -R0 * 0.34, R0 * 0.035, R0 * 0.09, 0, 0, TAU); c.fill();
          c.rotate(TAU / 16); c.strokeStyle = ink2; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(0, -R0 * 0.2); c.lineTo(0, -R0 * 0.5); c.stroke(); c.restore(); }
        c.fillStyle = ink; c.beginPath(); c.arc(cx, cx, R0 * 0.15, 0, TAU); c.fill();
        c.fillStyle = '#E8EBEF'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.ellipse(cx + Math.cos(a) * R0 * 0.08, cx + Math.sin(a) * R0 * 0.08, R0 * 0.04, R0 * 0.025, a, 0, TAU); c.fill(); }
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(cx, cx, R0 * 0.035, 0, TAU); c.fill();
      }
      const t = keepO(new T.CanvasTexture(cv)); t.anisotropy = HI ? 4 : 2; return t;
    }
    const coinTex = paintCoin(false), x2Tex = paintCoin(true);
    // диск Ø 0,5 в плоскости XY, толщина 0,06: лицо — поле + приподнятый ободок (нормали наклонены наружу — блик бежит по краю), ребро
    function coinGeometry(seg, rad, thick) {
      const P = [], N = [], U = [], I = []; let n = 0; const hz = thick / 2, rin = rad * 0.84;
      const v = (x, y, z, nx, ny, nz, u, w) => { P.push(x, y, z); N.push(nx, ny, nz); U.push(u, w); return n++; };
      [1, -1].forEach(sd => {
        const c0 = v(0, 0, sd * (hz - 0.004), 0, 0, sd, 0.5, 0.5), ring = [], outer = [];
        for (let i = 0; i <= seg; i++) { const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), uu = sd > 0 ? 0.5 + ca * 0.42 : 0.5 - ca * 0.42, vv = 0.5 + sa * 0.42;
          ring.push(v(ca * rin, sa * rin, sd * (hz - 0.004), 0, 0, sd, uu, vv));
          const tl = 0.55; outer.push([v(ca * rin, sa * rin, sd * hz, ca * tl * -0.4, sa * tl * -0.4, sd, sd > 0 ? 0.5 + ca * 0.43 : 0.5 - ca * 0.43, 0.5 + sa * 0.43), v(ca * rad, sa * rad, sd * hz * 0.75, ca * tl, sa * tl, sd, sd > 0 ? 0.5 + ca * 0.49 : 0.5 - ca * 0.49, 0.5 + sa * 0.49)]); }
        for (let i = 0; i < seg; i++) { if (sd > 0) { I.push(c0, ring[i], ring[i + 1]); I.push(outer[i][0], outer[i][1], outer[i + 1][1], outer[i][0], outer[i + 1][1], outer[i + 1][0]); }
          else { I.push(c0, ring[i + 1], ring[i]); I.push(outer[i][0], outer[i + 1][1], outer[i][1], outer[i][0], outer[i + 1][0], outer[i + 1][1]); } }
      });
      // ребро: ровное серебро (угол текстуры)
      const rim = []; for (let i = 0; i <= seg; i++) { const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a); rim.push([v(ca * rad, sa * rad, hz * 0.75, ca, sa, 0, 0.04, 0.04), v(ca * rad, sa * rad, -hz * 0.75, ca, sa, 0, 0.05, 0.05)]); }
      for (let i = 0; i < seg; i++) I.push(rim[i][0], rim[i][1], rim[i + 1][1], rim[i][0], rim[i + 1][1], rim[i + 1][0]);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeBoundingSphere(); return g;
    }
    const coinGeo = keepO(coinGeometry(HI ? 24 : 16, 0.25, 0.06));
    let coinMat = keepO(new T.MeshMatcapMaterial({ matcap: matcapTex, map: coinTex, color: 0xFFFFFF }));
    if (HI) { coinMat.bumpMap = coinTex; coinMat.bumpScale = 0.6; }
    const COINS = [];
    function coins(max) {
      const m = new T.InstancedMesh(coinGeo, coinMat, Math.max(1, max | 0 || 64));
      m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.name = 'runner:coins'; m.castShadow = m.receiveShadow = false; m.count = 0;
      COINS.push(m); return m;
    }

    /* =================================================================
       10. УСИЛИТЕЛИ: кувшин-магнит (серебро с чернью), «двойное серебро» (большая монета ×2), параплан — крутятся и покачиваются
       ================================================================= */
    const matPow = keepO(new T.MeshMatcapMaterial({ matcap: matcapTex, vertexColors: true }));
    const matX2 = keepO(new T.MeshMatcapMaterial({ matcap: matcapTex, map: x2Tex, color: 0xFFF2D0 }));
    const POWC = { magnet: '#9FD0FF', x2: '#FFD86A', glide: '#9FF0E0', mail: '#C9DAF0' };   // mail — кольчуга (роль EGGS)
    const PGEO = {};
    function powGeo(id) {
      if (PGEO[id]) return PGEO[id];
      const bk = new K.Baker('vc'), sv = [0.95, 0.96, 0.98], nl = [0.32, 0.33, 0.38];
      if (id === 'magnet') {   // кувшин: ножка, тулово, плечи с поясом черни, горло, носик, ручка
        const prof = [[0.14, 0], [0.12, 0.06], [0.26, 0.22], [0.3, 0.36], [0.27, 0.5], [0.16, 0.62], [0.09, 0.72], [0.085, 0.86], [0.13, 0.92]];
        for (let i = 0; i < prof.length - 1; i++) bk.cyl(0, prof[i][1] - 0.46, 0, prof[i][0], prof[i + 1][0], prof[i + 1][1] - prof[i][1], { seg: 14, col: i === 3 || i === 6 ? nl : sv, cap: i === prof.length - 2 });
        tube(bk, [0.25, -0.02, 0], [0.38, 0.32, 0], 0.035, 6, sv, { r1: 0.025 });
        for (let i = 0; i < 10; i++) { const a0 = PI * 0.55 + i / 10 * PI * 1.3, a1 = PI * 0.55 + (i + 1) / 10 * PI * 1.3, r = 0.2; tube(bk, [-0.22 + Math.cos(a0) * r * 0.6 - 0.05, 0.05 + Math.sin(a0) * r, 0], [-0.22 + Math.cos(a1) * r * 0.6 - 0.05, 0.05 + Math.sin(a1) * r, 0], 0.035, 6, sv, { cap: false }); }
      } else if (id === 'glide') {   // параплан: купол из 7 секций дугой, стропы, маленькая подвеска
        const cols = ['#E8455A', '#F4EEE2', '#3F78B8', '#F4EEE2', '#E8455A', '#F4EEE2', '#3F78B8'].map(rgb), n = 7, Rr = 0.62, span = 2.2;
        for (let i = 0; i < n; i++) { const a0 = -span / 2 + span * i / n, a1 = a0 + span / n; const p = (a, zz, y0) => [Math.sin(a) * Rr, y0 + Math.cos(a) * Rr * 0.55, zz];
          bk.quadF(p(a0, 0.22, 0.22), p(a1, 0.22, 0.22), p(a1, -0.22, 0.25), p(a0, -0.22, 0.25), cols[i], S.FLAT, [Math.sin((a0 + a1) / 2), 1, 0.2]);
          bk.quadF(p(a1, 0.22, 0.19), p(a0, 0.22, 0.19), p(a0, -0.22, 0.22), p(a1, -0.22, 0.22), mul(cols[i], 0.78), S.FLAT, [-Math.sin((a0 + a1) / 2), -1, 0]); }
        [-0.5, -0.2, 0.2, 0.5].forEach(x => bar(bk, [x, 0.48 - Math.abs(x) * 0.3, 0.0], [0, -0.42, 0], 0.012, [0.3, 0.3, 0.34]));
        bk.box(new K.Frame(0, -0.5, 0, 0), 0, 0, 0, 0.18, 0.14, 0.12, { col: rgb('#F2C94C') });
      }
      PGEO[id] = keepO(bk.build()); unkeep(PGEO[id]); own.push(PGEO[id]); return PGEO[id];
    }
    const POOLP = {}, PLIVE = new Set();
    function powerup(id) {
      if (!POWC[id]) throw new Error('runnerKit.powerup: ' + id);
      const L = POOLP[id] || (POOLP[id] = []);
      let pw = L.pop();
      if (!pw) {
        const group = new T.Group(); group.name = 'runner:pow:' + id; const spin = new T.Group(); group.add(spin);
        const m = id === 'x2' ? new T.Mesh(coinGeo, matX2) : id === 'mail' ? mailMesh() : new T.Mesh(powGeo(id), matPow);
        if (id === 'x2') m.scale.setScalar(2.4); if (id === 'glide') m.scale.setScalar(1.1); if (id === 'magnet') m.position.y = 0.0;
        spin.add(m);
        if (id === 'x2') { const m2 = new T.Mesh(coinGeo, coinMat); m2.scale.setScalar(1.7); m2.position.set(0.32, -0.28, -0.08); spin.add(m2); }
        const haloM = new T.SpriteMaterial({ map: haloTex, color: new T.Color(POWC[id]), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.85 }); own.push(haloM);
        const halo = new T.Sprite(haloM); halo.scale.setScalar(1.8); group.add(halo);
        pw = { id, group, spin, halo, t: Math.random() * 6, live: false };
        pw.release = () => { if (!pw.live) return; pw.live = false; PLIVE.delete(pw); if (group.parent) group.parent.remove(group); group.position.set(0, 0, 0); L.push(pw); };
      }
      pw.live = true; PLIVE.add(pw); return pw;
    }
    // кольчуга (роль EGGS; старое имя села по-персидски — «кольчужники»): рубашка из колечек — своя карта (кольца внахлёст,
    // через ряд со сдвигом), блеск — тот же matcap «серебро». Выдерживает один удар — ядро
    let mailGeo = null, matMail = null;
    function mailMesh() {
      if (!mailGeo) {
        const [cv, c2] = K.cnv(64, 64); c2.fillStyle = '#6E7784'; c2.fillRect(0, 0, 64, 64);
        for (let r = 0; r < 4; r++) for (let q = -1; q <= 4; q++) { const x = q * 16 + (r % 2 ? 8 : 0), y = r * 16 + 8;
          c2.lineWidth = 3.4; c2.strokeStyle = '#EEF3F8'; c2.beginPath(); c2.arc(x, y, 6.6, 0, TAU); c2.stroke();
          c2.lineWidth = 1.3; c2.strokeStyle = '#3E4652'; c2.beginPath(); c2.arc(x + 0.9, y + 0.9, 8.4, 0.3, 2.3); c2.stroke(); }
        const t = keepO(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(4.5, 4.5); t.anisotropy = HI ? 4 : 2;
        matMail = keepO(new T.MeshMatcapMaterial({ matcap: matcapTex, map: t, color: 0xF2F6FA }));
        const sh = new T.Shape(); sh.moveTo(-0.22, -0.4); sh.lineTo(0.22, -0.4); sh.lineTo(0.22, 0.1); sh.lineTo(0.38, 0.0); sh.lineTo(0.46, 0.13); sh.lineTo(0.27, 0.33); sh.lineTo(0.1, 0.35);
        sh.quadraticCurveTo(0, 0.25, -0.1, 0.35); sh.lineTo(-0.27, 0.33); sh.lineTo(-0.46, 0.13); sh.lineTo(-0.38, 0.0); sh.lineTo(-0.22, 0.1); sh.closePath();
        mailGeo = keepO(new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 4 })); mailGeo.translate(0, 0, -0.04);
      }
      const m = new T.Mesh(mailGeo, matMail); m.scale.setScalar(1.15); return m;
    }
    // щит кольчуги на героине: кольцо из колечек вокруг неё (спрайт, 1 вызов, пока кольчуга надета или после удара); ядро
    // каждый кадр зовёт set(x, y, z, сила 0…1, время) — без выделений
    function shield(scene) {
      const [cv, c2] = K.cnv(128, 128); c2.translate(64, 64);
      const g = c2.createRadialGradient(0, 0, 36, 0, 0, 63); g.addColorStop(0, 'rgba(200,225,255,0)'); g.addColorStop(0.72, 'rgba(214,232,255,0.4)'); g.addColorStop(1, 'rgba(214,232,255,0)'); c2.fillStyle = g; c2.fillRect(-64, -64, 128, 128);
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c2.strokeStyle = 'rgba(226,238,252,0.85)'; c2.lineWidth = 1.8; c2.beginPath(); c2.arc(Math.cos(a) * 53, Math.sin(a) * 53, 4.4, 0, TAU); c2.stroke(); }
      const m = keepO(new T.SpriteMaterial({ map: keepO(new T.CanvasTexture(cv)), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
      const sp = new T.Sprite(m); sp.name = 'runner:shield'; sp.visible = false; sp.renderOrder = 5; scene.add(sp);
      return {
        set(x, y, z, k, t) { const on = k > 0.01; if (sp.visible !== on) sp.visible = on; if (!on) return; sp.position.set(x, y + 0.95, z); const sc = 2.0 + Math.sin(t * 5) * 0.06; sp.scale.set(sc, sc * 1.15, 1); m.rotation = t * 0.7; m.opacity = 0.42 * k; },
        get visible() { return sp.visible; }, dispose() { if (sp.parent) sp.parent.remove(sp); },
      };
    }
    /* 10а. НАХОДКИ («Сокровища», роль EGGS): вещь крутится и покачивается (ядро), золотой ореол и мягкий столб света от земли —
       издалека видно, что это не монета и не усилитель. 2 вызова (вещь и столб; ореол-спрайт был третьим — на закате у башни
       вместе со щитом кольчуги это давало 89 из 90), пока находка в кадре (на трассе — одна за раз). Рецепты —
       V.runnerEggs.model (Baker 'vc' + matcap), резной камень — плита с рельефом из атласа вывесок, монета «тутта» — наша монета
       (на ней и так вьётся ветка «тутта») золотом */
    const FGEO = {}, FPOOL = {}, FLIVE = new Set();
    let matBeam = null, beamGeo = null, matTutta = null, stoneGeo = null;
    function findMesh(id) {
      if (id === 'tutta') { matTutta = matTutta || keepO(new T.MeshMatcapMaterial({ matcap: matcapTex, map: coinTex, color: 0xFFD27A })); const m = new T.Mesh(coinGeo, matTutta); m.scale.setScalar(1.7); return m; }
      if (id === 'stone') {
        if (!stoneGeo) { const bk = new K.Baker('atlas'), r = SIGN.rect.carv0, ru = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], e = [r[0] + 0.002, r[1] + 0.002], ue = [e, e, e, e];
          bk.box(new K.Frame(0, 0, 0, 0), 0, 0, 0, 0.66, 0.66, 0.16, { col: [1.1, 1.1, 1.1], uv: { pz: ru, nz: ru, px: ue, nx: ue, py: ue, ny: ue } }); stoneGeo = keepO(bk.build()); unkeep(stoneGeo); }
        return new T.Mesh(stoneGeo, matSign);
      }
      let g = FGEO[id];
      if (!g) { const bk = new K.Baker('vc'); let ok = false; try { ok = !!(EGG && EGG.model(id, bk, EH)); } catch (e) { console.warn('runnerKit: find', id, e); }
        if (!ok || !bk.n) bk.sph(0, 0, 0, 0.3, 0.3, 0.3, [1, 0.85, 0.4], { seg: 10, rings: 6 });
        g = FGEO[id] = keepO(bk.build()); unkeep(g); }
      return new T.Mesh(g, matPow);
    }
    function find(id) {
      const L = FPOOL[id] || (FPOOL[id] = []);
      let fd = L.pop();
      if (!fd) {
        if (!matBeam) {
          const [cv, c2] = K.cnv(4, 64), gr = c2.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,236,190,0)'); gr.addColorStop(0.6, 'rgba(255,220,140,0.18)'); gr.addColorStop(0.92, 'rgba(255,210,120,0.5)'); gr.addColorStop(1, 'rgba(255,206,110,0.62)'); c2.fillStyle = gr; c2.fillRect(0, 0, 4, 64);
          matBeam = keepO(new T.MeshBasicMaterial({ map: keepO(new T.CanvasTexture(cv)), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: true, color: 0xFFD27A }));
          beamGeo = keepO(new T.CylinderGeometry(0.16, 0.42, 7, 10, 1, true)); beamGeo.translate(0, 3.5 - 1.05, 0);
        }
        const group = new T.Group(); group.name = 'runner:find:' + id; const spin = new T.Group(); group.add(spin);
        spin.add(findMesh(id)); spin.scale.setScalar(1.2);
        const beam = new T.Mesh(beamGeo, matBeam); beam.renderOrder = 3; group.add(beam);
        fd = { id, group, spin, beam, t: Math.random() * 6, live: false };
        // ближе 14 м столб света гаснет (на подходе он заслонял саму вещь), у самой вещи — искры (tick); ядро зовёт каждый кадр
        fd.near = d => { const k = clamp((d - 5) / 14, 0, 1); matBeam.opacity = 0.35 + 0.65 * k; beam.visible = d > 2.5; };
        fd.release = () => { if (!fd.live) return; fd.live = false; FLIVE.delete(fd); if (group.parent) group.parent.remove(group); group.position.set(0, 0, 0); L.push(fd); };
      }
      fd.live = true; FLIVE.add(fd); return fd;
    }

    /* =================================================================
       10б. ВОРОТА УРОВНЯ: арка над улицей на границе уровней — каменные столбы на тротуарах, синяя резная перекладина (низ 5 м:
       под ней свободно и с прыжка, и с крыши не достать — крыш у ворот нет, там передышка), доска с названием уровня (свой
       холст на каждые ворота, перерисовка — раз при постановке), над ней серебряная розетка, флажки, фонарики на столбах.
       2 вызова (арка — общий атлас, доска — своя карта). kit.gate() → { group, setSign(n, title, sub, named), release() }
       ================================================================= */
    const GATE = { geo: null, signGeo: null, pool: [], live: new Set() };
    const GSW = HI ? 1024 : 512, GSH = Math.round(GSW * 0.28);
    function gateGeo() {
      const bk = new K.Baker('atlas'), F = new K.Frame(0, 0, 0, 0), st = [0.96, 0.94, 0.89], bl = C('blue'), wh = rgb('#F4F2EC');
      [-1, 1].forEach(sd => { const x = sd * 4.9;
        bk.box(F, x, 0.3, 0, 1.0, 0.6, 1.0, { col: mul(st, 0.92), s: S.RUBBLE, skip: { ny: 1 } });
        bk.box(F, x, 2.85, 0, 0.74, 4.5, 0.74, { col: st, s: S.ASHLAR, skip: { ny: 1 } });
        bk.box(F, x, 5.2, 0, 0.92, 0.3, 0.92, { col: bl, cols: { py: wh } });
        lantern(bk, x - sd * 0.5, 3.6, 0.2, null, 1); bar(bk, [x, 3.98, 0.2], [x - sd * 0.5, 3.98, 0.2], 0.04, rgb('#34343A')); });
      bk.box(F, 0, 5.25, 0, 10.6, 0.5, 0.42, { col: bl, cols: { py: mul(bl, 1.1), ny: mul(bl, 0.75) } });
      for (let i = 0; i < 22; i++) { const x = -5.0 + i * 10 / 21; bk.box(F, x, 5.25, 0.215, 0.18, 0.18, 0.02, { col: wh, rot: PI / 4 }); }   // резные ромбы
      bk.box(F, 0, 6.25, -0.02, 6.9, 1.62, 0.16, { col: bl, s: S.WASH });
      // серебряная розетка над доской (как узор монеты): веер треугольников, чернёная середина, лепестки
      const cy = 7.35, R0 = 0.48, sv = C('silverWare'), nl = rgb('#3E4250');
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, b = (i + 1) / 16 * TAU; bk.tri([0, cy, 0.06], [Math.cos(a) * R0, cy + Math.sin(a) * R0, 0.06], [Math.cos(b) * R0, cy + Math.sin(b) * R0, 0.06], i % 2 ? sv : mul(sv, 0.9), S.FLAT, null, [0, 0, 1]); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r1 = 0.18, r2 = 0.4; bk.quad([Math.cos(a - 0.2) * r1, cy + Math.sin(a - 0.2) * r1, 0.07], [Math.cos(a) * r2, cy + Math.sin(a) * r2, 0.07], [Math.cos(a + 0.2) * r1, cy + Math.sin(a + 0.2) * r1, 0.07], [0, cy, 0.07], nl, S.FLAT, null, [0, 0, 1]); }
      bk.box(F, 0, 7.05, -0.02, 1.2, 0.2, 0.2, { col: bl });
      // флажки под перекладиной (на ветру)
      const n0 = bk.n; for (let i = 0; i < 18; i++) { const x = -4.25 + i * 8.5 / 17, c = FLAGC[i % FLAGC.length]; bk.tri([x - 0.17, 5.0, 0.22], [x + 0.17, 5.0, 0.22], [x, 4.62, 0.24], c, S.FLAT, null, [0, 0, 1]); bk.tri([x + 0.17, 5.0, 0.2], [x - 0.17, 5.0, 0.2], [x, 4.62, 0.18], mul(c, 0.82), S.FLAT, null, [0, 0, -1]); }
      fxMark(bk, n0, 0, 0.7);
      const g = bk.build(); unkeep(g); addFx(g, bk.fxR); own.push(g); return g;
    }
    function gateSignGeo() {
      const bk = new K.Baker('atlas'), n0 = bk.n, w = 6.5, h = w * GSH / GSW, y = 6.25, col = [1.12, 1.12, 1.12];
      bk.quad([-w / 2, y - h / 2, 0.07], [w / 2, y - h / 2, 0.07], [w / 2, y + h / 2, 0.07], [-w / 2, y + h / 2, 0.07], col, S.FLAT, [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, 1]);
      fxMark(bk, n0, 0.45, 0);
      const g = bk.build(); unkeep(g); addFx(g, bk.fxR); own.push(g); return g;
    }
    // доска: кремовое поле, синяя двойная рамка с точками (кубачинская кайма), «УРОВЕНЬ 6» золотом сверху, название крупно,
    // в «Мастерском круге» — снизу мелко тема круга
    function paintGate(g, n, title, sub) {
      const c = g.cx, W = GSW, H = GSH, k = W / 512;
      c.clearRect(0, 0, W, H); c.fillStyle = '#FBF6EA'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#24419D'; c.lineWidth = 7 * k; c.strokeRect(5 * k, 5 * k, W - 10 * k, H - 10 * k); c.lineWidth = 2 * k; c.strokeRect(14 * k, 14 * k, W - 28 * k, H - 28 * k);
      c.fillStyle = '#24419D'; for (let x = 24 * k; x < W - 20 * k; x += 16 * k) { c.beginPath(); c.arc(x, 10 * k, 2 * k, 0, TAU); c.arc(x, H - 10 * k, 2 * k, 0, TAU); c.fill(); }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#B07E22'; c.font = '900 ' + Math.round(22 * k) + 'px Nunito, system-ui, sans-serif'; c.fillText('УРОВЕНЬ ' + n, W / 2, (sub ? 34 : 38) * k);
      let fs = 50; c.font = '700 ' + Math.round(fs * k) + 'px Comfortaa, Nunito, sans-serif';
      while (fs > 24 && c.measureText(title).width > W - 60 * k) { fs -= 2; c.font = '700 ' + Math.round(fs * k) + 'px Comfortaa, Nunito, sans-serif'; }
      c.fillStyle = '#7A2E3A'; c.fillText(title, W / 2, (sub ? 78 : 88) * k);
      if (sub) { c.fillStyle = '#5A4A62'; c.font = '800 ' + Math.round(19 * k) + 'px Nunito, sans-serif'; c.fillText('· ' + sub + ' ·', W / 2, 116 * k); }
    }
    function gate() {
      let g = GATE.pool.pop();
      if (!g) {
        const group = new T.Group(); group.name = 'runner:gate';
        const arch = obMesh(GATE.geo || (GATE.geo = gateGeo()), matA); group.add(arch);
        const [cv, cx] = K.cnv(GSW, GSH), tex = keepO(new T.CanvasTexture(cv)); tex.anisotropy = HI ? 4 : 2;
        const mat = keepO(relit(new T.MeshBasicMaterial({ map: tex, vertexColors: true })));
        const sign = new T.Mesh(GATE.signGeo || (GATE.signGeo = gateSignGeo()), mat); group.add(sign);
        g = { group, tex, cv, cx, mat, sign, key: '', live: false, meshes: [arch, sign] };
        g.setSign = (n, title, sub) => { const key = n + '|' + title + '|' + (sub || ''); if (g.key === key) return; g.key = key; paintGate(g, n, String(title || ''), sub ? String(sub) : ''); tex.needsUpdate = true; };
        g.release = () => { if (!g.live) return; g.live = false; GATE.live.delete(g); if (group.parent) group.parent.remove(group); group.position.set(0, 0, 0); group.visible = true; GATE.pool.push(g); };
      }
      g.live = true; GATE.live.add(g); return g;
    }

    /* =================================================================
       11. ЧАСТИЦЫ: искры монет (звёздочки, сложение) и пыль (мягкие клубы) — два Points, пул, без выделений в кадре
       ================================================================= */
    const FX = { root: new T.Group() }; FX.root.name = 'runner:fx';
    const SHAD = new T.InstancedMesh(blobG, K.blobMat, 48); SHAD.name = 'runner:shadows'; SHAD.frustumCulled = false; SHAD.renderOrder = 1; SHAD.count = 0; SHAD.instanceMatrix.setUsage(T.DynamicDrawUsage); FX.root.add(SHAD);
    function particles(N, map, blending, name) {
      const P = new Float32Array(N * 3), Cc = new Float32Array(N * 4), Sz = new Float32Array(N);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('color', new T.BufferAttribute(Cc, 4).setUsage(T.DynamicDrawUsage)); g.setAttribute('psize', new T.BufferAttribute(Sz, 1).setUsage(T.DynamicDrawUsage));
      g.boundingSphere = new T.Sphere(new T.Vector3(), 1e5);
      const mat = keepO(new T.PointsMaterial({ map, size: 1, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending, fog: true }));
      mat.onBeforeCompile = sh => { sh.vertexShader = 'attribute float psize;\n' + sh.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * psize;'); };
      mat.customProgramCacheKey = () => 'rkfx';
      const pts = new T.Points(keepO(g), mat); pts.name = name; pts.frustumCulled = false; pts.renderOrder = 6; FX.root.add(pts);
      return { pts, P, Cc, Sz, N, V: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), col: new Float32Array(N * 3), a0: new Float32Array(N), grav: new Float32Array(N), next: 0, any: false };
    }
    const SP = particles(HI ? 160 : 110, K.glintTex, T.AdditiveBlending, 'sparks'), DU = particles(HI ? 120 : 80, K.puffTex, T.NormalBlending, 'dust');
    function emit(S2, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav) {
      const i = S2.next; S2.next = (i + 1) % S2.N;
      S2.P[i * 3] = x; S2.P[i * 3 + 1] = y; S2.P[i * 3 + 2] = z; S2.V[i * 3] = vx; S2.V[i * 3 + 1] = vy; S2.V[i * 3 + 2] = vz;
      S2.life[i] = life; S2.max[i] = life; S2.s0[i] = s0; S2.s1[i] = s1; S2.col[i * 3] = r; S2.col[i * 3 + 1] = g; S2.col[i * 3 + 2] = b; S2.a0[i] = a; S2.grav[i] = grav; S2.any = true;
    }
    let fxR = VK.rng(31);
    const fx = {
      root: FX.root,
      // сбор монеты: вспышка + 10 искр серебром и тёплым, разлёт вверх-в стороны (0,45 с)
      coinBurst(pos) { if (!pos) return; const x = pos.x !== undefined ? pos.x : pos[0], y = pos.y !== undefined ? pos.y : pos[1], z = pos.z !== undefined ? pos.z : pos[2];
        emit(SP, x, y, z, 0, 0.4, 0, 0.2, 1.3, 0.3, 1, 0.98, 0.92, 1, 0);
        for (let i = 0; i < 10; i++) { const a = fxR() * TAU, sp = 1.4 + fxR() * 2.2, warm = fxR() < 0.35; emit(SP, x, y, z, Math.cos(a) * sp, 1.2 + fxR() * 2.6, Math.sin(a) * sp * 0.6, 0.35 + fxR() * 0.25, 0.42 + fxR() * 0.2, 0.05, 1, warm ? 0.88 : 0.97, warm ? 0.62 : 1, 1, -5); } },
      // пыль из-под ног: 6 мягких клубов, растут и тают (приземление, подкат, спотыкание)
      // snow — снежная пыль (лёд зимнего уровня и в незимний сезон игры)
      dust(pos, k, snow) { if (!pos) return; const x = pos.x !== undefined ? pos.x : pos[0], y = pos.y !== undefined ? pos.y : pos[1], z = pos.z !== undefined ? pos.z : pos[2], n = Math.round(6 * (k || 1)), cc = WIN || snow ? [0.96, 0.97, 1] : [0.86, 0.78, 0.64];
        for (let i = 0; i < n; i++) { const a = fxR() * TAU, sp = 0.6 + fxR() * 1.2; emit(DU, x + Math.cos(a) * 0.15, y + 0.12, z + Math.sin(a) * 0.15, Math.cos(a) * sp, 0.35 + fxR() * 0.5, Math.sin(a) * sp + 0.8, 0.55 + fxR() * 0.3, 0.35 + fxR() * 0.2, 1.0 + fxR() * 0.5, cc[0], cc[1], cc[2], 0.55, 0.3); } },
      // блеск: одна звёздочка (монеты, кувшин) — зовёт и сам kit
      glint(pos, s) { const x = pos.x !== undefined ? pos.x : pos[0], y = pos.y !== undefined ? pos.y : pos[1], z = pos.z !== undefined ? pos.z : pos[2]; emit(SP, x, y, z, 0, 0, 0, 0.35, (s || 0.5) * 0.3, (s || 0.5), 1, 1, 1, 0.9, 0); },
    };
    function stepFx(S2, dt) {
      if (!S2.any) return; let any = false;
      for (let i = 0; i < S2.N; i++) { let l = S2.life[i]; if (l <= 0) { if (S2.Sz[i] !== 0) { S2.Sz[i] = 0; S2.Cc[i * 4 + 3] = 0; } continue; }
        any = true; l -= dt; S2.life[i] = l;
        const t = 1 - Math.max(0, l) / S2.max[i];
        S2.V[i * 3 + 1] += S2.grav[i] * dt; S2.P[i * 3] += S2.V[i * 3] * dt; S2.P[i * 3 + 1] += S2.V[i * 3 + 1] * dt; S2.P[i * 3 + 2] += S2.V[i * 3 + 2] * dt;
        S2.V[i * 3] *= 1 - dt * 2.2; S2.V[i * 3 + 2] *= 1 - dt * 2.2;
        S2.Sz[i] = S2.s0[i] + (S2.s1[i] - S2.s0[i]) * t; const a = S2.a0[i] * (1 - t * t);
        S2.Cc[i * 4] = S2.col[i * 3]; S2.Cc[i * 4 + 1] = S2.col[i * 3 + 1]; S2.Cc[i * 4 + 2] = S2.col[i * 3 + 2]; S2.Cc[i * 4 + 3] = a; }
      const g = S2.pts.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.psize.needsUpdate = true;
      S2.any = any;
    }

    /* =================================================================
       12. КАДР: звери шагают, колёса и бочки крутятся, усилители качаются, частицы, блеск монет
       ================================================================= */
    let tK = 0, glintT = 0, bgOn = ctx.background !== false;   // ctx.background === false — без фоновой достройки (замеры, тесты)
    const _v3 = new T.Vector3(), _m4 = new T.Matrix4(), _m5 = new T.Matrix4(), _m6 = new T.Matrix4();
    // обходы — заранее созданными функциями (без замыканий в кадре): шаг зверей/колёс, тени, ореолы усилителей
    let _dt = 0, _si = 0;
    function stepOb(ob) {
      const sp = ob.speed, dt = _dt;
      if (ob.an) { const n = ob.npc, walk = sp > 0.05 ? 1 : 0, gait = ob.id === 'cart' ? 4 + sp * 0.7 : 3 + sp * 1.4; ob.ph = (ob.ph || ob.t) + dt * gait;
        ob.graze = lerp(ob.graze || 0, walk ? 0 : 0.55 + 0.15 * Math.sin(tK * 0.7 + ob.t), Math.min(1, dt * 3));
        ob.an.U.uAn.value.set(ob.ph, walk, tK * 1.9 + ob.t, ob.graze);
        if (ob.an.facePivot) ob.an.facePivot.rotation.x = Math.sin(ob.ph * 0.5) * 0.06 * walk + ob.graze; ob.an.body.position.y = Math.abs(Math.sin(ob.ph)) * 0.025 * walk;
        n.blinkT = (n.blinkT || 1) - dt; if (n.blinkT <= 0 && n.faceMat) { n.closed = !n.closed; n.faceMat.map = n.closed ? n.faceClosed : n.faceOpen; n.blinkT = n.closed ? 0.13 : 2.2 + fxR() * 3; } }
      if (ob.wheels) { ob.wheels[0].rotation.x += sp * dt / 0.46; ob.wheels[1].rotation.x += sp * dt / 0.46; }
      // танцор: на перебежке — подскоки, в круге — пляшет на месте, поворачиваясь (лезгинка); санки на ходу — покачивание
      if (ob.id === 'dancer' && ob.body) { ob.ph = (ob.ph || ob.t) + dt * (ob.moving ? 10 : 6.5); ob.body.position.y = Math.abs(Math.sin(ob.ph)) * (ob.moving ? 0.14 : 0.06); ob.body.rotation.y = ob.moving ? Math.sin(ob.ph * 0.5) * 0.25 : Math.sin(ob.ph * 0.35) * 1.1; }
      else if (ob.id === 'sled' && ob.body) ob.body.rotation.z = ob.moving ? Math.sin(tK * 21 + ob.t) * 0.035 : 0;
      if (ob.rollMesh) ob.rollMesh.rotation.x += sp * dt / 0.39;
    }
    function shadowOb(ob) {
      if (_si >= SHAD.instanceMatrix.count || !ob.group.parent || !ob.group.visible) return; ob.group.updateMatrixWorld(); _m4.multiplyMatrices(_m5, ob.group.matrixWorld);
      const k = ob.shadowK; _m6.makeScale(ob.shadow[0] * k, 1, ob.shadow[1] * k); _m6.setPosition(0, 0.015, 0); _m4.multiply(_m6); SHAD.setMatrixAt(_si++, _m4);
    }
    function stepPow(pw) {
      pw.t += _dt; const k = 1.7 + Math.sin(pw.t * 4) * 0.15; pw.halo.scale.set(k, k, k);
      if (Math.sin(pw.t * 2.1) > 0.995 && pw.group.parent) { pw.group.updateMatrixWorld(); _v3.set(0.2, 0.3, 0.2).applyMatrix4(pw.group.matrixWorld); FX.root.updateMatrixWorld(); FX.root.worldToLocal(_v3); fx.glint(_v3, 0.9); }
    }
    function stepFind(fd) {
      fd.t += _dt; fd.beam.scale.x = fd.beam.scale.z = 1 + Math.sin(fd.t * 3.2) * 0.12;   // столб «дышит»
      if (Math.sin(fd.t * 2.7) > 0.9 && fd.group.parent) { fd.group.updateMatrixWorld(); _v3.set((fxR() - 0.5) * 0.5, (fxR() - 0.3) * 0.6, 0.2).applyMatrix4(fd.group.matrixWorld); FX.root.updateMatrixWorld(); FX.root.worldToLocal(_v3); fx.glint(_v3, 1.1); }
    }
    function tick(dt) {
      if (!(dt > 0)) return; dt = Math.min(dt, 0.1); tK += dt; _dt = dt;
      OLIVE.forEach(stepOb);
      // тени препятствий: пятно под каждой живой группой (в координатах FX.root)
      _si = 0; FX.root.updateMatrixWorld(); _m5.copy(FX.root.matrixWorld).invert(); OLIVE.forEach(shadowOb);
      if (SHAD.count !== _si || _si) { SHAD.count = _si; SHAD.instanceMatrix.needsUpdate = true; }
      // усилители: вращает и качает ядро (group.rotation.y, y); здесь — дыхание ореола и редкий блик
      PLIVE.forEach(stepPow); FLIVE.forEach(stepFind);
      // блеск монет: раз в ~0,2 с — звёздочка на случайной видимой монете
      glintT -= dt;
      if (glintT <= 0 && COINS.length) { glintT = 0.18 + fxR() * 0.12; const m = COINS[0];
        if (m.count > 0 && m.parent) { const i = Math.floor(fxR() * m.count); m.getMatrixAt(i, _m4); _v3.setFromMatrixPosition(_m4); m.updateMatrixWorld(); _v3.applyMatrix4(m.matrixWorld); FX.root.updateMatrixWorld(); FX.root.worldToLocal(_v3); _v3.x += (fxR() - 0.5) * 0.25; _v3.y += 0.1; fx.glint(_v3, 0.55); } }
      stepFx(SP, dt); stepFx(DU, dt);
      if (bgOn) bgStep();
    }

    /* =================================================================
       13. СЧЁТ И ОСВОБОЖДЕНИЕ
       ================================================================= */
    const trisOf = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    function stats() {
      let tris = 0, calls = 0;
      ALL.forEach(s => { if (!s.live) return; s.meshes.forEach(m => { if (!m.visible || (m.isPoints && !matHalo.visible)) return; calls++; if (!m.isPoints) tris += trisOf(m.geometry); }); });
      OLIVE.forEach(ob => ob.group.traverse(m => { if (m.isMesh && m.visible) { calls++; tris += trisOf(m.geometry); } }));
      if (SHAD.count) { calls++; tris += 2 * SHAD.count; }
      COINS.forEach(m => { if (m.count > 0 && m.parent) { calls++; tris += trisOf(coinGeo) * m.count; } });
      PLIVE.forEach(pw => pw.group.traverse(m => { if ((m.isMesh || m.isSprite) && m.visible) { calls++; tris += m.isSprite ? 2 : trisOf(m.geometry); } }));
      FLIVE.forEach(fd => { if (fd.group.parent && fd.group.visible) fd.group.traverse(m => { if ((m.isMesh || m.isSprite) && m.visible) { calls++; tris += m.isSprite ? 2 : trisOf(m.geometry); } }); });
      if (SKY.live) SKY.live.root.traverse(m => { if ((m.isMesh || m.isPoints || m.isSprite) && m.visible) { calls++; if (m.isMesh) tris += trisOf(m.geometry); } });
      GATE.live.forEach(g => { if (g.group.parent && g.group.visible) g.meshes.forEach(m => { calls++; tris += trisOf(m.geometry); }); });
      [SP, DU].forEach(S2 => { if (S2.any) calls++; });
      return { tris: Math.round(tris), calls, segments: [...ALL].filter(s => s.live).length, built: ALL.size, obstacles: OLIVE.size, bg: { built: BGS.built, maxSlice: +BGS.maxSlice.toFixed(1), ms: Math.round(BGS.ms), job: BG ? BG.key : null, sync: BGS.sync, lastSync: BGS.lastSync } };
    }
    function dispose() {
      if (SKY.live) SKY.live.dispose();
      BG = null; bgOn = false; lastTh = null;
      [...ALL].forEach(s => { if (s.group.parent) s.group.parent.remove(s.group); disposeSeg(s); }); ALL.clear(); POOL.clear(); BUILT.clear();
      OLIVE.forEach(ob => { if (ob.group.parent) ob.group.parent.remove(ob.group); }); OLIVE.clear(); OPOOL.clear();
      OGEO.forEach(g => g.dispose()); OGEO.clear();
      COINS.forEach(m => { if (m.parent) m.parent.remove(m); m.dispose(); }); COINS.length = 0;
      PLIVE.forEach(pw => { if (pw.group.parent) pw.group.parent.remove(pw.group); }); PLIVE.clear();
      FLIVE.forEach(fd => { if (fd.group.parent) fd.group.parent.remove(fd.group); }); FLIVE.clear(); Object.keys(FPOOL).forEach(k => delete FPOOL[k]);
      GATE.live.forEach(g => { if (g.group.parent) g.group.parent.remove(g.group); }); GATE.live.clear(); GATE.pool.length = 0; GATE.geo = GATE.signGeo = null;
      if (FX.root.parent) FX.root.parent.remove(FX.root);
      own.forEach(x => { try { x.dispose && x.dispose(); } catch (e) { /* уже */ } }); own.length = 0;
      K.dispose();
    }

    return {
      LANE, SEG_LENS: SEG_LENS.slice(), CAT, quality: Q, named, season: WIN ? 'winter' : 'autumn',
      themes: THEMES.map(t => ({ id: t.id, title: t.title, titleN: t.titleN, hour: t.hour, name: named ? t.title : t.titleN })),
      ROAD: { half: ROAD, curb: CURB, walk: WALK, walkY: WALK_Y, garland: GAR },
      segment, obstacle, coins, powerup, sky, fx, stats, dispose, gate,
      find, shield,            // пасхалки (роль EGGS): находка на трассе (id из V.runnerEggs.FINDS) и щит кольчуги на героине
      update: tick,            // если неба нет (стенд, тесты): время анимаций и частиц
      light: lightAt,          // свет часа (для актёров/интерфейса): { hor, fog, n: [hi, si, el, az, sat, glow, lamps, stars, clouds] … }
      // прогрев пула (по желанию ядра на заставке): по одному сегменту каждой длины для тем themeIds — без вставки в сцену
      // + по экземпляру каждого препятствия (корова и тележка — по три: на поздних этапах их несколько сразу; варианты лавки
      // и ковров, сарай всех длин) и усилителей:
      // первая встреча в забеге — из пула, без постройки (до 20–30 мс на корову на слабом CPU)
      prewarm(themeIds, n) {
        (themeIds || THEMES.map(t => t.id)).forEach(id => SEG_LENS.forEach(len => { for (let i = 0; i < (n || 1); i++) segment(id, len, Math.random, { landmark: null }).release(); }));
        const tmp = [];
        Object.keys(CAT).forEach(id => { const vs = id === 'stall' || id === 'carpet' ? [0, 1, 2] : id === 'dancer' ? [0, 1] : [0], ls = id === 'shed' ? [8, 10, 12, 14, 16] : [0], k = id === 'cow' || id === 'cart' || id === 'goat' ? 3 : 1;
          const lanes = id === 'sled' ? [0, 1, 2] : [1], ths = CAT[id].moving || CAT[id].lateral ? [''] : ['', 'winter'];   // зимние — со снегом (свой пул)
          vs.forEach(v => ls.forEach(l => lanes.forEach(ln => ths.forEach(th => { for (let i = 0; i < k; i++) tmp.push(obstacle(id, { variant: v, len: l || undefined, dir: 0, lane: ln, theme: th })); })))); });
        tmp.forEach(ob => ob.release());
        ['magnet', 'x2', 'glide', 'mail'].forEach(id => powerup(id).release());
        if (EGG) EGG.FINDS.forEach(f => find(f.id).release());   // находки — тоже из пула (рецепт + Baker ≈ 1–3 мс на вещь)
        gate().release();
      },
      _internal: { K, LU, matA, matG, matRoad, matSign, SIGN, POOL, ALL, segSteps, THEME,
        cameoMesh(kind) { const bk = new K.Baker('atlas'); cameo(bk, new K.Frame(0, 0, 0, 0), kind); return meshOf(bk, matA, { name: 'cameo:' + kind }); },
        trace(on) { TRACE = on ? [] : null; return TRACE; } },   // стенд пасхалок: житель отдельно
    };
  }

  V.runnerKit = { create, LANE, SEG_LENS, CAT, THEMES: THEMES.map(t => ({ id: t.id, title: t.title, titleN: t.titleN, hour: t.hour })) };
})();
