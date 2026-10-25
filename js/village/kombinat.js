/* =====================================================================
   КУБАЧИНСКИЙ ХУДОЖЕСТВЕННЫЙ КОМБИНАТ — корпус, двор и проводка (волна «комбинат», раздел C техзадания).
   window.VILLAGE.kombinat = { PLAN, build(ctx) }. Обычный <script>, без модулей; зовёт его js/village/kubachi.js (по образцу
   bazaarBuild: сборщик села передаёт свои бейкеры, списки и хелперы, модуль кладёт геометрию в них и возвращает своё).

   Как на фото пользователя (ref/exterior.png), только «отреставрировали и модернизировали»: тот же двухэтажный корпус
   26 × 14 м из жёлто-песочного кирпича (чистая кладка — полоса WASH атласа в родном масштабе, тон — цветом вершин), каменный
   цоколь, окна в тёмных алюминиевых рамах, на верхней части фасада — постоянная композитная панель с синей орнаментальной
   рамкой, эмблемой и надписью (рисует js/village/kombinat_sign.js; без него — своя светлая доска), справа внизу — стеклянный
   тамбур-вход с раздвижной дверью (проём открыт) и козырьком. Двор: мощёная площадка вдоль фасада, дорожка от улицы ко входу
   со вставкой-«ковром», газоны, молодые деревья справа, низкая ограда с ажурными секциями слева и вдоль улицы, скамьи,
   фонари, клумбы, стенд выставки, пилон с эмблемой у калитки.
   Внутри (заходят пешком, без кнопки и без шторки — как в кофейню): тамбур → вестибюль → длинный коридор → зал музея и цех
   мастеров. Стены, перегородки, проёмы, потолки и окна — здесь; начинка — js/village/kombinat_in.js (furnish(ctx)), без него —
   скромная запасная (пара витрин и верстак).
   Камера: в помещениях — зоны (ближе и ниже), точка камеры не выходит из «свободного объёма» здания (комнаты и проёмы, луч от
   головы), у входной двери — «рельс» сквозь проём (порт кофейни); kubachi.js раздаёт их через handle.camZone/camRail/camBlend.

   Координаты — рамка корпуса F = K.Frame(KOMB.x, 0, KOMB.z, KOMB.ry): +z — фасад (к улице), +x — вправо, если стоять лицом
   к фасаду; y — мировая (земля площадки 0, пол 1-го этажа FL = 0,08). Планировка — PLAN (общая с начинкой).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- планировка (техзадание, «Планировка»; та же, что SPEC начинки) ---------- */
  const FL = 0.08, HC = FL + 3.4, HV = FL + 3.2;
  const PLAN = {
    W: 26, D: 14, wall: 0.3, FL, HC, HV, EAVE: 9.0, PARA: 9.4,   // кровля и верх парапета (высокий аттик — как на фото: панель на верхней половине фасада)
    rooms: {
      V: { x0: 2.2, x1: 6.8, z0: 7.0, z1: 9.7, H: HV },        // тамбур (внутри)
      L: { x0: 2.15, x1: 6.85, z0: 2.15, z1: 6.7, H: HC },     // вестибюль
      C: { x0: -12.7, x1: 12.7, z0: -0.40, z1: 2.00, H: HC },  // коридор
      M: { x0: -12.7, x1: -0.15, z0: -6.7, z1: -0.55, H: HC }, // зал музея
      Wk: { x0: 0.0, x1: 12.7, z0: -6.7, z1: -0.55, H: HC },   // цех мастеров
    },
    // проёмы (h — от пола FL): автоматическая дверь тамбура, вход в вестибюль, в коридор, в музей (+ фрамуга начинки), в цех
    open: {
      auto: { x0: 3.6, x1: 5.4, z0: 9.7, z1: 10.0, h: 2.4 },
      vest: { x0: 3.0, x1: 6.0, z0: 6.7, z1: 7.0, h: 2.8 },
      lobby: { x0: 2.6, x1: 6.4, z0: 2.00, z1: 2.15, h: 2.8 },
      museum: { x0: -7.4, x1: -5.4, z0: -0.55, z1: -0.40, h: 2.5 },
      work: { x0: 5.0, x1: 6.6, z0: -0.55, z1: -0.40, h: 2.4 },
    },
    tambour: { x0: 1.9, x1: 7.1, z0: 7.0, z1: 10.0, top: 3.6 },
    backWin: { xs: [-10.4, -6.4, -2.4, 2.35, 6.35, 10.35], w: 1.6, sill: 0.95, head: 2.75 },   // окна задней стены (от пола FL)
    // окна, за которыми не ходят (кабинеты, 2-й этаж): фасад (1-й этаж; 2-й закрыт панелью, как баннером на фото), торцы, зад.
    // Панель 20,9 × 5,8 м (3,6 : 1): от пояса над 1-м этажом до 0,65 м над парапетом, по бокам — по 2 м кирпича
    frontWin: [-11.2, -8.3, -5.4, -2.5, 0.4, 8.6, 11.4], sideWin2: [-4.6, 0.8, 4.4], panel: { w: 20.88, h: 5.8, y0: 4.25, z: 7.32, cw: 2304, ch: 640 },
    yard: { x0: -15.5, x1: 15.5, z0: -9.6, z1: 17.0, fence: 16.2, path: [3.0, 6.0], porch: { x0: 1.0, x1: 8.0, z1: 11.8 } },
  };

  // мелочи
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const hexC = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  /* =====================================================================
     СБОРКА. ctx (kubachi.js): { THREE, K, VK, S, C, rgb, mix, mul, rng, named, season, WIN, HI, FAR, G, KOMB, chunk, pb,
     glowB, lantB, glass, props, colliders, camExtra, HB, spots, npcs, placeNpc, NIGHT, root, litMesh, litIndoor, addTree,
     rayHit (поздний: ручка ещё не собрана), noSnow(bk, from, to) }
     → { F, views, update(cam, nightT), camZone, camRail, camBlend, inside(p), places, stats }
     ===================================================================== */
  function build(ctx) {
    const T = ctx.THREE, K = ctx.K, S = ctx.S, rgb = ctx.rgb, mix = ctx.mix, mul = ctx.mul, KB = ctx.KOMB, FAR = !!ctx.FAR, HI = !!ctx.HI, WIN = !!ctx.WIN, named = ctx.named !== false;
    const F = new K.Frame(KB.x, 0, KB.z, KB.ry), RY = KB.ry, R0 = PLAN.rooms, OP = PLAN.open, TB = PLAN.tambour;
    const bk = ctx.chunk(KB.x, KB.z), pb = ctx.pb, out = { F, views: {}, places: {}, stats: {} }, bk0 = bk.count(), pb0 = pb.count();
    const P = (x, y, z) => F.p(x, y, z), N = (nx, ny, nz) => { const d = F.dir(nx, nz); return [d[0], ny, d[1]]; };
    const LOC = (x, z) => { const dx = x - KB.x, dz = z - KB.z; return [dx * F.c - dz * F.s, dx * F.s + dz * F.c]; };   // мир → рамка корпуса
    const WLD = (lx, lz) => [KB.x + lx * F.c + lz * F.s, KB.z - lx * F.s + lz * F.c];
    // палитра: восстановленный кирпич — тёплый песочный (полоса WASH ≈ 0,94 серого), камень цоколя, тёмный алюминий
    const BR = WIN ? [0.9, 0.79, 0.6] : [0.95, 0.8, 0.56], BRl = mul(BR, 1.07), STONE = [0.58, 0.55, 0.52], STONEd = mul(STONE, 0.86), CAP = [0.31, 0.32, 0.35];
    const ALU = [0.2, 0.21, 0.23], ALUl = [0.34, 0.35, 0.38], SILL = [0.86, 0.84, 0.8], ROOF = [0.38, 0.39, 0.41], PLAST = [0.93, 0.91, 0.87];
    const PAVE = [0.86, 0.84, 0.8], PAVEd = [0.74, 0.72, 0.68], CURB = [0.66, 0.65, 0.62], WOOD = [0.62, 0.42, 0.27], LAWN = WIN ? [0.95, 0.96, 0.98] : [0.5, 0.62, 0.3];

    /* ---------- грани в рамке F (winding — по нормали n, локальной) ---------- */
    const q4 = (b, pts, n, col, s) => {
      const w = pts.map(p => P(p[0], p[1], p[2])), nw = N(n[0], n[1], n[2]);
      if (dot(cross(sub(w[1], w[0]), sub(w[2], w[0])), nw) < 0) b.quad(w[0], w[3], w[2], w[1], col, s, null, nw); else b.quad(w[0], w[1], w[2], w[3], col, s, null, nw);
    };
    const fZ = (b, x0, x1, y0, y1, z, dir, col, s = S.FLAT) => { if (x1 - x0 > 1e-4 && y1 - y0 > 1e-4) q4(b, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, dir], col, s); };
    const fX = (b, z0, z1, y0, y1, x, dir, col, s = S.FLAT) => { if (z1 - z0 > 1e-4 && y1 - y0 > 1e-4) q4(b, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [dir, 0, 0], col, s); };
    const fY = (b, x0, x1, z0, z1, y, dir, col, s = S.FLAT) => { if (x1 - x0 > 1e-4 && z1 - z0 > 1e-4) q4(b, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, dir, 0], col, s); };
    const box = (b, x0, x1, y0, y1, z0, z1, col, o = {}) => b.box(F, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, Object.assign({ col }, o));
    // стена с прямоугольными дырами: полосы по высоте (края дыр), в полосе — пролёты между дырами. axis 'z' — плоскость z = c
    // (u — x), 'x' — плоскость x = c (u — z). holes: [[u0, u1, v0, v1]]
    const wallH = (b, axis, c, dir, u0, u1, v0, v1, holes, col, s) => {
      const vs = [v0, v1]; holes.forEach(h => [h[2], h[3]].forEach(v => { if (v > v0 + 1e-4 && v < v1 - 1e-4) vs.push(v); }));
      vs.sort((a, b2) => a - b2);
      for (let i = 0; i < vs.length - 1; i++) {
        const va = vs[i], vb = vs[i + 1]; if (vb - va < 1e-4) continue;
        const cov = holes.filter(h => h[2] <= va + 1e-4 && h[3] >= vb - 1e-4 && h[1] > u0 && h[0] < u1).sort((a, b2) => a[0] - b2[0]);
        let u = u0;
        const put = (a, e) => { if (axis === 'z') fZ(b, a, e, va, vb, c, dir, col, s); else fX(b, a, e, va, vb, c, dir, col, s); };
        cov.forEach(h => { if (h[0] > u) put(u, Math.min(h[0], u1)); u = Math.max(u, h[1]); });
        if (u < u1) put(u, u1);
      }
    };
    // откосы дыры: от плоскости c внутрь стены на dep (dir — куда смотрит лицо стены); sill/soffit — нижняя и верхняя грани
    const reveal = (b, axis, c, dir, h, dep, col, s, o = {}) => {
      const a = c, e = c - dir * dep, lo = Math.min(a, e), hi = Math.max(a, e);
      if (axis === 'z') { fX(b, lo, hi, h[2], h[3], h[0], 1, col, s); fX(b, lo, hi, h[2], h[3], h[1], -1, col, s); fY(b, h[0], h[1], lo, hi, h[3], -1, col, s); if (!o.noSill) fY(b, h[0], h[1], lo, hi, h[2], 1, o.sillCol || col, s); }
      else { fZ(b, lo, hi, h[2], h[3], h[0], 1, col, s); fZ(b, lo, hi, h[2], h[3], h[1], -1, col, s); fY(b, lo, hi, h[0], h[1], h[3], -1, col, s); if (!o.noSill) fY(b, lo, hi, h[0], h[1], h[2], 1, o.sillCol || col, s); }
    };
    // окно, за которым не ходят: проём с откосами 0,16 м, «стекло» — общая сетка окон села (ночью теплеет), каменный отлив
    const winOpaque = (axis, c, dir, u, w, y0, y1, holes, glow) => {
      const h = [u - w / 2, u + w / 2, y0, y1]; holes.push(h);
      reveal(bk, axis, c, dir, h, 0.16, mul(PLAST, 0.96), S.PLASTER, { sillCol: SILL });
      const ry = axis === 'z' ? (dir > 0 ? 0 : PI) : (dir > 0 ? PI / 2 : -PI / 2), d = c - dir * 0.15;
      if (axis === 'z') ctx.glass(F, u, (y0 + y1) / 2, d, w, y1 - y0, 3, ALUl, glow ? 1 : 0, ry); else ctx.glass(F, d, (y0 + y1) / 2, u, w, y1 - y0, 3, ALUl, glow ? 1 : 0, ry);
      // отлив: светлый камень на 6 см наружу
      if (axis === 'z') box(bk, u - w / 2 - 0.06, u + w / 2 + 0.06, y0 - 0.06, y0, Math.min(c, c + dir * 0.07), Math.max(c, c + dir * 0.07), SILL, { skip: { ny: 1 } });
      else box(bk, Math.min(c, c + dir * 0.07), Math.max(c, c + dir * 0.07), y0 - 0.06, y0, u - w / 2 - 0.06, u + w / 2 + 0.06, SILL, { skip: { ny: 1 } });
    };

    /* =====================================================================
       1. КОРПУС СНАРУЖИ
       ===================================================================== */
    const X = PLAN.W / 2, Z = PLAN.D / 2, EAVE = PLAN.EAVE, PARA = PLAN.PARA, PL = 0.75, FW = 0.3;   // PL — верх цоколя
    const bw = PLAN.backWin, FWIN = PLAN.frontWin, PN = PLAN.panel, pw = PN.w / 2;
    const holesF = [], holesB = [], holesW = [], holesE = [];
    // --- фасад (z = +7): окна кабинетов 1-го этажа, окна 2-го этажа по бокам панели, проём из тамбура в вестибюль ---
    holesF.push([OP.vest.x0, OP.vest.x1, 0, FL + OP.vest.h]);
    FWIN.forEach((x, i) => winOpaque('z', Z, 1, x, 1.5, 1.0, 2.75, holesF, i % 3 !== 1));
    // --- зад (z = −7): окна музея и цеха — сквозные (за ними зал), окна 2-го этажа — над ними ---
    bw.xs.forEach(x => holesB.push([x - bw.w / 2, x + bw.w / 2, FL + bw.sill, FL + bw.head]));
    bw.xs.forEach((x, i) => winOpaque('z', -Z, -1, x, 1.5, 4.85, 6.6, holesB, i % 2 === 0));
    // --- торцы: кабинеты (окно у фасада), 2-й этаж; запад — запасный выход из коридора (дверь), восток — глухо внизу ---
    winOpaque('x', -X, -1, 4.4, 1.5, 1.0, 2.75, holesW, true); winOpaque('x', X, 1, 4.4, 1.5, 1.0, 2.75, holesE, false);
    PLAN.sideWin2.forEach((z, i) => { winOpaque('x', -X, -1, z, 1.4, 4.85, 6.6, holesW, i !== 1); winOpaque('x', X, 1, z, 1.4, 4.85, 6.6, holesE, i === 1); });
    const EXIT = { z0: 0.3, z1: 1.3, h: FL + 2.15 }; holesW.push([EXIT.z0, EXIT.z1, 0, EXIT.h]);
    // кирпич: от верха цоколя до верха парапета; цоколь — камень на 4 см наружу
    wallH(bk, 'z', Z, 1, -X, X, PL, PARA, holesF.filter(h => h[3] > PL), BR, S.WASH);
    wallH(bk, 'z', -Z, -1, -X, X, PL, PARA, holesB.filter(h => h[3] > PL), BR, S.WASH);
    wallH(bk, 'x', -X, -1, -Z, Z, PL, PARA, holesW.filter(h => h[3] > PL), BR, S.WASH);
    wallH(bk, 'x', X, 1, -Z, Z, PL, PARA, holesE.filter(h => h[3] > PL), BR, S.WASH);
    { const e = 0.04, hF = holesF.filter(h => h[2] < PL), hW = holesW.filter(h => h[2] < PL);
      wallH(bk, 'z', Z + e, 1, -X - e, X + e, 0, PL, hF, STONE, S.SLAB); wallH(bk, 'z', -Z - e, -1, -X - e, X + e, 0, PL, [], STONE, S.SLAB);
      wallH(bk, 'x', -X - e, -1, -Z - e, Z + e, 0, PL, hW, STONE, S.SLAB); wallH(bk, 'x', X + e, 1, -Z - e, Z + e, 0, PL, [], STONE, S.SLAB);
      // верх цоколя — полочка (кроме проёмов)
      const top = (x0, x1, z0, z1) => fY(bk, x0, x1, z0, z1, PL, 1, STONEd);
      top(-X - e, OP.vest.x0, Z, Z + e); top(OP.vest.x1, X + e, Z, Z + e); top(-X - e, X + e, -Z - e, -Z);
      top(-X - e, -X, -Z, EXIT.z0); top(-X - e, -X, EXIT.z1, Z); top(X, X + e, -Z, Z);
      // торцы полочки у проёмов
      fX(bk, Z, Z + e, 0, PL, OP.vest.x0, 1, STONEd); fX(bk, Z, Z + e, 0, PL, OP.vest.x1, -1, STONEd); fZ(bk, -X - e, -X, 0, PL, EXIT.z0, 1, STONEd); fZ(bk, -X - e, -X, 0, PL, EXIT.z1, -1, STONEd); }
    // откосы запасного выхода (до дверного полотна); откосы проёма тамбур → вестибюль — в сетке зала (раздел 4): проём внутри
    // освещённого объёма, уличная штукатурка там ночью синела
    reveal(bk, 'x', -X, -1, [EXIT.z0, EXIT.z1, 0, EXIT.h], 0.12, mul(PLAST, 0.95), S.PLASTER, { noSill: true });
    const gl = new K.Baker('vc'), GLC = [0.78, 0.86, 0.92];   // стёкла (прозрачные): тамбур, окна залов, козырёк запасного выхода
    // запасный выход: стальная дверь (тёмная), ручка, ступенька, маленький козырёк и фонарь
    fX(bk, EXIT.z0, EXIT.z1, 0, EXIT.h, -X + 0.12, -1, rgb('#3E4A56'));   // полотно — в глубине откоса (было на 12 см снаружи стены: щели по бокам)
    box(bk, -X + 0.08, -X + 0.12, 1.0, 1.05, EXIT.z1 - 0.2, EXIT.z1 - 0.08, ALUl);
    box(bk, -X - 0.5, -X, 0, 0.12, EXIT.z0 - 0.25, EXIT.z1 + 0.25, STONE, { skip: { ny: 1 } });
    // козырёк — стеклянный в тонкой раме на двух консолях (как тамбур): камера, поднявшись у стены над ним, видит героиню сквозь
    // стекло (сплошная плита закрывала её; камерная коробка вместо этого прижимала камеру к лицу у двери)
    { const y = EXIT.h + 0.34, za = EXIT.z0 - 0.35, zb = EXIT.z1 + 0.35, xo = -X - 0.7;
      [[0, 1, 0], [0, -1, 0]].forEach(n => q4(gl, [[xo, y, za], [-X, y, za], [-X, y, zb], [xo, y, zb]], n, GLC, 0));
      box(bk, xo, xo + 0.04, y - 0.03, y + 0.03, za, zb, ALU); [za, zb - 0.04].forEach(z => box(bk, xo, -X, y - 0.03, y + 0.03, z, z + 0.04, ALU));
      [za, zb - 0.04].forEach(z => box(bk, -X - 0.24, -X, y - 0.16, y - 0.03, z, z + 0.04, ALU)); }   // консоли у стены
    // пояс между этажами (светлый бетон, 3 см наружу) и карниз парапета; парапет и кровля
    { const y0 = 3.86, y1 = 4.02, e = 0.03;
      box(bk, -X - e, X + e, y0, y1, Z, Z + e, SILL, { skip: { nz: 1 } }); box(bk, -X - e, X + e, y0, y1, -Z - e, -Z, SILL, { skip: { pz: 1 } });
      box(bk, -X - e, -X, y0, y1, -Z, Z, SILL, { skip: { px: 1 } }); box(bk, X, X + e, y0, y1, -Z, Z, SILL, { skip: { nx: 1 } });
      const ip = X - FW, iz = Z - FW, cp = 0.06;   // покрытие парапета (металл) — кольцом; внутренние грани парапета и кровля
      box(bk, -X - cp, X + cp, PARA, PARA + 0.07, iz - 0.02, Z + cp, CAP, { skip: { ny: 1 } }); box(bk, -X - cp, X + cp, PARA, PARA + 0.07, -Z - cp, -iz + 0.02, CAP, { skip: { ny: 1 } });
      box(bk, -X - cp, -ip + 0.02, PARA, PARA + 0.07, -iz + 0.02, iz - 0.02, CAP, { skip: { ny: 1, pz: 1, nz: 1 } }); box(bk, ip - 0.02, X + cp, PARA, PARA + 0.07, -iz + 0.02, iz - 0.02, CAP, { skip: { ny: 1, pz: 1, nz: 1 } });
      fZ(bk, -ip, ip, EAVE, PARA, iz, -1, mul(BR, 0.92), S.WASH); fZ(bk, -ip, ip, EAVE, PARA, -iz, 1, mul(BR, 0.92), S.WASH);
      fX(bk, -iz, iz, EAVE, PARA, -ip, 1, mul(BR, 0.92), S.WASH); fX(bk, -iz, iz, EAVE, PARA, ip, -1, mul(BR, 0.92), S.WASH);
      fY(bk, -ip, ip, -iz, iz, EAVE, 1, ROOF, S.FLAT);
      // на кровле: две вентустановки и выход на крышу (будка)
      [[-6.5, -3.0], [7.0, -3.5]].forEach(([x, z]) => { box(bk, x - 0.8, x + 0.8, EAVE, EAVE + 0.9, z - 0.6, z + 0.6, [0.62, 0.64, 0.66], { skip: { ny: 1 } }); box(bk, x - 0.3, x + 0.3, EAVE + 0.9, EAVE + 1.15, z - 0.3, z + 0.3, [0.5, 0.52, 0.55], { skip: { ny: 1 } }); });
      box(bk, -10.6, -8.4, EAVE, EAVE + 2.3, -5.6, -3.6, BR, { s: S.WASH, cols: { py: CAP }, ss: { py: S.FLAT }, skip: { ny: 1 } }); }

    /* ---------- тамбур: стеклянный короб в тёмных рамах, раздвижная дверь (открыта), плита-козырёк ---------- */
    { const x0 = TB.x0, x1 = TB.x1, z0 = TB.z0, z1 = TB.z1, zf = z1 - 0.15, top = TB.top, gH = 3.3, dH = FL + OP.auto.h, mv = 0.05, md = 0.12;
      // гранитный цоколь-бортик под стеклом (0,12) и плита крыши-козырька
      box(bk, x0, OP.auto.x0, 0, 0.14, zf - 0.08, zf + 0.08, STONE, { skip: { ny: 1 } }); box(bk, OP.auto.x1, x1, 0, 0.14, zf - 0.08, zf + 0.08, STONE, { skip: { ny: 1 } });
      [x0 + 0.15, x1 - 0.15].forEach(x => box(bk, x - 0.08, x + 0.08, 0, 0.14, z0, zf, STONE, { skip: { ny: 1 } }));
      box(bk, x0 - 0.3, x1 + 0.3, gH, top, z0, z1 + 1.4, ALU, { cols: { py: CAP, ny: rgb('#C9A57A') }, skip: {} });   // козырёк: снизу — тёплая «древесная» подшивка
      box(bk, x0 - 0.32, x1 + 0.32, top - 0.02, top + 0.06, z0, z1 + 1.42, CAP, { skip: { ny: 1 } });
      fY(bk, R0.V.x0, R0.V.x1, R0.V.z0, R0.V.z1, HV, -1, mul(PLAST, 1.02));   // потолок тамбура (наружная сетка: виден сквозь стекло и издали)
      fY(bk, R0.V.x0, R0.V.x1, R0.V.z0, R0.V.z1, FL + 0.002, 1, mul(PAVEd, 0.82), S.SLAB);   // и пол (гранит): нутро снаружи рисуется не всегда — под ним видимая земля двора
      // три точечных светильника в подшивке козырька
      [x0 + 1.2, (x0 + x1) / 2, x1 - 1.2].forEach(x => { const p = P(x, gH - 0.012, z1 + 0.75); ctx.glowB.cyl(p[0], p[1], p[2], 0.07, 0.07, 0.01, { seg: 8, col: rgb('#FFE7B8') }); ctx.NIGHT.lamps.push([p[0], p[1] - 0.05, p[2]]); });
      // рамы: стойки фасада тамбура, ригели (низ, верх двери, верх стекла), стойки боков
      const sv = (x, z, y0, y1) => box(bk, x - mv / 2, x + mv / 2, y0, y1, z - md / 2, z + md / 2, ALU);
      [x0 + 0.03, 2.75, OP.auto.x0, OP.auto.x1, 6.25, x1 - 0.03].forEach(x => sv(x, zf, 0.14, gH));
      [[x0, OP.auto.x0], [OP.auto.x1, x1]].forEach(([a, b]) => { box(bk, a, b, 0.14, 0.22, zf - md / 2, zf + md / 2, ALU); box(bk, a, b, dH - 0.03, dH + 0.03, zf - md / 2, zf + md / 2, ALU); });
      box(bk, OP.auto.x0, OP.auto.x1, dH, dH + 0.08, zf - md / 2, zf + md / 2, ALU); box(bk, x0, x1, gH - 0.06, gH, zf - md / 2, zf + md / 2, ALU);
      [x0 + 0.15, x1 - 0.15].forEach(x => { [z0 + 0.04, (z0 + zf) / 2].forEach(z => box(bk, x - md / 2, x + md / 2, 0.14, gH, z - mv / 2, z + mv / 2, ALU)); box(bk, x - md / 2, x + md / 2, 0.14, 0.22, z0, zf, ALU); box(bk, x - md / 2, x + md / 2, gH - 0.06, gH, z0, zf, ALU); box(bk, x - md / 2, x + md / 2, dH - 0.03, dH + 0.03, z0, zf, ALU); });
      // стёкла: фасад (без проёма двери), фрамуга над дверью, бока
      const gq = (pts, n) => q4(gl, pts, n, GLC, 0);
      [[x0 + 0.06, OP.auto.x0], [OP.auto.x1, x1 - 0.06]].forEach(([a, b]) => gq([[a, 0.22, zf], [b, 0.22, zf], [b, gH - 0.06, zf], [a, gH - 0.06, zf]], [0, 0, 1]));
      gq([[OP.auto.x0, dH + 0.08, zf], [OP.auto.x1, dH + 0.08, zf], [OP.auto.x1, gH - 0.06, zf], [OP.auto.x0, gH - 0.06, zf]], [0, 0, 1]);
      [[x0 + 0.15, -1], [x1 - 0.15, 1]].forEach(([x, d]) => gq([[x, 0.22, z0 + 0.06], [x, 0.22, zf - 0.06], [x, gH - 0.06, zf - 0.06], [x, gH - 0.06, z0 + 0.06]], [d, 0, 0]));
      // раздвижные створки — отъехали за глухие стёкла (изнутри, на 6 см): рамка и стекло
      [[2.82, OP.auto.x0 + 0.05], [OP.auto.x1 - 0.05, 6.18]].forEach(([a, b]) => { const z = zf - 0.1; box(bk, a, b, 0.1, 0.16, z - 0.02, z + 0.02, ALUl); box(bk, a, b, dH - 0.06, dH - 0.02, z - 0.02, z + 0.02, ALUl); [a, b].forEach(x => box(bk, x - 0.02, x + 0.02, 0.1, dH - 0.02, z - 0.02, z + 0.02, ALUl)); gq([[a, 0.16, z], [b, 0.16, z], [b, dH - 0.06, z], [a, dH - 0.06, z]], [0, 0, 1]); });
      box(bk, OP.auto.x0 - 0.3, OP.auto.x1 + 0.3, dH + 0.08, dH + 0.24, zf - 0.2, zf - 0.08, ALUl);   // привод двери (короб над проёмом изнутри)
      box(bk, 4.25, 4.75, dH + 0.1, dH + 0.18, zf + 0.06, zf + 0.09, rgb('#2A2C30'));   // датчик движения
    }

    /* ---------- композитная панель на фасаде (17,6 × 5,5 м): рамка, кронштейны, тыл над парапетом ---------- */
    { const z0 = Z + 0.12, z1 = PN.z, y0 = PN.y0, y1 = PN.y0 + PN.h, e = 0.07;
      box(bk, -pw, pw, y0, y1, z0, z1 - 0.01, [0.42, 0.44, 0.47], { skip: { pz: 1 } });   // короб панели (тыл виден над парапетом и сбоку)
      box(bk, -pw - e, pw + e, y0 - e, y0, z0, z1 + 0.03, ALU); box(bk, -pw - e, pw + e, y1, y1 + e, z0, z1 + 0.03, ALU);
      box(bk, -pw - e, -pw, y0, y1, z0, z1 + 0.03, ALU); box(bk, pw, pw + e, y0, y1, z0, z1 + 0.03, ALU);
      [-9.6, -4.8, 0, 4.8, 9.6].forEach(x => { box(bk, x - 0.05, x + 0.05, y0 + 0.15, y0 + 0.3, Z, z0, ALU); box(bk, x - 0.05, x + 0.05, PARA - 0.6, PARA - 0.45, Z, z0, ALU); });
      [-8.6, -2.9, 2.9, 8.6].forEach(x => box(bk, x - 0.06, x + 0.06, PARA + 0.07, y1 - 0.1, Z - 0.06, z0, ALU));   // стойки над парапетом
      out.panel = { p: P(0, (y0 + y1) / 2, z1 + 0.012), ry: RY, w: PN.w, h: PN.h }; }

    /* =====================================================================
       2. ДВОР: площадка вдоль фасада, крыльцо, дорожка с «ковром», газоны, бордюры, клумбы
       ===================================================================== */
    const YD = PLAN.yard, PZ = YD.porch, [px0, px1] = YD.path, FN = YD.fence;
    if (!FAR) {
      const yP = 0.025, snow0 = bk.n;
      // площадка вдоль фасада (z 7…9,4) и вокруг тамбура; отмостка по бокам и сзади (0,9 м)
      fY(bk, -X - 0.9, TB.x0, Z, 9.4, yP, 1, PAVE, S.SLAB); fY(bk, TB.x1, X + 0.9, Z, 9.4, yP, 1, PAVE, S.SLAB);
      fY(bk, -X - 0.9, -X, -Z - 0.9, Z, yP, 1, PAVEd, S.SLAB); fY(bk, X, X + 0.9, -Z - 0.9, Z, yP, 1, PAVEd, S.SLAB); fY(bk, -X, X, -Z - 0.9, -Z, yP, 1, PAVEd, S.SLAB);
      // крыльцо (гранит, вровень с полом FL): верх и торцы
      fY(bk, PZ.x0, PZ.x1, TB.z1, PZ.z1, FL + 0.004, 1, mul(PAVE, 0.93), S.SLAB);
      fY(bk, PZ.x0, TB.x0, TB.z0, TB.z1, FL + 0.004, 1, mul(PAVE, 0.93), S.SLAB); fY(bk, TB.x1, PZ.x1, TB.z0, TB.z1, FL + 0.004, 1, mul(PAVE, 0.93), S.SLAB);
      fZ(bk, PZ.x0, PZ.x1, 0, FL + 0.004, PZ.z1, 1, STONEd); fX(bk, TB.z0, PZ.z1, 0, FL + 0.004, PZ.x0, -1, STONEd); fX(bk, TB.z0, PZ.z1, 0, FL + 0.004, PZ.x1, 1, STONEd);
      // дорожка от улицы к крыльцу: светлая плитка, по краям бордюр; вставка-«ковёр» — сеткой картинок (ниже)
      fY(bk, px0, px1, PZ.z1, FN + 0.6, yP + 0.005, 1, PAVE, S.SLAB);
      // перед калиткой — площадка до края улицы (улица кончается у калитки: отсюда — по плитке во двор)
      fY(bk, px0 - 2.2, px1 + 1.6, FN + 0.25, 17.05, yP, 1, mul(PAVE, 0.96), S.SLAB);
      [px0 - 0.12, px1].forEach(x => box(bk, x, x + 0.12, 0, 0.07, PZ.z1, FN, CURB, { skip: { ny: 1 } }));
      // разворотный карман вдоль ограды восточнее калитки — продолжение улицы (её конец — lx 1,8): машина встаёт у калитки, в
      // дальнем конце — выезд «Дорога вниз, в город» (ездить — KOMB.bay в kubachi.js); бордюр по южному краю и в торце
      fY(bk, 1.6, 16.0, 17.05, 22.9, yP, 1, mul(PAVEd, 0.97), S.SLAB);
      box(bk, 1.6, 16.15, 0, 0.07, 22.9, 23.05, CURB, { skip: { ny: 1 } }); box(bk, 16.0, 16.15, 0, 0.07, 16.4, 22.9, CURB, { skip: { ny: 1 } });
      // мощение и крыльцо — без снега (почищено); газоны и клумбы (ниже) зимой белые
      if (WIN && ctx.noSnow) ctx.noSnow(bk, snow0, bk.n);
      // газоны (свежая трава поверх плато, полосами стрижки) и бордюр вдоль площадки
      const lawn = (x0, x1, z0, z1) => { const n = Math.max(1, Math.round((x1 - x0) / 1.6)); for (let i = 0; i < n; i++) { const a = x0 + (x1 - x0) * i / n, b2 = x0 + (x1 - x0) * (i + 1) / n; fY(bk, a, b2, z0, z1, 0.018, 1, mul(LAWN, i & 1 ? 1.06 : 0.97), S.PLASTER); } };
      lawn(-X - 2.0, px0 - 0.12, 9.52, FN - 0.15); lawn(px1 + 0.12, X + 2.0, 9.52, FN - 0.15);
      box(bk, -X - 2.0, PZ.x0, 0, 0.07, 9.4, 9.52, CURB, { skip: { ny: 1 } }); box(bk, PZ.x1, X + 2.0, 0, 0.07, 9.4, 9.52, CURB, { skip: { ny: 1 } });
      // клумбы у фасада: каменный бортик, земля, цветы (осенью — рыжие астры, зимой — под снегом)
      [[-10.6, -6.4], [8.2, 12.2]].forEach(([a, b2], k) => {
        const z0 = 9.9, z1 = 11.1; box(bk, a, b2, 0, 0.22, z0, z1, STONE, { cols: { py: rgb('#6E5644') }, skip: { ny: 1 } });
        if (!WIN) for (let i = 0; i < 14; i++) { const x = a + 0.25 + (b2 - a - 0.5) * ((i * 0.618) % 1), z = z0 + 0.22 + 0.76 * ((i * 0.37 + k * 0.2) % 1), p = P(x, 0, z), col = rgb(['#E0663A', '#F2B33D', '#C9405A', '#F28C3A'][(i + k) % 4]);
          pb.sph(p[0], 0.33, p[2], 0.11, 0.08, 0.11, col, { seg: 6, rings: 3 }); pb.sph(p[0], 0.25, p[2], 0.09, 0.05, 0.09, rgb('#4E7A3C'), { seg: 5, rings: 2 }); }
        ctx.colliders.push(cbox(a, b2, z0, z1, -0.5, 0.35, 'kmbBed'));
      });
    }

    // коллайдер в рамке корпуса
    function cbox(x0, x1, z0, z1, y0, y1, id, o) { const c = P((x0 + x1) / 2, 0, (z0 + z1) / 2); return Object.assign({ type: 'box', x: c[0], z: c[2], w: x1 - x0, d: z1 - z0, ry: RY, y0, y1, id }, o || {}); }
    const COL = ctx.colliders, CAM = ctx.camExtra;
    const wallC = (x0, x1, z0, z1, y0, y1, id) => COL.push(cbox(x0, x1, z0, z1, y0, y1, id || 'kmbWall'));
    const camC = (x0, x1, z0, z1, y0, y1, id) => CAM.push(cbox(x0, x1, z0, z1, y0, y1, id || 'camKmb', { cam: true }));

    /* =====================================================================
       3. ОГРАДА, КАЛИТКА, ПИЛОН, ФОНАРИ, СКАМЬИ, СТЕНД, МОЛОДЫЕ ДЕРЕВЬЯ
       ===================================================================== */
    const ART = new K.Baker('vc'), artUV = [];   // картинки двора и тамбура (одна текстура-атлас 1024², см. paintArt)
    // квадрат картинки: точки — лево-низ, право-низ, право-верх, лево-верх (как смотреть на картинку), rect = [u0, v0, u1, v1] атласа;
    // обход — по нормали n (локальной), вершины и uv разворачиваются вместе
    const artQuad = (rect, pts, n, col) => {
      let w = pts.map(p => P(p[0], p[1], p[2])), uv = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]];
      const nw = N(n[0], n[1], n[2]), i0 = ART.n;
      if (dot(cross(sub(w[1], w[0]), sub(w[2], w[0])), nw) < 0) { w = w.reverse(); uv = uv.reverse(); }
      w.forEach((p, i) => { ART.vert(p, nw, [0, 0], col || [1, 1, 1], 0); artUV.push(uv[i]); }); ART.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
    const AR = { carpet: [0, 0, 0.25, 1], lattice: [0.25, 0.8125, 0.75, 1], poster: [0.25, 0.375, 0.5, 0.8125], emblem: [0.5, 0.5625, 0.75, 0.8125], plaque: [0.5, 0.375, 1.0, 0.53], decal: [0.75, 0.5625, 1.0, 0.8125] };
    if (!FAR) {
      // «ковёр» на дорожке (вставка 1,2 м шириной от крыльца до улицы)
      { const a = (px0 + px1) / 2 - 0.6, b2 = (px0 + px1) / 2 + 0.6, y = 0.034; artQuad(AR.carpet, [[a, y, FN], [b2, y, FN], [b2, y, PZ.z1 + 0.05], [a, y, PZ.z1 + 0.05]], [0, 1, 0]); }
      // ограда: кирпичные столбики, между ними ажурные секции (картинка с прозрачностью), по верху — полоса металла
      const fence = [], posts = [];
      { const xs = []; for (let x = -X - 1.6; x <= px0 - 0.4 + 1e-6; x += 2.55) xs.push(x); if (px0 - 0.4 - xs[xs.length - 1] > 0.4) xs.push(px0 - 0.4);
        for (let i = 0; i < xs.length - 1; i++) fence.push(['z', xs[i], xs[i + 1], FN]);
        const xr = [px1 + 0.4]; for (let x = px1 + 0.4 + 2.55; x <= X + 1.6 + 1e-6; x += 2.55) xr.push(x);
        for (let i = 0; i < xr.length - 1; i++) fence.push(['z', xr[i], xr[i + 1], FN]);
        xs.concat(xr).forEach(x => posts.push([x, FN]));
        // слева — вдоль торца к углу двора
        const zs = []; for (let z = FN; z >= 7.6 - 1e-6; z -= 2.6) zs.push(z);
        for (let i = 0; i < zs.length - 1; i++) fence.push(['x', zs[i + 1], zs[i], -X - 1.6]);
        zs.slice(1).forEach(z => posts.push([-X - 1.6, z]));
        // справа — так же, от угла у улицы к фасаду: двор читается территорией, правый газон не обрывается в поле
        const xe = xr[xr.length - 1]; for (let i = 0; i < zs.length - 1; i++) fence.push(['x', zs[i + 1], zs[i], xe]);
        zs.slice(1).forEach(z => posts.push([xe, z])); }
      posts.forEach(([x, z]) => { box(pb, x - 0.17, x + 0.17, 0, 1.15, z - 0.17, z + 0.17, BR, { cols: { py: CAP }, skip: { ny: 1 } }); box(pb, x - 0.2, x + 0.2, 1.15, 1.21, z - 0.2, z + 0.2, CAP, { skip: { ny: 1 } }); COL.push(cbox(x - 0.18, x + 0.18, z - 0.18, z + 0.18, -0.5, 1.25, 'kmbFence')); });
      fence.forEach(([ax, a, b2, c]) => {
        const lo = a + 0.17, hi = b2 - 0.17, y0 = 0.12, y1 = 1.0;
        if (ax === 'z') { box(pb, lo, hi, 0, y0, c - 0.07, c + 0.07, STONE, { skip: { ny: 1 } }); box(pb, lo, hi, y1, y1 + 0.05, c - 0.03, c + 0.03, ALU); box(pb, lo, hi, y0, y0 + 0.04, c - 0.02, c + 0.02, ALU);
          artQuad(AR.lattice, [[lo, y0 + 0.04, c], [hi, y0 + 0.04, c], [hi, y1, c], [lo, y1, c]], [0, 0, 1], ALUl); COL.push(cbox(lo, hi, c - 0.08, c + 0.08, -0.5, 1.1, 'kmbFence')); }
        else { box(pb, c - 0.07, c + 0.07, 0, y0, lo, hi, STONE, { skip: { ny: 1 } }); box(pb, c - 0.03, c + 0.03, y1, y1 + 0.05, lo, hi, ALU); box(pb, c - 0.02, c + 0.02, y0, y0 + 0.04, lo, hi, ALU);
          artQuad(AR.lattice, [[c, y0 + 0.04, lo], [c, y0 + 0.04, hi], [c, y1, hi], [c, y1, lo]], [1, 0, 0], ALUl); COL.push(cbox(c - 0.08, c + 0.08, lo, hi, -0.5, 1.1, 'kmbFence')); }
      });
      // пилон у калитки (слева от дорожки): камень, синяя вставка с эмблемой и табличка с названием
      { const x = px0 - 1.25, z = FN + 0.1, w = 0.9, d = 0.32, h = 2.3;
        box(pb, x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2, STONE, { cols: { py: CAP } });
        artQuad(AR.emblem, [[x - 0.36, h - 0.86, z + d / 2 + 0.006], [x + 0.36, h - 0.86, z + d / 2 + 0.006], [x + 0.36, h - 0.14, z + d / 2 + 0.006], [x - 0.36, h - 0.14, z + d / 2 + 0.006]], [0, 0, 1]);
        artQuad(AR.plaque, [[x - 0.42, 0.95, z + d / 2 + 0.006], [x + 0.42, 0.95, z + d / 2 + 0.006], [x + 0.42, 1.21, z + d / 2 + 0.006], [x - 0.42, 1.21, z + d / 2 + 0.006]], [0, 0, 1]);
        artQuad(AR.emblem, [[x + 0.36, h - 0.86, z - d / 2 - 0.006], [x - 0.36, h - 0.86, z - d / 2 - 0.006], [x - 0.36, h - 0.14, z - d / 2 - 0.006], [x + 0.36, h - 0.14, z - d / 2 - 0.006]], [0, 0, -1]);
        COL.push(cbox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, -0.5, h + 0.1, 'kmbPylon')); CAM.push(cbox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0, h, 'camKmbPylon', { cam: true }));
        out.places.pylon = P(x, 0, z + 1.2); }
      // эмблема на стекле над дверью тамбура (матовая плёнка)
      { const z = TB.z1 - 0.15 + 0.015, x = (OP.auto.x0 + OP.auto.x1) / 2; artQuad(AR.decal, [[x - 0.3, FL + OP.auto.h + 0.16, z], [x + 0.3, FL + OP.auto.h + 0.16, z], [x + 0.3, FL + OP.auto.h + 0.76, z], [x - 0.3, FL + OP.auto.h + 0.76, z]], [0, 0, 1]); }
      // фонари вдоль дорожки и у площадки: тёмный столбик, плоский светильник (ночью тёплый, ореол — DayNight)
      [[px0 - 0.55, 12.6], [px1 + 0.55, 12.6], [px0 - 0.55, 15.4], [px1 + 0.55, 15.4], [-8.0, 9.2], [11.0, 9.2]].forEach(([x, z]) => {
        const p = P(x, 0, z); pb.cyl(p[0], 0, p[2], 0.07, 0.055, 3.2, { seg: 8, col: ALU }); pb.cyl(p[0], 0, p[2], 0.14, 0.14, 0.12, { seg: 8, col: ALU });
        pb.cyl(p[0], 3.2, p[2], 0.26, 0.2, 0.1, { seg: 10, col: ALU }); ctx.lantB.cyl(p[0], 3.13, p[2], 0.2, 0.2, 0.07, { seg: 10, col: rgb('#FFE7B8') });
        ctx.NIGHT.lamps.push([p[0], 3.1, p[2]]); COL.push({ type: 'circle', x: p[0], z: p[2], r: 0.12, y0: -0.5, y1: 3.3, id: 'kmbLamp' }); });
      // подсветка фасада: светильники в мощении у цоколя (ночью теплеют)
      [-11.5, -7.0, -2.0, 8.0, 12.0].forEach(x => { const p = P(x, 0.03, Z + 0.45); ctx.lantB.cyl(p[0], 0.026, p[2], 0.09, 0.09, 0.012, { seg: 8, col: rgb('#FFF0D0') }); });
      // скамьи у дорожки (дерево на тёмных ножках) и лицом к фасаду на левом газоне — «посмотреть на комбинат»
      const bench = (x, z, ry, id) => { const BF = new K.Frame(...P(x, 0, z), RY + ry);
        pb.box(BF, 0, 0.44, 0, 1.6, 0.06, 0.44, { col: WOOD }); pb.box(BF, 0, 0.72, -0.2, 1.6, 0.26, 0.05, { col: mul(WOOD, 0.95) });
        [-0.65, 0.65].forEach(dx => { pb.box(BF, dx, 0.21, 0, 0.06, 0.42, 0.4, { col: ALU }); pb.box(BF, dx, 0.6, -0.2, 0.05, 0.36, 0.05, { col: ALU }); });
        const c = BF.p(0, 0, 0); COL.push({ type: 'box', x: c[0], z: c[2], w: 1.6, d: 0.48, ry: RY + ry, y0: -0.5, y1: 0.5, id: 'bench' });
        return { F: BF, seat: BF.p(0, 0.47, 0.02), stand: BF.p(0, 0, 0.62), ry: RY + ry }; };   // ry — куда смотрит сидящая (+z скамьи)
      out.benches = [bench(px0 - 0.95, 13.9, -PI / 2, 'b1'), bench(px1 + 0.95, 13.9, PI / 2, 'b2'), bench(-4.0, 14.6, PI, 'front')];
      // стенд-витрина выставки на левом газоне (как баннер фестиваля на фото, только постоянный): две стойки, рама, плакат
      { const x0 = -11.6, x1 = -8.4, z = 14.4, y0 = 0.55, y1 = 2.15;
        [x0, x1].forEach(x => { box(pb, x - 0.05, x + 0.05, 0, y1 + 0.12, z - 0.05, z + 0.05, ALU); box(pb, x - 0.18, x + 0.18, 0, 0.06, z - 0.25, z + 0.25, ALU); });
        box(pb, x0, x1, y0 - 0.06, y0, z - 0.04, z + 0.04, ALU); box(pb, x0, x1, y1, y1 + 0.06, z - 0.04, z + 0.04, ALU); box(pb, x0, x1, y0, y1, z - 0.03, z - 0.01, [0.9, 0.9, 0.88]);
        artQuad(AR.poster, [[x0 + 0.06, y0 + 0.04, z + 0.012], [x1 - 0.06, y0 + 0.04, z + 0.012], [x1 - 0.06, y1 - 0.04, z + 0.012], [x0 + 0.06, y1 - 0.04, z + 0.012]], [0, 0, 1]);
        artQuad(AR.poster, [[x1 - 0.06, y0 + 0.04, z - 0.032], [x0 + 0.06, y0 + 0.04, z - 0.032], [x0 + 0.06, y1 - 0.04, z - 0.032], [x1 - 0.06, y1 - 0.04, z - 0.032]], [0, 0, -1]);   // и на обороте — к фасаду и скамьям (была пустая серая доска)
        COL.push(cbox(x0 - 0.18, x1 + 0.18, z - 0.25, z + 0.25, -0.5, y1 + 0.2, 'kmbStand')); CAM.push(cbox(x0, x1, z - 0.06, z + 0.06, y0, y1 + 0.06, 'camKmbStand', { cam: true }));
        out.places.stand = P(x1 + 0.5, 0, z + 1.0); }   // место — сбоку от плаката (справа, если смотреть с улицы): вид места не загорожен ею
      // молодые деревья справа (как на фото) — с подпорками; через общий посев села (стволы, кроны, коллайдеры)
      // крона — на штамбе (низ ≥ 2 м): на высоте головы героиня уходила в крону, а камера вставала за неё
      if (ctx.addTree) [[9.6, 12.4, 0.62], [12.6, 14.6, 0.7], [12.7, 10.9, 0.55], [-13.9, 11.0, 0.6]].forEach(([x, z, s]) => {
        const p = P(x, 0, z), rec = ctx.addTree(p[0], p[2], s, 'round', 0, false, true);
        if (rec && rec.crown) { const up = Math.max(0, 2.05 - (rec.crown.p[1] - rec.y - rec.crown.s[1])); rec.crown.p[1] += up; if (rec.items[0] && rec.items[0] !== rec.crown) rec.items[0].s[1] += up;
          rec.cols.forEach(c => { if (c.id === 'crown') { c.y0 += up; c.y1 += up; } }); }
        [[0.32, 0], [-0.16, 0.28], [-0.16, -0.28]].forEach(([dx, dz]) => { const q = P(x + dx, 0, z + dz); pb.cyl(q[0], 0, q[2], 0.025, 0.025, 1.3, { seg: 4, col: rgb('#B08A5E') }); });
        const q = P(x, 0, z); pb.cyl(q[0], 0.012, q[2], 0.55, 0.55, 0.02, { seg: 10, col: WIN ? rgb('#F2F4F6') : rgb('#7A5A42') }); });
    }
    if (ctx.HB) ctx.HB.push({ x: KB.x, z: KB.z, w: PLAN.W, d: PLAN.D, ry: RY, top: PARA + 1.0 }, Object.assign({ top: TB.top }, (() => { const c = P((TB.x0 + TB.x1) / 2, 0, (TB.z0 + TB.z1) / 2); return { x: c[0], z: c[2], w: TB.x1 - TB.x0, d: TB.z1 - TB.z0, ry: RY }; })()));

    /* =====================================================================
       4. ВНУТРИ: стены (внутренние грани наружных стен и обе — перегородок), проёмы, потолки, окна залов (стёкла, рамы)
       ===================================================================== */
    const ib = new K.Baker('vc'), glowI = new K.Baker('vc'), cards = new K.Baker('vc');
    const WH = [0.93, 0.92, 0.89], CEIL = [0.95, 0.95, 0.93], FLOOR = [0.62, 0.6, 0.57], REV = mul(WH, 0.97);
    if (!FAR) {
      const Mr = R0.M, Wk = R0.Wk, C = R0.C, L = R0.L, ZI = Z - FW, XI = X - FW, y0 = FL, y1 = HC;
      const bwH = bw.xs.map(x => [x - bw.w / 2, x + bw.w / 2, FL + bw.sill, FL + bw.head]);
      // задняя стена изнутри (музей, цех), торцы музея, цеха и коридора
      wallH(ib, 'z', -ZI, 1, Mr.x0, Mr.x1, y0, y1, bwH.filter(h => h[1] < 0), WH, 0); wallH(ib, 'z', -ZI, 1, Wk.x0, Wk.x1, y0, y1, bwH.filter(h => h[0] > 0), WH, 0);
      fX(ib, Mr.z0, Mr.z1, y0, y1, -XI, 1, WH); fX(ib, C.z0, C.z1, y0, y1, -XI, 1, WH); fX(ib, Wk.z0, Wk.z1, y0, y1, XI, -1, WH); fX(ib, C.z0, C.z1, y0, y1, XI, -1, WH);
      // перегородка коридор/зады (z −0,55…−0,40) с проёмами в музей и цех
      const om = OP.museum, ow = OP.work, ol = OP.lobby, ov = OP.vest;
      const hm = [om.x0, om.x1, FL, FL + om.h], hw = [ow.x0, ow.x1, FL, FL + ow.h], hl = [ol.x0, ol.x1, FL, FL + ol.h], hv = [ov.x0, ov.x1, FL, FL + ov.h];
      wallH(ib, 'z', om.z0, -1, Mr.x0, Mr.x1, y0, y1, [hm], WH, 0); wallH(ib, 'z', om.z0, -1, Wk.x0, Wk.x1, y0, y1, [hw], WH, 0);
      wallH(ib, 'z', om.z1, 1, C.x0, C.x1, y0, y1, [hm, hw], WH, 0);
      fZ(ib, Mr.x1, Wk.x0, y0, y1, om.z0, -1, WH);   // торец перегородки музей/цех в коридор не выходит — её конец закрыт гранью
      reveal(ib, 'z', om.z1, 1, hm, om.z1 - om.z0, REV, 0, { noSill: true }); reveal(ib, 'z', om.z1, 1, hw, om.z1 - om.z0, REV, 0, { noSill: true });
      // перегородка музей/цех (x −0,15…0)
      fX(ib, Mr.z0, Mr.z1, y0, y1, Mr.x1, -1, WH); fX(ib, Wk.z0, Wk.z1, y0, y1, Wk.x0, 1, WH);
      // перегородка коридор/кабинеты (z 2,00…2,15) с проёмом в вестибюль; боковые стенки вестибюля; стена на тамбур
      wallH(ib, 'z', ol.z0, -1, C.x0, C.x1, y0, y1, [hl], WH, 0); wallH(ib, 'z', ol.z1, 1, L.x0, L.x1, y0, y1, [hl], WH, 0);
      reveal(ib, 'z', ol.z1, 1, hl, ol.z1 - ol.z0, REV, 0, { noSill: true });
      fX(ib, L.z0, L.z1, y0, y1, L.x0, 1, WH); fX(ib, L.z0, L.z1, y0, y1, L.x1, -1, WH);
      wallH(ib, 'z', ZI, -1, L.x0, L.x1, y0, y1, [hv], WH, 0);
      // потолки (FL + 3,4) и пороги в проёмах (камень, вровень с полом + 8 мм — поверх полов начинки)
      [Mr, Wk, C, L].forEach(r => fY(ib, r.x0, r.x1, r.z0, r.z1, HC, -1, CEIL));
      fY(ib, Mr.x1, Wk.x0, Mr.z0, Mr.z1, HC, -1, CEIL);
      [[om, mul(PAVEd, 0.9)], [ow, mul(PAVEd, 0.9)], [ol, PAVEd], [ov, PAVEd], [OP.auto, ALUl]].forEach(([o, c]) => fY(ib, o.x0, o.x1, o.z0, o.z1, FL + 0.008, 1, c));
      // окна залов: откосы сквозь стену (в наружной сетке — их видно и издали), подоконник внутри, рамы, стекло, «карточки»
      // откосы задних окон: до рамы — наружная штукатурка (в куске села), от рамы в зал — светлые, сеткой зала (её свет и
      // ночной тон: целиком уличные откосы изнутри были пятнистым «бетоном» днём и ярко-синими ночью)
      reveal(ib, 'z', Z, 1, [ov.x0, ov.x1, FL, FL + ov.h], FW, REV, 0, { noSill: true });
      // тамбур изнутри: фасадная стена по бокам проёма — светлый камень (кирпич с цоколем ночью — уличный, синий)
      [[R0.V.x0, ov.x0 - 0.14], [ov.x1 + 0.14, R0.V.x1]].forEach(([a, b2]) => fZ(ib, a, b2, FL, HV, Z + 0.05, 1, [0.86, 0.84, 0.8]));
      bwH.forEach(h => {
        reveal(bk, 'z', -Z, -1, h, 0.14, mul(PLAST, 0.96), S.PLASTER, { sillCol: SILL });
        reveal(ib, 'z', -Z + 0.14, -1, h, FW - 0.14, REV, 0, { sillCol: [0.97, 0.96, 0.94] });
        box(bk, h[0] - 0.06, h[1] + 0.06, h[2] - 0.06, h[2], -Z - 0.07, -Z, SILL, { skip: { ny: 1 } });   // отлив снаружи
        box(ib, h[0] - 0.05, h[1] + 0.05, h[2] - 0.03, h[2], -ZI, -ZI + 0.07, [0.97, 0.96, 0.94]);   // подоконник внутри
        const zf = -Z + 0.14, m = 0.05, cx = (h[0] + h[1]) / 2, ty = h[2] + (h[3] - h[2]) * 0.72;
        [[h[0], h[0] + m], [h[1] - m, h[1]], [cx - m / 2, cx + m / 2]].forEach(([a, b2]) => box(bk, a, b2, h[2], h[3], zf - 0.03, zf + 0.03, ALU));
        [h[2], h[3] - m, ty - m / 2].forEach(y => box(bk, h[0], h[1], y, y + m, zf - 0.03, zf + 0.03, ALU));
        q4(gl, [[h[0], h[2], zf], [h[1], h[2], zf], [h[1], h[3], zf], [h[0], h[3], zf]], [0, 0, -1], GLC, 0);
        q4(cards, [[h[0], h[2], zf + 0.06], [h[1], h[2], zf + 0.06], [h[1], h[3], zf + 0.06], [h[0], h[3], zf + 0.06]], [0, 0, -1], rgb('#3E3A36'), 0);
      });
      // «карточки» тамбура и проёма в вестибюль (издали зал спрятан — за стеклом и в проёме не должно быть сквозного вида)
      const cw = rgb('#3E3A36');
      q4(cards, [[ov.x0, FL, Z + 0.02], [ov.x1, FL, Z + 0.02], [ov.x1, FL + ov.h, Z + 0.02], [ov.x0, FL + ov.h, Z + 0.02]], [0, 0, 1], cw, 0);
      // запасной вид без начинки: пол-плита (в залах её закрывают полы начинки)
      out.floorFallback = () => [Mr, Wk, C, L, R0.V].forEach(r => fY(ib, r.x0, r.x1, r.z0, r.z1, FL + 0.003, 1, FLOOR));
    }

    /* ---------- коллайдеры стен (рамка корпуса): проёмы — проходы, перемычки — для прыжка и луча камеры ---------- */
    {
      const T9 = PARA + 0.2, ov = OP.vest, oa = OP.auto, om = OP.museum, ow = OP.work, ol = OP.lobby;
      // наружные стены (зад, торцы с запасным выходом — дверь закрыта, фасад с проёмом в тамбур)
      wallC(-X, X, -Z, -Z + FW, -0.5, T9); wallC(-X, -X + FW, -Z, Z, -0.5, T9); wallC(X - FW, X, -Z, Z, -0.5, T9);
      wallC(-X, ov.x0, Z - FW, Z, -0.5, T9); wallC(ov.x1, X, Z - FW, Z, -0.5, T9); wallC(ov.x0, ov.x1, Z - FW, Z, FL + ov.h, T9, 'kmbLintel');
      // тамбур: стеклянные бока и фасад, перемычка над дверью
      wallC(TB.x0, TB.x0 + 0.3, TB.z0, TB.z1, -0.5, TB.top + 0.1, 'kmbGlass'); wallC(TB.x1 - 0.3, TB.x1, TB.z0, TB.z1, -0.5, TB.top + 0.1, 'kmbGlass');
      wallC(TB.x0, oa.x0, oa.z0, oa.z1, -0.5, TB.top + 0.1, 'kmbGlass'); wallC(oa.x1, TB.x1, oa.z0, oa.z1, -0.5, TB.top + 0.1, 'kmbGlass'); wallC(oa.x0, oa.x1, oa.z0, oa.z1, FL + oa.h, TB.top + 0.1, 'kmbLintel');
      // перегородки
      wallC(-X, om.x0, om.z0, om.z1, -0.5, T9); wallC(om.x1, ow.x0, om.z0, om.z1, -0.5, T9); wallC(ow.x1, X, om.z0, om.z1, -0.5, T9);
      wallC(om.x0, om.x1, om.z0, om.z1, FL + om.h, T9, 'kmbLintel'); wallC(ow.x0, ow.x1, ow.z0, ow.z1, FL + ow.h, T9, 'kmbLintel');
      wallC(R0.M.x1, R0.Wk.x0, -Z, om.z0, -0.5, T9);
      wallC(-X, ol.x0, ol.z0, ol.z1, -0.5, T9); wallC(ol.x1, X, ol.z0, ol.z1, -0.5, T9); wallC(ol.x0, ol.x1, ol.z0, ol.z1, FL + ol.h, T9, 'kmbLintel');
      wallC(2.0, R0.L.x0, ol.z1, Z - FW, -0.5, T9); wallC(R0.L.x1, 7.0, ol.z1, Z - FW, -0.5, T9);
      // кабинеты (не заходят) — сплошными коробками: ни ходьбы, ни камеры внутри
      wallC(-X, 2.0, ol.z1, Z - FW, -0.5, T9, 'kmbOffice'); wallC(7.0, X, ol.z1, Z - FW, -0.5, T9, 'kmbOffice');
      // потолки — только для луча камеры (над залами — второй этаж до кровли; над тамбуром — плита козырька)
      camC(-X, X, -Z, Z, HC, T9 + 1.0, 'camKmbCeil'); camC(TB.x0, TB.x1, TB.z0, TB.z1 + 1.4, HV, TB.top + 0.08, 'camKmbCeil');
      camC(-pw - 0.1, pw + 0.1, Z, PN.z + 0.05, PN.y0 - 0.1, PN.y0 + PN.h + 0.1, 'camKmbPanel');
    }

    /* =====================================================================
       5. НАЧИНКА: js/village/kombinat_in.js (furnish) или запасная
       ===================================================================== */
    const sv = new K.Baker('vc'), glIn = new K.Baker('vc'), IN = { lamps: [], slots: null, spots: [], meshes: [], tris: 0 };   // glIn — стёкла начинки (витрины, колпак): свет зала, не уличный
    if (!FAR) {
      const KI = V.kombinatInterior; let res = null;
      if (KI && typeof KI.furnish === 'function') {
        try {
          res = KI.furnish({ THREE: T, K, F, FL, bakers: { ib, gl: glIn, glow: glowI, sv }, C: ctx.C, rgb, mul, mix, S, named, season: ctx.season, HI, FAR, rng: ctx.rng,
            signCanvas: typeof window.kombinatSignCanvas === 'function' ? window.kombinatSignCanvas : null });
        } catch (e) { console.warn('village: kombinat interior', e); res = null; }
      }
      if (!res) res = fallbackInterior();
      IN.tris = (res.stats && res.stats.tris) || 0;
      const toW = c => { const p = P(c.lx, 0, c.lz); const o = Object.assign({}, c, { x: p[0], z: p[2] }); delete o.lx; delete o.lz; if (o.type === 'box') o.ry = RY + (c.ry || 0); return o; };
      (res.colliders || []).forEach(c => COL.push(Object.assign(toW(c), { id: c.id || 'kmbIn' })));
      (res.cam || []).forEach(c => CAM.push(Object.assign(toW(c), { cam: true })));
      // лампы начинки — не в NIGHT.lamps: DayNight дал бы каждой ореол 1,5 м и «пятно на земле» ≈ 2,6 м, как уличному фонарю (в
      // вестибюле пять пятен выбивали пол в белый); зал ночью и так в тёплом свете (inMat), светильники — светящаяся сетка
      (res.lamps || []).forEach(l => { IN.lamps.push(P(l[0], l[1], l[2])); });
      IN.meshes = res.meshes || []; IN.slots = res.npcSlots || null; IN.spots = res.spots || []; IN.atlas = res.atlas || null; IN.stats = res.stats || null;
      if (res.fallback && out.floorFallback) out.floorFallback();
    }
    // запасная начинка (нет модуля): пол, две витрины с серебром и верстак, сова у входа в зал
    function fallbackInterior() {
      const o = { colliders: [], cam: [], lamps: [], meshes: [], npcSlots: { owl: { lx: -1.6, lz: -1.8, ry: -PI / 2, y: FL }, masters: [{ lx: 6.35, lz: -5.85, ry: 0, y: FL, role: 'engraver' }, { lx: 10.35, lz: -5.85, ry: 0, y: FL, role: 'filigree' }] }, spots: [], stats: { tris: 0 }, fallback: true };
      const n0 = ib.count();
      [[-11.5, -6.1], [-3.5, -6.1]].forEach(([x, z]) => { box(ib, x - 0.9, x + 0.9, FL, FL + 0.9, z - 0.35, z + 0.35, [0.5, 0.18, 0.24]); box(ib, x - 0.9, x + 0.9, FL + 0.9, FL + 1.9, z - 0.35, z + 0.35, [0.85, 0.9, 0.95]);
        o.colliders.push({ type: 'box', lx: x, lz: z, w: 1.8, d: 0.7, y0: -0.5, y1: FL + 1.95, id: 'kmbVitrine' });
        for (let i = 0; i < 4; i++) { const p = P(x - 0.6 + i * 0.4, 0, z); sv.cyl(p[0], FL + 0.92, p[2], 0.09, 0.05, 0.3, { seg: 8, col: [0.85, 0.87, 0.9] }); } });
      [[6.35, -5.05], [10.35, -5.05]].forEach(([x, z]) => { box(ib, x - 0.75, x + 0.75, FL + 0.83, FL + 0.88, z - 0.35, z + 0.35, WOOD); box(ib, x - 0.7, x + 0.7, FL, FL + 0.83, z - 0.3, z + 0.3, mul(WOOD, 0.7));
        o.colliders.push({ type: 'box', lx: x, lz: z, w: 1.5, d: 0.7, y0: -0.5, y1: FL + 0.95, id: 'kmbBench' }); });
      [[-6.4, -3.6], [6.4, -3.6], [0, 0.8], [4.5, 4.4], [-8, 0.8], [8, 0.8]].forEach(([x, z]) => { const p = P(x, HC - 0.02, z); glowI.cyl(p[0], p[1] - 0.01, p[2], 0.25, 0.25, 0.01, { seg: 10, col: [1, 0.96, 0.86] }); o.lamps.push([x, HC - 0.1, z]); });
      o.spots.push({ id: 'museum', lx: -3.3, lz: -1.85, r: 1.3, icon: '🏛️', label: 'Музей комбината', action: 'Посмотреть витрины' });
      o.stats.tris = ib.count() - n0;
      return o;
    }

    /* =====================================================================
       6. СЕТКИ: вывеска-панель (день/ночь), стёкла, зал (свой материал, «дневной» свет), серебро, картинки, «карточки»
       ===================================================================== */
    const M = {};
    const mkTex = (cv, o = {}) => { const t = K.tex(cv); t.anisotropy = o.aniso || 4; return t; };
    // панель фасада: kombinatSignCanvas({ kind: 'facade', named, night }) или своя светлая доска с синей рамкой
    const signMake = night => {
      let cv = null;
      try { if (typeof window.kombinatSignCanvas === 'function') cv = window.kombinatSignCanvas({ kind: 'facade', width: PN.cw, height: PN.ch, named, night }); } catch (e) { cv = null; }
      if (!cv || !cv.width) cv = fallbackPanel(night);
      return mkTex(cv, { aniso: HI ? 8 : 4 });
    };
    if (out.panel) {
      const mat = K.keep(new T.MeshBasicMaterial({ map: signMake(false) })); mat.userData.dn = 'lamp';
      const m = new T.Mesh(K.keep(new T.PlaneGeometry(out.panel.w, out.panel.h)), mat);
      m.position.set(...out.panel.p); m.rotation.y = out.panel.ry; m.name = 'kombinatPanel'; m.userData.noRay = true;
      ctx.root.add(m); M.panel = m; M.panelTex = [mat.map, null]; M.panelNight = false;
    }
    if (!FAR) {
      // зал: оболочка изнутри + начинка — свой материал (DayNight его не гасит: ночью внутри горит свет), «дневной» запечённый свет
      const mat = K.keep(K.vcMat.clone()); mat.userData.dn = 'none'; M.inMat = mat;
      const mi = ib.mesh(mat); if (mi) { mi.name = 'kombinatInside'; mi.castShadow = false; mi.receiveShadow = false; ctx.root.add(mi); if (ctx.litIndoor) ctx.litIndoor(mi); M.in = mi; }
      // куски по залам (общие вершины, свои индексы; раздел 9): снаружи рисуем зал, только если его видно сквозь проём. Треугольник —
      // в зал, если все три вершины в его прямоугольнике (±5 см); остальное (откосы проёмов, общие грани) — «прочее» в M.in
      const tmpV = new T.Vector3(), rmOf = (lx, lz) => { for (const k in R0) { const r = R0[k]; if (lx >= r.x0 - 0.05 && lx <= r.x1 + 0.05 && lz >= r.z0 - 0.05 && lz <= r.z1 + 0.05) return k; } return '_'; };
      const splitBy = (g, key) => { const ix = g.index.array, pa = g.attributes.position.array, by = {};
        for (let t = 0; t < ix.length; t += 3) { let k0 = null; for (let j = 0; j < 3; j++) { const v = ix[t + j] * 3, [lx, lz] = LOC(pa[v], pa[v + 2]), k = key(lx, lz); if (k0 === null) k0 = k; else if (k !== k0) { k0 = '_'; break; } }
          (by[k0] || (by[k0] = [])).push(ix[t], ix[t + 1], ix[t + 2]); }
        return by; };
      const partOf = (g, I, nm, mt, ray) => { const ng = new T.BufferGeometry(); ['position', 'normal', 'color', 'uv'].forEach(a => { if (g.attributes[a]) ng.setAttribute(a, g.attributes[a]); });
        ng.setIndex(I); ng.computeBoundingSphere(); K.keep(ng); const pa = g.attributes.position.array, bb = new T.Box3(); for (let i = 0; i < I.length; i++) { const v = I[i] * 3; bb.expandByPoint(tmpV.set(pa[v], pa[v + 1], pa[v + 2])); }
        const m = new T.Mesh(ng, mt); m.name = nm; m.userData.noRay = !ray; m.castShadow = false; m.receiveShadow = false; ctx.root.add(m); return { m, box: bb }; };
      M.inRooms = [];
      if (mi && mi.geometry.index) { const by = splitBy(mi.geometry, rmOf);
        Object.keys(by).forEach(k => { if (k === '_') return; const q = partOf(mi.geometry, by[k], 'kombinatInside', mat, true); q.room = k; M.inRooms.push(q); });
        mi.geometry.setIndex(by._ || []); mi.geometry.computeBoundingSphere(); }
      // стёкла: наружные (тамбур, окна залов) — как окна села (ночью — уличный тон, их видно и снаружи); стёкла начинки (витрины,
      // колпак кувшина) — при свете зала: dn 'none' и ночной тёплый тон зала (иначе ночью DayNight красил их, как улицу, в
      // сине-лиловый, и серебро за ними синело посреди тёплого зала)
      const gg = gl.build(); if (gg) { const gm = new T.Mesh(gg, K.keep(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.24, depthWrite: false }))); gm.name = 'kombinatGlass'; gm.renderOrder = 5; gm.userData.noRay = true; ctx.root.add(gm); M.glass = gm; }
      const gi = glIn.build(); if (gi) { const gmat = K.keep(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.24, depthWrite: false })); gmat.userData.dn = 'none'; const gm = new T.Mesh(gi, gmat); gm.name = 'kombinatGlassIn'; gm.renderOrder = 5; gm.userData.noRay = true; ctx.root.add(gm); M.glassIn = gm; }
      const lg = glowI.build(); if (lg) { const lm = K.keep(new T.MeshBasicMaterial({ vertexColors: true })); lm.userData.dn = 'none'; const m = new T.Mesh(lg, lm); m.name = 'kombinatLamps'; m.userData.noRay = true; ctx.root.add(m); M.lamps = m; }
      const sg = sv.build(); if (sg) { const KI = V.kombinatInterior; let smat = null; try { smat = KI && KI.silverMat ? KI.silverMat(T, { keep: K.keep }) : null; } catch (e) { smat = null; }
        if (!smat) { smat = K.keep(new T.MeshBasicMaterial({ vertexColors: true })); smat.userData.dn = 'none'; }
        // серебро — куски на общих вершинах (раздел 9): музей (≈ 4/5 всего: витрины, шкафы, этажерка, кувшин мастера) — клетками
        // по 3,1 м вдоль зала и по два ряда (у окон / у коридора), остальное — по залам (цех, вестибюль). Кусок рисуем, когда его
        // зал виден, а снаружи — только если кусок в «пирамиде» камера → окно (сквозь окно виден клин зала, не весь зал)
        const svKey = (lx, lz) => { const k = rmOf(lx, lz); if (k !== 'M') return k; const R = R0.M; return 'M' + clamp(Math.floor((lx - R.x0) / 3.15), 0, 3) + (lz < -4.4 ? 'a' : 'b'); };
        const by = splitBy(sg, svKey); M.svParts = [];
        Object.keys(by).forEach(k => { const q = partOf(sg, by[k], k[0] === 'M' && k !== '_' ? 'kombinatSilver' : 'kombinatSilver2', smat); q.room = k === '_' ? '_' : k[0] === 'M' ? 'M' : k; q.mus = q.room === 'M'; M.svParts.push(q); }); }
      IN.meshes.forEach(m => { if (!m) return; m.userData.noRay = true; ctx.root.add(m); });
      const cg = cards.build(); if (cg) { const cm = K.keep(new T.MeshBasicMaterial({ vertexColors: true })); cm.userData.dn = 'window'; const m = new T.Mesh(cg, cm); m.name = 'kombinatCards'; m.visible = false; m.userData.noRay = true; ctx.root.add(m); M.cards = m; }
      // картинки двора: «ковёр», ажурные секции ограды, плакат, эмблемы, табличка (одна текстура, прозрачность — alphaTest)
      if (ART.n) {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(ART.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(ART.N, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(artUV.flat(), 2)); g.setAttribute('color', new T.Float32BufferAttribute(ART.C, 3)); g.setIndex(ART.I); g.computeBoundingSphere(); K.keep(g);
        const at = mkTex(paintArt()); const am = K.keep(new T.MeshBasicMaterial({ map: at, vertexColors: true, alphaTest: 0.5, side: T.DoubleSide }));
        const m = new T.Mesh(g, am); m.name = 'kombinatArt'; m.userData.noRay = true; ctx.root.add(m); M.art = m; M.artTex = at;
      }
    }
    out.meshes = M;

    /* ---------- холсты: запасная панель и атлас картинок двора ---------- */
    function fallbackPanel(night) {
      const W = 1152, H = 320, [cv, c] = K.cnv(W, H), ink = '#1F3B8F';
      c.fillStyle = night ? '#FFF4DC' : '#F8F6EF'; c.fillRect(0, 0, W, H);
      c.strokeStyle = ink; c.lineWidth = 22; c.strokeRect(11, 11, W - 22, H - 22); c.lineWidth = 4; c.strokeRect(34, 34, W - 68, H - 68);
      for (let x = 60; x < W - 40; x += 44) { c.beginPath(); c.arc(x, 24, 7, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, H - 24, 7, 0, TAU); c.stroke(); }
      c.save(); c.translate(W / 2, 112); c.fillStyle = '#E9ECF5'; c.strokeStyle = ink; c.lineWidth = 3;
      for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.beginPath(); c.ellipse(0, -34, 16, 30, 0, 0, TAU); c.fill(); c.stroke(); } c.restore();
      c.fillStyle = ink; c.textAlign = 'center'; c.font = '600 46px Nunito, sans-serif'; c.fillText('ХУДОЖЕСТВЕННЫЙ КОМБИНАТ', W / 2, 238);
      return cv;
    }
    function paintArt() {
      const [cv, c] = K.cnv(1024, 1024), S4 = 1024;
      const rect = (r, fn) => { const x = r[0] * S4, y = (1 - r[3]) * S4, w = (r[2] - r[0]) * S4, h = (r[3] - r[1]) * S4; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); fn(w, h); c.restore(); };
      const blue = '#24419D', navy = '#1B2A6B', terra = '#B4583A', cream = '#F2EADA', gold = '#C9A55A';
      // «ковёр»: кремовое поле, синяя кайма, ромбы-медальоны и терракотовые розетки (отсылка к ковровой дорожке на фото)
      rect(AR.carpet, (w, h) => {
        c.fillStyle = cream; c.fillRect(0, 0, w, h); c.fillStyle = blue; c.fillRect(0, 0, 22, h); c.fillRect(w - 22, 0, 22, h); c.fillStyle = gold; c.fillRect(26, 0, 6, h); c.fillRect(w - 32, 0, 6, h);
        for (let y = 60; y < h; y += 150) { c.save(); c.translate(w / 2, y); c.fillStyle = blue; c.beginPath(); c.moveTo(0, -62); c.lineTo(70, 0); c.lineTo(0, 62); c.lineTo(-70, 0); c.closePath(); c.fill();
          c.fillStyle = cream; c.beginPath(); c.moveTo(0, -42); c.lineTo(48, 0); c.lineTo(0, 42); c.lineTo(-48, 0); c.closePath(); c.fill();
          c.fillStyle = terra; for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.beginPath(); c.ellipse(0, -14, 6, 12, 0, 0, TAU); c.fill(); } c.restore();
          c.fillStyle = terra; [[-80, 75], [80, 75]].forEach(([dx, dy]) => { c.beginPath(); c.arc(w / 2 + dx * 0.9, y + dy, 9, 0, TAU); c.fill(); }); }
      });
      // ажурная секция ограды (прозрачный фон): рамка, арки и кольца — «кубачинские» дуги
      rect(AR.lattice, (w, h) => {
        c.clearRect(0, 0, w, h); c.strokeStyle = '#FFFFFF'; c.lineWidth = 7;
        c.strokeRect(4, 4, w - 8, h - 8);
        const n = 6, sw = (w - 8) / n;
        for (let i = 0; i < n; i++) { const x = 4 + i * sw; c.beginPath(); c.moveTo(x, h - 4); c.lineTo(x, h * 0.45); c.arc(x + sw / 2, h * 0.45, sw / 2, PI, 0); c.lineTo(x + sw, h - 4); c.stroke();
          c.beginPath(); c.arc(x + sw / 2, h * 0.3, sw * 0.17, 0, TAU); c.stroke(); c.beginPath(); c.arc(x + sw / 2, h * 0.72, sw * 0.13, 0, TAU); c.stroke(); }
      });
      // плакат выставки: синяя рамка-орнамент, кувшин-силуэт, «ВЫСТАВКА МАСТЕРОВ»
      rect(AR.poster, (w, h) => {
        c.fillStyle = '#F6F2E8'; c.fillRect(0, 0, w, h); c.strokeStyle = blue; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.lineWidth = 3; c.strokeRect(22, 22, w - 44, h - 44);
        c.save(); c.translate(w / 2, h * 0.46); c.fillStyle = '#9AA3B0'; c.beginPath(); c.moveTo(-14, -120); c.lineTo(14, -120); c.lineTo(10, -88); c.bezierCurveTo(70, -60, 72, 40, 30, 82); c.lineTo(40, 100); c.lineTo(-40, 100); c.lineTo(-30, 82); c.bezierCurveTo(-72, 40, -70, -60, -10, -88); c.closePath(); c.fill();
        c.strokeStyle = navy; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, -10 + i * 28, 40 - i * 4, 8, 0, 0, TAU); c.stroke(); } c.restore();
        c.fillStyle = navy; c.textAlign = 'center'; c.font = '800 30px Nunito, sans-serif'; c.fillText('ВЫСТАВКА', w / 2, h * 0.82); c.font = '700 22px Nunito, sans-serif'; c.fillText('МАСТЕРОВ', w / 2, h * 0.82 + 30);
      });
      // эмблема на пилоне (модуль вывески, «медаль»), на стекле — матовая
      const emb = (r, style) => rect(r, (w, h) => { let ev = null; try { ev = typeof window.kombinatSignCanvas === 'function' ? window.kombinatSignCanvas({ kind: 'emblem', width: 256, height: 256, named, style }) : null; } catch (e) { ev = null; }
        if (style === 'medal') { c.fillStyle = blue; c.beginPath(); c.arc(w / 2, h / 2, w * 0.49, 0, TAU); c.fill(); c.strokeStyle = gold; c.lineWidth = 8; c.stroke(); }
        if (ev && ev.width) c.drawImage(ev, 0, 0, w, h);
        else { c.save(); c.translate(w / 2, h / 2); c.fillStyle = style === 'medal' ? '#E9ECF5' : 'rgba(240,244,248,0.95)'; for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.beginPath(); c.ellipse(0, -w * 0.2, w * 0.08, w * 0.17, 0, 0, TAU); c.fill(); } c.restore(); } });
      emb(AR.emblem, 'medal'); emb(AR.decal, 'light');
      // табличка пилона: латунная рамка, синее поле, название (шрифт игры)
      rect(AR.plaque, (w, h) => { c.fillStyle = gold; c.fillRect(0, 0, w, h); c.fillStyle = navy; c.fillRect(6, 6, w - 12, h - 12); c.fillStyle = '#F2EEE2'; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (named) { c.font = '800 44px Nunito, sans-serif'; c.fillText('Кубачинский', w / 2, h * 0.36); c.font = '700 26px Nunito, sans-serif'; c.fillText('ХУДОЖЕСТВЕННЫЙ КОМБИНАТ', w / 2, h * 0.74); }
        else { c.font = '800 36px Nunito, sans-serif'; c.fillText('ХУДОЖЕСТВЕННЫЙ', w / 2, h * 0.36); c.fillText('КОМБИНАТ', w / 2, h * 0.74); } });
      return cv;
    }

    /* =====================================================================
       7. КАМЕРА: комнаты и проёмы — «свободный объём» (точка камеры — в нём и видна с головы), зоны залов, рельс у двери
       ===================================================================== */
    const MG = 0.15;   // зазор камеры до стен и потолка
    // объём: комнаты (с зазором со всех сторон), проёмы (зазор — у косяков и перемычки; вдоль прохода — нет), крыльцо перед дверью
    const VOL = [];
    Object.keys(R0).forEach(k => { const r = R0[k]; VOL.push({ id: k, x0: r.x0 + MG, x1: r.x1 - MG, z0: r.z0 + MG, z1: r.z1 - MG, H: r.H - MG, room: k }); });
    Object.keys(OP).forEach(k => { const o = OP[k]; VOL.push({ id: 'o_' + k, x0: o.x0 + MG, x1: o.x1 - MG, z0: o.z0 - MG - 0.01, z1: o.z1 + MG + 0.01, H: FL + o.h - MG, door: k }); });
    VOL.push({ id: 'porch', x0: OP.auto.x0 - 1.6, x1: OP.auto.x1 + 1.6, z0: OP.auto.z1 - 0.02, z1: OP.auto.z1 + 6.0, H: TB.top - 0.4, out: true });
    const volAt = (lx, lz, y) => { for (let i = 0; i < VOL.length; i++) { const v = VOL[i]; if (lx >= v.x0 && lx <= v.x1 && lz >= v.z0 && lz <= v.z1 && (y === undefined || y <= v.H)) return v; } return null; };
    const OPROOM = { auto: 'V', vest: 'L', lobby: 'C', museum: 'M', work: 'Wk' };   // проём — зона комнаты, куда он ведёт
    const roomAt = (lx, lz) => { for (const k in R0) { const r = R0[k]; if (lx >= r.x0 && lx <= r.x1 && lz >= r.z0 && lz <= r.z1) return k; } for (const k in OP) { const o = OP[k]; if (lx >= o.x0 && lx <= o.x1 && lz >= o.z0 - 0.01 && lz <= o.z1 + 0.01) return OPROOM[k]; } return null; };
    const lastHead = new T.Vector3(), tA = new T.Vector3(), tB = new T.Vector3();
    // точку v — в свободный объём: потолок комнаты над ней (или её комнаты), дальше — по лучу от головы до первого выхода из объёма
    function clampVol(v, head) {
      const hd = head || lastHead;
      const [lx, lz] = LOC(v.x, v.z), vv = volAt(lx, lz), [hx, hz] = LOC(hd.x, hd.z), hv = volAt(hx, hz) || (() => { const k = roomAt(hx, hz); return k ? VOL.find(q => q.room === k) : null; })();
      const cap = vv ? vv.H : hv ? hv.H : HC - MG; if (v.y > cap) v.y = cap;
      const L = Math.hypot(v.x - hd.x, v.y - hd.y, v.z - hd.z); if (L < 1e-3) return v;
      const n = Math.max(6, Math.ceil(L / 0.08)); let ok = 0;
      for (let i = 1; i <= n; i++) { const t = i / n, x = hd.x + (v.x - hd.x) * t, y = hd.y + (v.y - hd.y) * t, z = hd.z + (v.z - hd.z) * t, [ax, az] = LOC(x, z); if (!volAt(ax, az, y)) break; ok = t; }
      if (ok < 1) { const k = Math.max(0, ok); v.set(hd.x + (v.x - hd.x) * k, hd.y + (v.y - hd.y) * k, hd.z + (v.z - hd.z) * k); }
      return v;
    }
    // тесно (камера ближе 1,3 м по горизонтали или круче 45°): точка вокруг неё — через плечо, сбоку, наискосок (порт кофейни)
    const ALT = [0, 0.6, -0.6, 1.1, -1.1, 1.6, -1.6, 2.1, -2.1, 2.6, -2.6, PI], altP = new T.Vector3(), altB = new T.Vector3(), altB2 = new T.Vector3();
    let altPrev = null;
    const camFix = (look, want, yaw, ray, fresh) => {
      if (fresh) altPrev = null;
      const hd0 = Math.hypot(want.x - look.x, want.z - look.z), steep = want.y - look.y > hd0;
      if (hd0 >= (altPrev === null ? 1.3 : 1.7) && !steep) { altPrev = null; return 0; }
      let best = null, bs = -1e9;
      for (const dy of ALT) for (const D of [2.6, 2.0, 1.6]) {
        const b = yaw + dy; altP.set(look.x - Math.sin(b) * D, look.y + 0.85, look.z - Math.cos(b) * D); clampVol(altP, look);
        const hdC = Math.hypot(altP.x - look.x, altP.z - look.z); if (hdC < 1.4) continue;
        if (ray && ray(look, altP) < 1) continue;
        altB2.set(look.x + (look.x - altP.x) / hdC * 6, look.y, look.z + (look.z - altP.z) / hdC * 6); const deep = ray ? 6 * ray(look, altB2) : 6;
        const sc = Math.min(hdC, 2.6) - 0.55 * Math.abs(dy) + 0.18 * Math.min(deep, 6) + (altPrev !== null && Math.abs(dy - altPrev) < 1e-6 ? 0.6 : 0);
        if (sc > bs) { bs = sc; best = dy; altB.copy(altP); }
        break;
      }
      if (best === null) { altPrev = null; return 0; }
      altPrev = best; want.copy(altB); return best || 1e-6;
    };
    // зоны залов: ближе и ниже, кадр чуть шире, вбок — немного; clamp(v, голова?) — в свободный объём; fix — «тесно»
    const zone = (H, o) => Object.assign({ dist: 3.3, hgt: 2.25, fov: 5, swing: 0.6, run: false, peek: 2.4, peekTop: H - 0.32, clamp: (v, head) => clampVol(v, head), fix: camFix, kombinat: true }, o || {});
    const ZONES = { V: zone(HV, { dist: 3.0, hgt: 2.1 }), L: zone(HC), C: zone(HC, { dist: 3.4, run: true }), M: zone(HC, { dist: 3.6 }), Wk: zone(HC, { dist: 3.4 }) };   // по коридору (25 м) можно бежать
    out.camZone = (x, z, y) => {
      if (y !== undefined && y > 2) return null;
      const [lx, lz] = LOC(x, z), k = roomAt(lx, lz); if (!k) return null;
      lastHead.set(x, (y || FL) + 1.35, z);
      return ZONES[k];
    };
    // вход с крыльца: камера «на рельсе» сквозь проём автоматической двери (порт кофейни: дверь в той же ориентации — снаружи +z)
    const DO = OP.auto, dc = (DO.x0 + DO.x1) / 2, dhw = (DO.x1 - DO.x0) / 2, zo = DO.z1, zi = DO.z0, dTop = FL + DO.h;
    out.camRail = (x, z, y, yaw) => {
      if (y !== undefined && y > 1.2) return null;
      const [lx, lz] = LOC(x, z), flz = Math.cos(yaw - RY);
      const lat = Math.abs(lx - dc), wo = sst(zi - 0.2, zo + 0.8, lz), latK = sst(dhw + 0.02 + 1.48 * wo, dhw - 0.2 + 0.7 * wo, lat);
      // тамбур короткий (2,7 м) и проём в вестибюль — на той же оси: рельс держит камеру позади неё на крыльце (в створе двери),
      // пока она не дойдёт до проёма в вестибюль; дальше — зона вестибюля (камера следом сквозь дверь и тамбур)
      const k = sst(-0.35, -0.75, flz) * latK * sst(zo + 3.6, zo + 1.5, lz) * sst(OP.vest.z1 + 0.2, OP.vest.z1 + 1.2, lz);
      if (k < 1e-3) return null;
      const y0 = y || 0, dr = 2.3 + 0.3 * sst(zo + 0.5, zo + 2.0, lz), cz = lz + dr;
      const band = Math.abs(cz - (zi + zo) / 2), hwB = dhw - 0.28 + Math.max(0, band - 0.3) * 1.0;
      let cx = clamp(lx + (dc - lx) * 0.6 + 0.3, dc - hwB, dc + hwB); if (cz < zi) cx = clamp(cx, R0.V.x0 + 0.25, R0.V.x1 - 0.25);
      let cy = y0 + 1.8; if (band < 0.6) cy = Math.min(cy, dTop - 0.3);
      const ax = lx + 0.3, az = lz - 2.6, p = WLD(cx, cz), q = WLD(ax, az);
      return { k, fov: 14, pos: [p[0], cy, p[1]], look: [q[0], y0 + 1.0, q[1]], kombinat: true };
    };
    // смешать с рельсом — по кругу вокруг неё (пеленг, расстояние, высота); обе точки внутри — дуга тоже внутри
    const blend0 = new T.Vector3();
    out.camBlend = (want, look, p, k, ray) => {
      if (p && p.isVector3) p = [p.x, p.y, p.z];   // точка рельса — массивом (как в regions.js) или вектором (порт камеры в тестах)
      if (!p || !(k > 0)) return want;
      blend0.copy(want); const ha = Math.atan2(want.x - look.x, want.z - look.z), hb = Math.atan2(p[0] - look.x, p[2] - look.z);
      let dh = hb - ha; while (dh > PI) dh -= TAU; while (dh < -PI) dh += TAU;
      const da = Math.hypot(want.x - look.x, want.z - look.z), db = Math.hypot(p[0] - look.x, p[2] - look.z), h2 = ha + dh * k, d2 = da + (db - da) * k;
      want.set(look.x + Math.sin(h2) * d2, want.y + (p[1] - want.y) * k, look.z + Math.cos(h2) * d2);
      const [, lzA] = LOC(blend0.x, blend0.z), [, lzB] = LOC(p[0], p[2]); if (lzA < zi - 0.1 && lzB < zi - 0.1) clampVol(want, look);
      if (ray && ray(look, want) < 1) { want.copy(blend0).lerp(altP.set(p[0], p[1], p[2]), k); if (ray(look, want) < 1) { if (k > 0.5) want.copy(altP); else want.copy(blend0); } }
      // у стеклянного фасада тамбура, но не в створе двери — на 0,45 м от стекла (в тамбур или на крыльцо — где героиня):
      // дуга между точками зоны и рельса прижимала камеру к стеклу и стойкам
      { const [bx, bz] = LOC(want.x, want.z); if (bz > zi - 0.45 && bz < zo + 0.45 && Math.abs(bx - dc) > dhw - 0.25 && bx > TB.x0 - 0.3 && bx < TB.x1 + 0.3) {
        const [, lzL] = LOC(look.x, look.z), w2 = WLD(bx, lzL < (zi + zo) / 2 ? zi - 0.45 : zo + 0.45); want.x = w2[0]; want.z = w2[1]; } }
      return want;
    };
    // камера внутри здания (для тёплого света жителей, снега, бюджета): в комнатах и проёмах 1-го этажа
    out.inside = p => { if (!p || p.y > HC + 0.3) return false; const [lx, lz] = LOC(p.x, p.z); return !!roomAt(lx, lz); };
    out.inRect = (x, z, pad = 0) => { const [lx, lz] = LOC(x, z); return Math.abs(lx) <= X + pad && lz >= -Z - pad && lz <= Math.max(Z, TB.z1) + pad; };
    out.local = LOC; out.world = WLD;

    /* =====================================================================
       8. ЖИТЕЛИ, МЕСТА, ВИДЫ
       ===================================================================== */
    // мастера цеха (сидят за верстаками лицом в цех): енот-гравёр — маска, хвост в кольцах, лупа на лбу, штихель; барашек-
    // чеканщик — кудрявая шерсть, рожки-завитки, молоточек. Оба в рабочих фартуках (без нацкостюмов)
    function makeRaccoon() {
      return K.npc('kmb_raccoon', ({ n, body, P: Pp, face, M: Mm, GEO, capG }) => {
        const g = Mm('#8F8E96'), gd = Mm('#4C4A52'), w = Mm('#EEEAE4'), ap = Mm('#4F6E9A'), mt = Mm('#C9CDD2'), wd = Mm('#7A5A40'), brass = Mm('#C9A55A');
        Pp(body, GEO.sph, g, [0, 0.38, 0], [0.27, 0.27, 0.24]); Pp(body, GEO.sph, w, [0, 0.36, 0.13], [0.15, 0.17, 0.1], null, false);
        Pp(body, GEO.box, ap, [0, 0.32, 0.21], [0.33, 0.34, 0.04], [0.12, 0, 0], false); Pp(body, GEO.box, ap, [0, 0.52, 0.21], [0.2, 0.08, 0.03], [0.1, 0, 0], false);
        [-1, 1].forEach(sd => { Pp(body, GEO.sph, gd, [sd * 0.12, 0.12, 0.16], [0.08, 0.06, 0.12]); Pp(body, capG(0.05, 0.12), g, [sd * 0.21, 0.46, 0.13], null, [1.0, 0, sd * 0.35]); });
        const tail = new T.Group(); tail.position.set(0, 0.2, -0.2); body.add(tail); n.tail = tail;
        for (let i = 0; i < 4; i++) Pp(tail, GEO.sph, i % 2 ? gd : g, [0, 0.03 * i, -0.08 - 0.075 * i], [0.085 - 0.008 * i, 0.085 - 0.008 * i, 0.06], null, i === 0);
        const head = new T.Group(); head.position.set(0, 0.82, 0.03); body.add(head); n.head = head;
        Pp(head, GEO.sph, g, [0, 0, 0], [0.23, 0.2, 0.21]); Pp(head, GEO.sph, w, [0, -0.07, 0.13], [0.11, 0.08, 0.09], null, false);
        face(head, { mask: '#3A383F', white: true, er: 30, nose: '#2E2A3B', mouth: 'smile', ey: 345 }, [0.23, 0.2, 0.21]);
        [-1, 1].forEach(sd => { Pp(head, GEO.cone, g, [sd * 0.14, 0.17, -0.03], [0.06, 0.1, 0.04], [0, 0, -sd * 0.35]); Pp(head, GEO.cone, w, [sd * 0.145, 0.2, -0.01], [0.03, 0.05, 0.02], [0, 0, -sd * 0.35], false); });
        Pp(head, GEO.cyl, brass, [0.08, 0.16, 0.12], [0.05, 0.03, 0.05], [1.1, 0, 0], false); Pp(head, GEO.box, gd, [0, 0.12, 0.02], [0.4, 0.02, 0.3], null, false);   // лупа на лбу и ремешок
        const tool = new T.Group(); tool.position.set(0.22, 0.52, 0.26); body.add(tool); n.tool = tool;
        Pp(tool, GEO.cyl, wd, [0, 0.05, 0], [0.018, 0.1, 0.018], null, false); Pp(tool, GEO.cyl, mt, [0, 0.14, 0.01], [0.006, 0.09, 0.006], null, false);   // штихель
        n.extra = t => { tool.rotation.x = -0.6 + Math.pow(Math.max(0, Math.sin(t * 2.2 + n.ph)), 2) * 0.35; };
      });
    }
    function makeRam() {
      return K.npc('kmb_ram', ({ n, body, P: Pp, face, M: Mm, GEO }) => {
        const wl = Mm('#F2ECE0'), wl2 = Mm('#E6DDCB'), fc = Mm('#6E5A4E'), hn = Mm('#C9AE86'), ap = Mm('#8A5A3E'), mt = Mm('#B9BDC2'), wd = Mm('#7A5A40');
        Pp(body, GEO.sph, wl, [0, 0.38, 0], [0.28, 0.28, 0.25]);
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; Pp(body, GEO.sph, i % 2 ? wl : wl2, [Math.sin(a) * 0.2, 0.42 + 0.12 * Math.cos(a * 2), Math.cos(a) * 0.17], [0.11, 0.1, 0.1], null, false); }   // кудри
        Pp(body, GEO.box, ap, [0, 0.32, 0.22], [0.34, 0.36, 0.04], [0.12, 0, 0], false);
        [-1, 1].forEach(sd => { Pp(body, GEO.sph, fc, [sd * 0.12, 0.1, 0.15], [0.065, 0.06, 0.1]); Pp(body, GEO.sph, wl2, [sd * 0.22, 0.44, 0.12], [0.07, 0.12, 0.07], [0.8, 0, sd * 0.35]); });
        const head = new T.Group(); head.position.set(0, 0.8, 0.05); body.add(head); n.head = head;
        Pp(head, GEO.sph, fc, [0, 0, 0], [0.18, 0.2, 0.19]);   // центр — как у наклейки лица (FACEG r 1,012): со сдвигом вперёд сфера закрывала глаза и рот
        for (let i = 0; i < 5; i++) Pp(head, GEO.sph, wl, [(i - 2) * 0.07, 0.17 - Math.abs(i - 2) * 0.02, -0.02], [0.08, 0.07, 0.08], null, false);   // чёлка
        face(head, { white: true, er: 30, ex: 84, nose: '#3A2E2A', noseW: 14, noseH: 9, mouth: 'w', ey: 350, noBlush: false }, [0.18, 0.2, 0.19]);
        [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 1.3; Pp(head, GEO.sph, hn, [sd * (0.17 + Math.sin(a) * 0.07), 0.06 + Math.cos(a) * 0.07, -0.04 - i * 0.012], [0.045, 0.045, 0.045], null, i === 0); }   // рожки-завитки
          Pp(head, GEO.sph, fc, [sd * 0.2, -0.02, 0.0], [0.07, 0.03, 0.05], [0, 0, -sd * 0.4]); });   // ушки
        const tool = new T.Group(); tool.position.set(0.23, 0.52, 0.25); body.add(tool); n.tool = tool;
        Pp(tool, GEO.cyl, wd, [0, 0.07, 0], [0.015, 0.14, 0.015], null, false); Pp(tool, GEO.box, mt, [0, 0.15, 0.02], [0.05, 0.045, 0.09], null, false);   // молоточек чеканщика
        n.extra = t => { tool.rotation.x = -0.4 + Math.pow(Math.max(0, Math.sin(t * 4.6 + n.ph)), 3) * 0.8; };
      });
    }
    if (!FAR && ctx.placeNpc) {
      const SL = IN.slots || {}, ow = SL.owl || { lx: -1.6, lz: -1.8, ry: -PI / 2, y: FL };
      { const p = P(ow.lx, 0, ow.lz); const n = ctx.placeNpc('owl_keeper', p[0], p[2], RY + (ow.ry || 0), { y: ow.y !== undefined ? ow.y : FL, headY: 1.1, talkR: 2.3 }); n.kombinat = true; n.indoor = true; n.kmbRoom = 'M'; out.owl = n; }
      const MK = [['kmb_raccoon', makeRaccoon, 'Енот-гравёр'], ['kmb_ram', makeRam, 'Барашек-чеканщик']];
      // енот — за верстаком, на который смотрит место «Цех мастеров» (kmb_work: вид и лист про гравировку — его), барашек — за
      // ближайшим к нему; третий верстак — свободный (мастер отошёл)
      const wk = IN.spots.find(s => s.id === 'kmb_work'), md = s => (wk ? Math.hypot(s.lx - wk.lx, s.lz - wk.lz) : 0);
      (SL.masters || []).map((s, i) => [s, i]).sort((a, b) => md(a[0]) - md(b[0]) || a[1] - b[1]).map(q => q[0]).slice(0, 2).forEach((s, i) => { const [id, make, nm] = MK[i]; const p = P(s.lx, 0, s.lz);
        const n = ctx.placeNpc(id, p[0], p[2], RY + (s.ry || 0), { make, y: s.y !== undefined ? s.y : FL, headY: s.seat ? 0.95 : 1.15, talkR: 2.2, name: nm, scale: 1.12, seatYaw: s.seat ? 0.55 : 0 }); n.kombinat = true; n.indoor = true; n.kmbRoom = 'Wk'; n.role = i ? 'chasing' : 'engraver'; n.bench = s.role; });   // роль — мастера (гравёр, чеканщик), bench — чей верстак по раскладке начинки
    }
    // места начинки (lx/lz — в рамке): в мир; вид места — в камеры ручки; действие — лист (тексты — VILLAGE.activities, иначе из начинки)
    const spots = [];
    if (!FAR) {
      IN.spots.forEach(s => {
        const p = P(s.lx, 0, s.lz), sp = { id: s.id, x: p[0], z: p[2], y: FL, r: s.r || 1.2, icon: s.icon || '🏛️', label: s.label || 'Комбинат', action: s.action || 'Посмотреть', kombinat: true, sheet: s.sheet || null };
        if (s.cam && s.cam.pos && s.cam.target) {
          // героиня стоит у места — часто прямо на линии камера → цель: на телефоне (узкий кадр) полэкрана тогда — её затылок.
          // Ближе 0,75 м к линии — камера уходит вбок («через плечо») и чуть выше; вбок — только внутри свободного объёма зала
          let [cx, cy, cz] = s.cam.pos; const [tx, , tz] = s.cam.target, dx = tx - cx, dz = tz - cz, Lc = Math.hypot(dx, dz) || 1, ux = dx / Lc, uz = dz / Lc;
          const hx = s.lx - cx, hz = s.lz - cz, along = hx * ux + hz * uz, side = -hx * uz + hz * ux;
          if (along > 0.2 && along < Lc && Math.abs(side) < 0.75) {
            const need = 0.75 - Math.abs(side), sg0 = side >= 0 ? -1 : 1;
            for (const sg of [sg0, -sg0]) { const nx = cx - uz * need * sg, nz = cz + ux * need * sg; if (volAt(nx, nz, cy + 0.2)) { cx = nx; cz = nz; cy += 0.2; break; } }
          }
          out.views['kmb_' + s.id.replace(/^kmb_/, '')] = { pos: P(cx, cy, cz), target: P(...s.cam.target), fov: s.cam.fov || 55 }; sp.view = 'kmb_' + s.id.replace(/^kmb_/, '');
        }
        spots.push(sp);
      });
      // у фасада: скамья лицом к комбинату (сюда ведёт «Поехать сюда» с карты), стенд выставки
      const b = out.benches && out.benches[2];
      if (b) spots.push({ id: 'kmb_front', poi: 'museum', x: b.stand[0], z: b.stand[2], y: 0, r: 1.2, ry: b.ry, icon: '🪑', label: named ? 'Кубачинский художественный комбинат' : 'Художественный комбинат', action: 'Посидеть, посмотреть', seat: b.seat, kombinat: true, view: 'kmb_front' });
      if (out.places.stand) spots.push({ id: 'kmb_stand', x: out.places.stand[0], z: out.places.stand[2], y: 0, r: 1.1, icon: '🖼️', label: 'Стенд выставки', action: 'Почитать', kombinat: true, view: 'kmb_stand' });
    }
    out.spots = spots;
    // виды: фасад как на фото (с улицы, чуть снизу), двор, со скамьи; в зале — из мест начинки
    Object.assign(out.views, {
      // port — кадр для портретного экрана (aspect < 0,8): по горизонтали там ≈ 30°, панель 21 м со двора не помещается — камера
      // дальше (с улицы), в середине кадра — надпись «Кубачинский» (8,8 м) с эмблемой, героиня на скамье — внизу
      kmb_front: { pos: P(-5.3, 1.95, 17.0), target: P(1.8, 5.0, 7.0), fov: 60, port: { pos: P(-2.6, 3.4, 25.0), target: P(-0.2, 5.6, 7.3), fov: 62 } },   // со скамьи: она справа внизу, фасад и панель
      kmb_facade: { pos: P(3.0, 1.7, 26.5), target: P(1.0, 5.4, 7.0), fov: 58, port: { pos: P(2.6, 2.4, 30.5), target: P(0.6, 5.8, 7.3), fov: 62 } },   // как ref/exterior.png: с улицы, фасад целиком (port — правее дерева за улицей)
      kmb_yard: { pos: P(-13.5, 2.2, 17.8), target: P(4.5, 1.6, 9.0), fov: 56 },
      // плакат выставки почти прямо, с улицы над низкой оградой, между столбиками (aspect: на телефоне кадр не уже плаката); цель — ниже
      // и левее плаката: он в верхней трети кадра, карточка места (по середине экрана) его не закрывает
      kmb_stand: { pos: P(-10.78, 2.3, 20.2), target: P(-10.3, 0.55, 14.4), fov: 50, aspect: 1.25 },
      kmb_corridor: { pos: P(11.6, FL + 1.6, 0.8), target: P(-12.7, FL + 1.3, 0.8), fov: 60 },
      kmb_hall: { pos: P(-0.8, FL + 1.75, -1.2), target: P(-12.0, FL + 1.1, -4.6), fov: 62 },
      kmb_workshop: { pos: P(0.8, FL + 1.8, -1.0), target: P(11.0, FL + 0.9, -5.2), fov: 60 },
      kmb_air: { pos: P(-26, 30, 42), target: P(2, 3, 0), fov: 45 },
    });
    out.places = Object.assign(out.places, { x: KB.x, z: KB.z, ry: RY, w: PLAN.W, d: PLAN.D, door: P(dc, 0, zo + 1.2).concat([RY + PI]), inside: P(4.5, FL, 4.4), museum: P(-6.4, FL, -3.6), workshop: P(5.8, FL, -3.4), corridor: P(0, FL, 0.8), front: P(4.5, 0, 14.0), owl: out.owl ? [out.owl.x, out.owl.y, out.owl.z] : null });

    /* =====================================================================
       9. КАДР: зал виден вблизи (40 м) или изнутри; издали — «карточки»; вывеска ночью — «лайтбокс»; ночной тон зала
       ===================================================================== */
    // ПОРТАЛЬНОЕ ОТСЕЧЕНИЕ. Камера в залах (вестибюль, коридор, музей, цех; не в тамбуре и не в его проёме): село снаружи видно
    // только сквозь окна задней стены и проём вестибюль → тамбур (дальше — стекло тамбура). Куски села, фон, террасы, реквизит,
    // свадьба, чья сфера не попадает ни в одну «пирамиду» камера → проём, не рисуются (слой камеры = 0, как VOCC; маска
    // возвращается, как только снова видно или камера вышла). Из коридора на запад иначе в кадре всё ядро села за стенами:
    // ≈ 60 тыс. треугольников (кадр с героиней — 220 тыс. на low)
    const OCC = { list: null, hid: new Map(), PT: [], SH: [], n: 0 };
    const PORT = bw.xs.map(x => [[x - bw.w / 2, FL + bw.sill, -Z], [x + bw.w / 2, FL + bw.sill, -Z], [x + bw.w / 2, FL + bw.head, -Z], [x - bw.w / 2, FL + bw.head, -Z]])
      .concat([[[OP.vest.x0, FL, Z], [OP.vest.x1, FL, Z], [OP.vest.x1, FL + OP.vest.h, Z], [OP.vest.x0, FL + OP.vest.h, Z]]]).map(q => q.map(p => P(p[0], p[1], p[2])));
    // кандидаты — прямые дети корня села: сетки и сетки групп модулей (свадьба, отель вдали…); сфера геометрии × матрица — каждый
    // кадр (фон едет за камерой); жители (userData.key), небо и облака (r > 600) — нет
    const occSph = new T.Sphere();
    const occAt = e => { if (e.bs) { occSph.copy(e.bs).applyMatrix4(e.o.matrixWorld); e.x = occSph.center.x; e.y = occSph.center.y; e.z = occSph.center.z; e.r = occSph.radius; } return e; };
    // слой у группы не прячет её детей (рендерер обходит их всё равно) — прячем сами сетки
    const occMs = g => { const L = []; g.traverse(m => { if (m.isMesh || m.isPoints || m.isLine) L.push(m); }); return L; };
    // свой кусок корпуса (рамы и откосы окон, проём в тамбур) отдельно не держим: он стоит в самих проёмах — пирамида его ловит
    const occList = root => {
      const L = [];
      root.children.forEach(o => {
        if (/^kombinat/.test(o.name || '') || o.userData.key || !(o.isMesh || (o.isGroup && /^(wedding|hotel:distant|zipline:landing|springLid)$/.test(o.name || '')))) return;
        // группа модуля — каждой своей сеткой (у свадьбы двор, толпа и навесы — разные места; сфера всей группы — почти всё село)
        (o.isMesh ? [o] : occMs(o)).forEach(m => {
          const g = m.geometry; if (!g || !g.attributes || !g.attributes.position || m.frustumCulled === false) return; if (!g.boundingSphere) g.computeBoundingSphere(); m.updateMatrixWorld(true);
          const e = occAt({ o: m, bs: g.boundingSphere, ms: [m] }); if (e.r <= 600) L.push(e); });
      });
      return L;
    };
    // плоскости пирамиды камера → проём (4 боковые и сам проём), нормали — внутрь; сфера видна, если ни одна плоскость не отсекает её
    const occPlanes = cp => {
      OCC.PT.length = 0;
      PORT.forEach(q => {
        const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, cz = (q[0][2] + q[2][2]) / 2, pl = [];
        for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], u = sub(a, [cp.x, cp.y, cp.z]), v = sub(b, [cp.x, cp.y, cp.z]); let n = cross(u, v); const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
          let d = -dot(n, [cp.x, cp.y, cp.z]); if (dot(n, [cx, cy, cz]) + d < 0) { n = [-n[0], -n[1], -n[2]]; d = -d; } pl.push([n[0], n[1], n[2], d]); }
        { let n = cross(sub(q[1], q[0]), sub(q[3], q[0])); const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; let d = -dot(n, q[0]);
          if (dot(n, [cp.x, cp.y, cp.z]) + d > 0) { n = [-n[0], -n[1], -n[2]]; d = -d; } pl.push([n[0], n[1], n[2], d]); }   // за проёмом — «снаружи»
        OCC.PT.push(pl);
      });
    };
    const occSeen = e => { for (const pl of OCC.PT) { let ok = true; for (const p of pl) if (p[0] * e.x + p[1] * e.y + p[2] * e.z + p[3] < -e.r) { ok = false; break; } if (ok) return true; } return false; };
    // ЗА КОРПУСОМ (камера снаружи, ближе 70 м, ниже парапета). Корпус — глухой ящик 26 × 14 × 9,4 м: куски села, чья сфера целиком
    // в его «тени», не рисуются. Тень выпуклая: плоскости «камера → силуэтное ребро» (два вертикальных крайних угла, верхние и
    // нижние рёбра ближних граней) и сами ближние грани (за ними). Сзади и с торцов корпус закрывает пол-села — кадр там был на
    // 5–10 тыс. дороже базы и без нутра (база у задней стены — уже 190–200 тыс.). Что видно только сквозь окна и сквозной проём
    // цех → коридор → тамбур (щели в ладонь шириной), не рисуем — как VOCC
    const BX0 = -X - 0.05, BX1 = X + 0.05, BZ0 = -Z - 0.05, BZ1 = Z + 0.05, BY1 = PARA, BC = P(0, PARA / 2, 0);
    const shPlane = (a, b, c3) => { let n = cross(sub(b, a), sub(c3, a)); const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; let d = -dot(n, a);
      if (dot(n, BC) + d < 0) { n = [-n[0], -n[1], -n[2]]; d = -d; } OCC.SH.push([n[0], n[1], n[2], d]); };   // нормаль — внутрь тени (к середине ящика)
    const occShadow = cp => {
      OCC.SH.length = 0; const [lx, lz] = LOC(cp.x, cp.z), C3 = [cp.x, cp.y, cp.z];
      if (cp.y <= 0.05 || cp.y >= BY1 - 0.05) return false;
      const fx = lx > BX1 ? 1 : lx < BX0 ? -1 : 0, fz = lz > BZ1 ? 1 : lz < BZ0 ? -1 : 0; if (!fx && !fz) return false;
      // крайние углы по углу из камеры (камера вне прямоугольника — разброс углов < 180°)
      const cs = [[BX0, BZ0], [BX1, BZ0], [BX1, BZ1], [BX0, BZ1]], a0 = Math.atan2(-lx, -lz);
      let mn = null, mx = null, amn = 9, amx = -9;
      cs.forEach(k => { let a = Math.atan2(k[0] - lx, k[1] - lz) - a0; while (a > PI) a -= TAU; while (a < -PI) a += TAU; if (a < amn) { amn = a; mn = k; } if (a > amx) { amx = a; mx = k; } });
      [mn, mx].forEach(k => shPlane(C3, P(k[0], 0, k[1]), P(k[0], BY1, k[1])));
      // ближние грани: верхнее и нижнее рёбра, сама грань (тень — за ней)
      const faces = []; if (fx) faces.push([[fx > 0 ? BX1 : BX0, BZ0], [fx > 0 ? BX1 : BX0, BZ1]]); if (fz) faces.push([[BX0, fz > 0 ? BZ1 : BZ0], [BX1, fz > 0 ? BZ1 : BZ0]]);
      faces.forEach(([u, v]) => { shPlane(C3, P(u[0], BY1, u[1]), P(v[0], BY1, v[1])); shPlane(C3, P(u[0], 0, u[1]), P(v[0], 0, v[1])); shPlane(P(u[0], 0, u[1]), P(v[0], 0, v[1]), P(u[0], BY1, u[1])); });
      return true;
    };
    const occBehind = e => { for (const p of OCC.SH) if (p[0] * e.x + p[1] * e.y + p[2] * e.z + p[3] < e.r) return false; return OCC.SH.length > 0; };
    // корпус не сплошной: насквозь — окно задней стены → залы → вестибюль → проём в тамбур (и обратно). Что одновременно в «пирамиде»
    // камера → проём в вестибюль и камера → одно из задних окон (раздел 9, portSeen — до occUpdate: пирамиды всех проёмов), не прячем
    // насквозь — только по цепочке проёмов: вход в вестибюль, проём в коридор, дверь цеха или музея, окно этого зала (все пирамиды —
    // с вершиной в камере: их пересечение — лучи, проходящие сквозь все проёмы)
    const inPyrS = (q, e) => { for (const pl of q.pl) if (pl.distanceToPoint(tB) < -e.r) return false; return true; };
    const seeThru = e => { tB.set(e.x, e.y, e.z); if (!inPyrS(TBP, e) || !inPyrS(XP.lobby, e)) return false;
      for (const q of PORTS) if (q !== TBP && inPyrS(q.mus ? XP.museum : XP.work, e) && inPyrS(q, e)) return true; return false; };
    const occRestore = () => { OCC.hid.forEach((mask, o) => { if (o.layers.mask === 0) o.layers.mask = mask; }); OCC.hid.clear(); };
    // mode: 'in' — камера в залах (видно только сквозь проёмы), 'out' — снаружи рядом (не видно, что в тени корпуса), иначе — выкл.
    function occUpdate(cp, mode) {
      if (mode === 'out' && !occShadow(cp)) mode = null;
      if (!mode || OCC.off) { if (OCC.hid.size) occRestore(); return; }
      OCC.mode = mode;
      if (!OCC.list) OCC.list = occList(ctx.root);
      // машина героини (car.js / drive.js — 'car', седан — 'sedan') стоит в сцене, не в корне села: ≈ 27 тыс. треугольников у
      // парковки; сфера — от её корня, r 3 м (ищем раз в 2 с — её могут переставить или сменить)
      if (!(OCC.n++ % 120)) { const sc = ctx.root.parent; OCC.veh = sc ? sc.children.filter(o => /^(car|sedan)$/.test(o.name || '')).map(o => ({ o, bs: null, ms: occMs(o), r: 3.0 })) : []; }
      (OCC.veh || []).forEach(e => { e.x = e.o.position.x; e.y = e.o.position.y + 0.8; e.z = e.o.position.z; });
      if (mode === 'in') occPlanes(cp);
      OCC.list.forEach(occOne); if (OCC.veh) OCC.veh.forEach(occOne);
    }
    function occOne(e) {
      if (e.bs) occAt(e);
      const vis = e.r > 600 || (OCC.mode === 'in' ? occSeen(e) : !occBehind(e) || seeThru(e));
      for (const o of e.ms) {
        if (vis) { if (OCC.hid.has(o)) { if (o.layers.mask === 0) o.layers.mask = OCC.hid.get(o); OCC.hid.delete(o); } }
        else if (o.layers.mask !== 0) { OCC.hid.set(o, o.layers.mask); o.layers.mask = 0; }
      }
    }
    // проверки: 'off' / 'on' — отсечение; 'all' / 'auto' — нутро и жители зала всегда / по проёмам (сравнить кадры)
    out.occ = cmd => { if (cmd === 'off' || cmd === 'on') OCC.off = cmd === 'off'; if (cmd === 'all' || cmd === 'auto') OCC.all = cmd === 'all';
      return { list: OCC.list ? OCC.list.length : 0, hidden: OCC.hid.size, off: !!OCC.off, all: !!OCC.all, mode: OCC.mode || null, inVis: out.inVis }; };   // проверки: 'off' — без отсечения (сравнить кадры)

    // ЗАЛ СНАРУЖИ — только сквозь проёмы. Нутро (оболочка, начинка, лампы, стёкла витрин, картинки) и жители зала рисуются, когда
    // камера внутри или один из проёмов — окно задней стены (камера за ней) или тамбур со входом в вестибюль (камера перед
    // фасадом) — повёрнут к камере, попадает в кадр и ближе VIS_D; иначе в окнах и в проёме — «карточки». Серебро музея (≈ 4/5
    // серебра) — строже: изнутри — из музея и коридора, снаружи — сквозь окна музея ближе SV_D и не вскользь (дальше и вскользь
    // его не разобрать). Было «ближе 42 м» кругом: у глухой стены и сзади — +30 тыс. (и жители зала +14 тыс.) ни за что
    const VIS_D = 30, SV_D = 16, frus = new T.Frustum(), frM = new T.Matrix4();
    const portBox = (x0, x1, y0, y1, z0, z1) => { const b = new T.Box3(); [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => [y0, y1].forEach(y => b.expandByPoint(tA.set(...P(x, y, z))))); return b; };
    const PORTS = bw.xs.map(x => ({ box: portBox(x - bw.w / 2 - 0.1, x + bw.w / 2 + 0.1, FL + bw.sill - 0.1, FL + bw.head + 0.1, -Z - 0.1, -Z + FW + 0.1), lx: x, lz: -Z, y: FL + (bw.sill + bw.head) / 2, side: -1, mus: x < 0 }))
      .concat([{ box: portBox(TB.x0, TB.x1, 0, TB.top, Z - FW, TB.z1 + 0.1), lx: (TB.x0 + TB.x1) / 2, lz: TB.z1, y: FL + 1.4, side: 1, mus: false }]);
    PORTS.forEach(q => { q.c = P(q.lx, q.y, q.lz); });
    // пирамида «камера → проём» (снаружи): окно — прямоугольник проёма по наружной плоскости стены; тамбур — сам он по кадру, а
    // залы за ним — сквозь проём в вестибюль. Зал (кусок нутра) и кусок серебра рисуем, только если их коробка попадает хоть в одну
    // пирамиду видимого проёма: сквозь окно виден клин одного зала, а не всё нутро (у окна музея цех и вестибюль — не рисуем)
    const rectW = (x0, x1, y0, y1, lz) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => new T.Vector3(...P(x, y, lz)));
    PORTS.forEach(q => { q.rect = q.side < 0 ? rectW(q.lx - bw.w / 2, q.lx + bw.w / 2, FL + bw.sill, FL + bw.head, -Z) : rectW(OP.vest.x0, OP.vest.x1, FL, FL + OP.vest.h, Z);
      q.mid = q.rect.reduce((a, v) => a.add(v), new T.Vector3()).multiplyScalar(0.25); q.pl = [0, 1, 2, 3].map(() => new T.Plane()); q.on = q.py = q.sv = false; });
    const TBP = PORTS[PORTS.length - 1];
    // проёмы внутри (для «насквозь»): в коридор из вестибюля, двери цеха и музея — прямоугольники по середине толщины перегородок
    const XP = {}; [['lobby', OP.lobby], ['work', OP.work], ['museum', OP.museum]].forEach(([k, o]) => { const q = { rect: rectW(o.x0, o.x1, FL, FL + o.h, (o.z0 + o.z1) / 2), pl: [0, 1, 2, 3].map(() => new T.Plane()) };
      q.mid = q.rect.reduce((a, v) => a.add(v), new T.Vector3()).multiplyScalar(0.25); XP[k] = q; });
    // что видно сквозь заднее окно: музей и цех разделены глухой перегородкой (их двери — в одной стене коридора), поэтому из окна
    // музея — музей и коридор, из окна цеха — цех, коридор и (по оси двери цеха и проёма в вестибюль) вестибюль с тамбуром
    PORTS.forEach(q => { if (q !== TBP) q.rooms = new Set(q.mus ? ['M', 'C'] : ['Wk', 'C', 'L', 'V']); });
    const pyrSet = (q, cp) => { for (let i = 0; i < 4; i++) { const pl = q.pl[i]; pl.setFromCoplanarPoints(cp, q.rect[i], q.rect[(i + 1) % 4]); if (pl.distanceToPoint(q.mid) < 0) pl.negate(); } };
    const inPyr = (q, b) => { for (const pl of q.pl) { const n = pl.normal; tB.set(n.x > 0 ? b.max.x : b.min.x, n.y > 0 ? b.max.y : b.min.y, n.z > 0 ? b.max.z : b.min.z); if (pl.distanceToPoint(tB) < 0) return false; } return true; };
    const seenBy = (box, sv, room) => { for (const q of PORTS) if (q.on && q.py && (!sv || q.sv) && !(q.rooms && room !== '_' && !q.rooms.has(room)) && inPyr(q, box)) return true; return false; };
    const SEEN = { any: false, mus: false, oth: false };
    function portSeen(cam) {
      SEEN.any = SEEN.mus = SEEN.oth = false;
      cam.updateMatrixWorld(); frM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(frM);
      const cp = cam.position, [clx, clz] = LOC(cp.x, cp.z);
      for (const q of PORTS) pyrSet(q, cp); for (const k in XP) pyrSet(XP[k], cp);   // пирамиды всех проёмов (насквозь — seeThru); в залах — только видимых (q.on, q.py)
      for (const q of PORTS) {
        q.on = false;
        if (q.side < 0 ? clz > q.lz + 0.02 : clz < Z - 0.02 && !(Math.abs(clx) > X - 0.1 && clz > 0)) continue;   // проём повёрнут от камеры (тамбур выступает: его боковые стёкла видно и с торцов)
        const d = Math.hypot(cp.x - q.c[0], cp.y - q.c[1], cp.z - q.c[2]); if (d > VIS_D || !frus.intersectsBox(q.box)) continue;
        SEEN.any = true; q.on = true; const cs = Math.abs(clz - q.lz) / Math.max(d, 0.01);
        q.sv = d < SV_D && cs > 0.3; if (q.sv) { if (q.mus) SEEN.mus = true; else SEEN.oth = true; }   // не вскользь: угол с нормалью < 72°
        q.py = q.side < 0 || clz > Z + 0.02;   // сбоку от тамбура за плоскостью фасада проём в вестибюль не виден
      }
      return SEEN;
    }
    // жители зала снаружи: видны, только если луч камера → житель (голова, середина, бока) проходит сквозь проёмы: сзади — сквозь
    // окно задней стены, спереди — сквозь стекло тамбура, проём в вестибюль, проём в коридор и дверь зала (по порядку, какие
    // пересекает). Изнутри — по залу камеры (из коридора видно музей — сова у его двери — и цех; из вестибюля и тамбура — цех:
    // проёмы на одной оси, мастер за дверью)
    const winR = bw.xs.map(x => [x - bw.w / 2, x + bw.w / 2, FL + bw.sill, FL + bw.head]);
    const HOLES = [[-Z + FW / 2, winR], [TB.z1 - 0.15, [[TB.x0 + 0.06, TB.x1 - 0.06, 0.22, 3.24]]], [Z - FW / 2, [[OP.vest.x0, OP.vest.x1, FL, FL + OP.vest.h]]],
      [(OP.lobby.z0 + OP.lobby.z1) / 2, [[OP.lobby.x0, OP.lobby.x1, FL, FL + OP.lobby.h]]], [(OP.work.z0 + OP.work.z1) / 2, [[OP.work.x0, OP.work.x1, FL, FL + OP.work.h], [OP.museum.x0, OP.museum.x1, FL, FL + OP.museum.h]]]];
    const losLocal = (ax, ay, az, bx, by, bz) => {
      for (const [zc, rs] of HOLES) { if ((az - zc) * (bz - zc) >= 0) continue; const t = (zc - az) / (bz - az), x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (!rs.some(r => x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3])) return false; }
      return true;
    };
    const npcCam = new T.Vector3();
    out.npcSeen = n => {
      if (!n.kmbRoom || OCC.all) return true;
      if (camIn) return n.kmbRoom === 'M' ? out.roomVis.M : out.roomVis.Wk;
      if (!out.inVis) return false;
      const [cx, cz] = LOC(npcCam.x, npcCam.z), r = n.root.position, [nx, nz] = LOC(r.x, r.z); if (Math.hypot(cx - nx, cz - nz) > VIS_D) return false;
      for (const [dx, dy] of [[0, 1.0], [0, 0.55], [-0.25, 0.8], [0.25, 0.8]]) if (losLocal(cx, npcCam.y, cz, nx + dx, r.y + dy, nz)) return true;   // бока — ±0,25 м по x рамки
      return false;
    };
    let camIn = false, vKey = '', tint = -1;
    out.inVis = true; out.roomVis = { M: true, Wk: true };   // нутро видно; зал виден изнутри (kubachi.js: жители зала — n.kmbRoom — по npcSeen)
    out.update = (cam, nightT) => {
      if (cam) {
        const cp = cam.position; camIn = out.inside(cp);
        const [clx, clz] = LOC(cp.x, cp.z);
        // проёмы снаружи (пирамиды) — до «тени» корпуса: сквозь них двор за корпусом видно
        const sn = !camIn && !FAR ? portSeen(cam) : null; if (!sn) PORTS.forEach(q => { q.on = false; });
        // в залах — сквозь проёмы; в тамбуре (вокруг стекло) и снаружи рядом — «тень» корпуса
        occUpdate(cp, FAR ? null : camIn && cp.y < HC && clz < Z - FW - 0.05 ? 'in' : Math.hypot(cp.x - KB.x, cp.z - KB.z) < 70 ? 'out' : null);
        let vIn = camIn, vMus = false, vOth = camIn;
        // из коридора видно музей (сова — у его двери) и цех; из вестибюля и тамбура — цех: проёмы на одной оси (мастер за дверью)
        npcCam.copy(cp);
        if (camIn) { const rm = roomAt(clx, clz); vMus = rm === 'M' || rm === 'C'; out.roomVis.M = vMus; out.roomVis.Wk = rm !== 'M'; }
        else if (sn) { vIn = sn.any; vMus = sn.mus; vOth = sn.oth; }
        const all = !!OCC.all; if (all) vIn = vMus = vOth = true;
        const key = (vIn ? 1 : 0) + (vMus ? 2 : 0) + (vOth ? 4 : 0);
        if (key !== vKey) { vKey = key; out.inVis = vIn;
          [M.in, M.lamps, M.glassIn].concat(IN.meshes).forEach(m => { if (m) m.visible = vIn; }); if (M.cards) M.cards.visible = !vIn; }
        // залы и серебро: изнутри — весь зал (серебро музея — из музея и коридора, остальное — всегда); снаружи — по пирамидам
        // проёмов (серебро — ещё и ближе SV_D, не вскользь)
        const outP = vIn && !camIn && !all;
        (M.inRooms || []).forEach(q => { q.m.visible = vIn && (!outP || (q.room === 'V' && TBP.on || seenBy(q.box, false, q.room))); });
        (M.svParts || []).forEach(q => { q.m.visible = vIn && (outP ? seenBy(q.box, true, q.room) : !q.mus || vMus); });
      }
      if (M.pre && --M.pre.n <= 0) { const q = M.pre.m; M.pre = null; if (q.parent) q.parent.remove(q); q.geometry.dispose(); q.material.dispose(); }
      if (M.panel) { const nt = nightT > 0.45; if (nt !== M.panelNight) { M.panelNight = nt; const k = nt ? 1 : 0; if (!M.panelTex[k]) M.panelTex[k] = signMake(nt); M.panel.material.map = M.panelTex[k]; M.panel.material.needsUpdate = true; } }
      // ночной тон — зал и картинки начинки («фото», картины, таблички: их сетка со своим материалом) одинаково, иначе ночью
      // картинки на тёплых стенах — холодно-белые пятна
      if (M.inMat && tint !== nightT) { tint = nightT; const k = nightT;
        [M.inMat, M.glassIn && M.glassIn.material].concat(IN.meshes.map(m => m && m.material)).forEach(mt => { if (!mt || !mt.color) return; mt.color.setRGB(1 - 0.03 * k, 1 - 0.08 * k, 1 - 0.18 * k); if (mt.emissive && !K.BAKED) mt.emissive.setRGB(0.26 * k, 0.2 * k, 0.12 * k); }); }
      return camIn;
    };
    out.camInside = () => camIn;
    // выгрузка региона: спрятанному отсечением — слои обратно (машина героини живёт и после села), списки и замыкания — отпустить
    out.dispose = () => { out.disposed = true; occRestore(); OCC.list = null; OCC.veh = null; OCC.PT.length = 0; OCC.SH.length = 0; IN.meshes.length = 0; IN.spots.length = 0; out.update = () => false; };
    // ночной холст панели (2304 × 640, ≈ 40–50 мс) — заранее, в простое после загрузки: первый переход на ночь без рывка
    // и сразу — в видеопамять: крошечный квадрат с ночной картой за панелью рисуется один кадр (иначе текстура 2304 × 640
    // грузится в кадре перехода на ночь)
    if (M.panel) (window.requestIdleCallback || (f => setTimeout(f, 2000)))(() => { try {
      if (out.disposed || !M.panel || M.panelTex[1]) return; M.panelTex[1] = signMake(true);
      const pm = new T.MeshBasicMaterial({ map: M.panelTex[1] }), pq = new T.Mesh(new T.PlaneGeometry(0.02, 0.02), pm);
      pq.position.copy(M.panel.position); pq.rotation.y = RY + PI; pq.translateZ(0.05); pq.frustumCulled = false; pq.userData.noRay = true; pq.name = 'kombinatPanelPre';
      ctx.root.add(pq); M.pre = { m: pq, n: 3 }; } catch (e) { /* ok */ } }, { timeout: 2500 });
    // треугольники: снаружи (кусок села), мелочь двора (props), зал целиком (оболочка изнутри + начинка), из них начинка, серебро, стёкла, картинки
    out.stats = { outside: bk.count() - bk0, yard: pb.count() - pb0, inside: ib.count(), interiorTris: IN.tris, silver: sv.count(), lamps: glowI.count(), glass: gl.count(), glassIn: glIn.count(), cards: cards.count(), art: ART.count(),
      interior: !!(V.kombinatInterior && V.kombinatInterior.furnish), sign: typeof window.kombinatSignCanvas === 'function', lampPts: IN.lamps.length };
    // сетки собраны: JS-массивы своих бакеров (≈ 10 МБ кучи) больше не нужны, а замыкания ручки (update, camZone…) держат весь
    // контекст build, пока регион жив и после (правка T12: куча после поездок). Кусок села (bk) и props (pb) — общие, их не трогаем
    [ib, sv, gl, glIn, glowI, cards, ART].forEach(b => { b.P = []; b.N = []; b.U = []; b.C = []; b.Sx = []; b.I = []; b.n = 0; }); artUV.length = 0;
    out.volAt = (x, z, y) => { const [lx, lz] = LOC(x, z); const v = volAt(lx, lz, y); return v ? v.id : null; };
    return out;
  }

  V.kombinat = { PLAN, build };
})();
