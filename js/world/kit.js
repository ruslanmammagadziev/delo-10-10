/* =====================================================================
   ОТКРЫТЫЙ ГОРОД (прототип): общий набор строителя.
   Копия инструментов из js/city3d.js (рампа toon, примитивы, скруглённые коробки, окна,
   карнизы, кружево, венки, вывески, лица жителей) — city3d.js замораживается, город живёт отдельно.
   Своё здесь: склейка «куска» города в один меш с цветами вершин и свечением по вершинам,
   общий атлас вывесок, склейка персонажей (тело + контур одним вызовом).
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) return;
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;
  const SKIN = '#F7DCC8', INK = '#3A2E3F';

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
    S.gazety = (() => { const [cv, c] = cnv(512, 112); text(c, 'ГАЗЕТЫ', 256, 58, 80, '#FFFDF9'); return cv; })();
    S.weather = (() => { const [cv, c] = cnv(512, 296); c.fillStyle = '#3E4C72'; rrect(c, 0, 0, 512, 296, 24); c.fill(); text(c, 'ПРОГНОЗ', 256, 58, 58, '#BFE6D3'); return cv; })();
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

  WORLD.util = { shade, mixHex, greyOf, angDiff, rng, cnv, rrect, text, fontsReady, labelCanvas, blobCanvas };

  /* ---------- Набор строителя: один на сцену ---------- */
  WORLD.createKit = function (opts = {}) {
    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const RIM = { col: { value: new T.Color(opts.rim ? opts.rim[0] : '#FFD0AE') }, str: { value: opts.rim ? opts.rim[1] : 0.26 } };
    function addRim(mat, k = 1) {
      const kU = { value: k }, own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
      const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        Object.assign(sh.uniforms, { rimCol: RIM.col, rimStr: RIM.str, rimK: kU });
        sh.fragmentShader = 'uniform vec3 rimCol;\nuniform float rimStr;\nuniform float rimK;\n' + sh.fragmentShader.replace('#include <output_fragment>',
          'float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\noutgoingLight += rimCol * (rimStr * rimK * smoothstep(0.55, 0.95, rimF));\n#include <output_fragment>');
      };
      mat.customProgramCacheKey = () => 'rim1' + (prevKey ? prevKey.call(mat) : '');
      return mat;
    }

    const GEO = {
      box: keep(new T.BoxGeometry(1, 1, 1)),
      sph: keep(new T.SphereGeometry(1, 12, 8)),
      sphLo: keep(new T.SphereGeometry(1, 8, 6)),
      cyl: keep(new T.CylinderGeometry(1, 1, 1, 10)),
      cylLo: keep(new T.CylinderGeometry(1, 1, 1, 8)),
      cone: keep(new T.ConeGeometry(1, 1, 9)),
      plane: keep(new T.PlaneGeometry(1, 1)),
      halfDisc: keep(new T.CylinderGeometry(1, 1, 1, 8, 1, false, -PI / 2, PI)),
      halfCyl: keep(new T.CylinderGeometry(1, 1, 1, 10, 1, false, 0, PI)),
      hemi: keep(new T.SphereGeometry(1, 10, 5, 0, PI * 2, 0, PI / 2)),
      pot: keep(new T.CylinderGeometry(1, 0.78, 1, 10)),
    };
    // персонажам — прежняя гладкость (они близко к камере)
    const GEO_HI = Object.assign({}, GEO, {
      sph: keep(new T.SphereGeometry(1, 16, 11)), sphLo: keep(new T.SphereGeometry(1, 9, 7)), cyl: keep(new T.CylinderGeometry(1, 1, 1, 14)),
      cone: keep(new T.ConeGeometry(1, 1, 12)), hemi: keep(new T.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2)),
    });
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
    const extrude = (shape, depth) => keep(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 }));
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
      const g = keep(new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 2 }));
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
      const g = keep(new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 5 }));
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

    const blobGeo = keep(new T.SphereGeometry(1, 14, 10));
    { const p = blobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.08 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.7) * Math.sin(z * 4.4 + 0.7) - (y < -0.4 ? 0.15 * (-y - 0.4) : 0); p.setXYZ(i, x * k, y * k, z * k); } }
    function blobDisc(seed) {
      const s = new T.Shape(), q = rng(seed), k1 = q() * 6, k2 = q() * 6;
      for (let i = 0; i <= 32; i++) { const a = i / 32 * PI * 2, r = 1 + 0.12 * Math.sin(3 * a + k1) + 0.07 * Math.sin(5 * a + k2); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const g = new T.ShapeGeometry(s); g.rotateX(-PI / 2); return keep(g);
    }
    const leafSh = new T.Shape(); leafSh.moveTo(0, -0.5); leafSh.quadraticCurveTo(0.42, -0.15, 0.05, 0.5); leafSh.quadraticCurveTo(-0.38, -0.1, 0, -0.5);
    const leafUp = keep(new T.ShapeGeometry(leafSh, 4)), leafFlat = keep(leafUp.clone().rotateX(-PI / 2));
    const blob = (par, m, x, y, z, sx, sy, sz, r) => put(par, blobGeo, m, [x, y, z], [sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz], r);
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
    const RGC = new Map(), ringG = (r, t) => { const k = r + '|' + t; if (!RGC.has(k)) RGC.set(k, keep(new T.TorusGeometry(r, t, 5, 14))); return RGC.get(k); };
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

    /* ---------- свечение по вершинам: атрибут emis добавляется к излучению материала ---------- */
    function emisPatch(mat, tag = '') {
      const own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
      const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        sh.vertexShader = 'attribute vec3 emis;\nvarying vec3 vEmis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
        sh.fragmentShader = 'varying vec3 vEmis;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmis;');
      };
      mat.customProgramCacheKey = () => 'emis1' + tag + (prevKey ? prevKey.call(mat) : '');
      return mat;
    }
    /* ---------- настроение города: общая насыщенность и «серый → цветной» по домам (один uniform на всё) ----------
       uSat — насыщенность всего города (серия 1: от серого к тёплому), uLit[i] — дом с bid = i + 1 (0 — серый, 1 — цветной).
       Свечение окон у серых домов гаснет. Атрибут bid есть только у склеенных фасадов; у остальных он 0 — дом «всегда цветной». */
    const MOOD = { uSat: { value: 1 }, uLit: { value: [1, 1, 1, 1, 1, 1, 1, 1] } };
    function moodPatch(mat, tag = '') {
      const own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
      const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey');
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        sh.uniforms.uSat = MOOD.uSat; sh.uniforms.uLit = MOOD.uLit;
        sh.vertexShader = 'attribute float bid;\nvarying float vBid;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBid = bid;');
        sh.fragmentShader = 'uniform float uSat;\nuniform float uLit[8];\nvarying float vBid;\n' + sh.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\nfloat mLit = 1.0;\nfor (int i = 0; i < 8; i++) { if (abs(vBid - float(i + 1)) < 0.5) mLit = uLit[i]; }\nfloat mL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\nvec3 mG = vec3(mL * 0.9, mL * 0.92, min(1.0, mL * 0.98));\ndiffuseColor.rgb = mix(mG, diffuseColor.rgb, uSat * mLit);')
          .replace('#include <lights_fragment_begin>', 'totalEmissiveRadiance *= (0.35 + 0.65 * mLit);\n#include <lights_fragment_begin>');
      };
      mat.customProgramCacheKey = () => 'mood1' + tag + (prevKey ? prevKey.call(mat) : '');
      return mat;
    }
    // общие материалы склейки: матовое со свечением по вершинам (лицевые и двусторонние грани)
    const VC = {
      front: moodPatch(emisPatch(toon('#FFFFFF', { vertexColors: true }), 'f'), 'f'),
      double: moodPatch(emisPatch(toon('#FFFFFF', { vertexColors: true, side: T.DoubleSide }), 'd'), 'd'),
    };
    const vcMat = (side) => (side === T.DoubleSide ? VC.double : VC.front);

    // вид материала: 'vc' — матовый toon/basic без карты (в общий меш), 'map' — с картой (в атлас), 'other' — прозрачное и прочее
    function matKind(mt) {
      if (!mt || mt.isShaderMaterial) return 'other';
      if (mt.transparent && !mt.map) return 'other';
      if (mt.map) return mt.map.image && (mt.map.image.getContext || mt.map.image.width) && !mt.transparent && !mt.vertexColors ? 'map' : 'other';
      if (mt.vertexColors) return 'other';
      if (mt.isMeshToonMaterial || mt.isMeshBasicMaterial || mt.isMeshLambertMaterial || mt.isMeshStandardMaterial) return 'vc';
      return 'other';
    }
    const _m4 = new T.Matrix4(), _inv = new T.Matrix4(), _c = new T.Color(), _e = new T.Color(), _dp = new T.Vector3(), _dq = new T.Quaternion(), _ds = new T.Vector3();
    // собрать меши поддерева (без веток с userData.dyn / noMerge) с геометрией в системе root
    function gather(root, skipDyn = true) {
      root.updateMatrixWorld(true);
      _inv.copy(root.matrixWorld).invert();
      const out = [];
      root.traverse(m => {
        if (!m.isMesh || m.isInstancedMesh || m === root) return;
        if (skipDyn) { if (m.userData.dyn || m.userData.noMerge) return; for (let p = m.parent; p && p !== root; p = p.parent) if (p.userData.dyn || p.userData.noMerge) return; }
        out.push(m);
      });
      return out;
    }
    // копия геометрии меша в системе root (индексы сохраняются: вершин в 3–5 раз меньше, чем после toNonIndexed)
    function geoIn(m, rootInv) {
      const src = m.geometry, g = new T.BufferGeometry();
      ['position', 'normal', 'uv', 'color'].forEach(k => { if (src.attributes[k]) g.setAttribute(k, src.attributes[k].clone()); });
      if (src.index) g.setIndex(src.index.clone());
      g.applyMatrix4(_m4.multiplyMatrices(rootInv, m.matrixWorld));
      return g;
    }
    // номер дома (userData.bid у предка внутри root): для «серый → цветной» по домам в склеенном куске
    function bidOf(m, root) { for (let p = m; p && p !== root; p = p.parent) if (p.userData && p.userData.bid) return p.userData.bid; return 0; }
    function addBid(mg, parts, n) {
      if (!parts.some(p => p.bid)) return;
      const a = new Float32Array(n); let off = 0;
      parts.forEach(p => { const c = p.cnt; if (p.bid) a.fill(p.bid, off, off + c); off += c; });
      mg.setAttribute('bid', new T.BufferAttribute(a, 1));
    }
    // общий индекс склейки: у неиндексированных частей — подряд
    function packIndex(parts, n) {
      let ni = 0; parts.forEach(p => { p.cnt = p.g.attributes.position.count; ni += p.g.index ? p.g.index.count : p.g.attributes.position.count; });
      const idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let off = 0, io = 0;
      parts.forEach(p => {
        const c = p.g.attributes.position.count;
        if (p.g.index) { const a = p.g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + off; }
        else for (let i = 0; i < c; i++) idx[io++] = off + i;
        off += c;
      });
      return new T.BufferAttribute(idx, 1);
    }
    // склейка матовых мешей в один: позиция, нормаль, цвет, свечение
    function packVC(parts) {
      let n = 0; parts.forEach(p => { n += p.g.attributes.position.count; });
      const index = packIndex(parts, n);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), emi = new Float32Array(n * 3);
      let off = 0;
      parts.forEach(({ g, mt }) => {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, off * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
        if (mt.isMeshBasicMaterial) { _c.setRGB(0, 0, 0); _e.copy(mt.color); }
        else { _c.copy(mt.color); _e.setRGB(0, 0, 0); if (mt.emissive && mt.emissiveIntensity > 0) _e.copy(mt.emissive).multiplyScalar(mt.emissiveIntensity); }
        const vc = g.attributes.color;
        for (let i = 0; i < c; i++) {
          const q = (off + i) * 3;
          if (vc && vc.itemSize >= 3) { col[q] = _c.r * vc.getX(i); col[q + 1] = _c.g * vc.getY(i); col[q + 2] = _c.b * vc.getZ(i); }
          else { col[q] = _c.r; col[q + 1] = _c.g; col[q + 2] = _c.b; }
          emi[q] = _e.r; emi[q + 1] = _e.g; emi[q + 2] = _e.b;
        }
        off += c; g.dispose();
      });
      const mg = keep(new T.BufferGeometry());
      mg.setAttribute('position', new T.BufferAttribute(pos, 3));
      mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
      mg.setAttribute('color', new T.BufferAttribute(col, 3));
      mg.setAttribute('emis', new T.BufferAttribute(emi, 3));
      addBid(mg, parts, n);
      mg.setIndex(index);
      mg.computeBoundingSphere(); mg.computeBoundingBox();
      return mg;
    }
    function packPlain(parts, withUV) {
      let n = 0; parts.forEach(p => { n += p.g.attributes.position.count; });
      const index = packIndex(parts, n);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = withUV ? new Float32Array(n * 2) : null;
      let off = 0;
      parts.forEach(({ g, uvMap }) => {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, off * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
        if (uv && g.attributes.uv) { const a = g.attributes.uv; for (let i = 0; i < c; i++) { let u = a.getX(i), v = a.getY(i); if (uvMap) { u = uvMap[0] + u * uvMap[2]; v = uvMap[1] + v * uvMap[3]; } uv[(off + i) * 2] = u; uv[(off + i) * 2 + 1] = v; } }
        off += c; g.dispose();
      });
      const mg = keep(new T.BufferGeometry());
      mg.setAttribute('position', new T.BufferAttribute(pos, 3));
      mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
      if (uv) mg.setAttribute('uv', new T.BufferAttribute(uv, 2));
      addBid(mg, parts, n);
      mg.setIndex(index);
      mg.computeBoundingSphere(); mg.computeBoundingBox();
      return mg;
    }

    /* ---------- общий атлас вывесок ---------- */
    // все канвасы вывесок города — в одну текстуру 2048²: один материал на весь город
    const ATLAS = { list: [], map: new Map(), tex: null, mat: null, cv: null, scale: 1 };
    function atlasAdd(img) { if (!ATLAS.map.has(img)) { const e = { img, rc: null }; ATLAS.map.set(img, e); ATLAS.list.push(e); } return ATLAS.map.get(img); }
    function atlasCollect(root) { gather(root).forEach(m => { if (matKind(m.material) === 'map') atlasAdd(m.material.map.image); }); }
    function atlasBuild(size = 2048) {
      const items = ATLAS.list.slice().sort((a, b) => b.img.height - a.img.height);
      const fits = s => {
        let x = 0, y = 0, rowH = 0;
        for (const e of items) {
          const w = Math.ceil(e.img.width * s) + 4, h = Math.ceil(e.img.height * s) + 4;
          if (x + w > size) { x = 0; y += rowH; rowH = 0; }
          e._rc = [x + 2, y + 2, w - 4, h - 4]; x += w; rowH = Math.max(rowH, h);
          if (y + rowH > size) return false;
        }
        return true;
      };
      let s = 1; while (!fits(s) && s > 0.1) s *= 0.9;
      ATLAS.scale = s;
      const [cv, c] = cnv(size, size);
      items.forEach(e => { e.rc = e._rc; const [x, y, w, h] = e.rc; c.drawImage(e.img, x, y, w, h); });
      ATLAS.cv = cv;
      ATLAS.tex = keep(new T.CanvasTexture(cv)); ATLAS.tex.anisotropy = 4;
      ATLAS.mat = moodPatch(toon('#FFFFFF', { map: ATLAS.tex, alphaTest: 0.35 }), 'atlas');   // ниже 0.5: тонкие буквы прозрачных вывесок не «съедаются» мипмапами
      return ATLAS;
    }
    const atlasUV = img => { const e = ATLAS.map.get(img); if (!e || !e.rc) return null; const S = ATLAS.cv.width, [x, y, w, h] = e.rc; return [x / S, 1 - (y + h) / S, w / S, h / S]; };

    // прозрачные блики окон у каждой витрины свои — одинаковые сводим в один материал
    const OTHER = new Map();
    const otherKey = mt => {
      if (!(mt.isMeshBasicMaterial && mt.transparent && !mt.map)) return mt;
      const k = 'tb' + mt.color.getHexString() + '|' + mt.opacity.toFixed(2) + '|' + mt.depthWrite;
      if (!OTHER.has(k)) OTHER.set(k, mt);
      return OTHER.get(k);
    };
    /* ---------- склейка куска города ---------- */
    // root — группа в мировых координатах (или в своей); всё статичное сливается:
    // матовое → 1 меш (лицевое) + 1 (двустороннее), вывески → 1 меш с общим атласом, прочее — по материалам.
    function mergeChunk(root, o = {}) {
      const list = gather(root);
      const rootInv = _inv.clone();
      const buckets = new Map();
      const B = (key, init) => { if (!buckets.has(key)) buckets.set(key, Object.assign({ parts: [] }, init)); return buckets.get(key); };
      list.forEach(m => {
        const mt = m.material, kind = matKind(mt);
        const g = geoIn(m, rootInv);
        if (kind === 'vc') {
          // мелочь (лампочки, бусины, листья, цветы) — в отдельный меш: его прячем издалека
          let small = false;
          if (o.detail) { const gs = m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere); m.matrixWorld.decompose(_dp, _dq, _ds); small = gs.radius * Math.max(_ds.x, _ds.y, _ds.z) < o.detail; _dp.copy(gs.center).applyMatrix4(m.matrixWorld); }
          // мелочь раскладываем по клеткам 12 × 12 м: вблизи видна только своя клетка и соседние
          const cell = small ? ':' + Math.floor(_dp.x / 12) + ',' + Math.floor(_dp.z / 12) : '';
          B('vc' + (mt.side === T.DoubleSide ? 'd' : 'f') + (small ? 's' + cell : ''), { kind, side: mt.side, small }).parts.push({ g, mt, bid: bidOf(m, root) });
          if (WORLD.mergeStats && root.userData.zone) { const st = WORLD.mergeStats[root.userData.zone + (small ? ':s' : '')] = WORLD.mergeStats[root.userData.zone + (small ? ':s' : '')] || {}; const k = m.geometry.type + (m.geometry.parameters && m.geometry.parameters.radialSegments || ''); st[k] = (st[k] || 0) + Math.round((g.index ? g.index.count : g.attributes.position.count) / 3); }
        }
        else if (kind === 'map' && ATLAS.mat && atlasUV(mt.map.image)) B('atlas', { kind }).parts.push({ g, uvMap: atlasUV(mt.map.image), bid: bidOf(m, root) });
        else B(otherKey(mt), { kind: 'other', mt }).parts.push({ g });
      });
      list.forEach(m => m.parent.remove(m));
      const out = { meshes: [] };
      buckets.forEach((b, key) => {
        let mesh;
        if (b.kind === 'vc') mesh = new T.Mesh(packVC(b.parts), vcMat(b.side));
        else if (b.kind === 'map') mesh = new T.Mesh(packPlain(b.parts, true), ATLAS.mat);
        else mesh = new T.Mesh(packPlain(b.parts, !!b.mt.map), b.mt);
        mesh.castShadow = b.kind === 'vc' && o.cast !== false && !(b.mt && b.mt.transparent);
        mesh.receiveShadow = o.receive !== false && !(b.mt && b.mt.transparent);
        if (b.mt && b.mt.transparent) mesh.renderOrder = 2;
        mesh.userData.merged = true;
        if (b.small) { mesh.userData.detail = true; mesh.castShadow = false; }
        root.add(mesh); out.meshes.push(mesh);
        if (b.kind === 'vc' && b.side !== T.DoubleSide && !b.small) out.body = mesh;
      });
      return out;
    }

    /* ---------- склейка персонажа: тело одним мешем, контур одним мешем ---------- */
    const actorVC = emisPatch(addRim(toon('#FFFFFF', { vertexColors: true }), 1), 'a');
    const actorVCd = emisPatch(addRim(toon('#FFFFFF', { vertexColors: true, side: T.DoubleSide }), 1), 'ad');
    // group: подвижная часть (тело, голова, хвост…); olSet — меши, которым положен контур
    function mergeActor(group, olSet, o = {}) {
      const list = gather(group);
      const inv = _inv.clone();
      const vcF = [], vcD = [], ol = [], keepList = [];
      list.forEach(m => {
        const mt = m.material, kind = matKind(mt);
        if (kind !== 'vc' || m.userData.outline) { keepList.push(m); return; }
        const g = geoIn(m, inv);
        if (olSet && olSet.has(m)) ol.push({ g: g.clone() });
        (mt.side === T.DoubleSide ? vcD : vcF).push({ g, mt });
      });
      list.forEach(m => { if (!keepList.includes(m)) m.parent.remove(m); });
      const res = {};
      if (vcF.length) { res.body = new T.Mesh(packVC(vcF), actorVC); res.body.castShadow = o.cast !== false; res.body.receiveShadow = false; group.add(res.body); }
      if (vcD.length) { res.bodyD = new T.Mesh(packVC(vcD), actorVCd); res.bodyD.castShadow = o.cast !== false; res.bodyD.receiveShadow = false; group.add(res.bodyD); }
      if (ol.length) { res.outline = new T.Mesh(packPlain(ol, false), outlineMat); res.outline.castShadow = false; res.outline.receiveShadow = false; res.outline.userData.outline = true; res.outline.raycast = () => {}; group.add(res.outline); }
      return res;
    }
    // геометрия группы одним куском с цветами вершин (для инстансов: фонари, лавочки, деревья)
    function geoOf(group) {
      const list = gather(group, false), inv = _inv.clone(), parts = [];
      list.forEach(m => parts.push({ g: geoIn(m, inv), mt: m.material }));
      return packVC(parts);
    }

    // набор материалов дома для открытого города: всё сразу цветное (серых «нераскрытых» домов здесь нет)
    function makeKitLit() {
      const cache = new Map();
      return {
        lit: true, anim: false,
        m(color, x = {}) {
          const key = color + '|' + (x.glow || '') + '|' + (x.gi || '') + '|' + (x.id || '');
          if (cache.has(key)) return cache.get(key);
          const mat = toon(color);
          mat.userData = { col: new T.Color(color), glow: !!x.glow, gi: x.gi || 0.5 };
          if (x.glow) { mat.emissive = new T.Color(x.glow); mat.emissiveIntensity = mat.userData.gi; }
          cache.set(key, mat); return mat;
        },
        t(cv, x = {}) { return toon('#FFFFFF', { map: tex(cv), alphaTest: x.alpha ? 0.5 : 0 }); },
        set() {},
      };
    }

    /* ---------- плоские фигуры по функции расстояния (волна 3, EXPAND) ----------
       sdf(x, z) < 0 — внутри. sdfMesh — земля «марширующими квадратами»: целые клетки склеены полосами по строкам,
       край — по линейной интерполяции (дуги ровные). uv — метры (x, −z), как у прежних ShapeGeometry: текстура дорог и
       газонов ложится без шва. sdfContours — край фигуры ломаными (для бордюров), упрощёнными до tol. */
    // coarse = k: сначала грубая сетка (шаг k·cell); где клетка целиком внутри или снаружи (с запасом), точные значения не нужны
    function sdfGrid(sdf, x0, x1, z0, z1, cell, coarse = 0) {
      const nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1, v = new Float32Array(nx * nz);
      if (!coarse || coarse < 2) { for (let j = 0; j < nz; j++) { const z = z0 + j * cell; for (let i = 0; i < nx; i++) v[i + j * nx] = sdf(x0 + i * cell, z); } return { v, nx, nz, x0, z0, cell, evals: nx * nz }; }
      const K = coarse | 0, cn = cell * K, cnx = Math.ceil((nx - 1) / K) + 2, cnz = Math.ceil((nz - 1) / K) + 2, cv = new Float32Array(cnx * cnz);
      for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) cv[i + j * cnx] = sdf(x0 + i * cn, z0 + j * cn);
      const thr = cn * 0.7072 + 0.8; let evals = cnx * cnz;
      for (let j = 0; j < nz; j++) {
        const cj = Math.min(cnz - 2, Math.floor(j / K)), z = z0 + j * cell;
        for (let i = 0; i < nx; i++) {
          const ci = Math.min(cnx - 2, Math.floor(i / K)), a = cv[ci + cj * cnx], b = cv[ci + 1 + cj * cnx], c = cv[ci + (cj + 1) * cnx], d = cv[ci + 1 + (cj + 1) * cnx];
          if (a > thr && b > thr && c > thr && d > thr) v[i + j * nx] = Math.min(a, b, c, d) - thr + 0.5;
          else if (a < -thr && b < -thr && c < -thr && d < -thr) v[i + j * nx] = Math.max(a, b, c, d) + thr - 0.5;
          else { v[i + j * nx] = sdf(x0 + i * cell, z); evals++; }
        }
      }
      return { v, nx, nz, x0, z0, cell, evals };
    }
    function sdfMesh(sdf, x0, x1, z0, z1, cell = 0.5, opt = {}) {
      const G = opt.grid || sdfGrid(sdf, x0, x1, z0, z1, cell), { v, nx, nz } = G, c = G.cell;
      const pos = [], uvs = [], us = opt.uvScale || 1, y = opt.y || 0;
      const P = (x, z) => { pos.push(x, y, z); uvs.push(x * us, -z * us); };
      const tri = (a, b, d) => { P(a[0], a[1]); P(d[0], d[1]); P(b[0], b[1]); };   // против часовой сверху (нормаль вверх)
      for (let j = 0; j < nz - 1; j++) {
        const za = G.z0 + j * c, zb = za + c;
        let run = -1;
        const flush = i => { if (run < 0) return; const xa = G.x0 + run * c, xb = G.x0 + i * c; tri([xa, za], [xb, za], [xb, zb]); tri([xa, za], [xb, zb], [xa, zb]); run = -1; };
        for (let i = 0; i < nx - 1; i++) {
          const a = v[i + j * nx], b = v[i + 1 + j * nx], d = v[i + 1 + (j + 1) * nx], e = v[i + (j + 1) * nx];
          if (a < 0 && b < 0 && d < 0 && e < 0) { if (run < 0) run = i; continue; }
          flush(i);
          if (a >= 0 && b >= 0 && d >= 0 && e >= 0) continue;
          // многоугольник внутренней части клетки: углы по кругу + точки пересечения рёбер
          const xa = G.x0 + i * c, xb = xa + c, cs = [[xa, za, a], [xb, za, b], [xb, zb, d], [xa, zb, e]], poly = [];
          for (let k = 0; k < 4; k++) {
            const p = cs[k], q = cs[(k + 1) % 4];
            if (p[2] < 0) poly.push([p[0], p[1]]);
            if ((p[2] < 0) !== (q[2] < 0)) { const t = p[2] / (p[2] - q[2]); poly.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
          }
          for (let k = 1; k < poly.length - 1; k++) tri(poly[0], poly[k], poly[k + 1]);
        }
        flush(nx - 1);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
      g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return keep(g);
    }
    // Дуглас — Пекер для ломаной [[x, z], …]
    function simplifyLine(pts, tol, closed) {
      if (pts.length < 3) return pts.slice();
      const keepF = new Uint8Array(pts.length); keepF[0] = keepF[pts.length - 1] = 1;
      const st = [[0, pts.length - 1]];
      while (st.length) {
        const [a, b] = st.pop(); let best = -1, bd = tol;
        const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        for (let i = a + 1; i < b; i++) { const [px, pz] = pts[i]; let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const q = Math.hypot(px - ax - dx * t, pz - az - dz * t); if (q > bd) { bd = q; best = i; } }
        if (best > 0) { keepF[best] = 1; st.push([a, best], [best, b]); }
      }
      const out = pts.filter((p, i) => keepF[i]);
      if (closed && out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
      return out;
    }
    function sdfContours(sdf, x0, x1, z0, z1, cell = 0.5, opt = {}) {
      const G = opt.grid || sdfGrid(sdf, x0, x1, z0, z1, cell), { v, nx, nz } = G, c = G.cell;
      // рёбра сетки — числами: горизонтальное (i, j) → 2·(j·nx + i), вертикальное → 2·(j·nx + i) + 1
      const ptX = new Map(), ptZ = new Map(), adj = new Map();
      const edgeP = (key, x, z, va, x2, z2, vb) => { if (!ptX.has(key)) { const t = va / (va - vb); ptX.set(key, x + (x2 - x) * t); ptZ.set(key, z + (z2 - z) * t); } return key; };
      const link = (k1, k2) => { let a = adj.get(k1); if (!a) adj.set(k1, a = []); a.push(k2); let b = adj.get(k2); if (!b) adj.set(k2, b = []); b.push(k1); };
      const es = [0, 0, 0, 0];
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = v[i + j * nx], b = v[i + 1 + j * nx], d = v[i + 1 + (j + 1) * nx], e = v[i + (j + 1) * nx];
        const ia = a < 0, ib = b < 0, id = d < 0, ie = e < 0;
        if (ia === ib && ib === id && id === ie) continue;
        const xa = G.x0 + i * c, xb = xa + c, za = G.z0 + j * c, zb = za + c;
        let n = 0;
        if (ia !== ib) es[n++] = edgeP(2 * (j * nx + i), xa, za, a, xb, za, b);
        if (ib !== id) es[n++] = edgeP(2 * (j * nx + i + 1) + 1, xb, za, b, xb, zb, d);
        if (ie !== id) es[n++] = edgeP(2 * ((j + 1) * nx + i), xa, zb, e, xb, zb, d);
        if (ia !== ie) es[n++] = edgeP(2 * (j * nx + i) + 1, xa, za, a, xa, zb, e);
        if (n === 2) link(es[0], es[1]);
        else if (n === 4) { const ctr = (a + b + d + e) / 4; if ((ctr < 0) === ia) { link(es[0], es[1]); link(es[2], es[3]); } else { link(es[0], es[3]); link(es[1], es[2]); } }
      }
      const seen = new Set(), lines = [];
      const walk = start => {
        const line = []; let cur = start, closed = false;
        for (let k = 0; k < 1e7; k++) {
          seen.add(cur); line.push([ptX.get(cur), ptZ.get(cur)]);
          const nb = adj.get(cur); let nxt = -1; for (let q = 0; q < nb.length; q++) if (!seen.has(nb[q])) { nxt = nb[q]; break; }
          if (nxt < 0) { closed = line.length > 2 && nb.includes(start); break; }
          cur = nxt;
        }
        if (closed) line.push(line[0]);
        lines.push({ pts: simplifyLine(line, opt.tol || 0.04, closed), closed });
      };
      // сначала открытые ломаные (с концов: край сетки), потом замкнутые контуры
      adj.forEach((nb, k) => { if (!seen.has(k) && nb.length === 1) walk(k); });
      adj.forEach((nb, k) => { if (!seen.has(k)) walk(k); });
      return lines;
    }

    const blobMat = keep(new T.MeshBasicMaterial({ map: tex(blobCanvas()), transparent: true, depthWrite: false }));
    const haloTex = (() => { const [hcv, hcx] = cnv(128, 128), hg = hcx.createRadialGradient(64, 64, 0, 64, 64, 64);
      hg.addColorStop(0, 'rgba(255,240,210,1)'); hg.addColorStop(0.18, 'rgba(255,214,160,.75)'); hg.addColorStop(0.5, 'rgba(255,180,140,.22)'); hg.addColorStop(1, 'rgba(255,170,140,0)');
      hcx.fillStyle = hg; hcx.fillRect(0, 0, 128, 128); return tex(hcv); })();

    const H = {
      T, PI, opts, keep, disposables, RIM, addRim, GEO, GEO_HI, flatCone, GRAD, toon, tex, pm, put, box, sph, cyl, plane, extrude, smoothCrease, rboxGeo, rbox,
      archShape, triShape, rrP, arcP, frameGeo, windowF, cornice, bake, makeKit, blobGeo, blobDisc, leafUp, leafFlat, blob, bowAt, wreath, bow, sconce, sphS,
      ringG, lace, heartG, curtains, flowerBox, IVY, ivy, outlineMat, addOutlines, emisPatch, VC, vcMat, matKind, gather, mergeChunk, mergeActor, geoOf, packVC,
      atlasAdd, atlasCollect, atlasBuild, ATLAS, blobMat, haloTex, makeKitLit, MOOD, moodPatch, sdfGrid, sdfMesh, sdfContours, simplifyLine,
      shade, mixHex, greyOf, angDiff, rng, cnv, rrect, text, labelCanvas, blobCanvas, catFaceCanvas, animalFaceCanvas, SKIN, INK,
      dispose() { disposables.forEach(d => { try { d.dispose && d.dispose(); } catch (e) { /* уже освобождено */ } }); disposables.length = 0; },
    };
    return H;
  };
  WORLD.makeSigns = makeSigns;
})();
