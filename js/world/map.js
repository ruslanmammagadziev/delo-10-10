/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: карта.
   Волна 2: кусок Октябрьской (12 мест прогулки в прежних координатах: начало отсчёта у двери кинотеатра,
   фасады на z = −2 лицом на юг), площадь Солнца с фонтаном и часами 10:10, уголок парка,
   кольцо дорог вокруг квартала, набережная и река.
   Волна 3 (EXPAND): «большой город» ≈ 242 × 163 м — всё прежнее на своих местах, вокруг выросли районы:
     Парк «Каштановый» (пруд с мостиком и утками, дорожки-петля, лавочки, тайная скамейка, собачья площадка),
     Набережная во всю длину (фонари, перила, лавочки, пирс с лодочкой, велодорожка, велопрокат),
     Холм (терраса +6,3 м, лестница, смотровая с телескопом и ротондой), Рынок (8 прилавков, гирлянды),
     Гаражи («Круглые фары» — дом машинки), жилые кварталы, Загородная — дорога из города на север: столбы-ворота,
     указатель «За город ↑», разворотное кольцо; дальние хребты на горизонте.
   Как устроено:
     • дороги, газоны, дорожки и пруд — функции расстояния (L.roadSD, L.pondSD, L.parkPathSD): земля строится
       «марширующими квадратами» (H.sdfMesh), бордюры — по контуру (H.sdfContours); машина ездит по той же функции;
     • статика склеивается кусками 32 × 32 м; деревья, фонари, лавочки, кусты — инстансы клетками (16 м — прежние, 32 м — новые);
     • старт строит прежний город (как в волне 2) + «план» новых районов (двери, столкновения, лавочки, точки);
       сами новые районы одеваются лениво, шагами, после world:ready (WORLD.mapDressed — обещание);
     • дальность: scene.onBeforeRender — дальние куски заменяются «коробками» (≈50 треуг. на дом), дальше тумана
       скрываются; кроны вдали — облегчённые, мелочь (лавочки, кусты, ковры листьев) прячется;
     • высота: L.heightAt(x, z) — лестница и терраса холма, мостик, пирс. Пока main.js не ставит героиню на высоту
       (WORLD.HEIGHT_OK), лестница на холм закрыта табличкой, а точка «вид» стоит у подножия лестницы.
   Поля WORLD.LAYOUT (контракт волны 3): bounds · drivable(x,z,m) · rideable(x,z) · walkable(x,z) · heightAt(x,z) ·
     pois · paths · districts · edge · spawnPoints · lawns · water · squares · parkPaths · blocks · spots · viewFog ·
     + прежние FRONT_Z, oct, outer, inner, loop, loopPath, fountain, tower.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hyp = (a, b) => Math.sqrt(a * a + b * b);   // Math.hypot заметно медленнее, а сетки дорог считают сотни тысяч точек
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const sdBox = (x, z, x0, x1, z0, z1) => { const qx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2, qz = Math.abs(z - (z0 + z1) / 2) - (z1 - z0) / 2; return hyp(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); };
  const sdSeg = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9), 0, 1); return hyp(x - ax - dx * t, z - az - dz * t); };

  /* ---------- планировка ---------- */
  const L = WORLD.LAYOUT = {
    FRONT_Z: -2,
    oct: { x0: -62, x1: 84, z0: 3.6, z1: 11.9, zc: 7.75 },                // Октябрьская волны 2 (проезжая часть; продолжение — octFull)
    outer: { x0: -34.15, x1: 56.15, z0: 3.6, z1: 60.15, r: 8 },            // кольцо: внешний край
    inner: { x0: -25.85, x1: 47.85, z0: 11.9, z1: 51.85, r: 3 },           // квартал внутри кольца
    loop: { x0: -30, x1: 52, z0: 7.75, z1: 56, r: 6 },                     // осевая кольца (автопилот замера)
    bounds: { x0: -121, x1: 121, z0: -84, z1: 78.6 },                      // волна 3: весь город (было −48,6…69,2 × −1,55…65,85)
    bounds2: { x0: -48.6, x1: 69.2, z0: -1.55, z1: 65.85 },                // граница волны 2 — для справки
    fountain: { x: 11, z: 31.9, r: 3.05 },
    tower: { x: 32.5, z: 19.5 },
    // волна 3
    octFull: { x0: -118.3, x1: 110.3, z0: 3.6, z1: 11.9, zc: 7.75 },
    westLoop: { out: { x0: -118.3, x1: -25.85, z0: 3.6, z1: 60.15, rr: [8, 0, 0, 8] }, inn: { x0: -110, x1: -34.15, z0: 11.9, z1: 51.85, r: 3 } },
    eastLoop: { out: { x0: 66.6, x1: 110.3, z0: 3.6, z1: 58.4, rr: [0, 0, 6, 6] }, inn: { x0: 72.6, x1: 102, z0: 11.9, z1: 52.2, r: 3 } },
    gorn: { x0: 102, x1: 110.3, z0: -95, z1: 3.6, xc: 106.15 },            // Загородная: из города на север, к выезду
    turn: { x: 106.15, z: -72, r: 8.5, ri: 2.4 },                          // разворотное кольцо в конце Горной
    river: { z: 66.5 },
    pond: { a: { x: -93, z: 33, r: 7 }, b: { x: -78.5, z: 31.5, r: 6 }, k: 5, y: 0.03 },
    park: { x0: -110, x1: -34.15, z0: 11.9, z1: 51.85, lawn: { x0: -107, x1: -51, z0: 14.9, z1: 48.85 }, axis: -85.5,
      dog: { x0: -66, x1: -53, z0: 16, z1: 27.6, gate: [-60.5, -58.5] }, secret: { x: -104.6, z: 46.3, ry: PI / 2 } },
    hill: { x0: -121, x1: -71, z0: -84, wallZ: -2.6, sx: -85.5, sw: 3.2, top: 6.3, plat: { x0: -99, x1: -72, z0: -42, z1: -27.6 } },
    pier: { x: -85.5, z0: 66.5, len: 9, w: 3.0 },
    market: { x0: 72.6, x1: 102, z0: 33.4, z1: 38.4 },
    garages: { zf: 51.6 },
    gateZ: -50,
  };
  const sdRR = (x, z, R) => {
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, hx = (R.x1 - R.x0) / 2, hz = (R.z1 - R.z0) / 2;
    const qx = Math.abs(x - cx) - (hx - R.r), qz = Math.abs(z - cz) - (hz - R.r);
    return hyp(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R.r;
  };
  // скруглённый прямоугольник со своим радиусом у каждого угла: rr = [северо-запад, северо-восток, юго-восток, юго-запад] (север — −z)
  const sdRR4 = (x, z, R) => {
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, hx = (R.x1 - R.x0) / 2, hz = (R.z1 - R.z0) / 2, px = x - cx, pz = z - cz;
    const rr = R.rr || [R.r, R.r, R.r, R.r], r = px < 0 ? (pz < 0 ? rr[0] : rr[3]) : (pz < 0 ? rr[1] : rr[2]);
    const qx = Math.abs(px) - (hx - r), qz = Math.abs(pz) - (hz - r);
    return hyp(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  };
  const loopSD = (x, z, P) => Math.max(sdRR4(x, z, P.out), -sdRR4(x, z, P.inn));
  // скругление внутреннего угла дорог: квадрат r × r в углу (sx, sz — куда от угла) без круга
  const fillet = (x, z, cx, cz, sx, sz, r) => { const xa = cx - sx * 0.3, xb = cx + sx * r, za = cz - sz * 0.3, zb = cz + sz * r; return Math.max(sdBox(x, z, Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)), r - hyp(x - (cx + sx * r), z - (cz + sz * r))); };
  // дороги всего города: < 0 — проезжая часть
  // дальние части считаются грубо (расстоянием до их рамки): точно — только там, где это важно (сетки сотни тысяч точек)
  const farBox = (x, z, x0, x1, z0, z1, m = 5) => (x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) ? sdBox(x, z, x0, x1, z0, z1) : null;
  L.roadSD = (x, z) => {
    let d = sdBox(x, z, -100, 100, 3.6, 11.9);                                         // Октябрьская (середина; концы — в петлях)
    const O = L.outer, Wl = L.westLoop.out, El = L.eastLoop.out, Tn = L.turn;
    let q = farBox(x, z, O.x0, O.x1, O.z0, O.z1); d = Math.min(d, q !== null ? q : Math.max(sdRR(x, z, O), -sdRR(x, z, L.inner)));   // кольцо волны 2 (как было)
    q = farBox(x, z, Wl.x0, Wl.x1, Wl.z0, Wl.z1); d = Math.min(d, q !== null ? q : loopSD(x, z, L.westLoop));                         // Парковая и Набережный проезд
    q = farBox(x, z, El.x0, Math.max(El.x1, Tn.x + Tn.r), L.gorn.z0, El.z1, 6);   // рамка — с разворотным кольцом
    if (q !== null) d = Math.min(d, q);
    else {
      const gN = sdBox(x, z, L.gorn.x0, L.gorn.x1, L.gorn.z0, L.gorn.z1), r = hyp(x - Tn.x, z - Tn.z), tc = Math.max(r - Tn.r, Tn.ri - r);
      d = Math.min(d, smin(smin(gN, tc, 3), loopSD(x, z, L.eastLoop), 3));                                                              // Загородная, разворот, восточная петля
    }
    if (x > 50 && x < 72 && z > 6 && z < 18) d = Math.min(d, fillet(x, z, 56.15, 11.9, 1, 1, 2.5), fillet(x, z, 66.6, 11.9, -1, 1, 2));
    // стык Загородной и Октябрьской (интегратор волны 3): прямоугольники касались по z = 3,6, и функция расстояния там была ≈ 0
    // по всей ширине перекрёстка — машине (запас 0,78 м) не хватало дороги, с Октябрьской на выезд было не свернуть.
    // «Мостик» внутри уже нарисованной дороги (не шире её — асфальт и бордюры не меняются) делает стык глубоким.
    if (x > 101 && x < 111.5 && z > 0.5 && z < 7.5) d = Math.min(d, sdBox(x, z, L.gorn.x0 + 0.3, L.gorn.x1 - 0.3, L.gorn.z1 - 2, L.gorn.z1 + 2.5));
    // скруглённый внутренний угол того же стыка (верификатор волны 3): угол был острым, и машина, поворачивая с Октябрьской
    // к выезду, упиралась носом в бордюр. «Квадрат перекрёстка минус круг» R = 5 м: асфальт и бордюр на углу
    // закругляются (фонарь у угла остаётся на тротуаре), внутри перекрёстка расстояние до края честное.
    if (x > 96 && x < 111 && z > -2 && z < 12.5) { const R = 5, cx = L.gorn.x0 - R, cz = L.gorn.z1 - R; d = Math.min(d, Math.max(sdBox(x, z, cx, L.gorn.x1, cz, L.oct.z1), R - hyp(x - cx, z - cz))); }
    return d;
  };
  // можно ли машине стоять в точке (m — запас от края дороги)
  L.drivable = (x, z, m = 0.9) => z > L.bounds.z0 + 1.5 && L.roadSD(x, z) <= -m;
  // осевая кольца: точки через ~1 м (для автопилота и «поставить на дорогу»)
  L.loopPath = (() => {
    const P = L.loop, r = P.r, pts = [];
    const seg = (x0, z0, x1, z1) => { const n = Math.max(1, Math.round(hyp(x1 - x0, z1 - z0))); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
    const arc = (cx, cz, a0, a1) => { const n = 10; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
    seg(P.x0 + r, P.z0, P.x1 - r, P.z0); arc(P.x1 - r, P.z0 + r, -PI / 2, 0);
    seg(P.x1, P.z0 + r, P.x1, P.z1 - r); arc(P.x1 - r, P.z1 - r, 0, PI / 2);
    seg(P.x1 - r, P.z1, P.x0 + r, P.z1); arc(P.x0 + r, P.z1 - r, PI / 2, PI);
    seg(P.x0, P.z1 - r, P.x0, P.z0 + r); arc(P.x0 + r, P.z0 + r, PI, PI * 1.5);
    return pts;
  })();
  // осевые новых петель (автопилот «позвать машину», «поставить на дорогу»): большой круг вокруг парка и восточный квартал
  const polyPath = (corners, r, step = 1) => {
    const pts = [], n = corners.length;
    for (let i = 0; i < n; i++) {
      const p0 = corners[(i + n - 1) % n], p1 = corners[i], p2 = corners[(i + 1) % n];
      const d0 = hyp(p1[0] - p0[0], p1[1] - p0[1]), d1 = hyp(p2[0] - p1[0], p2[1] - p1[1]);
      const a = [p1[0] + (p0[0] - p1[0]) / d0 * r, p1[1] + (p0[1] - p1[1]) / d0 * r], b = [p1[0] + (p2[0] - p1[0]) / d1 * r, p1[1] + (p2[1] - p1[1]) / d1 * r];
      for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * p1[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p1[1] + t * t * b[1]]); }
      const q = [p2[0] + (p1[0] - p2[0]) / d1 * r, p2[1] + (p1[1] - p2[1]) / d1 * r], m = Math.max(1, Math.round(hyp(q[0] - b[0], q[1] - b[1]) / step));
      for (let k = 1; k < m; k++) pts.push([b[0] + (q[0] - b[0]) * k / m, b[1] + (q[1] - b[1]) * k / m]);
    }
    return pts;
  };
  L.drivePaths = {
    ring: L.loopPath,
    west: polyPath([[-114.15, 7.75], [-30, 7.75], [-30, 56], [-114.15, 56]], 6),
    east: polyPath([[69.6, 7.75], [106.15, 7.75], [106.15, 55.3], [69.6, 55.3]], 4.5),
    big: polyPath([[-114.15, 7.75], [106.15, 7.75], [106.15, 55.3], [69.6, 55.3], [69.6, 7.75], [52, 7.75], [52, 56], [-114.15, 56]], 5),
  };

  /* ---------- парк: пруд-«фасолина», дорожки, мостик ---------- */
  const PD = L.pond;
  L.pondSD = (x, z) => smin(hyp(x - PD.a.x, z - PD.a.z) - PD.a.r, hyp(x - PD.b.x, z - PD.b.z) - PD.b.r, PD.k);
  const PK = L.park, AX = PK.axis;
  // мостик: поперёк перешейка по оси парка (север–юг), концы — на берегах
  L.bridge = (() => { let z0 = 99, z1 = -99; for (let z = 20; z < 45; z += 0.05) if (L.pondSD(AX, z) < 0) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x: AX, z0: z0 - 1.15, z1: z1 + 1.15, w: 2.6 }; })();
  const BR = L.bridge;
  const PATHW = 1.2;   // полуширина дорожки
  L.parkPathSD = (x, z) => {
    let d = Math.abs(L.pondSD(x, z) - 3.6) - PATHW;                                   // петля вокруг пруда
    d = Math.min(d, sdSeg(x, z, AX, 14.0, AX, 26) - PATHW, sdSeg(x, z, AX, 37, AX, 49.6) - PATHW);   // вход с Октябрьской и выход к набережной
    d = Math.min(d, sdSeg(x, z, -69.4, 31.5, -50.6, 31.5) - PATHW);                   // на восток, к старой аллее
    d = Math.min(d, sdSeg(x, z, -59.5, 31.5, -59.5, 27.2) - 1.0);                     // к калитке собачьей площадки
    d = Math.min(d, sdSeg(x, z, -103.4, 33, -107.6, 33) - PATHW);                     // на запад, к Парковой
    d = Math.min(d, sdBox(x, z, -51, -48.6, 14.0, 49.6));                             // старая аллея между газонами
    return d;
  };
  const onBridge = (x, z) => Math.abs(x - BR.x) < BR.w / 2 && z > BR.z0 && z < BR.z1;
  const PR = L.pier;
  const onPier = (x, z) => (Math.abs(x - PR.x) < PR.w / 2 && z > PR.z0 - 0.4 && z < PR.z0 + PR.len + 0.1) || (Math.abs(x - PR.x) < PR.w / 2 + 0.9 && z >= PR.z0 + PR.len && z < PR.z0 + PR.len + 2.4);
  L.inWater = (x, z) => (z > L.river.z && !onPier(x, z)) || (L.pondSD(x, z) < 0.15 && !onBridge(x, z));

  /* ---------- холм: лестница в три марша и смотровая терраса ---------- */
  const HL = L.hill, PL = HL.plat;
  const stairH = z => { const u = HL.wallZ - z; if (u <= 0) return 0; if (u < 7) return 2.1 * u / 7; if (u < 9) return 2.1; if (u < 16) return 2.1 + 2.1 * (u - 9) / 7; if (u < 18) return 4.2; if (u < 25) return 4.2 + 2.1 * (u - 18) / 7; return HL.top; };
  const onStairs = (x, z) => Math.abs(x - HL.sx) < HL.sw / 2 + 0.25 && z <= HL.wallZ + 0.05 && z > PL.z1 - 0.6;
  const onPlat = (x, z) => x > PL.x0 && x < PL.x1 && z > PL.z0 && z < PL.z1 + 0.01;
  L.heightAt = (x, z) => {
    if (z < 0 && x < -66) { if (onStairs(x, z)) return stairH(z); if (onPlat(x, z)) return HL.top; return 0; }
    if (onBridge(x, z)) return 0.07;
    if (onPier(x, z) && z > PR.z0) return 0.03;
    return 0;
  };
  // рельеф холма (вид): стенка 1,1 м у тротуара, склон к полке 5,2 м, терраса, вершина ~15 м; к востоку сходит на нет
  L.hillH = (x, z) => {
    const u = HL.wallZ - z; if (u < 0.35) return 0.025;
    let h = 1.1 + 4.1 * sstep(3, 25, u) + 9.5 * sstep(45, 84, u);
    h += 0.35 * Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17) * sstep(3, 10, u);
    h *= sstep(-60, -75, x);
    if (Math.abs(x - HL.sx) < HL.sw / 2 + 0.6 && z > PL.z1 - 0.5) h = Math.min(h, stairH(z) - 0.12);
    if (x > PL.x0 - 0.6 && x < PL.x1 + 0.6 && z > PL.z0 - 0.6 && z < PL.z1 + 0.6) h = Math.min(h, HL.top - 0.08);
    return Math.max(0.025, h);   // не ниже 2,5 см: рельеф не ложится в одну плоскость с плиткой (без мерцания)
  };
  L.hillOpen = () => !!WORLD.HEIGHT_OK;

  /* ---------- где можно ехать на велосипеде и где ходить ---------- */
  const inB = (x, z) => x > L.bounds.x0 && x < L.bounds.x1 && z > L.bounds.z0 && z < L.bounds.z1;
  L.rideable = (x, z) => {
    if (!inB(x, z) || L.inWater(x, z)) return false;
    if (L.roadSD(x, z) <= -0.35) return true;
    if (z > 60.45 && z < 66.0 && x > -120.5 && x < 120.5) return true;               // променад и велодорожка
    if (x > 66.6 && z > 58.6 && z < 66.0) return true;
    if (onBridge(x, z)) return true;
    if (L.parkPathSD(x, z) < -0.15 && x > PK.x0 && x < PK.x1 && z > PK.z0 && z < PK.z1) return true;   // дорожки парка
    const M = L.market; if (x > M.x0 && x < M.x1 && z > M.z0 + 0.25 && z < M.z1 - 0.25) return true;
    if (x > 61.2 && x < 66.6 && z > 34.1 && z < 37.4) return true;                  // проход к рынку между домами
    const F = L.fountain, df = hyp(x - F.x, z - F.z); if (df < 12.6 && df > F.r + 0.6) return true;   // площадь
    return false;
  };
  // ходить: внутри границы, не в воде, не в препятствии (сетка препятствий появляется после сборки карты)
  L.walkable = (x, z) => {
    if (!inB(x, z) || L.inWater(x, z)) return false;
    if (z < HL.wallZ && x < -66 && !(L.hillOpen() && (onStairs(x, z) || onPlat(x, z)))) return false;
    if (L._hit && L._hit(x, z)) return false;
    return true;
  };

  /* ---------- план домов: прежние (для карты и «коробок» вдали) и новые (двери, столкновения) ---------- */
  // дом-заполнитель: x, z — середина фасада; ry — поворот (0 — лицом на юг, +z); w, h, d — ширина, высота, глубина
  const doorWxOf = w => { const cols = Math.max(1, Math.floor(w / 1.25)), c = Math.floor(cols / 2); return -w / 2 + (c + 0.5) * w / cols; };
  const footOf = (x, z, ry, w, d) => { const c = Math.cos(ry), s = Math.sin(ry), xs = [], zs = []; [[-w / 2, 0], [w / 2, 0], [-w / 2, -d], [w / 2, -d]].forEach(([lx, lz]) => { xs.push(x + lx * c + lz * s); zs.push(z - lx * s + lz * c); }); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };
  const NEW_HOUSES = [];
  { const nh = (x, z, ry, w, h, d, seed, o = {}) => NEW_HOUSES.push({ x, z, ry, w, h, d, seed, o });
    // Октябрьская, северная сторона: ряд дорос на запад (до холма) и на восток (до Горной)
    nh(-68.45, -2, 0, 4.6, 4.6, 3.2, 50, { roof: 1, boxes: true });
    nh(91.4, -2, 0, 4.4, 4.4, 3.2, 51, { awning: '#9DB8E0' }); nh(95.85, -2, 0, 3.8, 5.1, 3.2, 52, { turret: true });
    // восточный квартал: дома лицом к Октябрьской (на север), угловые — лицом к Горной
    [[75.9, 4.6, 4.4, 53, { boxes: true }], [80.45, 3.8, 5.2, 54, { balcony: true }], [85.2, 5.0, 4.0, 55, { awning: '#F7B267' }], [90.15, 4.2, 5.6, 56, { roof: 1 }], [94.0, 2.8, 5.0, 57, { roof: 0, gable: true }]]
      .forEach(([x, w, h, s, o]) => nh(x, 14.0, PI, w, h, 4.6, s, o));
    [[16.6, 5.2, 4.6, 58, { balcony: true }], [22.3, 5.2, 5.4, 59, { roof: 0 }], [27.9, 5.0, 4.2, 60, { awning: '#F08FA8' }]].forEach(([z, w, h, s, o]) => nh(100.4, z, PI / 2, w, h, 4.6, s, o));
    // за Горной: дома лицом на запад, к дороге
    [[17, 5.4, 4.8, 61, { turret: true }], [25, 5.0, 4.2, 62, { boxes: true }], [41, 5.6, 5.2, 63, { balcony: true }], [49, 5.0, 4.4, 64, { roof: 1 }]].forEach(([z, w, h, s, o]) => nh(112.2, z, -PI / 2, w, h, 4.6, s, o));
    // за Парковой: дома лицом на восток, к парку
    [[16.5, 5.6, 4.6, 65, { roof: 1 }], [24.5, 5.0, 5.2, 66, { balcony: true }], [33.5, 5.8, 4.4, 67, { gable: true, roof: 0 }], [42, 5.0, 5.0, 68, { turret: true }], [50, 5.4, 4.2, 69, { boxes: true }]]
      .forEach(([z, w, h, s, o]) => nh(-120, z, PI / 2, w, h, 4.6, s, o));
    NEW_HOUSES.forEach(hh => {
      hh.foot = footOf(hh.x, hh.z, hh.ry, hh.w, hh.d);
      const dw = doorWxOf(hh.w), c = Math.cos(hh.ry), s = Math.sin(hh.ry), at = (lx, lz) => [hh.x + lx * c + lz * s, hh.z - lx * s + lz * c];
      const [dx, dz] = at(dw, 0.02), [ax, az] = at(dw, 0.75);
      hh.door = { x: dx, z: dz, ax, az, nx: s, nz: c, w: hh.w, h: hh.h, seed: hh.seed, id: null, shop: false, district: hh.x > 100 ? 'east' : hh.x > 66 ? 'market' : hh.x < -100 ? 'park' : 'oct' };
    });
  }
  // прилавки рынка (ряд северный — лицом на юг, южный — на север) и гаражи
  const STALLS = [['Скрепка', 'канцелярия', 'paper', '#5E7A8E', '#9DB8E0'], ['Значки', 'на рюкзак', 'badges', '#8E6BB8', '#C7A8DD'], ['Букет', 'цветы', 'flowers', '#C2405B', '#F08FA8'], ['Бублик', 'булочная', 'bread', '#B0703A', '#F7B267'],
    ['Яблоки', 'с горки', 'apples', '#B23A3A', '#E98A7E'], ['Тыквы', 'на любой вкус', 'pumpkins', '#C4602E', '#F2A65A'], ['Открытки', 'с котами и без', 'cards', '#5E8A6E', '#9FC2A8'], ['Варежки', 'тёплые', 'mittens', '#9E2F47', '#EFA3B5']]
    .map(([sign, sub, goods, col, aw], i) => ({ sign, sub, goods, col, aw, x: [76.2, 82.6, 89.0, 95.4][i % 4], z: i < 4 ? L.market.z0 : L.market.z1, ry: i < 4 ? 0 : PI }));
  const GARAGES = [{ x: 76.6, w: 5.4, open: true, door: '#E58FA6', home: true }].concat([81.9, 86.1, 90.3, 94.5, 98.7].map((x, i) => ({ x, w: 4.0, door: ['#9FC2A8', '#8FB3D9', '#F3CF73', '#C7A8DD', '#F7B267'][i], num: i + 2 })));
  // прежние дома (волна 2) — только прямоугольники: карта и «коробки» вдали
  const OLD_HOUSES = [];
  { const oh = (x, z, ry, w, h, d, wall, roof, rt, bid = 0) => OLD_HOUSES.push({ x, z, ry, w, h, d, wall, roof, rt, bid, foot: footOf(x, z, ry, w, d) });
    oh(0, -2, 0, 4.4, 4.9, 3.2, '#B9475F', '#9E2F47', 2, 1); oh(6.2, -2, 0, 3.7, 4.6, 3.2, '#8FB3D9', '#5E7A8E', 2, 2); oh(16.2, -2, 0, 3.7, 4.5, 3.2, '#F2B8C6', '#C2405B', 2, 3); oh(22.6, -2, 0, 3.7, 5.1, 3.2, '#E9CFC0', '#B8907A', 2, 4);
    const SC = { photo: '#D9CCF4', atelier: '#FBE1E7', orangery: '#A9D3B6', records: '#F3D9A0', books: '#CFE0D2', planet: '#2F3A5A' };
    Object.keys(WORLD.SHOPS || {}).forEach(k => { const d = WORLD.SHOPS[k]; if (d && typeof d.x === 'number') oh(d.x, -2, 0, d.w || 3.4, (d.h || 3.8) + 0.4, 2.4, SC[k] || '#E9CFCF', '#C98F86', 2); });
    const FC = ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC', '#F2DFC8', '#D6E4EE'], FR = ['#C98F86', '#9AA5C5', '#B8907A', '#D9A0A0', '#8FAE9A'];
    const fl = (x, z, ry, w, h, d, s, rt) => oh(x, z, ry, w, h, d, FC[s % 8], FR[s % 5], rt === undefined ? s % 3 : rt);
    fl(11.9, -2, 0, 1.95, 2.9, 1.8, 3, 0);
    { let x = -17.2, s = 11; while (x > -63) { const w = 3.2 + (s % 3) * 0.5, h = 3.6 + (s % 4) * 0.55; fl(x - w / 2, -2, 0, w, h, 3.2, s); x -= w + 0.35; s += 1; } }
    { let x = 40.6, s = 31; while (x < 86) { const w = 3.2 + (s % 3) * 0.5, h = 3.6 + (s % 4) * 0.55; fl(x + w / 2, -2, 0, w, h, 3.2, s); x += w + 0.35; s += 1; } }
    [[16, 6.2, 4.6, 41], [23.5, 5.4, 5.2, 42], [31, 5.8, 4.2, 43], [41.2, 7.2, 4.8, 44], [49.5, 6, 5.4, 45], [56.4, 5.2, 4.4, 46]].forEach(([z, w, h, s]) => fl(61.2, z, -PI / 2, w, h, 4.6, s));
  }
  L.blocks = OLD_HOUSES.concat(NEW_HOUSES).map(hh => Object.assign({ id: 'h' + hh.x.toFixed(1) + ',' + hh.z.toFixed(1) }, hh.foot))
    .concat(STALLS.map(s => ({ id: 'stall', x0: s.x - 1.6, x1: s.x + 1.6, z0: s.ry ? s.z : s.z - 2.2, z1: s.ry ? s.z + 2.2 : s.z })))
    .concat(GARAGES.map(g => ({ id: 'garage', x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: L.garages.zf - 5, z1: L.garages.zf })));

  /* ---------- районы, точки, дорожки жителей ---------- */
  const HP = L.hill;
  L.districts = [
    { id: 'oct', name: 'Октябрьская', x0: -71, x1: 102, z0: -14, z1: 11.9, color: '#F6D3DB', lx: -30, lz: 7.75 },
    { id: 'square', name: 'Площадь Солнца', x0: -25.85, x1: 47.85, z0: 11.9, z1: 51.85, color: '#FBE3B8', lx: 11, lz: 16 },
    { id: 'park', name: 'Парк', full: 'Парк «Каштановый»', x0: -121, x1: -34.15, z0: 11.9, z1: 60.15, color: '#D6E8C4', lx: -72, lz: 45 },
    { id: 'embank', name: 'Набережная', x0: -121, x1: 121, z0: 60.15, z1: 78.6, color: '#D4E5F2', lx: 20, lz: 63.5 },
    { id: 'sun', name: 'Солнечный проспект', x0: 56.15, x1: 66.6, z0: 11.9, z1: 60.15, color: '#E4DAF2', lx: 61, lz: 30 },
    { id: 'market', name: 'Рынок', x0: 66.6, x1: 121, z0: 11.9, z1: 44, color: '#F7DDC6', lx: 86, lz: 35.9 },
    { id: 'garage', name: 'Гаражи', x0: 66.6, x1: 121, z0: 44, z1: 60.15, color: '#E9D9D2', lx: 86, lz: 55.3 },
    { id: 'hill', name: 'Холм', x0: -121, x1: -71, z0: -84, z1: -2.6, color: '#CFE3C2', lx: -96, lz: -18 },
    { id: 'yards', name: 'Дворы', x0: -71, x1: 100, z0: -84, z1: -14, color: '#E6DDEA', lx: 14, lz: -40, soon: true, soonText: 'Дворы откроются позже' },
    { id: 'mount', name: 'Загородная', x0: 100, x1: 121, z0: -84, z1: 3.6, color: '#E3E7D2', lx: 106, lz: -30 },
  ];
  L.edge = { x: L.gorn.xc, z: -60, ry: PI, r: 6, label: 'За город ↑', labelNeutral: 'За город ↑', road: [[L.gorn.xc, -40], [L.gorn.xc, -95]] };
  L.spawnPoints = {
    car: { x: 76.6, z: 55.3, ry: PI / 2, at: 'garage' },     // дом машинки — у «Круглых фар»
    sedan: { x: 82.6, z: 55.3, ry: PI / 2, at: 'garage' },   // волна 4: место красного седана — рядом с купе, напротив гаража № 2
    carStory: { x: 8.8, z: 4.75, ry: PI / 2 },               // где машинка стоит под чехлом в серии 1 (= MAP.carSpawn)
    bike: { x: -6.2, z: 2.75, ry: PI / 2 },                  // тротуар у кинотеатра, левее тележки Жу
    // машины у старта прогулки (тележка Жу −2,2; 1,3): через дорогу от кинотеатра, у южного бордюра Октябрьской (z 11,9),
    // по обе стороны зебры (x −1,3…1,3), обе носом на восток (к выезду из города), водительская дверь — к зебре и проезжей части.
    // Не у северного тротуара: там двери через каждые 4–6 м, и камера у выхода из ателье, бюро, оранжереи смотрела бы
    // на крышу машины; отсюда у всех дверей и на старте машины за спиной камеры. Купе впереди, седан за зеброй
    // (ему до купе 5,7 м — хватает плавно выехать влево)
    carStart: { x: 4.6, z: 10.65, ry: PI / 2, at: 'start' },
    sedanStart: { x: -5.6, z: 10.55, ry: PI / 2, at: 'start' },
  };
  L.spots = {
    secretBench: { x: PK.secret.x, z: PK.secret.z, ry: PK.secret.ry },
    ducks: { x: L.pond.b.x, z: L.pond.b.z - L.pond.b.r - 3.4, ry: 0 },
    bridge: { x: AX, z: (L.bridge.z0 + L.bridge.z1) / 2, ry: 0 },
    telescope: { x: -79.5, z: -28.9, ry: 0, y: HP.top },
    viewTop: { x: HP.sx, z: -29.2, ry: 0, y: HP.top },
    stairsFoot: { x: HP.sx, z: -1.2, ry: PI },
    pierEnd: { x: PR.x, z: PR.z0 + PR.len + 1.2, ry: 0 },
    garageHome: { x: 76.6, z: 53.2, ry: PI },
    rental: { x: 92, z: 63.6, ry: PI, rack: { x: 96.6, z: 64.9, ry: PI } },
    gate: { x: L.gorn.xc, z: L.gateZ, ry: PI },
  };
  L.pois = [
    { id: 'square', kind: 'square', x: 11, z: 22.4, label: 'Площадь Солнца', icon: '⛲', ry: 0 },
    { id: 'park', kind: 'park', x: AX, z: 16.4, label: 'Парк «Каштановый»', icon: '🌳', ry: 0, line: 'Пруд, мостик, лавочки и листопад.' },
    { id: 'ducks', kind: 'park', x: L.pond.b.x, z: L.pond.b.z - L.pond.b.r - 3.4, label: 'Утиный пруд', icon: '🦆', ry: 0, line: 'Утки, мостик и листья на воде.' },
    { id: 'dogpark', kind: 'dogpark', x: -59.5, z: 21.8, label: 'Собачья площадка', icon: '🐾', ry: PI, line: 'Барьеры, тоннель и миска с водой.' },
    { id: 'view', kind: 'view', x: HP.sx, z: -29.2, label: 'Смотровая на холме', icon: '🔭', ry: 0, line: 'Весь город как на ладони.', needsHeight: true, foot: { x: HP.sx, z: -0.9 } },
    { id: 'pier', kind: 'view', x: PR.x, z: PR.z0 + 3.5, label: 'Пирс', icon: '⚓', ry: 0, line: 'Река, лодочка и фонарь на краю.' },
    { id: 'embank', kind: 'view', x: 11, z: 62.7, label: 'Набережная', icon: '🌊', ry: 0, line: 'Фонари, лавочки и река.' },
    { id: 'market', kind: 'shop', x: 74.2, z: 35.9, label: 'Рынок', icon: '🧺', ry: PI / 2, line: 'Яблоки, тыквы, открытки и варежки.' },
    { id: 'garage', kind: 'garage', x: 76.6, z: 59.0, label: 'Гараж «Круглые фары»', icon: '🚗', ry: PI, line: 'Здесь живёт машинка.' },
    { id: 'bikes', kind: 'bikes', x: 92, z: 63.4, label: 'Велопрокат', icon: '🚲', ry: PI, line: 'Велосипеды: садись и катись.', rack: L.spots.rental.rack },
    { id: 'edge', kind: 'edge', x: L.gorn.x1 + 1.1, z: -56, label: 'За город ↑', icon: '🛣', ry: PI, line: 'Дорога из города — через луга, за холмы.' },
  ];
  // точка «вид» на холме: пока героиня не умеет подниматься (WORLD.HEIGHT_OK), карта ведёт к подножию лестницы
  L.poiAt = p => (p && p.needsHeight && !L.hillOpen() && p.foot ? Object.assign({}, p, p.foot) : p);
  // дорожки жителей: замкнутые — первая точка повторена в конце
  const closeLoop = pts => pts.concat([pts[0].slice()]);
  const rrLoop = (x0, x1, z0, z1) => closeLoop([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  L.paths = {
    square_loop: rrLoop(-24.35, 46.35, 13.4, 50.35),
    park_loop: (() => { const pts = [], c = [AX + 0.2, 32.4]; for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2, dx = Math.cos(a), dz = Math.sin(a); let r = 3; while (r < 30 && L.pondSD(c[0] + dx * r, c[1] + dz * r) < 3.6) r += 0.1; pts.push([+(c[0] + dx * r).toFixed(2), +(c[1] + dz * r).toFixed(2)]); } return closeLoop(pts); })(),
    dog_loop: rrLoop(-64.6, -54.4, 17.4, 26.2),
    promenade: [[-118, 62.7], [-60, 62.7], [0, 62.7], [60, 62.7], [118, 62.7]],
    market_lane: [[73.6, 35.9], [87, 35.9], [100.8, 35.9]],
    oct_west: [[-118, 1.2], [-90, 1.2], [-70, 1.2]],
    park_north: [[-108.6, 13.4], [-72, 13.4], [-35.6, 13.4]],
    park_south: [[-108.6, 50.4], [-72, 50.4], [-35.6, 50.4]],
    park_west: [[-108.6, 13.4], [-108.6, 50.4]],
    east_north: [[73.1, 12.9], [86, 12.9], [101.2, 12.9]],
    gorn_west: [[101.2, 12.9], [101.2, 33], [101.2, 51.3]],
    gorn_east: [[111.2, 13], [111.2, 35.9], [111.2, 57]],
    sun: [[58.6, 14], [58.6, 58]],
    garages: [[73, 59.3], [86, 59.3], [100, 59.3]],
    back_lane: [[66.9, 13], [66.9, 33.4]],
  };
  L.lawns = [
    { x0: L.inner.x0 + 3, x1: -6, z0: L.inner.z0 + 3, z1: L.inner.z1 - 3 }, { x0: 36, x1: L.inner.x1 - 3, z0: L.inner.z0 + 3, z1: L.inner.z1 - 3 },
    { x0: -48.6, x1: L.outer.x0 - 3, z0: 14.9, z1: 48.85 }, Object.assign({}, PK.lawn),
    { x0: -121, x1: -71, z0: -84, z1: -2.6 },                                   // холм
  ];
  L.water = [
    { x0: -140, x1: 170, z0: L.river.z, z1: 180 },
    (() => { const pts = [], c = [AX, 32.4]; for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2, dx = Math.cos(a), dz = Math.sin(a); let r = 0.5; while (r < 30 && L.pondSD(c[0] + dx * r, c[1] + dz * r) < 0) r += 0.1; pts.push([c[0] + dx * r, c[1] + dz * r]); } return pts; })(),
  ];
  L.squares = [{ x: L.fountain.x, z: L.fountain.z, r: 13 }];
  L.parkPaths = [{ x0: -51, x1: -48.6, z0: 14.9, z1: 48.85 }, { x0: AX - 1.2, x1: AX + 1.2, z0: 11.9, z1: 51.85 }, { x0: -69.4, x1: -50.6, z0: 30.3, z1: 32.7 },
    { x: -43.2, z: 36, r: 3.4 }, { x0: -44.4, x1: -42.0, z0: 18.5, z1: 48.85 }, L.paths.park_loop.map(p => p.slice())];
  // режим «смотровая»: предложение интегратору — туман дальше, дальние куски всё равно «коробками»
  L.viewFog = { near: 34, far: 150, camFar: 160 };
  WORLD.EXPAND_PLAN = { NEW_HOUSES, OLD_HOUSES, STALLS, GARAGES, footOf, doorWxOf, sdBox, sdSeg, smin, sstep, sdRR, sdRR4, onBridge, onPier, onStairs, onPlat, stairH };

  // указатель выезда (волна 3): поездка наверх — «<название села> ↑» / «В горы ↑» (CONFIG.VILLAGE_NAMED, текст даёт
  // WORLD.Regions.signLabel()); без модулей поездки — «За город ↑». Ставится в начале сборки: арка, щиты, карта.
  L.edgeLabel = () => { try { if (WORLD.Regions && WORLD.Regions.signLabel) return WORLD.Regions.signLabel() || 'За город ↑'; } catch (e) { /* ниже */ } return 'За город ↑'; };
  WORLD.buildMap = async function (C) {
    const { H, scene, SIGN } = C;
    { const lb = L.edgeLabel(); L.edge.label = lb; L.edge.labelNeutral = lb; (L.pois || []).forEach(p => { if (p.kind === 'edge') p.label = lb; }); }
    const tBuild0 = performance.now(), TM = L._tm = [];   // замеры шагов сборки (для отладки)
    const step = async msg => { TM.push([msg || '·', Math.round(performance.now() - tBuild0)]); const t = performance.now(); await C.step(msg); TM.push(['wait', Math.round(performance.now() - t)]); };
    const PF = L._prof = [], mark = n => PF.push([n, Math.round(performance.now() - tBuild0)]);
    const T = H.T, { keep, GEO, put, box, sph, sphS, cyl, rbox, toon, tex, cnv, rrect, text, blobGeo, rng, mixHex } = H;
    const R = rng(1010);
    const K = H.makeKitLit();
    const colliders = { boxes: [], circles: [] };
    const CRATES = [[98.5, 39.02, 1, 0.08], [99.36, 39.06, 2, -0.05], [100.22, 38.98, 1, 0.16]];   // [x, z, ящиков в стопке, поворот]
    const addBox = (x0, x1, z0, z1, h = 5) => colliders.boxes.push({ x0, x1, z0, z1, h });
    const addCircle = (x, z, r) => colliders.circles.push({ x, z, r });
    // волна 5 (js/move.js): на что можно запрыгнуть — коробки в формате регионов { type:'box', x,z,w,d,ry,y0,y1,id } (их видит
    // только Move; прежние круги/коробки тех же вещей помечены move:'skip' — для Move их нет, остальной город их видит как раньше)
    colliders.tops = [];
    const addTop = (x, z, w, d, ry, y0, y1, id, mode) => colliders.tops.push({ type: 'box', x, z, w, d, ry: ry || 0, y0, y1, id, move: mode || 'solid' });
    // скамейка (benchG): сиденье 1,42 × 0,42 на высоте 0,5; спинка — тонкая стенка 0,92 (перепрыгнуть можно, встать — нет)
    const benchTop = (x, z, ry, y = 0) => { addTop(x, z, 1.46, 0.44, ry, y - 0.05, y + 0.5, 'bench'); addTop(x - Math.sin(ry) * 0.25, z - Math.cos(ry) * 0.25, 1.46, 0.1, ry, y - 0.05, y + 0.93, 'benchBack', 'wall'); };
    const addCircleSkip = (x, z, r) => colliders.circles.push({ x, z, r, move: 'skip' });

    /* --- куски 32 × 32 м: вся статика кладётся в кусок по своей точке --- */
    const ZS = 32, zones = new Map();
    const zkey = (x, z) => Math.floor((x + 64) / ZS) + ',' + Math.floor((z + 48) / ZS);
    const zone = (x, z) => { const k = zkey(x, z); if (!zones.has(k)) { const g = new T.Group(); g.userData.zone = k; scene.add(g); zones.set(k, g); } return zones.get(k); };
    // новые районы (волна 3) одеваются лениво: свои куски, под общим корнем, видимы после склейки
    const newRoot = new T.Group(); newRoot.name = 'expand'; newRoot.visible = false; scene.add(newRoot);
    const zonesN = new Map();
    const zoneN = (x, z) => { const k = zkey(x, z); if (!zonesN.has(k)) { const g = new T.Group(); g.userData.zone = 'n' + k; newRoot.add(g); zonesN.set(k, g); } return zonesN.get(k); };
    // инстансы по кускам: kind → { geo, mat, cast, color, items: Map(zone → [...]) }
    const KINDS = {};
    const kind = (name, geo, mat, o = {}) => (KINDS[name] = { geo, mat, cast: o.cast !== false, items: new Map(), colored: !!o.colored, r: o.r || 2 });
    // инстансы — клетками 16 × 16 м: так их сфера-граница маленькая и отсечение по камере работает
    const ikey = (x, z) => Math.floor((x + 64) / 16) + ',' + Math.floor((z + 48) / 16);
    // новые районы: клетками 32 м (меньше вызовов: деревьев много), строятся лениво
    const NI = {};
    let instNew = false;
    const inst = (name, x, z, ry = 0, s = 1, col = null, y = 0, sy) => {
      const it = { x, y, z, ry, s, sy: sy === undefined ? s : sy, col };
      if (instNew) { (NI[name] = NI[name] || []).push(it); return; }
      const k = KINDS[name], zk = ikey(x, z);
      if (!k.items.has(zk)) k.items.set(zk, []);
      k.items.get(zk).push(it);
    };

    // «бугристая» низкополигональная сфера: кроны и кусты
    const lowBlob = keep(new T.SphereGeometry(1, 9, 6));
    { const p = lowBlob.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.08 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7) * Math.sin(z * 4.4 + 0.7) - (y < -0.4 ? 0.15 * (-y - 0.4) : 0); p.setXYZ(i, x * k, y * k, z * k); } lowBlob.computeVertexNormals(); }
    kind('bush', lowBlob, toon('#FFFFFF'), { colored: true, r: 1.2, cast: false });

    /* ---------- текстуры земли ---------- */
    const [tcv, tcx] = cnv(256, 256), TR = rng(7);
    tcx.fillStyle = '#D6C8C2'; tcx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 32 : 0;
      for (let c = -1; c < 5; c++) {
        const x = c * 64 + off + 3, y = r * 64 + 3;
        tcx.fillStyle = `hsl(${16 + TR() * 16}, ${16 + TR() * 12}%, ${87 + (TR() - 0.5) * 5}%)`; rrect(tcx, x, y, 58, 58, 13); tcx.fill();
        tcx.fillStyle = 'rgba(255,255,255,.25)'; rrect(tcx, x + 7, y + 6, 30, 11, 5); tcx.fill();
      }
    }
    const tileTex = tex(tcv); tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping;
    const [acv, acx] = cnv(256, 256), AR = rng(11); acx.fillStyle = '#FFFFFF'; acx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { acx.fillStyle = AR() < 0.5 ? 'rgba(110,90,125,.07)' : 'rgba(255,248,252,.10)'; acx.beginPath(); acx.arc(AR() * 256, AR() * 256, 2 + AR() * 7, 0, 7); acx.fill(); }
    const roadTex = tex(acv); roadTex.wrapS = roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1 / 3.5, 1 / 3.5);
    const [gcv, gcx] = cnv(256, 256), GR = rng(23); gcx.fillStyle = '#C3CB8C'; gcx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 340; i++) { const u = GR(); gcx.fillStyle = u < 0.45 ? 'rgba(120,140,80,.16)' : u < 0.8 ? 'rgba(250,245,200,.16)' : u < 0.92 ? 'rgba(232,150,80,.55)' : 'rgba(225,120,100,.45)'; gcx.beginPath(); gcx.ellipse(GR() * 256, GR() * 256, 2 + GR() * 6, 1.5 + GR() * 3, GR() * 3, 0, 7); gcx.fill(); }
    const grassTex = tex(gcv); grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(1 / 4.5, 1 / 4.5);
    // плитка площади: кольца вокруг фонтана
    const [pcv, pcx] = cnv(512, 512); pcx.fillStyle = '#EBD9CF'; pcx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 12; r++) { const rad = 256 - r * 20; pcx.strokeStyle = r % 2 ? 'rgba(200,150,140,.35)' : 'rgba(255,255,255,.45)'; pcx.lineWidth = r % 3 === 0 ? 6 : 3; pcx.beginPath(); pcx.arc(256, 256, rad - 4, 0, 7); pcx.stroke();
      const n = Math.round(rad / 7); for (let i = 0; i < n; i++) { const a = i / n * PI * 2; pcx.strokeStyle = 'rgba(190,150,140,.2)'; pcx.lineWidth = 2; pcx.beginPath(); pcx.moveTo(256 + Math.cos(a) * (rad - 4), 256 + Math.sin(a) * (rad - 4)); pcx.lineTo(256 + Math.cos(a) * (rad - 22), 256 + Math.sin(a) * (rad - 22)); pcx.stroke(); } }
    const plazaTex = tex(pcv);
    const [wcv, wcx] = cnv(256, 256), WR = rng(5); wcx.fillStyle = '#FFFFFF'; wcx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { wcx.strokeStyle = WR() < 0.6 ? 'rgba(255,255,255,.9)' : 'rgba(120,150,190,.25)'; wcx.lineWidth = 2 + WR() * 3; const x = WR() * 256, y = WR() * 256, w = 12 + WR() * 30; wcx.beginPath(); wcx.moveTo(x, y); wcx.quadraticCurveTo(x + w / 2, y - 4, x + w, y); wcx.stroke(); }
    const waterTex = tex(wcv); waterTex.wrapS = waterTex.wrapT = T.RepeatWrapping; waterTex.repeat.set(1 / 9, 1 / 9);

    const M = {
      tile: toon('#FFFFFF', { map: tileTex }), road: toon('#A9A3B3', { map: roadTex }), grass: toon('#FFFFFF', { map: grassTex }),
      plaza: toon('#FFFFFF', { map: plazaTex }), water: toon('#A6CBE2', { map: waterTex, emissive: new T.Color('#6E8FB8'), emissiveIntensity: 0.18 }),
      curb: toon('#D2C6CA'), dash: toon('#F6EFEA'), wall: toon('#C9B7B0'), far: toon('#CBC3B4'),
      meadow: toon('#DDEBC4', { map: grassTex }),   // волна 3: луга и склон холма — та же трава, чуть зеленее
    };
    // плоская фигура на земле: точки [x, z] → геометрия в мире (uv — в метрах, повтор задаёт текстура)
    const flatShape = (outer, holes = []) => {
      const sh = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, -z)));
      holes.forEach(hp => sh.holes.push(new T.Path(hp.map(([x, z]) => new T.Vector2(x, -z)))));
      const g = new T.ShapeGeometry(sh, 6); g.rotateX(-PI / 2); return keep(g);
    };
    const ground = (geo, mat, y, par = scene) => { const m = new T.Mesh(geo, mat); m.position.y = y; m.receiveShadow = true; m.castShadow = false; par.add(m); m.userData.ground = true; return m; };
    const arcPts = (cx, cz, r, a0, a1, n = 8) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; };
    const rrPts = (x0, x1, z0, z1, r, n = 6) => [].concat(arcPts(x1 - r, z0 + r, r, -PI / 2, 0, n), arcPts(x1 - r, z1 - r, r, 0, PI / 2, n), arcPts(x0 + r, z1 - r, r, PI / 2, PI, n), arcPts(x0 + r, z0 + r, r, PI, PI * 1.5, n));
    tileTex.repeat.set(1 / 2.2, 1 / 2.2);

    await step('земля и дороги');
    /* ---------- земля: плитка везде, дороги, газоны, площадь ---------- */
    ground(flatShape([[-140, -170], [175, -170], [175, 66.5], [-140, 66.5]]), M.tile, 0);
    const O = L.outer, I = L.inner, oc = L.oct;
    // дороги всего города одной сеткой по функции расстояния: прежние кольцо и Октябрьская — на тех же местах
    const RG = H.sdfGrid(L.roadSD, -126, 126, -97, 64, 0.5, 4);
    mark('road grid ' + RG.evals);
    ground(H.sdfMesh(null, 0, 0, 0, 0, 0.5, { grid: RG }), M.road, 0.008);
    mark('road mesh');
    const lawns = [[I.x0 + 3, -6, I.z0 + 3, I.z1 - 3], [36, I.x1 - 3, I.z0 + 3, I.z1 - 3], [-48.6, O.x0 - 3, oc.z1 + 3, L.park.lawn.z1]];
    const parkHole = rrPts(-44.4, -42.0, 18.5, 47.6, 1.1, 3);
    lawns.forEach(([x0, x1, z0, z1], i) => ground(flatShape(rrPts(x0, x1, z0, z1, 1.2, 4), i === 2 ? [parkHole] : []), M.grass, 0.012));
    // круг у скамеек в парке — плиткой (поверх газона)
    { const g = keep(new T.CircleGeometry(3.4, 28)); g.rotateX(-PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i)); const m = ground(g, M.tile, 0.016); m.position.set(-43.2, 0.016, 36); }
    { const g = keep(new T.CircleGeometry(13, 48)); g.rotateX(-PI / 2); const m = ground(g, M.plaza, 0.014); m.position.set(L.fountain.x, 0.014, L.fountain.z); }
    // река
    { const g = keep(new T.PlaneGeometry(300, 110)); g.rotateX(-PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
      const m = ground(g, M.water, -0.55); m.position.set(15, -0.55, 121.5); C.water = m; }

    /* --- бордюры и разметка (в куски) --- */
    const curbRun = (pts, closed, h = 0.13, w = 0.32, mat = M.curb, zf = zone, skip) => {
      const n = pts.length, last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n], len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.01) continue;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; if (skip && skip(mx, mz)) continue;
        put(zf(mx, mz), GEO.box, mat, [mx, h / 2, mz], [len + w * 0.6, h, w], [0, -Math.atan2(z1 - z0, x1 - x0), 0]).castShadow = false;
      }
    };
    // бордюр — по контуру всех дорог (в том числе на старых местах: кольцо, Октябрьская)
    // в пределах карты волны 2 — сразу; новые районы (и их разметка) — лениво, вместе с районами
    const oldArea = (x, z) => x > -49 && x < 70 && z > -2.5 && z < 66.5;
    const roadEdges = H.sdfContours(null, 0, 0, 0, 0, 0.5, { grid: RG, tol: 0.03 });
    roadEdges.forEach(l => curbRun(l.pts, false, 0.13, 0.32, M.curb, zone, (x, z) => z < -94.5 || !oldArea(x, z)));
    mark('road edges+curbs');
    const LATER = [];   // ленивые работы разметки (выполняются в dressRoads)
    lawns.forEach(([x0, x1, z0, z1]) => curbRun(rrPts(x0, x1, z0, z1, 1.2, 4), true, 0.09, 0.18, toon('#BFB2AE')));
    // пунктир по оси дорог, зебры у кинотеатра, у входов на площадь, в парк, на рынок
    for (let x = oc.x0 + 2; x < oc.x1 - 2; x += 3) if (Math.abs(x) > 2) put(zone(x, oc.zc), GEO.box, M.dash, [x, 0.02, oc.zc], [1.4, 0.02, 0.16]).castShadow = false;
    L.loopPath.forEach(([x, z], i) => { if (z > oc.z1 + 1 && i % 3 === 0) put(zone(x, z), GEO.box, M.dash, [x, 0.02, z], [0.16, 0.02, 0.16]).castShadow = false; });
    const zebra = (x, z, alongX, n = 10, zf = zone) => { for (let i = 0; i < n; i++) { const t = -3.6 + i * 0.8; put(zf(x, z), GEO.box, M.dash, alongX ? [x, 0.022, z + t] : [x + t, 0.022, z], alongX ? [2.6, 0.02, 0.42] : [0.42, 0.02, 2.6]).castShadow = false; } };
    zebra(0, oc.zc, true); zebra(11, 56, true); zebra(-30, 31.9, false); zebra(52, 31.9, false); zebra(26, oc.zc, true);
    LATER.push(zf => {
      roadEdges.forEach(l => curbRun(l.pts, false, 0.13, 0.32, M.curb, zf, (x, z) => z < -94.5 || oldArea(x, z)));
      const dashX = (x0, x1, z, skip) => { for (let x = x0; x < x1; x += 3) if (!skip || !skip(x)) put(zf(x, z), GEO.box, M.dash, [x, 0.02, z], [1.4, 0.02, 0.16]).castShadow = false; };
      const dashZ = (z0, z1, x, skip) => { for (let z = z0; z < z1; z += 3) if (!skip || !skip(z)) put(zf(x, z), GEO.box, M.dash, [x, 0.02, z], [0.16, 0.02, 1.4]).castShadow = false; };
      dashX(-107.5, oc.x0, oc.zc, x => Math.abs(x - L.park.axis) < 4.5); dashX(oc.x1 + 3, 100.5, oc.zc);
      dashZ(17, 47, -114.15, z => Math.abs(z - 33) < 4.6); dashX(-107.5, -35, 56, x => Math.abs(x - L.park.axis) < 4.5);
      dashZ(17, 49, 69.6, z => Math.abs(z - 35.9) < 4.6); dashX(73, 100, 55.3); dashZ(-80, 52, L.gorn.xc, z => Math.abs(z - 35.9) < 5 || (z > -2 && z < 14) || Math.abs(z - L.gateZ) < 1.5 || z < -62);
      const zebraW = (x, z, alongX, wd) => { const n = Math.floor((wd - 0.6) / 0.8); for (let i = 0; i < n; i++) { const t = -(n - 1) * 0.4 + i * 0.8; put(zf(x, z), GEO.box, M.dash, alongX ? [x, 0.022, z + t] : [x + t, 0.022, z], alongX ? [2.6, 0.02, 0.42] : [0.42, 0.02, 2.6]).castShadow = false; } };
      zebra(L.park.axis, oc.zc, true, 10, zf); zebra(L.park.axis, 56, true, 10, zf); zebraW(69.6, 35.9, false, 6.0); zebraW(L.gorn.xc, 35.9, false, 8.3); zebra(-114.15, 33, false, 10, zf);
    });
    await step('фасады Октябрьской');
    /* ---------- Октябрьская: 4 сюжетных дома + киоск + 6 витрин прогулки ---------- */
    const FAC = WORLD.makeFacades(H, SIGN), FZ = L.FRONT_Z;
    const placeB = (b, x, z, tilt = 0) => { b.g.position.set(x, 0, z); b.g.rotation.z = tilt; zone(x, z).add(b.g); return b; };
    // номер дома (bid) — для «серый → цветной» в склейке: 1 кино, 2 бюро, 3 кондитерская, 4 подъезд
    [[FAC.cinema, 0, 0, 1], [FAC.bureau, 6.2, -0.014, 2], [FAC.sweets, 16.2, 0.009, 3], [FAC.roof, 22.6, 0.018, 4]].forEach(([f, x, tl, bid]) => { const b = placeB(f(K), x, FZ, tl); b.g.userData.bid = bid; });
    placeB(FAC.kiosk(K), 9.6, -1.1); addBox(8.85, 10.35, -1.75, -0.45, 1.7);
    const SH = WORLD.SHOPS || {};
    Object.keys(SH).forEach(k => {
      try {
        const def = SH[k], g0 = new T.Group();
        const built = def.build(Object.assign({}, H, { group: g0, K, o: {} })) || {};
        const bg = built.g || g0; bg.position.set(def.x, 0, FZ); zone(def.x, FZ).add(bg);
      } catch (e) { console.warn('shop', k, e); }
    });

    /* --- дома-«заполнители»: пастель, окна, крыши разных форм --- */
    const FCOL = ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC', '#F2DFC8', '#D6E4EE'];
    const FROOF = ['#C98F86', '#9AA5C5', '#B8907A', '#D9A0A0', '#8FAE9A'];
    const prism = keep(new T.ExtrudeGeometry(H.triShape(1, 0.5), { depth: 1, bevelEnabled: false })); prism.translate(0, 0, -0.5);
    const arcWin = keep(new T.ShapeGeometry(H.archShape(1, 1.4), 6)); arcWin.translate(0, -0.7, 0);
    const winLit = K.m('#FFE3A8', { glow: '#FFD08A', gi: 0.55 }), winDark = K.m('#8E89A6'), frameM = K.m('#FFFDF9');
    const doorO = H.extrude(H.archShape(0.86, 1.55), 0.05), doorI = H.extrude(H.archShape(0.7, 1.45), 0.05);   // общие на все двери
    const ironM = K.m('#6A5670'), potM = K.m('#C96F4A');
    // фасад лицом к +z; x, z — середина фасада; ry — поворот; w, h — ширина и высота; d — глубина
    // o (волна 3): zf — свой «кусок» (zoneN для новых районов), planned — дверь уже в списке, boxes — ящики с цветами под всеми окнами,
    //   balcony — балкон на втором этаже, turret — круглая башенка на углу, gable — фронтон с круглым окошком
    const fillerDoors = [];
    function filler(x, z, ry, w, h, d, seed, o = {}) {
      const q = rng(seed), g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      let doorWx = null;
      const wall = K.m(FCOL[seed % FCOL.length]), roofM = K.m(FROOF[seed % FROOF.length]), trim = K.m(mixHex(FCOL[seed % FCOL.length], '#FFFFFF', 0.55));
      rbox(g, wall, 0, h / 2, -d / 2, w, h, d, 0.12);
      rbox(g, K.m(mixHex(FCOL[seed % FCOL.length], '#9C8A92', 0.25)), 0, 0.16, -d / 2 + 0.03, w + 0.08, 0.32, d + 0.06, 0.08);
      const rt = o.roof !== undefined ? o.roof : seed % 3;
      if (rt === 0) put(g, prism, roofM, [0, h, -d / 2], [w + 0.35, 1.5, d + 0.3]);
      else if (rt === 1) put(g, GEO.halfCyl, roofM, [0, h, -d / 2], [0.75, w + 0.25, d / 2 + 0.12], [0, PI / 2, PI / 2]);
      else { H.cornice(g, trim, h, w, d); }
      if (o.chimney !== false && seed % 2) rbox(g, roofM, w * 0.28, h + 0.9, -d * 0.6, 0.32, 0.9, 0.32, 0.05);
      const cols = Math.max(1, Math.floor(w / 1.25)), rows = Math.max(1, Math.floor((h - 0.6) / 1.25));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = -w / 2 + (c + 0.5) * w / cols, wy = 1.05 + r * 1.2;
        if (r === 0 && o.door !== false && c === Math.floor(cols / 2)) {
          doorWx = wx;
          put(g, doorO, trim, [wx, 0, 0.01]);
          put(g, doorI, K.m(o.shop ? o.shop.door || '#C2405B' : ['#C2405B', '#5E7A8E', '#7A5A6A', '#6E9A7E'][seed % 4]), [wx, 0, 0.03]);
          continue;
        }
        if (o.shop && r === 0) {   // лавка: витрина вместо окна первого этажа — тёплый свет и товар на полочке
          rbox(g, frameM, wx, wy - 0.05, 0.02, 0.86, 1.0, 0.06, 0.04);
          put(g, GEO.plane, K.m('#FFE7B8', { glow: '#FFD08A', gi: 0.5 }), [wx, wy - 0.05, 0.055], [0.72, 0.86, 1]);
          rbox(g, trim, wx, wy - 0.42, 0.1, 0.84, 0.06, 0.16, 0.02);
          (o.shop.goods || ['#F3CF73', '#EFA3B5', '#9DB8E0']).forEach((cc, i) => sphS(g, K.m(cc), wx - 0.22 + i * 0.22, wy - 0.3, 0.1, 0.075));
          continue;
        }
        rbox(g, frameM, wx, wy, 0.02, 0.66, 0.86, 0.06, 0.04);
        put(g, arcWin, q() < 0.32 ? winLit : winDark, [wx, wy + 0.08, 0.06], [0.5, 0.5, 1]);
        rbox(g, trim, wx, wy - 0.46, 0.09, 0.8, 0.07, 0.16, 0.03);
        if (o.boxes ? r < 2 : q() < 0.3) { rbox(g, potM, wx, wy - 0.36, 0.17, 0.62, 0.13, 0.16, 0.03); [-0.2, 0, 0.2].forEach((dx, i) => sphS(g, K.m(['#EFA3B5', '#F3CF73', '#D9774F'][i]), wx + dx, wy - 0.25, 0.2, 0.07)); }
      }
      if (o.balcony && rows > 1) {   // балкон: плита, кованые столбики, горшки
        const bx = -w / 2 + (Math.floor(cols / 2) + 0.5) * w / cols, by = 1.05 + 1.2 - 0.5;
        rbox(g, trim, bx, by, 0.32, 1.3, 0.1, 0.62, 0.03);
        for (let i = 0; i < 7; i++) cyl(g, ironM, bx - 0.6 + i * 0.2, by + 0.3, 0.6, 0.016, 0.5);
        box(g, ironM, bx, by + 0.56, 0.6, 1.26, 0.04, 0.04); [-0.62, 0.62].forEach(dx => box(g, ironM, bx + dx, by + 0.56, 0.32, 0.04, 0.04, 0.58));
        [-0.4, 0.38].forEach((dx, i) => { put(g, GEO.pot, potM, [bx + dx, by + 0.15, 0.42], [0.1, 0.18, 0.1]); sphS(g, K.m(['#EFA3B5', '#F3CF73'][i]), bx + dx, by + 0.32, 0.42, 0.12, 0.1, 0.12); });
      }
      if (o.turret) {   // башенка на правом углу: цилиндр, конус-крыша, два окошка
        const tx = w / 2 - 0.1, th = h + 0.9, tr = 0.62;
        cyl(g, wall, tx, th / 2, -0.25, tr, th); rbox(g, trim, tx, th, -0.25, tr * 2 + 0.16, 0.12, tr * 2 + 0.16, 0.05);
        put(g, GEO.cone, roofM, [tx, th + 0.75, -0.25], [tr + 0.12, 1.4, tr + 0.12]); sphS(g, K.m('#FFD45E', { glow: '#FFB938', gi: 0.35 }), tx, th + 1.5, -0.25, 0.06);
        [1.6, th - 1.0].forEach((y, i) => { put(g, arcWin, i ? winLit : winDark, [tx + 0.12, y, -0.25 + tr - 0.02], [0.32, 0.36, 1]); rbox(g, frameM, tx + 0.12, y - 0.32, -0.25 + tr + 0.04, 0.42, 0.06, 0.1, 0.02); });
      }
      if (o.gable) {   // фронтон над фасадом: треугольник с круглым окошком
        put(g, prism, wall, [0, h, 0.02], [w * 0.62, 1.25, 0.25], [0, 0, 0]);
        put(g, H.ringG(0.24, 0.05), frameM, [0, h + 0.45, 0.17]); cyl(g, winLit, 0, h + 0.45, 0.15, 0.22, 0.03, [PI / 2, 0, 0]);
      }
      if (o.awning) { const aw = K.m(o.awning), cr = K.m('#FFFDF9'); for (let i = 0; i < 6; i++) rbox(g, i % 2 ? cr : aw, -w * 0.4 + i * w * 0.16, 2.35, 0.32, w * 0.16, 0.08, 0.66, 0.02, [0.45, 0, 0]); }
      if (o.shop && doorWx !== null) dressShop(g, doorWx, h, o.shop);
      (o.zf || zone)(x, z).add(g);
      if (doorWx !== null && !o.planned) {   // дверь в мировых координатах: точка у порога и точка подхода (на 0,75 м наружу)
        const c = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
        const [dx, dz] = at(doorWx, 0.02), [ax, az] = at(doorWx, 0.75);
        fillerDoors.push({ x: dx, z: dz, ax, az, nx: sn, nz: c, w, h, seed, id: o.id || null, shop: !!o.shop });
      }
      return g;
    }
    // вывеска лавки над дверью (в общий атлас) и маркиза; цвета и надписи — из WORLD.INTERIORS
    function dressShop(g, wx, h, sh) {
      const [cv, c] = cnv(384, 112);
      c.fillStyle = '#FFF6EE'; rrect(c, 2, 2, 380, 108, 26); c.fill();
      c.strokeStyle = sh.col || '#C2405B'; c.lineWidth = 7; rrect(c, 11, 11, 362, 90, 20); c.stroke();
      text(c, sh.sign || '', 192, sh.sub ? 46 : 58, sh.sub ? 44 : 50, sh.col || '#C2405B', { f: 'Comfortaa', w: 700, max: 330 });
      if (sh.sub) text(c, sh.sub, 192, 84, 24, '#6E6272', { w: 800, max: 330 });
      const sy = Math.min(h - 0.5, 2.62);
      rbox(g, K.m(sh.col || '#C2405B'), wx, sy, 0.05, 1.5, 0.48, 0.06, 0.03);
      put(g, GEO.plane, K.t(cv, { alpha: true }), [wx, sy, 0.085], [1.42, 0.41, 1]);
      const aw = K.m(sh.awning || sh.col || '#F08FA8'), cr = K.m('#FFFDF9');
      for (let i = 0; i < 5; i++) rbox(g, i % 2 ? cr : aw, wx - 0.52 + i * 0.26, 2.0, 0.3, 0.26, 0.07, 0.6, 0.02, [0.45, 0, 0]);
    }
    // лавки шаблона (§2.5 world_unify): дома-заполнители по порядку → id лавки
    const GEN = WORLD.GEN_SLOTS = { w0: 'g_bakery', w1: 'g_cocoa', e0: 'g_toys', e1: 'g_post', s1: 'g_wash', s2: 'g_gallery', s3: 'g_umbrella', s4: 'g_yarn' };
    const INT = WORLD.INTERIORS || {};
    const shopOpt = slot => { const id = GEN[slot], d = id && INT[id]; return d ? { id, shop: d.front || {} } : {}; };
    // тот, кто раньше стоял на 11.9, переехал: на его месте узкий домик с круглым окошком
    { const g = filler(11.9, FZ, 0, 1.95, 2.9, 1.8, 3, { roof: 0, chimney: false, door: false });
      const fm = K.m('#FFFDF9'); put(g, H.ringG(0.32, 0.06), fm, [0, 1.75, 0.04]); cyl(g, winLit, 0, 1.75, 0.03, 0.3, 0.03, [PI / 2, 0, 0]);
      put(g, H.extrude(H.archShape(0.8, 1.2), 0.05), K.m('#B98C6A'), [0, 0, 0.02]); }
    // ряд Октябрьской продолжается: заполнители на запад и на восток (фасады на z −2)
    { let x = -17.2, s = 11, i = 0; while (x > -63) { const w = 3.2 + (s % 3) * 0.5, h = 3.6 + (s % 4) * 0.55, so = shopOpt('w' + i++); filler(x - w / 2, FZ, 0, w, h, 3.2, s, Object.assign({ awning: !so.shop && s % 3 === 1 ? ['#F08FA8', '#9DB8E0', '#F7B267'][s % 3] : null }, so)); x -= w + 0.35; s += 1; } }
    { let x = 40.6, s = 31, i = 0; while (x < 86) { const w = 3.2 + (s % 3) * 0.5, h = 3.6 + (s % 4) * 0.55, so = shopOpt('e' + i++); filler(x + w / 2, FZ, 0, w, h, 3.2, s, Object.assign({ awning: !so.shop && s % 3 === 1 ? ['#F08FA8', '#9DB8E0', '#F7B267'][s % 3] : null }, so)); x += w + 0.35; s += 1; } }
    addBox(-80, 100, -14, -1.75, 6);
    // дома за Солнечным проспектом: фасады лицом на запад (к кольцу)
    [[16, 6.2, 4.6, 41], [23.5, 5.4, 5.2, 42], [31, 5.8, 4.2, 43], [41.2, 7.2, 4.8, 44], [49.5, 6, 5.4, 45], [56.4, 5.2, 4.4, 46]].forEach(([z, w, h, s], i) => {
      filler(61.2, z, -PI / 2, w, h, 4.6, s, shopOpt('s' + i)); addBox(61.2, 66, z - w / 2, z + w / 2, h + 1);
    });
    // в просветах между витринами: штакетник и живая изгородь; тыквы и хризантемы у дверей
    const picket = keep(new T.BoxGeometry(0.07, 0.56, 0.05)), fenceM = K.m('#FFF6EE');
    [[-5.45, -2.3], [2.3, 4.3], [8.1, 10.75], [13.05, 14.3], [18.1, 20.7], [24.5, 28.35]].forEach(([a, b], gi) => {
      const zF = -2.6, zg = zone((a + b) / 2, zF);
      for (let x = a + 0.1; x < b - 0.05; x += 0.17) put(zg, picket, fenceM, [x, 0.33, zF]);
      [0.2, 0.46].forEach(y => rbox(zg, fenceM, (a + b) / 2, y, zF - 0.03, b - a, 0.05, 0.03, 0.012));
      for (let x = a + 0.25; x < b; x += 0.5) inst('bush', x, -3.15, x, 0.36, ['#C98A5C', '#C9B26A', '#9DB08E', '#D98C8C'][(gi + Math.round(x * 2)) % 4], 0.38, 0.42);
    });
    const pumpGeo = keep(new T.SphereGeometry(1, 14, 9));
    { const p = pumpGeo.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x), rib = 0.9 + 0.1 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5); x *= rib; z *= rib; y *= 0.72; if (y > 0.55) y -= (y - 0.55) * 0.6; p.setXYZ(i, x, y, z); } pumpGeo.computeVertexNormals(); }
    const PK = ['#EE9A55', '#F3D2B0', '#EBB3BA'].map(c => K.m(c)), stemM = K.m('#7A8A55');
    const pumpkin = (x, z, r, k, y = 0) => { const zg = zone(x, z); put(zg, pumpGeo, PK[k], [x, y + r * 0.7, z], [r, r, r], [0, R() * 6, 0]); put(zg, GEO.cylLo, stemM, [x, y + r * 1.38, z], [0.022 + r * 0.06, r * 0.5, 0.022 + r * 0.06], [0, 0, 0.3]); };
    pumpkin(5.32, -1.74, 0.22, 0); pumpkin(5.66, -1.68, 0.14, 2); pumpkin(7.08, -1.74, 0.18, 1); pumpkin(17.98, -1.72, 0.2, 0); pumpkin(17.98, -1.72, 0.13, 2, 0.27);
    pumpkin(-1.25, -1.76, 0.18, 0); pumpkin(21.05, -1.72, 0.16, 1); pumpkin(-12.4, -1.7, 0.2, 2); pumpkin(31.5, -1.72, 0.18, 0);
    function mum(x, z, c1, c2, pot, sc = 1) {
      const zg = zone(x, z), m1 = K.m(c1), m2 = K.m(c2), pm = K.m(pot);
      put(zg, GEO.pot, pm, [x, 0.17 * sc, z], [0.2 * sc, 0.34 * sc, 0.2 * sc]);
      put(zg, blobGeo, K.m('#8FAE62'), [x, 0.42 * sc, z], [0.25 * sc, 0.12 * sc, 0.25 * sc]);
      [[0, 0.56, 0, 0.15], [0.14, 0.5, 0.06, 0.11], [-0.14, 0.5, 0.05, 0.11], [0.06, 0.5, -0.13, 0.11], [-0.04, 0.63, 0.04, 0.09]]
        .forEach(([dx, dy, dz, r], i) => put(zg, GEO.sphLo, i % 2 ? m2 : m1, [x + dx * sc, dy * sc, z + dz * sc], [r * sc, r * sc * 0.8, r * sc]));
    }
    mum(-2.55, -1.75, '#EFA3B5', '#F7C9D4', '#D48D6A', 0.9); mum(2.62, -1.85, '#D9774F', '#E99A6E', '#EBB4BE', 0.85); mum(13.05, -1.8, '#C7A8DD', '#DCC6EC', '#F4E8DA', 0.8);
    mum(19.3, -1.65, '#EFA3B5', '#F7C9D4', '#B9C9AE'); mum(25.75, -1.7, '#D9774F', '#E99A6E', '#EBB4BE');

    mark('facades+fillers'); await step('площадь Солнца');
    /* ---------- площадь: фонтан, скамейки, часы 10:10, клумбы ---------- */
    // фонтан и часы отбрасывают тень: их склеиваем отдельно от кусков (куски тени не отбрасывают)
    const casters = new T.Group(); casters.name = 'casters'; scene.add(casters);
    const F = L.fountain, fz = casters;
    { const g = new T.Group(); g.position.set(F.x, 0, F.z); fz.add(g);
      const stone = K.m('#E9DCD6'), stoneD = K.m('#D4C2BC'), rim = K.m('#FFF6EE'), waterM = K.m('#A7D4E8', { glow: '#7FB6D8', gi: 0.35 }), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.35 });
      const basin = keep(new T.LatheGeometry([[0, 0.12], [2.75, 0.12], [2.78, 0.5], [2.9, 0.62], [3.05, 0.6], [3.12, 0.45], [3.08, 0.05], [3.0, 0]].map(([r, y]) => new T.Vector2(r, y)), 40));
      put(g, basin, stone); put(g, keep(new T.TorusGeometry(2.92, 0.1, 6, 48)), rim, [0, 0.62, 0], null, [PI / 2, 0, 0]);
      put(g, keep(new T.CircleGeometry(2.78, 40)), waterM, [0, 0.42, 0], null, [-PI / 2, 0, 0]).castShadow = false;
      const col = keep(new T.LatheGeometry([[0.5, 0], [0.42, 0.25], [0.26, 0.5], [0.22, 1.2], [0.3, 1.32], [0.18, 1.45], [0.14, 1.95], [0.22, 2.05], [0.1, 2.2], [0, 2.3]].map(([r, y]) => new T.Vector2(r, y)), 20));
      put(g, col, stoneD);
      const bowl = keep(new T.LatheGeometry([[0.2, 0], [1.15, 0.12], [1.22, 0.24], [1.12, 0.26], [0.2, 0.14]].map(([r, y]) => new T.Vector2(r, y)), 32));
      put(g, bowl, stone, [0, 1.3, 0]); put(g, keep(new T.CircleGeometry(1.1, 28)), waterM, [0, 1.52, 0], null, [-PI / 2, 0, 0]).castShadow = false;
      put(g, bowl, stone, [0, 2.0, 0], [0.48, 0.8, 0.48]); sph(g, gold, 0, 2.42, 0, 0.13);
      // восемь рыбок-брызгалок по бортику
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; sph(g, K.m(i % 2 ? '#F7B267' : '#F08FA8'), Math.cos(a) * 2.88, 0.72, Math.sin(a) * 2.88, 0.09, 0.07, 0.12); }
      addCircleSkip(F.x, F.z, F.r + 0.25);
      // волна 5: бортик — низкая стенка по кругу (0,68 м): запрыгнуть и пройтись; внутрь (в воду) — нельзя
      colliders.tops.push({ type: 'circle', x: F.x, z: F.z, r: F.r - 0.62, id: 'fountainWater', move: 'tall' });
      for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2, rr = F.r - 0.09; addTop(F.x + Math.cos(a) * rr, F.z + Math.sin(a) * rr, 2 * PI * rr / 28 + 0.06, 0.4, PI / 2 - a, -0.05, 0.68, 'rim'); }
    }
    // брызги фонтана: одна пачка точек
    { const N = 90, pos = new Float32Array(N * 3), seeds = [];
      for (let i = 0; i < N; i++) seeds.push({ a: R() * PI * 2, sp: 0.6 + R() * 0.5, ph: R(), up: 2.2 + R() * 0.8, src: i % 3 });
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const [scv, scx] = cnv(32, 32), gr = scx.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(230,245,255,0)'); scx.fillStyle = gr; scx.fillRect(0, 0, 32, 32);
      const pts = new T.Points(g, keep(new T.PointsMaterial({ map: tex(scv), color: 0xEAF7FF, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false })));
      pts.position.set(F.x, 0, F.z); pts.frustumCulled = false; scene.add(pts);
      C.spray = { pts, pos, seeds, N };
    }
    // часы на башне показывают 10:10
    const T0 = L.tower;
    { const g = new T.Group(); g.position.set(T0.x, 0, T0.z); g.rotation.y = -0.45; casters.add(g);
      const wall = K.m('#F3D7C6'), wallD = K.m('#E4BBA8'), trim = K.m('#FFFDF9'), roof = K.m('#B9475F'), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 });
      rbox(g, wallD, 0, 0.3, 0, 2.6, 0.6, 2.6, 0.08); rbox(g, wall, 0, 3.6, 0, 2.1, 6.4, 2.1, 0.1);
      rbox(g, trim, 0, 6.85, 0, 2.5, 0.22, 2.5, 0.06); rbox(g, wall, 0, 7.75, 0, 2.2, 1.7, 2.2, 0.08); rbox(g, trim, 0, 8.68, 0, 2.5, 0.2, 2.5, 0.06);
      put(g, GEO.cone, roof, [0, 9.75, 0], [1.75, 2.0, 1.75], [0, PI / 4, 0]); sph(g, gold, 0, 10.85, 0, 0.14); cyl(g, gold, 0, 11.1, 0, 0.02, 0.4);
      const [ccv, cc] = cnv(256, 256); cc.fillStyle = '#FFFDF9'; cc.beginPath(); cc.arc(128, 128, 122, 0, 7); cc.fill(); cc.strokeStyle = '#B9475F'; cc.lineWidth = 10; cc.stroke();
      cc.fillStyle = '#3A2E3F'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; cc.beginPath(); cc.arc(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96, i % 3 ? 5 : 9, 0, 7); cc.fill(); }
      cc.strokeStyle = '#3A2E3F'; cc.lineCap = 'round'; [[(10 + 10 / 60) / 12 * PI * 2, 56, 13], [10 / 60 * PI * 2, 84, 8]].forEach(([a, l, w]) => { cc.lineWidth = w; cc.beginPath(); cc.moveTo(128, 128); cc.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); cc.stroke(); });
      cc.fillStyle = '#B9475F'; cc.beginPath(); cc.arc(128, 128, 10, 0, 7); cc.fill();
      const faceM = K.t(ccv, { alpha: true });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2, s = new T.Group(); s.rotation.y = a; g.add(s); put(s, GEO.cyl, trim, [0, 7.75, 1.1], [0.66, 0.05, 0.66], [PI / 2, 0, 0]); put(s, keep(new T.CircleGeometry(0.6, 32)), faceM, [0, 7.75, 1.13]); }
      for (let i = 0; i < 4; i++) { const a = i * PI / 2, s = new T.Group(); s.rotation.y = a; g.add(s); put(s, H.extrude(H.archShape(0.5, 1.1), 0.04), K.m('#8E89A6'), [0, 4.0, 1.06]); put(s, H.extrude(H.archShape(0.8, 1.5), 0.05), trim, [0, 0, 1.06]); }
      addCircle(T0.x, T0.z, 1.7); colliders.boxes.push({ x0: T0.x - 1.3, x1: T0.x + 1.3, z0: T0.z - 1.3, z1: T0.z + 1.3, h: 9, cam: true, noWalk: true });
    }
    // указатели
    const signPost = (x, z, ry, l1, l2, zf = zone, cv0 = null, y0 = 0) => {
      const g = new T.Group(); g.position.set(x, y0, z); g.rotation.y = ry; zf(x, z).add(g);
      cyl(g, K.m('#6A5670'), 0, 0.9, 0, 0.045, 1.8);
      let cv = cv0, c; if (!cv) { [cv, c] = cnv(512, 160); c.fillStyle = '#FFF6EE'; rrect(c, 4, 4, 504, 152, 30); c.fill(); c.strokeStyle = '#C2405B'; c.lineWidth = 8; rrect(c, 16, 16, 480, 128, 22); c.stroke();
        text(c, l1, 256, l2 ? 64 : 82, l2 ? 54 : 64, '#C2405B', { f: 'Comfortaa', w: 700, max: 440 }); if (l2) text(c, l2, 256, 116, 34, '#6E6272', { w: 800, max: 440 }); }
      rbox(g, K.m('#C2405B'), 0, 1.75, 0, 1.2, 0.42, 0.06, 0.03); const m = K.t(cv, { alpha: true }); put(g, GEO.plane, m, [0, 1.75, 0.035], [1.14, 0.36, 1]); put(g, GEO.plane, m, [0, 1.75, -0.035], [1.14, 0.36, 1], [0, PI, 0]);
      addCircle(x, z, 0.15);
    };
    signPost(-4.2, 14.4, 0, 'Площадь Солнца', 'фонтан · часы'); signPost(-37.6, 15.2, 0.4, 'Парк', 'Каштановый'); signPost(16.5, 60.9, PI, 'Набережная');
    // клумбы-полумесяцы и вазоны у фонтана
    for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3, x = F.x + Math.cos(a) * 10.4, z = F.z + Math.sin(a) * 10.4; mum(x, z, ['#EFA3B5', '#F3CF73', '#C7A8DD'][i % 3], ['#F7C9D4', '#F9E3A6', '#DCC6EC'][i % 3], '#F4E8DA', 1.25); addCircle(x, z, 0.35); }

    mark('square'); await step('деревья, фонари, скамейки');
    /* ---------- инстансы: деревья, фонари, скамейки, кусты ---------- */
    const tmp = () => new T.Group();
    // крона: оттенок задаёт инстанс, вершины — свет/тень комков (больше 1 — светлее)
    const sm = v => { const m = toon('#FFFFFF'); m.color.setRGB(v, v, v); return m; };
    const crownG = (() => { const g = tmp(), mB = sm(1), mD = sm(0.84), mL = sm(1.13), q = rng(7);
      put(g, lowBlob, mB, [0, 1.95, 0], [0.82, 0.9, 0.78]);
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + q(), up = k % 2; put(g, lowBlob, up ? mL : mD, [Math.cos(a) * 0.6, 1.62 + up * 0.55, Math.sin(a) * 0.42], [0.42 + q() * 0.14, 0.4 + q() * 0.12, 0.42 + q() * 0.1], [0, q() * 6, 0]); }
      put(g, lowBlob, mL, [0.12, 2.55, -0.05], [0.42, 0.38, 0.4]); return H.geoOf(g); })();
    const poplarG = (() => { const g = tmp(), mB = sm(1), mD = sm(0.84), mL = sm(1.13);
      put(g, lowBlob, mB, [0, 2.3, 0], [0.62, 1.45, 0.6]); put(g, lowBlob, mD, [-0.3, 1.55, 0.15], [0.4, 0.5, 0.38]); put(g, lowBlob, mL, [0.22, 3.0, 0], [0.36, 0.55, 0.34]); return H.geoOf(g); })();
    const trunkG = (() => { const g = tmp(), tm = K.m('#8A6A55'), tg = keep(new T.CylinderGeometry(0.6, 1, 1, 7));
      put(g, tg, tm, [0, 0.7, 0], [0.12, 1.4, 0.12]); put(g, GEO.cone, tm, [0, 0.1, 0], [0.2, 0.24, 0.2]);
      [-1, 1].forEach(k => put(g, tg, tm, [k * 0.2, 1.35, 0], [0.05, 0.6, 0.05], [0, 0, -k * 0.6])); return H.geoOf(g); })();
    const carpetG = (() => { const g = H.blobDisc(40).clone(); const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(1), em = new Float32Array(n * 3); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('emis', new T.BufferAttribute(em, 3)); return keep(g); })();
    const crownMat = H.emisPatch(H.addRim(toon('#FFFFFF', { vertexColors: true }), 0.8), 'c');
    kind('trunk', trunkG, H.VC.front); kind('crown', crownG, crownMat, { colored: true, r: 3.2 }); kind('poplar', poplarG, crownMat, { colored: true, r: 3.6 });
    // у цветных инстансов свой материал: r149 не пересобирает шейдер, если тот же материал уже собран для инстансов без цвета
    kind('carpet', carpetG, H.emisPatch(toon('#FFFFFF', { vertexColors: true }), 'carpet'), { colored: true, cast: false });
    const AUT = ['#F2A65A', '#E98A7E', '#EDC55B', '#E7A1B0', '#D98A5F', '#E9B04F', '#C9A05A'];
    // дорожка случайных чисел — как в волне 2 (повороты и ряды деревьев не сдвигаются); деревья на месте нового
    // Набережного проезда (низ старого парка, z > 48,3) не ставятся
    const treeGone = (x, z) => x < -34 && x > -50 && z > 48.3;
    const tree = (x, z, s = 1, pi = 0, pop = false) => {
      const r1 = R(), r2 = R(), r3 = pop ? 0 : R();
      if (treeGone(x, z)) return;
      inst('trunk', x, z, r1 * 6, s * (pop ? 0.85 : 1));
      inst(pop ? 'poplar' : 'crown', x, z, r2 * 6, s, AUT[pi % AUT.length]);
      if (!pop) inst('carpet', x + 0.15 * s, z + 0.1 * s, r3 * 6, 1.15 * s, mixHex(AUT[pi % AUT.length], '#B07050', 0.25), 0.02, 1);
      addCircle(x, z, 0.28 * s);
    };
    tree(-4.4, -1.7, 0.85, 0); tree(27.0, -1.7, 0.9, 3);
    // газон у площади (запад), газон у часов (восток), парк
    [[-20.5, 17.5], [-15.5, 21], [-21, 26], [-12.5, 28], [-19, 33.5], [-14, 38], [-21, 42], [-11, 45.5], [-17, 47.5], [-9, 19], [-8.5, 36.5]].forEach(([x, z], i) => tree(x, z, 0.95 + (i % 3) * 0.12, i, i % 4 === 3));
    [[39, 26], [42.5, 33], [38.5, 40.5], [42.5, 46.5], [40, 18.5]].forEach(([x, z], i) => tree(x, z, 1.0 + (i % 2) * 0.15, i + 2, i % 3 === 1));
    for (let i = 0; i < 18; i++) { const z = 17.5 + i * 2.25, x = (i % 2 ? -46.8 : -39.3) + (R() - 0.5) * 1.2; if (Math.abs(z - 36) < 4.2) continue; tree(x, z, 0.95 + R() * 0.35, i + 1, i % 5 === 2); }
    [[-47.5, 33], [-38.6, 39.5]].forEach(([x, z], i) => tree(x, z, 1.15, i + 4));
    // набережная и за Солнечным: редкие деревья
    [-26, -6, 14, 34].forEach((x, i) => tree(x, 63.4, 0.9, i + 1, i % 2 === 1));
    [[58.2, 20], [58.2, 37], [58.2, 52.5]].forEach(([x, z], i) => tree(x, z, 0.9, i + 3, true));

    // фонари-«леденцы» с бантами (облегчённые: одна склейка на фонарь)
    const lampG = (() => {
      const g = tmp(), lampD = toon('#584862'), lampM = toon('#6A5670'), bulb = new T.MeshBasicMaterial({ color: 0xFFDFA0 }), bowM = toon('#E58FA6');
      const lo = keep(new T.CylinderGeometry(1, 1, 1, 7)), lo6 = keep(new T.SphereGeometry(1, 7, 5)), hemi6 = keep(new T.SphereGeometry(1, 8, 3, 0, PI * 2, 0, PI / 2));
      put(g, lo, lampD, [0, 0.06, 0], [0.2, 0.12, 0.2]); put(g, lo, lampD, [0, 0.21, 0], [0.1, 0.2, 0.1]);
      put(g, keep(new T.CylinderGeometry(0.038, 0.062, 1, 6, 1, true)), lampM, [0, 1.55, 0], [1, 2.5, 1]); put(g, lo6, lampM, [0, 2.8, 0], [0.07, 0.07, 0.07]);
      put(g, keep(new T.TubeGeometry(new T.CubicBezierCurve3(new T.Vector3(0, 2.72, 0), new T.Vector3(0, 3.22, 0), new T.Vector3(0, 3.27, -0.36), new T.Vector3(0, 3.06, -0.5)), 6, 0.03, 4)), lampM);
      put(g, hemi6, lampD, [0, 2.93, -0.5], [0.14, 0.09, 0.14]); put(g, lo6, bulb, [0, 2.79, -0.5], [0.15, 0.17, 0.15]);
      const loop = keep(new T.TorusGeometry(0.32, 0.14, 4, 8));
      [-1, 1].forEach(k => { put(g, loop, bowM, [k * 0.36 * 0.17, 2.42, 0.07], [0.17, 0.72 * 0.17, 0.55 * 0.17], [0, 0, k * 0.35]); put(g, GEO.box, bowM, [k * 0.2 * 0.17, 2.42 - 0.55 * 0.17, 0.07], [0.16 * 0.17, 0.75 * 0.17, 0.05 * 0.17], [0, 0, k * 0.32]); });
      return H.geoOf(g);
    })();
    kind('lamp', lampG, H.VC.front, { r: 3.4 });
    const halos = [];
    const lamp = (x, z, ry = 0) => { inst('lamp', x, z, ry); const a = ry; halos.push(x - Math.sin(a) * 0.5, 2.79, z - Math.cos(a) * 0.5); addCircle(x, z, 0.16); };
    [-3.2, 9, 14.2, 19.6, 26.5, -9.1, -12.9, 32.0, 35.75].forEach(x => lamp(x, 3.25));   // у x 3,1 вместо фонаря — указатель выезда (виден со старта)
    for (let x = -21; x > -62; x -= 9) lamp(x, 3.25); for (let x = 44; x < 84; x += 9) lamp(x, 3.25);
    for (let x = -20; x <= 44; x += 12) lamp(x, I.z0 + 0.7, PI);
    for (let x = -20; x <= 44; x += 12) lamp(x, I.z1 - 0.7, 0);
    for (let z = 22; z <= 46; z += 12) { lamp(I.x0 + 0.7, z, -PI / 2); lamp(I.x1 - 0.7, z, PI / 2); lamp(O.x0 - 0.7, z, PI / 2); lamp(O.x1 + 0.7, z, -PI / 2); }
    for (let x = -40; x <= 66; x += 10) lamp(x, O.z1 + 0.75, PI);
    lamp(-41.3, 33.4, 0.6); lamp(-45.2, 38.7, -2.4);
    { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(new Float32Array(halos), 3));
      const pm = keep(new T.PointsMaterial({ map: H.haloTex, color: 0xFFC890, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      const p = new T.Points(g, pm); p.renderOrder = 4; scene.add(p); C.halos = p; }

    // скамейки: мятные и пудровые
    const benchG = col => { const g = tmp(), m = toon(col), iron = toon('#584862');
      const curve = keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0, 0.18), new T.Vector3(0, 0.42, 0.18), new T.Vector3(0, 0.46, -0.04), new T.Vector3(0, 0.62, -0.2), new T.Vector3(0, 0.92, -0.27)]), 8, 0.028, 4));
      for (let i = 0; i < 3; i++) box(g, m, 0, 0.47, -0.13 + i * 0.13, 1.42, 0.06, 0.12);
      for (let i = 0; i < 2; i++) box(g, m, 0, 0.66 + i * 0.16, -0.24, 1.42, 0.11, 0.045, [-0.12, 0, 0]);
      [-0.62, 0.62].forEach(dx => put(g, curve, iron, [dx, 0, 0])); return H.geoOf(g); };
    kind('benchA', benchG('#9FC2A8'), H.VC.front); kind('benchB', benchG('#E7A6B6'), H.VC.front);
    const SEATS = [];
    const bench = (x, z, ry, b = 0) => { inst(b ? 'benchB' : 'benchA', x, z, ry); const ax = Math.cos(ry) * 0.42, az = -Math.sin(ry) * 0.42; addCircleSkip(x + ax, z + az, 0.36); addCircleSkip(x - ax, z - az, 0.36); benchTop(x, z, ry); SEATS.push({ x, z, ry }); };
    bench(4.4, -1.15, 0, 0); bench(20.4, -1.15, 0, 1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + PI / 8, x = F.x + Math.cos(a) * 7.2, z = F.z + Math.sin(a) * 7.2; bench(x, z, Math.atan2(F.x - x, F.z - z), i % 2); }
    [-20, 0, 22, 42].forEach((x, i) => bench(x + 4, 64.6, 0, i % 2));
    bench(-43.2, 33.0, 0, 1); bench(-40.4, 37.4, -1.9, 0); bench(-46.0, 37.4, 1.9, 0);
    // кусты
    const BUSH = ['#C4574A', '#C9A04F', '#9DA765', '#D07A48', '#9DB08E'];
    for (let z = 16; z < 50; z += 1.3) { inst('bush', I.x0 + 3.6, z, z, 0.55, BUSH[Math.round(z * 3) % 5], 0.3, 0.42); }
    for (let z = 16; z < 50; z += 1.3) { inst('bush', 36.6, z, z, 0.55, BUSH[Math.round(z * 3 + 1) % 5], 0.3, 0.42); }
    // живая изгородь старого парка: низ — по новому краю газона (там теперь Набережный проезд), запад — вдоль аллеи
    for (let x = -48; x < -38; x += 1.1) inst('bush', x, 48.3, x, 0.6, BUSH[Math.abs(Math.round(x * 3)) % 5], 0.34, 0.5);
    for (let z = 15; z < 48; z += 1.2) if (Math.abs(z - 31.5) > 1.6) inst('bush', -48.15, z, z, 0.75, BUSH[Math.abs(Math.round(z * 3)) % 5], 0.45, 0.68);

    mark('trees+lamps old'); await step('план нового города');
    /* =====================================================================
       ВОЛНА 3: ПЛАН НОВЫХ РАЙОНОВ — сразу (двери, столкновения, лавочки, деревья, фонари); сами дома и мелочь — лениво
       ===================================================================== */
    const XP = WORLD.EXPAND_PLAN, RN = rng(2026), PKL = L.park;   // HL, PL, PR, BR, AX — из планировки выше
    const HOK = !!WORLD.HEIGHT_OK;
    instNew = true;
    // двери новых домов (после всех прежних: номера f<N> у старых не меняются) и их столкновения
    XP.NEW_HOUSES.forEach(hh => { fillerDoors.push(hh.door); const f = hh.foot; if (!(hh.z === -2 && hh.ry === 0)) addBox(f.x0, f.x1, f.z0, f.z1, hh.h + 1); });
    // новые деревья, фонари, лавочки, кусты: свои случайные числа (прежние ряды не сдвигаются)
    const treeN = (x, z, s = 1, pi = 0, pop = false, y = 0) => {
      inst('trunk', x, z, RN() * 6, s * (pop ? 0.85 : 1), null, y);
      inst(pop ? 'poplar' : 'crown', x, z, RN() * 6, s, AUT[pi % AUT.length], y);
      if (!pop && y < 0.1) inst('carpet', x + 0.15 * s, z + 0.1 * s, RN() * 6, 1.15 * s, mixHex(AUT[pi % AUT.length], '#B07050', 0.25), 0.02 + y, 1);
      addCircle(x, z, 0.28 * s);
    };
    const halosN = [];
    const lampN = (x, z, ry = 0, y = 0) => { inst('lamp', x, z, ry, 1, null, y); halosN.push(x - Math.sin(ry) * 0.5, 2.79 + y, z - Math.cos(ry) * 0.5); addCircle(x, z, 0.16); };
    const benchN = (x, z, ry, b = 0, y = 0) => { inst(b ? 'benchB' : 'benchA', x, z, ry, 1, null, y); const ax = Math.cos(ry) * 0.42, az = -Math.sin(ry) * 0.42; addCircleSkip(x + ax, z + az, 0.36); addCircleSkip(x - ax, z - az, 0.36); benchTop(x, z, ry, y); SEATS.push({ x, z, ry, y }); };
    const bushN = (x, z, s, col, collide = false, y = 0) => { inst('bush', x, z, RN() * 6, s, col, (y || 0) + s * 0.55, s * 0.82); if (collide) addCircle(x, z, s * 0.75); };
    const FLOW = ['#EFA3B5', '#F3CF73', '#C7A8DD', '#F7C9D4', '#E99A6E', '#FFFDF9', '#D9774F'];
    const pick = (arr, i) => arr[((Math.round(i) % arr.length) + arr.length) % arr.length];   // индекс цвета и для отрицательных x
    const FIELD = ['#E8789A', '#F2B33D', '#B58BD8', '#E9875A', '#D9566A', '#F0A0BC', '#F6C34E'];   // цветочное поле на склоне: ярче, без белого

    /* --- Октябрьская: фонари на продолжении (северный тротуар), вдоль парка (южный) --- */
    [-66, -75, -96, -105, -114].forEach(x => lampN(x, 3.25));
    [91, 97].forEach(x => lampN(x, 3.25));
    for (let x = -106; x <= -40; x += 12) if (Math.abs(x - AX) > 3) lampN(x, PKL.z0 + 0.7, PI);
    for (let x = -106; x <= -40; x += 12) if (Math.abs(x - AX) > 3) lampN(x, PKL.z1 - 0.7, 0);
    for (let z = 20; z <= 46; z += 12) lampN(PKL.x0 + 0.7, z, -PI / 2);
    for (let z = 18; z <= 50; z += 12) lampN(-119.1, z + 2.6, PI / 2);

    /* --- парк «Каштановый»: пруд, мостик, дорожки, лавочки, деревья, собачья площадка, тайная скамейка --- */
    // берег пруда — круги-препятствия (кроме концов мостика)
    { const n = 120; for (let i = 0; i < n; i++) { const a = i / n * PI * 2, c = [AX, 32.4]; let r = 0.5; while (r < 20 && L.pondSD(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r) < 0.1) r += 0.05; const x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r; if (Math.abs(x - BR.x) < 1.6 && (z < BR.z0 + 1.4 || z > BR.z1 - 1.4)) continue; addCircle(x, z, 0.5); } }
    // перила мостика
    [-1, 1].forEach(sd => addBox(BR.x + sd * (BR.w / 2) - 0.1, BR.x + sd * (BR.w / 2) + 0.1, BR.z0 + 0.2, BR.z1 - 0.2, 1.1));
    // лавочки вокруг пруда — лицом к воде
    const pondBench = [];
    { const gradP = (x, z) => [(L.pondSD(x + 0.1, z) - L.pondSD(x - 0.1, z)) / 0.2, (L.pondSD(x, z + 0.1) - L.pondSD(x, z - 0.1)) / 0.2];
      [[-101.5, 27.2], [-98.5, 41.8], [-91.4, 23.3], [-79, 23.5], [-71.6, 37.6], [-80.2, 40.6]].forEach(([x0, z0], i) => {
        let x = x0, z = z0; for (let k = 0; k < 30; k++) { const d = L.pondSD(x, z) - 5.45, g = gradP(x, z), gl = Math.hypot(g[0], g[1]) || 1; x -= g[0] / gl * d * 0.8; z -= g[1] / gl * d * 0.8; }
        const g = gradP(x, z); benchN(x, z, Math.atan2(-g[0], -g[1]), i % 2); pondBench.push([x, z]);
      }); }
    // фонари у петли и у входов
    { const lp = L.paths.park_loop; for (let i = 0; i < lp.length - 1; i += 6) { const [x, z] = lp[i]; const gx = x - AX, gz = z - 32.4, gl = Math.hypot(gx, gz) || 1; const px = x + gx / gl * 1.65, pz = z + gz / gl * 1.65; if (pondBench.some(([bx, bz]) => Math.hypot(bx - px, bz - pz) < 2.2) || Math.abs(px - AX) < 2.2) continue; lampN(px, pz, Math.atan2(-gx, -gz)); } }
    lampN(AX + 1.9, 17.6, -PI / 2); lampN(AX - 1.9, 46.4, PI / 2);
    // живая изгородь по краю газона (проходы — у дорожек)
    const LW = PKL.lawn, BUSHP = ['#C4574A', '#C9A04F', '#9DA765', '#D07A48', '#9DB08E'];
    for (let x = LW.x0 + 0.6; x < LW.x1 - 0.4; x += 1.15) { if (Math.abs(x - AX) > 1.9) bushN(x, LW.z0 + 0.5, 0.42, BUSHP[Math.round(-x * 3) % 5]); if (Math.abs(x - AX) > 1.9 && x > LW.x0 + 3.6) bushN(x, LW.z1 - 0.5, 0.42, BUSHP[Math.round(-x * 3 + 2) % 5]); }
    for (let z = LW.z0 + 1.5; z < LW.z1 - 0.5; z += 1.15) { if (Math.abs(z - 33) > 1.9 && (z < 43.6 || z > 49)) bushN(LW.x0 + 0.5, z, 0.42, BUSHP[Math.round(z * 3) % 5]); if (Math.abs(z - 31.5) > 1.9) bushN(LW.x1 - 0.45, z, 0.42, BUSHP[Math.round(z * 3 + 1) % 5]); }
    // тайная скамейка: полукруг высоких кустов, вход — щёлочка с запада, от тротуара Парковой
    { const S0 = PKL.secret; for (let a = -PI * 0.78; a <= PI * 0.78 + 1e-6; a += PI / 8) { const x = S0.x + Math.cos(a) * 2.2, z = S0.z + Math.sin(a) * 2.2; bushN(x, z, 0.75, pick(['#C4574A', '#9DA765', '#D07A48', '#C9A04F'], a * 4 + 9), true); }
      benchN(S0.x - 0.15, S0.z, S0.ry, 1); SEATS[SEATS.length - 1].secret = true; }
    // деревья: случайно по газону, не на дорожках, не у пруда, не у лавочек и не в собачьей площадке
    { const D = PKL.dog, placed = [];
      const ok = (x, z, s) => { if (x < LW.x0 + 1.6 || x > LW.x1 - 1.4 || z < LW.z0 + 1.6 || z > LW.z1 - 1.5) return false; if (L.parkPathSD(x, z) < 1.3) return false; if (L.pondSD(x, z) < 1.8) return false;
        if (x > D.x0 - 1.4 && x < D.x1 + 1.4 && z > D.z0 - 1.4 && z < D.z1 + 1.4) return false; if (Math.hypot(x - PKL.secret.x, z - PKL.secret.z) < 3.6) return false;
        if (SEATS.some(sd => Math.hypot(sd.x - x, sd.z - z) < 2.2)) return false; if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.3 * s)) return false; return true; };
      for (let tries = 0; tries < 900 && placed.length < 46; tries++) { const x = LW.x0 + RN() * (LW.x1 - LW.x0), z = LW.z0 + RN() * (LW.z1 - LW.z0), s = 0.95 + RN() * 0.4; if (!ok(x, z, s)) continue; placed.push([x, z]); treeN(x, z, s, placed.length, placed.length % 6 === 4); } }
    // кусты-кочки и камыш у воды — мелочь (в куски), лилии — на воду
    // собачья площадка: забор с калиткой, снаряды
    { const D = PKL.dog, G0 = D.gate[0], G1 = D.gate[1];
      addBox(D.x0 - 0.1, D.x1 + 0.1, D.z0 - 0.1, D.z0 + 0.1, 0.9); addBox(D.x0 - 0.1, D.x0 + 0.1, D.z0, D.z1, 0.9); addBox(D.x1 - 0.1, D.x1 + 0.1, D.z0, D.z1, 0.9);
      addBox(D.x0 - 0.1, G0, D.z1 - 0.1, D.z1 + 0.1, 0.9); addBox(G1, D.x1 + 0.1, D.z1 - 0.1, D.z1 + 0.1, 0.9);
      [[-63, 20.2, 0.75], [-57, 20.2, 0.75], [-60.2, 24.4, 1.2], [-55.4, 18.4, 1.0], [-64.4, 26.4, 0.3]].forEach(([x, z, r]) => addCircle(x, z, r));
      benchN(-64.6, 17.15, 0, 0); treeN(-54.4, 26.4, 0.9, 3); }
    // арка входа и дорожный указатель на собачью площадку
    [-1, 1].forEach(sd => addCircle(AX + sd * 1.7, 14.4, 0.25));

    /* --- холм: стенка, лестница, терраса (столкновения) --- */
    { const gx0 = HL.sx - HL.sw / 2 - 0.12, gx1 = HL.sx + HL.sw / 2 + 0.12;
      addBox(HL.x0, gx0, HL.wallZ - 0.8, HL.wallZ + 0.05, 1.2); addBox(gx1, HL.x1, HL.wallZ - 0.8, HL.wallZ + 0.05, 1.2);
      addBox(gx0 - 0.35, gx0, PL.z1 - 0.2, HL.wallZ, 1.2); addBox(gx1, gx1 + 0.35, PL.z1 - 0.2, HL.wallZ, 1.2);
      // перила террасы (спереди — с проёмом для лестницы), бока, задняя стенка
      addBox(PL.x0, gx0, PL.z1 - 0.3, PL.z1 + 0.05, 7.2); addBox(gx1, PL.x1, PL.z1 - 0.3, PL.z1 + 0.05, 7.2);
      addBox(PL.x0 - 0.3, PL.x0, PL.z0, PL.z1, 7.2); addBox(PL.x1, PL.x1 + 0.3, PL.z0, PL.z1, 7.2); addBox(PL.x0, PL.x1, PL.z0 - 0.3, PL.z0, 7.2);
      addCircle(-90, -37.4, 2.75); addCircle(L.spots.telescope.x, L.spots.telescope.z, 0.35);
      if (!HOK) addBox(gx0, gx1, HL.wallZ - 0.9, HL.wallZ + 0.3, 1.2);   // лестница «сохнет»: пока героиня не умеет подниматься
      // камера: над склоном, а не в нём (не мешают ходить: noWalk false)
      [[HL.x0, gx0 - 0.4, PL.z1 + 0.5, HL.wallZ - 0.9, 5.4], [gx1 + 0.4, HL.x1, PL.z1 + 0.5, HL.wallZ - 0.9, 5.0], [HL.x0, HL.x1, HL.z0, PL.z0 - 0.6, 11], [HL.x0, PL.x0 - 0.4, PL.z0 - 0.6, PL.z1 + 0.5, 6.2]]
        .forEach(([x0, x1, z0, z1, h]) => colliders.boxes.push({ x0, x1, z0, z1, h, cam: true, noWalk: false }));
      // лавочки, фонари на террасе; цветы и деревья на склоне
      benchN(-95.2, -31.4, 0, 1, HL.top); benchN(-76.4, -31.4, 0, 0, HL.top);
      lampN(-97.8, -28.6, 0, HL.top); lampN(-73.2, -28.6, 0, HL.top); lampN(HL.sx - 1.42, -10.6, -PI / 2, 2.1); lampN(HL.sx + 1.42, -19.6, PI / 2, 4.2);
      for (let row = 0; row < 4; row++) { const z = -5.4 - row * 3.6; for (let x = HL.x0 + 2; x < HL.x1 - 1; x += 1.3) { if (Math.abs(x - HL.sx) < 3.2) continue; const jx = x + (RN() - 0.5) * 0.5, jz = z + (RN() - 0.5) * 0.8, y = L.hillH(jx, jz); if (y < 0.5) continue; const fs = 0.26 + RN() * 0.08, leafy = RN() < 0.3; inst('bush', jx, jz, RN() * 6, fs, leafy ? ['#9DA765', '#8FAE62', '#B5B86A'][Math.floor(RN() * 3)] : pick(FIELD, row * 3 + x), y - 0.05 + fs * 0.32, fs * 0.6); } }
      const hillTrees = [];
      for (let tries = 0; tries < 900 && hillTrees.length < 70; tries++) {
        const x = HL.x0 + 1 + RN() * (HL.x1 - HL.x0 - 4), z = -24 - RN() * 58; if (z > PL.z0 - 3 && x > PL.x0 - 3 && x < PL.x1 + 3) continue; if (Math.abs(x - HL.sx) < 4 && z > PL.z1 - 2) continue;
        if (hillTrees.some(([a, b]) => Math.hypot(a - x, b - z) < 4.2)) continue; hillTrees.push([x, z]); treeN(x, z, 1.0 + RN() * 0.4, hillTrees.length + 2, hillTrees.length % 4 === 1, L.hillH(x, z) - 0.08);
      }
      [[-118, -9], [-111, -14], [-104, -10.5], [-78, -11], [-74.5, -16]].forEach(([x, z], i) => treeN(x, z, 0.95, i + 1, i % 2 === 1, L.hillH(x, z) - 0.08));
      // луга за «Дворами» и у Горной: рощицы (туда не дойти — без столкновений)
      for (let i = 0, n = 0; i < 400 && n < 46; i++) { const x = -55 + RN() * 150, z = -60 - RN() * 24; if (x > 96 && x < 116) continue; n++; inst('trunk', x, z, RN() * 6, 1.1); inst(n % 5 === 2 ? 'poplar' : 'crown', x, z, RN() * 6, 1.05 + RN() * 0.4, AUT[n % AUT.length]); }
    }

    /* --- набережная: перила (столкновения), пирс, фонари, лавочки, деревья --- */
    { const px0 = PR.x - PR.w / 2, px1 = PR.x + PR.w / 2, LEN = PR.len, zE = PR.z0 + LEN;
      addBox(-124, px0 - 0.05, 66.2, 67.0, 1.1); addBox(px1 + 0.05, 124, 66.2, 67.0, 1.1);
      addBox(px0 - 0.2, px0, 66.5, zE, 0.9); addBox(px1, px1 + 0.2, 66.5, zE, 0.9);
      addBox(px0 - 1.1, px0, zE - 0.1, zE + 0.05, 0.9); addBox(px1, px1 + 1.1, zE - 0.1, zE + 0.05, 0.9);
      addBox(px0 - 1.1, px0 - 0.9, zE, zE + 2.45, 0.9); addBox(px1 + 0.9, px1 + 1.1, zE, zE + 2.45, 0.9); addBox(px0 - 1.1, px1 + 1.1, zE + 2.3, zE + 2.5, 0.9);
      inst('benchB', PR.x, zE + 1.9, 0, 1, null, 0.03); SEATS.push({ x: PR.x, z: zE + 1.9, ry: 0, y: 0.03 }); addCircleSkip(PR.x - 0.42, zE + 1.9, 0.36); addCircleSkip(PR.x + 0.42, zE + 1.9, 0.36); benchTop(PR.x, zE + 1.9, 0, 0.03);
      lampN(px0 - 0.65, zE + 0.3, PI / 2, 0.03); lampN(px1 + 0.65, zE + 0.3, -PI / 2, 0.03);
      for (let x = -120; x <= -50; x += 10) if (Math.abs(x - PR.x) > 3) lampN(x, 60.9, PI);
      for (let x = 72; x <= 120; x += 12) lampN(x, 59.1, PI);
      [-114, -100, -76, -66, -52, 62, 74, 86, 104, 116].forEach((x, i) => benchN(x, 64.6, 0, i % 2));
      [-118, -106, -94, -70, -58, -46, 56, 68, 80, 100, 110, 119].forEach((x, i) => treeN(x, 63.4, 0.9, i + 2, i % 3 === 1));
      addBox(90.8, 93.2, 64.1, 66.2, 2.6);   // велопрокат
      // волна 5: ряд велосипедов проката (bike.js makeRack: два велосипеда поперёк ряда) — твёрдые, сквозь них не пройти
      { const rk = L.spots.rental && L.spots.rental.rack; if (rk) addBox(rk.x - 0.68, rk.x + 0.68, rk.z - 0.92, rk.z + 0.92, 1.05); }
    }

    /* --- восток: рынок, гаражи, кварталы --- */
    { const M0 = L.market;
      XP.STALLS.forEach(st => { if (st.ry) addBox(st.x - 1.9, st.x + 1.9, M0.z1 + 0.08, M0.z1 + 2.2, 3); else addBox(st.x - 1.9, st.x + 1.9, M0.z0 - 2.2, M0.z0 - 0.08, 3); });
      [79.4, 85.8, 92.2].forEach(x => { addBox(x - 1.25, x + 1.25, M0.z0 - 2.1, M0.z0 - 0.5, 1.2); addBox(x - 1.25, x + 1.25, M0.z1 + 0.5, M0.z1 + 2.1, 1.2); });
      addBox(73.6, 100.4, 18.6, M0.z0 - 2.0, 4);                 // двор за домами
      addBox(73.4, 100.8, M0.z1 + 2.0, L.garages.zf - 5, 2);     // двор за прилавками
      addBox(73.9, 100.7, L.garages.zf - 5, L.garages.zf, 3.4);  // гаражи
      addCircle(99.6, 34.0, 0.9);                                 // тележка с тыквами
      // волна 5: ящики у края рынка — ступеньками 0,45 → 0,9 (запрыгнуть, перепрыгнуть с ящика на ящик); город обходит их одной коробкой
      colliders.boxes.push({ x0: 98.05, x1: 100.65, z0: 38.6, z1: 39.5, h: 0.9, move: 'skip' });
      CRATES.forEach(c => addTop(c[0], c[1], 0.78, 0.78, c[3], -0.05, 0.45 * c[2], 'crate'));
      [-1, 1].forEach(sd => addCircle(73.1, 35.9 + sd * 2.35, 0.25));   // арка рынка
      // двор: деревья; Загородная: деревья, фонари; задний проезд и гаражный — фонари
      [[77, 22.5], [83.5, 26.8], [90, 22], [95.6, 27.2], [87, 29.2]].forEach(([x, z], i) => treeN(x, z, 1.05, i + 1, i === 2));
      [[77.6, 43.8], [88.2, 44.2], [97.8, 43.6]].forEach(([x, z], i) => treeN(x, z, 0.9, i + 4, i === 1));
      [[114.6, 33], [114.6, 57], [115.4, 9.5], [113.2, -6]].forEach(([x, z], i) => treeN(x, z, 1.0, i, i % 2 === 0));
      lampN(73.15, 22, -PI / 2); lampN(73.15, 46, -PI / 2); lampN(101.1, 22, PI / 2); lampN(101.1, 46, PI / 2); lampN(111.0, 30, -PI / 2); lampN(111.0, 52, -PI / 2);
      lampN(80, 59.15, PI); lampN(94, 59.15, PI);
    }
    /* --- Загородная: тополиная аллея к выезду, ворота, разворот, шлагбаум --- */
    { const xc = L.gorn.xc, Z = L.gateZ;
      for (let z = -8; z > -80; z -= 7) { if (Math.abs(z - Z) < 3.5) continue; treeN(100.3, z + (RN() - 0.5), 0.95 + RN() * 0.25, Math.round(-z), true); treeN(112.0, z + 3 + (RN() - 0.5), 0.95 + RN() * 0.25, Math.round(-z) + 2, true); }
      [-14, -30, -40].forEach(z => lampN(101.0, z, PI / 2));
      [-1, 1].forEach(sd => addCircle(xc + sd * 5.2, Z, 0.85));
      addCircle(xc, L.turn.z, L.turn.ri + 0.1);
      addBox(L.gorn.x0 - 2.2, L.gorn.x1 + 2.2, -83.9, -83.2, 1.2);
      addCircle(112.6, -45.6, 0.15);
      // поля по сторонам: деревья
      [[95.5, -60], [93.4, -70.5], [116.8, -62], [118.4, -74], [96.2, -78.8], [117.2, -34], [96, -26]].forEach(([x, z], i) => treeN(x, z, 1.15, i + 3, i % 3 === 2));
    }
    /* --- концы города: козлы «дальше — туман» на тротуарах у границы --- */
    const ENDS = [[-120.3, 0.6, PI / 2], [-120.3, 63.2, PI / 2], [120.3, 63.2, -PI / 2], [120.3, 0.9, -PI / 2]];
    ENDS.forEach(([x, z]) => addCircle(x, z, 0.3));
    instNew = false; mark('plan');
    await step('набережная и дальний план');
    /* ---------- набережная: парапет, перила ---------- */
    for (let x = -60; x < 90; x += 6) {
      const zg = zone(x + 3, 66.4);
      rbox(zg, M.wall, x + 3, -0.3, 66.65, 6.02, 0.7, 0.3, 0.04).castShadow = false;
      rbox(zg, K.m('#FFF6EE'), x + 3, 0.95, 66.3, 6.02, 0.08, 0.12, 0.03);
      for (let k = 0; k < 4; k++) { const px = x + k * 1.5; cyl(zg, K.m('#6A5670'), px, 0.48, 66.3, 0.035, 0.96); sphS(zg, K.m('#6A5670'), px, 0.99, 66.3, 0.05); }
      [0.35, 0.65].forEach(y => cyl(zg, K.m('#6A5670'), x + 3, y, 66.3, 0.012, 6, [0, 0, PI / 2]));
    }
    // концы карты: козлы и табличка «дальше — туман»
    const endCv = (() => { const [ecv, ec] = cnv(256, 112); ec.fillStyle = '#FFF6EE'; rrect(ec, 0, 0, 256, 112, 18); ec.fill(); text(ec, 'дальше —', 128, 38, 34, '#8A6A55', { f: 'Caveat', w: 700 }); text(ec, 'туман', 128, 80, 42, '#C2405B', { f: 'Caveat', w: 700 }); return ecv; })();
    const endSign = (x, z, ry, zf = zone) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; zf(x, z).add(g);
      const wd = K.m('#B98C6A'), st = K.m('#FFFDF9'), rd = K.m('#E58FA6');
      [-1.2, 1.2].forEach(dx => { [-1, 1].forEach(s => box(g, wd, dx + s * 0.25, 0.4, 0, 0.06, 0.85, 0.06, [0, 0, s * 0.3])); });
      for (let i = 0; i < 6; i++) rbox(g, i % 2 ? st : rd, -1.0 + i * 0.4, 0.78, 0, 0.4, 0.16, 0.05, 0.02);
      cyl(g, wd, 0, 0.6, -0.1, 0.04, 1.2);
      rbox(g, wd, 0, 1.25, -0.06, 0.8, 0.36, 0.06, 0.03); put(g, GEO.plane, K.t(endCv, { alpha: true }), [0, 1.25, -0.02], [0.74, 0.32, 1]);
    };
    // волна 3: город вырос — козлы переехали к новым концам тротуаров
    ENDS.forEach(([x, z, ry]) => endSign(x, z, ry));

    /* ---------- дальний план: квартал за Октябрьской, холмы, облака ---------- */
    const far = new T.Group(); far.name = 'far'; scene.add(far);
    { const FC = ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC'].map(c => K.m(c)), FR = [K.m('#C98F86'), K.m('#9AA5C5'), K.m('#B8907A')];
      const fw = K.m('#8E89A6'), fl = K.m('#FFE3A8', { glow: '#FFD08A', gi: 0.5 }), RW = rng(4242), w1 = keep(new T.PlaneGeometry(0.36, 0.5));
      for (let row = 0; row < 2; row++) for (let i = 0; i < 26; i++) {
        const x = -68 + i * 6.2 + R() * 1.5, z = -9.5 - row * 8 - R() * 2, w = 3.6 + R() * 1.6, h = 5 + R() * 4 + row * 2;
        box(far, FC[(i + row) % 6], x, h / 2, z, w, h, 3.5);
        if ((i + row) % 2 === 0) put(far, prism, FR[i % 3], [x, h, z], [w + 0.4, 1.8, 3.8]);
        else put(far, GEO.halfCyl, FR[i % 3], [x, h, z], [0.9, 3.8, w / 2 + 0.12], [0, PI / 2, PI / 2]);
        for (let r = 1; r < Math.floor(h / 1.4); r++) for (let c = 0; c < 2; c++) put(far, w1, RW() < 0.3 ? fl : fw, [x - w / 4 + c * w / 2, 0.9 + r * 1.3, z + 1.76]).castShadow = false;
      }
      const HLM = [K.m('#B4BFA6'), K.m('#ABB79F'), K.m('#BAC4AB'), K.m('#B0BBA4')];   // волна 3: за домами теперь луга — холмы травяные (сиреневые — дальние хребты на горизонте)
      const hillPts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; hillPts.push(new T.Vector2(Math.max(0.001, Math.pow(Math.cos(t * PI / 2), 0.75)), t)); }
      const hillGeo = keep(new T.LatheGeometry(hillPts, 16));
      [[-40, -62, 30, 10], [0, -72, 34, 13], [40, -66, 30, 11], [60, -82, 26, 11], [-70, -78, 30, 11]].forEach(([x, z, r, h], i) => put(far, hillGeo, HLM[i % 4], [x, -1, z], [r, h, r * 0.7]));
      [[-30, 135, 34, 9], [20, 150, 40, 12], [70, 140, 36, 10], [-80, 150, 36, 11], [110, 155, 34, 10]].forEach(([x, z, r, h], i) => put(far, hillGeo, HLM[(i + 2) % 4], [x, -1, z], [r, h, r * 0.6]));
    }
    H.mergeChunk(far, { cast: false, receive: false });
    // облака-«пуфы» с плоским низом: все одной сеткой
    { const clouds = new T.Group(); clouds.name = 'clouds'; scene.add(clouds);
      const cloudM = H.addRim(toon('#FFEFEA', { emissive: new T.Color('#F6C9C9'), emissiveIntensity: 0.26 }), 1.3);
      const puff = keep(new T.SphereGeometry(1, 10, 6)); { const p = puff.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.3); puff.computeVertexNormals(); }
      [[-34, 15, -62, 1.5], [2, 17, -74, 1.9], [36, 14, -58, 1.3], [70, 16, -70, 1.7], [-60, 15, -50, 1.4], [20, 18, 120, 2.0], [-30, 16, 110, 1.6], [80, 17, 115, 1.8]].forEach(([x, y, z, s]) => {
        [[0, 0.35, 0, 1.5], [1.4, 0.15, 0.2, 1.1], [-1.4, 0.1, 0.1, 1.05], [0.55, 0.85, -0.2, 0.95], [-0.6, 0.7, 0, 0.85], [0, 0, 0, 0]].forEach(([a, b, c, r], k) => {
          if (k === 5) put(clouds, puff, cloudM, [x, y, z], [2.6 * s, 0.55 * s, 1.3 * s]); else put(clouds, puff, cloudM, [x + a * s, y + b * s, z + c * s], [r * s, r * s * 0.8, r * s * 0.9]);
        });
      });
      clouds.traverse(m => { if (m.isMesh) m.castShadow = false; });
      H.bake(clouds, null, { cast: false, receive: false }); C.clouds = clouds; }


    /* --- вывески новых районов: канвасы рисуются сейчас, чтобы попасть в общий атлас (сами дома — лениво) --- */
    const P = WORLD.makeProps(H);
    const XS = XP.STALLS, XG = XP.GARAGES;
    XS.forEach(s => { s.cv = P.sign(s.sign, s.sub, s.col); });
    const capCv = (l1, l2, c1 = '#8A6A55', c2 = '#C2405B') => { const [cv, c] = cnv(256, 112); c.fillStyle = '#FFF6EE'; rrect(c, 0, 0, 256, 112, 18); c.fill(); text(c, l1, 128, 38, 34, c1, { f: 'Caveat', w: 700 }); text(c, l2, 128, 80, 42, c2, { f: 'Caveat', w: 700 }); return cv; };
    const CV = {
      park: P.sign('Парк', '«Каштановый»', '#5E8A4E'), market: P.sign('Рынок', 'яблоки · тыквы · открытки', '#C4602E'), garage: P.sign('Круглые фары', 'гараж', '#DD7E63'),
      rental: P.sign('Велопрокат', 'катайся до заката', '#DE9A34'), dog: P.sign('Собачья', 'площадка', '#E58AA2'), gate: P.sign(L.edge.label || 'За город ↑', null, '#C2405B'),
      gateBack: P.sign('В город', 'площадь Солнца', '#C2405B'),   // волна 4: обратная сторона арки (дорога назад, из гор) — к городу
      farRoad: capCv('дальше —', 'луга'), paint: capCv('свежая', 'краска', '#8A6A55', '#5E8A6E'),
      bike: (() => { const [cv, c] = cnv(128, 128); c.strokeStyle = '#FFFDF9'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
        [[36, 82], [92, 82]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 20, 0, 7); c.stroke(); });
        c.beginPath(); c.moveTo(36, 82); c.lineTo(58, 50); c.lineTo(80, 50); c.lineTo(92, 82); c.moveTo(58, 50); c.lineTo(66, 82); c.lineTo(80, 50); c.moveTo(52, 42); c.lineTo(64, 42); c.moveTo(80, 50); c.lineTo(84, 38); c.stroke(); return cv; })(),
      nums: [2, 3, 4, 5, 6].map(n => { const [cv, c] = cnv(128, 96); c.fillStyle = '#FFF6EE'; rrect(c, 4, 4, 120, 88, 20); c.fill(); text(c, String(n), 64, 50, 56, '#6E6272', { f: 'Comfortaa', w: 700 }); return cv; }),
    };
    // указатели нового города (их столкновения — тут же)
    const POSTS = [
      [HL.sx - 2.5, 0.5, 0, P.board('Холм', HOK ? 'смотровая ↑' : 'смотровая — скоро')], [59.4, 33.0, -PI / 2, P.board('Рынок', 'через двор →')], [PR.x + 3.2, 61.7, PI, P.board('Пирс', 'и лодочка')],
      [100.9, 1.4, 0, P.board('Загородная', 'за город ↑')], [112.6, -45.6, 0, P.board(L.edge.label || 'За город ↑')], [-112.6, 13.2, PI, P.board('Парк', '«Каштановый»')], [96.4, 59.2, 0, P.board('Велопрокат', 'на набережной')],
    ];
    if (HOK) POSTS.push([HL.sx - 2.6, PL.z1 - 1.6, 0, P.board('Смотровая', 'город на ладони'), HL.top]);
    POSTS.forEach(([x, z]) => { if (!(x === 112.6 && z === -45.6)) addCircle(x, z, 0.15); });
    // указатель у старта (желание автора): синий дорожный щит у бордюра Октябрьской — героиня видит его с первого кадра,
    // за ним на горизонте — дальний вид (js/world/far_view.js). Схема маршрута «прямо, потом налево» — к выезду по Загородной;
    // название — из модуля села (CONFIG.VILLAGE_NAMED), без него — «За город»
    const roadCv = (() => {
      let name = 'За город';
      try {
        const k = window.VILLAGE && VILLAGE.regions && VILLAGE.regions.kubachi;
        const named = (window.CONFIG || {}).VILLAGE_NAMED !== false && !(WORLD.Regions && WORLD.Regions.settings && WORLD.Regions.settings().named === false);
        if (named && k && typeof k.title === 'function') name = k.title(true) || name;
      } catch (e) { /* без модуля села */ }
      const [cv, c] = cnv(512, 288);
      c.fillStyle = '#FFFFFF'; rrect(c, 0, 0, 512, 288, 26); c.fill();
      c.fillStyle = '#1F5AA6'; rrect(c, 9, 9, 494, 270, 20); c.fill();
      // название — слева (со старта надпись левее ряда фонарей у бордюра), схема — справа
      text(c, name, 200, 120, 66, '#FFFFFF', { f: 'Comfortaa', w: 700, max: 300 });
      text(c, 'по Загородной', 200, 198, 34, '#DCE8F7', { f: 'Comfortaa', w: 700, max: 300 });
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 26; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(452, 262); c.lineTo(452, 112); c.lineTo(408, 112); c.stroke();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(370, 112); c.lineTo(414, 76); c.lineTo(414, 148); c.closePath(); c.fill();   // остриё — налево
      return cv;
    })();
    { const x = 3.4, z = 2.75, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -PI / 2; zone(x, z).add(g);   // лицом на запад — к старту
      const pole = K.m('#8E8C9A'), back = K.m('#B9B7C4');
      cyl(g, pole, 0.72, 1.6, -0.06, 0.05, 3.2);                       // одна стойка — у самого бордюра (локальная x — мировая z)
      box(g, back, 0, 2.55, -0.03, 2.12, 1.22, 0.04);                  // щит над тротуаром: низ на 1,94 м — проходу не мешает
      put(g, GEO.plane, K.t(roadCv), [0, 2.55, 0], [2.12, 1.19, 1]);
      addCircle(x, z + 0.72, 0.08); }
    [].concat(XS.map(s => s.cv), Object.values(CV).filter(v => v && v.getContext), CV.nums, POSTS.map(p => p[3]), [roadCv]).forEach(cv => H.atlasAdd(cv));

    mark('signs prep'); await step('склейка кусков');
    /* ---------- атлас вывесок и склейка кусков ---------- */
    zones.forEach(g => g.traverse(o => { if (o.userData) delete o.userData.dyn; }));
    zones.forEach(g => H.atlasCollect(g)); H.atlasCollect(casters);
    H.atlasBuild(2048); mark('atlas');
    let zi = 0;
    for (const g of zones.values()) {
      H.mergeChunk(g, { cast: false, detail: 0.32 });
      if (++zi % 3 === 0) await step(null);
    }
    // тень отбрасывают только фонтан и часы; фасады — нет: солнце светит им в лицо, их тень всё равно позади домов
    H.mergeChunk(casters, { cast: true }); mark('merge');

    // инстансы по кускам: своя граница (сфера) у каждого, иначе three.js отсечёт их по исходной геометрии
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _y = new T.Vector3(0, 1, 0), _c = new T.Color();
    const instMeshes = [];
    const makeIM = (k, name, list, par) => {
      const geo = new T.BufferGeometry();
      Object.keys(k.geo.attributes).forEach(a => geo.setAttribute(a, k.geo.attributes[a]));
      geo.setIndex(k.geo.index);
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, smax = 0, ys = 0;
      list.forEach(it => { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); smax = Math.max(smax, it.s); ys += it.y; });
      const ym = ys / list.length;
      geo.boundingSphere = new T.Sphere(new T.Vector3((x0 + x1) / 2, 1.5 + ym, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0) / 2 + k.r * smax + 1);
      geo.boundingBox = new T.Box3(new T.Vector3(x0 - 3, ym, z0 - 3), new T.Vector3(x1 + 3, ym + 4, z1 + 3));
      keep(geo);
      const im = new T.InstancedMesh(geo, k.mat, list.length);
      list.forEach((it, i) => {
        _q.setFromAxisAngle(_y, it.ry); _s.set(it.s, it.sy, it.s); _p.set(it.x, it.y, it.z);
        im.setMatrixAt(i, _m.compose(_p, _q, _s));
        if (k.colored) im.setColorAt(i, _c.set(it.col || '#FFFFFF'));
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = true;   // в r149 у InstancedMesh отсечение выключено по умолчанию — включаем: граница своя
      im.castShadow = k.cast; im.receiveShadow = name !== 'crown' && name !== 'poplar';
      im.userData.kind = name; par.add(im);
      return im;
    };
    Object.keys(KINDS).forEach(name => {
      const k = KINDS[name];
      k.items.forEach(list => instMeshes.push(makeIM(k, name, list, scene)));
    });

    /* =====================================================================
       ДАЛЬНОСТЬ (scene.onBeforeRender): куски вдали → «коробки», дальше тумана → скрыть; кроны вдали — облегчённые
       ===================================================================== */
    const LOD = { zones: [], inst: [], extra: [], dirty: true, cam: new T.Vector3(1e9, 0, 0), n: 0, fogN: -1, fogF: -1, err: 0, lodD: 0, hideD: 0 };
    const bbOf = obj => { const b = new T.Box3(), t = new T.Box3(); obj.updateMatrixWorld(true); obj.traverse(m => { if ((m.isMesh || m.isPoints) && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); b.union(t); } }); return b; };
    const dBB = (p, b) => Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
    const IK = { crown: 0.8, poplar: 0.8, carpet: 0.55, benchA: 0.75, benchB: 0.75, bush: 0.8, lamp: 1.6, trunk: 1.3 };   // фонари — почти до тумана: их ореолы видны издалека
    const lodZone = (g, o = {}) => { const e = Object.assign({ g, bb: bbOf(g), imp: null, ld: 1, det: null }, o); LOD.zones.push(e); LOD.dirty = true; return e; };
    const lodInst = im => { const e = { im, bb: im.geometry.boundingBox, kind: im.userData.kind, k: IK[im.userData.kind] || 1.3, far: null, cast: im.castShadow }; LOD.inst.push(e); LOD.dirty = true; return e; };
    let sunL = null; const shC = new T.Vector3();
    mark('instances'); zones.forEach(g => lodZone(g));
    instMeshes.forEach(lodInst);
    function lodTick(cam) {
      const fog = scene.fog; if (!fog) return;
      const p = cam.position; LOD.n++;
      if (!LOD.dirty && LOD.n % 24 && Math.abs(p.x - LOD.cam.x) + Math.abs(p.z - LOD.cam.z) < 0.9 && fog.near === LOD.fogN && fog.far === LOD.fogF) return;
      LOD.dirty = false; LOD.cam.copy(p); LOD.fogN = fog.near; LOD.fogF = fog.far;
      const over = fog.near > 200;
      const lodD = LOD.lodD = over ? 1e9 : Math.min(fog.near + 0.42 * (fog.far - fog.near), 58), hideD = LOD.hideD = over ? 1e9 : fog.far + 6;
      let detD = 17; try { const W0 = window.World; if (W0 && W0.QUAL && W0.quality && W0.QUAL[W0.quality()]) detD = W0.QUAL[W0.quality()].detail; } catch (e) { /* стенд без World */ }
      if (over) detD = 1e9;
      for (const z of LOD.zones) {
        const d = dBB(p, z.bb), near = d < lodD * z.ld;
        z.g.visible = d < hideD && (near || !z.imp);
        if (z.imp) z.imp.visible = d < hideD && !near;
        if (z.det && z.g.visible) for (const m of z.det) m.visible = dBB(p, m.geometry.boundingBox) < detD;
      }
      // тень — только у клеток рядом с героиней (камера тени ±13 м вокруг неё): иначе большие клетки рисуются в тень зря
      if (!sunL) scene.traverse(o => { if (!sunL && o.isDirectionalLight) sunL = o; });
      if (sunL) shC.copy(sunL.target.position); else shC.copy(p);
      for (const e of LOD.inst) {
        const d = dBB(p, e.bb);
        if (e.cast) e.im.castShadow = dBB(shC, e.bb) < 17;
        if (e.far) { const nr = d < lodD * e.k; e.im.visible = nr; e.far.visible = !nr && d < hideD; }
        else e.im.visible = d < Math.min(hideD, lodD * e.k);
      }
      for (const f of LOD.extra) f(p, lodD, hideD);
    }
    const ANIM = [];
    // режим «смотровая»: камера над террасой холма → туман плавно отступает (L.viewFog), дальние куски — «коробками»;
    // ушла — туман возвращается к тому, что поставил main.js (если main.js сам сменил туман — его значения главнее)
    const VM = { k: 0, base: null, set: null, t: 0, off: false };   // off = true — main.js управляет туманом смотровой сам
    ANIM.push((t, cam) => {
      const fog = scene.fog, F = L.viewFog; if (!fog || !F) return;
      const dt = Math.min(0.1, Math.max(0, t - (VM.t || t))); VM.t = t;
      const p = cam.position, inView = !VM.off && fog.near < 200 && p.y > HL.top + 2.4 && p.x > PL.x0 - 6 && p.x < PL.x1 + 6 && p.z > PL.z0 - 8 && p.z < PL.z1 + 6;
      if (VM.set && (Math.abs(fog.near - VM.set[0]) > 1e-3 || Math.abs(fog.far - VM.set[1]) > 1e-3)) { VM.base = null; VM.set = null; VM.k = 0; if (!inView) return; }
      if (!inView && !VM.set) return;
      if (!VM.base) VM.base = [fog.near, fog.far, cam.far];
      VM.k += ((inView ? 1 : 0) - VM.k) * Math.min(1, dt * 1.6);
      const B = VM.base, far = Math.min(F.far, B[1] * 2 + 10), near = Math.min(F.near, B[0] + 8), cf = Math.min(F.camFar, B[2] * 2 + 10);
      if (!inView && VM.k < 0.01) { fog.near = B[0]; fog.far = B[1]; cam.far = B[2]; cam.updateProjectionMatrix(); VM.base = null; VM.set = null; VM.k = 0; return; }
      fog.near = B[0] + (near - B[0]) * VM.k; fog.far = B[1] + (far - B[1]) * VM.k; cam.far = B[2] + (cf - B[2]) * VM.k; cam.updateProjectionMatrix();
      VM.set = [fog.near, fog.far];
    });
    const prevOBR = scene.onBeforeRender;
    scene.onBeforeRender = function (r, sc, cam) {
      try { lodTick(cam); const t = performance.now() / 1000; for (const f of ANIM) f(t, cam); }
      catch (e) { if (!LOD.err++) console.warn('map lod', e); }
      return prevOBR.apply(this, arguments);
    };

    /* ---------- «ходить можно?» для L.walkable: сетка препятствий 8 м ---------- */
    { const CELL = 8, cells = new Map(), key = (i, j) => i * 4096 + j;
      const addTo = (x0, x1, z0, z1, it) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); } };
      colliders.circles.forEach(c => addTo(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, c));
      colliders.boxes.forEach(b => { if (b.noWalk !== false) addTo(b.x0, b.x1, b.z0, b.z1, b); });
      L._hit = (x, z) => { const l = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!l) return false; for (const it of l) { if (it.r !== undefined) { if (Math.hypot(x - it.x, z - it.z) < it.r) return true; } else if (x > it.x0 && x < it.x1 && z > it.z0 && z < it.z1) return true; } return false; };
    }

    /* =====================================================================
       ЛЕНИВОЕ ОДЕВАНИЕ НОВЫХ РАЙОНОВ: шагами по ~24 мс после world:ready (или через 3 с без него)
       ===================================================================== */
    const DRESS = { started: false, done: false, ms: 0, steps: 0, t0: 0, err: null, zones: 0, phase: '' };
    let dressResolve = null;
    const dressP = new Promise(r => { dressResolve = r; });
    WORLD.mapDressed = dressP;
    let tSl = 0;
    const slice = async () => { if (performance.now() - tSl > 24) { DRESS.steps++; await new Promise(r => setTimeout(r, 6)); tSl = performance.now(); } };
    const stoneM = [K.m('#E2D3CA'), K.m('#D2C0B6'), K.m('#EADFD6')], creamM = K.m('#FFF6EE'), ironM2 = K.m('#6A5670');

    async function dressHouses() {
      DRESS.phase = 'разметка';
      LATER.forEach(f => f(zoneN)); await slice();
      DRESS.phase = 'дома';
      for (const hh of XP.NEW_HOUSES) { filler(hh.x, hh.z, hh.ry, hh.w, hh.h, hh.d, hh.seed, Object.assign({ zf: zoneN, planned: true }, hh.o)); await slice(); }
      POSTS.forEach(([x, z, ry, cv, y]) => signPost(x, z, ry, '', '', zoneN, cv, y || 0));
    }

    async function dressEast() {
      DRESS.phase = 'рынок и гаражи';
      const M0 = L.market;
      for (const st of XS) { const g = P.stall(K, { w: 3.0, cv: st.cv, aw: st.aw, goods: st.goods, col: st.col }); g.position.set(st.x, 0, st.z); g.rotation.y = st.ry; zoneN(st.x, st.z).add(g); await slice(); }
      // кадки между прилавками и гирлянды через рынок
      const wood = K.m('#B98C6A'), soil = K.m('#8A6A55'), bulbs = [K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 }), K.m('#F7C9D4', { glow: '#F7A0B4', gi: 0.7 }), K.m('#BFE0F2', { glow: '#9FD0EE', gi: 0.6 })];
      [79.4, 85.8, 92.2].forEach((x, i) => {
        const zg = zoneN(x, 35.9);
        [M0.z0 - 1.3, M0.z1 + 1.3].forEach((z, k) => { rbox(zg, wood, x, 0.3, z, 2.4, 0.6, 1.4, 0.06); box(zg, soil, x, 0.6, z, 2.2, 0.04, 1.2); for (let j = 0; j < 5; j++) sphS(zg, K.m(['#C4574A', '#9DA765', '#D07A48', '#C9A04F', '#9DB08E'][(i + j + k) % 5]), x - 0.85 + j * 0.42, 0.78, z + (j % 2 ? 0.2 : -0.2), 0.26, 0.22, 0.26); cyl(zg, ironM2, x + 1.0, 1.75, z + (k ? -0.45 : 0.45), 0.035, 2.5); });
        const za = M0.z0 - 0.85, zb = M0.z1 + 0.85, n = 10;
        for (let j = 0; j < n; j++) { const t0 = j / n, t1 = (j + 1) / n, y0 = 2.95 - Math.sin(t0 * PI) * 0.45, y1 = 2.95 - Math.sin(t1 * PI) * 0.45, z0 = za + (zb - za) * t0, z1 = zb === za ? z0 : za + (zb - za) * t1;
          box(zg, ironM2, x + 1.0, (y0 + y1) / 2, (z0 + z1) / 2, 0.02, 0.02, Math.hypot(z1 - z0, y1 - y0) + 0.02, [-Math.atan2(y1 - y0, z1 - z0), 0, 0]);
          sphS(zg, bulbs[(i + j) % 3], x + 1.0, y0 - 0.09, z0, 0.065, 0.085, 0.065); }
      });
      { const g = P.parkArch(K, { span: 4.7, cv: CV.market }); g.position.set(73.1, 0, 35.9); g.rotation.y = PI / 2; zoneN(73.1, 35.9).add(g); }
      // волна 5: деревянные ящики ступеньками (на них можно запрыгнуть — коробки Move в colliders.tops)
      { const woodD = K.m('#9A7052'), woodL = K.m('#D2A77E');
        CRATES.forEach(([x, z, n, ry]) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; zoneN(x, z).add(g);
          for (let k = 0; k < n; k++) { const y = k * 0.45;
            rbox(g, wood, 0, y + 0.225, 0, 0.76, 0.43, 0.76, 0.03);
            [0.11, 0.33].forEach(h => [-1, 1].forEach(sd => { box(g, woodL, 0, y + h, sd * 0.383, 0.7, 0.07, 0.012); box(g, woodL, sd * 0.383, y + h, 0, 0.012, 0.07, 0.7); }));
            [-1, 1].forEach(a => [-1, 1].forEach(b => box(g, woodD, a * 0.36, y + 0.225, b * 0.36, 0.05, 0.44, 0.05))); } }); }
      // тележка с тыквами у выхода к Горной
      { const zg = zoneN(99.6, 34), x = 99.6, z = 34.0, wd = K.m('#C99A6E');
        rbox(zg, wd, x, 0.62, z, 1.6, 0.35, 0.9, 0.05); [-1, 1].forEach(sd => put(zg, H.ringG(0.32, 0.07), K.m('#8A6A55'), [x - 0.3, 0.34, z + sd * 0.5], null, [0, 0, 0]));
        cyl(zg, wd, x + 1.05, 0.7, z, 0.03, 0.9, [0, 0, 1.2]);
        [[-0.45, 0.2, 0.2], [0.05, 0.1, 0.24], [0.5, -0.2, 0.2], [-0.2, -0.25, 0.16], [0.3, 0.25, 0.15]].forEach(([dx, dz, r], i) => put(zg, GEO.sphLo, K.m(['#EE9A55', '#F3D2B0', '#EBB3BA'][i % 3]), [x + dx, 0.82 + r * 0.6, z + dz], [r, r * 0.75, r])); }
      // качели во дворе
      { const zg = zoneN(86, 24.5), x = 86, z = 24.5, wd = K.m('#C99A6E');
        [-1, 1].forEach(sd => { box(zg, wd, x + sd * 1.0, 1.15, z - 0.45, 0.1, 2.4, 0.1, [0.2, 0, 0]); box(zg, wd, x + sd * 1.0, 1.15, z + 0.45, 0.1, 2.4, 0.1, [-0.2, 0, 0]); });
        box(zg, wd, x, 2.28, z, 2.2, 0.1, 0.1); [-0.35, 0.35].forEach(dx => cyl(zg, ironM2, x + dx, 1.6, z, 0.012, 1.3)); rbox(zg, K.m('#F08FA8'), x, 0.95, z, 0.85, 0.06, 0.32, 0.03); }
      await slice();
      // гаражи
      XG.forEach((gd, i) => { const g = P.garage(K, { w: gd.w, d: 5, h: 2.5, door: gd.door, open: gd.open, cv: gd.home ? CV.garage : null, numCv: gd.home ? null : CV.nums[i - 1], col: '#DD7E63' }); g.position.set(gd.x, 0, L.garages.zf); zoneN(gd.x, L.garages.zf).add(g); });
      // кусты во дворе за прилавками
      { const zg = zoneN(86, 43.5); for (let x = 74.5; x < 100; x += 1.4) put(zg, lowBlob, K.m(['#C4574A', '#9DA765', '#D07A48', '#9DB08E'][Math.round(x) % 4]), [x, 0.4, 42.2 + Math.sin(x) * 0.6], [0.55, 0.5, 0.55]); }
      // велопрокат на набережной
      { const g = P.rental(K, CV.rental); g.position.set(92, 0, 64.9); g.rotation.y = PI; zoneN(92, 64.9).add(g); }
      await slice();
    }

    async function dressEmbank() {
      DRESS.phase = 'набережная';
      const px0 = PR.x - PR.w / 2, px1 = PR.x + PR.w / 2;
      const section = (xa, xb, rail = true) => {
        const zg = zoneN((xa + xb) / 2, 66.4), len = xb - xa, cx = (xa + xb) / 2;
        rbox(zg, M.wall, cx, -0.3, 66.65, len + 0.02, 0.7, 0.3, 0.04).castShadow = false;
        if (!rail) return;
        rbox(zg, creamM, cx, 0.95, 66.3, len + 0.02, 0.08, 0.12, 0.03);
        const n = Math.max(1, Math.round(len / 1.5)); for (let k = 0; k < n; k++) { const px = xa + k * len / n; cyl(zg, ironM2, px, 0.48, 66.3, 0.035, 0.96); sphS(zg, ironM2, px, 0.99, 66.3, 0.05); }
        [0.35, 0.65].forEach(y => cyl(zg, ironM2, cx, y, 66.3, 0.012, len, [0, 0, PI / 2]));
      };
      const run = (xa, xb) => { const n = Math.max(1, Math.round((xb - xa) / 6)); for (let k = 0; k < n; k++) section(xa + (xb - xa) * k / n, xa + (xb - xa) * (k + 1) / n); };
      run(-126, px0 - 0.05); section(px0 - 0.05, px1 + 0.05, false); run(px1 + 0.05, -60); run(90, 126);
      await slice();
      // велодорожка по всему променаду: полоса, белые кромки, значки велосипеда
      const laneM = K.m('#CBD5EE'), edgeM = K.m('#FFFDF9'), pic = K.t(CV.bike, { alpha: true });
      for (let x = -120.5; x < 120.5; x += 12) { const xb = Math.min(120.5, x + 12), cx = (x + xb) / 2, zg = zoneN(cx, 61.7);
        box(zg, laneM, cx, 0.006, 61.7, xb - x, 0.012, 0.92).castShadow = false; [61.22, 62.18].forEach(z => box(zg, edgeM, cx, 0.009, z, xb - x, 0.012, 0.05).castShadow = false);
        if (Math.round(x) % 24 === 0) { const m = put(zg, GEO.plane, pic, [cx, 0.016, 61.7], [0.72, 0.72, 1], [-PI / 2, 0, 0]); m.castShadow = false; } }
      // пирс и лодочка
      { const g = P.pier(K, { len: PR.len, w: PR.w }); g.position.set(PR.x, 0, PR.z0); zoneN(PR.x, PR.z0 + 4).add(g); }
      const boatG = H.geoOf(P.boat(K)), boat = new T.Mesh(boatG, H.VC.front); boat.position.set(PR.x + 2.75, -0.48, PR.z0 + 5.6); boat.rotation.y = 0.12; boat.castShadow = false; newRoot.add(boat);
      ANIM.push(t => { if (!boat.visible || !newRoot.visible) return; boat.position.y = -0.48 + Math.sin(t * 1.3) * 0.035; boat.rotation.z = Math.sin(t * 1.1 + 0.5) * 0.035; boat.rotation.x = Math.sin(t * 0.9) * 0.02; });
      LOD.extra.push((p, lodD) => { boat.visible = Math.hypot(p.x - boat.position.x, p.z - boat.position.z) < lodD; });
      await slice();
    }

    async function dressPark() {
      DRESS.phase = 'парк';
      const LW = PKL.lawn, D = PKL.dog, S0 = PKL.secret;
      const lawnSD = (x, z) => Math.max(sdRR(x, z, { x0: LW.x0, x1: LW.x1, z0: LW.z0, z1: LW.z1, r: 1.2 }), -(L.pondSD(x, z) - 0.7), -L.parkPathSD(x, z), -XP.sdBox(x, z, D.x0 - 0.25, D.x1 + 0.25, D.z0 - 0.25, D.z1 + 0.25));
      const LG = H.sdfGrid(lawnSD, LW.x0 - 1, LW.x1 + 1, LW.z0 - 1, LW.z1 + 1, 0.5, 4);
      ground(H.sdfMesh(null, 0, 0, 0, 0, 0.5, { grid: LG }), M.grass, 0.012, newRoot);
      await slice();
      const lcM = K.m('#BFB2AE');
      H.sdfContours(null, 0, 0, 0, 0, 0.5, { grid: LG, tol: 0.05 }).forEach(l => curbRun(l.pts, false, 0.09, 0.18, lcM, zoneN, (x, z) => L.pondSD(x, z) < 1.3));
      await slice();
      // пруд: вода, бортик из камешков, камни, камыш, кувшинки
      const PG = H.sdfGrid(L.pondSD, -102, -70, 22, 43, 0.4);
      ground(H.sdfMesh(null, 0, 0, 0, 0, 0.4, { grid: PG }), M.water, L.pond.y, newRoot);
      const rim = H.sdfContours((x, z) => L.pondSD(x, z) - 0.06, -102, -70, 22, 43, 0.4, { tol: 0.06 }).sort((a, b) => b.pts.length - a.pts.length)[0];
      if (rim && rim.pts.length > 8) {
        const pts = rim.pts.map(([x, z]) => new T.Vector3(x, 0.07, z)), curve = new T.CatmullRomCurve3(pts, true);
        const zg = zoneN(-86, 32.4); put(zg, keep(new T.TubeGeometry(curve, Math.min(400, pts.length * 3), 0.17, 5, true)), stoneM[1]).castShadow = false;
        for (let i = 0; i < 16; i++) { const p = curve.getPoint(i / 16 + 0.013), s = 0.24 + (i % 3) * 0.08; if (Math.abs(p.x - BR.x) < 2.2) continue; put(zg, blobGeo, stoneM[i % 3], [p.x, 0.1, p.z], [s * 1.3, s * 0.7, s]).castShadow = false; }
        const reedM = K.m('#8FAE62'), tipM = K.m('#8A5A44');
        [0.31, 0.36, 0.58, 0.83, 0.9].forEach((u, j) => { const p = curve.getPoint(u); if (Math.abs(p.x - BR.x) < 3) return; for (let k = 0; k < 6; k++) { const x = p.x + Math.cos(k * 2.1 + j) * 0.35, z = p.z + Math.sin(k * 2.1 + j) * 0.3, h = 0.7 + (k % 3) * 0.25; cyl(zg, reedM, x, h / 2, z, 0.015, h, [Math.sin(k) * 0.12, 0, Math.cos(k) * 0.12]); if (k % 2 === 0) put(zg, GEO.sphLo, tipM, [x, h - 0.05, z], [0.035, 0.11, 0.035]); } });
      }
      { const zg = zoneN(-86, 32.4), padM = K.m('#9DB86E'), flM = K.m('#F7C9D4');
        [[-97, 31], [-95.2, 36.8], [-90.4, 29.6], [-81.4, 34.4], [-76.2, 29.4], [-79.8, 28.6], [-99.2, 34.6]].forEach(([x, z], i) => { if (L.pondSD(x, z) > -0.6) return; put(zg, GEO.cylLo, padM, [x, 0.045, z], [0.36, 0.015, 0.36]).castShadow = false; if (i % 3 === 0) sphS(zg, flM, x + 0.1, 0.09, z, 0.08, 0.05, 0.08); }); }
      await slice();
      // мостик и домик для уток
      { const g = P.bridge(K, { len: BR.z1 - BR.z0, w: BR.w }); g.position.set(BR.x, 0, (BR.z0 + BR.z1) / 2); zoneN(BR.x, 32.4).add(g); }
      { const g = P.duckHouse(K); g.position.set(-96.4, L.pond.y, 35.4); g.rotation.y = -0.5; zoneN(-96, 35).add(g); }
      // утки: одна пачка на всех, плавают кругами
      { const dg = H.geoOf(P.duck(K)), N = 5, im = new T.InstancedMesh(dg, H.VC.front, N); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; newRoot.add(im);
        const DK = [[-93.5, 33.5, 2.6, 0.22, 0], [-93.5, 33.5, 2.6, 0.22, 0.5], [-78.5, 31.5, 2.2, -0.27, 1], [-78.5, 31.5, 2.2, -0.27, 1.45], [-91, 30, 1.2, 0.35, 3]];
        const m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(1, 1, 1), v = new T.Vector3(), up = new T.Vector3(0, 1, 0);
        ANIM.push(t => { if (!im.visible || !newRoot.visible) return; DK.forEach(([cx, cz, r, w, ph], i) => { const a = t * w + ph; v.set(cx + Math.cos(a) * r, L.pond.y - 0.02 + Math.sin(t * 2.2 + i) * 0.012, cz + Math.sin(a) * r); q.setFromAxisAngle(up, Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w))); im.setMatrixAt(i, m4.compose(v, q, s1)); }); im.instanceMatrix.needsUpdate = true; });
        LOD.extra.push((p, lodD) => { im.visible = Math.hypot(p.x + 86, p.z - 32) < lodD + 8; }); }
      // собачья площадка: песок, забор с калиткой, снаряды, табличка
      { const sand = toon('#EBD6B4'); H.moodPatch(sand, 'sand');
        ground(flatShape(rrPts(D.x0, D.x1, D.z0, D.z1, 0.8, 3)), sand, 0.014, newRoot);
        const zg = zoneN((D.x0 + D.x1) / 2, (D.z0 + D.z1) / 2), pick = keep(new T.BoxGeometry(0.07, 0.62, 0.05)), fm = K.m('#FFF6EE'), fp = K.m('#E58AA2');
        const fence = (xa, za, xb, zb) => { const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 0.2)), ry = -Math.atan2(zb - za, xb - xa);
          for (let i = 0; i <= n; i++) put(zg, pick, i % 6 === 0 ? fp : fm, [xa + (xb - xa) * i / n, 0.31, za + (zb - za) * i / n], null, [0, ry, 0]);
          [0.22, 0.5].forEach(y => box(zg, fm, (xa + xb) / 2, y, (za + zb) / 2, len, 0.05, 0.03, [0, ry, 0])); };
        fence(D.x0, D.z0, D.x1, D.z0); fence(D.x0, D.z0, D.x0, D.z1); fence(D.x1, D.z0, D.x1, D.z1); fence(D.x0, D.z1, D.gate[0], D.z1); fence(D.gate[1], D.z1, D.x1, D.z1);
        D.gate.forEach(x => { cyl(zg, fp, x, 0.45, D.z1, 0.06, 0.9); sphS(zg, fp, x, 0.95, D.z1, 0.09); });
        [[P.hurdle, -63, 20.2, 0], [P.hurdle, -57, 20.2, 0], [P.tunnel, -60.2, 24.4, PI / 2], [P.ramp, -55.4, 18.4, 0], [P.bowl, -64.4, 26.4, 0]].forEach(([f, x, z, ry]) => { const g = f(K); g.position.set(x, 0.014, z); g.rotation.y = ry; zg.add(g); });
        const sg = new T.Group(); sg.position.set(D.gate[0] - 0.9, 0, D.z1 + 0.35); zg.add(sg); cyl(sg, ironM2, 0, 0.7, 0, 0.04, 1.4); rbox(sg, K.m('#E58AA2'), 0, 1.38, 0, 1.25, 0.4, 0.05, 0.03); put(sg, GEO.plane, K.t(CV.dog, { alpha: true }), [0, 1.38, 0.03], [1.18, 0.35, 1]).castShadow = false;
        // косточка на табличке не нужна: лапка на заборе — розовые штакетины
      }
      // арка входа в парк
      { const g = P.parkArch(K, { span: 3.4, cv: CV.park }); g.position.set(AX, 0, 14.4); zoneN(AX, 14.4).add(g); }
      // тайная скамейка: фонарик и тыковки
      { const zg = zoneN(S0.x, S0.z), lg = P.lantern(K); lg.position.set(S0.x - 0.55, 0, S0.z + 1.1); zg.add(lg);
        put(zg, GEO.sphLo, K.m('#EE9A55'), [S0.x + 0.15, 0.16, S0.z - 0.95], [0.2, 0.15, 0.2]); put(zg, GEO.sphLo, K.m('#F3D2B0'), [S0.x + 0.45, 0.11, S0.z - 0.85], [0.13, 0.1, 0.13]);
        for (let a = -2.2; a <= 2.2; a += 0.55) sphS(zg, K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 }), S0.x + Math.cos(a) * 2.2, 1.25 + Math.sin(a * 3) * 0.08, S0.z + Math.sin(a) * 2.2, 0.045); }
      await slice();
    }

    let meadowPatched = false;
    const patchMeadow = () => { if (meadowPatched) return; meadowPatched = true; H.moodPatch(M.meadow, 'meadow'); M.meadow.needsUpdate = true; };
    async function dressHill() {
      DRESS.phase = 'холм'; patchMeadow();
      // рельеф: две сетки (ближняя и дальняя части)
      const terrain = (x0, x1, z0, z1, st) => {
        const nx = Math.round((x1 - x0) / st), nz = Math.round((z1 - z0) / st), g = new T.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
        g.rotateX(-PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
        const p = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, L.hillH(x, z)); uv.setXY(i, x, -z); }
        g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return keep(g);
      };
      ground(terrain(-128, -58, -44, -3.0, 1.6), M.meadow, 0, newRoot);
      ground(terrain(-128, -58, -100, -44, 2.4), M.meadow, 0, newRoot);
      await slice();
      // подпорная стенка у тротуара
      const gx0 = HL.sx - HL.sw / 2 - 0.12, gx1 = HL.sx + HL.sw / 2 + 0.12;
      const wall = (xa, xb) => { for (let x = xa; x < xb - 0.05; x += 2.5) { const x2 = Math.min(xb, x + 2.5), zg = zoneN((x + x2) / 2, HL.wallZ); rbox(zg, stoneM[Math.round(x) % 2], (x + x2) / 2, 0.58, HL.wallZ - 0.4, x2 - x + 0.02, 1.16, 0.8, 0.06).castShadow = false; rbox(zg, stoneM[2], (x + x2) / 2, 1.2, HL.wallZ - 0.4, x2 - x + 0.08, 0.1, 0.92, 0.04).castShadow = false;
        if (Math.round(x * 2) % 10 === 0) { rbox(zg, K.m('#C96F4A'), (x + x2) / 2, 1.36, HL.wallZ - 0.45, 1.2, 0.22, 0.4, 0.04); [-0.4, 0, 0.4].forEach((dx, i) => sphS(zg, K.m(pick(FLOW, i + x)), (x + x2) / 2 + dx, 1.55, HL.wallZ - 0.45, 0.14, 0.11, 0.14)); } } };
      wall(HL.x0, gx0); wall(gx1, HL.x1);
      // лестница: три марша по 14 ступенек и две площадки; бока — ступенчатые парапеты
      const zgS = () => zoneN(HL.sx, -14);
      const stepAt = (u0, u1, top, ci) => { const zc = HL.wallZ - (u0 + u1) / 2, d = u1 - u0; box(zgS(), stoneM[ci % 2 ? 0 : 2], HL.sx, top / 2, zc, HL.sw, top, d + 0.01).castShadow = false;
        [-1, 1].forEach(sd => box(zoneN(HL.sx, -14), stoneM[1], HL.sx + sd * (HL.sw / 2 + 0.17), (top + 0.55) / 2, zc, 0.34, top + 0.55, d + 0.02).castShadow = false); };
      let u = 0, top = 0, ci = 0;
      for (let f = 0; f < 3; f++) { for (let i = 0; i < 14; i++) { top += 0.15; stepAt(u, u + 0.5, top, ci++); u += 0.5; } if (f < 2) { stepAt(u, u + 2, top, 1); u += 2; } }
      await slice();
      // терраса: мощение, стенки, балюстрада, ротонда, телескоп
      ground(flatShape(rrPts(PL.x0, PL.x1, PL.z0, PL.z1, 0.6, 3)), M.tile, HL.top + 0.015, newRoot);
      const zgP = (x, z) => zoneN(x, z);
      const wallSeg = (xa, za, xb, zb) => { const len = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, ry = -Math.atan2(zb - za, xb - xa); rbox(zgP(cx, cz), stoneM[1], cx, (HL.top + 4.5) / 2, cz, len + 0.3, HL.top - 4.5, 0.42, 0.06, [0, ry, 0]).castShadow = false; rbox(zgP(cx, cz), stoneM[2], cx, HL.top + 0.05, cz, len + 0.4, 0.12, 0.56, 0.04, [0, ry, 0]).castShadow = false; };
      wallSeg(PL.x0, PL.z1, gx0, PL.z1); wallSeg(gx1, PL.z1, PL.x1, PL.z1); wallSeg(PL.x0, PL.z0, PL.x0, PL.z1); wallSeg(PL.x1, PL.z0, PL.x1, PL.z1); wallSeg(PL.x0, PL.z0, PL.x1, PL.z0);
      const balu = (xa, za, xb, zb) => { const len = Math.hypot(xb - xa, zb - za), n = Math.max(2, Math.round(len / 0.55)), cx = (xa + xb) / 2, cz = (za + zb) / 2, zg = zgP(cx, cz);
        for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, z = za + (zb - za) * i / n; box(zg, creamM, x, HL.top + 0.4, z, 0.11, 0.55, 0.11); }
        rbox(zg, creamM, cx, HL.top + 0.72, cz, len + 0.1, 0.1, 0.2, 0.04, [0, -Math.atan2(zb - za, xb - xa), 0]); };
      balu(PL.x0, PL.z1 - 0.1, gx0, PL.z1 - 0.1); balu(gx1, PL.z1 - 0.1, PL.x1, PL.z1 - 0.1); balu(PL.x0 + 0.1, PL.z0, PL.x0 + 0.1, PL.z1); balu(PL.x1 - 0.1, PL.z0, PL.x1 - 0.1, PL.z1); balu(PL.x0, PL.z0 + 0.1, PL.x1, PL.z0 + 0.1);
      // ящики с цветами вдоль перил
      for (let x = PL.x0 + 2; x < PL.x1 - 1.5; x += 4.5) { if (Math.abs(x - HL.sx) < 2.6) continue; const zg = zgP(x, PL.z1); rbox(zg, K.m('#C96F4A'), x, HL.top + 0.95, PL.z1 - 0.12, 1.1, 0.2, 0.3, 0.04); [-0.35, 0, 0.35].forEach((dx, i) => sphS(zg, K.m(pick(FLOW, i + x)), x + dx, HL.top + 1.12, PL.z1 - 0.12, 0.13, 0.1, 0.13)); }
      // ротонда
      { const zg = zgP(-90, -37.4), cx = -90, cz = -37.4, y0 = HL.top, pink = K.m('#F3C6CF'), roof = K.m('#B9475F');
        put(zg, GEO.cyl, stoneM[2], [cx, y0 + 0.12, cz], [2.75, 0.24, 2.75]);
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + PI / 8, x = cx + Math.cos(a) * 2.3, z = cz + Math.sin(a) * 2.3; put(zg, GEO.cylLo, creamM, [x, y0 + 1.6, z], [0.15, 2.75, 0.15]); put(zg, GEO.box, creamM, [x, y0 + 0.3, z], [0.34, 0.14, 0.34]); put(zg, GEO.box, creamM, [x, y0 + 2.98, z], [0.34, 0.12, 0.34]); }
        put(zg, GEO.cyl, pink, [cx, y0 + 3.15, cz], [2.65, 0.32, 2.65]); put(zg, GEO.hemi, roof, [cx, y0 + 3.3, cz], [2.75, 1.5, 2.75]); sphS(zg, K.m('#FFD45E', { glow: '#FFB938', gi: 0.35 }), cx, y0 + 4.9, cz, 0.16, 0.16, 0.16);
        for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; put(zg, GEO.halfDisc, pink, [cx + Math.cos(a) * 2.7, y0 + 2.98, cz + Math.sin(a) * 2.7], [0.55, 0.03, 0.14], [PI / 2, 0, -a + PI / 2]); } }
      { const g = P.telescope(K), sp = L.spots.telescope; g.position.set(sp.x, HL.top, sp.z); zgP(sp.x, sp.z).add(g); }
      // лестница «сохнет», пока героиня не умеет подниматься: верёвка с флажками и табличка
      if (!HOK) { const zg = zoneN(HL.sx, HL.wallZ), fl = [K.m('#F08FA8'), K.m('#F3CF73'), K.m('#9DB8E0')];
        box(zg, K.m('#E9D7B9'), HL.sx, 0.82, HL.wallZ + 0.1, HL.sw + 0.3, 0.035, 0.035); for (let i = 0; i < 6; i++) put(zg, GEO.cone, fl[i % 3], [HL.sx - 1.35 + i * 0.54, 0.7, HL.wallZ + 0.1], [0.11, 0.2, 0.03], [PI, 0, 0]);
        const sg = new T.Group(); sg.position.set(HL.sx + 0.6, 0, HL.wallZ + 0.75); zg.add(sg); [-1, 1].forEach(s => box(sg, K.m('#B98C6A'), s * 0.3, 0.45, 0, 0.05, 0.92, 0.05, [s * 0.25, 0, 0]));
        rbox(sg, K.m('#B98C6A'), 0, 0.82, 0.03, 0.8, 0.36, 0.05, 0.03); put(sg, GEO.plane, K.t(CV.paint, { alpha: true }), [0, 0.82, 0.06], [0.74, 0.32, 1]).castShadow = false;
        put(zg, GEO.cylLo, K.m('#9FC2A8'), [HL.sx - 0.7, 0.14, HL.wallZ + 0.6], [0.13, 0.28, 0.13]); }
      await slice();
    }

    async function dressEdge() {
      DRESS.phase = 'Загородная';
      const xc = L.gorn.xc, Z = L.gateZ;
      { const g = P.gate(K, { span: 10.4, cv: CV.gate }); g.position.set(xc, 0, Z); zoneN(xc, Z).add(g);
        // арка двусторонняя: с севера (дорога назад, из гор) на табличке — «В город», а не надпись выезда
        const signs = g.children.filter(m => m.isMesh && m.material && m.material.map && m.material.map.image === CV.gate);
        const back = signs.find(m => Math.abs(Math.abs(m.rotation.y) - PI) < 0.01);
        if (back) { back.material = K.t(CV.gateBack, { alpha: true }); back.name = 'gateSignBack'; }
        const front = signs.find(m => m !== back); if (front) front.name = 'gateSignFront';
        L.edge.backLabel = 'В город'; L.edge.signs = { front: !!front, back: !!back, backDiff: !!(back && front && back.material !== front.material) };   // склейка зоны потом снимет имена — итог для тестов здесь
      }
      { const zg = zoneN(xc, L.turn.z), x = xc, z = L.turn.z, ri = L.turn.ri;
        put(zg, GEO.cyl, stoneM[1], [x, 0.18, z], [ri, 0.36, ri]); put(zg, GEO.cylLo, K.m('#8A6A55'), [x, 0.37, z], [ri - 0.2, 0.03, ri - 0.2]);
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; sphS(zg, K.m(FLOW[i % FLOW.length]), x + Math.cos(a) * (ri - 0.6), 0.55, z + Math.sin(a) * (ri - 0.6), 0.24, 0.2, 0.24); }
        rbox(zg, stoneM[0], x, 0.9, z, 0.7, 1.1, 0.7, 0.12); put(zg, GEO.cone, K.m('#B9475F'), [x, 1.75, z], [0.36, 0.6, 0.36]); }
      [-3.25, 0, 3.25].forEach((dx, i) => { const g = P.barrier(K, i === 1 ? CV.farRoad : null); g.position.set(xc + dx, 0, -83.55); zoneN(xc, -83.5).add(g); });
      // «Дворы» (откроются позже): дальние ряды крыш между Октябрьской и лугами
      const far2 = new T.Group(); far2.name = 'far2'; newRoot.add(far2);
      const FC = ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC', '#F2DFC8'].map(c => K.m(c)), FR = [K.m('#C98F86'), K.m('#9AA5C5'), K.m('#B8907A'), K.m('#D9A0A0')], wl = K.m('#FFE3A8', { glow: '#FFD08A', gi: 0.5 }), wd = K.m('#8E89A6');
      const prismF = keep(new T.ExtrudeGeometry(H.triShape(1, 0.5), { depth: 1, bevelEnabled: false })); prismF.translate(0, 0, -0.5);
      const groups = [new T.Group(), new T.Group(), new T.Group()]; groups.forEach(g => far2.add(g));
      const QR = rng(77);
      // три ряда пореже, между домами — дворы с деревьями (сверху не сплошная масса крыш)
      for (let row = 0; row < 3; row++) for (let x = -58 + (row % 2) * 4; x < 95; x += 8.2 + QR() * 3.2) {
        const z = -28 - row * 11 - QR() * 3, w = 3.8 + QR() * 1.8, h = 4.5 + QR() * 4 + row * 0.8, gi = x < -8 ? 0 : x < 44 ? 1 : 2, g = groups[gi];
        if (QR() < 0.5) put(g, lowBlob, K.m(AUT[Math.floor(QR() * AUT.length)]), [x + w / 2 + 2.2, 2.2 + QR() * 0.6, z - 2 - QR() * 3], [1.7, 1.8, 1.6]);
        box(g, FC[Math.floor(QR() * 7)], x, h / 2, z, w, h, 4); if (QR() < 0.6) put(g, prismF, FR[Math.floor(QR() * 4)], [x, h, z], [w + 0.4, 1.8, 4.3]); else box(g, FR[Math.floor(QR() * 4)], x, h + 0.15, z, w + 0.3, 0.3, 4.3);
        for (let r = 1; r < Math.floor(h / 1.6); r++) [-1, 1].forEach(sd => box(g, QR() < 0.3 ? wl : wd, x + sd * w / 4, 0.8 + r * 1.5, z + 2.02, 0.42, 0.55, 0.04));
        if (QR() < 0.45) put(g, lowBlob, K.m(AUT[Math.floor(QR() * AUT.length)]), [x - w / 2 - 1.6, 2.4, z + 1.5], [1.6, 1.7, 1.5]);
      }
      groups.forEach(g => { H.mergeChunk(g, { cast: false, receive: false }); lodZone(g, { ld: 99 }); });
      // луга за городом: трава вместо плитки
      { const parts = [flatShape([[-58, -170], [175, -170], [175, -60], [-58, -60]]), flatShape([[112.4, -60], [175, -60], [175, 1.5], [112.4, 1.5]]), flatShape([[-140, -170], [-58, -170], [-58, -100], [-140, -100]])];
        const pos = [], uv = [], nor = [], idx = []; let off = 0;
        parts.forEach(g => { const gi = g.index ? g.index.array : null, n = g.attributes.position.count; pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nor.push(...g.attributes.normal.array); if (gi) for (let i = 0; i < gi.length; i++) idx.push(gi[i] + off); else for (let i = 0; i < n; i++) idx.push(off + i); off += n; });
        const mg = keep(new T.BufferGeometry()); mg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); mg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); mg.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); mg.setIndex(idx); mg.computeBoundingSphere();
        ground(mg, M.meadow, 0.004, newRoot); }
      await slice();
    }

    // дальние хребты на севере: задник вокруг камеры (не дальше camera.far), рисуется первым и под всем остальным;
    // снег на вершинах — только с WORLD.RIDGE_SNOW (по плану сезона на горизонте — мягкие холмы)
    function buildMountains() {
      const ridge = (seed, R0, a0, a1, n, hBase, hAmp, sharp) => {
        const q = rng(seed), pts = [];
        const peaks = []; for (let i = 0; i < 9; i++) peaks.push([a0 + (a1 - a0) * (i + q()) / 9, hBase + hAmp * (0.45 + q() * 0.55), 0.06 + q() * 0.08]);
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; let h = hBase * 0.5 + 0.35 * Math.sin(a * 13 + seed) + 0.25 * Math.sin(a * 29 + seed * 2);
          peaks.forEach(([pa, ph, pw]) => { const d = Math.abs(a - pa) / pw; h = Math.max(h, ph * Math.max(0, 1 - Math.pow(d, sharp))); }); pts.push([a, h]); }
        return pts;
      };
      const mkStrip = (pts, R0, yb, capFrom) => {
        const pos = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const [a0, h0] = pts[i], [a1, h1] = pts[i + 1];
          const P0 = [Math.sin(a0) * R0, Math.cos(a0) * -R0], P1 = [Math.sin(a1) * R0, Math.cos(a1) * -R0];
          const b0 = capFrom === undefined ? yb : Math.max(capFrom(h0), h0 - 0.0001), b1 = capFrom === undefined ? yb : Math.max(capFrom(h1), h1 - 0.0001);
          if (capFrom !== undefined && h0 - b0 < 0.02 && h1 - b1 < 0.02) continue;
          pos.push(P0[0], b0, P0[1], P1[0], b1, P1[1], P0[0], h0, P0[1], P1[0], b1, P1[1], P1[0], h1, P1[1], P0[0], h0, P0[1]);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); return keep(g);
      };
      // одна сетка, цвета вершин: дальний хребет, снег на вершинах, ближний хребет (рисуются по порядку, без глубины)
      const far = ridge(11, 40, -1.35, 1.35, 140, 2.8, 2.6, 1.15), near = ridge(23, 38, -1.3, 1.3, 120, 1.4, 1.5, 1.05);   // мягкие, не острые
      const strips = [[mkStrip(far, 40, -3), 0], [mkStrip(near, 38, -3), 2]];
      if (WORLD.RIDGE_SNOW) strips.splice(1, 0, [mkStrip(far, 39.9, -3, h => h > 5.2 ? h - 0.55 - (h - 5.2) * 0.25 : h), 1]);
      const pos = [], which = []; strips.forEach(([gg, w]) => { const a = gg.attributes.position.array; for (let i = 0; i < a.length; i++) pos.push(a[i]); for (let i = 0; i < a.length / 3; i++) which.push(w); gg.dispose(); });
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const col = new Float32Array(pos.length); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const me = new T.Mesh(geo, keep(new T.MeshBasicMaterial({ vertexColors: true, fog: false, depthTest: false, depthWrite: false, side: T.DoubleSide })));
      me.name = 'ridges'; me.renderOrder = -60; me.frustumCulled = false; me.castShadow = false; me.receiveShadow = false; scene.add(me);
      const TINT = [[new T.Color('#9F92C8'), 0.38], [new T.Color('#FFFFFF'), 0.62], [new T.Color('#958BBE'), 0.5]], fc = new T.Color(-1, 0, 0), tc = new T.Color();
      ANIM.push((t, cam) => {
        me.position.set(cam.position.x, cam.position.y - 1.7, cam.position.z);
        const fog = scene.fog; if (!fog) return;
        if (!fc.equals(fog.color)) { fc.copy(fog.color); const cs = TINT.map(([c, k]) => tc.copy(fc).lerp(c, k).toArray()); for (let i = 0; i < which.length; i++) col.set(cs[which[i]], i * 3); geo.attributes.color.needsUpdate = true; }
        me.visible = fog.near < 200;
      });
      return me;
    }

    // «коробки» вдали: дом → коробка, крыша, два ряда окон (≈50 треугольников)
    const prismI = keep(new T.ExtrudeGeometry(H.triShape(1, 0.5), { depth: 1, bevelEnabled: false })); prismI.translate(0, 0, -0.5);
    const impMats = new Map(), impM = c => { if (!impMats.has(c)) impMats.set(c, toon(c)); return impMats.get(c); };
    function impostorOf(list, par) {
      const g = new T.Group(); g.userData.imp = true; g.name = 'impostor'; par.add(g);
      list.forEach(hh => {
        const hg = new T.Group(); hg.position.set(hh.x, 0, hh.z); hg.rotation.y = hh.ry; if (hh.bid) hg.userData.bid = hh.bid; g.add(hg);
        put(hg, GEO.box, impM(hh.wall), [0, hh.h / 2, -hh.d / 2], [hh.w, hh.h, hh.d]);
        if (hh.rt === 0) put(hg, prismI, impM(hh.roof), [0, hh.h, -hh.d / 2], [hh.w + 0.35, 1.5, hh.d + 0.3]);
        else if (hh.rt === 1) put(hg, GEO.box, impM(hh.roof), [0, hh.h + 0.35, -hh.d / 2], [hh.w + 0.25, 0.7, hh.d + 0.2]);
        else put(hg, GEO.box, impM(mixHex(hh.wall, '#FFFFFF', 0.5)), [0, hh.h + 0.15, -hh.d / 2], [hh.w + 0.3, 0.3, hh.d + 0.3]);
        const rows = Math.max(1, Math.min(3, Math.floor((hh.h - 0.6) / 1.3)));
        for (let r = 0; r < rows; r++) put(hg, GEO.box, impM(r ? '#8E89A6' : '#FFE3A8'), [0, 1.05 + r * 1.25, 0.02], [hh.w * 0.72, 0.5, 0.04]);
      });
      H.mergeChunk(g, { cast: false });
      g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
      g.visible = false;
      return g;
    }

    async function finishDress() {
      DRESS.phase = 'склейка';
      for (const g of zonesN.values()) { g.traverse(o => { if (o.userData) delete o.userData.dyn; }); H.mergeChunk(g, { cast: false, detail: 0.32 }); DRESS.zones++; await slice(); }
      // инстансы новых районов: клетками 32 м
      DRESS.phase = 'деревья';
      const newInst = [];
      Object.keys(NI).forEach(name => { const k = KINDS[name], cells = new Map(); NI[name].forEach(it => { const ck = zkey(it.x, it.z); if (!cells.has(ck)) cells.set(ck, []); cells.get(ck).push(it); }); cells.forEach(list => newInst.push(makeIM(k, name, list, newRoot))); });
      // облегчённые кроны вдали (тот же материал и цвета)
      const sm2 = v => { const m = toon('#FFFFFF'); m.color.setRGB(v, v, v); return m; };
      const crownFar = (() => { const g = new T.Group(); put(g, lowBlob, sm2(1), [0, 1.95, 0], [0.98, 1.0, 0.92]); put(g, lowBlob, sm2(1.13), [0.1, 2.5, -0.05], [0.5, 0.42, 0.48]); return H.geoOf(g); })();
      const poplarFar = (() => { const g = new T.Group(); put(g, lowBlob, sm2(1), [0, 2.3, 0], [0.66, 1.5, 0.64]); return H.geoOf(g); })();
      const farOf = im => { const fg = new T.BufferGeometry(), src = im.userData.kind === 'poplar' ? poplarFar : crownFar; Object.keys(src.attributes).forEach(a => fg.setAttribute(a, src.attributes[a])); fg.setIndex(src.index); fg.boundingSphere = im.geometry.boundingSphere; fg.boundingBox = im.geometry.boundingBox; keep(fg);
        const f = new T.InstancedMesh(fg, im.material, im.count); f.instanceMatrix.copy(im.instanceMatrix); f.instanceMatrix.needsUpdate = true; if (im.instanceColor) { f.instanceColor = new T.InstancedBufferAttribute(im.instanceColor.array.slice(), 3); }
        f.frustumCulled = true; f.castShadow = false; f.receiveShadow = false; f.userData.kind = im.userData.kind + 'Far'; f.visible = false; (im.parent || scene).add(f); return f; };
      newInst.forEach(im => { instMeshes.push(im); lodInst(im); });
      LOD.inst.forEach(e => { if (e.kind === 'crown' || e.kind === 'poplar') e.far = farOf(e.im); });
      await slice();
      // ореолы новых фонарей
      if (halosN.length) { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(new Float32Array(halosN), 3));
        const pm = C.halos ? C.halos.material : keep(new T.PointsMaterial({ map: H.haloTex, color: 0xFFC890, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
        const p = new T.Points(g, pm); p.renderOrder = 4; newRoot.add(p); C.halos2 = p; }
      // «коробки» для всех кусков: прежних и новых
      DRESS.phase = 'коробки';
      const byZone = (list, keyOf) => { const m = new Map(); list.forEach(h => { const k = keyOf(h); if (!m.has(k)) m.set(k, []); m.get(k).push(h); }); return m; };
      const oldBy = byZone(XP.OLD_HOUSES, h => zkey(h.x, h.z));
      const stallH = XS.map(s => ({ x: s.x, z: s.z, ry: s.ry, w: 3.2, h: 2.9, d: 2.2, wall: s.aw, roof: s.col, rt: 2 }));
      const garH = XG.map(gd => ({ x: gd.x, z: L.garages.zf, ry: 0, w: gd.w, h: 2.7, d: 5, wall: '#EAD9CC', roof: '#B9A3B8', rt: 1 }));
      const newBy = byZone(XP.NEW_HOUSES.map(hh => ({ x: hh.x, z: hh.z, ry: hh.ry, w: hh.w, h: hh.h, d: hh.d, wall: ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC', '#F2DFC8', '#D6E4EE'][hh.seed % 8], roof: ['#C98F86', '#9AA5C5', '#B8907A', '#D9A0A0', '#8FAE9A'][hh.seed % 5], rt: hh.o.roof !== undefined ? hh.o.roof : hh.seed % 3 })).concat(stallH, garH), h => zkey(h.x, h.z));
      // новые куски — в дальность (мелочь вблизи — здесь: main.js о них не знает); смотровые места видны дальше
      // терраса с ротондой и ворота видны издалека; остальные новые куски сменяются «коробками» чуть раньше прежних
      const LANDMARK = new Set([zkey(-90, -37.4), zkey(L.gorn.xc, L.gateZ)]);
      for (const g of zonesN.values()) { const det = []; g.children.forEach(m => { if (m.userData.detail) { m.geometry.computeBoundingBox(); det.push(m); } }); lodZone(g, { det, ld: LANDMARK.has(g.userData.zone.slice(1)) ? 1.5 : 0.85 }); }
      for (const e of LOD.zones) {
        const k = e.g.userData.zone; if (!k) continue;
        const isNew = k[0] === 'n', list = (isNew ? newBy : oldBy).get(isNew ? k.slice(1) : k);
        if (list && list.length) { e.imp = impostorOf(list, isNew ? newRoot : scene); e.bb.union(bbOf(e.imp)); }
        await slice();
      }
      buildMountains();
      newRoot.visible = true; LOD.dirty = true;
    }

    async function dressAll() {
      if (DRESS.started) return dressP; DRESS.started = true; DRESS.t0 = performance.now(); tSl = performance.now();
      try {
        await dressHouses(); await dressEast(); await dressEmbank(); await dressPark(); await dressHill(); await dressEdge(); await finishDress();
        DRESS.done = true; DRESS.ms = Math.round(performance.now() - DRESS.t0); DRESS.phase = 'готово';
        try { window.dispatchEvent(new CustomEvent('world:mapDressed', { detail: { ms: DRESS.ms, steps: DRESS.steps } })); } catch (e) { /* старый браузер */ }
      } catch (e) { DRESS.err = String(e && e.stack || e); console.warn('map dress', e); newRoot.visible = true; }
      dressResolve(DRESS);
      return dressP;
    }
    // старт: когда город собран (world:ready) или через 3 с (стенд без main.js); WORLD.MAP_DRESS_NOW — сразу
    { let fired = false; const go = () => { if (fired) return; fired = true; window.removeEventListener('world:ready', go); setTimeout(dressAll, 30); };
      window.addEventListener('world:ready', go); setTimeout(go, WORLD.MAP_DRESS_NOW ? 0 : 3000); }

    mark('end'); L.cityBuiltMs = Math.round(performance.now() - tBuild0);
    return {
      // лавочки для жителей: без террасы холма (жители не поднимаются) и без тайной скамейки — она для героини
      L, colliders, zones, instMeshes, seats: SEATS.filter(sd => !(sd.y > 0.2) && !sd.secret), seatsAll: SEATS, atlas: H.ATLAS, fillerDoors,
      npcSpots: {
        raccoon: { x: 2.3, z: 0.9, ry: 0.4 }, poodle: { x: 18.6, z: 0.5, ry: -0.3 }, sheep: { x: -9.4, z: 0.95, ry: 0.2 },
        bunny: { x: 6.2, z: 25.6, ry: 2.3 }, goose: { x: 15.8, z: 37.6, ry: -2.4 }, hedgehog: { x: 34.8, z: 23.0, ry: -2.6 },
        fox: { x: -41.6, z: 34.6, ry: 2.2 }, pigeon: { x: 19.8, z: 63.0, ry: 0.6 },
      },
      carSpawn: { x: 8.8, z: 4.75, ry: PI / 2 },
      heroSpawn: { x: -0.7, z: 2.2, yaw: PI },
      // волна 3
      spray: C.spray, water: C.water, clouds: C.clouds, halos: C.halos,   // main.js анимирует их по MAP (брызги фонтана, течение воды, облака)
      zonesN, newRoot, lod: LOD, viewMode: VM, dress: DRESS, dressed: dressP, dressNow: dressAll, spots: L.spots, houses: { old: XP.OLD_HOUSES, fresh: XP.NEW_HOUSES, stalls: XS, garages: XG },
    };
  };
})();
