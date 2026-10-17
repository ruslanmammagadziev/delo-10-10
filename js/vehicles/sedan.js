/* =====================================================================
   ТРАНСПОРТ: красный седан, версия 3 (волна 5Б, SEDAN) — замена js/vehicles/sedan.js «один в один» по API.
   Низкий итальянский седан по пяти фотографиям автора (plan2/car_ref/c1…c5): длинный капот и кабина, сдвинутая назад,
   короткие свесы, низкое остекление, крыша плавно стекает в короткий багажник с губкой-спойлером; борта круглые:
   острая линия плеча, под ней выпуклая дверь (верх завален внутрь и ловит небо), ниже подреза — вогнутая «ложка»,
   бёдра над задними колёсами и крылья над передними шире талии; колёса заполняют арки, посадка низкая, колея широкая.
   Спереди — три проёма: высокий узкий щит-решётка с сотами в тонкой серебристой рамке и два низких боковых заборника
   с тёмной сеткой и чёрной рамкой (внутренний край вдоль щита, наружный загнут вверх), фары-«миндаль» со светодиодной
   бровью и линзой; жабра за передним колесом, чёрные зеркала, тонированные стёкла в чёрных рамках, тёмные диски
   «телефонный диск» на пять круглых окон с красными суппортами; сзади — фонари на углах, диффузор и четыре патрубка.
   БЕЗ значков, эмблем, надписей и текста на номерах (номера пустые); на щите вместо значка — гладкая красная точка
   в серебряном ободке. Подпись в игре — «Красный седан».
   v3: масштаб один по всем осям — машина настоящих пропорций (высота 1,56; v2 была на 7 % выше). Героиня сидит
   в низком спортивном кресле: driveInput() отдаёт HeroAnim seat: 'low' (таз ниже, ноги вытянуты к педалям pedal,
   корпус чуть откинут, руки на руле); у ретро-купе поза прежняя. Её видно сквозь тонированные заднее и боковые стёкла.
   Строится кодом (Three.js r149, офлайн). 4 вызова отрисовки вместе с контуром (+2 в проходе теней):
     краска (SkinnedMesh, двусторонняя: изнанка кузова = тёмная обивка салона) · контур (та же сетка) ·
     отделка (решётки, фары, фонари, колёса, салон, зеркала) · стёкла.
   Лак: тун-рампа + дешёвое «отражение неба» (горизонт по отражённому вектору, без карт окружения) + жёсткий блик.

   Оси (как у машинки города): +z — вперёд, +x — влево (сторона водителя), y — вверх, y = 0 — земля.
   Чертёж (настоящая машина, м → игра): ×1,0855 по всем осям. Размеры: длина 5,04, ширина 2,07, высота 1,56,
   база 3,06, колея 1,70/1,74, R колеса 0,375, свесы 1,01 / 0,97, просвет 0,15.

   API (как у sedan.js волны 4 — файл можно подменить без правок вызывающих)
     VEHICLES.sedan.build(THREE, opts) → model — только модель (без езды):
       opts = { kit (WORLD.createKit — общая тун-рампа и ободок города; без него свои), color ('#B4142C'), lite }
       model.group (= root) → body (тангаж/крен/присед) → кости + 4 сетки; model.body
       model.wheels { fl, fr, rl, rr } — { pivot (Bone: поворот rotation.y), spin (Bone: вращение rotation.x), x, y, z, r, front }
       model.steeringWheel { bone, center (Vector3, оси body), axis (ось колонки), tilt, radius }
       model.doors { fl, fr, rl, rr } — { bone, hinge, side (+1 лево / −1 право), max (рад), k (0..1) }; fl — водительская
       model.seats { driver, passenger, backL, backR } — Vector3 (оси body), верх подушки, куда садится таз
       model.petSeats { dog, cat } · model.heroSeat — корень героини за рулём · model.wheelCenter · model.wheelRel
       model.lights { head, tail, brake, rev, turn } — uniform-ы { value: 0..1.5 }: яркость свечения
       model.lamps { head: [[x,y,z]×2], tail: [...], brake: [...] } — точки ламп (оси body) для DayNight.addLamp
       model.dims { length, width, height, wheelBase, track, trackR, wheelR, halfW, halfL, wf, wr, ground, front, rear }
       model.driveCfg — { wb, track, wf, wr, halfW, halfL, wheelR } — ровно поля CFG VILLAGE.drive (передать cfg)
       model.paint / outline / trim / glass — сетки; model.skeleton, model.bones, model.boneIndex; model.stats { tris, verts, calls, … }
       model.setColor(hex), model.setDoor(id, k 0..1), model.pose(S), model.wheelLift, model.setWheelLift(k, lift), model.dispose()
     VEHICLES.sedan.makeCar(H | THREE, o) → car — машина с ездой, СОВМЕСТИМА с WORLD.makeCar (car.js волны 3):
       o = { x, z, ry, color, can(x,z), vmax (13,5; W6 — было 9), edge {x,z,r}, layout, kit, lite | quality:'low', autoBrake (false),
             turnSlow (false), coast (3.2 м/с² — накат без газа), autoLights (true), outlineDist (30) }
       Поля как у городской машинки: root, body, S {x,z,ry,v,steer,spin,squash,sq,pitch,roll,…}, update(dt, ctl),
         place(), reset(path), setColor, VMAX, edgeOf(), driveInput(), seatDriver, heroSeat, seatPass (кот, сзади справа),
         seatDog (собачка, сзади слева), doorL / doorR (точки у дверей снаружи), on/off('edge'|'bump'|'horn'), horn(),
         paintMesh, trimMesh, glass, outline, plate (null), wheels ({fl,fr,rl,rr} вместо InstancedMesh)
       Своё: kind 'sedan', model, dims, driveCfg, doors, seats, steeringWheel, lights, lamps, stats, lod,
         cockpit (W7) { eye, wheel: { c, r, tilt, axis }, gripL, gripR } — оси body, для вида «из-за руля» (как у кабриолета),
         openDoor(id, open = true, dur) → Promise, setDoor(id, k), doorK(id), doorsBusy, tick(dt), setWheelLift(k, lift),
         setBrake(k|null), setHeadlights(k), setNight(k 0..1), autoLights, doorStand(id) → Vector3 (оси body),
         makeCover() → чехол с бантом на крыше (setOn), dispose()
       ВАЖНО (желание автора): без газа машина только мягко катится (o.coast), сама не тормозит перед бордюром
         (o.autoBrake: false) и не сбавляет ход в повороте (o.turnSlow: false); руль — только от игрока.
     VEHICLES.sedan.create(o) → ctl — посадка и езда в городе, API как у WORLD.Car.create, но через двери:
       o = { THREE, scene, kit, layout, car?, cover?, color?, at?, colliders? | collide?, locked (false), heightAt? }
       ctl.setLocked(b) / locked · setCovered(b|null) · canEnter(x,z) · enter(hero, { cat, dog, instant }) → Promise<bool>
       ctl.exit({ instant }) → Promise<{ x, z, ry, pets }> · update(dt, input) → { bumped, edge } · horn() · animState()
       ctl.driveInput() · on('edge'|'locked'|'enter'|'exit'|'horn'|'bump', fn) · mode · seats · pos · speed · ry · dispose()
     VEHICLES.CHOICES — [{ id:'coupe', title:'Жёлтый кабриолет' }, { id:'sedan', title:'Красный седан' }] (+ make, ctl, note)
     VEHICLES.makeCar(id, H, o) / VEHICLES.createCtl(id, o) — фабрики по выбору игрока
     VEHICLES.picker({ current, onPick }) → HTMLElement — две карточки «Жёлтый кабриолет / Красный седан» (мягкие, без брендов)

   Подключение: после three.min.js (и world/kit.js, world/car.js — если есть). Файл самостоятельный.
   ===================================================================== */
(function () {
  'use strict';
  const VEH = window.VEHICLES = window.VEHICLES || {};
  const PI = Math.PI, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  const inR = (z, r) => z > r[0] && z < r[1];

  // монотонная кубическая кривая по ключам [[x, y], …] (x по возрастанию): без выбросов между ключами
  function mono(keys) {
    const n = keys.length, X = keys.map(k => k[0]), Y = keys.map(k => k[1]), d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= X[0]) return Y[0];
      if (x >= X[n - 1]) return Y[n - 1];
      let i = 0; while (x > X[i + 1]) i++;
      const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  /* =====================================================================
     ЧЕРТЁЖ. Снят с фото автора (c3 — сбоку, c1/c4/c5 — спереди, c2 — сзади) + паспортные размеры настоящей машины:
       длина 4,64 · ширина 1,86 · высота 1,44 · база 2,82 (0,61 длины) · свес спереди 0,80, сзади 1,02 · колея 1,56/1,62 ·
       колесо Ø 0,66 (19″; 0,46 высоты) · линия окон 1,00–1,07 (0,70 высоты, клином вверх к корме) · остекление 0,40 ·
       капот у ветрового стекла 1,00, кромка 0,80, над передним колесом крыло чуть выше капота · крыша выше всего над
       передними креслами · ветровое ≈ 30°, заднее пологое ≈ 25° · багажник короткий (0,6) с губкой-спойлером ·
       щит решётки: высота 0,45, ширина вверху 0,40 (h/w ≈ 1,1), остриё на высоте 0,27 · фара: длина ≈ 0,6, высота до 0,10,
       внутренний конец у верхнего угла щита · заборники: ≈ 0,55 × 0,16, низко, снаружи загнуты вверх.
     Ключи профилей ниже — в метрах НАСТОЯЩЕЙ машины: z от задней оси (корма −1,02, нос 3,62), y от земли.
     Игра: z_игры = (z − 1,30) · SX, x_игры = x · SX, y_игры = y · SY, SX = SY = 5,04 / 4,64 (v3: без растяжки по вертикали —
     героиня в низком кресле, таз 0,505, макушка 1,51 под крышей 1,56). Числа у земли (просвет, днище, порог) и колёса — сразу в игре.
     ===================================================================== */
  // По вертикали (сверка QA с фото c1/c2): кузов до линии окон — почти в масштабе длины (×1,125), выше линии окон —
  // круче (×1,25), чтобы крыша над героиней осталась 1,67: силуэт кузова как у настоящей машины, остекление чуть выше.
  // v3: масштаб ОДИН по всем осям (как у настоящей машины): героиня сидит в низком спортивном кресле (HeroAnim drive.seat
  // 'low' — таз ниже, ноги вытянуты к педалям, корпус чуть откинут), поэтому крыша — настоящей высоты (1,56 вместо 1,67)
  const SX = 5.04 / 4.643, SY = SX, ZM = 1.30, AXD = 0.13;
  const fY = v => SY * v;   // AXD: оси сдвинуты назад относительно кузова (сверка с c3: свес спереди длиннее, сзади короче)
  const YS = SY / 1.125;    // высоты отделки, подобранные в v2 (по вертикали ×1,125), → v3
  const zg = z => (z - ZM) * SX;
  const G = {
    sx: SX, sy: SY,
    zF: zg(3.622), zR: zg(-1.021), zRT: zg(-1.021) + 0.11, zFA: zg(2.82 - AXD), zRA: zg(-AXD), WR: 0.375, TF: 0.85, TR: 0.872, RA_F: 0.388, RA_R: 0.388,
    TWF: 0.27, TWR: 0.29,                                              // ширина шин: спереди / сзади (колёса вровень с крыльями)
    zWS: zg(2.15), zHF: zg(1.48), zRW: zg(-0.42), zHR: zg(0.325),     // ветровое: низ/верх по оси; заднее: низ/верх по оси
    zA0: zg(2.0), zC0: zg(-0.02),                                      // основание передней стойки и «носик» заднего бокового окна
    zBp: [zg(0.885), zg(0.955)],                                       // средняя стойка (чёрная)
    doorF: [zg(0.917), zg(1.97)], doorR: [zg(0.13), zg(0.906)], gap: 0.014, // двери (z) и ширина шва
    winF: [zg(0.955), zg(2.0)], winR: [zg(-0.02), zg(0.885)],           // боковые стёкла (z)
    capF: zg(3.12), capR: zg(-0.62), ycF: 0.50, ycR: 0.80,             // нос и корма: где начинается скругление, центры схождения
    FR: 0.03, SEAL: 0.022, PW: 0.05, FRIT: 0.032,                      // рамка стёкол, уплотнитель у линии окон, ширина стойки, чёрная кайма
    XW: 0.60,                                                          // внутренняя стенка колёсной ниши
    hipsY: 0.505, xDrv: 0.39, hipsZ: -0.27,                            // таз героини в низком кресле, ряд водителя (+x — слева)
  };
  // корень героини за рулём (кости HeroAnim: таз в позе «за рулём» на 0.86 над корнем) и руль относительно корня
  const HERO_SEAT = [G.xDrv, G.hipsY - 0.86, G.hipsZ];
  // STEER_MAX 0.63 (было 0.6): база длиннее (3,06 против 2,86), радиус разворота — как у прежнего седана (≈ 4,2 м)
  // руль: перед тазом и выше (низкое кресло, корпус откинут) — руки тянутся вперёд с чуть согнутыми локтями
  const WHEEL_REL = [0, 1.12, 0.385], TILT = 0.72, WHEEL_RAD = 0.17, STEER_MAX = 0.63;
  // сустав левой ступни у педалей (оси корня героини): пятка на ковре (пол салона 0,012), носок на педали
  const PEDAL = [0.15, -(G.hipsY - 0.86) + 0.012 + 0.10, 0.56];
  const WHEEL_C = [HERO_SEAT[0] + WHEEL_REL[0], HERO_SEAT[1] + WHEEL_REL[1], HERO_SEAT[2] + WHEEL_REL[2]];

  // профили настоящей машины → игра: kind 'y' — высота, 'x' — полуширина
  const R = (keys, kind) => mono(keys.map(([z, v]) => [zg(z), kind === 'x' ? v * SX : kind === 'y' ? fY(v) : v]));
  const P = {
    // осевая линия верха: губка багажника → заднее стекло → крыша → ветровое → капот
    yTop: R([[-1.021, 1.000], [-0.990, 1.066], [-0.930, 1.088], [-0.860, 1.080], [-0.700, 1.064], [-0.550, 1.062], [-0.420, 1.076], [-0.271, 1.136],
      [-0.081, 1.229], [0.110, 1.307], [0.325, 1.364], [0.538, 1.402], [0.824, 1.427], [1.062, 1.437], [1.300, 1.433], [1.480, 1.415], [1.681, 1.328],
      [1.890, 1.197], [2.062, 1.080], [2.150, 1.018], [2.252, 1.007], [2.538, 0.990], [2.824, 0.966], [3.110, 0.926], [3.300, 0.880], [3.450, 0.828], [3.560, 0.778], [3.622, 0.740]], 'y'),
    // линия окон / кромка капота и багажника (вид сбоку): клином вверх к корме, над передним колесом — горб крыла
    yBelt: R([[-1.021, 0.960], [-0.890, 1.040], [-0.700, 1.058], [-0.420, 1.062], [-0.200, 1.060], [0.348, 1.040], [0.919, 1.018], [1.490, 0.998],
      [2.000, 0.980], [2.252, 0.970], [2.520, 0.950], [2.820, 0.935], [3.014, 0.906], [3.300, 0.852], [3.490, 0.800], [3.622, 0.748]], 'y'),
    xBelt: R([[-1.021, 0.705], [-0.890, 0.782], [-0.700, 0.812], [-0.420, 0.824], [-0.200, 0.827], [0.348, 0.821], [0.919, 0.815], [1.490, 0.810],
      [2.000, 0.806], [2.443, 0.808], [2.824, 0.802], [3.050, 0.786], [3.250, 0.752], [3.400, 0.708], [3.520, 0.660], [3.622, 0.600]], 'x'),
    // линия плеча (самое широкое место, острая складка) и полуширина
    yM: R([[-1.021, 0.874], [-0.843, 0.930], [-0.510, 0.955], [-0.129, 0.958], [0.348, 0.945], [0.919, 0.922], [1.586, 0.902], [2.157, 0.885],
      [2.538, 0.870], [2.820, 0.860], [3.100, 0.820], [3.300, 0.775], [3.622, 0.710]], 'y'),
    // v3: «бутылка» в плане сильнее — бёдра над задними колёсами и крылья над передними шире талии у дверей
    xM: R([[-1.021, 0.855], [-0.890, 0.912], [-0.652, 0.942], [-0.400, 0.952], [-0.130, 0.955], [0.150, 0.948], [0.450, 0.926], [0.800, 0.906],
      [1.300, 0.899], [1.871, 0.903], [2.300, 0.918], [2.600, 0.928], [2.824, 0.928], [3.050, 0.916], [3.250, 0.886], [3.400, 0.842], [3.520, 0.788], [3.622, 0.715]], 'x'),
    // подрез по дверям (вторая складка): от передней арки поднимается к заднему «бедру»; ниже — вогнутая панель
    yC: R([[-1.021, 0.706], [-0.652, 0.756], [-0.176, 0.800], [0.300, 0.784], [0.824, 0.745], [1.490, 0.702], [2.157, 0.664], [2.633, 0.639], [3.205, 0.588], [3.622, 0.538]], 'y'),
    dC: R([[-1.021, 0.006], [-0.220, 0.004], [0.348, 0.002], [1.300, 0.0], [2.443, 0.002], [3.622, 0.006]]),
    // наклон верхней части двери внутрь (от линии подреза к плечу): ловит небо — светлая полоса, как на фото
    // верх двери под плечом завален внутрь (ловит небо — светлая полоса во всю длину, как на фото); бёдра — сильнее
    lean: R([[-1.021, 0.018], [-0.500, 0.026], [0.0, 0.034], [0.6, 0.036], [1.3, 0.036], [2.2, 0.032], [2.82, 0.026], [3.30, 0.018], [3.622, 0.012]]),
    dCC: R([[-1.021, 0.024], [-0.220, 0.036], [0.348, 0.052], [1.300, 0.058], [2.252, 0.050], [2.824, 0.036], [3.622, 0.026]]),
    // у земли — сразу в игре
    // v3: посадка ниже — порог 0,30, днище 0,15 (колёса заполняют арки)
    ySill: R([[-1.021, 0.40], [-0.60, 0.36], [-0.22, 0.30], [3.0, 0.30], [3.35, 0.32], [3.622, 0.34]]),
    yBotS: R([[-1.021, 0.22], [-0.80, 0.19], [-0.56, 0.16], [-0.30, 0.15], [3.07, 0.15], [3.35, 0.165], [3.622, 0.19]]),
    yFloor: R([[-1.021, 0.30], [-0.48, 0.17], [-0.12, 0.15], [0.04, 0.012], [1.90, 0.012], [2.06, 0.15], [3.622, 0.18]]),
    // кромка крыши и стойки (вид сбоку) и её полуширина — только между низом заднего стекла и основанием передней стойки
    yRE: R([[-0.420, 1.062], [-0.271, 1.124], [-0.081, 1.206], [0.110, 1.274], [0.348, 1.332], [0.586, 1.368], [0.871, 1.387], [1.157, 1.385],
      [1.348, 1.366], [1.490, 1.307], [1.681, 1.193], [1.871, 1.080], [2.000, 0.980]], 'y'),
    xRE: R([[-0.420, 0.824], [-0.224, 0.762], [-0.033, 0.705], [0.205, 0.657], [0.443, 0.633], [0.919, 0.624], [1.300, 0.629], [1.538, 0.667],
      [1.776, 0.733], [2.000, 0.806]], 'x'),
    // верх бокового остекления у задней двери: острый «носик» вниз к линии окон
    yDLOr: R([[-0.020, 1.060], [0.050, 1.118], [0.150, 1.190], [0.250, 1.252], [0.350, 1.306], [0.443, 1.343]], 'y'),
    // складки капота: полуширина приподнятой середины (сходится к щиту)
    wV: R([[2.157, 0.400], [2.633, 0.324], [3.110, 0.238], [3.490, 0.162], [3.622, 0.143]], 'x'),
  };
  const zDLOj = zg(0.443);
  const yDLO = z => (z >= zDLOj ? P.yRE(z) : z > G.zC0 ? Math.min(P.yRE(z), P.yDLOr(z)) : -1);
  const ghAt = z => z > G.zRW + 1e-4 && z < G.zA0 - 1e-4;     // есть боковое остекление/стойки
  // ветровое и заднее стёкла: границы в плане (стекло гнутое: у краёв низ ветрового ниже по z, верх заднего — впереди)
  const xA0 = 0.806 * SX;
  const zWSx = x => G.zWS - (G.zWS - G.zA0) * Math.pow(Math.min(1, Math.abs(x) / xA0), 2);
  const zHFx = x => G.zHF - 0.09 * Math.pow(Math.abs(x) / 0.67, 2);
  const zRWx = x => G.zRW + 0.12 * Math.pow(Math.min(1, Math.abs(x) / 0.70), 2);
  const zHRx = x => G.zHR + 0.06 * Math.pow(Math.abs(x) / 0.6, 2);
  const wRW = z => lerp(0.66, 0.55, clamp((z - G.zRW) / (G.zHR - G.zRW), 0, 1));
  function archTop(z) {
    const A = [[G.zFA, G.RA_F], [G.zRA, G.RA_R]];
    for (let i = 0; i < 2; i++) { const dz = z - A[i][0], ra = A[i][1]; if (Math.abs(dz) < ra) return G.WR + Math.sqrt(ra * ra - dz * dz); }
    return -1;
  }

  /* ---------- сечение кузова: половина кольца (+x), от середины верха до середины днища ---------- */
  // T — верх (крыша/стёкла/капот/багажник), G — боковое остекление и стойки, S — борт, B — днище
  function makeRing(lite) {
    const NT = lite ? 6 : 8;
    const NS = lite ? 9 : 13;
    function topU(kh, wv) {   // положения вершин верха (доля полуширины)
      const uni = [], cre = [];
      for (let i = 0; i < NT; i++) uni.push(i / (NT - 1));
      if (lite) { const a = [0, 0.5 * wv, wv, wv + 0.33 * (1 - wv), wv + 0.67 * (1 - wv), 1]; for (let i = 0; i < NT; i++) cre.push(a[i]); }
      else { const a = [0, 0.5 * wv, wv - 0.012, wv + 0.012, wv + 0.3 * (1 - wv), wv + 0.55 * (1 - wv), wv + 0.8 * (1 - wv), 1]; for (let i = 0; i < NT; i++) cre.push(a[i]); }
      return uni.map((u, i) => lerp(u, cre[i], kh));
    }
    // форма капота: приподнятая середина со складками, наружу — скат к крыльям
    const hood = (u, wv) => (u <= wv ? 1 - 0.05 * (u / wv) * (u / wv) : 0.95 * (1 - (0.75 * ((u - wv) / (1 - wv)) + 0.25 * Math.pow((u - wv) / (1 - wv), 2))));
    function half(z) {
      const yTop = P.yTop(z), yB = P.yBelt(z), xB = P.xBelt(z), yM = P.yM(z), xM = P.xM(z);
      const gh = ghAt(z), xRE = gh ? Math.max(P.xRE(z), 0.3) : xB, yRE = gh ? Math.max(P.yRE(z), yB) : yB;
      const out = [];
      // верх
      const kh = sst(G.zWS - 0.02, G.zWS + 0.30, z), trunk = z < G.zRW, xE = xRE, yE = yRE;
      const wv = clamp(P.wV(z) / xE, 0.08, 0.85), us = topU(kh, wv);
      for (let i = 0; i < NT; i++) {
        const u = us[i];
        let sh = trunk ? 1 - Math.pow(u, 2.2) : 1 - u * u;
        if (kh > 0) sh = lerp(sh, hood(u, wv), kh);
        out.push({ x: u * xE, y: yE + (yTop - yE) * sh, k: 'T' });
      }
      // боковое остекление: от кромки крыши вниз к линии окон (без остекления — все точки в кромке)
      [0.75, 0.5, 0.25, 0].forEach(t => {
        const bul = gh ? 0.012 * Math.sin(PI * t) * clamp((yRE - yB) / 0.2, 0, 1) : 0;
        out.push({ x: lerp(xB, xRE, t) + bul, y: lerp(yB, yRE, t), k: 'G', t });
      });
      // борт: плечо (скругление → острая складка) → подрез → вогнутая панель → порог → чёрный низ
      const lean = P.lean(z), yC = Math.min(P.yC(z), yM - 0.06), ySill = Math.min(P.ySill(z), yC - 0.12), xSill = xM - 0.026;
      const tuck = 0.09 * sst(G.capR + 0.25, G.zRT, z) + 0.05 * sst(G.capF - 0.1, G.zF, z);
      const yBS = P.yBotS(z), xRock = xM - 0.07 - tuck, yRT = Math.max(ySill - 0.075, yBS + 0.07), yRock = Math.max(yRT - 0.05, yBS + 0.025);
      // v3: плечо — острая складка, сразу под ней борт шире всего; дверь выпуклая (не плоская плита), ниже линии подреза —
      // вогнутая «ложка», порог снова выходит наружу; над плечом верх борта заваливается внутрь к стёклам (тамблхоум)
      // xK — складка плеча (на lean внутрь от самого широкого места), дверь выпуклая: шире всего на 0,6 высоты до подреза
      const xK = xM - lean, dx = xK - 0.004 - xB, dy = yB - yM, hD = yM - yC;
      const sh = f => [xB + dx * Math.pow(Math.sin(f * PI / 2), 0.8), yM + dy * Math.pow(Math.cos(f * PI / 2), 0.9)];
      let S;
      if (lite) {
        S = [sh(0.45), [xK - 0.003, yM], [xM - lean * 0.25, yM - 0.45 * hD], [xM - 0.012, yC + 0.004], [xM - P.dCC(z), (yC + ySill) / 2], [xSill, ySill], [xSill - 0.003, ySill - 0.009], [xRock, yRock], [xRock - 0.035, yBS + 0.008]];
      } else {
        S = [sh(0.4), sh(0.78), [xK - 0.004, yM + 0.004], [xK, yM - 0.008], [xM - lean * 0.35, yM - 0.30 * hD], [xM, yM - 0.62 * hD], [xM - 0.016, yC - 0.004],
          [xM - P.dCC(z), (yC + ySill) / 2], [xSill, ySill], [xSill - 0.003, ySill - 0.009], [xSill - 0.012, yRT], [xRock, yRock], [xRock - 0.035, yBS + 0.008]];
      }
      let yPrev = yB;
      S.forEach((q, i) => { const y = Math.min(q[1], yPrev - 0.003); yPrev = y; out.push({ x: q[0], y, k: 'S', s: i }); });
      // днище: под порогом → внутренняя стенка ниши → пол
      const yF = Math.min(P.yFloor(z), yBS);
      out.push({ x: xRock - 0.07, y: yBS, k: 'B', b: 0 }, { x: G.XW, y: yBS, k: 'B', b: 1 }, { x: G.XW - 0.04, y: yF, k: 'B', b: 2 }, { x: 0, y: yF, k: 'B', b: 3 });
      // колёсные арки: всё, что ниже верха арки (кроме стенки ниши и пола), поднимается на дугу
      const a = archTop(z);
      if (a > 0) out.forEach(q => { if ((q.k === 'S' && q.s >= 2) || (q.k === 'B' && q.b <= 1)) { if (q.y < a) q.y = a; } });
      return out;
    }
    return { NT, NS, NG: 4, NB: 4, NH: NT + 4 + NS + 4, half };
  }

  // станции вдоль кузова: нос/корма — скругление (параметр c), гуще у арок, швов, стоек и стёкол
  function stations(lite) {
    const L = [];
    const add = (z, c) => L.push({ z, c: c == null ? 1 : c });
    const capZ = (z0, zE, c, p) => z0 + (zE - z0) * Math.pow(1 - Math.pow(c, p), 1 / p);
    (lite ? [1, 0.93, 0.8, 0.6, 0.35, 0] : [1, 0.97, 0.92, 0.84, 0.72, 0.55, 0.33, 0]).forEach(c => { add(capZ(G.capF, G.zF, c, 2.6), c); add(capZ(G.capR, G.zRT, c, 2.8), c); });
    const step = lite ? 0.24 : 0.15;
    for (let z = G.capR + step; z < G.capF - 0.05; z += step) add(z);
    [[G.zFA, G.RA_F], [G.zRA, G.RA_R]].forEach(([za, ra]) => {
      const na = lite ? 3 : 5;
      for (let k = -na; k <= na; k++) add(za + ra * 0.99 * Math.sin(k / na * PI / 2));
      add(za - ra - 0.004); add(za + ra + 0.004);
    });
    const g = G.gap;
    [G.doorF[1], G.doorF[1] + g, G.doorF[0], G.doorF[0] - g, G.doorR[1], G.doorR[1] + g, G.doorR[0], G.doorR[0] - g,
      G.zBp[0], G.zBp[1], G.zA0, G.zC0, G.zWS, G.zHF, G.zRW, G.zHR].forEach(z => add(z));
    L.sort((a, b) => a.z - b.z);
    const out = [];
    L.forEach(s => { const q = out[out.length - 1]; if (q && Math.abs(q.z - s.z) < (lite ? 0.03 : 0.02)) { if (s.c < q.c) { q.c = s.c; q.z = s.z; } return; } out.push(s); });
    return out;
  }

  /* =====================================================================
     НАКОПИТЕЛЬ ГЕОМЕТРИИ: позиции, нормали, цвет (rgb или rgba), кость (жёсткая привязка), свет (lgt)
     ===================================================================== */
  function Acc(T) {
    const A = { p: [], n: [], c: [], b: [], l: [], i: [], v: 0, alpha: false };
    A.vert = (x, y, z, nx, ny, nz, col, bone, lg) => { A.p.push(x, y, z); A.n.push(nx, ny, nz); A.c.push(col[0], col[1], col[2], col.length > 3 ? col[3] : 1); if (col.length > 3) A.alpha = true; A.b.push(bone || 0); A.l.push(lg || 0); return A.v++; };
    A.tri = (a, b, c) => { A.i.push(a, b, c); };
    const _v = new T.Vector3(), _n = new T.Vector3(), _nm = new T.Matrix3();
    // готовая геометрия по матрице; skipBack — выбросить треугольники, смотрящие в −z локально (невидимая изнанка дисков)
    A.geo = (g, m, col, bone, lg, flip, skipBack) => {
      const pos = g.attributes.position, nor = g.attributes.normal; _nm.getNormalMatrix(m);
      const base = A.v;
      for (let k = 0; k < pos.count; k++) {
        _v.fromBufferAttribute(pos, k).applyMatrix4(m); _n.fromBufferAttribute(nor, k).applyMatrix3(_nm).normalize();
        if (flip) _n.negate();
        A.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, typeof col === 'function' ? col(pos, nor, k) : col, bone, lg);
      }
      const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : pos.count;
      for (let k = 0; k < cnt; k += 3) {
        const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
        if (skipBack && nor.getZ(a) < -0.5 && nor.getZ(b) < -0.5 && nor.getZ(c) < -0.5) continue;
        if (flip) A.tri(base + a, base + c, base + b); else A.tri(base + a, base + b, base + c);
      }
    };
    A.build = withL => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3));
      if (A.alpha) g.setAttribute('color', new T.Float32BufferAttribute(A.c, 4));
      else { const c3 = new Float32Array(A.v * 3); for (let k = 0; k < A.v; k++) { c3[k * 3] = A.c[k * 4]; c3[k * 3 + 1] = A.c[k * 4 + 1]; c3[k * 3 + 2] = A.c[k * 4 + 2]; } g.setAttribute('color', new T.BufferAttribute(c3, 3)); }
      const si = new Uint16Array(A.v * 4), sw = new Float32Array(A.v * 4);
      for (let k = 0; k < A.v; k++) { si[k * 4] = A.b[k]; sw[k * 4] = 1; }
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
      if (withL) g.setAttribute('lgt', new T.Float32BufferAttribute(A.l, 1));
      g.setIndex(A.v > 65535 ? new T.Uint32BufferAttribute(A.i, 1) : new T.Uint16BufferAttribute(A.i, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    };
    return A;
  }

  /* ---------- материалы ---------- */
  function ownKit(T) {
    const GV = [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255];
    const gd = new Uint8Array(64); GV.forEach((v, i) => gd.set([v, v, v, 255], i * 4));
    const GRAD = new T.DataTexture(gd, 16, 1, T.RGBAFormat); GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    const RIM = { col: { value: new T.Color('#FFD0AE') }, str: { value: 0.26 } };
    const addRim = (mat, k = 1) => {
      const kU = { value: k }, prev = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
      const prevKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        Object.assign(sh.uniforms, { rimCol: RIM.col, rimStr: RIM.str, rimK: kU });
        sh.fragmentShader = 'uniform vec3 rimCol;\nuniform float rimStr;\nuniform float rimK;\n' + sh.fragmentShader.replace('#include <output_fragment>',
          'float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\noutgoingLight += rimCol * (rimStr * rimK * smoothstep(0.55, 0.95, rimF));\n#include <output_fragment>');
      };
      mat.customProgramCacheKey = () => 'rim1' + (prevKey ? prevKey.call(mat) : '');
      return mat;
    };
    return { GRAD, addRim, own: [GRAD] };
  }
  // патч: цепляется к прежнему onBeforeCompile (ободок, DayNight и т. п.)
  function chain(mat, key, fn) {
    const prev = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
    const prevKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
    mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); fn(sh); };
    mat.customProgramCacheKey = () => key + (prevKey ? prevKey.call(mat) : '');
    return mat;
  }
  // лак: (1) изнанка кузова (двусторонний материал) — обивка салона; (2) «отражение неба»: горизонт по отражённому
  // вектору (над горизонтом светлая полоса, под ним — тёмная земля), сильнее под скользящим углом (френель);
  // (3) жёсткий тун-блик солнца. Всё на лету, без карт окружения: пара десятков операций на пиксель.
  const PAINT_U = { uRefl: { value: 1 }, uSky: { value: null }, uSkyLo: { value: null }, uGround: { value: null }, uInner: { value: null }, uHi: { value: 0.42 } };
  function paintGloss(mat, T) {
    PAINT_U.uSky.value = PAINT_U.uSky.value || new T.Color('#F3E9EE');
    PAINT_U.uSkyLo.value = PAINT_U.uSkyLo.value || new T.Color('#FFF8F2');
    PAINT_U.uGround.value = PAINT_U.uGround.value || new T.Color('#2A1418');
    PAINT_U.uInner.value = PAINT_U.uInner.value || new T.Color('#2C282B');
    return chain(mat, 'sedan2Gloss1', sh => {
      Object.assign(sh.uniforms, PAINT_U);
      sh.fragmentShader = 'uniform float uRefl;\nuniform vec3 uSky;\nuniform vec3 uSkyLo;\nuniform vec3 uGround;\nuniform vec3 uInner;\nuniform float uHi;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat frontK = gl_FrontFacing ? 1.0 : 0.0;\nif (!gl_FrontFacing) diffuseColor.rgb = uInner;')
        .replace('#include <output_fragment>', [
          '{ vec3 vdG = normalize(vViewPosition); vec3 rG = reflect(-vdG, normal); vec3 rW = (vec4(rG, 0.0) * viewMatrix).xyz;',
          ' float hz = rW.y; float band = smoothstep(-0.015, 0.035, hz); float hiSky = smoothstep(0.05, 0.6, hz);',
          ' vec3 env = mix(uGround, mix(uSkyLo, uSky, hiSky), band);',
          ' float fres = pow(1.0 - clamp(dot(normal, vdG), 0.0, 1.0), 2.2);',
          ' float kk = uRefl * frontK * (0.55 + 0.45 * vColor.r);',
          ' outgoingLight *= 1.0 - (1.0 - band) * (0.30 + 0.32 * fres) * kk;',
          ' outgoingLight += band * mix(uSkyLo, uSky, hiSky) * (0.04 + 0.27 * fres) * kk * (0.55 + 0.45 * (1.0 - hiSky));',
          ' float lineR = smoothstep(0.035, 0.06, hz) * (1.0 - smoothstep(0.085, 0.14, hz));',
          ' outgoingLight += uSkyLo * lineR * (0.10 + 0.30 * fres) * kk;',
          ' vec3 ldG = normalize(vec3(0.3, 0.85, 0.45));',
          '#if NUM_DIR_LIGHTS > 0', ' ldG = directionalLights[0].direction;', '#endif',
          ' float spG = max(dot(normal, normalize(ldG + vdG)), 0.0);',
          ' outgoingLight += vec3(smoothstep(0.972, 0.985, spG) * uHi + smoothstep(0.88, 0.97, spG) * uHi * 0.14) * frontK; }',
          '#include <output_fragment>'].join('\n'));
    });
  }
  // фары/фонари: свечение по вершинам (атрибут lgt: 1 фары, 2 задние+стоп, 3 задний ход, 4 поворотники, 5 сетка-соты,
  // 6 светодиодная бровь фары — светится и днём)
  function lightPatch(mat, U) {
    return chain(mat, 'sedan2Lgt1', sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float lgt;\nuniform float uHead;\nuniform float uTail;\nuniform float uBrake;\nuniform float uRev;\nuniform float uTurn;\nvarying vec3 vLgS;\nvarying vec3 vMeshP;\nvarying float vMeshK;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', [
          '#include <begin_vertex>', 'vLgS = vec3(0.0); vMeshP = position; vMeshK = 0.0;',
          'if (lgt > 0.5 && lgt < 1.5) vLgS = vec3(1.0, 0.93, 0.76) * uHead;',
          'else if (lgt > 1.5 && lgt < 2.5) vLgS = vec3(1.0, 0.12, 0.16) * (uTail + uBrake);',
          'else if (lgt > 2.5 && lgt < 3.5) vLgS = vec3(1.0) * uRev;',
          'else if (lgt > 3.5 && lgt < 4.5) vLgS = vec3(1.0, 0.6, 0.2) * uTurn;',
          'else if (lgt > 4.5 && lgt < 5.5) vMeshK = 1.0;',
          'else if (lgt > 5.5 && lgt < 6.5) vLgS = vec3(1.0, 0.98, 0.94) * (0.45 + uHead * 0.55);',
          'else if (lgt > 6.5) vLgS = vec3(1.0, 0.93, 0.76) * max(0.0, uHead - 0.3) * 0.9;'].join('\n'));
      sh.fragmentShader = 'varying vec3 vLgS;\nvarying vec3 vMeshP;\nvarying float vMeshK;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'if (vMeshK > 0.5) {',
          ' vec2 q = vec2(vMeshP.x + vMeshP.z * 0.35, vMeshP.y) * 33.0; vec2 dq = vec2(q.x + q.y * 0.82, q.x - q.y * 0.82);',
          ' vec2 f = abs(fract(dq) - 0.5); float l = min(f.x, f.y); float aa = clamp(length(vViewPosition) * 0.012, 0.02, 0.35);',
          ' float line = 1.0 - smoothstep(0.075, 0.075 + aa, l);',
          ' vec3 cm = mix(diffuseColor.rgb * 0.25, diffuseColor.rgb * 1.45 + 0.035, line);',
          ' diffuseColor.rgb = mix(cm, diffuseColor.rgb * 0.75, smoothstep(0.12, 0.35, aa)); }'].join('\n'))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vLgS;');
    });
  }
  // стекло: тонированное, полупрозрачное (прозрачность по вершинам), два косых блика и светлее кверху (отражение неба)
  function glassStreaks(mat) {
    return chain(mat, 'sedan2Glass1', sh => {
      sh.vertexShader = 'varying vec3 vGpS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGpS = position;');
      sh.fragmentShader = 'varying vec3 vGpS;\n' + sh.fragmentShader.replace('#include <output_fragment>', [
        'float gsS = fract((vGpS.z * 0.62 + vGpS.y * 0.95 + abs(vGpS.x) * 0.25) * 1.1);',
        'float gbS = smoothstep(0.0, 0.02, gsS) * (1.0 - smoothstep(0.08, 0.1, gsS)) + 0.55 * smoothstep(0.15, 0.162, gsS) * (1.0 - smoothstep(0.19, 0.2, gsS));',
        'float skyS = smoothstep(1.3, 1.75, vGpS.y) * 0.08;',
        'outgoingLight = mix(outgoingLight, vec3(1.0), gbS * 0.26 + skyS); diffuseColor.a = min(1.0, diffuseColor.a + gbS * 0.22 + skyS * 0.6);',
        '#include <output_fragment>'].join('\n'));
    });
  }
  // контур со скелетом (как у героини и велосипеда): та же сетка, раздута по нормалям, задние грани
  function outlineMat(T) {
    return new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#3E2C34') } },
      vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    });
  }

  /* ---------- многоугольники: отсечение по полю (Сазерленд — Ходжмен) ---------- */
  // вершина: { p: [x,y,z], n: [x,y,z] }; поле f(p) ≥ 0 — внутри
  function lerpV(a, b, t) {
    const n = [lerp(a.n[0], b.n[0], t), lerp(a.n[1], b.n[1], t), lerp(a.n[2], b.n[2], t)], L = Math.hypot(n[0], n[1], n[2]) || 1;
    return { p: [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)], n: [n[0] / L, n[1] / L, n[2] / L] };
  }
  function clipPoly(poly, fv, keepIn) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], fa = keepIn ? fv[i] : -fv[i], fb = keepIn ? fv[(i + 1) % n] : -fv[(i + 1) % n];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(lerpV(a, b, t)); }
    }
    return out;
  }
  function polyArea(poly) {
    let ax = 0, ay = 0, az = 0;
    for (let i = 1; i < poly.length - 1; i++) {
      const a = poly[0].p, b = poly[i].p, c = poly[i + 1].p;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      ax += uy * vz - uz * vy; ay += uz * vx - ux * vz; az += ux * vy - uy * vx;
    }
    return Math.hypot(ax, ay, az) / 2;
  }

  /* =====================================================================
     МОДЕЛЬ
     ===================================================================== */
  const COL = hex => { const c = new (window.THREE.Color)(hex); return [c.r, c.g, c.b]; };
  function build(T, opts = {}) {
    T = T || window.THREE;
    const H = opts.kit && opts.kit.toon && opts.kit.GRAD ? opts.kit : null;
    const K = H ? { GRAD: H.GRAD, addRim: H.addRim, own: [] } : ownKit(T);
    const own = K.own.slice(), keep = x => { own.push(x); return x; };
    const paintHex = opts.color || '#9A1028';
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    const LITE = !!opts.lite;   // облегчённая сборка для «низкого» качества

    const WHITE = [1, 1, 1], SEAM = [0.17, 0.14, 0.16], BLACK = [0.11, 0.1, 0.11], UNDER = [0.36, 0.31, 0.33];
    const C = {
      chrome: COL('#E9EBF0'), chromeD: COL('#A9ADB8'), frame: COL('#B4B9C4'), tipC: COL('#8E929C'), dark: COL('#26232A'), black: COL('#18161A'), mesh: COL('#232127'),
      housing: COL('#25282F'), housingL: COL('#9AA1AF'), meshD: COL('#151318'), lens: COL('#C9D3DE'), drl: COL('#FFFFFF'), red: COL('#D41E2C'), redIn: COL('#FF7A84'), redD: COL('#4E1219'), amber: COL('#F2A542'), white: COL('#FFFDF6'),
      plate: COL('#E2E5EA'), plateRim: COL('#C9C6C0'),
      rimFace: COL('#4A4952'), rimLip: COL('#B9BBC4'), rimEdge: COL('#8A8C96'), tire: COL('#2E2B31'), caliper: COL('#D81F2C'), disc: COL('#2A282E'), barrel: COL('#0E0D10'), hub: COL('#4A4852'),
      seat: COL('#2F2B2F'), seatIn: COL('#6A202C'), dash: COL('#262327'), dashL: COL('#4A4348'), carpet: COL('#2A2629'),
      mint: COL('#A8D8C4'), rose: COL('#F2B8C6'), mirror: COL('#CFE0EC'), gauge: COL('#F6EBDD'), needle: COL('#D9304E'), rubber: COL('#2A262C'),
    };
    const AP = Acc(T), AG = Acc(T), AT = Acc(T);   // краска, стекло, отделка
    const parts = {}; let partAt = 0;
    const mark = name => { const n = AT.i.length / 3; parts[name] = (parts[name] || 0) + n - partAt; partAt = n; };

    /* ---------- кости ---------- */
    const bones = [], bn = {};
    const bone = (name, parent, p) => { const b = new T.Bone(); b.name = 'sedan_' + name; b.position.set(p[0], p[1], p[2]); if (parent) parent.add(b); bn[name] = bones.length; bones.push(b); return b; };
    const rootB = bone('root', null, [0, 0, 0]);
    const hingeF = P.xM(G.doorF[1]) + 0.012, hingeR = P.xM(G.doorR[1]) + 0.012;
    bone('dFL', rootB, [hingeF, 0.6, G.doorF[1]]); bone('dFR', rootB, [-hingeF, 0.6, G.doorF[1]]);
    bone('dRL', rootB, [hingeR, 0.6, G.doorR[1]]); bone('dRR', rootB, [-hingeR, 0.6, G.doorR[1]]);
    bone('steer', rootB, WHEEL_C);
    const HUB = { fl: [G.TF, G.WR, G.zFA], fr: [-G.TF, G.WR, G.zFA], rl: [G.TR, G.WR, G.zRA], rr: [-G.TR, G.WR, G.zRA] };
    ['fl', 'fr', 'rl', 'rr'].forEach(k => { const pv = bone('p_' + k, rootB, HUB[k]); pv.rotation.order = 'YXZ'; bone('s_' + k, pv, [0, 0, 0]); });
    const B = bn;
    const doorBone = (front, left) => (front ? (left ? B.dFL : B.dFR) : (left ? B.dRL : B.dRR));

    /* ---------- кузов: лофт колец по станциям ---------- */
    const RG = makeRing(LITE), ST = stations(LITE), NSt = ST.length, NH = RG.NH, RL = 2 * NH - 2;
    const yc = z => (z > 0 ? G.ycF : G.ycR);
    // кольца: точки {x,y,z} (полное кольцо: левая половина сверху вниз, правая — снизу вверх)
    const RINGS = ST.map(st => {
      // нос: бампер и щит впереди, кромка капота скругляется назад; корма: губка багажника нависает, бампер уходит под неё.
      // Середина носа (щит) выдаётся вперёд «клювом»: dz = A·exp(−(x/σ)²) на скруглении (на теле — 0)
      const h = RG.half(st.z), c = st.c, cx = c, fr = st.z > 0, y0 = yc(st.z);
      // на самом кончике кольцо сходится в вертикальный отрезок (не в точку): торец плоский, без «веера» к центру
      const cc = Math.max(c, 0.05), cyT = c >= 1 ? 1 : Math.pow(cc, fr ? 0.26 : 0.05), cyB = c >= 1 ? 1 : Math.pow(cc, fr ? 0.2 : 0.07);
      const beak = fr && c < 1 ? 1 - Math.pow(c, 3) : 0;
      // корма: бампер (середина торца по высоте) выступает назад дальше губки багажника — торец «наклонён», как на фото c2/c3
      const bump = !fr && c < 1 ? 1 - c : 0;
      const put = (q, sd) => { const x = sd * q.x * cx, y = y0 + (q.y - y0) * (q.y > y0 ? cyT : cyB);
        return { x, y, z: st.z + beak * 0.105 * Math.exp(-(x * x) / 0.14) * sst(0.15, 0.5, y) * (1 - sst(0.86, 1.0, y)) - bump * (G.zRT - G.zR) * sst(0.22, 0.45, y) * (1 - sst(0.80, 1.02, y)) }; };
      const ring = [];
      for (let j = 0; j < NH; j++) ring.push(put(h[j], 1));
      for (let j = NH - 2; j >= 1; j--) ring.push(put(h[j], -1));
      return ring;
    });
    // нормали: по площадям соседних четырёхугольников (вырожденные — вес 0)
    const NRM = RINGS.map(r => r.map(() => [0, 0, 0]));
    for (let i = 0; i < NSt - 1; i++) for (let j = 0; j < RL; j++) {
      const j2 = (j + 1) % RL, a = RINGS[i][j], b = RINGS[i + 1][j], c = RINGS[i + 1][j2], d = RINGS[i][j2];
      // порядок a → b → c → d смотрит наружу
      const ux = c.x - a.x, uy = c.y - a.y, uz = c.z - a.z, vx = d.x - b.x, vy = d.y - b.y, vz = d.z - b.z;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      [[i, j], [i + 1, j], [i + 1, j2], [i, j2]].forEach(([ii, jj]) => { const N = NRM[ii][jj]; N[0] += nx; N[1] += ny; N[2] += nz; });
    }
    NRM.forEach((r, i) => r.forEach(N => { const L = Math.hypot(N[0], N[1], N[2]); if (L < 1e-9) { N[0] = 0; N[1] = 0; N[2] = ST[i].z > 0 ? 1 : -1; } else { N[0] /= L; N[1] /= L; N[2] /= L; } }));

    // вывод многоугольника (веер)
    function emit(acc, poly, col, bone, lg) {
      if (poly.length < 3 || polyArea(poly) < 1e-7) return;
      const ids = poly.map(v => acc.vert(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], col, bone, lg));
      for (let k = 1; k < ids.length - 1; k++) acc.tri(ids[0], ids[k], ids[k + 1]);
    }
    // области по порядку: { f(p) ≥ 0 — внутри, acc, col, bone }; остаток — def
    function emitRegions(poly, regs, def) {
      let cur = poly;
      for (let r = 0; r < regs.length && cur.length >= 3; r++) {
        const R = regs[r], fv = cur.map(v => R.f(v.p));
        let allIn = true, allOut = true; fv.forEach(f => { if (f >= 0) allOut = false; else allIn = false; });
        if (allOut) continue;
        if (allIn) { emit(R.acc, cur, R.col, R.bone, R.lg); return; }
        emit(R.acc, clipPoly(cur, fv, true), R.col, R.bone, R.lg);
        cur = clipPoly(cur, fv, false);
      }
      if (cur.length >= 3) emit(def.acc, cur, def.col, def.bone, def.lg);
    }
    const g = G.gap;
    const seamZ = z => inR(z, [G.doorF[1], G.doorF[1] + g]) || inR(z, [G.doorF[0] - g, G.doorF[0]]) || inR(z, [G.doorR[1], G.doorR[1] + g]) || inR(z, [G.doorR[0] - g, G.doorR[0]]);
    // стёкла и их чёрная кайма (поля по точке)
    const fWS = p => Math.min(zWSx(p[0]) - p[2], p[2] - zHFx(p[0]), (ghAt(p[2]) ? P.xRE(p[2]) : P.xBelt(p[2])) - G.PW - Math.abs(p[0]));
    const fRW = p => Math.min(p[2] - zRWx(p[0]), zHRx(p[0]) - p[2], wRW(p[2]) - Math.abs(p[0]));
    const glassWS = [0.11, 0.115, 0.14, 0.52], glassSide = [0.09, 0.095, 0.12, 0.5], glassRear = [0.13, 0.14, 0.17, 0.30];   // заднее светлее: героиню видно с камеры-следилки   // заднее светлее: героиню видно с камеры-следилки
    const NT = RG.NT, gS0 = NT - 1, sS0 = NT + 3, bS0 = NT + 3 + RG.NS;
    // отрезки борта (номер отрезка = номер нижней точки в списке S): дверь — до порога, шов, чёрный низ
    const S_DOOR_MAX = LITE ? 5 : 8, S_SEAM = LITE ? 6 : 9, S_ROCK = LITE ? 7 : 11;
    for (let i = 0; i < NSt - 1; i++) {
      const zm = (ST[i].z + ST[i + 1].z) / 2, capd = ST[i].c < 1 || ST[i + 1].c < 1;
      for (let j = 0; j < RL; j++) {
        const j2 = (j + 1) % RL, left = j < NH - 1, h = left ? j : RL - 1 - j;
        const V = (ii, jj) => ({ p: [RINGS[ii][jj].x, RINGS[ii][jj].y, RINGS[ii][jj].z], n: NRM[ii][jj] });
        const poly = [V(i, j), V(i + 1, j), V(i + 1, j2), V(i, j2)];
        if (polyArea(poly) < 1e-7) continue;
        const def = { acc: AP, col: WHITE, bone: 0 };
        const regs = [];
        if (h < gS0) {                                   // верх
          if (!capd && zm > G.zRW - 0.15 && zm < G.zWS + 0.05) {
            regs.push({ f: fWS, acc: AG, col: glassWS, bone: 0 });
            regs.push({ f: p => fWS(p) + G.FRIT, acc: AP, col: BLACK, bone: 0 });
            regs.push({ f: fRW, acc: AG, col: glassRear, bone: 0 });
            regs.push({ f: p => fRW(p) + G.FRIT, acc: AP, col: BLACK, bone: 0 });
          }
        } else if (h < sS0) {                            // боковое остекление и стойки
          const db = zm > G.zBp[1] ? doorBone(true, left) : zm < G.zBp[0] && zm > G.zC0 - 0.05 ? doorBone(false, left) : 0;
          if (inR(zm, G.zBp)) { def.col = BLACK; }
          else {
            const inWin = inR(zm, G.winF) || inR(zm, G.winR);
            if (inWin) {
              const fG = p => Math.min(yDLO(p[2]) - G.FR - p[1], p[1] - P.yBelt(p[2]) - G.SEAL);
              regs.push({ f: fG, acc: AG, col: glassSide, bone: db });
              regs.push({ f: p => yDLO(p[2]) - p[1], acc: AP, col: BLACK, bone: db });
            }
          }
        } else if (h < bS0) {                            // борт
          const s = h - sS0;
          let bone = 0, col = WHITE;
          const front = inR(zm, G.doorF), rear = inR(zm, G.doorR);
          if (s <= S_DOOR_MAX) { if (front || rear) bone = doorBone(front, left); else if (seamZ(zm)) col = SEAM; }
          else if (s === S_SEAM) { if (inR(zm, [G.doorR[0] - g, G.doorF[1] + g])) col = SEAM; }
          else if (s >= S_ROCK && ((zm > G.zRA + G.RA_R - 0.05 && zm < G.zFA - G.RA_F + 0.05) || zm < G.capR + 0.05)) col = BLACK;
          def.col = col; def.bone = bone;
        } else { def.col = capd ? (zm > 0 ? WHITE : BLACK) : UNDER; }   // днище (на скруглениях носа/кормы видно спереди/сзади)
        emitRegions(poly, regs, def);
      }
    }

    /* ---------- зонд для деталей: лучи изнутри наружу по готовой краске ---------- */
    const PT = AP.p.slice(), PN = AP.n.slice(), PI3 = AP.i.slice();
    const triList = pred => { const L = []; for (let k = 0; k < PI3.length; k += 3) { const a = PI3[k] * 3, b = PI3[k + 1] * 3, c = PI3[k + 2] * 3; if (pred(PT[a + 2], PT[b + 2], PT[c + 2], PT[a], PT[b], PT[c])) L.push(k); } return L; };
    const TL = { front: triList((z1, z2, z3) => Math.max(z1, z2, z3) > 1.25), rear: triList((z1, z2, z3) => Math.min(z1, z2, z3) < -1.25), all: triList(() => true) };
    TL.left = triList((z1, z2, z3, x1, x2, x3) => Math.max(x1, x2, x3) > 0.3); TL.right = triList((z1, z2, z3, x1, x2, x3) => Math.min(x1, x2, x3) < -0.3);
    // самое дальнее пересечение луча o + t·d (t > 0) — наружная поверхность; нормаль сглажена по вершинам
    function castOut(o, d, list) {
      let best = -1, bu = 0, bv = 0, bk = -1;
      for (let q = 0; q < list.length; q++) {
        const k = list[q], ia = PI3[k] * 3, ib = PI3[k + 1] * 3, ic = PI3[k + 2] * 3;
        const e1x = PT[ib] - PT[ia], e1y = PT[ib + 1] - PT[ia + 1], e1z = PT[ib + 2] - PT[ia + 2];
        const e2x = PT[ic] - PT[ia], e2y = PT[ic + 1] - PT[ia + 1], e2z = PT[ic + 2] - PT[ia + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, sx = o[0] - PT[ia], sy = o[1] - PT[ia + 1], sz = o[2] - PT[ia + 2];
        const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 0 && t > best) { best = t; bu = u; bv = v; bk = k; }
      }
      if (bk < 0) return null;
      const ia = PI3[bk] * 3, ib = PI3[bk + 1] * 3, ic = PI3[bk + 2] * 3, w = 1 - bu - bv;
      const n = [PN[ia] * w + PN[ib] * bu + PN[ic] * bv, PN[ia + 1] * w + PN[ib + 1] * bu + PN[ic + 1] * bv, PN[ia + 2] * w + PN[ib + 2] * bu + PN[ic + 2] * bv];
      const L = Math.hypot(n[0], n[1], n[2]) || 1;
      return { p: [o[0] + d[0] * best, o[1] + d[1] * best, o[2] + d[2] * best], n: [n[0] / L, n[1] / L, n[2] / L] };
    }
    // лучи: спереди — веером из оси (0, y, 1.25) под углом θ (° , + — влево); сзади — из (0, y, −1.25); сбоку — из оси машины
    const Z0F = 1.25, Z0R = -1.25;
    const rayF = (th, y) => castOut([0, y, Z0F], [Math.sin(th * D2R), 0, Math.cos(th * D2R)], TL.front);
    const rayR = (th, y) => castOut([0, y, Z0R], [Math.sin(th * D2R), 0, -Math.cos(th * D2R)], TL.rear);
    const rayS = (sd, z, y) => castOut([0, y, z], [sd, 0, 0], sd > 0 ? TL.left : TL.right);
    // кромка капота над мордой: самая высокая точка, где луч спереди бьёт в «лицевую» поверхность (нормаль смотрит вперёд)
    const faceTop = (() => {
      const keys = [];
      for (let th = 0; th <= 60; th += 5) {
        const d = [Math.sin(th * D2R), 0, Math.cos(th * D2R)];
        let yE = 0.77;
        for (let y = 1.2; y > 0.55; y -= 0.008) { const h = rayF(th, y); if (h && h.n[0] * d[0] + h.n[2] * d[2] > 0.6) { yE = y; break; } }
        keys.push([th, yE]);
      }
      const f = mono(keys);
      return th => f(Math.abs(th));
    })();
    // наклейка-сетка по двум кромкам A(u), B(u) → [θ|z, y]; строки поперёк; off — отступ по нормали
    function decal(acc, ray, A, B, nu, nv, off, col, bone, lg, rowCol) {
      const grid = [];
      for (let i = 0; i <= nu; i++) {
        const row = [], a = A(i / nu), b = B(i / nu);
        for (let j = 0; j <= nv; j++) {
          const t = j / nv, h = ray(lerp(a[0], b[0], t), lerp(a[1], b[1], t));
          row.push(h ? { p: [h.p[0] + h.n[0] * off, h.p[1] + h.n[1] * off, h.p[2] + h.n[2] * off], n: h.n } : null);
        }
        grid.push(row);
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
        if (q.some(x => !x)) continue;
        // ориентация: наружу (по нормали)
        const a = q[0].p, b = q[1].p, c = q[2].p, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const fn = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], s = fn[0] * q[0].n[0] + fn[1] * q[0].n[1] + fn[2] * q[0].n[2];
        emit(acc, s >= 0 ? q : [q[0], q[3], q[2], q[1]], rowCol ? rowCol(i / nu, (j + 0.5) / nv) : col, bone, lg);
      }
      return grid;
    }
    // трубка по точкам (с отступом по нормали)
    const GE = [];
    const ge = gm => { GE.push(gm); return gm; };
    function tubeAlong(acc, pts, r, segs, radial, col, bone, lg, closed) {
      if (pts.length < 2) return;
      const curve = new T.CatmullRomCurve3(pts.map(q => new T.Vector3(q[0], q[1], q[2])), !!closed);
      acc.geo(ge(new T.TubeGeometry(curve, segs, r, radial || 4, !!closed)), new T.Matrix4(), col, bone, lg);
    }
    const edgePts = (ray, A, n, off) => { const out = []; for (let i = 0; i <= n; i++) { const a = A(i / n), h = ray(a[0], a[1]); if (h) out.push([h.p[0] + h.n[0] * off, h.p[1] + h.n[1] * off, h.p[2] + h.n[2] * off]); } return out; };

    // примитивы (общие, освобождаются в конце сборки)
    const M = (p, r, s, q) => { const m = new T.Matrix4(); return m.compose(new T.Vector3(p[0], p[1], p[2]), q || new T.Quaternion().setFromEuler(new T.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, (r && r[3]) || 'XYZ')), new T.Vector3(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1)); };
    const UP = new T.Vector3(0, 1, 0);
    const qOf = n => {   // поворот: локальная +z — по нормали, +y — как можно ближе к «вверх» мира
      const z = new T.Vector3(n[0], n[1], n[2]).normalize(), ref = Math.abs(z.y) > 0.95 ? new T.Vector3(0, 0, 1) : UP;
      const x = new T.Vector3().crossVectors(ref, z).normalize(), y = new T.Vector3().crossVectors(z, x);
      return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    };
    const pillowCache = new Map();
    function pillow(e = 0.32, res = 1) {   // суперэллипсоид 2×2×2: подушки, корпуса, линзы
      const key = e.toFixed(2) + '|' + res; if (pillowCache.has(key)) return pillowCache.get(key);
      const s = res === 2 ? new T.SphereGeometry(1, 12, 8) : res === 1 ? new T.SphereGeometry(1, 9, 6) : new T.SphereGeometry(1, 7, 4), p = s.attributes.position;
      for (let k = 0; k < p.count; k++) { const f = v => Math.sign(v) * Math.pow(Math.abs(v), e); p.setXYZ(k, f(p.getX(k)), f(p.getY(k)), f(p.getZ(k))); }
      s.computeVertexNormals(); smoothSeams(s); pillowCache.set(key, ge(s)); return s;
    }
    function smoothSeams(gm) {   // нормали в совпадающих точках (шов UV-сферы) — среднее
      const p = gm.attributes.position, n = gm.attributes.normal, map = new Map();
      for (let k = 0; k < p.count; k++) { const key = Math.round(p.getX(k) * 1e4) + ',' + Math.round(p.getY(k) * 1e4) + ',' + Math.round(p.getZ(k) * 1e4); (map.get(key) || map.set(key, []).get(key)).push(k); }
      map.forEach(l => { if (l.length < 2) return; let x = 0, y = 0, z = 0; l.forEach(k => { x += n.getX(k); y += n.getY(k); z += n.getZ(k); }); const L = Math.hypot(x, y, z) || 1; l.forEach(k => n.setXYZ(k, x / L, y / L, z / L)); });
    }
    const CYL = ge(new T.CylinderGeometry(1, 1, 1, LITE ? 8 : 12)), CYLL = ge(new T.CylinderGeometry(1, 1, 1, 7)), BOX = ge(new T.BoxGeometry(1, 1, 1));
    const torus = (r, t, rs, ts) => ge(new T.TorusGeometry(r, t, rs || 5, ts || 18));
    const pil = (acc, col, p, s, r, bone, lg, e, res) => acc.geo(pillow(e, res === undefined ? (LITE ? 0 : 1) : res), M(p, r, [s[0] / 2, s[1] / 2, s[2] / 2]), col, bone, lg);

    /* ---------- нос: щит с сотами и серебряной рамкой, точка вместо значка, фары с бровью, заборники, губа, номер ---------- */
    const lamps = { head: [], tail: [], brake: [] };
    const KPT = {};   // ключевые точки (оси body) — для сверки с фото
    const kpt = (k, h) => { if (h) KPT[k] = h.p.map(v => +v.toFixed(3)); };
    const NU = LITE ? 6 : 10;
    {
      // щит: верх y 0.845 (полуугол 10.4°), остриё y 0.31; бока выпуклые вверху, к острию — почти прямые
      const yT = Math.min(0.775, faceTop(0) - 0.022), yB0 = 0.318, th0 = 9.2;
      const w = v => th0 * Math.pow(Math.sin(clamp(v, 0, 1) * PI / 2), 0.8);
      const yAt = u => lerp(yT, yB0, u), vAt = u => (yAt(u) - yB0) / (yT - yB0);
      decal(AT, rayF, u => [-w(vAt(u)), yAt(u)], u => [w(vAt(u)), yAt(u)], NU, LITE ? 4 : 6, 0.011, C.mesh, 0, 5);
      kpt('shieldTop', rayF(0, yT)); kpt('shieldTip', rayF(0, yB0)); kpt('shieldTL', rayF(th0, yT)); kpt('shieldTR', rayF(-th0, yT));   // чётное число колонок: средняя — по гребню «клюва»
      // серебряная рамка по контуру (верх — с лёгкой «шапочкой» посередине)
      const outline = [], nO = LITE ? 14 : 22;
      for (let i = 0; i <= nO; i++) { const u = i / nO; outline.push([w(vAt(u)), yAt(u)]); }
      for (let i = nO - 1; i >= 1; i--) { const u = i / nO; outline.push([-w(vAt(u)), yAt(u)]); }
      for (let i = 0; i <= 6; i++) { const th = lerp(-th0 * 0.94, th0 * 0.94, i / 6); outline.push([th, yT + 0.012 * (1 - Math.pow(th / th0, 2))]); }
      const op = []; outline.forEach(([th, y]) => { const h = rayF(th, y); if (h) op.push([h.p[0] + h.n[0] * 0.013, h.p[1] + h.n[1] * 0.013, h.p[2] + h.n[2] * 0.013]); });
      tubeAlong(AT, op, LITE ? 0.009 : 0.0075, LITE ? 24 : 44, LITE ? 3 : 4, C.frame, 0, 0, true);
      // гладкая точка вместо значка: красная, в серебряном ободке (без рисунка)
      const hb = rayF(0, yT - 0.045);
      if (hb) {
        const q = qOf(hb.n), base = new T.Vector3(hb.p[0], hb.p[1], hb.p[2]).addScaledVector(new T.Vector3(hb.n[0], hb.n[1], hb.n[2]), 0.016);
        AT.geo(torus(0.032, 0.007, 4, LITE ? 12 : 16), new T.Matrix4().compose(base, q, new T.Vector3(1, 1, 1)), C.frame, 0, 0);
        AT.geo(pillow(0.5, LITE ? 0 : 1), new T.Matrix4().compose(base, q, new T.Vector3(0.028, 0.028, 0.01)), C.red, 0, 0);
      }
      [1, -1].forEach(sd => {
        // фары (фото c1/c4/c5): узкая тёмная линза; внутренний конец острый — у верхнего угла щита, к наружному концу
        // фара толще и скруглена, заходит на крыло; верх — по кромке капота; светодиодная бровь по верху и «подводка» снизу
        // v3 (фото c5/c1): фара — «миндаль»: внутренний конец острый у верхнего угла щита, к наружному концу высокая
        // и скруглённая, заходит на угол крыла (не тянется по крылу назад); верх — по кромке капота
        const thA = 15.5, thB = 50, top = u => faceTop(lerp(thA, thB, u)) - 0.012 - 0.010 * (1 - u);
        const thick = u => (0.046 + 0.14 * Math.pow(u, 0.6) * (1 - Math.pow(u, 5))) * YS, bot = u => top(u) - thick(u) - 0.012 * Math.sin(u * PI) * YS;
        const TH = u => sd * lerp(thA, thB, u);
        const sk = sd > 0 ? 'L' : 'R'; kpt('headIn' + sk, rayF(TH(0), top(0))); kpt('headOut' + sk, rayF(TH(1), (top(1) + bot(1)) / 2)); kpt('headBot' + sk, rayF(TH(0.6), bot(0.6)));
        decal(AT, rayF, u => [TH(u), bot(u)], u => [TH(u), top(u)], LITE ? 7 : 14, LITE ? 3 : 5, LITE ? 0.011 : 0.010, C.housing, 0, 7,
          (u, v) => (u > 0.22 && u < 0.96 && v > 0.12 && v < 0.62 ? C.housingL : C.housing));
        // светодиодная бровь вдоль верхней кромки (светится и днём)
        decal(AT, rayF, u => [TH(lerp(0.06, 0.93, u)), top(lerp(0.06, 0.93, u)) - 0.015], u => [TH(lerp(0.06, 0.93, u)), top(lerp(0.06, 0.93, u)) - 0.005], LITE ? 6 : 12, 1, 0.011, C.drl, 0, 6);
        // нижняя светодиодная «подводка» на внутренней половине
        if (!LITE) decal(AT, rayF, u => [TH(lerp(0.05, 0.5, u)), bot(lerp(0.05, 0.5, u)) + 0.006], u => [TH(lerp(0.05, 0.5, u)), bot(lerp(0.05, 0.5, u)) + 0.014], 6, 1, 0.011, C.drl, 0, 6);
        // линза-прожектор ближе к наружному концу
        const hl = rayF(sd * lerp(thA, thB, 0.7), lerp(top(0.7), bot(0.7), 0.52));
        if (hl) {
          const q = qOf(hl.n), base = new T.Vector3(hl.p[0], hl.p[1], hl.p[2]).addScaledVector(new T.Vector3(hl.n[0], hl.n[1], hl.n[2]), 0.011);
          AT.geo(pillow(0.5, LITE ? 0 : 1), new T.Matrix4().compose(base, q, new T.Vector3(0.036, 0.036, 0.012)), C.lens, 0, 1);
          if (!LITE) AT.geo(torus(0.038, 0.006, 3, 14), new T.Matrix4().compose(base, q, new T.Vector3(1, 1, 1)), C.chromeD, 0, 0);
          lamps.head.push([hl.p[0], hl.p[1], hl.p[2]]);
        }
        // тонкая тёмная кромка по низу фары
        tubeAlong(AT, edgePts(rayF, u => [TH(u), bot(u) - 0.002], LITE ? 8 : 14, 0.009), 0.0035, LITE ? 10 : 18, 3, C.housing, 0, 0);
        // боковые заборники (фото c5/c1): трапеции по бокам нижней половины щита — внутренний край параллелен боку щита
        // (между ними полоса красного бампера), низ ровный, верх поднимается наружу, наружный конец загнут вверх «клюшкой»;
        // толстая чёрная рамка, сетка темнее, чем у щита
        const iTop = 0.395, iBot = 0.225, thIT = th0 * Math.pow(Math.sin(clamp((iTop - yB0) / (yT - yB0), 0, 1) * PI / 2), 0.8) + 3.0, thIB = 5.0;
        const A = u => [sd * lerp(thIB, 34, u), iBot + 0.008 * u + 0.035 * sst(0.78, 1, u)], Bq = u => [sd * lerp(thIT, 36.5, u), iTop + 0.03 * u + 0.08 * sst(0.62, 1, u)];
        decal(AT, rayF, A, Bq, LITE ? 8 : 12, LITE ? 3 : 4, LITE ? 0.011 : 0.010, C.meshD, 0, 5);
        kpt('intakeOB' + sk, rayF(A(1)[0], A(1)[1])); kpt('intakeIT' + sk, rayF(Bq(0)[0], Bq(0)[1])); kpt('intakeIB' + sk, rayF(A(0)[0], A(0)[1])); kpt('intakeOT' + sk, rayF(Bq(1)[0], Bq(1)[1]));
        const ring = []; for (let i = 0; i <= 10; i++) ring.push(Bq(i / 10)); for (let i = 10; i >= 0; i--) ring.push(A(i / 10));
        tubeAlong(AT, edgePts(rayF, i => ring[Math.round(i * (ring.length - 1))], ring.length - 1, 0.009), LITE ? 0.008 : 0.007, LITE ? 22 : 34, 3, C.black, 0, 0, true);
      });
      // губа-сплиттер по низу
      decal(AT, rayF, u => [lerp(-44, 44, u), 0.155], u => [lerp(-44, 44, u), 0.185], LITE ? 10 : 14, 1, LITE ? 0.011 : 0.008, C.black, 0, 0);
      // номер — пустая светлая табличка, сдвинута влево (+x), как у настоящей машины; без букв и цифр
      if (opts.plates === 'both') decal(AT, rayF, u => [lerp(18.5, 31.5, u), 0.545], u => [lerp(18.5, 31.5, u), 0.632], 3, 1, 0.012, C.plate, 0, 0);
    }
    mark('nose');

    /* ---------- корма: фонари на углах, губа-спойлер (в профиле), номер, диффузор, четыре патрубка, стоп-сигнал ---------- */
    [1, -1].forEach(sd => {
      const thA = 14.5, thB = 60, top = u => (1.048 + 0.023 * u - 0.019 * sst(0.88, 1, u)) * YS, bot = u => top(u) - (0.022 + 0.125 * sst(0.0, 0.6, u) * (1 - 0.6 * sst(0.84, 1, u))) * YS;
      const TH = u => sd * lerp(thA, thB, u);
      decal(AT, rayR, u => [TH(u), bot(u)], u => [TH(u), top(u)], LITE ? 6 : 12, LITE ? 2 : 3, 0.007, C.red, 0, 2,
        (u, v) => (v > 0.36 && v < 0.64 && u > 0.3 && u < 0.88 ? C.redIn : u < 0.12 ? C.redD : C.red));
      tubeAlong(AT, edgePts(rayR, u => [TH(u), top(u) + 0.004], LITE ? 8 : 12, 0.009), 0.005, LITE ? 10 : 16, 3, C.redD, 0, 0);
      const hl = rayR(sd * lerp(thA, thB, 0.55), 0.975 * YS);
      if (hl) { lamps.tail.push(hl.p.slice()); lamps.brake.push(hl.p.slice()); }
      // фонарь заднего хода и катафот на бампере
      if (!LITE) decal(AT, rayR, u => [sd * lerp(31, 41, u), 0.42], u => [sd * lerp(31, 41, u), 0.44], 2, 1, 0.006, C.white, 0, 3);
      decal(AT, rayR, u => [sd * lerp(44, 54, u), 0.395], u => [sd * lerp(44, 54, u), 0.42], 2, 1, 0.006, C.redD, 0, 0);
      // патрубки: по два с каждой стороны, по краям диффузора
      [0.50, 0.64].forEach(x => {
        const yE = 0.275, e = castOut([sd * x, yE, Z0R], [0, 0, -1], TL.rear);
        const z = e ? e.p[2] : G.zR + 0.1;
        AT.geo(CYL, M([sd * x, yE, z - 0.005], [PI / 2, 0, 0], [0.046, 0.1, 0.046]), C.tipC, 0, 0);
        AT.geo(CYLL, M([sd * x, yE, z - 0.056], [PI / 2, 0, 0], [0.036, 0.006, 0.036]), C.black, 0, 0);
      });
    });
    {
      // шов крышки багажника между фонарями (тонкая тёмная линия — продолжает верх фонарей)
      if (!LITE) tubeAlong(AT, edgePts(rayR, u => [lerp(-14.5, 14.5, u), (1.048 + 0.003) * YS], 8, 0.008), 0.0032, 12, 3, C.dark, 0, 0);
      // номер (пустой) на бампере
      if (opts.plates !== false) decal(AT, rayR, u => [lerp(-11.8, 11.8, u), 0.705], u => [lerp(-11.8, 11.8, u), 0.82], 6, 3, 0.014, C.plate, 0, 0);
      // диффузор: чёрная полоса во всю ширину с рёбрами (полосы цвета)
      decal(AT, rayR, u => [lerp(-44, 44, u), 0.21], u => [lerp(-44, 44, u), 0.435], LITE ? 9 : 17, 2, 0.008, C.black, 0, 0,
        LITE ? null : u => (Math.abs(u - 0.5) < 0.3 && Math.floor(u * 17) % 2 === 1 ? C.dark : C.black));
      // высокий стоп-сигнал — тонкая полоска под кромкой крыши над задним стеклом
      const yS = P.yTop(G.zHR) - 0.022;
      pil(AT, C.red, [0, yS, G.zHR - 0.02], [0.34, 0.016, 0.03], [-0.4, 0, 0], 0, 2, 0.3, 0);
      lamps.brake.push([0, yS, G.zHR - 0.02]);
      // плавник антенны на крыше
      const zFin = G.zHR + 0.08;
      pil(AT, C.black, [0, P.yTop(zFin) + 0.028, zFin], [0.055, 0.07, 0.17], [-0.12, 0, 0], 0, 0, 0.55, 0);
      // дворники у основания ветрового стекла
      const zW = G.zWS - 0.06;
      [0.06, -0.42].forEach(x => pil(AT, C.black, [x + 0.18, P.yTop(zW) + 0.012, zW], [0.5, 0.014, 0.02], [-0.6, 0, 0.05], 0, 0, 0.4, 0));
    }
    mark('tail');

    /* ---------- борта: жабра за передним колесом, ручки, хромовая линия порога, чёрные зеркала ---------- */
    [1, -1].forEach(sd => {
      const L = sd > 0;
      // жабра: тёмная косая прорезь на крыле за аркой
      const zAr = G.zFA - G.RA_F, vz = u => lerp(zAr - 0.04, zAr - 0.2, u), vyB = u => lerp(0.76, 0.6, u) * YS;
      decal(AT, (z, y) => rayS(sd, z, y), u => [vz(u), vyB(u)], u => [vz(u) + 0.05, vyB(u) + 0.04], 4, 1, 0.006, C.black, 0, 0);
      tubeAlong(AT, edgePts((z, y) => rayS(sd, z, y), u => [vz(u) + 0.002, vyB(u) - 0.004], 4, 0.008), 0.004, 6, 3, C.chromeD, 0, 0);
      // ручки дверей — цвета кузова, с тёмной нишей
      [[-0.26, true], [-1.11, false]].forEach(([zh, front]) => {
        const h = rayS(sd, zh, 0.965 * YS);
        if (!h) return;
        const bD = doorBone(front, L), q = qOf(h.n), pos = new T.Vector3(h.p[0], h.p[1], h.p[2]), nn = new T.Vector3(h.n[0], h.n[1], h.n[2]);
        AT.geo(pillow(0.4, 0), new T.Matrix4().compose(pos.clone().addScaledVector(nn, 0.002), q, new T.Vector3(0.075, 0.022, 0.006)), C.dark, bD, 0);
        AP.geo(ge(new T.CapsuleGeometry(0.014, 0.11, 2, LITE ? 5 : 7)), new T.Matrix4().compose(pos.clone().addScaledVector(nn, 0.018), new T.Quaternion().setFromEuler(new T.Euler(PI / 2, 0, 0)), new T.Vector3(1, 1, 1)), WHITE, bD, 0);
      });
      // хромовая линия по порогу (между арками)
      const sk = []; for (let k = 0; k <= 10; k++) { const z = lerp(G.zRA + G.RA_R + 0.06, G.zFA - G.RA_F - 0.06, k / 10), h = rayS(sd, z, 0.255); if (h) sk.push([h.p[0] + h.n[0] * 0.004, h.p[1], h.p[2]]); }
      tubeAlong(AT, sk, 0.0075, LITE ? 8 : 14, 3, C.chrome, 0, 0);
      // зеркало: чёрный корпус на ножке, стекло назад; на передней двери (кость двери)
      const bF = doorBone(true, L), mz = G.zA0 - 0.13, my = P.yBelt(mz) + 0.075, mx = sd * (P.xBelt(mz) + 0.125);
      pil(AT, C.black, [sd * (P.xBelt(mz) + 0.03), P.yBelt(mz) + 0.03, mz + 0.02], [0.07, 0.07, 0.13], [0, 0, 0], bF, 0, 0.5, 0);
      pil(AT, C.black, [mx, my, mz], [0.235, 0.14, 0.13], [0, sd * 0.1, 0], bF, 0, 0.55, LITE ? 0 : 1);
      pil(AT, C.mirror, [mx + sd * 0.004, my, mz - 0.063], [0.19, 0.11, 0.01], [0, sd * 0.1, 0], bF, 0, 0.35, 0);
      // ниши колёс изнутри: тёмный подкрылок (видно в просвете арки)
      [[G.zFA, G.RA_F, G.TF], [G.zRA, G.RA_R, G.TR]].forEach(([za, ra, tr]) => {
        const lin = ge(new T.CylinderGeometry(ra - 0.004, ra - 0.004, 0.36, LITE ? 10 : 16, 1, true, 0, PI));
        AT.geo(lin, M([sd * (tr - 0.04), G.WR, za], [0, 0, PI / 2]), C.barrel, 0, 0, true);
      });
    });
    mark('sides');

    /* ---------- салон (сквозь тонировку видно силуэты): панель, руль, кресла-ковши, диван, подушки для зверей ---------- */
    const SEATS = { driver: [G.xDrv, G.hipsY - 0.135, G.hipsZ], passenger: [-G.xDrv, G.hipsY - 0.135, G.hipsZ], backL: [0.36, 0.50, -1.22], backR: [-0.36, 0.50, -1.22] };
    {
      const zD = G.zWS - 0.3;
      pil(AT, C.dash, [0, 0.90, zD], [1.62, 0.24, 0.56], [-0.18, 0, 0], 0, 0, 0.3);                     // панель приборов (ниже линии окон)
      pil(AT, C.dash, [0, 0.62, zD + 0.04], [1.5, 0.36, 0.34], null, 0, 0, 0.3);                        // нижняя часть
      pil(AT, C.dashL, [G.xDrv, 0.97, zD - 0.20], [0.42, 0.11, 0.24], null, 0, 0, 0.35);                // козырёк приборов
      if (!LITE) [0.085, -0.085].forEach(dx => AT.geo(CYLL, M([G.xDrv + dx, 0.93, zD - 0.31], [PI / 2 - 0.3, 0, 0], [0.06, 0.012, 0.06]), C.gauge, 0, 0));
      pil(AT, C.dash, [0, 0.34, -0.1], [0.26, 0.26, 1.0], null, 0, 0, 0.3);                             // тоннель с подлокотником
      pil(AT, C.carpet, [0, 0.042, -0.25], [1.6, 0.05, 1.95], null, 0, 0, 0.2);                         // ковёр
      // передние — низкие спортивные ковши: подушка с приподнятым передним краем, спинка откинута (как корпус героини)
      const seat = (x, yTop, zc, front) => {
        const d = front ? 0.5 : 0.48, sw = front ? 0.5 : 0.44, ct = front ? -0.12 : -0.06;
        pil(AT, C.seat, [x, yTop - 0.065, zc], [sw, 0.13, d], [ct, 0, 0], 0, 0, 0.3);
        if (!LITE) pil(AT, C.seatIn, [x, yTop - 0.004, zc + 0.02], [sw * 0.5, 0.02, d * 0.72], [ct, 0, 0], 0, 0, 0.3, 0);
        const bh = front ? 0.6 : 0.5, bz = zc - d / 2 - (front ? 0.09 : 0.07), by = yTop + bh / 2 - 0.04, tilt = front ? -0.31 : -0.3;
        pil(AT, C.seat, [x, by, bz], [sw, bh, 0.14], [tilt, 0, 0], 0, 0, 0.3);
        if (!LITE) pil(AT, C.seatIn, [x, by - 0.02, bz + 0.065], [sw * 0.46, bh * 0.72, 0.02], [tilt, 0, 0], 0, 0, 0.3, 0);
        // низкий встроенный подголовник (над ним видно голову героини с камеры сзади)
        if (front) pil(AT, C.seat, [x, by + bh / 2 + 0.05, bz - 0.04], [0.26, 0.13, 0.11], [tilt, 0, 0], 0, 0, 0.35);
      };
      seat(SEATS.driver[0], SEATS.driver[1], SEATS.driver[2], true); seat(SEATS.passenger[0], SEATS.passenger[1], SEATS.passenger[2], true);
      seat(SEATS.backL[0], SEATS.backL[1], SEATS.backL[2], false); seat(SEATS.backR[0], SEATS.backR[1], SEATS.backR[2], false);
      pil(AT, C.mint, [SEATS.backL[0], SEATS.backL[1] + 0.045, SEATS.backL[2] + 0.02], [0.34, 0.1, 0.34], null, 0, 0, 0.45);
      pil(AT, C.rose, [SEATS.backR[0], SEATS.backR[1] + 0.045, SEATS.backR[2] + 0.02], [0.34, 0.1, 0.34], null, 0, 0, 0.45);
      // руль: обод, три спицы, ступица (без значков) — кость «руль»; колонка — неподвижно
      const wc = new T.Vector3(WHEEL_C[0], WHEEL_C[1], WHEEL_C[2]), wq = new T.Quaternion().setFromEuler(new T.Euler(TILT, 0, 0));
      const wm = (lp, lr, ls) => new T.Matrix4().compose(wc, wq, new T.Vector3(1, 1, 1)).multiply(M(lp, lr, ls));
      AT.geo(torus(WHEEL_RAD, 0.022, LITE ? 4 : 5, LITE ? 14 : 18), wm([0, 0, 0]), C.rubber, B.steer, 0);
      [PI / 2, PI / 2 + PI * 2 / 3, PI / 2 + PI * 4 / 3].forEach(a => { const r0 = 0.03, r1 = WHEEL_RAD - 0.012, mid = (r0 + r1) / 2; AT.geo(BOX, wm([Math.cos(a + PI) * mid, Math.sin(a + PI) * mid, 0.004], [0, 0, a + PI / 2], [0.032, r1 - r0, 0.012]), C.dashL, B.steer, 0); });
      AT.geo(pillow(0.4, 0), wm([0, 0, 0.012], null, [0.046, 0.04, 0.02]), C.dark, B.steer, 0);
      const ax = new T.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
      AT.geo(CYLL, new T.Matrix4().compose(wc.clone().addScaledVector(ax, 0.16), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), ax), new T.Vector3(0.028, 0.3, 0.028)), C.dark, 0, 0);
    }
    const PET_UP = 0.1;
    mark('cabin');

    /* ---------- колёса: шина, диск «телефонный» на пять круглых окон (тёмный), барабан, тормозной диск, красный суппорт ---------- */
    const RR = G.WR * 0.78;
    const tireOf = tw => { const h = tw / 2; return ge(new T.LatheGeometry([[RR + 0.008, -h + 0.005], [G.WR - 0.04, -h], [G.WR - 0.008, -h + 0.015], [G.WR, -h + 0.06], [G.WR, h - 0.06], [G.WR - 0.008, h - 0.015], [G.WR - 0.04, h], [RR + 0.008, h - 0.005]].map(([r, y]) => new T.Vector2(r, y)), LITE ? 12 : 20)); };
    const tireGF = tireOf(G.TWF), tireGR = tireOf(G.TWR);
    const faceG = (() => {
      const nO = LITE ? 18 : 28, nH = LITE ? 7 : 13, sh = new T.Shape();
      for (let i = 0; i <= nO; i++) { const a = i / nO * PI * 2; if (i === 0) sh.moveTo(Math.cos(a) * RR, Math.sin(a) * RR); else sh.lineTo(Math.cos(a) * RR, Math.sin(a) * RR); }
      for (let k = 0; k < 5; k++) {
        const a0 = k / 5 * PI * 2 + PI / 2, cx = Math.cos(a0) * RR * 0.565, cy = Math.sin(a0) * RR * 0.565, hr = RR * 0.322, pth = new T.Path();
        for (let i = 0; i <= nH; i++) { const a = -i / nH * PI * 2; if (i === 0) pth.moveTo(cx + Math.cos(a) * hr, cy + Math.sin(a) * hr); else pth.lineTo(cx + Math.cos(a) * hr, cy + Math.sin(a) * hr); }
        sh.holes.push(pth);
      }
      const gm = new T.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false, curveSegments: 1 });
      // лёгкая «тарелка»: середина глубже
      const p = gm.attributes.position;
      for (let k = 0; k < p.count; k++) { const r = Math.hypot(p.getX(k), p.getY(k)) / RR; p.setZ(k, p.getZ(k) - 0.035 * (1 - r * r)); }
      gm.computeVertexNormals();
      return ge(gm);
    })();
    const ringG = (() => {   // светлые «проточки» вокруг пяти окон диска: плоские кольца по тарелке лица
      const P3 = [], N3 = [], I3 = [], nS = LITE ? 10 : 14, hr = RR * 0.322;
      for (let k = 0; k < 5; k++) {
        const a0 = k / 5 * PI * 2 + PI / 2, cx = Math.cos(a0) * RR * 0.565, cy = Math.sin(a0) * RR * 0.565, b = P3.length / 3;
        for (let i = 0; i < nS; i++) {
          const a = i / nS * PI * 2;
          [hr - 0.001, hr + 0.008].forEach(rr => { const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, r = Math.hypot(x, y) / RR; P3.push(x, y, 0.035 * r * r + 0.0015); N3.push(0, 0, 1); });
          const i0 = b + i * 2, i1 = b + ((i + 1) % nS) * 2;
          I3.push(i0, i0 + 1, i1 + 1, i0, i1 + 1, i1);
        }
      }
      { const nE = LITE ? 18 : 28, b = P3.length / 3;   // светлая кромка обода по краю лица
        for (let i = 0; i < nE; i++) { const a = i / nE * PI * 2; [RR - 0.016, RR - 0.002].forEach(rr => { const r = rr / RR; P3.push(Math.cos(a) * rr, Math.sin(a) * rr, 0.035 * r * r + 0.0015); N3.push(0, 0, 1); });
          const i0 = b + i * 2, i1 = b + ((i + 1) % nE) * 2; I3.push(i0, i0 + 1, i1 + 1, i0, i1 + 1, i1); } }
      const gm = new T.BufferGeometry(); gm.setAttribute('position', new T.Float32BufferAttribute(P3, 3)); gm.setAttribute('normal', new T.Float32BufferAttribute(N3, 3)); gm.setIndex(I3);
      return ge(gm);
    })();
    const barrelG = ge(new T.CylinderGeometry(RR - 0.002, RR - 0.002, 0.22, LITE ? 10 : 14, 1, true));
    const discG = ge(new T.CircleGeometry(RR * 0.78, LITE ? 10 : 14));
    const faceCol = (pos, nor, k) => { const r = Math.hypot(pos.getX(k), pos.getY(k)); return Math.abs(nor.getZ(k)) < 0.6 ? (r > RR - 0.004 ? C.rimLip : C.rimEdge) : C.rimFace; };
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      const sd = k[1] === 'l' ? 1 : -1, hub = HUB[k], spinB = B['s_' + k], pivB = B['p_' + k];
      const W = (lp, lr, ls) => { const base = new T.Matrix4().compose(new T.Vector3(hub[0], hub[1], hub[2]), new T.Quaternion().setFromEuler(new T.Euler(0, sd > 0 ? 0 : PI, 0)), new T.Vector3(1, 1, 1)); return base.multiply(M(lp, lr, ls)); };
      const TW = k[0] === 'f' ? G.TWF : G.TWR;
      AT.geo(k[0] === 'f' ? tireGF : tireGR, W([0, 0, 0], [0, 0, -PI / 2]), C.tire, spinB, 0);
      // лицо диска: локальная +z экструзии → наружу (+x колеса)
      AT.geo(faceG, W([TW / 2 - 0.055, 0, 0], [0, PI / 2, 0]), faceCol, spinB, 0, false, true);
      AT.geo(ringG, W([TW / 2 - 0.055, 0, 0], [0, PI / 2, 0]), C.rimLip, spinB, 0);
      AT.geo(barrelG, W([-0.02, 0, 0], [0, 0, PI / 2]), C.barrel, spinB, 0, true);
      AT.geo(discG, W([0.0, 0, 0], [0, PI / 2, 0]), C.disc, spinB, 0);
      AT.geo(pillow(0.45, 0), W([TW / 2 - 0.05, 0, 0], null, [0.012, 0.04, 0.04]), C.hub, spinB, 0);
      // суппорт: красный, сзади-сверху (на 10 часов), на поворотном кулаке — не вращается
      AT.geo(pillow(0.5, 0), W([0.03, 0.11, -0.11], [0.75, 0, 0], [0.032, 0.09, 0.056]), C.caliper, pivB, 0);
    });
    mark('wheels');
    /* ---------- сетки ---------- */
    const paintGeo = AP.build(false), trimGeo = AT.build(true), glassGeo = AG.build(false);
    GE.forEach(x => x.dispose());
    [paintGeo, trimGeo, glassGeo].forEach(gm => { keep(gm); gm.boundingSphere.radius += 1.3; });
    const gradientMap = K.GRAD;
    const paintMat = keep(paintGloss(K.addRim(new T.MeshToonMaterial({ color: new T.Color(paintHex), vertexColors: true, gradientMap, side: T.DoubleSide }), 0.7), T));
    const U_L = { uHead: { value: 0.22 }, uTail: { value: 0.12 }, uBrake: { value: 0 }, uRev: { value: 0 }, uTurn: { value: 0.12 } };
    const trimMat = keep(lightPatch(K.addRim(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap }), 0.5), U_L));
    const glassMat = keep(glassStreaks(new T.MeshBasicMaterial({ color: 0xFFFFFF, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: T.DoubleSide })));
    glassMat.forceSinglePass = true;   // двусторонняя прозрачность одним проходом
    const olMat = keep(outlineMat(T));
    const root = new T.Group(), body = new T.Group(); root.add(body); root.name = 'sedan'; body.name = 'sedanBody';
    root.userData.dn = 'world';   // DayNight: как обычный предмет мира (не «житель»)
    body.add(rootB);
    const paint = new T.SkinnedMesh(paintGeo, paintMat), outline = new T.SkinnedMesh(paintGeo, olMat), trim = new T.SkinnedMesh(trimGeo, trimMat), glass = new T.SkinnedMesh(glassGeo, glassMat);
    paint.name = 'sedanPaint'; outline.name = 'sedanOutline'; trim.name = 'sedanTrim'; glass.name = 'sedanGlass';
    paint.castShadow = true; paint.receiveShadow = false; trim.castShadow = true; trim.receiveShadow = false;
    outline.castShadow = false; glass.castShadow = false; glass.receiveShadow = false; glass.renderOrder = 3;
    outline.userData.outline = true;
    body.add(paint, outline, trim, glass);
    root.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones);
    paint.bind(skeleton); outline.bind(skeleton, paint.bindMatrix); trim.bind(skeleton, paint.bindMatrix); glass.bind(skeleton, paint.bindMatrix);
    { const bb = paintGeo.boundingBox.clone().expandByScalar(0.03), bbW = new T.Box3(), hv = new T.Vector3();
      paint.raycast = (r, out) => { bbW.copy(bb).applyMatrix4(paint.matrixWorld); if (r.ray.intersectBox(bbW, hv)) { const dd = r.ray.origin.distanceTo(hv); if (dd >= r.near && dd <= r.far) out.push({ distance: dd, point: hv.clone(), object: paint }); } }; }
    outline.raycast = () => {}; trim.raycast = () => {}; glass.raycast = () => {};

    const v3 = a => new T.Vector3(a[0], a[1], a[2]);
    const wheels = {};
    ['fl', 'fr', 'rl', 'rr'].forEach(k => { wheels[k] = { pivot: bones[B['p_' + k]], spin: bones[B['s_' + k]], x: HUB[k][0], y: HUB[k][1], z: HUB[k][2], r: G.WR, front: k[0] === 'f' }; });
    const doors = {
      fl: { bone: bones[B.dFL], hinge: bones[B.dFL].position.clone(), side: 1, max: 1.05, k: 0 },
      fr: { bone: bones[B.dFR], hinge: bones[B.dFR].position.clone(), side: -1, max: 1.05, k: 0 },
      rl: { bone: bones[B.dRL], hinge: bones[B.dRL].position.clone(), side: 1, max: 0.98, k: 0 },
      rr: { bone: bones[B.dRR], hinge: bones[B.dRR].position.clone(), side: -1, max: 0.98, k: 0 },
    };
    const COL_AX = new T.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
    const steeringWheel = { bone: bones[B.steer], center: v3(WHEEL_C), axis: COL_AX.clone(), tilt: TILT, radius: WHEEL_RAD };
    const seats = { driver: v3(SEATS.driver), passenger: v3(SEATS.passenger), backL: v3(SEATS.backL), backR: v3(SEATS.backR) };
    const lights = { head: U_L.uHead, tail: U_L.uTail, brake: U_L.uBrake, rev: U_L.uRev, turn: U_L.uTurn };
    const length = G.zF - G.zR, width = 2 * (P.xM(-1.35) + 0.002), height = P.yTop(-0.25);
    const dims = { length, width, height, wheelBase: G.zFA - G.zRA, track: 2 * G.TF, trackR: 2 * G.TR, wheelR: G.WR, halfW: width / 2, halfL: length / 2, wf: G.zFA, wr: G.zRA, ground: P.yBotS(0), front: G.zF, rear: G.zR };
    const driveCfg = { wb: dims.wheelBase, track: G.TF, wf: G.zFA, wr: G.zRA, halfW: 1.0, halfL: +(length / 2 - 0.03).toFixed(3), wheelR: G.WR, steerMax: STEER_MAX };
    const tris = (paintGeo.index.count * 2 + trimGeo.index.count + glassGeo.index.count) / 3;
    function setDoor(id, k) { const d = doors[id]; if (!d) return; d.k = clamp(k, 0, 1.06); const e = d.k; d.bone.rotation.y = -d.side * d.max * e; }
    const model = {
      group: root, root, body, paint, outline, trim, glass, skeleton, bones, boneIndex: B,
      wheels, steeringWheel, doors, seats, lights, lamps, dims, driveCfg,
      petSeats: { dog: v3([SEATS.backL[0], SEATS.backL[1] + PET_UP, SEATS.backL[2] + 0.02]), cat: v3([SEATS.backR[0], SEATS.backR[1] + PET_UP, SEATS.backR[2] + 0.02]) },
      heroSeat: v3(HERO_SEAT), wheelCenter: v3(WHEEL_C), wheelRel: v3(WHEEL_REL),
      stats: { kp: KPT, parts, stations: NSt, paintTris: paintGeo.index.count / 3, trimTris: trimGeo.index.count / 3, glassTris: glassGeo.index.count / 3, lite: LITE, tris: Math.round(tris), verts: paintGeo.attributes.position.count + trimGeo.attributes.position.count + glassGeo.attributes.position.count, calls: 4, shadowCalls: 2, buildMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) },
      setColor(hex) { paintMat.color.set(hex); },
      setDoor,
      // колёса, руль и кузов по состоянию S (как car.js: x, z, ry, v, steer, spin, pitch, roll, sq)
      pose(S, noRoot) {
        if (!noRoot) { root.position.set(S.x || 0, 0, S.z || 0); root.rotation.y = S.ry || 0; }
        body.rotation.set(S.pitch || 0, 0, S.roll || 0);
        const sq = S.sq || 0; body.position.set(0, -sq * 0.05, 0); body.scale.set(1 + sq * 0.03, 1 - sq * 0.06, 1 + sq * 0.02);
        body.updateMatrix(); _inv.copy(body.matrix).invert();
        poseSt.steer = S.steer || 0; poseSt.spin = S.spin || 0;
        for (let i = 0; i < 4; i++) poseWheel(i);
        steeringWheel.bone.quaternion.setFromAxisAngle(COL_AX, -poseSt.steer * 1.0);
      },
      // подвеска (VILLAGE.drive волны 4 зовёт после place()): k 0 fl, 1 fr, 2 rl, 3 rr; lift — подъём колеса, м
      wheelLift: [0, 0, 0, 0],
      setWheelLift(k, lift) { if (k < 0 || k > 3) return; model.wheelLift[k] = clamp(+lift || 0, -0.2, 0.2); poseWheel(k); },
      dispose() { if (root.parent) root.parent.remove(root); own.forEach(x => { try { x.dispose(); } catch (e) { /* уже */ } }); },
    };
    const _inv = new T.Matrix4(), _m = new T.Matrix4(), _m2 = new T.Matrix4(), _p = new T.Vector3(), _e = new T.Euler(), _one = new T.Vector3(1, 1, 1), _q = new T.Quaternion();
    const WK = ['fl', 'fr', 'rl', 'rr'], poseSt = { steer: 0, spin: 0 };
    // колесо: ступица в осях машины (не кузова: кузов кренится и приседает, колёса стоят на земле), поворот, вращение
    function poseWheel(i) {
      const k = WK[i], w = wheels[k], st = poseSt.steer, inner = (st > 0) === (k === 'fl'), a = w.front ? st * (1 + (inner ? 0.12 : -0.12)) : 0;   // чуть Аккермана
      _q.setFromEuler(_e.set(0, a, 0)); _m.compose(_p.set(w.x, w.y + model.wheelLift[i], w.z), _q, _one);
      _m2.multiplyMatrices(_inv, _m); _m2.decompose(w.pivot.position, w.pivot.quaternion, w.pivot.scale);
      w.spin.rotation.set(poseSt.spin, 0, 0);
    }
    model.pose({ x: 0, z: 0, ry: 0 });
    return model;
  }

  /* =====================================================================
     ЗВУК: гудок седана — «па-пам» (две ноты ниже, чем у купе); G.audioBus уважает «звук выкл»
     ===================================================================== */
  let ownAC = null;
  function hornSound() {
    try {
      const g = window.G; let ac = null, out = null;
      if (g && typeof g.audioBus === 'function') { out = g.audioBus('sfx'); if (!out) return false; ac = out.context; }
      else { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; if (!ownAC) ownAC = new AC(); ac = ownAC; if (ac.state !== 'running') ac.resume(); out = ac.destination; }
      const t = ac.currentTime + 0.01, lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.7; lp.connect(out);
      const note = (t0, f, dur, vol) => ['triangle', 'sawtooth'].forEach((w, i) => {
        const o = ac.createOscillator(), gn = ac.createGain(); o.type = w; o.frequency.setValueAtTime(f * (i ? 1.004 : 1), t0);
        const v = vol * (i ? 0.16 : 1);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(v, t0 + 0.02); gn.gain.setValueAtTime(v, t0 + dur - 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.07);
        o.connect(gn); gn.connect(lp); o.start(t0); o.stop(t0 + dur + 0.12);
      });
      note(t, 370, 0.13, 0.05); note(t + 0.18, 466, 0.2, 0.05);
      // мотор на миг тише (≈ −8 дБ), чтобы «па-пам» было слышно и на полном ходу
      if (window.EngineSound && EngineSound.duck) EngineSound.duck(0.4, 0.55);
      return true;
    } catch (e) { return false; }
  }
  /* =====================================================================
     МАШИНА (совместима с WORLD.makeCar): физика города, двери, фонари
     ===================================================================== */
  function makeCar(arg, o = {}) {
    const H = arg && arg.toon && arg.GRAD ? arg : (o.kit && o.kit.toon ? o.kit : null);
    const T = (H && H.T) || (arg && arg.Mesh && arg.Vector3 ? arg : null) || o.THREE || window.THREE;
    const md = build(T, { kit: H, color: o.color, lite: !!o.lite || o.quality === 'low' });
    const root = md.root, body = md.body;
    const S = { x: o.x || 0, z: o.z || 0, ry: o.ry || 0, v: 0, steer: 0, spin: 0, squash: 0, sq: 0, pitch: 0, roll: 0, bumpT: 0, stuckT: 0, lastBump: -1, edgeIn: false, slideT: 0, braking: false };
    // W6 (желание автора: «машина едет медленно — хочу в 1,5 раза быстрее»): 13,5 м/с (было 9), разгон 7,8 (было 5,2), тормоз 11
    const VMAX = o.vmax || 13.5, VREV = 4, WB = md.dims.wheelBase, SM = STEER_MAX;
    const cfg = { autoBrake: !!o.autoBrake, turnSlow: !!o.turnSlow, coast: o.coast || 3.2, brake: 11, acc: 7.8 };
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('sedan ' + n, e); } });
    // двери и фонари: tick(dt) — явно; иначе сами по реальному времени (из place() и перед отрисовкой)
    const anim = { doors: {}, lastExplicit: -1e9, lastAuto: 0, brakeK: 0, accF: 0, brakeOverride: null, autoLights: o.autoLights !== false, prevV: 0, night: 0, head: null };
    const now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
    function tick(dt, auto) {
      dt = clamp(dt || 0, 0, 0.1);
      for (const id in anim.doors) {   // без Object.keys: ни одного нового массива за кадр
        const a = anim.doors[id]; a.t = Math.min(a.dur, a.t + dt);
        const e = sst(0, 1, a.t / a.dur), k = lerp(a.from, a.to, e), over = a.to > a.from ? Math.sin(Math.min(1, a.t / a.dur) * PI) * 0.035 : 0;
        md.setDoor(id, k + over);
        if (a.t >= a.dur) { md.setDoor(id, a.to); delete anim.doors[id]; if (a.res) a.res(true); }
      }
      if (anim.autoLights && dt > 0) {
        const dv = S.v - anim.prevV; anim.prevV = S.v;
        anim.accF += (dv / dt - anim.accF) * Math.min(1, dt * 12);   // сглаженное ускорение: накат (≈3–4,6 м/с²) — без стоп-сигнала
        const decel = Math.abs(S.v) > 0.3 && -Math.sign(S.v) * anim.accF > 5.5;
        const want = anim.brakeOverride !== null ? anim.brakeOverride : (S.braking || decel ? 1 : 0);
        anim.brakeK += (want - anim.brakeK) * Math.min(1, dt * (want > anim.brakeK ? 18 : 6));
        md.lights.brake.value = anim.brakeK * 1.15;
        md.lights.rev.value += ((S.v < -0.2 ? 0.9 : 0) - md.lights.rev.value) * Math.min(1, dt * 10);
      }
      if (!auto) anim.lastExplicit = now();
    }
    function autoTick() {
      const t = now(); if (t - anim.lastExplicit < 0.25) { anim.lastAuto = t; return; }
      const dt = anim.lastAuto ? t - anim.lastAuto : 0; anim.lastAuto = t;
      if (dt > 0) tick(dt, true);
    }
    // перед отрисовкой краски: двери/фонари по реальному времени и LOD контура (дальше o.outlineDist м — без контура)
    const LOD = { outline: o.outlineDist === undefined ? 30 : o.outlineDist }, _wp = new T.Vector3(), _cp = new T.Vector3();
    md.paint.onBeforeRender = (r, sc, cam) => {
      autoTick();
      if (cam && LOD.outline) { md.root.getWorldPosition(_wp); _cp.setFromMatrixPosition(cam.matrixWorld); md.outline.visible = _cp.distanceTo(_wp) < LOD.outline; }
    };
    function place() { md.pose(S); autoTick(); }
    place();
    function edgeOf() {
      if (o.edge) return o.edge;
      const W = window.WORLD || {}, L = o.layout || W.LAYOUT || {};
      if (L.edge && isFinite(L.edge.x) && isFinite(L.edge.z)) return L.edge;
      if (L.oct && isFinite(L.oct.x1)) return { x: Math.min(L.oct.x1 - 6, L.bounds ? L.bounds.x1 - 4 : 1e9), z: L.oct.zc, ry: PI / 2, r: 6, label: 'Дорога за город', labelNeutral: 'Дорога за город', fallback: true };
      return null;
    }
    const can = o.can || (() => true);
    const ok = (x, z, ry) => { const fx = Math.sin(ry), fz = Math.cos(ry); return can(x + fx * 1.75, z + fz * 1.75) && can(x - fx * 1.7, z - fz * 1.7) && can(x, z); };
    /* ctl: { dir: [dx, dz, mag] (джойстик в мире) | null, thr: -1..1, str: -1..1 (клавиши, + — вправо), brake } → { bumped, edge } */
    const SLIDE = [0.06, -0.06, 0.14, -0.14, 0.26, -0.26], RES = { bumped: false, edge: null };   // без выделений памяти за кадр
    // звук мотора (js/engine_sound.js): голос седана; один объект на машину
    const ES = { kind: 'sedan', speed: 0, vmax: VMAX, throttle: 0, braking: false, onGround: true, driving: true };
    function update(dt, ctl) {
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      let target = 0, delta = 0, braking = false, hasInput = false;
      if (ctl && ctl.dir && ctl.dir[2] > 0.08) {
        hasInput = true;
        const dx = ctl.dir[0], dz = ctl.dir[1], mag = Math.min(1, ctl.dir[2]), a = Math.atan2(dx, dz), err = angDiff(a, S.ry);
        if (Math.abs(err) > 2.1 && S.v < 1.2) { const er = angDiff(a, S.ry + PI); target = -Math.min(VREV, mag * 4.5); delta = clamp(-er * 1.6, -SM, SM); }
        else {
          target = mag * VMAX * (cfg.turnSlow ? 1 - 0.55 * Math.min(1, Math.abs(err) / 1.7) : 1);
          delta = clamp(err * 1.6, -SM, SM);
          if (S.v < 0.3 && Math.abs(err) > 0.4) target = Math.max(target, 2.2);
        }
      } else if (ctl && (ctl.thr || ctl.str)) {
        hasInput = !!ctl.thr;
        target = ctl.thr > 0 ? VMAX * Math.min(1, ctl.thr) : ctl.thr < 0 ? (S.v > 0.6 ? 0 : -VREV) : S.v;
        if (ctl.thr < 0 && S.v > 0.6) braking = true;
        delta = -(ctl.str || 0) * SM;
      }
      if (!hasInput && !(ctl && ctl.brake)) target = 0;
      if (ctl && ctl.brake) { target = 0; braking = true; }
      if (cfg.autoBrake && target > 1.2 && S.v > 0.8) {   // по желанию: старое поведение города — сбавить ход перед бордюром
        const look = Math.min(10, 1.6 + S.v * S.v / 10), k = Math.tan(S.steer) / WB;
        let x = S.x, z = S.z, h = S.ry;
        for (let d = 0.9; d <= look; d += 0.9) { h += 0.9 * k; x += Math.sin(h) * 0.9; z += Math.cos(h) * 0.9; if (!ok(x, z, h)) { target = Math.min(target, Math.max(1.4, Math.sqrt(2 * 5 * Math.max(0, d - 1.2)))); break; } }
      }
      // разгон, тормоз или накат: без газа и без тормоза — только мягкий накат (cfg.coast), тормоз — только по воле игрока
      const slowing = Math.abs(target) < Math.abs(S.v) - 0.01 || (Math.sign(target) !== Math.sign(S.v) && Math.abs(S.v) > 0.05);
      const acc = braking ? cfg.brake : slowing ? (hasInput ? cfg.brake * 0.6 : cfg.coast) : cfg.acc;
      const dv = clamp(target - S.v, -acc * dt, acc * dt); S.v += dv;
      if (Math.abs(S.v) < 0.03 && Math.abs(target) < 0.05) S.v = 0;
      S.braking = braking;
      S.steer += (delta - S.steer) * Math.min(1, dt * 7);
      // W6: предел рыскания от скорости — 1,5 рад/с до 9 м/с, 1,15 рад/с на 13,5 м/с
      const wLim = 1.5 - 0.35 * clamp((Math.abs(S.v) - 9) / 4.5, 0, 1);
      let w = S.v / WB * Math.tan(S.steer); w = clamp(w, -wLim, wLim);
      const nry = S.ry + w * dt, nx = S.x + Math.sin(nry) * S.v * dt, nz = S.z + Math.cos(nry) * S.v * dt;
      let bumped = false;
      if (ok(nx, nz, nry)) { S.x = nx; S.z = nz; S.ry = nry; S.slideT = 0; }
      else {
        let slid = false;
        if (Math.abs(S.v) > 0.3) for (let si = 0; si < SLIDE.length; si++) {
          const dd = SLIDE[si];
          const r2 = nry + dd * Math.sign(S.v), x2 = S.x + Math.sin(r2) * S.v * dt, z2 = S.z + Math.cos(r2) * S.v * dt;
          if (ok(x2, z2, r2)) { S.x = x2; S.z = z2; S.ry = r2; S.v *= 1 - Math.min(0.5, dt * (1.5 + Math.abs(dd) * 6)); slid = true; S.slideT += dt; break; }
        }
        if (!slid) { if (ok(S.x, S.z, nry)) S.ry = nry; bumped = Math.abs(S.v) > 1.2; S.v *= -0.22; }
      }
      if (bumped) { S.squash = 1; S.bumpT = 0; emit('bump', { v: S.v }); }
      const wants = Math.abs(target) > 1;
      S.stuckT = wants && Math.abs(S.v) < 0.4 ? S.stuckT + dt : 0;
      S.spin += S.v * dt / G.WR;
      S.squash = Math.max(0, S.squash - dt * 2.2); S.sq = Math.sin(S.squash * PI * 3) * S.squash * 0.9;
      S.pitch += ((-dv / Math.max(dt, 1e-3)) * 0.005 - S.pitch) * Math.min(1, dt * 6);
      S.roll += (clamp(-w * S.v * 0.01, -0.06, 0.06) - S.roll) * Math.min(1, dt * 5);
      tick(dt);
      md.pose(S);
      let edge = null;
      const E = edgeOf();
      if (E) {
        const d = Math.hypot(S.x - E.x, S.z - E.z), R = E.r || 6;
        if (!S.edgeIn && d < R && Math.abs(S.v) > 0.3) { S.edgeIn = true; edge = Object.assign({ x: E.x, z: E.z }, E, { car: { x: S.x, z: S.z, ry: S.ry } }); emit('edge', edge); }
        else if (S.edgeIn && d > R + 4) S.edgeIn = false;
      }
      // звук мотора: скорость, сколько газа просит игрок (цель / VMAX), тормоз
      if (window.EngineSound) { ES.driving = true; ES.speed = S.v; ES.throttle = Math.abs(target) / VMAX; ES.braking = braking; EngineSound.update(ES, dt); }
      RES.bumped = bumped; RES.edge = edge;
      return RES;
    }
    function reset(path) {
      let best = 0, bd = 1e9;
      path.forEach(([x, z], i) => { const d = Math.hypot(x - S.x, z - S.z); if (d < bd) { bd = d; best = i; } });
      const [x, z] = path[best], [x2, z2] = path[(best + 1) % path.length];
      S.x = x; S.z = z; S.ry = Math.atan2(x2 - x, z2 - z); S.v = 0; S.stuckT = 0; place();
    }
    const heroSeat = md.heroSeat.clone();
    // ровно opt.drive HeroAnim; один и тот же объект каждый кадр (поля обновляются) — без выделений памяти
    // seat 'low' — низкое спортивное кресло (HeroAnim: ноги к педалям pedal, корпус откинут); у ретро-купе этого поля нет
    const DI = { wheel: { x: md.wheelCenter.x - heroSeat.x, y: md.wheelCenter.y - heroSeat.y, z: md.wheelCenter.z - heroSeat.z }, wheelR: WHEEL_RAD, wheelTilt: TILT,
      steer: 0, steerRad: 0, wheelAngle: 0, axis: { x: md.steeringWheel.axis.x, y: md.steeringWheel.axis.y, z: md.steeringWheel.axis.z }, speed: 0,
      seat: 'low', pedal: PEDAL.slice(), recline: 16 };
    function driveInput() {
      DI.steer = clamp(S.steer / STEER_MAX, -1, 1); DI.steerRad = S.steer; DI.wheelAngle = -S.steer; DI.speed = S.v;
      return DI;
    }
    function openDoor(id, open = true, dur) {
      const d = md.doors[id]; if (!d) return Promise.resolve(false);
      const to = open ? 1 : 0;
      if (Math.abs(d.k - to) < 1e-3 && !anim.doors[id]) return Promise.resolve(true);
      const prev = anim.doors[id]; if (prev && prev.res) prev.res(false);
      return new Promise(res => { anim.doors[id] = { from: d.k, to, t: 0, dur: dur || (open ? 0.38 : 0.32), res }; });
    }
    const T3 = T;
    const doorStand = id => {   // где стоять у двери (оси body): снаружи, позади открытой двери
      const d = md.doors[id] || md.doors.fl, front = id === 'fl' || id === 'fr';
      return new T3.Vector3(d.side * (md.dims.halfW + 0.42), 0, front ? -0.17 : -1.05);
    };
    function makeCover() {
      const g = new T3.Group(); body.add(g); g.name = 'sedanCover';
      const toon = (c) => new T3.MeshToonMaterial({ color: new T3.Color(c), gradientMap: md.paint.material.gradientMap });
      const cloth = toon('#EADCD2'), bowM = toon('#E58FA6'), bowD = toon('#C9667E');
      const m = new T3.Mesh(md.paint.geometry, cloth); m.scale.set(1.035, 1.025, 1.015); m.position.y = 0.004; g.add(m);
      const sph = new T3.SphereGeometry(1, 16, 11), cyl = new T3.CylinderGeometry(1, 1, 1, 12);
      const add = (geo, mat, p, s, r) => { const x = new T3.Mesh(geo, mat); x.position.set(p[0], p[1], p[2]); x.scale.set(s[0], s[1], s[2]); if (r) x.rotation.set(r[0], r[1], r[2]); x.castShadow = true; g.add(x); return x; };
      const mzC = G.zA0 - 0.13, myC = P.yBelt(mzC) + 0.075, mxC = P.xBelt(mzC) + 0.125;
      [1, -1].forEach(sd => add(sph, cloth, [sd * mxC, myC, mzC], [0.14, 0.095, 0.09]));                         // зеркала под тканью
      const yTop = md.dims.height + 0.02;
      [-1, 1].forEach(sd => add(sph, bowM, [sd * 0.22, yTop + 0.1, -0.4], [0.24, 0.14, 0.09], [0, 0, sd * 0.45]));
      add(sph, bowD, [0, yTop + 0.09, -0.4], [0.09, 0.09, 0.09]);
      [-1, 1].forEach(sd => add(cyl, bowM, [sd * 0.1, yTop - 0.02, -0.32], [0.03, 0.3, 0.03], [0.25, 0, sd * 0.55]));
      add(cyl, bowM, [0, yTop - 0.04, 0.2], [0.03, 1.4, 0.006], [PI / 2 - 0.1, 0, 0]);   // лента по крыше
      g.visible = false;
      const hide = [md.paint, md.outline, md.glass];
      g.setOn = on => { g.visible = !!on; hide.forEach(x => { x.visible = !on; }); };
      g.dispose = () => { [cloth, bowM, bowD, sph, cyl].forEach(x => x.dispose()); if (g.parent) g.parent.remove(g); };
      return g;
    }
    const car = {
      kind: 'sedan', model: md, root, body, S, update, place, reset, VMAX, edgeOf, driveInput, tick,
      setColor(hex) { md.setColor(hex); },
      paintMesh: md.paint, trimMesh: md.trim, glass: md.glass, outline: md.outline, plate: null,
      wheels: md.wheels, doors: md.doors, seats: md.seats, steeringWheel: md.steeringWheel, lights: md.lights, lamps: md.lamps,
      dims: md.dims, driveCfg: md.driveCfg, stats: md.stats,
      // W7: вид «из-за руля» (оси body): глаза героини в низком кресле (замер по скину: +1,517 над корнем, +0,109 вперёд),
      // руль { c, r, tilt, axis }, руки на ободе «на 10 и 2» (±60° от верха, как HeroAnim) при прямом руле; gripL — левая (+x)
      cockpit: (() => {
        const c = md.wheelCenter, a = PI / 3, g = sd => [c.x + sd * Math.sin(a) * WHEEL_RAD, c.y + Math.cos(TILT) * Math.cos(a) * WHEEL_RAD, c.z + Math.sin(TILT) * Math.cos(a) * WHEEL_RAD];
        return { eye: [heroSeat.x, heroSeat.y + 1.517, heroSeat.z + 0.109], wheel: { c: [c.x, c.y, c.z], r: WHEEL_RAD, tilt: TILT, axis: [0, -Math.sin(TILT), Math.cos(TILT)] }, gripL: g(1), gripR: g(-1) };
      })(),
      heroSeat,
      seatDriver: new T.Vector3(heroSeat.x, heroSeat.y + 0.52, heroSeat.z),   // старый путь main.js: корень = seatDriver.y − 0.52
      seatPass: md.petSeats.cat.clone(),   // кот — сзади справа, на розовой подушке
      seatDog: md.petSeats.dog.clone(),    // собачка — сзади слева, на мятной подушке
      doorL: new T.Vector3(md.dims.halfW + 0.55, 0, -0.1), doorR: new T.Vector3(-md.dims.halfW - 0.55, 0, -0.1),
      setWheelLift: (k, lift) => md.setWheelLift(k, lift),
      openDoor, setDoor: (id, k) => { delete anim.doors[id]; md.setDoor(id, k); }, doorK: id => (md.doors[id] ? md.doors[id].k : 0),
      get doorsBusy() { for (const k in anim.doors) return !!k; return false; },
      doorStand,
      setBrake(k) { anim.brakeOverride = k === null || k === undefined ? null : clamp(+k, 0, 1); },
      setHeadlights(k) { md.lights.head.value = clamp(+k || 0, 0, 2); },
      setNight(k) { anim.night = clamp(+k || 0, 0, 1); md.lights.head.value = lerp(0.22, 1.25, anim.night); md.lights.tail.value = lerp(0.12, 0.55, anim.night); },
      set autoLights(b) { anim.autoLights = !!b; }, get autoLights() { return anim.autoLights; },
      makeCover, lod: LOD,
      on(n, f) { (ev[n] = ev[n] || []).push(f); return () => car.off(n, f); },
      off(n, f) { ev[n] = (ev[n] || []).filter(x => x !== f); },
      horn() { hornSound(); emit('horn', { x: S.x, z: S.z }); return true; },
      dispose() { md.dispose(); },
    };
    // звук мотора: тот же объект — контроллеру посадки (вышла — EngineSound.park: мотор затихает с падением оборотов)
    car.sound = ES;
    return car;
  }

  /* =====================================================================
     ПОСАДКА И ЕЗДА В ГОРОДЕ (API как у WORLD.Car.create), но через двери
     ===================================================================== */
  function create(o = {}) {
    const T = o.THREE || window.THREE, H = o.kit, scene = o.scene, W = window.WORLD || {};
    const L = () => o.layout || W.LAYOUT || {};
    let car = o.car;
    if (!car) {
      const l = L(), sp = o.at || (l.spawnPoints && (l.spawnPoints.sedan || l.spawnPoints.car)) || { x: 8.8, z: 4.75, ry: PI / 2 };
      car = makeCar(H || T, { THREE: T, kit: H, x: sp.x, z: sp.z, ry: sp.ry, color: o.color, vmax: o.vmax, layout: o.layout, autoBrake: o.autoBrake, can: (x, z) => (typeof L().drivable === 'function' ? L().drivable(x, z, 0.98) : true) });
      if (scene) scene.add(car.root);
    }
    const cover = o.cover || (car.makeCover ? car.makeCover() : { setOn() {}, visible: false });
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('sedan ctl ' + n, e); } });
    const st = { mode: 'parked', locked: !!o.locked, covered: null, hero: null, cat: null, dog: null, tween: null, braking: null, brakeDone: null, parents: new Map(), walk: false, sit: 0 };
    const applyCover = () => cover.setOn(st.covered === null ? st.locked : st.covered);
    applyCover();
    const unsub = [car.on('edge', e => emit('edge', e)), car.on('bump', e => emit('bump', e)), car.on('horn', e => emit('horn', e))];
    const local2world = (v, out) => { car.root.updateMatrixWorld(true); out.copy(v); car.body.localToWorld(out); return out; };
    const gy = (x, z) => (typeof o.heightAt === 'function' ? o.heightAt(x, z) || 0 : 0);
    const freeAt = (x, z, r) => {
      if (typeof o.collide === 'function') { const p = o.collide(x, z, r); return Math.hypot(p[0] - x, p[1] - z) < 0.05; }
      const C = o.colliders; if (!C) return true;
      for (const c of C.circles || []) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
      for (const b of C.boxes || []) if (b.noWalk !== false && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
      return true;
    };
    const keepParent = obj => { if (obj && !st.parents.has(obj)) st.parents.set(obj, obj.parent || scene); };
    function canEnter(x, z) { return st.mode === 'parked' && car.root.visible && Math.hypot(car.S.x - x, car.S.z - z) < 3.4 && Math.abs(car.S.v) < 0.3; }
    function petPlan(list, toCar) {
      return list.filter(p => p[0]).map(([obj, seat, door]) => {
        const stand = local2world(car.doorStand(door), new T.Vector3()), seatW = local2world(seat, new T.Vector3());
        return { obj, seat, door, stand, seatW, from: obj.getWorldPosition(new T.Vector3()), toCar };
      });
    }
    function enter(hero, opt = {}) {
      if (st.mode !== 'parked') return Promise.resolve(false);
      if (st.locked) { emit('locked', {}); return Promise.resolve(false); }
      st.hero = hero; st.cat = opt.cat || null; st.dog = opt.dog || null; st.mode = 'enter';
      [hero && hero.root, st.cat, st.dog].forEach(keepParent);
      const stand = local2world(car.doorStand('fl'), new T.Vector3()), seatW = local2world(car.heroSeat, new T.Vector3());
      stand.y = gy(stand.x, stand.z);
      const from = hero.root.getWorldPosition(new T.Vector3());
      const pets = petPlan([[st.cat, car.seatPass, 'rr'], [st.dog, car.seatDog, 'rl']], true);
      return new Promise(res => {
        const fin = () => {
          ['fl', 'rl', 'rr'].forEach(id => car.setDoor(id, 0));
          car.body.attach(hero.root); hero.root.position.copy(car.heroSeat); hero.root.rotation.set(0, 0, 0);
          if (hero.body) hero.body.position.y = 0;
          pets.forEach(p => { car.body.attach(p.obj); p.obj.position.copy(p.seat); p.obj.rotation.set(0, 0, 0); });
          st.tween = null; st.walk = false; st.sit = 1; st.mode = 'drive'; emit('enter', {}); res(true);
        };
        if (opt.instant) { fin(); return; }
        const dWalk = Math.min(1.1, 0.25 + from.distanceTo(stand) / 2.2), dur = dWalk + 1.25;
        const flags = { open: false, close: false, petOpen: false, petClose: false };
        st.tween = { t: 0, dur, tick(k, t) {
          if (t < dWalk) {   // к двери
            const e = sst(0, 1, t / dWalk); st.walk = true;
            hero.root.position.set(lerp(from.x, stand.x, e), lerp(from.y, stand.y, e), lerp(from.z, stand.z, e));
            hero.root.rotation.y = Math.atan2(stand.x - from.x, stand.z - from.z) || car.S.ry;
          } else {
            st.walk = false;
            const u = t - dWalk;
            if (!flags.open) { flags.open = true; car.openDoor('fl', true); }
            hero.root.rotation.y += angDiff(car.S.ry, hero.root.rotation.y) * Math.min(1, 0.18 + u * 2);
            if (u > 0.3) {   // посадка в низкое кресло: сначала присесть на край кресла у двери, потом «въехать» внутрь —
              // голова проходит под кромкой крыши (а не сквозь неё); поза водителя (ноги к педалям) — с самого начала
              const e = clamp((u - 0.3) / 0.6, 0, 1), eD = sst(0, 0.5, e), eI = sst(0.3, 1, e); st.sit = sst(0, 0.4, e);
              hero.root.position.set(lerp(stand.x, seatW.x, eI), lerp(stand.y, seatW.y, eD) - 0.05 * Math.sin(eI * PI), lerp(stand.z, seatW.z, eI));
            }
            if (u > 0.9 && !flags.close) { flags.close = true; car.openDoor('fl', false); }
          }
          pets.forEach((p, i) => {   // кот и собачка: к своей задней двери, прыжок на диван
            const pt = t - 0.15 - i * 0.12, pw = 0.55;
            if (pt < 0) return;
            if (!flags.petOpen && pt > 0.1) { flags.petOpen = true; pets.forEach(q => car.openDoor(q.door, true)); }
            if (pt < pw) { const e = sst(0, 1, pt / pw); p.obj.position.set(lerp(p.from.x, p.stand.x, e), lerp(p.from.y, p.stand.y, e) + Math.abs(Math.sin(e * PI * 3)) * 0.06, lerp(p.from.z, p.stand.z, e)); p.obj.rotation.y = Math.atan2(p.stand.x - p.from.x, p.stand.z - p.from.z) || car.S.ry; }
            else { const e = sst(0, 1, (pt - pw) / 0.45); p.obj.position.set(lerp(p.stand.x, p.seatW.x, e), lerp(p.stand.y, p.seatW.y, e) + Math.sin(e * PI) * 0.45, lerp(p.stand.z, p.seatW.z, e)); p.obj.rotation.y += angDiff(car.S.ry, p.obj.rotation.y) * Math.min(1, e * 1.5); }
            if (pt > pw + 0.55 && !flags.petClose) { flags.petClose = true; pets.forEach(q => car.openDoor(q.door, false)); }
          });
        }, done: fin };
      });
    }
    function exitSpot() {
      const cands = [car.doorStand('fl'), car.doorStand('fr'), new T.Vector3(0, 0, car.dims.front + 0.9), new T.Vector3(0, 0, car.dims.rear - 0.9)];
      const B = L().bounds, inB = p => !B || (p.x > B.x0 + 0.3 && p.x < B.x1 - 0.3 && p.z > B.z0 + 0.3 && p.z < B.z1 - 0.3);
      for (let i = 0; i < cands.length; i++) { const p = local2world(cands[i], new T.Vector3()); if (inB(p) && freeAt(p.x, p.z, 0.3)) return { p, door: i === 1 ? 'fr' : 'fl' }; }
      return { p: local2world(cands[0], new T.Vector3()), door: 'fl' };
    }
    function exit(opt = {}) {
      if (st.mode !== 'drive') return Promise.resolve(null);
      if (Math.abs(car.S.v) > 0.4 && !opt.instant) { if (!st.braking) st.braking = new Promise(r => { st.brakeDone = r; }).then(() => { st.braking = null; return exit(opt); }); return st.braking; }
      st.mode = 'exit'; car.S.v = 0;
      const hero = st.hero, sp = exitSpot(), out = sp.p, ry = car.S.ry;
      out.y = gy(out.x, out.z);
      const seat = local2world(car.heroSeat, new T.Vector3());
      const back = obj => { const p = (obj === hero.root && scene) || st.parents.get(obj) || scene; p.attach(obj); };
      back(hero.root); hero.root.rotation.x = 0; hero.root.rotation.z = 0;
      const petList = [[st.cat, car.seatPass, 'rr'], [st.dog, car.seatDog, 'rl']].filter(p => p[0]);
      const pets = petList.map(([obj, seatL, door], i) => {
        back(obj); obj.rotation.x = obj.rotation.z = 0;
        const stand = local2world(car.doorStand(door), new T.Vector3()); stand.y = gy(stand.x, stand.z);
        const to = new T.Vector3(out.x - Math.cos(ry) * (0.7 + i * 0.5) - Math.sin(ry) * 0.45, out.y, out.z + Math.sin(ry) * (0.7 + i * 0.5) - Math.cos(ry) * 0.45);
        return { obj, door, from: obj.position.clone(), stand, to };
      });
      return new Promise(res => {
        const fin = () => {
          [sp.door, 'rl', 'rr'].forEach(id => car.setDoor(id, 0));
          hero.root.position.copy(out);
          pets.forEach(p => p.obj.position.copy(p.to));
          st.tween = null; st.mode = 'parked'; st.sit = 0; st.hero = st.cat = st.dog = null;
          const r = { x: out.x, z: out.z, ry, pets: pets.map(p => ({ x: p.to.x, z: p.to.z })) };
          emit('exit', r); res(r);
        };
        if (opt.instant) { fin(); return; }
        const flags = { close: false, petClose: false };
        car.openDoor(sp.door, true); if (pets.length) pets.forEach(p => car.openDoor(p.door, true));
        st.tween = { t: 0, dur: 1.25, tick(k, t) {
          const u = t - 0.28;
          // выход из низкого кресла: сначала наружу на высоте кресла (голова под кромкой крыши), потом встать
          if (u > 0) { const e = clamp(u / 0.62, 0, 1), eO = sst(0, 0.7, e), eU = sst(0.5, 1, e); st.sit = 1 - sst(0.55, 0.95, e); hero.root.position.set(lerp(seat.x, out.x, eO), lerp(seat.y, out.y, eU) - 0.05 * Math.sin(Math.min(1, e / 0.7) * PI), lerp(seat.z, out.z, eO)); }
          else hero.root.position.copy(seat);
          if (t > 0.92 && !flags.close) { flags.close = true; car.openDoor(sp.door, false); }
          pets.forEach((p, i) => {
            const pt = t - 0.3 - i * 0.1; if (pt < 0) return;
            if (pt < 0.4) { const e = sst(0, 1, pt / 0.4); p.obj.position.set(lerp(p.from.x, p.stand.x, e), lerp(p.from.y, p.stand.y, e) + Math.sin(e * PI) * 0.4, lerp(p.from.z, p.stand.z, e)); }
            else { const e = sst(0, 1, (pt - 0.4) / 0.35); p.obj.position.set(lerp(p.stand.x, p.to.x, e), p.to.y, lerp(p.stand.z, p.to.z, e)); }
            if (pt > 0.5 && !flags.petClose) { flags.petClose = true; pets.forEach(q => car.openDoor(q.door, false)); }
          });
        }, done: fin };
      });
    }
    const NONE = { bumped: false, edge: null };
    function update(dt, inp) {
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      if (st.tween) { st.tween.t += dt; const k = Math.min(1, st.tween.t / st.tween.dur); st.tween.tick(k, st.tween.t); if (k >= 1 && st.tween) st.tween.done(); }
      // не за рулём: только что ехала — мотор затихает (обороты падают), потом ничего не делает
      if (st.mode !== 'drive' && window.EngineSound && car.sound) EngineSound.park(car.sound, dt);
      if (st.mode !== 'drive') { car.tick(dt); car.place && car.model.pose(car.S); NONE.bumped = false; NONE.edge = null; return NONE; }
      let ctl = inp || null;
      if (st.braking) ctl = { brake: true };
      const r = car.update(dt, ctl);
      if (st.braking && Math.abs(car.S.v) < 0.4 && st.brakeDone) { const f = st.brakeDone; st.brakeDone = null; f(); }
      return r;
    }
    const AS = { speed: 0, sitting: false, sitPose: 'chair', idle: false, turnRate: 0, waving: false, drive: null };   // один объект на кадр
    function animState() {
      const sit = st.mode === 'drive' || ((st.mode === 'enter' || st.mode === 'exit') && st.sit > 0.5);
      AS.speed = st.walk && st.mode === 'enter' ? 1.4 : 0; AS.sitting = !!sit; AS.drive = sit ? car.driveInput() : null;
      return AS;
    }
    const ctl = {
      car, cover, kind: 'sedan',
      get mode() { return st.mode; }, get locked() { return st.locked; }, get covered() { return !!cover.visible; },
      setLocked(b) { st.locked = !!b; applyCover(); },
      setCovered(b) { st.covered = b === null || b === undefined ? null : !!b; applyCover(); },
      _sync: applyCover,
      canEnter, enter, exit, update, animState, driveInput: () => car.driveInput(),
      horn() { if (st.mode !== 'drive') return false; return car.horn(); },
      get seats() { return { driver: car.heroSeat, cat: car.seatPass, dog: car.seatDog, passenger: car.seats.passenger }; },
      get pos() { return { x: car.S.x, z: car.S.z }; }, get speed() { return car.S.v; }, get ry() { return car.S.ry; },
      on(n, f) { (ev[n] = ev[n] || []).push(f); return () => ctl.off(n, f); },
      off(n, f) { ev[n] = (ev[n] || []).filter(x => x !== f); },
      dispose() { unsub.forEach(f => f()); },
    };
    return ctl;
  }

  /* =====================================================================
     ВЫБОР МАШИНЫ: «Жёлтый кабриолет / Красный седан» (W7: id 'coupe' — прежний ключ сохранений, кузов — js/vehicles/cabrio.js)
     ===================================================================== */
  const CHOICES = [
    { id: 'coupe', title: 'Жёлтый кабриолет', note: 'Открытый верх, мотор сзади', color: '#FCD93A',
      make: (H, o) => (window.WORLD && WORLD.makeCar ? WORLD.makeCar(H, o) : null), ctl: o => (window.WORLD && WORLD.Car ? WORLD.Car.create(o) : null) },
    { id: 'sedan', title: 'Красный седан', note: 'Четыре двери, место для всех', color: '#C8102E',
      make: (H, o) => makeCar(H, o), ctl: o => create(o) },
  ];
  function picker(o = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'veh-picker';
    wrap.style.cssText = 'display:flex;gap:10px;padding:4px;font-family:Nunito,system-ui,sans-serif;';
    let cur = o.current || 'coupe';
    const cards = CHOICES.map(c => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = c.id;
      b.style.cssText = 'flex:1;min-height:96px;border:0;border-radius:18px;padding:10px 8px;background:#FFFDF9;color:#3A2E3F;font:inherit;cursor:pointer;box-shadow:0 3px 0 rgba(58,46,63,.14);display:flex;flex-direction:column;align-items:center;gap:6px;';
      const dot = document.createElement('span'); dot.style.cssText = `width:46px;height:22px;border-radius:12px 12px 6px 6px;background:${c.color};box-shadow:inset 0 -5px 0 rgba(0,0,0,.12);`;
      const t = document.createElement('b'); t.textContent = c.title; t.style.cssText = 'font-weight:900;font-size:15px;';
      const n = document.createElement('small'); n.textContent = c.note; n.style.cssText = 'font-weight:700;font-size:11px;color:#6E6272;';
      b.append(dot, t, n);
      b.addEventListener('click', () => { cur = c.id; paint(); if (o.onPick) o.onPick(c.id, c); });
      return b;
    });
    const paint = () => cards.forEach(b => { const on = b.dataset.id === cur; b.style.outline = on ? '3px solid #C2405B' : 'none'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    cards.forEach(b => wrap.appendChild(b)); paint();
    wrap.select = id => { cur = id; paint(); };
    return wrap;
  }

  VEH.sedan = { build, makeCar, create, hornSound, G, HERO_SEAT, WHEEL_REL, TILT, WHEEL_RAD, STEER_MAX, PEDAL, version: 3 };
  VEH.CHOICES = CHOICES;
  VEH.makeCar = (id, H, o) => { const c = CHOICES.find(x => x.id === id) || CHOICES[0]; return c.make(H, o); };
  VEH.createCtl = (id, o) => { const c = CHOICES.find(x => x.id === id) || CHOICES[0]; return c.ctl(o); };
  VEH.picker = picker;
})();
