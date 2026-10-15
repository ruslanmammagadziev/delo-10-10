/* =====================================================================
   ПРОЦЕДУРНАЯ АНИМАЦИЯ ГЕРОИНИ: скелет из tools/rig_heroine.py, без файлов анимации. Волна 3: естественный шаг.

   HeroAnim.create(root[, opt]) -> anim | null
     root — объект, внутри которого кости (THREE.Bone с именами из HeroAnim.NAMES: hips, spine, chest, neck,
            head, hair, shoulder_L/R, upperarm_L/R, forearm_L/R, hand_L/R, thigh_L/R, shin_L/R, foot_L/R,
            coat_L/R). _L — левая сторона героини (+x, свободная рука), _R — правая (−x, в ней лупа).
            У всех костей покой без поворота: x — влево от героини, y — вверх, z — вперёд.
            null — костей не хватает (тогда город показывает «статуэтку»).
     anim.update(dt, s) — раз в кадр; s = {
            speed     — скорость, м/с. До ~2.3 — шаг (прямая спина, опорная нога почти прямая, пятка → носок),
                        2.3–2.8 — плавный переход, дальше — лёгкая трусца (без приседа). Стопа в опоре стоит на
                        земле (IK), рекомендуемые скорости — HeroAnim.SPEEDS,
            sitting   — сидит (true/false), sitPose — 'chair' (по умолчанию) | 'recline' (откинувшись),
            waving    — машет свободной левой рукой (лупа остаётся в правой),
            turnRate  — скорость поворота, рад/с (+ — налево): наклон в поворот, волосы заносит,
            celebrate — фронт false→true: прыжок «ура» с руками вверх (~1.1 с),
            idle      — можно оглядываться и переминаться (по умолчанию — когда стоит),
            carry     — необязательно: 'bouquet' (букет у груди) | любое другое истинное (предмет перед собой),
            sniff     — необязательно: 0..1, поднести букет к лицу,
            ride      — необязательно: на велосипеде (true или объект; вход/выход — плавно за 0.4 с; заменяет
                        sitting и шаг). Все точки — в осях модели героини (= hero.root при нулевом смещении body;
                        +x влево, +y вверх, +z вперёд, 0 — на земле между стопами в покое); формат точки —
                        {x,y,z} | [x,y,z] | THREE.Vector3; всё необязательно (иначе HeroAnim.RIDE):
                          seat      — верх седла (таз садится на 0.133 выше),
                          pedalL/R  — точки педалей (верх площадки) — лучше всего (синхронно с моделью); иначе
                          crank|crankAt + crankR + pedalPhase (0..1: 0 — левая педаль вверху, 0.25 — впереди)
                                      или speed (сама крутит: HeroAnim.RIDE.dev м на оборот),
                          handL/R   — середины ручек руля (ладонь ложится на ручку, локти чуть согнуты),
                          steer     — поворот руля, рад (+ налево): голова смотрит в поворот; без handL/R — ручки
                                      поворачиваются сами вокруг оси руля,
                          lean      — крен велосипеда, рад (+ влево): корень героини наклоняется вместе с
                                      велосипедом (это делает вызывающий), здесь — только голова держит горизонт,
            drive     — необязательно: за рулём машины (true или объект; вход/выход за 0.4 с; заменяет sitting —
                        таз остаётся на высоте позы «стул», как раньше): {
                          steer     — −1..1 (+ налево): руль поворачивается, руки на «10 и 2» едут вместе с ним,
                          wheel     — центр руля (оси модели), wheelR — радиус, wheelTilt — наклон плоскости руля
                                      назад от вертикали, рад (как rotation.x тора в car.js),
                          seat      — 'low': низкое спортивное кресло (красный седан): таз — там, где его ставит машина
                                      (корень героини ниже), ноги вытянуты вперёд к педалям (IK: сустав ступни в точке
                                      pedal), корпус чуть откинут назад (recline), руки тянутся к рулю, голова — прямо;
                                      без seat — прежняя поза «как на стуле» (ретро-купе); объект/массив — точка сиденья,
                          pedal     — для seat 'low': сустав левой ступни [x, y, z] (оси модели; правая — зеркально),
                                      по умолчанию HeroAnim.DRIVE_LOW.pedal; recline — наклон корпуса назад, градусы }
            }
     anim.handL / anim.handR / anim.head — кости для предметов: букет, стакан, находки — в handL;
            шапки, наушники, звезда — в head. anim.bones — все кости по имени.
     anim.step — счётчик шагов (растёт в момент касания пяткой; для звука шагов), anim.phase — фаза (0..1),
     anim.lift — насколько поднят таз над землёй (прыжок), anim.celebrate() — то же, что фронт s.celebrate,
     anim.reset() — поза покоя. anim.gait — {cadence (шаг/с), stride (м), duty, run (0..1)} — для отладки.
   HeroAnim.SPEEDS = { walk, jog, run } — рекомендуемые скорости, м/с (шаг по умолчанию, трусца — далёкая цель или
            джойстик до упора, run — потолок, для которого анимация ещё красивая).
   HeroAnim.RIDE / HeroAnim.DRIVE — геометрия велосипеда и руля машины по умолчанию (оси модели героини).
   Всё считается в осях модели, кости — обычные THREE.Bone: тень, контур и прозрачность работают как у
   любой SkinnedMesh. Плавность: у каждого слоя (шаг, бег, сидя, машет, ура, велосипед, машина) свой вес.
   ===================================================================== */
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2, D = PI / 180;
  const NAMES = ['hips', 'spine', 'chest', 'neck', 'head', 'hair'];
  ['_L', '_R'].forEach(s => ['shoulder', 'upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'coat'].forEach(n => NAMES.push(n + s)));
  const SPEEDS = { walk: 2.0, jog: 3.0, run: 3.4 };
  // велосипед-«голландец» по умолчанию (оси модели героини) — совпадает с js/world/bike.js (D.saddle/bb/grip − heroRoot)
  const RIDE = { seat: [0, 0.727, -0.03], crank: [0, 0.235, 0.255], crankR: 0.15, pedalX: 0.135,
    handL: [0.262, 0.936, 0.337], handR: [-0.262, 0.936, 0.337], steerAxis: [0, 0.927, -0.375], steerAt: [0, 0.275, 0.79], dev: 4.1 };
  // руль машины по умолчанию (оси модели героини): куда дотягиваются руки с чуть согнутыми локтями; размер и наклон —
  // как у руля в js/world/car.js (тор 0.17, rotation.x 0.95). Корень героини в машине = центр руля − DRIVE.wheel.
  const DRIVE = { wheel: [0, 0.92, 0.32], wheelR: 0.17, wheelTilt: 0.95 };
  // низкое спортивное кресло (opt.drive.seat === 'low'): сустав ступни у педалей (оси модели: таз на 0.86, пол салона
  // на ≈ 0.40 — пятка на полу, носок на педали), наклон корпуса назад
  const DRIVE_LOW = { pedal: [0.15, 0.5, 0.56], recline: 16, toe: 28 };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
  const lerp = (a, b, k) => a + (b - a) * k;
  const bump = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  // гладкий минимум (не больше обычного): таз опускается плавно, без изломов
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

  // периодическая монотонная кубическая кривая по ключам (доля цикла 0..1 → радианы), без выбросов между ключами
  // F, V — массивы ключей (F по возрастанию в [0,1)); значения между равными ключами — ровно постоянные
  function pmono(F, V, n, f) {
    f -= Math.floor(f);
    let i = n - 1;
    for (let k = 0; k < n; k++) if (F[k] > f) { i = k - 1; break; }
    if (i < 0) i = n - 1;
    const fi = F[i], j = (i + 1) % n, fj = F[j] + (j === 0 ? 1 : 0), ip = (i - 1 + n) % n, jn = (j + 1) % n;
    const fp = F[ip] - (ip >= i ? 1 : 0), fn = F[jn] + (jn <= i ? 1 : 0);
    let x = f; if (x < fi) x += 1;
    const h = fj - fi, d0 = (V[i] - V[ip]) / (fi - fp), d1 = (V[j] - V[i]) / h, d2 = (V[jn] - V[j]) / (fn - fj);
    const m1 = d0 * d1 <= 0 ? 0 : 2 * d0 * d1 / (d0 + d1), m2 = d1 * d2 <= 0 ? 0 : 2 * d1 * d2 / (d1 + d2);
    const t = (x - fi) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * V[i] + (t3 - 2 * t2 + t) * h * m1 + (-2 * t3 + 3 * t2) * V[j] + (t3 - t2) * h * m2;
  }
  // наклон стопы (градусы, + носок вверх) по «времени событий» τ: 0..1 — опора (0 — касание пяткой), 1..2 — перенос
  // шаг: пятка → плоско → пятка отрывается → толчок носком; трусца: почти плоское касание, раньше толчок
  const FOOT_TAU = [0, 0.16, 0.42, 0.72, 1.0, 1.12, 1.42, 1.7, 1.88];
  const FOOT_WALK = [8, 0, 0, -18, -50, -54, -22, 2, 7];
  const FOOT_JOG = [4, 0, -4, -30, -55, -58, -26, 0, 4];
  // позы (градусы): [x, y, z] — порядок Эйлера XYZ, как у three.js по умолчанию
  const SIT = {
    chair: { thigh_L: [-88, 0, 2], thigh_R: [-88, 0, -2], shin_L: [88, 0, 0], shin_R: [88, 0, 0],
      upperarm_L: [-10, 0, 5], upperarm_R: [-10, 0, -5], forearm_L: [-50, 0, -4], forearm_R: [-50, 0, 4],
      hand_L: [25, 0, 0], hand_R: [25, 0, 0], spine: [3, 0, 0], head: [6, 0, 0] },
    recline: { hips: [-14, 0, 0], spine: [-8, 0, 0], chest: [-6, 0, 0], head: [-12, 0, 0],
      thigh_L: [-62, 0, 3], thigh_R: [-62, 0, -3], shin_L: [48, 0, 0], shin_R: [48, 0, 0],
      upperarm_L: [-15, 0, 12], upperarm_R: [-15, 0, -12], forearm_L: [-48, 0, -22], forearm_R: [-48, 0, 22],
      hand_L: [15, 0, 0], hand_R: [15, 0, 0] },
    // за рулём: корпус чуть назад, колени вверх к педалям (стопы прячутся под панелью); руки ставит IK на руль
    drive: { hips: [-6, 0, 0], spine: [2, 0, 0], chest: [2, 0, 0], thigh_L: [-68, 0, 6], thigh_R: [-72, 0, -5],
      shin_L: [66, 0, 0], shin_R: [60, 0, 0] },
  };

  function create(root, opt) {
    const T = window.THREE;
    if (!T || !root) return null;
    opt = opt || {};
    const B = {};
    root.traverse(o => { if (o.isBone && NAMES.indexOf(o.name) >= 0 && !B[o.name]) B[o.name] = o; });
    for (let i = 0; i < NAMES.length; i++) if (!B[NAMES[i]]) return null;
    const rest = {};
    NAMES.forEach(n => { rest[n] = B[n].position.clone(); B[n].rotation.set(0, 0, 0); });
    // подошва в осях ступни: пятка и носок (сустав ступни над землёй на высоте footY)
    const footY = rest.hips.y + rest.thigh_L.y + rest.shin_L.y + rest.foot_L.y;
    const heel = new T.Vector3(0, -footY, -0.042), toe = new T.Vector3(0, -footY, 0.145);
    const BALL = new T.Vector3(0, -footY, 0.1);   // подушечка стопы (на педали)
    // поза кадра: углы (рад) по костям
    const P = {}; NAMES.forEach(n => { P[n] = [0, 0, 0]; });
    const add = (n, x, y, z, k) => { const p = P[n]; k = k === undefined ? 1 : k; p[0] += x * k; p[1] += y * k; p[2] += z * k; };
    const addDeg = (pose, k) => { if (k <= 0) return; for (const n in pose) { const a = pose[n]; add(n, a[0] * D, a[1] * D, a[2] * D, k); } };
    const mixTo = (n, x, y, z, k) => { const p = P[n]; p[0] = lerp(p[0], x, k); p[1] = lerp(p[1], y, k); p[2] = lerp(p[2], z, k); };
    // состояние
    let t = 0, phase = 0, speedS = 0, wMove = 0, wRun = 0, wSit = 0, wRec = 0, wWave = 0, wCarry = 0, wBq = 0, lean = 0, step = 0, lastF = 0;
    let hipsS = 0.86, wRide = 0, wDrive = 0, pedPh = 0, steerS = 0, rideLean = 0, leanFw = 0, wLow = 0, lowMem = false;
    let wsT = 2 + Math.random() * 3, ws = 0, wsS = 0, lookT = 1.5 + Math.random() * 2, look = [0, 0, 0], lookS = [0, 0, 0];
    let celT = -1, prevCel = false, wavePh = 0;
    const hair = { x: 0, vx: 0, z: 0, vz: 0 };
    const coatS = { _L: { x: 0, v: 0 }, _R: { x: 0, v: 0 } };
    const q = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), pp = new T.Vector3(), hp = new T.Vector3();
    const v3 = new T.Vector3(), v4 = new T.Vector3(), mA = new T.Matrix4(), mB = new T.Matrix4();
    // ноги: цель сустава ступни (оси модели), наклон стопы, вес «опоры» для высоты таза; zs — где стоит стопа
    const legT = { _L: { zs: 0, zLift: 0, sw: false }, _R: { zs: 0, zLift: 0, sw: false } };
    const footDes = { _L: { pitch: 0, yaw: 0, w: 0 }, _R: { pitch: 0, yaw: 0, w: 0 } };
    const KF = new Float64Array(9), KV = new Float64Array(9);
    const armAxis = rest.forearm_L.clone().normalize();   // ось плеча (от плечевого сустава к локтю)
    const ankleX = Math.abs(rest.thigh_L.x + rest.shin_L.x + rest.foot_L.x);
    const L1 = rest.shin_L.length(), L2 = rest.foot_L.length(), LMAX = (L1 + L2) * 0.9985;
    const qh = new T.Quaternion(), qhi = new T.Quaternion(), hj = new T.Vector3(), tg = new T.Vector3();
    const ikOut = [0, 0, 0, 0];
    // IK ноги: углы бедра (x — мах, y — поворот вокруг оси бедра, z — отведение) и колена, чтобы сустав ступни
    // попал в точку tgt (оси модели) при текущем тазе; twist — поворот бедра вокруг своей оси (носок наружу,
    // колено смотрит туда же, куда стопа). Решение точное для порядка Эйлера XYZ.
    const uK = new T.Vector3();
    function legIK(sd, hipsPos, tgt, twist) {
      hj.copy(rest['thigh' + sd]).applyQuaternion(qh).add(hipsPos);
      v.copy(tgt).sub(hj).applyQuaternion(qhi);
      const dRaw = v.length(), d = clamp(dRaw, 0.08, LMAX);
      const kn = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
      // сустав ступни в осях бедра при этом колене
      uK.copy(rest['foot' + sd]); const c = Math.cos(kn), s = Math.sin(kn), y0 = uK.y, z0 = uK.z;
      uK.y = y0 * c - z0 * s; uK.z = y0 * s + z0 * c; uK.add(rest['shin' + sd]);
      v.multiplyScalar(uK.length() / Math.max(1e-6, dRaw));
      const cp = Math.cos(twist), spn = Math.sin(twist);
      const X = (v.x - uK.z * spn) / cp, A = uK.x, Bq = -uK.y, R = Math.hypot(A, Bq);
      const lat = Math.atan2(Bq, A) - Math.acos(clamp(X / R, -1, 1));
      const Y = uK.x * Math.sin(lat) + uK.y * Math.cos(lat), wz = -X * spn + uK.z * cp;
      let ax = Math.atan2(v.z, v.y) - Math.atan2(wz, Y); ax -= TAU * Math.round(ax / TAU); ikOut[0] = ax; ikOut[1] = twist; ikOut[2] = lat; ikOut[3] = kn;
      return ikOut;
    }
    // сустав ступни по «опорной точке» стопы: z — где стоял бы сустав при плоской стопе; наклон — вокруг пятки
    // (носок вверх) или носка (носок вниз), так точка опоры не скользит
    function ankleAt(L, z, pitch, lift) {
      const a = -pitch, c = Math.cos(a), sn = Math.sin(a), P0 = pitch > 0 ? heel : toe;
      L.y = footY + P0.y + (-P0.y * c + P0.z * sn) + lift;
      L.z = z + P0.z + (-P0.y * sn - P0.z * c);
    }
    // высота тазобедренного сустава, при которой нога (почти прямая) достаёт до сустава ступни (сагиттально)
    const reachH = (ay, az, dx) => ay + Math.sqrt(Math.max(0, LMAX * LMAX * 0.999 - az * az - dx * dx));
    const tmpL = { y: 0, z: 0 };
    // где ставить пятку: так, чтобы таз на касании и на толчке опускался одинаково (бисекция)
    function touchdownZ(travel, p0, p1, dx) {
      let lo = 0, hi = travel;
      for (let k = 0; k < 16; k++) {
        const m = (lo + hi) / 2;
        ankleAt(tmpL, m, p0, 0); const hF = reachH(tmpL.y, tmpL.z, dx);
        ankleAt(tmpL, m - travel, p1, 0); const hB = reachH(tmpL.y, tmpL.z, dx);
        if (hF > hB) lo = m; else hi = m;
      }
      return (lo + hi) / 2;
    }
    // FK ноги для подошвы: самая низкая точка (пятка/носок) в осях модели при текущей позе
    function soleY(side, hipsPos) {
      e.set(P.hips[0], P.hips[1], P.hips[2]); q.setFromEuler(e);
      pp.copy(hipsPos);
      const chain = ['thigh' + side, 'shin' + side, 'foot' + side];
      for (let i = 0; i < 3; i++) {
        const n = chain[i];
        v.copy(rest[n]).applyQuaternion(q); pp.add(v);
        e.set(P[n][0], P[n][1], P[n][2]); qa.setFromEuler(e); q.multiply(qa);
      }
      // стопа — как её поставят ниже (нужный наклон в осях модели с весом footDes.w)
      const F = footDes[side];
      if (F.w > 0.001) { e.set(-F.pitch, F.yaw, 0, 'YXZ'); qa.setFromEuler(e); q.slerp(qa, F.w); }
      const a = v.copy(heel).applyQuaternion(q).y, b = v.copy(toe).applyQuaternion(q).y;
      return pp.y + Math.min(a, b);
    }
    // плечевой сустав руки в осях модели и поворот её родителя (ключицы) — по текущей позе P
    const armS = new T.Vector3(), armQ = new T.Quaternion();
    function armBase(sd, hipsPos) {
      e.set(P.hips[0], P.hips[1], P.hips[2]); armQ.setFromEuler(e); armS.copy(hipsPos);
      const ch = ['spine', 'chest', 'shoulder' + sd];
      for (let i = 0; i < 3; i++) { const n = ch[i]; v.copy(rest[n]).applyQuaternion(armQ); armS.add(v); e.set(P[n][0], P[n][1], P[n][2]); qa.setFromEuler(e); armQ.multiply(qa); }
      v.copy(rest['upperarm' + sd]).applyQuaternion(armQ); armS.add(v);
    }
    // IK руки (точное решение): ладонь — точка кисти, которой она держит руль, — в точку W; локоть — в сторону pole.
    // Сгиб локтя e находится из |a + Rx(−e)·F| = |W − плечо| (a — плечо до локтя, F — локоть до ладони, кисть прямая),
    // поворот плеча — базис «плечо→ладонь» + «к локтю» → тот же базис в мире. Результат — в P с весом k
    const PALM = { _L: new T.Vector3(-0.004, -0.08, 0.01), _R: new T.Vector3(0.004, -0.08, 0.01) };
    const ARM = {};
    ['_L', '_R'].forEach(sd => {
      const a = rest['forearm' + sd].clone(), F = rest['hand' + sd].clone().add(PALM[sd]);
      ARM[sd] = { a, F, aa: a.lengthSq(), ff: F.lengthSq(), A: a.y * F.y + a.z * F.z, B: a.y * F.z - a.z * F.y, axFx: a.x * F.x, dmax: a.length() + F.length() };
    });
    const e1 = new T.Vector3(), e2 = new T.Vector3(), e3 = new T.Vector3(), E1 = new T.Vector3(), E2 = new T.Vector3(), E3 = new T.Vector3(), armW = new T.Vector3();
    function armIK(sd, hipsPos, W, pole, k) {
      if (k <= 0.001) return;
      const G = ARM[sd];
      armBase(sd, hipsPos);
      armW.copy(W).sub(armS); const dRaw = armW.length();
      const d = clamp(dRaw, 0.16, G.dmax * 0.995);
      const R = Math.hypot(G.A, G.B), C = (d * d - G.aa - G.ff) / 2 - G.axFx;
      const el = clamp(Math.atan2(G.B, G.A) + Math.acos(clamp(C / R, -1, 1)), 0, 2.6);
      // ладонь в осях плеча при этом сгибе: V = a + Rx(−el)·F
      const c = Math.cos(el), sn = Math.sin(el);
      e1.set(G.F.x, G.F.y * c + G.F.z * sn, -G.F.y * sn + G.F.z * c).add(G.a).normalize();
      e2.copy(G.a).addScaledVector(e1, -G.a.dot(e1)).normalize(); e3.crossVectors(e1, e2);
      E1.copy(armW).multiplyScalar(1 / Math.max(1e-6, dRaw));
      E2.copy(pole).addScaledVector(E1, -pole.dot(E1)); if (E2.lengthSq() < 1e-8) E2.set(0, -1, 0).addScaledVector(E1, -E1.y); E2.normalize(); E3.crossVectors(E1, E2);
      mA.makeBasis(e1, e2, e3); mB.makeBasis(E1, E2, E3); mB.multiply(mA.transpose());
      qb.setFromRotationMatrix(mB);                       // поворот плеча в осях модели
      q.copy(armQ).invert().multiply(qb);                // → локальный
      e.setFromQuaternion(q, 'XYZ');
      mixTo('upperarm' + sd, e.x, e.y, e.z, k);
      mixTo('forearm' + sd, -el, 0, 0, k);
      mixTo('hand' + sd, 0, 0, 0, k);
    }
    const toV = (o, def, out) => {
      if (o && o.isVector3) return out.copy(o);
      if (Array.isArray(o)) return out.set(o[0], o[1], o[2]);
      if (o && typeof o.x === 'number') return out.set(o.x, o.y, o.z);
      return out.set(def[0], def[1], def[2]);
    };
    const RV = { seat: new T.Vector3(), crank: new T.Vector3(), hL: new T.Vector3(), hR: new T.Vector3(), pL: new T.Vector3(), pR: new T.Vector3(), hips: new T.Vector3(), wheel: new T.Vector3(), wup: new T.Vector3(), poleL: new T.Vector3(), poleR: new T.Vector3(), tmp: new T.Vector3() };
    const SEAT_OFF = new T.Vector3(0, 0.133, 0.035);    // таз над верхом седла (седалищные кости чуть позади суставов)

    const api = {
      bones: B, handL: B.hand_L, handR: B.hand_R, head: B.head, NAMES,
      get phase() { return phase; }, get step() { return step; }, lift: 0,
      gait: { cadence: 0, stride: 0, duty: 0, run: 0 },
      celebrate() { celT = 0; },
      reset() {
        NAMES.forEach(n => { B[n].rotation.set(0, 0, 0); B[n].position.copy(rest[n]); });
        ['_L', '_R'].forEach(sd => { legT[sd].zs = 0; legT[sd].sw = false; coatS[sd].x = coatS[sd].v = 0; });
        hair.x = hair.vx = hair.z = hair.vz = 0;
      },
      update(dt, s) {
        s = s || {};
        dt = clamp(dt || 0, 0, 0.1); t += dt;
        const rideO = s.ride ? (typeof s.ride === 'object' ? s.ride : {}) : null, driveO = s.drive ? (typeof s.drive === 'object' ? s.drive : {}) : null;
        const sitting = !!s.sitting && !rideO && !driveO, seated = !!s.sitting || !!rideO || !!driveO;
        const spd = Math.max(0, +s.speed || 0);
        speedS = damp(speedS, seated ? 0 : spd, 9, dt);
        wMove = damp(wMove, !seated && speedS > 0.12 ? 1 : 0, 7, dt);
        wRun = damp(wRun, sst(2.3, 2.8, speedS), 5, dt);
        wSit = damp(wSit, sitting ? 1 : 0, 6, dt);
        wRec = damp(wRec, s.sitPose === 'recline' ? 1 : 0, 5, dt);
        wWave = damp(wWave, s.waving && !rideO && !driveO ? 1 : 0, 7, dt);
        // велосипед и машина: линейно за 0.4 с, сглажено
        wRide = clamp(wRide + (rideO ? dt : -dt) / 0.4, 0, 1); wDrive = clamp(wDrive + (driveO ? dt : -dt) / 0.4, 0, 1);
        const eR = sst(0, 1, wRide), eD = sst(0, 1, wDrive), eV = Math.max(eR, eD), wSeat = Math.max(wSit, eV);
        if (s.celebrate && !prevCel) celT = 0;
        prevCel = !!s.celebrate;
        const turn = clamp(+s.turnRate || 0, -12, 12);
        lean = damp(lean, clamp(-0.025 * turn * speedS, -0.13, 0.13), 6, dt);
        for (const n in P) { const p = P[n]; p[0] = p[1] = p[2] = 0; }
        let hx = 0, hz = 0, lift = 0, twist = 0;

        // --- шаг и трусца. Цикл: 0 — пятка левой касается земли, правая — со сдвигом 0.5. Опорная стопа стоит
        // (её точка едет назад со скоростью тела), перенос — по гладкой дуге; таз — на высоте, где опорные ноги
        // почти прямые (колено 5–15°), опускается ровно настолько, чтобы нога доставала.
        const r = wRun, vS = speedS;
        // длина шага растёт со скоростью и насыщается (~0.65 м на 1.3 м/с, ~0.7 м на 2 м/с): быстрее — чаще, а не шире
        const stepW = 0.73 - 0.52 * Math.exp(-1.45 * vS), cadW = vS / stepW, cadJ = 2.6 + 0.33 * vS;   // шагов в секунду
        const cad = lerp(cadW, cadJ, r), rate = cad / 2;
        const duty = lerp(clamp(0.655 - 0.07 * vS, 0.5, 0.63), clamp(0.47 - 0.03 * vS, 0.34, 0.42), r);
        // трогается с места: фаза — так, чтобы опорная левая стояла под тазом (без рывка ног)
        if (wMove < 0.02 && vS > 0.12 && !seated) { const tz = Math.max(1e-3, vS / Math.max(1e-3, rate) * duty); phase = clamp(touchdownZ(tz, lerp(9, 4, r) * D, -50 * D, 0.026) / tz, 0, 0.95) * duty; legT._L.sw = legT._R.sw = false; legT._L.zs = legT._R.zs = 0; lastF = phase; }
        if (wMove > 0.01) phase = (phase + dt * rate) % 1;
        const f = phase;
        if (wMove > 0.5 && (Math.floor(f * 2) !== Math.floor(lastF * 2) || (f < lastF))) step++;
        lastF = f;
        const stride = vS / Math.max(1e-3, rate), travel = stride * duty, Tsw = (1 - duty) / Math.max(1e-3, rate);
        api.gait.cadence = cad; api.gait.stride = stride / 2; api.gait.duty = duty; api.gait.run = r;
        // ключи наклона стопы — равномерно во времени (опора — доля duty цикла)
        const roll = clamp(0.55 + vS / 3, 0.6, 1);
        for (let k = 0; k < 9; k++) {
          const tau = FOOT_TAU[k]; KF[k] = (tau < 1 ? tau * duty : duty + (tau - 1) * (1 - duty)) % 1;
          KV[k] = lerp(FOOT_WALK[k] * roll, FOOT_JOG[k], r) * D;
        }
        const p0 = KV[0], p1 = KV[4];
        const latX = lerp(ankleX + 0.004, ankleX - 0.002, r);
        const zTD = touchdownZ(travel, p0, p1, Math.abs(rest.thigh_L.x) - latX) + lerp(0, -0.01, r);
        const liftH = lerp(0.05 + 0.01 * Math.min(vS, 2.4), 0.12, r);
        ['_L', '_R'].forEach((sd, i) => {
          const fl = (f + i * 0.5) % 1, L = legT[sd];
          L.pitch = pmono(KF, KV, 9, fl);
          let lft = 0, xo = 0;
          if (fl < duty) {
            // опора: стопа стоит на месте — её точка едет назад со скоростью тела (без скольжения)
            if (L.sw) { L.sw = false; L.zs = zTD; }
            L.zs -= vS * dt * (wMove > 0.01 ? 1 : 0);
            L.zs = Math.max(L.zs, zTD - travel - 0.03);   // скорость упала/выросла: стопа не уезжает далеко назад (лучше чуть проскользнуть, чем присесть)
            L.p = fl / duty; L.w = 1 - 0.85 * sst(0.8, 1, L.p);   // перед самым отрывом носок уже не держит таз
          } else {
            // перенос: от отрыва до следующего касания (Эрмит: в начале и в конце скорость стопы в мире — ноль),
            // подъём — ранний пик (колено сгибается ~60° в шаге), мягкое касание
            const u = (fl - duty) / (1 - duty);
            if (!L.sw) { L.sw = true; L.zLift = L.zs; }
            const m = -vS * Tsw, z0 = L.zLift, z1 = zTD, u2 = u * u, u3 = u2 * u;
            L.zs = (2 * u3 - 3 * u2 + 1) * z0 + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * z1 + (u3 - u2) * m;
            const up = lerp(0.36, 0.42, r), a1 = 1.35, b1 = a1 * (1 - up) / up;
            lft = liftH * Math.pow(u / up, a1) * Math.pow((1 - u) / (1 - up), b1);
            xo = 0.012 * Math.sin(PI * u);
            L.w = clamp(Math.max(0.15 * (1 - sst(0, 0.12, u)), sst(0.8, 1, u)), 0, 1); L.p = -1;
          }
          if (wMove < 0.05) L.zs = damp(L.zs, 0, 6, dt);   // стоит — стопы под тазом
          L.x = (i ? -1 : 1) * (latX + xo);
          ankleAt(L, L.zs, L.pitch, lft);
        });
        if (wMove > 0.001) {
          const k = wMove, th = f * TAU;
          ['_L', '_R'].forEach((sd, i) => {
            // руки — в противофазе ногам: левая вперёд, когда впереди правая нога (f≈0.5); локоть чуть согнут и
            // сгибается сильнее на взмахе вперёд; правая (с лупой) чуть скромнее
            const sg = i ? -1 : 1, mag = i ? 0.85 : 1, ph = f - (i ? 0 : 0.5) - 0.05;
            const c = Math.cos(ph * TAU), sw = Math.sin(ph * TAU);
            const amp = lerp(clamp(6 + 6 * vS, 8, 19), 25, r) * D * mag, bias = lerp(3, 6, r) * D;
            const flex = amp * c + bias;
            add('upperarm' + sd, -flex, 0, sg * (lerp(4, 8, r) + 2.5 * Math.max(0, -c) - 1.5 * Math.max(0, c)) * D, k);
            add('forearm' + sd, -(lerp(17, 72, r) + lerp(13, 12, r) * Math.max(0, c) - lerp(0, 6, r) * Math.max(0, -c)) * D, 0, -sg * lerp(0, 10, r) * D, k);
            add('hand' + sd, (5 + 5 * Math.sin((ph - 0.15) * TAU)) * D, 0, 0, k);
            add('shoulder' + sd, 0, -sg * 1.5 * D * c, (i ? 1 : -1) * lerp(0.6, 1.4, r) * D * sw, k);
          });
          // таз: поворот вслед за ногой, что идёт вперёд, сторона переноса чуть опускается, вес переходит на опору
          add('hips', lerp(1.5, 4, r) * D, -lerp(lerp(3.5, 7, clamp(vS / 2, 0, 1)), 7, r) * D * Math.cos(th), lerp(3, 2.2, r) * D * Math.sin(th), k);
          hx += lerp(0.013, 0.006, r) * Math.sin(th) * k;
          // корпус прямой, плечи — навстречу тазу
          add('spine', lerp(1.2, 3, r) * D, lerp(3, 4, r) * D * Math.cos(th), -lerp(1.2, 1, r) * D * Math.sin(th), k);
          add('chest', lerp(1.0, 3, r) * D, lerp(4.5, 7, r) * D * Math.cos(th), -lerp(1.2, 0.8, r) * D * Math.sin(th), k);
          // наклон в поворот и взгляд туда же
          add('hips', 0, 0, lean, k);
          add('head', 0, clamp(turn * 0.05, -0.25, 0.25), 0, k);
        }

        // --- стоит: дыхание, переминается, оглядывается
        const still = (1 - wMove) * (1 - wSeat);
        const br = Math.sin(t * TAU / 3.8);
        add('chest', 0.9 * D * br, 0, 0);
        add('shoulder_L', 0, 0, 0.8 * D * br); add('shoulder_R', 0, 0, -0.8 * D * br);
        const idleOk = (s.idle !== undefined ? !!s.idle : (speedS < 0.1 && !seated)) && !rideO && !driveO;
        wsT -= dt;
        if (wsT <= 0) { ws = idleOk ? [-1, 0, 1][Math.floor(Math.random() * 3)] : 0; wsT = 3.5 + Math.random() * 3.5; }
        wsS = damp(wsS, idleOk ? ws : 0, 1.6, dt);
        if (still > 0.001) {
          hx += 0.014 * wsS * still;
          add('hips', 0, 0, 2.5 * D * wsS, still);
          add('spine', 0, 0, -1.6 * D * wsS, still); add('chest', 0, 0, -1.0 * D * wsS, still);
          // свободная нога (без веса) — коленка чуть согнута
          const free = wsS > 0 ? '_R' : '_L', fk = Math.abs(wsS) * still;
          add('thigh' + free, -4 * D, 0, 0, fk); add('shin' + free, 9 * D, 0, 0, fk);
          add('upperarm_L', 0, 0, (3 + 0.6 * br) * D, still); add('upperarm_R', 0, 0, -(3 + 0.6 * br) * D, still);
          add('forearm_L', -6 * D, 0, 0, still); add('forearm_R', -6 * D, 0, 0, still);
        }
        lookT -= dt;
        if (lookT <= 0) {
          if (!idleOk || Math.random() < 0.4) look = [0, 0, 0];
          else look = [(-0.1 + Math.random() * 0.2), (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.35), Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) * 0.1 : 0];
          lookT = 2.5 + Math.random() * 3.5;
        }
        for (let i = 0; i < 3; i++) lookS[i] = damp(lookS[i], idleOk ? look[i] : 0, 3, dt);
        add('head', lookS[0] * 0.8, lookS[1] * 0.75, lookS[2]); add('neck', lookS[0] * 0.2, lookS[1] * 0.25, 0); add('chest', 0, lookS[1] * 0.12, 0);

        // --- сидит: стул (руки на коленях) или откинувшись (планетарий); велосипед и машина — свои позы ниже
        if (wSeat > 0.001) {
          for (const n in P) { const p = P[n]; p[0] *= 1 - wSeat; p[1] *= 1 - wSeat; p[2] *= 1 - wSeat; }   // шаг гаснет
          if (wSit > 0.001) {
            const sc = 1 - wRec;
            addDeg(SIT.chair, wSit * sc); addDeg(SIT.recline, wSit * wRec);
            add('chest', 0.9 * D * br, 0, 0, wSit);
            add('head', lookS[0] * 0.6, lookS[1] * 0.6, lookS[2] * 0.6, wSit);
          }
          hx *= 1 - wSeat;
        }

        // --- несёт предмет в свободной левой руке: букет — у груди (иногда подносит к лицу понюхать: s.sniff 0..1),
        // стакан, попкорн, находка — перед собой на согнутой руке; в шаге рука почти не машет
        wCarry = damp(wCarry, s.carry ? 1 : 0, 6, dt);
        wBq = damp(wBq, s.carry === 'bouquet' ? 1 : 0, 6, dt);
        if (wCarry > 0.001) {
          const sn = clamp(+s.sniff || 0, 0, 1) * wBq, k = wCarry * (1 - 0.6 * wSit) * (1 - eV);
          const ux = lerp(lerp(-8, 8, wBq), -20, sn) * D, uy = lerp(lerp(10, -6, wBq), -4, sn) * D, uz = lerp(lerp(4, -2, wBq), -2, sn) * D;
          const fx = lerp(lerp(-45, -98, wBq), -118, sn) * D, fz = lerp(lerp(-15, -19, wBq), -33, sn) * D;
          const swing = 3 * D * Math.sin(phase * TAU) * wMove;
          mixTo('upperarm_L', ux + swing, uy, uz, k); mixTo('forearm_L', fx, 0, fz, k); mixTo('hand_L', 5 * D, 0, 0, k);
          add('head', 10 * D * sn * (1 - eV), 0, 0);
        }

        // --- машет свободной левой рукой («привет!»): локоть в сторону и вперёд, предплечье вверх, кисть качается
        if (wWave > 0.001) {
          wavePh += dt * TAU * 2.1;
          const sw = Math.sin(wavePh);
          // поза подобрана оптимизацией (кисть у виска снаружи головы, перед волосами); качание — поворот плеча
          // вокруг своей оси (кисть ходит из стороны в сторону, как «дворник»), кисть догоняет с запаздыванием
          mixTo('shoulder_L', 0, 0, 10 * D, wWave);
          mixTo('upperarm_L', -41 * D, -20.5 * D, 43.5 * D, wWave);
          mixTo('forearm_L', -41 * D, -31.5 * D, 55.6 * D, wWave);
          mixTo('hand_L', 0, 0, (-5 + 12 * Math.sin(wavePh - 0.8)) * D, wWave);
          twist = 0.4 * sw * wWave;
          add('head', 0, 6 * D, -7 * D, wWave); add('spine', 0, 0, 2.5 * D, wWave); add('chest', 0, 5 * D, 0, wWave);
        } else wavePh = 0;

        // --- «ура»: присела, прыжок с руками вверх, приземлилась, выпрямилась
        let celLift = 0, celAir = 0;
        if (celT >= 0) {
          celT += dt;
          const c = celT, up = sst(0.12, 0.3, c) * (1 - sst(0.8, 1.1, c)) * (1 - eV);
          const crouch = (bump(c, 0.1, 0.07) + 0.8 * bump(c, 0.68, 0.07)) * (1 - eV), air = (c > 0.2 && c < 0.6 ? Math.sin(PI * (c - 0.2) / 0.4) : 0) * (1 - eV);
          celAir = air;
          ['_L', '_R'].forEach((sd, i) => {
            const sg = i ? -1 : 1;
            mixTo('upperarm' + sd, -135 * D, 0, sg * 25 * D, up);
            mixTo('forearm' + sd, -25 * D, 0, 0, up);
            mixTo('shoulder' + sd, 0, 0, sg * 10 * D, up);
            add('upperarm' + sd, 18 * D, 0, 0, crouch * (1 - up));
            add('thigh' + sd, -32 * D, 0, 0, crouch); add('shin' + sd, 62 * D, 0, 0, crouch);
            add('thigh' + sd, -14 * D, 0, 0, air); add('shin' + sd, 34 * D, 0, 0, air);
          });
          add('spine', 8 * D, 0, 0, crouch); add('head', -10 * D, 0, 0, up);
          celLift = 0.13 * air;
          if (c > 1.1) celT = -1;
        }

        // --- ноги в шаге: таз на «номинальной» высоте (колено в опоре ~10°, в трусце — мягкая амортизация и
        // короткий полёт), но не выше, чем позволяют опорные ноги (гладкий минимум), затем IK
        const kL = wMove * (1 - wSeat);
        let hipsY = rest.hips.y;
        e.set(P.hips[0], P.hips[1], P.hips[2]); qh.setFromEuler(e); qhi.copy(qh).invert();
        if (kL > 0.001) {
          hp.set(rest.hips.x + hx, rest.hips.y, rest.hips.z + hz);
          const sL = legT._L.p >= 0 ? Math.sin(PI * legT._L.p) : 0, sR = legT._R.p >= 0 ? Math.sin(PI * legT._R.p) : 0;
          let fly = 0;
          if (duty < 0.5) {
            const fw = 0.5 - duty, g1 = ((f - duty) % 1 + 1) % 1, g2 = ((f - duty - 0.5) % 1 + 1) % 1;
            const tf = fw / Math.max(1e-3, rate), hF = Math.min(0.012, 9.8 * tf * tf / 8) + 0.002;
            if (g1 < fw) fly = Math.sin(PI * g1 / fw); else if (g2 < fw) fly = Math.sin(PI * g2 / fw);
            fly = fly * fly * hF;
          }
          let H = rest.hips.y - lerp(0.002, 0.006, r) - r * 0.005 * (sL * sL + sR * sR) + r * fly;
          ['_L', '_R'].forEach(sd => {
            const Lg = legT[sd]; hj.copy(rest['thigh' + sd]).applyQuaternion(qh);
            const dx = Lg.x - (hp.x + hj.x), dz = Lg.z - (hp.z + hj.z);
            const need = Lg.y + Math.sqrt(Math.max(0, LMAX * LMAX * 0.999 - dx * dx - dz * dz)) - hj.y;
            H = smin(H, need + (1 - Lg.w) * 0.3, 0.02);
          });
          // страховка: таз не опускается глубже ~4 см (на разгоне стопа скорее чуть проскользнёт, чем героиня присядет)
          H = Math.max(H, rest.hips.y - lerp(0.042, 0.032, r));
          // вниз — сразу (иначе нога не достанет), вверх — мягко: без подскоков, когда отпускает опорная нога
          if (kL < 0.05 || H < hipsS) hipsS = H; else hipsS = damp(hipsS, H, 22, dt);
          H = hipsS;
          hipsY = H;
          hp.y = H + lift;
          ['_L', '_R'].forEach((sd, i) => {
            const Lg = legT[sd]; tg.set(Lg.x, Lg.y, Lg.z);
            const tw = -P.hips[1] + (i ? -1 : 1) * 4 * D;   // колено и носок — по ходу (чуть наружу), таз крутится сам
            const ik = legIK(sd, hp, tg, tw);
            mixTo('thigh' + sd, ik[0], ik[1], ik[2], kL); mixTo('shin' + sd, ik[3], 0, 0, kL);
          });
        }
        // наклон стоп в шаге (поверх: стоит — стопы ровно на земле, носки чуть врозь)
        ['_L', '_R'].forEach((sd, i) => {
          const F = footDes[sd];
          F.pitch = legT[sd].pitch * kL - 22 * D * celAir; F.yaw = (i ? -1 : 1) * 4 * D; F.w = 1 - wSit;
        });

        // --- велосипед: таз на седле, ноги крутят педали (подушечка стопы на педали, носок чуть «ведёт»),
        // ладони на ручках руля, спина прямая с лёгким наклоном вперёд (сколько нужно, чтобы дотянуться), взгляд вперёд
        const hipsV = RV.hips.set(rest.hips.x + hx, rest.hips.y, rest.hips.z + hz);
        if (eR > 0.001) {
          const R = rideO || {};
          toV(R.seat, RIDE.seat, RV.seat);
          const seatHips = v4.copy(RV.seat).add(SEAT_OFF);
          // точки педалей
          const hasP = R.pedalL && R.pedalR;
          toV(R.crank && typeof R.crank === 'object' ? R.crank : R.crankAt, RIDE.crank, RV.crank);
          const cr = +R.crankR || RIDE.crankR;
          if (typeof R.pedalPhase === 'number') pedPh = R.pedalPhase;
          else pedPh = (pedPh + dt * Math.max(0, +(R.speed !== undefined ? R.speed : spd) || 0) / RIDE.dev) % 1;
          if (hasP) { toV(R.pedalL, RIDE.crank, RV.pL); toV(R.pedalR, RIDE.crank, RV.pR); }
          else {
            const th = pedPh * TAU, px = +R.pedalX || RIDE.pedalX;
            RV.pL.set(RV.crank.x + px, RV.crank.y + cr * Math.cos(th), RV.crank.z + cr * Math.sin(th));
            RV.pR.set(RV.crank.x - px, RV.crank.y - cr * Math.cos(th), RV.crank.z - cr * Math.sin(th));
          }
          steerS = damp(steerS, clamp(+R.steer || 0, -0.8, 0.8), 10, dt);
          rideLean = damp(rideLean, clamp(+R.lean || 0, -0.6, 0.6), 10, dt);
          // ручки руля: заданы — как есть; иначе поворачиваются вокруг оси руля
          if (R.handL && R.handR) { toV(R.handL, RIDE.handL, RV.hL); toV(R.handR, RIDE.handR, RV.hR); }
          else {
            toV(null, RIDE.steerAxis, RV.tmp).normalize(); qa.setFromAxisAngle(RV.tmp, steerS); toV(null, RIDE.steerAt, v3);
            RV.hL.set(RIDE.handL[0], RIDE.handL[1], RIDE.handL[2]).sub(v3).applyQuaternion(qa).add(v3);
            RV.hR.set(RIDE.handR[0], RIDE.handR[1], RIDE.handR[2]).sub(v3).applyQuaternion(qa).add(v3);
          }
          // корпус: наклон вперёд ровно такой, чтобы локти остались чуть согнутыми (поиск по углу)
          hipsV.lerp(seatHips, eR);
          mixTo('hips', 4 * D, 0, 0, eR);
          const fw = reachLean(hipsV, RV.hL, RV.hR, 0.44, 2 * D, 26 * D);
          leanFw = damp(leanFw, fw, 8, dt);
          mixTo('spine', leanFw * 0.55, -steerS * 0.08, rideLean * 0.15, eR); mixTo('chest', leanFw * 0.45, -steerS * 0.1, 0, eR);
          mixTo('neck', -leanFw * 0.25, steerS * 0.15, 0, eR); mixTo('head', -leanFw * 0.45 - 4 * D, steerS * 0.3, -rideLean * 0.5, eR);
          mixTo('shoulder_L', 0, 0, 0, eR); mixTo('shoulder_R', 0, 0, 0, eR);
          // ноги
          e.set(P.hips[0], P.hips[1], P.hips[2]); qh.setFromEuler(e); qhi.copy(qh).invert();
          ['_L', '_R'].forEach((sd, i) => {
            const pd = i ? RV.pR : RV.pL, th = Math.atan2(pd.z - RV.crank.z, pd.y - RV.crank.y);   // 0 — вверху, π/2 — впереди
            const fp = (-5 + 10 * Math.cos(th - 0.35)) * D;     // наверху носок чуть вверх, внизу и сзади — вниз
            // сустав ступни от подушечки на педали
            const a = -fp, c = Math.cos(a), sn = Math.sin(a);
            const by = -BALL.y, bz = -BALL.z;                      // подушечка → сустав (вверх, назад)
            tg.set(Math.sign(pd.x || (i ? -1 : 1)) * clamp(Math.abs(pd.x) * 0.86, 0.06, 0.125), pd.y + by * c - bz * sn, pd.z + by * sn + bz * c);
            const ik = legIK(sd, hipsV, tg, (i ? 1 : -1) * 3 * D);
            mixTo('thigh' + sd, ik[0], ik[1], ik[2], eR); mixTo('shin' + sd, ik[3], 0, 0, eR);
            const F = footDes[sd]; F.pitch = lerp(F.pitch, fp, eR); F.yaw = lerp(F.yaw, 0, eR); F.w = Math.max(F.w, eR);
          });
          // руки на руль: локти вниз и чуть в стороны
          RV.poleL.set(0.55, -0.7, -0.45); RV.poleR.set(-0.55, -0.7, -0.45);
          armIK('_L', hipsV, RV.hL, RV.poleL, eR); armIK('_R', hipsV, RV.hR, RV.poleR, eR);
        }

        // --- машина: сидит как на стуле (таз на той же высоте), колени к педалям, руки на руле «на 10 и 2»,
        // руль чуть поворачивается — руки вместе с ним; голова смотрит вперёд и немного в поворот
        if (eD > 0.001) {
          const Dd = driveO || {};
          steerS = damp(steerS, clamp(+Dd.steer || 0, -1, 1), 8, dt);
          toV(Dd.wheel, DRIVE.wheel, RV.wheel);
          const wr = +Dd.wheelR || DRIVE.wheelR, tl = Dd.wheelTilt !== undefined ? +Dd.wheelTilt : DRIVE.wheelTilt;
          RV.wup.set(0, Math.cos(tl), Math.sin(tl));            // «верх» руля в его плоскости
          const ang = steerS * 0.6;   // руль поворачивается немного (до ~35°) — руки едут вместе с ним
          ['_L', '_R'].forEach((sd, i) => {
            const a = (i ? -60 : 60) * D + ang, out = i ? RV.hR : RV.hL;
            out.copy(RV.wheel).addScaledVector(RV.wup, wr * Math.cos(a)); out.x += wr * Math.sin(a);
          });
          // низкое кресло помнится и на выходе из машины (opt.drive уже null, поза ещё гаснет 0.4 с) — без рывка ног
          if (driveO) lowMem = driveO.seat === 'low';
          const low = lowMem;
          wLow = low ? eD : 0;
          if (Dd.seat && typeof Dd.seat === 'object') { toV(Dd.seat, RIDE.seat, RV.seat); hipsV.lerp(v4.copy(RV.seat).add(SEAT_OFF), eD); }
          if (!low) addDeg(SIT.drive, eD);
          else {
            // низкое кресло: корпус откинут назад, ноги — IK к педалям (колени чуть врозь, правая — на газе, чуть дальше)
            const rc = (Dd.recline !== undefined ? +Dd.recline : DRIVE_LOW.recline) * D;
            add('hips', -rc * eD, 0, 0); add('chest', 2 * D * eD, 0, 0);
            e.set(P.hips[0], P.hips[1], P.hips[2]); qh.setFromEuler(e); qhi.copy(qh).invert();
            toV(Dd.pedal, DRIVE_LOW.pedal, RV.tmp);
            ['_L', '_R'].forEach((sd, i) => {
              tg.set(i ? -RV.tmp.x : RV.tmp.x, RV.tmp.y, RV.tmp.z + (i ? 0.03 : 0));
              const ik = legIK(sd, hipsV, tg, (i ? 1 : -1) * 4 * D);
              mixTo('thigh' + sd, ik[0], ik[1], ik[2], eD); mixTo('shin' + sd, ik[3], 0, 0, eD);
            });
          }
          const fw = low ? reachLean(hipsV, RV.hL, RV.hR, 0.45, -6 * D, 16 * D) : reachLean(hipsV, RV.hL, RV.hR, 0.45, -4 * D, 18 * D);
          leanFw = damp(leanFw, fw, 8, dt);
          add('spine', leanFw * 0.5 * eD, -steerS * 0.05 * eD, 0); add('chest', leanFw * 0.5 * eD, -steerS * 0.06 * eD, 0);
          // голова смотрит вперёд: в низком кресле шея и голова гасят наклон корпуса назад
          const rcH = low ? (Dd.recline !== undefined ? +Dd.recline : DRIVE_LOW.recline) * D : 0;
          mixTo('head', -(leanFw - 6 * D) * 0.6 + rcH * 0.55, steerS * 0.22, -steerS * 0.05, eD); mixTo('neck', -(leanFw - 6 * D) * 0.25 + rcH * 0.4, steerS * 0.1, 0, eD);
          const toe = (low ? DRIVE_LOW.toe : 12) * D;
          ['_L', '_R'].forEach(sd => { const F = footDes[sd]; F.pitch = lerp(F.pitch, toe, eD); F.yaw = lerp(F.yaw, 0, eD); F.w = Math.max(F.w, eD); });
          RV.poleL.set(0.6, -0.75, -0.2); RV.poleR.set(-0.6, -0.75, -0.2);
          armIK('_L', hipsV, RV.hL, RV.poleL, eD); armIK('_R', hipsV, RV.hR, RV.poleR, eD);
        }
        if (eV < 0.001) leanFw = 0;
        if (eD <= 0.001) wLow = 0;

        // --- полы пальто идут за бёдрами (в шаге — не больше ~40% угла, с пружинкой: подол не раскрывается
        // юбкой; сидя — почти целиком: ложатся на колени; на велосипеде — наполовину)
        const coatK = lerp(1, 0, wSeat);
        ['_L', '_R'].forEach(sd => {
          const tx = P['thigh' + sd][0], C = coatS[sd];
          const fwd = tx < 0 ? lerp(0.4, 0.34, r) : lerp(0.3, 0.24, r);
          let target = tx * lerp(lerp(fwd, 0.88, wSit), 0.86, wLow);   // низкое кресло: полы лежат на коленях
          target = lerp(target, tx * 0.55, eR);
          target += (clamp(speedS * 1.3, 0, 4.5) * D) * coatK;   // встречный воздух: подол чуть назад
          let rem = dt;
          while (rem > 1e-5) { const h = Math.min(rem, 1 / 60); rem -= h; C.v += ((target - C.x) * 260 - C.v * 26) * h; C.x += C.v * h; }
          if (wSeat > 0.5 || !isFinite(C.x)) { C.x = lerp(C.x, target, Math.min(1, dt * 12)); }
          add('coat' + sd, C.x, 0, P['thigh' + sd][2] * 0.3);
        });
        // --- голова держит горизонт (качание таза и корпуса гасится шеей)
        const tx = P.hips[0] + P.spine[0] + P.chest[0], ty = P.hips[1] + P.spine[1] + P.chest[1], tz = P.hips[2] + P.spine[2] + P.chest[2];
        const stab = 1 - wSeat;
        add('head', -tx * 0.55 * stab, -ty * 0.85 * stab, -tz * 0.8 * stab); add('neck', -tx * 0.2 * stab, -ty * 0.1 * stab, -tz * 0.1 * stab);
        // --- волосы: пружина (заносит назад на бегу и на велосипеде, наружу в повороте, гравитация держит их вниз)
        const rideSpd = eR * clamp(Math.abs(+((rideO && rideO.speed) || 0)) * 0.03, 0, 0.14);
        const hTx = clamp(speedS * 0.035, 0, 0.13) + rideSpd - tx * 0.75 + 0.02 * Math.sin(phase * TAU * 2) * wMove, hTz = clamp(-turn * speedS * 0.012, -0.16, 0.16) - tz * 0.6 + rideLean * 0.3 * eR;
        let rem = dt;
        while (rem > 1e-5) {
          const h = Math.min(rem, 1 / 60); rem -= h;
          hair.vx += (-(hair.x - hTx) * 80 - hair.vx * 6.5) * h; hair.x += hair.vx * h;
          hair.vz += (-(hair.z - hTz) * 80 - hair.vz * 6.5) * h; hair.z += hair.vz * h;
        }
        add('hair', hair.x, (P.head[1] + P.neck[1]) * 0.45, hair.z);

        // --- применяем повороты
        for (let i = 0; i < NAMES.length; i++) { const n = NAMES[i], p = P[n]; B[n].rotation.set(p[0], p[1], p[2]); }
        if (twist) B.upperarm_L.quaternion.multiply(qa.setFromAxisAngle(armAxis, twist));
        // стопы: нужный наклон и курс в осях модели → локальный поворот (как бы ни стояла цепочка ноги)
        ['_L', '_R'].forEach(sd => {
          const F = footDes[sd];
          if (F.w <= 0.001) return;
          q.copy(B.hips.quaternion).multiply(B['thigh' + sd].quaternion).multiply(B['shin' + sd].quaternion).invert();
          e.set(-F.pitch, F.yaw, 0, 'YXZ'); qa.setFromEuler(e);
          q.multiply(qa);
          B['foot' + sd].quaternion.slerp(q, F.w);
        });
        // --- таз: в шаге — высота от IK, стоя — нижняя точка подошвы на земле (колени согнулись — таз ниже);
        // в шаге подошва может только приподнять таз (если нога не дотянулась), но не опустить (полёт в трусце);
        // на велосипеде — на седле, в машине — на высоте стула
        lift += celLift;
        hp.set(rest.hips.x + hx, lerp(rest.hips.y, hipsY, kL), rest.hips.z + hz);
        const sole = Math.min(soleY('_L', hp), soleY('_R', hp));
        const plant = (1 - wSeat) * (1 - wMove);
        let yy = hp.y - sole * plant - Math.min(0, sole) * (1 - plant) * (1 - wSeat) + lift;
        let xx = hp.x, zz = hp.z;
        if (eV > 0.001) { xx = lerp(xx, hipsV.x, eV); yy = lerp(yy, hipsV.y, eV); zz = lerp(zz, hipsV.z, eV); }
        B.hips.position.set(xx, yy, zz);
        api.lift = lift;
      },
    };
    // наклон корпуса вперёд (рад, между lo и hi), при котором обе ладони достают до ручек с чуть согнутыми локтями
    function reachLean(hipsPos, hL, hR, want, lo, hi) {
      const s0 = P.spine[0], c0 = P.chest[0];
      const far = lam => {
        P.spine[0] = s0 + lam * 0.55; P.chest[0] = c0 + lam * 0.45;
        armBase('_L', hipsPos); const dL = armS.distanceTo(hL);
        armBase('_R', hipsPos); const dR = armS.distanceTo(hR);
        return Math.max(dL, dR);
      };
      let res = lo;
      if (far(lo) > want) {
        let a = lo, b = hi;
        if (far(hi) > want) res = hi;
        else { for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (far(m) > want) a = m; else b = m; } res = b; }
      }
      P.spine[0] = s0; P.chest[0] = c0;
      return res;
    }
    return api;
  }
  window.HeroAnim = { create, NAMES, SPEEDS, RIDE, DRIVE, DRIVE_LOW, version: 3, FEATURES: { ride: true, drive: true, driveLow: true, speeds: true } };
})();
