/* =====================================================================
   ОБРАЗЫ 3D-ГЕРОИНИ: шесть нарядов из роликов (js/hero_looks.js) на модели автора (js/hero3d.js).
   Лицо — пиксели и вершины автора, не трогаем никогда. Меняются одежда, обувь, украшения и причёска.
   Слои (всё на общей сетке героини: улица, комнаты, горы, руки Interact, руки вида из-за руля видят то же):
     L0 зоны вершин — js/hero_zones.js (tools/hero_zones.py): лицо, волосы, берет, бант, тренч, рукав, пояс…
     L1 текстура — перекраска по зонам: цвет — функция точки модели (полосы, вырезы, «северное сияние», цветы),
        объём и складки — сглаженная яркость автора внутри зоны (пуговицы и строчки тренча стираются).
        Исходная картинка — в HeroLook3D.setSource: каз и лупа Interact ищут по авторским цветам.
     L2 маска — вырожденные треугольники в общем индексе (смещения треугольников те же: каз и шалость с беретом
        продолжают работать); трогаем только свои треугольники.
     L3 перелепка — позиции и нормали общих буферов (купол волос вместо берета, локоны, гладкая причёска,
        подол выше или ниже, плоский пояс и пуговицы, рукава-«фонарики» и «крылья», ворот-гольф).
     L4 одежда — одна SkinnedMesh на героиню (тот же скелет): брюки, юбки, накидка, голенища, пучок, серьги,
        очки, жемчуг, сумочка; контур — вывернутая оболочка в той же сетке. +1 вызов отрисовки.
     Изнанка: материал одежды двусторонний (изнанка — цвет ткани темнее, оболочка контура — только лицевыми гранями);
        материал героини двусторонний, пока надет образ (heroBack): подол снизу, лацканы, распах — тканью, а не контуром.
   HeroOutfits.set(H3, hero, id) — образ целиком (apply + dress); id null — авторский тренч.
   HeroOutfits.apply(H3, id) -> { ok, id, ms } — общие текстура, маска и форма; повтор того же образа — даром.
   HeroOutfits.dress(hero, id) — одежда этой героини (у города и у комнаты — своя сетка, геометрия общая).
   HeroOutfits.update(hero, dt, s) — раз в кадр после HeroAnim/Interact/каза; s = { drive, bike, sit, sport, fly, zip }:
     сумочка прячется в транспорте, спорте, полёте и сидя; длинный подол подбирается; под казом — без серёг и очков.
   HeroOutfits.setQuality(q) — 'low'/'lite': одежда без оболочки контура (бюджет сцен q=low ≤ 200 тыс. треугольников).
   HeroOutfits.current(H3), headTop(id), hatLift(id) -> { y, s } (шапка поверх волос), hasHat(id) (берета нет — false),
     hairColor(id) (шапочка под казом), stats() -> { tris, calls, ms, hidden, morphed }.
   Ошибка — образ откатывается к перекрашенному тренчу (HeroLook3D.apply со старыми цветами образа).
   Координаты — метры модели: ноги на y = 0, лицом к +Z, +x — левая сторона героини (свободная рука), −x — правая (лупа).
   ===================================================================== */
(function () {
  'use strict';
  const IDS = ['aurora', 'suede', 'pink', 'rust', 'cream', 'floral'];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix3 = (a, b, k, o) => { o = o || [0, 0, 0]; o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; return o; };
  const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
  // свет города тёплый (рампа GRAD3 + небо + солнце + контровой): экран ≈ текстура × LITC по каналам
  // (замер: белый → 255/225/208, серый 80 → 138/118/108) — тёмные и средние цвета роликов делим на LITC.
  // Светлые цвета (белый, слоновая кость, пастель) — без потери яркости и почти без поправки оттенка: иначе в тёплом
  // свете они серые, а в холодном (комнаты, дождь, горы) — мятные. Тёплый или нейтральный исходник остаётся тёплым
  // (R ≥ G ≥ B): слоновая кость не уходит в зелень и голубизну ни при каком свете.
  const LITC = [1.22, 1.045, 0.965];
  function corr(r, g, b, o) {
    const L = luma(r, g, b), k = sst(150, 235, L), s = 1 - 0.9 * k;
    let R = r / (1 + (LITC[0] - 1) * s), G = g / (1 + (LITC[1] - 1) * s), B = b / (1 + (LITC[2] - 1) * s);
    const Lc = luma(R, G, B), f = Lc > 1 ? (Lc + (L - Lc) * k) / Lc : 1;
    R *= f; G *= f; B *= f;
    if (k > 0 && r >= g && g >= b) { if (G > R) G = R; if (B > G) B = G; }
    o = o || [0, 0, 0];
    o[0] = Math.min(255, R); o[1] = Math.min(255, G); o[2] = Math.min(255, B);
    return o;
  }
  const tc = h => { const c = hex(h); return corr(c[0], c[1], c[2]); };
  const stats = { tris: 0, calls: 0, ms: 0, hidden: 0, morphed: 0, paintMs: 0, prepMs: 0, garmentTris: 0, id: null, err: null };

  /* ---------- зоны ---------- */
  let ZN = null;
  const Z = {};
  function zones() {
    if (ZN) return ZN;
    const H = window.HERO_ZONES;
    if (!H || !H.b64) return null;
    const bin = atob(H.b64), n = bin.length, u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    H.names.forEach((nm, i) => { Z[nm] = i; });
    ZN = u;
    return ZN;
  }
  const RB = () => (window.HERO3D && HERO3D.rig && HERO3D.rig.bones) || [];
  const boneIdx = n => RB().findIndex(b => b[0] === n);
  const J = n => { const b = RB().find(q => q[0] === n); return b ? b[2] : [0, 0, 0]; };

  /* ---------- состояние на модель (H3 из HERO3D.load: одна на сессию) ---------- */
  const ST = new WeakMap();
  // последняя подготовленная модель (одна на сессию): одежда, подогнанная по лицу (гладкая причёска), читает её точки
  let LASTST = null;
  function prep(H3) {
    if (!H3 || !H3.geometry || !H3.map) return null;
    if (ST.has(H3)) return ST.get(H3);
    let st = null;
    try {
      const t0 = performance.now();
      const zn = zones(), geo = H3.geometry, P = geo.attributes.position, n = P.count;
      if (!zn || zn.length !== n || !geo.index || !geo.attributes.uv || !geo.attributes.normal) throw new Error('zones mismatch');
      const map = H3.map, src = (window.HeroLook3D && HeroLook3D.source ? HeroLook3D.source(map) : null) || map.image;
      const W = src && (src.naturalWidth || src.width), H = src && (src.naturalHeight || src.height);
      if (!W || !H || typeof document === 'undefined') throw new Error('no texture');
      // исходная картинка — в реестр (каз и лупа ищут берет и латунь по авторским цветам)
      if (window.HeroLook3D && HeroLook3D.setSource) HeroLook3D.setSource(map, src);
      const I0 = geo.index.array.slice(), nt = I0.length / 3;
      st = { H3, geo, map, src, W, H, n, nt, zn, I0, P0: P.array.slice(), N0: geo.attributes.normal.array.slice(), id: null, ours: new Uint8Array(nt), hidden: 0, morphed: 0, cv: null, cx: null };
      // зона треугольника — большинством вершин
      const tz = new Uint8Array(nt);
      for (let t = 0; t < nt; t++) { const a = zn[I0[t * 3]], b = zn[I0[t * 3 + 1]], c = zn[I0[t * 3 + 2]]; tz[t] = a === b || a === c ? a : b === c ? b : a; }
      st.tz = tz;
      // лицо, уши и лупа не прячутся, не двигаются и не перекрашиваются ни одним образом
      st.prot = new Uint8Array(32); [Z.face, Z.ears, Z.mag].forEach(z => { if (z !== undefined) st.prot[z] = 1; });
      // вершина -> треугольники (CSR) и «сварка» совпадающих точек (швы UV): нормали и контур без щелей
      const deg = new Uint32Array(n + 1);
      for (let k = 0; k < I0.length; k++) deg[I0[k] + 1]++;
      for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
      const vt = new Uint32Array(I0.length), fill = deg.slice(0, n);
      for (let k = 0; k < I0.length; k++) vt[fill[I0[k]]++] = (k / 3) | 0;
      st.vo = deg; st.vt = vt;
      const wmap = new Map(), wid = new Int32Array(n);
      let ng = 0;
      for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 2e3) + ',' + Math.round(P.getY(i) * 2e3) + ',' + Math.round(P.getZ(i) * 2e3); let g = wmap.get(k); if (g === undefined) { g = ng++; wmap.set(k, g); } wid[i] = g; }
      st.wid = wid; st.ng = ng;
      texPrep(st);
      stats.prepMs = Math.round(performance.now() - t0);
    } catch (e) { console.warn('hero outfits', e); stats.err = String(e && e.message || e); st = null; }
    ST.set(H3, st);
    if (st) LASTST = st;
    return st;
  }

  /* ---------- растр текстуры: зона каждого текселя, яркость автора и её сглаженная версия внутри «семьи» зон ---------- */
  function texPrep(st) {
    const { W, H, geo, I0, tz } = st, uv = geo.attributes.uv, N = W * H;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(st.src, 0, 0, W, H);
    const orig = cx.getImageData(0, 0, W, H).data.slice();
    const zr = new Uint8Array(N);
    rasterTris(st, null, (k, t) => { zr[k] = tz[t] + 1; });
    // тексели лица, ушей и лупы (с полями островов) — неприкосновенны
    const pk = new Uint8Array(N);
    rasterTris(st, t => !!st.prot[tz[t]], k => { pk[k] = 1; });
    const L = new Uint8Array(N);
    for (let k = 0; k < N; k++) L[k] = Math.round(luma(orig[k * 4], orig[k * 4 + 1], orig[k * 4 + 2]));
    // семьи зон для сглаживания (соседние острова атласа часто чужие — их яркость не подмешиваем)
    const fam = new Uint8Array(32);
    ['collar', 'coat_torso', 'coat_skirt', 'sleeve', 'cuff', 'belt', 'buttons'].forEach(n => { fam[Z[n] + 1] = 1; });
    // пояс и пуговицы в объём ткани не подмешиваем (иначе на новом крое — «призраки» пуговиц), сами берут объём соседей
    const noMix = new Uint8Array(32); noMix[Z.belt + 1] = noMix[Z.buttons + 1] = 1;
    ['hair_skull', 'hair_back'].forEach(n => { fam[Z[n] + 1] = 2; });
    ['face', 'ears', 'neck', 'hands'].forEach(n => { fam[Z[n] + 1] = 3; });
    ['legs', 'shoes'].forEach(n => { fam[Z[n] + 1] = 4; });
    ['beret', 'bow'].forEach(n => { fam[Z[n] + 1] = 5; });
    // сглаживание — на сетке вдвое реже (2×2 текселя в ячейку, радиус 4 ≈ 7 текселей): втрое быстрее, объём тот же
    const Lb = new Uint8Array(N), W2 = W >> 1, H2 = H >> 1, N2 = W2 * H2, R = 4;
    const num = new Float32Array(N2), den = new Float32Array(N2), tmpN = new Float32Array(N2), tmpD = new Float32Array(N2);
    // сглаживаем только то, что перекрашивается с объёмом автора: тренч, волосы, колготки (кожа и берет — как есть)
    for (let k = 0; k < N; k++) Lb[k] = L[k];
    for (let f = 1; f <= 4; f++) {
      if (f === 3) continue;
      num.fill(0); den.fill(0);
      for (let y = 0; y < H2 * 2; y++) {
        const o = y * W, o2 = (y >> 1) * W2;
        for (let x = 0; x < W2 * 2; x++) { const k = o + x, z = zr[k]; if (fam[z] === f && !noMix[z]) { const j = o2 + (x >> 1); num[j] += L[k]; den[j] += 1; } }
      }
      boxBlur(num, tmpN, W2, H2, R); boxBlur(den, tmpD, W2, H2, R);
      for (let y = 0; y < H; y++) {
        const o = y * W, o2 = Math.min(H2 - 1, y >> 1) * W2;
        for (let x = 0; x < W; x++) {
          const k = o + x, z = zr[k];
          if (fam[z] !== f) continue;
          const j = o2 + Math.min(W2 - 1, x >> 1);
          Lb[k] = den[j] > 2 ? Math.round(num[j] / den[j]) : noMix[z] ? 0 : L[k];
        }
      }
    }
    // опорная яркость зоны — медиана сглаженной
    const base = new Float32Array(32).fill(128), hist = Array.from({ length: 32 }, () => new Uint32Array(256)), cnt = new Uint32Array(32);
    for (let k = 0; k < N; k++) { const z = zr[k]; if (z) { hist[z][Lb[k]]++; cnt[z]++; } }
    for (let z = 1; z < 32; z++) { if (!cnt[z]) continue; let a = 0; for (let y = 0; y < 256; y++) { a += hist[z][y]; if (a >= cnt[z] / 2) { base[z] = Math.max(y, 1); break; } } }
    // у «семьи» одна опорная яркость (тренч: верх, полы, рукава, пояс — одинаково), иначе на стыках зон видны пятна
    for (let f = 1; f <= 5; f++) {
      const hf = new Uint32Array(256); let cf = 0;
      for (let z = 1; z < 32; z++) if (fam[z] === f && !noMix[z]) { for (let y = 0; y < 256; y++) hf[y] += hist[z][y]; cf += cnt[z]; }
      if (!cf) continue;
      let a = 0, med = 128; for (let y = 0; y < 256; y++) { a += hf[y]; if (a >= cf / 2) { med = Math.max(y, 1); break; } }
      for (let z = 1; z < 32; z++) if (fam[z] === f) base[z] = med;
    }
    st.tex = { zr, pk, L, Lb, base, orig, cv, cx, out: cx.createImageData(W, H), done: new Uint8Array(N) };
  }
  function boxBlur(a, tmp, W, H, R) {
    const inv = 1;
    for (let y = 0; y < H; y++) {
      let s = 0; const o = y * W;
      for (let x = -R; x < W; x++) { if (x + R < W) s += a[o + x + R]; if (x - R - 1 >= 0) s -= a[o + x - R - 1]; if (x >= 0) tmp[o + x] = s * inv; }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -R; y < H; y++) { if (y + R < H) s += tmp[(y + R) * W + x]; if (y - R - 1 >= 0) s -= tmp[(y - R - 1) * W + x]; if (y >= 0) a[y * W + x] = s; }
    }
  }
  // обход текселей треугольников (центры пикселей, полпикселя запаса по краю острова); cb(k, t, w0, w1, w2)
  function rasterTris(st, want, cb) {
    const { W, H, geo, I0, nt } = st, uv = geo.attributes.uv.array;
    for (let t = 0; t < nt; t++) {
      if (want && !want(t)) continue;
      const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
      const x0 = uv[a * 2] * W, y0 = uv[a * 2 + 1] * H, x1 = uv[b * 2] * W, y1 = uv[b * 2 + 1] * H, x2 = uv[c * 2] * W, y2 = uv[c * 2 + 1] * H;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const ia = 1 / area;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) + 0.5));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) + 0.5));
      const ex = 0.6 / Math.max(1, Math.sqrt(Math.abs(area)));
      for (let py = minY; py <= maxY; py++) {
        const cy = py + 0.5;
        for (let px = minX; px <= maxX; px++) {
          const cxx = px + 0.5;
          const w0 = ((x2 - x1) * (cy - y1) - (y2 - y1) * (cxx - x1)) * ia;
          const w1 = ((x0 - x2) * (cy - y2) - (y0 - y2) * (cxx - x2)) * ia;
          const w2 = 1 - w0 - w1;
          if (w0 < -ex || w1 < -ex || w2 < -ex) continue;
          cb(py * W + px, t, w0, w1, w2);
        }
      }
    }
  }

  /* ---------- L2: маска (только свои треугольники) ---------- */
  function maskRun(st, flags) {
    const a = st.geo.index.array, o = st.I0, ours = st.ours;
    let hidden = 0;
    for (let t = 0; t < st.nt; t++) {
      const h = flags && !st.prot[st.tz[t]] ? flags[t] : 0, j = t * 3;
      if (h) { a[j] = a[j + 1] = a[j + 2] = o[j]; hidden++; } else if (ours[t]) { a[j] = o[j]; a[j + 1] = o[j + 1]; a[j + 2] = o[j + 2]; }
      ours[t] = h ? 1 : 0;
    }
    st.geo.index.needsUpdate = true;
    st.hidden = hidden;
    return hidden;
  }
  // треугольники, у которых есть вершина (all — все три) под условие fn(i, zone, x, y, z)
  function trisWhere(st, fn, all) {
    const P = st.P0, zn = st.zn, n = st.n, I0 = st.I0, ok = new Uint8Array(n), f = new Uint8Array(st.nt);
    for (let i = 0; i < n; i++) ok[i] = fn(i, zn[i], P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) ? 1 : 0;
    for (let t = 0; t < st.nt; t++) { const a = ok[I0[t * 3]], b = ok[I0[t * 3 + 1]], c = ok[I0[t * 3 + 2]]; if (all ? a && b && c : a || b || c) f[t] = 1; }
    return f;
  }

  /* ---------- L3: перелепка (общие позиции и нормали; исходные хранятся) ---------- */
  function morphRun(st, steps) {
    const geo = st.geo, PA = geo.attributes.position, NA = geo.attributes.normal, p = PA.array, nn = NA.array;
    p.set(st.P0); nn.set(st.N0);
    const moved = new Uint8Array(st.n), fixedN = new Uint8Array(st.n);
    let cnt = 0;
    if (steps && steps.length) {
      const ctx = { st, p, nn, zn: st.zn, P0: st.P0, moved, fixedN, Z };
      steps.forEach(fn => { if (fn) fn(ctx); });
      for (let i = 0; i < st.n; i++) if (moved[i]) cnt++;
      if (cnt) { unfold(st, p); normalsFor(st, moved, fixedN, st.morphHide); }
    }
    PA.needsUpdate = true; NA.needsUpdate = true;
    if (geo.boundingSphere) geo.computeBoundingSphere();
    olRun(st);
    st.morphed = cnt;
    return cnt;
  }
  // нормали сдвинутых вершин и их соседей — по граням (сварка по точке), кроме заданных явно
  // после прижатия складок тренча (лацканы, пояс, пуговицы, клапаны, хлястики) их изнанка лежит в ткани гранью
  // «внутрь»: её контур выходил бы линиями по краям. Такие грани (сдвинутые, смотрят к оси тела или руки) — прочь
  // маской, и нормали соседей считаются без них.
  function unfold(st, p) {
    const I0 = st.I0, zn = st.zn, P0 = st.P0, mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
    const tor = new Uint8Array(32), arm = new Uint8Array(32);
    ['coat_torso', 'collar', 'belt', 'buttons', 'coat_skirt'].forEach(nm => { tor[Z[nm]] = 1; });
    ['cuff', 'sleeve'].forEach(nm => { arm[Z[nm]] = 1; });
    const axes = ['L', 'R'].map(sd => { const a = J('forearm_' + sd), b = J('hand_' + sd), u = J('upperarm_' + sd); return { a, b, u, s: sd === 'L' ? 1 : -1 }; });
    const segP = (A, B, x, y, z) => { const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2], l2 = ax * ax + ay * ay + az * az || 1, t = clamp(((x - A[0]) * ax + (y - A[1]) * ay + (z - A[2]) * az) / l2, 0, 1); return [A[0] + ax * t, A[1] + ay * t, A[2] + az * t]; };
    let cnt = 0;
    for (let t = 0; t < st.nt; t++) {
      const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
      const za = zn[a], isT = tor[za] && tor[zn[b]] && tor[zn[c]], isA = arm[za] && arm[zn[b]] && arm[zn[c]];
      if (!isT && !isA) continue;
      // сдвинута ли грань поперёк (не только по высоте, как у подола)
      let mv = 0;
      for (const v of [a, b, c]) { const dx = p[v * 3] - P0[v * 3], dz = p[v * 3 + 2] - P0[v * 3 + 2]; mv = Math.max(mv, dx * dx + dz * dz); }
      if (mv < 1e-6) continue;
      const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3, cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
      if (isT && cy < 0.83) continue;
      const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-12) continue;
      let dx, dy = 0, dz;
      if (isT) { dx = cx; dz = cz - 0.012; } else {
        const ax = axes[cx > 0 ? 0 : 1], q1 = segP(ax.u, ax.a, cx, cy, cz), q2 = segP(ax.a, ax.b, cx, cy, cz);
        const d1 = Math.hypot(cx - q1[0], cy - q1[1], cz - q1[2]), d2 = Math.hypot(cx - q2[0], cy - q2[1], cz - q2[2]), q = d2 < d1 ? q2 : q1;
        dx = cx - q[0]; dy = cy - q[1]; dz = cz - q[2];
      }
      const dl = Math.hypot(dx, dy, dz) || 1;
      if ((nx * dx + ny * dy + nz * dz) / (nl * dl) < -0.15) { mh[t] = 1; cnt++; }
    }
    st.unfolded = cnt;
  }
  function normalsFor(st, moved, fixedN, skip) {
    const { n, I0, vo, vt, wid, ng } = st, p = st.geo.attributes.position.array, nn = st.geo.attributes.normal.array;
    const touch = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (moved[i]) for (let q = vo[i]; q < vo[i + 1]; q++) { const t = vt[q]; touch[I0[t * 3]] = touch[I0[t * 3 + 1]] = touch[I0[t * 3 + 2]] = 1; }
    const gN = new Float32Array(ng * 3), gT = new Uint8Array(ng);
    for (let i = 0; i < n; i++) if (touch[i] && !fixedN[i]) gT[wid[i]] = 1;
    const tdone = new Uint8Array(st.nt);
    for (let i = 0; i < n; i++) {
      if (!gT[wid[i]]) continue;
      for (let q = vo[i]; q < vo[i + 1]; q++) {
        const t = vt[q];
        if (tdone[t]) continue;
        tdone[t] = 1;
        if (skip && skip[t]) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        [a, b, c].forEach(v => { const g = wid[v / 3] * 3; gN[g] += fx; gN[g + 1] += fy; gN[g + 2] += fz; });
      }
    }
    for (let i = 0; i < n; i++) {
      const g = wid[i];
      if (!gT[g] || fixedN[i]) continue;
      const l = Math.hypot(gN[g * 3], gN[g * 3 + 1], gN[g * 3 + 2]);
      if (l < 1e-12) continue;
      nn[i * 3] = gN[g * 3] / l; nn[i * 3 + 1] = gN[g * 3 + 1] / l; nn[i * 3 + 2] = gN[g * 3 + 2] / l;
    }
  }
  // нормали контура (усреднённые по точке) — заново, если контур уже построен (city3d.js / actors.js heroOutlineNormals)
  function olRun(st) {
    const ol = st.geo.attributes.olNormal;
    if (!ol) return;
    const { n, wid, ng } = st, nn = st.geo.attributes.normal.array, acc = new Float32Array(ng * 3), o = ol.array;
    for (let i = 0; i < n; i++) { const g = wid[i] * 3; acc[g] += nn[i * 3]; acc[g + 1] += nn[i * 3 + 1]; acc[g + 2] += nn[i * 3 + 2]; }
    for (let i = 0; i < n; i++) { const g = wid[i] * 3, l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1; o[i * 3] = acc[g] / l; o[i * 3 + 1] = acc[g + 1] / l; o[i * 3 + 2] = acc[g + 2] / l; }
    ol.needsUpdate = true;
  }

  /* ---------- L1: перекраска ---------- */
  // paint: { зона: fn(x, y, z, o) -> [r, g, b] | null (пиксель автора) }; o.k — доля мелких складок автора (0 — только
  // крупный объём), o.f = 1 — ровный цвет без объёма, o.lo/o.hi — пределы множителя яркости, o.g — гамма
  function paintRun(st, look) {
    const t0 = performance.now(), T = st.tex, { W, H } = st, N = W * H;
    const d = T.out.data, orig = T.orig, done = T.done, zr = T.zr, pk = T.pk, L = T.L, Lb = T.Lb, base = T.base;
    d.set(orig); done.fill(0);
    const pt = look ? look.paint : null;
    if (pt) {
      const fns = new Array(32).fill(null);
      Object.keys(pt).forEach(nm => { if (Z[nm] !== undefined) fns[Z[nm]] = pt[nm]; });
      const p = st.geo.attributes.position.array, I0 = st.I0, tz = st.tz, o = { k: 0, f: 0, lo: 0.5, hi: 1.25, g: 0.8, t: 0, z: 0, st };
      const keep0 = look.keep == null ? 0.3 : look.keep;
      const nd = new Uint8Array(32); nd[Z.belt + 1] = nd[Z.buttons + 1] = 1;
      rasterTris(st, t => !!fns[tz[t]], (k, t, w0, w1, w2) => {
        if (pk[k]) return;
        const z = tz[t], a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        const x = p[a] * w0 + p[b] * w1 + p[c] * w2, y = p[a + 1] * w0 + p[b + 1] * w1 + p[c + 1] * w2, zz = p[a + 2] * w0 + p[b + 2] * w1 + p[c + 2] * w2;
        o.k = keep0; o.f = 0; o.lo = 0.5; o.hi = 1.25; o.g = 0.8; o.t = t; o.z = z;
        const col = fns[z](x, y, zz, o);
        if (!col) return;
        // хлястик манжеты у автора тёмный (хаки): на новом крое — без тёмной полосы-«браслета»
        if (z === Z.cuff && !o.f) { o.lo = Math.max(o.lo, 0.84); o.k = Math.min(o.k, 0.12); }
        const j = k * 4;
        let m = 1;
        if (!o.f) {
          const zb = zr[k] || z + 1;
          if (nd[zb]) { const lb = Lb[k]; m = lb ? Math.pow(clamp(lb / base[Z.coat_torso + 1], o.lo, o.hi), o.g) : 1; }
          else { const lm = Lb[k] + (L[k] - Lb[k]) * o.k; m = Math.pow(clamp(lm / base[zb], o.lo, o.hi), o.g); }
        }
        d[j] = clamp(col[0] * m, 0, 255); d[j + 1] = clamp(col[1] * m, 0, 255); d[j + 2] = clamp(col[2] * m, 0, 255);
        done[k] = 1;
      });
      // поля островов: перекрашенный цвет растекается на 6 пикселей в пустоту между островами (мип-уровни без бежевой каймы);
      // волной от края перекрашенного (один проход по текстуре, дальше — только фронт)
      const cover = zr, free = i => !done[i] && !cover[i];
      let front = [];
      for (let i = 0; i < N; i++) {
        if (done[i] !== 1) continue;
        const x = i % W;
        if ((x > 0 && free(i - 1)) || (x < W - 1 && free(i + 1)) || (i >= W && free(i - W)) || (i < N - W && free(i + W))) front.push(i);
      }
      for (let pass = 0; pass < 6 && front.length; pass++) {
        const next = [];
        for (let q = 0; q < front.length; q++) {
          const j = front[q], x = j % W, j4 = j * 4;
          for (let s = 0; s < 4; s++) {
            const i = s === 0 ? (x > 0 ? j - 1 : -1) : s === 1 ? (x < W - 1 ? j + 1 : -1) : s === 2 ? j - W : j + W;
            if (i < 0 || i >= N || !free(i)) continue;
            const i4 = i * 4; d[i4] = d[j4]; d[i4 + 1] = d[j4 + 1]; d[i4 + 2] = d[j4 + 2]; done[i] = 2; next.push(i);
          }
        }
        front = next;
      }
    }
    T.cx.putImageData(T.out, 0, 0);
    st.map.image = T.cv; st.map.needsUpdate = true;
    stats.paintMs = Math.round(performance.now() - t0);
  }
  function restoreTex(st) {
    if (st.map.image !== st.src) { st.map.image = st.src; st.map.needsUpdate = true; }
  }

  const LOOKS = {};
  /* ---------- L4: одежда одной сеткой ---------- */
  // вершина: позиция, нормаль, цвет (0..255, уже «текстурный»), веса [[кость, вес]...], part (0 тело, 1 голова, 2 сумочка,
  // 3 очки), tk (0..1 — насколько низ подбирается в транспорте; сверх 1 — ещё и уже к оси: раструб юбки), uv (узор; по умолчанию белый угол атласа одежды)
  const WHITE_UV = [0.995, 0.995];
  // sq — «сжатие» в транспорте: [x, y, z, доля] — к точке оси (рукав-крыло за рулём уже), по умолчанию нет
  // bk — множитель цвета изнанки (по умолчанию 0.78: подол снизу темнее; у белой накидки — светлая подкладка)
  function GB() { this.p = []; this.n = []; this.c = []; this.uv = []; this.si = []; this.sw = []; this.pa = []; this.tk = []; this.sq = []; this.bkA = []; this.idx = []; this.ol = []; this.part = 0; this.tuck = 0; this.squeeze = null; this.bk = 0.78; }
  GB.prototype.v = function (p, n, col, w, uv, tk) {
    const i = this.p.length / 3;
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0] / 255, col[1] / 255, col[2] / 255);
    const u = uv || WHITE_UV; this.uv.push(u[0], u[1]);
    // веса — [[кость, вес]...] или готовые индексы скелета { si, sw } (оболочка тела: веса граней тренча)
    if (w && w.si) { for (let k = 0; k < 4; k++) { this.si.push(w.si[k]); this.sw.push(w.sw[k]); } } else {
      const ws = w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4); let s = 0; ws.forEach(q => { s += q[1]; });
      for (let k = 0; k < 4; k++) { const q = ws[k], bi = q ? boneIdx(q[0]) : 0; this.si.push(bi < 0 ? 0 : bi); this.sw.push(q && s > 0 ? q[1] / s : k === 0 ? 1 : 0); }
    }
    this.pa.push(this.part); this.tk.push(tk == null ? this.tuck : tk); this.bkA.push(this.bk);
    const q = this.squeeze; if (q) this.sq.push(q[0], q[1], q[2], q[3]); else this.sq.push(0, 0, 0, 0);
    return i;
  };
  GB.prototype.tri = function (a, b, c, ol) { this.idx.push(a, b, c); if (ol !== false) this.ol.push(a, b, c); };
  // труба по кольцам: rings[r] = { c:[x,y,z], rx, rz, a0?, a1? (дуга вместо круга), off(a)? (+радиус), k(a)? (×радиус) }; fn(r, s, p, a, R) -> { col, w, uv?, tk? }
  GB.prototype.tube = function (rings, seg, fn, opt) {
    opt = opt || {};
    const base = this.p.length / 3, nr = rings.length, a0 = opt.a0 == null ? 0 : opt.a0, a1 = opt.a1 == null ? Math.PI * 2 : opt.a1;
    for (let r = 0; r < nr; r++) {
      const R = rings[r], rp = rings[Math.max(0, r - 1)], rn = rings[Math.min(nr - 1, r + 1)];
      for (let s = 0; s <= seg; s++) {
        const a = a0 + (a1 - a0) * s / seg, off = R.off ? R.off(a) : 0, kk = R.k ? R.k(a) : 1;
        const sa = Math.sin(a), ca = Math.cos(a);
        const p = [R.c[0] + sa * (R.rx + off) * kk, R.c[1] + (R.dy ? R.dy(a) : 0), R.c[2] + ca * (R.rz + off) * kk];
        let nx = sa / Math.max(R.rx, 1e-4), nz = ca / Math.max(R.rz, 1e-4);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const dr = ((rn.rx + rn.rz) - (rp.rx + rp.rz)) / 2, dy = rn.c[1] - rp.c[1];
        const ny = Math.abs(dy) > 1e-6 ? dr / dy : 0, nl = Math.hypot(nx, ny, nz) || 1;
        const q = fn(r, s, p, a, R);
        this.v(p, [nx / nl, ny / nl, nz / nl], q.col, q.w, q.uv, q.tk);
      }
    }
    for (let r = 0; r < nr - 1; r++) for (let s = 0; s < seg; s++) {
      const a = base + r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
      if (opt.flip) { this.tri(a, b, c); this.tri(b, d, c); } else { this.tri(a, c, b); this.tri(b, c, d); }
    }
    if (opt.capTop || opt.capBottom) {
      [[opt.capTop, 0, 1], [opt.capBottom, nr - 1, -1]].forEach(([on, r, sg]) => {
        if (!on) return;
        const R = rings[r], q = fn(r, 0, R.c, 0, R), ci = this.v(R.c, [0, sg, 0], q.col, q.w, q.uv, q.tk);
        for (let s = 0; s < seg; s++) { const a = base + r * (seg + 1) + s; if ((sg > 0) !== !!opt.flip) this.tri(a + 1, a, ci, on !== 'noline'); else this.tri(a, a + 1, ci, on !== 'noline'); }
      });
    }
    return base;
  };
  // эллипсоид: центр, радиусы, цвет (или fn(n, p) -> цвет), веса; opt.rot — [rx, ry, rz] (радианы), opt.ol — с контуром
  GB.prototype.blob = function (c, r, col, w, segU, segV, opt) {
    opt = opt || {};
    segU = segU || 10; segV = segV || 7;
    const base = this.p.length / 3, rot = opt.rot ? rotM(opt.rot) : null;
    for (let j = 0; j <= segV; j++) {
      const th = j / segV * Math.PI;
      for (let i = 0; i <= segU; i++) {
        const ph = i / segU * Math.PI * 2;
        let n = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
        let q = [n[0] * r[0], n[1] * r[1], n[2] * r[2]];
        let nn = [n[0] / r[0], n[1] / r[1], n[2] / r[2]];
        if (rot) { q = mulM(rot, q); nn = mulM(rot, nn); }
        const l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
        const p = [c[0] + q[0], c[1] + q[1], c[2] + q[2]];
        this.v(p, [nn[0] / l, nn[1] / l, nn[2] / l], typeof col === 'function' ? col(n, p, i / segU, j / segV) : col, w);
      }
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = base + j * (segU + 1) + i, b = a + 1, c2 = a + segU + 1, d = c2 + 1;
      this.tri(a, c2, b, opt.ol !== false); this.tri(b, c2, d, opt.ol !== false);
    }
    return base;
  };
  // тор: центр, большой и малый радиусы, поворот, цвет, веса
  GB.prototype.torus = function (c, R, r, rot, col, w, segU, segV, opt) {
    opt = opt || {};
    segU = segU || 16; segV = segV || 6;
    const base = this.p.length / 3, M = rotM(rot || [0, 0, 0]);
    for (let i = 0; i <= segU; i++) {
      const u = i / segU * Math.PI * 2;
      for (let j = 0; j <= segV; j++) {
        const v = j / segV * Math.PI * 2;
        const n0 = [Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v)];
        const p0 = [Math.cos(u) * (R + r * Math.cos(v)), r * Math.sin(v), Math.sin(u) * (R + r * Math.cos(v))];
        const p = mulM(M, p0), n = mulM(M, n0);
        this.v([c[0] + p[0], c[1] + p[1], c[2] + p[2]], n, typeof col === 'function' ? col(i / segU, j / segV) : col, w);
      }
    }
    for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
      const a = base + i * (segV + 1) + j, b = a + 1, c2 = a + segV + 1, d = c2 + 1;
      this.tri(a, b, c2, opt.ol !== false); this.tri(b, d, c2, opt.ol !== false);
    }
    return base;
  };
  function rotM(r) {
    const [x, y, z] = r, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    // R = Rz * Ry * Rx (порядок Эйлера XYZ, как у three)
    return [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz, cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz, -sy, sx * cy, cx * cy];
  }
  function mulM(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  // сборка: тело + вывернутая оболочка контура (вершины с olk = 1: шейдер раздвигает их по нормали, как контур героини)
  const OLC = [74, 58, 72];
  GB.prototype.build = function (T) {
    const nv = this.p.length / 3, P = this.p.slice(), N = this.n.slice(), C = this.c.slice(), UVa = this.uv.slice(), SI = this.si.slice(), SW = this.sw.slice(), PA = this.pa.slice(), TK = this.tk.slice(), SQ = this.sq.slice(), BK = this.bkA.slice(), I = this.idx.slice();
    const OL = new Array(nv).fill(0);
    if (this.ol.length) {
      const key = i => Math.round(this.p[i * 3] * 2e3) + ',' + Math.round(this.p[i * 3 + 1] * 2e3) + ',' + Math.round(this.p[i * 3 + 2] * 2e3) + ',' + this.pa[i];
      const acc = new Map();
      for (let i = 0; i < nv; i++) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += this.n[i * 3]; a[1] += this.n[i * 3 + 1]; a[2] += this.n[i * 3 + 2]; acc.set(k, a); }
      const used = new Map();
      const ov = i => {
        if (used.has(i)) return used.get(i);
        const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1, j = P.length / 3;
        P.push(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); N.push(a[0] / l, a[1] / l, a[2] / l); C.push(OLC[0] / 255, OLC[1] / 255, OLC[2] / 255);
        UVa.push(WHITE_UV[0], WHITE_UV[1]); OL.push(1); PA.push(this.pa[i]); TK.push(this.tk[i]); BK.push(this.bkA[i]); SQ.push(this.sq[i * 4], this.sq[i * 4 + 1], this.sq[i * 4 + 2], this.sq[i * 4 + 3]);
        for (let k = 0; k < 4; k++) { SI.push(this.si[i * 4 + k]); SW.push(this.sw[i * 4 + k]); }
        used.set(i, j); return j;
      };
      for (let t = 0; t < this.ol.length; t += 3) I.push(ov(this.ol[t]), ov(this.ol[t + 2]), ov(this.ol[t + 1]));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(UVa, 2));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(SW, 4));
    g.setAttribute('olk', new T.Float32BufferAttribute(OL, 1));
    g.setAttribute('part', new T.Float32BufferAttribute(PA, 1));
    g.setAttribute('tk', new T.Float32BufferAttribute(TK, 1));
    g.setAttribute('sq', new T.Float32BufferAttribute(SQ, 4));
    g.setAttribute('bk', new T.Float32BufferAttribute(BK, 1));
    g.setIndex(P.length / 3 > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
    g.computeBoundingSphere();
    g.userData.tris = I.length / 3; g.userData.bodyTris = this.idx.length / 3; g.userData.outfit = true;
    return g;
  };

  // атлас узоров одежды (цветы и листья на платье, веточка на накидке): один на сессию, белый угол — для гладких частей
  let OTEX = null;
  function outfitTex(T) {
    if (OTEX) return OTEX;
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    // читаем атлас дважды (поправка цвета и texPost) — холст в памяти, без предупреждений Canvas2D
    const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 512, 512);
    OTEX = new T.CanvasTexture(cv); OTEX.encoding = T.LinearEncoding; OTEX.anisotropy = 4;
    OTEX.userData.cv = cv; OTEX.userData.look = null;
    return OTEX;
  }
  function texFor(T, id) {
    const tx = outfitTex(T), lk = LOOKS[id];
    if (tx.userData.look === id) return tx;
    const c = tx.userData.cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 512, 512);
    if (lk && lk.tex) {
      try {
        lk.tex(c, 512);
        // цвета узора — как у краски (corr: тёмные делим на тёплый свет города, светлые — без потери яркости)
        const im = c.getImageData(0, 0, 512, 512), d = im.data, q = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) { corr(d[i], d[i + 1], d[i + 2], q); d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; }
        c.putImageData(im, 0, 0);
      } catch (e) { console.warn('outfit tex', e); }
    }
    // texPost — после поправки (цвета уже «текстурные», как у краски: кожа модели и tc-цвета)
    if (lk && lk.texPost) { try { lk.texPost(c, 512); } catch (e) { console.warn('outfit tex', e); } }
    c.fillStyle = '#FFFFFF'; c.fillRect(500, 0, 12, 12);
    tx.userData.look = id; tx.needsUpdate = true;
    return tx;
  }
  // материал одежды героини: toon с цветом вершин, рампа — как у героини; контур, прятки частей, подбор подола — в шейдере
  // материал двусторонний: изнанка юбки, брюк и накидки (подол снизу, штанина сзади) — цвет ткани темнее, а не контур;
  // оболочка контура — только лицевые грани (изнанку оболочки отбрасываем, как раньше отсекала сторона)
  function outfitMat(T, heroMat) {
    const m = new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, map: outfitTex(T), gradientMap: (heroMat && heroMat.gradientMap) || null, side: T.DoubleSide });
    const U = { uOlT: { value: 0.00085 }, uOlCol: { value: new T.Color('#4A3A48') }, uHide: { value: new T.Vector3(0, 0, 0) }, uTuck: { value: 0 }, uKnee: { value: 0.45 }, uSq: { value: 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float olk;\nattribute float part;\nattribute float tk;\nattribute vec4 sq;\nattribute float bk;\nuniform float uOlT;\nuniform vec3 uHide;\nuniform float uTuck;\nuniform float uKnee;\nuniform float uSq;\nvarying float vOl;\nvarying float vTk;\nvarying float vBk;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nif (uTuck > 0.0 && tk > 0.0 && position.y < uKnee) { objectNormal.y /= max(0.25, 1.0 - 0.72 * uTuck * min(tk, 1.0)); objectNormal = normalize(objectNormal); }')
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\nif (uTuck > 0.0 && tk > 0.0) {\n float tq = uTuck * min(tk, 1.0);\n float nk = 0.18 + 0.45 * max(0.0, tk - 1.0);\n float lo = max(0.0, uKnee - transformed.y);\n transformed.y = transformed.y + lo * 0.72 * tq;\n transformed.xz *= 1.0 - nk * tq * clamp(lo / 0.3, 0.0, 1.0);\n}\nif (uSq > 0.0 && sq.w > 0.0) transformed = mix(transformed, sq.xyz + (transformed - sq.xyz) * 0.45, uSq * sq.w);')
        .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\nvOl = olk;\nvBk = bk;\nvTk = uTuck * min(tk, 1.0) * clamp((uKnee - position.y) / 0.05, 0.0, 1.0);\nif (olk > 0.5) mvPosition.xyz += normalize(transformedNormal) * uOlT * (-mvPosition.z);\ngl_Position = projectionMatrix * mvPosition;\nfloat hp = part < 0.5 ? 0.0 : part < 1.5 ? uHide.x : part < 2.5 ? uHide.y : uHide.z;\nif (hp > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
      sh.fragmentShader = 'uniform vec3 uOlCol;\nvarying float vOl;\nvarying float vTk;\nvarying float vBk;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (vOl > 0.5 && vTk > 0.3) discard;\nif (!gl_FrontFacing) { if (vOl > 0.5) discard; diffuseColor.rgb *= vBk; }')
        .replace('#include <output_fragment>', 'if (vOl > 0.5) { outgoingLight = uOlCol; normal = normalize(vViewPosition); }\n#include <output_fragment>');
    };
    m.customProgramCacheKey = () => 'heroOutfit4';
    m.userData.U = U; m.userData.outfit = true;
    return m;
  }
  // изнанка тренча (подвёрнутые лацканы, подол и рукава изнутри, спинка в распахе) — цветом ткани темнее, а не контуром
  // героини: пока надет образ, материал героини двусторонний (оболочка контура за изнанкой не просвечивает). Свой кусок
  // шейдера — цепочкой к уже заданному (контровой свет, деформация статуэтки)
  function heroBack(mat, T, on) {
    if (!mat || !T) return;
    if (!mat.userData.hoBack) {
      const own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
      const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef DOUBLE_SIDED\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;\n#endif');
      };
      mat.customProgramCacheKey = () => 'hoBack1' + (prevKey ? prevKey.call(mat) : '');
      mat.userData.hoBack = 1;
    }
    const side = on ? T.DoubleSide : T.FrontSide;
    if (mat.side !== side) { mat.side = side; mat.needsUpdate = true; }
  }
  const GEO = {};
  // низкое качество (q=low/lite): одежда без запечённой оболочки контура — индексы контура идут после тела, хватает
  // диапазона отрисовки (геометрия общая у всех героинь, вызовов столько же)
  let LOWQ = false;
  const applyRange = g => { if (g) g.setDrawRange(0, LOWQ ? g.userData.bodyTris * 3 : Infinity); };
  function garmentGeo(T, id) {
    if (GEO[id]) return GEO[id];
    const lk = LOOKS[id];
    if (!lk || !lk.garment) return null;
    const B = new GB();
    lk.garment(B, GX());
    const g = B.build(T);
    GEO[id] = g;
    applyRange(g);
    return g;
  }
  /* ---------- общие приёмы образов ---------- */
  // мерки модели (метры, поза покоя): ноги, тренч, руки — для одежды и перелепки
  const M = {
    head: [0, 1.5, -0.093], headR: 0.284, crownC: [0, 1.52, -0.075], top0: 1.896,
    waist: 1.0, hip: 0.8, knee: 0.44, ankle: 0.09, hem0: 0.542,
    legX: 0.062, legR: 0.05,
  };
  function GX() { return M; }
  const W1 = n => [[n, 1]];
  const mixW = (a, b, k) => (k <= 0 ? W1(a) : k >= 1 ? W1(b) : [[a, 1 - k], [b, k]]);
  const PI = Math.PI;

  // купол волос вместо берета и банта: вершины берета ложатся на купол, натянутый на край «дыры» (кольцо волос
  // вокруг берета) и поднимающийся к макушке top; пряди у края прижимаются к куполу — шов не виден
  function crown(o) {
    o = o || {};
    return ctx => {
      const { st, p, nn, zn, moved, fixedN } = ctx, I = st.I0, n = st.n;
      const C = o.c || M.crownC, TOPY = o.top || 1.835, NB = 72, isB = i => zn[i] === Z.beret || zn[i] === Z.bow;
      // край дыры: вершины волос, сваренные (по точке) с треугольниками берета — берет и волосы соединены не
      // индексом, а совпадающими точками (швы UV); по одному индексу край — 9 точек вместо 131
      const rim = new Uint8Array(n), wid = st.wid, gT = new Uint8Array(st.ng);
      for (let t = 0; t < I.length; t += 3) if (isB(I[t]) || isB(I[t + 1]) || isB(I[t + 2])) { gT[wid[I[t]]] = 1; gT[wid[I[t + 1]]] = 1; gT[wid[I[t + 2]]] = 1; }
      for (let i = 0; i < n; i++) if (!isB(i) && gT[wid[i]] && zn[i] !== Z.face && zn[i] !== Z.ears) rim[i] = 1;
      const sph = (x, y, z) => { const dx = x - C[0], dy = y - C[1], dz = z - C[2], r = Math.hypot(dx, dy, dz) || 1e-6; return [Math.atan2(dx, dz), Math.asin(clamp(dy / r, -1, 1)), r]; };
      const bin = a => ((Math.floor((a + PI) / (2 * PI) * NB) % NB) + NB) % NB;
      const els = Array.from({ length: NB }, () => []), rs = Array.from({ length: NB }, () => []);
      for (let i = 0; i < n; i++) if (rim[i]) { const s = sph(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), b = bin(s[0]); els[b].push(s[1]); rs[b].push(s[2]); }
      const med = a => { if (!a.length) return NaN; const q = a.slice().sort((x, y) => x - y); return q[q.length >> 1]; };
      const el = new Float32Array(NB), rho = new Float32Array(NB);
      for (let b = 0; b < NB; b++) { el[b] = med(els[b]); rho[b] = med(rs[b]); }
      for (let pass = 0; pass < NB; pass++) for (let b = 0; b < NB; b++) if (isNaN(el[b])) {
        const l = el[(b + NB - 1) % NB], r = el[(b + 1) % NB];
        if (!isNaN(l) || !isNaN(r)) { el[b] = isNaN(l) ? r : isNaN(r) ? l : (l + r) / 2; const rl = rho[(b + NB - 1) % NB], rr = rho[(b + 1) % NB]; rho[b] = isNaN(rl) ? rr : isNaN(rr) ? rl : (rl + rr) / 2; }
      }
      const sm = a => { const q = new Float32Array(NB); for (let b = 0; b < NB; b++) { let s = 0; for (let k = -3; k <= 3; k++) s += a[(b + k + NB) % NB]; q[b] = s / 7; } return q; };
      const elS = sm(sm(el)), rhoS = sm(sm(rho)), rTop = TOPY - C[1];
      const at = (arr, a) => { const f = (a + PI) / (2 * PI) * NB - 0.5, b0 = Math.floor(f), k = f - b0; return arr[((b0 % NB) + NB) % NB] * (1 - k) + arr[(((b0 + 1) % NB) + NB) % NB] * k; };
      const vol = o.vol || 0;
      // радиус купола по азимуту и высоте (выше края — к макушке; ниже — по краю)
      const domeR = (az, e) => { const e0 = at(elS, az), r0 = at(rhoS, az) + vol; if (e < e0) return r0; const u = clamp((e - e0) / (PI / 2 - e0), 0, 1), k = u * u * (3 - 2 * u); return r0 + (rTop + vol * 0.5 - r0) * Math.sin(k * PI / 2); };
      ctx.dome = st.dome = { C, domeR, elS, rhoS, at };
      // наружная поверхность берета (нормаль от центра) -> купол, опущенный на 6–12° ниже края дыры «юбкой» с
      // зубцами-прядями (неровный край волос остаётся под ней); изнанка берета — внутрь, её не видно
      const N0 = st.N0, P0 = st.P0, emin = new Float32Array(NB).fill(9);
      const outer = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (!isB(i)) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], dx = x - C[0], dy = y - C[1], dz = z - C[2], r = Math.hypot(dx, dy, dz) || 1;
        if ((N0[i * 3] * dx + N0[i * 3 + 1] * dy + N0[i * 3 + 2] * dz) / r > 0.1) { outer[i] = 1; const s = sph(x, y, z), b = bin(s[0]); emin[b] = Math.min(emin[b], s[1]); }
      }
      for (let pass = 0; pass < NB; pass++) for (let b = 0; b < NB; b++) if (emin[b] > 8) { const l = emin[(b + NB - 1) % NB], r = emin[(b + 1) % NB]; if (l < 8 || r < 8) emin[b] = Math.min(l, r); }
      // изнанку берета прячем маской (иначе её контур просвечивает сквозь «юбку» купола)
      st.crownInner = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (isB(i) && !outer[i]) st.crownInner[i] = 1;
      const eminS = sm(emin), skirt = o.skirt == null ? 0.2 : o.skirt, teeth = o.teeth == null ? 0.03 : o.teeth;
      // профиль волос под краем: наибольший радиус прядей по азимуту и высоте (юбка купола ложится на них снаружи),
      // и верх лица по азимуту (юбка не опускается на лоб)
      const NE = 40, E0 = -0.9, E1 = PI / 2, eb = e => clamp(Math.floor((e - E0) / (E1 - E0) * NE), 0, NE - 1);
      const rH = new Float32Array(NB * NE), fTop = new Float32Array(NB).fill(-9);
      for (let i = 0; i < n; i++) {
        const zz = zn[i];
        if (zz !== Z.hair_skull && zz !== Z.hair_back && zz !== Z.face && zz !== Z.ears) continue;
        const s = sph(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]), b0 = bin(s[0]);
        if (zz === Z.face || zz === Z.ears) { fTop[b0] = Math.max(fTop[b0], s[1]); continue; }
        const k = b0 * NE + eb(s[1]); rH[k] = Math.max(rH[k], s[2]);
      }
      for (let pass = 0; pass < 30; pass++) for (let b0 = 0; b0 < NB; b0++) for (let e = 0; e < NE; e++) {
        const k = b0 * NE + e; if (rH[k] > 0) continue;
        const l = rH[((b0 + NB - 1) % NB) * NE + e], r = rH[((b0 + 1) % NB) * NE + e], u = e < NE - 1 ? rH[k + 1] : 0, d = e > 0 ? rH[k - 1] : 0;
        const m = Math.max(l, r, u, d); if (m > 0) rH[k] = m;
      }
      const fTopS = new Float32Array(NB); for (let b0 = 0; b0 < NB; b0++) { let m = -9; for (let k = -2; k <= 2; k++) m = Math.max(m, fTop[(b0 + k + NB) % NB]); fTopS[b0] = m; }
      const rHair = (az, e) => { const f = (az + PI) / (2 * PI) * NB - 0.5, b0 = Math.floor(f), k = f - b0, fe = clamp((e - E0) / (E1 - E0) * NE - 0.5, 0, NE - 1.001), e0i = Math.floor(fe), ke = fe - e0i;
        const g = (bb, ee) => rH[(((bb % NB) + NB) % NB) * NE + ee];
        return lerp(lerp(g(b0, e0i), g(b0, e0i + 1), ke), lerp(g(b0 + 1, e0i), g(b0 + 1, e0i + 1), ke), k); };
      const faceTop = az => { const f = (az + PI) / (2 * PI) * NB, b0 = ((Math.floor(f) % NB) + NB) % NB; return fTopS[b0]; };
      for (let i = 0; i < n; i++) {
        if (!isB(i)) continue;
        const s = sph(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]), e0 = at(elS, s[0]), em = Math.min(at(eminS, s[0]), e0 - 0.01);
        // зубцы: низ «юбки» волнится по азимуту (кончики прядей); над лицом юбка короче (лоб открыт)
        const tooth = teeth * Math.pow(Math.abs(Math.sin(s[0] * 11 + 0.6)), 3);
        const ft = faceTop(s[0]);
        const eLow = Math.max(e0 - skirt - tooth, ft > -8 ? Math.min(e0 - 0.02, ft + 0.03 - tooth * 0.5) : -9);
        const u = clamp((s[1] - em) / (PI / 2 - em), 0, 1);
        let e = eLow + (PI / 2 - eLow) * u, r;
        if (outer[i]) {
          if (e >= e0) r = domeR(s[0], e);
          else r = lerp(domeR(s[0], e0), rHair(s[0], e) + (o.inset == null ? 0.005 : o.inset), sst(e0, e0 - 0.06, e));
        } else { e = Math.max(e, e0 - 0.05); r = domeR(s[0], Math.max(e, e0)) - 0.03; }
        const ce = Math.cos(e);
        p[i * 3] = C[0] + Math.sin(s[0]) * ce * r; p[i * 3 + 1] = C[1] + Math.sin(e) * r; p[i * 3 + 2] = C[2] + Math.cos(s[0]) * ce * r;
        nn[i * 3] = Math.sin(s[0]) * ce; nn[i * 3 + 1] = Math.sin(e); nn[i * 3 + 2] = Math.cos(s[0]) * ce;
        moved[i] = 1; fixedN[i] = 1;
      }
      // край волос у дыры: пряди выше линии «юбки» купола уходят под неё (не торчат сквозь купол)
      for (let i = 0; i < n; i++) {
        if (zn[i] !== Z.hair_skull && zn[i] !== Z.face) continue;
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], s = sph(x, y, z), e0 = at(elS, s[0]);
        if (zn[i] === Z.face && (z < 0.0 || y < 1.62)) continue;
        if (s[1] < e0 - 0.03) continue;
        const rd = domeR(s[0], Math.max(s[1], e0)) - 0.002;
        if (s[2] <= rd) continue;
        if (zn[i] === Z.face) continue;
        const f = rd / s[2];
        p[i * 3] = C[0] + (x - C[0]) * f; p[i * 3 + 1] = C[1] + (y - C[1]) * f; p[i * 3 + 2] = C[2] + (z - C[2]) * f;
        moved[i] = 1;
      }
      // складки берета, вывернутые куполом (грань смотрит не наружу), — прочь маской: их изнанка и контур
      // давали тёмные штрихи по макушке
      {
        const mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
        for (let t = 0; t < st.nt; t++) {
          const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
          if (!isB(a) || !isB(b) || !isB(c) || st.crownInner[a] || st.crownInner[b] || st.crownInner[c]) continue;
          const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
          const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3 - C[0], cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3 - C[1], cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3 - C[2];
          if (nl < 1e-12 || (nx * cx + ny * cy + nz * cz) / (nl * (Math.hypot(cx, cy, cz) || 1)) < 0.15) mh[t] = 1;
        }
        // бант целиком прочь: его грани, сложенные в купол, торчали тёмными зубцами над лбом слева (край дыры
        // считается и по нему — точки банта остаются в расчёте, прячутся только грани)
        for (let t = 0; t < st.nt; t++) if (zn[I[t * 3]] === Z.bow || zn[I[t * 3 + 1]] === Z.bow || zn[I[t * 3 + 2]] === Z.bow) mh[t] = 1;
      }
      // пряди под «юбкой» купола (выше её зубчатого края на 0.05 рад) — прочь маской: их грани и контур
      // проступали сквозь купол серыми штрихами на макушке (юбка лежит на огибающей прядей)
      const cov = st.crownCov = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (zn[i] !== Z.hair_skull && zn[i] !== Z.hair_back) continue;
        const s = sph(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), e0 = at(elS, s[0]);
        const tooth = teeth * Math.pow(Math.abs(Math.sin(s[0] * 11 + 0.6)), 3), ft = faceTop(s[0]);
        const eLow = Math.max(e0 - skirt - tooth, ft > -8 ? Math.min(e0 - 0.02, ft + 0.03 - tooth * 0.5) : -9);
        if (s[1] > eLow + 0.05) { cov[i] = 1; continue; }
        // у зубчатого края юбки — на 6 мм под неё (грани купола — хорды, пряди на огибающей протыкали их)
        if (s[1] < eLow - 0.004) continue;
        const rd = (s[1] >= e0 ? domeR(s[0], s[1]) : lerp(domeR(s[0], e0), rHair(s[0], s[1]) + (o.inset == null ? 0.005 : o.inset), sst(e0, e0 - 0.06, s[1]))) - 0.006;
        if (s[2] <= rd) continue;
        const f = rd / s[2], x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        p[i * 3] = C[0] + (x - C[0]) * f; p[i * 3 + 1] = C[1] + (y - C[1]) * f; p[i * 3 + 2] = C[2] + (z - C[2]) * f;
        moved[i] = 1;
      }
    };
  }
  // «замок» края лица: вершины граней лица и ушей (по большинству вершин; и их копии по сварке) — 0 (волосы там не
  // двигаются: грани лица не растягиваются), соседи через ребро — 0.5, остальные — 1
  function faceLock(st) {
    if (st.faceLock) return st.faceLock;
    const I0 = st.I0, wid = st.wid, g = new Uint8Array(st.ng), g1 = new Uint8Array(st.ng), w = new Float32Array(st.n).fill(1);
    for (let t = 0; t < st.nt; t++) if (st.prot[st.tz[t]]) for (let k = 0; k < 3; k++) g[wid[I0[t * 3 + k]]] = 1;
    for (let t = 0; t < st.nt; t++) { const a = wid[I0[t * 3]], b = wid[I0[t * 3 + 1]], c = wid[I0[t * 3 + 2]]; if (g[a] || g[b] || g[c]) g1[a] = g1[b] = g1[c] = 1; }
    for (let i = 0; i < st.n; i++) w[i] = g[wid[i]] ? 0 : g1[wid[i]] ? 0.5 : 1;
    st.faceLock = w;
    return w;
  }
  // треугольники целиком под куполом (все три вершины) — в маску образа
  function crownCovered(st, f) {
    const c = st.crownCov, I0 = st.I0;
    if (!c) return f;
    for (let t = 0; t < st.nt; t++) if (c[I0[t * 3]] && c[I0[t * 3 + 1]] && c[I0[t * 3 + 2]]) f[t] = 1;
    return f;
  }
  // маска образа: изнанка купола + треугольники с вершиной в зонах names (или по условию fn)
  function hideWith(names, fn) {
    return st => {
      const zs = new Set((names || []).map(nm => Z[nm])), inner = st.crownInner;
      return crownCovered(st, trisWhere(st, (i, z, x, y, zz) => (inner && inner[i]) || zs.has(z) || (fn ? fn(i, z, x, y, zz) : false)));
    };
  }
  // после перелепки: растянутые треугольники зон (лоскуты между сдвинутыми и оставленными вершинами) — тоже прочь
  function stretched(st, f, zones, maxLen) {
    const p = st.geo.attributes.position.array, I0 = st.I0, zn = st.zn, m2 = maxLen * maxLen;
    const d2 = (a, b) => { const x = p[a * 3] - p[b * 3], y = p[a * 3 + 1] - p[b * 3 + 1], z = p[a * 3 + 2] - p[b * 3 + 2]; return x * x + y * y + z * z; };
    for (let t = 0; t < st.nt; t++) {
      const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
      if (zones.indexOf(zn[a]) < 0 && zones.indexOf(zn[b]) < 0 && zones.indexOf(zn[c]) < 0) continue;
      if (d2(a, b) > m2 || d2(b, c) > m2 || d2(a, c) > m2) f[t] = 1;
    }
    return f;
  }
  // подол тренча на другую высоту: полы между краем (0.542) и бедром (0.80) сжимаются (или тянутся) к to
  function hemTo(to) {
    return ctx => {
      const { p, zn, moved, P0 } = ctx, Y1 = 0.80, Y0 = M.hem0 - 0.01;
      const ok = z => z === Z.coat_skirt || z === Z.coat_torso || z === Z.buttons || z === Z.belt;
      for (let i = 0; i < ctx.st.n; i++) {
        if (!ok(zn[i])) continue;
        const y = P0[i * 3 + 1];
        if (y >= Y1) continue;
        const k = (y - Y0) / (Y1 - Y0);
        p[i * 3 + 1] = to - 0.01 + k * (Y1 - to + 0.01);
        // ниже края — шире (как подол трапецией): к стрейчу вниз добавляем немного ширины
        if (to < M.hem0) { const f = 1 + 0.12 * (1 - clamp(k, 0, 1)) * (M.hem0 - to) / 0.07; p[i * 3] *= f; p[i * 3 + 2] = (P0[i * 3 + 2] - 0.01) * f + 0.01; }
        moved[i] = 1;
      }
    };
  }
  // пояс, пряжка, пуговицы и хлястики манжет — вровень с тканью (их место займёт новый крой)
  function flatten(what) {
    const W = new Set(what || ['belt', 'buttons', 'cuff']);
    return ctx => {
      const { st, p, zn, moved } = ctx, n = st.n, P0 = st.P0;
      // пояс: радиус от оси тела — как у ткани чуть выше и ниже (по азимуту)
      if (W.has('belt')) {
        const NB = 48, up = new Float32Array(NB), dn = new Float32Array(NB), cz = 0.025;
        const bin = (x, z) => ((Math.floor((Math.atan2(x, z - cz) + PI) / (2 * PI) * NB) % NB) + NB) % NB;
        for (let i = 0; i < n; i++) {
          const z0 = zn[i]; if (z0 !== Z.coat_torso && z0 !== Z.collar) continue;
          const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], r = Math.hypot(x, z - cz), b = bin(x, z);
          if (y > 1.045 && y < 1.08) up[b] = Math.max(up[b], r); else if (y > 0.92 && y < 0.955) dn[b] = Math.max(dn[b], r);
        }
        for (let i = 0; i < n; i++) {
          if (zn[i] !== Z.belt || Math.abs(P0[i * 3]) < 0.1) continue;
          const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], r = Math.hypot(x, z - cz), b = bin(x, z);
          const k = clamp((y - 0.95) / 0.1, 0, 1), rt = lerp(dn[b] || r, up[b] || r, k) - 0.002;
          if (r <= rt) continue;
          const f = rt / r; p[i * 3] = x * f; p[i * 3 + 2] = cz + (z - cz) * f; moved[i] = 1;
        }
      }
      if (W.has('buttons_z')) {
        // пуговица: точки диска — на плоскость ткани вокруг неё
        for (let i = 0; i < n; i++) {
          if (zn[i] !== Z.buttons) continue;
          const x = P0[i * 3], y = P0[i * 3 + 1];
          let best = 9, bz = 0;
          for (const [bx, by] of [[-0.055, 1.062], [0.055, 1.062], [-0.055, 0.929], [0.055, 0.929], [-0.055, 0.855], [0.055, 0.855]]) { const d = Math.hypot(x - bx, y - by); if (d < best) { best = d; bz = by; } }
          const zt = bz > 1 ? 0.098 : 0.101;
          if (P0[i * 3 + 2] > zt) { p[i * 3 + 2] = zt; moved[i] = 1; }
        }
      }
      if (W.has('cuff')) {
        // хлястик на рукаве: радиус от оси предплечья — как у рукава выше манжеты
        ['L', 'R'].forEach(sd => {
          const a = J('forearm_' + sd), b = J('hand_' + sd), ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], al = Math.hypot(ax[0], ax[1], ax[2]);
          const proj = (x, y, z) => { const t = ((x - a[0]) * ax[0] + (y - a[1]) * ax[1] + (z - a[2]) * ax[2]) / (al * al); const cx = a[0] + ax[0] * t, cy = a[1] + ax[1] * t, cz = a[2] + ax[2] * t; return [t, cx, cy, cz, Math.hypot(x - cx, y - cy, z - cz)]; };
          const s = sd === 'L' ? 1 : -1;
          let rRef = 0, cnt = 0;
          for (let i = 0; i < n; i++) { if (zn[i] !== Z.sleeve || P0[i * 3] * s < 0.05) continue; const q = proj(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]); if (q[0] > 0.55 && q[0] < 0.68) { rRef += q[4]; cnt++; } }
          rRef = cnt ? rRef / cnt : 0.05;
          for (let i = 0; i < n; i++) {
            if (zn[i] !== Z.cuff || P0[i * 3] * s < 0.05) continue;
            const q = proj(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]);
            const rt = rRef * (q[0] > 0.9 ? 0.95 : 1.0);
            if (q[4] <= rt) continue;
            const f = rt / q[4];
            p[i * 3] = q[1] + (P0[i * 3] - q[1]) * f; p[i * 3 + 1] = q[2] + (P0[i * 3 + 1] - q[2]) * f; p[i * 3 + 2] = q[3] + (P0[i * 3 + 2] - q[3]) * f; moved[i] = 1;
          }
        });
      }
    };
  }
  // гладкий перед: лацканы, воротник-отворот и край двубортной полы тренча ложатся на гладкую поверхность груди
  // (кардиган, платье на запах, корсет без лацканов). Поверхность — МНК-подгонка z(x, y) по точкам переда без выступов
  function smoothFront(o) {
    o = o || {};
    const y0 = o.y0 || 0.86, y1 = o.y1 || 1.25, X = o.x || 0.17;
    return ctx => {
      const { st, p, zn, moved, P0 } = ctx, n = st.n;
      const zs = new Set(['coat_torso', 'collar', 'belt', 'buttons'].map(nm => Z[nm]));
      const idx = [];
      for (let i = 0; i < n; i++) { if (!zs.has(zn[i])) continue; const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2]; if (z > 0.0 && y > y0 && y < y1 && Math.abs(x) < X) idx.push(i); }
      if (idx.length < 50) return;
      const fb = (x, y) => { const v = (y - 1.05) / 0.2; return [1, x * x, v, v * v, x * x * v, x]; };
      const NB = 6;
      let c = new Float64Array(NB), use = idx.map(() => 1);
      for (let pass = 0; pass < 4; pass++) {
        const A = new Float64Array(NB * NB), b = new Float64Array(NB);
        idx.forEach((i, q) => {
          if (!use[q]) return;
          const f = fb(P0[i * 3], P0[i * 3 + 1]), z = P0[i * 3 + 2];
          for (let r = 0; r < NB; r++) { b[r] += f[r] * z; for (let k = 0; k < NB; k++) A[r * NB + k] += f[r] * f[k]; }
        });
        for (let r = 0; r < NB; r++) A[r * NB + r] += 1e-6;
        c = solve(A, b, NB);
        // выступы (лацканы, пуговицы) — над поверхностью: из подгонки их убираем
        idx.forEach((i, q) => { const f = fb(P0[i * 3], P0[i * 3 + 1]); let z = 0; for (let k = 0; k < NB; k++) z += c[k] * f[k]; use[q] = P0[i * 3 + 2] - z < 0.003 ? 1 : 0; });
      }
      const top = o.keepTop == null ? 0.03 : o.keepTop, lift = o.lift == null ? 0.006 : o.lift;
      // изнанка пуговиц и пряжки (грани «внутрь», их и так не видно) — прочь маской: сплющенные, они дали бы контур-кольца
      const I0 = st.I0, N0 = st.N0, mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
      for (let t = 0; t < st.nt; t++) {
        const a0 = I0[t * 3], b0 = I0[t * 3 + 1], c0 = I0[t * 3 + 2];
        const za = zn[a0], zb = zn[b0], zc = zn[c0];
        if (!((za === Z.buttons || za === Z.belt) && (zb === Z.buttons || zb === Z.belt) && (zc === Z.buttons || zc === Z.belt))) continue;
        if (P0[a0 * 3 + 2] < 0.0 || Math.abs(P0[a0 * 3]) > X) continue;
        const ux = P0[b0 * 3] - P0[a0 * 3], uy = P0[b0 * 3 + 1] - P0[a0 * 3 + 1], vx = P0[c0 * 3] - P0[a0 * 3], vy = P0[c0 * 3 + 1] - P0[a0 * 3 + 1];
        if (ux * vy - uy * vx <= 0) mh[t] = 1;
      }
      idx.forEach(i => {
        const x = P0[i * 3], y = P0[i * 3 + 1], f = fb(x, y);
        let z = 0; for (let k = 0; k < NB; k++) z += c[k] * f[k];
        const cur = p[i * 3 + 2];
        // выступы — вниз на поверхность; впадины (пояс, пуговицы вдавлены) — вверх, но не больше lift
        let tgt = z + 0.0015;
        // пояс с пряжкой и пуговицы (с ободками) — ровно на поверхность, в обе стороны
        const full = zn[i] === Z.belt || zn[i] === Z.buttons || (y > 0.952 && y < 1.048) || BTN.some(q => Math.hypot(x - q[0], y - q[1]) < 0.027);
        // сами пуговицы и пояс — вровень с тканью (их стенки-«изнанку» прячет unfold, контур их не обводит)
        if (zn[i] === Z.belt || zn[i] === Z.buttons) tgt = z + 0.0008;
        if (cur < tgt && !full) { if (!o.both) return; tgt = Math.min(tgt, cur + lift); }
        const w = sst(y1, y1 - top, y) * sst(y0, y0 + 0.03, y) * sst(X, X - 0.03, Math.abs(x));
        p[i * 3 + 2] = lerp(cur, tgt, w); moved[i] = 1;
      });
      // o.fins: «плавники» (кончики лацканов, клапаны), оставшиеся боком к зрителю на прижатом переде, — прочь маской
      if (o.fins) {
        const inR = new Uint8Array(n);
        idx.forEach(i => { const x = P0[i * 3], y = P0[i * 3 + 1]; if (sst(y1, y1 - top, y) * sst(y0, y0 + 0.03, y) * sst(X, X - 0.03, Math.abs(x)) > 0.5) inR[i] = 1; });
        for (let t = 0; t < st.nt; t++) {
          const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
          if (!inR[a] || !inR[b] || !inR[c]) continue;
          const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
          if (nl < 1e-12) continue;
          if (nz / nl < 0.25 && Math.abs(ny / nl) < 0.6) mh[t] = 1;
        }
      }
    };
  }
  const BTN = [[-0.055, 1.062], [0.055, 1.062], [-0.055, 0.929], [0.055, 0.929], [-0.055, 0.855], [0.055, 0.855]];
  function solve(A, b, n) {
    const M2 = A.slice(), x = b.slice();
    for (let k = 0; k < n; k++) {
      let piv = k; for (let r = k + 1; r < n; r++) if (Math.abs(M2[r * n + k]) > Math.abs(M2[piv * n + k])) piv = r;
      if (piv !== k) { for (let j = 0; j < n; j++) { const t = M2[k * n + j]; M2[k * n + j] = M2[piv * n + j]; M2[piv * n + j] = t; } const t = x[k]; x[k] = x[piv]; x[piv] = t; }
      const d = M2[k * n + k] || 1e-12;
      for (let r = k + 1; r < n; r++) { const f = M2[r * n + k] / d; if (!f) continue; for (let j = k; j < n; j++) M2[r * n + j] -= f * M2[k * n + j]; x[r] -= f * x[k]; }
    }
    for (let k = n - 1; k >= 0; k--) { let s = x[k]; for (let j = k + 1; j < n; j++) s -= M2[k * n + j] * x[j]; x[k] = s / (M2[k * n + k] || 1e-12); }
    return x;
  }
  // «утюг»: выступы тренча (лацканы, клапаны карманов, нахлёст двубортной полы, пояс со шлёвками, пуговицы)
  // прижимаются к гладкой ткани под ними. Цилиндр вокруг оси тела: в ячейке (азимут, высота) опорный радиус —
  // наименьший радиус ткани (под лацканом и клапаном есть грудь и пола); полоса пояса и пуговицы в опору не входят —
  // там опора тянется по высоте от ткани выше и ниже. Слои сохраняют порядок (толщина выступа × c — без мерцания),
  // изнанка складок (грани «внутрь») прячется маской — её контур не просвечивает.
  function iron(o) {
    o = o || {};
    return ctx => {
      const { st, p, zn, moved } = ctx, n = st.n;
      const y0 = o.y0 == null ? 0.5 : o.y0, y1 = o.y1 == null ? 1.22 : o.y1, c = o.c == null ? 0.12 : o.c, eps = o.eps == null ? 0.0012 : o.eps, CZ = 0.012;
      const zIr = new Set((o.zones || ['coat_torso', 'coat_skirt', 'collar', 'belt', 'buttons']).map(nm => Z[nm]));
      const zBase = new Set(['coat_torso', 'coat_skirt', 'collar'].map(nm => Z[nm]));
      const xs = o.x == null ? 9 : o.x;
      const NA = 120, DY = 0.008, NY = Math.ceil((y1 + 0.03 - (y0 - 0.03)) / DY) + 1, Y0 = y0 - 0.03;
      const ab = (x, z) => { const f = (Math.atan2(x, z - CZ) + PI) / (2 * PI) * NA; return f; };
      const G = new Float32Array(NA * NY).fill(9), I0 = st.I0;
      // опора — растр наружных граней ткани (сетка редкая: по одним вершинам ячейки пустые или «с изнанки»)
      const inBand = (x, y, z) => (y > 0.942 && y < 1.058) || (z > 0.05 && BTN.some(q => Math.hypot(x - q[0], y - q[1]) < 0.026));
      const ta = [0, 0, 0], ty = [0, 0, 0], tr = [0, 0, 0];
      for (let t = 0; t < st.nt; t++) {
        const v = [I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]];
        if (!zBase.has(zn[v[0]]) || !zBase.has(zn[v[1]]) || !zBase.has(zn[v[2]])) continue;
        let skip = false, cx = 0, cz2 = 0;
        for (let k = 0; k < 3; k++) {
          const x = p[v[k] * 3], y = p[v[k] * 3 + 1], z = p[v[k] * 3 + 2];
          if (y < Y0 - DY || y > y1 + 0.04 || inBand(x, y, z)) { skip = true; break; }
          ta[k] = ab(x, z); ty[k] = (y - Y0) / DY; tr[k] = Math.hypot(x, z - CZ); cx += x; cz2 += z - CZ;
        }
        if (skip) continue;
        // только грани наружу (изнанка полы и подкладка — глубже, в опору не идут)
        const A = v[0] * 3, B2 = v[1] * 3, C2 = v[2] * 3;
        const ux = p[B2] - p[A], uy = p[B2 + 1] - p[A + 1], uz = p[B2 + 2] - p[A + 2], vx = p[C2] - p[A], vy = p[C2 + 1] - p[A + 1], vz = p[C2 + 2] - p[A + 2];
        const fx = uy * vz - uz * vy, fz = ux * vy - uy * vx, fl = Math.hypot(fx, uz * vx - ux * vz, fz) || 1, cl = Math.hypot(cx, cz2) || 1;
        if ((fx * cx + fz * cz2) / (fl * cl) < 0.25) continue;
        if (Math.max(ta[0], ta[1], ta[2]) - Math.min(ta[0], ta[1], ta[2]) > NA / 2) continue;
        const area = (ta[1] - ta[0]) * (ty[2] - ty[0]) - (ta[2] - ta[0]) * (ty[1] - ty[0]);
        if (Math.abs(area) < 1e-9) continue;
        const ia = 1 / area;
        const a0 = Math.floor(Math.min(ta[0], ta[1], ta[2])), a1 = Math.ceil(Math.max(ta[0], ta[1], ta[2])), b0 = Math.floor(Math.min(ty[0], ty[1], ty[2])), b1 = Math.ceil(Math.max(ty[0], ty[1], ty[2]));
        for (let yb = Math.max(0, b0); yb <= Math.min(NY - 1, b1); yb++) for (let aa = a0; aa <= a1; aa++) {
          const px = aa + 0.5, py = yb;
          const w0 = ((ta[2] - ta[1]) * (py - ty[1]) - (ty[2] - ty[1]) * (px - ta[1])) * ia, w1 = ((ta[0] - ta[2]) * (py - ty[2]) - (ty[0] - ty[2]) * (px - ta[2])) * ia, w2 = 1 - w0 - w1;
          if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
          const r = w0 * tr[0] + w1 * tr[1] + w2 * tr[2], k = yb * NA + ((aa % NA) + NA) % NA;
          if (r < G[k]) G[k] = r;
        }
      }
      // пустые ячейки: по высоте — между ближайшими заполненными, потом соседние азимуты
      for (let a = 0; a < NA; a++) {
        let last = -1;
        for (let yb = 0; yb < NY; yb++) {
          if (G[yb * NA + a] > 8) continue;
          if (last >= 0 && yb - last > 1) { const v0 = G[last * NA + a], v1 = G[yb * NA + a]; for (let q = last + 1; q < yb; q++) G[q * NA + a] = lerp(v0, v1, (q - last) / (yb - last)); }
          if (last < 0) for (let q = 0; q < yb; q++) G[q * NA + a] = G[yb * NA + a];
          last = yb;
        }
        if (last >= 0) for (let q = last + 1; q < NY; q++) G[q * NA + a] = G[last * NA + a];
      }
      for (let pass = 0; pass < NA; pass++) {
        let any = false;
        for (let a = 0; a < NA; a++) { if (G[a] < 8) continue; any = true; const l = (a + NA - 1) % NA, r = (a + 1) % NA; if (G[l] < 8 || G[r] < 8) for (let yb = 0; yb < NY; yb++) G[yb * NA + a] = G[l] < 8 ? G[yb * NA + l] : G[yb * NA + r]; }
        if (!any) break;
      }
      // опора без шума: минимум 3×3, затем сглаживание 3×3 дважды
      const T = new Float32Array(NA * NY);
      const at2 = (A, a, yb) => A[clamp(yb, 0, NY - 1) * NA + ((a % NA) + NA) % NA];
      for (let yb = 0; yb < NY; yb++) for (let a = 0; a < NA; a++) { let m = 9; for (let dy = -1; dy <= 1; dy++) for (let da = -1; da <= 1; da++) m = Math.min(m, at2(G, a + da, yb + dy)); T[yb * NA + a] = m; }
      for (let it = 0; it < 2; it++) {
        for (let yb = 0; yb < NY; yb++) for (let a = 0; a < NA; a++) { let s2 = 0; for (let dy = -1; dy <= 1; dy++) for (let da = -1; da <= 1; da++) s2 += at2(T, a + da, yb + dy); G[yb * NA + a] = s2 / 9; }
        T.set(G);
      }
      const base = (x, y, z) => {
        const f = ab(x, z) - 0.5, a0 = Math.floor(f), ka = f - a0, fy = clamp((y - Y0) / DY, 0, NY - 1.001), y0i = Math.floor(fy), ky = fy - y0i;
        return lerp(lerp(at2(T, a0, y0i), at2(T, a0 + 1, y0i), ka), lerp(at2(T, a0, y0i + 1), at2(T, a0 + 1, y0i + 1), ka), ky);
      };
      const dd = st.ironD || (st.ironD = new Float32Array(n));
      for (let i = 0; i < n; i++) {
        if (!zIr.has(zn[i])) continue;
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        if (y < y0 || y > y1 || Math.abs(x) > xs) continue;
        const r = Math.hypot(x, z - CZ), r0 = base(x, y, z), d = r - r0;
        // плавно к краям полосы (y0, y1)
        const w = sst(y0, y0 + 0.03, y) * sst(y1, y1 - 0.03, y);
        if (d <= eps || w <= 0) continue;
        const rn = lerp(r, r0 + eps + (d - eps) * c, w), f = rn / r;
        p[i * 3] = x * f; p[i * 3 + 2] = CZ + (z - CZ) * f; moved[i] = 1;
        dd[i] = Math.max(dd[i], (d - eps) * w);
      }
      // изнанка выступов: грани, смотревшие к оси тела, у которых все три точки были выступом — прочь
      const N0 = st.N0, P0 = st.P0, mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
      for (let t = 0; t < st.nt; t++) {
        const a = I0[t * 3], b = I0[t * 3 + 1], c2 = I0[t * 3 + 2];
        if (!(dd[a] > 0.002 && dd[b] > 0.002 && dd[c2] > 0.002)) continue;
        const nx = N0[a * 3] + N0[b * 3] + N0[c2 * 3], nz = N0[a * 3 + 2] + N0[b * 3 + 2] + N0[c2 * 3 + 2];
        const rx = P0[a * 3], rz = P0[a * 3 + 2] - CZ, rl = Math.hypot(rx, rz) || 1, nl = Math.hypot(nx, N0[a * 3 + 1] + N0[b * 3 + 1] + N0[c2 * 3 + 1], nz) || 1;
        if ((nx * rx + nz * rz) / (rl * nl) < -0.25) mh[t] = 1;
      }
    };
  }
  // «плавники» лацканов на верхе груди (кончики лацканов у плеч, оставшиеся боком к зрителю после прижатия) — прочь
  // маской: грани ткани спереди (|x| < o.x, y0..y1), смотрящие не вперёд и не вверх
  function finsHide(o) {
    o = o || {};
    const X = o.x || 0.16, y0 = o.y0 || 1.12, y1 = o.y1 || 1.31;
    return ctx => {
      const { st, p, zn } = ctx, I0 = st.I0, mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
      const ok = new Uint8Array(32); ['coat_torso', 'collar', 'buttons', 'belt'].forEach(nm => { ok[Z[nm]] = 1; });
      for (let t = 0; t < st.nt; t++) {
        const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
        if (!ok[zn[a]] || !ok[zn[b]] || !ok[zn[c]]) continue;
        const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3, cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
        if (cy < y0 || cy > y1 || Math.abs(cx) > X || cz < 0.0) continue;
        const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-12) continue;
        if (nz / nl < 0.2 && Math.abs(ny / nl) < 0.6) mh[t] = 1;
      }
    };
  }
  // распах полы геометрией (без «рваной бумаги» краски): грани переда (тренч, пояс, пуговицы), целиком лежащие в полосе
  // edge(y) = [xl, xr] ниже yt, — прочь маской; у граней, вышедших из полосы хоть одной вершиной, вершины внутри едут по
  // своему ребру до края полосы (край прямой, грань остаётся на своей ткани: слои двубортной полы не перемешиваются).
  // За распахом — одежда (брюки) и изнанка спинки (двусторонний материал героини — темнее). Копии вершины (швы UV) едут вместе.
  function openFront(o) {
    return ctx => {
      const { st, p, moved } = ctx, I0 = st.I0, tz = st.tz, wid = st.wid, yt = o.yt, z0 = o.z0 == null ? 0.02 : o.z0;
      const zs = new Uint8Array(32); (o.zones || ['coat_torso', 'coat_skirt', 'belt', 'buttons']).forEach(nm => { zs[Z[nm]] = 1; });
      const inP = (x, y, z) => { if (y >= yt || z < z0) return false; const e = o.edge(y); return x > e[0] && x < e[1]; };
      const inside = v => inP(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
      const mh = st.morphHide || (st.morphHide = new Uint8Array(st.nt));
      const keep = [];
      for (let t = 0; t < st.nt; t++) {
        if (!zs[tz[t]]) continue;
        const ia = inside(I0[t * 3]), ib = inside(I0[t * 3 + 1]), ic = inside(I0[t * 3 + 2]);
        if (!ia && !ib && !ic) continue;
        if (ia && ib && ic) { mh[t] = 1; continue; }
        keep.push(t);
      }
      // вершина внутри -> ближайшая точка выхода из полосы по рёбрам к вершинам снаружи (деление пополам)
      const best = new Float32Array(st.ng).fill(9), tgt = new Float32Array(st.ng * 3), q3 = [0, 0, 0];
      keep.forEach(t => {
        const vs = [I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]];
        vs.forEach(v => {
          if (!inside(v)) return;
          const g = wid[v];
          vs.forEach(u => {
            if (inside(u)) return;
            let lo = 0, hi = 1;
            for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; for (let j = 0; j < 3; j++) q3[j] = lerp(p[v * 3 + j], p[u * 3 + j], m); if (inP(q3[0], q3[1], q3[2])) lo = m; else hi = m; }
            const d = hi * Math.hypot(p[u * 3] - p[v * 3], p[u * 3 + 1] - p[v * 3 + 1], p[u * 3 + 2] - p[v * 3 + 2]);
            if (d < best[g]) { best[g] = d; for (let j = 0; j < 3; j++) tgt[g * 3 + j] = lerp(p[v * 3 + j], p[u * 3 + j], hi); }
          });
        });
      });
      // грань, которую сдвиг растянул бы поперёк распаха (вершина уехала к другому краю), — прочь (редко)
      const at = (v, j) => (inside(v) && best[wid[v]] < 8 ? tgt[wid[v] * 3 + j] : p[v * 3 + j]);
      const len = (a, b, f) => Math.hypot(f(a, 0) - f(b, 0), f(a, 1) - f(b, 1), f(a, 2) - f(b, 2));
      const cur = (v, j) => p[v * 3 + j];
      let nh = 0;
      keep.forEach(t => {
        const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
        if ([a, b, c].some(v => inside(v) && best[wid[v]] > 8)) { mh[t] = 1; nh++; return; }
        if ([[a, b], [b, c], [a, c]].some(([u, v]) => len(u, v, at) > Math.max(0.04, 1.6 * len(u, v, cur)))) { mh[t] = 1; nh++; }
      });
      let nm = 0;
      for (let v = 0; v < st.n; v++) {
        const g = wid[v];
        if (best[g] > 8 || !inside(v)) continue;
        p[v * 3] = tgt[g * 3]; p[v * 3 + 1] = tgt[g * 3 + 1]; p[v * 3 + 2] = tgt[g * 3 + 2]; moved[v] = 1; nm++;
      }
      stats.open = { kept: keep.length, moved: nm, hidKept: nh };
    };
  }
  // рукав относительно оси руки: fn(t вдоль предплечья 0..1 (у плеча < 0), r, sd) -> множитель радиуса
  function sleeveShape(fn, zonesList) {
    return ctx => {
      const zs = new Set((zonesList || ['sleeve', 'cuff']).map(nm => Z[nm])), { st, p, zn, moved } = ctx, n = st.n;
      ['L', 'R'].forEach(sd => {
        const s = sd === 'L' ? 1 : -1, u0 = J('upperarm_' + sd), a = J('forearm_' + sd), b = J('hand_' + sd);
        for (let i = 0; i < n; i++) {
          if (!zs.has(zn[i])) continue;
          const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
          if (x * s < 0.085) continue;
          // ближайший отрезок оси: плечо -> локоть или локоть -> запястье
          const seg = (A, B) => { const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2], l2 = ax * ax + ay * ay + az * az, t = clamp(((x - A[0]) * ax + (y - A[1]) * ay + (z - A[2]) * az) / l2, 0, 1); const cx = A[0] + ax * t, cy = A[1] + ay * t, cz = A[2] + az * t; return [t, cx, cy, cz, Math.hypot(x - cx, y - cy, z - cz)]; };
          const q1 = seg(u0, a), q2 = seg(a, b), q = q2[4] <= q1[4] ? q2 : q1, tt = q === q2 ? q2[0] : q1[0] - 1;
          const k = fn(tt, q[4], sd);
          if (Math.abs(k - 1) < 1e-4) continue;
          p[i * 3] = q[1] + (x - q[1]) * k; p[i * 3 + 1] = q[2] + (y - q[2]) * k; p[i * 3 + 2] = q[3] + (z - q[3]) * k;
          moved[i] = 1;
        }
      });
    };
  }

  // голая рука вместо рукава тренча: круглое сечение вокруг оси руки (плечо 0.044 → локоть 0.04 → запястье 0.03) —
  // без складок, манжеты и хлястика; у плеча (под пелериной/лифом) — как было
  const bareArm = () => sleeveShape((t, r) => {
    const R = t < 0 ? lerp(0.044, 0.04, clamp(t + 1, 0, 1)) : lerp(0.04, 0.03, sst(0, 1, t)), w = sst(-0.85, -0.6, t);
    return r > 1e-4 ? lerp(1, R / r, w) : 1;
  }, ['sleeve', 'cuff']);

  // голени под юбкой в пол — тоньше (к оси кости до доли k): на шаге не проступают сквозь подол; щиколотка и стопа —
  // как есть (выше 0.36 ноги и так спрятаны маской)
  function slimShins(k) {
    return ctx => {
      const { st, p, zn, moved, P0 } = ctx;
      ['L', 'R'].forEach(sd => {
        const s = sd === 'L' ? 1 : -1, a = J('shin_' + sd), b = J('foot_' + sd);
        for (let i = 0; i < st.n; i++) {
          if (zn[i] !== Z.legs || P0[i * 3] * s < 0) continue;
          const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2];
          if (y < 0.12 || y > 0.47) continue;
          const t = clamp((a[1] - y) / (a[1] - b[1]), 0, 1), cx = lerp(a[0], b[0], t), cz = lerp(a[2], b[2], t), f = lerp(1, k, sst(0.12, 0.2, y));
          p[i * 3] = cx + (x - cx) * f; p[i * 3 + 2] = cz + (z - cz) * f; moved[i] = 1;
        }
      });
    };
  }

  /* ---------- раскраска: волосы, кожа, крой «открытого» пиджака ---------- */
  // кожа — как у самой текстуры героини (лицо, руки: медиана 246/191/164)
  const SKIN = [244, 189, 162];
  // волосы: цвет образа × объём и пряди автора; купол на месте берета — пряди от пробора и блик
  function hairPaint(h) {
    const B = tc(h.base), Dk = tc(h.dark), Lt = tc(h.light), Tp = h.tips ? tc(h.tips) : null, part = h.part || 0, out = [0, 0, 0], tmp = [0, 0, 0];
    const C = M.crownC;
    const DOME = mix3(Dk, B, 0.8);
    const hair = (x, y, z, o) => {
      o.k = h.keep == null ? 0.55 : h.keep; o.lo = 0.4; o.hi = 1.75; o.g = 0.9;
      let c = B;
      if (Tp && y < 1.2) c = mix3(B, Tp, sst(1.18, 0.95, y) * 0.85, out);
      // под краем купола у автора — тень от берета: светлее и ровнее, цвет — к куполу (шов не виден)
      const dm = o.st && o.st.dome;
      if (dm && y > 1.5) {
        const dx = x - dm.C[0], dy = y - dm.C[1], dz = z - dm.C[2], r = Math.hypot(dx, dy, dz) || 1, az = Math.atan2(dx, dz);
        const e = Math.asin(clamp(dy / r, -1, 1)), e0 = dm.at(dm.elS, az), w = sst(e0 - 0.32, e0 - 0.04, e);
        if (w > 0) { o.lo = lerp(0.4, 0.9, w); o.hi = lerp(1.75, 0.98, w); o.k = lerp(o.k, 0.15, w); c = mix3(c, DOME, w, tmp); }
      }
      return c;
    };
    // купол: пряди идут от пробора вбок и вниз, у пробора чуть светлее кожа (тонкая линия), блик-полоса
    const strands = (x, y, z, o) => {
      o.f = 1;
      const dx = x - part, front = z > C[2] - 0.02 ? 1 : 0;
      // направление пряди: от пробора к виску — угол по окружности вокруг оси пробора
      const az = Math.atan2(Math.abs(dx), (y - C[1]) + 0.05) * (dx < 0 ? -1 : 1);
      const ang = Math.atan2(z - C[2] + 0.02, Math.abs(dx) + 0.02);
      const w = 0.55 * Math.sin(ang * 46 + Math.sin(az * 9) * 0.7) + 0.45 * Math.sin(ang * 17 + az * 3);
      // h.partLen — пробор только на столько от линии лба (≈ z 0.12) назад
      const pd = Math.abs(dx), partLine = front && z > -0.2 ? Math.exp(-(pd / 0.006) * (pd / 0.006)) * (h.partLen ? sst(0.1 - h.partLen, 0.13 - h.partLen, z) : 1) : 0;
      const ey = (y - C[1]) / 0.28, shine = Math.exp(-Math.pow((ey - 0.82) / 0.07, 2)) * (h.gloss == null ? 0.22 : h.gloss);
      // у края купола полосы мягче и тон — как у волос под ним
      const dm = o.st && o.st.dome;
      let fade = 1;
      if (dm) { const ddx = x - dm.C[0], ddy = y - dm.C[1], ddz = z - dm.C[2], rr = Math.hypot(ddx, ddy, ddz) || 1, e = Math.asin(clamp(ddy / rr, -1, 1)), e0 = dm.at(dm.elS, Math.atan2(ddx, ddz)); fade = sst(e0 - 0.05, e0 + 0.2, e); }
      const k = lerp(0.92, 0.96 + 0.07 * w + shine, fade);
      mix3(Dk, B, 0.8, tmp);
      out[0] = tmp[0] * k; out[1] = tmp[1] * k; out[2] = tmp[2] * k;
      if (partLine > 0.01) mix3(out, h.partSkin ? SKIN : Dk, partLine * (h.partSkin || 0.6), out);
      return out;
    };
    return { hair, strands };
  }
  // спереди «открытый» перед пиджака/пальто/кардигана на месте двубортного тренча: [слева x, справа x] на высоте y
  function openAt(y, o) {
    o = o || {};
    const hw = o.w || 1;
    if (y >= 1.175) { const k = clamp((1.255 - y) / 0.08, 0, 1); return [lerp(-0.047, -0.002, k), lerp(0.05, 0.002, k)]; }
    const t = clamp((1.175 - y) / 0.175, 0, 1), t2 = clamp((1.0 - y) / 0.15, 0, 1);
    const xl = -0.002 - (0.058 * t + 0.014 * t2) * hw, xr = 0.002 + (0.063 * t + 0.023 * t2) * hw;
    return [xl, Math.min(xr, 0.089)];
  }
  // пиджак: o = { main (fn или цвет), edge, top(x,y,z,o) — что под пиджаком выше талии, bottom(...) — ниже, neckY — до какой
  // высоты кожа в вырезе, waist, hem (край), w (ширина распаха) }
  function jacket(o) {
    const out = [0, 0, 0], E = o.edge ? tc(o.edge) : null;
    const main = typeof o.main === 'function' ? o.main : (() => { const c = tc(o.main); return () => c; })();
    const neckY = o.neckY || 1.18, waist = o.waist || 1.0;
    return (x, y, z, q) => {
      // спина и бока — ткань пиджака
      if (z > 0.03 && y > 0.5 && y < 1.3) {
        const [xl, xr] = o.open ? o.open(y) : openAt(y, o);
        if (x > xl && x < xr) {
          // вырез: кожа выше горловины топа
          if (y > neckY && o.skinV !== false) { q.k = 0.9; return SKIN; }
          const f = y > waist ? o.top : o.bottom;
          q.flat = 0;
          const c = f ? f(x, y, z, q) : null;
          q.k = 0; q.lo = Math.max(q.lo, 0.72); q.hi = Math.min(q.hi, 1.15);
          // o.flat: ткань под пиджаком ровным цветом
          if (q.flat) q.f = 1;
          if (c) {
            // тень от борта пиджака на топе (2 см у края)
            const d = Math.min(x - xl, xr - x), sh = 1 - 0.28 * sst(0.022, 0, d);
            out[0] = c[0] * sh; out[1] = c[1] * sh; out[2] = c[2] * sh;
            return out;
          }
        }
        // кромка борта — светлая полоса толщины ткани у края
        if (E && x > xl - 0.008 && x < xr + 0.008 && y < 1.175) { q.k = 0.2; return E; }
      }
      return main(x, y, z, q);
    };
  }
  // кожа (вырез, голые руки): цвет кожи модели
  const skinFn = (x, y, z, o) => { o.k = 0.8; return SKIN; };
  const solid = h => { const c = tc(h); return (x, y, z, o) => c; };
  const flatC = h => { const c = tc(h); return (x, y, z, o) => { o.f = 1; return c; }; };

  /* ---------- одежда-детали (метры модели, поза покоя) ---------- */
  // предел изнутри пальто: наибольший радиус ткани тренча (уже перелепленной образом, вместе со спрятанными гранями
  // распаха) по азимуту вокруг оси тела и высоте; одежда под пальто — не дальше предела минус m (не проступает наружу)
  // outer — огибающая снаружи (для накидки и пластины поверх ткани): пустые ячейки и сглаживание — по максимуму
  function coatLimit(st, m, zones, dy, outer) {
    if (!st) return null;
    const p = st.geo.attributes.position.array, zn = st.zn, NA = 48, Y0 = 0.4, DY = dy || 0.02, NY = Math.ceil(1.0 / DY), G = new Float32Array(NA * NY);
    const zs = new Uint8Array(32); (zones || ['coat_torso', 'coat_skirt', 'belt', 'buttons', 'collar']).forEach(nm => { zs[Z[nm]] = 1; });
    const ai = (x, z) => ((Math.floor((Math.atan2(x, z) + PI) / (2 * PI) * NA) % NA) + NA) % NA;
    for (let i = 0; i < st.n; i++) {
      if (!zs[zn[i]]) continue;
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], yb = Math.floor((y - Y0) / DY);
      if (yb < 0 || yb >= NY) continue;
      const k = yb * NA + ai(x, z), r = Math.hypot(x, z);
      if (r > G[k]) G[k] = r;
    }
    // пустые ячейки — по соседям (сначала азимут, потом высота); предел — минимум по соседям (осторожно)
    for (let pass = 0; pass < 8; pass++) for (let yb = 0; yb < NY; yb++) for (let a = 0; a < NA; a++) {
      const k = yb * NA + a; if (G[k] > 0) continue;
      const l = G[yb * NA + (a + NA - 1) % NA], r = G[yb * NA + (a + 1) % NA], u = yb < NY - 1 ? G[k + NA] : 0, d = yb > 0 ? G[k - NA] : 0;
      const c = [l, r, u, d].filter(v => v > 0); if (c.length) G[k] = outer ? Math.max.apply(null, c) : Math.min.apply(null, c);
    }
    const T = new Float32Array(NA * NY);
    for (let yb = 0; yb < NY; yb++) for (let a = 0; a < NA; a++) {
      let mn = 9, mx = 0; for (let dy = -1; dy <= 1; dy++) for (let da = -1; da <= 1; da++) { const y2 = clamp(yb + dy, 0, NY - 1), v = G[y2 * NA + (a + da + NA) % NA]; if (v > 0) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
      T[yb * NA + a] = outer ? (mx > 0 ? mx - m : 0.15) : mn > 8 ? 9 : mn - m;
    }
    return (x, y, z) => { const yb = clamp(Math.floor((y - Y0) / DY), 0, NY - 1); return T[yb * NA + ai(x, z)]; };
  }
  // кольцо трубы внутри предела lim: множитель k(a) по азимуту кольца (деление пополам), точка не дальше предела
  function ringIn(R, lim) {
    R.k = a => {
      const off = R.off ? R.off(a) : 0, sa = Math.sin(a), ca = Math.cos(a);
      const at = k => { const x = R.c[0] + sa * (R.rx + off) * k, z = R.c[2] + ca * (R.rz + off) * k; return Math.hypot(x, z) - lim(x, R.c[1], z); };
      if (at(1) <= 0) return 1;
      let lo = 0.2, hi = 1;
      for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m) <= 0) lo = m; else hi = m; }
      return lo;
    };
    return R;
  }
  // брюки: две трубы от талии до пола; веса таз -> бедро -> голень (шаг, посадка)
  // o.seat = { y0, rx, rz, cz }: выше y0 обе штанины сходятся в одно сечение (гладкий перед брюк в распахе пальто)
  function trousers(B, o) {
    const col = tc(o.col), lt = o.light ? tc(o.light) : col, dk = o.dark ? tc(o.dark) : col;
    const top = o.top || 0.86, hem = o.hem == null ? 0.012 : o.hem, NR = o.rings || 18, seg = o.seg || 16, SE = o.seat;
    const seatK = y => (SE ? sst(SE.y0, top, y) : 0), lim = o.inCoat ? coatLimit(LASTST, o.inCoat.m) : null;
    // o.inShell = { S, m, y0 } — внутри поверхности тела + m (под новым кроем пиджака): радиус от оси тела по азимуту
    const IS = o.inShell, shLim = IS ? (x, y, z) => shellR(IS.S, Math.atan2(x, z - SH_CZ), y) + IS.m : null;
    const ringInSh = R => {
      R.k = a => {
        const off = R.off ? R.off(a) : 0, sa = Math.sin(a), ca = Math.cos(a);
        const at = k => { const x = R.c[0] + sa * (R.rx + off) * k, z = R.c[2] + ca * (R.rz + off) * k; return Math.hypot(x, z - SH_CZ) - shLim(x, R.c[1], z); };
        if (at(1) <= 0) return 1;
        let lo = 0.2, hi = 1;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m) <= 0) lo = m; else hi = m; }
        return lo;
      };
      return R;
    };
    ['L', 'R'].forEach(sd => {
      const s = sd === 'L' ? 1 : -1, hip = J('thigh_' + sd), knee = J('shin_' + sd);
      const rings = [];
      for (let r = 0; r < NR; r++) {
        const t = r / (NR - 1), y = lerp(top, hem, t), kS = seatK(y);
        const cx = s * lerp(0.064, o.hemX || 0.072, sst(0.0, 1, t)), cz = lerp(0.012, 0.012, t);
        const wk = sst(0, 0.55, t);
        const rx = lerp(o.hipR || 0.088, o.wide || 0.118, wk), rz = lerp(o.hipRz || 0.098, (o.wide || 0.118) * 0.96, wk);
        const flat = (o.split == null ? 0.35 : o.split) * sst(0.15, 0.6, t) * (1 - kS);
        const R = kS > 0 ? { c: [lerp(cx + s * flat * 0.02, 0, kS), y, lerp(cz, SE.cz, kS)], rx: lerp(rx, SE.rx, kS), rz: lerp(rz, SE.rz, kS), off: a => -Math.max(0, -Math.sin(a) * s) * rx * flat }
          : { c: [cx + s * flat * 0.02, y, cz], rx, rz, off: a => -Math.max(0, -Math.sin(a) * s) * rx * flat };
        rings.push(lim && y > o.inCoat.y0 ? ringIn(R, lim) : shLim && y > IS.y0 ? ringInSh(R) : R);
      }
      B.tube(rings, seg, (ri, si, p, a) => {
        const y = p[1];
        let w;
        if (y > hip[1] + 0.02) w = mixW('hips', 'thigh_' + sd, sst(top, hip[1] + 0.02, y) * 0.5);
        else if (y > knee[1] + 0.07) w = mixW('hips', 'thigh_' + sd, 0.5 + 0.5 * sst(hip[1] + 0.02, hip[1] - 0.08, y));
        else w = mixW('thigh_' + sd, 'shin_' + sd, sst(knee[1] + 0.07, knee[1] - 0.05, y));
        // стрелка спереди светлее, складки по бокам темнее, внутренняя сторона в тени
        const fr = Math.cos(a), side = Math.abs(Math.sin(a)), inner = Math.max(0, -Math.sin(a) * s), kS = seatK(y);
        // в сечении «сидения» штанины совпадают — одинаковый цвет (без полос там, где они перекрываются)
        const kc = Math.pow(Math.max(0, fr), 24) * 0.5 * (1 - kS), kd = (Math.pow(side, 6) * 0.35 + inner * 0.25) * (1 - kS);
        const c = mix3(mix3(col, lt, kc), dk, kd);
        // брюки на скелете бедра и голени: в машине и на велосипеде не подбираются (иначе голени пропадают)
        return { col: c, w, tk: 0 };
      }, { capTop: 'noline' });
    });
  }
  // голенище (сапог): труба вокруг голени от щиколотки до top; опц. каблук-блок сзади
  function bootShafts(B, o) {
    const col = tc(o.col), lt = tc(o.light || o.col), dk = tc(o.dark || o.col);
    ['L', 'R'].forEach(sd => {
      const s = sd === 'L' ? 1 : -1, knee = J('shin_' + sd), ank = J('foot_' + sd);
      const NR = 7, rings = [];
      for (let r = 0; r < NR; r++) {
        const t = r / (NR - 1), y = lerp(o.top, 0.075, t);
        const cx = lerp(knee[0], ank[0] + s * 0.006, clamp((knee[1] - y) / (knee[1] - ank[1]), 0, 1)), cz = lerp(0.002, -0.012, t) + (r === 0 ? (o.frontUp || 0) * 0 : 0);
        const rr = lerp(o.rTop || 0.058, o.rAnk || 0.042, sst(0, 1, t));
        rings.push({ c: [cx, y, cz], rx: rr, rz: rr * 1.08 });
      }
      B.tube(rings, 10, (ri, si, p, a) => {
        const y = p[1], w = y > ank[1] + 0.03 ? W1('shin_' + sd) : mixW('shin_' + sd, 'foot_' + sd, sst(ank[1] + 0.03, ank[1] - 0.01, y));
        const sh = Math.pow(Math.max(0, Math.cos(a - 0.5 * s)), 10);
        return { col: mix3(mix3(col, lt, sh * 0.8), dk, Math.pow(Math.abs(Math.sin(a)), 4) * 0.3 * (1 - sh)), w };
      }, { capTop: 'noline' });
    });
  }
  // голые ноги под коротким подолом: гладкая труба поверх ног модели (бёдер у модели нет, а у голени — пятна текстуры);
  // радиусы — по сечениям ног модели + 4 мм, ось: бедро -> колено -> щиколотка
  function skinLegs(B, o) {
    const col = SKIN, top = o.top || 0.74, bot = o.bot || 0.40, NR = 8;
    const prof = y => {
      if (y > 0.6) { const k = (y - 0.6) / 0.14; return [lerp(0.066, 0.074, k), lerp(0.063, 0.07, k)]; }
      if (y > 0.5) { const k = (y - 0.5) / 0.1; return [lerp(0.064, 0.066, k), lerp(0.056, 0.063, k)]; }
      const k = clamp((y - 0.4) / 0.1, 0, 1); return [lerp(0.06, 0.064, k), lerp(0.047, 0.056, k)];
    };
    ['L', 'R'].forEach(sd => {
      const s = sd === 'L' ? 1 : -1, rings = [];
      for (let r = 0; r < NR; r++) { const y = lerp(top, bot, r / (NR - 1)), q = prof(y); rings.push({ c: [s * q[0], y, 0.005], rx: q[1], rz: q[1] * 1.04 }); }
      B.tube(rings, 10, (ri, si, p) => {
        const y = p[1], kk = sst(M.knee + 0.05, M.knee - 0.05, y);
        const w = y > 0.68 ? mixW('hips', 'thigh_' + sd, sst(0.74, 0.68, y) * 0.3 + 0.7) : mixW('thigh_' + sd, 'shin_' + sd, kk);
        return { col, w, tk: 0 };
      }, { capTop: 'noline' });
    });
  }
  // длинная юбка от талии до пола: спереди за полами и голенями, сзади за тазом (шаг виден, низ подбирается сидя)
  function longSkirt(B, o) {
    const NR = o.rings || 18, seg = o.seg || 40, top = o.top || 1.0, hem = o.hem == null ? 0.015 : o.hem;
    const prof = o.prof;
    const rings = [];
    for (let r = 0; r < NR; r++) {
      const t = r / (NR - 1), y = lerp(top, hem, t), q = prof(y, t);
      const nf = o.folds || 11, fold = (o.fold || 0.03) * sst(0.12, 1, t);
      const R = { c: [q.cx || 0, y, q.cz], rx: q.rx, rz: q.rz, off: a => fold * (Math.cos(a * nf + (o.ph || 0)) + (o.fold2 || 0) * Math.cos(a * (nf * 0.5 + 0.5) + 1.3)) * (q.fk == null ? 1 : q.fk) };
      // волнистый подол: складки к низу ещё и по высоте (гребни ниже, ложбины выше)
      if (o.hemWave) R.dy = a => -o.hemWave * sst(0.6, 1, t) * (0.45 * Math.cos(a * nf + (o.ph || 0)) + 0.55 * Math.sin(a * (nf * 0.5 + 0.5) + 1.3));
      // верх юбки — по лифу (o.fit(a, y) — радиус от оси тела): без ступеньки на талии
      const wf = o.fit ? sst(0.84, 0.96, y) : 0;
      if (wf > 0) R.k = a => {
        const off = R.off(a), sa = Math.sin(a), ca = Math.cos(a), tgt = o.fit(a, y);
        const rad = k => Math.hypot(R.c[0] + sa * (R.rx + off) * k, R.c[2] - SH_CZ + ca * (R.rz + off) * k);
        let lo = 0.3, hi = 2;
        for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (rad(m) < tgt) lo = m; else hi = m; }
        return lerp(1, (lo + hi) / 2, wf);
      };
      rings.push(R);
    }
    B.tube(rings, seg, (ri, si, p, a, R) => {
      const t = ri / (NR - 1), y = p[1];
      // o.backLeg — и спинка ниже бедра на костях бёдер и голеней (сидя уходит под бёдра на сиденье, а не висит отвесно
      // за ним «вторым ярусом»)
      const front = Math.max(sst(-0.3, 0.7, Math.cos(a)), (o.backLeg || 0) * sst(M.hip + 0.02, M.hip - 0.1, y));
      // лево/право — широким переходом: средняя полоса переда идёт за обеими ногами, на шаге не расходится щелью
      const kL = sst(-o.mid || -0.08, o.mid || 0.08, p[0]);
      const kShin = sst(M.knee + 0.12, M.knee - 0.1, y) * (o.shinK == null ? 0.8 : o.shinK);
      const kThigh = sst(M.hip + 0.05, M.hip - 0.12, y) * (o.thighK == null ? 0.55 : o.thighK);
      const back = 1 - front;
      const w = [['hips', 1e-4 + (1 - front * kThigh) * (1 - kShin * 0.6)]];
      const fT = front * kThigh * (1 - kShin), fS = kShin * (front + back * (o.backShin == null ? 0.35 : o.backShin));
      if (fT > 0) { w.push(['thigh_L', fT * kL]); w.push(['thigh_R', fT * (1 - kL)]); }
      if (fS > 0) { w.push(['shin_L', fS * kL]); w.push(['shin_R', fS * (1 - kL)]); }
      const c = o.col(p, a, t, R);
      // o.flareTk — раструб ниже колена при подборе ещё и сужается (юбка-«русалка» сидя и за рулём — без «абажура»)
      return { col: c, w, tk: sst(M.knee + 0.1, hem, y) * (1 + (o.flareTk || 0) * sst(M.knee, hem, y)), uv: o.uv ? o.uv(p, a, t) : null };
      // шов трубы — сзади (спереди у пары вершин шва разные «лишние» пятые веса — юбка расходилась щелью на шаге)
    }, { capTop: 'noline', a0: o.a0 == null ? -PI : o.a0, a1: o.a1 == null ? PI : o.a1 });
  }
  // цвет кожи кистей (медиана текселей зоны кистей у автора): голые руки нового кроя — в тон кистям
  function handSkin(st) {
    if (!st || !st.tex) return SKIN;
    if (st.handC) return st.handC;
    const T = st.tex, zr = T.zr, o = T.orig, zz = Z.hands + 1, rs = [], gs = [], bs = [];
    for (let k = 0; k < zr.length; k += 3) if (zr[k] === zz) { const r = o[k * 4], g = o[k * 4 + 1], b = o[k * 4 + 2]; if (luma(r, g, b) > 140) { rs.push(r); gs.push(g); bs.push(b); } }
    const med = a => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
    st.handC = rs.length > 50 ? [med(rs), med(gs), med(bs)] : SKIN;
    return st.handC;
  }
  // кисть: верх зоны кисти (стороны s), срез на 1.5–3 см ниже него (центр, полуоси) — капсула руки входит сюда
  function handTop(st, s) {
    if (!st) return null;
    st.handTop = st.handTop || {};
    if (st.handTop[s] !== undefined) return st.handTop[s];
    const P0 = st.P0;
    let top = -9, x0 = 9, x1 = -9, z0 = 9, z1 = -9;
    for (let i = 0; i < st.n; i++) if (st.zn[i] === Z.hands && P0[i * 3] * s > 0) top = Math.max(top, P0[i * 3 + 1]);
    for (let i = 0; i < st.n; i++) { if (st.zn[i] !== Z.hands || P0[i * 3] * s <= 0) continue; const y = P0[i * 3 + 1]; if (y > top - 0.03 && y < top - 0.015) { x0 = Math.min(x0, P0[i * 3]); x1 = Math.max(x1, P0[i * 3]); z0 = Math.min(z0, P0[i * 3 + 2]); z1 = Math.max(z1, P0[i * 3 + 2]); } }
    st.handTop[s] = top > 0 && x1 > x0 ? { top, c: [(x0 + x1) / 2, top - 0.016, (z0 + z1) / 2], hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 } : null;
    return st.handTop[s];
  }
  // расширенный верхний край кисти (под манжетой тренча) — прочь, когда руки голые: туда входит капсула руки
  function handRim(st, f) {
    const P0 = st.P0, I0 = st.I0, tops = [handTop(st, 1), handTop(st, -1)];
    for (let t = 0; t < st.nt; t++) {
      if (st.tz[t] !== Z.hands) continue;
      const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3, h = tops[(P0[a] + P0[b] + P0[c]) > 0 ? 0 : 1];
      if (h && (P0[a + 1] + P0[b + 1] + P0[c + 1]) / 3 > h.top - 0.015) f[t] = 1;
    }
    return f;
  }
  // «волосы» у рук: грани зоны волос, ни одна вершина которых не висит на голове или прядях (кусочки у подмышек, плеч и
  // предплечий под рукавом тренча), — прочь вместе с рукавом
  function armHair(st, f) {
    const SI = st.geo.attributes.skinIndex, SW = st.geo.attributes.skinWeight, hb = boneIdx('head'), hh = boneIdx('hair');
    if (!SI || !SW || hb < 0) return f;
    const mb = i => { let b = -1, w = -1; for (let k = 0; k < 4; k++) { const q = SW.array[i * 4 + k]; if (q > w) { w = q; b = SI.array[i * 4 + k]; } } return b; };
    for (let t = 0; t < st.nt; t++) {
      if (st.tz[t] !== Z.hair_back && st.tz[t] !== Z.hair_skull) continue;
      let k = 0;
      for (; k < 3; k++) { const b = mb(st.I0[t * 3 + k]); if (b === hb || b === hh) break; }
      if (k === 3) f[t] = 1;
    }
    return f;
  }
  // голые руки — гладкие капсулы кожи на костях (рукав и манжета тренча спрятаны образом): плечо → локоть → запястье;
  // у запястья — расширение по верхнему срезу кисти (эллипс по точкам кисти) и на 1 см внутрь неё: без «браслета»;
  // o.r — радиусы [плечо, локоть, запястье]
  function skinArms(B, st, o) {
    o = o || {};
    const R = o.r || [0.04, 0.035, 0.031], col = handSkin(st), NU = 4, NF = 4, P0 = st && st.P0;
    ['L', 'R'].forEach(sd => {
      const s = sd === 'L' ? 1 : -1, U = J('upperarm_' + sd), E = J('forearm_' + sd), Wr = J('hand_' + sd), up = 'upperarm_' + sd, fo = 'forearm_' + sd, ha = 'hand_' + sd;
      // срез кисти под её расширенным верхним краем (край прячет handRim): точки зоны кисти на 1.5–3 см ниже верха
      const hr = handTop(st, s);
      const ok = !!hr, HT = ok ? hr.c : Wr, hx = ok ? hr.hx : R[2], hz = ok ? hr.hz : R[2];
      const rings = [], ws = [];
      for (let i = 0; i <= NU; i++) { const t = i / NU; rings.push({ c: [lerp(U[0], E[0], t), lerp(U[1], E[1], t) + (i ? 0 : 0.01), lerp(U[2], E[2], t)], rx: lerp(R[0], R[1], t), rz: lerp(R[0], R[1], t) * 1.05 }); ws.push(mixW(up, fo, 0.5 * sst(0.55, 1, t))); }
      // предплечье до 1.2 см над срезом кисти
      const W1p = [HT[0], HT[1] + 0.012, HT[2]];
      for (let i = 1; i <= NF; i++) { const t = i / NF; rings.push({ c: [lerp(E[0], W1p[0], t), lerp(E[1], W1p[1], t), lerp(E[2], W1p[2], t)], rx: lerp(R[1], R[2], t), rz: lerp(R[1], R[2], t) * 1.05 }); ws.push(t > 0.99 ? mixW(fo, ha, 0.5) : mixW(up, fo, 0.5 + 0.5 * sst(0, 0.45, t))); }
      // в кисть (на кости кисти): по эллипсу среза чуть внутри него и ещё на 3 см глубже, уже
      const ex = Math.max(R[2], hx * 0.93), ez = Math.max(R[2] * 1.05, hz * 0.93);
      rings.push({ c: [HT[0], HT[1], HT[2]], rx: ex, rz: ez }); ws.push(W1(ha));
      rings.push({ c: [HT[0], HT[1] - 0.03, HT[2]], rx: ex * 0.6, rz: ez * 0.6 }); ws.push(W1(ha));
      B.tube(rings, 8, ri => ({ col, w: ws[ri], tk: 0 }), { capTop: 'noline', capBottom: 'noline' });
    });
  }
  // сумочка на левом предплечье: ремешок-петля у локтя, корпус — сбоку у предплечья (жёстко на forearm_L)
  function bagOnForearm(B, o) {
    const a = J('forearm_L'), b = J('hand_L');
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], al = Math.hypot(ax[0], ax[1], ax[2]);
    const at = t => [a[0] + ax[0] * t, a[1] + ax[1] * t, a[2] + ax[2] * t];
    const w = W1('forearm_L');
    B.part = 2;
    const strapT = o.strapT == null ? 0.42 : o.strapT, sc = at(strapT);
    const tilt = Math.atan2(ax[0], -ax[1]);
    // ремешок: тор вокруг предплечья (у клатча — без ремешка)
    if (!o.noStrap) B.torus(sc, o.strapR || 0.05, 0.007, [0, 0, tilt], tc(o.strap || o.col), w, 14, 5);
    // корпус: под ремешком снаружи предплечья (+x), висит вниз
    const c = [sc[0] + (o.dx == null ? 0.075 : o.dx), sc[1] - (o.drop == null ? 0.1 : o.drop), sc[2] + (o.dz || 0.0)];
    o.body(B, c, w);
    // ручки от корпуса к ремешку
    if (o.handles !== false) [-1, 1].forEach(k => {
      const p0 = [c[0] - 0.02, c[1] + o.size[1] * 0.5, c[2] + k * o.size[2] * 0.35], p1 = [sc[0] + 0.04, sc[1] - 0.01, sc[2] + k * 0.02];
      const rings = [0, 1, 2, 3, 4].map(i => { const t = i / 4, h = Math.sin(t * PI) * 0.02; return { c: [lerp(p0[0], p1[0], t) + h, lerp(p0[1], p1[1], t) + h * 0.5, lerp(p0[2], p1[2], t)], rx: 0.005, rz: 0.005 }; });
      B.tube(rings, 5, () => ({ col: tc(o.strap || o.col), w }));
    });
    B.part = 0;
  }
  // гладкий пухлый корпус (мешочек, саквояж, трапеция): эллипсоид с подрезанным низом/верхом и цветом по нормали
  function bagBlob(c, size, cols, opt) {
    opt = opt || {};
    const base = tc(cols[0]), dk = tc(cols[1]), lt = tc(cols[2]);
    return (B, cc, w) => {
      B.blob(cc, [size[0] * 0.5, size[1] * 0.5, size[2] * 0.5], (n, p) => {
        const sh = Math.pow(Math.max(0, n[0] * 0.5 + n[1] * 0.6 + n[2] * 0.62), opt.gloss ? 14 : 4) * (opt.gloss ? 0.9 : 0.35);
        const dd = Math.max(0, -n[1]) * 0.35 + Math.max(0, -n[0]) * 0.15;
        return mix3(mix3(base, dk, dd), lt, sh);
      }, w, opt.segU || 14, opt.segV || 9, { rot: opt.rot });
      if (opt.extra) opt.extra(B, cc, w);
    };
  }
  // каркасная сумка: кольца снизу вверх со скруглённым прямоугольником в сечении (sq — «квадратность»), профиль prof(t) -> [kx, kz],
  // кант по рёбрам (pipe), блик спереди-сверху; ручки — дуги над верхом (handles: [высота, толщина])
  function bagBox(size, cols, opt) {
    opt = opt || {};
    const base = tc(cols[0]), dk = tc(cols[1]), lt = tc(cols[2]), pipe = opt.pipe ? tc(opt.pipe) : null, NR = opt.rings || 7, sq = opt.sq == null ? 4 : opt.sq;
    const se = a => { const s = Math.abs(Math.sin(a)), c = Math.abs(Math.cos(a)); return 1 / Math.pow(Math.pow(s, sq) + Math.pow(c, sq), 1 / sq); };
    return (B, c, w) => {
      const rings = [];
      for (let r = 0; r < NR; r++) {
        const t = 1 - r / (NR - 1), pr = opt.prof ? opt.prof(t) : [1, 1];
        rings.push({ c: [c[0], c[1] - size[1] * 0.5 + size[1] * t, c[2]], rx: size[0] * 0.5 * pr[0], rz: size[2] * 0.5 * pr[1], k: se, off: opt.off ? a => opt.off(a, t) : null });
      }
      B.tube(rings, opt.seg || 12, (ri, si, p, a) => {
        const t = 1 - ri / (NR - 1), sh = Math.pow(Math.max(0, Math.cos(a) * 0.6 + Math.sin(a) * 0.5 + (t - 0.5) * 0.6), opt.gloss ? 6 : 3) * (opt.gloss ? 0.7 : 0.3);
        const shd = opt.shade == null ? 1 : opt.shade;
        let col = mix3(mix3(base, dk, ((1 - t) * 0.12 + Math.max(0, -Math.sin(a)) * 0.1) * shd), lt, sh * shd);
        if (pipe && (((ri === 1 || ri === NR - 2) && opt.pipeRings !== false) || Math.abs(Math.abs(Math.sin(a)) - Math.abs(Math.cos(a))) < 0.035)) col = pipe;
        return { col, w };
      }, { capTop: true, capBottom: true });
      if (opt.handles) {
        const [hh, ht] = opt.handles, top = c[1] + size[1] * 0.5 - 0.004, hc = tc(opt.handleCol || cols[0]);
        (opt.handleZ || [0]).forEach(dx => {
          const zs = size[2] * 0.5 * (opt.prof ? opt.prof(1)[1] : 1) * 0.62;
          // opt.handleOl false — без контура (у тонкой ручки контур толще неё самой — тёмная «палка»)
          const pol = B.ol.length;
          const hs = opt.handleSeg || 6;
          B.tube(Array.from({ length: hs + 1 }, (_, i) => { const u = i / hs; return { c: [c[0] + dx, top + Math.sin(u * PI) * hh, c[2] + lerp(-zs, zs, u)], rx: ht, rz: ht }; }), hs, () => ({ col: hc, w }));
          if (opt.handleOl === false) B.ol.length = pol;
        });
      }
      if (opt.extra) opt.extra(B, c, w);
    };
  }
  // серьги, жемчуг, очки, пучок — на кости головы
  function earrings(B, o) {
    B.part = 1;
    const w = W1('head');
    [1, -1].forEach(s => o.make(B, [s * (o.x || 0.205), o.y || 1.47, o.z == null ? -0.035 : o.z], s, w));
    B.part = 0;
  }
  /* ---------- оболочка тела: новый крой верха (лиф, платье, кардиган, кожа в вырезе) поверх спрятанного тренча ---------- */
  // Тренч — полая оболочка, лацканы и воротник — её складки (под ними нет груди). Образ прячет верх тренча целиком
  // (воротник, лацканы, пуговицы, пояс, погоны) и строит новый крой на «поверхности тела»: лучи изнутри — по высоте
  // (горизонтально от оси) и веером от груди к плечам и шее; берётся ближайшая грань наружу, поэтому лацкан, клапан и
  // пряжка (они снаружи) в поверхность не попадают. Профиль столбца — ломаная, её отрезки по длине → SH_NS точек.
  // Каждая точка несёт нормаль и веса скина грани тренча (по барицентрам): новый крой гнётся ровно как тренч под ним.
  const SH_NA = 96, SH_NS = 72, SH_CZ = 0.012, SH_YB = 0.46, SH_YS = 1.06, SH_YT = 1.318;
  function shellSurf(st) {
    if (!st) return null;
    if (st.shell) return st.shell;
    const t0 = performance.now();
    const P0 = st.P0, N0 = st.N0, I0 = st.I0, tz = st.tz, nt = st.nt;
    const SI = st.geo.attributes.skinIndex, SW = st.geo.attributes.skinWeight;
    if (!SI || !SW) return null;
    const nb = Math.max(1, RB().length), swk = SW.normalized ? (SW.array instanceof Uint8Array ? 1 / 255 : SW.array instanceof Uint16Array ? 1 / 65535 : 1) : 1;
    const zs = new Uint8Array(32);
    ['coat_torso', 'coat_skirt', 'collar', 'belt', 'buttons', 'sleeve', 'cuff', 'neck'].forEach(nm => { zs[Z[nm]] = 1; });
    // грани по азимуту (вокруг оси тела), с полем в корзину; для горизонтальных лучей — ещё и по высоте (2 см)
    const NB = SH_NA, bins = Array.from({ length: NB }, () => []), NYB = 50, YB0 = 0.4, ybins = Array.from({ length: NB * NYB }, () => []);
    const azOf = (x, z) => Math.atan2(x, z - SH_CZ);
    for (let t = 0; t < nt; t++) {
      if (!zs[tz[t]]) continue;
      const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
      if (Math.max(P0[a * 3 + 1], P0[b * 3 + 1], P0[c * 3 + 1]) < SH_YB - 0.05) continue;
      let A = [azOf(P0[a * 3], P0[a * 3 + 2]), azOf(P0[b * 3], P0[b * 3 + 2]), azOf(P0[c * 3], P0[c * 3 + 2])];
      if (Math.max(A[0], A[1], A[2]) - Math.min(A[0], A[1], A[2]) > PI) A = A.map(v => (v < 0 ? v + 2 * PI : v));
      const k0 = Math.floor((Math.min(A[0], A[1], A[2]) + PI) / (2 * PI) * NB) - 1, k1 = Math.floor((Math.max(A[0], A[1], A[2]) + PI) / (2 * PI) * NB) + 1;
      const y0 = Math.min(P0[a * 3 + 1], P0[b * 3 + 1], P0[c * 3 + 1]), y1 = Math.max(P0[a * 3 + 1], P0[b * 3 + 1], P0[c * 3 + 1]);
      const j0 = clamp(Math.floor((y0 - YB0) / 0.02), 0, NYB - 1), j1 = clamp(Math.floor((y1 - YB0) / 0.02), 0, NYB - 1);
      // горизонтальные лучи — только по тренчу и шее (руки сбоку не ловим), веер — и по рукавам (плечи)
      // пояс и пуговицы — накладки: под ними поверхность тянется от соседей по высоте
      if (tz[t] === Z.belt || tz[t] === Z.buttons) continue;
      const arm = tz[t] === Z.sleeve || tz[t] === Z.cuff;
      for (let k = k0; k <= k1; k++) {
        const kk = ((k % NB) + NB) % NB;
        if (y1 > SH_YS - 0.12) bins[kk].push(t);
        if (!arm) for (let j = j0; j <= j1; j++) ybins[kk * NYB + j].push(t);
      }
    }
    // луч O + D·t: ближайшая грань наружу (интерполированная нормаль смотрит по лучу)
    const hit = { t: 0, tri: -1, u: 0, v: 0 }, all = [];
    const cast = (list, ox, oy, oz, dx, dy, dz) => {
      hit.t = 9; hit.tri = -1; all.length = 0;
      for (let q = 0; q < list.length; q++) {
        const t = list[q], a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        const e1x = P0[b] - P0[a], e1y = P0[b + 1] - P0[a + 1], e1z = P0[b + 2] - P0[a + 2], e2x = P0[c] - P0[a], e2y = P0[c + 1] - P0[a + 1], e2z = P0[c + 2] - P0[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const inv = 1 / det, tx = ox - P0[a], ty = oy - P0[a + 1], tzz = oz - P0[a + 2];
        const u = (tx * px + ty * py + tzz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tzz * e1y, qy = tzz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv; if (tt <= 1e-4) continue;
        const w0 = 1 - u - v, nx = N0[a] * w0 + N0[b] * u + N0[c] * v, ny = N0[a + 1] * w0 + N0[b + 1] * u + N0[c + 1] * v, nz = N0[a + 2] * w0 + N0[b + 2] * u + N0[c + 2] * v;
        // рукав — поверхность только на плече (выше подмышки), ниже — это рука, а не тело
        const out = nx * dx + ny * dy + nz * dz > 0.05 * Math.hypot(nx, ny, nz) && (tz[t] !== Z.sleeve || oy + dy * tt > 1.13) ? 1 : 0;
        all.push(tt, t, out, u, v);
        if (tt >= hit.t || !out) continue;
        hit.t = tt; hit.tri = t; hit.u = u; hit.v = v;
      }
      return hit.tri >= 0;
    };
    // накладки поверх поверхности (лацканы, клапаны, пряжка, пуговицы, хлястики, погоны, кокетка): грани на луче дальше
    // ближайшей наружу, но не дальше 3.5 см — их прячет образ с новым кроем (рука — не накладка: у подмышки и ниже плеча
    // рукав не трогаем)
    const ov = new Uint8Array(nt), ovz = new Uint8Array(32);
    ['coat_torso', 'coat_skirt', 'collar', 'belt', 'buttons'].forEach(nm => { ovz[Z[nm]] = 1; });
    // на плечах рукав тренча (его верх) лежит поверх спинки и переда: поверхность — по нему (одежда поверх рукава,
    // как спущенное плечо), сам рукав не прячем
    const capLift = () => {
      for (let q = 0; q < all.length; q += 5) {
        const tt = all[q], t = all[q + 1];
        if (!all[q + 2] || tt <= hit.t || tt > hit.t + 0.03 || tz[t] !== Z.sleeve) continue;
        const a = I0[t * 3] * 3; if (P0[a + 1] < 1.12) continue;
        hit.t = tt; hit.tri = t; hit.u = all[q + 3]; hit.v = all[q + 4];
      }
    };
    const markOv = () => {
      for (let q = 0; q < all.length; q += 5) {
        const tt = all[q], t = all[q + 1], dt = tt - hit.t;
        if (dt <= 0.0015 || dt > 0.035) continue;
        const z = tz[t];
        if (ovz[z]) { ov[t] = 1; continue; }
        if (z !== Z.sleeve) continue;
        const a = I0[t * 3] * 3; if (P0[a + 1] > 1.165 && Math.abs(P0[a]) < 0.17 && (all[q + 2] || (dt < 0.015 && P0[a + 1] > 1.2))) ov[t] = 1;
      }
    };
    const NS = SH_NS, P = new Float32Array(NB * NS * 3), N = new Float32Array(NB * NS * 3), Y = new Float32Array(NB * NS), WI = new Uint8Array(NB * NS * 4), WW = new Float32Array(NB * NS * 4), Lc = new Float32Array(NB), S0 = new Float32Array(NB);
    // UV и зона грани-источника (кожа в вырезе берёт цвет шеи автора в этой точке — без шва)
    const UVs = new Float32Array(NB * NS * 2), ZS = new Uint8Array(NB * NS), UVA = st.geo.attributes.uv.array;
    const acc = new Float32Array(nb);
    const wOf = (tri, u, v, out) => {
      acc.fill(0);
      const vs = [I0[tri * 3], I0[tri * 3 + 1], I0[tri * 3 + 2]], bw = [1 - u - v, u, v];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) { const bi = SI.array[vs[k] * 4 + j], w = SW.array[vs[k] * 4 + j] * swk; if (bi < nb) acc[bi] += w * bw[k]; }
      for (let j = 0; j < 4; j++) { let bi = 0, bv = -1; for (let i = 0; i < nb; i++) if (acc[i] > bv) { bv = acc[i]; bi = i; } out.push(bi, Math.max(0, bv)); acc[bi] = -1; }
    };
    for (let k = 0; k < NB; k++) {
      const a = -PI + (k + 0.5) * 2 * PI / NB, sa = Math.sin(a), ca = Math.cos(a), list = bins[k];
      // ломаная профиля: [x, y, z, nx, ny, nz, веса...]
      const body = [], fan = [];
      for (let y = SH_YB; y <= SH_YS + 1e-6; y += 0.01) {
        if (!cast(ybins[k * NYB + clamp(Math.floor((y - YB0) / 0.02), 0, NYB - 1)], 0, y, SH_CZ, sa, 0, ca)) { body.push(null); continue; }
        markOv();
        const w = []; wOf(hit.tri, hit.u, hit.v, w);
        body.push({ o: [0, y, SH_CZ], d: [sa, 0, ca], t: hit.t, tri: hit.tri, u: hit.u, v: hit.v, w });
      }
      // пропуски в середине (под поясом нет ткани) — по соседям; низ до первой ткани — отбросить (ниже — продолжение полы)
      {
        let i0 = body.findIndex(q => q);
        if (i0 < 0) body.length = 0; else {
          // край подола загнут внутрь — нижние точки, где радиус к низу убывает, не в счёт (и ещё одна)
          i0 = Math.min(i0 + 2, body.length - 1);
          const tq = i => (body[i] ? body[i].t : 0);
          while (i0 < body.length - 4 && (!body[i0] || tq(i0) < Math.max(tq(i0 + 2), tq(i0 + 3)) - 0.002)) i0++;
          i0 = Math.min(i0 + 1, body.length - 1);
          for (let i = i0; i < body.length; i++) {
            if (body[i]) continue;
            let j = i + 1; while (j < body.length && !body[j]) j++;
            const A = body[i - 1], Bq = j < body.length ? body[j] : null;
            for (let q = i; q < j; q++) { const kq = Bq ? (q - i + 1) / (j - i + 1) : 0, src = Bq && kq > 0.5 ? Bq : A; body[q] = Object.assign({}, src, { o: [0, SH_YB + q * 0.01, SH_CZ], t: Bq ? lerp(A.t, Bq.t, kq) : A.t }); }
            i = j - 1;
          }
          body.splice(0, i0);
        }
      }
      for (let ph = 4; ph <= 89; ph += 2.5) {
        const f = ph * PI / 180, d = [sa * Math.cos(f), Math.sin(f), ca * Math.cos(f)];
        if (!cast(list, 0, SH_YS, SH_CZ, d[0], d[1], d[2])) { if (fan.length && fan[fan.length - 1].o[1] + fan[fan.length - 1].d[1] * fan[fan.length - 1].t > 1.2) break; continue; }
        capLift(); markOv();
        const w = []; wOf(hit.tri, hit.u, hit.v, w);
        fan.push({ o: [0, SH_YS, SH_CZ], d, t: hit.t, tri: hit.tri, u: hit.u, v: hit.v, w });
        if (SH_YS + d[1] * hit.t > SH_YT + 0.02) break;
      }
      // ниже края тренча (0.542) лучи мимо — продолжаем трапецию полы вниз (наклон по нижним 8 см), веса — от края
      if (body.length > 8 && body[0].o[1] > SH_YB + 0.005) {
        const b0 = body[0], b8 = body[8], dr = (b8.t - b0.t) / (b8.o[1] - b0.o[1]), ext = [];
        for (let y = SH_YB; y < b0.o[1] - 0.005; y += 0.01) ext.push(Object.assign({}, b0, { o: [0, y, SH_CZ], t: b0.t + (y - b0.o[1]) * dr }));
        body.unshift.apply(body, ext);
      }
      // без выступов (пряжка, клапаны, пуговицы, шлёвки): нижняя огибающая расстояния в окне ±2 точки, потом сглаживание
      [body, fan].forEach((arr, ai) => {
        const n = arr.length; if (n < 3) return;
        const tm = arr.map((q, i) => { const w = []; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) w.push(arr[j].t); w.sort((x, y) => x - y); return ai ? q.t : w[w.length >> 1]; });
        for (let it = 0; it < 2; it++) { const c = tm.slice(); for (let i = 1; i < n - 1; i++) tm[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4; }
        arr.forEach((q, i) => { q.t = tm[i]; });
      });
      const pts = body.concat(fan).map(q => ({ p: [q.o[0] + q.d[0] * q.t, q.o[1] + q.d[1] * q.t, q.o[2] + q.d[2] * q.t], q }));
      // по высоте — не вниз (веер у подмышки иногда даёт точку ниже предыдущей); верх — ровно SH_YT
      const pl = [];
      let ym = -9;
      for (const e of pts) {
        if (e.p[1] < ym - 0.002) continue;
        if (e.p[1] > SH_YT) {
          const last = pl[pl.length - 1];
          if (last) { const k2 = (SH_YT - last.p[1]) / Math.max(1e-6, e.p[1] - last.p[1]); pl.push({ p: [lerp(last.p[0], e.p[0], k2), SH_YT, lerp(last.p[2], e.p[2], k2)], q: k2 < 0.5 ? last.q : e.q }); }
          break;
        }
        ym = Math.max(ym, e.p[1]); pl.push(e);
      }
      if (pl.length < 2) { pl.length = 0; pl.push({ p: [sa * 0.1, SH_YB, SH_CZ + ca * 0.1], q: null }, { p: [sa * 0.05, SH_YT, SH_CZ + ca * 0.05], q: null }); }
      const cl = [0];
      for (let i = 1; i < pl.length; i++) cl.push(cl[i - 1] + Math.hypot(pl[i].p[0] - pl[i - 1].p[0], pl[i].p[1] - pl[i - 1].p[1], pl[i].p[2] - pl[i - 1].p[2]));
      const L = cl[cl.length - 1]; Lc[k] = L; S0[k] = pl[0].p[1];
      let j = 0;
      for (let s = 0; s < NS; s++) {
        const d = L * s / (NS - 1);
        while (j < pl.length - 2 && cl[j + 1] < d) j++;
        const kk = clamp((d - cl[j]) / Math.max(1e-9, cl[j + 1] - cl[j]), 0, 1), A = pl[j], Bq = pl[j + 1], o = (k * NS + s);
        for (let c = 0; c < 3; c++) P[o * 3 + c] = lerp(A.p[c], Bq.p[c], kk);
        Y[o] = P[o * 3 + 1];
        const src = kk < 0.5 ? (A.q || Bq.q) : (Bq.q || A.q);
        if (src) {
          for (let c = 0; c < 4; c++) { WI[o * 4 + c] = src.w[c * 2]; WW[o * 4 + c] = src.w[c * 2 + 1]; }
          const ia = I0[src.tri * 3], ib = I0[src.tri * 3 + 1], ic = I0[src.tri * 3 + 2], w0 = 1 - src.u - src.v;
          UVs[o * 2] = UVA[ia * 2] * w0 + UVA[ib * 2] * src.u + UVA[ic * 2] * src.v; UVs[o * 2 + 1] = UVA[ia * 2 + 1] * w0 + UVA[ib * 2 + 1] * src.u + UVA[ic * 2 + 1] * src.v; ZS[o] = tz[src.tri];
        } else { WI[o * 4] = Math.max(0, boneIdx('chest')); WW[o * 4] = 1; }
      }
    }
    // нормали — по сетке (разности соседних столбцов и точек профиля)
    const at = (k, s) => ((((k % NB) + NB) % NB) * NS + clamp(s, 0, NS - 1)) * 3;
    for (let k = 0; k < NB; k++) for (let s = 0; s < NS; s++) {
      const a1 = at(k + 1, s), a0 = at(k - 1, s), b1 = at(k, s + 1), b0 = at(k, s - 1), o = at(k, s);
      const tx = [P[a1] - P[a0], P[a1 + 1] - P[a0 + 1], P[a1 + 2] - P[a0 + 2]], ty = [P[b1] - P[b0], P[b1 + 1] - P[b0 + 1], P[b1 + 2] - P[b0 + 2]];
      let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
      const ox = P[o], oz = P[o + 2] - SH_CZ;
      if (n[0] * ox + n[2] * oz + n[1] * 0.02 < 0) n = n.map(v => -v);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      N[o] = n[0] / l; N[o + 1] = n[1] / l; N[o + 2] = n[2] / l;
    }
    st.shell = { P, N, Y, WI, WW, L: Lc, S0, NA: NB, NS, ov, UV: UVs, ZS, ms: Math.round(performance.now() - t0) };
    // верх рукава тренча на груди и лопатках (кокетка, клапаны — мельче шага лучей): всё, что не дальше 15 мм над
    // поверхностью, — под новым кроем (прочь вместе с накладками); сама рука (бок, |x| > 0.135) не трогается
    {
      const q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] }, up = new Uint8Array(st.n);
      for (let i = 0; i < st.n; i++) {
        if (st.zn[i] !== Z.sleeve) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2];
        if (y < 1.12 || Math.abs(x) > 0.135 || (z - SH_CZ < 0.03 && z - SH_CZ > -0.05)) continue;
        const a = Math.atan2(x, z - SH_CZ); shellAt(st.shell, a, shellS(st.shell, a, y), q);
        const dr = Math.hypot(x, z - SH_CZ) - Math.hypot(q.p[0], q.p[2] - SH_CZ);
        if (dr < 0.015) up[i] = 1;
      }
      for (let t = 0; t < nt; t++) if (up[I0[t * 3]] && up[I0[t * 3 + 1]] && up[I0[t * 3 + 2]]) ov[t] = 1;
    }
    return st.shell;
  }
  // точка поверхности по (азимут a, доля профиля s 0..1): позиция, нормаль, веса (билинейно по сетке)
  const SHW = new Float32Array(64);
  function shellAt(S, a, s, out) {
    const NA = S.NA, NS = S.NS, fa = (a + PI) / (2 * PI) * NA - 0.5, k0 = Math.floor(fa), ka = fa - k0, fs = clamp(s, 0, 1) * (NS - 1), s0 = Math.min(NS - 2, Math.floor(fs)), ks = fs - s0;
    out = out || { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
    out.p[0] = out.p[1] = out.p[2] = out.n[0] = out.n[1] = out.n[2] = 0;
    SHW.fill(0);
    const cs = [[k0, s0, (1 - ka) * (1 - ks)], [k0 + 1, s0, ka * (1 - ks)], [k0, s0 + 1, (1 - ka) * ks], [k0 + 1, s0 + 1, ka * ks]];
    for (const [k, s2, w] of cs) {
      const o = (((k % NA) + NA) % NA) * NS + s2;
      for (let c = 0; c < 3; c++) { out.p[c] += S.P[o * 3 + c] * w; out.n[c] += S.N[o * 3 + c] * w; }
      for (let c = 0; c < 4; c++) SHW[S.WI[o * 4 + c]] += S.WW[o * 4 + c] * w;
    }
    const nl = Math.hypot(out.n[0], out.n[1], out.n[2]) || 1; out.n[0] /= nl; out.n[1] /= nl; out.n[2] /= nl;
    let sum = 0;
    for (let c = 0; c < 4; c++) { let bi = 0, bv = -1; for (let i = 0; i < 64; i++) if (SHW[i] > bv) { bv = SHW[i]; bi = i; } out.si[c] = bi; out.sw[c] = Math.max(0, bv); sum += out.sw[c]; SHW[bi] = -1; }
    for (let c = 0; c < 4; c++) out.sw[c] = sum > 0 ? out.sw[c] / sum : c === 0 ? 1 : 0;
    return out;
  }
  // доля профиля, где столбец азимута a на высоте y (по возрастающей высоте профиля)
  function shellS(S, a, y) {
    const NA = S.NA, NS = S.NS, fa = (a + PI) / (2 * PI) * NA - 0.5, k0 = Math.floor(fa), ka = fa - k0;
    const col = k => {
      const kk = ((k % NA) + NA) % NA, o = kk * NS;
      if (y <= S.Y[o]) return 0;
      if (y >= S.Y[o + NS - 1]) return 1;
      let lo = 0, hi = NS - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S.Y[o + m] < y) lo = m; else hi = m; }
      const k2 = (y - S.Y[o + lo]) / Math.max(1e-6, S.Y[o + hi] - S.Y[o + lo]);
      return (lo + clamp(k2, 0, 1)) / (NS - 1);
    };
    return lerp(col(k0), col(k0 + 1), ka);
  }
  // азимут, где поверхность на высоте y проходит через x (её левая сторона sd = 1 — азимуты 0..π, правая −1)
  function shellAz(S, x, y, sd, aMax) {
    // x(a) растёт от переда (0) до бока (π/2); дальше к спине убывает — ищем на [0, π/2]
    const q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] }, A1 = aMax || PI * 0.5;
    const X = a => { shellAt(S, a, shellS(S, a, y), q); return q.p[0] * sd; };
    let lo = 0, hi = A1 * sd;
    if (X(hi) < x * sd) return hi;
    if (X(lo) > x * sd) return lo;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (X(m) < x * sd) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  // кусок кроя по сетке: rows — число рядов (v 0..1), cols(v) -> массив азимутов ряда (одинаковой длины во всех рядах),
  // sv(a, v) -> доля профиля, off(a, s, u, v) -> отступ от поверхности (м), col(p, a, s, u, v) -> цвет («текстурный»),
  // ol — с контуром (или fn(u, v) для четырёхугольника), closed — столбцы по кругу, uv(u, v) — узор атласа, part, tk
  function shellPiece(B, S, o) {
    const nv = o.rows, cols0 = o.cols(0), nu = cols0.length, base = B.p.length / 3, G = [], q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
    for (let r = 0; r <= nv; r++) {
      const v = r / nv, cs = r ? o.cols(v) : cols0;
      for (let c = 0; c < nu; c++) {
        const a = cs[c], s = o.sv(a, v), u = nu > 1 ? c / (nu - 1) : 0;
        shellAt(S, a, s, q);
        const off = o.off ? o.off(a, s, u, v) : 0.003;
        G.push({ p: [q.p[0] + q.n[0] * off, q.p[1] + q.n[1] * off, q.p[2] + q.n[2] * off], n0: q.n.slice(), si: q.si.slice(), sw: q.sw.slice(), a, s, u, v });
      }
    }
    const idx = (r, c) => clamp(r, 0, nv) * nu + (o.closed ? ((c % nu) + nu) % nu : clamp(c, 0, nu - 1));
    const pp = B.part;
    if (o.part != null) B.part = o.part;
    for (let r = 0; r <= nv; r++) for (let c = 0; c < nu; c++) {
      const g = G[idx(r, c)], a1 = G[idx(r, c + 1)].p, a0 = G[idx(r, c - 1)].p, b1 = G[idx(r + 1, c)].p, b0 = G[idx(r - 1, c)].p;
      const tx = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], ty = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
      if (n[0] * g.n0[0] + n[1] * g.n0[1] + n[2] * g.n0[2] < 0) n = n.map(v2 => -v2);
      let l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-9) { n = g.n0; l = 1; }
      n = [n[0] / l, n[1] / l, n[2] / l];
      const col = o.col(g.p, g.a, g.s, g.u, g.v, n);
      B.v(g.p, n, col, { si: g.si, sw: g.sw }, o.uv ? o.uv(g.u, g.v, g.a, g.s) : null, o.tk ? o.tk(g.p, g.u, g.v) : 0);
    }
    const cm = o.closed ? nu : nu - 1;
    for (let r = 0; r < nv; r++) for (let c = 0; c < cm; c++) {
      const i00 = base + idx(r, c), i01 = base + idx(r, c + 1), i10 = base + idx(r + 1, c), i11 = base + idx(r + 1, c + 1);
      const ol = typeof o.ol === 'function' ? o.ol((c + 0.5) / (nu - 1), (r + 0.5) / nv) : o.ol !== false;
      if (o.skip && o.skip((c + 0.5) / (nu - 1), (r + 0.5) / nv)) continue;
      B.tri(i00, i01, i10, ol); B.tri(i01, i11, i10, ol);
    }
    B.part = pp;
    return { G, nu, nv, base };
  }
  // ряд азимутов от a0 до a1 (n штук): у краёв — полоса кромки band (метры от края, по возрастанию; r — радиус для
  // перевода метров в угол), середина — ровно
  function azRow(a0, a1, n, band, r) {
    const bw = band || [], nb = bw.length, rr = r || 0.14, sg = Math.sign(a1 - a0) || 1, out = new Array(n);
    const m0 = nb ? a0 + sg * bw[nb - 1] / rr : a0, m1 = nb ? a1 - sg * bw[nb - 1] / rr : a1, nm = n - 2 * nb;
    for (let i = 0; i < nb; i++) { out[i] = a0 + sg * (i ? bw[i - 1] : 0) / rr; out[n - 1 - i] = a1 - sg * (i ? bw[i - 1] : 0) / rr; }
    for (let i = 0; i < nm; i++) out[nb + i] = lerp(m0, m1, nm > 1 ? i / (nm - 1) : 0);
    return out;
  }
  // спрятать верх тренча (воротник, лацканы, перед и спинку выше y0, пояс, пуговицы); o.skirt — и полы ниже
  // маска образа с новым кроем верха: o.y0 — перед и спинка тренча выше (по умолчанию все), o.skirt — и полы,
  // o.legs — ноги выше o.legs; плюс накладки (лацканы, погоны, кокетка) по лучам оболочки; fn — своё условие по вершине
  function hideTorso(o, fn) {
    o = o || {};
    const y0 = o.y0 == null ? -1 : o.y0;
    return st => {
      const S = shellSurf(st), f = trisWhere(st, (i, z, x, y, zz) => z === Z.collar || z === Z.belt || z === Z.buttons || (z === Z.coat_torso && y > y0) || (o.skirt && z === Z.coat_skirt) || (o.legs != null && z === Z.legs && y > o.legs) || (st.crownInner && st.crownInner[i]) || (fn ? fn(i, z, x, y, zz) : false));
      if (S && S.ov) for (let t = 0; t < st.nt; t++) if (S.ov[t] && (o.skirt || st.tz[t] !== Z.coat_skirt)) f[t] = 1;
      return crownCovered(st, f);
    };
  }
  // шея под новым кроем: низ шеи модели (бывшая стойка тренча, «полочка» у основания спереди) — на 2 мм под
  // поверхность тела: кожа в вырезе и воротники ложатся поверх без зубца в профиль
  function neckIn(ctx) {
    const { st, p, zn, moved } = ctx, S = shellSurf(st), lk = faceLock(st);
    if (!S) return;
    for (let i = 0; i < st.n; i++) {
      if (zn[i] !== Z.neck || !lk[i]) continue;
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      if (y > 1.322) continue;
      const w = sst(1.322, 1.3, y), a = Math.atan2(x, z - SH_CZ), r = Math.hypot(x, z - SH_CZ), rt = shellR(S, a, y) - 0.0025 * w;
      if (r <= rt) continue;
      const f = rt / r;
      p[i * 3] = x * f; p[i * 3 + 2] = SH_CZ + (z - SH_CZ) * f; moved[i] = 1;
    }
  }
  // цвет кожи шеи (медиана текселей зоны шеи у автора): кожа в вырезе нового кроя — в тон шее, без шва
  function neckSkin(st) {
    if (!st || !st.tex) return SKIN;
    if (st.neckC) return st.neckC;
    const T = st.tex, zr = T.zr, o = T.orig, zz = Z.neck + 1, rs = [], gs = [], bs = [];
    for (let k = 0; k < zr.length; k += 3) if (zr[k] === zz && !T.pk[k]) { const r = o[k * 4], g = o[k * 4 + 1], b = o[k * 4 + 2]; if (luma(r, g, b) > 140) { rs.push(r); gs.push(g); bs.push(b); } }
    const med = a => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
    st.neckC = rs.length > 50 ? [med(rs), med(gs), med(bs)] : SKIN;
    return st.neckC;
  }
  // тон шеи: медианы текселей кожи (зона лица) на цилиндре шеи 1.31–1.37 спереди и сзади — низ шеи (своя зона)
  // красится ими же, без шва
  function neckTone(st) {
    if (st.neckTone) return st.neckTone;
    const P0 = st.P0, I0 = st.I0, O = st.tex.orig, A = [[], [], []], Bk = [[], [], []];
    const cen = (t, c) => (P0[I0[t * 3] * 3 + c] + P0[I0[t * 3 + 1] * 3 + c] + P0[I0[t * 3 + 2] * 3 + c]) / 3;
    [[A, 1], [Bk, -1]].forEach(([arr, sg]) => {
      rasterTris(st, t => st.tz[t] === Z.face && cen(t, 1) > 1.31 && cen(t, 1) < 1.37 && Math.abs(cen(t, 0)) < 0.08 && (cen(t, 2) - SH_CZ) * sg > 0.03, k => { const j = k * 4; if (luma(O[j], O[j + 1], O[j + 2]) > 100) for (let c = 0; c < 3; c++) arr[c].push(O[j + c]); });
    });
    const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1]; }, NS = neckSkin(st);
    st.neckTone = [A[0].length > 30 ? A.map(med) : NS, Bk[0].length > 30 ? Bk.map(med) : NS];
    return st.neckTone;
  }
  // низ шеи (своя зона; у автора под воротником тренча — светлая полоса с рваным краем): ровно тоном шеи над ним (кожа
  // лица — спереди светлее, сзади темнее; по азимуту), без «зубцов» на стыке
  const neckPaint = (x, y, z, o) => { o.f = 1; const T2 = neckTone(o.st); return mix3(T2[0], T2[1], sst(0.6, 1.35, Math.abs(Math.atan2(x, z - SH_CZ))), [0, 0, 0]); };
  // заплатка кожи на шее сзади и с боков (1.292–1.366): у автора низ шеи сзади — с дырой (под воротником тренча), сбоку
  // в профиль видна тёмная выемка. Кольцо по дуге |азимут| > 1.05 на 1.5 мм над шеей (радиус — по точкам шеи и кожи
  // в полосе), цвет — тон шеи (сзади темнее), без контура; кости — грудь → шея
  function neckPatch(B, st) {
    if (!st || !st.tex) return;
    const P0 = st.P0, zn = st.zn, NB = 24, R = new Float32Array(NB), ZC = -0.012, T2 = neckTone(st);
    for (let i = 0; i < st.n; i++) {
      if (zn[i] !== Z.face && zn[i] !== Z.neck) continue;
      const y = P0[i * 3 + 1]; if (y < 1.285 || y > 1.365) continue;
      const x = P0[i * 3], z = P0[i * 3 + 2] - ZC, r = Math.hypot(x, z);
      if (r > 0.075) continue;
      const a = Math.atan2(x, z), b = ((Math.floor((a + PI) / (2 * PI) * NB) % NB) + NB) % NB;
      if (r > R[b]) R[b] = r;
    }
    for (let pass = 0; pass < NB; pass++) for (let b = 0; b < NB; b++) if (!R[b]) R[b] = Math.max(R[(b + 1) % NB], R[(b + NB - 1) % NB]);
    const RS = new Float32Array(NB);
    for (let b = 0; b < NB; b++) RS[b] = Math.max(R[(b + NB - 1) % NB], R[b], R[(b + 1) % NB]);
    const rAt = a => { const f = (a + PI) / (2 * PI) * NB - 0.5, b0 = Math.floor(f), k = f - b0; return lerp(RS[((b0 % NB) + NB) % NB], RS[(((b0 + 1) % NB) + NB) % NB], k); };
    // края заплатки (верхний ряд и крайние столбцы) — под кожей шеи: без ступеньки в профиль
    const YS = [1.292, 1.312, 1.332, 1.35, 1.366], OFF = [0.0015, 0.0015, 0.0015, 0.0006, -0.0015], SEG = 14, base = B.p.length / 3;
    YS.forEach((y, ri) => {
      for (let s = 0; s <= SEG; s++) {
        const a = lerp(1.05, 2 * PI - 1.05, s / SEG), sa = Math.sin(a), ca = Math.cos(a), e = Math.min(s, SEG - s);
        const r = rAt(Math.atan2(sa, ca)) + Math.min(OFF[ri], e === 0 ? -0.0015 : e === 1 ? 0.0006 : 0.0015);
        const col = mix3(T2[0], T2[1], sst(0.95, 1.35, Math.abs(Math.atan2(sa, ca))), [0, 0, 0]);
        B.v([sa * r, y, ZC + ca * r], [sa, 0, ca], col, mixW('chest', 'neck', sst(1.29, 1.34, y)));
      }
    });
    for (let r = 0; r < YS.length - 1; r++) for (let s = 0; s < SEG; s++) { const i00 = base + r * (SEG + 1) + s, i01 = i00 + 1, i10 = i00 + SEG + 1, i11 = i10 + 1; B.tri(i00, i01, i10, false); B.tri(i01, i11, i10, false); }
  }
  // нить бус по поверхности: путь (азимут, высота) от a0 до a1, nb бусин радиуса rad — одна трубка, радиус «бусинами»
  // (на бусину 4 кольца × sides), без контура; col(n) — цвет по нормали
  function beadsOn(B, S, path, a0, a1, nb, rad, off, col, sides, flat) {
    const q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] }, NR = nb * 4 + 1, SD = sides || 4, base = B.p.length / 3, C = [], W = [];
    for (let r = 0; r < NR; r++) { const a = lerp(a0, a1, r / (NR - 1)); shellAt(S, a, shellS(S, a, path(a)), q); C.push({ p: q.p.slice(), n: q.n.slice(), si: q.si.slice(), sw: q.sw.slice() }); }
    for (let r = 0; r < NR; r++) {
      const c = C[r], nx = C[Math.min(NR - 1, r + 1)].p, pv = C[Math.max(0, r - 1)].p, tg = [nx[0] - pv[0], nx[1] - pv[1], nx[2] - pv[2]], tl = Math.hypot(tg[0], tg[1], tg[2]) || 1;
      const T3 = tg.map(v => v / tl), N3 = c.n, Bn = [T3[1] * N3[2] - T3[2] * N3[1], T3[2] * N3[0] - T3[0] * N3[2], T3[0] * N3[1] - T3[1] * N3[0]];
      const ph = (r % 4) / 4, rr = flat ? rad : rad * (ph === 0 ? 0.35 : ph === 0.5 ? 1 : 0.8), ctr = [c.p[0] + N3[0] * (off + rad), c.p[1] + N3[1] * (off + rad), c.p[2] + N3[2] * (off + rad)];
      for (let k = 0; k <= SD; k++) {
        const t = k / SD * 2 * PI, ct = Math.cos(t), sn = Math.sin(t), nn = [N3[0] * ct + Bn[0] * sn, N3[1] * ct + Bn[1] * sn, N3[2] * ct + Bn[2] * sn];
        B.v([ctr[0] + nn[0] * rr, ctr[1] + nn[1] * rr, ctr[2] + nn[2] * rr], nn, col(nn), { si: c.si, sw: c.sw });
      }
    }
    for (let r = 0; r < NR - 1; r++) for (let k = 0; k < SD; k++) { const i0 = base + r * (SD + 1) + k, i1 = i0 + 1, j0 = i0 + SD + 1, j1 = j0 + 1; B.tri(i0, i1, j0, false); B.tri(i1, j1, j0, false); }
  }
  // цвет кожи в точке поверхности: на шее — тексель автора (с его тенью под подбородком), ниже — кожа шеи (медиана),
  // переход по высоте k (0 — медиана, 1 — тексель)
  function skinAt(st, S, a, s, out) {
    const NSK = neckSkin(st), NA = S.NA, NS = S.NS, fa = (a + PI) / (2 * PI) * NA - 0.5, k0 = ((Math.round(fa) % NA) + NA) % NA, s0 = clamp(Math.round(s * (NS - 1)), 0, NS - 1), o = k0 * NS + s0;
    out = out || [0, 0, 0];
    if (S.ZS[o] !== Z.neck || !st.tex) { out[0] = NSK[0]; out[1] = NSK[1]; out[2] = NSK[2]; return out; }
    const T = st.tex, px = clamp(Math.floor(S.UV[o * 2] * st.W), 0, st.W - 1), py = clamp(Math.floor(S.UV[o * 2 + 1] * st.H), 0, st.H - 1), j = (py * st.W + px) * 4;
    const k = clamp((S.Y[o] - 1.2) / 0.06, 0, 1);
    for (let c = 0; c < 3; c++) out[c] = lerp(NSK[c], T.orig[j + c], k);
    return out;
  }
  // радиус поверхности от оси тела по азимуту a на высоте y
  function shellR(S, a, y) {
    const q = shellAt(S, a, shellS(S, a, y));
    return Math.hypot(q.p[0], q.p[2] - SH_CZ);
  }
  // столбцы кольца: n штук по кругу, начиная с a0
  function ringAz(n, a0) { const out = []; for (let i = 0; i < n; i++) out.push((a0 || 0) - PI + (i + 0.5) * 2 * PI / n); return out; }
  // верх столбца на линии x = f(y) (вырез «V»): высота, где точка поверхности столбца a выходит на линию (от y0 вверх до y1),
  // иначе null
  function shellCut(S, a, f, y0, y1) {
    const q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
    const g = y => { shellAt(S, a, shellS(S, a, y), q); return Math.abs(q.p[0] - f.c) - f.w(y); };
    if (q.p && g(y0) > 0 && g(y1) > 0 && g((y0 + y1) / 2) > 0) return null;
    if (g(y0) <= 0) return y0;
    let lo = y0, hi = y1;
    if (g(hi) > 0) return null;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
    return hi;
  }
  // пиджак/пальто новым кроем: o = { hem, brk (высота излома лацкана), xHem, xBrk (край полы у подола и на изломе),
  //   notch (высота уступа лацкана), lw (ширина лацкана у уступа), col(p, a, y, part) — цвет ('body' | 'lapel' | 'collar' |
  //   'edge'), off(a, y) — отступ корпуса, pockets: [[x, y, w]...] клапаны, button: [x, y], chest: [x, y, w] — листочка,
  //   rows, cols }. Полочки и спинка — одним куском от левого края вокруг спины к правому; лацканы — поверх, от края
  //   полы до внешнего края (у излома ширина 0, к уступу lw); воротник — верхняя полоса корпуса вокруг шеи
  function blazer(B, S, o) {
    const hem = o.hem, brk = o.brk, NT = 1.272, NC = o.cols || 30, NR = o.rows || 13;
    const edgeX = y => (y < brk ? lerp(o.xHem, o.xBrk, sst(hem, brk, y)) : lerp(o.xBrk, 0.058, sst(brk, NT, y)));
    // верх: у края полы — излом лацкана (NT), к плечу воротник встаёт вокруг шеи (без «полочки» кожи у основания шеи)
    const topY = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(NT, o.collarTop || 1.302, sst(0.3, 0.9, aa)); };
    const off = o.off || ((a, y) => 0.009 + 0.008 * sst(0.95, hem, y));
    const colsAt = v => { const y = lerp(hem, NT, v), x = edgeX(y); return azRow(shellAz(S, x, y, 1), 2 * PI + shellAz(S, -x, y, -1), NC, [0.006], 0.12); };
    const yOf = (a, v) => lerp(hem, topY(a), v);
    const collarY = 1.236, v0 = B.p.length / 3;
    const body = shellPiece(B, S, { rows: NR, cols: colsAt, sv: (a, v) => shellS(S, a, yOf(a, v)),
      off: (a, s, u, v) => { const y = yOf(a, v); return off(a, y) + (y > collarY ? 0.003 * sst(collarY, collarY + 0.02, y) : 0); },
      col: (p, a, s, u, v) => {
        const y = p[1], e = Math.min(u, 1 - u) * (NC - 1);
        if (y > collarY && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.75) return o.col(p, a, y, 'collar');
        return o.col(p, a, y, e < 0.6 ? 'edge' : 'body');
      } });
    // сидя спинка и бока сзади — к тазу (полы не встают «тарелкой» вокруг сиденья)
    seatW(B, v0);
    // лацканы: на полочке от края до внешнего края (уступ — косой срез верха)
    const lap = sd => {
      const LR = 7, LC = 5;
      const xs = (y, u) => { const xe = edgeX(y), w = o.lw * sst(brk, o.notch, y) * (y > o.notch ? 1 - sst(o.notch, o.notch + 0.03, y) * 0.6 : 1); return sd * (xe + (w + 0.004) * u); };
      // столбцы — по возрастанию азимута (иначе грани вывернуты): у правой полы (sd −1) внешний край — первый
      const uu = u => (sd > 0 ? u : 1 - u);
      shellPiece(B, S, { rows: LR, cols: v => { const y = lerp(brk + 0.004, o.notch + 0.012, v), out = []; for (let i = 0; i < LC; i++) { const x = xs(y, uu(i / (LC - 1))); out.push(shellAz(S, x, y, sd)); } return out; },
        sv: (a, v) => shellS(S, a, lerp(brk + 0.004, o.notch + 0.012, v)),
        off: (a, s, u, v) => off(a, lerp(brk, o.notch, v)) + 0.0035 + (o.lift || 0.002) * uu(u) * (0.4 + 0.6 * v),
        col: (p, a, s, u, v) => o.col(p, a, p[1], uu(u) > 0.8 ? 'edge' : 'lapel') });
      // тень под внешним краем лацкана: узкая тёмная полоса на поле (1 см) — лацкан читается и в однотонной ткани;
      // o.shTop — её верх (по умолчанию у уступа: notch + 6 мм)
      const xo = y => xs(y, 1) * sd, shT = o.shTop == null ? o.notch + 0.006 : o.shTop;
      shellPiece(B, S, { rows: LR, ol: false, cols: v => { const y = lerp(brk + 0.01, shT, v), x0 = xo(y), out = [sd * x0, sd * (x0 + 0.01)].map(x => shellAz(S, x, y, sd)); return sd > 0 ? out : out.reverse(); },
        sv: (a, v) => shellS(S, a, lerp(brk + 0.01, shT, v)), off: (a, s, u, v) => off(a, lerp(brk, o.notch, v)) + 0.0012,
        col: (p, a, s, u, v) => o.col(p, a, p[1], 'shadow') });
    };
    lap(1); lap(-1);
    // клапаны карманов и листочка: плоские полоски поверх полы (край — контуром)
    // клапаны — целиком на поле: от края полы на 1.2 см (знак px — сторона), листочка — где задана
    (o.pockets || []).map(([px, py, pw]) => [Math.sign(px) * (edgeX(py) + 0.012 + pw / 2), py, pw]).concat(o.chest ? [o.chest] : []).forEach(([px, py, pw], k) => {
      const h = k >= (o.pockets || []).length ? 0.012 : 0.026;
      shellPiece(B, S, { rows: 1, cols: v => { const y = py - h + h * v; return [px - pw / 2, px + pw / 2].map(x => shellAz(S, x, y, x >= 0 ? 1 : -1)).sort((p2, q2) => p2 - q2); },
        sv: (a, v) => shellS(S, a, py - h + h * v), off: (a, s, u, v) => off(a, py) + 0.003,
        col: (p, a, s, u, v) => o.col(p, a, p[1], v < 0.5 ? 'edge' : 'body') });
    });
    if (o.button) {
      const [bx, by] = o.button, a = shellAz(S, bx, by, bx >= 0 ? 1 : -1), q = shellAt(S, a, shellS(S, a, by)), r = 0.0075, d = off(a, by) + 0.004;
      B.blob([q.p[0] + q.n[0] * d, q.p[1], q.p[2] + q.n[2] * d], [r, r, r * 0.45], n => o.col(q.p, a, by, 'button'), { si: q.si, sw: q.sw }, 6, 4, { ol: false });
    }
    return { body, edgeX, topY };
  }
  // пуговица-кружок на поверхности (6 граней веером, без контура): x, y — место на теле, r — радиус, off — отступ
  function discOn(B, S, x, y, r, off, col) {
    const a = shellAz(S, x, y, x >= 0 ? 1 : -1), q = shellAt(S, a, shellS(S, a, y)), n = q.n, w = { si: q.si.slice(), sw: q.sw.slice() };
    const U = [n[2], 0, -n[0]], ul = Math.hypot(U[0], U[2]) || 1; U[0] /= ul; U[2] /= ul;
    const V = [n[1] * U[2] - n[2] * U[1], n[2] * U[0] - n[0] * U[2], n[0] * U[1] - n[1] * U[0]];
    const c = [q.p[0] + n[0] * off, q.p[1] + n[1] * off, q.p[2] + n[2] * off], base = B.p.length / 3;
    B.v(c, n, col, w);
    for (let k = 0; k < 6; k++) { const t = k / 6 * 2 * PI, ct = Math.cos(t) * r, sn = Math.sin(t) * r; B.v([c[0] + U[0] * ct + V[0] * sn, c[1] + U[1] * ct + V[1] * sn, c[2] + U[2] * ct + V[2] * sn], n, col, w); }
    for (let k = 0; k < 6; k++) B.tri(base, base + 1 + k, base + 1 + (k + 1) % 6, false);
  }
  // кожа в вырезе до шеи: кольцо от края выреза bottom(a) до верха поверхности (шеи); столбцы — те же, что у ткани
  // под ним (n, ringAz): грани ткани и кожи на одних хордах, край ткани (на 3 мм) всегда поверх кожи без зубцов;
  // кожа низом на 0.6 мм под поверхностью (ткань выше на 3.6 мм — хорды не пересекаются), к шее — 0.5 мм над ней;
  // цвет — шея автора (без шва)
  function skinRing(B, st, S, bottom, n, rows, a0, drop) {
    return shellPiece(B, S, { rows: rows || 4, closed: true, cols: () => ringAz(n, a0), ol: false,
      sv: (a, v) => lerp(shellS(S, a, bottom(a) - 0.008), 1, v), off: (a, s, u, v) => lerp(-0.0006, 0.0005, v) - (drop ? drop(a, s) : 0),
      col: (p, a, s) => skinAt(st, S, a, s, [0, 0, 0]) });
  }
  // сидя полы (кости coat_L/R идут за бёдрами почти целиком) у одежды выше колена: спереди ложатся на бёдра как есть,
  // с боков и сзади — к тазу (не встают «тарелкой» вокруг сиденья); вершины B с i0 до конца
  function seatW(B, i0) {
    const cL = boneIdx('coat_L'), cR = boneIdx('coat_R'), hp = boneIdx('hips');
    if (cL < 0 || cR < 0 || hp < 0) return;
    const nv = B.p.length / 3;
    for (let i = i0; i < nv; i++) {
      const a = Math.atan2(B.p[i * 3], B.p[i * 3 + 2] - SH_CZ), kb = sst(0.62, -0.25, Math.cos(a));
      if (kb <= 0) continue;
      let mv = 0, hk = -1;
      for (let k = 0; k < 4; k++) { const bi = B.si[i * 4 + k]; if (bi === cL || bi === cR) { const d = B.sw[i * 4 + k] * kb; B.sw[i * 4 + k] -= d; mv += d; } else if (bi === hp) hk = k; }
      if (mv <= 0) continue;
      if (hk >= 0) B.sw[i * 4 + hk] += mv;
      else { let kmin = 0; for (let k = 1; k < 4; k++) if (B.sw[i * 4 + k] < B.sw[i * 4 + kmin]) kmin = k; B.si[i * 4 + kmin] = hp; B.sw[i * 4 + kmin] += mv; }
    }
  }
  /* ---------- 1. «Северное сияние»: чёрный оверсайз-пиджак с полосами сияния, чёрный топ, широкие брюки в пол ---------- */
  {
    const H = { base: '#2E1C14', dark: '#1A100B', light: '#5A3C2A', tips: '#5E4232', part: 0.03, keep: 0.6 };
    const HP = hairPaint(H);
    const BASE = tc('#1C1E24'), SHD = tc('#121318'), HI = tc('#3A3F4A');
    const GR = tc('#2FB37A'), CORE = tc('#8CE6B8'), TEAL = tc('#2A7C80'), BV = tc('#3D4E9E'), BVL = tc('#6272CC');
    const out = [0, 0, 0], t1 = [0, 0, 0];
    const band = (d, w) => Math.exp(-(d / w) * (d / w));
    // поле сияния по точке ткани: зелёные полосы с мятной серединой, бирюзовый край, сине-фиолетовые пятна
    const field = (x, y, z) => {
      let g = 0, b = 0;
      const wob = 0.018 * Math.sin(x * 31 + y * 17) + 0.012 * Math.sin(y * 43 - x * 11);
      if (z > -0.02) {
        // её левая пола (+x): косая полоса G1 от плеча к лацкану, сине-фиолетовое свечение B1 у лацкана на груди,
        // полоса G2 у бёдер (клапан кармана), пятно B2 у подола с тонкой зелёной кромкой; остальное — чёрное
        if (x > -0.01) {
          g = Math.max(g, band(y - (1.20 - (x - 0.04) * 1.55) + wob, 0.05) * sst(-0.01, 0.04, x));
          b = Math.max(b, band(y - (1.08 - (x - 0.06) * 0.3) + wob, 0.035) * sst(0.02, 0.06, x) * sst(0.13, 0.1, x) * 0.85);
          g = Math.max(g, band(y - (0.83 + (x - 0.1) * 0.35) + wob, 0.04) * sst(0.02, 0.09, x));
          b = Math.max(b, band(y - 0.695 + wob, 0.032) * sst(0.06, 0.14, x) * 0.9);
          g = Math.max(g, band(y - 0.655, 0.01) * sst(0.07, 0.14, x) * 0.7);
        }
        // её правая пола: зелень у плеча (G3) и тонкая вертикальная полоса вдоль края у лацкана (G4); остальное чёрное
        if (x < 0.01) {
          g = Math.max(g, band(y - (1.24 + (x + 0.12) * 0.8) + wob, 0.045) * sst(-0.06, -0.14, x));
          g = Math.max(g, band(x - (-0.05 - (1.17 - y) * 0.25) + wob * 0.5, 0.02) * sst(1.12, 1.08, y) * sst(0.83, 0.9, y) * 0.85);
        }
      } else {
        // спина: одна дуга от левого плеча к правой лопатке
        g = Math.max(g, band(y - (1.12 + x * 0.9) + wob, 0.045) * 0.85);
        b = Math.max(b, band(y - (1.0 + x * 0.6) + wob, 0.045) * 0.5);
      }
      mix3(BASE, BV, b * 0.85, out);
      mix3(out, BVL, Math.max(0, b - 0.6) * 0.6, out);
      mix3(out, TEAL, Math.min(1, g * 1.6) * 0.75, out);
      mix3(out, GR, Math.max(0, g - 0.35) * 1.2, out);
      mix3(out, CORE, Math.max(0, g - 0.75) * 2.2, out);
      return out;
    };
    const jacketMain = (x, y, z, o) => { o.k = 0.1; o.lo = 0.72; o.hi = 1.28; const c = field(x, y, z); return y < 0.66 ? mix3(c, SHD, 0.35, t1) : c; };
    const sleeveMain = (x, y, z, o) => {
      o.f = 1;
      // правый рукав (−x): зелень у плеча; левый: синева снаружи на плече и у манжеты, слабая зелень у локтя
      const s = x > 0 ? 1 : -1, wob = 0.01 * Math.sin(y * 37 + z * 20);
      let g = 0, b = 0;
      if (s < 0) { g = band(y - 1.14 + wob, 0.05) * 0.95; } else { b = Math.max(band(y - 1.07 + wob, 0.045) * 0.7, band(y - 0.83 + wob, 0.035) * 0.75); g = band(y - 0.95 + wob, 0.03) * 0.4; }
      mix3(BASE, BV, b, out); mix3(out, TEAL, Math.min(1, g * 1.5) * 0.7, out); mix3(out, GR, Math.max(0, g - 0.4), out);
      return out;
    };
    const TOP = tc('#1C1C20'), TR = tc('#1A1A1D'), EDGE = tc('#3A3F4A');
    // пиджак новым кроем: поле сияния по точке ткани (лацкан — тот же узор, кромка светлее), низ темнее
    const jcol = (p, a, y, part) => {
      const c = field(p[0], p[1], p[2]);
      if (part === 'edge') return mix3(c, EDGE, 0.45, t1);
      if (part === 'lapel') return mix3(c, HI, 0.22, t1);
      if (part === 'shadow') return mix3(c, SHD, 0.7, t1);
      if (part === 'button') return SHD;
      return y < 0.66 ? mix3(c, SHD, 0.3, t1) : c.slice();
    };
    const topNeck = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(1.18, 1.245, sst(0.45, 1.6, aa)); };
    LOOKS.aurora = {
      // hem — низ одежды для качания ног статуэтки (без скелета)
      hem: 0.64, hair: H, top: 1.825, keep: 0.3,
      morph: [crown({ top: 1.825 }), flatten(['cuff']), neckIn],
      // верх и полы тренча — прочь (пиджак, топ, кожа — новым кроем); ноги — под брюками
      hide: hideTorso({ skirt: true }, (i, z) => z === Z.legs),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands, neck: neckPaint,
        sleeve: sleeveMain, cuff: sleeveMain,
        shoes: (x, y, z, o) => { o.k = 0.5; return tc('#1A1A1D'); },
      },
      garment: B => {
        // кожа на шее сзади и с боков (выемка у основания шеи в профиль)
        neckPatch(B, LASTST);
        const st = LASTST, SS = shellSurf(st);
        trousers(B, { col: '#1A1A1D', light: '#2C2C31', dark: '#0F0F11', top: 1.0, wide: 0.122, rings: 12, seg: 12, seat: { y0: 0.82, rx: 0.13, rz: 0.11, cz: -0.012 }, inShell: SS ? { S: SS, m: 0.004, y0: 0.65 } : null });
        if (!SS) return;
        shellPiece(B, SS, { rows: 6, closed: true, cols: () => ringAz(24), ol: (u, v) => v > 0.8,
          sv: (a, v) => shellS(SS, a, lerp(0.96, topNeck(a), v)), off: () => 0.003, col: () => TOP });
        skinRing(B, st, SS, topNeck, 24);
        blazer(B, SS, { hem: 0.64, brk: 1.0, xHem: 0.078, xBrk: 0.05, notch: 1.205, lw: 0.058, lift: 0.005, col: jcol,
          off: (a, y) => 0.01 + 0.008 * sst(0.95, 0.64, y) + 0.008 * sst(1.12, 1.24, y) * Math.pow(Math.sin(a), 4),
          pockets: [[1, 0.815, 0.072], [-1, 0.815, 0.072]], chest: [0.078, 1.12, 0.05], button: [-0.062, 0.998] });
      },
    };
  }
  /* ---------- 2. «Конная прогулка»: длинное замшевое пальто, голубая водолазка, кремовые бриджи, сапоги, бордовый саквояж ---------- */
  {
    const H = { base: '#2E1C14', dark: '#1A100B', light: '#5A3C2A', tips: '#7A5338', part: 0.04, keep: 0.6 };
    const HP = hairPaint(H);
    const SU = tc('#4A2C1C'), SUD = tc('#2E1A10'), SUL = tc('#6A4430');
    const TN = tc('#A9C6E3'), TND = tc('#7F9DBE'), TNL = tc('#CFE1F2');
    const CR = tc('#E8E0D0'), CRD = tc('#C9BDA8'), CRL = tc('#F6F0E4');
    const BT = tc('#3A2218'), BTL = tc('#6B4A3C'), BTD = tc('#22130C');
    const out = [0, 0, 0];
    // замша: мягкие тональные пятна ворса (10–30 см, без мелкой ряби: одинаково ровно и на сетке пальто, и на текселях
    // рукавов) — светлее, где ворс «поднят», темнее, где «примят»
    const napK = (x, y, z) => {
      const u = x * 19 + 0.9 * Math.sin(y * 13 + z * 7), v = y * 15 + 0.9 * Math.sin(x * 17 - z * 11), w = z * 21 + 0.7 * Math.sin(x * 9 + y * 11);
      return clamp(0.5 + 0.22 * Math.sin(u + v * 0.6) + 0.16 * Math.sin(v - w * 0.7 + 1.7) + 0.12 * Math.sin(u * 1.7 - w + 0.6), 0, 1);
    };
    const napC = (x, y, z, o) => { const k = napK(x, y, z); return k > 0.5 ? mix3(SU, SUL, Math.min(1, (k - 0.5) * 1.5), o) : mix3(SU, SUD, Math.min(1, (0.5 - k) * 1.15), o); };
    // рукава (краска модели): та же замша, светлые потёртости у подола
    const suede = (x, y, z, o) => {
      o.f = 1;
      napC(x, y, z, out);
      if (y < 0.5) mix3(out, SUL, sst(0.5, 0.47, y) * 0.35, out);
      return out;
    };
    // водолазка: голубой рубчик (вертикальные полосы), ворот — пара складок
    const rib = (x, y, z, o) => {
      o.k = 0.25; o.lo = 0.65; o.hi = 1.2;
      const r = 0.5 + 0.5 * Math.sin(Math.atan2(x, z + 0.01) * 60);
      mix3(TN, TND, r * 0.18, out);
      if (y > 1.25) { const f = 0.5 + 0.5 * Math.sin((y - 1.25) * 140); mix3(out, f > 0.5 ? TNL : TND, Math.abs(f - 0.5) * 0.35, out); }
      return out;
    };
    const legs = (x, y, z, o) => {
      if (y > 0.445) { o.k = 0.3; return CR; }
      // сапог: гладкая кожа с бликом спереди-сбоку
      o.k = 0.15; o.lo = 0.7; o.hi = 1.3;
      const sh = Math.pow(Math.max(0, Math.cos(Math.atan2(x - (x > 0 ? 0.06 : -0.06), z) - (x > 0 ? 0.5 : -0.5))), 8);
      return mix3(BT, BTL, sh * 0.8, out);
    };
    // пальто новым кроем: замша (пятна ворса, светлые потёртости у края и подола), широкие лацканы с длинным изломом к пуговице
    const jcol = (p, a, y, part) => {
      const c = napC(p[0], y, p[2], [0, 0, 0]);
      if (part === 'edge') return mix3(c, SUL, 0.55);
      if (part === 'lapel') return mix3(c, SUL, 0.22);
      if (part === 'shadow') return mix3(c, SUD, 0.75);
      if (part === 'button') return SUD;
      if (y < 0.5) return mix3(c, SUL, sst(0.5, 0.47, y) * 0.35);
      return c;
    };
    const ribAt = (p, a) => { const r = 0.5 + 0.5 * Math.sin(a * 60); return mix3(TN, TND, r * 0.18); };
    const BAG = ['#5A1A1C', '#3A0E10', '#8A3A3A'];
    // бриджи: две облегающие штанины по осям бёдер (+3–5 мм к ногам модели). Между ногами — узкий ровный просвет от шага до
    // колена (8–28 мм: тёмная линия, две ноги), а не «клин» изнанки пальто, как у юбки; у колена уже верха голенищ
    // (заправлены, без светлого «носка»). Профиль: [y, x центра, полуось x, полуось z]; выше 0.82 штанины сходятся в общее
    // сечение (перед в распахе пальто ровный), выше 0.5 — внутри поверхности тела + 4 мм (под пальто не проступают);
    // последний столбец — z центра: у колена к оси голени (перед бриджей на 1 см внутри голенища, без мерцания)
    const BR = [[0.82, 0.066, 0.068, 0.074, 0.008], [0.74, 0.066, 0.062, 0.068, 0.008], [0.62, 0.064, 0.058, 0.064, 0.006], [0.54, 0.062, 0.055, 0.06, 0.004], [0.48, 0.06, 0.05, 0.052, 0.001], [0.42, 0.058, 0.044, 0.045, 0]];
    const brAt = y => {
      for (let i = 1; i < BR.length; i++) if (y >= BR[i][0]) { const k = Math.min(1, (y - BR[i][0]) / (BR[i - 1][0] - BR[i][0])); return [1, 2, 3, 4].map(j => lerp(BR[i][j], BR[i - 1][j], k)); }
      return BR[BR.length - 1].slice(1);
    };
    const breeches = (B, SS) => {
      const top = 1.0, hem = 0.42, NR = 13, SEG = 11, SE = { y0: 0.82, rx: 0.13, rz: 0.11, cz: -0.012 };
      const seatK = y => sst(SE.y0, top, y);
      const inSh = R => {
        R.k = a => {
          const sa = Math.sin(a), ca = Math.cos(a);
          const at = k => { const x = R.c[0] + sa * R.rx * k, z = R.c[2] + ca * R.rz * k; return Math.hypot(x, z - SH_CZ) - shellR(SS, Math.atan2(x, z - SH_CZ), R.c[1]) - 0.004; };
          if (at(1) <= 0) return 1;
          let lo = 0.2, hi = 1;
          for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m) <= 0) lo = m; else hi = m; }
          return lo;
        };
        return R;
      };
      ['L', 'R'].forEach(sd => {
        const s = sd === 'L' ? 1 : -1, hip = J('thigh_' + sd), knee = J('shin_' + sd), rings = [];
        for (let r = 0; r < NR; r++) {
          const y = lerp(top, hem, r / (NR - 1)), q = brAt(y), kS = seatK(y);
          const R = { c: [lerp(s * q[0], 0, kS), y, lerp(q[3], SE.cz, kS)], rx: lerp(q[1], SE.rx, kS), rz: lerp(q[2], SE.rz, kS) };
          rings.push(SS && y > 0.5 ? inSh(R) : R);
        }
        B.tube(rings, SEG, (ri, si, p, a) => {
          const y = p[1], kS = seatK(y);
          let w;
          if (y > hip[1] + 0.02) w = mixW('hips', 'thigh_' + sd, sst(top, hip[1] + 0.02, y) * 0.5);
          else if (y > knee[1] + 0.07) w = mixW('hips', 'thigh_' + sd, 0.5 + 0.5 * sst(hip[1] + 0.02, hip[1] - 0.08, y));
          else w = mixW('thigh_' + sd, 'shin_' + sd, sst(knee[1] + 0.07, knee[1] - 0.05, y));
          // перед светлее, бока мягко темнее; внутренняя сторона (где бёдра сходятся) — в тени: две ноги, а не панель
          const fr = Math.max(0, Math.cos(a)), side = Math.abs(Math.sin(a)), inner = Math.max(0, -Math.sin(a) * s);
          const c = mix3(mix3(CR, CRL, fr * fr * 0.4 * (1 - kS), [0, 0, 0]), CRD, (Math.pow(side, 6) * 0.25 + Math.pow(inner, 3) * 0.55) * (1 - kS));
          return { col: c, w, tk: 0 };
        }, { capTop: 'noline' });
      });
    };
    // сапоги для верховой езды: стройное голенище по голени модели (+6–8 мм: икра, к щиколотке уже), верх спереди чуть
    // выше и раструбом, открыт (внутри — изнанка темнее, бриджи уходят внутрь); гладкая тёмная кожа с узким бликом
    // спереди-сбоку и тёмным кантом по верху. [y, радиус]
    const BOOT = [[0.46, 0.055], [0.435, 0.052], [0.38, 0.05], [0.32, 0.049], [0.26, 0.045], [0.2, 0.04], [0.14, 0.035], [0.075, 0.036]];
    const ridingBoots = B => {
      ['L', 'R'].forEach(sd => {
        const s = sd === 'L' ? 1 : -1, knee = J('shin_' + sd), ank = J('foot_' + sd), rings = [];
        BOOT.forEach(([y, r], i) => {
          const t = clamp((knee[1] - y) / (knee[1] - ank[1]), 0, 1);
          const R = { c: [lerp(knee[0], ank[0] + s * 0.004, t), y, lerp(0.002, -0.008, t)], rx: r, rz: r * 1.07 };
          if (!i) R.dy = a => 0.012 * Math.pow(Math.max(0, Math.cos(a)), 2);
          rings.push(R);
        });
        B.tube(rings, 12, (ri, si, p, a) => {
          const y = p[1], w = y > ank[1] + 0.03 ? W1('shin_' + sd) : mixW('shin_' + sd, 'foot_' + sd, sst(ank[1] + 0.03, ank[1] - 0.01, y));
          const sh = Math.pow(Math.max(0, Math.cos(a - 0.45 * s)), 12);
          const c = mix3(mix3(BT, BTD, Math.pow(Math.abs(Math.sin(a)), 3) * 0.35, [0, 0, 0]), BTL, sh * 0.9 * (ri ? 1 : 0.4));
          return { col: ri ? c : mix3(c, BTD, 0.55, c), w };
        });
      });
    };
    // бордовый саквояж-«боулинг» в свободной руке за ручки (у бедра, как в ролике): пухлый корпус — низ коробкой со
    // скруглёнными рёбрами, верх куполом вдоль длины; две круглые ручки сходятся в кулаке. Длинной стороной наискосок
    // (спереди виден торец и бок, сбоку — весь бок), чуть наружу от полы пальто и с креном к кулаку; молния по куполу,
    // золотой бегунок. Корпус строится у начала координат и ставится поворотом; жёстко на кисти, прячется как сумочка
    const BG = { size: [0.12, 0.168, 0.258], c: [0.276, 0.56, 0.045], grip: [0.214, 0.7, -0.002], yaw: -0.62, roll: 0.2 };
    const bowlingBag = B => {
      const w = W1('hand_L'), cy = Math.cos(BG.yaw), sy = Math.sin(BG.yaw), cf = Math.cos(BG.roll), sf = Math.sin(BG.roll), C = BG.c;
      // крен вокруг длины (локальная z), потом поворот вокруг вертикали; обратный — для точки хвата
      const rot = v => { const x1 = v[0] * cf - v[1] * sf, y1 = v[0] * sf + v[1] * cf; return [x1 * cy + v[2] * sy, y1, -x1 * sy + v[2] * cy]; };
      const inv = v => { const x1 = v[0] * cy - v[2] * sy, z1 = v[0] * sy + v[2] * cy; return [x1 * cf + v[1] * sf, -x1 * sf + v[1] * cf, z1]; };
      const [D, Hh, L] = BG.size, top = Hh * 0.5, G = inv([BG.grip[0] - C[0], BG.grip[1] - C[1], BG.grip[2] - C[2]]);
      const i0 = B.p.length / 3;
      B.part = 2;
      // сечение: низ чуть скруглён, выше середины — купол поперёк (глубина к гребню) и вдоль (торцы скругляются: сбоку —
      // «буханка», а не коробка)
      const SEGB = 12;
      bagBox(BG.size, BAG, { gloss: true, sq: 2.6, rings: 9, seg: SEGB,
        prof: t => { const u = clamp((t - 0.4) / 0.6, 0, 1), b = 0.9 + 0.1 * sst(0, 0.14, t); return [Math.max(0.16, Math.sqrt(1 - u * u)) * b, Math.sqrt(1 - 0.72 * u * u) * (0.95 + 0.05 * b)]; } })(B, [0, 0, 0], w);
      // донышко и макушка (крышки трубы, последние 2 × SEGB граней) у колец сверху вниз смотрят внутрь: с креном сумки дно
      // видно сбоку — изнанкой (светлое, сиреневое). Разворачиваем грани крышек наружу (и в контуре)
      [B.idx, B.ol].forEach(arr => { for (let k = arr.length - 2 * SEGB * 3; k < arr.length; k += 3) { const q = arr[k + 1]; arr[k + 1] = arr[k + 2]; arr[k + 2] = q; } });
      const i1 = B.p.length / 3;
      // молния по гребню купола (дугой: торцы скруглены) и золотой бегунок
      const crest = z => { const zz = Math.abs(z) / (0.5 * L), u = Math.min(1, Math.sqrt(Math.max(0, 1 - zz * zz) / 0.72)); return -top + Hh * (0.4 + 0.6 * u) - 0.001; };
      B.tube([0, 1, 2, 3, 4, 5, 6].map(i => { const z = lerp(-0.4, 0.4, i / 6) * L; return { c: [0, crest(z), z], rx: 0.0035, rz: 0.0035 }; }), 5, () => ({ col: tc('#2A0A0C'), w }));
      B.blob([0.011, top - 0.012, 0.25 * L], [0.004, 0.012, 0.007], tc('#C9A45C'), w, 6, 4);
      // ручки: дуги от боков купола (по обе стороны молнии) к кулаку; сечение — по рамке вдоль дуги (без контура: тонкие)
      const HC = mix3(tc(BAG[0]), tc(BAG[2]), 0.25, [0, 0, 0]), HL = tc(BAG[2]);
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
      [-1, 1].forEach(k => {
        const A0 = [k * D * 0.2, top - 0.012, -0.27 * L], A1 = [k * D * 0.2, top - 0.012, 0.27 * L], mid = [k * D * 0.2, top - 0.012, 0], up = [G[0] - mid[0], G[1] - mid[1], G[2] - mid[2]];
        const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8, h = Math.sin(u * PI); pts.push([lerp(A0[0], A1[0], u) + up[0] * h, lerp(A0[1], A1[1], u) + up[1] * h, lerp(A0[2], A1[2], u) + up[2] * h]); }
        // рамка: нормаль плоскости дуги (постоянная) и бинормаль поперёк касательной — без вырождения на вершине дуги
        const PN = unit(cross([0, 0, 1], up)), base = B.p.length / 3, NS = 6, r = 0.0064;
        pts.forEach((p, i) => {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(8, i + 1)], t = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), Bn = unit(cross(t, PN));
          for (let j = 0; j <= NS; j++) { const v = j / NS * 2 * PI, cv = Math.cos(v), sv = Math.sin(v), nn = [PN[0] * cv + Bn[0] * sv, PN[1] * cv + Bn[1] * sv, PN[2] * cv + Bn[2] * sv]; B.v([p[0] + nn[0] * r, p[1] + nn[1] * r, p[2] + nn[2] * r], nn, mix3(HC, HL, Math.max(0, nn[1]) * 0.5, [0, 0, 0]), w); }
        });
        for (let i = 0; i < 8; i++) for (let j = 0; j < NS; j++) { const a = base + i * (NS + 1) + j, b = a + 1, c2 = a + NS + 1, d = c2 + 1; B.tri(a, b, c2, false); B.tri(b, d, c2, false); }
      });
      // на место: поворот и сдвиг всех вершин сумки; у корпуса — блик глянцевой кожи по итоговой нормали (спереди-сверху
      // и сбоку снаружи: читается и в лоб, и в профиль)
      const GL = tc('#B4605E'), L1 = [-0.27, 0.55, 0.79], L2 = [0.75, 0.48, 0.45];
      for (let i = i0; i < B.p.length / 3; i++) {
        const p = rot([B.p[i * 3], B.p[i * 3 + 1], B.p[i * 3 + 2]]), n = rot([B.n[i * 3], B.n[i * 3 + 1], B.n[i * 3 + 2]]);
        B.p[i * 3] = p[0] + C[0]; B.p[i * 3 + 1] = p[1] + C[1]; B.p[i * 3 + 2] = p[2] + C[2];
        B.n[i * 3] = n[0]; B.n[i * 3 + 1] = n[1]; B.n[i * 3 + 2] = n[2];
        if (i >= i1) continue;
        const d1 = Math.max(0, n[0] * L1[0] + n[1] * L1[1] + n[2] * L1[2]), d2 = Math.max(0, n[0] * L2[0] + n[1] * L2[1] + n[2] * L2[2]), h = Math.max(Math.pow(d1, 8), 0.7 * Math.pow(d2, 8)) * 0.6;
        for (let c = 0; c < 3; c++) B.c[i * 3 + c] += (GL[c] / 255 - B.c[i * 3 + c]) * h;
      }
      B.part = 0;
    };
    LOOKS.suede = {
      hem: 0.47, hair: H, top: 1.835, keep: 0.3,
      morph: [crown({ top: 1.835, vol: 0.008 }), flatten(['cuff']), neckIn],
      // верх и полы тренча — прочь (пальто, водолазка — новым кроем); ноги выше голенищ — под брюками
      hide: hideTorso({ skirt: true }, (i, z, x, y) => z === Z.legs && y > 0.44),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands, neck: neckPaint,
        sleeve: suede, cuff: suede,
        neck: (x, y, z, o) => (y < 1.338 ? rib(x, y, z, o) : null),
        legs, shoes: (x, y, z, o) => { o.k = 0.2; o.lo = 0.7; return BTD; },
      },
      garment: B => {
        const st = LASTST, SS = shellSurf(st);
        ridingBoots(B);
        // кремовые бриджи для верховой езды: две облегающие штанины от пояса в голенища (видны в распахе пальто)
        breeches(B, SS);
        if (SS) {
          // водолазка: кольцо от талии до верха поверхности (шея), рубчик
          shellPiece(B, SS, { rows: 6, closed: true, cols: () => ringAz(22), ol: false,
            sv: (a, v) => lerp(shellS(SS, a, 0.96), 1, v), off: () => 0.0025, col: (p, a) => ribAt(p, a) });
          // пальто распахнуто шире (у подола бриджи видны обеими ногами), лацканы широкие, с уступом у ключицы
          blazer(B, SS, { hem: 0.47, brk: 0.97, xHem: 0.135, xBrk: 0.066, notch: 1.198, lw: 0.1, lift: 0.009, col: jcol, rows: 12, cols: 28, collarTop: 1.288,
            off: (a, y) => 0.011 + 0.01 * sst(0.95, 0.47, y) + 0.008 * sst(1.12, 1.24, y) * Math.pow(Math.sin(a), 4),
            pockets: [[1, 0.835, 0.075], [-1, 0.835, 0.075]], button: [-0.07, 0.978] });
        }
        // ворот-гольф: мягкий валик вокруг шеи до подбородка (ровный верх, закрывает пилообразный край краски)
        const nw = W1('neck'), roll = [[1.346, 0.052, 0.047], [1.335, 0.059, 0.054], [1.312, 0.062, 0.057], [1.29, 0.06, 0.055], [1.272, 0.057, 0.053]].map(([y, rx, rz]) => ({ c: [0, y, -0.011], rx, rz }));
        B.tube(roll, 16, (ri, si, p, a) => { const f = 0.5 + 0.5 * Math.sin(a * 30); return { col: mix3(TN, ri === 1 || ri === 2 ? TNL : TND, 0.12 + 0.1 * f), w: nw }; }, { capTop: 'noline' });
        // бордовый саквояж-«боулинг» в левой руке за ручки
        bowlingBag(B);
      },
    };
  }
  /* ---------- 3. «Зефирка»: пастельный кардиган оверсайз, белое мини, белые сапоги, сиреневая сумочка, жемчуг, очки на макушке ---------- */
  {
    const H = { base: '#2A1A12', dark: '#170E09', light: '#4E3526', part: 0.012, keep: 0.35, gloss: 0.32 };
    const HP = hairPaint(H);
    const PK = tc('#F6C6CC'), PKD = tc('#DEA0AA'), PKL = tc('#FDE3E7');
    const WD = tc('#F7F6F4'), WDD = tc('#DCDCE0');
    const BTW = tc('#F1EBE1'), BTWD = tc('#CFC5B6'), HEEL = tc('#C49A6C');
    const out = [0, 0, 0];
    // трикотаж: мелкий вертикальный рубчик, резинка по низу и на манжетах — крупнее
    const knit = (x, y, z, o) => {
      // ровный трикотаж (свет даёт объём): строчки и хлястики тренча не проступают
      o.f = 1;
      const r = 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 140 + y * 4);
      mix3(PK, PKD, r * 0.1, out);
      if (y < 0.705) { const b = 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 70); mix3(out, b > 0.5 ? PKL : PKD, 0.22, out); if (y > 0.698) mix3(out, PKD, 0.3, out); }
      return out;
    };
    const cuff = (x, y, z, o) => { o.f = 1; const b = 0.5 + 0.5 * Math.sin(Math.atan2(x - (x > 0 ? 0.2 : -0.2), z) * 18); return mix3(PK, b > 0.5 ? PKL : PKD, 0.25, out); };
    // белое платье в распахе — ровным цветом (тени пуговиц и строчек тренча не проступают), объём даёт свет
    const dress = (x, y, z, o) => { o.flat = 1; return y < 0.69 ? mix3(WD, WDD, 0.25, out) : WD; };
    const J3 = jacket({ main: knit, top: dress, bottom: dress, neckY: 1.18, w: 1.25, edge: '#D9A3AE' });
    const legs = (x, y, z, o) => {
      if (y > 0.41) { o.f = 1; return SKIN; }
      o.k = 0.15; o.lo = 0.7; o.hi = 1.25;
      return mix3(BTW, BTWD, 0.1, out);
    };
    const shoes = (x, y, z, o) => {
      o.k = 0.15;
      // каблук-столбик светлого дерева — сзади
      return z < -0.02 && y < 0.06 ? HEEL : BTW;
    };
    // рукава-«фонарики»: предплечье пышнее к середине, у манжеты собрано
    const balloon = sleeveShape((t, r) => (t < 0 ? 1 + 0.04 * sst(-0.6, 0, t) + 0.06 * sst(-0.9, -0.3, t) : 1 + 0.13 * Math.sin(clamp(t / 0.85, 0, 1) * PI) - 0.04 * sst(0.85, 1.0, t)), ['sleeve']);
    const BAG = ['#C9B3E0', '#A48CC0', '#EDE3F7'];
    // кардиган: края полочек почти отвесно (у подола шире), выше груди — к основанию шеи; сзади — вокруг шеи
    const edgeX = y => (y < 1.12 ? lerp(0.118, 0.084, sst(0.66, 1.12, y)) : lerp(0.084, 0.052, sst(1.12, 1.27, y)));
    const CH = 0.64, CT = 1.27;
    // вырез платья: спереди U на 1.18, к плечам выше, сзади 1.275
    const dressTop = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return 1.18 + 0.075 * sst(0.25, 0.85, aa) + 0.02 * sst(1.6, 2.6, aa); };
    // спущенное покатое плечо (в ролике — оверсайз без угла): верх рукава тренча у края плеча ниже до 2.2 см (к шее — 0),
    // кардиган и платье на поверхности тела — на столько же вниз по нормали (сверху плеча — вертикально)
    const SHD = (x, y) => 0.03 * sst(0.07, 0.19, Math.abs(x)) * sst(1.08, 1.22, y);
    const slopeSh = ctx => {
      const { st, p, zn, moved } = ctx;
      for (let i = 0; i < st.n; i++) {
        if (zn[i] !== Z.sleeve && zn[i] !== Z.cuff) continue;
        const d = SHD(p[i * 3], p[i * 3 + 1]);
        if (d > 0) { p[i * 3 + 1] -= d; moved[i] = 1; }
      }
    };
    const ring = (n, a0) => { const out = []; for (let i = 0; i < n; i++) out.push((a0 || 0) - PI + (i + 0.5) * 2 * PI / n); return out; };
    LOOKS.pink = {
      hem: 0.66, hair: H, top: 1.82, keep: 0.3,
      morph: [crown({ top: 1.82 }), flatten(['cuff']), slopeSh, balloon, neckIn],
      // верх тренча и полы — прочь (кардиган, платье и кожа в вырезе — новым кроем на поверхности тела)
      hide: hideTorso({ skirt: true }),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands, neck: neckPaint,
        sleeve: knit, cuff, legs, shoes,
      },
      garment: B => {
        // кожа на шее сзади и с боков (выемка у основания шеи в профиль)
        neckPatch(B, LASTST);
        const st = LASTST, S = shellSurf(st);
        skinLegs(B, { top: 0.74, bot: 0.40 });
        if (S) {
          const NSK = neckSkin(st), v0 = B.p.length / 3;
          // покатое плечо: поверхность кардигана и платья у края плеча — вниз вслед за рукавом (SHD по нормали)
          const qs = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
          const drop = (a, s) => { shellAt(S, a, s, qs); return SHD(qs.p[0], qs.p[1]) * clamp(qs.n[1] * 1.6, 0, 1); };
          // ряды кардигана гуще к плечу (угол плеча — несколько рядов, а не один)
          const cv = v => 1 - Math.pow(1 - v, 1.35);
          // платье-мини: облегает, к подолу уже по бокам (по поверхности полы тренча)
          B.bk = 0.92;
          shellPiece(B, S, { rows: 9, closed: true, cols: () => ring(24), ol: (u, v) => v > 0.85,
            sv: (a, v) => shellS(S, a, lerp(0.672, dressTop(a), v)),
            off: (a, s, u, v) => { const y = lerp(0.672, 1.2, v); return 0.0025 - 0.045 * sst(0.86, 0.67, y) * Math.pow(Math.sin(a), 2) - drop(a, s); },
            col: (p, a, s, u, v) => (v < 0.06 ? mix3(WD, WDD, 0.12) : v > 0.96 ? mix3(WD, WDD, 0.12) : WD) });
          // кожа выше выреза до шеи (без контура: стык с шеей не обводится)
          skinRing(B, st, S, dressTop, 24, 0, 0, drop);
          // кардиган оверсайз: полочки и спинка одним куском от левого края полочки вокруг спины к правому,
          // по краям — резинка 1.4 см (толще), по низу — резинка; спущенное плечо — поверх рукава тренча
          const band = [0.007, 0.014];
          const colsAt = v => { const y = lerp(CH, CT, v), aL = shellAz(S, edgeX(y), y, 1), aR = shellAz(S, -edgeX(y), y, -1); return azRow(aL, 2 * PI + aR, 28, band, 0.13); };
          const cardOffAt = y => 0.009 + 0.012 * sst(1.05, 0.68, y) - 0.004 * sst(1.2, 1.28, y);
          const cardTop = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(CT, 1.29, sst(0.6, 1.6, aa)); };
          shellPiece(B, S, { rows: 14, cols: colsAt,
            sv: (a, v) => shellS(S, a, lerp(CH, cardTop(a), cv(v))),
            off: (a, s, u, v) => { const y = lerp(CH, 1.27, cv(v)), e = Math.min(u, 1 - u) * 27; return cardOffAt(y) + 0.006 * Math.pow(Math.sin(a), 2) + (e < 2.5 ? 0.003 : 0) - drop(a, s); },
            col: (p, a, s, u, v) => {
              const e = Math.min(u, 1 - u) * 27, y = p[1];
              if (e < 2.2 || y < 0.69) { const r = 0.5 + 0.5 * Math.sin(a * 120); return mix3(PKD, PK, 0.45 + 0.25 * r); }
              return mix3(PK, PKD, 0.08 + 0.06 * Math.sin(a * 60 + y * 9));
            } });
          B.bk = 0.78;
          // сидя полы кардигана и подол платья сзади — к тазу (не «тарелкой»)
          seatW(B, v0);
          // пуговицы на правой планке (её правая, −x) — на середине резинки планки (7 мм от края), в тон, чуть темнее
          for (let k = 0; k < 6; k++) {
            const y = lerp(0.72, 1.12, k / 5), x = -(edgeX(y) + 0.007), a = shellAz(S, x, y, -1);
            discOn(B, S, x, y, 0.0055, cardOffAt(y) + 0.006 * Math.pow(Math.sin(a), 2) + 0.003 + 0.0016, PKD);
          }
          // жемчуг у основания шеи, как в ролике: крупные бусины вплотную друг к другу по дуге от плеча до плеча (спереди
          // ниже — 1.236, к плечам выше), шаг — по длине дуги; за краями кардигана бусины уходят под трикотаж; блик сверху
          const PL = tc('#F6EEE4'), PLD = tc('#D9CBB8'), PLW = tc('#FFFFFF'), q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
          const PR = 0.0078, nkY = a => 1.236 + 0.032 * sst(0.15, 1.3, Math.abs(a)), nkP = a => { shellAt(S, a, shellS(S, a, nkY(a)), q); return q.p.slice(); };
          // край полочки на высоте y (азимут), за ним бусины — под резинкой
          const aEd = y => shellAz(S, edgeX(y), y, 1), beads = [0];
          [1, -1].forEach(sg => {
            let a = 0, pp = nkP(0);
            for (let k = 0; k < 400 && Math.abs(a) < aEd(nkY(a)) + 0.02; k++) {
              a += sg * 0.004; const np = nkP(a);
              if (Math.hypot(np[0] - pp[0], np[1] - pp[1], np[2] - pp[2]) >= PR * 2.04) { beads.push(a); pp = np; }
            }
          });
          beads.forEach(a => {
            const y = nkY(a); shellAt(S, a, shellS(S, a, y), q);
            const under = sst(aEd(y) - 0.06, aEd(y), Math.abs(a)), dd = lerp(PR + 0.001, PR * 0.2, under);
            const c = [q.p[0] + q.n[0] * dd, q.p[1] + q.n[1] * dd, q.p[2] + q.n[2] * dd];
            B.blob(c, [PR, PR, PR], n => { const l = n[1] * 0.55 + n[2] * 0.65 + n[0] * 0.2; return l > 0.8 ? mix3(PL, PLW, (l - 0.8) * 4) : mix3(PL, PLD, Math.max(0, -l) * 0.6); }, { si: q.si.slice(), sw: q.sw.slice() }, 6, 4, { ol: false });
          });
        }
        bootShafts(B, { col: '#F1EBE1', light: '#FFFDF8', dark: '#CFC5B6', top: 0.41, rTop: 0.062, rAnk: 0.047 });
        B.part = 3;
        const hw = W1('head'), GL = tc('#2A2024'), GLL = tc('#6E6470'), GF = tc('#1A1214'), HI = tc('#B8B0BC');
        const dm = LASTST && LASTST.dome, GC = dm ? dm.C : M.crownC;
        const surf = (az, e, dr) => { const r = (dm ? dm.domeR(az, e) : 0.318) + dr, ce = Math.cos(e); return [GC[0] + Math.sin(az) * ce * r, GC[1] + Math.sin(e) * r, GC[2] + Math.cos(az) * ce * r]; };
        const E1 = 0.97;
        // линза: плоский «кошачий глаз» в касательной плоскости купола; центр, обод (оправа), блик у верхнего края
        const lens = s2 => {
          const az = s2 * 0.215, c = surf(az, E1, 0.007), N = [Math.sin(az) * Math.cos(E1), Math.sin(E1), Math.cos(az) * Math.cos(E1)];
          const U = [Math.cos(az), 0, -Math.sin(az)], V = [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]];
          const pt = (u, v, dn) => [c[0] + U[0] * u + V[0] * v + N[0] * dn, c[1] + U[1] * u + V[1] * v + N[1] * dn, c[2] + U[2] * u + V[2] * v + N[2] * dn];
          const NS = 16, out2 = [];
          for (let k = 0; k < NS; k++) {
            const t = k / NS * 2 * PI, cu = Math.cos(t), sv = Math.sin(t), side = cu * s2;
            // внешний верхний угол приподнят и заострён (кошачий глаз), низ — круглее
            const u = 0.036 * cu, v = 0.021 * sv + (sv > 0 && side > 0 ? 0.01 * Math.pow(side, 3) * sv : 0) - (sv < 0 ? 0.002 * sv * sv : 0);
            out2.push([u * (1 + (side > 0 && sv > 0 ? 0.12 * side : 0)), v]);
          }
          [1, -1].forEach(face => {
            const nrm = face > 0 ? N : N.map(q => -q), dn = face > 0 ? 0.0012 : -0.0012, base = B.p.length / 3;
            B.v(pt(0, 0, dn), nrm, mix3(GL, GLL, 0.25), hw);
            out2.forEach(([u, v], k) => { const hl = face > 0 && k === Math.round(NS * 0.3) ? 0.55 : 0; B.v(pt(u * 0.72, v * 0.72, dn), nrm, mix3(mix3(GL, GLL, 0.45 * Math.max(0, v / 0.02)), HI, hl), hw); });
            out2.forEach(([u, v]) => B.v(pt(u, v, dn), nrm, GF, hw));
            for (let k = 0; k < NS; k++) {
              const a = base + 1 + k, b = base + 1 + (k + 1) % NS, a2 = a + NS, b2 = b + NS;
              if (face > 0) { B.tri(base, a, b); B.tri(a, a2, b); B.tri(b, a2, b2); } else { B.tri(base, b, a); B.tri(a, b, a2); B.tri(b, b2, a2); }
            }
          });
          return { c, U, V, N };
        };
        const L1 = lens(1), L2 = lens(-1);
        // перемычка и короткие дужки: от внешнего края линзы назад по куполу, кончик — в волосах
        B.tube([0, 1, 2].map(i => { const az = lerp(-0.075, 0.075, i / 2); return { c: surf(az, E1 + 0.014, 0.006), rx: 0.0028, rz: 0.0028 }; }), 4, () => ({ col: GF, w: hw }));
        [1, -1].forEach(s2 => {
          B.tube([0, 1, 2, 3].map(i => { const t = i / 3, az = s2 * lerp(0.38, 0.64, t), e = E1 - 0.02 - 0.1 * t; return { c: surf(az, e, lerp(0.004, -0.004, t)), rx: 0.0026, rz: 0.0026 }; }), 4, () => ({ col: GF, w: hw }));
        });
        B.part = 0;
        earrings(B, { y: 1.48, x: 0.196, z: -0.01, make: (B2, c, s, w) => B2.blob(c, [0.011, 0.011, 0.011], tc('#F6EEE4'), w, 6, 4, { ol: false }) });
        // сиреневая пухлая сумка: мягкий мешок, верх собран складками, две короткие ручки
        // сиреневый пухлый мешочек (лакированный): круглое сечение, пузо посередине, верх собран в 6 рюшей, блик-полоса,
        // две короткие петли-ручки; ремешок-петля шире пышного рукава (не проступает сквозь трикотаж)
        bagOnForearm(B, {
          col: BAG[0], strap: '#B9A2D2', strapT: 0.42, noStrap: true, size: [0.2, 0.18, 0.14], dx: 0.08, drop: 0.14, handles: false,
          // мешочек: круглое дно, пузо в нижней трети, к верху собран (0.42) под рюшами, две короткие петли
          body: bagBox([0.2, 0.18, 0.14], BAG, { gloss: true, sq: 2, rings: 9, seg: 12, handleOl: false,
            prof: t => { const k = (t < 0.35 ? lerp(0.62, 1.0, Math.sin(t / 0.35 * PI / 2)) : lerp(1.0, 0.46, sst(0.35, 0.95, t))); return [k * 1.05, k * 0.95]; },
            off: (a, t) => (t > 0.8 ? 0.006 * Math.cos(a * 7) * (t - 0.8) / 0.2 : 0.002 * Math.cos(a * 5 + t * 7)),
            handles: [0.09, 0.0095], handleZ: [-0.014, 0.014], handleCol: '#C3ACDC' }),
        });
      },
    };
  }
  /* ---------- 4. «Медный закат»: атласное макси на запах, рукава-«крылья» с разрезом, кушак, золотые серьги и клатч ---------- */
  {
    const H = { base: '#3A1E12', dark: '#221009', light: '#7A4A30', tips: '#7A4A30', part: 0.012, keep: 0.55 };
    const HP = hairPaint(H);
    const RS = tc('#B8521F'), RSD = tc('#7A2E10'), RSL = tc('#F09A55');
    const SA = tc('#A9471B'), SAD = tc('#6E2A0E'), SAL = tc('#E08A4A');
    const STRAP = tc('#C99A62'), SOLE = tc('#B88A58');
    const skirtCol = (p, a, t) => {
      const f = Math.sin(a * 11 + 0.3) * (0.4 + 0.6 * t) + 0.25 * Math.sin(a * 5 - t * 3);
      const c = mix3(RS, RSL, Math.pow(Math.max(0, f), 6) * 0.6);
      return mix3(c, RSD, Math.pow(Math.max(0, -f), 2) * 0.5 + (Math.cos(a) < -0.3 ? 0.12 : 0));
    };
    // волосы у ушей — назад за уши (уши и серьги видны, как в ролике); у лица — мягко, без растяжек
    const behindEars = ctx => {
      const { st, p, zn, moved, P0 } = ctx, lk = faceLock(st);
      for (let i = 0; i < st.n; i++) {
        if (zn[i] !== Z.hair_skull && zn[i] !== Z.hair_back) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], ax = Math.abs(x);
        if (y < 1.3 || y > 1.66 || ax < 0.12 || z < -0.09) continue;
        // волосы, сваренные с краем лица, — на месте (грани лица не тянутся)
        const w = sst(1.3, 1.42, y) * sst(1.66, 1.56, y) * sst(0.12, 0.18, ax) * sst(-0.09, -0.03, z) * lk[i];
        if (w <= 0) continue;
        p[i * 3 + 2] = z - 0.042 * w; p[i * 3] = x - Math.sign(x) * 0.012 * w; moved[i] = 1;
      }
    };
    // волосы до груди, как в ролике: всё ниже плеч поджато вверх (низ ≈ 1.12 вместо 0.85), наклон 1 → HK плавно между
    // 1.36 и 1.22 (без излома); зазор до тела — от прежнего, к низу меньше (пряди лежат на спине, а не торчат клином)
    const HK = 0.4, HY = 1.36, HLUT = new Float32Array(121);
    {
      let acc = HY; HLUT[120] = HY;
      for (let j = 119; j >= 0; j--) { acc -= 0.005 * lerp(HK, 1, sst(1.22, 1.36, 0.76 + (j + 0.5) * 0.005)); HLUT[j] = acc; }
    }
    const shortHair = ctx => {
      const { st, p, zn, moved } = ctx, lk = faceLock(st), S = shellSurf(st);
      for (let i = 0; i < st.n; i++) {
        if ((zn[i] !== Z.hair_skull && zn[i] !== Z.hair_back) || !lk[i]) continue;
        const y = p[i * 3 + 1];
        if (y >= HY) continue;
        const f = clamp((y - 0.76) / 0.005, 0, 119.999), j = Math.floor(f), y2 = lerp(HLUT[j], HLUT[j + 1], f - j) + Math.min(0, y - 0.76) * HK;
        const x = p[i * 3], z = p[i * 3 + 2], a = Math.atan2(x, z - SH_CZ), r = Math.hypot(x, z - SH_CZ) || 1;
        const R0 = S ? shellR(S, a, y) : r, R1 = S ? shellR(S, a, y2) : r, g = lerp(1, 0.55, sst(1.36, 0.95, y));
        const k = lk[i], r2 = lerp(r, Math.max(R1 + 0.02, R1 + (r - R0) * g), k) / r;
        p[i * 3] = x * r2; p[i * 3 + 2] = SH_CZ + (z - SH_CZ) * r2; p[i * 3 + 1] = lerp(y, y2, k); moved[i] = 1;
      }
    };
    // лиф на запах: правая пола (её правая, −x) — кольцом с вырезом «V», левая пола — поверх, её край от левого плеча
    // через вырез к правому боку талии; вырез до 1.075
    const VT = 1.075, VC = 0.006, VK = 0.28;
    const vee = { c: VC, w: y => (y - VT) * VK };
    const edgeL = y => (y >= VT ? VC + (y - VT) * VK : VC - (VT - y) * 1.05);
    const neckY = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(1.275, 1.3, sst(1.2, 2.6, aa)); };
    // атлас лифа: складки сходятся к талии, блик на гребнях
    const bodiceCol = (p, k) => {
      const th = Math.atan2(p[0], Math.max(0.02, p[1] - 0.97)), f = Math.sin(th * 13 + p[1] * 7) * sst(0.98, 1.08, p[1]);
      const c = mix3(RS, RSL, Math.pow(Math.max(0, f), 4) * 0.5);
      return mix3(c, RSD, Math.pow(Math.max(0, -f), 2) * 0.35 + (k || 0));
    };
    // рукав-крыло: широкое полотнище от спущенного плеча до манжеты, разрез по внешней стороне (рука видна), у запястья
    // собрано в манжету; кости плеча и предплечья
    function wingSleeve(B, sd) {
      const s = sd === 'L' ? 1 : -1, u0 = J('upperarm_' + sd), e0 = J('forearm_' + sd), h0 = J('hand_' + sd);
      const NR = 9, SEG = 12, base = B.p.length / 3;
      const axisAt = t => (t < 0.45 ? [lerp(u0[0], e0[0], t / 0.45), lerp(u0[1], e0[1], t / 0.45), lerp(u0[2], e0[2], t / 0.45)] : [lerp(e0[0], h0[0], (t - 0.45) / 0.55), lerp(e0[1], h0[1], (t - 0.45) / 0.55), lerp(e0[2], h0[2], (t - 0.45) / 0.55)]);
      for (let r = 0; r < NR; r++) {
        const t = lerp(0.05, 0.93, r / (NR - 1)), c = axisAt(t), c2 = axisAt(Math.min(1, t + 0.02)), c1 = axisAt(Math.max(0, t - 0.02));
        const ax = [c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]], al = Math.hypot(ax[0], ax[1], ax[2]) || 1, A = ax.map(v => v / al);
        // поперечные оси: «наружу» (от тела) и «вперёд»
        let X = [s, 0, 0]; const d = X[0] * A[0] + X[1] * A[1] + X[2] * A[2]; X = [X[0] - A[0] * d, X[1] - A[1] * d, X[2] - A[2] * d]; const xl = Math.hypot(X[0], X[1], X[2]) || 1; X = X.map(v => v / xl);
        const Zf = [A[1] * X[2] - A[2] * X[1], A[2] * X[0] - A[0] * X[2], A[0] * X[1] - A[1] * X[0]];
        const zs = Zf[2] < 0 ? -1 : 1;
        // радиус: плечо 0.07, к середине предплечья 0.125, у манжеты 0.048; низ полотнища провисает (снизу дальше от руки)
        const R = t < 0.88 ? lerp(0.07, 0.125, sst(0.05, 0.62, t)) : lerp(0.125, 0.048, sst(0.88, 0.93, t));
        // разрез: по внешне-передней стороне, шире к локтю, у плеча и у манжеты закрыт
        const slit = t > 0.18 && t < 0.86 ? 0.55 * Math.sin(clamp((t - 0.18) / 0.68, 0, 1) * PI) : 0;
        const gc = PI * 0.38, a0 = gc + slit, a1 = gc + 2 * PI - slit;
        B.squeeze = [c[0], c[1], c[2], sst(0.1, 0.3, t)];
        const w = t < 0.12 ? mixW('chest', 'upperarm_' + sd, 0.6 + t * 3) : t < 0.45 ? mixW('upperarm_' + sd, 'forearm_' + sd, sst(0.3, 0.5, t)) : mixW('forearm_' + sd, 'hand_' + sd, sst(0.86, 0.95, t) * 0.5);
        for (let k = 0; k <= SEG; k++) {
          const ang = lerp(a0, a1, k / SEG), ca = Math.cos(ang), sa = Math.sin(ang);
          // ang = 0 — наружу (X), π/2 — вперёд (Zf)
          const sag = 1 + 0.35 * Math.max(0, -Math.cos(ang - PI * 0.9)) * sst(0.2, 0.7, t) * (t < 0.88 ? 1 : 0);
          const rr = R * sag;
          const n = [X[0] * ca + Zf[0] * zs * sa, X[1] * ca + Zf[1] * zs * sa, X[2] * ca + Zf[2] * zs * sa];
          const pt = [c[0] + n[0] * rr, c[1] + n[1] * rr - 0.025 * sst(0.2, 0.7, t) * Math.max(0, -Math.cos(ang - PI)) , c[2] + n[2] * rr];
          const f = Math.sin(ang * 5 + t * 4), col = t > 0.88 ? mix3(RS, RSD, 0.3) : mix3(mix3(RS, RSL, Math.pow(Math.max(0, f), 6) * 0.55), RSD, Math.pow(Math.max(0, -f), 2) * 0.4);
          B.v(pt, n, col, w);
        }
      }
      B.squeeze = null;
      for (let r = 0; r < NR - 1; r++) for (let k = 0; k < SEG; k++) { const i0 = base + r * (SEG + 1) + k, i1 = i0 + 1, j0 = i0 + SEG + 1, j1 = j0 + 1; if (s > 0) { B.tri(i0, i1, j0); B.tri(i1, j1, j0); } else { B.tri(i0, j0, i1); B.tri(i1, j0, j1); } }
    }
    LOOKS.rust = {
      hem: 0.02, hair: H, top: 1.82, keep: 0.3, sitTuck: 0.3,
      morph: [crown({ top: 1.82 }), behindEars, shortHair, neckIn, slimShins(0.5)],
      // верх и полы тренча — прочь (лиф на запах, кушак, юбка и рукава-крылья — новым кроем); голени — кожа; рукава и
      // манжеты тренча — тоже (руки — капсулы кожи в одежде, верхний край кисти — под концом капсулы)
      hide: st => armHair(st, handRim(st, hideTorso({ skirt: true, legs: 0.36 }, (i, z) => z === Z.sleeve || z === Z.cuff)(st))),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands, neck: neckPaint,
        legs: (x, y, z, o) => { o.f = 1; return SKIN; },
        // босоножки на тонких ремешках: стопа — кожа, ремешок у пальцев, косой — через подъём, на щиколотке, тонкая
        // подошва (без «носка» по краю зоны обуви)
        shoes: (x, y, z, o) => {
          if (y > 0.058) { if (y > 0.074 && y < 0.083) { o.k = 0.2; return STRAP; } o.f = 1; return SKIN; }
          if (y < 0.011) { o.k = 0.3; return SOLE; }
          const dx = Math.abs(x) - 0.046;
          if (Math.abs(z - 0.1) < 0.007 || (Math.abs(z - 0.035 - dx * 0.9) < 0.005 && z > -0.01)) { o.k = 0.2; return STRAP; }
          o.f = 1; return SKIN;
        },
      },
      garment: B => {
        // кожа на шее сзади и с боков (выемка у основания шеи в профиль)
        neckPatch(B, LASTST);
        const st = LASTST, S = shellSurf(st);
        if (S) {
          const NSK = neckSkin(st);
          // правая пола + спинка: кусок от левого края выреза «V» вокруг спины к правому краю (ниже вершины выреза —
          // сомкнутое кольцо); края выреза — ровные прямые от плеч к вершине (столбцы ряда — от края, без зубцов)
          const RY0 = 0.95, RY1 = 1.27, NRc = 30;
          const xV = y => (y > VT ? (y - VT) * VK : 0);
          const colsR = v => { const y = lerp(RY0, RY1, v), w = xV(y), aL = shellAz(S, VC + w, y, 1), aR = shellAz(S, VC - w, y, -1); return azRow(aL, 2 * PI + aR, NRc, w > 0 ? [0.007] : null, 0.11); };
          const topR = a => neckY(a);
          shellPiece(B, S, { rows: 9, cols: colsR, ol: (u, v) => v > 0.8 || u < 0.03 || u > 0.97,
            sv: (a, v) => shellS(S, a, Math.min(lerp(RY0, RY1, v), neckY(a))),
            off: (a, s, u, v) => 0.0045 + 0.004 * sst(0.4, 0, v) + 0.008 * sst(1.1, 1.22, lerp(RY0, RY1, v)) * Math.pow(Math.sin(a), 2),
            col: (p, a, s, u, v) => (u > 0.97 ? mix3(RS, RSL, 0.3) : bodiceCol(p, p[0] < 0 && p[2] > 0.02 ? 0.12 : 0)) });
          // кожа выреза и шея: от вершины выреза (спереди) и от верха лифа (по бокам и сзади) до шеи (без контура)
          skinRing(B, st, S, a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(VT + 0.01, neckY(a), sst(0.15, 1.2, aa)); }, 30);
          // левая пола поверх: от края (через вырез к правому боку) до левого бокового шва; верх — по той же высоте, что и
          // у столбцов (край — прямая линия от левого плеча к правому боку талии)
          const colsL = v => { const y = lerp(RY0, RY1, v), x = edgeL(y), aE = shellAz(S, x, y, x >= 0 ? 1 : -1); return azRow(aE, 1.75, 12, [0.008], 0.11); };
          shellPiece(B, S, { rows: 9, cols: colsL, ol: (u, v) => u < 0.06 || v > 0.85,
            sv: (a, v) => shellS(S, a, Math.min(lerp(RY0, RY1, v), neckY(a))),
            off: (a, s, u, v) => 0.0045 + 0.004 * sst(0.4, 0, v) + 0.008 * sst(1.1, 1.22, lerp(RY0, RY1, v)) * Math.pow(Math.sin(a), 2) + 0.0035 * (1 - sst(0.6, 1, u)),
            col: (p, a, s, u, v) => (u < 0.04 ? mix3(RS, RSL, 0.35) : bodiceCol(p, 0)) });
          // кушак: тонкая лента своей ткани 0.975–1.015 на талии, узел спрятан в складках у её левого бока, два конца вниз
          shellPiece(B, S, { rows: 2, closed: true, cols: () => ringAz(28), ol: false,
            sv: (a, v) => shellS(S, a, lerp(0.975, 1.015, v)), off: (a, s, u, v) => 0.012 + 0.002 * Math.sin(v * PI),
            col: (p, a, s, u, v) => { const f = Math.sin(a * 14 + v * 3); return mix3(SA, f > 0 ? SAL : SAD, Math.abs(f) * 0.25); } });
          const kq = shellAt(S, 1.05, shellS(S, 1.05, 0.995));
          const kc = [kq.p[0] + kq.n[0] * 0.018, kq.p[1], kq.p[2] + kq.n[2] * 0.018];
          B.blob(kc, [0.014, 0.011, 0.007], n => mix3(SA, SAL, Math.max(0, n[1] * 0.5 + n[2] * 0.5) * 0.5), { si: kq.si, sw: kq.sw }, 6, 4, { rot: [0, 1.05, 0] });
          [[0.01, -0.17, 0.016], [-0.012, -0.13, 0.013]].forEach(([dx, dy, wd]) => {
            B.tube([0, 1, 2, 3].map(i => { const t = i / 3; return { c: [kc[0] + dx * t + 0.003, kc[1] - 0.006 + dy * t, kc[2] + 0.003 * t], rx: wd - 0.004 * t, rz: 0.0028 }; }), 5, () => ({ col: mix3(SA, SAD, 0.12), w: mixW('hips', 'thigh_L', 0.3) }));
          });
        }
        // юбка: от талии в пол, очень пышная, волнистый подол (складки разной глубины), верх — по талии лифа
        longSkirt(B, {
          top: 1.0, hem: 0.012, folds: 9, fold: 0.05, rings: 14, seg: 34,
          prof: (y, t) => {
            if (y > 0.8) { const k = (1.0 - y) / 0.2; return { cz: 0.018, rx: lerp(0.118, 0.215, k), rz: lerp(0.1, 0.16, k), fk: 0.3 }; }
            const k = (0.8 - y) / 0.79;
            return { cz: lerp(0.018, -0.02, k), rx: lerp(0.215, 0.35, Math.pow(k, 0.8)), rz: lerp(0.16, 0.3, Math.pow(k, 0.8)) };
          },
          hemWave: 0.022, fold2: 0.6,
          col: skirtCol, shinK: 0.9, thighK: 0.6, backShin: 1, backLeg: 1, mid: 0.06,
        });
        skinArms(B, st, { r: [0.04, 0.035, 0.031] });
        wingSleeve(B, 'L'); wingSleeve(B, 'R');
        // золотые скульптурные серьги: гвоздик у мочки и крупная капля-петля, висит вниз, плоскостью вперёд
        const GOLD = tc('#E2B85C'), GOLDD = tc('#A87C30'), GOLDL = tc('#FFE9A8');
        earrings(B, { y: 1.478, x: 0.2, z: -0.008, make: (B2, c, s, w) => {
          B2.blob(c, [0.007, 0.007, 0.005], GOLD, w, 6, 4, { ol: false });
          // капля: петля по «яйцу» (узкий верх, круглый низ) шириной 4.2 см и высотой 7.7 см, трубка 5 мм
          const ax = 0.021, ay = 0.0385, r = 0.0052, NU = 12, NV = 4, base = B2.p.length / 3, yaw = s * 0.35;
          const cy = Math.cos(yaw), sy = Math.sin(yaw), top = [c[0], c[1] - 0.006, c[2]];
          const at = t => { const wm = 0.55 + 0.45 * (1 - Math.cos(t)) / 2, lx = ax * Math.sin(t) * wm, ly = -ay * (1 - Math.cos(t)); return [top[0] + lx * cy, top[1] + ly, top[2] - lx * sy]; };
          const bn = [sy, 0, cy];
          for (let i = 0; i <= NU; i++) {
            const t = i / NU * 2 * PI, p0 = at(t), p1 = at(t + 0.01), tg = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            let nn = [tg[1] * bn[2] - tg[2] * bn[1], tg[2] * bn[0] - tg[0] * bn[2], tg[0] * bn[1] - tg[1] * bn[0]];
            const nl = Math.hypot(nn[0], nn[1], nn[2]) || 1; nn = nn.map(q => q / nl);
            for (let j = 0; j <= NV; j++) {
              const v = j / NV * 2 * PI, cv = Math.cos(v), sv = Math.sin(v);
              const n = [nn[0] * cv + bn[0] * sv, nn[1] * cv + bn[1] * sv, nn[2] * cv + bn[2] * sv];
              B2.v([p0[0] + n[0] * r, p0[1] + n[1] * r, p0[2] + n[2] * r], n, mix3(GOLD, sv > 0.3 ? GOLDL : GOLDD, 0.35 + 0.2 * Math.sin(t * 5)), w);
            }
          }
          for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = base + i * (NV + 1) + j, b = a + 1, c2 = a + NV + 1, d = c2 + 1; B2.tri(a, c2, b); B2.tri(b, c2, d); }
        } });
        // клатч-«подушка» в левой руке у бедра: длинной стороной вперёд, на ладони ниже манжеты крыла (не прячется под
        // ним); золото с бликом и мелкой «жатой» рябью
        {
          const CL = tc('#D8A848'), CLD = tc('#9A6E2C'), CLL = tc('#FFF2C4'), a = J('forearm_L'), b = J('hand_L'), t = 1.12;
          const c = [a[0] + (b[0] - a[0]) * t + 0.022, a[1] + (b[1] - a[1]) * t - 0.012, a[2] + (b[2] - a[2]) * t + 0.035];
          const ROT = [0.05, PI / 2 - 0.25, 0.1], RM = rotM(ROT), d = mulM(RM, [1, 0, 0]), up = mulM(RM, [0, 1, 0]);
          B.part = 2;
          // мягкий мешочек: складки сходятся к собранному верху, блик по гребням
          B.blob(c, [0.075, 0.038, 0.02], (n, p, u, v) => {
            const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], lx = q[0] * d[0] + q[1] * d[1] + q[2] * d[2], ly = q[0] * up[0] + q[1] * up[1] + q[2] * up[2];
            const pl = Math.sin(lx * 90 / lerp(1, 0.4, clamp(ly / 0.076 + 0.5, 0, 1))), cr = 0.5 + 0.5 * pl;
            const sh = Math.pow(Math.max(0, n[0] * 0.4 + n[1] * 0.6 + n[2] * 0.7), 6) * 0.9 * (0.6 + 0.4 * cr);
            return mix3(mix3(CL, CLD, Math.max(0, -n[1]) * 0.4 + (1 - cr) * 0.3), CLL, sh);
          }, W1('hand_L'), 12, 7, { rot: ROT });
          // собранный верх — валик вдоль длинной стороны
          B.blob([c[0] + up[0] * 0.03, c[1] + up[1] * 0.03, c[2] + up[2] * 0.03], [0.066, 0.01, 0.011], n => mix3(CL, n[1] > 0.3 ? CLL : CLD, 0.35), W1('hand_L'), 8, 4, { rot: ROT });
          B.part = 0;
        }
      },
    };
  }
  /* ---------- 5. «Сливочный шик»: костюм цвета слоновой кости, белый топ, гладкий пучок, золото, сумка-трапеция ---------- */
  {
    const H = { base: '#2A1D16', dark: '#160E0A', light: '#6A5448', part: 0, keep: 0.25, gloss: 0.3 };
    const HB = tc(H.base), HD = tc(H.dark);
    const IV = tc('#F1EBDD'), IVD = tc('#D6CBB5');
    const TOPW = tc('#F6F4EF'), TR = tc('#EDE5D6'), GOLD = tc('#E0B860'), GOLDL = tc('#FFF0B0');
    const out = [0, 0, 0];
    // Гладкая причёска — «шапочка» волос в одежде (кость головы) по форме черепа, плюс кайма волос автора у лица.
    // Край лица (смешанные грани лица и волос, пряди, нарисованные по краю маски, прядь у правого виска поверх дыры
    // маски) — геометрия автора на месте, только перекрашена: лицо видно ровно как у автора. Шапочка ложится поверх
    // каймы (её низ — на 3 мм выше верха лица по столбцу), сзади — до линии роста волос у шеи; остальные волосы — прочь.
    const CH = [0, 1.535, -0.075];
    // кольца: y, полуширина, центр по z, радиус вперёд, радиус назад
    const PROF = [[1.808, 0.004, -0.074, 0.004, 0.004], [1.802, 0.05, -0.074, 0.058, 0.055], [1.79, 0.088, -0.074, 0.103, 0.098], [1.772, 0.12, -0.075, 0.14, 0.133],
      [1.748, 0.146, -0.076, 0.17, 0.162], [1.72, 0.162, -0.077, 0.19, 0.18], [1.695, 0.171, -0.078, 0.2, 0.19], [1.67, 0.176, -0.079, 0.205, 0.194], [1.645, 0.178, -0.08, 0.207, 0.196],
      [1.62, 0.179, -0.08, 0.208, 0.197], [1.595, 0.179, -0.08, 0.208, 0.197], [1.57, 0.178, -0.08, 0.207, 0.196], [1.545, 0.176, -0.08, 0.204, 0.194], [1.515, 0.172, -0.082, 0.2, 0.19],
      [1.48, 0.16, -0.084, 0.19, 0.18], [1.45, 0.14, -0.08, 0.17, 0.157], [1.42, 0.112, -0.062, 0.14, 0.138], [1.395, 0.08, -0.04, 0.1, 0.1], [1.375, 0.056, -0.02, 0.066, 0.065],
      [1.358, 0.046, -0.012, 0.05, 0.041]];
    const Y0 = PROF[0][0], Y1 = PROF[PROF.length - 1][0];
    const ringAt = y => {
      if (y >= Y0) return PROF[0];
      for (let i = 1; i < PROF.length; i++) if (y >= PROF[i][0]) { const a = PROF[i - 1], b = PROF[i], k = (a[0] - y) / (a[0] - b[0]); return a.map((v, j) => lerp(v, b[j], k)); }
      return PROF[PROF.length - 1];
    };
    const basePt = (th, R) => { const ct = Math.cos(th); return [Math.sin(th) * R[1], R[0], R[2] + ct * (ct > 0 ? R[3] : R[4])]; };
    // линия роста волос сзади (у шеи, по углу кольца от середины лба 0 к затылку π): за ухом на уровне мочки, к затылку
    // ниже — до шеи (низ затылка у автора — кожа «полкой» под черепом: снизу она видна под краем шапочки рыжим), посередине
    // — под пучком
    const HL = [[1.1, 1.5], [1.35, 1.465], [1.7, 1.425], [2.3, 1.4], [2.7, 1.38], [PI, 1.372]];
    const fold = th => { const a = ((th % (2 * PI)) + 2 * PI) % (2 * PI); return a > PI ? 2 * PI - a : a; };
    const napeLine = th => { const a = fold(th); if (a <= HL[0][0]) return HL[0][1]; for (let i = 1; i < HL.length; i++) if (a <= HL[i][0]) return lerp(HL[i - 1][1], HL[i][1], (a - HL[i - 1][0]) / (HL[i][0] - HL[i - 1][0])); return HL[HL.length - 1][1]; };
    // низ шапочки по столбцу (угол th вокруг оси головы): верх кожи маски (сплошной кусок не меньше 1 см по высоте)
    // + 3 мм, к бокам и сзади — линия у шеи; без зубцов (минимум ±1, среднее ±2 из 256)
    const CAP = { seg: 44, rows: 14, gap: 0.003 };
    function capLine(st) {
      if (st.creamLine) return st.creamLine;
      const fp = new Uint8Array(NAZ * NEL), P0 = st.P0, I0 = st.I0;
      for (let t = 0; t < st.nt; t++) {
        if (st.tz[t] !== Z.face) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        const e = Math.max(Math.hypot(P0[a] - P0[b], P0[a + 1] - P0[b + 1], P0[a + 2] - P0[b + 2]), Math.hypot(P0[c] - P0[b], P0[c + 1] - P0[b + 1], P0[c + 2] - P0[b + 2]), Math.hypot(P0[a] - P0[c], P0[a + 1] - P0[c + 1], P0[a + 2] - P0[c + 2]));
        const nS = clamp(Math.ceil(e / 0.0025), 1, 20);
        for (let i = 0; i <= nS; i++) for (let j = 0; j <= nS - i; j++) {
          const wa = i / nS, wb = j / nS, wc = 1 - wa - wb, d = dirOf(P0[a] * wa + P0[b] * wb + P0[c] * wc, P0[a + 1] * wa + P0[b + 1] * wb + P0[c + 1] * wc, P0[a + 2] * wa + P0[b + 2] * wb + P0[c + 2] * wc);
          fp[binK(d[0], d[1])] = 1;
        }
      }
      const cellOf = (th, y) => { const p = basePt(th, ringAt(y)), d = dirOf(p[0], p[1], p[2]); return binK(d[0], d[1]); };
      const NT = 256, hl0 = new Float32Array(NT), hl1 = new Float32Array(NT), hl2 = new Float32Array(NT);
      for (let i = 0; i < NT; i++) {
        const th = -PI + (i + 0.5) / NT * 2 * PI;
        let run = 0, top = -9;
        for (let y = 1.80; y >= 1.36; y -= 0.0025) {
          if (fp[cellOf(th, y)]) { run += 0.0025; if (run >= 0.01) { top = y + run; break; } } else run = 0;
        }
        // спереди — по верху кожи, к бокам — к линии у шеи, сзади — по ней (рваный верх кожи под затылком — под шапочкой);
        // зазор над кожей: спереди 3 мм (край лица как у автора), к щекам и ушам — шапочка на 6 мм заходит на рваный край маски
        const ft = top > 0 ? top + lerp(CAP.gap, -0.006, sst(0.75, 0.95, Math.abs(th))) : napeLine(th);
        hl0[i] = lerp(ft, napeLine(th), sst(1.1, 1.35, Math.abs(th)));
        // справа (у автора там прядь до щеки и закрытое ухо) — гладкие волосы закрывают и верх уха: спереди за прядью у щеки
        // не просвечивает фон
        if (th < 0) hl0[i] = Math.min(hl0[i], lerp(9, 1.478, sst(0.85, 1.0, -th) * sst(1.5, 1.35, -th)));
      }
      for (let i = 0; i < NT; i++) { let m = 9; for (let k = -1; k <= 1; k++) m = Math.min(m, hl0[(i + k + NT) % NT]); hl1[i] = m; }
      for (let i = 0; i < NT; i++) { let a = 0; for (let k = -2; k <= 2; k++) a += hl1[(i + k + NT) % NT]; hl2[i] = Math.abs(-PI + (i + 0.5) / NT * 2 * PI) > 1.2 ? a / 5 : Math.min(a / 5, hl0[i]); }
      st.creamLine = th => { const f = ((th + PI) / (2 * PI) * NT - 0.5 + NT) % NT, i = Math.floor(f), k = f - i; return lerp(hl2[i % NT], hl2[(i + 1) % NT], k); };
      return st.creamLine;
    }
    // кайма: грани волос автора в BAND_K шагах (по сварке точек) от вершин лица, выше 1.40
    const BAND_K = 3;
    function faceBand(st) {
      if (st.creamBand) return st.creamBand;
      const I0 = st.I0, zn = st.zn, wid = st.wid, P0 = st.P0;
      let hop = new Uint8Array(st.ng).fill(255);
      for (let i = 0; i < st.n; i++) if (zn[i] === Z.face) hop[wid[i]] = 0;
      for (let r = 0; r < BAND_K; r++) {
        const nx = hop.slice();
        for (let t = 0; t < st.nt; t++) {
          const a = wid[I0[t * 3]], b = wid[I0[t * 3 + 1]], c = wid[I0[t * 3 + 2]];
          if (Math.min(hop[a], hop[b], hop[c]) !== r) continue;
          if (nx[a] > r + 1) nx[a] = r + 1;
          if (nx[b] > r + 1) nx[b] = r + 1;
          if (nx[c] > r + 1) nx[c] = r + 1;
        }
        hop = nx;
      }
      const f = new Uint8Array(st.nt), FV = [];
      for (let i = 0; i < st.n; i++) if (zn[i] === Z.face) FV.push(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]);
      // центр грани не дальше 2.5 см от точки лица (длинные пряди сзади и у шеи — не кайма)
      const near = (x, y, z) => { for (let q = 0; q < FV.length; q += 3) { const dx = FV[q] - x, dy = FV[q + 1] - y, dz = FV[q + 2] - z; if (dx * dx + dy * dy + dz * dz < 0.025 * 0.025) return true; } return false; };
      for (let t = 0; t < st.nt; t++) {
        const z = st.tz[t];
        if (z !== Z.hair_skull && z !== Z.hair_back) continue;
        const a = I0[t * 3], b = I0[t * 3 + 1], c = I0[t * 3 + 2];
        const cx = (P0[a * 3] + P0[b * 3] + P0[c * 3]) / 3, cy = (P0[a * 3 + 1] + P0[b * 3 + 1] + P0[c * 3 + 1]) / 3, cz = (P0[a * 3 + 2] + P0[b * 3 + 2] + P0[c * 3 + 2]) / 3;
        if (Math.max(hop[wid[a]], hop[wid[b]], hop[wid[c]]) > BAND_K || cy < 1.4 || !near(cx, cy, cz)) continue;
        // ниже низа шапочки: спереди — не больше 1.2 см (по центру грани), с боков и сзади — ни одной вершиной ниже 6 мм
        // (у челюсти, за ухом и у затылка кайма свисала бы «бахромой»)
        const cl = capLine(st), thc = Math.atan2(cx - CH[0], cz - CH[2]);
        if (Math.abs(thc) < 0.8 ? cy < cl(thc) - 0.005 : [a, b, c].some(v => P0[v * 3 + 1] < cl(Math.atan2(P0[v * 3] - CH[0], P0[v * 3 + 2] - CH[2])) - 0.002)) { f[t] = 2; continue; }
        f[t] = 1;
      }
      // пряди, которые у автора закрывают край лица спереди (луч от центра грани назад упирается в лицо не дальше 3 см), —
      // тоже кайма: лоскуты края маски у щеки под ними не видны, как у автора
      const FT = [];
      for (let t = 0; t < st.nt; t++) if (st.tz[t] === Z.face) FT.push(t);
      const DIRS = [[0, 0, -1]];
      const hits = (ox, oy, oz, d) => {
        for (let q = 0; q < FT.length; q++) {
          const t = FT[q], A = I0[t * 3] * 3, B2 = I0[t * 3 + 1] * 3, C2 = I0[t * 3 + 2] * 3;
          const e1x = P0[B2] - P0[A], e1y = P0[B2 + 1] - P0[A + 1], e1z = P0[B2 + 2] - P0[A + 2], e2x = P0[C2] - P0[A], e2y = P0[C2 + 1] - P0[A + 1], e2z = P0[C2 + 2] - P0[A + 2];
          const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det, tx = ox - P0[A], ty = oy - P0[A + 1], tzz = oz - P0[A + 2], u = (tx * px + ty * py + tzz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tzz * e1y, qy = tzz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (tt > 0 && tt < 0.03) return true;
        }
        return false;
      };
      for (let t = 0; t < st.nt; t++) {
        if (f[t] !== 2) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3, ox = (P0[a] + P0[b] + P0[c]) / 3, oy = (P0[a + 1] + P0[b + 1] + P0[c + 1]) / 3, oz = (P0[a + 2] + P0[b + 2] + P0[c + 2]) / 3;
        f[t] = ox < 0.02 && oy < 1.62 && DIRS.some(d => hits(ox, oy, oz, d)) ? 1 : 0;
      }
      st.creamBand = f;
      return f;
    }
    // растр головы по направлениям из CH: лицо есть (любой тексель), наибольший радиус лица/верха уха (he),
    // каймы (bR); у самого уха (ниже 1.515) шапочка без подъёма — ухо снаружи
    const NAZ = 288, NEL = 144;
    const dirOf = (x, y, z) => { const dx = x - CH[0], dy = y - CH[1], dz = z - CH[2], r = Math.hypot(dx, dy, dz) || 1e-6; return [Math.atan2(dx, dz), Math.asin(clamp(dy / r, -1, 1)), r]; };
    const binK = (az, el) => clamp(Math.floor((el + PI / 2) / PI * NEL), 0, NEL - 1) * NAZ + ((Math.floor((az + PI) / (2 * PI) * NAZ) % NAZ) + NAZ) % NAZ;
    const NYH = 100, YH0 = 1.3, DYH = 0.0025;
    const binH = (az, y) => { const j = Math.floor((y - YH0) / DYH); return j < 0 || j >= NYH ? -1 : j * NAZ + ((Math.floor((az + PI) / (2 * PI) * NAZ) % NAZ) + NAZ) % NAZ; };
    let HR = null;
    function headRaster(st) {
      if (HR && HR.st === st) return HR;
      const fp = new Uint8Array(NAZ * NEL), he = new Float32Array(NAZ * NEL), bR = new Float32Array(NAZ * NEL), ear = new Uint8Array(NAZ * NEL);
      // ниже центра головы — ещё и горизонтальный растр (азимут × высота): наибольший радиус от оси кольца профиля на
      // этой высоте (центр кольца сдвинут вперёд к шее; лицо, шея, верх уха, кайма)
      const rh = new Float32Array(NAZ * NYH), earH = new Uint8Array(NAZ * NYH);
      const P0 = st.P0, I0 = st.I0, band = faceBand(st);
      for (let t = 0; t < st.nt; t++) {
        const zt = st.tz[t], isB = band[t];
        if (zt !== Z.face && zt !== Z.ears && zt !== Z.neck && !isB) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        const e = Math.max(Math.hypot(P0[a] - P0[b], P0[a + 1] - P0[b + 1], P0[a + 2] - P0[b + 2]), Math.hypot(P0[c] - P0[b], P0[c + 1] - P0[b + 1], P0[c + 2] - P0[b + 2]), Math.hypot(P0[a] - P0[c], P0[a + 1] - P0[c + 1], P0[a + 2] - P0[c + 2]));
        const nS = clamp(Math.ceil(e / 0.0025), 1, 20);
        for (let i = 0; i <= nS; i++) for (let j = 0; j <= nS - i; j++) {
          const wa = i / nS, wb = j / nS, wc = 1 - wa - wb, y = P0[a + 1] * wa + P0[b + 1] * wb + P0[c + 1] * wc;
          const d = dirOf(P0[a] * wa + P0[b] * wb + P0[c] * wc, y, P0[a + 2] * wa + P0[b + 2] * wb + P0[c + 2] * wc), k = binK(d[0], d[1]);
          if (y < CH[1] + 0.01 && (zt !== Z.ears || y > 1.535)) {
            const hx = P0[a] * wa + P0[b] * wb + P0[c] * wc, hz = P0[a + 2] * wa + P0[b + 2] * wb + P0[c + 2] * wc - ringAt(y)[2], kh = binH(Math.atan2(hx, hz), y), rr = Math.hypot(hx, hz);
            if (kh >= 0 && rr > rh[kh]) rh[kh] = rr;
          }
          if (isB) { if (d[2] > bR[k]) bR[k] = d[2]; continue; }
          if (zt === Z.neck) continue;
          if (zt === Z.face) fp[k] = 1;
          if ((zt !== Z.ears || y > 1.535) && d[2] > he[k]) he[k] = d[2];
        }
      }
      for (let i = 0; i < st.n; i++) {
        if (st.zn[i] !== Z.ears || P0[i * 3 + 1] > 1.515) continue;
        const d = dirOf(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]), el0 = clamp(Math.floor((d[1] + PI / 2) / PI * NEL), 0, NEL - 1), az0 = ((Math.floor((d[0] + PI) / (2 * PI) * NAZ) % NAZ) + NAZ) % NAZ;
        for (let de = -2; de <= 2; de++) for (let da = -2; da <= 2; da++) { const e2 = el0 + de; if (e2 >= 0 && e2 < NEL) ear[e2 * NAZ + ((az0 + da + NAZ) % NAZ)] = 1; }
        const kh = binH(Math.atan2(P0[i * 3], P0[i * 3 + 2] - ringAt(P0[i * 3 + 1])[2]), P0[i * 3 + 1]);
        if (kh >= 0) { const y0 = Math.floor(kh / NAZ), a0 = kh % NAZ; for (let dy = -3; dy <= 3; dy++) for (let da = -2; da <= 2; da++) { const y2 = y0 + dy; if (y2 >= 0 && y2 < NYH) earH[y2 * NAZ + ((a0 + da + NAZ) % NAZ)] = 1; } }
      }
      for (let k = 0; k < NAZ * NEL; k++) if (ear[k]) { he[k] = 0; bR[k] = 0; }
      for (let k = 0; k < NAZ * NYH; k++) if (earH[k]) rh[k] = 0;
      HR = { st, fp, he, bR, ear, rh };
      return HR;
    }
    // текстура шапочки (атлас одежды: u — угол столбца от −π до π, v 0.5..0.97), рисуется после поправки света: пряди
    // сходятся к пучку, пробор посередине, мягкий блик
    const UV0 = 0.97, UVH = 0.47;
    const capV = y => UV0 - UVH * (Y0 - y) / (Y0 - Y1);
    const HAIRC = mix3(HD, HB, 0.8), SCALP = mix3(HAIRC, tc('#E8B89A'), 0.5);
    const texPost = (c, S) => {
      const y0p = Math.floor((1 - UV0) * S), y1p = Math.ceil((1 - (UV0 - UVH)) * S), im = c.getImageData(0, y0p, S, y1p - y0p), d = im.data;
      const F = [0, 1.75, 0.1], Bn = [0, 1.43, -0.25], ax = [Bn[0] - F[0], Bn[1] - F[1], Bn[2] - F[2]], al = Math.hypot(ax[0], ax[1], ax[2]);
      ax[0] /= al; ax[1] /= al; ax[2] /= al;
      const up = [-ax[0] * ax[1], 1 - ax[1] * ax[1], -ax[2] * ax[1]], ul = Math.hypot(up[0], up[1], up[2]);
      up[0] /= ul; up[1] /= ul; up[2] /= ul;
      for (let py = y0p; py < y1p; py++) for (let px = 0; px < S; px++) {
        const v = 1 - (py + 0.5) / S, u = (px + 0.5) / S, th = u * 2 * PI - PI, y = Y0 - (UV0 - v) / UVH * (Y0 - Y1);
        const q = basePt(th, ringAt(clamp(y, Y1, Y0))), w = [q[0] - F[0], q[1] - F[1], q[2] - F[2]], along = w[0] * ax[0] + w[1] * ax[1] + w[2] * ax[2];
        const wx = w[0] - ax[0] * along, wy = w[1] - ax[1] * along, wz = w[2] - ax[2] * along;
        const phi = Math.atan2(wx, wy * up[1] + wz * up[2]);
        const s2 = 0.55 * Math.sin(phi * 46 + Math.sin(phi * 7) * 0.8) + 0.45 * Math.sin(phi * 19 + 1.3);
        let k = 0.9 + 0.075 * s2;
        k += 0.16 * Math.exp(-Math.pow((Math.abs(phi) - 0.75) / 0.18, 2)) * sst(0.32, 0.12, along);
        // гладко от пробора: вдоль пробора — блик (пряди расходятся в стороны), сам пробор — светлая линия кожи
        k += 0.1 * Math.exp(-Math.pow((Math.abs(phi) - 0.11) / 0.05, 2)) * sst(0.22, 0.08, along);
        // пробор — по середине (|x| до 3.5 мм) от линии лба через макушку и чуть за неё
        const j = ((py - y0p) * S + px) * 4, pk = clamp(1.4 - Math.abs(q[0]) / 0.0035, 0, 1) * (Math.cos(th) > 0 ? 1 : sst(1.775, 1.8, y));
        for (let ch = 0; ch < 3; ch++) d[j + ch] = clamp(lerp(HAIRC[ch] * k, SCALP[ch], pk * 0.8), 0, 255);
        d[j + 3] = 255;
      }
      c.putImageData(im, 0, y0p);
    };
    // кайма волос у лица — ровным цветом шапочки (её средний тон)
    const bandPaint = (x, y, z, o) => { o.f = 1; return [HAIRC[0] * 0.9, HAIRC[1] * 0.9, HAIRC[2] * 0.9]; };
    // шапочка: столбцы по кругу (SEG), ряды от макушки до низа столбца (гуще к низу); низ столбца — верх лица + 3 мм
    // (сплошной кусок лица не меньше 1 см по высоте), за ухом и сзади — линия у шеи; подъём над черепом — по растру
    // (лицо, верх уха и кайма + 2 мм, огибающая с запасом и сглаживание: грани каймы и «плавники» маски под шапочкой)
    function capGeo(B) {
      const st = LASTST;
      if (!st) return;
      const hr = headRaster(st), SEG = CAP.seg, NR = CAP.rows, w = W1('head'), base = B.p.length / 3;
      const cellOf = (th, y) => { const p = basePt(th, ringAt(y)), d = dirOf(p[0], p[1], p[2]); return [binK(d[0], d[1]), d[2]]; };
      const hlAt = capLine(st);
      // 2) подъём над черепом на сетке (th × y): насколько лицо/кайма выше профиля (+2 мм), огибающая ±8/±5 и сглаживание ±6/±3
      const LA = 256, LY0 = 1.36, LDY = 0.0025, LNY = Math.ceil((Y0 - LY0) / LDY) + 1, L0 = new Float32Array(LA * LNY);
      for (let j = 0; j < LNY; j++) for (let i = 0; i < LA; i++) {
        const th = -PI + (i + 0.5) / LA * 2 * PI, y = LY0 + j * LDY;
        if (y < CH[1]) {
          const R = ringAt(y), p = basePt(th, R), hx = p[0], hz = p[2] - R[2], kh = binH(Math.atan2(hx, hz), y), h = kh >= 0 ? hr.rh[kh] : 0;
          L0[j * LA + i] = h > 0 ? Math.max(0, h + 0.002 - Math.hypot(hx, hz)) : 0;
          continue;
        }
        const c = cellOf(th, y), h = Math.max(hr.he[c[0]], hr.bR[c[0]]);
        L0[j * LA + i] = h > 0 ? Math.max(0, h + 0.002 - c[1]) : 0;
      }
      const L1 = new Float32Array(LA * LNY), L2 = new Float32Array(LA * LNY);
      for (let j = 0; j < LNY; j++) for (let i = 0; i < LA; i++) { let m = 0; for (let dj = -5; dj <= 5; dj++) { const jj = clamp(j + dj, 0, LNY - 1); for (let di = -8; di <= 8; di++) m = Math.max(m, L0[jj * LA + (i + di + LA) % LA]); } L1[j * LA + i] = m; }
      for (let j = 0; j < LNY; j++) for (let i = 0; i < LA; i++) { let a = 0; for (let dj = -3; dj <= 3; dj++) { const jj = clamp(j + dj, 0, LNY - 1); for (let di = -6; di <= 6; di++) a += L1[jj * LA + (i + di + LA) % LA]; } L2[j * LA + i] = a / 91; }
      const liftAt = (th, y) => { const fi = ((th + PI) / (2 * PI) * LA - 0.5 + LA) % LA, fj = clamp((y - LY0) / LDY, 0, LNY - 1.001), i0 = Math.floor(fi), j0 = Math.floor(fj), ki = fi - i0, kj = fj - j0, g = (i, j) => L2[j * LA + (i % LA)]; return lerp(lerp(g(i0, j0), g(i0 + 1, j0), ki), lerp(g(i0, j0 + 1), g(i0 + 1, j0 + 1), ki), kj); };
      // подъём: выше центра головы — от центра, ниже — по горизонтали (по своему растру; низ шапочки не «стекает» зубцами вниз)
      const capPt = (th, y) => {
        const p = basePt(th, ringAt(y)), dx = p[0] - CH[0], dy = p[1] - CH[1], dz = p[2] - CH[2], L = liftAt(th, y);
        if (dy >= 0) { const r0 = Math.hypot(dx, dy, dz) || 1, f = (r0 + L) / r0; return [CH[0] + dx * f, CH[1] + dy * f, CH[2] + dz * f]; }
        const zc = ringAt(y)[2], hz = p[2] - zc, rh = Math.hypot(p[0], hz) || 1e-6, f = (rh + L) / rh;
        return [p[0] * f, p[1], zc + hz * f];
      };
      // 3) сетка: ряд r — доля 1 − (1 − v)^1.5 от макушки до низа столбца; столбцы гуще спереди (край лица), реже на затылке
      const colTh = u => { const x = 2 * u - 1; return Math.sign(x) * PI * Math.pow(Math.abs(x), 1.6); };
      const P = [], YS = [];
      B.part = 1;
      for (let r = 0; r < NR; r++) for (let s = 0; s <= SEG; s++) {
        const th = colTh(s / SEG), v = r / (NR - 1), y = lerp(Y0, hlAt(th), 1 - Math.pow(1 - v, 1.5));
        P.push(capPt(th, y)); YS.push(y);
      }
      const at = (r, s) => P[clamp(r, 0, NR - 1) * (SEG + 1) + ((s % SEG) + SEG) % SEG];
      for (let r = 0; r < NR; r++) for (let s = 0; s <= SEG; s++) {
        const p = P[r * (SEG + 1) + s], a1 = at(r, s + 1), a0 = at(r, s - 1), b1 = at(r + 1, s), b0 = at(r - 1, s);
        const tx = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], ty = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
        let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
        const o = [p[0] - CH[0], p[1] - CH[1] + 0.05, p[2] - CH[2]];
        if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) n = n.map(q => -q);
        const nl = Math.hypot(n[0], n[1], n[2]);
        const nv = r === 0 ? [0, 1, 0] : nl > 1e-7 ? [n[0] / nl, n[1] / nl, n[2] / nl] : (() => { const l = Math.hypot(o[0], o[1], o[2]) || 1; return o.map(q => q / l); })();
        B.v(p, nv, [255, 255, 255], w, [(colTh(s / SEG) + PI) / (2 * PI), capV(YS[r * (SEG + 1) + s])], 0);
      }
      // спереди над висками (не по середине лба и не сбоку — там силуэт) шапочка без контура: оболочка контура вылезала
      // из складок над каймой тёмными косыми «прядями» — читалась косая чёлка
      for (let r = 0; r < NR - 1; r++) for (let s = 0; s < SEG; s++) {
        const i00 = r * (SEG + 1) + s, i01 = i00 + 1, i10 = i00 + SEG + 1, i11 = i10 + 1, ath = Math.abs(colTh((s + 0.5) / SEG));
        const ol = !(r >= 3 && ath > 0.2 && ath < 1.3);
        B.tri(base + i00, base + i10, base + i01, ol); B.tri(base + i01, base + i10, base + i11, ol);
      }
      B.part = 0;
    }
    const wool = (x, y, z, o) => { o.k = 0; o.lo = 0.8; o.hi = 1.12; return y < 0.665 ? mix3(IV, IVD, 0.25, out) : IV; };
    const IVL = tc('#FBF8F0');
    // пиджак новым кроем: открыт, длинный излом лацкана к пуговице на талии, подплечники, клапаны карманов, листочка
    const jcol = (p, a, y, part) => {
      if (part === 'lapel') return mix3(IV, IVL, 0.5);
      if (part === 'shadow') return mix3(IV, IVD, 0.85);
      if (part === 'edge') return mix3(IV, IVD, 0.35);
      if (part === 'button') return mix3(IVD, IV, 0.3);
      if (part === 'collar') return mix3(IV, IVL, 0.2);
      return y < 0.665 ? mix3(IV, IVD, 0.2) : IV;
    };
    const sleeve = (x, y, z, o) => {
      // ровный цвет (свет даёт объём): без строчек и хлястика тренча
      o.f = 1; return y < 0.83 ? mix3(IV, IVD, 0.12, out) : IV;
    };
    // рукава пиджака (рукав тренча): верх у плеча — на 10 % к оси (под подплечник, без «пилы» на стыке с плечом), манжета
    // тренча и низ рукава — в одну трубу (радиус 5 см, как рукав): длинный ровный рукав до запястья, без отворота с хлястиком
    const creamArms = sleeveShape((t, r) => {
      if (t < 0) return 1 - 0.1 * sst(-0.6, -0.92, t);
      const R = 0.05, w = sst(0.55, 0.72, t);
      return r > R ? lerp(1, R / r, w) : 1;
    }, ['sleeve', 'cuff']);
    // лодочки с острым носом (у автора — круглые носы кед): носок на 6 см вытянут вперёд на 3 см, сужен и прижат к подошве
    const pointToes = ctx => {
      const { st, p, zn, moved } = ctx;
      [1, -1].forEach(s => {
        let zMax = -9, yMin = 9, cx = 0, cn = 0;
        for (let i = 0; i < st.n; i++) if (zn[i] === Z.shoes && p[i * 3] * s > 0) { zMax = Math.max(zMax, p[i * 3 + 2]); yMin = Math.min(yMin, p[i * 3 + 1]); }
        if (zMax < -1) return;
        for (let i = 0; i < st.n; i++) if (zn[i] === Z.shoes && p[i * 3] * s > 0 && p[i * 3 + 2] > zMax - 0.03) { cx += p[i * 3]; cn++; }
        cx /= cn || 1;
        const z0 = zMax - 0.06;
        for (let i = 0; i < st.n; i++) {
          if (zn[i] !== Z.shoes || p[i * 3] * s <= 0 || p[i * 3 + 2] <= z0) continue;
          const z = p[i * 3 + 2], k = (z - z0) / (zMax - z0), k2 = k * k;
          p[i * 3] = cx + (p[i * 3] - cx) * (1 - 0.72 * k2);
          p[i * 3 + 1] = yMin + (p[i * 3 + 1] - yMin) * (1 - 0.5 * k2);
          p[i * 3 + 2] = z + 0.035 * k2;
          moved[i] = 1;
        }
      });
    };
    // вырез топа: спереди 1.19, сзади 1.24
    const topNeck = a => { const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); return lerp(1.19, 1.245, sst(0.5, 1.6, aa)); };
    // веса вершины одежды — как у ближайших вершин модели (cand — индексы вершин): k ближайших, обратно расстоянию
    function nearW(st, cand, p, k) {
      const SIa = st.geo.attributes.skinIndex.array, SWb = st.geo.attributes.skinWeight, SWa = SWb.array, P0 = st.P0;
      const swk = SWb.normalized ? (SWa instanceof Uint8Array ? 1 / 255 : SWa instanceof Uint16Array ? 1 / 65535 : 1) : 1;
      const best = [];
      for (let q = 0; q < cand.length; q++) {
        const i = cand[q], d = Math.hypot(P0[i * 3] - p[0], P0[i * 3 + 1] - p[1], P0[i * 3 + 2] - p[2]);
        if (best.length < k || d < best[best.length - 1][0]) { best.push([d, i]); best.sort((x, y) => x[0] - y[0]); if (best.length > k) best.pop(); }
      }
      const acc = new Map();
      best.forEach(([d, i]) => { const f = 1 / (d + 0.003); for (let j = 0; j < 4; j++) { const bi = SIa[i * 4 + j], w = SWa[i * 4 + j] * swk * f; if (w > 0) acc.set(bi, (acc.get(bi) || 0) + w); } });
      const top = Array.from(acc.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((s, q) => s + q[1], 0) || 1;
      const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
      top.forEach((q, j) => { si[j] = q[0]; sw[j] = q[1] / sum; });
      if (!top.length) { si[0] = Math.max(0, boneIdx('neck')); sw[0] = 1; }
      return { si, sw };
    }
    // Шея целиком — «рукавом» кожи на 1.5 мм поверх шеи автора: от ворота (1.296) до низа челюсти спереди и с боков (где
    // лицо выходит из шеи больше чем на 1 см) и до кожи под шапочкой сзади. У автора низ лица на шее — тень под
    // подбородком и рыжий тон сзади (под тренчем и распущенными волосами её не видно); при пучке и открытом вороте она
    // читалась рыжим пятном. Цвет — кожа шеи автора (как в вырезе топа), под челюстью чуть темнее; веса — ближайших
    // вершин шеи и лица автора (рукав гнётся вместе с шеей и головой); без контура — край шеи рисует контур героини
    const NK = { cz: -0.012, y0: 1.296, y1: 1.47, dy: 0.0025, na: 48, cols: 28, rows: 5 };
    function neckSleeve(B, st) {
      if (!st || !st.tex) return;
      const P0 = st.P0, I0 = st.I0, NA = NK.na, NY = Math.round((NK.y1 - NK.y0) / NK.dy) + 1, R = new Float32Array(NA * NY);
      const kOf = a => ((Math.floor((a + PI) / (2 * PI) * NA) % NA) + NA) % NA;
      // растр: наибольший радиус лица и шеи автора от оси шеи по (азимут, высота)
      for (let t = 0; t < st.nt; t++) {
        const zt = st.tz[t];
        if (zt !== Z.face && zt !== Z.neck) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        if (Math.max(P0[a + 1], P0[b + 1], P0[c + 1]) < NK.y0 - 0.01 || Math.min(P0[a + 1], P0[b + 1], P0[c + 1]) > NK.y1) continue;
        const e = Math.max(Math.hypot(P0[a] - P0[b], P0[a + 1] - P0[b + 1], P0[a + 2] - P0[b + 2]), Math.hypot(P0[c] - P0[b], P0[c + 1] - P0[b + 1], P0[c + 2] - P0[b + 2]), Math.hypot(P0[a] - P0[c], P0[a + 1] - P0[c + 1], P0[a + 2] - P0[c + 2]));
        const nS = clamp(Math.ceil(e / 0.002), 1, 24);
        for (let i = 0; i <= nS; i++) for (let j = 0; j <= nS - i; j++) {
          const wa = i / nS, wb = j / nS, wc = 1 - wa - wb, y = P0[a + 1] * wa + P0[b + 1] * wb + P0[c + 1] * wc;
          if (y < NK.y0 || y > NK.y1) continue;
          const x = P0[a] * wa + P0[b] * wb + P0[c] * wc, z = P0[a + 2] * wa + P0[b + 2] * wb + P0[c + 2] * wc - NK.cz, o = Math.round((y - NK.y0) / NK.dy) * NA + kOf(Math.atan2(x, z)), r = Math.hypot(x, z);
          if (r > R[o]) R[o] = r;
        }
      }
      // нижняя ячейка с кожей по столбцу (сзади низ шеи у автора — дыра под воротником тренча: кожа начинается выше);
      // пустые ячейки — от соседей по высоте (ниже первой — её радиусом); огибающая ±1 ячейка (рукав не входит в шею
      // между точками растра)
      const jF = new Int32Array(NA);
      for (let k = 0; k < NA; k++) {
        let j = 0; while (j < NY - 1 && !R[j * NA + k]) j++;
        jF[k] = j;
        let v = R[j * NA + k];
        for (let q = 0; q < NY; q++) { if (R[q * NA + k]) v = R[q * NA + k]; else R[q * NA + k] = v; }
      }
      const RE = new Float32Array(NA * NY);
      for (let j = 0; j < NY; j++) for (let k = 0; k < NA; k++) { let m = 0; for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) { const jj = clamp(j + dj, 0, NY - 1); m = Math.max(m, R[jj * NA + (k + dk + NA) % NA]); } RE[j * NA + k] = m; }
      // верх столбца: спереди и с боков — где лицо выходит из шеи (радиус больше шеи на 1 см: низ челюсти), сзади — край
      // кожи под шапочкой (линия у шеи + 1 см: рукав уходит под шапочку)
      const top = new Float32Array(NA), j0 = Math.round((1.31 - NK.y0) / NK.dy);
      for (let k = 0; k < NA; k++) {
        const a = -PI + (k + 0.5) * 2 * PI / NA, js = Math.max(j0, jF[k]), r0 = R[Math.min(NY - 1, js + 2) * NA + k];
        let j = js;
        while (j < NY - 1 && R[(j + 1) * NA + k] < r0 + 0.01) j++;
        const yJaw = NK.y0 + j * NK.dy, yNape = Math.min(napeLine(a) + 0.01, NK.y1);
        top[k] = lerp(yJaw, yNape, sst(1.9, 2.4, Math.abs(a)));
      }
      const t1 = new Float32Array(NA), t2 = new Float32Array(NA);
      for (let k = 0; k < NA; k++) t1[k] = Math.min(top[(k + NA - 1) % NA], top[k], top[(k + 1) % NA]);
      for (let k = 0; k < NA; k++) t2[k] = (t1[(k + NA - 1) % NA] + 2 * t1[k] + t1[(k + 1) % NA]) / 4;
      const fa = a => { const f = (a + PI) / (2 * PI) * NA - 0.5; return [((Math.floor(f) % NA) + NA) % NA, f - Math.floor(f)]; };
      const topAt = a => { const [k, q] = fa(a); return lerp(t2[k], t2[(k + 1) % NA], q); };
      const rAt = (a, y) => { const [k, q] = fa(a), fj = clamp((y - NK.y0) / NK.dy, 0, NY - 1.001), j = Math.floor(fj), kj = fj - j, g = (kk, jj) => RE[jj * NA + kk]; return lerp(lerp(g(k, j), g((k + 1) % NA, j), q), lerp(g(k, j + 1), g((k + 1) % NA, j + 1), q), kj); };
      // кандидаты для весов: вершины шеи и лица у шеи
      const cand = [];
      for (let i = 0; i < st.n; i++) if ((st.zn[i] === Z.neck || st.zn[i] === Z.face) && P0[i * 3 + 1] > 1.26 && P0[i * 3 + 1] < 1.5) cand.push(i);
      const NSK = neckSkin(st), NSD = [NSK[0] * 0.9, NSK[1] * 0.87, NSK[2] * 0.86], NC = NK.cols, NRw = NK.rows, G = [];
      for (let r = 0; r <= NRw; r++) for (let c = 0; c < NC; c++) {
        const a = -PI + (c + 0.5) * 2 * PI / NC, v = r / NRw, yt = topAt(a), y = lerp(NK.y0, yt, Math.pow(v, 0.8));
        // у верха радиус — с отметки на 4 мм ниже (без раструба к челюсти), верхний ряд — на 1 мм под кожу
        const rr = rAt(a, Math.min(y, yt - 0.004)) + (r === NRw ? -0.001 : 0.0015);
        G.push({ p: [Math.sin(a) * rr, y, NK.cz + Math.cos(a) * rr], a, y, yt });
      }
      const base = B.p.length / 3, at = (r, c) => G[clamp(r, 0, NRw) * NC + ((c % NC) + NC) % NC];
      for (let r = 0; r <= NRw; r++) for (let c = 0; c < NC; c++) {
        const g = at(r, c), a1 = at(r, c + 1).p, a0 = at(r, c - 1).p, b1 = at(r + 1, c).p, b0 = at(r - 1, c).p;
        const tx = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], ty = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
        let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
        if (n[0] * Math.sin(g.a) + n[2] * Math.cos(g.a) < 0) n = n.map(q => -q);
        const nl = Math.hypot(n[0], n[1], n[2]) || 1;
        // под челюстью (спереди и с боков) — тень чуть темнее, сзади ровно
        const sh = sst(g.yt - 0.014, g.yt, g.y) * (1 - sst(1.6, 2.3, Math.abs(g.a))) * 0.7;
        B.v(g.p, [n[0] / nl, n[1] / nl, n[2] / nl], mix3(NSK, NSD, sh, [0, 0, 0]), nearW(st, cand, g.p, 4));
      }
      for (let r = 0; r < NRw; r++) for (let c = 0; c < NC; c++) {
        const i00 = base + r * NC + c, i01 = base + r * NC + (c + 1) % NC, i10 = i00 + NC, i11 = i01 + NC;
        B.tri(i00, i01, i10, false); B.tri(i01, i11, i10, false);
      }
    }
    // Сумка-трапеция в левой руке (как в ролике): корпус слоновой кости висит под кистью, широкой стороной вперёд и наружу
    // (поворот beta вокруг вертикали: спереди, вполоборота и сбоку — трапеция), скруглённые рёбра с тонким тёмным кантом
    // (вертикальные рёбра, верх и низ), две короткие ручки-дуги из верхней грани в ладонь. Жёстко на кости кисти, часть 2:
    // прячется в транспорте, спорте, полёте и сидя
    const TOTE = { w0: 0.185, w1: 0.148, d0: 0.064, d1: 0.054, h: 0.135, rc: 0.007, beta: 0.95, drop: 0.085, dx: 0.03, grip: 0.048, hw: 0.036, hr: 0.005 };
    function tote(B) {
      const a = J('forearm_L'), b = J('hand_L'), al = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
      const G = [b[0] + (b[0] - a[0]) / al * TOTE.grip, b[1] + (b[1] - a[1]) / al * TOTE.grip, b[2] + (b[2] - a[2]) / al * TOTE.grip];
      const w = W1('hand_L'), cb = Math.cos(TOTE.beta), sb = Math.sin(TOTE.beta), U = [cb, 0, -sb], V = [sb, 0, cb];
      const yTop = G[1] - TOTE.drop, yBot = yTop - TOTE.h, C = [G[0] + TOTE.dx, 0, G[2]];
      const P = (u, y, v) => [C[0] + U[0] * u + V[0] * v, y, C[2] + U[2] * u + V[2] * v];
      const BODY = tc('#EEE6D6'), SIDE = tc('#DDD2BF'), PIPE = tc('#4A372C'), TOPC = tc('#F2ECE0'), HND = tc('#CBBDA3');
      const rc = TOTE.rc, RT = [0, 0.035, 0.5, 0.965, 1], NP = 12, pp = B.part;
      B.part = 2;
      // сечение: скруглённый прямоугольник, на каждое ребро — начало дуги, середина (кант), конец
      const ring = t => {
        const W = lerp(TOTE.w0, TOTE.w1, t), D = lerp(TOTE.d0, TOTE.d1, t), hu = W / 2 - rc, hv = D / 2 - rc, out = [];
        [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([su, sv], q) => {
          for (let m = 0; m < 3; m++) { const th = q * PI / 2 + m * PI / 4, cu = Math.cos(th), cv = Math.sin(th); out.push({ u: su * hu + rc * cu, v: sv * hv + rc * cv, nu: cu, nv: cv, pipe: m === 1 }); }
        });
        return out;
      };
      const base = B.p.length / 3, rings = RT.map(ring);
      rings.forEach((rg, ri) => {
        const t = RT[ri], y = lerp(yBot, yTop, t);
        rg.forEach(q => {
          const n = [U[0] * q.nu + V[0] * q.nv, 0, U[2] * q.nu + V[2] * q.nv];
          // гусеты темнее, низ чуть темнее, рёбра, верх и низ — кант
          const col = q.pipe || ri === 0 || ri === RT.length - 1 ? PIPE : mix3(mix3(BODY, SIDE, Math.abs(q.nu)), SIDE, (1 - t) * 0.25, [0, 0, 0]);
          B.v(P(q.u, y, q.v), n, col, w);
        });
      });
      for (let r = 0; r < RT.length - 1; r++) for (let s = 0; s < NP; s++) {
        const i00 = base + r * NP + s, i01 = base + r * NP + (s + 1) % NP, i10 = i00 + NP, i11 = i01 + NP;
        B.tri(i00, i10, i01); B.tri(i01, i10, i11);
      }
      // донышко и верх: свои вершины по краю (цвет ткани — кант только на боках), веер к середине
      [[0, -1], [RT.length - 1, 1]].forEach(([ri, sg]) => {
        const y = lerp(yBot, yTop, RT[ri]), c0 = B.v(P(0, y, 0), [0, sg, 0], sg > 0 ? TOPC : SIDE, w), cb0 = B.p.length / 3;
        rings[ri].forEach(q => B.v(P(q.u, y, q.v), [0, sg, 0], sg > 0 ? TOPC : SIDE, w));
        for (let s = 0; s < NP; s++) { const p0 = cb0 + s, p1 = cb0 + (s + 1) % NP; if (sg > 0) B.tri(c0, p1, p0); else B.tri(c0, p0, p1); }
      });
      // ручки: дуги из верхней грани (у передней и задней стенки) в ладонь, рядом друг с другом; без контура (тоньше его)
      [1, -1].forEach(sv => {
        const dv = TOTE.d1 * 0.22 * sv, A1 = P(-TOTE.hw, yTop, dv), A2 = P(TOTE.hw, yTop, dv), Gp = [G[0] + V[0] * 0.004 * sv, G[1], G[2] + V[2] * 0.004 * sv];
        const K = [2 * Gp[0] - (A1[0] + A2[0]) / 2, 2 * Gp[1] - (A1[1] + A2[1]) / 2, 2 * Gp[2] - (A1[2] + A2[2]) / 2];
        const bz = t => [0, 1, 2].map(i => (1 - t) * (1 - t) * A1[i] + 2 * (1 - t) * t * K[i] + t * t * A2[i]);
        const NR = 10, NS = 6, hb = B.p.length / 3;
        for (let r = 0; r <= NR; r++) {
          const t = r / NR, c = bz(t), c1 = bz(Math.min(1, t + 0.01)), c0 = bz(Math.max(0, t - 0.01)), T3 = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]], tl = Math.hypot(T3[0], T3[1], T3[2]) || 1;
          const Tn = T3.map(q => q / tl), N3 = [Tn[1] * V[2] - Tn[2] * V[1], Tn[2] * V[0] - Tn[0] * V[2], Tn[0] * V[1] - Tn[1] * V[0]], nl = Math.hypot(N3[0], N3[1], N3[2]) || 1;
          for (let s = 0; s < NS; s++) {
            const ph = s / NS * 2 * PI, ca = Math.cos(ph), sa = Math.sin(ph), nn = [0, 1, 2].map(i => N3[i] / nl * ca + V[i] * sa);
            B.v([c[0] + nn[0] * TOTE.hr, c[1] + nn[1] * TOTE.hr, c[2] + nn[2] * TOTE.hr], nn, HND, w);
          }
        }
        for (let r = 0; r < NR; r++) for (let s = 0; s < NS; s++) {
          const i00 = hb + r * NS + s, i01 = hb + r * NS + (s + 1) % NS, i10 = i00 + NS, i11 = i01 + NS;
          B.tri(i00, i10, i01, false); B.tri(i01, i10, i11, false);
        }
      });
      B.part = pp;
    }
    LOOKS.cream = {
      hem: 0.65, hair: H, top: 1.808, keep: 0.3, hatW: -0.03, texPost,
      morph: [flatten(['cuff']), creamArms, neckIn, pointToes],
      // волосы модели — прочь, кроме каймы у лица (причёска — шапочка и пучок в одежде); верх и полы тренча — прочь
      // (пиджак, топ, кожа и цепочки — новым кроем)
      hide: st => {
        const f = hideTorso({ skirt: true }, (i, z) => z === Z.hair_skull || z === Z.hair_back || z === Z.beret || z === Z.bow || z === Z.legs)(st), band = faceBand(st);
        for (let t = 0; t < st.nt; t++) if (band[t]) f[t] = 0;
        return f;
      },
      paint: {
        hair_skull: bandPaint, hair_back: bandPaint,
        // низ шеи — кожей шеи автора ровно (под рукавом кожи; без рыжего тона тени под подбородком)
        neck: (x, y, z, o) => { o.f = 1; return neckSkin(o.st); },
        sleeve, cuff: sleeve,
        // лодочки телесно-бежевые (как в ролике), не белые
        shoes: (x, y, z, o) => { o.k = 0.2; return tc('#D3B597'); },
      },
      garment: B => {
        // кожа шеи кругом — от ворота до челюсти и под шапочку (выемка у основания шеи в профиль, тень автора на шее)
        neckSleeve(B, LASTST);
        capGeo(B);
        const st = LASTST, SS = shellSurf(st);
        trousers(B, { col: '#EDE5D6', light: '#FAF6EE', dark: '#D0C4AE', top: 1.0, wide: 0.118, rings: 8, seg: 9, seat: { y0: 0.82, rx: 0.13, rz: 0.11, cz: -0.012 }, inShell: SS ? { S: SS, m: 0.004, y0: 0.66 } : null });
        if (SS) {
          // топ: кольцо от талии до выреза, выше — кожа шеи (цвет автора), две тонкие золотые цепочки по коже
          shellPiece(B, SS, { rows: 5, closed: true, cols: () => ringAz(20), ol: (u, v) => v > 0.75,
            sv: (a, v) => shellS(SS, a, lerp(0.96, topNeck(a), v)), off: () => 0.003, col: () => TOPW });
          // кожа от выреза до шеи — ровно кожей шеи автора (как рукав кожи на шее над ней)
          const NSK = neckSkin(st);
          shellPiece(B, SS, { rows: 4, closed: true, cols: () => ringAz(20), ol: false,
            sv: (a, v) => lerp(shellS(SS, a, topNeck(a) - 0.008), 1, v), off: (a, s, u, v) => lerp(-0.0006, 0.0005, v),
            col: () => NSK });
          beadsOn(B, SS, a => 1.262 - 0.035 * Math.pow(Math.cos(a), 2), -1.0, 1.0, 3, 0.0012, 0.0012, () => GOLD, 3, true);
          beadsOn(B, SS, a => 1.255 - 0.05 * Math.pow(Math.cos(a), 2), -0.9, 0.9, 3, 0.0012, 0.0012, () => GOLD, 3, true);
          // тень лацкана — до 1.5 см под уступом (выше она торчала «флажком» над лацканом); плечи — с подплечниками
          blazer(B, SS, { hem: 0.65, brk: 0.95, xHem: 0.07, xBrk: 0.05, notch: 1.2, lw: 0.064, lift: 0.005, col: jcol, rows: 11, cols: 24, shTop: 1.185,
            off: (a, y) => 0.01 + 0.008 * sst(0.95, 0.65, y) + 0.025 * sst(1.1, 1.23, y) * Math.pow(Math.sin(a), 4),
            pockets: [[1, 0.815, 0.072], [-1, 0.815, 0.072]], chest: [0.075, 1.115, 0.05], button: [-0.062, 0.95] });
        }
        // низкий гладкий пучок у затылка (наполовину в шапочке), пряди закручены
        const hw = W1('head');
        B.part = 1;
        B.blob([0, 1.428, -0.232], [0.07, 0.058, 0.056], (n, p, u, v) => { const s = 0.86 + 0.07 * Math.sin(u * PI * 2 * 5 + v * 7) + 0.12 * Math.max(0, n[1]); return [HAIRC[0] * s, HAIRC[1] * s, HAIRC[2] * s]; }, hw, 11, 7);
        B.part = 0;
        // тонкий золотой браслет на правом запястье — у края рукава, на кости предплечья
        {
          // край манжеты — t 1.09 по оси предплечья (за суставом кисти), браслет — сразу под ним
          const a = J('forearm_R'), b = J('hand_R'), ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = 1.105;
          const c = [a[0] + ax[0] * t, a[1] + ax[1] * t, a[2] + ax[2] * t], rz = Math.atan2(ax[0], -ax[1]);
          B.torus(c, 0.032, 0.0028, [0, 0, rz], (u, v) => mix3(GOLD, GOLDL, Math.max(0, Math.sin(v * 2 * PI)) * 0.6), W1('forearm_R'), 10, 4, { ol: false });
        }
        // золотые серьги-«купола»
        earrings(B, { y: 1.47, x: 0.198, z: -0.008, make: (B2, c, s, w) => B2.blob(c, [0.017, 0.02, 0.014], (n) => mix3(GOLD, GOLDL, Math.max(0, n[1] * 0.5 + n[2] * 0.6)), w, 7, 4) });
        // сумка-трапеция слоновой кости в левой руке за ручки, тонкий тёмный кант по рёбрам
        tote(B);
      },
    };
  }
  /* ---------- 6. «Звезда вечера»: платье-«русалка» без бретелей с крупными сливовыми цветами, белая накидка до пола, локоны ---------- */
  {
    const H = { base: '#1E140F', dark: '#120B07', light: '#4A362A', part: 0.055, partSkin: 0.25, partLen: 0.06, keep: 0.6, gloss: 0.3 };
    const HP = hairPaint(H);
    const IVO = tc('#EFE7DE'), IVOD = tc('#D2C6B8'), CAPE = tc('#F4EFE8'), CAPED = tc('#D8CCBE');
    const PET = tc('#5E1F45'), PETD = tc('#33102A'), PETL = tc('#8A4672'), RIM = tc('#D9AFCB');
    const CEN = tc('#EEE9DA'), CENG = tc('#C9CFAE'), VEIN = tc('#ABA6AC'), STEM = tc('#8E957A');
    // листья: [основная половина, светлая половина, жилка] — зелёные по юбке, шалфейные у основания цветов
    const LPAL = [[tc('#74844A'), tc('#A0AE74'), tc('#4C6030')], [tc('#A4B088'), tc('#C7CFAF'), tc('#7A8A60')]];
    const t1 = [0, 0, 0];
    // пион «веером» (как в ролике): ярусы округлых лепестков чешуёй от бледной серединки-основания, веер — в сторону dir
    // (рад, от +x к +y) на ±span; внутренний ярус поверх внешнего. Лепесток: тёмное основание (тень яруса выше), к кромке
    // светлее, светлая сиреневая кромка по фестону, тёмная щель между соседями; у серединки — белые штрихи.
    // F = { cx, cy — основание (метры по ткани спереди), R — радиус, dir, span, el — вытянут к ed: R·(1 + el·cos) }
    const PROWS = [[1.0, 7, 0.0], [0.82, 6, 0.43], [0.65, 6, 0.17], [0.49, 5, 0.61], [0.34, 4, 0.29]];
    const peony = (x, y, F) => {
      const dx = x - F.cx, dy = y - F.cy, r = Math.hypot(dx, dy);
      if (r > F.R * (1 + F.el)) return null;
      const an = Math.atan2(dy, dx);
      let a = an - F.dir;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > F.span) return null;
      const ta = (a + F.span) / (2 * F.span), Ra = F.R * (1 + F.el * Math.cos(an - F.ed)) * (0.55 + 0.45 * Math.sqrt(Math.sin(PI * ta)));
      if (r < Ra * 0.17) {
        // серединка: сливочная, к краю зеленоватая, тонкие сливовые лучи
        mix3(CEN, CENG, r / (Ra * 0.17) * 0.6, t1);
        if (r > Ra * 0.06 && (ta * 13) % 1 < 0.22) mix3(t1, PETL, 0.55, t1);
        return t1;
      }
      const NRw = PROWS.length;
      for (let q = NRw - 1; q >= 0; q--) {
        const [kR, nP, ph] = PROWS[q], f = ta * nP + ph, e = 2 * (f - Math.floor(f)) - 1;
        const tip = Ra * kR * (0.8 + 0.2 * Math.sqrt(1 - e * e));
        if (r > tip) continue;
        const r0 = q === NRw - 1 ? Ra * 0.17 : Ra * PROWS[q + 1][0] * 0.8, u = clamp((r - r0) / (tip - r0), 0, 1);
        mix3(PETD, PET, clamp(0.12 + 0.95 * u, 0, 1), t1);
        if (Math.abs(e) < 0.12 && u > 0.2 && u < 0.75) mix3(t1, PETL, 0.3, t1);
        if (Math.abs(e) > 0.88) mix3(t1, PETD, 0.6, t1);
        else if (u > 0.78) mix3(t1, RIM, 0.25 + 0.6 * (u - 0.78) / 0.22, t1);
        if (q === NRw - 1 && u < 0.5 && Math.abs(e) < 0.7 && (f * 3) % 1 < 0.5) mix3(t1, CEN, 0.7 * (1 - u / 0.5), t1);
        return t1;
      }
      return null;
    };
    // цветок 1 — по лифу: основание чуть левее середины над талией, веер вверх и вправо (весь бюст); цветок 2 — крупнее,
    // основание у правого бока героини (слева в кадре) ниже талии, веер вправо, вытянут вниз-вправо — к её левому бедру
    const FL1 = { cx: -0.035, cy: 1.015, R: 0.175, el: 0.15, dir: 1.2, ed: 1.2, span: 1.85 };
    const FL2 = { cx: -0.08, cy: 0.93, R: 0.2, el: 0.45, dir: -0.1, ed: -0.75, span: 1.65 };
    // вышивка по юбке (как в ролике): редкие веточки — тонкий изогнутый стебель и узкие заострённые листья наискось от
    // него (поочерёдно в стороны) плюс лист на конце; спереди и сзади под разными углами. У основания цветов — шалфейные
    // листья, от цветка 2 вниз — веточка. Лист: { k 0, x, y — основание, dx, dy — направление, L, W, bend, pal, back },
    // стебель: { k 1, x, y — x1, y1, w, back }; сетка 4 см по (x, y) — на выборку только примитивы своей ячейки
    const LV = [], ST2 = [];
    {
      const rnd = k => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const leaf = (x, y, ph, L, W, bend, pal, back) => LV.push({ k: 0, x, y, dx: Math.cos(ph), dy: Math.sin(ph), L, W, bend, pal, back: !!back });
      // веточка: начало (x0, y0), направление ph0 (рад от +x к +y), длина, изгиб по длине (рад), сторона, зерно
      const sprig = (x0, y0, ph0, len, curl, back, s) => {
        let x = x0, y = y0, sd = rnd(s) > 0.5 ? 1 : -1;
        for (let i = 1; i <= 5; i++) {
          const ph = ph0 + curl * (i - 0.5) / 5, x1 = x + Math.cos(ph) * len / 5, y1 = y + Math.sin(ph) * len / 5;
          ST2.push({ k: 1, x, y, x1, y1, w: 0.0055, back: !!back });
          if (i >= 2 && i <= 4) { leaf(x1, y1, ph + sd * (0.38 + 0.25 * rnd(s + i)), 0.085 + 0.045 * rnd(s + i + 10), 0.017 + 0.004 * rnd(s + i + 20), -sd * 0.7 * rnd(s + i + 30), 0, back); sd = -sd; }
          x = x1; y = y1;
        }
        leaf(x, y, ph0 + curl + 0.15 * (rnd(s + 40) - 0.5), 0.11 + 0.03 * rnd(s + 41), 0.019, 0.6 * (rnd(s + 42) - 0.5), 0, back);
      };
      // у основания цветов — шалфейные листья (поверх цветка 2)
      leaf(-0.05, 1.005, 3.55, 0.075, 0.03, 0.3, 1); leaf(-0.035, 0.995, 4.35, 0.06, 0.026, -0.3, 1);
      leaf(-0.105, 0.915, 3.75, 0.08, 0.032, 0.4, 1); leaf(-0.1, 0.905, 4.45, 0.07, 0.028, -0.3, 1);
      // спереди: от цветка 2 вниз и россыпь по подолу
      [[-0.115, 0.76, -1.75, 0.2, 0.35], [0.06, 0.5, 1.2, 0.22, 0.35], [-0.07, 0.36, 1.95, 0.22, -0.3], [0.03, 0.18, 1.45, 0.24, 0.3],
        [-0.19, 0.05, 1.15, 0.24, 0.3], [0.16, 0.06, 2.0, 0.24, -0.3], [-0.01, 0.62, 1.8, 0.14, -0.25], [0.07, 0.27, 0.95, 0.16, 0.45]]
        .forEach((q, i) => sprig(q[0], q[1], q[2], q[3], q[4], 0, i * 7 + 3));
      // сзади — реже
      [[0.06, 0.62, 1.3, 0.2, 0.3], [-0.08, 0.45, 1.9, 0.2, -0.3], [0.1, 0.22, 1.1, 0.22, 0.35], [-0.18, 0.08, 1.3, 0.24, 0.25], [0.2, 0.05, 2.1, 0.22, -0.3], [-0.04, 0.84, 1.5, 0.12, 0.3]]
        .forEach((q, i) => sprig(q[0], q[1], q[2], q[3], q[4], 1, i * 11 + 50));
    }
    const GC = 0.04, GX0 = -0.44, GY0 = -0.06, GNX = 22, GNY = 30, GRID = [0, 1].map(() => Array.from({ length: GNX * GNY }, () => []));
    LV.concat(ST2).forEach(p => {
      const ex = p.k ? [p.x, p.x1] : [p.x, p.x + p.dx * p.L], ey = p.k ? [p.y, p.y1] : [p.y, p.y + p.dy * p.L], m = p.k ? p.w : p.W + Math.abs(p.bend) * p.L * 0.35;
      const i0 = Math.max(0, Math.floor((Math.min(ex[0], ex[1]) - m - GX0) / GC)), i1 = Math.min(GNX - 1, Math.floor((Math.max(ex[0], ex[1]) + m - GX0) / GC));
      const j0 = Math.max(0, Math.floor((Math.min(ey[0], ey[1]) - m - GY0) / GC)), j1 = Math.min(GNY - 1, Math.floor((Math.max(ey[0], ey[1]) + m - GY0) / GC));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) GRID[p.back ? 1 : 0][j * GNX + i].push(p);
    });
    // лист: две половины (основная и светлая), тёмная жилка; стебель — тонкая оливково-серая линия
    const primOne = (p, x, y) => {
      const px = x - p.x, py = y - p.y;
      if (p.k) {
        const ex = p.x1 - p.x, ey = p.y1 - p.y, t = clamp((px * ex + py * ey) / (ex * ex + ey * ey), 0, 1), qx = ex * t - px, qy = ey * t - py;
        return qx * qx + qy * qy < p.w * p.w * 0.25 ? STEM : null;
      }
      const al = px * p.dx + py * p.dy;
      if (al < 0 || al > p.L) return null;
      const u = al / p.L, d = -px * p.dy + py * p.dx - p.bend * p.L * u * u * 0.35, hw = p.W * 0.5 * Math.pow(Math.sin(PI * Math.pow(u, 0.8)), 0.85);
      if (Math.abs(d) > hw) return null;
      const P = LPAL[p.pal];
      return Math.abs(d) < hw * 0.16 ? P[2] : d > 0 ? P[1] : P[0];
    };
    const leafAt = (x, y, back) => {
      const i = Math.floor((x - GX0) / GC), j = Math.floor((y - GY0) / GC);
      if (i < 0 || j < 0 || i >= GNX || j >= GNY) return null;
      const L = GRID[back ? 1 : 0][j * GNX + i];
      for (let n = 0; n < L.length; n++) { const c = primOne(L[n], x, y); if (c) return c; }
      return null;
    };
    // серебристые прожилки: тонкие ветвящиеся линии наискось по юбке (ствол и одна ветка), 3.5 мм
    const VN = [];
    {
      const rnd = k => { const v = Math.sin(k * 91.7 + 17.3) * 43758.5453; return v - Math.floor(v); };
      for (let i = 0; i < 8; i++) {
        const t = i / 7, x0 = lerp(-0.2, 0.2, t) + 0.03 * (rnd(i) - 0.5), y0 = lerp(0.12, 0.3, rnd(i + 3)), y1 = lerp(0.55, 0.72, rnd(i + 5)), sl = (t - 0.5) * 0.5 + 0.15 * (rnd(i + 7) - 0.5), ph = rnd(i + 9) * 6;
        VN.push({ x0, y0, y1, sl, ph, back: i % 2 });
        const yb = lerp(y0, y1, 0.45 + 0.2 * rnd(i + 11));
        VN.push({ x0: x0 + sl * (yb - y0) + 0.008 * Math.sin(ph), y0: yb, y1: Math.min(y1, yb + 0.14), sl: sl + (rnd(i + 13) > 0.5 ? 0.5 : -0.5), ph: ph + 1, back: i % 2 });
      }
    }
    const veinAt = (x, y, back) => {
      let m = 0;
      for (let i = 0; i < VN.length; i++) {
        const v = VN[i];
        if (!!v.back !== back && i % 4 > 1) continue;
        if (y < v.y0 || y > v.y1) continue;
        const xv = v.x0 + v.sl * (y - v.y0) + 0.008 * Math.sin((y - v.y0) * 16 + v.ph), dd = Math.abs(x - xv);
        if (dd < 0.0035) m = Math.max(m, 1 - dd / 0.0035);
      }
      return m;
    };
    // рисунок ткани в точке (x, y): одна сливовая масса — цветок 1 по лифу поверх шалфейных листьев и крупного цветка 2
    // (талия и бедро), веточки с листьями, иначе айвори с серебристыми прожилками и блёстками
    const printAt = (x, y, front, o) => {
      const c = front ? peony(x, y, FL1) || leafAt(x, y, false) || peony(x, y, FL2) : leafAt(x, y, true);
      if (c) { o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return o; }
      mix3(IVO, VEIN, veinAt(x, y, !front) * 0.7, o);
      if (Math.sin(x * 1913 + y * 777) > 0.994) mix3(o, [255, 255, 255], 0.6, o);
      return o;
    };
    // 2×2 выборки на тексель (края лепестков и листьев без «лесенки»)
    const SUB = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]], acc = [0, 0, 0], one = [0, 0, 0];
    const printAA = (at, px, py, o) => {
      acc[0] = acc[1] = acc[2] = 0;
      for (let s = 0; s < 4; s++) { const q = at(px + SUB[s][0], py + SUB[s][1]); printAt(q[0], q[1], q[2], one); acc[0] += one[0]; acc[1] += one[1]; acc[2] += one[2]; }
      o[0] = acc[0] / 4; o[1] = acc[1] / 4; o[2] = acc[2] / 4;
      return o;
    };
    // лиф без бретелей: верх спереди 1.205 (лёгкий вырез «сердечком» посередине), под руками 1.15, сзади 1.17
    const bodTop = a => { const w = Math.atan2(Math.sin(a), Math.cos(a)), aa = Math.abs(w); return lerp(1.205 - 0.01 * Math.exp(-Math.pow(w / 0.24, 2)), lerp(1.155, 1.17, sst(1.4, 2.4, aa)), sst(0.6, 1.25, aa)); };
    const BY0 = 0.95, BY1 = 1.21;
    const bodUV = (a, y) => [0.5 + 0.49 * ((((a + PI) % (2 * PI)) + 2 * PI) % (2 * PI)) / (2 * PI), 0.05 + 0.75 * (y - BY0) / (BY1 - BY0)];
    // лиф — узором атласа (правая половина): крупный пион по лифу и второй к правому бедру, листья, блёстки;
    // рисуется после поправки света (цвета tc), по настоящему x поверхности
    // силуэт «русалки» (как в ролике): талия 1.0 → бёдра 0.8 (дугой), по бёдрам к колену уже (0.36, ноги в паре), до 0.3
    // облегает, ниже — раструб в пол: центр уходит назад (шлейф), спереди край чуть дальше носков (стопы под тканью, в
    // ложбинах складок видны кончики сандалий), нижнее кольцо ложится на пол чуть шире (ткань «лужицей»). { cz, rx, rz, fk }
    const MER = y => {
      if (y > 0.8) { const s = Math.sin(clamp((1.0 - y) / 0.2, 0, 1) * PI / 2); return { cz: 0.018, rx: lerp(0.122, 0.176, s), rz: lerp(0.104, 0.138, s), fk: 0 }; }
      if (y > 0.3) { const k = sst(0.8, 0.36, y); return { cz: lerp(0.018, 0.0, k), rx: lerp(0.176, 0.12, k), rz: lerp(0.138, 0.094, k), fk: 0.08 }; }
      const k = clamp((0.3 - y) / 0.294, 0, 1), e = Math.pow(k, 1.7), pool = sst(0.07, 0.006, y);
      return { cz: lerp(0.0, -0.11, e) - 0.01 * pool, rx: lerp(0.12, 0.27, e) + 0.015 * pool, rz: lerp(0.094, 0.265, e) + 0.03 * pool, fk: sst(0, 0.7, k) };
    };
    // дуга эллипса (rx, rz) от середины переда до азимута a (со знаком a): x рисунка на юбке — длина по ткани, а не проекция
    // (у бока цветы и листья не растягиваются и не обрываются ровной линией)
    const arcE = (rx, rz, a) => {
      const h = a / 8;
      let s = 0;
      for (let k = 0; k <= 8; k++) { const t = k * h; s += (k === 0 || k === 8 ? 1 : k % 2 ? 4 : 2) * Math.hypot(rx * Math.cos(t), rz * Math.sin(t)); }
      return s * h / 3;
    };
    // рисунок после поправки света (цвета tc), попиксельно по настоящим точкам ткани: лиф (правая половина атласа) и юбка
    // (левая половина: u — азимут, v — высота); x рисунка — длина дуги по ткани от середины переда (сзади — от середины
    // спинки, знак — сторона); цветок 2 и листья переходят с лифа на юбку
    const texPost = (c, S2) => {
      const SS = shellSurf(LASTST);
      const o = [0, 0, 0];
      if (SS) {
        const X0 = Math.floor(S2 * 0.5), X1 = S2, Y0p = Math.floor((1 - 0.8) * S2), Y1p = Math.ceil((1 - 0.05) * S2);
        const im = c.getImageData(X0, Y0p, X1 - X0, Y1p - Y0p), d = im.data, Wd = X1 - X0;
        // дуга по сечению поверхности лифа: SQ — от середины переда со знаком, HP± — полупериметр до середины спинки
        const NAq = 72, NYq = 28, SQ = new Float32Array(NAq * NYq), HPp = new Float32Array(NYq), HPm = new Float32Array(NYq), q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
        const PX = new Float32Array(NAq), PZ = new Float32Array(NAq), iF = NAq / 2;
        for (let j = 0; j < NYq; j++) {
          const y = lerp(BY0, BY1, j / (NYq - 1));
          for (let i = 0; i < NAq; i++) { const a = -PI + (i + 0.5) * 2 * PI / NAq; shellAt(SS, a, shellS(SS, a, y), q); PX[i] = q.p[0]; PZ[i] = q.p[2]; }
          const sg = (i0, i1) => Math.hypot(PX[i1] - PX[i0], PZ[i1] - PZ[i0]);
          SQ[iF * NYq + j] = sg(iF - 1, iF) / 2; SQ[(iF - 1) * NYq + j] = -SQ[iF * NYq + j];
          for (let i = iF + 1; i < NAq; i++) SQ[i * NYq + j] = SQ[(i - 1) * NYq + j] + sg(i - 1, i);
          for (let i = iF - 2; i >= 0; i--) SQ[i * NYq + j] = SQ[(i + 1) * NYq + j] - sg(i, i + 1);
          HPp[j] = SQ[(NAq - 1) * NYq + j] + sg(NAq - 1, 0) / 2; HPm[j] = -SQ[j] + sg(NAq - 1, 0) / 2;
        }
        const gx = (ii, jj) => SQ[ii * NYq + jj], q3 = [0, 0, false];
        const atB = (pxf, pyf) => {
          const u = (pxf + 0.5) / S2, v = 1 - (pyf + 0.5) / S2, an = (u - 0.5) / 0.49, a = an * 2 * PI - PI, y = BY0 + (v - 0.05) / 0.75 * (BY1 - BY0);
          const fi = clamp((a + PI) / (2 * PI) * NAq - 0.5, 0, NAq - 1.001), fj = clamp((y - BY0) / (BY1 - BY0) * (NYq - 1), 0, NYq - 1.001), i0 = Math.floor(fi), j0 = Math.floor(fj), ki = fi - i0, kj = fj - j0;
          const s = lerp(lerp(gx(i0, j0), gx(i0 + 1, j0), ki), lerp(gx(i0, j0 + 1), gx(i0 + 1, j0 + 1), ki), kj), fr = Math.cos(a) > 0.05;
          q3[0] = fr ? s : s > 0 ? lerp(HPp[j0], HPp[j0 + 1], kj) - s : -(lerp(HPm[j0], HPm[j0 + 1], kj) + s); q3[1] = y; q3[2] = fr;
          return q3;
        };
        for (let py = Y0p; py < Y1p; py++) for (let px = X0; px < X1; px++) {
          printAA(atB, px, py, o);
          const j = ((py - Y0p) * Wd + (px - X0)) * 4;
          d[j] = o[0]; d[j + 1] = o[1]; d[j + 2] = o[2]; d[j + 3] = 255;
        }
        c.putImageData(im, X0, Y0p);
      }
      // юбка: u 0..0.5 — азимут от −π до π, v = 1 − t (t 0 — пояс 1.0, 1 — подол)
      const W2 = Math.floor(S2 / 2), im2 = c.getImageData(0, 0, W2, S2), d2 = im2.data;
      const q4 = [0, 0, false];
      const atS = (pxf, pyf) => {
        const t = (pyf + 0.5) / S2, y = lerp(1.0, 0.006, t), a = ((pxf + 0.5) / W2) * 2 * PI - PI, m = MER(y), fr = Math.cos(a) > 0;
        q4[0] = fr ? arcE(m.rx, m.rz, a) : Math.sign(a) * arcE(m.rx, m.rz, PI - Math.abs(a)); q4[1] = y; q4[2] = fr;
        return q4;
      };
      for (let py = 0; py < S2; py++) {
        for (let px = 0; px < W2; px++) {
          printAA(atS, px, py, o);
          const j = (py * W2 + px) * 4;
          d2[j] = o[0]; d2[j + 1] = o[1]; d2[j + 2] = o[2]; d2[j + 3] = 255;
        }
      }
      c.putImageData(im2, 0, 0);
    };
    // голливудские локоны: крупные S-волны с шагом 15 см (3–4 волны от плеч до кончиков; фаза по высоте и азимуту), объём
    // к низу, ниже плеч шире ×1.12
    const CC = [0, 1.5, -0.093];
    const wavePh = (y, az) => (1.45 - y) * 2 * PI / 0.15 + 1.2 * az;
    const curls = ctx => {
      const { st, p, zn, moved } = ctx, C = CC, lk = faceLock(st);
      for (let i = 0; i < st.n; i++) {
        const z0 = zn[i];
        if (z0 !== Z.hair_skull && z0 !== Z.hair_back) continue;
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        // волосы, сваренные с краем лица, — на месте (грани лица не тянутся), соседи — вполсилы
        if (y > 1.64 || !lk[i]) continue;
        const az = Math.atan2(x - C[0], z - C[2]);
        const low = clamp((1.58 - y) / 0.55, 0, 1);
        // волна — от уровня глаз (1.57): у лица мягче, ниже плеч — крупные S-волны
        const wave = (0.012 * sst(1.6, 1.5, y) + 0.012 * sst(1.42, 1.2, y)) * Math.sin(wavePh(y, az)) * (z0 === Z.hair_back ? 1 : 0.8);
        const push = 0.006 + 0.03 * low + wave;
        const ox = x - C[0], oz = z - C[2], ol = Math.hypot(ox, oz) || 1;
        // лицо открыто: спереди у щёк объём наружу вбок, а не к лицу
        const fr = oz > 0.05 && Math.abs(ox) < 0.2 ? 0.4 : 1;
        let nx = x + (ox / ol) * push * fr, nz = z + (oz / ol) * push * 0.7 * fr;
        // ниже плеч — шире
        if (y < 1.3) nx = C[0] + (nx - C[0]) * (1 + 0.12 * sst(1.3, 1.15, y));
        const kl = lk[i];
        p[i * 3] = lerp(x, nx, kl); p[i * 3 + 2] = lerp(z, nz, kl); p[i * 3 + 1] = y - (0.006 + 0.03 * low) * 0.15 * kl;
        moved[i] = 1;
      }
    };
    // блеск локонов: светлые дуги по гребням волн (#4A362A по #1E140F)
    const GLO = tc('#4A362A');
    const hairGloss = (x, y, z, o) => {
      const c = HP.hair(x, y, z, o);
      if (!c || y > 1.58) return c;
      const az = Math.atan2(x - CC[0], z - CC[2]), s2 = Math.sin(wavePh(y, az) + 0.6 + 0.9 * Math.sin(az * 7)), g = Math.pow(Math.max(0, s2), 14) * sst(1.58, 1.45, y) * 0.38;
      return g > 0.01 ? mix3(c, GLO, g, t1) : c;
    };
    // атлас до поправки света: стойка с веточкой шалфея и сливовым бутоном (полоса u 0.5..0.96, v 0.96..0.88, её правая
    // сторона спереди); юбка и лиф рисуются попиксельно в texPost
    const tex = (c, S) => {
      c.fillStyle = '#F4EFE8'; c.fillRect(S * 0.5, S * 0.03, S * 0.47, S * 0.1);
      const sx = S * 0.916, sy = S * 0.115;
      c.strokeStyle = '#7F8E52'; c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx - 6, sy); c.quadraticCurveTo(sx - 1, sy - 12, sx + 5, sy - 26); c.stroke();
      [[-4, -5, -1], [-1, -11, 1], [1, -16, -1], [3, -21, 1]].forEach(([dx, dy, sd]) => { c.beginPath(); c.moveTo(sx + dx, sy + dy); c.quadraticCurveTo(sx + dx + sd * 5, sy + dy - 2, sx + dx + sd * 7, sy + dy - 6); c.stroke(); });
      c.fillStyle = '#5A2440'; c.beginPath(); c.ellipse(sx + 5, sy - 28, 2.6, 3.4, 0.3, 0, PI * 2); c.fill();
      c.fillStyle = '#B98AA6'; c.beginPath(); c.arc(sx + 5.6, sy - 29.5, 1, 0, PI * 2); c.fill();
    };
    const skirtCol = (p, a, t) => {
      const f = Math.sin(a * 9) * 0.5 + 0.5;
      return mix3([255, 255, 255], [232, 226, 220], f * 0.22 * (0.3 + t) + (Math.cos(a) < -0.3 ? 0.06 : 0));
    };
    LOOKS.floral = {
      hem: 0.02, hair: H, top: 1.855, keep: 0.3, sitTuck: 0.5, tex, texPost,
      morph: [crown({ top: 1.855, vol: 0.016 }), curls, neckIn, slimShins(0.5)],
      // верх и полы тренча — прочь: лиф без бретелей, кожа плеч и груди, стойка и накидка — новым кроем; голени — кожа;
      // рукава и манжеты тренча — тоже (голые руки — капсулы кожи в одежде)
      // (и расширенный верхний край кисти — туда входит конец капсулы руки)
      hide: st => armHair(st, handRim(st, hideTorso({ skirt: true, legs: 0.36 }, (i, z) => z === Z.sleeve || z === Z.cuff)(st))),
      paint: {
        hair_skull: HP.hair, hair_back: hairGloss, beret: HP.strands, bow: HP.strands, neck: neckPaint,
        legs: (x, y, z, o) => { o.f = 1; return SKIN; },
        // носки сандалий из-под подола — золотисто-бежевые (темнее кожи: читаются туфлей, а не стопой)
        shoes: (x, y, z, o) => { if (y > 0.06) { o.f = 1; return SKIN; } o.k = 0.3; o.lo = 0.75; return tc('#BFA388'); },
      },
      garment: B => {
        // кожа на шее сзади и с боков (выемка у основания шеи в профиль)
        neckPatch(B, LASTST);
        const st = LASTST, SS = shellSurf(st);
        // русалка (MER): облегает до колена и ниже, раструб в пол, сзади шлейф; верх — по лифу (без ступеньки на талии)
        longSkirt(B, {
          top: 1.0, hem: 0.006, folds: 9, fold: 0.022, rings: 18, seg: 28,
          prof: y => MER(y),
          fit: SS ? (a, y) => shellR(SS, a, y) + 0.006 : null,
          col: skirtCol, uv: (p, a, t) => [(a + PI) / (PI * 2) * 0.5, 1 - t], a0: -PI, a1: PI, shinK: 1.0, thighK: 0.8, backShin: 1, backLeg: 1, mid: 0.03, flareTk: 0.6,
        });
        skinArms(B, st, { r: [0.04, 0.035, 0.031] });
        if (!SS) return;
        // лиф: кольцо 0.95 → верх (узор пиона атласом), бисерная кромка — тонкой трубкой по верху
        shellPiece(B, SS, { rows: 8, closed: true, cols: () => ringAz(30, -PI / 30),
          sv: (a, v) => shellS(SS, a, lerp(BY0, bodTop(a), v)), off: (a, s, u, v) => 0.004,
          col: () => [255, 255, 255], uv: (u, v, a, s) => bodUV(a, lerp(BY0, bodTop(a), v)) });
        {
          const SIL = tc('#E2DEE4'), NB2 = 30, q = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] }, base = B.p.length / 3;
          for (let r = 0; r <= NB2; r++) {
            const a = -PI + r * 2 * PI / NB2, y = bodTop(a); shellAt(SS, a, shellS(SS, a, y), q);
            for (let k = 0; k <= 3; k++) { const t = k / 3 * 2 * PI, nn = [q.n[0] * Math.cos(t), Math.sin(t), q.n[2] * Math.cos(t)], rr = 0.0028; B.v([q.p[0] + q.n[0] * 0.0055 + nn[0] * rr, q.p[1] + nn[1] * rr, q.p[2] + q.n[2] * 0.0055 + nn[2] * rr], nn, r % 2 ? IVO : SIL, { si: q.si.slice(), sw: q.sw.slice() }); }
          }
          for (let r = 0; r < NB2; r++) for (let k = 0; k < 3; k++) { const i0 = base + r * 4 + k, i1 = i0 + 1, j0 = i0 + 4, j1 = j0 + 1; B.tri(i0, i1, j0, false); B.tri(i1, j1, j0, false); }
        }
        // кожа: плечи, грудь («окошко» под стойкой) и шея до верха поверхности (без контура)
        skinRing(B, st, SS, bodTop, 30, 0, -PI / 30);
        // стойка и накидка — одно целое. Низ стойки по бокам и сзади лежит на плечах (точка поверхности тела на 1.27 +
        // 8 мм), спереди — кольцо у основания шеи; верх пелерины — те же точки (сварен со стойкой, без щели кожи).
        // Края пелерины спереди — ровная дуга от стойки к краю плеча («окошко» кожи под стойкой), ниже — полотнище
        // за руками до пола со шлейфом (сидя и в транспорте — целиком, низ подбирается). Изнанка — светлая подкладка
        const NA2 = SS.NA, NCU = 28, CB_Y = 1.27;
        const sSplit = new Float32Array(NA2), qq = { p: [0, 0, 0], n: [0, 0, 0], si: [0, 0, 0, 0], sw: [0, 0, 0, 0] };
        // низ пелерины по столбцу: самая широкая точка плеча (1.15–1.24)
        for (let k = 0; k < NA2; k++) {
          const a = -PI + (k + 0.5) * 2 * PI / NA2, s0 = shellS(SS, a, 1.15), s1 = shellS(SS, a, 1.24);
          let best = s0, br = 0;
          for (let i2 = 0; i2 <= 16; i2++) { const s2 = lerp(s0, s1, i2 / 16); shellAt(SS, a, s2, qq); const r = Math.hypot(qq.p[0], qq.p[2] - SH_CZ); if (r > br + 0.002) { br = r; best = s2; } }
          sSplit[k] = best;
        }
        const splitS = a => { const f = (a + PI) / (2 * PI) * NA2 - 0.5, k0 = Math.floor(f), kk = f - k0; return lerp(sSplit[((k0 % NA2) + NA2) % NA2], sSplit[(((k0 + 1) % NA2) + NA2) % NA2], kk); };
        // низ стойки по азимуту: спереди кольцо (r 0.072 вокруг оси шеи), к бокам — на плечо
        const collarBase = a => {
          const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), k = sst(0.3, 0.8, aa), q = shellAt(SS, a, shellS(SS, a, CB_Y));
          const sh = [q.p[0] + q.n[0] * 0.008, q.p[1] + q.n[1] * 0.008, q.p[2] + q.n[2] * 0.008], ring = [Math.sin(a) * 0.072, 1.262, -0.012 + Math.cos(a) * 0.068];
          return { p: [lerp(ring[0], sh[0], k), lerp(ring[1], sh[1], k), lerp(ring[2], sh[2], k)], si: q.si.slice(), sw: q.sw.slice() };
        };
        const aE = v => lerp(1.4, 0.5, Math.pow(v, 0.85));
        const capeCols = v => azRow(aE(v), 2 * PI - aE(v), NCU, [0.006], 0.12);
        const capeOff = (a, s, u, v) => lerp(0.016, 0.008, v) + 0.004 * Math.pow(Math.sin(a), 2) * (1 - v);
        const pb = B.bk;
        B.bk = 0.95;
        const top = shellPiece(B, SS, { rows: 6, cols: capeCols, sv: (a, v) => lerp(splitS(a), shellS(SS, a, CB_Y), v), off: capeOff,
          ol: (u, v) => u < 0.04 || u > 0.96,
          col: (p, a, s, u, v) => { const k = 0.96 + 0.04 * Math.cos(a * 9) * (1 - v); return [CAPE[0] * k, CAPE[1] * k, CAPE[2] * k]; } });
        // верхний ряд пелерины — точно на низ стойки, ряды под ним — плавно к нему (передний край без уступа у стойки)
        for (let r2 = 1; r2 <= top.nv; r2++) {
          const v = r2 / top.nv, kk = r2 === top.nv ? 1 : Math.pow(sst(0.35, 1, v), 2) * 0.75, rowA = capeCols(v);
          for (let c2 = 0; c2 < top.nu; c2++) { const j = top.base + r2 * top.nu + c2, cb = collarBase(rowA[c2]).p; for (let q = 0; q < 3; q++) B.p[j * 3 + q] = lerp(B.p[j * 3 + q], cb[q] + (q === 1 ? 0 : 0), kk); }
        }
        const topA = capeCols(1);
        // стойка: кольца вокруг шеи; нижнее кольцо — те же азимуты, что у верха пелерины, плюс перед (через 0)
        {
          const AC = topA.slice(), nF = 5;
          for (let i2 = 1; i2 <= nF; i2++) AC.push(lerp(2 * PI - 0.5, 2 * PI + 0.5, i2 / (nF + 1)));
          const NCc = AC.length, RINGS = [[1.336, 0.057, 0.055], [1.31, 0.061, 0.058], [1.284, 0.067, 0.063]], base = B.p.length / 3, NRc = RINGS.length + 1;
          B.bk = 0.9;
          for (let r = 0; r < NRc; r++) for (let c2 = 0; c2 < NCc; c2++) {
            const a = AC[c2], au = ((a % (2 * PI)) + 2 * PI) % (2 * PI), uv = [0.5 + 0.46 * (1 - au / (2 * PI)), 0.96 - 0.08 * r / 3];
            if (r < RINGS.length) {
              const [y, rx, rz] = RINGS[r];
              B.v([Math.sin(a) * rx, y, -0.012 + Math.cos(a) * rz], [Math.sin(a), 0, Math.cos(a)], CAPE, r < 2 ? W1('neck') : mixW('neck', 'chest', 0.5), uv);
            } else {
              const cb = collarBase(a);
              B.v(cb.p, [Math.sin(a), 0.3, Math.cos(a)], CAPE, { si: cb.si, sw: cb.sw }, uv);
            }
          }
          for (let r = 0; r < NRc - 1; r++) for (let c2 = 0; c2 < NCc; c2++) { const i0 = base + r * NCc + c2, i1 = base + r * NCc + (c2 + 1) % NCc, j0 = i0 + NCc, j1 = i1 + NCc; B.tri(i0, j0, i1); B.tri(i1, j0, j1); }
          // верх стойки — край без крышки (видна изнанка — подкладка)
        }
        // полотнище — от нижнего ряда пелерины за руками до пола
        {
          const NRH = 10, base = B.p.length / 3, cols = [];
          B.bk = 0.95;
          for (let c2 = 0; c2 < NCU; c2++) { const g = top.G[c2], a0 = Math.atan2(g.p[0], g.p[2] - SH_CZ); if (Math.abs(Math.atan2(Math.sin(a0), Math.cos(a0))) > 1.36) cols.push(c2); }
          const NC = cols.length;
          for (let r = 0; r < NRH; r++) {
            const t = r / (NRH - 1);
            for (let ci = 0; ci < NC; ci++) {
              const g = top.G[cols[ci]], a0 = Math.atan2(g.p[0], g.p[2] - SH_CZ), ys = lerp(g.p[1], 0.006, t);
              const aa = Math.abs(Math.atan2(Math.sin(a0), Math.cos(a0))), back = sst(1.9, 3.0, aa);
              // радиус: у плеча — точка пелерины, к локтю 0.28 (руки внутри), к полу 0.35 (сзади 0.4 + шлейф)
              const r0 = Math.hypot(g.p[0], g.p[2] - SH_CZ), rArm = lerp(0.28, 0.17, back), rHem = lerp(0.36, 0.48, back);
              const rr = t < 0.16 ? lerp(r0, rArm, Math.sin(t / 0.16 * PI / 2)) : lerp(rArm, rHem, (t - 0.16) / 0.84);
              const fold = 0.02 * sst(0.15, 1, t) * Math.cos(ci * 1.9);
              const zc = SH_CZ - 0.12 * back * sst(0.6, 1, t);
              const pt = r === 0 ? g.p.slice() : [Math.sin(a0) * (rr + fold), ys, zc + Math.cos(a0) * (rr + fold)];
              const n0 = [Math.sin(a0), 0.2 * (1 - t), Math.cos(a0)];
              const w = t < 0.1 ? { si: g.si, sw: g.sw } : [['chest', Math.max(0, 1 - t * 2.4) + 1e-4], ['spine', Math.max(0, 0.6 - Math.abs(t - 0.35) * 2)], ['hips', clamp(t * 1.6 - 0.3, 0, 1)]];
              const k = 0.94 + 0.06 * Math.cos(ci * 1.9) * sst(0.1, 0.6, t) - 0.03 * t;
              B.v(pt, n0, [CAPE[0] * k, CAPE[1] * k, CAPE[2] * k], w, null, sst(0.4, 1, t));
            }
          }
          B.part = 0;
          for (let r = 0; r < NRH - 1; r++) for (let c2 = 0; c2 < NC - 1; c2++) { const i0 = base + r * NC + c2, i1 = i0 + 1, j0 = i0 + NC, j1 = j0 + 1; B.tri(i0, j0, i1); B.tri(i1, j0, j1); }
        }
        B.bk = pb;
      },
    };
  }
  /* ---------- API ---------- */
  const HO = window.HeroOutfits = window.HeroOutfits || {};
  function legacyOf(id) { try { return window.HeroLooks && HeroLooks.valid(id) ? HeroLooks.legacy(id) : null; } catch (e) { return null; } }
  function fallback(H3, id, st) {
    try {
      if (st) { morphRun(st, null); maskRun(st, null); restoreTex(st); st.id = null; }
      if (window.HeroLook3D) HeroLook3D.apply(H3, legacyOf(id) || {});
    } catch (e) { /* без образа */ }
  }
  function apply(H3, id) {
    const t0 = performance.now();
    id = IDS.indexOf(id) >= 0 || (id && LOOKS[id] && LOOKS[id].dbg) ? id : null;
    const st = prep(H3);
    if (!st) { fallback(H3, id, null); return { ok: false, id, ms: 0 }; }
    if (st.applied && st.id === id) return { ok: true, id, ms: 0 };
    try {
      const lk = id ? LOOKS[id] : null;
      st.crownInner = null; st.crownCov = null; st.morphHide = null; st.dome = null; st.ironD = null;
      morphRun(st, lk ? lk.morph : null);
      let hf = lk && lk.hide ? lk.hide(st) : null;
      if (st.morphHide) { if (!hf) hf = st.morphHide; else for (let t = 0; t < st.nt; t++) hf[t] |= st.morphHide[t]; }
      maskRun(st, hf);
      if (lk) paintRun(st, lk); else restoreTex(st);
      st.id = id; st.applied = true;
      stats.ms = Math.round(performance.now() - t0); stats.id = id; stats.hidden = st.hidden; stats.morphed = st.morphed; stats.err = null;
      return { ok: true, id, ms: stats.ms };
    } catch (e) {
      console.warn('hero outfit', id, e); stats.err = String(e && e.message || e);
      fallback(H3, id, st);
      return { ok: false, id, ms: Math.round(performance.now() - t0) };
    }
  }
  // одежда этой героини (сетка на её скелете); id null — снять
  function dress(hero, id) {
    const T = window.THREE;
    if (!hero || !T) return null;
    id = IDS.indexOf(id) >= 0 || (id && LOOKS[id] && LOOKS[id].dbg) ? id : null;
    const rig = hero.rig, host = rig && rig.mesh ? rig.mesh : hero.statue && hero.statue.mesh ? hero.statue.mesh : null;
    if (!host) return null;
    let o = hero._outfit;
    let g = null;
    try { g = id ? garmentGeo(T, id) : null; } catch (e) { console.warn('hero outfit garment', id, e); g = null; }
    if (!o) {
      if (!g) return null;
      const mat = outfitMat(T, host.material);
      const m = rig ? new T.SkinnedMesh(g, mat) : new T.Mesh(g, mat);
      m.name = 'hero:outfit'; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.raycast = () => {};
      host.add(m);
      if (rig) m.bind(host.skeleton, host.bindMatrix);
      o = hero._outfit = { mesh: m, mat, U: mat.userData.U, id: null, tuck: 0 };
      if (Array.isArray(hero.mats)) hero.mats.push(mat);
    }
    // изнанка тренча — тканью, пока надет образ
    heroBack(host.material, T, !!g);
    if (!g) { o.mesh.visible = false; o.id = null; return o; }
    if (o.mesh.geometry !== g) o.mesh.geometry = g;
    texFor(T, id);
    o.mesh.visible = true; o.id = id;
    o.U.uKnee.value = M.knee;
    // статуэтка (без скелета): ноги качаются ниже края одежды образа
    if (hero.statue && hero.statue.U && hero.statue.U.hdRig) hero.statue.U.hdRig.value.x = (LOOKS[id] && LOOKS[id].hem) || M.hem0;
    stats.garmentTris = LOWQ ? g.userData.bodyTris : g.userData.tris;
    return o;
  }
  function set(H3, hero, id) {
    const r = apply(H3, id);
    // откат к тренчу — без одежды образа (трубы брюк поверх тренча были бы лишними)
    dress(hero, r.ok ? r.id : null);
    return r;
  }
  // раз в кадр: s — состояние позы (как у HeroAnim.update) или { drive, bike, sit, sport, fly, zip }
  function update(hero, dt, s) {
    const o = hero && hero._outfit;
    if (!o || !o.mesh.visible) return;
    s = s || {};
    const veh = !!(s.drive || s.bike || s.ride || s.sport || s.fly || s.zip), sit = !!(s.sit || s.sitting);
    const U = o.U, lk = LOOKS[o.id] || {};
    const ud = hero.root && hero.root.userData, kaz = !!(ud && ud.kaz);
    const hat = !kaz && !!(hero.beret && hero.beret.visible === false);
    U.uHide.value.set(kaz ? 1 : 0, veh || sit ? 1 : 0, kaz || hat ? 1 : 0);
    const want = veh ? 1 : sit ? (lk.sitTuck || 0) : 0;
    o.tuck += (want - o.tuck) * Math.min(1, (dt || 0.016) * 8);
    if (Math.abs(o.tuck - want) < 0.002) o.tuck = want;
    U.uTuck.value = o.tuck;
    // рукава-крылья в транспорте — к руке (за рулём кисти видны)
    U.uSq.value = o.tuck > 0 && veh ? o.tuck : veh ? 1 : 0;
  }
  const lookOf = id => (IDS.indexOf(id) >= 0 ? id : null);
  // какой образ надеть: lk.look, иначе образ сейва (G.look), иначе по старым цветам { bow, coat, hair }
  function lookFor(lk) {
    const HL = window.HeroLooks;
    if (lk && lookOf(lk.look)) return lk.look;
    try { if (window.G && typeof G.look === 'function') { const v = G.look(); if (lookOf(v)) return v; } } catch (e) { /* без сейва */ }
    if (HL && typeof HL.fromLegacy === 'function') { try { return lookOf(HL.fromLegacy(lk || {})) || lookOf(HL.DEFAULT); } catch (e) { /* */ } }
    return null;
  }
  // надеть образ героине по объекту образа игры (как o.hero у прогулок и комнат); null — образов нет (старый путь)
  function wear(H3, hero, lk) {
    const id = lookFor(lk);
    if (!id || !H3) return null;
    const r = set(H3, hero, id);
    return r && r.ok ? r : null;
  }
  // качество сцены: 'low' и 'lite' — одежда без оболочки контура (минус ~2.2 тыс. треугольников)
  function setQuality(q) {
    const low = q === 'low' || q === 'lite';
    if (low === LOWQ) return LOWQ;
    LOWQ = low;
    Object.keys(GEO).forEach(id => applyRange(GEO[id]));
    const g = stats.id && GEO[stats.id];
    if (g) stats.garmentTris = LOWQ ? g.userData.bodyTris : g.userData.tris;
    return LOWQ;
  }
  Object.assign(HO, {
    ids: IDS.slice(),
    setQuality,
    ok: H3 => !!prep(H3),
    apply, dress, set, update, wear, lookFor,
    current: H3 => { const st = H3 && ST.get(H3); return st ? st.id : null; },
    // последний надетый образ (одна модель на сессию): каз подгоняется под причёску этого образа
    id: () => stats.id,
    headTop: id => { const lk = LOOKS[lookOf(id === undefined ? stats.id : id)]; return lk ? lk.top || 1.80 : M.top0; },
    hatLift: id => {
      const lk = LOOKS[lookOf(id === undefined ? stats.id : id)];
      if (!lk) return { y: 0.13, s: 1.14 };
      const top = lk.top || 1.80, k = clamp((top - 1.766) / 0.13, 0, 1);
      return { y: Math.max(0, top - 1.766), s: 1 + 0.14 * k + (lk.hatW || 0) };
    },
    hasHat: id => !LOOKS[lookOf(id === undefined ? stats.id : id)],
    hairColor: id => { const lk = LOOKS[lookOf(id === undefined ? stats.id : id)]; return lk ? lk.hair.base : (window.HERO3D && HERO3D.hair) || '#3B1E0A'; },
    stats: () => Object.assign({}, stats, { calls: stats.id ? 3 : 2, tris: 28096 * 2 + (stats.id ? stats.garmentTris : 0) }),
    _core: { prep, ST, Z, M, LOOKS, GEO, stats, shell: { surf: shellSurf, piece: shellPiece, at: shellAt, s: shellS, az: shellAz, row: azRow, hide: hideTorso, last: () => LASTST } },
  });
})();
