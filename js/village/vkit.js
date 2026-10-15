/* =====================================================================
   ГОРНОЕ СЕЛО: общий набор строителя (палитра, материалы, склейка, инстансы, текстуры, башня, зверята).
   Обычный <script>: глобальное window.VILLAGE, без модулей. Нужен THREE r149 (передаётся в makeKit).
   Все текстуры рисуются кодом на canvas (фото-референсы в игру не попадают).

   Главная идея склейки — ОДИН материал на всё каменное село: «атлас полос» 512×1024 из 8 полос
   (бут, крупный бут, тёсаный камень, штукатурка, синяя побелка, фальцевая кровля, плиты, ровный белый).
   У каждой вершины свой цвет и номер полосы; шейдер берёт fract(v) внутри своей полосы (textureGrad — без швов).
   Так кусок села 32 × 32 м — это 1 вызов отрисовки, а цвет дома задаёт цвет вершин.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  V.regions = V.regions || {};
  if (V.named === undefined) V.named = true;
  const PI = Math.PI, TAU = PI * 2;

  /* ---------- мелкие утилиты ---------- */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash2(x, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(x, z, oct = 3) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulRGB = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const mulRGB3 = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

  /* ---------- палитра (kubachi_visual.md §5.1; фото автора — главный источник) ---------- */
  const PAL = {
    tower: '#CDB48A', ashlarJoint: '#B29A72', rubble: '#A89A84', rubbleY: '#B8A684', ochre: '#C4A878', ochre2: '#D0B486',
    cream: '#EDE3CF', white: '#F3EFE6', pink: '#EBC6C0', lilac: '#D3C8E2', skyWall: '#C9DCEF', blue: '#4A90D8', blueHi: '#66AAE8', creamPlain: '#EFE6D2',
    tread: '#B5AA98', slab: '#BDB2A0', slabSeam: '#8E8474', yard: '#BDB3A2', parapetCap: '#A89A84',
    frameWhite: '#F4F4F0', frameBlue: '#6FA8D6', frameTurq: '#63AEB0', frameGreyblue: '#8FA3B5', glass: '#2E3F4A', glint: '#A9D2EA', warm: '#FFD99A',
    rail: '#B9593A', pipeRail: '#CFE0EE', steelTread: '#8E918C',
    silver: '#C2C6BF', silver2: '#B6BAB3', silver3: '#D0D3CC', silverOld: '#A4A8A1', seam: '#A9ADA7', rust: '#A9603F', rustStripe: '#C2703F', brown: '#9A5A3E', slate: '#6E7480', red: '#A04E44', bordo: '#8E5446',
    wood: '#8A6A4E', woodD: '#6E523C', doorBlue: '#3F78B8', doorTeal: '#4F8F86', bracket: '#9A7656', greyWood: '#9C958A',
    // трава осенью в горах — оливково-зелёная, не соломенная (p3, p5)
    grass: '#9CA25C', grass2: '#7F9250', mown: '#B0AA62', grassShade: '#727A48', hay: '#D9C27A', moss: '#8E8E4A',
    leafA: '#E0A030', leafB: '#C8702A', leafC: '#D9B44A', leafD: '#9C9A4A', poplar: '#2F4A32', poplar2: '#3E5E40', trunk: '#6E523C',
    rock: '#A9A39A', rock2: '#8E877F', lichen: '#B8B07A', dirt: '#B9A684',
    meadow: '#9E9C58', forestA: '#7C6A3A', forestB: '#56684A', forestC: '#B07A3A', haze: '#A9BCC6', haze2: '#C3D1DB',
    cloudTop: '#F6F8FA', cloudShade: '#DCE3EC', silverWare: '#D7DCE2', niello: '#34333D', gilt: '#E8C770', copper: '#C77D4F', bronze: '#A8803F',
    plateCobalt: '#3E78B5', plateTurq: '#5DB3B3', plateWhite: '#F4F1EA', geranium: '#D9455A', geraniumLeaf: '#5E8A4E', logEnd: '#C9A77A',
    snow: '#F7F9FB', snowGround: '#EEF2F6', snowShade: '#C9D6E6', bareBranch: '#8A7A6A',
  };
  // настроение света (§5.2): небо, полусфера, солнце, туман
  const MOODS = {
    day: { zen: '#3F78C2', hor: '#A6C8EA', hs: '#D6E2EE', hg: '#8C8A80', hi: 0.42, sun: '#FFF7EE', si: 0.7, dir: [-0.55, 0.62, 0.56], fog: '#D6E2EE', rim: ['#FFE8D0', 0.22], cloud: '#F6F8FA', cloudSh: '#DCE3EC', glow: 0 },
    evening: { zen: '#6A94CC', hor: '#F0D6BE', hs: '#F5D6C2', hg: '#B99A7E', hi: 0.50, sun: '#FFBF80', si: 0.84, dir: [-0.85, 0.22, 0.48], fog: '#F3D2C0', rim: ['#FFCFA6', 0.32], cloud: '#FCE3D2', cloudSh: '#EAD0D4', glow: 1 },   // QA: горизонт и солнце чуть теплее — «золотой час» читается
    fog: { zen: '#C9D5E2', hor: '#DDE3EA', hs: '#D6DEE6', hg: '#B8AE9C', hi: 0.75, sun: '#FFF4E6', si: 0.25, dir: [-0.4, 0.7, 0.5], fog: '#DDE3EA', rim: ['#FFFFFF', 0.12], cloud: '#F2F5F8', cloudSh: '#DCE3EA', glow: 0.3 },
    winter: { zen: '#AFC4DC', hor: '#E6EDF4', hs: '#E6EEF7', hg: '#DCE3EA', hi: 0.70, sun: '#FFF1E0', si: 0.5, dir: [-0.6, 0.36, 0.7], fog: '#E8EEF4', rim: ['#FFFFFF', 0.16], cloud: '#FFFFFF', cloudSh: '#E3E9F0', glow: 0.55 },
  };

  /* ---------- атлас полос ---------- */
  const NS = 8;                      // полос в атласе
  const S = { RUBBLE: 0, BIG: 1, ASHLAR: 2, PLASTER: 3, WASH: 4, ROOF: 5, SLAB: 6, FLAT: 7 };
  // метры на одну плитку полосы (ширина 512 px × высота 128 px)
  const SW = [3.2, 4.8, 3.2, 3.2, 3.2, 2.0, 4.0, 4.0], SH = [0.8, 1.2, 0.8, 0.8, 0.8, 0.5, 1.0, 1.0];

  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rrect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const css = (rgb, a) => `rgba(${Math.round(clamp(rgb[0], 0, 1) * 255)},${Math.round(clamp(rgb[1], 0, 1) * 255)},${Math.round(clamp(rgb[2], 0, 1) * 255)},${a === undefined ? 1 : a})`;

  function paintAtlas() {
    const [cv, c] = cnv(512, 1024);
    const R = rng(1010);
    // полоса i: рисуем «вверх ногами», чтобы y вверх в полосе = вверх в мире (текстура без flipY)
    const strip = (i, fn) => { c.save(); c.beginPath(); c.rect(0, i * 128, 512, 128); c.clip(); c.setTransform(1, 0, 0, -1, 0, (i + 1) * 128); fn(); c.restore(); };
    // повтор по краям: фигура рисуется со сдвигами ±512 / ±128
    const wrap = (fn) => { for (const dx of [-512, 0, 512]) for (const dy of [-128, 0, 128]) fn(dx, dy); };
    // бут: плоские вытянутые камни рядами, светлые швы; ex — масштаб (крупный бут)
    function rubble(i, o) {
      strip(i, () => {
        c.fillStyle = o.mortar; c.fillRect(0, 0, 512, 128);
        let rows = [], y = 0; while (y < 128) { const h = o.rh[0] + R() * (o.rh[1] - o.rh[0]); rows.push(h); y += h; }
        const k = 128 / y; rows = rows.map(h => h * k);
        let y0 = 0;
        rows.forEach(h => {
          let x = R() * 40;
          const xEnd = x + 512;
          while (x < xEnd - 4) {
            let w = o.sw[0] + R() * (o.sw[1] - o.sw[0]); if (xEnd - x - w < o.sw[0] * 0.6) w = xEnd - x;
            const g = o.gap, hh = h - g * (0.8 + R() * 0.6), yy = y0 + (h - hh) / 2 + (R() - 0.5) * 1.5;
            const tone = o.tones[Math.floor(R() * o.tones.length)], j = 0.96 + R() * 0.08;
            const col = mulRGB(hexRGB(tone), j), hiC = mixRGB(col, hexRGB(o.hi), 0.6), loC = mixRGB(col, hexRGB(o.lo), 0.6);
            const xx = x + g / 2, ww = w - g, rr = Math.min(hh * 0.45, 5);
            wrap((dx, dy) => {
              c.fillStyle = css(loC); rrect(c, xx + dx, yy + dy - 1.2, ww, hh, rr); c.fill();
              c.fillStyle = css(hiC); rrect(c, xx + dx, yy + dy + 1.2, ww, hh, rr); c.fill();
              c.fillStyle = css(col); rrect(c, xx + dx, yy + dy, ww, hh - 0.6, rr); c.fill();
            });
            x += w;
          }
          y0 += h;
        });
        // лёгкий шум
        for (let n = 0; n < 1400; n++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; c.fillRect(R() * 512, R() * 128, 1 + R() * 2, 1 + R() * 2); }
      });
    }
    rubble(S.RUBBLE, { mortar: '#CFCBC0', rh: [12, 22], sw: [28, 72], gap: 3, tones: ['#B2AB9E', '#A0998D', '#958F85', '#BEB8AA', '#8A847A', '#A9A295', '#B8B1A2'], hi: '#DAD6CB', lo: '#6E6962' });   // polish: камень светлее (p3: светло-серая кладка)   // бут светлее: на p1/p3 стены серо-бежевые
    rubble(S.BIG, { mortar: '#C9BEA8', rh: [16, 30], sw: [34, 70], gap: 3.5, tones: ['#ADA08A', '#9A8E7B', '#8C8171', '#BDAF96', '#837766'], hi: '#D2C7B0', lo: '#6A5F51' });
    // тёсаный камень башни: 3 ряда на полосу (0,267 м), блоки 0,45–0,9 м, вразбежку
    strip(S.ASHLAR, () => {
      c.fillStyle = '#B29A72'; c.fillRect(0, 0, 512, 128);
      const ch = 128 / 3;
      for (let r = 0; r < 3; r++) {
        let x = r * 37 + R() * 20; const xEnd = x + 512;
        while (x < xEnd - 4) {
          let w = 72 + R() * 72; if (xEnd - x - w < 40) w = xEnd - x;
          const base = hexRGB('#CDB48A'), j = 0.93 + R() * 0.12, col = mulRGB(mixRGB(base, hexRGB(R() < 0.3 ? '#D9C49A' : '#C4A878'), R() * 0.6), j);
          wrap((dx, dy) => {
            c.fillStyle = css(mulRGB(col, 0.86)); c.fillRect(x + 1 + dx, r * ch + 1 + dy, w - 2, ch - 2);
            c.fillStyle = css(col); c.fillRect(x + 1.5 + dx, r * ch + 2.2 + dy, w - 3, ch - 3.4);
            c.fillStyle = css(mixRGB(col, [1, 0.97, 0.9], 0.35)); c.fillRect(x + 1.5 + dx, r * ch + ch - 2.6 + dy, w - 3, 1.2);
          });
          x += w;
        }
      }
      for (let n = 0; n < 1600; n++) { c.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.07)' : 'rgba(60,40,20,0.06)'; c.fillRect(R() * 512, R() * 128, 1 + R() * 2.5, 1 + R() * 1.5); }
    });
    // штукатурка: почти белая, мягкий шум
    strip(S.PLASTER, () => {
      c.fillStyle = 'rgb(246,244,240)'; c.fillRect(0, 0, 512, 128);
      for (let n = 0; n < 900; n++) { const a = 0.025 + R() * 0.03; c.fillStyle = R() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(90,80,70,${a})`; const s = 2 + R() * 7; wrap((dx, dy) => { c.beginPath(); c.arc(R() * 512 + dx * 0, R() * 128, s, 0, TAU); c.fill(); }); }
    });
    // синяя побелка: белая основа, под ней едва читается кладка (как на p2), шершавый шум
    strip(S.WASH, () => {
      c.fillStyle = 'rgb(226,226,226)'; c.fillRect(0, 0, 512, 128);
      let y0 = 0; const rows = []; let y = 0; while (y < 128) { const h = 14 + R() * 10; rows.push(h); y += h; }
      const k = 128 / y;
      rows.forEach(h0 => { const h = h0 * k; let x = R() * 30; const xEnd = x + 512;
        while (x < xEnd - 4) { let w = 30 + R() * 46; if (xEnd - x - w < 20) w = xEnd - x; const v = 0.95 + R() * 0.05;
          wrap((dx, dy) => { c.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * v)},${Math.round(255 * v)})`; rrect(c, x + 2 + dx, y0 + 2 + dy, w - 4, h - 4, 5); c.fill(); });
          x += w; }
        y0 += h; });
      for (let n = 0; n < 2400; n++) { const a = 0.04 + R() * 0.05; c.fillStyle = R() < 0.55 ? `rgba(255,255,255,${a})` : `rgba(0,0,30,${a})`; c.fillRect(R() * 512, R() * 128, 1 + R() * 3, 1 + R() * 3); }
    });
    // фальцевая кровля: светлое поле, стоячий фальц каждые 0,5 м (128 px), лёгкие продольные потёки
    strip(S.ROOF, () => {
      c.fillStyle = 'rgb(240,241,239)'; c.fillRect(0, 0, 512, 128);
      for (let n = 0; n < 60; n++) { const x = R() * 512; c.fillStyle = `rgba(80,85,80,${0.03 + R() * 0.05})`; c.fillRect(x, 0, 2 + R() * 10, 128); }
      // листы разного оттенка (p5: лоскутное «море крыш»)
      for (let i = 0; i < 4; i++) { const v = R(); c.fillStyle = v < 0.35 ? 'rgba(70,74,70,0.10)' : v < 0.6 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0)'; c.fillRect(i * 128 + 9, 0, 119, 128); }
      for (let i = 0; i < 4; i++) { const x = i * 128 + 2; c.fillStyle = 'rgb(255,255,255)'; c.fillRect(x, 0, 3, 128); c.fillStyle = 'rgb(150,155,150)'; c.fillRect(x + 3, 0, 4, 128); c.fillStyle = 'rgb(200,204,199)'; c.fillRect(x + 7, 0, 3, 128); }
    });
    // плиты: крупные неровные плиты 0,6–1,2 м, тёмные швы
    strip(S.SLAB, () => {
      c.fillStyle = 'rgb(150,142,128)'; c.fillRect(0, 0, 512, 128);
      const rows = [52, 40, 36]; let y0 = 0;
      rows.forEach(h => { let x = R() * 60; const xEnd = x + 512;
        while (x < xEnd - 10) { let w = 76 + R() * 80; if (xEnd - x - w < 50) w = xEnd - x; const v = 0.9 + R() * 0.1;
          wrap((dx, dy) => { c.fillStyle = `rgb(${Math.round(250 * v)},${Math.round(246 * v)},${Math.round(238 * v)})`; rrect(c, x + 2.5 + dx + (R() - 0.5) * 2, y0 + 2.5 + dy, w - 5, h - 5, 6); c.fill(); });
          x += w; }
        y0 += h; });
      for (let n = 0; n < 1500; n++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; c.fillRect(R() * 512, R() * 128, 1 + R() * 2, 1 + R() * 2); }
    });
    strip(S.FLAT, () => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 512, 128); });
    // polish 14.10: каждая полоса — два повтора по высоте (атлас 512×2048). Шейдер берёт середину полосы и у шва fract
    // переходит на сдвинутую на полплитки координату — без textureGrad и без «строчки» швов на мощении (низкое качество)
    const [cv2, c2] = cnv(512, 2048);
    for (let i = 0; i < NS; i++) { c2.drawImage(cv, 0, i * 128, 512, 128, 0, i * 256, 512, 128); c2.drawImage(cv, 0, i * 128, 512, 128, 0, i * 256 + 128, 512, 128); }
    return cv2;
  }

  // остекление: 4 плитки 128 × 256 — окно с бликом, окно, галерея G1 (2 × 3 стекла), галерея G2 (высокая створка).
  // Альфа: 1 — рама/бордюр, 0,5 — стекло (маска тёплого света в окнах вечером).
  function paintGlazing() {
    const [cv, c] = cnv(512, 256);
    const glassGrad = (x, y, w, h) => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(132,160,178,0.5)'); g.addColorStop(0.55, 'rgba(92,116,132,0.5)'); g.addColorStop(1, 'rgba(70,90,104,0.5)'); return g; };   // стекло отражает небо (p1)
    const glass = (x, y, w, h, glint) => {
      c.clearRect(x, y, w, h); c.fillStyle = glassGrad(x, y, w, h); c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(20,28,34,0.5)'; c.fillRect(x, y, w, Math.max(2, h * 0.05)); c.fillRect(x, y, Math.max(2, w * 0.07), h);   // тень откоса
      if (glint) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = 'rgba(169,210,234,0.5)'; c.beginPath(); c.moveTo(x + w * 0.55, y); c.lineTo(x + w * 0.8, y); c.lineTo(x + w * 0.25, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.restore(); }
    };
    // окно: бордюр (белая штукатурка), рама, две створки + фрамуга
    const win = (ox, glint) => {
      c.fillStyle = '#EFEBE2'; c.fillRect(ox, 0, 128, 256);
      const bx = 13, by = 18, fw = 128 - 2 * bx, fh = 256 - 2 * by;   // рама
      c.fillStyle = '#FFFFFF'; c.fillRect(ox + bx, by, fw, fh);
      const t = 6, gx = ox + bx + t, gy = by + t, gw = fw - 2 * t, gh = fh - 2 * t, tr = gh * 0.3;
      glass(gx, gy, gw, tr - 3, glint); glass(gx, gy + tr + 3, gw / 2 - 3, gh - tr - 3, glint); glass(gx + gw / 2 + 3, gy + tr + 3, gw / 2 - 3, gh - tr - 3, false);
    };
    win(0, true); win(128, false);
    // G1: стойка 0,08 по краям (по 0,04), горбыльки, 2 × 3 стекла
    { const ox = 256; c.fillStyle = '#FFFFFF'; c.fillRect(ox, 0, 128, 256);
      const e = 6, m = 4, gw = (128 - 2 * e - m) / 2, gh = (256 - 2 * e - 2 * m) / 3;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) glass(ox + e + i * (gw + m), e + j * (gh + m), gw, gh, (i + j) % 3 === 0); }
    { const ox = 384; c.fillStyle = '#FFFFFF'; c.fillRect(ox, 0, 128, 256);
      const e = 7, top = 256 * (0.4 / 1.5);
      glass(ox + e, e, 128 - 2 * e, top - e - 3, false); glass(ox + e, top + 3, 128 - 2 * e, 256 - top - e - 3, true); }
    return cv;
  }

  // мягкий шум облаков 256² (бесшовный)
  function paintCloud() {
    const N = 256, [cv, c] = cnv(N, N), img = c.createImageData(N, N), d = img.data;
    const per = (x, y, p) => { // периодический value-noise
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const h = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p);
      const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), dd = h(xi + 1, yi + 1);
      return a + (b - a) * u + (cc - a) * w + (a - b - cc + dd) * u * w;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0, a = 0.55, f = 4, n = 0; for (let o = 0; o < 5; o++) { s += a * per(x / N * f, y / N * f, f); n += a; a *= 0.5; f *= 2; }
      s /= n; const v = sst(0.38, 0.72, s), i = (y * N + x) * 4, l = 225 + 30 * sst(0.45, 0.9, s);
      d[i] = l; d[i + 1] = l + 2; d[i + 2] = Math.min(255, l + 6); d[i + 3] = Math.round(255 * v);
    }
    c.putImageData(img, 0, 0); return cv;
  }

  // резные камни (пасхалки): 4 рельефа 128² — парные львы с общей головой, олень, две птицы, вьющаяся ветка. Без надписей.
  function paintCarved() {
    const [cv, c] = cnv(512, 128);
    const relief = (ox, draw) => {
      c.fillStyle = '#C4B596'; c.fillRect(ox, 0, 128, 128);
      c.strokeStyle = '#E2D6BC'; c.lineWidth = 4; c.strokeRect(ox + 6, 6, 116, 116);
      c.strokeStyle = '#8E8068'; c.lineWidth = 2; c.strokeRect(ox + 9, 9, 110, 110);
      const pass = (dx, dy, col) => { c.save(); c.translate(ox + dx, dy); c.fillStyle = col; c.strokeStyle = col; draw(c); c.restore(); };
      pass(-1.5, -1.5, '#E6DAC0'); pass(1.5, 1.5, '#7E7058'); pass(0, 0, '#B9A988');
    };
    relief(0, c => { // парные львы с одной головой
      c.beginPath(); c.arc(64, 44, 13, 0, TAU); c.fill();
      [-1, 1].forEach(s => { c.beginPath(); c.ellipse(64 + s * 26, 76, 24, 14, s * 0.15, 0, TAU); c.fill(); c.fillRect(64 + s * 40 - 4, 82, 8, 24); c.fillRect(64 + s * 14 - 4, 82, 8, 24);
        c.lineWidth = 5; c.beginPath(); c.moveTo(64 + s * 48, 70); c.quadraticCurveTo(64 + s * 60, 52, 64 + s * 50, 40); c.stroke(); });
      c.beginPath(); c.moveTo(52, 56); c.lineTo(76, 56); c.lineTo(64, 70); c.fill();
    });
    relief(128, c => { // олень
      c.beginPath(); c.ellipse(60, 74, 28, 14, 0, 0, TAU); c.fill(); [40, 50, 70, 80].forEach(x => c.fillRect(x - 3, 80, 6, 28));
      c.beginPath(); c.moveTo(82, 68); c.lineTo(92, 42); c.lineTo(100, 44); c.lineTo(92, 72); c.fill(); c.beginPath(); c.ellipse(97, 40, 9, 6, 0.3, 0, TAU); c.fill();
      c.lineWidth = 3.5; c.beginPath(); c.moveTo(95, 34); c.lineTo(88, 16); c.moveTo(91, 24); c.lineTo(80, 20); c.moveTo(99, 34); c.lineTo(108, 16); c.moveTo(104, 24); c.lineTo(114, 22); c.stroke();
    });
    relief(256, c => { // две птицы друг к другу
      [-1, 1].forEach(s => { c.save(); c.translate(64 + s * 22, 70); c.scale(-s, 1);
        c.beginPath(); c.ellipse(0, 0, 18, 12, 0.2, 0, TAU); c.fill(); c.beginPath(); c.arc(14, -14, 8, 0, TAU); c.fill(); c.beginPath(); c.moveTo(20, -16); c.lineTo(30, -12); c.lineTo(20, -10); c.fill();
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(-30, 12); c.lineTo(-22, -4); c.fill(); c.fillRect(-2, 10, 4, 18); c.restore(); });
      c.lineWidth = 3; c.beginPath(); c.moveTo(64, 98); c.lineTo(64, 40); c.stroke(); c.beginPath(); c.arc(64, 36, 6, 0, TAU); c.fill();
    });
    relief(384, c => { // вьющаяся ветка (тутта: ось и парные побеги)
      c.lineWidth = 4; c.beginPath(); c.moveTo(64, 112); c.lineTo(64, 16); c.stroke();
      for (let i = 0; i < 4; i++) { const y = 96 - i * 22; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(64, y); c.quadraticCurveTo(64 + s * 26, y - 4, 64 + s * 30, y - 18); c.stroke(); c.beginPath(); c.ellipse(64 + s * 30, y - 20, 6, 4, s * 0.8, 0, TAU); c.fill(); }); }
    });
    return cv;
  }

  // лицо зверька (копия подхода игры: глаза, щёчки, нос, рот)
  function faceCanvas(f, closed) {
    const [cv, c] = cnv(256, 256);
    c.scale(0.5, 0.5);
    const E = (x, y, rx, ry, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.globalAlpha = 1; };
    const L = (d, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)); };
    const ex = f.ex || 92, ey = f.ey || 360, er = f.er || 34, INK = '#2E2A3B';
    if (f.muzzle) E(256, ey + 70, f.muzzleW || 104, f.muzzleH || 66, f.muzzle);
    if (f.stripe) { c.fillStyle = f.stripe; c.beginPath(); c.moveTo(256 - 26, ey - 150); c.quadraticCurveTo(256, ey - 170, 256 + 26, ey - 150); c.lineTo(256 + 16, ey + 40); c.lineTo(256 - 16, ey + 40); c.closePath(); c.fill(); }
    if (f.bands) { c.fillStyle = f.bands; [-1, 1].forEach(s => { c.beginPath(); c.ellipse(256 + s * ex * 0.95, ey - 60, er * 1.15, 150, s * 0.12, 0, TAU); c.fill(); }); }
    if (f.disc) { E(256 - ex, ey, er * 2.3, er * 2.3, f.disc); E(256 + ex, ey, er * 2.3, er * 2.3, f.disc); }
    if (f.mask) { c.fillStyle = f.mask; [-1, 1].forEach(s => { c.beginPath(); c.ellipse(256 + s * ex, ey + 6, er * 1.9, er * 1.25, s * -0.35, 0, TAU); c.fill(); }); }
    if (!f.noBlush) { E(256 - ex - 66, ey + 64, 30, 17, '#F59AAE', 0.55); E(256 + ex + 66, ey + 64, 30, 17, '#F59AAE', 0.55); }
    [-1, 1].forEach(sd => {
      const x = 256 + sd * ex;
      if (f.white) E(x, ey, er * 1.25, er * 1.25, '#FFFFFF');
      if (closed) L(`M${x - er * 0.9},${ey + 4} Q${x},${ey - er * 0.9} ${x + er * 0.9},${ey + 4}`, INK, 9);
      else { E(x, ey, er * 0.78, er, INK); E(x + er * 0.28, ey - er * 0.36, er * 0.3, er * 0.3, '#FFFFFF'); }
      if (f.lash && !closed) L(`M${x + sd * er * 0.7},${ey - er * 0.7} L${x + sd * er * 1.15},${ey - er * 1.05}`, INK, 6);
      if (f.glasses) { c.strokeStyle = f.glasses; c.lineWidth = 7; c.beginPath(); c.arc(x, ey, er * 1.45, 0, TAU); c.stroke(); }
    });
    if (f.glasses) L(`M${256 - ex + er * 1.45},${ey} Q256,${ey - 14} ${256 + ex - er * 1.45},${ey}`, f.glasses, 6);
    if (f.beak) { c.fillStyle = f.beak; c.beginPath(); c.moveTo(256 - 22, ey + 30); c.lineTo(256 + 22, ey + 30); c.lineTo(256, ey + 78); c.closePath(); c.fill(); }
    if (f.nose) E(256, ey + 58, f.noseW || 17, f.noseH || 12, f.nose);
    if (f.mouth === 'w') L(`M${256 - 26},${ey + 86} Q${256 - 13},${ey + 102} 256,${ey + 86} Q${256 + 13},${ey + 102} ${256 + 26},${ey + 86}`, '#6B3A48', 7);
    else if (f.mouth === 'smile') L(`M${256 - 24},${ey + 88} Q256,${ey + 108} ${256 + 24},${ey + 88}`, '#6B3A48', 7);
    return cv;
  }

  // табличка / вывеска: canvas с текстом
  function signCanvas(text, o = {}) {
    const fs = o.size || 64, pad = o.pad || 34;
    const [c0, x0] = cnv(8, 8); x0.font = `${o.w || 900} ${fs}px ${o.font || 'Nunito'}, system-ui, sans-serif`;
    const lines = String(text).split('\n'), tw = Math.max(...lines.map(l => x0.measureText(l).width));
    const W = Math.min(2048, Math.ceil(tw + pad * 2)), H = Math.ceil(fs * 1.25 * lines.length + pad * 1.2);
    const [cv, c] = cnv(W, H);
    c.fillStyle = o.bg || '#FFFDF9'; rrect(c, 2, 2, W - 4, H - 4, o.r === undefined ? 18 : o.r); c.fill();
    if (o.border) { c.strokeStyle = o.border; c.lineWidth = 6; rrect(c, 7, 7, W - 14, H - 14, (o.r === undefined ? 18 : o.r) - 4); c.stroke(); }
    c.font = `${o.w || 900} ${fs}px ${o.font || 'Nunito'}, system-ui, sans-serif`; c.fillStyle = o.fg || '#3A2E3F'; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
    return cv;
  }

  /* =====================================================================
     НАБОР НА ОДНУ СЦЕНУ
     ===================================================================== */
  /* ---------- облака на небе (polish 14.10, p4: голубое небо с мягкими облаками) ----------
     4 «пухлых» облачка 256×128 в атласе 512×256: белый верх, голубовато-серый низ, плоское донышко, мягкий край (toon).
     skyClouds(T, o) → одна сетка (1 вызов): 12–16 квадов на куполе радиуса o.radius вокруг (0,0,0) — ставить в позицию камеры,
     как небо. userData.setMood(name) — оттенок: день белый, вечер персиковый, туман/зима — скрыто (зимой остаётся дымка). */
  function paintPuffs() {
    const [cv, c] = cnv(512, 256), R = rng(77);
    for (let k = 0; k < 4; k++) {
      const ox = (k % 2) * 256, oy = Math.floor(k / 2) * 128, base = oy + 104, blobs = [];
      let x = ox + 34; const end = ox + 222;
      while (x < end) { const r = Math.min(16 + R() * 26 * (1 - Math.abs((x - ox - 128) / 128) * 0.6), ox + 247 - x, x - ox - 9); blobs.push([x, base - r * (0.45 + R() * 0.35) - (k === 3 ? 6 : 0), r]); x += r * (0.8 + R() * 0.5); }
      const shape = (dy, kr) => { c.beginPath(); blobs.forEach(([bx, by, br]) => { c.moveTo(bx + br * kr, by + dy); c.arc(bx, by + dy, br * kr, 0, TAU); }); const x0 = blobs[0][0], x1 = blobs[blobs.length - 1][0]; c.rect(x0, base - 16 + dy, x1 - x0, 16); c.fill(); };
      c.save(); c.beginPath(); c.rect(ox, oy, 256, 128); c.clip();
      c.filter = 'blur(1.6px)';
      c.fillStyle = 'rgba(214,226,240,0.96)'; shape(0, 1);                 // тень снизу
      // светлый верх: те же клубы чуть выше и меньше; граница с тенью — волной по клубам (не прямой чертой)
      c.fillStyle = 'rgba(255,255,255,1)'; c.save(); c.beginPath(); c.moveTo(ox, oy);
      for (let xx = 0; xx <= 256; xx += 8) { const bb = blobs.reduce((m, [bx, by, br]) => Math.max(m, br * br - (ox + xx - bx) * (ox + xx - bx) > 0 ? br * 0.18 : 0), 0); c.lineTo(ox + xx, base - 12 + Math.sin(xx * 0.09 + k) * 3 - bb); }
      c.lineTo(ox + 256, oy); c.closePath(); c.clip();
      c.beginPath(); blobs.forEach(([bx, by, br]) => { c.moveTo(bx + br * 0.95, by - 5); c.arc(bx, by - 5, br * 0.95, 0, TAU); }); c.fill(); c.restore();
      c.filter = 'none'; c.restore();
    }
    return cv;
  }
  function skyClouds(T, o = {}) {
    const keepF = o.keep || (x => x), R = rng(o.seed || 909), N = o.count || 14, rad = o.radius || 1400, D2 = PI / 180;
    const cvs = paintPuffs(), map = keepF(new T.CanvasTexture(cvs)); map.anisotropy = 2;
    const P = [], U = [], Cc = [], I = [];
    const hero = o.hero || [];   // [азимут°, высота°, масштаб] — облака там, куда смотрят главные кадры
    for (let i = 0; i < N + hero.length; i++) {
      const H = hero[i - N], high = H ? H[1] > 11 : R() < 0.3, az = (H ? H[0] : (i + R() * 0.75) / N * 360 + (o.az0 || 0)) * D2, el = (H ? H[1] : high ? 12 + R() * 12 : (o.elMin || 3.5) + R() * 7) * D2;
      const d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], r = [Math.cos(az), 0, -Math.sin(az)];
      let u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]]; if (u[1] < 0) u = u.map(v => -v);
      const w = rad * (0.15 + R() * 0.13) * (high ? 1.3 : 1) * (H ? H[2] : 1), h = w * 0.5, cx = d[0] * rad, cy = d[1] * rad, cz = d[2] * rad, k = Math.floor(R() * 4), u0 = (k % 2) * 0.5, v0 = Math.floor(k / 2) * 0.5, fl = R() < 0.5;
      const hz = high ? 1 : 0.94 + 0.06 * (el / (12 * D2));   // у горизонта чуть в дымку
      const i0 = P.length / 3;
      [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([a, b]) => {
        P.push(cx + r[0] * a * w + u[0] * b * h, cy + r[1] * a * w + u[1] * b * h, cz + r[2] * a * w + u[2] * b * h);
        U.push(u0 + ((fl ? -a : a) + 0.5) * 0.5, 1 - (v0 + (0.5 - b) * 0.5)); Cc.push(hz, hz, hz);
      });
      I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
    const g = keepF(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); g.setIndex(I); g.computeBoundingSphere();
    // BackSide: камера всегда в центре купола, лицевая сторона квадов смотрит наружу (r × u = d). DoubleSide у прозрачного
    // материала в r149 рисуется в два прохода — вдвое больше заливки и +1 вызов; одной стороны хватает, картинка та же
    const mat = keepF(new T.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: T.BackSide }));
    const m = new T.Mesh(g, mat); m.name = 'skyClouds'; m.renderOrder = o.order || 10; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
    const TINT = { day: ['#FFFFFF', 0.95], evening: ['#FFE6D6', 0.88], clear: ['#FFFFFF', 0.95] };
    m.userData.setMood = (name, winter) => { const t = !winter && TINT[name]; m.visible = !!t; if (t) { mat.color.set(t[0]); mat.opacity = t[1]; m.userData.op = t[1]; } };
    return m;
  }

  function makeKit(T, o = {}) {
    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const GV = [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255];
    const gd = new Uint8Array(64); GV.forEach((v, i) => gd.set([v, v, v, 255], i * 4));
    const GRAD = keep(new T.DataTexture(gd, 16, 1, T.RGBAFormat)); GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    const RIM = { col: { value: new T.Color(o.rim ? o.rim[0] : '#FFE8D0') }, str: { value: o.rim ? o.rim[1] : 0.22 } };
    function addRim(mat, k = 1) {
      const kU = { value: k }, prev = mat.onBeforeCompile && mat.hasOwnProperty('onBeforeCompile') ? mat.onBeforeCompile : null, prevKey = mat.hasOwnProperty('customProgramCacheKey') ? mat.customProgramCacheKey : null;
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        Object.assign(sh.uniforms, { rimCol: RIM.col, rimStr: RIM.str, rimK: kU });
        sh.fragmentShader = 'uniform vec3 rimCol;\nuniform float rimStr;\nuniform float rimK;\n' + sh.fragmentShader.replace('#include <output_fragment>',
          'float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\noutgoingLight += rimCol * (rimStr * rimK * smoothstep(0.55, 0.95, rimF));\n#include <output_fragment>');
      };
      mat.customProgramCacheKey = () => 'vrim' + (prevKey ? prevKey.call(mat) : '');
      return mat;
    }
    const toon = (c, x = {}) => keep(new T.MeshToonMaterial(Object.assign({ color: new T.Color(c), gradientMap: GRAD }, x)));
    const ANISO = o.aniso || 1, GRADS = o.grad !== false;
    const tex = (cv, x = {}) => { const t = keep(new T.CanvasTexture(cv)); t.anisotropy = x.aniso || ANISO; if (x.flipY === false) t.flipY = false; if (x.repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t; };

    /* --- атлас полос и его материал --- */
    const atlasTex = tex(paintAtlas(), { flipY: false });
    atlasTex.wrapS = T.RepeatWrapping; atlasTex.wrapT = T.ClampToEdgeWrapping; atlasTex.anisotropy = ANISO;
    function stripPatch(mat, tag) {
      mat.onBeforeCompile = (sh, r) => {
        const isGl2 = !!(r && r.capabilities && r.capabilities.isWebGL2), gl2 = GRADS && isGl2, dup = !GRADS && isGl2;
        sh.vertexShader = 'attribute float strip;\nvarying float vStrip;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrip = strip;');
        const k = (1 / NS).toFixed(6), kh = (0.5 / NS).toFixed(6);
        // полоса = 2 повтора: f = fract(v − ½) + ½ ∈ [½, 1½), в полосе s = f/2 (середина полосы, фаза узора прежняя).
        // grad — textureGrad по непрерывному vUv (высокое качество, как было); dup — у шва этой f (fwidth ≈ 1) берём
        // f2 = fract(v) (её шов на полплитки дальше), обычный texture2D — без textureGrad и без «строчки» швов
        sh.fragmentShader = 'varying float vStrip;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
          float aF = fract(vUv.y - 0.5) + 0.5;
          ${dup ? 'aF = mix(aF, fract(vUv.y), step(0.5, fwidth(aF)));' : ''}
          vec2 aUv = vec2(vUv.x, (aF * 0.5 + floor(vStrip + 0.5)) * ${k});
          ${gl2 ? `vec4 sampledDiffuseColor = textureGrad(map, aUv, dFdx(vUv) * vec2(1.0, ${kh}), dFdy(vUv) * vec2(1.0, ${kh}));` : 'vec4 sampledDiffuseColor = texture2D(map, aUv);'}
          diffuseColor *= sampledDiffuseColor;`);
      };
      mat.customProgramCacheKey = () => 'vstrip' + tag + (GRADS ? 'g' : 'd');
      return mat;
    }
    // «запечённый» режим (низкое качество): свет посчитан в цвет вершин, шейдер без освещения — вдвое дешевле на телефоне
    const BAKED = !!o.baked;
    const basic = x => keep(new T.MeshBasicMaterial(x));
    const atlasMat = BAKED ? stripPatch(basic({ map: atlasTex, vertexColors: true }), 'bf') : addRim(stripPatch(toon('#FFFFFF', { map: atlasTex, vertexColors: true }), 'f'), 0.7);
    const atlasMatD = BAKED ? stripPatch(basic({ map: atlasTex, vertexColors: true, side: T.DoubleSide }), 'bd') : addRim(stripPatch(toon('#FFFFFF', { map: atlasTex, vertexColors: true, side: T.DoubleSide }), 'd'), 0.7);
    const vcMat = BAKED ? basic({ vertexColors: true }) : addRim(toon('#FFFFFF', { vertexColors: true }), 0.6);
    const vcMatD = BAKED ? basic({ vertexColors: true, side: T.DoubleSide }) : toon('#FFFFFF', { vertexColors: true, side: T.DoubleSide });
    const basicVC = keep(new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
    const basicVCD = keep(new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: T.DoubleSide }));
    const farVC = keep(new T.MeshLambertMaterial({ vertexColors: true, fog: false }));

    /* --- остекление: инстансы с номером плитки и тёплым светом --- */
    const glazTex = tex(paintGlazing());
    const GLOW = { amt: { value: 0 }, col: { value: new T.Color(PAL.warm) } };
    const glazMat = BAKED ? basic({ map: glazTex }) : toon('#FFFFFF', { map: glazTex });
    const glazPatch = sh => {
      Object.assign(sh.uniforms, { uGlow: GLOW.amt, uGlowCol: GLOW.col });
      sh.vertexShader = 'attribute float aTile;\nattribute float aGlow;\nvarying float vTile;\nvarying float vGlowI;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTile = aTile; vGlowI = aGlow;');
      sh.fragmentShader = 'uniform float uGlow;\nuniform vec3 uGlowCol;\nvarying float vTile;\nvarying float vGlowI;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D(map, vec2((clamp(vUv.x, 0.02, 0.98) + floor(vTile + 0.5)) * 0.25, vUv.y));\ndiffuseColor.rgb *= sampledDiffuseColor.rgb;\nfloat gMask = clamp((1.0 - sampledDiffuseColor.a) * 2.0, 0.0, 1.0);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowCol * (uGlow * vGlowI * gMask);')
        .replace('#include <envmap_fragment>', '#include <envmap_fragment>\n' + (BAKED ? 'outgoingLight += uGlowCol * (uGlow * vGlowI * gMask);' : ''));
    };
    glazMat.onBeforeCompile = glazPatch;
    glazMat.customProgramCacheKey = () => 'vglaz' + (BAKED ? 'b' : '');
    // то же для склеенной сетки (merged): номер плитки и свет — атрибуты вершин, цвет рамы — цвет вершин
    const glazMatV = BAKED ? basic({ map: glazTex, vertexColors: true }) : toon('#FFFFFF', { map: glazTex, vertexColors: true });
    glazMatV.onBeforeCompile = glazPatch;
    glazMatV.customProgramCacheKey = () => 'vglazv' + (BAKED ? 'b' : '');

    // инстансный матовый материал (деревья, листы кровли, трубы): цвет вершин × цвет инстанса
    const instMat = BAKED ? basic({ vertexColors: true }) : addRim(toon('#FFFFFF', { vertexColors: true }), 0.5);

    /* ---------------------------------------------------------------
       BAKER: накопитель треугольников (позиция, нормаль, uv, цвет, полоса)
       --------------------------------------------------------------- */
    function Baker(kind) {
      this.kind = kind || 'atlas'; this.P = []; this.N = []; this.U = []; this.C = []; this.Sx = []; this.I = []; this.n = 0;
    }
    const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _n = new T.Vector3();
    // нормаль грани по трём точкам (против часовой — наружу)
    function faceN(a, b, c) { _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _n.crossVectors(_a, _b); const l = _n.length() || 1; return [_n.x / l, _n.y / l, _n.z / l]; }
    function autoUV(p, n, s) {
      const w = SW[s] || 4, h = SH[s] || 1;
      if (Math.abs(n[1]) < 0.6) { const l = Math.hypot(n[0], n[2]) || 1, rx = n[2] / l, rz = -n[0] / l; return [(p[0] * rx + p[2] * rz) / w, p[1] / h]; }
      return [p[0] / w, p[2] / h];
    }
    Baker.prototype.vert = function (p, nn, uv, col, s) {
      this.P.push(p[0], p[1], p[2]); this.N.push(nn[0], nn[1], nn[2]); this.U.push(uv[0], uv[1]); this.C.push(col[0], col[1], col[2]); this.Sx.push(s); return this.n++;
    };
    // четырёхугольник a,b,c,d (против часовой снаружи). col: [r,g,b] | [c0,c1,c2,c3] | fn(p) ; uv: 4 пары или null (авто)
    Baker.prototype.quad = function (a, b, c, d, col, s = S.FLAT, uv = null, nn = null) {
      const n = nn || faceN(a, b, c), pts = [a, b, c, d], i0 = this.n;
      for (let i = 0; i < 4; i++) {
        const p = pts[i], cc = typeof col === 'function' ? col(p, i) : Array.isArray(col[0]) ? col[i] : col;
        this.vert(p, n, uv ? uv[i] : autoUV(p, n, s), cc, s);
      }
      this.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    };
    Baker.prototype.tri = function (a, b, c, col, s = S.FLAT, uv = null, nn = null) {
      const n = nn || faceN(a, b, c), pts = [a, b, c], i0 = this.n;
      for (let i = 0; i < 3; i++) { const p = pts[i], cc = typeof col === 'function' ? col(p, i) : Array.isArray(col[0]) ? col[i] : col; this.vert(p, n, uv ? uv[i] : autoUV(p, n, s), cc, s); }
      this.I.push(i0, i0 + 1, i0 + 2);
    };
    // рамка-система координат: начало, поворот вокруг Y (ry, как у three: локальный +z → мировой (sin ry, cos ry))
    function Frame(ox, oy, oz, ry) { this.ox = ox; this.oy = oy; this.oz = oz; this.ry = ry || 0; this.c = Math.cos(this.ry); this.s = Math.sin(this.ry); }
    Frame.prototype.p = function (x, y, z) { return [this.ox + x * this.c + z * this.s, this.oy + y, this.oz - x * this.s + z * this.c]; };
    Frame.prototype.dir = function (x, z) { return [x * this.c + z * this.s, -x * this.s + z * this.c]; };
    // коробка в рамке F: центр (x,y,z) локально, размеры w,h,d; o: { col, cols:{px,nx,py,ny,pz,nz}, s, ss:{..}, skip:{..}, rot (поворот вокруг Y внутри рамки) }
    Baker.prototype.box = function (F, x, y, z, w, h, d, o = {}) {
      const hw = w / 2, hh = h / 2, hd = d / 2, rr = o.rot || 0, cr = Math.cos(rr), sr = Math.sin(rr);
      const L = (lx, ly, lz) => { const X = x + lx * cr + lz * sr, Z = z - lx * sr + lz * cr; return F.p(X, y + ly, Z); };
      const C = { px: L(hw, 0, 0) }, col = k => (o.cols && o.cols[k]) || o.col || [1, 1, 1], st = k => (o.ss && o.ss[k] !== undefined ? o.ss[k] : o.s !== undefined ? o.s : S.FLAT);
      const sk = o.skip || {};
      const v = [L(-hw, -hh, hd), L(hw, -hh, hd), L(hw, hh, hd), L(-hw, hh, hd), L(-hw, -hh, -hd), L(hw, -hh, -hd), L(hw, hh, -hd), L(-hw, hh, -hd)];
      if (!sk.pz) this.quad(v[0], v[1], v[2], v[3], col('pz'), st('pz'), o.uv && o.uv.pz);
      if (!sk.nz) this.quad(v[5], v[4], v[7], v[6], col('nz'), st('nz'), o.uv && o.uv.nz);
      if (!sk.px) this.quad(v[1], v[5], v[6], v[2], col('px'), st('px'), o.uv && o.uv.px);
      if (!sk.nx) this.quad(v[4], v[0], v[3], v[7], col('nx'), st('nx'), o.uv && o.uv.nx);
      if (!sk.py) this.quad(v[3], v[2], v[6], v[7], col('py'), st('py'), o.uv && o.uv.py);
      if (!sk.ny) this.quad(v[4], v[5], v[1], v[0], col('ny'), st('ny'), o.uv && o.uv.ny);
      return C;
    };
    // цилиндр/конус по оси Y в мировых координатах; o: { seg, col, s, cap: true|false, uvU (метров по окружности на плитку) }
    Baker.prototype.cyl = function (cx, y0, cz, r0, r1, h, o = {}) {
      const seg = o.seg || 10, col = o.col || [1, 1, 1], s = o.s !== undefined ? o.s : S.FLAT, a0 = o.a0 || 0;
      const per = TAU * Math.max(r0, r1), uw = o.uvW || SW[s], uh = SH[s];
      for (let i = 0; i < seg; i++) {
        const a = a0 + i / seg * TAU, b = a0 + (i + 1) / seg * TAU;
        const p0 = [cx + Math.sin(a) * r0, y0, cz + Math.cos(a) * r0], p1 = [cx + Math.sin(b) * r0, y0, cz + Math.cos(b) * r0];
        const p2 = [cx + Math.sin(b) * r1, y0 + h, cz + Math.cos(b) * r1], p3 = [cx + Math.sin(a) * r1, y0 + h, cz + Math.cos(a) * r1];
        const u0 = i / seg * per / uw, u1 = (i + 1) / seg * per / uw, v0 = y0 / uh, v1 = (y0 + h) / uh;
        const am = (a + b) / 2, nn = [Math.sin(am), (r0 - r1) / h * 0.5, Math.cos(am)];
        const c = typeof col === 'function' ? col : col;
        const n0 = [Math.sin(a), nn[1], Math.cos(a)], n1 = [Math.sin(b), nn[1], Math.cos(b)];
        const i0 = this.n, cc = (p, k) => (typeof c === 'function' ? c(p, k) : c);
        if (o.inward) { n0[0] = -n0[0]; n0[2] = -n0[2]; n1[0] = -n1[0]; n1[2] = -n1[2]; n0[1] = -n0[1]; n1[1] = -n1[1]; }
        this.vert(p0, n0, [u0, v0], cc(p0, 0), s); this.vert(p1, n1, [u1, v0], cc(p1, 1), s); this.vert(p2, n1, [u1, v1], cc(p2, 2), s); this.vert(p3, n0, [u0, v1], cc(p3, 3), s);
        if (o.inward) this.I.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); else this.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        if (o.cap !== false && r1 > 0.001 && !o.inward) this.tri([cx, y0 + h, cz], p3, p2, o.capCol || cc(p2, 2), o.capS !== undefined ? o.capS : s);
      }
    };
    // эллипсоид (низкополигональный): центр, радиусы, сегменты
    Baker.prototype.sph = function (cx, cy, cz, rx, ry, rz, col, o = {}) {
      const sw = o.seg || 8, sh = o.rings || 5, s = o.s !== undefined ? o.s : S.FLAT, i0 = this.n, cut = o.cut || 0;
      for (let j = 0; j <= sh; j++) { const v = cut + (1 - cut) * j / sh, th = v * PI; for (let i = 0; i <= sw; i++) { const ph = i / sw * TAU, nx = Math.sin(th) * Math.sin(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.cos(ph);
        const p = [cx + nx * rx, cy + ny * ry, cz + nz * rz], cc = typeof col === 'function' ? col(p, ny) : col; this.vert(p, [nx, ny, nz], [i / sw, v], cc, s); } }
      for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) { const a = i0 + j * (sw + 1) + i, b = a + sw + 1; this.I.push(a, b, a + 1, a + 1, b, b + 1); }
    };
    // четырёхугольник, развёрнутый лицом к направлению dir (x, z) или (x, y, z)
    Baker.prototype.quadF = function (a, b, c, d, col, s, dir) {
      const n = faceN(a, b, c), dx = dir[0], dy = dir.length > 2 ? dir[1] : 0, dz = dir.length > 2 ? dir[2] : dir[1];
      if (n[0] * dx + n[1] * dy + n[2] * dz < 0) this.quad(d, c, b, a, col, s); else this.quad(a, b, c, d, col, s);
    };
    Baker.prototype.count = function () { return this.I.length / 3; };
    Baker.prototype.build = function () {
      if (!this.n) return null;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
      if (this.kind === 'atlas') { g.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2)); g.setAttribute('strip', new T.Float32BufferAttribute(this.Sx, 1)); }
      g.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.I, 1) : new T.Uint16BufferAttribute(this.I, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return keep(g);
    };
    Baker.prototype.mesh = function (mat) { const g = this.build(); if (!g) return null; const m = new T.Mesh(g, mat || (this.kind === 'atlas' ? atlasMat : vcMat)); return m; };

    /* --- инстансы: список { p:[x,y,z], r:[rx,ry,rz] | q, s:[sx,sy,sz], c:[r,g,b], tile, glow } --- */
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _col = new T.Color();
    function instanced(geo, mat, list, o = {}) {
      if (!list.length) return null;
      const g = o.share ? geo : geo.clone(); keep(g);
      if (o.tiles) { g.setAttribute('aTile', new T.InstancedBufferAttribute(new Float32Array(list.map(x => x.tile || 0)), 1)); g.setAttribute('aGlow', new T.InstancedBufferAttribute(new Float32Array(list.map(x => x.glow || 0)), 1)); }
      const m = new T.InstancedMesh(g, mat, list.length);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      list.forEach((it, i) => {
        _p.set(it.p[0], it.p[1], it.p[2]);
        if (it.q) _q.copy(it.q); else { _e.set(it.r ? it.r[0] : 0, it.r ? it.r[1] : 0, it.r ? it.r[2] : 0, it.order || 'YXZ'); _q.setFromEuler(_e); }
        _s.set(it.s ? it.s[0] : 1, it.s ? it.s[1] : 1, it.s ? it.s[2] : 1);
        _m.compose(_p, _q, _s); m.setMatrixAt(i, _m);
        if (it.c) { _col.setRGB(it.c[0], it.c[1], it.c[2]); m.setColorAt(i, _col); }
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], it.p[k] - 3); mx[k] = Math.max(mx[k], it.p[k] + 3); }
      });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      // габарит всех инстансов (иначе three отсекает по габариту одной копии)
      g.boundingSphere = new T.Sphere(new T.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2), Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2);
      m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false;
      return m;
    }
    // то же, что instanced, но одной обычной сеткой: копии с запечёнными матрицами и цветом в вершинах.
    // На программном рендере (swiftshader, слабые телефоны) инстансы с атрибутами заметно дороже обычной сетки (село: −30…40 % кадра)
    const _v = new T.Vector3(), _nm = new T.Matrix3();
    function merged(geo, mat, list, o = {}) {
      if (!list.length) return null;
      const src = geo.index ? geo.toNonIndexed() : geo, P = src.attributes.position, N = src.attributes.normal, Cc = src.attributes.color, U = src.attributes.uv, nv = P.count, tot = nv * list.length;
      const pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), col = new Float32Array(tot * 3), uv = U ? new Float32Array(tot * 2) : null, tile = o.tiles ? new Float32Array(tot) : null, glow = o.tiles ? new Float32Array(tot) : null;
      list.forEach((it, i) => {
        _p.set(it.p[0], it.p[1], it.p[2]);
        if (it.q) _q.copy(it.q); else { _e.set(it.r ? it.r[0] : 0, it.r ? it.r[1] : 0, it.r ? it.r[2] : 0, it.order || 'YXZ'); _q.setFromEuler(_e); }
        _s.set(it.s ? it.s[0] : 1, it.s ? it.s[1] : 1, it.s ? it.s[2] : 1);
        _m.compose(_p, _q, _s); _nm.getNormalMatrix(_m);
        const ic = it.c || [1, 1, 1];
        for (let k = 0; k < nv; k++) {
          const j = i * nv + k;
          _v.fromBufferAttribute(P, k).applyMatrix4(_m); pos[j * 3] = _v.x; pos[j * 3 + 1] = _v.y; pos[j * 3 + 2] = _v.z;
          if (N) { _v.fromBufferAttribute(N, k).applyMatrix3(_nm).normalize(); nor[j * 3] = _v.x; nor[j * 3 + 1] = _v.y; nor[j * 3 + 2] = _v.z; } else nor[j * 3 + 1] = 1;
          col[j * 3] = (Cc ? Cc.getX(k) : 1) * ic[0]; col[j * 3 + 1] = (Cc ? Cc.getY(k) : 1) * ic[1]; col[j * 3 + 2] = (Cc ? Cc.getZ(k) : 1) * ic[2];
          if (uv) { uv[j * 2] = U.getX(k); uv[j * 2 + 1] = U.getY(k); }
          if (tile) { tile[j] = it.tile || 0; glow[j] = it.glow || 0; }
        }
      });
      if (src !== geo) src.dispose();
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      if (uv) g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      if (tile) { g.setAttribute('aTile', new T.BufferAttribute(tile, 1)); g.setAttribute('aGlow', new T.BufferAttribute(glow, 1)); }
      g.computeBoundingSphere(); keep(g);
      const m = new T.Mesh(g, mat); m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false;
      return m;
    }
    // геометрия-образец из Baker (vc) для инстансов
    function geoFrom(bk) { const g = bk.build(); return g; }
    // 4B: склеенную геометрию — на куски по ключу keyFn(x, z) центра треугольника (отсечение по пирамиде камеры, LOD по куску)
    function split(g, keyFn) {
      if (!g) return [];
      const P = g.attributes.position.array, names = Object.keys(g.attributes), nIdx = g.index ? g.index.count : g.attributes.position.count, IX = g.index ? g.index.array : null, groups = new Map();
      for (let t = 0; t < nIdx; t += 3) { const a = IX ? IX[t] : t, b = IX ? IX[t + 1] : t + 1, c = IX ? IX[t + 2] : t + 2, cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
        const k = keyFn(cx, cz); let L = groups.get(k); if (!L) groups.set(k, L = []); L.push(a, b, c); }
      if (groups.size < 2) return [g];
      const out = [];
      groups.forEach(L => { const map = new Map(), ni = new Array(L.length); let n = 0; for (let i = 0; i < L.length; i++) { let v = map.get(L[i]); if (v === undefined) { v = n++; map.set(L[i], v); } ni[i] = v; }
        const ng = new T.BufferGeometry(); names.forEach(nm => { const A = g.attributes[nm], sz = A.itemSize, src = A.array, dst = new src.constructor(n * sz); map.forEach((v, o) => { for (let q = 0; q < sz; q++) dst[v * sz + q] = src[o * sz + q]; }); ng.setAttribute(nm, new T.BufferAttribute(dst, sz)); });
        ng.setIndex(n > 65535 ? new T.Uint32BufferAttribute(ni, 1) : new T.Uint16BufferAttribute(ni, 1)); ng.computeBoundingSphere(); out.push(keep(ng)); });
      g.dispose(); return out;
    }

    /* ---------- материалы зверят: склейка по частям, контур ---------- */
    const outlineMat = keep(new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: 'uniform float thick; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    }));
    const actorMat = addRim(toon('#FFFFFF', { vertexColors: true }), 1);
    const actorMatD = addRim(toon('#FFFFFF', { vertexColors: true, side: T.DoubleSide }), 1);
    const GEO = {
      box: keep(new T.BoxGeometry(1, 1, 1)), sph: keep(new T.SphereGeometry(1, o.hi ? 14 : 11, o.hi ? 10 : 8)), sphLo: keep(new T.SphereGeometry(1, 8, 6)),
      cyl: keep(new T.CylinderGeometry(1, 1, 1, 10)), cone: keep(new T.ConeGeometry(1, 1, 10)), plane: keep(new T.PlaneGeometry(1, 1)),
      hemi: keep(new T.SphereGeometry(1, 12, 6, 0, TAU, 0, PI / 2)), torus: keep(new T.TorusGeometry(1, 0.3, 6, 16)),
    };
    const capG = (() => { const c = new Map(); return (r, l) => { const k = r + '|' + l; if (!c.has(k)) c.set(k, keep(new T.CapsuleGeometry(r, l, 3, 8))); return c.get(k); }; })();
    const FACEG = keep(new T.SphereGeometry(1.012, 20, 14, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180));
    // склейка группы в один меш с цветом вершин (без веток userData.dyn); olSet — кому положен контур
    function mergeGroup(group, olSet, o = {}) {
      group.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(group.matrixWorld).invert(), list = [];
      group.traverse(m => { if (!m.isMesh || m === group) return; for (let p = m; p && p !== group; p = p.parent) if (p.userData.dyn && p !== m || (p === m && m.userData.dyn)) return; if (m.material && (m.material.transparent || m.material.isShaderMaterial)) return; list.push(m); });
      const parts = [], ol = [];
      list.forEach(m => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        const n = g.attributes.position.count, col = new Float32Array(n * 3), c = m.material.color || new T.Color(1, 1, 1);
        const em = m.material.emissive && m.material.emissiveIntensity > 0 ? m.material.emissive.clone().multiplyScalar(m.material.emissiveIntensity) : null;
        for (let i = 0; i < n; i++) { col[i * 3] = c.r + (em ? em.r : 0); col[i * 3 + 1] = c.g + (em ? em.g : 0); col[i * 3 + 2] = c.b + (em ? em.b : 0); }
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        (m.material.side === T.DoubleSide ? (parts.d = parts.d || []) : parts).push(g);
        if (olSet && olSet.has(m)) ol.push(g);
      });
      list.forEach(m => m.parent.remove(m));
      const cat = arr => {
        let n = 0; arr.forEach(g => { n += g.attributes.position.count; });
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let off = 0;
        arr.forEach(g => { P.set(g.attributes.position.array, off * 3); N.set(g.attributes.normal.array, off * 3); if (g.attributes.color) C.set(g.attributes.color.array, off * 3); off += g.attributes.position.count; });
        const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(P, 3)); mg.setAttribute('normal', new T.BufferAttribute(N, 3)); mg.setAttribute('color', new T.BufferAttribute(C, 3));
        mg.computeBoundingSphere(); return keep(mg);
      };
      const res = {};
      if (parts.length) { res.body = new T.Mesh(cat(parts), actorMat); res.body.castShadow = o.cast !== false; group.add(res.body); }
      if (parts.d && parts.d.length) { res.bodyD = new T.Mesh(cat(parts.d), actorMatD); res.bodyD.castShadow = false; group.add(res.bodyD); }
      if (ol.length) { res.outline = new T.Mesh(cat(ol), outlineMat); res.outline.castShadow = false; res.outline.userData.outline = true; res.outline.raycast = () => {}; group.add(res.outline); }
      parts.forEach(g => g.dispose()); (parts.d || []).forEach(g => g.dispose());
      return res;
    }
    const toonCache = new Map();
    const tm = (c, x) => { const k = c + (x ? JSON.stringify(x) : ''); if (!toonCache.has(k)) toonCache.set(k, toon(c, x ? (x.emissive ? Object.assign({}, x, { emissive: new T.Color(x.emissive) }) : x) : {})); return toonCache.get(k); };
    // зверёк: как npcMake в игре — тело, голова (поворачивается к героине), лицо-наклейка, моргание, дыхание
    function npc(id, build) {
      const root = new T.Group(), body = new T.Group(); root.add(body); root.userData.key = 'npc:' + id;
      const ol = [];
      const put = (par, geo, mat, p, sc, r) => { const m = new T.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (sc) m.scale.set(sc[0], sc[1], sc[2]); if (r) m.rotation.set(r[0], r[1], r[2]); m.castShadow = true; par.add(m); return m; };
      const P = (par, geo, mat, p, sc, r, line = true) => { const m = put(par, geo, mat, p, sc, r); if (line) ol.push(m); return m; };
      const n = { id, root, body, head: null, ph: Math.random() * 6, hopT: -1, blinkT: 1 + Math.random() * 2, closed: false, look: 0 };
      const face = (head, f, sc) => {
        const fo = tex(faceCanvas(f, false)), fc = tex(faceCanvas(f, true));
        const fm = keep(new T.MeshBasicMaterial({ map: fo, transparent: true, depthWrite: false }));
        const m = put(head, FACEG, fm, [0, 0, 0], sc); m.castShadow = false; m.renderOrder = 2; m.userData.dyn = true;
        n.faceMat = fm; n.faceOpen = fo; n.faceClosed = fc; return m;
      };
      build({ n, root, body, P, face, M: tm, GEO, capG });
      const dynG = [n.head, n.tail, n.wingL, n.wingR, n.tool, n.legs].concat(n.extraDyn || []).filter(Boolean).flat();
      dynG.forEach(g => { g.userData.dyn = true; });
      const olSet = new Set(ol);
      mergeGroup(body, olSet);
      dynG.forEach(g => mergeGroup(g, olSet, { cast: false }));
      n.outlines = []; root.traverse(m => { if (m.isMesh && m.userData.outline) n.outlines.push(m); });
      n.hop = () => { n.hopT = 0; };
      n.anim = (t, dt, hx, hz) => {
        let hop = 0; if (n.hopT >= 0) { n.hopT += dt; hop = Math.sin(Math.min(1, n.hopT / 0.42) * PI) * 0.12; if (n.hopT > 0.42) n.hopT = -1; }
        // дыхание и лёгкое покачивание (polish: заметнее, но мягко)
        n.body.position.y = hop + (n.bob ? Math.abs(Math.sin(t * 9)) * 0.03 : 0) + Math.max(0, Math.sin(t * 2.2 + n.ph)) * 0.008;
        n.body.scale.y = 1 + Math.sin(t * 2.2 + n.ph) * 0.02;
        n.body.rotation.z = Math.sin(t * 0.9 + n.ph * 1.7) * 0.025;
        n.blinkT -= dt; if (n.blinkT <= 0 && n.faceMat) { n.closed = !n.closed; n.faceMat.map = n.closed ? n.faceClosed : n.faceOpen; n.blinkT = n.closed ? (n.blinkSlow ? 0.6 : 0.13) : 2.2 + Math.random() * 3; }
        if (n.tail && !n.noTailIdle) n.tail.rotation.y = Math.sin(t * 1.6 + n.ph) * 0.22;   // хвостик (у кого есть; свои движения — в extra)
        if (n.head) {
          const wp = n.root.getWorldPosition(_p), d = Math.hypot(hx - wp.x, hz - wp.z);
          let yaw = 0; if (d < 4 && !n.noLook) { let a = Math.atan2(hx - wp.x, hz - wp.z) - n.root.rotation.y - (n.root.parent && n.root.parent.rotation ? n.root.parent.rotation.y : 0); a = ((a % TAU) + TAU + PI) % TAU - PI; yaw = clamp(a, -0.9, 0.9); }
          else if (!n.noLook) { const g = Math.sin(t * 0.31 + n.ph * 2.3); yaw = Math.sign(g) * sst(0.6, 0.9, Math.abs(g)) * 0.5; }   // никого рядом — иногда оглядывается
          n.look += (yaw - n.look) * Math.min(1, dt * 4); n.head.rotation.y = n.look;
          if (!n.noTilt) n.head.rotation.z = Math.sin(t * 0.8 + n.ph) * 0.05;
        }
        if (n.extra) n.extra(t, dt);
      };
      return n;
    }

    /* --- прочие текстуры --- */
    const cloudTex = tex(paintCloud(), { repeat: true });
    const carvedTex = tex(paintCarved());
    const blobTex = (() => { const [cv, c] = cnv(64, 64); const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(60,50,60,.32)'); g.addColorStop(1, 'rgba(60,50,60,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return tex(cv); })();
    const blobMat = keep(new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    const softDot = (inner, outer, col) => { const [cv, c] = cnv(64, 64); const g = c.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, `rgba(${col},${inner})`); g.addColorStop(0.45, `rgba(${col},${(inner * 0.7).toFixed(2)})`); g.addColorStop(1, `rgba(${col},${outer})`); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return tex(cv); };
    const snowTex = softDot(1, 0, '255,255,255');
    const puffTex = softDot(0.55, 0, '250,248,244');
    const glintTex = (() => { const [cv, c] = cnv(64, 64); c.translate(32, 32); c.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < 4; i++) { c.rotate(PI / 4); c.beginPath(); c.moveTo(0, -30); c.lineTo(3, 0); c.lineTo(0, 30); c.lineTo(-3, 0); c.closePath(); c.fill(); } const g = c.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-16, -16, 32, 32); return tex(cv); })();

    return {
      T, PAL, MOODS, S, SW, SH, NS, keep, disposables, GRAD, RIM, addRim, toon, tex, tm, BAKED,
      atlasTex, atlasMat, atlasMatD, vcMat, vcMatD, basicVC, basicVCD, farVC, glazMat, glazMatV, glazTex, GLOW, instMat,
      Baker, Frame, instanced, merged, geoFrom, split, GEO, capG, FACEG, outlineMat, actorMat, mergeGroup, npc, faceCanvas,
      cloudTex, carvedTex, blobMat, snowTex, puffTex, glintTex, signCanvas, cnv, rrect,
      rgb: hexRGB, mix: mixRGB, mul: mulRGB, mul3: mulRGB3,
      dispose() { disposables.forEach(d => { try { d.dispose && d.dispose(); } catch (e) { /* уже */ } }); disposables.length = 0; },
    };
  }

  /* ---------- 4B: ТЕРРАСЫ — общий построитель (село, склон с серпантином, отель) ----------
     spec2 §6: широкие ступени-полосы по горизонталям; уступ 1,6–2,6 м, проступь 4–10 м и больше там, где положе;
     стенки сухой кладки (атлас «бут» — видны строчки камней) или травяные откосы; поздняя осень — охра (скошенное сено),
     мягкая зелень, золото; разрывы — тропинки по склону, общие для всех уровней поля; зимой — снег на полосах («зебра»).
     o: { cx, cz — центр секторов; fields: [{ b0, b1 (градусы: азимут от +z к +x), r0, r1, far? }]; surf(x, z) — видимая
          поверхность; ok(x, z, f) — можно ли класть полосу; tread, wall — накопители (Baker; стенка может быть 'atlas');
          winter; seed; step, stepVar, segL, dr, minW, maxW, skip, pathEvery, pathW, lift, wallDrop, kant (кромка камня),
          shade(col, x, z, f) — дымка вдали; onBand({ pts, yA, yB, f, stone, k }) — стога, деревья }
     → { bands, levels } */
  function terraces(o) {
    const D2 = Math.PI / 180, R = rng(o.seed || 6161), cx = o.cx, cz = o.cz, surf = o.surf, okAt = o.ok || (() => true);
    const tread = o.tread, wall = o.wall || o.tread, wallAt = wall.kind === 'atlas', WIN = !!o.winter;
    const PALT = o.palette || [['#D7B866', '#C49F50'], ['#A9B262', '#93A052'], ['#E2BE55', '#CDA542'], ['#CDAA68', '#B48F4E'], ['#9EAE5E', '#889A4E'], ['#E4C67C', '#CCAA62'], ['#C08C48', '#A87A3E']];
    const snowT = hexRGB('#F3F6FA'), snowS = hexRGB('#E2EAF2'), stoneW = WIN ? [0.62, 0.6, 0.58] : [0.9, 0.84, 0.74], stoneV = hexRGB(WIN ? '#6F6961' : '#8E8170'), bankC = hexRGB(WIN ? '#6A6658' : '#7A8A4C'), kantC = hexRGB(WIN ? '#8A847C' : '#BCAE92');
    const pq = (r, b) => [cx + Math.sin(b * D2) * r, cz + Math.cos(b * D2) * r];
    const shade = o.shade || (c => c), vn = (x, z) => 0.94 + 0.1 * vnoise(x * 0.21, z * 0.21);
    const out = { bands: 0, levels: 0 };
    (o.fields || []).forEach((f, fi) => {
      const far = !!f.far, segL = f.segL || o.segL || (far ? 9 : 4.4), dr = f.dr || o.dr || (far ? 3 : 1.5);
      const step = f.step || o.step || (far ? 3.0 : 2.1), stepVar = f.stepVar !== undefined ? f.stepVar : o.stepVar !== undefined ? o.stepVar : (far ? 1.4 : 0.6);
      const minW = o.minW || (far ? 2 : 1.3), maxW = o.maxW || (far ? 32 : 26), lift = far ? 0.7 : (o.lift !== undefined ? o.lift : 0.14), drop = o.wallDrop || (far ? 1.2 : 0.8);
      const rm = (f.r0 + f.r1) / 2, nb = Math.max(4, Math.ceil((f.b1 - f.b0) * D2 * rm / segL)), nr = Math.ceil((f.r1 - f.r0) / dr);
      const prof = []; let s0 = 0, s1 = 0;
      for (let j = 0; j <= nb; j++) { const b = f.b0 + (f.b1 - f.b0) * j / nb, ys = new Float32Array(nr + 1); for (let i = 0; i <= nr; i++) { const [x, z] = pq(f.r0 + i * dr, b); ys[i] = surf(x, z); } prof.push({ b, ys }); s0 += ys[0]; s1 += ys[nr]; }
      const down = s0 > s1 ? 1 : -1;   // +1: вниз — от центра; −1: вниз — к центру
      let yHi = -1e9, yLo = 1e9; prof.forEach(p => { yHi = Math.max(yHi, down > 0 ? p.ys[0] : p.ys[nr]); yLo = Math.min(yLo, down > 0 ? p.ys[nr] : p.ys[0]); });
      const levels = []; for (let y = yHi - 0.4 - R() * 1.2; y > yLo + 0.8; y -= step + R() * stepVar) levels.push(y);
      const cross = (p, y) => {
        if (down > 0) { for (let i = 0; i < nr; i++) if (p.ys[i] >= y && p.ys[i + 1] < y) return f.r0 + (i + (p.ys[i] - y) / (p.ys[i] - p.ys[i + 1])) * dr; }
        else { for (let i = nr; i > 0; i--) if (p.ys[i] >= y && p.ys[i - 1] < y) return f.r0 + (i - (p.ys[i] - y) / (p.ys[i] - p.ys[i - 1])) * dr; }
        return null;
      };
      // тропинки по склону: разрывы на одних и тех же азимутах у всех уровней поля
      const pathDeg = (o.pathW || (far ? 3 : 1.7)) / (rm * D2), runs = [];
      { let a0 = f.b0, a = f.b0 + 6 + R() * 8; while (a < f.b1 - 6) { runs.push([a0, a - pathDeg / 2]); a0 = a + pathDeg / 2; a += (o.pathEvery || (far ? 22 : 18)) + R() * 12; } runs.push([a0, f.b1]); }
      let pi = Math.floor(R() * PALT.length);
      for (let k = 0; k < levels.length - 1; k++) {
        out.levels++;
        if (R() < (o.skip !== undefined ? o.skip : 0.04)) continue;
        pi = (pi + 1 + (R() < 0.3 ? 1 : 0)) % PALT.length;
        const yA = levels[k], yB = levels[k + 1], stone = R() < (o.stone !== undefined ? o.stone : 0.62);
        const col = WIN ? snowT : mulRGB(hexRGB(PALT[pi][0]), 0.96 + R() * 0.08), col2 = WIN ? snowS : mulRGB(hexRGB(PALT[pi][1]), 0.96 + R() * 0.06);
        runs.forEach(([a0, a1]) => { if (a1 - a0 < 3) return; band(prof.filter(p => p.b >= a0 && p.b <= a1), yA, yB, stone, col, col2, k); });
      }
      function band(PP, yA, yB, stone, col, col2, k) {
        if (PP.length < 3) return;
        const a0 = PP[0].b, a1 = PP[PP.length - 1].b, tau = Math.min(5, (a1 - a0) / 3);
        const S0 = PP.map(p => {
          const ri = cross(p, yA), ro = cross(p, yB);
          if (ri === null || ro === null) return { b: p.b, ok: false, ri: ri || 0, ro: ro || 0 };
          const wd = Math.abs(ro - ri), [xi, zi] = pq(ri, p.b), [xo, zo] = pq(ro, p.b), [xm, zm] = pq((ri + ro) / 2, p.b);
          return { b: p.b, ok: wd > minW && wd < maxW && okAt(xi, zi, f) && okAt(xo, zo, f) && okAt(xm, zm, f), ri, ro };
        });
        const mj = (far ? 7 : 2.4) + segL * 0.8;
        for (let pass = 0; pass < 2; pass++) for (let i = 0; i < S0.length; i++) { const q = S0[i]; if (!q.ok) continue; const a = S0[i - 1], c = S0[i + 1];
          if ((a && a.ok && (Math.abs(a.ri - q.ri) > mj || Math.abs(a.ro - q.ro) > mj * 1.4)) || (c && c.ok && (Math.abs(c.ri - q.ri) > mj || Math.abs(c.ro - q.ro) > mj * 1.4))) q.bad = true; }
        S0.forEach(q => { if (q.bad) q.ok = false; });
        if (!S0.some(q => q.ok)) return;
        S0.forEach((q, i) => { if (q.ok) return; let best = null, bd = 1e9; S0.forEach((o2, k2) => { if (o2.ok && Math.abs(k2 - i) < bd) { bd = Math.abs(k2 - i); best = o2; } }); q.ri = best.ri; q.ro = best.ri; });
        const dist = S0.map((q, i) => { let d = 1e9; for (let k2 = 0; k2 < S0.length; k2++) if (!S0[k2].ok) d = Math.min(d, Math.abs(k2 - i)); return d; });
        const pts = S0.map((q, i) => {
          const tEnd = Math.min(1, (q.b - a0) / tau, (a1 - q.b) / tau), tw = q.ok ? sst(0, 1, Math.max(0, tEnd)) * sst(0, 2.2, dist[i]) : 0;
          const ri = q.ri, ro = q.ok ? ri + (q.ro - ri) * tw : ri, [xi, zi] = pq(ri, q.b), [xo, zo] = pq(ro, q.b), [xm, zm] = pq((ri + ro) / 2, q.b);
          return { b: q.b, ww: Math.abs(ro - ri), xi, zi, xm, zm, xo, zo, y: yA + lift, yi: yA, yo: q.ok ? Math.min(yA, surf(xo, zo)) : yA, okp: q.ok };
        });
        let used = false;
        for (let i = 0; i < pts.length - 1; i++) {
          const A = pts[i], B2 = pts[i + 1]; if (A.ww < 0.05 && B2.ww < 0.05) continue; if (!A.okp && !B2.okp) continue; used = true;
          const nb2 = [Math.sin((A.b + B2.b) / 2 * D2) * down, 0, Math.cos((A.b + B2.b) / 2 * D2) * down];
          const sh = (c, x, z, kk = 1) => shade(mulRGB(c, vn(x, z) * kk), x, z, f);
          if (far || !o.two) tread.quadF([A.xi, A.y, A.zi], [B2.xi, B2.y, B2.zi], [B2.xo, B2.y, B2.zo], [A.xo, A.y, A.zo], p => sh(p[0] === A.xi || p[0] === B2.xi ? col : col2, p[0], p[2]), 0, [0, 1, 0]);
          else {   // проступь двумя полосами: у верхней стенки — светлее (свежескошенное), к краю — второй тон
            const t = 0.56, mA = [lerp(A.xi, A.xo, t), lerp(A.zi, A.zo, t)], mB = [lerp(B2.xi, B2.xo, t), lerp(B2.zi, B2.zo, t)];
            tread.quadF([A.xi, A.y, A.zi], [B2.xi, B2.y, B2.zi], [mB[0], B2.y, mB[1]], [mA[0], A.y, mA[1]], p => sh(col, p[0], p[2]), 0, [0, 1, 0]);
            tread.quadF([mA[0], A.y, mA[1]], [mB[0], B2.y, mB[1]], [B2.xo, B2.y, B2.zo], [A.xo, A.y, A.zo], p => sh(p[0] === mA[0] || p[0] === mB[0] ? mixRGB(col, col2, 0.4) : col2, p[0], p[2]), 0, [0, 1, 0]);
          }
          const lo = Math.min(A.yo, B2.yo), wq = [[A.xo, A.yo - drop, A.zo], [B2.xo, B2.yo - drop, B2.zo], [B2.xo, B2.y, B2.zo], [A.xo, A.y, A.zo]];
          const shadeW = (c, p) => sh(c, p[0], p[2], 0.78 + 0.22 * clamp((p[1] - lo + drop) / Math.max(0.5, A.y - lo + drop), 0, 1));
          if (stone && wallAt && !far) wall.quadF(wq[0], wq[1], wq[2], wq[3], p => shadeW(stoneW, p), 0 /* S.RUBBLE */, nb2);
          else wall.quadF(wq[0], wq[1], wq[2], wq[3], p => shadeW(stone ? stoneV : bankC, p), wallAt ? 7 /* S.FLAT */ : 0, nb2);
          if (stone && !far && o.kant !== false && A.ww > 0.7 && B2.ww > 0.7) {   // кромка-«кант» из плоских камней по краю ступени
            const k2 = 0.24, ia = [lerp(A.xo, A.xi, k2 / A.ww), lerp(A.zo, A.zi, k2 / A.ww)], ib = [lerp(B2.xo, B2.xi, k2 / B2.ww), lerp(B2.zo, B2.zi, k2 / B2.ww)];
            tread.quadF([ia[0], A.y + 0.025, ia[1]], [ib[0], B2.y + 0.025, ib[1]], [B2.xo, B2.y + 0.025, B2.zo], [A.xo, A.y + 0.025, A.zo], p => sh(kantC, p[0], p[2]), 0, [0, 1, 0]);
          }
        }
        if (!used) return;
        out.bands++;
        if (o.onBand) o.onBand({ pts, yA, yB, f, stone, k });
      }
    });
    return out;
  }

  V.vkit = { rng, strSeed, clamp, lerp, sst, hash2, vnoise, fbm, rgb: hexRGB, mix: mixRGB, mul: mulRGB, mul3: mulRGB3, PAL, MOODS, S, SW, SH, NS, makeKit, faceCanvas, signCanvas, skyClouds, terraces };
})();
