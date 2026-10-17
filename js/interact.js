/* =====================================================================
   НАСТОЯЩИЕ РУКИ: героиня берёт, держит, ест, пьёт, гладит, садится — «как живой человек».
   Слой поверх HeroAnim (js/hero_anim.js не меняется): каждый кадр ПОСЛЕ anim.update поправляет кости —
   IK рук к точке в мире (локоть — шарнир, точное решение), присед/наклон с IK ног (стопы стоят на месте),
   взгляд (шея + голова), предметы в кисти (handL/handR) с хватом под каждый предмет. Без файлов анимации.

   Interact.create({ THREE, anim, heroRoot, scene, camera, model?, setRoot?, on?, pocket?, autoUnpocket?, footLock?, gradientMap? })
       -> api | null (нет THREE / anim / heroRoot)
     anim      — HeroAnim.create(...) (кости anim.bones); model — объект с костями (по умолчанию anim.bones.hips.parent,
                 т. е. SkinnedMesh героини); всё — в его осях, масштаб модели учитывается;
     heroRoot  — корень героини в мире (его двигают «подойти», «сесть», «спуститься по ступеням»);
     setRoot(pos, yaw) — куда игре записать корень: pos — в осях родителя корня (THREE.Vector3, y — тоже!), yaw — rotation.y;
                 слой и сам пишет heroRoot.position / rotation.y, но если игра каждый кадр ставит корень из своих
                 переменных (s.px/s.pz/s.ang в js/world/main.js, px/pz/heroAng в комнатах js/city3d.js) — обязательно;
     scene     — куда класть крошки, брызги, круги на воде, лапку жителя (по умолчанию родитель корня);
     on(name, data) — события для звука/реплик: reach, take, give, bite, lick, chew, crunch, crumbs, sip, gulp, sniff,
                 admire, lid, lidClose, step, splash, drink, ah, pat, clap, wave, pocket, unpocket, coin, clink, sit,
                 stand, busy (руки заняты — не может), contact ({what, side, d} — точность касания, для тестов), done, cancel;
     pocket    — false: не трогать лупу (без двух рук: вода одной ладонью, попкорн — «клюёт» из ведёрка);
     autoUnpocket — false: не доставать лупу, когда руки опустели (по умолчанию достаёт сама, если убрала сама);
     footLock  — false: не держать стопы на месте во время действия (по умолчанию держит, IK ног);
     gradientMap — рампа MeshToonMaterial для предметов и лапок (по умолчанию своя 4-ступенчатая).
   api:
     play(name, opts) -> Promise<{ok, action, holding}> — действие из api.ACTIONS (занята — встаёт в очередь)
     chain([[name, opts], ...]) -> Promise — подряд
     animState(s) -> s'             — ПЕРЕД anim.update: подменяет speed/turnRate/sitting/idle/waving/carry на время действия
     update(dt)                     — ПОСЛЕ anim.update (и после того, как игра поставила корень): поза, предметы, эффекты
     busy() / holding(side?) / held() / pocketed() / canPocket() / seated() / cancel() / drop(side?) -> предмет /
     give(itemOrName, side?) -> предмет сразу в руке / dispose() — вернуть геометрию и скелет как были
     state — отладка: { action, step, t, body, look, hands, pocketed, seated, mag, lastGap }
   Interact.items.make(name, opt) -> THREE.Mesh (1 вызов отрисовки, контур запечён в ту же сетку; mesh.userData.it:
     { name, def, bites, level, setLevel(f), bite(), left(), dispose() }); Interact.items.list — имена;
     Interact.items.wrap(obj, hold) — свой предмет игры (букет и т. п.) с хватом; Interact.items.material(T[, gradientMap]).
   Действия и их opts — plan2/wave4_interact.md: take, takeFrom, give, putDown, pickUp, eat, drink, sniff, admire,
     drinkSpring, pet, wave, clap, sit, stand, coin, pay, pocket, unpocket, look, hold.
   Оси модели героини: +x — влево (свободная левая рука), +y — вверх, +z — вперёд; рост модели 1.896.
   Лупа: в правой кисти лупа — часть сетки модели; слой находит вершины лупы (по цвету текстуры + соседству) и вешает
     их на свою кость «mag» (копия только skinIndex, остальное — общие буферы), чтобы лупу можно было убрать в карман.
   ===================================================================== */
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2, D = PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angW = a => a - TAU * Math.round(a / TAU);
  const EASE = {
    lin: u => u,
    in: u => u * u,
    out: u => 1 - (1 - u) * (1 - u),
    inOut: u => u * u * (3 - 2 * u),
    soft: u => u * u * u * (u * (u * 6 - 15) + 10),
    back: u => { const s = 1.3, v = u - 1; return v * v * ((s + 1) * v + s) + 1; },
  };
  const ease = e => (typeof e === 'function' ? e : EASE[e] || EASE.inOut);

  /* ---------------------------------------------------------------------
     ГЕОМЕТРИЯ РУКИ (оси кисти = оси модели в покое): пальцы — −y, большой палец — +z,
     ладонь левой смотрит в −x (к телу), правой — в +x. GRIP — центр «дырочки» кулака (сюда входит ручка, стебель).
     --------------------------------------------------------------------- */
  const GRIP = { L: [0.004, -0.07, 0.012], R: [-0.004, -0.07, 0.012] };
  const MAG_PIVOT = [-0.014, -0.078, 0.018];     // где ручка лупы выходит из кулака правой (от сустава кисти): сюда лупа «прячется»
  const MOUTH = [0, 0.066, 0.152];              // губы — от сустава головы (покой: y 1.40, z 0.14)
  const NOSE = [0, 0.13, 0.172];
  const EYES = [0, 0.16, 0.12];
  // хваты (оси модели, для ЛЕВОЙ; правой — зеркально по x): f — куда смотрят пальцы, n — куда смотрит ладонь
  const GRIPS = {
    hold: { f: [0.05, -0.3, 1], n: [-1, 0, 0] },           // кулак «большим пальцем вверх»: стакан, ведёрко, стебель
    reach: { f: [-0.15, -0.35, 1], n: [-1, 0.1, 0] },       // тянется взять
    offer: { f: [-0.15, 0, 1], n: [0, 1, 0] },               // ладонь вверх (протянуть монетку, принять)
    palmDown: { f: [0, -0.25, 1], n: [0, -1, 0] },           // ладонь вниз: гладить, придержать
    lift: { f: [0, 0.15, 1], n: [0, 1, 0.1] },               // поддеть крышку снизу
    cup: { f: [-0.45, -0.35, 1], n: [0.25, 1, 0.05] },       // ладошка «лодочкой»
    cupUp: { f: [-0.5, 0.35, 0.55], n: [0.35, 0.6, -0.65] }, // лодочка у губ (ладонь к лицу и вверх)
    pocket: { f: [0, -1, 0.15], n: [-1, 0, 0] },             // рука в кармане — пальцы вниз
    wave: { f: [0.1, 1, 0.2], n: [0, 0, 1] },                // ладонь к собеседнику
    clap: { f: [-0.25, 0.45, 1], n: [-1, 0, 0] },
    toss: { f: [0, -0.6, 1], n: [-0.3, -1, 0] },
  };

  /* ---------------------------------------------------------------------
     ПРЕДМЕТЫ: маленькие мультяшные сетки, всё в одной сетке (цвет в вершинах, контур — вывернутая оболочка в
     той же сетке) → 1 вызов отрисовки. Оси предмета «в руке»: +y — вверх (большой палец), +z — вперёд (пальцы),
     начало — середина предмета. hold: { in — к ладони, up, fwd, rot } — где середина предмета от центра кулака.
     --------------------------------------------------------------------- */
  const OL_COL = '#4A3A48';
  const TAG = { food: 1, level: 2, fill: 4 };
  const libs = new WeakMap();
  function lib(T) {
    let L = libs.get(T);
    if (L) return L;
    const G = {
      sph: new T.SphereGeometry(1, 12, 9), sphLo: new T.SphereGeometry(1, 8, 6), cyl: new T.CylinderGeometry(1, 1, 1, 14),
      cylLo: new T.CylinderGeometry(1, 1, 1, 8), cone: new T.ConeGeometry(1, 1, 14), box: new T.BoxGeometry(1, 1, 1),
    };
    let mat = null, grad = null;
    function material(gradientMap) {
      if (mat && (!gradientMap || mat.gradientMap === gradientMap)) return mat;
      if (!grad && !gradientMap) {
        const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 245, 245, 245, 255, 255, 255, 255, 255]);
        grad = new T.DataTexture(d, 4, 1, T.RGBAFormat); grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
      }
      const m = new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: gradientMap || grad });
      m.userData.interactItems = true;
      if (!mat) mat = m;
      return m;
    }
    L = { T, G, material, mats: () => mat };
    libs.set(T, L);
    return L;
  }
  // деталь: { g, c, m (Matrix4), tag, ol }
  function partMaker(T, G) {
    const m4 = (p, r, s) => {
      const M = new T.Matrix4(), q = new T.Quaternion();
      if (r) q.setFromEuler(new T.Euler(r[0] || 0, r[1] || 0, r[2] || 0, r[3] || 'XYZ'));
      return M.compose(new T.Vector3(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), q, new T.Vector3(s ? s[0] : 1, s ? (s[1] === undefined ? s[0] : s[1]) : 1, s ? (s[2] === undefined ? s[0] : s[2]) : 1));
    };
    const P = {
      sph: (c, p, s, o) => Object.assign({ g: G.sph, c, m: m4(p, o && o.r, s) }, o),
      sphLo: (c, p, s, o) => Object.assign({ g: G.sphLo, c, m: m4(p, o && o.r, s) }, o),
      cyl: (c, rt, rb, h, p, r, o) => Object.assign({ g: new T.CylinderGeometry(rt, rb, h, (o && o.seg) || 14), c, m: m4(p, r) }, o),
      cone: (c, rad, h, p, r, o) => Object.assign({ g: new T.ConeGeometry(rad, h, (o && o.seg) || 14), c, m: m4(p, r) }, o),
      box: (c, s, p, r, o) => Object.assign({ g: G.box, c, m: m4(p, r, s) }, o),
      tor: (c, R, rr, p, r, o) => Object.assign({ g: new T.TorusGeometry(R, rr, (o && o.rs) || 6, (o && o.ts) || 18, (o && o.arc) || TAU), c, m: m4(p, r) }, o),
      lathe: (c, pts, p, r, o) => Object.assign({ g: new T.LatheGeometry(pts.map(q => new T.Vector2(q[0], q[1])), (o && o.seg) || 14), c, m: m4(p, r) }, o),
      tube: (c, pts, rr, o) => Object.assign({ g: new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => new T.Vector3(q[0], q[1], q[2])), !!(o && o.closed)), (o && o.seg) || 36, rr, (o && o.rs) || 6, !!(o && o.closed)), c, m: new T.Matrix4() }, o),
      shape: (c, shape, depth, p, r, o) => Object.assign({ g: new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: depth * 0.35, bevelSegments: 2, curveSegments: 10 }), c, m: m4(p, r) }, o),
    };
    return P;
  }
  // склейка деталей в одну сетку: цвет в вершинах, вывернутая оболочка-контур (обратный обход, тёмная)
  function merge(T, parts, olT) {
    const list = []; let n = 0;
    parts.forEach(p => {
      if (!p) return;
      const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()).applyMatrix4(p.m);
      if (!g.attributes.normal) g.computeVertexNormals();
      list.push([g, p]); n += g.attributes.position.count * (p.ol === false ? 1 : 2);
    });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), tag = new Uint8Array(n);
    const c = new T.Color(), oc = new T.Color(OL_COL);
    let k = 0;
    list.forEach(([g, p]) => {
      const P = g.attributes.position.array, N = g.attributes.normal.array, cnt = g.attributes.position.count;
      c.set(p.c);
      const tg = p.tag || 0;
      for (let i = 0; i < cnt; i++, k++) {
        pos.set([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], k * 3); nor.set([N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], k * 3);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; tag[k] = tg;
      }
      if (p.ol !== false) {
        const t = (p.olT || olT);
        for (let i = 0; i < cnt; i += 3) {
          [0, 2, 1].forEach(j => {
            const s = (i + j) * 3;
            pos[k * 3] = P[s] + N[s] * t; pos[k * 3 + 1] = P[s + 1] + N[s + 1] * t; pos[k * 3 + 2] = P[s + 2] + N[s + 2] * t;
            nor[k * 3] = -N[s]; nor[k * 3 + 1] = -N[s + 1]; nor[k * 3 + 2] = -N[s + 2];
            col[k * 3] = oc.r; col[k * 3 + 1] = oc.g; col[k * 3 + 2] = oc.b; tag[k] = tg; k++;
          });
        }
      }
      g.dispose();
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.userData.tag = tag; geo.userData.base = pos.slice();
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  }
  const ring = (n, f) => { const a = []; for (let i = 0; i < n; i++) a.push(f(i, i / n * TAU)); return a; };
  const tinyS = new WeakMap(), tinySphere = T => { if (!tinyS.has(T)) tinyS.set(T, new T.SphereGeometry(1, 7, 5)); return tinyS.get(T); };
  // описания предметов
  const DEFS = {
    bread: {   // круглый хлеб: невысокий, румяный верх с кольцом-узором и наколами
      parts: P => [
        P.sph('#E0A85E', [0, 0, 0], [0.085, 0.03, 0.085], { tag: TAG.food }),
        P.tor('#C98B45', 0.05, 0.007, [0, 0.022, 0], [PI / 2, 0, 0], { tag: TAG.food, ol: false, ts: 22 }),
        P.sph('#F1C27F', [0, 0.027, 0], [0.028, 0.008, 0.028], { tag: TAG.food, ol: false }),
        ...ring(6, (i, a) => P.sphLo('#B87A3A', [Math.sin(a) * 0.068, 0.014, Math.cos(a) * 0.068], [0.006, 0.004, 0.006], { tag: TAG.food, ol: false })),
      ],
      hold: { in: 0.0, up: 0.074, fwd: 0.006, rot: [PI / 2, 0, 0] },
      bite: { key: [0, 0.012, -0.074], pivot: [0, 0, 0.085], steps: [0.74, 0.48, 0] },
      eat: { f: [-0.1, 0.5, 0.85], n: [-1, 0, 0] }, crumbs: '#E8B26A', bottom: -0.03, food: true,
    },
    chudu: {   // кусочек тонкого пирога: золотистый, зелень сверху, румяная корочка (держит за корочку, кончик — вперёд)
      parts: (P, T) => {
        const sh = new T.Shape(), A = PI / 6, R = 0.11, ay = 0.06;
        sh.moveTo(0, ay); for (let i = 0; i <= 10; i++) { const a = -PI / 2 - A + 2 * A * i / 10; sh.lineTo(Math.cos(a) * R, ay + Math.sin(a) * R); } sh.lineTo(0, ay);
        const crust = []; for (let i = 0; i <= 8; i++) { const f = -A + 2 * A * i / 8; crust.push([Math.sin(f) * (R - 0.003), 0.002, ay - Math.cos(f) * (R - 0.003)]); }
        return [
          P.shape('#EDBE74', sh, 0.006, [0, 0.006, 0], [PI / 2, 0, 0], { tag: TAG.food }),
          P.tube('#C98B45', crust, 0.0085, { seg: 16, rs: 6, tag: TAG.food }),
          ...[[0.012, 0.0], [-0.012, -0.02], [0.004, 0.03], [-0.006, 0.012], [0.018, -0.03], [-0.02, -0.035], [0.0, -0.012]].map(q => P.sphLo('#7FB35A', [q[0], 0.0095, q[1]], [0.007, 0.002, 0.006], { tag: TAG.food, ol: false })),
        ];
      },
      hold: { in: 0.0, up: 0.046, fwd: 0.004, rot: [-PI / 2, 0, 0] },
      bite: { key: [0, 0.006, 0.056], pivot: [0, 0, -0.048], steps: [0.72, 0.45, 0] },
      eat: { f: [-0.1, 0.5, 0.85], n: [-1, 0, 0] }, crumbs: '#EDBE74', bottom: -0.004, food: true,
    },
    popcorn: {   // ведёрко попкорна: белое в вишнёвую полоску, шапка попкорна
      parts: P => [
        P.cyl('#FFFDF9', 0.06, 0.045, 0.13, [0, 0, 0]),
        ...ring(6, (i, a) => P.box('#C2405B', [0.017, 0.128, 0.006], [Math.sin(a) * 0.0535, 0, Math.cos(a) * 0.0535], [0, a, -0.055 * Math.cos(a) * 0, 'YXZ'], { ol: false })),
        ...[[0, 0.075, 0], [0.028, 0.07, 0.018], [-0.026, 0.07, -0.016], [0.016, 0.082, -0.026], [-0.02, 0.08, 0.024], [0.035, 0.066, -0.02], [-0.036, 0.066, 0.008]].map(q => P.sphLo('#FFE9A8', q, [0.021, 0.018, 0.021], { tag: TAG.level })),
      ],
      hold: { in: 0.04, up: 0.0, fwd: 0.0 },
      level: { depth: 0.045, scale: 0.86 }, pick: 'kernel', pickKey: [0, 0.07, 0], crumbs: '#FFE9A8', bottom: -0.065,
    },
    kernel: {
      parts: P => [P.sphLo('#FFF1C4', [0, 0, 0], [0.012, 0.01, 0.011], { olT: 0.002 }), P.sphLo('#FFE9A8', [0.007, 0.004, 0], [0.008, 0.007, 0.008], { olT: 0.002 })],
      hold: { in: -0.008, up: 0.01, fwd: 0.045 }, bite: { key: [0, 0, 0], pivot: [0, 0, 0], steps: [0] }, crumbs: '#FFE9A8', food: true,
    },
    grape: {
      parts: P => [P.sphLo('#8E5BB5', [0, 0, 0], [0.0115, 0.0125, 0.0115], { olT: 0.002 })],
      hold: { in: -0.008, up: 0.01, fwd: 0.045 }, crumbs: '#B88AD8', food: true,
    },
    pretzel: {   // крендель: румяный «узелок» с кристаллами сахара
      parts: P => {
        const pts = [[0, 0.0, 0], [0.035, 0.012, 0], [0.05, 0.05, 0], [0.034, 0.083, 0], [0.008, 0.07, 0], [-0.012, 0.03, 0], [-0.03, 0.004, 0],
          [-0.044, 0.03, 0], [-0.04, 0.072, 0], [-0.012, 0.086, 0], [0.012, 0.052, 0], [0.02, 0.024, 0]].map(q => [q[0], q[1] - 0.04, q[2]]);
        return [
          P.tube('#C9853F', pts, 0.0105, { seg: 40, rs: 6, closed: true, tag: TAG.food }),
          ...[[0.04, 0.0], [-0.033, 0.04], [0.0, -0.035], [0.028, 0.035], [-0.04, -0.01], [0.012, -0.012]].map(q => P.sphLo('#FFF6E8', [q[0], q[1], 0.009], [0.004, 0.003, 0.003], { tag: TAG.food, ol: false })),
        ];
      },
      hold: { in: 0.0, up: 0.045, fwd: 0.0, rot: [0, 0, 0] },
      bite: { key: [0, 0.045, 0.0], pivot: [0, -0.05, 0], steps: [0.72, 0.45, 0] },
      eat: { f: [-0.1, 0.5, 0.85], n: [-1, 0, 0] }, crumbs: '#D49452', bottom: -0.05, food: true,
    },
    cocoa: {   // какао в бумажном стаканчике: розовая муфта, зефирки
      parts: P => [
        P.cyl('#FFFDF9', 0.042, 0.033, 0.105, [0, 0, 0]),
        P.cyl('#F6C6D0', 0.0405, 0.0365, 0.042, [0, -0.004, 0], null, { ol: false }),
        P.cyl('#8B5A3C', 0.0385, 0.0385, 0.004, [0, 0.046, 0], null, { tag: TAG.level, ol: false }),
        ...[[-0.012, 0.051, 0.01], [0.014, 0.052, -0.008], [0.002, 0.054, 0.016]].map(q => P.sphLo('#FFFDF9', q, [0.011, 0.008, 0.011], { tag: TAG.level, olT: 0.002 })),
      ],
      hold: { in: 0.028, up: 0.004, fwd: 0.0 },
      drink: { key: [0, 0.052, -0.036] }, level: { depth: 0.07, scale: 0.84 }, bottom: -0.0525,
    },
    water: {   // стаканчик воды
      parts: P => [
        P.cyl('#DDF1FA', 0.04, 0.031, 0.1, [0, 0, 0]),
        P.cyl('#8CCDEB', 0.037, 0.037, 0.004, [0, 0.038, 0], null, { tag: TAG.level, ol: false }),
      ],
      hold: { in: 0.027, up: 0.004, fwd: 0.0 },
      drink: { key: [0, 0.05, -0.034] }, level: { depth: 0.065, scale: 0.84 }, bottom: -0.05,
    },
    apple: {
      parts: P => [
        P.sph('#E2475B', [0, 0, 0], [0.038, 0.035, 0.038], { tag: TAG.food }),
        P.sph('#F27A82', [0.016, 0.006, 0.026], [0.016, 0.014, 0.01], { tag: TAG.food, ol: false }),
        P.cyl('#7A5236', 0.003, 0.0035, 0.022, [0, 0.038, 0], [0, 0, 0.25], { olT: 0.0018 }),
        P.sph('#7FB35A', [0.012, 0.042, 0], [0.012, 0.003, 0.006], { r: [0, 0, 0.5], olT: 0.0018 }),
      ],
      hold: { in: 0.028, up: 0.012, fwd: 0.012 },
      bite: { key: [0, 0.034, 0.006], pivot: [0, -0.03, 0], steps: [0.78, 0.52, 0] },
      eat: { f: [-0.1, 0.55, 0.8], n: [-1, 0, 0] }, crumbs: '#FFF1D8', bottom: -0.034, food: true,
    },
    pear: {
      parts: P => [
        P.lathe('#D6E07A', [[0.0, -0.045], [0.026, -0.04], [0.036, -0.02], [0.032, 0.0], [0.02, 0.018], [0.014, 0.036], [0.006, 0.048], [0.0, 0.05]], [0, 0, 0], null, { tag: TAG.food, seg: 14 }),
        P.sph('#F2B36B', [0.018, -0.018, 0.022], [0.014, 0.014, 0.008], { tag: TAG.food, ol: false }),
        P.cyl('#7A5236', 0.0028, 0.0032, 0.02, [0, 0.058, 0], [0, 0, 0.2], { olT: 0.0018 }),
      ],
      hold: { in: 0.024, up: 0.0, fwd: 0.01 },
      bite: { key: [0, 0.03, 0.012], pivot: [0, -0.04, 0], steps: [0.78, 0.52, 0] },
      eat: { f: [-0.18, 0.62, 0.76], n: [-1, 0, 0] }, crumbs: '#FBF6D8', bottom: -0.045, food: true,
    },
    grapes: {   // гроздь: ягоды висят под рукой (держит за веточку)
      parts: (P, T) => {
        const GT = tinySphere(T);
        const b = [[0, -0.02, 0], [0.014, -0.022, 0.01], [-0.014, -0.022, -0.006], [0.006, -0.022, -0.016], [-0.006, -0.024, 0.016],
          [0.008, -0.04, 0.006], [-0.01, -0.04, 0.004], [0.002, -0.04, -0.012], [0.0, -0.057, 0.0], [0.011, -0.055, -0.006], [-0.008, -0.058, -0.008], [0.0, -0.072, 0.004], [0.004, -0.086, -0.002]];
        return [
          P.cyl('#7A5236', 0.0025, 0.003, 0.03, [0, 0.0, 0], [0, 0, 0.1], { olT: 0.0018, seg: 6, ol: false }),
          P.sphLo('#8FB35A', [0.012, 0.008, 0], [0.012, 0.003, 0.008], { r: [0, 0, 0.6], olT: 0.0018 }),
          ...b.map((q, i) => Object.assign(P.sphLo(i % 3 ? '#8E5BB5' : '#A274C7', [q[0] * 1.35, q[1] * 1.3, q[2] * 1.35], [0.0145, 0.0155, 0.0145], { tag: TAG.food, olT: 0.002 }), { g: GT })),
        ];
      },
      hold: { in: 0.0, up: -0.004, fwd: 0.0 },
      bite: { key: [0, -0.1, 0], pivot: [0, -0.005, 0], steps: [0.72, 0.45, 0] },
      pick: 'grape', pickKey: [0, -0.06, 0], crumbs: '#B88AD8', bottom: -0.125, food: true,
    },
    icecream: {   // рожок: вафля в клетку, шарик клубничный и сливочный
      parts: P => [
        P.cone('#E3AE63', 0.03, 0.1, [0, -0.02, 0], [PI, 0, 0], { seg: 12 }),
        ...[0, 1, 2].map(i => P.tor('#C98B45', 0.025 - i * 0.0075, 0.0018, [0, 0.012 - i * 0.022, 0], [PI / 2, 0, 0], { ol: false, ts: 12 })),
        P.sph('#FFF1D6', [0, 0.04, 0], [0.032, 0.03, 0.032], { tag: TAG.food }),
        P.sph('#F6B3C4', [0, 0.075, 0], [0.028, 0.026, 0.028], { tag: TAG.food }),
        P.sphLo('#E2405E', [0, 0.103, 0], [0.007, 0.007, 0.007], { tag: TAG.food, olT: 0.002 }),
      ],
      hold: { in: 0.018, up: -0.035, fwd: 0.0 },
      bite: { key: [0, 0.085, -0.012], pivot: [0, 0.01, 0], steps: [0.7, 0.4, 0], whole: true },
      eat: { f: [-0.1, 0.45, 0.88], n: [-1, 0, 0] }, crumbs: '#FFE3EA', bottom: -0.07, food: true, lick: true,
    },
    flower: {   // цветок: стебель, листик, пять лепестков, жёлтая серединка
      parts: P => [
        P.cyl('#6FA552', 0.0035, 0.004, 0.2, [0, 0.03, 0], null, { olT: 0.0018, seg: 7 }),
        P.sphLo('#7FB35A', [0.016, 0.02, 0], [0.018, 0.004, 0.008], { r: [0, 0, 0.6], olT: 0.0018 }),
        ...ring(5, (i, a) => P.sphLo('#F6A6C0', [Math.sin(a) * 0.018, 0.136, Math.cos(a) * 0.018], [0.016, 0.006, 0.012], { r: [0, a, 0, 'YXZ'] })),
        P.sphLo('#F5C842', [0, 0.14, 0], [0.01, 0.008, 0.01], { olT: 0.002 }),
      ],
      hold: { in: 0.0, up: -0.04, fwd: 0.0 },
      sniff: { key: [0, 0.14, 0] }, bottom: -0.07,
    },
    coin: {
      parts: P => [
        P.cyl('#E8C04A', 0.013, 0.013, 0.0032, [0, 0, 0], [PI / 2, 0, 0], { olT: 0.0016 }),
        P.tor('#F7DB7A', 0.0095, 0.0012, [0, 0, 0.0018], null, { ol: false, ts: 14 }),
      ],
      hold: { in: -0.012, up: 0.012, fwd: 0.052, rot: [0, 0, 0] }, bottom: -0.0016, pinch: true,
    },
    bracelet: {   // светлый браслет с чернёным узором
      parts: P => [
        P.tor('#D9DDE7', 0.03, 0.0065, [0, 0, 0], null, { ts: 22, rs: 6 }),
        ...ring(8, (i, a) => P.sphLo('#5C6070', [Math.sin(a) * 0.03, Math.cos(a) * 0.03, 0.0058], [0.0032, 0.0032, 0.0016], { ol: false })),
      ],
      hold: { in: 0.0, up: 0.036, fwd: 0.004 }, show: true, bottom: -0.0065,
    },
    box: {   // шкатулочка: узор чернью по крышке и бокам, ножки-шарики
      parts: P => [
        P.box('#D3D7E2', [0.064, 0.032, 0.046], [0, 0, 0]),
        P.box('#E4E7EF', [0.068, 0.012, 0.05], [0, 0.021, 0]),
        P.sphLo('#E4E7EF', [0, 0.031, 0], [0.008, 0.005, 0.008], { olT: 0.0018 }),
        ...[[-0.024, 0.0275], [0, 0.0275], [0.024, 0.0275]].map(q => P.box('#5C6070', [0.012, 0.0015, 0.03], [q[0], q[1], 0], null, { ol: false })),
        ...[[-0.022, -0.012], [0.0, -0.012], [0.022, -0.012]].map(q => P.sphLo('#5C6070', [q[0], 0.002, 0.0235], [0.006, 0.006, 0.0012], { ol: false })),
        ...[[-0.026, -0.018], [0.026, -0.018], [-0.026, 0.018], [0.026, 0.018]].map(q => P.sphLo('#C7CBD6', [q[0], -0.019, q[1]], [0.005, 0.004, 0.005], { olT: 0.0016 })),
      ],
      hold: { in: 0.022, up: -0.008, fwd: 0.026 }, show: true, bottom: -0.031, scale: 1.35,
    },
    water_cupped: {   // вода в ладошках
      parts: P => [P.sph('#9AD3EE', [0, 0, 0], [0.04, 0.012, 0.03], { ol: false })],
      hold: { in: 0.02, up: 0.0, fwd: 0.02 },
    },
  };
  const NAMES = Object.keys(DEFS).filter(k => k !== 'water_cupped' && k !== 'kernel' && k !== 'grape');

  function makeItem(name, opt) {
    opt = opt || {};
    const T = opt.THREE || window.THREE, def = DEFS[name];
    if (!T || !def) return null;
    const L = lib(T);
    const geo = merge(T, def.parts(partMaker(T, L.G), T), opt.outline || 0.0028);
    if (def.scale) { geo.scale(def.scale, def.scale, def.scale); geo.userData.base = geo.attributes.position.array.slice(); }
    const mesh = new T.Mesh(geo, opt.material || L.material(opt.gradientMap));
    mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = false;
    mesh.name = 'item:' + name;
    const it = mesh.userData.it = { name, def, bites: 0, level: 1, mesh };
    const tag = geo.userData.tag, base = geo.userData.base, pos = geo.attributes.position.array;
    it.setLevel = f => {
      const lv = def.level; if (!lv) return;
      it.level = f = clamp(f, 0, 1);
      for (let i = 0; i < tag.length; i++) if (tag[i] & TAG.level) {
        const sc = lerp(1, lv.scale, 1 - f);
        pos[i * 3] = base[i * 3] * sc; pos[i * 3 + 1] = base[i * 3 + 1] - (1 - f) * lv.depth; pos[i * 3 + 2] = base[i * 3 + 2] * sc;
      }
      geo.attributes.position.needsUpdate = true;
    };
    // откусить: еда сжимается к «ручке» (pivot); последний кусочек — предмет исчезает
    it.bite = () => {
      const b = def.bite; if (!b) return false;
      const s = b.steps[Math.min(it.bites, b.steps.length - 1)]; it.bites++;
      if (s <= 0.001) return false;
      const pv = it.side === 'R' ? [-b.pivot[0], b.pivot[1], b.pivot[2]] : b.pivot;
      for (let i = 0; i < tag.length; i++) if (b.whole || (tag[i] & TAG.food)) {
        for (let k = 0; k < 3; k++) pos[i * 3 + k] = pv[k] + (base[i * 3 + k] - pv[k]) * s;
      }
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      return true;
    };
    it.left = () => (def.bite ? Math.max(0, def.bite.steps.length - it.bites) : 0);
    it.dispose = () => { if (mesh.parent) mesh.parent.remove(mesh); geo.dispose(); };
    return mesh;
  }
  // предмет из игры (букет, стакан city.setHeld и т.п.): обёртка с хватом
  function wrapItem(obj, hold) {
    if (obj.userData.it) return obj;
    obj.userData.it = { name: obj.name || 'thing', def: { hold: Object.assign({ in: 0, up: 0, fwd: 0 }, hold || {}) }, bites: 0, level: 1, mesh: obj, setLevel() {}, bite() { return false; }, left: () => 0, dispose() { if (obj.parent) obj.parent.remove(obj); } };
    return obj;
  }

  /* ---------------------------------------------------------------------
     СЛОЙ
     --------------------------------------------------------------------- */
  /* --- один слой на героиню (волна 4B): город (js/world/main.js) держит слой всю сессию, загрузчик регионов
     (js/world/regions.js) или комната может позвать create на ту же модель — второй слой на тот же скелет
     (вторая кость лупы, две позы поверх HeroAnim) сломал бы руки. Поэтому create отдаёт «ручку» общего слоя:
     setRoot / on / scene / onEvent — у «активной» ручки: той, что последней звала update / animState / play / chain /
     give (чей цикл сейчас крутится: город, регион или комната), а пока никто не звал — у последней созданной.
     dispose ручки снимает её, настоящий dispose — когда ручек не осталось. Остальные опции (pocket, footLock,
     gradientMap) — у первого. Регион может держать свою ручку всю игру и не звать dispose: после возвращения
     город первым же кадром (update) снова становится активным. --- */
  const SHARED = new WeakMap();   // модель героини → { core, users: [{ o, handle }], dead }
  function create(o) {
    o = o || {};
    const T = o.THREE || window.THREE, anim = o.anim, root = o.heroRoot;
    if (!T || !anim || !anim.bones || !root) return null;
    const model = o.model || (anim.bones.hips && anim.bones.hips.parent);
    if (!model) return null;
    let e = SHARED.get(model);
    if (!e || e.dead) {
      const ent = { core: null, users: [], dead: false, active: null };
      const top = () => (ent.active && ent.users.includes(ent.active) ? ent.active : ent.users[ent.users.length - 1] || null);
      const co = Object.assign({}, o);
      Object.defineProperty(co, 'scene', { enumerable: true, get: () => { const u = top(); return u ? u.o.scene : o.scene; } });
      co.setRoot = (p, yaw) => { const u = top(); if (u && u.o.setRoot) u.o.setRoot(p, yaw); };
      co.on = (n, d) => { const u = top(); if (!u) return; if (u.o.on) u.o.on(n, d); if (u.handle && u.handle.onEvent) u.handle.onEvent(n, d); };
      ent.top = top;
      ent.core = createCore(co);
      if (!ent.core) return null;
      SHARED.set(model, ent); e = ent;
    }
    const ent = e, user = { o, handle: null };
    ent.users.push(user);
    const h = Object.create(ent.core);   // методы и state — общего слоя; свои — dispose и onEvent
    h.onEvent = null;
    ['update', 'animState', 'play', 'chain', 'give'].forEach(k => { const f = ent.core[k]; h[k] = (...a) => { ent.active = user; return f(...a); }; });
    h.dispose = () => {
      const i = ent.users.indexOf(user); if (i >= 0) ent.users.splice(i, 1);
      if (ent.active === user) ent.active = null;
      if (!ent.users.length && !ent.dead) { ent.dead = true; SHARED.delete(model); ent.core.dispose(); }
    };
    h.users = () => ent.users.length;
    h.active = () => ent.top() === user;   // эта ручка сейчас получает setRoot / on / scene
    user.handle = h;
    return h;
  }
  function createCore(o) {
    const T = o.THREE || window.THREE, anim = o.anim, root = o.heroRoot;
    if (!T || !anim || !anim.bones || !root) return null;
    const B = anim.bones, model = o.model || B.hips.parent;
    if (!model) return null;
    let api = null;
    const emit = (n, d) => { try { if (o.on) o.on(n, d); if (api && api.onEvent) api.onEvent(n, d); } catch (e) { /* звук не должен ронять игру */ } };
    const fxParent = () => o.scene || root.parent || model;
    const V = () => new T.Vector3(), Q = () => new T.Quaternion();
    const X = new T.Vector3(1, 0, 0), UP = new T.Vector3(0, 1, 0), ONE = new T.Vector3(1, 1, 1);
    const meshQ = Q(), meshQi = Q(), sc0 = V(), dcp = V();
    let S = 1;   // масштаб модели в мире
    const wpos = (obj, out) => out.setFromMatrixPosition(obj.matrixWorld);
    const wquat = (obj, out) => { obj.matrixWorld.decompose(dcp, out, sc0); return out; };
    const toV = (a, out) => (a && a.isVector3 ? out.copy(a) : Array.isArray(a) ? out.set(a[0], a[1], a[2]) : a && typeof a.x === 'number' ? out.set(a.x, a.y, a.z) : out.set(0, 0, 0));
    const gripV = { L: new T.Vector3().fromArray(GRIP.L), R: new T.Vector3().fromArray(GRIP.R) };
    const itOf = x => (x && x.userData && x.userData.it) || null;
    const objOf = x => (x && x.isObject3D ? x : null);

    /* --- лупа: отдельная кость «mag» в правой кисти, чтобы убрать лупу в карман (обе руки свободны).
       Геометрия копируется по ссылкам (общие позиции/нормали/UV), своя — только skinIndex: другие героини не задеты --- */
    let mag = null;
    function setupMag() {
      if (o.pocket === false || !model.isSkinnedMesh || !model.skeleton) return null;
      try {
        const sk = model.skeleton, iR = sk.bones.indexOf(B.hand_R);
        if (iR < 0) return null;
        const g = model.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, UV = g.attributes.uv;
        // цвета — авторские: образ (js/hero_look3d.js) мог перекрасить текстуру, тёмный рукав не должен стать «ручкой лупы»
        const map = model.material && model.material.map, img = map && (window.HeroLook3D && HeroLook3D.source ? HeroLook3D.source(map) : map.image);
        if (!SI || !SW || !UV || !img || !img.width) return null;
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const px = cx.getImageData(0, 0, cv.width, cv.height).data, flip = !!map.flipY;
        const si = SI.array.slice(), n = SI.count, iMag = sk.bones.length, get = (a, i, k) => (k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i));
        const sel = new Uint8Array(n), rb = new Float32Array(n), onR = new Uint8Array(n), Py = g.attributes.position;
        for (let i = 0; i < n; i++) {
          let w = 0;
          for (let k = 0; k < 4; k++) if (get(SI, i, k) === iR) w += get(SW, i, k);
          if (w < 0.5) continue;
          onR[i] = 1;
          let u = UV.getX(i), vv = UV.getY(i); u -= Math.floor(u); vv = flip ? 1 - vv : vv; vv -= Math.floor(vv);
          const x = Math.min(cv.width - 1, Math.floor(u * cv.width)), y = Math.min(cv.height - 1, Math.floor(vv * cv.height));
          const p = (y * cv.width + x) * 4, r = px[p], b = px[p + 2];
          rb[i] = b / Math.max(1, r);
          if ((r < 180 && b < 0.62 * r) || r < 120 || b < 0.5 * r) sel[i] = 1;   // латунь и тёмная ручка; кожа светлая и розовая
        }
        // соседи по треугольникам: блики латуни и ручка у кулака (ниже середины кулака, желтоватые) — тоже лупа
        const idx = g.index ? g.index.array : null, yCut = 0.714;
        for (let pass = 0; idx && pass < 2; pass++) {
          const add = [];
          for (let t = 0; t < idx.length; t += 3) {
            const a0 = idx[t], a1 = idx[t + 1], a2 = idx[t + 2];
            if (!(sel[a0] || sel[a1] || sel[a2]) || (sel[a0] && sel[a1] && sel[a2])) continue;
            [a0, a1, a2].forEach(v => { if (!sel[v] && onR[v] && rb[v] < 0.58 && Py.getY(v) < yCut) add.push(v); });
          }
          add.forEach(v => { sel[v] = 1; });
        }
        let cnt = 0;
        for (let i = 0; i < n; i++) if (sel[i]) { for (let k = 0; k < 4; k++) if (get(SI, i, k) === iR) si[i * 4 + k] = iMag; cnt++; }
        if (cnt < 50 || cnt > 4000) return null;
        const g2 = new T.BufferGeometry();
        for (const k in g.attributes) g2.setAttribute(k, k === 'skinIndex' ? new T.BufferAttribute(si, 4, SI.normalized) : g.attributes[k]);
        g2.setIndex(g.index); g2.groups = g.groups.slice();
        if (g.boundingBox) g2.boundingBox = g.boundingBox.clone();
        if (g.boundingSphere) g2.boundingSphere = g.boundingSphere.clone();
        g2.userData = Object.assign({}, g.userData, { interactMag: cnt });
        const meshes = [];
        root.traverse(m => { if (m.isSkinnedMesh && m.skeleton === sk && m.geometry === g) meshes.push(m); });
        meshes.forEach(m => { m.geometry = g2; });
        const bone = new T.Bone(); bone.name = 'mag'; bone.position.fromArray(MAG_PIVOT); B.hand_R.add(bone);
        sk.bones.push(bone); sk.boneInverses.push(new T.Matrix4().makeTranslation(-MAG_PIVOT[0], -MAG_PIVOT[1], -MAG_PIVOT[2]).multiply(sk.boneInverses[iR]));
        const need = sk.bones.length * 16;
        if (sk.boneMatrices.length < need) {
          const a = new Float32Array(need); a.set(sk.boneMatrices.subarray(0, Math.min(need, sk.boneMatrices.length))); sk.boneMatrices = a;
          if (sk.boneTexture) { sk.boneTexture.dispose(); sk.boneTexture = null; }
        }
        return { bone, g, g2, meshes, sk, cnt };
      } catch (e) { return null; }
    }
    mag = setupMag();

    /* --- состояние --- */
    const ch = {
      body: { crouch: 0, bend: 0, back: 0, twist: 0 },
      assist: { bend: 0, want: 0 },   // не дотягивается — корпус сам чуть наклоняется вперёд (плавно)
      look: { w: 0, w0: 0, w1: 0, e: 1, pt: V(), src: V(), dst: null },
      head: { pitch: 0, chew: 0, nod: 0 },
      hand: {},
    };
    ['L', 'R'].forEach(sd => {
      ch.hand[sd] = { w: 0, w0: 0, w1: 0, e: 1, u: 1, src: null, dst: null, lastW: V(), lastQ: Q(), animW: V(), animQ: Q(), wristW: V(), Q: Q(), pole: null, active: false, auto: false };
    });
    const held = { L: null, R: null };
    let pocketed = false, seatedOn = null, seatInfo = null, autoPocket = false;
    const ovr = {};            // подмена состояния HeroAnim на время действия
    const rootM = { pos: V(), yaw: 0 };
    const settle = [], flights = [], paws = [], fx = [];

    /* --- корень --- */
    function rootRead() { rootM.pos.copy(root.position); rootM.yaw = root.rotation.y; }
    function rootWrite() {
      root.position.copy(rootM.pos); root.rotation.y = rootM.yaw;
      if (o.setRoot) { try { o.setRoot(rootM.pos.clone(), rootM.yaw); } catch (e) { /* */ } }
      root.updateMatrixWorld(true);
    }
    const worldToParent = (p, out) => (root.parent ? root.parent.worldToLocal(out.copy(p)) : out.copy(p));
    function heroFwd(out) { out.set(0, 0, 1).applyQuaternion(meshQ); out.y = 0; if (out.lengthSq() < 1e-8) out.set(0, 0, 1); return out.normalize(); }
    function heroPos(out) { return wpos(root, out); }

    /* --- якоря: точки в мире ---
       'mouth' 'nose' 'eyes' 'chest' 'front' 'pocket' 'carry' 'clap' 'anim' | Vector3 (мир) | Object3D | { obj, off } | { item, key } |
       { model:[x,y,z] } (оси героини) | { at: якорь, off: мир, offM: оси героини } | function(out) */
    const aT = V();
    function boneLocal(bn, x, y, z, out) { return B[bn].localToWorld(out.set(x, y, z)); }
    function anchor(a, sd, out) {
      if (a === undefined || a === null) return heroPos(out);
      if (Array.isArray(a)) return toV(a, out);   // [x, y, z] (у массива есть свой a.at — до проверки a.at не доходим)
      if (typeof a === 'function') { const r = a(out, api); return r && r.isVector3 && r !== out ? out.copy(r) : out; }
      if (a.isVector3) return out.copy(a);
      if (a.isObject3D) { a.updateWorldMatrix(true, false); return wpos(a, out); }
      const sg = sd === 'R' ? -1 : 1;
      if (typeof a === 'string') {
        switch (a) {
          case 'mouth': return boneLocal('head', MOUTH[0], MOUTH[1], MOUTH[2], out);
          case 'nose': return boneLocal('head', NOSE[0], NOSE[1], NOSE[2], out);
          case 'eyes': return boneLocal('head', EYES[0], EYES[1], EYES[2], out);
          case 'chest': return boneLocal('chest', 0, 0.04, 0.2, out);
          case 'front': return boneLocal('chest', 0, -0.05, 0.42, out);
          case 'pocket': return boneLocal('hips', sg * 0.128, -0.072, 0.088, out);
          case 'carry': return boneLocal('chest', sg * 0.15, -0.17, 0.25, out);
          case 'clap': return boneLocal('chest', 0, 0.04, 0.3, out);
          case 'anim': return out.copy(ch.hand[sd || 'L'].animW);
          default: return heroPos(out);
        }
      }
      if (a.model) return model.localToWorld(toV(a.model, out));
      if (a.obj) { a.obj.updateWorldMatrix(true, false); return a.obj.localToWorld(toV(a.off, out)); }
      if (a.item) { a.item.updateWorldMatrix(true, false); return a.item.localToWorld(toV(a.key, out)); }
      if (a.at !== undefined) {
        anchor(a.at, sd, out);
        if (a.off) out.add(toV(a.off, aT));
        if (a.offM) out.add(toV(a.offM, aT).applyQuaternion(meshQ).multiplyScalar(S));
        return out;
      }
      return toV(a, out);
    }

    /* --- хваты: поворот кисти в мире --- */
    const b0 = V(), b1 = V(), b2 = V(), b3 = V(), b4 = V(), bM = new T.Matrix4();
    function basisQ(sd, f, n, out) {
      // f, n — оси модели для левой; правая — зеркально по x. Столбцы — образы осей кисти x, y, z
      b0.copy(f).normalize(); b1.copy(n); b1.addScaledVector(b0, -b1.dot(b0)).normalize();
      if (sd === 'R') { b0.x = -b0.x; b1.x = -b1.x; }
      if (sd === 'L') { b2.copy(b1).negate(); b3.copy(b0).negate(); b4.crossVectors(b1, b0); }
      else { b2.copy(b1); b3.copy(b0).negate(); b4.crossVectors(b0, b1); }
      bM.makeBasis(b2, b3, b4);
      return out.setFromRotationMatrix(bM);
    }
    const plQ = Q(), plT = Q();
    // где предмет в кисти (оси кисти): позиция outP и поворот outQ
    function placement(it, sd, outP, outQ) {
      const h = (it && it.def.hold) || { in: 0, up: 0, fwd: 0 }, inS = sd === 'L' ? -1 : 1;
      plQ.setFromAxisAngle(X, PI / 2);
      outQ.copy(plQ);
      if (h.rot) outQ.multiply(plT.setFromEuler(new T.Euler(h.rot[0], h.rot[1], h.rot[2])));
      return outP.set(inS * h.in, h.up, h.fwd).applyQuaternion(plQ).add(gripV[sd]);
    }
    const rA = V(), rB = V(), rC = V(), rM = new T.Matrix4(), rP = V(), rQ = Q(), rF = V(), rN = V();
    function rotSpec(spec, sd, out) {
      if (!spec || spec === 'anim') return out.copy(ch.hand[sd].animQ);
      if (typeof spec === 'function') return spec(out, sd, api);
      if (typeof spec === 'string') spec = GRIPS[spec] || GRIPS.hold;
      if (spec.f) { basisQ(sd, toV(spec.f, rF), toV(spec.n, rN), out); return out.premultiply(meshQ); }
      if (spec.itemY) {
        // оси предмета в модели → поворот кисти = поворот предмета · (поворот предмета в кисти)⁻¹
        const it = itOf(spec.item) || itOf(held[sd]);
        toV(spec.itemY, rA).normalize(); toV(spec.itemZ, rB);
        if (sd === 'R' && spec.mirror !== false) { rA.x = -rA.x; rB.x = -rB.x; }
        rB.addScaledVector(rA, -rB.dot(rA)).normalize(); rC.crossVectors(rA, rB);
        rM.makeBasis(rC, rA, rB); out.setFromRotationMatrix(rM).premultiply(meshQ);
        placement(it, sd, rP, rQ);
        return out.multiply(rQ.invert());
      }
      return out.copy(ch.hand[sd].animQ);
    }

    /* --- туловище: капсула, из которой выталкиваются кисть и локоть (рука не проходит сквозь тело) --- */
    const capA = V(), capB = V(), capF = V(), cq = Q(), p0 = V(), p1 = V(), p2 = V();
    function torsoCapsule() {
      wpos(B.hips, capA); wpos(B.neck, capB);
      wquat(B.chest, cq); capF.set(0, 0, 1).applyQuaternion(cq);
      capA.addScaledVector(capF, 0.02 * S); capA.y -= 0.06 * S;
    }
    function pushOut(p, R, out) {
      p0.subVectors(capB, capA); const L2 = p0.lengthSq();
      const t = clamp(p1.subVectors(p, capA).dot(p0) / Math.max(1e-8, L2), 0, 1);
      p1.copy(capA).addScaledVector(p0, t); p2.subVectors(p, p1);
      const d = p2.length();
      if (d >= R) return out.set(0, 0, 0);
      if (d < 1e-5) p2.copy(capF); else p2.multiplyScalar(1 / d);
      return out.copy(p2).multiplyScalar(R - d);
    }

    /* --- IK двух костей: локоть/колено — шарнир вокруг своей x (точное решение), верхняя кость — 3 степени --- */
    const ikA = V(), ikF = V(), ikW = V(), ikE1 = V(), ikE2 = V(), ikE3 = V(), ike1 = V(), ike2 = V(), ike3 = V(), ikM0 = new T.Matrix4(), ikM1 = new T.Matrix4();
    const ikRes = { q: Q(), th: 0, reach: 0 };
    function hinge(a, F, d, sign) {
      const aa = a.lengthSq(), ff = F.lengthSq();
      const A = a.y * F.y + a.z * F.z, Bv = a.z * F.y - a.y * F.z, R = Math.hypot(A, Bv) || 1e-6;
      const K = (d * d - aa - ff) / 2 - a.x * F.x, phi = Math.atan2(Bv, A);
      return phi + sign * Math.acos(clamp(K / R, -1, 1));
    }
    // target, pole — в осях родителя upper; sign: +1 колено (голень назад), −1 локоть (предплечье вперёд)
    function solve2(upper, lower, end, target, pole, sign) {
      ikA.copy(lower.position); ikF.copy(end.position);
      ikW.subVectors(target, upper.position);
      const aa = ikA.lengthSq(), ff = ikF.lengthSq(), Rm = Math.hypot(ikA.y * ikF.y + ikA.z * ikF.z, ikA.z * ikF.y - ikA.y * ikF.z);
      const dmax = Math.sqrt(Math.max(1e-6, aa + ff + 2 * (ikA.x * ikF.x + Rm))) * 0.998;
      const dRaw = ikW.length(), d = clamp(dRaw, 0.25 * dmax, dmax);
      ikRes.reach = dRaw / dmax;
      const th = hinge(ikA, ikF, d, sign), c = Math.cos(th), s = Math.sin(th);
      ike1.set(ikF.x, ikF.y * c - ikF.z * s, ikF.y * s + ikF.z * c).add(ikA).normalize();
      ike2.copy(ikA).addScaledVector(ike1, -ikA.dot(ike1)); if (ike2.lengthSq() < 1e-10) ike2.set(0, 0, sign); ike2.normalize(); ike3.crossVectors(ike1, ike2);
      ikE1.copy(ikW).multiplyScalar(1 / Math.max(1e-6, dRaw));
      ikE2.copy(pole).addScaledVector(ikE1, -pole.dot(ikE1)); if (ikE2.lengthSq() < 1e-8) ikE2.set(0, 0, 1).addScaledVector(ikE1, -ikE1.z); ikE2.normalize(); ikE3.crossVectors(ikE1, ikE2);
      ikM0.makeBasis(ike1, ike2, ike3); ikM1.makeBasis(ikE1, ikE2, ikE3); ikM1.multiply(ikM0.transpose());
      ikRes.q.setFromRotationMatrix(ikM1); ikRes.th = th;
      return ikRes;
    }

    /* --- защита: если игра пропустила anim.update, поза слоя не накапливается --- */
    const TOUCH = ['hips', 'spine', 'chest', 'neck', 'head', 'hair', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R', 'coat_L', 'coat_R',
      'upperarm_L', 'forearm_L', 'hand_L', 'upperarm_R', 'forearm_R', 'hand_R'].filter(n => B[n]);
    const pre = {}, post = {}; TOUCH.forEach(n => { pre[n] = Q(); post[n] = Q(); });
    const hipsPre = V(), hipsPost = V(); let guardOn = false;
    function guardIn() {
      if (guardOn) {
        TOUCH.forEach(n => { if (B[n].quaternion.equals(post[n])) B[n].quaternion.copy(pre[n]); });
        if (B.hips.position.equals(hipsPost)) B.hips.position.copy(hipsPre);
      }
      TOUCH.forEach(n => pre[n].copy(B[n].quaternion)); hipsPre.copy(B.hips.position);
    }
    function guardOut() { TOUCH.forEach(n => post[n].copy(B[n].quaternion)); hipsPost.copy(B.hips.position); guardOn = true; }

    /* --- тело: присед/наклон/поворот корпуса; стопы стоят (IK ног), полы пальто ложатся по бёдрам, волосы висят --- */
    const ank = { L: V(), R: V() }, footQ = { L: Q(), R: Q() }, kneePole = V(), bq = Q(), bq2 = Q(), be = new T.Euler(), bt = V(), bd0 = V();
    // стопы на время действия стоят там, где стояли (HeroAnim на месте чуть переминается — во время действия нельзя)
    const lock = { on: false, w: 0, ank: { L: V(), R: V() }, q: { L: Q(), R: Q() }, rp: V(), ry: 0, moved: true, prev: { L: V(), R: V() }, calm: 0, still: 0 };
    const lkP = V(), lkA = V();
    function footLock(dt) {
      wpos(root, lkP);
      lock.moved = lkP.distanceToSquared(lock.rp) > 1e-10 || Math.abs(root.rotation.y - lock.ry) > 1e-6;
      lock.rp.copy(lkP); lock.ry = root.rotation.y;
      lock.still = lock.moved ? 0 : lock.still + dt;
      // стопы HeroAnim уже успокоились после шага? (иначе запомним шаг «в разножку»)
      let quiet = true;
      ['L', 'R'].forEach(sd => { wpos(B['foot_' + sd], lkA); if (lkA.distanceTo(lock.prev[sd]) > 0.0008 * S) quiet = false; lock.prev[sd].copy(lkA); });
      lock.calm = quiet && !lock.moved ? lock.calm + dt : 0;
      const want = !!run.act && !lock.moved && !seatedOn && !ovr.sitting && o.footLock !== false;
      if (want && !lock.on && (lock.calm > 0.08 || lock.still > 0.7)) { ['L', 'R'].forEach(sd => { wpos(B['foot_' + sd], lock.ank[sd]); wquat(B['foot_' + sd], lock.q[sd]); }); lock.on = true; }
      if (!want) lock.on = false;
      lock.w += ((lock.on ? 1 : 0) - lock.w) * (1 - Math.exp(-(lock.on ? 30 : 8) * dt));
      if (lock.moved) lock.w = 0;
    }
    function bodyPass(dt) {
      const A = ch.assist;
      A.bend += (A.want - A.bend) * (1 - Math.exp(-(A.want > A.bend ? 7 : 3) * dt)); A.want = 0;
      footLock(dt);
      const cr = ch.body.crouch, bd = ch.body.bend + A.bend, bk = ch.body.back, tw = ch.body.twist;
      if (cr < 1e-4 && Math.abs(bd) < 1e-4 && Math.abs(bk) < 1e-4 && Math.abs(tw) < 1e-4 && lock.w < 1e-3) return;
      if (A.bend > 0.75) A.bend = 0.75;
      ['L', 'R'].forEach(sd => {
        wpos(B['foot_' + sd], ank[sd]); wquat(B['foot_' + sd], footQ[sd]);
        if (lock.w > 1e-3) { ank[sd].lerp(lock.ank[sd], lock.w); footQ[sd].slerp(lock.q[sd], lock.w); }
      });
      const bdp = Math.max(0, bd);
      const drop = cr * 0.33 + bdp * 0.035, back = cr * 0.1 + Math.sin(bdp) * 0.1 + bk;
      B.hips.position.y -= drop; B.hips.position.z -= back;
      B.hips.quaternion.multiply(bq.setFromAxisAngle(X, cr * 0.2 + bd * 0.26));
      B.spine.quaternion.multiply(bq.setFromEuler(be.set(cr * 0.2 + bd * 0.38, tw * 0.5, 0)));
      B.chest.quaternion.multiply(bq.setFromEuler(be.set(cr * 0.12 + bd * 0.36, tw * 0.5, 0)));
      B.hips.updateMatrixWorld(true);
      ['L', 'R'].forEach((sd, i) => {
        const th = B['thigh_' + sd], sh = B['shin_' + sd], ft = B['foot_' + sd];
        B.hips.worldToLocal(bt.copy(ank[sd]));
        kneePole.set(i ? -0.3 : 0.3, 0.05, 1).applyQuaternion(bq2.copy(B.hips.quaternion).invert());
        const r = solve2(th, sh, ft, bt, kneePole, 1);
        th.quaternion.copy(r.q); sh.quaternion.setFromAxisAngle(X, r.th);
        th.updateMatrixWorld(true);
        wquat(sh, bq); ft.quaternion.copy(bq.invert().multiply(footQ[sd]));
        const cb = B['coat_' + sd];
        if (cb) { bd0.set(0, -1, 0).applyQuaternion(th.quaternion); const ph = Math.atan2(-bd0.z, -bd0.y); const k = clamp(cr * 1.6 + bdp * 0.4, 0, 1); cb.rotation.x = lerp(cb.rotation.x, ph * 0.82, k); }
      });
      if (B.hair) B.hair.quaternion.multiply(bq.setFromAxisAngle(X, -(cr * 0.5 + bd) * 0.42));
      B.hips.updateMatrixWorld(true);
    }

    /* --- взгляд и голова: жевать, кивать, наклонить --- */
    const lP = V(), lE = V(), lD = V(), lq = Q(), lq2 = Q(), le = new T.Euler();
    function lookPass(t) {
      const L = ch.look, H = ch.head;
      if (L.w > 0.001) {
        if (L.dst) anchor(L.dst, null, lD); else lD.copy(L.src);
        lP.lerpVectors(L.src, lD, L.e); L.pt.copy(lP);
        boneLocal('head', EYES[0], EYES[1], EYES[2], lE);
        lD.subVectors(lP, lE);
        wquat(B.chest, lq); lD.applyQuaternion(lq.invert());
        const yaw = clamp(Math.atan2(lD.x, lD.z), -1.15, 1.15), pitch = clamp(Math.atan2(-lD.y, Math.hypot(lD.x, lD.z)), -0.6, 0.85);
        lq2.setFromEuler(le.set(pitch * 0.35, yaw * 0.38, 0, 'YXZ')); B.neck.quaternion.slerp(lq2, L.w);
        lq2.setFromEuler(le.set(pitch * 0.65, yaw * 0.62, 0, 'YXZ')); B.head.quaternion.slerp(lq2, L.w);
      }
      const extra = H.pitch + H.chew * 0.045 * Math.sin(t * 17) + H.nod;
      if (Math.abs(extra) > 1e-4) B.head.quaternion.multiply(lq.setFromAxisAngle(X, extra));
      B.neck.updateMatrixWorld(true);
    }

    /* --- кисть «до слоя»; у предмета в руке — кисть держит его прямо (стакан не наклоняется на ходу) --- */
    const uT = V(), uq = Q(), uq2 = Q();
    function animSample(sd) {
      const c = ch.hand[sd], hb = B['hand_' + sd];
      wpos(hb, c.animW); wquat(hb, c.animQ);
      const it = itOf(held[sd]);
      if (it && it.def.parts && it.def.upright !== false) {
        // большой палец (ось предмета y) — вверх: кратчайший поворот, не больше ~65°
        uT.set(0, 0, 1).applyQuaternion(c.animQ);
        uq.setFromUnitVectors(uT, UP);
        const ang = 2 * Math.acos(clamp(Math.abs(uq.w), 0, 1));
        if (ang > 1.15) uq.slerp(uq2.identity(), 1 - 1.15 / ang);
        c.animQ.premultiply(uq);
        c.upright = true;
      } else c.upright = false;
    }
    function handIdle(sd) {
      const c = ch.hand[sd]; if (!c.upright) return;
      const fa = B['forearm_' + sd], hb = B['hand_' + sd];
      wquat(fa, uq); uq.invert().multiply(c.animQ);
      hb.quaternion.copy(uq); hb.updateMatrixWorld(true);
    }

    /* --- руки: IK к цели (запястье + поворот кисти), выталкивание из туловища, смешивание с HeroAnim --- */
    const tgt = V(), poleM = V(), poleL = V(), push = V(), hc = V(), elb = V(), tl = V(), aq = Q(), aq2 = Q(), aqU = Q(), aqF = Q(), mir = V(), twAx = V(), twQ = Q(), twK = Q();
    function armPass(sd) {
      const c = ch.hand[sd];
      if (c.w < 0.001) { handIdle(sd); return false; }
      const ua = B['upperarm_' + sd], fa = B['forearm_' + sd], hb = B['hand_' + sd], par = ua.parent;
      tgt.copy(c.wristW);
      torsoCapsule();
      hc.set(0, -0.055, 0.01).multiplyScalar(S).applyQuaternion(c.Q).add(tgt);
      pushOut(hc, 0.165 * S, push); tgt.add(push);
      pushOut(tgt, 0.15 * S, push); tgt.add(push);
      const sg = sd === 'L' ? 1 : -1;
      if (c.pole) poleM.copy(c.pole).multiply(mir.set(sg, 1, 1)); else poleM.set(sg * 0.6, -0.75, -0.25);
      par.updateMatrixWorld(false);
      wquat(par, aq); aq.invert();
      par.worldToLocal(tl.copy(tgt));
      for (let pass = 0; pass < 2; pass++) {
        poleL.copy(poleM).applyQuaternion(meshQ).applyQuaternion(aq);
        const r = solve2(ua, fa, hb, tl, poleL, -1);
        if (pass === 0 && r.reach > 1 && c.w > 0.5) ch.assist.want = Math.max(ch.assist.want, ch.assist.bend + Math.min(0.12, (r.reach - 1) * 1.6));
        ua.quaternion.copy(r.q); fa.quaternion.setFromAxisAngle(X, r.th);
        ua.updateMatrixWorld(true);
        wpos(fa, elb); pushOut(elb, 0.13 * S, push);
        if (pass === 0 && push.lengthSq() > 1e-7) { poleM.x += sg * 1.4; poleM.z -= 0.5; continue; }
        break;
      }
      aqU.copy(ua.quaternion); aqF.copy(fa.quaternion);
      ua.quaternion.copy(pre['upperarm_' + sd]).slerp(aqU, c.w);
      fa.quaternion.copy(pre['forearm_' + sd]).slerp(aqF, c.w);
      ua.updateMatrixWorld(true);
      // кисть: нужный поворот в мире → локальный. Поворот вокруг оси предплечья (пронация) делят предплечье и кисть,
      // остальное — сгиб запястья, не больше ~80°
      wquat(fa, aq); aq2.copy(aq).invert().multiply(c.Q);
      twAx.copy(hb.position).normalize();
      const pr = aq2.x * twAx.x + aq2.y * twAx.y + aq2.z * twAx.z;
      twQ.set(twAx.x * pr, twAx.y * pr, twAx.z * pr, aq2.w); if (twQ.lengthSq() < 1e-10) twQ.identity(); else twQ.normalize();
      if (twQ.w < 0) { twQ.x = -twQ.x; twQ.y = -twQ.y; twQ.z = -twQ.z; twQ.w = -twQ.w; }
      twK.identity().slerp(twQ, 0.6 * c.w);
      fa.quaternion.multiply(twK); ua.updateMatrixWorld(true);
      wquat(fa, aq); aq2.copy(aq).invert().multiply(c.Q);
      const ang = 2 * Math.acos(clamp(Math.abs(aq2.w), 0, 1));
      if (ang > 1.4) aq2.slerp(aq.identity(), 1 - 1.4 / ang);
      if (c.upright && c.w < 1) { wquat(fa, aq); aq.invert().multiply(c.animQ); hb.quaternion.copy(aq); }
      hb.quaternion.slerp(aq2, c.w);
      hb.updateMatrixWorld(true);
      return true;
    }

    /* --- предметы в руках --- */
    const atP = V(), atQ = Q(), gQv = V(); let lastGap = 0;
    function attach(item, sd, smooth) {
      const it = wrapItem(item).userData.it;
      const hb = B['hand_' + sd];
      if (held[sd] && held[sd] !== item) release(sd, null);
      held[sd] = item; it.side = sd;
      placement(it, sd, atP, atQ);
      if (smooth !== false && item.parent) {
        hb.attach(item);
        settle.push({ item, p0: item.position.clone(), q0: item.quaternion.clone(), s0: item.scale.clone(), p1: atP.clone(), q1: atQ.clone(), t: 0, d: 0.16 });
        gm.compose(atP, atQ, ONE).invert(); gP.copy(gripV[sd]).applyMatrix4(gm); item.localToWorld(gP);
        hb.localToWorld(gQv.copy(gripV[sd])); lastGap = gP.distanceTo(gQv);
      } else { hb.add(item); item.position.copy(atP); item.quaternion.copy(atQ); item.scale.setScalar(1); }
      return item;
    }
    function release(sd, toParent, worldP) {
      const item = held[sd]; if (!item) return null;
      held[sd] = null;
      for (let i = settle.length - 1; i >= 0; i--) if (settle[i].item === item) settle.splice(i, 1);
      if (toParent) { toParent.attach(item); if (worldP) { toParent.worldToLocal(atP.copy(worldP)); item.position.copy(atP); } }
      else if (item.parent) item.parent.remove(item);
      if (item.userData.it) item.userData.it.side = null;
      return item;
    }
    // точность касания (для тестов и отладки): где точка кисти/предмета и куда она должна была прийти — событие 'contact'
    const ctP = V(), ctT = V();
    function contact(what, sd, target, key) {
      const it = key && held[sd] ? held[sd] : null;
      if (it) { ctP.fromArray(key); if (sd === 'R') ctP.x = -ctP.x; it.updateWorldMatrix(true, false); it.localToWorld(ctP); }
      else B['hand_' + sd].localToWorld(ctP.copy(gripV[sd]));
      anchor(target, sd, ctT);
      emit('contact', { what, side: sd, d: +ctP.distanceTo(ctT).toFixed(4) });
    }
    function updateSettle(dt) {
      for (let i = settle.length - 1; i >= 0; i--) {
        const s = settle[i]; s.t += dt; const u = EASE.out(clamp(s.t / s.d, 0, 1));
        s.item.position.lerpVectors(s.p0, s.p1, u); s.item.quaternion.slerpQuaternions(s.q0, s.q1, u); s.item.scale.lerpVectors(s.s0, ONE, u);
        if (u >= 1) settle.splice(i, 1);
      }
    }

    /* --- лапка жителя: выносит предмет навстречу (у зверят-жителей нет костей рук) --- */
    // лапка + рукав-«ручка» от плеча жителя (тянется, 1 вызов на лапку и 1 на ручку, только пока идёт передача)
    function makePaw(color, size) {
      const L0 = lib(T), k = size || 1, P = partMaker(T, L0.G);
      const g = merge(T, [P.sph(color || '#D9A87A', [0, 0, 0], [0.045 * k, 0.036 * k, 0.05 * k])], 0.003);
      const m = new T.Mesh(g, L0.material(o.gradientMap)); m.castShadow = true; m.name = 'interact:paw';
      const ag = merge(T, [Object.assign(P.cyl(color || '#D9A87A', 0.032 * k, 0.036 * k, 1, [0, 0.5, 0], null, { seg: 10 }), { olT: 0.003 })], 0.003);
      const arm = new T.Mesh(ag, L0.material(o.gradientMap)); arm.castShadow = true; arm.name = 'interact:pawArm'; arm.visible = false;
      m.userData.arm = arm; m.userData.k = k;
      return m;
    }
    const paA = V(), paB = V(), paD = V();
    function pawArm(paw, home) {
      const arm = paw.userData.arm; if (!arm) return;
      if (!arm.parent && paw.parent) paw.parent.add(arm);
      paw.updateWorldMatrix(true, false); wpos(paw, paB); paA.copy(home);
      paD.subVectors(paB, paA); const L = paD.length();
      arm.visible = paw.visible && L > 0.04 * S;
      if (!arm.visible) return;
      arm.parent.worldToLocal(arm.position.copy(paA));
      arm.quaternion.setFromUnitVectors(UP, paD.multiplyScalar(1 / L));
      arm.scale.set(S, Math.max(0.01, L - 0.03 * S), S);
    }

    /* --- эффекты: крошки, капли, круги на воде (1 вызов отрисовки на вспышку, живут < 1 с) --- */
    let dotTex = null;
    function dot() {
      if (dotTex) return dotTex;
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
      x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(16, 16, 13, 0, TAU); x.fill();
      dotTex = new T.CanvasTexture(c); return dotTex;
    }
    const fF = V();
    function burst(atIn, color, n, opt) {
      opt = opt || {};
      const at = atIn.clone(), N = n || 12, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
      const c = new T.Color(color || '#E8B26A'), c2 = c.clone().offsetHSL(0, 0, -0.14);
      heroFwd(fF);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
        const cc = i % 3 ? c : c2; col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
        const a = Math.random() * TAU, sp = (opt.speed || 0.35) * (0.5 + Math.random() * 0.7);
        vel.push(new T.Vector3(Math.cos(a) * sp * 0.7 + fF.x * sp * 0.6, (opt.up || 0.25) + Math.random() * 0.25, Math.sin(a) * sp * 0.7 + fF.z * sp * 0.6).multiplyScalar(S));
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.PointsMaterial({ size: (opt.size || 0.016) * S, sizeAttenuation: true, vertexColors: true, map: dot(), transparent: true, depthWrite: false, alphaTest: 0.3 });
      const p = new T.Points(g, m); p.frustumCulled = false; p.name = 'interact:fx';
      fxParent().add(p);
      fx.push({ kind: 'pts', obj: p, vel, t: 0, d: opt.life || 0.75, grav: (opt.grav || 2.6) * S });
    }
    function ripple(at, n) {
      for (let k = 0; k < (n || 2); k++) {
        const g = new T.RingGeometry(0.8, 1, 28); g.rotateX(-PI / 2);
        const m = new T.MeshBasicMaterial({ color: 0xF4FBFF, transparent: true, opacity: 0, depthWrite: false });
        const r = new T.Mesh(g, m); r.position.copy(at); r.position.y += 0.004 * S; r.scale.setScalar(0.02 * S); r.name = 'interact:fx'; r.visible = false;
        fxParent().add(r);
        fx.push({ kind: 'ring', obj: r, t: -k * 0.24, d: 0.95 });
      }
    }
    function updateFx(dt) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        if (f.kind === 'pts') {
          const P = f.obj.geometry.attributes.position.array;
          f.vel.forEach((v, k) => { v.y -= f.grav * dt; P[k * 3] += v.x * dt; P[k * 3 + 1] += v.y * dt; P[k * 3 + 2] += v.z * dt; });
          f.obj.geometry.attributes.position.needsUpdate = true;
          f.obj.material.opacity = 1 - sst(0.55, 1, f.t / f.d);
        } else if (f.kind === 'ring') {
          const u = clamp(f.t / f.d, 0, 1);
          f.obj.visible = f.t > 0;
          f.obj.scale.setScalar((0.025 + 0.2 * EASE.out(u)) * S);
          f.obj.material.opacity = f.t > 0 ? 0.85 * (1 - u) : 0;
        }
        if (f.t >= f.d) { if (f.obj.parent) f.obj.parent.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); fx.splice(i, 1); }
      }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i]; f.t += dt; const u = clamp(f.t / f.d, 0, 1);
        f.item.position.lerpVectors(f.a, f.b, u); f.item.position.y += Math.sin(PI * u) * f.h;
        f.item.rotation.x += dt * 14;
        if (u >= 1) { flights.splice(i, 1); if (f.done) f.done(); }
      }
    }

    /* =====================================================================
       ШАГИ: шаг — цели каналов на dur секунд с плавностью ease (функция вместо шага — вычисляется в момент начала,
       может вернуть шаг, массив шагов или null).
       { dur, ease, body:{crouch,bend,back,twist}, look: якорь|null, lookW, L/R: 'anim' | { at, rot, key, item, w, pole },
         head:{pitch,chew,nod}, anim:{…HeroAnim}, walk:{ to, speed }, turn:{ face | yaw }, root:{ to, yaw },
         paw:{ obj, from, to, hide, after }, tick(ctx,u), on(ctx), end(ctx), ev, evEnd, evData }
       ===================================================================== */
    const run = { q: [], act: null, steps: null, i: 0, st: null, t: 0, ctx: null };
    const sq = Q();
    function snapHand(sd) {
      const c = ch.hand[sd];
      if (c.w < 0.01 && !c.active) return null;      // рука свободна: начало — живая поза HeroAnim
      return { model: model.worldToLocal(c.lastW.clone()), q: c.lastQ.clone().premultiply(sq.copy(meshQ).invert()) };
    }
    const sv0 = V(), sv1 = V();
    function startStep(st) {
      run.st = st; run.t = 0;
      st._dur = st.dur !== undefined ? st.dur : 0.4; st._ease = ease(st.ease);
      if (st.body) st._b0 = Object.assign({}, ch.body);
      if (st.head) st._h0 = Object.assign({}, ch.head);
      if (st.look !== undefined) {
        const L = ch.look;
        if (L.w < 0.01) boneLocal('head', 0, 0.1, 1.2, L.src); else L.src.copy(L.pt);
        L.dst = st.look; L.w0 = L.w; L.w1 = st.look === null ? 0 : (st.lookW !== undefined ? st.lookW : 1); L.e = 0;
      }
      ['L', 'R'].forEach(sd => {
        if (st[sd] === undefined) return;
        const c = ch.hand[sd], sp = st[sd];
        c.src = snapHand(sd);
        c.dst = (sp === 'anim' || sp === null) ? null : sp;
        c.w0 = c.w; c.w1 = c.dst ? (sp.w !== undefined ? sp.w : 1) : 0;
        c.pole = c.dst && sp.pole ? toV(sp.pole, V()) : null;
        c.active = !!c.dst; c.auto = false; c.e = 0; c.u = 0;
      });
      if (st.anim) Object.assign(ovr, st.anim);
      if (st.root || st.walk || st.turn) { rootRead(); st._r0 = { p: rootM.pos.clone(), yaw: rootM.yaw }; }
      if (st.root) st._r1 = { p: st.root.to ? worldToParent(anchor(st.root.to, null, sv0), V()) : rootM.pos.clone(), yaw: st.root.yaw !== undefined ? st.root.yaw : rootM.yaw };
      if (st.turn) {
        let yaw = st.turn.yaw;
        if (yaw === undefined) { anchor(st.turn.face, null, sv0); heroPos(sv1); yaw = Math.atan2(sv0.x - sv1.x, sv0.z - sv1.z); }
        st._yaw1 = rootM.yaw + angW(yaw - rootM.yaw);
        if (st.dur === undefined) st._dur = clamp(Math.abs(st._yaw1 - rootM.yaw) / 3.6, 0.12, 0.9);
      }
      if (st.walk) {
        st._to = worldToParent(anchor(st.walk.to, null, sv0), V());
        st._dist0 = Math.hypot(st._to.x - rootM.pos.x, st._to.z - rootM.pos.z); st._y0 = rootM.pos.y;
        st._dur = 1e9;
      }
      if (st.paw) { const P = st.paw; P._a = (P.from ? anchor(P.from, null, V()) : wpos(P.obj, V())); }
      if (st.on) st.on(run.ctx, api);
      if (st.ev) emit(st.ev, st.evData);
    }
    function finishStep(st) {
      if (st.walk || st.turn || st.root) { ovr.speed = 0; ovr.turnRate = 0; }
      if (st.tick) st.tick(run.ctx, 1, st);
      if (st.paw) pawTick(st.paw, 1);
      if (st.end) st.end(run.ctx, api);
      if (st.evEnd) emit(st.evEnd, st.evData);
    }
    function stepUpdate(dt) {
      const st = run.st, u = st._dur > 0 ? clamp(run.t / st._dur, 0, 1) : 1, e = st._ease(u);
      if (st.body) for (const k in st.body) ch.body[k] = lerp(st._b0[k] || 0, st.body[k], e);
      if (st.head) for (const k in st.head) ch.head[k] = lerp(st._h0[k] || 0, st.head[k], e);
      if (st.look !== undefined) { const L = ch.look; L.e = e; L.w = lerp(L.w0, L.w1, L.w1 > L.w0 ? sst(0, 0.5, u) : e); }
      ['L', 'R'].forEach(sd => {
        if (st[sd] === undefined) return;
        const c = ch.hand[sd];
        c.u = u; c.e = e;
        c.w = lerp(c.w0, c.w1, c.w1 > c.w0 ? sst(0, 0.3, u) : (c.dst ? e : sst(0.55, 1, u)));
        if (u >= 1 && !c.dst) c.active = false;
      });
      if (st.tick && !st.walk) st.tick(run.ctx, u, st);
      if (st.paw && !st.walk) pawTick(st.paw, u);
      if (st.root) {
        rootM.pos.lerpVectors(st._r0.p, st._r1.p, e);
        rootM.yaw = st._r0.yaw + angW(st._r1.yaw - st._r0.yaw) * e;
        rootWrite();
      }
      if (st.turn) {
        const y0 = rootM.yaw;
        rootM.yaw = st._r0.yaw + (st._yaw1 - st._r0.yaw) * e; rootWrite();
        ovr.turnRate = dt > 0 ? (rootM.yaw - y0) / dt : 0;
      }
      if (st.walk) {
        const Wk = st.walk, sp = (Wk.speed || 1.15) * S;
        const dx = st._to.x - rootM.pos.x, dz = st._to.z - rootM.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 0.02 * S || run.t > 12) { rootM.pos.copy(st._to); rootWrite(); return true; }
        if (dt <= 0) return false;
        const want = Math.atan2(dx, dz), err = angW(want - rootM.yaw);
        const y0 = rootM.yaw; rootM.yaw += clamp(err, -5 * dt, 5 * dt);
        let v = Math.min(sp, dist * 3.2 + 0.25 * S) * (Math.abs(err) > 1.0 ? 0.35 : 1);
        v = Math.min(v, dist / dt);
        rootM.pos.x += Math.sin(rootM.yaw) * v * dt; rootM.pos.z += Math.cos(rootM.yaw) * v * dt;
        const k = st._dist0 > 1e-4 ? 1 - clamp(Math.hypot(st._to.x - rootM.pos.x, st._to.z - rootM.pos.z) / st._dist0, 0, 1) : 1;
        rootM.pos.y = lerp(st._y0, st._to.y, sst(0.15, 0.9, k));
        rootWrite();
        ovr.speed = v / S; ovr.turnRate = (rootM.yaw - y0) / dt;
        return false;
      }
      return u >= 1;
    }
    function beginNext() {
      let st = run.steps[run.i];
      if (st === undefined) { finishAction(); return false; }
      if (typeof st === 'function') {
        const r = st(run.ctx, api);
        if (Array.isArray(r)) { run.steps.splice(run.i, 1, ...r.filter(Boolean)); return false; }
        if (!r) { run.i++; return false; }
        run.steps[run.i] = st = r;
      }
      if (!st) { run.i++; return false; }
      startStep(st); return true;
    }
    function advance(dt) {
      let left = dt;
      for (let guard = 0; guard < 80; guard++) {
        if (!run.act) {
          const a = run.q.shift(); if (!a) return;
          run.act = a; run.ctx = a.ctx; run.steps = a.steps.slice(); run.i = 0; run.st = null;
        }
        if (!run.st && !beginNext()) continue;
        run.t += left;
        if (!stepUpdate(left)) return;
        const st = run.st, over = st.walk ? 0 : Math.max(0, run.t - st._dur);
        finishStep(st); run.st = null; run.i++;
        left = Math.min(over, left);
      }
    }
    function finishAction() {
      const a = run.act; run.act = null; run.st = null;
      for (const k in ovr) delete ovr[k];
      if (seatedOn) { ovr.sitting = true; ovr.sitPose = 'chair'; }
      emit('done', { action: a.name });
      a.resolve({ ok: !a.cancelled, action: a.name, holding: { L: held.L, R: held.R } });
      maybeUnpocket();
    }
    // лупу убрали сами (для двух рук) — руки опустели: достать обратно
    function maybeUnpocket() {
      if (o.autoUnpocket === false || !autoPocket || !pocketed || held.L || held.R || run.q.length || run.act) return;
      autoPocket = false; play('unpocket');
    }
    function pawTick(P, u) {
      const paw = P.obj; if (!paw || !paw.parent) return;
      const to = anchor(P.to, null, sv1);
      paw.parent.worldToLocal(sv0.copy(P._a).lerp(to, EASE.inOut(u)));
      paw.position.copy(sv0); paw.visible = true;
      if (P.home || paw.userData.home) pawArm(paw, P.home || paw.userData.home);
      if (u >= 1 && !P._done) {
        P._done = true;
        if (P.after) P.after();
        if (P.hide) {
          paw.visible = false; if (paw.parent) paw.parent.remove(paw); const i = paws.indexOf(paw); if (i >= 0) paws.splice(i, 1);
          const arm = paw.userData.arm; if (arm && arm.parent) arm.parent.remove(arm);
          if (i >= 0) freePaw(paw);   // своя лапка (makePaw) больше не нужна — геометрию освободить (материал общий)
        }
      }
    }

    /* =====================================================================
       БИБЛИОТЕКА ДЕЙСТВИЙ
       ===================================================================== */
    const W = (at, rot, extra) => Object.assign({ at, rot: rot || 'hold' }, extra || {});
    const freeSide = pref => (pref ? (!held[pref] && (pref === 'L' || pocketed || !mag) ? pref : null) : !held.L ? 'L' : (!held.R && pocketed ? 'R' : null));
    const holdSide = (pref, pred) => (pref && held[pref] ? pref : (held.L && (!pred || pred(itOf(held.L))) ? 'L' : held.R && (!pred || pred(itOf(held.R))) ? 'R' : null));
    const restOf = sd => (sd === 'L' || !held[sd] ? 'anim' : W('carry', 'hold'));
    const shrug = () => [{ dur: 0.35, head: { nod: 0.07 }, ev: 'busy' }, { dur: 0.25, head: { nod: 0 } }];
    const ap0 = V(), ap1 = V();
    // подойти и повернуться: dist — на каком расстоянии встать от точки; opt.spot/opt.yaw — точно
    function approach(target, dist, opt) {
      opt = opt || {};
      return () => {
        anchor(target, null, ap0); heroPos(ap1);
        let spot;
        if (opt.spot) spot = anchor(opt.spot, null, V());
        else {
          const dx = ap1.x - ap0.x, dz = ap1.z - ap0.z, l = Math.hypot(dx, dz);
          if (l <= (dist + 0.2) * S && !opt.always) return opt.noTurn ? null : [{ turn: { face: target } }];
          spot = V().set(ap0.x + dx / Math.max(l, 1e-4) * dist * S, ap1.y, ap0.z + dz / Math.max(l, 1e-4) * dist * S);
          if (opt.lateral) {
            // встать так, чтобы цель была перед нужным плечом (+ — перед левым): сдвиг вбок, смотреть — прямо
            const fx = -dx / Math.max(l, 1e-4), fz = -dz / Math.max(l, 1e-4), lat = opt.lateral * S;
            spot.x -= fz * lat; spot.z += fx * lat; opt = Object.assign({}, opt, { yaw: Math.atan2(fx, fz) });
          }
        }
        const steps = [];
        if (Math.hypot(spot.x - ap1.x, spot.z - ap1.z) > 0.04 * S || Math.abs(spot.y - ap1.y) > 0.03 * S) {
          // надо прийти лицом в нужную сторону: заходим сзади по дуге (ноги шагают, а не крутятся на месте)
          if (opt.yaw !== undefined) {
            const head = Math.atan2(spot.x - ap1.x, spot.z - ap1.z);
            if (Math.abs(angW(opt.yaw - head)) > 0.9) {
              const pre = V().set(spot.x - Math.sin(opt.yaw) * 0.32 * S, spot.y, spot.z - Math.cos(opt.yaw) * 0.32 * S);
              steps.push({ walk: { to: pre, speed: opt.speed } });
            }
          }
          steps.push({ walk: { to: spot, speed: opt.speed } });
        }
        if (opt.yaw !== undefined) steps.push({ turn: { yaw: opt.yaw } });
        else if (!opt.noTurn) steps.push({ turn: { face: target } });
        return steps;
      };
    }
    // насколько присесть/наклониться, чтобы достать до высоты y (мир)
    function reachPose(y) {
      heroPos(ap1); const h = (y - ap1.y) / S;
      if (h > 0.9) return { crouch: 0, bend: h > 1.25 ? 0 : 0.05 };
      if (h > 0.62) return { crouch: 0, bend: Math.min(0.45, 0.12 + (0.9 - h) * 1.15) };
      if (h > 0.35) return { crouch: Math.min(0.95, 0.62 + (0.62 - h) * 2), bend: 0.45 + (0.62 - h) * 0.6 };
      return { crouch: Math.min(1.7, 0.95 + (0.35 - h) * 2.6), bend: Math.min(0.9, 0.5 + (0.35 - h) * 1.3) };
    }
    // где встречаются лапка жителя и рука героини; откуда лапка выходит (грудь жителя)
    function meetPoint(from, out) {
      const r = objOf(from.root || from);
      r.updateWorldMatrix(true, false); wpos(r, ap0); heroPos(ap1);
      const dx = ap0.x - ap1.x, dz = ap0.z - ap1.z, l = Math.max(1e-4, Math.hypot(dx, dz));
      const k = Math.min(0.4 * S, l * 0.5);
      return out.set(ap1.x + dx / l * k, ap1.y + (from.meetY !== undefined ? from.meetY : 0.98) * S, ap1.z + dz / l * k);
    }
    function npcChest(from, out) {
      if (from.at) return anchor(from.at, null, out);
      const r = objOf(from.root || from);
      r.updateWorldMatrix(true, false); wpos(r, out); heroPos(ap1);
      const dx = ap1.x - out.x, dz = ap1.z - out.z, l = Math.max(1e-4, Math.hypot(dx, dz));
      out.x += dx / l * (from.chestFwd !== undefined ? from.chestFwd : 0.18) * S; out.z += dz / l * (from.chestFwd !== undefined ? from.chestFwd : 0.18) * S;
      out.y += (from.height || 0.62) * S;
      return out;
    }
    function itemMake(x) { if (!x) return null; if (x.isObject3D) return wrapItem(x); return makeItem(String(x), { THREE: T, gradientMap: o.gradientMap }); }
    // точка хвата у предмета (где окажется центр кулака)
    const gm = new T.Matrix4(), gP = V(), gQ = Q();
    function gripAnchor(item, sd) {
      return out => {
        placement(itOf(item), sd, gP, gQ);
        gm.compose(gP, gQ, ONE).invert();
        out.copy(gripV[sd]).applyMatrix4(gm);
        item.updateWorldMatrix(true, false);
        return item.localToWorld(out);
      };
    }
    const upright = { itemY: [0, 1, 0], itemZ: [0, 0, 1] };
    // дотянуться до предмета: кисть сразу в том положении, в каком будет держать (предмет — стоймя, пальцы к нему),
    // целится центр предмета → при захвате предмет не прыгает, только чуть доворачивается вокруг себя
    const rrv = V(), rrSpec = { itemY: [0, 1, 0], itemZ: [0, 0, 1], mirror: false, item: null };
    function reachTo(item, sd, extra) {
      // предмет в руке лежит иначе, чем сейчас (хлеб, пирог, браслет — их берут за край и поднимают): тянемся к краю
      const h = itOf(item) && itOf(item).def.hold;
      if (h && h.rot) return Object.assign({ at: gripAnchor(item, sd), rot: 'reach' }, extra || {});
      // волна 5: свой угол кисти при захвате (def.reachRot — оси предмета в осях модели; лейка — за верхнюю ручку, сверху)
      const rr = itOf(item) && itOf(item).def.reachRot;
      if (rr) return Object.assign({ at: item, key: [0, 0, 0], item, rot: Object.assign({ item }, rr) }, extra || {});
      return Object.assign({
        at: item, key: [0, 0, 0], item,
        rot: (out) => {
          item.updateWorldMatrix(true, false); model.worldToLocal(rrv.setFromMatrixPosition(item.matrixWorld));
          rrv.y = 0; rrv.x -= (sd === 'R' ? -0.12 : 0.12); if (rrv.lengthSq() < 1e-6) rrv.set(0, 0, 1); rrv.normalize();
          rrSpec.itemZ[0] = rrv.x * 0.55; rrSpec.itemZ[2] = rrv.z * 0.55 + 0.45; rrSpec.item = item;
          return rotSpec(rrSpec, sd, out);
        },
      }, extra || {});
    }
    // волна 5: «прыжок» предмета в кулак (было до 5–6 см у какао из лап). Кисть тянется к центру предмета повёрнутой «как будет
    // держать», а предмет на лапке/прилавке стоит под своим углом — при захвате он доворачивался вокруг своего центра, и точка хвата
    // (у стаканчика — 4,5 см от центра) уезжала. Теперь за время «дотянуться» предмет плавно доворачивается к тому углу, под каким
    // окажется в кулаке (у круглых — незаметно): при захвате остаётся только погрешность IK. Предметы с def.hold.rot (берут за край)
    // — по-прежнему (там кисть идёт к точке хвата, и угол — их собственный).
    const alQ = Q(), alH = Q(), alP = Q(), alV = V(), alS = V(), alT = V();
    function alignTick(item, sd) {
      // def.reachRot (лейка): кисть сама поворачивается под предмет, как он стоит — доворачивать нечего (а по ходу руки,
      // пока кисть ещё «как в покое», доворот наклонял бы большой предмет в воздухе)
      const it0 = itOf(item); if (it0 && ((it0.def.hold && it0.def.hold.rot) || it0.def.reachRot)) return undefined;
      return (ctx, u, st) => {
        if (!item.parent || held[sd] === item) return;
        if (!st._alQ0) st._alQ0 = item.quaternion.clone();
        placement(itOf(item), sd, alV, alQ);
        const hb = B['hand_' + sd]; hb.updateWorldMatrix(true, false); hb.matrixWorld.decompose(alS, alH, alT);
        alH.multiply(alQ);                                                   // угол предмета в мире, если взять сейчас
        item.parent.updateWorldMatrix(true, false); item.parent.matrixWorld.decompose(alS, alP, alT);
        alP.invert().multiply(alH);                                          // в осях родителя (лапка, прилавок, сцена)
        item.quaternion.slerpQuaternions(st._alQ0, alP, EASE.inOut(clamp(u / 0.85, 0, 1)));
      };
    }
    // своя лапка (makePaw): 2 геометрии; материал — общий lib(T).material, его не трогать
    function freePaw(p) { try { p.geometry.dispose(); if (p.userData.arm) p.userData.arm.geometry.dispose(); } catch (e) { /* ok */ } }
    function pawFor(spec) { const p = spec.paw || makePaw(spec.color, spec.pawSize); return p; }
    function pawOut(paw, own, home) {
      if (own) { fxParent().add(paw); paws.push(paw); paw.userData.home = home.clone(); }
      paw.visible = true; fxParent().worldToLocal(sv0.copy(home)); if (own) paw.position.copy(sv0);
    }

    const ACTIONS = {
      /* взять с прилавка/полки/стола: opts.item — предмет (в сцене) или имя; side; approach:false; dist;
         pose { crouch, bend } — своя поза наклона (низкая тележка и т. п.; по умолчанию — по высоте предмета);
         always — подойти ровно на dist, даже если стоит ближе 20 см сверх него (предмет на полу: иначе рука не достаёт);
         stand { pos, yaw } — точное место и поворот (у предмета с def.reachRot — так, чтобы он стоял, как ляжет в руку: без доворота) */
      take(ctx, op) {
        const sd = freeSide(op.side); if (!sd) return shrug();
        const item = itemMake(op.item); if (!item) return [];
        if (!item.parent) fxParent().add(item);
        return [
          op.approach === false ? null : approach(item, op.dist || 0.38, op.stand ? { spot: op.stand.pos, yaw: op.stand.yaw, always: true } : { lateral: sd === 'L' ? 0.08 : -0.08, always: !!op.always }),
          () => { item.updateWorldMatrix(true, false); wpos(item, sv0); ctx.pose = op.pose ? Object.assign({ crouch: 0, bend: 0 }, op.pose) : reachPose(sv0.y); return null; },
          () => ({ dur: 0.28, look: item, body: ctx.pose }),
          { dur: 0.5, ev: 'reach', [sd]: reachTo(item, sd), tick: alignTick(item, sd), evEnd: 'take', end: () => { attach(item, sd); ctx.item = item; } },
          { dur: 0.5, body: { crouch: 0, bend: 0, back: 0 }, [sd]: restOf(sd), look: null },
        ];
      },
      /* принять из лап жителя: opts.item (имя/предмет), opts.from = { root, color, height, chestFwd, at, meetY, paw } */
      takeFrom(ctx, op) {
        const from = op.from || {}, npc = objOf(from.root || from);
        const sd = freeSide(op.side); if (!sd) return shrug();
        const item = itemMake(op.item); if (!item || !npc) return [];
        const paw = pawFor(from), meet = V(), home = V();
        return [
          op.approach === false ? null : approach(npc, op.dist || 0.88),
          () => { npcChest(from, home); meetPoint(from, meet); pawOut(paw, !from.paw, home); paw.add(item); item.position.set(0, 0.035, 0); item.quaternion.identity(); item.scale.setScalar(1); return null; },
          { dur: 0.5, look: item, paw: { obj: paw, from: home, to: meet }, [sd]: W({ at: meet, offM: [sd === 'L' ? 0.07 : -0.07, -0.13, -0.13] }, 'reach', { w: 0.65 }) },
          { dur: 0.42, ev: 'reach', [sd]: reachTo(item, sd), tick: alignTick(item, sd), evEnd: 'take', end: () => { attach(item, sd); ctx.item = item; } },
          { dur: 0.45, paw: { obj: paw, from: meet, to: home, hide: !from.paw }, [sd]: restOf(sd), look: null },
        ];
      },
      /* отдать жителю (opts.to = { root, color, keep, paw }) или положить (opts.place — точка/объект; opts.parent) */
      give(ctx, op) {
        const sd = holdSide(op.side); if (!sd) return [];
        const item = held[sd], it = itOf(item);
        if (op.place) {
          const P = V();
          return [
            op.approach === false ? null : approach(op.place, op.dist || 0.5),
            () => { anchor(op.place, null, P); ctx.pose = reachPose(P.y); return null; },
            () => ({ dur: 0.3, look: P, body: ctx.pose }),
            { dur: 0.5, [sd]: { at: P, key: [0, (it.def.bottom || 0), 0], rot: upright, offM: [0, 0.004, 0] }, evEnd: 'give',
              end: () => { const par = objOf(op.parent) || fxParent(); release(sd, par); placeOnSurface(item, P, par, it); } },
            { dur: 0.45, body: { crouch: 0, bend: 0, back: 0 }, [sd]: 'anim', look: null },
          ];
        }
        const to = op.to || {}, npc = objOf(to.root || to); if (!npc) return [];
        const paw = pawFor(to), meet = V(), home = V(), pawAt = { at: meet, offM: [0, -0.05, 0] };
        return [
          op.approach === false ? null : approach(npc, op.dist || 0.85),
          () => { npcChest(to, home); meetPoint(to, meet); pawOut(paw, !to.paw, home); return null; },
          { dur: 0.5, look: meet, [sd]: { at: meet, key: [0, 0, 0], rot: upright }, paw: { obj: paw, from: home, to: pawAt } },
          { dur: 0.12, evEnd: 'give', end: () => { release(sd, paw); item.position.set(0, 0.035, 0); item.quaternion.identity(); item.scale.setScalar(1); } },
          { dur: 0.45, [sd]: 'anim', look: null, paw: { obj: paw, from: pawAt, to: home, hide: !to.paw, after: () => { if (!to.keep && it) it.dispose(); } } },
        ];
      },
      putDown(ctx, op) { return ACTIONS.give(ctx, Object.assign({}, op, { place: op.place || op.at })); },
      /* волна 5: полить из лейки (оранжерея): opts.at — куда льётся (точка/объект), key — носик в осях предмета (по умолчанию
         def.pour.key), tilt — наклон носиком вниз (рад), hold — сколько лить (с), onPour() — когда пошла вода. Предмет в руке
         держат за верхнюю ручку: +y предмета — носик вперёд, +z — вниз (так он висит в опущенной руке) */
      pour(ctx, op) {
        const sd = holdSide(op.side); if (!sd) return [];
        const it = itOf(held[sd]), key = op.key || (it && it.def.pour && it.def.pour.key) || [0, 0.12, 0.06], P = V(), a1 = op.tilt != null ? op.tilt : 0.62;
        const rotA = a => ({ itemY: [0, -Math.sin(a), Math.cos(a)], itemZ: [0, -Math.cos(a), -Math.sin(a)] });
        return [
          op.approach === false ? null : approach(op.at, op.dist || 0.6, { lateral: sd === 'L' ? 0.12 : -0.12 }),
          () => { anchor(op.at, null, P); return { dur: 0.5, look: P, [sd]: { at: P, key, rot: rotA(0.1), offM: [0, 0.07, -0.03] } }; },
          { dur: 0.35, ev: 'pour', [sd]: { at: P, key, rot: rotA(a1) }, end: () => { if (op.onPour) { try { op.onPour(); } catch (e) { /* игра */ } } } },
          { dur: op.hold || 0.9, [sd]: { at: P, key, rot: rotA(a1 + 0.08), offM: [0, -0.01, 0] } },
          { dur: 0.45, [sd]: restOf(sd), look: null },
        ];
      },
      /* поднять с земли: opts.item */
      pickUp(ctx, op) {
        const sd = freeSide(op.side); if (!sd) return shrug();
        const item = itemMake(op.item); if (!item) return [];
        if (!item.parent) fxParent().add(item);
        return [
          op.approach === false ? null : approach(item, op.dist || 0.34, { lateral: sd === 'L' ? 0.08 : -0.08 }),
          () => { item.updateWorldMatrix(true, false); wpos(item, sv0); return { dur: 0.5, look: item, body: reachPose(sv0.y) }; },
          { dur: 0.42, ev: 'reach', [sd]: reachTo(item, sd, { pole: [0.7, -0.5, -0.5] }), tick: alignTick(item, sd), evEnd: 'take', end: () => { attach(item, sd); ctx.item = item; } },
          { dur: 0.6, body: { crouch: 0, bend: 0 }, [sd]: restOf(sd), look: null },
        ];
      },
      /* откусить: одно действие — один укус (opts.all — до конца). Попкорн — другой рукой из ведёрка */
      eat(ctx, op) {
        const sd = holdSide(op.side, it => it && (it.def.bite || it.def.pick)); if (!sd) return [];
        const item = held[sd], it = itOf(item);
        if (it.def.pick) return pickEat(ctx, op, sd, item);
        const n = op.all ? Math.max(1, it.left()) : 1, steps = [];
        const key = it.def.bite.key, rotEat = it.def.eat.f ? { f: it.def.eat.f, n: it.def.eat.n } : { itemY: it.def.eat.y, itemZ: it.def.eat.z };
        for (let k = 0; k < n; k++) {
          steps.push({ dur: k ? 0.3 : 0.45, look: { at: 'mouth', offM: [0, -0.15, 0.6] }, lookW: 0.45, head: { pitch: 0.05, chew: 0 }, [sd]: { at: { at: 'mouth', offM: [0, -0.01, 0.04] }, key, rot: rotEat } });
          steps.push({ dur: 0.14, ease: 'in', head: { pitch: 0.1 }, [sd]: { at: { at: 'mouth', offM: [0, -0.004, 0.012] }, key, rot: rotEat }, ev: it.def.lick ? 'lick' : 'bite',
            end: () => { contact('mouth', sd, 'mouth', key); anchor('mouth', sd, sv0); burst(sv0, it.def.crumbs, 10, { size: 0.013, speed: 0.3, up: 0.15 }); emit('crumbs'); if (!it.bite()) { release(sd, null); it.dispose(); ctx.gone = true; } } });
          steps.push(() => ({ dur: 0.2, head: { pitch: 0.02, chew: 1 }, [sd]: ctx.gone ? W({ at: 'mouth', offM: [0, -0.12, 0.12] }, 'hold') : { at: { at: 'mouth', offM: [0, -0.07, 0.1] }, key, rot: rotEat }, ev: 'chew' }));
          steps.push(() => ({ dur: 0.55, head: { chew: 1, pitch: 0 }, look: ctx.gone ? null : undefined }));
        }
        steps.push(() => ({ dur: 0.4, head: { chew: 0, pitch: 0 }, [sd]: restOf(sd), look: null }));
        return steps;
      },
      /* отпить из стаканчика: глоток (opts.all — допить) */
      drink(ctx, op) {
        const sd = holdSide(op.side, it => it && it.def.drink); if (!sd) return [];
        const it = itOf(held[sd]), key = it.def.drink.key;
        const tilt = a => ({ itemY: [0, Math.cos(a), -Math.sin(a)], itemZ: [0, Math.sin(a), Math.cos(a)] });
        const n = op.all ? Math.max(1, Math.ceil(it.level / 0.34 - 0.05)) : 1, steps = [];
        for (let k = 0; k < n; k++) {
          steps.push({ dur: k ? 0.3 : 0.48, look: null, head: { pitch: -0.04 }, [sd]: { at: { at: 'mouth', offM: [0, -0.012, 0.022] }, key, rot: tilt(0.55) } });
          steps.push({ dur: 0.7, ev: 'sip', head: { pitch: -0.15 }, [sd]: { at: { at: 'mouth', offM: [0, -0.008, 0.012] }, key, rot: tilt(1.0) },
            on: () => { contact('mouth', sd, 'mouth', key); }, tick: (c, u, st) => { if (st._l0 === undefined) st._l0 = it.level; it.setLevel(st._l0 - 0.34 * EASE.inOut(u)); }, evEnd: 'gulp' });
        }
        steps.push({ dur: 0.45, head: { pitch: 0 }, [sd]: restOf(sd) });
        return steps;
      },
      /* понюхать цветок/букет */
      sniff(ctx, op) {
        const sd = holdSide(op.side); if (!sd) return [];
        const it = itOf(held[sd]), key = (it.def.sniff && it.def.sniff.key) || [0, 0.1, 0];
        return [
          { dur: 0.5, head: { pitch: 0.08 }, [sd]: { at: { at: 'nose', offM: [0, -0.015, 0.035] }, key, rot: { itemY: [0, 0.8, -0.6], itemZ: [0, 0.6, 0.8] } } },
          { dur: 0.8, ev: 'sniff', head: { pitch: 0.1, nod: -0.05 } },
          { dur: 0.45, head: { pitch: 0, nod: 0 }, [sd]: restOf(sd) },
        ];
      },
      /* полюбоваться покупкой: поднять к глазам, чуть повертеть */
      admire(ctx, op) {
        const sd = holdSide(op.side); if (!sd) return [];
        const spot = { at: 'eyes', offM: [sd === 'L' ? 0.04 : -0.04, -0.17, 0.23] };
        return [
          { dur: 0.5, look: spot, [sd]: { at: spot, key: [0, 0, 0], rot: { itemY: [0, 1, 0], itemZ: [0.35, 0, 1] } } },
          { dur: 0.6, [sd]: { at: spot, key: [0, 0, 0], rot: { itemY: [0, 1, 0], itemZ: [-0.6, 0, 1] } } },
          { dur: 0.5, [sd]: { at: spot, key: [0, 0, 0], rot: { itemY: [0.15, 1, 0], itemZ: [0.4, 0, 1] } }, head: { nod: 0.06 }, ev: 'admire' },
          { dur: 0.45, look: null, head: { nod: 0 }, [sd]: restOf(sd) },
        ];
      },
      /* родник/колодец с крышкой: открыть, спуститься, присесть, набрать в ладони, попить, подняться, закрыть
         opts.spring = { lid, lidAxis ('x'), lidOpen (рад), handle (ручка крышки: объект-ребёнок крышки), stand: { pos, yaw },
                         steps: [точки ступеней сверху вниз], water (точка на воде), ground (y земли у крышки) } */
      drinkSpring(ctx, op) {
        const sp = op.spring || {}, lid = objOf(sp.lid), ax = sp.lidAxis || 'x', open = sp.lidOpen !== undefined ? sp.lidOpen : -1.95;
        if (held.L) return shrug();
        const two = !!mag || pocketed, steps = [];
        const lid0 = lid ? lid.rotation[ax] : 0, handle = sp.handle || lid, water = V();
        const autoPocket = two && !pocketed && !held.R;
        steps.push(approach(sp.stand ? sp.stand.pos : handle, 0.55, sp.stand ? { spot: sp.stand.pos, yaw: sp.stand.yaw } : {}));
        if (autoPocket) steps.push(...pocketSteps(true));
        if (lid) {
          steps.push({ dur: 0.38, look: handle, body: { bend: 0.34, crouch: 0.12 }, L: W({ at: handle, offM: [0, -0.03, -0.03] }, 'lift') });
          steps.push({ dur: 0.5, ev: 'lid', L: W(handle, 'lift'), tick: (c, u) => { lid.rotation[ax] = lerp(lid0, open, 0.5 * EASE.inOut(u)); }, body: { bend: 0.08, crouch: 0 } });
          steps.push({ dur: 0.45, L: 'anim', tick: (c, u) => { lid.rotation[ax] = lerp(lid0, open, 0.5 + 0.5 * EASE.back(u)); }, look: null, body: { bend: 0 } });
        }
        (sp.steps || []).forEach((p, i) => steps.push({ walk: { to: p, speed: 0.9 }, ev: 'step', evData: { i } }));
        steps.push(() => { anchor(sp.water, null, water); return { dur: 0.5, look: water, body: reachPose(water.y + 0.04 * S) }; });
        const cupL = { pole: [0.75, -0.35, -0.55] };
        if (two) {
          steps.push({ dur: 0.45, L: W({ at: water, offM: [0.042, 0.015, 0] }, 'cup', cupL), R: W({ at: water, offM: [-0.042, 0.015, 0] }, 'cup', cupL),
            evEnd: 'splash', end: () => { contact('water', 'L', { at: water, offM: [0.042, 0.015, 0] }); contact('water', 'R', { at: water, offM: [-0.042, 0.015, 0] }); ripple(water, 2); burst(water, '#BFE6F7', 8, { size: 0.012, speed: 0.15, up: 0.3 }); ctx.wat = attach(itemMake('water_cupped'), 'L', false); } });
          steps.push({ dur: 0.3, L: W({ at: water, offM: [0.04, 0.06, -0.02] }, 'cup', cupL), R: W({ at: water, offM: [-0.04, 0.06, -0.02] }, 'cup', cupL) });
          steps.push({ dur: 0.5, look: null, head: { pitch: 0.3 }, body: { crouch: 0.35, bend: 0.32 }, L: W({ at: 'mouth', offM: [0.033, -0.065, 0.05] }, 'cupUp', { pole: [0.8, -0.5, -0.3] }), R: W({ at: 'mouth', offM: [-0.033, -0.065, 0.05] }, 'cupUp', { pole: [0.8, -0.5, -0.3] }) });
        } else {
          steps.push({ dur: 0.45, L: W({ at: water, offM: [0.02, 0.015, 0] }, 'cup'), evEnd: 'splash', end: () => { ripple(water, 2); ctx.wat = attach(itemMake('water_cupped'), 'L', false); } });
          steps.push({ dur: 0.5, look: null, head: { pitch: 0.3 }, body: { crouch: 0.35, bend: 0.32 }, L: W({ at: 'mouth', offM: [0.0, -0.065, 0.05] }, 'cupUp') });
        }
        steps.push({ dur: 0.75, ev: 'drink', head: { pitch: 0.32, chew: 0.6 }, tick: (c, u) => { if (ctx.wat) ctx.wat.scale.setScalar(Math.max(0.01, 1 - u)); } });
        steps.push({ dur: 0.38, head: { pitch: 0, chew: 0 }, L: 'anim', R: two ? 'anim' : undefined,
          end: () => { if (ctx.wat) { release('L', null); itOf(ctx.wat).dispose(); ctx.wat = null; } anchor('chest', 'L', sv0); burst(sv0, '#BFE6F7', 6, { size: 0.011, speed: 0.25, up: 0.1 }); } });
        steps.push({ dur: 0.48, body: { crouch: 0, bend: 0, twist: 0 }, ev: 'ah' });
        (sp.steps || []).slice(0, -1).reverse().forEach(p => steps.push({ walk: { to: p, speed: 0.9 }, ev: 'step' }));
        if (sp.steps && sp.steps.length) steps.push(approach(handle, 0.55, sp.stand ? { spot: sp.stand.pos, yaw: sp.stand.yaw, always: true } : { always: true }));
        if (lid) {
          steps.push({ dur: 0.4, look: handle, L: W({ at: handle, offM: [0, 0.02, 0] }, 'palmDown'), body: { bend: 0.12 } });
          steps.push({ dur: 0.55, L: W(handle, 'palmDown'), tick: (c, u) => { lid.rotation[ax] = lerp(open, lid0, EASE.in(u)); }, body: { bend: 0.36 }, evEnd: 'lidClose' });
          steps.push({ dur: 0.4, L: 'anim', look: null, body: { bend: 0 } });
        }
        if (autoPocket) steps.push(...pocketSteps(false));
        return steps;
      },
      /* погладить зверька: opts.target (корень), opts.head (объект головы | якорь) или opts.headY (высота макушки над корнем) */
      pet(ctx, op) {
        const tgtO = objOf(op.target); if (!tgtO) return [];
        const sd = op.side || (!held.L ? 'L' : (pocketed && !held.R ? 'R' : 'L'));
        const head = op.head || { obj: tgtO, off: [0, op.headY !== undefined ? op.headY : 0.42, 0.03] };
        const hp = V(), strokes = [];
        for (let k = 0; k < (op.strokes || 3); k++) {
          strokes.push({ dur: 0.26, ev: 'pat', [sd]: W({ at: head, offM: [0, 0.04, 0.05] }, 'palmDown'), end: () => contact('head', sd, { at: head, offM: [0, 0.04, 0.05] }) });
          strokes.push({ dur: 0.26, [sd]: W({ at: head, offM: [0, 0.035, -0.03] }, 'palmDown'), on: () => { if (op.onPet) op.onPet(k); } });
        }
        return [
          op.approach === false ? null : approach(head, op.dist || 0.38, { lateral: sd === 'L' ? 0.09 : -0.09 }),
          () => { anchor(head, null, hp); ctx.pose = reachPose(hp.y + 0.06 * S); return null; },
          () => ({ dur: 0.45, look: head, body: ctx.pose, [sd]: W({ at: head, offM: [0, 0.12, 0.0] }, 'palmDown') }),
          ...strokes,
          { dur: 0.35, [sd]: restOf(sd) },
          { dur: 0.45, body: { crouch: 0, bend: 0 }, look: null },
        ];
      },
      /* помахать: свободной левой — как в HeroAnim; левая занята — правой (IK) */
      wave(ctx, op) {
        const dur = op.dur || 1.4;
        if (!held.L) return [{ dur, anim: { waving: true }, look: op.at || undefined, ev: 'wave' }, { dur: 0.3, anim: { waving: false }, look: op.at ? null : undefined }];
        const pole = { pole: [0.9, -0.3, -0.2] };
        const st = [{ dur: 0.35, R: W({ model: [-0.25, 1.42, 0.12] }, 'wave', pole), ev: 'wave' }];
        for (let k = 0; k < 4; k++) st.push({ dur: 0.18, R: W({ model: [k % 2 ? -0.2 : -0.3, 1.43, 0.12] }, 'wave', pole) });
        st.push({ dur: 0.35, R: 'anim' });
        return st;
      },
      /* похлопать: обе ладони (лупа в кармане) или ладонь о кулак с лупой */
      clap(ctx, op) {
        if (held.L || held.R) return shrug();
        const n = op.n || 3, st = [], pole = { pole: [0.8, -0.6, -0.1] }, fist = mag && !pocketed;
        // лупа в руке: правая — кулаком (лупа висит вниз), левая ладонь хлопает по ней сверху
        const at = (k, extra) => Object.assign(fist
          ? { L: W({ at: 'clap', offM: [0.02 + 0.03 * k, 0.045 + 0.05 * k, 0.01] }, { f: [-0.35, -0.2, 1], n: [0, -1, 0] }, pole), R: W({ at: 'clap', offM: [-0.035, -0.05, 0] }, { f: [0.25, -0.75, 0.6], n: [-1, 0, 0] }, pole) }
          : { L: W({ at: 'clap', offM: [0.05 * k, 0, 0] }, 'clap', pole), R: W({ at: 'clap', offM: [-0.05 * k, 0, 0] }, 'clap', pole) }, extra);
        st.push(at(1.4, { dur: 0.28, head: { nod: 0.04 } }));
        for (let k = 0; k < n; k++) { st.push(at(0.42, { dur: 0.09, ease: 'in', evEnd: 'clap' })); st.push(at(1.3, { dur: 0.13 })); }
        st.push({ dur: 0.35, L: 'anim', R: 'anim', head: { nod: 0 } });
        return st;
      },
      /* сесть на лавочку: opts.bench = { seat (центр сиденья, мир), yaw (куда смотрит сидящая), ground (y земли) } */
      sit(ctx, op) {
        if (seatedOn) return [];
        const b = op.bench || {};
        return [() => {
          const seat = anchor(b.seat, null, V()), yaw = b.yaw !== undefined ? b.yaw : root.rotation.y, fx2 = Math.sin(yaw), fz = Math.cos(yaw);
          heroPos(ap1);
          const front = V().set(seat.x + fx2 * 0.45 * S, b.ground !== undefined ? b.ground : ap1.y, seat.z + fz * 0.45 * S);
          const sitP = V().set(seat.x + fx2 * 0.03 * S, seat.y - 0.74 * S, seat.z + fz * 0.03 * S);
          return [
            approach(front, 0, { spot: front, yaw }),
            { dur: 0.75, anim: { sitting: true, sitPose: 'chair' }, root: { to: sitP, yaw }, ev: 'sit', end: () => { seatedOn = b; seatInfo = { front: front.clone(), yaw }; } },
          ];
        }];
      },
      /* встать с лавочки */
      stand(ctx, op) {
        if (!seatedOn) return [];
        const s = seatInfo;
        return [{ dur: 0.65, anim: { sitting: false }, root: { to: s.front, yaw: s.yaw }, ev: 'stand', on: () => { seatedOn = null; } }];
      },
      /* монетку — в копилку/ящичек: opts.box (щель: точка или объект) */
      coin(ctx, op) {
        const sd = freeSide(op.side); if (!sd) return shrug();
        const slot = op.box || op.slot, P = V();
        return [
          op.approach === false ? null : approach(slot, op.dist || 0.5),
          { dur: 0.36, [sd]: W('pocket', 'pocket'), look: { at: 'pocket', offM: [0, 0, 0.25] }, lookW: 0.35, ev: 'pocket', end: () => { ctx.coin = attach(itemMake('coin'), sd, false); } },
          () => { anchor(slot, null, P); return { dur: 0.45, look: P, body: reachPose(P.y), [sd]: { at: P, offM: [0, 0.07, -0.015], key: [0, 0, 0], rot: { itemY: [0, 0.2, 1], itemZ: [0, -1, 0.2] } } }; },
          { dur: 0.1, end: () => {
            contact('slot', sd, { at: P, offM: [0, 0.07, -0.015] }, [0, 0, 0]);
            const c = release(sd, fxParent()); if (!c) return;
            flights.push({ item: c, a: c.position.clone(), b: fxParent().worldToLocal(P.clone()), t: 0, d: 0.3, h: 0.05 * S, done: () => { emit('clink'); itOf(c).dispose(); } });
            emit('coin');
          } },
          { dur: 0.42, [sd]: 'anim', look: null, body: { crouch: 0, bend: 0 } },
        ];
      },
      /* заплатить: монетка из кармана — жителю в лапку (opts.to) или на прилавок (opts.place) */
      pay(ctx, op) {
        const sd = freeSide(op.side); if (!sd) return shrug();
        const steps = [];
        if (op.place) {
          const P = V();
          steps.push(op.approach === false ? null : approach(op.place, op.dist || 0.5));
          steps.push({ dur: 0.36, [sd]: W('pocket', 'pocket'), ev: 'pocket', end: () => { attach(itemMake('coin'), sd, false); } });
          steps.push(() => { anchor(op.place, null, P); return { dur: 0.45, look: P, body: reachPose(P.y), [sd]: { at: P, key: [0, 0, 0], offM: [0, 0.006, 0], rot: { itemY: [0, 0.05, 1], itemZ: [0, -1, 0.05] } } }; });
          steps.push({ dur: 0.08, evEnd: 'coin', end: () => { const par = objOf(op.parent) || fxParent(), c = release(sd, par); if (c) { c.quaternion.setFromEuler(new T.Euler(-PI / 2, 0, 0)); placeOnSurface(c, P, par, itOf(c), true); ctx.coin = c; } } });
          steps.push({ dur: 0.4, [sd]: 'anim', look: null, body: { crouch: 0, bend: 0 } });
          return steps;
        }
        const to = op.to || {}, npc = objOf(to.root || to);
        if (!npc) return [];
        const paw = pawFor(to), meet = V(), home = V(), pawAt = { at: meet, offM: [0, -0.04, 0] };
        steps.push(op.approach === false ? null : approach(npc, op.dist || 0.85));
        steps.push({ dur: 0.36, [sd]: W('pocket', 'pocket'), ev: 'pocket', end: () => { attach(itemMake('coin'), sd, false); } });
        steps.push(() => { npcChest(to, home); meetPoint(to, meet); pawOut(paw, !to.paw, home); return null; });
        steps.push({ dur: 0.45, look: meet, [sd]: W({ at: meet, offM: [0, 0.02, 0] }, 'offer'), paw: { obj: paw, from: home, to: pawAt } });
        steps.push({ dur: 0.12, evEnd: 'coin', end: () => { const c = release(sd, paw); if (c) { c.position.set(0, 0.03, 0); c.quaternion.setFromEuler(new T.Euler(-PI / 2, 0, 0)); } } });
        steps.push({ dur: 0.42, [sd]: 'anim', look: null, paw: { obj: paw, from: pawAt, to: home, hide: !to.paw, after: () => { paw.children.slice().forEach(k => { const it = itOf(k); if (it) it.dispose(); }); } } });
        return steps;
      },
      /* убрать лупу в карман / достать */
      pocket() { return pocketed || !mag || held.R ? [] : pocketSteps(true, true); },
      unpocket() { return !pocketed || !mag || held.R ? [] : pocketSteps(false); },
      /* посмотреть на точку: opts.at, opts.dur */
      look(ctx, op) { return [{ dur: 0.35, look: op.at }, { dur: op.dur || 1.0 }, { dur: 0.35, look: null }]; },
      /* предмет сразу в руке (без анимации): «уже держит» */
      hold(ctx, op) {
        const sd = op.side || freeSide(); if (!sd) return [];
        const item = itemMake(op.item); if (!item) return [];
        return [{ dur: 0.01, end: () => { attach(item, sd, false); ctx.item = item; } }];
      },
    };
    function pocketSteps(hide, manual) {
      const pole = { pole: [0.7, -0.6, -0.5] };
      if (hide) autoPocket = !manual; else autoPocket = false;
      return [
        { dur: 0.34, R: W({ at: 'pocket', offM: [0, 0.035, 0.01] }, 'pocket', pole), ev: hide ? 'pocket' : 'unpocket' },
        { dur: 0.16, R: W({ at: 'pocket', offM: [0, -0.02, 0] }, 'pocket', pole), tick: (c, u) => { if (mag) mag.bone.scale.setScalar(Math.max(1e-3, hide ? 1 - u : u)); }, end: () => { pocketed = hide; if (mag) mag.bone.scale.setScalar(hide ? 1e-3 : 1); } },
        { dur: 0.34, R: 'anim' },
      ];
    }
    function placeOnSurface(item, P, par, it, flat) {
      const b = (it && it.def.bottom) || 0;
      if (!flat) { item.quaternion.identity(); heroFwd(sv0); item.rotation.y = Math.atan2(sv0.x, sv0.z); }
      par.worldToLocal(sv1.copy(P)); item.position.copy(sv1);
      item.position.y += flat ? 0.0016 * S : -b * S;
      item.scale.setScalar(1);
    }
    // попкорн: зёрнышко из ведёрка другой рукой (лупу — в карман); без кармана — «клюёт» из поднесённого ведёрка
    function pickEat(ctx, op, sd, bucket) {
      const os = sd === 'L' ? 'R' : 'L', it = itOf(bucket), steps = [];
      if (os === 'R' && !pocketed && !mag) {
        return [
          { dur: 0.45, [sd]: { at: { at: 'mouth', offM: [0, -0.07, 0.1] }, key: [0, 0.07, 0], rot: { itemY: [0, 0.9, -0.45], itemZ: [0, 0.45, 0.9] } } },
          { dur: 0.5, head: { pitch: 0.15, chew: 1 }, ev: 'crunch', end: () => { if (it.def.level) it.setLevel(it.level - 0.2); else if (!it.bite()) { release(sd, null); it.dispose(); } } },
          { dur: 0.4, head: { pitch: 0, chew: 0 }, [sd]: restOf(sd) },
        ];
      }
      if (os === 'R' && !pocketed) steps.push(...pocketSteps(true));
      const top = { item: bucket, key: it.def.pickKey || [0, 0.07, 0] }, grabbed = it.def.pick === true ? 'kernel' : it.def.pick;
      const less = () => { if (it.def.level) it.setLevel(it.level - 0.12); else if (!it.bite()) { release(sd, null); it.dispose(); ctx.gone = true; } };
      steps.push({ dur: 0.36, look: top, lookW: 0.6, [sd]: W({ at: 'chest', offM: [sd === 'L' ? 0.08 : -0.08, -0.1, 0.06] }, 'hold'), [os]: W({ at: top, offM: [0, 0.05, -0.01] }, 'palmDown') });
      steps.push({ dur: 0.16, [os]: W({ at: top, offM: [0, 0.012, 0] }, 'palmDown'), evEnd: 'take', end: () => { attach(itemMake(grabbed), os, false); less(); } });
      steps.push({ dur: 0.38, look: null, [os]: { at: { at: 'mouth', offM: [0, -0.004, 0.016] }, key: [0, 0, 0], rot: { f: [-0.25, 0.6, 0.75], n: [-1, 0, 0] } } });
      steps.push({ dur: 0.12, ev: 'crunch', end: () => { const k = release(os, null); if (k) itOf(k).dispose(); anchor('mouth', os, sv0); burst(sv0, it.def.crumbs, 6, { size: 0.012, speed: 0.2 }); } });
      steps.push(() => ({ dur: 0.5, head: { chew: 1 }, [os]: 'anim', [sd]: restOf(sd), look: ctx.gone ? null : undefined }));
      steps.push({ dur: 0.25, head: { chew: 0 } });
      return steps;
    }

    /* =====================================================================
       КАДР
       ===================================================================== */
    const hS = V(), hD = V(), hK = V(), hO = V(), hqS = Q(), hqD = Q(), hpP = V(), hpQ = Q();
    function evalHand(sd) {
      const c = ch.hand[sd];
      if (c.w < 0.001 && !c.active) { c.lastW.copy(c.animW); c.lastQ.copy(c.animQ); return; }
      if (c.src) { model.localToWorld(hS.copy(c.src.model)); hqS.copy(c.src.q).premultiply(meshQ); }
      else { hS.copy(c.animW); hqS.copy(c.animQ); }
      if (!c.dst) { hD.copy(c.animW); hqD.copy(c.animQ); }
      else {
        const sp = c.dst;
        rotSpec(sp.rot, sd, hqD);
        anchor(sp.at, sd, hD);
        if (sp.off) hD.add(toV(sp.off, hO));
        if (sp.offM) hD.add(toV(sp.offM, hO).applyQuaternion(meshQ).multiplyScalar(S));
        // какая точка кисти идёт в цель: центр кулака или точка предмета (key — в осях предмета)
        const kIt = sp.key ? itOf(sp.item) || itOf(held[sd]) : null;
        if (kIt) { placement(kIt, sd, hpP, hpQ); hK.fromArray(sp.key); if (sd === 'R' && sp.mirrorKey !== false) hK.x = -hK.x; hK.applyQuaternion(hpQ).add(hpP); }
        else hK.copy(gripV[sd]);
        hK.multiplyScalar(S).applyQuaternion(hqD);
        hD.sub(hK);
      }
      c.wristW.lerpVectors(hS, hD, c.e);
      c.Q.slerpQuaternions(hqS, hqD, c.e);
      c.lastW.copy(c.wristW); c.lastQ.copy(c.Q);
    }
    let tAll = 0;
    function frameMats() { root.updateMatrixWorld(true); model.matrixWorld.decompose(dcp, meshQ, sc0); S = sc0.y || 1; meshQi.copy(meshQ).invert(); }
    function update(dt) {
      dt = clamp(+dt || 0, 0, 0.1); tAll += dt;
      guardIn();
      frameMats();
      // правая держит покупку без действия — «несёт перед собой» (своей позы у HeroAnim для правой нет)
      const cR = ch.hand.R;
      if (held.R && !cR.active && (!run.st || run.st.R === undefined)) { cR.dst = { at: 'carry', rot: 'hold' }; cR.active = true; cR.auto = true; cR.src = null; cR.e = 1; }
      if (cR.auto) { if (!held.R) { cR.auto = false; cR.active = false; cR.dst = null; } else cR.w = Math.min(1, cR.w + dt * 4); }
      if (!cR.active && !run.st && cR.w > 0 && !held.R) cR.w = Math.max(0, cR.w - dt * 4);
      bodyPass(dt);
      lookPass(tAll);
      animSample('L'); animSample('R');
      evalHand('L'); armPass('L');
      evalHand('R'); armPass('R');
      // время действий — после позы: события шагов (взять, откусить, отпустить) видят кисти там, где их нарисуют;
      // новые цели каналов вступят в силу со следующего кадра (запаздывание в 1 кадр незаметно)
      advance(dt);
      guardOut();
      updateSettle(dt);
      updateFx(dt);
    }

    /* --- подмена состояния HeroAnim (вызывать перед anim.update) --- */
    function animState(s) {
      const r = Object.assign({}, s || {});
      const busy = !!run.act;
      if (busy) { r.speed = 0; r.turnRate = 0; r.idle = false; r.waving = false; r.celebrate = false; }
      if (seatedOn) { r.sitting = true; r.sitPose = 'chair'; r.speed = 0; }
      for (const k in ovr) r[k] = ovr[k];
      // левая держит — HeroAnim несёт перед собой (букет — у груди)
      const itL = itOf(held.L);
      if (!('carry' in ovr)) r.carry = itL ? (itL.name === 'bouquet' ? 'bouquet' : 'item') : (busy ? false : r.carry);
      return r;
    }

    function play(name, opts) {
      const fn = typeof name === 'function' ? name : ACTIONS[name];
      return new Promise(resolve => {
        if (!fn) { resolve({ ok: false, action: name, error: 'unknown action' }); return; }
        const ctx = { name, opts: opts || {} };
        const steps = [() => { const s = (fn(ctx, ctx.opts) || []).filter(Boolean); return s.length ? s : [{ dur: 0 }]; }];
        run.q.push({ name, ctx, steps, resolve, opts });
      });
    }
    function chain(list) { const out = list.map(([n, op]) => play(n, op)); return Promise.all(out).then(r => r[r.length - 1]); }
    function cancel() {
      run.q.splice(0).forEach(a => a.resolve({ ok: false, action: a.name, cancelled: true }));
      if (run.act) {
        run.act.cancelled = true;
        paws.splice(0).forEach(p => { p.children.slice().forEach(c => { if (c.userData.it && !held.L) attach(c, 'L', true); }); if (p.parent) p.parent.remove(p); if (p.userData.arm && p.userData.arm.parent) p.userData.arm.parent.remove(p.userData.arm); freePaw(p); });
        if (run.st) { const st = run.st; run.st = null; if (st.end && st.evEnd === 'take') st.end(run.ctx, api); }
        run.steps = run.steps.slice(0, run.i + 1);
        run.i = run.steps.length;
        run.steps.push({ dur: 0.35, L: 'anim', R: held.R ? W('carry', 'hold') : 'anim', body: { crouch: 0, bend: 0, back: 0, twist: 0 }, head: { pitch: 0, chew: 0, nod: 0 }, look: null, anim: { waving: false, speed: 0, turnRate: 0 } });
        if (mag && !pocketed) mag.bone.scale.setScalar(1);
        emit('cancel', { action: run.act.name });
      }
    }
    function dropItem(sd) {
      sd = sd || (held.L ? 'L' : held.R ? 'R' : null); if (!sd) return null;
      const it = release(sd, null); maybeUnpocket(); return it;
    }
    function dispose() {
      run.q.splice(0); run.act = null; run.st = null;
      ['L', 'R'].forEach(sd => { const it = release(sd, null); if (it && itOf(it) && itOf(it).def.parts) itOf(it).dispose(); });
      paws.splice(0).forEach(p => { if (p.parent) p.parent.remove(p); if (p.userData.arm && p.userData.arm.parent) p.userData.arm.parent.remove(p.userData.arm); freePaw(p); });
      fx.splice(0).forEach(f => { if (f.obj.parent) f.obj.parent.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); });
      if (mag) {
        mag.meshes.forEach(m => { m.geometry = mag.g; });
        const i = mag.sk.bones.indexOf(mag.bone); if (i >= 0) { mag.sk.bones.splice(i, 1); mag.sk.boneInverses.splice(i, 1); }
        if (mag.bone.parent) mag.bone.parent.remove(mag.bone);
        mag.g2.dispose(); mag = null;
      }
    }
    api = {
      play, chain, update, animState, cancel, dispose,
      busy: () => !!run.act || run.q.length > 0,
      holding: sd => (sd ? held[sd] : held.L || held.R || null),
      held: () => ({ L: held.L, R: held.R }),
      pocketed: () => pocketed, canPocket: () => !!mag, seated: () => !!seatedOn,
      drop: dropItem,
      give: (item, sd) => { const s = sd || freeSide(); return s ? attach(itemMake(item), s, false) : null; },
      ACTIONS, onEvent: null,
      get state() { return { lastGap, action: run.act && run.act.name, step: run.i, t: run.t, body: Object.assign({}, ch.body), look: ch.look.w, hands: { L: ch.hand.L.w, R: ch.hand.R.w }, pocketed, seated: !!seatedOn, mag: mag ? mag.cnt : 0 }; },
      probe: () => { const r = {}; ['L', 'R'].forEach(sd => { r['hand' + sd] = wpos(B['hand_' + sd], V()); }); r.mouth = anchor('mouth', null, V()); return r; },
      anchor: (a, sd) => anchor(a, sd, V()),
      _dbg: { ch, held, run, torsoCapsule, capA, capB, pushOut, gripV },
    };
    return api;
  }

  window.Interact = {
    create, version: 1, GRIP, GRIPS, EASE,
    items: { make: makeItem, list: NAMES, defs: DEFS, wrap: wrapItem, material: (T, g) => lib(T || window.THREE).material(g) },
  };
})();
