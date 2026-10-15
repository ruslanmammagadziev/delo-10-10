/* =====================================================================
   ГОРНАЯ ДОРОГА: серпантин из города в горное село (VILLAGE.regions.serpentine).
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
       road.surface(x, z) / road.surfaceSE(s, e, rid) → { kind, wet, dz, rough };
     · ЛАВОЧКИ: ещё 4 кармана с лавочкой на смотровых точках (плечи L3, L4, L5 и выезд) — места road_bench1…4
       (+ прежняя road_view), use() → { kind:'sit', seat, ry, view }, виды bench1…bench4;
     · РАЗВИЛКА К ОТЕЛЮ: на выезде, ≈ 50 м до ворот, ветка вверх на бровку (72 м, 10 %), коричневые щиты «Отель»
       (для едущих вверх и вниз), облачная шторка в конце и выход { id:'toHotel', rid: 1 } (регион отеля — отдельно);
     · ХОДЬБА: героиня может выйти из машины где угодно — handle.collide / walkable / groundInfo / rayHit / dynamic.

   Координаты — общие «макро» из kubachi_visual.md (метры; x восток, y вверх, z юг; y = 0 — площадь села),
   поэтому село с дороги и дорога из села стоят на своих местах без подгонки. Регион — своя сцена.

   VILLAGE.regions.serpentine.build(opts) → handle (контракт регионов, см. README села):
     opts: { THREE, scene, named = VILLAGE.named ?? true, season: 'autumn'|'winter', quality: 'low'|'high', kit?, lights? }
     handle: { spawn, carSpawn, colliders, ground(x,z), npcs, spots, exits, camera:{views, far, near},
               road (для VILLAGE.drive), update(dt, heroPos, camera), dispose() }
     handle.road = { len, project(x,z,hintS), sample(s), kmax(s,ahead), sOfTag(tag),
                     branch: { len, sF, side, project, sample },          // волна 4: ветка к отелю (s — по ветке)
                     areas(x,z,hintS,hintB) → [проекция на основную, на ветку?] — для мягкого края машины и ходьбы,
                     surface(x,z,hintS), surfaceSE(s,e,rid) }              // покрытие: яма/лужа/грязь/камень
     handle.moments — «вау»-момент (показать село с L3); handle.cameraBias(x,y,z,heading,s) — разворот камеры к долине.
     Волна 4 (добавлено, прежнее не тронуто): collide(x,z,r,y) → [x,z] · walkable(x,z) · groundInfo(x,z) → {y, kind}
       · rayHit(a,b) · dynamic: [] (подвижные коллайдеры: машина — drive.collider) · benches: [{id,x,y,z,ry,seat,view,s}]
       · hotel: { fork, end, len, side } · exits + { id:'toHotel', x,y,z,r, s (по ветке), rid: 1 } · views bench1…4, fork
       · sOf.fork, sOf.benches · stats().
   Отступление от библии: плечи наискось (+6 м по ρ, зигзаг как на фото p5), склон 0,636, подъезд с запада, выезд по бровке
   (подробно — plan2/kubachi_road.md; волна 4 — plan2/wave4_road.md).
   Дополнительно: .path() — осевая дороги в макро-координатах; .distant(THREE, season) — лента серпантина
   для вида из села (1 вызов); .groundMacro(x, z) — естественный рельеф склона (без врезки дороги), для фона села;
   .hotelRoad() — ветка к отелю без сборки региона (развилка, конец, осевая) — для региона отеля и карты.
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
  const STREAM_V = r => -80 + 3.5 * Math.sin(r * 0.045 + 0.8);
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
  // склон с серпантином: плоскость по средним высотам плеч (−114,5 на ρ 362, уклон 0,636 ≈ 32°), дно −150, бровка ~−14 на ρ 515
  function wallY(r, v) {
    let y = smax(-150, -114.5 + (r - 362) * 0.636, 12);
    y = smin(y, -14 + (r - 515) * 0.09, 10);
    y += 1.5 * Math.sin(v * 0.071 + r * 0.031) + 0.9 * Math.sin(v * 0.17 - r * 0.12 + 1.7);
    const dv = v - STREAM_V(r), rav = Math.exp(-dv * dv / 48) * sm(502, 480, r);
    return y - 6.2 * rav;
  }
  // когда вдали рисуется настоящее село (kubachi.distant с террасами), грубую «чашу села» здесь опускаем под его рельеф
  let VSINK = 0;
  function villageSink(x, z) {
    if (!VSINK) return 0;
    // чаша под селом (ρ < 300 от башни) — у села своя, с текстурой крон; дорога начинается дальше (ρ ≥ 318)
    const bowl = 5 * sm(298, 289, Math.hypot(x - TX, z - TZ));
    if (z >= CZ - 2) return bowl;
    const r = Math.hypot(x, z - CZ), ph = Math.abs(Math.atan2(x, CZ - z));
    return Math.max(bowl, VSINK * sm(122, 113, r) * sm(23, 30, r) * sm(0.88, 0.8, ph));
  }
  function natY(x, z) {
    const dx = x - TX, dz = z - TZ, rho = Math.hypot(dx, dz), beta = Math.atan2(dx, dz) / D2R;
    let y = bowlY(rho, beta);
    const wB = sm(52, 30, Math.abs(beta - 25)) * sm(250, 305, rho);
    if (wB > 0) { const rv = XZ2RV(x, z); y += (wallY(rv[0], rv[1]) - y) * wB; }
    y = Math.max(y, spurY(rho, beta));
    const yv = villageY(x, z); if (yv > y) y = yv;
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

  /* ---------- осевая дороги ---------- */
  const DS = 1.0;
  let PATH = null;
  function buildPath() {
    if (PATH) return PATH;
    const raw = [];
    const seg = (a, b, tag, n) => { for (let j = 0; j < n; j++) { const t = j / n; raw.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, tag]); } };
    const cr = (pts, tag, step) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
        for (let j = 0; j < n; j++) {
          const t = j / n, t2 = t * t, t3 = t2 * t;
          const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
          raw.push([f(0), f(1), f(2), tag]);
        }
      }
    };
    // подъезд вдоль подножия (в облаке), мостик через ручей на v ≈ −83
    cr([[349.0, -152, -122.2], [350.6, -128, -122.0], [352.4, -102, -121.6], [355.2, -74, -121.1], [357.6, -52, -120.5], [359, -36, -120]], 'app', 0.5);
    // 7 плеч по 72 м (+11 м, 15 %), каждое — наискось (+6 м по ρ), как зигзаг на фото p5; 6 шпилек R 8 (+3 м)
    for (let i = 0; i < 7; i++) {
      const up = i % 2 === 0, va = up ? -36 : 36, vb = -va, ra = 359 + i * 22, rb = ra + 6, y0 = -120 + i * 14;
      seg([ra, va, y0], [rb, vb, y0 + 11], 'L' + i, 144);
      if (i < 6) { const s = up ? 1 : -1; for (let j = 0; j < 50; j++) { const a = -PI / 2 + PI * j / 50; raw.push([rb + 8 + Math.sin(a) * 8, vb + s * Math.cos(a) * 8, y0 + 11 + 3 * j / 50, 'H' + (i + 1)]); } }
    }
    // выезд к голове долины и седловине над селом
    cr([[497, 36, -25], [499.5, 58, -22.6], [503, 84, -20.6], [506, 108, -19.0], [508, 124, -18.0], [509, 140, -17.4]], 'exit', 0.5);
    raw.push([509, 140, -17.4, 'exit']);
    // в мир, равный шаг, сглаживание плана (переходные кривые) и профиля
    let P = raw.map(p => { const xz = RV2XZ(p[0], p[1]); return { x: xz[0], z: xz[1], y: p[2], tag: p[3] }; });
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
    const A = { N, len: (N - 1) * DS, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), th: new Float32Array(N), lx: new Float32Array(N), lz: new Float32Array(N), k: new Float32Array(N), kabs: new Float32Array(N), r: new Float32Array(N), v: new Float32Array(N), tag: P.map(p => p.tag) };
    P.forEach((p, i) => { A.x[i] = p.x; A.y[i] = p.y; A.z[i] = p.z; const rv = XZ2RV(p.x, p.z); A.r[i] = rv[0]; A.v[i] = rv[1]; });
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), th = Math.atan2(A.x[b] - A.x[a], A.z[b] - A.z[a]);
      A.th[i] = th; A.lx[i] = Math.cos(th); A.lz[i] = -Math.sin(th);
    }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2); A.k[i] = angDiff(A.th[b], A.th[a]) / Math.max(DS, (b - a) * DS); }
    for (let i = 0; i < N; i++) { let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, Math.abs(A.k[clamp(i + k, 0, N - 1)])); A.kabs[i] = m; }
    PATH = A;
    return A;
  }

  /* ---------- волна 4: ветка к отелю — развилка на выезде у верхнего края, ≈ 50 м до ворот села; вверх на бровку ----------
     По research (kubachi_spec2 §1.4) отель — на холме над селом, подъезд «от развилки у верхнего квартала». Здесь — начало
     ветки (≈ 64 м, подъём ≈ 6,5 м, 10 %), щит «Отель» на развилке и облачная шторка в конце (выход toHotel; сам отель —
     отдельный регион). Ветка строится из осевой основной дороги, поэтому её место одно и то же в регионе и вне его. */
  let BRANCH = null;
  function buildBranch() {
    if (BRANCH) return BRANCH;
    const R = buildPath(), iF = R.tag.indexOf('exit') + 40;
    const r0 = R.r[iF], v0 = R.v[iF], y0 = R.y[iF];
    // (Δρ, Δv, Δy) от точки развилки на осевой: первые 8 м — по уровню основной дороги, дальше подъём ≈ 10 %
    const K = [[0, 0, 0], [4.5, 8, 0.05], [11, 14.5, 0.6], [19, 18.5, 1.9], [28, 21, 3.3], [37, 23, 4.6], [46, 26, 5.7], [54, 30, 6.5], [61, 34.5, 7.1]];
    const raw = [];
    for (let i = 0; i < K.length - 1; i++) {
      const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
      for (let j = 0; j < 20; j++) {
        const t = j / 20, t2 = t * t, t3 = t2 * t, f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        const xz = RV2XZ(r0 + f(0), v0 + f(1)); raw.push({ x: xz[0], z: xz[1], y: y0 + f(2) });
      }
    }
    { const L = K[K.length - 1], xz = RV2XZ(r0 + L[0], v0 + L[1]); raw.push({ x: xz[0], z: xz[1], y: y0 + L[2] }); }
    const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
    const Lb = cum[cum.length - 1], P = []; let j = 0;
    for (let s = 0; s <= Lb + 1e-6; s += DS) { while (j < raw.length - 2 && cum[j + 1] < s) j++; const t = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1), a = raw[j], b = raw[j + 1]; P.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t }); }
    const N = P.length, B = { N, len: (N - 1) * DS, iF, sF: iF * DS, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), th: new Float32Array(N), lx: new Float32Array(N), lz: new Float32Array(N), k: new Float32Array(N), kabs: new Float32Array(N), r: new Float32Array(N), v: new Float32Array(N), tag: P.map(() => 'B') };
    P.forEach((p, i) => { B.x[i] = p.x; B.y[i] = p.y; B.z[i] = p.z; const rv = XZ2RV(p.x, p.z); B.r[i] = rv[0]; B.v[i] = rv[1]; });
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), th = Math.atan2(B.x[b] - B.x[a], B.z[b] - B.z[a]); B.th[i] = th; B.lx[i] = Math.cos(th); B.lz[i] = -Math.sin(th); }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2); B.k[i] = angDiff(B.th[b], B.th[a]) / Math.max(DS, (b - a) * DS); }
    for (let i = 0; i < N; i++) { let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, Math.abs(B.k[clamp(i + k, 0, N - 1)])); B.kabs[i] = m; }
    // сторона развилки (относительно хода вверх по основной дороге): +1 — слева, −1 — справа
    B.side = ((B.x[8] - R.x[iF]) * R.lx[iF] + (B.z[8] - R.z[iF]) * R.lz[iF]) > 0 ? 1 : -1;
    BRANCH = B;
    return B;
  }

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
    const Q = HI ? { near: 1.5, far: 9, trees: 96, rocks: 44, tufts: 380, clouds: 2, puffs: 28, snow: 800, shadow: true }
      : { near: 2.4, far: 16, trees: 48, rocks: 26, tufts: 90, clouds: 1, puffs: 8, snow: 400, shadow: false };
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
    const toon = (c, x) => keep(new T.MeshToonMaterial(Object.assign({ color: C(c), gradientMap: GRAD }, x || {})));
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
  vec3 irr = mix(hemiGround, hemiSky, 0.5 * n.y + 0.5) * hemiI + sunCol * (sunI * ramp(max(dot(n, sunDir), 0.0)));
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
    function cheap(o) {
      o = o || {};
      const m = keep(new T.ShaderMaterial({
        uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { diffuse: { value: C(o.color || '#FFFFFF') }, map: { value: null } }]),
        vertexShader: CHEAP_V, fragmentShader: CHEAP_F, defines: o.map ? { USE_TEX: '' } : {}, fog: true, lights: false,
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

    /* --- дорога и её «полоса» --- */
    const R = buildPath(), N = R.N;
    // волна 4: ветка к отелю — в общих массивах после основной дороги (индексы N … N+NBR−1); основная дорога — как раньше (0 … N−1)
    const BR = buildBranch(), NBR = BR.N, NG2 = N + NBR;
    const GX = new Float32Array(NG2), GY = new Float32Array(NG2), GZ = new Float32Array(NG2), GTH = new Float32Array(NG2), GLX = new Float32Array(NG2), GLZ = new Float32Array(NG2), GKA = new Float32Array(NG2), GK = new Float32Array(NG2);
    for (let i = 0; i < NG2; i++) { const A = i < N ? R : BR, j = i < N ? i : i - N; GX[i] = A.x[j]; GY[i] = A.y[j]; GZ[i] = A.z[j]; GTH[i] = A.th[j]; GLX[i] = A.lx[j]; GLZ[i] = A.lz[j]; GKA[i] = A.kabs[j]; GK[i] = A.k[j]; }
    const SEGOK = i => i < N - 1 || (i >= N && i < NG2 - 1);
    const ridOf = i => (i < N ? 0 : 1);
    const SWA = new Float32Array(NG2), SWL = new Float32Array(NG2), SWR = new Float32Array(NG2), BRIDGE = new Uint8Array(NG2);
    let iAp6 = -1; { let km = 0; for (let i = 0; i < N; i++) if (R.tag[i] === 'H6' && Math.abs(R.k[i]) > km) { km = Math.abs(R.k[i]); iAp6 = i; } }
    const pocketSide = R.k[iAp6] > 0 ? -1 : 1;   // карман снаружи шпильки: k > 0 — поворот влево, снаружи — справа
    // центр кармана — там, где наружу смотрит прямо на башню (вид через долину)
    let iPk = iAp6; { let best = -2; for (let i = iAp6 - 12; i <= iAp6 + 6; i++) { const ox = R.lx[i] * pocketSide, oz = R.lz[i] * pocketSide, dx = TOWER.x - R.x[i], dz = TOWER.z - R.z[i], d = Math.hypot(dx, dz), c = (ox * dx + oz * dz) / d; if (c > best) { best = c; iPk = i; } } }
    // волна 4: ещё 4 кармана с лавочками на смотровых точках (плечи L3, L4, L5 и выезд) — со стороны обрыва, к долине и селу
    const dropSide = i => ((R.lx[i] * DB[0] + R.lz[i] * DB[1]) > 0 ? -1 : 1);
    const POCKETS = [{ i: iPk, side: pocketSide, w: 4.6, a: 4, b: 12, main: true }];
    [['L3', 44], ['L4', 46], ['L5', 34], ['exit', 14]].forEach(([tag, off], k) => { const i0 = R.tag.indexOf(tag); if (i0 >= 0) POCKETS.push({ i: clamp(i0 + off, 0, N - 1), side: dropSide(clamp(i0 + off, 0, N - 1)), w: 3.3, a: 3, b: 9, k: k + 1 }); });
    for (let i = 0; i < N; i++) {
      let ka = 0, n = 0; for (let k = -5; k <= 5; k++) { ka += Math.abs(R.k[clamp(i + k, 0, N - 1)]); n++; } ka /= n;
      SWA[i] = 2.0 + 1.0 * sm(0.03, 0.1, ka);
      let pl = 0, pr = 0;
      POCKETS.forEach(p => { const px = p.w * (1 - sm(p.a, p.b, Math.abs(i - p.i) * DS)); if (p.side > 0) pl = Math.max(pl, px); else pr = Math.max(pr, px); });
      SWL[i] = SWA[i] + 0.5 + pl;
      SWR[i] = SWA[i] + 0.5 + pr;
      if (R.tag[i] === 'app' && Math.abs(R.v[i] - STREAM_V(R.r[i])) < 7.5) BRIDGE[i] = 1;
    }
    for (let j = 0; j < NBR; j++) {
      let ka = 0, n = 0; for (let k = -5; k <= 5; k++) { ka += Math.abs(BR.k[clamp(j + k, 0, NBR - 1)]); n++; } ka /= n;
      const i = N + j; SWA[i] = 1.9 + 0.7 * sm(0.03, 0.1, ka); SWL[i] = SWR[i] = SWA[i] + 0.5;
    }
    let iBr = -1; { let best = 1e9; for (let i = 0; i < N; i++) if (BRIDGE[i]) { const d = Math.abs(R.v[i] - STREAM_V(R.r[i])); if (d < best) { best = d; iBr = i; } } }

    // в сетки стенок идёт каждая вторая точка на прямых (на кривых — каждая): меньше треугольников, вид тот же
    const KEEP = new Uint8Array(NG2); for (let i = 0; i < NG2; i++) KEEP[i] = (i % 2 === 0 || i === N - 1 || i === N || i === NG2 - 1 || GKA[i] > 0.02 || Math.abs(SWL[i] - SWR[i]) > 0.05) ? 1 : 0;

    /* --- пространственный хеш отрезков (основная дорога и ветка) --- */
    const HC = 8, HR = 24, hcells = new Map(), hkey = (i, j) => (i + 4096) * 8192 + (j + 4096);
    for (let i = 0; i < NG2 - 1; i++) {
      if (!SEGOK(i)) continue;
      const x0 = Math.min(GX[i], GX[i + 1]) - HR, x1 = Math.max(GX[i], GX[i + 1]) + HR, z0 = Math.min(GZ[i], GZ[i + 1]) - HR, z1 = Math.max(GZ[i], GZ[i + 1]) + HR;
      for (let a = Math.floor(x0 / HC); a <= Math.floor(x1 / HC); a++) for (let b = Math.floor(z0 / HC); b <= Math.floor(z1 / HC); b++) {
        const k = hkey(a, b); let l = hcells.get(k); if (!l) hcells.set(k, l = []); l.push(i);
      }
    }
    const hq = (x, z) => hcells.get(hkey(Math.floor(x / HC), Math.floor(z / HC))) || null;
    const SP = { t: 0, cx: 0, cz: 0, d2: 0 };
    function segP(i, x, z) {
      const ax = GX[i], az = GZ[i], dx = GX[i + 1] - ax, dz = GZ[i + 1] - az, L2 = dx * dx + dz * dz;
      let t = ((x - ax) * dx + (z - az) * dz) / (L2 || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
      SP.t = t; SP.cx = ax + dx * t; SP.cz = az + dz * t; SP.d2 = (x - SP.cx) * (x - SP.cx) + (z - SP.cz) * (z - SP.cz);
      return SP;
    }
    // ближайший отрезок дороги rid (0 — основная, 1 — ветка): локально около подсказки (по номеру), иначе по хешу
    function nearestSeg(x, z, hintS, rid) {
      rid = rid || 0;
      const lo = rid ? N : 0, hi = rid ? NG2 - 2 : N - 2;
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
      const a = i, b = i + 1, cx = GX[a] + (GX[b] - GX[a]) * t, cz = GZ[a] + (GZ[b] - GZ[a]) * t;
      const dx = GX[b] - GX[a], dz = GZ[b] - GZ[a], L = Math.hypot(dx, dz) || 1, lx = dz / L, lz = -dx / L;
      const e = (x - cx) * lx + (z - cz) * lz, rid = ridOf(i), off = rid ? N : 0;
      return { s: (i - off + t) * DS, i, t, x: cx, z: cz, y: GY[a] + (GY[b] - GY[a]) * t, th: Math.atan2(dx, dz), lx, lz, e,
        wl: SWL[a] + (SWL[b] - SWL[a]) * t, wr: SWR[a] + (SWR[b] - SWR[a]) * t, wa: SWA[a] + (SWA[b] - SWA[a]) * t, rid, len: rid ? BR.len : R.len };
    }
    const sampleG = (s, rid) => {
      const off = rid ? N : 0, n = rid ? NBR : N, f = clamp(s / DS, 0, n - 1.0001), i = off + Math.floor(f), t = f - Math.floor(f), j = i + 1;
      const th = GTH[i] + angDiff(GTH[j], GTH[i]) * t;
      return { s, x: lerp(GX[i], GX[j], t), y: lerp(GY[i], GY[j], t), z: lerp(GZ[i], GZ[j], t), th, lx: Math.cos(th), lz: -Math.sin(th), k: lerp(GK[i], GK[j], t),
        wl: lerp(SWL[i], SWL[j], t), wr: lerp(SWR[i], SWR[j], t), wa: lerp(SWA[i], SWA[j], t), tag: rid ? 'B' : R.tag[t < 0.5 ? i : j], rid: rid || 0 };
    };
    // ветка рядом? (грубо: по рамке ветки с запасом) — чтобы основная дорога не платила за проекцию на ветку
    const BBOX = (() => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let j = 0; j < NBR; j++) { x0 = Math.min(x0, BR.x[j]); x1 = Math.max(x1, BR.x[j]); z0 = Math.min(z0, BR.z[j]); z1 = Math.max(z1, BR.z[j]); } return { x0: x0 - 12, x1: x1 + 12, z0: z0 - 12, z1: z1 + 12 }; })();
    const nearBranch = (x, z) => x > BBOX.x0 && x < BBOX.x1 && z > BBOX.z0 && z < BBOX.z1;
    const road = {
      len: R.len, N, DS,
      project(x, z, hintS) { const [i, t] = nearestSeg(x, z, hintS, 0); return mkProj(i, t, x, z); },
      sample(s) { return sampleG(s, 0); },
      kmax(s, ahead) { const i0 = clamp(Math.floor(s / DS), 0, N - 1), i1 = clamp(Math.ceil((s + Math.max(0, ahead)) / DS), 0, N - 1); let m = 0; for (let i = i0; i <= i1; i++) if (R.kabs[i] > m) m = R.kabs[i]; return m; },
      sOfTag(tag) { const i = R.tag.indexOf(tag); return i < 0 ? null : i * DS; },
      // волна 4: ветка к отелю и «площадь» дороги для мягкого края машины и ходьбы
      branch: { len: BR.len, sF: BR.sF, side: BR.side, project(x, z, hintS) { const [i, t] = nearestSeg(x, z, hintS, 1); return mkProj(i, t, x, z); }, sample(s) { return sampleG(s, 1); } },
      // все полотна рядом с точкой: [основная, ветка?] — проекции { s, e, wl, wr, th, lx, lz, rid, len }; машина и героиня
      // остаются в объединении полотен (развилка проходима, край — мягкий)
      areas(x, z, hintS, hintB) {
        const a = [road.project(x, z, hintS)];
        if (nearBranch(x, z)) a.push(road.branch.project(x, z, hintB));
        return a;
      },
      // покрытие под точкой: { kind: 'asph'|'gravel'|'earth'|'mud'|'puddle'|'hole', wet 0..1, dz (м: яма −, камень +), rough 0..1 }
      surface(x, z, hintS) { const a = road.areas(x, z, hintS); let p = a[0]; if (a[1] && Math.abs(a[1].e) - a[1].wl < Math.abs(p.e) - p.wl) p = a[1]; return surfSE(p.s, p.e, p.rid); },
      surfaceSE(s, e, rid) { return surfSE(s, e, rid || 0); },
    };
    // точка на полотне любой дороги (с отступом pad от края полотна); для ходьбы, деревьев, камней
    function onRoad(x, z, pad) {
      const l = hq(x, z); if (!l) return false;
      for (const i of l) { segP(i, x, z); if (SP.d2 > 144) continue; const p = mkProj(i, SP.t, x, z), W = p.e > 0 ? p.wl : p.wr; if (Math.abs(p.e) <= W + (pad || 0)) return true; }
      return false;
    }

    /* --- волна 4: покрытие «старой» горной дороги — бледные заплатки асфальта, щебень, укатанная земля, ямы, лужи, грязь, камни ---
       По отчётам (spec2 §7): узко, выбоины, колеи, острые камни, щебень на внутренней стороне петель, лужи и грязь в низинах,
       редкие куски старого асфальта. SURF — вид полотна по точкам (0 асфальт, 1 щебень, 2 грунт), WET — сырость 0..1,
       FEAT — пятна в координатах дороги (s, e): ямы, лужи, грязь, камни на полотне (для подвески и брызг). */
    const SURF = new Uint8Array(NG2), WET = new Float32Array(NG2), ROUGH = new Float32Array(NG2);
    const FEAT = [[], []], FB = [new Map(), new Map()], FBS = 4;
    {
      const rs = rng(4242 + (WIN ? 3 : 0));
      for (let i = 0; i < NG2; i++) {
        const rid = ridOf(i), j = rid ? i - N : i, s = j * DS, tag = rid ? 'B' : R.tag[i];
        const n1 = vnoise(s * 0.021 + rid * 17 + 3.1, 1.7), n2 = vnoise(s * 0.07 + 9.3, rid * 5 + 4.2);
        let kind = n1 < 0.36 ? 0 : n1 < 0.6 ? 1 : 2;
        if (tag[0] === 'H') kind = n2 < 0.3 ? 0 : 1;                 // шпильки подсыпают щебнем
        if (tag === 'app') kind = n1 < 0.28 ? 0 : 2;                 // внизу, у ручья — больше грунта
        if (rid) kind = j < 6 ? SURF[BR.iF] : n1 < 0.5 ? 1 : 2;      // ветка: щебень и грунт (spec2 §1.4: «покрытие хуже»)
        SURF[i] = kind;
        let w = 0;
        if (!rid && iBr >= 0) w = Math.max(w, 1 - sm(4, 30, Math.abs(i - iBr) * DS));   // у мостика сыро
        if (tag === 'app') w = Math.max(w, 0.35 * sm(0.45, 0.7, n2));
        if (tag[0] === 'H') w = Math.max(w, 0.3 * sm(0.55, 0.8, n2));
        w = Math.max(w, sm(0.72, 0.86, vnoise(s * 0.05 + 21, rid * 3 + 0.5)) * 0.8);
        WET[i] = w;
        ROUGH[i] = kind === 0 ? 0.25 : kind === 1 ? 0.75 : 0.5;
      }
      // пятна по полотну
      const put = (rid, f) => { FEAT[rid].push(f); const a = Math.floor((f.s - f.a - 0.5) / FBS), b = Math.floor((f.s + f.a + 0.5) / FBS); for (let k = a; k <= b; k++) { let l = FB[rid].get(k); if (!l) FB[rid].set(k, l = []); l.push(f); } };
      const ok = (rid, s, e, a, b) => FEAT[rid].every(f => Math.abs(f.s - s) > f.a + a + 0.3 || Math.abs(f.e - e) > f.b + b + 0.3);
      const pocketAt = i => POCKETS.some(p => Math.abs(i - p.i) * DS < p.b + 2);
      [[0, N], [1, NBR]].forEach(([rid, n]) => {
        const off = rid ? N : 0, len = (n - 1) * DS;
        // ямы: чаще на асфальте и грунте; глубина 6–9 см
        const nh = Math.round(len / (HI ? 9 : 10));
        for (let k = 0, tries = 0; k < nh && tries < nh * 8; tries++) {
          const s = 6 + rs() * (len - 12), i = off + Math.round(s / DS); if (!rid && (BRIDGE[i] || pocketAt(i))) continue;
          if (SURF[i] === 1 && rs() < 0.5) continue;
          const wa = SWA[i], e = (rs() * 2 - 1) * (wa - 0.45), a = 0.32 + rs() * 0.38, b = 0.26 + rs() * 0.3;
          if (!ok(rid, s, e, a, b)) continue;
          put(rid, { kind: 'hole', s, e, a, b, rot: (rs() - 0.5) * 0.8, depth: 0.06 + rs() * 0.03 }); k++;
        }
        // лужи: в сырых местах, часто поперёк колеи; глубина 3 см, грязь вокруг
        const np = Math.round(len / (HI ? 26 : 30));
        for (let k = 0, tries = 0; k < np && tries < np * 12; tries++) {
          const s = 8 + rs() * (len - 16), i = off + Math.round(s / DS); if (!rid && (BRIDGE[i] || pocketAt(i))) continue;
          if (WET[i] < 0.25 && rs() < 0.75) continue;
          const wa = SWA[i], a = 0.8 + rs() * rs() * 1.5, b = 0.5 + rs() * 0.6, e = (rs() * 2 - 1) * Math.max(0, wa - b - 0.2);
          if (!ok(rid, s, e, a + 0.4, b + 0.3)) continue;
          put(rid, { kind: 'puddle', s, e, a, b, rot: (rs() - 0.5) * 0.5, depth: 0.035 }); k++;
        }
        // грязь: бурые сырые пятна (без воды), брызги из-под колёс
        const nm = Math.round(len / (HI ? 22 : 26));
        for (let k = 0, tries = 0; k < nm && tries < nm * 10; tries++) {
          const s = 6 + rs() * (len - 12), i = off + Math.round(s / DS); if (!rid && (BRIDGE[i] || pocketAt(i))) continue;
          if (SURF[i] === 0 && rs() < 0.7) continue;
          const wa = SWA[i], a = 0.8 + rs() * 1.2, b = 0.6 + rs() * 0.6, e = (rs() * 2 - 1) * Math.max(0, wa - b);
          if (!ok(rid, s, e, a, b)) continue;
          put(rid, { kind: 'mud', s, e, a, b, rot: (rs() - 0.5) * 0.6, depth: 0.012 }); k++;
        }
        // камни на полотне (острые, но мелкие): по ним машина подпрыгивает; в колеях реже
        const ns = Math.round(len / (HI ? 5 : 7));
        for (let k = 0, tries = 0; k < ns && tries < ns * 6; tries++) {
          const s = 3 + rs() * (len - 6), i = off + Math.round(s / DS); if (!rid && BRIDGE[i]) continue;
          const wa = SWA[i], e = (rs() * 2 - 1) * (wa - 0.15);
          if (Math.abs(Math.abs(e) - 0.75) < 0.2 && rs() < 0.6) continue;
          const r = 0.07 + rs() * rs() * 0.09;
          if (!ok(rid, s, e, r, r)) continue;
          put(rid, { kind: 'stone', s, e, a: r, b: r, rot: rs() * 6.28, depth: r * 0.75 }); k++;
        }
      });
    }
    const SURF_NAMES = ['asph', 'gravel', 'earth'];
    const SRES = { kind: 'gravel', wet: 0, dz: 0, rough: 0.5, s: 0, e: 0, rid: 0 };
    function surfSE(s, e, rid) {
      const off = rid ? N : 0, n = rid ? NBR : N, i = off + clamp(Math.round(s / DS), 0, n - 1);
      let kind = SURF_NAMES[SURF[i]], wet = WET[i], dz = 0, rough = ROUGH[i];
      const W = e > 0 ? SWL[i] : SWR[i];
      if (Math.abs(e) > SWA[i]) { kind = 'gravel'; rough = 0.7; }     // обочина — щебень
      const l = FB[rid ? 1 : 0].get(Math.floor(s / FBS));
      if (l) for (const f of l) {
        const ds = s - f.s, de = e - f.e, c = Math.cos(f.rot), sn = Math.sin(f.rot), u = (ds * c - de * sn) / f.a, v = (ds * sn + de * c) / f.b, q = u * u + v * v;
        if (q >= 1) continue;
        if (f.kind === 'hole') { dz = Math.min(dz, -f.depth * (1 - q)); kind = 'hole'; rough = Math.max(rough, 0.9); }
        else if (f.kind === 'puddle') { dz = Math.min(dz, -f.depth * sm(1, 0.6, q)); kind = 'puddle'; wet = 1; }
        else if (f.kind === 'mud') { if (kind !== 'puddle' && kind !== 'hole') kind = 'mud'; wet = Math.max(wet, 0.85); }
        else if (f.kind === 'stone') { dz = Math.max(dz, f.depth * (1 - q)); }
      }
      if (Math.abs(e) > W + 0.05) kind = 'verge';
      SRES.kind = kind; SRES.wet = wet; SRES.dz = dz; SRES.rough = rough; SRES.s = s; SRES.e = e; SRES.rid = rid || 0;
      return SRES;
    }

    /* --- рельеф с врезанной дорогой: полоса на уровне дороги, выше — скальная выемка, ниже — стенка и насыпь --- */
    const CUT = 1.8, FILL = 0.9, WALLMAX = 3.2, SINK = 0.22;
    function shaped(x, z, yn, out) {
      const l = hq(x, z);
      let flatY = null, flatD = 1e9, hi = Infinity, lo = -Infinity, near = 1e9;
      if (l) for (const i of l) {
        if (BRIDGE[i] && BRIDGE[i + 1]) continue;
        segP(i, x, z); const d = Math.sqrt(SP.d2); if (d > HR) continue;
        const t = SP.t, yr = GY[i] + (GY[i + 1] - GY[i]) * t;
        const dx = GX[i + 1] - GX[i], dz = GZ[i + 1] - GZ[i], L = Math.hypot(dx, dz) || 1, e = (x - SP.cx) * dz / L + (z - SP.cz) * -dx / L;
        const W = e > 0 ? SWL[i] + (SWL[i + 1] - SWL[i]) * t : SWR[i] + (SWR[i + 1] - SWR[i]) * t;
        const margin = 0.15 + Q.near * 1.45 * sm(-1.0, 1.0, yn - yr);   // на стороне выемки — не меньше диагонали клетки: склон не налезает на обочину
        const ex = d - (W + margin);
        if (d - W < near) near = d - W;
        if (ex <= 0) { if (d - W < flatD) { flatD = d - W; flatY = yr - SINK; } }
        else { const a = yr - SINK + CUT * ex, b = yr - SINK - WALLMAX - FILL * ex; if (a < hi) hi = a; if (b > lo) lo = b; }
      }
      if (out) { out.near = near; out.flat = flatY !== null; }
      if (flatY !== null) return flatY;
      return Math.min(Math.max(yn, lo), hi);
    }

    /* --- ближняя решётка рельефа в осях склона (ρ, v), только клетки у дороги --- */
    const g = Q.near;
    let rMin = 1e9, rMax = -1e9, vMin = 1e9, vMax = -1e9;
    for (let i = 0; i < N; i++) { rMin = Math.min(rMin, R.r[i]); rMax = Math.max(rMax, R.r[i]); vMin = Math.min(vMin, R.v[i]); vMax = Math.max(vMax, R.v[i]); }
    for (let j = 0; j < NBR; j++) { rMin = Math.min(rMin, BR.r[j]); rMax = Math.max(rMax, BR.r[j]); vMin = Math.min(vMin, BR.v[j]); vMax = Math.max(vMax, BR.v[j]); }
    rMin -= HR + 2; rMax += HR + 2; vMin -= HR + 2; vMax += HR + 2;
    const NA = Math.ceil((rMax - rMin) / g) + 1, NB = Math.ceil((vMax - vMin) / g) + 1;
    const NG = { r0: rMin, v0: vMin, g, NA, NB, h: new Float32Array(NA * NB).fill(NaN), dev: new Float32Array(NA * NB).fill(NaN), verge: new Uint8Array(NA * NB), act: new Uint8Array((NA - 1) * (NB - 1)) };
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
      NG.h[k] = y; NG.dev[k] = y - yn; NG.verge[k] = tmpO.flat ? 1 : tmpO.near < 4.5 ? 2 : 0;
    }
    function nearY(x, z) {
      const rv = XZ2RV(x, z), fa = (rv[0] - NG.r0) / g, fb = (rv[1] - NG.v0) / g, a = Math.floor(fa), b = Math.floor(fb);
      if (a < 0 || b < 0 || a >= NA - 1 || b >= NB - 1 || !NG.act[a + b * (NA - 1)]) return null;
      const u = fa - a, w = fb - b, k = a + b * NA, h00 = NG.h[k], h10 = NG.h[k + 1], h01 = NG.h[k + NA], h11 = NG.h[k + NA + 1];
      return u + w <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * w : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - w);
    }

    /* --- дальний рельеф: прямоугольная сетка с мелким шагом в середине и крупным по краям --- */
    const axis = (lo, hi, fLo, fHi, fs, cs) => { const a = []; for (let x = lo; x < fLo; x += cs) a.push(x); for (let x = fLo; x < fHi; x += fs) a.push(x); for (let x = fHi; x <= hi; x += cs) a.push(x); return a; };
    const FX = axis(-1500, 1680, -340, 560, Q.far, HI ? 90 : 120), FZ = axis(-1320, 1800, -270, 610, Q.far, HI ? 90 : 120);
    const FH = new Float32Array(FX.length * FZ.length);
    const devR = Math.ceil(11 / g);
    for (let j = 0; j < FZ.length; j++) for (let i = 0; i < FX.length; i++) {
      const x = FX[i], z = FZ[j]; let y = natY(x, z);
      const rv = XZ2RV(x, z), fa = Math.round((rv[0] - NG.r0) / g), fb = Math.round((rv[1] - NG.v0) / g);
      if (fa > -devR && fb > -devR && fa < NA + devR && fb < NB + devR) {
        let dmin = 1e9, any = false;
        for (let bb = Math.max(0, fb - devR); bb <= Math.min(NB - 1, fb + devR); bb++) for (let aa = Math.max(0, fa - devR); aa <= Math.min(NA - 1, fa + devR); aa++) { const d = NG.dev[aa + bb * NA]; if (d === d) { any = true; if (d < dmin) dmin = d; } }
        if (any) { y += Math.min(0, dmin) - 0.35; if (nearY(x, z) !== null) { const l = hq(x, z); if (l) { let m = 1e9; for (const s of l) { segP(s, x, z); if (SP.d2 < m) m = SP.d2; } if (m < 144) y -= 3; } } }
      }
      FH[i + j * FX.length] = y;
    }
    function farY(x, z) {
      if (x < FX[0] || x > FX[FX.length - 1] || z < FZ[0] || z > FZ[FZ.length - 1]) return natY(x, z);
      let i = 0, j = 0; { let lo = 0, hi = FX.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (FX[m] <= x) lo = m; else hi = m; } i = lo; }
      { let lo = 0, hi = FZ.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (FZ[m] <= z) lo = m; else hi = m; } j = lo; }
      const u = (x - FX[i]) / (FX[i + 1] - FX[i]), w = (z - FZ[j]) / (FZ[j + 1] - FZ[j]), W = FX.length, k = i + j * W;
      const h00 = FH[k], h10 = FH[k + 1], h01 = FH[k + W], h11 = FH[k + W + 1];
      return u + w <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * w : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - w);
    }
    // земля: на дороге — полотно, рядом — ближняя решётка, дальше — дальняя
    function ground(x, z) {
      const l = hq(x, z);
      if (l) {
        let best = -1, bd = 1e18, bt = 0;
        for (const i of l) { segP(i, x, z); if (SP.d2 < bd) { bd = SP.d2; best = i; bt = SP.t; } }
        if (best >= 0 && bd < 100) {
          const p = mkProj(best, bt, x, z), W = p.e > 0 ? p.wl : p.wr;
          if (Math.abs(p.e) <= W + 0.3) return p.y;   // волна 4: кромка — ещё полотно (колесо на краю не «проваливается»)
        }
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
        if (rock > 0) { cTmp.copy(((y * 0.8 + n2 * 0.7) % 1 + 1) % 1 < 0.5 ? cc.rock : cc.rock2); out.lerp(cTmp, rock * 0.85); }
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
        const band = ((y / 1.15 + n2 * 0.5) % 1 + 1) % 1;
        cTmp.copy(band < 0.55 ? cc.rock : cc.rock2); if (n1 > 0.74) cTmp.lerp(cc.lichen, 0.35);
        out.lerp(cTmp, rock);
      }
      if (verge === 1) out.lerp(cVerge, 0.75); else if (verge === 2) out.lerp(cGravel, 0.18);
      return out;
    }

    /* ---------- геометрия: ближняя решётка ---------- */
    const meshes = {};
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
      const nTop = nv;
      // юбка вниз по краю (обе стороны)
      skirtQ.forEach(([a0, b0, a1, b1]) => {
        const k0 = a0 + b0 * NA, k1 = a1 + b1 * NA, p0 = RV2XZ(NG.r0 + a0 * g, NG.v0 + b0 * g), p1 = RV2XZ(NG.r0 + a1 * g, NG.v0 + b1 * g);
        const i0 = nv; P.push(p0[0], NG.h[k0], p0[1], p1[0], NG.h[k1], p1[1], p0[0], NG.h[k0] - 6, p0[1], p1[0], NG.h[k1] - 6, p1[1]); nv += 4;
        I.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2, i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      });
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      geo.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, col = new Float32Array(nv * 3);
      for (let i = nTop; i < nv; i++) nrm.setXYZ(i, 0, 1, 0);   // юбка: свет как у земли (у двусторонних граней нормаль иначе нулевая)
      // обратная карта вершина → узел (для цвета у дороги)
      const vk = new Int32Array(nTop); for (let k = 0; k < map.length; k++) if (map[k] >= 0) vk[map[k]] = k;
      for (let i = 0; i < nv; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        const ny = i < nTop ? nrm.getY(i) : 0.4;
        groundColor(cTmp2, x, y, z, ny, i < nTop ? NG.verge[vk[i]] : 0, false);
        col[i * 3] = cTmp2.r; col[i * 3 + 1] = cTmp2.g; col[i * 3 + 2] = cTmp2.b;
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const m = chunked(geo, vcMat, { cell: 64, renderOrder: -4, name: 'terrainNear' }); root.add(m); meshes.near = m;
    }
    /* ---------- дальний рельеф ---------- */
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
      const mat = cheap({ polygonOffset: true, pof: 1, pou: 2 });
      const m = chunked(geo, mat, { cell: 240, bigCell: 1200, bigEdge: 40, renderOrder: 10, name: 'terrainFar', receive: false }); root.add(m); meshes.far = m;
    }

    /* ---------- текстуры: бут, облака, пух, указатели ---------- */
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
      const [cv, c] = cnv(1024, 512);
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
      // E / F (волна 4): «Отель» на развилке — коричневый туристический щит; стрелка — в сторону ветки (для едущих вверх / вниз)
      const brSide = buildBranch().side;
      const diag = (x, y, s, col, ang) => { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.8, -s * 0.15); c.lineTo(s * 0.3, -s * 0.15); c.lineTo(s * 0.3, s); c.lineTo(-s * 0.3, s); c.lineTo(-s * 0.3, -s * 0.15); c.lineTo(-s * 0.8, -s * 0.15); c.closePath(); c.fill(); c.restore(); };
      c.fillStyle = '#7A4E2D'; rr(724, 344, 292, 116, 18); c.fill(); c.strokeStyle = '#FFF6EA'; c.lineWidth = 6; rr(733, 353, 274, 98, 12); c.stroke();
      txt('Отель', 840, 403, 62, '#FFF6EA', 170); diag(962, 402, 34, '#FFF6EA', brSide < 0 ? PI / 4 : -PI / 4);
      c.fillStyle = '#7A4E2D'; rr(604, 144, 292, 90, 16); c.fill(); c.strokeStyle = '#FFF6EA'; c.lineWidth = 5; rr(612, 152, 276, 74, 10); c.stroke();
      txt('Отель', 720, 190, 50, '#FFF6EA', 150); diag(846, 189, 28, '#FFF6EA', brSide < 0 ? -PI / 2 : PI / 2);
      const t = keep(new T.CanvasTexture(cv)); t.anisotropy = 4;
      return { tex: t, uv: { A: [0, 0, 600, 220], B: [600, 0, 400, 140], C: [0, 240, 700, 200], D: [720, 240, 280, 100], E: [724, 344, 292, 116], F: [604, 144, 292, 90], W: [1004, 4, 16, 16] } };
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

    /* ---------- 4B: террасы на склоне с серпантином (spec2 §6): широкие ступени по горизонталям ниже и выше полотна,
       между петлями; полосы обходят дорогу и ветку (≥ 11 м от оси); общий построитель VILLAGE.vkit.terraces ---------- */
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
      const okT = (x, z) => { const l = hq(x, z); if (l) for (const i of l) { segP(i, x, z); if (SP.d2 < 121) return false; } const rv = XZ2RV(x, z); return rv[0] > 296; };
      terrStats = VK.terraces({ cx: TX, cz: TZ, fields: [{ b0: -6, b1: 30, r0: 300, r1: 548 }, { b0: 30, b1: 66, r0: 300, r1: 548 }], surf: surfT, ok: okT, tread: adapt, wall: adapt, winter: WIN, seed: 5151,
        segL: HI ? 5 : 6.5, dr: 2, step: 2.3, stepVar: 0.8, kant: HI, two: HI, pathEvery: 14 });
      if (TB2.n) { const m = TB2.mesh(vcMat); const mc = chunked(m.geometry, vcMat, { cell: 110, renderOrder: -3, name: 'terraces' }); root.add(mc); meshes.terraces = mc; }
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
      const rid = ridOf(i), s = (rid ? i - N : i) * DS, k = SURF[i], wa = SWA[i];
      const n = vnoise(s * 0.31 + rid * 7.7, e * 0.75 + 3.3), n2 = vnoise(s * 1.3 + 11, e * 2.1 - 5);
      if (k === 0) { out.copy(SC.asph).lerp(SC.patch, sm(0.55, 0.75, n) * 0.85); if (n < 0.22 || Math.abs(e) > wa - 0.3 + 0.25 * n2) out.lerp(SC.gravel2, 0.75); }
      else if (k === 1) { out.copy(SC.gravel).lerp(SC.gravel2, sm(0.35, 0.75, n2)); if (n > 0.76) out.lerp(SC.asph, 0.75); }
      else { out.copy(SC.earth).lerp(SC.earth2, sm(0.3, 0.8, n2)); if (Math.abs(e) < 0.24) out.lerp(SC.grass, 0.35 * sm(0.3, 0.7, n)); if (n > 0.8) out.lerp(SC.gravel, 0.5); }
      const rk = rutK(e) * (k === 0 ? 0.25 : 0.7);
      if (rk > 0) out.lerp(k === 0 ? SC.rutA : SC.rut, rk);
      const w = WET[i] * (0.35 + 0.65 * rutK(e)) * sm(0.3, 0.65, n2 * 0.6 + 0.4 * n);
      if (w > 0) out.lerp(SC.wet, w * 0.65);
      // 4B: крупные пятна — сырая тёмная земля и светлые высохшие проплешины; у края — мелкий щебень светлее
      const n3 = vnoise(s * 0.09 + rid * 3.3 + 40, e * 0.35 + 8.1);
      if (k) { out.lerp(SC.damp, sm(0.62, 0.8, n3) * 0.45); out.multiplyScalar(1.0 + 0.08 * sm(0.3, 0.12, n3)); }
      if (Math.abs(e) > wa - 0.45) out.lerp(SC.gravel, 0.25 * sm(wa - 0.45, wa - 0.1, Math.abs(e)));
      return out;
    }
    const roadBk = new Bk(), wetBk = new Bk(), UVK = 1 / 1.7;   // 4B: uv по миру — мелкий щебень и трещины текстурой; лужи — своя сетка с отражением неба
    {
      const bk = roadBk;
      const IN_E = [1.55, 1.05, RUT_E + RUT_W, RUT_E, RUT_E - RUT_W, 0.24, 0, -0.24, -(RUT_E - RUT_W), -RUT_E, -(RUT_E + RUT_W), -1.05, -1.55];
      [[0, N - 1], [N, NG2 - 1]].forEach(([i0, i1]) => {
        const rows = [];
        for (let i = i0; i <= i1; i++) {
          const wl = SWL[i], wr = SWR[i], wa = SWA[i], y = GY[i], lx = GLX[i], lz = GLZ[i], x0 = GX[i], z0 = GZ[i];
          // ветка у развилки — на 12 мм ниже основной дороги (там, где полотна накладываются, видна основная)
          const yo = i >= N ? -0.012 * (1 - sm(14, 22, i - N)) : 0;
          const shL = wl - wa > 1.2 ? SC.pocket : SC.shoulder, shR = wr - wa > 1.2 ? SC.pocket : SC.shoulder;
          const edgeL = surfColor(cS, i, wa).clone(), edgeR = surfColor(cS, i, -wa).clone();
          const shLc = cS2.copy(shL).lerp(edgeL, 0.25).clone(), shRc = cS2.copy(shR).lerp(edgeR, 0.25).clone();
          const cols = [[wl, -0.5, SC.skirt], [wl, 0, shL], [wa, 0.005, shLc], [wa, 0.005, edgeL]];
          IN_E.forEach(e => { if (Math.abs(e) < wa - 0.05) cols.push([e, roadDy(i, e), surfColor(cS, i, e).clone()]); else cols.push([Math.sign(e) * (wa - 0.05), 0.006, (e > 0 ? edgeL : edgeR)]); });
          cols.push([-wa, 0.005, edgeR], [-wa, 0.005, shRc], [-wr, 0, shR], [-wr, -0.5, SC.skirt]);
          rows.push(cols.map(([e, dy, c]) => { const X = x0 + lx * e, Z = z0 + lz * e; return bk.v(X, y + dy + 0.01 + yo, Z, 0, 1, 0, c, X * UVK, Z * UVK); }));
        }
        const nc = rows[0].length, skip = new Set([2, nc - 4]);
        for (let q = 0; q < rows.length - 1; q++) for (let c = 0; c < nc - 1; c++) { if (skip.has(c)) continue; const a = rows[q][c], b = rows[q][c + 1], d = rows[q + 1][c], e = rows[q + 1][c + 1]; bk.I.push(a, b, d, b, e, d); }
      });
      // точка полотна по (s, e) дороги rid — на высоте сетки полотна (+ lift)
      const at = (rid, s, e, lift) => { const q = sampleG(s, rid), i = (rid ? N : 0) + clamp(Math.round(s / DS), 0, (rid ? NBR : N) - 1); return [q.x + q.lx * e, q.y + roadDy(i, e) + 0.01 + lift + (rid ? -0.012 * (1 - sm(14, 22, s / DS)) : 0), q.z + q.lz * e]; };
      // пятна: кольца эллипса (масштаб, цвет) — от края к центру; центр — отдельная вершина
      const blob = (rid, f, rings, lift, wobble, B) => {
        const bk = B || roadBk;
        const M = f.kind === 'hole' ? 10 : HI ? 18 : 14, c = Math.cos(f.rot), sn = Math.sin(f.rot), base = bk.n, rr = rng(Math.floor(f.s * 131 + f.e * 977) & 0xffff);
        // мягкий неровный край: две гармоники (без «многоугольника»)
        const p1 = rr() * 6.28, p2 = rr() * 6.28, wob = []; for (let m = 0; m < M; m++) { const a = m / M * PI * 2; wob.push(1 + wobble * (0.32 * Math.sin(2 * a + p1) + 0.2 * Math.sin(3 * a + p2))); }
        rings.forEach(([sc, col]) => { for (let m = 0; m < M; m++) { const a = m / M * PI * 2, u = Math.cos(a) * f.a * sc * wob[m], v = Math.sin(a) * f.b * sc * wob[m]; const p = at(rid, f.s + u * c + v * sn, f.e - u * sn + v * c, lift); bk.v(p[0], p[1], p[2], 0, 1, 0, col, p[0] * UVK, p[2] * UVK); } });
        const cc = rings[rings.length - 1][2] || rings[rings.length - 1][1], pc = at(rid, f.s, f.e, lift); const ic = bk.v(pc[0], pc[1], pc[2], 0, 1, 0, cc, pc[0] * UVK, pc[2] * UVK);
        // ориентация: нормаль вверх — обход против часовой при взгляде сверху (как у полотна)
        const flip = (() => { const p0 = at(rid, f.s, f.e, 0), p1 = at(rid, f.s + 0.5, f.e, 0), p2 = at(rid, f.s, f.e + 0.5, 0); const ax = p1[0] - p0[0], az = p1[2] - p0[2], bx = p2[0] - p0[0], bz = p2[2] - p0[2]; return az * bx - ax * bz < 0; })();
        const tri = (a, b, d) => { if (flip) bk.I.push(a, d, b); else bk.I.push(a, b, d); };
        for (let r = 0; r < rings.length - 1; r++) for (let m = 0; m < M; m++) { const a = base + r * M + m, b = base + r * M + (m + 1) % M, a2 = a + M, b2 = b + M; tri(a, b, a2); tri(b, b2, a2); }
        const lr = base + (rings.length - 1) * M; for (let m = 0; m < M; m++) tri(lr + m, lr + (m + 1) % M, ic);
      };
      [0, 1].forEach(rid => FEAT[rid].forEach(f => {
        // 4B: яма — светлая кромка, тёмная глубина (центр темнее), иногда с водой; лужа — грязевой ободок, вода с отражением неба (своя сетка)
        if (f.kind === 'hole') { blob(rid, f, [[1.24, SC.holeRim], [1.0, SC.hole], [0.62, SC.holeC], [0.25, SC.holeC]], 0.014, 0.25); if ((Math.floor(f.s * 7.3) % 4) === 0 && WET[(rid ? N : 0) + clamp(Math.round(f.s / DS), 0, (rid ? NBR : N) - 1)] > 0.2) blob(rid, Object.assign({}, f, { a: f.a * 0.7, b: f.b * 0.7 }), [[1.0, SC.water], [0.5, SC.waterC, SC.waterC]], 0.02, 0.2, wetBk); }
        else if (f.kind === 'puddle') { blob(rid, f, [[1.36, SC.mudRim], [1.14, SC.mud], [0.9, SC.mudC]], 0.016, 0.3); blob(rid, f, [[1.0, SC.water], [0.55, SC.waterC], [0.2, SC.waterC, SC.waterC]], 0.022, 0.3, wetBk); }
        else if (f.kind === 'mud') blob(rid, f, [[1.06, SC.mudRim], [0.8, SC.mud], [0.42, SC.mudC]], 0.012, 0.45);
      }));
      // камни: на полотне (их чувствует подвеска), по обочинам и щебень на внутренней стороне петель (только вид)
      const rockG = new T.OctahedronGeometry(1, 0);   // 8 треугольников на камень (мелочь — грани не видны)
      const putStone = (x, y, z, r, sy, ry, col) => {
        bk.geo(rockG, mtx(x, y + r * sy * 0.35, z, ry, r, r * sy, r * (0.8 + 0.4 * ((ry * 7.3) % 1))), WIN ? (i, p, nn) => (nn.getY(i) > 0.45 ? SC.snow : col) : col, (u, w, i, p) => [p.getX(i) * UVK, p.getZ(i) * UVK]);
      };
      const rs2 = rng(77 + (WIN ? 1 : 0));
      [0, 1].forEach(rid => FEAT[rid].forEach(f => { if (f.kind !== 'stone') return; const p = at(rid, f.s, f.e, -0.01); putStone(p[0], p[1], p[2], f.a, 0.6, f.rot, SC.stones[Math.floor(rs2() * SC.stones.length)]); }));
      const nVis = HI ? 900 : 520;   // 4B: больше щебня по краям и внутри петель
      for (let k = 0, tries = 0; k < nVis && tries < nVis * 4; tries++) {
        const i = Math.floor(rs2() * NG2), rid = ridOf(i), j = rid ? i - N : i; if (!rid && BRIDGE[i]) continue;
        const inner = GK[i] > 0 ? 1 : -1, hair = GKA[i] > 0.04;
        let e;
        if (hair && rs2() < 0.6) e = inner * (SWA[i] * (0.35 + rs2() * 0.7));          // щебень внутри петли
        else { const sd = rs2() < 0.5 ? 1 : -1, W = sd > 0 ? SWL[i] : SWR[i]; e = sd * (SWA[i] - 0.1 + rs2() * (W - SWA[i] + 0.05)); }   // обочина и край
        const r = 0.04 + rs2() * rs2() * (Math.abs(e) > SWA[i] ? 0.2 : 0.07);
        const sj = j * DS + (rs2() - 0.5); if (Math.abs(e) < SWA[i] && surfSE(sj, e, rid).kind === 'puddle') continue;   // 4B: в лужах камешков нет (торчали сквозь воду)
        const p = at(rid, sj, e, -0.012);
        putStone(p[0], p[1], p[2], r, 0.5 + rs2() * 0.4, rs2() * 6.28, SC.stones[Math.floor(rs2() * SC.stones.length)]);
        k++;
      }
      // 4B: камни в ямах и валуны по обочинам (за краем полотна — на земле склона)
      [0, 1].forEach(rid => FEAT[rid].forEach(f => { if (f.kind !== 'hole') return; for (let k = 0; k < 2; k++) { const p = at(rid, f.s + (rs2() - 0.5) * f.a, f.e + (rs2() - 0.5) * f.b, -0.03); putStone(p[0], p[1], p[2], 0.05 + rs2() * 0.04, 0.6, rs2() * 6.28, SC.stones[Math.floor(rs2() * SC.stones.length)]); } }));
      const icoG = new T.IcosahedronGeometry(1, 0), nRock = HI ? 320 : 200;
      for (let k = 0, tries = 0; k < nRock && tries < nRock * 5; tries++) {
        const i = Math.floor(rs2() * NG2), rid = ridOf(i), j = rid ? i - N : i; if (!rid && BRIDGE[i]) continue;
        const sd = rs2() < 0.5 ? 1 : -1, W = sd > 0 ? SWL[i] : SWR[i], e = sd * (W - 0.15 + rs2() * 1.5), q = sampleG(j * DS + (rs2() - 0.5) * 2, rid), x = q.x + q.lx * e, z = q.z + q.lz * e;
        const r = 0.16 + rs2() * rs2() * 0.42, y = Math.abs(e) > W + 0.05 ? ground(x, z) : at(rid, j * DS, e, 0)[1], col = SC.rocks[Math.floor(rs2() * SC.rocks.length)];
        bk.geo(icoG, mtx(x, y + r * 0.18, z, rs2() * 6.28, r * (0.9 + rs2() * 0.5), r * (0.55 + rs2() * 0.3), r * (0.8 + rs2() * 0.4), (rs2() - 0.5) * 0.4, (rs2() - 0.5) * 0.4), WIN ? (ii, p, nn) => (nn.getY(ii) > 0.4 ? SC.snow : col) : (ii, p, nn) => mul3(col, 0.86 + 0.18 * Math.max(0, nn.getY(ii))), (u, w, ii, p) => [p.getX(ii) * UVK, p.getZ(ii) * UVK]);
        k++;
      }
      icoG.dispose();
      rockG.dispose();
      const m = bk.mesh(roadMat, true);
      const mc = chunked(m.geometry, roadMat, { cell: 90, renderOrder: -5, name: 'road' }); root.add(mc); meshes.road = mc;
      if (wetBk.n) { const mw = wetBk.mesh(wetMat, false); const mcw = chunked(mw.geometry, wetMat, { cell: 160, renderOrder: -4, name: 'puddles', receive: false }); root.add(mcw); meshes.puddles = mcw; }
    }

    /* ---------- подпорные стенки (без парапетов и столбиков — волна 4: «без отбойников»), мостик, ворота ----------
       Со стороны обрыва остаётся только сухая кладка НИЖЕ полотна (держит насыпь) и каменная кромка вровень с дорогой —
       ни парапета, ни ограждения. Безопасность — невидимый мягкий край: машина (drive.js) и героиня (коллайдеры kind 'edge'). */
    const wallMat = HI ? toon('#FFFFFF', { map: rubbleTex, vertexColors: true }) : cheap({ map: rubbleTex });
    const bkW = new Bk(), postList = [], colliders = [];
    const cWall = C('#FFFFFF'), cCap = WIN ? new T.Color(1.13, 1.16, 1.22) : C('#E9E1D0'), cWallLow = C('#8E8676');
    const benchI = iPk;   // лавочка смотровой — у внешнего края кармана, лицом к селу
    // точка (x, z) лежит на полотне «другой» дороги (развилка: стенка и край не перегораживают въезд на ветку)
    function inOther(i, x, z, pad) {
      if (i < N) { if (!nearBranch(x, z)) return false; const p = road.branch.project(x, z); return p.s > 0.3 && Math.abs(p.e) < (p.e > 0 ? p.wl : p.wr) + (pad || 0); }
      const p = road.project(x, z, BR.sF); return Math.abs(p.e) < (p.e > 0 ? p.wl : p.wr) + (pad || 0);
    }
    const kinds = { 1: [], '-1': [] };
    [[0, N - 1], [N, NG2 - 1]].forEach(([i0, i1]) => [1, -1].forEach(sd => {
      const K = new Int8Array(NG2), YB = new Float32Array(NG2);
      for (let i = i0; i <= i1; i++) {
        const W = sd > 0 ? SWL[i] : SWR[i], ox = GLX[i] * sd, oz = GLZ[i] * sd;
        const ex = GX[i] + ox * (W + 1.25), ez = GZ[i] + oz * (W + 1.25);
        let yo = nearY(ex, ez); if (yo === null) yo = natY(ex, ez);
        const drop = GY[i] - yo;
        YB[i] = Math.min(yo, GY[i] - 0.3) - 0.7;
        if (BRIDGE[i]) K[i] = 0;
        else if (drop > 0.45) K[i] = 1;
        else K[i] = 0;
        if (K[i] && (inOther(i, GX[i] + ox * (W + 0.3), GZ[i] + oz * (W + 0.3), 0.6) || inOther(i, GX[i] + ox * (W - 0.4), GZ[i] + oz * (W - 0.4), 0.6))) K[i] = 0;
      }
      // убрать мелкие обрывки
      for (let pass = 0; pass < 2; pass++) for (let i = i0 + 1; i < i1; i++) { let j = i; while (j < i1 && K[j] === K[i]) j++; if (j - i < 3 && i > i0) { for (let k = i; k < j; k++) K[k] = K[i - 1]; } i = j - 1; }
      if (i0 === 0) kinds[sd] = K;
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
          const W = sd > 0 ? SWL[s] : SWR[s], ox = GLX[s] * sd, oz = GLZ[s] * sd, ex = GX[s] + ox * W, ez = GZ[s] + oz * W, y = GY[s];
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
      // коллайдеры для прогулки: тонкие коробки вдоль края полосы (героиня не уходит за край: обрыв без ограждения не страшен);
      // у развилки — короче и с разрывом там, где начинается другая дорога
      let a0 = i0;
      while (a0 < i1) {
        let b0 = a0 + 1;
        const nb = nearBranch(GX[a0], GZ[a0]);
        while (b0 < i1 && b0 - a0 < (nb ? 2 : 8) && Math.abs(angDiff(GTH[b0], GTH[a0])) < 0.09) b0++;
        const Wa = (sd > 0 ? SWL[a0] : SWR[a0]) + 0.25, Wb = (sd > 0 ? SWL[b0] : SWR[b0]) + 0.25;
        const ax = GX[a0] + GLX[a0] * sd * Wa, az = GZ[a0] + GLZ[a0] * sd * Wa, bx = GX[b0] + GLX[b0] * sd * Wb, bz = GZ[b0] + GLZ[b0] * sd * Wb;
        const len = Math.hypot(bx - ax, bz - az);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const blocked = nb && (inOther(a0, ax, az, 0.9) || inOther(a0, bx, bz, 0.9) || inOther(a0, mx, mz, 0.9));
        if (!blocked) colliders.push({ type: 'box', x: mx, z: mz, w: 0.5, d: len + 0.7, ry: Math.atan2(bx - ax, bz - az), y0: Math.min(GY[a0], GY[b0]) - 1, y1: Math.max(GY[a0], GY[b0]) + 0.6, kind: 'edge', noCar: true });
        a0 = b0;
      }
    }));
    // торцы дорог (дальше — облако): начало и конец основной, конец ветки
    [[0, -1], [N - 1, 1], [NG2 - 1, 1]].forEach(([i, dir]) => { const W = Math.max(SWL[i], SWR[i]) + 0.6; colliders.push({ type: 'box', x: GX[i] + Math.sin(GTH[i]) * dir * 0.6, z: GZ[i] + Math.cos(GTH[i]) * dir * 0.6, w: W * 2, d: 0.5, ry: GTH[i], kind: 'end', noCar: true }); });
    // мостик через ручей: пролёт-арка в обеих стенках, свод снизу, парапеты
    if (iBr > 0) {
      const i = iBr, th = R.th[i], tx = Math.sin(th), tz = Math.cos(th), lx = R.lx[i], lz = R.lz[i], y = R.y[i];
      const xs = R.x[i], zs = R.z[i], bed = (nearY(xs, zs) ?? natY(xs, zs));
      const span = 2.4, Lb = 13, spring = bed + 0.9, yb = bed - 1.2;
      [1, -1].forEach(sd => {
        const W = sd > 0 ? SWL[i] : SWR[i];
        // стенка с аркой: контур в плоскости (вдоль дороги u, высота h)
        const sh = new T.Shape();
        sh.moveTo(-Lb / 2, yb - y); sh.lineTo(-span, yb - y); sh.lineTo(-span, spring - y); sh.absarc(0, spring - y, span, PI, 0, true); sh.lineTo(span, yb - y); sh.lineTo(Lb / 2, yb - y); sh.lineTo(Lb / 2, 0.06); sh.lineTo(-Lb / 2, 0.06); sh.closePath();   // волна 4: без парапета — кромка вровень с дорогой
        const eg = new T.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: false, curveSegments: 10 });
        // u → вдоль дороги, h → вверх, глубина → наружу
        const m = new T.Matrix4().makeBasis(new T.Vector3(-tx * sd, 0, -tz * sd), new T.Vector3(0, 1, 0), new T.Vector3(lx * sd, 0, lz * sd));
        m.setPosition(xs + lx * sd * W, y, zs + lz * sd * W);
        bkW.geo(eg, m, cWall, (u, v, k, p) => [u / 1.6 * 1.0, v / 1.6]);
        eg.dispose();
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
    { const m = bkW.mesh(wallMat, true); m.geometry.computeVertexNormals(); const mc = chunked(m.geometry, wallMat, { cell: 90, cast: HI, name: 'walls' }); root.add(mc); meshes.walls = mc; }
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
      colliders.push({ type: 'box', x: P.x, z: P.z, w: 1.9, d: 0.6, ry, kind: 'bench' });
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
    const sA = signAt(startI, -1, 0.9, 2.35, 'A', 1.5, 0.55);
    signs.push({ x: sA.x, y: sA.y, z: sA.z, h: 1.62, id: 'B', w: 0.95, hh: 0.33, ry: R.th[startI] + PI });
    const sC = signAt(exitI - 5, -1, 0.5, 2.3, 'C', 1.7, 0.49);
    const sD = signAt(viewSignI, outSide, 0.6, 1.25, 'D', 0.9, 0.32);
    // волна 4: развилка к отелю — коричневый (туристический) щит «Отель» со стрелкой: перед развилкой для едущих вверх
    // и за развилкой (в «клине» между дорогами) для едущих вниз, от села
    const sE = signAt(BR.iF - 7, BR.side, 0.9, 1.9, 'E', 1.2, 0.48);
    const sE2 = signAt(BR.iF + 19, BR.side, 0.9, 1.9, 'F', 1.2, 0.37); signs[signs.length - 1].ry = R.th[BR.iF + 19];
    [[sA, 2.7], [sC, 2.6], [sD, 1.45], [sE, 2.2], [sE2, 2.2]].forEach(([p, h], k) => {
      bkP.geo(GCy, mtx(p.x, p.y + h / 2, p.z, 0, 0.05, h, 0.05), k === 2 ? cWoodD : cPost);
      colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.25, kind: 'sign' });
    });
    signs.forEach(s => {
      const uv = SIGN.uv[s.id], u0 = uv[0] / 1024, v1 = 1 - uv[1] / 512, u1 = (uv[0] + uv[2]) / 1024, v0 = 1 - (uv[1] + uv[3]) / 512;
      const wu = SIGN.uv.W, wu0 = (wu[0] + 4) / 1024, wv0 = 1 - (wu[1] + 4) / 512;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry), off = 0.07;
      const P = (lx, ly, lz) => [s.x + lx * c + lz * sn, s.y + s.h + ly, s.z - lx * sn + lz * c];
      const hw = s.w / 2, hh = s.hh / 2, nF = [sn, 0, c];
      // лицо (+z локально), задник, торцы — задник и торцы белым пятном атласа × цвет вершин
      const quad = (a, b, c2, d, n, col, uvs) => { const i0 = bkS.n; [a, b, c2, d].forEach((p, k) => bkS.v(p[0], p[1], p[2], n[0], n[1], n[2], col, uvs[k][0], uvs[k][1])); bkS.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
      const white = C('#FFFFFF');
      quad(P(-hw, -hh, off + 0.02), P(hw, -hh, off + 0.02), P(hw, hh, off + 0.02), P(-hw, hh, off + 0.02), nF, white, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      const W4 = [[wu0, wv0], [wu0, wv0], [wu0, wv0], [wu0, wv0]], nB = [-sn, 0, -c];
      quad(P(hw, -hh, off - 0.02), P(-hw, -hh, off - 0.02), P(-hw, hh, off - 0.02), P(hw, hh, off - 0.02), nB, s.id === 'D' ? cWoodD : cBack, W4);
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
      for (let r = 490; r >= 300; r -= 2) { const v = STREAM_V(r), xz = RV2XZ(r, v); if (nearY(xz[0], xz[1]) === null) { if (pts.length) break; continue; } pts.push([xz[0], xz[1], r]); }
      const bk = new Bk(), cW = C(WIN ? '#C3D6E4' : '#93B4C8');
      let s = 0;
      pts.forEach((p, k) => {
        const q = pts[Math.min(pts.length - 1, k + 1)], o = pts[Math.max(0, k - 1)], dx = q[0] - o[0], dz = q[1] - o[1], L = Math.hypot(dx, dz) || 1, nx = dz / L, nz = -dx / L;
        const w = 0.3 + 0.32 * sm(490, 420, p[2]);
        const y = Math.min(ground(p[0], p[1]), nearY(p[0], p[1]) ?? farY(p[0], p[1])) + 0.16;
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
        const ny = (() => { const h0 = nearY(xz[0], xz[1]), h1 = nearY(xz[0] + 1, xz[1]), h2 = nearY(xz[0], xz[1] + 1); if (h0 === null || h1 === null || h2 === null) return 0; const gx = h1 - h0, gz = h2 - h0; return 1 / Math.sqrt(1 + gx * gx + gz * gz); })();
        if (ny < 0.74) continue;
        const gully = vnoise(xz[0] * 0.05 + 11, xz[1] * 0.05 - 4);
        if (R2() > 0.25 + gully * 0.9) continue;
        if (Math.abs(vv - STREAM_V(rr)) < 2.5) continue;
        tryTree(xz[0], xz[1], 0.8 + R2() * 0.55, Math.floor(R2() * 4));
      }
      // деревья у села (запад и низ), видны с дороги и со смотровой
      for (let k = 0; k < 34; k++) {
        const a = -0.95 + R2() * 0.7, r = 26 + R2() * 46, x = r * Math.sin(a), z = CZ - r * Math.cos(a);
        const rw = rowOf(r); if (rw >= 0 && a > ROWS[rw][1] - 0.04) continue;
        tryTree(x, z, 0.9 + R2() * 0.5, Math.floor(R2() * 4));
      }
      for (let k = 0; k < 22; k++) { const d = 80 + R2() * 170, a = (R2() - 0.5) * 0.5; tryTree(-11 + Math.sin(a + 0.04) * d + (R2() - 0.5) * 30, -15 + Math.cos(a + 0.04) * d, 1 + R2() * 0.4, Math.floor(R2() * 4)); }
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
        const i = Math.floor(R2() * N), sd = R2() < 0.5 ? 1 : -1, W = (sd > 0 ? SWL[i] : SWR[i]) + 1.2 + R2() * 7;
        const x = R.x[i] + R.lx[i] * sd * W, z = R.z[i] + R.lz[i] * sd * W;
        if (onRoad(x, z, 0.9)) continue;
        const s = 0.35 + R2() * R2() * 1.4;
        rocks.push({ x, y: ground(x, z) - s * 0.25, z, s, sy: 0.55 + R2() * 0.3 });
      }
      // у лавочек: по два валуна по бокам (у смотровой — крупнее), лавочка между ними, лицом к долине
      BENCHES.forEach(b => { const big = b.k === 0, sz = big ? 0.5 : 0.36; [big ? -1.6 : -1.45, big ? 1.6 : 1.45].forEach(dx => { const ry = b.ry, x = b.x + Math.cos(ry) * dx + Math.sin(ry) * (big ? 0.9 : 0.3), z = b.z - Math.sin(ry) * dx + Math.cos(ry) * (big ? 0.9 : 0.3); rocks.push({ x, y: b.y - 0.05, z, s: sz, sy: 0.7 }); colliders.push({ type: 'circle', x, z, r: sz, kind: 'rock' }); }); });
      // камень тура — у верхнего края кармана
      const tI = Math.min(N - 1, iPk + 5), tW = (outSide > 0 ? SWL[tI] : SWR[tI]) - 0.75;
      const turP = { x: R.x[tI] + R.lx[tI] * outSide * tW, z: R.z[tI] + R.lz[tI] * outSide * tW };
      turP.y = R.y[tI] + 1.25;
      rocks.push({ x: turP.x, y: R.y[tI] + 0.1, z: turP.z, s: 1.25, sy: 0.92, flat: true });
      colliders.push({ type: 'circle', x: turP.x, z: turP.z, r: 1.15, kind: 'turRock' });
      meshes.turP = turP;
      const ir = new T.InstancedMesh(rockGeo, instMat, rocks.length);
      rocks.forEach((r, k) => { ir.setMatrixAt(k, mtx(r.x, r.y, r.z, R2() * 6, r.s * (r.flat ? 1.1 : 1), r.s * r.sy, r.s * (r.flat ? 0.95 : 0.9 + R2() * 0.3), r.flat ? 0 : (R2() - 0.5) * 0.4, 0)); ir.setColorAt(k, ROCKC[k % 3]); });
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
        const y = ground(x, z); tufts.push([x, y - 0.03, z, 0.7 + R2() * 0.9]);
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

    /* ---------- облака: море облаков (2–3 слоя) и облачные клубы у склона ---------- */
    const clouds = [];
    {
      const layers = [[CLOUD_TOP, 0.95, 5], [CLOUD_TOP - 4, 0.75, 7], [CLOUD_TOP - 8, 0.65, 4]].slice(0, Q.clouds);
      layers.forEach(([y, op, rep], k) => {
        const t = cloudTex.clone(); t.needsUpdate = true; keep(t); t.repeat.set(rep, rep); t.offset.set(k * 0.37, k * 0.21);
        const mat = keep(new T.MeshBasicMaterial({ map: t, color: C(WIN ? '#FFFFFF' : k ? '#F0F3F7' : '#FFFFFF'), transparent: true, opacity: op * (WIN ? 1 : 0.95), depthWrite: false, side: T.DoubleSide }));
        const m = new T.Mesh(keep(new T.PlaneGeometry(3000, 3000)), mat); m.rotation.x = -PI / 2; m.position.set(100, y, 220); m.renderOrder = 3 + k; m.name = 'cloud' + k; root.add(m);
        clouds.push({ m, t, sp: 0.0016 + k * 0.0007 });
      });
    }
    const puffMat = keep(new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { map: { value: null }, color: { value: C('#FFFFFF') }, opacity: { value: 0.85 } }]),
      vertexShader: 'attribute vec3 offset; attribute float size; varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0); mvPosition.xy += position.xy * size; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: 'uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(color * t.rgb, t.a * opacity);\n#include <fog_fragment>\n}',
      transparent: true, depthWrite: false, fog: true,
    }));
    puffMat.uniforms.map.value = puffTex;
    const puffs = [];
    {
      const pr = rng(91);
      // клубы у склона на уровне облаков, над долиной, у ворот (шторка) и в начале (туман подножия)
      for (let k = 0; k < Q.puffs; k++) {
        let x, y, z, s;
        if (k < Q.puffs * 0.45) { const r = 318 + pr() * 34, v = -140 + pr() * 260, xz = RV2XZ(r, v); x = xz[0]; z = xz[1]; y = CLOUD_TOP - 3 + pr() * 5; s = 12 + pr() * 12; }
        else if (k < Q.puffs * 0.8) { const a = pr() * PI * 2, d = 140 + pr() * 260; x = 90 + Math.sin(a) * d; z = 170 + Math.cos(a) * d * 0.7; y = CLOUD_TOP + pr() * 3; s = 18 + pr() * 18; }
        else { const s0 = pr() < 0.5 ? R.len - 2 - pr() * 6 : 2 + pr() * 4, q = road.sample(s0), fwd = s0 > R.len / 2 ? 1 : -1; x = q.x + Math.sin(q.th) * fwd * (5 + pr() * 10) + q.lx * (pr() - 0.5) * 6; z = q.z + Math.cos(q.th) * fwd * (5 + pr() * 10) + q.lz * (pr() - 0.5) * 6; y = q.y + 1 + pr() * 3; s = 9 + pr() * 6; }
        puffs.push([x, y, z, s]);
      }
      // волна 4: облачная шторка и в конце ветки к отелю
      for (let k = 0, nB = HI ? 6 : 3; k < nB; k++) { const q = road.branch.sample(BR.len - 2 - pr() * 6); puffs.push([q.x + Math.sin(q.th) * (4 + pr() * 9) + q.lx * (pr() - 0.5) * 6, q.y + 1 + pr() * 3, q.z + Math.cos(q.th) * (4 + pr() * 9) + q.lz * (pr() - 0.5) * 6, 9 + pr() * 6]); }
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
    if (Q.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 5, far: 140 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; }
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
      const lookAtBench = Math.atan2(benchP.x - tp.x, benchP.z - tp.z);
      tur.root.rotation.y = lookAtBench + PI / 2 * pocketSide;   // в профиль к лавочке
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
      const tp = meshes.turP; grp.position.set(tp.x, tp.y, tp.z); grp.scale.setScalar(1.15); root.add(grp);
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
    const hotelEnd = road.branch.sample(BR.len - 5);
    const exits = [
      { id: 'toCity', x: R.x[1], y: R.y[1], z: R.z[1], r: 4, label: 'В город', s: 1 * DS },
      { id: 'toVillage', x: R.x[N - 4], y: R.y[N - 4], z: R.z[N - 4], r: 5, label: TXT.toVillage, s: (N - 4) * DS },
      // волна 4: ветка к отелю (регион отеля — отдельно, js/village_w4/hotel.js); s — по ветке, rid: 1
      { id: 'toHotel', x: hotelEnd.x, y: hotelEnd.y, z: hotelEnd.z, r: 5, label: 'К отелю', icon: '🏨', s: BR.len - 5, rid: 1, road: 'hotel' },
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
      const h2 = road.sample(road.sOfTag('H2') + 12), h4 = road.sample(road.sOfTag('H4') + 12), h3 = road.sample(road.sOfTag('H3') + 12);
      const cx = (h2.x + h3.x + h4.x) / 3, cy = (h2.y + h3.y + h4.y) / 3, czz = (h2.z + h3.z + h4.z) / 3;
      views.hairpins = { pos: V3(cx - DB[0] * 95 - LT[0] * 35, cy + 30, czz - DB[1] * 95 - LT[1] * 35), target: V3(cx + DB[0] * 4, cy + 2, czz + DB[1] * 4), fov: 50 };
      // выныриваем из облаков: начало L3, взгляд через долину на село
      const l3 = road.sample(road.sOfTag('L3') + 6);
      views.emerge = { pos: V3(l3.x, l3.y + 2.2, l3.z), target: V3(TOWER.x, -12, TOWER.z), fov: 50 };
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
      { const f = road.sample(BR.sF - 22), g = road.branch.sample(20); views.fork = { pos: V3(f.x - f.lx * BR.side * 1.5, f.y + 2.4, f.z - f.lz * BR.side * 1.5), target: V3(g.x, g.y + 0.8, g.z), fov: 50 }; }
      const ea = road.sample(exitI * DS - 26);
      views.arrival = { pos: V3(ea.x - ea.lx * 0.5, ea.y + 2.0, ea.z - ea.lz * 0.5), target: V3(R.x[exitI], R.y[exitI] + 1.4, R.z[exitI]), fov: 50 };
    }

    /* ---------- настроение: долина в облаке → внутри облака → над облаками ---------- */
    const MOODS = WIN ? {
      valley: { top: '#C9D3DE', hor: '#E4E9EF', fog: '#E3E8EE', near: 12, far: 95, hs: '#E6EEF7', hg: '#CBD3DC', hi: 0.8, sun: '#FFF6EC', si: 0.22 },
      cloud: { top: '#EEF2F6', hor: '#F2F5F8', fog: '#EEF2F6', near: 1, far: 24, hs: '#EEF3F8', hg: '#D6DDE4', hi: 0.86, sun: '#FFFFFF', si: 0.14 },
      clear: { top: '#AFC4DC', hor: '#E6EDF4', fog: '#E3EAF2', near: 160, far: 2100, hs: '#E6EEF7', hg: '#DCE3EA', hi: 0.7, sun: '#FFF1E0', si: 0.5 },
    } : {
      valley: { top: '#BCC8D6', hor: '#DCE2E9', fog: '#DAE0E7', near: 16, far: 140, hs: '#D6DEE6', hg: '#B8AE9C', hi: 0.78, sun: '#FFF4E6', si: 0.24 },
      cloud: { top: '#E9EEF3', hor: '#EEF2F6', fog: '#EAEFF4', near: 1, far: 26, hs: '#E6ECF2', hg: '#C8C2B6', hi: 0.86, sun: '#FFF6EA', si: 0.15 },
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
    const gateP = { x: R.x[exitI], z: R.z[exitI] }, startP = { x: R.x[0], z: R.z[0] }, hotelP = { x: GX[NG2 - 1], z: GZ[NG2 - 1] };
    function applyMood(camY, hx, hz) {
      const t1 = sm(-107, -99, camY), t2 = sm(-93, -85, camY);
      blend(MC.valley, MC.cloud, t1, tmpM); blend(tmpM, MC.clear, t2, cur);
      // облачная шторка у ворот въезда
      const dG = Math.hypot(hx - gateP.x, hz - gateP.z), dH = Math.hypot(hx - hotelP.x, hz - hotelP.z), kG = Math.max(1 - sm(10, 46, dG), 1 - sm(6, 30, dH)) * 0.8;
      if (kG > 0.001) { blend(cur, MC.cloud, kG, tmpM); Object.assign(cur, { near: tmpM.near, far: tmpM.far, hi: tmpM.hi, si: tmpM.si }); ['top', 'hor', 'fog', 'hs', 'hg', 'sun'].forEach(k => cur[k].copy(tmpM[k])); }
      fog.color.copy(cur.fog); fog.near = cur.near; fog.far = cur.far;
      hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = cur.hi; sun.color.copy(cur.sun); sun.intensity = cur.si;
      LU.hemiSky.value.copy(cur.hs); LU.hemiGround.value.copy(cur.hg); LU.hemiI.value = cur.hi; LU.sunCol.value.copy(cur.sun); LU.sunI.value = cur.si;
      skyU.top.value.copy(cur.top); skyU.hor.value.copy(cur.hor); skyU.bot.value.copy(cur.fog); skyU.sunK.value = t2;
      const above = camY > -99;
      ridges.forEach(r => { r.m.visible = above; r.m.material.color.copy(r.base).lerp(cur.fog, r.f); if (WIN) r.m.material.color.lerp(r.snow, 0.35); });
      const full = !!realDistant && villageFull; if (vlod) vlod.visible = above && !full; if (realDistant) realDistant.visible = above && full;
      if (skyPuffs && !WIN) { skyPuffs.visible = t2 > 0.02; skyPuffs.material.opacity = 0.95 * t2; }
      return { t1, t2, kG };
    }
    applyMood(-36, 0, 0);

    /* ---------- обновление ---------- */
    let time = 0, pollT = 0, prevFar = null, prevNear = null, mood = null, lastCam = null;
    const hv = new T.Vector3();
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
      clouds.forEach((c, k) => { c.t.offset.x += dt * c.sp; c.t.offset.y += dt * c.sp * 0.4 * (k % 2 ? -1 : 1); });
      if (meshes.streamTex) meshes.streamTex.offset.y -= dt * 0.35;
      // птицы
      { const P = birds.P; birds.list.forEach((b, j) => { const a = time * b.w + b.ph, x = b.c[0] + Math.sin(a) * b.r, z = b.c[2] + Math.cos(a) * b.r, y = b.c[1] + Math.sin(time * 0.3 + j) * 3, hd = a + (b.w > 0 ? PI / 2 : -PI / 2), fx = Math.sin(hd), fz = Math.cos(hd), lx = fz, lz = -fx, fl = Math.sin(time * 2.2 + j) * 0.35 + 0.25, s = b.s;
        const pts = [[x + fx * 0.5 * s, y, z + fz * 0.5 * s], [x - fx * 0.4 * s + lx * 1.6 * s, y + fl * s, z - fz * 0.4 * s + lz * 1.6 * s], [x - fx * 0.3 * s, y, z - fz * 0.3 * s], [x + fx * 0.5 * s, y, z + fz * 0.5 * s], [x - fx * 0.3 * s, y, z - fz * 0.3 * s], [x - fx * 0.4 * s - lx * 1.6 * s, y + fl * s, z - fz * 0.4 * s - lz * 1.6 * s]];
        pts.forEach((p, k) => { P[(j * 6 + k) * 3] = p[0]; P[(j * 6 + k) * 3 + 1] = p[1]; P[(j * 6 + k) * 3 + 2] = p[2]; }); });
        birds.m.geometry.attributes.position.needsUpdate = true; }
      // тур
      if (tur && tur.anim) tur.anim(time, dt, hx, hz);
      // снег вокруг камеры
      if (snow) {
        snow.position.set(cp.x, cp.y, cp.z);
        const a = snow.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * (0.55 + (i % 7) * 0.04); a[i] += dt * 0.25 * Math.sin(time * 0.7 + i); if (a[i + 1] < -6) { a[i + 1] += 24; a[i] = ((a[i] + 20) % 40 + 40) % 40 - 20; } }
        snow.geometry.attributes.position.needsUpdate = true;
      }
      // тень (высокое качество) — за героиней/машиной
      if (Q.shadow && heroPos) { sun.target.position.set(heroPos.x, heroPos.y, heroPos.z); sun.position.set(heroPos.x + SUNDIR.x * 70, heroPos.y + SUNDIR.y * 70, heroPos.z + SUNDIR.z * 70); }
      else if (!Q.shadow) { sun.position.copy(SUNDIR).multiplyScalar(100).add(cp); sun.target.position.copy(cp); }
      // село из модуля села, если оно появилось позже
      if (!realDistant) { pollT += dt; if (pollT > 1 && time < 90) { pollT = 0; tryReal(); } }
    }

    function dispose() {
      if (root.parent) root.parent.remove(root);
      if (scene && scene.fog === fog) scene.fog = prevFog;
      if (scene && prevBg !== undefined && scene.background !== prevBg) scene.background = prevBg;
      const skip = new Set(); if (tur && tur.root) tur.root.traverse(o => skip.add(o)); if (realDistant) realDistant.traverse(o => skip.add(o));
      root.traverse(o => { if (skip.has(o)) return; if (o.isMesh || o.isPoints) { if (o.geometry && own.indexOf(o.geometry) < 0) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m && own.indexOf(m) < 0) m.dispose(); }); } });
      if (lastCam && prevFar !== null) { lastCam.far = prevFar; lastCam.near = prevNear; lastCam.updateProjectionMatrix(); }
      own.forEach(x => { try { x.dispose && x.dispose(); } catch (e) { /* уже */ } });
      if (ownKit && ownKit.dispose) ownKit.dispose();
      if (realDistant && realDistant.userData && typeof realDistant.userData.dispose === 'function') realDistant.userData.dispose();
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
        const A = road.areas(x, z); let p = A[0]; if (A[1] && Math.abs(A[1].e) - (A[1].e > 0 ? A[1].wl : A[1].wr) < Math.abs(p.e) - (p.e > 0 ? p.wl : p.wr)) p = A[1];
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
      // волна 4: ходьба по дороге, лавочки, ветка к отелю, покрытие (см. шапку файла)
      collide, walkable, groundInfo, rayHit, dynamic, camColliders: [], benches: BENCHES.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, ry: b.ry, seat: { x: b.x, y: b.y + 0.47, z: b.z, ry: b.ry }, view: b.k ? 'bench' + b.k : 'viewpoint', s: b.i * DS })),
      surface: road.surface, hotel: { fork: { x: R.x[BR.iF], y: R.y[BR.iF], z: R.z[BR.iF], s: BR.sF }, end: { x: GX[NG2 - 1], y: GY[NG2 - 1], z: GZ[NG2 - 1] }, len: BR.len, side: BR.side },
      camera: { views, far: 1600, near: 0.25, fovZoom: [58, 16] },
      road, update, dispose,
      // подсказка камере-следилке: над облаками на прямых плечах слегка развернуться к селу через долину (рад)
      // «вау»-моменты для камеры: где показать село через долину (хаб может проиграть как короткий поворот камеры)
      moments: [{ id: 'emerge', s0: road.sOfTag('L3') + 6, s1: road.sOfTag('L3') + 70, look: { x: TOWER.x, y: -8, z: TOWER.z }, dur: 5.5 }],
      cameraBias(x, y, z, heading, s) {
        if (y < -88) return 0;
        const d = angDiff(Math.atan2(TOWER.x - x, TOWER.z - z), heading);
        if (Math.abs(d) > 2.4) return 0;
        const k = s != null ? 1 - sm(0.03, 0.08, road.kmax(s - 6, 18)) : 1;
        return clamp(d * 0.2, -0.26, 0.26) * k * sm(-88, -80, y);
      },
      sun, hemi, fog,
      // подробное село вдали: true (по умолчанию) — настоящее, false — силуэт (запас для слабых устройств)
      setVillageDetail(on) { villageFull = !!on; return !!realDistant && villageFull; },
      info() { return { buildMs, tris: triCount, len: +R.len.toFixed(1), samples: N, hairpins: 6, legs: 7, climb: +(R.y[N - 1] - R.y[0]).toFixed(1), nearCells: NG.act.reduce((a, b) => a + b, 0), trees: trees.length, colliders: colliders.length, village: realDistant ? 'kubachi.distant' : 'placeholder', mood, branch: +BR.len.toFixed(1), benches: BENCHES.length, feats: { holes: FEAT[0].concat(FEAT[1]).filter(f => f.kind === 'hole').length, puddles: FEAT[0].concat(FEAT[1]).filter(f => f.kind === 'puddle').length, mud: FEAT[0].concat(FEAT[1]).filter(f => f.kind === 'mud').length, stones: FEAT[0].concat(FEAT[1]).filter(f => f.kind === 'stone').length } }; },
      stats() { return { tris: triCount, colliders: colliders.length, npcs: npcs.length, buildMs }; },
      // для отладки и стыковки: точки и подписи
      points: { bench: benchP, tur: meshes.turP, gate: { x: R.x[exitI], y: R.y[exitI], z: R.z[exitI] }, start: { x: R.x[0], y: R.y[0], z: R.z[0] }, bridge: iBr >= 0 ? { x: R.x[iBr], y: R.y[iBr], z: R.z[iBr] } : null, hairpinApex6: { x: R.x[iAp6], y: R.y[iAp6], z: R.z[iAp6] } },
      sOf: { L3: road.sOfTag('L3'), H6: iAp6 * DS, bench: benchI * DS, gate: exitI * DS, bridge: iBr * DS, fork: BR.sF, benches: BENCHES.map(b => b.i * DS) },
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
    // полотно 2,6 + обочина: земля не выше дороги, дальше — откос выемки 0,9
    return Math.min(y, yr - 0.3 + Math.max(0, bd - 3.4) * 0.9);
  }

  /* ---------- для села: осевая, лента дороги вдали, рельеф склона ---------- */
  function path() { const R = buildPath(), out = []; for (let i = 0; i < R.N; i++) out.push({ x: R.x[i], y: R.y[i], z: R.z[i], tag: R.tag[i] }); return out; }
  function distant(T, season, o = {}) {
    // o.w — полуширина ленты (из села издалека дорога тоньше), o.col/o.wall — цвета, o.skirt — высота «стенки» вниз
    const R = buildPath(), P = [], I = [], col = new T.Color(o.col || (season === 'winter' ? '#E9EDF1' : '#D8D2C2')), wall = new T.Color(o.wall || (season === 'winter' ? '#F3F5F8' : '#A89A84')), sk = o.skirt == null ? 2.2 : o.skirt;
    let n = 0;
    for (let i = 0; i < R.N; i += 3) {
      const w = o.w || 2.6, y = R.y[i] + 0.15, x = R.x[i], z = R.z[i], lx = R.lx[i], lz = R.lz[i];
      P.push(x + lx * w, y, z + lz * w, x - lx * w, y, z - lz * w, x - lx * w, y - sk, z - lz * w);
      if (n) { const o = (n - 1) * 3; I.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
      n++;
    }
    const C = new Float32Array(P.length); for (let k = 0; k < P.length / 3; k++) { const c = k % 3 === 2 ? wall : col; C.set([c.r, c.g, c.b], k * 3); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new T.BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
    m.name = 'serpentineDistant'; m.userData.dispose = () => { geo.dispose(); m.material.dispose(); };
    return m;
  }
  // волна 4: ветка к отелю без сборки региона — развилка, конец ветки (там выход toHotel), осевая; для региона отеля и карты
  function hotelRoad() {
    const B = buildBranch(), R = buildPath(), pts = [], e = B.N - 1;
    for (let i = 0; i < B.N; i++) pts.push({ x: B.x[i], y: B.y[i], z: B.z[i] });
    return { len: B.len, side: B.side, fork: { x: R.x[B.iF], y: R.y[B.iF], z: R.z[B.iF], s: B.sF, th: R.th[B.iF] }, end: { x: B.x[e], y: B.y[e], z: B.z[e], th: B.th[e] }, points: pts };
  }
  V.regions.serpentine = { build, path, distant, groundMacro: natY, groundCut, hotelRoad, frame: { RV2XZ, XZ2RV, TOWER, CLOUD_TOP, SB } };
})();
