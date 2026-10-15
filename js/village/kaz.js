/* =====================================================================
   КАЗ — белый праздничный шарф кубачинок (plan2/kubachi_spec2.md §3). Волна 4.
   ВАЖНО (правда о казе): узор и бахрома каза говорят о возрасте и семейном положении (мелкий узор и короткая
   бахрома — девушка; крупный узор — замужняя; бахрома с ОБОИХ концов — невеста, «лумкитаб-каз»). Религиозным
   предметом источники каз не описывают — это местный костюм. Поэтому здесь ТОЛЬКО «девичий» вариант:
   белый, мелкие золотые цветы и пёрышки, короткая бахрома на ОДНОМ (длинном) конце. Героиня каз ПРИМЕРЯЕТ
   (как на фотосессии в национальном костюме), не получает в подарок; уезжая из села — возвращает.

   Обычный <script>: VILLAGE.kaz. Нужен THREE r149. Всё рисуется кодом (canvas), без файлов.

   VILLAGE.kaz.build(THREE, opts) -> kz
     opts.hero    — героиня из buildHeroRig (js/world/actors.js / js/city3d.js): { root, body, rig:{ mesh, anim } };
                    тогда каз ПОДГОНЯЕТСЯ к модели автора: по текстуре и весам кожи находятся волосы, лицо, берет
                    и бант, капюшон обтягивает волосы (+1,2 см), лицо открыто, длинный конец — по спине почти до щиколоток.
                    Сетка — SkinnedMesh на тех же костях героини (+3 своих кости «цепочки» под костью hair):
                    капюшон идёт за головой, плечи — за волосами, низ качается (ход, повороты, ветер), сидя — подбирается.
                    Статуэтка (без скелета) — та же форма, неподвижная. Без героини — простой каз (капюшон + полотнище).
     opts.quality — 'low' | 'high' (сетка 36×12+16 / 48×16+24 кольца), по умолчанию 'high'
     opts.outline — контур как у героини (по умолчанию true); opts.gradientMap — рампа toon (по умолчанию мягкая)
     kz = { group, mesh, outline, fringeMat, bones, fitted, info:{tris, calls, verts, hidden, ms}, reveal (0..1),
            update(dt, s), setVisible(v), dispose() }
   VILLAGE.kaz.wear(hero, anim, opts) -> kz — надеть: прячет берет и бант (вырожденные треугольники в общем индексе
     сетки героини — работает и после Interact, где своя копия геометрии), hero.beret.visible = false (соглашение
     города: «шляпа надета»), каз разворачивается сверху вниз за ~0,9 с (opts.instant — сразу).
   VILLAGE.kaz.remove(opts) — снять: берет снова на месте (индекс восстановлен), каз убран и освобождён. Можно звать
     сколько угодно раз. ВЫЗЫВАТЬ при выходе из региона (иначе берет останется спрятанным и в городе).
   VILLAGE.kaz.update(dt, s) — раз в кадр ПОСЛЕ anim.update (и после Interact.update): s — тот же объект, что ушёл в
     anim.update ({ speed, sitting, drive, ride, turnRate }); по нему каз подбирается сидя/за рулём/на велосипеде.
   VILLAGE.kaz.isWorn() / VILLAGE.kaz.current — что надето. VILLAGE.kaz.lines — короткие правдивые реплики (named / N:).
   Порядок кадра: anim.update → (Interact.update) → kaz.update → render.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2, D = PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angW = a => a - TAU * Math.round(a / TAU);

  const COL = { white: '#FFFDF8', cream: '#F6F0E4', gold: '#D9A632', goldD: '#A87A22', goldL: '#F4D27A', thread: '#C9952E' };
  const DIM = {
    hoodOff: 0.012,        // капюшон над волосами, м
    mantleOff: 0.016,      // плечи/спина над волосами
    hem: 0.27,             // низ длинного конца (почти до щиколоток; рост модели 1.896)
    tail: 40 * D,          // полуширина длинного конца (угол от спины)
    asym: 42 * D,          // волна 4 (интегратор): длинный конец смещён к правому плечу — каз драпируют асимметрично
                           // (plan2/kubachi_spec2.md §3); со спины — косая золотая кайма, слева видно пальто, а не «белое яйцо»
    band: 0.034,           // золотая кайма по краю
    tile: 0.30,            // плитка узора (4×4 мотива — шаг 7,5 см: «мелкий узор», в масштабе большеголовой героини)
    fringe: 0.055,         // бахрома (короткая — «девичья»)
    fold: 0.05,            // глубина складок у подола
  };

  /* ---------------------------------------------------------------------
     ТЕКСТУРЫ (canvas): узор-плитка, кайма, бахрома
     --------------------------------------------------------------------- */
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  // плитка 512×512: белое полотно, мелкие золотые цветы и пёрышки в шахматном порядке, точки между ними
  function paintPattern() {
    const [cv, c] = cnv(512, 512);
    c.fillStyle = COL.white; c.fillRect(0, 0, 512, 512);
    // лёгкое плетение ткани
    c.globalAlpha = 0.035; c.fillStyle = '#B9A98E';
    for (let i = 0; i < 512; i += 4) { c.fillRect(i, 0, 1, 512); c.fillRect(0, i + 2, 512, 1); }
    c.globalAlpha = 1;
    const wrap = (x, y, fn) => { for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { c.save(); c.translate(x + dx, y + dy); fn(); c.restore(); } };
    const flower = () => {
      c.fillStyle = COL.gold; c.strokeStyle = COL.goldD; c.lineWidth = 2.2;
      for (let k = 0; k < 5; k++) { c.save(); c.rotate(k * TAU / 5); c.beginPath(); c.ellipse(0, -13, 7.5, 12, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
      c.fillStyle = COL.goldL; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.strokeStyle = COL.goldD; c.lineWidth = 1.6; c.stroke();
      // два листика
      c.fillStyle = COL.gold; [-1, 1].forEach(s => { c.save(); c.rotate(s * 0.9 + PI); c.beginPath(); c.ellipse(0, -30, 4.5, 9, 0, 0, TAU); c.fill(); c.restore(); });
    };
    const feather = () => {
      c.rotate(-0.6);
      c.fillStyle = COL.gold; c.strokeStyle = COL.goldD; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 26); c.bezierCurveTo(16, 10, 15, -14, 0, -30); c.bezierCurveTo(-15, -14, -16, 10, 0, 26); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = COL.goldL; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 30); c.lineTo(0, -26); c.stroke();
      c.strokeStyle = COL.goldD; c.lineWidth = 1.2;
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(0, k * 6); c.lineTo(9, k * 6 - 6); c.moveTo(0, k * 6); c.lineTo(-9, k * 6 - 6); c.stroke(); }
    };
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const x = 64 + q * 128 + (r % 2) * 64, y = 64 + r * 128;
      wrap(x, y, (r + q) % 2 ? feather : flower);
      // точки-«блёстки» между мотивами
      wrap(x + 64, y, () => { c.fillStyle = COL.gold; c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fill(); });
      wrap(x + 32, y + 64, () => { c.fillStyle = COL.goldL; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill(); });
    }
    return cv;
  }
  // кайма 256×64 (по длине повторяется): золотая полоса, тонкие тёмные линии, ряд ромбиков-цветочков
  function paintBorder() {
    const [cv, c] = cnv(256, 64);
    c.fillStyle = COL.gold; c.fillRect(0, 0, 256, 64);
    c.fillStyle = COL.goldD; c.fillRect(0, 6, 256, 3); c.fillRect(0, 50, 256, 3);
    c.fillStyle = COL.goldL;
    for (let i = 0; i < 8; i++) {
      const x = 16 + i * 32;
      c.beginPath(); c.moveTo(x, 18); c.lineTo(x + 10, 29); c.lineTo(x, 40); c.lineTo(x - 10, 29); c.closePath(); c.fill();
      c.fillStyle = COL.white; c.beginPath(); c.arc(x, 29, 3, 0, TAU); c.fill(); c.fillStyle = COL.goldL;
      c.beginPath(); c.arc(x + 16, 29, 2.6, 0, TAU); c.fill();
    }
    // самый край (y = 0..5 — у края ткани) чуть светлее
    c.fillStyle = 'rgba(255,240,200,0.5)'; c.fillRect(0, 0, 256, 5);
    return cv;
  }
  // бахрома 256×64 (повтор по длине): верхняя плетёная полоска и нити с узелками; прозрачный фон (alphaTest)
  function paintFringe() {
    const [cv, c] = cnv(256, 64);
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = COL.gold; c.fillRect(0, 0, 256, 10);
    c.fillStyle = COL.goldD; for (let x = 0; x < 256; x += 8) c.fillRect(x, 3, 4, 4);
    for (let x = 2; x < 256; x += 6) {
      const len = 46 + ((x * 37) % 13);
      c.strokeStyle = (x / 6) % 2 ? COL.thread : COL.goldL; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + 1, 9); c.quadraticCurveTo(x + 2.5, 30, x + 1.5, len); c.stroke();
      c.fillStyle = COL.goldD; c.beginPath(); c.arc(x + 1.5, 16, 2.2, 0, TAU); c.fill();
    }
    return cv;
  }

  /* ---------------------------------------------------------------------
     РАЗБОР МОДЕЛИ: волосы / лицо / берет / бант (по цвету текстуры у вершин + веса кожи на голове)
     --------------------------------------------------------------------- */
  const K_OTHER = 0, K_HAIR = 1, K_SKIN = 2, K_BERET = 3, K_BOW = 4;
  function hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }
  const skinOf = (A, i, j) => (j === 0 ? A.getX(i) : j === 1 ? A.getY(i) : j === 2 ? A.getZ(i) : A.getW(i));
  function classify(geo, map, boneNames, C) {
    const P = geo.attributes.position, U = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    const n = P.count, cls = new Uint8Array(n), hairish = new Uint8Array(n);
    let px = null, W = 0, H = 0;
    try {
      const img = map && map.image;
      if (img && img.width && U) {
        W = img.width; H = img.height;
        const [cv, c] = cnv(W, H); c.drawImage(img, 0, 0); px = c.getImageData(0, 0, W, H).data;
      }
    } catch (e) { px = null; }
    const headB = new Set(['head', 'hair', 'neck'].map(b => boneNames.indexOf(b)).filter(i => i >= 0));
    const flip = map && map.flipY;
    let nBeret = 0;
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      let hw = 0;
      if (SI && SW) { for (let j = 0; j < 4; j++) if (headB.has(skinOf(SI, i, j))) hw += skinOf(SW, i, j); }
      else hw = y > C[1] - 0.25 ? 1 : 0;
      let h = 0, s = 0, v = 0.1;
      if (px && y > 0.8) {
        let u = U.getX(i), w = U.getY(i); u -= Math.floor(u); w -= Math.floor(w);
        const xx = Math.min(W - 1, (u * W) | 0), yy = Math.min(H - 1, ((flip ? 1 - w : w) * H) | 0), k = (yy * W + xx) * 4;
        [h, s, v] = hsv(px[k], px[k + 1], px[k + 2]);
      }
      if (hw < 0.5 || y < C[1] - 0.45) {
        cls[i] = K_OTHER;
        // пряди на груди (кожа — на груди/спине, цвет — волосы): их тоже укрыть
        if (px && y > 0.8 && h < 45 && s > 0.35 && v < 0.42) hairish[i] = 1;
        continue;
      }
      const face = z > C[2] + 0.12 && Math.abs(x) < 0.17 && y > C[1] - 0.17 && y < C[1] + 0.15;
      if (px && (h > 325 || h < 3) && s > 0.55 && v > 0.28 && v < 0.84 && y > C[1] + 0.1) { cls[i] = K_BERET; nBeret++; }
      else if (px && (h > 300 || h < 14) && s > 0.18 && v > 0.42 && y > C[1] + 0.13 && x > 0.1 && !face) cls[i] = K_BOW;   // бант (и в тенях складок); ниже — уже висок, не трогаем   // бант: розовый, и в складках-тенях тоже
      else if (face) cls[i] = K_SKIN;
      else if (px && h < 40 && s < 0.5 && v > 0.7) cls[i] = K_SKIN;
      else cls[i] = K_HAIR;
    }
    return { cls, hairish, nBeret, sampled: !!px };
  }

  /* ---------------------------------------------------------------------
     ПОДГОНКА: поля радиусов (сфера вокруг головы — капюшон; цилиндр вокруг оси — плечи и спина) по вершинам волос,
     сетка каза, веса кожи (с ближайших вершин героини), кости цепочки, кайма, UV
     --------------------------------------------------------------------- */
  const fitCache = new WeakMap();
  function fitModel(T, geo, map, rigBones, opts) {
    const key = (opts.quality || 'high') + (opts.hem || DIM.hem);
    let fc = fitCache.get(geo);
    if (fc && fc[key]) return fc[key];
    const t0 = performance.now();
    const names = rigBones.map(b => b[0]), J = {}; rigBones.forEach(b => { J[b[0]] = b[2]; });
    const A = (window.HERO3D && window.HERO3D.anchors) || {};
    const C = (A.head || [0, 1.5, -0.093]).slice();
    const { cls, hairish, nBeret, sampled } = classify(geo, map, names, C);
    const P = geo.attributes.position, n = P.count;
    const cover = nBeret < 300;   // берет не найден — каз ложится поверх всей головы (без прятанья)
    const isHair = k => k === K_HAIR || (cover && (k === K_BERET || k === K_BOW));

    /* --- сферические корзины (капюшон) --- */
    const NBT = 72, NBP = 50, PMAX = 150 * D;
    const hR = new Float32Array(NBT * NBP), sR = new Float32Array(NBT * NBP);
    /* --- цилиндрические корзины (плечи, спина) --- */
    const yTop = C[1] + 0.32, DY = 0.02, NBY = Math.ceil(yTop / DY) + 1;
    const cH = new Float32Array(NBT * NBY), cB = new Float32Array(NBT * NBY), hairLow = new Float32Array(NBT).fill(9);
    let faceTh = 40 * D, lockTh = 90 * D, lockLow = 9, chinY = C[1] - 0.12;
    const fside = new Float32Array(NBY);   // боковой край лица (угол от оси) по высоте
    const phBer = new Float32Array(NBT);   // самый низкий край берета/банта в столбце — капюшон должен закрыть «дыру»
    for (let i = 0; i < n; i++) {
      const k = cls[i], x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const dx = x - C[0], dy = y - C[1], dz = z - C[2], r = Math.hypot(dx, dy, dz), rh = Math.hypot(dx, dz);
      const th = (Math.atan2(dx, dz) + TAU) % TAU;
      const it = Math.min(NBT - 1, (th / TAU * NBT) | 0);
      if (!cover && (k === K_BERET || k === K_BOW)) { const ph = Math.acos(clamp(dy / (r || 1), -1, 1)); phBer[it] = Math.max(phBer[it], ph); }
      if (k === K_HAIR || k === K_SKIN || (cover && k !== K_OTHER)) {
        const ph = Math.acos(clamp(dy / (r || 1), -1, 1));
        if (ph < PMAX) {
          const ip = Math.min(NBP - 1, (ph / PMAX * NBP) | 0), b = it * NBP + ip;
          if (isHair(k)) hR[b] = Math.max(hR[b], r); else if (k === K_SKIN) sR[b] = Math.max(sR[b], r);
        }
        if (k === K_SKIN && y > C[1] - 0.2 && y < C[1] + 0.12 && dz > 0) faceTh = Math.max(faceTh, Math.abs(Math.atan2(dx, dz)));
        if (k === K_SKIN && dz > 0.08 && y < yTop) { const iy = Math.min(NBY - 1, ((yTop - y) / DY) | 0); fside[iy] = Math.max(fside[iy], Math.abs(Math.atan2(dx, dz))); if (Math.abs(dx) < 0.08 && dz > 0.12) chinY = Math.min(chinY, y); }
      }
      if (y < yTop && y >= 0) {
        const iy = Math.min(NBY - 1, ((yTop - y) / DY) | 0), b = it * NBY + iy;
        if (isHair(k)) { cH[b] = Math.max(cH[b], rh); hairLow[it] = Math.min(hairLow[it], y); if (y < C[1] - 0.12 && dz > -0.02) lockTh = Math.min(lockTh, Math.abs(Math.atan2(dx, dz))); }
        else if (hairish[i]) { cH[b] = Math.max(cH[b], rh); if (dz > -0.05 && Math.abs(dx) > 0.08) lockLow = Math.min(lockLow, y); }
        else if (k !== K_BERET && k !== K_BOW) cB[b] = Math.max(cB[b], rh);
      }
    }
    // заполнить пустые корзины (дыра от берета, полюс) средним соседей; затем «раздуть и сгладить» — ткань, а не пряди
    function fillSph(F) {
      const has = new Uint8Array(F.length); for (let b = 0; b < F.length; b++) has[b] = F[b] > 0 ? 1 : 0;
      for (let pass = 0; pass < 60; pass++) {
        let left = 0; const add = [];
        for (let it = 0; it < NBT; it++) for (let ip = 0; ip < NBP; ip++) {
          const b = it * NBP + ip; if (has[b]) continue;
          let s = 0, m = 0;
          for (let dt = -1; dt <= 1; dt++) for (let dp = -1; dp <= 1; dp++) {
            let jt = (it + dt + NBT) % NBT, jp = ip + dp;
            if (jp < 0) { jp = 0; jt = (jt + NBT / 2) % NBT; }
            if (jp >= NBP) continue;
            const bb = jt * NBP + jp; if (has[bb]) { s += F[bb]; m++; }
          }
          if (ip === 0) for (let jt = 0; jt < NBT; jt += 6) { const bb = jt * NBP; if (has[bb]) { s += F[bb]; m++; } }
          if (m) add.push(b, s / m); else left++;
        }
        for (let q = 0; q < add.length; q += 2) { F[add[q]] = add[q + 1]; has[add[q]] = 2; }
        if (!left) break;
      }
      // гармоническое сглаживание только заполненных (дыра берета → ровный купол)
      for (let pass = 0; pass < 50; pass++) {
        for (let it = 0; it < NBT; it++) for (let ip = 0; ip < NBP; ip++) {
          const b = it * NBP + ip; if (has[b] !== 2) continue;
          let s = 0, m = 0;
          for (const [dt, dp] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let jt = (it + dt + NBT) % NBT, jp = ip + dp;
            if (jp < 0) { jp = 0; jt = (jt + NBT / 2) % NBT; }
            if (jp >= NBP) continue;
            s += F[jt * NBP + jp]; m++;
          }
          F[b] = s / m;
        }
      }
    }
    function blurSph(F, dil) {
      const G = new Float32Array(F.length);
      for (let it = 0; it < NBT; it++) for (let ip = 0; ip < NBP; ip++) {
        let s = 0, m = 0, mx = 0;
        for (let dt = -1; dt <= 1; dt++) for (let dp = -1; dp <= 1; dp++) {
          const jt = (it + dt + NBT) % NBT, jp = clamp(ip + dp, 0, NBP - 1), v = F[jt * NBP + jp];
          s += v; m++; mx = Math.max(mx, v);
        }
        G[it * NBP + ip] = dil ? mx : s / m;
      }
      return G;
    }
    const hR0 = hR.slice();
    fillSph(hR);
    let HR = blurSph(blurSph(blurSph(hR)));
    for (let b = 0; b < HR.length; b++) HR[b] = Math.max(HR[b], hR0[b], sR[b]) + DIM.hoodOff;
    const sampleSph = (F, th, ph) => {
      const ft = ((th / TAU) * NBT - 0.5 + NBT) % NBT, fp = clamp((ph / PMAX) * NBP - 0.5, 0, NBP - 1.001);
      const t0 = Math.floor(ft), p0 = Math.floor(fp), at = ft - t0, ap = fp - p0, t1 = (t0 + 1) % NBT, p1 = Math.min(NBP - 1, p0 + 1);
      return lerp(lerp(F[t0 * NBP + p0], F[t0 * NBP + p1], ap), lerp(F[t1 * NBP + p0], F[t1 * NBP + p1], ap), at);
    };
    const sample1 = (F, th) => { const ft = ((th / TAU) * NBT - 0.5 + NBT) % NBT, t0 = Math.floor(ft), a = ft - t0; return lerp(F[t0], F[(t0 + 1) % NBT], a); };
    // край капюшона у лица: маска лица во фронтальной проекции (x, y; клетки 1 см) — капюшон идёт вниз по столбцу,
    // пока его точка не окажется перед лицом. Так край повторяет овал лица, а пряди у щёк — под тканью.
    const MX0 = -0.32, MY0 = C[1] - 0.4, MC = 0.01, MW = 64, MH = 80, mask = new Uint8Array(MW * MH);
    for (let i = 0; i < n; i++) {
      if (cls[i] !== K_SKIN) continue;
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (z - C[2] < 0.04) continue;
      const mx = Math.floor((x - MX0) / MC), my = Math.floor((y - MY0) / MC);
      if (mx >= 0 && mx < MW && my >= 0 && my < MH) mask[my * MW + mx] = 1;
    }
    const morph = (M, grow) => { const O = new Uint8Array(M.length); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { let v = grow ? 0 : 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; const m = xx >= 0 && xx < MW && yy >= 0 && yy < MH ? M[yy * MW + xx] : 0; if (grow) v |= m; else v &= m; } O[y * MW + x] = v; } return O; };
    // закрыть щели (глаза, брови), затем сузить на 1 см: край ткани ложится на самый край щёк — без щели, где видны пряди
    let FM = morph(morph(morph(morph(mask, true), true), false), false);
    FM = morph(FM, false);
    const inFace = (x, y) => { const mx = Math.floor((x - MX0) / MC), my = Math.floor((y - MY0) / MC); return mx >= 0 && mx < MW && my >= 0 && my < MH && FM[my * MW + mx] === 1; };
    // боковые столбцы у щёк не обрываются: их точку отодвигаем наружу (до 11 см), пока она не выйдет из-за края лица —
    // ткань обрамляет лицо чуть свободнее, а пряди у щёк закрыты; лобные столбцы (|θ| < 38°) кончаются у линии волос
    const PNECK = 112 * D, NPD = 113, phEnd = new Float32Array(NBT), push = new Float32Array(NBT * NPD);
    for (let it = 0; it < NBT; it++) {
      const th = (it + 0.5) / NBT * TAU, st = Math.sin(th), ct = Math.cos(th), frontal = Math.abs(angW(th)) < 38 * D;
      // сзади капюшон кончается выше (у затылка) — дальше ровно падает полотно, без «талии» на шее
      const pEnd = lerp(PNECK, 94 * D, sst(85 * D, 140 * D, Math.abs(angW(th))));
      let pe = pEnd;
      for (let pd = 20; pd <= 112; pd++) {
        const ph = pd * D, r0 = sampleSph(HR, th, ph), sp = Math.sin(ph);
        if (ph > pEnd) break;
        let r = r0, hit = false;
        for (let k = 0; k <= 22; k++) {
          r = r0 + k * 0.005;
          const x = C[0] + r * sp * st, y = C[1] + r * Math.cos(ph), z = C[2] + r * sp * ct;
          hit = z > C[2] + 0.02 && inFace(x, y);
          if (!hit || frontal) break;
        }
        if (hit) { pe = ph; break; }
        push[it * NPD + pd] = r - r0;
      }
      // дыра от берета закрыта капюшоном (берет сидит выше лба — лицо не задевает)
      phEnd[it] = Math.max(pe, phBer[it] > 0 ? Math.min(PNECK, phBer[it] + 0.07) : 0);
    }
    { // сгладить отступ (по φ и θ), чтобы ткань не шла «ступеньками»
      const P2 = new Float32Array(push.length);
      for (let it = 0; it < NBT; it++) for (let pd = 0; pd < NPD; pd++) { let m = 0, s2 = 0, w = 0; for (let dt = -2; dt <= 2; dt++) for (let dp = -6; dp <= 6; dp += 2) { const v = push[((it + dt + NBT) % NBT) * NPD + clamp(pd + dp, 0, NPD - 1)]; m = Math.max(m, v); s2 += v; w++; } P2[it * NPD + pd] = Math.max(push[it * NPD + pd], 0.5 * m + 0.5 * s2 / w); }
      push.set(P2);
    }
    const pushAt = (th, ph) => { const ft = ((th / TAU) * NBT - 0.5 + NBT) % NBT, t0 = Math.floor(ft), a = ft - t0, t1 = (t0 + 1) % NBT, pd = clamp(ph / D, 0, NPD - 1.001), p0 = Math.floor(pd), b = pd - p0;
      return lerp(lerp(push[t0 * NPD + p0], push[t0 * NPD + p0 + 1], b), lerp(push[t1 * NPD + p0], push[t1 * NPD + p0 + 1], b), a); };
    // сгладить край по кругу, но не опускать ниже найденной линии (лицо открыто)
    // край берета/банта — плавно по столбцам (иначе у бантика торчит «зубец»)
    { const B2 = new Float32Array(NBT); for (let it = 0; it < NBT; it++) { let m = 0; for (let d = -3; d <= 3; d++) m = Math.max(m, phBer[(it + d + NBT) % NBT] - Math.abs(d) * 0.015); B2[it] = m; }
      for (let it = 0; it < NBT; it++) { let s2 = 0, w2 = 0; for (let d = -2; d <= 2; d++) { const ww = Math.exp(-d * d / 3); s2 += B2[(it + d + NBT) % NBT] * ww; w2 += ww; } phBer[it] = Math.max(s2 / w2, 0); }
      for (let it = 0; it < NBT; it++) phEnd[it] = Math.max(phEnd[it], phBer[it] > 0 ? Math.min(PNECK, phBer[it] + 0.07) : 0); }
    const phE = new Float32Array(NBT);
    for (let it = 0; it < NBT; it++) {
      let s = 0, w = 0;
      for (let d = -4; d <= 4; d++) { const ww = Math.exp(-d * d / 6); s += phEnd[(it + d + NBT) % NBT] * ww; w += ww; }
      phE[it] = Math.max(Math.min(s / w, phEnd[it] + 0.03), phBer[it] > 0 ? Math.min(PNECK, phBer[it] + 0.05) : 0);
    }
    // цилиндр: волосы «занавесом» — ниже выпуклости ткань падает отвесно; тело + 4 см; сгладить
    const CR = new Float32Array(NBT * NBY);
    for (let it = 0; it < NBT; it++) for (let iy = 0; iy < NBY; iy++) {
      // ниже выпуклости волос ткань падает почти отвесно (сужается на 7,5 см на метр)
      const up = iy > 0 ? CR[it * NBY + iy - 1] - 0.0015 : 0;
      CR[it * NBY + iy] = Math.max(cH[it * NBY + iy], up, cB[it * NBY + iy] > 0 ? cB[it * NBY + iy] + 0.045 : 0);
    }
    const blurCyl = (F, dil) => {
      const G = new Float32Array(F.length);
      for (let it = 0; it < NBT; it++) for (let iy = 0; iy < NBY; iy++) {
        let s = 0, m = 0, mx = 0;
        for (let dt = -2; dt <= 2; dt++) for (let dy = -1; dy <= 1; dy++) { const v = F[((it + dt + NBT) % NBT) * NBY + clamp(iy + dy, 0, NBY - 1)]; s += v; m++; mx = Math.max(mx, v); }
        G[it * NBY + iy] = dil ? mx : s / m;
      }
      return G;
    };
    let CRs = blurCyl(blurCyl(blurCyl(CR, true)));
    for (let b = 0; b < CRs.length; b++) CRs[b] = Math.max(CRs[b], CR[b]) + DIM.mantleOff;
    const sampleCylRaw = (th, y) => sampleCyl(th, y);
    const sampleCyl = (th, y) => {
      const ft = ((th / TAU) * NBT - 0.5 + NBT) % NBT, fy = clamp((yTop - y) / DY - 0.5, 0, NBY - 1.001);
      const t0 = Math.floor(ft), y0 = Math.floor(fy), at = ft - t0, ay = fy - y0, t1 = (t0 + 1) % NBT, y1 = Math.min(NBY - 1, y0 + 1);
      return lerp(lerp(CRs[t0 * NBY + y0], CRs[t0 * NBY + y1], ay), lerp(CRs[t1 * NBY + y0], CRs[t1 * NBY + y1], ay), at);
    };
    // низ волос по столбцам (сглажено), спина — отдельно
    const hairLowS = new Float32Array(NBT);
    for (let it = 0; it < NBT; it++) { let s = 0, w = 0; for (let d = -3; d <= 3; d++) { const v = hairLow[(it + d + NBT) % NBT]; if (v < 8) { const ww = Math.exp(-d * d / 4); s += v * ww; w += ww; } } hairLowS[it] = w ? s / w : C[1] - 0.2; }
    const backLow = sample1(hairLowS, PI);
    // передний край полотна: за лицом, но так, чтобы пряди у плеч были под тканью
    // боковой край лица по высоте (сглажено) и где начинать полотно: первый столбец капюшона, чей край уже снаружи лица
    const fsS = new Float32Array(NBY);
    for (let iy = 0; iy < NBY; iy++) { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, fside[clamp(iy + d, 0, NBY - 1)]); fsS[iy] = m; }
    const faceAt = y => fsS[clamp(Math.round((yTop - y) / DY - 0.5), 0, NBY - 1)];
    const rimY = th => C[1] + (sampleSph(HR, th, sample1(phE, th)) + pushAt(th, sample1(phE, th))) * Math.cos(sample1(phE, th));
    const NTq = opts.quality !== 'low' ? 48 : 36;
    let thA = 75 * D;
    for (let j = Math.ceil(NTq * 35 / 360); j <= Math.floor(NTq * 75 / 360); j++) { const th = j / NTq * TAU; if (sample1(phE, th) >= 104 * D && sample1(phE, TAU - th) >= 104 * D) { thA = th; break; } }

    /* --- сетка --- */
    const HI = opts.quality !== 'low';
    const NT = HI ? 48 : 36, NRH = HI ? 16 : 12, NRM = HI ? 24 : 16;
    const pos = [], uvA = [], edgeA = [], bordA = [], rows = [];
    const NU = Math.round(TAU * 0.3 / DIM.tile);       // целое число повторов по кругу — без шва спереди
    const vert = (p, u, v, e, b) => { pos.push(p[0], p[1], p[2]); uvA.push(u, v); edgeA.push(e); bordA.push(b); return pos.length / 3 - 1; };
    const hood = [];       // [j][i] -> index
    const hoodArc = [];    // длина дуги от полюса
    const inMantle = j => { const th = j / NT * TAU; return th >= thA - 1e-6 && th <= TAU - thA + 1e-6; };
    for (let j = 0; j <= NT; j++) {
      const th = j / NT * TAU, pe = sample1(phE, th), col = [], arcs = [];
      let arc = 0, prev = null;
      const pts = [];
      for (let i = 0; i <= NRH; i++) {
        const ph = pe * i / NRH;
        let r = sampleSph(HR, th, ph) + pushAt(th, ph);
        // у края, переходящего в полотно, капюшон плавно расходится до радиуса полотна — без «ступеньки» на затылке
        if (inMantle(j) && ph > pe - 0.5) {
          const w = sst(pe - 0.5, pe, ph), y0 = C[1] + r * Math.cos(ph), sp = Math.max(0.5, Math.sin(ph));
          r = Math.max(r, lerp(r, sampleCylRaw(th, y0) / sp, w));
        }
        const p = [C[0] + r * Math.sin(ph) * Math.sin(th), C[1] + r * Math.cos(ph), C[2] + r * Math.sin(ph) * Math.cos(th)];
        if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
        pts.push(p); arcs.push(arc); prev = p;
      }
      const free = !inMantle(j % NT === 0 && j ? 0 : j);
      for (let i = 0; i <= NRH; i++) {
        const e = free ? arc - arcs[i] : 9;
        col.push(vert(pts[i], j / NT * NU, arcs[i] / DIM.tile, e, th * 0.3));
      }
      hood.push(col); hoodArc.push(arcs);
    }
    // плечи и спина: столбцы от края капюшона вниз до подола (длинный конец — сзади). Передний край ниже
    // подбородка уходит вперёд: ткань ложится на плечи и закрывает пряди у груди (выше — край капюшона, лицо открыто)
    const jA = Math.ceil(thA / TAU * NT - 1e-6), jB = Math.floor((TAU - thA) / TAU * NT + 1e-6), nC = jB - jA;
    const thTop = jA / NT * TAU, thLow = Math.min(thTop, opts.front || 30 * D);
    const yJaw = pos[hood[jA][NRH] * 3 + 1];
    // передний край: от края капюшона — вдоль лица (снаружи на 5°), под подбородком — вперёд на плечи
    // для каждой высоты — самый передний угол, при котором полотно ещё не заходит на лицо (та же маска лица)
    const edgeAng = y => {
      for (let th = thLow; th < thTop + 4 * D; th += D) {
        const R = sampleCyl(th, y), x = C[0] + R * Math.sin(th), z = C[2] + R * Math.cos(th);
        if (!(z > C[2] + 0.02 && inFace(x, y))) return th;
      }
      return thTop + 4 * D;
    };
    const thAt = y => lerp(thTop, edgeAng(y), sst(yJaw, yJaw - 0.04, y));
    const mantle = [], isM = new Uint8Array(200000), wbV = new Float32Array(200000);
    const flatZ = y => C[2] - sampleCyl(PI, y);
    for (let j = jA; j <= jB; j++) {
      const u = (j - jA) / nC, th0 = j / NT * TAU, top = hood[j][NRH], tp = [pos[top * 3], pos[top * 3 + 1], pos[top * 3 + 2]];
      const wb = sst(DIM.tail + 0.3, DIM.tail, Math.abs(angW(th0 - PI - DIM.asym)));
      const front = sst(0.2, 0.0, Math.min(u, 1 - u));
      const side = Math.min(sample1(hairLowS, th0), tp[1] - 0.06) - 0.05;
      const hem = lerp(lerp(side, Math.min(yJaw - 0.3, (lockLow < 8 ? lockLow : yJaw - 0.3) - 0.035), front), opts.hem || DIM.hem, wb);
      const rTop = Math.hypot(tp[0] - C[0], tp[2] - C[2]);
      const col = [top];
      let arc = hoodArc[j][NRH], prev = tp;
      for (let k = 1; k <= NRM; k++) {
        const t = k / NRM, y = lerp(tp[1], hem, Math.pow(t, 1.1)), ta = thAt(y), th = ta + u * (TAU - 2 * ta);
        let R = sampleCyl(th, y);
        R = Math.max(R, lerp(rTop, R, sst(tp[1], tp[1] - 0.14, y)));
        const f = sst(backLow + 0.02, backLow - 0.45, y) * wb;
        let x = C[0] + R * Math.sin(th) * (1 - 0.3 * f), z = lerp(C[2] + R * Math.cos(th), flatZ(y), f * 0.8);
        // мягкие складки: волна поперёк полотна, к подолу глубже (только наружу — внутрь волос не уходит)
        const fold = (0.5 + 0.5 * Math.sin(th * 7 + 0.7)) * DIM.fold * sst(tp[1] - 0.05, hem, y) * (0.35 + 0.65 * wb);
        const ox = lerp(Math.sin(th), 0, f), oz = lerp(Math.cos(th), -1, f), ol = Math.hypot(ox, oz) || 1;
        x += fold * ox / ol; z += fold * oz / ol;
        const p = [x, y, z];
        arc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); prev = p;
        const eS = Math.min(u, 1 - u) * (TAU - 2 * ta) * Math.max(R, 0.15);
        const vi = vert(p, th / TAU * NU, arc / DIM.tile, eS, y);
        isM[vi] = 1; wbV[vi] = wb; col.push(vi);
      }
      // расстояние до подола (вдоль столбца) — кайма подола; вдоль-координата каймы — по кругу
      let acc = 0;
      for (let k = NRM; k >= 1; k--) {
        const a = col[k];
        if (k < NRM) { const q = col[k + 1]; acc += Math.hypot(pos[a * 3] - pos[q * 3], pos[a * 3 + 1] - pos[q * 3 + 1], pos[a * 3 + 2] - pos[q * 3 + 2]); }
        // у длинного конца кайма шире («подзор» над бахромой)
        const accS = acc / (1 + 1.3 * wb);
        if (accS < edgeA[a]) { edgeA[a] = accS; bordA[a] = th0 * 0.32; }
      }
      mantle.push({ j, th: th0, col, wb });
    }
    // верхний ряд плеч совпадает с краем капюшона (тот же индекс) — у боковых столбцов край капюшона не кайма
    // треугольники
    const idx = [];
    for (let j = 0; j < NT; j++) for (let i = 0; i < NRH; i++) {
      const a = hood[j][i], b = hood[j + 1][i], c2 = hood[j + 1][i + 1], d = hood[j][i + 1];
      // обход — нормали наружу (как у полотна ниже): иначе на стыке нормали гасят друг друга и контур «рвётся»
      if (i === 0) idx.push(a, d, c2); else idx.push(a, c2, b, a, d, c2);
    }
    for (let m = 0; m < mantle.length - 1; m++) {
      const A0 = mantle[m].col, B0 = mantle[m + 1].col;
      for (let k = 0; k < NRM; k++) idx.push(A0[k], A0[k + 1], B0[k + 1], A0[k], B0[k + 1], B0[k]);
    }
    const nBody = idx.length;

    /* --- кости цепочки: по средней линии длинного конца --- */
    const yC0 = backLow + 0.1, L = yC0 - (opts.hem || DIM.hem);
    // цепочка — по середине длинного конца (он смещён на DIM.asym от спины)
    const chainJ = [0, 1, 2].map(k => { const y = yC0 - L * k / 3; return [C[0] + Math.sin(PI + DIM.asym) * sampleCyl(PI + DIM.asym, y) * 0.7, y, flatZ(y)]; });
    // бахрома на подоле длинного конца
    const fr = [];
    mantle.forEach((mc, m) => { if (mc.wb > 0.55) fr.push(m); });
    const fringeStart = idx.length;
    const frV = [];
    if (fr.length > 1) {
      const m0 = fr[0], m1 = fr[fr.length - 1];
      let along = 0, prevP = null;
      for (let m = m0; m <= m1; m++) {
        const h = mantle[m].col[NRM], p = [pos[h * 3], pos[h * 3 + 1], pos[h * 3 + 2]];
        if (prevP) along += Math.hypot(p[0] - prevP[0], p[2] - prevP[2]);
        prevP = p;
        const a = vert(p, along / 0.06, 0.02, 9, 0), b = vert([p[0], p[1] - DIM.fringe, p[2] - 0.004], along / 0.06, 0.98, 9, 0);
        frV.push([a, b, h]);
      }
      for (let q = 0; q < frV.length - 1; q++) idx.push(frV[q][0], frV[q][1], frV[q + 1][1], frV[q][0], frV[q + 1][1], frV[q + 1][0]);
    }

    /* --- веса кожи: капюшон и плечи — с ближайших вершин волос героини; низ — цепочка --- */
    const nv = pos.length / 3;
    // кандидаты: капюшон — волосы/голова; плечи — ещё пряди и пальто выше пояса (без костей рук)
    const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    const armB = new Set(['upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'].map(b => names.indexOf(b)));
    const cand = [], candM = [];
    for (let i = 0; i < n; i++) {
      if (cls[i] !== K_OTHER && (cls[i] !== K_SKIN || P.getY(i) > C[1] - 0.12)) { cand.push(i); candM.push(i); }
      else if (cls[i] === K_OTHER && SI && P.getY(i) > 0.95 && !armB.has(SI.getX(i))) candM.push(i);
    }
    const NB = names.length, iCh = [NB, NB + 1, NB + 2];
    const skI = new Uint16Array(nv * 4), skW = new Float32Array(nv * 4);
    const KN = 6, bd = new Float32Array(KN), bi = new Int32Array(KN), acc = new Float32Array(NB + 3);
    const pack = L => { const o = { L, x: new Float32Array(L.length), y: new Float32Array(L.length), z: new Float32Array(L.length) }; L.forEach((v, q) => { o.x[q] = P.getX(v); o.y[q] = P.getY(v); o.z[q] = P.getZ(v); }); return o; };
    const CH = pack(cand), CM = pack(candM);
    const chainW = y => {
      const out = [0, 0, 0], bl = 0.07, y1 = chainJ[1][1], y2 = chainJ[2][1];
      const a1 = sst(y1 + bl, y1 - bl, y), a2 = sst(y2 + bl, y2 - bl, y);
      out[0] = 1 - a1; out[1] = a1 - a2; out[2] = a2; return out;
    };
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      acc.fill(0);
      const wc = sst(yC0 + 0.06, yC0 - 0.12, y) * sst(0.3, 0.7, wbV[v] || 0);
      if (wc < 1 && SI) {
        const S = isM[v] ? CM : CH, L = S.L;
        bd.fill(1e9); bi.fill(-1);
        for (let q = 0; q < L.length; q++) {
          const dx = S.x[q] - x, dy = S.y[q] - y, dz = S.z[q] - z, d = dx * dx + dy * dy + dz * dz;
          if (d < bd[KN - 1]) { let s = KN - 1; while (s > 0 && bd[s - 1] > d) { bd[s] = bd[s - 1]; bi[s] = bi[s - 1]; s--; } bd[s] = d; bi[s] = q; }
        }
        let tw = 0;
        for (let s = 0; s < KN; s++) { if (bi[s] < 0) continue; const w = 1 / (Math.sqrt(bd[s]) + 0.008) ** 2, hv = L[bi[s]]; for (let j = 0; j < 4; j++) { const bb = skinOf(SI, hv, j); if (armB.has(bb)) continue; const ww = w * skinOf(SW, hv, j); acc[bb] += ww; tw += ww; } }
        if (tw > 0) for (let b = 0; b < NB; b++) acc[b] *= (1 - wc) / tw;
      } else if (wc < 1) { acc[Math.max(0, names.indexOf('head'))] += 1 - wc; }
      if (wc > 0) { const cw = chainW(y); for (let k = 0; k < 3; k++) acc[iCh[k]] += wc * cw[k]; }
      // 4 самых больших
      const top = [];
      for (let b = 0; b < NB + 3; b++) if (acc[b] > 1e-4) top.push([acc[b], b]);
      top.sort((p, q) => q[0] - p[0]); top.length = Math.min(4, top.length);
      const s = top.reduce((a, t) => a + t[0], 0) || 1;
      top.forEach((t, j) => { skI[v * 4 + j] = t[1]; skW[v * 4 + j] = t[0] / s; });
      if (!top.length) { skI[v * 4] = Math.max(0, names.indexOf('head')); skW[v * 4] = 1; }
    }
    // бахрома — точно как подол над ней
    frV.forEach(([a, b, h]) => { for (let j = 0; j < 4; j++) { skI[a * 4 + j] = skI[b * 4 + j] = skI[h * 4 + j]; skW[a * 4 + j] = skW[b * 4 + j] = skW[h * 4 + j]; } });

    /* --- что спрятать у героини: треугольники с вершинами берета и банта --- */
    const hide = [];
    if (!cover && geo.index) {
      const I = geo.index.array;
      for (let t = 0; t < I.length; t += 3) { const a = cls[I[t]], b = cls[I[t + 1]], c2 = cls[I[t + 2]]; if (a >= K_BERET || b >= K_BERET || c2 >= K_BERET) hide.push(t); }
    }
    const res = {
      pos: new Float32Array(pos), uv: new Float32Array(uvA), edge: new Float32Array(edgeA), bord: new Float32Array(bordA),
      index: idx, nBody, fringeStart, skI, skW, names, chainJ, hide, C, cover, sampled,
      info: { verts: nv, tris: idx.length / 3, faceDeg: +(faceTh / D).toFixed(1), lockDeg: +(lockTh / D).toFixed(1), lockLow: +lockLow.toFixed(3), chinY: +chinY.toFixed(3), frontDeg: +(thA / D).toFixed(1), backLow: +backLow.toFixed(3), nBeret, hidden: hide.length, ms: 0 },
      seams: { hood, mantle, NT, NRH, NRM },
    };
    res.info.ms = Math.round(performance.now() - t0);
    if (!fc) { fc = {}; fitCache.set(geo, fc); }
    fc[key] = res;
    return res;
  }

  // каз без модели (кукла, ряженый, витрина): капюшон-эллипсоид и прямое полотнище; оси как у героини, макушка — top
  function genericFit(opts) {
    const C = [0, opts.cy || 1.5, opts.cz || -0.09], R = opts.r || 0.3, NT = 32, NRH = 10, NRM = 12;
    const pos = [], uv = [], edge = [], bord = [], idx = [], hood = [];
    for (let j = 0; j <= NT; j++) {
      const th = j / NT * TAU, front = Math.abs(angW(th)) < 55 * D, pe = front ? 58 * D : 108 * D, col = [];
      for (let i = 0; i <= NRH; i++) {
        const ph = pe * i / NRH;
        pos.push(C[0] + R * Math.sin(ph) * Math.sin(th), C[1] + R * Math.cos(ph) * 1.05, C[2] + R * Math.sin(ph) * Math.cos(th));
        uv.push(j / NT * 6, ph * R / DIM.tile); edge.push(front ? (pe - ph) * R : 9); bord.push(th * 0.3); col.push(pos.length / 3 - 1);
      }
      hood.push(col);
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NRH; i++) { const a = hood[j][i], b = hood[j + 1][i], c = hood[j + 1][i + 1], d = hood[j][i + 1]; if (i === 0) idx.push(a, c, d); else idx.push(a, b, c, a, c, d); }
    const cols = [];
    for (let j = 0; j <= NT; j++) {
      const th = j / NT * TAU; if (Math.abs(angW(th - PI)) > 70 * D) continue;
      const top = hood[j][NRH], tp = [pos[top * 3], pos[top * 3 + 1], pos[top * 3 + 2]], col = [top];
      for (let k = 1; k <= NRM; k++) { const y = lerp(tp[1], opts.hem || 0.3, k / NRM); pos.push(tp[0] * 1.05, y, tp[2] - 0.04 * k / NRM); uv.push(j / NT * 6, (1 - y) / DIM.tile); edge.push(k === NRM ? 0 : 9); bord.push(th * 0.3); col.push(pos.length / 3 - 1); }
      cols.push(col);
    }
    for (let m = 0; m < cols.length - 1; m++) for (let k = 0; k < NRM; k++) idx.push(cols[m][k], cols[m][k + 1], cols[m + 1][k + 1], cols[m][k], cols[m + 1][k + 1], cols[m + 1][k]);
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), edge: new Float32Array(edge), bord: new Float32Array(bord), index: idx, nBody: idx.length, fringeStart: idx.length, hide: [], C, info: { verts: pos.length / 3, tris: idx.length / 3 } };
  }

  /* ---------------------------------------------------------------------
     МАТЕРИАЛЫ
     --------------------------------------------------------------------- */
  const texCache = new WeakMap();
  function textures(T) {
    let tx = texCache.get(T);
    if (tx && tx.alive) return tx;
    const mk = (cv, rep) => { const t = new T.CanvasTexture(cv); t.anisotropy = 4; if (rep) { t.wrapS = T.RepeatWrapping; t.wrapT = rep === 2 ? T.RepeatWrapping : T.ClampToEdgeWrapping; } return t; };
    tx = { pattern: mk(paintPattern(), 2), border: mk(paintBorder(), 1), fringe: mk(paintFringe(), 1), alive: true, users: 0 };
    const d = new Uint8Array(64); [168, 168, 170, 174, 186, 200, 210, 216, 222, 232, 242, 248, 255, 255, 255, 255].forEach((v, i) => d.set([v, v, v, 255], i * 4));
    tx.grad = new T.DataTexture(d, 16, 1, T.RGBAFormat); tx.grad.minFilter = tx.grad.magFilter = T.LinearFilter; tx.grad.generateMipmaps = false; tx.grad.needsUpdate = true;
    texCache.set(T, tx);
    return tx;
  }
  function kazMaterial(T, tx, grad) {
    const m = new T.MeshToonMaterial({ color: 0xFFFFFF, map: tx.pattern, gradientMap: grad || tx.grad, side: T.DoubleSide });
    const U = { uBorder: { value: tx.border }, uBW: { value: DIM.band }, uBL: { value: 0.075 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float aEdge;\nattribute float aBord;\nvarying float vEdge;\nvarying float vBord;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = aEdge; vBord = aBord;');
      sh.fragmentShader = 'uniform sampler2D uBorder;\nuniform float uBW;\nuniform float uBL;\nvarying float vEdge;\nvarying float vBord;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        'vec4 sampledDiffuseColor = texture2D( map, vUv );\nif ( vEdge < uBW ) sampledDiffuseColor = texture2D( uBorder, vec2( vBord / uBL, clamp( vEdge / uBW, 0.03, 0.97 ) ) );\ndiffuseColor *= sampledDiffuseColor;');
    };
    m.customProgramCacheKey = () => 'kaz1';
    m.userData.kaz = true;
    return m;
  }
  function outlineMaterial(T, skinned) {
    return new T.ShaderMaterial({
      uniforms: { thick: { value: 0.00085 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: skinned
        ? '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }'
        : 'uniform float thick;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 nn = normalize(normalMatrix * normal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    });
  }

  /* ---------------------------------------------------------------------
     BUILD
     --------------------------------------------------------------------- */
  function build(T, opts) {
    opts = opts || {};
    T = T || window.THREE;
    const hero = opts.hero || null, rig = hero && hero.rig, H3mesh = rig ? rig.mesh : hero && hero.statue ? hero.statue.mesh : null;
    const geoH = H3mesh && H3mesh.geometry, map = H3mesh && H3mesh.material && H3mesh.material.map;
    const rigBones = window.HERO3D && window.HERO3D.rig && window.HERO3D.rig.bones;
    let F = null;
    const t0 = performance.now();
    if (geoH && rigBones && geoH.attributes.uv) { try { F = fitModel(T, geoH, map, rigBones, opts); } catch (e) { console.warn('kaz: fit', e); F = null; } }
    const fitted = !!F;
    if (!F) F = genericFit(opts);
    const tx = textures(T); tx.users++;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(F.pos.slice(), 3));
    g.setAttribute('uv', new T.BufferAttribute(F.uv, 2));
    g.setAttribute('aEdge', new T.BufferAttribute(F.edge, 1));
    g.setAttribute('aBord', new T.BufferAttribute(F.bord, 1));
    const nv = F.pos.length / 3;
    g.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(F.index, 1) : new T.Uint16BufferAttribute(F.index, 1));
    g.addGroup(0, F.nBody, 0);
    if (F.index.length > F.fringeStart) g.addGroup(F.fringeStart, F.index.length - F.fringeStart, 1);
    g.computeVertexNormals();
    // общие вершины на шве (θ = 0/2π) и на полюсе — средняя нормаль, чтобы не было «строчки»
    if (F.seams) {
      const N = g.attributes.normal, S = F.seams, avg = list => { let x = 0, y = 0, z = 0; list.forEach(i => { x += N.getX(i); y += N.getY(i); z += N.getZ(i); }); const l = Math.hypot(x, y, z) || 1; list.forEach(i => N.setXYZ(i, x / l, y / l, z / l)); };
      avg(S.hood.map(c => c[0]));
      for (let i = 1; i <= S.NRH; i++) avg([S.hood[0][i], S.hood[S.NT][i]]);
      N.needsUpdate = true;
    } else {
      const N = g.attributes.normal; for (let i = 0; i < N.count; i++) if (F.pos[i * 3 + 1] > F.C[1] + 0.28) N.setXYZ(i, 0, 1, 0);
    }
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mat = kazMaterial(T, tx, opts.gradientMap);
    const fringeMat = new T.MeshToonMaterial({ color: 0xFFFFFF, map: tx.fringe, alphaTest: 0.45, side: T.DoubleSide, gradientMap: opts.gradientMap || tx.grad });
    const group = new T.Group(); group.name = 'kaz';
    let mesh, outline = null, bones = [], skeleton = null, parentBone = null;
    const skinned = fitted && rig && rig.anim && F.skI;
    if (skinned) {
      g.setAttribute('skinIndex', new T.BufferAttribute(F.skI, 4));
      g.setAttribute('skinWeight', new T.BufferAttribute(F.skW, 4));
      const hsk = rig.mesh.skeleton, B = rig.anim.bones;
      const hb = F.names.map(nm => B[nm] || hsk.bones.find(b => b.name === nm));
      const inv = F.names.map((nm, i) => { const k = hsk.bones.indexOf(hb[i]); return k >= 0 ? hsk.boneInverses[k].clone() : new T.Matrix4(); });
      parentBone = B.hair || B.chest || B.neck;
      const pName = parentBone.name, pIdx = F.names.indexOf(pName), Jp = window.HERO3D.rig.bones[pIdx][2];
      // цепочка под костью-родителем; обратная матрица = покой родителя × сдвиг (jp − Jp)
      let par = parentBone, prevJ = Jp;
      F.chainJ.forEach((jp, k) => {
        const b = new T.Bone(); b.name = 'kaz' + k; b.position.set(jp[0] - prevJ[0], jp[1] - prevJ[1], jp[2] - prevJ[2]); par.add(b); bones.push(b);
        inv.push(new T.Matrix4().makeTranslation(Jp[0] - jp[0], Jp[1] - jp[1], Jp[2] - jp[2]).multiply(inv[pIdx]));
        par = b; prevJ = jp;
      });
      skeleton = new T.Skeleton(hb.concat(bones), inv);
      mesh = new T.SkinnedMesh(g, [mat, fringeMat]);
      mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
      rig.mesh.add(mesh);
      mesh.bind(skeleton, rig.mesh.bindMatrix);
      if (opts.outline !== false) {
        // контур только по полотну (без бахромы): те же буферы, свой индекс
        const og = new T.BufferGeometry();
        for (const k in g.attributes) og.setAttribute(k, g.attributes[k]);
        og.setIndex(new T.BufferAttribute(g.index.array.slice(0, F.nBody), 1)); og.boundingSphere = g.boundingSphere; og.boundingBox = g.boundingBox;
        outline = new T.SkinnedMesh(og, outlineMaterial(T, true));
        outline.frustumCulled = false; outline.userData.outline = true; outline.raycast = () => {}; outline.castShadow = false;
        rig.mesh.add(outline); outline.bind(skeleton, rig.mesh.bindMatrix);
      }
      group.userData.attachedTo = rig.mesh;
    } else {
      mesh = new T.Mesh(g, [mat, fringeMat]); mesh.castShadow = true;
      group.add(mesh);
      if (opts.outline !== false) { outline = new T.Mesh(g, outlineMaterial(T, false)); outline.userData.outline = true; outline.raycast = () => {}; group.add(outline); }
    }
    mesh.name = 'kaz:mesh'; mesh.userData.kaz = true;
    const st = { t: 0, prev: null, vel: new T.Vector3(), sit: 0, ang: bones.map(() => ({ x: 0, z: 0, vx: 0, vz: 0 })), q: new T.Quaternion(), v: new T.Vector3(), g: new T.Vector3() };
    const kz = {
      group, mesh, outline, fringeMat, material: mat, bones, skeleton, fitted, skinned: !!skinned, F, reveal: 1,
      info: Object.assign({}, F.info, { calls: (outline ? 1 : 0) + 1 + (F.index.length > F.fringeStart ? 1 : 0), buildMs: Math.round(performance.now() - t0) }),
      setVisible(v) { mesh.visible = v; if (outline) outline.visible = v; },
      update(dt, s) {
        dt = Math.min(0.05, Math.max(0, dt || 0)); s = s || {};
        st.t += dt;
        if (!bones.length || !parentBone) return;
        // скорость кости-родителя в мире (сглажено); телепорт — сброс
        parentBone.updateWorldMatrix(true, false);
        const wp = st.v.setFromMatrixPosition(parentBone.matrixWorld);
        if (!st.prev) st.prev = wp.clone();
        if (dt > 0) {
          const dx = wp.x - st.prev.x, dy = wp.y - st.prev.y, dz = wp.z - st.prev.z, d = Math.hypot(dx, dy, dz);
          if (d > 1) st.vel.set(0, 0, 0); else st.vel.lerp(st.g.set(dx / dt, dy / dt, dz / dt), 1 - Math.exp(-8 * dt));
        }
        st.prev.copy(wp);
        // сидя / за рулём / на велосипеде — подобрать длинный конец
        let sitT = s.sitting || s.drive ? 1 : s.ride ? 0.6 : 0;
        if (s.sitting === undefined && s.drive === undefined && s.ride === undefined && opts.hero && opts.hero.rig) {
          const B = opts.hero.rig.anim.bones, hp = B.hips.getWorldPosition(st.g).y, f = Math.min(B.foot_L.getWorldPosition(new T.Vector3()).y, B.foot_R.getWorldPosition(new T.Vector3()).y);
          sitT = sst(0.68, 0.5, hp - f);
        }
        st.sit += (sitT - st.sit) * (1 - Math.exp(-6 * dt));
        // направление полотна в осях родителя: вниз (тяжесть) + встречный воздух + лёгкий ветер
        parentBone.getWorldQuaternion(st.q).invert();
        const gl = st.g.set(0, -1, 0).applyQuaternion(st.q);
        const wind = 0.05 * Math.sin(st.t * 1.3) + 0.03 * Math.sin(st.t * 3.1 + 1);
        const vl = st.v.copy(st.vel).applyQuaternion(st.q);
        let dx = gl.x - vl.x * 0.17 + wind * 0.4, dy = gl.y - vl.y * 0.05, dz = gl.z - vl.z * 0.17 - 0.06 - Math.abs(wind) * 0.3;
        const pitch0 = clamp(Math.atan2(-dz, -dy), -0.06, 1.25) + 0.22 * st.sit, roll0 = clamp(Math.atan2(dx, -dy), -0.55, 0.55);
        const sp = Math.hypot(st.vel.x, st.vel.z);
        // пружины: первая кость держит направление «вниз + воздух»; дети держат то же мировое направление
        // (цель = нужный угол − уже набранный родителями) — получается мягкая волна с запаздыванием
        let accP = 0, accR = 0;
        bones.forEach((b, k) => {
          const a = st.ang[k], kk = [38, 26, 18][k] || 18, cc = 2 * Math.sqrt(kk) * 0.55;
          const fl = Math.sin(st.t * (2.2 + k * 0.8) + k) * (0.015 + 0.02 * k) * (0.4 + Math.min(1.5, sp) * 0.5);
          const wantP = pitch0 + 0.05 * k * Math.min(2, sp) + 0.12 * st.sit * k + fl, wantR = roll0 + fl * 0.6;
          const gP = wantP - accP, gR = wantR - accR;
          a.vx += (kk * (gP - a.x) - cc * a.vx) * dt; a.x += a.vx * dt;
          a.vz += (kk * (gR - a.z) - cc * a.vz) * dt; a.z += a.vz * dt;
          a.x = clamp(a.x, k === 0 ? -0.06 : -0.35, 1.3); a.z = clamp(a.z, -0.6, 0.6);
          b.rotation.set(a.x, 0, a.z);
          accP += a.x; accR += a.z;
        });
        // сидя — подобрать; при «разворачивании» (надевает) — свёрнут сверху
        const rv = sst(0, 1, kz.reveal);
        bones[0].scale.y = Math.max(0.02, rv);
        bones[1].scale.y = lerp(1, 0.34, st.sit);
        bones[2].scale.y = lerp(1, 0.55, st.sit);
      },
      dispose() {
        [mesh, outline].forEach(m => { if (m && m.parent) m.parent.remove(m); });
        bones.forEach(b => { if (b.parent) b.parent.remove(b); });
        g.dispose(); if (outline && outline.geometry !== g) outline.geometry.dispose();
        mat.dispose(); fringeMat.dispose(); if (outline) outline.material.dispose();
        if (skeleton) skeleton.dispose();
        tx.users = Math.max(0, tx.users - 1);
        /* последний каз снят: текстуры не держим в памяти (при следующем надевании перерисуются) */
        if (!tx.users && tx.alive) { tx.alive = false; ['pattern', 'border', 'fringe', 'grad'].forEach(k => { if (tx[k]) tx[k].dispose(); }); }
      },
    };
    return kz;
  }

  /* ---------------------------------------------------------------------
     НАДЕТЬ / СНЯТЬ
     --------------------------------------------------------------------- */
  let cur = null;
  function heroIndex(hero) {
    const m = hero && (hero.rig ? hero.rig.mesh : hero.statue ? hero.statue.mesh : null);
    return m && m.geometry && m.geometry.index ? m.geometry.index : null;
  }
  function wear(hero, anim, opts) {
    opts = opts || {};
    if (cur && cur.hero === hero) return cur.kz;
    if (cur) remove();
    if (beretHidden) hideBeret(hero, false);
    const T = opts.THREE || window.THREE;
    const kz = build(T, Object.assign({}, opts, { hero }));
    // берет и бант: вырожденные треугольники прямо в общем индексе (все копии геометрии героини его делят)
    const IA = heroIndex(hero), saved = [];
    if (IA && kz.F.hide && kz.F.hide.length) {
      const a = IA.array;
      kz.F.hide.forEach(t => { saved.push(t, a[t], a[t + 1], a[t + 2]); a[t + 1] = a[t]; a[t + 2] = a[t]; });
      IA.needsUpdate = true;
    }
    if (!kz.skinned) {
      const par = hero && hero.body ? hero.body : hero && hero.root ? hero.root : null;
      if (par) par.add(kz.group);
    }
    if (hero && hero.beret) { cur && void 0; kz.beretWas = hero.beret.visible; hero.beret.visible = false; }
    kz.reveal = opts.instant ? 1 : 0;
    cur = { hero, anim, kz, IA, saved, t: 0, instant: !!opts.instant };
    kz.update(0, {});
    return kz;
  }
  function remove() {
    if (!cur) return false;
    const { hero, kz, IA, saved } = cur;
    if (IA && saved.length) { const a = IA.array; for (let q = 0; q < saved.length; q += 4) { const t = saved[q]; a[t] = saved[q + 1]; a[t + 1] = saved[q + 2]; a[t + 2] = saved[q + 3]; } IA.needsUpdate = true; }
    if (hero && hero.beret) hero.beret.visible = kz.beretWas !== undefined ? kz.beretWas : true;
    if (kz.group.parent) kz.group.parent.remove(kz.group);
    kz.dispose();
    cur = null;
    return true;
  }
  function update(dt, s) {
    if (!cur) return;
    const kz = cur.kz;
    if (kz.reveal < 1) kz.reveal = Math.min(1, kz.reveal + (dt || 0) / 0.9);
    kz.update(dt, s);
  }

  // берет отдельно (без каза): розыгрыш пальтара на свадьбе «утащил берет — вернул с поклоном».
  // hideBeret(hero, true) — берет и бант пропадают (тот же приём с общим индексом), false — на месте. Без каза.
  const beretCache = new WeakMap();
  let beretHidden = null;
  function beretTris(hero) {
    const m = hero && (hero.rig ? hero.rig.mesh : hero.statue ? hero.statue.mesh : null), geo = m && m.geometry;
    if (!geo || !geo.index || !window.HERO3D || !window.HERO3D.rig) return null;
    if (beretCache.has(geo)) return beretCache.get(geo);
    const A = window.HERO3D.anchors || {}, C = (A.head || [0, 1.5, -0.093]).slice();
    const { cls, nBeret } = classify(geo, m.material && m.material.map, window.HERO3D.rig.bones.map(b => b[0]), C);
    const hide = [];
    if (nBeret >= 300) { const I = geo.index.array; for (let t = 0; t < I.length; t += 3) if (cls[I[t]] >= K_BERET || cls[I[t + 1]] >= K_BERET || cls[I[t + 2]] >= K_BERET) hide.push(t); }
    beretCache.set(geo, hide);
    return hide;
  }
  function hideBeret(hero, on) {
    if (cur) return false;                       // каз надет — берет и так спрятан, его не трогаем
    const IA = heroIndex(hero);
    if (on) {
      if (beretHidden || !IA) return !!beretHidden;
      const hide = beretTris(hero); if (!hide || !hide.length) return false;
      const a = IA.array, saved = [];
      hide.forEach(t => { saved.push(t, a[t], a[t + 1], a[t + 2]); a[t + 1] = a[t]; a[t + 2] = a[t]; });
      // под беретом у модели нет волос — на время прикрываем макушку «шапочкой» цвета волос (на кости головы)
      let capM = null;
      const T = window.THREE, B = hero.rig && hero.rig.anim && hero.rig.anim.bones;
      if (T && B && B.head) {
        const A = window.HERO3D.anchors || {}, C = A.head || [0, 1.5, -0.093], J = (window.HERO3D.rig.bones.find(b => b[0] === 'head') || [0, 0, [0, 1.335, -0.012]])[2];
        capM = new T.Mesh(new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), new T.MeshToonMaterial({ color: window.HERO3D.hair || '#3B1E0A' }));
        capM.position.set(C[0] - J[0], C[1] - J[1] + 0.01, C[2] - J[2] - 0.03); capM.scale.set(0.262, 0.27, 0.282); capM.rotation.x = -0.38; capM.name = 'kaz:hairCap';
        B.head.add(capM);
      }
      IA.needsUpdate = true; beretHidden = { IA, saved, capM };
      return true;
    }
    if (!beretHidden) return false;
    const { IA: I2, saved, capM } = beretHidden, a = I2.array;
    if (capM) { if (capM.parent) capM.parent.remove(capM); capM.geometry.dispose(); capM.material.dispose(); }
    for (let q = 0; q < saved.length; q += 4) { const t = saved[q]; a[t] = saved[q + 1]; a[t + 1] = saved[q + 2]; a[t + 2] = saved[q + 3]; }
    I2.needsUpdate = true; beretHidden = null;
    return true;
  }

  // реплики (plan2/kubachi_spec2.md §10, «Каз»): named — с названием, n — нейтрально (без «каз»)
  const lines = {
    offer: { text: 'Хочешь примерить каз? Он длинный — почти два с половиной метра!', n: 'Хочешь примерить праздничный платок? Он длинный-длинный!', level: 'B' },
    pattern: { text: 'Вышиваю золотой нитью. Чаще всего — цветы и пёрышки.', n: 'Вышиваю золотой нитью. Чаще всего — цветы и пёрышки.', level: 'A' },
    fringe: { text: 'Бахрому мы бережём. Перешиваем со старого платка на новый.', n: 'Бахрому мы бережём. Перешиваем со старого платка на новый.', level: 'A' },
    careful: { text: 'Только осторожно — он длинный!', n: 'Только осторожно — он длинный!', level: '-' },
    heroOn: { text: 'Ой, какой лёгкий! И цветочки блестят.', n: 'Ой, какой лёгкий! И цветочки блестят.', level: '-' },
    giveBack: { text: 'Каз остаётся дома, в горах. Приезжай — примеришь снова!', n: 'Платок остаётся в горах. Приезжай ещё!', level: 'B' },
  };

  V.kaz = {
    build, wear, remove, update, hideBeret,
    beretHidden: () => !!beretHidden,
    isWorn: () => !!cur,
    get current() { return cur ? cur.kz : null; },
    lines,
    line: (k, named) => { const l = lines[k]; return l ? ((named === undefined ? V.named !== false : named) ? l.text : l.n) : ''; },
    DIM, _fit: fitModel, _classify: classify,
  };
})();
