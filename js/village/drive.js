/* =====================================================================
   ГОРНАЯ ДОРОГА: машинка для серпантина (VILLAGE.drive). Волна 4.
   Та же мультяшная машинка, что в городе (WORLD.makeCar из js/world/car.js, если он загружен), но с горной физикой:
   колёса стоят на дороге на любом уклоне, подвеска чувствует ямы, камни и колеи (кузов слегка подпрыгивает и качается),
   в лужах и грязи из-под колёс летят брызги, на сухом щебне за машиной — лёгкая пыль. Аварий и поломок нет.

   ВОЛНА 4 — БЕЗ ПОМОЩНИКОВ: машина НЕ сбавляет ход в поворотах и НЕ рулит сама. Тормозит только тормоз (и естественный
   накат, когда газ отпущен), рулит только игрок. Ограждений на дороге нет — вместо них невидимый мягкий край: машина упирается
   в «мягкий щебень» у обочины, гасит скорость (пыльное облачко) и ползёт вдоль края; с обрыва не упасть, не застрять.
   Героиня — за рулём (поза водителя HeroAnim, руки на руле), «Выйти» в любой момент (машина сама дотормаживает),
   ходить по дороге, сесть на лавочку, «Сесть за руль» и ехать дальше.

   VILLAGE.drive.makeCar(THREE, { kit, color, factory }) → машина: factory(THREE, o) | город (WORLD.makeCar) | своя запасная.
   VILLAGE.drive.create({ THREE, car, ground, colliders, road, start, blob, dynamic, collide, season }) → контроллер:
     update(dt, input) → { bumped, edge, s, e, onRoad, surface }
       input: { thr: -1..1, brake: bool, str: -1..1 } — педали/клавиши; str > 0 — вправо (руль только от игрока)
              { dir: [dx, dz, mag], thr? } — джойстик «покажи, куда ехать» (направление в мире; газ — mag или thr)
              { auto: true, thr } — ТОЛЬКО ДЛЯ QA: «виртуальный игрок» (pilot) жмёт газ и крутит руль
                сам — тем же вводом { thr, str }, что и человек; игра его не посылает
     pos, speed, heading, S, cfg, teleport(s | {x, z, ry}), info(), reset(), dispose()
     W6: tap(k 0..1) — лёгкий толчок подвески (камушек со скалы; то же — collider.tap), скорость не меняет;
         cfg.wMaxHi — предел рыскания на полном ходу; pilot (QA) сам притормаживает перед крутыми поворотами (inp.brakes:false — нет)
     reversing, brakeLabel() → 'назад' | 'тормоз'
     ГЕРОИНЯ: mode — 'drive' | 'stopping' | 'exit' | 'parked' | 'enter'
       heroIn(hero, { instant }) → Promise<true> — от места, где стоит героиня, к двери и на сиденье (0,8 с); hero.root — в car.body
       heroOut(hero, scene, { instant }) → Promise<{x, y, z, ry}> — дотормозить, выйти к двери (на полотно, не за край)
       canExit() — едем медленнее cfg.exitV (кнопка «Выйти»); canEnter(x, z) — героиня рядом с припаркованной машиной
       animState() → { speed, sitting, sitPose, idle, turnRate, waving, drive } — прямо в HeroAnim.update (drive = руль)
       seatLocal() — куда ставить корень героини в car.body; driveOpt() — opt.drive для HeroAnim; doorPoint() — дверь (мир)
       collider — коробка машины для ходьбы ({type:'box', …, off} — выключена, пока героиня за рулём); create({ dynamic })
                  кладёт её в массив региона (serpentine: handle.dynamic), handle.collide её учитывает
   VILLAGE.drive.chase({ THREE, camera, ground }) → камера-следилка: update(dt, drive, opt), snap(), resume().
     W7: opt.yawOff / opt.pitch — взгляд пальцем (рад: вокруг машины / + вверх, на небо); «посмотри туда» (opt.look) — не дальше
         ~20° от курса, машина всегда в кадре (желание 9); resume() — продолжить с того места, где сейчас камера (после вида из-за руля).
   VILLAGE.drive.cockpit({ THREE, camera }) → вид «из-за руля» (W7, желание 10; город и горы): on(b), update(dt, car, hero, opt)
     → bool, active, blend — камера в салоне по car.cockpit (руль на ~66 % высоты кадра, руки героини на ободе, приборы, рамка
     стекла); от героини на время вида видны только руки (своя сетка «руки» по весам скина), остальное спрятано слоем.
   VILLAGE.drive.touchInput({ jx, jy, gas, brake, v }) → { thr, str, brake } — рекомендуемая раскладка телефона:
     палец слева по горизонтали — руль (пропорционально, мягкий центр), педали справа — газ/тормоз (тормоз после остановки — назад).
   road (из региона): { len, project(x, z, hintS), sample(s), kmax(s, ahead), areas?(x, z, hintS), surface?(x, z, hintS) }
     — без road машина ездит «свободно», только по коллайдерам ({type:'box', x, z, w, d, ry} | {type:'circle', x, z, r}).
     Без развилки (W8): ветки к отелю (road.branch, pilot road:'hotel') больше нет — S.rid и S.sb всегда 0.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (k, dt) => 1 - Math.exp(-k * dt);

  // W6 (желание автора: «машина едет медленно — хочу в 1,5 раза быстрее»): 18 м/с (65 км/ч) на прямой (было 12), разгон 7,8 м/с²
  // (было 5,2), тормоз 11 (было 9,5). Руль: до 0,6 рад на месте, 0,36 рад на полном ходу (обычная «острота руля от скорости»,
  // без подруливания); рыскание не больше 1,6 рад/с до 9 м/с и 1,15 рад/с на полном ходу (cfg.vmax, wMaxHi) — на скорости
  // машина не «вертится», крутые повороты (R ≈ 15 м) — с лёгким торможением.
  // волна 7 («чуть быстрее»): 20 м/с на прямой (vCap 22 — под горку)
  const CFG = {
    vmax: 20, vrev: 3.5, acc: 7.8, brake: 11, roll: 1.5, gravK: 0.3, vCap: 22,
    wb: 2.17, track: 0.72, wf: 1.05, wr: -1.12, steerMax: 0.6, steerHi: 0.36, steerRate: 7, wMax: 1.6, wMaxHi: 1.15, wMaxV0: 9,
    halfW: 0.86, halfL: 1.9, wheelR: 0.31, edgePad: 0.06, creep: 0.7, exitV: 3.0,
    susK: 230, susZ: 0.42, tiltK: 190, tiltZ: 0.45, lift: 0.12,
  };

  /* ---------- машина: своя фабрика (волна 4: седан), городская (если есть car.js + kit.js) или запасная ---------- */
  function makeCar(T, o = {}) {
    if (typeof o.factory === 'function') { try { const c = o.factory(T, o); if (c && c.root) { c.kind = c.kind || 'factory'; return c; } } catch (e) { console.warn('village car: factory failed', e); } }
    const W = window.WORLD;
    if (W && typeof W.makeCar === 'function') {
      let H = o.kit && o.kit.toon && o.kit.put ? o.kit : null, own = false;
      if (!H && typeof W.createKit === 'function') { try { H = W.createKit({ rim: ['#FFD0AE', 0.26] }); own = true; } catch (e) { H = null; } }
      if (H) {
        try {
          const car = W.makeCar(H, { color: o.color || (W.CAR_COLORS ? W.CAR_COLORS[0][1] : '#A8D8C4') });
          car.kind = 'world';
          car.dispose = () => { if (car.root.parent) car.root.parent.remove(car.root); if (own) H.dispose(); };
          return car;
        } catch (e) { if (own) H.dispose(); console.warn('village car: city car failed, using spare', e); }
      }
    }
    return spareCar(T, o);
  }
  // запасная машинка без набора города: пухлый кузов, открытый верх, круглые фары, без значков; руль и место водителя
  // (волна 4) — как в городской: корень героини heroSeat, центр руля = heroSeat + HeroAnim.DRIVE.wheel
  function spareCar(T, o) {
    const GV = [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255];
    const gd = new Uint8Array(64); GV.forEach((v, i) => gd.set([v, v, v, 255], i * 4));
    const grad = new T.DataTexture(gd, 16, 1, T.RGBAFormat); grad.minFilter = grad.magFilter = T.LinearFilter; grad.needsUpdate = true;
    const own = [grad];
    const toon = (c, x) => { const m = new T.MeshToonMaterial(Object.assign({ color: new T.Color(c), gradientMap: grad }, x || {})); own.push(m); return m; };
    const geo = g => { own.push(g); return g; };
    const root = new T.Group(), body = new T.Group(); root.add(body); root.name = 'car';
    const paint = toon(o.color || '#A8D8C4'), cream = toon('#FFF6EE'), dark = toon('#4A3F4E'), seat = toon('#F4E6D4');
    const lamp = toon('#FFF6DC', { emissive: new T.Color('#FFE2A0'), emissiveIntensity: 0.7 }), tail = toon('#E2405E', { emissive: new T.Color('#D9304E'), emissiveIntensity: 0.4 });
    const add = (g, m, p, s, r, parent) => { const x = new T.Mesh(g, m); x.position.set(p[0], p[1], p[2]); if (s) x.scale.set(s[0], s[1], s[2]); if (r) x.rotation.set(r[0], r[1], r[2]); x.castShadow = true; (parent || body).add(x); return x; };
    const cap = geo(new T.CapsuleGeometry(0.5, 2.5, 6, 14)), sph = geo(new T.SphereGeometry(1, 14, 10)), box = geo(new T.BoxGeometry(1, 1, 1));
    add(cap, paint, [0, 0.62, 0], [1.6, 0.62, 1], [PI / 2, 0, 0]);
    add(sph, paint, [0, 0.82, -0.75], [0.74, 0.3, 0.95]);
    add(box, seat, [0, 0.92, -0.25], [1.0, 0.12, 0.8]);
    add(box, toon('#6B5260'), [0, 0.98, 0.45], [1.1, 0.12, 0.3]);
    [-1, 1].forEach(s => { add(sph, cream, [s * 0.5, 0.8, 1.55], [0.18, 0.18, 0.12]); add(sph, lamp, [s * 0.5, 0.8, 1.62], [0.13, 0.13, 0.06]); add(sph, tail, [s * 0.5, 0.72, -1.75], [0.1, 0.07, 0.05]); });
    add(box, cream, [0, 0.38, 1.9], [1.3, 0.1, 0.1]); add(box, cream, [0, 0.38, -1.9], [1.3, 0.1, 0.1]);
    // руль: тор на колонке, наклон 0,95 рад (как в городской машине и HeroAnim.DRIVE)
    const heroSeat = new T.Vector3(0.31, 0.2, 0.06), WHEEL_C = new T.Vector3(0.31, 1.12, 0.38), wheelG = new T.Group();
    wheelG.position.copy(WHEEL_C); wheelG.rotation.x = 0.95; body.add(wheelG);
    const wheelSpin = new T.Group(); wheelG.add(wheelSpin);
    add(geo(new T.TorusGeometry(0.17, 0.022, 6, 18)), dark, [0, 0, 0], null, null, wheelSpin);
    add(box, dark, [0, 0, 0], [0.3, 0.03, 0.025], null, wheelSpin);
    const tireG = geo(new T.CylinderGeometry(0.31, 0.31, 0.26, 16)), hubG = geo(new T.CylinderGeometry(0.17, 0.17, 0.28, 12));
    const wheels = [[CFG.track, CFG.wf], [-CFG.track, CFG.wf], [CFG.track, CFG.wr], [-CFG.track, CFG.wr]].map(([x, z]) => {
      const g = new T.Group(), spin = new T.Group(); g.position.set(x, CFG.wheelR, z); g.add(spin); root.add(g);
      const t = new T.Mesh(tireG, dark); t.rotation.z = PI / 2; t.castShadow = true; spin.add(t);
      const h = new T.Mesh(hubG, cream); h.rotation.z = PI / 2; spin.add(h);
      return { g, spin };
    });
    const S = { x: 0, z: 0, ry: 0, v: 0, steer: 0, spin: 0, pitch: 0, roll: 0, sq: 0 };
    function place() {
      root.position.set(S.x, 0, S.z); root.rotation.y = S.ry;
      body.rotation.set(S.pitch, 0, S.roll); body.position.y = -S.sq * 0.05; body.scale.set(1 + S.sq * 0.03, 1 - S.sq * 0.06, 1 + S.sq * 0.02);
      wheels.forEach((w, i) => { w.g.rotation.y = i < 2 ? S.steer : 0; w.spin.rotation.x = S.spin; w.g.position.y = CFG.wheelR; });
      wheelSpin.rotation.y = -S.steer * 1.0;
    }
    place();
    return {
      root, body, wheels, S, place, kind: 'spare', VMAX: CFG.vmax,
      seatDriver: new T.Vector3(0.31, 0.84, -0.12), heroSeat, seatPass: new T.Vector3(-0.31, 1.0, 0.0),
      doorL: new T.Vector3(1.45, 0, 0), doorR: new T.Vector3(-1.45, 0, 0),
      driveInput() { return { wheel: { x: WHEEL_C.x - heroSeat.x, y: WHEEL_C.y - heroSeat.y, z: WHEEL_C.z - heroSeat.z }, wheelR: 0.17, wheelTilt: 0.95, steer: clamp(S.steer / 0.6, -1, 1), steerRad: S.steer, speed: S.v }; },
      setWheelLift(i, dy) { const w = wheels[i]; if (w) w.g.position.y = CFG.wheelR + dy; },
      setColor(hex) { paint.color.set(hex); },
      dispose() { if (root.parent) root.parent.remove(root); own.forEach(x => x.dispose()); },
    };
  }

  /* ---------- сетка коллайдеров (для машины: круги по длине кузова) ---------- */
  function colGrid(list) {
    const CELL = 8, cells = new Map(), key = (i, j) => i * 65536 + j;
    (list || []).forEach(c => {
      let r;
      if (c.type === 'circle') r = c.r; else r = Math.hypot(c.w || 0, c.d || 0) / 2;
      for (let i = Math.floor((c.x - r) / CELL); i <= Math.floor((c.x + r) / CELL); i++) for (let j = Math.floor((c.z - r) / CELL); j <= Math.floor((c.z + r) / CELL); j++) {
        const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(c);
      }
    });
    return { near(x, z) { return cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || null; } };
  }
  // вытолкнуть круг (x, z, r) из коллайдера; возвращает [dx, dz] или null
  function pushOut(c, x, z, r) {
    if (c.noCar) return null;
    if (c.type === 'circle') {
      const dx = x - c.x, dz = z - c.z, m = c.r + r, d = Math.hypot(dx, dz);
      if (d >= m || d < 1e-6) return null; const k = (m - d) / d; return [dx * k, dz * k];
    }
    const ry = c.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry), dx = x - c.x, dz = z - c.z;
    // локальные оси коробки: X → (cos ry, −sin ry), Z → (sin ry, cos ry) (как rotation.y в three)
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, hw = c.w / 2, hd = c.d / 2;
    const qx = clamp(lx, -hw, hw), qz = clamp(lz, -hd, hd);
    let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz), px, pz;
    if (d > 1e-6) { if (d >= r) return null; const k = (r - d) / d; px = ox * k; pz = oz * k; }
    else { const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz); if (ex < ez) { px = (ex + r) * Math.sign(lx || 1); pz = 0; } else { px = 0; pz = (ez + r) * Math.sign(lz || 1); } }
    return [px * cs + pz * sn, -px * sn + pz * cs];
  }

  /* ---------- брызги и пыль: два Points — мягкие облачка (пыль, снег; 0,9 м) и капли (грязь, вода; 0,34 м);
     вызов отрисовки — только пока есть живые частицы ---------- */
  function makePool(T, NP, size, name) {
    const P = new Float32Array(NP * 3), Cc = new Float32Array(NP * 4), VEL = new Float32Array(NP * 3), LIFE = new Float32Array(NP), L0 = new Float32Array(NP), A0 = new Float32Array(NP), GRAV = new Float32Array(NP);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('color', new T.BufferAttribute(Cc, 4));
    geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e5);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d');
    if (c) { const g = c.createRadialGradient(16, 16, 0, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }
    const tex = new T.CanvasTexture(cv);
    const mat = new T.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: true });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 8; pts.name = name; pts.visible = false;
    for (let i = 0; i < NP; i++) P[i * 3 + 1] = -1e4;
    let head = 0, alive = 0, was = false;
    return {
      pts, get alive() { return alive; },
      spawn(x, y, z, vx, vy, vz, life, col, alpha, grav) {
        const i = head; head = (head + 1) % NP;
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; VEL[i * 3] = vx; VEL[i * 3 + 1] = vy; VEL[i * 3 + 2] = vz;
        LIFE[i] = L0[i] = life; A0[i] = alpha; GRAV[i] = grav; Cc[i * 4] = col[0]; Cc[i * 4 + 1] = col[1]; Cc[i * 4 + 2] = col[2]; Cc[i * 4 + 3] = alpha;
      },
      update(dt) {
        alive = 0;
        for (let i = 0; i < NP; i++) {
          if (LIFE[i] <= 0) continue;
          LIFE[i] -= dt;
          if (LIFE[i] <= 0) { P[i * 3 + 1] = -1e4; Cc[i * 4 + 3] = 0; continue; }
          alive++;
          VEL[i * 3 + 1] -= GRAV[i] * dt;
          const dr = GRAV[i] > 2 ? 0.5 : 2.2; VEL[i * 3] *= 1 - Math.min(1, dr * dt); VEL[i * 3 + 2] *= 1 - Math.min(1, dr * dt); if (GRAV[i] <= 2) VEL[i * 3 + 1] *= 1 - Math.min(1, 1.2 * dt);
          P[i * 3] += VEL[i * 3] * dt; P[i * 3 + 1] += VEL[i * 3 + 1] * dt; P[i * 3 + 2] += VEL[i * 3 + 2] * dt;
          const k = LIFE[i] / L0[i]; Cc[i * 4 + 3] = A0[i] * Math.min(1, k * 1.6) * Math.min(1, (1 - k) * 8 + 0.2);
        }
        pts.visible = alive > 0;
        if (alive || was) { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; }
        was = alive > 0;
      },
      dispose() { if (pts.parent) pts.parent.remove(pts); geo.dispose(); mat.dispose(); tex.dispose(); },
    };
  }
  function makeFx(T, winter) {
    const puffs = makePool(T, 48, 0.95, 'driveDust'), drops = makePool(T, 72, 0.34, 'driveDrops');
    const COL = {
      dust: winter ? [0.96, 0.97, 0.99] : [0.84, 0.79, 0.69], mud: winter ? [0.71, 0.69, 0.65] : [0.47, 0.39, 0.3],
      water: winter ? [0.84, 0.88, 0.92] : [0.62, 0.68, 0.71], snow: [0.97, 0.98, 1.0], mist: winter ? [0.93, 0.95, 0.97] : [0.8, 0.85, 0.87],
    };
    return {
      pts: puffs.pts, all: [puffs.pts, drops.pts],
      spawn(x, y, z, vx, vy, vz, life, kind, alpha, grav) { (kind === 'dust' || kind === 'snow' || kind === 'mist' ? puffs : drops).spawn(x, y, z, vx, vy, vz, life, COL[kind] || COL.dust, alpha, grav); },
      update(dt) { puffs.update(dt); drops.update(dt); },
      get alive() { return puffs.alive + drops.alive; },
      attach(parent) { [puffs.pts, drops.pts].forEach(p => { if (!p.parent) parent.add(p); }); },
      dispose() { puffs.dispose(); drops.dispose(); },
    };
  }

  /* ---------- контроллер ---------- */
  function create(o) {
    const T = o.THREE || window.THREE, car = o.car, road = o.road || null;
    const ground = typeof o.ground === 'function' ? o.ground : () => 0;
    // волна 4: машина может принести свои размеры (седан: car.driveCfg — база, колея, габарит, радиус колеса)
    const cfg = Object.assign({}, CFG, (car && car.driveCfg) || {}, o.cfg || {});
    const root = car ? (car.root || car) : null;
    const grid = colGrid(o.colliders);
    const winter = o.season === 'winter';
    const S = {
      x: 0, y: 0, z: 0, ry: 0, v: 0, steer: 0, spin: 0, yb: 0, pitchG: 0, rollG: 0, bp: 0, br: 0, squash: 0, sq: 0,
      sy: 0, svy: 0, sp: 0, svp: 0, sr: 0, svr: 0, odo: 0,
      s: 0, e: 0, sb: 0, rid: 0, along: 1, stuckT: 0, bumpT: 9, edgeT: 9, onRoad: false, unstickT: 0, unstickDir: -1, reversing: false,
      mode: 'drive', hero: null, tween: null, kind: 'gravel', wet: 0, edges: 0, splashT: 0, dustT: 0, lastPuddle: false,
    };
    const pos = new T.Vector3();
    // звук мотора (js/engine_sound.js): голос седана или кабриолета; один объект на машину — без новых объектов за кадр
    const ES = { kind: car && car.kind === 'sedan' ? 'sedan' : 'cabrio', speed: 0, vmax: cfg.vmax, throttle: 0, braking: false, onGround: true, driving: false };
    const collider = { type: 'box', x: 0, z: 0, w: 1.9, d: 4.1, ry: 0, y0: -1e4, y1: 1e4, id: 'car', kind: 'car', noCar: true, off: true };
    // W6: лёгкое касание (камушек со скалы): кузов чуть вздрагивает на подвеске; скорость и курс не меняются
    function tap(k) { k = clamp(k == null ? 0.3 : k, 0, 1); S.svy -= 0.9 * k; S.svr += (Math.random() - 0.5) * 2.4 * k; S.svp += (Math.random() - 0.5) * 1.2 * k; S.taps = (S.taps || 0) + 1; return true; }
    collider.tap = tap;
    const dyn = Array.isArray(o.dynamic) ? o.dynamic : null; if (dyn) dyn.push(collider);
    const fx = makeFx(T, winter);
    let blob = null;
    if (o.blob && root) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(70,58,72,.42)'); g.addColorStop(0.6, 'rgba(70,58,72,.2)'); g.addColorStop(1, 'rgba(70,58,72,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      const tx = new T.CanvasTexture(cv), m = new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false });
      blob = new T.Mesh(new T.PlaneGeometry(2.4, 4.4), m); blob.rotation.x = -PI / 2; blob.position.y = 0.035; blob.renderOrder = 1; blob.castShadow = false; blob.receiveShadow = false;
      blob.userData.own = [tx, m, blob.geometry]; root.add(blob);
    }
    // колёса: FL, FR, RL, RR (x > 0 — слева, z > 0 — спереди)
    const WOFF = [[cfg.track, cfg.wf], [-cfg.track, cfg.wf], [cfg.track, cfg.wr], [-cfg.track, cfg.wr]];
    // углы кузова для мягкого края (скруглённые: чуть внутри габарита) — колёса всегда остаются на полотне
    const CORNERS = [[cfg.halfW - 0.06, cfg.halfL * 0.66], [-(cfg.halfW - 0.06), cfg.halfL * 0.66], [cfg.halfW - 0.06, -cfg.halfL * 0.66], [-(cfg.halfW - 0.06), -cfg.halfL * 0.66]];
    const WH = { g: [0, 0, 0, 0], dz: [0, 0, 0, 0], lift: [0, 0, 0, 0], kind: ['', '', '', ''], wet: [0, 0, 0, 0] };
    const surfAt = (x, z) => (road && road.surface ? road.surface(x, z, S.s) : null);

    /* --- земля под колёсами: ровная (рельеф) + неровности покрытия (ямы −, камни +, мелкая тряска щебня) --- */
    function sampleWheels(withBumps) {
      const fx_ = Math.sin(S.ry), fz_ = Math.cos(S.ry), lx = fz_, lz = -fx_;
      const spd = sm(0.5, 7, Math.abs(S.v));
      for (let k = 0; k < 4; k++) {
        const [ox, oz] = WOFF[k], x = S.x + fx_ * oz + lx * ox, z = S.z + fz_ * oz + lz * ox;
        WH.g[k] = ground(x, z);
        let dz = 0;
        if (withBumps) {
          const sf = surfAt(x, z);
          if (sf) {
            dz = sf.dz;
            const n = Math.sin(S.odo * 7.3 + k * 1.9) * Math.sin(S.odo * 3.1 + k * 0.7 + 1.3);
            dz += n * sf.rough * 0.011 * spd;
            WH.kind[k] = sf.kind; WH.wet[k] = sf.wet;
          }
        }
        WH.dz[k] = dz;
      }
    }
    function planeOf(h) {
      const yT = (h[0] + h[1] + h[2] + h[3]) / 4;
      const pT = Math.atan2((h[0] + h[1] - h[2] - h[3]) / 2, cfg.wf - cfg.wr), rT = Math.atan2((h[0] + h[2] - h[1] - h[3]) / 2, cfg.track * 2);
      return [yT, clamp(pT, -0.5, 0.5), clamp(rT, -0.35, 0.35)];
    }
    // колёса — на землю: подъём каждого колеса относительно плоскости кузова (ход подвески ±12 см)
    function applyWheels() {
      if (!car) return;
      const sp_ = Math.sin(S.pitchG + S.sp), sr_ = Math.sin(S.rollG + S.sr);
      for (let k = 0; k < 4; k++) {
        const [ox, oz] = WOFF[k], yPlane = S.y + oz * sp_ + ox * sr_;
        WH.lift[k] = clamp(WH.g[k] + WH.dz[k] - yPlane, -cfg.lift, cfg.lift);
      }
      if (typeof car.setWheelLift === 'function') { for (let k = 0; k < 4; k++) car.setWheelLift(k, WH.lift[k]); return; }
      const W = car.wheels;
      if (W && W.isInstancedMesh && W.count >= 4) {
        const m = apply._m || (apply._m = new T.Matrix4()), p = apply._p || (apply._p = new T.Vector3()), q = apply._q || (apply._q = new T.Quaternion()), s = apply._s || (apply._s = new T.Vector3());
        for (let i = 0; i < 4; i++) { W.getMatrixAt(i, m); m.decompose(p, q, s); const k = (p.x > 0 ? 0 : 1) + (p.z > 0 ? 0 : 2); p.y += WH.lift[k]; m.compose(p, q, s); W.setMatrixAt(i, m); }
        W.instanceMatrix.needsUpdate = true;
      } else if (Array.isArray(W)) {
        W.forEach(w => { const g = w && w.g; if (g && g.position) { const k = (g.position.x > 0 ? 0 : 1) + (g.position.z > 0 ? 0 : 2); g.position.y = cfg.wheelR + WH.lift[k]; } });
      }
    }
    function apply() {
      if (car && car.S && typeof car.place === 'function') {
        const cs = car.S; cs.x = S.x; cs.z = S.z; cs.ry = S.ry; cs.v = S.v; cs.steer = S.steer; cs.spin = S.spin; cs.pitch = S.bp; cs.roll = S.br; cs.sq = S.sq; cs.braking = !!S.braking;
        car.place();
      }
      if (root) { root.position.set(S.x, S.y, S.z); root.rotation.set(-(S.pitchG + S.sp), S.ry, S.rollG + S.sr, 'YXZ'); }
      applyWheels();
      pos.set(S.x, S.y, S.z);
      collider.x = S.x; collider.z = S.z; collider.ry = S.ry; collider.y0 = S.y - 0.6; collider.y1 = S.y + 1.7;
      collider.off = S.mode === 'drive' || S.mode === 'stopping';
    }
    function teleport(t) {
      if (typeof t === 'number' && road) {
        const q = road.sample(clamp(t, 0, road.len));
        S.x = q.x; S.z = q.z; S.ry = q.th; S.s = clamp(t, 0, road.len); S.e = 0; S.along = 1; S.rid = 0;
      } else if (t && typeof t === 'object') {
        S.x = t.x; S.z = t.z; S.ry = t.ry || 0; if (road) { const p = road.project(S.x, S.z); S.s = p.s; S.e = p.e; S.along = Math.cos(angDiff(S.ry, p.th)) >= 0 ? 1 : -1; S.rid = 0; }
      }
      S.v = 0; S.steer = 0; S.stuckT = 0; S.unstickT = 0; S.squash = 0; S.sq = 0; S.bp = 0; S.br = 0; S.sy = S.svy = S.sp = S.svp = S.sr = S.svr = 0;
      sampleWheels(false); const pl = planeOf(WH.g); S.yb = S.y = pl[0]; S.pitchG = pl[1]; S.rollG = pl[2];
      apply();
    }

    /* --- «виртуальный игрок» для QA: та же педаль газа и тот же руль { thr, str }, что у человека (pure pursuit) --- */
    function pilot(inp) {
      const thr = inp.thr == null ? 1 : clamp(inp.thr, -1, 1);
      if (!road) return { thr, str: 0 };
      const smax = steerLimit(), la = 3.4 + 0.42 * Math.abs(S.v), back = thr < 0;
      const P = road.project(S.x, S.z, S.s), al0 = Math.cos(angDiff(S.ry, P.th)) >= 0 ? 1 : -1, Q = road.sample(clamp(P.s + al0 * (back ? -la : la), 0, road.len));
      const lane = inp.lane || 0, ax = Q.x + Q.lx * lane, az = Q.z + Q.lz * lane;
      let al2 = angDiff(Math.atan2(ax - S.x, az - S.z), S.ry); if (back) al2 = angDiff(al2 + PI, 0);
      const delta = Math.atan2(2 * cfg.wb * Math.sin(al2), la);
      // W6: виртуальный игрок притормаживает перед крутыми поворотами сам — педалями (газ отпущен / тормоз), как человек;
      // у машины помощников по-прежнему нет. inp.brakes === false — «газ в пол» (проверка мягкого края)
      let thr2 = thr, brk = false;
      if (thr > 0 && inp.brakes !== false && road.kmax && !back) {
        const v = Math.abs(S.v), Lb = v * v / (2 * cfg.brake * 0.8) + 6;
        const k = al0 > 0 ? road.kmax(P.s, Lb) : road.kmax(Math.max(0, P.s - Lb), Lb);
        const vSafe = k > 1e-4 ? Math.min(cfg.vmax, Math.sqrt(8.5 / k), (cfg.wMaxHi || cfg.wMax) * 0.95 / k + 2) : cfg.vmax;
        if (v > vSafe + 1.2) { thr2 = 0; brk = true; } else if (v > vSafe) thr2 = 0;
      }
      return { thr: thr2, str: clamp(-delta / smax, -1, 1) * (back ? -1 : 1), brake: brk };
    }
    const steerLimit = () => cfg.steerMax + (cfg.steerHi - cfg.steerMax) * sm(3, cfg.vmax, Math.abs(S.v));
    // W6: предел рыскания от скорости (на 18 м/с — 1,15 рад/с вместо 1,6): быстрая машина остаётся послушной
    const yawLimit = () => (cfg.wMaxHi == null ? cfg.wMax : cfg.wMax + (cfg.wMaxHi - cfg.wMax) * sm(cfg.wMaxV0 || 9, cfg.vmax, Math.abs(S.v)));

    /* --- героиня: посадка, выход, поза --- */
    const v3 = () => new T.Vector3();
    const seatLocal = () => (car && car.heroSeat ? car.heroSeat.clone() : car && car.seatDriver ? new T.Vector3(car.seatDriver.x, car.seatDriver.y - 0.64, car.seatDriver.z) : new T.Vector3(0.31, 0.2, 0.06));
    const body = () => (car && car.body) || root;
    const l2w = (v, out) => { root.updateMatrixWorld(true); out.copy(v); body().localToWorld(out); return out; };
    function driveOpt() {
      if (car && typeof car.driveInput === 'function') return car.driveInput();
      const H = window.HeroAnim && window.HeroAnim.DRIVE;
      return { steer: clamp(S.steer / cfg.steerMax, -1, 1), wheel: H ? H.wheel : [0, 0.92, 0.32], wheelR: 0.17, wheelTilt: 0.95 };
    }
    // двери: у седана (car.setDoor) водительская дверь открывается и закрывается при посадке и выходе
    const hasDoors = !!(car && typeof car.setDoor === 'function');
    const door = k => { if (hasDoors) car.setDoor('fl', clamp(k, 0, 1)); };
    function doorPoint(side) {
      if ((side || 1) > 0 && car && typeof car.doorStand === 'function') { const p = car.doorStand('fl'); if (p) return l2w(new T.Vector3(p.x, 0, p.z), v3()); }
      const d = (side || 1) > 0 ? (car && car.doorL) || new T.Vector3(1.45, 0, 0) : (car && car.doorR) || new T.Vector3(-1.45, 0, 0); return l2w(new T.Vector3(d.x * 0.93, 0, d.z + 0.1), v3());
    }
    // где выйти: дверь водителя, другая дверь, перед, зад — первая точка на полотне (не за краем) и не в коллайдере
    function okSpot(p) {
      if (road && road.areas) { const A = road.areas(p.x, p.z, S.s, S.sb); if (!A.some(q => Math.abs(q.e) < (q.e > 0 ? q.wl : q.wr) - 0.35 && (q.rid || q.s > 0.3) && q.s < q.len - 0.3)) return false; }
      else if (road) { const q = road.project(p.x, p.z, S.s); if (Math.abs(q.e) > (q.e > 0 ? q.wl : q.wr) - 0.35) return false; }
      if (typeof o.collide === 'function') { const r = o.collide(p.x, p.z, 0.3, ground(p.x, p.z)); if (Math.hypot(r[0] - p.x, r[1] - p.z) > 0.05) return false; }
      return true;
    }
    function exitSpot() {
      const hw = cfg.halfW + 0.55, hl = cfg.halfL + 0.9;
      const cands = [[hw, 0.15], [-hw, 0.15], [hw + 0.2, -0.9], [-hw - 0.2, -0.9], [0, hl], [0, -hl], [hw + 0.8, 0.15], [-hw - 0.8, 0.15]].map(([x, z]) => l2w(new T.Vector3(x, 0, z), v3()));
      if (car && typeof car.doorStand === 'function') { const p = car.doorStand('fl'); if (p) cands.unshift(l2w(new T.Vector3(p.x, 0, p.z), v3())); }
      for (const p of cands) if (okSpot(p)) return p;
      // в крайнем случае — у машины со стороны середины дороги
      if (road) { const q = road.project(S.x, S.z, S.s), sg = q.e > 0 ? -1 : 1; return new T.Vector3(S.x + q.lx * sg * 1.6, 0, S.z + q.lz * sg * 1.6); }
      return cands[0];
    }
    function heroIn(hero, opt = {}) {
      if (!hero || !hero.root || !root) return Promise.resolve(false);
      if (S.mode === 'drive' && S.hero === hero) return Promise.resolve(true);
      S.hero = hero;
      const fin = () => {
        body().add(hero.root); hero.root.position.copy(seatLocal()); hero.root.rotation.set(0, 0, 0);
        if (hero.body) { hero.body.position.y = 0; hero.body.rotation.x = 0; }
        S.tween = null; S.mode = 'drive'; S.stuckT = 0;
        return true;
      };
      if (opt.instant) return Promise.resolve(fin());
      S.mode = 'enter';
      const from = hero.root.getWorldPosition(v3()), dp = doorPoint(1);
      return new Promise(res => {
        // к двери (0–0,4), [дверь открывается], садится (0,4–0,85 у седана, 0,4–1 у открытой машинки), [дверь закрывается]
        const kIn = hasDoors ? 0.85 : 1;
        S.tween = { t: 0, dur: hasDoors ? 1.15 : 0.8, walk: true, tick(k) {
          const seatW = l2w(seatLocal(), v3());
          if (hasDoors) door(k < 0.85 ? (k - 0.2) / 0.22 : 1 - (k - 0.85) / 0.15);
          if (k < 0.4) { const e = k / 0.4; const x = from.x + (dp.x - from.x) * e, z = from.z + (dp.z - from.z) * e; hero.root.position.set(x, ground(x, z), z); hero.root.rotation.set(0, Math.atan2(dp.x - from.x, dp.z - from.z), 0); this.walk = true; }
          else { const e = Math.min(1, (k - 0.4) / (kIn - 0.4)), ee = e * e * (3 - 2 * e); this.walk = false; const gy = ground(dp.x, dp.z); hero.root.position.set(dp.x + (seatW.x - dp.x) * ee, gy + (seatW.y - gy) * ee + Math.sin(e * PI) * (hasDoors ? 0.12 : 0.45), dp.z + (seatW.z - dp.z) * ee); hero.root.rotation.y += angDiff(S.ry, hero.root.rotation.y) * Math.min(1, e * 1.5); }
        }, done() { door(0); res(fin()); } };
      });
    }
    function heroOut(hero, scene, opt = {}) {
      hero = hero || S.hero;
      if (!hero || !hero.root) return Promise.resolve(null);
      if (S.mode === 'parked') return Promise.resolve(null);
      const go = () => {
        S.mode = 'exit'; S.v = 0;
        const spot = exitSpot(), gy = ground(spot.x, spot.z);
        const ry = Math.atan2(spot.x - S.x, spot.z - S.z);
        const parent = scene || (root && root.parent);
        if (parent) parent.attach(hero.root);
        hero.root.rotation.set(0, hero.root.rotation.y, 0);
        const from = hero.root.position.clone(), ry0 = hero.root.rotation.y;
        const out = { x: spot.x, y: gy, z: spot.z, ry };
        const fin = () => { hero.root.position.set(spot.x, gy, spot.z); hero.root.rotation.set(0, ry, 0); S.tween = null; S.mode = 'parked'; S.hero = null; apply(); return out; };
        if (opt.instant) return fin();
        return new Promise(res => {
          S.tween = { t: 0, dur: hasDoors ? 0.95 : 0.55, walk: false, tick(k) {
            if (hasDoors) door(k < 0.75 ? k / 0.22 : 1 - (k - 0.75) / 0.25);
            const k2 = hasDoors ? clamp((k - 0.18) / 0.57, 0, 1) : k, e = k2 * k2 * (3 - 2 * k2);
            hero.root.position.set(from.x + (spot.x - from.x) * e, from.y + (gy - from.y) * e + Math.sin(k2 * PI) * (hasDoors ? 0.12 : 0.4), from.z + (spot.z - from.z) * e);
            hero.root.rotation.y = ry0 + angDiff(ry, ry0) * e;
          }, done() { door(0); res(fin()); } };
        });
      };
      if (Math.abs(S.v) > 0.05 && !opt.instant) {
        S.mode = 'stopping';
        return new Promise(res => { S.onStop = () => { S.onStop = null; Promise.resolve(go()).then(res); }; });
      }
      return Promise.resolve(go());
    }
    function animState() {
      const tw = S.tween, k = tw ? tw.t / tw.dur : 0;
      const sit = S.mode === 'drive' || S.mode === 'stopping' || (S.mode === 'enter' && k > 0.55) || (S.mode === 'exit' && k < 0.35);
      return { speed: S.mode === 'enter' && tw && tw.walk ? 1.4 : 0, sitting: !!sit, sitPose: 'chair', idle: false, turnRate: 0, waving: false, drive: sit ? driveOpt() : null };
    }

    /* --- шаг физики --- */
    function update(dt, inp) {
      inp = inp || {};
      dt = Math.min(Math.max(dt, 0), 0.05);
      if (dt <= 0) return { bumped: false, edge: false, s: S.s, e: S.e, onRoad: S.onRoad, surface: S.kind };
      if (S.tween) { S.tween.t += dt; const k = Math.min(1, S.tween.t / S.tween.dur); S.tween.tick(k); if (k >= 1 && S.tween) S.tween.done(); }
      const driving = S.mode === 'drive';
      /* --- что хочет водитель (только ввод игрока: ни подруливания, ни сброса скорости в поворотах) --- */
      let target = 0, brake = false, steerIn = 0;
      if (!driving) { brake = true; steerIn = S.steer / Math.max(1e-3, steerLimit()); }
      else if (inp.auto) { const pi = pilot(inp); target = pi.thr > 0 ? cfg.vmax * pi.thr : pi.thr < 0 ? (S.v > 0.6 ? 0 : -cfg.vrev) : 0; if ((pi.thr < 0 && S.v > 0.6) || pi.brake) brake = true; steerIn = -pi.str; }
      else if (inp.dir && inp.dir[2] > 0.08) {
        const [dx, dz, mag] = inp.dir, a = Math.atan2(dx, dz), err = angDiff(a, S.ry);
        if (Math.abs(err) > 2.1 && S.v < 1.2) { const er = angDiff(a, S.ry + PI); target = -Math.min(cfg.vrev, mag * 4.5); steerIn = clamp(-er * 2.2, -1, 1); }
        else { target = (inp.thr != null ? clamp(inp.thr, 0, 1) : mag) * cfg.vmax; steerIn = clamp(err * 2.2, -1, 1); }
      } else {
        const thr = inp.thr || 0;
        target = thr > 0 ? cfg.vmax * Math.min(1, thr) : thr < 0 ? (S.v > 0.6 ? 0 : -cfg.vrev) : 0;
        if (thr < 0 && S.v > 0.6) brake = true;
        if (inp.str) steerIn = -clamp(inp.str, -1, 1);
      }
      if (inp.brake) { target = 0; brake = true; }
      S.braking = brake && Math.abs(S.v) > 0.2;
      // не застрять: газ упёрся (в камень, лавочку или носом в край) дольше 1,5 с и машина не двигается — сама откатывается
      // назад ~0,9 с, ПРЯМО (руль не трогает); дальше снова игрок
      const nearEnd = road && (S.s < 4 || S.s > road.len - 4);
      if (driving && S.unstickT <= 0 && S.stuckT > 1.5 && target > 1 && !nearEnd) { S.unstickT = 0.9; S.unstickDir = S.v >= -0.05 ? -1 : 1; }
      let unsticking = false;
      if (S.unstickT > 0) { S.unstickT -= dt; unsticking = true; target = S.unstickDir * cfg.vrev * 0.8; brake = false; }
      S.reversing = driving && !unsticking && !inp.auto && (target < -0.1 || S.v < -0.3 && !(inp.thr > 0));
      /* --- руль: плавно, острота от скорости, сам возвращается в центр, когда отпустили --- */
      const smax = steerLimit();
      S.steer += (clamp(steerIn, -1, 1) * smax - S.steer) * damp(cfg.steerRate, dt);
      /* --- скорость: газ, тормоз, естественный накат; уклон --- */
      let a;
      if (brake) a = cfg.brake;
      else if (Math.abs(target) > Math.abs(S.v) + 0.01 && Math.sign(target) === Math.sign(S.v || target)) a = cfg.acc;
      else if (target !== 0 && Math.sign(target) !== Math.sign(S.v) && Math.abs(S.v) > 0.05) a = cfg.brake * 0.6;
      else a = cfg.roll;
      const goal = brake ? 0 : target === 0 ? 0 : (Math.abs(target) > Math.abs(S.v) || Math.sign(target) !== Math.sign(S.v) ? target : S.v);
      let dv = clamp(goal - S.v, -a * dt, a * dt);
      if (!brake && target === 0) dv = -Math.sign(S.v) * Math.min(Math.abs(S.v), cfg.roll * dt);
      // мотор тянет в гору чуть слабее, под гору чуть бодрее; стоим без газа — ручник: не катимся
      const moving = Math.abs(S.v) > 0.25 || Math.abs(target) > 0.1;
      const gAcc = moving && !brake ? -9.8 * Math.sin(S.pitchG) * cfg.gravK : 0;
      S.v += dv + gAcc * dt;
      S.v = clamp(S.v, -cfg.vrev * 1.2, cfg.vCap);
      if (Math.abs(target) < 0.05 && Math.abs(S.v) < 0.06) S.v = 0;
      const wLim = yawLimit(); let w = S.v / cfg.wb * Math.tan(S.steer); w = clamp(w, -wLim, wLim);
      let ry = S.ry + w * dt, nx = S.x + Math.sin(ry) * S.v * dt, nz = S.z + Math.cos(ry) * S.v * dt;

      /* --- мягкий край: ни ограждений, ни обрыва — машина в «мягком щебне» у края гасит скорость и ползёт вдоль --- */
      let bumped = false, onRoad = false, edge = false, edgeAt = null;
      if (road) {
        const A = road.areas ? road.areas(nx, nz, S.s, S.sb) : [road.project(nx, nz, S.s)];
        const overOf = (q, ryy) => {
          const rel = angDiff(ryy, q.th), ext = cfg.halfW * Math.abs(Math.cos(rel)) + cfg.halfL * 0.62 * Math.abs(Math.sin(rel));
          const limL = Math.max(0, q.wl - ext - cfg.edgePad), limR = Math.max(0, q.wr - ext - cfg.edgePad);
          return q.e > limL ? q.e - limL : q.e < -limR ? q.e + limR : 0;
        };
        let best = A[0], bo = overOf(A[0], ry);
        for (let k = 1; k < A.length; k++) { const q = A[k]; if (q.s < 0.5 && q.rid) continue; const ov = overOf(q, ry); if (Math.abs(ov) < Math.abs(bo)) { best = q; bo = ov; } }
        if (bo !== 0) {
          const q = best, rel = angDiff(ry, q.th);
          nx -= q.lx * bo; nz -= q.lz * bo;
          const vLat = S.v * Math.sin(rel);   // + влево
          if (vLat * bo > 0) {
            const into = Math.abs(Math.sin(rel));
            if (Math.abs(vLat) > 1.1 && S.edgeT > 0.5) { bumped = true; edgeAt = { q, sg: Math.sign(bo) }; }
            const keep = Math.max(cfg.creep, Math.abs(S.v) * Math.abs(Math.cos(rel))) * Math.sign(S.v || 1);
            if (Math.abs(S.v) > Math.abs(keep)) S.v += (keep - S.v) * Math.min(1, damp(9, dt) + into * 0.35);
          }
          edge = true; S.edgeT = 0;
          // после сдвига — ещё раз по краю (угол кузова)
          const A2 = road.areas ? road.areas(nx, nz, q.s, S.sb) : [road.project(nx, nz, q.s)];
          let b2 = A2[0], o2 = overOf(A2[0], ry); for (let k = 1; k < A2.length; k++) { if (A2[k].s < 0.5 && A2[k].rid) continue; const ov = overOf(A2[k], ry); if (Math.abs(ov) < Math.abs(o2)) { b2 = A2[k]; o2 = ov; } }
          if (o2 !== 0) { nx -= b2.lx * o2; nz -= b2.lz * o2; }
        }
        // углы кузова — каждый по своей проекции (ширина полотна меняется: карманы у лавочек, развилка, шпильки)
        for (let pass = 0; pass < 2; pass++) {
          const fx_ = Math.sin(ry), fz_ = Math.cos(ry), lx = fz_, lz = -fx_;
          let worst = 0, wq = null;
          for (const [ox, oz] of CORNERS) {
            const cx = nx + fx_ * oz + lx * ox, cz = nz + fz_ * oz + lz * ox;
            const Ac = road.areas ? road.areas(cx, cz, S.s, S.sb) : [road.project(cx, cz, S.s)];
            let bo2 = 1e9, bq = null;
            for (const q of Ac) { if (q.rid && q.s < 0.5) continue; const W = (q.e > 0 ? q.wl : q.wr) - cfg.edgePad, ov = Math.abs(q.e) - W; if (ov < bo2) { bo2 = ov; bq = q; } }
            if (bq && bo2 > worst) { worst = bo2; wq = bq; }
          }
          if (!wq) break;
          const sg = Math.sign(wq.e); nx -= wq.lx * sg * worst; nz -= wq.lz * sg * worst; edge = true; S.edgeT = 0;
        }
        // волна 7: упёрлась в край (тупик площадки, угол) — скорость сходит к той, с которой машина на самом деле едет вперёд
        // (иначе стоит на месте «на полном ходу»: спидометр, мотор, «Выйти» недоступно); скольжение вдоль края — как было
        if (edge && dt > 0) { const fwd = ((nx - S.x) * Math.sin(ry) + (nz - S.z) * Math.cos(ry)) / dt, vf = Math.sign(S.v) * Math.max(0, fwd * Math.sign(S.v)); if (Math.abs(vf) < Math.abs(S.v) * 0.6) S.v += (vf - S.v) * Math.min(1, damp(9, dt)); }
        // концы дорог: дальше — облако (выходы региона)
        const Pm = road.project(nx, nz, S.s);
        if (Pm.s <= 0.02 && S.v * Math.cos(angDiff(ry, Pm.th)) < 0) { S.v = 0; const q0 = road.sample(0.03); nx = q0.x + q0.lx * Pm.e; nz = q0.z + q0.lz * Pm.e; }
        if (Pm.s >= road.len - 0.02 && S.v * Math.cos(angDiff(ry, Pm.th)) > 0) { S.v = 0; const q1 = road.sample(road.len - 0.03); nx = q1.x + q1.lx * Pm.e; nz = q1.z + q1.lz * Pm.e; }
        S.s = Pm.s; S.e = Pm.e; S.sb = 0; S.rid = 0; onRoad = true;
        const ca = Math.cos(angDiff(ry, Pm.th)); if (ca > 0.35) S.along = 1; else if (ca < -0.35) S.along = -1;
      }
      // прочие препятствия: три круга по длине кузова
      let colHit = false;
      for (let pass = 0; pass < 2; pass++) {
        const fx_ = Math.sin(ry), fz_ = Math.cos(ry);
        for (const k of [-1.15, 0, 1.1]) {
          const cx = nx + fx_ * k, cz = nz + fz_ * k, list = grid.near(cx, cz);
          if (!list) continue;
          for (const c of list) { const d = pushOut(c, cx, cz, 0.8); if (d) { nx += d[0]; nz += d[1]; if (Math.abs(S.v) > 1.2) bumped = true; S.v *= 0.85; colHit = true; } }
        }
      }
      const moved = Math.hypot(nx - S.x, nz - S.z) + Math.abs(angDiff(ry, S.ry)) * 1.5;
      S.x = nx; S.z = nz; S.ry = ry; S.onRoad = onRoad;
      if (bumped && S.bumpT > 0.5) { S.squash = 1; S.bumpT = 0; } else if (bumped) bumped = false;
      S.bumpT += dt; S.edgeT += dt;
      if (bumped && edge) S.edges++;
      S.stuckT = driving && !unsticking && Math.abs(target) > 1 && moved / dt < 0.35 && (edge || colHit || Math.abs(S.v) < 0.4) ? S.stuckT + dt : 0;
      S.spin += S.v * dt / cfg.wheelR; S.odo += Math.abs(S.v) * dt;
      S.squash = Math.max(0, S.squash - dt * 2.2); S.sq = Math.sin(S.squash * PI * 3) * S.squash * 0.9;
      S.bp += ((-dv / Math.max(dt, 1e-3)) * 0.006 - S.bp) * Math.min(1, dt * 6);
      S.br += (clamp(-w * S.v * 0.012, -0.07, 0.07) - S.br) * Math.min(1, dt * 5);
      /* --- колёса на землю: ровная земля — плавно (высота, тангаж, крен), неровности — пружиной подвески (подпрыгивает) --- */
      sampleWheels(true);
      const pl = planeOf(WH.g);
      S.yb += (pl[0] - S.yb) * damp(26, dt); if (S.yb < pl[0] - 0.08) S.yb = pl[0] - 0.08;
      S.pitchG += (pl[1] - S.pitchG) * damp(14, dt); S.rollG += (pl[2] - S.rollG) * damp(14, dt);
      const d = WH.dz, syT = (d[0] + d[1] + d[2] + d[3]) / 4 * 1.3;
      const spT = Math.atan2((d[0] + d[1] - d[2] - d[3]) / 2, cfg.wf - cfg.wr) * 1.3, srT = Math.atan2((d[0] + d[2] - d[1] - d[3]) / 2, cfg.track * 2) * 1.0;
      // толчок: колесо резко провалилось в яму или наехало на камень — кузов вздрагивает (сильнее на скорости)
      if (WH.pdz) {
        const k = WH.pdz, dd = [d[0] - k[0], d[1] - k[1], d[2] - k[2], d[3] - k[3]], kick = (dd[0] + dd[1] + dd[2] + dd[3]) * sm(1, 8, Math.abs(S.v));
        if (Math.abs(kick) > 0.004) { S.svy += kick * 7; S.svp += (dd[0] + dd[1] - dd[2] - dd[3]) * 4.5; S.svr += (dd[0] + dd[2] - dd[1] - dd[3]) * 4.5; }
      }
      WH.pdz = d.slice();
      const ks = cfg.susK, cs = 2 * cfg.susZ * Math.sqrt(ks), kt = cfg.tiltK, ct = 2 * cfg.tiltZ * Math.sqrt(kt);
      const sub = dt > 0.02 ? 2 : 1, h = dt / sub;
      for (let n = 0; n < sub; n++) {
        S.svy += ((syT - S.sy) * ks - S.svy * cs) * h; S.sy += S.svy * h;
        S.svp += ((spT - S.sp) * kt - S.svp * ct) * h; S.sp += S.svp * h;
        S.svr += ((srT - S.sr) * kt - S.svr * ct) * h; S.sr += S.svr * h;
      }
      S.sy = clamp(S.sy, -0.1, 0.1); S.sp = clamp(S.sp, -0.08, 0.08); S.sr = clamp(S.sr, -0.08, 0.08);
      S.y = S.yb + S.sy;
      // покрытие под машиной (для звука/брызг): самое «мокрое» из колёс
      let kind = WH.kind[0] || 'gravel', wet = 0; for (let k = 0; k < 4; k++) { if (WH.wet[k] > wet) { wet = WH.wet[k]; } if (WH.kind[k] === 'puddle' || WH.kind[k] === 'mud') kind = WH.kind[k]; }
      S.kind = kind; S.wet = wet;
      apply();
      emitFx(dt, edgeAt);
      // звук мотора: за рулём (и пока дотормаживает перед выходом) — обороты от скорости и газа; вышла — мотор глохнет
      if (window.EngineSound) { ES.speed = S.v; ES.throttle = driving ? Math.abs(target) / cfg.vmax : 0; ES.braking = !!S.braking; ES.driving = driving || S.mode === 'stopping'; EngineSound.update(ES, dt); }
      if (S.mode === 'stopping' && Math.abs(S.v) < 0.05 && S.onStop) S.onStop();
      return { bumped, edge, s: S.s, e: S.e, onRoad, surface: kind, rid: S.rid };
    }

    /* --- брызги, пыль --- */
    function emitFx(dt, edgeAt) {
      if (!root) return;
      if (!fx.pts.parent && root.parent) fx.attach(root.parent);
      const fx_ = Math.sin(S.ry), fz_ = Math.cos(S.ry), lx = fz_, lz = -fx_, av = Math.abs(S.v);
      // удар о мягкий край: облачко пыли (зимой — снега) у угла кузова
      if (edgeAt) {
        const q = edgeAt.q, sg = edgeAt.sg, cx = S.x + q.lx * sg * 0.9 + fx_ * 1.2 * Math.sign(S.v || 1), cz = S.z + q.lz * sg * 0.9 + fz_ * 1.2 * Math.sign(S.v || 1), cy = ground(cx, cz) + 0.15;
        for (let k = 0; k < 9; k++) { const a = Math.random() * PI * 2, sp = 0.4 + Math.random() * 0.9; fx.spawn(cx + Math.cos(a) * 0.3, cy, cz + Math.sin(a) * 0.3, Math.cos(a) * sp + q.lx * sg * 0.6, 0.5 + Math.random() * 0.8, Math.sin(a) * sp + q.lz * sg * 0.6, 0.9 + Math.random() * 0.6, winter ? 'snow' : 'dust', 0.75, 0.2); }
      }
      // брызги из-под задних колёс: лужа и грязь (у лужи — ещё и всплеск при въезде)
      const inWater = WH.kind[2] === 'puddle' || WH.kind[3] === 'puddle' || WH.kind[0] === 'puddle' || WH.kind[1] === 'puddle';
      if (inWater && !S.lastPuddle && av > 1.5) {
        for (let k = 0; k < 16; k++) { const sd = k % 2 ? 1 : -1, wx = S.x + lx * sd * 0.8 + fx_ * 0.9, wz = S.z + lz * sd * 0.8 + fz_ * 0.9; fx.spawn(wx, S.y + 0.15, wz, lx * sd * (0.8 + Math.random() * 1.4) + fx_ * av * 0.15, 1.8 + Math.random() * 1.8, lz * sd * (0.8 + Math.random() * 1.4) + fz_ * av * 0.15, 0.55 + Math.random() * 0.35, 'water', 0.9, 9); }
        for (let k = 0; k < 4; k++) { const sd = k % 2 ? 1 : -1; fx.spawn(S.x + lx * sd * 1.0 + fx_ * 0.6, S.y + 0.35, S.z + lz * sd * 1.0 + fz_ * 0.6, lx * sd * 0.6, 0.6, lz * sd * 0.6, 0.6 + Math.random() * 0.3, 'mist', 0.55, 0.3); }
      }
      S.lastPuddle = inWater;
      S.splashT -= dt;
      for (const k of [2, 3]) {
        const muddy = WH.kind[k] === 'puddle' || WH.kind[k] === 'mud' || WH.wet[k] > 0.7;
        if (muddy && av > 1.2 && S.splashT <= 0) {
          const [ox, oz] = WOFF[k], wx = S.x + fx_ * oz + lx * ox, wz = S.z + fz_ * oz + lz * ox, n = av > 6 ? 2 : 1;
          for (let j = 0; j < n; j++) fx.spawn(wx + lx * Math.sign(ox) * 0.1, S.y + 0.2, wz, -fx_ * av * 0.28 * Math.sign(S.v) + lx * Math.sign(ox) * (0.3 + Math.random() * 0.6), 1.3 + Math.random() * 1.4, -fz_ * av * 0.28 * Math.sign(S.v) + lz * Math.sign(ox) * (0.3 + Math.random() * 0.6), 0.45 + Math.random() * 0.3, WH.kind[k] === 'puddle' ? 'water' : 'mud', 0.9, 9);
        }
      }
      if (S.splashT <= 0) S.splashT = 0.045;
      // пыль на сухом щебне и грунте (осенью), снежная пыль зимой — редко и слабо
      S.dustT -= dt;
      const dry = WH.wet[2] < 0.35 && WH.wet[3] < 0.35 && WH.kind[2] !== 'asph';
      if (dry && av > 5.5 && S.dustT <= 0) {
        S.dustT = 0.16 - 0.06 * sm(6, 12, av);
        const k = Math.random() < 0.5 ? 2 : 3, [ox, oz] = WOFF[k], wx = S.x + fx_ * (oz - 0.3) + lx * ox, wz = S.z + fz_ * (oz - 0.3) + lz * ox;
        fx.spawn(wx, S.y + 0.25, wz, -fx_ * av * 0.12 + (Math.random() - 0.5) * 0.4, 0.25 + Math.random() * 0.3, -fz_ * av * 0.12 + (Math.random() - 0.5) * 0.4, 1.1 + Math.random() * 0.6, winter ? 'snow' : 'dust', 0.32, 0.05);
      }
      fx.update(dt);
    }

    if (o.start) teleport(o.start); else if (road) teleport(0); else apply();
    return {
      S, pos, road, car, cfg, update, teleport, collider, fx, tap,
      get speed() { return S.v; }, get heading() { return S.ry; }, get mode() { return S.mode; },
      get reversing() { return !!S.reversing; },
      // подпись тормозной педали: «назад» — пока тормоз ведёт машину задом, иначе «тормоз»
      brakeLabel() { return S.reversing ? 'назад' : 'тормоз'; },
      heroIn, heroOut, animState, seatLocal, driveOpt, doorPoint, exitSpot,
      canExit() { return S.mode === 'drive' && Math.abs(S.v) < cfg.exitV; },
      canEnter(x, z) { return S.mode === 'parked' && Math.hypot(x - S.x, z - S.z) < 3.3; },
      pilot,
      info() { return { s: +S.s.toFixed(2), e: +S.e.toFixed(2), v: +S.v.toFixed(2), kmh: Math.round(Math.abs(S.v) * 3.6), x: +S.x.toFixed(2), y: +S.y.toFixed(2), z: +S.z.toFixed(2), ry: +S.ry.toFixed(3), pitch: +S.pitchG.toFixed(3), roll: +S.rollG.toFixed(3), stuck: S.stuckT > 3, mode: S.mode, rid: S.rid, sb: +S.sb.toFixed(1), surface: S.kind, wet: +S.wet.toFixed(2), steer: +S.steer.toFixed(3), sus: +S.sy.toFixed(3), edges: S.edges }; },
      reset() { if (road) teleport(S.s); },
      dispose() {
        if (blob) { blob.parent && blob.parent.remove(blob); blob.userData.own.forEach(x => x.dispose()); blob = null; }
        fx.dispose();
        if (dyn) { const i = dyn.indexOf(collider); if (i >= 0) dyn.splice(i, 1); }
      },
    };
  }

  /* ---------- раскладка телефона: палец слева — руль, педали — газ/тормоз (без подруливания) ---------- */
  function touchInput(o = {}) {
    const dz = 0.08, jx = o.jx || 0, ax = Math.max(0, Math.abs(jx) - dz) / (1 - dz);
    const str = Math.sign(jx) * Math.pow(Math.min(1, ax), 1.35);
    // газ от джойстика — по силе отклонения в конусе «вверх» (±70°): палец вверх и вбок — и рулит, и едет (раньше руль срезал газ)
    const jy = o.jy || 0, n = Math.min(1, Math.hypot(jx, jy)), up = n > 1e-6 ? -jy / n : 0;
    let thr = o.gas ? 1 : up > 0.34 && n > 0.35 ? Math.min(1, (n - 0.35) / 0.45) : 0;
    let brake = false;
    if (o.brake) { if ((o.v || 0) > 0.6) brake = true; else thr = -1; }
    return { thr, str, brake };
  }

  /* ---------- камера-следилка для горной дороги ---------- */
  function chase(o) {
    const T = o.THREE || window.THREE, cam = o.camera, ground = typeof o.ground === 'function' ? o.ground : () => -1e9;
    const st = { yaw: 0, bias: 0, lw: 0, calm: 1, lookP: null, init: false, idleT: 0, iw: 0, th: 0, th0: 0, pos: new T.Vector3(), look: new T.Vector3(), want: new T.Vector3(), lk: new T.Vector3(), p: new T.Vector3(), q: new T.Vector3(), h: new T.Vector3(), aim: new T.Vector3() };
    function update(dt, d, opt) {
      opt = opt || {};
      const S = d.S, cf = d.cfg || CFG, vmax = cf.vmax || CFG.vmax, sp = Math.min(1, Math.abs(S.v) / vmax);
      const k = d.road ? (S.along < 0 ? d.road.kmax(Math.max(0, S.s - 12), 12) : d.road.kmax(S.s, 12)) : 0, kN = clamp(k * 7, 0, 1);   // волна 7: поворот впереди и при езде против s (вверх по серпантину села)
      const y = S.yb != null ? S.yb : S.y;   // ровная высота — камера не трясётся на ямах
      if (!st.init) st.yaw = S.ry;
      st.bias += ((opt.yawBias || 0) - st.bias) * damp(0.8, dt);
      // W7 (желание 3): палец по экрану — камера вокруг машины (opt.yawOff, рад), пока палец ведёт — без запаздывания
      const yawOff = opt.yawOff || 0, yawT = S.ry + st.bias + yawOff;
      st.yaw += angDiff(yawT, st.yaw) * (st.init ? damp(yawOff ? 7 : 1 / 0.5, dt) : 1);
      // волна 4: чуть ближе и ниже, чтобы за рулём было видно героиню
      // W4A: машина длиннее купе (седан: halfL 2,42) — камера дальше и выше: видно героиню за рулём сквозь стеклянную крышу
      const ext = d.cfg && d.cfg.halfL ? Math.max(0, d.cfg.halfL - CFG.halfL) : 0;
      let dist = (opt.dist || 8.6 + ext * 1.15) + sp * 2 + kN * 1.6, hgt = (opt.height || 3.7 + ext * 1.0) + kN * 2.4 + sp * 0.5;
      // W7: камера повёрнута пальцем вбок — точка взгляда на самой машине (а не впереди неё): в узком кадре телефона машина посередине
      const fx = Math.sin(S.ry), fz = Math.cos(S.ry), ahead = (1.5 + sp * 3 * Math.sign(S.v || 1)) * (1 - Math.min(1, Math.abs(yawOff) / 0.6));
      st.lk.set(S.x + fx * ahead, y + 1.15, S.z + fz * ahead);
      // «посмотри туда» (W7, желание 9: «камера сама уходит на село, и я врезаюсь»): поворот к цели — не больше 20° от курса,
      // точка взгляда остаётся на машине (к цели — не дальше 2 м), камера чуть выше и угол чуть шире — село входит в кадр сзади
      // машины, а машина — в середине кадра, и руль работает как обычно. Руль заметно повёрнут или впереди крутой поворот —
      // «посмотри» гаснет сам (за 0,2 с), отпустил — снова (за 0,7 с)
      const lim = cf.steerMax + ((cf.steerHi || cf.steerMax) - cf.steerMax) * sm(3, vmax, Math.abs(S.v));
      const calmT = (1 - sm(0.18, 0.5, Math.abs(S.steer) / Math.max(0.1, lim))) * (1 - sm(0.35, 0.85, kN));
      st.calm += (calmT - st.calm) * damp(calmT < st.calm ? 5 : 1.4, dt);
      const lw = opt.look ? clamp(opt.lookW == null ? 1 : opt.lookW, 0, 1) * st.calm : 0;
      st.lw += (lw - st.lw) * damp(3, dt);
      if (st.lw > 0.002 && (opt.look || st.lookP)) {
        if (opt.look) st.lookP = opt.look;
        const L = st.lookP, ya = Math.atan2(L.x - S.x, L.z - S.z), e = sm(0, 1, st.lw);
        const da = clamp(angDiff(ya, S.ry), -0.35, 0.35);
        st.yaw += angDiff(S.ry + st.bias + yawOff + da * e, st.yaw) * damp(4, dt) * e;
        const lx = L.x - S.x, lz = L.z - S.z, ll = Math.hypot(lx, lz) || 1, sh = Math.min(2, ll * 0.04);
        st.lk.lerp(st.p.set(st.lk.x + lx / ll * sh, y + 1.2, st.lk.z + lz / ll * sh), e);
        hgt += 1.3 * e; dist += 0.8 * e;
      }
      // W7 (желание 3): вверх-вниз пальцем (opt.pitch, рад, + вверх) — камера по дуге вокруг точки взгляда: вниз — выше,
      // вверх — ниже и ближе (машина и героиня внизу кадра, сверху — небо); у земли не ниже ~0,9 м, дальше поднимается взгляд
      st.th0 = -Math.atan2(hgt - 1.15, dist); st.th = st.th0;
      const pu = opt.pitch || 0;
      if (pu) {
        const R = Math.hypot(dist, hgt - 1.15), th = clamp(st.th0 + pu, -0.8, 0.42), R2 = R * (1 - 0.3 * Math.max(0, th) / 0.42);
        st.th = th; dist = R2 * Math.cos(th); hgt = 1.15 - R2 * Math.sin(th);
      }
      st.want.set(S.x - Math.sin(st.yaw) * dist, y + hgt, S.z - Math.cos(st.yaw) * dist);
      // волна 4: машина стоит (газ отпущен) дольше 2,5 с — камера плавно заходит спереди со стороны водителя и показывает
      // героиню за рулём (в закрытом седане сзади её не видно: крыша и стойка); тронулась — снова за машиной. opt.idle = false — выкл.
      // W7: пока игрок сам смотрит пальцем (yawOff / pitch), камера спереди не заходит
      st.idleT = opt.idle !== false && Math.abs(S.v) < 0.3 && (!d.mode || d.mode === 'drive') && !opt.look && !yawOff && !pu ? st.idleT + dt : 0;
      const iT = st.idleT > 2.5 ? 1 : 0; st.iw += (iT - st.iw) * damp(iT ? 1.1 : 3.5, dt);
      if (st.iw > 0.002 && d.car) {
        const e = sm(0, 1, st.iw), lx = fz, lz = -fx, c = d.car, hs = (c.heroSeat || { x: 0.31, y: 0.2, z: 0.06 });
        st.q.set(S.x + lx * 3.3 + fx * 5.0, y + 2.0, S.z + lz * 3.3 + fz * 5.0);
        st.h.set(S.x + lx * hs.x * 0.6 + fx * hs.z * 0.6, y + (hs.y + 1.15) * 0.62 + 0.35, S.z + lz * hs.x * 0.6 + fz * hs.z * 0.6);   // между лицом и машиной: в кадре обе
        st.want.lerp(st.q, e); st.lk.lerp(st.h, e);
      }
      // W6++: «посмотри туда» уводил камеру за машину со стороны цели — на горной дороге (село слева) это скала справа:
      // камера поднималась над её верхом на 14–17 м, и машина уходила из кадра. Пока камера смотрит на цель, она не уходит
      // туда, где земля выше машины, — подтягивается к машине по горизонтали (не ближе 2,5 м) и опускается (до 2,1 м над
      // машиной): в кадре и машина внизу, и село за ней. Поправка — с весом взгляда (как поворот выше): когда взгляд гаснет,
      // камера плавно возвращается, а не прыгает на прежнее место; шаг 28 % уточняется пробой посередине
      // W7: то же, когда игрок сам повернул камеру вбок пальцем (yawOff): со стороны скалы камера не лезет на склон
      const wPull = Math.max(st.lw, Math.min(1, Math.abs(yawOff) / 0.5));
      if (wPull > 0.002) {
        const hx = st.want.x - S.x, hz = st.want.z - S.z, hd = Math.hypot(hx, hz) || 1;
        let k = 1, free = false;
        for (let it = 0; it < 7 && hd * k > 2.5; it++) { if (ground(S.x + hx * k, S.z + hz * k) < y + 1.2) { free = true; break; } k = Math.max(2.5 / hd, k * 0.72); }
        if (free && k < 1) { const km = Math.min(1, (k + k / 0.72) / 2); if (ground(S.x + hx * km, S.z + hz * km) < y + 1.2) k = km; }
        if (k < 1) {
          const e = sm(0, 1, wPull);
          st.want.x += (S.x + hx * k - st.want.x) * e; st.want.z += (S.z + hz * k - st.want.z) * e;
          st.want.y += (y + 2.1 + (st.want.y - y - 2.1) * k - st.want.y) * e;
        }
      }
      // склон не загораживает: камера над землёй и над линией взгляда
      const up = Math.max(0, st.th) / 0.42, gy = ground(st.want.x, st.want.z), gMin = 1.5 - 0.8 * up;
      if (st.want.y < gy + gMin) st.want.y = gy + gMin;
      for (const t of [0.3, 0.55, 0.8]) {
        st.p.lerpVectors(st.lk, st.want, t); const g = ground(st.p.x, st.p.z) + 0.7;
        if (st.p.y < g) st.want.y += (g - st.p.y) / t;
      }
      if (!st.init) { st.pos.copy(st.want); st.look.copy(st.lk); st.init = true; }
      st.pos.lerp(st.want, damp(6, dt)); st.look.lerp(st.lk, damp(10, dt));
      cam.position.copy(st.pos);
      // взгляд вверх: камера упёрлась в землю (или поднята склоном) — сама точка взгляда поднимается до нужного наклона
      // машина (середина кузова, ~0,45 м ниже точки взгляда) — не ниже ~72 % высоты кадра, над джойстиком и педалями
      if (st.th > st.th0 + 1e-3) {
        const hd = Math.hypot(st.look.x - st.pos.x, st.look.z - st.pos.z);
        const thE = Math.min(st.th, Math.atan2(st.look.y - 0.45 - st.pos.y, Math.max(0.5, hd)) + Math.atan(0.44 * Math.tan(cam.fov * PI / 360)));
        st.aim.copy(st.look); st.aim.y = Math.max(st.look.y, st.pos.y + hd * Math.tan(thE)); cam.lookAt(st.aim);
      } else cam.lookAt(st.look);
      if (opt.fov !== false) {
        const base = opt.fovBase || (cam.aspect < 0.8 ? 58 : 48), fovT = base + sp * 6 + st.lw * 5;
        if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
      }
    }
    // resume(): продолжить с того места и взгляда, где камера сейчас (после вида из-за руля — плавно наружу, без рывка)
    function resume() { if (!cam) return; st.pos.copy(cam.position); cam.getWorldDirection(st.p); st.look.copy(cam.position).addScaledVector(st.p, 8); }
    return { update, snap() { st.init = false; st.iw = 0; st.idleT = 0; }, resume, st };
  }

  /* ---------- W7 (желание 10): вид «из-за руля» — для города (js/world/main.js) и гор (js/world/regions.js) ----------
     Камера в салоне по car.cockpit (оси car.body: wheel.c — центр руля): позади и выше руля, а не в настоящих глазах — голова
     у героини большая, из глаз руль ушёл бы под самый низ кадра. Камера стоит так, что центр руля — на 66 % высоты кадра (над
     джойстиком и радаром), горизонт — на ~31 % (дорога видна над рамкой стекла). В кадре — руль (крутится вместе с рулением,
     кость руля машины), руки героини на ободе (HeroAnim: руки едут вместе с рулём), приборы, рамка стекла и дорога.
     От героини видны только руки, целые, без срезов: у модели со скелетом на время вида рисуется отдельная сетка «руки» — те же
     буферы и кости, свой индекс (предплечья и кисти по весам скина; лупа — на своей кости interact.js — не входит) и копия
     материала (одна компиляция шейдера на сессию); швы у локтей — за краем кадра или у самого края (седан), ровные и изнутри
     закрытые. Сама героиня, контур и всё, что висит не на кистях (каз, берет, шапочка), прячутся слоем (layers.mask = 0;
     индекс её сетки не трогаем — его правит каз). Статуэтка и кукла (без скелета) в этом виде не рисуются. Крен кузова не
     передаётся (горизонт ровный), тангаж и подвеска — да. renderer в o больше не нужен (плоскостей среза нет).
     opt: { yaw, pitch } — взгляд пальцем (рад: + влево / + вверх; гасит вызывающий). Включение — перелёт 0,45 с; fov 66 (портрет) / 50,
     near 0,05 (не 72: бюджет q=low ≤ 200k — из салона вдоль улицы видно больше, чем из-за машины); выключение возвращает слои,
     fov и near как было. Без выделений памяти в кадре. */
  // сетка «руки» героини для вида из-за руля — одна на сетку героини (город и горы — та же героиня): вес вершины на костях
  // предплечий и кистей (атрибут ckArm); в индексе — треугольники, где он хоть у одной вершины ≥ 0,5, а шов у локтя ровный:
  // фрагменты с весом < 0,5 отбрасывает шейдер рук (без «зубцов» по треугольникам). Буферы — общие с героиней (свои только
  // ckArm и индекс), поэтому сетку рук не dispose()-ят: это сняло бы буферы и у самой героини
  const ARM = /^(forearm|hand)_/, ARMS = new WeakMap();
  // материал рук: копия материала героини (та же текстура — и образ из ателье), чужие патчи шейдера (день-ночь, обводка
  // светом) — цепочкой, а день-ночь саму копию второй раз не патчит (userData.dn = 'none'); обе стороны: срез рукава
  // у локтя изнутри — как подкладка, а не дыра
  function armMat(T, src) {
    const own = n => (Object.prototype.hasOwnProperty.call(src, n) ? src[n] : null), prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');
    const m = src.clone();
    m.side = T.DoubleSide; m.userData.dn = 'none';
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(src, sh, r);
      sh.vertexShader = 'attribute float ckArm;\nvarying float vCkArm;\n' + sh.vertexShader.replace('void main() {', 'void main() {\n\tvCkArm = ckArm;');
      sh.fragmentShader = 'varying float vCkArm;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n\tif (vCkArm < 0.5) discard;');
    };
    m.customProgramCacheKey = () => 'ckArm1|' + (prevKey ? prevKey.call(src) : prev ? String(prev) : '');
    return m;
  }
  // индекс рук — из нынешнего индекса героини (маска образа и каз — вырожденными треугольниками, как есть): A.idx — во всю длину
  // индекса героини (без новых буферов при пересборке), видимая часть — drawRange; A.iv — версия индекса героини на момент сборки
  function armIdx(A, g) {
    const src = g.index.array, kw = A.kw, out = A.idx && A.idx.length === src.length ? A.idx : (A.idx = new src.constructor(src.length));
    let c = 0;
    for (let t = 0; t + 2 < src.length; t += 3) if (Math.max(kw[src[t]], kw[src[t + 1]], kw[src[t + 2]]) >= 0.5) { out[c++] = src[t]; out[c++] = src[t + 1]; out[c++] = src[t + 2]; }
    A.iv = g.index.version; A.n = c;
    return c;
  }
  // индекс героини переписали после сборки рук (образ сменили в ателье или прямо в игре — маска одежды; каз) — руки устарели
  const armStale = rig => { const m = rig && rig.mesh, A = m && ARMS.get(m); return !!(A && m.geometry && m.geometry.index && (A.geo !== m.geometry || A.iv !== m.geometry.index.version)); };
  function armMesh(T, rig) {
    const m = rig && rig.mesh, g = m && m.geometry, sk = m && m.skeleton;
    if (!m || !m.isSkinnedMesh || !g || !g.index || !sk || (g.groups && g.groups.length) || !g.attributes.skinIndex || !g.attributes.skinWeight || !m.material || Array.isArray(m.material)) return null;
    let A = ARMS.get(m);
    if (A && (A.geo !== g || A.nb !== sk.bones.length)) { if (A.mesh) { A.mesh.removeFromParent(); A.mesh.material.dispose(); } A = null; }
    if (A) {
      // материал героини сменился или его перепатчили (день-ночь) — свой материал рук заново
      if (A.mesh && (A.mat0 !== m.material || A.obc !== m.material.onBeforeCompile)) { A.mesh.material.dispose(); A.mesh.material = armMat(T, m.material); A.mat0 = m.material; A.obc = m.material.onBeforeCompile; }
      // Bug B: новый образ переписал индекс героини (рукава, открытые руки) — свой индекс рук заново, в тот же буфер
      if (A.mesh && A.iv !== g.index.version) {
        const ga = A.mesh.geometry; armIdx(A, g);
        if (ga.index.array !== A.idx) ga.setIndex(new T.BufferAttribute(A.idx, 1)); else ga.index.needsUpdate = true;
        ga.setDrawRange(0, A.n);
      }
      return A.mesh;
    }
    A = { mesh: null, geo: g, nb: sk.bones.length, mat0: m.material, obc: m.material.onBeforeCompile, kw: null, idx: null, iv: -1, n: 0 };
    ARMS.set(m, A);
    const keep = sk.bones.map(bn => (ARM.test(bn.name) ? 1 : 0)), kk = i => keep[i] || 0;
    const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = SI.count, kw = A.kw = new Float32Array(n);
    for (let i = 0; i < n; i++) kw[i] = kk(SI.getX(i)) * SW.getX(i) + kk(SI.getY(i)) * SW.getY(i) + kk(SI.getZ(i)) * SW.getZ(i) + kk(SI.getW(i)) * SW.getW(i);
    const c = armIdx(A, g);
    if (c < 300) { ARMS.delete(m); return null; }
    const ga = new T.BufferGeometry();
    for (const k in g.attributes) ga.setAttribute(k, g.attributes[k]);
    ga.setAttribute('ckArm', new T.BufferAttribute(kw, 1));
    ga.setIndex(new T.BufferAttribute(A.idx, 1));
    ga.setDrawRange(0, c);
    if (g.boundingSphere) ga.boundingSphere = g.boundingSphere.clone();
    const am = new T.SkinnedMesh(ga, armMat(T, m.material));
    am.name = 'hero:arms'; am.frustumCulled = false; am.castShadow = false; am.receiveShadow = false; am.raycast = () => {};
    am.bind(sk, m.bindMatrix);
    A.mesh = am;
    return am;
  }

  function cockpit(o) {
    const T = o.THREE || window.THREE, cam = o.camera;
    const st = { on: false, k: 0, fov0: 0, near0: 0, lay: [], am: null, hero: null, lp: new T.Vector3(), lt: new T.Vector3(), wp: new T.Vector3(), wt: new T.Vector3(),
      from: new T.Vector3(), fromL: new T.Vector3(), cur: new T.Vector3(), curL: new T.Vector3() };
    // что держит кисть (предмет в руке) — на виду; остальное под героиней — слоем прочь
    const inHand = m => { for (let q = m.parent; q; q = q.parent) if (q.isBone) return ARM.test(q.name); return false; };
    // что-то надели на героиню уже при виде из-за руля (каз в селе — на её сетке, шапочка — на кости головы) — спрятать и это
    const kidsOf = hero => { const r = hero.rig, hb = r && r.anim && r.anim.bones && r.anim.bones.head; return hero.root.children.length + (r && r.mesh ? r.mesh.children.length : 0) + (hb ? hb.children.length : 0); };
    function hideOn(hero, car) {
      hideOff();
      if (!hero || !hero.root) return;
      st.hero = hero;
      // контур самой машины изнутри не виден (его закрывает кузов), а треугольники стоит — на время вида прячем (бюджет)
      const ol = car && car.outline;
      if (ol && ol.isObject3D) { st.lay.push(ol, ol.layers.mask); ol.layers.mask = 0; }
      const am = st.am = armMesh(T, hero.rig);
      // руки — дочерняя сетка самой героини (её матрица та же; слой у героини не наследуется — руки видны)
      if (am) hero.rig.mesh.add(am);
      hero.root.traverse(m => {
        if (m === am || !(m.isMesh || m.isSprite || m.isPoints || m.isLine) || (am && inHand(m))) return;
        st.lay.push(m, m.layers.mask); m.layers.mask = 0;
      });
      st.kids = kidsOf(hero);
    }
    function hideOff() {
      for (let i = 0; i < st.lay.length; i += 2) st.lay[i].layers.mask = st.lay[i + 1];
      st.lay.length = 0; st.hero = null;
      if (st.am) { st.am.removeFromParent(); st.am = null; }
    }
    function on(b) {
      b = !!b; if (b === st.on) return st.on;
      st.on = b;
      if (b) {
        st.k = 0; st.fov0 = cam.fov; st.near0 = cam.near;
        st.from.copy(cam.position); cam.getWorldDirection(st.wt); st.fromL.copy(cam.position).addScaledVector(st.wt, 6);
      } else {
        hideOff();
        cam.fov = st.fov0 || cam.fov; cam.near = st.near0 || cam.near; cam.updateProjectionMatrix();
      }
      return st.on;
    }
    function update(dt, car, hero, opt) {
      if (!st.on) return false;
      if (!car || !car.body || !car.cockpit || !car.cockpit.wheel) { on(false); return false; }
      opt = opt || {};
      const C = car.cockpit, c = C.wheel.c, body = car.body;
      body.updateWorldMatrix(true, false);
      // кадр: центр руля — на 66 % высоты (на 0,32 полуэкрана ниже середины), горизонт — на ~31 % (0,38 выше): камера на 0,66 м
      // позади центра руля и выше на 0,66·tg(угол между ними); взгляд — так, чтобы руль встал на место. Седан: панель и козырёк
      // приборов высокие — камера не ниже глаз героини (+4 см, иначе дороги за панелью не видно) и не выше крыши, руль — на 68 %
      const fovT = cam.aspect < 0.8 ? 66 : 50, tf = Math.tan(fovT * PI / 360), aH = Math.atan(0.38 * tf);
      const sedan = car.kind === 'sedan', roof = sedan && car.dims && car.dims.height ? car.dims.height - 0.14 : 9;
      let pt0;
      if (!sedan && C.eye) {
        // открытая машина (кабриолет): рамка стекла (1,32) ниже глаз героини (1,73), а камера «руль на 66 %» вставала ниже рамки —
        // её перекладина резала дорогу по горизонту, руль с руками закрывали пол-экрана. Теперь камера почти в глазах (−8 см,
        // на 28 см позади), взгляд поверх стекла: горизонт — на ~33 % высоты, рамка стекла — у нижней четверти, верх руля и
        // руки — у самого низа над кнопками; дорога — на пол-экрана
        st.lp.set(c[0], C.eye[1] - 0.08, C.eye[2] - 0.28);
        pt0 = -Math.atan(0.33 * tf);
      } else {
        const y0 = c[1] + 0.66 * Math.tan(Math.atan(0.32 * tf) + aH), ly = Math.min(Math.max(y0, sedan && C.eye ? C.eye[1] + 0.04 : -9), roof);
        const aW = Math.atan((ly > y0 + 0.01 ? 0.36 : 0.32) * tf);
        st.lp.set(c[0], ly, c[2] - 0.66);
        pt0 = Math.atan2(c[1] - st.lp.y, c[2] - st.lp.z) + aW;
      }
      const yaw = clamp(opt.yaw || 0, -1.3, 1.3), pt = clamp(pt0 + (opt.pitch || 0), -0.9, 0.6), cp = Math.cos(pt);
      st.lt.set(st.lp.x + Math.sin(yaw) * cp * 4, st.lp.y + Math.sin(pt) * 4, st.lp.z + Math.cos(yaw) * cp * 4);
      st.wp.copy(st.lp).applyMatrix4(body.matrixWorld); st.wt.copy(st.lt).applyMatrix4(body.matrixWorld);
      st.k = Math.min(1, st.k + dt / 0.45);
      const e = st.k * st.k * (3 - 2 * st.k);
      if (e > 0.55 && hero && (st.hero !== hero || kidsOf(hero) !== st.kids || armStale(hero.rig))) hideOn(hero, car);
      st.cur.lerpVectors(st.from, st.wp, e); st.curL.lerpVectors(st.fromL, st.wt, e);
      cam.position.copy(st.cur); cam.lookAt(st.curL);
      const nearT = 0.05;
      if (Math.abs(cam.fov - fovT) > 0.05 || cam.near !== nearT) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 6 + (e >= 1 ? 0.2 : 0)); cam.near = nearT; cam.updateProjectionMatrix(); }
      return true;
    }
    // refresh() — героиню переодели (образ прямо в игре): следующий кадр вида заново прячет героиню и собирает руки
    return { on, update, refresh() { st.hero = null; }, get active() { return st.on; }, get blend() { return st.k; }, st, dispose() { on(false); } };
  }

  V.drive = { create, makeCar, chase, cockpit, touchInput, CFG, pushOut, version: 6, FEATURES: { assists: false, softEdge: true, suspension: true, heroSeat: true, exitAnywhere: true, branch: false, cockpit: true } };
})();
