/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: дальний вид на востоке — хребты и село мастеров на своём холме (желание автора: со стартового кадра
   за домами видно, куда ведёт дорога из города, и село узнаётся; образец — фото автора: село вдалеке).
   Слой неба, а не часть города: своя маленькая сцена «на бесконечности» рисуется ДО города (камера в её центре
   поворачивается вместе с камерой города, но не двигается), потом глубина очищается и поверх рисуется город. Поэтому
   горы видны при любом качестве — их не обрезает дальность камеры (52–105 м) и не съедает туман города; дальняя
   земля, ушедшая в туман, ложится на подножие как дымка. Небо — CSS за прозрачным холстом (как и было).
   Состав (оси города: +x — восток, −z — север; азимут a — от востока к северу, высота e — угол над горизонтом):
     дальний хребет (сиреневый, снег на вершинах) · средний хребет (сизый) · холм села и его гребень (осенняя зелень) ·
     село — нарисованная панорама на дуге перед холмом (canvas, рисуется кодом при сборке). Как на фото: макушка холма
     слева, правый край села спускается по склону; наверху две круглые каменные башни (одна с зубцами); дома из
     серо-охристого камня стоят уступами, у многих — длинные застеклённые галереи (голубые и белые, частый переплёт);
     крыши низкие, светло-серые, кое-где бордовые и рыжие; между домами — деревья и кусты, под верхними домами — скалы.
     Линия гребня холма (crest) одна и для панорамы, и для «занавеса» холма: на краях панорамы шва нет.
   Цвета — дневные, заранее смешанные с дымкой; вечер и ночь — общий грейд js/daynight.js (dn.attach(far.root));
   свет в окнах и галереях — свой слой поверх (сложение), его сила — far.setNight(k) (main.js: ночь и фонари из dn).
   2–3 вызова отрисовки, ≈ 1,6 тыс. треугольников; текстуры 2048×1024 (lite/low — 1024×512) и вдвое меньше — окна.

   API
     WORLD.makeFarView({ THREE, center? (азимут середины панорамы, градусы; по умолчанию −6), quality? ('lite'|'low'|'mid'|'high') }) → far:
       far.root (Group — для dn.attach), far.scene, far.visible
       far.render(renderer, camera) — нарисовать слой (до города; renderer.autoClear выключает и чистит тот, кто зовёт)
       far.setNight(k 0…1) — свет окон; far.info() → { tris, calls }; far.dispose()
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  // детерминированный шум (одинаковый вид на всех устройствах)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const HAZE = hex('#E7DDE3');   // дневная дымка у горизонта (тёплая сирень — как низ CSS-неба)
  const C = {
    far: hex('#B7AFCF'), farLo: hex('#D3C9D9'), snow: hex('#F5F2F7'),
    mid: hex('#93A8B3'), midLo: hex('#C6C6CF'),
    hill: hex('#949A6C'), hillHi: hex('#7F8A5A'), rust: hex('#A98F66'), rock: hex('#A39886'), hillLo: hex('#C9C4AE'),   // осенняя зелень, кусты, рыжие склоны, скалы
  };

  /* ---------- панорама села: логические координаты 2048 × 1024 (x — слева направо, y — сверху вниз), холст любого
     размера с тем же соотношением; crestY(x) — гребень холма в тех же координатах ---------- */
  const PW = 2048, PH = 1024;
  function paintVillage(W, H, R, crestY) {
    const day = document.createElement('canvas'); day.width = W; day.height = H;
    const night = document.createElement('canvas'); night.width = Math.round(W / 2); night.height = Math.round(H / 2);
    const c = day.getContext('2d'), n = night.getContext('2d');
    const k = W / PW, S = v => v * k, pick = a => a[Math.floor(R() * a.length)];
    const STONE = ['#A99878', '#B4A282', '#9E8D70', '#BBAA89', '#C6B795', '#A39276', '#B09C7C'];
    const ROOF = ['#C3C8CC', '#B5BBC1', '#CDD1D3', '#C3C8CC', '#BFC5CB', '#B9BEC3', '#C8CCCF', '#9A5A52', '#A97B5A'];
    const GAL = ['#D5E6EF', '#E6EEF0', '#BFD9EA', '#A9CBE2'], FR = ['#F2F2EE', '#8DB3D0', '#F2F2EE'];
    const GREEN = ['#56713F', '#4C6638', '#62803F', '#6E8A46', '#5B7A43'], AUT = ['#B99A3E', '#C8873A', '#A9A045'];
    const ink = 'rgba(58,50,52,0.45)';
    const shade = (col, f) => { const v = hex(col).map(x => Math.round(clamp(x * f, 0, 1) * 255)); return `rgb(${v[0]},${v[1]},${v[2]})`; };
    const lit = (x, y, w, h, col) => {                       // свет — на слой ночи (в полразмера)
      n.save(); n.shadowColor = 'rgba(255,170,70,0.85)'; n.shadowBlur = 6 * k; n.fillStyle = col || '#FFD786';
      n.fillRect(S(x) / 2, S(y) / 2, S(w) / 2, S(h) / 2); n.restore();
    };
    const blob = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(S(x), S(y), S(rx), S(ry), 0, 0, 7); c.fill(); };
    // нижняя граница села: слева оно держится у макушки, справа спускается по склону до подножия
    const bottomY = x => 620 + 360 * (x / PW);
    const inVillage = (x, y) => x > 70 && x < PW - 70 && y > crestY(x) + 18 && y < bottomY(x);

    /* холм под гребнем: трава, кусты, выходы скал */
    c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= PW; x += 8) c.lineTo(S(x), S(crestY(x))); c.lineTo(W, H); c.closePath();
    const hg = c.createLinearGradient(0, S(200), 0, H); hg.addColorStop(0, '#8E9467'); hg.addColorStop(1, '#7D8A57');
    c.fillStyle = hg; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 170; i++) {
      const x = R() * PW, y = crestY(x) + R() * (PH - crestY(x));
      blob(x, y, 30 + R() * 70, 9 + R() * 18, pick(['rgba(104,124,66,0.35)', 'rgba(150,150,100,0.28)', 'rgba(92,110,60,0.35)', 'rgba(170,140,90,0.22)']));
    }
    for (let i = 0; i < 9; i++) {                           // скалы под верхними домами
      const x = 260 + R() * 1000, y = crestY(x) + 80 + R() * 90, w = 60 + R() * 90, h = 30 + R() * 40;
      c.fillStyle = pick(['#9E8F78', '#968872', '#A69780']);
      c.beginPath(); c.moveTo(S(x), S(y)); c.lineTo(S(x + w * 0.3), S(y - h * 0.6)); c.lineTo(S(x + w * 0.7), S(y - h)); c.lineTo(S(x + w), S(y - h * 0.3)); c.lineTo(S(x + w * 0.85), S(y + h * 0.25)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,68,58,0.35)'; c.lineWidth = S(1.5);
      for (let j = 0; j < 4; j++) { const yy = y - h * (0.15 + j * 0.2); c.beginPath(); c.moveTo(S(x + w * 0.2), S(yy)); c.lineTo(S(x + w * 0.8), S(yy + 3)); c.stroke(); }
    }
    c.restore();

    /* дом: камень, тень на правой грани, низкая светлая крыша, окна в рамах или застеклённая галерея */
    function house(x, yb, w, h) {
      const col = pick(STONE), yt = yb - h;
      c.fillStyle = shade(col, 0.72); c.fillRect(S(x + w), S(yt + 4), S(8), S(h - 4));
      c.fillStyle = col; c.fillRect(S(x), S(yt), S(w), S(h));
      c.fillStyle = 'rgba(70,58,46,0.13)';
      for (let i = 0, m = w * h / 200; i < m; i++) c.fillRect(S(x + R() * (w - 5)), S(yt + R() * (h - 2)), S(5), S(1.6));   // кладка
      const floors = h > 88 ? 3 : 2, fh = (h - 12) / floors;
      for (let f = 0; f < floors; f++) {
        const fy = yt + 9 + f * fh;
        if (R() < (f === 0 ? 0.55 : 0.25)) {                // галерея: светлая полоса стекла с частым переплётом
          const gw = Math.min(w - 4, w * (0.65 + R() * 0.4)), gx = x + (R() < 0.5 ? 2 : w - gw - 2), gh = fh * 0.64;
          c.fillStyle = pick(GAL); c.fillRect(S(gx), S(fy), S(gw), S(gh));
          c.fillStyle = 'rgba(66,92,118,0.5)'; for (let mx = gx + 5; mx < gx + gw - 2; mx += 7) c.fillRect(S(mx), S(fy), S(1.4), S(gh));
          c.fillStyle = '#ECF0F0'; c.fillRect(S(gx - 1), S(fy - 1.5), S(gw + 2), S(2.5)); c.fillRect(S(gx - 1), S(fy + gh), S(gw + 2), S(3.5));
          if (R() < 0.5) { const lw = gw * (0.3 + R() * 0.5); lit(gx + R() * (gw - lw), fy + 1, lw, gh - 2, '#FFE2A4'); }
        } else {
          const per = clamp(Math.round(w / 30), 2, 4);
          for (let j = 0; j < per; j++) {
            const wx = x + (j + 0.5) * w / per - 5;
            c.fillStyle = pick(FR); c.fillRect(S(wx - 2), S(fy + 2), S(14), S(18));
            c.fillStyle = '#3D3B45'; c.fillRect(S(wx), S(fy + 4), S(10), S(14));
            if (R() < 0.35) lit(wx, fy + 4, 10, 14);
          }
        }
      }
      c.fillStyle = pick(ROOF);                             // низкая крыша с вылетом
      c.beginPath(); c.moveTo(S(x - 6), S(yt + 1)); c.lineTo(S(x + w + 10), S(yt + 1)); c.lineTo(S(x + w + 4), S(yt - 7)); c.lineTo(S(x), S(yt - 8)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(52,52,64,0.32)'; c.fillRect(S(x - 6), S(yt + 1), S(w + 16), S(2.5));
      c.strokeStyle = ink; c.lineWidth = S(1.6); c.strokeRect(S(x), S(yt), S(w + 8), S(h));
    }
    function bush(x, yb, big) {
      const r0 = big ? 22 : 13, col = R() < 0.14 ? pick(AUT) : pick(GREEN);
      for (let i = 0; i < 4; i++) blob(x + (R() - 0.5) * r0 * 1.8, yb - r0 * (0.6 + R() * 0.9), r0 * (0.6 + R() * 0.5), r0 * (0.55 + R() * 0.45), col);
      blob(x - r0 * 0.3, yb - r0 * 1.3, r0 * 0.4, r0 * 0.3, 'rgba(255,255,230,0.12)');
    }
    function poplar(x, yb) { blob(x, yb - 46, 9, 46, pick(['#4F6B3A', '#5A7742'])); }
    // круглая башня: цилиндр (тень по краям), узкие окна, зубцы или надстройка
    function tower(x, yb, w, h, crenel) {
      const yt = yb - h, g = c.createLinearGradient(S(x), 0, S(x + w), 0);
      g.addColorStop(0, '#9A8A6E'); g.addColorStop(0.35, '#C2B08E'); g.addColorStop(1, '#8A7A60');
      c.fillStyle = g; c.fillRect(S(x), S(yt), S(w), S(h));
      c.fillStyle = 'rgba(70,58,46,0.16)'; for (let yy = yt + 8; yy < yb; yy += 9) c.fillRect(S(x + 2), S(yy), S(w - 4), S(1.4));
      if (crenel) { c.fillStyle = '#B4A283'; c.fillRect(S(x - 3), S(yt - 4), S(w + 6), S(8)); for (let m = 0; m < 6; m++) c.fillRect(S(x - 3 + m * (w + 6) / 5.5), S(yt - 13), S(7), S(10)); }
      else { c.fillStyle = '#C3C8CC'; c.beginPath(); c.moveTo(S(x - 4), S(yt)); c.lineTo(S(x + w + 4), S(yt)); c.lineTo(S(x + w * 0.8), S(yt - 10)); c.lineTo(S(x + w * 0.2), S(yt - 10)); c.closePath(); c.fill(); }
      c.fillStyle = '#3D3B45'; [0.25, 0.5].forEach(t => c.fillRect(S(x + w * 0.45), S(yt + h * t), S(6), S(13)));
      lit(x + w * 0.45, yt + h * 0.25, 6, 13);
      c.strokeStyle = ink; c.lineWidth = S(1.6); c.strokeRect(S(x), S(yt), S(w), S(h));
    }

    /* дома уступами: ряды сверху вниз (нижние ближе и перекрывают верхние), между ними — зелень */
    const TOW = [{ x: 735, w: 70, h: 150, cr: true }, { x: 330, w: 60, h: 112, cr: false }];
    let towersDone = false;
    for (let y = 150; y < 1000; y += 50) {
      if (!towersDone && y > 300) {                         // башни на макушке — за ближними рядами
        towersDone = true;
        TOW.forEach(t => tower(t.x, crestY(t.x + t.w / 2) + 44, t.w, t.h, t.cr));
      }
      let x = 40 + R() * 70;
      while (x < PW - 60) {
        const w = 78 + R() * 62, h = 64 + R() * 44, yb = y + R() * 12, mid = x + w / 2;
        if (!inVillage(mid, yb - h * 0.45)) { x += w * 0.5; continue; }
        if (R() < 0.15) { bush(mid, yb, true); x += w * 0.7; continue; }
        house(x, yb, w, h);
        if (R() < 0.08) poplar(x + w + 10, yb);
        x += w + (R() < 0.35 ? 8 + R() * 26 : -4);
      }
      for (let j = 0; j < 5; j++) { const bx = 60 + R() * (PW - 120), by = y + 26 + R() * 10; if (inVillage(bx, by - 10)) bush(bx, by, R() < 0.3); }
    }
    // ниже села — кроны по склону, справа к селу поднимается дорога
    for (let i = 0; i < 26; i++) { const x = R() * PW, y = Math.max(bottomY(x) + 10, crestY(x) + 30) + R() * 80; if (y < PH - 20) bush(x, y, true); }
    c.strokeStyle = '#B8AE98'; c.lineWidth = S(9); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(S(1180), S(1015)); c.lineTo(S(1700), S(985)); c.lineTo(S(1420), S(958)); c.lineTo(S(1960), S(925)); c.stroke();

    /* дымка расстояния, растворение низа и краёв (там панорама переходит в «занавес» холма), клочья тумана */
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(226,219,226,0.16)'; c.fillRect(0, 0, W, H); c.restore();
    c.save(); c.globalCompositeOperation = 'destination-out';
    const fb = c.createLinearGradient(0, S(890), 0, H); fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = fb; c.fillRect(0, S(890), W, H - S(890));
    const fl = c.createLinearGradient(0, 0, S(70), 0); fl.addColorStop(0, 'rgba(0,0,0,1)'); fl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = fl; c.fillRect(0, 0, S(70), H);
    const fr = c.createLinearGradient(W - S(70), 0, W, 0); fr.addColorStop(0, 'rgba(0,0,0,0)'); fr.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = fr; c.fillRect(W - S(70), 0, S(70), H);
    c.restore();
    const fog = (x, y, rx, ry, a) => { const g = c.createRadialGradient(S(x), S(y), 0, S(x), S(y), S(rx)); g.addColorStop(0, `rgba(250,246,248,${a})`); g.addColorStop(1, 'rgba(250,246,248,0)'); c.fillStyle = g; c.save(); c.translate(S(x), S(y)); c.scale(1, ry / rx); c.translate(-S(x), -S(y)); c.beginPath(); c.arc(S(x), S(y), S(rx), 0, 7); c.fill(); c.restore(); };
    [[300, 960, 300, 30, 0.45], [1000, 975, 380, 28, 0.4], [1700, 950, 320, 30, 0.4]].forEach(f => fog(...f));
    return { day, night };
  }

  WORLD.makeFarView = function (o = {}) {
    const T = o.THREE || window.THREE;
    const A0 = o.center == null ? -6 : o.center;   // макушка с башнями — в просвете над концом Октябрьской (стартовый кадр)
    const lowQ = o.quality === 'lite' || o.quality === 'low';
    const scene = new T.Scene(), root = new T.Group(); root.name = 'farView'; scene.add(root);
    const cam = new T.PerspectiveCamera(58, 1, 10, 6000);
    // всё — на цилиндрах вокруг зрителя: по горизонтали радиус R, высота y = R·tg(e) (угол над горизонтом — ровно e)
    const yOf = (e, R) => R * Math.tan(e * D2R);
    const pos = (a, e, R) => [R * Math.cos(a * D2R), yOf(e, R), -R * Math.sin(a * D2R)];

    /* ---------- хребты: «занавес» по дуге (сетка азимут × высота), цвет — функция высоты ---------- */
    const P = [], CL = [], IX = [];
    function curtain(R, a0, a1, na, rows, top, col, eBase) {
      const v0 = P.length / 3;
      for (let i = 0; i <= na; i++) {
        const a = a0 + (a1 - a0) * i / na, eT = top(a);
        for (let j = 0; j <= rows; j++) {
          const t = j / rows, e = eBase + (eT - eBase) * t, p = pos(a, e, R);
          P.push(p[0], p[1], p[2]);
          const cc = col(a, t, e, eT); CL.push(cc[0], cc[1], cc[2]);
        }
      }
      for (let i = 0; i < na; i++) for (let j = 0; j < rows; j++) {
        const a = v0 + i * (rows + 1) + j, b = a + rows + 1;
        IX.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const peaks = (a, list, base) => list.reduce((m, [cx, w, h]) => Math.max(m, base + h * Math.pow(Math.max(0, 1 - Math.abs(a - cx) / w), 1.4)), base);
    const wob = (a, kk, s) => Math.sin(a * kk + s) * 0.35 + Math.sin(a * kk * 2.7 + s * 1.7) * 0.18;
    // дальний хребет: высокие вершины, на самых высоких — снег
    const farTop = a => peaks(a, [[-26, 16, 7.4], [-8, 12, 4.0], [20, 14, 9.6], [36, 12, 8.2], [54, 16, 6.4]], 3.0) + wob(a, 0.21, 1);
    curtain(1900, -52, 68, 120, 3, farTop, (a, t, e, eT) => {
      const snow = eT > 8 && e > eT - 1.1 - 0.4 * Math.sin(a * 1.3) ? 1 : 0;
      return mix(mix(mix(C.farLo, C.far, sst(0, 1, t)), C.snow, snow * 0.92), HAZE, 0.4);
    }, -7);
    // средний хребет
    const midTop = a => peaks(a, [[-36, 18, 4.3], [-14, 14, 3.2], [46, 18, 4.6]], 1.2) + wob(a, 0.33, 4);
    curtain(1600, -54, 70, 100, 2, midTop, (a, t) => mix(mix(C.midLo, C.mid, t), HAZE, 0.3), -7);
    // холм села (как на фото): макушка слева от центра, вправо — ровный спуск к седловине; влево гребень уходит к вершине
    const crest = a => {
      const d = a - A0;
      let h;
      if (d < -15) h = peaks(d, [[-34, 14, 6.0], [-50, 10, 4.0]], 0.9);
      else if (d <= 6) h = 0.9 + 6.5 * Math.pow((d + 15) / 21, 1.2);
      else if (d <= 8) h = 7.4;
      else h = 7.4 - 2.4 * sst(8, 15, d) + peaks(d, [[26, 14, 4.0], [44, 12, 1.5]], 0);
      return h + 0.18 * Math.sin(d * 1.9) + 0.1 * Math.sin(d * 4.3 + 1);
    };
    curtain(1300, A0 - 48, A0 + 52, 110, 16, crest, (a, t, e, eT) => {
      const patch = 0.5 + 0.5 * Math.sin(a * 0.31 + e * 0.55) * Math.cos(a * 0.13 - e * 0.21);   // пятна травы и кустов — крупные, без ряби
      const rust = sst(0.55, 0.95, 0.5 + 0.5 * Math.sin(a * 0.19 - e * 0.37 + 2));
      const cc = mix(mix(mix(C.hill, C.hillHi, patch), C.rust, rust * 0.6), C.rock, sst(eT - 2.6, eT - 0.6, e) * sst(8, 10, eT) * 0.6);
      return mix(mix(cc, C.hillLo, sst(0.3, 0, t) * 0.5), HAZE, 0.14);
    }, -7);
    const ridgeGeo = new T.BufferGeometry();
    ridgeGeo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    ridgeGeo.setAttribute('color', new T.Float32BufferAttribute(CL, 3));
    ridgeGeo.setIndex(IX);
    const ridgeMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
    ridgeMat.userData.dn = 'world';
    root.add(new T.Mesh(ridgeGeo, ridgeMat));

    /* ---------- село: панорама на дуге перед холмом (28° × 14°, 2048 × 1024 логических точек) и слой окон ночью ---------- */
    const SPAN = 28, E0 = -3.5, E1 = 10.5;
    const crestY = x => PH * (E1 - crest(A0 + SPAN / 2 - SPAN * x / PW)) / (E1 - E0);
    function arc(R) {
      const g = new T.BufferGeometry(), p = [], uv = [], ix = [], NA = 28, NE = 4;
      for (let i = 0; i <= NA; i++) for (let j = 0; j <= NE; j++) {
        const u = i / NA, v = j / NE, q = pos(A0 + SPAN / 2 - SPAN * u, E0 + (E1 - E0) * v, R);
        p.push(q[0], q[1], q[2]); uv.push(u, v);
      }
      for (let i = 0; i < NA; i++) for (let j = 0; j < NE; j++) { const a = i * (NE + 1) + j, b = a + NE + 1; ix.push(a, b, a + 1, b, b + 1, a + 1); }
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(ix);
      return g;
    }
    const pics = paintVillage(lowQ ? 1024 : 2048, lowQ ? 512 : 1024, rng(1010), crestY);
    const texOf = cv => { const t = new T.CanvasTexture(cv); t.anisotropy = 4; t.minFilter = T.LinearMipmapLinearFilter; return t; };
    const dayTex = texOf(pics.day), nightTex = texOf(pics.night);
    const villGeo = arc(1150), nightGeo = arc(1146);
    const villMat = new T.MeshBasicMaterial({ map: dayTex, transparent: true, depthWrite: false });
    villMat.userData.dn = 'world';
    const nightMat = new T.MeshBasicMaterial({ map: nightTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 });
    nightMat.userData.dn = 'none';
    const villMesh = new T.Mesh(villGeo, villMat), nightMesh = new T.Mesh(nightGeo, nightMat);
    villMesh.renderOrder = 1; nightMesh.renderOrder = 2; nightMesh.visible = false;
    root.add(villMesh, nightMesh);
    root.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.matrixAutoUpdate = false; m.updateMatrix(); } });

    const tris = IX.length / 3 + 2 * villGeo.index.count / 3;
    const far = {
      scene, root, visible: true,
      render(renderer, camera) {
        if (!far.visible) return;
        if (cam.fov !== camera.fov || cam.aspect !== camera.aspect) { cam.fov = camera.fov; cam.aspect = camera.aspect; cam.updateProjectionMatrix(); }
        camera.getWorldQuaternion(cam.quaternion);
        renderer.render(scene, cam);
      },
      setNight(kk) { const v = clamp(kk || 0, 0, 1); nightMat.opacity = v; nightMesh.visible = v > 0.01; },
      info: () => ({ tris, calls: nightMesh.visible ? 3 : 2 }),
      dispose() { [ridgeGeo, villGeo, nightGeo].forEach(g => g.dispose()); [ridgeMat, villMat, nightMat].forEach(m => m.dispose()); [dayTex, nightTex].forEach(t => t.dispose()); },
    };
    return far;
  };
})();
