/* =====================================================================
   ПАРАПЛАН НАД СЕЛОМ (VILLAGE.paraglider) — волна 5, FLY.
   Желание автора: «добавь возможность летать на чём-то над домами в Кубачи». Горы — значит параплан: короткий разбег,
   крыло поднимается над головой, ноги отрываются — и героиня в подвеске под пастельным крылом скользит над плоскими
   крышами-террасами, ловит тёплый воздух (там кружат птички и летит пух), сама мягко садится на ровное.
   Ничего страшного: врезаться нельзя (у препятствий воздух мягко подталкивает вверх и в сторону), за край района —
   плавный разворот назад, посадка — подтормозила, пробежка, крыло складывается, «Ух! Приземлилась!».

   Обычный <script> (без модулей), Three.js r149. Не зависит от других модулей села (берёт только то, что передали).

   API
     VILLAGE.paraglider.create(o) → fly | null (нет THREE)
       o = { THREE, scene, camera (false — камеру не трогать), hero (корень Object3D или объект героини { root, body, rig }),
             anim? (HeroAnim; по умолчанию hero.rig.anim), ia? (js/interact.js — отменяется на взлёте),
             ground(x, z) — высота земли региона (h.ground), walkable?(x, z) — где можно стоять (h.walkable: садимся только туда),
             root? — корень сеток региона (h.root): по нему строится карта высот препятствий (растр треугольников, по кусочку
                     за кадр, ≈ 0,2 с всего на ПК); exclude? — объекты, которые не считать (жители: h.npcs[i].root);
                     скрытое не считается, include?(mesh) → true — считать и скрытое (толпа большого базара, видна только вблизи),
                     спрятанное регионом только для вида (mesh.userData.ccHidden / lodHidden) — считается; индекс сетки —
                     geometry.userData.fullIndex, если есть (клеточное отсечение: в index.array — только клетки в кадре),
             colliders?, camColliders?, obstacles? — коробки/круги { type:'box'|'circle', x, z, w, d, ry | r, y1 } (верх → в карту),
             rayHit?(a, b) — луч камеры региона (h.rayHit), npcs? — жители (на них не садимся),
             bounds { x, z, r — мягкая граница (разворот), rMax — жёсткая, ceil — потолок, м },
             zones [{ id, label, x, z, r }] — площадки посадки (кнопка «Приземлиться» ведёт к ближайшей досягаемой; точка касания
                     внутри r ищется сама — ровно, свободно, можно стоять), noLand [{ x, z, r }] — где не садиться,
             launches { id: { x, y, z, ry, run, lift, level?, sock?: {x, y, z} } } — старты (разбег run м по курсу ry, подъём lift м),
             thermals [{ x, z, r, w, top }] — тёплый воздух (w — м/с в центре), wind { x, z } — ветер, м/с (склон под ветром тоже
                     держит: «динамик»), onEvent?(name, data), sound? ({ bus() → AudioNode, sfx(kind) } | false; по умолчанию
                     G.audioBus('amb') и G.sfx, если игра их даёт), renderer? (размер точек пуха), cfg? (числа ниже, DEF) }
       Удобно: create(Object.assign(VILLAGE.paraglider.kubachi(h), { THREE, scene, camera, hero, anim, onEvent })).
     fly.takeoff(from, opt?) → bool — from: 'tower' | 'knoll' | { x, y, z, ry, run?, lift? }; opt.air — сразу в воздухе (тесты)
         Фазы: prep 0,8 с (шаг к старту, крыло — свёрток на спине) → run (разбег, крыло раскрывается над головой) → lift (ноги
         отрываются, садится в подвеску) → fly → [auto] → final → flare (подтормаживает) → skid (пробежка, пыль) → pack (крыло
         складывается) → landed (прыжок «ура») → done. Пока active() — игре не трогать героиню и камеру (как зиплайн).
     fly.update(dt, input) → state — раз в кадр ВМЕСТО шага героини, HeroAnim.update, Interact.update и своей камеры.
         input = { x, y } — джойстик игры: x вправо = поворот (крен), y вниз/«на себя» = тормоз, вверх/«от себя» = быстрее
         (и снижение быстрее); { land: true } — то же, что land(). Без полёта update только дорисовывает карту высот, птиц и пух.
     fly.land(zoneId?) → { id, label } | null — авто-посадка: на zoneId или к ближайшей досягаемой площадке. Заход как у
         настоящих: к спирали у входа в прямую → кругами вниз («уши») → по прямой (план: курс и наклон, при которых линия и
         кончики крыла над препятствиями, лучше против ветра) → сама садится. Не хватает высоты — мягкий «ветерок» снизу.
         Сильный джойстик (> 0,55 дольше 0,4 с) — снова вручную. Низко над тем, где сесть нельзя, дольше 2 с — то же само
         («Низковато… Ветерок, неси к площадке!»). Над ровным открытым местом, где можно стоять, садится и без кнопки.
     fly.manual() — снять авто-посадку (кнопка «Сама порулю»).
     fly.state() → { phase, active, t, x, y, z, heading, bank, speed, vy, agl, lift, thermal, danger, auto, zone, landed, hud }
         landed = { x, y, z, ry, zone } — где героиня стоит после посадки (игре: S.px/S.py/S.pz/S.ang, режим 'walk').
     fly.active() / fly.ready() / fly.prepare(ms) → 0..1 (карта высот, потом планы площадок; по кусочку ms) /
     fly.refresh() — пересчитать карту и площадки (после h.setBazaar(…)) / fly.cancel() — сразу встать на землю под собой /
     fly.spots — места для региона (из пресета), fly.zones, fly.launches, fly.LINES / fly.dispose()
     fly.debug — { top(x,z), surf(x,z), landable(x,z,ry), grid() } для тестов.
     События onEvent(name, data): start, air, roofs, thermal, high, cushion, back, autoLand, autoCancel, helper, final, touch,
         landed, done (data.line — короткая реплика героини, без имени; data.landed — точка посадки).
   VILLAGE.paraglider.kubachi(h, o?) → пресет для села: старты (площадка башни, западный уступ), площадки посадки (площадь,
     поляна на гребне, край села у дороги, крыша-терраса, уступ, луг, террасы-сенокосы — какие не годятся, отсеются сами),
     тёплый воздух (над крышами, у луга, над восточными рядами), ветер с долины, граница района, noLand (башня, парковка,
     свадебный двор), места fly_tower (level 'top') и fly_knoll: use() → { kind:'fly', from }.
   Отрисовка: крыло 1 вызов (пастельные ячейки, цвет в вершинах), стропы 1 (линии), подвеска 1 (SkinnedMesh на костях
     героини: сиденье, спинка, лямки, карабины, клеванты в кулаках), птицы 1, пух и пыль 1 (точки), ветер-штрихи 1, тень 1,
     кольцо площадки 1, флюгеры-«колдуны» на стартах 1 — всего ≤ 9; без полёта видны только птицы, пух и колдуны (3).
     Каждый кадр — без new: все векторы, массивы и буферы заведены заранее.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2, GRAV = 9.81;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
  const angW = a => a - TAU * Math.round(a / TAU);
  const easeOut = u => 1 - (1 - u) * (1 - u);
  const fin = v => typeof v === 'number' && isFinite(v);

  // короткие реплики героини (без имени; женский род — героиня)
  const LINES = {
    start: 'Ну, полетели!',
    air: 'Ура, лечу!',
    roofs: 'Привет, крыши!',
    thermal: 'Тёплый воздух — вверх!',
    high: 'Ух, всё село как на ладошке!',
    cushion: 'Ой! Чуть повыше…',
    back: 'Дальше — только облака. Назад к селу!',
    autoLand: 'Иду на посадку!',
    autoCancel: 'Сама порулю!',
    helper: 'Низковато… Ветерок, неси к площадке!',
    final: 'Подходим…',
    touch: 'Ух! Приземлилась!',
    landed: 'Ещё хочу!',
  };
  const LABELS = { action: 'Полетать', land: 'Приземлиться', spot: 'Площадка параплана', hud: { up: '↑', down: '↓' } };

  // лётные числа (м, м/с, рад); можно поправить через o.cfg
  const DEF = {
    trim: 9.0, vBar: 12.2, vBrake: 6.3,            // скорость: обычная, «от себя», «на себя»
    sink: 1.0, sinkBar: 2.1, sinkMin: 0.85, sinkFull: 1.55,   // снижение: обычное, быстро, минимум (полтормоза), полный тормоз
    bankMax: 0.68, bankK: 2.3,                     // крен до ~39°, как быстро
    lineL: 4.3, clear: 2.0,                        // длина строп; запас высоты над крышами
    ridge: 1.35,                                   // подъём на склоне под ветром: ridge · ветер · уклон
    ceil: 48,                                      // потолок (абсолютная высота) — дальше подъём тает
    finalAgl: 2.8, flareAgl: 0.95,                 // заход на посадку и подрыв
  };

  /* =====================================================================
     КАРТА ВЫСОТ ПРЕПЯТСТВИЙ: растр треугольников сеток региона (верх каждой клетки 1 м) + коробки коллайдеров.
     Стены (почти вертикальные треугольники) — отрезком по их следу с верхней высотой; остальное — барицентрически в центрах
     клеток, плюс вершины. Потом «расширение» на 2 клетки (крыло и героиня не цепляют края). Строится по кусочку за кадр.
     ===================================================================== */
  function heightGrid(T, o) {
    const cell = o.cell || 1, X0 = o.x0, Z0 = o.z0;
    const NX = Math.max(2, Math.ceil((o.x1 - o.x0) / cell)), NZ = Math.max(2, Math.ceil((o.z1 - o.z0) / cell)), N = NX * NZ;
    const H = new Float32Array(N).fill(-1e9), D = new Float32Array(N).fill(-1e9);
    const R = o.dilate === undefined ? 2 : o.dilate;
    const jobs = []; let ji = 0, ti = 0, total = 0, doneTri = 0, ready = true, ms = 0;
    const P = new Float64Array(9), mI = new T.Matrix4(), mTmp = new T.Matrix4(), bb = new T.Box3();
    const XM = X0 + NX * cell, ZM = Z0 + NZ * cell;
    function put(x, z, y) {
      const i = Math.floor((x - X0) / cell), j = Math.floor((z - Z0) / cell);
      if (i < 0 || j < 0 || i >= NX || j >= NZ) return;
      const q = j * NX + i; if (y > H[q]) H[q] = y;
    }
    // индекс сетки целиком: у сеток с клеточным отсечением (kubachi.js, cellCull) в index.array — только клетки в кадре,
    // вся сетка — в userData.fullIndex (иначе карта зависела бы от того, куда смотрит камера)
    const fullIdx = g => (g.userData && g.userData.fullIndex) || (g.index ? g.index.array.subarray(0, g.index.count) : null);
    // спрятано только для вида (регион: userData.ccHidden — вне пирамиды камеры, lodHidden — далеко от камеры) — считаем
    const viewHidden = m => !!(m.isMesh && m.userData && (m.userData.ccHidden || m.userData.lodHidden));
    function okMesh(m) {
      const mt = m.material, g = m.geometry;
      if (!g || !g.attributes || !g.attributes.position || m.isSkinnedMesh) return false;
      if (!mt || Array.isArray(mt)) return !!mt;
      if (mt.depthWrite === false || mt.side === 1 /* BackSide: небо */) return false;
      if (mt.transparent && mt.opacity < 0.4) return false;
      return true;
    }
    function addRoot(root, exclude) {
      if (!root) return;
      root.updateMatrixWorld(true);
      const ex = new Set((exclude || []).filter(Boolean));
      const walk = obj => {
        if (ex.has(obj) || (!obj.visible && !viewHidden(obj) && !(o.include && obj.isMesh && o.include(obj)))) return;   // скрытое (лавки большого базара не в базарный день, товар в лавках) — не считаем; o.include(mesh) — что считать, даже если скрыто
        if (obj.isMesh && okMesh(obj)) {
          const g = obj.geometry; if (!g.boundingBox) g.computeBoundingBox();
          bb.copy(g.boundingBox).applyMatrix4(obj.matrixWorld);
          const inst = obj.isInstancedMesh ? obj.count : 1;
          if (bb.max.x >= X0 && bb.min.x <= XM && bb.max.z >= Z0 && bb.min.z <= ZM && bb.max.y - bb.min.y < 600) {
            const fI = fullIdx(g), n = (fI ? fI.length : g.attributes.position.count) / 3 | 0;
            jobs.push({ m: obj, n, inst, k: 0 }); total += n * inst; ready = false;
          }
        }
        for (let i = 0; i < obj.children.length; i++) walk(obj.children[i]);
      };
      walk(root);
    }
    function inBox(c, x, z, pad) {
      if (c.type === 'circle') return Math.hypot(x - c.x, z - c.z) <= c.r + pad;
      const co = Math.cos(c.ry || 0), si = Math.sin(c.ry || 0), dx = x - c.x, dz = z - c.z, lx = dx * co - dz * si, lz = dx * si + dz * co;
      return Math.abs(lx) <= c.w / 2 + pad && Math.abs(lz) <= c.d / 2 + pad;
    }
    function addBoxes(list) {
      if (!list) return;
      for (let k = 0; k < list.length; k++) {
        const c = list[k]; if (!c || !fin(c.y1) || !fin(c.x) || !fin(c.z)) continue;
        const Rr = c.type === 'circle' ? c.r : Math.hypot(c.w || 0, c.d || 0) / 2; if (!fin(Rr)) continue;
        const i0 = Math.max(0, Math.floor((c.x - Rr - X0) / cell)), i1 = Math.min(NX - 1, Math.floor((c.x + Rr - X0) / cell));
        const j0 = Math.max(0, Math.floor((c.z - Rr - Z0) / cell)), j1 = Math.min(NZ - 1, Math.floor((c.z + Rr - Z0) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          if (!inBox(c, X0 + (i + 0.5) * cell, Z0 + (j + 0.5) * cell, cell * 0.5)) continue;
          const q = j * NX + i; if (c.y1 > H[q]) H[q] = c.y1;
        }
      }
      ready = false; if (!jobs.length || ji >= jobs.length) finalize();
    }
    function tri() {
      const ax = P[0], ay = P[1], az = P[2], bx = P[3], by = P[4], bz = P[5], cx = P[6], cy = P[7], cz = P[8];
      const minx = Math.min(ax, bx, cx), maxx = Math.max(ax, bx, cx), minz = Math.min(az, bz, cz), maxz = Math.max(az, bz, cz);
      if (maxx < X0 || minx > XM || maxz < Z0 || minz > ZM) return;
      put(ax, az, ay); put(bx, bz, by); put(cx, cz, cy);
      const i0 = Math.floor((minx - X0) / cell), i1 = Math.floor((maxx - X0) / cell), j0 = Math.floor((minz - Z0) / cell), j1 = Math.floor((maxz - Z0) / cell);
      if (i0 === i1 && j0 === j1) return;
      const a2 = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const l3 = Math.sqrt(nx * nx + nz * nz + a2 * a2);
      if (Math.abs(a2) < 0.15 * l3) {   // стена: по следу на земле, высота — верх треугольника
        const ymax = Math.max(ay, by, cy);
        let sx = ax, sz = az, tx = bx, tz = bz, L = Math.hypot(bx - ax, bz - az);
        const L2 = Math.hypot(cx - bx, cz - bz), L3 = Math.hypot(ax - cx, az - cz);
        if (L2 > L) { sx = bx; sz = bz; tx = cx; tz = cz; L = L2; }
        if (L3 > L) { sx = cx; sz = cz; tx = ax; tz = az; L = L3; }
        const ns = Math.min(4000, Math.ceil(L / (cell * 0.5)));
        for (let s = 0; s <= ns; s++) put(sx + (tx - sx) * s / ns, sz + (tz - sz) * s / ns, ymax);
        return;
      }
      const inv = 1 / a2, ja = Math.max(0, j0), jb = Math.min(NZ - 1, j1), ia = Math.max(0, i0), ib = Math.min(NX - 1, i1);
      for (let j = ja; j <= jb; j++) {
        const pz = Z0 + (j + 0.5) * cell;
        for (let i = ia; i <= ib; i++) {
          const px = X0 + (i + 0.5) * cell;
          const w1 = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) * inv;
          if (w1 < -0.02) continue;
          const w2 = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) * inv, w3 = 1 - w1 - w2;
          if (w2 < -0.02 || w3 < -0.02) continue;
          const y = w1 * ay + w2 * by + w3 * cy, q = j * NX + i; if (y > H[q]) H[q] = y;
        }
      }
    }
    // кусочек работы: budget мс; true — всё готово
    function step(budget) {
      if (ready) return true;
      const t0 = performance.now();
      while (ji < jobs.length) {
        const J = jobs[ji], m = J.m, g = m.geometry, pa = g.attributes.position, idx = fullIdx(g);
        const arr = pa.isInterleavedBufferAttribute ? pa.data.array : pa.array, st = pa.isInterleavedBufferAttribute ? pa.data.stride : 3, off = pa.isInterleavedBufferAttribute ? pa.offset : 0;
        const total3 = J.n * 3;
        while (J.k < J.inst) {
          if (m.isInstancedMesh) { m.getMatrixAt(J.k, mTmp); mI.multiplyMatrices(m.matrixWorld, mTmp); } else mI.copy(m.matrixWorld);
          const e = mI.elements, isId = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
          while (ti < total3) {
            for (let k = 0; k < 3; k++) {
              const vi = idx ? idx[ti + k] : ti + k, b = vi * st + off; let x = arr[b], y = arr[b + 1], z = arr[b + 2];
              if (!isId) { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; z = Z; }
              P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
            }
            tri(); ti += 3; doneTri++;
            if ((doneTri & 1023) === 0 && performance.now() - t0 > budget) { ms += performance.now() - t0; return false; }
          }
          ti = 0; J.k++;
        }
        ji++;
      }
      ms += performance.now() - t0;
      finalize();
      return true;
    }
    // расширение: максимум по квадрату (2R+1)² — двумя проходами
    function finalize() {
      const tmp = new Float32Array(N);
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { let m = -1e9; for (let d = -R; d <= R; d++) { const ii = i + d; if (ii < 0 || ii >= NX) continue; const v = H[j * NX + ii]; if (v > m) m = v; } tmp[j * NX + i] = m; }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { let m = -1e9; for (let d = -R; d <= R; d++) { const jj = j + d; if (jj < 0 || jj >= NZ) continue; const v = tmp[jj * NX + i]; if (v > m) m = v; } D[j * NX + i] = m; }
      ready = true; jobs.length = 0; ji = 0; ti = 0;
    }
    // билинейно по расширенной карте (вне карты — −1e9)
    function top(x, z) {
      const fx = (x - X0) / cell - 0.5, fz = (z - Z0) / cell - 0.5;
      let i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0 || j < 0 || i >= NX - 1 || j >= NZ - 1) return -1e9;
      const tx = fx - i, tz = fz - j, q = j * NX + i, A = ready ? D : H;
      const a = A[q], b = A[q + 1], c = A[q + NX], d = A[q + NX + 1];
      if (a < -1e8 || b < -1e8 || c < -1e8 || d < -1e8) return Math.max(a, b, c, d);
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }
    // сырой верх: максимум клеток в радиусе rc клеток (0 — одна клетка)
    function raw(x, z, rc) {
      const i = Math.floor((x - X0) / cell), j = Math.floor((z - Z0) / cell); rc = rc | 0;
      let m = -1e9;
      for (let b = -rc; b <= rc; b++) { const jj = j + b; if (jj < 0 || jj >= NZ) continue; for (let a = -rc; a <= rc; a++) { const ii = i + a; if (ii < 0 || ii >= NX) continue; const v = H[jj * NX + ii]; if (v > m) m = v; } }
      return m;
    }
    return { addRoot, addBoxes, step, top, raw, ready: () => ready, progress: () => (ready ? 1 : total ? doneTri / total : 0), info: () => ({ NX, NZ, cell, X0, Z0, total, done: doneTri, ms: Math.round(ms), ready }) };
  }

  /* =====================================================================
     ГЕОМЕТРИЯ: крыло (дуга, профиль, ячейки), подвеска (на костях), колдуны, птицы, пух/пыль (точки)
     ===================================================================== */
  const hexRGB = (T, h, k = 1) => { const c = new T.Color(h); return [c.r * k, c.g * k, c.b * k]; };
  // крыло: начало — верх дуги, +x — влево (как у героини), +y — вверх, +z — вперёд; возвращает { geo, att, brk, span }
  function wingGeometry(T, o = {}) {
    const Rc = o.Rc || 4.4, A = o.A || 0.86, C0 = o.chord || 2.25, NC = 13;
    const PAL = o.colors || ['#D9CBF2', '#BFDDF6', '#BDEBD6', '#FFF1AE', '#FFD6AE', '#F8BACB', '#F59AB5', '#F8BACB', '#FFD6AE', '#FFF1AE', '#BDEBD6', '#BFDDF6', '#D9CBF2'];
    const U = [0, 0.03, 0.08, 0.16, 0.28, 0.42, 0.58, 0.75, 0.9, 1.0];
    const chordAt = a => C0 * (0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - (a / A) * (a / A))));
    const thick = u => Math.sin(PI * Math.pow(u, 0.55));
    const pt = (a, u, upper, out) => {
      const c = chordAt(a), yU = upper ? c * 0.11 * thick(u) : -c * 0.028 * thick(u);
      const sa = Math.sin(a), ca = Math.cos(a), z = c * (0.36 - u) - 0.12 * (1 - ca) * 2;   // кончики чуть назад (стреловидность)
      out[0] = Rc * sa + sa * yU; out[1] = -Rc * (1 - ca) + ca * yU; out[2] = z; return out;
    };
    const pos = [], col = [], ind = [];
    const tmp = [0, 0, 0];
    const seam = 0.07, dark = hexRGB(T, '#5E4C6E'), open = hexRGB(T, '#6A5878');
    for (let c = 0; c < NC; c++) {
      const a0 = -A + 2 * A * c / NC, a1 = -A + 2 * A * (c + 1) / NC, da = a1 - a0;
      const cols = [a0, a0 + da * seam, a0 + da * 0.5, a1 - da * seam, a1];
      const base = hexRGB(T, PAL[c % PAL.length]);
      for (let s = 0; s < 2; s++) {        // 0 — верх, 1 — низ
        const v0 = pos.length / 3;
        for (let ci = 0; ci < cols.length; ci++) for (let ui = 0; ui < U.length; ui++) {
          pt(cols[ci], U[ui], s === 0, tmp); pos.push(tmp[0], tmp[1], tmp[2]);
          const sm = ci === 0 || ci === cols.length - 1 ? 0.84 : 1;
          let r = base[0] * sm, g = base[1] * sm, b = base[2] * sm;
          if (s === 1) { r = r * 0.8 + 0.06; g = g * 0.8 + 0.05; b = b * 0.8 + 0.08; if (U[ui] < 0.05) { r = open[0]; g = open[1]; b = open[2]; } }
          col.push(r, g, b);
        }
        const nu = U.length;
        for (let ci = 0; ci < cols.length - 1; ci++) for (let ui = 0; ui < nu - 1; ui++) {
          const a = v0 + ci * nu + ui, b = a + 1, c2 = a + nu, d = c2 + 1;
          if (s === 0) ind.push(a, c2, b, b, c2, d); else ind.push(a, b, c2, b, d, c2);
        }
      }
    }
    // законцовки: соединить верх и низ на ±A
    [-A, A].forEach((a, side) => {
      const v0 = pos.length / 3;
      for (let ui = 0; ui < U.length; ui++) { pt(a, U[ui], true, tmp); pos.push(tmp[0], tmp[1], tmp[2]); col.push(dark[0] * 1.3, dark[1] * 1.3, dark[2] * 1.3); pt(a, U[ui], false, tmp); pos.push(tmp[0], tmp[1], tmp[2]); col.push(dark[0] * 1.3, dark[1] * 1.3, dark[2] * 1.3); }
      for (let ui = 0; ui < U.length - 1; ui++) { const a1 = v0 + ui * 2, b1 = a1 + 1, c1 = a1 + 2, d1 = a1 + 3; if (side) ind.push(a1, b1, c1, c1, b1, d1); else ind.push(a1, c1, b1, c1, d1, b1); }
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(ind); geo.computeVertexNormals(); geo.computeBoundingSphere();
    // точки строп на нижней поверхности: 4 по размаху с каждой стороны × 3 ряда (A, B, C); тормозные — по задней кромке
    const att = [], brk = [];
    [1, -1].forEach(sg => {
      [0.12, 0.38, 0.62, 0.86].forEach(f => [0.1, 0.38, 0.68].forEach(u => { pt(sg * A * f, u, false, tmp); att.push({ side: sg, p: new T.Vector3(tmp[0], tmp[1], tmp[2]) }); }));
      [0.34, 0.55, 0.74, 0.92].forEach(f => { pt(sg * A * f, 1, false, tmp); brk.push({ side: sg, p: new T.Vector3(tmp[0], tmp[1], tmp[2]) }); });
    });
    return { geo, att, brk, span: 2 * Rc * Math.sin(A), A, Rc };
  }

  // простые формы в общий буфер (позиции, нормали, цвет, кости)
  function Builder(T) {
    const P = [], N = [], C = [], SI = [], SW = [];
    const v = new T.Vector3(), n = new T.Vector3(), m = new T.Matrix4(), mN = new T.Matrix3();
    function addGeo(g, mat, color, bones) {   // bones: [[i, w], …] или функция (p) → [[i, w], …]
      const gi = g.index ? g.toNonIndexed() : g, pa = gi.attributes.position, na = gi.attributes.normal;
      mN.getNormalMatrix(mat);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(mat); n.fromBufferAttribute(na, i).applyMatrix3(mN).normalize();
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); C.push(color[0], color[1], color[2]);
        const b = typeof bones === 'function' ? bones(v) : bones || [[0, 1]];
        for (let k = 0; k < 4; k++) { SI.push(b[k] ? b[k][0] : 0); SW.push(b[k] ? b[k][1] : 0); }
      }
      if (gi !== g) gi.dispose();
    }
    function box(cx, cy, cz, w, h, d, color, bones, rx = 0, ry = 0, rz = 0) {
      const g = new T.BoxGeometry(w, h, d); m.makeRotationFromEuler(new T.Euler(rx, ry, rz)).setPosition(cx, cy, cz); addGeo(g, m, color, bones); g.dispose();
    }
    function cyl(cx, cy, cz, r0, r1, h, seg, color, bones, rx = 0, ry = 0, rz = 0) {
      const g = new T.CylinderGeometry(r1, r0, h, seg); m.makeRotationFromEuler(new T.Euler(rx, ry, rz)).setPosition(cx, cy, cz); addGeo(g, m, color, bones); g.dispose();
    }
    function torus(cx, cy, cz, R, r, color, bones, rx = 0, ry = 0, rz = 0) {
      const g = new T.TorusGeometry(R, r, 4, 12); m.makeRotationFromEuler(new T.Euler(rx, ry, rz)).setPosition(cx, cy, cz); addGeo(g, m, color, bones); g.dispose();
    }
    function sphere(cx, cy, cz, sx, sy, sz, color, bones) {
      const g = new T.SphereGeometry(1, 10, 7); m.makeScale(sx, sy, sz).setPosition(cx, cy, cz); addGeo(g, m, color, bones); g.dispose();
    }
    function build(skin) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
      if (skin) { g.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(SW, 4)); }
      g.computeBoundingSphere(); return g;
    }
    return { box, cyl, torus, sphere, build, count: () => P.length / 3 };
  }

  function gradTex(T) {
    const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 245, 245, 245, 255, 255, 255, 255, 255]);
    const t = new T.DataTexture(d, 4, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
  }
  function blobTex(T, inner, outer) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(cv); return t;
  }

  /* =====================================================================
     ПОЛЁТ
     ===================================================================== */
  function create(o = {}) {
    const T = o.THREE || window.THREE; if (!T) return null;
    const scene = o.scene || null, cam = o.camera === false ? null : (o.camera || null);
    const heroO = o.hero ? (o.hero.isObject3D ? { root: o.hero } : o.hero) : null;
    const root = heroO && heroO.root ? heroO.root : null, body = heroO && heroO.body ? heroO.body : null;
    const anim = o.anim || (heroO && heroO.rig && heroO.rig.anim) || null, B = anim && anim.bones ? anim.bones : null;
    const ground = typeof o.ground === 'function' ? o.ground : () => 0;
    const walkable = typeof o.walkable === 'function' ? o.walkable : null;
    const rayHit = typeof o.rayHit === 'function' ? o.rayHit : null;
    const C = Object.assign({}, DEF, o.cfg || {});
    const wind = new T.Vector3(o.wind ? +o.wind.x || 0 : 0, 0, o.wind ? +o.wind.z || 0 : -1.6), windS = Math.hypot(wind.x, wind.z);
    const windU = new T.Vector3(windS > 0.01 ? wind.x / windS : 0, 0, windS > 0.01 ? wind.z / windS : -1);
    const bounds = Object.assign({ x: 0, z: 0, r: 80, rMax: 100, ceil: C.ceil }, o.bounds || {});
    C.ceil = bounds.ceil;
    const zones = (o.zones || []).map(z => Object.assign({ r: 4 }, z, { td: null, ok: false }));
    const launches = Object.assign({}, o.launches || {});
    const thermals = (o.thermals || []).map(t => Object.assign({ r: 9, w: 2.0, top: bounds.ceil - 6 }, t, { gy: ground(t.x, t.z) }));
    const noLand = o.noLand || [];
    const npcs = o.npcs || null;
    const trash = [];   // всё, что освободить в dispose
    const keep = x => { trash.push(x); return x; };
    const emitted = {};
    const emit = (name, data) => { try { if (o.onEvent) o.onEvent(name, data || {}); } catch (e) { /* звук/реплики — не наша забота */ } };
    const say = (key, extra, every) => {   // реплика не чаще, чем раз в every с (по умолчанию — раз за полёт)
      const t = S.time, last = emitted[key];
      if (last !== undefined && (every === undefined || t - last < every)) return;
      emitted[key] = t; emit(key, Object.assign({ line: LINES[key] }, extra || {}));
    };

    /* --- звук: ветер (шум через полосовой фильтр на общей шине фона) и короткие эффекты игры --- */
    const snd = (() => {
      const so = o.sound === false ? null : (o.sound || null);
      const bus = () => { try { if (so && so.bus) return so.bus(); if (!so && window.G && window.G.audioBus) return window.G.audioBus('amb'); } catch (e) { /* нет звука */ } return null; };
      const sfx = (k, x) => { try { if (so && so.sfx) so.sfx(k, x); else if (!so && window.G && window.G.sfx) window.G.sfx(k, x); } catch (e) { /* нет звука */ } };
      let src = null, gain = null, filt = null, buf = null, ctx = null;
      function start() {
        if (src) return; const b = bus(); if (!b || !b.context) return;
        try {
          ctx = b.context;
          if (!buf || buf.sampleRate !== ctx.sampleRate) { buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); let br = 0; for (let i = 0; i < d.length; i++) { br = br * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = br * 6; } }
          src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
          filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 500; filt.Q.value = 0.7;
          gain = ctx.createGain(); gain.gain.value = 0.0001;
          src.connect(filt); filt.connect(gain); gain.connect(b); src.start();
        } catch (e) { src = null; }
      }
      function set(level, speed) {
        if (!src || !ctx) return; const t = ctx.currentTime;
        try { gain.gain.setTargetAtTime(Math.max(0.0001, level), t, 0.25); filt.frequency.setTargetAtTime(300 + speed * 55, t, 0.3); } catch (e) { /* ok */ }
      }
      function stop() {
        if (!src) return; const s = src, g = gain, f = filt;
        try { const t = ctx.currentTime; g.gain.setTargetAtTime(0.0001, t, 0.15); s.stop(t + 0.6); s.onended = () => { try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ok */ } }; } catch (e) { /* ok */ }
        src = gain = filt = null;
      }
      return { start, set, stop, sfx, on: () => !!src };
    })();

    /* --- карта высот --- */
    const gx = o.grid || { x0: bounds.x - bounds.rMax - 16, x1: bounds.x + bounds.rMax + 16, z0: bounds.z - bounds.rMax - 16, z1: bounds.z + bounds.rMax + 16 };
    const makeGrid = () => { const g = heightGrid(T, Object.assign({ cell: 1, dilate: 2, include: o.include }, gx)); if (o.root) g.addRoot(o.root, o.exclude); g.addBoxes(o.colliders); g.addBoxes(o.camColliders); g.addBoxes(o.obstacles); return g; };
    let grid = makeGrid();
    let zonesDone = false;
    const psiA = Math.atan2(-wind.x, -wind.z);   // против ветра
    // земля региона по клеткам 1 м (максимум 5 точек клетки, лениво, один раз): ground() региона создаёт мелкие объекты на каждый
    // вызов, а «смотреть вперёд» нужно десятки раз за кадр — так кадр полёта без мусора; точная ground() — только под ногами
    const GQ = { x0: gx.x0, z0: gx.z0, nx: Math.ceil(gx.x1 - gx.x0), nz: Math.ceil(gx.z1 - gx.z0) };
    GQ.a = new Float32Array(GQ.nx * GQ.nz).fill(NaN);
    function gmax(x, z) {
      const i = Math.floor(x - GQ.x0), j = Math.floor(z - GQ.z0);
      if (i < 0 || j < 0 || i >= GQ.nx || j >= GQ.nz) return ground(x, z);
      const q = j * GQ.nx + i; let v = GQ.a[q];
      if (v !== v) { const cx = GQ.x0 + i + 0.5, cz = GQ.z0 + j + 0.5; v = Math.max(ground(cx, cz), ground(cx - 0.45, cz - 0.45), ground(cx + 0.45, cz - 0.45), ground(cx - 0.45, cz + 0.45), ground(cx + 0.45, cz + 0.45)); if (!fin(v)) v = -1e9; GQ.a[q] = v; }
      return v;
    }
    const surf = (x, z) => Math.max(gmax(x, z), grid.raw(x, z, 0));            // видимая поверхность под точкой (с запасом клетки)
    const topAt = (x, z) => Math.max(gmax(x, z), grid.top(x, z));              // с запасом 2 м по сторонам
    const inNoLand = (x, z) => { for (let i = 0; i < noLand.length; i++) { const n = noLand[i]; if ((x - n.x) * (x - n.x) + (z - n.z) * (z - n.z) < n.r * n.r) return true; } return false; };
    // можно ли сесть: в круге 1,1 м ровно или пологий склон (до ~0,45), без препятствий выше 0,45 м; высокие (крыло!) — не ближе
    // 3,2 м; можно стоять; впереди (пробежка и заход) — так же, шаг рельефа не больше 0,5 м на метр
    const RING = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
    function landable(x, z, ry, ahead) {
      if (inNoLand(x, z)) return null;
      if (walkable && !walkable(x, z)) return null;
      const g = ground(x, z); if (!fin(g)) return null;
      if (grid.raw(x, z, 0) > g + 0.45) return null;
      for (let k = 0; k < 8; k++) {
        const px = x + RING[k][0] * 1.1, pz = z + RING[k][1] * 1.1, gk = ground(px, pz);
        if (Math.abs(gk - g) > 0.75 || grid.raw(px, pz, 0) > gk + 0.45) return null;
        const qx = x + RING[k][0] * 3.2, qz = z + RING[k][1] * 3.2;
        if (grid.raw(qx, qz, 0) > Math.max(g, ground(qx, qz)) + 2.6) return null;
      }
      if (ahead !== false && fin(ry)) {
        const fx = Math.sin(ry), fz = Math.cos(ry), L = ahead || 6; let gp = g;
        for (let d = 1; d <= L + 0.01; d += 1) {
          const px = x + fx * d, pz = z + fz * d, gk = ground(px, pz);
          if (Math.abs(gk - gp) > 0.5 || grid.raw(px, pz, 0) > gk + 0.45 || inNoLand(px, pz)) return null;
          if (walkable && !walkable(px, pz)) return null;
          // кончики крыла (±3,3 м вбок, ~3,9 м над ногами): высокое рядом с линией — не тут
          if (grid.raw(px + fz * 3.4, pz - fx * 3.4, 0) > gk + 3.5 || grid.raw(px - fz * 3.4, pz + fx * 3.4, 0) > gk + 3.5) return null;
          gp = gk;
        }
      }
      if (npcs) for (let i = 0; i < npcs.length; i++) { const r = npcs[i] && npcs[i].root; if (!r || !r.visible) continue; const p = r.position; if (Math.abs(p.x - x) < 1.8 && Math.abs(p.z - z) < 1.8) return null; }
      return g;
    }
    // точки касания площадок: самое свободное ровное место в радиусе зоны, поближе к центру
    // площадки: кандидаты (ровно, свободно, можно стоять) по запасу места → для лучших до 8 — план захода (по одному за шаг)
    let zoneI = 0, zc = null;
    function scanZone(Z) {
      const out = [];
      for (let dz = -Z.r; dz <= Z.r + 1e-6; dz += 1) for (let dx = -Z.r; dx <= Z.r + 1e-6; dx += 1) {
        if (dx * dx + dz * dz > Z.r * Z.r + 0.01) continue;
        const x = Z.x + dx, z = Z.z + dz, g = landable(x, z, 0, false); if (g === null) continue;
        // запас: насколько далеко во все стороны ровно и свободно (до 4 м)
        let clr = 4;
        for (let k = 0; k < 8 && clr > 1.1; k++) for (let r = 1.7; r <= clr; r += 0.6) { const px = x + RING[k][0] * r, pz = z + RING[k][1] * r, gk = ground(px, pz); if (Math.abs(gk - g) > 0.45 * r + 0.25 || grid.raw(px, pz, 0) > gk + 0.45 || (walkable && !walkable(px, pz))) { clr = r - 0.6; break; } }
        out.push({ x, y: g, z, clr, score: clr * 2 - Math.hypot(dx, dz) * 0.35 });
      }
      out.sort((a, b) => b.score - a.score);
      return out;
    }
    // заход: курс, с которого прямая снижения до точки касания проходит над препятствиями (и кончики крыла тоже) с самым пологим
    // наклоном (лучше — против ветра); вход в прямую за D м, перед ним — спираль вниз вокруг центра сбоку от входа (там, где свободно)
    function planFor(td) {
      let best = null;
      for (let k = 0; k < 24; k++) {
        const psi = k * TAU / 24, fx = Math.sin(psi), fz = Math.cos(psi);
        if (landable(td.x, td.z, psi, 4) === null) continue;
        let need = 1 / 9;
        for (let d = 3; d <= 40; d += 1.5) {
          const x = td.x - fx * d, z = td.z - fz * d;
          const t = d < 5 ? Math.max(ground(x, z), grid.raw(x, z, 1)) + 0.3 : topAt(x, z) + 0.8;
          // кончики крыла: в 3,3 м вбок на ~3,9 м выше ног — тоже над препятствиями
          const tl = Math.max(grid.raw(x + fz * 3.4, z - fx * 3.4, 1), grid.raw(x - fz * 3.4, z + fx * 3.4, 1)) - 3.1;
          const req = (Math.max(t, tl) - td.y - 0.6) / d; if (req > need) need = req;
        }
        if (need > 0.68) continue;
        const score = -need * 8 + Math.cos(angW(psi - psiA)) * 0.5;
        if (!best || score > best.score) best = { psi, slope: need, score };
      }
      if (!best) return null;
      const fx = Math.sin(best.psi), fz = Math.cos(best.psi), lx = Math.cos(best.psi), lz = -Math.sin(best.psi), R = 9;
      let plan = null;
      for (const D of [26, 34, 20]) {
        const ex = td.x - fx * D, ez = td.z - fz * D;
        for (const sg of [1, -1]) {   // спираль слева (влево) или справа (вправо)
          const cxp = ex + lx * R * sg, czp = ez + lz * R * sg;
          let floor = -1e9; for (let a = 0; a < 12; a++) { const ang = a * TAU / 12, t = topAt(cxp + Math.sin(ang) * R, czp + Math.cos(ang) * R); if (t > floor) floor = t; }
          const yE = Math.max(td.y + 0.6 + D * best.slope, floor + 2.2), slope = (yE - td.y - 0.6) / D;
          const sc = -slope * 10 - (sg < 0 ? 0.05 : 0);
          if (!plan || sc > plan.sc) plan = { D, ex, ez, cx: cxp, cz: czp, R, turn: sg, yE, slope, sc };
        }
      }
      if (plan.slope > 0.72) return null;
      return { psi: best.psi, fx, fz, slope: plan.slope, D: plan.D, ex: plan.ex, ez: plan.ez, cx: plan.cx, cz: plan.cz, R: plan.R, turn: plan.turn, yE: plan.yE };
    }
    function zoneStep() {   // маленькими шагами (без рывка в кадре)
      if (zonesDone) return;
      if (zoneI >= zones.length) { thermals.forEach(t => { t.gy = surf(t.x, t.z); }); zonesDone = true; return; }
      const Z = zones[zoneI];
      if (!zc) { zc = { cands: scanZone(Z), k: 0, best: null }; return; }
      if (zc.k < Math.min(8, zc.cands.length)) {
        const c = zc.cands[zc.k++], A = planFor(c);
        if (A) { const sc = -A.slope * 6 + c.score * 0.25; if (!zc.best || sc > zc.best.sc) zc.best = { c, A, sc }; }
        return;
      }
      Z.td = zc.best ? zc.best.c : null; Z.appr = zc.best ? zc.best.A : null; Z.ok = !!zc.best; zc = null; zoneI++;
    }
    function findZones() { while (!zonesDone) zoneStep(); }

    /* --- сетки --- */
    const grad = keep(gradTex(T));
    const fxGroup = new T.Group(); fxGroup.name = 'paraglider';
    if (scene) scene.add(fxGroup);
    // крыло
    const WG = wingGeometry(T, o.wing || {});
    keep(WG.geo);
    const wingMat = keep(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad, side: T.DoubleSide }));
    const wing = new T.Mesh(WG.geo, wingMat); wing.name = 'paraglider:wing'; wing.frustumCulled = false; wing.visible = false; wing.castShadow = !!o.shadows; fxGroup.add(wing);
    // стропы: A/B/C (24) + свободные концы (2) + тормозные (8 + 2)
    const NSEG = WG.att.length + 2 + WG.brk.length + 2;
    const linePos = new Float32Array(NSEG * 6);
    const lineGeo = keep(new T.BufferGeometry()); lineGeo.setAttribute('position', new T.BufferAttribute(linePos, 3));
    const lineMat = keep(new T.LineBasicMaterial({ color: 0x6E5E78, transparent: true, opacity: 0.85 }));
    const lines = new T.LineSegments(lineGeo, lineMat); lines.name = 'paraglider:lines'; lines.frustumCulled = false; lines.visible = false; fxGroup.add(lines);
    // подвеска на костях героини
    let harness = null;
    const harnessMat = keep(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad }));
    const heroMesh = (() => { if (!B || !B.hips) return null; let p = B.hips.parent; while (p && !p.isSkinnedMesh) p = p.parent; return p; })();
    (function buildHarness() {
      const b = Builder(T);
      const sk = heroMesh && heroMesh.skeleton;
      const bi = n => { if (!sk) return -1; for (let i = 0; i < sk.bones.length; i++) if (sk.bones[i].name === n) return i; return -1; };
      const iH = bi('hips'), iS = bi('spine'), iC = bi('chest'), iTL = bi('thigh_L'), iTR = bi('thigh_R'), iHL = bi('hand_L'), iHR = bi('hand_R');
      const okSkin = sk && [iH, iS, iC, iTL, iTR, iHL, iHR].every(i => i >= 0);
      const W = (i, j, k) => (okSkin ? (j === undefined ? [[i, 1]] : [[i, 1 - k], [j, k]]) : [[0, 1]]);
      const plum = hexRGB(T, '#6C5C8E'), teal = hexRGB(T, '#8FD3C7'), yel = hexRGB(T, '#F4C95D'), cherry = hexRGB(T, '#D9506E'), steel = hexRGB(T, '#C9CDD4'), pink = hexRGB(T, '#F7B7C8');
      // сиденье — за бёдрами (в подвеске ложится под них): поровну на обе ноги
      b.box(0, 0.64, -0.115, 0.36, 0.3, 0.05, plum, W(iTL, iTR, 0.5));
      b.box(0, 0.64, -0.145, 0.3, 0.24, 0.03, teal, W(iTL, iTR, 0.5));
      // спинка-протектор: от таза к груди (вес плавно)
      b.box(0, 0.93, -0.165, 0.33, 0.34, 0.09, teal, p => (okSkin ? [[iH, 1 - sst(0.84, 1.08, p.y)], [iC, sst(0.84, 1.08, p.y)]] : [[0, 1]]));
      // рюкзачок (там крыло — свёртком) и запаска
      b.sphere(0, 1.14, -0.24, 0.15, 0.17, 0.09, pink, W(iC));
      b.box(0, 1.14, -0.17, 0.22, 0.2, 0.04, plum, W(iC));
      // лямки через плечи и грудная перемычка
      [1, -1].forEach(s => {
        b.box(s * 0.085, 1.215, -0.05, 0.05, 0.03, 0.2, yel, W(iC));
        b.box(s * 0.085, 1.1, 0.088, 0.045, 0.22, 0.02, yel, W(iC), -0.12, 0, 0);
        // карабины и петли на ногах
        b.box(s * 0.155, 1.03, 0.06, 0.035, 0.06, 0.025, steel, W(iC));
        b.torus(s * 0.068, 0.7, -0.005, 0.088, 0.016, yel, W(s > 0 ? iTL : iTR), PI / 2, 0, 0);
        // клеванты в кулаках (ось — вдоль костяшек, по z)
        b.box(s * 0.216, 0.72, 0.0, 0.034, 0.034, 0.12, cherry, W(s > 0 ? iHL : iHR));
      });
      b.box(0, 1.03, 0.1, 0.22, 0.03, 0.02, yel, W(iC));
      const geo = keep(b.build(okSkin));
      if (okSkin) {
        harness = new T.SkinnedMesh(geo, harnessMat);
        harness.bind(sk, heroMesh.bindMatrix);
      } else harness = new T.Mesh(geo, harnessMat);
      harness.name = 'paraglider:harness'; harness.frustumCulled = false; harness.castShadow = false;
      harness.userData.skinned = !!okSkin;
    })();
    // колдуны на стартах (полосатый конус по ветру на шесте)
    let socks = null;
    (function buildSocks() {
      const list = Object.keys(launches).map(k => launches[k]).filter(L => L && L.sock);
      if (!list.length) return;
      const b = Builder(T), red = hexRGB(T, '#E2566F'), white = hexRGB(T, '#FFF6EC'), pole = hexRGB(T, '#8A7466');
      const yawW = Math.atan2(windU.x, windU.z);
      list.forEach(L => {
        const s = L.sock, hgt = s.h || 1.6;
        b.cyl(s.x, s.y + hgt / 2, s.z, 0.035, 0.03, hgt, 6, pole);
        for (let i = 0; i < 4; i++) {
          const r0 = 0.17 - i * 0.03, r1 = r0 - 0.03, l = 0.22, d = 0.08 + i * l + l / 2;
          b.cyl(s.x + windU.x * d, s.y + hgt - 0.12 - i * 0.025, s.z + windU.z * d, r0, r1, l, 8, i % 2 ? white : red, null, PI / 2, yawW, 0);
        }
      });
      socks = new T.Mesh(keep(b.build(false)), keep(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad })));
      socks.name = 'paraglider:socks'; fxGroup.add(socks);
    })();
    // птицы над тёплым воздухом: по 3 на поток, крылья машут (позиции — в буфере)
    const birds = [];
    thermals.forEach((t, ti) => { for (let k = 0; k < 3; k++) birds.push({ t, a: (k / 3) * TAU + ti, r: t.r * (0.55 + 0.22 * k), dy: -2 - k * 2.2, w: (0.42 + 0.08 * k) * (ti % 2 ? -1 : 1), ph: Math.random() * TAU }); });
    const birdPos = new Float32Array(Math.max(1, birds.length) * 18);
    const birdGeo = keep(new T.BufferGeometry()); birdGeo.setAttribute('position', new T.BufferAttribute(birdPos, 3));
    const birdMesh = new T.Mesh(birdGeo, keep(new T.MeshBasicMaterial({ color: 0x4A3A48, side: T.DoubleSide })));
    birdMesh.name = 'paraglider:birds'; birdMesh.frustumCulled = false; birdMesh.visible = birds.length > 0; fxGroup.add(birdMesh);
    // пух в потоках и пыль: точки с размером и прозрачностью на вершину (1 вызов)
    const NF = thermals.length * 7, ND = 48, NP = Math.max(1, NF + ND);
    const pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 4), pSize = new Float32Array(NP);
    const fluff = []; thermals.forEach((t, ti) => { for (let k = 0; k < 7; k++) fluff.push({ t, a: Math.random() * TAU, r: Math.sqrt(Math.random()) * t.r * 0.8, h: Math.random(), sp: 0.5 + Math.random() * 0.5 }); });
    const dust = []; for (let k = 0; k < ND; k++) dust.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.5, c: 0 });
    const pGeo = keep(new T.BufferGeometry());
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('rgba', new T.BufferAttribute(pCol, 4)); pGeo.setAttribute('size', new T.BufferAttribute(pSize, 1));
    const pMat = keep(new T.ShaderMaterial({
      uniforms: { halfH: { value: 420 } },
      vertexShader: 'attribute vec4 rgba; attribute float size; uniform float halfH; varying vec4 vC;\nvoid main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); vC.a *= 1.0 - smoothstep(45.0, 85.0, -mv.z); gl_PointSize = clamp(size * projectionMatrix[1][1] * halfH / max(0.3, -mv.z), 0.0, 96.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vC;\nvoid main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p); if (d > 1.0 || vC.a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - d * d)); }',
      transparent: true, depthWrite: false,
    }));
    const points = new T.Points(pGeo, pMat); points.name = 'paraglider:fluff'; points.frustumCulled = false; points.renderOrder = 5; fxGroup.add(points);
    // ветер-штрихи у камеры (на скорости)
    const NS = 26, sPos = new Float32Array(NS * 6), sSeed = [];
    for (let i = 0; i < NS; i++) sSeed.push({ a: Math.random() * TAU, r: 1.6 + Math.random() * 4.5, k: Math.random(), y: (Math.random() - 0.5) * 3.5, l: 0.7 + Math.random() * 1.1 });
    const sGeo = keep(new T.BufferGeometry()); sGeo.setAttribute('position', new T.BufferAttribute(sPos, 3));
    const sMat = keep(new T.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const streaks = new T.LineSegments(sGeo, sMat); streaks.name = 'paraglider:wind'; streaks.frustumCulled = false; streaks.visible = false; streaks.renderOrder = 20; fxGroup.add(streaks);
    // тень на земле
    const shTex = keep(blobTex(T, 'rgba(60,46,70,.42)', 'rgba(60,46,70,0)'));
    const shadow = new T.Mesh(keep(new T.PlaneGeometry(1, 1)), keep(new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    shadow.rotation.x = -PI / 2; shadow.name = 'paraglider:shadow'; shadow.visible = false; shadow.renderOrder = 2; fxGroup.add(shadow);
    // кольцо площадки (авто-посадка)
    const marker = new T.Mesh(keep(new T.RingGeometry(1.3, 1.85, 36)), keep(new T.MeshBasicMaterial({ color: 0xE2566F, transparent: true, opacity: 0.7, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 })));
    marker.rotation.x = -PI / 2; marker.name = 'paraglider:zone'; marker.visible = false; marker.renderOrder = 3; fxGroup.add(marker);

    /* --- состояние --- */
    const S = {
      phase: 'idle', time: 0, t: 0, p: new T.Vector3(), p0: new T.Vector3(), start: new T.Vector3(), launch: null,
      psi: 0, phi: 0, theta: 0, thetaV: 0, v: 0, vPrev: 0, vy: 0, gs: 0, k: 0, kv: 0, hang: 0, sit: false, legSpeed: 0, armW: 0, togW: 0, cheer: false,
      cx: 0, cy: 0, ears: 0, earsS: 0, bL: 0, bR: 0, flare: 0, lift: 0, thermalK: 0, cush: 0, danger: 0, avoid: 1, agl: 0, auto: false, zone: null, apMode: '',
      inX: 0, inY: 0, camRayN: 0, camRayT: 1, bounce: 0, assist: 0, lowT: 0, vyCmd: 0, vCmd: 9, lookMax: 1e9, sAl: 1e9, lat: 0, blockT: 0, strongT: 0, landT: 0, outside: false, landG: 0, chkT: 0, zoneT: 0, landed: null, wantAuto: false, clamped: 0, minAgl: 1e9, nanFix: 0,
      camInit: false, camMode: '', fov0: cam ? cam.fov : 55, bodyY: 0, roofsT: 0, maxY: -1e9, done: 0, flights: 0,
    };
    const st = { phase: 'idle', active: false, t: 0, x: 0, y: 0, z: 0, heading: 0, bank: 0, speed: 0, vy: 0, agl: 0, lift: 0, thermal: 0, danger: 0, auto: false, zone: null, landed: null, hud: '', clamped: 0, minAgl: 0 };
    const animSt = { speed: 0, sitting: false, sitPose: 'recline', idle: false, turnRate: 0, waving: false, celebrate: false, carry: false };
    // временные (без new в кадре)
    const vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3(), vD = new T.Vector3(), vE = new T.Vector3(), vF = new T.Vector3();
    const carL = new T.Vector3(), carR = new T.Vector3(), mid = new T.Vector3(), up = new T.Vector3(), hL = new T.Vector3(), hR = new T.Vector3(), knotL = new T.Vector3(), knotR = new T.Vector3();
    const qA = new T.Quaternion(), qB = new T.Quaternion(), qW = new T.Quaternion(), eA = new T.Euler(0, 0, 0, 'YZX');
    const AXX = new T.Vector3(1, 0, 0), UPV = new T.Vector3(0, 1, 0);
    const camPos = new T.Vector3(), camLook = new T.Vector3(), offCur = new T.Vector3(), lookCur = new T.Vector3(), offWant = new T.Vector3(), lookWant = new T.Vector3(), focus = new T.Vector3(), camUp = new T.Vector3();
    const LOOK = [0, 3, 6, 10, 15], LOOKW = [1, 1, 0.85, 0.55, 0.3];   // дальнее — сначала отвернуть, поднимать мягче
    // ИК руки (две кости): плечо → локоть → кисть; без выделений памяти
    const IK = { A: new T.Vector3(), E0: new T.Vector3(), W0: new T.Vector3(), dW: new T.Vector3(), n: new T.Vector3(), E: new T.Vector3(), Wt: new T.Vector3(), a: new T.Vector3(), b: new T.Vector3(), piv: new T.Vector3(), q0: new T.Quaternion(), q1: new T.Quaternion(), q2: new T.Quaternion(), qu: new T.Quaternion(), qf: new T.Quaternion(), qh: new T.Quaternion(), qt: new T.Quaternion() };
    function aimBone(bone, childNow, want) {
      bone.getWorldPosition(IK.piv);
      IK.a.copy(childNow).sub(IK.piv); IK.b.copy(want).sub(IK.piv);
      if (IK.a.lengthSq() < 1e-8 || IK.b.lengthSq() < 1e-8) return;
      IK.a.normalize(); IK.b.normalize();
      IK.q0.setFromUnitVectors(IK.a, IK.b);
      bone.getWorldQuaternion(IK.q1); IK.q0.multiply(IK.q1);
      bone.parent.getWorldQuaternion(IK.q2).invert();
      bone.quaternion.copy(IK.q2.multiply(IK.q0)); bone.updateMatrixWorld(true);
    }
    function armIK(sd, target, pole, w) {
      if (!B || w <= 0.001) return;
      const up_ = B['upperarm_' + sd], fo = B['forearm_' + sd], ha = B['hand_' + sd]; if (!up_ || !fo || !ha) return;
      IK.qu.copy(up_.quaternion); IK.qf.copy(fo.quaternion); IK.qh.copy(ha.quaternion);
      up_.updateMatrixWorld(true);
      up_.getWorldPosition(IK.A); fo.getWorldPosition(IK.E0); ha.getWorldPosition(IK.W0);
      const l1 = IK.A.distanceTo(IK.E0), l2 = IK.E0.distanceTo(IK.W0);
      IK.dW.copy(target).sub(IK.A); let d = IK.dW.length(); if (d < 1e-4) return; IK.dW.divideScalar(d);
      d = clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.995);
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      IK.n.copy(pole).addScaledVector(IK.dW, -pole.dot(IK.dW)); if (IK.n.lengthSq() < 1e-6) IK.n.set(0, -1, 0); IK.n.normalize();
      IK.E.copy(IK.A).addScaledVector(IK.dW, a).addScaledVector(IK.n, h);
      IK.Wt.copy(IK.A).addScaledVector(IK.dW, d);
      aimBone(up_, IK.E0, IK.E);
      ha.getWorldPosition(IK.W0); aimBone(fo, IK.W0, IK.Wt);
      ha.quaternion.set(0, 0, 0, 1); ha.rotateX(0.25);
      if (w < 0.999) { IK.qt.copy(up_.quaternion); up_.quaternion.slerpQuaternions(IK.qu, IK.qt, w); IK.qt.copy(fo.quaternion); fo.quaternion.slerpQuaternions(IK.qf, IK.qt, w); IK.qt.copy(ha.quaternion); ha.quaternion.slerpQuaternions(IK.qh, IK.qt, w); }
      up_.updateMatrixWorld(true);
    }

    /* --- подъём: термики + склон под ветром, у потолка тает --- */
    function liftAt(x, y, z) {
      let w = 0, th = 0;
      for (let i = 0; i < thermals.length; i++) {
        const t = thermals[i], sway = Math.sin(S.time * 0.13 + i) * 1.2;
        const dx = x - t.x - sway, dz = z - t.z - sway * 0.5, d2 = (dx * dx + dz * dz) / (t.r * t.r);
        if (d2 > 6) continue;
        const k = Math.exp(-d2) * (1 - sst(t.top - 9, t.top, y));
        w += t.w * k; if (k > th) th = k;
      }
      if (C.ridge > 0 && windS > 0.05) {
        const g1 = gmax(x + windU.x * 5, z + windU.z * 5), g0 = gmax(x - windU.x * 5, z - windU.z * 5), g = gmax(x, z);
        const slope = (g1 - g0) / 10, agl = y - Math.max(g, g0, g1);
        if (slope > 0 && agl > -1) w += C.ridge * windS * clamp(slope, 0, 1.2) * (1 - sst(14, 34, agl));
      }
      w *= 1 - sst(C.ceil - 8, C.ceil, y);
      S.thermalK = th;
      return w;
    }

    /* --- «врезаться нельзя»: смотрим вперёд по курсу; если не хватает высоты — мягко вверх и в сторону --- */
    function cushion(h) {
      const vgx = Math.sin(S.psi) * S.v + wind.x, vgz = Math.cos(S.psi) * S.v + wind.z, vg = Math.max(2, Math.hypot(vgx, vgz)), ux = vgx / vg, uz = vgz / vg;
      let worst = 1e9, dangerW = 0, openRun = true;
      // низко над ровным: сядем раньше, чем долетим до дальнего препятствия, — его не боимся (если до него всё ровно)
      const lland = S.agl < 6 && S.vy < -0.6 ? Math.min(14, S.agl / -S.vy * vg + 4) : -1;
      for (let i = 0; i < LOOK.length; i++) {
        const d = LOOK[i]; if (d > S.lookMax) break;   // на прямой захода — не дальше точки касания (дальше уже сядем)
        const x = S.p.x + ux * d, z = S.p.z + uz * d, t = topAt(x, z);
        let need = t + (S.auto && S.apMode === 'final' ? 0.5 : C.clear), open = false;
        if (S.p.y - t < 8) {   // ровное и открытое место, где можно стоять, — ниже можно (так и садимся)
          const g = gmax(x, z);
          if (grid.raw(x, z, 1) < g + 0.45 && (!walkable || walkable(x, z)) && !inNoLand(x, z)) { need = g + 0.25; open = true; }
        }
        if (!open && openRun && lland > 0 && d > lland) break;
        if (!open) openRun = false;
        if (d <= 6) {   // кончики крыла: ±3,4 м вбок, ~3,9 м над ногами (в крене нижний — ниже)
          const tipNeed = Math.max(grid.raw(x + uz * 3.4, z - ux * 3.4, 0), grid.raw(x - uz * 3.4, z + ux * 3.4, 0)) - 3.1 + Math.abs(Math.sin(S.phi)) * 2.2;
          if (tipNeed > need) need = tipNeed;
        }
        const yd = S.p.y + Math.min(S.vy, 0.5) * d / vg, m = yd - need;
        if (m < worst) worst = m;
        const dw = clamp(-m / 3, 0, 1) * LOOKW[i]; if (dw > dangerW) dangerW = dw;
      }
      const danger = clamp(-worst / 3, 0, 1);   // для поворота «отвернуть»; подъём — по взвешенному (ближнее важнее)
      if (danger > 0.05) {
        const ca = Math.cos(0.65), sa = Math.sin(0.65);
        const lx = ux * ca + uz * sa, lz = -ux * sa + uz * ca, rx = ux * ca - uz * sa, rz = ux * sa + uz * ca;   // +0.65 — влево (курс растёт), −0.65 — вправо
        const tl = topAt(S.p.x + lx * 9, S.p.z + lz * 9), tr = topAt(S.p.x + rx * 9, S.p.z + rz * 9);
        if (tl < tr - 0.3) S.avoid = -1; else if (tr < tl - 0.3) S.avoid = 1;
      }
      S.danger = damp(S.danger, danger, danger > S.danger ? 8 : 2, h);
      S.cush = damp(S.cush, dangerW * 4.5, 7, h);
      if (S.danger > 0.45 && S.phase === 'fly') say('cushion', null, 14);
    }

    /* --- авто-посадка: ближайшая досягаемая площадка; кругами вниз, если высоко; подход против ветра --- */
    // площадка: та, до входа в заход которой долетаем планированием (с запасом), — ближайшая; иначе ближайшая («ветерок» поможет)
    function pickZone(prefer) {
      let best = null, bestS = 1e18;
      for (let i = 0; i < zones.length; i++) {
        const Z = zones[i]; if (!Z.ok || !Z.td || !Z.appr) continue;
        if (prefer && Z.id === prefer) return Z;
        const A = Z.appr, dc = Math.hypot(S.p.x - A.cx, S.p.z - A.cz), d = Math.hypot(S.p.x - Z.td.x, S.p.z - Z.td.z), E = S.p.y - A.yE - dc / 7;
        const score = d + (E >= 0 ? 0 : -E * 6);
        if (score < bestS) { bestS = score; best = Z; }
      }
      return best;
    }
    // авто-посадка: к спирали у входа в заход → вниз кругами до высоты входа → по прямой к точке касания (наклон из плана).
    // Вертикаль задаётся напрямую (S.vyCmd): потоки не мешают, «уши» — когда вниз быстро, «ветерок» — когда надо вверх.
    function autopilot(h) {
      S.zoneT -= h;
      if (!S.zone || S.zoneT <= 0) {
        S.zoneT = 4;
        if (!S.zone || S.apMode !== 'final') {
          const z = pickZone();
          if (z && (!S.zone || (z !== S.zone && Math.hypot(S.p.x - z.td.x, S.p.z - z.td.z) < 0.6 * Math.hypot(S.p.x - S.zone.td.x, S.p.z - S.zone.td.z)))) { S.zone = z; S.apMode = ''; marker.position.set(z.td.x, z.td.y + 0.07, z.td.z); }
        }
      }
      const Z = S.zone; if (!Z || !Z.appr) { S.auto = false; marker.visible = false; return; }
      const td = Z.td, A = Z.appr, fx = A.fx, fz = A.fz;
      const rx = S.p.x - td.x, rz = S.p.z - td.z, sAl = -(rx * fx + rz * fz), lat = rx * fz - rz * fx;
      const dC = Math.hypot(S.p.x - A.cx, S.p.z - A.cz), dE = Math.hypot(S.p.x - A.ex, S.p.z - A.ez);
      const aligned = Math.abs(angW(S.psi - A.psi)) < 0.55;
      let ax, az, vy = 0, v = C.trim;
      if (S.apMode === 'final' && (sAl < -6 || Math.abs(lat) > 12)) S.apMode = 'toC';   // проскочили — на второй круг
      if (S.apMode !== 'final') {
        const atEntry = Math.abs(angW(S.psi - A.psi)) < 0.5 && sAl > A.D - 12 && sAl < A.D + 10 && Math.abs(lat) < 9;
        if ((dE < 7 && aligned && S.p.y < A.yE + 1.2) || (atEntry && S.p.y < A.yE + 2)) S.apMode = 'final';
        else if (dC < A.R + 3 || (S.apMode === 'helix' && dC < A.R + 20)) S.apMode = 'helix';
        else S.apMode = 'toC';
      }
      if (S.apMode === 'toC') {
        ax = A.cx; az = A.cz;
        const yT = A.yE + Math.max(0, dC - A.R) / 9;   // приходим к спирали не ниже входа
        vy = clamp((yT - S.p.y) * 0.25, -2.2, 1.5);
      } else if (S.apMode === 'helix') {
        const ang = Math.atan2(S.p.x - A.cx, S.p.z - A.cz) + 0.6 * A.turn;
        ax = A.cx + Math.sin(ang) * A.R; az = A.cz + Math.cos(ang) * A.R;
        vy = S.p.y > A.yE + 0.4 ? -clamp((S.p.y - A.yE) * 0.4, 0.6, 3.2) : clamp((A.yE - S.p.y) * 0.5, 0, 1.5);
      } else {
        const look = clamp(sAl * 0.5, 4, 12); ax = td.x - fx * (sAl - look); az = td.z - fz * (sAl - look);
        const slope = Math.max(A.slope, 0.08); v = slope > 0.3 ? 6.2 : 7.2;
        const yT = td.y + 0.6 + Math.max(0, sAl) * slope;
        vy = clamp((yT - S.p.y) * 1.3 - v * slope, -4.2, 1.6);
      }
      const want = Math.atan2(ax - S.p.x, az - S.p.z), e = angW(want - S.psi);
      S.cx = clamp(-e * 1.6, -1, 1); S.vyCmd = vy; S.vCmd = v;
      S.lookMax = S.apMode === 'final' ? 3 : 1e9; S.sAl = sAl; S.lat = lat;   // на прямой захода линия проверена планом — смотрим только под себя
    }

    /* --- взлёт --- */
    function launchOf(from) {
      if (from && typeof from === 'object') return Object.assign({ run: 2.6, lift: 1.6 }, from);
      const L = launches[from] || launches[Object.keys(launches)[0]];
      return L ? Object.assign({ run: 2.6, lift: 1.6 }, L) : null;
    }
    function takeoff(from, opt = {}) {
      if (!root || (S.phase !== 'idle' && S.phase !== 'done')) return false;
      const L = launchOf(from); if (!L) return false;
      if (!grid.ready()) { let guard = 0; while (!grid.step(1e9) && guard++ < 5); }
      if (!zonesDone) findZones();
      if (o.ia) { try { o.ia.cancel(); } catch (e) { /* ok */ } }
      // лупа (кость 'mag' слоя рук js/interact.js) — в кулак на время полёта: в руках клеванты
      S.mag = null; if (B && B.hand_R) for (let i = 0; i < B.hand_R.children.length; i++) { const c = B.hand_R.children[i]; if (c.isBone && c.name === 'mag') { S.mag = c; S.magScale = c.scale.x; c.scale.setScalar(1e-3); } }
      S.launch = L; S.flights++;
      for (const k in emitted) delete emitted[k];
      S.time = S.time || 0; S.t = 0; S.v = 0; S.vy = 0; S.gs = 0; S.phi = 0; S.theta = 0; S.thetaV = 0; S.k = 0; S.hang = 0; S.sit = false; S.legSpeed = 0; S.armW = 0; S.togW = 0; S.cheer = false;
      S.cx = S.cy = S.ears = S.earsS = 0; S.assist = 0; S.lowT = 0; S.bL = S.bR = 0; S.flare = 0; S.cush = 0; S.danger = 0; S.auto = false; S.zone = null; S.apMode = ''; S.wantAuto = false; S.strongT = 0; S.landed = null; S.outside = false; S.clamped = 0; S.bounce = 0; S.minAgl = 1e9; S.maxY = -1e9; S.roofsT = 0;
      S.psi = L.ry || 0;
      S.start.set(L.x, fin(L.y) ? L.y : ground(L.x, L.z), L.z);
      S.p0.copy(root.position); if (S.p0.distanceTo(S.start) > 3.5 || !fin(S.p0.x)) S.p0.copy(S.start);
      S.p.copy(S.p0);
      if (body) { S.bodyY = body.position.y; body.position.y = 0; }
      if (harness && !harness.parent) { const par = harness.userData.skinned ? (heroMesh.parent || root) : root; par.add(harness); }
      harness.visible = true;
      wing.visible = true; lines.visible = false; S.camInit = false; S.camMode = ''; S.fov0 = cam ? cam.fov : S.fov0;
      if (opt.air) {   // сразу в воздухе (тесты): над стартом, на крейсерской скорости
        S.phase = 'fly'; S.p.copy(S.start); S.p.y += (L.lift || 1.6) + 1; S.v = C.trim; S.k = 1; S.hang = 1; S.sit = true; S.armW = 1; S.togW = 1;
        say('air');
      } else S.phase = 'prep';
      snd.start();
      return true;
    }

    /* --- шаг физики (фикс. ≤ 1/60 с) --- */
    function step(h) {
      S.t += h;
      const L = S.launch;
      if (S.phase === 'prep') {
        const u = clamp(S.t / 0.8, 0, 1), e = u * u * (3 - 2 * u);
        S.p.lerpVectors(S.p0, S.start, e); S.p.y = Math.max(ground(S.p.x, S.p.z), S.start.y - 0.3);
        const dd = S.p0.distanceTo(S.start); S.legSpeed = dd > 0.2 ? (1 - Math.abs(2 * u - 1)) * Math.min(2, dd * 1.6) : 0;
        S.armW = sst(0.3, 0.8, S.t); S.k = 0;
        if (S.t >= 0.8) { S.phase = 'run'; S.t = 0; S.gs = 0.6; say('start'); snd.sfx('flutter'); }
      } else if (S.phase === 'run') {
        S.gs = Math.min(3.6, S.gs + 4.2 * h);
        S.p.x += Math.sin(S.psi) * S.gs * h; S.p.z += Math.cos(S.psi) * S.gs * h;
        S.p.y = Math.max(ground(S.p.x, S.p.z), S.start.y - 0.3);
        S.legSpeed = S.gs; S.armW = 1; S.k = sst(0, 1.15, S.t);
        const run = Math.hypot(S.p.x - S.start.x, S.p.z - S.start.z);
        if (run >= (L.run || 2.6) || S.t > 2.4) { S.phase = 'lift'; S.t = 0; S.liftY = S.p.y; }
      } else if (S.phase === 'lift') {
        const u = clamp(S.t / 0.9, 0, 1);
        S.gs = lerp(3.6, C.trim * 0.85, sst(0, 1, u));
        S.p.x += Math.sin(S.psi) * S.gs * h; S.p.z += Math.cos(S.psi) * S.gs * h;
        S.p.y = Math.max(S.liftY + (L.lift || 1.6) * easeOut(u), grid.raw(S.p.x, S.p.z, 0) + 0.3, ground(S.p.x, S.p.z) + 0.02);
        S.k = 1; S.legSpeed = 3.4 * (1 - u); S.sit = u > 0.45; S.hang = sst(0.3, 1, u); S.togW = sst(0.4, 1, u);
        if (u >= 1) { S.phase = 'fly'; S.t = 0; S.v = S.gs; S.vy = 0; S.hang = 1; S.sit = true; S.togW = 1; say('air'); if (S.wantAuto) startAuto(false, typeof S.wantAuto === 'string' ? S.wantAuto : null); }
      } else if (S.phase === 'fly') fly(h);
      else if (S.phase === 'final' || S.phase === 'flare') approach(h);
      else if (S.phase === 'skid') skid(h);
      else if (S.phase === 'pack') { S.k = Math.max(0, S.k - h / 0.9); S.armW = S.k; S.legSpeed = 0; if (S.k <= 0) { S.phase = 'landed'; S.t = 0; S.cheer = true; harness.visible = false; puff(S.p.x, S.p.y + 0.9, S.p.z - 0, 8, 0.7, 1); wing.visible = false; say('landed', { landed: S.landed }); snd.sfx('ok'); } }
      else if (S.phase === 'landed') { if (S.t > 0.25) S.cheer = false; if (S.t > 1.25) finish(); }
    }

    function fly(h) {
      // управление: джойстик или автопилот
      if (S.auto) {
        autopilot(h);
        if (Math.abs(S.inX) > 0.55 || Math.abs(S.inY) > 0.55) { S.strongT += h; if (S.strongT > 0.4) { S.auto = false; S.zone = null; marker.visible = false; say('autoCancel', null, 3); } } else S.strongT = 0;
      }
      if (!S.auto) { S.cx = S.inX; S.cy = -S.inY; S.lookMax = 1e9; }
      let cx = clamp(S.cx, -1, 1), cy = clamp(S.cy, -1, 1);
      // граница района: плавно домой
      const dx = S.p.x - bounds.x, dz = S.p.z - bounds.z, dist = Math.hypot(dx, dz), over = sst(bounds.r, bounds.rMax, dist);
      if (over > 0) {
        const e = angW(Math.atan2(-dx, -dz) - S.psi); cx = lerp(cx, clamp(-e * 1.4, -1, 1), Math.min(1, over * 1.6));
        if (over > 0.15 && !S.outside) { S.outside = true; say('back', null, 12); }
      } else if (dist < bounds.r - 6) S.outside = false;
      cx = lerp(cx, S.avoid, clamp(S.danger * 1.3, 0, 1) * (1 - over) * (S.auto && S.apMode === 'final' ? 0 : 1));
      if (S.danger > 0.2) cy = clamp(cy, -0.2, 0);
      const bar = Math.max(0, cy), brk = Math.max(0, -cy);
      S.phi = damp(S.phi, cx * C.bankMax, C.bankK, h);
      S.vPrev = S.v;
      S.psi = angW(S.psi - GRAV * Math.tan(S.phi) / Math.max(4, S.v) * h);
      if (S.auto) {   // автопилот: скорость и вертикаль — напрямую (с подушкой поверх)
        S.v = damp(S.v, S.vCmd || C.trim, 1.3, h);
        S.lift = 0; liftAt(S.p.x, S.p.y, S.p.z);
        cushion(h);
        S.earsS = damp(S.earsS, clamp((-S.vyCmd - 1.3) / 1.5, 0, 2), 1.5, h);
        S.vy = damp(S.vy, S.vyCmd + S.cush, 2.4, h);
      } else {
        S.v = damp(S.v, C.trim + bar * (C.vBar - C.trim) - brk * (C.trim - C.vBrake), 1.3, h);
        let sink = brk < 0.5 ? lerp(C.sink, C.sinkMin, brk / 0.5) : lerp(C.sinkMin, C.sinkFull, (brk - 0.5) / 0.5);
        sink = lerp(sink, C.sinkBar, bar);
        S.earsS = damp(S.earsS, 0, 1.5, h);
        sink = sink / Math.cos(S.phi);
        S.lift = liftAt(S.p.x, S.p.y, S.p.z);
        cushion(h);
        S.vy = damp(S.vy, Math.min(4.5, -sink + S.lift + S.cush), 2.4, h);
      }
      if (S.p.y > C.ceil + 2 && S.vy > 0) S.vy *= 0.9;
      // руки: тормоза (в повороте — та, куда поворачиваем)
      S.bL = damp(S.bL, clamp(brk + Math.max(0, -cx) * 0.7, 0, 1), 6, h); S.bR = damp(S.bR, clamp(brk + Math.max(0, cx) * 0.7, 0, 1), 6, h);
      integrate(h);
      // реплики по дороге
      if (S.thermalK > 0.45) say('thermal', null, 25);
      if (S.p.y > C.ceil - 10) say('high');
      if (S.agl > 4 && S.agl < 14 && S.t > 4) say('roofs');
      // низко над тем, где не сесть (крыши, обрывы, за краем села), дольше 1,5 с — «ветерок» сам несёт к площадке
      if (!S.auto && (S.agl < 3.5 || S.danger > 0.45) && S.phase === 'fly') { S.lowT += h; if (S.lowT > 2) { S.lowT = 0; if (startAuto(true)) say('helper', null, 20); } } else S.lowT = Math.max(0, S.lowT - h * 0.5);
      // авто: на прямой у самой площадки — сразу посадка (точка касания проверена заранее)
      if (S.auto && S.apMode === 'final' && S.sAl < 9 && S.sAl > -2 && Math.abs(S.lat) < 3 && S.agl < 5) { S.phase = 'final'; S.t = 0; S.lowT = 0; S.blockT = 0; say('final', null, 8); return; }
      // посадка сама: низко над ровным и можно стоять (не «от себя»)
      S.chkT -= h;
      if (S.agl < C.finalAgl && S.vy < 0.4 && (S.auto || cy < 0.3) && S.chkT <= 0) {
        S.chkT = 0.15;
        const g = landable(S.p.x, S.p.z, S.psi, S.auto && S.apMode === 'final' ? 4 : 8);
        if (g !== null) { S.phase = 'final'; S.t = 0; S.landG = g; S.lowT = 0; say('final', null, 8); }
      }
    }
    function integrate(h) {
      const fx = Math.sin(S.psi), fz = Math.cos(S.psi);
      const nx = S.p.x + (fx * S.v + wind.x) * h, nz = S.p.z + (fz * S.v + wind.z) * h;
      if (S.phase === 'fly' && Math.max(gmax(nx, nz), grid.raw(nx, nz, 1)) > S.p.y - 0.45) {   // стенка впереди: мягко вверх и в сторону
        S.vy = Math.max(S.vy, 2.2); S.psi = angW(S.psi - S.avoid * 1.2 * h); S.bounce++;
      } else { S.p.x = nx; S.p.z = nz; }
      S.p.y += S.vy * h;
      // жёстко: не ниже препятствий под собой (сырой верх 3×3 клетки) и не выше потолка+
      const g = S.phase === 'fly' ? gmax(S.p.x, S.p.z) : ground(S.p.x, S.p.z), minY = Math.max(g, grid.raw(S.p.x, S.p.z, 1)) + (S.phase === 'fly' ? 0.45 : 0.02);
      if (S.p.y < minY) { S.p.y = minY; if (S.vy < 0) S.vy = 0; S.clamped++; }
      if (S.p.y > C.ceil + 6) { S.p.y = C.ceil + 6; if (S.vy > 0) S.vy = 0; }
      const dx = S.p.x - bounds.x, dz = S.p.z - bounds.z, dist = Math.hypot(dx, dz), lim = bounds.rMax + 8;
      if (dist > lim) { S.p.x = bounds.x + dx / dist * lim; S.p.z = bounds.z + dz / dist * lim; }
      S.agl = S.p.y - Math.max(g, grid.raw(S.p.x, S.p.z, 0));
      if (S.phase === 'fly' && S.agl < S.minAgl) S.minAgl = S.agl;
      if (S.p.y > S.maxY) S.maxY = S.p.y;
      // маятник вперёд-назад от разгона/торможения
      const acc = (S.v - S.vPrev) / Math.max(1e-3, h);
      S.thetaV += (2.2 * 2.2 * (clamp(acc * 0.07, -0.3, 0.3) - S.theta) - 2 * 0.35 * 2.2 * S.thetaV) * h; S.theta = clamp(S.theta + S.thetaV * h, -0.35, 0.35);
    }
    // заход (final): ровно вниз над площадкой; подрыв (flare): тормоза, скорость падает, ноги вниз
    function approach(h) {
      const g = ground(S.p.x, S.p.z);
      if (S.phase === 'final' && S.auto && S.zone && S.zone.td && S.zone.appr) {   // авто: по линии захода точно в точку касания
        const td = S.zone.td, A = S.zone.appr, dx = td.x - S.p.x, dz = td.z - S.p.z, along = dx * Math.sin(S.psi) + dz * Math.cos(S.psi);
        if (along > 1.2) { const e = angW(Math.atan2(dx, dz) - S.psi); S.psi = angW(S.psi + clamp(e, -1, 1) * 1.5 * h); }
        S.v = damp(S.v, 5.6, 2, h); S.phi = damp(S.phi, 0, 3, h);
        const slope = Math.max(A.slope, 0.08), yT = td.y + 0.45 + Math.max(0, along) * slope;
        S.vy = damp(S.vy, clamp((yT - S.p.y) * 2.2 - S.v * slope, -4.5, 1.5), 5, h);
        S.bL = damp(S.bL, 0.3, 4, h); S.bR = damp(S.bR, 0.3, 4, h);
        if (S.p.y - g < C.flareAgl) { S.phase = 'flare'; S.t = 0; snd.sfx('flutter'); }
      } else if (S.phase === 'final') {
        S.v = damp(S.v, 6.6, 1.5, h); S.phi = damp(S.phi, 0, 3, h);
        S.vy = damp(S.vy, -1.6, 3, h);
        S.bL = damp(S.bL, 0.25, 4, h); S.bR = damp(S.bR, 0.25, 4, h);
        S.chkT -= h;
        if (S.chkT <= 0) {
          S.chkT = 0.15;
          // ушли туда, где не встать (край, обрыв), — летим дальше; препятствие впереди не страшно: перед ним остановимся и сядем
          const fx0 = Math.sin(S.psi), fz0 = Math.cos(S.psi), g1 = ground(S.p.x + fx0 * 2, S.p.z + fz0 * 2);
          if (S.p.y - g > 1.2 && ((walkable && !walkable(S.p.x, S.p.z)) || g1 < g - 0.6)) { S.phase = 'fly'; S.t = 0; S.chkT = 1.2; return; }
        }
        if (S.p.y - g < C.flareAgl) { S.phase = 'flare'; S.t = 0; snd.sfx('flutter'); }
      } else {
        S.flare = sst(0, 0.5, S.t);
        S.v = damp(S.v, 2.6, 2.6, h); S.phi = damp(S.phi, 0, 4, h);
        S.vy = damp(S.vy, S.auto ? -1.0 : -0.75, 4, h);
        S.bL = damp(S.bL, 1, 7, h); S.bR = damp(S.bR, 1, 7, h);
        if (S.p.y - g < 0.75) { S.sit = false; S.hang = damp(S.hang, 0, 6, h); }
      }
      S.vPrev = S.v;
      const fx = Math.sin(S.psi), fz = Math.cos(S.psi);
      const nx = S.p.x + (fx * S.v + wind.x * 0.5) * h, nz = S.p.z + (fz * S.v + wind.z * 0.5) * h, gn = ground(nx, nz), rn = grid.raw(nx, nz, 0);
      if (gn > S.p.y + 0.25 || (rn > gn + 0.45 && S.p.y < rn + 0.3)) {   // впереди выше ног (стена, прилавок) — не лезем
        S.v = Math.min(S.v, 0.5); S.blockT += h;
        // долго упираемся и ещё высоко — не тут: снова в полёт (авто-посадка зайдёт ещё раз); низко — садимся тут
        if (S.blockT > 0.6 && S.p.y - ground(S.p.x, S.p.z) > 0.5) { S.phase = 'fly'; S.t = 0; S.chkT = 1.5; S.v = Math.max(S.v, 6); S.vy = 1.5; S.sit = true; S.hang = 1; S.flare = 0; if (S.auto) S.apMode = 'toC'; return; }
        if (S.blockT > 0.6) S.vy = Math.min(S.vy, -1.2);
      } else { S.p.x = nx; S.p.z = nz; S.blockT = Math.max(0, S.blockT - h); }
      S.p.y += S.vy * h;
      S.legSpeed = S.sit ? 0 : Math.min(3.4, S.v * 0.9);
      const g2 = ground(S.p.x, S.p.z), rc = grid.raw(S.p.x, S.p.z, 0), onObj = rc > g2 + 0.45;
      S.agl = S.p.y - g2;
      if (onObj && S.p.y < rc + 0.1) { S.p.y = rc + 0.1; if (S.vy < 0) S.vy = 0; S.v = Math.max(S.v, 2.2); }   // под ногами что-то (прилавок, скамья) — не на него: дальше
      else if (S.p.y <= g2 + 0.01) {   // касание
        S.p.y = g2; S.phase = 'skid'; S.t = 0; S.gs = Math.max(1.5, Math.min(3.6, S.v * 0.85)); S.sit = false; S.hang = 0; S.vy = 0;
        puff(S.p.x, S.p.y + 0.05, S.p.z, 10, 0.5, 0); snd.sfx('pop'); say('touch');
        S.landed = { x: S.p.x, y: S.p.y, z: S.p.z, ry: S.psi, zone: S.zone ? S.zone.id : null };
        marker.visible = false;
      }
      integratePendulum(h);
    }
    function integratePendulum(h) { S.thetaV += (2.2 * 2.2 * (-0.18 * S.flare - S.theta) - 2 * 0.45 * 2.2 * S.thetaV) * h; S.theta = clamp(S.theta + S.thetaV * h, -0.35, 0.35); }
    function skid(h) {
      const gs0 = S.gs; S.gs = Math.max(0, S.gs - 3.6 * h);
      const fx = Math.sin(S.psi), fz = Math.cos(S.psi), nx = S.p.x + fx * S.gs * h, nz = S.p.z + fz * S.gs * h, ng = ground(nx, nz);
      if (Math.abs(ng - S.p.y) > 0.3 || (walkable && !walkable(nx, nz)) || grid.raw(nx, nz, 0) > ng + 0.4) S.gs = 0;
      else { S.p.x = nx; S.p.z = nz; S.p.y = ng; }
      S.legSpeed = S.gs; S.phi = damp(S.phi, 0, 5, h); S.theta = damp(S.theta, 0, 5, h); S.hang = 0;
      S.k = Math.max(0, S.k - h / 1.4); S.armW = Math.max(S.k, 0.3); S.bL = S.bR = 1;
      if (gs0 > 0.6 && Math.random() < h * 9) puff(S.p.x - fx * 0.2, S.p.y + 0.05, S.p.z - fz * 0.2, 1, 0.35, 0);
      if (S.gs <= 0 && S.t > 0.5) { S.phase = 'pack'; S.t = 0; S.landed.x = S.p.x; S.landed.y = S.p.y; S.landed.z = S.p.z; }
    }
    function finish() {
      S.phase = 'done'; S.t = 0; S.cheer = false;
      harness.visible = false; if (harness.parent) harness.parent.remove(harness);
      wing.visible = false; lines.visible = false; shadow.visible = false; streaks.visible = false; marker.visible = false;
      if (body) body.position.y = S.bodyY;
      if (S.mag) { S.mag.scale.setScalar(S.magScale || 1); S.mag = null; }
      if (root) { root.rotation.set(0, S.psi, 0); root.position.copy(S.p); root.updateMatrixWorld(true); }
      if (cam) { cam.up.set(0, 1, 0); if (Math.abs(cam.fov - S.fov0) > 0.01) { cam.fov = S.fov0; cam.updateProjectionMatrix(); } }
      snd.stop();
      if (!S.landed) S.landed = { x: S.p.x, y: S.p.y, z: S.p.z, ry: S.psi, zone: null };
      S.landed.ry = S.psi;
      emit('done', { landed: S.landed });
    }
    function startAuto(quiet, prefer) {
      if (!zonesDone) findZones();
      const z = pickZone(prefer); if (!z) return null;
      S.auto = true; S.zone = z; S.zoneT = prefer ? 1e9 : 4; S.apMode = ''; S.strongT = 0; S.cy = 0;
      marker.position.set(z.td.x, z.td.y + 0.07, z.td.z); marker.visible = true;
      if (!quiet) say('autoLand', { zone: z.id }, 4);
      return { id: z.id, label: z.label };
    }
    function land(prefer) {
      if (typeof prefer !== 'string') prefer = null;
      if (S.phase === 'fly') return startAuto(false, prefer);
      if (S.phase === 'prep' || S.phase === 'run' || S.phase === 'lift') { S.wantAuto = prefer || true; const z = pickZone(prefer); return z ? { id: z.id, label: z.label } : null; }
      return null;
    }
    function cancel() {
      if (S.phase === 'idle' || S.phase === 'done') return;
      const g = ground(S.p.x, S.p.z); S.p.y = fin(g) ? g : S.p.y;
      if (!S.landed) S.landed = { x: S.p.x, y: S.p.y, z: S.p.z, ry: S.psi, zone: null };
      finish();
    }

    /* --- поза героини: корень (курс, крен, маятник), HeroAnim, руки на клевантах / свободных концах --- */
    function pose(dt) {
      if (!root) return;
      eA.set(S.theta * S.hang, S.psi, S.phi * S.hang, 'YZX'); root.quaternion.setFromEuler(eA);
      root.position.copy(S.p); root.updateMatrixWorld(true);
      if (!anim) return;
      animSt.speed = S.legSpeed; animSt.sitting = S.sit; animSt.sitPose = 'recline'; animSt.idle = false; animSt.turnRate = 0; animSt.waving = false; animSt.celebrate = S.cheer; animSt.carry = false;
      anim.update(dt, animSt);
      root.updateMatrixWorld(true);
      if (!B) return;
      // ноги в подвеске чуть болтаются
      if (S.sit && B.thigh_L && B.thigh_R) { const s = Math.sin(S.time * 1.7) * 0.05 * S.hang; B.thigh_L.rotateX(s); B.thigh_R.rotateX(-s * 0.8); }
      // руки
      const w = S.armW;
      if (w > 0.001 && B.upperarm_L && B.upperarm_R) {
        B.upperarm_L.getWorldPosition(vA); root.worldToLocal(vA);
        B.upperarm_R.getWorldPosition(vB); root.worldToLocal(vB);
        const sy = (vA.y + vB.y) / 2, tw = S.togW;
        // на разбеге — свободные концы вверх-назад; в полёте — клеванты у головы, тормоз вниз
        hL.set(lerp(0.3, 0.2, tw), sy + lerp(0.32, 0.34 - 0.58 * S.bL, tw), lerp(-0.2, 0.12 + 0.06 * S.bL, tw));
        hR.set(lerp(-0.3, -0.2, tw), sy + lerp(0.32, 0.34 - 0.58 * S.bR, tw), lerp(-0.2, 0.12 + 0.06 * S.bR, tw));
        root.localToWorld(hL); root.localToWorld(hR);
        vC.set(1, -0.7, -0.4).applyQuaternion(root.quaternion); armIK('L', hL, vC, w);
        vD.set(-1, -0.7, -0.4).applyQuaternion(root.quaternion); armIK('R', hR, vD, w);
      }
      // голова — в поворот и вперёд; волосы — по ветру
      if (B.head) { B.head.rotateY(-S.phi * 0.7 * S.hang); B.head.rotateX(0.12 * S.hang); }
      if (B.hair) B.hair.rotateX(-clamp(S.v / 12, 0, 1) * 0.16 * S.hang);
      root.updateMatrixWorld(true);
    }

    /* --- крыло и стропы --- */
    let o6 = 0;
    function seg(a, b) { linePos[o6] = a.x; linePos[o6 + 1] = a.y; linePos[o6 + 2] = a.z; linePos[o6 + 3] = b.x; linePos[o6 + 4] = b.y; linePos[o6 + 5] = b.z; o6 += 6; }
    function rig() {
      const k = S.k, show = (S.phase !== 'idle' && S.phase !== 'done' && S.phase !== 'landed');
      wing.visible = show; lines.visible = show && k > 0.12;
      if (!show) return;
      // карабины (на груди) — от кости; без скелета — от корня
      if (B && B.chest) { carL.set(0.155, -0.07, 0.055); B.chest.localToWorld(carL); carR.set(-0.155, -0.07, 0.055); B.chest.localToWorld(carR); }
      else { carL.set(0.16, 1.05, 0.06); root.localToWorld(carL); carR.set(-0.16, 1.05, 0.06); root.localToWorld(carR); }
      mid.addVectors(carL, carR).multiplyScalar(0.5);
      const e = S.phase === 'skid' || S.phase === 'pack' ? k * k : easeOut(k), Lw = lerp(0.45, C.lineL, e), beta = lerp(1.35, 0, e) + 0.12 * S.flare;   // складывается быстрее, чем раскрывается
      qW.copy(root.quaternion).multiply(qA.setFromAxisAngle(AXX, -beta));
      if (S.phase === 'fly') { qB.setFromAxisAngle(vE.set(0, 0, 1), Math.sin(S.time * 2.3) * 0.015 + Math.sin(S.time * 0.9) * 0.01); qW.multiply(qB); }
      up.set(0, 1, 0).applyQuaternion(qW);
      wing.position.copy(mid).addScaledVector(up, Lw);
      if (k < 0.999) wing.position.addScaledVector(vE.set(0, 0, -1).applyQuaternion(root.quaternion), 0.25 * (1 - e));
      wing.quaternion.copy(qW);
      const fold = 1 - 0.1 * clamp(S.earsS / 2, 0, 1);
      wing.scale.set(lerp(0.12, 1, e) * fold, lerp(0.3, 1, e), lerp(0.25, 1, e));
      wing.updateMatrixWorld(true);
      if (!lines.visible) return;
      // клеванты: точка хвата в кулаке
      if (B && B.hand_L) { hL.set(0.004, -0.07, 0.012); B.hand_L.localToWorld(hL); hR.set(-0.004, -0.07, 0.012); B.hand_R.localToWorld(hR); }
      else { hL.copy(carL); hR.copy(carR); }
      // свободные концы: от карабина на 0,45 м вверх по стропам
      vA.copy(carL).addScaledVector(up, 0.45); vB.copy(carR).addScaledVector(up, 0.45);
      o6 = 0;
      for (let i = 0; i < WG.att.length; i++) { const a = WG.att[i]; vC.copy(a.p).applyMatrix4(wing.matrixWorld); seg(a.side > 0 ? vA : vB, vC); }
      seg(carL, vA); seg(carR, vB);
      knotL.copy(hL).addScaledVector(up, 1.1); knotR.copy(hR).addScaledVector(up, 1.1);
      for (let i = 0; i < WG.brk.length; i++) { const a = WG.brk[i]; vC.copy(a.p).applyMatrix4(wing.matrixWorld); seg(a.side > 0 ? knotL : knotR, vC); }
      seg(hL, knotL); seg(hR, knotR);
      lineGeo.attributes.position.needsUpdate = true;
    }

    /* --- камера: на разбеге — сбоку-спереди, в полёте — сзади-сверху с креном, на посадке — ниже и шире --- */
    function camera(dt) {
      if (!cam || !root) return;
      const ph = S.phase;
      const mode = ph === 'prep' || ph === 'run' || ph === 'lift' ? 'launch' : ph === 'fly' ? 'chase' : ph === 'final' || ph === 'flare' ? 'land' : 'ground';
      if (mode !== S.camMode) { S.camMode = mode; S.camW = 0; }
      S.camW = Math.min(1, (S.camW || 0) + dt / 2.2);
      const fx = Math.sin(S.psi), fz = Math.cos(S.psi), lx = Math.cos(S.psi), lz = -Math.sin(S.psi);   // вперёд и влево
      up.set(0, 1, 0).applyQuaternion(root.quaternion);
      focus.copy(S.p).addScaledVector(up, mode === 'chase' ? 1.6 : 1.3);
      if (mode === 'launch') {   // сбоку, чуть спереди: видно, как крыло встаёт над головой
        offWant.set(fx * 3.0 - lx * 7.6, 1.9, fz * 3.0 - lz * 7.6);
        lookWant.set(fx * 0.4, 1.5, fz * 0.4);
      } else if (mode === 'chase') {   // сзади на три четверти, чуть выше головы; в повороте — чуть снаружи
        const side = 2.0 - S.phi * 3.0;
        offWant.set(-fx * 7.6 + lx * side, 0.9, -fz * 7.6 + lz * side);
        lookWant.set(fx * 5, -0.35, fz * 5);
      } else if (mode === 'land') {
        offWant.set(-fx * 7.6 - lx * 2.6, 2.4, -fz * 7.6 - lz * 2.6);
        lookWant.set(fx * 3, -0.2, fz * 3);
      } else {   // на земле — сбоку-спереди: видно лицо и как складывается крыло за спиной
        offWant.set(fx * 2.6 - lx * 6.6, 0.9, fz * 2.6 - lz * 6.6);
        lookWant.set(-fx * 0.4, -0.15, -fz * 0.4);
      }
      if (!S.camInit) { offCur.copy(offWant); lookCur.copy(lookWant); S.camInit = true; if (cam.position.distanceTo(focus) < 60) { offCur.copy(cam.position).sub(focus); } }
      const kk = 1 - Math.exp(-dt * (1.6 + 1.6 * S.camW));
      offCur.lerp(offWant, kk); lookCur.lerp(lookWant, Math.min(1, kk * 1.4));
      camPos.copy(focus).add(offCur); camLook.copy(focus).add(lookCur);
      const gt = topAt(camPos.x, camPos.z) + 1.1; if (camPos.y < gt) camPos.y = gt;   // gt — верх препятствий под камерой + 1,1
      // луч региона «не в стену» — дорогой (новые объекты на каждый вызов): только у препятствий и не каждый кадр
      if (rayHit && (camPos.y - gt < 4 || S.agl < 7)) {
        S.camRayN = (S.camRayN || 0) + 1;
        if (S.camRayN % 3 === 1 || S.camRayT < 1) S.camRayT = rayHit(focus, camPos);
        const t = S.camRayT;
        if (t < 1) { camPos.lerpVectors(focus, camPos, Math.max(0.2, t - 0.06)); const g2 = topAt(camPos.x, camPos.z) + 0.8; if (camPos.y < g2) camPos.y = g2; }
      } else S.camRayT = 1;
      cam.position.copy(camPos);
      // крен камеры — треть крена крыла
      const roll = mode === 'chase' ? S.phi * 0.32 : 0;
      vA.copy(camLook).sub(camPos).normalize(); vB.crossVectors(vA, UPV).normalize();   // вправо от взгляда
      camUp.set(0, 1, 0).multiplyScalar(Math.cos(roll)).addScaledVector(vB, Math.sin(roll));
      cam.up.lerp(camUp, Math.min(1, dt * 4)).normalize();
      cam.lookAt(camLook);
      const fovT = mode === 'chase' ? (cam.aspect < 0.8 ? 64 : 54) + clamp((S.v - C.trim) * 1.2, -2, 4) : (cam.aspect < 0.8 ? 58 : 50);
      if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix(); }
    }

    /* --- птицы, пух, пыль, ветер-штрихи, тень, кольцо --- */
    function puff(x, y, z, n, s, kind) {   // kind: 0 — пыль, 1 — искорки (сложили крыло)
      for (let k = 0, m = 0; k < dust.length && m < n; k++) {
        const d = dust[k]; if (d.life > 0) continue;
        const a = Math.random() * TAU, sp = 0.6 + Math.random() * 1.2;
        d.life = 1; d.x = x; d.y = y; d.z = z; d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 0.4 + Math.random() * 0.8; d.s = s * (0.7 + Math.random() * 0.6); d.c = kind; m++;
      }
    }
    function ambient(dt) {
      // птицы
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i], t = b.t; b.a += b.w * dt * 0.45 * (8 / Math.max(4, b.r)); b.ph += dt * (5 + i % 3);
        const cx = t.x + Math.sin(b.a) * b.r, cz = t.z + Math.cos(b.a) * b.r, cy = t.top + b.dy + Math.sin(S.time * 0.4 + i) * 0.6;
        const hx = Math.cos(b.a) * Math.sign(b.w), hz = -Math.sin(b.a) * Math.sign(b.w);   // по касательной
        const sx = -hz, sz = hx, flap = Math.sin(b.ph) * 0.35, span = 0.75, o18 = i * 18;
        const nx = cx + hx * 0.32, nz = cz + hz * 0.32, tx = cx - hx * 0.28, tz = cz - hz * 0.28;
        birdPos[o18] = nx; birdPos[o18 + 1] = cy; birdPos[o18 + 2] = nz;
        birdPos[o18 + 3] = cx + sx * span; birdPos[o18 + 4] = cy + flap; birdPos[o18 + 5] = cz + sz * span;
        birdPos[o18 + 6] = tx; birdPos[o18 + 7] = cy; birdPos[o18 + 8] = tz;
        birdPos[o18 + 9] = nx; birdPos[o18 + 10] = cy; birdPos[o18 + 11] = nz;
        birdPos[o18 + 12] = tx; birdPos[o18 + 13] = cy; birdPos[o18 + 14] = tz;
        birdPos[o18 + 15] = cx - sx * span; birdPos[o18 + 16] = cy + flap; birdPos[o18 + 17] = cz - sz * span;
      }
      if (birds.length) birdGeo.attributes.position.needsUpdate = true;
      // пух: поднимается спиралью в верхней части потока
      for (let i = 0; i < fluff.length; i++) {
        const f = fluff[i], t = f.t, bot = Math.max(t.gy + 4, t.top - 28), H = t.top - bot;
        f.h += dt * f.sp * 0.9 / Math.max(10, H); if (f.h > 1) { f.h -= 1; f.a = Math.random() * TAU; f.r = Math.sqrt(Math.random()) * t.r * 0.8; }
        f.a += dt * 0.35;
        const x = t.x + Math.sin(f.a) * f.r, z = t.z + Math.cos(f.a) * f.r, y = bot + f.h * H, q = i * 3, c = i * 4;
        pPos[q] = x; pPos[q + 1] = y; pPos[q + 2] = z;
        const a = Math.min(1, f.h * 6, (1 - f.h) * 5) * 0.8;
        pCol[c] = 1; pCol[c + 1] = 0.94; pCol[c + 2] = 0.78; pCol[c + 3] = a * 0.7; pSize[i] = 0.36;
      }
      // пыль
      for (let k = 0; k < dust.length; k++) {
        const d = dust[k], i = NF + k, q = i * 3, c = i * 4;
        if (d.life > 0) {
          d.life -= dt / (d.c ? 0.8 : 1.0); d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vx *= 0.94; d.vz *= 0.94; d.vy *= 0.95;
          pPos[q] = d.x; pPos[q + 1] = d.y; pPos[q + 2] = d.z;
          if (d.c) { pCol[c] = 1; pCol[c + 1] = 0.86; pCol[c + 2] = 0.92; } else { pCol[c] = 0.86; pCol[c + 1] = 0.78; pCol[c + 2] = 0.66; }
          pCol[c + 3] = Math.max(0, d.life) * 0.7; pSize[i] = d.s * (1.6 - d.life * 0.8);
        } else { pCol[c + 3] = 0; pSize[i] = 0; }
      }
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.rgba.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
      const hh = o.renderer && o.renderer.domElement ? o.renderer.domElement.height / 2 : (window.innerHeight || 844) * Math.min(window.devicePixelRatio || 1, 2) / 2;
      pMat.uniforms.halfH.value = hh;
    }
    function fx(dt) {
      // тень
      const flying = S.phase !== 'idle' && S.phase !== 'done';
      if (flying && root) {
        const sy = surf(S.p.x, S.p.z), a = S.p.y - sy;
        shadow.visible = a < 28;
        if (shadow.visible) { const s = 1.1 + a * 0.05; shadow.position.set(S.p.x, sy + 0.06, S.p.z); shadow.scale.set(s, s * 0.7, 1); shadow.rotation.z = S.psi; shadow.material.opacity = clamp(1 - a / 28, 0, 1); }
      } else shadow.visible = false;
      // кольцо площадки
      if (marker.visible) { const s = 1 + Math.sin(S.time * 4) * 0.08; marker.scale.set(s, s, s); }
      // ветер-штрихи
      const k = S.phase === 'fly' ? clamp((S.v - 9.5) / 2.5 + Math.max(0, -S.vy - 1.5) * 0.3, 0, 1) : 0;
      sMat.opacity += (k * 0.5 - sMat.opacity) * Math.min(1, dt * 3); streaks.visible = sMat.opacity > 0.02 && !!cam;
      if (streaks.visible) {
        const c = cam.position, fx2 = Math.sin(S.psi), fz2 = Math.cos(S.psi), sx = Math.cos(S.psi), sz = -Math.sin(S.psi);
        for (let i = 0; i < NS; i++) {
          const w = sSeed[i]; w.k -= dt * (S.v + 6) / 24; if (w.k < 0) { w.k += 1; w.a = Math.random() * TAU; w.r = 1.4 + Math.random() * 4.5; w.y = (Math.random() - 0.5) * 3.5; }
          const along = (w.k - 0.25) * 24, x = c.x + fx2 * along + sx * Math.cos(w.a) * w.r, y = c.y + w.y + Math.sin(w.a) * w.r * 0.4, z = c.z + fz2 * along + sz * Math.cos(w.a) * w.r, q = i * 6;
          sPos[q] = x; sPos[q + 1] = y; sPos[q + 2] = z; sPos[q + 3] = x - fx2 * w.l; sPos[q + 4] = y; sPos[q + 5] = z - fz2 * w.l;
        }
        sGeo.attributes.position.needsUpdate = true;
      }
      // звук ветра
      if (snd.on()) snd.set(S.phase === 'fly' || S.phase === 'final' ? 0.025 + 0.07 * clamp((S.v - 6) / 6, 0, 1) + 0.03 * clamp(-S.vy / 3, 0, 1) : S.phase === 'lift' ? 0.03 : 0.006, S.v);
    }

    function readState() {
      st.phase = S.phase; st.active = S.phase !== 'idle' && S.phase !== 'done'; st.t = S.t;
      st.x = S.p.x; st.y = S.p.y; st.z = S.p.z; st.heading = S.psi; st.bank = S.phi; st.speed = S.v; st.vy = S.vy; st.agl = S.agl;
      st.lift = S.lift; st.thermal = S.thermalK; st.danger = S.danger; st.auto = S.auto; st.zone = S.zone ? S.zone.id : null; st.landed = S.landed;
      st.clamped = S.clamped; st.bounce = S.bounce; st.minAgl = S.minAgl; st.apMode = S.apMode; st.k = S.k;
      if (st.active) {   // строка вариометра — только когда изменились округлённые числа
        const vy10 = Math.round(S.vy * 10), ag = Math.max(0, Math.round(S.agl));
        if (vy10 !== S.hudVy || ag !== S.hudAg || !st.hud) { S.hudVy = vy10; S.hudAg = ag; st.hud = (vy10 >= 0 ? '↑ ' : '↓ ') + (Math.abs(vy10) / 10).toFixed(1).replace('.', ',') + ' м/с · ' + ag + ' м'; }
      } else st.hud = '';
      return st;
    }

    let lastGood = new T.Vector3();
    function update(dt, input) {
      dt = clamp(+dt || 0, 0, 0.1);
      S.time += dt;
      if (!grid.ready()) grid.step(S.phase === 'idle' || S.phase === 'done' ? (o.prepMs || 3) : 1e9);
      else if (!zonesDone) zoneStep();
      ambient(dt);
      if (S.phase === 'idle' || S.phase === 'done') return readState();
      S.inX = input && fin(input.x) ? clamp(input.x, -1, 1) : 0; S.inY = input && fin(input.y) ? clamp(input.y, -1, 1) : 0;
      if (input && input.land) land();
      let rem = dt;
      while (rem > 1e-6 && S.phase !== 'done') { const h = Math.min(rem, 1 / 60); step(h); rem -= h; }
      if (S.phase === 'done') return readState();
      // страховка от NaN: вернуть последнюю хорошую точку
      if (!fin(S.p.x) || !fin(S.p.y) || !fin(S.p.z) || !fin(S.v) || !fin(S.vy) || !fin(S.psi)) { S.p.copy(lastGood); S.v = C.trim; S.vy = 0; S.phi = 0; S.theta = 0; S.thetaV = 0; if (!fin(S.psi)) S.psi = 0; S.nanFix++; } else lastGood.copy(S.p);
      pose(dt); rig(); camera(dt); fx(dt);
      return readState();
    }

    // снова вручную (кнопка «Сама порулю»)
    function manual() { if (!S.auto) return false; S.auto = false; S.zone = null; S.apMode = ''; marker.visible = false; say('autoCancel', null, 3); return true; }
    const api = {
      takeoff, update, land, cancel, manual,
      active: () => S.phase !== 'idle' && S.phase !== 'done',
      state: readState,
      ready: () => grid.ready(),
      // карта высот заново (например, после h.setBazaar(…)): по кусочку в update; площадки — тоже заново
      refresh() { if (S.phase !== 'idle' && S.phase !== 'done') return false; grid = makeGrid(); zonesDone = false; zoneI = 0; zc = null; zones.forEach(z => { z.td = null; z.ok = false; z.appr = null; }); return true; },
      prepare: ms => { const t0 = performance.now(); ms = ms || 4; if (!grid.ready()) grid.step(ms); else while (!zonesDone && performance.now() - t0 < ms) zoneStep(); return grid.ready() && zonesDone ? 1 : Math.min(0.99, grid.progress()); },
      zones, launches, thermals, spots: o.spots || [], LINES, LABELS, cfg: C,
      get landed() { return S.landed; },
      debug: {
        top: topAt, surf, landable: (x, z, ry) => landable(x, z, ry, fin(ry) ? 6 : false), grid: () => grid.info(), S, lift: liftAt, sound: () => snd.on(),
        meshes: { wing, lines, harness, birds: birdMesh, points, streaks, shadow, marker, socks },
        calls: () => { let n = 0; fxGroup.traverse(m => { if ((m.isMesh || m.isLine || m.isPoints) && m.visible) { let v = true; for (let p = m; p; p = p.parent) if (!p.visible) v = false; if (v) n++; } }); if (harness && harness.parent && harness.visible) n++; return n; },
      },
      dispose() {
        if (S.phase !== 'idle' && S.phase !== 'done') cancel();
        snd.stop();
        if (harness && harness.parent) harness.parent.remove(harness);
        if (fxGroup.parent) fxGroup.parent.remove(fxGroup);
        trash.forEach(x => { try { x.dispose(); } catch (e) { /* ok */ } });
        trash.length = 0;
      },
    };
    return api;
  }

  /* =====================================================================
     ПРЕСЕТ ДЛЯ СЕЛА (регион kubachi): старты, площадки, потоки, ветер, граница, места
     ===================================================================== */
  function kubachi(h, opt = {}) {
    const P = (h && h.places) || {};
    const TW = P.tower || { x: -11.18, z: -15.44, floor: 16.9, rT: 3.4, merlonTop: 18.1 };
    const KN = P.knoll || { x: -43.84, z: 29.08, y: -12, r: 3.6 };
    const PARK = P.park || { x: 26.74, z: -4.5 };
    const WED = P.wedding && P.wedding.out ? P.wedding.out : { x: 18.9, z: -27.75, w: 25, d: 18.5 };
    const ground = h && h.ground ? h.ground : () => 0;
    // уступ: разбег туда, где склон уходит вниз круче всего (в южную половину — к лугу)
    let kry = 0.75;
    { let best = -1e9; for (let a = -0.4; a <= 1.9; a += 0.1) { const d = ground(KN.x + Math.sin(a) * 6, KN.z + Math.cos(a) * 6) - ground(KN.x + Math.sin(a) * 11, KN.z + Math.cos(a) * 11) + (ground(KN.x, KN.z) - ground(KN.x + Math.sin(a) * 6, KN.z + Math.cos(a) * 6)); if (d > best) { best = d; kry = a; } } }
    // скамья на уступе — в центре; разбег чуть в стороне от неё
    const kside = { x: Math.cos(kry), z: -Math.sin(kry) };
    if (KN.bench) { const bx = KN.bench[0] - KN.x, bz = KN.bench[2] - KN.z; if (bx * kside.x + bz * kside.z > 0) { kside.x = -kside.x; kside.z = -kside.z; } }
    const launches = {
      tower: { id: 'tower', label: 'С башни', x: TW.x - 0.35, y: TW.floor, z: TW.z - 2.15, ry: 0, run: 2.5, lift: 2.4, level: 'top',
        sock: { x: TW.x + 1.6, y: TW.floor + 0.64, z: TW.z - 2.75, h: 1.4 } },
      knoll: { id: 'knoll', label: 'С уступа', x: KN.x - Math.sin(kry) * 1.6 + kside.x * 1.1, y: KN.y, z: KN.z - Math.cos(kry) * 1.6 + kside.z * 1.1, ry: kry, run: 2.9, lift: 1.2, level: 'ground',
        sock: { x: KN.x - kside.x * 2.4, y: ground(KN.x - kside.x * 2.4, KN.z - kside.z * 2.4), z: KN.z - kside.z * 2.4, h: 1.7 } },
    };
    const zones = [
      { id: 'square', label: 'Площадь', x: 11, z: -4, r: 8 },
      { id: 'crest', label: 'Поляна на гребне', x: -36, z: 3, r: 6 },
      { id: 'east', label: 'Край села у дороги', x: 56, z: 2, r: 5 },
      { id: 'roof', label: 'Крыша-терраса', x: -20.3, z: 5.24, r: 3 },
      { id: 'knoll', label: 'Западный уступ', x: KN.x, z: KN.z, r: 3 },
      { id: 'meadow', label: 'Луг', x: -24, z: 46, r: 6 },
      { id: 'terraces', label: 'Террасы-сенокосы', x: -18, z: 52, r: 5 },
    ];
    const thermals = [
      { id: 'roofs', x: 2, z: 30, r: 15, w: 2.8, top: 42 },
      { id: 'meadow', x: -22, z: 50, r: 15, w: 3.0, top: 38 },
      { id: 'east', x: 36, z: 24, r: 13, w: 2.5, top: 38 },
    ];
    const noLand = [{ x: TW.x, z: TW.z, r: 5.5 }, { x: PARK.x, z: PARK.z, r: 5 }, { x: WED.x, z: WED.z, r: Math.max(WED.w, WED.d) / 2 + 1 }];
    const exclude = (h && h.npcs ? h.npcs.map(n => n.root) : []);
    const colliders = h && h.colliders ? h.colliders.filter(c => c && c.id !== 'edge') : [];
    // толпа большого базара видна только при камере рядом — считаем её и скрытой, если сегодня большой базар
    const include = m => /crowd/.test(m.name || '') && !!(h && h.bazaar && h.bazaar.big) && !m.isSkinnedMesh;
    const spots = [
      { id: 'fly_tower', level: 'top', x: TW.x - 1.2, y: TW.floor, z: TW.z - 1.4, r: 1.0, icon: '🪂', label: LABELS.spot, action: LABELS.action,
        use: () => ({ id: 'fly_tower', kind: 'fly', from: 'tower', text: 'Крыло в рюкзачке, ветер с долины — можно лететь!' }) },
      { id: 'fly_knoll', level: 'ground', x: KN.x - kside.x * 1.6, y: KN.y, z: KN.z - kside.z * 1.6, r: 1.3, icon: '🪂', label: LABELS.spot, action: LABELS.action,
        use: () => ({ id: 'fly_knoll', kind: 'fly', from: 'knoll', text: 'Отсюда видно весь луг. Полетели?' }) },
    ];
    return Object.assign({
      ground, walkable: h && h.walkable, rayHit: h && h.rayHit, root: h && h.root, exclude, include, colliders, npcs: h && h.npcs,
      launches, zones, thermals, noLand, spots,
      wind: { x: 0, z: -1.6 },
      bounds: { x: 2, z: 30, r: 78, rMax: 96, ceil: 48 },
    }, opt);
  }

  V.paraglider = { create, kubachi, LINES, LABELS, DEF, version: 1 };
})();
