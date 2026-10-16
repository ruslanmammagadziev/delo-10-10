/* =====================================================================
   ХОДЬБА ПЛЮС (волна 5, MOVE): бег, прыжок, запрыгнуть на всё, до чего достаёт, мягкие падения, твёрдые машины.
   Общий модуль для героини-пешехода: город (js/world/main.js) и любой регион (js/world/regions.js — места поездки, отель,
   серпантин). Своё на экране — только облачко пыли/листьев при приземлении (1 вызов отрисовки, InstancedMesh),
   облачко «Ой!» над героиней и мягкая шторка возврата (DOM). Кнопки «Бег» и «Прыжок» — Move.mountButtons.
   Ванильный JS, Three.js r149, без сети. В кадре нет выделений памяти (массивы и объекты — заранее).

   Move.create(o) → mv | null (нет o.ground)
     o = {
       THREE        — по умолчанию window.THREE (нужен для облачка пыли; без него — без облачка),
       hero         — { root, body } (как W.hero / hero регионов) или просто root. body — для кувырка и «приплюснуться»
                      при жёстком приземлении (mv.pose пишет body.position.z, добавляет к body.position.y и rotation.x
                      то, что игра поставила в этом кадре, и body.scale — пока идёт приседание),
       anim         — HeroAnim.create(...) — поза прыжка/полёта/приземления/кувырка поверх (mv.pose); без него — без позы,
       ground(x,z)  — высота земли, м (NaN/undefined → пропасть),
       colliders    — массив или функция → массив, формат js/village/README.md: { type:'box', x,z,w,d,ry,y0,y1,id } /
                      { type:'circle', x,z,r,y0,y1,id }, или городской MAP.colliders { boxes:[{x0,x1,z0,z1,h,noWalk,cam}],
                      circles:[{x,z,r}] }. Перечитывается сам, когда меняется массив или его длина (mv.reindex() — вручную),
       dynColliders — функция → массив (каждый кадр): то же + машины { type:'car', src: car (car.S {x,z,ry,y?} или car.root),
                      kind?: 'coupe'|'sedan' (по умолчанию car.kind) } и велосипед { type:'bike', src: bike (bike.pos, bike.ry) }
                      — ориентированные коробки по Move.PROFILES (капот, крыша, багажник; на седан — до крыши). Скрытая машина
                      (root.visible === false или без родителя) и велосипед под героиней (mounted) не мешают; c.off — тоже,
       safe(x,z)    — можно ли тут стоять (регион: h.walkable). Шагом на «нельзя» не выйти; приземлилась туда — можно только
                      назад, через 1,2 с — мягкий возврат; по умолчанию всё можно,
       onFall(kind, info) — 'land' (обычный прыжок) | 'squash' (1,5–2,5 м) | 'tumble' (кувырок, встала сама) |
                      'respawn' (сейчас будет шторка) | 'back' (вернулась: игре — камеру на место, rig.prev = null);
                      info = { drop, x, y, z, reason },
       on(name, data) — для звука и реплик: jump, land {drop, kind}, tumble, respawn, back, run {on}, bump {id} (упёрлась
                      в машину, не чаще раза в 1,5 с), puff,
       say(text)    — облачко над героиней (игра: bubble/speak 'hero'); без него — своё (нужны camera и host),
       camera, host — для своего облачка и шторки (host — контейнер UI игры; по умолчанию document.body),
       scene        — куда положить облачко пыли (по умолчанию родитель корня героини),
       fxGradientMap — рампа облачка пыли (по умолчанию своя светлая: облачко мягкое, не «камни»), fx: false — без облачка,
       fadeEl: false — без своей шторки (игра закроет экран сама по onFall('respawn'), камера — по 'back'),
       edges        — 'fall' (по умолчанию: со ступени рельефа выше stepDown — падает) | 'soft' (как раньше в городе:
                      обрыв рельефа больше stepUp — стенка; с коробок/машин спрыгнуть можно всегда),
       ledges       — 'guard' (по умолчанию: края террас id/kind 'edge' держат, пока идёт; спрыгнуть — прыжком) |
                      'open' (краёв нет: шагнула с террасы — падает),
       bounds       — { x0, x1, z0, z1 } — рамка (город: L.bounds),
       classify(c)  — свой тип коллайдера: 'solid' | 'wall' | 'tall' | 'ledge' | 'skip' | undefined (по умолчанию),
       speedOf(mag, run) — своя скорость по отклонению джойстика (0..1), м/с,
       face         — false: не считать курс st.ang (игра поворачивает сама),
       writeRoot    — true: самому ставить hero.root.position / rotation.y (стенд); игра обычно ставит сама из st,
       и любые поля Move.CFG (radius, height, apex, air, walkMax, stepUp, boxStep, stepDown, minTop, softDrop, ...)
     }
   Типы коллайдеров (по умолчанию): коробка с y1 — 'solid' (стенка, пока ноги ниже верха; верх — пол, если коробка не уже
     minTop: скамейка, ящик, стенка, крыша, капот); коробка уже minTop (забор 0,2 м) — стенка, перепрыгнуть можно, встать нельзя;
     круг — 'wall' (стволы, жители: встать нельзя); без y1 — 'tall' (не перепрыгнуть); id/kind 'edge' (края террас и
     площадок в регионах) — 'ledge': держит, пока идёт по земле (не упасть случайно), в прыжке — пропускает (прыгнуть с обрыва
     можно), изнутри не выталкивает; c.cam === true и c.noWalk === false — не мешают (только для камеры);
     c.move = 'solid'|'wall'|'tall'|'ledge'|'skip' — тип прямо в коллайдере, c.stand = false — верх не пол.
   mv:
     update(dt, input) → st   — раз в кадр вместо прежнего шага; input = { x, z — направление в мире × сила джойстика 0..1,
                                run?: bool (держать), jump?: bool (фронт → прыжок), speed?: м/с (идти к точке: своя скорость) }
       st = { pos {x,y,z} — ноги (y — с мягким подъёмом на ступеньку), floor — пол под ногами (для тени-кружка),
              vx, vy, vz, speed (горизонтальная, по факту перемещения), grounded, onTop (коллайдер-пол | null; у машины —
              описатель машины из dynColliders), onId (id пола: 'crate', 'hood', 'roof', 'trunk', 'deck', … | ''),
              mode 'walk'|'air'|'tumble'|'getup'|'respawn', air (с), drop (последнее падение, м), ang (курс), run, busy }
     animState(s) → s          — ПЕРЕД anim.update (до IA.animState): в воздухе/кувырке speed 0, idle false (правит s на месте)
     pose(dt)                   — ПОСЛЕ anim.update и после того, как игра поставила hero.body (до IA.update), один раз на
                                  anim.update: колени к груди в полёте, руки чуть вверх, ноги навстречу земле, приседание при
                                  приземлении (стопы на земле), кувырок, «отряхнулась»
     jump() / setRun(b) / toggleRun() / run (bool) / busy() (кувырок или возврат — ввод не слушает)
     teleport(p {x,y?,z}, ry?)  — поставить (сбрасывает скорость, падение, точки возврата); sync(x, y?, z) — игра сама
                                  подвинула героиню (место, лавка, руки): принять без сброса (no-op, если x, z те же;
                                  без y — на землю под точкой). Удобно звать каждый кадр перед update
     lastSafe {x,y,z}           — куда вернёт; supportAt(x, z, y) — пол под точкой (до высоты y + boxStep)
     reindex(), stats() → { colliders, dyn, cand, steps, ms }, dispose()
   Move.mountButtons(host, o) → ui — две большие кнопки справа внизу над кнопкой действия (не мешают джойстику слева):
     «Прыжок» (80 px) и «Бег» (64 px; тап — включить/выключить, держать дольше 0,3 с — бег, пока держит).
     o = { move (mv), onJump(), onRun(on), keys (true — Shift держать бег, Space — прыжок), bottom ('150px'), right ('14px') }
     ui = { el, jump, run, setVisible(b), setRun(b), bind(mv) — новый mv (регион) к тем же кнопкам, dispose() }
   Move.CFG, Move.PROFILES (коробки машин в осях машины: [cx, cz, w, d, верх, тип, id]: coupe, sedan, sedan2 — сам по
   car.dims.length > 4,95, bike), Move.version. Своя машина — { type:'car', src, profile: [[…], …] }.

   Цифры (Move.CFG): прыжок 1,1 м за 0,6 с (g ≈ 24,4 м/с², v0 ≈ 7,3 м/с) — достаёт до 1,0 м (скамейка 0,45, ящик 0,9, капот
   0,93–0,97, с капота — на крышу седана 1,78), 1,3 м — нет; шаг без бега до 2,2 м/с (HeroAnim — шаг), «Бег» — 3,4 (трусца);
   рельеф: подъём шагом ≤ 0,7 м (как раньше в регионах), коробки — бордюр ≤ 0,3 м сама; вниз ≤ 0,45 м за подшаг — идёт,
   больше — падает; падение < 1,5 м — мягкое приземление, 1,5–2,5 — приседание и пыль, 2,5–7,5 м — кувырок «Ух!» и встаёт
   (прыжок с крыши-двора села на улицу ряда ниже: 4,8 + 1,1 м), ≥ 7,5 м или на «нельзя» — «Ой!», шторка 0,4 с и мягко на последнюю безопасную точку (≈ 1 с назад). Подшаги ≤ 0,1 м — сквозь
   стенку не проскочить и при 10 кадрах/с.
   ===================================================================== */
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2, D = PI / 180, INF = 1e9;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angW = a => a - TAU * Math.round(a / TAU);
  const num = v => typeof v === 'number' && v === v && v > -INF && v < INF;
  const SOLID = 1, WALL = 2, TALL = 3, LEDGE = 4;
  const MODES = { solid: SOLID, wall: WALL, tall: TALL, ledge: LEDGE };

  const CFG = {
    radius: 0.3, height: 1.75,
    apex: 1.1, air: 0.6,            // прыжок на ровном: высота ног, м, и время в воздухе, с
    walkMax: 2.2,                   // без «Бега»: потолок шага (у HeroAnim до 2,3 — шаг)
    stepUp: 0.7,                    // рельеф: подъём шагом (как прежняя ходьба регионов)
    boxStep: 0.3,                   // коробки: бордюр/ступенька, на которую заходит сама
    stepDown: 0.45,                 // спуск за подшаг без падения
    minTop: 0.34,                   // коробка уже — не пол (забор, парапет): только перепрыгнуть
    topMargin: 0.12,                // стоит на краю, пока середина не дальше этого за краем верха
    softDrop: 2.5, respawnDrop: 7.5, fallLimit: 10, unsafeT: 1.2, unsafeDrop: 1.5,
    coyote: 0.12, buffer: 0.15,     // прыжок чуть после края и чуть до приземления — засчитывается
    accel: 10, airAccel: 5, vmaxFall: 20, sub: 0.1, maxSub: 24,
    roll: 0.55, getup: 0.45, fade: 0.4,
    rollC: [1.06, 0.28], rollR: 0.65, // кувырок: центр «клубочка» в осях тела (y, z вперёд) и его радиус — катится по земле, голова не уходит под пол (W5A: замер по скину)
    ledges: 'guard',                // края террас/площадок (id/kind 'edge'): 'guard' — держат при ходьбе | 'open' — нет
    sayTumble: ['Ух!', 'Оп-па!', 'Уф!'], sayRespawn: ['Ой!'],
  };
  // машины: коробки в осях машины (+z — вперёд, +x — влево, y = 0 — земля): [cx, cz, w, d, верх, тип, id]
  // замеры моделей js/world/car.js (купе с открытым верхом) и js/vehicles/sedan.js (крыша 1,8 м): plan2/wave5_move.md
  const PROFILES = {
    coupe: [[0, 1.29, 1.62, 1.38, 0.93, 'solid', 'hood'], [0, -1.55, 1.62, 0.96, 0.95, 'solid', 'deck'], [0, -0.22, 1.66, 1.7, 1.3, 'wall', 'cabin']],
    sedan: [[0, 1.6, 1.9, 1.74, 0.97, 'solid', 'hood'], [0, -1.98, 1.9, 0.86, 1.15, 'solid', 'trunk'], [0, -0.42, 1.92, 2.3, 1.42, 'wall', 'cabin'], [0, -0.52, 1.3, 1.54, 1.78, 'solid', 'roof']],
    // седан волны 5 (js/vehicles/sedan_v2.js: длина 5,04, крыша 1,66, капот у носа 0,9–1,0, у стекла 1,1) — выбирается сам по car.dims.length > 4,95
    sedan2: [[0, 1.75, 1.92, 1.5, 1.0, 'solid', 'hood'], [0, -2.05, 1.92, 0.9, 1.22, 'solid', 'trunk'], [0, -0.4, 1.98, 2.4, 1.4, 'wall', 'cabin'], [0, -0.4, 1.3, 1.25, 1.66, 'solid', 'roof']],
    bike: [[0, 0, 0.5, 1.75, 1.05, 'wall', 'bike']],
  };
  // волна 5B: седан волны 5 ещё правят (ниже, уже) — его коробки подгоняются под car.dims (длина/ширина/высота модели) от замера 5,04 × 1,98 × 1,66
  const FIT = new WeakMap(), SEDAN2_REF = { length: 5.04, width: 1.98, height: 1.66 };
  function fitSedan2(s) {
    const d = s.dims || {}, hit = FIT.get(s);
    if (hit && hit.l === d.length && hit.w === d.width && hit.h === d.height) return hit.p;
    const kl = d.length > 3 && d.length < 7 ? d.length / SEDAN2_REF.length : 1, kw = d.width > 1.2 && d.width < 3 ? d.width / SEDAN2_REF.width : 1, kh = d.height > 1 && d.height < 2.5 ? d.height / SEDAN2_REF.height : 1;
    const p = PROFILES.sedan2.map(q => [q[0] * kw, q[1] * kl, q[2] * kw, q[3] * kl, +(q[4] * kh).toFixed(3), q[5], q[6]]);
    FIT.set(s, { l: d.length, w: d.width, h: d.height, p });
    return p;
  }

  function newRec() { return { k: 0, x: 0, z: 0, hw: 0, hd: 0, co: 1, si: 0, r: 0, R: 0, y0: -INF, y1: INF, mode: SOLID, stand: false, id: '', src: null, stamp: 0, dyn: false, desc: null, part: 0, px: 0, pz: 0, pry: 0, pyb: 0 }; }

  // коллайдер игры → запись модуля (false — не мешает)
  function normInto(r, c, cfg, gr, classify) {
    if (!c) return false;
    let m = classify ? classify(c) : undefined;
    if (m === 'skip' || m === false) return false;
    if (m === undefined || m === null) { m = undefined; if (c.cam === true || c.noWalk === false || c.off || c.move === 'skip') return false; }
    r.src = c; r.id = c.id || c.kind || ''; r.dyn = false; r.desc = null; r.part = 0;
    if (c.x0 !== undefined && c.x1 !== undefined && c.z0 !== undefined && c.z1 !== undefined) {   // город: x0..x1 × z0..z1, h — от земли
      r.k = 0; r.x = (c.x0 + c.x1) / 2; r.z = (c.z0 + c.z1) / 2; r.hw = Math.abs(c.x1 - c.x0) / 2; r.hd = Math.abs(c.z1 - c.z0) / 2; r.co = 1; r.si = 0;
      let base = num(c.y0) ? c.y0 : +gr(r.x, r.z); if (!num(base)) base = 0;
      r.y0 = num(c.y0) ? c.y0 : -INF; r.y1 = num(c.y1) ? c.y1 : num(c.h) ? base + c.h : INF;
    } else if (c.type === 'circle' || (c.r !== undefined && c.w === undefined)) {
      if (!num(c.x) || !num(c.z) || !(c.r > 0)) return false;
      r.k = 1; r.x = c.x; r.z = c.z; r.r = c.r; r.hw = r.hd = c.r; r.co = 1; r.si = 0;
      r.y0 = num(c.y0) ? c.y0 : -INF; r.y1 = num(c.y1) ? c.y1 : INF;
    } else {
      if (!num(c.x) || !num(c.z) || !(c.w > 0) || !(c.d > 0)) return false;
      r.k = 0; r.x = c.x; r.z = c.z; r.hw = c.w / 2; r.hd = c.d / 2; const ry = c.ry || 0; r.co = Math.cos(ry); r.si = Math.sin(ry);
      r.y0 = num(c.y0) ? c.y0 : -INF; r.y1 = num(c.y1) ? c.y1 : INF;
    }
    if (m === undefined) m = MODES[c.move] ? c.move : (c.id === 'edge' || c.kind === 'edge') ? (cfg.ledges === 'open' ? 'skip' : 'ledge') : r.k === 1 ? 'wall' : 'solid';
    if (m === 'skip') return false;
    r.mode = MODES[m] || SOLID;
    if (r.y1 >= INF && r.mode !== LEDGE) r.mode = TALL;
    r.stand = (r.mode === SOLID && r.k === 0 && Math.min(r.hw, r.hd) * 2 >= cfg.minTop && c.stand !== false) || (c.stand === true && r.y1 < INF);
    r.R = r.k ? r.r : Math.hypot(r.hw, r.hd);
    return true;
  }

  /* --- стили (вес 0 через :where — игра легко переопределит) --- */
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined') return; cssDone = true;
    const st = document.createElement('style'); st.id = 'move-css';
    st.textContent = `
:where(.mv-btns){position:absolute;right:var(--mv-right,14px);bottom:calc(var(--mv-bottom,150px) + var(--safe-bottom,0px));display:flex;flex-direction:row-reverse;align-items:flex-end;gap:12px;z-index:21;pointer-events:none;-webkit-user-select:none;user-select:none;touch-action:none}
:where(.mv-btns) > button{pointer-events:auto;border:0;padding:0;border-radius:50%;font:inherit;font-weight:900;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:transform .08s,box-shadow .08s,background .15s,color .15s}
:where(.mv-jump){width:80px;height:80px;background:var(--cherry,#C2405B);color:#fff;font-size:15px;box-shadow:0 5px 0 var(--cherry-d,#9E2F47),0 10px 20px rgba(158,47,71,.25)}
:where(.mv-jump) i,:where(.mv-run) i{font-style:normal;font-size:22px;line-height:1}
:where(.mv-jump.down){transform:translateY(4px);box-shadow:0 1px 0 var(--cherry-d,#9E2F47)}
:where(.mv-run){width:64px;height:64px;background:rgba(255,253,249,.95);color:var(--cherry,#C2405B);font-size:14px;box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 18px rgba(58,46,63,.12)}
:where(.mv-run) i{font-size:18px}
:where(.mv-run.on){background:#F7C948;color:#6B3A12;box-shadow:0 4px 0 #C9962A,0 0 0 4px rgba(247,201,72,.35),0 8px 18px rgba(201,150,42,.3)}
:where(.mv-run.down){transform:translateY(3px)}
:where(.mv-btns.hide){display:none}
:where(.mv-say){position:absolute;left:0;top:0;padding:6px 13px;border-radius:15px;background:#FFF0F3;color:#9E2F47;font-weight:900;font-size:17px;line-height:1.2;box-shadow:0 3px 0 rgba(58,46,63,.12);pointer-events:none;z-index:12;opacity:0;white-space:nowrap}
:where(.mv-say)::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#FFF0F3}
:where(.mv-say.on){opacity:1;animation:mvPop .38s cubic-bezier(.2,1.7,.4,1)}
@keyframes mvPop{from{scale:.4}}
:where(.mv-fade){position:absolute;inset:0;pointer-events:none;z-index:40;opacity:0;display:none;background:radial-gradient(circle at 50% 45%,#FFFDF9 0%,#FFF1E8 55%,#F9DCE4 100%)}
`;
    (document.head || document.documentElement).appendChild(st);
  }

  function create(o) {
    o = o || {};
    if (typeof o.ground !== 'function') return null;
    const T = o.THREE || window.THREE || null;
    const cfg = Object.assign({}, CFG);
    for (const k in CFG) if (o[k] !== undefined) cfg[k] = o[k];
    const R = cfg.radius;
    const G = 8 * cfg.apex / (cfg.air * cfg.air), V0 = 4 * cfg.apex / cfg.air;
    const SPEEDS = () => (window.HeroAnim && window.HeroAnim.SPEEDS) || { walk: 2.0, jog: 3.0, run: 3.4 };
    const heroRoot = o.hero ? (o.hero.root || (o.hero.isObject3D ? o.hero : null)) : null;
    const heroBody = o.hero && o.hero.body ? o.hero.body : null;
    const anim = o.anim || null, B = anim && anim.bones ? anim.bones : null;
    const soft = o.edges === 'soft';
    const safeFn = typeof o.safe === 'function' ? o.safe : null;
    const gr = (x, z) => { const g = +o.ground(x, z); return num(g) ? g : -INF; };
    const emit = (n, d) => { if (o.on) { try { o.on(n, d); } catch (e) { /* звук не важнее шага */ } } };
    const fall = (k, info) => { if (o.onFall) { try { o.onFall(k, info); } catch (e) { /* игра сама */ } } };

    /* ---------- состояние ---------- */
    let x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, ang = 0, yDisp = 0;
    let grounded = true, mode = 'walk', onRec = null, airT = 0, peakY = 0, coyoteT = 0, jumpBuf = 0, jumpT = 9, airMax = cfg.walkMax;
    let runOn = false, runHeld = false, prevJumpIn = false, lastDrop = 0, unsafeT = -1, bumpT = 0, curSafe = true, frameN = 0;
    let tumT = 0, getT = 0, rsT = 0, rsLanded = false, rsDone = false, sqT = 9, sqDur = 0.3, sqAmp = 0, sqHard = 0, rollT = -1, dizzy = 0;
    if (heroRoot) { x = heroRoot.position.x; z = heroRoot.position.z; ang = heroRoot.rotation.y; }
    y = num(o.y) ? o.y : gr(x, z); if (!num(y) || y < -INF / 2) y = 0; yDisp = y;
    const st = { pos: { x, y, z }, floor: y, vx: 0, vy: 0, vz: 0, speed: 0, grounded: true, onTop: null, onId: '', mode: 'walk', air: 0, drop: 0, ang, run: false, busy: false };
    const lastSafe = { x, y, z };
    // точки возврата: кольцо из 12, раз в 0,25 с; возврат — на точку ≈ 1 с назад (не к самому краю), второй возврат
    // подряд (в течение 5 с) — ещё дальше назад (≈ 2,5 с): не попадает снова туда же
    const ring = []; for (let i = 0; i < 12; i++) ring.push({ x, y, z, t: -1 });
    let ringN = 0, ringT = 0, clock = 0, rsLast = -99, rsStreak = 0;
    function ringReset(px, py, pz) { for (let i = 0; i < ring.length; i++) { ring[i].x = px; ring[i].y = py; ring[i].z = pz; ring[i].t = -1; } ringN = 0; lastSafe.x = px; lastSafe.y = py; lastSafe.z = pz; }
    ringReset(x, y, z);

    /* ---------- коллайдеры: статические (сетка 4 м) и подвижные (каждый кадр) ---------- */
    const CELL = 4, grid = new Map(), recs = [], cand = [], dyn = [];
    let nDyn = 0, lastSrc = undefined, lastLen = -2, dirty = true, stamp = 1;
    const gkey = (i, j) => (i + 32768) * 65536 + (j + 32768);
    function addList(list) {
      if (!list) return;
      for (let i = 0; i < list.length; i++) { const r = newRec(); if (normInto(r, list[i], cfg, gr, o.classify)) recs.push(r); }
    }
    function reindex() {
      recs.length = 0; grid.clear();
      const src = lastSrc;
      if (src) { if (Array.isArray(src)) addList(src); else { addList(src.boxes); addList(src.circles); } }
      for (let n = 0; n < recs.length; n++) {
        const r = recs[n], i0 = Math.floor((r.x - r.R) / CELL), i1 = Math.floor((r.x + r.R) / CELL), j0 = Math.floor((r.z - r.R) / CELL), j1 = Math.floor((r.z + r.R) / CELL);
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4096) { (grid.get('big') || grid.set('big', []).get('big')).push(r); continue; }   // огромные (граница) — в общий список
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = gkey(i, j); let L = grid.get(k); if (!L) { L = []; grid.set(k, L); } L.push(r); }
      }
      dirty = false;
    }
    function refreshStatic() {
      const src = typeof o.colliders === 'function' ? o.colliders() : o.colliders;
      const len = !src ? -1 : Array.isArray(src) ? src.length : (src.boxes ? src.boxes.length : 0) * 65536 + (src.circles ? src.circles.length : 0);
      if (src === lastSrc && len === lastLen && !dirty) return;
      lastSrc = src; lastLen = len; reindex();
    }
    function gather(x0, x1, z0, z1) {
      cand.length = 0; stamp++;
      const i0 = Math.floor(x0 / CELL), i1 = Math.floor(x1 / CELL), j0 = Math.floor(z0 / CELL), j1 = Math.floor(z1 / CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const L = grid.get(gkey(i, j)); if (!L) continue;
        for (let n = 0; n < L.length; n++) { const r = L[n]; if (r.stamp !== stamp) { r.stamp = stamp; cand.push(r); } }
      }
      const big = grid.get('big'); if (big) for (let n = 0; n < big.length; n++) { const r = big[n]; if (r.stamp !== stamp) { r.stamp = stamp; cand.push(r); } }
    }
    function dynRec() { if (nDyn >= dyn.length) dyn.push(newRec()); return dyn[nDyn++]; }
    function expandVehicle(c) {
      const s = c.src || c;
      if (c.off || s.mounted === true) return;
      const R0 = s.root || s.group || null;
      if (R0 && (R0.visible === false || !R0.parent)) return;
      let px, pz, ry, yb = NaN;
      const S = s.S;
      if (S && num(S.x) && num(S.z)) { px = S.x; pz = S.z; ry = S.ry || 0; if (num(S.y)) yb = S.y; }
      else if (s.pos && num(s.pos.x) && num(s.pos.z)) { px = s.pos.x; pz = s.pos.z; ry = num(s.ry) ? s.ry : 0; if (num(s.pos.y)) yb = s.pos.y; }
      else if (R0) { px = R0.position.x; pz = R0.position.z; ry = R0.rotation.y; yb = R0.position.y; }
      else { px = c.x; pz = c.z; ry = c.ry || 0; yb = c.y; }
      if (!num(px) || !num(pz)) return;
      if (!num(yb)) { yb = gr(px, pz); if (!num(yb) || yb < -INF / 2) yb = 0; }
      let kind = c.kind || (c.type === 'bike' ? 'bike' : s.kind === 'sedan' ? 'sedan' : 'coupe');
      if (kind === 'sedan' && s.dims && s.dims.length > 4.95) kind = 'sedan2';   // новый седан — свои коробки
      const prof = c.profile || (kind === 'sedan2' ? fitSedan2(s) : PROFILES[kind]) || PROFILES.coupe;
      const co = Math.cos(ry), si = Math.sin(ry);
      for (let i = 0; i < prof.length; i++) {
        const p = prof[i], r = dynRec();
        r.k = 0; r.x = px + p[0] * co + p[1] * si; r.z = pz - p[0] * si + p[1] * co; r.hw = p[2] / 2; r.hd = p[3] / 2; r.co = co; r.si = si;
        r.y0 = yb - 0.5; r.y1 = yb + p[4]; r.mode = MODES[p[5]] || SOLID; r.stand = r.mode === SOLID; r.R = Math.hypot(r.hw, r.hd);
        r.id = p[6] || kind; r.src = c; r.dyn = true; r.desc = c; r.part = i; r.px = px; r.pz = pz; r.pry = ry; r.pyb = yb;
      }
    }
    function refreshDyn() {
      nDyn = 0;
      const list = typeof o.dynColliders === 'function' ? o.dynColliders() : o.dynColliders;
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const c = list[i]; if (!c) continue;
        if (c.type === 'car' || c.type === 'bike' || c.type === 'vehicle') { expandVehicle(c); continue; }
        const r = dynRec();
        if (!normInto(r, c, cfg, gr, o.classify)) { nDyn--; continue; }
        r.dyn = true; r.desc = c; r.part = 0; r.px = r.x; r.pz = r.z; r.pry = 0; r.pyb = r.y1;
      }
    }

    /* ---------- геометрия записи ---------- */
    let LX = 0, LZ = 0;
    function loc(r, px, pz) { const dx = px - r.x, dz = pz - r.z; LX = dx * r.co - dz * r.si; LZ = dx * r.si + dz * r.co; }
    function inside(r, px, pz, m) {
      if (r.k === 1) { const dx = px - r.x, dz = pz - r.z, rr = r.r + m; return dx * dx + dz * dz <= rr * rr; }
      loc(r, px, pz); return Math.abs(LX) <= r.hw + m && Math.abs(LZ) <= r.hd + m;
    }
    function distTo(r, px, pz) {
      if (r.k === 1) return Math.max(0, Math.hypot(px - r.x, pz - r.z) - r.r);
      loc(r, px, pz); const ex = Math.max(0, Math.abs(LX) - r.hw), ez = Math.max(0, Math.abs(LZ) - r.hd); return Math.hypot(ex, ez);
    }
    // стенка ли запись для героини на высоте y (ноги) в этом подшаге
    function blocks(r, px, pz) {
      if (y + cfg.height <= r.y0) return false;          // проходит под
      if (r.mode === LEDGE) {
        if (!grounded || y >= r.y1) return false;          // в прыжке край пропускает
        return distTo(r, px, pz) >= R - 0.02;              // изнутри не выталкивает (приземлилась на кромку — выйдет сама)
      }
      const tol = r.stand && grounded ? cfg.boxStep : 0.02;
      return y < r.y1 - tol;
    }
    // вытолкнуть круг героини из записи; true — сдвинула
    function push(r, px, pz) {
      const m = r.R + R;
      if (Math.abs(x - r.x) > m || Math.abs(z - r.z) > m) return false;
      if (!blocks(r, px, pz)) return false;
      if (r.k === 1) {
        const dx = x - r.x, dz = z - r.z, mm = r.r + R, d = Math.hypot(dx, dz);
        if (d >= mm) return false;
        if (d < 1e-6) { x = r.x + mm; } else { x = r.x + dx / d * mm; z = r.z + dz / d * mm; }
        return true;
      }
      loc(r, x, z);
      let lx = LX, lz = LZ;
      const hw = r.hw, hd = r.hd, cx = clamp(lx, -hw, hw), cz = clamp(lz, -hd, hd), ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
      if (d >= R) return false;
      if (d > 1e-6) { lx = cx + ex / d * R; lz = cz + ez / d * R; }
      else { const pl = lx + hw, pr = hw - lx, pn = lz + hd, pf = hd - lz, mn = Math.min(pl, pr, pn, pf); if (mn === pl) lx = -hw - R; else if (mn === pr) lx = hw + R; else if (mn === pn) lz = -hd - R; else lz = hd + R; }
      x = r.x + lx * r.co + lz * r.si; z = r.z - lx * r.si + lz * r.co;
      if (r.dyn && grounded && r.desc && bumpT <= 0 && (r.desc.type === 'car' || r.desc.type === 'bike')) { bumpT = 1.5; emit('bump', { id: r.id, kind: r.desc.kind || r.desc.type }); }
      return true;
    }
    function collidePass(px, pz) {
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (let i = 0; i < cand.length; i++) if (push(cand[i], px, pz)) moved = true;
        for (let i = 0; i < nDyn; i++) if (push(dyn[i], px, pz)) moved = true;
        if (!moved) break;
      }
    }
    // пол под точкой: земля и верхи коллайдеров не выше limit
    let supRec = null;
    function supportCols(px, pz, limit, floorY) {
      let best = floorY; supRec = null;
      for (let i = 0; i < cand.length; i++) {
        const r = cand[i]; if (!r.stand || r.y1 > limit || r.y1 <= best) continue;
        if (Math.abs(px - r.x) > r.R + cfg.topMargin || Math.abs(pz - r.z) > r.R + cfg.topMargin) continue;
        if (inside(r, px, pz, cfg.topMargin)) { best = r.y1; supRec = r; }
      }
      for (let i = 0; i < nDyn; i++) {
        const r = dyn[i]; if (!r.stand || r.y1 > limit || r.y1 <= best) continue;
        if (inside(r, px, pz, cfg.topMargin)) { best = r.y1; supRec = r; }
      }
      return best;
    }
    function support(px, pz, limit) { return supportCols(px, pz, limit, gr(px, pz)); }
    // можно ли сделать шаг по рельефу (подъём, обрыв в «мягком» режиме, «нельзя»)
    function terrOk(px, pz, nx, nz) {
      const g = gr(nx, nz), tol = grounded ? cfg.stepUp : 0.05;
      if (g > y + tol) return false;
      const ddx = nx - px, ddz = nz - pz, dl = Math.hypot(ddx, ddz);
      if (dl > 1e-6) { const g2 = gr(nx + ddx / dl * R * 0.8, nz + ddz / dl * R * 0.8); if (g2 > y + tol && g2 > g + 0.25) return false; }
      if (grounded && (safeFn || soft)) {
        const top = supportCols(nx, nz, y + cfg.boxStep, g) > g;   // там будет стоять на коробке — рельеф не важен
        if (!top) {
          if (soft && onRec === null && g < y - cfg.stepUp) return false;
          if (safeFn && g >= y - cfg.unsafeDrop && !safeFn(nx, nz)) {   // граница «нельзя» на ровном (и ямка до 1,5 м) — стенка; обрыв — падение
            if (curSafe) return false;
            const d0 = (px - lastSafe.x) * (px - lastSafe.x) + (pz - lastSafe.z) * (pz - lastSafe.z), d1 = (nx - lastSafe.x) * (nx - lastSafe.x) + (nz - lastSafe.z) * (nz - lastSafe.z);
            if (d1 > d0 - 1e-6) return false;   // уже на «нельзя»: только назад
          }
        }
      }
      return true;
    }

    /* ---------- шаг ---------- */
    function stepOnce(h, sx, sz) {
      const px = x, pz = z;
      if (sx !== 0 || sz !== 0) {
        if (terrOk(px, pz, px + sx, pz + sz)) { x = px + sx; z = pz + sz; }
        else if (sx !== 0 && terrOk(px, pz, px + sx, pz)) x = px + sx;
        else if (sz !== 0 && terrOk(px, pz, px, pz + sz)) z = pz + sz;
      }
      collidePass(px, pz);
      if ((x !== px || z !== pz) && !terrOk(px, pz, x, z)) { x = px; z = pz; collidePass(px, pz); }
      if (o.bounds) { const b = o.bounds; x = clamp(x, b.x0, b.x1); z = clamp(z, b.z0, b.z1); }
      if (grounded) {
        const S = support(x, z, y + cfg.boxStep);
        if (S >= y - cfg.stepDown) { y = S; onRec = supRec; }
        else { grounded = false; vy = 0; coyoteT = cfg.coyote; peakY = y; airT = 0; onRec = null; if (mode === 'walk') mode = 'air'; }
      } else {
        const yPrev = y;
        if (mode === 'respawn' && !rsLanded) {   // возврат в полёте: мультяшно «зависает» и медленно опускается, пока шторка
          const v1 = vy + (-3.5 - vy) * (1 - Math.exp(-7 * h)); y += (vy + v1) * 0.5 * h; vy = v1;
        } else if (vy > -cfg.vmaxFall) {          // точная парабола на подшаге (высота прыжка не зависит от частоты кадров)
          const v1 = Math.max(vy - G * h, -cfg.vmaxFall); y += (vy + v1) * 0.5 * h; vy = v1;
        } else y += vy * h;
        if (y > peakY) peakY = y;
        if (vy > 0) ceiling(yPrev);
        const S = support(x, z, Math.max(yPrev, y) + 0.05);
        if (y <= S) { y = S; land(supRec); }
      }
    }
    function ceiling(yPrev) {
      const head = y + cfg.height, headPrev = yPrev + cfg.height;
      for (let pass = 0; pass < 2; pass++) {
        const list = pass ? dyn : cand, n = pass ? nDyn : cand.length;
        for (let i = 0; i < n; i++) {
          const r = list[i];
          if (r.y0 <= -INF / 2 || r.y0 < headPrev - 0.01 || r.y0 > head || r.mode === LEDGE) continue;
          if (inside(r, x, z, R * 0.5)) { y = r.y0 - cfg.height; vy = 0; }
        }
      }
    }
    function land(rec) {
      const drop = Math.max(0, peakY - y);
      grounded = true; vy = 0; onRec = rec; lastDrop = drop; airT = 0; coyoteT = 0;
      const safeLand = rec ? true : (!safeFn || safeFn(x, z));
      const info = { drop: +drop.toFixed(2), x, y, z, reason: '' };
      if (mode === 'respawn') return;
      if (drop >= cfg.respawnDrop || (!safeLand && drop >= cfg.softDrop)) { info.reason = safeLand ? 'high' : 'unsafe'; startRespawn(true, info); return; }
      if (drop >= cfg.softDrop) { startTumble(info); return; }
      mode = 'walk';
      unsafeT = safeLand ? -1 : 0;
      if (drop >= 1.5) { squash(clamp(drop / 2.5, 0.6, 1), 0.42, 1); puff(x, y, z, 0.5); fall('squash', info); emit('land', { drop: info.drop, kind: 'squash' }); }
      else if (drop >= 0.3) { squash(clamp(drop / 2.2, 0.22, 0.6), 0.3, 0); if (drop > 0.9) puff(x, y, z, 0.18); fall('land', info); emit('land', { drop: info.drop, kind: 'land' }); }
      else squash(0.12, 0.2, 0);
    }
    function squash(a, dur, hard) { sqT = 0; sqDur = dur; sqAmp = a; sqHard = hard; }
    function doJump() {
      grounded = false; vy = V0; coyoteT = 0; peakY = y; airT = 0; jumpT = 0; onRec = null; mode = 'air'; unsafeT = -1;
      airMax = Math.max(Math.hypot(vx, vz), cfg.walkMax);
      emit('jump', { x, y, z });
    }
    const FW = [0, 0];
    function setFwd() { const sp = Math.hypot(vx, vz); if (sp > 0.3) { FW[0] = vx / sp; FW[1] = vz / sp; } else { FW[0] = Math.sin(ang); FW[1] = Math.cos(ang); } }
    function startTumble(info) {
      mode = 'tumble'; tumT = 0; rollT = 0; setFwd(); vx = FW[0] * 1.7; vz = FW[1] * 1.7;
      puff(x, y, z, 1); sayRand(cfg.sayTumble); fall('tumble', info); emit('tumble', info);
    }
    function startRespawn(landed, info) {
      mode = 'respawn'; rsT = 0; rsLanded = landed; rsDone = false; unsafeT = -1; fallP.x = x; fallP.z = z;
      if (landed) { rollT = 0; setFwd(); vx = FW[0] * 1.5; vz = FW[1] * 1.5; puff(x, y, z, 1); }
      sayRand(cfg.sayRespawn); fall('respawn', info); emit('respawn', info);
    }
    const fallP = { x: 0, z: 0 };
    function respawnTarget() {
      // точка ≈ 1 с назад (4 записи), иначе самая старая из записанных, иначе lastSafe
      let best = null;
      rsStreak = clock - rsLast < 5 ? rsStreak + 1 : 0; rsLast = clock;
      if (ringN > 0) { const back = Math.min(ringN - 1, ring.length - 1, 3 + rsStreak * 6); best = ring[(ringN - 1 - back) % ring.length]; }
      return best || lastSafe;
    }
    function teleportTo(px, py, pz, keepRing) {
      x = px; z = pz; vx = vz = vy = 0;
      refreshStatic(); refreshDyn(); gather(x - 2, x + 2, z - 2, z + 2);
      const S = support(x, z, (num(py) ? py : gr(x, z)) + cfg.boxStep);
      y = num(S) && S > -INF / 2 ? S : (num(py) ? py : 0); yDisp = y; onRec = supRec;
      grounded = true; mode = 'walk'; airT = 0; peakY = y; coyoteT = 0; jumpBuf = 0; rollT = -1; unsafeT = -1; carryP.desc = null;
      if (!keepRing) ringReset(x, y, z);
      writeSt();
    }

    /* ---------- кадр ---------- */
    let lastMs = 0, lastSteps = 0;
    function update(dt, inp) {
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      dt = clamp(+dt || 0, 0, 0.1); frameN++; clock += dt;
      refreshStatic(); refreshDyn();
      carry();
      // ввод
      let ix = 0, iz = 0, mag = 0, runNow = runOn || runHeld, sp = NaN;
      if (inp) {
        ix = +inp.x || 0; iz = +inp.z || 0; if (!num(ix) || !num(iz)) ix = iz = 0;
        if (inp.run !== undefined) runNow = runNow || !!inp.run;
        if (inp.jump && !prevJumpIn) jumpBuf = cfg.buffer;
        prevJumpIn = !!inp.jump;
        if (num(inp.speed)) sp = inp.speed;
      }
      mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; mag = 1; }
      const locked = mode === 'tumble' || mode === 'getup' || mode === 'respawn';
      let tv = 0;
      if (!locked && mag > 0.05) tv = num(sp) ? Math.max(0, sp) : o.speedOf ? +o.speedOf(mag, runNow) || 0 : speedOf(mag, runNow);
      const ux = mag > 1e-6 ? ix / mag : 0, uz = mag > 1e-6 ? iz / mag : 0;
      if (locked) { const k = Math.exp(-(mode === 'respawn' && !rsLanded ? 2.5 : 3.2) * dt); vx *= k; vz *= k; }
      else if (grounded) { const k = 1 - Math.exp(-cfg.accel * dt); vx += (ux * tv - vx) * k; vz += (uz * tv - vz) * k; }
      else { tv = Math.min(tv, airMax); const k = 1 - Math.exp(-cfg.airAccel * dt); if (mag > 0.05) { vx += (ux * tv - vx) * k; vz += (uz * tv - vz) * k; } }
      // прыжок: кнопка чуть раньше приземления или чуть позже края — засчитывается
      if (jumpBuf > 0) jumpBuf -= dt;
      if (coyoteT > 0) coyoteT -= dt;
      if (jumpBuf > 0 && !locked && (grounded || coyoteT > 0)) { jumpBuf = 0; doJump(); }
      if (bumpT > 0) bumpT -= dt;
      // безопасно ли там, где стоит (для «на нельзя шагом не выйти»)
      curSafe = !grounded || onRec !== null || !safeFn || !!safeFn(x, z);
      // подшаги: не больше cfg.sub по горизонтали и по вертикали
      const mx = vx * dt, mz = vz * dt, hz = Math.hypot(mx, mz);
      const vyMax = grounded ? 0 : Math.max(Math.abs(vy), Math.abs(vy - G * dt));
      const n = clamp(Math.ceil(Math.max(hz, vyMax * dt) / cfg.sub), 1, cfg.maxSub);
      const ext = hz + R + 1.2;
      gather(x - ext, x + ext, z - ext, z + ext);
      const ox = x, oz = z, h = dt / n;
      for (let s = 0; s < n; s++) stepOnce(h, mx / n, mz / n);
      if (!num(x) || !num(y) || !num(z)) { x = lastSafe.x; y = lastSafe.y; z = lastSafe.z; vx = vy = vz = 0; grounded = true; mode = 'walk'; }
      lastSteps = n;
      // время в воздухе, падение «в никуда» (глубже fallLimit) — возврат прямо в полёте
      if (!grounded) {
        airT += dt; jumpT += dt;
        if (mode === 'walk') mode = 'air';
        // глубоко: уже ниже края на 2,5 м, а пол под ней так низко, что падение выйдет ≥ respawnDrop (или там «нельзя»),
        // и до него ещё больше 2 м — возврат прямо в полёте (мягко «зависает», шторка), до дна не долетает
        if (mode === 'air' && vy < 0 && peakY - y > cfg.softDrop) {
          const fb = support(x, z, y), deep = peakY - fb >= cfg.respawnDrop || (safeFn && supRec === null && !safeFn(x, z));
          if ((deep && y - fb > 2) || peakY - y > cfg.fallLimit || airT > 4 || y < lastSafe.y - 40) startRespawn(false, { drop: +(peakY - y).toFixed(2), x, y, z, reason: 'deep' });
        }
      } else jumpT += dt;
      // кувырок → встаёт
      if (mode === 'tumble') { tumT += dt; if (tumT >= cfg.roll) { mode = 'getup'; getT = 0; squash(1, cfg.getup + 0.1, 1); dizzy = 1; } }
      else if (mode === 'getup') { getT += dt; vx *= 0.8; vz *= 0.8; if (getT >= cfg.getup) { mode = 'walk'; } }
      if (rollT >= 0) { rollT += dt; if (rollT > cfg.roll + 0.05) rollT = -1; }
      if (dizzy > 0) dizzy = Math.max(0, dizzy - dt / 0.9);
      // возврат: (кувырок) → шторка → на безопасную точку → шторка уходит
      if (mode === 'respawn') respawnStep(dt);
      // приземлилась на «нельзя» (кромка, за краем) — назад шагом или мягкий возврат
      if (mode === 'walk' && grounded && onRec === null && safeFn) {
        if (!safeFn(x, z)) { if (unsafeT < 0) unsafeT = 0; unsafeT += dt; if (unsafeT > cfg.unsafeT) startRespawn(false, { drop: 0, x, y, z, reason: 'unsafe' }); }
        else unsafeT = -1;
      }
      // точки возврата
      if (mode === 'walk' && grounded && (onRec === null ? (!safeFn || safeFn(x, z)) : !onRec.dyn)) {
        ringT += dt;
        if (ringT >= 0.25 || ringN === 0) { ringT = 0; const p = ring[ringN % ring.length]; p.x = x; p.y = y; p.z = z; p.t = clock; ringN++; lastSafe.x = x; lastSafe.y = y; lastSafe.z = z; }
      }
      // курс
      const mvx = (x - ox) / Math.max(1e-4, dt), mvz = (z - oz) / Math.max(1e-4, dt), msp = Math.hypot(mvx, mvz);
      st.speed = dt > 0 ? lerp(st.speed, Math.min(msp, 6), 1 - Math.exp(-14 * dt)) : st.speed;
      if (o.face !== false && !locked) {
        const hv = Math.hypot(vx, vz);
        if (hv > 0.25 && mag > 0.05) ang += angW(Math.atan2(vx, vz) - ang) * Math.min(1, dt * (grounded ? 11 : 6));
      }
      // ноги на ступеньке: подъём мягко (видно), падение и прыжок — как есть
      if (grounded && mode !== 'respawn' && Math.abs(y - yDisp) < 0.75) yDisp += (y - yDisp) * Math.min(1, dt * 18); else yDisp = y;
      if (grounded && y < yDisp) yDisp = y;
      if (sqT < 9) sqT += dt;
      writeSt();
      if (o.writeRoot && heroRoot) { heroRoot.position.set(x, yDisp, z); heroRoot.rotation.y = ang; }
      fxUpdate(dt);
      sayUpdate(dt);
      lastMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
      return st;
    }
    function writeSt() {
      st.pos.x = x; st.pos.y = yDisp; st.pos.z = z; st.floor = grounded ? y : support(x, z, y + 0.05);
      st.vx = vx; st.vy = vy; st.vz = vz; st.grounded = grounded; st.onTop = onRec ? onRec.src : null; st.onId = onRec ? onRec.id : ''; st.mode = mode; st.air = airT; st.drop = lastDrop;
      st.ang = ang; st.run = runOn || runHeld; st.busy = mode === 'tumble' || mode === 'getup' || mode === 'respawn';
    }
    function speedOf(mag, run) {
      const S = SPEEDS();
      if (run) return S.run * clamp(mag / 0.5, 0, 1);
      return mag <= 0.85 ? Math.max(0.6, cfg.walkMax * mag / 0.85) : cfg.walkMax;
    }
    // стоит на машине, которая едет — едет вместе с ней (поза машины с прошлого кадра — carryP)
    const carryP = { desc: null, part: 0, x: 0, z: 0, ry: 0, yb: 0 };
    function carry() {
      if (!grounded || !carryP.desc) return;
      let r = null;
      for (let i = 0; i < nDyn; i++) if (dyn[i].desc === carryP.desc && dyn[i].part === carryP.part) { r = dyn[i]; break; }
      if (!r) { onRec = null; carryP.desc = null; return; }   // машину убрали — пол найдётся в шаге (или упадёт)
      const dx = x - carryP.x, dz = z - carryP.z, c0 = Math.cos(carryP.ry), s0 = Math.sin(carryP.ry);
      const lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0, c1 = Math.cos(r.pry), s1 = Math.sin(r.pry);
      x = r.px + lx * c1 + lz * s1; z = r.pz - lx * s1 + lz * c1; y += r.pyb - carryP.yb; yDisp += r.pyb - carryP.yb; ang += angW(r.pry - carryP.ry);
      onRec = r;
    }
    function rememberCarry() { if (grounded && onRec && onRec.dyn) { carryP.desc = onRec.desc; carryP.part = onRec.part; carryP.x = onRec.px; carryP.z = onRec.pz; carryP.ry = onRec.pry; carryP.yb = onRec.pyb; } else carryP.desc = null; }
    function respawnStep(dt) {
      rsT += dt;
      const t1 = rsLanded ? cfg.roll - 0.1 : 0.12, t2 = t1 + cfg.fade, t3 = t2 + 0.12, t4 = t3 + cfg.fade;
      let k = 0;
      if (rsT < t1) k = 0; else if (rsT < t2) k = (rsT - t1) / cfg.fade; else if (rsT < t3) k = 1; else k = Math.max(0, 1 - (rsT - t3) / cfg.fade);
      if (rsT >= t2 && !rsDone) {
        rsDone = true;
        const p = respawnTarget(), px = p.x, py = p.y, pz = p.z;
        teleportTo(px, py, pz, true);
        if (Math.hypot(x - fallP.x, z - fallP.z) > 0.3) ang = Math.atan2(x - fallP.x, z - fallP.z);   // спиной к обрыву
        mode = 'respawn'; rollT = -1; dizzy = 0;
        fall('back', { drop: 0, x, y, z, reason: 'back' }); emit('back', { x, y, z });
      }
      if (rsDone) { vx = vz = 0; }
      fadeSet(k);
      if (rsT >= t4) { mode = 'walk'; fadeSet(0); squash(0.3, 0.3, 0); }
    }

    /* ---------- облачко пыли и листьев: InstancedMesh, 1 вызов, ничего не выделяет в кадре ---------- */
    const NFX = 22;
    let fx = null;
    const P = { x: new Float32Array(NFX), y: new Float32Array(NFX), z: new Float32Array(NFX), vx: new Float32Array(NFX), vy: new Float32Array(NFX), vz: new Float32Array(NFX), t: new Float32Array(NFX).fill(-1), life: new Float32Array(NFX), s: new Float32Array(NFX), leaf: new Uint8Array(NFX), sp: new Float32Array(NFX) };
    let fxAlive = 0, fxSeed = 1;
    const rnd = () => { fxSeed = (fxSeed * 16807) % 2147483647; return (fxSeed - 1) / 2147483646; };
    const DUST = [0xFFFFFF, 0xFFF8EE, 0xF6EEE2], LEAF = [0xE8893B, 0xD9563E, 0xF2B544, 0xC98A3A];
    let fxM4 = null, fxV = null, fxQ = null, fxS = null, fxE = null, fxC = null;
    function fxInit() {
      if (fx || !T || o.fx === false) return;
      const scene = o.scene || (heroRoot && heroRoot.parent) || null;
      if (!scene) return;
      let grad = null;
      // облачко — светлое и мягкое (своя светлая рампа: тень не темнее 0,82), чуть прозрачное, не пишет глубину
      if (!o.fxGradientMap) { const d = new Uint8Array([210, 210, 210, 255, 238, 238, 238, 255, 255, 255, 255, 255]); grad = new T.DataTexture(d, 3, 1, T.RGBAFormat); grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true; fxOwnGrad = grad; }
      else grad = o.fxGradientMap;
      const g = new T.IcosahedronGeometry(1, 2), m = new T.MeshToonMaterial({ color: 0xFFFFFF, gradientMap: grad, transparent: true, opacity: 0.9, depthWrite: false, emissive: 0x2A2420 });
      fx = new T.InstancedMesh(g, m, NFX); fx.name = 'move:puff'; fx.frustumCulled = false; fx.castShadow = false; fx.receiveShadow = false; fx.visible = false; fx.renderOrder = 2;
      fxM4 = new T.Matrix4(); fxV = new T.Vector3(); fxQ = new T.Quaternion(); fxS = new T.Vector3(); fxE = new T.Euler(); fxC = new T.Color();
      const zero = new T.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < NFX; i++) { fx.setMatrixAt(i, zero); fx.setColorAt(i, fxC.set(0xFFFFFF)); }
      scene.add(fx);
    }
    let fxOwnGrad = null;
    function puff(px, py, pz, k) {
      fxInit(); emit('puff', { x: px, y: py, z: pz, k });
      if (!fx) return;
      const nd = Math.round(4 + 8 * k), nl = k >= 0.9 ? 6 : k >= 0.5 ? 2 : 0;
      let made = 0;
      for (let i = 0; i < NFX && made < nd + nl; i++) {
        if (P.t[i] >= 0) continue;
        const leaf = made >= nd, a = rnd() * TAU, sp = leaf ? 0.6 + rnd() * 0.9 : (1.1 + rnd() * 1.4) * (0.6 + 0.4 * k);
        P.x[i] = px + Math.sin(a) * 0.18; P.z[i] = pz + Math.cos(a) * 0.18; P.y[i] = py + (leaf ? 0.25 : 0.06);
        P.vx[i] = Math.sin(a) * sp; P.vz[i] = Math.cos(a) * sp; P.vy[i] = leaf ? 2.2 + rnd() * 1.4 : 0.25 + rnd() * 0.6;
        P.t[i] = 0; P.life[i] = leaf ? 1.1 + rnd() * 0.5 : 0.4 + rnd() * 0.3; P.s[i] = leaf ? 0.07 + rnd() * 0.035 : (0.07 + rnd() * 0.06) * (0.75 + 0.45 * k);
        P.leaf[i] = leaf ? 1 : 0; P.sp[i] = rnd() * TAU;
        fx.setColorAt(i, fxC.set(leaf ? LEAF[(rnd() * LEAF.length) | 0] : DUST[(rnd() * DUST.length) | 0]));
        made++;
      }
      if (fx.instanceColor) fx.instanceColor.needsUpdate = true;
      fx.visible = true; fxAlive = 1;
    }
    function fxUpdate(dt) {
      if (!fx || !fxAlive) return;
      let alive = 0;
      for (let i = 0; i < NFX; i++) {
        if (P.t[i] < 0) continue;
        P.t[i] += dt;
        const u = P.t[i] / P.life[i];
        if (u >= 1) { P.t[i] = -1; fxM4.makeScale(0, 0, 0); fx.setMatrixAt(i, fxM4); continue; }
        alive++;
        if (P.leaf[i]) {
          P.vy[i] -= 4.2 * dt; const dr = Math.exp(-1.6 * dt); P.vx[i] *= dr; P.vz[i] *= dr; if (P.vy[i] < -0.7) P.vy[i] = -0.7;
          P.sp[i] += dt * 7;
          P.x[i] += (P.vx[i] + Math.sin(P.sp[i] * 1.3) * 0.5) * dt; P.y[i] += P.vy[i] * dt; P.z[i] += (P.vz[i] + Math.cos(P.sp[i]) * 0.4) * dt;
          const s = P.s[i] * (1 - sst(0.75, 1, u));
          fxS.set(s, s * 0.22, s * 0.7); fxQ.setFromEuler(fxE.set(P.sp[i], P.sp[i] * 0.7, Math.sin(P.sp[i]) * 0.8));
        } else {
          const dr = Math.exp(-3.4 * dt); P.vx[i] *= dr; P.vz[i] *= dr; P.vy[i] *= dr;
          P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
          const s = P.s[i] * (0.45 + 1.25 * sst(0, 0.35, u)) * (1 - sst(0.5, 1, u));
          fxS.set(s, s * 0.85, s); fxQ.identity();
        }
        fxV.set(P.x[i], P.y[i], P.z[i]); fxM4.compose(fxV, fxQ, fxS); fx.setMatrixAt(i, fxM4);
      }
      fx.instanceMatrix.needsUpdate = true;
      fxAlive = alive; fx.visible = alive > 0;
    }

    /* ---------- облачко «Ой!» и шторка ---------- */
    let host = null, bub = null, bubT = 0, fadeEl = null, fadeK = -1;
    const hostEl = () => host || (host = o.host || (typeof document !== 'undefined' ? document.body : null));
    let projV = null;
    function sayRand(list) { if (!list || !list.length) return; say(list[(frameN + Math.round(clock * 7)) % list.length]); }
    function say(text) {
      if (o.say) { try { o.say(text); } catch (e) { /* без облачка */ } return; }
      const hEl = hostEl(); if (!hEl || !o.camera || !T) return;
      css();
      if (!bub) { bub = document.createElement('div'); bub.className = 'mv-say'; hEl.appendChild(bub); }
      bub.textContent = text; bubT = 1.3; bub.classList.remove('on'); void bub.offsetWidth; bub.classList.add('on'); bub.style.display = '';
      placeBubble();
    }
    function placeBubble() {
      if (!bub || !o.camera) return;
      if (!projV) projV = new T.Vector3();
      projV.set(x, yDisp + cfg.height + 0.45, z).project(o.camera);
      const hEl = hostEl(), W = hEl.clientWidth || innerWidth, H = hEl.clientHeight || innerHeight;
      if (projV.z > 1) { bub.style.opacity = '0'; return; }
      bub.style.opacity = '';
      const px = clamp((projV.x + 1) / 2 * W, 40, W - 40), py = clamp((1 - projV.y) / 2 * H, 80, H - 140);
      bub.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,-100%)`;
    }
    function sayUpdate(dt) {
      if (!bub || bubT <= 0) return;
      bubT -= dt;
      if (bubT <= 0) { bub.classList.remove('on'); bub.style.display = 'none'; return; }
      placeBubble();
    }
    function fadeSet(k) {
      if (k === fadeK) return;
      fadeK = k;
      if (o.fadeEl === false) return;
      const hEl = hostEl(); if (!hEl) return;
      css();
      if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.className = 'mv-fade'; hEl.appendChild(fadeEl); }
      fadeEl.style.display = k > 0.001 ? 'block' : 'none'; fadeEl.style.opacity = k.toFixed(3);
    }

    /* ---------- поза поверх HeroAnim ---------- */
    const LEG1 = B && B.shin_L ? B.shin_L.position.length() : 0.37, LEG2 = B && B.foot_L ? B.foot_L.position.length() : 0.34;
    const ACC = {}, POSE_BONES = ['spine', 'chest', 'neck', 'head', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R'];
    POSE_BONES.forEach(n => { ACC[n] = [0, 0, 0]; });
    const pe = T ? new T.Euler() : null, pq = T ? new T.Quaternion() : null;
    let wAir = 0, wFlap = 0, wRoll = 0, tPose = 0, bodyDy = 0, bodyRx = 0, bodyYw = NaN, bodyRw = NaN, bodyScaled = false;
    const add = (n, ax, ay, az, k) => { const a = ACC[n]; a[0] += ax * k; a[1] += ay * k; a[2] += az * k; };
    function animState(s) {
      if (!s) return s;
      const inAir = !grounded || mode === 'air';
      if (inAir || mode === 'tumble' || mode === 'getup' || mode === 'respawn') { s.speed = 0; s.idle = false; s.turnRate = 0; s.celebrate = false; s.waving = false; }
      else if (sqT < sqDur) s.idle = false;
      return s;
    }
    function pose(dt) {
      dt = clamp(+dt || 0, 0, 0.1); tPose += dt;
      const air = !grounded && !(mode === 'respawn' && rsDone);
      wAir += ((air ? 1 : 0) - wAir) * (1 - Math.exp(-(air ? 16 : 45) * dt));   // приземлилась — поджатые ноги сразу уходят, остаётся чистое приседание
      const longFall = air && airT > 0.45 && vy < -5;
      wFlap += ((longFall ? 1 : 0) - wFlap) * (1 - Math.exp(-6 * dt));
      const rolling = rollT >= 0 && rollT <= cfg.roll;
      const rk = rolling ? sst(0, 0.08, rollT) * (1 - sst(cfg.roll - 0.12, cfg.roll, rollT)) : 0;
      wRoll += (rk - wRoll) * Math.min(1, dt * 30);
      // тело: кувырок вокруг центра «клубочка» (cfg.rollC), который опускается на высоту своего радиуса (cfg.rollR) — шар катится
      // по земле, ни голова, ни ноги не уходят под пол; «приплюснуться» — масштаб (игра body.scale не трогает)
      if (heroBody) {
        // защита: игра в этом кадре не переписала body — убрать прошлую добавку, а не копить
        if (heroBody.position.y === bodyYw) heroBody.position.y -= bodyDy;
        if (heroBody.rotation.x === bodyRw) heroBody.rotation.x -= bodyRx;
        let a = 0;
        if (rolling) { const u = clamp(rollT / (cfg.roll - 0.05), 0, 1); a = TAU * (u * u * (3 - 2 * u)); }
        const cy = cfg.rollC[0], cz = cfg.rollC[1], ca = Math.cos(a), sa = Math.sin(a);
        bodyDy = cy + wRoll * wRoll * (cfg.rollR - cy) - (cy * ca - cz * sa); bodyRx = a;   // w² — ноги разгибаются медленнее, чем опускается тело
        heroBody.position.y += bodyDy; heroBody.rotation.x += bodyRx; heroBody.position.z = cz - (cy * sa + cz * ca);
        bodyYw = heroBody.position.y; bodyRw = heroBody.rotation.x;
        const sqk = sqT < sqDur ? sqAmp * sqShape(sqT / sqDur) * sqHard : 0;
        if (sqk > 0.002) { heroBody.scale.set(1 + 0.04 * sqk, 1 - 0.08 * sqk, 1 + 0.04 * sqk); bodyScaled = true; }
        else if (bodyScaled) { heroBody.scale.set(1, 1, 1); bodyScaled = false; }
      }
      if (!B || !pq) return;
      for (let i = 0; i < POSE_BONES.length; i++) { const a = ACC[POSE_BONES[i]]; a[0] = a[1] = a[2] = 0; }
      // полёт: вверх — колени к груди, руки чуть вверх и в стороны; вниз — ноги навстречу земле, руки шире
      if (wAir > 0.002) {
        const ru = sst(-2.5, 3, vy), tuck = wAir * lerp(0.4, 1, ru), reach = wAir * (1 - ru);
        add('thigh_L', -64 * D, 0, 0, tuck); add('shin_L', 98 * D, 0, 0, tuck); add('foot_L', 16 * D, 0, 0, tuck);
        add('thigh_R', -46 * D, 0, 0, tuck); add('shin_R', 80 * D, 0, 0, tuck); add('foot_R', 12 * D, 0, 0, tuck);
        add('thigh_L', -14 * D, 0, 0, reach); add('shin_L', 18 * D, 0, 0, reach); add('thigh_R', -24 * D, 0, 0, reach); add('shin_R', 30 * D, 0, 0, reach);
        add('upperarm_L', -36 * D, 0, (28 + 34 * (1 - ru)) * D, wAir); add('upperarm_R', -36 * D, 0, -(28 + 34 * (1 - ru)) * D, wAir);
        add('forearm_L', -34 * D, 0, 0, wAir); add('forearm_R', -34 * D, 0, 0, wAir);
        add('spine', 6 * D, 0, 0, tuck); add('head', (-8 * ru + 10 * (1 - ru)) * D, 0, 0, wAir);
        if (jumpT < 0.14) { const k = (1 - jumpT / 0.14) * wAir; add('foot_L', 26 * D, 0, 0, k); add('foot_R', 26 * D, 0, 0, k); add('thigh_L', 10 * D, 0, 0, k); add('thigh_R', 10 * D, 0, 0, k); }
        if (wFlap > 0.002) { const fl = Math.sin(tPose * 15); add('upperarm_L', -10 * D, 0, 24 * fl * D, wFlap); add('upperarm_R', -10 * D, 0, -24 * fl * D, wFlap); add('head', 8 * D, 0, 0, wFlap); }
      }
      // кувырок: клубочком
      if (wRoll > 0.002) {
        add('thigh_L', -108 * D, 0, 0, wRoll); add('thigh_R', -104 * D, 0, 0, wRoll); add('shin_L', 128 * D, 0, 0, wRoll); add('shin_R', 124 * D, 0, 0, wRoll);
        add('foot_L', 20 * D, 0, 0, wRoll); add('foot_R', 20 * D, 0, 0, wRoll);
        add('spine', 34 * D, 0, 0, wRoll); add('chest', 18 * D, 0, 0, wRoll); add('neck', 10 * D, 0, 0, wRoll); add('head', 18 * D, 0, 0, wRoll);
        add('upperarm_L', -66 * D, 0, 12 * D, wRoll); add('upperarm_R', -66 * D, 0, -12 * D, wRoll); add('forearm_L', -96 * D, 0, 0, wRoll); add('forearm_R', -96 * D, 0, 0, wRoll);
      }
      // приземление: присела (стопы на земле), руки вперёд для равновесия; после кувырка — голова кружится
      let drop = 0;
      if (sqT < sqDur && sqAmp > 0) {
        const s = sqAmp * sqShape(sqT / sqDur) * (1 - wRoll);
        if (s > 0.002) {
          const a = 42 * D * s;
          add('thigh_L', -a, 0, 0, 1); add('thigh_R', -a * 0.94, 0, 0, 1); add('shin_L', 2 * a, 0, 0, 1); add('shin_R', 2 * a * 0.94, 0, 0, 1); add('foot_L', -a, 0, 0, 1); add('foot_R', -a * 0.94, 0, 0, 1);
          add('spine', 0.55 * a, 0, 0, 1); add('chest', 0.2 * a, 0, 0, 1); add('head', -0.35 * a, 0, 0, 1);
          add('upperarm_L', -28 * D, 0, 22 * D, s); add('upperarm_R', -28 * D, 0, -22 * D, s); add('forearm_L', -22 * D, 0, 0, s); add('forearm_R', -22 * D, 0, 0, s);
          drop = (LEG1 + LEG2) * (1 - Math.cos(a));
        }
      }
      if (dizzy > 0.002) { const k = dizzy * dizzy; add('head', 0, 14 * D * Math.sin(tPose * 10), 7 * D * Math.sin(tPose * 6.3), k); add('chest', 0, 0, 4 * D * Math.sin(tPose * 6.3 + 1), k); }
      for (let i = 0; i < POSE_BONES.length; i++) {
        const n = POSE_BONES[i], a = ACC[n], b = B[n];
        if (!b || (a[0] === 0 && a[1] === 0 && a[2] === 0)) continue;
        pq.setFromEuler(pe.set(a[0], a[1], a[2])); b.quaternion.multiply(pq);
      }
      if (drop > 0 && B.hips) B.hips.position.y -= drop;
    }
    // форма приседания: быстро вниз (18 % времени), мягко вверх с лёгким «пружинным» перелётом
    function sqShape(u) { if (u < 0.18) return sst(0, 0.18, u); const v = (u - 0.18) / 0.82; return (1 - sst(0, 1, v)) - 0.12 * Math.sin(PI * v) * v; }

    /* ---------- снаружи ---------- */
    let uiRef = null;   // кнопки Move.mountButtons — горят, когда бег включили не ими (игра, клавиша)
    const mv = {
      update(dt, inp) { const r = update(dt, inp); rememberCarry(); return r; },
      animState, pose,
      jump() { jumpBuf = cfg.buffer; },
      setRun(b) { const was = runOn; runOn = !!b; if (was !== runOn) emit('run', { on: runOn }); st.run = runOn || runHeld; if (uiRef) uiRef._reflect(runOn, runOn || runHeld); },
      toggleRun() { mv.setRun(!runOn); return runOn; },
      holdRun(b) { runHeld = !!b; st.run = runOn || runHeld; if (uiRef) uiRef._reflect(runOn, runOn || runHeld); },
      attachUi(u) { uiRef = u || null; if (uiRef) uiRef._reflect(runOn, runOn || runHeld); },
      get run() { return runOn || runHeld; },
      busy: () => mode === 'tumble' || mode === 'getup' || mode === 'respawn',
      teleport(p, ry) { if (!p) return; if (num(ry)) ang = ry; teleportTo(p.x, p.y, p.z, false); },
      sync(px, py, pz) {
        if (!num(px) || !num(pz)) return;
        if (Math.abs(px - x) < 1e-4 && Math.abs(pz - z) < 1e-4 && (!num(py) || Math.abs(py - yDisp) < 1e-3)) return;
        x = px; z = pz; vx = vz = 0;
        if (num(py)) { y = py; yDisp = py; }
        else { const g = gr(px, pz); if (g > -INF / 2) { y = g; yDisp = g; } }   // без y — на землю под точкой
        grounded = true; vy = 0; if (mode === 'air') mode = 'walk'; onRec = null; peakY = y; carryP.desc = null;
        writeSt();
      },
      lastSafe, state: st,
      supportAt(px, pz, py) { refreshStatic(); gather(px - 1, px + 1, pz - 1, pz + 1); return support(px, pz, (num(py) ? py : INF / 2) + cfg.boxStep); },
      reindex() { dirty = true; refreshStatic(); },
      stats: () => ({ colliders: recs.length, dyn: nDyn, cand: cand.length, steps: lastSteps, ms: +lastMs.toFixed(3), fx: fx ? 1 : 0, g: +G.toFixed(2), v0: +V0.toFixed(2) }),
      fxMesh: () => fx,
      cfg,
      dispose() {
        if (fx) { if (fx.parent) fx.parent.remove(fx); fx.geometry.dispose(); fx.material.dispose(); fx = null; }
        if (fxOwnGrad) { fxOwnGrad.dispose(); fxOwnGrad = null; }
        if (bub && bub.parentNode) bub.parentNode.removeChild(bub); bub = null;
        if (fadeEl && fadeEl.parentNode) fadeEl.parentNode.removeChild(fadeEl); fadeEl = null;
        if (heroBody && bodyScaled) { heroBody.scale.set(1, 1, 1); bodyScaled = false; }
        if (heroBody) { heroBody.position.z = 0; }
        uiRef = null;
        recs.length = 0; grid.clear(); cand.length = 0; nDyn = 0;
      },
    };
    writeSt();
    return mv;
  }

  /* ---------- кнопки «Бег» и «Прыжок» ---------- */
  function mountButtons(host, o) {
    o = o || {};
    if (!host || typeof document === 'undefined') return null;
    css();
    const el = document.createElement('div'); el.className = 'mv-btns';
    if (o.bottom) el.style.setProperty('--mv-bottom', o.bottom);
    if (o.right) el.style.setProperty('--mv-right', o.right);
    // HUD v2: две маленькие круглые кнопки дуги справа внизу — «Прыжок» в слоте s1 (над P), «Бег» в s3 (слева от P);
    // контейнер .mv-btns — display: contents (style.css), подпись — aria-label и скрытое <b>
    el.innerHTML = '<button type="button" class="mv-jump" data-hud-slot="s1" aria-label="Прыжок" title="Прыжок"><i>🦘</i><b>Прыжок</b></button><button type="button" class="mv-run" data-hud-slot="s3" aria-label="Бег" title="Бег" aria-pressed="false"><i>👟</i><b>Бег</b></button>';
    const jump = el.querySelector('.mv-jump'), run = el.querySelector('.mv-run');
    host.appendChild(el);
    let bound = o.move || null;
    const mvRef = () => bound;
    let runState = false, holdT = 0, holding = false, runPid = null;
    const setRunUi = b => { runState = !!b; run.classList.toggle('on', runState); run.setAttribute('aria-pressed', runState ? 'true' : 'false'); };
    let fromUi = false;
    const fireRun = b => { setRunUi(b); const m = mvRef(); fromUi = true; if (m) m.setRun(b); fromUi = false; if (o.onRun) o.onRun(b); };
    const stop = e => { e.stopPropagation(); if (e.cancelable && e.type !== 'pointerdown') e.preventDefault(); };
    const onJumpDown = e => { e.stopPropagation(); e.preventDefault(); jump.classList.add('down'); const m = mvRef(); if (m) m.jump(); if (o.onJump) o.onJump(); try { if (navigator.vibrate) navigator.vibrate(8); } catch (er) { /* нет */ } };
    const onJumpUp = e => { e.stopPropagation(); jump.classList.remove('down'); };
    const onRunDown = e => {
      e.stopPropagation(); e.preventDefault(); run.classList.add('down'); runPid = e.pointerId;
      holdT = performance.now(); holding = true;
      clearTimeout(run._t); run._t = setTimeout(() => { if (holding && !runState) { run._held = true; fireRun(true); } }, 300);
    };
    const onRunUp = e => {
      e.stopPropagation(); if (runPid !== null && e.pointerId !== runPid) return; runPid = null;
      run.classList.remove('down'); clearTimeout(run._t);
      if (!holding) return; holding = false;
      if (run._held) { run._held = false; fireRun(false); return; }   // держала — отпустила: бег выключен
      if (performance.now() - holdT < 300) fireRun(!runState);        // тап — включить/выключить
    };
    jump.addEventListener('pointerdown', onJumpDown); jump.addEventListener('pointerup', onJumpUp); jump.addEventListener('pointercancel', onJumpUp); jump.addEventListener('pointerleave', onJumpUp);
    run.addEventListener('pointerdown', onRunDown); run.addEventListener('pointerup', onRunUp); run.addEventListener('pointercancel', onRunUp);
    ['touchstart', 'touchend', 'mousedown', 'click', 'contextmenu'].forEach(t => { jump.addEventListener(t, stop, { passive: false }); run.addEventListener(t, stop, { passive: false }); });
    let onKey = null, onKeyUp = null;
    if (o.keys) {
      onKey = e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); const m = mvRef(); if (m) m.jump(); if (o.onJump) o.onJump(); } if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) { const m = mvRef(); if (m) m.holdRun(true); else run.classList.add('on'); } };
      onKeyUp = e => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { const m = mvRef(); if (m) m.holdRun(false); else run.classList.toggle('on', runState); } };
      addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
    }
    const ui = {
      el, jump, run,
      setVisible(b) { el.classList.toggle('hide', !b); if (!b && runState) fireRun(false); },
      setRun(b) { fireRun(b); },
      // новый регион — новый mv: кнопки те же (бег, если горел, переносится)
      bind(m) { const old = bound; if (old && old !== m && old.attachUi) old.attachUi(null); bound = m || null; if (bound) { if (runState) bound.setRun(true); if (bound.attachUi) bound.attachUi(ui); } },
      // mv сообщает: бег включили/выключили не кнопкой (игра, Shift) — кнопка горит/гаснет сама
      _reflect(on, lit) { if (fromUi) return; runState = !!on; run.classList.toggle('on', !!lit); run.setAttribute('aria-pressed', on ? 'true' : 'false'); },
      dispose() {
        clearTimeout(run._t);
        const m = mvRef(); if (m && m.attachUi) m.attachUi(null);
        if (onKey) { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); }
        if (el.parentNode) el.parentNode.removeChild(el);
      },
    };
    if (bound && bound.attachUi) bound.attachUi(ui);
    return ui;
  }

  window.Move = { create, mountButtons, CFG, PROFILES, version: 1 };
})();
