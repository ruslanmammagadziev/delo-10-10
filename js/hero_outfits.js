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
  // 3 очки), tk (0..1 — насколько низ подбирается в транспорте), uv (узор; по умолчанию белый угол атласа одежды)
  const WHITE_UV = [0.995, 0.995];
  function GB() { this.p = []; this.n = []; this.c = []; this.uv = []; this.si = []; this.sw = []; this.pa = []; this.tk = []; this.idx = []; this.ol = []; this.part = 0; this.tuck = 0; }
  GB.prototype.v = function (p, n, col, w, uv, tk) {
    const i = this.p.length / 3;
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0] / 255, col[1] / 255, col[2] / 255);
    const u = uv || WHITE_UV; this.uv.push(u[0], u[1]);
    const ws = w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4); let s = 0; ws.forEach(q => { s += q[1]; });
    for (let k = 0; k < 4; k++) { const q = ws[k], bi = q ? boneIdx(q[0]) : 0; this.si.push(bi < 0 ? 0 : bi); this.sw.push(q && s > 0 ? q[1] / s : k === 0 ? 1 : 0); }
    this.pa.push(this.part); this.tk.push(tk == null ? this.tuck : tk);
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
        const p = [R.c[0] + sa * (R.rx + off) * kk, R.c[1], R.c[2] + ca * (R.rz + off) * kk];
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
    const nv = this.p.length / 3, P = this.p.slice(), N = this.n.slice(), C = this.c.slice(), UVa = this.uv.slice(), SI = this.si.slice(), SW = this.sw.slice(), PA = this.pa.slice(), TK = this.tk.slice(), I = this.idx.slice();
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
        UVa.push(WHITE_UV[0], WHITE_UV[1]); OL.push(1); PA.push(this.pa[i]); TK.push(this.tk[i]);
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
    const c = cv.getContext('2d'); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 512, 512);
    OTEX = new T.CanvasTexture(cv); OTEX.encoding = T.LinearEncoding; OTEX.anisotropy = 4;
    OTEX.userData.cv = cv; OTEX.userData.look = null;
    return OTEX;
  }
  function texFor(T, id) {
    const tx = outfitTex(T), lk = LOOKS[id];
    if (tx.userData.look === id) return tx;
    const c = tx.userData.cv.getContext('2d');
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
    const U = { uOlT: { value: 0.00085 }, uOlCol: { value: new T.Color('#4A3A48') }, uHide: { value: new T.Vector3(0, 0, 0) }, uTuck: { value: 0 }, uKnee: { value: 0.45 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float olk;\nattribute float part;\nattribute float tk;\nuniform float uOlT;\nuniform vec3 uHide;\nuniform float uTuck;\nuniform float uKnee;\nvarying float vOl;\nvarying float vTk;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nif (uTuck > 0.0 && tk > 0.0 && position.y < uKnee) { objectNormal.y /= max(0.25, 1.0 - 0.72 * uTuck * tk); objectNormal = normalize(objectNormal); }')
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\nif (uTuck > 0.0 && tk > 0.0) {\n float tq = uTuck * tk;\n float lo = max(0.0, uKnee - transformed.y);\n transformed.y = transformed.y + lo * 0.72 * tq;\n transformed.xz *= 1.0 - 0.18 * tq * clamp(lo / 0.3, 0.0, 1.0);\n}')
        .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\nvOl = olk;\nvTk = uTuck * tk * clamp((uKnee - position.y) / 0.05, 0.0, 1.0);\nif (olk > 0.5) mvPosition.xyz += normalize(transformedNormal) * uOlT * (-mvPosition.z);\ngl_Position = projectionMatrix * mvPosition;\nfloat hp = part < 0.5 ? 0.0 : part < 1.5 ? uHide.x : part < 2.5 ? uHide.y : uHide.z;\nif (hp > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
      sh.fragmentShader = 'uniform vec3 uOlCol;\nvarying float vOl;\nvarying float vTk;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (vOl > 0.5 && vTk > 0.3) discard;\nif (!gl_FrontFacing) { if (vOl > 0.5) discard; diffuseColor.rgb *= 0.78; }')
        .replace('#include <output_fragment>', 'if (vOl > 0.5) { outgoingLight = uOlCol; normal = normalize(vViewPosition); }\n#include <output_fragment>');
    };
    m.customProgramCacheKey = () => 'heroOutfit2';
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
    };
  }
  // маска образа: изнанка купола + треугольники с вершиной в зонах names (или по условию fn)
  function hideWith(names, fn) {
    return st => {
      const zs = new Set((names || []).map(nm => Z[nm])), inner = st.crownInner;
      return trisWhere(st, (i, z, x, y, zz) => (inner && inner[i]) || zs.has(z) || (fn ? fn(i, z, x, y, zz) : false));
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
      const pd = Math.abs(dx), partLine = front && z > -0.2 ? Math.exp(-(pd / 0.006) * (pd / 0.006)) : 0;
      const ey = (y - C[1]) / 0.28, shine = Math.exp(-Math.pow((ey - 0.82) / 0.07, 2)) * (h.gloss == null ? 0.22 : h.gloss);
      // у края купола полосы мягче и тон — как у волос под ним
      const dm = o.st && o.st.dome;
      let fade = 1;
      if (dm) { const ddx = x - dm.C[0], ddy = y - dm.C[1], ddz = z - dm.C[2], rr = Math.hypot(ddx, ddy, ddz) || 1, e = Math.asin(clamp(ddy / rr, -1, 1)), e0 = dm.at(dm.elS, Math.atan2(ddx, ddz)); fade = sst(e0 - 0.05, e0 + 0.2, e); }
      const k = lerp(0.92, 0.96 + 0.07 * w + shine, fade);
      mix3(Dk, B, 0.8, tmp);
      out[0] = tmp[0] * k; out[1] = tmp[1] * k; out[2] = tmp[2] * k;
      if (partLine > 0.01) mix3(out, Dk, partLine * 0.6, out);
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
        rings.push(lim && y > o.inCoat.y0 ? ringIn(R, lim) : R);
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
      const NR = 9, rings = [];
      for (let r = 0; r < NR; r++) {
        const t = r / (NR - 1), y = lerp(o.top, 0.075, t);
        const cx = lerp(knee[0], ank[0] + s * 0.006, clamp((knee[1] - y) / (knee[1] - ank[1]), 0, 1)), cz = lerp(0.002, -0.012, t) + (r === 0 ? (o.frontUp || 0) * 0 : 0);
        const rr = lerp(o.rTop || 0.058, o.rAnk || 0.042, sst(0, 1, t));
        rings.push({ c: [cx, y, cz], rx: rr, rz: rr * 1.08 });
      }
      B.tube(rings, 14, (ri, si, p, a) => {
        const y = p[1], w = y > ank[1] + 0.03 ? W1('shin_' + sd) : mixW('shin_' + sd, 'foot_' + sd, sst(ank[1] + 0.03, ank[1] - 0.01, y));
        const sh = Math.pow(Math.max(0, Math.cos(a - 0.5 * s)), 10);
        return { col: mix3(mix3(col, lt, sh * 0.8), dk, Math.pow(Math.abs(Math.sin(a)), 4) * 0.3 * (1 - sh)), w };
      }, { capTop: 'noline' });
    });
  }
  // голые ноги под коротким подолом: гладкая труба поверх ног модели (бёдер у модели нет, а у голени — пятна текстуры);
  // радиусы — по сечениям ног модели + 4 мм, ось: бедро -> колено -> щиколотка
  function skinLegs(B, o) {
    const col = SKIN, top = o.top || 0.74, bot = o.bot || 0.40, NR = 10;
    const prof = y => {
      if (y > 0.6) { const k = (y - 0.6) / 0.14; return [lerp(0.066, 0.074, k), lerp(0.063, 0.07, k)]; }
      if (y > 0.5) { const k = (y - 0.5) / 0.1; return [lerp(0.064, 0.066, k), lerp(0.056, 0.063, k)]; }
      const k = clamp((y - 0.4) / 0.1, 0, 1); return [lerp(0.06, 0.064, k), lerp(0.047, 0.056, k)];
    };
    ['L', 'R'].forEach(sd => {
      const s = sd === 'L' ? 1 : -1, rings = [];
      for (let r = 0; r < NR; r++) { const y = lerp(top, bot, r / (NR - 1)), q = prof(y); rings.push({ c: [s * q[0], y, 0.005], rx: q[1], rz: q[1] * 1.04 }); }
      B.tube(rings, 12, (ri, si, p) => {
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
      rings.push({ c: [q.cx || 0, y, q.cz], rx: q.rx, rz: q.rz, off: a => fold * Math.cos(a * nf + (o.ph || 0)) * (q.fk == null ? 1 : q.fk) });
    }
    B.tube(rings, seg, (ri, si, p, a, R) => {
      const t = ri / (NR - 1), y = p[1];
      const front = sst(-0.3, 0.7, Math.cos(a));
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
      return { col: c, w, tk: sst(M.knee + 0.1, hem, y), uv: o.uv ? o.uv(p, a, t) : null };
      // шов трубы — сзади (спереди у пары вершин шва разные «лишние» пятые веса — юбка расходилась щелью на шаге)
    }, { capTop: 'noline', a0: o.a0 == null ? -PI : o.a0, a1: o.a1 == null ? PI : o.a1 });
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
      B.tube(rings, opt.seg || 16, (ri, si, p, a) => {
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
          B.tube([0, 1, 2, 3, 4, 5, 6].map(i => { const u = i / 6; return { c: [c[0] + dx, top + Math.sin(u * PI) * hh, c[2] + lerp(-zs, zs, u)], rx: ht, rz: ht }; }), 6, () => ({ col: hc, w }));
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
  /* ---------- 1. «Северное сияние»: чёрный оверсайз-пиджак с полосами сияния, чёрный топ, широкие брюки в пол ---------- */
  {
    const H = { base: '#2E1C14', dark: '#1A100B', light: '#5A3C2A', tips: '#5E4232', part: 0.03, keep: 0.6 };
    const HP = hairPaint(H);
    const BASE = tc('#23262E'), SHD = tc('#15171D'), HI = tc('#3A3F4A');
    const GR = tc('#3FA88C'), CORE = tc('#7CD9B0'), TEAL = tc('#2F6F86'), BV = tc('#3D4E96'), BVL = tc('#5F6FC0');
    const out = [0, 0, 0], t1 = [0, 0, 0];
    const band = (d, w) => Math.exp(-(d / w) * (d / w));
    // поле сияния по точке ткани: зелёные полосы с мятной серединой, бирюзовый край, сине-фиолетовые пятна
    const field = (x, y, z) => {
      let g = 0, b = 0;
      const wob = 0.018 * Math.sin(x * 31 + y * 17) + 0.012 * Math.sin(y * 43 - x * 11);
      if (z > -0.02) {
        // её левая пола (+x): косая полоса от лацкана к боку, свечение под ней, полоса у бёдер, пятно у подола
        if (x > -0.01) {
          g = Math.max(g, band(y - (1.20 - (x - 0.04) * 1.55) + wob, 0.06) * sst(-0.01, 0.04, x));
          b = Math.max(b, band(y - (1.02 - (x - 0.06) * 0.6) + wob, 0.06) * sst(0.0, 0.07, x) * 0.95);
          g = Math.max(g, band(y - (0.83 + (x - 0.1) * 0.35) + wob, 0.045) * sst(0.02, 0.09, x));
          b = Math.max(b, band(y - 0.69 + wob, 0.045) * sst(0.05, 0.14, x) * 0.9);
        }
        // её правая пола: зелень у плеча и тонкая полоса вдоль лацкана
        if (x < 0.01) {
          g = Math.max(g, band(y - (1.24 + (x + 0.12) * 0.8) + wob, 0.05) * sst(-0.06, -0.14, x));
          g = Math.max(g, band(x - (-0.05 - (1.17 - y) * 0.25) + wob * 0.5, 0.022) * sst(1.2, 1.1, y) * sst(0.8, 0.95, y) * 0.85);
          b = Math.max(b, band(y - 0.74 + wob, 0.05) * sst(-0.04, -0.12, x) * 0.6);
        }
      } else {
        // спина: одна широкая дуга от левого плеча к правой лопатке
        g = Math.max(g, band(y - (1.12 + x * 0.9) + wob, 0.055) * 0.85);
        b = Math.max(b, band(y - (0.95 + x * 0.6) + wob, 0.07) * 0.7);
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
      o.k = 0.32; o.lo = 0.55; o.hi = 1.35;
      // правый рукав (−x): зелень у плеча; левый: синева на предплечье
      const s = x > 0 ? 1 : -1, wob = 0.01 * Math.sin(y * 37 + z * 20);
      let g = 0, b = 0;
      if (s < 0) { g = band(y - 1.13 + wob, 0.06) * 0.95; b = band(y - 0.9 + wob, 0.05) * 0.5; } else { b = band(y - 0.93 + wob, 0.07) * 0.85; g = band(y - 1.08 + wob, 0.035) * 0.6 * sst(0.0, 0.06, z); }
      mix3(BASE, BV, b, out); mix3(out, TEAL, Math.min(1, g * 1.5) * 0.7, out); mix3(out, GR, Math.max(0, g - 0.4), out);
      return out;
    };
    const TOP = tc('#1C1C20'), TR = tc('#1A1A1D');
    const J1 = jacket({ main: jacketMain, top: (x, y, z, o) => { o.k = 0.15; return TOP; }, bottom: (x, y, z, o) => { o.k = 0.1; return TR; }, neckY: 1.18, edge: '#3A3F4A' });
    LOOKS.aurora = {
      // hem — низ одежды для качания ног статуэтки (без скелета)
      hem: 0.64, hair: H, top: 1.825, keep: 0.3,
      morph: [crown({ top: 1.825 }), hemTo(0.64), flatten(['belt', 'cuff']), smoothFront({ y0: 0.6, y1: 1.1, x: 0.16, both: true, keepTop: 0.025 })],
      hide: hideWith(['legs']),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands,
        coat_torso: J1, coat_skirt: J1, collar: J1, belt: J1, buttons: J1,
        sleeve: sleeveMain, cuff: sleeveMain,
        shoes: (x, y, z, o) => { o.k = 0.5; return tc('#1A1A1D'); },
      },
      garment: B => trousers(B, { col: '#1A1A1D', light: '#2C2C31', dark: '#0F0F11', top: 0.86, wide: 0.122 }),
    };
  }
  /* ---------- 2. «Конная прогулка»: длинное замшевое пальто, голубая водолазка, кремовые брюки, сапоги, бордовый саквояж ---------- */
  {
    const H = { base: '#2E1C14', dark: '#1A100B', light: '#5A3C2A', tips: '#7A5338', part: 0.04, keep: 0.6 };
    const HP = hairPaint(H);
    const SU = tc('#4A2C1C'), SUD = tc('#2E1A10'), SUL = tc('#6A4430');
    const TN = tc('#A9C6E3'), TND = tc('#7F9DBE'), TNL = tc('#CFE1F2');
    const CR = tc('#E8E0D0'), CRD = tc('#C9BDA8');
    const BT = tc('#3A2218'), BTL = tc('#6B4A3C'), BTD = tc('#22130C');
    const out = [0, 0, 0];
    // замша: матовая, мелкий ворс (шум) и светлые потёртости по краям полы и манжет
    const suede = (x, y, z, o) => {
      o.k = 0.15; o.lo = 0.66; o.hi = 1.25;
      const nap = 0.5 + 0.5 * Math.sin(x * 211 + y * 97) * Math.sin(y * 173 - z * 131);
      mix3(SU, SUL, nap * 0.22, out);
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
    // в распахе у талии — пояс брюк (водолазка заправлена); ниже YT полы нет (распах геометрией, видны брюки одежды)
    const trs = (x, y, z, o) => { o.flat = 1; return mix3(CR, CRD, 0.08, out); };
    const YT = 0.99, opening = y => openAt(Math.max(y, 0.85), { w: 1.15 });
    const J2 = jacket({ main: suede, top: rib, bottom: trs, neckY: 1.5, skinV: false, w: 1.15, waist: 1.022, edge: '#2E1A10' });
    const legs = (x, y, z, o) => {
      if (y > 0.445) { o.k = 0.3; return CR; }
      // сапог: гладкая кожа с бликом спереди-сбоку
      o.k = 0.15; o.lo = 0.7; o.hi = 1.3;
      const sh = Math.pow(Math.max(0, Math.cos(Math.atan2(x - (x > 0 ? 0.06 : -0.06), z) - (x > 0 ? 0.5 : -0.5))), 8);
      return mix3(BT, BTL, sh * 0.8, out);
    };
    // ворот-гольф: шея чуть толще (свёрнутый ворот) ниже подбородка
    const rollNeck = ctx => {
      const { st, p, zn, moved, P0 } = ctx;
      for (let i = 0; i < st.n; i++) {
        if (zn[i] !== Z.neck) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2];
        if (y > 1.336 || y < 1.2) continue;
        const cz = -0.01, r = Math.hypot(x, z - cz) || 1, k = 1 + (0.006 + 0.004 * sst(1.27, 1.32, y)) / r * sst(1.336, 1.32, y);
        p[i * 3] = x * k; p[i * 3 + 2] = cz + (z - cz) * k; moved[i] = 1;
      }
    };
    const BAG = ['#5A1A1C', '#3A0E10', '#8A3A3A'];
    LOOKS.suede = {
      hem: 0.47, hair: H, top: 1.835, keep: 0.3,
      // распах пальто ниже пояса — геометрией (openFront): прямой край, за ним брюки и изнанка спинки
      morph: [crown({ top: 1.835, vol: 0.008 }), hemTo(0.47), flatten(['belt', 'cuff']), smoothFront({ y0: 0.6, y1: 1.1, x: 0.16, both: true, keepTop: 0.025 }), rollNeck, openFront({ yt: YT, edge: opening })],
      // ноги модели выше голенищ — под брюками одежды (иначе колени проступают сквозь узкие штанины)
      hide: hideWith([], (i, z, x, y) => z === Z.legs && y > 0.44),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands,
        coat_torso: J2, coat_skirt: J2, collar: J2, belt: J2, buttons: J2,
        sleeve: suede, cuff: suede,
        neck: (x, y, z, o) => (y < 1.338 ? rib(x, y, z, o) : null),
        legs, shoes: (x, y, z, o) => { o.k = 0.2; o.lo = 0.7; return BTD; },
      },
      garment: B => {
        bootShafts(B, { col: '#3A2218', light: '#6B4A3C', dark: '#22130C', top: 0.445, rTop: 0.06, rAnk: 0.046 });
        // кремовые брюки для верховой езды: две узкие штанины от пояса до голенищ (видны в распахе пальто)
        trousers(B, { col: '#E8E0D0', light: '#F6F0E4', dark: '#C9BDA8', top: 1.0, hem: 0.425, hipR: 0.084, hipRz: 0.088, wide: 0.06, hemX: 0.064, split: 0.5, rings: 12, seg: 12, seat: { y0: 0.82, rx: 0.13, rz: 0.11, cz: -0.012 }, inCoat: { y0: 0.5, m: 0.008 } });
        // ворот-гольф: мягкий валик вокруг шеи до подбородка (ровный верх, закрывает пилообразный край краски)
        const nw = W1('neck'), roll = [[1.346, 0.052, 0.047], [1.335, 0.059, 0.054], [1.312, 0.062, 0.057], [1.29, 0.06, 0.055], [1.272, 0.057, 0.053]].map(([y, rx, rz]) => ({ c: [0, y, -0.011], rx, rz }));
        B.tube(roll, 20, (ri, si, p, a) => { const f = 0.5 + 0.5 * Math.sin(a * 30); return { col: mix3(TN, ri === 1 || ri === 2 ? TNL : TND, 0.12 + 0.1 * f), w: nw }; }, { capTop: 'noline' });
        // бордовый «докторский» саквояж: низ — короткая коробка, верх — купол (полуцилиндр вдоль длины), две круглые
        // ручки, молния по куполу и золотой бегунок
        bagOnForearm(B, {
          col: BAG[0], strap: '#3A0E10', strapT: 0.4, size: [0.085, 0.14, 0.2], dx: 0.062, drop: 0.12, handles: false,
          body: bagBox([0.085, 0.14, 0.2], BAG, { gloss: true, sq: 3.2, rings: 9, prof: t => { const u = clamp((t - 0.42) / 0.58, 0, 1); return [Math.max(0.14, Math.sqrt(1 - u * u)), 1 - 0.08 * u * u]; }, handles: [0.055, 0.0065], handleZ: [-0.012, 0.012], handleCol: '#3A0E10', extra: (B2, c, w) => {
            B2.tube([0, 1, 2, 3, 4, 5].map(i => { const u = i / 5; return { c: [c[0], c[1] + 0.071, c[2] + lerp(-0.085, 0.085, u)], rx: 0.0035, rz: 0.0035 }; }), 5, () => ({ col: tc('#2A0A0C'), w }));
            B2.blob([c[0] + 0.012, c[1] + 0.062, c[2] + 0.06], [0.004, 0.012, 0.007], tc('#C9A45C'), w, 6, 4);
          } }),
        });
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
      // мелкие детали тренча (кромки лацканов, строчки) не проступают: k мал, объём — сглаженный
      o.k = 0.08; o.lo = 0.72; o.hi = 1.15;
      const r = 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 140 + y * 4);
      mix3(PK, PKD, r * 0.1, out);
      if (y < 0.705) { const b = 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 70); mix3(out, b > 0.5 ? PKL : PKD, 0.22, out); if (y > 0.698) mix3(out, PKD, 0.3, out); }
      return out;
    };
    const cuff = (x, y, z, o) => { o.k = 0.3; const b = 0.5 + 0.5 * Math.sin(Math.atan2(x - (x > 0 ? 0.2 : -0.2), z) * 18); return mix3(PK, b > 0.5 ? PKL : PKD, 0.25, out); };
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
    const balloon = sleeveShape((t, r) => (t < 0 ? 1 + 0.04 * sst(-0.6, 0, t) : 1 + 0.13 * Math.sin(clamp(t / 0.85, 0, 1) * PI) - 0.04 * sst(0.85, 1.0, t)), ['sleeve']);
    const BAG = ['#C9B3E0', '#A48CC0', '#EDE3F7'];
    LOOKS.pink = {
      hem: 0.66, hair: H, top: 1.82, keep: 0.3,
      morph: [crown({ top: 1.82 }), hemTo(0.66), flatten(['belt', 'buttons']), smoothFront({ y0: 0.62, y1: 1.29, both: true, keepTop: 0.05, fins: true }), iron({ y0: 1.12, y1: 1.36, c: 0.02 }), finsHide(), balloon],
      hide: hideWith([]),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands,
        coat_torso: J3, coat_skirt: J3, collar: J3, belt: J3, buttons: J3,
        sleeve: knit, cuff, legs, shoes,
      },
      garment: B => {
        skinLegs(B, { top: 0.74, bot: 0.40 });
        // подол платья под кардиганом (снизу не видно пустоты полы)
        const dr = [];
        for (let r = 0; r < 4; r++) { const t = r / 3, y = lerp(0.8, 0.672, t); dr.push({ c: [0, y, 0.012], rx: lerp(0.168, 0.176, t), rz: lerp(0.112, 0.118, t) }); }
        B.tube(dr, 28, (ri, si, p) => ({ col: mix3(WD, WDD, ri === 3 ? 0.2 : 0), w: p[0] > 0.02 ? mixW('hips', 'thigh_L', 0.35) : p[0] < -0.02 ? mixW('hips', 'thigh_R', 0.35) : W1('hips') }));
        bootShafts(B, { col: '#F1EBE1', light: '#FFFDF8', dark: '#CFC5B6', top: 0.41, rTop: 0.062, rAnk: 0.047 });
        // жемчуг у основания шеи
        const pw = W1('neck');
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * PI * 2, y = 1.238 + 0.03 * (1 - Math.cos(a)) * 0.5 * 0 + 0.02 * (Math.cos(a) < 0 ? 1 : 0) * -Math.cos(a);
          const x = Math.sin(a) * 0.072, z = -0.012 + Math.cos(a) * 0.072;
          if (Math.cos(a) < -0.2) continue;
          B.blob([x, y + (Math.cos(a) > 0 ? -0.012 * Math.cos(a) : 0), z], [0.0105, 0.0105, 0.0105], (n) => mix3(tc('#F6EEE4'), tc('#FFFFFF'), Math.max(0, n[1] * 0.6 + n[2] * 0.5)), pw, 5, 3, { ol: false });
        }
        // очки «кошачий глаз» подняты на голову над линией волос: линзы лежат на волосах (касательно купола), тонкая
        // тёмная оправа, блик; короткие дужки уходят в волосы (не торчат вбок)
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
          col: BAG[0], strap: '#B9A2D2', strapT: 0.4, strapR: 0.074, size: [0.15, 0.17, 0.15], dx: 0.085, drop: 0.14, handles: false,
          body: bagBox([0.15, 0.17, 0.15], BAG, { gloss: true, sq: 2, rings: 9, seg: 18,
            prof: t => { const k = (0.82 + 0.2 * Math.sin(PI * clamp(t / 0.85, 0, 1))) * lerp(1, 0.62, sst(0.74, 1.0, t)); return [k, k]; },
            off: (a, t) => (t > 0.78 ? 0.013 * Math.max(0, Math.cos(a * 6)) * (t - 0.78) / 0.22 : 0.0015 * Math.cos(a * 4 + t * 6)),
            handles: [0.055, 0.0065], handleZ: [-0.012, 0.012], handleCol: '#C9B3E0' }),
        });
      },
    };
  }
  /* ---------- 4. «Медный закат»: атласное макси на запах, рукава-«крылья» с разрезом, кушак, золотые серьги и клатч ---------- */
  {
    const H = { base: '#3A1E12', dark: '#221009', light: '#7A4A30', tips: '#7A4A30', part: 0.012, keep: 0.55 };
    const HP = hairPaint(H);
    const RS = tc('#B8521F'), RSD = tc('#7A2E10'), RSL = tc('#F09A55'), DEEP = tc('#4E1806');
    const SA = tc('#A9471B'), SAD = tc('#6E2A0E'), SAL = tc('#E08A4A');
    const out = [0, 0, 0];
    // атлас: жёсткие светлые полосы блика на складках и глубокие тёмные ложбины (по высоте и азимуту)
    const satinAt = (x, y, z, o, base) => {
      o.k = 0.1; o.lo = 0.62; o.hi = 1.35; o.g = 1.0;
      const a = Math.atan2(x, z), f = Math.sin(a * 9 + y * 6 + Math.sin(y * 13) * 0.8);
      const hi = Math.pow(Math.max(0, f), 10), lo = Math.pow(Math.max(0, -f), 3);
      mix3(base || RS, RSL, hi * 0.65, out);
      mix3(out, RSD, lo * 0.45, out);
      return out;
    };
    // лиф на запах: глубокий V до 1.08 (кожа), левая пола поверх правой — кромка с тенью; кушак на талии
    const bodice = (x, y, z, o) => {
      if (z > 0.02 && y > 1.0 && y < 1.32) {
        const vy = 1.08, k = (y - vy) / (1.255 - vy);
        const hw = k > 0 ? 0.052 * Math.pow(k, 0.9) + 0.004 : -1, cx = 0.004;
        if (Math.abs(x - cx) < hw && y < 1.27) { o.k = 0.9; return SKIN; }
        // кромка запаха: левая пола (её левая, +x) поверх — тень под ней на правой поле
        const d = x - cx - hw;
        if (k > -0.4 && d > -0.006 && d < 0.008) { satinAt(x, y, z, o); return mix3(out, RSL, 0.35, out); }
        if (k > -0.4 && x < cx - hw && x > cx - hw - 0.014) { satinAt(x, y, z, o); return mix3(out, DEEP, 0.35, out); }
      }
      // кушак
      if (y > 0.955 && y < 1.04 && z > -0.12) {
        o.k = 0.3;
        const f = Math.sin(Math.atan2(x, z) * 14 + y * 40);
        mix3(SA, f > 0 ? SAL : SAD, Math.abs(f) * 0.35, out);
        // узел и концы — у её левого бока
        if (x > 0.06 && x < 0.11 && z > 0.05) mix3(out, SAL, 0.25, out);
        return out;
      }
      return satinAt(x, y, z, o);
    };
    // рукав: атлас с разрезом по внешней стороне от плеча (кожа в разрезе), узкая манжета у запястья
    const sleeve = (x, y, z, o) => {
      const s = x > 0 ? 1 : -1;
      const a = J('upperarm_' + (s > 0 ? 'L' : 'R')), h = J('hand_' + (s > 0 ? 'L' : 'R'));
      const t = clamp((a[1] - y) / (a[1] - h[1]), 0, 1);
      // внешняя сторона руки: от оси наружу (+x у левой), разрез уже у плеча, шире к локтю, закрыт у манжеты
      const ax = lerp(a[0], h[0], t), out2 = (x - ax) * s, slitW = 0.012 + 0.02 * Math.sin(clamp(t / 0.85, 0, 1) * PI);
      if (t > 0.08 && t < 0.86 && out2 > 0.02 && Math.abs(z + 0.012) < slitW) { o.k = 0.85; return SKIN; }
      if (t > 0.9) { o.k = 0.3; return mix3(RS, RSD, 0.25, out); }
      return satinAt(x, y, z, o);
    };
    // рукав-«крыло»: ниже локтя ткань расходится, кончается за 3 см до запястья
    // рукав-колокол: от локтя пышнее (×1.6 к середине предплечья), к запястью сужается (кисти видны и из-за руля)
    const flare = sleeveShape((t, r, sd) => (t <= 0.0 ? 1 + 0.08 * sst(-0.5, 0, t) : 1.08 + 0.44 * sst(-0.05, 0.32, t) * (1 - sst(0.5, 0.82, t)) - 0.08 * sst(0.85, 1.0, t)), ['sleeve']);
    const skirtCol = (p, a, t) => {
      const f = Math.sin(a * 11 + 0.3) * (0.4 + 0.6 * t) + 0.25 * Math.sin(a * 5 - t * 3);
      const c = mix3(RS, RSL, Math.pow(Math.max(0, f), 6) * 0.6);
      return mix3(c, RSD, Math.pow(Math.max(0, -f), 2) * 0.5 + (Math.cos(a) < -0.3 ? 0.12 : 0));
    };
    // волосы у ушей — назад за уши (уши и серьги видны, как в ролике); у лица — мягко, без растяжек
    const behindEars = ctx => {
      const { st, p, zn, moved, P0 } = ctx;
      for (let i = 0; i < st.n; i++) {
        if (zn[i] !== Z.hair_skull && zn[i] !== Z.hair_back) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], ax = Math.abs(x);
        if (y < 1.3 || y > 1.66 || ax < 0.12 || z < -0.09) continue;
        const w = sst(1.3, 1.42, y) * sst(1.66, 1.56, y) * sst(0.12, 0.18, ax) * sst(-0.09, -0.03, z);
        if (w <= 0) continue;
        p[i * 3 + 2] = z - 0.042 * w; p[i * 3] = x - Math.sign(x) * 0.012 * w; moved[i] = 1;
      }
    };
    LOOKS.rust = {
      hem: 0.02, hair: H, top: 1.82, keep: 0.3, sitTuck: 0.3,
      morph: [crown({ top: 1.82 }), behindEars, flatten(['belt', 'buttons', 'cuff']), smoothFront({ y0: 0.86, y1: 1.29, both: true, keepTop: 0.05, fins: true }), iron({ y0: 1.12, y1: 1.36, c: 0.02 }), finsHide(), flare],
      // голени не прячем (кожа): в машине и на велосипеде подол подобран, голени с туфлями видны; колено и выше — под юбкой
      hide: hideWith(['coat_skirt'], (i, z, x, y) => z === Z.legs && y > 0.36),
      paint: {
        hair_skull: HP.hair, hair_back: HP.hair, beret: HP.strands, bow: HP.strands,
        coat_torso: bodice, collar: bodice, belt: bodice, buttons: bodice,
        sleeve, cuff: sleeve,
        legs: (x, y, z, o) => { o.f = 1; return SKIN; },
        // босоножки: над стопой кожа с тонким ремешком на щиколотке (без «носка» по краю зоны обуви)
        shoes: (x, y, z, o) => {
          if (y > 0.058) { if (y > 0.074 && y < 0.083) { o.k = 0.2; return tc('#C99A62'); } o.f = 1; return SKIN; }
          o.k = 0.3; return Math.sin(z * 260) > 0.75 ? tc('#B88A58') : tc('#D2A878');
        },
      },
      garment: B => {
        longSkirt(B, {
          top: 1.0, hem: 0.012, folds: 12, fold: 0.04, rings: 18, seg: 44,
          prof: (y, t) => {
            if (y > 0.8) { const k = (1.0 - y) / 0.2; return { cz: 0.022, rx: lerp(0.122, 0.205, k), rz: lerp(0.104, 0.15, k), fk: 0.3 }; }
            const k = (0.8 - y) / 0.79;
            return { cz: lerp(0.022, -0.01, k), rx: lerp(0.205, 0.36, Math.pow(k, 0.85)), rz: lerp(0.15, 0.31, Math.pow(k, 0.85)) };
          },
          col: skirtCol, shinK: 0.75, thighK: 0.55, backShin: 0.35, mid: 0.17,
        });
        // золотые скульптурные серьги: гвоздик у мочки и крупная капля-петля, висит вниз, плоскостью вперёд
        const GOLD = tc('#E2B85C'), GOLDD = tc('#A87C30'), GOLDL = tc('#FFE9A8');
        earrings(B, { y: 1.478, x: 0.2, z: -0.008, make: (B2, c, s, w) => {
          B2.blob(c, [0.007, 0.007, 0.005], GOLD, w, 6, 4, { ol: false });
          // капля: петля по «яйцу» (узкий верх, круглый низ) шириной 3 см и высотой 5.5 см, трубка 4.5 мм
          const ax = 0.015, ay = 0.0275, r = 0.0045, NU = 16, NV = 5, base = B2.p.length / 3, yaw = s * 0.35;
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
        // клатч-«подушка» прижат левой рукой к бедру
        bagOnForearm(B, {
          col: '#D8B47A', strapT: 0.7, noStrap: true, size: [0.16, 0.085, 0.045], dx: 0.025, drop: 0.035, dz: 0.03, handles: false,
          body: bagBlob(null, [0.16, 0.085, 0.045], ['#D8B47A', '#A8834E', '#F3DDAA'], { gloss: true, rot: [0, 0.2, 1.25], segU: 12, segV: 8 }),
        });
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
    // Гладкая причёска — «шапочка» волос в одежде (кость головы): кольца от макушки до шеи по форме черепа (на 6–8 мм
    // над ним, не шире лица +10 %). Где лицо и ниже линии роста волос — кольцо уходит под кожу (лицо открыто, уши
    // видны), выше — ложится поверх края лица (рваный край маски лица спрятан). Волосы модели спрятаны целиком.
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
    // линия роста волос: высота по углу кольца от середины лба (0) к затылку (π)
    const HL = [[0, 1.7], [0.35, 1.694], [0.61, 1.672], [0.87, 1.638], [1.08, 1.6], [1.2, 1.565], [1.35, 1.535], [1.62, 1.53], [1.75, 1.48], [1.92, 1.3], [PI, 1.3]];
    const fold = th => { const a = ((th % (2 * PI)) + 2 * PI) % (2 * PI); return a > PI ? 2 * PI - a : a; };
    const hairline = th => { const a = fold(th); for (let i = 1; i < HL.length; i++) if (a <= HL[i][0]) return lerp(HL[i - 1][1], HL[i][1], (a - HL[i - 1][0]) / (HL[i][0] - HL[i - 1][0])); return 1.3; };
    // растр кожи головы по направлениям из CH: ближний и дальний радиус (лицо, уши, шея) и «край» (лицо и шея, ±3 ячейки)
    const NAZ = 144, NEL = 72;
    const dirOf = (x, y, z) => { const dx = x - CH[0], dy = y - CH[1], dz = z - CH[2], r = Math.hypot(dx, dy, dz) || 1e-6; return [Math.atan2(dx, dz), Math.asin(clamp(dy / r, -1, 1)), r]; };
    const binK = (az, el) => clamp(Math.floor((el + PI / 2) / PI * NEL), 0, NEL - 1) * NAZ + ((Math.floor((az + PI) / (2 * PI) * NAZ) % NAZ) + NAZ) % NAZ;
    let FR = null;
    function faceRaster(st) {
      if (FR && FR.st === st) return FR;
      const lo = new Float32Array(NAZ * NEL).fill(9), hi = new Float32Array(NAZ * NEL), he = new Float32Array(NAZ * NEL);
      const P0 = st.P0, I0 = st.I0, sk = new Uint8Array(32), ed = new Uint8Array(32);
      [Z.face, Z.ears, Z.neck].forEach(z => { sk[z] = 1; }); [Z.face, Z.neck].forEach(z => { ed[z] = 1; });
      const Q = P0;
      // цвет и нормаль наружной поверхности лица по направлению (кожа шапочки на висках и у лба — как лицо под ней)
      const fc = new Float32Array(NAZ * NEL * 3), fn = new Float32Array(NAZ * NEL * 3), fr0 = new Float32Array(NAZ * NEL), feat = new Uint8Array(NAZ * NEL);
      const UVA = st.geo.attributes.uv.array, OR = st.tex && st.tex.orig, N0 = st.N0, TW = st.W, TH = st.H;
      for (let t = 0; t < st.nt; t++) {
        const zt = st.tz[t];
        if (!sk[zt]) continue;
        const a = I0[t * 3] * 3, b = I0[t * 3 + 1] * 3, c = I0[t * 3 + 2] * 3;
        if (zt === Z.face && OR) {
          const ia = I0[t * 3], ib = I0[t * 3 + 1], ic = I0[t * 3 + 2];
          for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) {
            const wa = (i + 0.33) / 5.0, wb = (j + 0.33) / 5.0, wc = 1 - wa - wb;
            if (wc < 0) continue;
            const d = dirOf(Q[a] * wa + Q[b] * wb + Q[c] * wc, Q[a + 1] * wa + Q[b + 1] * wb + Q[c + 1] * wc, Q[a + 2] * wa + Q[b + 2] * wb + Q[c + 2] * wc), k = binK(d[0], d[1]);
            if (d[2] <= fr0[k]) continue;
            const u = UVA[ia * 2] * wa + UVA[ib * 2] * wb + UVA[ic * 2] * wc, v = UVA[ia * 2 + 1] * wa + UVA[ib * 2 + 1] * wb + UVA[ic * 2 + 1] * wc;
            const px = (clamp(Math.floor(v * TH), 0, TH - 1) * TW + clamp(Math.floor(u * TW), 0, TW - 1)) * 4;
            // только кожа (брови, ресницы и волосы, нарисованные автором по краю маски, — мимо)
            const R0 = OR[px], G0 = OR[px + 1], B0 = OR[px + 2];
            // брови, ресницы, глаза — «черты»: шапочка их никогда не накрывает
            if (luma(R0, G0, B0) < 115) feat[k] = 1;
            if (luma(R0, G0, B0) < 150 || R0 < G0 || G0 < B0 || R0 - B0 < 45) continue;
            fr0[k] = d[2];
            for (let q = 0; q < 3; q++) { fc[k * 3 + q] = OR[px + q]; fn[k * 3 + q] = N0[a + q] * wa + N0[b + q] * wb + N0[c + q] * wc; }
          }
        }
        const e = Math.max(Math.hypot(Q[a] - Q[b], Q[a + 1] - Q[b + 1], Q[a + 2] - Q[b + 2]), Math.hypot(Q[c] - Q[b], Q[c + 1] - Q[b + 1], Q[c + 2] - Q[b + 2]), Math.hypot(Q[a] - Q[c], Q[a + 1] - Q[c + 1], Q[a + 2] - Q[c + 2]));
        const nS = clamp(Math.ceil(e / 0.004), 1, 14);
        for (let i = 0; i <= nS; i++) for (let j = 0; j <= nS - i; j++) {
          const wa = i / nS, wb = j / nS, wc = 1 - wa - wb;
          const d = dirOf(Q[a] * wa + Q[b] * wb + Q[c] * wc, Q[a + 1] * wa + Q[b + 1] * wb + Q[c + 1] * wc, Q[a + 2] * wa + Q[b + 2] * wb + Q[c + 2] * wc), k = binK(d[0], d[1]);
          if (d[2] < lo[k]) lo[k] = d[2];
          if (d[2] > hi[k]) hi[k] = d[2];
          if (ed[zt] && d[2] > he[k]) he[k] = d[2];
        }
      }
      // у ушей шапочка — по черепу (ухо снаружи, его корень под волосами не прячем «конусом»)
      const ear = new Uint8Array(NAZ * NEL);
      for (let i = 0; i < st.n; i++) {
        const zx = P0[i * 3], zy = P0[i * 3 + 1];
        // только само ухо: «плавники» края маски лица над ухом и у виска шапочка накрывает (раньше торчали осколками)
        // верх уха (с «плавниками» маски над ним) — под гладкими волосами, ниже — ухо открыто
        if (st.zn[i] !== Z.ears || P0[i * 3 + 1] > 1.532) continue;
        const d = dirOf(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]), el0 = clamp(Math.floor((d[1] + PI / 2) / PI * NEL), 0, NEL - 1), az0 = ((Math.floor((d[0] + PI) / (2 * PI) * NAZ) % NAZ) + NAZ) % NAZ;
        for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) { const e2 = el0 + de; if (e2 >= 0 && e2 < NEL) ear[e2 * NAZ + ((az0 + da + NAZ) % NAZ)] = 1; }
      }
      for (let k = 0; k < NAZ * NEL; k++) if (ear[k]) he[k] = 0;
      // край лица «конусом»: поверх края маски на 4 мм, дальше от края — ниже на 2.5 мм за ячейку (без ступенек)
      const hd = new Float32Array(NAZ * NEL);
      for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
        let m = 0;
        for (let de = -8; de <= 8; de++) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; for (let da = -8; da <= 8; da++) { const h = he[e2 * NAZ + ((az + da + NAZ) % NAZ)]; if (h > 0) m = Math.max(m, h + 0.004 - 0.0025 * Math.hypot(de, da)); } }
        hd[el * NAZ + az] = ear[el * NAZ + az] ? 0 : m;
      }
      // «лицо здесь» — с запасом в ячейку от края маски (рваный край лица остаётся под шапочкой)
      const ins = new Uint8Array(NAZ * NEL);
      for (let el = 1; el < NEL - 1; el++) for (let az = 0; az < NAZ; az++) {
        let c = 0;
        for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) if (hi[(el + de) * NAZ + ((az + da + NAZ) % NAZ)] > 0) c++;
        ins[el * NAZ + az] = c === 9 ? 1 : 0;
      }
      // плавная «глубина внутри лица»: размытая маска (край ныряния шапочки без зубцов по сетке растра)
      const inS = new Float32Array(NAZ * NEL);
      for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
        let s2 = 0, n2 = 0;
        for (let de = -3; de <= 3; de++) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; for (let da = -3; da <= 3; da++) { s2 += ins[e2 * NAZ + ((az + da + NAZ) % NAZ)]; n2++; } }
        inS[el * NAZ + az] = ins[el * NAZ + az] ? s2 / n2 : 0;
      }
      // тень автора по краю маски (под бывшими волосами кожа темнее) — мимо: только ячейки не темнее медианы кожи − 6
      const lum = [];
      for (let k = 0; k < NAZ * NEL; k++) if (fr0[k] > 0) lum.push(luma(fc[k * 3], fc[k * 3 + 1], fc[k * 3 + 2]));
      lum.sort((a2, b2) => a2 - b2);
      const lMin = lum.length ? lum[lum.length >> 1] - 6 : 0;
      // разлив цвета и нормали лица на пустые ячейки (дыры маски у висков) — волной от заполненных, 24 шага
      const has = new Uint8Array(NAZ * NEL);
      for (let k = 0; k < NAZ * NEL; k++) if (fr0[k] > 0 && luma(fc[k * 3], fc[k * 3 + 1], fc[k * 3 + 2]) >= lMin) has[k] = 1;
      for (let it = 0; it < 24; it++) {
        const add = [];
        for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
          const k = el * NAZ + az; if (has[k]) continue;
          let n2 = 0; const cs = [0, 0, 0, 0, 0, 0];
          for (const [de, da] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; const k2 = e2 * NAZ + (az + da + NAZ) % NAZ; if (!has[k2]) continue; n2++; for (let q = 0; q < 3; q++) { cs[q] += fc[k2 * 3 + q]; cs[q + 3] += fn[k2 * 3 + q]; } }
          if (n2) add.push(k, n2, cs);
        }
        if (!add.length) break;
        for (let q = 0; q < add.length; q += 3) { const k = add[q], n2 = add[q + 1], cs = add[q + 2]; for (let j = 0; j < 3; j++) { fc[k * 3 + j] = cs[j] / n2; fn[k * 3 + j] = cs[j + 3] / n2; } has[k] = 1; }
      }
      // сглаживание цвета 5×5 (румянец у края маски не растекается пятнами)
      const fcS = new Float32Array(fc.length);
      for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
        let n2 = 0; const k = el * NAZ + az;
        for (let de = -2; de <= 2; de++) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; for (let da = -2; da <= 2; da++) { const k2 = e2 * NAZ + (az + da + NAZ) % NAZ; if (!has[k2]) continue; n2++; for (let q = 0; q < 3; q++) fcS[k * 3 + q] += fc[k2 * 3 + q]; } }
        if (n2) for (let q = 0; q < 3; q++) fcS[k * 3 + q] /= n2;
      }
      // складки края маски (лоскут кожи под углом, двойной слой у виска): шапочка кожей поверх (+2 ячейки), не под
      const fold = new Uint8Array(NAZ * NEL), featD = new Uint8Array(NAZ * NEL);
      for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
        if (!feat[el * NAZ + az]) continue;
        for (let de = -3; de <= 3; de++) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; for (let da = -3; da <= 3; da++) featD[e2 * NAZ + (az + da + NAZ) % NAZ] = 1; }
      }
      for (let el = 0; el < NEL; el++) for (let az = 0; az < NAZ; az++) {
        const k = el * NAZ + az; if (ear[k] || !(hi[k] - lo[k] > 0.006)) continue;
        // только у края маски под бывшими волосами (3.5 см ниже линии роста волос и выше, не ближе 3 ячеек к бровям): глаза, нос и брови не трогаем
        const eA = (el + 0.5) / NEL * PI - PI / 2, aA = (az + 0.5) / NAZ * 2 * PI - PI;
        if (CH[1] + hi[k] * Math.sin(eA) < hairline(aA) - 0.035 || featD[k]) continue;
        for (let de = -2; de <= 2; de++) { const e2 = el + de; if (e2 < 0 || e2 >= NEL) continue; for (let da = -2; da <= 2; da++) { const k2 = e2 * NAZ + (az + da + NAZ) % NAZ; if (!featD[k2]) fold[k2] = 1; } }
      }
      FR = { st, lo, hi, hd, ins, inS, ear, fold, fc: fcS, fn, has };
      return FR;
    }
    // точка шапочки: под кожей (лицо ниже линии роста волос), поверх края лица — или по профилю черепа
    function capPoint(th, y, fr) {
      const R = ringAt(y), p = basePt(th, R), d = dirOf(p[0], p[1], p[2]), k = binK(d[0], d[1]);
      const r0 = d[2], hl = hairline(th), tIn = fr.ins[k] && !fr.fold[k] ? (1 - sst(hl - 0.022, hl - 0.004, y)) * sst(0.5, 0.85, fr.inS[k]) : 0;
      const rOut = Math.max(r0, fr.hd[k]), rIn = fr.ins[k] ? Math.min(r0, fr.lo[k] - 0.005) : r0;
      // у уха шапочка всегда ныряет под кожу (ухо и его корень снаружи)
      const tq = fr.ear[k] && fr.hi[k] > 0 ? 1 : tIn;
      const r = tq === 1 && fr.ear[k] ? Math.min(r0, fr.lo[k] - 0.006) : lerp(rOut, rIn, tq), inside = tq > 0.5, f = r / r0;
      return { p: [CH[0] + (p[0] - CH[0]) * f, CH[1] + (p[1] - CH[1]) * f, CH[2] + (p[2] - CH[2]) * f], inside };
    }
    // волосы модели, которые входят в треугольники лица (край маски), — к коже этих треугольников: не торчат сквозь шапочку
    const tuck = ctx => {
      const { st, p, zn, moved } = ctx, I0 = st.I0, hz = new Uint8Array(32);
      [Z.hair_skull, Z.hair_back, Z.beret, Z.bow].forEach(z => { hz[z] = 1; });
      for (let t = 0; t < st.nt; t++) {
        if (!st.prot[st.tz[t]]) continue;
        const v = [I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]], sk = v.filter(i => !hz[zn[i]]);
        if (sk.length === 3 || !sk.length) continue;
        let x = 0, y = 0, z = 0;
        sk.forEach(i => { x += st.P0[i * 3]; y += st.P0[i * 3 + 1]; z += st.P0[i * 3 + 2]; });
        x /= sk.length; y /= sk.length; z /= sk.length;
        v.forEach(i => { if (!hz[zn[i]]) return; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; moved[i] = 1; });
      }
    };
    // текстура шапочки (атлас одежды, v 0.5..0.97), рисуется после поправки света: выше линии роста — волосы (пряди
    // сходятся к пучку, пробор посередине, мягкий блик), ниже — кожа модели (виски и край лба без маски лица)
    const UV0 = 0.97, UVH = 0.47;
    const capV = y => UV0 - UVH * (Y0 - y) / (Y0 - Y1);
    const skTmp = [0, 0, 0];
    // цвет кожи лица по направлению из CH — билинейно по растру (без ступенек ячеек)
    function faceCol(x, y, z, o) {
      const d = dirOf(x, y, z), fa = (d[0] + PI) / (2 * PI) * NAZ - 0.5, fe = clamp((d[1] + PI / 2) / PI * NEL - 0.5, 0, NEL - 1.001);
      const a0 = Math.floor(fa), e0 = Math.floor(fe), ka = fa - a0, ke = fe - e0;
      let wsum = 0; o[0] = o[1] = o[2] = 0;
      for (const [da, de, wt] of [[0, 0, (1 - ka) * (1 - ke)], [1, 0, ka * (1 - ke)], [0, 1, (1 - ka) * ke], [1, 1, ka * ke]]) {
        const k = (e0 + de) * NAZ + (((a0 + da) % NAZ) + NAZ) % NAZ;
        if (!FR.has[k] || wt <= 0) continue;
        wsum += wt; for (let q = 0; q < 3; q++) o[q] += FR.fc[k * 3 + q] * wt;
      }
      if (wsum <= 0) return null;
      for (let q = 0; q < 3; q++) o[q] /= wsum;
      return o;
    }
    const texPost = (c, S) => {
      const y0p = Math.floor((1 - UV0) * S), y1p = Math.ceil((1 - (UV0 - UVH)) * S), im = c.getImageData(0, y0p, S, y1p - y0p), d = im.data;
      const F = [0, 1.75, 0.1], Bn = [0, 1.43, -0.25], ax = [Bn[0] - F[0], Bn[1] - F[1], Bn[2] - F[2]], al = Math.hypot(ax[0], ax[1], ax[2]);
      ax[0] /= al; ax[1] /= al; ax[2] /= al;
      const up = [-ax[0] * ax[1], 1 - ax[1] * ax[1], -ax[2] * ax[1]], ul = Math.hypot(up[0], up[1], up[2]);
      up[0] /= ul; up[1] /= ul; up[2] /= ul;
      const base = mix3(HD, HB, 0.8), dy = (Y0 - Y1) / UVH / S;
      for (let py = y0p; py < y1p; py++) for (let px = 0; px < S; px++) {
        const v = 1 - (py + 0.5) / S, u = (px + 0.5) / S, th = u * 2 * PI, y = Y0 - (UV0 - v) / UVH * (Y0 - Y1);
        const q = basePt(th, ringAt(clamp(y, Y1, Y0))), w = [q[0] - F[0], q[1] - F[1], q[2] - F[2]], along = w[0] * ax[0] + w[1] * ax[1] + w[2] * ax[2];
        const wx = w[0] - ax[0] * along, wy = w[1] - ax[1] * along, wz = w[2] - ax[2] * along;
        const phi = Math.atan2(wx, wy * up[1] + wz * up[2]);
        const s2 = 0.55 * Math.sin(phi * 46 + Math.sin(phi * 7) * 0.8) + 0.45 * Math.sin(phi * 19 + 1.3);
        let k = 0.9 + 0.075 * s2;
        if (Math.abs(phi) < 0.035 && along < 0.2) k *= 0.62 + 0.38 * Math.abs(phi) / 0.035;
        k += 0.16 * Math.exp(-Math.pow((Math.abs(phi) - 0.75) / 0.18, 2)) * sst(0.32, 0.12, along);
        // линия роста волос: мягкий край в 1.5 пикселя
        const hk = clamp((y - hairline(th)) / (dy * 1.5) + 0.5, 0, 1);
        const j = ((py - y0p) * S + px) * 4;
        // кожа — цвет лица под этим местом (разлитый на дыры маски), а не одна плоская заливка
        let sk = SKIN;
        if (FR && hk < 1 && faceCol(q[0], q[1], q[2], skTmp)) sk = skTmp;
        for (let ch = 0; ch < 3; ch++) d[j + ch] = clamp(lerp(sk[ch], base[ch] * k, hk), 0, 255);
        d[j + 3] = 255;
      }
      c.putImageData(im, 0, y0p);
    };
    function capGeo(B) {
      const st = LASTST;
      if (!st) return;
      const fr = faceRaster(st), SEG = 28, NR = PROF.length, w = W1('head'), base = B.p.length / 3, P = [], IN = [], SK = [];
      B.part = 1;
      for (let r = 0; r < NR; r++) for (let s = 0; s <= SEG; s++) { const q = capPoint(s / SEG * 2 * PI, PROF[r][0], fr); P.push(q.p); IN.push(q.inside ? 1 : 0); }
      const at = (r, s) => P[clamp(r, 0, NR - 1) * (SEG + 1) + ((s % SEG) + SEG) % SEG];
      for (let r = 0; r < NR; r++) for (let s = 0; s <= SEG; s++) {
        const p = P[r * (SEG + 1) + s], a1 = at(r, s + 1), a0 = at(r, s - 1), b1 = at(r + 1, s), b0 = at(r - 1, s);
        const tx = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], ty = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
        let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
        const o = [p[0] - CH[0], p[1] - CH[1] + 0.05, p[2] - CH[2]];
        if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) n = n.map(v => -v);
        const nl = Math.hypot(n[0], n[1], n[2]) || 1;
        if (r === 0) n = [0, 1, 0];
        let nv = r === 0 ? n : [n[0] / nl, n[1] / nl, n[2] / nl];
        // ниже линии роста волос нормаль — как у лица под этим местом: кожа шапочки освещена так же, как лицо
        const th = s / SEG * 2 * PI, ks = sst(hairline(th) - 0.002, hairline(th) - 0.014, PROF[r][0]);
        if (ks > 0) { const dq = dirOf(p[0], p[1], p[2]), kk = binK(dq[0], dq[1]); if (fr.has[kk]) { const f3 = fr.fn.subarray(kk * 3, kk * 3 + 3), fl = Math.hypot(f3[0], f3[1], f3[2]) || 1; nv = [lerp(nv[0], f3[0] / fl, ks), lerp(nv[1], f3[1] / fl, ks), lerp(nv[2], f3[2] / fl, ks)]; const l2 = Math.hypot(nv[0], nv[1], nv[2]) || 1; nv = nv.map(q => q / l2); } }
        SK.push(PROF[r][0] < hairline(th) - 0.003 ? 1 : 0);
        B.v(p, nv, [255, 255, 255], w, [s / SEG, capV(PROF[r][0])], 0);
      }
      for (let r = 0; r < NR - 1; r++) for (let s = 0; s < SEG; s++) {
        const i00 = r * (SEG + 1) + s, i01 = i00 + 1, i10 = i00 + SEG + 1, i11 = i10 + 1;
        // спрятанное под лицом и низ спереди (под подбородком — шея и лицо модели) — не строим
        if (IN[i00] && IN[i01] && IN[i10] && IN[i11]) continue;
        const thm = fold((s + 0.5) / SEG * 2 * PI);
        if (PROF[r + 1][0] < 1.43 && thm < 1.2) continue;
        // кожа (виски, край лба) — без контура: стык с лицом не обводится линией
        const o1 = !(SK[i00] && SK[i10] && SK[i01]), o2 = !(SK[i01] && SK[i10] && SK[i11]);
        B.tri(base + i00, base + i10, base + i01, o1); B.tri(base + i01, base + i10, base + i11, o2);
      }
      B.part = 0;
    }
    const wool = (x, y, z, o) => { o.k = 0.1; o.lo = 0.72; o.hi = 1.15; return y < 0.665 ? mix3(IV, IVD, 0.25, out) : IV; };
    // топ и две тонкие цепочки дугами на коже в вырезе (короткая и длиннее с подвеской), пуговица у талии на левой поле
    const top = (x, y, z, o) => { o.flat = 1; return TOPW; };
    const chains = (x, y) => {
      const c1 = 1.232 + 2.5 * x * x, c2 = 1.205 + 3.2 * x * x;
      if (Math.abs(y - c1) < 0.0018 || Math.abs(y - c2) < 0.0018) return GOLD;
      if (Math.hypot(x, y - 1.197) < 0.0048) return GOLDL;
      return null;
    };
    const J5 = jacket({ main: (x, y, z, o) => {
      // пуговица у талии
      if (z > 0.06 && Math.hypot(x - (openAt(0.95)[0] - 0.016), y - 0.95) < 0.009) { o.k = 0.2; return mix3(IVD, IV, 0.3, out); }
      return wool(x, y, z, o);
    }, top, bottom: (x, y, z, o) => { o.k = 0.25; return TR; }, neckY: 1.19, w: 1.1, edge: '#FBF8F0' });
    // цепочки — только в вырезе (кожа и топ между бортами), не по лацканам
    const coat = (x, y, z, o) => {
      if (z > 0.03 && y > 1.185 && y < 1.26) { const q = openAt(y, { w: 1.1 }); if (x > q[0] + 0.003 && x < q[1] - 0.003) { const c = chains(x, y); if (c) { o.k = 0.1; return c; } } }
      return J5(x, y, z, o);
    };
    const sleeve = (x, y, z, o) => {
      // тонкий золотой браслет на правом запястье
      if (x < -0.18 && y > 0.795 && y < 0.81) { o.k = 0.1; return GOLD; }
      return wool(x, y, z, o);
    };
    const neck = (x, y, z, o) => { const c = z > 0.0 && y < 1.27 ? chains(x, y) : null; if (c) { o.k = 0.1; return c; } return null; };
    // подплечники: плечо шире на 1.5 см
    const shoulders = ctx => {
      const { st, p, zn, moved, P0 } = ctx;
      for (let i = 0; i < st.n; i++) {
        const z0 = zn[i];
        if (z0 !== Z.sleeve && z0 !== Z.coat_torso && z0 !== Z.collar) continue;
        const x = P0[i * 3], y = P0[i * 3 + 1];
        if (Math.abs(x) < 0.1 || y < 1.1) continue;
        const k = sst(1.1, 1.22, y) * sst(0.1, 0.17, Math.abs(x));
        p[i * 3] = x + Math.sign(x) * 0.015 * k; p[i * 3 + 1] = y + 0.006 * k; moved[i] = 1;
      }
    };
    const BAG = ['#E6DCCB', '#D4C7B1', '#F5EFE4'];
    LOOKS.cream = {
      hem: 0.65, hair: H, top: 1.808, keep: 0.3, hatW: -0.03, texPost,
      morph: [tuck, hemTo(0.65), flatten(['belt', 'cuff']), smoothFront({ y0: 0.6, y1: 1.1, x: 0.16, both: true, keepTop: 0.025 }), shoulders],
      // волосы модели — целиком прочь: причёска — шапочка и пучок в одежде
      hide: hideWith(['hair_skull', 'hair_back', 'beret', 'bow', 'legs']),
      paint: {
        coat_torso: coat, coat_skirt: J5, collar: coat, belt: J5, buttons: J5,
        sleeve, cuff: sleeve, neck,
        shoes: (x, y, z, o) => { o.k = 0.2; return tc('#EFE6DA'); },
      },
      garment: B => {
        capGeo(B);
        trousers(B, { col: '#EDE5D6', light: '#FAF6EE', dark: '#D0C4AE', top: 0.86, wide: 0.118, rings: 11, seg: 12 });
        // низкий гладкий пучок у затылка (наполовину в шапочке), пряди закручены
        const hw = W1('head');
        B.part = 1;
        B.blob([0, 1.43, -0.236], [0.068, 0.058, 0.055], (n, p, u, v) => { const s = 0.84 + 0.1 * Math.sin(u * PI * 2 * 5 + v * 6) + 0.1 * Math.max(0, n[1]); return [HB[0] * s, HB[1] * s, HB[2] * s]; }, hw, 12, 8);
        B.part = 0;
        // золотые серьги-«купола»
        earrings(B, { y: 1.47, x: 0.198, z: -0.008, make: (B2, c, s, w) => B2.blob(c, [0.017, 0.02, 0.014], (n) => mix3(GOLD, GOLDL, Math.max(0, n[1] * 0.5 + n[2] * 0.6)), w, 8, 6) });
        // сумка-трапеция: светлый камень, тонкий кант только по рёбрам, две ручки, золотая фурнитура сбоку
        bagOnForearm(B, {
          col: BAG[0], strap: '#E6DCCB', strapT: 0.42, size: [0.075, 0.13, 0.17], dx: 0.062, drop: 0.12, handles: false,
          body: bagBox([0.075, 0.13, 0.17], BAG, { sq: 6, pipe: '#B9A688', pipeRings: false, shade: 0.4, prof: t => [lerp(1, 0.85, t), lerp(1, 0.78, t)], handles: [0.06, 0.0055], handleZ: [-0.01, 0.01], handleCol: '#D9CCB6', extra: (B2, c, w) => {
            B2.blob([c[0] + 0.036, c[1] + 0.02, c[2]], [0.004, 0.01, 0.012], tc('#C9A45C'), w, 6, 4);
          } }),
        });
      },
    };
  }
  /* ---------- 6. «Звезда вечера»: платье-«русалка» без бретелей с крупными сливовыми цветами, белая накидка до пола, локоны ---------- */
  {
    const H = { base: '#1E140F', dark: '#120B07', light: '#4A362A', part: 0.06, keep: 0.6, gloss: 0.3 };
    const HP = hairPaint(H);
    const IVO = tc('#EFE7DE'), IVOD = tc('#D2C6B8'), CAPE = tc('#F4EFE8'), CAPED = tc('#D8CCBE');
    const PET = tc('#5A2440'), PETD = tc('#3A1428'), PETL = tc('#7E3A5E'), TIP = tc('#B98AA6');
    const CEN = tc('#E6E0CC'), SEP = tc('#B9B48E'), LEAF = tc('#7F8E52'), LEAFD = tc('#556B35'), VEIN = tc('#B7B2B5');
    const out = [0, 0, 0], t1 = [0, 0, 0];
    // цветок: веер лепестков с тёмными прожилками, светлые кончики, кремовая звёздочка в середине
    const flower = (u, v, cu, cv, R, rot) => {
      const du = u - cu, dv = v - cv, r = Math.hypot(du, dv), a = Math.atan2(dv, du) + (rot || 0);
      const pet = 0.5 + 0.5 * Math.cos(a * 7), rr = R * (0.72 + 0.28 * pet) * (0.85 + 0.15 * Math.cos(a * 2));
      if (r > rr) return null;
      if (r < R * 0.16) { const st = 0.5 + 0.5 * Math.cos(a * 5); return r < R * (0.08 + 0.06 * st) ? CEN : SEP; }
      const k = r / rr, line = Math.pow(Math.abs(Math.sin(a * 14)), 18);
      mix3(PET, PETL, (1 - k) * 0.35 * (0.5 + 0.5 * Math.sin(a * 7)), t1);
      mix3(t1, PETD, line * 0.55 + sst(0.3, 0, k) * 0.2, t1);
      if (k > 0.86) mix3(t1, TIP, (k - 0.86) / 0.14 * 0.7, t1);
      // блёстки
      if ((Math.sin(u * 1913 + v * 777) > 0.995)) mix3(t1, [255, 255, 255], 0.6, t1);
      return t1;
    };
    // пион: три яруса круглых лепестков (внешний 9, средний 7, внутренний 5), тень к основанию, светлые кончики,
    // тёмная кромка между лепестками; R — радиус, (cu, cv) — центр (метры по ткани), sx/sy — масштаб осей
    const peony = (u, v, cu, cv, R, sx, sy) => {
      const du = (u - cu) / (sx || 1), dv = (v - cv) / (sy || 1), r = Math.hypot(du, dv), a = Math.atan2(dv, du);
      if (r > R * 1.02) return null;
      const tiers = [[0.42, 5, 0.9], [0.7, 7, 0.35], [1.0, 9, 0.0]];
      for (let q = 0; q < 3; q++) {
        const [kR, nP, ph] = tiers[q], f = (((a + ph) * nP / (2 * PI)) % 1 + 1) % 1, e = 2 * f - 1;
        const rr = R * kR * (0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - e * e)));
        if (r > rr) continue;
        if (q === 0 && r < R * 0.12) return r < R * 0.06 ? CEN : SEP;
        const t = r / rr, inner = q === 0 ? 0.2 : 0;
        mix3(PETD, PET, clamp(0.25 + t * 0.9 - inner, 0, 1), t1);
        if (t > 0.8) mix3(t1, TIP, (t - 0.8) / 0.2 * 0.55, t1);
        if (Math.abs(e) > 0.86) mix3(t1, PETD, 0.6, t1);
        if (Math.sin(u * 1913 + v * 777) > 0.996) mix3(t1, [255, 255, 255], 0.5, t1);
        return t1;
      }
      return null;
    };
    // травинки шалфея: длинные узкие листья с S-изгибом и тёмной серединкой (по ткани лифа)
    const blade = (x, y, x0, y0, len, w, bend) => {
      const t = (y - y0) / len; if (t < 0 || t > 1) return null;
      const cx = x0 + bend * Math.sin(t * PI * 1.6), hw = w * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)), d = Math.abs(x - cx);
      if (d > hw) return null;
      return d < hw * 0.22 ? LEAFD : LEAF;
    };
    // лиф: верх 1.20 с бисерной кромкой, выше — кожа (и «окошко» под воротником-стойкой); плечи и спина — накидка
    const bodice = (x, y, z, o) => {
      const front = z > 0.0;
      // выше лифа — голые плечи и грудь ровной кожей (стойку и накидку на плечах даёт одежда)
      if (y > 1.205) { o.f = 1; return SKIN; }
      if (!front || Math.abs(x) > 0.135) {
        if (y > 0.98 || !front) { o.k = 0.35; o.lo = 0.65; return CAPE; }
      }
      if (y > 1.192) { o.k = 0.2; const b = Math.sin(x * 900) > 0.2 ? 1 : 0; return b ? mix3(IVO, [255, 255, 255], 0.5, out) : IVOD; }
      o.k = 0.1; o.lo = 0.7; o.hi = 1.15;
      // цветок 1 — на лифе, в середине; лист с прожилкой — наискосок к её правому боку
      // крупный пион почти во весь лиф (Ø 22 см), лепестки уходят к её правому бедру (на юбке — узор атласа)
      const f = peony(x, y, 0.01, 1.07, 0.11);
      if (f) return f;
      const f2 = peony(x, y, -0.05, 0.95, 0.075);
      if (f2) return f2;
      const b = blade(x, y, 0.085, 0.975, 0.2, 0.015, 0.012) || blade(x, y, 0.11, 0.985, 0.17, 0.014, -0.01);
      if (b) return b;
      // фон: айвори с серебристыми прожилками и блёстками
      mix3(IVO, VEIN, Math.pow(Math.abs(Math.sin(x * 70 + y * 25)), 40) * 0.6, out);
      return out;
    };
    // голые руки (рукава тренча — кожа и тоньше), плечо — край накидки
    const arms = (x, y, z, o) => {
      if (y > 1.17 && z < 0.02) { o.k = 0.35; return CAPE; }
      // голые руки — ровная кожа (хлястики манжет тренча не читаются браслетами)
      o.f = 1; return SKIN;
    };
    const slim = sleeveShape((t) => (t < -0.75 ? 1 : 0.76 + 0.04 * clamp(-t, 0, 1)), ['sleeve', 'cuff']);
    // голливудские локоны: крупные S-волны с шагом 9 см (фаза по высоте и азимуту), объём к низу, ниже плеч шире ×1.12
    const CC = [0, 1.5, -0.093];
    const wavePh = (y, az) => (1.45 - y) * 2 * PI / 0.09 + 2 * az;
    const curls = ctx => {
      const { st, p, zn, moved } = ctx, C = CC;
      for (let i = 0; i < st.n; i++) {
        const z0 = zn[i];
        if (z0 !== Z.hair_skull && z0 !== Z.hair_back) continue;
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        if (y > 1.62) continue;
        const az = Math.atan2(x - C[0], z - C[2]);
        const low = clamp((1.58 - y) / 0.55, 0, 1);
        const wave = z0 === Z.hair_back ? 0.022 * Math.sin(wavePh(y, az)) * sst(1.45, 1.2, y) : 0;
        const push = 0.006 + 0.03 * low + wave;
        const ox = x - C[0], oz = z - C[2], ol = Math.hypot(ox, oz) || 1;
        // лицо открыто: спереди у щёк объём наружу вбок, а не к лицу
        const fr = oz > 0.05 && Math.abs(ox) < 0.2 ? 0.4 : 1;
        let nx = x + (ox / ol) * push * fr, nz = z + (oz / ol) * push * 0.7 * fr;
        // ниже плеч — шире
        if (y < 1.3) nx = C[0] + (nx - C[0]) * (1 + 0.12 * sst(1.3, 1.15, y));
        p[i * 3] = nx; p[i * 3 + 2] = nz; p[i * 3 + 1] = y - (0.006 + 0.03 * low) * 0.15;
        moved[i] = 1;
      }
    };
    // блеск локонов: светлые дуги по гребням волн (#4A362A по #1E140F)
    const GLO = tc('#4A362A');
    const hairGloss = (x, y, z, o) => {
      const c = HP.hair(x, y, z, o);
      if (!c || y > 1.47) return c;
      const az = Math.atan2(x - CC[0], z - CC[2]), s2 = Math.sin(wavePh(y, az) + 0.6 + 0.9 * Math.sin(az * 7)), g = Math.pow(Math.max(0, s2), 14) * sst(1.47, 1.3, y) * 0.38;
      return g > 0.01 ? mix3(c, GLO, g, t1) : c;
    };
    // узор юбки (атлас одежды, левая половина 0..0.5 по u): айвори, листья-ланцеты с прожилкой, серебро, цветок 2 на правом бедре
    const tex = (c, S) => {
      const W2 = S / 2;
      c.fillStyle = '#EFE7DE'; c.fillRect(0, 0, W2, S);
      // серебристые прожилки и блёстки
      c.strokeStyle = 'rgba(183,178,181,0.5)'; c.lineWidth = 1;
      for (let i = 0; i < 60; i++) { const x0 = (i * 37) % W2, y0 = (i * 53) % S; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 6, y0 + 30, x0 - 4, y0 + 60); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 260; i++) { const x0 = (i * 97) % W2, y0 = (i * 61 + (i * i) % 41) % S; c.fillRect(x0, y0, 1.5, 1.5); }
      // масштаб атласа юбки: по u — окружность (~4.2 мм/пиксель у бедра), по v — высота (~1.94 мм/пиксель)
      const KX = 1 / 0.0042, KY = 1 / 0.00194, U0 = W2 * 0.5, at = (a, y) => [U0 + a / (2 * PI) * W2, (1.0 - y) / 0.994 * S];
      // травинки шалфея: длинные узкие листья (15–25 см, 1.5 см) почти вертикально с S-изгибом и тёмной серединкой
      const bladeC = (a, yb, len, bend) => {
        const [x0, y0] = at(a, yb), L = len * KY, wpx = 0.015 * KX;
        c.save(); c.translate(x0, y0);
        c.fillStyle = '#7F8E52'; c.beginPath(); c.moveTo(0, 0);
        c.bezierCurveTo(bend * KX * 0.02 + wpx, -L * 0.35, -bend * KX * 0.02 + wpx * 0.6, -L * 0.7, bend * KX * 0.01, -L);
        c.bezierCurveTo(-bend * KX * 0.02 - wpx * 0.6, -L * 0.7, bend * KX * 0.02 - wpx, -L * 0.35, 0, 0); c.fill();
        c.strokeStyle = '#556B35'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(bend * KX * 0.02, -L * 0.35, -bend * KX * 0.02, -L * 0.7, bend * KX * 0.01, -L); c.stroke();
        c.restore();
      };
      [[-0.75, 0.62, 0.22, 1], [-0.45, 0.5, 0.25, -1], [-0.2, 0.7, 0.18, 1], [0.05, 0.42, 0.24, -1], [0.3, 0.6, 0.2, 1], [0.55, 0.48, 0.23, -1], [0.85, 0.66, 0.19, 1],
        [-1.1, 0.4, 0.2, -1], [1.15, 0.38, 0.21, 1], [-0.05, 0.2, 0.2, 1], [0.6, 0.18, 0.17, -1], [-0.6, 0.22, 0.18, 1]].forEach(([a, yb, len, bd]) => bladeC(a, yb, len, bd));
      // пион 2 — продолжение цветка лифа к её правому бедру (−0.05, 0.86): ярусы лепестков эллипсами в масштабе атласа
      const peonyC = (a, y, R) => {
        const [cx, cy] = at(a, y);
        [[1.0, 9, 0], [0.7, 7, 0.35], [0.42, 5, 0.9]].forEach(([kR, nP, ph]) => {
          for (let k = 0; k < nP; k++) {
            const ang = ph + k / nP * 2 * PI, pr = R * kR * 0.62;
            const px = cx + Math.cos(ang) * pr * KX, py = cy - Math.sin(ang) * pr * KY;
            c.fillStyle = k % 2 ? '#5A2440' : '#4E1E38';
            c.beginPath(); c.ellipse(px, py, R * kR * 0.42 * KX, R * kR * 0.36 * KY, -ang, 0, PI * 2); c.fill();
            c.fillStyle = 'rgba(185,138,166,0.75)';
            c.beginPath(); c.ellipse(cx + Math.cos(ang) * R * kR * 0.95 * KX, cy - Math.sin(ang) * R * kR * 0.95 * KY, R * 0.07 * KX, R * 0.05 * KY, -ang, 0, PI * 2); c.fill();
          }
        });
        c.fillStyle = '#B9B48E'; c.beginPath(); c.ellipse(cx, cy, R * 0.12 * KX, R * 0.12 * KY, 0, 0, PI * 2); c.fill();
        c.fillStyle = '#E6E0CC'; c.beginPath(); c.ellipse(cx, cy, R * 0.06 * KX, R * 0.06 * KY, 0, 0, PI * 2); c.fill();
      };
      peonyC(-0.3, 0.88, 0.085);
      peonyC(-0.05, 0.99, 0.06);
      // веточка шалфея и сливовый бутон на стойке (полоса стойки: u 0.5..0.96, v 0.96..0.88), её правая сторона спереди
      c.fillStyle = '#F4EFE8'; c.fillRect(S * 0.5, S * 0.03, S * 0.47, S * 0.1);
      const sx = S * 0.916, sy = S * 0.115;
      c.strokeStyle = '#7F8E52'; c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx - 6, sy); c.quadraticCurveTo(sx - 1, sy - 12, sx + 5, sy - 26); c.stroke();
      [[-4, -5, -1], [-1, -11, 1], [1, -16, -1], [3, -21, 1]].forEach(([dx, dy, sd]) => { c.beginPath(); c.moveTo(sx + dx, sy + dy); c.quadraticCurveTo(sx + dx + sd * 5, sy + dy - 2, sx + dx + sd * 7, sy + dy - 6); c.stroke(); });
      c.fillStyle = '#5A2440'; c.beginPath(); c.ellipse(sx + 5, sy - 28, 2.6, 3.4, 0.3, 0, PI * 2); c.fill();
      c.fillStyle = '#B98AA6'; c.beginPath(); c.arc(sx + 5.6, sy - 29.5, 1, 0, PI * 2); c.fill();
      leaf(W2 * 0.36, S * 0.34, 90, 0.5, 10); leaf(W2 * 0.47, S * 0.33, 80, -0.2, 9);
    };
    const skirtCol = (p, a, t) => {
      const f = Math.sin(a * 9) * 0.5 + 0.5;
      return mix3([255, 255, 255], [222, 216, 210], f * 0.25 * (0.3 + t) + (Math.cos(a) < -0.3 ? 0.08 : 0));
    };
    LOOKS.floral = {
      hem: 0.02, hair: H, top: 1.855, keep: 0.3, sitTuck: 0.5, tex,
      morph: [crown({ top: 1.855, vol: 0.016 }), curls, flatten(['belt', 'buttons', 'cuff']), smoothFront({ y0: 0.96, y1: 1.29, both: true, keepTop: 0.05, fins: true }), iron({ y0: 1.12, y1: 1.36, c: 0.02 }), finsHide(), slim],
      // полы тренча ниже талии — под юбкой «русалки» (иначе выглядывает баска)
      // ноги и туфли (телесные) не прячем: в машине и на велосипеде подол подобран
      // уступы ворота и лацканов тренча — под «пластиной» кожи, стойкой и пелериной одежды
      hide: hideWith(['coat_skirt'], (i, z, x, y) => ((z === Z.coat_torso || z === Z.belt || z === Z.buttons) && y < 0.975) || (z === Z.legs && y > 0.36)),
      paint: {
        hair_skull: HP.hair, hair_back: hairGloss, beret: HP.strands, bow: HP.strands,
        coat_torso: bodice, collar: bodice, belt: bodice, buttons: bodice,
        sleeve: arms, cuff: arms,
        neck: (x, y, z, o) => (y > 1.27 && y < 1.325 ? (o.k = 0.35, CAPE) : null),
        legs: (x, y, z, o) => { o.f = 1; return SKIN; },
        shoes: (x, y, z, o) => { if (y > 0.06) { o.f = 1; return SKIN; } o.k = 0.3; o.lo = 0.75; return tc('#D9B79A'); },
      },
      garment: B => {
        // русалка: облегает до колена, ниже — раструб в пол, сзади шлейф
        longSkirt(B, {
          top: 1.0, hem: 0.006, folds: 9, fold: 0.025, rings: 18, seg: 32,
          prof: (y, t) => {
            if (y > 0.8) { const k = (1.0 - y) / 0.2; return { cz: 0.018, rx: lerp(0.122, 0.19, Math.sqrt(k)), rz: lerp(0.104, 0.142, Math.sqrt(k)), fk: 0 }; }
            if (y > 0.45) { const k = (0.8 - y) / 0.35; return { cz: lerp(0.018, 0.0, k), rx: lerp(0.19, 0.125, k), rz: lerp(0.142, 0.108, k), fk: 0.1 }; }
            // русалка: от колена раструб — спереди 0.24, сзади 0.31 (шлейф)
            const k = (0.45 - y) / 0.444, e = Math.pow(k, 1.35);
            return { cz: lerp(0.0, -0.035, e), rx: lerp(0.125, 0.27, e), rz: lerp(0.108, 0.275, e), fk: k };
          },
          col: skirtCol, uv: (p, a, t) => [(a + PI) / (PI * 2) * 0.5, 1 - t], a0: -PI, a1: PI, shinK: 0.9, thighK: 0.7, backShin: 0.5,
        });
        // накидка: от плеч за руками до пола (спереди открыта), сзади шлейф; верх — на груди, низ — за тазом и бёдрами
        const NR = 14, rings = [];
        for (let r = 0; r < NR; r++) {
          // верх панелей — под краем кокетки на плечах, дальше почти отвесно за руками (без «полки»)
          const t = r / (NR - 1), y = lerp(1.2, 0.006, t);
          rings.push({ c: [0, y, lerp(-0.02, -0.11, t * t)], rx: lerp(0.224, 0.38, Math.pow(t, 1.1)), rz: lerp(0.142, 0.33, Math.pow(t, 0.9)), off: a => 0.026 * sst(0.15, 1, t) * Math.cos(a * 7) });
        }
        const capeV = (ri, si, p, a) => {
          const t = ri / (NR - 1);
          const w = t < 0.14 ? mixW('chest', 'neck', 0.3 * (1 - t / 0.14)) : [['chest', Math.max(0, 1 - t * 2.2) + 1e-4], ['spine', Math.max(0, 0.6 - Math.abs(t - 0.35) * 2)], ['hips', clamp(t * 1.6 - 0.3, 0, 1)]];
          // складки: светлые гребни и тени в ложбинах
          const k = 0.92 + 0.08 * Math.cos(a * 7) * sst(0.1, 0.6, t) - 0.04 * t;
          return { col: [CAPE[0] * k, CAPE[1] * k, CAPE[2] * k], w, tk: sst(0.4, 1, t) };
        };
        B.tube(rings, 22, capeV, { a0: PI * 0.62, a1: PI * 1.38 });
        // изнанка накидки — двусторонний материал одежды (темнее)
        // накидка-пелерина на плечах: от низа стойки ложится по плечам (огибающая тренча + 4 мм), спереди открыта
        // вырезом «V» (у стойки уже, к лифу шире); переходит в панели накидки за руками. Под казом прячется (часть 1).
        // Кольцо — дуга со своим раствором: rings[r] = [y, полураствор выреза спереди]
        const limY = coatLimit(LASTST, -0.004, ['coat_torso', 'sleeve', 'collar'], 0.01, true);
        const arcSheet = (rings, seg, rad, vf, ol) => {
          const base = B.p.length / 3, nr = rings.length, P2 = [];
          rings.forEach(([y, h], ri) => { for (let si = 0; si <= seg; si++) { const a = h + (2 * PI - 2 * h) * si / seg, r = rad(a, y, ri); P2.push([Math.sin(a) * r, y, -0.012 + Math.cos(a) * r, a]); } });
          for (let ri = 0; ri < nr; ri++) for (let si = 0; si <= seg; si++) {
            const q = P2[ri * (seg + 1) + si], up = P2[Math.max(0, ri - 1) * (seg + 1) + si], dn = P2[Math.min(nr - 1, ri + 1) * (seg + 1) + si];
            const lf = P2[ri * (seg + 1) + Math.max(0, si - 1)], rt = P2[ri * (seg + 1) + Math.min(seg, si + 1)];
            const tx = [rt[0] - lf[0], rt[1] - lf[1], rt[2] - lf[2]], ty = [up[0] - dn[0], up[1] - dn[1], up[2] - dn[2]];
            let nv = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
            if (nv[0] * q[0] + nv[2] * (q[2] + 0.012) < 0) nv = nv.map(v => -v);
            const nl = Math.hypot(nv[0], nv[1], nv[2]) || 1, vv = vf(ri, si, q, q[3]);
            B.v([q[0], q[1], q[2]], [nv[0] / nl, nv[1] / nl, nv[2] / nl], vv.col, vv.w);
          }
          for (let ri = 0; ri < nr - 1; ri++) for (let si = 0; si < seg; si++) { const i0 = base + ri * (seg + 1) + si, i1 = i0 + 1, j0 = i0 + seg + 1, j1 = j0 + 1; B.tri(i0, j0, i1, ol); B.tri(i1, j0, j1, ol); }
        };
        const CAPR = [[1.258, 0.42], [1.246, 0.46], [1.232, 0.52], [1.214, 0.6], [1.192, 0.7], [1.168, 0.82], [1.145, 0.9]];
        B.part = 1;
        arcSheet(CAPR, 26, (a, y, ri) => {
          const hug = limY ? limY(Math.sin(a) * 0.1, y, Math.cos(a) * 0.1 - 0.012) : 0.2;
          return ri === 0 ? 0.093 : Math.min(0.27, Math.max(0.095, hug));
        }, (ri, si, q, a) => { const k = 0.95 + 0.05 * Math.cos(a * 9) * (ri / 6); return { col: [CAPE[0] * k, CAPE[1] * k, CAPE[2] * k], w: ri === 0 ? mixW('chest', 'neck', 0.5) : ri > 4 && Math.abs(q[0]) > 0.16 ? mixW('chest', q[0] > 0 ? 'upperarm_L' : 'upperarm_R', 0.3) : W1('chest') }; }, true);
        B.part = 0;
        // воротник-стойка: ровный цилиндр 1.255–1.335 поверх шеи (закрывает место воротника тренча), веточка шалфея и
        // сливовый бутон — узором атласа на её правой стороне
        const cr = [[1.336, 0.057, 0.055], [1.31, 0.061, 0.058], [1.28, 0.07, 0.066], [1.25, 0.096, 0.09]].map(([y, rx, rz]) => ({ c: [0, y, -0.012], rx, rz }));
        B.tube(cr, 28, (ri, si, p, a) => ({ col: CAPE, w: ri < 2 ? W1('neck') : mixW('neck', 'chest', 0.5), uv: [0.5 + 0.46 * si / 28, 0.96 - 0.08 * ri / 3] }), { capTop: 'noline' });
        // голая грудь в вырезе пелерины: гладкая «пластина» кожи поверх уступов лацканов тренча (огибающая ткани + 3 мм
        // по соседям); низ — под бисерной кромкой, верх сходится к низу стойки, края — под пелериной. Без контура
        const limP = coatLimit(LASTST, -0.003, ['coat_torso', 'collar', 'buttons'], 0.01, true);
        const pl = [];
        for (let r = 0; r < 6; r++) {
          const t = r / 5, y = lerp(1.252, 1.19, t), R = { c: [0, y, -0.012], rx: 0.1, rz: 0.1 };
          R.k = a => { let m = 0; for (let da = -2; da <= 2; da++) for (const yy of [y - 0.012, y, y + 0.012]) { const aa = a + da * 0.07; m = Math.max(m, limP ? limP(Math.sin(aa) * 0.1, yy, Math.cos(aa) * 0.1 - 0.012) : 0.15); } return lerp(Math.min(m, 0.19), 0.097, sst(1.215, 1.252, y)) / 0.1; };
          pl.push(R);
        }
        const ol0 = B.ol.length;
        B.tube(pl, 20, (ri, si, p, a) => ({ col: SKIN, w: ri < 2 ? mixW('chest', 'neck', 0.3) : W1('chest') }), { a0: -PI * 0.3, a1: PI * 0.3 });
        B.ol.length = ol0;
        // бисерная кромка лифа на 1.20: тонкая лента айвори с серебряными точками по форме тренча
        const limB = coatLimit(LASTST, -0.0025, ['coat_torso'], 0.01, true);
        const SIL = tc('#E2DEE4');
        const bead = [1.205, 1.195].map(y => { const R = { c: [0, y, 0], rx: 0.1, rz: 0.1 }; R.k = a => { let m = 0; for (let da = -2; da <= 2; da++) { const aa = a + da * 0.07; m = Math.max(m, limB ? limB(Math.sin(aa) * 0.1, y, Math.cos(aa) * 0.1) : 0.15); } return (Math.min(m, 0.2) + 0.002) / 0.1; }; return R; });
        B.tube(bead, 44, (ri, si) => ({ col: si % 3 ? IVO : SIL, w: W1('chest') }));
        B.part = 0;
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
      st.crownInner = null; st.morphHide = null; st.dome = null; st.ironD = null;
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
    id = IDS.indexOf(id) >= 0 ? id : null;
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
    _core: { prep, ST, Z, M, LOOKS, GEO, stats },
  });
})();
