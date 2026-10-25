/* =====================================================================
   ГОРНАЯ ДОРОГА из города в горное село (VILLAGE.regions.serpentine; имя региона прежнее).
   ВОЛНА 6 (MOUNTAIN-ROAD, желания автора): КОНТУРНАЯ дорога вместо серпантина — «когда едешь в сторону Кубачи, по правую
   сторону скалы, по левую обрыв; из Кубачи в город — скалы слева, обрыв справа». Шпилек нет (они меняют стороны местами):
   дорога идёт по склону-кольцу вокруг долины (азимут от башни −86° → 42°), набирает высоту ровным уклоном ≈ 8,5 % и петляет
   по горизонталям — в лощины и вокруг отрогов. Справа по ходу вверх — слоистая скальная стенка 8–16 м с навесами, кустами и
   осыпью, слева — травяная бровка, обрыв и зелёные террасы долины. Камушки со скалы (handle.pebbles), щит «Осторожно,
   камушки». Описание ниже (волны 3–5) — про прежние места и ручку; где говорится о шпильках и плечах — см. README «Волна 6».
   W6+ (скрины автора с телефона, «текстуры пропадают, резко обрывается туман, щель между склоном и дорогой, склон должен быть
   крутой в подъём»): плоская пелена облаков больше не режет кадр — у неё свой шейдер, рядом с камерой (до 16 м) её нет,
   к 120 м густеет (CLOUD_FADE), клубы тают вблизи; туман у подножия реже (долина видна, а не «пустота»), в облаке «молоко»
   мягче, переходы растянуты по высоте. Справа по ходу вверх стенка выше (10,5–18,5 м, у начала ≈ 6 м) и над ней ещё ≈ 16 м
   крутого скального склона ≈ 55° (UPK, UPL); слева — почти ровная бровка 2,4 м и скруглённая кромка обрыва (dropOf),
   её видно с камеры за машиной. Террасы долины — по настоящим горизонталям, только на склонах средней крутизны и не ближе
   ≈ 45 м к дороге (клинья-«плавники» у дороги убраны). Камень на крутом — без мелких пластов на крупной сетке (полосы-«лучи»).
   ---------------------------------------------------------------------
   (история) серпантин из города в горное село.
   Мягкий toon, как в городе. Дорога начинается у края города (указатель «Кубачи ↑» и «Город ↓»),
   идёт вдоль подножия в осеннем тумане, по мостику через ручей, потом 7 плеч и 6 шпилек вверх
   по склону напротив села: скальные выемки, травяные склоны, осенние кроны. На четвёртом плече машина выныривает
   из облаков, и через долину встаёт село с круглой башней над морем облаков. У последней шпильки — смотровая
   с лавочкой и туром на камне. В конце — ворота-указатель и облачная шторка (переход в село).

   ВОЛНА 4 (желания автора, kubachi_spec2 §7): «старая» горная дорога —
     · БЕЗ ОГРАЖДЕНИЙ: ни парапетов, ни столбиков; со стороны обрыва — только сухая кладка ниже полотна и каменная кромка
       вровень с дорогой. Безопасность — невидимый мягкий край (машина: drive.js, героиня: коллайдеры kind 'edge');
     · ПОКРЫТИЕ: бледные заплатки старого асфальта, щебень, укатанная земля с травой посередине, колеи, ямы, лужи с
       грязью, бурые сырые пятна, камни на полотне и по обочинам, щебень на внутренней стороне петель; зимой — снег,
       слякоть в колеях, ледок в лужах. Всё в одной сетке полотна (те же вызовы). Подвеска машины чувствует ямы и камни:
       road.surface(x, z) / road.surfaceSE(s, e) → { kind, wet, dz, rough };
     · ЛАВОЧКИ: ещё 4 кармана с лавочкой на смотровых точках (плечи L3, L4, L5 и выезд) — места road_bench1…4
       (+ прежняя road_view), use() → { kind:'sit', seat, ry, view }, виды bench1…bench4;
     · (W8: развилки к отелю больше нет — желание автора «в отель — только через село, выше по горе»: дорога одна, до
       ворот села; в отель — из села, дорогой мимо школы наверх. См. README «Без развилки»);
     · ХОДЬБА: героиня может выйти из машины где угодно — handle.collide / walkable / groundInfo / rayHit / dynamic.

   Координаты — общие «макро» из kubachi_visual.md (метры; x восток, y вверх, z юг; y = 0 — площадь села),
   поэтому село с дороги и дорога из села стоят на своих местах без подгонки. Регион — своя сцена.

   VILLAGE.regions.serpentine.build(opts) → handle (контракт регионов, см. README села):
     opts: { THREE, scene, named = VILLAGE.named ?? true, season: 'autumn'|'winter', quality: 'low'|'high', kit?, lights? }
     handle: { spawn, carSpawn, colliders, ground(x,z), npcs, spots, exits, camera:{views, far, near},
               road (для VILLAGE.drive), update(dt, heroPos, camera), dispose() }
     handle.road = { len, project(x,z,hintS), sample(s), kmax(s,ahead), sOfTag(tag),
                     areas(x,z,hintS) → [проекция на дорогу] — для мягкого края машины и ходьбы,
                     surface(x,z,hintS), surfaceSE(s,e) }                  // покрытие: яма/лужа/грязь/камень
     handle.moments — «вау»-момент (показать село с L3); handle.cameraBias(x,y,z,heading,s) — разворот камеры к долине.
     Волна 4 (добавлено, прежнее не тронуто): collide(x,z,r,y) → [x,z] · walkable(x,z) · groundInfo(x,z) → {y, kind}
       · rayHit(a,b) · dynamic: [] (подвижные коллайдеры: машина — drive.collider) · benches: [{id,x,y,z,ry,seat,view,s}]
       · views bench1…4 · sOf.benches · stats(). (W8: ветка к отелю — road.branch, hotel, выход toHotel, вид fork, sOf.fork
       и .hotelRoad() — убрана.)
   Отступление от библии: плечи наискось (+6 м по ρ, зигзаг как на фото p5), склон 0,636, подъезд с запада, выезд по бровке
   (подробно — plan2/kubachi_road.md; волна 4 — plan2/wave4_road.md).
   Дополнительно: .path() — осевая дороги в макро-координатах; .distant(THREE, season) — лента серпантина
   для вида из села (1 вызов); .groundMacro(x, z) — естественный рельеф склона (без врезки дороги), для фона села;
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  V.regions = V.regions || {};
  const PI = Math.PI, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smax = (a, b, k) => 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k));
  const smin = (a, b, k) => 0.5 * (a + b - Math.sqrt((a - b) * (a - b) + k * k));
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  /* ---------- общий набор села (vkit.js грузится раньше): шум, случайность, палитра — одна на оба региона ---------- */
  const VK = V.vkit;
  if (!VK) throw new Error('serpentine.js: сначала подключите js/village/vkit.js (общая палитра и шум)');
  const rng = VK.rng, hash2 = VK.hash2, vnoise = VK.vnoise;
  const palette = () => Object.assign({}, VK.PAL);

  /* ---------- макро-рамка: ρ и v от оси башни, склон напротив по азимуту +27° ---------- */
  const TX = -11.2, TZ = -15.4, SB = 27 * D2R;
  const DB = [Math.sin(SB), Math.cos(SB)], LT = [Math.cos(SB), -Math.sin(SB)];   // DB — вверх по склону, LT — вдоль (на ВСВ)
  const RV2XZ = (r, v) => [TX + DB[0] * r + LT[0] * v, TZ + DB[1] * r + LT[1] * v];
  const XZ2RV = (x, z) => { const dx = x - TX, dz = z - TZ; return [dx * DB[0] + dz * DB[1], dx * LT[0] + dz * LT[1]]; };
  const TOWER = { x: -11.18, z: -15.44, y0: 5.0, top: 18.0 };
  const CLOUD_TOP = -90;

  /* ---------- рельеф (макро): село по рядам (блокаут арт-директора), чаша долины, склон с серпантином ---------- */
  const ROWS = [[96, -0.5, 0.42], [88.5, -0.5, 0.46], [81, -0.48, 0.5], [73.5, -0.42, 0.54], [66, -0.34, 0.58], [58.5, -0.22, 0.62], [51, -0.1, 0.66], [43.5, 0.02, 0.7], [36, 0.3, 0.74]];
  const CZ = 96;
  function rowOf(r) { for (let k = 0; k < 9; k++) if (r > ROWS[k][0] - 7.5 && r <= ROWS[k][0]) return k; return -1; }
  function villageY(x, z) {
    if (z >= CZ - 2) return -999;
    const r = Math.hypot(x, z - CZ), ph = Math.atan2(x, CZ - z);
    let y;
    if (r >= 96) { const ex = Math.max(0, ph - 0.42, -0.62 - ph); y = Math.max(-6, -Math.max(0, r - 150) * 0.12) - ex * r * 0.9 - Math.max(0, r - 125) * 0.25 * (ph > 0.3 ? 1 : 0); }
    else {
      y = -0.64 * (96 - r) - 2.6;
      const k = rowOf(r), lo = k >= 0 ? ROWS[k][1] : -0.5, hi = k >= 0 ? ROWS[k][2] + 0.3 : 0.75;
      if (ph < lo - 0.03) y -= 3 + (lo - 0.03 - ph) * r * 0.45;
      if (ph > hi) y -= 2 + (ph - hi) * r * 0.8;
      const lat = Math.abs(ph - 0.08) * Math.max(r, 30) - 58; if (lat > 0) y -= lat * 0.9;
    }
    return y;
  }
  function bowlY(rho, beta) {
    let ys;
    if (rho < 300) ys = -45 - Math.max(0, rho - 90) * 0.5;
    else if (rho < 330) ys = -150;
    else if (rho < 480) ys = -150 + (rho - 330) * 0.8;
    else if (rho < 1200) ys = -30 + (rho - 480) * 0.09;
    else ys = 34.8 - (rho - 1200) * 0.05;
    ys += 9 * Math.sin(beta * 0.11 + 1.3) * sm(540, 760, rho) + 4 * Math.sin(beta * 0.37 + rho * 0.02) * sm(520, 900, rho);
    const yn = 2 + Math.max(0, rho - 130) * 0.08 + 6 * Math.sin(beta * 0.09) * sm(300, 700, rho);
    const s = Math.cos(beta * D2R), k = sm(-0.05, -0.45, s);
    return ys + (yn - ys) * k;
  }
  function spurY(rho, beta) {
    const along = rho * Math.cos((beta - 2) * D2R), lat = Math.abs(rho * Math.sin((beta - 2) * D2R));
    return -45 - Math.max(0, along - 80) * 0.25 - Math.max(0, lat - 22) * 0.75;
  }
  // склон напротив села (старая плоскость серпантина): дальше бровки — плато ~−14 на r 515; W6 — только плато и края сектора
  function wallY(r, v) {
    let y = smax(-150, -114.5 + (r - 362) * 0.636, 12);
    y = smin(y, -14 + (r - 515) * 0.09, 10);
    return y + 1.5 * Math.sin(v * 0.071 + r * 0.031) + 0.9 * Math.sin(v * 0.17 - r * 0.12 + 1.7);
  }
  // когда вдали рисуется настоящее село (kubachi.distant с террасами), грубую «чашу села» здесь опускаем под его рельеф
  let VSINK = 0;
  function villageSink(x, z) {
    if (!VSINK) return 0;
    // чаша под селом (ρ < 300 от башни) — у села своя, с текстурой крон; дорога начинается дальше (ρ ≥ 318)
    const bowl = 5 * sm(298, 289, Math.hypot(x - TX, z - TZ));
    if (z >= CZ - 2) return bowl;
    const r = Math.hypot(x, z - CZ), ph = Math.abs(Math.atan2(x, CZ - z));
    // W6++: село вдали рисует свой рельеф целиком (|ph| < 1, r < 136) — чаша под ним шире, иначе дальний рельеф дороги
    // местами закрывал его кроны (дорога отсюда дальше 370 м)
    return Math.max(bowl, VSINK * sm(138, 128, r) * sm(20, 26, r) * sm(1.04, 0.96, ph));
  }
  // прежний макро-рельеф (чаша долины + плоскость склона по азимуту 25°) — вне сектора дороги и на краях сектора
  function oldBase(x, z, rho, beta) {
    let y = bowlY(rho, beta);
    const wB = sm(52, 30, Math.abs(beta - 25)) * sm(250, 305, rho);
    if (wB > 0) { const rv = XZ2RV(x, z); y += (wallY(rv[0], rv[1]) - y) * wB; }
    return y;
  }
  // плато над склоном (то же, что у прежнего рельефа выше бровки): над дорогой склон упирается в него
  function plateauY(x, z, rho, beta) {
    const pb = bowlY(Math.max(rho, 480), beta) + Math.min(0, rho - 480) * 0.09;
    const wB = sm(52, 30, Math.abs(beta - 25)) * sm(250, 305, rho);
    if (wB <= 0) return pb;
    const rv = XZ2RV(x, z), r = rv[0], v = rv[1];
    const pw = -14 + (r - 515) * 0.09 + 1.5 * Math.sin(v * 0.071 + r * 0.031) + 0.9 * Math.sin(v * 0.17 - r * 0.12 + 1.7);
    return pb + (pw - pb) * wB;
  }

  /* ---------- W6 (MOUNTAIN-ROAD, желание автора): КОНТУРНАЯ дорога вместо серпантина со шпильками ----------
     «Когда едешь в сторону Кубачи — справа скалы, слева обрыв; из Кубачи в город — скалы слева, обрыв справа».
     Шпилька меняет стороны местами, поэтому шпилек нет: дорога идёт по склону-кольцу вокруг долины (по азимуту от башни
     села — против часовой, если смотреть с неба: село и долина всё время СЛЕВА по ходу вверх), набирает высоту ровным
     уклоном ≈ 8–9 % (в облачном слое чуть круче) и петляет по горизонталям: заходит в лощины (поворот направо, крутой
     левый у головы лощины, направо — на выход) и огибает отроги. Ни одного разворота — справа всегда склон вверх.
     PLAN: азимут B0 → B1 (°), высота Y0 → Y1, радиус горизонтали R0 + (y − Y0)·RK; feat — лощины (+, м вглубь склона) и
     отроги (−, м к долине): [азимут, полуширина °, размах]; stream — номер лощины с ручьём и мостиком. */
  const PLAN = {
    B0: -86, B1: 42, Y0: -114, Y1: -26, R0: 370, RK: 1.35, flat0: 26, flat1: 84,   // flat1: ровная площадка на выезде, у ворот
    feat: [[-72, 5.5, 20], [-60, 7, -14], [-46, 5, 16], [-32, 8, -22], [-17, 5.5, 24], [-3, 7, -16], [11, 5, 15], [23, 6, -10]],
    stream: 0,
    // относительная крутизна по высоте: в облачном слое (−108…−88) на треть круче — короче «молоко»
    grade: y => (y > -108 && y < -88 ? 1.35 : 1),
  };
  const meander = b => { let m = 0; for (const [c, w, A] of PLAN.feat) { const u = (b - c) / w; if (Math.abs(u) < 1) m += A * 0.5 * (1 + Math.cos(PI * u)); } return m; };
  const FLOOR = (rho, beta) => -150 + 1.2 * Math.sin(beta * 0.13 + 0.4) + 0.8 * Math.sin(rho * 0.05);

  /* ---------- осевая дороги ---------- */
  const DS = 1.0;
  let PATH = null;
  function buildPath() {
    if (PATH) return PATH;
    // высота по длине: доля пути t → y (обратная к ∫ dy / grade(y)), ровные участки в начале и в конце
    const YT = []; { let acc = 0; for (let y = PLAN.Y0; y <= PLAN.Y1 + 1e-6; y += 0.25) { YT.push([y, acc]); acc += 0.25 / PLAN.grade(y + 0.125); } }
    const SY = YT[YT.length - 1][1];
    const yOfT = t => { const want = clamp(t, 0, 1) * SY; let lo = 0, hi = YT.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (YT[m][1] <= want) lo = m; else hi = m; } const a = YT[lo], b = YT[hi]; return a[0] + (b[0] - a[0]) * clamp((want - a[1]) / Math.max(1e-9, b[1] - a[1]), 0, 1); };
    let raw = null, L = 900;
    for (let pass = 0; pass < 4; pass++) {
      raw = []; let s = 0, px = null, pz = null;
      for (let b = PLAN.B0; b <= PLAN.B1 + 1e-9; b += 0.02) {
        const y = yOfT((s - PLAN.flat0) / Math.max(1, L - PLAN.flat0 - PLAN.flat1)), r = PLAN.R0 + (y - PLAN.Y0) * PLAN.RK + meander(b);
        const x = TX + Math.sin(b * D2R) * r, z = TZ + Math.cos(b * D2R) * r;
        if (px !== null) s += Math.hypot(x - px, z - pz); px = x; pz = z;
        raw.push({ x, z, y, tag: '' });
      }
      L = s;
    }
    let P = raw;
    const resample = (src, ds) => {
      const cum = [0]; for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i].x - src[i - 1].x, src[i].z - src[i - 1].z));
      const L = cum[cum.length - 1], out = []; let j = 0;
      for (let s = 0; s <= L + 1e-6; s += ds) {
        while (j < src.length - 2 && cum[j + 1] < s) j++;
        const t = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1), a = src[j], b = src[j + 1];
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, tag: t < 0.5 ? a.tag : b.tag });
      }
      return out;
    };
    P = resample(P, DS);
    for (let pass = 0; pass < 14; pass++) {
      const nx = P.map(p => p.x), nz = P.map(p => p.z);
      for (let i = 1; i < P.length - 1; i++) { nx[i] = P[i].x * 0.5 + (P[i - 1].x + P[i + 1].x) * 0.25; nz[i] = P[i].z * 0.5 + (P[i - 1].z + P[i + 1].z) * 0.25; }
      P.forEach((p, i) => { p.x = nx[i]; p.z = nz[i]; });
    }
    for (let pass = 0; pass < 2; pass++) {
      const ny = P.map((p, i) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { const q = P[clamp(i + k, 0, P.length - 1)]; s += q.y; n++; } return s / n; });
      P.forEach((p, i) => { p.y = ny[i]; });
    }
    P = resample(P, DS);
    const N = P.length;
    // подписи участков (для совместимости sOfTag): 'app' — начало у края города, 'L0'…'L6' — подъём семью равными частями,
    // 'exit' — последний участок, к воротам. Шпилек ('H…') нет.
    const sApp = 60, sExit = (N - 1) * DS - 96;
    P.forEach((p, i) => { const s = i * DS; p.tag = s < sApp ? 'app' : s >= sExit ? 'exit' : 'L' + Math.min(6, Math.floor((s - sApp) / ((sExit - sApp) / 7))); });
    const A = { N, len: (N - 1) * DS, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), th: new Float32Array(N), lx: new Float32Array(N), lz: new Float32Array(N), k: new Float32Array(N), kabs: new Float32Array(N), r: new Float32Array(N), v: new Float32Array(N), rho: new Float32Array(N), beta: new Float32Array(N), tag: P.map(p => p.tag) };
    P.forEach((p, i) => { A.x[i] = p.x; A.y[i] = p.y; A.z[i] = p.z; const rv = XZ2RV(p.x, p.z); A.r[i] = rv[0]; A.v[i] = rv[1]; A.rho[i] = Math.hypot(p.x - TX, p.z - TZ); A.beta[i] = Math.atan2(p.x - TX, p.z - TZ) / D2R; });
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), th = Math.atan2(A.x[b] - A.x[a], A.z[b] - A.z[a]);
      A.th[i] = th; A.lx[i] = Math.cos(th); A.lz[i] = -Math.sin(th);
    }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2); A.k[i] = angDiff(A.th[b], A.th[a]) / Math.max(DS, (b - a) * DS); }
    for (let i = 0; i < N; i++) { let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, Math.abs(A.k[clamp(i + k, 0, N - 1)])); A.kabs[i] = m; }
    // высота скальной стенки справа (по ходу вверх): 8,5–15,5 м, ниже у начала (подножие в тумане) и к воротам (бровка)
    // W6+ (автор: «склон должен быть крутой в подъём»): стенка выше — 10,5–18,5 м, и уже у начала ≈ 6 м (была 3,5 м — у подножия
    // справа выходил пологий бугор)
    A.hc = new Float32Array(N);
    for (let i = 0; i < N; i++) { const s = i * DS; let h = 10.5 + 8 * vnoise(s * 0.011 + 2.3, 4.1); h = lerp(6, h, sm(4, 44, s)); h = lerp(h, 3.2, sm(A.len - 150, A.len - 70, s)); A.hc[i] = h; }
    PATH = A;
    return A;
  }

  /* ---------- W6: таблица дороги по азимуту — для рельефа «от дороги» (ρ, y, высота стенки при каждом β) ---------- */
  let RTAB = null;
  function roadTab() {
    if (RTAB) return RTAB;
    const R = buildPath(), db = 0.05, b0 = R.beta[0], b1 = R.beta[R.N - 1], n = Math.floor((b1 - b0) / db) + 1;
    const T = { b0, b1, db, n, r: new Float32Array(n), y: new Float32Array(n), h: new Float32Array(n), s: new Float32Array(n), stream: null };
    let j = 0;
    for (let k = 0; k < n; k++) {
      const b = b0 + k * db;
      while (j < R.N - 2 && R.beta[j + 1] < b) j++;
      const t = clamp((b - R.beta[j]) / Math.max(1e-6, R.beta[j + 1] - R.beta[j]), 0, 1);
      T.r[k] = R.rho[j] + (R.rho[j + 1] - R.rho[j]) * t; T.y[k] = R.y[j] + (R.y[j + 1] - R.y[j]) * t; T.h[k] = R.hc[j] + (R.hc[j + 1] - R.hc[j]) * t; T.s[k] = (j + t) * DS;
    }
    // ручей: по оси лощины PLAN.stream (там, где дорога ближе всего к голове лощины)
    const g = PLAN.feat[PLAN.stream];
    if (g && g[2] > 0) { const k = clamp(Math.round((g[0] - b0) / db), 0, n - 1); T.stream = { b: g[0], r: T.r[k], y: T.y[k], s: T.s[k] }; }
    RTAB = T;
    return T;
  }
  const W0 = 3.4;   // полоса дороги с обочиной (м от оси, по радиусу)
  // рельеф около дороги: справа (выше по склону) — скальная стенка 10–18 м (≈ 70°), над ней КРУТОЙ склон UPK до плато;
  // слева — травяная бровка 2,4 м, скруглённая кромка, обрыв ≈ 24 м (1,05), ниже — пологие склоны 0,6 (террасы) до дна долины −150
  // W6+: склон над стенкой был 0,72 (≈ 36°) — с дороги справа читался пологий травяной бок; теперь над стенкой ещё ≈ 16 м
  // (по горизонтали) крутого скального склона ≈ 55° (подъём ≈ 23 м), выше — прежние 0,72 до плато (не стена до неба:
  // дальняя сетка рельефа крупная, высокий крутой бок на ней расплывался полосами)
  const UPK = 1.45, UPL = 16;
  // обрыв слева: раньше сразу за бровкой 2 м шёл уклон 1,1 — с камеры за машиной он не виден (круче луча взгляда), и рядом
  // с полотном казалось «пусто». Теперь бровка почти ровная (0,12) 2,4 м, потом уклон плавно растёт до 1,05 на 5 м
  // (скруглённая кромка видна сверху), дальше обрыв 23 м и пологие склоны. Перепад до низа обрыва — прежний (≈ 28 м).
  function dropOf(d) {
    const a = 2.4, b = 7.4, s0 = 0.12, s1 = 1.05, Ls = 23;
    if (d <= a) return s0 * d;
    if (d <= b) { const t = d - a; return s0 * d + (s1 - s0) * t * t / (2 * (b - a)); }
    return s0 * b + (s1 - s0) * (b - a) / 2 + s1 * Math.min(d - b, Ls) + 0.6 * Math.max(0, d - b - Ls);
  }
  function roadTerrain(x, z, rho, beta) {
    const T = roadTab(), f = clamp((beta - T.b0) / T.db, 0, T.n - 1.0001), i = Math.floor(f), t = f - i;
    const rR = T.r[i] + (T.r[i + 1] - T.r[i]) * t, yR = T.y[i] + (T.y[i + 1] - T.y[i]) * t, hc = T.h[i] + (T.h[i + 1] - T.h[i]) * t;
    const q = rho - rR;
    let y;
    if (q > W0) { const d = q - W0, d2 = Math.max(0, d - hc / 2.8); y = yR + smin(2.8 * d, hc + smin(UPK * d2, UPK * UPL + 0.72 * (d2 - UPL), 6), 1.5); y = smin(y, plateauY(x, z, rho, beta), 6); }
    else if (q < -W0) { const d = -q - W0; y = yR - dropOf(d); y = smax(y, FLOOR(rho, beta), 8); }
    else y = yR;
    // ручей: узкий овраг вдоль оси лощины — под дорогой (там мостик) и ниже, до дна долины; в скале — выемка-водоскат
    const sg = T.stream;
    if (sg) { const lat = rho * (beta - sg.b) * D2R; if (Math.abs(lat) < 16) { const k = Math.exp(-lat * lat / 26); y -= k * (q < W0 + 2 ? 4.6 : lerp(4.6, Math.min(5, hc * 0.45), sm(W0 + 2, W0 + 9, q))); } }
    if (rho < 330) y = Math.max(y, bowlY(rho, beta));   // склон под селом (у села своя чаша) — как раньше
    return y;
  }
  function natY(x, z) {
    const dx = x - TX, dz = z - TZ, rho = Math.hypot(dx, dz), beta = Math.atan2(dx, dz) / D2R;
    let y = oldBase(x, z, rho, beta);
    const T = roadTab(), w = sm(T.b0 - 22, T.b0 - 4, beta) * sm(T.b1 + 26, T.b1 + 8, beta) * sm(200, 250, rho);
    if (w > 0) y += (roadTerrain(x, z, rho, beta) - y) * w;
    y = Math.max(y, spurY(rho, beta));
    const yv = villageY(x, z); if (yv > y) y = yv;
    if (V.SUMMIT && V.SUMMIT.lift) y = V.SUMMIT.lift(x, z, y);   // вершина с отелем к востоку-северо-востоку от села (js/village/summit.js) — та же гора, что в селе и в отеле
    return VSINK ? y - villageSink(x, z) : y;
  }

  /* ---------- реплики дороги: литералы { who, text } (+ n — вариант без названия), их подхватит озвучка ---------- */
  // факты: туры — эндемики Кавказа [A]; летом на гребнях, к вечеру спускаются на луга [B]; рога у восточного тура сильно загнуты [B]
  const ROAD_LINES = {
    tur: [
      { who: 'tur', text: 'Привет! Я тур. Туры живут только на Кавказе.', n: { who: 'tur', text: 'Привет! Я тур. Мы живём только в этих горах.' } },
      { who: 'tur', text: 'Летом в жару лежим на скалах. Пасёмся утром и вечером.' },
      { who: 'tur', text: 'Рога? Большие, загнуты назад. Ношу с достоинством.' },
    ],
  };
  const ROAD_SPEAKERS = { tur: { name: 'Тур', icon: '🐐', voice: 'басовитый, добродушный, неторопливый' } };
  V.ROAD_LINES = ROAD_LINES;

  /* =====================================================================
     СБОРКА РЕГИОНА
     ===================================================================== */
  function build(opts) {
    opts = opts || {};
    const T = opts.THREE || window.THREE, scene = opts.scene;
    const named = opts.named !== undefined ? !!opts.named : V.named !== false;
    const season = opts.season === 'winter' ? 'winter' : 'autumn', WIN = season === 'winter';
    const quality = opts.quality === 'high' ? 'high' : 'low', HI = quality === 'high';
    const PAL = palette();
    VSINK = V.regions.kubachi && V.regions.kubachi.distantFull ? 6 : 0;
    const Q = HI ? { near: 1.5, far: 8, trees: 96, rocks: 44, tufts: 380, clouds: 2, puffs: 28, snow: 800, shadow: true }
      : { near: 2.4, far: 12, trees: 48, rocks: 26, tufts: 90, clouds: 1, puffs: 8, snow: 400, shadow: false };
    const t0 = performance.now();
    const own = [];
    const keep = x => { own.push(x); return x; };
    const C = h => new T.Color(h);
    const TXT = named
      ? { title: 'Кубачи', up: 'Кубачи', arrive: 'Кубачи', toVillage: 'В Кубачи', turName: 'Дагестанский тур' }
      : { title: 'Горное село мастеров', up: 'Горное село', arrive: 'Горное село мастеров', toVillage: 'В село', turName: 'Горный тур' };

    const root = new T.Group(); root.name = 'serpentine'; root.userData.region = 'serpentine';
    if (scene) scene.add(root);
    const GV = [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255];
    const gd = new Uint8Array(64); GV.forEach((v, i) => gd.set([v, v, v, 255], i * 4));
    const GRAD = keep(new T.DataTexture(gd, 16, 1, T.RGBAFormat)); GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    // W6++: тень от солнца гаснет к краю своей рамки (последние 18 % с каждой стороны): за рамкой three считает поверхность
    // освещённой, и тень скалы на дороге обрывалась ровной линией в ≈ 18 м перед машиной. Карта теней — прежняя (1024)
    const SHADOW_FADE = sh => {
      const src = T.ShaderChunk.shadowmap_pars_fragment, a = 'bool frustumTest = inFrustum && shadowCoord.z <= 1.0;', b = 'return shadow;';
      if (src.indexOf(a) < 0 || src.indexOf(b, src.indexOf(a)) < 0) return;
      const k = src.indexOf(b, src.indexOf(a));
      const chunk = src.slice(0, k).replace(a, a + '\n\t\tfloat edgeK = smoothstep( 0.0, 0.18, min( min( shadowCoord.x, 1.0 - shadowCoord.x ), min( shadowCoord.y, 1.0 - shadowCoord.y ) ) );') + 'return mix( 1.0, shadow, edgeK );' + src.slice(k + b.length);
      sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', chunk);
    };
    const toon = (c, x) => { const m = new T.MeshToonMaterial(Object.assign({ color: C(c), gradientMap: GRAD }, x || {})); m.onBeforeCompile = SHADOW_FADE; return keep(m); };
    // «дешёвый toon»: тот же свет (полусфера + солнце через ту же ступенчатую рампу) и туман, но свет считается в вершинах.
    // На программном рендере (и слабых телефонах) пиксель почти бесплатный; общие uniform-ы света обновляет настроение.
    const SUNDIR = (WIN ? new T.Vector3(-0.6, 0.34, 0.72) : new T.Vector3(-0.55, 0.62, 0.56)).normalize();
    const LU = { hemiSky: { value: C('#CFE0F0') }, hemiGround: { value: C('#B9A27E') }, hemiI: { value: 0.62 }, sunCol: { value: C('#FFE2BE') }, sunI: { value: 0.62 }, sunDir: { value: SUNDIR.clone() } };
    const CHEAP_V = `uniform vec3 hemiSky; uniform vec3 hemiGround; uniform float hemiI; uniform vec3 sunCol; uniform float sunI; uniform vec3 sunDir; uniform vec3 diffuse;
varying vec3 vCol;
#ifdef USE_TEX
varying vec2 vUv;
#endif
#include <fog_pars_vertex>
float ramp(float x) { return 0.392 + 0.235 * smoothstep(0.2, 0.33, x) + 0.063 * smoothstep(0.33, 0.53, x) + 0.31 * smoothstep(0.53, 0.8, x); }
void main() {
  vec3 n = normal; vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  n = mat3(instanceMatrix) * n; p = instanceMatrix * p;
#endif
  n = normalize(mat3(modelMatrix) * n);
  vec3 base = diffuse;
#ifdef USE_COLOR
  base *= color;
#endif
#ifdef USE_INSTANCING_COLOR
  base *= instanceColor;
#endif
#ifdef TOON_RAMP
  float dl = 0.5 * dot(n, sunDir) + 0.5;
#else
  float dl = max(dot(n, sunDir), 0.0);
#endif
  vec3 irr = mix(hemiGround, hemiSky, 0.5 * n.y + 0.5) * hemiI + sunCol * (sunI * ramp(dl));
  vCol = base * irr;
#ifdef USE_TEX
  vUv = uv;
#endif
  vec4 mvPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
    const CHEAP_F = `varying vec3 vCol;
#ifdef USE_TEX
uniform sampler2D map; varying vec2 vUv;
#endif
#include <fog_pars_fragment>
void main() {
  vec3 c = vCol;
#ifdef USE_TEX
  c *= texture2D(map, vUv).rgb;
#endif
  gl_FragColor = vec4(c, 1.0);
#include <fog_fragment>
}`;
    // o.toon — рампа по 0,5·(n·l) + 0,5, как у MeshToonMaterial (GRAD): дальний рельеф на высоком качестве светится так же,
    // как ближний toon — у края ближней сетки нет светлой полосы над тёмной (обычная рампа по max(n·l, 0) темнее)
    function cheap(o) {
      o = o || {};
      const m = keep(new T.ShaderMaterial({
        uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { diffuse: { value: C(o.color || '#FFFFFF') }, map: { value: null } }]),
        vertexShader: CHEAP_V, fragmentShader: CHEAP_F, defines: Object.assign(o.map ? { USE_TEX: '' } : {}, o.toon ? { TOON_RAMP: '' } : {}), fog: true, lights: false,
        vertexColors: o.vertexColors !== false, side: o.side || T.FrontSide,
        polygonOffset: !!o.polygonOffset, polygonOffsetFactor: o.pof || 0, polygonOffsetUnits: o.pou || 0,
      }));
      Object.keys(LU).forEach(k => { m.uniforms[k] = LU[k]; });
      if (o.map) m.uniforms.map.value = o.map;
      return m;
    }
    // большая статика режется на куски по сетке: three отсекает куски вне кадра (в вертикальном кадре видна малая доля склона),
    // и программный рендер не обсчитывает лишние вершины. Нормали считаются до разрезания — швов нет.
    // инстансы → одна обычная сетка с запечёнными матрицами и цветом (на программном рендере инстансы заметно дороже)
    const _bm = new T.Matrix4(), _bn = new T.Matrix3(), _bv = new T.Vector3(), _bc = new T.Color();
    function bakeInst(im) {
      const g0 = im.geometry, g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal, Cc = g.attributes.color, n = P.count, cnt = im.count;
      const pos = new Float32Array(n * cnt * 3), nor = new Float32Array(n * cnt * 3), col = new Float32Array(n * cnt * 3);
      for (let k = 0; k < cnt; k++) {
        im.getMatrixAt(k, _bm); _bn.getNormalMatrix(_bm); if (im.instanceColor) im.getColorAt(k, _bc); else _bc.setRGB(1, 1, 1);
        for (let i = 0; i < n; i++) {
          const j = (k * n + i) * 3;
          _bv.fromBufferAttribute(P, i).applyMatrix4(_bm); pos[j] = _bv.x; pos[j + 1] = _bv.y; pos[j + 2] = _bv.z;
          if (N) { _bv.fromBufferAttribute(N, i).applyMatrix3(_bn).normalize(); nor[j] = _bv.x; nor[j + 1] = _bv.y; nor[j + 2] = _bv.z; } else nor[j + 1] = 1;
          col[j] = (Cc ? Cc.getX(i) : 1) * _bc.r; col[j + 1] = (Cc ? Cc.getY(i) : 1) * _bc.g; col[j + 2] = (Cc ? Cc.getZ(i) : 1) * _bc.b;
        }
      }
      if (g !== g0) g.dispose();
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeBoundingSphere();
      const m = new T.Mesh(geo, im.material); m.name = im.name; m.castShadow = im.castShadow; m.receiveShadow = im.receiveShadow; m.renderOrder = im.renderOrder;
      return m;
    }
    function chunked(geo, mat, o) {
      o = o || {};
      const idx = geo.index.array, P = geo.attributes.position.array, names = Object.keys(geo.attributes), groups = new Map();
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const cx = (P[a] + P[b] + P[c]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
        const big = o.bigCell && Math.max(Math.abs(P[a] - P[b]), Math.abs(P[a + 2] - P[b + 2]), Math.abs(P[a] - P[c]), Math.abs(P[a + 2] - P[c + 2])) > o.bigEdge;
        const cs = big ? o.bigCell : o.cell, key = (big ? 'B' : 'S') + Math.floor(cx / cs) + ',' + Math.floor(cz / cs);
        let gr = groups.get(key); if (!gr) groups.set(key, gr = []); gr.push(t);
      }
      const grp = new T.Group(); grp.name = o.name || 'chunks';
      groups.forEach(tris => {
        const map = new Map(), I = [];
        tris.forEach(t => { for (let k = 0; k < 3; k++) { const v = idx[t + k]; let n = map.get(v); if (n === undefined) { n = map.size; map.set(v, n); } I.push(n); } });
        const g2 = keep(new T.BufferGeometry()), nv = map.size;
        names.forEach(nm => { const src = geo.attributes[nm], sz = src.itemSize, arr = new Float32Array(nv * sz); map.forEach((n, v) => { for (let k = 0; k < sz; k++) arr[n * sz + k] = src.array[v * sz + k]; }); g2.setAttribute(nm, new T.BufferAttribute(arr, sz)); });
        g2.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
        g2.computeBoundingSphere(); g2.computeBoundingBox();
        const m = new T.Mesh(g2, mat); m.renderOrder = o.renderOrder || 0; m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false; m.matrixAutoUpdate = false; grp.add(m);
      });
      geo.dispose();
      return grp;
    }
    const vcMat = HI ? toon('#FFFFFF', { vertexColors: true }) : cheap();
    // 4B: полотно — свой материал: мелкий щебень, камешки и трещины текстурой (× цвет вершин), uv — по миру (1,7 м на плитку);
    // лужи — отражение неба (маленькая кубическая карта: небо с облаками, у горизонта светлее, ниже — склон)
    const gravelTex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'), r2 = rng(1717), W2 = 256;
      c.fillStyle = '#F2F2F2'; c.fillRect(0, 0, W2, W2);
      const wrap = fn => { for (const dx of [-W2, 0, W2]) for (const dy of [-W2, 0, W2]) fn(dx, dy); };
      for (let i = 0; i < 160; i++) { const x = r2() * W2, y = r2() * W2, r = 6 + r2() * 16, v = 225 + Math.floor(r2() * 30); c.fillStyle = `rgba(${v},${v},${v},0.5)`; wrap((dx, dy) => { c.beginPath(); c.arc(x + dx, y + dy, r, 0, Math.PI * 2); c.fill(); }); }
      for (let i = 0; i < 1100; i++) { const x = r2() * W2, y = r2() * W2, r = 0.6 + r2() * 1.3, v = 120 + Math.floor(r2() * 90); c.fillStyle = `rgb(${v},${v},${v})`; wrap((dx, dy) => { c.fillRect(x + dx, y + dy, r, r); }); }
      for (let i = 0; i < 300; i++) { const x = r2() * W2, y = r2() * W2, w = 1.5 + r2() * 3.2, h = w * (0.55 + r2() * 0.4), a = r2() * Math.PI;
        wrap((dx, dy) => { c.fillStyle = 'rgba(110,110,110,0.75)'; c.beginPath(); c.ellipse(x + dx + 0.8, y + dy + 1, w, h, a, 0, Math.PI * 2); c.fill(); c.fillStyle = `rgb(${236 + Math.floor(r2() * 19)},${236},${232})`; c.beginPath(); c.ellipse(x + dx, y + dy, w, h, a, 0, Math.PI * 2); c.fill(); }); }
      c.strokeStyle = 'rgba(120,120,120,0.55)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { let x = r2() * W2, y = r2() * W2, a = r2() * Math.PI * 2; const pts = [[x, y]]; for (let k = 0; k < 9; k++) { a += (r2() - 0.5) * 1.2; x += Math.cos(a) * 6; y += Math.sin(a) * 6; pts.push([x, y]); }
        wrap((dx, dy) => { c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px + dx, py + dy) : c.moveTo(px + dx, py + dy))); c.stroke(); }); }
      const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = HI ? 4 : 2; return t;
    })();
    const roadMat = HI ? toon('#FFFFFF', { vertexColors: true, map: gravelTex }) : cheap({ map: gravelTex });
    const skyCube = (() => {
      const faces = [];
      for (let f = 0; f < 6; f++) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), r2 = rng(30 + f);
        if (f === 2) { c.fillStyle = WIN ? '#B9CCE0' : '#7AA4D6'; c.fillRect(0, 0, 64, 64); }
        else if (f === 3) { c.fillStyle = WIN ? '#C9D2DA' : '#4E4A3E'; c.fillRect(0, 0, 64, 64); }
        else { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, WIN ? '#B9CCE0' : '#7FA7D8'); g.addColorStop(0.4, WIN ? '#DCE6EF' : '#A9C6E2'); g.addColorStop(0.49, WIN ? '#EEF3F7' : '#CFDDE9'); g.addColorStop(0.52, WIN ? '#D6DDE4' : '#8E8A70'); g.addColorStop(1, WIN ? '#C9D2DA' : '#4E4A3E'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
          c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 4; i++) { const x = r2() * 64, y = 12 + r2() * 14, w = 7 + r2() * 12; c.beginPath(); c.ellipse(x, y, w, w * 0.36, 0, 0, Math.PI * 2); c.fill(); } }
        faces.push(cv); }
      const t = keep(new T.CubeTexture(faces)); t.needsUpdate = true; return t;
    })();
    const wetMat = keep(new T.MeshBasicMaterial({ vertexColors: true, envMap: skyCube, combine: T.MixOperation, reflectivity: WIN ? 0.42 : 0.5 }));
    const cR = new T.Color(), mul3 = (c, k) => cR.copy(c).multiplyScalar(k);
    const cheapVC = cheap();   // только для инстансов с цветом (деревья, камни, трава): программа одна
    // W6: маленькая «крона» для кустов на скале (6×4 сегмента, затенение снизу цветом вершин)
    let _shrubG = null;
    const crownGeoS = () => { if (_shrubG) return _shrubG; const gg = new T.SphereGeometry(1, 6, 4), p = gg.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const sh = 0.72 + 0.28 * (p.getY(i) * 0.5 + 0.5); col.set([sh, sh, sh], i * 3); } gg.setAttribute('color', new T.BufferAttribute(col, 3)); return (_shrubG = keep(gg)); };

    /* --- дорога и её «полоса» --- */
    const R = buildPath(), N = R.N;
    // W8: ветки к отелю нет — одна дорога, точки 0 … N−1 (в отель — только через село)
    const SWA = new Float32Array(N), SWL = new Float32Array(N), SWR = new Float32Array(N), BRIDGE = new Uint8Array(N);
    // W6: шпилек нет — дорога-«горизонталь»; обрыв всегда СЛЕВА по ходу вверх (e > 0), скала — справа (e < 0).
    // Нос отрога — правый поворот (внутри поворота — склон), снаружи (слева) — вид через долину на село: там карманы с лавочками.
    // Смотровая с туром (road_view) — на отроге над облаками, откуда наружу лучше всего видно башню; ещё 4 кармана — на других
    // носах отрогов и на выходе к воротам (не ближе 55 м друг к другу и к выезду).
    const RTB = roadTab();
    const sEmerge = (() => { for (let i = 0; i < N; i++) if (R.y[i] > -86) return i * DS; return R.len * 0.35; })();
    const viewScore = i => { const dx = TOWER.x - R.x[i], dz = TOWER.z - R.z[i], d = Math.hypot(dx, dz) || 1; return (R.lx[i] * dx + R.lz[i] * dz) / d; };
    const noses = [];
    for (let i = 8; i < N - 8; i++) if (R.k[i] < -0.012 && R.k[i] <= R.k[i - 1] && R.k[i] <= R.k[i + 1]) { const L = noses[noses.length - 1]; if (L !== undefined && i - L < 20) { if (R.k[i] < R.k[L]) noses[noses.length - 1] = i; } else noses.push(i); }
    // W8: развилки нет, но карманы с лавочками считаются от прежнего места развилки (за 62 м до конца) — лавочки не сдвигаются
    const sFork0 = (R.len - 62);
    const okPk = i => R.y[i] > -87 && i * DS < sFork0 - 40 && i * DS > 40;
    let iAp6 = -1; { let best = -9; noses.forEach(i => { if (!okPk(i)) return; const sc = viewScore(i) + 0.15 * Math.min(1, -R.k[i] / 0.04); if (sc > best) { best = sc; iAp6 = i; } }); }
    if (iAp6 < 0) iAp6 = Math.round(N * 0.55);
    const pocketSide = 1;   // карман — снаружи носа отрога, со стороны обрыва (слева по ходу вверх)
    // центр кармана — там, где наружу смотрит прямо на башню (вид через долину)
    let iPk = iAp6; { let best = -2; for (let i = Math.max(1, iAp6 - 12); i <= Math.min(N - 2, iAp6 + 12); i++) { const c = viewScore(i); if (c > best) { best = c; iPk = i; } } }
    const POCKETS = [{ i: iPk, side: pocketSide, w: 4.6, a: 4, b: 12, main: true }];
    { const taken = [iPk], far = i => taken.every(j => Math.abs(i - j) * DS > 55);
      noses.filter(i => okPk(i) && far(i)).sort((a, b) => viewScore(b) - viewScore(a)).slice(0, 3).sort((a, b) => a - b).forEach(i => { taken.push(i); });
      // последний — на выезде, за ≈ 90 м до конца дороги (как прежний «выезд»): вид назад-вниз на долину
      const iE = clamp(Math.round((sFork0 - 30) / DS), 0, N - 1); if (far(iE)) taken.push(iE);
      taken.slice(1).sort((a, b) => a - b).forEach((i, k) => POCKETS.push({ i, side: 1, w: 3.3, a: 3, b: 9, k: k + 1 })); }
    for (let i = 0; i < N; i++) {
      let ka = 0, n = 0; for (let k = -5; k <= 5; k++) { ka += Math.abs(R.k[clamp(i + k, 0, N - 1)]); n++; } ka /= n;
      SWA[i] = 2.3 + 0.8 * sm(0.02, 0.07, ka);   // W6: чуть шире прежнего (машины быстрее): 4,6–6,2 м
      let pl = 0, pr = 0;
      POCKETS.forEach(p => { const px = p.w * (1 - sm(p.a, p.b, Math.abs(i - p.i) * DS)); if (p.side > 0) pl = Math.max(pl, px); else pr = Math.max(pr, px); });
      SWL[i] = SWA[i] + 0.5 + pl;
      SWR[i] = SWA[i] + 0.5 + pr;
      // мостик: дорога над ручьём в голове лощины (ось оврага ± 6,5 м)
      if (RTB.stream) { const lat = R.rho[i] * (R.beta[i] - RTB.stream.b) * D2R; if (Math.abs(lat) < 6.5 && Math.abs(i * DS - RTB.stream.s) < 30) BRIDGE[i] = 1; }
    }
    let iBr = -1; { let best = 1e9; for (let i = 0; i < N; i++) if (BRIDGE[i]) { const d = Math.abs(R.rho[i] * (R.beta[i] - RTB.stream.b) * D2R); if (d < best) { best = d; iBr = i; } } }

    // в сетки стенок идёт каждая вторая точка на прямых (на кривых — каждая): меньше треугольников, вид тот же
    const KEEP = new Uint8Array(N); for (let i = 0; i < N; i++) KEEP[i] = (i % 2 === 0 || i === N - 1 || R.kabs[i] > 0.02 || Math.abs(SWL[i] - SWR[i]) > 0.05) ? 1 : 0;

    /* --- пространственный хеш отрезков дороги --- */
    const HC = 8, HR = 24, hcells = new Map(), hkey = (i, j) => (i + 4096) * 8192 + (j + 4096);
    for (let i = 0; i < N - 1; i++) {
      const x0 = Math.min(R.x[i], R.x[i + 1]) - HR, x1 = Math.max(R.x[i], R.x[i + 1]) + HR, z0 = Math.min(R.z[i], R.z[i + 1]) - HR, z1 = Math.max(R.z[i], R.z[i + 1]) + HR;
      for (let a = Math.floor(x0 / HC); a <= Math.floor(x1 / HC); a++) for (let b = Math.floor(z0 / HC); b <= Math.floor(z1 / HC); b++) {
        const k = hkey(a, b); let l = hcells.get(k); if (!l) hcells.set(k, l = []); l.push(i);
      }
    }
    const hq = (x, z) => hcells.get(hkey(Math.floor(x / HC), Math.floor(z / HC))) || null;
    const SP = { t: 0, cx: 0, cz: 0, d2: 0 };
    function segP(i, x, z) {
      const ax = R.x[i], az = R.z[i], dx = R.x[i + 1] - ax, dz = R.z[i + 1] - az, L2 = dx * dx + dz * dz;
      let t = ((x - ax) * dx + (z - az) * dz) / (L2 || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
      SP.t = t; SP.cx = ax + dx * t; SP.cz = az + dz * t; SP.d2 = (x - SP.cx) * (x - SP.cx) + (z - SP.cz) * (z - SP.cz);
      return SP;
    }
    // ближайший отрезок дороги: локально около подсказки (по номеру), иначе по хешу
    function nearestSeg(x, z, hintS) {
      const lo = 0, hi = N - 2;
      let best = -1, bd = 1e18, bt = 0;
      if (hintS != null && isFinite(hintS)) {
        const i0 = clamp(lo + Math.round(hintS / DS), lo, hi);
        for (let i = Math.max(lo, i0 - 14); i <= Math.min(hi, i0 + 14); i++) { segP(i, x, z); if (SP.d2 < bd) { bd = SP.d2; best = i; bt = SP.t; } }
        // волна 4: местный отрезок годится, только если точка на его полотне (иначе на шпильке «окно» ±14 м могло
        // выбрать не ту сторону петли — без парапета машина уходила бы через середину петли)
        if (best >= 0) { const W = Math.max(SWL[best], SWR[best], SWL[best + 1], SWR[best + 1]) + 0.4; if (bd < W * W) return [best, bt, bd]; }
        best = -1; bd = 1e18;
      }
      const l = hq(x, z);
      if (l) for (const i of l) { if (i < lo || i > hi) continue; segP(i, x, z); if (SP.d2 < bd) { bd = SP.d2; best = i; bt = SP.t; } }
      if (best < 0) for (let i = lo; i <= hi; i += 1) { segP(i, x, z); if (SP.d2 < bd) { bd = SP.d2; best = i; bt = SP.t; } }
      return [best, bt, bd];
    }
    function mkProj(i, t, x, z) {
      const a = i, b = i + 1, cx = R.x[a] + (R.x[b] - R.x[a]) * t, cz = R.z[a] + (R.z[b] - R.z[a]) * t;
      const dx = R.x[b] - R.x[a], dz = R.z[b] - R.z[a], L = Math.hypot(dx, dz) || 1, lx = dz / L, lz = -dx / L;
      const e = (x - cx) * lx + (z - cz) * lz;
      return { s: (i + t) * DS, i, t, x: cx, z: cz, y: R.y[a] + (R.y[b] - R.y[a]) * t, th: Math.atan2(dx, dz), lx, lz, e,
        wl: SWL[a] + (SWL[b] - SWL[a]) * t, wr: SWR[a] + (SWR[b] - SWR[a]) * t, wa: SWA[a] + (SWA[b] - SWA[a]) * t, rid: 0, len: R.len };
    }
    const sampleS = s => {
      const f = clamp(s / DS, 0, N - 1.0001), i = Math.floor(f), t = f - Math.floor(f), j = i + 1;
      const th = R.th[i] + angDiff(R.th[j], R.th[i]) * t;
      return { s, x: lerp(R.x[i], R.x[j], t), y: lerp(R.y[i], R.y[j], t), z: lerp(R.z[i], R.z[j], t), th, lx: Math.cos(th), lz: -Math.sin(th), k: lerp(R.k[i], R.k[j], t),
        wl: lerp(SWL[i], SWL[j], t), wr: lerp(SWR[i], SWR[j], t), wa: lerp(SWA[i], SWA[j], t), tag: R.tag[t < 0.5 ? i : j], rid: 0 };
    };
    const road = {
      len: R.len, N, DS,
      project(x, z, hintS) { const [i, t] = nearestSeg(x, z, hintS); return mkProj(i, t, x, z); },
      sample(s) { return sampleS(s); },
      kmax(s, ahead) { const i0 = clamp(Math.floor(s / DS), 0, N - 1), i1 = clamp(Math.ceil((s + Math.max(0, ahead)) / DS), 0, N - 1); let m = 0; for (let i = i0; i <= i1; i++) if (R.kabs[i] > m) m = R.kabs[i]; return m; },
      sOfTag(tag) { const i = R.tag.indexOf(tag); return i < 0 ? null : i * DS; },
      // «площадь» дороги для мягкого края машины и ходьбы: [проекция { s, e, wl, wr, th, lx, lz, rid, len }] (W8: ветки нет —
      // одно полотно; массив — тот же контракт, что у дорог села)
      areas(x, z, hintS) { return [road.project(x, z, hintS)]; },
      // покрытие под точкой: { kind: 'asph'|'gravel'|'earth'|'mud'|'puddle'|'hole', wet 0..1, dz (м: яма −, камень +), rough 0..1 }
      surface(x, z, hintS) { const p = road.project(x, z, hintS); return surfSE(p.s, p.e); },
      surfaceSE(s, e) { return surfSE(s, e); },
    };
    // точка на полотне любой дороги (с отступом pad от края полотна); для ходьбы, деревьев, камней
    function onRoad(x, z, pad) {
      const l = hq(x, z); if (!l) return false;
      for (const i of l) { segP(i, x, z); if (SP.d2 > 144) continue; const p = mkProj(i, SP.t, x, z), W = (p.e > 0 ? p.wl : p.wr) + (pad || 0); if (W > 0 && Math.abs(p.e) <= W && SP.d2 <= W * W) return true; }
      return false;
    }

    /* --- волна 4: покрытие «старой» горной дороги — бледные заплатки асфальта, щебень, укатанная земля, ямы, лужи, грязь, камни ---
       По отчётам (spec2 §7): узко, выбоины, колеи, острые камни, щебень на внутренней стороне петель, лужи и грязь в низинах,
       редкие куски старого асфальта. SURF — вид полотна по точкам (0 асфальт, 1 щебень, 2 грунт), WET — сырость 0..1,
       FEAT — пятна в координатах дороги (s, e): ямы, лужи, грязь, камни на полотне (для подвески и брызг). */
    const SURF = new Uint8Array(N), WET = new Float32Array(N), ROUGH = new Float32Array(N);
    const FEAT = [], FB = new Map(), FBS = 4;
    {
      const rs = rng(4242 + (WIN ? 3 : 0));
      for (let i = 0; i < N; i++) {
        const s = i * DS, tag = R.tag[i];
        const n1 = vnoise(s * 0.021 + 3.1, 1.7), n2 = vnoise(s * 0.07 + 9.3, 4.2);
        let kind = n1 < 0.36 ? 0 : n1 < 0.6 ? 1 : 2;
        if (R.kabs[i] > 0.045) kind = n2 < 0.3 ? 0 : 1;         // W6: крутые повороты (головы лощин, носы отрогов) подсыпают щебнем
        if (tag === 'app') kind = n1 < 0.28 ? 0 : 2;                 // внизу, у ручья — больше грунта
        SURF[i] = kind;
        let w = 0;
        if (iBr >= 0) w = Math.max(w, 1 - sm(4, 30, Math.abs(i - iBr) * DS));   // у мостика сыро
        if (tag === 'app') w = Math.max(w, 0.35 * sm(0.45, 0.7, n2));
        if (R.kabs[i] > 0.045) w = Math.max(w, 0.3 * sm(0.55, 0.8, n2));
        w = Math.max(w, sm(0.72, 0.86, vnoise(s * 0.05 + 21, 0.5)) * 0.8);
        WET[i] = w;
        ROUGH[i] = kind === 0 ? 0.25 : kind === 1 ? 0.75 : 0.5;
      }
      // пятна по полотну
      const put = f => { FEAT.push(f); const a = Math.floor((f.s - f.a - 0.5) / FBS), b = Math.floor((f.s + f.a + 0.5) / FBS); for (let k = a; k <= b; k++) { let l = FB.get(k); if (!l) FB.set(k, l = []); l.push(f); } };
      const ok = (s, e, a, b) => FEAT.every(f => Math.abs(f.s - s) > f.a + a + 0.3 || Math.abs(f.e - e) > f.b + b + 0.3);
      const pocketAt = i => POCKETS.some(p => Math.abs(i - p.i) * DS < p.b + 2);
      {
        const len = (N - 1) * DS;
        // ямы: чаще на асфальте и грунте; глубина 6–9 см
        const nh = Math.round(len / (HI ? 9 : 10));
        for (let k = 0, tries = 0; k < nh && tries < nh * 8; tries++) {
          const s = 6 + rs() * (len - 12), i = Math.round(s / DS); if (BRIDGE[i] || pocketAt(i)) continue;
          if (SURF[i] === 1 && rs() < 0.5) continue;
          const wa = SWA[i], e = (rs() * 2 - 1) * (wa - 0.45), a = 0.32 + rs() * 0.38, b = 0.26 + rs() * 0.3;
          if (!ok(s, e, a, b)) continue;
          put({ kind: 'hole', s, e, a, b, rot: (rs() - 0.5) * 0.8, depth: 0.06 + rs() * 0.03 }); k++;
        }
        // лужи: в сырых местах, часто поперёк колеи; глубина 3 см, грязь вокруг
        const np = Math.round(len / (HI ? 26 : 30));
        for (let k = 0, tries = 0; k < np && tries < np * 12; tries++) {
          const s = 8 + rs() * (len - 16), i = Math.round(s / DS); if (BRIDGE[i] || pocketAt(i)) continue;
          if (WET[i] < 0.25 && rs() < 0.75) continue;
          const wa = SWA[i], a = 0.8 + rs() * rs() * 1.5, b = 0.5 + rs() * 0.6, e = (rs() * 2 - 1) * Math.max(0, wa - b - 0.2);
          if (!ok(s, e, a + 0.4, b + 0.3)) continue;
          put({ kind: 'puddle', s, e, a, b, rot: (rs() - 0.5) * 0.5, depth: 0.035 }); k++;
        }
        // грязь: бурые сырые пятна (без воды), брызги из-под колёс
        const nm = Math.round(len / (HI ? 22 : 26));
        for (let k = 0, tries = 0; k < nm && tries < nm * 10; tries++) {
          const s = 6 + rs() * (len - 12), i = Math.round(s / DS); if (BRIDGE[i] || pocketAt(i)) continue;
          if (SURF[i] === 0 && rs() < 0.7) continue;
          const wa = SWA[i], a = 0.8 + rs() * 1.2, b = 0.6 + rs() * 0.6, e = (rs() * 2 - 1) * Math.max(0, wa - b);
          if (!ok(s, e, a, b)) continue;
          put({ kind: 'mud', s, e, a, b, rot: (rs() - 0.5) * 0.6, depth: 0.012 }); k++;
        }
        // камни на полотне (острые, но мелкие): по ним машина подпрыгивает; в колеях реже
        const ns = Math.round(len / (HI ? 5 : 7));
        for (let k = 0, tries = 0; k < ns && tries < ns * 6; tries++) {
          const s = 3 + rs() * (len - 6), i = Math.round(s / DS); if (BRIDGE[i]) continue;
          const wa = SWA[i], e = (rs() * 2 - 1) * (wa - 0.15);
          if (Math.abs(Math.abs(e) - 0.75) < 0.2 && rs() < 0.6) continue;
          const r = 0.07 + rs() * rs() * 0.09;
          if (!ok(s, e, r, r)) continue;
          put({ kind: 'stone', s, e, a: r, b: r, rot: rs() * 6.28, depth: r * 0.75 }); k++;
        }
      }
    }
    const SURF_NAMES = ['asph', 'gravel', 'earth'];
    const SRES = { kind: 'gravel', wet: 0, dz: 0, rough: 0.5, s: 0, e: 0, rid: 0 };
    function surfSE(s, e) {
      const i = clamp(Math.round(s / DS), 0, N - 1);
      let kind = SURF_NAMES[SURF[i]], wet = WET[i], dz = 0, rough = ROUGH[i];
      const W = e > 0 ? SWL[i] : SWR[i];
      if (Math.abs(e) > SWA[i]) { kind = 'gravel'; rough = 0.7; }     // обочина — щебень
      const l = FB.get(Math.floor(s / FBS));
      if (l) for (const f of l) {
        const ds = s - f.s, de = e - f.e, c = Math.cos(f.rot), sn = Math.sin(f.rot), u = (ds * c - de * sn) / f.a, v = (ds * sn + de * c) / f.b, q = u * u + v * v;
        if (q >= 1) continue;
        if (f.kind === 'hole') { dz = Math.min(dz, -f.depth * (1 - q)); kind = 'hole'; rough = Math.max(rough, 0.9); }
        else if (f.kind === 'puddle') { dz = Math.min(dz, -f.depth * sm(1, 0.6, q)); kind = 'puddle'; wet = 1; }
        else if (f.kind === 'mud') { if (kind !== 'puddle' && kind !== 'hole') kind = 'mud'; wet = Math.max(wet, 0.85); }
        else if (f.kind === 'stone') { dz = Math.max(dz, f.depth * (1 - q)); }
      }
      if (Math.abs(e) > W + 0.05) kind = 'verge';
      SRES.kind = kind; SRES.wet = wet; SRES.dz = dz; SRES.rough = rough; SRES.s = s; SRES.e = e;
      return SRES;
    }

    /* --- рельеф с врезанной дорогой: полоса на уровне дороги, выше — скальная выемка, ниже — стенка и насыпь --- */
    const CUT = 3.2, FILL = 0.9, WALLMAX = 3.2, SINK = 0.22;   // W6: выемка круче (справа — скальная стенка)
    // W6++: полоса, где рельеф не выше полотна − SINK: полотно и ещё диагональ клетки за краем (треугольник сетки, задевший
    // полотно, весь под ним — без «плиток» травы поверх дороги в карманах и у мостика); обочина за краем (1,25 м и клетка) —
    // не ниже полотна − 0,6 м (под краем нет щели, юбка полотна 0,5 м её закрывает); у мостика овраг проходит под
    // полотном только в пролёте арки (BR_OPEN от оси ручья), дальше — земля как у дороги
    const ROADM = Q.near * 1.45 + 0.15, SHOULDER = Q.near + 1.25, BR_SPAN = 2.4, BR_OPEN = BR_SPAN + 0.4, sBr = iBr * DS;

    /* --- W6++: скальная стенка справа по ходу вверх — профили рядов считаются ДО рельефа. По ним ближняя сетка уходит
       под стенку (без «пилы» у подошвы), ground() отдаёт настоящую поверхность стенки (камни, трава, камера-следилка),
       меш стенки ниже строится из тех же точек. Профиль ряда: подошва, CNR точек стенки (неровности, навес), 2 точки канта. --- */
    const CLIFF_SLOPE = 3.4, CLIFF = { rows: HI ? 10 : 7, base: 1.3, slope: CLIFF_SLOPE };
    const CNR = CLIFF.rows, CNP = CNR + 3;
    // [подошва — смещение от оси, высота, верх] по точкам дороги (камушки, кусты); высота 0 — стенки нет
    const cliffInfo = new Float32Array(N * 3);
    // профили: смещение от оси вправо и высота над полотном; CROW — ряд есть в меше; CPREV/CNEXT — ближайший ряд меша
    // до/после точки без разрыва стенки между ними (−1 — нет)
    const CPE = new Float32Array(N * CNP), CPH = new Float32Array(N * CNP), COVK = new Float32Array(N);
    const CROW = new Uint8Array(N), CPREV = new Int32Array(N).fill(-1), CNEXT = new Int32Array(N).fill(-1);
    // высота стенки (мировая y) в точке f (дробный номер точки основной дороги) на смещении e (м вправо от оси):
    // профили соседних рядов меша смешиваются по f, как в самом меше. low = false — верх поверхности (над навесом — навес),
    // low = true — нижний край (под навесом — стенка под ним; ближе подошвы — высота подошвы).
    // CAJ — номер точки профиля, которой кончается найденный отрезок (> CNR — кант)
    let CAJ = 0;
    const _pe = new Float32Array(CNP), _py = new Float32Array(CNP);
    function cliffAt(f, e, low) {
      if (!(f >= 0) || f > N - 1) return null;
      const i0 = Math.min(N - 2, Math.floor(f)), a = CPREV[i0];
      let b = CNEXT[i0 + 1];
      // ровно на последнем ряду куска
      if (b < 0 && a >= 0 && f - a < 0.05) b = a;
      if (a < 0 || b < 0) return null;
      const w = b > a ? clamp((f - a) / (b - a), 0, 1) : 0, A = a * CNP, B = b * CNP, ya = R.y[a], yb = R.y[b];
      for (let j = 0; j < CNP; j++) { _pe[j] = CPE[A + j] + (CPE[B + j] - CPE[A + j]) * w; _py[j] = ya + CPH[A + j] + (yb + CPH[B + j] - ya - CPH[A + j]) * w; }
      if (e < _pe[0]) { CAJ = 0; return low ? _py[0] : null; }
      let best = null;
      for (let j = 1; j < CNP; j++) {
        const e0 = _pe[j - 1], e1 = _pe[j];
        if (e < Math.min(e0, e1) || e > Math.max(e0, e1)) continue;
        const y = Math.abs(e1 - e0) < 1e-6 ? (low ? Math.min(_py[j - 1], _py[j]) : Math.max(_py[j - 1], _py[j])) : _py[j - 1] + (_py[j] - _py[j - 1]) * (e - e0) / (e1 - e0);
        if (best === null || (low ? y < best : y > best)) { best = y; CAJ = j; }
      }
      return best;
    }
    // ближайший отрезок дороги (не по полотну, а просто ближайший): [номер, t, расстояние, e со знаком]
    const NSG = [0, 0, 0, 0];
    function nearMain(x, z) {
      const l = hq(x, z); let bi = -1, bd = 1e18, bt = 0, be = 0;
      if (l) for (const i of l) {
        segP(i, x, z); if (SP.d2 >= bd) continue;
        bd = SP.d2; bi = i; bt = SP.t; be = (x - SP.cx) * (R.z[i + 1] - R.z[i]) - (z - SP.cz) * (R.x[i + 1] - R.x[i]);
      }
      NSG[0] = bi; NSG[1] = bt; NSG[2] = Math.sqrt(bd); NSG[3] = be;
      return bi >= 0 ? NSG : null;
    }
    // поверхность скальной стенки над точкой (x, z) или null (стенки там нет)
    function cliffY(x, z) { const m = nearMain(x, z); return m && m[3] < 0 && m[2] < 24 ? cliffAt(m[0] + m[1], m[2], false) : null; }

    function shaped(x, z, yn, out, noCliff) {
      const l = hq(x, z);
      let flatY = null, flatD = 1e9, hi = Infinity, lo = -Infinity, near = 1e9, top = Infinity, sh = -Infinity;
      // ближайший отрезок основной дороги: сторона стенки и пролёт мостика
      const nm = l ? nearMain(x, z) : null, ci = nm ? nm[0] : -1, ct = nm ? nm[1] : 0, cd = nm ? nm[2] : 1e9, ce = nm ? nm[3] : 0;
      // мостик: в пролёте арки под полотном овраг ручья (только «не выше полотна»)
      const open = ci >= 0 && BRIDGE[ci] && Math.abs((ci + ct) * DS - sBr) < BR_OPEN;
      // полоса «не выше полотна» и обочина — по ближайшему отрезку дороги: по всем отрезкам в полосе на уклоне брался
      // нижний конец (−0,5 м) — у края выходила канава
      let d0 = 1e9, y0 = 0, w0 = 0;
      if (l) for (const i of l) {
        segP(i, x, z); const d = Math.sqrt(SP.d2); if (d > HR) continue;
        const t = SP.t, yr = R.y[i] + (R.y[i + 1] - R.y[i]) * t;
        const dx = R.x[i + 1] - R.x[i], dz = R.z[i + 1] - R.z[i], L = Math.hypot(dx, dz) || 1, e = (x - SP.cx) * dz / L + (z - SP.cz) * -dx / L;
        const W = e > 0 ? SWL[i] + (SWL[i + 1] - SWL[i]) * t : SWR[i] + (SWR[i + 1] - SWR[i]) * t;
        if (d - W < near) near = d - W;
        if (d < d0) { d0 = d; y0 = yr; w0 = W; }
        if (open) continue;
        // на стороне выемки — не меньше диагонали клетки: склон не налезает на обочину
        const margin = 0.15 + Q.near * 1.45 * sm(-1.0, 1.0, yn - yr);
        const ex = d - (W + margin);
        if (ex <= 0) { if (d - W < flatD) { flatD = d - W; flatY = yr - SINK; } }
        else { const a = yr - SINK + CUT * ex, b = yr - SINK - WALLMAX - FILL * ex; if (a < hi) hi = a; if (b > lo) lo = b; }
      }
      if (d0 <= w0 + ROADM) top = Math.min(top, y0 - SINK);
      if (!open && d0 > w0 - 0.05 && d0 <= w0 + SHOULDER) sh = Math.max(sh, y0 - SINK - 0.38);
      if (out) { out.near = near; out.flat = flatY !== null; }
      let y = flatY !== null ? flatY : Math.min(Math.max(yn, lo), hi);
      if (sh > y) y = sh;
      if (top < y) y = top;
      // за подошвой стенки — под её поверхность (треугольник между узлами тоже за камнем). У подошвы, до первого ряда
      // стенки и ещё клетку за ним, — ровно на 0,12 м ниже обочины: излом «обочина — стенка» вогнутый, и треугольник от
      // обочины к узлу повыше срезал угол перед камнем (та самая «пила» у подошвы); дальше — под стенкой на клетку ближе к
      // дороге, совсем высоко — на 0,9 м ниже стенки (неровности пластов). На канте — вровень с ним: кант остаётся верхом,
      // рельеф за ним не торчит над краем стенки
      if (!noCliff && ci >= 0 && ce < 0) {
        const f = ci + ct, cy = cliffAt(f, cd, false);
        if (cy !== null) {
          let m = cy - 0.04;
          if (CAJ <= CNR) {
            const g2 = Q.near * 0.75, floor = y0 - SINK - 0.12;
            let e1 = _pe[1];
            m = cy - 0.9;
            for (let k = -1; k <= 1; k += 2) { const v = cliffAt(f + k * g2, cd, true); if (v !== null) { if (v - 0.9 < m) m = v - 0.9; if (_pe[1] > e1) e1 = _pe[1]; } }
            if (cd < e1 + Q.near) m = floor;
            else if (cd < e1 + 2 * Q.near + 0.5) for (let k = -1; k <= 1; k++) { const v = cliffAt(f + k * g2, cd - g2, true); if (v !== null && v - 0.15 < m) m = v - 0.15; }
            if (floor > m) m = floor;
          }
          if (m < y) y = m;
        }
      }
      return y;
    }

    {
      // проём стенки — только самые концы дороги (там облако); W8: проёма под ветку к отелю больше нет — стенка сплошная
      const margin = 0.15 + Q.near * 1.45;
      let last = -1;
      for (let i = 0; i < N; i++) {
        const W = SWR[i], eb = W + CLIFF.base, x0 = R.x[i], z0 = R.z[i], y0 = R.y[i], lx = -R.lx[i], lz = -R.lz[i], s = i * DS;
        // у мостика (пролёт арки и чуть дальше) — каждый ряд: подошва там идёт по дну оврага (footToGround ниже)
        const brF = BRIDGE[i] && Math.abs(s - sBr) < BR_OPEN + 1.2;
        const keepI = i % 2 === 0 || R.kabs[i] > 0.03 || i === N - 1 || brF;
        const gap = s < 2 || s > R.len - 2;
        // верх стенки неровный
        let H = R.hc[i] * (0.86 + 0.28 * vnoise(s * 0.05 + 31, 1.7));
        if (RTB.stream) { const lat = R.rho[i] * (R.beta[i] - RTB.stream.b) * D2R; H *= 1 - 0.62 * Math.exp(-lat * lat / 30); }
        cliffInfo[i * 3] = eb; cliffInfo[i * 3 + 1] = gap ? 0 : H; cliffInfo[i * 3 + 2] = eb + H / CLIFF.slope;
        if (gap) { last = -1; continue; }
        if (keepI) {
          // навес: изредка верхний пласт нависает над осыпью (только на ровных участках и при высокой стенке)
          const ovK = H > 9 && R.kabs[i] < 0.03 ? sm(0.66, 0.8, vnoise(s * 0.035 + 11, 2.2)) : 0, o = i * CNP;
          let eTop = eb;
          for (let j = 0; j <= CNR; j++) {
            const h = j === 0 ? -0.35 : H * j / CNR, yw = y0 + h;
            // выпуклости и ниши по длине (не ровная стена)
            let ins = Math.max(0, h) / CLIFF.slope + 0.42 * (vnoise(s * 0.06 + 7, yw * 0.45) - 0.5) + 0.22 * Math.sin(yw * 1.9 + s * 0.03)
              + 0.75 * (vnoise(s * 0.085 + 3.3, 9.1) - 0.5) * sm(0.2, 2.5, h);
            if (j === 0) ins = -0.15;
            if (j >= CNR - 1 && ovK > 0) ins -= (j === CNR ? 0.95 : 0.55) * ovK;
            eTop = eb + Math.max(-0.2, ins);
            CPE[o + j] = eTop; CPH[o + j] = h;
          }
          // кант сверху: травяная бровка к склону ближней сетки; дальний край — не выше рельефа за ним (где рельеф ниже —
          // кант спускается к нему, а не висит лезвием)
          const capY = ec => { const xc = x0 + lx * ec, zc = z0 + lz * ec; return shaped(xc, zc, natY(xc, zc), null, true) - y0; };
          let eCap = Math.max(eTop + 0.8, W + margin + H / 2.8 + 0.6), hCap = H + 0.3;
          if (capY(eCap) < H + 0.15) { eCap = Math.min(eCap, eTop + 2.4); const yt = capY(eCap); if (yt < H + 0.15) hCap = Math.max(-0.2, yt + 0.05); }
          CPE[o + CNR + 1] = eTop + 0.35; CPH[o + CNR + 1] = H + 0.18;
          CPE[o + CNR + 2] = eCap; CPH[o + CNR + 2] = hCap;
          COVK[i] = ovK; CROW[i] = 1; last = i;
        }
        CPREV[i] = last;
      }
      let nx = -1;
      for (let i = N - 1; i >= 0; i--) { if (cliffInfo[i * 3 + 1] <= 0) nx = -1; else if (CROW[i]) nx = i; CNEXT[i] = nx; }
    }

    /* --- ближняя решётка рельефа в осях склона (ρ, v), только клетки у дороги --- */
    const g = Q.near;
    let rMin = 1e9, rMax = -1e9, vMin = 1e9, vMax = -1e9;
    for (let i = 0; i < N; i++) { rMin = Math.min(rMin, R.r[i]); rMax = Math.max(rMax, R.r[i]); vMin = Math.min(vMin, R.v[i]); vMax = Math.max(vMax, R.v[i]); }
    rMin -= HR + 2; rMax += HR + 2; vMin -= HR + 2; vMax += HR + 2;
    const NA = Math.ceil((rMax - rMin) / g) + 1, NB = Math.ceil((vMax - vMin) / g) + 1;
    const NG = { r0: rMin, v0: vMin, g, NA, NB, h: new Float32Array(NA * NB).fill(NaN), verge: new Uint8Array(NA * NB), act: new Uint8Array((NA - 1) * (NB - 1)) };
    const ACT_R = HR;
    for (let b = 0; b < NB - 1; b++) for (let a = 0; a < NA - 1; a++) {
      const r = rMin + (a + 0.5) * g, v = vMin + (b + 0.5) * g, xz = RV2XZ(r, v), l = hq(xz[0], xz[1]);
      if (!l) continue;
      let ok = false; for (const i of l) { segP(i, xz[0], xz[1]); if (SP.d2 < ACT_R * ACT_R) { ok = true; break; } }
      if (ok) NG.act[a + b * (NA - 1)] = 1;
    }
    const tmpO = { near: 0, flat: false };
    for (let b = 0; b < NB; b++) for (let a = 0; a < NA; a++) {
      const used = (a > 0 && b > 0 && NG.act[(a - 1) + (b - 1) * (NA - 1)]) || (a < NA - 1 && b > 0 && NG.act[a + (b - 1) * (NA - 1)]) || (a > 0 && b < NB - 1 && NG.act[(a - 1) + b * (NA - 1)]) || (a < NA - 1 && b < NB - 1 && NG.act[a + b * (NA - 1)]);
      if (!used) continue;
      const r = rMin + a * g, v = vMin + b * g, xz = RV2XZ(r, v), yn = natY(xz[0], xz[1]);
      const y = shaped(xz[0], xz[1], yn, tmpO), k = a + b * NA;
      NG.h[k] = y; NG.verge[k] = tmpO.flat ? 1 : tmpO.near < 4.5 ? 2 : 0;
    }
    function nearY(x, z) {
      const rv = XZ2RV(x, z), fa = (rv[0] - NG.r0) / g, fb = (rv[1] - NG.v0) / g, a = Math.floor(fa), b = Math.floor(fb);
      if (a < 0 || b < 0 || a >= NA - 1 || b >= NB - 1 || !NG.act[a + b * (NA - 1)]) return null;
      const u = fa - a, w = fb - b, k = a + b * NA, h00 = NG.h[k], h10 = NG.h[k + 1], h01 = NG.h[k + NA], h11 = NG.h[k + NA + 1];
      return u + w <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * w : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - w);
    }

    /* --- дальний рельеф: прямоугольная сетка с мелким шагом в середине и крупным по краям --- */
    const axis = (lo, hi, fLo, fHi, fs, cs) => { const a = []; for (let x = lo; x < fLo; x += cs) a.push(x); for (let x = fLo; x < fHi; x += fs) a.push(x); for (let x = fHi; x <= hi; x += cs) a.push(x); return a; };
    // вершина: гора с отелем (x 250…750, z −100…−560) — полосой средней сетки (≈ 2 шага ближней), иначе с дороги — пирамида из клеток 120 м
    const axis3 = (A, mid, ms) => { const out = A.filter(v => v < mid[0] || v > mid[1]); for (let v = mid[0]; v <= mid[1]; v += ms) out.push(v); return out.sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > ms * 0.4); };
    const FX = axis3(axis(-1500, 1680, -480, 560, Q.far, HI ? 90 : 120), [560, 780], HI ? 16 : 24), FZ = axis3(axis(-1320, 1800, -270, 610, Q.far, HI ? 90 : 120), [-640, -270], HI ? 16 : 24);   // W6: дорога заходит на запад до x ≈ −390
    const FH = new Float32Array(FX.length * FZ.length);
    // W6++ (шов сеток): дальняя сетка — природный рельеф; под ближнюю её уводит только точный проход ниже. Прежнее
    // опускание «окном» ±11 м на глубину выемки (и ещё на 3 м у полотна) тянуло её вниз и за краем ближней сетки —
    // край ближней стоял над дальней ступенью до 8 м (низкое качество — до 12 м) с зубцами по клеткам
    for (let j = 0; j < FZ.length; j++) for (let i = 0; i < FX.length; i++) FH[i + j * FX.length] = natY(FX[i], FZ[j]);
    // W6++: крупная дальняя сетка на вогнутых местах (перелом склона под обрывом) шла поверх ближней у её края — вершины
    // дальних треугольников опускаются так, чтобы в каждом узле ближней сетки дальняя была на 0,3 м ниже неё.
    // Под скальной стенкой ближняя сетка закрыта камнем: там дальней достаточно уйти под нижний край стенки (иначе
    // глубокий срез под стенкой опускал дальние треугольники до самого края ближней сетки за стенкой)
    {
      const W = FX.length, H = FZ.length, low = new Float32Array(FH.length);
      const cell = (A, x) => { let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= x) lo = m; else hi = m; } return lo; };
      // нижний край стенки над узлом (NaN — узел не под стенкой); годится, только если и все соседи под стенкой:
      // треугольники ближней сетки при узле целиком под камнем (иначе хорда от узла на стенке к узлу перед подошвой
      // выводила дальнюю перед подошву)
      const CLY = new Float32Array(NA * NB).fill(NaN);
      for (let k = 0; k < NA * NB; k++) {
        if (NG.h[k] !== NG.h[k]) continue;
        const a = k % NA, xz = RV2XZ(NG.r0 + a * g, NG.v0 + (k - a) / NA * g), nm = nearMain(xz[0], xz[1]);
        if (nm && nm[3] < 0 && nm[2] < 24) { const c = cliffAt(nm[0] + nm[1], nm[2], true); if (c !== null && CAJ > 0) CLY[k] = c; }
      }
      const cliffTop = (a, b) => {
        const c = CLY[a + b * NA]; if (c !== c) return NaN;
        for (let bb = b - 1; bb <= b + 1; bb++) for (let aa = a - 1; aa <= a + 1; aa++) {
          if (aa < 0 || bb < 0 || aa >= NA || bb >= NB) return NaN;
          const kk = aa + bb * NA; if (CLY[kk] !== CLY[kk] && NG.h[kk] === NG.h[kk]) return NaN;
        }
        return c;
      };
      for (let b = 0; b < NB; b++) for (let a = 0; a < NA; a++) {
        let tp = NG.h[a + b * NA]; if (tp !== tp) continue;
        const xz = RV2XZ(NG.r0 + a * g, NG.v0 + b * g), x = xz[0], z = xz[1];
        if (x <= FX[0] || x >= FX[W - 1] || z <= FZ[0] || z >= FZ[H - 1]) continue;
        const c = cliffTop(a, b); if (c === c && c > tp) tp = c;
        const i = cell(FX, x), j = cell(FZ, z), u = (x - FX[i]) / (FX[i + 1] - FX[i]), w = (z - FZ[j]) / (FZ[j + 1] - FZ[j]), k = i + j * W;
        let v0, v1, v2, w0, w1, w2;
        if (u + w <= 1) { v0 = k; v1 = k + 1; v2 = k + W; w1 = u; w2 = w; } else { v0 = k + W + 1; v1 = k + W; v2 = k + 1; w1 = 1 - u; w2 = 1 - w; }
        w0 = 1 - w1 - w2;
        const need = FH[v0] * w0 + FH[v1] * w1 + FH[v2] * w2 - (tp - 0.3);
        // опускание по весам (наименьшее в сумме): вершина у узла уходит вниз больше, дальняя — меньше; максимум по узлам
        // всё равно даёт нужное в каждом узле
        if (need > 0) { const q = need / (w0 * w0 + w1 * w1 + w2 * w2); if (q * w0 > low[v0]) low[v0] = q * w0; if (q * w1 > low[v1]) low[v1] = q * w1; if (q * w2 > low[v2]) low[v2] = q * w2; }
      }
      for (let k = 0; k < FH.length; k++) FH[k] -= low[k];
    }
    // дальний треугольник под точкой: вершины a, b, c и их веса (та же диагональ, что в меше дальнего рельефа)
    const FT = { a: 0, b: 0, c: 0, wa: 0, wb: 0, wc: 0 };
    function farTri(x, z) {
      let i = 0, j = 0; { let lo = 0, hi = FX.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (FX[m] <= x) lo = m; else hi = m; } i = lo; }
      { let lo = 0, hi = FZ.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (FZ[m] <= z) lo = m; else hi = m; } j = lo; }
      const u = (x - FX[i]) / (FX[i + 1] - FX[i]), w = (z - FZ[j]) / (FZ[j + 1] - FZ[j]), W = FX.length, k = i + j * W;
      if (u + w <= 1) { FT.a = k; FT.b = k + 1; FT.c = k + W; FT.wb = u; FT.wc = w; } else { FT.a = k + W + 1; FT.b = k + W; FT.c = k + 1; FT.wb = 1 - u; FT.wc = 1 - w; }
      FT.wa = 1 - FT.wb - FT.wc;
    }
    function farY(x, z) {
      if (x < FX[0] || x > FX[FX.length - 1] || z < FZ[0] || z > FZ[FZ.length - 1]) return natY(x, z);
      farTri(x, z);
      return FH[FT.a] * FT.wa + FH[FT.b] * FT.wb + FH[FT.c] * FT.wc;
    }
    // W6++ (шов сеток): край ближней сетки ложится на дальнюю (+4 см — ближняя рисуется поверх), к краю ближняя плавно
    // уходит на неё за FADE_M. Раньше край стоял над дальней ступенью до 8 м (на низком качестве — до 12 м): сетка в осях
    // склона, клетки берутся по расстоянию до дороги, и край шёл зубцами — юбка закрывала дыру, но зубчатая стенка
    // читалась как ошибка. NBD — расстояние узла до края ближней сетки в клетках (255 — дальше полосы)
    const FADE_M = 6, FADE_N = Math.ceil(FADE_M / g), NBD = new Uint8Array(NA * NB).fill(255);
    const fadeW = k => (NBD[k] > FADE_N ? 0 : sm(FADE_M, 0, NBD[k] * g));
    {
      const actC = (a, b) => a >= 0 && b >= 0 && a < NA - 1 && b < NB - 1 && NG.act[a + b * (NA - 1)];
      const qq = [];
      for (let b = 0; b < NB; b++) for (let a = 0; a < NA; a++) {
        const k = a + b * NA; if (NG.h[k] !== NG.h[k]) continue;
        if (!actC(a - 1, b - 1) || !actC(a, b - 1) || !actC(a - 1, b) || !actC(a, b)) { NBD[k] = 0; qq.push(k); }
      }
      for (let n = 0; n < qq.length; n++) {
        const k = qq[n], d = NBD[k] + 1; if (d > FADE_N) continue;
        const a = k % NA, b = (k - a) / NA;
        for (let t = 0; t < 4; t++) {
          const aa = a + (t === 0 ? 1 : t === 1 ? -1 : 0), bb = b + (t === 2 ? 1 : t === 3 ? -1 : 0);
          if (aa < 0 || bb < 0 || aa >= NA || bb >= NB) continue;
          const kk = aa + bb * NA; if (NG.h[kk] !== NG.h[kk] || NBD[kk] <= d) continue;
          NBD[kk] = d; qq.push(kk);
        }
      }
      for (let k = 0; k < NA * NB; k++) {
        const w = fadeW(k); if (!w) continue;
        const a = k % NA, b = (k - a) / NA, xz = RV2XZ(NG.r0 + a * g, NG.v0 + b * g);
        NG.h[k] += (farY(xz[0], xz[1]) + 0.04 - NG.h[k]) * w;
      }
    }
    // высота полотна отрезка i в точке (x, z), если точка на нём (кромка + 0,3 м — ещё полотно: колесо на краю
    // не «проваливается»), иначе NaN
    function onSegY(i, t, d2, x, z) {
      if (i < 0) return NaN;
      const dx = R.x[i + 1] - R.x[i], dz = R.z[i + 1] - R.z[i], L = Math.hypot(dx, dz) || 1, e = ((x - R.x[i] - dx * t) * dz - (z - R.z[i] - dz * t) * dx) / L;
      const W = (e > 0 ? SWL[i] + (SWL[i + 1] - SWL[i]) * t : SWR[i] + (SWR[i + 1] - SWR[i]) * t) + 0.3;
      return d2 <= W * W ? R.y[i] + (R.y[i + 1] - R.y[i]) * t : NaN;
    }
    // земля: на дороге — полотно, рядом — ближняя решётка, дальше — дальняя
    function ground(x, z) {
      const l = hq(x, z);
      if (l) {
        // W5B: ближайший отрезок, НА ПОЛОТНЕ которого точка (раньше — просто ближайший: в кармане у шпильки ближе оказывалась
        // соседняя нога серпантина, и лавочка «висела» на 3 м над землёй, а героиня в кармане падала).
        // W6++: шпилек нет — проверяется ближайший отрезок дороги (W8: ветки нет). Раньше годился любой отрезок в 12 м, у которого e (у конца отрезка — лишь проекция на нормаль)
        // меньше ширины: точка за краем на внешней стороне поворота, у сужения кармана или в 9 м вдоль дороги считалась
        // полотном — трава и камни там висели на высоте дороги
        let im = -1, dm = 144, tm = 0;
        for (const i of l) { segP(i, x, z); if (SP.d2 < dm) { dm = SP.d2; im = i; tm = SP.t; } }
        const ym = onSegY(im, tm, dm, x, z);
        if (ym === ym) return ym;
        // W6: скальная стенка справа — земля = её поверхность (камера-следилка и камушки не проходят сквозь скалу).
        // W6++: та же поверхность, что у меша стенки, по БЛИЖАЙШЕМУ отрезку дороги (раньше — максимум по всем отрезкам
        // в 12 м до их прямых: на внутренней стороне поворотов стенка выходила выше на 5–10 м — висели камни и трава)
        const cy = cliffY(x, z);
        if (cy !== null) { const yn = nearY(x, z); return Math.max(cy, yn !== null ? yn : farY(x, z)); }
      }
      const yn = nearY(x, z); if (yn !== null) return yn;
      return farY(x, z);
    }

    /* --- цвет земли: трава, выемки скал полосами, гравий у дороги, лес вдали; зима — снег --- */
    const cc = {}; Object.keys(PAL).forEach(k => { if (typeof PAL[k] === 'string' && PAL[k][0] === '#') cc[k] = C(PAL[k]); });
    const cTmp = new T.Color(), cTmp2 = new T.Color();
    const cGravel = C('#B3A893'), cVerge = C('#BDB097'), cValley = C('#9A9858'), cTerr = C('#B5A88E'), cSnowV = C('#E6EBF0');
    const cFW = [C('#C9D2DC'), C('#B9C4CF'), C('#D5DCE4')];
    function groundColor(out, x, y, z, ny, verge, far) {
      const n1 = vnoise(x * 0.045, z * 0.045), n2 = vnoise(x * 0.17 + 7, z * 0.17 - 3);
      const rock = sm(0.64, 0.56, ny);
      if (WIN) {
        out.copy(cc.snowGround).lerp(cc.snowShade, 0.18 + 0.25 * n2 * (1 - ny));
        if (far) { const rv = XZ2RV(x, z), forest = sm(0.52, 0.66, vnoise(x * 0.012, z * 0.012)) * sm(470, 520, rv[0]); if (forest > 0) out.lerp(cFW[Math.floor(n2 * 3) % 3], forest * 0.9); }
        if (rock > 0) { if (far) cTmp.copy(cc.rock).lerp(cc.rock2, sm(0.3, 0.7, vnoise(x * 0.013 + 5, z * 0.013 - 2))); else cTmp.copy(((y / 3.2 + n2 * 0.35) % 1 + 1) % 1 < 0.5 ? cc.rock : cc.rock2); out.lerp(cTmp, rock * 0.85); }
        if (verge === 1) out.lerp(cSnowV, 0.6);
        return out;
      }
      // трава пятнами (как toon в городе): два тона с мягким порогом, светлые выкосы, в долине зеленее
      out.copy(cc.grass).lerp(cc.grass2, sm(0.4, 0.6, n1)).lerp(cc.meadow, 0.2);
      out.lerp(cc.mown, sm(0.6, 0.7, n2) * 0.5);
      if (y < -100) out.lerp(cValley, sm(-100, -130, y) * 0.5);
      if (far) {
        const rr = Math.hypot(x, z - CZ);
        if (rr < 100 && z < CZ - 2) out.lerp(cTerr, sm(100, 92, rr) * 0.6);
        const rv = XZ2RV(x, z), rho = Math.hypot(x - TX, z - TZ), f = vnoise(x * 0.011 + 3, z * 0.011 - 5), f2 = vnoise(x * 0.04 - 9, z * 0.04 + 2);
        // лес и кустарник пятнами: склоны под селом, плечи, дальние склоны за серпантином
        const zone = Math.max(sm(500, 560, rv[0]) * sm(0, 40, 900 - Math.abs(rv[1])), sm(110, 170, rho) * sm(330, 290, rho), sm(330, 420, rho) * (1 - sm(-0.1, 0.4, Math.cos((Math.atan2(x - TX, z - TZ) - SB)))));
        const forest = Math.max(sm(0.47, 0.57, f), sm(0.66, 0.72, f2) * 0.7) * zone;
        // склон под селом (виден со смотровой как p3): зеленее, с тёмными купами кустов и садов
        const under = sm(330, 280, rho) * (z < CZ + 260 ? 1 : 0);
        if (under > 0) { out.lerp(cTmp.set('#7E9450'), 0.45 * under); if (f2 > 0.55) out.lerp(cTmp.set('#5A7046'), sm(0.55, 0.7, f2) * 0.6 * under); }
        if (forest > 0) { cTmp.copy(cc.forestA).lerp(cc.forestB, sm(0.3, 0.7, f2)).lerp(cc.forestC, sm(0.62, 0.8, f2) * 0.7); out.lerp(cTmp, forest * 0.7); }
      }
      if (rock > 0) {
        // W6+: склон над стенкой стал крутым — пласты по высоте шагом 1,15 м на клетках 9–16 м (дальняя сетка) и 1,5–2,4 м
        // (ближняя) рвались в косые полосы-«лучи». Вдали — ровный камень пятнами, вблизи — пласты шагом 3,2 м
        if (far) cTmp.copy(cc.rock).lerp(cc.rock2, sm(0.3, 0.7, vnoise(x * 0.013 + 5, z * 0.013 - 2)));
        else { const band = ((y / 3.2 + n2 * 0.35) % 1 + 1) % 1; cTmp.copy(band < 0.55 ? cc.rock : cc.rock2); }
        if (n1 > 0.74) cTmp.lerp(cc.lichen, 0.35);
        out.lerp(cTmp, rock);
      }
      if (verge === 1) out.lerp(cVerge, 0.75); else if (verge === 2) out.lerp(cGravel, 0.18);
      return out;
    }

    const meshes = {};
    /* ---------- дальний рельеф (до ближнего: полоса у края ближней сетки берёт его цвет и нормали) ---------- */
    let FCOL = null, FNRM = null;
    {
      const W = FX.length, H = FZ.length, P = new Float32Array(W * H * 3), I = [];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = i + j * W; P[k * 3] = FX[i]; P[k * 3 + 1] = FH[k]; P[k * 3 + 2] = FZ[j]; }
      for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const k = i + j * W; I.push(k, k + W, k + 1, k + 1, k + W, k + W + 1); }
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.BufferAttribute(P, 3));
      geo.setIndex(W * H > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, col = new Float32Array(W * H * 3);
      for (let k = 0; k < W * H; k++) { groundColor(cTmp2, P[k * 3], P[k * 3 + 1], P[k * 3 + 2], nrm.getY(k), 0, true); col[k * 3] = cTmp2.r; col[k * 3 + 1] = cTmp2.g; col[k * 3 + 2] = cTmp2.b; }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      FCOL = col; FNRM = nrm.array;
      const mat = cheap({ polygonOffset: true, pof: 1, pou: 2, toon: HI });
      const m = chunked(geo, mat, { cell: 240, bigCell: 1200, bigEdge: 40, renderOrder: 10, name: 'terrainFar', receive: false }); root.add(m); meshes.far = m;
    }

    /* ---------- геометрия: ближняя решётка ---------- */
    {
      const map = new Int32Array(NA * NB).fill(-1), P = [], Cc = [], I = [];
      let nv = 0;
      const vid = (a, b) => { const k = a + b * NA; if (map[k] < 0) { const xz = RV2XZ(NG.r0 + a * g, NG.v0 + b * g); P.push(xz[0], NG.h[k], xz[1]); map[k] = nv++; } return map[k]; };
      // порядок обхода: проверим ориентацию (нормаль вверх) по первой клетке
      let flip = false;
      { const p0 = RV2XZ(0, 0), p1 = RV2XZ(1, 0), p2 = RV2XZ(0, 1); const ax = p1[0] - p0[0], az = p1[1] - p0[1], bx = p2[0] - p0[0], bz = p2[1] - p0[1]; const ny = az * bx - ax * bz; flip = ny < 0; }
      const skirtQ = [];
      for (let b = 0; b < NB - 1; b++) for (let a = 0; a < NA - 1; a++) {
        if (!NG.act[a + b * (NA - 1)]) continue;
        const v00 = vid(a, b), v10 = vid(a + 1, b), v01 = vid(a, b + 1), v11 = vid(a + 1, b + 1);
        // (00, 10, 01) и (10, 11, 01): та же диагональ, что в nearY
        if (!flip) I.push(v00, v10, v01, v10, v11, v01); else I.push(v00, v01, v10, v10, v01, v11);
        const actAt = (aa, bb) => aa >= 0 && bb >= 0 && aa < NA - 1 && bb < NB - 1 && NG.act[aa + bb * (NA - 1)];
        if (!actAt(a, b - 1)) skirtQ.push([a, b, a + 1, b]);
        if (!actAt(a, b + 1)) skirtQ.push([a, b + 1, a + 1, b + 1]);
        if (!actAt(a - 1, b)) skirtQ.push([a, b, a, b + 1]);
        if (!actAt(a + 1, b)) skirtQ.push([a + 1, b, a + 1, b + 1]);
      }
      // юбка вниз по краю (обе стороны). W6++: край ближней сетки теперь лежит на дальней (полоса FADE_M выше) — юбке
      // остаётся закрыть лишь щёлки вдоль края между узлами (было 12 м: край стоял над дальней на 7–11 м)
      const nTop = nv, skSrc = [], SKIRT = 2.5;
      skirtQ.forEach(([a0, b0, a1, b1]) => {
        const k0 = a0 + b0 * NA, k1 = a1 + b1 * NA, p0 = RV2XZ(NG.r0 + a0 * g, NG.v0 + b0 * g), p1 = RV2XZ(NG.r0 + a1 * g, NG.v0 + b1 * g);
        const i0 = nv; P.push(p0[0], NG.h[k0], p0[1], p1[0], NG.h[k1], p1[1], p0[0], NG.h[k0] - SKIRT, p0[1], p1[0], NG.h[k1] - SKIRT, p1[1]); nv += 4;
        skSrc.push(map[k0], map[k1], map[k0], map[k1]);
        I.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2, i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      });
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      geo.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, col = new Float32Array(nv * 3);
      // обратная карта вершина → узел (для цвета у дороги)
      const vk = new Int32Array(nTop); for (let k = 0; k < map.length; k++) if (map[k] >= 0) vk[map[k]] = k;
      for (let i = 0; i < nTop; i++) {
        groundColor(cTmp2, P[i * 3], P[i * 3 + 1], P[i * 3 + 2], nrm.getY(i), NG.verge[vk[i]], false);
        col[i * 3] = cTmp2.r; col[i * 3 + 1] = cTmp2.g; col[i * 3 + 2] = cTmp2.b;
      }
      // W6++: полоса у края — к цвету и нормали дальней сетки под ней: тон и свет у шва одинаковы, зубцы клеток не читаются
      for (let i = 0; i < nTop; i++) {
        const w = fadeW(vk[i]), x = P[i * 3], z = P[i * 3 + 2];
        if (!w || x <= FX[0] || x >= FX[FX.length - 1] || z <= FZ[0] || z >= FZ[FZ.length - 1]) continue;
        farTri(x, z);
        const A = FT.a * 3, B = FT.b * 3, Cv = FT.c * 3, wa = FT.wa * w, wb = FT.wb * w, wc = FT.wc * w, w1 = 1 - w;
        for (let c = 0; c < 3; c++) col[i * 3 + c] = col[i * 3 + c] * w1 + FCOL[A + c] * wa + FCOL[B + c] * wb + FCOL[Cv + c] * wc;
        _bv.set(nrm.getX(i) * w1 + FNRM[A] * wa + FNRM[B] * wb + FNRM[Cv] * wc, nrm.getY(i) * w1 + FNRM[A + 1] * wa + FNRM[B + 1] * wb + FNRM[Cv + 1] * wc, nrm.getZ(i) * w1 + FNRM[A + 2] * wa + FNRM[B + 2] * wb + FNRM[Cv + 2] * wc).normalize();
        nrm.setXYZ(i, _bv.x, _bv.y, _bv.z);
      }
      // W6++: юбка — нормаль и цвет своего узла сверху (склон): у двусторонних граней нормаль иначе нулевая, а ровная
      // «как у земли» светила юбку ярче склона — у края ближней сетки читались светлые зубцы
      for (let i = nTop; i < nv; i++) {
        const q = skSrc[i - nTop];
        nrm.setXYZ(i, nrm.getX(q), nrm.getY(q), nrm.getZ(q));
        col[i * 3] = col[q * 3]; col[i * 3 + 1] = col[q * 3 + 1]; col[i * 3 + 2] = col[q * 3 + 2];
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      // W6: дорога длиннее и петляет — куски крупнее (меньше вызовов).
      // W6+ (исправлено): «root.add(m); meshes.near = m;» стояли внутри этого комментария, и ближний рельеф у дороги
      // (24 м по обе стороны) не рисовался вовсе: виден был только грубый дальний, опущенный у полотна на 3 м, — отсюда
      // щель между дорогой и склоном, «пустота» за кромкой и деревья, висящие в воздухе (их ставили на ближний рельеф)
      const m = chunked(geo, vcMat, { cell: 96, renderOrder: -4, name: 'terrainNear' });
      root.add(m); meshes.near = m;
    }
    /* ---------- текстуры: бут, облака, пух, указатели ---------- */
    const SIGN_H = 768;   // W6: атлас щитов выше (место для «Осторожно, камушки»)
    const cnv = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; };
    const rubbleTex = (() => {
      const [cv, c] = cnv(256, 256), r = rng(77);
      c.fillStyle = '#CFC4AE'; c.fillRect(0, 0, 256, 256);
      const tones = ['#B3A58E', '#9C8F7C', '#8E8272', '#C2B399', '#A89A84', '#B8A684'];
      let y = 0;
      while (y < 256) {
        const rh = Math.min(256 - y, 22 + Math.floor(r() * 16)); let x = -Math.floor(r() * 40);
        while (x < 256) {
          const w = 34 + Math.floor(r() * 56), t = tones[Math.floor(r() * tones.length)];
          for (const ox of [0, 256, -256]) {
            const X = x + ox + 2, Y = y + 2, Wd = w - 4, Hh = rh - 4;
            if (X > 256 || X + Wd < 0) continue;
            c.fillStyle = t; c.beginPath(); c.moveTo(X + 6, Y); c.lineTo(X + Wd - 6, Y); c.quadraticCurveTo(X + Wd, Y, X + Wd, Y + 6); c.lineTo(X + Wd, Y + Hh - 6); c.quadraticCurveTo(X + Wd, Y + Hh, X + Wd - 6, Y + Hh); c.lineTo(X + 6, Y + Hh); c.quadraticCurveTo(X, Y + Hh, X, Y + Hh - 6); c.lineTo(X, Y + 6); c.quadraticCurveTo(X, Y, X + 6, Y); c.fill();
            c.fillStyle = 'rgba(213,202,179,.8)'; c.fillRect(X + 5, Y, Wd - 10, 2);
            c.fillStyle = 'rgba(110,98,83,.55)'; c.fillRect(X + 5, Y + Hh - 2, Wd - 10, 2);
          }
          x += w;
        }
        y += rh;
      }
      c.fillStyle = '#DCD4C3'; c.fillRect(0, 0, 8, 8);   // ровное пятно цвета шва: зимой крышки парапета — снег (цвет вершин > 1)
      const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
    })();
    const SNOW_UV = [4 / 256, 1 - 4 / 256];
    const cloudTex = (() => {
      const N2 = 256, [cv, c] = cnv(N2, N2), img = c.createImageData(N2, N2), d = img.data;
      const per = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
        const h = (a, b) => hash2(((a % p) + p) % p + 911, ((b % p) + p) % p + 37); const a = h(xi, yi), b = h(xi + 1, yi), c2 = h(xi, yi + 1), e = h(xi + 1, yi + 1); return a + (b - a) * u + (c2 - a) * w + (a - b - c2 + e) * u * w; };
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        let s = 0, a = 0.5, n = 0; for (let o = 0, p = 4; o < 5; o++, p *= 2) { s += a * per(x / N2 * p, y / N2 * p, p); n += a; a *= 0.5; }
        s /= n; const al = sm(0.36, 0.5, s), sh = sm(0.5, 0.66, s);
        const k = (y * N2 + x) * 4; d[k] = 214 + 34 * sh; d[k + 1] = 222 + 29 * sh; d[k + 2] = 234 + 18 * sh; d[k + 3] = 255 * al;
      }
      c.putImageData(img, 0, 0);
      const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    })();
    const puffTex = (() => {
      const [cv, c] = cnv(128, 128), r = rng(5);
      for (let i = 0; i < 9; i++) { const x = 34 + r() * 60, y = 40 + r() * 46, rad = 20 + r() * 26, gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }
      const t = keep(new T.CanvasTexture(cv)); return t;
    })();
    const dotTex = (() => { const [cv, c] = cnv(32, 32), gr = c.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return keep(new T.CanvasTexture(cv)); })();
    // указатели: синие щиты с белыми буквами, белая табличка «Город ↓», деревянная «Смотровая»
    const SIGN = (() => {
      const [cv, c] = cnv(1024, SIGN_H);
      c.fillStyle = '#FFFFFF'; c.fillRect(1000, 0, 24, 24);
      const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
      const txt = (s, x, y, size, col, max) => { c.font = `900 ${size}px Nunito, system-ui, sans-serif`; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; const m = c.measureText(s).width; if (m > max) { c.save(); c.translate(x, y); c.scale(max / m, 1); c.fillText(s, 0, 0); c.restore(); } else c.fillText(s, x, y); return Math.min(m, max); };
      const arrow = (x, y, s, col, down) => { c.save(); c.translate(x, y); if (down) c.rotate(PI); c.fillStyle = col; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.8, -s * 0.15); c.lineTo(s * 0.3, -s * 0.15); c.lineTo(s * 0.3, s); c.lineTo(-s * 0.3, s); c.lineTo(-s * 0.3, -s * 0.15); c.lineTo(-s * 0.8, -s * 0.15); c.closePath(); c.fill(); c.restore(); };
      // A: начало (синий) 600×220
      c.fillStyle = '#3F78B8'; rr(4, 4, 592, 212, 26); c.fill(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 8; rr(16, 16, 568, 188, 18); c.stroke();
      txt(TXT.up, 252, 112, named ? 104 : 74, '#FFFFFF', 400); arrow(510, 110, 54, '#FFFFFF', false);
      // B: «Город ↓» (белая) 400×140 в (600, 0)
      c.fillStyle = '#FFFDF9'; rr(604, 4, 392, 132, 20); c.fill(); c.strokeStyle = '#3A2E3F'; c.lineWidth = 6; rr(614, 14, 372, 112, 14); c.stroke();
      txt('Город', 760, 72, 70, '#3A2E3F', 250); arrow(925, 70, 36, '#3A2E3F', true);
      // C: въезд (синий) 700×200 в (0, 240)
      c.fillStyle = '#3F78B8'; rr(4, 244, 692, 192, 24); c.fill(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 8; rr(16, 256, 668, 168, 16); c.stroke();
      txt(TXT.arrive, 350, 342, named ? 110 : 64, '#FFFFFF', 620);
      // D: «Смотровая» (дерево) 280×100 в (720, 240)
      c.fillStyle = '#8A6A4E'; rr(724, 244, 272, 92, 16); c.fill(); c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 4; i++) c.fillRect(730, 262 + i * 18, 260, 3);
      txt('Смотровая', 860, 292, 50, '#FFF3DC', 240);
      // K (W6): «Осторожно, камушки» — жёлтый треугольник со скругленными углами, на нём три кругленьких камушка с глазками
      // катятся со скалы (мило, не страшно), под ним белая табличка с надписью; 380×300 в (0, 466)
      {
        const ox = 0, oy = 466, cx = ox + 190, top = oy + 8, base = oy + 196;
        c.fillStyle = '#FFFDF9'; rr(ox + 2, oy + 2, 376, 296, 26); c.fill(); c.strokeStyle = '#D9CFC2'; c.lineWidth = 4; rr(ox + 6, oy + 6, 368, 288, 22); c.stroke();   // светлая подложка щита
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(cx, top - 4); c.lineTo(ox + 352, base + 10); c.lineTo(ox + 28, base + 10); c.closePath(); c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fill();
        c.fillStyle = '#F6C445'; c.beginPath(); c.moveTo(cx, top + 14); c.lineTo(ox + 334, base); c.lineTo(ox + 46, base); c.closePath(); c.lineWidth = 14; c.strokeStyle = '#E4A92E'; c.stroke(); c.fill();
        c.fillStyle = '#5A4A3E'; c.beginPath(); c.moveTo(cx - 70, base - 14); c.lineTo(cx - 70, top + 92); c.lineTo(cx - 30, top + 70); c.lineTo(cx - 34, base - 14); c.closePath(); c.fill();   // скала слева
        [[cx - 8, top + 104, 15], [cx + 30, top + 132, 19], [cx + 72, base - 26, 22]].forEach(([x, y, r], k) => {
          c.fillStyle = ['#9C8E80', '#B3A596', '#8E8072'][k]; c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x - r * 0.32, y - r * 0.12, r * 0.24, 0, PI * 2); c.arc(x + r * 0.28, y - r * 0.12, r * 0.24, 0, PI * 2); c.fill();
          c.fillStyle = '#3A2E3F'; c.beginPath(); c.arc(x - r * 0.28, y - r * 0.08, r * 0.12, 0, PI * 2); c.arc(x + r * 0.32, y - r * 0.08, r * 0.12, 0, PI * 2); c.fill();
          c.strokeStyle = 'rgba(58,46,63,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(x - r * 1.5, y - r * 0.9, r * 0.5, PI * 0.2, PI * 0.8); c.stroke();   // «тук» — дуга движения
        });
        c.fillStyle = '#FFFDF9'; rr(ox + 18, oy + 214, 344, 80, 16); c.fill(); c.strokeStyle = '#3A2E3F'; c.lineWidth = 5; rr(ox + 26, oy + 222, 328, 64, 11); c.stroke();
        txt('Осторожно, камушки', cx, oy + 255, 40, '#3A2E3F', 300);
      }
      const t = keep(new T.CanvasTexture(cv)); t.anisotropy = 4;
      return { tex: t, uv: { A: [0, 0, 600, 220], B: [600, 0, 400, 140], C: [0, 240, 700, 200], D: [720, 240, 280, 100], K: [0, 466, 380, 300], W: [1004, 4, 16, 16] } };
    })();

    /* ---------- накопитель треугольников (позиция, нормаль, цвет, uv) ---------- */
    function Bk() { this.P = []; this.N = []; this.C = []; this.U = []; this.I = []; this.n = 0; }
    Bk.prototype.v = function (x, y, z, nx, ny, nz, c, u, w) { this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(c.r, c.g, c.b); this.U.push(u || 0, w || 0); return this.n++; };
    Bk.prototype.geo = function (src, mtx, col, uvf) {   // добавить геометрию three (индексную) с матрицей
      const g2 = src.clone(); g2.applyMatrix4(mtx);
      const p = g2.attributes.position, nn = g2.attributes.normal, uv = g2.attributes.uv, i0 = this.n;
      for (let i = 0; i < p.count; i++) { const u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0; const t = uvf ? uvf(u, w, i, p) : [u, w]; this.v(p.getX(i), p.getY(i), p.getZ(i), nn.getX(i), nn.getY(i), nn.getZ(i), typeof col === 'function' ? col(i, p, nn) : col, t[0], t[1]); }
      if (g2.index) { const a = g2.index.array; for (let i = 0; i < a.length; i++) this.I.push(a[i] + i0); } else for (let i = 0; i < p.count; i++) this.I.push(i0 + i);
      g2.dispose();
    };
    Bk.prototype.mesh = function (mat, withUV) {
      if (!this.n) return null;
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(this.P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
      if (withUV) geo.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2));
      geo.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.I, 1) : new T.Uint16BufferAttribute(this.I, 1));
      geo.computeBoundingSphere();
      return new T.Mesh(geo, mat);
    };
    const M4 = new T.Matrix4(), Q4 = new T.Quaternion(), E4 = new T.Euler(), P4 = new T.Vector3(), S4 = new T.Vector3();
    const mtx = (x, y, z, ry, sx, sy, sz, rx, rz) => { E4.set(rx || 0, ry || 0, rz || 0, 'YXZ'); Q4.setFromEuler(E4); P4.set(x, y, z); S4.set(sx, sy, sz); return M4.compose(P4, Q4, S4).clone(); };
    const GB = keep(new T.BoxGeometry(1, 1, 1)), GCy = keep(new T.CylinderGeometry(1, 1, 1, 8)), GCy6 = keep(new T.CylinderGeometry(1, 1, 1, 6));
    // uv коробки по реальным размерам (плитка бута 1,6 м)
    const boxUV = (w, h, d, tile) => (u, v, i) => { const f = Math.floor(i / 4); const fw = f < 2 ? d : w, fh = f === 2 || f === 3 ? d : h; return [u * fw / tile, v * fh / tile]; };

    /* ---------- 4B / W6: террасы ниже дороги (spec2 §6, фото p11): широкие зелёные ступени по горизонталям на склонах
       долины под обрывом, мягкие травяные откосы (редко — сухая кладка); полосы обходят дорогу (≥ 11 м от оси)
       и не лезут на крутой обрыв у края полотна; общий построитель VILLAGE.vkit.terraces ---------- */
    let terrStats = { bands: 0 };
    if (VK.terraces) {
      const TB2 = new Bk(), cT = new T.Color();
      const adapt = { kind: 'vc', quadF(a, b, c, d, col, sIdx, dir) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const dz = dir.length > 2 ? dir[2] : dir[1], dy = dir.length > 2 ? dir[1] : 0, pts = nx * dir[0] + ny * dy + nz * dz < 0 ? [d, c, b, a] : [a, b, c, d], sg = pts[0] === d ? -1 : 1;
        const i0 = TB2.n; pts.forEach((p, i) => { const cc = typeof col === 'function' ? col(p, i) : col; cT.setRGB(cc[0], cc[1], cc[2]); TB2.v(p[0], p[1], p[2], nx * sg, ny * sg, nz * sg, cT); });
        TB2.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      } };
      const surfT = (x, z) => { const yn = nearY(x, z); return yn !== null ? yn : farY(x, z); };
      const rAt = b => { const f = clamp((b - RTB.b0) / RTB.db, 0, RTB.n - 1); return RTB.r[Math.round(f)]; };
      const okT = (x, z) => {
        const rho = Math.hypot(x - TX, z - TZ), b = Math.atan2(x - TX, z - TZ) / D2R; if (rho < 304) return false;
        if (rho > rAt(b) - W0 - 45) return false;   // только ниже обрыва (слева по ходу вверх); W6+: не ближе ≈ 45 м к дороге
        const l = hq(x, z); if (l) for (const i of l) { segP(i, x, z); if (SP.d2 < 576) return false; }
        // W6+ (скрин автора: зелёные «плавники» у дороги): с камеры на дороге ступени на крутом и у самого дна долины
        // (где склон почти ровный и полка торчит над ним) читались торчащими клиньями. Только склоны средней крутизны,
        // выше дна долины
        const e = 2.5, y0 = surfT(x, z); if (y0 < -137) return false;
        const gx = (surfT(x + e, z) - surfT(x - e, z)) / (2 * e), gz = (surfT(x, z + e) - surfT(x, z - e)) / (2 * e), g2 = gx * gx + gz * gz;
        return g2 >= 0.0144 && g2 <= 0.42;
      };
      // W6+: поле — по настоящим горизонталям рельефа (как напротив села в kubachi.js), а не полосами поперёк радиуса:
      // у дороги горизонтали петляют за лощинами и отрогами, и радиальные полосы ломались в клинья
      const fields = [{ contour: { x0: TX - 575, z0: TZ - 15, x1: TX + 415, z1: TZ + 575, cell: HI ? 4 : 5, blur: 6, smooth: 5 }, far: !HI, lift: 0.2 }];
      terrStats = VK.terraces({ cx: TX, cz: TZ, fields, surf: surfT, ok: okT, tread: adapt, wall: adapt, winter: WIN, seed: 5151,
        segL: HI ? 5 : 7, step: 2.4, pathEvery: 0,
        // W6+: тон ближе к траве долины (были кислотно-салатовые полосы на оливковом склоне — «чужие» пластины)
        palette: [['#97B25A', '#84A04E'], ['#8AAA54', '#789748'], ['#A0B862', '#8EA656'], ['#82A250', '#718F45'], ['#A6BC68', '#93AA5A'], ['#90AC56', '#7E9A4A']] });
      if (TB2.n) { const m = TB2.mesh(vcMat); const mc = chunked(m.geometry, vcMat, { cell: 160, renderOrder: -3, name: 'terraces' }); root.add(mc); meshes.terraces = mc; }
    }

    /* ---------- полотно дороги (волна 4: «старая» горная дорога — без ограждений, заплатки асфальта, щебень, грунт,
       колеи, ямы, лужи, грязь и камни; всё в одной сетке с цветом вершин — те же вызовы, что у прежнего полотна) ---------- */
    const SC = WIN ? {
      asph: C('#C9CDD1'), patch: C('#BBC0C5'), gravel: C('#E2E7EC'), gravel2: C('#D3D9DF'), earth: C('#E6EBF0'), earth2: C('#D8DEE4'), rut: C('#A9A399'), rutA: C('#AEB3B8'), grass: C('#E9EEF2'),
      wet: C('#A9A49A'), shoulder: C('#EEF2F6'), pocket: C('#E9EEF2'), skirt: C('#DCE3EA'), damp: C('#C7CCD1'),
      mudRim: C('#B9B3A8'), mud: C('#9C968C'), mudC: C('#8A847B'), water: C('#C9DAE6'), waterC: C('#E2EDF4'), hole: C('#9EA4AA'), holeC: C('#868C92'), holeRim: C('#E2E7EB'),
      stones: [C('#B8B2A8'), C('#C9C3B8'), C('#A49E94')], rocks: [C('#9C968C'), C('#ADA79D'), C('#8E887E')], snow: C('#F4F7FA'),
    } : {   // 4B: богаче и контрастнее — укатанная земля теплее и темнее, щебень серее, колеи и сырые пятна тёмные
      asph: C('#A39E96'), patch: C('#8E8A84'), gravel: C('#BCB19C'), gravel2: C('#A69A84'), earth: C('#AE9373'), earth2: C('#9C8262'), rut: C('#7C6A52'), rutA: C('#8C877F'), grass: C('#9EA66A'),
      wet: C('#7A6650'), shoulder: C('#A99C82'), pocket: C('#B5A88E'), skirt: C('#94896F'), damp: C('#8E7A60'),
      mudRim: C('#8E7A5E'), mud: C('#6E5C46'), mudC: C('#5E4E3C'), water: C('#4E6272'), waterC: C('#62788A'), hole: C('#5E5040'), holeC: C('#463C30'), holeRim: C('#BFB096'),
      stones: [C('#A79C8A'), C('#B9AF9F'), C('#928878'), C('#C4BBAA'), C('#8A8070')], rocks: [C('#9A9186'), C('#AFA69A'), C('#857C70'), C('#BDB4A6')], snow: null,
    };
    const RUT_E = 0.75, RUT_W = 0.17;
    const rutK = e => sm(RUT_W + 0.08, RUT_W - 0.05, Math.abs(Math.abs(e) - RUT_E));
    // высота полотна над осевой (в метрах): лёгкая «горбинка» и колеи на щебне и грунте (только вид — физика берёт ровное полотно)
    const roadDy = (i, e) => 0.035 - 0.01 * Math.min(Math.abs(e), 2.5) - (SURF[i] ? 0.016 * rutK(e) : 0);
    const cS = new T.Color(), cS2 = new T.Color();
    function surfColor(out, i, e) {
      const s = i * DS, k = SURF[i], wa = SWA[i];
      const n = vnoise(s * 0.31, e * 0.75 + 3.3), n2 = vnoise(s * 1.3 + 11, e * 2.1 - 5);
      if (k === 0) { out.copy(SC.asph).lerp(SC.patch, sm(0.55, 0.75, n) * 0.85); if (n < 0.22 || Math.abs(e) > wa - 0.3 + 0.25 * n2) out.lerp(SC.gravel2, 0.75); }
      else if (k === 1) { out.copy(SC.gravel).lerp(SC.gravel2, sm(0.35, 0.75, n2)); if (n > 0.76) out.lerp(SC.asph, 0.75); }
      else { out.copy(SC.earth).lerp(SC.earth2, sm(0.3, 0.8, n2)); if (Math.abs(e) < 0.24) out.lerp(SC.grass, 0.35 * sm(0.3, 0.7, n)); if (n > 0.8) out.lerp(SC.gravel, 0.5); }
      const rk = rutK(e) * (k === 0 ? 0.25 : 0.7);
      if (rk > 0) out.lerp(k === 0 ? SC.rutA : SC.rut, rk);
      const w = WET[i] * (0.35 + 0.65 * rutK(e)) * sm(0.3, 0.65, n2 * 0.6 + 0.4 * n);
      if (w > 0) out.lerp(SC.wet, w * 0.65);
      // 4B: крупные пятна — сырая тёмная земля и светлые высохшие проплешины; у края — мелкий щебень светлее
      const n3 = vnoise(s * 0.09 + 40, e * 0.35 + 8.1);
      if (k) { out.lerp(SC.damp, sm(0.62, 0.8, n3) * 0.45); out.multiplyScalar(1.0 + 0.08 * sm(0.3, 0.12, n3)); }
      if (Math.abs(e) > wa - 0.45) out.lerp(SC.gravel, 0.25 * sm(wa - 0.45, wa - 0.1, Math.abs(e)));
      return out;
    }
    const roadBk = new Bk(), wetBk = new Bk(), UVK = 1 / 1.7;   // 4B: uv по миру — мелкий щебень и трещины текстурой; лужи — своя сетка с отражением неба
    {
      const bk = roadBk;
      const IN_E = [1.55, 1.05, RUT_E + RUT_W, RUT_E, RUT_E - RUT_W, 0.24, 0, -0.24, -(RUT_E - RUT_W), -RUT_E, -(RUT_E + RUT_W), -1.05, -1.55];
      {
        const rows = [];
        for (let i = 0; i < N; i++) {
          const wl = SWL[i], wr = SWR[i], wa = SWA[i], y = R.y[i], lx = R.lx[i], lz = R.lz[i], x0 = R.x[i], z0 = R.z[i];
          const shL = wl - wa > 1.2 ? SC.pocket : SC.shoulder, shR = wr - wa > 1.2 ? SC.pocket : SC.shoulder;
          const edgeL = surfColor(cS, i, wa).clone(), edgeR = surfColor(cS, i, -wa).clone();
          const shLc = cS2.copy(shL).lerp(edgeL, 0.25).clone(), shRc = cS2.copy(shR).lerp(edgeR, 0.25).clone();
          const cols = [[wl, -0.5, SC.skirt], [wl, 0, shL], [wa, 0.005, shLc], [wa, 0.005, edgeL]];
          IN_E.forEach(e => { if (Math.abs(e) < wa - 0.05) cols.push([e, roadDy(i, e), surfColor(cS, i, e).clone()]); else cols.push([Math.sign(e) * (wa - 0.05), 0.006, (e > 0 ? edgeL : edgeR)]); });
          cols.push([-wa, 0.005, edgeR], [-wa, 0.005, shRc], [-wr, 0, shR], [-wr, -0.5, SC.skirt]);
          // W6++: у юбки (низ кромки, dy −0,5) uv — как у точки на 0,5 м дальше от края: щебень на отвесной грани не тянется
          // вертикальными полосами (у верха и низа было одно и то же uv)
          rows.push(cols.map(([e, dy, c]) => { const X = x0 + lx * e, Z = z0 + lz * e, o = dy < -0.4 ? Math.sign(e) * 0.5 : 0; return bk.v(X, y + dy + 0.01, Z, 0, 1, 0, c, (X + lx * o) * UVK, (Z + lz * o) * UVK); }));
        }
        const nc = rows[0].length, skip = new Set([2, nc - 4]);
        for (let q = 0; q < rows.length - 1; q++) for (let c = 0; c < nc - 1; c++) { if (skip.has(c)) continue; const a = rows[q][c], b = rows[q][c + 1], d = rows[q + 1][c], e = rows[q + 1][c + 1]; bk.I.push(a, b, d, b, e, d); }
      }
      // точка полотна по (s, e) — на высоте сетки полотна (+ lift)
      const at = (s, e, lift) => { const q = sampleS(s), i = clamp(Math.round(s / DS), 0, N - 1); return [q.x + q.lx * e, q.y + roadDy(i, e) + 0.01 + lift, q.z + q.lz * e]; };
      // пятна: кольца эллипса (масштаб, цвет) — от края к центру; центр — отдельная вершина
      const blob = (f, rings, lift, wobble, B) => {
        const bk = B || roadBk;
        const M = f.kind === 'hole' ? 10 : HI ? 18 : 14, c = Math.cos(f.rot), sn = Math.sin(f.rot), base = bk.n, rr = rng(Math.floor(f.s * 131 + f.e * 977) & 0xffff);
        // мягкий неровный край: две гармоники (без «многоугольника»)
        const p1 = rr() * 6.28, p2 = rr() * 6.28, wob = []; for (let m = 0; m < M; m++) { const a = m / M * PI * 2; wob.push(1 + wobble * (0.32 * Math.sin(2 * a + p1) + 0.2 * Math.sin(3 * a + p2))); }
        rings.forEach(([sc, col]) => { for (let m = 0; m < M; m++) { const a = m / M * PI * 2, u = Math.cos(a) * f.a * sc * wob[m], v = Math.sin(a) * f.b * sc * wob[m]; const p = at(f.s + u * c + v * sn, f.e - u * sn + v * c, lift); bk.v(p[0], p[1], p[2], 0, 1, 0, col, p[0] * UVK, p[2] * UVK); } });
        const cc = rings[rings.length - 1][2] || rings[rings.length - 1][1], pc = at(f.s, f.e, lift); const ic = bk.v(pc[0], pc[1], pc[2], 0, 1, 0, cc, pc[0] * UVK, pc[2] * UVK);
        // ориентация: нормаль вверх — обход против часовой при взгляде сверху (как у полотна)
        const flip = (() => { const p0 = at(f.s, f.e, 0), p1 = at(f.s + 0.5, f.e, 0), p2 = at(f.s, f.e + 0.5, 0); const ax = p1[0] - p0[0], az = p1[2] - p0[2], bx = p2[0] - p0[0], bz = p2[2] - p0[2]; return az * bx - ax * bz < 0; })();
        const tri = (a, b, d) => { if (flip) bk.I.push(a, d, b); else bk.I.push(a, b, d); };
        for (let r = 0; r < rings.length - 1; r++) for (let m = 0; m < M; m++) { const a = base + r * M + m, b = base + r * M + (m + 1) % M, a2 = a + M, b2 = b + M; tri(a, b, a2); tri(b, b2, a2); }
        const lr = base + (rings.length - 1) * M; for (let m = 0; m < M; m++) tri(lr + m, lr + (m + 1) % M, ic);
      };
      FEAT.forEach(f => {
        // 4B: яма — светлая кромка, тёмная глубина (центр темнее), иногда с водой; лужа — грязевой ободок, вода с отражением неба (своя сетка)
        if (f.kind === 'hole') { blob(f, [[1.24, SC.holeRim], [1.0, SC.hole], [0.62, SC.holeC], [0.25, SC.holeC]], 0.014, 0.25); if ((Math.floor(f.s * 7.3) % 4) === 0 && WET[clamp(Math.round(f.s / DS), 0, N - 1)] > 0.2) blob(Object.assign({}, f, { a: f.a * 0.7, b: f.b * 0.7 }), [[1.0, SC.water], [0.5, SC.waterC, SC.waterC]], 0.02, 0.2, wetBk); }
        else if (f.kind === 'puddle') { blob(f, [[1.36, SC.mudRim], [1.14, SC.mud], [0.9, SC.mudC]], 0.016, 0.3); blob(f, [[1.0, SC.water], [0.55, SC.waterC], [0.2, SC.waterC, SC.waterC]], 0.022, 0.3, wetBk); }
        else if (f.kind === 'mud') blob(f, [[1.06, SC.mudRim], [0.8, SC.mud], [0.42, SC.mudC]], 0.012, 0.45);
      });
      // камни: на полотне (их чувствует подвеска), по обочинам и щебень на внутренней стороне петель (только вид)
      const rockG = new T.OctahedronGeometry(1, 0);   // 8 треугольников на камень (мелочь — грани не видны)
      const putStone = (x, y, z, r, sy, ry, col) => {
        bk.geo(rockG, mtx(x, y + r * sy * 0.35, z, ry, r, r * sy, r * (0.8 + 0.4 * ((ry * 7.3) % 1))), WIN ? (i, p, nn) => (nn.getY(i) > 0.45 ? SC.snow : col) : col, (u, w, i, p) => [p.getX(i) * UVK, p.getZ(i) * UVK]);
      };
      const rs2 = rng(77 + (WIN ? 1 : 0));
      FEAT.forEach(f => { if (f.kind !== 'stone') return; const p = at(f.s, f.e, -0.01); putStone(p[0], p[1], p[2], f.a, 0.6, f.rot, SC.stones[Math.floor(rs2() * SC.stones.length)]); });
      const nVis = HI ? 900 : 520;   // 4B: больше щебня по краям и внутри петель
      for (let k = 0, tries = 0; k < nVis && tries < nVis * 4; tries++) {
        const i = Math.floor(rs2() * N); if (BRIDGE[i]) continue;
        const inner = R.k[i] > 0 ? 1 : -1, hair = R.kabs[i] > 0.04;
        let e;
        if (hair && rs2() < 0.6) e = inner * (SWA[i] * (0.35 + rs2() * 0.7));          // щебень внутри петли
        else { const sd = rs2() < 0.5 ? 1 : -1, W = sd > 0 ? SWL[i] : SWR[i]; e = sd * (SWA[i] - 0.1 + rs2() * (W - SWA[i] + 0.05)); }   // обочина и край
        const r = 0.04 + rs2() * rs2() * (Math.abs(e) > SWA[i] ? 0.2 : 0.07);
        const sj = i * DS + (rs2() - 0.5); if (Math.abs(e) < SWA[i] && surfSE(sj, e).kind === 'puddle') continue;   // 4B: в лужах камешков нет (торчали сквозь воду)
        const p = at(sj, e, -0.012);
        putStone(p[0], p[1], p[2], r, 0.5 + rs2() * 0.4, rs2() * 6.28, SC.stones[Math.floor(rs2() * SC.stones.length)]);
        k++;
      }
      // 4B: камни в ямах и валуны по обочинам (за краем полотна — на земле склона)
      FEAT.forEach(f => { if (f.kind !== 'hole') return; for (let k = 0; k < 2; k++) { const p = at(f.s + (rs2() - 0.5) * f.a, f.e + (rs2() - 0.5) * f.b, -0.03); putStone(p[0], p[1], p[2], 0.05 + rs2() * 0.04, 0.6, rs2() * 6.28, SC.stones[Math.floor(rs2() * SC.stones.length)]); } });
      const icoG = new T.IcosahedronGeometry(1, 0), nRock = HI ? 320 : 200;
      for (let k = 0, tries = 0; k < nRock && tries < nRock * 5; tries++) {
        const i = Math.floor(rs2() * N); if (BRIDGE[i]) continue;
        const sd = rs2() < 0.5 ? 1 : -1, W = sd > 0 ? SWL[i] : SWR[i], e = sd * (W - 0.15 + rs2() * 1.5), q = sampleS(i * DS + (rs2() - 0.5) * 2), x = q.x + q.lx * e, z = q.z + q.lz * e;
        const r = 0.16 + rs2() * rs2() * 0.42, y = Math.abs(e) > W + 0.05 ? ground(x, z) : at(i * DS, e, 0)[1], col = SC.rocks[Math.floor(rs2() * SC.rocks.length)];
        bk.geo(icoG, mtx(x, y + r * 0.18, z, rs2() * 6.28, r * (0.9 + rs2() * 0.5), r * (0.55 + rs2() * 0.3), r * (0.8 + rs2() * 0.4), (rs2() - 0.5) * 0.4, (rs2() - 0.5) * 0.4), WIN ? (ii, p, nn) => (nn.getY(ii) > 0.4 ? SC.snow : col) : (ii, p, nn) => mul3(col, 0.86 + 0.18 * Math.max(0, nn.getY(ii))), (u, w, ii, p) => [p.getX(ii) * UVK, p.getZ(ii) * UVK]);
        k++;
      }
      icoG.dispose();
      rockG.dispose();
      const m = bk.mesh(roadMat, true);
      const mc = chunked(m.geometry, roadMat, { cell: 120, renderOrder: -5, name: 'road' }); root.add(mc); meshes.road = mc;
      if (wetBk.n) { const mw = wetBk.mesh(wetMat, false); const mcw = chunked(mw.geometry, wetMat, { cell: 220, renderOrder: -4, name: 'puddles', receive: false }); root.add(mcw); meshes.puddles = mcw; }
    }

    /* ---------- подпорные стенки (без парапетов и столбиков — волна 4: «без отбойников»), мостик, ворота ----------
       Со стороны обрыва остаётся только сухая кладка НИЖЕ полотна (держит насыпь) и каменная кромка вровень с дорогой —
       ни парапета, ни ограждения. Безопасность — невидимый мягкий край: машина (drive.js) и героиня (коллайдеры kind 'edge'). */
    const wallMat = HI ? toon('#FFFFFF', { map: rubbleTex, vertexColors: true }) : cheap({ map: rubbleTex });
    const bkW = new Bk(), postList = [], colliders = [];
    const cWall = C('#FFFFFF'), cCap = WIN ? new T.Color(1.13, 1.16, 1.22) : C('#E9E1D0'), cWallLow = C('#8E8676');
    const benchI = iPk;   // лавочка смотровой — у внешнего края кармана, лицом к селу
    const kinds = { 1: [], '-1': [] };
    const i0 = 0, i1 = N - 1;
    [1, -1].forEach(sd => {
      const K = new Int8Array(N), YB = new Float32Array(N);
      for (let i = i0; i <= i1; i++) {
        const W = sd > 0 ? SWL[i] : SWR[i], ox = R.lx[i] * sd, oz = R.lz[i] * sd;
        const ex = R.x[i] + ox * (W + 1.25), ez = R.z[i] + oz * (W + 1.25);
        let yo = nearY(ex, ez); if (yo === null) yo = natY(ex, ez);
        const drop = R.y[i] - yo;
        YB[i] = Math.min(yo, R.y[i] - 0.3) - 0.7;
        // W6++: со стороны скальной стенки рельеф у подошвы теперь под камнем — подпорная кладка там не нужна
        if (BRIDGE[i] || (sd < 0 && cliffInfo[i * 3 + 1] > 0)) K[i] = 0;
        else if (drop > 0.45) K[i] = 1;
        else K[i] = 0;
      }
      // убрать мелкие обрывки
      for (let pass = 0; pass < 2; pass++) for (let i = i0 + 1; i < i1; i++) { let j = i; while (j < i1 && K[j] === K[i]) j++; if (j - i < 3 && i > i0) { for (let k = i; k < j; k++) K[k] = K[i - 1]; } i = j - 1; }
      kinds[sd] = K;
      // профиль сечения кромки: (смещение наружу от края, высота над полотном) — камень вровень с дорогой и кладка вниз
      const prof = yb => [[0, -0.15], [0, 0.03], [0.32, 0.0], [0.32, yb]];
      for (let i = i0; i < i1;) {
        if (!K[i]) { i++; continue; }
        let j = i; while (j < i1 && K[j + 1]) j++;
        if (j - i < 1) { i = j + 1; continue; }
        const nP = 4, rows = [], rowS = [];
        for (let s = i; s <= j; s++) {
          if (!KEEP[s] && s !== i && s !== j) continue;
          rowS.push(s);
          const W = sd > 0 ? SWL[s] : SWR[s], ox = R.lx[s] * sd, oz = R.lz[s] * sd, ex = R.x[s] + ox * W, ez = R.z[s] + oz * W, y = R.y[s];
          const pr = prof(YB[s] - y); rows.push(pr.map(([u, h]) => [ex + ox * u, y + h, ez + oz * u]));
        }
        for (let p = 0; p < nP - 1; p++) {
          const isCap = p === 1, vStart = p === 0 ? 0 : 0.6 * p;
          const base = bkW.n;
          for (let r = 0; r < rows.length; r++) {
            const A = rows[r][p], B = rows[r][p + 1], s = rowS[r] * DS;
            const u = s / 1.6;
            const cA = isCap ? cCap : cWall;
            const uvA = isCap && WIN ? SNOW_UV : [u, (vStart + 0) / 1.6], uvB = isCap && WIN ? SNOW_UV : [u, (vStart + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])) / 1.6];
            bkW.v(A[0], A[1], A[2], 0, 1, 0, cA, uvA[0], uvA[1]); bkW.v(B[0], B[1], B[2], 0, 1, 0, cA, uvB[0], uvB[1]);
          }
          for (let r = 0; r < rows.length - 1; r++) { const a = base + r * 2, b = a + 1, c2 = a + 2, d = a + 3; if (sd > 0) bkW.I.push(a, c2, b, b, c2, d); else bkW.I.push(a, b, c2, b, d, c2); }
        }
        // торцы
        [[0, -1], [rows.length - 1, 1]].forEach(([r, dir]) => {
          const pts = rows[r], q0 = bkW.n; pts.forEach(p => bkW.v(p[0], p[1], p[2], 0, 1, 0, cWall, p[0] * 0.6 + p[2] * 0.6, p[1] * 0.6));
          for (let q = 1; q < pts.length - 1; q++) { if ((dir < 0) === (sd > 0)) bkW.I.push(q0, q0 + q, q0 + q + 1); else bkW.I.push(q0, q0 + q + 1, q0 + q); }
        });
        i = j + 1;
      }
      // коллайдеры для прогулки: тонкие коробки вдоль края полосы (героиня не уходит за край: обрыв без ограждения не страшен)
      let a0 = i0;
      while (a0 < i1) {
        let b0 = a0 + 1;
        const Wa0 = sd > 0 ? SWL[a0] : SWR[a0];
        while (b0 < i1 && b0 - a0 < 8 && Math.abs(angDiff(R.th[b0], R.th[a0])) < 0.09 && Math.abs((sd > 0 ? SWL[b0] : SWR[b0]) - Wa0) < 0.25) b0++;   // W6: в кармане (ширина меняется) — короче
        const Wa = (sd > 0 ? SWL[a0] : SWR[a0]) + 0.25, Wb = (sd > 0 ? SWL[b0] : SWR[b0]) + 0.25;
        const ax = R.x[a0] + R.lx[a0] * sd * Wa, az = R.z[a0] + R.lz[a0] * sd * Wa, bx = R.x[b0] + R.lx[b0] * sd * Wb, bz = R.z[b0] + R.lz[b0] * sd * Wb;
        const len = Math.hypot(bx - ax, bz - az);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        colliders.push({ type: 'box', x: mx, z: mz, w: 0.5, d: len + 0.7, ry: Math.atan2(bx - ax, bz - az), y0: Math.min(R.y[a0], R.y[b0]) - 1, y1: Math.max(R.y[a0], R.y[b0]) + 0.6, kind: 'edge', noCar: true });
        a0 = b0;
      }
    });
    // торцы дороги (дальше — облако): начало и конец
    [[0, -1], [N - 1, 1]].forEach(([i, dir]) => { const W = Math.max(SWL[i], SWR[i]) + 0.6; colliders.push({ type: 'box', x: R.x[i] + Math.sin(R.th[i]) * dir * 0.6, z: R.z[i] + Math.cos(R.th[i]) * dir * 0.6, w: W * 2, d: 0.5, ry: R.th[i], kind: 'end', noCar: true }); });
    // мостик через ручей: пролёт-арка в обеих стенках, свод снизу; без парапета (волна 4) — кромка вровень с дорогой.
    // W6++: стенки — ленты по краю полотна (точки через 0,5 м, в пролёте арки — чаще), верх идёт за полотном по уклону и
    // повороту. Раньше — прямая 13-метровая плита по касательной: на крутом повороте у ручья (R ≈ 15 м, уклон ≈ 12 %)
    // её нижний конец выходил на полотно и торчал над ним на 0,9 м, верхний — тонул в дороге
    if (iBr > 0) {
      const i = iBr, th = R.th[i], tx = Math.sin(th), tz = Math.cos(th), lx = R.lx[i], lz = R.lz[i], y = R.y[i];
      const xs = R.x[i], zs = R.z[i], bed = (nearY(xs, zs) ?? natY(xs, zs));
      const span = BR_SPAN, Lb = 13, spring = Math.min(bed + 0.9, y - span - 0.35), yb = Math.min(bed, spring) - 1.2;
      // станции вдоль дороги от оси ручья: u и низ стенки (в пролёте — арка, у пят — по две точки: низ и пята)
      const ST = [];
      for (let u = -Lb / 2; u < -span - 0.05; u += 0.5) ST.push([u, yb]);
      ST.push([-span, yb]);
      for (let k = 0; k <= 16; k++) { const u = -span + span * 2 * k / 16; ST.push([u, spring + Math.sqrt(Math.max(0, span * span - u * u))]); }
      ST.push([span, yb]);
      for (let u = span + 0.5; u <= Lb / 2 + 1e-6; u += 0.5) ST.push([u, yb]);
      // четырёхугольник (обход по кругу) лицом в сторону n
      const face = (P, n, col, U) => {
        const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2], bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
        const fl = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0, i0 = bkW.n;
        P.forEach((p, k) => bkW.v(p[0], p[1], p[2], n[0], n[1], n[2], col, U[k][0], U[k][1]));
        if (fl) bkW.I.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); else bkW.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      };
      [1, -1].forEach(sd => {
        const rows = ST.map(([u, bot]) => {
          const q = sampleS(sBr + u), W = sd > 0 ? q.wl : q.wr, ox = q.lx * sd, oz = q.lz * sd;
          // W6++: со стороны скальной стенки кромка доходит до камня (наружная грань — за лицом стенки): между мостиком и
          // подошвой не остаётся щели над ручьём
          const ic = clamp(Math.round((sBr + u) / DS), 0, N - 1), ow = sd < 0 && cliffInfo[ic * 3 + 1] > 0 ? CLIFF.base + 0.3 : 0.45;
          return { u, bot, ox, oz, e: [q.x + ox * W, q.z + oz * W], o: [q.x + ox * (W + ow), q.z + oz * (W + ow)], top: q.y + 0.03, topO: q.y + 0.01 };
        });
        for (let k = 0; k < rows.length - 1; k++) {
          const A = rows[k], B = rows[k + 1], ua = (A.u + Lb / 2) / 1.6, ub = (B.u + Lb / 2) / 1.6, n = [(A.ox + B.ox) / 2, 0, (A.oz + B.oz) / 2];
          if (Math.abs(B.u - A.u) < 1e-6) continue;
          // наружная грань: от кромки до низа (в пролёте — до арки)
          face([[A.o[0], A.topO, A.o[1]], [B.o[0], B.topO, B.o[1]], [B.o[0], B.bot, B.o[1]], [A.o[0], A.bot, A.o[1]]], n, cWall, [[ua, A.topO / 1.6], [ub, B.topO / 1.6], [ub, B.bot / 1.6], [ua, A.bot / 1.6]]);
          // кромка — камень вровень с дорогой
          face([[A.e[0], A.top, A.e[1]], [B.e[0], B.top, B.e[1]], [B.o[0], B.topO, B.o[1]], [A.o[0], A.topO, A.o[1]]], [0, 1, 0], cCap, WIN ? [SNOW_UV, SNOW_UV, SNOW_UV, SNOW_UV] : [[ua, 0], [ub, 0], [ub, 0.28], [ua, 0.28]]);
          // в пролёте — низ арки (толщина стенки), лицом вниз
          if (Math.abs(A.u) <= span + 1e-6 && Math.abs(B.u) <= span + 1e-6 && A.bot > yb && B.bot > yb) face([[A.e[0], A.bot, A.e[1]], [B.e[0], B.bot, B.e[1]], [B.o[0], B.bot, B.o[1]], [A.o[0], A.bot, A.o[1]]], [0, -1, 0], cWallLow, [[ua, 0], [ub, 0], [ub, 0.28], [ua, 0.28]]);
        }
        // пяты арки (боковые грани проёма от низа до пяты) и торцы стенки
        rows.forEach((A, k) => {
          const B = rows[k + 1];
          if (B && Math.abs(B.u - A.u) < 1e-6) { const lo2 = Math.min(A.bot, B.bot), hi2 = Math.max(A.bot, B.bot), d = A.u < 0 ? 1 : -1; face([[A.e[0], hi2, A.e[1]], [A.o[0], hi2, A.o[1]], [A.o[0], lo2, A.o[1]], [A.e[0], lo2, A.e[1]]], [tx * d, 0, tz * d], cWall, [[0, hi2 / 1.6], [0.28, hi2 / 1.6], [0.28, lo2 / 1.6], [0, lo2 / 1.6]]); }
          if (k === 0 || k === rows.length - 1) { const d = k === 0 ? -1 : 1; face([[A.e[0], A.top, A.e[1]], [A.o[0], A.topO, A.o[1]], [A.o[0], A.bot, A.o[1]], [A.e[0], A.bot, A.e[1]]], [tx * d, 0, tz * d], cWall, [[0, A.top / 1.6], [0.28, A.topO / 1.6], [0.28, A.bot / 1.6], [0, A.bot / 1.6]]); }
        });
      });
      // свод (внутренняя сторона полуцилиндра), ось поперёк дороги
      const vg = new T.CylinderGeometry(span, span, SWL[i] + SWR[i] + 0.9, 12, 1, true, -PI / 2, PI);
      vg.rotateX(-PI / 2);
      { const ix = vg.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } const nn = vg.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, -nn.getX(k), -nn.getY(k), -nn.getZ(k)); }
      const off = (SWL[i] - SWR[i]) / 2;
      const m = new T.Matrix4().makeBasis(new T.Vector3(tx, 0, tz), new T.Vector3(0, 1, 0), new T.Vector3(-lx, 0, -lz)); m.setPosition(xs + lx * off, spring, zs + lz * off);
      bkW.geo(vg, m, cWallLow, (u, v) => [u * 3, v * 2.5]);
      vg.dispose();
    }
    const exitI = N - 1 - Math.round(9 / DS);
    // ворота въезда: два каменных столба с шапками
    [1, -1].forEach(sd => {
      const i = exitI, W = (sd > 0 ? SWL[i] : SWR[i]) + 0.75, x = R.x[i] + R.lx[i] * sd * W, z = R.z[i] + R.lz[i] * sd * W, y = R.y[i];
      bkW.geo(GB, mtx(x, y + 1.0, z, R.th[i], 0.8, 2.4, 0.8), cWall, boxUV(0.8, 2.4, 0.8, 1.6));
      bkW.geo(GB, mtx(x, y + 2.3, z, R.th[i], 1.0, 0.22, 1.0), cCap, WIN ? () => SNOW_UV : boxUV(1, 0.22, 1, 1.6));
      colliders.push({ type: 'circle', x, z, r: 0.6, kind: 'gate' });
    });
    { const m = bkW.mesh(wallMat, true); m.geometry.computeVertexNormals(); const mc = chunked(m.geometry, wallMat, { cell: 150, cast: HI, name: 'walls' }); root.add(mc); meshes.walls = mc; }

    /* ---------- W6: скальная стенка СПРАВА по ходу вверх (слева — вниз): слоистая порода (полосы по мировой высоте — пласты
       горизонтальны, дорога идёт вверх сквозь них), уступы, местами навес над осыпью; подошва — в 1,3 м за краем полотна
       (там осыпь из камешков), сверху — травяной кант до склона. Своя лента вдоль дороги (рельеф ближней сетки за ней — ниже);
       у ручья — низкая выемка-водоскат. Один материал (цвет вершин), куски по 90 м. ---------- */
    // текстура пластов: горизонтальные слои 0,9–2,4 м (тёплый песчаник, серый известняк, охра), тёмные швы, светлая кромка
    // уступа, редкие вертикальные трещины и пятна лишайника; uv — по миру (u = s / 7 м, v = y / 14 м), пласты горизонтальны
    const strataTex = (() => {
      const W2 = 128, H2 = 512, [cv, c] = cnv(W2, H2), r2 = rng(4141 + (WIN ? 2 : 0));
      const PALS = WIN ? ['#D9D5CF', '#C8C2BA', '#E3E0DB', '#BDB5AB', '#D0CAC2', '#B4ACA2'] : ['#CDBB9C', '#B49E82', '#DCCBA8', '#A08A72', '#C4AE8A', '#AE9878', '#D2C09A'];
      let y = 0, k = 0;
      while (y < H2) {
        const h = Math.min(H2 - y, 32 + Math.floor(r2() * 54)), col = PALS[(k * 3 + Math.floor(r2() * 2)) % PALS.length];
        c.fillStyle = col; c.fillRect(0, y, W2, h);
        // волнистая граница снизу (пласт чуть выступает) и светлая кромка сверху
        c.fillStyle = 'rgba(70,56,44,.42)'; for (let x = 0; x < W2; x += 4) { const o = 2 * Math.sin((x / W2) * PI * 2 * 2 + k) + r2() * 1.2; c.fillRect(x, y + h - 3 + o, 4, 3); }
        c.fillStyle = WIN ? 'rgba(255,255,255,.75)' : 'rgba(255,248,232,.35)'; c.fillRect(0, y, W2, WIN ? 5 : 3);
        for (let i = 0; i < 26; i++) { const x = r2() * W2, yy = y + 4 + r2() * (h - 8), w = 3 + r2() * 14; c.fillStyle = r2() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(60,48,38,.14)'; c.fillRect(x, yy, w, 1.5); c.fillRect(x - W2, yy, w, 1.5); }
        if (r2() < 0.22) { const x = r2() * W2, hh = (h - 6) * (0.4 + r2() * 0.6); c.fillStyle = 'rgba(60,48,38,.18)'; c.fillRect(x, y + 3, 1.2, hh); }
        // крупные пятна: выветренные светлые и тёмные места — пласт не «кирпичный»
        for (let i = 0; i < 3; i++) { const x = r2() * W2, yy = y + r2() * h, rw = 10 + r2() * 26, rh = 4 + r2() * 10; c.fillStyle = r2() < 0.5 ? 'rgba(255,250,236,.16)' : 'rgba(70,58,46,.12)'; [0, -W2, W2].forEach(o => { c.beginPath(); c.ellipse(x + o, yy, rw, rh, 0, 0, PI * 2); c.fill(); }); }
        if (!WIN && r2() < 0.35) { c.fillStyle = 'rgba(128,140,92,.35)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(r2() * W2, y + r2() * h, 2 + r2() * 4, 0, PI * 2); c.fill(); } }
        y += h; k++;
      }
      const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = HI ? 4 : 2; return t;
    })();
    const cliffMat = HI ? toon('#FFFFFF', { vertexColors: true, map: strataTex }) : cheap({ map: strataTex });
    {
      const bk = new Bk(), cA = new T.Color(), cB = new T.Color();
      const STR = WIN ? ['#C9C4BC', '#B5AEA4', '#D6D2CB', '#A69E94', '#BFB8AE', '#ADA59A'].map(C) : ['#B9A78C', '#A48F75', '#C9B898', '#8F7D69', '#B3A07F', '#9C8A70'].map(C);
      const cGreyR = C(WIN ? '#D3D2D0' : '#B4B0A8'), cLichen = C(WIN ? '#E9EEF3' : '#8E9A6A'), cFoot = C(WIN ? '#B9B3AA' : '#8A7C6C'), cCap = C(WIN ? '#F2F5F8' : '#9BA45E'), cCap2 = C(WIN ? '#E3E9EF' : '#7F9050'), cShade = C(WIN ? '#8E8A86' : '#6F604F');
      const band = yw => { const k = Math.floor((yw + 400) / 1.7); return STR[(k * 7 + (k >> 2)) % STR.length]; };
      const rowsAt = [];
      const flush = () => {
        if (rowsAt.length >= 2) {
          // лицом к дороге: стенка и кант (CNR + 3 точки), отдельно — юбка канта (две последние точки ряда)
          const nP = CNR + 3;
          for (let r = 0; r < rowsAt.length - 1; r++) for (let c = 0; c < nP + 1; c++) {
            // юбка — только где край канта висит над склоном хотя бы в одном из двух рядов (треугольники бюджета low)
            if (c === nP - 1 || (c === nP && !rowsAt[r].sk && !rowsAt[r + 1].sk)) continue;
            const a = rowsAt[r][c], b = rowsAt[r][c + 1], d = rowsAt[r + 1][c], e = rowsAt[r + 1][c + 1]; bk.I.push(a, b, d, b, e, d);
          }
          endCap(rowsAt[0], -1); endCap(rowsAt[rowsAt.length - 1], 1);
        }
        rowsAt.length = 0;
      };
      // W6++: торцы ленты (у концов дороги) — плоская грань по профилю крайнего ряда до низа юбки канта,
      // лицом в проём: сбоку под камнем не видно пустоты (стенка — одна поверхность, за ней ничего нет)
      function endCap(row, sg) {
        const nP = CNR + 3, ids = row.slice(0, nP).concat([row[nP + 1]]), nx = row.t[0] * sg, nz = row.t[1] * sg, P = bk.P, i0 = bk.n;
        // низ торца — цвета подошвы (камень), не травы канта; оба нижних угла (у подошвы и под краем канта) — до земли под
        // ними (где земля ниже подошвы — под углом торца был просвет 0,3–0,8 м; у высокой стенки
        // низ юбки канта выше склона). Только у торца: лента стенки не опускается
        ids.forEach((k, n) => {
          const kc = n === nP ? row[0] : k, x = P[k * 3], z = P[k * 3 + 2], yg = n === 0 || n === nP ? nearY(x, z) : null, y = yg !== null ? Math.min(P[k * 3 + 1], yg - 0.3) : P[k * 3 + 1];
          bk.v(x, y, z, nx, 0, nz, cTmp.setRGB(bk.C[kc * 3], bk.C[kc * 3 + 1], bk.C[kc * 3 + 2]), bk.U[k * 2], bk.U[k * 2 + 1]);
        });
        const B = i0 + nP;
        for (let k = 0; k < nP - 1; k++) {
          const a = i0 + k, b = i0 + k + 1, ax = P[a * 3] - P[B * 3], ay = P[a * 3 + 1] - P[B * 3 + 1], az = P[a * 3 + 2] - P[B * 3 + 2], bx = P[b * 3] - P[B * 3], by = P[b * 3 + 1] - P[B * 3 + 1], bz = P[b * 3 + 2] - P[B * 3 + 2];
          // обход — лицом наружу (по нормали торца)
          if ((ay * bz - az * by) * nx + (ax * by - ay * bx) * nz >= 0) bk.I.push(B, a, b); else bk.I.push(B, b, a);
        }
      }
      // W6++: у мостика подошва — по готовой ближней сетке, по дну оврага (профили считались до неё; рельеф у подошвы от её
      // высоты не зависит — там «пол» обочины или овраг): низ стенки висел над ручьём на 1,3 м. На 0,15 м ниже земли под
      // собой и чуть впереди — не глубже: в стороне от оврага «пол» за подошвой вылезал бы сквозь низ стенки
      for (let i = 0; i < N; i++) {
        if (!CROW[i] || cliffInfo[i * 3 + 1] <= 0 || !BRIDGE[i] || Math.abs(i * DS - sBr) >= BR_OPEN + 1.2) continue;
        const o = i * CNP, lx = -R.lx[i], lz = -R.lz[i];
        let mn = Infinity;
        for (const de of [-0.4, 0]) { const e = CPE[o] + de, x = R.x[i] + lx * e, z = R.z[i] + lz * e, y = nearY(x, z); if (y !== null && y < mn) mn = y; }
        if (mn < Infinity) CPH[o] = Math.min(-0.35, mn - R.y[i] - 0.15);
      }
      // ряды — из профилей (посчитаны до рельефа, см. cliffAt): стенка не стоит у самых концов дороги (там облако)
      for (let i = 0; i < N; i++) {
        if (cliffInfo[i * 3 + 1] <= 0) { flush(); continue; }
        if (!CROW[i]) continue;
        const x0 = R.x[i], z0 = R.z[i], y0 = R.y[i], lx = -R.lx[i], lz = -R.lz[i], s = i * DS, o = i * CNP, ovK = COVK[i];
        const row = [];
        row.t = [Math.sin(R.th[i]), Math.cos(R.th[i])];
        for (let j = 0; j <= CNR; j++) {
          const e = CPE[o + j], yw = y0 + CPH[o + j];
          // местами — серый известняк
          cA.setRGB(1, 1, 1).lerp(band(yw), 0.25).lerp(cGreyR, 0.4 * sm(0.45, 0.75, vnoise(s * 0.02 + 5, 2.5)));
          // W6++: и пятна лишайника (зимой — инея); раньше эти две строки стояли внутри комментария выше и не работали
          const ln = vnoise(s * 0.11 + 3, yw * 0.3);
          if (ln > 0.62) cA.lerp(cLichen, 0.3 * sm(0.62, 0.8, ln));
          if (j === 0) cA.copy(cFoot).multiplyScalar(1.15);
          // тень под навесом
          if (ovK > 0 && j >= CNR - 3 && j < CNR - 1) cA.lerp(cShade, 0.4 * ovK);
          // внизу чуть темнее (тень дороги и осыпи)
          cA.multiplyScalar(0.9 + 0.14 * vnoise(s * 0.4, j * 1.3) - 0.1 * (1 - j / CNR));
          row.push(bk.v(x0 + lx * e, yw, z0 + lz * e, -lx, 0.25, -lz, cA, s / 7, yw / 14));
        }
        // кант сверху: травяная бровка к склону ближней сетки; пятно атласа без пластов (верх текстуры — светлая кромка),
        // цвет — трава/снег
        cB.copy(cCap).lerp(cCap2, vnoise(s * 0.2, 5));
        [CNR + 1, CNR + 2].forEach((j, k) => { const e = CPE[o + j]; row.push(bk.v(x0 + lx * e, y0 + CPH[o + j], z0 + lz * e, 0, 1, 0, cB, s / 7 + k * 0.1, 0.999)); });
        // W6++: от дальнего края канта — юбка вниз на 4 м (лицом от дороги): где склон за кантом ниже края (крупная ближняя
        // сетка, конец дороги за воротами), под кантом не видно щели. Своя пара вершин (копия края и низ): нормаль канта
        // не гнётся
        {
          const e = CPE[o + CNR + 2], yc = y0 + CPH[o + CNR + 2], gy = de => { const xb = x0 + lx * (e + de), zb = z0 + lz * (e + de); return nearY(xb, zb) ?? farY(xb, zb); }, yb = Math.min(gy(-0.05), gy(0.15));
          row.push(bk.v(x0 + lx * e, yc, z0 + lz * e, lx, 0, lz, cB, s / 7 + 0.2, 0.999), bk.v(x0 + lx * e, yc - 4, z0 + lz * e, lx, 0, lz, cB, s / 7 + 0.2, 0.999));
          row.sk = yc - yb > 0.02;
        }
        rowsAt.push(row);
      }
      flush();
      const m = bk.mesh(cliffMat, true);
      if (m) { m.geometry.computeVertexNormals(); const mc = chunked(m.geometry, cliffMat, { cell: 130, cast: HI, renderOrder: -4, name: 'cliff' }); root.add(mc); meshes.cliff = mc; }
      // кусты на канте над стенкой (зимой — снежные бугорки): один меш
      const shr = [], rs = rng(808 + (WIN ? 1 : 0)), nS = HI ? 110 : 60;
      // W6++: только на канте и склоне над стенкой, по земле (ground: кант или склон за ним). Кусты «на уступах» сидели на
      // простом откосе 3,4 без неровностей стенки: половина пряталась в камне, остальные висели на крутой стенке
      for (let k = 0, tries = 0; k < nS && tries < nS * 6; tries++) {
        const i = 4 + Math.floor(rs() * (N - 8)), H = cliffInfo[i * 3 + 1]; if (H < 4) continue;
        const e = cliffInfo[i * 3 + 2] + 0.6 + rs() * 2.2, x = R.x[i] - R.lx[i] * e, z = R.z[i] - R.lz[i] * e, y = ground(x, z);
        if (Math.abs(y - (R.y[i] + H)) > 2.5) continue;
        shr.push([x, y, z, 0.32 + rs() * 0.42]); k++;
      }
      if (shr.length) {
        const SHC = WIN ? [C('#E9EEF2'), C('#DDE4EA')] : [C('#5E7A45'), C('#6F8A4C'), C('#8A8A3E'), C('#4F6B40')];
        const im = new T.InstancedMesh(crownGeoS(), cheapVC, shr.length);
        shr.forEach(([x, y, z, sc], k) => { im.setMatrixAt(k, mtx(x, y + sc * 0.35, z, rs() * 6, sc * 1.25, sc * 0.8, sc)); im.setColorAt(k, SHC[k % SHC.length].clone().multiplyScalar(0.92 + rs() * 0.14)); });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.name = 'shrubs'; meshes.shrubs = bakeInst(im); root.add(meshes.shrubs);
      }
    }
    // столбики — инстансы
    if (postList.length) {
      const bk = new Bk(), white = C('#F6F4EE'), red = C('#D9455A');
      bk.geo(GCy6, mtx(0, 0.35, 0, 0, 0.07, 0.7, 0.07), white);
      bk.geo(GB, mtx(0, 0.58, 0.06, 0, 0.08, 0.1, 0.02), red); bk.geo(GB, mtx(0, 0.58, -0.06, 0, 0.08, 0.1, 0.02), red);
      const geo = bk.mesh(vcMat).geometry;
      const im = new T.InstancedMesh(geo, cheap(), postList.length);   // свой материал: у столбиков нет цвета инстансов
      postList.forEach(([x, y, z, ry], k) => im.setMatrixAt(k, mtx(x, y, z, ry, 1, 1, 1)));
      im.instanceMatrix.needsUpdate = true; geo.boundingSphere = null; im.computeBoundingSphere && im.computeBoundingSphere();
      im.frustumCulled = false; im.castShadow = false; im.name = 'posts'; meshes.posts = bakeInst(im); root.add(meshes.posts);
    }

    /* ---------- смотровая: лавочка, валуны, указатели и прочие мелочи (один меш) ---------- */
    const bkP = new Bk(), bkS = new Bk();
    const cWood = C(PAL.wood), cWoodD = C(PAL.woodD), cStone = C('#B8AD9A'), cPost = C('#8E9AA6'), cBack = C('#7F93A8');
    // лавочка смотровой и (волна 4) лавочки в новых карманах: лицом к долине и селу (к башне, но не вдоль дороги)
    const outSide = pocketSide;
    function makeBench(P, ry) {
      const f = (lx, ly, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [P.x + lx * c + lz * s, P.y + ly, P.z - lx * s + lz * c]; };
      [-0.7, 0.7].forEach(dx => { const p = f(dx, 0.22, 0); bkP.geo(GB, mtx(p[0], p[1], p[2], ry, 0.22, 0.44, 0.42), cStone); });
      [-0.13, 0, 0.13].forEach((dz, k) => { const p = f(0, 0.47, dz); bkP.geo(GB, mtx(p[0], p[1], p[2], ry, 1.8, 0.05, 0.12), k === 1 ? cWood : cWoodD); });
      const pb = f(0, 0.78, -0.22); bkP.geo(GB, mtx(pb[0], pb[1], pb[2], ry, 1.8, 0.16, 0.05, -0.18), cWood);
      [-0.7, 0.7].forEach(dx => { const p = f(dx, 0.62, -0.21); bkP.geo(GB, mtx(p[0], p[1], p[2], ry, 0.07, 0.36, 0.06, -0.18), cWoodD); });
      colliders.push({ type: 'box', x: P.x, z: P.z, w: 1.9, d: 0.6, ry, kind: 'bench', y0: P.y - 1, y1: P.y + 0.5 });   // W5: верх сиденья — на лавочку можно запрыгнуть
    }
    const BENCHES = [];
    POCKETS.forEach(pk => {
      const i = pk.i, sd = pk.side, bw = (sd > 0 ? SWL[i] : SWR[i]) - 1.0;
      const P = { x: R.x[i] + R.lx[i] * sd * bw, y: R.y[i], z: R.z[i] + R.lz[i] * sd * bw };
      const ta = Math.atan2(TOWER.x - P.x, TOWER.z - P.z), oa = Math.atan2(R.lx[i] * sd, R.lz[i] * sd);
      const ry = pk.main ? ta : oa + clamp(angDiff(ta, oa), -0.95, 0.95);
      makeBench(P, ry);
      BENCHES.push({ id: pk.main ? 'road_view' : 'road_bench' + pk.k, k: pk.k || 0, i, side: sd, x: P.x, y: P.y, z: P.z, ry });
    });
    const benchP = { x: BENCHES[0].x, y: BENCHES[0].y, z: BENCHES[0].z };
    const toTower = Math.atan2(TOWER.x - benchP.x, TOWER.z - benchP.z);
    // указатель смотровой
    const viewSignI = iPk - 12;
    const signs = [];
    const signAt = (i, side, off, h, id, w, hh, flipToward) => {
      const W = (side > 0 ? SWL[i] : SWR[i]) + off, x = R.x[i] + R.lx[i] * side * W, z = R.z[i] + R.lz[i] * side * W, y = R.y[i];
      signs.push({ x, y, z, h, id, w, hh, ry: R.th[i] + PI });   // щит смотрит навстречу едущим
      return { x, y, z };
    };
    // начало: «Кубачи ↑» и под ним «Город ↓» на одном столбе, справа по ходу
    const startI = Math.round(26 / DS);
    // W6: справа по ходу вверх — скальная стенка (её подошва на 1,3 м за краем полотна), щиты справа — ближе к краю
    const sA = signAt(startI, -1, 0.65, 2.35, 'A', 1.5, 0.55);
    signs.push({ x: sA.x, y: sA.y, z: sA.z, h: 1.62, id: 'B', w: 0.95, hh: 0.33, ry: R.th[startI] + PI });
    const sC = signAt(exitI - 5, -1, 0.5, 2.3, 'C', 1.7, 0.49);
    const sD = signAt(viewSignI, outSide, 0.6, 1.25, 'D', 0.9, 0.32);
    // W6: «Осторожно, камушки» — у начала подъёма, справа (со стороны скалы), лицом к едущим вверх
    const kI = Math.round(46 / DS), sK = signAt(kI, -1, 0.75, 2.05, 'K', 1.45, 1.15);
    [[sA, 2.7], [sC, 2.6], [sD, 1.45], [sK, 2.6]].forEach(([p, h], k) => {
      // W6++: столб — до земли (за краем полотна она ниже дороги: столб «висел» над склоном), щит — на прежней высоте
      const y0 = Math.min(p.y, ground(p.x, p.z) - 0.08), hh = p.y + h - y0;
      bkP.geo(GCy, mtx(p.x, y0 + hh / 2, p.z, 0, 0.05, hh, 0.05), k === 2 ? cWoodD : cPost);
      colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.25, kind: 'sign' });
    });
    signs.forEach(s => {
      const uv = SIGN.uv[s.id], u0 = uv[0] / 1024, v1 = 1 - uv[1] / SIGN_H, u1 = (uv[0] + uv[2]) / 1024, v0 = 1 - (uv[1] + uv[3]) / SIGN_H;
      const wu = SIGN.uv.W, wu0 = (wu[0] + 4) / 1024, wv0 = 1 - (wu[1] + 4) / SIGN_H;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry), off = 0.07;
      const P = (lx, ly, lz) => [s.x + lx * c + lz * sn, s.y + s.h + ly, s.z - lx * sn + lz * c];
      const hw = s.w / 2, hh = s.hh / 2, nF = [sn, 0, c];
      // лицо (+z локально), задник, торцы — задник и торцы белым пятном атласа × цвет вершин
      const quad = (a, b, c2, d, n, col, uvs) => { const i0 = bkS.n; [a, b, c2, d].forEach((p, k) => bkS.v(p[0], p[1], p[2], n[0], n[1], n[2], col, uvs[k][0], uvs[k][1])); bkS.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
      const white = C('#FFFFFF');
      quad(P(-hw, -hh, off + 0.02), P(hw, -hh, off + 0.02), P(hw, hh, off + 0.02), P(-hw, hh, off + 0.02), nF, white, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      const W4 = [[wu0, wv0], [wu0, wv0], [wu0, wv0], [wu0, wv0]], nB = [-sn, 0, -c];
      if (s.back && SIGN.uv[s.back]) {   // W5: двусторонний щит — на обороте своя картинка (читается правильно, не зеркально)
        const ub = SIGN.uv[s.back], b0 = ub[0] / 1024, b1 = (ub[0] + ub[2]) / 1024, bv1 = 1 - ub[1] / SIGN_H, bv0 = 1 - (ub[1] + ub[3]) / SIGN_H;
        // оборот — ЗА столбом (иначе столб закрывает середину надписи), торцы — щитом толщиной во весь столб
        const zb = -off - 0.02;
        quad(P(hw, -hh, zb), P(-hw, -hh, zb), P(-hw, hh, zb), P(hw, hh, zb), nB, white, [[b0, bv0], [b1, bv0], [b1, bv1], [b0, bv1]]);
        quad(P(-hw, hh, off + 0.02), P(hw, hh, off + 0.02), P(hw, hh, zb), P(-hw, hh, zb), [0, 1, 0], WIN ? white : cBack, W4);
        quad(P(hw, -hh, off + 0.02), P(-hw, -hh, off + 0.02), P(-hw, -hh, zb), P(hw, -hh, zb), [0, -1, 0], cBack, W4);
        [-1, 1].forEach(sx => { const n = [sx * c, 0, -sx * sn], zA = sx < 0 ? zb : off + 0.02, zB = sx < 0 ? off + 0.02 : zb;   // обход против часовой снаружи
          quad(P(sx * hw, -hh, zA), P(sx * hw, -hh, zB), P(sx * hw, hh, zB), P(sx * hw, hh, zA), n, cBack, W4); });
        return;
      } else quad(P(hw, -hh, off - 0.02), P(-hw, -hh, off - 0.02), P(-hw, hh, off - 0.02), P(hw, hh, off - 0.02), nB, s.id === 'D' ? cWoodD : cBack, W4);
      quad(P(-hw, hh, off + 0.02), P(hw, hh, off + 0.02), P(hw, hh, off - 0.02), P(-hw, hh, off - 0.02), [0, 1, 0], WIN ? white : cBack, W4);
    });
    // валуны у кармана и камень тура (камень — в инстансах валунов ниже)
    {
      const m = bkP.mesh(vcMat); m.castShadow = HI; m.receiveShadow = true; m.name = 'props'; root.add(m); meshes.props = m;
      const sm2 = HI ? toon('#FFFFFF', { map: SIGN.tex, vertexColors: true }) : cheap({ map: SIGN.tex });
      const ms = bkS.mesh(sm2, true); ms.name = 'signs'; ms.castShadow = HI; root.add(ms); meshes.signs = ms;
    }

    /* ---------- ручей ---------- */
    {
      const pts = [];
      // W6: ручей — по оси лощины PLAN.stream: из выемки в скале над дорогой, под мостиком и вниз по оврагу до края ближней сетки
      const sg = RTB.stream;
      // W6++: начинается у подошвы стенки (рельеф под стенкой теперь за камнем — «выемки» над дорогой больше нет, а лента
      // по крутой стенке висела бы пластинами)
      if (sg) for (let r = sg.r + 9; r >= 300; r -= 1.5) { const x = TX + Math.sin(sg.b * D2R) * r, z = TZ + Math.cos(sg.b * D2R) * r; if (!pts.length && cliffY(x, z) !== null) continue; if (nearY(x, z) === null) { if (pts.length) break; continue; } pts.push([x, z, sg.r - r]); }
      const bk = new Bk(), cW = C(WIN ? '#C3D6E4' : '#93B4C8');
      let s = 0;
      pts.forEach((p, k) => {
        const q = pts[Math.min(pts.length - 1, k + 1)], o = pts[Math.max(0, k - 1)], dx = q[0] - o[0], dz = q[1] - o[1], L = Math.hypot(dx, dz) || 1, nx = dz / L, nz = -dx / L;
        const w = 0.3 + 0.3 * sm(0, 22, p[2]);
        const y = (nearY(p[0], p[1]) ?? farY(p[0], p[1])) + 0.16;
        if (k) s += Math.hypot(p[0] - o[0], p[1] - o[1]) * 0.5 + Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.5;
        bk.v(p[0] + nx * w, y, p[1] + nz * w, 0, 1, 0, cW, 0, s / 6); bk.v(p[0] - nx * w, y, p[1] - nz * w, 0, 1, 0, cW, 1, s / 6);
        if (k) { const a = (k - 1) * 2; bk.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const [cv, c] = cnv(32, 64); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 32, 64); c.fillStyle = 'rgba(255,255,255,1)';
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(200,225,240,1)'; c.fillRect(4 + (i * 5) % 22, i * 9, 8, 3); }
      const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping;
      const mat = keep(new T.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
      const m = bk.mesh(mat, true); m.renderOrder = 1; m.name = 'stream'; root.add(m); meshes.stream = m; meshes.streamTex = t;
    }

    /* ---------- деревья, валуны, трава ---------- */
    const R2 = rng(1010 + (WIN ? 7 : 0));
    const crownGeo = (() => { const gg = new T.SphereGeometry(1, HI ? 9 : 7, HI ? 7 : 5); const p = gg.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.1 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7) * Math.sin(z * 4.4 + 0.7) - (y < -0.4 ? 0.18 * (-y - 0.4) : 0); p.setXYZ(i, x * k, y * k, z * k); const sh = 0.78 + 0.22 * (y * 0.5 + 0.5); col.set([sh, sh, sh], i * 3); } gg.setAttribute('color', new T.BufferAttribute(col, 3)); gg.computeVertexNormals(); return keep(gg); })();
    const trunkGeo = (() => { const gg = new T.CylinderGeometry(0.12, 0.2, 1, 6); gg.translate(0, 0.5, 0); const col = new Float32Array(gg.attributes.position.count * 3).fill(1); gg.setAttribute('color', new T.BufferAttribute(col, 3)); return keep(gg); })();
    const bareGeo = (() => {
      const bk = new Bk(), w = C('#FFFFFF');
      bk.geo(GCy6, mtx(0, 1.4, 0, 0, 0.13, 2.8, 0.13), w);
      for (let k = 0; k < 5; k++) { const a = k * 1.3, h = 1.6 + k * 0.32, L = 1.4 - k * 0.12; bk.geo(GCy6, mtx(Math.sin(a) * L * 0.42, h + L * 0.38, Math.cos(a) * L * 0.42, a, 0.05, L, 0.05, 0.85, 0), w); }
      if (WIN) [[0, 2.85, 0, 0.24]].forEach(([x, y, z, r]) => bk.geo(GCy6, mtx(x, y, z, 0, r, 0.06, r), C('#FFFFFF')));
      const gg = bk.mesh(vcMat).geometry; return gg;
    })();
    const trees = [];
    const tryTree = (x, z, s, kind) => {
      const y = ground(x, z); trees.push({ x, y, z, s, c: kind });
    };
    {
      let tries = 0;
      while (trees.length < Q.trees && tries < Q.trees * 40) {
        tries++;
        const a = Math.floor(R2() * (NA - 1)), b = Math.floor(R2() * (NB - 1));
        if (!NG.act[a + b * (NA - 1)]) continue;
        const rr = NG.r0 + (a + R2()) * g, vv = NG.v0 + (b + R2()) * g, xz = RV2XZ(rr, vv);
        if (onRoad(xz[0], xz[1], 3.2)) continue;
        // W6++: не на скальной стенке (рельеф под ней теперь за камнем — уклон по nearY там ничего не значит) и не у лавочек
        // (вид на долину и тур на камне у смотровой не загорожены кроной)
        if (cliffY(xz[0], xz[1]) !== null && CAJ <= CNR) continue;
        if (BENCHES.some(b => Math.hypot(xz[0] - b.x, xz[1] - b.z) < (b.k ? 9 : 14))) continue;
        const ny = (() => { const h0 = nearY(xz[0], xz[1]), h1 = nearY(xz[0] + 1, xz[1]), h2 = nearY(xz[0], xz[1] + 1); if (h0 === null || h1 === null || h2 === null) return 0; const gx = h1 - h0, gz = h2 - h0; return 1 / Math.sqrt(1 + gx * gx + gz * gz); })();
        if (ny < 0.74) continue;
        const gully = vnoise(xz[0] * 0.05 + 11, xz[1] * 0.05 - 4);
        if (R2() > 0.25 + gully * 0.9) continue;
        if (RTB.stream && Math.abs(Math.hypot(xz[0] - TX, xz[1] - TZ) * (Math.atan2(xz[0] - TX, xz[1] - TZ) / D2R - RTB.stream.b) * D2R) < 2.5) continue;
        tryTree(xz[0], xz[1], 0.8 + R2() * 0.55, Math.floor(R2() * 4));
      }
      // деревья у села (запад и низ), видны с дороги и со смотровой. W6++: только при запасном силуэте села — у настоящего
      // (kubachi.distant, VSINK) свой рельеф и свои кроны, а эти деревья стояли под его землёй (видны были одни макушки)
      if (!VSINK) {
        for (let k = 0; k < 34; k++) {
          const a = -0.95 + R2() * 0.7, r = 26 + R2() * 46, x = r * Math.sin(a), z = CZ - r * Math.cos(a);
          const rw = rowOf(r); if (rw >= 0 && a > ROWS[rw][1] - 0.04) continue;
          tryTree(x, z, 0.9 + R2() * 0.5, Math.floor(R2() * 4));
        }
        for (let k = 0; k < 22; k++) { const d = 80 + R2() * 170, a = (R2() - 0.5) * 0.5; tryTree(-11 + Math.sin(a + 0.04) * d + (R2() - 0.5) * 30, -15 + Math.cos(a + 0.04) * d, 1 + R2() * 0.4, Math.floor(R2() * 4)); }
      }
    }
    {
      const LEAF = [C(PAL.leafA), C(PAL.leafB), C(PAL.leafC), C(PAL.leafD)], trunkC = C(PAL.trunk), bareC = C(PAL.bareBranch || '#8A7A6A');
      const instMat = cheapVC;
      if (!WIN) {
        const ic = new T.InstancedMesh(crownGeo, instMat, trees.length), it = new T.InstancedMesh(trunkGeo, instMat, trees.length);
        trees.forEach((t, k) => {
          const cr = 1.5 * t.s, th = 1.9 * t.s;
          ic.setMatrixAt(k, mtx(t.x, t.y + th + cr * 0.62, t.z, R2() * 6, cr, cr * 0.92, cr)); ic.setColorAt(k, LEAF[t.c].clone().multiplyScalar(0.92 + R2() * 0.14));
          it.setMatrixAt(k, mtx(t.x, t.y - 0.25, t.z, 0, t.s, th + 0.6, t.s)); it.setColorAt(k, trunkC);
        });
        [ic, it].forEach(m => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = HI; m.receiveShadow = false; });
        ic.name = 'crowns'; it.name = 'trunks'; meshes.crowns = bakeInst(ic); meshes.trunks = bakeInst(it); root.add(meshes.crowns); root.add(meshes.trunks);
      } else {
        const ib = new T.InstancedMesh(bareGeo, instMat, trees.length);
        trees.forEach((t, k) => { ib.setMatrixAt(k, mtx(t.x, t.y - 0.2, t.z, R2() * 6, t.s, t.s * 1.05, t.s)); ib.setColorAt(k, bareC.clone().multiplyScalar(0.9 + R2() * 0.2)); });
        ib.instanceMatrix.needsUpdate = true; ib.instanceColor.needsUpdate = true; ib.frustumCulled = false; ib.castShadow = HI; ib.name = 'bare'; meshes.bare = bakeInst(ib); root.add(meshes.bare);
      }
      // валуны: у дороги, на склоне, у смотровой, камень тура
      const rockGeo = (() => { const gg = new T.DodecahedronGeometry(1, 0); /* уже без индексов (r149) */ gg.computeVertexNormals(); const nn = gg.attributes.normal, col = new Float32Array(nn.count * 3); for (let i = 0; i < nn.count; i++) { const up = nn.getY(i); const v = WIN && up > 0.55 ? 1.25 : 0.86 + 0.14 * up; col.set([v, v, v], i * 3); } gg.setAttribute('color', new T.BufferAttribute(col, 3)); return keep(gg); })();
      const rocks = [];
      const ROCKC = [C(PAL.rock), C(PAL.rock2), C('#B2AC9F')];
      let tries = 0;
      while (rocks.length < Q.rocks && tries < Q.rocks * 30) {
        tries++;
        const i = Math.floor(R2() * N), sd = R2() < 0.5 ? 1 : -1, s = 0.35 + R2() * R2() * 1.4, foot = sd < 0 && cliffInfo[i * 3 + 1] > 0;
        // W6++: со стороны стенки — осыпь у подошвы (камень наполовину в стенке), а не на крутой стенке, где ground() на
        // внутренней стороне поворотов был на 5–10 м выше камня; высота — по земле у подошвы (обочина)
        const W = foot ? cliffInfo[i * 3] - 0.25 + s * 0.35 : (sd > 0 ? SWL[i] : SWR[i]) + 1.2 + R2() * 7;
        const x = R.x[i] + R.lx[i] * sd * W, z = R.z[i] + R.lz[i] * sd * W;
        if (onRoad(x, z, 0.9)) continue;
        const Wg = foot ? Math.min(W, cliffInfo[i * 3] - 0.3) : W, yg = ground(R.x[i] + R.lx[i] * sd * Wg, R.z[i] + R.lz[i] * sd * Wg);
        // у выступа стенки камень целиком уходил в скалу (лишняя геометрия): передний край камня должен быть перед камнем стенки
        if (foot) { const ef = W - s * 0.7, cy = cliffY(R.x[i] - R.lx[i] * ef, R.z[i] - R.lz[i] * ef); if (cy !== null && cy > yg + s * 0.3) continue; }
        rocks.push({ x, y: yg - s * 0.25, z, s, sy: 0.55 + R2() * 0.3 });
      }
      // у лавочек: по два валуна по бокам (у смотровой — крупнее), лавочка между ними, лицом к долине
      BENCHES.forEach(b => { const big = b.k === 0, sz = big ? 0.5 : 0.36; [big ? -1.6 : -1.45, big ? 1.6 : 1.45].forEach(dx => { const ry = b.ry, x = b.x + Math.cos(ry) * dx + Math.sin(ry) * (big ? 0.9 : 0.3), z = b.z - Math.sin(ry) * dx + Math.cos(ry) * (big ? 0.9 : 0.3); rocks.push({ x, y: b.y - 0.05, z, s: sz, sy: 0.7 }); colliders.push({ type: 'circle', x, z, r: sz, kind: 'rock' }); }); });
      // камень тура — у верхнего края кармана
      const tI = Math.min(N - 1, iPk + 5), tW = (outSide > 0 ? SWL[tI] : SWR[tI]) - 0.75;
      const turP = { x: R.x[tI] + R.lx[tI] * outSide * tW, z: R.z[tI] + R.lz[tI] * outSide * tW };
      // W6++: тур висел над камнем на ≈ 0,24 м (стоял на +1,25, а верх камня — ребро, ниже по бокам). Камень развёрнут ребром
      // вдоль тура, высота — по настоящей поверхности камня под четырьмя копытами
      const turRy = Math.atan2(benchP.x - turP.x, benchP.z - turP.z) + PI / 2 * pocketSide;
      const turRock = { x: turP.x, y: R.y[tI] + 0.1, z: turP.z, s: 1.25, sy: 0.92, flat: true, ry: turRy };
      rocks.push(turRock);
      {
        const M = mtx(turRock.x, turRock.y, turRock.z, turRy, 1.25 * 1.1, 1.25 * 0.92, 1.25 * 0.95), P = rockGeo.attributes.position, v = new T.Vector3(), Q3 = [];
        for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(M); Q3.push(v.x, v.y, v.z); }
        const topAt = (x, z) => { let best = -Infinity; for (let t = 0; t < Q3.length; t += 9) { const ax = Q3[t], az = Q3[t + 2], bx = Q3[t + 3], bz = Q3[t + 5], cx = Q3[t + 6], cz = Q3[t + 8], d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue; const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w2 = 1 - w0 - w1; if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue; best = Math.max(best, w0 * Q3[t + 1] + w1 * Q3[t + 4] + w2 * Q3[t + 7]); } return best; };
        const c = Math.cos(turRy), sn = Math.sin(turRy), hy = [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]].map(([hx, hz]) => topAt(turP.x + (hx * c + hz * sn) * 1.15, turP.z + (-hx * sn + hz * c) * 1.15)).filter(isFinite);
        turP.y = hy.length ? Math.min(...hy) - 0.005 : R.y[tI] + 1.05;
      }
      meshes.turRy = turRy;
      colliders.push({ type: 'circle', x: turP.x, z: turP.z, r: 1.15, kind: 'turRock' });
      meshes.turP = turP;
      const ir = new T.InstancedMesh(rockGeo, instMat, rocks.length);
      rocks.forEach((r, k) => { const ry = R2() * 6; ir.setMatrixAt(k, mtx(r.x, r.y, r.z, r.ry != null ? r.ry : ry, r.s * (r.flat ? 1.1 : 1), r.s * r.sy, r.s * (r.flat ? 0.95 : 0.9 + R2() * 0.3), r.flat ? 0 : (R2() - 0.5) * 0.4, 0)); ir.setColorAt(k, ROCKC[k % 3]); });
      ir.instanceMatrix.needsUpdate = true; ir.instanceColor.needsUpdate = true; ir.frustumCulled = false; ir.castShadow = HI; ir.receiveShadow = true; ir.name = 'rocks'; meshes.rocks = bakeInst(ir); root.add(meshes.rocks);
      // трава пучками (зимой — сухие стебли из снега, реже)
      const tuftGeo = (() => { const bk = new Bk(), w = C('#FFFFFF'), w2 = C('#D8D0B0'); for (let k = 0; k < 3; k++) { const a = k * PI / 3, ca = Math.cos(a), sa = Math.sin(a), i0 = bk.n; bk.v(-ca * 0.16, 0, sa * 0.16, 0, 1, 0, w2); bk.v(ca * 0.16, 0, -sa * 0.16, 0, 1, 0, w2); bk.v(ca * 0.03, 0.42, -sa * 0.03, 0, 1, 0, w); bk.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 1); } return bk.mesh(vcMat).geometry; })();
      const tufts = [], TC = WIN ? [C('#C8B994'), C('#B5A27E')] : [C(PAL.mown), C(PAL.grass), C(PAL.moss), C('#D3BE72')];
      const nT = WIN ? Math.round(Q.tufts * 0.4) : Q.tufts;
      tries = 0;
      while (tufts.length < nT && tries < nT * 20) {
        tries++;
        const i = Math.floor(R2() * N), sd = R2() < 0.5 ? 1 : -1, W = (sd > 0 ? SWL[i] : SWR[i]) + 0.6 + R2() * R2() * 9;
        const x = R.x[i] + R.lx[i] * sd * W, z = R.z[i] + R.lz[i] * sd * W;
        if (onRoad(x, z, 0.5)) continue;
        // W6++: на крутой скальной стенке трава не растёт (на обочине у подошвы и на канте — да)
        if (sd < 0 && cliffAt(i, W, false) !== null && CAJ <= CNR) continue;
        // и не на бровке (выпуклый перелом у края канта, у края кармана): лепестки пучка висели над обрывом. Ровный склон
        // любой крутизны годится — проверяется только излом (середина выше среднего по трём точкам вокруг)
        const y = ground(x, z);
        let ym = 0; for (let t = 0; t < 3; t++) ym += ground(x + 0.3 * Math.cos(t * 2.09), z + 0.3 * Math.sin(t * 2.09)) / 3;
        if (y - ym > 0.12) continue;
        tufts.push([x, y - 0.03, z, 0.7 + R2() * 0.9]);
      }
      const itf = new T.InstancedMesh(tuftGeo, instMat, Math.max(1, tufts.length));
      tufts.forEach(([x, y, z, s], k) => { itf.setMatrixAt(k, mtx(x, y, z, R2() * 6, s, s * (0.8 + R2() * 0.6), s)); itf.setColorAt(k, TC[k % TC.length]); });
      itf.count = tufts.length; itf.instanceMatrix.needsUpdate = true; if (itf.instanceColor) itf.instanceColor.needsUpdate = true; itf.frustumCulled = false; itf.name = 'tufts'; meshes.tufts = bakeInst(itf); root.add(meshes.tufts);
    }

    /* ---------- село вдали: из VILLAGE.regions.kubachi.distant(), пока его нет — свой силуэт (2 вызова) ---------- */
    const VLOD_DATA = [-20.3,5.2,-4.8,7,6,7.2,0.2,1,1,1,1,-42.4,13.2,-4.8,4.9,6,4.8,0.5,1,0,0,0,-37.2,10.8,-4.8,6.7,6,4.8,0.4,1,1,1,1,-27.6,7.2,-4.8,8.1,6,4.8,0.3,0,1,1,0,-14.9,4.2,-4.8,4,6,4.8,0.2,0,3,0,1,-10.4,3.6,-4.8,5.2,6,4.8,0.1,0,0,0,1,-4.6,3.5,-4.8,6.4,6.7,4.8,0.1,0,0,0,1,1.3,3,-4.8,5.6,6,4.8,0,0,0,3,0,9.4,3.7,-4.8,7.1,6,4.8,-0.1,5,0,0,1,14.4,4.7,-4.8,3.8,6,4.8,-0.2,4,1,1,0,20.6,5.6,-4.8,8,6,4.8,-0.2,1,0,2,0,27,7.8,-4.8,4.8,6,7.2,-0.3,0,0,2,1,32.7,10.3,-4.8,6.7,6,4.8,-0.4,0,0,0,1,37.9,12.3,-4.8,4.8,6.9,7.2,-0.4,0,4,2,1,-38.9,21.3,-9.6,7,4.9,4.8,0.5,0,1,1,0,-31.4,17.6,-9.6,6.5,4.9,4.8,0.4,0,0,0,1,-24.6,15.2,-9.6,6.5,4.9,6,0.3,0,2,0,1,-17.6,13.3,-9.6,7.1,4.9,4.8,0.2,0,1,1,0,-10.4,12.1,-9.6,6.8,4.9,4.8,0.1,1,2,0,1,-4.5,11.6,-9.6,4.6,4.9,6,0.1,2,1,1,0,1.6,11.5,-9.6,6.5,4.9,7.2,0,0,0,3,1,7.8,11.8,-9.6,4.8,4.9,6,-0.1,0,1,1,0,13.6,12.6,-9.6,6.3,4.9,7.2,-0.2,4,2,0,1,19.8,13.9,-9.6,6.1,4.9,4.8,-0.2,0,3,0,0,25.9,15.7,-9.6,6.5,4.9,6,-0.3,1,0,0,1,32.2,18.4,-9.6,6.8,4.9,4.8,-0.4,2,0,2,1,37.6,21.2,-9.6,5.2,4.9,4.8,-0.5,0,1,1,0,-34.4,26.8,-14.4,6.9,6,4.8,0.5,6,0,0,1,-27.4,23.6,-14.4,7,6,4.8,0.4,0,0,0,0,-21.4,21.8,-14.4,4.8,6,6,0.3,0,1,1,1,-15.6,20.5,-14.4,6.2,6,6,0.2,2,1,1,1,-8.8,19.6,-14.4,7.1,6,4.8,0.1,0,0,3,1,-2.8,19.1,-14.4,4.8,6,4.8,0,3,0,0,0,2.6,19.2,-14.4,6,6,4.8,0,0,1,1,1,8.8,19.6,-14.4,6.3,6,4.8,-0.1,1,0,0,1,14.3,20.4,-14.4,4.4,6,4.8,-0.2,1,2,0,0,20.2,21.8,-14.4,7.1,6,4.8,-0.3,0,5,0,1,26.5,23.8,-14.4,5.8,6,4.8,-0.3,0,1,1,0,32,26.3,-14.4,5.7,6,6,-0.4,2,0,0,1,37,29.1,-14.4,5.6,6,7.2,-0.5,0,3,2,1,-26.9,32.4,-19.2,6.8,4.9,4.8,0.4,0,1,1,0,-20.2,29.9,-19.2,7.2,4.9,6,0.3,1,0,0,1,-12.6,28.4,-19.2,7.4,4.9,4.8,0.2,4,1,1,1,-5.7,27.7,-19.2,6.6,4.9,7.2,0.1,0,0,0,1,1.5,27.5,-19.2,7,4.9,4.8,0,0,1,1,0,9.8,28.1,-19.2,6.5,4.9,6,-0.1,7,2,0,1,15.4,29.1,-19.2,4.8,4.9,4.8,-0.2,0,0,3,0,21.2,30.6,-19.2,6.9,4.9,7.2,-0.3,2,1,1,1,27.4,32.9,-19.2,5.6,4.9,4.8,-0.4,0,4,0,1,33.2,36,-19.2,6.3,4.9,4.8,-0.5,5,0,0,0,-19.5,37.6,-24,6.1,6,4.8,0.3,0,1,1,1,-12.8,36.1,-24,7.1,6,4.8,0.2,0,0,0,0,-5.3,35.3,-24,7.6,6,6,0.1,1,2,0,1,2,35.1,-24,6.8,6,4.8,0,0,1,1,1,9.4,35.6,-24,7.8,6,7.2,-0.1,3,0,0,1,16.7,36.6,-24,6.6,6,4.8,-0.2,0,0,2,0,23,38.3,-24,5.6,6,6,-0.3,1,0,0,1,28.9,40.5,-24,6.5,6,4.8,-0.4,0,3,0,0,34.1,43.4,-24,5.5,6,4.8,-0.5,4,1,1,1,-12.5,43.3,-28.8,6.7,4.9,4.8,0.2,0,0,0,1,-5.1,42.4,-28.8,7.8,4.9,4.8,0.1,0,1,1,0,2.6,42.2,-28.8,7.1,4.9,6,0,2,0,0,1,9.6,42.7,-28.8,6.6,4.9,4.8,-0.1,0,1,1,1,16.1,43.7,-28.8,6.4,4.9,7.2,-0.2,1,5,2,0,22.4,45.3,-28.8,6.4,4.9,4.8,-0.3,0,0,0,1,28.3,47.6,-28.8,5.4,4.9,4.8,-0.4,0,1,1,0,32.9,50.4,-28.8,4.4,4.9,4.8,-0.5,3,0,0,1,-0.5,50.3,-33.6,6.4,6,4.8,0,0,1,1,1,6.9,50.6,-33.6,8.1,6,6,-0.1,0,0,0,1,14.3,51.6,-33.6,6.9,6,4.8,-0.2,1,2,0,0,20.6,53.2,-33.6,6.2,6,4.8,-0.3,0,0,2,1,26.4,55.4,-33.6,5.6,6,6,-0.4,4,1,1,1,31.1,58,-33.6,4.4,6,4.8,-0.5,0,3,0,0,10,58.7,-38.4,6.2,6,4.8,-0.1,0,0,0,1,22.6,61.8,-38.4,5.6,6,6,-0.4,1,1,1,0,15.6,66.4,-43.2,5.5,6,4.8,-0.4,0,0,0,1,15.4,-12.9,0,10,5,5.2,-0.1,8,1,1,0,-1,-7,0,5.5,5,4.8,1.6,1,4,0,0,-14.2,69.1,-47.3,5.3,5.5,4.8,0,0,0,0,0,-3.4,72.5,-48.9,4.8,5.2,4.8,0,1,4,0,0,-12.5,80.3,-50.2,5.6,5.4,7.2,0,0,0,0,0,-1.8,84.4,-52.1,5.1,5.1,4.8,0,2,2,0,0,-14.6,92.2,-53.4,4.9,5.6,4.8,0,0,0,0,0,-5,96.1,-55.3,5.4,5.3,4.8,0,0,4,0,0,-11.8,104.4,-56.7,5.1,5.1,4.8,0,1,0,0,0,-1.4,108.3,-58.8,4.9,5.2,7.2,0,0,0,0,0,-13.8,116.1,-59.7,5.6,5.6,4.8,0,2,2,0,0,-4.5,120.4,-61.9,4.8,5,4.8,0,0,0,0,0,-11.2,128.6,-63.3,5.5,5.5,4.8,0,0,4,0,0,-1.1,132.2,-65.2,5.2,5.2,4.8,0,1,0,0,0,-13.1,140.4,-66.3,5,5.3,4.8,0,0,0,0,0,-3.8,144.6,-68.4,5.4,5.1,4.8,0,2,3,0,0,-10.7,152.3,-69.5,5.6,5.6,7.2,0,0,0,0,0,-0.4,156.5,-71.6,4.8,5.3,4.8,0,0,4,0,0,-12.6,164.3,-72.7,5.2,5,4.8,0,1,0,0,0,-3.2,168.4,-74.7,5.6,5.4,4.8,0,0,0,0,0,-10.1,176.5,-75.8,5,5.5,4.8,0,2,2,0,0,0.2,180.3,-77.9,5.4,5.2,4.8,0,0,0,0,0,-11.9,188.2,-79,5.3,5.1,4.8,0,0,4,0,0,-2.6,192.6,-80.9,4.9,5.6,4.8,0,1,0,0,0,-9.4,200.4,-82.1,5.6,5.3,4.8,0,0,0,0,0,0.9,204.2,-84.2,5.1,5,7.2,0,2,3,0,0,-11.3,212.1,-85.3,5.5,5.4,4.8,0,0,0,0,0,-1.9,216.5,-87.3,4.8,5.5,4.8,0,0,4,0,0,-8.8,224.3,-88.5,5.2,5.2,4.8,0,1,0,0,0,1.5,228.1,-90.5,5.6,5.1,4.8,0,0,0,0,0,-10.6,236.2,-91.6,5,5.6,4.8,0,2,2,0,0,44.1,14.1,-4.8,4.4,6,4.8,-0.5,0,0,0,0,49.2,17.4,-6.9,5.6,6,4.8,-0.6,1,4,0,0,53.6,21.7,-9.7,4.9,6,4.8,-0.6,0,0,0,0,43.6,22.4,-9.6,5.2,6,4.8,-0.5,2,2,0,0,48.2,26.4,-12.3,5.4,6,7.2,-0.6,0,0,0,0,52.5,30.9,-15.2,4.8,6,4.8,-0.7,0,4,0,0,42.3,30.7,-14.4,5.6,6,4.8,-0.5,1,0,0,0,46.6,34.9,-17.3,5,6,4.8,-0.6,0,0,0,0,50.6,39.4,-20.2,5.3,6,4.8,-0.7,2,3,0,0,40.6,39.3,-19.2,4.6,6,4.8,-0.5,0,0,0,0,44.5,43.6,-22.1,5.5,6,4.8,-0.6,0,4,0,0,48.2,48.2,-25,5.2,6,7.2,-0.7,1,0,0,0,38.5,47.8,-24,4.9,6,4.8,-0.6,0,0,0,0,42.1,52.3,-26.9,5.6,6,4.8,-0.7,2,2,0,0,45.6,56.9,-29.8,4.8,6,4.8,-0.7,0,0,0,0,36.2,56.2,-28.8,5.3,6,4.8,-0.6,0,4,0,0,39.6,60.8,-31.7,5,6,4.8,-0.7,1,0,0,0,42.7,65.6,-34.6,5.4,6,4.8,-0.8,0,0,0,0,33.7,64.4,-33.6,5.1,6,7.2,-0.6,2,3,0,0,36.8,69.1,-36.5,5.6,6,4.8,-0.7,0,0,0,0,39.6,74,-39.4,4.7,6,4.8,-0.8,0,4,0,0,30.9,72.4,-38.4,5.5,6,4.8,-0.7,1,0,0,0,33.7,77.2,-41.3,5.2,6,4.8,-0.7,0,0,0,0,36.2,82.2,-44.2,4.9,6,4.8,-0.8,2,2,0,0,28.2,80.4,-43.2,5.4,6,4.8,-0.7,0,0,0,0,30.6,85.3,-46.1,5,6,7.2,-0.8,0,4,0,0,32.8,90.4,-49,5.6,6,4.8,-0.8,1,0,0,0,28.2,66.2,-39.6,2.3,1.8,2,-0.7,0,0,2,0,-24.4,54.9,-38.4,2.4,2.3,2,0.4,0,4,2,0,-31.1,50.1,-33.6,2.6,2,2,0.5,0,2,2,0,-12.4,62.3,-43.2,2,2.2,2,0.2,0,0,2,0,-37.6,38.6,-26.4,2.2,1.9,2,0.6,0,4,2,0,-20.1,45.2,-33.6,2.5,2.1,2,0.3,0,0,2,0,-4.4,64.8,-44.4,2.1,2,2,0.1,0,2,2,0,38.4,70.2,-40.8,2.3,2.3,2,-0.7,0,4,2,0,-28.3,61.8,-40.8,2.4,1.8,2,0.4,0,0,2,0,16.9,72.1,-44.4,2,2.1,2,-0.3,0,4,2,0];
    let vlod = null, realDistant = null;
    function buildVillageLOD() {
      const WALLC = ['#B5AC9C', '#BFAF90', PAL.cream, PAL.ochre || '#CDB48A', PAL.blue, PAL.pink, PAL.white, PAL.lilac, PAL.creamPlain].map(h => C(h));   // polish: камень светлее, как у настоящего села вдали
      const ROOFC = [PAL.silver, PAL.yard, '#B9B3A6', PAL.red, PAL.rust, PAL.slate].map(h => C(WIN ? '#F2F5F8' : h));
      const fac = (() => {
        const [cv, c] = cnv(64, 64); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#3A4650';
        [[13, 26], [42, 26]].forEach(([x, y]) => c.fillRect(x, y, 10, 15)); c.fillStyle = '#F4F2EE'; c.fillRect(0, 0, 64, 6);
        const t = keep(new T.CanvasTexture(cv)); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
      })();
      const bw = new Bk(), br = new Bk(), rr = rng(3);
      const cGal = C('#44546A'), cGalF = C('#DDE3E6');
      for (let q = 0; q < VLOD_DATA.length; q += 11) {
        const [x, z, y0, w, d, h, ry, wi, ri, rt, gal] = VLOD_DATA.slice(q, q + 11);
        const cs = Math.cos(ry), sn = Math.sin(ry), P = (lx, ly, lz) => [x + lx * cs + lz * sn, y0 + ly, z - lx * sn + lz * cs];
        const wc = WALLC[wi].clone().multiplyScalar(0.94 + rr() * 0.1), hw = w / 2, hd = d / 2, yb = VSINK ? -9 : -3;   // под селом склон опущен (VSINK) — стены до земли
        const faceQ = (bk, a, b, c2, dd, n, col, uw) => { const i0 = bk.n; const L = Math.hypot(b[0] - a[0], b[2] - a[2]); [[a, 0, a[1] - y0], [b, L, b[1] - y0], [c2, L, c2[1] - y0], [dd, 0, dd[1] - y0]].forEach(([p, u, v]) => bk.v(p[0], p[1], p[2], n[0], n[1], n[2], col, u / 3.6, v / 2.4)); bk.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
        const nF = [sn, 0, cs], nB = [-sn, 0, -cs], nR = [cs, 0, -sn], nL = [-cs, 0, sn];
        faceQ(bw, P(-hw, yb, hd), P(hw, yb, hd), P(hw, h, hd), P(-hw, h, hd), nF, wc);
        faceQ(bw, P(hw, yb, -hd), P(-hw, yb, -hd), P(-hw, h, -hd), P(hw, h, -hd), nB, wc.clone().multiplyScalar(0.92));
        faceQ(bw, P(hw, yb, hd), P(hw, yb, -hd), P(hw, h, -hd), P(hw, h, hd), nR, wc.clone().multiplyScalar(0.96));
        faceQ(bw, P(-hw, yb, -hd), P(-hw, yb, hd), P(-hw, h, hd), P(-hw, h, -hd), nL, wc.clone().multiplyScalar(0.96));
        // галерея: тёмная лента под крышей по фасаду + светлая планка рамы
        if (gal && h >= 4.6) { const a = P(-hw + 0.3, h - 1.75, hd + 0.06), b = P(hw - 0.3, h - 1.75, hd + 0.06), c2 = P(hw - 0.3, h - 0.3, hd + 0.06), dd = P(-hw + 0.3, h - 0.3, hd + 0.06); const i0 = br.n; [a, b, c2, dd].forEach(p => br.v(p[0], p[1], p[2], nF[0], 0.2, nF[2], cGal)); br.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
          const a2 = P(-hw + 0.3, h - 1.9, hd + 0.08), b2 = P(hw - 0.3, h - 1.9, hd + 0.08), c3 = P(hw - 0.3, h - 1.72, hd + 0.08), d3 = P(-hw + 0.3, h - 1.72, hd + 0.08); const i1 = br.n; [a2, b2, c3, d3].forEach(p => br.v(p[0], p[1], p[2], nF[0], 0.3, nF[2], cGalF)); br.I.push(i1, i1 + 1, i1 + 2, i1, i1 + 2, i1 + 3); }
        // крыша: светлая «шапка»
        const rc = ROOFC[ri].clone().multiplyScalar(0.95 + rr() * 0.08), ov = rt === 1 ? 0.1 : 0.45;
        const c00 = P(-hw - ov, h + 0.05, -hd - ov), c10 = P(hw + ov, h + 0.05, -hd - ov), c11 = P(hw + ov, h + 0.05, hd + ov), c01 = P(-hw - ov, h + 0.05, hd + ov);
        const tri = (a, b, c2, col) => { const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c2[0] - a[0], by = c2[1] - a[1], bz = c2[2] - a[2]; let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; const i0 = br.n; [a, b, c2].forEach(p => br.v(p[0], p[1], p[2], nx / l, ny / l, nz / l, col)); br.I.push(i0, i0 + 1, i0 + 2); };
        if (rt === 0) { const ap = P(0, h + 0.95, 0); tri(c01, c11, ap, rc); tri(c11, c10, ap, rc.clone().multiplyScalar(0.94)); tri(c10, c00, ap, rc.clone().multiplyScalar(0.88)); tri(c00, c01, ap, rc.clone().multiplyScalar(0.94)); }
        else if (rt === 2) { const b0 = P(-hw - ov, h + 0.7, -hd - ov), b1 = P(hw + ov, h + 0.7, -hd - ov); tri(c01, c11, b1, rc); tri(c01, b1, b0, rc); }
        else if (rt === 3) { const r0 = P(-hw - ov, h + 0.8, 0), r1 = P(hw + ov, h + 0.8, 0); tri(c01, c11, r1, rc); tri(c01, r1, r0, rc); tri(c10, c00, r0, rc.clone().multiplyScalar(0.9)); tri(c10, r0, r1, rc.clone().multiplyScalar(0.9)); tri(c11, c10, r1, wc); tri(c00, c01, r0, wc); }
        else { tri(c01, c11, c10, rc); tri(c01, c10, c00, rc); }
      }
      // башня: ствол 16 граней, пояс, 24 зубца, окна; бугор
      {
        const tc = C(PAL.tower), tw = (WIN ? C('#FFFFFF') : tc), cx = TOWER.x, cz = TOWER.z, y0 = TOWER.y0;
        const cyl = (r0, r1, ya, yb2, seg, col) => { for (let i = 0; i < seg; i++) { const a = i / seg * PI * 2, b = (i + 1) / seg * PI * 2, am = (a + b) / 2; const p = [[cx + Math.sin(a) * r0, ya, cz + Math.cos(a) * r0], [cx + Math.sin(b) * r0, ya, cz + Math.cos(b) * r0], [cx + Math.sin(b) * r1, yb2, cz + Math.cos(b) * r1], [cx + Math.sin(a) * r1, yb2, cz + Math.cos(a) * r1]]; const sh = 0.86 + 0.14 * Math.cos(am - 3.9); const i0 = br.n; p.forEach((q, k) => br.v(q[0], q[1], q[2], Math.sin(k === 1 || k === 2 ? b : a), 0, Math.cos(k === 1 || k === 2 ? b : a), col.clone().multiplyScalar(sh))); br.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); } };
        cyl(3.0, 2.72, y0 - 3, y0 + 11.6, 16, tc);
        cyl(2.84, 2.84, y0 + 11.6, y0 + 11.9, 16, tc.clone().multiplyScalar(0.9));
        cyl(2.75, 2.75, y0 + 11.9, y0 + 12.62, 16, tc);
        { const i0 = br.n; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; br.v(cx + Math.sin(a) * 2.75, y0 + 12.62, cz + Math.cos(a) * 2.75, 0, 1, 0, tc.clone().multiplyScalar(0.8)); } for (let i = 1; i < 15; i++) br.I.push(i0, i0 + i, i0 + i + 1); }
        for (let k = 0; k < 20; k++) { const a = (k + 0.5) / 20 * PI * 2, r = 2.62; const m = mtx(cx + Math.sin(a) * r, y0 + 12.62 + 0.19, cz + Math.cos(a) * r, a, 0.42, 0.38, 0.3); const gg = GB.clone(); gg.applyMatrix4(m); const p = gg.attributes.position, nn = gg.attributes.normal, i0 = br.n; for (let i = 0; i < p.count; i++) br.v(p.getX(i), p.getY(i), p.getZ(i), nn.getX(i), nn.getY(i), nn.getZ(i), nn.getY(i) > 0.5 ? tw : tc); const ix = gg.index.array; for (let i = 0; i < ix.length; i++) br.I.push(ix[i] + i0); gg.dispose(); }
        const wc = C('#2B2622');
        ((V.regions.kubachi && V.regions.kubachi.data && V.regions.kubachi.data.TOWER.windows) || [[-55, 9.9], [-22, 7.0], [18, 10.5], [62, 8.3]]).map(([az, hy]) => [az * PI / 180, hy]).forEach(([a, y]) => { const r = 3.0 - (y / 11.6) * 0.28 + 0.03, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, c2 = Math.cos(a), s2 = Math.sin(a); const hw = 0.17, hh = y === 5.9 ? 0.2 : 0.25; const P = (lx, ly) => [x + lx * c2, y0 + y + ly, z - lx * s2]; const i0 = br.n; [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)].forEach(p => br.v(p[0], p[1], p[2], s2, 0, c2, wc)); br.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); });
        const kg = new T.DodecahedronGeometry(1, 1); kg.applyMatrix4(mtx(cx, y0 - 3.6, cz + 0.6, 0.3, 4.6, 2.6, 4.0)); const p = kg.attributes.position, nn = kg.attributes.normal, i0 = br.n, rc = C(WIN ? '#E9EEF3' : PAL.rock);
        for (let i = 0; i < p.count; i++) br.v(p.getX(i), p.getY(i), p.getZ(i), nn.getX(i), nn.getY(i), nn.getZ(i), rc); for (let i = 0; i < p.count; i++) br.I.push(i0 + i); kg.dispose();
      }
      const g1 = bw.mesh(cheap({ map: fac }), true), g2 = br.mesh(cheap());
      const grp = new T.Group(); grp.name = 'villageLOD'; grp.add(g1); grp.add(g2); g1.castShadow = g2.castShadow = false;
      return grp;
    }
    function tryReal() {
      const K = V.regions.kubachi;
      if (!K || typeof K.distant !== 'function') return false;
      try {
        const obj = K.distant(T, season, { named, quality });
        if (!obj || !obj.isObject3D) return false;
        realDistant = obj; obj.name = obj.name || 'villageDistant'; root.add(obj);
        return true;
      } catch (e) { console.warn('serpentine: kubachi.distant failed, keeping placeholder', e); return false; }
    }
    // настоящее село вдали (kubachi.distant: 7 вызовов, ~52 тыс. тр. — легче вида в самом селе) и запасной силуэт (2 вызова);
    // setVillageDetail(false) — силуэт для совсем слабых устройств
    vlod = buildVillageLOD(); root.add(vlod); tryReal();
    let villageFull = true;
    // вершина: отель на горе к востоку-северо-востоку от села (VILLAGE.regions.hotel.distant) — гору с площадками рисует свой
    // рельеф (natY с горой), поэтому без холма, стены с цоколем; корпус, башня, стартовая вышка с флажком и трос в село
    // (≈ 1,4 тыс. тр., 4 вызова; виден над облаками, как село)
    let hotelFar = null;
    if (V.regions.hotel && typeof V.regions.hotel.distant === 'function') {
      try { hotelFar = V.regions.hotel.distant(T, season, { hill: false, foot: 2.5 }); hotelFar.traverse(m => { m.castShadow = false; m.receiveShadow = false; }); root.add(hotelFar); } catch (e) { console.warn('serpentine: hotel distant', e); hotelFar = null; }
    }

    /* ---------- облака: море облаков (2–3 слоя) и облачные клубы у склона ---------- */
    // W6+ (скрин автора с телефона): плоская пелена на CLOUD_TOP, когда дорога ныряет в облако, резала кадр ровной белой
    // кромкой и накрывала полотно и машину (камера уже над пеленой, машина — ещё под ней), а в щели у скалы просвечивала белым.
    // Теперь у пелены свой шейдер: рядом с камерой её нет вовсе (до fadeR.x м), дальше она плавно густеет (к fadeR.y м) —
    // сверху «море облаков» вдали остаётся, а у машины и на дороге ни кромки, ни белой плёнки. «Молоко» внутри облака — туман.
    const CLOUD_FADE = new T.Vector2(16, 120);
    const CLOUD_V = 'uniform vec2 rep; uniform vec2 off; varying vec2 vUv; varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv * rep + off; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}';
    const CLOUD_F = 'uniform sampler2D map; uniform vec3 color; uniform float opacity; uniform vec2 fadeR; varying vec2 vUv; varying vec3 vW;\n#include <fog_pars_fragment>\nvoid main(){ vec4 t = texture2D(map, vUv); float k = smoothstep(fadeR.x, fadeR.y, distance(vW, cameraPosition)); gl_FragColor = vec4(color * t.rgb, t.a * opacity * k);\n#include <fog_fragment>\n}';
    const clouds = [];
    {
      const layers = [[CLOUD_TOP, 0.95, 5], [CLOUD_TOP - 4, 0.75, 7], [CLOUD_TOP - 8, 0.65, 4]].slice(0, Q.clouds);
      layers.forEach(([y, op, rep], k) => {
        const u = { map: { value: cloudTex }, color: { value: C(WIN ? '#FFFFFF' : k ? '#F0F3F7' : '#FFFFFF') }, opacity: { value: op * (WIN ? 1 : 0.95) }, rep: { value: new T.Vector2(rep, rep) }, off: { value: new T.Vector2(k * 0.37, k * 0.21) }, fadeR: { value: CLOUD_FADE } };
        const mat = keep(new T.ShaderMaterial({ uniforms: T.UniformsUtils.merge([T.UniformsLib.fog]), vertexShader: CLOUD_V, fragmentShader: CLOUD_F, transparent: true, depthWrite: false, side: T.DoubleSide, fog: true }));
        Object.assign(mat.uniforms, u);   // свои uniform-ы — без копии (текстура общая, смещение двигает update)
        const m = new T.Mesh(keep(new T.PlaneGeometry(3000, 3000)), mat); m.rotation.x = -PI / 2; m.position.set(100, y, 220); m.renderOrder = 3 + k; m.name = 'cloud' + k; root.add(m);
        clouds.push({ m, u, sp: 0.0016 + k * 0.0007 });
      });
    }
    // клубы: так же тают у камеры (вблизи — по расстоянию до центра клуба), чтобы не застилать машину белым
    const puffMat = keep(new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { map: { value: null }, color: { value: C('#FFFFFF') }, opacity: { value: 0.85 } }]),
      vertexShader: 'attribute vec3 offset; attribute float size; varying vec2 vUv; varying float vNear;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0); vNear = smoothstep(0.35, 1.3, -mvPosition.z / max(size, 1.0)); mvPosition.xy += position.xy * size; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: 'uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying float vNear;\n#include <fog_pars_fragment>\nvoid main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(color * t.rgb, t.a * opacity * vNear);\n#include <fog_fragment>\n}',
      transparent: true, depthWrite: false, fog: true,
    }));
    puffMat.uniforms.map.value = puffTex;
    const puffs = [];
    {
      const pr = rng(91);
      // клубы у склона на уровне облаков, над долиной, у ворот (шторка) и в начале (туман подножия)
      for (let k = 0; k < Q.puffs; k++) {
        let x, y, z, s;
        // W6: дорога идёт по кольцу склона вокруг долины — клубы у склона и над долиной тоже по кольцу (азимут от башни)
        if (k < Q.puffs * 0.45) { const b = lerp(RTB.b0, RTB.b1, pr()), f = clamp(Math.round((b - RTB.b0) / RTB.db), 0, RTB.n - 1), r = RTB.r[f] - 30 - pr() * 34; x = TX + Math.sin(b * D2R) * r; z = TZ + Math.cos(b * D2R) * r; y = CLOUD_TOP - 3 + pr() * 5; s = 12 + pr() * 12; }
        else if (k < Q.puffs * 0.8) { const b = (-100 + pr() * 160) * D2R, d = 190 + pr() * 150; x = TX + Math.sin(b) * d; z = TZ + Math.cos(b) * d; y = CLOUD_TOP + pr() * 3; s = 18 + pr() * 18; }
        else { const s0 = pr() < 0.5 ? R.len - 2 - pr() * 6 : 2 + pr() * 4, q = road.sample(s0), fwd = s0 > R.len / 2 ? 1 : -1; x = q.x + Math.sin(q.th) * fwd * (5 + pr() * 10) + q.lx * (pr() - 0.5) * 6; z = q.z + Math.cos(q.th) * fwd * (5 + pr() * 10) + q.lz * (pr() - 0.5) * 6; y = q.y + 1 + pr() * 3; s = 9 + pr() * 6; }
        puffs.push([x, y, z, s]);
      }
      const P = [], OF = [], SZ = [], UV = [], I = [];
      puffs.forEach(([x, y, z, s], k) => { [[-0.5, -0.35], [0.5, -0.35], [0.5, 0.35], [-0.5, 0.35]].forEach(([a, b], j) => { P.push(a, b, 0); OF.push(x, y, z); SZ.push(s * 2); UV.push(j === 1 || j === 2 ? 1 : 0, j >= 2 ? 1 : 0); }); const i0 = k * 4; I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); });
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('offset', new T.Float32BufferAttribute(OF, 3)); geo.setAttribute('size', new T.Float32BufferAttribute(SZ, 1)); geo.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); geo.setIndex(I);
      geo.boundingSphere = new T.Sphere(new T.Vector3(150, -80, 250), 2000);
      const m = new T.Mesh(geo, puffMat); m.renderOrder = 6; m.frustumCulled = false; m.name = 'puffs'; root.add(m); meshes.puffs = m;
    }

    /* ---------- небо и хребты (вокруг камеры) ---------- */
    const skyU = { top: { value: C('#5E92D0') }, hor: { value: C('#CFE0F0') }, bot: { value: C('#DCE4EC') }, sunDir: { value: new T.Vector3(-0.55, 0.62, 0.56).normalize() }, sunCol: { value: C('#FFF1D8') }, sunK: { value: 1 } };
    const sky = new T.Mesh(keep(new T.SphereGeometry(1450, 32, 20)), keep(new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      // градиент и мягкий ореол солнца считаются в вершинах (пиксель — только цвет): небо дешёвое даже на программном рендере
      vertexShader: 'uniform vec3 top, hor, bot, sunDir, sunCol; uniform float sunK; varying vec3 vC; void main(){ vec3 d = normalize(position); float h = d.y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h * 1.15, 0.0, 1.0), 0.34)) : mix(hor, bot, clamp(-h * 5.0, 0.0, 1.0)); float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 8.0) * 0.16 + pow(s, 3.0) * 0.05) * sunK; vC = c; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
    })));
    sky.renderOrder = 60; sky.frustumCulled = false; sky.name = 'sky'; root.add(sky);   // последним из непрозрачных: только там, где пусто
    // polish 14.10: мягкие облака на небе над облачным морем (осенний день; зимой — только дымка), 1 вызов, едут за камерой
    const skyPuffs = V.vkit && V.vkit.skyClouds ? V.vkit.skyClouds(T, { keep, radius: 1330, count: 13, order: 62, seed: 515, az0: -20, hero: [[202, 6.4, 0.36], [190, 5.2, 0.28], [214, 7.2, 0.3], [228, 15, 0.9], [176, 12, 0.8]] }) : null;
    if (skyPuffs) { skyPuffs.userData.setMood("day", WIN); root.add(skyPuffs); }
    const ridges = [];
    [[1500, 75, 1360, 0.42, '#6F8C86'], [2400, 135, 1460, 0.64, '#7C97A2'], [3500, 210, 1560, 0.82, '#8AA3B3']].forEach(([Rt, Hm, Rr, f, base], li) => {
      const n = 180, P = [], I = [], k = Rr / Rt;
      for (let i = 0; i <= n; i++) {
        const a = i / n * PI * 2, h = Hm * (0.55 + 0.25 * Math.sin(a * 5 + li * 1.7) + 0.15 * Math.sin(a * 13 + li * 2.3) + 0.05 * Math.sin(a * 31 + li));
        P.push(Math.sin(a) * Rr, -150 * k, Math.cos(a) * Rr, Math.sin(a) * Rr, h * k, Math.cos(a) * Rr);
        if (i) { const o = (i - 1) * 2; I.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
      }
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setIndex(I);
      const mat = keep(new T.MeshBasicMaterial({ color: C(base), side: T.DoubleSide, fog: false, depthWrite: true }));
      const m = new T.Mesh(geo, mat); m.renderOrder = 50 + li; m.frustumCulled = false; m.name = 'ridge' + li; root.add(m);
      ridges.push({ m, k, f, base: C(base), snow: C('#E8EEF4') });
    });

    /* ---------- свет ---------- */
    const lights = new T.Group(); lights.name = 'serpentineLights';
    const hemi = new T.HemisphereLight(C('#CFE0F0'), C('#B9A27E'), 0.62);
    const sun = new T.DirectionalLight(C('#FFE2BE'), 0.62);
    skyU.sunDir.value.copy(SUNDIR);
    // W6++: рамка теней шире (±26 м, была ±18) и сдвинута вперёд по взгляду камеры (update), край — мягкий (SHADOW_FADE)
    const SHB = 26, SH_AHEAD = 11;
    if (Q.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -SHB, right: SHB, top: SHB, bottom: -SHB, near: 5, far: 150 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; }
    if (opts.lights !== false) { lights.add(hemi); lights.add(sun); lights.add(sun.target); root.add(lights); }

    /* ---------- снегопад (зима) ---------- */
    let snow = null;
    if (WIN) {
      const n = Q.snow, P = new Float32Array(n * 3), sr = rng(8);
      for (let i = 0; i < n; i++) { P[i * 3] = (sr() - 0.5) * 40; P[i * 3 + 1] = sr() * 22 - 4; P[i * 3 + 2] = (sr() - 0.5) * 40; }
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(P, 3));
      const mat = keep(new T.PointsMaterial({ size: 0.11, map: dotTex, transparent: true, depthWrite: false, color: C('#FFFFFF'), sizeAttenuation: true }));
      snow = new T.Points(geo, mat); snow.frustumCulled = false; snow.name = 'snow'; snow.renderOrder = 7; root.add(snow);
    }

    /* ---------- птица (парит кругами над долиной) ---------- */
    const birds = (() => {
      const geo = keep(new T.BufferGeometry()), P = new Float32Array(2 * 6 * 3);
      geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const m = new T.Mesh(geo, keep(new T.MeshBasicMaterial({ color: C('#4A4048'), side: T.DoubleSide }))); m.frustumCulled = false; m.name = 'birds'; root.add(m);
      return { m, P, list: [{ c: [150, 8, 300], r: 85, w: 0.09, ph: 0, s: 1.8 }, { c: [40, 22, 170], r: 60, w: -0.11, ph: 2, s: 1.5 }] };
    })();

    /* ---------- тур на камне у смотровой ---------- */
    const npcs = [];
    let ownKit = null, tur = null;
    // реплики тура: из общей таблицы села, если там есть 'tur', иначе свои (ROAD_LINES вверху файла)
    const pickLine = l => (typeof l === 'string' ? l : (!named && l.n ? (l.n.text || l.n) : l.text || l.a || ''));
    const turSrc = (V.LINES_SRC && Array.isArray(V.LINES_SRC.tur) && V.LINES_SRC.tur.length) ? V.LINES_SRC.tur : ROAD_LINES.tur;
    const turLines = turSrc.map(pickLine);
    if (V.SPEAKERS && !V.SPEAKERS.tur) V.SPEAKERS.tur = ROAD_SPEAKERS.tur;
    if (V.LINES_SRC && !V.LINES_SRC.tur) V.LINES_SRC.tur = ROAD_LINES.tur;   // тогда и VILLAGE.linesFor(named) отдаёт тура
    if (V.lines) V.lines.tur = turSrc.map(l => ({ who: 'tur', text: pickLine(l) }));
    function turBuild(arg, GEO, capG) {
      const { n, body, P, face, M } = arg;
      const fur = M('#9C7250'), furD = M('#7E5A42'), belly = M('#EBD9BE'), hoof = M('#4A3F4E'), horn = M('#CDBB9C'), hornD = M('#AE9A7C'), beard = M('#6E523C');
      P(body, GEO.sph, fur, [0, 0.6, -0.04], [0.3, 0.29, 0.44]);
      P(body, GEO.sph, belly, [0, 0.52, 0.02], [0.23, 0.2, 0.34], null, false);
      P(body, GEO.sph, fur, [0, 0.68, 0.24], [0.26, 0.27, 0.24]);
      [[-0.15, 0.24], [0.15, 0.24], [-0.15, -0.26], [0.15, -0.26]].forEach(([x, z]) => { P(body, capG(0.065, 0.24), furD, [x, 0.24, z]); P(body, GEO.sph, hoof, [x, 0.06, z + 0.01], [0.07, 0.05, 0.08], null, false); });
      P(body, GEO.sph, furD, [0, 0.7, -0.47], [0.06, 0.08, 0.05], null, false);
      const head = new T.Group(); head.position.set(0, 0.94, 0.38); body.add(head); n.head = head;
      P(head, GEO.sph, fur, [0, 0, 0], [0.21, 0.2, 0.21]);
      face(head, { muzzle: '#EBD9BE', muzzleW: 98, muzzleH: 62, nose: '#4A3A48', noseW: 16, noseH: 10, mouth: 'smile', er: 30, ey: 338 }, [0.21, 0.2, 0.21]);
      [-1, 1].forEach(s => P(head, GEO.sph, furD, [s * 0.2, 0.03, -0.04], [0.09, 0.035, 0.05], [0, 0, -s * 0.5], false));
      P(head, GEO.cone, beard, [0, -0.21, 0.07], [0.045, 0.11, 0.04], [PI, 0, 0], false);
      // рога: толстые, загнутые назад-вбок-вниз (как у восточного тура)
      [-1, 1].forEach(s => {
        const cv = new T.CatmullRomCurve3([[0.07, 0.15, 0.02], [0.12, 0.3, -0.08], [0.22, 0.33, -0.22], [0.33, 0.22, -0.3], [0.38, 0.08, -0.24], [0.36, 0.02, -0.14]].map(([x, y, z]) => new T.Vector3(s * x, y, z)));
        for (let i = 0; i < 11; i++) { const t = i / 10, p = cv.getPoint(t), r = 0.062 - 0.042 * t; P(head, GEO.sph, i % 2 ? hornD : horn, [p.x, p.y, p.z], [r, r, r], null, i === 0); }
      });
      n.extra = t => { head.position.y = 0.94 + Math.sin(t * 6.5) * 0.006; head.rotation.x = Math.max(0, Math.sin(t * 6.5)) * 0.04; };
      n.headY = 1.2;
    }
    try {
      const tp = meshes.turP;
      if (V.vkit && typeof V.vkit.makeKit === 'function') {
        ownKit = V.vkit.makeKit(T);
        tur = ownKit.npc('tur', arg => turBuild(arg, arg.GEO, arg.capG));
      } else if (window.WORLD && typeof WORLD.createKit === 'function' && typeof WORLD.makeActors === 'function') {
        const H = opts.kit && opts.kit.toon && opts.kit.put ? opts.kit : (ownKit = WORLD.createKit({ rim: ['#FFD0AE', 0.26] }));
        const A = WORLD.makeActors(H), capG = (r, l) => H.keep(new T.CapsuleGeometry(r, l, 3, 8));
        tur = A.npcMake('tur', arg => turBuild(arg, H.GEO_HI, capG));
      }
      if (!tur) throw new Error('no kit');
      tur.root.position.set(tp.x, tp.y, tp.z);
      // в профиль к лавочке
      tur.root.rotation.y = meshes.turRy;
      tur.root.scale.setScalar(1.15);
      root.add(tur.root);
    } catch (e) {
      // запасной тур без набора: те же формы, без лица-наклейки
      const grp = new T.Group(), M = c => toon(c), body = new T.Group(); grp.add(body);
      const add = (geo, m, p, s) => { const x = new T.Mesh(geo, m); x.position.set(p[0], p[1], p[2]); x.scale.set(s[0], s[1], s[2]); x.castShadow = true; body.add(x); };
      const sg = keep(new T.SphereGeometry(1, 12, 8));
      add(sg, M('#9C7250'), [0, 0.6, 0], [0.3, 0.29, 0.44]); add(sg, M('#9C7250'), [0, 0.94, 0.38], [0.21, 0.2, 0.21]);
      [[-0.15, 0.24], [0.15, 0.24], [-0.15, -0.26], [0.15, -0.26]].forEach(([x, z]) => add(sg, M('#7E5A42'), [x, 0.25, z], [0.065, 0.22, 0.065]));
      [-1, 1].forEach(s => { for (let i = 0; i < 6; i++) { const t = i / 5; add(sg, M('#CDBB9C'), [s * (0.08 + 0.3 * t), 1.1 + 0.15 * Math.sin(t * 3), 0.36 - 0.3 * t], [0.06 - 0.03 * t, 0.06 - 0.03 * t, 0.06 - 0.03 * t]); } });
      const tp = meshes.turP; grp.position.set(tp.x, tp.y, tp.z); grp.rotation.y = meshes.turRy; grp.scale.setScalar(1.15); root.add(grp);
      tur = { root: grp, body, anim: () => {}, hop: () => {} };
    }
    npcs.push(Object.assign(tur, { id: 'tur', speaker: 'tur', name: TXT.turName, root: tur.root, x: meshes.turP.x, y: meshes.turP.y, z: meshes.turP.z, ry0: tur.root.rotation.y, headY: 1.35, talkR: 2.8, r: 2.8, lines: turLines, silent: false }));

    /* ---------- ключевые точки, выходы, камеры ---------- */
    const carI = Math.round(12 / DS);
    const carSpawn = { x: R.x[carI], y: R.y[carI], z: R.z[carI], ry: R.th[carI], s: carI * DS };
    const spawn = { x: R.x[carI] + R.lx[carI] * 2.1, y: R.y[carI], z: R.z[carI] + R.lz[carI] * 2.1, ry: R.th[carI] };
    const sView = { x: benchP.x, y: benchP.y, z: benchP.z };
    // места: лавочка смотровой (как раньше) и (волна 4) лавочки в карманах. use() — по контракту мест села (README):
    // { kind: 'sit', seat: [x, y, z], ry, view } — «Сесть» в 3 м от лавочки пешком; из машины — «Посидеть» (стенд: sitRoad)
    const sitUse = (b, view) => () => ({ kind: 'sit', seat: [b.x, b.y + 0.47, b.z], ry: b.ry, view });
    const spots = [{ id: 'road_view', x: sView.x, y: sView.y, z: sView.z, r: 3, label: 'Смотровая', icon: '⭐', action: 'Сесть на лавочку', seat: { x: benchP.x, y: benchP.y + 0.47, z: benchP.z, ry: toTower }, ry: toTower, view: 'viewpoint', parkS: iPk * DS, bench: true, use: sitUse(BENCHES[0], 'viewpoint') }];
    BENCHES.slice(1).forEach(b => spots.push({ id: b.id, x: b.x, y: b.y, z: b.z, r: 3, label: 'Лавочка', icon: '🪑', action: 'Сесть на лавочку', seat: { x: b.x, y: b.y + 0.47, z: b.z, ry: b.ry }, ry: b.ry, view: 'bench' + b.k, parkS: b.i * DS, bench: true, use: sitUse(b, 'bench' + b.k) }));
    const exits = [
      { id: 'toCity', x: R.x[1], y: R.y[1], z: R.z[1], r: 4, label: 'В город', s: 1 * DS },
      { id: 'toVillage', x: R.x[N - 4], y: R.y[N - 4], z: R.z[N - 4], r: 5, label: TXT.toVillage, s: (N - 4) * DS },
    ];
    const V3 = (x, y, z) => [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
    const views = {};
    {
      // смотровая: глаз сидящей героини, кадр как p3 (башня слева сверху) при FOV 16; широкий — FOV 58
      const eye = [benchP.x + Math.sin(toTower) * 0.25, benchP.y + 1.35, benchP.z + Math.cos(toTower) * 0.25];
      const dx = TOWER.x - eye[0], dy = TOWER.top + 0.1 - eye[1], dz = TOWER.z - eye[2], dh = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz) - 1.2 * D2R, pitch = Math.atan2(dy, dh) - 5.3 * D2R;
      const tgt = [eye[0] + Math.sin(yaw) * Math.cos(pitch) * 60, eye[1] + Math.sin(pitch) * 60, eye[2] + Math.cos(yaw) * Math.cos(pitch) * 60];
      views.viewpoint = { pos: V3(...eye), target: V3(...tgt), fov: 16 };
      const pw = Math.atan2(dy - 30, dh) ; const tw = [eye[0] + Math.sin(yaw + 0.02) * 60, eye[1] + Math.sin(pw) * 60, eye[2] + Math.cos(yaw + 0.02) * 60];
      views.viewpoint_wide = { pos: V3(...eye), target: V3(...tw), fov: 58 };
      // старт: щит у края города
      const q = road.sample(startI * DS - 9);
      views.start = { pos: V3(q.x + q.lx * 1.2, q.y + 1.6, q.z + q.lz * 1.2), target: V3(sA.x, sA.y + 1.75, sA.z), fov: 50 };
      // три шпильки сверху: из долины над облаками, смотрим на H2–H4
      // W6: «hairpins» (ключ прежний) — теперь обзор контурной дороги: из долины над облаками на середину подъёма (лощины и отроги)
      const h2 = road.sample(R.len * 0.42), h3 = road.sample(R.len * 0.52), h4 = road.sample(R.len * 0.62);
      const cx = (h2.x + h3.x + h4.x) / 3, cy = (h2.y + h3.y + h4.y) / 3, czz = (h2.z + h3.z + h4.z) / 3, ib = Math.atan2(TOWER.x - cx, TOWER.z - czz);
      views.hairpins = { pos: V3(cx + Math.sin(ib) * 150, cy + 34, czz + Math.cos(ib) * 150), target: V3(cx, cy + 2, czz), fov: 50 };
      views.contour = views.hairpins;
      // выныриваем из облаков: дорога поднялась над облачным слоем, взгляд через долину на село
      const l3 = road.sample(sEmerge + 6);
      views.emerge = { pos: V3(l3.x, l3.y + 2.2, l3.z), target: V3(TOWER.x, -12, TOWER.z), fov: 50 };
      // W6: скала справа — с дороги, чуть вперёд и вправо (слои, навесы, кусты на уступах, осыпь у подножия)
      { const sc = clamp(sEmerge + 120, 60, R.len - 160), q = road.sample(sc), f = road.sample(sc + 16); views.cliff = { pos: V3(q.x + q.lx * 2.2, q.y + 1.7, q.z + q.lz * 2.2), target: V3(f.x - f.lx * 6.5, f.y + 4.5, f.z - f.lz * 6.5), fov: 55 }; }
      // W6: обрыв слева и долина с террасами внизу
      { const b2 = BENCHES[2] || BENCHES[0], q = road.sample(b2.i * DS - 30); views.drop = { pos: V3(q.x + q.lx * 1.2, q.y + 2.4, q.z + q.lz * 1.2), target: V3(q.x + q.lx * 60 + Math.sin(q.th) * 40, q.y - 26, q.z + q.lz * 60 + Math.cos(q.th) * 40), fov: 58 }; }
      // карман смотровой: лавочка, тур на камне, табличка, разрыв в парапете
      const tp = meshes.turP, fx = Math.sin(toTower), fz = Math.cos(toTower), tdx = tp.x - benchP.x, tdz = tp.z - benchP.z, tl = Math.hypot(tdx, tdz) || 1;
      views.pocket = { pos: V3(benchP.x - fx * 6.5 + tdx / tl * 1.2, benchP.y + 2.5, benchP.z - fz * 6.5 + tdz / tl * 1.2), target: V3(benchP.x + fx * 8 + tdx / tl * 0.6, benchP.y - 0.6, benchP.z + fz * 8 + tdz / tl * 0.6), fov: 58 };
      views.tur = { pos: V3(tp.x - Math.sin(toTower) * 3.2 + Math.cos(toTower) * 1.5, tp.y + 1.2, tp.z - Math.cos(toTower) * 3.2 - Math.sin(toTower) * 1.5), target: V3(tp.x, tp.y + 0.7, tp.z), fov: 45 };
      // волна 4: виды с лавочек в карманах — глаз сидящей героини, взгляд по лавочке и чуть вниз, в долину (FOV 34)
      BENCHES.slice(1).forEach(b => {
        const fx = Math.sin(b.ry), fz = Math.cos(b.ry), ey = [b.x + fx * 0.25, b.y + 1.35, b.z + fz * 0.25];
        const ta = Math.atan2(TOWER.x - ey[0], TOWER.z - ey[2]), ya = b.ry + clamp(angDiff(ta, b.ry), -0.5, 0.5) * 0.6, pd = -7 * D2R;
        views['bench' + b.k] = { pos: V3(...ey), target: V3(ey[0] + Math.sin(ya) * Math.cos(pd) * 60, ey[1] + Math.sin(pd) * 60, ey[2] + Math.cos(ya) * Math.cos(pd) * 60), fov: 34 };
      });
      // W6: щит «Осторожно, камушки» у начала подъёма
      { const q = road.sample(kI * DS - 12), k = road.sample(kI * DS); views.pebbleSign = { pos: V3(q.x + q.lx * 0.8, q.y + 1.6, q.z + q.lz * 0.8), target: V3(k.x - k.lx * (k.wr + 0.65), k.y + 1.9, k.z - k.lz * (k.wr + 0.65)), fov: 45 }; }
      const ea = road.sample(exitI * DS - 26);
      views.arrival = { pos: V3(ea.x - ea.lx * 0.5, ea.y + 2.0, ea.z - ea.lz * 0.5), target: V3(R.x[exitI], R.y[exitI] + 1.4, R.z[exitI]), fov: 50 };
    }

    /* ---------- настроение: долина в облаке → внутри облака → над облаками ---------- */
    const MOODS = WIN ? {
      valley: { top: '#C9D3DE', hor: '#E4E9EF', fog: '#E3E8EE', near: 30, far: 250, hs: '#E6EEF7', hg: '#CBD3DC', hi: 0.8, sun: '#FFF6EC', si: 0.22 },
      cloud: { top: '#EEF2F6', hor: '#F2F5F8', fog: '#EEF2F6', near: 3, far: 52, hs: '#EEF3F8', hg: '#D6DDE4', hi: 0.86, sun: '#FFFFFF', si: 0.14 },
      clear: { top: '#AFC4DC', hor: '#E6EDF4', fog: '#E3EAF2', near: 160, far: 2100, hs: '#E6EEF7', hg: '#DCE3EA', hi: 0.7, sun: '#FFF1E0', si: 0.5 },
    } : {
      valley: { top: '#BCC8D6', hor: '#DCE2E9', fog: '#DAE0E7', near: 36, far: 300, hs: '#D6DEE6', hg: '#B8AE9C', hi: 0.78, sun: '#FFF4E6', si: 0.24 },
      cloud: { top: '#E9EEF3', hor: '#EEF2F6', fog: '#EAEFF4', near: 3, far: 56, hs: '#E6ECF2', hg: '#C8C2B6', hi: 0.86, sun: '#FFF6EA', si: 0.15 },
      clear: { top: '#3F78C2', hor: '#A6C8EA', fog: '#BCD2E6', near: 210, far: 3000, hs: '#CFE0F0', hg: '#A39C84', hi: 0.62, sun: '#FFE2BE', si: 0.64 },
    };
    const MC = {}; Object.keys(MOODS).forEach(k => { const m = MOODS[k]; MC[k] = { top: C(m.top), hor: C(m.hor), fog: C(m.fog), hs: C(m.hs), hg: C(m.hg), sun: C(m.sun), near: m.near, far: m.far, hi: m.hi, si: m.si }; });
    const prevFog = scene ? scene.fog : null, prevBg = scene ? scene.background : null;
    const fog = new T.Fog(MC.clear.fog.clone(), MC.clear.near, MC.clear.far);
    if (scene) scene.fog = fog;
    const cur = { top: new T.Color(), hor: new T.Color(), fog: new T.Color(), hs: new T.Color(), hg: new T.Color(), sun: new T.Color(), near: 0, far: 0, hi: 0, si: 0 };
    function blend(a, b, t, o) {
      ['top', 'hor', 'fog', 'hs', 'hg', 'sun'].forEach(k => o[k].copy(a[k]).lerp(b[k], t));
      o.near = Math.exp(lerp(Math.log(a.near), Math.log(b.near), t)); o.far = Math.exp(lerp(Math.log(a.far), Math.log(b.far), t)); o.hi = lerp(a.hi, b.hi, t); o.si = lerp(a.si, b.si, t);
      return o;
    }
    const tmpM = { top: new T.Color(), hor: new T.Color(), fog: new T.Color(), hs: new T.Color(), hg: new T.Color(), sun: new T.Color(), near: 0, far: 0, hi: 0, si: 0 };
    const gateP = { x: R.x[exitI], z: R.z[exitI] }, startP = { x: R.x[0], z: R.z[0] };
    function applyMood(camY, hx, hz) {
      // W6+: туман у подножия реже (долина внизу видна, а не «пустота» за кромкой), в облаке — «молоко», но дорога видна дальше;
      // переходы растянуты по высоте, чтобы туман не «обрывался»
      const t1 = sm(-110, -98, camY), t2 = sm(-95, -82, camY);
      blend(MC.valley, MC.cloud, t1, tmpM); blend(tmpM, MC.clear, t2, cur);
      // облачная шторка у ворот въезда
      const dG = Math.hypot(hx - gateP.x, hz - gateP.z), kG = (1 - sm(10, 46, dG)) * 0.8;
      if (kG > 0.001) { blend(cur, MC.cloud, kG, tmpM); Object.assign(cur, { near: tmpM.near, far: tmpM.far, hi: tmpM.hi, si: tmpM.si }); ['top', 'hor', 'fog', 'hs', 'hg', 'sun'].forEach(k => cur[k].copy(tmpM[k])); }
      fog.color.copy(cur.fog); fog.near = cur.near; fog.far = cur.far;
      hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = cur.hi; sun.color.copy(cur.sun); sun.intensity = cur.si;
      LU.hemiSky.value.copy(cur.hs); LU.hemiGround.value.copy(cur.hg); LU.hemiI.value = cur.hi; LU.sunCol.value.copy(cur.sun); LU.sunI.value = cur.si;
      skyU.top.value.copy(cur.top); skyU.hor.value.copy(cur.hor); skyU.bot.value.copy(cur.fog); skyU.sunK.value = t2;
      const above = camY > -99;
      ridges.forEach(r => { r.m.visible = above; r.m.material.color.copy(r.base).lerp(cur.fog, r.f); if (WIN) r.m.material.color.lerp(r.snow, 0.35); });
      const full = !!realDistant && villageFull; if (vlod) vlod.visible = above && !full; if (realDistant) realDistant.visible = above && full; if (hotelFar) hotelFar.visible = above;
      if (skyPuffs && !WIN) { skyPuffs.visible = t2 > 0.02; skyPuffs.material.opacity = 0.95 * t2; }
      return { t1, t2, kG };
    }
    applyMood(-36, 0, 0);

    /* ---------- W6: камушки со скалы («иногда слегка камушки падают вниз») ----------
       Раз в 20–60 с (у высокой стенки чаще) с верха скальной стенки впереди по ходу скатываются 3–5 маленьких камушков:
       подпрыгивают по уступам, катятся через дорогу и улетают с левого края вниз по обрыву; на каждом ударе — облачко пыли
       и мягкое «тук» (шина звука игры G.audioBus('sfx'), если есть). Не опасно: машину не останавливают и не толкают —
       коснулись кузова: лёгкий «тук» подвеской (collider.tap машины drive.js) и облачко. Один InstancedMesh + одни Points
       (≤ 2 вызова, только пока камушки летят). handle.pebbles: trigger(s?), active(), list(), next(), on(fn), enabled. */
    const PEB = (() => {
      const MAX = 10, PUFF = 40, G_ = 9;
      const geo = keep(new T.IcosahedronGeometry(1, 0)); { const nn = geo.attributes.normal, col = new Float32Array(nn.count * 3); for (let i = 0; i < nn.count; i++) { const v = 0.78 + 0.28 * Math.max(0, nn.getY(i)); col.set([v, v, v], i * 3); } geo.setAttribute('color', new T.BufferAttribute(col, 3)); }
      const im = new T.InstancedMesh(geo, cheapVC, MAX); im.count = 0; im.frustumCulled = false; im.visible = false; im.name = 'pebbles'; im.renderOrder = 2; root.add(im);
      const PC = (WIN ? ['#8C867C', '#A49E94', '#7A746A'] : ['#9A8C78', '#B0A28A', '#80725F', '#BBAC90']).map(C);
      for (let k = 0; k < MAX; k++) im.setColorAt(k, PC[k % PC.length]);
      // пыль: мягкие облачка (как у колёс машины)
      const pP = new Float32Array(PUFF * 3), pC = new Float32Array(PUFF * 4), pV = new Float32Array(PUFF * 3), pL = new Float32Array(PUFF), pL0 = new Float32Array(PUFF);
      for (let i = 0; i < PUFF; i++) pP[i * 3 + 1] = -1e4;
      const pg = keep(new T.BufferGeometry()); pg.setAttribute('position', new T.BufferAttribute(pP, 3)); pg.setAttribute('color', new T.BufferAttribute(pC, 4)); pg.boundingSphere = new T.Sphere(new T.Vector3(), 1e5);
      const pm = keep(new T.PointsMaterial({ size: 1.2, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: true }));
      const pts = new T.Points(pg, pm); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 8; pts.name = 'pebbleDust'; root.add(pts);
      const DUST = WIN ? [0.95, 0.96, 0.98] : [0.86, 0.8, 0.7];
      let ph = 0;
      const puff = (x, y, z, n, k) => { for (let j = 0; j < n; j++) { const i = ph; ph = (ph + 1) % PUFF; const a = Math.random() * PI * 2, sp = (0.25 + Math.random() * 0.6) * (k || 1); pP[i * 3] = x; pP[i * 3 + 1] = y; pP[i * 3 + 2] = z; pV[i * 3] = Math.cos(a) * sp; pV[i * 3 + 1] = 0.35 + Math.random() * 0.5; pV[i * 3 + 2] = Math.sin(a) * sp; pL[i] = pL0[i] = 0.7 + Math.random() * 0.6; pC.set([DUST[0], DUST[1], DUST[2], 0.7], i * 4); } };
      const list = [], subs = [];
      const st = { enabled: opts.pebbles !== false, t: 0, next: 12 + Math.random() * 14, events: 0, knocks: 0, taps: 0, lastS: 0, sound: opts.sound !== false };
      const emit = ev => subs.forEach(f => { try { f(ev); } catch (e) { /* подписчик */ } });
      // «тук»: короткий деревянно-каменный щелчок (два тона и шорох), громкость — от расстояния до камеры
      function knock(vol) {
        st.knocks++;
        if (!st.sound) return;
        try {
          const g = window.G, out = g && typeof g.audioBus === 'function' ? g.audioBus('sfx') : null; if (!out) return;
          const ac = out.context, t = ac.currentTime + 0.005, f = 520 + Math.random() * 180;
          [[f, 0.07, 1], [f * 1.48, 0.04, 0.35]].forEach(([fr, d, k]) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * 0.62, t + d); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol * k, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + d + 0.03); });
        } catch (e) { /* звук не главное */ }
      }
      function trigger(sT, o2) {
        o2 = o2 || {};
        const i0 = clamp(Math.round((sT == null ? st.lastS + 25 : sT) / DS), 20, N - 25);
        if (cliffInfo[i0 * 3 + 1] < 4) return false;
        const n = o2.n || 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n && list.length < MAX; k++) {
          const i = clamp(i0 + Math.round((Math.random() - 0.5) * 4), 1, N - 2), H = cliffInfo[i * 3 + 1]; if (H < 3) continue;
          const h = H * (0.75 + Math.random() * 0.2), e = cliffInfo[i * 3] + h / CLIFF_SLOPE - 0.35, rx = -R.lx[i], rz = -R.lz[i], fx = Math.sin(R.th[i]), fz = Math.cos(R.th[i]);
          const lat = 2.2 + Math.random() * 1.2, al = (Math.random() - 0.5) * 1.2;
          list.push({ x: R.x[i] + rx * e + fx * (Math.random() - 0.5) * 2, y: R.y[i] + h + 0.25 + Math.random() * 0.4, z: R.z[i] + rz * e + fz * (Math.random() - 0.5) * 2,
            vx: -rx * lat + fx * al, vy: 0.3 + Math.random() * 0.8, vz: -rz * lat + fz * al, r: 0.14 + Math.random() * 0.12, rot: Math.random() * 6, spin: 4 + Math.random() * 6, life: 0, delay: k * (0.18 + Math.random() * 0.25), i, knocks: 0, tapped: false, out: false });
        }
        st.events++; emit({ type: 'fall', s: i0 * DS, x: R.x[i0], y: R.y[i0], z: R.z[i0], n });
        return true;
      }
      const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
      function update(dt, heroPos, cam) {
        // расписание: только когда героиня (или машина) на основной дороге
        if (heroPos) {
          const P = road.project(heroPos.x, heroPos.z, st.lastS);
          const on = Math.abs(P.e) < Math.max(P.wl, P.wr) + 2;
          if (on) {
            const ds = P.s - st.lastS; st.lastS = P.s;
            if (st.enabled) {
              const Hl = cliffInfo[clamp(Math.round(P.s / DS), 0, N - 1) * 3 + 1];
              st.t += dt * (1 + 0.6 * sm(9, 14, Hl));   // у высокой стенки — чаще
              if (st.t >= st.next) {
                // впереди по ходу (куда смотрит камера / куда едем): 16–34 м
                let dir = ds < -0.01 ? -1 : 1;
                if (cam) { cam.getWorldDirection(_p); const q = road.sample(P.s); dir = (_p.x * Math.sin(q.th) + _p.z * Math.cos(q.th)) >= 0 ? 1 : -1; }
                const ok = trigger(P.s + dir * (12 + Math.random() * 14));
                st.t = 0; st.next = ok ? 20 + Math.random() * 40 : 4;
              }
            }
          }
        }
        if (!list.length && !pts.visible) return;
        const cp = cam ? cam.position : heroPos;
        let alive = 0;
        for (let k = list.length - 1; k >= 0; k--) {
          const p = list[k];
          if (p.delay > 0) { p.delay -= dt; continue; }
          p.life += dt; p.vy -= G_ * dt;
          const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
          const g = ground(nx, nz) + p.r * 0.8;
          // где камушек: на скале (справа от полотна), на полотне, за левым краем
          const Pp = road.project(nx, nz, p.i * DS), W = Pp.e > 0 ? Pp.wl : Pp.wr, onRd = Math.abs(Pp.e) <= W + 0.3, left = Pp.e > W + 0.3;
          if (ny < g && p.vy < 0) {
            const imp = -p.vy, onCliff = !onRd && !left;
            p.vy = imp * (onRd ? 0.32 : onCliff ? 0.22 : 0.4) + (onRd ? 0.35 : onCliff ? 0.3 : 0.5);
            if (!left) { p.vx *= 0.88; p.vz *= 0.88; }
            // через дорогу — к обрыву (слева по ходу вверх): со скалы отскакивает наружу, по полотну катится и не останавливается
            const lx = Pp.lx, lz = Pp.lz, vl = p.vx * lx + p.vz * lz, want = onCliff ? 3.0 : onRd ? 2.8 : 1.6;
            if (vl < want) { p.vx += lx * (want - vl); p.vz += lz * (want - vl); }
            p.y = g; p.x = nx; p.z = nz;
            if (imp > 1.1) {
              puff(p.x, p.y - 0.05, p.z, onRd ? 3 : 2, 1);
              if (cp && p.knocks < 3) { const d = Math.hypot(p.x - cp.x, p.y - cp.y, p.z - cp.z); if (d < 32) { p.knocks++; knock(0.05 * (1 - d / 32) * Math.min(1, imp / 4)); emit({ type: 'knock', x: p.x, y: p.y, z: p.z }); } }
            }
          } else { p.x = nx; p.y = ny; p.z = nz; }
          // машина: лёгкое касание — «тук» подвеской и облачко, камушек отскакивает вверх-вбок; машину не держит
          if (!p.tapped) for (const c of dynamic) {
            if (!c || c.id !== 'car') continue;
            const cs = Math.cos(c.ry || 0), sn = Math.sin(c.ry || 0), dx = p.x - c.x, dz = p.z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
            if (Math.abs(lx) < c.w / 2 + p.r && Math.abs(lz) < c.d / 2 + p.r && p.y < (c.y1 != null && c.y1 < 1e3 ? c.y1 - 0.2 : ground(c.x, c.z) + 1.5)) {
              p.tapped = true; p.vy = 2.2; const sgn = lx >= 0 ? 1 : -1; p.vx = cs * sgn * 1.4 + p.vx * 0.3; p.vz = -sn * sgn * 1.4 + p.vz * 0.3;
              puff(p.x, p.y, p.z, 5, 1.2); st.taps++; if (typeof c.tap === 'function') c.tap(0.35); knock(0.04); emit({ type: 'tap', x: p.x, y: p.y, z: p.z });
            }
          }
          p.rot += p.spin * dt;
          if (left) p.out = true;
          if (left && p.outT == null) p.outT = p.life;
          const gone = p.life > 9 || p.y < R.y[p.i] - 22 || (p.outT != null && p.life - p.outT > 3.2);
          if (gone) { list.splice(k, 1); continue; }
          alive++;
        }
        // инстансы
        let n = 0;
        for (const p of list) { if (p.delay > 0) continue; _e.set(p.rot, p.rot * 0.7, 0); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z); _s.set(p.r, p.r * 0.8, p.r * 0.9); im.setMatrixAt(n++, _m.compose(_p, _q, _s)); }
        im.count = n; im.visible = n > 0; if (n) im.instanceMatrix.needsUpdate = true;
        // пыль
        let pa = 0;
        for (let i = 0; i < PUFF; i++) { if (pL[i] <= 0) continue; pL[i] -= dt; if (pL[i] <= 0) { pP[i * 3 + 1] = -1e4; pC[i * 4 + 3] = 0; continue; } pa++; pV[i * 3 + 1] -= 0.25 * dt; pP[i * 3] += pV[i * 3] * dt; pP[i * 3 + 1] += pV[i * 3 + 1] * dt; pP[i * 3 + 2] += pV[i * 3 + 2] * dt; const kk = pL[i] / pL0[i]; pC[i * 4 + 3] = 0.6 * Math.min(1, kk * 1.8) * Math.min(1, (1 - kk) * 7 + 0.2); }
        pts.visible = pa > 0; if (pa || alive) { pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true; }
      }
      return {
        update, trigger,
        get enabled() { return st.enabled; }, set enabled(v) { st.enabled = !!v; },
        active() { return list.length; }, list() { return list.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), out: p.out, tapped: p.tapped, delay: p.delay > 0 })); },
        next() { return Math.max(0, st.next - st.t); }, stats() { return { events: st.events, knocks: st.knocks, taps: st.taps, active: list.length }; },
        on(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
      };
    })();

    /* ---------- обновление ---------- */
    let time = 0, pollT = 0, prevFar = null, prevNear = null, mood = null, lastCam = null;
    const FOGI = { cloud: 0, gate: 0, valley: 0 };
    const hv = new T.Vector3(), shDir = new T.Vector3();
    function update(dt, heroPos, camera) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1); time += dt;
      const cp = camera ? camera.position : heroPos || hv;
      if (camera) {
        lastCam = camera;
        if (camera.far < 1600 || camera.near > 0.3) { if (prevFar === null) { prevFar = camera.far; prevNear = camera.near; } camera.far = Math.max(camera.far, 1600); camera.near = Math.min(camera.near, 0.25); camera.updateProjectionMatrix(); }
        sky.position.copy(camera.position);
        if (skyPuffs) skyPuffs.position.copy(camera.position);
        ridges.forEach(r => { r.m.position.set(camera.position.x, camera.position.y * (1 - r.k), camera.position.z); });
      }
      const hx = heroPos ? heroPos.x : cp.x, hz = heroPos ? heroPos.z : cp.z;
      mood = applyMood(cp.y, hx, hz);
      clouds.forEach((c, k) => { const o = c.u.off.value; o.x = (o.x + dt * c.sp) % 1; o.y = (o.y + dt * c.sp * 0.4 * (k % 2 ? -1 : 1)) % 1; });
      if (meshes.streamTex) meshes.streamTex.offset.y -= dt * 0.35;
      // птицы
      { const P = birds.P; birds.list.forEach((b, j) => { const a = time * b.w + b.ph, x = b.c[0] + Math.sin(a) * b.r, z = b.c[2] + Math.cos(a) * b.r, y = b.c[1] + Math.sin(time * 0.3 + j) * 3, hd = a + (b.w > 0 ? PI / 2 : -PI / 2), fx = Math.sin(hd), fz = Math.cos(hd), lx = fz, lz = -fx, fl = Math.sin(time * 2.2 + j) * 0.35 + 0.25, s = b.s;
        const pts = [[x + fx * 0.5 * s, y, z + fz * 0.5 * s], [x - fx * 0.4 * s + lx * 1.6 * s, y + fl * s, z - fz * 0.4 * s + lz * 1.6 * s], [x - fx * 0.3 * s, y, z - fz * 0.3 * s], [x + fx * 0.5 * s, y, z + fz * 0.5 * s], [x - fx * 0.3 * s, y, z - fz * 0.3 * s], [x - fx * 0.4 * s - lx * 1.6 * s, y + fl * s, z - fz * 0.4 * s - lz * 1.6 * s]];
        pts.forEach((p, k) => { P[(j * 6 + k) * 3] = p[0]; P[(j * 6 + k) * 3 + 1] = p[1]; P[(j * 6 + k) * 3 + 2] = p[2]; }); });
        birds.m.geometry.attributes.position.needsUpdate = true; }
      // тур
      if (tur && tur.anim) tur.anim(time, dt, hx, hz);
      // W6: камушки со скалы
      PEB.update(dt, heroPos || null, camera || null);
      // снег вокруг камеры
      if (snow) {
        snow.position.set(cp.x, cp.y, cp.z);
        const a = snow.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * (0.55 + (i % 7) * 0.04); a[i] += dt * 0.25 * Math.sin(time * 0.7 + i); if (a[i + 1] < -6) { a[i + 1] += 24; a[i] = ((a[i] + 20) % 40 + 40) % 40 - 20; } }
        snow.geometry.attributes.position.needsUpdate = true;
      }
      // тень (высокое качество) — за героиней/машиной
      if (Q.shadow && heroPos) {
        // центр рамки — впереди по взгляду камеры (сзади машины тени почти не видно)
        let fx = 0, fz = 0;
        if (camera) { camera.getWorldDirection(shDir); const l = Math.hypot(shDir.x, shDir.z); if (l > 1e-3) { fx = shDir.x / l * SH_AHEAD; fz = shDir.z / l * SH_AHEAD; } }
        const cx = heroPos.x + fx, cz = heroPos.z + fz;
        sun.target.position.set(cx, heroPos.y, cz); sun.position.set(cx + SUNDIR.x * 75, heroPos.y + SUNDIR.y * 75, cz + SUNDIR.z * 75);
      }
      else if (!Q.shadow) { sun.position.copy(SUNDIR).multiplyScalar(100).add(cp); sun.target.position.copy(cp); }
      // село из модуля села, если оно появилось позже
      if (!realDistant) { pollT += dt; if (pollT > 1 && time < 90) { pollT = 0; tryReal(); } }
    }

    function dispose() {
      if (root.parent) root.parent.remove(root);
      if (scene && scene.fog === fog) scene.fog = prevFog;
      if (scene && prevBg !== undefined && scene.background !== prevBg) scene.background = prevBg;
      const skip = new Set(); if (tur && tur.root) tur.root.traverse(o => skip.add(o)); if (realDistant) realDistant.traverse(o => skip.add(o)); if (hotelFar) hotelFar.traverse(o => skip.add(o));
      root.traverse(o => { if (skip.has(o)) return; if (o.isMesh || o.isPoints) { if (o.geometry && own.indexOf(o.geometry) < 0) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m && own.indexOf(m) < 0) m.dispose(); }); } });
      if (lastCam && prevFar !== null) { lastCam.far = prevFar; lastCam.near = prevNear; lastCam.updateProjectionMatrix(); }
      own.forEach(x => { try { x.dispose && x.dispose(); } catch (e) { /* уже */ } });
      if (ownKit && ownKit.dispose) ownKit.dispose();
      if (realDistant && realDistant.userData && typeof realDistant.userData.dispose === 'function') realDistant.userData.dispose();
      if (hotelFar && hotelFar.userData && typeof hotelFar.userData.dispose === 'function') hotelFar.userData.dispose();
    }

    /* ---------- волна 4: ходьба по дороге (героиня вышла из машины) — столкновения, проходимость, земля, луч камеры ----------
       collide(x, z, r, y) — как у села: круг радиуса r выталкивается из коллайдеров (края полотна kind 'edge' держат героиню
       на дороге и обочине — за край обрыва не шагнуть), плюс handle.dynamic — подвижные (машина: drive.collider). */
    const CG = (() => {
      const CELL = 6, cells = new Map(), key = (i, j) => i * 65536 + j;
      colliders.forEach(c => {
        const r = c.type === 'circle' ? c.r : Math.hypot(c.w || 0, c.d || 0) / 2;
        for (let i = Math.floor((c.x - r) / CELL); i <= Math.floor((c.x + r) / CELL); i++) for (let j = Math.floor((c.z - r) / CELL); j <= Math.floor((c.z + r) / CELL); j++) { const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(c); }
      });
      return { near(x, z) { return cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || null; } };
    })();
    function pushC(c, x, z, r) {
      if (c.type === 'circle') { const dx = x - c.x, dz = z - c.z, m = c.r + r, d = Math.hypot(dx, dz); if (d >= m) return null; if (d < 1e-6) return [m, 0]; const k = (m - d) / d; return [dx * k, dz * k]; }
      const ry = c.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry), dx = x - c.x, dz = z - c.z;
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, hw = c.w / 2, hd = c.d / 2;
      const qx = clamp(lx, -hw, hw), qz = clamp(lz, -hd, hd);
      let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz), px, pz;
      if (d > 1e-6) { if (d >= r) return null; const k = (r - d) / d; px = ox * k; pz = oz * k; }
      else { const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz); if (ex < ez) { px = (ex + r) * Math.sign(lx || 1); pz = 0; } else { px = 0; pz = (ez + r) * Math.sign(lz || 1); } }
      return [px * cs + pz * sn, -px * sn + pz * cs];
    }
    const dynamic = [];
    const yOk = (c, y) => y === undefined || y === null || !((c.y1 !== undefined && y > c.y1 - 0.05) || (c.y0 !== undefined && y < c.y0 - 0.5));
    function collide(x, z, r, y) {
      r = r || 0.3;
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        const l = CG.near(x, z);
        if (l) for (const c of l) { if (!yOk(c, y)) continue; const d = pushC(c, x, z, r); if (d) { x += d[0]; z += d[1]; moved = true; } }
        for (const c of dynamic) { if (!c || c.off || !yOk(c, y)) continue; const d = pushC(c, x, z, r); if (d) { x += d[0]; z += d[1]; moved = true; } }
        if (!moved) break;
      }
      // страховка от «за край»: точка вне полотна — назад к ближайшему полотну (коллайдеры края этого не допускают, но вдруг)
      if (!onRoad(x, z, 0.05)) {
        const p = road.project(x, z);
        const W = (p.e > 0 ? p.wl : p.wr) - r * 0.5, over = Math.abs(p.e) - W; if (over > 0) { x -= p.lx * Math.sign(p.e) * over; z -= p.lz * Math.sign(p.e) * over; }
      }
      return [x, z];
    }
    function walkable(x, z) { return onRoad(x, z, -0.05); }
    function groundInfo(x, z) {
      const y = ground(x, z);
      if (!onRoad(x, z, 0.02)) return { y, kind: 'slope' };
      const sf = road.surface(x, z);
      return { y, kind: sf.kind === 'verge' ? 'road' : sf.kind, surface: sf.kind, wet: sf.wet };
    }
    // луч камеры: только то, что выше колена — столбы ворот, лавочки (знаки тонкие, край полотна — низкий)
    const camCols = colliders.filter(c => c.kind === 'gate' || c.kind === 'bench').map(c => Object.assign({}, c, { y0: ground(c.x, c.z) - 0.2, y1: ground(c.x, c.z) + (c.kind === 'gate' ? 2.6 : 0.9) }));
    function rayHit(a, b) {
      let best = 1;
      for (const c of camCols) {
        const dx = b.x - a.x, dz = b.z - a.z;
        // грубо: сфера-окружность вокруг коллайдера
        const r = c.type === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2, fx = a.x - c.x, fz = a.z - c.z, A2 = dx * dx + dz * dz; if (A2 < 1e-9) continue;
        const B2 = 2 * (fx * dx + fz * dz), C2 = fx * fx + fz * fz - r * r, D = B2 * B2 - 4 * A2 * C2; if (D < 0) continue;
        const t = (-B2 - Math.sqrt(D)) / (2 * A2); if (t < 0 || t > best) continue;
        const yy = a.y + (b.y - a.y) * t; if (yy > c.y0 && yy < c.y1) best = t;
      }
      return best;
    }

    const buildMs = Math.round(performance.now() - t0);
    let triCount = 0; root.traverse(o => { if (o.isMesh && o.geometry) { const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; triCount += o.isInstancedMesh ? n * o.count : n; } });
    const handle = {
      id: 'serpentine', root, named, season, quality, title: TXT.title,
      spawn, carSpawn, colliders, ground, npcs, spots, exits,
      // волна 4: ходьба по дороге, лавочки, покрытие (см. шапку файла)
      collide, walkable, groundInfo, rayHit, dynamic, camColliders: [], benches: BENCHES.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, ry: b.ry, seat: { x: b.x, y: b.y + 0.47, z: b.z, ry: b.ry }, view: b.k ? 'bench' + b.k : 'viewpoint', s: b.i * DS })),
      surface: road.surface,
      camera: { views, far: 1600, near: 0.25, fovZoom: [58, 16] },
      road, update, dispose,
      // волна 11 («на телефоне неуправляемые — сделай пониже скорость»), волна 12 («стало хуже: не надо тормозить на поворотах —
      // их на серпантине на каждом шагу; в прошлый раз было норм, просто чуть медленнее»): руль и разгон — как до волны 11
      // (без руля «скоростью поворота» и без самопритормаживания перед поворотами), только скорость на прямых пониже: седан
      // 24 м/с (86 км/ч, было 28), кабриолет 27 м/с (97 км/ч, было 32). drive.create({ cfg: Object.assign({}, car.driveCfg, carCfg(kind)) }).
      // Село и город — как были (там свои настройки)
      carCfg(kind) {
        return kind === 'sedan' ? { vmax: 24, vCap: 26.5 } : { vmax: 27, vCap: 29.5 };
      },
      // W6: камушки со скалы (см. блок PEB): trigger(s?), active(), list(), next(), stats(), on(fn) → отписка, enabled
      pebbles: PEB,
      // подсказка камере-следилке: над облаками на прямых плечах слегка развернуться к селу через долину (рад)
      // «вау»-моменты для камеры: где показать село через долину (хаб может проиграть как короткий поворот камеры)
      moments: [{ id: 'emerge', s0: sEmerge + 6, s1: sEmerge + 70, look: { x: TOWER.x, y: -8, z: TOWER.z }, dur: 5.5 }],
      cameraBias(x, y, z, heading, s) {
        if (y < -88) return 0;
        const d = angDiff(Math.atan2(TOWER.x - x, TOWER.z - z), heading);
        if (Math.abs(d) > 2.4) return 0;
        const k = s != null ? 1 - sm(0.03, 0.08, road.kmax(s - 6, 18)) : 1;
        return clamp(d * 0.2, -0.16, 0.16) * k * sm(-88, -80, y);   // W6: село всё время слева — разворот скромнее (≤ 9°)
      },
      sun, hemi, fog,
      // W5 (желание автора: «когда еду по туману — фразы»): насколько сейчас туманно — по последнему update(): cloud — слой облаков
      // (W6: s ≈ 80…290 на подъёме), gate — облачная шторка у ворот села и у отеля, valley — дымка долины внизу. 0…1, без выделений памяти.
      fogInfo(o) { o = o || FOGI; const m = mood; o.cloud = m ? m.t1 * (1 - m.t2) : 0; o.gate = m ? m.kG : 0; o.valley = m ? 1 - m.t1 : 0; return o; },
      // подробное село вдали: true (по умолчанию) — настоящее, false — силуэт (запас для слабых устройств)
      setVillageDetail(on) { villageFull = !!on; return !!realDistant && villageFull; },
      info() { return { buildMs, tris: triCount, len: +R.len.toFixed(1), samples: N, hairpins: 0, legs: 0, layout: 'contour', bends: noses.length, grade: +((R.y[N - 1] - R.y[0]) / R.len * 100).toFixed(1), sEmerge: +sEmerge.toFixed(1), climb: +(R.y[N - 1] - R.y[0]).toFixed(1), nearCells: NG.act.reduce((a, b) => a + b, 0), trees: trees.length, colliders: colliders.length, village: realDistant ? 'kubachi.distant' : 'placeholder', mood, benches: BENCHES.length, feats: { holes: FEAT.filter(f => f.kind === 'hole').length, puddles: FEAT.filter(f => f.kind === 'puddle').length, mud: FEAT.filter(f => f.kind === 'mud').length, stones: FEAT.filter(f => f.kind === 'stone').length } }; },
      stats() { return { tris: triCount, colliders: colliders.length, npcs: npcs.length, buildMs }; },
      // для отладки и стыковки: точки и подписи
      points: { bench: benchP, tur: meshes.turP, gate: { x: R.x[exitI], y: R.y[exitI], z: R.z[exitI] }, start: { x: R.x[0], y: R.y[0], z: R.z[0] }, bridge: iBr >= 0 ? { x: R.x[iBr], y: R.y[iBr], z: R.z[iBr] } : null, hairpinApex6: { x: R.x[iAp6], y: R.y[iAp6], z: R.z[iAp6] } },
      // W6: L3 — где дорога выныривает из облаков (как прежнее плечо L3), H6 — нос отрога со смотровой (как прежняя шпилька H6)
      sOf: { L3: sEmerge, emerge: sEmerge, H6: iAp6 * DS, view: iPk * DS, noses: noses.map(i => i * DS), bench: benchI * DS, gate: exitI * DS, bridge: iBr * DS, benches: BENCHES.map(b => b.i * DS) },
      labels: TXT,
    };
    return handle;
  }

  /* ---------- для села: склон с врезанной дорогой (без геометрии) — чтобы лента дороги лежала на своём месте и в виде из села ---------- */
  let CUTQ = null;
  function groundCut(x, z) {
    const R = buildPath(), CS = 12;
    if (!CUTQ) {
      CUTQ = new Map();
      for (let i = 0; i < R.N - 1; i++) { const kx = Math.floor(R.x[i] / CS), kz = Math.floor(R.z[i] / CS); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = (kx + a) + ',' + (kz + b), l = CUTQ.get(k); if (l) { if (l[l.length - 1] !== i) l.push(i); } else CUTQ.set(k, [i]); } }
    }
    const y = natY(x, z), l = CUTQ.get(Math.floor(x / CS) + ',' + Math.floor(z / CS));
    if (!l) return y;
    let bd = 1e9, yr = 0;
    for (const i of l) { const ax = R.x[i], az = R.z[i], vx = R.x[i + 1] - ax, vz = R.z[i + 1] - az, L2 = vx * vx + vz * vz || 1, t = clamp(((x - ax) * vx + (z - az) * vz) / L2, 0, 1), d = Math.hypot(x - ax - vx * t, z - az - vz * t); if (d < bd) { bd = d; yr = R.y[i] + (R.y[i + 1] - R.y[i]) * t; } }
    // полотно + обочина: земля не выше дороги, дальше — выемка 3,0 (W6: рельеф natY уже «от дороги» — справа скала остаётся)
    return Math.min(y, yr - 0.3 + Math.max(0, bd - 3.4) * 3.0);
  }

  /* ---------- для села: осевая, лента дороги вдали, рельеф склона ---------- */
  function path() { const R = buildPath(), out = []; for (let i = 0; i < R.N; i++) out.push({ x: R.x[i], y: R.y[i], z: R.z[i], tag: R.tag[i] }); return out; }
  function distant(T, season, o = {}) {
    // o.w — полуширина ленты (из села издалека дорога тоньше), o.col/o.wall — цвета, o.skirt — высота «стенки» вниз
    const R = buildPath(), P = [], I = [], col = new T.Color(o.col || (season === 'winter' ? '#E9EDF1' : '#D8D2C2')), wall = new T.Color(o.wall || (season === 'winter' ? '#F3F5F8' : '#A89A84')), sk = o.skirt == null ? 2.2 : o.skirt;
    // W6: дорога обходит долину по кольцу (β −86…42° от башни), а фон села пока кладёт рельеф дороги (groundCut) только в «заплатке»
    // β −10…68°, ρ 282…552 (kubachi.js, serpW). Вне заплатки там прежняя чаша — лента рисуется только там, где она лежит на ней
    // (иначе висела бы над отрогами и тонула в лощинах). o.all — вся лента (когда заплатка села станет шире: patch ниже).
    const inPatch = (x, z) => { const rho = Math.hypot(x - TX, z - TZ), be = Math.atan2(x - TX, z - TZ) / D2R; return rho > 300 && rho < 532 && be > 1 && be < 57; };
    const okAt = (x, y, z) => { if (o.all || inPatch(x, z)) return true; const rho = Math.hypot(x - TX, z - TZ), be = Math.atan2(x - TX, z - TZ) / D2R; return Math.abs(y - Math.max(bowlY(rho, be), spurY(rho, be))) < 2.5; };
    let n = 0, prev = false;
    for (let i = 0; i < R.N; i += 3) {
      const w = o.w || 2.6, y = R.y[i] + 0.15, x = R.x[i], z = R.z[i], lx = R.lx[i], lz = R.lz[i];
      const ok = okAt(x, R.y[i], z);
      if (!ok) { prev = false; continue; }
      P.push(x + lx * w, y, z + lz * w, x - lx * w, y, z - lz * w, x - lx * w, y - sk, z - lz * w);
      if (n && prev) { const o = (n - 1) * 3; I.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
      n++; prev = true;
    }
    const C = new Float32Array(P.length); for (let k = 0; k < P.length / 3; k++) { const c = k % 3 === 2 ? wall : col; C.set([c.r, c.g, c.b], k * 3); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new T.BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
    m.name = 'serpentineDistant'; m.userData.dispose = () => { geo.dispose(); m.material.dispose(); };
    return m;
  }
  // W6: где фону села нужен рельеф дороги (groundCut вместо своей чаши), чтобы вся контурная дорога лежала на месте: ρ и β от башни
  const patch = { r0: 292, r1: 560, b0: -104, b1: 66, tx: TX, tz: TZ };
  V.regions.serpentine = { build, path, distant, groundMacro: natY, groundCut, patch, layout: 'contour', frame: { RV2XZ, XZ2RV, TOWER, CLOUD_TOP, SB } };
})();
