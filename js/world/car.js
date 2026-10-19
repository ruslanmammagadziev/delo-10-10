/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: машинка.
   W7 (желание автора: машина «как на фото»): кузов — жёлтый кабриолет из js/vehicles/cabrio.js (силуэт классической
   заднемоторной спортивной машины: овальные фары на гребнях крыльев, капот ниже крыльев, «утиный хвост», широкие задние
   «бёдра», две трубы, крупные колёса, сложенный мягкий верх под крышкой цвета кузова, низкие кресла, чёрный салон; без значков и надписей,
   номер пустой), 5 вызовов отрисовки.
   Без cabrio.js — прежнее мультяшное ретро-купе (retroBody ниже: круглые фары-«глазки», покатая спина, номер «10·10»).
   Кот и собачка едут сзади (у кабриолета — на крышке за креслами, у купе — на диванчике). На пассажирском месте — папка «дела».
   Руль крутится вместе с колёсами (сетка отделки со скелетом из двух костей — без лишнего вызова).
   Управление «покажи, куда ехать»: джойстик задаёт направление и газ; отпустила — сама тормозит; задний ход
   включается сам; перед стеной и бордюром сама сбавляет ход; о бордюр мягко пружинит и скользит вдоль.
   Ручное управление (телефон — кнопки руля и педали HUD.driveCtl, компьютер — стрелки): газ, руль от скорости (полный руль —
   1,6 рад/с на малом ходу, 1,0 на полном), тормоз, без газа — накатом (ctl.coast); сама не сбавляет — как решил игрок.
   Кабриолет — быстрая машина: 20 м/с, разгон 9,5 м/с², тормоз 13 м/с² (запасное купе и o.speedK — прежние 12 м/с).

   API (совместимо с волной 2: main.js, stand.js, js/village/drive.js)
     WORLD.makeCar(H, o) → car — модель и езда. o = { x, z, ry, color, can(x,z), vmax (8), edge {x,z,r}, layout, speedK (1,5) }
       W6: итоговая скорость = vmax × speedK (по умолчанию 8 × 1,5 = 12 м/с), разгон 5,5 × speedK; car.VMAX — итоговая
       car.update(dt, ctl) → { bumped, edge } — ctl = { dir: [dx,dz,mag] | null, thr, str, brake, coast } (coast — без газа накатом:
         кнопки и педали телефона, HUD.driveCtl)
       car.root, body, wheels, paintMesh, trimMesh, glass, plate, outline, S, place(), reset(path), setColor(hex), VMAX
       W7: car.cockpit = { eye: [x,y,z], wheel: { c: [x,y,z], r, tilt, axis }, gripL, gripR } (оси car.body) — вид «из-за руля»;
         car.lamps { head, tail } (точки фар/фонарей), car.dims, car.driveCfg (размеры для VILLAGE.drive), car.setNight(k) — у кабриолета;
         car.setFar(0 | 1 | 2) — дешёвый дальний вид стоящей машины (кабриолет; js/world/main.js carLod)
       car.seatDriver / seatPass (кот, сзади справа) / seatDog (собачка, сзади слева) / heroSeat (куда ставить корень
         героини в car.body) / doorL / doorR — точки в осях кузова (car.body)
       car.on('edge' | 'bump' | 'horn', fn) / off — 'edge' — машина въехала в зону выезда из города (layout.edge)
       car.horn() — «Би-бип!» (звук; событие 'horn'), car.driveInput() — ровно opt.drive HeroAnim (волна 3):
         { wheel (оси корня героини), wheelR, wheelTilt, steer −1..1 } (+ steerRad, wheelAngle, axis)
     WORLD.makeCarCover(H, car) → Group — чехол с бантом (как в волне 2): cover.setOn(bool)
     WORLD.Car.create({ THREE, scene, kit, layout, car?, cover?, color?, at?, colliders? }) → ctl — посадка и езда в городе:
       ctl.setLocked(bool) / locked — под замком (чехол с бантом); ctl.setCovered(bool)
       ctl.canEnter(x, z) → bool; ctl.enter(hero, { cat, dog, instant }) → Promise<bool> (false — под чехлом: событие 'locked')
       ctl.exit({ instant }) → Promise<{x,z,ry}> (сначала мягко тормозит); ctl.update(dt, input) → { bumped, edge }
       ctl.horn(); ctl.on('edge'|'locked'|'enter'|'exit'|'horn'|'bump', fn); ctl.driveInput(); ctl.animState()
       ctl.mode — 'parked' | 'enter' | 'drive' | 'exit'; ctl.seats — { driver, cat, dog } (оси car.body)
     WORLD.Car.setLocked(bool) / isLocked() — общий флаг (для всех ctl, у которых свой не задан)
     WORLD.Car.hornSound() — две мягкие ноты; WORLD.Car.applyDrivePose(anim, heroRoot, drive, k) — руки на руле (запас
       для HeroAnim без opt.drive; при HeroAnim.DRIVE ничего не делает)
     WORLD.VehiclePose.ride / drive — запасные позы поверх HeroAnim (руки — IK к ручкам/рулю, ноги — к педалям)
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst01 = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  const angDiffG = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  WORLD.CAR_COLORS = [['жёлтый', '#FCD93A'], ['мятный', '#A8D8C4'], ['пудровый', '#F2B8C6'], ['сливочный', '#F6E3B8'], ['вишнёвый', '#D9566E'], ['небесный', '#A9C9EE'], ['графитовый', '#6F6A78']];

  /* ---------- звук гудка: «би-бип» — две мягкие ноты (G.audioBus уважает «звук выкл»), иначе G.sfx('blip') ---------- */
  let ownAC = null;
  function hornSound() {
    try {
      const g = window.G; let ac = null, out = null;
      if (g && typeof g.audioBus === 'function') { out = g.audioBus('sfx'); if (!out) return false; ac = out.context; }
      else { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; if (!ownAC) ownAC = new AC(); ac = ownAC; if (ac.state !== 'running') ac.resume(); out = ac.destination; }
      const t = ac.currentTime + 0.01;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.8; lp.connect(out);
      const note = (t0, f, dur, vol) => ['triangle', 'square'].forEach((w, i) => {
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = w; o.frequency.setValueAtTime(f * (i ? 1.003 : 1), t0); o.frequency.exponentialRampToValueAtTime(f * 1.02, t0 + dur);
        const v = vol * (i ? 0.22 : 1);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(v, t0 + 0.018); gn.gain.setValueAtTime(v, t0 + dur - 0.04); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.06);
        o.connect(gn); gn.connect(lp); o.start(t0); o.stop(t0 + dur + 0.1);
      });
      note(t, 440, 0.12, 0.05); note(t + 0.17, 554, 0.17, 0.05);
      // мотор на миг тише (≈ −8 дБ), чтобы «би-бип» было слышно и на полном ходу
      if (window.EngineSound && EngineSound.duck) EngineSound.duck(0.4, 0.5);
      return true;
    } catch (e) { return false; }
  }

  // склейка нескольких геометрий (позиция, нормаль, цвет, свечение) + жёсткие веса скелета: [[geo, bone], ...]
  function mergeSkinned(T, list) {
    let n = 0, ni = 0; list.forEach(([g]) => { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const names = ['position', 'normal', 'color', 'emis'], arr = {}; names.forEach(k => { arr[k] = new Float32Array(n * 3); });
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let off = 0, io = 0;
    list.forEach(([g, bone]) => {
      const c = g.attributes.position.count;
      names.forEach(k => { if (g.attributes[k]) arr[k].set(g.attributes[k].array, off * 3); });
      for (let i = 0; i < c; i++) { si[(off + i) * 4] = bone; sw[(off + i) * 4] = 1; }
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + off; } else for (let i = 0; i < c; i++) idx[io++] = off + i;
      off += c; g.dispose();
    });
    const mg = new T.BufferGeometry();
    names.forEach(k => mg.setAttribute(k, new T.BufferAttribute(arr[k], 3)));
    mg.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); mg.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
    mg.setIndex(new T.BufferAttribute(idx, 1)); mg.computeBoundingBox(); mg.computeBoundingSphere();
    return mg;
  }

  // ретро-купе прежних волн — запасной кузов, если js/vehicles/cabrio.js не подключён (стенды, старые тесты); сетки — в body / root
  function retroBody(H, o, root, body) {
    const T = H.T, { keep, GEO, put, box, sph, cyl, rbox, toon, cnv, rrect, text } = H;
    const WB = { f: 1.05, r: -1.12 }, WR = 0.31, TRACK = 0.72;

    /* --- кузов: боковой профиль, выдавленный по ширине, потом скруглён и сужен в плане --- */
    const prof = (() => {
      const top = new T.CatmullRomCurve3([[1.8, 0.3], [1.87, 0.46], [1.84, 0.6], [1.68, 0.73], [1.25, 0.84], [0.7, 0.86], [0.55, 0.87], [-0.42, 0.88], [-0.62, 0.97], [-0.95, 0.96], [-1.3, 0.86], [-1.6, 0.7], [-1.8, 0.54], [-1.86, 0.4], [-1.78, 0.3]].map(([z, y]) => new T.Vector3(z, y, 0)), false, 'centripetal').getPoints(60);
      const s = new T.Shape(); s.moveTo(top[0].x, top[0].y); top.forEach(p => s.lineTo(p.x, p.y));
      const arch = (zc, r) => { const n = 14; for (let i = 0; i <= n; i++) { const a = PI - PI * i / n; s.lineTo(zc + Math.cos(a) * r, 0.3 + Math.sin(a) * r); } };
      // низ: сзади вперёд, с арками колёс
      s.lineTo(WB.r - 0.44, 0.3); arch(WB.r, 0.44); s.lineTo(WB.f - 0.44, 0.3); arch(WB.f, 0.44); s.lineTo(1.8, 0.3);
      return s;
    })();
    const CORE = 1.34;
    const bodyG = keep(new T.ExtrudeGeometry(prof, { depth: CORE, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.04, bevelSegments: 4, curveSegments: 6 }));
    bodyG.rotateY(-PI / 2); bodyG.translate(CORE / 2, 0, 0);   // профиль: x фигуры → z машины, выдавливание → x
    { const p = bodyG.attributes.position, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const lerpK = (z, ks) => { for (let i = 0; i < ks.length - 1; i++) { const [z0, k0] = ks[i], [z1, k1] = ks[i + 1]; if (z >= z0 && z <= z1) { const t = sm(z0, z1, z); return k0 + (k1 - k0) * t; } } return z < ks[0][0] ? ks[0][1] : ks[ks.length - 1][1]; };
      const PLAN = [[-1.9, 0.88], [-1.45, 0.98], [-1.05, 1.0], [-0.5, 0.95], [0.2, 0.9], [0.8, 0.94], [1.15, 0.95], [1.6, 0.86], [1.9, 0.8]];
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let k = lerpK(z, PLAN);
        if (y > 0.58) k *= 1 - (y - 0.58) * 0.45;                                   // борта заваливаются внутрь
        k *= 1 + 0.045 * Math.exp(-Math.pow((z - WB.r) / 0.5, 2)) + 0.03 * Math.exp(-Math.pow((z - WB.f) / 0.45, 2));   // «бёдра» над колёсами
        x *= k;
        // капот между крыльями ниже: фары сидят на крыльях, как глазки
        if (z > 0.55) { const ax = Math.abs(x); if (ax < 0.5) y -= 0.1 * (1 - Math.pow(ax / 0.5, 2)) * sm(0.55, 1.0, z) * sm(0.55, 0.72, y); }
        p.setXYZ(i, x, y, z);
      }
      H.smoothCrease(bodyG, 58);
      bodyG.computeBoundingSphere(); bodyG.computeBoundingBox(); }
    const paint = H.addRim(toon(o.color || '#A8D8C4'), 0.9);
    const paintG = new T.Group();
    put(paintG, bodyG, paint);
    // крылья-«стручки» под фарами и маленькие круглые фонари поворотов
    [-1, 1].forEach(s => { put(paintG, GEO.sph, paint, [s * 0.52, 0.8, 1.28], [0.24, 0.17, 0.38]); });
    const paintMesh = new T.Mesh(H.geoOf(paintG), toon('#FFFFFF', { vertexColors: true }));
    paintMesh.material.color.set(o.color || '#A8D8C4'); H.addRim(paintMesh.material, 0.9);
    paintMesh.castShadow = true; paintMesh.receiveShadow = false; body.add(paintMesh);
    const outline = new T.Mesh(paintMesh.geometry, H.outlineMat); outline.castShadow = false; outline.raycast = () => {}; body.add(outline);

    /* --- отделка: хром, салон, сиденья, диванчик, папка, руль, фары, фонари, трубы — один меш с цветами вершин --- */
    const trim = new T.Group();
    const chrome = toon('#EEF0F5'), chromeD = toon('#B9BCC8'), rubber = toon('#4A3F4E'), seat = toon('#F4E6D4'), seatD = toon('#E2CDB6'), cabin = toon('#6B5260'), dash = toon('#7A5F6E');
    const lens = toon('#FFF6DC', { emissive: new T.Color('#FFE2A0'), emissiveIntensity: 0.75 }), amber = toon('#F7B267', { emissive: new T.Color('#F09A3E'), emissiveIntensity: 0.4 }), tail = toon('#E2405E', { emissive: new T.Color('#D9304E'), emissiveIntensity: 0.45 });
    // салон: пол, приборная панель, два сиденья
    rbox(trim, cabin, 0, 0.9, 0.07, 1.2, 0.04, 1.0, 0.02);
    rbox(trim, dash, 0, 0.97, 0.58, 1.2, 0.14, 0.16, 0.05);
    [-1, 1].forEach(s => {
      rbox(trim, seat, s * 0.31, 0.92, -0.06, 0.5, 0.06, 0.52, 0.03);
      rbox(trim, seat, s * 0.31, 1.02, -0.36, 0.5, 0.42, 0.14, 0.07, [-0.12, 0, 0]);
      rbox(trim, seatD, s * 0.31, 1.25, -0.39, 0.5, 0.06, 0.15, 0.03, [-0.12, 0, 0]);
      cyl(trim, chromeD, s * 0.3, 1.0, 0.66, 0.045, 0.02, [PI / 2, 0, 0]);   // приборы
    });
    // диванчик сзади (2+2): подушка на крышке над мотором и низкая спинка — места кота и собачки
    rbox(trim, seat, 0, 0.995, -0.66, 0.9, 0.07, 0.34, 0.035);
    rbox(trim, seat, 0, 1.11, -0.86, 0.9, 0.24, 0.1, 0.05, [-0.18, 0, 0]);
    rbox(trim, seatD, 0, 1.235, -0.885, 0.9, 0.045, 0.11, 0.022, [-0.18, 0, 0]);
    // папка «дела» на пассажирском сиденье: картон, красная тесёмка, белая наклейка
    rbox(trim, toon('#E6C79C'), -0.31, 0.968, -0.03, 0.24, 0.026, 0.31, 0.01, [0, 0.18, 0]);
    rbox(trim, toon('#C2405B'), -0.31, 0.983, -0.03, 0.245, 0.006, 0.022, 0.003, [0, 0.18, 0]);
    rbox(trim, toon('#FFFDF9'), -0.335, 0.983, 0.04, 0.1, 0.004, 0.06, 0.002, [0, 0.18, 0]);
    // рамка лобового стекла
    [-1, 1].forEach(s => put(trim, GEO.cylLo, chrome, [s * 0.6, 1.1, 0.62], [0.025, 0.46, 0.025], [-0.42, 0, 0]));
    put(trim, GEO.cylLo, chrome, [0, 1.31, 0.53], [0.025, 1.22, 0.025], [0, 0, PI / 2]);
    // фары-«глазки»: хромовое кольцо, светящееся стекло
    [-1, 1].forEach(s => {
      const g = new T.Group(); g.position.set(s * 0.52, 0.84, 1.62); g.rotation.x = -0.18; trim.add(g);
      put(g, H.ringG(0.15, 0.04), chrome, [0, 0, 0]);
      put(g, GEO.sph, lens, [0, 0, -0.01], [0.14, 0.14, 0.07]);
      sph(trim, amber, s * 0.6, 0.5, 1.8, 0.055);
      put(trim, GEO.sphLo, chrome, [s * 0.68, 1.08, 0.64], [0.06, 0.04, 0.03]);          // зеркальца
    });
    // бамперы
    rbox(trim, chrome, 0, 0.36, 1.93, 1.3, 0.09, 0.1, 0.04); rbox(trim, chrome, 0, 0.36, -1.93, 1.34, 0.09, 0.1, 0.04);
    [-1, 1].forEach(s => { rbox(trim, chrome, s * 0.36, 0.45, 1.93, 0.07, 0.18, 0.08, 0.03); rbox(trim, chrome, s * 0.42, 0.45, -1.94, 0.07, 0.18, 0.08, 0.03); });
    // сзади: полоса фонарей со скруглёнными краями, жалюзи моторного отсека, две трубы
    put(trim, keep(new T.CapsuleGeometry(0.045, 0.95, 3, 8)), tail, [0, 0.66, -1.83], null, [0, 0, PI / 2]);
    for (let i = 0; i < 6; i++) { const t = i / 5, z = -1.24 - t * 0.3, y = 0.92 - t * 0.16; rbox(trim, chromeD, 0, y + 0.012, z, 0.62, 0.02, 0.05, 0.01, [0.5, 0, 0]); }
    [-1, 1].forEach(s => cyl(trim, chrome, s * 0.32, 0.33, -1.92, 0.05, 0.22, [PI / 2, 0, 0]));
    // ручки дверей
    [-1, 1].forEach(s => rbox(trim, chrome, s * 0.78, 0.8, 0.1, 0.03, 0.03, 0.18, 0.01));
    // руль и рулевая колонка — отдельной костью (крутится вместе с колёсами)
    const WHEEL_C = new T.Vector3(0.31, 1.12, 0.38), COL_AX = new T.Vector3(0, -Math.sin(0.95), Math.cos(0.95));
    const wheelPart = new T.Group();
    put(wheelPart, keep(new T.TorusGeometry(0.17, 0.022, 6, 22)), rubber, [WHEEL_C.x, WHEEL_C.y, WHEEL_C.z], null, [0.95, 0, 0]);
    [0, 1, 2].forEach(i => { const a = PI / 2 + i * PI * 2 / 3, g = new T.Group(); g.position.copy(WHEEL_C); g.rotation.x = 0.95; wheelPart.add(g); put(g, GEO.cylLo, chromeD, [Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.005], [0.012, 0.17, 0.012], [0, 0, a - PI / 2]); });
    put(wheelPart, GEO.sphLo, chrome, [WHEEL_C.x, WHEEL_C.y, WHEEL_C.z], [0.035, 0.035, 0.035]);
    cyl(wheelPart, rubber, 0.31, 1.04, 0.48, 0.025, 0.24, [0.95 + PI / 2, 0, 0]);
    const trimGeo = mergeSkinned(T, [[H.geoOf(trim), 0], [H.geoOf(wheelPart), 1]]);
    const trimMesh = new T.SkinnedMesh(trimGeo, H.emisPatch(toon('#FFFFFF', { vertexColors: true }), 'car'));
    const boneRoot = new T.Bone(), boneWheel = new T.Bone(); boneWheel.position.copy(WHEEL_C); boneRoot.add(boneWheel); trimMesh.add(boneRoot);
    trimMesh.castShadow = true; trimMesh.receiveShadow = false; body.add(trimMesh);
    root.updateMatrixWorld(true); trimMesh.bind(new T.Skeleton([boneRoot, boneWheel]));
    { const bb = trimGeo.boundingBox.clone(), bbW = new T.Box3(), hv = new T.Vector3(); trimMesh.raycast = (rc, out) => { bbW.copy(bb).applyMatrix4(trimMesh.matrixWorld); if (rc.ray.intersectBox(bbW, hv)) { const d = rc.ray.origin.distanceTo(hv); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hv.clone(), object: trimMesh }); } }; }

    /* --- стекло и номер --- */
    const glass = new T.Mesh(keep(new T.PlaneGeometry(1.18, 0.4)), keep(new T.MeshBasicMaterial({ color: 0xE4F3FF, transparent: true, opacity: 0.38, depthWrite: false, side: T.DoubleSide })));
    glass.position.set(0, 1.1, 0.6); glass.rotation.x = -0.42; glass.renderOrder = 3; body.add(glass);
    const [pcv, pc] = cnv(256, 96); pc.fillStyle = '#FFFDF9'; rrect(pc, 3, 3, 250, 90, 20); pc.fill(); pc.strokeStyle = '#3A2E3F'; pc.lineWidth = 5; rrect(pc, 10, 10, 236, 76, 15); pc.stroke();
    text(pc, '10·10', 128, 50, 58, '#3A2E3F', { f: 'Comfortaa', w: 700 });
    const plate = new T.Mesh(keep(new T.PlaneGeometry(0.42, 0.16)), toon('#FFFFFF', { map: H.tex(pcv) }));
    plate.position.set(0, 0.5, -1.92); plate.rotation.y = PI; plate.castShadow = false; body.add(plate);

    /* --- колёса: одна сетка на 4 колеса (инстансы), диски-пятилучи с обеих сторон --- */
    const wheelG = (() => {
      const g = new T.Group();
      const tire = keep(new T.LatheGeometry([[0.19, -0.13], [0.27, -0.13], [0.305, -0.09], [0.31, 0], [0.305, 0.09], [0.27, 0.13], [0.19, 0.13]].map(([r, y]) => new T.Vector2(r, y)), 18));
      put(g, tire, rubber, [0, 0, 0], null, [0, 0, PI / 2]);
      const hub = toon('#FFF6EE');
      [-1, 1].forEach(s => {
        put(g, GEO.cyl, hub, [s * 0.11, 0, 0], [0.19, 0.03, 0.19], [0, 0, PI / 2]);
        for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; put(g, GEO.box, chromeD, [s * 0.13, Math.cos(a) * 0.1, Math.sin(a) * 0.1], [0.02, 0.15, 0.045], [a, 0, 0]); }
        put(g, GEO.sphLo, chrome, [s * 0.135, 0, 0], [0.03, 0.055, 0.055]);
      });
      return H.geoOf(g);
    })();
    const wheels = new T.InstancedMesh(wheelG, H.VC.front, 4);
    wheels.castShadow = true; wheels.frustumCulled = false; root.add(wheels);
    const WP = [[TRACK, WB.f], [-TRACK, WB.f], [TRACK, WB.r], [-TRACK, WB.r]];
    const seats = { heroSeat: new T.Vector3(0.31, 0.2, 0.06), seatDriver: new T.Vector3(0.31, 0.84, -0.12), seatPass: new T.Vector3(-0.24, 1.03, -0.68), seatDog: new T.Vector3(0.24, 1.03, -0.68), doorL: new T.Vector3(1.45, 0, 0.0), doorR: new T.Vector3(-1.45, 0, 0.0) };
    return { kind: 'coupe', paintMesh, outline, trimMesh, boneWheel, glass, plate, wheels, WP, WR, WB, TRACK, WHEEL_C, COL_AX, seats, cockpit: null, lamps: null, setColor: hex => paintMesh.material.color.set(hex) };
  }
  // вид «из-за руля» для запасного купе: глаза героини (замер по скину: +1,53 над корнем, +0,17 вперёд), руки «на 10 и 2» (±60°, как HeroAnim)
  function cockpitOf(hs, c, ax) {
    const tl = 0.95, r = 0.17, a = PI / 3, g = sd => [c.x + sd * Math.sin(a) * r, c.y + Math.cos(tl) * Math.cos(a) * r, c.z + Math.sin(tl) * Math.cos(a) * r];
    return { eye: [hs.x, hs.y + 1.53, hs.z + 0.17], wheel: { c: [c.x, c.y, c.z], r, tilt: tl, axis: [ax.x, ax.y, ax.z] }, gripL: g(1), gripR: g(-1) };
  }

  WORLD.makeCar = function (H, o = {}) {
    const T = H.T, { angDiff } = H;
    const root = new T.Group(), body = new T.Group(); root.add(body); root.name = 'car';
    // W7: кузов — жёлтый кабриолет (js/vehicles/cabrio.js); нет файла или он упал — прежнее ретро-купе
    let M = null;
    const CB = window.VEHICLES && window.VEHICLES.cabrio;
    if (CB && typeof CB.build === 'function') { try { M = CB.build(H, { color: o.color, root, body }); } catch (e) { console.warn('car: cabrio body failed, retro coupe', e); M = null; } }
    const cab = !!M;   // кабриолет — быстрая машина (CAB ниже); запасное ретро-купе — как раньше
    if (!M) M = retroBody(H, o, root, body);
    const { paintMesh, outline, trimMesh, boneWheel, glass, plate, wheels, WP, WR, WHEEL_C, COL_AX } = M;

    /* --- состояние и управление --- */
    const S = { x: o.x || 0, z: o.z || 0, ry: o.ry || 0, v: 0, steer: 0, spin: 0, squash: 0, sq: 0, pitch: 0, roll: 0, bumpT: 0, stuckT: 0, lastBump: -1, edgeIn: false, slideT: 0 };
    // W6 (желание автора: «машина едет медленно — хочу в 1,5 раза быстрее»): множитель скорости и разгона внутри машины —
    // main.js передаёт vmax: 8 явно, итоговая 12 м/с; разгон 5,5 → 8,25 м/с². o.speedK — свой множитель (1 — как раньше)
    // Кабриолет (желание автора: «это же быстрая машина»): 20 м/с (72 км/ч) вместо 12, разгон 9,5 м/с² (до 60 км/ч ≈ 1,8 с),
    // тормоз 13 м/с², накат 4 м/с²; o.speedK задан — прежняя формула (тесты и запасное купе)
    const CAB = cab && o.speedK == null ? { vmax: 20, acc: 9.5 } : null;
    const SPEED_K = o.speedK != null ? o.speedK : 1.5, VMAX = CAB ? CAB.vmax : (o.vmax || 8) * SPEED_K, ACC = CAB ? CAB.acc : 5.5 * SPEED_K;
    const COAST = 4, BRAKE = CAB ? 13 : 10, VREV = 4;   // накат без газа и тормоз, м/с²; задний ход, м/с
    // руль от скорости (ручное управление — кнопки, педали, стрелки): полный руль = желаемое рыскание: 1,6 рад/с до 6 м/с,
    // 1,0 рад/с на полном ходу (радиус ≈ 20 м). Раньше уже половина руля на 12 м/с упиралась в предел рыскания — «всё или ничего»
    const yawWant = v => 1.6 - 0.6 * sst01((Math.abs(v) - 6) / Math.max(1, VMAX - 6));
    const steerLim = v => Math.min(0.55, Math.atan(yawWant(v) * 2.2 / Math.max(Math.abs(v), 0.5)));
    // звук мотора (js/engine_sound.js): один объект на машину — без новых объектов за кадр
    const ES = { kind: 'cabrio', speed: 0, vmax: VMAX, throttle: 0, braking: false, onGround: true, driving: true };
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1), _X = new T.Vector3(1, 0, 0), _Y = new T.Vector3(0, 1, 0);
    const STEER_MAX = 0.6, WHEEL_TURN = 1.0;   // руль: до ±0,6 рад — как руки в HeroAnim (opt.drive.steer × 0,6)
    function place() {
      root.position.set(S.x, 0, S.z); root.rotation.y = S.ry;
      body.rotation.set(S.pitch, 0, S.roll);
      body.position.y = -S.sq * 0.05; body.scale.set(1 + S.sq * 0.03, 1 - S.sq * 0.06, 1 + S.sq * 0.02);
      WP.forEach(([x, z], i) => {
        _q.setFromAxisAngle(_Y, i < 2 ? S.steer : 0); _q2.setFromAxisAngle(_X, S.spin); _q.multiply(_q2);
        _p.set(x, WR, z); wheels.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      wheels.instanceMatrix.needsUpdate = true;
      boneWheel.quaternion.setFromAxisAngle(COL_AX, -S.steer * WHEEL_TURN);
    }
    place();
    // события: 'edge' (въехала в зону выезда), 'bump', 'horn'
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('car ' + n, e); } });
    // зона выезда из города: o.edge → layout.edge → конец Октябрьской на востоке (пока карта без edge)
    function edgeOf() {
      if (o.edge) return o.edge;
      const L = o.layout || WORLD.LAYOUT || {};
      if (L.edge && isFinite(L.edge.x) && isFinite(L.edge.z)) return L.edge;
      if (L.oct && isFinite(L.oct.x1)) return { x: Math.min(L.oct.x1 - 6, L.bounds ? L.bounds.x1 - 4 : 1e9), z: L.oct.zc, ry: PI / 2, r: 6, label: 'Дорога за город', labelNeutral: 'Дорога за город', fallback: true };
      return null;
    }
    // can(x, z, ry): свободна ли дорога для машины в этом положении (передняя и задняя точки)
    const can = o.can || (() => true);
    const ok = (x, z, ry) => { const fx = Math.sin(ry), fz = Math.cos(ry); return can(x + fx * 1.15, z + fz * 1.15) && can(x - fx * 1.2, z - fz * 1.2) && can(x, z); };
    /* ctl: { dir: [dx, dz, mag] в мире (джойстик) | null, thr: -1..1, str: -1..1 (клавиши), brake: bool } → { bumped, edge } */
    function update(dt, ctl) {
      dt = Math.min(dt, 0.05);
      let target = 0, delta = 0;
      if (ctl && ctl.dir && ctl.dir[2] > 0.08) {
        const [dx, dz, mag] = ctl.dir, a = Math.atan2(dx, dz), err = angDiff(a, S.ry);
        if (Math.abs(err) > 2.1 && S.v < 1.2) {   // цель сзади: задний ход, корма поворачивает к цели
          const er = angDiff(a, S.ry + PI); target = -Math.min(4, mag * 4.5); delta = Math.max(-0.6, Math.min(0.6, -er * 1.6));
        } else {
          target = mag * VMAX * (1 - 0.55 * Math.min(1, Math.abs(err) / 1.7));
          delta = Math.max(-0.6, Math.min(0.6, err * 1.6));
          if (S.v < 0.3 && Math.abs(err) > 0.4) target = Math.max(target, 2.2);   // с места на повороте — хотя бы тихий ход
        }
      } else if (ctl && (ctl.thr || ctl.str)) {
        target = ctl.thr > 0 ? VMAX * ctl.thr : ctl.thr < 0 ? (S.v > 0.6 ? 0 : -VREV) : 0;
        delta = -(ctl.str || 0) * steerLim(S.v);
      }
      if (ctl && ctl.brake) target = 0;
      // сама сбавляет ход перед стеной/бордюром — только когда ведёт джойстик или автопилот («покажи, куда ехать»): смотрим вперёд
      // по дуге руля на тормозной путь. Ручное управление (кнопки, стрелки) — как игрок решил: раньше машина у бордюров
      // ползла 1,4 м/с с полным газом
      if (ctl && ctl.dir && target > 1.2 && S.v > 0.8) {
        const look = Math.min(15, 1.6 + S.v * S.v / 10), k = Math.tan(S.steer) / 2.2;
        let x = S.x, z = S.z, h = S.ry;
        for (let d = 0.9; d <= look; d += 0.9) {
          h += 0.9 * k; x += Math.sin(h) * 0.9; z += Math.cos(h) * 0.9;
          if (!ok(x, z, h)) { const free = Math.max(0, d - 1.2); target = Math.min(target, Math.max(1.4, Math.sqrt(2 * 5 * free))); break; }
        }
      }
      // ctl.coast (кнопки и педали телефона): газ отпущен, тормоза нет — катится накатом (COAST м/с²), а не встаёт как вкопанная
      const coast = !!(ctl && ctl.coast && !ctl.thr && !ctl.brake);
      const braking = !!(ctl && (ctl.brake || (ctl.thr < 0 && S.v > 0.6)));
      const acc = coast ? COAST : braking ? BRAKE : (Math.sign(target) !== Math.sign(S.v) && Math.abs(S.v) > 0.05) || Math.abs(target) < Math.abs(S.v) ? 10 : ACC;
      const dv = Math.max(-acc * dt, Math.min(acc * dt, target - S.v)); S.v += dv;
      S.steer += (delta - S.steer) * Math.min(1, dt * 7);
      // предел рыскания от скорости: чуть выше желаемого (yawWant) — ручной руль в него не упирается, джойстик (руль до 0,6) —
      // как раньше: на скорости машина не «вертится»
      const wLim = yawWant(S.v) * 1.08;
      let w = S.v / 2.2 * Math.tan(S.steer); w = Math.max(-wLim, Math.min(wLim, w));
      const nry = S.ry + w * dt, nx = S.x + Math.sin(nry) * S.v * dt, nz = S.z + Math.cos(nry) * S.v * dt;
      let bumped = false;
      if (ok(nx, nz, nry)) { S.x = nx; S.z = nz; S.ry = nry; S.slideT = 0; }
      else {
        // скользит вдоль бордюра: чуть довернуть в свободную сторону и ехать дальше тише
        let slid = false;
        if (Math.abs(S.v) > 0.3) for (const dd of [0.06, -0.06, 0.14, -0.14, 0.26, -0.26]) {
          const r2 = nry + dd * Math.sign(S.v), x2 = S.x + Math.sin(r2) * S.v * dt, z2 = S.z + Math.cos(r2) * S.v * dt;
          if (ok(x2, z2, r2)) { S.x = x2; S.z = z2; S.ry = r2; S.v *= 1 - Math.min(0.5, dt * (1.5 + Math.abs(dd) * 6)); slid = true; S.slideT += dt; break; }
        }
        if (!slid) {
          if (ok(S.x, S.z, nry)) { S.ry = nry; bumped = Math.abs(S.v) > 1.2; S.v *= -0.22; }
          else { bumped = Math.abs(S.v) > 1.2; S.v *= -0.22; }
        }
      }
      if (bumped) { S.squash = 1; S.bumpT = 0; emit('bump', { v: S.v }); }
      // застряла: газ есть, а машина стоит
      const wants = Math.abs(target) > 1;
      S.stuckT = wants && Math.abs(S.v) < 0.4 ? S.stuckT + dt : 0;
      S.spin += S.v * dt / WR;
      // пружинка кузова: от удара и от разгона
      S.squash = Math.max(0, S.squash - dt * 2.2);
      S.sq = Math.sin(S.squash * PI * 3) * S.squash * 0.9;
      S.pitch += ((-dv / Math.max(dt, 1e-3)) * 0.006 - S.pitch) * Math.min(1, dt * 6);
      S.roll += (Math.max(-0.07, Math.min(0.07, -w * S.v * 0.012)) - S.roll) * Math.min(1, dt * 5);
      place();
      // выезд из города
      let edge = null;
      const E = edgeOf();
      if (E) {
        const d = Math.hypot(S.x - E.x, S.z - E.z), R = E.r || 6;
        if (!S.edgeIn && d < R && Math.abs(S.v) > 0.3) { S.edgeIn = true; edge = Object.assign({ x: E.x, z: E.z }, E, { car: { x: S.x, z: S.z, ry: S.ry } }); emit('edge', edge); }
        else if (S.edgeIn && d > R + 4) S.edgeIn = false;
      }
      // звук мотора: скорость, сколько газа просит игрок (цель / VMAX), тормоз
      if (window.EngineSound) { ES.driving = true; ES.speed = S.v; ES.throttle = Math.abs(target) / VMAX; ES.braking = !!(ctl && ctl.brake); EngineSound.update(ES, dt); }
      return { bumped, edge };
    }
    // поставить на ближайшую осевую дороги
    function reset(path) {
      let best = null, bd = 1e9;
      path.forEach(([x, z], i) => { const d = Math.hypot(x - S.x, z - S.z); if (d < bd) { bd = d; best = i; } });
      const [x, z] = path[best], [x2, z2] = path[(best + 1) % path.length];
      S.x = x; S.z = z; S.ry = Math.atan2(x2 - x, z2 - z); S.v = 0; S.stuckT = 0; place();
    }
    function setColor(hex) { M.setColor(hex); }
    // корень героини за рулём: центр руля − HeroAnim.DRIVE.wheel (руки «на 10 и 2» с чуть согнутыми локтями); у кабриолета — те же точки
    const { seatDriver, heroSeat } = M.seats;
    // opt.drive для HeroAnim: центр руля (оси корня героини), радиус, наклон плоскости руля, поворот −1..1 (+ налево)
    function driveInput() {
      const c = WHEEL_C;
      return {
        wheel: { x: c.x - heroSeat.x, y: c.y - heroSeat.y, z: c.z - heroSeat.z }, wheelR: 0.17, wheelTilt: 0.95,
        steer: clamp(S.steer / STEER_MAX, -1, 1), steerRad: S.steer, wheelAngle: -S.steer * WHEEL_TURN,
        axis: { x: COL_AX.x, y: COL_AX.y, z: COL_AX.z }, speed: S.v,
      };
    }
    const car = {
      root, body, wheels, paintMesh, trimMesh, glass, plate, outline, S, update, place, reset, setColor, VMAX, edgeOf, driveInput,
      seatDriver, heroSeat,
      seatPass: M.seats.seatPass,          // кот: сзади, справа
      seatDog: M.seats.seatDog,            // собачка: сзади, слева
      doorL: M.seats.doorL, doorR: M.seats.doorR,
      // W7: вид «из-за руля» (оси body); фонари для DayNight, размеры и CFG для гор (у кабриолета)
      cockpit: M.cockpit || cockpitOf(heroSeat, WHEEL_C, COL_AX), lamps: M.lamps || undefined, dims: M.dims, driveCfg: M.driveCfg, stats: M.stats,
      // фары ночью (у кабриолета: setNight(0..1), как у седана; main.js и regions.js зовут его сами)
      setNight: M.setNight || undefined,
      // дальний вид стоящей машины (у кабриолета: setFar(0 | 1 | 2); main.js carLod зовёт его сам)
      setFar: M.setFar || undefined,
      on(n, f) { (ev[n] = ev[n] || []).push(f); return () => car.off(n, f); },
      off(n, f) { ev[n] = (ev[n] || []).filter(x => x !== f); },
      horn() { hornSound(); emit('horn', { x: S.x, z: S.z }); return true; },
    };
    // звук мотора: тот же объект — контроллеру посадки (вышла — EngineSound.park: мотор затихает с падением оборотов)
    car.sound = ES;
    return car;
  };

  /* ---------- чехол на машину (серия 1): ткань повторяет кузов (та же сетка, чуть шире), над салоном — мягкий горб, сверху бант ---------- */
  WORLD.makeCarCover = function (H, car) {
    const T = H.T, g = new T.Group(); car.body.add(g);
    const cloth = H.addRim(H.toon('#EADCD2'), 0.6), bowM = H.toon('#E58FA6'), bowD = H.toon('#C9667E');
    if (car.paintMesh && car.paintMesh.geometry) { const m = new T.Mesh(car.paintMesh.geometry, cloth); m.scale.set(1.06, 1.08, 1.03); m.position.y = -0.01; g.add(m); }
    H.put(g, H.GEO_HI.sph, cloth, [0, 0.9, -0.25], [0.72, 0.36, 1.05]);
    [-1, 1].forEach(sd => H.put(g, H.GEO_HI.sph, bowM, [sd * 0.17, 1.27, -0.25], [0.18, 0.11, 0.07], [0, 0, sd * 0.45]));
    H.put(g, H.GEO_HI.sph, bowD, [0, 1.26, -0.25], [0.07, 0.07, 0.07]);
    [-1, 1].forEach(sd => H.put(g, H.GEO_HI.cyl, bowM, [sd * 0.08, 1.12, -0.18], [0.025, 0.24, 0.025], [0.2, 0, sd * 0.5]));
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
    g.visible = false;
    const hide = [car.trimMesh, car.glass, car.plate, car.outline].filter(Boolean);
    g.setOn = on => { g.visible = on; hide.forEach(m => { m.visible = !on; }); if (car.paintMesh) car.paintMesh.visible = !on; };
    return g;
  };

  /* =====================================================================
     ЗАПАСНЫЕ ПОЗЫ ГЕРОИНИ (пока в HeroAnim нет opt.ride / opt.drive): поверх обычного anim.update(...{ sitting })
     Руки — IK из двух костей к ручкам руля (сгиб локтя наружу и вниз), ноги — IK к педалям (колено вперёд),
     корпус чуть вперёд, взгляд в поворот. Всё в осях корня героини (root): +z вперёд, +x влево.
     ===================================================================== */
  const VP = (() => {
    let T = null, v1, v2, v3, v4, q1, q2, q3, m1, e1;
    const init = () => { if (T) return; T = window.THREE; v1 = new T.Vector3(); v2 = new T.Vector3(); v3 = new T.Vector3(); v4 = new T.Vector3(); q1 = new T.Quaternion(); q2 = new T.Quaternion(); q3 = new T.Quaternion(); m1 = new T.Matrix4(); e1 = new T.Euler(); };
    const rest = anim => {
      if (anim.__vpRest) return anim.__vpRest;
      const B = anim.bones, R = {};
      Object.keys(B).forEach(n => { R[n] = B[n].position.clone(); });
      return (anim.__vpRest = R);
    };
    // мягко довести поворот кости (Эйлер XYZ) до цели с весом k
    const toEuler = (bone, x, y, z, k) => { e1.set(x, y, z); q1.setFromEuler(e1); bone.quaternion.slerp(q1, k); };
    // рука: плечевой сустав → локоть → запястье в точку tgt (мир); pole — куда смотрит локоть (мир)
    function armIK(B, R, sd, tgtW, poleW, k) {
      const up = B['upperarm' + sd], fo = B['forearm' + sd], ha = B['hand' + sd];
      const Lu = R['forearm' + sd].length(), Ll = R['hand' + sd].length();
      up.parent.updateMatrixWorld(true);
      const sh = up.getWorldPosition(v1);
      const dir = v2.copy(tgtW).sub(sh); const dl = dir.length(); const d = clamp(dl, 0.05, (Lu + Ll) * 0.998); dir.multiplyScalar(1 / (dl || 1));
      const a = (Lu * Lu + d * d - Ll * Ll) / (2 * d), h = Math.sqrt(Math.max(0, Lu * Lu - a * a));
      const po = v3.copy(poleW).addScaledVector(dir, -poleW.dot(dir)).normalize();
      const elbow = v4.copy(sh).addScaledVector(dir, a).addScaledVector(po, h);
      // плечо: направление «плечо → локоть» в осях родителя
      up.parent.getWorldQuaternion(q2); q2.invert();
      const want = v3.copy(elbow).sub(sh).normalize().applyQuaternion(q2);
      q1.setFromUnitVectors(v2.copy(R['forearm' + sd]).normalize(), want);
      up.quaternion.slerp(q1, k); up.updateMatrixWorld(true);
      // предплечье: «локоть → запястье» в осях плеча
      const el = fo.getWorldPosition(v4);
      up.getWorldQuaternion(q2); q2.invert();
      const want2 = v3.copy(tgtW).sub(el).normalize().applyQuaternion(q2);
      q1.setFromUnitVectors(v2.copy(R['hand' + sd]).normalize(), want2);
      fo.quaternion.slerp(q1, k);
      toEuler(ha, 0.18, 0, sd === '_L' ? -0.12 : 0.12, k);
    }
    // нога: IK как в HeroAnim (бедро + колено в плоскости шага), стопа — по педали
    function legIK(B, R, sd, tgt, hipsQ, hipsP, k, footTilt) {
      const L1 = R['shin' + sd].length(), L2 = R['foot' + sd].length();
      const restLat = Math.atan2(R['shin' + sd].x + R['foot' + sd].x, -(R['shin' + sd].y + R['foot' + sd].y));
      const hj = v1.copy(R['thigh' + sd]).applyQuaternion(hipsQ).add(hipsP);
      const v = v2.copy(tgt).sub(hj).applyQuaternion(q3.copy(hipsQ).invert());
      const d = clamp(v.length(), 0.08, (L1 + L2) * 0.995);
      const kn = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
      const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const fw = Math.atan2(v.z, -v.y), lat = Math.atan2(v.x, Math.hypot(v.y, v.z)) - restLat;
      const tx = -(fw + al);
      toEuler(B['thigh' + sd], tx, 0, lat, k); toEuler(B['shin' + sd], kn, 0, 0, k);
      e1.setFromQuaternion(hipsQ);
      toEuler(B['foot' + sd], -(e1.x + tx + kn) + footTilt, 0, 0, k);
      toEuler(B['coat' + sd], tx * 0.86, 0, lat * 0.3, k);
    }
    const toW = (root, p, out) => out.set(p.x, p.y, p.z).applyMatrix4(root.matrixWorld);
    const dirW = (root, x, y, z, out) => { root.getWorldQuaternion(q2); return out.set(x, y, z).applyQuaternion(q2); };
    function ride(anim, root, r, k = 1) {
      init(); if (!anim || !anim.bones || !r) return false;
      const B = anim.bones, R = rest(anim), ph = (r.crankAngle !== undefined ? r.crankAngle : (r.pedalPhase || 0) * PI * 2 - PI);
      // таз над седлом, корпус чуть вперёд, чуть «качается» от педалей, лёгкий противонаклон
      const hipsP = v4.set(0, r.seat.y + 0.075 - R.thigh_L.y, r.seat.z + 0.035 - R.thigh_L.z);
      B.hips.position.lerp(hipsP, k);
      toEuler(B.hips, 0.13, 0.035 * Math.sin(ph), -(r.lean || 0) * 0.25, k);
      toEuler(B.spine, 0.1, -0.02 * Math.sin(ph), 0, k);
      toEuler(B.chest, 0.06, -0.03 * Math.sin(ph), 0, k);
      toEuler(B.neck, -0.05, (r.steer || 0) * 0.25, 0, k);
      toEuler(B.head, -0.2, (r.steer || 0) * 0.45, (r.lean || 0) * 0.3, k);
      const hipsQ = q3.copy(B.hips.quaternion).clone(), hp = B.hips.position.clone();
      // ноги: щиколотка над осью педали и чуть сзади; носок чуть вниз (сильнее внизу-сзади хода)
      const tL = new T.Vector3(r.pedalL.x - 0.015, r.pedalL.y + 0.07, r.pedalL.z - 0.035), tR = new T.Vector3(r.pedalR.x + 0.015, r.pedalR.y + 0.07, r.pedalR.z - 0.035);
      legIK(B, R, '_L', tL, hipsQ, hp, k, 0.16 + 0.12 * Math.sin(ph));
      legIK(B, R, '_R', tR, hipsQ, hp, k, 0.16 + 0.12 * Math.sin(ph + PI));
      // руки: запястья к ручкам (чуть сзади середины ручки), локти наружу и вниз
      root.updateWorldMatrix(true, true);
      const gL = toW(root, { x: r.handL.x - 0.01, y: r.handL.y + 0.015, z: r.handL.z - 0.045 }, new T.Vector3());
      const gR = toW(root, { x: r.handR.x + 0.01, y: r.handR.y + 0.015, z: r.handR.z - 0.045 }, new T.Vector3());
      armIK(B, R, '_L', gL, dirW(root, 0.9, -0.55, -0.5, new T.Vector3()), k);
      armIK(B, R, '_R', gR, dirW(root, -0.9, -0.55, -0.5, new T.Vector3()), k);
      return true;
    }
    function drive(anim, root, dr, k = 1) {
      init(); if (!anim || !anim.bones || !dr) return false;
      const B = anim.bones, R = rest(anim);
      toEuler(B.spine, 0.05, 0, 0, k); toEuler(B.head, -0.06, (dr.steer || 0) * 0.5, 0, k);
      // руки на руле «на десять и два», поворачиваются вместе с рулём
      const c = new T.Vector3(dr.wheel.x, dr.wheel.y, dr.wheel.z), tl = dr.wheelTilt !== undefined ? dr.wheelTilt : 0.95, rad = dr.wheelR || dr.radius || 0.17;
      const upv = new T.Vector3(0, Math.cos(tl), Math.sin(tl)), side = new T.Vector3(1, 0, 0);   // в плоскости руля: «верх» и влево (+x)
      const at = th => c.clone().addScaledVector(upv, Math.cos(th) * rad).addScaledVector(side, Math.sin(th) * rad);
      root.updateWorldMatrix(true, true);
      const w = (dr.steer || 0) * 0.6;
      const hL = at(1.0 + w), hR = at(-1.0 + w);
      armIK(B, R, '_L', toW(root, hL, new T.Vector3()), dirW(root, 0.8, -0.7, -0.2, new T.Vector3()), k);
      armIK(B, R, '_R', toW(root, hR, new T.Vector3()), dirW(root, -0.8, -0.7, -0.2, new T.Vector3()), k);
      return true;
    }
    // HeroAnim волны 3 сам умеет opt.ride / opt.drive — тогда запасные позы не нужны
    const native = () => !!(window.HeroAnim && window.HeroAnim.RIDE && window.HeroAnim.DRIVE);
    return { ride, drive, native };
  })();
  WORLD.VehiclePose = VP;

  /* =====================================================================
     МАШИНА В ГОРОДЕ: замок/чехол, посадка (дверь → сиденье), езда, выход, гудок, выезд из города
     ===================================================================== */
  let LOCKED = true;
  const ctls = new Set();
  function create(o = {}) {
    const T = o.THREE || window.THREE, H = o.kit, scene = o.scene;
    const L = () => o.layout || WORLD.LAYOUT || {};
    let car = o.car;
    if (!car) {
      const l = L(), sp = (l.spawnPoints && l.spawnPoints.car) || o.at || { x: 8.8, z: 4.75, ry: PI / 2 };
      car = WORLD.makeCar(H, { x: sp.x, z: sp.z, ry: sp.ry, color: o.color || WORLD.CAR_COLORS[0][1], vmax: o.vmax || 8, can: (x, z) => (typeof L().drivable === 'function' ? L().drivable(x, z, 0.78) : true), layout: o.layout });
      if (scene) scene.add(car.root);
    }
    const cover = o.cover || WORLD.makeCarCover(H, car);
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('car ctl ' + n, e); } });
    const st = { mode: 'parked', own: o.locked === undefined ? null : !!o.locked, covered: null, hero: null, cat: null, dog: null, tween: null, braking: null, parents: new Map() };
    const isLocked = () => (st.own === null ? LOCKED : st.own);
    const applyCover = () => cover.setOn(st.covered === null ? isLocked() : st.covered);
    applyCover();
    const unsub = [car.on('edge', e => emit('edge', e)), car.on('bump', e => emit('bump', e)), car.on('horn', e => emit('horn', e))];
    const local2world = (v, out) => { car.root.updateMatrixWorld(true); out.copy(v); car.body.localToWorld(out); return out; };
    const freeAt = (x, z, r) => {
      if (typeof o.collide === 'function') { const p = o.collide(x, z, r); return Math.hypot(p[0] - x, p[1] - z) < 0.05; }
      const C = o.colliders; if (!C) return true;
      for (const c of C.circles || []) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
      for (const b of C.boxes || []) if (b.noWalk !== false && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
      return true;
    };
    const keepParent = obj => { if (obj && !st.parents.has(obj)) st.parents.set(obj, obj.parent || scene); };
    function canEnter(x, z) { return st.mode === 'parked' && car.root.visible && Math.hypot(car.S.x - x, car.S.z - z) < 2.9 && Math.abs(car.S.v) < 0.3; }
    function enter(hero, opt = {}) {
      if (st.mode !== 'parked') return Promise.resolve(false);
      if (isLocked()) { emit('locked', {}); return Promise.resolve(false); }
      st.hero = hero; st.cat = opt.cat || null; st.dog = opt.dog || null; st.mode = 'enter';
      [hero && hero.root, st.cat, st.dog].forEach(keepParent);
      const door = local2world(car.doorL, new T.Vector3()), seatW = local2world(car.heroSeat, new T.Vector3());
      const from = hero.root.position.clone();
      const pets = [[st.cat, car.seatPass], [st.dog, car.seatDog]].filter(p => p[0]).map(([obj, seat]) => ({ obj, seat, from: obj.getWorldPosition(new T.Vector3()), to: local2world(seat, new T.Vector3()) }));
      return new Promise(res => {
        const fin = () => {
          car.body.attach(hero.root); hero.root.position.copy(car.heroSeat); hero.root.rotation.set(0, 0, 0);
          if (hero.body) hero.body.position.y = 0;
          pets.forEach(p => { car.body.attach(p.obj); p.obj.position.copy(p.seat); p.obj.rotation.set(0, 0, 0); });
          st.tween = null; st.mode = 'drive'; emit('enter', {}); res(true);
        };
        if (opt.instant) { fin(); return; }
        st.tween = { t: 0, dur: 0.8, tick(k) {
          // к двери (0–0.4), потом лёгкий прыжок через борт на сиденье (кабриолет без крыши — дверь не нужна)
          if (k < 0.4) { const e = k / 0.4; hero.root.position.set(from.x + (door.x - from.x) * e, 0, from.z + (door.z - from.z) * e); hero.root.rotation.y = Math.atan2(door.x - from.x, door.z - from.z); st.walk = true; }
          else { const e = (k - 0.4) / 0.6, ee = e * e * (3 - 2 * e); st.walk = false; hero.root.position.set(door.x + (seatW.x - door.x) * ee, Math.sin(e * PI) * 0.7 + seatW.y * ee, door.z + (seatW.z - door.z) * ee); hero.root.rotation.y += angDiffG(car.S.ry, hero.root.rotation.y) * Math.min(1, e * 1.5); }
          pets.forEach((p, i) => { const ce = clamp((k - i * 0.12) * 1.25, 0, 1); p.obj.position.set(p.from.x + (p.to.x - p.from.x) * ce, Math.sin(ce * PI) * 0.9 + p.from.y + (p.to.y - p.from.y) * ce, p.from.z + (p.to.z - p.from.z) * ce); p.obj.rotation.y = car.S.ry; });
        }, done: fin };
      });
    }
    function exitSpot() {
      const cands = [car.doorL, car.doorR, new T.Vector3(0, 0, 2.8), new T.Vector3(0, 0, -2.8)];
      const B = L().bounds, inB = p => !B || (p.x > B.x0 + 0.3 && p.x < B.x1 - 0.3 && p.z > B.z0 + 0.3 && p.z < B.z1 - 0.3);
      for (const c of cands) { const p = local2world(c, new T.Vector3()); if (inB(p) && freeAt(p.x, p.z, 0.3)) return p; }
      return local2world(car.doorL, new T.Vector3());
    }
    function exit(opt = {}) {
      if (st.mode !== 'drive') return Promise.resolve(null);
      if (Math.abs(car.S.v) > 0.4 && !opt.instant) { if (!st.braking) st.braking = new Promise(r => { st.brakeDone = r; }).then(() => { st.braking = null; return exit(opt); }); return st.braking; }
      st.mode = 'exit'; car.S.v = 0;
      const hero = st.hero, out = exitSpot(), ry = car.S.ry;
      const seat = local2world(car.heroSeat, new T.Vector3());
      const back = obj => { const p = (obj === hero.root && scene) || st.parents.get(obj) || scene; p.attach(obj); };
      back(hero.root); hero.root.rotation.x = 0; hero.root.rotation.z = 0;
      const pets = [st.cat, st.dog].filter(Boolean).map((obj, i) => { back(obj); obj.rotation.x = obj.rotation.z = 0; return { obj, from: obj.position.clone(), to: new T.Vector3(out.x - Math.cos(ry) * (0.7 + i * 0.5) - Math.sin(ry) * 0.3, 0, out.z + Math.sin(ry) * (0.7 + i * 0.5) - Math.cos(ry) * 0.3) }; });
      return new Promise(res => {
        const fin = () => {
          hero.root.position.set(out.x, 0, out.z);
          pets.forEach(p => p.obj.position.copy(p.to));
          st.tween = null; st.mode = 'parked'; st.hero = st.cat = st.dog = null;
          const r = { x: out.x, z: out.z, ry, pets: pets.map(p => ({ x: p.to.x, z: p.to.z })) };
          emit('exit', r); res(r);
        };
        if (opt.instant) { fin(); return; }
        st.tween = { t: 0, dur: 0.55, tick(k) {
          const e = k * k * (3 - 2 * k);
          hero.root.position.set(seat.x + (out.x - seat.x) * e, Math.sin(k * PI) * 0.6 + seat.y * (1 - e), seat.z + (out.z - seat.z) * e);
          pets.forEach(p => p.obj.position.set(p.from.x + (p.to.x - p.from.x) * e, Math.sin(k * PI) * 0.8 + p.from.y * (1 - e), p.from.z + (p.to.z - p.from.z) * e));
        }, done: fin };
      });
    }
    function update(dt, inp) {
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      if (st.tween) { st.tween.t += dt; const k = Math.min(1, st.tween.t / st.tween.dur); st.tween.tick(k); if (k >= 1 && st.tween) st.tween.done(); }
      // не за рулём: только что ехала — мотор затихает (обороты падают), потом ничего не делает
      if (st.mode !== 'drive' && window.EngineSound && car.sound) EngineSound.park(car.sound, dt);
      if (st.mode !== 'drive') return { bumped: false, edge: null };
      let ctl = inp || null;
      if (st.braking) ctl = { brake: true };
      const r = car.update(dt, ctl);
      if (st.braking && Math.abs(car.S.v) < 0.4 && st.brakeDone) { const f = st.brakeDone; st.brakeDone = null; f(); }
      return r;
    }
    function animState() {
      const sit = st.mode === 'drive' || (st.mode === 'enter' && st.tween && st.tween.t / st.tween.dur > 0.55) || (st.mode === 'exit' && st.tween && st.tween.t / st.tween.dur < 0.35);
      return { speed: st.walk && st.mode === 'enter' ? 1.4 : 0, sitting: !!sit, sitPose: 'chair', idle: false, turnRate: 0, waving: false, drive: sit ? car.driveInput() : null };
    }
    const ctl = {
      car, cover,
      get mode() { return st.mode; }, get locked() { return isLocked(); }, get covered() { return cover.visible; },
      setLocked(b) { st.own = !!b; applyCover(); },
      setCovered(b) { st.covered = b === null || b === undefined ? null : !!b; applyCover(); },
      _sync: applyCover,
      canEnter, enter, exit, update, animState, driveInput: () => car.driveInput(),
      horn() { if (st.mode !== 'drive') return false; return car.horn(); },
      get seats() { return { driver: car.heroSeat, cat: car.seatPass, dog: car.seatDog }; },
      get pos() { return { x: car.S.x, z: car.S.z }; }, get speed() { return car.S.v; }, get ry() { return car.S.ry; },
      on(n, f) { (ev[n] = ev[n] || []).push(f); return () => ctl.off(n, f); },
      off(n, f) { ev[n] = (ev[n] || []).filter(x => x !== f); },
      dispose() { unsub.forEach(f => f()); ctls.delete(ctl); },
    };
    ctls.add(ctl);
    return ctl;
  }
  WORLD.Car = {
    create, hornSound,
    setLocked(b) { LOCKED = !!b; ctls.forEach(c => c._sync()); },
    isLocked: () => LOCKED,
    applyDrivePose: (anim, root, drive, k, force) => (!force && VP.native() ? false : VP.drive(anim, root, drive, k)),
  };
})();
