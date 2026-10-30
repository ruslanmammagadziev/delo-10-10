/* =====================================================================
   «БЕГ ПО КУБАЧИ» — АКТЁРЫ РАННЕРА (роль ACTORS): window.VILLAGE.runnerActors
   Героиня в казе (та же 3D-героиня мира в текущем образе) с позами раннера поверх HeroAnim и пальтар-догоняющий
   (тот же ряженый, что на свадьбе: VILLAGE.wedding.buildPaltar — высокий, в кольчуге и маске, с бубенцами и плёткой).
   Обычный <script>, без модулей; нужен THREE r149. Необязательные: js/hero_anim.js (кости героини), js/village/kaz.js (каз),
   js/village/wedding.js (пальтар; без него — простой ряженый из коробок), js/hero_outfits.js (образ: сумочка в беге прячется).

   Контракт (SPEC.md, «Контракты между частями»; как зовёт ядро — NOTES роли CORE §3):
     create(ctx) → actors     ctx: { THREE, scene, quality, hero?, anim?, kazApi?, named, kit, paltarVariant? ('D' — с плёткой),
                                     loadHero? (false — не грузить свою героиню, когда хост героиню не дал) }
     actors.hero   = { root, set(pose, k), update(dt, s) }   pose: 'idle' | 'run' | 'jump' (k — полёт, с) | 'slide' (k — длительность)
                                                            | 'stumble' (k ≈ 0,5–0,6) | 'caught' | 'glide' (k — весь полёт)
     actors.paltar = { root, set(pose), update(dt, s), jingle(), crack() }   pose: 'idle' | 'run' | 'near' | 'catch' | 'cheer'
                                                            | 'selfie' (пасхалка заставки: рука с телефоном вверх, «класс», голова к ней)
     actors.dispose()  — вернуть героиню хосту: родитель, место, поворот, масштаб, видимость, body; каз снять, если надевали мы
     actors.info()     — { hero: 'rig'|'statue'|'doll', paltar: 'wedding'|'box', tris, calls, kaz: 'own'|'host'|null, glide }
   Корень героини и пальтара ставит ядро (позиция; rotation.y = π − наклон — лицом в −z); всё внутри — актёры: кости, body,
   каз, крыло параплана, блоб-тени (по s.ground / s.pground).

   Почему так (главное):
     • Поза раннера — слой ПОВЕРХ HeroAnim, а не свой скелет: шаг-бег (спринт — слой wSpr), IK стоп, волосы, полы пальто, каз
       и одежда образа (SkinnedMesh на тех же костях) — всё остаётся. После anim.update кости, которые ведёт поза (прыжок,
       подкат, спотыкание, «поймана», вис), ПОВОРАЧИВАЮТСЯ К ЦЕЛИ (slerp на вес позы) — не прибавкой: в прыжке ноги не
       «спорят» с фазой шага, а бег при этом не останавливается (после приземления ноги сразу в шаге, без разгона с места).
       Мелочи (наклон корпуса, крен в смене полосы, «пружинка» приземления) — прибавкой к body.
     • Подкат — «бейсбольный» на боку: таз почти у земли, одна нога вперёд прямая, другая подогнута, корпус откинут, рука
       вверх, другая — к мостовой; рост ≈ 0,8 м (габарит ядра 0,9). Вес позы — s.slide (ядро сглаживает 0…1).
     • Прыжок — три манеры по очереди (группировка с руками вверх, «шпагат-бегунья», прыжок с поворотом): одно и то же
       в каждом прыжке приедается за полминуты.
     • Поймана — шуточно: остановилась, обернулась в полоборота к нему, «ой!» — ладошки к щекам, потом смеётся и разводит
       руками («ну поймал, поймал»); пальтар грозит пальцем и радуется — без хватания и без насилия.
     • Пальтар — поза языком двора (q: руки up/fo, ноги, наклоны → rig.apply), бег с подпрыгиванием на каждом шаге, руки
       работают; «почти догнал» — тянет руки и шевелит пальцами; щелчок плёткой — ТОЛЬКО вверх и в сторону от героини
       (замах за голову → бросок вверх-наружу → волна по косичке), до и после — плётка на поясе.
     • Тени — одна InstancedMesh на двоих (1 вызов), вычитающее смешивание: пятно темнит землю, не «бело-серым» стеклом
       (цвет экземпляра — сила: высоко на параплане пятно меньше и слабее).
     • Параплан — своё крыло-дуга (ячейки цвета вершин, 1 вызов) и стропы к кистям (LineSegments, 1 вызов), видны только
       в полёте; модуль js/village/paraglider.js (карта высот, посадки) раннеру не нужен.
     • В кадре — без new: векторы, кватернионы, массивы поз заведены заранее.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2, D = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
  // «колокол» 0 → 1 → 0 на u 0…1 с нулевой скоростью на краях (поза входит и уходит без рывка)
  const bell = u => { const s = Math.sin(clamp(u, 0, 1) * PI); return s * s; };
  const angW = a => a - TAU * Math.round(a / TAU);
  const POSES = ['idle', 'run', 'jump', 'slide', 'stumble', 'caught', 'glide'];
  const PPOSES = ['idle', 'run', 'near', 'catch', 'cheer', 'selfie'];
  // кости, которые ведут позы раннера (поворот к цели); остальные — как у HeroAnim
  const OVB = ['hips', 'spine', 'chest', 'neck', 'head', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R'];

  /* ---------------------------------------------------------------------
     ОБЩЕЕ: блоб-тени (одна InstancedMesh), простые материалы
     --------------------------------------------------------------------- */
  function blobs(T, scene, own) {
    // радиальное пятно; цвет — «сколько вычесть» (сиреневатая тень под стиль игры: тёмный #3A2E3F, не чёрный)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgb(104,112,92)'); gr.addColorStop(0.45, 'rgb(78,84,70)'); gr.addColorStop(1, 'rgb(0,0,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(cv); own.push(tex);
    const geo = new T.PlaneGeometry(1, 1); geo.rotateX(-PI / 2); own.push(geo);
    const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.SubtractiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    own.push(mat);
    const im = new T.InstancedMesh(geo, mat, 2); im.name = 'runner:blobs'; im.frustumCulled = false; im.renderOrder = 2;
    const m4 = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    for (let i = 0; i < 2; i++) { im.setMatrixAt(i, m4.identity()); im.setColorAt(i, col.setRGB(1, 1, 1)); }
    scene.add(im);
    return {
      mesh: im,
      // i — 0 героиня, 1 пальтар; x, y (опора), z; sx, sz — размер; k — сила 0…1; on — видно
      set(i, x, y, z, sx, sz, k, on) {
        p.set(x, y + 0.022, z); s.set(on ? Math.max(0.01, sx) : 0.0001, 1, on ? Math.max(0.01, sz) : 0.0001);
        im.setMatrixAt(i, m4.compose(p, q, s)); im.setColorAt(i, col.setRGB(k, k, k));
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      },
    };
  }

  /* ---------------------------------------------------------------------
     ПАРАПЛАН: крыло-дуга (ячейки пастели, цвет вершин) + стропы к кистям
     --------------------------------------------------------------------- */
  // крыло в осях корня героини (+y вверх, +z — вперёд модели): дуга радиуса Rc, размах ±A рад, хорда C; низ дуги — y 0
  function wingGeo(T) {
    const Rc = 2.0, A = 0.92, C0 = 1.05, NC = 9, U = [0, 0.06, 0.18, 0.36, 0.58, 0.8, 1];
    const PAL = ['#D9CBF2', '#BFDDF6', '#BDEBD6', '#FFF1AE', '#F8BACB', '#FFF1AE', '#BDEBD6', '#BFDDF6', '#D9CBF2'];
    const hexRGB = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
    const chord = a => C0 * (0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - (a / A) * (a / A))));
    const thick = u => Math.sin(PI * Math.pow(u, 0.55));
    const pos = [], colr = [], ind = [], tmp = [0, 0, 0];
    const pt = (a, u, up) => {
      const c = chord(a), yU = up ? c * 0.12 * thick(u) : -c * 0.03 * thick(u), sa = Math.sin(a), ca = Math.cos(a);
      tmp[0] = Rc * sa + sa * yU; tmp[1] = Rc * ca - Rc + ca * yU; tmp[2] = c * (0.4 - u) - 0.1 * (1 - ca) * 2; return tmp;
    };
    const gold = hexRGB('#E8C770');
    for (let ci = 0; ci < NC; ci++) {
      const a0 = -A + 2 * A * ci / NC, a1 = a0 + 2 * A / NC, base = hexRGB(PAL[ci]);
      for (let sd = 0; sd < 2; sd++) {
        const v0 = pos.length / 3;
        for (let j = 0; j < 3; j++) for (let ui = 0; ui < U.length; ui++) {
          const a = lerp(a0, a1, j / 2), p = pt(a, U[ui], sd === 0); pos.push(p[0], p[1], p[2]);
          // по краю ячейки — шов темнее; у передней кромки сверху — золотая кайма (узор крыла — как кант кубачинской шкатулки)
          const seam = j !== 1 ? 0.86 : 1, rim = sd === 0 && ui === 1 ? 1 : 0;
          let r = lerp(base[0] * seam, gold[0], rim * 0.75), g = lerp(base[1] * seam, gold[1], rim * 0.75), b = lerp(base[2] * seam, gold[2], rim * 0.75);
          if (sd) { r = r * 0.78 + 0.05; g = g * 0.78 + 0.04; b = b * 0.78 + 0.08; }
          colr.push(r, g, b);
        }
        const nu = U.length;
        for (let j = 0; j < 2; j++) for (let ui = 0; ui < nu - 1; ui++) {
          const a = v0 + j * nu + ui, b = a + 1, c = a + nu, d = c + 1;
          if (sd === 0) ind.push(a, c, b, b, c, d); else ind.push(a, b, c, b, d, c);
        }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(colr, 3));
    geo.setIndex(ind); geo.computeVertexNormals(); geo.computeBoundingSphere();
    // точки строп снизу: 3 по размаху с каждой стороны (на передней и задней трети хорды)
    const att = [];
    [1, -1].forEach(sg => [0.2, 0.55, 0.88].forEach(f => [0.15, 0.6].forEach(u => { const p = pt(sg * A * f, u, false); att.push([sg, p[0], p[1], p[2]]); })));
    return { geo, att };
  }
  function makeWing(T, own) {
    const W = wingGeo(T); own.push(W.geo);
    const grad = (() => { const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]); const t = new T.DataTexture(d, 3, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; own.push(t); return t; })();
    const mat = new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad, side: T.DoubleSide }); own.push(mat);
    const g = new T.Group(); g.name = 'runner:wing'; g.visible = false;
    const wing = new T.Mesh(W.geo, mat); wing.frustumCulled = false; g.add(wing);
    const N = W.att.length, lp = new Float32Array(N * 6);
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(lp, 3)); own.push(lg);
    const lm = new T.LineBasicMaterial({ color: 0x6E5E78, transparent: true, opacity: 0.8 }); own.push(lm);
    const lines = new T.LineSegments(lg, lm); lines.frustumCulled = false; g.add(lines);
    return { group: g, wing, lines, lp, att: W.att, lg };
  }

  /* ---------------------------------------------------------------------
     ГЕРОИНЯ
     --------------------------------------------------------------------- */
  function makeHero(T, ctx, scene, own, shadow, pal) {
    const kazApi = ctx.kazApi || V.kaz || null, quality = ctx.quality === 'high' ? 'high' : 'low';
    let H = ctx.hero && ctx.hero.root ? ctx.hero : null;
    let A = H ? (ctx.anim || (H.rig && H.rig.anim) || null) : null;
    let keep = null, kazOwn = false, kind = 'doll', doll = null, ownLoad = null, disposed = false;
    const holder = new T.Group(); holder.name = 'runner:hero';   // корень для ядра (если героиня ещё грузится — в нём кукла)
    let root = holder, body = null;

    // --- кукла (нет модели): капсула-пальто, голова, белый каз; та же анимация body (подпрыгивает, наклоны)
    function makeDoll() {
      const g = new T.Group(), b = new T.Group(); g.add(b);
      const mat = c => { const m = new T.MeshLambertMaterial({ color: c }); own.push(m); return m; };
      const geo = x => { own.push(x); return x; };
      const coat = new T.Mesh(geo(new T.CapsuleGeometry(0.24, 0.7, 4, 10)), mat('#C2405B')); coat.position.y = 0.86; b.add(coat);
      const head = new T.Mesh(geo(new T.SphereGeometry(0.2, 14, 10)), mat('#F7DCC8')); head.position.y = 1.46; b.add(head);
      const kaz = new T.Mesh(geo(new T.SphereGeometry(0.235, 14, 10, 0, TAU, 0, PI * 0.64)), mat('#FFFDF8')); kaz.position.y = 1.49; b.add(kaz);
      const tail = new T.Mesh(geo(new T.CylinderGeometry(0.16, 0.24, 0.6, 10, 1, true)), mat('#FFFDF8')); tail.position.set(0, 1.12, -0.1); b.add(tail);
      const legG = geo(new T.CapsuleGeometry(0.07, 0.36, 3, 8)), legM = mat('#3A2E3F');
      const legs = [-1, 1].map(s => { const pv = new T.Group(); pv.position.set(0.09 * s, 0.5, 0); const l = new T.Mesh(legG, legM); l.position.y = -0.24; pv.add(l); b.add(pv); return pv; });
      return { root: g, body: b, legs };
    }
    function adopt(h) {
      H = h; A = ctx.anim && h === ctx.hero ? ctx.anim : (h.rig && h.rig.anim) || null;
      kind = h.rig && A ? 'rig' : h.statue ? 'statue' : 'doll';
      keep = { parent: h.root.parent, p: h.root.position.clone(), r: h.root.rotation.clone(), s: h.root.scale.clone(), vis: h.root.visible,
        body: h.body ? { p: h.body.position.clone(), r: h.body.rotation.clone(), s: h.body.scale.clone() } : null };
      root = h.root; body = h.body || null;
      // q=low: контур героини (вывернутая оболочка — те же 28 тыс. треугольников, +1 вызов) на время забега прячем: с камеры
      // забега (≈ 6,7 м) он тоньше пикселя, а бюджет кадра телефона — 150 тыс. (улица до 92 тыс. + героиня); на выходе — как был
      const ol = h.rig ? h.rig.outline : h.statue ? h.statue.outline : null;
      keep.ol = ol || null; keep.olVis = ol ? ol.visible : false;
      if (ol && quality === 'low') ol.visible = false;
      h.root.position.set(0, 0, 0); h.root.rotation.set(0, PI, 0); h.root.scale.set(1, 1, 1); h.root.visible = true;
      scene.add(h.root);
      // каз — та же примерка, что в селе (VILLAGE.kaz.wear); уже надет (героиня приехала из села в казе) — не трогаем и не снимаем.
      // Разворачивается сверху вниз ~0,9 с — прямо на заставке
      try { if (kazApi && kazApi.wear && (h.rig || h.statue) && !(kazApi.isWorn && kazApi.isWorn())) { kazApi.wear(h, A, { instant: false, quality }); kazOwn = true; } } catch (e) { console.warn('runner actors: kaz', e); kazOwn = false; }
      if (A && A.bones) B = A.bones;
    }
    let B = null;
    if (H) adopt(H);
    else {
      doll = makeDoll(); holder.add(doll.root); body = doll.body; scene.add(holder);
      // своя героиня (как на стенде village.html), если хост не дал: грузится, пока на экране кукла
      if (ctx.loadHero !== false && window.HERO3D && HERO3D.load && window.WORLD && WORLD.createKit && WORLD.makeActors && T.GLTFLoader) {
        ownLoad = { kit: null };
        HERO3D.load().then(H3 => {
          if (disposed || !H3) return;
          let h = null;
          try {
            const kitW = WORLD.createKit({ rim: ['#FFE8D0', 0.22] }); ownLoad.kit = kitW;
            const actW = WORLD.makeActors(kitW); h = actW.buildHeroRig(null, H3) || actW.buildHeroGLB(null, H3);
            if (h && window.HeroOutfits && HeroOutfits.wear) {
              // образ — тот, что уже на общей сетке (не перекрашиваем общую геометрию другим образом)
              const look = (HeroOutfits.current && HeroOutfits.current(H3)) || (window.HeroLooks ? HeroLooks.DEFAULT : null);
              if (HeroOutfits.setQuality) HeroOutfits.setQuality(quality);
              HeroOutfits.wear(H3, h, { look });
            }
          } catch (e) { console.warn('runner actors: own hero', e); h = null; }
          if (!h || disposed) return;
          const pos = holder.position.clone(), rot = holder.rotation.y;
          holder.remove(doll.root); scene.add(h.root); h.root.position.copy(pos); h.root.rotation.y = rot;
          ownLoad.hero = h; adopt(h); keep.parent = null; heroApi.root = h.root;
        }).catch(() => {});
      }
    }

    // --- позы: состояние
    const st = { pose: 'idle', k: 0, t: 0, jumpN: 0, style: 0, air: false, landT: 9, wave: 5 + Math.random() * 3, waveT: -1, prevPose: 'idle', spin: 0, turn: 0, glideT: 0 };
    const W = { jump: 0, slide: 0, stumble: 0, caught: 0, glide: 0, land: 0, idle: 1 };
    const AI = { speed: 0, idle: true, turnRate: 0, sitting: false, celebrate: false, waving: false };
    const OS = { sport: true, fly: false };
    // накопители поз (градусы) и веса по костям
    const ACC = {}, WT = {};
    OVB.forEach(n => { ACC[n] = [0, 0, 0]; WT[n] = 0; });
    const ov = (n, x, y, z, w) => { if (w <= 1e-4) return; const a = ACC[n]; a[0] += x * w; a[1] += y * w; a[2] += z * w; WT[n] += w; };
    const qT = new T.Quaternion(), eT = new T.Euler(), v1 = new T.Vector3(), v2 = new T.Vector3();
    const wingObj = makeWing(T, own); root.add(wingObj.group);
    let wingK = 0;

    function set(p, k) {
      if (POSES.indexOf(p) < 0) return;
      st.prevPose = st.pose; st.pose = p; st.k = +k || 0; st.t = 0;
      if (p === 'jump') { st.jumpN++; st.style = [1, 0, 1, 2][(st.jumpN - 1) % 4]; st.spin = 0; }
      if (p === 'glide') st.glideT = 0;
      if (p === 'caught') st.turn = 0;
    }

    // поза «бега» для HeroAnim: спринт по скорости ядра (9…20 м/с), но каденс не до мельтешения
    const runAnimSpeed = v => clamp(v * 0.62, 5.6, 7.6);

    function update(dt, s) {
      dt = clamp(+dt || 0, 0, 0.1);
      st.t += dt;
      const p = st.pose, run = s.mode === 'run' || s.mode === 'start';
      const air = !!s.air;
      if (st.air && !air && p !== 'glide') st.landT = 0;   // приземлилась — «пружинка»
      st.air = air; st.landT += dt;
      // веса поз (быстро входят, мягко уходят)
      W.jump = damp(W.jump, p === 'jump' && air ? 1 : 0, air ? 22 : 30, dt);
      W.slide = clamp(+s.slide || 0, 0, 1);
      W.stumble = p === 'stumble' ? bell(st.t / Math.max(0.3, st.k || 0.55)) : damp(W.stumble, 0, 20, dt);
      W.caught = damp(W.caught, p === 'caught' ? 1 : 0, 8, dt);
      W.glide = damp(W.glide, p === 'glide' || s.glide ? 1 : 0, 7, dt);
      W.land = st.landT < 0.2 ? bell(st.landT / 0.2) * (1 - W.slide) : 0;
      W.idle = damp(W.idle, p === 'idle' ? 1 : 0, 6, dt);

      // --- HeroAnim: бег, стойка, «помахать» на заставке
      const moving = run && p !== 'caught' && s.speed > 0.5;
      AI.speed = moving ? runAnimSpeed(s.speed) * (1 - 0.85 * W.glide) : 0;
      AI.idle = p === 'idle'; AI.sitting = false;
      AI.turnRate = moving ? clamp(-(+s.lat || 0) * 0.45, -6, 6) : 0;
      // заставка: раз в 6–9 с машет (и пальтар выглядывает из-за плеча)
      if (p === 'idle') { st.wave -= dt; if (st.wave <= 0 && st.waveT < 0) { st.waveT = 0; st.wave = 6 + Math.random() * 3; } }
      if (st.waveT >= 0) { st.waveT += dt; if (st.waveT > 1.8 || p !== 'idle') st.waveT = -1; }
      AI.waving = st.waveT >= 0;
      if (A) { try { A.update(dt, AI); } catch (e) { /* анимация не главное */ } }
      if (A && B) poseBones(dt, s);
      // --- body: наклоны, крен в смене полосы, «пружинка», подъём на подкате (кукла и статуэтка — только это)
      if (body) {
        const lat = clamp((+s.lat || 0) * 0.032, -0.2, 0.2) * (moving ? 1 : 0) * (1 - W.slide);
        body.rotation.z = damp(body.rotation.z, lat + (W.glide > 0.01 ? Math.sin(st.t * 1.3) * 0.05 * W.glide : 0) + 0.16 * W.slide, 12, dt);
        let rx = (moving ? 0.06 : 0) * (1 - W.glide) + 0.12 * W.stumble * Math.sin(clamp(st.t / Math.max(0.3, st.k || 0.55), 0, 1) * PI * 2.2);
        if (W.glide > 0.01) rx += Math.sin(st.t * 0.9) * 0.04 * W.glide;
        body.rotation.x = rx;
        // поворот в прыжке «с поворотом» и полоборота к пальтару, когда поймана
        let ry = 0;
        if (p === 'jump' && st.style === 2) { st.spin = TAU * sst(0.08, 0.82, st.t / Math.max(0.3, st.k)); ry = st.spin * W.jump; }
        if (W.caught > 0.01 && pal && pal.pos) {
          pal.pos(v1); v1.sub(root.position); const ry0 = root.rotation.y, lx = v1.x * Math.cos(ry0) - v1.z * Math.sin(ry0), lz = v1.x * Math.sin(ry0) + v1.z * Math.cos(ry0);
          let want = clamp(angW(Math.atan2(lx, lz)) * 0.55, -0.75, 0.75);   // он сзади — оглянулась через плечо
          // поставил на землю — поворачивается к камере (смеётся «в кадр»): при камере сбоку или сзади (лобовой в прилавок)
          // иначе весь конец забега была видна только её спина
          if (p === 'caught' && s.camX !== undefined) { const cx = s.camX - root.position.x, cz = s.camZ - root.position.z, cl = cx * Math.cos(ry0) - cz * Math.sin(ry0), cz2 = cx * Math.sin(ry0) + cz * Math.cos(ry0);
            // угол к камере — ближайший к текущему повороту (камера прямо сзади: ±π по очереди гасили друг друга)
            const a = Math.atan2(cl, cz2), ac = st.turn + angW(a - st.turn);
            want = lerp(want, ac, sst(0.95, 1.45, st.t)); }
          st.turn = damp(st.turn, p === 'caught' ? want : 0, 5, dt); ry += st.turn * W.caught;
        }
        // «поднял — покружил»: пальтар сзади поднимает её за талию (+0,3 м) и кружит на 360° (0,15…0,85 с) — ровно полный
        // оборот, по позе (не по весу): после поимки поворот не «раскручивается» обратно
        if (p === 'caught') ry += TAU * sst(0.15, 0.85, st.t);
        body.rotation.y = ry;
        let by = -0.07 * W.land;
        if (W.caught > 0.01 && p === 'caught') { const u = st.t; by += 0.3 * sst(0.06, 0.28, u) * (1 - sst(0.72, 0.95, u)) + 0.04 * Math.abs(Math.sin(u * 7)) * sst(1.8, 2.1, u); }
        if (!A) by += -0.55 * W.slide + (moving ? Math.abs(Math.sin(st.t * 11)) * 0.06 : 0);
        body.position.y = by;
        body.position.z = !A ? 0.2 * W.slide : 0;
        if (!A && kind !== 'rig') {
          if (doll) { const sw = moving ? Math.sin(st.t * 11) * 0.8 : 0; doll.legs[0].rotation.x = sw - 1.2 * W.slide; doll.legs[1].rotation.x = -sw - 1.2 * W.slide; }
          if (H && H.statue && H.statue.U && H.statue.U.hdSwing) H.statue.U.hdSwing.value = moving ? Math.sin(st.t * 11) * 0.35 : 0;
          if (!A) body.rotation.x += -0.9 * W.slide + 0.35 * W.jump;
        }
      }
      // каз (своя примерка или села) и образ: после костей
      if (kazApi && kazApi.isWorn && kazApi.isWorn() && kazApi.update) { try { kazApi.update(dt, AI); } catch (e) { /* каз не главное */ } }
      OS.fly = W.glide > 0.5;
      if (H && H._outfit && window.HeroOutfits && HeroOutfits.update) { try { HeroOutfits.update(H, dt, OS); } catch (e) { /* без образа */ } }
      // крыло параплана
      wingUpdate(dt, s);
      // тень: на опоре под ней (земля, крыша, верх сена); высоко — меньше и слабее
      const hy = Math.max(0, (+s.y || 0) - (+s.ground || 0)), fall = clamp(1 - hy / 7, 0.3, 1);
      shadow.set(0, root.position.x, +s.ground || 0, root.position.z + 0.06, 0.95 * fall * (1 + 0.25 * W.slide), (0.62 + 0.5 * W.slide) * fall, 0.75 * fall, root.visible);
    }

    // --- кости: цели поз → slerp на вес
    function poseBones(dt, s) {
      for (let i = 0; i < OVB.length; i++) { const a = ACC[OVB[i]]; a[0] = a[1] = a[2] = 0; WT[OVB[i]] = 0; }
      const t = st.t;
      // прыжок
      if (W.jump > 0.002) {
        const w = W.jump, u = clamp(t / Math.max(0.3, st.k || 0.7), 0, 1), up = (+s.vy || 0) > 0 ? 1 : 0;
        const tk = sst(0.02, 0.28, u) * (1 - sst(0.72, 0.96, u)), reach = sst(0.7, 0.95, u);
        if (st.style === 1) {
          // «шпагат»: передняя нога прямая, задняя согнута назад, руки в стороны, взгляд вверх
          ov('thigh_L', lerp(-20, -78, tk) + 50 * reach * 0, 0, 4, w); ov('shin_L', lerp(25, 8, tk), 0, 0, w); ov('foot_L', 10, 0, 0, w);
          ov('thigh_R', lerp(-10, 38, tk) - 40 * reach, 0, -4, w); ov('shin_R', lerp(40, 78, tk) - 30 * reach, 0, 0, w); ov('foot_R', 20, 0, 0, w);
          ov('upperarm_L', -25, 0, 78 * tk + 20, w); ov('upperarm_R', -25, 0, -78 * tk - 20, w); ov('forearm_L', -18, 0, 0, w); ov('forearm_R', -18, 0, 0, w);
          ov('spine', -6 * tk, 0, 0, w); ov('head', -12 * tk, 0, 0, w);
        } else {
          // группировка: колени к груди, руки вверх «ура» (с поворотом — то же, плюс поворот body)
          ov('thigh_L', lerp(-25, -112, tk) + 60 * reach, 0, 8, w); ov('shin_L', lerp(30, 136, tk) - 80 * reach, 0, 0, w); ov('foot_L', 22 * tk, 0, 0, w);
          ov('thigh_R', lerp(-12, -96, tk) + 50 * reach, 0, -8, w); ov('shin_R', lerp(36, 128, tk) - 70 * reach, 0, 0, w); ov('foot_R', 18 * tk, 0, 0, w);
          const ar = lerp(0.55, 1, up);
          ov('upperarm_L', -150 * tk * ar - 30 * (1 - tk), 0, 30 + 10 * tk, w); ov('upperarm_R', -150 * tk * ar - 30 * (1 - tk), 0, -30 - 10 * tk, w);
          ov('forearm_L', -30, 0, 0, w); ov('forearm_R', -30, 0, 0, w);
          ov('spine', 20 * tk, 0, 0, w); ov('chest', 8 * tk, 0, 0, w); ov('head', -16 * tk, 0, 0, w);
        }
      }
      // приземление: присела, руки вперёд
      if (W.land > 0.002) {
        const w = W.land;
        ov('thigh_L', -40, 0, 3, w); ov('shin_L', 70, 0, 0, w); ov('thigh_R', -34, 0, -3, w); ov('shin_R', 62, 0, 0, w); ov('foot_L', -28, 0, 0, w); ov('foot_R', -26, 0, 0, w);
        ov('upperarm_L', -40, 0, 30, w * 0.7); ov('upperarm_R', -40, 0, -30, w * 0.7);
      }
      // подкат на боку: таз почти у земли, левая нога вперёд прямая, правая подогнута, корпус откинут, левая рука вверх,
      // правая — к мостовой
      if (W.slide > 0.002) {
        const w = W.slide;
        ov('hips', -30, 8, 0, w); ov('spine', -7, 0, -6, w); ov('chest', -4, 0, -4, w); ov('neck', 10, 0, 0, w); ov('head', 22, -8, 0, w);
        ov('thigh_L', -52, 0, 6, w); ov('shin_L', 10, 0, 0, w); ov('foot_L', 22, 0, 0, w);
        ov('thigh_R', -14, 0, -18, w); ov('shin_R', 104, 0, 0, w); ov('foot_R', 10, 0, 0, w);
        ov('upperarm_L', -150, 0, 24, w); ov('forearm_L', -24, 0, 0, w); ov('hand_L', 0, 0, 10, w);
        ov('upperarm_R', 14, 0, -66, w); ov('forearm_R', -16, 0, 0, w); ov('hand_R', 30, 0, 0, w);
      }
      // спотыкание: корпус вперёд, руки «мельницей», нога назад
      if (W.stumble > 0.002) {
        const w = W.stumble, u = clamp(t / Math.max(0.3, st.k || 0.55), 0, 1), wm = Math.sin(u * TAU * 1.6);
        ov('spine', 24, 0, 0, w); ov('chest', 10, 0, 0, w); ov('head', -22, 0, 8 * wm, w);
        ov('upperarm_L', -110 + 60 * wm, 0, 48, w); ov('upperarm_R', -110 - 60 * wm, 0, -48, w); ov('forearm_L', -20, 0, 0, w); ov('forearm_R', -20, 0, 0, w);
        ov('thigh_R', 28, 0, -4, w); ov('shin_R', 84, 0, 0, w); ov('thigh_L', -30, 0, 4, w); ov('shin_L', 40, 0, 0, w);
      }
      // поймана (шуточно): «ой!» — ладошки к щекам, потом смеётся и разводит руками
      if (W.caught > 0.002) {
        // кружится — руки в стороны, ноги назад («и-и-ух!»); поставил — «ой!» ладошки к щекам; потом смеётся, разводит руками
        const kw = sst(0.05, 0.25, t) * (1 - sst(0.75, 0.95, t));
        if (kw > 0.002) { const w2 = W.caught * kw; ov('upperarm_L', -28, 0, 72, w2); ov('upperarm_R', -28, 0, -72, w2); ov('forearm_L', -22, 0, 0, w2); ov('forearm_R', -22, 0, 0, w2);
          ov('thigh_L', 8, 0, 4, w2); ov('shin_L', 64, 0, 0, w2); ov('thigh_R', 14, 0, -4, w2); ov('shin_R', 78, 0, 0, w2); ov('head', -14, 0, 0, w2); ov('spine', -6, 0, 0, w2); }
        const w = W.caught * (1 - kw), k1 = sst(0.85, 1.1, t) * (1 - sst(1.75, 2.1, t)), k2 = sst(1.8, 2.15, t), sw = Math.sin(t * 6.5);
        ov('upperarm_L', -62 * k1 - 24 * k2, 0, 12 * k1 + 58 * k2, w); ov('upperarm_R', -62 * k1 - 24 * k2, 0, -12 * k1 - 58 * k2, w);
        ov('forearm_L', -128 * k1 - 74 * k2, 0, 0, w); ov('forearm_R', -128 * k1 - 74 * k2, 0, 0, w);
        ov('hand_L', 0, -40 * k2, 0, w); ov('hand_R', 0, 40 * k2, 0, w);
        ov('head', -6 * k1 + (6 + 4 * sw) * k2, 0, (10 * Math.sin(t * 3.2)) * k2, w); ov('spine', 6 * k1 - 4 * k2, 0, 3 * sw * k2, w);
        ov('thigh_L', -6 * k1, 0, 3, w); ov('thigh_R', 0, 0, -3, w);
      }
      // вис под крылом: ноги вперёд и чуть болтаются, руки вверх к клевантам
      if (W.glide > 0.002) {
        const w = W.glide, sw = Math.sin(st.t * 1.6);
        ov('hips', -10, 0, 0, w); ov('thigh_L', -58 + 8 * sw, 0, 5, w); ov('shin_L', 62 - 10 * sw, 0, 0, w); ov('thigh_R', -54 - 8 * sw, 0, -5, w); ov('shin_R', 58 + 10 * sw, 0, 0, w);
        ov('foot_L', 20, 0, 0, w); ov('foot_R', 20, 0, 0, w);
        ov('upperarm_L', -166, 0, 16, w); ov('upperarm_R', -166, 0, -16, w); ov('forearm_L', -14, 0, 0, w); ov('forearm_R', -14, 0, 0, w);
        ov('spine', -4, 0, 0, w); ov('head', -8, 0, 4 * Math.sin(st.t * 0.7), w);
      }
      for (let i = 0; i < OVB.length; i++) {
        const n = OVB[i], wsum = WT[n]; if (wsum <= 1e-4) continue;
        const a = ACC[n], bn = B[n]; if (!bn) continue;
        eT.set(a[0] / wsum * D, a[1] / wsum * D, a[2] / wsum * D); qT.setFromEuler(eT);
        bn.quaternion.slerp(qT, Math.min(1, wsum));
      }
      // бег в казе: накидка привязана к корпусу (не к рукам), и локоть, уходя назад на взмахе, протыкал её сзади — коричневое
      // «пятно» пальто на белом казе ровно в центре кадра. На бегу (без других поз) плечо не заходит за вертикаль назад и не
      // отведено в сторону (отведение выдавливало плечо рукава сквозь накидку ещё сильнее — проверено кадрами сзади, 12 фаз
      // шага: при 25° пятно больше, при 0° — без пятен); взмах вперёд — как был
      const wa = clamp(1 - (W.jump + W.slide + W.stumble + W.caught + W.glide) * 3, 0, 1);
      if (wa > 0.01) { armOut(B.upperarm_L, 1, wa); armOut(B.upperarm_R, -1, wa); }
      // и бедро: на махе назад больше 10° (в спринте до 32°) его верх выходил сквозь заднее полотнище юбки — светлый «язычок»
      // на тёмной юбке в 4 фазах из 12 (кадры сзади: 20° — меньше, 10° и 5° — чисто); мах вперёд не трогаем
      if (wa > 0.01) { legBack(B.thigh_L, wa); legBack(B.thigh_R, wa); }
      // таз: подкат — почти у земли; вис и прыжок — стопы не тянутся к земле (IK стоя опустил бы таз)
      const hp = B.hips.position;
      if (W.slide > 0.002) { hp.y = lerp(hp.y, 0.3, W.slide); hp.z = lerp(hp.z, 0.05, W.slide); }
      if (W.glide > 0.002) hp.y = lerp(hp.y, 0.86, W.glide);
      if (W.jump > 0.002) hp.y = lerp(hp.y, 0.86, W.jump * 0.8);
    }

    const eA = new T.Euler(0, 0, 0, 'XYZ');
    function armOut(bn, sg, w) {
      if (!bn) return;
      eA.setFromQuaternion(bn.quaternion, 'XYZ');
      const x = Math.min(eA.x, -2 * D), z = sg * 1 * D;
      eA.x = lerp(eA.x, x, w); eA.z = lerp(eA.z, z, w);
      bn.quaternion.setFromEuler(eA);
    }
    function legBack(bn, w) {
      if (!bn) return;
      eA.setFromQuaternion(bn.quaternion, 'XYZ');
      eA.x = lerp(eA.x, Math.min(eA.x, 10 * D), w);
      bn.quaternion.setFromEuler(eA);
    }
    // --- крыло: раскрывается над головой (0,45 с), в полёте качается, на посадке складывается (0,35 с)
    const hL = new T.Vector3(), hR = new T.Vector3(), inv = new T.Matrix4();
    function wingUpdate(dt, s) {
      const on = st.pose === 'glide' || !!s.glide;
      wingK = clamp(wingK + dt / (on ? 0.45 : 0.35) * (on ? 1 : -1), 0, 1);
      const g = wingObj.group;
      g.visible = wingK > 0.001;
      if (!g.visible) return;
      if (g.parent !== root) root.add(g);
      const e = on ? 1 - Math.pow(1 - wingK, 3) * Math.cos(wingK * 5) * 0.3 : wingK;
      g.position.set(0, 3.6 + 0.08 * Math.sin(st.t * 1.3), 0.25);
      g.scale.set(Math.max(0.05, e), Math.max(0.05, Math.min(1.1, e)), Math.max(0.05, e));
      g.rotation.set(-0.06 + 0.03 * Math.sin(st.t * 0.9), 0, -(body ? body.rotation.z : 0) * 0.6);
      // стропы: от кистей (кости hand_L/R → оси корня) к низу крыла
      if (B && B.hand_L && B.hand_R) {
        root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
        B.hand_L.getWorldPosition(hL).applyMatrix4(inv); B.hand_R.getWorldPosition(hR).applyMatrix4(inv);
      } else { hL.set(0.25, 1.9, 0.05); hR.set(-0.25, 1.9, 0.05); }
      const lp = wingObj.lp, at = wingObj.att, sc = g.scale, gp = g.position;
      for (let i = 0; i < at.length; i++) {
        const a = at[i], h = a[0] > 0 ? hL : hR, k = i * 6;
        lp[k] = (h.x - gp.x) / sc.x; lp[k + 1] = (h.y - gp.y) / sc.y; lp[k + 2] = (h.z - gp.z) / sc.z;
        lp[k + 3] = a[1]; lp[k + 4] = a[2]; lp[k + 5] = a[3];
      }
      wingObj.lg.attributes.position.needsUpdate = true;
      wingObj.lines.rotation.set(0, 0, 0);
    }

    const heroApi = { root, set, update };
    return {
      api: heroApi,
      kind: () => kind,
      kazOwn: () => kazOwn,
      glide: () => wingK,
      dispose() {
        disposed = true;
        if (wingObj.group.parent) wingObj.group.parent.remove(wingObj.group);
        if (H) {
          if (kazOwn && kazApi && kazApi.remove) { try { kazApi.remove(); } catch (e) { /* ok */ } }
          if (H.root.parent) H.root.parent.remove(H.root);
          if (keep.parent) keep.parent.add(H.root);
          H.root.position.copy(keep.p); H.root.rotation.copy(keep.r); H.root.scale.copy(keep.s); H.root.visible = keep.vis;
          if (H.body && keep.body) { H.body.position.copy(keep.body.p); H.body.rotation.copy(keep.body.r); H.body.scale.copy(keep.body.s); }
          if (keep.ol) keep.ol.visible = keep.olVis;
          if (H.statue && H.statue.U && H.statue.U.hdSwing) H.statue.U.hdSwing.value = 0;
          if (A && A.reset) { try { A.reset(); } catch (e) { /* ok */ } }
          if (H.rig) H.rig.prev = null;
        }
        if (holder.parent) holder.parent.remove(holder);
        // своя героиня (хост не дал свою): у каждого скелета — своя текстура костей (16×16 float); набор графики эту текстуру
        // не освобождает, и без skeleton.dispose() каждый вход оставлял в GPU ещё одну текстуру. Героиню хоста не трогаем
        if (ownLoad && ownLoad.hero && ownLoad.hero.root) { try { ownLoad.hero.root.traverse(o => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); }); } catch (e) { /* ok */ } }
        if (ownLoad && ownLoad.kit) { try { ownLoad.kit.dispose(); } catch (e) { /* ok */ } }
      },
    };
  }

  /* ---------------------------------------------------------------------
     ПАЛЬТАР
     --------------------------------------------------------------------- */
  // запасной ряженый из коробок (если нет js/village/wedding.js): тёмный войлок, кольчуга, маска; руки и ноги на шарнирах
  function boxPaltar(T, own) {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    const mat = c => { const m = new T.MeshLambertMaterial({ color: c }); own.push(m); return m; };
    const box = new T.BoxGeometry(1, 1, 1), sph = new T.SphereGeometry(0.5, 12, 9); own.push(box, sph);
    const mk = (geo, m, x, y, z, sx, sy, sz, par) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); (par || b).add(o); return o; };
    const mMail = mat('#8E928E'), mFelt = mat('#2F251E'), mGold = mat('#E8B54A'), mShirt = mat('#E6DED0');
    mk(box, mMail, 0, 1.3, 0, 0.6, 0.8, 0.36); mk(box, mFelt, 0, 0.95, 0, 0.62, 0.12, 0.38);
    mk(sph, mFelt, 0, 1.92, 0.02, 0.38, 0.46, 0.38); mk(box, mGold, 0, 1.92, 0.19, 0.22, 0.05, 0.02); mk(box, mGold, 0, 1.6, 0.2, 0.2, 0.3, 0.02);
    const joint = (x, y) => { const p = new T.Group(); p.position.set(x, y, 0); b.add(p); return p; };
    const armL = joint(0.36, 1.62), armR = joint(-0.36, 1.62), legL = joint(0.12, 0.92), legR = joint(-0.12, 0.92);
    [armL, armR].forEach(a => mk(box, mMail, 0, -0.32, 0, 0.14, 0.64, 0.16, a));
    [legL, legR].forEach(l => { mk(box, mShirt, 0, -0.26, 0, 0.17, 0.52, 0.19, l); mk(box, mFelt, 0, -0.72, 0.04, 0.17, 0.4, 0.24, l); });
    return { root: g, body: b, armL, armR, legL, legR };
  }

  function makePaltar(T, ctx, scene, own, shadow) {
    const quality = ctx.quality === 'high' ? 'high' : 'low';
    const outer = new T.Group(); outer.name = 'runner:paltar';
    // inner — сам ряженый внутри корня ядра: поймал — подходит и встаёт РЯДОМ с ней, лицом к ней (сзади он закрыл бы героиню от
    // камеры поимки, если та встала за спиной)
    const inner = new T.Group(); outer.add(inner);
    let wh = null, rig = null, bx = null, hasWhip = false, heroRoot = null;
    if (V.wedding && V.wedding.buildPaltar) {
      try {
        wh = V.wedding.buildPaltar({ THREE: T, variant: ctx.paltarVariant || 'D', quality, named: ctx.named, season: ctx.season });
        rig = wh && wh.rig; if (!rig) { if (wh) wh.dispose(); wh = null; }
      } catch (e) { console.warn('runner actors: paltar', e); wh = null; rig = null; }
    }
    if (rig) { inner.add(wh.group); hasWhip = !!(rig.a.pv && rig.a.pv.whip); }
    else { bx = boxPaltar(T, own); inner.add(bx.root); }
    scene.add(outer);
    const st = { pose: 'idle', t: 0, ph: 0, jT: 9, cT: 9, peek: 0, speed: 0, wNear: 0, wRun: 0, wCatch: 0, wCheer: 0, wIdle: 1, side: 0, tx: 0, tz: 0, yaw: 0, wSelf: 0, it: 0 };
    // «селфи» (пасхалка заставки): телефон в левой руке — маленькая тёмная плитка на кости кисти, видна только в этой позе
    let phone = null;
    if (rig && rig.B && rig.B.handL) { const pg = new T.BoxGeometry(0.075, 0.14, 0.014), pm = new T.MeshBasicMaterial({ color: 0x2A2B33 }); own.push(pg, pm); phone = new T.Mesh(pg, pm); phone.position.set(0, -0.09, 0.03); phone.visible = false; rig.B.handL.add(phone); }
    const wp = new T.Vector3();
    // рабочие массивы для arm(): копируются внутрь q — можно переиспользовать (в кадре без new)
    const U1 = [0, 0, 0], F1 = [0, 0, 0], P1 = [-1, 0, 0], U2 = [0, 0, 0], F2 = [0, 0, 0], P2 = [0, 0, 1], SU = [0, 0, 0], SF = [0, 0, 0];
    const v3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
    // направление руки от a к b по дуге (как smix двора, но в готовый массив — без new): почти противоположные («вниз» →
    // «вверх») — через середину, сдвинутую вперёд, иначе прямая шла бы через «ноль» и рука перелетала за кадр
    function slerpU(o, ax, ay, az, bx, by, bz, k) {
      const d = clamp(ax * bx + ay * by + az * bz, -1, 1), th = Math.acos(d);
      if (th < 0.02) { o[0] = lerp(ax, bx, k); o[1] = lerp(ay, by, k); o[2] = lerp(az, bz, k); return o; }
      const sn = Math.sin(th), wa = Math.sin((1 - k) * th) / sn, wb = Math.sin(k * th) / sn;
      o[0] = ax * wa + bx * wb; o[1] = ay * wa + by * wb; o[2] = az * wa + bz * wb; return o;
    }
    function mixDir(o, a, b, k) {
      const la = Math.hypot(a[0], a[1], a[2]) || 1, lb = Math.hypot(b[0], b[1], b[2]) || 1;
      const ax = a[0] / la, ay = a[1] / la, az = a[2] / la, bx = b[0] / lb, by = b[1] / lb, bz = b[2] / lb;
      if (ax * bx + ay * by + az * bz > -0.55) return slerpU(o, ax, ay, az, bx, by, bz, k);
      let mx = ax + bx, my = ay + by, mz = az + bz + 0.6; const ml = Math.hypot(mx, my, mz) || 1; mx /= ml; my /= ml; mz /= ml;
      return k < 0.5 ? slerpU(o, ax, ay, az, mx, my, mz, k * 2) : slerpU(o, mx, my, mz, bx, by, bz, k * 2 - 1);
    }
    // рука стороны sd: смесь двух положений [up, fo, palm, curl, spread] (без new)
    function armBlend(q, sd, A1, A2, k) {
      rig.arm(q, sd, mixDir(SU, A1[0], A2[0], k), mixDir(SF, A1[1], A2[1], k), k < 0.5 ? A1[2] : A2[2], lerp(A1[3] || 0, A2[3] || 0, k), lerp(A1[4] || 0, A2[4] || 0, k));
    }
    const RUNA = [[0.18, -0.85, 0], [0.05, 0.25, 1], P1, 1, 0], REACH = [U1, F1, P2, 0.5, 1], WAG = [U2, F2, P2, 0.85, 0];
    const SELFIE = [[0.38, 0.62, 0.68], [-0.12, 0.6, 0.79], [0, 0, -1], 1, 0];   // рука с телефоном: вверх-вперёд, ладонь к себе
    const LU = [0, 0, 0], LF = [0, 0, 0], LIFTA = [LU, LF, P2, 0.7, 0];   // «поднял за талию»
    // щелчок плёткой (как номер «whip» во дворе, но короче и вверх-наружу: от героини): 0..0,2 — рука к поясу за плёткой,
    // 0,2..1,35 — замах за голову → бросок вверх-вбок → волна по косичке, 1,35..1,6 — плётку на пояс
    const CR = { T: 1.6, draw: 0.2, back: 0.25 }, LOW = [[0.45, -0.25, 0.4], [0.15, -0.5, 0.75], P1, 1, 0];
    const WIND_U = [0.35, 0.85, -0.45], WIND_F = [0.1, 0.5, -0.85], SNAP_U = [0.75, 0.62, 0.12], SNAP_F = [0.55, 0.82, 0.1];
    const LASH = [0, 0, 0, 0, 0], LASHZ = [0, 0, 0, 0, 0], CU = [0, 0, 0], CF = [0, 0, 0];
    function crackPose(q, t) {
      const R = rig;
      if (t < CR.draw) { armBlend(q, -1, RUNA, R.WDRAW, sst(0, CR.draw * 0.9, t)); q.whip = 'tuck'; return; }
      const tc = t - CR.draw, Tc = CR.T - CR.draw - CR.back;
      if (tc > Tc) { armBlend(q, -1, LOW, RUNA, sst(0, CR.back, tc - Tc)); q.whip = tc - Tc > CR.back * 0.5 ? 'tuck' : 'hand'; q.lash = null; return; }
      const u = tc / Tc, wind = sst(0, 0.35, u) * (1 - sst(0.36, 0.52, u)), snap = sst(0.34, 0.52, u), lw = sst(0.66, 0.95, u);
      // замах за голову → бросок вверх и наружу (вправо от пальтара: героиня впереди, плётка — в небо сбоку)
      mixDir(CU, R.WDRAW[0], WIND_U, wind); mixDir(CU, CU, SNAP_U, snap); mixDir(CU, CU, LOW[0], lw);
      mixDir(CF, R.WDRAW[1], WIND_F, wind); mixDir(CF, CF, SNAP_F, snap); mixDir(CF, CF, LOW[1], lw);
      R.arm(q, -1, CU, CF, P1, 1);
      q.twist += 0.25 * wind - 0.2 * snap; q.side -= 0.06 * snap;
      // волна: звено догоняет предыдущее через 0,035 с — петля бежит к кончику и там «щёлкает», после щелчка косичка провисает
      const ts = 0.5 * Tc;
      for (let i = 0; i < 5; i++) {
        const tau = u * Tc - 0.035 * i, k = sst(ts - 0.02, ts + 0.08, tau), loop = Math.sin(PI * clamp((tau - ts) / 0.14, 0, 1)), settle = tau > ts + 0.14 ? Math.exp(-(tau - ts - 0.14) * 5) : 1;
        let th = lerp(0.18, lerp(0.25, -0.05, k) - 0.55 * loop, settle);
        if (!i) th += lerp(-1.2 + 2.0 * wind, -1.1, snap);
        LASH[i] = th; LASHZ[i] = 0.08 + 0.04 * i * (1 - k);
      }
      q.lash = LASH; q.lashZ = LASHZ; q.whip = 'hand';
      q.hang = Math.max(sst(ts + 0.12, ts + 0.45, u * Tc), 1 - sst(0, 0.22, u));
    }

    function set(p) { if (PPOSES.indexOf(p) < 0) return; st.pose = p; st.t = 0; }
    function update(dt, s) {
      dt = clamp(+dt || 0, 0, 0.1);
      st.t += dt; st.jT += dt; st.cT += dt;
      const p = st.pose, spd = Math.max(0, +s.speed || 0);
      st.speed = damp(st.speed, spd, 6, dt);
      const running = (p === 'run' || p === 'near') && st.speed > 0.4;
      st.wRun = damp(st.wRun, running ? 1 : 0, 8, dt);
      st.wNear = damp(st.wNear, p === 'near' ? 1 : 0, 6, dt);
      st.wCatch = damp(st.wCatch, p === 'catch' ? 1 : 0, 9, dt);
      st.wCheer = damp(st.wCheer, p === 'cheer' ? 1 : 0, 6, dt);
      st.wIdle = damp(st.wIdle, p === 'idle' ? 1 : 0, 6, dt);
      st.wSelf = damp(st.wSelf, p === 'selfie' ? 1 : 0, 5, dt); st.it += dt;
      if (phone) { const on = st.wSelf > 0.5; if (phone.visible !== on) phone.visible = on; }
      // фаза бега — по скорости (шаг ≈ 2,5 м на два шага, каденс до ≈ 8 шагов/с)
      st.ph = (st.ph + dt * TAU * Math.min(st.speed, 12) / 2.6) % (TAU * 64);
      // поймал: к ней сбоку (в осях корня: она — впереди на gap и в стороне), лицом к ней; потом — обратно в корень
      const near = p === 'catch' || p === 'cheer';
      st.side = damp(st.side, near && heroRoot ? 1 : 0, near ? 3.2 : 6, dt);
      if (heroRoot && st.side > 0.001) {
        const ry = outer.rotation.y, vx = heroRoot.position.x - outer.position.x, vz = heroRoot.position.z - outer.position.z;
        const lx = vx * Math.cos(ry) - vz * Math.sin(ry), lz = vx * Math.sin(ry) + vz * Math.cos(ry);
        // за ней (0,75 м) и чуть вбок (0,45): спереди видно оба лица (он выше — голова над её плечом), сбоку они разнесены по
        // глубине и не загораживают друг друга; отсюда он и поднимает её за талию
        // смещение от героини в мире — от ядра (s.cdx, s.cdz: по выбору камеры поимки); в осях корня (повёрнут на π) — со знаком −
        if (p === 'catch' && st.t < 0.05) {
          const cdx = s.cdx !== undefined ? +s.cdx : (lx >= 0 ? 0.45 : -0.45), cdz = s.cdz !== undefined ? +s.cdz : 0.75, c = Math.cos(ry), sn = Math.sin(ry);
          st.tx = lx + cdx * c - cdz * sn; st.tz = lz + cdx * sn + cdz * c;
        }
        st.yaw = Math.atan2(lx - inner.position.x, lz - inner.position.z);
        inner.position.set(st.tx * st.side, 0, st.tz * st.side);
        // кружит: качается вместе с ней (±0,3 рад) пока она в воздухе
        const tw = p === 'catch' ? Math.sin(sst(0.15, 0.85, st.t) * TAU) * 0.3 * sst(0.05, 0.25, st.t) * (1 - sst(0.75, 0.95, st.t)) : 0;
        let yaw = st.yaw * Math.min(1, st.side * 1.4) + tw;
        if (st.wCheer > 0.01 && s.camX !== undefined) { const cx = s.camX - outer.position.x, cz = s.camZ - outer.position.z, cl = cx * Math.cos(ry) - cz * Math.sin(ry), cz2 = cx * Math.sin(ry) + cz * Math.cos(ry);
          yaw = lerp(yaw, yaw + angW(Math.atan2(cl - inner.position.x, cz2 - inner.position.z) - yaw) * 0.6, st.wCheer); }
        inner.rotation.y = yaw;
      } else { inner.position.set(0, 0, 0); inner.rotation.y = 0; }
      if (rig) poseRig(dt, s); else poseBox(dt, s);
      // тень под ним (опора — по его следу)
      inner.getWorldPosition(wp);
      const hy = Math.max(0, wp.y - (+s.pground || 0)), fall = clamp(1 - hy / 7, 0.3, 1);
      shadow.set(1, wp.x, +s.pground || 0, wp.z, 1.05 * fall, 0.72 * fall, 0.75 * fall, outer.visible);
    }
    function poseRig(dt, s) {
      const R = rig, a = R.a, q = R.reset(), t = st.t, ph = st.ph, sw = Math.sin(ph);
      R.tick(dt); a.vel = st.speed; a.gph = ph;
      // бег с подпрыгиванием: ноги размашисто, колени высоко, на каждом шаге — подскок; корпус вперёд, руки работают
      const kr = st.wRun;
      if (kr > 0.002) {
        R.leg(q, 1, -0.95 * sw * kr, (0.12 + 1.35 * Math.max(0, Math.sin(ph + 1.9))) * kr);
        R.leg(q, -1, 0.95 * sw * kr, (0.12 + 1.35 * Math.max(0, Math.sin(ph + 1.9 + PI))) * kr);
        R.plant(q);
        q.y += 0.1 * Math.abs(Math.sin(ph)) * kr;
        q.lean = 0.24 * kr; q.twist = sw * 0.14 * kr; q.hx = -0.18 * kr;
        const as = 0.65 * sw * kr;
        R.arm(q, 1, v3(U1, 0.18, -0.85, -as), v3(F1, 0.05, 0.25, 1), P1, 1);
        R.arm(q, -1, v3(U2, 0.18, -0.85, as), v3(F2, 0.05, 0.25, 1), P1, 1);
        // «почти догнал»: руки тянутся вперёд к ней, пальцы шевелятся
        if (st.wNear > 0.01) {
          const kn = st.wNear * kr;
          v3(U1, 0.22, 0.06 + 0.08 * Math.sin(t * 9), 0.95); v3(F1, 0.06, 0.22, 1); RUNA[0][2] = -as; REACH[3] = 0.3 + 0.3 * Math.sin(t * 13);
          armBlend(q, 1, RUNA, REACH, kn);
          U1[1] = 0.06 + 0.08 * Math.cos(t * 9); RUNA[0][2] = as; REACH[3] = 0.3 + 0.3 * Math.cos(t * 13);
          armBlend(q, -1, RUNA, REACH, kn);
          q.lean += 0.1 * kn; q.hx -= 0.05 * kn;
        }
        RUNA[0][2] = 0;
      }
      // заставка: выглядывает из-за плеча героини (наклон вбок, голова набок, «крадущиеся» руки), иногда прячется
      // (часы выглядывания — свои, st.it: «селфи» посреди цикла не дёргает наклон)
      if ((st.wIdle > 0.002 && st.pose === 'idle') || st.pose === 'selfie') {
        const cyc = (st.it % 5.2) / 5.2, peek = sst(0.05, 0.18, cyc) * (1 - sst(0.72, 0.86, cyc)) * (1 - st.wSelf), w = st.pose === 'selfie' ? 1 : st.wIdle;
        q.side = (0.22 * peek + 0.03 * Math.sin(t * 2.1)) * w; q.hz = 0.32 * peek * w; q.hy = 0.25 * peek * w; q.hx = 0.06 * w;
        R.setArm(q, 1, R.CREEP); R.setArm(q, -1, R.AP.hip);
        q.y = 0.03 * Math.abs(Math.sin(t * 3.4)) * w; R.crouch(q, 0.04 * w);
      }
      // «селфи»: левая рука с телефоном вверх и вперёд (ладонь к себе), правая — «класс», голова и корпус к ней (из «крадущихся» рук
      // заставки — по весу позы, без рывка в обе стороны)
      if (st.wSelf > 0.002 && (st.pose === 'selfie' || st.pose === 'idle')) {
        const k = st.wSelf;
        armBlend(q, 1, R.CREEP, SELFIE, k); armBlend(q, -1, R.AP.hip, R.AP.thumb, k);
        q.side = lerp(q.side, 0.16, k); q.hz = lerp(q.hz, 0.34, k); q.hy = lerp(q.hy, 0.12, k); q.hx = lerp(q.hx, -0.05, k);
        q.y += 0.02 * Math.abs(Math.sin(t * 5)) * k;
      }
      // поймал: подбежал, остановился, грозит пальцем «ай-яй-яй» (другая рука в боку), кивает
      if (st.pose === 'catch') {
        // 0…0,95 с — «поднял, покружил»: обе руки вперёд к её талии, на подъёме — выше, корпус чуть назад (держит), колени
        // подогнуты; потом поставил — грозит пальцем «ай-яй-яй» (другая рука в боку), кивает
        const lift = sst(0.0, 0.2, t) * (1 - sst(0.75, 0.95, t)), k = sst(0.9, 1.2, t), wag = Math.sin(t * 13);
        if (lift > 0.002) {
          const up = sst(0.08, 0.32, t);
          v3(LU, 0.2, lerp(-0.5, -0.12, up), 0.86); v3(LF, -0.32, lerp(0.12, 0.5, up), 0.88);
          armBlend(q, 1, R.AP.hang, LIFTA, lift); armBlend(q, -1, R.AP.hang, LIFTA, lift);
          q.lean = -0.08 * lift; q.hx = 0.1 * lift; R.crouch(q, 0.1 * lift);
        }
        if (k > 0.002) {
          // из «держит» (если ещё держит) — в «рука в боку» и «грозит пальцем»: без скачка рук
          const from = lift > 0.002 ? LIFTA : R.AP.hang;
          if (lift > 0.002) armBlend(q, 1, LIFTA, R.AP.hip, k); else R.setArm(q, 1, R.AP.hip);
          v3(U2, 0.35, 0.5, 0.6); v3(F2, 0.18 * wag, 1, 0.25); armBlend(q, -1, from, WAG, k);
          q.lean = 0.14 * k; q.hx = (0.12 + 0.08 * Math.sin(t * 7)) * k; q.hz = 0.14 * Math.sin(t * 3.5) * k; q.side = 0.05 * Math.sin(t * 3.5) * k;
        }
        if (t < 0.3) { R.leg(q, 1, -0.4 * (1 - t / 0.3), 0.5 * (1 - t / 0.3)); R.plant(q); }
      }
      // радуется: прыгает, руки вверх, звенит кольчугой
      if (st.pose === 'cheer') {
        const hop = Math.abs(Math.sin(t * 7)), k = sst(0, 0.3, t);
        armBlend(q, 1, R.AP.hang, R.AP.up, k); armBlend(q, -1, R.AP.hang, R.AP.up, k);
        q.L.fo[0] += Math.sin(t * 14) * 0.15; q.R.fo[0] -= Math.sin(t * 14) * 0.15;
        q.y = 0.16 * hop * k; q.twist = Math.sin(t * 3.5) * 0.3 * k; q.side = Math.sin(t * 7) * 0.06 * k; q.hx = -0.15 * k;
      }
      // бубенцы: короткая встряска плеч
      if (st.jT < 0.4) { const k = 1 - st.jT / 0.4; q.side += Math.sin(st.jT * 60) * 0.09 * k; q.twist += Math.sin(st.jT * 45) * 0.06 * k; }
      // щелчок плёткой — поверх бега (ноги бегут, рука с плёткой — номер)
      if (hasWhip && st.cT < CR.T && (st.pose === 'run' || st.pose === 'near')) crackPose(q, st.cT); else q.whip = hasWhip ? 'tuck' : null;
      R.apply(dt);
    }
    function poseBox(dt) {
      const b = bx, ph = st.ph, sw = Math.sin(ph), kr = st.wRun, t = st.t;
      b.body.position.y = 0.08 * Math.abs(Math.sin(ph)) * kr + (st.pose === 'cheer' ? 0.15 * Math.abs(Math.sin(t * 7)) : 0);
      b.body.rotation.x = 0.2 * kr;
      b.legL.rotation.x = -0.9 * sw * kr; b.legR.rotation.x = 0.9 * sw * kr;
      b.armL.rotation.x = 0.7 * sw * kr; b.armR.rotation.x = -0.7 * sw * kr;
      if (st.pose === 'near') { b.armL.rotation.x = b.armR.rotation.x = -1.5 + Math.sin(t * 9) * 0.15; }
      if (st.pose === 'catch') { b.armR.rotation.x = -2.6; b.armR.rotation.z = Math.sin(t * 13) * 0.25; }
      else b.armR.rotation.z = 0;
      if (st.pose === 'cheer') { b.armL.rotation.x = b.armR.rotation.x = -2.8 + Math.sin(t * 9) * 0.2; }
      if (st.pose === 'selfie') { b.armL.rotation.x = -2.3; b.armL.rotation.z = 0.4; b.armR.rotation.x = -1.3; }
      if (st.jT < 0.4) b.body.rotation.z = Math.sin(st.jT * 60) * 0.06 * (1 - st.jT / 0.4); else b.body.rotation.z = 0;
    }
    return {
      setHero(r) { heroRoot = r; },
      pos: o => inner.getWorldPosition(o),
      api: {
        root: outer, set, update,
        jingle() { st.jT = 0; },
        // щелчок — только если сейчас бежит (и не во время прошлого щелчка); в воздух, вверх и вбок от героини
        crack() { if (hasWhip && st.cT >= CR.T && (st.pose === 'run' || st.pose === 'near')) st.cT = 0; },
      },
      kind: () => (rig ? 'wedding' : 'box'),
      tris: () => (wh && wh.info ? wh.info.tris : 0), calls: () => (wh && wh.info ? wh.info.calls : 0),
      dispose() {
        if (outer.parent) outer.parent.remove(outer);
        if (wh) { try { wh.dispose(); } catch (e) { /* ok */ } }
      },
    };
  }

  /* ---------------------------------------------------------------------
     СБОРКА
     --------------------------------------------------------------------- */
  function create(ctx) {
    ctx = ctx || {};
    const T = ctx.THREE || window.THREE, scene = ctx.scene;
    if (!T || !scene) throw new Error('runnerActors: нужны THREE и scene');
    const own = [];
    const shadow = blobs(T, scene, own);
    const pal = makePaltar(T, ctx, scene, own, shadow);
    const hero = makeHero(T, ctx, scene, own, shadow, pal);
    pal.setHero(hero.api.root);
    let gone = false;
    return {
      hero: hero.api, paltar: pal.api,
      info() {
        let tris = 0; const r = hero.api.root;
        if (r) r.traverse(o => { if (o.isMesh && o.visible && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
        return { hero: hero.kind(), paltar: pal.kind(), kaz: hero.kazOwn() ? 'own' : (V.kaz && V.kaz.isWorn && V.kaz.isWorn() ? 'host' : null), glide: +hero.glide().toFixed(2), tris: Math.round(tris + pal.tris()), paltarTris: pal.tris(), paltarCalls: pal.calls() };
      },
      dispose() {
        if (gone) return; gone = true;
        hero.dispose(); pal.dispose();
        if (shadow.mesh.parent) shadow.mesh.parent.remove(shadow.mesh);
        shadow.mesh.dispose();
        own.forEach(o => { try { o.dispose(); } catch (e) { /* уже */ } });
        own.length = 0;
      },
    };
  }

  V.runnerActors = { create, POSES, PPOSES, version: 1 };
})();
