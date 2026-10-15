/* =====================================================================
   ТРАНСПОРТ: красный седан (волна 4, SEDAN).
   Низкий спортивный четырёхдверный седан «в итальянском духе» для мультяшного мира: длинный капот, короткие свесы,
   мускулистые задние «бёдра», покатая крыша-фастбэк с утиным хвостиком, круглые фары-«глазки», маленькая овальная
   решётка с тремя хромовыми планками (НЕ треугольный щит), без значков, логотипов и надписей марки; номер «10·10»
   на настоящие номера не похож. Мягкая красная тун-краска (#C8102E) с бликом и тёплым ободком, салон карамельной кожи.
   Строится кодом (Three.js r149, офлайн), 4 вызова отрисовки вместе с контуром (+2 в проходе теней):
     краска (SkinnedMesh) · контур (SkinnedMesh, та же сетка) · отделка: салон, хром, фары, колёса (SkinnedMesh) · стёкла.
   Все подвижные части — кости одного скелета, без лишних вызовов: 4 двери (открывается каждая, водительская — «fl»),
   руль, 4 колеса (поворот + вращение). Фары, задние фонари, стоп-сигналы, задний ход — свечение по вершинам
   с uniform-ами (lights.*.value), поэтому стоп-сигнал вспыхивает без пересборки и без вызовов.

   Оси (как у машинки города): +z — вперёд, +x — влево (сторона водителя), y — вверх, y = 0 — земля.
   Размеры (dims): длина 4,84 м, ширина 2,0, высота 1,80, база 2,86, колея 1,62/1,68 (колёса x = ±0,81 / ±0,84), R колеса 0,37.

   API
     VEHICLES.sedan.build(THREE, opts) → model — только модель (без езды):
       opts = { kit (WORLD.createKit — общая тун-рампа и ободок города; без него свои), color ('#C8102E') }
       model.group (= root) → body (тангаж/крен/присед) → кости + 4 сетки; model.body
       model.wheels { fl, fr, rl, rr } — { pivot (Bone: поворот rotation.y), spin (Bone: вращение rotation.x), x, y, z, r }
       model.steeringWheel { bone, center (Vector3, оси body), axis (ось колонки), tilt, radius }
       model.doors { fl, fr, rl, rr } — { bone, hinge, side (+1 лево / −1 право), max (рад), k (0..1) }; fl — водительская
       model.seats { driver, passenger, backL, backR } — Vector3 (оси body), верх подушки, куда садится таз
       model.heroSeat — корень героини за рулём (= центр руля − DRIVE-точка руля, см. driveInput)
       model.lights { head, tail, brake, rev, turn } — uniform-ы { value: 0..1.5 }: яркость свечения
       model.lamps { head: [[x,y,z]×2], tail: [...], brake: [...] } — точки ламп (оси body) для DayNight.addLamp
       model.dims { length, width, height, wheelBase, track, trackR, wheelR, halfW, halfL, wf, wr, ground }
       model.driveCfg — { wb, track, wf, wr, halfW, halfL, wheelR } — ровно поля CFG VILLAGE.drive (передать cfg)
       model.paint / outline / trim / glass — сетки; model.skeleton, model.bones; model.stats { tris, verts, calls }
       model.setColor(hex), model.setDoor(id, k 0..1), model.pose(S) — поставить колёса/руль/кузов, model.dispose()
     VEHICLES.sedan.makeCar(H | THREE, o) → car — машина с ездой, СОВМЕСТИМА с WORLD.makeCar (car.js волны 3):
       o = { x, z, ry, color, can(x,z), vmax (9), edge {x,z,r}, layout, kit, autoBrake (false), turnSlow (false),
             coast (3.2 м/с² — накат без газа), autoLights (true) }
       Поля как у городской машинки: root, body, S {x,z,ry,v,steer,spin,squash,sq,pitch,roll,…}, update(dt, ctl),
         place(), reset(path), setColor, VMAX, edgeOf(), driveInput(), seatDriver, heroSeat, seatPass (кот, сзади справа),
         seatDog (собачка, сзади слева), doorL / doorR (точки у дверей снаружи), on/off('edge'|'bump'|'horn'), horn(),
         paintMesh, trimMesh, glass, outline, plate (null), wheels ({fl,fr,rl,rr} вместо InstancedMesh)
       Своё: kind 'sedan', model, dims, driveCfg, doors, seats, steeringWheel, lights, lamps,
         openDoor(id, open = true, dur) → Promise, setDoor(id, k), doorK(id), tick(dt) (двери и фонари; само тикает
         по реальному времени из place() и перед отрисовкой, если tick() не звали), setBrake(k|null), setHeadlights(k),
         setNight(k 0..1) — фары и габариты ночью, doorStand(id) → Vector3 (оси body: где стоять у двери),
         makeCover() → чехол с бантом на крыше (setOn), dispose()
       ВАЖНО (желание автора): без газа машина только мягко катится (o.coast), сама не тормозит перед бордюром
         (o.autoBrake: false) и не сбавляет ход в повороте (o.turnSlow: false); руль — только от игрока.
     VEHICLES.sedan.create(o) → ctl — посадка и езда в городе, API как у WORLD.Car.create (main.js волны 3), но через
       двери: подходит к водительской двери, дверь открывается, садится, дверь закрывается; кот и собачка — через задние.
       o = { THREE, scene, kit, layout, car?, cover?, color?, at?, colliders? | collide?, locked (false), heightAt? }
       ctl.setLocked(b) / locked · setCovered(b|null) · canEnter(x,z) · enter(hero, { cat, dog, instant }) → Promise<bool>
       ctl.exit({ instant }) → Promise<{ x, z, ry, pets }> · update(dt, input) → { bumped, edge } · horn() · animState()
       ctl.driveInput() · on('edge'|'locked'|'enter'|'exit'|'horn'|'bump', fn) · mode · seats · pos · speed · ry · dispose()
     VEHICLES.CHOICES — [{ id:'coupe', title:'Ретро-купе' }, { id:'sedan', title:'Красный седан' }] (+ make, ctl, note)
     VEHICLES.makeCar(id, H, o) / VEHICLES.createCtl(id, o) — фабрики по выбору игрока
     VEHICLES.picker({ current, onPick }) → HTMLElement — две карточки «Ретро-купе / Красный седан» (мягкие, без брендов)

   Подключение: после three.min.js (и world/kit.js, world/car.js — если есть). Файл самостоятельный.
   ===================================================================== */
(function () {
  'use strict';
  const VEH = window.VEHICLES = window.VEHICLES || {};
  const PI = Math.PI;
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
     ЧЕРТЁЖ (метры, оси body)
     ===================================================================== */
  const G = {
    zF: 2.44, zR: -2.40, zFA: 1.50, zRA: -1.36, WR: 0.37, TF: 0.81, TR: 0.84, RA_F: 0.45, RA_R: 0.46,
    zWS: 0.80, zRW: -1.72, zHF: -0.10, zHR: -1.05,          // основание лобового стекла / заднего; верх лобового / заднего
    capF: 2.16, capR: -2.12, ycF: 0.42, ycR: 0.62,           // скругление носа и кормы (центры схождения)
    doorF: [-0.46, 0.86], doorR: [-1.40, -0.54], gap: 0.014, // двери (z), ширина шва
    winF: [-0.43, 0.80], winR: [-1.36, -0.57],               // боковые стёкла (z)
    sDoor: 0.745,                                            // низ дверей по параметру борта
    hipsY: 0.70, xDrv: 0.42,                                 // таз героини за рулём, ряд водителя (+x — слева)
  };
  // корень героини за рулём (кости HeroAnim: таз в покое на 0.86 над корнем) и руль относительно корня
  const HERO_SEAT = [G.xDrv, G.hipsY - 0.86, -0.36];
  const WHEEL_REL = [0, 0.99, 0.34], TILT = 0.75, WHEEL_RAD = 0.17, STEER_MAX = 0.6;
  const WHEEL_C = [HERO_SEAT[0] + WHEEL_REL[0], HERO_SEAT[1] + WHEEL_REL[1], HERO_SEAT[2] + WHEEL_REL[2]];

  const P = {
    yTop: mono([[-2.40, 0.98], [-2.30, 1.06], [-2.0, 1.09], [-1.72, 1.10], [-1.36, 1.095], [-0.5, 1.065], [0.3, 1.035], [0.8, 1.018], [1.5, 0.95], [2.2, 0.84], [2.44, 0.77]]),
    xTop: mono([[-2.40, 0.80], [-2.1, 0.855], [-1.6, 0.88], [-1.0, 0.868], [0, 0.86], [0.8, 0.86], [1.5, 0.868], [2.1, 0.835], [2.44, 0.78]]),
    xMax: mono([[-2.40, 0.90], [-2.1, 0.955], [-1.5, 0.998], [-1.2, 0.992], [-0.75, 0.945], [-0.1, 0.93], [0.6, 0.935], [1.2, 0.955], [1.6, 0.958], [2.1, 0.93], [2.44, 0.86]]),
    yMax: mono([[-2.4, 0.64], [-1.4, 0.68], [-0.4, 0.62], [0.6, 0.60], [1.6, 0.60], [2.44, 0.56]]),
    yBot: mono([[-2.40, 0.34], [-2.15, 0.25], [-1.85, 0.155], [-1.4, 0.15], [1.7, 0.15], [1.95, 0.16], [2.2, 0.19], [2.44, 0.28]]),
    yCF: mono([[0.8, 1.01], [1.2, 0.955], [1.8, 0.885], [2.2, 0.815], [2.44, 0.75]]),
    yCR: mono([[-2.40, 1.0], [-2.33, 1.135], [-2.15, 1.12], [-1.72, 1.13]]),
    yR: mono([[-1.72, 1.14], [-1.60, 1.31], [-1.45, 1.51], [-1.25, 1.67], [-1.05, 1.75], [-0.7, 1.79], [-0.35, 1.80], [-0.10, 1.79], [0.05, 1.735], [0.25, 1.575], [0.45, 1.38], [0.65, 1.18], [0.80, 1.03]]),
  };
  function archTop(z) {
    const A = [[G.zFA, G.RA_F], [G.zRA, G.RA_R]];
    for (let i = 0; i < 2; i++) { const dz = z - A[i][0], ra = A[i][1]; if (Math.abs(dz) < ra) return G.WR + Math.sqrt(ra * ra - dz * dz); }
    return -1;
  }
  function prof(z) {
    const yTop = P.yTop(z), xTop = P.xTop(z), xMax = P.xMax(z);
    let yMax = P.yMax(z), yBot = P.yBot(z), xBot = xMax - 0.05;
    const a = archTop(z);
    if (a > yBot) { yBot = a; xBot = xMax - 0.012; if (yMax < yBot + 0.07) yMax = yBot + 0.07; }
    const yC = z >= G.zWS - 1e-6 ? P.yCF(z) : z <= G.zRW + 1e-6 ? P.yCR(z) : yTop;
    return { yTop, xTop, xMax, yMax, yBot, xBot, yC };
  }
  // борт (левый, +x): s 0 — плечо (линия окон), 0.5 — самое широкое место, 1 — нижний край (дальше — днище)
  function side(p, s) {
    if (s <= 0.5) { const f = s / 0.5 * PI / 2; return [p.xTop + (p.xMax - p.xTop) * Math.pow(Math.sin(f), 2 / 2.4), p.yMax + (p.yTop - p.yMax) * Math.pow(Math.cos(f), 2 / 2.4)]; }
    const f = (s - 0.5) / 0.5 * PI / 2;
    return [p.xBot + (p.xMax - p.xBot) * Math.pow(Math.cos(f), 2 / 2.2), p.yMax - (p.yMax - p.yBot) * Math.pow(Math.sin(f), 2 / 2.2)];
  }
  // станции вдоль кузова: нос/корма — суперэллипс, гуще у арок, швов дверей и стёкол
  function stations(lite) {
    const L = [];
    const add = (z, c) => L.push({ z, c: c == null ? 1 : c });
    const capZ = (z0, zE, c) => z0 + (zE - z0) * Math.pow(1 - Math.pow(c, 2.6), 1 / 2.6);
    (lite ? [1, 0.96, 0.86, 0.7, 0.45, 0.2, 0] : [1, 0.985, 0.955, 0.91, 0.84, 0.74, 0.6, 0.43, 0.24, 0]).forEach(c => { add(capZ(G.capF, G.zF, c), c); add(capZ(G.capR, G.zR, c), c); });
    const step = lite ? 0.2 : 0.12;
    for (let z = G.capR + step; z < G.capF - 0.04; z += step) add(z);
    [[G.zFA, G.RA_F], [G.zRA, G.RA_R]].forEach(([za, ra]) => {
      const na = lite ? 5 : 8;
      for (let k = -na; k <= na; k++) add(za + ra * 0.985 * Math.sin(k / na * PI / 2));
      add(za - ra - 0.004); add(za + ra + 0.004); add(za - ra + 0.002); add(za + ra - 0.002);
    });
    const g = G.gap;
    [G.doorF[1], G.doorF[1] + g, G.doorF[0], G.doorF[0] - g, G.doorR[1], G.doorR[1] + g, G.doorR[0], G.doorR[0] - g,
      G.winF[0], G.winR[0], G.winR[1], G.zWS, G.zRW, G.zHF, G.zHR].concat(lite ? [0.45, -1.3] : [0.55, 0.3, 0.05, -0.25, -0.75, -1.0, -1.2, -1.55]).forEach(z => add(z));
    L.sort((a, b) => a.z - b.z);
    const out = [];
    L.forEach(s => { const q = out[out.length - 1]; if (q && Math.abs(q.z - s.z) < 0.0015) { if (s.c < q.c) q.c = s.c; return; } out.push(s); });
    return out;
  }

  /* =====================================================================
     НАКОПИТЕЛЬ ГЕОМЕТРИИ: позиции, нормали, цвет, кость (жёсткая привязка), свет (lgt)
     ===================================================================== */
  function Acc(T) {
    const A = { p: [], n: [], c: [], b: [], l: [], i: [], v: 0 };
    A.vert = (x, y, z, nx, ny, nz, col, bone, lg) => { A.p.push(x, y, z); A.n.push(nx, ny, nz); A.c.push(col[0], col[1], col[2]); A.b.push(bone || 0); A.l.push(lg || 0); return A.v++; };
    A.tri = (a, b, c) => { A.i.push(a, b, c); };
    const _v = new T.Vector3(), _n = new T.Vector3(), _nm = new T.Matrix3();
    A.geo = (g, m, col, bone, lg, flip) => {
      const pos = g.attributes.position, nor = g.attributes.normal; _nm.getNormalMatrix(m);
      const base = A.v;
      for (let k = 0; k < pos.count; k++) {
        _v.fromBufferAttribute(pos, k).applyMatrix4(m); _n.fromBufferAttribute(nor, k).applyMatrix3(_nm).normalize();
        if (flip) _n.negate();
        A.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, col, bone, lg);
      }
      const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : pos.count;
      for (let k = 0; k < cnt; k += 3) {
        const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
        if (flip) A.tri(base + a, base + c, base + b); else A.tri(base + a, base + b, base + c);
      }
    };
    A.build = withL => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3));
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
  const HI = { value: 0.34 };
  // блик лака: жёсткое тун-пятно от первого направленного света (или сверху-спереди, если его нет)
  function paintGloss(mat) {
    return chain(mat, 'sedanGloss1', sh => {
      sh.uniforms.uHi = HI;
      sh.fragmentShader = 'uniform float uHi;\n' + sh.fragmentShader.replace('#include <output_fragment>', [
        '{ vec3 vdG = normalize(vViewPosition); vec3 ldG = normalize(vec3(0.3, 0.85, 0.45));',
        '#if NUM_DIR_LIGHTS > 0', ' ldG = directionalLights[0].direction;', '#endif',
        ' float spG = max(dot(normal, normalize(ldG + vdG)), 0.0);',
        ' float hlG = smoothstep(0.962, 0.978, spG) * uHi + smoothstep(0.86, 0.96, spG) * uHi * 0.16;',
        ' outgoingLight += vec3(hlG) * vColor.r; }', '#include <output_fragment>'].join('\n'));
    });
  }
  // фары/фонари: свечение по вершинам (атрибут lgt: 1 фары, 2 задние+стоп, 3 задний ход, 4 поворотники)
  function lightPatch(mat, U) {
    return chain(mat, 'sedanLgt1', sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float lgt;\nuniform float uHead;\nuniform float uTail;\nuniform float uBrake;\nuniform float uRev;\nuniform float uTurn;\nvarying vec3 vLgS;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', [
          '#include <begin_vertex>', 'vLgS = vec3(0.0);',
          'if (lgt > 0.5 && lgt < 1.5) vLgS = vec3(1.0, 0.92, 0.72) * uHead;',
          'else if (lgt > 1.5 && lgt < 2.5) vLgS = vec3(1.0, 0.13, 0.17) * (uTail + uBrake);',
          'else if (lgt > 2.5 && lgt < 3.5) vLgS = vec3(1.0) * uRev;',
          'else if (lgt > 3.5) vLgS = vec3(1.0, 0.6, 0.2) * uTurn;'].join('\n'));
      sh.fragmentShader = 'varying vec3 vLgS;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vLgS;');
    });
  }
  // стекло: голубоватое, полупрозрачное, с двумя косыми бликами (координаты модели — блик едет вместе с дверью)
  function glassStreaks(mat) {
    return chain(mat, 'sedanGlass1', sh => {
      sh.vertexShader = 'varying vec3 vGpS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGpS = position;');
      sh.fragmentShader = 'varying vec3 vGpS;\n' + sh.fragmentShader.replace('#include <output_fragment>', [
        'float gsS = fract((vGpS.z * 0.62 + vGpS.y * 0.95 + abs(vGpS.x) * 0.25) * 1.25);',
        'float gbS = smoothstep(0.0, 0.025, gsS) * (1.0 - smoothstep(0.1, 0.125, gsS)) + 0.6 * smoothstep(0.17, 0.185, gsS) * (1.0 - smoothstep(0.215, 0.23, gsS));',
        'outgoingLight = mix(outgoingLight, vec3(1.0), gbS * 0.5); diffuseColor.a = min(1.0, diffuseColor.a + gbS * 0.3);',
        '#include <output_fragment>'].join('\n'));
    });
  }
  // контур со скелетом (как у героини и велосипеда): та же сетка, раздута по нормалям, задние грани
  function outlineMat(T) {
    return new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    });
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
    const paintHex = opts.color || '#C8102E';
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);

    const WHITE = [1, 1, 1], SEAM = [0.2, 0.17, 0.19], BLACK = [0.13, 0.12, 0.14], UNDER = [0.34, 0.3, 0.33];
    const C = {
      chrome: COL('#EEF0F5'), chromeD: COL('#B9BCC8'), rubber: COL('#3A3340'), dark: COL('#2E2830'), liner: COL('#2A2430'),
      lensH: COL('#FFF8E6'), redL: COL('#FF8A8E'), pupil: COL('#D9E0E8'), amber: COL('#F7B267'), red: COL('#E23A4A'), redD: COL('#6A2A36'), white: COL('#FFFDF6'),
      leather: COL('#CF9A6B'), leatherL: COL('#F1DEC6'), leatherD: COL('#A8754C'), plum: COL('#5A4450'), plumD: COL('#46363F'), dash: COL('#4E4250'),
      card: COL('#E3C9AD'), cardTop: COL('#6A4E5C'), roofIn: COL('#EDE3D6'), pillarIn: COL('#D9CDBF'), gauge: COL('#F6EBDD'), needle: COL('#D9304E'),
      mint: COL('#A8D8C4'), rose: COL('#F2B8C6'), rim: COL('#DCDFE6'), rimD: COL('#9EA2AE'), hubD: COL('#4A4552'), disc: COL('#8E8A92'), caliper: COL('#4B4650'), ink: COL('#3A2E3F'), mirror: COL('#CFE0EC'),
    };
    const AP = Acc(T), AG = Acc(T), AT = Acc(T);   // краска, стекло, отделка
    const parts = {}; let partAt = 0;
    const mark = name => { const n = AT.i.length / 3; parts[name] = (parts[name] || 0) + n - partAt; partAt = n; };
    const LITE = !!opts.lite;   // облегчённая сборка для «низкого» качества (≈ вдвое меньше треугольников)

    /* ---------- кости ---------- */
    const bones = [], bn = {};
    const bone = (name, parent, p) => { const b = new T.Bone(); b.name = 'sedan_' + name; b.position.set(p[0], p[1], p[2]); if (parent) parent.add(b); bn[name] = bones.length; bones.push(b); return b; };
    const rootB = bone('root', null, [0, 0, 0]);
    const hingeF = P.xMax(G.doorF[1]) + 0.012, hingeR = P.xMax(G.doorR[1]) + 0.012;
    bone('dFL', rootB, [hingeF, 0.6, G.doorF[1]]); bone('dFR', rootB, [-hingeF, 0.6, G.doorF[1]]);
    bone('dRL', rootB, [hingeR, 0.6, G.doorR[1]]); bone('dRR', rootB, [-hingeR, 0.6, G.doorR[1]]);
    bone('steer', rootB, WHEEL_C);
    const HUB = { fl: [G.TF, G.WR, G.zFA], fr: [-G.TF, G.WR, G.zFA], rl: [G.TR, G.WR, G.zRA], rr: [-G.TR, G.WR, G.zRA] };
    ['fl', 'fr', 'rl', 'rr'].forEach(k => { const pv = bone('p_' + k, rootB, HUB[k]); pv.rotation.order = 'YXZ'; bone('s_' + k, pv, [0, 0, 0]); });
    const B = bn;   // индексы костей
    const doorBone = (front, left) => (front ? (left ? B.dFL : B.dFR) : (left ? B.dRL : B.dRR));

    /* ---------- кузов: «корыто» (борта + днище + капот/багажник), открытое сверху над салоном ---------- */
    const ST = stations(LITE);
    const NT = LITE ? 6 : 8, NBOT = LITE ? 3 : 6;
    const SG = LITE ? [0, 0.12, 0.3, 0.5, 0.64, G.sDoor - 0.012, G.sDoor, 0.9, 1.0] : [0, 0.07, 0.16, 0.27, 0.38, 0.5, 0.58, 0.66, G.sDoor - 0.012, G.sDoor, 0.84, 0.92, 1.0];
    function uRing(st) {
      const z = st.z, c = st.c, p = prof(z), yc = z > 0 ? G.ycF : G.ycR, out = [];
      const put = (x, y, reg, s) => out.push({ x: x * c, y: yc + (y - yc) * c, z, reg, s, c });
      for (let i = 0; i <= NT; i++) { const x = p.xTop * (1 - 2 * i / NT), ax = Math.abs(x) / p.xTop; put(x, p.yC + (p.yTop - p.yC) * Math.pow(ax, 2.4), 'T', i === 0 || i === NT ? 0 : -1); }
      for (let j = 1; j < SG.length; j++) { const q = side(p, SG[j]); put(-q[0], q[1], 'R', SG[j]); }
      for (let k = 1; k < NBOT; k++) put(-p.xBot + 2 * p.xBot * k / NBOT, p.yBot, 'B', 2);
      for (let j = SG.length - 1; j >= 1; j--) { const q = side(p, SG[j]); put(q[0], q[1], 'L', SG[j]); }
      return out;
    }
    const U = ST.map(uRing), RU = U[0].length, NS = ST.length;
    // нормали по сетке (центральные разности); у кончиков носа и кормы — вдоль оси
    function gridNormals(R, closed, tipF, tipR) {
      const N = [];
      for (let i = 0; i < R.length; i++) {
        const row = [], n = R[i].length;
        for (let j = 0; j < n; j++) {
          const jp = closed ? (j + 1) % n : Math.min(n - 1, j + 1), jm = closed ? (j - 1 + n) % n : Math.max(0, j - 1);
          const ip = Math.min(R.length - 1, i + 1), im = Math.max(0, i - 1);
          const a = R[i][jp], b = R[i][jm], c = R[ip][j], d = R[im][j];
          const tr = [a.x - b.x, a.y - b.y, a.z - b.z], tz = [c.x - d.x, c.y - d.y, c.z - d.z];
          let nx = tr[1] * tz[2] - tr[2] * tz[1], ny = tr[2] * tz[0] - tr[0] * tz[2], nz = tr[0] * tz[1] - tr[1] * tz[0];
          let L = Math.hypot(nx, ny, nz);
          if (L < 1e-9 || (tipR && i === 0) || (tipF && i === R.length - 1)) { nx = 0; ny = 0; nz = i === 0 ? -1 : 1; L = 1; }
          row.push([nx / L, ny / L, nz / L]);
        }
        N.push(row);
      }
      return N;
    }
    const NU = gridNormals(U, true, true, true);
    // днище темнее; на скруглениях носа и кормы (видно спереди/сзади) — мягче, чтобы не было «чёрного подбородка»
    const vShade = q => (q.reg === 'B' || q.s >= 0.999 ? lerp(1, 0.36, sst(0.62, 0.98, q.c)) : 1);
    function quad(acc, R, N, i, j, j2, col, bone, inner, off, shade) {
      const pts = [[i, j], [i, j2], [i + 1, j2], [i + 1, j]].map(([a, b]) => {
        const q = R[a][b], n = N[a][b], sh = shade ? shade(q) : 1;
        const s = inner ? -1 : 1, o = inner ? -off : 0;
        return acc.vert(q.x + n[0] * o, q.y + n[1] * o, q.z + n[2] * o, n[0] * s, n[1] * s, n[2] * s, [col[0] * sh, col[1] * sh, col[2] * sh], bone, 0);
      });
      if (inner) { acc.tri(pts[0], pts[2], pts[1]); acc.tri(pts[0], pts[3], pts[2]); }
      else { acc.tri(pts[0], pts[1], pts[2]); acc.tri(pts[0], pts[2], pts[3]); }
    }
    const g = G.gap;
    const seamZ = z => inR(z, [G.doorF[1], G.doorF[1] + g]) || inR(z, [G.doorF[0] - g, G.doorF[0]]) || inR(z, [G.doorR[1], G.doorR[1] + g]) || inR(z, [G.doorR[0] - g, G.doorR[0]]);
    for (let i = 0; i < NS - 1; i++) {
      const zm = (ST[i].z + ST[i + 1].z) / 2, cabin = zm > G.zRW && zm < G.zWS;
      for (let j = 0; j < RU; j++) {
        const j2 = (j + 1) % RU, a = U[i][j], b = U[i][j2];
        const kind = a.reg === 'T' && b.reg === 'T' ? 'top' : (a.reg === 'B' || b.reg === 'B') ? 'bot' : 'side';
        if (kind === 'top' && cabin) continue;
        let bone = 0, col = WHITE;
        const left = a.x + b.x > 0, sm = kind === 'side' ? (Math.max(0, a.s) + Math.max(0, b.s)) / 2 : 2;
        if (kind === 'bot') col = UNDER;
        else if (kind === 'side') {
          if (sm < G.sDoor - 0.012) {
            if (inR(zm, G.doorF)) bone = doorBone(true, left); else if (inR(zm, G.doorR)) bone = doorBone(false, left);
            else if (seamZ(zm)) col = SEAM;
          } else if (sm < G.sDoor && inR(zm, [G.doorR[0] - g, G.doorF[1] + g])) col = SEAM;
        }
        quad(AP, U, NU, i, j, j2, col, bone, false, 0, vShade);
        // изнанка салона: обивка дверей и бортов (сверху тёмная полоса, ниже — светлая кожа)
        if (kind === 'side' && cabin && sm < 0.92) quad(AT, U, NU, i, j, j2, sm < 0.13 ? C.cardTop : sm > 0.7 ? C.plumD : C.card, bone, true, 0.045);
      }
    }

    mark('inner_lower');
    /* ---------- верх салона: стойки, крыша, стёкла (те же станции) ---------- */
    const TG = LITE ? [0, 0.3, 0.6, 0.84, 0.93, 1.0] : [0, 0.18, 0.36, 0.54, 0.70, 0.84, 0.93, 1.0], NA = LITE ? 5 : 7;
    function gRing(z) {
      const p = prof(z), yT = p.yTop, xT = p.xTop, yR = Math.max(P.yR(z), yT + 0.004);
      const h = yR - yT, cr = Math.min(0.11, 0.3 * h + 0.004), yE = yR - cr, rise = Math.max(0, yE - yT), xE = xT - rise * 0.30;
      const out = [], bulK = Math.min(1, rise / 0.3);
      const sx = t => lerp(xT, xE, t) + Math.sin(PI * t) * 0.018 * bulK;
      TG.forEach(t => out.push({ x: sx(t), y: lerp(yT, yE, t), z, reg: 'S', t, sd: 1 }));
      const n = 2.6, wP = z < G.zHR ? 0.16 : 0.085;
      const xa = th => xE * Math.pow(Math.max(0, Math.cos(th)), 2 / n), ya = th => yE + cr * Math.pow(Math.max(0, Math.sin(th)), 2 / n);
      const th1 = Math.acos(Math.pow(clamp((xE - wP) / xE, 0, 1), n / 2));
      const ths = [th1]; for (let k = 1; k <= NA; k++) ths.push(th1 + (PI / 2 - th1) * k / NA);
      ths.forEach((th, k) => out.push({ x: xa(th), y: ya(th), z, reg: 'A', k, sd: 1 }));
      for (let k = ths.length - 2; k >= 0; k--) out.push({ x: -xa(ths[k]), y: ya(ths[k]), z, reg: 'A', k, sd: -1 });
      for (let q = TG.length - 1; q >= 0; q--) out.push({ x: -sx(TG[q]), y: lerp(yT, yE, TG[q]), z, reg: 'S', t: TG[q], sd: -1 });
      return out;
    }
    const GI = []; ST.forEach((s, i) => { if (s.z >= G.zRW - 1e-6 && s.z <= G.zWS + 1e-6) GI.push(i); });
    const GR = GI.map(i => gRing(ST[i].z)), NGR = gridNormals(GR, false, false, false), RG = GR[0].length;
    const glassCol = COL('#D5EAF5'), roofGlassCol = COL('#9DB8CC');
    for (let i = 0; i < GR.length - 1; i++) {
      const zm = (GR[i][0].z + GR[i + 1][0].z) / 2;
      for (let j = 0; j < RG - 1; j++) {
        const a = GR[i][j], b = GR[i][j + 1], left = a.x + b.x > 0;
        let glass = false, col = WHITE, bone = 0, roofIn = false, roofGl = false;
        if (a.reg === 'S' && b.reg === 'S') {
          const tm = (a.t + b.t) / 2;
          if (inR(zm, [G.doorF[0], G.zWS + 0.01])) bone = doorBone(true, left); else if (inR(zm, G.doorR)) bone = doorBone(false, left);
          if (tm < 0.93 && (inR(zm, G.winF) || inR(zm, G.winR))) glass = true;
          else if (bone || inR(zm, [G.doorR[1], G.doorF[0]])) col = BLACK;           // рамки дверей и средняя стойка — чёрные
          else if (inR(zm, [G.doorR[0] - g, G.doorR[0]])) col = SEAM;
        } else if (a.reg === 'S' || b.reg === 'S') { /* стойки и водосток крыши — цвет кузова */ }
        else if (zm > G.zHF) glass = true; else if (zm < G.zHR) glass = true;
        // W4A: панорамная стеклянная крыша (рамка цвета кузова по краям) — героиню за рулём видно и с камеры сзади-сверху
        else if (opts.glassRoof !== false && a.reg === 'A' && b.reg === 'A' && Math.min(a.k, b.k) >= 2 && zm > G.zHR + 0.08 && zm < G.zHF - 0.08) { glass = true; roofGl = true; }
        else roofIn = true;
        if (glass) quad(AG, GR, NGR, i, j, j + 1, roofGl ? roofGlassCol : glassCol, bone, false, 0);
        else {
          quad(AP, GR, NGR, i, j, j + 1, col, bone, false, 0);
          quad(AT, GR, NGR, i, j, j + 1, roofIn ? C.roofIn : C.pillarIn, bone, true, 0.03);
        }
      }
    }

    mark('inner_upper');
    /* ---------- зонд для деталей: луч по готовой краске ---------- */
    const probeGeo = AP.build(false), probe = new T.Mesh(probeGeo, new T.MeshBasicMaterial({ side: T.DoubleSide }));
    probe.updateMatrixWorld(true);
    const rc = new T.Raycaster(), _o = new T.Vector3(), _d = new T.Vector3();
    const hit = (ox, oy, oz, dx, dy, dz) => { rc.set(_o.set(ox, oy, oz), _d.set(dx, dy, dz).normalize()); const h = rc.intersectObject(probe, false)[0]; return h ? { p: h.point.clone(), n: h.face.normal.clone() } : null; };
    const Z = new T.Vector3(0, 0, 1);
    const M = (p, r, s, q) => { const m = new T.Matrix4(); return m.compose(new T.Vector3(p[0], p[1], p[2]), q || new T.Quaternion().setFromEuler(new T.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, (r && r[3]) || 'XYZ')), new T.Vector3(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1)); };
    const UP = new T.Vector3(0, 1, 0);
    const qOf = n => {   // поворот: локальная +z — по нормали, +y — как можно ближе к «вверх» мира
      const z = n.clone().normalize(), ref = Math.abs(z.y) > 0.95 ? new T.Vector3(0, 0, 1) : UP;
      const x = new T.Vector3().crossVectors(ref, z).normalize(), y = new T.Vector3().crossVectors(z, x);
      return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    };
    const onSurf = (h, out, lp, lr, ls) => { // матрица детали на поверхности
      const base = new T.Matrix4().compose(h.p.clone().addScaledVector(h.n, out), qOf(h.n), new T.Vector3(1, 1, 1));
      return base.multiply(M(lp || [0, 0, 0], lr, ls));
    };
    // примитивы (общие, освобождаются в конце сборки)
    const GE = [];
    const ge = g => { GE.push(g); return g; };
    const pillowCache = new Map();
    function pillow(e = 0.32, lo) {   // суперэллипсоид 2×2×2: мягкие подушки, панели, линзы (lo — салон, 10×6)
      const key = e.toFixed(2) + (lo ? 'l' : ''); if (pillowCache.has(key)) return pillowCache.get(key);
      const s = lo ? new T.SphereGeometry(1, 10, 6) : new T.SphereGeometry(1, 12, 8), p = s.attributes.position;
      for (let k = 0; k < p.count; k++) { const f = v => Math.sign(v) * Math.pow(Math.abs(v), e); p.setXYZ(k, f(p.getX(k)), f(p.getY(k)), f(p.getZ(k))); }
      s.computeVertexNormals(); smoothSeams(s); pillowCache.set(key, ge(s)); return s;
    }
    function smoothSeams(gm) {   // нормали в совпадающих точках (шов UV-сферы) — среднее
      const p = gm.attributes.position, n = gm.attributes.normal, map = new Map();
      for (let k = 0; k < p.count; k++) { const key = Math.round(p.getX(k) * 1e4) + ',' + Math.round(p.getY(k) * 1e4) + ',' + Math.round(p.getZ(k) * 1e4); (map.get(key) || map.set(key, []).get(key)).push(k); }
      map.forEach(l => { if (l.length < 2) return; let x = 0, y = 0, z = 0; l.forEach(k => { x += n.getX(k); y += n.getY(k); z += n.getZ(k); }); const L = Math.hypot(x, y, z) || 1; l.forEach(k => n.setXYZ(k, x / L, y / L, z / L)); });
    }
    const SPH = ge(new T.SphereGeometry(1, 12, 8)), SPHL = ge(new T.SphereGeometry(1, 8, 5)), CYL = ge(new T.CylinderGeometry(1, 1, 1, 12)), CYLL = ge(new T.CylinderGeometry(1, 1, 1, 7));
    const BOX = ge(new T.BoxGeometry(1, 1, 1));
    const torus = (r, t, rs, ts) => ge(new T.TorusGeometry(r, t, rs || 6, ts || 22));
    const tube = (pts, r, seg) => ge(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => new T.Vector3(q[0], q[1], q[2]))), seg || Math.max(4, pts.length * 2), r, 5, false));
    const pil = (acc, col, p, s, r, bone, lg, e, hi) => acc.geo(pillow(e, !hi), M(p, r, [s[0] / 2, s[1] / 2, s[2] / 2]), col, bone, lg);

    /* ---------- нос: фары-«глазки», решётка (овал + три планки), воздухозаборники, сплиттер, поворотники ---------- */
    const lamps = { head: [], tail: [], brake: [] };
    [1, -1].forEach(sd => {
      const h = hit(sd * 0.63, 0.72, 4, 0, 0, -1);
      if (h) {
        AT.geo(SPH, onSurf(h, -0.012, [0, 0, 0], null, [0.128, 0.098, 0.05]), C.lensH, 0, 1);
        AT.geo(SPHL, onSurf(h, 0.022, [-sd * 0.012, -0.004, 0], null, [0.052, 0.046, 0.012]), C.pupil, 0, 1);
        AT.geo(torus(0.128, 0.017, 4, 20), onSurf(h, 0.0, [0, 0, 0], null, [1, 0.77, 1]), C.chrome, 0, 0);
        lamps.head.push([h.p.x, h.p.y, h.p.z]);
      }
      const t = hit(sd * 0.70, 0.46, 4, 0, 0, -1);
      if (t) AT.geo(pillow(0.4, true), onSurf(t, 0.004, [0, 0, 0], null, [0.05, 0.022, 0.014]), C.amber, 0, 4);
      const ik = hit(sd * 0.56, 0.31, 4, 0, 0, -1);
      if (ik) { AT.geo(pillow(0.3, true), onSurf(ik, -0.004, [0, 0, 0], null, [0.13, 0.04, 0.02]), C.dark, 0, 0); AT.geo(torus(0.13, 0.008, 3, 16), onSurf(ik, 0.004, [0, 0, 0], null, [1, 0.32, 1]), C.chromeD, 0, 0); }
    });
    {
      const h = hit(0, 0.5, 4, 0, 0, -1);
      if (h) {
        AT.geo(SPH, onSurf(h, -0.012, [0, 0, 0], null, [0.2, 0.09, 0.03]), C.dark, 0, 0);
        AT.geo(torus(0.2, 0.016, 4, 22), onSurf(h, 0.004, [0, 0, 0], null, [1, 0.47, 1]), C.chrome, 0, 0);
        [[-0.042, 0.3], [0, 0.36], [0.042, 0.3]].forEach(([y, w]) => AT.geo(CYLL, onSurf(h, 0.012, [0, y, 0], [0, 0, PI / 2], [0.008, w, 0.008]), C.chrome, 0, 0));
      }
      const sp = hit(0, 0.21, 4, 0, 0, -1);
      if (sp) pil(AT, C.dark, [0, 0.175, sp.p.z - 0.06], [1.42, 0.035, 0.14], null, 0, 0, 0.25);
    }
    mark('nose');
    /* ---------- корма: фонари, стоп-сигнал, задний ход, номер «10·10», диффузор, четыре патрубка ---------- */
    [1, -1].forEach(sd => {
      const h = hit(sd * 0.6, 0.9, -4, 0, 0, 1);
      if (h) {
        AT.geo(pillow(0.36, true), onSurf(h, -0.004, [0, 0, 0], null, [0.185, 0.078, 0.03]), C.redD, 0, 0);
        AT.geo(pillow(0.36), onSurf(h, 0.008, [0, 0, 0], null, [0.168, 0.064, 0.025]), C.red, 0, 2);
        AT.geo(pillow(0.4, true), onSurf(h, 0.02, [sd * 0.035, 0.004, 0], null, [0.09, 0.03, 0.012]), C.redL, 0, 2);
        lamps.tail.push([h.p.x, h.p.y, h.p.z]); lamps.brake.push([h.p.x, h.p.y, h.p.z]);
      }
      const r = hit(sd * 0.3, 0.43, -4, 0, 0, 1);
      if (r) AT.geo(pillow(0.4, true), onSurf(r, 0.004, [0, 0, 0], null, [0.055, 0.022, 0.012]), C.white, 0, 3);
      [0.38, 0.5].forEach(x => {
        const e = hit(sd * x, 0.33, -4, 0, 0, 1);
        const z = e ? e.p.z + 0.03 : G.zR + 0.1;
        AT.geo(CYL, M([sd * x, 0.24, z - 0.01], [PI / 2, 0, 0], [0.045, 0.14, 0.045]), C.chrome, 0, 0);
        AT.geo(CYLL, M([sd * x, 0.24, z - 0.081], [PI / 2, 0, 0], [0.033, 0.006, 0.033]), C.dark, 0, 0);
      });
    });
    {
      const strip = []; for (let k = 0; k <= 12; k++) { const x = lerp(0.4, -0.4, k / 12), h2 = hit(x, 0.9, -4, 0, 0, 1); if (h2) strip.push([h2.p.x, h2.p.y, h2.p.z - 0.006]); }
      if (strip.length > 3) AT.geo(tube(strip, 0.012, 16), new T.Matrix4(), C.chrome, 0, 0);
      const yL = P.yCR(-2.3);
      pil(AT, C.red, [0, yL + 0.008, -2.31], [0.36, 0.016, 0.035], null, 0, 2, 0.3);
      lamps.brake.push([0, yL + 0.01, -2.31]);
      const h = hit(0, 0.66, -4, 0, 0, 1);
      if (h) {
        const n = h.n, base = h.p.clone().addScaledVector(n, 0.006);
        AT.geo(pillow(0.25, true), onSurf(h, 0.002, [0, 0, 0], null, [0.2, 0.068, 0.008]), C.white, 0, 0);
        // цифры «10·10» (для зрителя сзади слева направо: +x → −x), обычные фигуры — без текстур
        const q = qOf(n);
        const glyph = (gm, wx, s) => { const m = new T.Matrix4().compose(base.clone().add(new T.Vector3(wx, 0, 0)), q, new T.Vector3(s[0], s[1], s[2])); AT.geo(gm, m, C.ink, 0, 0); };
        const ring0 = torus(0.03, 0.0075, 4, 16);
        glyph(BOX, 0.125, [0.012, 0.085, 0.006]); glyph(ring0, 0.072, [0.72, 1.18, 1]); glyph(SPHL, 0, [0.009, 0.009, 0.004]);
        glyph(BOX, -0.05, [0.012, 0.085, 0.006]); glyph(ring0, -0.103, [0.72, 1.18, 1]);
      }
      const d = hit(0, 0.25, -4, 0, 0, 1);
      if (d) pil(AT, C.dark, [0, 0.2, d.p.z + 0.08], [1.2, 0.07, 0.22], null, 0, 0, 0.25);
      // высокий стоп-сигнал позади заднего стекла и тёмные полоски у оснований стёкол
      pil(AT, C.dark, [0, P.yR(G.zWS) - 0.012, G.zWS - 0.012], [1.62, 0.035, 0.07], null, 0, 0, 0.3);
      pil(AT, C.dark, [0, P.yR(G.zRW) - 0.01, G.zRW + 0.01], [1.66, 0.03, 0.06], null, 0, 0, 0.3);
      // дворники (в покое у основания лобового)
      [0.18, -0.32].forEach(x => pil(AT, C.dark, [x, P.yR(0.74) + 0.006, 0.74], [0.52, 0.016, 0.022], [-0.7, 0, 0.06], 0, 0, 0.4));
    }
    mark('tail');
    /* ---------- борта: зеркала (на передних дверях), ручки, хромовая линия окон, тёмный порог ---------- */
    [1, -1].forEach(sd => {
      const L = sd > 0;
      const mh = hit(sd * 2, 1.0, 0.62, -sd, 0, 0);
      if (mh) {
        const bF = doorBone(true, L), c0 = mh.p.clone(), cH = c0.clone().add(new T.Vector3(sd * 0.15, 0.1, -0.03));
        AT.geo(tube([[c0.x, c0.y, c0.z], [(c0.x + cH.x) / 2, c0.y + 0.03, c0.z - 0.01], [cH.x - sd * 0.04, cH.y - 0.02, cH.z]], 0.018, 6), new T.Matrix4(), C.dark, bF, 0);
        AP.geo(pillow(0.36), M([cH.x, cH.y, cH.z], [0, sd * 0.12, 0], [0.105, 0.065, 0.055]), WHITE, bF, 0);
        AT.geo(pillow(0.3, true), M([cH.x + sd * 0.004, cH.y, cH.z - 0.05], [0, sd * 0.12, 0], [0.088, 0.05, 0.008]), C.mirror, bF, 0);
      }
      [[-0.30, true], [-1.20, false]].forEach(([zh, front]) => {
        const h = hit(sd * 2, 0.93, zh, -sd, 0, 0);
        if (!h) return;
        const bD = doorBone(front, L), q = qOf(h.n);
        const m1 = new T.Matrix4().compose(h.p.clone().addScaledVector(h.n, 0.004), q, new T.Vector3(0.085, 0.026, 0.008)); AT.geo(pillow(0.4, true), m1, C.dark, bD, 0);
        AT.geo(ge(new T.CapsuleGeometry(0.016, 0.12, 2, 6)), M([h.p.x + h.n.x * 0.024, h.p.y + h.n.y * 0.024, h.p.z + h.n.z * 0.024], [PI / 2, 0, 0]), C.chrome, bD, 0);
      });
      const belt = (z0, z1, front) => { const pts = []; for (let k = 0; k <= 10; k++) { const z = lerp(z0, z1, k / 10); pts.push([sd * (P.xTop(z) + 0.004), P.yTop(z) + 0.006, z]); } AT.geo(tube(pts, 0.011, 14), new T.Matrix4(), C.chrome, doorBone(front, L), 0); };
      belt(G.winF[1] - 0.01, G.doorF[0] + 0.015, true); belt(G.doorR[1] - 0.015, G.doorR[0] + 0.015, false);
      const sk = []; for (let k = 0; k <= 12; k++) { const z = lerp(G.zRA + G.RA_R + 0.03, G.zFA - G.RA_F - 0.03, k / 12), p = prof(z); sk.push([sd * (p.xBot + 0.012), p.yBot + 0.035, z]); }
      AT.geo(tube(sk, 0.032, 16), new T.Matrix4(), C.rubber, 0, 0);
      // арки изнутри: тёмные полуцилиндры (видно вогнутую сторону)
      [[G.zFA, G.RA_F, G.TF], [G.zRA, G.RA_R, G.TR]].forEach(([za, ra, tr]) => {
        const lin = ge(new T.CylinderGeometry(ra + 0.004, ra + 0.004, 0.44, 18, 1, true, 0, PI));
        AT.geo(lin, M([sd * (tr - 0.02), G.WR, za], [0, 0, PI / 2]), C.liner, 0, 0, true);
        pil(AT, C.liner, [sd * (tr - 0.2), G.WR + 0.12, za], [0.04, 0.78, 2 * ra + 0.04], null, 0, 0, 0.2);
      });
    });

    mark('sides');
    /* ---------- салон ---------- */
    pil(AT, C.plum, [0, 0.12, -0.86], [1.68, 0.06, 1.42], null, 0, 0, 0.2);                // пол (ковёр) сзади
    pil(AT, C.plum, [0, 0.075, 0.27], [1.66, 0.07, 0.86], null, 0, 0, 0.2);                // ниша для ног впереди (ниже)
    pil(AT, C.plumD, [0, 0.38, 0.68], [1.64, 0.52, 0.08], null, 0, 0, 0.25);               // стенка ног под панелью
    pil(AT, C.plumD, [0, 0.74, -1.62], [1.66, 0.6, 0.08], null, 0, 0, 0.25);               // стенка за задним диваном
    pil(AT, C.dash, [0, 1.07, -1.66], [1.6, 0.04, 0.2], null, 0, 0, 0.25);                 // полка под задним стеклом
    [1, -1].forEach(sd => {                                                                 // пороги изнутри
      pil(AT, C.plumD, [sd * 0.82, 0.24, (G.doorF[0] + G.doorF[1]) / 2 - 0.05], [0.08, 0.22, 1.22], null, 0, 0, 0.3);
      pil(AT, C.plumD, [sd * 0.82, 0.24, (G.doorR[0] + G.doorR[1]) / 2], [0.08, 0.22, 0.84], null, 0, 0, 0.3);
      pil(AT, C.chromeD, [sd * 0.86, 0.3, -0.5], [0.05, 0.02, 2.0], null, 0, 0, 0.3);
    });
    // панель приборов: основная, козырёк приборов перед водителем, два круглых прибора, центральная консоль
    pil(AT, C.dash, [0, 0.8, 0.5], [1.62, 0.36, 0.6], [-0.12, 0, 0], 0, 0, 0.3);
    pil(AT, C.leatherD, [0, 0.66, 0.24], [1.5, 0.08, 0.12], null, 0, 0, 0.3);
    pil(AT, C.dash, [G.xDrv, 0.975, 0.33], [0.44, 0.13, 0.26], null, 0, 0, 0.3);
    [0.09, -0.09].forEach(dx => {
      AT.geo(CYL, M([G.xDrv + dx, 0.93, 0.205], [PI / 2, 0, 0], [0.068, 0.02, 0.068]), C.gauge, 0, 0);
      AT.geo(torus(0.07, 0.009, 3, 14), M([G.xDrv + dx, 0.93, 0.197], null, null), C.chromeD, 0, 0);
      AT.geo(BOX, M([G.xDrv + dx + 0.02, 0.945, 0.19], [0, 0, 0.75], [0.005, 0.05, 0.004]), C.needle, 0, 0);
    });
    pil(AT, C.dash, [0, 0.66, 0.31], [0.34, 0.42, 0.18], [-0.15, 0, 0], 0, 0, 0.3);
    [0.07, -0.07].forEach(dx => { AT.geo(torus(0.04, 0.011, 4, 16), M([dx, 0.8, 0.205], null, null), C.chrome, 0, 0); AT.geo(CYLL, M([dx, 0.8, 0.21], [PI / 2, 0, 0], [0.032, 0.01, 0.032]), C.dark, 0, 0); });
    pil(AT, C.plumD, [0, 0.36, -0.26], [0.26, 0.24, 0.92], null, 0, 0, 0.3);
    AT.geo(CYLL, M([0, 0.52, 0.02], null, [0.012, 0.12, 0.012]), C.chromeD, 0, 0);
    AT.geo(SPH, M([0, 0.59, 0.02], null, [0.03, 0.03, 0.03]), C.chrome, 0, 0);
    // кресла: подушка, спинка с боковинами, подголовник (впереди — ковши, сзади — два места для кота и собачки)
    const seat = (x, yTop, zc, back, frontRow) => {
      const cz = zc, d = frontRow ? 0.5 : 0.48, sw = frontRow ? 0.5 : 0.42;
      pil(AT, C.leather, [x, yTop - 0.065, cz], [sw, 0.13, d], [-0.06, 0, 0], 0, 0, 0.3);
      if (!LITE) pil(AT, C.leatherL, [x, yTop - 0.002, cz + 0.02], [sw * 0.6, 0.02, d * 0.75], [-0.06, 0, 0], 0, 0, 0.3);
      const bz = cz - d / 2 - 0.08, bh = frontRow ? 0.72 : 0.6, by = yTop + bh / 2 - 0.05, tilt = frontRow ? -0.2 : -0.26;
      pil(AT, C.leather, [x, by, bz], [sw, bh, 0.15], [tilt, 0, 0], 0, 0, 0.3);
      if (!LITE) pil(AT, C.leatherL, [x, by, bz + 0.07], [sw * 0.56, bh * 0.8, 0.03], [tilt, 0, 0], 0, 0, 0.3);
      if (!LITE) [1, -1].forEach(s2 => pil(AT, C.leatherD, [x + s2 * (sw / 2 - 0.025), by - 0.04, bz + 0.06], [0.08, bh * 0.72, 0.16], [tilt, 0, s2 * 0.05], 0, 0, 0.32));
      const hy = by + bh / 2 + 0.11, hz = bz - (bh / 2 + 0.11) * Math.tan(-tilt) - 0.01;
      pil(AT, C.leather, [x, hy, hz], [0.28, 0.18, 0.11], [tilt, 0, 0], 0, 0, 0.3);
      if (!LITE) [0.08, -0.08].forEach(dx => AT.geo(CYLL, M([x + dx, hy - 0.12, hz + 0.01], [tilt, 0, 0], [0.01, 0.1, 0.01]), C.chromeD, 0, 0));
    };
    const SEATS = { driver: [G.xDrv, 0.565, -0.27], passenger: [-G.xDrv, 0.565, -0.27], backL: [0.37, 0.64, -1.12], backR: [-0.37, 0.64, -1.12] };
    seat(SEATS.driver[0], SEATS.driver[1], SEATS.driver[2], true, true); seat(SEATS.passenger[0], SEATS.passenger[1], SEATS.passenger[2], true, true);
    seat(SEATS.backL[0], SEATS.backL[1], SEATS.backL[2], true, false); seat(SEATS.backR[0], SEATS.backR[1], SEATS.backR[2], true, false);
    // подушки для кота и собачки на заднем сиденье (их видно в окнах): мятная — собачке слева, розовая — коту справа
    const PET_UP = 0.1;
    pil(AT, C.mint, [SEATS.backL[0], SEATS.backL[1] + 0.045, SEATS.backL[2] + 0.02], [0.36, 0.11, 0.36], null, 0, 0, 0.45);
    pil(AT, C.rose, [SEATS.backR[0], SEATS.backR[1] + 0.045, SEATS.backR[2] + 0.02], [0.36, 0.11, 0.36], null, 0, 0, 0.45);
    // подлокотники и ручки на дверях
    [1, -1].forEach(sd => {
      const L = sd > 0;
      [[0.0, 0.62, true], [-0.98, 0.5, false]].forEach(([zc, len, front]) => {
        const bD = doorBone(front, L), x = sd * (P.xTop(zc) - 0.07);
        pil(AT, C.leatherD, [x, 0.82, zc], [0.08, 0.05, len], null, bD, 0, 0.3);
        AT.geo(ge(new T.CapsuleGeometry(0.01, 0.07, 3, 6)), M([x - sd * 0.012, 0.92, zc + len * 0.3], [PI / 2, 0, 0]), C.chrome, bD, 0);
      });
    });
    // руль: обод, три спицы, ступица (без значков) — кость «руль»; колонка — неподвижно
    {
      const wc = new T.Vector3(WHEEL_C[0], WHEEL_C[1], WHEEL_C[2]), wq = new T.Quaternion().setFromEuler(new T.Euler(TILT, 0, 0));
      const wm = (lp, lr, ls) => new T.Matrix4().compose(wc, wq, new T.Vector3(1, 1, 1)).multiply(M(lp, lr, ls));
      AT.geo(torus(WHEEL_RAD, 0.024, 6, LITE ? 16 : 22), wm([0, 0, 0]), C.rubber, B.steer, 0);
      [PI / 2 + 0.0, PI / 2 + PI * 2 / 3, PI / 2 + PI * 4 / 3].forEach(a => { const r0 = 0.03, r1 = WHEEL_RAD - 0.012, mid = (r0 + r1) / 2; AT.geo(BOX, wm([Math.cos(a + PI) * mid, Math.sin(a + PI) * mid, 0.004], [0, 0, a + PI / 2], [0.034, r1 - r0, 0.012]), C.rimD, B.steer, 0); });
      AT.geo(pillow(0.4, true), wm([0, 0, 0.012], null, [0.048, 0.042, 0.02]), C.dark, B.steer, 0);
      const ax = new T.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
      const cm = new T.Matrix4().compose(wc.clone().addScaledVector(ax, 0.16), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), ax), new T.Vector3(0.028, 0.3, 0.028));
      AT.geo(CYLL, cm, C.dark, 0, 0);
    }

    mark('cabin');
    /* ---------- колёса: шина, обод, 5 двойных спиц, колпачок, тормозной диск; суппорт — на поворотном кулаке ---------- */
    const tireG = ge(new T.LatheGeometry([[0.255, -0.13], [0.33, -0.136], [0.36, -0.118], [0.37, -0.065], [0.37, 0.065], [0.36, 0.118], [0.33, 0.136], [0.255, 0.13]].map(([r, y]) => new T.Vector2(r, y)), LITE ? 14 : 18));
    const barrelG = ge(new T.CylinderGeometry(0.256, 0.256, 0.24, LITE ? 12 : 16, 1, true));
    const rimLip = torus(0.245, 0.012, 3, LITE ? 14 : 20);
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      const sd = k[1] === 'l' ? 1 : -1, hub = HUB[k], spinB = B['s_' + k], pivB = B['p_' + k];
      const W = (lp, lr, ls) => { const base = new T.Matrix4().compose(new T.Vector3(hub[0], hub[1], hub[2]), new T.Quaternion().setFromEuler(new T.Euler(0, sd > 0 ? 0 : PI, 0)), new T.Vector3(1, 1, 1)); return base.multiply(M(lp, lr, ls)); };
      AT.geo(tireG, W([0, 0, 0], [0, 0, -PI / 2]), C.rubber, spinB, 0);
      AT.geo(barrelG, W([-0.01, 0, 0], [0, 0, PI / 2]), C.rimD, spinB, 0, true);
      AT.geo(CYL, W([-0.02, 0, 0], [0, 0, PI / 2], [0.25, 0.012, 0.25]), C.hubD, spinB, 0);
      if (!LITE) AT.geo(CYL, W([0.035, 0, 0], [0, 0, PI / 2], [0.2, 0.012, 0.2]), C.disc, spinB, 0);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * PI * 2;
        (LITE ? [0] : [-0.1, 0.1]).forEach(da => { const aa = a + da, r = 0.15; AT.geo(BOX, W([0.112, Math.cos(aa) * r, Math.sin(aa) * r], [aa, 0, 0], [LITE ? 0.03 : 0.024, 0.19, LITE ? 0.05 : 0.03]), C.rim, spinB, 0); });
      }
      AT.geo(rimLip, W([0.114, 0, 0], [0, PI / 2, 0]), C.rim, spinB, 0);
      AT.geo(SPHL, W([0.118, 0, 0], null, [0.03, 0.062, 0.062]), C.rim, spinB, 0);
      if (!LITE) AT.geo(pillow(0.4, true), W([0.06, 0.12, -0.1], [0.7, 0, 0], [0.022, 0.06, 0.04]), C.caliper, k[0] === 'f' ? pivB : 0, 0);
    });

    mark('wheels');
    /* ---------- сетки ---------- */
    const paintGeo = AP.build(false), trimGeo = AT.build(true), glassGeo = AG.build(false);
    probeGeo.dispose(); probe.material.dispose(); GE.forEach(x => x.dispose());
    [paintGeo, trimGeo, glassGeo].forEach(gm => { keep(gm); gm.boundingSphere.radius += 1.3; });
    const gradientMap = K.GRAD;
    const paintMat = keep(paintGloss(K.addRim(new T.MeshToonMaterial({ color: new T.Color(paintHex), vertexColors: true, gradientMap }), 0.9)));
    const U_L = { uHead: { value: 0.22 }, uTail: { value: 0.12 }, uBrake: { value: 0 }, uRev: { value: 0 }, uTurn: { value: 0.12 } };
    const trimMat = keep(lightPatch(K.addRim(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap }), 0.55), U_L));
    const glassMat = keep(glassStreaks(new T.MeshBasicMaterial({ color: 0xFFFFFF, vertexColors: true, transparent: true, opacity: 0.36, depthWrite: false, side: T.DoubleSide })));
    glassMat.forceSinglePass = true;   // двусторонняя прозрачность одним проходом (иначе three рисует стекло дважды)
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
    const length = G.zF - G.zR, width = 2 * (P.xMax(-1.5) + 0.005), height = P.yR(-0.35);
    const dims = { length, width, height, wheelBase: G.zFA - G.zRA, track: 2 * G.TF, trackR: 2 * G.TR, wheelR: G.WR, halfW: width / 2, halfL: length / 2, wf: G.zFA, wr: G.zRA, ground: P.yBot(0), front: G.zF, rear: G.zR };
    const driveCfg = { wb: dims.wheelBase, track: G.TF, wf: G.zFA, wr: G.zRA, halfW: 0.98, halfL: 2.42, wheelR: G.WR };
    const tris = (paintGeo.index.count * 2 + trimGeo.index.count + glassGeo.index.count) / 3;
    const _q = new T.Quaternion();
    function setDoor(id, k) { const d = doors[id]; if (!d) return; d.k = clamp(k, 0, 1.06); const e = d.k; d.bone.rotation.y = -d.side * d.max * e; }
    const model = {
      group: root, root, body, paint, outline, trim, glass, skeleton, bones, boneIndex: B,
      wheels, steeringWheel, doors, seats, lights, lamps, dims, driveCfg,
      petSeats: { dog: v3([SEATS.backL[0], SEATS.backL[1] + PET_UP, SEATS.backL[2] + 0.02]), cat: v3([SEATS.backR[0], SEATS.backR[1] + PET_UP, SEATS.backR[2] + 0.02]) },
      heroSeat: v3(HERO_SEAT), wheelCenter: v3(WHEEL_C), wheelRel: v3(WHEEL_REL),
      stats: { parts, paintTris: paintGeo.index.count / 3, trimTris: trimGeo.index.count / 3, glassTris: glassGeo.index.count / 3, lite: LITE, tris: Math.round(tris), verts: paintGeo.attributes.position.count + trimGeo.attributes.position.count + glassGeo.attributes.position.count, calls: 4, shadowCalls: 2, buildMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) },
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
    const _inv = new T.Matrix4(), _m = new T.Matrix4(), _m2 = new T.Matrix4(), _p = new T.Vector3(), _e = new T.Euler(), _one = new T.Vector3(1, 1, 1);
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
    const VMAX = o.vmax || 9, VREV = 4, WB = md.dims.wheelBase, SM = STEER_MAX;
    const cfg = { autoBrake: !!o.autoBrake, turnSlow: !!o.turnSlow, coast: o.coast || 3.2, brake: 9.5, acc: 5.2 };
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('sedan ' + n, e); } });
    // двери и фонари: tick(dt) — явно; иначе сами по реальному времени (из place() и перед отрисовкой)
    const anim = { doors: {}, lastExplicit: -1e9, lastAuto: 0, brakeK: 0, accF: 0, brakeOverride: null, autoLights: o.autoLights !== false, prevV: 0, night: 0, head: null };
    const now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
    function tick(dt, auto) {
      dt = clamp(dt || 0, 0, 0.1);
      Object.keys(anim.doors).forEach(id => {
        const a = anim.doors[id]; a.t = Math.min(a.dur, a.t + dt);
        const e = sst(0, 1, a.t / a.dur), k = lerp(a.from, a.to, e), over = a.to > a.from ? Math.sin(Math.min(1, a.t / a.dur) * PI) * 0.035 : 0;
        md.setDoor(id, k + over);
        if (a.t >= a.dur) { md.setDoor(id, a.to); delete anim.doors[id]; a.res && a.res(true); }
      });
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
      let w = S.v / WB * Math.tan(S.steer); w = clamp(w, -1.5, 1.5);
      const nry = S.ry + w * dt, nx = S.x + Math.sin(nry) * S.v * dt, nz = S.z + Math.cos(nry) * S.v * dt;
      let bumped = false;
      if (ok(nx, nz, nry)) { S.x = nx; S.z = nz; S.ry = nry; S.slideT = 0; }
      else {
        let slid = false;
        if (Math.abs(S.v) > 0.3) for (const dd of [0.06, -0.06, 0.14, -0.14, 0.26, -0.26]) {
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
      return { bumped, edge };
    }
    function reset(path) {
      let best = 0, bd = 1e9;
      path.forEach(([x, z], i) => { const d = Math.hypot(x - S.x, z - S.z); if (d < bd) { bd = d; best = i; } });
      const [x, z] = path[best], [x2, z2] = path[(best + 1) % path.length];
      S.x = x; S.z = z; S.ry = Math.atan2(x2 - x, z2 - z); S.v = 0; S.stuckT = 0; place();
    }
    const heroSeat = md.heroSeat.clone();
    function driveInput() {
      const c = md.wheelCenter;
      return {
        wheel: { x: c.x - heroSeat.x, y: c.y - heroSeat.y, z: c.z - heroSeat.z }, wheelR: WHEEL_RAD, wheelTilt: TILT,
        steer: clamp(S.steer / STEER_MAX, -1, 1), steerRad: S.steer, wheelAngle: -S.steer, axis: { x: md.steeringWheel.axis.x, y: md.steeringWheel.axis.y, z: md.steeringWheel.axis.z }, speed: S.v,
      };
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
      return new T3.Vector3(d.side * (md.dims.halfW + 0.42), 0, front ? -0.26 : -1.12);
    };
    function makeCover() {
      const g = new T3.Group(); body.add(g); g.name = 'sedanCover';
      const toon = (c) => new T3.MeshToonMaterial({ color: new T3.Color(c), gradientMap: md.paint.material.gradientMap });
      const cloth = toon('#EADCD2'), bowM = toon('#E58FA6'), bowD = toon('#C9667E');
      const m = new T3.Mesh(md.paint.geometry, cloth); m.scale.set(1.035, 1.025, 1.015); m.position.y = 0.004; g.add(m);
      const sph = new T3.SphereGeometry(1, 16, 11), cyl = new T3.CylinderGeometry(1, 1, 1, 12);
      const add = (geo, mat, p, s, r) => { const x = new T3.Mesh(geo, mat); x.position.set(p[0], p[1], p[2]); x.scale.set(s[0], s[1], s[2]); if (r) x.rotation.set(r[0], r[1], r[2]); x.castShadow = true; g.add(x); return x; };
      [1, -1].forEach(sd => add(sph, cloth, [sd * 1.08, 1.1, 0.6], [0.14, 0.1, 0.1]));                         // зеркала под тканью
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
      heroSeat,
      seatDriver: new T.Vector3(heroSeat.x, heroSeat.y + 0.52, heroSeat.z),   // старый путь main.js: корень = seatDriver.y − 0.52
      seatPass: md.petSeats.cat.clone(),   // кот — сзади справа, на розовой подушке
      seatDog: md.petSeats.dog.clone(),    // собачка — сзади слева, на мятной подушке
      doorL: new T.Vector3(md.dims.halfW + 0.55, 0, -0.1), doorR: new T.Vector3(-md.dims.halfW - 0.55, 0, -0.1),
      setWheelLift: (k, lift) => md.setWheelLift(k, lift),
      openDoor, setDoor: (id, k) => { delete anim.doors[id]; md.setDoor(id, k); }, doorK: id => (md.doors[id] ? md.doors[id].k : 0),
      get doorsBusy() { return Object.keys(anim.doors).length > 0; },
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
            if (u > 0.3) {   // шаг внутрь и посадка (поза водителя набирается со второй половины)
              const e = sst(0, 1, (u - 0.3) / 0.55); st.sit = sst(0.35, 1, e);
              hero.root.position.set(lerp(stand.x, seatW.x, e), lerp(stand.y, seatW.y, e) + Math.sin(e * PI) * 0.1, lerp(stand.z, seatW.z, e));
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
          if (u > 0) { const e = sst(0, 1, u / 0.55); st.sit = 1 - sst(0, 0.6, e); hero.root.position.set(lerp(seat.x, out.x, e), lerp(seat.y, out.y, e) + Math.sin(e * PI) * 0.12, lerp(seat.z, out.z, e)); }
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
    function update(dt, inp) {
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      if (st.tween) { st.tween.t += dt; const k = Math.min(1, st.tween.t / st.tween.dur); st.tween.tick(k, st.tween.t); if (k >= 1 && st.tween) st.tween.done(); }
      if (st.mode !== 'drive') { car.tick(dt); car.place && car.model.pose(car.S); return { bumped: false, edge: null }; }
      let ctl = inp || null;
      if (st.braking) ctl = { brake: true };
      const r = car.update(dt, ctl);
      if (st.braking && Math.abs(car.S.v) < 0.4 && st.brakeDone) { const f = st.brakeDone; st.brakeDone = null; f(); }
      return r;
    }
    function animState() {
      const sit = st.mode === 'drive' || ((st.mode === 'enter' || st.mode === 'exit') && st.sit > 0.5);
      return { speed: st.walk && st.mode === 'enter' ? 1.4 : 0, sitting: !!sit, sitPose: 'chair', idle: false, turnRate: 0, waving: false, drive: sit ? car.driveInput() : null };
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
     ВЫБОР МАШИНЫ: «Ретро-купе / Красный седан»
     ===================================================================== */
  const CHOICES = [
    { id: 'coupe', title: 'Ретро-купе', note: 'Кругленькая, с открытым верхом', color: '#A8D8C4',
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

  VEH.sedan = { build, makeCar, create, hornSound, G, HERO_SEAT, WHEEL_REL, TILT, WHEEL_RAD, STEER_MAX, version: 1 };
  VEH.CHOICES = CHOICES;
  VEH.makeCar = (id, H, o) => { const c = CHOICES.find(x => x.id === id) || CHOICES[0]; return c.make(H, o); };
  VEH.createCtl = (id, o) => { const c = CHOICES.find(x => x.id === id) || CHOICES[0]; return c.ctl(o); };
  VEH.picker = picker;
})();
