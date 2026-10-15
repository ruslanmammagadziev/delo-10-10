/* =====================================================================
   3D-ГОРОД (Three.js). Полностью объёмный мир: героиня, кот и голуби —
   3D-модели; дома смоделированы целиком (вывески, окна, двери, козырьки,
   пожарная лестница); за улицей — кварталы и мягкие холмы.
   Мультяшный свет (toon) с мягкими тенями.
   Управление: стрелки/WASD, джойстик на телефоне, тап по земле.
   Если WebGL недоступен — игра использует 2D-улицу.
   ===================================================================== */
(function () {
  const T = window.THREE;
  const supported = (() => {
    try {
      if (!T) return false;
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  })();

  /* ---------- Планировка ---------- */
  const FRONT_Z = -2;
  const B = { cinema: 0, bureau: 6.2, sweets: 16.2, roof: 22.6 };
  const DOOR_DX = { cinema: 0, bureau: 0, sweets: 1.05, roof: 1.1 };
  const doorPos = k => ({ x: B[k] + DOOR_DX[k], z: FRONT_Z + 0.75 });
  const SKIN = '#F7DCC8', INK = '#3A2E3F';
  const PI = Math.PI;

  const shade = (hex, pct) => (window.Art && Art.shade ? Art.shade(hex, pct) : hex);
  const mixHex = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();
  const greyOf = c => { const g = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * 0.93; return new T.Color(g * 0.97, g * 0.98, Math.min(1, g * 1.04)); };
  // нераскрытый дом — светлый пудровый серый с лёгкой сиренью (не угольный): форма читается, цвет потом вливается
  const greyKit = c => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11, g = 0.5 + l * 0.44; return new T.Color(g * 0.985, g * 0.965, Math.min(1, g * 1.03)); };
  const angDiff = (a, b) => { let d = (a - b) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- Канвасы: вывески и лица ---------- */
  function cnv(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function text(c, s, x, y, size, col, o = {}) {
    c.font = `${o.w || 900} ${size}px ${o.f || 'Nunito'}, system-ui, sans-serif`;
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    const m = c.measureText(s).width;
    if (o.max && m > o.max) { c.save(); c.translate(x, y); c.scale(o.max / m, 1); c.fillText(s, 0, 0); c.restore(); return; }
    c.fillText(s, x, y);
  }
  const greyCache = new WeakMap();
  function greyCanvas(src) {
    if (greyCache.has(src)) return greyCache.get(src);
    const [cv, c] = cnv(src.width, src.height); c.drawImage(src, 0, 0);
    const d = c.getImageData(0, 0, cv.width, cv.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) { const l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255, g = (0.4 + l * 0.57) * 255; px[i] = g * 0.985; px[i + 1] = g * 0.965; px[i + 2] = Math.min(255, g * 1.03); }
    c.putImageData(d, 0, 0); greyCache.set(src, cv); return cv;
  }
  async function fontsReady() {
    try {
      await Promise.race([
        Promise.all(['900 40px Nunito', '800 40px Nunito', '700 40px Comfortaa', '700 40px Caveat'].map(f => document.fonts.load(f, 'АаZz'))),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    } catch (e) { /* запасной шрифт */ }
  }
  function makeSigns() {
    const S = {};
    S.cinema = (() => { const [cv, c] = cnv(1024, 336); c.fillStyle = '#FFF0CE'; rrect(c, 0, 0, 1024, 336, 44); c.fill();
      text(c, 'КИНОТЕАТР', 512, 84, 58, '#C2405B'); text(c, 'Саспенс', 512, 218, 136, '#9E2F47', { f: 'Comfortaa', w: 700, max: 900 }); return cv; })();
    S.poster1 = (() => { const [cv, c] = cnv(256, 368); c.fillStyle = '#463A4E'; c.fillRect(0, 0, 256, 368);
      c.fillStyle = '#FFF4EC'; c.beginPath(); c.arc(128, 140, 52, 0, 7); c.fill(); c.fillStyle = '#2F2834'; c.beginPath(); c.arc(128, 140, 24, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(138, 130, 8, 0, 7); c.fill();
      text(c, 'ТИХИЙ ВЕЧЕР', 128, 296, 30, '#F7C9D3', { max: 228 }); return cv; })();
    S.poster2 = (() => { const [cv, c] = cnv(256, 368); c.fillStyle = '#463A4E'; c.fillRect(0, 0, 256, 368);
      text(c, '?', 128, 165, 170, '#F7C9D3', { f: 'Comfortaa', w: 700 }); text(c, 'СКОРО', 128, 300, 34, '#F7C9D3'); return cv; })();
    S.kassa = (() => { const [cv, c] = cnv(512, 136); c.fillStyle = '#FFF0CE'; rrect(c, 0, 0, 512, 136, 30); c.fill(); text(c, 'КАССА', 256, 70, 80, '#9E2F47'); return cv; })();
    S.bureau = (() => { const [cv, c] = cnv(1024, 272); c.fillStyle = '#FFFDF9'; rrect(c, 0, 0, 1024, 272, 40); c.fill();
      c.fillStyle = '#E3F4EC'; c.beginPath(); c.arc(140, 136, 100, 0, 7); c.fill();
      text(c, 'LOST IN', 610, 94, 92, '#2F3A5A'); text(c, 'TRANSLATION', 610, 190, 92, '#2F3A5A', { max: 700 }); return cv; })();
    S.bureauSmall = (() => { const [cv, c] = cnv(512, 104); c.fillStyle = '#2F3A5A'; rrect(c, 0, 0, 512, 104, 26); c.fill(); text(c, 'бюро переводов', 256, 54, 50, '#FFFDF9', { w: 800, max: 470 }); return cv; })();
    S.open = (() => { const [cv, c] = cnv(256, 80); c.fillStyle = '#FFFDF9'; rrect(c, 0, 0, 256, 80, 14); c.fill(); text(c, 'ОТКРЫТО', 128, 42, 40, '#2F3A5A', { max: 230 }); return cv; })();
    S.sweets = (() => { const [cv, c] = cnv(1024, 340);
      text(c, 'Сахарная', 512, 108, 124, '#C2405B', { f: 'Comfortaa', w: 700, max: 960 }); text(c, 'пудра', 512, 240, 124, '#C2405B', { f: 'Comfortaa', w: 700 }); return cv; })();
    S.sweetsWin = (() => { const [cv, c] = cnv(512, 80); text(c, 'эклеры · пироги · какао', 256, 42, 46, '#C2405B', { f: 'Caveat', w: 700, max: 480 }); return cv; })();
    S.mat = (() => { const [cv, c] = cnv(256, 144); c.fillStyle = '#F2C4CC'; rrect(c, 0, 0, 256, 144, 22); c.fill();
      c.strokeStyle = '#FFF6EE'; c.lineWidth = 6; c.setLineDash([12, 8]); rrect(c, 12, 12, 232, 120, 16); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#E8879E'; c.beginPath(); c.moveTo(62, 94); c.bezierCurveTo(28, 70, 40, 40, 62, 58); c.bezierCurveTo(84, 40, 96, 70, 62, 94); c.fill();
      text(c, 'привет', 164, 74, 52, '#8E2340', { f: 'Caveat', w: 700 }); return cv; })();
    S.exit = (() => { const [cv, c] = cnv(512, 200); c.fillStyle = '#FFFDF9'; rrect(c, 0, 0, 512, 200, 20); c.fill();
      text(c, 'ВЫХОД', 256, 64, 68, INK); text(c, 'НА КРЫШУ', 256, 140, 68, INK, { max: 470 }); return cv; })();
    S.stairs = (() => { const [cv, c] = cnv(512, 210); c.fillStyle = '#FFFDF9'; rrect(c, 0, 0, 512, 210, 22); c.fill();
      c.strokeStyle = '#C2405B'; c.lineWidth = 12; rrect(c, 8, 8, 496, 194, 18); c.stroke();
      text(c, 'СТУПЕНЬКИ', 256, 76, 60, '#C2405B', { max: 450 }); text(c, 'УШЛИ НА ОБЕД', 256, 144, 60, '#C2405B', { max: 450 }); return cv; })();
    S.silver = (() => { const [cv, c] = cnv(512, 104); c.fillStyle = '#F4EFE6'; rrect(c, 0, 0, 512, 104, 20); c.fill();
      // часовая мастерская: два циферблата по краям и надпись
      const dial = (x, y, r, h1, h2) => { c.fillStyle = '#FFFDF9'; c.strokeStyle = '#8E7C6E'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#8E7C6E'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.beginPath(); c.arc(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78, i % 3 ? 1.6 : 2.6, 0, 7); c.fill(); }
        c.strokeStyle = '#3A2E3F'; c.lineCap = 'round'; [[h1, r * 0.45, 4], [h2, r * 0.68, 3]].forEach(([a, l, w]) => { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); c.stroke(); }); };
      dial(62, 52, 34, 0.5, 2.1); dial(450, 52, 34, 5.2, 3.6);
      text(c, 'ЧАСЫ', 256, 56, 64, '#6F5F54', { max: 300 }); return cv; })();
    S.gazety = (() => { const [cv, c] = cnv(512, 112); text(c, 'ГАЗЕТЫ', 256, 58, 80, '#FFFDF9'); return cv; })();
    S.weather = (() => { const [cv, c] = cnv(512, 296); c.fillStyle = '#3E4C72'; rrect(c, 0, 0, 512, 296, 24); c.fill(); text(c, 'ПРОГНОЗ', 256, 58, 58, '#BFE6D3'); return cv; })();
    S.note = (() => { const [cv, c] = cnv(128, 104); c.fillStyle = '#FFFBF2'; c.fillRect(0, 0, 128, 104);
      text(c, 'ушли', 64, 40, 34, INK, { f: 'Caveat', w: 700 }); text(c, 'на чай', 64, 74, 34, INK, { f: 'Caveat', w: 700 }); return cv; })();
    S.flowers = (() => { const [cv, c] = cnv(512, 180); c.fillStyle = '#3E4C3F'; rrect(c, 0, 0, 512, 180, 18); c.fill();
      c.strokeStyle = '#C9A27A'; c.lineWidth = 8; rrect(c, 6, 6, 500, 168, 14); c.stroke();
      text(c, 'Цветы', 256, 62, 66, '#FFFDF9', { f: 'Caveat', w: 700 }); text(c, 'следователям — бесплатно', 256, 128, 40, '#F6C6D0', { f: 'Caveat', w: 700, max: 470 }); return cv; })();
    S.ticket = (() => { const [cv, c] = cnv(256, 128); c.fillStyle = '#F6C6D0'; c.fillRect(0, 0, 256, 128);
      text(c, 'РЯД 3', 128, 44, 40, '#3A2E3F'); text(c, 'МЕСТО 13', 128, 90, 40, '#3A2E3F'); return cv; })();
    S.dial = (() => { const [cv, c] = cnv(128, 128); c.fillStyle = '#FFFDF9'; c.beginPath(); c.arc(64, 64, 64, 0, 7); c.fill();
      text(c, '13', 64, 22, 24, '#3A2E3F'); text(c, '3', 108, 64, 20, '#3A2E3F'); text(c, '6', 64, 106, 20, '#3A2E3F'); text(c, '9', 20, 64, 20, '#3A2E3F'); return cv; })();
    S.carpet = (() => { const [cv, c] = cnv(256, 200); c.fillStyle = '#A8344A'; c.fillRect(0, 0, 256, 200);
      c.strokeStyle = '#2F3A5A'; c.lineWidth = 16; c.strokeRect(8, 8, 240, 184); c.strokeStyle = '#E9C46A'; c.lineWidth = 5; c.strokeRect(22, 22, 212, 156);
      const dia = (x, y, w, h, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h); c.lineTo(x - w, y); c.closePath(); c.fill(); };
      [64, 128, 192].forEach((x, i) => { dia(x, 100, 30, 52, '#F4E6CF'); dia(x, 100, 18, 32, i === 1 ? '#2F3A5A' : '#E07A3F'); dia(x, 100, 7, 12, '#F4E6CF'); });
      for (let x = 36; x < 230; x += 16) { dia(x, 34, 4, 5, '#F4E6CF'); dia(x, 166, 4, 5, '#F4E6CF'); }
      return cv; })();
    return S;
  }
  // Лицо героини: те же черты, что в 2D-арте, на сферической «маске» головы
  function heroFaceCanvas(closed) {
    const [cv, c] = cnv(512, 360);
    c.setTransform(9, 0, 0, 9, -284, -334.6);
    const BR = '#2B1D18', EY = '#2E1E18';
    const F = (d, col) => { c.fillStyle = col; c.fill(new Path2D(d)); };
    const L = (d, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)); };
    const E = (x, y, rx, ry, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, PI * 2); c.fill(); c.globalAlpha = 1; };
    E(42, 66, 5, 2.6, '#F59AAE', 0.42); E(78, 66, 5, 2.6, '#F59AAE', 0.42);
    F('M41,48.4 Q46,44.6 53.2,46.2 L53,49.4 Q46.5,47.9 41.6,50.4 Z', BR);
    F('M79,48.4 Q74,44.6 66.8,46.2 L67,49.4 Q73.5,47.9 78.4,50.4 Z', BR);
    if (closed) {
      L('M41,57.2 Q47,60.8 53,57.2', EY, 1.9); L('M67,57.2 Q73,60.8 79,57.2', EY, 1.9);
      L('M41.2,57.4 L39.2,56.4 M78.8,57.4 L80.8,56.4', BR, 1.3);
    } else {
      F('M41,57.5 Q47,51.6 53,57 Q47,61.6 41,57.5 Z', EY);
      F('M79,57.5 Q73,51.6 67,57 Q73,61.6 79,57.5 Z', EY);
      L('M40.4,57 Q47,50.6 53.6,56.6', BR, 1.7); L('M79.6,57 Q73,50.6 66.4,56.6', BR, 1.7);
      L('M40.6,56.8 L38.6,55.2 M79.4,56.8 L81.4,55.2', BR, 1.4);
      E(48.6, 55.6, 1.25, 1.25, '#fff'); E(74.6, 55.6, 1.25, 1.25, '#fff');
    }
    L('M59.2,64.8 Q60.6,66.6 62,65.8', '#D9A58F', 1.2);
    F('M56,70.6 Q58,68.9 60,70.1 Q62,68.9 64,70.6 Q60,71.7 56,70.6 Z', '#D47F8A');
    F('M56.4,70.8 Q60,75.2 63.6,70.8 Q60,71.9 56.4,70.8 Z', '#E2949C');
    return cv;
  }
  // Лицо героини по рисунку автора (js/hero_assets.js → HERO.face3d): две картинки 512×360 в той же раскладке,
  // что у heroFaceCanvas. Грузятся один раз; нет HERO или картинки не открылись — остаётся рисованное лицо.
  let heroFaceP = null;
  function heroFaceImgs() {
    const H = window.HERO;
    if (!H || !H.face3d || !H.face3d.open) return Promise.resolve(null);
    if (!heroFaceP) {
      const ld = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      heroFaceP = Promise.race([
        Promise.all([ld(H.face3d.open), ld(H.face3d.closed || H.face3d.open)]).then(([open, closed]) => ({ open, closed })),
        new Promise(r => setTimeout(() => r(null), 2500)),
      ]).catch(() => null).then(v => { if (!v) heroFaceP = null; return v; });
    }
    return heroFaceP;
  }
  // наклейка лица: кожа того же цвета, что голова, черты с рисунка поверх; убраны две крошки от прядки у левого глаза.
  // Левую бровь на рисунке срезает прядь (обрубок с прямым краем) — вместо неё зеркальная правая (ось лица x = 256).
  const HERO_BROW_TILT = 0.1;   // рад (~6°): поворот брови вокруг внешнего кончика, см. heroFaceDecal
  function heroFaceDecal(img, skin) {
    const [cv, c] = cnv(512, 360);
    c.fillStyle = skin; c.fillRect(0, 0, 512, 360);
    c.drawImage(img, 0, 0, 512, 360);
    c.fillStyle = skin;
    c.fillRect(84, 56, 119, 63);                                              // срезанная левая бровь и крошка над ней
    c.fillRect(290, 60, 180, 60);                                             // правая бровь — перерисуем ниже
    c.beginPath(); c.ellipse(57.5, 188, 9.5, 17, 0.12, 0, PI * 2); c.fill(); // прядка у внешнего уголка левого глаза
    // бровь чуть повёрнута вокруг внешнего кончика, внутренний конец выше: игровая камера смотрит сверху, и на сфере
    // ровные брови сходятся к переносице «домиком» — героиня выглядела сердитой
    const brow = () => { c.save(); c.translate(461, 118); c.rotate(HERO_BROW_TILT); c.translate(-461, -118); c.drawImage(img, 290, 60, 180, 60, 290, 60, 180, 60); c.restore(); };
    brow();
    c.save(); c.translate(512, 0); c.scale(-1, 1); brow(); c.restore();      // правая бровь → зеркально налево
    return cv;
  }
  function catFaceCanvas(closed) {
    const [cv, c] = cnv(512, 512);
    c.setTransform(12.5, 0, 0, 12.5, -306.5, -146.2);
    const L = (d, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke(new Path2D(d)); };
    const E = (x, y, rx, ry, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, PI * 2); c.fill(); c.globalAlpha = 1; };
    L('M41,21 L43,27 M45,20 L45,26.5 M49,21 L47,27', '#D9934A', 2.2);
    E(31.9, 45.9, 3.9, 2.2, '#F59AAE', 0.55); E(58.1, 45.9, 3.9, 2.2, '#F59AAE', 0.55);
    if (closed) { L('M34,42 Q37.5,37 41,42', '#2E2A3B', 2.4); L('M49,42 Q52.5,37 56,42', '#2E2A3B', 2.4); }
    else { E(37.5, 41, 2.6, 3.43, '#2E2A3B'); E(52.5, 41, 2.6, 3.43, '#2E2A3B'); E(38.5, 39.6, 1, 1, '#fff'); E(53.5, 39.6, 1, 1, '#fff'); }
    c.fillStyle = '#E8798F'; c.fill(new Path2D('M43.4,44.4 L46.6,44.4 L45,46.2 Z'));
    L('M41,47 Q43,50 45,47 Q47,50 49,47', '#6B3A48', 1.8);
    L('M27,43 L35,44 M27,47 L35,46.5 M63,43 L55,44 M63,47 L55,46.5', '#B7864F', 1.1);
    return cv;
  }
  // Лицо жителя: глаза, щёчки, нос, рот; маска енота, светлая мордочка лисы и т. п.
  function animalFaceCanvas(f, closed) {
    const [cv, c] = cnv(512, 512);
    const E = (x, y, rx, ry, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, PI * 2); c.fill(); c.globalAlpha = 1; };
    const L = (d, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)); };
    const ex = f.ex || 92, ey = f.ey || 360, er = f.er || 34, INKC = '#2E2A3B';
    if (f.muzzle) E(256, ey + 70, f.muzzleW || 104, f.muzzleH || 66, f.muzzle);
    if (f.disc) { E(256 - ex, ey, er * 2.3, er * 2.3, f.disc); E(256 + ex, ey, er * 2.3, er * 2.3, f.disc); }
    if (f.mask) { c.fillStyle = f.mask; c.fill(new Path2D(`M${256 - ex - 78},${ey} Q${256 - ex - 40},${ey - 52} ${256 - 20},${ey - 26} Q256,${ey - 14} ${256 + 20},${ey - 26} Q${256 + ex + 40},${ey - 52} ${256 + ex + 78},${ey} Q${256 + ex + 30},${ey + 50} ${256 + 18},${ey + 26} Q256,${ey + 20} ${256 - 18},${ey + 26} Q${256 - ex - 30},${ey + 50} ${256 - ex - 78},${ey} Z`)); }
    if (!f.noBlush) { E(256 - ex - 66, ey + 64, 30, 17, '#F59AAE', 0.55); E(256 + ex + 66, ey + 64, 30, 17, '#F59AAE', 0.55); }
    [-1, 1].forEach(sd => {
      const x = 256 + sd * ex;
      if (f.white) E(x, ey, er * 1.25, er * 1.25, '#FFFFFF');
      if (closed) L(`M${x - er * 0.9},${ey + 4} Q${x},${ey - er * 0.9} ${x + er * 0.9},${ey + 4}`, INKC, 9);
      else { E(x, ey, er * 0.78, er, INKC); E(x + er * 0.28, ey - er * 0.36, er * 0.3, er * 0.3, '#FFFFFF'); }
      if (f.lash && !closed) L(`M${x + sd * er * 0.7},${ey - er * 0.7} L${x + sd * er * 1.15},${ey - er * 1.05}`, INKC, 6);
    });
    if (f.nose) E(256, ey + 58, f.noseW || 17, f.noseH || 12, f.nose);
    if (f.mouth === 'w') L(`M${256 - 26},${ey + 86} Q${256 - 13},${ey + 102} 256,${ey + 86} Q${256 + 13},${ey + 102} ${256 + 26},${ey + 86}`, '#6B3A48', 7);
    else if (f.mouth === 'smile') L(`M${256 - 24},${ey + 88} Q256,${ey + 108} ${256 + 24},${ey + 88}`, '#6B3A48', 7);
    return cv;
  }
  function labelCanvas(s, bg = '#C2405B') {
    const [cv0, c0] = cnv(8, 8); c0.font = '900 44px Nunito, system-ui, sans-serif';
    const w = Math.ceil(c0.measureText(s).width) + 56;
    const [cv, c] = cnv(w, 96);
    c.fillStyle = bg; rrect(c, 4, 4, w - 8, 76, 26); c.fill();
    c.beginPath(); c.moveTo(w / 2 - 14, 78); c.lineTo(w / 2 + 14, 78); c.lineTo(w / 2, 94); c.closePath(); c.fill();
    text(c, s, w / 2, 44, 44, '#fff');
    return cv;
  }
  function blobCanvas() {
    const [cv, c] = cnv(64, 64); const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(112,64,98,.34)'); g.addColorStop(1, 'rgba(112,64,98,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); return cv;
  }

  /* ---------- Комнаты (интерьеры): регистрируются отдельными файлами ---------- */
  const ROOMS = {}, EXTS = {};
  // волна 4: что держит настоящая рука (имя предмета js/interact.js) и строка, когда кончилось (как в прогулке)
  const IA_ITEM = { popcorn: 'popcorn', cup: 'cocoa', cocoa: 'cocoa', pretzel: 'pretzel', flower: 'flower', bread: 'bread' };
  const IA_DONE = { cup: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.', cocoa: 'Допила. Теперь можно думать о важных вещах. Например, о втором какао.', popcorn: 'Попкорн исчез. Пирожок клянётся, что ничего не трогал.', pretzel: 'Крендель съеден. На пальто — капелька сахарной пудры.', bread: 'Вкусно! Ни крошки не осталось.' };
  let LAST_HELD = null;   // что было в руке, когда закрылась последняя комната ({ kind, data } | null) — лавки города забирают на улицу
  function registerRoom(id, def) { ROOMS[id] = def; }
  // расширение сюжетной комнаты содержимым прогулки (работает только при o.mode === 'free')
  function extendRoom(id, ext) { (EXTS[id] = EXTS[id] || []).push(ext); }
  // новые витрины для свободной прогулки: { x, doorDx, name, build(R) → { g, doors } }
  const SHOPS = {};
  function registerShop(key, def) { SHOPS[key] = def; }

  /* ---------- Главная функция прогулки ---------- */
  // «Помахать»: кнопка 👋 и облачка над героиней и жителем (стили — здесь, чтобы не трогать общий CSS)
  const WAVE_CSS = `.city3d .ctl.wave{position:absolute;right:16px;bottom:calc(88px + var(--safe-bottom, 0px));width:54px;height:54px;font-size:26px;z-index:20}
.city3d.focus-on .ctl.wave{display:none!important}
.city3d .ctl.wave.go{animation:c3dWave .8s ease-in-out}
@keyframes c3dWave{20%{transform:rotate(-18deg)}45%{transform:rotate(16deg)}70%{transform:rotate(-10deg)}}
.c3d-say{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#3A2E3F;font-weight:900;font-size:14px;line-height:1.2;padding:7px 12px;border-radius:14px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap;pointer-events:none;z-index:7;animation:c3dSay .28s cubic-bezier(.3,1.6,.5,1) both;transition:opacity .35s}
.c3d-say::after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-top-color:#fff;border-bottom:0}
.c3d-say.hero{background:#FFF0F3;color:#9E2F47}.c3d-say.hero::after{border-top-color:#FFF0F3}
.c3d-say.out{opacity:0}
@keyframes c3dSay{from{opacity:0;transform:translate(-50%,-70%) scale(.7)}}`;
  const ensureWaveCss = () => { if (document.getElementById('c3dWaveCss')) return; const st = document.createElement('style'); st.id = 'c3dWaveCss'; st.textContent = WAVE_CSS; document.head.appendChild(st); };
  // ответ жителя на «помахать», если сценарий места не ответил сам (G.onWave): с именем — не чаще раза в 2 минуты
  const WAVE_REPLY = { name: ['Привет, {name}!', 'О, {name}! Привет!', 'Приятно познакомиться, {name}!'], plain: ['Привет-привет!', 'И тебе привет!', 'Привет! Заходи ещё.'],
    cat: { name: ['Мур. Привет, {name}.'], plain: ['Мур.', 'Мяу. Это «привет».'] } };
  const HI_AGAIN = ['Hi!', 'Hello!', 'Hey there!'];
  const greeted = new Set();   // кому уже представилась за эту сессию
  let waveN = 0;

  // 3D-героиня по модели автора (js/hero3d.js): грузится один раз за сессию — в простое вскоре после старта
  // (если телефон тянет 3D) или при первом входе в 3D. Не успела или не открылась — рисованная героиня.
  const heroModelOff = () => { try { return !!window.HERO3D_OFF || (window.G && G.state().force2d); } catch (e) { return false; } };
  function heroModel(ms) {
    const H3 = window.HERO3D;
    if (!H3 || typeof H3.whenReady !== 'function' || !T || !T.GLTFLoader || heroModelOff()) return Promise.resolve(null);
    return H3.whenReady(ms).catch(() => null);
  }
  if (supported && window.HERO3D && T && T.GLTFLoader) {
    const kick = () => { if (!heroModelOff()) heroModel(0); };
    const ric = window.requestIdleCallback || (f => setTimeout(f, 1));
    window.addEventListener('load', () => setTimeout(() => ric(kick, { timeout: 4000 }), 1200));
  }

  async function run(o) {
    const { haptic, sfx, toast } = G;
    const scr = G.show(`
      <div class="city3d">
        <canvas class="c3d"></canvas>
        <div class="c3d-loading">строим город…</div>
        <div class="edge-arrow hidden" id="edge"></div>
        <div class="near-bubble hidden" id="nearBubble"></div>
        <div class="joy hidden" id="joy"><div class="joy-knob"></div></div>
        <button class="ctl act hidden" id="act">Войти</button>
        <button class="ctl wave hidden" id="waveBtn" aria-label="Помахать">👋</button>
        <div class="ctl-hint hidden" id="hint"></div>
      </div>`, 'street street3d');
    G.setHud({ label: o.hudLabel }); G.tgHeader('#FFF4EC');
    const root = scr.querySelector('.city3d'), canvas = scr.querySelector('.c3d');
    const ROOM = o.room ? (ROOMS[o.room] || (o.room === 'stairs' ? ROOMS.roof : null) || (o.room === 'roof' ? ROOMS.stairs : null)) : null;
    if (o.room && !ROOM) { if (o.fallback) o.fallback(); return; }
    const FREE = !ROOM && !!o.free;
    const FO = FREE ? (typeof o.free === 'object' ? o.free : {}) : null;
    const DOORS = {};
    if (FREE && FO.doors) FO.doors.forEach(d => { DOORS[d.id] = { x: d.x, z: FRONT_Z + 0.75, bkey: d.bkey || d.id, label: d.label || '', mark: d.mark || null }; });
    else {
      Object.keys(B).forEach(k => { DOORS[k] = doorPos(k); });
      if (FREE) { DOORS.silver = { x: 11.9 + 0.57, z: FRONT_Z + 0.75 }; DOORS.kiosk = { x: 9.6, z: -0.25 }; Object.keys(SHOPS).forEach(k => { DOORS[k] = { x: SHOPS[k].x + (SHOPS[k].doorDx || 0), z: FRONT_Z + 0.75 }; }); }
    }
    if (FREE && !o.isLit) o.isLit = () => true;
    // ключ здания на улице → id двери (для тапа по фасаду): roof → stairs и т. п.
    const BKEY2DOOR = {}; Object.keys(DOORS).forEach(id => { BKEY2DOOR[DOORS[id].bkey || id] = id; BKEY2DOOR[id] = id; });
    const doorOf = k => DOORS[k] || doorPos(k);
    const isOpen = k => !!k && (FREE ? (o.openDoors || Object.keys(DOORS)).includes(k) : k === o.target);
    const doorLabel = k => (DOORS[k] && DOORS[k].label) || (o.names && o.names[k]) || '';
    const LI = ROOM ? 3 : Math.min(o.idx || 0, 3);
    // свет и фон комнаты: тёплый интерьер, за «срезом» кукольного домика — мягкая темнота
    const RLOOK = ROOM ? Object.assign({ sky: '#F6E6EC', gnd: '#C9A39A', hi: 0.68, sun: '#FFE4C8', si: 0.46, off: [-3.5, 8.5, 7], bg: 'radial-gradient(130% 90% at 50% 35%, #6A4A63 0%, #3B2A3C 72%)', rim: ['#FFD9C0', 0.2], fog: '#3B2A3C' }, ROOM.look || {}) : null;
    // небо для 3D: переходы ужаты в верх кадра, к концу серии — тёплый горизонт
    const SKY3D = [
      'linear-gradient(180deg,#959CB4 0%,#B3B5C9 16%,#CFCFDB 36%,#CFCFDB 100%)',
      'linear-gradient(180deg,#A2A8C6 0%,#C6C0DA 16%,#E2DAE3 36%,#E2DAE3 100%)',
      'linear-gradient(180deg,#A6A2D0 0%,#CDBBDD 13%,#E8CFDC 25%,#F1DCDD 36%,#F1DCDD 100%)',
      'linear-gradient(180deg,#9F99CE 0%,#CFB4D8 12%,#F0C8CC 24%,#F8D9CC 36%,#F8D9CC 100%)',
    ];
    const FOG3D = [['#CFCFDB', 18, 105], ['#E2DAE3', 22, 115], ['#F1DCDD', 24, 125], ['#F8D9CC', 22, 120]];
    const LOOKS = [
      { sky: '#D6DAEA', gnd: '#C4B4B6', hi: 0.78, sun: '#EEEAF2', si: 0.28, off: [-6, 14, 6] },
      { sky: '#E0DAEE', gnd: '#D2BEB8', hi: 0.72, sun: '#FFEADB', si: 0.36, off: [-7, 13, 7] },
      { sky: '#E6D8EE', gnd: '#DDC0B0', hi: 0.64, sun: '#FFE0C2', si: 0.44, off: [-7.5, 11.5, 7.5] },
      { sky: '#E4D4EE', gnd: '#E8C2AE', hi: 0.60, sun: '#FFD4AA', si: 0.49, off: [-8, 9.5, 7.5] },
    ];
    LOOKS.forEach((L, i) => { L.i = i; });
    const RIMS = [['#DCE2FF', 0.10], ['#FFEFE6', 0.14], ['#FFE4D0', 0.18], ['#FFD0AE', 0.26]];
    const LK = ROOM ? Object.assign({ i: 3 }, RLOOK) : LOOKS[LI];
    root.style.background = ROOM ? RLOOK.bg : SKY3D[LI];
    if (ROOM) root.classList.add('room3d');
    root.dataset.idx = LI;
    const edge = scr.querySelector('#edge'), bubble = scr.querySelector('#nearBubble'), joy = scr.querySelector('#joy'), knob = joy.querySelector('.joy-knob');
    const act = scr.querySelector('#act'), hint = scr.querySelector('#hint'), waveBtn = scr.querySelector('#waveBtn');
    ensureWaveCss();
    const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return true; } })();

    /* --- рендерер, сцена, свет --- */
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' }); } catch (e) { return o.fallback(); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    const scene = new T.Scene();
    scene.fog = ROOM ? new T.Fog(new T.Color(RLOOK.fog), 30, 70) : new T.Fog(new T.Color(FOG3D[LI][0]), FOG3D[LI][1], FOG3D[LI][2]);
    const camera = new T.PerspectiveCamera(52, 1, 0.1, 260);
    const hemi = new T.HemisphereLight(LK.sky, LK.gnd, LK.hi); scene.add(hemi);
    const sun = new T.DirectionalLight(LK.sun, LK.si);
    const curOff = LK.off.slice();
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 3.5;
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 2, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
    const RIM0 = ROOM ? RLOOK.rim : RIMS[LI];
    const RIM = { col: { value: new T.Color(RIM0[0]) }, str: { value: RIM0[1] } };
    function addRim(mat, k = 1) {
      const kU = { value: k }, own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
      const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');   // свой шейдер у материала (статуэтка) — сохраняем
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        Object.assign(sh.uniforms, { rimCol: RIM.col, rimStr: RIM.str, rimK: kU });
        sh.fragmentShader = 'uniform vec3 rimCol;\nuniform float rimStr;\nuniform float rimK;\n' + sh.fragmentShader.replace('#include <output_fragment>',
          'float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\noutgoingLight += rimCol * (rimStr * rimK * smoothstep(0.55, 0.95, rimF));\n#include <output_fragment>');
      };
      mat.customProgramCacheKey = () => 'rim1' + (prevKey ? prevKey.call(mat) : '');
      return mat;
    }
    scene.add(sun); scene.add(sun.target);
    let CAM = { dx: 2.4, y: 4.5, dz: 9, ly: 1.5, lz: -1.3 };
    const resize = () => {
      const w = root.clientWidth || 1, h = root.clientHeight || 1, a = w / h;
      if (ROOM) {
        const rc = (ROOM.cam && (a < 0.75 ? ROOM.cam.portrait : ROOM.cam.landscape)) || {};
        if (a < 0.75) { camera.fov = rc.fov || 56; CAM = Object.assign({ dx: 0.2, y: 3.5, dz: 7.4, ly: 1.2, lz: -1.9 }, rc); }
        else { camera.fov = rc.fov || 46; CAM = Object.assign({ dx: 0.4, y: 3.3, dz: 6.8, ly: 1.2, lz: -1.8 }, rc); }
      } else if (a < 0.75) { camera.fov = 58; CAM = { dx: 1.6, y: 5.1, dz: 10.4, ly: 1.6, lz: -1.6 }; }
      else { camera.fov = 48; CAM = { dx: 2.6, y: 4.4, dz: 9, ly: 1.5, lz: -1.2 }; }
      renderer.setSize(w, h, false); camera.aspect = a; camera.updateProjectionMatrix();
    };
    resize(); window.addEventListener('resize', resize);

    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const GEO = {
      box: keep(new T.BoxGeometry(1, 1, 1)),
      sph: keep(new T.SphereGeometry(1, 22, 16)),
      sphLo: keep(new T.SphereGeometry(1, 12, 9)),
      cyl: keep(new T.CylinderGeometry(1, 1, 1, 20)),
      cylLo: keep(new T.CylinderGeometry(1, 1, 1, 8)),
      cone: keep(new T.ConeGeometry(1, 1, 18)),
      plane: keep(new T.PlaneGeometry(1, 1)),
      halfDisc: keep(new T.CylinderGeometry(1, 1, 1, 14, 1, false, -PI / 2, PI)),
      halfCyl: keep(new T.CylinderGeometry(1, 1, 1, 22, 1, false, 0, PI)),
      hemi: keep(new T.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI / 2)),
      pot: keep(new T.CylinderGeometry(1, 0.78, 1, 18)),
    };
    const flatCone = keep(new T.ConeGeometry(1, 1, 9).toNonIndexed()); flatCone.computeVertexNormals();
    // мягкая 4-тоновая рампа: ступени есть, но края у них мягкие
    const GV = [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255];
    const gd = new Uint8Array(64); GV.forEach((v, i) => gd.set([v, v, v, 255], i * 4));
    const GRAD = keep(new T.DataTexture(gd, 16, 1, T.RGBAFormat));
    GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    const toon = (c, x = {}) => keep(new T.MeshToonMaterial(Object.assign({ color: new T.Color(c), gradientMap: GRAD }, x)));
    const tex = cv => { const t = keep(new T.CanvasTexture(cv)); t.anisotropy = 4; return t; };
    const PM = {};
    const pm = c => PM[c] || (PM[c] = toon(c));

    const put = (par, geo, mat, p, s, r) => {
      const m = new T.Mesh(geo, mat);
      if (p) m.position.set(p[0], p[1], p[2]);
      if (s) m.scale.set(s[0], s[1], s[2]);
      if (r) m.rotation.set(r[0], r[1], r[2]);
      m.castShadow = true; m.receiveShadow = true; par.add(m); return m;
    };
    const box = (par, mat, x, y, z, w, h, d, r) => put(par, GEO.box, mat, [x, y, z], [w, h, d], r);
    // мелкие шарики (< 7 см) — облегчённая сфера: на экране телефона разницы нет, треугольников втрое меньше
    const sph = (par, mat, x, y, z, sx, sy, sz) => { sy = sy === undefined ? sx : sy; sz = sz === undefined ? sx : sz; return put(par, Math.max(sx, sy, sz) < 0.07 ? GEO.sphLo : GEO.sph, mat, [x, y, z], [sx, sy, sz]); };
    const cyl = (par, mat, x, y, z, r, h, rot) => put(par, GEO.cyl, mat, [x, y, z], [r, h, r], rot);
    const plane = (par, mat, x, y, z, w, h, rz = 0) => { const m = put(par, GEO.plane, mat, [x, y, z], [w, h, 1], [0, 0, rz]); m.castShadow = false; return m; };
    const extrude = (shape, depth) => keep(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 }));
    // Сглаживание нормалей с порогом угла: плоские грани остаются плоскими, скругления — мягкие
    function smoothCrease(g, deg) {
      const pos = g.attributes.position, n = pos.count, cos = Math.cos(deg * PI / 180);
      const fn = new Float32Array(n * 3), fw = new Float32Array(n * 3), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        c.sub(b); a.sub(b); c.cross(a);
        const ln = c.length() || 1;
        for (let j = 0; j < 3; j++) { const q = (i + j) * 3; fw[q] = c.x; fw[q + 1] = c.y; fw[q + 2] = c.z; fn[q] = c.x / ln; fn[q + 1] = c.y / ln; fn[q + 2] = c.z / ln; }
      }
      const groups = new Map();
      for (let i = 0; i < n; i++) {
        const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
        let l = groups.get(key); if (!l) groups.set(key, l = []); l.push(i);
      }
      const out = new Float32Array(n * 3);
      groups.forEach(l => l.forEach(i => {
        let x = 0, y = 0, z = 0;
        l.forEach(j => { const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2]; if (d >= cos) { x += fw[j * 3]; y += fw[j * 3 + 1]; z += fw[j * 3 + 2]; } });
        const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
      }));
      g.setAttribute('normal', new T.BufferAttribute(out, 3));
      return g;
    }
    // Скруглённый бокс (мягкие края вместо острых): контур со скруглёнными углами + фаска-полукруг
    const RB = new Map();
    function rboxGeo(w, h, d, r) {
      r = Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
      const k = [w, h, d, r].map(v => v.toFixed(3)).join('|');
      if (RB.has(k)) return RB.get(k);
      const b = r * 0.55, rc = r - b * 0.4, sw = w - 2 * b, sh = h - 2 * b, c = Math.min(rc, sw / 2 - 0.001, sh / 2 - 0.001);
      const s = new T.Shape();
      s.moveTo(-sw / 2 + c, -sh / 2); s.lineTo(sw / 2 - c, -sh / 2); s.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + c);
      s.lineTo(sw / 2, sh / 2 - c); s.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - c, sh / 2);
      s.lineTo(-sw / 2 + c, sh / 2); s.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - c);
      s.lineTo(-sw / 2, -sh / 2 + c); s.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + c, -sh / 2);
      const g = keep(new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4 }));
      g.center(); smoothCrease(g, 50);
      RB.set(k, g); return g;
    }
    const rbox = (par, mat, x, y, z, w, h, d, r = 0.06, rot) => put(par, rboxGeo(w, h, d, r), mat, [x, y, z], null, rot);
    function archShape(w, h, x0 = 0) {
      const r = w / 2, s = new T.Shape();
      s.moveTo(x0 - r, 0); s.lineTo(x0 - r, h - r); s.absarc(x0, h - r, r, PI, 0, true); s.lineTo(x0 + r, 0); s.closePath();
      return s;
    }
    function triShape(w, h) { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); return s; }
    function rrP(P, w, h, r, cy) { const x = -w / 2, y = cy - h / 2; P.moveTo(x + r, y); P.lineTo(x + w - r, y); P.quadraticCurveTo(x + w, y, x + w, y + r); P.lineTo(x + w, y + h - r); P.quadraticCurveTo(x + w, y + h, x + w - r, y + h); P.lineTo(x + r, y + h); P.quadraticCurveTo(x, y + h, x, y + h - r); P.lineTo(x, y + r); P.quadraticCurveTo(x, y, x + r, y); return P; }
    function arcP(P, w, h, y0) { const r = w / 2; P.moveTo(-r, y0); P.lineTo(r, y0); P.lineTo(r, y0 + h - r); P.absarc(0, y0 + h - r, r, 0, PI, false); P.lineTo(-r, y0); return P; }
    const FRC = new Map();
    function frameGeo(w, h, t, arch) {
      const k = [w, h, t, arch].join(); if (FRC.has(k)) return FRC.get(k);
      const W2 = w + 2 * t, H2 = h + 2 * t, sh = arch ? arcP(new T.Shape(), W2, H2, -H2 / 2) : rrP(new T.Shape(), W2, H2, 0.09, 0);
      sh.holes.push(arch ? arcP(new T.Path(), w, h, -h / 2) : rrP(new T.Path(), w, h, 0.05, 0));
      const g = keep(new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 10 }));
      smoothCrease(g, 50); FRC.set(k, g); return g;
    }
    let glintM = null;
    function windowF(g, fm, gm, x, y, w, h, opt = {}) {
      if (!glintM) glintM = keep(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.45, depthWrite: false }));
      put(g, frameGeo(w, h, 0.09, opt.arch), fm, [x, y, 0]);
      if (opt.arch) put(g, keep(new T.ShapeGeometry(arcP(new T.Shape(), w, h, -h / 2), 10)), gm, [x, y, 0.02]); else box(g, gm, x, y, 0.02, w, h, 0.04);
      plane(g, glintM, x - w * 0.18, y + h * 0.1, 0.045, 0.07, h * 0.55, -0.55); plane(g, glintM, x - w * 0.05, y + h * 0.16, 0.045, 0.035, h * 0.3, -0.55);
      if (opt.cross) { box(g, fm, x, y + h * 0.12, 0.05, w, 0.04, 0.05); box(g, fm, x, y, 0.05, 0.04, h, 0.05); }
      if (opt.sill !== false) rbox(g, fm, x, y - h / 2 - 0.13, 0.11, w + 0.36, 0.09, 0.24, 0.04);
      if (opt.shut) [-1, 1].forEach(sd => { const sx = x + sd * (w / 2 + 0.1 + w * 0.22); rbox(g, opt.shut, sx, y, 0.05, w * 0.42, h + 0.06, 0.05, 0.022); for (let j = 0; j < 3; j++) box(g, fm, sx, y - h * 0.3 + j * h * 0.2, 0.08, w * 0.3, 0.02, 0.01); put(g, heartG, fm, [sx, y + h * 0.3, 0.076], [0.06, 0.06, 0.04]); });
    }
    function cornice(g, cap, H, W, D) {
      rbox(g, cap, 0, H + 0.08, -D / 2, W + 0.24, 0.16, D + 0.24, 0.07);
      rbox(g, cap, 0, H + 0.27, -D / 2, W + 0.46, 0.22, D + 0.46, 0.1);
    }

    // Склейка статичных мешей по материалам: меньше вызовов отрисовки на телефоне
    function bake(group, key, opt = {}) {
      group.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(group.matrixWorld).invert();
      const byMat = new Map(), gone = [];
      group.traverse(m => {
        if (!m.isMesh || m.userData.dyn) return;
        for (let p = m.parent; p && p !== group; p = p.parent) if (p.userData.dyn) return;
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        if (!byMat.has(m.material)) byMat.set(m.material, []);
        byMat.get(m.material).push(g); gone.push(m);
      });
      gone.forEach(m => m.parent.remove(m));
      byMat.forEach((geos, mat) => {
        let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let off = 0;
        geos.forEach(g => {
          pos.set(g.attributes.position.array, off * 3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
          g.userData.vn = g.attributes.position.count; g.userData.vc = g.attributes.color || null;
          off += g.attributes.position.count; g.dispose();
        });
        const mg = keep(new T.BufferGeometry());
        mg.setAttribute('position', new T.BufferAttribute(pos, 3));
        mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
        mg.setAttribute('uv', new T.BufferAttribute(uv, 2));
        if (mat.vertexColors) {   // материал с цветами вершин: цвета переносим (у кого их нет — белый)
          const col = new Float32Array(n * 3).fill(1); let o2 = 0;
          geos.forEach(g => { const ca = g.userData.vc; if (ca && ca.itemSize === 3) col.set(ca.array, o2 * 3); o2 += g.userData.vn; });
          mg.setAttribute('color', new T.BufferAttribute(col, 3));
        }
        mg.computeBoundingSphere(); mg.computeBoundingBox();
        const mesh = new T.Mesh(mg, mat);
        mesh.castShadow = opt.cast !== false; mesh.receiveShadow = opt.receive !== false;
        group.add(mesh);
      });
      if (key) group.userData.key = key;
      return group;
    }

    // Набор материалов дома: серые, пока дело не раскрыто, и цветные после
    function makeKit(lit) {
      const mats = [], texs = [], cache = new Map();
      const K = {
        lit, anim: false,
        m(color, x = {}) {
          const key = color + '|' + (x.glow || '') + '|' + (x.gi || '') + '|' + (x.id || '');
          if (cache.has(key)) return cache.get(key);
          const col = new T.Color(color);
          const mat = toon(lit ? col : greyKit(col));
          mat.userData = { col, glow: !!x.glow, gi: x.gi || 0.5 };
          if (x.glow) { mat.emissive = new T.Color(x.glow); mat.emissiveIntensity = lit ? mat.userData.gi : 0; }
          mats.push(mat); cache.set(key, mat); return mat;
        },
        t(cv, x = {}) {
          const tc = tex(cv), tg = tex(greyCanvas(cv));
          const mat = toon('#FFFFFF', { map: lit ? tc : tg, alphaTest: x.alpha ? 0.5 : 0 });
          texs.push({ mat, tc, tg }); return mat;
        },
        set(on, animate) {
          if (K.lit === on) return; K.lit = on;
          texs.forEach(x => { x.mat.map = on ? x.tc : x.tg; x.mat.needsUpdate = true; });
          const from = mats.map(m => m.color.clone()), fromE = mats.map(m => m.emissiveIntensity || 0);
          const to = mats.map(m => (on ? m.userData.col : greyKit(m.userData.col)));
          const dur = animate ? 1300 : 0, t0 = performance.now(); K.anim = true;
          const step = () => {
            const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, e = k * k * (3 - 2 * k);
            mats.forEach((m, i) => { m.color.copy(from[i]).lerp(to[i], e); if (m.userData.glow) m.emissiveIntensity = fromE[i] + ((on ? m.userData.gi : 0) - fromE[i]) * e; });
            if (k < 1) requestAnimationFrame(step); else K.anim = false;
          };
          step();
        },
      };
      return K;
    }

    const loading = scr.querySelector('.c3d-loading');
    if (ROOM) loading.textContent = 'Открываем дверь…';
    await fontsReady();
    const SIGN = makeSigns();
    const R = rng(1010);

    /* --- общая осенняя палитра: в дождь приглушённая, к концу серии яркая --- */
    const fade = o.idx === 0 ? 0.5 : o.idx === 1 ? 0.22 : 0;
    const warm = (c, k = 1) => mixHex(c, '#B8B3B6', fade * k);
    // «бугристая» сфера: мягкий комковатый силуэт, нормали сферические — заливка гладкая
    const blobGeo = keep(new T.SphereGeometry(1, 14, 10));
    { const p = blobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.08 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7) * Math.sin(z * 4.4 + 0.7) - (y < -0.4 ? 0.15 * (-y - 0.4) : 0); p.setXYZ(i, x * k, y * k, z * k); } }
    function blobDisc(seed) {
      const s = new T.Shape(), q = rng(seed), k1 = q() * 6, k2 = q() * 6;
      for (let i = 0; i <= 32; i++) { const a = i / 32 * PI * 2, r = 1 + 0.12 * Math.sin(3 * a + k1) + 0.07 * Math.sin(5 * a + k2); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const g = new T.ShapeGeometry(s); g.rotateX(-PI / 2); return keep(g);
    }
    const leafSh = new T.Shape(); leafSh.moveTo(0, -0.5); leafSh.quadraticCurveTo(0.42, -0.15, 0.05, 0.5); leafSh.quadraticCurveTo(-0.38, -0.1, 0, -0.5);
    const leafUp = keep(new T.ShapeGeometry(leafSh, 4)), leafFlat = keep(leafUp.clone().rotateX(-PI / 2));
    const WARM = [0.45, 0.7, 0.88, 1][LI];
    const warmC = h => { const c = new T.Color(h), g = greyOf(c); if (o.rain) g.multiplyScalar(0.94); return g.lerp(c, WARM); };
    const aut = (h, x) => toon(warmC(h), x);
    const blob = (par, m, x, y, z, sx, sy, sz, r) => put(par, blobGeo, m, [x, y, z], [sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz], r);
    const HEX = { pumpO: '#EE9A55', pumpP: '#F5BE8A', pumpC: '#F6EBDC', pumpB: '#EBA7A0', pumpS: '#B7C49A', stem: '#7A8B4E', leafG: '#8FAE62', mumPk: '#EFA3B5', mumPkL: '#F7C9D4', mumY: '#F3CF73', mumYL: '#F9E3A6', mumR: '#D9774F', mumRL: '#E99A6E', mumL: '#C7A8DD', mumLL: '#DCC6EC', potT: '#D48D6A', potP: '#EBB4BE', potC: '#F4E8DA', potS: '#B9C9AE', woodL: '#D2A274', woodD: '#B07F55', bow: '#E8879E', bowD: '#C9677F', plum: '#5A4A55', cream: '#FFF6EE' };
    const AM = {}; Object.keys(HEX).forEach(k => { AM[k] = aut(HEX[k]); });
    function bowAt(par, m, md, x, y, z, s = 1) {
      [-1, 1].forEach(k => { put(par, GEO.sphLo, m, [x + k * 0.06 * s, y, z], [0.065 * s, 0.038 * s, 0.025 * s], [0, 0, k * 0.45]); box(par, m, x + k * 0.035 * s, y - 0.09 * s, z - 0.005, 0.026 * s, 0.13 * s, 0.008 * s, [0, 0, k * 0.28]); });
      put(par, GEO.sphLo, md, [x, y, z + 0.01 * s], [0.026 * s, 0.026 * s, 0.02 * s]);
    }
    function wreath(K, Rr, bowHex) {
      const w = new T.Group(), lm = [K.m('#D9774F'), K.m('#E8A84F'), K.m('#9DA765')], berry = K.m('#C2405B'), bw = K.m(bowHex), bwD = K.m('#C9677F');
      for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2; put(w, GEO.sphLo, lm[i % 3], [Math.cos(a) * Rr, Math.sin(a) * Rr, 0], [0.06, 0.042, 0.03], [0, 0, a + 0.6]); }
      for (let i = 0; i < 6; i++) { const a = 0.4 + i * 1.05; put(w, GEO.sphLo, berry, [Math.cos(a) * Rr * 1.08, Math.sin(a) * Rr * 1.08, 0.025], [0.022, 0.022, 0.022]); }
      bowAt(w, bw, bwD, 0, -Rr, 0.035, 1);
      bake(w, null, { cast: false });
      return w;
    }
    const bowLoop = keep(new T.TorusGeometry(0.32, 0.14, 8, 18));
    function bow(par, mat, x, y, z, s) {
      [-1, 1].forEach(k => { put(par, bowLoop, mat, [x + k * 0.36 * s, y, z], [s, 0.72 * s, 0.55 * s], [0, 0, k * 0.35]); put(par, GEO.box, mat, [x + k * 0.2 * s, y - 0.55 * s, z], [0.16 * s, 0.75 * s, 0.05 * s], [0, 0, k * 0.32]); });
      put(par, GEO.sph, mat, [x, y, z + 0.02 * s], [0.18 * s, 0.2 * s, 0.14 * s]);
    }
    /* --- мелочи для домов: кружево, шторки, ящики с цветами, девичий виноград --- */
    function sconce(g, K, x, y) {
      const iron = K.m('#5B4A63'), lampM = K.m('#FFE3A3', { glow: '#FFC46B', gi: 0.9 });
      box(g, iron, x, y, 0.03, 0.07, 0.14, 0.05); cyl(g, iron, x, y + 0.03, 0.15, 0.012, 0.22, [PI / 2, 0, 0]);
      put(g, GEO.cylLo, lampM, [x, y - 0.06, 0.26], [0.065, 0.15, 0.065]); put(g, GEO.cone, iron, [x, y + 0.07, 0.26], [0.1, 0.08, 0.1]); put(g, GEO.sphLo, iron, [x, y + 0.13, 0.26], [0.02, 0.02, 0.02]);
    }
    const sphS = (par, m, x, y, z, sx, sy = sx, sz = sx) => put(par, GEO.sphLo, m, [x, y, z], [sx, sy, sz]);
    const RGC = new Map(), ringG = (r, t) => { const k = r + '|' + t; if (!RGC.has(k)) RGC.set(k, keep(new T.TorusGeometry(r, t, 6, 20))); return RGC.get(k); };
    // кружевной подзор: полукруглые фестоны вниз и бусинка под каждым
    function lace(g, m, x0, x1, y, z, r = 0.1, m2) {
      const n = Math.max(2, Math.round((x1 - x0) / (1.9 * r))), st = (x1 - x0) / n;
      for (let i = 0; i < n; i++) { const x = x0 + st * (i + 0.5); put(g, GEO.halfDisc, m2 && i % 2 ? m2 : m, [x, y, z], [st / 2, 0.025, r], [PI / 2, 0, 0]); sphS(g, m, x, y - r - 0.012, z + 0.012, 0.022); }
    }
    const heartSh = new T.Shape(); heartSh.moveTo(0, -0.5); heartSh.bezierCurveTo(-0.9, 0.1, -0.6, 0.85, 0, 0.45); heartSh.bezierCurveTo(0.6, 0.85, 0.9, 0.1, 0, -0.5);
    const heartG = keep(new T.ExtrudeGeometry(heartSh, { depth: 0.2, bevelEnabled: false, curveSegments: 6 }));
    // драпировки по бокам окна и ламбрекен-фестоны сверху (перед стеклом)
    function curtains(g, m, x, y, w, h, valance = true) {
      [-1, 1].forEach(sd => sphS(g, m, x + sd * w * 0.36, y - 0.03, 0.045, w * 0.15, h * 0.45, 0.018));
      if (valance) for (let i = 0; i < 4; i++) put(g, GEO.halfDisc, m, [x - w * 0.375 + i * w * 0.25, y + h / 2 - 0.01, 0.05], [w * 0.125, 0.02, 0.07], [PI / 2, 0, 0]);
    }
    // пухлый ящик с хризантемами, плети свисают вниз
    function flowerBox(g, boxM, leafM, fl, x, y, w) {
      rbox(g, boxM, x, y, 0.16, w, 0.14, 0.18, 0.03);
      const n = Math.max(3, Math.round(w / 0.1));
      for (let i = 0; i < n; i++) {
        const fx = x - w / 2 + 0.05 + i * (w - 0.1) / (n - 1);
        put(g, blobGeo, leafM, [fx, y + 0.1, 0.15], [0.065, 0.055, 0.065]); sphS(g, fl[i % fl.length], fx + 0.015, y + 0.15, 0.2, 0.042);
        if (i % 3 === 1) put(g, leafUp, leafM, [fx, y - 0.11, 0.252], [0.07, 0.15, 0.07], [0, 0, PI + 0.25]).castShadow = false;
      }
    }
    // девичий виноград на боковой стене: до раскрытия серый рельеф, потом вспыхивает багрянцем
    const IVY = ['#C8473F', '#E07A45', '#B23A55', '#E9A94B'];
    function ivy(g, K, W, H, side, seed, n, cols, vines, front) {
      const rr = rng(seed), M = cols.map(c => K.m(c)), stem = K.m('#8A5A44'), xw = side * (W / 2 + 0.025);
      vines.forEach(([z0, hk]) => {
        const pts = []; for (let i = 0; i <= 6; i++) pts.push(new T.Vector3(xw, 0.15 + i / 6 * H * hk, z0 + Math.sin(i * 1.7 + z0) * 0.22));
        const cv = new T.CatmullRomCurve3(pts); put(g, keep(new T.TubeGeometry(cv, 18, 0.014, 4)), stem).castShadow = false;
        for (let i = 0; i < n / vines.length; i++) {
          const t = Math.pow(rr(), 1.4), pt = cv.getPoint(t), sc = 0.11 + rr() * 0.07 - t * 0.04;
          put(g, leafUp, M[Math.floor(rr() * M.length)], [xw + side * 0.008 * (i % 3), pt.y + (rr() - 0.5) * 0.3, Math.min(-0.06, pt.z + (rr() - 0.5) * 0.4)], [sc, sc, sc], [0, side * PI / 2, (rr() - 0.5) * 2.6]).castShadow = false;
        }
      });
      if (front) for (let i = 0; i < 10; i++) { const sc = 0.1 + rr() * 0.05; put(g, leafUp, M[i % M.length], [side * (W / 2 - 0.06 - rr() * 0.32), 0.3 + rr() * 1.2, 0.03 + (i % 3) * 0.004], [sc, sc, sc], [0, 0, rr() * 6]).castShadow = false; }
    }

    // объекты улицы, к которым обращается общий цикл (в комнате остаются пустыми)
    let street = null, SM = {}, LAMPS = [], PUDDLES = [], PILES = [], PS = { x: 1e6, z: 1e6, r: 0 }, kits = {}, buildings = {}, mail = null, D = null, kickM = [],
      CHIM = [], SPN = 0, smoke = null, FLK = [], birds = null, sM = null, sQ = null, sS = null, sP = null, secretMesh = null, tgtDoor = { x: 0, z: 0 }, mark = null, arrow = null, clouds = [],
      beeG = null, poodle = null, gosling = null, PLOOP = [], poodleT = 0, poodleFollow = 0, poodleSpin = -1, poodlePos = null, goslingPos = null, poodleTaps = 0,
      sunflower = null, sunRefl = null, sunReflHalo = null, reflHideT = 0, psFirst = true, splashes = 0, duskFlash = () => {};
    const haloTex = (() => { const [hcv, hcx] = cnv(128, 128), hg = hcx.createRadialGradient(64, 64, 0, 64, 64, 64);
      hg.addColorStop(0, 'rgba(255,240,210,1)'); hg.addColorStop(0.18, 'rgba(255,214,160,.75)'); hg.addColorStop(0.5, 'rgba(255,180,140,.22)'); hg.addColorStop(1, 'rgba(255,170,140,0)');
      hcx.fillStyle = hg; hcx.fillRect(0, 0, 128, 128); return tex(hcv); })();
    if (!ROOM) { // земля, фонари, деревья, дома, декор, метка: только на улице
      /* --- земля: тёплая брусчатка, скруглённый бордюр, лавандовый асфальт, зебра --- */
      street = new T.Group(); scene.add(street);
      const [tcv, tcx] = cnv(256, 256), TR = rng(7);
      tcx.fillStyle = '#D6C8C2'; tcx.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? 32 : 0;
        for (let c = -1; c < 5; c++) {
          const x = c * 64 + off + 3, y = r * 64 + 3;
          tcx.fillStyle = `hsl(${16 + TR() * 16}, ${16 + TR() * 12}%, ${87 + (TR() - 0.5) * 5}%)`; rrect(tcx, x, y, 58, 58, 13); tcx.fill();
          tcx.fillStyle = 'rgba(255,255,255,.25)'; rrect(tcx, x + 7, y + 6, 30, 11, 5); tcx.fill();
        }
      }
      const tileTex = tex(tcv); tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping; tileTex.repeat.set(35, 4);
      const LC = ['#E9955A', '#E07A5F', '#F0C05A', '#D9826B', '#E8A6A0'].map(c => toon(warm(c)));
      // мягкое зерно асфальта: дорога не пустая лавандовая полоса
      const [acv, acx] = cnv(256, 256), AR = rng(11); acx.fillStyle = '#FFFFFF'; acx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) { acx.fillStyle = AR() < 0.5 ? 'rgba(110,90,125,.07)' : 'rgba(255,248,252,.10)'; acx.beginPath(); acx.arc(AR() * 256, AR() * 256, 2 + AR() * 7, 0, 7); acx.fill(); }
      const roadTex = tex(acv); roadTex.wrapS = roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(24, 2.4);
      SM = {
        walk: toon(o.rain ? '#CDD1D8' : '#FFFFFF', { map: tileTex }), curb: toon(warm('#D2C6CA')), road: toon(o.rain ? '#9EA3AD' : '#A9A3B3', { map: roadTex }), dash: toon('#F6EFEA'), far: toon(o.rain ? '#B7BEC2' : '#CBC3B4'),
        metal: toon('#6E6470'), metalD: toon('#574E5A'), lamp: toon('#6A5670'), lampD: toon('#584862'), wood: toon('#B98C6A'), woodD: toon('#93694C'), trunk: toon('#8A6A55'),
        pine: toon('#8FA889'), pineD: toon('#7D9878'), larch: toon(warm('#D8B45E')), larchD: toon(warm('#C99E4A')),
        pot: toon('#C9A28A'), red: toon(warm('#D9566E', 0.7)), blue: toon(warm('#9DB8E0', 0.7)), white: toon('#FFF6EE'), bow: toon(warm('#E58FA6', 0.7)),
        bulb: keep(new T.MeshBasicMaterial({ color: 0xFFE3A3 })), puddle: toon('#A9B6CC'),
      };
      rbox(street, SM.walk, 11, -0.06, -1.25, 84, 0.12, 9.5, 0.03);
      rbox(street, SM.curb, 11, -0.02, 3.55, 84, 0.2, 0.3, 0.08);
      const groundM = put(street, GEO.plane, SM.far, [11, -0.13, 0], [260, 260, 1], [-PI / 2, 0, 0]); groundM.castShadow = false;
      const roadM = put(street, GEO.plane, SM.road, [11, -0.12, 7.75], [84, 8.3, 1], [-PI / 2, 0, 0]); roadM.castShadow = false;
      for (let x = -28; x < 52; x += 3) if (Math.abs(x) > 2) rbox(street, SM.dash, x, -0.11, 7.75, 1.4, 0.02, 0.16, 0.008);
      for (let z = 4.1; z < 11.6; z += 0.8) rbox(street, SM.dash, 0, -0.11, z, 2.6, 0.02, 0.42, 0.01);

      /* --- фонари-«леденцы» с бантами и кашпо --- */
      const poleGeo = keep(new T.CylinderGeometry(0.038, 0.062, 1, 10));
      const armGeo = keep(new T.TubeGeometry(new T.CubicBezierCurve3(new T.Vector3(0, 2.72, 0), new T.Vector3(0, 3.22, 0), new T.Vector3(0, 3.27, -0.36), new T.Vector3(0, 3.06, -0.5)), 14, 0.03, 6));
      const haloSprites = [];
      function lamp(x, z, par, i) {
        put(par, rboxGeo(0.36, 0.12, 0.36, 0.05), SM.lampD, [x, 0.06, z]);
        put(par, GEO.cyl, SM.lampD, [x, 0.21, z], [0.1, 0.2, 0.1]); put(par, GEO.sphLo, SM.lampD, [x, 0.33, z], [0.08, 0.05, 0.08]);
        put(par, poleGeo, SM.lamp, [x, 1.55, z], [1, 2.5, 1]); put(par, GEO.sphLo, SM.lamp, [x, 2.8, z], [0.07, 0.07, 0.07]);
        put(par, armGeo, SM.lamp, [x, 0, z]).castShadow = false;
        put(par, GEO.cyl, SM.lampD, [x, 3.0, z - 0.5], [0.025, 0.08, 0.025]);
        put(par, GEO.hemi, SM.lampD, [x, 2.93, z - 0.5], [0.14, 0.09, 0.14]); put(par, GEO.sphLo, SM.lampD, [x, 3.04, z - 0.5], [0.04, 0.04, 0.04]);
        put(par, GEO.sph, SM.bulb, [x, 2.79, z - 0.5], [0.15, 0.17, 0.15]).castShadow = false;
        if (i % 2 === 0) bow(par, SM.bow, x, 2.42, z + 0.07, 0.17);
        else {
          put(par, GEO.hemi, SM.pot, [x, 1.95, z + 0.18], [0.17, 0.14, 0.17], [PI, 0, 0]);
          [0, 1, 2, 3, 4].forEach(j => put(par, blobGeo, j % 2 ? LC[4] : LC[2], [x + Math.cos(j * 1.3) * 0.1, 2.0, z + 0.18 + Math.sin(j * 1.3) * 0.1], [0.07, 0.07, 0.07]));
          [-0.08, 0.06].forEach(d => put(par, keep(new T.CapsuleGeometry(0.018, 0.16, 3, 6)), toon('#7FA06E'), [x + d, 1.82, z + 0.26]));
        }
        haloSprites.push([x, 2.79, z - 0.5]);
      }

      /* --- осенние деревья: пухлые кроны, тополь-свечка, лиственница --- */
      const AUT = [['#F2A65A', '#DB8646', '#FFD3A3'], ['#E98A7E', '#CF6A62', '#FFC4B8'], ['#EDC55B', '#D4A73E', '#FFE6A3'], ['#E7A1B0', '#CC8096', '#FFD4DE'], ['#D98A5F', '#B96B48', '#F4BC98']];
      const TM = AUT.map(p => p.map(c => addRim(toon(warm(c, 0.6)), 0.8)));
      const TCARPET = AUT.map(p => toon(warm(p[1], 0.6)));   // ковёр листьев под деревом — свой материал: на нём тени нужны, на кронах нет
      const trunkGeo = keep(new T.CylinderGeometry(0.6, 1, 1, 9));
      function tree(x, z, s = 1, pi = 0) {
        const [mB, mD, mL] = TM[pi % 5], q = rng(pi * 31 + 7);
        put(street, trunkGeo, SM.trunk, [x, 0.7 * s, z], [0.12 * s, 1.4 * s, 0.12 * s]);
        put(street, GEO.cone, SM.trunk, [x, 0.1 * s, z], [0.2 * s, 0.24 * s, 0.2 * s]);
        [-1, 1].forEach(k => put(street, trunkGeo, SM.trunk, [x + k * 0.2 * s, 1.35 * s, z], [0.05 * s, 0.6 * s, 0.05 * s], [0, 0, -k * 0.6]));
        put(street, blobGeo, mB, [x, 1.95 * s, z], [0.82 * s, 0.9 * s, 0.78 * s], [0, q() * 6, 0]);
        for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + q(), up = k % 2; put(street, blobGeo, up ? mL : mD, [x + Math.cos(a) * 0.6 * s, (1.62 + up * 0.55) * s, z + Math.sin(a) * 0.42 * s], [(0.42 + q() * 0.14) * s, (0.4 + q() * 0.12) * s, (0.42 + q() * 0.1) * s], [0, q() * 6, 0]); }
        put(street, blobGeo, mL, [x + 0.12 * s, 2.55 * s, z - 0.05 * s], [0.42 * s, 0.38 * s, 0.4 * s]);
        put(street, blobDisc(pi + 40), TCARPET[pi % 5], [x + 0.15 * s, 0.007, z + 0.1 * s], [1.15 * s, 1, 0.8 * s]).castShadow = false;
      }
      function poplar(x, z, s, pi) {
        const [mB, mD, mL] = TM[pi % 5];
        put(street, trunkGeo, SM.trunk, [x, 0.5 * s, z], [0.1 * s, 1.0 * s, 0.1 * s]);
        put(street, blobGeo, mB, [x, 2.3 * s, z], [0.62 * s, 1.45 * s, 0.6 * s]); put(street, blobGeo, mD, [x - 0.3 * s, 1.55 * s, z + 0.15 * s], [0.4 * s, 0.5 * s, 0.38 * s]); put(street, blobGeo, mL, [x + 0.22 * s, 3.0 * s, z], [0.36 * s, 0.55 * s, 0.34 * s]);
      }
      function larch(x, z, s, pi) {
        const [mB, mD, mL] = TM[pi % 5];
        put(street, trunkGeo, SM.trunk, [x, 0.45 * s, z], [0.09 * s, 0.9 * s, 0.09 * s]);
        [[0.75, 1.3, mD], [0.56, 1.95, mB], [0.36, 2.5, mL]].forEach(([r, y, m]) => put(street, blobGeo, m, [x, y * s, z], [r * s, r * 0.85 * s, r * s]));
      }
      function pine(par, x, y, z, s = 1, yellow = false) {
        cyl(par, SM.trunk, x, y + 0.3 * s, z, 0.08 * s, 0.6 * s);
        [[0.55, 0.9, 0.85], [0.42, 0.75, 1.35], [0.28, 0.6, 1.8]].forEach(([r, h, yy], i) => put(par, GEO.cone, yellow ? (i % 2 ? SM.larchD : SM.larch) : (i % 2 ? SM.pineD : SM.pine), [x, y + yy * s, z], [r * s, h * s, r * s]));
      }
      /* --- пастельные лавочки с завитками, подушка и шарф --- */
      const benchCurve = keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0, 0.18), new T.Vector3(0, 0.42, 0.18), new T.Vector3(0, 0.46, -0.04), new T.Vector3(0, 0.62, -0.2), new T.Vector3(0, 0.92, -0.27)]), 16, 0.028, 6));
      function bench(x, z, col) {
        const m = toon(warm(col));
        for (let i = 0; i < 3; i++) rbox(street, m, x, 0.47, z - 0.13 + i * 0.13, 1.42, 0.06, 0.12, 0.025);
        for (let i = 0; i < 2; i++) rbox(street, m, x, 0.66 + i * 0.16, z - 0.24, 1.42, 0.11, 0.045, 0.02, [-0.12, 0, 0]);
        [-0.62, 0.62].forEach(dx => put(street, benchCurve, SM.lampD, [x + dx, 0, z]));
      }
      LAMPS = [-3.2, 3.1, 9, 14.2, 19.6, 26.5].concat(FREE ? [-9.1, -12.9, 32.0, 35.75] : []);   // на прогулке — в промежутках между витринами
      const lampsG = new T.Group(); scene.add(lampsG); LAMPS.forEach((x, i) => lamp(x, 3.25, lampsG, i)); bake(lampsG, 'lamp');
      // ореолы фонарей и тёплые пятна света на тротуаре: ярче всего в дождь и в «золотой час»
      const HALO = [{ col: '#FFC890', op: 0.85, size: 1.25, pool: 0.5, bulb: '#FFE3A6' }, { col: '#FFD0A0', op: 0.55, size: 1.05, pool: 0.3, bulb: '#FFE9B8' }, { col: '#FFD8B0', op: 0.35, size: 0.9, pool: 0.18, bulb: '#FFEFC8' }, { col: '#FFB98A', op: 0.75, size: 1.2, pool: 0.42, bulb: '#FFDFA0' }][LI];
      SM.bulb.color.set(HALO.bulb);
      const haloMat = keep(new T.SpriteMaterial({ map: haloTex, color: new T.Color(HALO.col), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: HALO.op, fog: false }));
      haloSprites.forEach(([x, y, z]) => { const sp = new T.Sprite(haloMat); sp.position.set(x, y, z); sp.scale.setScalar(HALO.size); sp.renderOrder = 4; scene.add(sp); });
      const poolTex = (() => { const [pcv, pcx] = cnv(128, 128), pg = pcx.createRadialGradient(64, 64, 0, 64, 64, 64);
        pg.addColorStop(0, 'rgba(255,214,170,.9)'); pg.addColorStop(0.55, 'rgba(255,200,160,.35)'); pg.addColorStop(1, 'rgba(255,200,160,0)'); pcx.fillStyle = pg; pcx.fillRect(0, 0, 128, 128); return tex(pcv); })();
      const poolMat = keep(new T.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: HALO.pool, polygonOffset: true, polygonOffsetFactor: -2 }));
      LAMPS.forEach(x => { const m = put(scene, GEO.plane, poolMat, [x, 0.012, 2.55], [2.4, 1.8, 1], [-PI / 2, 0, 0]); m.castShadow = false; m.receiveShadow = false; m.userData.noPick = true; });
      if (FREE) { tree(-4.4, -1.7, 0.85, 0); tree(27.0, -1.7, 0.9, 3); }   // не задевают оранжерею и пластинки
      else { tree(-4.6, -1.7, 1, 0); tree(27.6, -1.7, 1.05, 3); }
      if (FREE) {   // концы улицы: дерево, изгородь и табличка «дальше — туман»
        tree(-18.6, -1.6, 0.95, 1); tree(41.8, -1.6, 1.0, 2);
        [[-17.3, 'endL'], [40.5, 'endR']].forEach(([x, id]) => {
          const sg = new T.Group(); sg.position.set(x, 0, -0.9); sg.userData.key = 'spot:' + id; scene.add(sg);
          cyl(sg, SM.woodD, 0, 0.55, 0, 0.04, 1.1); rbox(sg, SM.wood, 0, 1.05, 0.03, 0.8, 0.36, 0.06, 0.03);
          const [ecv, ec] = cnv(256, 112); ec.fillStyle = '#FFF6EE'; rrect(ec, 0, 0, 256, 112, 18); ec.fill(); text(ec, 'дальше —', 128, 38, 34, '#8A6A55', { f: 'Caveat', w: 700 }); text(ec, 'туман', 128, 80, 42, '#C2405B', { f: 'Caveat', w: 700 });
          plane(sg, toon('#FFFFFF', { map: tex(ecv) }), 0, 1.05, 0.065, 0.74, 0.32);
          for (let i = 0; i < 4; i++) blob(street, AM.potS, x - 0.9 + i * 0.6, 0.24, -1.62, 0.34, 0.26, 0.24);
        });
        // ящик под дверью мастерской: ступенек нет, но следствие находчиво
        rbox(street, SM.wood, 11.9 + 0.57, 0.16, -1.75, 0.5, 0.32, 0.4, 0.03);
      }
      tree(2.9, -7, 1.9, 0); poplar(9.4, -7.6, 1.45, 2); tree(19.4, -7, 2, 1); poplar(-2.2, -8.4, 1.5, 4); tree(25.6, -8.2, 1.8, 3); larch(13.6, -6.5, 1.6, 2);
      bench(4.4, -1.15, '#9FC2A8'); bench(20.4, -1.15, '#E7A6B6');
      rbox(street, toon(warm('#F6D58E')), 20.05, 0.54, -1.12, 0.42, 0.08, 0.3, 0.035); // вязаная подушка
      put(street, keep(new T.TorusGeometry(0.12, 0.035, 8, 18)), toon(warm('#C2405B', 0.6)), [20.75, 0.53, -1.1], [1, 1, 0.6], [PI / 2, 0, 0.3]); // забытый шарф
      rbox(street, toon(warm('#C2405B', 0.6)), 20.9, 0.4, -1.0, 0.07, 0.24, 0.03, 0.012, [0, 0, 0.2]);
      // гидрант пузатый
      cyl(street, SM.red, 13.2, 0.2, 3.0, 0.13, 0.36); put(street, GEO.hemi, SM.red, [13.2, 0.38, 3.0], [0.13, 0.11, 0.13]);
      rbox(street, SM.red, 13.2, 0.05, 3.0, 0.32, 0.06, 0.32, 0.03); [-1, 1].forEach(s2 => sph(street, SM.red, 13.2 + s2 * 0.13, 0.26, 3.0, 0.06)); cyl(street, SM.red, 13.2, 0.5, 3.0, 0.035, 0.05);
      // тыквы у дверей (оранжевая, кремовая, пудрово-розовая)
      const pumpGeo = keep(new T.SphereGeometry(1, 24, 14));
      { const p = pumpGeo.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x), rib = 0.9 + 0.1 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5); x *= rib; z *= rib; y *= 0.72; if (y > 0.55) y -= (y - 0.55) * 0.6; p.setXYZ(i, x, y, z); } pumpGeo.computeVertexNormals(); }
      const PK = ['#EE9A55', '#F3D2B0', '#EBB3BA'].map(c => toon(warm(c, 0.7))), stemM = toon('#7A8A55');
      function pumpkin(x, z, r, k, y = 0, par = street) {
        put(par, pumpGeo, PK[k], [x, y + r * 0.7, z], [r, r, r], [0, R() * 6, 0]);
        put(par, GEO.cylLo, stemM, [x, y + r * 1.38, z], [0.022 + r * 0.06, r * 0.5, 0.022 + r * 0.06], [0, 0, 0.3]);
        put(par, leafFlat, stemM, [x + r * 0.25, y + r * 1.33, z], [r * 0.6, 1, r * 0.6], [0.4, 0.8, 0]);
      }
      pumpkin(5.32, -1.74, 0.22, 0); pumpkin(5.66, -1.68, 0.14, 2); pumpkin(7.08, -1.74, 0.18, 1);
      pumpkin(17.98, -1.72, 0.2, 0); pumpkin(17.98, -1.72, 0.13, 2, 0.27);
      pumpkin(-1.25, -1.76, 0.18, 0); pumpkin(21.05, -1.72, 0.16, 1);
      // листья настоящей формы: гуще у стен и бордюра, кучи листвы
      for (let i = 0; i < (o.rain ? 36 : 150); i++) {
        const u = R(), z = u < 0.45 ? -1.75 + R() * 0.45 : u < 0.8 ? 3.0 + R() * 0.42 : -1.3 + R() * 4.2, x = -4.5 + R() * 32, s = 0.1 + R() * 0.07;
        put(street, leafFlat, LC[i % 5], [x, 0.009 + i * 0.00012, z], [s, 1, s], [(R() - 0.5) * 0.2, R() * 6.28, 0]).castShadow = false;
      }
      // лужи — капли с бликом (только в дождь)
      PUDDLES = o.rain ? [[2, 1.4, 0.7], [7.5, 0.3, 0.55], [12.6, 2.1, 0.8], [18.2, 0.8, 0.6], [24.5, 1.9, 0.75]] : [[18.2, 0.8, 0.6]];
      const glossM = keep(new T.MeshBasicMaterial({ color: 0xDCE6F2, transparent: true, opacity: 0.6, depthWrite: false }));
      PUDDLES.forEach(([x, z, r], i) => {
        put(street, blobDisc(i + 3), SM.puddle, [x, 0.006, z], [r, 1, r * 0.62]).castShadow = false;
        put(street, blobDisc(i + 9), glossM, [x - r * 0.2, 0.008, z - r * 0.1], [r * 0.35, 1, r * 0.12]).castShadow = false;
      });
      // заборчики и изгороди в просветах между домами, мягкая «тень-контакт» у стен
      const picket = keep(new T.CapsuleGeometry(0.035, 0.5, 3, 8)), fenceM = toon('#FFF6EE');
      const HM = ['#C98A5C', '#C9B26A', '#9DB08E', '#D98C8C'].map(c => toon(warm(c)));
      [[2.15, 4.3], [8.1, 10.85], [12.95, 14.15], [18.25, 20.75], [24.45, 27.2]].forEach(([a, b], gi) => {
        const zF = -2.6;
        for (let x = a + 0.1; x < b - 0.05; x += 0.17) put(street, picket, fenceM, [x, 0.33, zF]);
        [0.2, 0.46].forEach(y => rbox(street, fenceM, (a + b) / 2, y, zF - 0.03, b - a, 0.05, 0.03, 0.012));
        for (let x = a + 0.25; x < b; x += 0.5) put(street, blobGeo, HM[(gi + Math.round(x * 2)) % 4], [x, 0.38, -3.15], [0.36, 0.42, 0.32], [0, x, 0]);
      });
      const [aoCv, aoC] = cnv(4, 64); { const gr = aoC.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(70,45,70,.32)'); gr.addColorStop(1, 'rgba(70,45,70,0)'); aoC.fillStyle = gr; aoC.fillRect(0, 0, 4, 64); }
      const aoM = keep(new T.MeshBasicMaterial({ map: tex(aoCv), transparent: true, depthWrite: false }));
      const aoPlane = (x, z, w, d) => { const m = put(street, GEO.plane, aoM, [x, 0.004, z], [w, d, 1], [-PI / 2, 0, 0]); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 1; };
      Object.keys(B).forEach(k => aoPlane(B[k], -1.66, 4.2, 0.7));
      aoPlane(11.9, -1.75, 2.2, 0.5); aoPlane(9.6, -0.85, 1.6, 0.5);
      // машинки-пузыри у дальнего бордюра
      const carM = { glass: toon('#CFE3F0'), tyre: toon('#4A3F4E'), hub: toon('#FFF6EE'), lamp: keep(new T.MeshBasicMaterial({ color: 0xFFF2C8 })) };
      function car(x, z, col, flip) {
        const g = new T.Group(), m = toon(warm(col));
        rbox(g, m, 0, 0.4, 0, 1.7, 0.46, 0.86, 0.2); rbox(g, m, 0, 0.2, 0, 1.78, 0.14, 0.9, 0.06);
        put(g, GEO.hemi, carM.glass, [-0.08, 0.6, 0], [0.62, 0.42, 0.4]); put(g, GEO.hemi, m, [-0.08, 0.6, 0], [0.64, 0.12, 0.41]);
        [[-0.55, 0.42], [0.55, 0.42], [-0.55, -0.42], [0.55, -0.42]].forEach(([a, b]) => { cyl(g, carM.tyre, a, 0.17, b, 0.17, 0.12, [PI / 2, 0, 0]); cyl(g, carM.hub, a, 0.17, b + Math.sign(b) * 0.065, 0.07, 0.02, [PI / 2, 0, 0]); });
        [-0.24, 0.24].forEach(b => sph(g, carM.lamp, 0.86, 0.44, b, 0.07));
        g.position.set(x, -0.12, z); g.rotation.y = flip ? PI : 0; street.add(g);
        return g;
      }
      car(12.3, 5.35, '#F2B3C2').scale.setScalar(0.88); const mintCar = car(27.2, 5.35, '#A8D8C4', true); mintCar.scale.setScalar(0.88); car(-7.2, 5.35, '#F6D58E').scale.setScalar(0.88);
      { const c1 = car(7.6, 5.35, '#C9B6F0'), c2 = car(18.4, 5.35, '#F7E1B5', true); [c1, c2].forEach(c => c.scale.setScalar(0.88));
        [c1, c2].forEach(cg => [[0.68, 0.15], [0.75, -0.18], [-0.78, 0.05]].forEach(([a, b], k) => put(cg, leafFlat, LC[k], [a, 0.645, b], [0.12, 1, 0.12], [0, R() * 6, 0]).castShadow = false)); }
      // лента листвы в водостоке и на бордюре — низ кадра тоже осенний
      for (let i = 0; i < (o.rain ? 34 : 70); i++) { const gut = i % 7 < 5, z = gut ? 3.72 + R() * 0.45 : 3.43 + R() * 0.22, sc = 0.09 + R() * 0.06;
        put(street, leafFlat, LC[i % 5], [-6 + R() * 35, gut ? -0.108 + i * 0.0001 : 0.086, z], [sc, 1, sc], [(R() - 0.5) * 0.3, R() * 6.28, 0]).castShadow = false; }
      pumpkin(0, 0, 0.13, 0, 0.7, mintCar); pumpkin(0.3, 0.1, 0.1, 2, 0.7, mintCar);
      // меловые рисунки на тротуаре: классики у киоска и сердечко «Пирожок был тут»; в дождь мел смыт
      if (!o.rain) {
        const chalk = (w, h, draw) => { const [cv, c] = cnv(512, Math.round(512 * h / w)); c.lineCap = c.lineJoin = 'round'; draw(c, cv.width, cv.height); return toon('#FFFFFF', { map: tex(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); };
        const decal = (m, x, z, w, h, rz) => { const pl = put(street, GEO.plane, m, [x, 0.005, z], [w, h, 1], [-PI / 2, 0, rz]); pl.castShadow = false; };
        decal(chalk(1.7, 0.55, (c, W2, H2) => { const cl = ['#EE8FA8', '#B48FD8', '#6FBFA0', '#F0A050'], sz = H2 * 0.42; c.lineWidth = 11;
          [[0, 0], [1, 0], [2, -0.5], [2, 0.5], [3, 0], [4, -0.5], [4, 0.5]].forEach(([i, o2], k) => { c.strokeStyle = cl[k % 4]; c.strokeRect(20 + i * sz * 1.05, H2 / 2 - sz / 2 + o2 * sz, sz, sz); text(c, String(k + 1), 20 + i * sz * 1.05 + sz / 2, H2 / 2 + o2 * sz, sz * 0.6, cl[k % 4], { f: 'Caveat', w: 700 }); });
          c.strokeStyle = '#EE8FA8'; c.beginPath(); c.arc(20 + 5 * sz * 1.05 + sz * 0.4, H2 / 2, sz * 0.8, -PI / 2, PI / 2); c.stroke(); }), 10.4, 1.25, 1.7, 0.55, 0.05);
        decal(chalk(1.1, 0.6, c => { c.strokeStyle = '#EE8FA8'; c.lineWidth = 12; c.beginPath(); c.moveTo(90, 180); c.bezierCurveTo(20, 120, 50, 50, 90, 90); c.bezierCurveTo(130, 50, 160, 120, 90, 180); c.stroke();
          text(c, 'Пирожок был тут', 330, 120, 60, '#B0607A', { f: 'Caveat', w: 700, max: 300 }); }), 3.9, 2.3, 1.1, 0.6, -0.08);
      }
      bake(street);
      // кроны не принимают теней от соседних комков: рампа сама рисует терминатор, без тёмных клиньев
      { const CROWN = new Set(TM.flat()); street.children.forEach(m => { if (m.isMesh && CROWN.has(m.material)) m.receiveShadow = false; }); }

      /* --- дальний квартал: пастель, разные крыши, трубы, тёплые окна --- */
      const far = new T.Group(); scene.add(far);
      const FC = ['#E9CFCF', '#D9CCE6', '#EED9C4', '#CFE0D2', '#F0D3DA', '#D8D3EC'].map(c => toon(mixHex(c, '#B8BEC6', fade)));
      const FR = [toon(warm('#C98F86')), toon(warm('#9AA5C5')), toon(warm('#B8907A'))], FW = toon('#8E89A6'), FWlit = keep(new T.MeshBasicMaterial({ color: 0xFFE3A8 }));
      const prism = keep(new T.ExtrudeGeometry(triShape(1, 0.5), { depth: 1, bevelEnabled: false })); prism.translate(0, 0, -0.5);
      const arcWin = keep(new T.ShapeGeometry(archShape(0.36, 0.5), 8)); arcWin.translate(0, -0.25, 0);
      const rndWin = keep(new T.CircleGeometry(0.2, 16)), RWIN = rng(4242);
      for (let i = 0; i < 15; i++) {
        const x = -14 + i * 3.4 + R() * 0.8, z = -11 - (i % 3) * 2.6 - R() * 1.2, w = 2.3 + R() * 0.9, h = 3.2 + R() * 3.2;
        rbox(far, FC[i % FC.length], x, h / 2, z, w, h, 2.4, 0.16);
        if (i % 2 === 0) put(far, prism, FR[i % 3], [x, h, z], [w + 0.4, 1.6, 2.7]);
        else put(far, GEO.halfCyl, FR[i % 3], [x, h, z], [0.8, 2.6, w / 2 + 0.12], [0, PI / 2, PI / 2]);
        if (i % 4 === 1) rbox(far, FR[(i + 1) % 3], x + w * 0.25, h + 0.9, z - 0.4, 0.3, 0.9, 0.3, 0.05);
        for (let r = 0; r < Math.floor(h / 1.2); r++) for (let c = 0; c < 2; c++) {
          const wm = put(far, r === 0 && i % 2 ? rndWin : arcWin, RWIN() < [0.32, 0.22, 0.22, 0.34][LI] ? FWlit : FW, [x - w / 4 + c * w / 2, 0.9 + r * 1.15, z + 1.21]); wm.castShadow = false;
        }
      }
      bake(far, null, { receive: false });

      /* --- мягкие холмы на горизонте: ближний пологий с рощицей и дальние «мармеладки» --- */
      const kub = new T.Group(); scene.add(kub);
      const HLM = [toon('#B7AEC8'), toon('#ABA4C2'), toon('#BFB6CE'), toon('#B2ACC8')];
      const hillPts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; hillPts.push(new T.Vector2(Math.max(0.001, Math.pow(Math.cos(t * PI / 2), 0.75)), t)); }
      const hillGeo = keep(new T.LatheGeometry(hillPts, 28));
      const NEAR = [17, -50, 24, 9, 15];   // x, z, радиус по x, высота, радиус по z
      put(kub, hillGeo, HLM[0], [NEAR[0], -1, NEAR[1]], [NEAR[2], NEAR[3], NEAR[4]]);
      const onNear = (x, z) => { const d = Math.hypot((x - NEAR[0]) / NEAR[2], (z - NEAR[1]) / NEAR[4]); return d >= 1 ? -1 : -1 + NEAR[3] * (2 / PI) * Math.acos(Math.pow(d, 1 / 0.75)); };
      for (let i = 0; i < 7; i++) { const x = 7 + i * 3.6 + R() * 1.4, z = -38 - R() * 5; pine(kub, x, onNear(x, z) - 0.2, z, 1.3 + R() * 0.5, i % 3 === 1); }
      [[-24, -72, 26, 10], [2, -78, 30, 12], [36, -74, 28, 10.5], [58, -80, 28, 11.5], [12, -66, 18, 7.5], [46, -62, 17, 6.5], [-8, -60, 17, 6]].forEach(([x, z, r, h], i) => {
        put(kub, hillGeo, HLM[(i + 1) % 4], [x, -1, z], [r, h, r * 0.75]);
      });
      bake(kub, null, { cast: false, receive: false });

      /* --- облака-«пуфы» с плоским низом --- */
      clouds = [];
      const CLC = [['#C8CBD8', '#8F93AA', 0.22], ['#ECE8F2', '#D8D2E6', 0.20], ['#FBF0F4', '#F3D9E4', 0.22], ['#FFEFEA', '#F6C9C9', 0.26]][LI];
      const cloudM = addRim(toon(CLC[0], { emissive: new T.Color(CLC[1]), emissiveIntensity: CLC[2] }), 1.3);
      const puff = keep(new T.SphereGeometry(1, 18, 12)); { const p = puff.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.3); puff.computeVertexNormals(); }
      [[-14, 12.5, -46, 1.3], [5, 14, -58, 1.6], [20, 11.5, -44, 1.1], [33, 13.5, -55, 1.5], [47, 12, -48, 1.2], [-28, 13.5, -60, 1.4]].forEach(([x, y, z, s]) => {
        const cg = new T.Group(); cg.position.set(x, y, z);
        [[0, 0.35, 0, 1.5], [1.4, 0.15, 0.2, 1.1], [-1.4, 0.1, 0.1, 1.05], [0.55, 0.85, -0.2, 0.95], [-0.6, 0.7, 0, 0.85]].forEach(([a, b, c, r]) => put(cg, puff, cloudM, [a * s, b * s, c * s], [r * s, r * s * 0.8, r * s * 0.9]));
        put(cg, puff, cloudM, [0, 0, 0], [2.6 * s, 0.55 * s, 1.3 * s]);
        scene.add(cg); bake(cg, null, { cast: false, receive: false }); clouds.push({ g: cg, v: 0.18 + s * 0.08 });
      });

      /* --- дома --- */
      function buildCinema(K) {
        const g = new T.Group(), W = 3.7, H = 4.4, D = 3.2;
        const red = K.m('#B9475F'), redD = K.m('#9E2F47'), cream = K.m('#FFF0CE'), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.55 }),
          dark = K.m('#2F2834'), wine = K.m('#73304A'), glass = K.m('#FFE4B0', { glow: '#FFC870', gi: 0.45 }), rope = K.m('#8E2340');
        const bulbA = K.m('#FFE7A0', { glow: '#FFC94A', gi: 0.9, id: 'A' }), bulbB = K.m('#FFE7A0', { glow: '#FFC94A', gi: 0.9, id: 'B' });
        rbox(g, red, 0, H / 2, -D / 2, W, H, D, 0.14);
        rbox(g, redD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
        cornice(g, redD, H, W, D);
        // круглые башенки с куполками по углам — силуэт игрушечного театра
        [-1, 1].forEach(sd => {
          const x = sd * 1.98, z = -0.1, R0 = 0.27, TH = H + 0.6;
          cyl(g, red, x, TH / 2, z, R0, TH);
          [0.36, 1.6, 2.9, H + 0.45].forEach(y => cyl(g, cream, x, y, z, R0 + 0.018, 0.07));
          put(g, GEO.hemi, redD, [x, TH, z], [R0 + 0.03, 0.42, R0 + 0.03]);
          cyl(g, gold, x, TH + 0.5, z, 0.012, 0.16); sphS(g, gold, x, TH + 0.63, z, 0.06);
          cyl(g, glass, x, 3.55, z + R0 - 0.005, 0.09, 0.03, [PI / 2, 0, 0]); put(g, ringG(0.1, 0.02), cream, [x, 3.55, z + R0 + 0.01]);
        });
        // корона-полукруг с солнцем — его и ищем всю серию
        const ped = keep(new T.ExtrudeGeometry(archShape(2.4, 1.2), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 })); smoothCrease(ped, 50);
        put(g, ped, redD, [0, H + 0.36, -0.42]);
        put(g, extrude(archShape(1.96, 0.98), 0.03), cream, [0, H + 0.4, -0.03]);
        for (let i = 0; i <= 12; i++) { const a = PI * i / 12; sphS(g, i % 2 ? bulbA : bulbB, Math.cos(a) * 1.09, H + 0.38 + Math.sin(a) * 1.09, 0.03, 0.05); }
        cyl(g, gold, 0, H + 0.84, 0.02, 0.2, 0.05, [PI / 2, 0, 0]);
        put(g, ringG(0.2, 0.025), gold, [0, H + 0.84, 0.05]);
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; rbox(g, gold, Math.cos(a) * 0.31, H + 0.84 + Math.sin(a) * 0.31, 0.03, 0.13, 0.045, 0.035, 0.015, [0, 0, a]); }
        lace(g, cream, -1.68, 1.68, H - 0.02, 0.1, 0.09, redD);
        ivy(g, K, W, H, 1, 13, 44, ['#E9A94B', '#E07A45', '#F0C05A', '#C8613F'], [[-1.55, 0.9], [-2.75, 0.8]], false);
        // вывеска с лампочками
        const sy = 3.3;
        rbox(g, cream, 0, sy, 0.14, 3.3, 1.12, 0.26, 0.11);
        plane(g, K.t(SIGN.cinema), 0, sy, 0.272, 3.14, 1.03);
        for (let i = 0; i < 14; i++) { const x = -1.56 + i * 0.24; [sy + 0.6, sy - 0.6].forEach(y => sphS(g, i % 2 ? bulbA : bulbB, x, y, 0.2, 0.048)); }
        [-1, 1].forEach(s => { for (let j = 0; j < 4; j++) sphS(g, j % 2 ? bulbA : bulbB, s * 1.72, sy - 0.36 + j * 0.24, 0.2, 0.048); });
        // козырёк «КАССА»
        rbox(g, redD, 0, 2.28, 0.46, 1.3, 0.34, 0.92, 0.08);
        plane(g, K.t(SIGN.kassa), 0, 2.28, 0.925, 0.9, 0.24);
        box(g, gold, 0, 2.11, 0.93, 1.3, 0.03, 0.03); box(g, gold, 0, 2.45, 0.93, 1.3, 0.03, 0.03);
        [-0.45, 0, 0.45].forEach(x => sphS(g, bulbA, x, 2.08, 0.62, 0.045));
        const swg = [K.m('#D9774F'), K.m('#E8A84F'), K.m('#E7A3A0')];
        for (let i = 0; i <= 10; i++) put(g, GEO.sphLo, swg[i % 3], [-0.6 + i * 0.12, 2.06 - 0.09 * Math.sin(PI * i / 10), 0.95], [0.06, 0.042, 0.028], [0, 0, i * 0.9]);
        // двери (створки открываются)
        box(g, dark, 0, 0.88, 0.02, 1.22, 1.76, 0.04);
        box(g, redD, 0, 1.82, 0.06, 1.34, 0.1, 0.12);
        const doors = [];
        [-1, 1].forEach(s => {
          const p = new T.Group(); p.position.set(s * 0.56, 0, 0.06); p.userData.dyn = true; g.add(p);
          box(p, wine, -s * 0.275, 0.84, 0.03, 0.53, 1.68, 0.06);
          cyl(p, glass, -s * 0.275, 1.24, 0.07, 0.13, 0.03, [PI / 2, 0, 0]);
          const wr = wreath(K, 0.17, '#E8879E'); wr.position.set(-s * 0.275, 1.24, 0.075); p.add(wr);
          box(p, gold, -s * 0.07, 0.82, 0.08, 0.03, 0.26, 0.03);
          doors.push({ p, open: s * 1.35 });
        });
        // афиши
        [[-1.12, SIGN.poster1], [1.12, SIGN.poster2]].forEach(([x, cv]) => {
          rbox(g, dark, x, 1.98, 0.05, 0.98, 1.34, 0.1, 0.045);
          plane(g, K.t(cv), x, 1.98, 0.102, 0.82, 1.18);
          box(g, gold, x, 2.72, 0.12, 0.5, 0.06, 0.14);
        });
        // бархатные канаты
        [-1, 1].forEach(s => {
          [0.85, 1.55].forEach(x => { cyl(g, gold, s * x, 0.36, 0.42, 0.03, 0.72); sph(g, gold, s * x, 0.75, 0.42, 0.05); cyl(g, gold, s * x, 0.02, 0.42, 0.09, 0.04); });
          const c = new T.QuadraticBezierCurve3(new T.Vector3(s * 0.85, 0.7, 0.42), new T.Vector3(s * 1.2, 0.46, 0.42), new T.Vector3(s * 1.55, 0.7, 0.42));
          put(g, keep(new T.TubeGeometry(c, 12, 0.022, 6)), rope);
        });
        return { g, doors, bulbs: [bulbA, bulbB] };
      }
      function buildBureau(K) {
        const g = new T.Group(), W = 3.7, H = 4.6, D = 3.2;
        const blue = K.m('#8FB3D9'), blueD = K.m('#6F93BC'), cream = K.m('#FFFDF9'), navy = K.m('#2F3A5A'), mint = K.m('#BFE6D3'),
          glass = K.m('#E9F1F9', { glow: '#FFE7BC', gi: 0.35 }), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }), wood = K.m('#B98C6A'), green = K.m('#7FB07A'), pipe = K.m('#7E8B99');
        const books = ['#F08FA8', '#8FB3D9', '#F7B267', '#BFE6D3', '#B9A5E8', '#C2405B'].map(c => K.m(c));
        const flowers = [K.m('#EFA3B5'), K.m('#F3CF73'), K.m('#D9774F')];
        rbox(g, blue, 0, H / 2, -D / 2, W, H, D, 0.14);
        rbox(g, blueD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
        cornice(g, cream, H, W, D);
        for (let i = 0; i < 15; i++) { put(g, GEO.halfDisc, cream, [-1.68 + i * 0.24, H - 0.02, 0.09], [0.12, 0.04, 0.12], [PI / 2, 0, 0]); sph(g, cream, -1.56 + i * 0.24, H - 0.1, 0.1, 0.025); }
        const slate = K.m('#6F8DB8');
        { const ms = new T.Shape(), bw = W / 2 + 0.2, tw = W / 2 - 0.35, mh = 0.95, rc = 0.18;
          ms.moveTo(-bw, 0); ms.lineTo(bw, 0); ms.lineTo(tw + rc * 0.4, mh - rc); ms.quadraticCurveTo(tw, mh, tw - rc, mh); ms.lineTo(-tw + rc, mh); ms.quadraticCurveTo(-tw, mh, -tw - rc * 0.4, mh - rc); ms.closePath();
          const mg = keep(new T.ExtrudeGeometry(ms, { depth: D + 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 8 })); smoothCrease(mg, 50);
          put(g, mg, slate, [0, H + 0.38, -D - 0.1]); }
        [-0.8, 0.8].forEach(x => {
          rbox(g, cream, x, H + 0.8, -0.3, 0.62, 0.6, 0.5, 0.08);
          put(g, GEO.halfCyl, slate, [x, H + 1.1, -0.3], [0.36, 0.56, 0.36], [0, PI / 2, PI / 2]);
          windowF(g, cream, glass, x, H + 0.8, 0.28, 0.32, { arch: true, sill: false });
        });
        cyl(g, pipe, W / 2 - 0.08, H / 2, 0.08, 0.05, H);
        ivy(g, K, W, H, 1, 11, 60, IVY, [[-2.2, 0.8], [-2.95, 0.95]], true);
        rbox(g, cream, 0, 3.72, 0.1, 3.4, 0.95, 0.2, 0.09);
        plane(g, K.t(SIGN.bureau), 0, 3.72, 0.202, 3.3, 0.88);
        bow(g, K.m('#F08FA8'), 1.55, 4.15, 0.24, 0.3);
        rbox(g, navy, 0, 3.0, 0.06, 1.66, 0.36, 0.12, 0.055);
        plane(g, K.t(SIGN.bureauSmall), 0, 3.0, 0.122, 1.56, 0.32);
        // глобус на кронштейне — крутится
        cyl(g, navy, -1.25, 3.72, 0.27, 0.03, 0.16, [PI / 2, 0, 0]);
        const globe = new T.Group(); globe.position.set(-1.25, 3.72, 0.62); globe.userData.dyn = true; g.add(globe);
        const spin = new T.Group(); spin.rotation.z = 0.35; globe.add(spin);
        sph(spin, mint, 0, 0, 0, 0.3);
        const ring = keep(new T.TorusGeometry(0.31, 0.014, 6, 32));
        put(spin, ring, navy, [0, 0, 0], null, [PI / 2, 0, 0]); put(spin, ring, navy); put(spin, ring, navy, [0, 0, 0], null, [0, PI / 2, 0]);
        [[0.1, 0.12, 0.25], [-0.15, -0.05, 0.24], [0.05, -0.18, -0.22], [-0.2, 0.15, -0.15], [0.24, -0.04, -0.12]].forEach(([x, y, z]) => sph(spin, green, x * 0.95, y * 0.95, z * 0.95, 0.1, 0.075, 0.07));
        bake(spin, null, { cast: false });
        // витрины с книгами
        [-1.08, 1.08].forEach((x, wi) => {
          windowF(g, cream, glass, x, 1.82, 1.0, 1.3, { arch: true });
          [1.42, 1.98].forEach((y, si) => {
            box(g, cream, x, y, 0.1, 0.96, 0.035, 0.16);
            for (let i = 0; i < 8; i++) { const h = 0.26 + ((i + si + wi) % 3) * 0.05; box(g, books[(i + si * 2 + wi) % 6], x - 0.4 + i * 0.105, y + 0.0175 + h / 2, 0.1, 0.08, h, 0.13, [0, 0, i === 7 ? -0.2 : 0]); }
          });
          flowerBox(g, wood, green, flowers, x, 0.92, 1.0);
        });
        // арочная дверь
        const dw = 0.96, dh = 1.8;
        put(g, extrude(archShape(dw + 0.2, dh + 0.1), 0.06), cream);
        const p = new T.Group(); p.position.set(-dw / 2, 0, 0.06); p.userData.dyn = true; g.add(p);
        put(p, extrude(archShape(dw, dh, dw / 2), 0.07), navy);
        put(p, extrude(archShape(0.56, 0.6, dw / 2), 0.02), glass, [0, 1.06, 0.07]);
        sph(p, gold, dw - 0.13, 0.9, 0.1, 0.035);
        const wr = wreath(K, 0.2, '#E8879E'); wr.position.set(dw / 2, 1.36, 0.115); p.add(wr);
        box(p, cream, dw / 2, 0.72, 0.075, 0.52, 0.17, 0.01);
        plane(p, K.t(SIGN.open), dw / 2, 0.72, 0.081, 0.5, 0.156);
        return { g, doors: [{ p, open: -1.35 }], globe: spin };
      }
      function buildSweets(K) {
        const g = new T.Group(), W = 3.7, H = 4.5, D = 3.2;
        const pink = K.m('#F6C6D0'), pinkD = K.m('#E7A6B6'), cream = K.m('#FFFDF9'), cherry = K.m('#C2405B'), stripe = K.m('#F08FA8'),
          glass = K.m('#FFF3F5', { glow: '#FFE0CC', gi: 0.35 }), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }), caramel = K.m('#E7B47C'),
          lav = K.m('#C9B6F0'), mint = K.m('#BFE6D3'), stem = K.m('#5E7A4A');
        rbox(g, pink, 0, H / 2, -D / 2, W, H, D, 0.14);
        rbox(g, pinkD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
        cornice(g, cream, H, W, D);
        const DRP = [0.05, 0.1, 0.15, 0.2, 0.25].map(L => keep(new T.CapsuleGeometry(0.075, L, 4, 10)));
        for (let i = 0; i < 16; i++) { const k = (i * 7) % 5, L = 0.05 + k * 0.05; put(g, DRP[k], cream, [-1.8 + i * 0.24, H + 0.04 - (L / 2 + 0.075), 0.11], [1, 1, 0.8]); }
        rbox(g, pinkD, -1.25, H + 0.35, -2.4, 0.34, 0.7, 0.34, 0.05); rbox(g, cream, -1.25, H + 0.74, -2.4, 0.44, 0.08, 0.44, 0.03);
        // торт на крыше
        const cx = 0.55, cz = -1.5;
        cyl(g, stripe, cx, H + 0.62, cz, 0.75, 0.5); cyl(g, cream, cx, H + 0.89, cz, 0.78, 0.06);
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; sph(g, cream, cx + Math.cos(a) * 0.75, H + 0.81, cz + Math.sin(a) * 0.75, 0.07, 0.11, 0.07); }
        cyl(g, cream, cx, H + 1.13, cz, 0.52, 0.42); cyl(g, stripe, cx, H + 1.36, cz, 0.55, 0.05);
        sph(g, cherry, cx, H + 1.53, cz, 0.14); cyl(g, stem, cx + 0.04, H + 1.71, cz, 0.012, 0.16, [0, 0, -0.4]);
        bow(g, cherry, cx, H + 0.65, cz + 0.78, 0.38);
        // вывеска-пилюля
        put(g, keep(new T.CapsuleGeometry(0.46, 2.2, 6, 20)), cream, [0, 3.72, 0.14], [1, 1, 0.3], [0, 0, PI / 2]);
        plane(g, K.t(SIGN.sweets, { alpha: true }), 0, 3.72, 0.285, 2.7, 0.9);
        // полосатая маркиза
        rbox(g, cherry, 0, 2.98, 0.1, 3.86, 0.14, 0.2, 0.06);
        const awG = keep(new T.CylinderGeometry(1, 1, 0.37, 10, 1, false, 0, PI / 2));
        for (let i = 0; i < 10; i++) {
          const x = -1.665 + i * 0.37, m = i % 2 ? cream : stripe;
          put(g, awG, m, [x, 2.45, 0.08], [0.53, 1, 0.86], [0, 0, PI / 2]);
          put(g, GEO.halfDisc, m, [x, 2.45, 0.94], [0.185, 0.03, 0.185], [PI / 2, 0, 0]);
        }
        // витрина со сладостями
        const vit = K.m('#E2B6C0', { glow: '#FFBFA0', gi: 0.18 });
        windowF(g, cream, vit, -0.69, 1.3, 1.9, 1.3, { sill: false });
        curtains(g, stripe, -0.69, 1.3, 1.9, 1.3);
        plane(g, K.t(SIGN.sweetsWin, { alpha: true }), -0.69, 1.76, 0.066, 0.78, 0.125);
        box(g, cream, -0.69, 0.62, 0.15, 2.04, 0.08, 0.3);
        // этажерка с капкейками
        { const cs = -0.6; cyl(g, gold, cs, 1.11, 0.2, 0.014, 0.9);
          [[1.0, 0.27], [1.25, 0.2], [1.46, 0.13]].forEach(([y, r], t) => { put(g, GEO.cyl, cream, [cs, y, 0.2], [r, 0.025, r * 0.55]);
            for (let j = 0; j < 3 - t; j++) { const x = cs + (j - (2 - t) / 2) * r * 0.62;
              cyl(g, [stripe, mint, lav][j % 3], x, y + 0.05, 0.21, 0.042, 0.07); sphS(g, cream, x, y + 0.1, 0.21, 0.048, 0.034, 0.048); sphS(g, cherry, x, y + 0.14, 0.21, 0.016); } }); }
        put(g, GEO.hemi, stripe, [-1.35, 0.66, 0.16], [0.2, 0.2, 0.2]); sph(g, cherry, -1.35, 0.89, 0.16, 0.05); cyl(g, cream, -1.35, 0.67, 0.16, 0.22, 0.02);
        cyl(g, caramel, -0.85, 0.73, 0.16, 0.19, 0.14); cyl(g, cream, -0.85, 0.82, 0.16, 0.19, 0.04);
        box(g, lav, -0.35, 0.77, 0.16, 0.3, 0.22, 0.24); box(g, cream, -0.35, 0.89, 0.16, 0.3, 0.04, 0.24);
        [stripe, mint, lav].forEach((m, i) => { cyl(g, m, 0.05, 0.69 + i * 0.065, 0.16, 0.085, 0.04); cyl(g, cream, 0.05, 0.715 + i * 0.065, 0.16, 0.075, 0.015); });
        // вишнёвая дверь с круглым окошком и колокольчик
        const dx = 1.05, dw = 0.98, dh = 2.0;
        put(g, extrude(archShape(dw + 0.18, dh + 0.09, dx), 0.05), cream);
        const p = new T.Group(); p.position.set(dx - dw / 2, 0, 0.05); p.userData.dyn = true; g.add(p);
        put(p, extrude(archShape(dw, dh, dw / 2), 0.07), cherry);
        cyl(p, vit, dw / 2, 1.5, 0.08, 0.24, 0.03, [PI / 2, 0, 0]);
        const wr = wreath(K, 0.29, '#FFFDF9'); wr.position.set(dw / 2, 1.5, 0.11); p.add(wr);
        sph(p, gold, dw - 0.14, 0.95, 0.1, 0.035);
        box(g, gold, dx, 2.36, 0.1, 0.02, 0.02, 0.2);
        put(g, GEO.cone, gold, [dx, 2.27, 0.2], [0.06, 0.1, 0.06]); sph(g, gold, dx, 2.21, 0.2, 0.02);
        sconce(g, K, 1.74, 1.95);
        return { g, doors: [{ p, open: -1.35 }] };
      }
      function buildRoof(K) {
        const g = new T.Group(), W = 3.7, H = 5.1, D = 3.2;
        const wall = K.m('#A3AEBB'), wallD = K.m('#8A95A3'), frame = K.m('#F2F5F8'), glass = K.m('#DDE6F0', { glow: '#FFE6B0', gi: 0.38 }),
          metal = K.m('#4F5966'), metalL = K.m('#6C7682'), doorM = K.m('#5C6673'), cream = K.m('#FFFDF9'), gold = K.m('#FFD45E', { glow: '#FFB938', gi: 0.4 }),
          pot = K.m('#C96F4A'), green = K.m('#7FB07A'), pinkF = K.m('#F08FA8'), pin = K.m('#C2405B'), vent = K.m('#C9D1DA'), cup = K.m('#FFFFFF'), tea = K.m('#B5774A');
        rbox(g, wall, 0, H / 2, -D / 2, W, H, D, 0.14);
        rbox(g, wallD, 0, 0.17, -D / 2 + 0.03, W + 0.1, 0.34, D + 0.06, 0.1);
        cornice(g, wallD, H, W, D);
        cyl(g, metalL, -W / 2 + 0.08, H / 2, 0.08, 0.05, H);
        cyl(g, metalL, -0.9, H + 0.8, -1.3, 0.03, 1.2);
        [0.35, 0.6].forEach((yy, i) => cyl(g, metalL, -0.9, H + 0.6 + yy, -1.3, 0.02, 0.6 - i * 0.2, [0, 0, PI / 2]));
        { const tx = 0.95, tz = -2.2, ty = H + 0.38, tank = K.m('#C98F6B'), hat = K.m('#D9776B');
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, metal, tx + a * 0.24, ty + 0.3, tz + b * 0.24, 0.035, 0.6));
          cyl(g, tank, tx, ty + 0.9, tz, 0.38, 0.62);
          [0.72, 1.08].forEach(y => put(g, keep(new T.TorusGeometry(0.385, 0.022, 6, 24)), metal, [tx, ty + y, tz], null, [PI / 2, 0, 0]));
          put(g, GEO.cone, hat, [tx, ty + 1.41, tz], [0.47, 0.4, 0.47]); sph(g, gold, tx, ty + 1.66, tz, 0.06); }
        rbox(g, wallD, -1.35, H + 0.75, -2.4, 0.34, 0.8, 0.34, 0.06); rbox(g, metal, -1.35, H + 1.18, -2.4, 0.42, 0.08, 0.42, 0.03);
        // окна 2×4, на некоторых — цветы
        const shutP = K.m('#E7A6B6'), shutM = K.m('#BFE6D3'), curtP = K.m('#F7C9D3'), mumR = K.m('#D9774F'), mumY = K.m('#F3CF73');
        ivy(g, K, W, H, 1, 12, 44, IVY, [[-1.5, 0.6], [-2.7, 0.75]], false);
        [-1.23, -0.31].forEach((x, c) => [4.32, 3.32, 2.32, 1.32].forEach((y, r) => {
          windowF(g, frame, glass, x, y, 0.6, 0.7, r === 0 ? { arch: true } : { cross: true, shut: (c === 0 && r === 1) ? shutP : (c === 1 && r === 3) ? shutM : null });
          if (r > 0) curtains(g, (r + c) % 2 ? curtP : cream, x, y, 0.6, 0.7); else curtains(g, cream, x, y - 0.05, 0.6, 0.6, false);
          if (r > 0 && (r + c) % 2 === 0) flowerBox(g, pot, green, [mumR, mumY, pinkF], x, y - 0.365, 0.52);
        }));
        // пожарная лестница: первого пролёта нет
        const fx = 0.95, fw = 1.3, PL = [2.25, 3.2, 4.15];
        PL.forEach(y => {
          box(g, metal, fx, y, 0.33, fw, 0.05, 0.62);
          box(g, metal, fx, y + 0.45, 0.63, fw, 0.035, 0.035);
          box(g, metal, fx, y + 0.22, 0.63, fw, 0.02, 0.02);
          [-1, -0.33, 0.33, 1].forEach(t => box(g, metal, fx + t * fw / 2, y + 0.225, 0.63, 0.03, 0.45, 0.03));
          [-1, 1].forEach(s => box(g, metal, fx + s * fw / 2, y + 0.45, 0.33, 0.03, 0.03, 0.62));
        });
        for (let f = 1; f < PL.length; f++) {
          const y0 = PL[f - 1] + 0.025, y1 = PL[f], dir = f % 2 ? 1 : -1, x0 = fx - dir * 0.45, x1 = fx + dir * 0.45;
          const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
          [0.14, 0.5].forEach(z => box(g, metal, (x0 + x1) / 2, (y0 + y1) / 2, z, len, 0.05, 0.025, [0, 0, ang]));
          for (let s = 1; s < 7; s++) { const t = s / 7; box(g, metalL, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.32, 0.12, 0.025, 0.36); }
        }
        [0.14, 0.5].forEach(z => box(g, metal, fx - 0.5, PL[0] - 0.16, z, 0.4, 0.05, 0.025, [0, 0, 0.95]));
        box(g, metal, fx + 0.55, 0.12, 0.3, 0.34, 0.05, 0.025, [0, 0, 0.7]);
        const sg = new T.Group(); sg.position.set(fx - 0.33, PL[0] - 0.36, 0.62); sg.rotation.z = -0.07; g.add(sg);
        box(sg, cream, 0, 0, 0, 0.8, 0.33, 0.03); plane(sg, K.t(SIGN.stairs), 0, 0, 0.016, 0.78, 0.32);
        [-0.28, 0.28].forEach(x => cyl(sg, metalL, x, 0.27, 0, 0.008, 0.22));
        // кто-то проветривает ковёр
        box(g, K.m('#8E2B40'), fx + 0.15, PL[1] + 0.2, 0.66, 0.62, 0.5, 0.02);
        plane(g, K.t(SIGN.carpet), fx + 0.15, PL[1] + 0.2, 0.672, 0.6, 0.48);
        // дверь «ВЫХОД НА КРЫШУ» с запиской
        const dx = 1.1, dw = 0.94, dh = 1.6;
        box(g, metal, dx, dh / 2 + 0.03, 0.015, dw + 0.14, dh + 0.1, 0.03);
        const p = new T.Group(); p.position.set(dx - dw / 2, 0, 0.03); p.userData.dyn = true; g.add(p);
        box(p, doorM, dw / 2, dh / 2, 0.03, dw, dh, 0.06);
        box(p, cream, dw / 2, 1.32, 0.065, 0.66, 0.26, 0.01); plane(p, K.t(SIGN.exit), dw / 2, 1.32, 0.071, 0.64, 0.25);
        sph(p, gold, dw - 0.12, 0.82, 0.08, 0.035);
        box(p, cream, dw / 2, 0.98, 0.065, 0.24, 0.19, 0.008, [0, 0, 0.07]); plane(p, K.t(SIGN.note), dw / 2, 0.98, 0.07, 0.23, 0.18, 0.07);
        sph(p, pin, dw / 2, 1.07, 0.075, 0.018);
        // чашка чая у двери
        cyl(g, cup, dx + 0.72, 0.008, 0.3, 0.1, 0.015); cyl(g, cup, dx + 0.72, 0.055, 0.3, 0.065, 0.08); cyl(g, tea, dx + 0.72, 0.094, 0.3, 0.058, 0.006);
        put(g, keep(new T.TorusGeometry(0.03, 0.01, 6, 12)), cup, [dx + 0.79, 0.06, 0.3]);
        rbox(g, vent, -0.77, 0.4, 0.06, 1.3, 0.62, 0.12, 0.05);
        for (let i = 0; i < 5; i++) box(g, wallD, -0.77, 0.18 + i * 0.11, 0.13, 1.2, 0.03, 0.03);
        sconce(g, K, 1.78, 1.75);
        return { g, doors: [{ p, open: -1.35 }] };
      }
      function buildSilver(K) {
        const g = new T.Group(), W = 1.93, H = 2.52, D = 1.7;
        const brown = K.m('#8E7C6E'), brownD = K.m('#6F5F54'), cream = K.m('#F4EFE6'), silver = K.m('#DCE0E8', { glow: '#FFFFFF', gi: 0.18 }),
          doorM = K.m('#5E4E44'), glass = K.m('#E7E2D8', { glow: '#FFF1D6', gi: 0.3 }), gold = K.m('#E8D9A8', { glow: '#FFE7A0', gi: 0.3 });
        rbox(g, brown, 0, H / 2, -D / 2, W, H, D, 0.14);
        rbox(g, brownD, 0, 0.15, -D / 2 + 0.03, W + 0.1, 0.3, D + 0.06, 0.08);
        put(g, extrude(triShape(2.3, 0.62), D + 0.2), brownD, [0, H, -D - 0.1]);
        rbox(g, cream, 0, 2.18, 0.03, 1.56, 0.32, 0.06, 0.028); plane(g, K.t(SIGN.silver), 0, 2.18, 0.062, 1.52, 0.3);
        windowF(g, cream, glass, -0.3, 1.25, 0.9, 0.95, { sill: false });
        box(g, cream, -0.3, 0.74, 0.12, 1.02, 0.05, 0.24);
        // в витрине: часы-домик с маятником и пара карманных часов на подставке
        const ck = new T.Group(); ck.position.set(-0.52, 0.765, 0.14); g.add(ck);
        rbox(ck, brownD, 0, 0.17, 0, 0.2, 0.34, 0.1, 0.02); put(ck, extrude(triShape(0.26, 0.09), 0.11), brownD, [0, 0.34, -0.055]);
        cyl(ck, cream, 0, 0.25, 0.052, 0.07, 0.008, [PI / 2, 0, 0]);
        box(ck, doorM, 0, 0.27, 0.058, 0.006, 0.05, 0.004); box(ck, doorM, 0.015, 0.25, 0.058, 0.035, 0.006, 0.004);
        cyl(ck, gold, 0, 0.1, 0.052, 0.003, 0.1); sph(ck, gold, 0, 0.05, 0.055, 0.022, 0.022, 0.008);
        const pw = keep(new T.TorusGeometry(0.06, 0.012, 8, 22));
        [[-0.13, 0.835, 0.13, 0.2], [-0.02, 0.81, 0.13, -0.15]].forEach(([x, y, z, r]) => {
          put(g, pw, silver, [x, y, z], null, [0, 0, r]); cyl(g, cream, x, y, z, 0.055, 0.01, [PI / 2, 0, 0]);
          box(g, doorM, x, y + 0.015, z + 0.007, 0.005, 0.03, 0.003); sph(g, silver, x - Math.sin(r) * 0.075, y + Math.cos(r) * 0.075, z, 0.012);
        });
        box(g, brownD, 0.57, 0.8, 0.02, 0.74, 1.62, 0.04); box(g, doorM, 0.57, 0.775, 0.05, 0.62, 1.55, 0.06); sph(g, gold, 0.78, 0.8, 0.09, 0.03);
        ivy(g, K, W, H, 1, 14, 36, IVY, [[-0.5, 0.9], [-1.25, 0.7]], false);
        return { g };
      }
      function buildKiosk(K) {
        const g = new T.Group(), W = 1.3, D = 1.1;
        const green = K.m('#7FB59A'), greenD = K.m('#5E9A7E'), cream = K.m('#FFFDF9'), paper = K.m('#F2EEE6'), inside = K.m('#3F6B57');
        const mags = [K.m('#F08FA8'), K.m('#8FB3D9'), K.m('#F7B267')];
        rbox(g, green, 0, 0.28, -D / 2, W, 0.56, D, 0.08);
        box(g, cream, 0, 0.585, 0.06, W + 0.08, 0.05, 0.32);
        box(g, inside, 0, 0.88, -0.6, W - 0.16, 0.6, 0.04);
        [-1, 1].forEach(s => box(g, greenD, s * (W / 2 - 0.05), 0.88, -D / 2, 0.1, 0.62, D));
        rbox(g, green, 0, 1.31, -D / 2, W, 0.26, D, 0.06);
        plane(g, K.t(SIGN.gazety, { alpha: true }), 0, 1.31, 0.002, 1.05, 0.23);
        put(g, GEO.halfCyl, greenD, [0, 1.44, -D / 2], [0.38, W + 0.16, 0.66], [0, 0, PI / 2]);
        [-0.38, -0.05, 0.3].forEach((x, i) => { for (let j = 0; j < 3 + (i % 2); j++) box(g, paper, x, 0.625 + j * 0.03, 0.08, 0.3, 0.025, 0.22, [0, j % 2 ? 0.08 : -0.06, 0]); });
        mags.forEach((m, i) => box(g, m, -0.4 + i * 0.4, 0.9, -0.52, 0.26, 0.34, 0.02, [-0.1, 0, 0]));
        [-0.3, 0.3].forEach(x => box(g, paper, x, 1.0, -0.2, 0.3, 0.36, 0.01));
        const crate = (wood, woodD, ap, leaf, x, y, z, ry) => {
          const c = new T.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
          rbox(c, wood, 0, 0.13, 0, 0.5, 0.26, 0.34, 0.03); [0.06, 0.19].forEach(yy => box(c, woodD, 0, yy, 0.172, 0.52, 0.035, 0.01));
          for (let i = 0; i < 8; i++) put(c, GEO.sphLo, ap[i % ap.length], [-0.17 + (i % 4) * 0.115, 0.27, -0.07 + (i >> 2) * 0.14], [0.058, 0.055, 0.058]);
          put(c, GEO.sphLo, leaf, [0.1, 0.33, 0.05], [0.03, 0.008, 0.018]);
        };
        const wd = K.m('#D2A274'), wdD = K.m('#B07F55'), lf = K.m('#8FAE62');
        crate(wd, wdD, [K.m('#E05A5A'), K.m('#F0A94B'), K.m('#C5D07A')], lf, 1.0, 0, -0.58, 0.08);
        crate(wd, wdD, [K.m('#D9C25A'), K.m('#C5D07A')], lf, 0.98, 0.27, -0.66, -0.12);
        return { g };
      }
      function buildWeather(K) {
        const g = new T.Group();
        const navy = K.m('#2F3A5A'), pole = K.m('#6C7682'), cloud = K.m('#C9D1DA');
        cyl(g, pole, 0, 0.55, 0, 0.05, 1.1); cyl(g, pole, 0, 0.03, 0, 0.16, 0.06);
        rbox(g, navy, 0, 1.38, 0, 1.08, 0.66, 0.1, 0.045); plane(g, K.t(SIGN.weather), 0, 1.38, 0.052, 0.96, 0.555);
        [[-0.12, 1.27, 0.07, 0.11], [0.02, 1.31, 0.08, 0.14], [0.16, 1.27, 0.07, 0.1], [0.04, 1.23, 0.08, 0.1]].forEach(([x, y, z, r]) => sph(g, cloud, x, y, z, r, r * 0.8, r * 0.6));
        return { g };
      }
      function buildMailbox() {
        const g = new T.Group();
        cyl(g, SM.lampD, 0, 0.5, 0, 0.04, 1.0);
        rbox(g, SM.blue, 0, 1.12, 0, 0.36, 0.32, 0.3, 0.05);
        put(g, GEO.halfCyl, SM.blue, [0, 1.28, 0], [0.18, 0.3, 0.18], [0, PI / 2, PI / 2]);
        box(g, SM.metalD, 0, 1.18, 0.151, 0.22, 0.03, 0.01);
        box(g, SM.white, 0.02, 1.2, 0.16, 0.14, 0.09, 0.012, [0, 0, 0.12]);
        bowAt(g, SM.bow, SM.bow, 0.12, 1.26, 0.16, 0.7);
        return g;
      }

      kits = {}, buildings = {};
      const place = (k, built, x, z, lit) => {
        built.g.position.set(x, 0, z); scene.add(built.g);
        bake(built.g, k); built.g.userData.key = k;
        built.g.rotation.z = ({ bureau: -0.014, sweets: 0.009, roof: 0.018 })[k] || 0;
        built.K = kits[k];
        buildings[k] = built;
        return built;
      };
      [['cinema', buildCinema], ['bureau', buildBureau], ['sweets', buildSweets], ['roof', buildRoof]].forEach(([k, fn]) => {
        kits[k] = makeKit(o.isLit(k) && k !== o.justLit);
        place(k, fn(kits[k]), B[k], FRONT_Z);
      });
      kits.silver = makeKit(o.idx > 2); place('silver', buildSilver(kits.silver), 11.9, FRONT_Z);
      kits.kiosk = makeKit(o.idx > 1); place('kiosk', buildKiosk(kits.kiosk), 9.6, -1.1);
      kits.weather = makeKit(o.idx > 2); place('weather', buildWeather(kits.weather), 3.1, -1.3);
      mail = buildMailbox(); mail.position.set(13.6, 0, -1.6); scene.add(mail); bake(mail, 'mail');

      /* --- уютный декор улицы (склеивается по трём зонам; тапы проходят сквозь него) --- */
      const decor = [new T.Group(), new T.Group(), new T.Group()]; decor.forEach(g => scene.add(g));
      D = x => decor[x < 8 ? 0 : x < 18 ? 1 : 2];
      // хризантемы в горшках
      function mum(par, m1, m2, pot, x, z, sc = 1) {
        put(par, GEO.pot, pot, [x, 0.17 * sc, z], [0.2 * sc, 0.34 * sc, 0.2 * sc]);
        cyl(par, pot, x, 0.355 * sc, z, 0.215 * sc, 0.05 * sc);
        blob(par, AM.leafG, x, 0.42 * sc, z, 0.25 * sc, 0.12 * sc, 0.25 * sc);
        [[0, 0.56, 0, 0.15], [0.14, 0.5, 0.06, 0.11], [-0.14, 0.5, 0.05, 0.11], [0.06, 0.5, -0.13, 0.11], [-0.08, 0.49, -0.11, 0.1], [0.05, 0.51, 0.14, 0.1], [-0.04, 0.63, 0.04, 0.09]]
          .forEach(([dx, dy, dz, r], i) => put(par, GEO.sphLo, i % 2 ? m2 : m1, [x + dx * sc, dy * sc, z + dz * sc], [r * sc, r * sc * 0.8, r * sc]));
      }
      [[-2.55, -1.75, 0.9, 'mumPk', 'mumPkL', 'potT'], [2.62, -1.85, 0.85, 'mumR', 'mumRL', 'potP'], [13.05, -1.8, 0.8, 'mumL', 'mumLL', 'potC'], [14.15, -1.8, 0.8, 'mumY', 'mumYL', 'potT'],
        [19.3, -1.65, 1, 'mumPk', 'mumPkL', 'potS'], [25.75, -1.7, 1, 'mumR', 'mumRL', 'potP']].forEach(([x, z, sc, a, b, pt]) => mum(D(x), AM[a], AM[b], AM[pt], x, z, sc));
      // гирлянды: фонарики и флажки; зажигаются вместе с раскрытым домом
      const pennantGeo = keep(new T.ExtrudeGeometry(triShape(0.17, 0.21), { depth: 0.008, bevelEnabled: false })); pennantGeo.rotateZ(PI);
      const wireM = aut('#7A6670'), V = (x, y, z) => new T.Vector3(x, y, z);
      const gm = K => K._g || (K._g = { L: [K.m('#FFD9A8', { glow: '#FFB46B', gi: 0.6 }), K.m('#F9C3CF', { glow: '#F58FA6', gi: 0.5 }), K.m('#FFF1CF', { glow: '#FFD98A', gi: 0.55 })], cap: K.m('#C9A27A'), F: ['#F6C6D0', '#FFFDF9', '#F2B48A', '#E8A0B4'].map(h => K.m(h)) });
      function garland(par, K, a, b, sag, n, flags) {
        const G2 = gm(K), mid = a.clone().lerp(b, 0.5); mid.y -= sag;
        const c = new T.QuadraticBezierCurve3(a, mid, b);
        put(par, keep(new T.TubeGeometry(c, 20, 0.007, 4)), wireM).castShadow = false;
        for (let i = 1; i < n; i++) {
          const q = c.getPoint(i / n);
          if (!flags || i % 2) { cyl(par, G2.cap, q.x, q.y - 0.03, q.z, 0.03, 0.03); put(par, GEO.sphLo, G2.L[i % 3], [q.x, q.y - 0.13, q.z], [0.075, 0.095, 0.075]); cyl(par, G2.cap, q.x, q.y - 0.23, q.z, 0.028, 0.02); }
          else put(par, pennantGeo, G2.F[(i >> 1) % 4], [q.x, q.y, q.z]);
        }
      }
      garland(decor[0], kits.cinema, V(1.98, 4.1, -1.8), V(4.45, 4.3, -1.82), 0.55, 12, true);
      garland(decor[1], kits.bureau, V(7.95, 4.3, -1.82), V(11.0, 2.6, -1.82), 0.4, 14, true);
      garland(decor[1], kits.silver, V(12.85, 2.6, -1.82), V(14.45, 4.25, -1.82), 0.3, 8, true);
      garland(decor[2], kits.sweets, V(17.95, 4.25, -1.82), V(20.85, 4.6, -1.82), 0.6, 12, true);
      garland(decor[0], kits.cinema, V(1.98, 4.15, -1.8), V(3.1, 2.98, 3.21), 0.45, 8, false);
      garland(decor[1], kits.bureau, V(8.0, 4.2, -1.85), V(9.0, 2.98, 3.21), 0.45, 8, false);
      garland(decor[2], kits.sweets, V(18.0, 4.25, -1.85), V(19.6, 2.98, 3.21), 0.45, 8, false);
      // садовые фонарики у дверей с ореолом (светят даже в дождь)
      const cone4 = keep(new T.ConeGeometry(1, 1, 4)), ringS = keep(new T.TorusGeometry(0.03, 0.008, 5, 12));
      const lgM = toon('#FFE6B0', { emissive: new T.Color('#FFB860'), emissiveIntensity: [0.95, 0.75, 0.65, 0.65][LI] });
      const haloM2 = keep(new T.SpriteMaterial({ map: haloTex, transparent: true, opacity: [0.8, 0.55, 0.45, 0.45][LI], depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      function gLantern(par, x, z, sc = 1, y = 0) {
        box(par, AM.plum, x, y + 0.015 * sc, z, 0.18 * sc, 0.03 * sc, 0.18 * sc);
        box(par, lgM, x, y + 0.13 * sc, z, 0.12 * sc, 0.2 * sc, 0.12 * sc);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(par, AM.plum, x + a * 0.068 * sc, y + 0.13 * sc, z + b * 0.068 * sc, 0.022 * sc, 0.22 * sc, 0.022 * sc));
        put(par, cone4, AM.plum, [x, y + 0.285 * sc, z], [0.135 * sc, 0.09 * sc, 0.135 * sc], [0, PI / 4, 0]);
        put(par, ringS, AM.plum, [x, y + 0.35 * sc, z], [sc, sc, sc]);
        const h = new T.Sprite(haloM2); h.position.set(x, y + 0.14 * sc, z + 0.05); h.scale.set(0.75 * sc, 0.75 * sc, 1); scene.add(h);
      }
      gLantern(decor[0], -1.2, -1.86); if (LI >= 2) gLantern(decor[0], 1.2, -1.86);
      gLantern(decor[0], 5.48, -1.6); gLantern(decor[2], 23.0, -1.6); if (LI >= 2) gLantern(decor[2], 21.32, -1.5);
      // зонты в дождь и после дождя
      const umbHook = keep(new T.TorusGeometry(0.035, 0.01, 5, 10, PI));
      function closedUmb(par, col, x, z, lean, ry = 0) {
        const u = new T.Group(); u.position.set(x, 0.02, z); u.rotation.set(0, ry, lean); par.add(u);
        cyl(u, AM.plum, 0, 0.42, 0, 0.008, 0.84); put(u, GEO.cone, col, [0, 0.52, 0], [0.05, 0.46, 0.05], [PI, 0, 0]);
        put(u, GEO.sphLo, AM.cream, [0, 0.56, 0], [0.052, 0.015, 0.052]); put(u, umbHook, AM.woodD, [0.035, 0.85, 0]);
      }
      const UC = ['#F2A7B8', '#A8D5C6', '#F7E1B5'].map(h => aut(h));
      if (LI <= 1) {
        cyl(decor[0], AM.plum, 1.2, 0.17, -1.86, 0.11, 0.34); put(decor[0], keep(new T.TorusGeometry(0.11, 0.015, 5, 16)), AM.cream, [1.2, 0.34, -1.86], null, [PI / 2, 0, 0]);
        closedUmb(decor[0], UC[0], 1.16, -1.9, 0.12); closedUmb(decor[0], UC[1], 1.25, -1.84, -0.1, 1); closedUmb(decor[0], UC[2], 1.2, -1.82, 0.02, 2);
      }
      if (LI === 0) closedUmb(decor[0], UC[0], 5.16, -1.0, 0.2);
      if (LI === 1) {
        const u = new T.Group(); u.position.set(4.5, 0.82, -1.2); u.rotation.set(1.0, 0.35, 0.25); decor[0].add(u);
        put(u, keep(new T.ConeGeometry(0.42, 0.17, 8, 1, true)), aut('#F2A7B8', { side: T.DoubleSide }), [0, 0, 0]);
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; put(u, GEO.sphLo, AM.cream, [Math.cos(a) * 0.42, -0.085, Math.sin(a) * 0.42], [0.022, 0.022, 0.022]); }
        [[0.2, 0.1], [-0.15, 0.18], [0.05, -0.22], [-0.22, -0.08]].forEach(([x, z]) => put(u, GEO.sphLo, AM.cream, [x, 0.091 - 0.405 * Math.hypot(x, z), z], [0.035, 0.01, 0.035]));
        cyl(u, AM.plum, 0, -0.3, 0, 0.009, 0.55);
      }
      // лавочки обрастают уютом, когда теплеет
      if (LI >= 2) {
        const sc2 = aut('#D98C9C'), stp = AM.cream;
        box(decor[0], sc2, 4.55, 0.495, -1.12, 0.7, 0.035, 0.17, [0, 0.18, 0]);
        box(decor[0], sc2, 4.85, 0.31, -0.975, 0.17, 0.34, 0.035, [0.08, 0.18, 0]);
        [0.22, 0.3, 0.38].forEach(y => box(decor[0], stp, 4.85, y, -0.972, 0.172, 0.035, 0.037, [0.08, 0.18, 0]));
        for (let i = 0; i < 5; i++) box(decor[0], stp, 4.785 + i * 0.033, 0.115, -0.99, 0.014, 0.06, 0.014);
        cyl(decor[0], AM.pumpC, 4.98, 0.515, -1.27, 0.045, 0.08); cyl(decor[0], aut('#8A5A44'), 4.98, 0.553, -1.27, 0.04, 0.006);
        box(decor[0], AM.cream, 4.97, 0.56, -1.26, 0.022, 0.018, 0.022, [0, 0.4, 0]); box(decor[0], AM.mumPkL, 4.995, 0.56, -1.28, 0.02, 0.018, 0.02, [0, 1, 0]);
        put(decor[0], keep(new T.TorusGeometry(0.022, 0.007, 5, 10)), AM.pumpC, [5.026, 0.515, -1.27]);
      }
      if (LI >= 3) {
        put(decor[0], GEO.hemi, aut('#E8B4A0'), [3.9, 0.475, -1.2], [0.12, 0.09, 0.12]); blob(decor[0], AM.cream, 3.9, 0.575, -1.2, 0.045);
        box(decor[0], aut('#8FB3D9'), 4.13, 0.497, -1.08, 0.18, 0.04, 0.13, [0, 0.15, 0]); box(decor[0], AM.mumPk, 4.14, 0.535, -1.08, 0.16, 0.035, 0.12, [0, -0.1, 0]);
        [20.36, 20.5].forEach((x, i) => { cyl(decor[2], i ? AM.potP : AM.pumpC, x, 0.515, -1.18 + i * 0.07, 0.045, 0.08); cyl(decor[2], aut('#8A5A44'), x, 0.553, -1.18 + i * 0.07, 0.04, 0.006); });
        rbox(decor[2], aut('#F7E1E6'), 20.85, 0.635, -1.15, 0.16, 0.16, 0.16, 0.02); box(decor[2], AM.bow, 20.85, 0.636, -1.15, 0.165, 0.165, 0.03); box(decor[2], AM.bow, 20.85, 0.636, -1.15, 0.03, 0.165, 0.165);
        bowAt(decor[2], AM.bow, AM.bowD, 20.85, 0.73, -1.15, 0.9);
      }
      // кусты и пучки сухой травы вдоль фасадов
      const BUSH = [aut('#C4574A'), aut('#C9A04F'), aut('#9DA765'), aut('#D07A48')];
      function bush(par, x, z, sc, k) { blob(par, BUSH[k], x, 0.2 * sc, z, 0.36 * sc, 0.28 * sc, 0.3 * sc); blob(par, BUSH[(k + 1) % 4], x + 0.28 * sc, 0.15 * sc, z + 0.06 * sc, 0.25 * sc, 0.2 * sc, 0.22 * sc); blob(par, BUSH[k], x - 0.26 * sc, 0.14 * sc, z + 0.05 * sc, 0.26 * sc, 0.19 * sc, 0.22 * sc); }
      [[-3.45, -2.25, 1, 0], [2.95, -2.5, 0.9, 1], [8.5, -2.4, 0.8, 0], [24.75, -2.35, 1, 3], [26.3, -2.0, 1.1, 2]].forEach(([x, z, sc, k]) => bush(D(x), x, z, sc, k));
      const cone5 = keep(new T.ConeGeometry(1, 1, 5)), GR = [aut('#B8B26F'), aut('#C9A863'), aut('#9FAE6E')];
      function tuft(par, x, z, sc = 1) { for (let i = 0; i < 5; i++) { const a = i * 1.26 + R(); put(par, cone5, GR[i % 3], [x + Math.cos(a) * 0.04 * sc, 0.08 * sc, z + Math.sin(a) * 0.03 * sc], [0.018 * sc, (0.15 + R() * 0.08) * sc, 0.018 * sc], [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35]).castShadow = false; } }
      const DXS = [0, 6.2, 17.25, 23.7];
      for (let x = -3.9; x < 27; x += 0.7 + R() * 0.9) if (DXS.every(d => Math.abs(x - d) > 0.85) && Math.abs(x) > 1.7) tuft(D(x), x, -1.9 + R() * 0.06, 0.8 + R() * 0.5);
      LAMPS.forEach(x => { tuft(D(x), x - 0.17, 3.2, 0.9); tuft(D(x), x + 0.15, 3.34, 0.7); });
      // стойка урожая у кондитерской
      { const hx = 18.48, hz = -1.8, P = D(hx);
        [[0.06, 0, 0.34], [0.44, -0.06, 0.28], [0.8, -0.12, 0.22]].forEach(([y, dz, d]) => rbox(P, AM.woodL, hx, y, hz + dz, 0.64, 0.04, d, 0.015));
        [-0.3, 0.3].forEach(dx => box(P, AM.woodD, hx + dx, 0.45, hz - 0.06, 0.04, 0.92, 0.36, [0.12, 0, 0]));
        pumpkin(hx - 0.14, hz + 0.02, 0.13, 0, 0.08, P); pumpkin(hx + 0.15, hz + 0.04, 0.1, 2, 0.08, P);
        const APL = ['#E05A5A', '#F0A94B', '#C5D07A'].map(h => aut(h));
        APL.forEach((m, i) => put(P, GEO.sphLo, m, [hx - 0.2 + i * 0.1, 0.51, hz - 0.04], [0.05, 0.048, 0.05]));
        [0.1, 0.2].forEach((dx, i) => { cyl(P, i ? APL[1] : APL[0], hx + dx, 0.51, hz - 0.06, 0.045, 0.09); cyl(P, AM.mumPkL, hx + dx, 0.565, hz - 0.06, 0.05, 0.02); });
        pumpkin(hx - 0.15, hz - 0.12, 0.08, 1, 0.82, P); gLantern(P, hx + 0.14, hz - 0.12, 0.7, 0.82);
        for (let i = 0; i < 4; i++) put(P, pennantGeo, [AM.bow, AM.cream, AM.pumpP, AM.mumPkL][i], [hx - 0.21 + i * 0.14, 0.95, hz - 0.1], [0.6, 0.6, 1]);
      }
      // велосипед с корзинкой (после дождя кто-то выехал покататься)
      if (LI >= 1) {
        const _up = new T.Vector3(0, 1, 0), _d = new T.Vector3();
        const rod = (par, m, x0, y0, z0, x1, y1, z1, r) => { _d.set(x1 - x0, y1 - y0, z1 - z0); const L = _d.length(), mm = put(par, GEO.cylLo, m, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [r, L, r]); mm.quaternion.setFromUnitVectors(_up, _d.normalize()); return mm; };
        const bk = new T.Group(); bk.position.set(21.15, 0.04, 3.52); bk.rotation.set(0.1, 0.05, 0); decor[2].add(bk);
        const fr = aut('#9ED2C2'), tire = aut('#4E4550'), wick = aut('#D8B07C'), wickD = aut('#B98A58');
        const wheelG = keep(new T.TorusGeometry(0.27, 0.022, 6, 24)), rimG = keep(new T.TorusGeometry(0.235, 0.008, 4, 24)), fend = keep(new T.TorusGeometry(0.3, 0.018, 4, 12, PI * 0.55));
        [-0.47, 0.47].forEach(x => { put(bk, wheelG, tire, [x, 0.27, 0]); put(bk, rimG, AM.cream, [x, 0.27, 0]); blob(bk, AM.cream, x, 0.27, 0, 0.03);
          [0, PI / 3, 2 * PI / 3].forEach(a => box(bk, AM.cream, x, 0.27, 0, 0.46, 0.006, 0.006, [0, 0, a])); put(bk, fend, fr, [x, 0.27, 0], null, [0, 0, PI * 0.225]); });
        const F = (a, b, r = 0.018) => rod(bk, fr, a[0], a[1], a[2] || 0, b[0], b[1], b[2] || 0, r);
        F([-0.03, 0.27], [-0.13, 0.74]); F([-0.03, 0.27], [0.15, 0.34]); F([0.15, 0.34], [0.33, 0.6]); F([0.33, 0.6], [0.36, 0.76], 0.022);
        [-0.035, 0.035].forEach(z => { F([-0.03, 0.27, z], [-0.47, 0.27, z], 0.012); F([-0.11, 0.66, z], [-0.47, 0.27, z], 0.011); F([0.33, 0.6, z], [0.47, 0.27, z], 0.013); });
        F([0.36, 0.76], [0.32, 0.9], 0.014); rod(bk, AM.plum, 0.31, 0.9, -0.22, 0.31, 0.9, 0.22, 0.012); [-0.22, 0.22].forEach(z => blob(bk, AM.cream, 0.31, 0.9, z, 0.022, 0.022, 0.05));
        rod(bk, AM.plum, -0.13, 0.74, 0, -0.14, 0.8, 0, 0.012); blob(bk, aut('#8A5A44'), -0.16, 0.81, 0, 0.11, 0.035, 0.065);
        rbox(bk, wick, 0.56, 0.84, 0, 0.3, 0.2, 0.26, 0.03); box(bk, wickD, 0.56, 0.95, 0, 0.32, 0.03, 0.28); box(bk, wickD, 0.56, 0.84, 0, 0.305, 0.025, 0.265);
        bowAt(bk, AM.bow, AM.bowD, 0.56, 0.87, 0.14, 0.8);
        if (LI >= 2) { blob(bk, AM.mumPk, 0.5, 0.98, 0.06, 0.065); blob(bk, AM.mumY, 0.6, 0.97, -0.06, 0.06); blob(bk, AM.cream, 0.58, 1.0, 0.07, 0.055); rod(bk, aut('#E2B072'), 0.47, 0.88, -0.08, 0.66, 1.18, -0.1, 0.03); }
        box(bk, AM.plum, -0.36, 0.6, 0, 0.3, 0.02, 0.15); pumpkin(-0.36, 0, 0.09, 0, 0.61, bk);
        rod(bk, AM.plum, -0.03, 0.27, 0, 0, 0, 0.13, 0.008);
      }
      // меловая доска у бюро
      { const CLN = [['Переводим', 'даже', 'дождь'], ['Переводим', 'даже', 'листопад'], ['Переводим', 'даже', 'листопад'], ['Переводим', 'даже', 'кошачье «мяу»']][LI];
        const [cv, c] = cnv(256, 352); c.fillStyle = '#3E3A44'; rrect(c, 0, 0, 256, 352, 18); c.fill();
        c.strokeStyle = 'rgba(255,240,245,.55)'; c.setLineDash([10, 8]); c.lineWidth = 4; rrect(c, 14, 14, 228, 324, 12); c.stroke(); c.setLineDash([]);
        text(c, CLN[0], 128, 74, 42, '#FFF4F6', { f: 'Caveat', w: 700, max: 220 }); text(c, CLN[1], 128, 132, 42, '#F7B8C8', { f: 'Caveat', w: 700, max: 220 }); text(c, CLN[2], 128, 190, 46, '#FFD9A8', { f: 'Caveat', w: 700, max: 220 });
        c.fillStyle = '#E8955A'; c.beginPath(); c.moveTo(128, 300); [[100, 262], [112, 262], [96, 236], [118, 244], [128, 214], [138, 244], [160, 236], [144, 262], [156, 262]].forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill();
        const chalkM = toon('#FFFFFF', { map: tex(cv) }), ax = 8.5, az = -1.55;
        box(decor[1], AM.woodL, ax, 0.35, az + 0.1, 0.5, 0.7, 0.03, [-0.22, 0, 0]); box(decor[1], AM.woodL, ax, 0.35, az - 0.1, 0.5, 0.7, 0.03, [0.22, 0, 0]);
        put(decor[1], GEO.plane, chalkM, [ax, 0.354, az + 0.117], [0.44, 0.62, 1], [-0.22, 0, 0]).castShadow = false;
      }
      // кучки листьев у бордюра (можно пройти сквозь — разлетаются)
      PILES = o.rain ? [] : [[1.6, 2.55, 0.45], [11.3, 2.7, 0.5], [17.8, 2.55, 0.45], [25.3, 2.4, 0.5]];
      const pileM = [AM.pumpO, AM.mumR, AM.mumY, AM.pumpB];
      PILES.forEach(([x, z, r]) => [[0, 0, 1, 1], [0.45, 0.1, 0.7, 0.8], [-0.42, 0.12, 0.72, 0.8], [0.1, -0.38, 0.65, 0.75], [-0.15, 0.4, 0.6, 0.7], [0.3, -0.25, 0.5, 0.6], [-0.05, 0.02, 0.55, 1.25]]
        .forEach(([dx, dz, k, hk], i) => blob(D(x), pileM[i % 4], x + dx * r, 0, z + dz * r, 0.55 * r * k, 0.26 * r * hk, 0.45 * r * k)));
      kickM = ['#E8955A', '#D96F4A', '#F0B95A', '#E7A3A0'].map(h => keep(new T.MeshBasicMaterial({ color: warmC(h), side: T.DoubleSide })));
      // листья упали на карнизы, козырёк КАССА и крышу киоска — осень и наверху
      { const LEAN = { bureau: -0.014, sweets: 0.009, roof: 0.018 }, HH = { cinema: 4.4, bureau: 4.6, sweets: 4.5, roof: 5.1 };
        Object.keys(B).forEach(k => { for (let i = 0; i < 9; i++) { const dx = -1.85 + R() * 3.7, y = HH[k] + 0.392 + dx * (LEAN[k] || 0);
          put(D(B[k]), leafFlat, LC[i % 5], [B[k] + dx, y, -1.8 + (R() - 0.5) * 0.05], [0.1, 1, 0.1], [(R() - 0.5) * 0.3, R() * 6.28, 0]).castShadow = false; } });
        for (let i = 0; i < 3; i++) put(decor[0], leafFlat, LC[i], [-0.5 + i * 0.45, 2.455, -1.45 + (R() - 0.5) * 0.3], [0.1, 1, 0.1], [0, R() * 6, 0]).castShadow = false;
        for (let i = 0; i < 3; i++) put(decor[1], leafFlat, LC[i + 2], [9.25 + i * 0.3, 1.83, -1.65], [0.1, 1, 0.1], [0.2, R() * 6, 0]).castShadow = false; }
      // коврики «привет» перед дверями
      { const matM = toon(warmC('#FFFFFF'), { map: tex(SIGN.mat) });
        [B.cinema, B.bureau, B.sweets + 1.05, B.roof + 1.1].forEach(x => { const m = put(D(x), GEO.plane, matM, [x, 0.006, FRONT_Z + 0.3], [0.8, 0.45, 1], [-PI / 2, 0, 0]); m.castShadow = false; }); }
      decor.forEach(g => { bake(g); g.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); });
      // дым из труб (один инстанс-меш)
      CHIM = [[21.25, 6.36, -4.4], [14.95, 5.36, -4.4]], SPN = 6;
      smoke = new T.InstancedMesh(blobGeo, toon('#FFFFFF'), CHIM.length * SPN);
      smoke.castShadow = false; smoke.receiveShadow = false; smoke.frustumCulled = false; scene.add(smoke);
      { const sCol = new T.Color(o.rain ? '#BFC4CC' : ['#E9E4EA', '#E9E4EA', '#F2ECF0', '#FBF1F3'][LI]), sPink = new T.Color('#FBE0E8');
        for (let i = 0; i < smoke.count; i++) smoke.setColorAt(i, LI >= 3 && Math.floor(i / SPN) === 1 ? sPink : sCol); }
      // клин птиц высоко в небе (не в дождь)
      const birdG = new T.Group(), birdM = toon('#77708F');
      box(birdG, birdM, -0.21, 0.07, 0, 0.44, 0.035, 0.12, [0, 0, 0.32]); box(birdG, birdM, 0.21, 0.07, 0, 0.44, 0.035, 0.12, [0, 0, -0.32]); blob(birdG, birdM, 0, 0, 0, 0.06, 0.05, 0.1);
      bake(birdG);
      FLK = [[0, 0], [-1, 1], [-1, -1], [-2, 2], [-2, -2], [-3, 3], [-3, -3]].concat(LI >= 3 ? [[-5.4, 0.3]] : []);
      birds = new T.InstancedMesh(birdG.children.find(m => m.isMesh).geometry, keep(new T.MeshBasicMaterial({ color: 0x77708F })), FLK.length);
      birds.frustumCulled = false; birds.castShadow = false; birds.visible = !o.rain; scene.add(birds);
      sM = new T.Matrix4(), sQ = new T.Quaternion(), sS = new T.Vector3(), sP = new T.Vector3();

      // секретное сердечко у киоска
      secretMesh = null;
      if (o.secretAvailable) {
        const hs = new T.Shape(); hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.9, 0.1, -0.6, 0.85, 0, 0.45); hs.bezierCurveTo(0.6, 0.85, 0.9, 0.1, 0, -0.5);
        const hg = keep(new T.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 16 })); hg.center();
        secretMesh = new T.Mesh(hg, toon('#A98BE8', { emissive: new T.Color('#7E5FD0'), emissiveIntensity: 0.35 }));
        secretMesh.scale.setScalar(0.14); secretMesh.position.set(9.6 + 0.62, 1.15, -1.1 + 0.18); secretMesh.castShadow = true;
        secretMesh.userData.key = 'secret'; scene.add(secretMesh);
      }

      /* --- метка над нужной дверью: 3D-стрелка и ярлык --- */
      tgtDoor = o.target ? doorOf(o.target) : { x: 1e6, z: 1e6 };
      const markCv = labelCanvas(o.arrowText || ' ');
      mark = new T.Sprite(keep(new T.SpriteMaterial({ map: tex(markCv), depthTest: false, fog: false })));
      const markH = 0.55; mark.scale.set(markH * markCv.width / markCv.height, markH, 1);
      mark.renderOrder = 10; scene.add(mark);
      arrow = put(scene, GEO.cone, toon('#C2405B', { emissive: new T.Color('#C2405B'), emissiveIntensity: 0.25 }), [tgtDoor.x, 2.75, FRONT_Z + 1.1], [0.16, 0.32, 0.16], [PI, 0, 0]);
      arrow.castShadow = false;

    }
    /* --- общий контур для персонажей --- */
    const outlineMat = keep(new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: 'uniform float thick; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    }));
    const outlines = [];
    const addOutlines = list => list.forEach(m => {
      const ol = new T.Mesh(m.geometry, outlineMat);
      ol.position.copy(m.position); ol.rotation.copy(m.rotation); ol.scale.copy(m.scale);
      ol.castShadow = false; ol.receiveShadow = false; m.parent.add(ol); outlines.push(ol);
    });

    /* --- модели находок (собраны из примитивов) --- */
    function pickModel(kind, held) {
      const g = new T.Group(), inner = new T.Group(); g.add(inner);
      const B = MODELS[kind] || MODELS.star;
      B(inner);
      bake(inner, null, { receive: false });   // одна находка — несколько вызовов отрисовки, а не десятки
      if (!held) inner.position.y = 0.42;
      return g;
    }
    const MODELS = {
      star(g) { // оригами-звёздочка
        const sh = new T.Shape();
        for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + PI / 2, r = i % 2 ? 0.07 : 0.16; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        const geo = keep(new T.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1 })); geo.center();
        put(g, geo, pm('#FFD45E'));
      },
      ticket13(g) { // билет в несуществующее место 13 с отпечатком перепончатой лапы
        const t = new T.Group(); t.rotation.set(0, 0, 0.21); g.add(t);
        rbox(t, pm('#F6C6D0'), 0, 0, 0, 0.24, 0.11, 0.008, 0.003); rbox(t, pm('#FFF1E6'), 0.15, 0, 0, 0.06, 0.11, 0.009, 0.003);
        for (let i = 0; i < 5; i++) sph(t, pm('#C9A2AE'), 0.12, -0.044 + i * 0.022, 0.005, 0.004);
        plane(t, toon('#FFFFFF', { map: tex(SIGN.ticket) }), -0.01, 0, 0.0055, 0.2, 0.1);
        [-0.35, 0, 0.35].forEach(a => sph(t, pm('#E9955A'), 0.15 + Math.sin(a) * 0.012, 0.0 + Math.cos(a) * 0.012, -0.006, 0.006, 0.016, 0.003));
      },
      pigeonUmbrella(g) { // коктейльный зонтик размера «голубь»
        const u = new T.Group(); u.rotation.z = 0.35; g.add(u);
        put(u, keep(new T.ConeGeometry(0.13, 0.07, 8)), pm('#F4C7D0'), [0, 0.12, 0]);
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(u, pm('#FFFDF9'), Math.cos(a) * 0.065, 0.1, Math.sin(a) * 0.065, 0.13, 0.004, 0.004, [0, -a, -0.5]); }
        cyl(u, pm('#E9D3B6'), 0, 0.0, 0, 0.006, 0.22); sph(u, pm('#FFFDF9'), 0, 0.16, 0, 0.012);
        if (o.rain) for (let i = 0; i < 4; i++) { const a = i * 1.6; sph(u, pm('#DCE6F2'), Math.cos(a) * 0.07, 0.115, Math.sin(a) * 0.07, 0.008); }
      },
      tulipBunch(g) { MODELS.tulips(g); box(g, pm('#FFFDF9'), 0.09, 0.0, 0.07, 0.05, 0.035, 0.004); cyl(g, pm('#C9A2AE'), 0.07, 0.03, 0.06, 0.002, 0.05, [0, 0, 0.6]); },
      catSweater(g) { // свитер размера «кот» с вязаным солнышком
        rbox(g, pm('#FFF1E2'), 0, 0, 0, 0.22, 0.18, 0.07, 0.03);
        [-1, 1].forEach(sd => cyl(g, pm('#FFF1E2'), sd * 0.14, 0.03, 0, 0.03, 0.12, [0, 0, sd * 1.2]));
        put(g, keep(new T.TorusGeometry(0.04, 0.012, 6, 16)), pm('#F4C7D0'), [0, 0.09, 0], null, [PI / 2, 0, 0]);
        rbox(g, pm('#F4C7D0'), 0, -0.085, 0, 0.22, 0.025, 0.075, 0.01);
        cyl(g, pm('#FFD45A'), 0, 0.0, 0.037, 0.03, 0.004, [PI / 2, 0, 0]);
        for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(g, pm('#FFD45A'), Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.037, 0.014, 0.004, 0.004, [0, 0, a]); }
      },
      watch13(g) { // карманные часы, стоят на 13:00
        const w = new T.Group(); w.rotation.set(0.25, 0, 0); g.add(w);
        cyl(w, pm('#C9CED6'), 0, 0, 0, 0.07, 0.02, [PI / 2, 0, 0]);
        put(w, keep(new T.TorusGeometry(0.07, 0.008, 6, 24)), pm('#E3E7EC'), [0, 0, 0.01]);
        put(w, GEO.plane, toon('#FFFFFF', { map: tex(SIGN.dial) }), [0, 0, 0.0115], [0.12, 0.12, 1]).castShadow = false;
        box(w, pm('#3A2E3F'), 0, 0.022, 0.014, 0.005, 0.045, 0.003); box(w, pm('#3A2E3F'), 0, 0.016, 0.0145, 0.005, 0.032, 0.003);
        cyl(w, pm('#C9CED6'), 0, 0.078, 0, 0.01, 0.015); put(w, keep(new T.TorusGeometry(0.016, 0.004, 5, 12)), pm('#C9CED6'), [0, 0.098, 0]);
        for (let i = 0; i < 6; i++) put(w, keep(new T.TorusGeometry(0.012, 0.003, 4, 10)), pm('#C9CED6'), [0.03 + i * 0.016, 0.1 + Math.sin(i * 0.6) * 0.02, 0], null, [0, i % 2 ? PI / 2 : 0, 0]);
      },
      featherFinal(g) { // перо гуся Финалыча
        const f = new T.Group(); f.rotation.z = 0.5; g.add(f);
        [-1, 1].forEach(sd => sph(f, pm('#FFFDF9'), sd * 0.012, 0.02, 0, 0.026, 0.08, 0.005));
        cyl(f, pm('#E9D3B6'), 0, 0.0, 0, 0.004, 0.21); sph(f, pm('#E9D3B6'), 0, -0.105, 0, 0.005);
      },
      blueSaucer(g) { // блюдце в розовый горошек; чашки нет
        const sc = new T.Group(); sc.rotation.x = 0.5; g.add(sc);
        put(sc, keep(new T.LatheGeometry([[0.001, 0], [0.06, 0], [0.1, 0.008], [0.13, 0.018], [0.124, 0.022], [0.095, 0.014], [0.06, 0.006], [0.001, 0.006]].map(([a, b]) => new T.Vector2(a, b)), 28)), pm('#FAFAFA'));
        for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; sph(sc, pm('#F08FA8'), Math.cos(a) * 0.105, 0.016, Math.sin(a) * 0.105, 0.009, 0.003, 0.009); }
        put(sc, keep(new T.TorusGeometry(0.045, 0.004, 4, 20)), pm('#B98C6A'), [0, 0.008, 0], null, [PI / 2, 0, 0]);
        for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; sph(sc, pm('#F6B3C4'), Math.cos(a) * 0.07, 0.01, Math.sin(a) * 0.07, 0.008, 0.002, 0.008); }
      },
      paperStar(g) { MODELS.star(g); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + PI / 2; box(g, pm('#F0C04A'), Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.05, 0.12, 0.004, 0.004, [0, 0, a]); } },
      tulips(g) { // букетик тюльпанов с ромашками в крафтовой бумаге с бантом
        put(g, GEO.cone, pm('#E9D2B4'), [0, -0.02, 0], [0.11, 0.3, 0.11], [PI, 0, 0]);
        put(g, GEO.cone, pm('#F6C6D0'), [0, 0.02, 0.012], [0.1, 0.22, 0.09], [PI, 0, 0]);
        const tg = keep(new T.LatheGeometry([[0.001, -0.03], [0.026, -0.024], [0.034, 0.0], [0.031, 0.034], [0.018, 0.046], [0.001, 0.043]].map(([a, b]) => new T.Vector2(a, b)), 12));
        const cols = ['#F08FA8', '#F7B5C6', '#F4C64E', '#F08FA8', '#FBC2A0'], rr = rng(77);
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * PI * 2 + rr() * 0.5, r = i ? 0.075 : 0, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 0.2 + (i ? 0 : 0.03) + rr() * 0.02;
          cyl(g, pm('#7FA36C'), x * 0.6, y - 0.07, z * 0.6, 0.004, 0.12, [z * 2, 0, -x * 2]);
          put(g, tg, pm(cols[i % cols.length]), [x, y, z], null, [z * 2, 0, -x * 2]);
        }
        [[-0.06, 0.17, 0.07], [0.07, 0.165, 0.06]].forEach(([x, y, z]) => { put(g, GEO.cylLo, pm('#FFFFFF'), [x, y, z], [0.032, 0.005, 0.032], [0.6, 0, x * 3]); sph(g, pm('#F4C64E'), x, y + 0.006, z + 0.004, 0.012); });
        [-1, 1].forEach(s => sph(g, pm('#8FBF86'), s * 0.11, 0.15, 0.02, 0.05, 0.022, 0.035));
        [-1, 1].forEach(s => sph(g, pm('#F08FA8'), s * 0.035, 0.02, 0.1, 0.035, 0.022, 0.012));
        sph(g, pm('#E0708F'), 0, 0.02, 0.105, 0.016);
      },
    };

    /* --- 3D-букет из выбранных цветов --- */
    const FLC = id => ((window.Art && Art.FLOWERS) || []).find(f => f.id === id) || { c: '#F3B8D0' };
    const lighter = (c, t) => '#' + new T.Color(c).lerp(new T.Color('#FFFFFF'), t).getHexString();
    const darker = (c, t) => '#' + new T.Color(c).multiplyScalar(1 - t).getHexString();
    const BQM = {}, bqm = c => BQM[c] || (BQM[c] = toon(c));
    function flower3d(g, id, x, y, z, mm = pm) {
      const c = FLC(id).c, h = new T.Group(); h.position.set(x, y, z); g.add(h);
      const S3 = (m, a, b, cc, sx, sy, sz) => sph(h, mm(m), a, b, cc, sx, sy, sz);
      switch (id) {
        case 'hydrangea': case 'hydrangeaPink':
          [[0, 0.01, 0], [0.02, 0, 0.012], [-0.02, 0, 0.012], [0.012, 0.004, -0.018], [-0.014, 0.006, -0.016], [0, 0.026, 0.004], [0.018, 0.02, -0.004], [-0.018, 0.02, 0]].forEach(([a, b, cc], i) => S3(i % 2 ? c : lighter(c, 0.3), a, b, cc, 0.017));
          break;
        case 'peony':
          for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; S3(darker(c, 0.06), Math.cos(a) * 0.024, 0, Math.sin(a) * 0.024, 0.02, 0.014, 0.02); }
          S3(c, 0, 0.012, 0, 0.026, 0.022, 0.026); S3(lighter(c, 0.4), 0, 0.03, 0, 0.012);
          break;
        case 'ranunculus':
          S3(darker(c, 0.08), 0, 0, 0, 0.028, 0.022, 0.028); S3(c, 0, 0.012, 0, 0.022, 0.018, 0.022); S3(lighter(c, 0.35), 0, 0.024, 0, 0.013);
          break;
        case 'tulip':
          put(h, keep(new T.LatheGeometry([[0.001, -0.02], [0.016, -0.016], [0.022, 0.0], [0.02, 0.022], [0.012, 0.03], [0.001, 0.028]].map(([a, b]) => new T.Vector2(a, b)), 12)), mm(c));
          break;
        case 'hyacinth':
          for (let i = 0; i < 7; i++) S3(i % 2 ? c : lighter(c, 0.3), (i % 2 ? 0.008 : -0.008), i * 0.014, (i % 3 - 1) * 0.006, 0.012 - i * 0.0007);
          break;
        case 'lavender':
          cyl(h, mm('#7FA36C'), 0, 0.02, 0, 0.003, 0.08);
          for (let i = 0; i < 6; i++) S3(i % 3 ? c : darker(c, 0.15), (i % 2 ? 0.005 : -0.005), 0.03 + i * 0.011, 0, 0.006, 0.009, 0.006);
          break;
        case 'chamomile':
          put(h, GEO.cylLo, mm('#FFFFFF'), [0, 0, 0], [0.03, 0.004, 0.03], [0.5, 0, 0]); S3('#F4C64E', 0, 0.004, 0.004, 0.011);
          break;
        case 'aster':   // астра: тонкие лепестки двумя кругами и жёлтая серединка
          put(h, GEO.cylLo, mm(c), [0, 0, 0], [0.032, 0.005, 0.032], [0.5, 0, 0]);
          put(h, GEO.cylLo, mm(lighter(c, 0.3)), [0, 0.004, 0.002], [0.022, 0.006, 0.022], [0.5, 0, 0.3]); S3('#F4C64E', 0, 0.008, 0.005, 0.009);
          break;
        case 'eucalyptus':
          cyl(h, mm('#7E9E88'), 0, 0.03, 0, 0.003, 0.09);
          [[-0.012, 0.01], [0.012, 0.03], [-0.012, 0.05], [0.01, 0.07]].forEach(([a, b], i) => S3(i % 2 ? c : darker(c, 0.1), a, b, 0, 0.014, 0.012, 0.005));
          break;
        case 'pampas':
          S3(c, 0, 0.04, 0, 0.018, 0.05, 0.018); S3(lighter(c, 0.35), 0.006, 0.05, 0.006, 0.012, 0.035, 0.012);
          break;
      }
      return h;
    }
    function bouquetModel(b) {
      const g = new T.Group();
      const list = (b.f && b.f.length ? b.f : ['tulip', 'chamomile', 'aster']).slice(0, 9);
      const paper = b.paper || '#E8D3B6', ribbon = b.ribbon || '#F08FA8';
      put(g, GEO.cone, bqm(darker(paper, 0.1)), [0, 0.03, -0.012], [0.105, 0.24, 0.07], [PI, 0, 0]);
      put(g, GEO.cone, bqm(paper), [0, 0.0, 0.01], [0.085, 0.2, 0.06], [PI, 0, 0]);
      [-1, 1].forEach(s2 => sph(g, bqm('#8FBF86'), s2 * 0.075, 0.12, 0.0, 0.035, 0.014, 0.02));
      const tallIds = ['hyacinth', 'lavender', 'eucalyptus', 'pampas'];
      const SL = [[0, 0.16, 0.02], [-0.045, 0.145, 0.03], [0.045, 0.145, 0.03], [0, 0.175, -0.025], [-0.07, 0.125, 0.0], [0.07, 0.125, 0.0], [-0.03, 0.13, 0.055], [0.03, 0.13, 0.055], [0, 0.135, 0.06]];
      const TL = [[-0.035, 0.17, -0.03], [0.035, 0.17, -0.03], [0, 0.19, -0.04], [-0.06, 0.15, -0.02], [0.06, 0.15, -0.02], [-0.015, 0.18, -0.045], [0.015, 0.18, -0.045], [-0.05, 0.16, -0.035], [0.05, 0.16, -0.035]];
      let ti = 0, ri = 0;
      list.forEach(id => { const tallF = tallIds.includes(id); const p = tallF ? TL[ti++ % 9] : SL[ri++ % 9]; flower3d(g, id, p[0], p[1], p[2], bqm); });
      cyl(g, bqm(ribbon), 0, 0.045, 0.012, 0.05, 0.022);
      [-1, 1].forEach(s2 => sph(g, bqm(ribbon), s2 * 0.03, 0.05, 0.06, 0.028, 0.016, 0.01, [0, 0, s2 * 0.4]));
      sph(g, bqm(darker(ribbon, 0.15)), 0, 0.05, 0.062, 0.012);
      [-1, 1].forEach(s2 => box(g, bqm(darker(ribbon, 0.15)), s2 * 0.014, 0.012, 0.06, 0.01, 0.05, 0.004, [0, 0, s2 * 0.3]));
      return bake(g, null, { receive: false });
    }
    if (!ROOM) { // тележка, пудель, подсолнух, лужа с солнцем: только на улице
      // Цветочная тележка с пчёлкой (у начала улицы, слева от кинотеатра)
      const CART = { x: -3.3, z: -1.05 };
      function buildCart() {
        const g = new T.Group();
        const wood = pm('#C9946A'), woodD = pm('#A87452'), zinc = pm('#B9C3CF'), stripeA = pm('#F6C6D0'), stripeB = pm('#FFFDF9'), metal = pm('#6C7682');
        rbox(g, wood, 0, 0.62, 0, 1.3, 0.42, 0.62, 0.06);
        for (let i = 0; i < 3; i++) box(g, woodD, 0, 0.5 + i * 0.12, 0.312, 1.24, 0.012, 0.01);
        [-1, 1].forEach(s2 => {
          put(g, keep(new T.TorusGeometry(0.22, 0.035, 8, 24)), woodD, [s2 * 0.6, 0.26, 0.05], null, [0, PI / 2, 0]);
          cyl(g, metal, s2 * 0.6, 0.26, 0.05, 0.03, 0.08, [0, 0, PI / 2]);
          for (let k = 0; k < 3; k++) box(g, woodD, s2 * 0.6, 0.26, 0.05, 0.015, 0.42, 0.015, [k * PI / 3, 0, 0]);
        });
        box(g, woodD, -0.8, 0.85, -0.2, 0.36, 0.035, 0.035, [0, 0, 0.5]);
        // вёдра с цветами
        const buckets = [[-0.44, 'tulip'], [-0.15, 'aster'], [0.14, 'chamomile'], [0.43, 'hyacinth']];
        buckets.forEach(([x, id], i) => {
          put(g, GEO.pot, zinc, [x, 0.95, 0.02], [0.12, 0.24, 0.12]);
          const c = FLC(id).c, rr = rng(5 + i);
          for (let k = 0; k < 7; k++) sph(g, pm(k % 2 ? c : lighter(c, 0.3)), x + (rr() - 0.5) * 0.18, 1.16 + rr() * 0.1, 0.02 + (rr() - 0.5) * 0.16, 0.055);
          sph(g, pm('#8FBF86'), x, 1.1, 0.02, 0.12, 0.05, 0.1);
        });
        [[-0.3, 'lavender'], [0.3, 'pampas']].forEach(([x, id]) => { for (let k = 0; k < 3; k++) put(g, GEO.sph, pm(FLC(id).c), [x + (k - 1) * 0.05, 1.33, -0.14], [0.03, 0.12, 0.03]); });
        // полосатый тент на двух стойках
        [-1, 1].forEach(s2 => cyl(g, metal, s2 * 0.6, 1.4, -0.25, 0.022, 1.0));
        for (let i = 0; i < 6; i++) rbox(g, i % 2 ? stripeB : stripeA, -0.625 + i * 0.25, 1.92, -0.05, 0.25, 0.05, 0.75, 0.02, [0.28, 0, 0]);
        for (let i = 0; i < 6; i++) put(g, GEO.halfDisc, i % 2 ? stripeB : stripeA, [-0.625 + i * 0.25, 1.78, 0.32], [0.125, 0.02, 0.1], [PI / 2, 0, 0]);
        // табличка
        rbox(g, pm('#3E4C3F'), 0.0, 0.62, 0.34, 0.7, 0.26, 0.03, 0.02);
        return g;
      }

      const cart = buildCart();
      plane(cart, toon('#FFFFFF', { map: tex(SIGN.flowers) }), 0, 0.62, 0.357, 0.66, 0.23);
      cart.position.set(CART.x, 0, CART.z); scene.add(cart); bake(cart, 'spot:flowers');
      beeG = buildBee(); beeG.position.set(CART.x + 0.8, 1.35, CART.z + 0.4); beeG.userData.key = 'spot:flowers'; scene.add(beeG);

      /* --- пудель Пудра (собака кондитерской) и гусёнок, который считает Пудру мамой --- */
      poodle = null, gosling = null;
      if (LI >= 2) {
        poodle = new T.Group(); poodle.userData.key = 'poodle';
        const fur = toon('#F2C9A0'), furL = toon('#F8DCC0'), bowP = toon('#F2A9BE'), eyeP = keep(new T.MeshBasicMaterial({ color: 0x2E2A3B }));
        const pb = new T.Group(); poodle.add(pb);
        sph(pb, fur, 0, 0.13, 0, 0.07, 0.06, 0.1); sph(pb, furL, 0, 0.17, -0.07, 0.05);
        [[-0.035, 0.06], [0.035, 0.06], [-0.035, -0.06], [0.035, -0.06]].forEach(([x, z]) => { cyl(pb, fur, x, 0.05, z, 0.012, 0.1); sph(pb, furL, x, 0.012, z, 0.022); });
        sph(pb, furL, 0, 0.2, -0.11, 0.03);
        const ph = new T.Group(); ph.position.set(0, 0.22, 0.08); pb.add(ph);
        sph(ph, fur, 0, 0, 0, 0.055); sph(ph, furL, 0, 0.05, -0.005, 0.04); sph(ph, fur, 0, -0.015, 0.05, 0.028, 0.022, 0.03);
        [-1, 1].forEach(sd => { sph(ph, furL, sd * 0.05, -0.02, -0.005, 0.022, 0.045, 0.022); sph(ph, eyeP, sd * 0.02, 0.012, 0.048, 0.008); });
        sph(ph, toon('#3A2E3F'), 0, -0.012, 0.078, 0.008);
        [-1, 1].forEach(sd => sph(ph, bowP, sd * 0.022, 0.085, 0.0, 0.022, 0.014, 0.01));
        poodle.userData.body = pb; poodle.userData.head = ph;
        ph.userData.dyn = true; bake(pb); bake(ph);
        scene.add(poodle);
        gosling = new T.Group();
        const gy = toon('#F7D65A'), gb = toon('#F0A040');
        sph(gosling, gy, 0, 0.06, 0, 0.05, 0.045, 0.06); sph(gosling, gy, 0, 0.115, 0.04, 0.032);
        put(gosling, GEO.cone, gb, [0, 0.11, 0.075], [0.01, 0.025, 0.01], [PI / 2, 0, 0]);
        [-1, 1].forEach(sd => sph(gosling, keep(new T.MeshBasicMaterial({ color: 0x2E2A3B })), sd * 0.016, 0.125, 0.065, 0.006));
        bake(gosling, 'poodle');
        scene.add(gosling);
      }
      PLOOP = [[15.4, 0.2], [12.6, 1.6], [10.4, 0.4], [12.8, -0.4]];
      poodleT = 0, poodleFollow = 0, poodleSpin = -1, poodlePos = new T.Vector3(15.4, 0, 0.2), goslingPos = new T.Vector3(15.9, 0, 0.3), poodleTaps = 0;
      /* --- подсолнух у киоска: флюгер, а в конце смотрит на крышу --- */
      sunflower = new T.Group(); sunflower.position.set(8.9, 0, -0.8); sunflower.userData.key = 'sunflower'; scene.add(sunflower);
      put(sunflower, keep(new T.LatheGeometry([[0.001, 0], [0.12, 0], [0.15, 0.22], [0.16, 0.24], [0.001, 0.24]].map(([a, b]) => new T.Vector2(a, b)), 16)), toon(warmC('#C9A28A')));
      cyl(sunflower, toon('#7FA87A'), 0, 0.5, 0, 0.018, 0.55);
      [[-1, 0.42], [1, 0.55], [-1, 0.66]].forEach(([sd, y]) => sph(sunflower, toon('#8FB88A'), sd * 0.07, y, 0, 0.08, 0.018, 0.04, [0, 0, sd * 0.4]));
      const sfHead = new T.Group(); sfHead.position.set(0, 0.8, 0); sunflower.add(sfHead);
      cyl(sfHead, toon('#6B4A2E'), 0, 0, 0.0, 0.1, 0.035, [PI / 2, 0, 0]);
      const petalM = toon(warmC('#F5C542'));
      for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; put(sfHead, GEO.sph, petalM, [Math.cos(a) * 0.14, Math.sin(a) * 0.14, -0.005], [0.022, 0.055, 0.008], [0, 0, a - PI / 2]); }
      bake(sunflower, 'sunflower');
      /* --- лужа, в которой отражается пропавшее солнце --- */
      PS = { x: 18.2, z: 0.8, r: 0.6 };
      sunRefl = put(scene, keep(new T.CircleGeometry(0.11, 24)), keep(new T.MeshBasicMaterial({ color: 0xFFD45A, transparent: true, opacity: 0.9, depthWrite: false })), [PS.x - 0.08, 0.0095, PS.z - 0.05], null, [-PI / 2, 0, 0]);
      sunRefl.castShadow = false; sunRefl.userData.key = 'puddleSun';
      sunReflHalo = put(scene, GEO.plane, keep(new T.MeshBasicMaterial({ map: haloTex, color: 0xFFD45A, transparent: true, opacity: 0.55, depthWrite: false })), [PS.x - 0.08, 0.009, PS.z - 0.05], [0.5, 0.5, 1], [-PI / 2, 0, 0]);
      sunReflHalo.castShadow = false; sunReflHalo.userData.key = 'puddleSun';
      reflHideT = 0, psFirst = true, splashes = 0;
      // сумерки после кружения у фонаря
      const dusk = document.createElement('div');
      dusk.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .8s ease;background:linear-gradient(180deg,#5E4A8E 0%,#7B5EA7 18%,#C98AB8 30%,#F2A0B5 36%,rgba(242,160,181,0) 50%)';
      dusk.innerHTML = Array.from({ length: 16 }, (_, i) => `<i style="position:absolute;left:${(i * 37) % 100}%;top:${3 + (i * 13) % 26}%;width:3px;height:3px;border-radius:50%;background:#FFF6DE;box-shadow:0 0 6px #FFF6DE"></i>`).join('');
      root.insertBefore(dusk, canvas);
      duskFlash = () => { dusk.style.opacity = '1'; setTimeout(() => { dusk.style.opacity = '0'; }, 2200); const b0 = SM.bulb.color.clone(); SM.bulb.color.set('#FFD9A0'); setTimeout(() => SM.bulb.color.copy(b0), 2400); };

    }
    function buildBee(opt = {}) {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const y = pm('#FFD45E'), dk = pm(opt.stripe || '#4A3A48'), wing = keep(new T.MeshToonMaterial({ color: new T.Color('#EAF3FF'), gradientMap: GRAD, transparent: true, opacity: 0.8 }));
      sph(body, y, 0, 0, 0, 0.11, 0.1, 0.12);
      [-0.03, 0.035].forEach(zz => put(body, keep(new T.TorusGeometry(0.1, 0.018, 6, 20)), dk, [0, 0, zz], [1, 0.92, 1]));
      sph(body, y, 0, 0.11, 0.06, 0.085);
      sph(body, pm('#F6C6D0'), 0, -0.03, 0.09, 0.05, 0.04, 0.03);
      [-1, 1].forEach(s2 => { cyl(body, dk, s2 * 0.03, 0.2, 0.05, 0.006, 0.07, [0, 0, -s2 * 0.4]); sph(body, pm('#F08FA8'), s2 * 0.045, 0.235, 0.05, 0.016); sph(body, dk, s2 * 0.03, 0.125, 0.135, 0.012); });
      const wings = [-1, 1].map(s2 => { const w = new T.Group(); w.position.set(s2 * 0.05, 0.08, -0.02); body.add(w); put(w, GEO.sph, wing, [s2 * 0.07, 0.04, 0], [0.08, 0.05, 0.015], [0, 0, s2 * 0.5]); return w; });
      g.userData.wings = wings; g.userData.body = body;
      return g;
    }
    const spots0 = (o.spots || []).map(sp => Object.assign({}, sp));
    // мурчание кота
    const purrs = [];
    const purr = () => { for (let i = 0; i < 3; i++) { const m = put(scene, keep(new T.TorusGeometry(0.12, 0.008, 4, 24)), keep(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7, depthWrite: false })), [catX, 0.3, catZ], null, [PI / 2, 0, 0]); m.castShadow = false; purrs.push({ m, t: -i * 0.25 }); } };
    /* --- героиня (3D) --- */
    // Цвета 3D-героини по образу. Образ по умолчанию — ровно цвета рисунка автора (HERO.base),
    // берет — HERO.beretOf(бант): к розовому банту — бордовый берет с рисунка.
    function heroCols(lk) {
      const H = window.HERO, same = (a, b) => !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();
      const hair = lk.hair || '#4A3128', coat = lk.coat || '#E9D4B6', bw = lk.bow || '#F08FA8';
      if (!H || !H.base || !H.defaults) return { hair, tips: hair, coat, bow: bw, beret: shade(bw, -35), shoes: '#6B3A4F', tights: INK, skin: SKIN, skinD: '#EBC4AC' };
      const d = H.defaults, B0 = H.base, dh = same(hair, d.hair);
      return {
        hair: dh ? B0.hair : hair, tips: dh ? B0.hairTips : (H.tipsOf ? H.tipsOf(hair) : hair),   // кончики: по умолчанию в цвет волос (HERO.ombreOn — омбре)
        coat: same(coat, d.coat) ? B0.coat : coat, bow: same(bw, d.bow) ? B0.bow : bw,
        beret: H.beretOf ? H.beretOf(bw) : shade(bw, -35), shoes: B0.shoes || '#561A2F', tights: '#231C28',
        skin: H.skin || SKIN, skinD: '#EDC3AE',
      };
    }
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    function buildHero(hk, faceImg) {
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const mats = [], ol = [], C = heroCols(hk);
      const M = (c, x) => { const m = toon(c, x); mats.push(m); return m; };
      const P = (par, geo, mat, p, s, r, line = true) => { const m = put(par, geo, mat, p, s, r); m.receiveShadow = false; if (line) ol.push(m); return m; };
      // волосы — один материал с цветами вершин: корни → кончики без шва (кончики по умолчанию в цвет волос)
      const skin = M(C.skin), skinD = M(C.skinD), hair = M('#FFFFFF', { side: T.DoubleSide, vertexColors: true }),
        coat = M(C.coat), coatD = M(shade(C.coat, -16)), collar = M(shade(C.coat, -7), { side: T.DoubleSide }),
        beret = M(C.beret), beretD = M(shade(C.beret, -18)), bow = M(C.bow), bowD = M(shade(C.bow, -18)), tights = M(C.tights), shoe = M(C.shoes);
      // ноги: чёрные колготки, бордовые балетки
      const legGeo = keep(new T.CapsuleGeometry(0.031, 0.3, 4, 10));
      const legs = [-1, 1].map(s => {
        const pv = new T.Group(); pv.position.set(0.055 * s, 0.43, 0); body.add(pv);
        P(pv, legGeo, tights, [0, -0.19, 0]); P(pv, GEO.sph, shoe, [0, -0.392, 0.03], [0.046, 0.032, 0.079]);
        return pv;
      });
      // двубортный тренч: тонкая талия, лацканы, пояс с квадратной пряжкой, две колонки по три пуговицы
      const torso = new T.Group(); body.add(torso);
      const coatPts = [[0.001, 0.4], [0.205, 0.4], [0.215, 0.43], [0.19, 0.56], [0.155, 0.68], [0.122, 0.78], [0.13, 0.84], [0.148, 0.93], [0.152, 1.0], [0.142, 1.055], [0.1, 1.1], [0.05, 1.125], [0.001, 1.13]];
      P(torso, keep(new T.LatheGeometry(coatPts.map(([x, y]) => new T.Vector2(x, y)), 30)), coat, [0, 0, 0], [1, 1, 0.72]);
      const coatR = y => { for (let i = 2; i < coatPts.length; i++) { const [r0, y0] = coatPts[i - 1], [r1, y1] = coatPts[i]; if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0)); } return 0.001; };
      const onCoat = (x, y, off, back) => { const r = coatR(y), z = 0.72 * Math.sqrt(Math.max(0, r * r - x * x)) + off; return back ? -z : z; };
      const poly = pts => {   // ломаная, параметр t∈[0,1] по длине
        const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return t => { const d = t * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++; const k = (d - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
      };
      // накладка по форме пальто между краями A(t) и B(t) (сетка, чтобы не проваливалась внутрь)
      const patch = (A, B, n, m, off, back = false) => {
        const pos = [], idx = [];
        for (let i = 0; i <= n; i++) { const a = A(i / n), b = B(i / n); for (let j = 0; j <= m; j++) { const u = j / m, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u; pos.push(x, y, onCoat(x, y, off, back)); } }
        const a = A(0.5), b = B(0.5), c = A(0.5 + 1 / n), flip = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) === back;
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const q = i * (m + 1) + j; if (flip) idx.push(q, q + m + 1, q + 1, q + 1, q + m + 1, q + m + 2); else idx.push(q, q + 1, q + m + 1, q + 1, q + m + 2, q + m + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        return keep(g);
      };
      const mir = f => t => { const p = f(t); return [-p[0], p[1]]; };
      const grow = (f, k, c) => t => { const p = f(t); return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]; };
      const lapIn = t => { const u = 1 - t; return [u * u * 0.006 + 2 * u * t * 0.014 + t * t * 0.042, u * u * 0.872 + 2 * u * t * 0.99 + t * t * 1.086]; };
      const lapOut = poly([[0.006, 0.872], [0.07, 0.93], [0.13, 0.988], [0.106, 1.012], [0.121, 1.044], [0.084, 1.088]]);
      const lapC = [0.07, 0.98];
      [1, -1].forEach(s => {
        const A = s > 0 ? lapIn : mir(lapIn), Bq = s > 0 ? lapOut : mir(lapOut), cc = [lapC[0] * s, lapC[1]];
        P(torso, patch(grow(A, 1.08, cc), grow(Bq, 1.08, cc), 12, 6, 0.0035), coatD, null, null, null, false);   // кант лацкана
        P(torso, patch(A, Bq, 12, 6, 0.0065), collar, null, null, null, false);
      });
      P(torso, patch(t => [-0.044 * t, 1.02 + 0.1 * t], t => [0.044 * t, 1.02 + 0.1 * t], 5, 4, 0.002), skinD, null, null, null, false);   // вырез
      P(torso, keep(new T.CylinderGeometry(0.066, 0.132, 0.11, 22, 1, true, 0.55, PI * 2 - 1.1)), collar, [0, 1.085, 0], [1, 1, 0.76], null, false);
      P(torso, GEO.cyl, skinD, [0, 1.17, 0], [0.042, 0.14, 0.042], null, false);
      P(torso, keep(new T.TorusGeometry(0.124, 0.017, 8, 30)), coatD, [0, 0.78, 0], [1, 0.72, 1], [PI / 2, 0, 0], false);
      P(torso, keep(new T.TorusGeometry(0.021, 0.0055, 4, 4)), coatD, [0, 0.78, 0.1015], null, [0, 0, PI / 4]);   // пряжка-рамка
      [0.836, 0.72, 0.655].forEach(y => [-1, 1].forEach(s => { const x = 0.042 * s; P(torso, GEO.sphLo, coatD, [x, y, onCoat(x, y, 0.002)], [0.011, 0.011, 0.006], null, false); }));
      P(torso, patch(t => [0.0635, 0.765 - 0.36 * t], t => [0.0685, 0.765 - 0.36 * t], 8, 1, 0.0025), coatD, null, null, null, false);   // борт
      [-1, 1].forEach(s => P(torso, patch(t => [s * (0.098 + 0.014 * t), 0.665 - 0.07 * t], t => [s * (0.103 + 0.014 * t), 0.665 - 0.07 * t], 4, 1, 0.0025), coatD, null, null, null, false));   // карманы
      P(torso, patch(t => [-0.0025, 0.405 + 0.21 * t], t => [0.0025, 0.405 + 0.21 * t], 6, 1, 0.0025, true), coatD, null, null, null, false);   // шлица сзади
      // руки: рукава с манжетами-хлястиками
      const armGeo = keep(new T.CapsuleGeometry(0.037, 0.3, 4, 10)), cuffGeo = keep(new T.TorusGeometry(0.0392, 0.0075, 6, 18));
      const arms = [-1, 1].map(s => {
        const pv = new T.Group(); pv.position.set(0.16 * s, 1.04, 0); body.add(pv);
        const inner = new T.Group(); inner.rotation.z = 0.13 * s; pv.add(inner);
        P(inner, armGeo, coat, [0, -0.19, 0]); P(inner, cuffGeo, coat, [0, -0.322, 0], null, [PI / 2, 0, 0]);
        P(inner, GEO.box, coat, [0.039 * s, -0.322, 0], [0.012, 0.017, 0.034], null, false);
        P(inner, GEO.sph, skin, [0, -0.4, 0], [0.036, 0.038, 0.036]);
        return { pv, inner };
      });
      if (hk.cup) {
        const cg = new T.Group(); cg.position.set(0, -0.42, 0.045); arms[1].inner.add(cg);
        const white = M('#FFFFFF'), liq = M(hk.cup.liquid || '#D9B08C'), straw = M('#F08FA8');
        P(cg, keep(new T.CylinderGeometry(0.038, 0.03, 0.1, 16)), white, [0, 0, 0], null, null, false);
        P(cg, GEO.cyl, liq, [0, -0.005, 0], [0.0365, 0.05, 0.0365], null, false);
        P(cg, GEO.hemi, white, [0, 0.05, 0], [0.039, 0.02, 0.039], null, false);
        P(cg, GEO.cyl, straw, [0.012, 0.1, 0], [0.006, 0.09, 0.006], [0, 0, -0.25], false);
      }
      // волосы: длинные волнистые, расходятся книзу «трапецией» за плечами и руками; качается от шеи
      const CUR_Y = 1.42;
      const curtain = new T.Group(); curtain.position.set(0, CUR_Y, 0); body.add(curtain);
      const curGeo = (() => {
        const K = [[0.82, 0.35], [0.9, 0.326], [0.98, 0.306], [1.06, 0.292], [1.16, 0.284], [1.27, 0.29]];
        // у головы — сфера чуть больше шапки волос (тот же центр): сзади шапка прячется под ней, а выше 1.47 сама уходит под шапку — без шва и ступеньки
        const HC = 1.45, RC = 0.27 * 1.07 + 0.0045;   // = HR*1.07 + 4.5 мм (HR объявлен ниже)
        const rs = y => Math.sqrt(Math.max(0, RC * RC - (y - HC) * (y - HC))) * (1 - 0.12 * sstep(1.46, 1.6, y));
        const rb = y => {
          if (y <= K[0][0]) return K[0][1];
          if (y > K[K.length - 1][0]) return K[K.length - 1][1] + (rs(y) - K[K.length - 1][1]) * sstep(1.27, 1.37, y);
          for (let i = 1; i < K.length; i++) if (y <= K[i][0]) { const k = sstep(K[i - 1][0], K[i][0], y); return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * k; }
          return K[K.length - 1][1];
        };
        const pts = [[0.24, 0.798], [0.315, 0.784], [0.352, 0.8]];
        for (let i = 0; i <= 32; i++) { const y = 0.82 + i * (1.68 - 0.82) / 32, wv = 0.019 * Math.sin((1.3 - y) * 34) * Math.min(1, Math.max(0, (1.3 - y) / 0.14)); pts.push([rb(y) + wv, y]); }
        pts.push([0.03, 1.70]);
        const g = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 30, PI / 2 - 0.36, PI + 0.72), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const ph0 = Math.atan2(x, z), ph = ph0 >= 0 ? PI - (PI - ph0) * (1 + 0.05 * sstep(1.12, 1.32, y)) : -PI + (PI + ph0) * (1 + 0.05 * sstep(1.12, 1.32, y)), rr = Math.hypot(x, z) * (1 + (0.045 * Math.sin(ph * 9 + (1.3 - y) * 7) + 0.02 * Math.sin(ph * 17 - (1.3 - y) * 11)) * Math.min(1, Math.max(0, (1.3 - y) / 0.22)));
          const s = 0.42 + 0.58 * sstep(0.98, 1.36, y);
          y -= 0.03 * (0.5 + 0.5 * Math.sin(ph * 6.3 + 1.1)) * sstep(0.93, 0.8, y);   // кончики разной длины
          x = rr * Math.sin(ph); z = rr * Math.cos(ph) * s - 0.035 * (1 - s) / 0.58 - 0.005 * sstep(1.3, 1.4, y);
          p.setXYZ(i, x, y - CUR_Y, z);
        }
        g.computeVertexNormals();
        return keep(g);
      })();
      P(curtain, curGeo, hair);
      // голова и лицо
      const head = new T.Group(); head.position.set(0, 1.45, 0); body.add(head);
      const HR = 0.27;
      P(head, GEO.sph, skin, [0, 0, 0], [HR, HR * 1.02, HR * 0.96]);
      const faceGeo = keep(new T.SphereGeometry(HR * 1.012, 26, 18, PI / 2 - PI / 3, PI * 2 / 3, 50 * PI / 180, 85 * PI / 180));
      let faceOpen, faceClosed, faceMat;
      if (faceImg) {
        // лицо с рисунка автора: черты поверх кожи того же цвета, материал освещается как голова — без пятна
        faceOpen = tex(heroFaceDecal(faceImg.open, C.skin)); faceClosed = tex(heroFaceDecal(faceImg.closed, C.skin));
        faceMat = M('#FFFFFF', { map: faceOpen });
      } else {
        faceOpen = tex(heroFaceCanvas(false)); faceClosed = tex(heroFaceCanvas(true));
        faceMat = keep(new T.MeshBasicMaterial({ map: faceOpen, transparent: true, depthWrite: false }));
      }
      const face = put(head, faceGeo, faceMat, [0, 0, 0], [1, 1.02, 0.96]); face.castShadow = false; face.receiveShadow = false; face.renderOrder = 2;
      // шапка волос сзади: окно для лица — овал (у висков и скул шире, чем у макушки), а не прямой срез по меридиану
      const capGeo = (() => {
        const W = 40, Hs = 20, R = HR * 1.07, tM = PI * 0.745;
        const g = new T.SphereGeometry(R, W, Hs, PI / 2 + 1, PI * 2 - 2, 0, tM), p = g.attributes.position, nr = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const ix = i % (W + 1), iy = Math.floor(i / (W + 1)), th = tM * iy / Hs, e = 0.95 + 0.25 * sstep(0.6, 1.15, th) + 0.06 * sstep(1.55, 1.95, th), ph = PI / 2 + e + (PI * 2 - 2 * e) * ix / W;
          const x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
          p.setXYZ(i, x * R, y * R, z * R); nr.setXYZ(i, x, y, z);
        }
        return keep(g);
      })();
      P(head, capGeo, hair, [0, 0, -0.005]);
      // чёлка на прямой пробор: линия роста волос поднимается к пробору и опускается к вискам
      const fringeGeo = (() => {
        const W = 48, Hs = 10, R = HR * 1.075, p0 = PI / 2 - 1.3, pl = 2.6;
        const g = new T.SphereGeometry(R, W, Hs, p0, pl, 0, 1), p = g.attributes.position, nr = g.attributes.normal;
        const tmax = d => { const a = Math.abs(d); return 0.98 + 0.12 * a + 0.55 * sstep(0.7, 1.3, a) - 0.42 * Math.exp(-((a / 0.075) ** 2)); };
        for (let i = 0; i < p.count; i++) {
          const ix = i % (W + 1), iy = Math.floor(i / (W + 1)), ph = p0 + pl * ix / W, th = tmax(ph - PI / 2) * iy / Hs;
          const x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
          p.setXYZ(i, x * R, y * R, z * R); nr.setXYZ(i, x, y, z);
        }
        return keep(g);
      })();
      P(head, fringeGeo, hair, [0, 0, 0], [1, 1.02, 0.96]);
      // пряди у лица: от виска до плеча, волной наружу
      const lockGeo = (len, w0, w1, wave, ph0) => {
        const pts = [[0.001, -len]];
        for (let i = 14; i >= 0; i--) { const t = i / 14, r = (w0 + (w1 - w0) * t) * (t > 0.82 ? Math.sqrt(Math.max(0.02, (1 - t) / 0.18)) : 1); pts.push([r, -len * t]); }
        pts.push([0.001, 0.012]);
        const g = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 10), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = Math.min(1, Math.max(0, -y / len)); p.setX(i, p.getX(i) + wave * Math.sin(t * PI * 2.2 + ph0) * t); p.setZ(i, p.getZ(i) * 0.55); }
        g.computeVertexNormals();
        return keep(g);
      };
      const lockL = lockGeo(0.4, 0.042, 0.06, 0.022, 0), lockR = lockGeo(0.4, 0.042, 0.06, -0.022, 0);
      [-1, 1].forEach(s => P(head, s < 0 ? lockL : lockR, hair, [s * 0.242, 0.06, 0.04], null, [0.2, 0, s * 0.1]));
      // берет (группа прямо в голове на y≈0.235 — группу ищет ателье) и бант на нём
      const bg = new T.Group(); bg.position.set(0, 0.235, -0.02); bg.rotation.set(-0.14, 0, 0.17); head.add(bg);
      P(bg, GEO.sph, beret, [0.005, 0, 0], [0.322, 0.092, 0.312]);
      P(bg, keep(new T.TorusGeometry(0.255, 0.028, 8, 30)), beretD, [0, -0.035, 0], null, [PI / 2, 0, 0], false);
      P(bg, GEO.sph, beret, [0.035, 0.09, 0.0], [0.022, 0.034, 0.022], null, false);
      const bw = new T.Group(); bw.position.set(0.212, 0.128, 0.152); bw.rotation.set(0.05, 0.38, 0.3); bw.scale.setScalar(0.86); head.add(bw);
      [-1, 1].forEach(s => P(bw, GEO.sph, bow, [s * 0.06, 0.004, 0], [0.066, 0.045, 0.028], [0, 0, s * 0.38]));
      P(bw, GEO.sph, bowD, [0, 0, 0.006], [0.026, 0.026, 0.026], null, false);
      [-1, 1].forEach(s => P(bw, GEO.box, bowD, [s * 0.026, -0.062, -0.002], [0.024, 0.08, 0.01], [0, 0, s * 0.32], false));
      addOutlines(ol);
      rootG.updateMatrixWorld(true); bg.attach(bw);   // бант приколот к берету: прячется и сдвигается вместе с ним
      // диета вызовов отрисовки: каждая подвижная часть склеивается по материалам отдельно (лицо — само по себе)
      face.userData.dyn = true;
      const subs = [legs[0], legs[1], torso, arms[0].inner, arms[1].inner, curtain, head, bg];
      subs.forEach(g => { g.userData.dyn = true; });
      bake(body, null, { receive: false });
      subs.forEach(g => bake(g, null, { receive: false }));
      rootG.traverse(m => { if (m.isMesh && m.material === outlineMat) m.castShadow = false; });
      // доля «кончиков» в каждой вершине по высоте над землёй (в осях тела), цвет пересчитывается при смене образа
      rootG.updateMatrixWorld(true);
      const invB = new T.Matrix4().copy(body.matrixWorld).invert(), mm = new T.Matrix4(), v3 = new T.Vector3(), hairMs = [];
      rootG.traverse(m => {
        if (!m.isMesh || m.material !== hair) return;
        mm.multiplyMatrices(invB, m.matrixWorld);
        const p = m.geometry.attributes.position, w = new Float32Array(p.count), sh = new Float32Array(p.count);
        for (let i = 0; i < p.count; i++) {
          v3.fromBufferAttribute(p, i).applyMatrix4(mm); w[i] = sstep(1.08, 0.86, v3.y);
          // пряди на спине: мягкие светлые и тёмные полосы (сзади), к лицу сходят на нет
          const a = Math.atan2(v3.x, v3.z + 0.03), k = sstep(0.04, -0.1, v3.z) * sstep(1.36, 1.22, v3.y);
          sh[i] = 1 + k * (0.09 * Math.sin(a * 14 + (1.3 - v3.y) * 4) + 0.05 * Math.sin(a * 31 - (1.3 - v3.y) * 9));
        }
        if (!m.geometry.attributes.color) m.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(p.count * 3), 3));
        hairMs.push({ m, w, sh });
      });
      const ca = new T.Color(), cb = new T.Color();
      const paintHair = (h, tp) => {
        ca.set(h); cb.set(tp);
        hairMs.forEach(({ m, w, sh }) => { const c = m.geometry.attributes.color; for (let i = 0; i < w.length; i++) { const k = w[i], g = sh[i]; c.setXYZ(i, (ca.r + (cb.r - ca.r) * k) * g, (ca.g + (cb.g - ca.g) * k) * g, (ca.b + (cb.b - ca.b) * k) * g); } c.needsUpdate = true; });
      };
      paintHair(C.hair, C.tips);
      const parts = { hair, coat, coatD, collar, beret, beretD, bow, bowD };
      // смена образа вживую (ателье): только переданные части
      const setCols = (c, lk) => {
        if (lk.hair) paintHair(c.hair, c.tips);
        if (lk.coat) { coat.color.set(c.coat); coatD.color.set(shade(c.coat, -16)); collar.color.set(shade(c.coat, -7)); }
        if (lk.bow) { bow.color.set(c.bow); bowD.color.set(shade(c.bow, -18)); beret.color.set(c.beret); beretD.color.set(shade(c.beret, -18)); }
      };
      rootG.userData.key = 'hero';
      return { root: rootG, body, torso, head, beret: bg, legs, arms, curtain, faceMat, faceOpen, faceClosed, mats, parts, setCols };
    }

    /* --- героиня по модели автора: «статуэтка» --- */
    // Одна сетка (27 тыс. треугольников) с запечённой текстурой: вызов отрисовки, контур и тень вместо ~48.
    // Скелета нет, поэтому шаг игрушечный: в вершинном шейдере ноги ниже края пальто качаются, тело
    // переваливается; при посадке модель «складывается» в бедре и колене, руки ложатся на колени.
    // Части рисованной героини (голова, руки, берет, ноги) здесь пустые группы на тех же местах:
    // аксессуары и предметы цепляются к ним как раньше. Перекраски в ателье у модели пока нет (одна текстура).
    const HD_GLSL = `uniform float hdSwing;
uniform float hdSit;
uniform vec3 hdRig;
vec2 hdRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
void heroDeform(inout vec3 p, inout vec3 n) {
  float hem = hdRig.x, hip = hdRig.y, knee = hdRig.z;
  float wl = (1.0 - smoothstep(hem - 0.1, hem - 0.03, p.y)) * (1.0 - hdSit);
  if (wl > 0.0) {
    float a = hdSwing * clamp(p.x / 0.035, -1.0, 1.0) * wl;
    vec2 q = hdRot(vec2(p.y - hem, p.z), a);
    p.y = hem + q.x; p.z = q.y; n.yz = hdRot(n.yz, a);
  }
  if (hdSit > 0.0 && p.y < hip + 0.03) {
    float th = hdSit * 1.5707963;
    float wh = smoothstep(hip + 0.03, hip - 0.07, p.y), wk = smoothstep(knee + 0.04, knee - 0.04, p.y);
    vec2 a2 = hdRot(vec2(p.y - hip, p.z * (1.0 - 0.3 * hdSit * wh)), -th * wh), kq = hdRot(vec2(knee - hip, 0.0), -th);
    vec3 pa = vec3(p.x, hip + a2.x, a2.y), pb = vec3(p.x, hip + kq.x + (p.y - knee), kq.y + p.z);
    vec3 na = vec3(n.x, hdRot(n.yz, -th * wh));
    p = mix(pa, pb, wk); n = normalize(mix(na, n, wk));
  }
}
`;
    const sst = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    // то же «складывание», что в шейдере, — для точек-якорей (кисти): предмет в руке едет вместе с ней
    const heroDeformPt = (out, p, U) => {
      const R = U.hdRig.value, sit = U.hdSit.value;
      out.copy(p);
      if (sit > 0 && p.y < R.y + 0.03) {
        const th = sit * PI / 2, wh = sst(R.y + 0.03, R.y - 0.07, p.y), a = -th * wh, dy = p.y - R.y, z = p.z * (1 - 0.3 * sit * wh), c = Math.cos(a), s2 = Math.sin(a);
        out.y = R.y + dy * c - z * s2; out.z = dy * s2 + z * c;
      }
      return out;
    };
    const heroDeformPatch = (mat, U, tag) => {
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = HD_GLSL + sh.vertexShader
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);\n{ vec3 hdP = vec3(position); heroDeform(hdP, objectNormal); }')
          .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\n{ vec3 hdN = vec3(0.0, 1.0, 0.0); heroDeform(transformed, hdN); }');
      };
      mat.customProgramCacheKey = () => 'heroDeform' + tag;
      return mat;
    };
    // нормали для контура: усреднённые по совпадающим вершинам (на швах UV и жёстких рёбрах контур без щелей)
    function heroOutlineNormals(g) {
      if (g.userData.olNormal) return g.userData.olNormal;
      const p = g.attributes.position, n = g.attributes.normal, map = new Map(), acc = [];
      const ids = new Int32Array(p.count);
      for (let i = 0; i < p.count; i++) {
        const k = Math.round(p.getX(i) * 2e3) + ',' + Math.round(p.getY(i) * 2e3) + ',' + Math.round(p.getZ(i) * 2e3);
        let id = map.get(k); if (id === undefined) { id = acc.length / 3; map.set(k, id); acc.push(0, 0, 0); }
        ids[i] = id; acc[id * 3] += n.getX(i); acc[id * 3 + 1] += n.getY(i); acc[id * 3 + 2] += n.getZ(i);
      }
      const out = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const j = ids[i] * 3, l = Math.hypot(acc[j], acc[j + 1], acc[j + 2]) || 1; out[i * 3] = acc[j] / l; out[i * 3 + 1] = acc[j + 1] / l; out[i * 3 + 2] = acc[j + 2] / l; }
      g.setAttribute('olNormal', new T.BufferAttribute(out, 3));
      return (g.userData.olNormal = true);
    }
    // свет модели: мультяшная рампа города, но мягче — в текстуре уже запечены объём и тени складок
    const GV3 = [150, 150, 152, 156, 172, 190, 200, 206, 214, 228, 240, 246, 255, 255, 255, 255];
    let GRAD3 = null;
    const heroLookMode = () => { try { return (/debug=1/.test(location.search) && window.HERO3D_LOOK) || 'soft'; } catch (e) { return 'soft'; } };
    // материал модели (статуэтка и скелетная героиня одинаковы)
    function heroToonMat(map) {
      // игра рисует без перевода цвета (цвета в коде = цвета на экране), поэтому и текстура — «как есть», без sRGB
      map.encoding = T.LinearEncoding; map.anisotropy = 4; map.needsUpdate = true;
      const mode = heroLookMode();
      if (!GRAD3 && mode === 'soft') {
        const d3 = new Uint8Array(64); GV3.forEach((v, i) => d3.set([v, v, v, 255], i * 4));
        GRAD3 = keep(new T.DataTexture(d3, 16, 1, T.RGBAFormat)); GRAD3.minFilter = GRAD3.magFilter = T.LinearFilter; GRAD3.generateMipmaps = false; GRAD3.needsUpdate = true;
      }
      return mode === 'lambert' ? keep(new T.MeshLambertMaterial({ map })) : keep(new T.MeshToonMaterial({ map, color: 0xFFFFFF, gradientMap: mode === 'soft' ? GRAD3 : GRAD }));
    }
    /* --- героиня по модели автора со скелетом (tools/rig_heroine.py + js/hero_anim.js) ---
       Та же сетка и текстура, что у статуэтки, но кости: шаг и бег с IK стоп, посадка, «помахать» свободной левой,
       «ура», предметы в руке. Вызовы отрисовки те же (сетка + контур + тень). Не вышло — статуэтка. */
    const HERO_RIG_OFF = () => { try { return !!window.HERO3D_NORIG; } catch (e) { return false; } };
    function buildHeroRig(hk, H3) {
      if (!H3.rig || !window.HeroAnim || !H3.geometry.attributes.skinIndex || HERO_RIG_OFF()) return null;
      const A = (window.HERO3D && HERO3D.anchors) || {};
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const mat = heroToonMat(H3.map);
      const RB = H3.rig.bones, J = {}, bones = RB.map(b => { const o = new T.Bone(); o.name = b[0]; J[b[0]] = b[2]; return o; });
      RB.forEach((b, i) => { const p = b[1] >= 0 ? RB[b[1]][2] : [0, 0, 0]; bones[i].position.set(b[2][0] - p[0], b[2][1] - p[1], b[2][2] - p[2]); if (b[1] >= 0) bones[b[1]].add(bones[i]); });
      const mesh = new T.SkinnedMesh(H3.geometry, mat); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
      RB.forEach((b, i) => { if (b[1] < 0) mesh.add(bones[i]); });
      body.add(mesh); rootG.updateMatrixWorld(true);
      const skeleton = new T.Skeleton(bones); mesh.bind(skeleton);
      const anim = window.HeroAnim.create(mesh);
      if (!anim) return null;
      // тап по героине: дешёвая проверка по коробке позы покоя (а не 28 тыс. треугольников со скином)
      if (!H3.geometry.boundingBox) H3.geometry.computeBoundingBox();
      const hb = H3.geometry.boundingBox.clone(), hbW = new T.Box3(), hitV = new T.Vector3();
      mesh.raycast = (rc, out) => { hbW.copy(hb).applyMatrix4(mesh.matrixWorld); if (rc.ray.intersectBox(hbW, hitV)) { const d = rc.ray.origin.distanceTo(hitV); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hitV.clone(), object: mesh }); } };
      // контур — вывернутая оболочка на том же скелете
      let outline = null;
      if (!(window.HERO3D_NOOUTLINE && /debug=1/.test(location.search))) {
        heroOutlineNormals(H3.geometry);
        const olMat = keep(new T.ShaderMaterial({
          uniforms: { thick: { value: 0.00085 }, col: { value: new T.Color('#4A3A48') } },
          vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nattribute vec3 olNormal;\nvoid main(){\n vec3 objectNormal = olNormal;\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
          side: T.BackSide,
        }));
        outline = new T.SkinnedMesh(H3.geometry, olMat); outline.castShadow = false; outline.receiveShadow = false; outline.userData.outline = true; outline.frustumCulled = false;
        outline.raycast = () => {};
        body.add(outline); outline.bind(skeleton, mesh.bindMatrix);
      }
      // пустые части на местах рисованной героини — теперь на костях: шапки ездят с головой, предмет — с кистью
      const at = (bn, p) => { const g = new T.Group(), j = J[bn]; g.position.set(p[0] - j[0], p[1] - j[1], p[2] - j[2]); anim.bones[bn].add(g); return g; };
      const torso = at('chest', J.chest);
      const curtain = at('hair', J.hair);
      const head = at('head', A.head || [0, 1.5, -0.09]);
      const bg = new T.Group(); bg.position.set(0, 0.235, -0.02); head.add(bg);   // «берет»: ателье прячет его на время шапки
      const legs = ['shin_L', 'shin_R'].map(n => at(n, J[n]));
      const hand = (bn, p) => { const pv = at(bn, p); pv.userData.p0 = pv.position.clone(); const inner = new T.Group(); pv.add(inner); return { pv, inner }; };
      // arms[0] — свободная рука (левая у героини): в неё setHeld кладёт букет, стакан, находку; в правой лупа
      const arms = [hand('hand_L', A.handFree || [0.21, 0.71, 0]), hand('hand_R', A.handMag || [-0.21, 0.73, 0])];
      rootG.userData.key = 'hero';
      return {
        root: rootG, body, torso, head, beret: bg, legs, arms, curtain,
        faceMat: { map: null, opacity: 1 }, faceOpen: null, faceClosed: null,
        mats: [mat], parts: {}, setCols: () => {},
        rig: { anim, mesh, outline, skeleton, hip: (J.thigh_L || [0, 0.8])[1], seat: 0.12, sit: 0, seatY: 0, cap: 0, spd: 0, step: 0, prev: null, q: new T.Quaternion(), qa: new T.Quaternion() },
      };
    }
    function buildHeroGLB(hk, H3) {
      const A = (window.HERO3D && HERO3D.anchors) || {};
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const U = { hdSwing: { value: 0 }, hdSit: { value: 0 }, hdRig: { value: new T.Vector3(A.hem || 0.54, A.hip || 0.8, A.knee || 0.45) } };
      const mat = heroToonMat(H3.map);
      heroDeformPatch(mat, U, 'm');
      const mesh = new T.Mesh(H3.geometry, mat); mesh.castShadow = true; mesh.receiveShadow = false;
      mesh.customDepthMaterial = heroDeformPatch(keep(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking })), U, 'd');
      body.add(mesh);
      // контур (вывернутая оболочка) с той же деформацией
      let outline = null;
      if (!(window.HERO3D_NOOUTLINE && /debug=1/.test(location.search))) {
        heroOutlineNormals(H3.geometry);
        const olMat = keep(new T.ShaderMaterial({
          uniforms: Object.assign({ thick: { value: 0.00085 }, col: { value: new T.Color('#4A3A48') } }, U),
          vertexShader: HD_GLSL + 'uniform float thick;\nattribute vec3 olNormal;\nvoid main(){ vec3 p = position; vec3 n = olNormal; heroDeform(p, n); vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 nn = normalize(normalMatrix * n); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
          side: T.BackSide,
        }));
        outline = new T.Mesh(H3.geometry, olMat); outline.castShadow = false; outline.receiveShadow = false; outline.userData.outline = true;
        outline.raycast = () => {};
        body.add(outline);
      }
      // пустые части на местах рисованной героини
      const torso = new T.Group(); body.add(torso);
      const curtain = new T.Group(); curtain.position.set(0, 1.42, 0); body.add(curtain);
      const head = new T.Group(); head.position.fromArray(A.head || [0, 1.5, -0.09]); body.add(head);
      const bg = new T.Group(); bg.position.set(0, 0.235, -0.02); head.add(bg);   // «берет»: ателье прячет его на время шапки
      const legs = [-1, 1].map(s => { const g = new T.Group(); g.position.set(0.055 * s, 0.43, 0); body.add(g); return g; });
      const hand = p => { const pv = new T.Group(); pv.position.fromArray(p); pv.userData.p0 = new T.Vector3().fromArray(p); body.add(pv); const inner = new T.Group(); pv.add(inner); return { pv, inner }; };
      // arms[0] — свободная рука (левая у героини): в неё setHeld кладёт букет, стакан, находку; в правой лупа
      const arms = [hand(A.handFree || [0.21, 0.71, 0]), hand(A.handMag || [-0.21, 0.73, 0])];
      rootG.userData.key = 'hero';
      return {
        root: rootG, body, torso, head, beret: bg, legs, arms, curtain,
        faceMat: { map: null, opacity: 1 }, faceOpen: null, faceClosed: null,   // лицо в текстуре: моргание — со вставкой век (позже)
        mats: [mat], parts: {}, setCols: () => {},
        statue: { U, mesh, outline, sit: 0, head0: head.position.clone(), tmp: new T.Vector3() },
      };
    }

    /* --- кот Пирожок (3D) --- */
    function buildCat() {
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const ol = [];
      const P = (par, geo, mat, p, s, r, line = true) => { const m = put(par, geo, mat, p, s, r); m.receiveShadow = false; if (line) ol.push(m); return m; };
      const fur = toon('#F0B36A'), furD = toon('#D9934A'), belly = toon('#FFE9CB'), pinkM = toon('#F7B9C4'), hatM = toon('#927F6B'), hatD = toon('#7D6B5A'), band = toon('#5E4F42');
      P(body, GEO.sph, fur, [0, 0.16, 0], [0.15, 0.14, 0.17]);
      P(body, GEO.sph, belly, [0, 0.15, 0.1], [0.09, 0.095, 0.07], null, false);
      const paws = [[-0.07, 0.11], [0.07, 0.11], [-0.075, -0.1], [0.075, -0.1]].map(([x, z]) => P(body, GEO.sph, fur, [x, 0.035, z], [0.045, 0.035, 0.055]));
      const head = new T.Group(); head.position.set(0, 0.36, 0.06); body.add(head);
      P(head, GEO.sph, fur, [0, 0, 0], [0.15, 0.14, 0.14]);
      const faceOpen = tex(catFaceCanvas(false)), faceClosed = tex(catFaceCanvas(true));
      const faceMat = keep(new T.MeshBasicMaterial({ map: faceOpen, transparent: true, depthWrite: false }));
      const face = put(head, keep(new T.SphereGeometry(1.012, 24, 18, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180)), faceMat, [0, 0, 0], [0.15, 0.14, 0.14]);
      face.castShadow = false; face.receiveShadow = false; face.renderOrder = 2;
      [-1, 1].forEach(s => { P(head, GEO.cone, fur, [s * 0.095, 0.115, 0], [0.052, 0.1, 0.04], [0, 0, -s * 0.38]); P(head, GEO.cone, pinkM, [s * 0.093, 0.11, 0.02], [0.03, 0.065, 0.02], [0, 0, -s * 0.38], false); });
      const hg = new T.Group(); hg.position.set(0, 0.145, 0); hg.rotation.z = -0.25; head.add(hg);
      P(hg, GEO.cyl, hatD, [0, 0, 0], [0.105, 0.014, 0.105]);
      P(hg, keep(new T.CylinderGeometry(0.06, 0.07, 0.08, 18)), hatM, [0, 0.045, 0]);
      P(hg, GEO.cyl, band, [0, 0.015, 0], [0.071, 0.02, 0.071], null, false);
      const tail = new T.Group(); tail.position.set(0, 0.17, -0.15); body.add(tail);
      const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.03, 0.08, -0.08), new T.Vector3(0.08, 0.2, -0.1), new T.Vector3(0.05, 0.3, -0.05)]);
      P(tail, keep(new T.TubeGeometry(curve, 16, 0.03, 8)), fur);
      P(tail, GEO.sph, furD, [0.05, 0.3, -0.05], [0.032, 0.032, 0.032], null, false);
      addOutlines(ol);
      // та же диета: туловище, голова, шляпа (шляпу ищут как группу в голове), хвост; лапки двигаются по одной
      face.userData.dyn = true; paws.forEach(p => { p.userData.dyn = true; });
      [head, hg, tail].forEach(g => { g.userData.dyn = true; });
      bake(body, null, { receive: false }); bake(head, null, { receive: false }); bake(hg, null, { receive: false }); bake(tail, null, { receive: false });
      rootG.traverse(m => { if (m.isMesh && m.material === outlineMat) m.castShadow = false; });
      rootG.userData.key = 'cat';
      return { root: rootG, body, head, tail, paws, faceMat, faceOpen, faceClosed };
    }

    /* --- голуби (3D) --- */
    const PG = { body: toon('#9EA3B8'), dark: toon('#878CA3'), neck: toon('#7FA38F'), beak: toon('#E6A15A'), leg: toon('#E58C8C'), eye: keep(new T.MeshBasicMaterial({ color: 0x2A2430 })) };
    function buildPigeon(oneLeg) {
      const g = new T.Group();
      sph(g, PG.body, 0, 0.1, 0, 0.07, 0.065, 0.1);
      sph(g, PG.body, 0, 0.115, 0.055, 0.055, 0.055, 0.05);
      sph(g, PG.neck, 0, 0.15, 0.06, 0.042, 0.032, 0.042);
      const head = new T.Group(); head.position.set(0, 0.19, 0.07); head.userData.dyn = true; g.add(head);
      sph(head, PG.body, 0, 0, 0, 0.04);
      [-1, 1].forEach(s => sph(head, PG.eye, s * 0.028, 0.01, 0.02, 0.008).castShadow = false);
      put(head, GEO.cone, PG.beak, [0, -0.005, 0.048], [0.011, 0.03, 0.011], [PI / 2, 0, 0]);
      const wings = [-1, 1].map(s => { const w = new T.Group(); w.position.set(s * 0.06, 0.12, 0); w.userData.dyn = true; g.add(w); sph(w, PG.dark, s * 0.015, 0, -0.02, 0.025, 0.05, 0.085); return w; });
      box(g, PG.dark, 0, 0.1, -0.12, 0.07, 0.015, 0.08, [-0.3, 0, 0]);
      (oneLeg ? [0] : [-0.025, 0.025]).forEach(x => cyl(g, PG.leg, x, 0.025, 0, 0.007, 0.05));
      bake(g);
      return { g, head, wings };
    }

    /* --- жители (3D): енот, гусь, лиса, попугай, сова, зайка, ёжик — как в 2D-сценах --- */
    const FACEG = keep(new T.SphereGeometry(1.012, 24, 18, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180));
    const capG = (r, l) => keep(new T.CapsuleGeometry(r, l, 4, 10));
    function npcMake(id, build) {
      const root = new T.Group(), body = new T.Group(); root.add(body); root.userData.key = 'npc:' + id;
      const ol = [];
      const P = (par, geo, mat, p, sc, r, line = true) => { const m = put(par, geo, mat, p, sc, r); m.receiveShadow = false; if (line) ol.push(m); return m; };
      const n = { id, root, body, head: null, ph: Math.random() * 6, hopT: -1, blinkT: 1 + Math.random() * 2, closed: false, look: 0 };
      const face = (head, f, sc) => {
        const fo = tex(animalFaceCanvas(f, false)), fc = tex(animalFaceCanvas(f, true));
        const fm = keep(new T.MeshBasicMaterial({ map: fo, transparent: true, depthWrite: false }));
        const m = put(head, FACEG, fm, [0, 0, 0], sc); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.userData.dyn = true;
        n.faceMat = fm; n.faceOpen = fo; n.faceClosed = fc; return m;
      };
      build({ n, root, body, P, face, M: (c, x) => toon(c, x) });
      addOutlines(ol);
      const dynG = [n.head, n.tail, n.neck, n.popcorn].concat(n.ears || [], n.needles || []).filter(Boolean);
      dynG.forEach(g => { g.userData.dyn = true; });
      bake(body, null, { receive: false });
      dynG.forEach(g => bake(g, null, { receive: false, cast: false }));
      n.hop = () => { n.hopT = 0; };
      n.anim = (t, dt, hx, hz) => {
        let hop = 0; if (n.hopT >= 0) { n.hopT += dt; hop = Math.sin(Math.min(1, n.hopT / 0.42) * PI) * 0.12; if (n.hopT > 0.42) n.hopT = -1; }
        n.body.position.y = hop + (n.bob ? Math.abs(Math.sin(t * 9)) * 0.03 : 0);
        n.body.scale.y = 1 + Math.sin(t * 2.2 + n.ph) * 0.014;
        n.blinkT -= dt; if (n.blinkT <= 0 && n.faceMat) { n.closed = !n.closed; n.faceMat.map = n.closed ? n.faceClosed : n.faceOpen; n.blinkT = n.closed ? (n.blinkSlow ? 0.6 : 0.13) : 2.2 + Math.random() * 3; }
        if (n.head) {
          const wx = n.root.position.x, wz = n.root.position.z, d = Math.hypot(hx - wx, hz - wz);
          let yaw = 0; if (d < 3.4 && !n.noLook) { yaw = angDiff(Math.atan2(hx - wx, hz - wz), n.root.rotation.y); yaw = Math.max(-0.9, Math.min(0.9, yaw)); }
          n.look += (yaw - n.look) * Math.min(1, dt * 4); n.head.rotation.y = n.look;
          n.head.rotation.z = Math.sin(t * 0.8 + n.ph) * 0.05;
        }
        if (n.extra) n.extra(t, dt);
      };
      return n;
    }
    const NPC = {
      raccoon: () => npcMake('raccoon', ({ n, body, P, face, M }) => {
        const g = M('#9AA1AB'), gd = M('#6E7480'), lt = M('#E7E9EC'), cap = M('#C2405B'), capD = M('#9E2F47');
        P(body, GEO.sph, g, [0, 0.42, 0], [0.26, 0.28, 0.23]); P(body, GEO.sph, lt, [0, 0.4, 0.13], [0.15, 0.17, 0.11], null, false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, gd, [sd * 0.11, 0.07, 0.05], [0.08, 0.06, 0.1]); P(body, capG(0.05, 0.14), g, [sd * 0.24, 0.46, 0.06], null, [0.3, 0, sd * 0.55]); });
        const tail = new T.Group(); tail.position.set(0.05, 0.28, -0.2); body.add(tail); n.tail = tail;
        [[0, 0, 0], [0.06, 0.08, -0.09], [0.13, 0.18, -0.14], [0.18, 0.3, -0.15], [0.2, 0.42, -0.12]].forEach(([x, y, z], i) => P(tail, GEO.sph, i % 2 ? gd : g, [x, y, z], [0.085, 0.085, 0.085]));
        const head = new T.Group(); head.position.set(0, 0.9, 0.02); body.add(head); n.head = head;
        P(head, GEO.sph, g, [0, 0, 0], [0.25, 0.23, 0.23]);
        face(head, { mask: '#454B55', muzzle: '#EEF0F2', nose: '#2E2A3B', mouth: 'w', ey: 352 }, [0.25, 0.23, 0.23]);
        [-1, 1].forEach(sd => { P(head, GEO.cone, g, [sd * 0.15, 0.2, -0.03], [0.07, 0.12, 0.05], [0, 0, -sd * 0.4]); P(head, GEO.cone, gd, [sd * 0.148, 0.19, -0.005], [0.04, 0.07, 0.02], [0, 0, -sd * 0.4], false); });
        const cg = new T.Group(); cg.position.set(0, 0.17, -0.01); cg.rotation.set(-0.15, 0, 0.12); head.add(cg);
        P(cg, GEO.hemi, cap, [0, 0, 0], [0.2, 0.12, 0.2]); P(cg, GEO.box, capD, [0, 0.005, 0.17], [0.24, 0.03, 0.14], [0.1, 0, 0], false);
        n.extra = t => { tail.rotation.z = Math.sin(t * 2.4 + n.ph) * 0.15; };
      }),
      goose: (opt = {}) => npcMake('goose', ({ n, body, P, face, M }) => {
        const w = M('#F7F5F1'), wd = M('#E4DED8'), beak = M('#F29A38'), cup = M('#FFFDF9'), stripe = M('#E2405E'), corn = M('#FFF3C4');
        if (!opt.headOnly) {
          P(body, GEO.sph, w, [0, 0.32, -0.04], [0.2, 0.17, 0.27]); P(body, GEO.cone, w, [0, 0.38, -0.32], [0.08, 0.14, 0.06], [-1.9, 0, 0]);
          [-1, 1].forEach(sd => { P(body, GEO.sph, wd, [sd * 0.17, 0.35, -0.06], [0.05, 0.11, 0.2], null, false); P(body, GEO.cyl, beak, [sd * 0.07, 0.08, 0], [0.014, 0.16, 0.014], null, false); P(body, GEO.sph, beak, [sd * 0.07, 0.012, 0.04], [0.05, 0.012, 0.07], null, false); });
        }
        const neck = P(body, capG(0.055, 0.3), w, [0, 0.6, 0.12], null, [0.18, 0, 0]); neck.userData.dyn = true;
        const head = new T.Group(); head.position.set(0, 0.84, 0.17); body.add(head); n.head = head;
        P(head, GEO.sph, w, [0, 0, 0], [0.105, 0.1, 0.11]);
        face(head, { er: 40, ex: 100, ey: 330, noBlush: false }, [0.105, 0.1, 0.11]);
        P(head, GEO.cone, beak, [0, -0.02, 0.13], [0.035, 0.1, 0.028], [PI / 2, 0, 0]);
        // ведёрко попкорна под крылом
        const pc = new T.Group(); pc.position.set(0.21, 0.3, 0.1); body.add(pc); n.popcorn = pc; pc.visible = opt.popcorn !== false && !opt.headOnly;
        P(pc, keep(new T.CylinderGeometry(0.075, 0.058, 0.16, 14)), cup, [0, 0, 0]);
        [-0.045, 0, 0.045].forEach(a => P(pc, GEO.box, stripe, [Math.sin(a * 9) * 0.07, 0, Math.cos(a * 9) * 0.07], [0.018, 0.16, 0.01], [0, a * 9, 0], false));
        [[0, 0.1, 0], [0.04, 0.09, 0.03], [-0.04, 0.09, -0.02], [0.02, 0.11, -0.04], [-0.03, 0.1, 0.04]].forEach(q => P(pc, GEO.sphLo, corn, q, [0.032, 0.03, 0.032], null, false));
        n.extra = t => { neck.rotation.x = 0.18 + Math.sin(t * 1.6 + n.ph) * 0.05; };
      }),
      fox: () => npcMake('fox', ({ n, body, P, face, M }) => {
        const o1 = M('#F39A55'), o2 = M('#F08A45'), cr = M('#FFF3E6'), dk = M('#4A3A44'), sc = M('#B9A5E8'), scD = M('#A08CDB'), gl = M('#5B4A3E');
        P(body, GEO.sph, o1, [0, 0.42, 0], [0.24, 0.3, 0.22]); P(body, GEO.sph, cr, [0, 0.38, 0.13], [0.13, 0.19, 0.1], null, false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, dk, [sd * 0.1, 0.07, 0.05], [0.075, 0.06, 0.1]); P(body, capG(0.048, 0.14), o1, [sd * 0.22, 0.48, 0.06], null, [0.3, 0, sd * 0.5]); });
        P(body, keep(new T.TorusGeometry(0.17, 0.05, 8, 22)), sc, [0, 0.68, 0.01], [1, 1, 0.9], [PI / 2 - 0.15, 0, 0], false); P(body, GEO.box, scD, [0.08, 0.5, 0.17], [0.07, 0.2, 0.03], [0.1, 0, -0.2], false);
        const tail = new T.Group(); tail.position.set(0.1, 0.25, -0.18); body.add(tail); n.tail = tail;
        P(tail, GEO.sph, o2, [0.1, 0.12, -0.12], [0.12, 0.24, 0.12], [0.4, 0, -0.6]); P(tail, GEO.sph, cr, [0.22, 0.3, -0.2], [0.07, 0.09, 0.07], null, false);
        const head = new T.Group(); head.position.set(0, 0.92, 0.02); body.add(head); n.head = head;
        P(head, GEO.sph, o1, [0, 0, 0], [0.24, 0.22, 0.22]);
        face(head, { muzzle: '#FFF3E6', muzzleW: 120, muzzleH: 74, nose: '#2E2A3B', mouth: 'w', ey: 350 }, [0.24, 0.22, 0.22]);
        [-1, 1].forEach(sd => { P(head, GEO.cone, o2, [sd * 0.13, 0.22, -0.03], [0.07, 0.17, 0.05], [0, 0, -sd * 0.3]); P(head, GEO.cone, dk, [sd * 0.145, 0.27, -0.02], [0.035, 0.07, 0.03], [0, 0, -sd * 0.3], false);
          P(head, ringG(0.055, 0.009), gl, [sd * 0.085, -0.02, 0.215], null, [0, sd * 0.35, 0], false); });
        n.extra = t => { tail.rotation.y = Math.sin(t * 1.8 + n.ph) * 0.25; };
      }),
      parrot: () => npcMake('parrot', ({ n, body, P, face, M }) => {
        const g = M('#58C08A'), gd = M('#3E9E6E'), gl = M('#B9EBC9'), y = M('#F5B940'), yd = M('#E09A28'), red = M('#E2405E'), leg = M('#E8A53C');
        P(body, GEO.sph, g, [0, 0.38, 0], [0.2, 0.26, 0.19]); P(body, GEO.sph, gl, [0, 0.35, 0.11], [0.12, 0.17, 0.09], null, false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, gd, [sd * 0.18, 0.38, -0.02], [0.05, 0.18, 0.12], [0, 0, sd * 0.15]); P(body, GEO.cyl, leg, [sd * 0.06, 0.07, 0.02], [0.014, 0.14, 0.014], null, false); });
        P(body, GEO.box, gd, [0, 0.16, -0.17], [0.09, 0.26, 0.03], [-0.5, 0, 0]);
        P(body, GEO.cone, red, [0, 0.55, 0.17], [0.045, 0.07, 0.02], [PI, 0, 0], false); P(body, GEO.sphLo, red, [0, 0.6, 0.175], [0.03, 0.025, 0.02], null, false);
        const head = new T.Group(); head.position.set(0, 0.8, 0.02); body.add(head); n.head = head;
        P(head, GEO.sph, g, [0, 0, 0], [0.2, 0.19, 0.19]);
        face(head, { white: true, er: 30, ex: 84, ey: 330 }, [0.2, 0.19, 0.19]);
        P(head, GEO.cone, y, [0, -0.04, 0.2], [0.05, 0.1, 0.05], [PI / 2 + 0.6, 0, 0]); P(head, GEO.sphLo, yd, [0, -0.08, 0.17], [0.035, 0.025, 0.03], null, false);
        [[-0.03, 0.2, -0.02, 0.25], [0.02, 0.22, -0.05, -0.1], [0.06, 0.19, -0.04, -0.4]].forEach(([x, yy, z, r]) => P(head, capG(0.018, 0.08), g, [x, yy, z], null, [-0.4, 0, r], false));
        n.bobHead = true;
        n.extra = t => { head.position.y = 0.8 + Math.max(0, Math.sin(t * 1.3 + n.ph)) * 0.025; };
      }),
      owl: () => npcMake('owl', ({ n, body, P, face, M }) => {
        const b = M('#A98A72'), bd = M('#8A6B57'), cr = M('#F2E2CC'), beak = M('#F2A54A'), gold = M('#E8C770', { emissive: new T.Color('#C9A040'), emissiveIntensity: 0.15 });
        P(body, GEO.sph, b, [0, 0.36, 0], [0.26, 0.3, 0.24]); P(body, GEO.sph, cr, [0, 0.33, 0.13], [0.16, 0.2, 0.11], null, false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, bd, [sd * 0.24, 0.36, -0.02], [0.06, 0.2, 0.15], [0, 0, sd * 0.12]); P(body, GEO.sph, beak, [sd * 0.07, 0.06, 0.08], [0.05, 0.03, 0.06], null, false); });
        const head = new T.Group(); head.position.set(0, 0.76, 0.01); body.add(head); n.head = head;
        P(head, GEO.sph, b, [0, 0, 0], [0.25, 0.22, 0.22]);
        face(head, { disc: '#F2E2CC', white: true, er: 32, ex: 88, ey: 330, nose: '#F2A54A', noseW: 14, noseH: 22 }, [0.25, 0.22, 0.22]);
        [-1, 1].forEach(sd => P(head, GEO.cone, bd, [sd * 0.16, 0.2, -0.02], [0.05, 0.13, 0.04], [0, 0, -sd * 0.35]));
        P(head, ringG(0.06, 0.01), gold, [0.085, -0.01, 0.215], null, [0, 0.35, 0], false);
        P(head, GEO.cyl, gold, [0.13, -0.11, 0.18], [0.004, 0.16, 0.004], [0, 0, 0.4], false);
      }),
      bunny: () => npcMake('bunny', ({ n, body, P, face, M }) => {
        const w = M('#FFFFFF'), pk = M('#F7B9C4'), ap = M('#F7C9D3'), hat = M('#FFFDF9'), band = M('#F2EBE6');
        P(body, GEO.sph, w, [0, 0.4, 0], [0.23, 0.28, 0.21]);
        P(body, keep(new T.CylinderGeometry(0.2, 0.24, 0.3, 18, 1, true, -1.1, 2.2)), ap, [0, 0.36, 0.01], [1, 1, 0.98], null, false).material.side = T.DoubleSide;
        [-1, 1].forEach(sd => { P(body, GEO.sph, w, [sd * 0.1, 0.07, 0.05], [0.08, 0.06, 0.11]); P(body, capG(0.05, 0.13), w, [sd * 0.22, 0.46, 0.06], null, [0.3, 0, sd * 0.5]); });
        P(body, GEO.sph, w, [0, 0.3, -0.22], [0.07, 0.07, 0.07]);
        const head = new T.Group(); head.position.set(0, 0.88, 0.02); body.add(head); n.head = head;
        P(head, GEO.sph, w, [0, 0, 0], [0.23, 0.21, 0.21]);
        face(head, { nose: '#E8798F', mouth: 'w', ey: 356, lash: true }, [0.23, 0.21, 0.21]);
        n.ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(sd * 0.1, 0.16, -0.04); e.rotation.z = -sd * 0.22; head.add(e);
          P(e, GEO.sph, w, [0, 0.2, 0], [0.06, 0.2, 0.04]); P(e, GEO.sph, pk, [0, 0.2, 0.02], [0.03, 0.15, 0.025], null, false); return e; });
        const hg = new T.Group(); hg.position.set(0, 0.19, 0.04); hg.rotation.x = -0.1; head.add(hg);
        P(hg, GEO.cyl, band, [0, 0, 0], [0.13, 0.07, 0.13]); [[-0.06, 0.09, 0], [0.06, 0.09, 0], [0, 0.12, 0.02], [0, 0.1, -0.05]].forEach(q => P(hg, GEO.sph, hat, q, [0.08, 0.07, 0.08]));
        n.extra = t => { n.ears.forEach((e, i) => { e.rotation.x = Math.max(0, Math.sin(t * 1.1 + i + n.ph)) * 0.2; }); };
      }),
      hedgehog: () => npcMake('hedgehog', ({ n, body, P, face, M }) => {
        const b = M('#A9866D'), sp = M('#8A6A55'), cr = M('#F2DCC4'), ph = M('#A897EA'), phD = M('#8C7AD6');
        P(body, GEO.sph, b, [0, 0.36, 0], [0.24, 0.27, 0.22]); P(body, GEO.sph, cr, [0, 0.34, 0.12], [0.13, 0.16, 0.1], null, false);
        [-1, 1].forEach(sd => P(body, GEO.sph, sp, [sd * 0.1, 0.06, 0.05], [0.07, 0.055, 0.09]));
        const head = new T.Group(); head.position.set(0, 0.78, 0.02); body.add(head); n.head = head;
        P(head, GEO.sph, cr, [0, 0, 0], [0.22, 0.2, 0.2]);
        face(head, { nose: '#2E2A3B', mouth: 'smile', ey: 356 }, [0.22, 0.2, 0.2]);
        for (let i = 0; i < 26; i++) { const a = (i / 26) * PI * 2, k = 0.55 + (i % 3) * 0.12, yy = 0.05 + Math.sin(a * 3) * 0.06;
          const dir = new T.Vector3(Math.cos(a) * 0.9, 0.4 + (i % 4) * 0.15, -0.55 - Math.abs(Math.sin(a)) * 0.3).normalize();
          const cone = P(head, GEO.cone, sp, [dir.x * 0.18, yy + dir.y * 0.17, dir.z * 0.19 - 0.02], [0.055, 0.2 * k + 0.08, 0.055], null, false);
          cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); }
        // иголки на спине: конусы по задней половине тела, торчат наружу
        const up = new T.Vector3(0, 1, 0);
        for (let i = 0; i < 34; i++) {
          const a = (i / 34) * PI * 2 * 3.1, k = i / 34, yy = -0.2 + k * 0.85, rr = Math.sqrt(Math.max(0.05, 1 - yy * yy));
          const dir = new T.Vector3(Math.sin(a) * rr, yy, -Math.abs(Math.cos(a)) * rr - 0.25).normalize();
          const cone = P(body, GEO.cone, sp, [dir.x * 0.22, 0.4 + dir.y * 0.26, dir.z * 0.2], [0.05, 0.17, 0.05], null, false);
          cone.quaternion.setFromUnitVectors(up, dir);
        }
        P(head, keep(new T.TorusGeometry(0.22, 0.02, 6, 24, PI)), ph, [0, 0.03, -0.01], null, [0, 0, 0], false);
        [-1, 1].forEach(sd => P(head, GEO.cyl, phD, [sd * 0.22, 0.0, 0], [0.065, 0.05, 0.065], [0, 0, PI / 2], false));
      }),
      poodle: () => npcMake('poodle', ({ n, body, P, face, M }) => {
        const fur = M('#F2C9A0'), furL = M('#F8DCC0'), bowP = M('#F2A9BE');
        const k = 1.6;   // в комнате пудель чуть крупнее уличного, чтобы читался
        P(body, GEO.sph, fur, [0, 0.13 * k, 0], [0.07 * k, 0.06 * k, 0.1 * k]); P(body, GEO.sph, furL, [0, 0.17 * k, -0.07 * k], [0.05 * k, 0.05 * k, 0.05 * k]);
        [[-0.035, 0.06], [0.035, 0.06], [-0.035, -0.06], [0.035, -0.06]].forEach(([x, z]) => { P(body, GEO.cyl, fur, [x * k, 0.05 * k, z * k], [0.012 * k, 0.1 * k, 0.012 * k], null, false); P(body, GEO.sph, furL, [x * k, 0.012 * k, z * k], [0.022 * k, 0.022 * k, 0.022 * k], null, false); });
        P(body, GEO.sph, furL, [0, 0.2 * k, -0.11 * k], [0.03 * k, 0.03 * k, 0.03 * k], null, false);
        const head = new T.Group(); head.position.set(0, 0.22 * k, 0.08 * k); body.add(head); n.head = head;
        P(head, GEO.sph, fur, [0, 0, 0], [0.055 * k, 0.055 * k, 0.055 * k]); P(head, GEO.sph, furL, [0, 0.05 * k, -0.005 * k], [0.04 * k, 0.04 * k, 0.04 * k], null, false);
        face(head, { er: 42, ex: 96, ey: 350, nose: '#3A2E3F', noseW: 22, noseH: 16 }, [0.055 * k, 0.055 * k, 0.055 * k]);
        [-1, 1].forEach(sd => { P(head, GEO.sph, furL, [sd * 0.05 * k, -0.02 * k, -0.005 * k], [0.022 * k, 0.045 * k, 0.022 * k], null, false); P(head, GEO.sph, bowP, [sd * 0.022 * k, 0.085 * k, 0], [0.022 * k, 0.014 * k, 0.01 * k], null, false); });
      }),
      gosling: () => npcMake('gosling', ({ n, body, P, face, M }) => {
        const y = M('#F7D65A'), yd = M('#EAC248'), b = M('#F0A040');
        P(body, GEO.sph, y, [0, 0.13, 0], [0.11, 0.1, 0.13]); P(body, GEO.cone, yd, [0, 0.16, -0.13], [0.04, 0.07, 0.03], [-1.9, 0, 0], false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, yd, [sd * 0.1, 0.14, -0.01], [0.03, 0.06, 0.08], null, false); P(body, GEO.cyl, b, [sd * 0.035, 0.03, 0.01], [0.008, 0.06, 0.008], null, false); P(body, GEO.sph, b, [sd * 0.035, 0.005, 0.03], [0.022, 0.006, 0.03], null, false); });
        const head = new T.Group(); head.position.set(0, 0.27, 0.07); body.add(head); n.head = head;
        P(head, GEO.sph, y, [0, 0, 0], [0.075, 0.07, 0.075]);
        face(head, { er: 44, ex: 104, ey: 330 }, [0.075, 0.07, 0.075]);
        P(head, GEO.cone, b, [0, -0.012, 0.085], [0.022, 0.05, 0.016], [PI / 2, 0, 0], false);
      }),
      pigeon: () => npcMake('pigeon', ({ n, body, P, face, M }) => {
        const bd = M('#9EA3B8'), dk = M('#878CA3'), nk = M('#7FA38F'), bk = M('#E6A15A'), lg = M('#E58C8C');
        P(body, GEO.sph, bd, [0, 0.17, 0], [0.11, 0.1, 0.15]); P(body, GEO.sph, nk, [0, 0.24, 0.07], [0.07, 0.055, 0.07], null, false);
        [-1, 1].forEach(sd => { P(body, GEO.sph, dk, [sd * 0.1, 0.18, -0.02], [0.035, 0.07, 0.12], null, false); P(body, GEO.cyl, lg, [sd * 0.03, 0.04, 0], [0.008, 0.08, 0.008], null, false); });
        P(body, GEO.box, dk, [0, 0.16, -0.18], [0.1, 0.02, 0.12], [-0.3, 0, 0], false);
        const head = new T.Group(); head.position.set(0, 0.32, 0.1); body.add(head); n.head = head;
        P(head, GEO.sph, bd, [0, 0, 0], [0.065, 0.065, 0.065]);
        face(head, { er: 40, ex: 100, ey: 330, noBlush: true }, [0.065, 0.065, 0.065]);
        P(head, GEO.cone, bk, [0, -0.008, 0.075], [0.016, 0.045, 0.016], [PI / 2, 0, 0], false);
        n.extra = t => { head.rotation.x = Math.pow(Math.max(0, Math.sin(t * 2.4 + n.ph)), 10) * 0.9; };
      }),
      // овечка Кашемира: пушистая, вяжет спицами
      sheep: () => npcMake('sheep', ({ n, body, P, face, M }) => {
        const wool = M('#FFF8EE'), woolD = M('#F3E8DA'), dark = M('#5A4A56'), needle = M('#E8C770'), yarn = M('#F08FA8');
        [[0, 0.44, 0, 0.16], [0.13, 0.46, 0.02, 0.12], [-0.13, 0.46, 0.02, 0.12], [0.08, 0.56, -0.05, 0.12], [-0.08, 0.56, -0.05, 0.12], [0.1, 0.34, 0.06, 0.11], [-0.1, 0.34, 0.06, 0.11], [0, 0.36, -0.1, 0.13], [0, 0.58, 0.04, 0.11]]
          .forEach(([x, y, z, r], i) => P(body, blobGeo, i % 3 ? wool : woolD, [x, y, z], [r, r * 0.95, r], null, i < 3));
        [[-0.08, 0.06], [0.08, 0.06], [-0.08, -0.06], [0.08, -0.06]].forEach(([x, z]) => P(body, capG(0.035, 0.1), dark, [x, 0.12, z], null, null, false));
        const head = new T.Group(); head.position.set(0, 0.82, 0.06); body.add(head); n.head = head;
        P(head, GEO.sph, dark, [0, 0, 0], [0.19, 0.2, 0.19]);
        face(head, { muzzle: '#7A6A76', muzzleW: 96, muzzleH: 56, nose: '#3A2E3F', noseW: 14, noseH: 9, mouth: 'smile', white: true, er: 28, ey: 344 }, [0.19, 0.2, 0.19]);
        [-1, 1].forEach(sd => P(head, GEO.sph, dark, [sd * 0.19, 0.02, -0.02], [0.09, 0.04, 0.05], [0, 0, -sd * 0.6], false));
        [[-0.06, 0.18, 0.02], [0.05, 0.19, 0.01], [0, 0.21, -0.04]].forEach(q => P(head, blobGeo, wool, q, [0.07, 0.065, 0.07], null, false));
        n.needles = [-1, 1].map(sd => { const nd = new T.Group(); nd.position.set(sd * 0.1, 0.5, 0.17); body.add(nd); P(nd, GEO.cyl, needle, [0, 0.06, 0], [0.006, 0.16, 0.006], [0, 0, -sd * 0.7], false); return nd; });
        P(body, GEO.sphLo, yarn, [0, 0.45, 0.2], [0.05, 0.04, 0.04], null, false);
        n.extra = t => { n.needles.forEach((nd, i) => { nd.rotation.z = Math.sin(t * 7 + i * PI) * 0.18; }); };
      }),
      // черепаха Минутка: фотограф, шея выдвигается
      turtle: () => npcMake('turtle', ({ n, body, P, face, M }) => {
        const [hcv, hc] = cnv(256, 256); hc.fillStyle = '#8FC9A8'; hc.fillRect(0, 0, 256, 256); hc.strokeStyle = '#6FAE8C'; hc.lineWidth = 6;
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = c * 56 + (r % 2) * 28, y = r * 50; hc.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; hc[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 24, y + Math.sin(a) * 24); } hc.closePath(); hc.stroke(); }
        const shell = M('#FFFFFF', { map: tex(hcv) }), belly = M('#F6EBD2'), skin = M('#B9D9A0'), cap = M('#3A2E3F');
        P(body, GEO.hemi, shell, [0, 0.16, 0], [0.32, 0.26, 0.34]); P(body, GEO.cyl, belly, [0, 0.15, 0], [0.31, 0.03, 0.33], null, false);
        [[-0.2, 0.18], [0.2, 0.18], [-0.2, -0.18], [0.2, -0.18]].forEach(([x, z]) => P(body, GEO.sph, skin, [x, 0.07, z], [0.07, 0.07, 0.08]));
        const neck = new T.Group(); neck.position.set(0, 0.2, 0.26); body.add(neck); n.neck = neck;
        P(neck, capG(0.055, 0.08), skin, [0, 0.03, 0.03], null, [1.1, 0, 0]);
        const head = new T.Group(); head.position.set(0, 0.1, 0.1); neck.add(head); n.head = head;
        P(head, GEO.sph, skin, [0, 0, 0], [0.12, 0.11, 0.12]);
        face(head, { er: 36, ex: 92, ey: 340, mouth: 'smile' }, [0.12, 0.11, 0.12]);
        const cg = new T.Group(); cg.position.set(0, 0.09, -0.01); cg.rotation.set(-0.15, 0, 0); head.add(cg);
        P(cg, GEO.hemi, cap, [0, 0, 0], [0.1, 0.06, 0.1], null, false); P(cg, GEO.box, cap, [0, 0.003, 0.09], [0.12, 0.012, 0.07], null, false);
        n.blinkSlow = true;
        n.extra = t => { neck.position.z = 0.26 + Math.max(0, Math.sin(t * 0.6 + n.ph)) * 0.05; };
      }),
      bee: (opt = {}) => { const g = buildBee(opt); const n = { id: 'bee', root: g, body: g.userData.body, head: null, hop() {}, anim(t) { g.userData.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 38) * 0.5; }); g.userData.body.position.y = Math.sin(t * 2.4) * 0.06; } }; g.userData.key = 'npc:bee'; return n; },
    };

    /* --- уровень-комната: геометрия из зарегистрированного описания --- */
    const HELP = { T, PI, o, keep, put, box, sph, sphS, cyl, rbox, rboxGeo, extrude, archShape, triShape, plane, smoothCrease, frameGeo, windowF, cornice,
        lace, curtains, flowerBox, heartG, bow, bowAt, wreath, sconce, ivy, toon, pm, tex, cnv, text, rrect, labelCanvas, bake, makeKit, GEO, rng, addRim, addOutlines,
        blobGeo, blobDisc, leafUp, leafFlat, haloTex, signs: SIGN, mixHex, shade, flower3d, bouquetModel, pickModel, npc: NPC, ringG, makeNpc: npcMake, angDiff,
        // ореол-спрайт (тёплый свет лампы без настоящего источника)
        halo: (par, x, y, z, size = 0.9, col = '#FFD0A0', op = 0.6) => { const sp = new T.Sprite(keep(new T.SpriteMaterial({ map: haloTex, color: new T.Color(col), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: op, fog: false }))); sp.position.set(x, y, z); sp.scale.setScalar(size); sp.renderOrder = 4; par.add(sp); return sp; },
        label: (s, bg) => labelCanvas(s, bg) };
    // новые витрины прогулки — на продолжении улицы
    if (FREE) Object.keys(SHOPS).forEach(k => {
      try {
        const def = SHOPS[k], K = makeKit(true), g0 = new T.Group(), built = def.build(Object.assign({}, HELP, { group: g0, K })) || {};
        const bg = built.g || g0; bg.position.set(def.x, 0, FRONT_Z); scene.add(bg);
        bake(bg, k); bg.userData.key = k; built.K = K; buildings[k] = Object.assign({ doors: [] }, built, { g: bg });
      } catch (e) { /* одна витрина не должна ломать улицу */ }
    });
    let snow = null;
    if (FREE && FO.decor) {
      const dg = new T.Group(); scene.add(dg);
      if (FO.decor.sweaters) {
        const pw = toon('#F7C9D3'), cr = toon('#FFF6EE'), tg = keep(new T.TorusGeometry(0.06, 0.028, 6, 14));
        LAMPS.filter(x => FO.decor.sweaters >= 2 || x === 3.1).forEach(x => { for (let i = 0; i < 6; i++) put(dg, tg, i % 2 ? cr : pw, [x, 1.0 + i * 0.07, 3.25], null, [PI / 2, 0, 0]); });
      }
      if (FO.decor.garlands) Object.keys(SHOPS).forEach(k => {
        const d0 = SHOPS[k], w2 = (d0.w || 3.4) / 2, y0 = (d0.h || 3.6) - 0.35, ga = d0.garland;   // garland — точки крепления от витрины
        const a = ga ? new T.Vector3(d0.x + ga[0][0], ga[0][1], FRONT_Z + ga[0][2]) : new T.Vector3(d0.x - w2, y0, FRONT_Z + 0.12);
        const b = ga ? new T.Vector3(d0.x + ga[1][0], ga[1][1], FRONT_Z + ga[1][2]) : new T.Vector3(d0.x + w2, y0, FRONT_Z + 0.12);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35; const cv2 = new T.QuadraticBezierCurve3(a, mid, b);
        put(dg, keep(new T.TubeGeometry(cv2, 16, 0.007, 4)), toon('#7A6670')).castShadow = false;
        const bulbM = toon('#FFE3A8', { emissive: new T.Color('#FFC46B'), emissiveIntensity: 0.9 });
        for (let i = 1; i < 10; i++) { const q = cv2.getPoint(i / 10); put(dg, GEO.sphLo, bulbM, [q.x, q.y - 0.06, q.z], [0.045, 0.06, 0.045]).castShadow = false; }
      });
      bake(dg); dg.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      if (FO.decor.snow) {
        const N = 360, pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 30 - 10; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = Math.random() * 12 - 4; }
        const sg2 = keep(new T.BufferGeometry()); sg2.setAttribute('position', new T.BufferAttribute(pos, 3));
        const [scv2, scx2] = cnv(32, 32), gr2 = scx2.createRadialGradient(16, 16, 0, 16, 16, 15); gr2.addColorStop(0, 'rgba(255,255,255,1)'); gr2.addColorStop(1, 'rgba(255,255,255,0)'); scx2.fillStyle = gr2; scx2.fillRect(0, 0, 32, 32);
        snow = new T.Points(sg2, keep(new T.PointsMaterial({ map: tex(scv2), color: 0xFFFFFF, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false })));
        snow.frustumCulled = false; scene.add(snow);
      }
    }
    let RM = null;
    if (ROOM) {
      const rg = new T.Group(); scene.add(rg);
      const R = Object.assign({}, HELP, { group: rg });
      const d = ROOM.build(R) || {};
      if (o.mode === 'free') (EXTS[o.room] || []).forEach(ext => {
        try {
          const e = ext.build(R, d) || {};
          ['spots', 'blockers'].forEach(k => { if (e[k]) d[k] = (d[k] || []).concat(e[k]); });
          if (e.npcs) d.npcs = Object.assign(d.npcs || {}, e.npcs);
          if (e.catSpot) d.catSpot = e.catSpot;
          if (e.tick) { const t0 = d.tick; d.tick = (t, dt, c) => { if (t0) t0(t, dt, c); e.tick(t, dt, c); }; }
          Object.keys(e).forEach(k => { if (!['spots', 'blockers', 'npcs', 'catSpot', 'tick'].includes(k)) d[k] = e[k]; });
        } catch (x) { console.warn('extendRoom', o.room, x); }
      });
      const W = d.W || 8, Dp = d.D || 6;
      RM = Object.assign({ W, D: Dp, bounds: { x0: -W / 2 + 0.5, x1: W / 2 - 0.5, z0: -Dp + 0.6, z1: -0.3 }, exit: { x: -W / 2 + 1, z: -0.6 }, spawn: null, spots: [], npcs: {}, exitLabel: 'на улицу' }, d);
      if (!RM.spawn) RM.spawn = { x: RM.exit.x + 0.6, z: RM.exit.z - 0.3 };
      RM.cam = Object.assign({ x0: RM.bounds.x0 + 1, x1: RM.bounds.x1 - 1 }, d.cam || {});
      if (RM.cam.x0 > RM.cam.x1) RM.cam.x0 = RM.cam.x1 = (RM.cam.x0 + RM.cam.x1) / 2;
      rg.traverse(m => { if (m.isMesh && !m.userData.key && !(m.parent && m.parent.userData && m.parent.userData.key)) { /* декор: тапы проходят насквозь, если нет ключа */ } });
    }
    // точки взаимодействия: из описания комнаты + из сценария (одинаковый id — сценарий уточняет)
    const spots = [];
    (RM ? RM.spots : []).concat(spots0).forEach(sp => { const i = spots.findIndex(q => q.id === sp.id); if (i >= 0) spots[i] = Object.assign(spots[i], sp); else spots.push(Object.assign({ autoDone: false }, sp)); });
    if (o.spotIds) for (let i = spots.length - 1; i >= 0; i--) if (!o.spotIds.includes(spots[i].id)) spots.splice(i, 1);

    /* --- персонажи на сцену --- */
    const blobMat = keep(new T.MeshBasicMaterial({ map: tex(blobCanvas()), transparent: true, depthWrite: false }));
    const H3 = await heroModel(4000);   // модель автора; null — рисованная героиня
    let hero = null;
    if (H3) {
      try { hero = buildHeroRig(o.hero, H3); } catch (e) { console.warn('hero rig', e); hero = null; }   // со скелетом
      if (!hero) { try { hero = buildHeroGLB(o.hero, H3); } catch (e) { console.warn('hero3d', e); hero = null; } }   // статуэтка
    }
    if (!hero) hero = buildHero(o.hero, await heroFaceImgs());
    scene.add(hero.root);
    const heroBlob = put(scene, GEO.plane, blobMat, [0, 0.012, 0], [0.8, 0.5, 1], [-PI / 2, 0, 0]); heroBlob.castShadow = false; heroBlob.receiveShadow = false;
    const cat = buildCat(); cat.root.visible = false; scene.add(cat.root);
    // мягкий контровой свет по краю у персонажей
    const rimmed = new Set();
    [hero.root, cat.root].forEach(r => r.traverse(m => { if (m.isMesh && m.material && m.material.isMeshToonMaterial && !rimmed.has(m.material)) { rimmed.add(m.material); addRim(m.material, 1); } }));
    const catBlob = put(scene, GEO.plane, blobMat, [0, 0.011, 0], [0.48, 0.34, 1], [-PI / 2, 0, 0]); catBlob.castShadow = false; catBlob.visible = false;
    // настоящие руки (волна 4, js/interact.js): у героини комнаты свой скелет — свой слой на время комнаты (dispose в cleanup).
    // Корень пишет слой (подойти к прилавку, присесть) — в px/pz/heroAng комнаты; iaDy — высота корня (ступеньки, присед не трогает)
    let IA = null, iaDy = 0, iaCancelled = false, nibbleT = 6, celebrateAfter = false;
    if (window.Interact && hero.rig && hero.rig.anim && !/[?&]hands=off/.test(location.search)) {
      try {
        IA = Interact.create({ THREE: T, anim: hero.rig.anim, heroRoot: hero.root, gradientMap: GRAD,
          setRoot: (p, yaw) => { px = p.x; pz = p.z; heroAng = faceTarget = yaw; iaDy = Math.abs(p.y) < 0.004 ? 0 : p.y; },
          on: n => { const k = { take: 'pop', give: 'pop', bite: 'tap', crunch: 'tap', lick: 'tap', sip: 'pop', pat: 'tap', clap: 'pop', clink: 'chime' }[n]; if (k) sfx(k); if (n === 'take') haptic('light'); } });
      } catch (e) { console.warn('room hands', e); IA = null; }
    }
    const iaBusy = () => !!(IA && IA.busy());
    const iaHeldIt = () => { const c = IA && IA.holding('L'); return c && c.userData.it ? c.userData.it : null; };
    let roomHeldOut = null;   // что в руке, когда комната закрылась (City3D.lastHeld — лавкам города)
    const pigeons = (ROOM ? [] : [[3.8, 1.4], [8.4, 2.2], [13.6, 0.4], [18.9, 1.8], [24, 0.8]]).map(([x, z], i) => {
      const p = buildPigeon(i === 2); p.g.position.set(x, 0, z); p.g.rotation.y = (i * 2.1) % (PI * 2); scene.add(p.g);
      return Object.assign(p, { x, z, flown: false, t: 0, dir: i % 2 ? 1 : -1, ph: i * 1.7 });
    });

    /* --- находки на улице: парят, мерцают, их можно подобрать --- */
    const ringMat = keep(new T.MeshBasicMaterial({ color: 0xFFD6E2, transparent: true, opacity: 0.75, depthWrite: false }));
    const ringGeo = keep(new T.TorusGeometry(0.3, 0.025, 6, 32));
    const pickups = (o.pickups || []).map((p, i) => {
      const holder = new T.Group(); holder.position.set(p.x, 0, p.z); holder.userData.key = 'pick:' + p.id; scene.add(holder);
      const model = pickModel(p.kind); holder.add(model);
      const ring = put(holder, ringGeo, ringMat, [0, 0.02, 0], null, [-PI / 2, 0, 0]); ring.castShadow = false; ring.receiveShadow = false;
      const glow = put(holder, GEO.sph, keep(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.25, depthWrite: false })), [0, 0.55, 0], [0.26, 0.26, 0.26]);
      glow.castShadow = false; glow.receiveShadow = false;
      return { p, holder, model, ring, glow, taken: false, ph: i * 1.3 };
    });
    let heldG = null;
    let heldKind = null, heldData = null;
    const setHeld = (kind, data) => {
      if (heldG) { heldG.parent.remove(heldG); heldG = null; }
      heldKind = kind || null; heldData = kind ? (data || null) : null; nibbleT = 6 + Math.random() * 3;
      // волна 4: покупки — в настоящей руке (слой Interact): ведёрко, стаканчик, крендель; букет и лейка — как раньше
      if (IA) {
        const want = kind ? IA_ITEM[kind] : null, cur = IA.holding('L'), curN = cur && cur.userData.it ? cur.userData.it.name : null;
        if (want && curN === want) return;
        // волна 5: молоточек «Юлы» — игрушка (не еда): уже в руке — оставить; нет — дать ту же игрушку
        if (kind === 'squeaky_hammer') {
          if (cur && (curN === 'squeaky_hammer' || cur.userData.pfHammer)) return;
          if (cur) { const x = IA.drop('L'); if (x && x.userData.it && x.userData.it.dispose && (x.userData.it.def.parts || x.userData.pfHammer)) x.userData.it.dispose(); else if (x && x.parent) x.parent.remove(x); }
          if (window.PlayFight && PlayFight.hammerItem) { const hm = PlayFight.hammerItem(T, window.Interact, GRAD); if (IA.give(hm, 'L')) return; if (hm.userData.pfDispose) hm.userData.pfDispose(); }
          return;
        }
        if (cur) { const x = IA.drop('L'); if (x && x.userData.it && x.userData.it.def && (x.userData.it.def.parts || x.userData.pfHammer)) x.userData.it.dispose(); else if (x && x.parent) x.parent.remove(x); }
        if (want) {
          const g = IA.give(want, 'L'), d = g && g.userData.it;   // недоеденное: столько же укусов и какао, сколько было
          if (d && data && data._bites) for (let k = 0; k < data._bites && d.bite && d.bite(); k++) { /* укус */ }
          if (d && data && typeof data._level === 'number' && data._level < 1 && d.setLevel) d.setLevel(data._level);
          return;
        }
      }
      if (!kind) return;
      if (kind === 'bouquet') {
        heldG = bouquetModel(data || {});
        heldG.scale.setScalar(1.4); heldG.position.set(0.0, -0.43, 0.07); heldG.rotation.set(0.62, 0, -0.42);
      } else if (kind === 'cup' || kind === 'popcorn' || kind === 'can') {
        heldG = new T.Group();
        if (kind === 'cup') {   // какао/кофе в бумажном стаканчике
          const d = data || {}, white = toon('#FFFDF9'), sleeve = toon('#F6C6D0'), liq = toon(d.liquid || '#8B5A3C');
          put(heldG, keep(new T.CylinderGeometry(0.045, 0.034, 0.11, 14)), white, [0, 0, 0]); put(heldG, GEO.cyl, sleeve, [0, -0.005, 0], [0.043, 0.04, 0.043]);
          put(heldG, GEO.cyl, liq, [0, 0.052, 0], [0.042, 0.006, 0.042]);
          if (d.marsh || d.foam) [[-0.012, 0.06, 0.01], [0.014, 0.062, -0.008], [0.002, 0.066, 0.016]].forEach(q => put(heldG, GEO.sphLo, white, q, [0.012, 0.01, 0.012]));
        } else if (kind === 'popcorn') {
          const w = toon('#FFFDF9'), ch = toon('#C2405B'), corn = toon('#FFE9A8');
          put(heldG, keep(new T.CylinderGeometry(0.06, 0.045, 0.13, 12)), w, [0, 0, 0]);
          for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; put(heldG, GEO.box, ch, [Math.sin(a) * 0.053, 0, Math.cos(a) * 0.053], [0.018, 0.13, 0.008], [0, a, 0]); }
          [[0, 0.075, 0], [0.025, 0.07, 0.02], [-0.025, 0.07, -0.015], [0.015, 0.08, -0.025], [-0.02, 0.078, 0.02]].forEach(q => put(heldG, GEO.sphLo, corn, q, [0.02, 0.018, 0.02]));
        } else {   // лейка
          const mint = toon('#A8D8C4'), mintD = toon('#86BFA8');
          put(heldG, GEO.cyl, mint, [0, 0, 0], [0.06, 0.1, 0.06]); put(heldG, GEO.cyl, mintD, [0.07, 0.02, 0], [0.012, 0.13, 0.012], [0, 0, -0.9]);
          put(heldG, keep(new T.TorusGeometry(0.04, 0.008, 6, 14, PI)), mintD, [-0.03, 0.06, 0], null, [0, 0, 0.3]);
        }
        heldG.position.set(0, -0.44, 0.06); heldG.rotation.set(0.2, 0, 0.1);
      } else {
        heldG = pickModel(kind, true); heldG.scale.multiplyScalar(0.62);
        heldG.position.set(0, -0.44, 0.07); heldG.rotation.set(0.25, 0, 0.12);
      }
      if (hero.statue || hero.rig) {   // модель: предмет в свободной (левой) руке у бедра, стоя прямо (у скелетной — несёт перед собой)
        heldG.position.set(0.07, kind === 'bouquet' ? 0.01 : -0.03, 0.08);
        heldG.rotation.set(kind === 'bouquet' ? 0.22 : 0.1, 0, kind === 'bouquet' ? -0.3 : -0.08);
      }
      hero.arms[0].inner.add(heldG);
      heldG.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; if (m.material && m.material.isMeshToonMaterial && !hero.mats.includes(m.material)) hero.mats.push(m.material); } });
    };
    if (o.held) { if (typeof o.held === 'string') setHeld(o.held); else setHeld(o.held.kind, o.held.data); }
    // волна 4: откусить / отпить (стоя или сидя с покупкой — сама); кончилось — строка, пустые руки (и в прогулке: st.town.h),
    // а букет, если он есть, — снова в руке (как в прогулке)
    const iaDone = kind => {
      setHeld(null);
      try { const st = G.state(); if (st && st.town && st.town.h === kind) { st.town.h = null; G.save(); } if (st && st.bouquet) setHeld('bouquet', st.bouquet); } catch (e) { /* ignore */ }
      if (IA_DONE[kind]) toast(IA_DONE[kind], 2800);
    };
    async function iaNibble() {
      const it = iaHeldIt(); if (!it || iaBusy() || !heldKind || finished) return false;
      const kind = heldKind;
      if (it.def && it.def.drink) { await IA.play('drink'); const it2 = iaHeldIt(); if (!finished && (!it2 || it2.level <= 0.05)) iaDone(kind); return true; }
      if (it.def && (it.def.bite || it.def.pick)) { await IA.play('eat'); const it2 = iaHeldIt(); if (!finished && (!it2 || (it2.def.level && it2.level < 0.15) || (!it2.def.level && it2.left() <= 0))) iaDone(kind); return true; }
      return false;
    }
    // взять покупку настоящей рукой: из лап жителя комнаты (npc — id в RM.npcs) или с прилавка (at — точка в мире); kind — как в
    // setHeld ('popcorn' | 'cup' | 'pretzel' …). walkTo [x, z] — сначала подойти (к краю прилавка), approach:false — слой не подходит сам
    async function iaTakeRoom(op = {}) {
      if (!IA || finished) return false;
      if (IA.busy()) { IA.cancel(); for (let i = 0; i < 40 && IA.busy() && !finished; i++) await new Promise(r => setTimeout(r, 50)); }   // «сама ела» — доесть потом
      if (sitting) standUp();
      const hadCam = !!camOverride;   // своя камера места (кино, прилавок) — её не трогаем
      if (op.walkTo) { await spotApi.walkTo(op.walkTo[0], op.walkTo[1]); if (finished) return false; }
      if (op.face !== undefined) { faceLock = op.face; heroAng = faceTarget = op.face; }
      setHeld(null);   // свободная (левая) рука — пустая: букет или прежняя покупка уходят «в сумку» (букет вернётся, когда доест)
      // волна 5: пищащий молоточек «Юлы» — готовая сетка игрушки (js/playfight.js), Interact берёт сетку через items.wrap
      const nm = op.kind === 'squeaky_hammer' && window.PlayFight && PlayFight.hammerItem ? PlayFight.hammerItem(T, window.Interact, GRAD) : (IA_ITEM[op.kind] || op.item || op.kind);
      if (op.npc) {
        const n = typeof op.npc === 'string' ? (RM && RM.npcs[op.npc]) : op.npc, root2 = n && (n.root || n);
        if (!root2) return false;
        // камера сбоку на время передачи (из-за спины героини лапку и руку не видно): середина между ними, с ближней к залу стороны
        let camSet = false;
        if (op.cam !== false && !camOverride) {
          camTok++; camMine = true;
          const hp2 = root2.getWorldPosition(new T.Vector3()), dx = hp2.x - px, dz = hp2.z - pz, l = Math.max(0.01, Math.hypot(dx, dz)), ux = dx / l, uz = dz / l;
          let qx = -uz, qz = ux; if (qz < 0) { qx = -qx; qz = -qz; }   // перпендикуляр — к залу (к обычной камере)
          const mx = (px + hp2.x) / 2, mz = (pz + hp2.z) / 2;
          spotApi.camFocus([mx + qx * 2.1 - ux * 0.35, 1.95, mz + qz * 2.1 - uz * 0.35], [mx, 1.0, mz]); camSet = true;
        }
        await IA.play('takeFrom', { item: nm, from: { root: root2, color: op.color || '#E8D9C8', height: op.height || 0.62, meetY: op.meetY || 1.0, chestFwd: op.chestFwd }, approach: op.approach === true ? undefined : false });
        if (camSet && !finished && !op.eatNow) camLater(350);
      } else if (op.at) {
        // волна 5: свой предмет места (op.obj — Object3D, обёрнутый Interact.items.wrap: лейка оранжереи) или предмет по имени
        const item = op.obj && op.obj.isObject3D ? op.obj : Interact.items.make(nm, { THREE: T, gradientMap: GRAD }); if (!item) return false;
        item.position.set(op.at[0], op.at[1], op.at[2]); if (op.ry) item.rotation.y = op.ry; scene.add(item);
        await IA.play('take', Object.assign({ item }, op.approach === false ? { approach: false } : {}, op.dist ? { dist: op.dist } : {}, op.pose ? { pose: op.pose } : {}, op.always ? { always: true } : {}, op.stand ? { stand: op.stand } : {}));
      } else return false;
      faceLock = null;
      const it = iaHeldIt();
      if (it && op.kind) { heldKind = op.kind; heldData = op.data || null; nibbleT = 6 + Math.random() * 3; }
      if (it && op.eatNow && !finished) await iaTaste({ focus: !hadCam && op.cam !== false });
      return !!iaHeldIt() || !!it;
    }
    // камера передачи / первого укуса: своя (camMine) — отпускаем по жетону, чужую (камера места) не трогаем
    let camTok = 0, camMine = false;
    const camLater = ms => { const tok = ++camTok; setTimeout(() => { if (!finished && tok === camTok && camMine) { camMine = false; spotApi.camRelease(); } }, ms); };
    // повернулась к залу — и сразу пробует: зёрнышко, укус, глоток; камера чуть ближе, чтобы было видно.
    // Места прогулки зовут это сами (api.nibble({ focus: true })) — после ctx.setHeld, чтобы покупка уже числилась в руке
    async function iaTaste(o2 = {}) {
      if (!IA || !iaHeldIt() || finished) return false;
      const own = o2.focus !== false && (!camOverride || camMine);
      if (own) { camTok++; camMine = true; spotApi.focusHero(0.55); }
      // поворот к залу (камере) — дождаться, пока повернётся (на медленном кадре 0,7 с мало), но не дольше 4 с
      const t0 = performance.now(), wt = o2.wait != null ? o2.wait : 700;
      await new Promise(res => { const chk = () => { const dtm = performance.now() - t0; if (finished || dtm > 4000 || (dtm > wt && Math.abs(angDiff(faceTarget, heroAng)) < 0.25)) res(); else setTimeout(chk, 60); }; chk(); });
      const r = finished ? false : await iaNibble();
      if (own) camLater(400);
      return r;
    }
    let picking = false;
    const collect = async pk => {
      if (pk.taken || picking) return;
      pk.taken = true; picking = true;
      haptic('success'); sfx('sticker'); hopT = 0;
      const s0 = toScreen(pk.p.x, 0.6, pk.p.z), appR = G.app.getBoundingClientRect(), rr = root.getBoundingClientRect();
      G.sparkle(s0.x + rr.left - appR.left, s0.y + rr.top - appR.top, { kind: 'heart', n: 10, dist: 60 });
      const from = pk.holder.position.clone(), t0 = performance.now();
      await new Promise(r => {
        const st = () => {
          const k = Math.min(1, (performance.now() - t0) / 420);
          pk.holder.position.set(from.x + (px - from.x) * k, from.y + Math.sin(k * PI) * 0.6, from.z + (pz - from.z) * k);
          pk.holder.scale.setScalar(1 - k * 0.85);
          if (k < 1) requestAnimationFrame(st); else r();
        };
        st();
      });
      scene.remove(pk.holder);
      if (pk.p.held) setHeld(pk.p.kind);
      try { if (o.onPickup) await o.onPickup(pk.p.id, spotApi); } catch (e) { /* не ломаем прогулку */ }
      picking = false;
    };

    /* --- дождь или летящие листья --- */
    let rain = null, leaves = null;
    if (o.rain) {
      const N = 520, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 30 - 10; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = Math.random() * 14 - 5; }
      const gg = keep(new T.BufferGeometry()); gg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const [rcv, rcx] = cnv(64, 64); const rgd = rcx.createLinearGradient(0, 0, 0, 64);
      rgd.addColorStop(0, 'rgba(255,255,255,0)'); rgd.addColorStop(0.7, 'rgba(235,240,255,.9)'); rgd.addColorStop(1, 'rgba(255,255,255,0)');
      rcx.strokeStyle = rgd; rcx.lineWidth = 3; rcx.lineCap = 'round'; rcx.beginPath(); rcx.moveTo(35, 2); rcx.lineTo(29, 62); rcx.stroke();
      rain = new T.Points(gg, keep(new T.PointsMaterial({ map: tex(rcv), color: 0xDCE4F4, size: 0.34, transparent: true, opacity: 0.6, depthWrite: false })));
      scene.add(rain);
    } else if (!ROOM) {
      const N = 32;
      leaves = new T.InstancedMesh(leafUp, keep(new T.MeshBasicMaterial({ side: T.DoubleSide })), N);
      leaves.userData.items = Array.from({ length: N }, () => ({ x: Math.random() * 30 - 6, y: Math.random() * 6, z: Math.random() * 8 - 3, r: Math.random() * 6, s: 0.6 + Math.random() * 0.8 }));
      const cols = ['#E8955A', '#E07A5F', '#EDBB5A', '#F2A7A0'];
      for (let i = 0; i < N; i++) leaves.setColorAt(i, new T.Color(cols[i % 4]));
      leaves.frustumCulled = false; scene.add(leaves);
    }

    // тёплые пылинки в воздухе (в ясные прогулки)
    const MOTE_OP = [0, 0.25, 0.45, 0.6][LI];
    let motes = null;
    if (MOTE_OP) {
      const N = 36, mp = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) mp.set([Math.random() * 16 - 8, 0.6 + Math.random() * 3, Math.random() * 6 - 3], i * 3);
      const mg = keep(new T.BufferGeometry()); mg.setAttribute('position', new T.BufferAttribute(mp, 3));
      motes = new T.Points(mg, keep(new T.PointsMaterial({ map: haloTex, color: 0xFFE6C4, size: 0.11, transparent: true, opacity: MOTE_OP, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
      motes.frustumCulled = false; scene.add(motes);
    }
    // свет плавно «теплеет» после раскрытия предыдущего дела
    const _c = new T.Color();
    function applyLook(A, Bk, e) {
      hemi.color.set(A.sky).lerp(_c.set(Bk.sky), e); hemi.groundColor.set(A.gnd).lerp(_c.set(Bk.gnd), e); hemi.intensity = A.hi + (Bk.hi - A.hi) * e;
      sun.color.set(A.sun).lerp(_c.set(Bk.sun), e); sun.intensity = A.si + (Bk.si - A.si) * e;
      for (let k = 0; k < 3; k++) curOff[k] = A.off[k] + (Bk.off[k] - A.off[k]) * e;
      scene.fog.color.set(FOG3D[A.i][0]).lerp(_c.set(FOG3D[Bk.i][0]), e);
      RIM.col.value.set(RIMS[A.i][0]).lerp(_c.set(RIMS[Bk.i][0]), e); RIM.str.value = RIMS[A.i][1] + (RIMS[Bk.i][1] - RIMS[A.i][1]) * e;
    }
    let oldSky = null, prevLook = null;
    if (o.justLit && LI > 0) {
      prevLook = LOOKS[LI - 1]; applyLook(prevLook, LK, 0);
      oldSky = document.createElement('div'); oldSky.style.cssText = `position:absolute;inset:0;background:${SKY3D[prevLook.i]};transition:opacity 2.4s ease`;
      root.insertBefore(oldSky, canvas);
    }
    const warmUp = () => {
      if (!prevLook) return;
      const A = prevLook, t0 = performance.now(); prevLook = null;
      if (oldSky) oldSky.style.opacity = '0';
      const stepL = () => { const k = Math.min(1, (performance.now() - t0) / 2400), e = k * k * (3 - 2 * k); applyLook(A, LK, e); if (k < 1) requestAnimationFrame(stepL); else if (oldSky) { oldSky.remove(); oldSky = null; } };
      stepL();
    };

    loading.remove();

    /* --- состояние игрока --- */
    const spawnId = FREE ? (FO.spawnAt || o.spawnAt) : null, spawnD = spawnId && DOORS[spawnId] ? doorOf(spawnId) : null;
    let px = RM ? RM.spawn.x : spawnD ? spawnD.x : o.again ? tgtDoor.x : o.justLit ? doorPos(o.justLit).x : -2.2, pz = RM ? RM.spawn.z : spawnD ? spawnD.z + 0.45 : o.again ? tgtDoor.z + 0.4 : 0.9;
    let catX = px - 1, catZ = pz + 0.3, catTX = catX, catTZ = catZ, catAng = 0;
    let heroAng = 0, faceTarget = 0, walking = false, idleT = 0, phase = 0, walkAmt = 0, forceWalk = false, hopT = -1;
    let blinkT = 2, eyesClosed = false, catBlinkT = 3, catEyes = false, glance = 0, glanceT = 4;
    let waveT = -1, stepIdx = 0, wbN = 0;
    let twirl = null, pendingTwirl = null, pets = 0, splashed = false, inPuddle = -1, wIdx = 0, kIdx = 0, sfIdx = 0, catHatT = -1;
    let inPile = -1, kicked = false; const kicks = [];
    const drops = [];
    const held = { l: false, r: false, u: false, d: false };
    let joyVec = null, moveTo = null, pendingEnter = false, active = false, finished = false, pushT = 0;
    const BOUNDS = RM ? Object.assign({}, RM.bounds) : { x0: -4, x1: 26.5, z0: FRONT_Z + 0.55, z1: 3.1 };
    if (FREE) {
      if (FO.bounds) { BOUNDS.x0 = FO.bounds.x0; BOUNDS.x1 = FO.bounds.x1; }
      else { const xs = Object.keys(DOORS).map(k => DOORS[k].x); BOUNDS.x0 = Math.min(BOUNDS.x0, Math.min(...xs) - 1.2); BOUNDS.x1 = Math.max(BOUNDS.x1, Math.max(...xs) + 1.2); }
    }
    const camPos = new T.Vector3(px + CAM.dx, CAM.y, pz + CAM.dz), lookAt = new T.Vector3(px, CAM.ly, pz + CAM.lz), tmpV = new T.Vector3();
    const near = () => {
      if (RM) return Math.hypot(px - RM.exit.x, pz - RM.exit.z) < 0.95 ? 'exit' : null;
      let best = null, bd = 1.15;
      (FREE ? Object.keys(DOORS) : Object.keys(B)).forEach(k => { const d = doorOf(k); const dist = Math.hypot(px - d.x, pz - d.z); if (dist < bd) { bd = dist; best = k; } });
      return best;
    };
    const blocked = () => !!document.querySelector('#layer .dlg-wrap, #layer .modal, .img-full');
    // встать с сиденья: перед любым новым походом (тап по точке/двери, walkTo, sit)
    const standUp = () => { if (sitting) { px = sitting.from.x; pz = sitting.from.z; sitting = null; hero.body.rotation.x = 0; } };
    let spotBusy = false, pendingSpot = null, smellT = -1, smellNext = 6, spinT = -1, catSweaterG = null;
    const addCatSweater = () => {
      if (catSweaterG) return;
      catSweaterG = new T.Group(); cat.body.add(catSweaterG);
      const knit = toon('#FFF1E2'), pinkK = toon('#F4C7D0'), sunK = toon('#FFD45A');
      put(catSweaterG, keep(new T.CylinderGeometry(0.152, 0.168, 0.15, 20, 1, true)), knit, [0, 0.17, 0], [1, 1, 1.12]).material.side = T.DoubleSide;
      put(catSweaterG, keep(new T.TorusGeometry(0.165, 0.016, 6, 24)), pinkK, [0, 0.095, 0], [1, 1.12, 1], [PI / 2, 0, 0]);
      put(catSweaterG, keep(new T.TorusGeometry(0.15, 0.014, 6, 24)), pinkK, [0, 0.245, 0], [1, 1.12, 1], [PI / 2, 0, 0]);
      cyl(catSweaterG, sunK, 0, 0.17, 0.182, 0.028, 0.006, [PI / 2, 0, 0]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(catSweaterG, sunK, Math.cos(a) * 0.04, 0.17 + Math.sin(a) * 0.04, 0.182, 0.014, 0.004, 0.004, [0, 0, a]); }
    };
    if (o.catSweater) addCatSweater();
    if (o.catBeret) {   // пудровый беретик вместо шляпы
      const hg = cat.head.children.find(c => c.isGroup); if (hg) hg.visible = false;
      const bm = toon('#F7C9D3'), bg2 = new T.Group(); bg2.position.set(0.02, 0.12, -0.01); bg2.rotation.set(-0.1, 0, -0.3); cat.head.add(bg2);
      put(bg2, GEO.sph, bm, [0, 0, 0], [0.11, 0.035, 0.11]); put(bg2, GEO.sphLo, toon('#E8A6B6'), [0, 0.035, 0], [0.012, 0.016, 0.012]);
    }
    const spotNear = () => spots.find(sp => Math.hypot(px - sp.x, pz - sp.z) < 0.95) || null;
    let camOverride = null, walkWaiters = [];
    let sitting = null, sitWaiters = [], faceLock = null, interceptFn = null, headG = null, catPin = null, catPinWait = [], catY = 0;
    const lookNow = { bow: o.hero.bow, coat: o.hero.coat, hair: o.hero.hair };
    const tweenObj = (n, pts, speed = 1.6, opt = {}) => new Promise(res => {
      if (typeof n === 'string') n = RM && RM.npcs[n];
      if (!n) return res();
      const root2 = n.root || n;
      const P = [root2.position.clone()].concat(pts.map(q => new T.Vector3(q[0], q.length > 2 ? q[1] : root2.position.y, q.length > 2 ? q[2] : q[1])));
      let i = 0, l0 = performance.now(); n.bob = true; n.noLook = true;
      const step = now => {
        const dd = Math.min(0.25, Math.max(0, (now - l0) / 1000)); l0 = now;
        const a = root2.position, b = P[i + 1];
        if (!b || finished) { n.bob = false; n.noLook = false; if (opt.hide) root2.visible = false; return res(); }
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), stp = speed * dd * (G.isSkipping() ? 50 : 1);
        if (d <= stp) { a.copy(b); i++; } else { a.x += dx / d * stp; a.y += dy / d * stp; a.z += dz / d * stp; }
        if (Math.hypot(dx, dz) > 0.01) root2.rotation.y = Math.atan2(dx, dz);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const recolor = lk => { Object.assign(lookNow, lk); hero.setCols(heroCols(lookNow), lk); };
    let dimK = 1, fitTarget = null;
    const refit = () => {
      if (!fitTarget) return;
      const { mesh, opt } = fitTarget, c = new T.Vector3(), nrm = new T.Vector3(0, 0, 1), sz = new T.Vector3();
      mesh.updateMatrixWorld(true); mesh.getWorldPosition(c); nrm.applyQuaternion(mesh.getWorldQuaternion(new T.Quaternion())).normalize();
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox.getSize(sz); sz.multiply(mesh.getWorldScale(new T.Vector3()));
      const W2 = Math.max(sz.x, 0.01), H2 = Math.max(sz.y, 0.01), vf = camera.fov * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const dist = Math.max((H2 / 2) / Math.tan(vf / 2), (W2 / 2) / Math.tan(hf / 2)) * (opt.margin || 1.06);
      const pos = c.clone().addScaledVector(nrm, dist); pos.y = opt.y !== undefined ? opt.y : c.y + 0.1;
      camOverride = { pos, look: c.clone() };
    };
    window.addEventListener('resize', () => { if (fitTarget) setTimeout(refit, 50); });
    const spotApi = {
      // сесть на стул/скамейку: дойти, сесть; движение или тап по полу — встать
      sit: (seat = {}) => new Promise(r => { standUp();
        const h = seat.h === undefined ? 0.45 : seat.h, ry = seat.ry === undefined ? 0 : seat.ry;
        const from = seat.from ? { x: seat.from[0], z: seat.from[1] } : { x: seat.x, z: seat.z + 0.35 };
        const go = () => {   // с точки подхода — на сиденье, мебель не мешает
          const x0 = px, z0 = pz, t0 = performance.now(); moveTo = null;
          const st2 = () => { const k = Math.min(1, (performance.now() - t0) / 320); px = x0 + (seat.x - x0) * k; pz = z0 + (seat.z - z0) * k; if (k < 1 && !finished) requestAnimationFrame(st2); else { sitting = { x: seat.x, z: seat.z, ry, h, from, recline: seat.recline || 0 }; r(!finished); } };
          st2();
        };
        if (Math.hypot(px - from.x, pz - from.z) < 0.2) go();
        else { moveTo = { x: from.x, z: from.z }; pendingEnter = false; walkWaiters.push(() => { if (!finished) go(); else r(false); }); }
      }),
      stand: () => standUp(),
      get isSitting() { return !!sitting; },
      get canRecolor() { return !hero.statue && !hero.rig; },   // у статуэтки одна запечённая текстура: смена образа видна только в 2D и у рисованной героини
      setLook: lk => recolor(lk || {}),
      look: () => Object.assign({}, lookNow),
      heroHead: () => { if (!headG) { headG = new T.Group(); hero.head.add(headG); } return headG; },
      dim: (k = 1, ms = 800) => new Promise(r => { const a = dimK, t0 = performance.now(); const st2 = () => { const q = Math.min(1, (performance.now() - t0) / Math.max(1, ms)); dimK = a + (k - a) * q; hemi.intensity = LK.hi * dimK; sun.intensity = LK.si * dimK; if (q < 1 && !finished) requestAnimationFrame(st2); else r(); }; st2(); }),
      tween: (n, pts, speed, opt) => tweenObj(n, pts, speed, opt),
      catHere: () => !!cat.root.visible,
      catTo: (x, z, opt = {}) => new Promise(r => { if (!cat.root.visible) return r(); catPin = { x, z, ry: opt.ry, y: opt.y }; catPinWait.push(r); }),
      catFree: () => { catPin = null; },
      face: ry => { faceLock = ry; },
      faceCamera: () => { faceLock = null; },
      focusHero: (k = 0.6) => { const hx = px, hz = pz; camOverride = { pos: new T.Vector3(hx + CAM.dx * (1 - k), 1.3 + (CAM.y - 1.3) * (1 - k * 0.6), hz + CAM.dz * (1 - k * 0.55)), look: new T.Vector3(hx, 1.15, hz) }; },
      toScreen: (x, y, z) => { const sc = toScreen(x, y, z), appR = G.app.getBoundingClientRect(), rr = root.getBoundingClientRect(); return { x: sc.x + rr.left - appR.left, y: sc.y + rr.top - appR.top }; },
      intercept: fn => { interceptFn = fn || null; },
      get npcs() { return RM ? RM.npcs : {}; },
      get room() { return RM; },
      heroPos: () => ({ x: px, z: pz }),
      // камера плавно наезжает на точку (загадка на экране) и возвращается
      camFocus: (pos, look) => { camOverride = { pos: new T.Vector3(pos[0], pos[1], pos[2]), look: new T.Vector3(look[0], look[1], look[2]) }; },
      camRelease: () => { camOverride = null; fitTarget = null; },
      // вписать плоскую цель (экран, небо) спереди с учётом живого соотношения сторон
      fitScreen: (mesh, opt = {}) => new Promise(r => {
        if (!mesh) return r();
        fitTarget = { mesh, opt }; refit(); setTimeout(r, 800);
      }),
      focusMode: on => { root.classList.toggle('focus-on', !!on); },
      // вписать прямоугольник w×h с центром look в кадр (учитывает fov и ориентацию экрана)
      camFit: (look, w, h, pad = 1.08) => {
        const vf = camera.fov * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
        const dist = Math.max((h / 2) / Math.tan(vf / 2), (w / 2) / Math.tan(hf / 2)) * pad;
        camOverride = { pos: new T.Vector3(look[0], look[1] + 0.12, look[2] + dist), look: new T.Vector3(look[0], look[1], look[2]) };
      },
      // сценарная прогулка: героиня идёт в точку, промис — когда дошла
      walkTo: (x, z) => new Promise(r => { standUp(); moveTo = { x, z }; pendingEnter = false; walkWaiters.push(r); }),
      finish: v => finishRoom(v),
      leave: () => leave(true),
      setHeld: (kind, data) => setHeld(kind, data),
      // волна 4 — настоящие руки (места js/places/**, лавки js/world/interiors.js): есть ли слой, взять покупку, откусить
      hands: () => !!IA,
      takeItem: op => iaTakeRoom(op),
      nibble: o2 => (o2 && o2.focus ? iaTaste(o2) : iaNibble()),
      // волна 5: полить из того, что в руке (лейка оранжереи): at [x, y, z] — куда льётся, onPour — когда пошла вода
      pour: (at, onPour, op = {}) => {
        if (!IA || finished || !iaHeldIt()) { if (onPour) onPour(); return Promise.resolve(false); }
        if (sitting) standUp();
        return IA.play('pour', Object.assign({ at: new T.Vector3(at[0], at[1], at[2]), onPour }, op)).then(r => !!(r && r.ok));
      },
      // погладить жителя комнаты по-настоящему (присесть, ладонь на макушку): id в RM.npcs или объект с root/head
      petNpc: (id, op = {}) => {
        if (!IA || finished) return Promise.resolve(false);
        if (iaBusy()) IA.cancel();   // «сама ела» — погладить важнее (новое действие встанет в очередь за мягкой отменой)
        const n = typeof id === 'string' ? (RM && RM.npcs[id]) : id, root2 = n && (n.root || n);
        if (!root2) return Promise.resolve(false);
        if (sitting) standUp();
        const head = n.head ? { obj: n.head, off: op.off || [0, 0.14, 0.02] } : null;
        return IA.play('pet', Object.assign({ target: root2, dist: op.dist || 0.42, onPet: op.onPet }, head ? { head } : { headY: op.headY || 0.5 })).then(r => !!(r && !r.cancelled));
      },
      heldItem: () => { const it = iaHeldIt(); return it ? { name: it.name, level: it.level, bites: it.bites } : null; },
      catSweater: () => addCatSweater(),
      spin: () => { spinT = 0; },
      celebrate: () => {
        haptic('success');
        const s0 = toScreen(px, 1.6, pz), appR = G.app.getBoundingClientRect(), rr = root.getBoundingClientRect();
        G.sparkle(s0.x + rr.left - appR.left, s0.y + rr.top - appR.top, { kind: 'heart', n: 14, dist: 80 });
        if (iaBusy()) { celebrateAfter = true; return; }   // руки ещё берут — «ура» после
        hopT = 0;
      },
    };
    const useSpot = async sp => {
      if (spotBusy || !sp || finished) return;
      spotBusy = true; moveTo = null; pendingEnter = false; pendingSpot = null;
      try { if (o.onSpot) await o.onSpot(sp.id, spotApi); } catch (e) { /* ignore */ }
      spotBusy = false;
    };
    let jumps = 0;
    const puddleJump = () => {
      hopT = 0; haptic('medium'); reflHideT = 5; jumps++;
      for (let i = 0; i < 12; i++) { const d = put(scene, GEO.sphLo, SM.puddle, [px, 0.05, pz], [0.03, 0.03, 0.03]); d.castShadow = false; const a = i / 12 * PI * 2; drops.push({ m: d, vx: Math.cos(a) * 1.4, vy: 2.2 + Math.random(), vz: Math.sin(a) * 1.4, t: 0 }); }
      const L = (o.lines && o.lines.puddleSun) || []; if (L[1]) toast(L[1], 2600);
    };
    let twirls = 0;
    const startTwirl = lx => {
      twirl = { t: 0, cx: lx, cz: 3.25, x0: px, z0: pz, dir: px >= lx ? 1 : -1, a0: Math.atan2(px - lx, pz - 3.25) };
      twirls++; haptic('medium'); duskFlash();
      const LL = (o.lines && o.lines.lampList) || (o.lines && o.lines.lamp ? [o.lines.lamp] : []);
      if (LL.length) toast(LL[(twirls - 1) % LL.length], 2800);
    };
    const setHeroOpacity = a => {
      hero.mats.forEach(m => { if (!m.transparent) { m.transparent = true; m.needsUpdate = true; } m.opacity = a; });
      hero.faceMat.opacity = a;
      const hol = (hero.statue || hero.rig || {}).outline; if (hol) hol.visible = a > 0.97;
    };
    /* --- «Помахать»: героиня машет, ближний житель отвечает (облачка над головами) --- */
    const sayBubbles = [], tmpW = new T.Vector3();
    const sayBubble = (pos, text, cls, who) => {
      const el = document.createElement('div'); el.className = 'c3d-say' + (cls ? ' ' + cls : ''); el.textContent = text; root.appendChild(el);
      const b = { el, pos, t: 0, dur: 2.6 }; sayBubbles.push(b);
      if (G.voiceLine) { const v = G.voiceLine(who, text); for (let i = 0; i < text.length; i++) setTimeout(() => { if (!finished) v(i); }, 120 + i * 38); }
      return b;
    };
    const nearestNpc = maxD => {
      let best = null, bd = maxD;
      const consider = (id, r, n) => { if (!r || !r.visible) return; r.getWorldPosition(tmpW); const d = Math.hypot(tmpW.x - px, tmpW.z - pz); if (d < bd) { bd = d; best = { id, r, n }; } };
      if (RM) Object.keys(RM.npcs || {}).forEach(id => { const n = RM.npcs[id]; if (n && n.root) consider(id, n.root, n); });
      if (cat.root.visible) consider('cat', cat.root, null);
      if (poodle) consider('poodle', poodle, null);
      return best;
    };
    const topOf = obj => { const bb = new T.Box3().setFromObject(obj); return Math.max(0.5, bb.max.y); };
    const doWave = () => {
      if (!active || finished || blocked() || waveT >= 0) return;
      waveT = 0; if (!sitting && !hero.rig) { hopT = 0; if (hero.statue) spinT = 0; }   // скелетная героиня просто машет рукой
      haptic('light'); waveBtn.classList.remove('go'); void waveBtn.offsetWidth; waveBtn.classList.add('go');
      const nn = nearestNpc(3.4);
      const r = G.wave ? G.wave({ where: RM ? 'room' : 'street', room: o.room || null, npc: nn ? nn.id : null }) : { first: false, hi: 'Hi!', reply: null, name: '' };
      const intro = r.first || (nn && !greeted.has(nn.id));
      sayBubble(() => tmpW.set(px, 2.15 + (hero.body.position.y || 0), pz), intro ? r.hi : HI_AGAIN[waveN++ % HI_AGAIN.length], 'hero', 'hero');
      if (!nn) return;
      greeted.add(nn.id);
      const L = nn.id === 'cat' ? WAVE_REPLY.cat : WAVE_REPLY;
      let rep = typeof r.reply === 'string' ? r.reply : null;
      if (!rep) { const useName = intro && r.name && (G.nameOk ? G.nameOk() : true), list = useName ? L.name : L.plain; rep = list[waveN % list.length].replace('{name}', r.name || ''); }
      const h = topOf(nn.r) + 0.35, nr = nn.r;
      setTimeout(() => {
        if (finished) return;
        if (nn.n && nn.n.hop) nn.n.hop(); else if (nn.id === 'cat') { purr(); catHatT = 0; }
        sayBubble(() => { nr.getWorldPosition(tmpW); tmpW.y = h; return tmpW; }, rep, '', nn.id);
      }, 950);
    };
    waveBtn.addEventListener('click', e => { e.stopPropagation(); doWave(); });
    // у каждой двери свой колокольчик (нота пентатоники по имени двери)
    const doorChime = k => { let h = 0; String(k || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return [1046.5, 1174.66, 1318.5, 1568, 1760][h % 5]; };
    const finish = async () => {
      if (finished) return; finished = true; haptic('medium'); sfx('door'); sfx('chime', { f: doorChime(o.target) });
      act.classList.add('hidden'); bubble.classList.add('hidden'); edge.className = 'edge-arrow hidden';
      const d = doorOf(o.target), bd = buildings[(DOORS[o.target] && DOORS[o.target].bkey) || o.target] || { doors: [] };
      const x0 = px, z0 = pz, t0 = performance.now();
      hero.root.traverse(l => { if (l.isMesh && (l.material === outlineMat || l.userData.outline)) l.visible = false; });
      await new Promise(r => {
        const st = () => {
          const k = Math.min(1, (performance.now() - t0) / 950);
          bd.doors.forEach(dr => { dr.p.rotation.y = dr.open * Math.min(1, k * 2.4); });
          heroAng += angDiff(PI, heroAng) * 0.25;
          if (k > 0.2) { const kk = (k - 0.2) / 0.8; px = x0 + (d.x - x0) * kk; pz = z0 + ((FRONT_Z + 0.02) - z0) * kk; forceWalk = true; }
          if (k > 0.55) setHeroOpacity(1 - (k - 0.55) / 0.45);
          if (k < 1) requestAnimationFrame(st); else r();
        };
        st();
      });
      cleanup(); o.done(FREE ? { door: o.target } : undefined);
    };
    // прогулка: «← в меню» — сразу, без подтверждения
    const toMenu = () => { if (finished) return; finished = true; G.skipDialogs(true); closeOverlays(); setTimeout(() => G.skipDialogs(false), 400); cleanup(); o.done('menu'); };
    // комната: выйти через дверь (или кнопкой в HUD — тогда сразу, даже посреди реплик)
    const closeOverlays = () => document.querySelectorAll('#layer .dlg-wrap, #layer .modal, #layer .remark, #layer .intertitle').forEach(el => el.remove());
    const leave = async (fast, value = 'exit') => {
      if (finished) return; finished = true; haptic('light'); if (!fast) sfx('door');
      act.classList.add('hidden'); bubble.classList.add('hidden');
      if (fast) { G.skipDialogs(true); closeOverlays(); setTimeout(() => G.skipDialogs(false), 400); }
      else if (RM) {
        const x0 = px, z0 = pz, t0 = performance.now(), ex = RM.exit.x + (RM.exitDir ? RM.exitDir[0] : -0.9), ez = RM.exit.z + (RM.exitDir ? RM.exitDir[1] : 0);
        await new Promise(r => {
          const st = () => {
            const k = Math.min(1, (performance.now() - t0) / 700);
            px = x0 + (ex - x0) * k; pz = z0 + (ez - z0) * k; forceWalk = true; heroAng = Math.atan2(ex - x0, ez - z0);
            if (k > 0.4) setHeroOpacity(1 - (k - 0.4) / 0.6);
            if (k < 1) requestAnimationFrame(st); else r();
          };
          st();
        });
      }
      cleanup(); o.done(value);
    };
    const finishRoom = v => { if (finished) return; finished = true; act.classList.add('hidden'); bubble.classList.add('hidden'); cleanup(); o.done(v); };
    if (RM) { G.setHud({ label: o.hudLabel, onExit: () => { if (!finished) leave(true); }, top: true }); document.body.classList.add('room-on'); }
    if (FREE) G.setHud({ label: o.hudLabel, onExit: () => toMenu(), exitText: FO.exitText || '← в меню' });
    // метки: розовая точка (ещё не была) и золотая бирка «НОВОЕ» (изменилось на неделе)
    const doorMarks = [];
    if (FREE) Object.keys(DOORS).forEach(id => {
      const mk = DOORS[id].mark; if (!mk) return;
      let sp;
      if (mk === 'new') { const [dcv, dc] = cnv(64, 64); dc.fillStyle = '#F08FA8'; dc.beginPath(); dc.arc(32, 32, 24, 0, PI * 2); dc.fill(); dc.fillStyle = '#FFF6EE'; dc.beginPath(); dc.arc(25, 25, 7, 0, PI * 2); dc.fill(); sp = new T.Sprite(keep(new T.SpriteMaterial({ map: tex(dcv), depthTest: false, fog: false }))); sp.scale.setScalar(0.32); }
      else { const [fcv, fc] = cnv(192, 72); fc.fillStyle = '#9E6B2E'; rrect(fc, 0, 0, 192, 72, 20); fc.fill(); text(fc, 'НОВОЕ', 96, 38, 40, '#FFD98A'); sp = new T.Sprite(keep(new T.SpriteMaterial({ map: tex(fcv), depthTest: false, fog: false }))); sp.scale.set(0.72, 0.27, 1); }
      const d = doorOf(id); sp.position.set(d.x, 2.75, FRONT_Z + 0.25); sp.renderOrder = 9; scene.add(sp); doorMarks.push({ sp, ph: Math.random() * 6, y: 2.75 });
    });
    const tryEnter = () => {
      if (!active || finished || blocked()) return;
      const k = near();
      if (RM) {
        if (k === 'exit') { leave(false); return; }
        const sp0 = spotNear(); if (sp0) { useSpot(sp0); return; }
        haptic('light'); return;
      }
      if (isOpen(k)) { if (FREE) o.target = k; finish(); return; }
      if (FREE) { const sp1 = !k && spotNear(); if (sp1) { useSpot(sp1); return; } haptic('light'); if (k) toast(o.closedText || 'Здесь пока закрыто.', 1800); return; }
      const sp = !k && spotNear(); if (sp) { useSpot(sp); return; }
      if (!k && Math.hypot(px - PS.x, pz - PS.z) < PS.r * 0.8) { puddleJump(); return; }
      haptic('light');
      if (k && o.isLit(k)) toast('Здесь уже всё выяснили. Смотри, куда ведёт следующая метка.', 2000);
      else if (k) toast('Пока закрыто. Сюда ещё вернёмся.', 1800);
      else toast(`Тут не войти. Ищи ${o.nameText} по метке.`, 2200);
    };

    /* --- ввод: клавиатура --- */
    const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', 'ф': 'l', 'Ф': 'l', ArrowRight: 'r', d: 'r', D: 'r', 'в': 'r', 'В': 'r', ArrowUp: 'u', w: 'u', W: 'u', 'ц': 'u', 'Ц': 'u', ArrowDown: 'd', s: 'd', S: 'd', 'ы': 'd', 'Ы': 'd' };
    const kd = e => {
      if (finished) return;
      const k = KEYS[e.key];
      if (k) { held[k] = true; moveTo = null; pendingEnter = false; pendingTwirl = null; e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { if (e.defaultPrevented || blocked()) return; e.preventDefault(); tryEnter(); }
      else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') { if (!blocked()) doWave(); }
    };
    const ku = e => { const k = KEYS[e.key]; if (k) held[k] = false; };
    const blur = () => { held.l = held.r = held.u = held.d = false; joyVec = null; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);

    /* --- ввод: джойстик --- */
    let joyId = null, joyC = null;
    const joyMove = e => {
      if (joyId !== e.pointerId || !joyC) return;
      let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const len = Math.hypot(dx, dy), max = 42;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      joyVec = len > 8 ? { x: dx / max, z: dy / max } : null; moveTo = null; pendingEnter = false; pendingTwirl = null;
    };
    const joyStart = e => {
      if (!active || finished || blocked()) return;
      joyId = e.pointerId; const r = joy.getBoundingClientRect(); joyC = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      try { joy.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      joyMove(e); e.preventDefault();
    };
    const joyEnd = e => { if (joyId !== e.pointerId) return; joyId = null; joyVec = null; knob.style.transform = ''; };
    joy.addEventListener('pointerdown', joyStart); joy.addEventListener('pointermove', joyMove);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => joy.addEventListener(ev, joyEnd));
    act.addEventListener('click', e => { e.stopPropagation(); tryEnter(); });

    /* --- ввод: тап по миру --- */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
    const visibleChain = ob => { for (let x = ob; x; x = x.parent) if (!x.visible) return false; return true; };
    const keyOf = ob => { for (let x = ob; x; x = x.parent) if (x.userData && x.userData.key) return x.userData.key; return null; };
    canvas.addEventListener('click', async e => {
      idleAll = 0;
      if (finished || blocked()) return;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (interceptFn) {
        // свой рейкаст: попадают и спрайты, и точки, и инстансы; запас — ближайшая цель с userData.tap в 36 px
        let hh = ray.intersectObjects(scene.children, true).find(h => h.object.userData && h.object.userData.tap) || null;
        if (!hh) {
          let best = null, bd = 36; const tmp = new T.Vector3();
          scene.traverse(ob => { if (!ob.userData || !ob.userData.tap || !ob.visible) return; ob.getWorldPosition(tmp); const sc = toScreen(tmp.x, tmp.y, tmp.z); const d = Math.hypot(sc.x - (e.clientX - r.left), sc.y - (e.clientY - r.top)); if (d < bd) { bd = d; best = { object: ob, uv: null, point: tmp.clone() }; } });
          hh = best;
        }
        let used = false;
        try { used = !!interceptFn({ name: hh ? hh.object.userData.tap || null : null, uv: hh ? hh.uv : null, point: hh ? hh.point : null }); } catch (x) { /* ignore */ }
        if (used) return;
      }
      const hit = ray.intersectObjects(scene.children, true).find(h => !h.object.isPoints && !h.object.isSprite && !h.object.isInstancedMesh && visibleChain(h.object));
      const key = hit ? keyOf(hit.object) : null;
      const appR = G.app.getBoundingClientRect();
      if (key && key.indexOf('spot:') === 0 && active) {
        const sp = spots.find(q => 'spot:' + q.id === key);
        if (sp) { standUp(); if (Math.hypot(px - sp.x, pz - sp.z) < 1.4) useSpot(sp); else { moveTo = { x: sp.x, z: sp.z }; pendingEnter = false; pendingSpot = sp; } }
        return;
      }
      if (key && key.indexOf('npc:') === 0 && active) {
        const id = key.slice(4), npc = RM && RM.npcs[id];
        if (npc && npc.hop) npc.hop();
        G.sparkle(e.clientX - appR.left, e.clientY - appR.top, { kind: 'heart', n: 5, dist: 30 });
        if (o.onNpc && !spotBusy) { spotBusy = true; try { await o.onNpc(id, spotApi); } catch (x) { /* ignore */ } spotBusy = false; }
        return;
      }
      if (key === 'exitDoor' && active && RM) {
        standUp(); if (near() === 'exit') leave(false); else { moveTo = { x: RM.exit.x, z: RM.exit.z }; pendingEnter = true; }
        return;
      }
      if (key && key.indexOf('pick:') === 0) {
        const pk = pickups.find(q => 'pick:' + q.p.id === key && !q.taken);
        if (pk && active) { if (Math.hypot(px - pk.p.x, pz - pk.p.z) < 1.2) collect(pk); else { moveTo = { x: Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, pk.p.x)), z: Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, pk.p.z)) }; pendingEnter = false; } }
        return;
      }
      if (key === 'secret' && secretMesh) { scene.remove(secretMesh); secretMesh = null; await o.onSecret(); return; }
      if (FREE && (key === 'weather' || key === 'kiosk' || key === 'mail')) {
        const sid = key === 'mail' ? 'mailbox' : key, sp = spots.find(q => q.id === sid);
        if (sp && active) { standUp(); if (Math.hypot(px - sp.x, pz - sp.z) < 1.4) useSpot(sp); else { moveTo = { x: sp.x, z: sp.z }; pendingEnter = false; pendingSpot = sp; } }
        return;
      }
      if (FREE && key === 'cat' && FO.catAt && o.onNpc) { haptic('light'); if (!spotBusy) { spotBusy = true; try { await o.onNpc('cat', spotApi); } catch (x) { /* ignore */ } spotBusy = false; } return; }
      if (key === 'weather') { haptic('light'); const L = o.weatherLines && o.weatherLines.length ? o.weatherLines : [o.weatherText]; toast(L[wIdx++ % L.length], 3400); return; }
      if (key === 'kiosk') { haptic('light'); const L = o.headlines && o.headlines.length ? o.headlines : [o.headline]; toast(L[kIdx++ % L.length], 3400); return; }
      if (key === 'poodle' && poodle) {
        haptic('light'); poodleSpin = 0; poodleFollow = 10; G.sparkle(e.clientX - appR.left, e.clientY - appR.top, { kind: 'heart', n: 8, dist: 40 });
        const L = (o.lines && o.lines.poodle) || ['Пудель!']; toast(L[Math.min(poodleTaps++, L.length - 1)], 3000); hopT = 0; return;
      }
      if (key === 'sunflower') { haptic('light'); const L = (o.lines && o.lines.sunflower) || []; if (L.length) toast(LI >= 3 && L[2] ? L[2] : L[sfIdx++ % 2], 3200); return; }
      if (key === 'puddleSun') { haptic('light'); const L = (o.lines && o.lines.puddleSun) || []; if (L[0]) toast(L[0], 3000); return; }
      if (key === 'silver') { haptic('light'); toast('За стеклом часы спорят, который час. Кукушка пока молчит: ждёт, кто победит.', 3600); return; }
      if (key === 'mail') { haptic('light'); toast('В ящике открытка без подписи. Даже почта решила добавить интриги.', 3200); return; }
      if (key === 'cat') {
        pets++; haptic('light'); G.sparkle(e.clientX - appR.left, e.clientY - appR.top, { kind: 'heart', n: 5, dist: 30 }); purr(); catHatT = 0;
        const CL = (o.lines && o.lines.catPets) || [];
        toast(pets === 5 && o.lines && o.lines.catTooMuch ? o.lines.catTooMuch : pets === 7 && CL[2] ? CL[2] : pets === 1 && CL[0] ? CL[0] : `Поглаживаний: ${pets}. Кот уверен, что вдвое меньше.`, 2200); return;
      }
      if (key === 'lamp' && active && !twirl && hit) {
        const lx = LAMPS.reduce((b, x) => (Math.abs(x - hit.point.x) < Math.abs(b - hit.point.x) ? x : b), LAMPS[0]);
        if (Math.hypot(px - lx, pz - 3.25) < 0.8) startTwirl(lx);
        else { moveTo = { x: Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, lx + (px > lx ? 0.42 : -0.42))), z: 2.9 }; pendingEnter = false; pendingTwirl = lx; }
        return;
      }
      if (key === 'hero') {
        if (active && !RM && isOpen(near())) { if (FREE) o.target = near(); finish(); return; }
        haptic('light'); hopT = 0; toast(o.heroLine, 2200); return;
      }
      if (!active) return;
      if (sitting) { spotApi.stand(); return; }
      pendingTwirl = null;
      const dk = !RM && key ? (FREE ? BKEY2DOOR[key.indexOf('door:') === 0 ? key.slice(5) : key] : (B[key] !== undefined ? key : null)) : null;
      if (dk) { if (near() === dk && isOpen(dk)) { tryEnter(); return; } const d = doorOf(dk); moveTo = { x: d.x, z: d.z }; pendingEnter = false; return; }
      if (ray.ray.intersectPlane(groundPlane, hitP)) {
        moveTo = { x: Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, hitP.x)), z: Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, hitP.z)) }; pendingEnter = false;
      }
    });

    /* --- качество: если телефон не тянет — без теней и с меньшим разрешением --- */
    let qFrames = [], qDone = false;
    const dropQuality = () => {
      renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; sun.castShadow = false;
      scene.traverse(ob => { if (ob.material) [].concat(ob.material).forEach(m => { m.needsUpdate = true; }); });
      blobMat.opacity = 1.4; resize();
    };

    // мебель комнаты: прямоугольники-препятствия; путь в обход — A* по сетке 0.25 м
    const HR = 0.24;
    const blocked2 = (x, z) => !!(RM && RM.blockers && RM.blockers.some(b => x > b.x0 - HR && x < b.x1 + HR && z > b.z0 - HR && z < b.z1 + HR));
    const planPath = (x0, z0, x1, z1) => {
      if (!RM || !RM.blockers || !RM.blockers.length) return null;
      const C = 0.25, gx0 = BOUNDS.x0, gz0 = BOUNDS.z0, NX = Math.max(1, Math.round((BOUNDS.x1 - gx0) / C) + 1), NZ = Math.max(1, Math.round((BOUNDS.z1 - gz0) / C) + 1);
      const cell = (x, z) => [Math.max(0, Math.min(NX - 1, Math.round((x - gx0) / C))), Math.max(0, Math.min(NZ - 1, Math.round((z - gz0) / C)))];
      const free = (i, j) => !blocked2(gx0 + i * C, gz0 + j * C);
      let [si, sj] = cell(x0, z0), [ti, tj] = cell(x1, z1);
      if (!free(ti, tj)) { // цель в мебели — ближайшая свободная клетка
        let best = null, bd = 1e9;
        for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (free(i, j)) { const d = (i - ti) ** 2 + (j - tj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
        if (!best) return null; [ti, tj] = best;
      }
      const K = (i, j) => j * NX + i, g = new Float32Array(NX * NZ).fill(1e9), from = new Int32Array(NX * NZ).fill(-1), closed = new Uint8Array(NX * NZ);
      const open = [[si, sj]]; g[K(si, sj)] = 0;
      const hh = (i, j) => Math.hypot(i - ti, j - tj);
      let found = false, guard = 0;
      while (open.length && guard++ < 6000) {
        let bi = 0; for (let q = 1; q < open.length; q++) if (g[K(open[q][0], open[q][1])] + hh(open[q][0], open[q][1]) < g[K(open[bi][0], open[bi][1])] + hh(open[bi][0], open[bi][1])) bi = q;
        const [ci, cj] = open.splice(bi, 1)[0], ck = K(ci, cj);
        if (closed[ck]) continue; closed[ck] = 1;
        if (ci === ti && cj === tj) { found = true; break; }
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue; const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
          const nk = K(ni, nj); if (closed[nk] || !free(ni, nj)) continue;
          if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
          const ng = g[ck] + (di && dj ? 1.414 : 1);
          if (ng < g[nk]) { g[nk] = ng; from[nk] = ck; open.push([ni, nj]); }
        }
      }
      if (!found) return null;
      const pts = []; for (let k = K(ti, tj); k >= 0 && k !== K(si, sj); k = from[k]) pts.push({ x: gx0 + (k % NX) * C, z: gz0 + Math.floor(k / NX) * C });
      pts.reverse();
      // сглаживание: выкидываем точки, если до следующей видно напрямую
      const los = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1); for (let q = 1; q < n; q++) { const t2 = q / n; if (blocked2(a.x + (b.x - a.x) * t2, a.z + (b.z - a.z) * t2)) return false; } return true; };
      const out = []; let cur = { x: x0, z: z0 };
      for (let q = 0; q < pts.length; q++) { if (q === pts.length - 1 || !los(cur, pts[q + 1])) { out.push(pts[q]); cur = pts[q]; } }
      return out;
    };
    let path = null, pathFor = null, stuckT = 0, lastD = 1e9;
    if (RM && RM.blockers && blocked2(px, pz)) {
      let best = null, bd = 1e9;
      for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 0.25) for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += 0.25) if (!blocked2(x, z)) { const d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = [x, z]; } }
      if (best) { console.warn('spawn inside furniture → snapped', o.room); px = best[0]; pz = best[1]; }
    }
    const roomCtx = { get px() { return px; }, get pz() { return pz; }, get heroAng() { return heroAng; }, camera, scene, hero, cat, api: spotApi };

    /* --- игровой цикл --- */
    // скорости героини (HeroAnim.SPEEDS, волна 3): шаг 2,0 м/с, трусца 3,0; джойстик — шаг до 85% наклона, дальше трусца
    const HS = (window.HeroAnim && window.HeroAnim.SPEEDS) || { walk: 2.0, jog: 3.0, run: 3.4 };
    const joySpeed = m => (m <= 0.85 ? HS.walk * m / 0.85 : HS.walk + (HS.jog - HS.walk) * (m - 0.85) / 0.15);
    let SPEED = HS.walk;
    const proj = new T.Vector3();
    const toScreen = (x, y, z) => { proj.set(x, y, z).project(camera); return { x: (proj.x + 1) / 2 * root.clientWidth, y: (1 - proj.y) / 2 * root.clientHeight }; };
    const leafM = new T.Matrix4(), leafQ = new T.Quaternion(), leafE = new T.Euler(), leafS = new T.Vector3(), leafP = new T.Vector3();
    let last = performance.now(), raf = 0;
    const tick = now => {
      if (!renderer) return;
      const rawDt = Math.max(0, (now - last) / 1000), dt = Math.min(0.12, rawDt); last = now;
      const t = now / 1000;
      let vx = 0, vz = 0;
      if (sitting && (joyVec || held.l || held.r || held.u || held.d) && !iaBusy()) spotApi.stand();
      // волна 4: руки заняты (взять, съесть) — стоим; палец на джойстике или стрелки — один мягкий cancel
      if (iaBusy()) { if ((joyVec || held.l || held.r || held.u || held.d) && !iaCancelled && active && !finished) { iaCancelled = true; IA.cancel(); } }
      else iaCancelled = false;
      // скука: 25 с без действий на улице прогулки → кот ведёт к двери или стрелка у края
      if (FREE && active && !finished) {
        if (joyVec || held.l || held.r || held.u || held.d || moveTo || blocked()) { idleAll = 0; if (hintShown) { hintShown = false; if (o.catHelper) catPin = null; } }
        else idleAll += dt;
        if (!hintShown && idleAll > 25 && FO.hintDoor && DOORS[FO.hintDoor]) {
          hintShown = true; const hd = doorOf(FO.hintDoor);
          if (cat.root.visible && o.catHelper) { catPin = { x: hd.x + 0.5, z: hd.z + 0.3, ry: PI }; toast('Мяу? (Кот сел у двери: «' + doorLabel(FO.hintDoor) + '».)', 2600); }
        }
      }
      if ((active || walkWaiters.length) && !finished && (!blocked() || walkWaiters.length) && !twirl && !sitting && !iaBusy()) {
        // скорость: джойстик — шаг до 85% наклона, дальше трусца; стрелки — трусца; тап — в комнате и близко шаг,
        // далеко на улице (> 6 м) — трусца. (vx, vz) несут наклон m, поэтому SPEED = нужная скорость / m
        { const m = joyVec ? Math.min(1, Math.hypot(joyVec.x, joyVec.z)) : 0;
          SPEED = joyVec ? joySpeed(m) / Math.max(1e-3, m) : (held.l || held.r || held.u || held.d) ? HS.jog
            : moveTo && !RM && Math.hypot(moveTo.x - px, moveTo.z - pz) > 6 ? HS.jog : HS.walk; }
        if (joyVec) { vx = joyVec.x; vz = joyVec.z; }
        else {
          vx = (held.r ? 1 : 0) - (held.l ? 1 : 0); vz = (held.d ? 1 : 0) - (held.u ? 1 : 0);
          if (!vx && !vz && moveTo) {
            if (RM && RM.blockers && pathFor !== moveTo) { pathFor = moveTo; path = planPath(px, pz, moveTo.x, moveTo.z); stuckT = 0; lastD = 1e9; if (path && path.length) { const e2 = path[path.length - 1]; if (Math.hypot(e2.x - moveTo.x, e2.z - moveTo.z) > 0.2) { moveTo.x = e2.x; moveTo.z = e2.z; } } }
            let tg = moveTo;
            if (path && path.length > 1) { if (Math.hypot(path[0].x - px, path[0].z - pz) < 0.16) path.shift(); if (path.length > 1) tg = path[0]; }
            const dx = tg.x - px, dz = tg.z - pz, d = Math.hypot(dx, dz);
            // застряла — отменяем цель (чтобы не топталась у кресла)
            { const dm = Math.hypot(moveTo.x - px, moveTo.z - pz); if (pathFor !== moveTo && !RM) { pathFor = moveTo; stuckT = 0; lastD = 1e9; } if (dm > lastD - 0.002) stuckT += dt; else stuckT = 0; lastD = Math.min(lastD, dm); if (stuckT > (RM ? 0.7 : 1.2)) { moveTo = null; path = null; pendingSpot = null; if (walkWaiters.length) { walkWaiters.forEach(r => r()); walkWaiters = []; } } }
            if (!moveTo) { /* отменено */ }
            else if (tg === moveTo && d < 0.08) { moveTo = null; path = null; if (walkWaiters.length) { walkWaiters.forEach(r => r()); walkWaiters = []; } if (pendingEnter) { pendingEnter = false; tryEnter(); } if (pendingTwirl !== null) { const l = pendingTwirl; pendingTwirl = null; startTwirl(l); } if (pendingSpot) { const q = pendingSpot; pendingSpot = null; useSpot(q); } }
            else { const k = Math.min(1, d / Math.max(1e-4, SPEED * dt)); vx = dx / d * k; vz = dz / d * k; }
          }
        }
        const len = Math.hypot(vx, vz);
        if (len > 1) { vx /= len; vz /= len; }
        let nx = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, px + vx * SPEED * dt)), nz = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, pz + vz * SPEED * dt));
        if (RM && RM.blockers && blocked2(nx, nz)) { if (!blocked2(nx, pz)) nz = pz; else if (!blocked2(px, nz)) nx = px; else { nx = px; nz = pz; } }
        if (!RM && vz < -0.5 && nz <= BOUNDS.z0 + 0.001 && isOpen(near())) { pushT += dt; if (pushT > 0.25) tryEnter(); } else pushT = 0;
        px = nx; pz = nz;
      }
      if (twirl) {
        twirl.t += dt; const k = Math.min(1, twirl.t / 1.5), a = twirl.a0 + k * PI * 2 * twirl.dir;
        px = twirl.cx + Math.sin(a) * 0.48; pz = twirl.cz + Math.cos(a) * 0.48;
        heroAng = Math.atan2(Math.cos(a) * twirl.dir, -Math.sin(a) * twirl.dir); faceTarget = heroAng;
        if (k >= 1) { px = twirl.x0; pz = twirl.z0; twirl = null; }
      }
      // лужи: плюх (один раз за прогулку — с репликой)
      const pi = PUDDLES.findIndex(([x, z, r]) => Math.hypot((px - x) / r, (pz - z) / (r * 0.6)) < 1);
      if (pi >= 0 && pi !== inPuddle && Math.hypot(vx, vz) > 0.15) {
        for (let i = 0; i < 9; i++) { const d = put(scene, GEO.sphLo, SM.puddle, [px, 0.05, pz], [0.03, 0.03, 0.03]); d.castShadow = false; const a = i / 9 * PI * 2; drops.push({ m: d, vx: Math.cos(a) * 1.2, vy: 2 + Math.random(), vz: Math.sin(a) * 1.2, t: 0 }); }
        haptic('light'); splashes++;
        const isSun = Math.hypot(px - PS.x, pz - PS.z) < PS.r;
        if (isSun) { reflHideT = 5; if (psFirst && o.lines && o.lines.puddleSun && o.lines.puddleSun[2]) { psFirst = false; toast(o.lines.puddleSun[2], 2800); } }
        else if (!splashed) { splashed = true; if (o.lines && o.lines.puddle) toast(o.lines.puddle, 2600); }
        else if (o.rain && splashes === 2 && o.lines && o.lines.petrichor) toast(o.lines.petrichor, 3200);
      }
      inPuddle = pi;
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; d.vy -= 9 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; if (d.m.position.y < 0) { scene.remove(d.m); drops.splice(i, 1); } }
      // кучки листьев: шурх!
      const li = PILES.findIndex(([x, z, r]) => Math.hypot(px - x, pz - z) < r + 0.12);
      if (li >= 0 && li !== inPile && Math.hypot(vx, vz) > 0.15) {
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, m = put(scene, leafUp, kickM[i % 4], [px, 0.15, pz], [0.12, 0.12, 1], [Math.random() * 3, Math.random() * 3, 0]); m.castShadow = false;
          kicks.push({ m, vx: Math.cos(a) * 1.3 + vx * 0.8, vy: 1.8 + Math.random() * 0.9, vz: Math.sin(a) * 0.8 + vz * 0.8, sp: 4 + Math.random() * 5, t: 0 }); }
        haptic('light'); if (!kicked) { kicked = true; toast((o.lines && o.lines.leaves) || 'Шурх! Осень только что проиграла тебе в шуршании.', 2200); }
      }
      inPile = li;
      for (let i = kicks.length - 1; i >= 0; i--) {
        const k = kicks[i], m = k.m; k.t += dt;
        if (m.position.y > 0.012) { k.vy -= 4.2 * dt; k.vx *= 0.98; k.vz *= 0.98; m.position.x += k.vx * dt; m.position.y += k.vy * dt; m.position.z += k.vz * dt; m.rotation.x += k.sp * dt; m.rotation.y += k.sp * 0.6 * dt; }
        else { m.position.y = 0.012; m.rotation.set(-PI / 2, 0, k.sp); if (k.t > 3) { scene.remove(m); kicks.splice(i, 1); } }
      }
      const moving = Math.hypot(vx, vz) > 0.15 || forceWalk || !!twirl;
      if (moving) { idleT = 0; walking = true; if (!forceWalk) faceTarget = Math.atan2(vx, vz); phase += dt * 10.5; }
      else { idleT += dt; if (idleT > 0.15) walking = false; }
      if (!walking && !finished && !iaBusy()) faceTarget = sitting ? sitting.ry : faceLock !== null ? faceLock : Math.atan2(camera.position.x - px, camera.position.z - pz);
      if (walking) faceLock = null;
      if (spinT >= 0) { spinT += dt; heroAng += dt * PI * 2 / 0.8; if (spinT > 0.8) spinT = -1; }
      else if (!finished && !twirl) heroAng += angDiff(faceTarget, heroAng) * Math.min(1, dt * 11);
      // героиня: шаг, дыхание, моргание, оглядывается
      walkAmt += ((walking ? 1 : 0) - walkAmt) * Math.min(1, dt * 10);
      const sw = Math.sin(phase) * walkAmt;
      let hop = 0; if (hopT >= 0) { hopT += dt; hop = Math.sin(Math.min(1, hopT / 0.4) * PI) * 0.16; if (hopT > 0.4) hopT = -1; }
      let waveK = 0; if (waveT >= 0) { waveT += dt; waveK = Math.sin(Math.min(1, waveT / 1.5) * PI); if (waveT > 1.5) waveT = -1; }
      // тихие шаги: на каждой смене ноги
      if (walking && !sitting && !twirl && !hero.rig) { const si = Math.floor(phase / PI); if (si !== stepIdx) { stepIdx = si; sfx('step', { surface: RM ? 'wood' : 'stone' }); } }
      if (hero.rig) {
        // героиня со скелетом (js/hero_anim.js): скорость — по настоящему смещению за кадр (шаг ↔ бег, стопы не скользят),
        // посадка — поза стула или «откинувшись», «помахать» — левой рукой, находка/лужа — прыжок «ура», предмет в руке
        const R = hero.rig;
        const dd = R.prev ? Math.hypot(px - R.prev.x, pz - R.prev.z) : 0;
        const sp = dd > 0.6 ? 0 : dd / Math.max(1e-3, dt);   // скачок (встала со стула) — не бег
        R.spd += (Math.min(sp, 6) - R.spd) * Math.min(1, dt * 12);
        const tr = R.prev && dt > 0 ? angDiff(heroAng, R.prev.a) / dt : 0;
        R.prev = { x: px, z: pz, a: heroAng };
        R.sit += ((sitting ? 1 : 0) - R.sit) * Math.min(1, dt * 7);
        const sk = R.sit < 0.002 ? 0 : R.sit > 0.998 ? 1 : R.sit, sitE = sk * sk * (3 - 2 * sk);
        let sniff = 0;   // с букетом: иногда подносит к лицу
        if (heldKind === 'bouquet' && !walking && !twirl && !finished && !sitting) { smellNext -= dt; if (smellNext <= 0 && smellT < 0) { smellT = 0; smellNext = 7 + Math.random() * 5; } }
        if (smellT >= 0) { smellT += dt; sniff = Math.sin(Math.min(1, smellT / 1.6) * PI); if (smellT > 1.6) smellT = -1; }
        const ast = {
          speed: sitting ? 0 : R.spd, sitting: !!sitting, sitPose: sitting && (sitting.recline || 0) > 0.15 ? 'recline' : 'chair',
          waving: waveT >= 0, turnRate: tr, celebrate: hopT >= 0, idle: !walking && !sitting && active && !finished && !blocked(),
          carry: heldKind ? (heldKind === 'bouquet' ? 'bouquet' : heldKind === 'can' && IA && iaHeldIt() ? false : 'item') : false, sniff,   // лейка в настоящей руке — висит в опущенной руке
        };
        R.anim.update(dt, IA ? IA.animState(ast) : ast);   // руки: на время действия слой подменяет скорость, поворот и позу
        if (R.anim.step !== R.step) { R.step = R.anim.step; if (!sitting && !twirl && R.spd > 0.3) sfx('step', { surface: RM ? 'wood' : 'stone' }); }
        const seatY = sitting ? sitting.h + R.seat - R.hip : R.seatY || 0;
        if (sitting) R.seatY = seatY;
        hero.body.position.y = seatY * sitE;
        hero.body.rotation.z = twirl ? -0.18 * twirl.dir : 0;
        hero.body.rotation.x = -Math.max(0, ((sitting && sitting.recline) || 0) - 0.24) * sitE;   // поза «откинувшись» уже даёт ~0.24 рад
        hero.body.scale.y = 1;
        // предмет в руке держится почти ровно (как бы кисть ни повернулась), но чуть качается вместе с ней
        const inner = hero.arms[0].inner;
        if (inner.children.length) {
          const b = R.anim.bones, q = R.q.identity();
          ['hips', 'spine', 'chest', 'shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L'].forEach(n => q.multiply(b[n].quaternion));
          R.qa.identity().slerp(q, 0.25); inner.quaternion.copy(q.invert()).multiply(R.qa);
        }
        // шапка поверх запечённого берета (как у статуэтки)
        R.cap += ((hero.beret.visible ? 0 : 1) - R.cap) * Math.min(1, dt * 10);
        if (headG) { headG.position.y = 0.13 * R.cap; headG.scale.setScalar(1 + 0.14 * R.cap); }
      } else if (hero.statue) {
        // статуэтка: игрушечный шаг (ноги качаются в шейдере, тело переваливается ±6° и подпрыгивает), посадка — «присела»
        const S = hero.statue, U = S.U;
        S.sit += ((sitting ? 1 : 0) - S.sit) * Math.min(1, dt * 7);
        const sk = S.sit < 0.002 ? 0 : S.sit > 0.998 ? 1 : S.sit, sitE = sk * sk * (3 - 2 * sk);
        U.hdSit.value = sitE;
        U.hdSwing.value = sw * 0.42;
        const seatY = sitting ? sitting.h + 0.12 - U.hdRig.value.y : S.seatY || 0;
        if (sitting) S.seatY = seatY;
        hero.body.position.y = Math.abs(Math.sin(phase)) * 0.035 * walkAmt + hop + seatY * sitE;
        hero.body.rotation.z = twirl ? -0.18 * twirl.dir : Math.sin(phase) * 0.105 * walkAmt + Math.sin(t * 15) * 0.1 * waveK;
        hero.body.rotation.x = sitting ? -(sitting.recline || 0) - 0.05 * sitE : 0.06 * walkAmt;
        hero.body.scale.y = 1 + Math.sin(t * 2.2) * 0.005 * (1 - walkAmt) * (1 - sitE);
        hero.arms.forEach(a => heroDeformPt(a.pv.position, a.pv.userData.p0, U));   // кисти (и то, что в руке) — туда же, куда шейдер
        hero.arms[0].pv.rotation.x = Math.sin(phase) * 0.12 * walkAmt;               // предмет в руке чуть качается в такт
        // берет спрятан (ателье надело шапку): у модели берет запечён, поэтому шапка садится поверх него
        S.cap = (S.cap || 0) + ((hero.beret.visible ? 0 : 1) - (S.cap || 0)) * Math.min(1, dt * 10);
        if (headG) { headG.position.y = 0.13 * S.cap; headG.scale.setScalar(1 + 0.14 * S.cap); }
      } else {
        hero.legs[0].rotation.x = sw * 0.6; hero.legs[1].rotation.x = -sw * 0.6;
        hero.arms[0].pv.rotation.x = -sw * 0.5; hero.arms[1].pv.rotation.x = sw * 0.5;
        hero.arms[0].pv.rotation.z = twirl && twirl.dir < 0 ? -2.1 : 0; hero.arms[1].pv.rotation.z = twirl && twirl.dir > 0 ? 2.1 : 0;
        // помахать: левая рука вверх и туда-сюда
        if (waveK > 0) { hero.arms[1].pv.rotation.z = 2.5 * Math.min(1, waveK * 2.5); hero.arms[1].pv.rotation.x = 0; hero.arms[1].inner.rotation.z = 0.13 + Math.sin(t * 14) * 0.38 * waveK; }
        else hero.arms[1].inner.rotation.z = 0.13;
        hero.body.rotation.z = twirl ? -0.18 * twirl.dir : 0;
        hero.body.position.y = Math.abs(Math.cos(phase)) * 0.04 * walkAmt + hop;
        hero.body.rotation.x = 0.07 * walkAmt;
        hero.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.006 * (1 - walkAmt);
        glanceT -= dt;
        if (glanceT <= 0) {
          if (glance || walking) { glance = 0; glanceT = 3 + Math.random() * 3; }
          else { glance = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.3); glanceT = 1.3; }
        }
        hero.head.rotation.y += ((walking ? 0 : glance) - hero.head.rotation.y) * Math.min(1, dt * 4);
        hero.head.rotation.z = Math.sin(t * 0.9) * 0.035 * (1 - walkAmt);
        hero.curtain.rotation.x = (-0.05 + Math.sin(phase * 2) * 0.015) * walkAmt;
        blinkT -= dt;
        if (blinkT <= 0) { eyesClosed = !eyesClosed; hero.faceMat.map = eyesClosed ? hero.faceClosed : hero.faceOpen; blinkT = eyesClosed ? 0.12 : 2.2 + Math.random() * 2.8; }
        if (sitting) {
          hero.legs[0].rotation.x = hero.legs[1].rotation.x = -1.45;
          hero.body.position.y = sitting.h - 0.43 + 0.04; hero.body.rotation.x = -(sitting.recline || 0);
          if (heldKind !== 'bouquet') { hero.arms[0].pv.rotation.x = -0.35; hero.arms[1].pv.rotation.x = -0.35; }
        }
      }
      hero.root.position.set(px, iaDy, pz); hero.root.rotation.y = heroAng;
      heroBlob.position.set(px, 0.012, pz);
      if (IA) {
        IA.update(dt);   // ПОСЛЕ anim.update и корня: IK рук, присед, предмет в кисти
        if (!iaBusy()) {
          if (celebrateAfter) { celebrateAfter = false; hopT = 0; if (hero.rig) hero.rig.anim.celebrate(); }
          // стоит или сидит с покупкой — иногда ест или отпивает (попкорн «по зёрнышку», какао — глоток)
          if (heldKind && IA_ITEM[heldKind] && !walking && active && !finished && !spotBusy && !blocked()) { nibbleT -= dt; if (nibbleT <= 0) { nibbleT = 7 + Math.random() * 4; iaNibble(); } }
        }
      }
      // кот догоняет
      if (cat.root.visible) {
        if (catPin) {
          catTX = catPin.x; catTZ = catPin.z;
          if (Math.hypot(catX - catPin.x, catZ - catPin.z) < 0.08) { if (catPin.ry !== undefined) catAng += angDiff(catPin.ry, catAng) * Math.min(1, dt * 6); if (catPinWait.length) { catPinWait.forEach(r => r()); catPinWait = []; } }
        } else if (walking && !forceWalk) {
          const l = Math.hypot(vx, vz) || 1;
          const ux = vx / l, uz = vz / l;
          catTX = px - ux * 0.9 - uz * 0.45; catTZ = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1 + 0.3, pz - uz * 0.9 + ux * 0.45 + 0.15));
        } else if (idleT > 0.6) { catTX = px - 0.75; catTZ = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1 + 0.3, pz + 0.25)); }
        const dx = catTX - catX, dz = catTZ - catZ, cm = Math.hypot(dx, dz) > 0.05;
        catX += dx * Math.min(1, dt * 3); catZ += dz * Math.min(1, dt * 3);
        const cTarget = cm ? Math.atan2(dx, dz) : Math.atan2(camera.position.x - catX, camera.position.z - catZ);
        catAng += angDiff(cTarget, catAng) * Math.min(1, dt * 8);
        // catSpot.y / catTo({y}) — кот запрыгивает на подоконник, батарею, полку
        const cty = catPin && catPin.y && Math.hypot(catX - catPin.x, catZ - catPin.z) < 0.35 ? catPin.y : 0;
        catY += (cty - catY) * Math.min(1, dt * 9);
        cat.root.position.set(catX, catY, catZ); cat.root.rotation.y = catAng;
        cat.body.position.y = cm ? Math.abs(Math.sin(t * 13)) * 0.03 : 0;
        cat.paws.forEach((p, i) => { p.position.y = 0.035 + (cm ? Math.max(0, Math.sin(t * 13 + (i % 2 ? PI : 0) + (i > 1 ? PI : 0))) * 0.03 : 0); });
        cat.tail.rotation.z = Math.sin(t * 4) * 0.4;
        cat.head.rotation.z = Math.sin(t * 0.7) * 0.08;
        catBlinkT -= dt;
        if (catBlinkT <= 0) { catEyes = !catEyes; cat.faceMat.map = catEyes ? cat.faceClosed : cat.faceOpen; catBlinkT = catEyes ? 0.15 : 2.5 + Math.random() * 3; }
        catBlob.position.set(catX, 0.011, catZ);
      }
      // пудель гуляет по кругу, после поглаживания кружится и идёт следом
      if (poodle) {
        let tx2, tz2;
        if (poodleFollow > 0) { poodleFollow -= dt; tx2 = px - 0.7; tz2 = Math.min(BOUNDS.z1, pz + 0.5); }
        else { poodleT += dt * 0.06; const n = PLOOP.length, f = (((poodleT % 1) + 1) % 1) * n, i0 = Math.min(n - 1, Math.floor(f)), a = PLOOP[i0], b = PLOOP[(i0 + 1) % n], k = f - i0; tx2 = a[0] + (b[0] - a[0]) * k; tz2 = a[1] + (b[1] - a[1]) * k; }
        const dxp = tx2 - poodlePos.x, dzp = tz2 - poodlePos.z, dp = Math.hypot(dxp, dzp);
        if (dp > 0.02) { const sp = Math.min(dp, dt * (poodleFollow > 0 ? 3 : 0.9)); poodlePos.x += dxp / dp * sp; poodlePos.z += dzp / dp * sp; }
        let pAng = dp > 0.03 ? Math.atan2(dxp, dzp) : Math.atan2(camera.position.x - poodlePos.x, camera.position.z - poodlePos.z);
        if (poodleSpin >= 0) { poodleSpin += dt; pAng += poodleSpin * 12; poodle.userData.body.position.y = Math.abs(Math.sin(poodleSpin * 8)) * 0.06; if (poodleSpin > 1.2) poodleSpin = -1; }
        else poodle.userData.body.position.y = dp > 0.03 ? Math.abs(Math.sin(t * 14)) * 0.02 : 0;
        poodle.position.copy(poodlePos); poodle.rotation.y = pAng;
        poodle.userData.head.rotation.z = Math.sin(t * 2) * 0.1;
        const gx = poodlePos.x - Math.sin(pAng) * 0.35, gz = poodlePos.z - Math.cos(pAng) * 0.35;
        goslingPos.x += (gx - goslingPos.x) * Math.min(1, dt * 2.5); goslingPos.z += (gz - goslingPos.z) * Math.min(1, dt * 2.5);
        gosling.position.set(goslingPos.x, Math.abs(Math.sin(t * 10)) * 0.015, goslingPos.z); gosling.rotation.set(0, Math.atan2(poodlePos.x - goslingPos.x, poodlePos.z - goslingPos.z), Math.sin(t * 10) * 0.12);
      }
      // подсолнух
      if (sunflower) { const sfm = sunflower.children[0]; if (sfm) { /* склеен целиком — качаем всю группу мягко */ }
        const wantRoof = LI >= 3; const yaw = wantRoof ? Math.atan2(22.6 - 8.9, 1.2) * 0.6 : Math.sin(t * 0.5) * 0.5;
        sunflower.rotation.y += (yaw - sunflower.rotation.y) * Math.min(1, dt * 1.5); sunflower.rotation.z = Math.sin(t * 0.9) * 0.03; }
      // отражение солнца в луже
      if (reflHideT > 0) reflHideT -= dt;
      if (sunRefl) { sunRefl.visible = sunReflHalo.visible = reflHideT <= 0; sunRefl.material.opacity = 0.75 + Math.sin(t * 2) * 0.15; }
      // мурчание и шляпа кота
      for (let i = purrs.length - 1; i >= 0; i--) { const q = purrs[i]; q.t += dt; if (q.t < 0) { q.m.visible = false; continue; } q.m.visible = true; const k = q.t / 0.9; q.m.scale.setScalar(1 + k * 2); q.m.material.opacity = 0.7 * (1 - k); q.m.position.set(catX, 0.3, catZ); if (k >= 1) { scene.remove(q.m); purrs.splice(i, 1); } }
      if (catHatT >= 0) { catHatT += dt; const hg = cat.head.children.find(c => c.isGroup); if (hg) hg.position.y = 0.145 + Math.sin(Math.min(1, catHatT / 0.8) * PI) * 0.03; if (catHatT > 0.8) catHatT = -1; }
      // пчёлка у тележки
      if (beeG) {
        beeG.userData.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 38) * 0.5; });
        beeG.userData.body.position.y = Math.sin(t * 2.4) * 0.06; beeG.userData.body.position.x = Math.sin(t * 1.1) * 0.08;
        beeG.rotation.y = Math.atan2(px - beeG.position.x, pz - beeG.position.z) * 0.8;
      }
      if (active && !finished && !spotBusy && !blocked()) {
        const sp = spotNear();
        if (sp && sp.auto && !sp.autoDone) { sp.autoDone = true; useSpot(sp); }
      }
      // с букетом: держит у груди, иногда нюхает
      if (hero.statue || hero.rig) { /* статуэтка: руки неподвижны; скелетная — букет у груди и «понюхать» (выше) */ }
      else if (heldKind === 'bouquet' && !finished) {
        if (!walking && !twirl) { smellNext -= dt; if (smellNext <= 0 && smellT < 0) { smellT = 0; smellNext = 7 + Math.random() * 5; } }
        let lift = 0;
        if (smellT >= 0) { smellT += dt; lift = Math.sin(Math.min(1, smellT / 1.6) * PI); if (smellT > 1.6) smellT = -1; }
        hero.arms[0].pv.rotation.x = -0.82 - lift * 0.6 + Math.sin(phase) * 0.06 * walkAmt;
        hero.arms[0].inner.rotation.z = 0.48 + lift * 0.1;
        hero.head.rotation.x = lift * 0.16;
        if (lift > 0.3 && !eyesClosed) hero.faceMat.map = hero.faceClosed; else if (!eyesClosed) hero.faceMat.map = hero.faceOpen;
      } else { hero.arms[0].inner.rotation.z = -0.13; hero.head.rotation.x = 0; }
      // находки: парят и подбираются, если подойти
      pickups.forEach(pk => {
        if (pk.taken) return;
        pk.model.position.y = Math.sin(t * 2.2 + pk.ph) * 0.06; pk.model.rotation.y = t * 1.3 + pk.ph;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + pk.ph);
        pk.ring.scale.setScalar(0.9 + pulse * 0.2); pk.glow.material.opacity = 0.12 + pulse * 0.16;
        if (active && !finished && !picking && !blocked() && Math.hypot(px - pk.p.x, pz - pk.p.z) < 0.55) collect(pk);
      });
      // камера: сверху-сбоку, чтобы был виден объём домов
      const cx = RM ? Math.max(RM.cam.x0, Math.min(RM.cam.x1, px)) : FREE ? Math.max(FO.cam ? FO.cam.x0 : BOUNDS.x0 + 1.6, Math.min(FO.cam ? FO.cam.x1 : BOUNDS.x1 - 2, px)) : Math.max(-2.4, Math.min(24.5, px));
      // в комнате камера держит глубину комнаты, а не героиню: кукольный домик виден целиком
      const cz = RM ? (RM.cam.z !== undefined ? RM.cam.z : pz * 0.35) : pz;
      if (camOverride) { camPos.lerp(camOverride.pos, Math.min(1, dt * 2.6)); lookAt.lerp(camOverride.look, Math.min(1, dt * 2.6)); }
      else {
        const zk = sitting ? 0.85 : 1;
        camPos.lerp(tmpV.set(cx + CAM.dx, CAM.y * (sitting ? 0.92 : 1), cz + CAM.dz * zk), Math.min(1, dt * 3.2));
        lookAt.lerp(tmpV.set(cx, CAM.ly, cz + CAM.lz), Math.min(1, dt * 3.2));
      }
      camera.position.copy(camPos); camera.lookAt(lookAt);
      sun.position.set(px + curOff[0], curOff[1], pz + curOff[2]); sun.target.position.set(px, 0, pz - 1.5); sun.target.updateMatrixWorld();
      // живые мелочи
      doorMarks.forEach(m => { m.sp.position.y = m.y + Math.sin(t * 3 + m.ph) * 0.06; });
      if (RM) { Object.keys(RM.npcs).forEach(k => { const n = RM.npcs[k]; if (n.anim) n.anim(t, dt, px, pz); }); if (RM.tick) RM.tick(t, dt, roomCtx); }
      else {
      const cin = buildings.cinema;
      if (cin.K.lit && !cin.K.anim) { const on = Math.floor(t * 3) % 2; cin.bulbs[0].emissiveIntensity = on ? 1 : 0.3; cin.bulbs[1].emissiveIntensity = on ? 0.3 : 1; }
      buildings.bureau.globe.rotation.y += dt * 0.5;
      if (secretMesh) { secretMesh.rotation.y = t * 1.6; secretMesh.position.y = 1.15 + Math.sin(t * 2.5) * 0.04; }
      clouds.forEach(c => { c.g.position.x += c.v * dt; if (c.g.position.x > 64) c.g.position.x = -36; });
      CHIM.forEach(([cx, cy, cz], ci) => { for (let i = 0; i < SPN; i++) {
        const k = (t * (o.rain ? 0.16 : 0.22) + i / SPN + ci * 0.37) % 1, sc = (0.1 + k * 0.3) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        sP.set(cx + k * (o.rain ? 1.4 : 0.6) + Math.sin(t * 1.3 + i) * 0.08, cy + k * (o.rain ? 0.9 : 1.7), cz); sS.set(sc, sc * 0.85, sc);
        smoke.setMatrixAt(ci * SPN + i, sM.compose(sP, sQ, sS));
      } });
      smoke.instanceMatrix.needsUpdate = true;
      if (birds.visible) {
        const k = (t % 48) / 48, bx = -22 + k * 74, by = 11.2 + Math.sin(t * 0.4) * 0.3;
        FLK.forEach(([a, b2], i) => { const late = i === 7, lag = late ? Math.sin(t * 0.7) * 0.6 : 0, fl = 0.45 + Math.abs(Math.sin(t * (late ? 9 : 5) + i * 0.7)) * 0.9;
          sP.set(bx + a * 0.95 + lag, by + b2 * 0.42 + Math.sin(t * 1.7 + i) * 0.05, -30 - Math.abs(b2) * 0.4); sS.set(1.3, 1.3 * fl, 1.3);
          birds.setMatrixAt(i, sM.compose(sP, sQ, sS)); });
        birds.instanceMatrix.needsUpdate = true;
      }
      const markX = tgtDoor.x, bobY = Math.sin(t * 3.3) * 0.08;
      arrow.position.set(markX, 2.75 + bobY, FRONT_Z + 1.1); arrow.rotation.y = t * 1.5;
      mark.position.set(markX, 3.3 + bobY, FRONT_Z + 1.1);
      }
      pigeons.forEach(p => {
        if (!p.flown && Math.hypot(px - p.x, pz - p.z) < 1.4) { p.flown = true; sfx('flutter'); }
        if (p.flown && p.g.visible) {
          p.t += dt; p.g.position.set(p.x + p.dir * p.t * 2.2, p.t * p.t * 4, p.z - p.t * 1.5); p.g.rotation.y = p.dir > 0 ? PI / 2 : -PI / 2;
          p.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.4 + Math.sin(p.t * 40) * 0.9); });
          if (p.t > 1.8) p.g.visible = false;
        } else if (!p.flown) p.head.rotation.x = Math.pow(Math.max(0, Math.sin(t * 2.4 + p.ph)), 10) * 1.1;
      });
      if (FREE) Object.keys(SHOPS).forEach(k => { const bk = buildings[k]; if (bk && bk.tick) { try { bk.tick(t, dt); } catch (e) { bk.tick = null; } } });
      if (snow) {
        const a = snow.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 0.9; a.setX(i, a.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.25); if (y < 0) { y = 8 + Math.random(); a.setX(i, camPos.x - 12 + Math.random() * 24); a.setZ(i, pz - 5 + Math.random() * 11); } a.setY(i, y); }
        a.needsUpdate = true;
      }
      if (rain) {
        const a = rain.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 9; if (y < 0) { y = 9; a.setX(i, camPos.x - 12 + Math.random() * 24); a.setZ(i, pz - 6 + Math.random() * 13); } a.setY(i, y); }
        a.needsUpdate = true;
      }
      if (motes) {
        motes.position.set(camPos.x - CAM.dx, 0, pz);
        const a = motes.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { a.setY(i, a.getY(i) + Math.sin(t * 0.7 + i) * dt * 0.08); a.setX(i, a.getX(i) + Math.cos(t * 0.4 + i * 1.7) * dt * 0.06); }
        a.needsUpdate = true;
      }
      if (leaves) {
        leaves.userData.items.forEach((L, i) => {
          L.y -= dt * 0.55 * L.s; L.x += Math.sin(t * 1.3 + i) * dt * 0.5; L.r += dt * 2 * L.s;
          if (L.y < 0.02) { L.y = 5 + Math.random() * 2; L.x = camPos.x - 10 + Math.random() * 18; L.z = pz - 4 + Math.random() * 7; }
          leafE.set(L.r, L.r * 0.7, 0); leafQ.setFromEuler(leafE); leafS.set(0.13 * L.s, 0.13 * L.s, 1); leafP.set(L.x, L.y, L.z);
          leafM.compose(leafP, leafQ, leafS); leaves.setMatrixAt(i, leafM);
        });
        leaves.instanceMatrix.needsUpdate = true;
      }
      const nk = active && !finished ? near() : null, atT = RM ? nk === 'exit' : isOpen(nk);
      if (arrow) { arrow.visible = !FREE && !atT && !finished; mark.visible = arrow.visible && Math.hypot(px - tgtDoor.x, pz - tgtDoor.z) > 4.5; }
      renderer.render(scene, camera);
      // облачка «помахать» и кнопка 👋
      for (let i = sayBubbles.length - 1; i >= 0; i--) {
        const b = sayBubbles[i]; b.t += dt;
        const q = b.pos(), sc = toScreen(q.x, q.y, q.z); b.el.style.left = sc.x + 'px'; b.el.style.top = sc.y + 'px';
        if (b.t > b.dur && !b.out) { b.out = true; b.el.classList.add('out'); }
        if (b.t > b.dur + 0.4 || finished) { b.el.remove(); sayBubbles.splice(i, 1); }
      }
      if ((wbN = (wbN + 1) % 6) === 0) waveBtn.classList.toggle('hidden', !(active && !finished && !blocked() && !document.querySelector('.room-puzzle') && (hint.classList.contains('hidden') || hint.style.opacity === '0')));
      // HTML-подсказки поверх 3D
      if (active && !finished) {
        const k = nk, sp = !k && !spotBusy ? spotNear() : null;
        const onSunPuddle = !k && !sp && !walking && Math.hypot(px - PS.x, pz - PS.z) < PS.r * 0.8;
        act.classList.toggle('hidden', !(atT || sp || onSunPuddle));
        act.textContent = atT ? (RM ? 'Выйти' : FREE ? `Войти · ${doorLabel(nk)}` : 'Войти') : sp ? sp.act : onSunPuddle ? 'Прыгнуть' : 'Войти';
        act.classList.toggle('pulse', !!atT && !RM);
        if (k && RM && !blocked()) {
          const s = toScreen(RM.exit.x, 2.0, RM.exit.z - 0.2);
          bubble.classList.remove('hidden'); bubble.style.left = s.x + 'px'; bubble.style.top = s.y + 'px'; bubble.style.bottom = 'auto';
          bubble.textContent = coarse ? RM.exitLabel : `Enter — ${RM.exitLabel}`;
        } else if (k && !blocked()) {
          const d = doorOf(k), s = toScreen(d.x, 2.1, FRONT_Z + 0.2);
          bubble.classList.remove('hidden'); bubble.style.left = s.x + 'px'; bubble.style.top = s.y + 'px'; bubble.style.bottom = 'auto';
          bubble.textContent = FREE ? doorLabel(k) + (DOORS[k] && DOORS[k].mark === 'new' ? ' · ✦ новое' : DOORS[k] && DOORS[k].mark === 'fresh' ? ' · НОВОЕ' : '') : atT ? (coarse ? 'жми «Войти»' : 'Enter — войти') : o.isLit(k) ? 'уже раскрыто' : 'закрыто';
        } else if (sp && !blocked()) {
          const s2 = toScreen(sp.x, 2.2, sp.z - 0.6);
          bubble.classList.remove('hidden'); bubble.style.left = s2.x + 'px'; bubble.style.top = s2.y + 'px'; bubble.style.bottom = 'auto';
          const bt = heldKind === 'bouquet' && sp.bubble2 ? sp.bubble2 : sp.bubble;
          bubble.textContent = coarse ? bt : `Enter — ${bt}`;
        } else bubble.classList.add('hidden');
        const ts = toScreen(tgtDoor.x, 2.7, FRONT_Z + 0.5), Wd = root.clientWidth;
        if (FREE && hintShown && FO.hintDoor && DOORS[FO.hintDoor] && !(cat.root.visible && o.catHelper)) {
          const hs = toScreen(doorOf(FO.hintDoor).x, 2.4, FRONT_Z + 0.5), Wd2 = root.clientWidth;
          if (hs.x > Wd2 - 24) { edge.className = 'edge-arrow r'; edge.textContent = `→ ${doorLabel(FO.hintDoor)} ✦`; }
          else if (hs.x < 24) { edge.className = 'edge-arrow l'; edge.textContent = `${doorLabel(FO.hintDoor)} ✦ ←`; }
          else edge.className = 'edge-arrow hidden';
        } else if (RM || FREE) edge.className = 'edge-arrow hidden';
        else if (ts.x > Wd - 24) { edge.className = 'edge-arrow r'; edge.textContent = `${o.arrowText} →`; }
        else if (ts.x < 24) { edge.className = 'edge-arrow l'; edge.textContent = `← ${o.arrowText}`; }
        else edge.className = 'edge-arrow hidden';
        if (!qDone && !/hq=1/.test(location.search)) {
          qFrames.push(rawDt);
          if (qFrames.length >= 90) { qDone = true; const avg = qFrames.slice(10).reduce((a, b) => a + b, 0) / (qFrames.length - 10); if (avg > 0.045) dropQuality(); qFrames = null; }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // отладочный хук для автотестов (?debug=1)
    if (/debug=1/.test(location.search)) {
      window.__c3d = {
        go: k => { const d = doorOf(k || o.target); moveTo = { x: d.x, z: d.z }; pendingEnter = true; },
        doors: () => Object.keys(DOORS).map(k => ({ k, x: DOORS[k].x, z: DOORS[k].z, open: isOpen(k) })),
        walk: (x, z) => { moveTo = { x, z }; pendingEnter = false; },
        busy: () => spotBusy,   // идёт обработчик точки/героя — следующий use() будет пропущен
        room: () => (RM && !finished ? { id: o.room, exit: RM.exit, spots: spots.map(q => ({ id: q.id, x: q.x, z: q.z })), npcs: Object.keys(RM.npcs) } : null),
        use: id => { const q = spots.find(z => z.id === id); if (q) { standUp(); moveTo = { x: q.x, z: q.z }; pendingSpot = q; pendingEnter = false; } return !!q; },
        npc: id => { if (o.onNpc) o.onNpc(id, spotApi); },
        door: id => { const d = doorOf(id); moveTo = { x: d.x, z: d.z }; pendingEnter = true; },
        tapNamed: name => (interceptFn ? !!interceptFn({ name, uv: null, point: null }) : false),
        tapUV: (u, v) => { const scr2 = RM && RM.screenMesh; return interceptFn ? !!interceptFn({ name: 'screen', uv: new T.Vector2(u, v), point: scr2 ? scr2.position.clone() : new T.Vector3() }) : false; },
        sit: () => (sitting ? Object.assign({}, sitting) : null),
        wave: () => doWave(),
        bubbles: () => sayBubbles.map(b => b.el.textContent),
        held: () => heldKind,
        hands: { on: () => !!IA, busy: () => iaBusy(), held: () => spotApi.heldItem(), state: () => (IA ? IA.state : null), probe: () => (IA ? IA.probe() : null), nibble: () => iaNibble(), take: op => iaTakeRoom(op) },
        look: () => Object.assign({}, lookNow),
        api: spotApi, hero: () => hero, faceTex: () => hero.faceMat.map,
        leave: () => { if (RM) { moveTo = { x: RM.exit.x, z: RM.exit.z }; pendingEnter = true; } },
        info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: renderer.info.programs.length }),
        meshes: () => scene.children.map((c, i) => { let n = 0, sh = 0, tr = 0; c.traverseVisible(m => { if (m.isMesh || m.isSprite || m.isPoints) { n++; if (m.castShadow) sh++; const g = m.geometry; if (g) tr += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return [i, c.type, c.userData.key || c.name || '', n, sh, Math.round(tr / 1000)]; }).filter(r => r[3]),
        pos: () => {
          const ca = Math.atan2(camera.position.x - px, camera.position.z - pz), df = Math.abs(angDiff(heroAng, ca));
          return { px, pz, walking, active, finished, view: df < 0.7 ? 'front' : df > 2.4 ? 'back' : 'side' };
        },
      };
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      document.body.classList.remove('room-on'); interceptFn = null;
      // волна 4: что в руке на выходе — лавкам города (City3D.lastHeld); слой рук этой героини — убрать
      { const it = iaHeldIt(); roomHeldOut = heldKind ? { kind: heldKind, data: it ? Object.assign({}, heldData || {}, { _bites: it.bites || 0, _level: it.level }) : heldData } : null; LAST_HELD = roomHeldOut;
        // данные покупки — тот же объект, что держит прогулка (town: sess().hd): недоеденное переходит на следующий отрезок
        if (it && IA_ITEM[heldKind] && heldData && typeof heldData === 'object') { heldData._bites = it.bites || 0; heldData._level = it.level; } }
      // волна 5: свой предмет места (лейка) — из сеток комнаты, их сейчас освободят: из руки убрать (вид — по heldKind, как раньше)
      if (IA) { try { ['L', 'R'].forEach(sd => { const c = IA.holding(sd); if (c && c.userData && c.userData.roomItem) { const x = IA.drop(sd); if (x && x.parent) x.parent.remove(x); } }); } catch (e) { /* ignore */ } }
      if (IA) { try { IA.cancel(); IA.dispose(); } catch (e) { /* ignore */ } IA = null; }
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
      setTimeout(() => {
        disposables.forEach(d => { try { d.dispose(); } catch (e) { /* ignore */ } });
        try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* ignore */ }
        renderer = null;
      }, 400);
    }

    /* --- сценарий перед прогулкой --- */
    if (o.justLit) {
      await G.wait(500);
      kits[o.justLit].set(true, true); warmUp(); haptic('success'); sfx('reveal');
      const s = toScreen(B[o.justLit], 3.4, FRONT_Z);
      G.sparkle(s.x, s.y, { n: 18, dist: 120 });
      await G.wait(1300);
      toast(o.headline, 3000);
    }
    let idleAll = 0, hintShown = false;
    const spawnCat = () => { cat.root.visible = true; catBlob.visible = true; catX = RM ? px + 0.7 : px - 3; catZ = pz + 0.3; catTX = px - 1; catTZ = pz + 0.3; if (RM) { catX = Math.min(BOUNDS.x1, catX); catTX = Math.max(BOUNDS.x0, catTX); } };
    if (o.catHelper) spawnCat();
    if (FREE && FO.catAt && !o.catHelper) { cat.root.visible = true; catBlob.visible = true; catX = catTX = FO.catAt.x; catZ = catTZ = FO.catAt.z; catPin = { x: FO.catAt.x, z: FO.catAt.z, ry: 0 }; }
    if (o.beforeActive) await o.beforeActive(Object.assign({ spawnCat }, spotApi, { get npcs() { return RM ? RM.npcs : {}; } }));
    if (finished) return;
    active = true;
    if (RM && RM.catSpot) setTimeout(() => { if (!finished && cat.root.visible && !catPin) catPin = { x: RM.catSpot.x, z: RM.catSpot.z, ry: RM.catSpot.ry, y: RM.catSpot.y }; }, 2500);
    joy.classList.remove('hidden');
    if (o.showHint) {
      hint.textContent = coarse ? 'Тяни джойстик или тапни по земле' : 'Стрелки — ходить, Enter — войти';
      hint.classList.remove('hidden');
      setTimeout(() => { hint.style.opacity = '0'; }, 4500);
    }
  }

  window.City3D = { supported, run, registerRoom, extendRoom, lastHeld: () => LAST_HELD, hasRoom: id => !!(ROOMS[id] || (id === 'stairs' && ROOMS.roof) || (id === 'roof' && ROOMS.stairs)), registerShop, shops: () => Object.keys(SHOPS).map(k => Object.assign({ key: k }, SHOPS[k])) };
})();
