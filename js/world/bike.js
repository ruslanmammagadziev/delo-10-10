/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: велосипед-«голландец».
   Низкая рама с двумя изогнутыми трубами, крылья, закрытая защита цепи, багажник, плетёная корзинка
   на переднем багажнике (с бантиком), круглая фара-«глазок», седло на пружинках, звонок, подножка.
   Цвета рамы: мятный, сливочный, лавандовый (WORLD.BIKE_COLORS). Без надписей и значков.

   Модель — ОДНА сетка со скелетом (жёсткие веса) + контур той же сеткой: 2 вызова отрисовки; тень — от простой
   невидимой «куклы» (≈ 300 треуг.): +1 вызов в главном проходе (или 0 со своим слоем, o.shadowLayer) и +1 в проходе теней.
   Кости: рама, руль (вилка, крыло, переднее колесо, звонок), заднее колесо, шатун, педали (держатся
   горизонтально), подножка. Колёса крутятся, руль поворачивается вокруг наклонной оси, педали крутятся,
   пока она крутит, и замирают, когда катится накатом.

   API
     const bike = WORLD.Bike.create({ THREE, scene, kit, layout, colliders?, dyn?, doors?, color?, at? })
       THREE — three.js (по умолчанию window.THREE); scene — куда поставить; kit — набор города (WORLD.createKit);
       layout — WORLD.LAYOUT (rideable/drivable/walkable/bounds/spawnPoints/pois; всё необязательно): где rideable — едет
         до 5,5 м/с; где только walkable (тротуар) — тихонько, до 2,2 м/с (к двери подъехать можно); без rideable —
         дорога || тротуар || «в границах и не в коллайдере»;
       colliders — { boxes:[{x0,x1,z0,z1}], circles:[{x,z,r}] } (MAP.colliders) — мягкие столкновения со скольжением;
       dyn() — подвижные круги [{x,z,r}] (жители), doors — WORLD.makeDoors(...) (near(x,z,r,filter)) для «слезть у двери»
       (doorFilter(d) — какие двери считать; по умолчанию все, кроме «Постучать»); camera — для LOD (контур гаснет дальше 24 м);
       color — '#hex' или индекс в BIKE_COLORS; at — {x,z,ry} (иначе — стоянка из layout, см. WORLD.Bike.parkSpot).
     bike.group               — корень (позиция и курс); bike.lean — группа наклона (внутри — седло и корзинка)
     bike.mount(hero, {instant}) → Promise<bool>  — запрыгнула на седло: hero.root переезжает в bike.seat
     bike.dismount({instant})   → Promise<{x,z,ry}|null> — слезла сбоку (там, где свободно); hero.root — обратно в сцену
     bike.update(dt, input)     → { moved, bumped, door }  — каждый кадр (и когда стоит: подножка, плавность)
        input = { dir: [dx, dz, mag] (мир, от камеры — как ходьба) | null, thr: -1..1, str: -1..1 (клавиши), brake }
     bike.ring() → bool       — «Дзынь»: звонок (G.audioBus или свой WebAudio), звонок качается, событие 'bell'
     bike.on(evt, fn) / off   — 'mount', 'dismount', 'bell', 'bump', 'door' ({door}), 'stopped'
     чтение: pos {x,z}, ry, speed, crankPhase (рад), pedalPhase (0..1), lean (рад, + влево), steer (рад, + влево),
        mounted, busy (идёт посадка), handPoints {L,R}, crankPoint, pedalPoints {L,R}, seatPoint — в осях корня героини
        (героиня на седле: +z — вперёд, +x — влево), basketPoint / dogPoint(side) — в мире
     bike.rideInput()  → { seat, pedalL, pedalR, crank, crankR, pedalPhase, handL, handR, steer, lean, speed, crankAngle } —
        ровно opt.ride HeroAnim (волна 3); точки — в осях корня героини (bike.seat), pedalPhase: 0 — левая педаль вверху
     bike.animState()  → то, что слить в anim.update(dt, s): { speed:0, sitting:true, sitPose:'chair', idle:false, turnRate:0, ride }
     bike.carry(obj, 'basket') / bike.uncarry(obj, parent)   — кот в корзинке
     bike.near(x, z, r=1.7), bike.mountPoint() → {x,z} (слева у седла), bike.setColor(hex|index), bike.dispose()
     WORLD.Bike.applyRidePose(anim, heroRoot, ride, k=1) — запасная поза (ноги крутят педали, руки на руле), если в
        HeroAnim нет opt.ride (старая сборка): вызвать сразу после anim.update(...); при HeroAnim.RIDE ничего не делает
     WORLD.Bike.parkSpot(layout, colliders) → {x,z,ry} — стоянка: spawnPoints.bike → pois 'bikes' → у кинотеатра
     WORLD.Bike.makeStand(kit, spot) → Group — дуги велопарковки (1 вызов), если нужна декорация
     WORLD.Bike.makeRack(kit, spot, n=2) → Group — ряд велосипедов проката (статичная сетка: 1 вызов + контур), rack.lod(cam)
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  WORLD.BIKE_COLORS = [['мятный', '#A8D8C4'], ['сливочный', '#F6E3B8'], ['лавандовый', '#C9B8E8']];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };

  /* ---------- размеры (метры, оси велосипеда: +z вперёд, +x влево, начало — на земле посередине между колёсами) ---------- */
  const D = {
    WR: 0.31, zR: -0.51, zF: 0.51, WB: 1.02,
    bb: [0, 0.27, -0.07], LC: 0.15, GEAR: 2.1,
    head: 22 * PI / 180, steerAt: [0, 0.31, 0.465],
    saddle: [0, 0.762, -0.355],                       // верх седла
    heroRoot: [0, 0.035, -0.325],                     // корень героини на седле (тазобедренные суставы над седлом)
    grip: [0.262, 0.971, 0.012],                      // середина ручки (левая; правая — с −x)
    basket: [0, 0.745, 0.53],                         // дно корзинки (центр)
    VMAX: 5.5, RMIN: 1.45, PARK_LEAN: 0.065,
  };
  const AX = [0, Math.cos(D.head), -Math.sin(D.head)];    // ось руля: вверх и чуть назад

  /* ---------- звук звонка: G.audioBus('sfx') (уважает «звук выкл»), иначе свой мягкий WebAudio ---------- */
  let ownAC = null;
  function bellSound() {
    try {
      let ac = null, out = null;
      const g = window.G;
      if (g && typeof g.audioBus === 'function') { out = g.audioBus('sfx'); if (!out) return false; ac = out.context; }
      else { if (!ownAC) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ownAC = new AC(); } ac = ownAC; if (ac.state !== 'running') ac.resume(); const gg = ac.createGain(); gg.gain.value = 0.8; gg.connect(ac.destination); out = gg; }
      const t = ac.currentTime + 0.01;
      // «дзынь-дзынь»: два удара, негармоничные обертоны, лёгкое дрожание (вращающийся звонок), мягкий фильтр
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.connect(out);
      const ding = (t0, vol) => [[1975, 1, 0.95], [4740, 0.32, 0.5], [8100, 0.08, 0.22]].forEach(([f, k, dur]) => {
        const o = ac.createOscillator(), gn = ac.createGain(), tr = ac.createOscillator(), tg = ac.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, t0);
        tr.frequency.value = 17; tg.gain.value = f * 0.004; tr.connect(tg); tg.connect(o.frequency);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(vol * k, t0 + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(gn); gn.connect(lp); o.start(t0); tr.start(t0); o.stop(t0 + dur + 0.05); tr.stop(t0 + dur + 0.05);
      });
      ding(t, 0.045); ding(t + 0.17, 0.035);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- стоянка: spawnPoints.bike → pois 'bikes' → у кинотеатра (тротуар Октябрьской) ---------- */
  function freeAt(C, x, z, r) {
    if (!C) return true;
    for (const c of C.circles || []) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    for (const b of C.boxes || []) if (b.noWalk !== false && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
    return true;
  }
  function parkSpot(L, C) {
    L = L || WORLD.LAYOUT || {};
    const sp = L.spawnPoints && L.spawnPoints.bike;
    if (sp && isFinite(sp.x) && isFinite(sp.z)) return { x: sp.x, z: sp.z, ry: isFinite(sp.ry) ? sp.ry : PI / 2, from: 'spawnPoints' };
    const poi = (L.pois || []).find(p => p && p.kind === 'bikes');
    if (poi) return { x: poi.x, z: poi.z, ry: isFinite(poi.ry) ? poi.ry : PI / 2, from: 'poi' };
    // у кинотеатра: на тротуаре левее тележки Жу, вдоль бордюра, лицом на восток; если занято — ищем рядом
    const want = [[-6.2, 2.75], [-7.4, 2.75], [-5.2, 2.75], [-8.6, 2.75], [-6.2, 2.2], [3.4, 2.75], [-10.4, 2.75]];
    for (const [x, z] of want) {
      const fx = 1, ok = freeAt(C, x, z, 0.32) && freeAt(C, x + fx * 0.55, z, 0.25) && freeAt(C, x - fx * 0.55, z, 0.25);
      if (ok) return { x, z, ry: PI / 2, from: 'cinema' };
    }
    return { x: -6.2, z: 2.75, ry: PI / 2, from: 'cinema' };
  }

  /* ---------- сборка модели ---------- */
  function buildModel(T, H, color) {
    const parts = [];
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S3 = new T.Vector3();
    const SPH = new T.SphereGeometry(1, 10, 7), SPHL = new T.SphereGeometry(1, 7, 5);
    const add = (g, col, bone, o) => { o = o || {}; parts.push({ g, col: new T.Color(col), emis: o.emis ? new T.Color(o.emis).multiplyScalar(o.ei || 0.6) : null, bone, ol: !!o.ol, paint: !!o.paint }); return g; };
    const xf = (g, p, s, r) => { E.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); Q.setFromEuler(E); M4.compose(V.set(p[0], p[1], p[2]), Q, S3.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1)); g.applyMatrix4(M4); return g; };
    const sph = (p, s, col, bone, o, r) => add(xf((Math.max(s[0], s[1], s[2]) < 0.05 ? SPHL : SPH).clone(), p, s, r), col, bone, o);
    const tube = (pts, r, col, bone, o) => {
      o = o || {};
      const c = new T.CatmullRomCurve3(pts.map(q => new T.Vector3(q[0], q[1], q[2])), false, 'centripetal');
      add(new T.TubeGeometry(c, o.seg || 12, r, o.rad || 6, false), col, bone, o);
      if (o.caps !== false) { const oc = Object.assign({}, o, { ol: false }); add(xf(SPHL.clone(), pts[0], [r, r, r]), col, bone, oc); add(xf(SPHL.clone(), pts[pts.length - 1], [r, r, r]), col, bone, oc); }
    };
    const rod = (a, b, r, col, bone, o) => {
      o = o || {};
      const A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), L = d.length();
      const g = new T.CylinderGeometry(o.r2 || r, r, L, o.rad || 7, 1, !!o.open);
      Q.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); M4.compose(A.clone().add(B).multiplyScalar(0.5), Q, S3.set(1, 1, 1)); g.applyMatrix4(M4);
      add(g, col, bone, o);
    };
    const rbox = (p, w, h, d, r, col, bone, o, rot) => add(xf(H.rboxGeo(w, h, d, r).clone(), p, null, rot), col, bone, o);
    const torus = (p, R, t, rs, ts, col, bone, o, arc) => add(xf(new T.TorusGeometry(R, t, rs, ts, arc === undefined ? PI * 2 : arc).rotateY(PI / 2), p), col, bone, o);
    // крыло: полоса-дуга вокруг оси колеса (сектор кольца, выдавленный по ширине), углы от +z к +y
    const fender = (c, ri, th, w, a0, a1, col, bone, o) => {
      const s = new T.Shape(), n = 12;
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = Math.cos(a) * (ri + th), y = Math.sin(a) * (ri + th); if (i) s.lineTo(x, y); else s.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(a) * ri, Math.sin(a) * ri); }
      const g = new T.ExtrudeGeometry(s, { depth: w - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1, curveSegments: 2 });
      g.rotateY(-PI / 2); g.translate((w - 0.012) / 2, 0, 0); g.translate(c[0], c[1], c[2]);
      add(g, col, bone, o);
    };
    const C = {
      paint: color, chrome: '#EEF0F5', chromeD: '#B9BCC8', tire: '#5C5060', wall: '#F4E6D4', leather: '#9A6544', leatherD: '#7E4E34',
      wicker: '#E0B47A', wickerD: '#BE8C55', bow: '#F08FA8', bowD: '#D9708C', lens: '#FFF6DC', red: '#E2405E', dark: '#6E6272',
    };
    const BN = { root: 0, steer: 1, wf: 2, wr: 3, crank: 4, pl: 5, pr: 6, stand: 7, bell: 8 };
    const axisAt = y => { const t = (y - D.steerAt[1]) / AX[1]; return [0, y, D.steerAt[2] + AX[2] * t]; };

    /* колёса: шина, белая боковина, обод, спицы, втулка (кость колеса; переднее — внутри руля) */
    const wheel = (zc, bone) => {
      const c = [0, D.WR, zc];
      torus(c, D.WR - 0.035, 0.035, 7, 26, C.tire, bone, { ol: true });
      torus(c, D.WR - 0.064, 0.012, 4, 24, C.wall, bone);
      torus(c, D.WR - 0.078, 0.011, 4, 24, C.chrome, bone);
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, sx = i % 2 ? 0.018 : -0.018; rod([sx, D.WR + Math.sin(a) * 0.03, zc + Math.cos(a) * 0.03], [0, D.WR + Math.sin(a + 0.25) * (D.WR - 0.085), zc + Math.cos(a + 0.25) * (D.WR - 0.085)], 0.0045, C.chromeD, bone, { rad: 3 }); }
      rod([-0.05, D.WR, zc], [0.05, D.WR, zc], 0.024, C.chrome, bone, { rad: 8 });
      sph([0, D.WR, zc], [0.018, 0.036, 0.036], C.chromeD, bone);
    };
    wheel(D.zR, BN.wr); wheel(D.zF, BN.wf);

    /* рама (краска): рулевая труба, две изогнутые трубы «голландца», подседельная, перья, защита цепи */
    const hb0 = axisAt(0.70), hb1 = axisAt(0.845), bb = D.bb;
    rod(hb0, hb1, 0.036, C.paint, BN.root, { ol: true, paint: true, rad: 10 });
    sph(hb0, [0.038, 0.03, 0.038], C.paint, BN.root, { paint: true }); sph(hb1, [0.038, 0.03, 0.038], C.paint, BN.root, { paint: true });
    tube([axisAt(0.735), [0, 0.6, 0.25], [0, 0.45, 0.15], [0, 0.335, 0.02], bb], 0.03, C.paint, BN.root, { ol: true, paint: true, seg: 18 });
    tube([axisAt(0.81), [0, 0.7, 0.18], [0, 0.56, 0.03], [0, 0.505, -0.1], [0, 0.515, -0.2]], 0.024, C.paint, BN.root, { ol: true, paint: true, seg: 18 });
    const sc = [0, 0.675, -0.305];
    rod(bb, sc, 0.028, C.paint, BN.root, { ol: true, paint: true });
    sph(bb, [0.045, 0.045, 0.045], C.paint, BN.root, { paint: true });
    sph(sc, [0.032, 0.03, 0.032], C.paint, BN.root, { paint: true });
    rod(sc, [0, 0.725, -0.33], 0.017, C.chrome, BN.root);                                   // подседельный штырь
    [-1, 1].forEach(s => {
      tube([[s * 0.02, bb[1], bb[2]], [s * 0.055, 0.29, -0.3], [s * 0.06, D.WR, D.zR]], 0.016, C.paint, BN.root, { paint: true, seg: 8 });   // нижние перья
      tube([[s * 0.022, 0.655, -0.3], [s * 0.05, 0.48, -0.41], [s * 0.06, D.WR, D.zR]], 0.014, C.paint, BN.root, { paint: true, seg: 8 });   // верхние перья
    });
    // закрытая защита цепи (справа, −x) и круглая крышка звезды
    sph([-0.07, 0.288, -0.3], [0.02, 0.062, 0.27], C.paint, BN.root, { ol: true, paint: true }, [Math.atan2(0.04, 0.44), 0, 0]);
    sph([-0.072, bb[1], bb[2] - 0.01], [0.024, 0.088, 0.088], C.paint, BN.root, { ol: true, paint: true });
    sph([-0.097, bb[1], bb[2]], [0.005, 0.036, 0.036], C.chrome, BN.root);
    // заднее крыло, багажник, фонарь
    fender([0, D.WR, D.zR], D.WR + 0.03, 0.013, 0.085, 40 * PI / 180, 200 * PI / 180, C.paint, BN.root, { ol: true, paint: true });
    rbox([0, 0.665, -0.535], 0.15, 0.016, 0.46, 0.007, C.chrome, BN.root);
    [-1, 1].forEach(s => {
      rod([s * 0.07, 0.66, -0.745], [s * 0.06, D.WR + 0.01, D.zR], 0.008, C.chrome, BN.root, { rad: 5 });
      rod([s * 0.06, 0.66, -0.32], [s * 0.03, 0.655, -0.3], 0.008, C.chrome, BN.root, { rad: 5 });
      rod([s * 0.075, 0.675, -0.76], [s * 0.075, 0.675, -0.32], 0.007, C.chrome, BN.root, { rad: 5 });
    });
    rbox([0, 0.64, -0.775], 0.08, 0.04, 0.025, 0.012, C.red, BN.root, { emis: '#E2405E', ei: 0.45 });
    // седло на пружинках (кожа)
    const sd = D.saddle;
    sph([sd[0], sd[1] - 0.03, sd[2] - 0.005], [0.105, 0.032, 0.125], C.leather, BN.root, { ol: true });
    sph([sd[0], sd[1] - 0.028, sd[2] + 0.115], [0.04, 0.024, 0.085], C.leather, BN.root, { ol: true });
    rbox([0, sd[1] - 0.06, sd[2] - 0.01], 0.17, 0.018, 0.2, 0.008, C.leatherD, BN.root);
    [-1, 1].forEach(s => { [0.705, 0.684].forEach(y => torus([s * 0.055, y, sd[2] - 0.085], 0.02, 0.0055, 4, 12, C.chrome, BN.root, null)); });
    // передний багажник (на раме, руль его не крутит), корзинка, бантик, фара-«глазок»
    const bk = D.basket;
    rbox([0, bk[1] - 0.012, bk[2]], 0.28, 0.014, 0.31, 0.006, C.chrome, BN.root);
    [-1, 1].forEach(s => { rod([s * 0.1, bk[1] - 0.018, bk[2] - 0.13], [s * 0.025, 0.715, 0.3], 0.009, C.chrome, BN.root, { rad: 5 }); rod([s * 0.1, bk[1] - 0.018, bk[2] + 0.14], [s * 0.04, 0.6, 0.44], 0.008, C.chrome, BN.root, { rad: 5 }); });
    {
      // плетёная корзинка: тело вращения, сплющенное в овал; плетение — шахматка цветами по граням
      const prof = [[0.001, 0], [0.108, 0], [0.118, 0.012], [0.122, 0.04], [0.126, 0.07], [0.131, 0.1], [0.136, 0.13], [0.141, 0.16], [0.146, 0.185], [0.153, 0.197], [0.151, 0.209], [0.142, 0.203], [0.136, 0.186], [0.128, 0.12], [0.118, 0.05], [0.108, 0.022], [0.001, 0.022]];
      const SEG = 18, lg = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), SEG).toNonIndexed();
      const pos = lg.attributes.position, n = pos.count, col = new Float32Array(n * 3);
      const cA = new T.Color(C.wicker), cB = new T.Color(C.wickerD), cR = new T.Color('#D2A066');
      for (let f = 0; f < n; f += 3) {
        let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += pos.getX(f + k); y += pos.getY(f + k); z += pos.getZ(f + k); }
        x /= 3; y /= 3; z /= 3;
        const ai = Math.floor(((Math.atan2(z, x) + PI) / (PI * 2)) * SEG), yi = Math.floor(y / 0.03);
        const c = y > 0.19 ? cR : ((ai + yi) % 2 ? cA : cB);
        for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
      }
      lg.setAttribute('color', new T.BufferAttribute(col, 3));
      xf(lg, bk, [1.22, 1.05, 1.04]);
      add(lg, '#FFFFFF', BN.root, { ol: true });
      sph([0.045, bk[1] + 0.15, bk[2] + 0.155], [0.042, 0.026, 0.016], C.bow, BN.root, null, [0, 0, -0.45]);
      sph([-0.045, bk[1] + 0.15, bk[2] + 0.155], [0.042, 0.026, 0.016], C.bow, BN.root, null, [0, 0, 0.45]);
      sph([0, bk[1] + 0.148, bk[2] + 0.162], [0.017, 0.017, 0.014], C.bowD, BN.root);
      [-1, 1].forEach(s => rod([s * 0.008, bk[1] + 0.142, bk[2] + 0.162], [s * 0.03, bk[1] + 0.09, bk[2] + 0.168], 0.007, C.bow, BN.root, { rad: 5 }));
    }
    sph([0, 0.675, 0.7], [0.058, 0.058, 0.045], C.chrome, BN.root, { ol: true });
    sph([0, 0.675, 0.728], [0.046, 0.046, 0.022], C.lens, BN.root, { emis: '#FFE2A0', ei: 0.7 });
    rod([0, 0.675, 0.69], [0, 0.723, 0.66], 0.009, C.chrome, BN.root, { rad: 5 });

    /* руль: вилка, переднее крыло, вынос, изогнутый назад руль, ручки, звонок (кость руля) */
    const st = BN.steer;
    const crown = axisAt(0.7);
    [-1, 1].forEach(s => tube([[s * 0.05, 0.69, crown[2] - 0.005], [s * 0.054, 0.52, 0.385], [s * 0.056, 0.4, 0.452], [s * 0.056, D.WR, D.zF]], 0.014, C.paint, st, { paint: true, seg: 10 }));
    rbox([0, 0.7, crown[2]], 0.13, 0.03, 0.05, 0.012, C.paint, st, { paint: true });
    fender([0, D.WR, D.zF], D.WR + 0.03, 0.013, 0.08, -25 * PI / 180, 145 * PI / 180, C.paint, st, { ol: true, paint: true });
    const stemTop = axisAt(0.93);
    rod(hb1, stemTop, 0.02, C.chrome, st);
    rod([-0.03, stemTop[1], stemTop[2]], [0.03, stemTop[1], stemTop[2]], 0.024, C.chrome, st);
    [-1, 1].forEach(s => {
      tube([[0, stemTop[1], stemTop[2]], [s * 0.1, 0.946, 0.24], [s * 0.2, 0.962, 0.17], [s * 0.252, 0.969, 0.07], [s * 0.266, 0.972, -0.035]], 0.0125, C.chrome, st, { seg: 14, caps: false });
      rod([s * 0.257, 0.9705, 0.06], [s * 0.268, 0.972, -0.045], 0.019, C.leather, st, { rad: 8 });
      sph([s * 0.268, 0.972, -0.048], [0.02, 0.02, 0.012], C.leatherD, st);
    });
    // звонок: хромированный купол и розовая кнопочка (своя кость: качается от «дзынь»)
    const bl = [0.17, 0.968, 0.205];
    add(xf(new T.SphereGeometry(1, 10, 5, 0, PI * 2, 0, PI / 2), [bl[0], bl[1] + 0.012, bl[2]], [0.03, 0.026, 0.03]), C.chrome, BN.bell);
    sph([bl[0], bl[1] + 0.039, bl[2]], [0.008, 0.008, 0.008], C.chromeD, BN.bell);
    rbox([bl[0] - 0.035, bl[1] + 0.02, bl[2] - 0.01], 0.035, 0.012, 0.018, 0.005, C.bow, BN.bell);
    rod([bl[0], bl[1] + 0.012, bl[2]], [bl[0] - 0.012, bl[1] - 0.004, bl[2] - 0.004], 0.006, C.chromeD, BN.bell, { rad: 5 });

    /* шатун и педали; подножка */
    const cb = BN.crank;
    rod([-0.11, bb[1], bb[2]], [0.11, bb[1], bb[2]], 0.016, C.chromeD, cb, { rad: 8 });
    rbox([0.088, bb[1] - D.LC / 2, bb[2]], 0.016, D.LC + 0.03, 0.03, 0.01, C.chrome, cb);
    rbox([-0.088, bb[1] + D.LC / 2, bb[2]], 0.016, D.LC + 0.03, 0.03, 0.01, C.chrome, cb);
    rbox([0.135, bb[1] - D.LC, bb[2]], 0.085, 0.024, 0.058, 0.01, C.dark, BN.pl);
    rbox([-0.135, bb[1] + D.LC, bb[2]], 0.085, 0.024, 0.058, 0.01, C.dark, BN.pr);
    tube([[0.07, 0.24, -0.13], [0.13, 0.11, -0.17], [0.17, 0.012, -0.205]], 0.011, C.chromeD, BN.stand, { seg: 6, rad: 5 });
    sph([0.17, 0.012, -0.205], [0.022, 0.01, 0.03], C.chromeD, BN.stand);

    /* скелет */
    const bones = [];
    const mk = (name, parent, p) => { const b = new T.Bone(); b.name = name; b.position.set(p[0], p[1], p[2]); if (parent >= 0) bones[parent].add(b); bones.push(b); return b; };
    mk('root', -1, [0, 0, 0]);
    mk('steer', 0, D.steerAt);
    mk('wheelF', 1, [0, D.WR - D.steerAt[1], D.zF - D.steerAt[2]]);
    mk('wheelR', 0, [0, D.WR, D.zR]);
    mk('crank', 0, bb);
    mk('pedalL', 4, [0.12, -D.LC, 0]);
    mk('pedalR', 4, [-0.12, D.LC, 0]);
    mk('stand', 0, [0.07, 0.24, -0.13]);
    mk('bell', 1, [bl[0] - D.steerAt[0], bl[1] - D.steerAt[1], bl[2] - D.steerAt[2]]);

    /* склейка: тело (цвет и свечение по вершинам) и контур (сглаженные нормали) — общий скелет */
    function pack(list, outline) {
      let n = 0, ni = 0; list.forEach(p => { const g = p.g; p.n = g.attributes.position.count; n += p.n; ni += g.index ? g.index.count : p.n; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const col = outline ? null : new Float32Array(n * 3), emi = outline ? null : new Float32Array(n * 3);
      const idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let off = 0, io = 0; const paintRanges = [];
      list.forEach(p => {
        const g = p.g, c = p.n, vc = g.attributes.color;
        pos.set(g.attributes.position.array, off * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
        for (let i = 0; i < c; i++) { si[(off + i) * 4] = p.bone; sw[(off + i) * 4] = 1; }
        if (!outline) {
          for (let i = 0; i < c; i++) {
            const q = (off + i) * 3;
            if (vc) { col[q] = p.col.r * vc.getX(i); col[q + 1] = p.col.g * vc.getY(i); col[q + 2] = p.col.b * vc.getZ(i); } else { col[q] = p.col.r; col[q + 1] = p.col.g; col[q + 2] = p.col.b; }
            if (p.emis) { emi[q] = p.emis.r; emi[q + 1] = p.emis.g; emi[q + 2] = p.emis.b; }
          }
          if (p.paint) paintRanges.push([off, c]);
        }
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + off; } else for (let i = 0; i < c; i++) idx[io++] = off + i;
        off += c;
      });
      const mg = new T.BufferGeometry();
      mg.setAttribute('position', new T.BufferAttribute(pos, 3));
      if (outline) {
        // сглаженные нормали по совпадающим вершинам: контур без разрывов на рёбрах
        const map = new Map(), sm = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const k = Math.round(pos[i * 3] * 2000) + ',' + Math.round(pos[i * 3 + 1] * 2000) + ',' + Math.round(pos[i * 3 + 2] * 2000); let a = map.get(k); if (!a) { a = [0, 0, 0, []]; map.set(k, a); } a[0] += nor[i * 3]; a[1] += nor[i * 3 + 1]; a[2] += nor[i * 3 + 2]; a[3].push(i); }
        map.forEach(a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; a[3].forEach(i => { sm[i * 3] = a[0] / L; sm[i * 3 + 1] = a[1] / L; sm[i * 3 + 2] = a[2] / L; }); });
        mg.setAttribute('normal', new T.BufferAttribute(sm, 3));
      } else {
        mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
        mg.setAttribute('color', new T.BufferAttribute(col, 3));
        mg.setAttribute('emis', new T.BufferAttribute(emi, 3));
      }
      mg.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
      mg.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      mg.setIndex(new T.BufferAttribute(idx, 1));
      mg.computeBoundingBox(); mg.computeBoundingSphere();
      mg.userData.paintRanges = paintRanges;
      return mg;
    }
    const bodyG = pack(parts, false), olG = pack(parts.filter(p => p.ol), true);
    if (WORLD.Bike && WORLD.Bike.DEBUG) { const by = {}; parts.forEach(p => { const k = p.g.type + (p.ol ? '+ol' : ''); by[k] = (by[k] || 0) + (p.g.index ? p.g.index.count : p.g.attributes.position.count) / 3 * (p.ol ? 2 : 1); }); WORLD.Bike.breakdown = by; }
    const tris = (bodyG.index.count + olG.index.count) / 3;
    parts.forEach(p => p.g.dispose()); SPH.dispose(); SPHL.dispose();
    return { bodyG, olG, bones, BN, tris, bodyTris: bodyG.index.count / 3 };
  }

  // контур со скелетом (как у героини): та же сетка, раздута по сглаженным нормалям, задние грани
  function outlineMat(T) {
    return new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    });
  }

  /* =====================================================================
     ВЕЛОСИПЕД: модель + езда + посадка
     ===================================================================== */
  function create(o = {}) {
    const T = o.THREE || window.THREE, H = o.kit, scene = o.scene;
    if (!T || !H) throw new Error('Bike.create: нужен THREE и kit');
    const L = () => o.layout || WORLD.LAYOUT || {};
    const colIdx = typeof o.color === 'number' ? o.color : WORLD.BIKE_COLORS.findIndex(c => c[1] === o.color);
    const paintHex = typeof o.color === 'string' ? o.color : WORLD.BIKE_COLORS[Math.max(0, colIdx)][1];
    const model = buildModel(T, H, paintHex);

    const group = new T.Group(); group.name = 'bike';
    const leanG = new T.Group(); group.add(leanG);
    const mat = H.emisPatch(H.addRim(H.toon('#FFFFFF', { vertexColors: true }), 1), 'bike');
    const mesh = new T.SkinnedMesh(model.bodyG, mat); mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'bikeBody';
    mesh.add(model.bones[0]);
    leanG.add(mesh); group.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(model.bones); mesh.bind(skeleton);
    const olM = outlineMat(T);
    const outline = new T.SkinnedMesh(model.olG, olM); outline.castShadow = false; outline.receiveShadow = false; outline.userData.outline = true;
    leanG.add(outline); outline.bind(skeleton, mesh.bindMatrix);
    // попадание лучом — по коробке (без перебора вершин со скелетом)
    const bb = model.bodyG.boundingBox.clone(), bbW = new T.Box3(), hitV = new T.Vector3();
    mesh.raycast = (rc, out) => { bbW.copy(bb).applyMatrix4(mesh.matrixWorld); if (rc.ray.intersectBox(bbW, hitV)) { const d = rc.ray.origin.distanceTo(hitV); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hitV.clone(), object: mesh }); } };
    outline.raycast = () => {};
    // тень — от простой «куклы» велосипеда (≈ 300 треугольников вместо 9 тыс.): колёса-диски, рама, седло, корзинка
    const shadowProxy = (() => {
      const list = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      const put = (g, p, r, sc) => { e.set(r[0], r[1], r[2]); q.setFromEuler(e); m4.compose(new T.Vector3(p[0], p[1], p[2]), q, new T.Vector3(sc[0], sc[1], sc[2])); g.applyMatrix4(m4); list.push(g.index ? g.toNonIndexed() : g); };
      [D.zR, D.zF].forEach(z => put(new T.CylinderGeometry(D.WR, D.WR, 0.05, 14), [0, D.WR, z], [0, 0, PI / 2], [1, 1, 1]));
      put(new T.BoxGeometry(0.06, 0.06, 0.62), [0, 0.47, 0.1], [0.62, 0, 0], [1, 1, 1]);             // нижняя труба
      put(new T.BoxGeometry(0.05, 0.46, 0.05), [0, 0.47, -0.19], [-0.5, 0, 0], [1, 1, 1]);            // подседельная
      put(new T.BoxGeometry(0.16, 0.05, 0.26), [0, 0.74, -0.36], [0, 0, 0], [1, 1, 1]);               // седло
      put(new T.BoxGeometry(0.15, 0.03, 0.46), [0, 0.66, -0.54], [0, 0, 0], [1, 1, 1]);               // багажник
      put(new T.CylinderGeometry(0.16, 0.13, 0.2, 8), [0, D.basket[1] + 0.1, D.basket[2]], [0, 0, 0], [1.2, 1, 1]);   // корзинка
      put(new T.BoxGeometry(0.56, 0.03, 0.05), [0, 0.96, 0.15], [0, 0, 0], [1, 1, 1]);               // руль
      let n = 0; list.forEach(g => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3); let o2 = 0; list.forEach(g => { pos.set(g.attributes.position.array, o2 * 3); o2 += g.attributes.position.count; g.dispose(); });
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere();
      const pm = new T.Mesh(geo, new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      pm.castShadow = true; pm.receiveShadow = false; pm.renderOrder = -1; pm.raycast = () => {}; pm.name = 'bikeShadow';
      if (o.shadowLayer) pm.layers.set(o.shadowLayer);   // свой слой: тогда главный проход эту куклу не рисует (нужен sun.shadow.camera.layers.enable(слой))
      return pm;
    })();
    leanG.add(shadowProxy);
    const seat = new T.Group(); seat.name = 'bikeSeat'; seat.position.set(D.heroRoot[0], D.heroRoot[1], D.heroRoot[2]); leanG.add(seat);
    const basket = new T.Group(); basket.name = 'bikeBasket'; basket.position.set(D.basket[0], D.basket[1] + 0.02, D.basket[2]); leanG.add(basket);
    const B = model.bones, BN = model.BN;
    if (scene) scene.add(group);

    /* --- состояние --- */
    const at = o.at || parkSpot(L(), o.colliders);
    const S = {
      x: at.x, z: at.z, ry: at.ry || 0, v: 0, yawRate: 0, steer: 0, lean: D.PARK_LEAN, crank: PI / 2, spin: 0,
      stand: 1, bellT: -1, lastRing: -9, mounted: false, hero: null, heroParent: null, tween: null, braking: null,
      stillT: 0, bumpT: 9, doorT: 0, pedaling: false, wantStop: false, t: 0, lastDoor: null,
    };
    const VMAX = o.vmax || D.VMAX;
    const ev = {};
    const emit = (n, d) => (ev[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('bike ' + n, e); } });

    /* --- столкновения: сетка 8 м по коллайдерам (MAP.colliders), круги «колесо–середина–колесо» --- */
    let grid = null;
    function gridOf() {
      if (grid || !o.colliders) return grid;
      const CELL = 8, cells = new Map(), key = (i, j) => i * 4096 + j, big = [];
      const addTo = (x0, x1, z0, z1, it, k) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const kk = key(i, j); if (!cells.has(kk)) cells.set(kk, { c: [], b: [] }); cells.get(kk)[k].push(it); } };
      (o.colliders.circles || []).forEach(c => addTo(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, c, 'c'));
      (o.colliders.boxes || []).forEach(b => { if (b.noWalk === false) return; if ((b.x1 - b.x0) * (b.z1 - b.z0) > 900) big.push(b); else addTo(b.x0, b.x1, b.z0, b.z1, b, 'b'); });
      const seen = new Set();
      grid = { near(x, z, r, fc, fb) { seen.clear(); for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const c = cells.get(key(i, j)); if (!c) continue; c.c.forEach(it => { if (!seen.has(it)) { seen.add(it); fc(it); } }); c.b.forEach(it => { if (!seen.has(it)) { seen.add(it); fb(it); } }); } big.forEach(fb); } };
      return grid;
    }
    const BODY = [[0.44, 0.24], [0, 0.26], [-0.44, 0.24]];
    const _push = [0, 0];
    function pushCircle(x, z, r, dyn) {
      let px = 0, pz = 0;
      const gr = gridOf();
      const fc = c => { const dx = x - c.x, dz = z - c.z, m = c.r + r, d = Math.hypot(dx, dz); if (d < m && d > 1e-5) { const k = (m - d) / d; px += dx * k; pz += dz * k; } };
      if (gr) gr.near(x, z, r + 1, fc, b => {
        if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
          const dl = x - (b.x0 - r), dr = (b.x1 + r) - x, dn = z - (b.z0 - r), ds = (b.z1 + r) - z, m = Math.min(dl, dr, dn, ds);
          if (m === dl) px -= dl; else if (m === dr) px += dr; else if (m === dn) pz -= dn; else pz += ds;
        }
      });
      if (dyn) dyn.forEach(fc);
      _push[0] = px; _push[1] = pz; return _push;
    }
    // проходимость: 2 — едет как хочет (layout.rideable: дороги, дорожки парка, променад), 1 — тихонько, до 2,2 м/с
    // (тротуар и прочее «пешеходное», если rideable его не включает: так можно подъехать к двери), 0 — нельзя.
    // Без rideable: дорога (drivable) || тротуар (walkable) || в границах и не в коллайдере — всё «2».
    const walkAt = (x, z) => { const l = L(); if (typeof l.walkable === 'function') return !!l.walkable(x, z); const b = l.bounds; if (b && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) return false; return freeAt(o.colliders, x, z, 0.05); };
    function rideZone(x, z) {
      const l = L();
      if (typeof l.rideable === 'function') return l.rideable(x, z) ? 2 : walkAt(x, z) ? 1 : 0;
      const b = l.bounds; if (b && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) return 0;
      if (typeof l.drivable === 'function' && l.drivable(x, z, 0.3)) return 2;
      return walkAt(x, z) ? 2 : 0;
    }
    const poseZone = (x, z, ry) => { const fx = Math.sin(ry), fz = Math.cos(ry); return Math.min(rideZone(x + fx * 0.5, z + fz * 0.5), rideZone(x - fx * 0.5, z - fz * 0.5), rideZone(x, z)); };
    const poseOK = (x, z, ry) => poseZone(x, z, ry) > 0;
    const SLOW = o.vslow || 2.2;

    /* --- поза: кости и наклон --- */
    const _q = new T.Quaternion(), _ax = new T.Vector3(AX[0], AX[1], AX[2]);
    function place() {
      group.position.set(S.x, 0, S.z); group.rotation.y = S.ry;
      leanG.rotation.z = -S.lean;
      B[BN.steer].quaternion.setFromAxisAngle(_ax, S.steer);
      B[BN.wf].rotation.x = S.spin; B[BN.wr].rotation.x = S.spin;
      B[BN.crank].rotation.x = S.crank; B[BN.pl].rotation.x = -S.crank; B[BN.pr].rotation.x = -S.crank;
      const sk = S.stand;
      B[BN.stand].rotation.set(1.22 * (1 - sk), 0, -0.5 * (1 - sk));
      if (S.bellT >= 0) { const k = S.bellT; B[BN.bell].rotation.set(0, Math.sin(k * 40) * 0.6 * Math.max(0, 1 - k * 2), 0); } else B[BN.bell].rotation.set(0, 0, 0);
    }
    place();

    /* --- посадка / высадка --- */
    const _v = new T.Vector3(), _w = new T.Vector3(), _qa = new T.Quaternion(), _qb = new T.Quaternion();
    const toWorld = (lx, lz) => { const c = Math.cos(S.ry), s = Math.sin(S.ry); return { x: S.x + lx * c + lz * s, z: S.z - lx * s + lz * c }; };
    function mountPoint() { return toWorld(0.62, -0.2); }
    function mount(hero, opt = {}) {
      if (S.mounted || S.tween || !hero || !hero.root) return Promise.resolve(false);
      S.mounted = true; S.hero = hero; S.heroParent = hero.root.parent || scene; S.v = 0; S.braking = null; S.ridden = 0; S.lastDoor = null;
      group.updateMatrixWorld(true);
      seat.attach(hero.root);
      const p0 = hero.root.position.clone(), q0 = hero.root.quaternion.clone();
      if (hero.body) hero.body.position.y = 0;
      return new Promise(res => {
        const fin = () => { hero.root.position.set(0, 0, 0); hero.root.quaternion.identity(); S.tween = null; S.stand = 0; emit('mount', {}); res(true); };
        if (opt.instant) { fin(); return; }
        S.tween = { t: 0, dur: 0.55, kind: 'mount', tick(k) {
          const e = k * k * (3 - 2 * k);
          hero.root.position.set(p0.x * (1 - e), p0.y * (1 - e) + Math.sin(k * PI) * 0.28, p0.z * (1 - e));
          hero.root.quaternion.copy(q0).slerp(_qa.identity(), Math.min(1, k * 1.6));
          S.stand = 1 - Math.max(0, (k - 0.55) / 0.45);
        }, done: fin };
      });
    }
    // место, куда встать: слева у седла, иначе справа, сзади, спереди (не в стене и не в доме)
    function standSpot() {
      const cands = [[0.62, -0.2], [-0.62, -0.2], [0.75, 0.3], [-0.75, 0.3], [0, -1.05], [0, 1.1]];
      for (const [lx, lz] of cands) { const p = toWorld(lx, lz); const pp = pushCircle(p.x, p.z, 0.3); if (Math.hypot(pp[0], pp[1]) < 0.02 && (!L().bounds || (p.x > L().bounds.x0 && p.x < L().bounds.x1 && p.z > L().bounds.z0 && p.z < L().bounds.z1))) return p; }
      return toWorld(0.62, -0.2);
    }
    function dismount(opt = {}) {
      if (!S.mounted) return Promise.resolve(null);
      if (S.tween && S.tween.kind === 'dismount') return S.tween.promise;
      if (Math.abs(S.v) > 0.45 && !opt.instant) {   // сначала мягко затормозить
        if (!S.braking) S.braking = new Promise(r => { S.brakeDone = r; }).then(() => { S.braking = null; return dismount(opt); });
        return S.braking;
      }
      const hero = S.hero, par = S.heroParent || scene;
      const spot = standSpot(), ry = S.ry;
      group.updateMatrixWorld(true);
      par.attach(hero.root);
      const p0 = hero.root.position.clone(), q0 = hero.root.quaternion.clone(), qT = _qb.setFromAxisAngle(new T.Vector3(0, 1, 0), ry).clone();
      S.v = 0;
      let res;
      const pr = new Promise(r => { res = r; });
      const fin = () => {
        hero.root.position.set(spot.x, 0, spot.z); hero.root.quaternion.copy(qT);
        S.mounted = false; S.hero = null; S.tween = null; S.stand = 1;
        const out = { x: spot.x, z: spot.z, ry };
        emit('dismount', out); res(out);
      };
      if (opt.instant) { fin(); return pr; }
      S.tween = { t: 0, dur: 0.5, kind: 'dismount', promise: pr, tick(k) {
        const e = k * k * (3 - 2 * k);
        hero.root.position.set(p0.x + (spot.x - p0.x) * e, p0.y * (1 - e) + Math.sin(k * PI) * 0.22, p0.z + (spot.z - p0.z) * e);
        hero.root.quaternion.copy(q0).slerp(qT, e);
        S.stand = Math.min(1, k * 2);
      }, done: fin };
      return pr;
    }

    /* --- кот в корзинке --- */
    function carry(obj, where) { if (!obj) return; if (where === 'basket' || !where) { basket.add(obj); obj.position.set(0, 0, -0.01); obj.rotation.set(0, 0, 0); } }
    function uncarry(obj, parent) { if (!obj) return; (parent || scene).attach(obj); obj.rotation.x = 0; obj.rotation.z = 0; obj.position.y = 0; }

    /* --- звонок --- */
    function ring() {
      const now = performance.now() / 1000;
      if (now - S.lastRing < 0.55) return false;
      S.lastRing = now; S.bellT = 0;
      bellSound();
      try { const g = window.G; if (g && g.haptic) g.haptic('light'); } catch (e) { /* нет */ }
      emit('bell', { x: S.x, z: S.z });
      return true;
    }

    /* --- кадр --- */
    function lod() {
      if (S.hidden) { group.visible = false; return; }
      const cam = o.camera; if (!cam) { group.visible = true; return; }
      const d = Math.hypot(cam.position.x - S.x, cam.position.z - S.z);
      outline.visible = d < (o.outlineFar || 24);
      group.visible = d < (o.far || 70) || S.mounted;
    }
    function update(dt, inp) {
      dt = Math.min(Math.max(dt || 0, 0), 0.05); S.t += dt;
      lod();
      const out = { moved: 0, bumped: false, door: null };
      if (S.bellT >= 0) { S.bellT += dt; if (S.bellT > 0.6) S.bellT = -1; }
      if (S.tween) { S.tween.t += dt; const k = Math.min(1, S.tween.t / S.tween.dur); S.tween.tick(k); if (k >= 1 && S.tween) S.tween.done(); }
      const ride = S.mounted && !S.tween;
      let tv = 0, wantYaw = 0, input = false;
      if (ride && !S.braking) {
        if (inp && inp.dir && inp.dir[2] > 0.08) {
          const [dx, dz, mag] = inp.dir, err = angDiff(Math.atan2(dx, dz), S.ry);
          tv = Math.min(1, mag) * VMAX * (1 - 0.5 * Math.min(1, Math.abs(err) / 1.6));
          if (Math.abs(err) > 1.9) tv = Math.min(tv, 1.4);          // цель сзади: тихий разворот
          wantYaw = clamp(err * 2.4, -3, 3); input = true;
        } else if (inp && (inp.thr || inp.str)) {
          tv = inp.thr > 0 ? VMAX * Math.min(1, inp.thr) : 0;
          wantYaw = -clamp(inp.str || 0, -1, 1) * 2.0; input = !!(inp.thr > 0 || inp.str);
        }
        if (inp && inp.brake) tv = 0;
        // по тротуару — тихонько; впереди тротуар — сбавляет заранее, чтобы на бордюре уже было SLOW
        S.slowCap = false;
        if (tv > SLOW && typeof L().rideable === 'function') {
          if (poseZone(S.x, S.z, S.ry) === 1) { tv = SLOW; S.slowCap = true; }
          else { const fx = Math.sin(S.ry), fz = Math.cos(S.ry); for (let d = 0; d <= 3.2; d += 0.8) if (rideZone(S.x + fx * (d + 0.55), S.z + fz * (d + 0.55)) === 1) { tv = Math.min(tv, Math.sqrt(SLOW * SLOW + 2 * 4 * d)); S.slowCap = tv < S.v; break; } }
        }
      }
      // скорость: мягкий разгон, накат, тормоз
      const braking = !!S.braking || (inp && inp.brake) || (ride && inp && inp.thr < 0);
      const acc = tv > S.v ? 1.9 * (1 - 0.4 * S.v / VMAX) + 0.5 : braking || S.slowCap ? 4.2 : tv < 0.05 ? 1.1 : 2.4;
      const dv = clamp(tv - S.v, -acc * dt, acc * dt); S.v = Math.max(0, S.v + dv);
      if (!S.mounted) S.v = 0;
      S.pedaling = ride && tv > 0.3 && tv > S.v - 0.15;          // крутит, пока держит или набирает скорость; иначе накат
      // поворот: радиус не меньше RMIN; почти стоя — «перешагивает» на месте
      const maxYaw = S.v < 0.6 ? 1.5 : Math.min(2.6, S.v / D.RMIN);
      S.yawRate += (clamp(wantYaw, -maxYaw, maxYaw) - S.yawRate) * Math.min(1, dt * 6);
      if (!ride) S.yawRate = 0;
      S.ry += S.yawRate * dt;
      const steerT = S.v > 0.35 ? Math.atan(S.yawRate * D.WB / Math.max(0.8, S.v)) : clamp(wantYaw * 0.22, -0.5, 0.5);
      S.steer += (clamp(steerT, -0.62, 0.62) - S.steer) * Math.min(1, dt * 8);
      if (!S.mounted && !S.tween) S.steer += (0.12 - S.steer) * Math.min(1, dt * 3);          // на стоянке руль чуть повёрнут
      const leanT = S.mounted ? clamp(Math.atan(S.v * S.yawRate / 9.8) * 0.9, -0.33, 0.33) : D.PARK_LEAN * S.stand;
      S.lean += (leanT - S.lean) * Math.min(1, dt * (S.tween ? 8 : 5));

      // ход: дорога/дорожка (rideable), коллайдеры — мягко и со скольжением вдоль стены
      if (S.v > 0.001) {
        const fx = Math.sin(S.ry), fz = Math.cos(S.ry), step = S.v * dt;
        let nx = S.x + fx * step, nz = S.z + fz * step;
        const cur = poseOK(S.x, S.z, S.ry);
        if (cur && !poseOK(nx, nz, S.ry)) {
          const cand = [[S.x + fx * step, S.z], [S.x, S.z + fz * step]].filter(c => poseOK(c[0], c[1], S.ry)).sort((a, b) => Math.hypot(b[0] - S.x, b[1] - S.z) - Math.hypot(a[0] - S.x, a[1] - S.z));
          if (cand.length && Math.hypot(cand[0][0] - S.x, cand[0][1] - S.z) > step * 0.25) {
            const c = cand[0]; nx = c[0]; nz = c[1];
            const mvA = Math.atan2(nx - S.x, nz - S.z); S.ry += angDiff(mvA, S.ry) * Math.min(1, dt * 4);   // поворачивает вдоль края
            S.v *= 1 - Math.min(0.5, dt * 1.5);
          } else {
            nx = S.x; nz = S.z;
            if (S.v > 1.6 && S.bumpT > 1.2) { out.bumped = true; S.bumpT = 0; }
            S.v *= 0.3;
          }
        }
        // коллайдеры: три круга вдоль рамы толкают велосипед наружу
        const dyn = typeof o.dyn === 'function' ? o.dyn() : null;
        let tx = 0, tz = 0;
        for (let pass = 0; pass < 2; pass++) for (const [k, r] of BODY) {
          const p = pushCircle(nx + fx * k, nz + fz * k, r, dyn);
          if (p[0] || p[1]) { nx += p[0]; nz += p[1]; tx += p[0]; tz += p[1]; }
        }
        const pl = Math.hypot(tx, tz);
        if (pl > 1e-4) {
          const nX = tx / pl, nZ = tz / pl, vn = fx * nX + fz * nZ;     // vn < 0 — едет в стену
          if (vn < -0.15) {
            if (S.v > 1.8 && vn < -0.6 && S.bumpT > 1.2) { out.bumped = true; S.bumpT = 0; S.v *= 0.35; }
            else S.v *= 1 - Math.min(0.8, Math.abs(vn) * dt * 6);
            let tX = -nZ, tZ = nX; if (tX * fx + tZ * fz < 0) { tX = -tX; tZ = -tZ; }
            S.ry += angDiff(Math.atan2(tX, tZ), S.ry) * Math.min(1, dt * 3 * Math.abs(vn));
          }
        }
        const b = L().bounds; if (b) { nx = clamp(nx, b.x0, b.x1); nz = clamp(nz, b.z0, b.z1); }
        out.moved = Math.hypot(nx - S.x, nz - S.z); S.ridden = (S.ridden || 0) + out.moved;
        S.x = nx; S.z = nz;
      }
      S.bumpT += dt;
      if (out.bumped) emit('bump', { v: S.v });
      // колёса и педали: крутит — шатун идёт за колесом (передача), накатом — педали стоят, на остановке — горизонтально
      S.spin += S.v * dt / D.WR;
      if (S.pedaling) S.crank += Math.max(S.v / D.WR / D.GEAR, 2.6) * dt;
      else if (S.v < 0.25) { const lv = Math.round((S.crank - PI / 2) / PI) * PI + PI / 2; S.crank += (lv - S.crank) * Math.min(1, dt * 3); }
      // тормоз перед «слезть»
      if (S.braking && S.v < 0.3 && S.brakeDone) { const r = S.brakeDone; S.brakeDone = null; r(); }
      // остановилась у двери — слезает сама (дверь — у вызывающего: событие 'door')
      if (ride && S.v < 0.3 && !input) {
        S.stillT += dt;
        if (o.doors && typeof o.doors.near === 'function' && S.stillT > 0.35 && o.autoDismount !== false && S.ridden > 2) {
          const d = o.doors.near(S.x, S.z, o.doorR || 1.8, o.doorFilter || (q => q.kind !== 'filler'));
          if (d && d !== S.lastDoor) { S.lastDoor = d; out.door = d; emit('door', { door: d }); dismount(); }
        }
        if (S.stillT > 0.35 && !S.saidStop) { S.saidStop = true; emit('stopped', {}); }
      } else { S.stillT = 0; S.saidStop = false; if (S.v > 1) S.lastDoor = null; }
      place();
      return out;
    }

    /* --- входы для анимации героини (оси корня героини на седле) --- */
    const _p = new T.Vector3();
    // точка (lx,ly,lz) в осях кости → оси корня героини (seat): кости и седло — в одной группе наклона, сетка без
    // смещения, корневая кость в нуле, седло без поворота: хватает цепочки локальных матриц (без мировых — они могут
    // быть со вчерашнего кадра)
    const heroLocal = (bone, lx, ly, lz) => {
      _p.set(lx, ly, lz);
      for (let b = bone; b && b !== B[0]; b = b.parent) { b.updateMatrix(); _p.applyMatrix4(b.matrix); }
      return { x: _p.x - D.heroRoot[0], y: _p.y - D.heroRoot[1], z: _p.z - D.heroRoot[2] };
    };
    // формат — как opt.ride в HeroAnim (js/hero_anim.js, волна 3): точки в осях корня героини на седле
    // pedalPhase — по договорённости HeroAnim: 0 — левая педаль вверху, 0.25 — впереди (crankAngle — свой угол шатуна:
    // 0 — левая внизу); педали, ручки (с учётом поворота руля), седло и центр шатуна — точно по модели
    function rideInput() {
      const st = B[BN.steer], cr = B[BN.crank];
      const gL = D.grip, sa = D.steerAt;
      const crank = heroLocal(cr, 0, 0, 0);
      return {
        seat: { x: D.saddle[0] - D.heroRoot[0], y: D.saddle[1] - D.heroRoot[1], z: D.saddle[2] - D.heroRoot[2] },
        pedalL: heroLocal(B[BN.pl], 0.015, 0.012, 0), pedalR: heroLocal(B[BN.pr], -0.015, 0.012, 0),   // кость педали уже на x = ±0,12 от шатуна: середина площадки — ±0,135 (ANIM NEEDS-5)
        crank, crankAt: crank, crankR: D.LC, pedalX: 0.135,
        pedalPhase: (((S.crank + PI) / (PI * 2)) % 1 + 1) % 1, crankAngle: S.crank, pedaling: S.pedaling,
        handL: heroLocal(st, gL[0] - sa[0], gL[1] - sa[1], gL[2] - sa[2]),
        handR: heroLocal(st, -gL[0] - sa[0], gL[1] - sa[1], gL[2] - sa[2]),
        steer: S.steer, lean: S.lean, speed: S.v,
      };
    }
    // что слить в anim.update(dt, s): ride (HeroAnim волны 3 сам садит на седло и крутит педали); sitting — для
    // старого HeroAnim без ride (поза «стул»; запасная поза — WORLD.Bike.applyRidePose)
    function animState() {
      const tw = S.tween, sit = S.mounted && (!tw || (tw.kind === 'mount' && tw.t / tw.dur > 0.45)) || (tw && tw.kind === 'dismount' && tw.t / tw.dur < 0.4);
      return { speed: 0, sitting: !!sit, sitPose: 'chair', idle: false, turnRate: 0, waving: false, ride: sit ? rideInput() : null };
    }

    function setColor(c) {
      const hex = typeof c === 'number' ? WORLD.BIKE_COLORS[((c % 3) + 3) % 3][1] : c;
      const col = new T.Color(hex), a = model.bodyG.attributes.color;
      model.bodyG.userData.paintRanges.forEach(([s, n]) => { for (let i = s; i < s + n; i++) a.setXYZ(i, col.r, col.g, col.b); });
      a.needsUpdate = true; S.color = hex;
    }
    function dispose() {
      if (group.parent) group.parent.remove(group);
      model.bodyG.dispose(); model.olG.dispose(); mat.dispose(); olM.dispose(); skeleton.dispose(); shadowProxy.geometry.dispose(); shadowProxy.material.dispose();
    }
    const api = {
      group, lean: leanG, seat, basket, mesh, outline, shadowProxy, skeleton, S, D, tris: model.tris,
      mount, dismount, update, ring, carry, uncarry, rideInput, animState, setColor, dispose, mountPoint, place,
      on(n, f) { (ev[n] = ev[n] || []).push(f); return () => api.off(n, f); },
      off(n, f) { ev[n] = (ev[n] || []).filter(x => x !== f); },
      near(x, z, r = 1.7) { return Math.hypot(x - S.x, z - S.z) < r; },
      teleport(x, z, ry) { if (!isFinite(x) || !isFinite(z)) return false; S.x = x; S.z = z; if (isFinite(ry)) S.ry = ry; S.v = 0; place(); return true; },
      setHidden(b) { S.hidden = !!b; lod(); },
      get pos() { return { x: S.x, z: S.z }; },
      get ry() { return S.ry; }, get speed() { return S.v; }, get crankPhase() { return S.crank; },
      get pedalPhase() { return ((S.crank / (PI * 2)) % 1 + 1) % 1; },
      get steer() { return S.steer; }, get leanAngle() { return S.lean; },
      get mounted() { return S.mounted; }, get busy() { return !!S.tween || !!S.braking; },
      get handPoints() { const r = rideInput(); return { L: r.handL, R: r.handR }; },
      get crankPoint() { return rideInput().crankAt; },
      get pedalPoints() { const r = rideInput(); return { L: r.pedalL, R: r.pedalR }; },
      get seatPoint() { return rideInput().seat; },
      get basketPoint() { basket.updateMatrixWorld(true); const p = new T.Vector3(); basket.getWorldPosition(p); return { x: p.x, y: p.y, z: p.z }; },
      dogPoint(side = 1) { return toWorld(0.85 * side, -0.35); },
    };
    return api;
  }

  /* ---------- запасная поза «на велосипеде» поверх HeroAnim (пока в нём нет opt.ride) ---------- */
  // ничего не делает, если HeroAnim уже умеет opt.ride (HeroAnim.RIDE) — тогда поза из anim.update; force — всё равно
  function applyRidePose(anim, root, ride, k = 1, force) {
    const VP = WORLD.VehiclePose;
    if (!VP || !anim || !anim.bones || !ride || k <= 0) return false;
    if (!force && VP.native()) return false;
    return VP.ride(anim, root, ride, k);
  }

  /* ---------- дуги велопарковки (декорация у стоянки, 1 вызов) ---------- */
  function makeStand(H, spot) {
    const T = H.T, g = new T.Group(), m = H.toon('#B9BCC8');
    const arc = new T.TorusGeometry(0.32, 0.022, 5, 14, PI);
    [-0.45, 0.45].forEach(dz => { const mm = new T.Mesh(arc, m); mm.position.set(0.0, 0.02, dz); mm.rotation.y = PI / 2; g.add(mm); });
    const geo = H.geoOf(g); arc.dispose();
    const mesh = new T.Mesh(geo, H.VC.front); mesh.castShadow = false; mesh.receiveShadow = false;
    const out = new T.Group(); out.add(mesh);
    if (spot) { out.position.set(spot.x, 0, spot.z); out.rotation.y = (spot.ry || 0); }
    // дуги — сбоку от стоянки (слева по ходу, со стороны тротуара)
    mesh.position.set(-0.42, 0, 0);
    return out;
  }

  /* ---------- стоянка проката (декор у 'bikes' pois): n велосипедов разных цветов одной статичной сеткой ----------
     makeRack(kit, {x,z,ry}, n=2) → Group (1 вызов + 1 контур); rack.lod(camera) — контур дальше 24 м гаснет,
     весь ряд дальше 70 м — тоже. Кататься — на главном велосипеде (create); ряд — только картинка. */
  function makeRack(H, spot, n = 2) {
    const T = H.T, parts = [], ols = [], m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const md = buildModel(T, H, WORLD.BIKE_COLORS[i % 3][1]);
      m4.compose(new T.Vector3(i * 0.62 - (n - 1) * 0.31, 0, (i % 2) * 0.12), q.setFromAxisAngle(up, (i % 2 ? -1 : 1) * 0.04), new T.Vector3(1, 1, 1));
      const b = md.bodyG.clone(); b.applyMatrix4(m4); parts.push(b);
      const o = md.olG.clone(); o.applyMatrix4(m4); ols.push(o);
      md.bodyG.dispose(); md.olG.dispose();
    }
    const cat = (list, attrs) => {
      let nv = 0, ni = 0; list.forEach(g => { nv += g.attributes.position.count; ni += g.index.count; });
      const out = new T.BufferGeometry(), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      attrs.forEach(a => { const arr = new Float32Array(nv * 3); let off = 0; list.forEach(g => { arr.set(g.attributes[a].array, off * 3); off += g.attributes.position.count; }); out.setAttribute(a, new T.BufferAttribute(arr, 3)); });
      let off = 0, io = 0; list.forEach(g => { const ia = g.index.array; for (let k = 0; k < ia.length; k++) idx[io++] = ia[k] + off; off += g.attributes.position.count; g.dispose(); });
      out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
    };
    const body = new T.Mesh(cat(parts, ['position', 'normal', 'color', 'emis']), H.emisPatch(H.addRim(H.toon('#FFFFFF', { vertexColors: true }), 1), 'bikeRack'));
    body.castShadow = true; body.receiveShadow = false;
    const ol = new T.Mesh(cat(ols, ['position', 'normal']), H.outlineMat); ol.castShadow = false; ol.raycast = () => {};
    const g = new T.Group(); g.name = 'bikeRack'; g.add(body); g.add(ol);
    // стойка с поручнем за колёсами
    const st = makeStand(H, null); st.position.set(0, 0, 0); st.children[0].position.set(0, 0, 0); st.rotation.y = PI / 2; st.scale.set(1, 1, Math.max(1, n * 0.6)); g.add(st);
    if (spot) { g.position.set(spot.x, 0, spot.z); g.rotation.y = spot.ry || 0; }
    g.userData.lod = cam => { const d = Math.hypot(cam.position.x - g.position.x, cam.position.z - g.position.z); ol.visible = d < 24; g.visible = d < 70; };
    g.lod = g.userData.lod;
    return g;
  }

  WORLD.Bike = { create, applyRidePose, parkSpot, makeStand, makeRack, bellSound, DIM: D };
})();
