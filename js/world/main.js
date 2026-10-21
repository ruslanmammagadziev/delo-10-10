/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: модуль World — одна сцена и один рендерер на всю сессию игры.
   Вход для игры — WorldHub (hub.js): World.walk(o) ведёт один «уличный отрезок» с той же схемой o, что City3D.run:
   сюжет (target, idx, justLit, isLit, spots, pickups, beforeActive…) или прогулка (o.free), + o.world (§9.2-B).
   Двери ведут в те же комнаты (City3D.run({ room })) — их запускает вызывающий по o.done(v), боковые двери и лавки —
   сам город (o.world.onDoor / шаблон лавки) с возвратом к той же двери.
   Героиня — модель автора со скелетом (HeroAnim): шаг, бег, посадка, «помахать», «ура»; без скелета — статуэтка, без
   модели — кукла. Кот идёт рядом, жители здороваются облачком и голосом (G.voiceLine), машина ездит (o.world.vehicles).
   Управление: палец слева — джойстик, справа — камера (щипок — ближе/дальше), тап — идти туда / к двери / к жителю.
   Клавиатура: WASD/стрелки, Q/E — камера, пробел/Enter — действие, H — помахать (в машине — гудок, на велосипеде — звонок).
   Волна 3: жизнь города (residents.js + companion.js: зверята гуляют, собачка-компаньон), велосипед (bike.js) и машина через
   WORLD.Car.create (car.js), мини-карта и «Поехать сюда» (minimap.js), поездка в горы (regions.js; 2D — trip2d.js),
   высота пола (холм, мостик, пирс — L.heightAt), скорости героини HeroAnim.SPEEDS, что когда открыто — CONFIG.UNLOCK
   (Missions.unlock): машина, велосипед, собачка, поездка.
   Волна 4: настоящие руки (js/interact.js — один слой на героиню: взять, съесть, отпить, погладить), день и ночь по часам
   телефона (js/daynight.js; кнопка «Вернуться в утро» / «Как на часах» и чип ☀️/🌙 справа сверху), выбор машины
   «Ретро-купе» / «Красный седан» (js/vehicles/sedan.js; у гаража «Круглые фары», st.world.car, WORLD.carChoice()).
   Волна 5: бег и прыжок (js/move.js — один контроллер на сессию игры: бег — джойстик за край кружка или Shift, кнопка «Прыжок»;
   запрыгнуть на скамейки, бортик фонтана, ящики рынка, капот и крышу машины; машины и велосипед — твёрдые коробки), «Бум!»
   понарошку (js/playfight.js: серия «Толк!-Бамс!-Хлоп!», «Бупнуть» зверят, «Листья», пищащий молоточек из «Юлы»). Кнопки
   справа — одним столбиком (CSS).
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE, WORLD = window.WORLD = window.WORLD || {}, PI = Math.PI;
  if (!T) { window.World = { can: () => false, built: () => false }; return; }
  const QS = new URLSearchParams(location.search);
  const DEBUG = /debug=1/.test(location.search);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G_ = () => window.G || null;
  const haptic = k => { try { const g = G_(); if (g) g.haptic(k); } catch (e) { /* нет */ } };
  const sfx = (k, o) => { try { const g = G_(); if (g) g.sfx(k, o); } catch (e) { /* нет */ } };
  const toast = (t, ms, o) => { const g = G_(); if (g && t) g.toast(t, ms, o); };
  const blocked = () => !!document.querySelector('#layer .dlg-wrap, #layer .modal, .img-full');
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* старый браузер */ } };
  // волна 3: высота пола (холм, лестница, мостик, пирс — L.heightAt из map.js; лестницу на холм открывает HEIGHT_OK)
  WORLD.HEIGHT_OK = true;
  const gy = (L, x, z) => { const h = L && L.heightAt ? L.heightAt(x, z) : 0; return h > 0 ? h : 0; };
  // скорости героини (js/hero_anim.js): шаг 2,0, трусца 3,0 м/с; джойстик (без Move) — шаг до 85% силы (не тише 0,35), дальше трусца
  const HS = (window.HeroAnim && window.HeroAnim.SPEEDS) || { walk: 2.0, jog: 3.0, run: 6.8 };
  const joySpeed = m => (m <= 0.85 ? Math.max(0.35, HS.walk * m / 0.85) : HS.walk + (HS.jog - HS.walk) * (m - 0.85) / 0.15);
  // что открыто (CONFIG.UNLOCK → Missions.unlock): { ok, text } — text — милая строка-замок
  const unlock = k => { try { if (window.Missions && Missions.unlock) return Missions.unlock(k); } catch (e) { /* открыто */ } return { ok: true, text: '' }; };

  /* ---------- настроение: серия 1 от серой мороси к золотому часу (как улица), прогулка — золотой час ---------- */
  const LOOKS = [
    { sky: '#D6DAEA', gnd: '#C4B4B6', hi: 0.78, sun: '#EEEAF2', si: 0.28, off: [-6, 14, 6] },
    { sky: '#E0DAEE', gnd: '#D2BEB8', hi: 0.72, sun: '#FFEADB', si: 0.36, off: [-7, 13, 7] },
    { sky: '#E6D8EE', gnd: '#DDC0B0', hi: 0.64, sun: '#FFE0C2', si: 0.44, off: [-7.5, 11.5, 7.5] },
    { sky: '#E4D4EE', gnd: '#E8C2AE', hi: 0.60, sun: '#FFD4AA', si: 0.49, off: [-8, 9.5, 7.5] },
  ];
  const SKY3D = [
    'linear-gradient(180deg,#959CB4 0%,#B3B5C9 16%,#CFCFDB 36%,#CFCFDB 100%)',
    'linear-gradient(180deg,#A2A8C6 0%,#C6C0DA 16%,#E2DAE3 36%,#E2DAE3 100%)',
    'linear-gradient(180deg,#A6A2D0 0%,#CDBBDD 13%,#E8CFDC 25%,#F1DCDD 36%,#F1DCDD 100%)',
    'linear-gradient(180deg,#9F99CE 0%,#CFB4D8 12%,#F0C8CC 24%,#F8D9CC 36%,#F8D9CC 100%)',
  ];
  const FOGC = ['#CFCFDB', '#E2DAE3', '#F1DCDD', '#F8D9CC'];
  const RIMS = [['#DCE2FF', 0.10], ['#FFEFE6', 0.14], ['#FFE4D0', 0.18], ['#FFD0AE', 0.26]];
  const SAT = [0.42, 0.64, 0.84, 1];
  const BID = { cinema: 1, bureau: 2, sweets: 3, roof: 4, stairs: 4 };
  const STORY_KEYS = ['cinema', 'bureau', 'sweets', 'roof'];

  /* ---------- качество: среднее → низкое → облегчённое → (улица — решает хаб) ---------- */
  const QUAL = {
    lite: { name: 'облегчённое', dpr: 0.8, shadow: false, fog: [18, 40], far: 52, npcR: 16, map: 512, detail: 0, outline: false },
    low: { name: 'низкое', dpr: 1, shadow: false, fog: [22, 55], far: 72, npcR: 26, map: 512, detail: 14, outline: true },
    mid: { name: 'среднее', dpr: 1.25, shadow: true, fog: [28, 76], far: 88, npcR: 34, map: 1024, detail: 17, outline: true },
    high: { name: 'высокое', dpr: 1.6, shadow: true, fog: [32, 84], far: 105, npcR: 42, map: 2048, detail: 32, outline: true },
  };
  const ORDER = ['lite', 'low', 'mid', 'high'];
  const qFixed = () => (QUAL[QS.get('wq')] ? QS.get('wq') : QUAL[QS.get('q')] ? QS.get('q') : null);

  /* ---------- прочее содержание ---------- */
  const FILLER_LINES = ['Хозяева ушли гулять. На двери записка: «Скоро вернёмся».', 'Тук-тук. Тишина. Наверное, все на площади у фонтана.', 'Закрыто: хозяева уехали к бабушке за вареньем.', 'Здесь живут, но сейчас все на прогулке.', 'На двери колокольчик и табличка «Ушли кормить уток».'];
  const WAVE_REPLY = { name: ['Привет, {name}!', 'О, {name}! Привет!', 'Приятно познакомиться, {name}!'], plain: ['Привет-привет!', 'И тебе привет!', 'Привет! Заходи ещё.'], cat: { name: ['Мур. Привет, {name}.'], plain: ['Мур.', 'Мяу. Это «привет».'] } };
  const HI_AGAIN = ['Hi!', 'Hello!', 'Hey there!'];
  const NUDGE_CAT = ['Метка — там, где луч. Я бы пошёл. Если бы не лень.', 'Мур. Луч никуда не денется, но я бы не тянул.'];
  const COVER_LINES = ['Под чехлом что-то маленькое и блестящее. Ждёт своей серии.', 'Чехол завязан бантом. Значит, это сюрприз.'];
  // волна 4: что держит настоящая рука (имя предмета js/interact.js) и строка, когда кончилось
  const IA_ITEM = { popcorn: 'popcorn', cup: 'cocoa', cocoa: 'cocoa', pretzel: 'pretzel', flower: 'flower', bread: 'bread' };
  const HELD_DONE = {
    cup: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.', cocoa: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.',
    popcorn: 'Попкорн исчез. Пирожок клянётся, что ничего не трогал.', pretzel: 'Крендель съеден. На пальто — капелька сахарной пудры.', bread: 'Вкусно! Ни крошки не осталось.',
  };
  const CART = { x: -3.2, z: -1.05 };   // запасной прилавок (прежнее место у кинотеатра), если в раскладке нет L.flowerShop

  const supported = (() => { let ok = null, maxTex = 0; return () => {
    if (ok !== null) return { ok, maxTex };
    try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); ok = !!gl; if (gl) { maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0; const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } } catch (e) { ok = false; }
    return { ok, maxTex };
  }; })();

  /* =====================================================================
     СБОРКА ГОРОДА (один раз за сессию; можно фоном)
     ===================================================================== */
  let W = null, buildP = null, buildErr = null, progress = { k: 0, msg: '' };
  const progressCbs = new Set();
  const yieldStep = async idle => {
    if (idle) {
      // фоном: в простое; пока она печатает имя — не мешаем
      for (let i = 0; i < 40 && document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName); i++) await sleep(250);
      await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 300 }) : setTimeout(r, 16)));
    } else await Promise.race([frame(), sleep(60)]);
  };
  function build(opts = {}) {
    if (W) return Promise.resolve(W);
    if (buildP) { if (!opts.idle) buildP.idle = false; return buildP; }
    const job = { idle: !!opts.idle, q: QUAL[opts.q] ? opts.q : null };
    buildP = doBuild(job).then(w => { W = w; return w; }, e => { buildErr = e; buildP = null; throw e; });
    buildP.idle = job.idle; buildP.job = job;
    return buildP;
  }
  async function doBuild(job) {
    const t0 = performance.now();
    let k = 0;
    const prog = msg => { k = Math.min(0.97, k + 0.07); progress = { k, msg }; progressCbs.forEach(f => { try { f(k, msg); } catch (e) { /* ignore */ } }); };
    const step = async msg => { if (msg) prog(msg); await yieldStep(buildP && buildP.idle === false ? false : job.idle); };
    const root = document.createElement('div'); root.className = 'city3d w-root';
    const canvas = document.createElement('canvas'); canvas.className = 'c3d'; root.appendChild(canvas);
    const ui = WORLD.makeUI(root);
    const w = { root, canvas, ui, qKey: qFixed() || job.q || 'mid', lost: 0, released: false, renderer: null, SH: { calls: 0, tris: 0 } };
    w.Q = QUAL[w.qKey];
    makeRenderer(w);
    const scene = w.scene = new T.Scene();
    scene.fog = new T.Fog(new T.Color(FOGC[3]), w.Q.fog[0], w.Q.fog[1]);
    const camera = w.camera = new T.PerspectiveCamera(58, 1, 0.1, w.Q.far);
    w.hemi = new T.HemisphereLight(LOOKS[3].sky, LOOKS[3].gnd, LOOKS[3].hi); scene.add(w.hemi);
    const sun = w.sun = new T.DirectionalLight(LOOKS[3].sun, LOOKS[3].si);
    sun.castShadow = true; sun.shadow.mapSize.set(w.Q.map, w.Q.map); sun.shadow.radius = 3;
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 4, far: 42 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);
    await step('шрифты'); await WORLD.util.fontsReady();
    const H = w.H = WORLD.createKit({ rim: RIMS[3] });
    const SIGN = WORLD.makeSigns();
    const MAP = w.MAP = await WORLD.buildMap({ H, scene, SIGN, step });
    w.L = MAP.L;
    w.doors = WORLD.makeDoors(MAP);
    await step('игрушки улицы');
    w.toys = WORLD.makeToys(H, scene, w.L);
    w.markers = WORLD.makeMarkers(H, scene);
    // земля, кроны и «ковры» листьев — тоже в общем настроении (серый → тёплый)
    { const seen = new Set(); scene.traverse(m => { if (!m.isMesh || !m.material || seen.has(m.material)) return; const kd = m.userData.kind; if (m.userData.ground || kd === 'crown' || kd === 'poplar' || kd === 'carpet') { seen.add(m.material); H.moodPatch(m.material, 'g' + seen.size); m.material.needsUpdate = true; } }); }
    await step('героиня');
    const A = w.A = WORLD.makeActors(H);
    let H3 = null;
    if (window.HERO3D && T.GLTFLoader && typeof HERO3D.load === 'function' && QS.get('hero') !== 'off') {
      try { H3 = await Promise.race([HERO3D.load(), sleep(9000).then(() => null)]); } catch (e) { H3 = null; }
    }
    let hero = null;
    if (H3) { try { hero = A.buildHeroRig(null, H3); } catch (e) { console.warn('world hero rig', e); hero = null; } }
    if (!hero && H3) { try { hero = A.buildHeroGLB(null, H3); } catch (e) { console.warn('world hero glb', e); hero = null; } }
    if (!hero) hero = fallbackHero(H);
    w.hero = hero; w.heroKind = hero.rig ? 'rig' : hero.statue ? 'statue' : 'doll';
    // образ (один из шести, js/hero_looks.js): одежда и причёска на модели автора (js/hero_outfits.js) — общие с комнатами и горами;
    // без образов — прежняя перекраска тренча (js/hero_look3d.js)
    w.H3 = (hero.rig || hero.statue) && window.HeroLook3D ? H3 : null;
    // одежда образа на низком качестве — без оболочки контура (бюджет q=low ≤ 200 тыс.)
    if (window.HeroOutfits && HeroOutfits.setQuality) HeroOutfits.setQuality(w.qKey);
    { const st = window.G && G.state ? G.state() : {}; heroLookSet(w, { look: st.look, bow: st.bow, coat: st.coat, hair: st.hair }); }
    { const rimmed = new Set(); hero.root.traverse(m => { if (m.isMesh && m.material && m.material.isMeshToonMaterial && !rimmed.has(m.material)) { rimmed.add(m.material); H.addRim(m.material, 1); } }); }
    scene.add(hero.root);
    // тень героини — от простой «куклы», а не от модели в 28 тыс. треугольников (на земле разницы не видно)
    if (hero.rig || hero.statue) {
      const px = new T.Group(), inv = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
      [[H.GEO.cone, [0, 0.82, 0], [0.36, 1.0, 0.3]], [H.GEO.sph, [0, 1.5, -0.05], [0.33, 0.36, 0.31]], [H.GEO.sph, [0, 1.82, -0.02], [0.3, 0.09, 0.3]], [H.GEO.cyl, [0, 0.2, 0], [0.11, 0.4, 0.06]]]
        .forEach(([g, p, sc]) => { const m = H.put(px, g, inv, p, sc); m.castShadow = true; m.receiveShadow = false; m.renderOrder = -1; m.raycast = () => {}; });
      hero.body.add(px); (hero.rig || hero.statue).mesh.castShadow = false; w.heroProxy = px;
    }
    w.heroBlob = H.put(scene, H.GEO.plane, H.blobMat, [0, 0.02, 0], [0.8, 0.5, 1], [-PI / 2, 0, 0]); w.heroBlob.castShadow = false; w.heroBlob.receiveShadow = false; w.heroBlob.renderOrder = 1;
    // настоящие руки (волна 4, js/interact.js): один слой на героиню со скелетом на всю сессию игры. Регион и другие сцены,
    // позвав Interact.create на ту же модель, получают ручку того же слоя (см. interact.js). Корень и звуки — у текущей прогулки.
    w.ia = hero.ia = null;
    if (window.Interact && hero.rig && hero.rig.anim && QS.get('hands') !== 'off') {
      try { w.ia = hero.ia = Interact.create({ THREE: T, anim: hero.rig.anim, heroRoot: hero.root, gradientMap: H.GRAD, setRoot: (p, yaw) => { if (S && S.iaRoot) S.iaRoot(p, yaw); }, on: (n, d) => { if (S && S.iaOn) S.iaOn(n, d); } }); }
      catch (e) { console.warn('world hands', e); w.ia = hero.ia = null; }
    }
    w.cat = A.buildCat(); scene.add(w.cat.root); w.cat.root.visible = false; w.cat.root.userData.dn = 'actor';   // ночью — как жители (темнеет на ⅔)
    w.catBlob = H.put(scene, H.GEO.plane, H.blobMat, [0, 0.02, 0], [0.48, 0.34, 1], [-PI / 2, 0, 0]); w.catBlob.castShadow = false; w.catBlob.receiveShadow = false; w.catBlob.renderOrder = 1; w.catBlob.visible = false;
    await step('жители');
    // жизнь города (LIFE, волна 3): 8 жителей волны 2 + зверята гуляют по дорожкам; без residents.makeLife — прежние жители на местах
    w.life = null;
    if (WORLD.makeLife && !(DEBUG && QS.get('life') === 'off')) { try { w.life = WORLD.makeLife({ H, scene, A, MAP, L: w.L, ui, root, camera }); } catch (e) { console.warn('world life', e); w.life = null; } }
    // собачка-компаньон для места в машине (WORLD.Car: enter(hero, { dog: w.dog.root }))
    Object.defineProperty(w, 'dog', { configurable: true, get: () => (w.life && w.life.companion && w.life.companion.carRoot() ? w.life.companion : null) });
    const SP = MAP.npcSpots || WORLD.RESIDENT_SPOTS;
    if (w.life) w.npcs = w.life.npcs;
    else w.npcs = Object.keys(SP).filter(id => A.NPC[id]).map(id => {
      const sp = SP[id], n = A.NPC[id]();
      n.root.position.set(sp.x, 0, sp.z); n.root.rotation.y = sp.ry; n.ry0 = sp.ry; scene.add(n.root);
      if (id === 'poodle') n.root.scale.setScalar(1.25);
      Object.assign(n, { id, x: sp.x, z: sp.z, li: 0, greetT: -99, honkT: -99, headY: id === 'pigeon' ? 0.55 : id === 'poodle' ? 0.6 : 1.25 });
      n.outlines = []; n.root.traverse(m => { if (m.isMesh && m.userData.outline) n.outlines.push(m); });
      return n;
    });
    await step('машинка');
    // машинка: пока под чехлом (CONFIG.UNLOCK.car) — у кинотеатра, как в серии 1; открыта — дома, у гаража «Круглые фары».
    // Волна 4: «Ретро-купе» или «Красный седан» (st.world.car; седан открывается вместе с машиной — CONFIG.UNLOCK.sedan).
    // В мире стоит только выбранная машина, вторая — «в гараже» (скрыта; строится, когда её впервые выберут).
    w.cars = {}; w.carColor = 0;
    useCar(w, carWanted(), { home: true });
    // вторая машина — тоже у старта (видна, когда её можно взять: решает прогулка, spareSetup); строится сейчас — до прогрева шейдеров
    if (sedanOk() && sedanOpen()) {
      try { const k2 = w.carKind === 'sedan' ? 'coupe' : 'sedan'; placeCar(makeCarKind(w, k2).car, carHome(w, k2)); useCar(w, w.carKind); } catch (e) { console.warn('world spare car', e); }
    }
    // велосипед (BIKE): у кинотеатра (L.spawnPoints.bike), дуги стоянки; у проката на набережной — ряд велосипедов (декор)
    if (WORLD.Bike) {
      await step('велосипед');
      try {
        const dynB = () => (w.life ? w.life.circles([]) : w.npcs.filter(n => n.root.visible).map(n => ({ x: n.x, z: n.z, r: n.id === 'pigeon' ? 0.22 : 0.42 })));
        w.bike = WORLD.Bike.create({ THREE: T, scene, kit: H, layout: w.L, colliders: MAP.colliders, doors: w.doors, camera, dyn: dynB });
        w.bikeStand = WORLD.Bike.makeStand(H, { x: w.bike.pos.x, z: w.bike.pos.z, ry: w.bike.ry }); scene.add(w.bikeStand);
        w.bike.on('dismount', r => { if (S && S.onBikeOff) S.onBikeOff(r); });
        w.bike.on('bell', () => { if (S && S.onBell) S.onBell(); });
        const rp = (w.L.pois || []).find(p => p.kind === 'bikes');
        if (rp && rp.rack && WORLD.Bike.makeRack) { w.bikeRack = WORLD.Bike.makeRack(H, rp.rack, 2); scene.add(w.bikeRack); }
      } catch (e) { console.warn('world bike', e); w.bike = null; }
    }
    // сетка 8 × 8 м для столкновений и «штанги» камеры: не перебирать все коробки каждый кадр
    w.grid = makeGrid(MAP.colliders);
    // волна 5: бег, прыжок, «запрыгнуть, если достаёт» (js/move.js) — один контроллер на сессию игры; данные кадра — у прогулки (S)
    w.mv = null; w.mvUi = null;
    if (window.Move && QS.get('move') !== 'off') {
      try {
        w.mvCols = mvColliders(MAP.colliders);
        w.mv = Move.create({
          THREE: T, hero, anim: hero.rig ? hero.rig.anim : null, ground: (x, z) => gy(w.L, x, z), colliders: w.mvCols,
          dynColliders: () => (S && S.mvDyn ? S.mvDyn() : NO_DYN), edges: 'soft', bounds: w.L.bounds, scene, camera, host: root,
          say: t => { if (S && S.mvSay) S.mvSay(t); }, onFall: (k, i) => { if (S && S.mvFall) S.mvFall(k, i); }, on: (n, d) => { if (S && S.mvOn) S.mvOn(n, d); },
        });
        if (w.mv) { w.mvUi = Move.mountButtons(ui.ui, { move: w.mv, onJump: () => { if (S && S.mvJumpBtn) S.mvJumpBtn(); } }); if (w.mvUi) w.mvUi.setVisible(false); }
      } catch (e) { console.warn('world move', e); w.mv = null; }
    }
    // волна 5: «Бум!» понарошку (js/playfight.js) — жители города и зверята (только «Бупнуть»); один слой на сессию игры
    w.pf = null;
    if (window.PlayFight && hero.rig && w.life && QS.get('pf') !== 'off') {
      try {
        const pfList = [];
        // кот-помощник (идёт рядом с героиней) — тоже зверёк: «Бупнуть»; координаты — у прогулки (S.catX/catZ)
        const catN = w.catN = { id: 'cat', pet: true, small: true, headY: 0.42, r: 0.2, root: w.cat.root,
          get x() { return S ? S.catX : 0; }, set x(v) { if (S) S.catX = v; }, get z() { return S ? S.catZ : 0; }, set z(v) { if (S) S.catZ = v; } };
        w.pf = PlayFight.create({
          THREE: T, scene, camera, hero: hero.root, anim: hero.rig.anim, interact: w.ia, gradientMap: H.GRAD,
          getNpcs: () => { pfList.length = 0; const L2 = w.life.npcs; for (let i = 0; i < L2.length; i++) pfList.push(L2[i]); const cp = w.life.companion; if (cp && cp.active() && cp.n && pfList.indexOf(cp.n) < 0) pfList.push(cp.n); if (S && S.catOn && !S.catSit && !S.catInBasket) pfList.push(catN); return pfList; },
          canTarget: n => !!(S && S.pfCan && S.pfCan(n)),
          moveNpc: (n, dx, dz) => { const q = w.life.collide(n.x + dx, n.z + dz, n.r || 0.3); n.x = q[0]; n.z = q[1]; },
          setYaw: y => { if (S && S.pfYaw) S.pfYaw(y); },
          moveHero: (dx, dz) => { if (S && S.pfMove) S.pfMove(dx, dz); },
          ground: (x, z) => gy(w.L, x, z),
          season: () => 'autumn',          // город осенний: бросок — «Листья» (снежки — в горах зимой)
          say: (n, text, who) => { const was = n.voice; n.voice = who || was; try { w.life.say(n, text, 2200); } catch (e) { /* без облачка */ } n.voice = was; },
          buttonsHost: ui.ui,
          on: (name, d) => { if (S && S.pfOn) S.pfOn(name, d); },
        });
        if (w.pf) w.pf.enable(false);
      } catch (e) { console.warn('world playfight', e); w.pf = null; }
    }
    w.DETAIL = []; MAP.zones.forEach(g => g.children.forEach(m => { if (m.userData.detail) { m.geometry.computeBoundingBox(); w.DETAIL.push(m); } }));
    // дальний вид на востоке (js/world/far_view.js): хребты и село на склоне — слой неба, рисуется до города (tick)
    w.far = null;
    if (WORLD.makeFarView) { try { w.far = WORLD.makeFarView({ THREE: T, quality: w.qKey }); } catch (e) { console.warn('world far view', e); w.far = null; } }
    // день и ночь по часам телефона (волна 4, js/daynight.js): до первого кадра — иначе шейдеры перекомпилируются
    w.dn = null;
    if (window.DayNight && QS.get('daynight') !== 'off') {
      try {
        w.dn = DayNight.create({ THREE: T, scene, renderer: w.renderer, camera, sun, hemi: w.hemi, sky: root, preset: 'city', quality: w.qKey === 'high' ? 'high' : 'low', ground: (x, z) => gy(w.L, x, z) });
        w.dn.attach(scene);                       // фасады, земля, кроны, жители, героиня; метки (группа 'markers') — без грейда
        if (MAP.halos) w.dn.addHalo(MAP.halos);   // фонари бульвара: ночью ярче и больше
        if (w.far) w.dn.attach(w.far.root);       // дальний вид: тот же грейд; свет окон села — far.setNight в renderFrame
        if (DEBUG && QS.get('clock') !== null) DayNight.setClock(() => +QS.get('clock'));   // отладка: «часы телефона» (22.5 — ночь)
      } catch (e) { console.warn('world daynight', e); w.dn = null; }
    }
    await step('прогрев');
    resizeTo(w, 390, 844);
    camera.position.set(3, 5, 12); camera.lookAt(0, 1.3, 0);
    try { w.renderer.compile(scene, camera); if (w.far) w.renderer.compile(w.far.scene, camera); } catch (e) { /* не страшно */ }
    // мини-карта и большая карта (MAPUI): DOM + 2D-холст, без вызовов WebGL; данные — из живой прогулки (S)
    if (WORLD.Minimap && unlock('minimap').ok) {
      try {
        w.minimap = WORLD.Minimap.create({
          root: w.ui.ui,
          edgeOpen: () => !!(S && S.tripOpen && S.tripOpen()),
          // волна 4B (MAP): точки гор на большой карте — «Поехать сюда» только когда поездка открыта; поездка — через загрузчик регионов
          tripOpen: () => !!(S && S.tripOpen && S.tripOpen()),
          onTravelRegion: (rid, poiId, poi) => {
            if (rid === 'city' || !(S && S.regionTrip && S.tripOpen && S.tripOpen())) return false;
            const at = poi && isFinite(poi.x) ? { x: poi.x, z: poi.z, label: poi.label } : null;
            // волна 4 (интегратор): в первый раз — по серпантину самой, за рулём (желание автора); метка «📍» ведёт к точке.
            // Когда дорога наверх уже пройдена (st.world.road), «Поехать сюда» везёт сразу к точке.
            if (!wState().road && rid !== 'serpentine') {
              if (at) { try { WORLD.Minimap.setWaypoint({ rid, id: poiId, x: at.x, z: at.z, label: at.label, kind: poi.kind }); } catch (e) { /* без метки */ } }
              return S.regionTrip(null, { note: at && at.label ? `Первый раз — по серпантину, за рулём! Метка 📍 приведёт: «${at.label}».` : 'Первый раз — по серпантину, за рулём!' });
            }
            return S.regionTrip(null, { to: rid, poi: poiId, at });
          },
          onOpen: () => { loopStop(); },       // большая карта закрывает экран — 3D-кадры не нужны
          onClose: () => { if (S && !S.finished && !S.paused) loopStart(); },
          onTravel: (poi, spot) => (poi.kind === 'edge' && S && S.regionTrip && S.tripOpen && S.tripOpen()
            ? S.regionTrip(null) : WORLD.Minimap.travelDefault(poi, w.L.poiAt ? Object.assign({}, spot, (() => { const q = w.L.poiAt(poi.src || poi); return q && q !== (poi.src || poi) ? { x: q.x, z: q.z } : {}; })()) : spot)),
        });
      } catch (e) { console.warn('minimap', e); w.minimap = null; }
    }
    w.buildMs = Math.round(performance.now() - t0);
    prog('готово');
    emit('world:ready', { buildMs: w.buildMs, q: w.qKey, hero: w.heroKind });
    return w;
  }

  function makeRenderer(w) {
    const r = new T.WebGLRenderer({ canvas: w.canvas, antialias: true, alpha: true, powerPreference: 'default' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, w.Q.dpr));
    r.shadowMap.enabled = w.Q.shadow; r.shadowMap.type = T.PCFShadowMap;
    // счётчик честный: three.js r149 обнуляет info уже после теней — обнуляем сами и тени меряем отдельно
    r.info.autoReset = false;
    { const sm = r.shadowMap, orig = sm.render.bind(sm); sm.render = (...a) => { const c0 = r.info.render.calls, t0 = r.info.render.triangles; orig(...a); w.SH.calls = r.info.render.calls - c0; w.SH.tris = r.info.render.triangles - t0; }; }
    w.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); w.lost++; w.isLost = true; if (S && !S.finished && !S.paused) S.fail('contextlost'); }, false);
    w.renderer = r; w.released = false; w.isLost = false;
    try { const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); w.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); } catch (e) { w.gpu = '?'; }
    w.soft = /swiftshader|llvmpipe|software/i.test(w.gpu || '');
  }
  // после «отпустить» или потери контекста: новый холст и рендерер, сцена та же — three загрузит сцену в видеокарту сам
  function ensureRenderer(w) {
    if (w.renderer && !w.released && !w.isLost) return;
    try { if (w.renderer) w.renderer.dispose(); } catch (e) { /* ignore */ }
    const c2 = document.createElement('canvas'); c2.className = 'c3d';
    w.root.replaceChild(c2, w.canvas); w.canvas = c2;
    makeRenderer(w);
  }
  function release() {
    if (!W || !W.renderer || W.released) return;
    try { W.renderer.dispose(); W.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    W.released = true;
  }
  function resizeTo(w, wd, ht) {
    const a = wd / ht; w.portrait = a < 0.8;
    w.camera.fov = w.portrait ? 58 : 48; w.camera.aspect = a; w.camera.updateProjectionMatrix();
    if (w.renderer) w.renderer.setSize(wd, ht, false);
  }
  function setQuality(k, say) {
    const w = W; if (!w || !QUAL[k] || k === w.qKey) return false;
    const shadowWas = w.Q.shadow, mapWas = w.Q.map; w.qKey = k; w.Q = QUAL[k];
    if (window.HeroOutfits && HeroOutfits.setQuality) HeroOutfits.setQuality(k);
    w.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w.Q.dpr));
    if (w.root.isConnected) resizeTo(w, w.root.clientWidth || 390, w.root.clientHeight || 844);
    w.scene.fog.near = w.Q.fog[0]; w.scene.fog.far = w.Q.fog[1]; w.camera.far = w.Q.far; w.camera.updateProjectionMatrix();
    if (shadowWas !== w.Q.shadow || mapWas !== w.Q.map) {
      w.renderer.shadowMap.enabled = w.Q.shadow; w.sun.shadow.mapSize.set(w.Q.map, w.Q.map);
      if (w.sun.shadow.map) { w.sun.shadow.map.dispose(); w.sun.shadow.map = null; }
      w.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    }
    if (say) toast('Качество: ' + w.Q.name, 1500);
    return true;
  }

  // волна 5: коллайдеры для Move. Всё, что было стеной, — стена во всю высоту (дома, перила набережной и мостика, стенки холма,
  // заборы, прилавки): перепрыгнуть нельзя, в реку не упасть. Запрыгнуть — только на то, что отмечено в map.js (colliders.tops:
  // скамейки, бортик фонтана, ящики рынка); их прежние круги (move:'skip') Move не видит. Коробки «только для камеры» — нет.
  const NO_DYN = [];
  function mvColliders(C) {
    const out = [];
    C.boxes.forEach(b => { if (b.cam === true || b.noWalk === false || b.move === 'skip') return; out.push(b.move ? b : { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, id: 'wall' }); });
    C.circles.forEach(c => { if (c.move !== 'skip') out.push(c); });
    (C.tops || []).forEach(t => out.push(t));
    return out;
  }
  // сетка коллайдеров: круги и коробки по клеткам 8 м
  function makeGrid(C) {
    const CELL = 8, cells = new Map(), key = (i, j) => i * 4096 + j;
    const addTo = (x0, x1, z0, z1, item) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); if (!cells.has(k)) cells.set(k, { c: [], b: [] }); cells.get(k)[item.r !== undefined ? 'c' : 'b'].push(item); } };
    const big = [];
    C.circles.forEach(c => addTo(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, c));
    C.boxes.forEach(b => { if ((b.x1 - b.x0) * (b.z1 - b.z0) > 900) big.push(b); else addTo(b.x0, b.x1, b.z0, b.z1, b); });
    const seen = new Set();
    return {
      near(x0, x1, z0, z1, fnC, fnB) {
        seen.clear();
        for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
          const c = cells.get(key(i, j)); if (!c) continue;
          if (fnC) c.c.forEach(it => { if (!seen.has(it)) { seen.add(it); fnC(it); } });
          if (fnB) c.b.forEach(it => { if (!seen.has(it)) { seen.add(it); fnB(it); } });
        }
        if (fnB) big.forEach(fnB);
      },
    };
  }
  // карта проходимости 0,5 м и A* (обход киоска, лавочек, фонарей и домов, когда прямой путь закрыт)
  function navOf(w) {
    if (w.nav) return w.nav;
    const B = w.L.bounds, C = 0.5, R = 0.32, NX = Math.ceil((B.x1 - B.x0) / C) + 1, NZ = Math.ceil((B.z1 - B.z0) / C) + 1;
    const g = new Uint8Array(NX * NZ);
    const ci = x => Math.round((x - B.x0) / C), cj = z => Math.round((z - B.z0) / C);
    const mark = (x0, x1, z0, z1) => { for (let i = Math.max(0, Math.ceil((x0 - B.x0) / C)); i <= Math.min(NX - 1, Math.floor((x1 - B.x0) / C)); i++) for (let j = Math.max(0, Math.ceil((z0 - B.z0) / C)); j <= Math.min(NZ - 1, Math.floor((z1 - B.z0) / C)); j++) g[i + j * NX] = 1; };
    w.MAP.colliders.boxes.forEach(b => { if (b.noWalk !== false) mark(b.x0 - R, b.x1 + R, b.z0 - R, b.z1 + R); });   // коробки «только для камеры» (склон холма) — не препятствие
    w.MAP.colliders.circles.forEach(c => { const r = c.r + R; for (let i = Math.max(0, Math.ceil((c.x - r - B.x0) / C)); i <= Math.min(NX - 1, Math.floor((c.x + r - B.x0) / C)); i++) for (let j = Math.max(0, Math.ceil((c.z - r - B.z0) / C)); j <= Math.min(NZ - 1, Math.floor((c.z + r - B.z0) / C)); j++) { const x = B.x0 + i * C, z = B.z0 + j * C; if (Math.hypot(x - c.x, z - c.z) < r) g[i + j * NX] = 1; } });
    const free = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && !g[i + j * NX];
    const nearFree = (i, j) => { if (free(i, j)) return [i, j]; for (let r = 1; r <= 4; r++) for (let a = -r; a <= r; a++) for (const [di, dj] of [[a, -r], [a, r], [-r, a], [r, a]]) if (free(i + di, j + dj)) return [i + di, j + dj]; return null; };
    const los = (x0, z0, x1, z1) => { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.25)); for (let k = 1; k < n; k++) { const t = k / n; if (!free(ci(x0 + (x1 - x0) * t), cj(z0 + (z1 - z0) * t))) return false; } return true; };
    function path(x0, z0, x1, z1) {
      if (los(x0, z0, x1, z1)) return [];
      const s0 = nearFree(ci(x0), cj(z0)), s1 = nearFree(ci(x1), cj(z1)); if (!s0 || !s1) return null;
      const start = s0[0] + s0[1] * NX, goal = s1[0] + s1[1] * NX;
      const G = new Float32Array(NX * NZ).fill(1e9), from = new Int32Array(NX * NZ).fill(-1), closed = new Uint8Array(NX * NZ);
      const heap = [], push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      const hx = s1[0], hz = s1[1], H = (i, j) => { const dx = Math.abs(i - hx), dz = Math.abs(j - hz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
      G[start] = 0; push(H(s0[0], s0[1]), start);
      let n = 0, found = false;
      while (heap.length && n++ < 160000) {   // сетка выросла с 237 × 137 до 485 × 327 клеток (большой город)
        const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
        if (k === goal) { found = true; break; }
        const i = k % NX, j = (k / NX) | 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue; const a = i + di, b = j + dj; if (!free(a, b)) continue;
          if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
          const kk = a + b * NX, gg = G[k] + (di && dj ? 1.414 : 1); if (gg < G[kk]) { G[kk] = gg; from[kk] = k; push(gg + H(a, b), kk); }
        }
      }
      if (!found) return null;
      const cells = []; for (let k = goal; k !== -1; k = from[k]) cells.push([B.x0 + (k % NX) * C, B.z0 + ((k / NX) | 0) * C]);
      cells.reverse();
      // натянуть нитку: оставить только точки, между которыми нет прямой видимости
      const out = []; let ax = x0, az = z0, k = 0;
      while (k < cells.length) { let far = k; for (let m = cells.length - 1; m > k; m--) if (los(ax, az, cells[m][0], cells[m][1])) { far = m; break; } if (los(ax, az, x1, z1)) break; out.push(cells[far]); ax = cells[far][0]; az = cells[far][1]; k = far + 1; }
      return out;
    }
    return (w.nav = { path, los, free: (x, z) => free(ci(x), cj(z)) });
  }
  // чехол на машину (серия 1): ткань повторяет кузов (та же сетка, чуть шире), над салоном — мягкий горб, сверху бант
  function makeCover(H, car) {
    const g = new T.Group(); car.body.add(g);
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
  }
  // запасная героиня: кукла из примитивов
  function fallbackHero(H) {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const coat = H.toon('#E9D4B6'), skin = H.toon('#F7DCC8'), hair = H.toon('#4A3128'), beret = H.toon('#C2405B'), bow = H.toon('#F08FA8'), shoe = H.toon('#5A4A55');
    H.put(body, H.GEO.cone, coat, [0, 0.82, 0], [0.34, 0.95, 0.3]);
    const legs = [-1, 1].map(s => { const g = new T.Group(); g.position.set(0.08 * s, 0.42, 0); body.add(g); H.put(g, H.GEO.cyl, H.toon('#F2C9C0'), [0, -0.2, 0], [0.045, 0.4, 0.045]); H.put(g, H.GEO.sph, shoe, [0, -0.4, 0.03], [0.06, 0.04, 0.09]); return g; });
    H.put(body, H.GEO.sph, hair, [0, 1.52, -0.03], [0.3, 0.32, 0.28]); H.put(body, H.GEO.sph, skin, [0, 1.5, 0.03], [0.26, 0.27, 0.25]);
    H.put(body, H.GEO.sph, beret, [0, 1.78, 0], [0.27, 0.08, 0.26]); H.put(body, H.GEO.sph, bow, [0.15, 1.72, 0.12], [0.08, 0.05, 0.03]);
    const head = new T.Group(); head.position.set(0, 1.5, 0); body.add(head);
    const hand = p => { const pv = new T.Group(); pv.position.fromArray(p); body.add(pv); const inner = new T.Group(); pv.add(inner); return { pv, inner }; };
    return { root, body, legs, head, arms: [hand([0.24, 0.72, 0.05]), hand([-0.24, 0.72, 0.05])], mats: [coat, skin, hair, beret, bow, shoe], statue: null, rig: null, doll: { coat, hair, beret, bow } };
  }
  // образ героини: у модели автора — одежда и причёска образа (js/hero_outfits.js; без него — перекраска тренча, js/hero_look3d.js),
  // у «куклы» — цвета материалов (по палитре образа: пальто, волосы; берета и банта у образов нет)
  function heroLookSet(w, lk) {
    if (!lk) return;
    try {
      if (w.H3 && window.HeroOutfits) { const r = HeroOutfits.wear(w.H3, w.hero, lk); if (r) { w.lookId = r.id; return; } }
      if (w.H3) { w.lookId = null; HeroLook3D.apply(w.H3, lk); return; }
      const d = w.hero && w.hero.doll;
      if (!d) return;
      const HL = window.HeroLooks, id = HL && HL.valid(lk.look) ? lk.look : null;
      if (id) {
        const pal = HL.get(id).pal;
        w.lookId = id; w.dollLook = Object.assign({ look: id }, HL.legacy(id));
        d.coat.color.set(pal.main); d.hair.color.set(pal.hair); d.bow.visible = false; d.beret.visible = false;
        return;
      }
      w.dollLook = Object.assign(w.dollLook || {}, lk);
      d.bow.visible = true; d.beret.visible = true;
      if (lk.coat) d.coat.color.set(lk.coat);
      if (lk.hair) d.hair.color.set(lk.hair);
      if (lk.bow) { let br = null; try { br = window.HERO && HERO.beretOf ? HERO.beretOf(lk.bow) : null; } catch (e) { br = null; } d.bow.color.set(lk.bow); d.beret.color.set(br || '#C2405B'); }
    } catch (e) { console.warn('hero look', e); }
  }

  /* ---------- машины города (волна 4): «Ретро-купе» (WORLD.makeCar + WORLD.Car) и «Красный седан» (VEHICLES.sedan) ---------- */
  const CAR_TITLE = { coupe: 'Жёлтый кабриолет', sedan: 'Красный седан' };
  const sedanOk = () => !!(window.VEHICLES && VEHICLES.sedan && VEHICLES.sedan.makeCar && VEHICLES.sedan.create);
  // выбор в сохранении (st.world.car); стенд: ?car=sedan|coupe
  function savedCar() {
    const q = QS.get('car'); if ((DEBUG || window.WORLD_STAND) && (q === 'sedan' || q === 'coupe')) return q;
    try { return wState().car === 'sedan' ? 'sedan' : 'coupe'; } catch (e) { return 'coupe'; }
  }
  // стенд world.html открыт целиком; ?debug=1&locks=1 — замки по датам и машина у гаража, как в игре
  const standOpen = () => !!window.WORLD_STAND && !(DEBUG && QS.get('locks') === '1');
  const sedanOpen = () => standOpen() || (unlock('car').ok && unlock('sedan').ok);
  // какая машина стоит в городе: седан — если он есть в сборке, открыт (вместе с машиной) и выбран
  function carWanted() { return savedCar() === 'sedan' && sedanOk() && sedanOpen() ? 'sedan' : 'coupe'; }
  // где машина живёт: открыта — у старта прогулки, через дорогу от кинотеатра (купе и седан рядом — искать по карте не нужно);
  // под чехлом — у кинотеатра, как в серии 1. Места у гаража «Круглые фары» — для выбора машины у гаража (garageSpot)
  function carHome(w, kind) {
    const sp = w.L.spawnPoints || {};
    if ((standOpen() || unlock('car').ok) && sp.carStart) return (kind === 'sedan' && sp.sedanStart) || sp.carStart;
    if (!standOpen() && unlock('car').ok && sp.car) return (kind === 'sedan' && sp.sedan) || sp.car;
    return sp.carStory || w.MAP.carSpawn;
  }
  function garageSpot(w, kind) { const sp = w.L.spawnPoints || {}; return (kind === 'sedan' && sp.sedan) || sp.car || null; }
  // машина не проезжает сквозь вторую, что стоит рядом (обе у старта): корпус соседки + полкорпуса своей вбок, запас по длине
  const CAR_HALF = { coupe: [0.95, 2.15], sedan: [1.0, 2.55] };
  function carFree(w, kind, x, z) {
    if (!S || S.inTrip) return true;
    for (const k in w.cars) {
      if (k === kind) continue;
      const c = w.cars[k].car; if (!c.root.visible) continue;
      const dx = x - c.S.x, dz = z - c.S.z, co = Math.cos(c.S.ry), si = Math.sin(c.S.ry), d = c.dims, h = d && d.halfW ? [d.halfW, d.halfL] : CAR_HALF[k] || CAR_HALF.coupe;
      if (Math.abs(dx * co - dz * si) < h[0] + 1.1 && Math.abs(dx * si + dz * co) < h[1] + 1.15) return false;
    }
    return true;
  }
  function makeCarKind(w, kind) {
    if (kind !== 'sedan' || !sedanOk()) kind = 'coupe';
    if (w.cars[kind]) return w.cars[kind];
    const H = w.H, scene = w.scene, MAP = w.MAP, L = w.L, csp = carHome(w, kind);
    let car = null, ctl = null, cover = null;
    if (kind === 'sedan') {
      // седан: свой городской контроллер «через двери» (тот же API, что WORLD.Car.create; кот и собачка — через задние двери)
      car = VEHICLES.sedan.makeCar(H, { x: csp.x, z: csp.z, ry: csp.ry, layout: L, lite: w.qKey !== 'high', can: (x, z) => L.drivable(x, z, 0.98) && carFree(w, 'sedan', x, z) });
      scene.add(car.root);
      ctl = VEHICLES.sedan.create({ THREE: T, scene, kit: H, layout: L, car, colliders: MAP.colliders, heightAt: (x, z) => gy(L, x, z) });
      cover = ctl.cover || null;
    } else {
      car = WORLD.makeCar(H, { x: csp.x, z: csp.z, ry: csp.ry, color: WORLD.CAR_COLORS[0][1], vmax: 8, layout: L, can: (x, z) => L.drivable(x, z, 0.78) && carFree(w, 'coupe', x, z) });
      scene.add(car.root);
      if (WORLD.Car && WORLD.makeCarCover) {
        cover = WORLD.makeCarCover(H, car);     // тот же чехол с бантом
        ctl = WORLD.Car.create({ THREE: T, scene, kit: H, layout: L, car, cover, colliders: MAP.colliders });
      } else cover = makeCover(H, car);
    }
    if (ctl) ctl.on('edge', e => { if (S && S.onEdge) S.onEdge(e); });
    if (!car.kind) car.kind = kind;
    if (car.root.userData && !car.root.userData.dn) car.root.userData.dn = 'world';
    if (w.dn) { try { w.dn.attach(car.root); } catch (e) { /* без ночи */ } }
    return (w.cars[kind] = { kind, car, ctl, cover, lamps: [] });
  }
  function placeCar(car, h) {
    Object.assign(car.S, { x: h.x, z: h.z, ry: h.ry || 0, v: 0, steer: 0, stuckT: 0, edgeIn: false });
    if (car.place) car.place(); else { car.root.position.set(h.x, 0, h.z); car.root.rotation.set(0, h.ry || 0, 0); }
  }
  // поставить машину kind в мир (вторую — спрятать «в гараж»); home — на её место у гаража
  function useCar(w, kind, opt = {}) {
    const ent = makeCarKind(w, kind);
    Object.keys(w.cars).forEach(k => { const e = w.cars[k]; if (e !== ent) { e.car.root.visible = false; carLights(w, e, false); } });
    w.car = ent.car; w.carCtl = ent.ctl; w.cover = ent.cover; w.carKind = ent.kind;
    if (opt.home) placeCar(ent.car, carHome(w, ent.kind));
    ent.car.root.visible = true;
    return ent;
  }
  // фары: ореолы DayNight (видны только ночью) и свет фар машины — пока она едет; стоит — фары погашены
  function carLights(w, ent, on) {
    if (!ent) return;
    const c = ent.car;
    if (w.dn) {
      if (ent.lamps.length) { ent.lamps.forEach(id => { try { w.dn.removeLamp(id); } catch (e) { /* уже */ } }); ent.lamps = []; }
      if (on) {
        try {
          const heads = c.lamps && c.lamps.head && c.lamps.head.length ? c.lamps.head : [[0.62, 0.62, 2.05], [-0.62, 0.62, 2.05]];
          heads.forEach(p => ent.lamps.push(w.dn.addLamp(c.body || c.root, { follow: true, offset: Array.isArray(p) ? p : [p.x, p.y, p.z], size: 0.9, color: '#FFF2CC', pool: false })));
        } catch (e) { /* без ореолов */ }
      }
    }
    if (c.setNight) { try { c.setNight(on && w.dn && w.dn.lampsOn() ? 1 : 0); } catch (e) { /* ignore */ } }
  }
  // волна 4: какая машина выбрана — для загрузчика регионов (js/world/regions.js), карты и тестов: 'coupe' | 'sedan'
  WORLD.carChoice = () => (W && W.carKind) || carWanted();
  WORLD.carTitle = k => CAR_TITLE[k || WORLD.carChoice()] || CAR_TITLE.coupe;

  /* =====================================================================
     ЦИКЛ КАДРОВ (один на сессию; работает, только пока идёт прогулка)
     ===================================================================== */
  let S = null;                  // текущая прогулка
  let raf = 0, last = 0, tAll = 0, lastInfo = { calls: 0, tris: 0, shCalls: 0, shTris: 0 }, frames = 0;
  const PERF = { upd: 0, ren: 0 };
  const FT = [];
  // кадр: сначала дальний вид (слой неба: хребты и село на востоке), потом — поверх, с чистой глубиной — город;
  // цвет холста чистится один раз прозрачным (небо — CSS за холстом)
  function renderFrame(w) {
    const r = w.renderer;
    if (!w.far || !w.far.visible) { r.render(w.scene, w.camera); return; }
    const ac = r.autoClear;
    w.far.setNight(w.dn ? Math.max(w.dn.night(), w.dn.glow() * 0.85) : 0);   // окна села зажигаются к вечеру
    r.autoClear = false; r.clear(true, true, true);
    w.far.render(r, w.camera);
    r.clearDepth(); r.render(w.scene, w.camera);
    r.autoClear = ac;
  }
  function loopStart() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(tick); }
  function loopStop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function tick() {
    raf = requestAnimationFrame(tick);
    const w = W, s = S; if (!w || !s || s.finished || document.hidden || w.isLost || w.released) return;
    const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
    tAll += dt;
    try {
      const p0 = performance.now();
      s.update(dt, tAll);
      if (s.finished || S !== s) return;
      if (w.dn) w.dn.update(dt, w.camera);   // день/ночь: после кадра прогулки, до отрисовки
      const p1 = performance.now();
      w.renderer.info.reset(); w.SH.calls = w.SH.tris = 0;
      renderFrame(w);
      PERF.upd += (p1 - p0 - PERF.upd) * 0.1; PERF.ren += (performance.now() - p1 - PERF.ren) * 0.1; frames++;
      lastInfo = { calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles, shCalls: w.SH.calls, shTris: w.SH.tris };
      FT.push(dt); if (FT.length > 240) FT.shift();
      if (s.benchRec) s.benchRec(dt, lastInfo);
    } catch (e) { console.error('world tick', e); if (!s.finished) s.fail('error'); }
  }

  /* =====================================================================
     ПРОГУЛКА: один уличный отрезок (схема o — как у City3D.run)
     ===================================================================== */
  const SAVE_KEYS = ['cinema', 'bureau', 'sweets', 'roof'];
  function walk(o, env = {}) {
    return new Promise(async resolve => {
      const w = W;
      if (S && !S.finished) S.fail('replaced');
      ensureRenderer(w);
      const s = makeSession(w, o, env, resolve);
      S = s;
      try { await s.start(); } catch (e) { console.error('world walk', e); s.fail('error'); }
    });
  }

  function makeSession(w, o, env, resolve) {
    if (o.hero) heroLookSet(w, o.hero);
    const ui = w.ui, cam = w.camera, scene = w.scene, hero = w.hero, cat = w.cat, MAP = w.MAP, L = w.L, doors = w.doors;
    let car = w.car;   // волна 4: машину можно сменить («Ретро-купе» / «Красный седан») — ссылка обновляется в swapCar
    const FREE = !!o.free, FO = FREE ? (typeof o.free === 'object' ? o.free : {}) : null;
    const OW = o.world || null, ow = OW || {};
    const story = !FREE;
    const tgtDoor = story && o.target ? doors.get(o.target) : null;
    const moodRaw = ow.mood !== undefined && ow.mood !== null ? ow.mood : (story ? o.idx : 'free');
    const LI = moodRaw === 'free' || typeof moodRaw !== 'number' ? 3 : clamp(moodRaw | 0, 0, 3);
    const s = {
      o, w, mode: 'walk', finished: false, active: false, busy: false, t0: performance.now(), sideMs: 0, side: [],
      px: 0, pz: 0, vx: 0, vz: 0, ang: 0, faceT: 0, faceLock: null, walking: false, moveT: 0, sitting: null,
      hopT: -1, spinT: -1, waveT: -1, anim: null, moveTo: null, blockT: 0, held: null, heldG: null, sniffT: -1, sniffNext: 6,
      catOn: false, catX: 0, catZ: 0, catAng: 0, catPhase: 0, catWalk: 0, catPin: null, catPinWait: [], catSit: null,
      yaw: PI, dist: 9.5, manualT: 0, tx: 0, tz: 0, camInit: false, pitchK: 0, camOverride: null, camFocus: null,
      // W7: взгляд вверх-вниз пальцем (pitch, рад, + вверх; pitchT — с последнего касания, с) и вид «из-за руля» (ck, ckYaw/ckPitch)
      pitch: 0, pitchT: 99, pitchDeg: 0, ck: null, ckLook: { yaw: 0, pitch: 0 },
      greeted: new Set(), autoGreeted: new Set(), waveN: 0, farT: 0, nudgeT: -1e9, pkBusy: false, spotBusy: false, puddleIn: false,
      fpsT: 0, fpsSamples: [], fpsDone: !!qFixed(), fpsWait: 2, lamps: 0, kioskI: 0, weatherI: 0, coverI: 0, benchRec: null,
      py: 0, floor: 0, mvX: NaN, mvZ: NaN, air: false,   // волна 5 (Move): высота ног (скамейка, ящик, крыша машины), пол под ней, в воздухе
    };
    s.LI = LI;
    // W7 (желание 10): вид «из-за руля» — общий модуль с горами (js/village/drive.js); кнопка 👁 в дуге за рулём (слот s4)
    s.ck = window.VILLAGE && VILLAGE.drive && VILLAGE.drive.cockpit ? VILLAGE.drive.cockpit({ THREE: T, camera: cam, renderer: w.renderer }) : null;
    if (s.ck && !ui.ck && window.HUD && HUD.sbtn) { ui.ck = HUD.sbtn(ui.ui, { slot: 's4', icon: '👁', label: 'Вид из-за руля', cls: 'w-ck' }); ui.ck.classList.add('hidden'); }
    const isLit = k => (FREE ? true : typeof o.isLit === 'function' ? !!o.isLit(k) : false);
    const residentsVis = Object.assign({}, story && !OW ? { hedgehog: false } : {}, ow.residents || {});
    // стенд world.html (не игра, «Замер» автора и проверки): всё открыто; ?debug=1&locks=1 — замки по датам, как в игре
    const STAND = !!env.stand || (!!window.WORLD_STAND && !(DEBUG && QS.get('locks') === '1'));
    const vehicles = ow.vehicles || (STAND ? 'drive' : unlock('car').ok ? 'drive' : 'covered');
    // велосипед: o.world.bike = 'ride' | 'parked' | 'none'; по умолчанию прогулка и стенд — 'ride' (CONFIG.UNLOCK.bike) или 'parked', сюжет — 'none'
    const bikeLock = STAND ? { ok: true, text: '' } : unlock('bike');
    const bikeMode = !w.bike ? 'none' : ow.bike || (FREE || STAND ? (bikeLock.ok ? 'ride' : 'parked') : 'none');
    // собачка-компаньон (CONFIG.UNLOCK.companion): до даты собачки на площадке гладятся, но гулять не зовут
    const compLock = STAND ? { ok: true, text: '' } : unlock('companion');
    // поездка в горы: вместе с машиной (CONFIG.UNLOCK.trip = 'car') и только если есть модули села
    const tripOpen = () => vehicles === 'drive' && (STAND || unlock('trip').ok) && !!(WORLD.Regions && WORLD.Regions.can && WORLD.Regions.can());
    s.tripOpen = tripOpen;
    const lifeCtx = () => ({ hx: s.px, hz: s.pz, ha: s.ang, mode: s.mode, car: car.S, bike: w.bike || null,
      cat: { x: s.catX, z: s.catZ, on: !!s.catOn }, active: s.active, busy: !!(s.busy || s.anim), blocked: blocked(),
      cam, q: w.Q, vis: residentsVis, api, shadows: !!w.Q.shadow, companion: ow.companion });

    /* ---------- двери: что можно открыть ---------- */
    const sideList = Array.isArray(ow.doors) ? ow.doors : [];
    const sideOf = id => sideList.find(d => d.id === id) || null;
    const INT = WORLD.INTERIORS || {};
    const genericOpen = id => {
      const g = INT[id]; if (!g || ow.generic === false || !window.City3D || !City3D.hasRoom || !City3D.hasRoom(id)) return false;
      if (g.opens) { const d = new Date(); const ov = DEBUG && QS.get('wdate'); const now = ov ? new Date(ov + 'T12:00') : d; if (now < new Date(g.opens + 'T00:00')) return false; }
      return true;
    };
    const freeDoorInfo = id => (FREE && FO.doors ? FO.doors.find(d => d.id === id) : null);
    function doorState(d) {
      if (!d) return { open: false };
      if (d.kind === 'filler') return { open: false, text: FILLER_LINES[(Math.abs(Math.round(d.x * 7 + d.z * 3))) % FILLER_LINES.length], label: '' };
      if (d.kind === 'generic') {
        const g = INT[d.id] || {};
        if (genericOpen(d.id)) return { open: true, how: 'generic', label: d.short };
        return { open: false, text: g.opens ? `Откроется ${g.opensText || 'скоро'}. Хозяева расставляют полки.` : 'Здесь пока переучёт. Заходи позже.', label: d.short };
      }
      if (story) {
        if (tgtDoor && d.id === tgtDoor.id) return { open: true, how: 'target', label: d.short };
        const sd = sideOf(d.id);
        if (sd) {
          if (sd.open && typeof ow.onDoor === 'function') return { open: true, how: 'side', label: sd.label || d.short };
          return { open: false, text: sd.closedText || 'Пока закрыто. Сначала — сегодняшнее дело.', label: sd.label || d.short };
        }
        if (d.kind === 'story') return { open: false, text: isLit(d.bkey) ? 'Здесь уже всё выяснили. Смотри, куда ведёт метка.' : 'Закрыто. Сначала — сегодняшнее дело.', label: d.short };
        return { open: false, text: 'Пока закрыто. Сначала — сегодняшнее дело.', label: d.short };
      }
      // прогулка
      const fd = freeDoorInfo(d.id);
      const openList = o.openDoors || (FO.doors ? FO.doors.filter(x => x.open !== false).map(x => x.id) : []);
      if (openList.includes(d.id)) return { open: true, how: typeof ow.onDoor === 'function' ? 'side' : 'free', label: (fd && fd.label) || d.short };
      return { open: false, text: o.closedText || 'Здесь пока закрыто.', label: (fd && fd.label) || d.short };
    }

    /* ---------- точки и находки ---------- */
    // точка «Букет» (сюжет и прогулка присылают координаты прежней тележки): в городе — у прилавка бутика Жу (L.flowerShop)
    const FSH = w.L && w.L.flowerShop;
    const spots = (o.spots || []).filter(sp => sp && sp.id !== 'endL' && sp.id !== 'endR').map(sp => Object.assign({ autoDone: false, used: false }, sp, sp.id === 'flowers' && FSH ? FSH.spot : null));
    const spotMarks = [];
    spots.forEach(sp => {
      if (w.toys.anchors[sp.id]) return;
      // точка без «предмета» на карте (миссии следующих серий): мягкая искорка
      const m = new T.Sprite(new T.SpriteMaterial({ map: sparkTex(), depthWrite: false, transparent: true, fog: false }));
      m.position.set(sp.x, 1.0, sp.z); m.scale.setScalar(0.55); m.renderOrder = 6; scene.add(m); spotMarks.push(m); sp.mark = m;
    });
    const anchorOf = sp => w.toys.anchors[sp.id] || { x: sp.x, y: 1.0, z: sp.z, r: 0.6 };
    const pickups = (o.pickups || []).map((p, i) => {
      const g = new T.Group(); g.position.set(p.x, 0, p.z); scene.add(g);
      const spr = new T.Sprite(new T.SpriteMaterial({ map: findTex(p), transparent: true, depthWrite: false, fog: false }));
      spr.scale.setScalar(0.55); spr.position.y = 0.6; spr.renderOrder = 6; g.add(spr);
      const ring = new T.Mesh(ringGeo(), new T.MeshBasicMaterial({ color: 0xFFD6E2, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = -PI / 2; ring.position.y = 0.03; g.add(ring);
      return { p, g, spr, ring, taken: false, ph: i * 1.3 };
    });

    /* ---------- героиня: предмет в руке ---------- */
    // волна 4: покупки (попкорн, какао, крендель…) держит настоящая рука (слой Interact) — без второго предмета у бедра;
    // букет — как раньше (поза HeroAnim «у груди», понюхать). Без скелета (статуэтка, кукла) — прежний предмет в руке.
    const IA = w.ia || null;
    function iaDrop(keepBouquet) {
      if (!IA) return;
      const cur = IA.holding('L'); if (!cur) return;
      const it = cur.userData && cur.userData.it;
      if (keepBouquet && it && it.name === 'bouquet') return;
      const x = IA.drop('L'); if (x && x.userData && x.userData.it && x.userData.it.def && (x.userData.it.def.parts || x.userData.pfHammer)) x.userData.it.dispose(); else if (x && x.userData && x.userData.pfDispose) x.userData.pfDispose(); else if (x && x.parent) x.parent.remove(x);
    }
    function setHeld(kind, data) {
      if (s.heldG) { if (s.heldG.parent) s.heldG.parent.remove(s.heldG); disposeTree(s.heldG); s.heldG = null; }
      s.held = kind || null; s.nibbleT = 6 + Math.random() * 3;
      // волна 5: пищащий молоточек из «Юлы» — игрушка (не еда): в руке через слой «Бум!» (PlayFight.giveHammer); запомнить в сохранении
      if (kind === 'squeaky_hammer') {
        const cur = IA && IA.holding('L'), isH = cur && cur.userData && (cur.userData.pfHammer || (cur.userData.it && cur.userData.it.name === 'squeaky_hammer'));
        if (cur && !isH) iaDrop(false);
        if (!isH && w.pf) { if (IA && IA.busy()) s.hammerLater = true; else w.pf.giveHammer(); }
        try { if (!wState().hammer) saveWorld({ hammer: 1 }); } catch (e) { /* без сохранения */ }
        return;
      }
      if (IA) {
        const want = kind ? IA_ITEM[kind] : null, cur = IA.holding('L'), curN = cur && cur.userData.it ? cur.userData.it.name : null;
        if (want && curN === want) return;                  // уже в руке: взяла сама (takeFrom / take)
        if (cur) iaDrop(false);
        if (want) {
          if (IA.busy()) { s.iaGiveLater = want; return; }
          const it = IA.give(want, 'L'), d = it && it.userData.it;
          // недоеденное из лавки (City3D.lastHeld): столько же укусов, столько же какао в стаканчике
          if (d && data && data._bites) for (let k = 0; k < data._bites && d.bite && d.bite(); k++) { /* укус */ }
          if (d && data && typeof data._level === 'number' && data._level < 1 && d.setLevel) d.setLevel(data._level);
          return;
        }
      }
      if (!kind) return;
      const g = heldModel(w.H, kind, data);
      g.position.set(0.07, kind === 'bouquet' ? 0.01 : -0.03, 0.08);
      g.rotation.set(kind === 'bouquet' ? 0.22 : 0.1, 0, kind === 'bouquet' ? -0.3 : -0.08);
      if (!hero.rig && !hero.statue) g.position.set(0, -0.05, 0.08);
      hero.arms[0].inner.add(g); s.heldG = g;
      g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    }
    const heroHeadG = () => { if (!s.headG) { s.headG = new T.Group(); hero.head.add(s.headG); } return s.headG; };
    function setHeroOpacity(a) {
      (hero.mats || []).forEach(m => { const want = a < 0.999; if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; } m.opacity = a; });
      const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = a > 0.97;
      if (s.heldG) s.heldG.visible = a > 0.5;
    }

    /* ---------- настоящие руки (волна 4, js/interact.js): корень, звуки, взять / съесть / отпить / погладить ---------- */
    s.iaDy = 0;
    s.iaRoot = (p, yaw) => {   // слой двигает корень (подойти, присесть, сесть) — пишем в переменные прогулки, иначе кадр вернёт старое
      if (s.mode !== 'walk' || s.finished) return;
      s.px = p.x; s.pz = p.z; s.ang = yaw; s.faceT = yaw; s.vx = s.vz = 0;
      const d = p.y - (w.mv ? s.py : gy(L, p.x, p.z)); s.iaDy = Math.abs(d) < 0.004 ? 0 : d;   // на скамейке/ящике — от их верха
    };
    s.iaOn = (n) => {
      const k = { take: 'pop', give: 'pop', bite: 'tap', crunch: 'tap', lick: 'tap', sip: 'pop', pat: 'tap', clap: 'pop', clink: 'chime' }[n];
      if (k) sfx(k);
      if (n === 'take' || n === 'pat') haptic('light');
    };
    const iaBusy = () => !!(IA && IA.busy());
    const iaHeld = () => { const c = IA && IA.holding('L'); return c && c.userData.it ? c.userData.it : null; };
    // кончилось (попкорн, какао, крендель): строка и пустые руки; в прогулке (st.town.h) — тоже пусто, чтобы следующий отрезок не выдал новое
    const bouquetNow = () => { try { const g = G_(), st = g && g.state && g.state(); return st && st.bouquet ? st.bouquet : null; } catch (e) { return null; } };
    function heldDone(kind) {
      const line = HELD_DONE[kind] || HELD_DONE[IA_ITEM[kind]] || '';
      iaDrop(true); s.held = null;
      try { const g = G_(), st = g && g.state && g.state(); if (st && st.town && st.town.h === kind) { st.town.h = null; g.save(); } } catch (e) { /* ignore */ }
      const b = bouquetNow(); if (b) { s.heldData = b; setHeld('bouquet', b); }   // как в прогулке: руки опустели — снова букет
      else { try { if (w.pf && wState().hammer) setHeld('squeaky_hammer'); } catch (e) { /* без молоточка */ } }   // волна 5: или молоточек
      if (line) toast(line, 2800);
    }
    // откусить / отпить один раз (кнопка не нужна: стоя на месте, героиня сама иногда ест, что держит)
    async function iaNibble(idle) {
      const it = iaHeld(); if (!it || iaBusy() || !s.held) return;
      const kind = s.held;
      if (idle) { s.iaIdle = true; const done = () => { s.iaIdle = false; }; const pr = (it.def && it.def.drink) ? IA.play('drink') : IA.play('eat'); pr.then(done, done); await pr; const it2 = iaHeld(); if (s.held === kind && (!it2 || (it2.def.drink ? it2.level <= 0.05 : ((it2.def.level && it2.level < 0.15) || (!it2.def.level && it2.left && it2.left() <= 0))))) heldDone(kind); return; }
      if (it.def && it.def.drink) { await IA.play('drink'); const it2 = iaHeld(); if (!it2 || it2.level <= 0.05) heldDone(kind); return; }
      if (it.def && (it.def.bite || it.def.pick)) { await IA.play('eat'); const it2 = iaHeld(); if (!it2 || (it2.def.level && it2.level < 0.15) || (!it2.def.level && it2.left && it2.left() <= 0)) heldDone(kind); }
    }
    // взять покупку из лап жителя / с прилавка (тап «Купить» у жителя города): { item, from: { root, color, height, meetY }, approach }
    function iaTake(o2) {
      if (!IA || s.mode !== 'walk' || s.sitting) return null;
      if (iaBusy()) { if (!s.iaIdle) return null; IA.cancel(); s.iaIdle = false; }
      setHeld(null);   // рука пустая: букет или прежняя покупка — «в сумку» (букет вернётся, когда доест)
      const op = o2.from ? Object.assign({ item: o2.item, from: o2.from }, o2.approach === false ? { approach: false } : {}) : { item: o2.item };
      return IA.play(o2.from ? 'takeFrom' : 'take', op).then(r => { const it = iaHeld(); if (it) { s.held = o2.kind || it.name; s.nibbleT = 4; } return r; });
    }
    // погладить зверька по-настоящему: присесть, ладонь на макушку, три поглаживания (residents.js → life.pet)
    function iaPet(n, opt = {}) {
      if (!IA || !n || !n.root || s.mode !== 'walk' || s.sitting) return null;
      if (iaBusy()) { if (!s.iaIdle) return null; IA.cancel(); s.iaIdle = false; }   // «сама ела» — сначала погладить
      // макушка: кость головы зверька (запечённые зверята actors.js — I.B.head), у жителей-кукол — их группа головы; иначе — высота headY
      const I = n.I || {}, hb = I.B && I.B.head, nh = I.npc && I.npc.head;
      const head = hb ? { obj: hb, off: [0, 0.1, 0.01] } : nh ? { obj: nh, off: [0, 0.14, 0.02] } : null;
      // низкая голова (такса, котик) — подойти ближе: иначе в приседе ладонь не достаёт до макушки
      let hy = n.headY || 0.42; try { if (head) { head.obj.updateWorldMatrix(true, false); hy = tmpV.setFromMatrixPosition(head.obj.matrixWorld).y - (n.root.position.y || 0); } } catch (e) { /* по headY */ }
      const dist = hy < 0.5 ? 0.3 : n.small ? 0.32 : 0.4;
      return IA.play('pet', Object.assign({ target: n.root, dist, onPet: opt.onPet }, head ? { head } : { headY: n.headY || 0.42 }));
    }
    s.iaNibble = iaNibble;

    /* ---------- облачка и голоса ---------- */
    const tmpV = new T.Vector3();
    const heroObj = { getPos: v => v.set(s.px, 2.15 + (w.mv ? s.py : 0) + (hero.body.position.y || 0), s.pz) };
    const catObj = { getPos: v => v.set(s.catX, 0.85, s.catZ) };
    const carObj = { getPos: v => v.set(car.S.x, 2.2, car.S.z) };
    const bikeObj = { getPos: v => (w.bike ? v.set(w.bike.pos.x, 1.9, w.bike.pos.z) : v.set(s.px, 1.9, s.pz)) };
    const npcObj = n => (n.obj || (n.obj = { getPos: v => v.set(n.x, n.headY * (n.root.scale.y || 1) + 0.55, n.z) }));
    const beeObj = { getPos: v => v.set(w.toys.bee.position.x, w.toys.bee.position.y + 0.45, w.toys.bee.position.z) };
    function speak(who, text, ms, title) {
      if (!text) return;
      const g = G_();
      const obj = who === 'hero' ? heroObj : who === 'cat' ? catObj : who === 'bee' ? beeObj : who === 'car' ? carObj : who === 'bike' ? bikeObj : (() => { const n = w.npcs.find(q => q.id === who); return n ? npcObj(n) : heroObj; })();
      ui.say(obj, (title ? `<b>${esc(title)}</b>` : '') + `<span>${esc(text)}</span>`, ms || Math.max(2600, Math.min(5200, 1400 + text.length * 45)), who === 'hero' ? 'hero' : '');
      // голос: запись (voice/), иначе мягкий «лепет» по гласным — как облачка улицы
      if (g && g.voiceLine && who !== 'car' && who !== 'bike') {
        try { const v = g.voiceLine(who === 'hero' ? 'hero' : who, text, { mode: 'bubble' }); for (let i = 0; i < text.length; i++) setTimeout(() => { if (!s.finished) v(i); }, 120 + i * 38); } catch (e) { /* без голоса */ }
      }
    }
    function greet(n, auto) {
      const now = performance.now() / 1000;
      if (auto && (s.autoGreeted.has(n.id) || now - n.greetT < 25)) return;
      if (auto) s.autoGreeted.add(n.id);
      n.greetT = now;
      const L = (WORLD.RESIDENT_LINES || {})[n.id] || [];
      const line = L.length ? L[n.li % L.length] : null; n.li++;
      n.hop(); n.faceHero = 2.5;
      if (!line) return;
      // мимоходом — облачко с голосом; сама подошла или нажала «Поздороваться» — окно диалога (имя, значок, голос)
      if (auto || !G_() || !G_().say) { speak(n.id, line.text, 3800, (WORLD.RESIDENT_NAMES || {})[n.id]); return; }
      s.faceLock = Math.atan2(n.x - s.px, n.z - s.pz); s.faceLockT = 1e9; n.faceHero = 1e9;
      const talk = w.life ? w.life.talk(n) : null;   // жизнь: диалог из 2–3 реплик, по кругу
      runBusy(async () => { await G_().say(talk || { who: n.id, text: line.text }); }).then(() => { s.faceLock = null; s.faceLockT = 0; n.faceHero = 1.5; });
    }
    function nearestNpc(maxD, noCat) {
      let best = null, bd = maxD;
      w.npcs.forEach(n => { if (!n.root.visible) return; const d = Math.hypot(n.x - s.px, n.z - s.pz); if (d < bd) { bd = d; best = { id: n.id, n }; } });
      if ((s.catOn || s.catSit) && !noCat) { const d = Math.hypot(s.catX - s.px, s.catZ - s.pz); if (d < bd) { bd = d; best = { id: 'cat', n: null }; } }
      return best;
    }
    function doWave() {
      if (!s.active || s.finished || blocked() || s.waveT >= 0 || s.busy) return;
      s.waveT = 0; haptic('light');
      ui.wave.classList.remove('go'); void ui.wave.offsetWidth; ui.wave.classList.add('go');
      const nn = nearestNpc(3.4), g = G_();
      const r = g && g.wave ? g.wave({ where: 'world', npc: nn ? nn.id : null }) : { first: false, hi: 'Hi!', reply: null, name: '' };
      const intro = r.first || (nn && !s.greeted.has(nn.id));
      speak('hero', intro ? r.hi : HI_AGAIN[s.waveN++ % HI_AGAIN.length], 2600);
      if (!nn) return;
      s.greeted.add(nn.id);
      const Lr = nn.id === 'cat' ? WAVE_REPLY.cat : WAVE_REPLY;
      let rep = typeof r.reply === 'string' ? r.reply : null;
      if (!rep) { const useName = intro && r.name && (g && g.nameOk ? g.nameOk() : true), list = useName ? Lr.name : Lr.plain; rep = list[s.waveN % list.length].replace('{name}', r.name || ''); }
      setTimeout(() => {
        if (s.finished) return;
        if (nn.n) { nn.n.hop(); nn.n.faceHero = 2.5; }
        speak(nn.id, rep, 2600);
      }, 950);
    }

    /* ---------- ввод ---------- */
    const keys = {};
    const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyQ: 'q', KeyE: 'e' };
    // HUD v2: джойстик (HUD.joystick, ui.joyCtl) — зона касания: нижняя половина левее дуги кнопок; центр — сам палец (на касании
    // стоит), кружок встаёт под него, отпустила — уезжает на место. Выше середины и справа — камера; короткий тап — «идти туда»
    // (кроме тапа по самому кружку покоя — HUD.joyGuard)
    const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0, used: false, late: false };
    const looks = new Map(); let pinch0 = null;
    const isUI = el => !!(el && el.closest && el.closest('button, .w-case, .stats, .modal, .wmm-wrap, [data-hud-slot]:not(.hud-joy)'));
    const joyZone = (x, y, r) => (window.HUD ? HUD.joyZone(x, y, r.width, r.height) : x < r.width * 0.5);
    const canInput = () => s.active && !s.finished && !s.busy && !blocked() && !s.anim;
    const onKeyDown = e => {
      if (s.finished || blocked()) return;
      if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); if (s.moveTo && !s.moveTo.script) s.moveTo = null; return; }
      // волна 5: пробел — прыжок, когда рядом нет действия (у двери, жителя, места — по-прежнему действие); Shift — бег, пока держишь
      if (e.code === 'Space' && w.mv && s.mode === 'walk' && !s.sitting && !s.actLbl && canInput()) { if (e.defaultPrevented) return; e.preventDefault(); if (!e.repeat) { if (iaBusy()) iaFree() || IA.cancel(); w.mv.jump(); } return; }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && w.mv && s.mode === 'walk') { w.mv.holdRun(true); return; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') { if (e.defaultPrevented) return; e.preventDefault(); if (!e.repeat) doAction(); }
      if (e.code === 'KeyH') { if (s.mode === 'drive') doHorn(); else if (s.mode === 'ride') { if (w.bike) w.bike.ring(); } else doWave(); }
    };
    const onKeyUp = e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && w.mv) w.mv.holdRun(false); };
    const joyEnd = () => { joy.id = null; joy.x = joy.y = 0; if (ui.joyCtl) ui.joyCtl.end(); };
    const onBlur = () => { Object.keys(keys).forEach(k => { keys[k] = false; }); joyEnd(); if (w.mv) w.mv.holdRun(false); };
    // раз в кадр (s.update): сила и курс джойстика (HUD.joystick.frame — кривая, сглаживание, удержание курса) → joy.x/y;
    // бег — палец за краем кружка держит одно направление 0,3 с (HUD.JOY), пока держит; назад внутрь хода или отпустила — шаг.
    // Бег — Move.holdRun (как Shift), на старте — лёгкий отклик
    const joyRun = ok => {
      const J = ui.joyCtl;
      const on = !!(J && J.frame && J.frame(ok && joy.id !== null && !!w.mv));
      if (J && joy.id !== null && J.active) { joy.x = J.x; joy.y = J.y; }
      if (on !== !!s.joyRun) { s.joyRun = on; if (w.mv) w.mv.holdRun(on); if (on) haptic('light'); }
      else if (on && !w.mv.run) w.mv.holdRun(true);
    };
    const onDown = e => {
      if (isUI(e.target) || s.finished || s.benching) return;
      const r = w.root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      // за рулём с кнопками (HUD.driveCtl) джойстика нет: касание мимо кнопок — камера
      if (joyZone(x, y, r) && joy.id === null && e.pointerType !== 'mouse' && !(ui.driveCtl && ui.driveCtl.vis)) {
        joy.id = e.pointerId; joy.x = joy.y = 0; joy.late = false;
        joy.x0 = x; joy.y0 = y; joy.t0 = performance.now(); joy.moved = 0;
        if (canInput() && ui.joyCtl) { const c = ui.joyCtl.begin(x, y); joy.cx = c.cx; joy.cy = c.cy; ui.joyCtl.show(true); }
        else { joy.cx = x; joy.cy = y; }
      } else {
        looks.set(e.pointerId, { x, y, x0: x, y0: y, t0: performance.now(), moved: 0 });
        if (looks.size === 2) { const [a, b] = [...looks.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: s.dist }; }
      }
      try { w.root.setPointerCapture(e.pointerId); } catch (x2) { /* старые браузеры */ }
    };
    const onMove = e => {
      const r = w.root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (e.pointerId === joy.id) {
        joy.moved = Math.max(joy.moved, Math.hypot(x - joy.x0, y - joy.y0));
        const J = ui.joyCtl;
        // палец лёг, пока ввод был закрыт (диалог, шторка, руки заняты), — джойстик начинается отсюда: без рывка и без тапа
        if (J && !J.active && canInput()) { const c = J.begin(x, y); joy.cx = c.cx; joy.cy = c.cy; joy.late = true; J.show(true); }
        else if (J && J.active) { const v = J.drag(x, y); if (v.m > 0 && s.moveTo && !s.moveTo.script) s.moveTo = null; }
        return;
      }
      const p = looks.get(e.pointerId); if (!p) return;
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y; p.moved += Math.abs(dx) + Math.abs(dy);
      if (looks.size >= 2 && pinch0) { const [a, b] = [...looks.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); s.dist = clamp(pinch0.dist * pinch0.d / Math.max(20, d), 6, 15); s.manualT = 4; return; }
      // W7 (желание 3): палец вверх — взгляд вверх (до неба), вниз — сверху; в виде «из-за руля» — повернуть голову
      if (p.moved > 6 && !s.anim && s.ck && s.ck.active) { s.ckLook.yaw = clamp(s.ckLook.yaw - dx * 0.006, -1.3, 1.3); s.ckLook.pitch = clamp(s.ckLook.pitch - dy * 0.005, -0.5, 0.75); s.manualT = 4; s.pitchT = 0; }
      else if (p.moved > 6 && !s.anim) { s.yaw -= dx * 0.0085; s.manualT = 4; s.pitch = clamp(s.pitch - dy * 0.0045, -1.2, 1.6); s.pitchT = 0; }
    };
    const onUp = e => {
      if (e.pointerId === joy.id) {
        const late = joy.late;
        joyEnd();
        if (e.type === 'pointerup' && !late && joy.moved < 10 && performance.now() - joy.t0 < 320) {
          // тап по кружку покоя — промах по джойстику, а не «идти туда»
          const r = w.root.getBoundingClientRect();
          if (!(window.HUD && HUD.joyGuard && HUD.joyGuard(joy.x0, joy.y0, r.width, r.height))) onTap(joy.x0, joy.y0);
        }
        return;
      }
      const p = looks.get(e.pointerId); if (!p) return;
      looks.delete(e.pointerId); if (looks.size < 2) pinch0 = null;
      if (p.moved < 10 && performance.now() - p.t0 < 350 && e.type === 'pointerup') onTap(p.x0, p.y0);
    };
    const onWheel = e => { s.dist = clamp(s.dist + e.deltaY * 0.01, 6, 15); s.manualT = 4; e.preventDefault(); };
    const onCtx = e => e.preventDefault();
    // главная кнопка P: действие рядом; без действия — «👋 Помахать» (бывшая отдельная кнопка)
    const onAct = e => { e.stopPropagation(); if (s.actWave) doWave(); else doAction(); };
    // тап по раскрытой карточке дела — камера показывает дверь цели (как раньше тап по карточке)
    const onCase = () => { const card = s.card; if (!card || card.tap === 'none' || s.finished) return; const d = card.door ? doors.get(card.door) : tgtDoor; if (d) focusDoor(d.id, 1300); haptic('light'); };
    const onHorn = e => { e.stopPropagation(); doHorn(); };
    const onCk = e => { e.stopPropagation(); haptic('light'); ckSet(!(s.ck && s.ck.active)); };
    const onBell = e => { e.stopPropagation(); if (s.mode === 'ride' && w.bike) w.bike.ring(); };
    const onColor = e => { e.stopPropagation(); w.carColor = (w.carColor + 1) % WORLD.CAR_COLORS.length; car.setColor(WORLD.CAR_COLORS[w.carColor][1]); toast('Цвет: ' + WORLD.CAR_COLORS[w.carColor][0], 1400, { replace: true }); };
    const onReset = e => { e.stopPropagation(); car.reset(L.loopPath); ui.show(ui.reset, false); };
    const onSwap = e => { e.stopPropagation(); haptic('light'); pickCar(); };
    const onResize = () => { if (w.root.isConnected) resizeTo(w, w.root.clientWidth || 390, w.root.clientHeight || 844); };
    function bindInput(on) {
      const f = on ? 'addEventListener' : 'removeEventListener';
      window[f]('keydown', onKeyDown); window[f]('keyup', onKeyUp); window[f]('blur', onBlur); window[f]('resize', onResize);
      w.root[f]('pointerdown', onDown); w.root[f]('pointermove', onMove); w.root[f]('pointerup', onUp); w.root[f]('pointercancel', onUp);
      w.root[f]('wheel', onWheel, { passive: false }); w.root[f]('contextmenu', onCtx);
      ui.act[f]('click', onAct); ui.onCaseTap = on ? onCase : null;
      ui.horn[f]('click', onHorn); ui.color[f]('click', onColor); ui.reset[f]('click', onReset);
      if (ui.ck) ui.ck[f]('click', onCk);
      if (ui.bell) ui.bell[f]('click', onBell);
      if (ui.swap) ui.swap[f]('click', onSwap);
      if (!on) onBlur();
    }

    /* ---------- тап по миру ---------- */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane0 = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
    function onTap(x, y) {
      // на велосипеде: тап по двери — слезть и войти
      if (canInput() && s.mode === 'ride' && w.bike) { const r = w.root.getBoundingClientRect(); ndc.set(x / r.width * 2 - 1, -(y / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const dh = doors.hit(ray.ray, T); if (dh) w.bike.dismount().then(() => { if (!s.finished && s.mode === 'walk') goDoor(dh.door); }); return; }
      if (!canInput() || s.mode !== 'walk' || !iaFree()) return;
      if (w.mv && (s.air || w.mv.busy())) return;   // волна 5: в прыжке/кувырке тап не считается
      const r = w.root.getBoundingClientRect();
      ndc.set(x / r.width * 2 - 1, -(y / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      const R = ray.ray, cands = [];
      const consider = (kind, ref, cx, cy, cz, rad) => { tmpV.set(cx, cy, cz); const d2 = R.distanceSqToPoint(tmpV); if (d2 < rad * rad) cands.push({ kind, ref, t: tmpV.distanceTo(cam.position) }); };
      w.npcs.forEach(n => { if (n.root.visible) consider('npc', n, n.x, 0.6, n.z, 0.75); });
      if (s.catOn || s.catSit) consider('cat', null, s.catX, 0.3, s.catZ, 0.55);
      if (car.root.visible) consider('car', null, car.S.x, 0.6, car.S.z, 1.6);
      { const e2 = spare(); if (e2) consider('spare', e2, e2.car.S.x, 0.6, e2.car.S.z, 1.6); }
      if (w.bike && bikeMode !== 'none' && !w.bike.mounted) consider('bike', null, w.bike.pos.x, 0.6, w.bike.pos.z, 0.9);
      spots.forEach(sp => { const a = anchorOf(sp); consider('spot', sp, a.x, a.y, a.z, a.r); });
      pickups.forEach(pk => { if (!pk.taken) consider('pick', pk, pk.p.x, 0.6, pk.p.z, 0.6); });
      const sp0 = w.toys.secretPos(); if (sp0) consider('secret', null, sp0.x, sp0.y, sp0.z, 0.45);
      if (story && !spots.find(q => q.id === 'kiosk')) consider('kiosk', null, 9.6, 1.1, -0.9, 1.0);
      if (story && !spots.find(q => q.id === 'weather')) consider('weather', null, 3.15, 1.35, -1.4, 0.7);
      if (w.life) { const lh = w.life.hit(R, cam.position); if (lh) cands.push(lh); }   // собачка-компаньон (её нет в w.npcs)
      cands.sort((a, b) => a.t - b.t);
      const c = cands[0];
      const dh = doors.hit(R, T);
      if (c && (!dh || c.t < dh.dist + 0.5)) { tapThing(c, x, y); return; }
      if (dh) { goDoor(dh.door); return; }
      plane0.constant = -gy(L, s.px, s.pz);   // на террасе холма — плоскость на высоте террасы (со скамейки/ящика — земля)
      if (R.intersectPlane(plane0, hit)) { s.moveTo = { x: hit.x, z: hit.z, stop: 0.2 }; s.blockT = 0; spark(x, y, 4); }
    }
    function spark(x, y, n) { const g = G_(); if (!g) return; const appR = g.app.getBoundingClientRect(), rr = w.root.getBoundingClientRect(); g.sparkle(x + rr.left - appR.left, y + rr.top - appR.top, { kind: 'heart', n: n || 5, dist: 30 }); }
    function tapThing(c, x, y) {
      haptic('light');
      if (c.kind === 'life') { const m = c.ref; if (Math.hypot(m.x - s.px, m.z - s.pz) < 2.4) runBusy(() => w.life.tap(m)); else s.moveTo = { x: m.x, z: m.z, stop: 1.2, life: m }; return; }
      if (c.kind === 'bike') { const m = w.bike.mountPoint(); s.moveTo = { x: m.x, z: m.z, stop: 0.35, bike: true }; return; }
      if (c.kind === 'npc') { const n = c.ref; if (Math.hypot(n.x - s.px, n.z - s.pz) < 2.4) greet(n); else s.moveTo = { x: n.x, z: n.z, stop: 1.7, npc: n }; return; }
      if (c.kind === 'cat') {
        if (FREE && FO.catAt && !o.catHelper && o.onNpc) { runBusy(() => o.onNpc('cat', api)); return; }
        purr(); return;
      }
      if (c.kind === 'car') { s.moveTo = { x: car.S.x, z: car.S.z, stop: 2.3, car: true }; return; }
      if (c.kind === 'spare') { s.moveTo = { x: c.ref.car.S.x, z: c.ref.car.S.z, stop: 2.3, spare: true }; return; }
      if (c.kind === 'spot') { const sp = c.ref; standUp(); if (Math.hypot(s.px - sp.x, s.pz - sp.z) < 1.4) useSpot(sp); else s.moveTo = { x: sp.x, z: sp.z, stop: 0.25, spot: sp }; return; }
      if (c.kind === 'pick') { const pk = c.ref; if (Math.hypot(s.px - pk.p.x, s.pz - pk.p.z) < 1.2) collect(pk); else s.moveTo = { x: pk.p.x, z: pk.p.z, stop: 0.3 }; return; }
      if (c.kind === 'secret') { w.toys.setSecret(false); spark(x, y, 10); if (o.onSecret) runBusy(() => o.onSecret()); return; }
      if (c.kind === 'kiosk') { const Ls = o.headlines && o.headlines.length ? o.headlines : o.headline ? [o.headline] : []; if (Ls.length) toast(Ls[s.kioskI++ % Ls.length], 3400); return; }
      if (c.kind === 'weather') { const Ls = o.weatherLines && o.weatherLines.length ? o.weatherLines : o.weatherText ? [o.weatherText] : []; if (Ls.length) toast(Ls[s.weatherI++ % Ls.length], 3400); }
    }
    async function runBusy(fn) {
      if (s.spotBusy) return; s.spotBusy = true;
      try { await fn(); } catch (e) { /* не ломаем прогулку */ }
      s.spotBusy = false;
    }
    async function useSpot(sp) {
      if (s.spotBusy || !sp || s.finished) return;
      s.moveTo = null; sp.used = true;
      await runBusy(() => (o.onSpot ? o.onSpot(sp.id, api) : null));
    }
    async function collect(pk) {
      if (pk.taken || s.pkBusy) return;
      pk.taken = true; s.pkBusy = true;
      haptic('success'); sfx('sticker'); s.hopT = 0;
      const sc = toScreen(pk.p.x, 0.6, pk.p.z); const g = G_(); if (g) g.sparkle(sc.x, sc.y, { kind: 'heart', n: 10, dist: 60 });
      const from = pk.g.position.clone(), t0 = performance.now();
      await new Promise(r => { const st = () => { const k = Math.min(1, (performance.now() - t0) / 420); pk.g.position.set(from.x + (s.px - from.x) * k, Math.sin(k * PI) * 0.6, from.z + (s.pz - from.z) * k); pk.g.scale.setScalar(1 - k * 0.85); if (k < 1 && !s.finished) requestAnimationFrame(st); else r(); }; st(); });
      scene.remove(pk.g);
      if (pk.p.held) setHeld(pk.p.kind);
      try { if (o.onPickup) await o.onPickup(pk.p.id, api); } catch (e) { /* не ломаем прогулку */ }
      s.pkBusy = false;
    }
    function purr() { s.catHop = 0; sfx('purr'); speak('cat', ['Мур.', 'Мяу. Это «привет».'][s.waveN++ % 2], 1800); }

    /* ---------- двери ---------- */
    function goDoor(d) {
      haptic('light');
      if (Math.hypot(s.px - d.ax, s.pz - d.az) < 1.2) { tryDoor(d); return; }
      s.moveTo = { x: d.ax, z: d.az, stop: 0.3, door: d };
    }
    function tryDoor(d) {
      // пока идёт реплика или находка, дверь ждёт: войти сразу после (иначе комната откроется поверх диалога)
      if (blocked() || s.pkBusy || s.spotBusy) { s.moveTo = { x: d.ax, z: d.az, stop: 1.2, door: d, wp: [] }; return; }
      const st = doorState(d);
      if (!st.open) { haptic('light'); toast(st.text || 'Здесь пока закрыто.', 2200); return; }
      if (st.how === 'target') { emit('world:door', { id: d.id, kind: d.kind, side: false }); enter(d, () => finish(undefined, 'door')); return; }
      if (st.how === 'free') { emit('world:door', { id: d.id, kind: d.kind, side: false }); enter(d, () => { o.target = d.id; finish({ door: d.id }, 'door'); }); return; }
      if (st.how === 'side') { emit('world:door', { id: d.id, kind: d.kind, side: true }); enter(d, () => sideVisit(d, () => ow.onDoor(d.id, api))); return; }
      if (st.how === 'generic') {
        const first = !hasGeneric(d.id); emit('world:generic', { id: d.id, first }); emit('world:door', { id: d.id, kind: 'generic', side: true });
        enter(d, () => sideVisit(d, () => (WORLD.visitShop ? WORLD.visitShop(d.id, { hero: o.hero, catHelper: !!(s.catOn && !s.catSit), catSweater: !!o.catSweater, held: s.held ? { kind: s.held, data: s.heldData } : null, first }) : null), r => {
          markGeneric(d.id);
          // волна 4: купленное в лавке (крендель, какао) выходит с ней на улицу; допила/доела внутри — руки пустые
          if (r && typeof r === 'object' && 'held' in r) { const h = r.held; if (!h) { if (s.held && s.held !== 'bouquet') { const b = bouquetNow(); s.heldData = b; setHeld(b ? 'bouquet' : null, b); } } else if (h.kind !== s.held) { s.heldData = h.data; setHeld(h.kind, h.data); } }
        }));
      }
    }
    const doorChime = k => { let h = 0; String(k || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return [1046.5, 1174.66, 1318.5, 1568, 1760][h % 5]; };
    function enter(d, then) {
      if (s.anim || s.finished) return;
      haptic('medium'); sfx('door'); sfx('chime', { f: doorChime(d.id) });
      standUp(); s.moveTo = null; s.busy = true; w.root.classList.add('busy');
      const x0 = s.px, z0 = s.pz, tx = d.x + d.nx * 0.08, tz = d.z + d.nz * 0.08, a0 = s.ang, aT = Math.atan2(-d.nx, -d.nz);
      s.anim = { t: 0, dur: 0.95, tick(k) {
        s.ang = a0 + angDiff(aT, a0) * Math.min(1, k * 3);
        if (k > 0.2) { const kk = (k - 0.2) / 0.8; s.px = x0 + (tx - x0) * kk; s.pz = z0 + (tz - z0) * kk; }
        s.forceWalk = k > 0.2;
        if (k > 0.55) setHeroOpacity(1 - (k - 0.55) / 0.45);
      }, done() { s.anim = null; s.forceWalk = false; then(); } };
    }
    // боковой визит: город на паузе, ждёт промис, потом героиня выходит из той же двери
    async function sideVisit(d, fn, after) {
      const t0 = performance.now();
      s.paused = true; loopStop(); bindInput(false); ui.sayClear(); w5Off();
      if (ui.driveCtl) ui.driveCtl.show(false);   // город на паузе: кнопки руля прячем (вернётся — покажет updUI)
      // слабый телефон: на время комнаты отпустить видеокарту (§5.3), при возврате сцена загрузится сама
      try { if (window.WorldHub && WorldHub._lowMem && WorldHub._lowMem()) release(); } catch (e) { /* ignore */ }
      let r = null;
      try { r = await fn(); } catch (e) { console.warn('world side', d.id, e); }
      const ms = performance.now() - t0; s.sideMs += ms; s.side.push(d.id); if (env.onSide) env.onSide(d.id, ms);
      if (after) try { after(r); } catch (e) { /* ignore */ }
      if (s.finished) return;
      const g = G_(); if (g && g.untilNotSkipping) { try { await g.untilNotSkipping(); } catch (e) { /* ignore */ } }
      if (s.finished) return;
      ensureRenderer(w);
      host();
      placeAtDoor(d);
      setHeroOpacity(1);
      s.paused = false; s.busy = false; w.root.classList.remove('busy');
      bindInput(true); loopStart();
    }

    /* ---------- размещение ---------- */
    // стартовая точка серии и прогулки (spawn 'start'): у бордюра Октябрьской, лицом на восток; pitch — взгляд чуть выше.
    // x −8,2 и камера чуть левее востока (yaw): в первом кадре слева — бутик Жу и кинотеатр с меткой, впереди указатель, село
    const START = { x: -8.2, z: 1.9, pitch: 0.16, face: 1.42, yaw: PI / 2 + 0.1 };
    function placeAt(x, z, ang, yaw) {
      s.px = x; s.pz = z; s.vx = s.vz = 0; s.ang = ang; s.faceT = ang; s.yaw = yaw; s.tx = x; s.tz = z; s.camInit = false; s.manualT = 0;
      s.catX = x - Math.sin(ang) * 0.9 + Math.cos(ang) * 0.6; s.catZ = z - Math.cos(ang) * 0.9 - Math.sin(ang) * 0.6;
      hero.root.position.set(x, gy(L, x, z), z); hero.root.rotation.y = ang; s.ty = gy(L, x, z);
      s.py = s.floor = gy(L, x, z); s.air = false;
      if (w.mv) { w.mv.teleport({ x, z }, ang); s.mvX = x; s.mvZ = z; s.py = s.floor = w.mv.state.pos.y; }
      if (hero.rig) hero.rig.prev = null;
      s.detForce = true; s.distDirty = true;   // мелочь фасадов и расстояние в карточке — сразу, а не через 5 кадров
    }
    function placeAtDoor(d) { const yawOut = Math.atan2(d.nx, d.nz); placeAt(d.ax + d.nx * 0.55, d.az + d.nz * 0.55, yawOut, yawOut + PI); }
    function spawn() {
      let sp = ow.spawn !== undefined ? ow.spawn : null;
      if (sp === null || sp === undefined) sp = story ? (o.again && o.target ? o.target : o.justLit || 'start') : (FO.spawnAt || o.spawnAt || 'start');
      if (sp && typeof sp === 'object') { placeAt(sp.x, sp.z, (sp.yaw || 0) + PI, sp.yaw !== undefined ? sp.yaw : PI); return; }
      const d = sp && sp !== 'start' ? doors.get(sp) : null;
      if (d) { placeAtDoor(d); return; }
      // старт (желание автора): героиня у дороги, смотрит вдоль Октябрьской на восток — впереди указатель выезда,
      // за домами на горизонте хребты и село (дальний вид). Камера держит кадр, взгляд чуть выше обычного, пока игрок
      // не пошёл или не повёл камеру сам (updCamera: s.introCam); кинотеатр — за спиной слева, к нему ведёт шеврон
      placeAt(START.x, START.z, PI / 2, START.yaw);
      s.introCam = true; s.manualT = 1e9; s.pitch = START.pitch; s.pitchT = 0;
      s.faceLock = START.face; s.faceLockT = 1e9;   // стоя героиня обычно смотрит в камеру — на старте смотрит на дорогу и указатель
    }

    /* ---------- экран-хозяин: G.show + корень города ---------- */
    function host() {
      const g = G_();
      let scr;
      if (env.host) scr = env.host();
      else if (g) scr = g.show('<div class="w-host" style="position:absolute;inset:0"></div>', 'street street3d world3d');
      const box = scr ? (scr.querySelector('.w-host') || scr) : document.body;
      box.appendChild(w.root);
      w.root.dataset.idx = LI;
      w.root.style.background = SKY3D[s.lookI !== undefined ? s.lookI : LI];
      if (g) {
        if (FREE) g.setHud({ label: o.hudLabel, onExit: () => toMenu(), exitText: FO.exitText || '← в меню', exitPlace: 'menu', menuSub: FO.menuSub });
        else g.setHud({ label: o.hudLabel, menuSub: o.menuSub });
        menuItems();
        ui.setCase(s.card); s.distDirty = true; s.wpKey = '';
        try { g.tgHeader && g.tgHeader('#FFF4EC'); } catch (e) { /* ignore */ }
      }
      resizeTo(w, w.root.clientWidth || 390, w.root.clientHeight || 844);
      s.screen = scr;
    }

    /* ---------- настроение, дома, метки, карточка ---------- */
    const _c = new T.Color();
    function applyLook(A, B, e) {
      w.hemi.color.set(A.sky).lerp(_c.set(B.sky), e); w.hemi.groundColor.set(A.gnd).lerp(_c.set(B.gnd), e); w.hemi.intensity = A.hi + (B.hi - A.hi) * e;
      w.sun.color.set(A.sun).lerp(_c.set(B.sun), e); w.sun.intensity = A.si + (B.si - A.si) * e;
      s.off = [0, 1, 2].map(k => A.off[k] + (B.off[k] - A.off[k]) * e);
    }
    function setMood(li, from) {
      const A = LOOKS[from !== undefined ? from : li], B = LOOKS[li];
      applyLook(A, B, 0);
      w.scene.fog.color.set(FOGC[from !== undefined ? from : li]);
      w.H.RIM.col.value.set(RIMS[li][0]); w.H.RIM.str.value = RIMS[li][1];
      w.H.MOOD.uSat.value = SAT[from !== undefined ? from : li];
      s.lookI = from !== undefined ? from : li;
    }
    function warmUp(from, to) {
      const t0 = performance.now(), A = LOOKS[from], B = LOOKS[to];
      const old = document.createElement('div'); old.style.cssText = `position:absolute;inset:0;background:${SKY3D[from]};transition:opacity 2.4s ease;pointer-events:none`;
      w.root.insertBefore(old, w.canvas); w.root.style.background = SKY3D[to]; requestAnimationFrame(() => { old.style.opacity = '0'; });
      const st = () => {
        const k = Math.min(1, (performance.now() - t0) / 2400), e = k * k * (3 - 2 * k);
        applyLook(A, B, e); w.scene.fog.color.set(FOGC[from]).lerp(_c.set(FOGC[to]), e);
        w.H.MOOD.uSat.value = SAT[from] + (SAT[to] - SAT[from]) * e;
        if (k < 1 && !s.finished) requestAnimationFrame(st); else { old.remove(); s.lookI = to; }
      };
      st();
    }
    function setLit(bkey, on, animMs) {
      const bid = BID[bkey]; if (!bid) return;
      const U = w.H.MOOD.uLit.value, i = bid - 1, a = U[i], b = on ? 1 : 0;
      if (!animMs) { U[i] = b; return; }
      const t0 = performance.now(); const st = () => { const k = Math.min(1, (performance.now() - t0) / animMs); U[i] = a + (b - a) * k * k * (3 - 2 * k); if (k < 1 && !s.finished) requestAnimationFrame(st); }; st();
    }
    function initLit() {
      STORY_KEYS.forEach(k => setLit(k, FREE ? true : isLit(k) && k !== o.justLit, 0));
    }
    function markersFor() {
      const out = [];
      if (story && tgtDoor && ow.marker !== null) out.push(Object.assign({ id: 'case', door: tgtDoor.id, style: 'case', icon: '🔍', label: o.arrowText || tgtDoor.short }, ow.marker || {}, { door: (ow.marker && ow.marker.door) || tgtDoor.id }));
      if (FREE && FO.doors && !OW) FO.doors.forEach(d => { if (d.mark === 'new' || d.mark === 'fresh') out.push({ id: 'm:' + d.id, door: d.id, style: d.mark }); });
      if (FREE && FO.doors && OW) FO.doors.forEach(d => { if ((d.mark === 'new' || d.mark === 'fresh') && !(ow.markers || []).some(m => m.door === d.id)) out.push({ id: 'm:' + d.id, door: d.id, style: d.mark }); });
      (ow.markers || []).forEach(m => out.push(m));
      return out;
    }
    function defaultCard() {
      if (ow.hud === null) return null;
      if (ow.hud) return ow.hud;
      if (!story || !tgtDoor) return null;
      return { title: 'Сегодняшнее дело', text: o.hudLabel ? String(o.hudLabel).replace(/^[^\wА-Яа-яЁё«]+/, '') : tgtDoor.label, door: tgtDoor.id, progress: typeof o.idx === 'number' ? [o.idx, 4] : null, tap: 'focus', icon: '🔍' };
    }
    // карточка дела → пилюля цели (короткое имя — у двери цели: «🔍 Бюро · 25 м»), полный текст — в карточке по тапу
    function setHud(card) {
      s.card = card || null;
      if (s.card && !s.card.short && !s.card.lock) {
        const d = s.card.door ? doors.get(s.card.door) : null;
        let sh = (d && d.short) || (s.card.door && tgtDoor && s.card.door === tgtDoor.id && o.arrowText) || '';
        if (sh) { sh = String(sh).charAt(0).toUpperCase() + String(sh).slice(1); s.card = Object.assign({}, s.card, { short: sh }); }
      }
      ui.setCase(s.card); s.distDirty = true;
    }
    // строки меню ☰ от города: карта, время суток, мини-карта (видны, пока идёт эта прогулка)
    function menuItems() {
      const HUD = window.HUD; if (!HUD) return;
      const mine = () => S === s && !s.finished && !s.paused && !s.inTrip;
      if (w.minimap) {
        HUD.menu.add({ id: 'map', icon: '🗺', label: 'Карта', order: 10, tint: 'mint', when: () => mine() && !!w.minimap, onTap: () => { if (mine() && w.minimap && w.minimap.open) w.minimap.open(); } });
        HUD.menu.add({ id: 'radar', icon: '🧭', order: 70, tint: 'sky', when: () => mine() && !!w.minimap,
          label: () => (w.minimap && w.minimap.isCollapsed && w.minimap.isCollapsed() ? 'Мини-карта: показать' : 'Мини-карта: спрятать'),
          onTap: () => { if (w.minimap && w.minimap.collapse) w.minimap.collapse(!(w.minimap.isCollapsed && w.minimap.isCollapsed())); }, keepOpen: true });
      }
      if (w.dn && window.DayNight && DayNight.menuItem) {
        HUD.menu.add(Object.assign(DayNight.menuItem({ onSet: (to, line) => { haptic('light'); toast(line, 2400, { replace: true }); s.dnDirty = true; } }), { id: 'dn', order: 40, when: () => mine() && !!w.dn }));
      }
      // подсказка «что тут делать» — первой строкой листа «Как играть» (меню ☰ без лишней строки: на 360 × 740 оно без прокрутки)
      if (window.Town && Town.sheet) HUD.helpTop = () => (mine() && s.active && s.mode === 'walk' ? { icon: '💡', title: 'Что тут делать?', sub: 'дело дня — или машина и отдых в горах', onTap: () => { if (mine()) showGuide(false); } } : null);
    }

    /* ---------- подсказка «что тут делать» (желание автора): при первом появлении города и первой строкой листа «Как играть» (меню ☰) ----------
       Два пути: дело (луч над домом) или — если не хочется — машина у тротуара и поездка в горы. Один раз за игру
       (st.world.guide); в проверках с ?debug=1 — только с ?guide=1, чтобы лист не закрывал город тестам. */
    let guideOn = false;
    function villageWord() {
      try {
        const named = (window.CONFIG || {}).VILLAGE_NAMED !== false && !(WORLD.Regions && WORLD.Regions.settings && WORLD.Regions.settings().named === false);
        const k = window.VILLAGE && VILLAGE.regions && VILLAGE.regions.kubachi;
        if (named && k && typeof k.title === 'function') return 'в ' + k.title(true);
      } catch (e) { /* без модуля села */ }
      return 'наверх';
    }
    async function showGuide(auto) {
      if (guideOn || s.finished || s.inTrip || !window.Town || !Town.sheet) return false;
      if (!s.active || s.busy || s.anim || s.mode !== 'walk' || blocked()) return false;
      guideOn = true;
      if (auto) saveWorld({ guide: 1 });
      const cd = s.card && s.card.door && !s.card.lock ? doors.get(s.card.door) : tgtDoor;
      const cars = Object.keys(w.cars).filter(k => w.cars[k].car.root.visible).length, trip = tripOpen();
      // машина на своём месте у старта (через дорогу от кинотеатра) — так и сказать; уехала — где она, покажет мини-карта
      const home = carHome(w, w.carKind), atStart = !!(home && home.at === 'start' && Math.hypot(car.S.x - home.x, car.S.z - home.z) < 4);
      const where = atStart ? (cars > 1 ? 'Машины ждут через дорогу от кинотеатра, у самой зебры. ' : 'Машина ждёт через дорогу от кинотеатра, у самой зебры. ') : 'Где машина — видно на мини-карте. ';
      const item = (ic, t, sub) => `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin:0 0 10px;border-radius:18px;background:#FFF4EE"><b style="font-size:26px;line-height:1.1;flex:none">${ic}</b><div><b style="display:block;font-size:17px;color:#9E2F47">${t}</b><span style="display:block;font-size:15.5px;font-weight:600;color:#6E6272;line-height:1.35;margin-top:2px">${sub}</span></div></div>`;
      const body = '<p style="margin:0 0 12px">Город — твой. Можно так:</p>'
        + item('🔍', 'Распутать дело', cd ? 'Иди к дому, над которым светится луч. Что искать — в пилюле вверху экрана.' : 'Новое дело появится само — его покажет пилюля вверху. А пока — гуляй и заглядывай в лавки.')
        + item('🚗', 'Или отдохнуть в горах', 'Не хочется расследовать — не беда. ' + where + 'Садись за руль — и ' + villageWord() + ': серпантин, облака и башня.')
        + '<p style="margin:2px 0 0;font-size:15px;color:#8A7E8E">Эта подсказка — в меню ☰, «Как играть». Карта мест — там же.</p>';
      const acts = [];
      if (cd) acts.push({ label: '🔍 К делу', value: 'case' });
      if (car.root.visible && vehicles === 'drive') acts.push({ label: cars > 1 ? '🚗 Покажи машины' : '🚗 Покажи машину', value: 'cars', cls: acts.length ? 'soft' : '' });
      if (trip) acts.push({ label: '⛰️ Сразу ' + villageWord(), value: 'trip', cls: 'soft' });
      let r = null;
      try { r = await Town.sheet({ title: 'Что тут делать?', body, actions: acts }); } catch (e) { r = null; }
      guideOn = false;
      if (s.finished || S !== s) return true;
      if (r === 'case' && cd) { haptic('light'); focusDoor(cd.id, 1500, 1.6); }
      else if (r === 'cars') {
        // камера — на машины, обе целиком в кадре (carsShot); метка «📍» — к выезду из города
        const sh = carsShot();
        if (sh) s.camFocus = { pos: new T.Vector3(sh.pos[0], sh.pos[1], sh.pos[2]), look: new T.Vector3(sh.look[0], sh.look[1], sh.look[2]), hold: 2.4, brk: true, mt: s.manualT };
        const e = L.edge;
        if (trip && e && isFinite(e.x) && WORLD.Minimap && WORLD.Minimap.setWaypoint) { try { WORLD.Minimap.setWaypoint({ rid: 'city', id: 'edge', x: e.x, z: e.z, label: e.label || 'За город ↑', kind: 'edge' }); } catch (x2) { /* без метки */ } }
        toast(trip && e && e.label ? `Садись за руль — и под арку с табличкой «${e.label}». Метка 📍 покажет путь.` : 'Подойди к машине и нажми «Сесть за руль».', 3600);
      } else if (r === 'trip' && tripOpen()) regionTrip(null);
      return true;
    }
    function guideLater(n) {
      if (n > 12 || s.finished || S !== s || wState().guide) return;
      setTimeout(() => { if (s.finished || S !== s || wState().guide) return; showGuide(true).then(ok => { if (!ok) guideLater(n + 1); }); }, n ? 2500 : 1400);
    }
    // hold (с, время игры) — фокус как у подсказки (focusDone): доехать, постоять, вернуться; без него — ms по часам, как раньше
    function focusDoor(id, ms = 1200, hold) {
      const d = doors.get(id); if (!d) return Promise.resolve();
      const yawOut = Math.atan2(d.nx, d.nz);
      s.camFocus = { pos: new T.Vector3(d.ax + d.nx * 7.5 + Math.cos(yawOut) * 2, 5.6, d.az + d.nz * 7.5 - Math.sin(yawOut) * 2), look: new T.Vector3(d.x, 2.4, d.z), until: hold ? undefined : performance.now() + ms, hold, brk: !!hold, mt: s.manualT };
      return new Promise(r => setTimeout(r, ms + 300));
    }
    // фокус по времени игры (F.hold, с), а не по часам: на медленных кадрах камера успевает доехать. Доехала (≤ 0,4 м) —
    // держит кадр F.hold с и плавно возвращается к героине (F.ret); F.brk — джойстик, палец по экрану или посадка в машину
    // возвращают её сразу. Без F.hold — как раньше: до F.until по часам
    function focusDone(F, dt) {
      if (F.hold === undefined) return false;
      F.t = (F.t || 0) + dt;
      const fp = s.focusPos, fl = s.focusLook;
      if (F.ret) { F.pos.copy(camPos); F.look.copy(lookAt); return !fp || (fp.distanceTo(camPos) < 0.3 && fl.distanceTo(lookAt) < 0.3) || F.t - F.ret > 2.5; }
      if (!F.arr && fp && fp.distanceTo(F.pos) < 0.4) F.arr = F.t;
      const drag = s.manualT > (F.mt || 0) + 0.01; F.mt = s.manualT;
      if ((F.arr && F.t - F.arr > F.hold) || F.t > F.hold + 6 || (F.brk && (s.walking || drag || s.mode !== 'walk'))) F.ret = F.t;
      return false;
    }
    // кадр «Покажи машины»: стоящие машины целиком в свободной части экрана (не под пилюлей и тостом сверху, не под
    // джойстиком и картой снизу). Портрет узкий, поэтому смотрим вдоль ряда машин спереди-сбоку, с проезжей части:
    // ближняя крупнее, дальняя — выше и мельче. Не влезли — камера отъезжает; машины дальше 16 м друг от друга
    // (или вдвоём не влезли) — только ближняя к героине. Перебор поз — один раз на нажатие кнопки, не в кадре
    const shotCam = new T.PerspectiveCamera(58, 0.5, 0.1, 300), shotV = new T.Vector3(), shotP = new T.Vector3();
    function carsShot() {
      const all = Object.keys(w.cars).map(k => w.cars[k].car).filter(c => c.root.visible).sort((a, b) => (a === car ? -1 : b === car ? 1 : 0));
      if (!all.length) return null;
      const dh = c => Math.hypot(c.S.x - s.px, c.S.z - s.pz), near = all.length > 1 && dh(all[1]) < dh(all[0]) ? all[1] : all[0];
      const two = all.length > 1 && Math.hypot(all[1].S.x - all[0].S.x, all[1].S.z - all[0].S.z) <= 16;
      let pair = all.slice(0, 2);
      // обе смотрят в одну сторону (стоят рядом у бордюра) — камера спереди ряда, первой — передняя: видно «лица» обеих
      if (two && Math.cos(pair[0].S.ry - pair[1].S.ry) > 0.8 && (pair[1].S.x - pair[0].S.x) * Math.sin(pair[0].S.ry) + (pair[1].S.z - pair[0].S.z) * Math.cos(pair[0].S.ry) > 0) pair = [pair[1], pair[0]];
      return (two && shotOf(pair)) || shotOf([near]);
    }
    function shotOf(list) {
      const pts = [];
      list.forEach(c => {
        const d = c.dims || {}, hw = d.halfW || 0.95, hl = d.halfL || 2.2, y0 = c.root.position.y, y1 = y0 + (d.height || 1.35), co = Math.cos(c.S.ry), si = Math.sin(c.S.ry);
        for (const a of [-1, 1]) for (const b of [-1, 1]) for (const y of [y0, y1]) pts.push(c.S.x + a * hw * co + b * hl * si, y, c.S.z - a * hw * si + b * hl * co);
      });
      const A = list[0].S, B = list[1] ? list[1].S : null, dAB = B ? Math.hypot(B.x - A.x, B.z - A.z) || 1 : 0;
      // ось ряда — от ближней к дальней; одна машина — камера спереди
      const ux = B ? (B.x - A.x) / dAB : -Math.sin(A.ry), uz = B ? (B.z - A.z) / dAB : -Math.cos(A.ry);
      // сторона проезжей части — где дорога «глубже»: камера над дорогой, а не над тротуаром с фонарями и деревьями
      let nx = -uz, nz = ux;
      if (L.roadSD && L.roadSD(A.x + nx * 3, A.z + nz * 3) > L.roadSD(A.x - nx * 3, A.z - nz * 3)) { nx = -nx; nz = -nz; }
      shotCam.fov = w.portrait ? 58 : 48; shotCam.aspect = cam.aspect; shotCam.updateProjectionMatrix();
      let best = null;
      // точка взгляда — между машинами (t) и чуть вбок (o: к бордюру или к дороге), чтобы машины встали посередине кадра
      for (const k of [5, 6.5, 8, 10, 12.5, 15, 18]) for (const m of [2.5, 4, 5.5]) for (const hy of [3.4, 4.6]) for (const t of B ? [0.3, 0.45] : [0]) for (const o of [-1.6, -0.8, 0, 0.8]) {
        const px = A.x - ux * k + nx * m, pz = A.z - uz * k + nz * m, py = gy(L, px, pz) + hy, lx = A.x + ux * dAB * t + nx * o, lz = A.z + uz * dAB * t + nz * o, ly = gy(L, lx, lz) + 0.55;
        shotCam.position.set(px, py, pz); shotCam.lookAt(lx, ly, lz); shotCam.updateMatrixWorld();
        // рамки на экране: общая и у каждой машины (по 8 углов кузова)
        let x0 = 1, x1 = -1, y0 = 1, y1 = -1, ok = true, aMin = 9, aMax = 0;
        for (let j = 0; j < list.length && ok; j++) {
          let cx0 = 1, cx1 = -1, cy0 = 1, cy1 = -1;
          for (let i = j * 24; i < j * 24 + 24; i += 3) {
            shotV.set(pts[i], pts[i + 1], pts[i + 2]).project(shotCam);
            if (shotV.z > 1 || shotV.z < -1) { ok = false; break; }
            cx0 = Math.min(cx0, shotV.x); cx1 = Math.max(cx1, shotV.x); cy0 = Math.min(cy0, shotV.y); cy1 = Math.max(cy1, shotV.y);
          }
          const a = (cx1 - cx0) * (cy1 - cy0); aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
          x0 = Math.min(x0, cx0); x1 = Math.max(x1, cx1); y0 = Math.min(y0, cy0); y1 = Math.max(y1, cy1);
        }
        // доли экрана (x — слева, y — сверху): сверху пилюля дела и тост, снизу джойстик, мини-карта и кнопки, справа — стрелка к делу
        if (!ok || (x0 + 1) / 2 < 0.07 || (x1 + 1) / 2 > 0.88 || (1 - y1) / 2 < 0.18 || (1 - y0) / 2 > 0.76) continue;
        // камера в доме или дом между камерой и машиной — мимо
        let inBox = false;
        w.grid.near(px - 0.5, px + 0.5, pz - 0.5, pz + 0.5, null, bx => { if (px > bx.x0 && px < bx.x1 && pz > bx.z0 && pz < bx.z1 && py < bx.h + 0.5) inBox = true; });
        if (inBox || list.some(c => occlude(shotCam.position, shotP.set(c.S.x, 0.8, c.S.z)) < 1)) continue;
        // крупнее, ближе к середине кадра по горизонтали, и чтобы дальняя машина не потерялась за ближней
        const sc = (x1 - x0) * (y1 - y0) * (1 - Math.abs(x0 + x1) * 0.45) * (0.4 + 0.6 * Math.sqrt(aMin / aMax));
        if (!best || sc > best.sc) best = { sc, pos: [px, py, pz], look: [lx, ly, lz] };
      }
      return best;
    }

    /* ---------- машина ---------- */
    function vehiclesSetup() {
      car.root.visible = vehicles !== 'none';
      if (w.carCtl) w.carCtl.setLocked(vehicles !== 'drive');           // замок = чехол с бантом (как в волне 2)
      else w.cover.setOn(vehicles === 'covered');
      if (w.bike) w.bike.setHidden(bikeMode === 'none');
      if (w.bikeStand) w.bikeStand.visible = bikeMode !== 'none';
      spareSetup();
    }
    // вторая машина стоит рядом с выбранной (обе — у старта) и видна, когда её можно взять (седан открыт вместе с машиной)
    function spareSetup() {
      const on = vehicles === 'drive' && canPickCar();
      Object.keys(w.cars).forEach(k => { const e = w.cars[k]; if (e.car === car) return; e.car.root.visible = on; if (on && e.ctl) e.ctl.setLocked(false); });
    }
    const onGround = () => !w.mv || (!s.air && s.py - gy(L, s.px, s.pz) < 0.25);   // волна 5: не со скамейки и не с крыши машины
    const nearCar = () => s.mode === 'walk' && onGround() && car.root.visible && (!w.carCtl || w.carCtl.mode === 'parked') && Math.hypot(car.S.x - s.px, car.S.z - s.pz) < (car.kind === 'sedan' ? 3.4 : 2.9) && Math.abs(car.S.v) < 0.3;
    /* ---------- выбор машины (волна 4): у гаража «Круглые фары» — «Выбрать машину», у стоящей дома машины — «Другая машина» ---------- */
    const carOpenNow = () => vehicles === 'drive' && !(w.carCtl && w.carCtl.locked);
    const canPickCar = () => sedanOk() && carOpenNow() && (STAND || unlock('sedan').ok);
    const nearGarage = () => { const g = L.spots && L.spots.garageHome; return !!(g && s.mode === 'walk' && !s.sitting && canPickCar() && Math.hypot(s.px - g.x, s.pz - g.z) < 1.3); };
    // до 21.11 у гаража — «Посмотреть» и милая строка-замок седана (обещание, как чехол на машине)
    const nearGarageLocked = () => { const g = L.spots && L.spots.garageHome; return !!(g && s.mode === 'walk' && !s.sitting && sedanOk() && !canPickCar() && Math.hypot(s.px - g.x, s.pz - g.z) < 1.3); };
    const garageLockedLine = () => { const u = unlock('sedan'); return !u.ok && u.text ? u.text : 'Гараж «Круглые фары». Машины пока отдыхают.'; };
    const carAtHome = () => { const h = carHome(w, w.carKind); return !!h && Math.hypot(car.S.x - h.x, car.S.z - h.z) < 12; };
    // вторая машина (не выбранная), если стоит в городе: к ней можно подойти и сесть — тогда выбранной станет она
    const spare = () => { if (s.mode !== 'walk') return null; for (const k in w.cars) { const e = w.cars[k]; if (e.car !== car && e.car.root.visible && (!e.ctl || e.ctl.mode === 'parked')) return e; } return null; };
    const spareD = e => Math.hypot(e.car.S.x - s.px, e.car.S.z - s.pz);
    // рядом со второй машиной (и она ближе выбранной) — «Сесть за руль» садит в неё
    const nearSpare = () => {
      const e = onGround() ? spare() : null;
      if (!e || spareD(e) >= (e.kind === 'sedan' ? 3.4 : 2.9) || Math.abs(e.car.S.v) > 0.3) return null;
      return nearCar() && Math.hypot(car.S.x - s.px, car.S.z - s.pz) <= spareD(e) ? null : e;
    };
    function takeSpare(e) {
      if (!e || s.finished || s.mode !== 'walk' || (w.carCtl && w.carCtl.mode !== 'parked')) return false;
      try { useCar(w, e.kind); } catch (x) { console.warn('world spare car', x); return false; }
      car = w.car; saveWorld({ car: w.carKind }); vehiclesSetup(); emit('world:car', { kind: w.carKind });
      return true;
    }
    // бюджет (q=low ≤200k) и вид: стоящая машина издали дешевле — на низком качестве дальше 12 м без обводки (иначе — дальше
    // начала тумана) и дальний вид car.setFar(1): кузов реже, без мелочей салона (кабриолет ≈ 9 тыс. треуг. вместо 16,6),
    // с 18 м (на низком) — setFar(2): и колёса без спиц (≈ 6 тыс.); дальше границы LOD города (та же, что у map.js: там дома
    // уже «коробки») не рисуется. Не рисуем стоящую
    // машину и когда она лезет в камеру: камера в кузове или ближе 0,8 м к нему, или кузов заслоняет цель камеры (взгляд
    // вверх — камера у земли); вернётся, когда 0,4 с чисто — без мигания на границе. Прячем слоем (layers.mask = 0), а не
    // visible: видимость машины — это логика (spare, carFree, карта). off — всё вернуть.
    const lodHide = (m, on) => {
      const u = m.userData;
      if (on && !u.lodHid) { u.lodHid = 1; u.lodMask = m.layers.mask; m.layers.mask = 0; }
      else if (!on && u.lodHid) { u.lodHid = 0; m.layers.mask = u.lodMask; }
    };
    // кадр камеры — по коробкам кузова (lodSet): сфера сеток машины велика (до 3,9 м), и машина под камерой или сбоку от
    // кадра рисовалась бы зря
    const lodFr = new T.Frustum(), lodPM = new T.Matrix4(), lodBox = new T.Box3();
    // коробка по осям мира вокруг повёрнутого прямоугольника машины (полуширина w, полудлина l, запас 6 см — обводка), высота y0…y1
    const lodSet = (c, co, si, w, l, y0, y1) => {
      const ex = Math.abs(co) * w + Math.abs(si) * l + 0.06, ez = Math.abs(si) * w + Math.abs(co) * l + 0.06;
      lodBox.min.set(c.S.x - ex, y0, c.S.z - ez); lodBox.max.set(c.S.x + ex, y1, c.S.z + ez);
      return lodBox;
    };
    // отрезок «камера → цель камеры» (героиня, ведомая машина или велосипед; 1,2 м над землёй) против кузова — в осях стоящей
    // машины; последние 1,5 м у цели не в счёт: героиня у двери машины её не прячет
    let sgT0 = 0, sgT1 = 1;
    const sgAx = (p, d, lo, hi) => {
      if (Math.abs(d) < 1e-6) return p >= lo && p <= hi;
      let u0 = (lo - p) / d, u1 = (hi - p) / d;
      if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
      if (u0 > sgT0) sgT0 = u0;
      if (u1 < sgT1) sgT1 = u1;
      return sgT0 <= sgT1;
    };
    function carLod(off, dt = 0) {
      const cp = cam.position, fog = w.scene.fog, fN = fog ? fog.near : 22, fF = fog ? fog.far : 55;
      // обзор с отодвинутым туманом (как у map.js, fog.near > 200) — без правил дальности; отладочная камера — как обычная,
      // только без проверки «заслоняет цель»: камера не за героиней
      const over = fN > 200, farD = over ? 1e9 : Math.min(fN + 0.42 * (fF - fN), 58), olD = over ? 1e9 : w.qKey === 'low' ? Math.min(12, fN) : fN, all = off || s.inTrip;
      // дальний вид машины (car.setFar): 1 — как пропала обводка, 2 (колёса без спиц) — на низком с 18 м, иначе — сразу
      const fgD = w.qKey === 'low' ? olD + 6 : olD;
      const tx = s.tx, ty = (s.ty || 0) + 1.2, tz = s.tz, tL = Math.hypot(tx - cp.x, ty - cp.y, tz - cp.z), tK = !s.camFocus && !s.camOverride && tL > 2 ? 1 - 1.5 / tL : 0;
      let fr = false;
      for (const k in w.cars) {
        const e = w.cars[k], c = e.car;
        let st = 0, far = 0;
        if (e.occT > 0) e.occT -= dt;
        if (!all && c.root.visible && !(c === car && s.mode === 'drive') && (!e.ctl || e.ctl.mode === 'parked') && Math.abs(c.S.v) < 0.05) {
          const dx = cp.x - c.S.x, dz = cp.z - c.S.z, d = Math.hypot(dx, dz), dm = c.dims, by = c.root.position.y, hy = by + ((dm && dm.height) || 1.4);
          const hc = CAR_HALF[k] || CAR_HALF.coupe, hw = dm && dm.halfW ? dm.halfW : hc[0], hl = dm && dm.halfW ? dm.halfL : hc[1], co = Math.cos(c.S.ry), si = Math.sin(c.S.ry);
          const lx = dx * co - dz * si, lz = dx * si + dz * co;
          if (d > farD) st = 2;
          else if (cp.y < hy + 0.8 && Math.abs(lx) < hw + 0.8 && Math.abs(lz) < hl + 0.8) st = 2;
          else {
            if (tK > 0) {
              const qx = tx - c.S.x, qz = tz - c.S.z, ex = qx * co - qz * si, ez = qx * si + qz * co;
              sgT0 = 0; sgT1 = tK;
              if (sgAx(lx, ex - lx, -hw, hw) && sgAx(cp.y, ty - cp.y, by, hy) && sgAx(lz, ez - lz, -hl, hl)) e.occT = 0.4;
            }
            if (e.occT > 0) st = 2;
            else {
              if (!fr) { fr = true; cam.updateMatrixWorld(); lodFr.setFromProjectionMatrix(lodPM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
              // две коробки — кузов до пояса и салон (уже и короче): у одной коробки верхние углы торчат в кадр, когда сама
              // машина уже под его нижним краем (камера над стоящей машиной)
              const hb = by + 0.62 * (hy - by);
              let inF = lodFr.intersectsBox(lodSet(c, co, si, hw, hl, by - 0.05, hb + 0.12));
              if (!inF) inF = lodFr.intersectsBox(lodSet(c, co, si, hw * 0.85, hl * 0.7, hb - 0.2, hy + 0.12));
              st = !inF ? 2 : d > olD ? 1 : 0;
              // камера показывает машины («Покажи машины», карточка дела) — без дальнего вида: их как раз разглядывают
              far = st === 1 && !s.camFocus ? (d > fgD ? 2 : 1) : 0;
            }
          }
        }
        if ((e.farSt || 0) !== far) { e.farSt = far; if (c.setFar) c.setFar(far); }
        if ((e.lodSt || 0) === st) continue;
        e.lodSt = st;
        // свои меши машины — один раз, когда она стоит пустая (героиня и зверята в кузове сюда не попадут)
        if (!e.lodM) { e.lodM = []; c.root.traverse(m => { if (m.isMesh || m.isSprite) e.lodM.push(m); }); }
        for (const m of e.lodM) lodHide(m, st === 2 || (st === 1 && m === c.outline));
      }
    }
    // выбрать машину: у гаража — выбранная встаёт у гаража; иначе (кнопка «Другая машина», отладка) — на своё место у старта
    function swapCar(kind, at) {
      const toGarage = at === 'garage';
      if (s.finished || !kind || (kind === w.carKind && !toGarage)) return false;
      if (kind === 'sedan' && !canPickCar()) return false;
      if (s.mode !== 'walk' || (w.carCtl && w.carCtl.mode !== 'parked')) { toast('Сначала останови машину и выйди.', 2000); return false; }
      const prev = w.carKind, gsp = toGarage ? garageSpot(w, kind) : null;
      try { useCar(w, kind, { home: !gsp }); if (gsp) placeCar(w.car, gsp); } catch (e) { console.warn('world car swap', e); try { useCar(w, prev, { home: true }); } catch (x) { /* ignore */ } car = w.car; return false; }
      car = w.car;
      saveWorld({ car: w.carKind });
      vehiclesSetup();
      sfx('pop'); haptic('success');
      toast((CAR_TITLE[w.carKind] || CAR_TITLE.coupe) + (gsp ? ' ждёт у гаража!' : ' ждёт через дорогу от кинотеатра!'), 2400);
      emit('world:car', { kind: w.carKind });
      return true;
    }
    // лист «Какую машину взять?» с карточками VEHICLES.picker (без брендов): at = 'garage' — выбранная встаёт у гаража
    async function pickCar(at) {
      if (!canPickCar() || s.pickBusy || !window.Town || !Town.sheet) return null;
      s.pickBusy = true; s.moveTo = null;
      let picked = null;
      try {
        const body = document.createElement('div');
        const p0 = document.createElement('p'); p0.textContent = at === 'garage' ? 'Выбранная машина встанет здесь, у гаража «Круглые фары».' : 'Обе стоят через дорогу от кинотеатра. Какую взять?'; p0.style.margin = '0 0 10px'; body.appendChild(p0);
        picked = await Town.sheet({ title: 'Какую машину взять?', body, onMount: (b, close) => { const pk = VEHICLES.picker({ current: w.carKind, onPick: id => setTimeout(() => close(id), 180) }); b.appendChild(pk); } });
      } catch (e) { picked = null; }
      s.pickBusy = false;
      if (picked && (picked !== w.carKind || at === 'garage') && !s.finished) swapCar(picked, at);
      else if (picked && picked === w.carKind) toast((CAR_TITLE[w.carKind] || CAR_TITLE.coupe) + ' уже ждёт рядом.', 2000);
      return picked;
    }
    const nearBike = () => s.mode === 'walk' && onGround() && bikeMode !== 'none' && w.bike && !w.bike.mounted && !w.bike.busy && w.bike.near(s.px, s.pz, 1.7);
    function rideOn() {
      if (!w.bike || s.anim || w.bike.busy || s.mode !== 'walk') return;
      if (bikeMode !== 'ride') { toast(bikeLock.ok ? 'Велосипед подождёт прогулки.' : bikeLock.text, 2600); return; }
      s.moveTo = null; standUp(); s.sitting = null;
      if (s.catOn && !s.catSit) { w.bike.carry(cat.root, 'basket'); s.catOn = false; s.catInBasket = true; w.catBlob.visible = false; }
      s.mode = 'ride'; s.manualT = 0;
      w.bike.mount(hero);
    }
    s.onBikeOff = r => {
      if (s.finished || !r) return;
      s.mode = 'walk'; s.sitting = null; s.px = r.x; s.pz = r.z; s.ang = r.ry; s.vx = s.vz = 0;
      hero.root.rotation.set(0, r.ry, 0); if (hero.rig) hero.rig.prev = null;
      if (s.catInBasket) { w.bike.uncarry(cat.root, scene); s.catInBasket = false; s.catOn = true; s.catX = r.x - 0.8; s.catZ = r.z + 0.4; }
    };
    s.onBell = () => {
      speak('bike', 'Дзынь-дзынь!', 1200);
      w.npcs.filter(n => n.root.visible).map(n => [n, Math.hypot(n.x - s.px, n.z - s.pz)]).filter(q => q[1] < 12).sort((a, b) => a[1] - b[1]).slice(0, 6)
        .forEach(([n, d]) => setTimeout(() => { if (s.finished) return; n.hop(); n.faceHero = 2.5; }, 200 + d * 40));
    };
    const local2world = (v, out) => { out.copy(v); car.root.localToWorld(out); return out; };
    const _cv = new T.Vector3();
    const coverLine = () => { const lk = unlock('car'), i = s.coverI++; return !lk.ok && lk.text && i % 2 === 0 ? lk.text : COVER_LINES[(i >> (lk.ok ? 0 : 1)) % COVER_LINES.length]; };
    function enterCarCtl(instant) {
      if (vehicles !== 'drive' || w.carCtl.locked) { toast(coverLine(), 2600); return Promise.resolve(false); }
      if (w.carCtl.mode !== 'parked') return Promise.resolve(false);
      s.moveTo = null; standUp(); s.sitting = null; s.mode = 'drive'; s.manualT = 0;
      w.heroBlob.visible = w.catBlob.visible = false;
      const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = false; if (w.heroProxy) w.heroProxy.visible = false;
      s.carPets = { cat: s.catOn && !s.catSit ? cat.root : null, dog: (w.dog && w.dog.root) || null };   // собачка — от LIFE (companion.js)
      const hi0 = IA && IA.holding('L'); if (IA) IA.cancel();
      return w.carCtl.enter(hero, Object.assign({ instant: !!instant }, s.carPets)).then(ok => {
        if (ok) carLights(w, w.cars[w.carKind], true);
        if (ok || s.finished) return ok;
        if (hi0) hi0.visible = true;
        s.mode = 'walk'; w.heroBlob.visible = true; w.catBlob.visible = s.catOn; if (ol) ol.visible = true; if (w.heroProxy) w.heroProxy.visible = true;
        return ok;
      });
    }
    function exitCarCtl(opt) {
      return w.carCtl.exit(opt).then(r => {
        carLights(w, w.cars[w.carKind], false);
        if (!r || s.finished) return r;
        s.mode = 'walk'; s.sitting = null; s.px = r.x; s.pz = r.z; s.ang = r.ry; s.vx = s.vz = 0; ui.show(ui.reset, false);
        hero.root.rotation.set(0, r.ry, 0); if (hero.rig) hero.rig.prev = null;
        if (s.carPets && s.carPets.cat && r.pets[0]) { s.catX = r.pets[0].x; s.catZ = r.pets[0].z; }
        s.carPets = null;
        w.heroBlob.visible = true; w.catBlob.visible = s.catOn;
        const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = true; if (w.heroProxy) w.heroProxy.visible = true;
        return r;
      });
    }
    function enterCar(instant) {
      if (w.carCtl) return enterCarCtl(instant);
      if (vehicles !== 'drive') { toast(coverLine(), 2600); return; }
      s.moveTo = null;
      const door = local2world(car.doorL, new T.Vector3()), seat = local2world(car.seatDriver, new T.Vector3());
      const from = { x: s.px, z: s.pz }, catFrom = { x: s.catX, z: s.catZ }, cs = local2world(car.seatPass, new T.Vector3());
      const fin = () => {
        s.mode = 'drive'; s.anim = null;
        car.body.add(hero.root); hero.root.position.set(car.seatDriver.x, car.seatDriver.y - 0.8 + 0.28, car.seatDriver.z); hero.root.rotation.set(0, 0, 0);
        s.sitting = { x: 0, z: 0, ry: 0, h: 0.45, car: true };
        if (s.catOn) { car.body.add(cat.root); cat.root.position.copy(car.seatPass); cat.root.position.y -= 0.02; cat.root.rotation.set(0, 0, 0); }
        w.heroBlob.visible = w.catBlob.visible = false; s.manualT = 0;
        const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = false; if (w.heroProxy) w.heroProxy.visible = false;
      };
      if (instant) { fin(); return; }
      s.anim = { t: 0, dur: 0.75, tick(k) {
        if (k < 0.4) { const e = k / 0.4; s.px = from.x + (door.x - from.x) * e; s.pz = from.z + (door.z - from.z) * e; s.ang = Math.atan2(door.x - from.x, door.z - from.z); hero.root.position.set(s.px, 0, s.pz); s.forceWalk = true; }
        else { const e = (k - 0.4) / 0.6, ee = e * e * (3 - 2 * e); s.forceWalk = false; hero.root.position.set(door.x + (seat.x - door.x) * ee, Math.sin(e * PI) * 0.7 + (seat.y - 0.8) * ee, door.z + (seat.z - door.z) * ee); }
        if (s.catOn) { const ce = Math.min(1, k * 1.2); cat.root.position.set(catFrom.x + (cs.x - catFrom.x) * ce, Math.sin(ce * PI) * 0.9 + (cs.y - 0.02) * ce, catFrom.z + (cs.z - catFrom.z) * ce); }
      }, done: fin };
    }
    function exitCar() {
      if (w.carCtl) return exitCarCtl();
      const cands = [car.doorL, car.doorR, new T.Vector3(0, 0, 2.8), new T.Vector3(0, 0, -2.8)];
      let out = null;
      for (const c of cands) { local2world(c, _cv); const [x, z] = collide(_cv.x, _cv.z, 0.3); if (Math.hypot(x - _cv.x, z - _cv.z) < 0.05) { out = [x, z]; break; } }
      if (!out) { local2world(car.doorL, _cv); out = collide(_cv.x, _cv.z, 0.3); }
      const seat = local2world(car.seatDriver, new T.Vector3());
      scene.add(hero.root); if (s.catOn) scene.add(cat.root);
      s.mode = 'walk'; s.braking = false; s.sitting = null; ui.show(ui.reset, false);
      const [ox, oz] = out;
      s.anim = { t: 0, dur: 0.55, tick(k) {
        const e = k * k * (3 - 2 * k);
        hero.root.position.set(seat.x + (ox - seat.x) * e, Math.sin(k * PI) * 0.6 + (seat.y - 0.8) * (1 - e), seat.z + (oz - seat.z) * e);
        if (s.catOn) cat.root.position.set(seat.x + (ox - 0.8 - seat.x) * e, Math.sin(k * PI) * 0.8 + 0.6 * (1 - e), seat.z + (oz + 0.4 - seat.z) * e);
      }, done() { s.px = ox; s.pz = oz; s.catX = ox - 0.8; s.catZ = oz + 0.4; s.anim = null; w.heroBlob.visible = true; w.catBlob.visible = s.catOn; const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = true; if (w.heroProxy) w.heroProxy.visible = true; if (hero.rig) hero.rig.prev = null; } };
    }
    // W7: вид «из-за руля» вкл/выкл; наружу — камера плавно уходит назад от салона (camPos = где камера сейчас)
    function ckSet(on) {
      if (!s.ck) return false;
      const was = s.ck.active;
      on = !!on && s.mode === 'drive' && !!(car && car.cockpit);
      s.ck.on(on); s.ckLook.yaw = s.ckLook.pitch = 0;
      if (was && !on) camPos.copy(cam.position);
      if (ui.ck && window.HUD) { ui.ck.classList.toggle('on', on); HUD.sicon(ui.ck, on ? '🎥' : '👁', on ? 'Вид сзади' : 'Вид из-за руля'); }
      if (on && !was) toast('Вид из-за руля · 🎥 — снова сзади', 1800, { replace: true });
      return on;
    }
    function doHorn() {
      if (s.mode !== 'drive' || (w.carCtl && w.carCtl.mode !== 'drive')) return;
      if (w.carCtl) w.carCtl.horn(); else { sfx('blip'); setTimeout(() => sfx('blip'), 160); }
      speak('car', 'Би-бип!', 1400);
      // свой ответ у каждого и не больше четырёх облачков
      w.npcs.filter(n => n.root.visible).map(n => [n, Math.hypot(n.x - car.S.x, n.z - car.S.z)]).filter(q => q[1] < 16).sort((a, b) => a[1] - b[1]).slice(0, 4)
        .forEach(([n, d]) => setTimeout(() => { if (s.finished) return; n.hop(); speak(n.id, w.life ? w.life.honkLine(n, d) : d < 9 ? WORLD.RESIDENT_HONK[0] : WORLD.RESIDENT_HONK[1], 2200); n.faceCar = 2.5; }, 250 + d * 40));
    }

    /* ---------- поездка в горы (REGION, js/world/regions.js): как боковой визит — город на паузе, своя петля региона ---------- */
    let tripAsk = false;
    async function regionTrip(e, go) {   // go — с большой карты (MAP): { to: 'kubachi' | 'hotel' | 'serpentine', poi, at: { x, z, label }, note } (note — тост после шторки)
      if (s.finished || s.inTrip || !WORLD.Regions || !WORLD.Regions.can()) return false;
      s.inTrip = true; s.moveTo = null; ckSet(false);
      // машина едет в регион целиком: вернуть её меши (могли быть спрятаны LOD стоящих машин)
      carLod(true);
      if (s.mode === 'ride' && w.bike) { try { await w.bike.dismount({ instant: true }); } catch (x) { /* уже слезла */ } }
      const t0 = performance.now();
      s.paused = true; loopStop(); bindInput(false); ui.sayClear(); w5Off();
      if (ui.driveCtl) ui.driveCtl.show(false);   // город на паузе: кнопки руля прячем (вернётся — покажет updUI)
      if (w.minimap) w.minimap.close(true);
      // слабый телефон: видеокарту города отпустить, регион рисует на своём рендерере; назад — город загрузится сам
      const low = !!(window.WorldHub && WorldHub._lowMem && WorldHub._lowMem());
      if (low) release();
      let ret = null;
      // руки: действие — отменить; покупку города — «в сумку» (в горах свои), после поездки — снова в руке
      const hiT = IA && IA.holding('L'), dT = hiT && hiT.userData.it;
      const tripHeld = hiT && s.held && (IA_ITEM[s.held] || s.held === 'squeaky_hammer') ? { kind: s.held, data: Object.assign(s.heldData && typeof s.heldData === 'object' ? s.heldData : {}, dT ? { _bites: dT.bites || 0, _level: dT.level } : {}) } : null;   // те же данные (прогулка видит недоеденное)
      if (IA) { IA.cancel(); if (tripHeld) iaDrop(true); }
      try {
        // car — выбранная машина города (купе или седан: car.kind, у седана car.driveCfg); carKind — то же словом (WORLD.carChoice())
        const R = WORLD.Regions.create({ THREE: T, renderer: low ? null : w.renderer, host: w.root, hero, car, carKind: w.carKind, kit: w.H, layout: L, quality: w.qKey,
          pets: { cat: s.catOn && !s.catSit ? w.cat : null, dog: w.dog || null } });   // зверята с ней: кот шагает телом и хвостом (REGION 4B)
        ret = await R.trip({ from: 'city', edge: e || null, to: go && go.to, poi: go && go.poi, at: go && go.at, note: go && go.note });
      } catch (err) { console.warn('world region trip', err); }
      if (ret && ret.trip && ret.trip.up) { try { if (!wState().road) saveWorld({ road: 1 }); } catch (x) { /* ignore */ } }   // дорога наверх пройдена за рулём
      const ms = performance.now() - t0; s.sideMs += ms; s.side.push('trip'); if (env.onSide) env.onSide('trip', ms);
      s.inTrip = false;
      if (s.finished) return false;
      ensureRenderer(w); host();
      if (ret && ret.inCar) { s.mode = 'drive'; s.px = ret.car.x; s.pz = ret.car.z; s.yaw = ret.car.ry; s.camInit = false; s.manualT = 0; carLights(w, w.cars[w.carKind], true); }
      else if (ret && ret.hero) { if (w.carCtl && w.carCtl.mode === 'drive') { /* поездка с карты: машина осталась у выезда */ } placeAt(ret.hero.x, ret.hero.z, ret.hero.ry, ret.hero.ry); }
      if (tripHeld && !s.finished) { s.heldData = tripHeld.data; setHeld(tripHeld.kind, tripHeld.data); }
      s.iaDy = 0; s.dnDirty = true;
      s.paused = false; s.busy = false; w.root.classList.remove('busy');
      bindInput(true); loopStart();
      emit('world:trip', { ms: Math.round(ms), inCar: !!(ret && ret.inCar), fallback: (ret && ret.fallback) || null });
      return true;
    }
    // машина въехала в зону выезда (car 'edge'): спросить и поехать; «Не сейчас» — снова спросит, когда отъедет и вернётся
    async function onEdge(e) {
      if (tripAsk || s.inTrip || s.finished || s.mode !== 'drive' || blocked()) return;
      if (!tripOpen()) { const lk = unlock('trip'); toast(lk.ok ? 'Дорога наверх пока закрыта.' : lk.text, 2400); return; }
      tripAsk = true;
      const lbl = (e && e.label) || (L.edge && L.edge.label) || 'Дорога наверх';
      let go = true;
      try { if (window.Town && Town.sheet) go = await Town.sheet({ title: lbl, body: '<p>Серпантин, облака и башня над ними. Поехали?</p>', actions: [{ label: 'Поехали!', value: true }, { label: 'Не сейчас', value: false, cls: 'soft' }] }); } catch (x) { go = true; }
      tripAsk = false;
      if (go && !s.finished) regionTrip(e);
    }
    s.onEdge = e => onEdge(e);
    s.regionTrip = regionTrip;   // большая карта (MAPUI: «Поехать сюда» к выезду) и отладка

    /* ---------- действие (кнопка, Enter) ---------- */
    function nearSpot() { return spots.find(sp => Math.hypot(s.px - sp.x, s.pz - sp.z) < 0.95) || null; }
    // кнопка действия «Помахать»: ближайший житель (не кот) в 3,4 м, с которым она ещё не знакомилась «Помахать» в этом отрезке
    function waveTarget() { if (s.waveT >= 0) return null; const n = nearestNpc(3.4, true); return n && n.n && !s.greeted.has(n.id) ? n : null; }
    function nearDoor() { return doors.near(s.px, s.pz, 1.15); }
    // «сама ест» не мешает: кнопка или тап отменяют откус и делают своё; настоящее действие (взять, погладить) — ждём
    const iaFree = () => { if (!iaBusy()) return true; if (s.iaIdle) { IA.cancel(); s.iaIdle = false; return true; } return false; };
    function doAction() {
      if (s.finished || s.busy || blocked() || s.anim || s.benching || !iaFree()) return;
      if (s.mode === 'drive') { if (w.carCtl) { if (w.carCtl.mode === 'drive') exitCar(); return; } if (Math.abs(car.S.v) > 0.8) { s.braking = true; return; } exitCar(); return; }
      if (s.mode === 'ride') { if (w.bike && !w.bike.busy) w.bike.dismount(); return; }
      if (s.sitting) { standUp(); return; }
      if (w.mv && (s.air || w.mv.busy())) return;   // в прыжке и в кувырке — сначала приземлиться
      const d = nearDoor(), sp = nearSpot();
      if (sp && (!d || Math.hypot(s.px - sp.x, s.pz - sp.z) < Math.hypot(s.px - d.ax, s.pz - d.az))) { useSpot(sp); return; }
      if (d) { tryDoor(d); return; }
      if (nearBike()) { rideOn(); return; }
      if (nearGarage()) { pickCar('garage'); return; }
      if (nearGarageLocked()) { s.hopT = 0; toast(garageLockedLine(), 2800); return; }
      { const e2 = nearSpare(); if (e2) { if (takeSpare(e2)) enterCar(); return; } }
      if (nearCar()) { enterCar(); return; }
      { const la = w.life && w.life.actionFor(s.px, s.pz); if (la) { runBusy(() => la.run()).then(() => { if (!compLock.ok && la.n && la.n.dogpark && !s.compSaid) { s.compSaid = true; toast(compLock.text, 3000); } }); return; } }
      { const wv = waveTarget(); if (wv) { doWave(); return; } }
      { const nr = nearestNpc(2.3, true); if (nr) { greet(nr.n); return; } }
      const n = nearestNpc(2.3); if (n && n.n) { greet(n.n); return; }
      if (n && n.id === 'cat') { if (FREE && FO.catAt && !o.catHelper && o.onNpc) runBusy(() => o.onNpc('cat', api)); else purr(); return; }
      if (o.heroLine) { s.hopT = 0; toast(o.heroLine, 2200); }
    }

    /* ---------- сесть/встать ---------- */
    function standUp() { if (s.sitting && !s.sitting.car) { s.px = s.sitting.from.x; s.pz = s.sitting.from.z; s.sitting = null; hero.body.rotation.x = 0; } }
    function sit(seat = {}) {
      return new Promise(r => {
        standUp();
        const h = seat.h === undefined ? 0.45 : seat.h, ry = seat.ry === undefined ? 0 : seat.ry;
        const from = seat.from ? { x: seat.from[0], z: seat.from[1] } : { x: seat.x + Math.sin(ry) * 0.35, z: seat.z + Math.cos(ry) * 0.35 };
        const go = () => {
          const x0 = s.px, z0 = s.pz, t0 = performance.now(); s.moveTo = null;
          const st = () => { const k = Math.min(1, (performance.now() - t0) / 320); s.px = x0 + (seat.x - x0) * k; s.pz = z0 + (seat.z - z0) * k; if (k < 1 && !s.finished) requestAnimationFrame(st); else { s.sitting = { x: seat.x, z: seat.z, ry, h, from, recline: seat.recline || 0 }; s.ang = ry; r(!s.finished); } };
          st();
        };
        if (Math.hypot(s.px - from.x, s.pz - from.z) < 0.2) go();
        else s.moveTo = { x: from.x, z: from.z, stop: 0.15, script: true, then: ok => { if (ok !== false && !s.finished) go(); else r(false); } };
      });
    }

    /* ---------- WalkApi (§9.2-C): подмножество spotApi улицы + дополнения города ---------- */
    function toScreen(x, y, z) {
      tmpV.set(x, y, z).project(cam);
      const rr = w.root.getBoundingClientRect(), g = G_(), appR = g ? g.app.getBoundingClientRect() : { left: 0, top: 0 };
      return { x: (tmpV.x + 1) / 2 * rr.width + rr.left - appR.left, y: (1 - tmpV.y) / 2 * rr.height + rr.top - appR.top };
    }
    const spawnCat = () => { s.catOn = true; s.catSit = null; cat.root.visible = true; w.catBlob.visible = true; s.catX = s.px - 2.4; s.catZ = s.pz + 0.4; };
    // букет из бутика Жу (волна 4): героиня берёт его с прилавка настоящей рукой, потом — прежний букет «у груди»
    const counterPt = () => (FSH && FSH.counter) || { x: CART.x + 0.28, y: 0.9, z: CART.z + 0.34 };
    function takeBouquet(data) {
      const g = heldModel(w.H, 'bouquet', data), wrap = new T.Group(); wrap.add(g); wrap.name = 'bouquet';
      g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
      Interact.items.wrap(wrap, { up: -0.02, rot: [0.2, 0, -0.3] });
      const cp = counterPt(); wrap.position.set(cp.x, cp.y, cp.z); scene.add(wrap);
      s.held = 'bouquet'; s.heldData = data;
      return IA.play('take', { item: wrap, dist: 0.42 }).then(() => {
        if (IA.holding('L') === wrap) IA.drop('L');
        if (wrap.parent) wrap.parent.remove(wrap); disposeTree(wrap);
        if (!s.finished) setHeld('bouquet', data);
      });
    }
    const api = {
      setHeld: (kind, data) => {
        if (s.finished) return;
        s.heldData = data;
        if (kind === 'bouquet' && IA && window.Interact && s.held !== 'bouquet' && s.mode === 'walk' && !s.sitting && !iaBusy() && Math.hypot(s.px - counterPt().x, s.pz - counterPt().z) < 2.8) { takeBouquet(data); return; }
        setHeld(kind, data);
      },
      celebrate: () => {
        haptic('success'); const sc = toScreen(s.px, 1.6, s.pz), g = G_(); if (g) g.sparkle(sc.x, sc.y, { kind: 'heart', n: 14, dist: 80 });
        if (iaBusy()) { s.celebrateAfter = true; return; }   // руки ещё берут — «ура» после
        s.hopT = 0; if (hero.rig) hero.rig.anim.celebrate();
      },
      // волна 4 — настоящие руки (для мест города и residents.js): есть ли слой, взять покупку, откусить, погладить
      hands: () => !!IA,
      takeItem: o2 => iaTake(o2 || {}),
      nibble: () => iaNibble(),
      petHands: (n, opt) => iaPet(n, opt),
      spin: () => { s.spinT = 0; },
      spawnCat,
      catFree: () => { s.catPin = null; if (s.catSit) { s.catSit = null; s.catOn = true; } },
      catTo: (x, z, opt = {}) => new Promise(r => { if (!s.catOn) return r(); s.catPin = { x, z, ry: opt.ry, y: opt.y }; s.catPinWait.push(r); }),
      catSweater: () => addCatSweater(),
      catHere: () => !!s.catOn,
      sit: seat => sit(seat),
      stand: () => standUp(),
      get isSitting() { return !!(s.sitting && !s.sitting.car); },
      get canRecolor() { return !!(w.H3 || w.hero.doll); },
      setLook: lk => heroLookSet(w, lk || {}),
      look: () => (w.lookId && window.HeroLooks ? Object.assign({ look: w.lookId }, HeroLooks.legacy(w.lookId)) : Object.assign({}, o.hero || {}, w.H3 ? HeroLook3D.look() : w.dollLook || {})),
      walkTo: (x, z) => new Promise(r => { standUp(); s.moveTo = { x, z, stop: 0.15, script: true, then: () => r() }; }),
      heroPos: () => ({ x: s.px, z: s.pz }),
      heroHead: () => heroHeadG(),
      face: ry => { s.faceLock = ry; s.faceLockT = 1e9; },
      faceCamera: () => { s.faceLock = null; s.faceLockT = 0; },
      toScreen,
      finish: v => finish(v, 'api'),
      leave: () => finish('exit', 'api'),
      focusHero: (k = 0.6) => { s.camFocus = { pos: new T.Vector3(s.px - Math.sin(s.yaw) * 5 * (1 - k * 0.5), 2.6, s.pz - Math.cos(s.yaw) * 5 * (1 - k * 0.5)), look: new T.Vector3(s.px, 1.2, s.pz), until: 1e15 }; },
      camFocus: (pos, look) => { s.camFocus = { pos: new T.Vector3(pos[0], pos[1], pos[2]), look: new T.Vector3(look[0], look[1], look[2]), until: 1e15 }; },
      camRelease: () => { s.camFocus = null; },
      dim: () => Promise.resolve(), tween: () => Promise.resolve(), intercept: () => {}, focusMode: () => {},
      get npcs() { return {}; }, get room() { return null; },
      // только в городе
      say: (who, text, ms) => speak(who, text, ms),
      setMarkers: specs => { s.markerSpecs = specs || []; w.markers.set(s.markerSpecs, doors); },
      setHud: card => setHud(card),
      setLit: (bkey, on, anim) => setLit(bkey, on, anim ? (typeof anim === 'number' ? anim : 1200) : 0),
      focusDoor: (id, ms) => focusDoor(id, ms),
      // «Поехать сюда» (мини-карта): героиня у двери / в точке; машина и велосипед остаются там, где их оставили
      travelTo: async spot => {
        if (s.finished || !spot) return;
        if (s.mode === 'ride' && w.bike) { try { await w.bike.dismount({ instant: true }); } catch (e) { /* уже слезла */ } }
        // пока открыта большая карта, кадров нет (loopStop) — выход из машины сразу, без анимации посадки
        if (s.mode === 'drive' && w.carCtl) {
          // посадка или выход ещё идут (кадров нет) — досмотреть их без отрисовки, потом выйти сразу
          for (let i = 0; i < 40 && (w.carCtl.mode === 'enter' || w.carCtl.mode === 'exit'); i++) w.carCtl.update(0.05, null);
          await sleep(0);
          if (s.mode === 'drive') await exitCarCtl({ instant: true });
        } else if (s.mode === 'drive') { exitCar(); for (let i = 0; i < 80 && (s.mode === 'drive' || s.anim); i++) await sleep(25); }
        if (s.anim && s.anim.done) { const a = s.anim; a.done(); }
        standUp(); s.moveTo = null; s.faceLock = null; s.faceLockT = 0;
        placeAt(spot.x, spot.z, spot.ang, spot.yaw);
        emit('world:travel', { door: spot.door || null, x: spot.x, z: spot.z });
      },
      bike: () => w.bike || null,
      unlock: k => unlock(k),
    };
    let catSweaterG = null;
    function addCatSweater() {
      if (catSweaterG || !cat.body) return;
      catSweaterG = new T.Group(); cat.body.add(catSweaterG);
      const H = w.H, knit = H.toon('#FFF1E2'), pinkK = H.toon('#F4C7D0');
      H.put(catSweaterG, H.GEO_HI.cyl, knit, [0, 0.17, 0], [0.16, 0.15, 0.18]);
      H.put(catSweaterG, H.ringG ? H.ringG(0.16, 0.016) : H.GEO.cyl, pinkK, [0, 0.095, 0], [1, 1, 1.1], [PI / 2, 0, 0]);
    }

    /* ---------- конец отрезка ---------- */
    function cleanup() {
      s.finished = true; s.active = false;
      if (w.life) { try { w.life.session(null); } catch (e) { /* ignore */ } }
      if (w.minimap) { try { w.minimap.close(true); } catch (e) { /* ignore */ } }
      loopStop(); bindInput(false);
      ui.sayClear(); ui.setAct(null); ui.setCase(null); ui.setEdge(false); ui.setTag(false); ui.setNear(false); ui.hintOff();
      [ui.horn, ui.bell, ui.color, ui.reset, ui.swap, ui.ck].forEach(el => ui.show(el, false));
      ckSet(false);
      if (ui.joyCtl) { ui.joyCtl.end(); ui.joyCtl.show(false); }
      if (ui.driveCtl) ui.driveCtl.show(false);
      s.actWave = false; ui.setDayNight(false);
      w5Off(); if (w.mv) w.mv.setRun(false);
      if (IA) { try { IA.cancel(); } catch (e) { /* ignore */ } }
      w.root.classList.remove('busy');
      spotMarks.forEach(m => { scene.remove(m); m.material.dispose(); });
      pickups.forEach(pk => { scene.remove(pk.g); if (pk.spr.material.map) pk.spr.material.map.dispose(); pk.spr.material.dispose(); pk.ring.material.dispose(); });
      if (rain) { scene.remove(rain); rain.geometry.dispose(); rain.material.dispose(); rain.userData.tx.dispose(); rain = null; }
      if (s.mode === 'drive') {
        if (w.carCtl) { try { w.carCtl.exit({ instant: true }); } catch (e) { /* ignore */ } if (hero.root.parent !== scene) scene.add(hero.root); }
        else { scene.add(hero.root); scene.add(cat.root); }
        carLights(w, w.cars[w.carKind], false);
        s.mode = 'walk'; s.sitting = null; w.heroBlob.visible = true; const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = true; if (w.heroProxy) w.heroProxy.visible = true;
      }
      if (s.mode === 'ride' && w.bike) { try { w.bike.dismount({ instant: true }); } catch (e) { /* ignore */ } if (hero.root.parent !== scene) scene.add(hero.root); s.mode = 'walk'; }
      if (s.catInBasket && w.bike) { w.bike.uncarry(cat.root, scene); s.catInBasket = false; }
      if (cat.root.parent && cat.root.parent !== scene) scene.add(cat.root);
      hero.root.rotation.x = 0; hero.root.rotation.z = 0;
      if (catSweaterG) { catSweaterG.parent.remove(catSweaterG); catSweaterG = null; }
      if (s.headG) { s.headG.parent.remove(s.headG); s.headG = null; }
      // предмет у бедра — убрать; покупка в настоящей руке остаётся: следующий отрезок сверит её с o.held (тот же предмет — недоеденный)
      if (s.heldG) { if (s.heldG.parent) s.heldG.parent.remove(s.heldG); disposeTree(s.heldG); s.heldG = null; }
      if (!IA) s.held = null;
      // недоеденное — в те же данные, что держит прогулка (town: sess().hd): следующий отрезок выдаст столько же укусов и какао
      { const hi = IA && IA.holding('L'), d = hi && hi.userData.it; if (d && s.held && IA_ITEM[s.held] && s.heldData && typeof s.heldData === 'object') { s.heldData._bites = d.bites || 0; s.heldData._level = d.level; } }
      { const hi = IA && IA.holding('L'); if (hi) hi.visible = true; }
      s.iaDy = 0;
      setHeroOpacity(1);
      s.catPinWait.splice(0).forEach(r => r());
      if (s.moveTo && s.moveTo.then) { const t = s.moveTo.then; s.moveTo = null; t(false); }
      if (s.toastObs) { s.toastObs.disconnect(); s.toastObs = null; }
      if (S === s) S = null;
    }
    function finish(v, how) {
      if (s.finished) return;
      const ms = performance.now() - s.t0;
      cleanup();
      resolve({ v, ms, sideMs: s.sideMs, side: s.side.slice(), how });
    }
    function toMenu() {
      if (s.finished) return;
      const g = G_();
      if (g) { g.skipDialogs(true); document.querySelectorAll('#layer .dlg-wrap, #layer .modal, #layer .remark, #layer .intertitle').forEach(el => el.remove()); setTimeout(() => g.skipDialogs(false), 400); }
      finish('menu', 'menu');
    }
    s.fail = reason => {
      if (s.finished) return;
      const ms = performance.now() - s.t0;
      cleanup();
      resolve({ fail: reason, ms, sideMs: s.sideMs, side: s.side.slice() });
    };

    /* ---------- столкновения ---------- */
    const HR = 0.3;
    function collide(x, z, r, dyn) {
      const B0 = L.bounds;
      for (let pass = 0; pass < 2; pass++) {
        w.grid.near(x - r - 2, x + r + 2, z - r - 2, z + r + 2, c => {
          const dx = x - c.x, dz = z - c.z, m = c.r + r; if (Math.abs(dx) < m && Math.abs(dz) < m) { const d = Math.hypot(dx, dz); if (d < m && d > 1e-5) { x = c.x + dx / d * m; z = c.z + dz / d * m; } }
        }, b => {
          if (b.noWalk === false) return;
          if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
            const dl = x - (b.x0 - r), dr = (b.x1 + r) - x, dn = z - (b.z0 - r), ds = (b.z1 + r) - z, m = Math.min(dl, dr, dn, ds);
            if (m === dl) x = b.x0 - r; else if (m === dr) x = b.x1 + r; else if (m === dn) z = b.z0 - r; else z = b.z1 + r;
          }
        });
        if (dyn) dyn.forEach(c => { const dx = x - c.x, dz = z - c.z, m = c.r + r, d = Math.hypot(dx, dz); if (d < m && d > 1e-5) { x = c.x + dx / d * m; z = c.z + dz / d * m; } });
      }
      return [clamp(x, B0.x0, B0.x1), clamp(z, B0.z0, B0.z1)];
    }
    /* ---------- волна 5: Move (бег, прыжок, верхи, твёрдые машины) и «Бум!» — данные этой прогулки ---------- */
    const mvPool = [], mvArr = [], mvLife = [], mvCar = { type: 'car', src: null, kind: 'coupe' }, mvCar2 = { type: 'car', src: null, kind: 'sedan' }, mvBike = { type: 'bike', src: null };
    s.mvDyn = () => {
      mvArr.length = 0; let k = 0;
      mvLife.length = 0;
      if (w.life) w.life.circles(mvLife); else w.npcs.forEach(n => { if (n.root.visible) mvLife.push({ x: n.x, z: n.z, r: n.id === 'pigeon' ? 0.22 : 0.42 }); });
      for (let i = 0; i < mvLife.length; i++) { const c = mvLife[i], r = mvPool[k] || (mvPool[k] = { type: 'circle', x: 0, z: 0, r: 0.3, id: 'npc' }); k++; r.x = c.x; r.z = c.z; r.r = c.r; mvArr.push(r); }
      // машина — коробками по своей модели (капот, крыша седана, палуба купе): не пройти насквозь, можно запрыгнуть
      if (s.mode === 'walk' && car.root.visible && (!w.carCtl || w.carCtl.mode === 'parked')) { mvCar.src = car; mvCar.kind = car.kind === 'sedan' ? 'sedan' : 'coupe'; mvArr.push(mvCar); }
      { const e2 = spare(); if (e2) { mvCar2.src = e2.car; mvCar2.kind = e2.kind === 'sedan' ? 'sedan' : 'coupe'; mvArr.push(mvCar2); } }
      if (w.bike && bikeMode !== 'none' && !w.bike.mounted && !w.bike.busy) { mvBike.src = w.bike; mvArr.push(mvBike); }
      return mvArr;
    };
    s.mvSay = t => { if (!s.finished && s.active) speak('hero', t, 1400); };
    s.mvFall = k => { if (k === 'back') { s.camInit = false; if (hero.rig) hero.rig.prev = null; } };
    s.mvOn = (n, d) => {
      if (n === 'jump') { sfx('tap'); haptic('light'); }
      else if (n === 'land') { sfx('step', { surface: 'stone' }); if (d && d.kind === 'squash') haptic('medium'); }
      else if (n === 'tumble') { sfx('flutter'); haptic('medium'); }
      else if (n === 'bump') sfx('tap');
      emit('world:move', Object.assign({ ev: n }, d || {}));
    };
    s.mvJumpBtn = () => { if (iaBusy() && !iaFree()) IA.cancel(); };   // прыжок отменяет «сама ест»/действие рук, как джойстик
    // «Бум!»: кого можно трогать — только когда она гуляет свободно (не диалог, не место задания, не лавка, не сидит, не в прыжке)
    s.pfCan = n => (n !== w.catN || (s.catOn && !s.catSit && !s.catInBasket && !s.catPin)) && s.mode === 'walk' && s.active && !s.finished && !s.busy && !s.spotBusy && !s.pkBusy && !s.anim && !s.sitting && !s.inTrip && !blocked()
      && !s.benching && !n.bench && !n.perch && n.act !== 'chat' && n.act !== 'sleep' && n.act !== 'pet' && !(w.mv && (s.air || w.mv.busy()));
    s.pfYaw = y => { s.ang = y; s.faceT = y; s.faceLock = y; s.faceLockT = 0.6; };
    s.pfMove = (dx, dz) => { if (s.mode === 'walk' && !s.finished) { s.px += dx; s.pz += dz; } };
    s.pfOn = (name, d) => {
      if (name === 'hit' || name === 'boop') haptic('light');
      emit('world:pf', Object.assign({ ev: name }, d && typeof d === 'object' ? { npc: d.npc && d.npc.id ? d.npc.id : d.npc, act: d.act, kind: d.kind, combo: d.combo, react: d.react } : {}));
    };
    function w5Off() { if (w.mvUi) w.mvUi.setVisible(false); if (w.pf) w.pf.enable(false); if (w.mv) w.mv.holdRun(false); }
    const dynCircles = () => {
      const out = [];
      if (w.life) w.life.circles(out); else w.npcs.forEach(n => { if (n.root.visible) out.push({ x: n.x, z: n.z, r: n.id === 'pigeon' ? 0.22 : 0.42 }); });
      if (w.bike && !w.bike.mounted && bikeMode !== 'none') { const b = w.bike.pos, fx = Math.sin(w.bike.ry), fz = Math.cos(w.bike.ry); [-0.45, 0, 0.45].forEach(k => out.push({ x: b.x + fx * k, z: b.z + fz * k, r: 0.3 })); }
      if (s.mode === 'walk' && car.root.visible) { const c = car.S, fx = Math.sin(c.ry), fz = Math.cos(c.ry); (car.kind === 'sedan' ? [-1.65, -0.55, 0.55, 1.65] : [-1.1, 0, 1.1]).forEach(k => out.push({ x: c.x + fx * k, z: c.z + fz * k, r: car.kind === 'sedan' ? 0.95 : 0.85 })); }
      return out;
    };

    /* ---------- кадр ---------- */
    function moveInput() {
      if (!canInput()) return null;
      let jx = joy.x, jy = joy.y;
      if (keys.u || keys.d || keys.l || keys.r) { jx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); jy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); }
      const mag = Math.min(1, Math.hypot(jx, jy)); if (mag < 0.05) return null;
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rx = -Math.cos(s.yaw), rz = Math.sin(s.yaw);
      const dx = fx * -jy + rx * jx, dz = fz * -jy + rz * jx, l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l, mag];
    }
    // машина и велосипед от пальца: поворот пальца до 3,4° — прямо, дальше мягко (степень 1,4), с 57° — как есть; дрожь пальца
    // больше не виляет машиной. Только для джойстика (клавиши и автопилот — как раньше)
    function softDir(dir, ry) {
      if (!dir) return dir;
      const e = angDiff(Math.atan2(dir[0], dir[1]), ry), ae = Math.abs(e);
      if (ae >= 1) return dir;
      const g = ae <= 0.06 ? 0 : Math.pow((ae - 0.06) / 0.94, 1.4), a = ry + Math.sign(e) * g;
      return [Math.sin(a), Math.cos(a), dir[2]];
    }
    function arrive(ok) {
      const m = s.moveTo; s.moveTo = null; if (!m) return;
      if (m.then) { m.then(ok); return; }
      if (!ok) return;
      if (m.npc) greet(m.npc);
      else if (m.life) runBusy(() => w.life.tap(m.life));
      else if (m.bike) { if (nearBike()) rideOn(); }
      else if (m.car) { if (nearCar()) enterCar(); }
      else if (m.spare) { const e2 = nearSpare(); if (e2 && takeSpare(e2)) enterCar(); }
      else if (m.door) tryDoor(m.door);
      else if (m.spot) useSpot(m.spot);
    }
    // волна 5: шаг через Move. Игра могла сама поставить героиню (место, руки, лавка, «Бум!») — принять без сброса: рядом — на тот
    // же пол (скамейка, ящик), далеко — на землю. Пока «Бум!» держит позу — джойстик не двигает, но падение/приземление идут.
    function stepMove(dt, inDir, dir, speed) {
      const mv = w.mv;
      if (!(Math.abs(s.px - s.mvX) < 1e-4 && Math.abs(s.pz - s.mvZ) < 1e-4)) {
        const far = !isFinite(s.mvX) || Math.hypot(s.px - s.mvX, s.pz - s.mvZ) > 1.2;
        mv.sync(s.px, far ? undefined : mv.supportAt(s.px, s.pz, s.py), s.pz);
      }
      const lock = !!(w.pf && w.pf.locked());
      const mag = dir && !lock ? (inDir ? dir[2] : 1) : 0;
      let sp = dir && !inDir ? speed : undefined;
      // бег (джойстик или Shift) — к двери/жителю тоже бегом
      if (sp !== undefined && mv.run) sp = Math.max(sp, HS.run || 6.8);
      const st = mv.update(dt, { x: mag ? dir[0] * mag : 0, z: mag ? dir[1] * mag : 0, speed: mag ? sp : undefined });
      s.px = st.pos.x; s.pz = st.pos.z; s.py = st.pos.y; s.floor = st.floor; s.vx = st.vx; s.vz = st.vz; s.air = !st.grounded;
      s.mvX = s.px; s.mvZ = s.pz;
    }
    function stepWalk(dt) {
      if (s.anim) { s.anim.t += dt; const k = Math.min(1, s.anim.t / s.anim.dur); s.anim.tick(k); if (k >= 1 && s.anim) s.anim.done(); return; }
      // волна 4: руки заняты (взять, съесть, погладить) — стоим, корень ведёт слой; палец на джойстике — один мягкий cancel
      if (iaBusy()) {
        const mv = Math.hypot(joy.x, joy.y) > 0.35 || keys.u || keys.d || keys.l || keys.r;
        if (mv && !s.iaCancelled && canInput()) { s.iaCancelled = true; IA.cancel(); }
        s.vx = s.vz = 0; s.walking = false; s.moveT = 0; return;
      }
      s.iaCancelled = false;
      const inDir = moveInput();
      let dir = inDir, speed = 0;
      if (inDir && s.moveTo && !s.moveTo.script) s.moveTo = null;
      if (dir && s.sitting && !s.sitting.car) standUp();
      if (s.sitting && !s.sitting.car && s.moveTo && s.moveTo.door && !s.spotBusy && !s.pkBusy && !blocked()) standUp();   // отложенная дверь
      if (s.sitting) { s.vx = s.vz = 0; s.walking = false; s.py = s.floor = gy(L, s.px, s.pz); s.air = false; return; }
      if (dir) speed = joySpeed(dir[2]);
      else if (s.moveTo && !s.moveTo.script && (blocked() || s.pkBusy || s.spotBusy)) { /* реплика или находка: стоим, потом идём дальше */ }
      else if (s.moveTo) {
        const m = s.moveTo;
        if (!m.wp) { try { m.wp = navOf(w).path(s.px, s.pz, m.x, m.z) || []; } catch (e) { m.wp = []; } }
        let tx = m.x, tz = m.z;
        while (m.wp.length) { const q = m.wp[0]; if (Math.hypot(q[0] - s.px, q[1] - s.pz) < 0.45) m.wp.shift(); else { tx = q[0]; tz = q[1]; break; } }
        const fd = Math.hypot(m.x - s.px, m.z - s.pz), dx = tx - s.px, dz = tz - s.pz, d = Math.hypot(dx, dz) || 1e-6;
        let rest = d; if (m.wp.length) { let px = tx, pz = tz; m.wp.forEach(q => { rest += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }); rest += Math.hypot(m.x - px, m.z - pz); }
        if (fd < (m.stop || 0.2) && !m.wp.length) arrive(true);
        else { dir = [dx / d, dz / d, 1]; speed = m.script ? Math.min(HS.walk, 1.0 + rest * 1.2) : rest > 8 ? HS.jog : Math.min(HS.walk, 1.0 + rest * 0.6); }
      }
      const ox = s.px, oz = s.pz;
      if (w.mv) stepMove(dt, inDir, dir, speed);   // волна 5: бег, прыжок, верхи скамеек/ящиков/машин, твёрдые машины и велосипед
      else {
        const tvx = dir ? dir[0] * speed : 0, tvz = dir ? dir[1] * speed : 0;
        const k = Math.min(1, dt * 10); s.vx += (tvx - s.vx) * k; s.vz += (tvz - s.vz) * k;
        const [nx, nz] = collide(s.px + s.vx * dt, s.pz + s.vz * dt, HR, dynCircles());
        s.px = nx; s.pz = nz;
      }
      const moved = Math.hypot(s.px - ox, s.pz - oz), want = Math.hypot(s.vx, s.vz) * dt;
      if (s.moveTo && !inDir) { s.blockT = moved < want * 0.3 ? s.blockT + dt : 0; if (s.blockT > 0.6) { s.blockT = 0; arrive(Math.hypot(s.moveTo.x - s.px, s.moveTo.z - s.pz) < 1.2); } }
      const sp = Math.hypot(s.vx, s.vz);
      s.walking = sp > 0.25 || s.forceWalk;
      if (sp > 0.25) { s.faceT = Math.atan2(s.vx, s.vz); s.moveT += dt; s.faceLock = s.faceLockT > 1e8 ? s.faceLock : null; } else s.moveT = 0;
      if (s.faceLockT > 0 && s.faceLockT < 1e8) { s.faceLockT -= dt; if (s.faceLockT <= 0) s.faceLock = null; }
      if (!s.walking) s.faceT = s.faceLock !== null ? s.faceLock : Math.atan2(cam.position.x - s.px, cam.position.z - s.pz);
      if (s.spinT >= 0) { s.spinT += dt; s.ang += dt * PI * 2 / 0.8; if (s.spinT > 0.8) s.spinT = -1; }
      else s.ang += angDiff(s.faceT, s.ang) * Math.min(1, dt * (s.walking ? 11 : 4));
      if (sp > 0.05) w.npcs.forEach(n => { if (n.root.visible && !blocked() && s.active && Math.hypot(n.x - s.px, n.z - s.pz) < 2.6 && (!w.life || w.life.canGreet(n))) greet(n, true); });
    }
    function stepRide(dt) {
      const dir = moveInput(); let inp = null;
      if (keys.u || keys.d || keys.l || keys.r) inp = { thr: (keys.u ? 1 : 0) - (keys.d ? 1 : 0), str: (keys.r ? 1 : 0) - (keys.l ? 1 : 0) };
      else if (s.autopilot) { const a = s.autopilot(); inp = a ? { dir: a } : null; }
      else if (dir) inp = { dir: joy.id !== null ? softDir(dir, w.bike.ry) : dir };
      w.bike.update(dt, inp);
      if (s.mode === 'ride') { s.px = w.bike.pos.x; s.pz = w.bike.pos.z; s.ang = w.bike.ry; }
    }
    function stepDrive(dt) {
      const dir = moveInput();
      // телефон: «‹‹» «››» и педали (HUD.driveCtl) — газ, руль, тормоз (стоит — тормоз везёт назад); без газа — накатом
      const dc = ui.driveCtl && ui.driveCtl.vis ? ui.driveCtl.frame(dt) : null;
      let ctl = null;
      if (s.autopilot) ctl = { dir: s.autopilot() };
      else if (keys.u || keys.d || keys.l || keys.r) ctl = { thr: (keys.u ? 1 : 0) - (keys.d ? 1 : 0), str: (keys.r ? 1 : 0) - (keys.l ? 1 : 0) };
      else if (dc) { const fw = car.S.v > 0.6; ctl = { thr: dc.gas ? 1 : dc.brake && !fw ? -1 : 0, str: dc.str, brake: dc.brake && fw, coast: true }; }
      else if (dir) ctl = { dir: joy.id !== null ? softDir(dir, car.S.ry) : dir };
      if (!w.carCtl && s.braking) { ctl = { brake: true }; if (Math.abs(car.S.v) < 0.4) { s.braking = false; exitCar(); return; } }
      const r = w.carCtl ? w.carCtl.update(dt, ctl) : car.update(dt, ctl);
      if (!w.carCtl && r && r.edge && s.onEdge) s.onEdge(r.edge);
      if (r && r.bumped && !s.bumpSaid && !s.benching) { s.bumpSaid = true; speak('car', 'Бум. Машина цела, бордюр обиделся.', 2600); }
      if (car.S.stuckT > 3 && !s.benching) ui.show(ui.reset, true);
      s.px = car.S.x; s.pz = car.S.z;
      w.npcs.forEach(n => { if (!n.root.visible) return; const d = Math.hypot(n.x - car.S.x, n.z - car.S.z), now = performance.now() / 1000; if (d < 7 && Math.abs(car.S.v) > 2 && now - n.honkT > 20 && !s.benching) { n.honkT = now; n.hop(); n.faceCar = 2; speak(n.id, w.life ? w.life.honkLine(n, d) : Math.random() < 0.5 ? WORLD.RESIDENT_HONK[1] : WORLD.RESIDENT_HONK[0], 2000); } });
    }
    function animHero(dt, t) {
      // транспорт: корень героини внутри машины (car.body) или на седле (bike.seat) — позицию не трогаем, позу даёт транспорт
      const veh = s.mode === 'ride' && w.bike ? w.bike : s.mode === 'drive' && w.carCtl ? w.carCtl : null;
      const drive = (s.mode === 'drive' || s.mode === 'ride') && !s.anim;
      const hy = gy(L, s.px, s.pz), mvOn = !!w.mv && s.mode === 'walk' && !s.anim && !s.sitting;
      const fy = mvOn ? s.py : hy;   // волна 5: ноги — на скамейке, ящике, крыше машины или в прыжке (Move)
      if (!drive) { hero.root.position.set(s.px, fy + (s.iaDy || 0), s.pz); hero.root.rotation.y = s.ang; }
      { const fl = mvOn ? s.floor : hy, k = mvOn ? Math.max(0.55, 1 - Math.max(0, s.py - fl) * 0.18) : 1;   // тень на полу, в прыжке — меньше
        w.heroBlob.position.set(s.px, 0.02 + fl, s.pz); w.heroBlob.scale.set(0.8 * k, 0.5 * k, 1); }
      let hop = 0; if (s.hopT >= 0) { s.hopT += dt; hop = Math.sin(Math.min(1, s.hopT / 0.4) * PI) * 0.16; if (s.hopT > 0.4) s.hopT = -1; }
      if (s.waveT >= 0) { s.waveT += dt; if (s.waveT > 1.5) s.waveT = -1; }
      if (hero.rig) {
        const R = hero.rig;
        const dd = R.prev ? Math.hypot(s.px - R.prev.x, s.pz - R.prev.z) : 0;
        const spd = drive || s.sitting ? 0 : dd > 0.6 ? 0 : dd / Math.max(1e-3, dt);
        R.spd += (Math.min(spd, 6) - R.spd) * Math.min(1, dt * 12);
        const tr = R.prev && dt > 0 ? angDiff(s.ang, R.prev.a) / dt : 0;
        R.prev = { x: s.px, z: s.pz, a: s.ang };
        R.sit += ((s.sitting ? 1 : 0) - R.sit) * Math.min(1, dt * 7);
        const sk = R.sit < 0.002 ? 0 : R.sit > 0.998 ? 1 : R.sit, sitE = sk * sk * (3 - 2 * sk);
        let sniff = 0;
        if (s.held === 'bouquet' && !s.walking && !s.sitting && s.active) { s.sniffNext -= dt; if (s.sniffNext <= 0 && s.sniffT < 0) { s.sniffT = 0; s.sniffNext = 7 + Math.random() * 5; } }
        if (s.sniffT >= 0) { s.sniffT += dt; sniff = Math.sin(Math.min(1, s.sniffT / 1.6) * PI); if (s.sniffT > 1.6) s.sniffT = -1; }
        const vst = veh && !s.anim ? veh.animState() : null;
        const ast = Object.assign({
          speed: R.spd, sitting: !!s.sitting, sitPose: s.sitting && (s.sitting.recline || 0) > 0.15 ? 'recline' : 'chair',
          waving: s.waveT >= 0, turnRate: drive ? 0 : tr, celebrate: s.hopT >= 0, idle: !s.walking && !s.sitting && s.active && !blocked(),
          carry: s.held ? (s.held === 'bouquet' ? 'bouquet' : 'item') : false, sniff,
        }, vst, vst && (vst.ride || vst.drive) ? { carry: false } : null);
        // настоящие руки: на время действия слой подменяет скорость/поворот/позу; в машине и на велосипеде слоя нет.
        // Волна 5: прыжок/кувырок (Move) — до рук; «Бум!» (PlayFight) — поверх рук
        let ast2 = ast;
        if (!drive) { if (mvOn) ast2 = w.mv.animState(ast2); if (IA) ast2 = IA.animState(ast2); if (w.pf) ast2 = w.pf.animState(ast2); }
        R.anim.update(dt, ast2);
        if (vst && vst.ride && WORLD.Bike) WORLD.Bike.applyRidePose(R.anim, hero.root, vst.ride);    // запас для HeroAnim без opt.ride (иначе ничего не делает)
        if (vst && vst.drive && WORLD.Car) WORLD.Car.applyDrivePose(R.anim, hero.root, vst.drive);
        if (R.anim.step !== R.step) { R.step = R.anim.step; if (!s.sitting && R.spd > 0.3) sfx('step', { surface: 'stone' }); }
        if (!drive) {
          const seatY = s.sitting ? s.sitting.h + R.seat - R.hip : R.seatY || 0;
          if (s.sitting) R.seatY = seatY;
          hero.body.position.y = seatY * sitE;
          hero.body.rotation.x = -Math.max(0, ((s.sitting && s.sitting.recline) || 0) - 0.24) * sitE;
          if (mvOn) w.mv.pose(dt);   // волна 5: поза прыжка, приземления, кувырка — после тела, до рук
        } else { hero.body.position.y = 0; hero.body.rotation.x = 0; }
        const inner = hero.arms[0].inner;
        if (inner.children.length) {
          const b = R.anim.bones, q = R.q.identity();
          ['hips', 'spine', 'chest', 'shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L'].forEach(n => q.multiply(b[n].quaternion));
          R.qa.identity().slerp(q, 0.25); inner.quaternion.copy(q.invert()).multiply(R.qa);
        }
        if (IA) {
          const hi = IA.holding('L'); if (hi) hi.visible = !drive;            // в машине и на велосипеде покупка «в сумке»
          if (!drive) IA.update(dt);                                           // ПОСЛЕ anim.update и корня: руки, присед, предмет
          if (!iaBusy()) {
            if (s.iaGiveLater) { const nm = s.iaGiveLater; s.iaGiveLater = null; if (!IA.holding('L')) IA.give(nm, 'L'); }
            if (s.hammerLater) { s.hammerLater = false; if (s.held === 'squeaky_hammer' && w.pf) w.pf.giveHammer(); }
            if (s.celebrateAfter) { s.celebrateAfter = false; s.hopT = 0; R.anim.celebrate(); }
            // стоит (или сидит) с покупкой — иногда ест или отпивает сама
            if (s.held && IA_ITEM[s.held] && s.mode === 'walk' && !drive && !s.walking && s.active && !s.busy && !s.spotBusy && !blocked()) { s.nibbleT = (s.nibbleT || 6) - dt; if (s.nibbleT <= 0) { s.nibbleT = 7 + Math.random() * 4; iaNibble(true); } }
          }
        }
      } else if (hero.statue) {
        const U = hero.statue.U, moving = s.walking && !drive;
        if (moving) s.phase = (s.phase || 0) + dt * 10.5;
        s.walkAmt = (s.walkAmt || 0) + ((moving ? 1 : 0) - (s.walkAmt || 0)) * Math.min(1, dt * 10);
        const sw = Math.sin(s.phase || 0) * s.walkAmt;
        U.hdSwing.value = sw * 0.42; U.hdSit.value = s.sitting ? 1 : 0;
        hero.body.position.y = Math.abs(Math.sin(s.phase || 0)) * 0.035 * s.walkAmt + hop + (s.sitting && !drive ? s.sitting.h + 0.12 - U.hdRig.value.y : 0);
        hero.body.rotation.z = Math.sin(s.phase || 0) * 0.105 * s.walkAmt;
        const si = Math.floor((s.phase || 0) / PI); if (moving && si !== s.stepIdx) { s.stepIdx = si; sfx('step', { surface: 'stone' }); }
      } else if (hero.legs) {
        if (s.walking) s.phase = (s.phase || 0) + dt * 10.5;
        hero.legs.forEach((l, i) => { l.rotation.x = (i ? -1 : 1) * Math.sin(s.phase || 0) * (s.walking ? 0.6 : 0); });
        hero.body.position.y = hop;
      }
      if (s.headG && hero.rig) { const R = hero.rig; R.cap += ((hero.beret && hero.beret.visible === false ? 1 : 0) - R.cap) * Math.min(1, dt * 10); }
      // образ: сумочка в машине и на велосипеде прячется, длинный подол подбирается
      if (hero._outfit && window.HeroOutfits) HeroOutfits.update(hero, dt, { drive: s.mode === 'drive' && !s.anim, bike: s.mode === 'ride' && !s.anim, sit: !!s.sitting });
    }
    function animCat(dt, t) {
      if (s.catInBasket) { cat.root.visible = true; w.catBlob.visible = false; cat.body.position.y = Math.abs(Math.sin(t * 5)) * 0.008 * Math.min(1, w.bike ? w.bike.speed : 0); cat.tail.rotation.z = Math.sin(t * 3) * 0.3; return; }
      if (!s.catOn && !s.catSit) { cat.root.visible = false; w.catBlob.visible = false; return; }
      if (s.mode === 'drive' || s.anim) { cat.body.position.y = s.mode === 'drive' ? Math.abs(Math.sin(t * 6)) * 0.01 : 0; cat.tail.rotation.z = Math.sin(t * 3) * 0.25; return; }
      cat.root.visible = true; w.catBlob.visible = true;
      let bx, bz, sitHere = false;
      if (s.catSit) { bx = s.catSit.x; bz = s.catSit.z; sitHere = true; }
      else if (s.catPin) { bx = s.catPin.x; bz = s.catPin.z; }
      else { bx = s.px - Math.sin(s.ang) * 1.0 + Math.cos(s.ang) * 0.55; bz = s.pz - Math.cos(s.ang) * 1.0 - Math.sin(s.ang) * 0.55; }
      const dx = bx - s.catX, dz = bz - s.catZ, d = Math.hypot(dx, dz);
      if (d > 9 && !sitHere && !s.catPin) { s.catX = bx; s.catZ = bz; }
      const spd = d > 0.35 ? Math.min(4.6, d * 3) : 0;
      if (spd > 0) { const [nx, nz] = collide(s.catX + dx / d * spd * dt, s.catZ + dz / d * spd * dt, 0.18); s.catX = nx; s.catZ = nz; s.catAng += angDiff(Math.atan2(dx, dz), s.catAng) * Math.min(1, dt * 9); s.catPhase += dt * 14; }
      else {
        const pinRy = s.catPin && s.catPin.ry !== undefined ? s.catPin.ry : sitHere ? s.catSit.ry : null;
        s.catAng += angDiff(pinRy !== null && pinRy !== undefined ? pinRy : Math.atan2(s.px - s.catX, s.pz - s.catZ), s.catAng) * Math.min(1, dt * 3);
        if (s.catPin && s.catPinWait.length) s.catPinWait.splice(0).forEach(r => r());
      }
      s.catWalk += ((spd > 0 ? 1 : 0) - s.catWalk) * Math.min(1, dt * 8);
      const cy = gy(L, s.catX, s.catZ);
      cat.root.position.set(s.catX, (s.catPin && s.catPin.y && spd === 0 ? s.catPin.y : 0) + cy, s.catZ); cat.root.rotation.y = s.catAng;
      let ch = 0; if (s.catHop >= 0 && s.catHop !== undefined) { s.catHop += dt; ch = Math.sin(Math.min(1, s.catHop / 0.35) * PI) * 0.1; if (s.catHop > 0.35) s.catHop = -1; }
      cat.body.position.y = Math.abs(Math.sin(s.catPhase)) * 0.06 * s.catWalk + ch;
      cat.body.rotation.x = Math.sin(s.catPhase) * 0.06 * s.catWalk;
      cat.tail.rotation.z = Math.sin(t * 2.2) * 0.3; cat.head.rotation.z = Math.sin(t * 0.9) * 0.06;
      w.catBlob.position.set(s.catX, 0.02 + cy, s.catZ);
    }
    function animNpcs(dt, t) {
      if (w.life) return;   // видимость, повороты, позы и контур жителей ведёт жизнь (life.update)
      const cx = s.mode === 'drive' ? car.S.x : s.px, cz = s.mode === 'drive' ? car.S.z : s.pz, Q = w.Q;
      w.npcs.forEach(n => {
        const d = Math.hypot(n.x - cx, n.z - cz);
        const vis = residentsVis[n.id] !== false && d < Q.npcR + 6; n.root.visible = vis; if (!vis) return;
        n.anim(t, dt, s.px, s.pz);
        const olOn = Q.outline !== false && d < (Q.outline === false ? 0 : 18 + (w.qKey === 'lite' ? -6 : 10));
        n.outlines.forEach(m => { m.visible = olOn; });
        let want = n.ry0;
        if (n.faceHero > 0) { n.faceHero -= dt; want = Math.atan2(s.px - n.x, s.pz - n.z); }
        if (n.faceCar > 0) { n.faceCar -= dt; want = Math.atan2(car.S.x - n.x, car.S.z - n.z); }
        n.root.rotation.y += angDiff(want, n.root.rotation.y) * Math.min(1, dt * 4);
      });
    }
    let rain = null;
    function makeRain() {
      const N = 420, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 30 - 15; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = Math.random() * 30 - 15; }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const [rcv, rcx] = WORLD.util.cnv(64, 64); const rgd = rcx.createLinearGradient(0, 0, 0, 64);
      rgd.addColorStop(0, 'rgba(255,255,255,0)'); rgd.addColorStop(0.7, 'rgba(235,240,255,.9)'); rgd.addColorStop(1, 'rgba(255,255,255,0)');
      rcx.strokeStyle = rgd; rcx.lineWidth = 3; rcx.lineCap = 'round'; rcx.beginPath(); rcx.moveTo(35, 2); rcx.lineTo(29, 62); rcx.stroke();
      const tx = new T.CanvasTexture(rcv);
      const p = new T.Points(gg, new T.PointsMaterial({ map: tx, color: 0xDCE4F4, size: 0.34, transparent: true, opacity: 0.6, depthWrite: false }));
      p.frustumCulled = false; scene.add(p); p.userData.tx = tx; return p;
    }
    function animWorld(dt, t) {
      const C = MAP;
      if (C.spray) { const { pts, pos, seeds, N } = C.spray;
        for (let i = 0; i < N; i++) { const sd = seeds[i], p = (t * sd.sp + sd.ph) % 1; let r, y; if (sd.src === 0) { r = p * 1.05; y = 2.4 + Math.sin(p * PI) * 0.75 - p * 0.95; } else { r = 1.15 + p * 0.55; y = 1.5 - p * p * 1.05; } pos[i * 3] = Math.cos(sd.a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(sd.a) * r; }
        pts.geometry.attributes.position.needsUpdate = true; }
      if (C.water) { C.water.material.map.offset.x = t * 0.012; C.water.material.map.offset.y = t * 0.004; }
      if (C.clouds) C.clouds.position.x = Math.sin(t * 0.02) * 8;
      w.toys.update(t);
      if (rain) { const P = rain.geometry.attributes.position, a = P.array; rain.position.set(cam.position.x, 0, cam.position.z); for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * 7.5; a[i] -= dt * 0.8; if (a[i + 1] < 0) { a[i + 1] += 9; a[i] = Math.random() * 30 - 15; } } P.needsUpdate = true; }
      pickups.forEach(pk => { if (pk.taken) return; pk.spr.position.y = 0.6 + Math.sin(t * 2 + pk.ph) * 0.08; const k = (t * 0.7 + pk.ph) % 1; pk.ring.scale.setScalar(1 + k * 0.5); pk.ring.material.opacity = 0.75 * (1 - k); });
      spotMarks.forEach((m, i) => { m.material.rotation = t * 0.6 + i; m.scale.setScalar(0.5 + Math.sin(t * 3 + i) * 0.06); });
    }
    const camPos = new T.Vector3(), lookAt = new T.Vector3(), camWant = new T.Vector3(), camAim = new T.Vector3();
    function updCamera(dt) {
      const drv = s.mode === 'drive', rd = s.mode === 'ride' && !!w.bike;
      const fx = drv ? car.S.x : s.px, fz = drv ? car.S.z : s.pz;
      const kT = s.camInit ? 1 - Math.exp(-dt * 9) : 1; s.tx += (fx - s.tx) * kT; s.tz += (fz - s.tz) * kT;
      const tyT = !drv && !rd && w.mv && s.mode === 'walk' && !s.anim ? s.py : gy(L, fx, fz), kY = s.camInit ? 1 - Math.exp(-dt * (s.air ? 2.5 : 9)) : 1;   // волна 5: в прыжке камера не скачет
      s.ty = (s.ty || 0) + (tyT - (s.ty || 0)) * kY;
      if (keys.q) { s.yaw += dt * 1.8; s.manualT = 3; } if (keys.e) { s.yaw -= dt * 1.8; s.manualT = 3; }
      // стартовый кадр держится, пока героиня стоит; пошла, села, поехала или игрок сам повёл камеру — через 1,2 с обычная камера
      if (s.introCam && (s.walking || s.moveTo || s.mode !== 'walk' || s.anim || s.manualT < 1e8)) { s.introCam = false; s.introWalk = s.walking || !!s.moveTo; if (s.manualT > 1e8) s.manualT = 1.2; if (s.faceLockT > 1e8) { s.faceLock = null; s.faceLockT = 0; } }
      s.manualT = Math.max(0, s.manualT - dt);
      if (drv || rd) { if (s.manualT <= 0) s.yaw += angDiff(drv ? car.S.ry : w.bike.ry, s.yaw) * (1 - Math.exp(-dt / (drv ? 0.35 : 0.5))); }
      else if (s.manualT <= 0 && !s.anim) {
        const onOct = s.pz < 3.4 && s.px > -60 && s.px < 82;   // тротуар Октябрьской: «диорама» — смотрим на фасады
        // пошла со стартового кадра (s.introWalk) — камера за ней, как вне Октябрьской; к фасадам повернётся, когда остановится
        if (s.introWalk && !s.walking) s.introWalk = false;
        if (onOct && !s.introWalk) s.yaw += clamp(angDiff(PI, s.yaw), -1.0 * dt, 1.0 * dt);
        else if (s.walking && s.moveT > 0.7) {
          // камера за героиней — только когда курс ушёл больше чем на 20°, мягко и не быстрее 34°/с: идёт чуть вбок — камера
          // стоит (раньше догоняла с 13° — и героиня ходила кругами)
          const CAM_BAND = 0.35, CAM_T = 1.4, CAM_MAX = 0.6, e = angDiff(s.ang, s.yaw), ae = Math.abs(e);
          if (ae > CAM_BAND && ae < 2.3) s.yaw += clamp((e - Math.sign(e) * CAM_BAND) * (1 - Math.exp(-dt / CAM_T)), -CAM_MAX * dt, CAM_MAX * dt);
        }
      }
      const sp = drv ? Math.abs(car.S.v) / car.VMAX : rd ? w.bike.speed / 5.5 * 0.6 : 0, hd = drv ? car.S.ry : rd ? w.bike.ry : 0;
      let dist = drv ? 11 + sp * 1.5 : rd ? 8.5 + sp : s.dist, hgt = drv ? 5 : rd ? 4.6 : 5.4;
      // за рулём взгляд всегда чуть впереди машины (3,5 м + до 3,5 м на скорости): машина — ниже середины кадра, над кнопками,
      // впереди видно больше дороги (раньше стоя машина висела посреди экрана, а низ кадра закрывали кнопки)
      const f0 = Math.sin(s.yaw), f1 = Math.cos(s.yaw), ahead = drv ? (3.5 + 3.5 * sp) * Math.sign(car.S.v || 1) : rd ? 3 * sp : 0;
      lookAt.set(s.tx + Math.sin(hd) * ahead, (drv ? 1.0 : rd ? 1.2 : 1.35) + (s.ty || 0), s.tz + Math.cos(hd) * ahead);
      // W7 (желание 3): взгляд вверх-вниз пальцем — камера по дуге вокруг точки взгляда: вниз — выше, вверх — ниже и ближе
      // (героиня или машина внизу кадра, выше — небо); у земли камера не ниже 0,45 м (за рулём 0,7) — дальше поднимается сам
      // взгляд (у cam.lookAt ниже). Отпустила палец — на ходу через 4 с, стоя через 10 с наклон плавно возвращается к обычному
      s.pitchT += dt;
      if (s.pitch && (s.pitchT > 10 || (s.pitchT > 4 && (drv || rd || s.walking)))) { s.pitch *= Math.exp(-dt * 1.6); if (Math.abs(s.pitch) < 0.002) s.pitch = 0; }
      const ly = lookAt.y - (s.ty || 0), th0 = -Math.atan2(hgt - ly, dist), thMax = drv ? 0.4 : rd ? 0.56 : 0.62;
      s.pitch = clamp(s.pitch, -0.72 - th0, thMax - th0);
      const th = th0 + s.pitch; s.pitchDeg = th * 180 / PI;
      if (s.pitch) { const R = Math.hypot(dist, hgt - ly), R2 = R * (1 - (drv ? 0.3 : 0.45) * Math.max(0, th) / thMax); dist = R2 * Math.cos(th); hgt = ly - R2 * Math.sin(th); }
      camWant.set(s.tx - f0 * dist, hgt + (s.ty || 0), s.tz - f1 * dist);
      if (s.pitch > 0) { const gMin = gy(L, camWant.x, camWant.z) + (drv ? 0.7 : 0.45); if (camWant.y < gMin) camWant.y = gMin; }
      const tHit = occlude(lookAt, camWant);
      if (tHit < 1) {
        const k = Math.max(0.1, tHit * 0.85), d0 = camWant.distanceTo(lookAt);
        camWant.lerpVectors(lookAt, camWant, k);
        // W7: смотрит вверх, а сзади дом — камера встаёт перед домом низко (подъём «над домом» — только если места совсем мало,
        // ближе 1,3 м): иначе камера, поднятая под крышу, смотрела ещё выше — в кадре одно небо, героини нет
        const upK = th > 0.02 && d0 * k > 1.3 ? Math.min(1, th / 0.2) : 0, lift = lookAt.y + 1.6 + (1 - k) * 4.5;
        camWant.y = Math.max(camWant.y, lift + (camWant.y - lift) * upK);
        if (d0 * k < 3.5 && upK < 0.5) { camWant.x += (lookAt.x - camWant.x) * 0.3; camWant.z += (lookAt.z - camWant.z) * 0.3; }
      }
      w.grid.near(camWant.x - 1, camWant.x + 1, camWant.z - 1, camWant.z + 1, null, bx => { if (camWant.x > bx.x0 && camWant.x < bx.x1 && camWant.z > bx.z0 && camWant.z < bx.z1 && camWant.y < bx.h + 0.8) camWant.y = bx.h + 0.8; });
      if (!s.camInit) { camPos.copy(camWant); s.camInit = true; }
      camPos.lerp(camWant, 1 - Math.exp(-dt * (drv ? 6 : 7)));
      if (s.camFocus) {
        const F = s.camFocus;
        if (performance.now() > F.until || focusDone(F, dt)) s.camFocus = null;
        else { s.focusPos = s.focusPos || camPos.clone(); s.focusPos.lerp(F.pos, 1 - Math.exp(-dt * 4)); s.focusLook = s.focusLook || lookAt.clone(); s.focusLook.lerp(F.look, 1 - Math.exp(-dt * 4)); cam.position.copy(s.focusPos); cam.lookAt(s.focusLook); }
      }
      if (!s.camFocus) {
        s.focusPos = null; s.focusLook = null; cam.position.copy(camPos);
        // взгляд вверх: камера у земли (или поднята домом) — точка взгляда поднимается до нужного наклона
        // W7: героиня (машина) в кадре не ниже ~72 % высоты — над джойстиком и радаром: наклон вверх не больше угла до неё + запас
        if (s.pitch > 0.001) {
          const hz = Math.hypot(lookAt.x - camPos.x, lookAt.z - camPos.z), sub = lookAt.y - (drv ? 0.2 : 0.35);
          const thE = Math.min(th, Math.atan2(sub - camPos.y, Math.max(0.5, hz)) + Math.atan(0.44 * Math.tan(cam.fov * PI / 360)));
          camAim.copy(lookAt); camAim.y = Math.max(lookAt.y, camPos.y + hz * Math.tan(thE)); cam.lookAt(camAim);
        } else cam.lookAt(lookAt);
      }
      // W7 (желание 10): вид «из-за руля» (VILLAGE.drive.cockpit) — камера в салоне; вышла из машины — вид выключается сам;
      // палец — повернуть голову (s.ckLook), через 2,5 с без касаний взгляд плавно возвращается вперёд
      const ckOn = !!(s.ck && s.ck.active);
      if (ckOn) {
        if (s.manualT <= 0 && s.pitchT > 2.5) { const k = Math.exp(-dt * 2.2); s.ckLook.yaw *= k; s.ckLook.pitch *= k; }
        if (!drv || !s.ck.update(dt, car, hero, s.ckLook)) ckSet(false);
      }
      if (s.camOverride) { const v = s.camOverride; cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); }
      if (!ckOn) { const fovT = (w.portrait ? 58 : 48) + sp * 6; if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); } }
      const off = s.off || LOOKS[3].off;
      w.sun.target.position.set(s.tx, 0, s.tz); w.sun.position.set(s.tx + off[0] * 2, off[1] * 2, s.tz + off[2] * 2);
    }
    function occlude(a, b) {
      let tMin = 1;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      w.grid.near(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), null, bx => {
        let t0 = 0, t1 = 1;
        const ax = [[a.x, dx, bx.x0, bx.x1], [a.y, dy, 0, bx.h], [a.z, dz, bx.z0, bx.z1]];
        for (const [p, d, lo, hi] of ax) {
          if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return; continue; }
          let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) [u0, u1] = [u1, u0];
          t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return;
        }
        if (t0 > 0.02 && t0 < tMin) tMin = t0;
      });
      return tMin;
    }
    let detF = 0;
    function updDetail() {
      if (++detF % 5 && !s.detForce) return;
      s.detForce = false;
      const p = cam.position, D = s.overview ? 999 : w.Q.detail;
      w.DETAIL.forEach(m => { const b = m.geometry.boundingBox, dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z); m.visible = Math.hypot(dx, dz) < D; });
    }
    /* ---------- день и ночь (волна 4): строка меню ☰ (HUD v2) «Сейчас вечер · 21:40» + «Вернуться в утро» / «Как на часах», фары, шапка Telegram ---------- */
    const DN_ICON = { morning: '🌄', day: '☀️', golden: '🌅', evening: '🌆', night: '🌙' };
    function dnTick() {
      s.dnDirty = false;
      const D = window.DayNight; if (!w.dn || !D) { ui.setDayNight(false); return; }
      const ov = D.override(), clockPh = D.phaseAt(D.clockHour()), ph = D.phase(), dark = ph === 'night' || ph === 'evening';
      const text = ov !== null ? '🕗 Как на часах' : clockPh === 'night' || clockPh === 'evening' ? '☀️ Вернуться в утро' : '';
      ui.setDayNight(s.active && !s.finished, DN_ICON[ph] || '☀️', text, dark);
      const lamps = w.dn.lampsOn();
      if (lamps !== s.dnLamps) {
        s.dnLamps = lamps;
        try { const g = G_(); if (g && g.tgHeader) g.tgHeader(lamps ? '#1E2A5E' : '#FFF4EC'); } catch (e) { /* ignore */ }
        if (s.mode === 'drive') carLights(w, w.cars[w.carKind], true);
      }
      // первая ночь за сессию игры — подсказка (без имени, не озвучивается) и точка на ☰ (там «Вернуться в утро»)
      if (lamps && dark && s.active && !blocked() && !WORLD._nightHinted) {
        WORLD._nightHinted = true; toast(D.LINES.nightHint, 4200);
        if (window.HUD && text) HUD.menu.news('dn', true);
      }
      if (window.HUD && HUD.menu.isOpen()) HUD.menu.redraw();
    }
    function dnToggle() {
      const D = window.DayNight; if (!D) return;
      const to = D.override() !== null ? null : 'morning';
      D.set(to); haptic('light'); sfx('tap');
      toast(to ? D.LINES.toMorning : D.LINES.toClock, 2400);
      s.dnDirty = true;
    }
    // радар (мини-карта) в углу: прямоугольник для проверок (тесты, старые вызовы)
    let hudR = { t: -1, mm: null };
    function hudRects() {
      const now = performance.now(); if (now - hudR.t < 1000) return hudR;
      hudR = { t: now, mm: null };
      try {
        const el = w.minimap && w.minimap.el ? (w.minimap.el.closest ? (w.minimap.el.closest('.wmm-wrap') || w.minimap.el) : w.minimap.el) : null;
        if (el && el.isConnected) { const r = el.getBoundingClientRect(), rr = w.root.getBoundingClientRect(); if (r.width > 4 && r.height > 4) hudR.mm = { x0: r.left - rr.left, y0: r.top - rr.top, x1: r.right - rr.left, y1: r.bottom - rr.top }; }
      } catch (e) { /* без радара */ }
      return hudR;
    }

    // интерфейс: кнопка действия, подпись у двери, карточка дела, стрелка у края, ярлык метки
    const projV = new T.Vector3();
    function projObj(obj) { obj.getPos(projV); projV.project(cam); if (projV.z > 1) return null; const r = w.root; return { x: (projV.x + 1) / 2 * r.clientWidth, y: (1 - projV.y) / 2 * r.clientHeight }; }
    let uiF = 0;
    function updUI() {
      const busy = s.busy || !s.active || s.finished;
      const blk = blocked();
      const Wd = w.root.clientWidth, Ht = w.root.clientHeight;
      // кнопка действия и подпись
      let lbl = '', soft = false, nearTxt = '', nearPos = null;
      if (!busy && !blk && !s.anim && !s.benching) {
        if (s.mode === 'drive') lbl = w.carCtl && w.carCtl.mode !== 'drive' ? '' : 'Выйти';
        else if (s.mode === 'ride') lbl = w.bike && w.bike.busy ? '' : 'Слезть';
        else if (s.sitting && !s.sitting.car) lbl = 'Встать';
        else {
          const d = nearDoor(), sp = nearSpot();
          if (sp && (!d || Math.hypot(s.px - sp.x, s.pz - sp.z) < Math.hypot(s.px - d.ax, s.pz - d.az))) { lbl = sp.act || 'Смотреть'; nearTxt = (sp.used && sp.bubble2) || sp.bubble || ''; const a = anchorOf(sp); nearPos = [a.x, a.y + 0.9, a.z]; }
          else if (d) { const st = doorState(d); if (d.kind === 'filler') { lbl = 'Постучать'; soft = true; } else if (st.open) lbl = 'Войти' + (st.label ? ' · ' + st.label : ''); else { lbl = 'Закрыто'; soft = true; } nearTxt = d.kind === 'filler' ? '' : st.label || ''; nearPos = [d.x, 3.0, d.z]; }
          else if (nearBike()) { lbl = bikeMode === 'ride' ? 'Сесть на велик' : 'Посмотреть'; soft = bikeMode !== 'ride'; }
          else if (nearGarage()) { lbl = 'Выбрать машину'; }
          else if (nearGarageLocked()) { lbl = 'Посмотреть'; soft = true; }
          else if (nearSpare()) { lbl = 'Сесть за руль'; }
          else if (nearCar()) { lbl = vehicles === 'drive' && !(w.carCtl && w.carCtl.locked) ? 'Сесть за руль' : 'Посмотреть'; soft = lbl !== 'Сесть за руль'; }
          else {
            const la = w.life && w.life.actionFor(s.px, s.pz), n = nearestNpc(2.3), nr = nearestNpc(2.3, true);
            if (la) lbl = la.label;
            else if (waveTarget()) lbl = 'Помахать';
            else if (nr) lbl = 'Поздороваться';
            else if (n && n.id === 'cat' && s.catSit) lbl = 'Позвать кота';
          }
        }
      }
      // HUD v2: без действия рядом P — «👋 Помахать» (пока идёт пешком); s.actLbl — только настоящее действие (пробел — прыжок)
      s.actLbl = lbl;
      s.actWave = !lbl && !busy && !blk && !s.anim && !s.benching && s.mode === 'walk' && !s.sitting;
      if (s.actWave) { lbl = 'Помахать'; soft = true; }
      // за рулём на телефоне: «‹‹» «››» и педали вместо джойстика; в углу P — газ, поэтому «Выйти» — пилюлей A2 над тормозом
      if (ui.driveCtl) ui.driveCtl.show(s.mode === 'drive' && !s.anim && !busy && !blk && !s.benching && (!w.carCtl || w.carCtl.mode === 'drive'));
      const pedals = !!(ui.driveCtl && ui.driveCtl.vis);
      ui.setAct(lbl, soft, pedals ? 'a2' : 'P');
      if (ui.joyCtl) ui.joyCtl.show(!pedals && !busy && !blk && !s.anim && !s.benching && !(s.sitting && !s.sitting.car) && (s.mode === 'walk' || s.mode === 'ride' || (s.mode === 'drive' && (!w.carCtl || w.carCtl.mode === 'drive'))));
      // волна 5: «Прыжок» и «Бум!» — только пешком, вне диалогов, мест, лавок и посадки (в машине и на велосипеде — нет)
      { const walkFree = !busy && !blk && !s.anim && !s.benching && s.mode === 'walk' && !s.sitting && !s.pickBusy;
        if (w.mvUi) w.mvUi.setVisible(walkFree);
        if (w.pf) w.pf.enable(walkFree && !s.spotBusy && !s.pkBusy && !s.inTrip); }
      if (nearTxt && nearPos) { tmpV.set(nearPos[0], nearPos[1], nearPos[2]).project(cam); ui.setNear(tmpV.z < 1, (tmpV.x + 1) / 2 * Wd, (1 - tmpV.y) / 2 * Ht, nearTxt); } else ui.setNear(false);
      const drv = s.mode === 'drive' && !s.anim && !busy && (!w.carCtl || w.carCtl.mode === 'drive');
      ui.show(ui.horn, drv); ui.show(ui.color, drv && car.kind !== 'sedan');   // седан — красный: перекрашивать не даём
      ui.show(ui.ck, drv && !!(s.ck && car.cockpit));
      ui.show(ui.swap, !busy && !blk && !s.anim && s.mode === 'walk' && !s.sitting && !iaBusy() && !nearGarage() && nearCar() && canPickCar() && carAtHome());
      if (w.dn && (uiF % 15 === 0 || s.dnDirty)) dnTick();
      ui.show(ui.bell, s.mode === 'ride' && !busy && !blk && !!w.bike && !w.bike.busy);
      // карточка: расстояние; стрелка у края и ярлык — у главной метки
      const mm = w.markers.main();
      const cardDoor = s.card && s.card.door ? doors.get(s.card.door) : null;
      if (++uiF % 6 === 0 || s.distDirty) { s.distDirty = false; ui.setDist(cardDoor ? Math.hypot(cardDoor.ax - s.px, cardDoor.az - s.pz) : null); }
      // HUD v2: без дела — метка с большой карты «📍 Родник · 120 м» пилюлей цели (снялась — пилюля ушла)
      if (uiF % 10 === 3 && window.HUD && !s.card) {
        let wp = null; try { wp = WORLD.Minimap && WORLD.Minimap.waypoint ? WORLD.Minimap.waypoint() : null; } catch (e) { wp = null; }
        if (wp && wp.rid !== 'city') wp = null;
        const key = wp ? wp.rid + ':' + wp.x + ':' + wp.z : '';
        if (key !== (s.wpKey || '')) { s.wpKey = key; ui.setCase(wp ? { icon: '📍', short: wp.label || 'Метка', title: 'Метка с карты', text: wp.label || 'Метка', tap: 'none', door: null, expand: false } : null); }
        if (wp) HUD.objective.dist(Math.hypot(wp.x - s.px, wp.z - s.pz));
      }
      if (mm && !busy && !blk) {
        const p = w.markers.screenOf(mm, cam, Wd, Ht), dm = Math.round(Math.hypot(mm.door.ax - s.px, mm.door.az - s.pz));
        const name = mm.spec.label || mm.door.short || '';
        if (p.on) { ui.setEdge(false); ui.setTag(dm > 6, p.x, p.y - 26, name); }
        else {
          // HUD v2: шеврон только у левого/правого края и только в верхней половине (не встречается с кластером, джойстиком, тостом)
          ui.setTag(false);
          let vx = p.x - Wd / 2, vy = p.y - Ht / 2; if (p.behind) { vx = -vx; vy = -vy; if (Math.abs(vy) < 1) vy = 1; }
          const side = vx < 0 ? 'l' : 'r';
          const ey = Ht / 2 + vy * Math.min(1e4, (Wd / 2 - 26) / Math.max(1e-3, Math.abs(vx)));
          const sx = window.HUD ? HUD.metrics(Wd, Ht) : null;
          const ex = side === 'l' ? 26 + (sx ? sx.safe.l : 0) : Wd - 26 - (sx ? sx.safe.r : 0);
          const ey2 = window.HUD ? HUD.chevY(ey, Ht) : clamp(ey, 120, Ht / 2 - 60);
          ui.setEdge(true, ex, ey2, side, Math.atan2(vy, vx) * 180 / PI, `${name} · ${dm} м`, dm);
        }
      } else { ui.setEdge(false); ui.setTag(false); }
      ui.placeSay(projObj, Wd, Ht);
    }
    // находки под ногами, авто-точки, лужа, подсказка кота
    function checks(dt) {
      if (!s.active || s.finished || s.busy) return;
      const blk = blocked();
      if (!blk && !s.pkBusy && s.mode === 'walk') pickups.forEach(pk => { if (!pk.taken && Math.hypot(s.px - pk.p.x, s.pz - pk.p.z) < 0.55) collect(pk); });
      if (!blk && !s.spotBusy && !s.moveTo) spots.forEach(sp => { if (sp.auto && !sp.autoDone && Math.hypot(s.px - sp.x, s.pz - sp.z) < 1.6) { sp.autoDone = true; useSpot(sp); } });
      const P = w.toys.puddle, inP = Math.hypot(s.px - P.x, s.pz - P.z) < P.r;
      if (inP && !s.puddleIn && s.mode === 'walk') { s.hopT = 0; haptic('medium'); sfx('flutter'); const Ls = (o.lines && o.lines.puddleSun) || []; if (!s.puddleSaid) { s.puddleSaid = true; toast(Ls[1] || Ls[0] || 'Плюх! Солнце в луже покачнулось и снова засияло.', 2600); } }
      s.puddleIn = inP;
      // кот подсказывает, если она давно далеко от цели
      const nd = ow.nudge !== undefined ? ow.nudge : (story && tgtDoor && o.catHelper ? { after: 90, dist: 25, every: 60, who: 'cat', lines: NUDGE_CAT } : null);
      if (nd && tgtDoor && !blk) {
        const far = Math.hypot(tgtDoor.ax - s.px, tgtDoor.az - s.pz) > (nd.dist || 25);
        s.farT = far ? s.farT + dt : 0;
        const now = performance.now() / 1000;
        if (s.farT > (nd.after || 90) && now - s.nudgeT > (nd.every || 60) && (nd.lines || []).length) {
          s.nudgeT = now; s.nudgeI = (s.nudgeI || 0) + 1;
          const line = nd.lines[(s.nudgeI - 1) % nd.lines.length], who = nd.who === 'cat' && s.catOn ? 'cat' : nd.who === 'cat' ? null : nd.who || 'hero';
          if (who) speak(who, line, 4200); else toast(line, 3600);
        }
      }
    }
    // замер кадров: среднее → низкое → облегчённое → улица (§5.1); в swiftshader/тестах — только по __world.fps(v)
    function fpsLadder(dt) {
      if (s.fpsDone || !s.active || s.busy || s.paused) return;
      const fake = WORLD._fpsOverride;
      if (!fake && (navigator.webdriver || w.soft || (DEBUG && QS.get('world') === 'force'))) { s.fpsDone = true; return; }
      if (s.fpsWait > 0) { s.fpsWait -= dt; return; }
      s.fpsSamples.push(fake ? 1 / fake : dt); s.fpsT += dt;
      if (s.fpsT < 6 && !fake) return;
      if (fake && s.fpsSamples.length < 12) return;
      const a = s.fpsSamples.slice().sort((x, y) => x - y), med = 1 / a[Math.floor(a.length / 2)], p90 = a[Math.floor(a.length * 0.9)] * 1000 * (fake ? 1.3 : 1);
      s.fpsSamples = []; s.fpsT = 0; s.fpsWait = fake ? 0.1 : 2;
      const q = w.qKey;
      if (q === 'high' && med < 34) setQuality('mid');
      else if (q === 'mid' && med < 26) setQuality('low');
      else if (q === 'low' && med < 20) { setQuality('lite'); toast('Город стал легче: так телефону проще.', 2400); }
      else if (q === 'lite' && med < 16 && p90 > 80) { s.fail('fps'); return; }
      else s.fpsDone = true;
      if (env.onQuality) env.onQuality(w.qKey);
    }

    s.update = (dt, t) => {
      if (s.paused) return;
      // джойстик раз в кадр (сила и курс → joy.x/y) и бег — палец за краем кружка (только пешком: в машине и на велосипеде — нет)
      joyRun(s.mode === 'walk' && !s.anim && !s.sitting && !s.busy && !s.finished);
      if (s.mode === 'drive' && !s.anim) stepDrive(dt); else if (s.mode === 'ride' && w.bike) stepRide(dt); else stepWalk(dt);
      if (w.carCtl && s.mode !== 'drive') w.carCtl.update(dt, null);       // посадка/выход идут и в этом кадре
      if (w.bike && s.mode !== 'ride') w.bike.update(dt, null);            // подножка, LOD, высадка
      animHero(dt, t); animCat(dt, t); animNpcs(dt, t);
      if (w.life) w.life.update(dt, t, lifeCtx());
      if (w.pf) w.pf.update(dt);           // волна 5: «Бум!» — после рук и после того, как жизнь поставила жителей
      animWorld(dt, t);
      if (w.bikeRack) w.bikeRack.lod(cam);
      w.markers.update(cam, dt);
      updCamera(dt); updDetail(); updUI(); checks(dt); fpsLadder(dt);
      carLod(false, dt);
      if (w.minimap) w.minimap.update(dt);
    };

    /* ---------- старт отрезка ---------- */
    s.start = async () => {
      setMood(LI, o.justLit && story && LI > 0 ? LI - 1 : undefined);
      initLit();
      vehiclesSetup();
      spawn();
      if (o.held) { if (typeof o.held === 'string') setHeld(o.held); else { s.heldData = o.held.data; setHeld(o.held.kind, o.held.data); } }
      else setHeld(null);   // волна 4: недоеденное с прошлого отрезка — только если прогулка всё ещё считает, что оно в руке
      // волна 5: молоточек из «Юлы» (st.world.hammer) — снова в руке, если рука свободна (покупки и букет — главнее)
      if (!o.held && w.pf && IA && !bouquetNow()) { try { if (wState().hammer && !IA.holding('L')) setHeld('squeaky_hammer'); } catch (e) { /* без молоточка */ } }
      if (o.catSweater) addCatSweater();
      s.catOn = false; s.catSit = null; cat.root.visible = false; w.catBlob.visible = false;
      if (o.catHelper) spawnCat();
      if (FREE && FO.catAt && !o.catHelper) { s.catSit = { x: FO.catAt.x, z: FO.catAt.z, ry: 0 }; s.catX = FO.catAt.x; s.catZ = FO.catAt.z; }
      if (o.rain) rain = makeRain();
      w.toys.setSecret(!!o.secretAvailable);
      s.markerSpecs = markersFor(); w.markers.set(s.markerSpecs, doors);
      setHud(defaultCard());
      host();
      w.root.classList.add('busy');
      bindInput(true); loopStart();
      if (w.life) {
        if (w.life.companion) { w.life.companion.noMeet = w.life.companion.noOffer = !compLock.ok; }
        try { w.life.session(lifeCtx()); } catch (e) { console.warn('world life session', e); }
      }
      emit('world:walk', { mode: FREE ? 'free' : 'story', target: o.target || null });
      // раскрытый дом вливается цветом, город теплеет (как улица)
      if (story && o.justLit) {
        await sleep(500); if (s.finished) return;
        setLit(o.justLit, true, 1200); if (LI > 0) warmUp(LI - 1, LI);
        haptic('success'); sfx('reveal');
        const d = doors.get(o.justLit); if (d) { const sc = toScreen(d.x, 3.4, d.z); const g = G_(); if (g) g.sparkle(sc.x, sc.y, { n: 18, dist: 120 }); w.markers.set(s.markerSpecs.concat([{ id: 'done', door: d.id, style: 'done' }]), doors); }
        await sleep(1300); if (s.finished) return;
        if (o.headline) toast(o.headline, 3000);
      }
      if (o.beforeActive) {
        try { await o.beforeActive(Object.assign({}, api, { spawnCat, get isSitting() { return api.isSitting; } })); } catch (e) { console.warn('world beforeActive', e); }
      }
      if (s.finished) return;
      s.active = true; w.root.classList.remove('busy');
      // первое появление города — подсказка «что тут делать» (один раз)
      if (!wState().guide && (!DEBUG || QS.get('guide') === '1')) guideLater(0);
      if (o.showHint) ui.hintShow(matchMedia('(pointer: coarse)').matches ? 'Кружок внизу — идти · тап по двери — войти' : 'WASD — идти · Enter — действие · Q/E — камера', 4000);
    };
    s.api = api;
    s.dbg = { regionTrip, onEdge, ckSet, rideOn, nearBike, doorState, tryDoor, goDoor, useSpot, spots, pickups, greet, doWave, enterCar, exitCar, doHorn, collect, setLit, focusDoor, placeAt, setHud, speak, lifeCtx, get bikeMode() { return bikeMode; }, get vehicles() { return vehicles; },
      swapCar, pickCar, nearGarage, canPickCar, carAtHome, iaTake, iaNibble, iaPet, takeBouquet, heldDone, dnTick, dnToggle, hudRects };
    return s;
  }

  /* ---------- мелкие строители ---------- */
  let _spark = null, _ring = null;
  function sparkTex() {
    if (_spark) return _spark;
    const [cv, c] = WORLD.util.cnv(64, 64), g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,214,226,.9)'); g.addColorStop(1, 'rgba(255,214,226,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff';
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4, r = i % 2 ? 6 : 26; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.closePath(); c.fill();
    return (_spark = new T.CanvasTexture(cv));
  }
  const ringGeo = () => _ring || (_ring = new T.RingGeometry(0.26, 0.31, 32));
  // находка — рисунок из блокнота (G.FINDS[].art) на спрайте; пока рисунок грузится — искорка
  function findTex(p) {
    const tx = new T.CanvasTexture(sparkTex().image);
    try {
      const g = G_(), f = g && g.FINDS ? g.FINDS.find(x => x.id === p.id) : null;
      const svg = f && typeof f.art === 'function' ? f.art() : null;
      if (svg) {
        const im = new Image();
        im.onload = () => { const [cv, c] = WORLD.util.cnv(128, 128); const gr = c.createRadialGradient(64, 64, 10, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); c.drawImage(im, 18, 18, 92, 92); tx.dispose(); tx.image = cv; tx.needsUpdate = true; };   // другой размер холста — заново выделить текстуру (иначе GL_INVALID_VALUE)
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
    } catch (e) { /* искорка */ }
    return tx;
  }
  // предмет в руке: букет (цвета цветов из Art.FLOWERS), стаканчик, остальное — маленький свёрток
  function heldModel(H, kind, data) {
    const g = new T.Group();
    if (kind === 'bouquet') {
      const d = data || {}, paper = new T.MeshToonMaterial({ color: new T.Color(d.paper || '#E8D3B6'), gradientMap: H.GRAD }), rib = new T.MeshToonMaterial({ color: new T.Color(d.ribbon || '#F08FA8'), gradientMap: H.GRAD });
      const cone = new T.Mesh(H.GEO_HI.cone, paper); cone.scale.set(0.07, 0.2, 0.07); cone.rotation.x = PI; cone.position.y = -0.02; g.add(cone);
      const band = new T.Mesh(H.GEO_HI.cyl, rib); band.scale.set(0.045, 0.02, 0.045); band.position.y = -0.04; g.add(band);
      const FL = (window.Art && Art.FLOWERS) || [];
      const ids = (d.f && d.f.length ? d.f : ['tulip', 'tulip', 'rose']).slice(0, 9);
      ids.forEach((id, i) => {
        const fl = FL.find(x => x.id === id), col = (fl && (fl.color || fl.c || fl.col)) || ['#F08FA8', '#F3CF73', '#C7A8DD', '#EFA3B5', '#FFFDF9'][i % 5];
        const m = new T.Mesh(H.GEO_HI.sph, new T.MeshToonMaterial({ color: new T.Color(col), gradientMap: H.GRAD }));
        const a = i / ids.length * PI * 2, r = i === 0 ? 0 : 0.035 + (i % 2) * 0.012;
        m.position.set(Math.cos(a) * r, 0.1 + (i % 3) * 0.012, Math.sin(a) * r); m.scale.setScalar(0.028); g.add(m);
      });
      const leaf = new T.Mesh(H.GEO_HI.sph, new T.MeshToonMaterial({ color: new T.Color('#8FAE62'), gradientMap: H.GRAD })); leaf.scale.set(0.06, 0.02, 0.06); leaf.position.y = 0.075; g.add(leaf);
      g.scale.setScalar(1.25);
    } else if (kind === 'cup') {
      const d = data || {};
      const cup = new T.Mesh(new T.CylinderGeometry(0.045, 0.034, 0.11, 14), new T.MeshToonMaterial({ color: 0xFFFDF9, gradientMap: H.GRAD })); cup.geometry.userData.own = true; g.add(cup);
      const sl = new T.Mesh(H.GEO_HI.cyl, new T.MeshToonMaterial({ color: 0xF6C6D0, gradientMap: H.GRAD })); sl.scale.set(0.043, 0.04, 0.043); g.add(sl);
      const lq = new T.Mesh(H.GEO_HI.cyl, new T.MeshToonMaterial({ color: new T.Color(d.liquid || '#8B5A3C'), gradientMap: H.GRAD })); lq.scale.set(0.042, 0.006, 0.042); lq.position.y = 0.052; g.add(lq);
    } else {
      const m = new T.Mesh(H.GEO_HI.sph, new T.MeshToonMaterial({ color: 0xFBE1E7, gradientMap: H.GRAD })); m.scale.set(0.05, 0.05, 0.05); g.add(m);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: findTex({ id: kind }), transparent: true, depthWrite: false })); sp.scale.setScalar(0.16); sp.position.y = 0.06; g.add(sp);
    }
    return g;
  }
  function disposeTree(g) { g.traverse(m => { if (m.material) { if (m.material.map && m.material.map !== _spark) m.material.map.dispose(); m.material.dispose(); } if (m.geometry && m.geometry.userData && m.geometry.userData.own) m.geometry.dispose(); }); }

  /* ---------- состояние города в сохранении (st.world, пишет только город) ---------- */
  function wState() {
    const g = G_(); if (!g) return { v: 1, tier: 'auto', why: '', q: null, g: '' };
    const st = g.state(); if (!st.world || typeof st.world !== 'object') st.world = { v: 1, tier: 'auto', why: '', q: null, g: '' };
    return st.world;
  }
  function saveWorld(patch) {
    const g = G_(); const ws = wState(); Object.assign(ws, patch || {});
    if (g) { try { g.save(); } catch (e) { /* ignore */ } }
    return ws;
  }
  // битсет лавок (как D32 в town.js: base32-строка), индекс — порядок в WORLD.INTERIORS
  const genIdx = id => Object.keys(WORLD.INTERIORS || {}).indexOf(id);
  const D32 = '0123456789abcdefghijklmnopqrstuv';
  const bitsGet = s => { let n = 0; for (let i = (s || '').length - 1; i >= 0; i--) n = n * 32 + Math.max(0, D32.indexOf(s[i])); return n; };
  const bitsSet = n => { let s = ''; do { s = s + D32[n % 32]; n = Math.floor(n / 32); } while (n > 0); return s; };
  function hasGeneric(id) { const i = genIdx(id); return i >= 0 && !!(bitsGet(wState().g) & (1 << i)); }
  function markGeneric(id) { const i = genIdx(id); if (i < 0) return; const n = bitsGet(wState().g) | (1 << i); saveWorld({ g: bitsSet(n) }); }

  /* ---------- снаружи ---------- */
  const World = {
    can() { const sp = supported(); return !!(sp.ok && sp.maxTex >= 4096 && WORLD.createKit && WORLD.buildMap && WORLD.makeActors && WORLD.makeDoors && WORLD.makeMarkers && WORLD.makeUI); },
    built: () => !!W,
    building: () => !!buildP && !W,
    build, walk, release, setQuality,
    progress: () => progress, onProgress: f => { progressCbs.add(f); return () => progressCbs.delete(f); },
    pause() { loopStop(); },
    released: () => !!(W && W.released),
    lostCount: () => (W ? W.lost : 0),
    quality: () => (W ? W.qKey : null),
    heroKind: () => (W ? W.heroKind : null),
    doors: () => (W ? W.doors.info() : null),
    session: () => S,
    info: () => (W ? { calls: lastInfo.calls, tris: lastInfo.tris, shCalls: lastInfo.shCalls, shTris: lastInfo.shTris, geometries: W.renderer ? W.renderer.info.memory.geometries : 0, textures: W.renderer ? W.renderer.info.memory.textures : 0, x: S ? S.px : null, z: S ? S.pz : null, mode: S ? S.mode : null, q: W.qKey, buildMs: W.buildMs, hero: W.heroKind, gpu: W.gpu, soft: !!W.soft, active: !!(S && S.active), busy: !!(S && S.busy) } : null),
    saveWorld, wState, hasGeneric, markGeneric,
    QUAL, ORDER,
    _w: () => W, _ft: () => FT.slice(), _info: () => lastInfo, frames: () => frames, perf: () => Object.assign({}, PERF),
  };
  window.World = World;

  /* ---------- отладка и тесты (?debug=1; в --prod вырезается) ---------- */
  if (/debug=1/.test(location.search)) {
    window.__world = {
      get ready() { return !!W; },
      info: () => World.info(),
      tp: (x, z, yaw, dist, hold) => { const s = S; if (!s) return false; s.dbg.placeAt(x, z, (yaw === undefined ? PI : yaw) + PI, yaw === undefined ? PI : yaw); if (dist) s.dist = dist; s.manualT = hold ? 1e9 : 6; return true; },
      door: id => { const s = S; if (!s) return false; const d = W.doors.get(id); if (!d) return false; s.dbg.goDoor(d); return true; },
      doorState: id => { const s = S; if (!s) return null; const d = W.doors.get(id); return d ? s.dbg.doorState(d) : null; },
      plan: () => (S ? S.o : null),
      markers: () => (W ? W.markers.list() : []),
      lit: () => (W ? W.H.MOOD.uLit.value.slice(0, 4) : null),
      sat: () => (W ? W.H.MOOD.uSat.value : null),
      quality: q => setQuality(q),
      fps: v => { WORLD._fpsOverride = v || null; if (S) { S.fpsDone = false; S.fpsSamples = []; S.fpsWait = 0; S.fpsT = 0; } },
      contextLoss: () => { if (!W || !W.renderer) return false; const x = W.renderer.getContext().getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return !!x; },
      pos: () => (S ? { x: S.px, z: S.pz, mode: S.mode, active: S.active, busy: S.busy, walking: S.walking, sitting: !!S.sitting, finished: S.finished, held: S.held, cat: S.catOn } : null),
      walk: (x, z) => { if (S) S.moveTo = { x, z, stop: 0.2 }; },
      use: id => { const s = S; if (!s) return false; const sp = s.dbg.spots.find(q => q.id === id); if (!sp) return false; s.moveTo = { x: sp.x, z: sp.z, stop: 0.25, spot: sp }; return true; },
      greet: id => { const s = S; if (!s) return false; const n = W.npcs.find(q => q.id === id); if (n) s.dbg.greet(n); return !!n; },
      wave: () => S && S.dbg.doWave(),
      bubbles: () => (W ? W.ui.sayList() : []),
      card: () => (S ? S.card : null),
      edge: () => (W && !W.ui.edge.classList.contains('hidden') ? W.ui.edge.textContent : null),
      api: () => (S ? S.api : null),
      car: { enter: () => S && S.dbg.enterCar(true), exit: () => S && S.dbg.exitCar(), honk: () => S && S.dbg.doHorn(), state: () => (W ? Object.assign({ ctl: W.carCtl ? W.carCtl.mode : null, locked: W.carCtl ? W.carCtl.locked : null, kind: W.carKind, visible: W.car.root.visible }, W.car.S) : null), drive: (ms, dir) => new Promise(res => { if (!S) return res(null); S.autopilot = () => dir; setTimeout(() => { if (S) S.autopilot = null; res(W.car.S); }, ms); }),
        kind: () => (W ? W.carKind : null), pick: k => !!(S && S.dbg.swapCar(k)), picker: () => (S ? S.dbg.pickCar() : null), cars: () => (W ? Object.keys(W.cars) : []) },
      // волна 4: настоящие руки, день/ночь
      hands: {
        on: () => !!(W && W.ia), busy: () => !!(W && W.ia && W.ia.busy()), state: () => (W && W.ia ? W.ia.state : null),
        held: () => { const c = W && W.ia && W.ia.holding('L'); return c && c.userData.it ? { name: c.userData.it.name, level: c.userData.it.level, bites: c.userData.it.bites, visible: c.visible } : null; },
        take: (item, kind, from) => (S ? S.dbg.iaTake({ item, kind, from }) : null), nibble: () => (S ? S.dbg.iaNibble() : null),
        pet: id => { const s = S; if (!s || !W.life) return null; const n = W.life.npcs.find(q => q.id === id) || (W.life.companion && W.life.companion.n && W.life.companion.n.id === id ? W.life.companion.n : null); return n ? W.life.pet(n) : null; },
        probe: () => (W && W.ia ? W.ia.probe() : null),
      },
      dn: () => (W && W.dn ? W.dn.info() : null),
      dnClock: h => { if (!window.DayNight) return null; DayNight.setClock(h == null ? null : () => h); if (S) S.dnDirty = true; return DayNight.phase(); },
      dnSet: v => { if (!window.DayNight) return null; DayNight.set(v === undefined ? null : v); if (S) S.dnDirty = true; return DayNight.override(); },
      cam: v => { if (S) S.camOverride = v; },
      // W7: вид «из-за руля» (on: true/false; без аргумента — состояние) и наклон взгляда пальцем
      ck: on => (S ? (on === undefined ? !!(S.ck && S.ck.active) : S.dbg.ckSet(on)) : null), look: () => (S ? { pitch: S.pitch, pitchDeg: S.pitchDeg, yaw: S.yaw, ck: S.ckLook } : null),
      overview: v => { if (!S || !W) return; S.camOverride = v; S.overview = !!v; if (v) { W.scene.fog.near = 400; W.scene.fog.far = 900; W.camera.far = 600; } else { W.scene.fog.near = W.Q.fog[0]; W.scene.fog.far = W.Q.fog[1]; W.camera.far = W.Q.far; } W.camera.updateProjectionMatrix(); },
      doors: () => World.doors(),
      trip: () => (S && S.dbg.regionTrip ? (S.dbg.regionTrip(null), true) : false),
      bike: { mount: () => !!(S && W.bike && S.mode === 'walk' && (S.dbg.rideOn(), true)), dismount: () => W && W.bike && W.bike.dismount(), ring: () => W && W.bike && W.bike.ring(), state: () => (W && W.bike ? Object.assign({ mounted: W.bike.mounted, busy: W.bike.busy, v: W.bike.speed, ry: W.bike.ry, mode: S ? S.mode : null }, W.bike.pos) : null), ride: (ms, dir) => new Promise(res => { if (!S) return res(null); S.autopilot = () => dir; setTimeout(() => { if (S) S.autopilot = null; res(W.bike ? W.bike.pos : null); }, ms); }) },
      life: () => (W ? W.life : null),
      minimap: () => (W ? W.minimap : null),
      // волна 5: бег и прыжок (Move), «Бум!» (PlayFight)
      move: {
        on: () => !!(W && W.mv),
        state: () => { if (!W || !W.mv || !S) return null; const m = W.mv.state; return { x: S.px, z: S.pz, py: S.py, floor: S.floor, air: S.air, grounded: m.grounded, onId: m.onId, mode: m.mode, speed: m.speed, run: W.mv.run, drop: m.drop, busy: W.mv.busy(), btns: !!(W.mvUi && !W.mvUi.el.classList.contains('hide')) }; },
        jump: () => { if (W && W.mv) W.mv.jump(); }, run: b => { if (W && W.mv) W.mv.setRun(b === undefined ? true : !!b); }, hold: b => { if (W && W.mv) W.mv.holdRun(!!b); },
        stats: () => (W && W.mv ? W.mv.stats() : null), support: (x, z, y) => (W && W.mv ? W.mv.supportAt(x, z, y) : null),
      },
      pf: {
        on: () => !!(W && W.pf), state: () => (W && W.pf ? W.pf.state() : null), enabled: () => !!(W && W.pf && W.pf.enabled()),
        target: () => { const n = W && W.pf ? W.pf.target() : null; return n ? n.id : null; }, bonk: () => (W && W.pf ? W.pf.bonk() : null), toss: () => (W && W.pf ? W.pf.toss() : null),
        reaction: id => { const n = W && W.life ? W.life.npcs.concat(W.life.companion && W.life.companion.n ? [W.life.companion.n] : []).find(q => q.id === id) : null; return n && W.pf ? W.pf.reaction(n) : null; },
        hammer: () => !!(W && W.pf && W.pf.hasHammer()), give: () => (S ? (S.api.setHeld('squeaky_hammer'), true) : false),
      },
      unlocks: () => ['companion', 'bike', 'car', 'trip', 'minimap'].reduce((o, k) => { o[k] = unlock(k); return o; }, {}),
      calls: () => lastInfo.calls,
      S: () => S, W: () => W,
    };
  }
})();
