// волна 10: вывеска кофейни «МАРХАРАЙ» — один в один по фото фасада (cafe/facade_closed.png).
// Всё рисуется векторными путями на canvas: большие буквы — свои контуры (конденсированный
// контрастный дидон: толстые штамбы, волосные диагонали, тонкие засечки с подсечками),
// «КОФЕЙНЯ» — свои штрихи (жирный наклонный гротеск), чашка с филигранью, пар.
// Системные шрифты не используются.
//
// Базовая сетка — выпрямленная по гомографии вывеска с фото: 2048 × 440 px (доска 4.655 : 1).
// Высота прописных 343 px (78 % доски), базовая линия 412.5 px (93.75 %), все размеры букв
// сняты по пикселям фото и записаны в долях высоты прописной (cap = 1, y вверх от базовой линии).
//
// markharaiSignCanvas(opts) → HTMLCanvasElement
//   opts.width      ширина холста (по умолчанию 2048)
//   opts.boardH     высота доски (по умолчанию width·440/2048)
//   opts.height     высота холста (по умолчанию boardH; напр. 512 — доска в строках 0…boardH−1,
//                   ниже — цвет доски; тогда tex.repeat.set(1, boardH/height), offset.y = 1 − boardH/height)
//   opts.night      true — ночной лайтбокс: буквы и панель светятся тёплым белым
//   opts.canvas     готовый canvas (иначе создаётся новый)
//   opts.kofBreve   кратка над Й в «КОФЕЙНЯ» (по умолчанию true; на фото она почти не видна)
//   opts.word       false — без большого названия (нейтральная сборка, VILLAGE.named = false): плашка с чашкой и «КОФЕЙНЯ»
(function (root) {
  'use strict';

  var BW = 2048, BH = 440;              // базовая сетка
  var CAP = 343, BASE = 412.5;          // высота прописной и базовая линия, px сетки
  var T = 39 / CAP;                     // толстый штамб
  var t = 7 / CAP;                      // волосной штрих
  var S = 0.019;                        // толщина засечки
  var B = 0.032, Bh = 0.016;            // подсечки: у штамба / у волосной

  var DAY = {
    board: '#2a2b2e', frame: '#404247', ink: '#f4f2ec', panel: '#eceae4',
    cup: '#2a2b2e', fil: '#e6e3da', glow: null
  };
  var NIGHT = {
    board: '#1b1c1f', frame: '#3a3c41', ink: '#fffaf0', panel: '#fff7e6',
    cup: '#1d1e21', fil: '#f3ead6', glow: 'rgba(255,226,170,0.85)'
  };

  // ---------- прорисовка букв в единицах прописной ----------
  function Pen(ctx, x0) {
    this.c = ctx; this.x0 = x0;
  }
  Pen.prototype.X = function (u) { return this.x0 + u * CAP; };
  Pen.prototype.Y = function (v) { return BASE - v * CAP; };
  Pen.prototype.poly = function (pts) {
    var c = this.c; c.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (i) c.lineTo(this.X(p[0]), this.Y(p[1])); else c.moveTo(this.X(p[0]), this.Y(p[1]));
    }
    c.closePath(); c.fill();
  };
  Pen.prototype.rect = function (u0, v0, u1, v1) {
    this.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  };
  // подсечка (скруглённый переход засечки в штрих): edge(v) — u кромки штриха,
  // vC — уровень засечки, side −1/+1 — куда уходит засечка, up +1 нижняя / −1 верхняя
  Pen.prototype.br = function (edge, vC, side, up, b) {
    var c = this.c, X = this.X.bind(this), Y = this.Y.bind(this);
    var e0 = edge(vC), e1 = edge(vC + up * b * 1.15);
    c.beginPath();
    c.moveTo(X(e1), Y(vC + up * b * 1.15));
    c.quadraticCurveTo(X(e0), Y(vC), X(e0 + side * b), Y(vC));
    c.lineTo(X(e0), Y(vC));
    c.closePath(); c.fill();
  };
  function vert(u) { return function () { return u; }; }
  function line(u0, u1) { return function (v) { return u0 + (u1 - u0) * v; }; } // u при v=0 и v=1

  // нижняя засечка у вертикального штамба [a,b] с вылетами l/r и подсечками
  Pen.prototype.foot = function (a, b, l, r, hair) {
    var k = hair ? Bh : B;
    this.rect(a - l, 0, b + r, S);
    if (l > 0) this.br(vert(a), S, -1, 1, Math.min(k, l));
    if (r > 0) this.br(vert(b), S, 1, 1, Math.min(k, r));
  };
  Pen.prototype.head = function (a, b, l, r, hair) {
    var k = hair ? Bh : B;
    this.rect(a - l, 1 - S, b + r, 1);
    if (l > 0) this.br(vert(a), 1 - S, -1, -1, Math.min(k, l));
    if (r > 0) this.br(vert(b), 1 - S, 1, -1, Math.min(k, r));
  };

  var GLYPH = {};

  // М: волосная левая стойка, толстая диагональ, волосная диагональ, толстая правая стойка;
  // вершина «V» не доходит до строки (v 0.264)
  GLYPH['М'] = function (P) {
    P.rect(0.034, 0, 0.054, 1);
    P.poly([[0.026, 1], [0.157, 1], [0.288, 0.489], [0.233, 0.264]]);
    var L = function (v) { return 0.403 + 0.33 * (v - 0.838); };
    P.poly([[0.233, 0.264], [L(0.93) + t, 0.93], [L(0.93), 0.93], [0.288, 0.489]]);
    P.poly([[0.424, 0], [0.538, 0], [0.538, 1], [0.452, 1], [0.424, 0.905]]);
    // засечки
    P.rect(0.006, 1 - S, 0.06, 1);
    P.br(vert(0.034), 1 - S, -1, -1, Bh);
    P.rect(0.452, 1 - S, 0.572, 1);
    P.br(vert(0.538), 1 - S, 1, -1, B);
    P.foot(0.034, 0.054, 0.034, 0.028, true);
    P.foot(0.424, 0.538, 0.042, 0.032);
  };

  // А: волосная левая нога, толстая правая (сужается кверху), плоская вершина с носиком,
  // низкая перекладина (v 0.255) с загибом в левую ногу
  GLYPH['А'] = function (P) {
    var tl = line(0.0195, 0.1513), tr = function (v) { return tl(v) + t; };
    var kl = line(0.2953, 0.1621), kr = line(0.4332, 0.2662);
    P.poly([[tl(0), 0], [tr(0), 0], [tr(1), 1], [tl(1), 1]]);
    P.poly([[kl(0), 0], [kr(0), 0], [kr(1), 1], [kl(1), 1]]);
    P.poly([[0.122, 1], [0.266, 1], [kl(0.93), 0.93], [tr(0.93), 0.93], [0.135, 1 - S]]);
    P.rect(0.122, 1 - S, 0.17, 1);
    // перекладина
    var c = P.c, X = P.X.bind(P), Y = P.Y.bind(P), vb = 0.255;
    c.beginPath();
    c.moveTo(X(tl(0.212)), Y(0.212));
    c.quadraticCurveTo(X(tr(0.258) + 0.012), Y(vb + t / 2), X(0.125), Y(vb + t / 2));
    c.lineTo(X(kl(vb) + 0.01), Y(vb + t / 2));
    c.lineTo(X(kl(vb) + 0.01), Y(vb - t / 2));
    c.lineTo(X(0.125), Y(vb - t / 2));
    c.quadraticCurveTo(X(tr(0.245) + 0.004), Y(vb - t / 2), X(tr(0.205)), Y(0.205));
    c.closePath(); c.fill();
    // засечки
    P.rect(0, 0, 0.064, S);
    P.br(tl, S, -1, 1, Bh); P.br(tr, S, 1, 1, Bh);
    P.rect(0.262, 0, 0.455, S);
    P.br(kl, S, -1, 1, B); P.br(kr, S, 1, 1, Bh * 1.2);
  };

  // Р: высокая чаша (до v ≈ 0.31), толстая почти вертикальная правая сторона,
  // нижний волосной штрих наклонно уходит в стойку
  GLYPH['Р'] = function (P) {
    var c = P.c, X = P.X.bind(P), Y = P.Y.bind(P);
    P.rect(0.0364, 0, 0.150, 1);
    P.rect(0.009, 1 - S, 0.06, 1);
    P.br(vert(0.0364), 1 - S, -1, -1, Bh * 1.4);
    P.foot(0.0364, 0.150, 0.0364, 0.028);
    c.beginPath();
    // внешний контур
    c.moveTo(X(0.14), Y(1));
    c.lineTo(X(0.235), Y(1));
    c.bezierCurveTo(X(0.333), Y(1), X(0.385), Y(0.952), X(0.385), Y(0.78));
    c.lineTo(X(0.385), Y(0.56));
    c.bezierCurveTo(X(0.385), Y(0.43), X(0.362), Y(0.372), X(0.318), Y(0.347));
    c.bezierCurveTo(X(0.27), Y(0.322), X(0.2), Y(0.306), X(0.14), Y(0.300));
    c.closePath();
    // внутренний контур (против часовой — дыра при evenodd)
    c.moveTo(X(0.14), Y(1 - t * 0.95));
    c.lineTo(X(0.14), Y(0.331));
    c.bezierCurveTo(X(0.18), Y(0.333), X(0.215), Y(0.343), X(0.236), Y(0.352));
    c.bezierCurveTo(X(0.262), Y(0.362), X(0.277), Y(0.40), X(0.277), Y(0.48));
    c.lineTo(X(0.277), Y(0.80));
    c.bezierCurveTo(X(0.277), Y(0.92), X(0.25), Y(1 - t * 0.95), X(0.19), Y(1 - t * 0.95));
    c.closePath();
    c.fill('evenodd');
  };

  // Х: толстая диагональ сверху-слева вниз-направо, волосная — круче, справа налево
  GLYPH['Х'] = function (P) {
    var kl = line(0.3157, 0.0321), kr = line(0.4344, 0.1487);
    var hl = line(0.0204, 0.4227), hr = function (v) { return hl(v) + t; };
    P.poly([[kl(1), 1], [kr(1), 1], [kr(0), 0], [kl(0), 0]]);
    P.poly([[hl(1), 1], [hr(1), 1], [hr(0), 0], [hl(0), 0]]);
    P.rect(0.0087, 1 - S, 0.1808, 1);
    P.br(kl, 1 - S, -1, -1, Bh); P.br(kr, 1 - S, 1, -1, B * 0.8);
    P.rect(0.3878, 1 - S, 0.4606, 1);
    P.br(hl, 1 - S, -1, -1, Bh); P.br(hr, 1 - S, 1, -1, Bh);
    P.rect(0, 0, 0.0758, S);
    P.br(hl, S, -1, 1, Bh); P.br(hr, S, 1, 1, Bh);
    P.rect(0.277, 0, 0.4606, S);
    P.br(kl, S, -1, 1, B * 0.8); P.br(kr, S, 1, 1, Bh);
  };

  // Й: два толстых штамба, волосная диагональ (v 0.21 у левого → v 0.78 у правого),
  // кратка — фигурная: дужка с двумя завитками-капельками
  GLYPH['Й'] = function (P) {
    var c = P.c, X = P.X.bind(P), Y = P.Y.bind(P);
    P.rect(0.0292, 0, 0.1429, 1);
    P.rect(0.3324, 0, 0.4461, 1);
    var L = function (v) { return 0.2945 + 0.307 * (v - 0.707); }, w = 6 / CAP;
    P.poly([[L(0.12), 0.12], [L(0.12) + w, 0.12], [L(0.93) + w, 0.93], [L(0.93), 0.93]]);
    P.foot(0.0292, 0.1429, 0.029, 0.026);
    P.foot(0.3324, 0.4461, 0.027, 0.023);
    P.head(0.0292, 0.1429, 0.023, 0.02);
    P.head(0.3324, 0.4461, 0.035, 0.023);
    // кратка: серп-дужка (внизу толще) и два завитка-спирали, каждый — в капельку
    var cx = 0.228;
    c.beginPath();
    c.moveTo(X(cx - 0.104), Y(1.082));
    c.bezierCurveTo(X(cx - 0.08), Y(1.008), X(cx + 0.08), Y(1.008), X(cx + 0.104), Y(1.082));
    c.lineTo(X(cx + 0.088), Y(1.086));
    c.bezierCurveTo(X(cx + 0.062), Y(1.04), X(cx - 0.062), Y(1.04), X(cx - 0.088), Y(1.086));
    c.closePath(); c.fill();
    c.save();
    c.strokeStyle = c.fillStyle; c.lineCap = 'round'; c.lineJoin = 'round';
    for (var s = -1; s <= 1; s += 2) {
      var ox = cx + s * 0.082, oy = 1.106, n = 30, a0 = 232, a1 = -80, end = null;
      c.lineWidth = 0.029 * CAP;
      c.beginPath();
      for (var k = 0; k <= n; k++) {
        var f = k / n, ang = (a0 + (a1 - a0) * f) * Math.PI / 180, r = 0.04 - 0.025 * f;
        var du = Math.cos(ang) * r, dv = Math.sin(ang) * r;
        if (s > 0) du = -du;
        var px = X(ox + du), py = Y(oy + dv);
        if (k) c.lineTo(px, py); else c.moveTo(px, py);
        end = [ox + du, oy + dv];
      }
      c.stroke();
      c.beginPath(); c.arc(X(end[0]), Y(end[1]), 0.019 * CAP, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };

  // положение букв: левая кромка (с засечками), px сетки — снято по фото
  var WORD = [['М', 551], ['А', 764], ['Р', 949], ['Х', 1107], ['А', 1292], ['Р', 1476], ['А', 1628], ['Й', 1812]];

  // ---------- «КОФЕЙНЯ»: жирный наклонный гротеск с контрастом (вертикали толще горизонталей) ----------
  // прописная 41 px, базовая 405 px, наклон 0.13, рамки букв сняты по фото (84…467 — ширина панели)
  var KOF = { base: 405, cap: 41, slant: 0.13, V: 0.27, Hh: 0.19 };
  var KX = [['К', 84, 33], ['О', 140, 36], ['Ф', 198, 45], ['Е', 265, 29], ['Й', 313, 37], ['Н', 374, 37], ['Я', 431, 36]];
  function drawKof(c, col, breve) {
    var cap = KOF.cap, V = KOF.V * cap, Hh = KOF.Hh * cap;
    c.save();
    c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'butt'; c.lineJoin = 'miter';
    for (var i = 0; i < KX.length; i++) {
      var ch = KX[i][0], w = KX[i][2];
      c.save();
      // локальные px: x вправо, y вверх отрицательный (0 — строка), наклон сдвигом
      c.transform(1, 0, -KOF.slant, 1, KX[i][1] + KOF.slant * cap * 0.5, KOF.base);
      var seg = function (x0, y0, x1, y1, lw) {
        c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      };
      var band = function () { c.beginPath(); c.rect(-20, -cap, w + 40, cap); c.clip(); };
      var ring = function (cx, cy, rx, ry, tx, ty) {
        c.beginPath();
        c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        c.ellipse(cx, cy, rx - tx, ry - ty, 0, 0, Math.PI * 2, true);
        c.fill('evenodd');
      };
      c.save(); band();
      if (ch === 'К') {
        seg(V / 2, 0, V / 2, -cap, V);
        seg(V * 0.75, -cap * 0.46, w + V * 0.15, -cap - V * 0.25, V * 0.86);
        seg(V * 1.05, -cap * 0.54, w - V * 0.15, 0, V * 0.98);
      } else if (ch === 'О') {
        c.restore(); c.save();
        ring(w / 2, -cap / 2, w / 2, cap / 2 + 0.6, V, Hh);
      } else if (ch === 'Ф') {
        c.restore(); c.save();
        seg(w / 2, 1.2, w / 2, -cap - 1.2, V * 0.9);
        ring(w / 2, -cap * 0.52, w / 2, cap * 0.34, V * 0.92, Hh * 0.9);
      } else if (ch === 'Е') {
        seg(V / 2, 0, V / 2, -cap, V);
        seg(0, -cap + Hh / 2, w, -cap + Hh / 2, Hh);
        seg(0, -cap * 0.51, w * 0.84, -cap * 0.51, Hh * 0.95);
        seg(0, -Hh / 2, w, -Hh / 2, Hh);
      } else if (ch === 'Й') {
        seg(V / 2, 0, V / 2, -cap, V);
        seg(w - V / 2, 0, w - V / 2, -cap, V);
        seg(V * 0.55, 0, w - V * 0.55, -cap, V * 0.82);
      } else if (ch === 'Н') {
        seg(V / 2, 0, V / 2, -cap, V);
        seg(w - V / 2, 0, w - V / 2, -cap, V);
        seg(V, -cap * 0.5, w - V, -cap * 0.5, Hh);
      } else if (ch === 'Я') {
        var bx = w * 0.46, bh = cap * 0.56, sx = w - V;
        seg(w - V / 2, 0, w - V / 2, -cap, V);
        c.beginPath(); // чаша
        c.moveTo(sx, -cap); c.lineTo(bx, -cap);
        c.ellipse(bx, -cap + bh / 2, bx, bh / 2, 0, -Math.PI / 2, Math.PI / 2, true);
        c.lineTo(sx, -cap + bh); c.closePath();
        c.moveTo(sx, -cap + Hh); c.lineTo(bx, -cap + Hh);
        c.ellipse(bx, -cap + bh / 2, bx - V * 0.95, bh / 2 - Hh, 0, -Math.PI / 2, Math.PI / 2, true);
        c.lineTo(sx, -cap + bh - Hh); c.closePath();
        c.fill('evenodd');
        seg(w * 0.5, -cap + bh - Hh * 0.5, V * 0.15, V * 0.2, V * 0.96);
      }
      c.restore();
      if (ch === 'Й' && breve) { // кратка — маленькая и тонкая, как на фото почти незаметна
        c.lineWidth = Hh * 0.5; c.lineCap = 'round';
        c.beginPath();
        c.ellipse(w / 2, -cap - Hh * 1.25, w * 0.2, Hh * 0.6, 0, 0.2, Math.PI - 0.2);
        c.stroke();
      }
      c.restore();
    }
    c.restore();
  }

  // ---------- эмблема: панель, чашка с филигранью, ручка, пар ----------
  var PAN = { x0: 88, y0: 57, x1: 472, y1: 330 };
  var RIM = 160;
  var CUPL = [300, 333, 222, 312, 163, 270, 160, RIM]; // левый бок чашки (кубическая Безье снизу вверх)

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var r = Math.imul(seed ^ seed >>> 15, 1 | seed);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  function cupPath(c) {
    c.beginPath();
    c.moveTo(160, RIM);
    c.lineTo(PAN.x1, RIM);
    c.lineTo(PAN.x1, 352);
    c.lineTo(300, 352);
    c.lineTo(CUPL[0], CUPL[1]);
    c.bezierCurveTo(CUPL[2], CUPL[3], CUPL[4], CUPL[5], CUPL[6], CUPL[7]);
    c.closePath();
  }
  // x левого бока чашки на высоте y (по таблице точек кривой)
  var CUPX = (function () {
    var tb = [];
    for (var i = 0; i <= 40; i++) {
      var q = i / 40, a = (1 - q) * (1 - q) * (1 - q), b = 3 * q * (1 - q) * (1 - q), d = 3 * q * q * (1 - q), e = q * q * q;
      tb.push([a * CUPL[0] + b * CUPL[2] + d * CUPL[4] + e * CUPL[6], a * CUPL[1] + b * CUPL[3] + d * CUPL[5] + e * CUPL[7]]);
    }
    return function (y) {
      for (var j = 1; j < tb.length; j++) if (tb[j][1] <= y) {
        var p = tb[j - 1], r = tb[j], f = (y - r[1]) / Math.max(1e-6, p[1] - r[1]);
        return r[0] + (p[0] - r[0]) * f;
      }
      return CUPL[6];
    };
  })();
  // побег арабески: кривизна плавно растёт — конец закручивается в спираль; по пути листья
  function vine(c, R, x, y, a, n, k0, dk, sgn, leafEvery, step) {
    var pts = [[x, y]], k = k0;
    step = step || 3.2;
    for (var i = 0; i < n; i++) {
      var f = i / n;
      k = k0 + dk * f * f * f;
      a += sgn * k;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      pts.push([x, y]);
      if (leafEvery && i > 3 && i % leafEvery === 0 && f < 0.75) {
        var side = (i / leafEvery) % 2 ? 1 : -1;
        leaf(c, x, y, a + side * (0.8 + R() * 0.5), 13 + R() * 9, 4.5 + R() * 2.5, R() < 0.5);
      }
    }
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var j = 1; j < pts.length; j++) c.lineTo(pts[j][0], pts[j][1]);
    c.stroke();
    return [x, y, a];
  }
  // лист-миндалина контуром (+ иногда средняя жилка), чуть изогнутый
  function leaf(c, x, y, a, L, W, rib) {
    var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, bend = W * 0.35;
    var tx = x + ca * L + nx * bend, ty = y + sa * L + ny * bend;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + ca * L * 0.3 + nx * W * 1.1, y + sa * L * 0.3 + ny * W * 1.1,
      x + ca * L * 0.8 + nx * W * 0.9, y + sa * L * 0.8 + ny * W * 0.9, tx, ty);
    c.bezierCurveTo(x + ca * L * 0.75 - nx * W * 0.5, y + sa * L * 0.75 - ny * W * 0.5,
      x + ca * L * 0.3 - nx * W * 0.9, y + sa * L * 0.3 - ny * W * 0.9, x, y);
    c.stroke();
    if (rib) {
      c.beginPath(); c.moveTo(x + ca * 2, y + sa * 2);
      c.quadraticCurveTo(x + ca * L * 0.5 + nx * W * 0.3, y + sa * L * 0.5 + ny * W * 0.3, x + ca * L * 0.8 + nx * bend, y + sa * L * 0.8 + ny * bend);
      c.stroke();
    }
  }
  // ячейки Вороного: многоугольник каждой точки в рамке box = [x0, y0, x1, y1]
  function voronoi(P, box) {
    var out = [];
    for (var i = 0; i < P.length; i++) {
      var poly = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
      for (var j = 0; j < P.length && poly.length; j++) {
        if (i === j) continue;
        var nx = P[j][0] - P[i][0], ny = P[j][1] - P[i][1];
        if (nx * nx + ny * ny > 3600) continue;
        var mx = (P[i][0] + P[j][0]) / 2, my = (P[i][1] + P[j][1]) / 2, np = [];
        for (var k = 0; k < poly.length; k++) {
          var a = poly[k], b = poly[(k + 1) % poly.length];
          var da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
          if (da <= 0) np.push(a);
          if ((da <= 0) !== (db <= 0)) {
            var f = da / (da - db);
            np.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
          }
        }
        poly = np;
      }
      out.push(poly);
    }
    return out;
  }
  // ячейка «мраморной» филиграни: гладкая замкнутая петля-капля с неровным краем
  function blob(c, R, x, y, a, L, W) {
    var n = 7, pts = [];
    for (var i = 0; i < n; i++) {
      var t = i / n * Math.PI * 2, rr = 1 + (R() - 0.5) * 0.5;
      var lx = Math.cos(t) * L * 0.5 * rr * (Math.cos(t) > 0 ? 1.15 : 0.85), ly = Math.sin(t) * W * 0.5 * rr;
      pts.push([x + lx * Math.cos(a) - ly * Math.sin(a), y + lx * Math.sin(a) + ly * Math.cos(a)]);
    }
    c.beginPath();
    var m0 = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2];
    c.moveTo(m0[0], m0[1]);
    for (var j = 0; j < n; j++) {
      var p = pts[j], q = pts[(j + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath(); c.stroke();
  }
  // филигрань: светлые контуры листьев и побегов на тёмной чаше — «дерево» из-под донышка,
  // по краям — плотная сетка листьев по радиальному потоку (как на фото)
  function filigree(c, col) {
    var R = rng(1987);
    c.save();
    cupPath(c); c.clip();
    c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
    // ствол и главные ветви поверх сети (сеть рисуется ниже, в этом же клипе)
    var trunk = function () {
      c.lineWidth = 4.2;
      var tr = vine(c, R, 334, 356, -1.6, 28, 0.004, 0.03, -1, 0);
      c.lineWidth = 3.6;
      vine(c, R, tr[0], tr[1], -2.35, 34, 0.01, 0.42, -1, 9);
      vine(c, R, tr[0], tr[1], -0.8, 38, 0.01, 0.40, 1, 9);
      vine(c, R, 334, 302, -2.9, 30, 0.02, 0.40, 1, 0);
      vine(c, R, 336, 296, -0.2, 34, 0.02, 0.42, -1, 0);
    };
    // «мраморная» сеть: рёбра диаграммы Вороного по дротикам с шагом ~19 px, рёбра чуть изогнуты;
    // в части ячеек — завиток или жилка листа (как филигрань на фото)
    var P = [], tries = 0, D = 24;
    while (P.length < 110 && tries++ < 9000) {
      var y = RIM - 6 + R() * (352 - RIM), x = 150 + R() * (PAN.x1 + 8 - 150);
      var ok = true;
      for (var i = 0; i < P.length && ok; i++) {
        var dx = P[i][0] - x, dy = P[i][1] - y;
        if (dx * dx + dy * dy < D * D) ok = false;
      }
      if (ok) P.push([x, y]);
    }
    var cells = voronoi(P, [140, RIM - 12, PAN.x1 + 14, 360]);
    var hash = function (a, b) {
      var h = Math.sin(Math.round(a[0] * 3 + b[0] * 3) * 12.9898 + Math.round(a[1] * 3 + b[1] * 3) * 78.233) * 43758.5453;
      return h - Math.floor(h);
    };
    for (var j = 0; j < cells.length; j++) {
      var poly = cells[j];
      c.lineWidth = 3.9;
      for (var k = 0; k < poly.length; k++) {
        var a = poly[k], b = poly[(k + 1) % poly.length];
        var ex = b[0] - a[0], ey = b[1] - a[1], el = Math.sqrt(ex * ex + ey * ey);
        if (el < 0.5) continue;
        // одинаковый S-изгиб у обеих соседних ячеек (зависит только от пары концов)
        var hv = hash(a, b), w = (hv - 0.5) * 1.5 * Math.min(el, 22), w2 = (hash(b, a) - 0.5) * 1.3 * Math.min(el, 22);
        var lo = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]), A = lo ? a : b, Bp = lo ? b : a;
        var fx = Bp[0] - A[0], fy = Bp[1] - A[1];
        c.beginPath(); c.moveTo(A[0], A[1]);
        c.bezierCurveTo(A[0] + fx / 3 - fy / el * w, A[1] + fy / 3 + fx / el * w,
          A[0] + fx * 2 / 3 + fy / el * w2, A[1] + fy * 2 / 3 - fx / el * w2, Bp[0], Bp[1]);
        c.stroke();
      }
      var q = P[j], r = R();
      c.lineWidth = 3.5;
      if (r < 0.45) vine(c, R, q[0] - 5, q[1] + 4, R() * 6.3, 9 + (R() * 6 | 0), 0.12, 1.0, R() < 0.5 ? 1 : -1, 0, 2.6);
      else if (r < 0.7) leaf(c, q[0] - 8, q[1] + 2, Math.atan2(q[1] - 372, q[0] - 334) + (R() - 0.5), 16 + R() * 6, 5 + R() * 2, true);
      else if (r < 0.8) { c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); c.quadraticCurveTo(q[0] + 3, q[1] - 3, q[0] + (q[0] - poly[0][0]) * 0.3, q[1] + (q[1] - poly[0][1]) * 0.3); c.stroke(); }
      else if (r < 0.88) { c.beginPath(); c.arc(q[0] + 3, q[1] - 2, 2.6, 0, Math.PI * 2); c.fill(); }
    }
    // розетка справа (крупный цветок из лепестков, как на фото)
    c.lineWidth = 3.4;
    for (var m = 0; m < 7; m++) leaf(c, 404, 250, m / 7 * Math.PI * 2 + 0.3, 22, 8, true);
    // светлый край венчика
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(158, RIM + 1.5); c.lineTo(PAN.x1, RIM + 1.5); c.stroke();
    trunk();
    c.restore();
    // «корни» под донышком на доске и ободок блюдца
    c.save();
    c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
    var R2 = rng(77);
    c.beginPath(); c.moveTo(226, 333); c.bezierCurveTo(300, 337, 380, 331, PAN.x1 - 2, 335); c.stroke();
    c.lineWidth = 2.6;
    for (var k = 0; k < 13; k++) {
      var rx = 196 + k * 21 + (R2() - 0.5) * 10;
      c.beginPath(); c.moveTo(rx, 333);
      c.bezierCurveTo(rx + (R2() - 0.5) * 16, 339, rx + (R2() - 0.5) * 22, 344, rx + (R2() - 0.5) * 30, 345 + R2() * 7);
      c.stroke();
    }
    c.restore();
  }
  function steam(c, dark, light) {
    // два S-образных «ленточных» завитка пара: двойные линии от верха панели до края чашки;
    // внутри панели — тёмные, над панелью (на доске) — светлые
    var rib = [
      [[262, 44], [261, 70], [282, 92], [281, 118], [280, 138], [292, 146], [294, RIM + 2]],
      [[330, 44], [329, 72], [354, 94], [358, 120], [361, 140], [375, 148], [377, RIM + 2]]
    ];
    for (var i = 0; i < rib.length; i++) {
      var p = rib[i];
      var path = function (dx) {
        c.beginPath(); c.moveTo(p[0][0] + dx, p[0][1]);
        c.bezierCurveTo(p[1][0] + dx, p[1][1], p[2][0] + dx, p[2][1], p[3][0] + dx, p[3][1]);
        c.bezierCurveTo(p[4][0] + dx, p[4][1], p[5][0] + dx, p[5][1], p[6][0] + dx, p[6][1]);
      };
      for (var pass = 0; pass < 2; pass++) {
        c.save();
        c.beginPath();
        if (pass === 0) c.rect(PAN.x0, PAN.y0, PAN.x1 - PAN.x0, RIM - PAN.y0);
        else c.rect(PAN.x0, 30, PAN.x1 - PAN.x0, PAN.y0 - 30);
        c.clip();
        c.lineCap = 'round';
        c.strokeStyle = pass ? light : dark;
        c.lineWidth = 3.6;
        path(-5.8); c.stroke();
        path(5.8); c.stroke();
        c.restore();
      }
    }
  }
  function emblem(c, K, glow) {
    // панель (ночью светится)
    glow(true);
    c.fillStyle = K.panel;
    c.fillRect(PAN.x0, PAN.y0, PAN.x1 - PAN.x0, PAN.y1 - PAN.y0);
    glow(false);
    // тёмная полоса справа вверху (тень чашки на стене)
    c.fillStyle = K.cup;
    c.fillRect(434, 64, 30, RIM - 64 + 2);
    // ручка: петля-капля слева от чашки (концы уходят под чашку)
    c.save();
    c.strokeStyle = K.cup; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = 2.7;
    c.beginPath();
    c.moveTo(166, 171);
    c.bezierCurveTo(126, 154, 86, 168, 93, 197);
    c.bezierCurveTo(99, 220, 142, 240, 196, 258);
    c.stroke();
    c.lineWidth = 1.9;
    c.beginPath();
    c.moveTo(165, 185);
    c.bezierCurveTo(134, 173, 106, 182, 112, 200);
    c.bezierCurveTo(117, 214, 148, 229, 190, 244);
    c.stroke();
    c.restore();
    steam(c, K.cup, K.fil);
    // чашка
    c.fillStyle = K.cup;
    cupPath(c); c.fill();
    filigree(c, K.fil);
    // светлая кромка панели справа (идёт и вдоль чашки) и над тёмной полосой
    c.fillStyle = K.panel;
    c.fillRect(PAN.x1 - 4, PAN.y0, 4, PAN.y1 - PAN.y0);
    c.fillRect(434, PAN.y0, PAN.x1 - 434, 4);
  }

  function markharaiSignCanvas(opts) {
    opts = opts || {};
    var W = opts.width || BW;
    var bh = opts.boardH || Math.round(W * BH / BW);
    var H = opts.height || bh;
    var cv = opts.canvas || document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var K = opts.night ? NIGHT : DAY;
    c.save();
    c.fillStyle = K.board; c.fillRect(0, 0, W, H);
    c.scale(W / BW, bh / BH);
    // тонкая светлая рамка доски
    c.strokeStyle = K.frame; c.lineWidth = 4;
    c.strokeRect(7, 7, BW - 14, BH - 14);
    if (opts.night) { // лайтбокс: мягкое свечение изнутри
      var g = c.createLinearGradient(0, 0, 0, BH);
      g.addColorStop(0, 'rgba(255,214,150,0.10)'); g.addColorStop(0.5, 'rgba(255,214,150,0.04)');
      g.addColorStop(1, 'rgba(255,214,150,0.10)');
      c.fillStyle = g; c.fillRect(10, 10, BW - 20, BH - 20);
    }
    var glow = function (on) {
      if (K.glow && on) { c.shadowColor = K.glow; c.shadowBlur = 22 * W / BW; }
      else { c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; }
    };
    emblem(c, K, glow);
    // надписи: ночью сначала в отдельный слой без тени, затем слой целиком со свечением —
    // иначе тени отдельных кусков букв ложатся друг на друга швами
    var ink = function (g) {
      g.fillStyle = K.ink;
      drawKof(g, K.ink, opts.kofBreve !== false);
      g.fillStyle = K.ink;
      if (opts.word !== false) for (var i = 0; i < WORD.length; i++) GLYPH[WORD[i][0]](new Pen(g, WORD[i][1]));
    };
    if (K.glow && typeof document !== 'undefined') {
      var L = document.createElement('canvas');
      L.width = W; L.height = H;
      var g = L.getContext('2d');
      g.scale(W / BW, bh / BH);
      ink(g);
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.shadowColor = K.glow; c.shadowBlur = 24 * W / BW;
      c.drawImage(L, 0, 0);
      c.shadowColor = 'rgba(255,214,150,0.5)'; c.shadowBlur = 8 * W / BW;
      c.drawImage(L, 0, 0);
      c.restore();
    } else {
      ink(c);
    }
    c.restore();
    return cv;
  }

  markharaiSignCanvas.layout = { base: [BW, BH], cap: CAP / BH, baseline: BASE / BH, word: WORD, panel: PAN };
  root.markharaiSignCanvas = markharaiSignCanvas;
})(typeof window !== 'undefined' ? window : globalThis);
