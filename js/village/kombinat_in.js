/* =====================================================================
   КУБАЧИНСКИЙ ХУДОЖЕСТВЕННЫЙ КОМБИНАТ — начинка помещений (волна «комбинат», раздел B техзадания).
   window.VILLAGE.kombinatInterior = { SPEC, furnish(ctx), silverMat(THREE, o) }. Обычный <script>, без модулей.

   Стены, перегородки, проёмы, плиты пола, потолки и окна строит корпус (js/village/kombinat.js). Здесь — всё внутри:
   отделка поверх стен (синяя масляная панель коридора, белый верх, плинтусы, наличники, двери-«картинки» с табличками
   и фрамугами), полы (ламинат, паркет, плитка, керамогранит), лампы, трубы и кабель-каналы, старые «фото» зверей-мастеров,
   музей (шкафы-витрины с серебром, витрины-столы на бордовой ткани, кувшин мастера под стеклом, картины, ковёр, этажерка),
   цех (верстаки с лампами, тисками, наковаленками и заготовками, стеллаж, полировальный станок, плакаты-орнаменты),
   вестибюль (стойка, эмблема, стенд «История», кувшин на пьедестале, растения, скамья, дорожка), тамбур (коврик, урна, стенд).
   Как на фото пользователя (коридор, зал музея), только опрятнее: краска не облуплена, кабели в коробах.

   Координаты — локальные метры рамки корпуса F (K.Frame): +z — фасад (к улице), +x — вправо, если стоять лицом к фасаду.
   Высоты y — в той же рамке (мировая y = y + F.oy). Всё серебро — тела вращения с малым числом граней в общем буфере bakers.sv
   (не по сетке на предмет); картинки («фото» мастеров, картины, ковёр, эмблема, стенды, таблички) — ОДНА текстура-атлас 1024² и
   одна сетка (ctx → meshes[0]). Бюджет на low (HI = false): ≤ 45 тыс. треугольников, цель ≤ 35 тыс. (stats.tris).

   КОНТРАКТ furnish(ctx):
   ctx: THREE, K (makeKit: Baker, Frame, cnv, tex, keep, toon, BAKED), F (K.Frame корпуса), FL (верх плиты пола, 0.08),
        bakers: { ib — непрозрачный 'vc', gl — стекло, glow — светится всегда (лампы), sv — серебро } (нет — заведутся свои / ib),
        named (false — нейтральные строки), HI, FAR (true — ничего не строим), signCanvas (window.kombinatSignCanvas; false — свои
        запасные рисунки). C, rgb, mul, mix, S, season, rng — принимаются, не нужны (палитра и случайность свои, детерминированные).
   → { colliders: [{ type:'box', lx, lz, w, d, y0, y1, id, stand:false } | { type:'circle', lx, lz, r, y0, y1, id, stand:false }],
       cam: [те же коробки, id 'cam…' — только для луча камеры: высокие шкафы, этажерка, стеллаж],
       lamps: [[lx, ly, lz]] — точки света (ly в рамке F), meshes: [сетка картинок в мировых координатах, свой материал],
       npcSlots: { owl: { lx, lz, ry, y }, masters: [{ lx, lz, ry, y (сиденье), floor, seat:true, role }], desk: { lx, lz, ry, y } },
       spots: [{ id, lx, lz, r, icon, label, action, sheet: { title, text[] }, cam: { pos, target (в рамке F), fov } }],
       stats: { tris, art, silver, ms: { atlas, geo } }, atlas (холст атласа — для отладки) }
   lx/lz/ry — в рамке F (мировой поворот = F.ry + ry); y0/y1 и y слотов — мировые (уже + F.oy); ry: 0 — лицом к +z рамки.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;

  /* ---------- планировка (общая с корпусом; техзадание, раздел «Планировка») ---------- */
  const FL0 = 0.08;
  const SPEC = {
    W: 26, D: 14, wall: 0.3, FL: FL0, HC: 3.4, HV: 3.2,   // корпус 26 × 14, пол 1-го этажа (верх плиты), высота помещений, тамбура
    rooms: {
      C: { x0: -12.7, x1: 12.7, z0: -0.40, z1: 2.00 },    // коридор
      M: { x0: -12.7, x1: -0.15, z0: -6.7, z1: -0.55 },   // зал музея
      Wk: { x0: 0.0, x1: 12.7, z0: -6.7, z1: -0.55 },     // цех мастеров
      L: { x0: 2.15, x1: 6.85, z0: 2.15, z1: 6.7 },       // вестибюль
      V: { x0: 2.2, x1: 6.8, z0: 7.0, z1: 9.7 },          // тамбур (внутри)
    },
    // проёмы (h — от пола FL); над проёмом в музей — фрамуга 0,5 м (рисуется здесь с обеих сторон стены)
    open: {
      museum: { x0: -7.4, x1: -5.4, z0: -0.55, z1: -0.40, h: 2.5, transom: 0.5 },
      work: { x0: 5.0, x1: 6.6, z0: -0.55, z1: -0.40, h: 2.4 },
      lobby: { x0: 2.6, x1: 6.4, z0: 2.00, z1: 2.15, h: 2.8 },
      vest: { x0: 3.0, x1: 6.0, z0: 6.7, z1: 7.0, h: 2.8 },
      auto: { x0: 3.6, x1: 5.4, z0: 9.7, z1: 10.0, h: 2.4 },
    },
    // закрытые двери (полотна на стенах, не проходят): x — середина; wall: S — z 2,00 (лицом в коридор), N — z −0,40 (с обратной
    // стороны — тоже дверь: в зал музея / в цех), W/E — торцы коридора (x ∓12,7, синие, с окном-фрамугой)
    doors: [
      { wall: 'S', x: -11.0, text: 'Архив' }, { wall: 'S', x: -7.5, text: 'Художники', tr: 1 }, { wall: 'S', x: -3.5, text: 'Библиотека' },
      { wall: 'S', x: 0.5, text: 'Бухгалтерия', tr: 1 }, { wall: 'S', x: 8.5, text: 'Дирекция' }, { wall: 'S', x: 11.5, text: 'Отдел сбыта', tr: 1 },
      { wall: 'N', x: -11.0, text: 'Фонды музея', back: 'M' }, { wall: 'N', x: 10.0, text: 'Кладовая', back: 'Wk' },
      { wall: 'W', z: 0.8, text: 'Запасный выход', tr: 1 }, { wall: 'E', z: 0.8, text: 'Лестница', tr: 1 },
    ],
    // окна задней стены (z −7), которые ждёт начинка: середины x, ширина, подоконник и верх от пола FL. Под окнами — только низкое
    // (витрины-столы ≤ 1,32, верстаки ≤ 0,95 + лампы), так что подойдёт и другая раскладка окон. Торцы x = ±12,7 у музея и цеха —
    // без окон (там картины, ковёр, этажерка, стеллаж)
    backWin: { xs: [-10.4, -6.4, -2.4, 2.35, 6.35, 10.35], w: 1.6, sill: 0.95, head: 2.75 },
    free: { corridor: 1.3, opening: 1.4 },
  };

  /* ---------- мелочи ---------- */
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const wdir = (Fr, v) => { const d = Fr.dir(v[0], v[2]); return [d[0], v[1], d[1]]; };   // локальное направление → мировое
  const FLAT = 7;   // vkit S.FLAT — ровная белая полоса атласа: если накопитель корпуса окажется 'atlas', цвет даст только вершина

  /* =====================================================================
     ТЕЛА ВРАЩЕНИЯ (серебро) и трубки
     ===================================================================== */
  // профиль prof: [r, h, флаг, цвет] снизу вверх (в долях, домножается на o.s). Флаг 'k' — излом (кольцо дублируется, нормали
  // по обе стороны свои), 'c' — смена цвета (кольцо дублируется, нормаль общая). Цвет точки действует на отрезки выше неё.
  // r = 0 у первой/последней точки — веер (дно, «нутро» горла). Ось ax и база b — в рамке Fr; o: { seg, s, col, sq: [su, sv], u, a0 }
  function lathe(bk, Fr, b, ax, prof, o = {}) {
    const seg = o.seg || 7, s = o.s || 1, sq = o.sq || [1, 1], a0 = o.a0 || 0, m = prof.length;
    const A = nrm(wdir(Fr, ax)), B0 = Fr.p(b[0], b[1], b[2]);
    let U = o.u ? nrm(wdir(Fr, o.u)) : (Math.abs(A[1]) > 0.9 ? nrm(wdir(Fr, [1, 0, 0])) : nrm(cross([0, 1, 0], A)));
    { const d = dot(U, A); U = nrm([U[0] - A[0] * d, U[1] - A[1] * d, U[2] - A[2] * d]); }
    const Vv = cross(A, U);
    const segN = [], segC = []; let cur = o.col || [0.85, 0.87, 0.9];
    for (let j = 0; j < m - 1; j++) {
      if (prof[j][3]) cur = prof[j][3];
      const dr = prof[j + 1][0] - prof[j][0], dh = prof[j + 1][1] - prof[j][1], L = Math.hypot(dr, dh) || 1;
      segN.push([dh / L, -dr / L]); segC.push(cur);
    }
    const recs = [];
    for (let i = 0; i < m; i++) {
      const r = prof[i][0] * s, h = prof[i][1] * s, f = prof[i][2];
      if (i === 0) { recs.push({ r, h, n: segN[0], c: segC[0], link: false }); continue; }
      if (i === m - 1) { recs.push({ r, h, n: segN[i - 1], c: segC[i - 1], link: true }); continue; }
      const nA = segN[i - 1], nB = segN[i], av = nrm([nA[0] + nB[0], nA[1] + nB[1], 0]);
      if (f === 'k') { recs.push({ r, h, n: nA, c: segC[i - 1], link: true }); recs.push({ r, h, n: nB, c: segC[i], link: false }); }
      else if (f === 'c' || segC[i - 1] !== segC[i]) { recs.push({ r, h, n: av, c: segC[i - 1], link: true }); recs.push({ r, h, n: av, c: segC[i], link: false }); }
      else recs.push({ r, h, n: av, c: segC[i], link: true });
    }
    const cs = [], sn = [];
    for (let k = 0; k < seg; k++) { const a = a0 + k / seg * TAU; cs.push(Math.cos(a)); sn.push(Math.sin(a)); }
    let prev = null;
    recs.forEach(R => {
      const base = [B0[0] + A[0] * R.h, B0[1] + A[1] * R.h, B0[2] + A[2] * R.h], fan = R.r < 1e-5;
      const idx = [];
      if (fan) { const nn = R.n[1] >= 0 ? A : [-A[0], -A[1], -A[2]]; idx.push(bk.vert(base, nn, [0, 0], R.c, FLAT)); }
      else for (let k = 0; k < seg; k++) {
        const rx = cs[k] * sq[0], ry = sn[k] * sq[1], d = [U[0] * rx + Vv[0] * ry, U[1] * rx + Vv[1] * ry, U[2] * rx + Vv[2] * ry];
        const p = [base[0] + d[0] * R.r, base[1] + d[1] * R.r, base[2] + d[2] * R.r];
        const rd = nrm([U[0] * cs[k] + Vv[0] * sn[k], U[1] * cs[k] + Vv[1] * sn[k], U[2] * cs[k] + Vv[2] * sn[k]]);
        idx.push(bk.vert(p, nrm([rd[0] * R.n[0] + A[0] * R.n[1], rd[1] * R.n[0] + A[1] * R.n[1], rd[2] * R.n[0] + A[2] * R.n[1]]), [0, 0], R.c, FLAT));
      }
      if (prev && R.link) {
        const pf = prev.length === 1, cf = idx.length === 1;
        for (let k = 0; k < seg; k++) {
          const k1 = (k + 1) % seg;
          if (pf && !cf) bk.I.push(prev[0], idx[k1], idx[k]);
          else if (!pf && cf) bk.I.push(prev[k], prev[k1], idx[0]);
          else if (!pf && !cf) bk.I.push(prev[k], prev[k1], idx[k1], prev[k], idx[k1], idx[k]);
        }
      }
      prev = idx;
    });
  }
  // трубка вдоль ломаной pts (рамка Fr); bn — локальная нормаль плоскости изгиба (ручка кувшина, браслет); sides граней
  function sweep(bk, Fr, pts, r, sides, bn, col) {
    const W = pts.map(p => Fr.p(p[0], p[1], p[2])), n = W.length, B = nrm(wdir(Fr, bn)); let prev = null;
    for (let i = 0; i < n; i++) {
      const a = W[Math.max(0, i - 1)], b = W[Math.min(n - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const n1 = nrm(cross(B, t)), idx = [];
      for (let k = 0; k < sides; k++) { const f = k / sides * TAU + PI / sides, c = Math.cos(f), s = Math.sin(f), d = [n1[0] * c + B[0] * s, n1[1] * c + B[1] * s, n1[2] * c + B[2] * s];
        idx.push(bk.vert([W[i][0] + d[0] * r, W[i][1] + d[1] * r, W[i][2] + d[2] * r], d, [0, 0], col, FLAT)); }
      if (prev) for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; bk.I.push(prev[k], idx[k], idx[k1], prev[k], idx[k1], prev[k1]); }
      prev = idx;
    }
  }

  /* =====================================================================
     АТЛАС КАРТИНОК: старые «фото» зверей-мастеров (сепия), эскизы орнамента, картины, ковёр, дорожка, эмблема, стенды,
     плакаты цеха, таблички дверей, циферблат. Один холст 1024², одна текстура
     ===================================================================== */
  const AW = 1024, AH = 1024, GAP = 3;
  const SEP = { bg0: '#DCCBA6', bg1: '#8C7455', dk: '#3A2B1F', md: '#7C6449', lt: '#BDA47D', wh: '#EADCBE' };
  const INK = '#24324F', NAVY = '#22336A', CREAM = '#F3EEE2';
  function ell(c, x, y, rx, ry, rot, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), rot || 0, 0, TAU); c.fillStyle = fill; c.fill(); }
  function poly(c, pts, fill) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill(); }
  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const lines = (c, x, y, w, n, step, col, R) => { c.fillStyle = col; for (let i = 0; i < n; i++) c.fillRect(x, y + i * step, w * (i === n - 1 ? 0.55 : 0.82 + R() * 0.18), Math.max(1, step * 0.32)); };   // «текст» штрихами

  // зверь-мастер по пояс, как на старом снимке (голова — радиус s, центр cx, cy); черкеска с газырями, у кого-то папаха
  function bust(c, kind, cx, cy, s, P) {
    const E = (x, y, rx, ry, rot, f) => ell(c, cx + x * s, cy + y * s, rx * s, ry * s, rot, f);
    const T3 = (a, b, d, f) => poly(c, [[cx + a[0] * s, cy + a[1] * s], [cx + b[0] * s, cy + b[1] * s], [cx + d[0] * s, cy + d[1] * s]], f);
    c.beginPath(); c.moveTo(cx - 2.5 * s, cy + 3.4 * s); c.bezierCurveTo(cx - 2.5 * s, cy + 1.45 * s, cx - 1.25 * s, cy + 0.95 * s, cx, cy + 0.95 * s);
    c.bezierCurveTo(cx + 1.25 * s, cy + 0.95 * s, cx + 2.5 * s, cy + 1.45 * s, cx + 2.5 * s, cy + 3.4 * s); c.closePath(); c.fillStyle = P.dk; c.fill();
    T3([-0.45, 0.82], [0.45, 0.82], [0, 1.8], P.wh); T3([-0.15, 0.88], [0.15, 0.88], [0, 2.05], P.dk);
    [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) { c.fillStyle = P.lt; c.fillRect(cx + sd * (0.8 + i * 0.21) * s - 0.045 * s, cy + 1.6 * s, 0.09 * s, 0.42 * s); } });   // газыри
    const eye = (x, y, r, ring) => { if (ring) E(x, y, r * 1.6, r * 1.6, 0, ring); E(x, y, r, r, 0, P.dk); E(x - r * 0.3, y - r * 0.35, r * 0.34, r * 0.34, 0, P.wh); };
    let hat = false;
    switch (kind) {
      case 'badger':
        E(-0.74, -0.62, 0.24, 0.2, 0, P.dk); E(0.74, -0.62, 0.24, 0.2, 0, P.dk); E(0, 0, 0.95, 0.88, 0, P.wh);
        E(-0.36, -0.2, 0.2, 0.62, 0.28, P.dk); E(0.36, -0.2, 0.2, 0.62, -0.28, P.dk); E(0, 0.42, 0.36, 0.28, 0, P.lt);
        eye(-0.34, 0.02, 0.08, P.md); eye(0.34, 0.02, 0.08, P.md); E(0, 0.33, 0.14, 0.09, 0, P.dk); hat = true; break;
      case 'owl':
        E(0, 0.15, 1.05, 1.02, 0, P.md); T3([-0.88, -0.5], [-0.5, -0.78], [-0.62, -1.25], P.dk); T3([0.88, -0.5], [0.5, -0.78], [0.62, -1.25], P.dk);
        E(-0.4, -0.02, 0.42, 0.42, 0, P.lt); E(0.4, -0.02, 0.42, 0.42, 0, P.lt); eye(-0.4, -0.02, 0.16); eye(0.4, -0.02, 0.16);
        T3([-0.11, 0.22], [0.11, 0.22], [0, 0.56], P.dk);
        c.strokeStyle = P.lt; c.lineWidth = Math.max(1, s * 0.06); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx + (-0.3 + i * 0.3) * s - 0.08 * s, cy + 0.72 * s); c.lineTo(cx + (-0.3 + i * 0.3) * s, cy + 0.8 * s); c.lineTo(cx + (-0.3 + i * 0.3) * s + 0.08 * s, cy + 0.72 * s); c.stroke(); }
        // круглые очки — хранительница
        c.strokeStyle = P.dk; c.lineWidth = Math.max(1, s * 0.05); [-0.4, 0.4].forEach(x => { c.beginPath(); c.arc(cx + x * s, cy - 0.02 * s, 0.3 * s, 0, TAU); c.stroke(); }); break;
      case 'hedgehog':
        for (let i = 0; i <= 14; i++) { const a = PI * (1.08 + i / 14 * 0.84) + PI * 0.0, a1 = a - 0.11, a2 = a + 0.11;
          T3([Math.cos(a1) * 0.82, Math.sin(a1) * 0.78 + 0.05], [Math.cos(a2) * 0.82, Math.sin(a2) * 0.78 + 0.05], [Math.cos(a) * 1.5, Math.sin(a) * 1.4 + 0.05], i % 2 ? P.dk : P.md); }
        E(0, 0.08, 0.9, 0.82, 0, P.md); E(0, 0.32, 0.62, 0.56, 0, P.lt); E(0, 0.66, 0.22, 0.18, 0, P.lt); E(0, 0.74, 0.1, 0.08, 0, P.dk);
        E(-0.62, -0.42, 0.16, 0.14, 0, P.lt); E(0.62, -0.42, 0.16, 0.14, 0, P.lt); eye(-0.3, 0.14, 0.08); eye(0.3, 0.14, 0.08); break;
      case 'fox':
        T3([-0.86, -0.2], [-0.24, -0.66], [-0.78, -1.38], P.md); T3([0.86, -0.2], [0.24, -0.66], [0.78, -1.38], P.md);
        T3([-0.72, -0.4], [-0.4, -0.66], [-0.72, -1.08], P.dk); T3([0.72, -0.4], [0.4, -0.66], [0.72, -1.08], P.dk);
        E(0, 0, 0.9, 0.78, 0, P.md); E(-0.45, 0.35, 0.42, 0.3, 0.3, P.wh); E(0.45, 0.35, 0.42, 0.3, -0.3, P.wh); T3([-0.3, 0.18], [0.3, 0.18], [0, 0.86], P.wh);
        E(0, 0.8, 0.1, 0.08, 0, P.dk); eye(-0.32, -0.06, 0.08); eye(0.32, -0.06, 0.08); break;
      case 'bear':
        E(-0.72, -0.68, 0.28, 0.26, 0, P.dk); E(0.72, -0.68, 0.28, 0.26, 0, P.dk); E(0, 0, 1.0, 0.92, 0, P.md);
        E(0, 0.38, 0.45, 0.34, 0, P.lt); E(0, 0.25, 0.16, 0.11, 0, P.dk); eye(-0.38, -0.12, 0.08); eye(0.38, -0.12, 0.08); hat = true; break;
      case 'ram':
        [-1, 1].forEach(sd => { E(sd * 0.82, -0.08, 0.52, 0.52, 0, P.dk); E(sd * 0.82, -0.08, 0.36, 0.36, 0, P.md); E(sd * 0.82, -0.08, 0.2, 0.2, 0, P.dk); });
        E(0, 0.08, 0.74, 0.96, 0, P.lt); for (let i = 0; i < 6; i++) E(-0.5 + i * 0.2, -0.72 + (i % 2) * 0.06, 0.17, 0.15, 0, P.wh);
        eye(-0.32, 0.02, 0.08); eye(0.32, 0.02, 0.08); E(0, 0.66, 0.2, 0.12, 0, P.md); hat = true; break;
      case 'hare':
        E(-0.32, -1.32, 0.2, 0.76, 0.12, P.md); E(0.32, -1.32, 0.2, 0.76, -0.12, P.md); E(-0.32, -1.28, 0.09, 0.56, 0.12, P.lt); E(0.32, -1.28, 0.09, 0.56, -0.12, P.lt);
        E(0, 0, 0.86, 0.8, 0, P.lt); E(-0.3, 0.38, 0.3, 0.22, 0, P.wh); E(0.3, 0.38, 0.3, 0.22, 0, P.wh); eye(-0.36, -0.06, 0.09); eye(0.36, -0.06, 0.09); E(0, 0.3, 0.1, 0.07, 0, P.dk); break;
      default:   // енот
        T3([-0.85, -0.25], [-0.35, -0.7], [-0.78, -1.15], P.md); T3([0.85, -0.25], [0.35, -0.7], [0.78, -1.15], P.md);
        E(0, 0, 0.95, 0.82, 0, P.md); E(0, -0.04, 0.86, 0.26, 0, P.dk); E(0, 0.4, 0.36, 0.28, 0, P.wh);
        eye(-0.36, -0.05, 0.08, P.lt); eye(0.36, -0.05, 0.08, P.lt); E(0, 0.34, 0.12, 0.08, 0, P.dk);
    }
    if (hat) {   // папаха: тёмная, с кудряшками
      rr(c, cx - 0.82 * s, cy - 1.62 * s, 1.64 * s, 0.86 * s, 0.3 * s); c.fillStyle = P.dk; c.fill();
      c.fillStyle = P.md; for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(cx + (-0.66 + i * 0.22 + (j % 2) * 0.1) * s, cy + (-1.45 + j * 0.24) * s, 0.06 * s, 0, TAU); c.fill(); }
    }
  }
  function paintPhoto(c, r, kind, R) {
    const { x, y, w, h } = r;
    c.fillStyle = '#EEE6D3'; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);   // паспарту
    const px = x + w * 0.1, py = y + h * 0.07, pw = w * 0.8, ph = h * 0.72;
    c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip();
    const g = c.createRadialGradient(px + pw * 0.5, py + ph * 0.36, pw * 0.05, px + pw * 0.5, py + ph * 0.5, pw * 0.9);
    g.addColorStop(0, SEP.bg0); g.addColorStop(1, SEP.bg1); c.fillStyle = g; c.fillRect(px, py, pw, ph);
    bust(c, kind, px + pw / 2, py + ph * 0.44, pw * 0.25, SEP);
    const v = c.createRadialGradient(px + pw / 2, py + ph / 2, pw * 0.32, px + pw / 2, py + ph / 2, pw * 0.85); v.addColorStop(0, 'rgba(50,35,22,0)'); v.addColorStop(1, 'rgba(50,35,22,0.45)'); c.fillStyle = v; c.fillRect(px, py, pw, ph);
    for (let i = 0; i < 220; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,245,225,0.12)' : 'rgba(40,28,18,0.12)'; c.fillRect(px + R() * pw, py + R() * ph, 1, 1); }   // зерно старой фотобумаги
    c.restore();
    c.strokeStyle = 'rgba(80,64,46,0.55)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    c.fillStyle = 'rgba(70,58,44,0.55)'; c.fillRect(x + w * 0.22, y + h * 0.855, w * 0.56, 2); c.fillRect(x + w * 0.3, y + h * 0.905, w * 0.4, 2);   // подпись
  }
  // «тутта»-ветка: ось и парные завитки-побеги с листиками (рисунок тушью)
  function branch(c, x, y0, y1, s, col, lw) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y0); c.bezierCurveTo(x - s * 0.08, y0 - (y0 - y1) * 0.35, x + s * 0.08, y0 - (y0 - y1) * 0.65, x, y1); c.stroke();
    const n = Math.max(2, Math.round((y0 - y1) / (s * 0.9)));
    for (let i = 0; i < n; i++) {
      const yy = y0 - (i + 0.6) / (n + 0.4) * (y0 - y1), k = 1 - i / (n + 1) * 0.45;
      [-1, 1].forEach(sd => {
        const cx = x + sd * s * 0.52 * k, cy = yy - s * 0.3 * k, R0 = s * 0.42 * k; c.beginPath(); c.moveTo(x, yy);
        for (let t = 0; t <= 1.0001; t += 0.05) { const a = (sd > 0 ? PI : 0) + sd * t * 1.75 * PI, rr0 = R0 * (1 - 0.72 * t); c.lineTo(cx + Math.cos(a) * rr0, cy - Math.sin(a) * rr0 * 0.9); }
        c.stroke();
        c.beginPath(); c.ellipse(x + sd * s * 0.95 * k, yy - s * 0.62 * k, s * 0.16 * k, s * 0.07 * k, sd * -0.9, 0, TAU); c.fill();   // листик
      });
    }
    c.beginPath(); c.ellipse(x, y1 - s * 0.12, s * 0.09, s * 0.18, 0, 0, TAU); c.fill();   // бутон на верхушке
  }
  function rosette(c, x, y, R, col, lw, petals) {
    c.strokeStyle = col; c.lineWidth = lw; c.fillStyle = col;
    [1, 0.8, 0.32].forEach(k => { c.beginPath(); c.arc(x, y, R * k, 0, TAU); c.stroke(); });
    for (let i = 0; i < petals; i++) { const a = i / petals * TAU; c.save(); c.translate(x + Math.cos(a) * R * 0.56, y + Math.sin(a) * R * 0.56); c.rotate(a); c.beginPath(); c.ellipse(0, 0, R * 0.22, R * 0.1, 0, 0, TAU); c.stroke(); c.restore(); }
    c.beginPath(); c.arc(x, y, R * 0.12, 0, TAU); c.fill();
  }
  function paintSketch(c, r, kind, R) {
    const { x, y, w, h } = r, m = w * 0.13;
    c.fillStyle = '#F4F1EA'; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
    c.fillStyle = '#FBF9F4'; c.fillRect(x + m, y + m, w - 2 * m, h - 2 * m); c.strokeStyle = 'rgba(90,85,75,0.45)'; c.lineWidth = 1; c.strokeRect(x + m + 0.5, y + m + 0.5, w - 2 * m - 1, h - 2 * m - 1);
    const cx = x + w / 2, cy = y + h / 2, iw = w - 2 * m, ih = h - 2 * m;
    if (kind === 0) branch(c, cx, y + h - m - 6, y + m + 12, iw * 0.42, INK, 1.4);
    else if (kind === 1) { rosette(c, cx, cy, iw * 0.36, INK, 1.3, 8); rosette(c, cx, cy, iw * 0.16, INK, 1, 6); }
    else if (kind === 2) {   // кувшин с поясами узора
      const pr = [[0.14, 0], [0.12, 0.06], [0.24, 0.25], [0.27, 0.4], [0.22, 0.56], [0.1, 0.74], [0.09, 0.84], [0.14, 1]], H = ih * 0.78, by = y + h - m - 6;
      c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); pr.forEach((p, i) => (i ? c.lineTo(cx - p[0] * H, by - p[1] * H) : c.moveTo(cx - p[0] * H, by - p[1] * H))); for (let i = pr.length - 1; i >= 0; i--) c.lineTo(cx + pr[i][0] * H, by - pr[i][1] * H); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(cx + 0.24 * H, by - 0.42 * H); c.quadraticCurveTo(cx + 0.45 * H, by - 0.6 * H, cx + 0.32 * H, by - 0.82 * H); c.stroke();   // носик
      c.beginPath(); c.moveTo(cx - 0.12 * H, by - 0.82 * H); c.bezierCurveTo(cx - 0.45 * H, by - 0.9 * H, cx - 0.42 * H, by - 0.5 * H, cx - 0.25 * H, by - 0.36 * H); c.stroke();   // ручка
      for (let i = 0; i < 9; i++) { const t = i / 8, xx = cx - 0.24 * H + t * 0.48 * H; c.beginPath(); c.moveTo(xx, by - 0.3 * H); c.lineTo(xx + 0.027 * H, by - 0.36 * H); c.lineTo(xx + 0.054 * H, by - 0.3 * H); c.stroke(); }
      rosette(c, cx, by - 0.46 * H, 0.08 * H, INK, 1, 6);
    } else {   // полоса бегущих завитков
      c.strokeStyle = INK; c.lineWidth = 1.2;
      for (let row = 0; row < 4; row++) { const yy = y + m + 14 + row * (ih - 20) / 3.3; for (let i = 0; i < 4; i++) { const xx = x + m + 10 + i * (iw - 18) / 3.6; c.beginPath(); for (let t = 0; t <= 1.0001; t += 0.06) { const a = t * 1.8 * PI, rr0 = 9 * (1 - 0.7 * t); c.lineTo(xx + Math.cos(a) * rr0, yy - Math.sin(a) * rr0); } c.stroke(); } }
    }
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(120,110,90,0.06)'; c.fillRect(x + R() * w, y + R() * h, 2, 2); }
  }
  // картины музея (масло): село на склоне, натюрморт с кувшином, горы в тумане, мастер за работой
  function paintPicture(c, r, kind, R) {
    const { x, y, w, h } = r;
    c.save(); c.beginPath(); c.rect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP); c.clip();
    const brush = (n, cols, sz) => { for (let i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(R() * cols.length)]; c.globalAlpha = 0.18; c.fillRect(x + R() * w, y + R() * h, sz * (0.5 + R()), sz * 0.35); } c.globalAlpha = 1; };
    if (kind === 0) {
      let g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, '#8FB8DE'); g.addColorStop(1, '#E7ECEB'); c.fillStyle = g; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
      poly(c, [[x - 4, y + h * 0.5], [x + w * 0.2, y + h * 0.28], [x + w * 0.42, y + h * 0.4], [x + w * 0.66, y + h * 0.22], [x + w + 4, y + h * 0.42], [x + w + 4, y + h], [x - 4, y + h]], '#9AACBB');
      poly(c, [[x - 4, y + h * 0.66], [x + w * 0.3, y + h * 0.5], [x + w * 0.7, y + h * 0.56], [x + w + 4, y + h * 0.5], [x + w + 4, y + h], [x - 4, y + h]], '#8E9A6A');
      const cols = ['#EFE6D2', '#D9C294', '#F4F0E6', '#CDB48A', '#E7D7B4'];
      for (let row = 0; row < 7; row++) for (let i = 0; i < 9; i++) {
        const bx = x + w * 0.18 + i * w * 0.085 + row * w * 0.035 + (R() - 0.5) * 4, by = y + h * 0.9 - row * h * 0.075 - i * h * 0.012, bw = w * 0.075, bh = h * 0.09;
        if (bx > x + w - 6) continue; c.fillStyle = cols[(row * 3 + i) % cols.length]; c.fillRect(bx, by - bh, bw, bh); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(bx, by - bh, bw, 2);
        c.fillStyle = '#3E4F5C'; c.fillRect(bx + bw * 0.25, by - bh * 0.6, bw * 0.18, bh * 0.28); if (R() < 0.6) c.fillRect(bx + bw * 0.6, by - bh * 0.6, bw * 0.18, bh * 0.28);
      }
      const tx = x + w * 0.1, ty = y + h * 0.36; c.fillStyle = '#CDB48A'; c.fillRect(tx, ty, w * 0.09, h * 0.42); for (let i = 0; i < 3; i++) c.fillRect(tx + i * w * 0.035, ty - 5, w * 0.022, 5); c.fillStyle = '#3E4F5C'; c.fillRect(tx + w * 0.035, ty + h * 0.1, w * 0.02, h * 0.05);
      brush(260, ['#FFFFFF', '#6E8A9E', '#B5A27A'], 7);
    } else if (kind === 1) {
      let g = c.createRadialGradient(x + w * 0.45, y + h * 0.4, 5, x + w * 0.5, y + h * 0.5, w * 0.7); g.addColorStop(0, '#5A4232'); g.addColorStop(1, '#22180F'); c.fillStyle = g; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
      c.fillStyle = '#7A2436'; c.fillRect(x - 4, y + h * 0.7, w + 8, h * 0.32); c.fillStyle = '#5E1A29'; c.fillRect(x - 4, y + h * 0.7, w + 8, 4);
      const jx = x + w * 0.46, jb = y + h * 0.78, H = h * 0.62, pr = [[0.14, 0], [0.24, 0.22], [0.27, 0.4], [0.2, 0.58], [0.1, 0.74], [0.09, 0.84], [0.14, 1]];
      c.beginPath(); pr.forEach((p, i) => (i ? c.lineTo(jx - p[0] * H, jb - p[1] * H) : c.moveTo(jx - p[0] * H, jb - p[1] * H))); for (let i = pr.length - 1; i >= 0; i--) c.lineTo(jx + pr[i][0] * H, jb - pr[i][1] * H); c.closePath();
      g = c.createLinearGradient(jx - 0.27 * H, 0, jx + 0.27 * H, 0); g.addColorStop(0, '#5E636B'); g.addColorStop(0.35, '#E8ECF0'); g.addColorStop(0.6, '#A9AFB7'); g.addColorStop(1, '#4C5058'); c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(40,40,50,0.55)'; c.fillRect(jx - 0.26 * H, jb - 0.42 * H, 0.52 * H, 0.06 * H);
      ell(c, x + w * 0.76, y + h * 0.7, w * 0.08, h * 0.1, 0, '#A3222A'); ell(c, x + w * 0.74, y + h * 0.66, w * 0.025, h * 0.03, 0, '#D9534F');
      ell(c, x + w * 0.2, y + h * 0.73, w * 0.06, h * 0.08, 0, '#C9B03A'); ell(c, x + w * 0.29, y + h * 0.75, w * 0.055, h * 0.07, 0, '#9DB040');
      brush(160, ['#000000', '#7A5A3A'], 8);
    } else if (kind === 2) {
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#C9D6E2'); g.addColorStop(1, '#EEF1F4'); c.fillStyle = g; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
      [['#93A6BA', 0.38], ['#7D93A8', 0.52], ['#5F7690', 0.66], ['#4B5F75', 0.8]].forEach(([col, k], j) => {
        c.beginPath(); c.moveTo(x - 4, y + h); for (let i = 0; i <= 12; i++) c.lineTo(x + i / 12 * w, y + h * k - Math.abs(Math.sin(i * 1.3 + j * 2.1)) * h * 0.16); c.lineTo(x + w + 4, y + h); c.closePath(); c.fillStyle = col; c.fill();
        c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x - 4, y + h * (k + 0.05), w + 8, h * 0.05); });
      c.strokeStyle = '#2E3440'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + w * 0.6, y + h * 0.2); c.quadraticCurveTo(x + w * 0.63, y + h * 0.17, x + w * 0.66, y + h * 0.2); c.quadraticCurveTo(x + w * 0.69, y + h * 0.17, x + w * 0.72, y + h * 0.2); c.stroke();
      brush(180, ['#FFFFFF', '#6E8296'], 9);
    } else {
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#C9A877'); g.addColorStop(1, '#8E6A45'); c.fillStyle = g; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
      c.fillStyle = '#E8E4D2'; c.fillRect(x + w * 0.62, y + h * 0.12, w * 0.26, h * 0.4); c.fillStyle = '#9FBBD4'; c.fillRect(x + w * 0.64, y + h * 0.15, w * 0.1, h * 0.16); c.fillRect(x + w * 0.76, y + h * 0.15, w * 0.1, h * 0.16); c.fillRect(x + w * 0.64, y + h * 0.33, w * 0.1, h * 0.16); c.fillRect(x + w * 0.76, y + h * 0.33, w * 0.1, h * 0.16);
      c.fillStyle = '#6B4A2E'; c.fillRect(x + w * 0.08, y + h * 0.66, w * 0.84, h * 0.07); c.fillRect(x + w * 0.12, y + h * 0.73, w * 0.04, h * 0.27); c.fillRect(x + w * 0.84, y + h * 0.73, w * 0.04, h * 0.27);
      const bP = { dk: '#3E3A38', md: '#7E7A76', lt: '#B9B4AE', wh: '#F0ECE6' };
      c.save(); c.beginPath(); c.rect(x, y, w, y + h * 0.66 - y); c.clip(); bust(c, 'badger', x + w * 0.36, y + h * 0.38, h * 0.11, bP); c.restore();
      ell(c, x + w * 0.5, y + h * 0.64, w * 0.05, h * 0.02, 0, '#D9DEE4'); g = c.createRadialGradient(x + w * 0.52, y + h * 0.5, 2, x + w * 0.52, y + h * 0.5, w * 0.2); g.addColorStop(0, 'rgba(255,235,180,0.7)'); g.addColorStop(1, 'rgba(255,235,180,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
      brush(160, ['#5A3E28', '#E8D2A0'], 8);
    }
    c.restore();
  }
  // настенный ковёр: тёмно-красное поле, кайма, три крупных медальона-«ромба» с крючками, бахрома
  function paintRug(c, r, R) {
    const { x, y, w, h } = r, red = '#7B1F25', nv = '#23305A', bg = '#D9C9A3', oc = '#C08A2E';
    c.fillStyle = '#EDE6D6'; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
    const fy = 8; c.fillStyle = '#EDE6D6'; for (let i = 0; i < w; i += 4) { c.fillRect(x + i, y, 2, fy); c.fillRect(x + i, y + h - fy, 2, fy); }
    const X = x, Y = y + fy, W = w, Hh = h - 2 * fy;
    c.fillStyle = nv; c.fillRect(X, Y, W, Hh); c.fillStyle = bg; c.fillRect(X + 6, Y + 6, W - 12, Hh - 12); c.fillStyle = nv; c.fillRect(X + 16, Y + 16, W - 32, Hh - 32);
    for (let i = 0; i < (W - 12) / 10; i++) { poly(c, [[X + 11 + i * 10, Y + 8], [X + 15 + i * 10, Y + 11], [X + 11 + i * 10, Y + 14], [X + 7 + i * 10, Y + 11]], red); poly(c, [[X + 11 + i * 10, Y + Hh - 14], [X + 15 + i * 10, Y + Hh - 11], [X + 11 + i * 10, Y + Hh - 8], [X + 7 + i * 10, Y + Hh - 11]], red); }
    for (let i = 0; i < (Hh - 12) / 10; i++) { poly(c, [[X + 11, Y + 9 + i * 10], [X + 14, Y + 13 + i * 10], [X + 11, Y + 17 + i * 10], [X + 8, Y + 13 + i * 10]], red); poly(c, [[X + W - 11, Y + 9 + i * 10], [X + W - 8, Y + 13 + i * 10], [X + W - 11, Y + 17 + i * 10], [X + W - 14, Y + 13 + i * 10]], red); }
    c.fillStyle = red; c.fillRect(X + 19, Y + 19, W - 38, Hh - 38);
    const md = (cx, cy, rx, ry) => {
      poly(c, [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], bg); poly(c, [[cx, cy - ry + 4], [cx + rx - 5, cy], [cx, cy + ry - 4], [cx - rx + 5, cy]], nv);
      poly(c, [[cx, cy - ry * 0.55], [cx + rx * 0.55, cy], [cx, cy + ry * 0.55], [cx - rx * 0.55, cy]], red); poly(c, [[cx, cy - ry * 0.25], [cx + rx * 0.25, cy], [cx, cy + ry * 0.25], [cx - rx * 0.25, cy]], oc);
      [[cx, cy - ry], [cx, cy + ry], [cx + rx, cy], [cx - rx, cy]].forEach(([px, py]) => { c.fillStyle = bg; c.fillRect(px - 4, py - 4, 8, 8); c.fillStyle = oc; c.fillRect(px - 2, py - 2, 4, 4); });
    };
    const n = 3; for (let i = 0; i < n; i++) md(X + W / 2, Y + 19 + (Hh - 38) * (i + 0.5) / n, (W - 38) * 0.4, (Hh - 38) / n * 0.42);
    for (let i = 0; i < 26; i++) { const px = X + 24 + R() * (W - 48), py = Y + 24 + R() * (Hh - 48); c.fillStyle = R() < 0.5 ? bg : oc; c.fillRect(px - 2, py - 2, 4, 4); c.fillRect(px - 5, py - 0.5, 10, 1); c.fillRect(px - 0.5, py - 5, 1, 10); }
    for (let i = 0; i < 400; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; c.fillRect(x + R() * w, y + R() * h, 2, 1); }
  }
  // ковровая дорожка вестибюля (повторяется по длине): бордо, синяя кайма, бежевые ромбы
  function paintRunner(c, r) {
    const { x, y, w, h } = r, red = '#7A2436', nv = '#23305A', bg = '#D9C9A3', oc = '#C08A2E';
    c.fillStyle = nv; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP); c.fillStyle = bg; c.fillRect(x + 5, y - GAP, w - 10, h + 2 * GAP); c.fillStyle = red; c.fillRect(x + 10, y - GAP, w - 20, h + 2 * GAP);
    for (let i = 0; i < 2; i++) { const cy = y + h * (0.25 + i * 0.5), cx = x + w / 2, rx = w * 0.3, ry = h * 0.2;
      poly(c, [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], bg); poly(c, [[cx, cy - ry + 5], [cx + rx - 6, cy], [cx, cy + ry - 5], [cx - rx + 6, cy]], nv); poly(c, [[cx, cy - ry * 0.4], [cx + rx * 0.4, cy], [cx, cy + ry * 0.4], [cx - rx * 0.4, cy]], oc); }
    for (let i = 0; i < 4; i++) { const cy = y + h * (i * 0.25), cx = x + w / 2; c.fillStyle = oc; c.fillRect(cx - 6, cy - 1, 12, 2); c.fillRect(cx - 1, cy - 6, 2, 12); }
  }
  // своя эмблема-розетка (если модуля вывески нет): шесть завитков-«облаков» по кругу и шестилучевая звезда, индиго на светлом
  function paintEmblemOwn(c, cx, cy, R0, ink, hi) {
    c.save();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - PI / 2, px = cx + Math.cos(a) * R0 * 0.62, py = cy + Math.sin(a) * R0 * 0.62;
      c.beginPath(); c.arc(px, py, R0 * 0.36, 0, TAU); c.fillStyle = hi; c.fill(); c.lineWidth = R0 * 0.05; c.strokeStyle = ink; c.beginPath(); c.arc(px, py, R0 * 0.3, a + PI * 0.15, a + PI * 1.15); c.stroke();
      c.beginPath(); c.arc(px + Math.cos(a + 1.2) * R0 * 0.1, py + Math.sin(a + 1.2) * R0 * 0.1, R0 * 0.12, a, a + PI * 1.4); c.stroke(); }
    c.beginPath(); c.arc(cx, cy, R0 * 0.42, 0, TAU); c.fillStyle = hi; c.fill();
    c.lineWidth = R0 * 0.045; c.strokeStyle = ink;
    [-PI / 2, PI / 2].forEach(o => { c.beginPath(); for (let i = 0; i < 3; i++) { const a = o + i / 3 * TAU; const px = cx + Math.cos(a) * R0 * 0.34, py = cy + Math.sin(a) * R0 * 0.34; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.stroke(); });
    c.restore();
  }
  // цифры своими штрихами (без системных шрифтов): «1924», «1960»
  function digits(c, str, x, y, h, col, lw) {
    const w = h * 0.55; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const ch of str) {
      c.beginPath();
      if (ch === '1') { c.moveTo(x + w * 0.25, y + h * 0.2); c.lineTo(x + w * 0.55, y); c.lineTo(x + w * 0.55, y + h); }
      else if (ch === '9') { c.ellipse(x + w * 0.5, y + h * 0.3, w * 0.42, h * 0.3, 0, 0, TAU); c.moveTo(x + w * 0.92, y + h * 0.3); c.quadraticCurveTo(x + w * 0.9, y + h, x + w * 0.2, y + h * 0.95); }
      else if (ch === '2') { c.moveTo(x + w * 0.1, y + h * 0.25); c.quadraticCurveTo(x + w * 0.5, y - h * 0.1, x + w * 0.88, y + h * 0.25); c.quadraticCurveTo(x + w * 0.9, y + h * 0.5, x + w * 0.1, y + h); c.lineTo(x + w * 0.92, y + h); }
      else if (ch === '4') { c.moveTo(x + w * 0.7, y + h); c.lineTo(x + w * 0.7, y); c.lineTo(x + w * 0.05, y + h * 0.68); c.lineTo(x + w * 0.95, y + h * 0.68); }
      else if (ch === '6') { c.ellipse(x + w * 0.5, y + h * 0.7, w * 0.42, h * 0.3, 0, 0, TAU); c.moveTo(x + w * 0.08, y + h * 0.7); c.quadraticCurveTo(x + w * 0.1, y, x + w * 0.85, y + h * 0.05); }
      else if (ch === '0') c.ellipse(x + w * 0.5, y + h * 0.5, w * 0.42, h * 0.5, 0, 0, TAU);
      c.stroke(); x += w * 1.18;
    }
  }
  // кубачинская полоса-орнамент (синяя с белыми завитками) — фасад стойки ресепшена
  function paintBand(c, r) {
    const { x, y, w, h } = r; c.fillStyle = NAVY; c.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
    c.fillStyle = '#D8B866'; c.fillRect(x - GAP, y + 2, w + 2 * GAP, 2); c.fillRect(x - GAP, y + h - 4, w + 2 * GAP, 2);
    c.strokeStyle = '#F2EEE6'; c.lineWidth = 1.6; const p = h * 1.1, cy = y + h / 2;
    for (let i = -1; i < w / p + 1; i++) { const x0 = x + i * p; c.beginPath(); c.moveTo(x0, cy); c.bezierCurveTo(x0 + p * 0.25, cy - h * 0.36, x0 + p * 0.5, cy - h * 0.36, x0 + p * 0.5, cy); c.bezierCurveTo(x0 + p * 0.5, cy + h * 0.36, x0 + p * 0.75, cy + h * 0.36, x0 + p, cy); c.stroke();
      c.beginPath(); c.arc(x0 + p * 0.3, cy - h * 0.08, h * 0.12, 0, PI * 1.5); c.stroke(); c.beginPath(); c.arc(x0 + p * 0.8, cy + h * 0.08, h * 0.12, PI, PI * 2.5); c.stroke(); }
  }

  /* =====================================================================
     СЕРЕБРО: материал (по желанию корпуса) — matcap «полированное серебро» с цветом вершин (чернь, позолота), без света сцены
     ===================================================================== */
  function silverMat(T, o = {}) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    // «полированное серебро»: светлое небо сверху, узкая тёмная полоса горизонта, тёплый пол снизу, острый блик и светлый
    // ободок (была мягкая серая шапка — с цветом вершин серебро читалось матовым оловом)
    let g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.26, '#F0F3F7'); g.addColorStop(0.44, '#C3CAD4'); g.addColorStop(0.5, '#4A515B'); g.addColorStop(0.55, '#3A4049');
    g.addColorStop(0.62, '#7F8893'); g.addColorStop(0.8, '#CFC9BC'); g.addColorStop(1, '#EEE8DA');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    g = c.createRadialGradient(44, 38, 1, 44, 38, 30); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    g = c.createRadialGradient(42, 36, 0, 42, 36, 9); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    g = c.createRadialGradient(64, 64, 44, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(240,244,250,0.3)'); g.addColorStop(1, 'rgba(252,253,255,0.9)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(cv); if (o.keep) o.keep(t);
    const m = new T.MeshMatcapMaterial({ matcap: t, vertexColors: true }); m.userData.dn = 'none'; if (o.keep) o.keep(m);
    return m;
  }

  /* =====================================================================
     НАЧИНКА
     ctx: { THREE, K, F, FL, bakers: { ib, gl, glow, sv }, C, rgb, mul, mix, S, named, season, HI, FAR, rng, signCanvas }
     ===================================================================== */
  function furnish(ctx) {
    const T = ctx.THREE || window.THREE, K = ctx.K, F = ctx.F;
    const out = { colliders: [], cam: [], lamps: [], meshes: [], npcSlots: { owl: null, masters: [], desk: null }, spots: [], stats: { tris: 0 } };
    if (!T || !K || !F || ctx.FAR) return out;
    const FL = ctx.FL !== undefined ? ctx.FL : FL0, HC = FL + SPEC.HC, HVc = FL + SPEC.HV, OY = F.oy || 0, HI = !!ctx.HI, named = ctx.named !== false;
    const BK = ctx.bakers || {}, ib = BK.ib || new K.Baker('vc'), gl = BK.gl || ib, glow = BK.glow || ib, sv = BK.sv || ib;
    const uniq = [...new Set([ib, gl, glow, sv])], tri0 = uniq.map(b => b.count());
    const R = mulberry(0x6B0B1A), now = () => (window.performance || Date).now(), tA = now();
    const SEG = HI ? 10 : 7, SEGS = HI ? 8 : 6;   // грани серебра: крупное / мелкое на полках
    // модуль вывески: ctx.signCanvas, иначе глобальный window.kombinatSignCanvas (если загружен); false — не брать (свои запасные рисунки)
    const signCv = ctx.signCanvas === false ? null : typeof ctx.signCanvas === 'function' ? ctx.signCanvas : (typeof window.kombinatSignCanvas === 'function' ? window.kombinatSignCanvas : null);
    const RM = SPEC.rooms, OP = SPEC.open, X0 = RM.C.x0, X1 = RM.C.x1, CZ0 = RM.C.z0, CZ1 = RM.C.z1, CZm = (CZ0 + CZ1) / 2;
    const lamp = (x, y, z) => out.lamps.push([+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)]);
    const coll = (x0, x1, z0, z1, y0, y1, id, o = {}) => { const c = Object.assign({ type: 'box', lx: +((x0 + x1) / 2).toFixed(3), lz: +((z0 + z1) / 2).toFixed(3), w: +(x1 - x0).toFixed(3), d: +(z1 - z0).toFixed(3), y0: +(y0 + OY).toFixed(3), y1: +(y1 + OY).toFixed(3), id }, o.stand === undefined ? { stand: false } : { stand: o.stand }); out.colliders.push(c); if (o.cam) out.cam.push(Object.assign({}, c, { id: 'cam' + id[0].toUpperCase() + id.slice(1) })); return c; };
    const collC = (x, z, r, y0, y1, id) => out.colliders.push({ type: 'circle', lx: +x.toFixed(3), lz: +z.toFixed(3), r, y0: +(y0 + OY).toFixed(3), y1: +(y1 + OY).toFixed(3), id, stand: false });

    /* ---------- палитра (альбедо: свет корпус посчитает сам — запечённый «дневной» в зале, тун на high) ---------- */
    const P = {
      blue: hex('#3B9FC2'), blueD: hex('#2C86A8'), door: hex('#3194B8'), doorP: hex('#38A0C4'), casing: hex('#2F8FB3'), white: hex('#F2F0EB'),
      lam: ['#A9AAA6', '#A4A5A1', '#AEAFAB', '#A0A19D', '#A7A8A4'].map(hex), parq: ['#C58B53', '#BF854F', '#CA915A', '#C18851', '#BB824C'].map(hex),
      wood: hex('#9A6B45'), woodL: hex('#B98A5C'), woodD: hex('#6E4A30'), frameW: hex('#B8784A'), black: hex('#2A2A2E'), gold: hex('#C9A55A'),
      steel: hex('#9AA0A6'), steelD: hex('#6E747B'), bordo: hex('#7A2436'), bordoD: hex('#5A1A28'), backP: hex('#E4E1DA'), plinth: hex('#8A5D3B'),
      tileW: ['#D0CCC2', '#C8C3B8'].map(hex), lino: ['#C9AF8B', '#C2A784'].map(hex), glowSoft: hex('#FFF0D2'), tileL: ['#DCD6CB', '#D3CCC0'].map(hex), gran: ['#8F8B86', '#868179', '#97928C'].map(hex),
      sage: hex('#A8C0B6'), sageD: hex('#8FAA9F'), glowW: hex('#FFF4DE'), glowWarm: hex('#FFE2A8'), green: hex('#4F8A45'), greenD: hex('#3B6E36'),
      sv: hex('#E6EAEF'), sv2: hex('#D9DEE5'), sv3: hex('#EEF1F4'), svO: hex('#C6CBD3'), velvet: hex('#28304E'), ni: hex('#5A5E69'), gi: hex('#E0BE68'), inr: hex('#5A5D64'), cu: hex('#C27A4E'), cuD: hex('#9A5A36'),
      paper: hex('#F3EFE6'), card: hex('#B88E62'), navy: hex(NAVY), red: hex('#B5332E'),
    };
    const svC = () => [P.sv, P.sv2, P.sv3, P.sv, P.svO][Math.floor(R() * 5)];

    /* ---------- помощники в рамке Fr ---------- */
    function kit(Fr) {
      const wp = (x, y, z) => Fr.p(x, y, z);
      // четырёхугольник по 4 локальным точкам лицом к локальной нормали n; cols — цвет или 4 цвета по точкам
      const q4 = (bk, pts, n, cols) => {
        const w = pts.map(p => wp(p[0], p[1], p[2])), nw = nrm(wdir(Fr, n));
        const cr = cross([w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]], [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]]);
        const c4 = Array.isArray(cols[0]) ? cols : [cols, cols, cols, cols];
        if (dot(cr, nw) < 0) bk.quad(w[0], w[3], w[2], w[1], [c4[0], c4[3], c4[2], c4[1]], FLAT, null, nw); else bk.quad(w[0], w[1], w[2], w[3], c4, FLAT, null, nw);
      };
      return {
        Fr, wp, q4,
        box: (bk, x0, x1, y0, y1, z0, z1, col, o) => bk.box(Fr, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o ? Object.assign({ col }, o) : { col }),
        fz: (bk, x0, x1, y0, y1, z, dir, cols) => q4(bk, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, dir], cols),
        fx: (bk, z0, z1, y0, y1, x, dir, cols) => q4(bk, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [dir, 0, 0], cols),
        fy: (bk, x0, x1, z0, z1, y, dir, cols) => q4(bk, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, dir, 0], cols),
        cyl: (bk, x, y0, z, r0, r1, h, o) => { const p = wp(x, y0, z); bk.cyl(p[0], p[1], p[2], r0, r1, h, o); },
        sph: (bk, x, y, z, rx, ry, rz, col, o) => { const p = wp(x, y, z); bk.sph(p[0], p[1], p[2], rx, ry, rz, col, o); },
        lathe: (bk, b, ax, prof, o) => lathe(bk, Fr, b, ax, prof, o),
        sweep: (bk, pts, r, sides, bn, col) => sweep(bk, Fr, pts, r, sides, bn, col),
        sub: (x, z, rot) => new K.Frame(...Fr.p(x, 0, z), Fr.ry + (rot || 0)),
      };
    }
    const G = kit(F);
    // светлый потолок поверх корпусного (как на фото — белый, залит светом ламп): нормаль «вверх», чтобы запечённый свет
    // (litIn у корпуса) и тун на high считали его освещённым, а не тёмной изнанкой
    const ceilP = (x0, x1, z0, z1, y, col) => { const n0 = ib.n; G.fy(ib, x0, x1, z0, z1, y, -1, col || hex('#E2E2DE')); for (let i = n0; i < ib.n; i++) { ib.N[i * 3] = 0; ib.N[i * 3 + 1] = 1; ib.N[i * 3 + 2] = 0; } };

    /* ---------- атлас ---------- */
    const [acv, ac] = K.cnv(AW, AH);
    ac.fillStyle = '#EEEAE2'; ac.fillRect(0, 0, AW, AH);
    const RECT = {};
    { let x = GAP, y = GAP, rowH = 0; const add = (id, w, h) => { if (x + w + GAP > AW) { x = GAP; y += rowH + 2 * GAP; rowH = 0; } RECT[id] = { x, y, w, h }; x += w + 2 * GAP; rowH = Math.max(rowH, h); if (y + h + GAP > AH) console.warn('kombinat_in: атлас переполнен', id); };
      add('rug', 160, 280); add('emb', 256, 256); add('wp0', 150, 210); add('wp1', 150, 210); add('runner', 160, 144); add('clock', 64, 64);
      add('hist', 320, 200); ['pa0', 'pa1', 'pa2'].forEach(id => add(id, 200, 150));
      add('pa3', 200, 150); add('vst', 200, 150); for (let i = 0; i < 4; i++) add('sk' + i, 120, 150);
      for (let i = 0; i < 8; i++) add('por' + i, 104, 136);
      add('band', 256, 32);
      SPEC.doors.forEach((d, i) => add('plq' + i, 128, 40)); ['plqM', 'plqW', 'plqJ'].forEach(id => add(id, 128, 40)); }
    const MASTERS = ['badger', 'owl', 'hedgehog', 'fox', 'bear', 'ram', 'hare', 'raccoon'];
    MASTERS.forEach((k, i) => paintPhoto(ac, RECT['por' + i], k, R));
    for (let i = 0; i < 4; i++) { paintSketch(ac, RECT['sk' + i], i, R); paintPicture(ac, RECT['pa' + i], i, R); }
    paintRug(ac, RECT.rug, R); paintRunner(ac, RECT.runner); paintBand(ac, RECT.band);
    // таблички: модуль вывески (kind 'plaque') или свой запасной вид — синяя пластина с латунной рамкой и «строкой»
    // шрифт игры (Nunito) может догрузиться позже: модуль вывески перерисует табличку и позовёт onUpdate — копируем заново в атлас
    let artMap = null;
    const plaque = (id, text) => { const r = RECT[id]; let cv = null; const put = c => { ac.clearRect(r.x, r.y, r.w, r.h); ac.fillStyle = '#EEEAE2'; ac.fillRect(r.x, r.y, r.w, r.h); ac.drawImage(c, r.x, r.y, r.w, r.h); if (artMap) artMap.needsUpdate = true; };
      try { cv = signCv ? signCv({ kind: 'plaque', text, width: 256, height: 80, named, onUpdate: put }) : null; } catch (e) { cv = null; }
      if (cv && cv.width) { ac.drawImage(cv, r.x, r.y, r.w, r.h); return; }
      rr(ac, r.x, r.y, r.w, r.h, 4); ac.fillStyle = '#C9A55A'; ac.fill(); rr(ac, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 3); ac.fillStyle = '#1F3C78'; ac.fill();
      ac.fillStyle = '#EDE6D2'; const n = Math.max(3, Math.min(11, text.length)); ac.fillRect(r.x + r.w / 2 - n * 4.2, r.y + r.h / 2 - 2, n * 8.4, 4); };
    SPEC.doors.forEach((d, i) => plaque('plq' + i, d.text)); plaque('plqM', 'Музей'); plaque('plqW', 'Цех'); plaque('plqJ', 'Кувшин мастера');
    // эмблема: модуль вывески (kind 'emblem', стиль 'light' — как на logo.png, для тёмного фона) на синем поле; без модуля — своя
    // розетка индиго на кремовом. (Яркость рисунка не меряем: getImageData с холста на видеокарте — это ≈ 0,7 с на слабом телефоне)
    let embBg = '#F2EEE6';
    { const r = RECT.emb; let cv = null; try { cv = signCv ? signCv({ kind: 'emblem', style: 'light', width: 512, height: 512, named }) : null; } catch (e) { cv = null; }
      if (cv && cv.width) { embBg = '#24376E'; ac.fillStyle = embBg; ac.fillRect(r.x - GAP, r.y - GAP, r.w + 2 * GAP, r.h + 2 * GAP); ac.drawImage(cv, r.x + 8, r.y + 8, r.w - 16, r.h - 16); }
      else { ac.fillStyle = embBg; ac.fillRect(r.x - GAP, r.y - GAP, r.w + 2 * GAP, r.h + 2 * GAP); paintEmblemOwn(ac, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.42, '#2B3F7A', '#E3E5EE'); } }
    // стенд «История комбината»: шапка (табличка модуля вывески или полоса), две колонки — 1924 (артель) и 1960 (комбинат)
    { const r = RECT.hist, { x, y, w, h } = r; ac.fillStyle = CREAM; ac.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP);
      ac.fillStyle = NAVY; ac.fillRect(x, y, w, 34); let hc = null; const hput = c => { ac.fillStyle = NAVY; ac.fillRect(x + w / 2 - 94, y + 2, 188, 30); ac.drawImage(c, x + w / 2 - 92, y + 3, 184, 28); if (artMap) artMap.needsUpdate = true; };
      try { hc = signCv ? signCv({ kind: 'plaque', text: 'История комбината', width: 512, height: 80, named, onUpdate: hput }) : null; } catch (e) { hc = null; }
      if (hc && hc.width) ac.drawImage(hc, x + w / 2 - 92, y + 3, 184, 28); else { ac.fillStyle = '#EDE6D2'; ac.fillRect(x + w / 2 - 70, y + 14, 140, 6); }
      ac.drawImage(acv, RECT.emb.x, RECT.emb.y, RECT.emb.w, RECT.emb.h, x + 6, y + 3, 28, 28);
      ac.strokeStyle = NAVY; ac.lineWidth = 2; ac.beginPath(); ac.moveTo(x + 20, y + 62); ac.lineTo(x + w - 20, y + 62); ac.stroke(); [x + 20, x + w / 2 + 6, x + w - 20].forEach(px => { ac.beginPath(); ac.arc(px, y + 62, 4, 0, TAU); ac.fillStyle = NAVY; ac.fill(); });
      digits(ac, '1924', x + 18, y + 40, 16, NAVY, 2.4); digits(ac, '1960', x + w / 2 + 12, y + 40, 16, NAVY, 2.4);
      // сепия-«фото»: артель (три зверя-мастера) и корпус комбината
      const sep = (px, py, pw, ph) => { const g = ac.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, SEP.bg0); g.addColorStop(1, SEP.bg1); ac.fillStyle = g; ac.fillRect(px, py, pw, ph); ac.strokeStyle = '#FFFFFF'; ac.lineWidth = 3; ac.strokeRect(px, py, pw, ph); };
      sep(x + 16, y + 74, 128, 70); ac.save(); ac.beginPath(); ac.rect(x + 16, y + 74, 128, 70); ac.clip(); ['bear', 'badger', 'fox'].forEach((k, i) => bust(ac, k, x + 40 + i * 40, y + 100, 9, SEP)); ac.restore();
      sep(x + w / 2 + 8, y + 74, 136, 70); { const bx = x + w / 2 + 22, by = y + 136; ac.fillStyle = '#B49A72'; ac.fillRect(bx, by - 48, 108, 48); ac.fillStyle = '#E9DFC8'; ac.fillRect(bx + 10, by - 56, 88, 22); ac.fillStyle = '#7C6449'; for (let i = 0; i < 7; i++) { ac.fillRect(bx + 6 + i * 15, by - 26, 8, 10); } ac.fillRect(bx + 72, by - 14, 12, 14); ac.fillStyle = '#C9B48E'; ac.fillRect(bx + 66, by - 18, 30, 18); }
      lines(ac, x + 16, y + 154, 128, 4, 10, 'rgba(60,60,70,0.55)', R); lines(ac, x + w / 2 + 8, y + 154, 136, 4, 10, 'rgba(60,60,70,0.55)', R); }
    // стенд в тамбуре: выставка — синяя рамка, кувшин, «текст» и часы работы
    { const r = RECT.vst, { x, y, w, h } = r; ac.fillStyle = '#FBFAF6'; ac.fillRect(x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP); ac.strokeStyle = NAVY; ac.lineWidth = 5; ac.strokeRect(x + 5, y + 5, w - 10, h - 10); ac.lineWidth = 1.5; ac.strokeRect(x + 11, y + 11, w - 22, h - 22);
      for (let i = 0; i < 4; i++) { const cx = [x + 11, x + w - 11][i % 2], cy = [y + 11, y + h - 11][i >> 1]; ac.beginPath(); ac.arc(cx, cy, 7, 0, TAU); ac.fillStyle = NAVY; ac.fill(); }
      const jx = x + w * 0.28, jb = y + h * 0.84, H = h * 0.58, pr = [[0.14, 0], [0.24, 0.22], [0.27, 0.4], [0.2, 0.58], [0.1, 0.74], [0.09, 0.84], [0.14, 1]];
      ac.beginPath(); pr.forEach((p, i) => (i ? ac.lineTo(jx - p[0] * H, jb - p[1] * H) : ac.moveTo(jx - p[0] * H, jb - p[1] * H))); for (let i = pr.length - 1; i >= 0; i--) ac.lineTo(jx + pr[i][0] * H, jb - pr[i][1] * H); ac.closePath();
      const g = ac.createLinearGradient(jx - 0.27 * H, 0, jx + 0.27 * H, 0); g.addColorStop(0, '#6E737B'); g.addColorStop(0.4, '#EEF1F4'); g.addColorStop(1, '#7A8088'); ac.fillStyle = g; ac.fill();
      ac.fillStyle = NAVY; ac.fillRect(x + w * 0.5, y + h * 0.2, w * 0.38, 7); lines(ac, x + w * 0.5, y + h * 0.34, w * 0.38, 4, 9, 'rgba(50,55,70,0.6)', R);
      ac.strokeStyle = 'rgba(40,50,80,0.5)'; ac.lineWidth = 1; for (let i = 0; i < 4; i++) { ac.beginPath(); ac.moveTo(x + w * 0.5, y + h * 0.7 + i * 7); ac.lineTo(x + w * 0.88, y + h * 0.7 + i * 7); ac.stroke(); } }
    // плакаты цеха: большая ветка-узор и лист образцов-розеток (на кнопках)
    { const pin = (px, py) => { ac.beginPath(); ac.arc(px, py, 3.5, 0, TAU); ac.fillStyle = '#C0392B'; ac.fill(); };
      let r = RECT.wp0; ac.fillStyle = '#F2ECDD'; ac.fillRect(r.x - GAP, r.y - GAP, r.w + 2 * GAP, r.h + 2 * GAP); branch(ac, r.x + r.w / 2, r.y + r.h - 14, r.y + 24, r.w * 0.36, '#1F3270', 2.2); pin(r.x + 8, r.y + 8); pin(r.x + r.w - 8, r.y + 8);
      r = RECT.wp1; ac.fillStyle = '#EEF0EC'; ac.fillRect(r.x - GAP, r.y - GAP, r.w + 2 * GAP, r.h + 2 * GAP);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const cx = r.x + 40 + i * 70, cy = r.y + 40 + j * 64; rosette(ac, cx, cy, 24, j % 2 ? '#1F3270' : '#6B3A2A', 1.4, 6 + (i + j) % 3 * 2); ac.fillStyle = 'rgba(40,40,50,0.5)'; ac.fillRect(cx - 18, cy + 28, 36, 2); }
      pin(r.x + 8, r.y + 8); pin(r.x + r.w - 8, r.y + 8); }
    // циферблат (10:10), фон — белая стена
    { const r = RECT.clock, cx = r.x + r.w / 2, cy = r.y + r.h / 2; ac.fillStyle = '#F2F0EB'; ac.fillRect(r.x - GAP, r.y - GAP, r.w + 2 * GAP, r.h + 2 * GAP);
      ac.beginPath(); ac.arc(cx, cy, 30, 0, TAU); ac.fillStyle = '#FFFFFF'; ac.fill(); ac.lineWidth = 2.5; ac.strokeStyle = '#2A2A2E'; ac.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ac.lineWidth = i % 3 ? 1.2 : 2.4; ac.beginPath(); ac.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ac.lineTo(cx + Math.cos(a) * 27, cy + Math.sin(a) * 27); ac.stroke(); }
      ac.lineCap = 'round'; ac.lineWidth = 3; ac.beginPath(); ac.moveTo(cx, cy); ac.lineTo(cx + Math.cos(-PI / 2 - PI / 6 * 2) * 13, cy + Math.sin(-PI / 2 - PI / 6 * 2) * 13); ac.stroke();
      ac.lineWidth = 2; ac.beginPath(); ac.moveTo(cx, cy); ac.lineTo(cx + Math.cos(-PI / 2 + PI / 3) * 20, cy + Math.sin(-PI / 2 + PI / 3) * 20); ac.stroke(); }

    const tB = now();
    /* ---------- сетка картинок: квады атласа (мировые координаты) ---------- */
    const ART = { P: [], N: [], U: [], C: [], I: [], n: 0 };
    // картинка на вертикальной плоскости: центр (cx, cy, cz) в рамке Fr, лицом к локальной нормали (nx, 0, nz); tint — множитель цвета
    function pic(Fr, cx, cy, cz, nx, nz, w, h, id, tint) {
      const r = RECT[id]; if (!r) return;
      const rt = [nz, 0, -nx], hw = w / 2, hh = h / 2, pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => [cx + rt[0] * a, cy + b, cz + rt[2] * a]);
      artQuad(Fr, pts, [nx, 0, nz], r, tint);
    }
    // картинка, лежащая на горизонтали (эскиз на верстаке, дорожка): центр, размеры вдоль локальных x и z, поворот rot (вокруг y)
    function picFlat(Fr, cx, y, cz, w, d, rot, id, tint) {
      const r = RECT[id]; if (!r) return; const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      const pts = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].map(([a, b]) => [cx + a * c + b * s, y, cz - a * s + b * c]);
      artQuad(Fr, pts, [0, 1, 0], r, tint);
    }
    function artQuad(Fr, pts, nl, r, tint) {
      const u0 = (r.x + 0.5) / AW, u1 = (r.x + r.w - 0.5) / AW, v0 = 1 - (r.y + r.h - 0.5) / AH, v1 = 1 - (r.y + 0.5) / AH, UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      const nw = nrm(wdir(Fr, nl)), col = tint || [1, 1, 1], i0 = ART.n;
      pts.forEach((p, k) => { const w = Fr.p(p[0], p[1], p[2]); ART.P.push(w[0], w[1], w[2]); ART.N.push(nw[0], nw[1], nw[2]); ART.U.push(UV[k][0], UV[k][1]); ART.C.push(col[0], col[1], col[2]); ART.n++; });
      ART.I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
    // рама вокруг картинки на стене: коробка шириной w + 2·f, глубиной dp от стены (wallC — координата стены по нормали)
    function framed(Fr, bk, cx, cy, wallC, nx, nz, w, h, f, dp, col, id, tint) {
      const g = Fr === F ? G : kit(Fr);
      if (nz) { const z0 = nz > 0 ? wallC : wallC - dp, z1 = nz > 0 ? wallC + dp : wallC; g.box(bk, cx - w / 2 - f, cx + w / 2 + f, cy - h / 2 - f, cy + h / 2 + f, z0, z1, col, { skip: nz > 0 ? { nz: 1 } : { pz: 1 } }); pic(Fr, cx, cy, wallC + nz * (dp + 0.004), 0, nz, w, h, id, tint); }
      else { const x0 = nx > 0 ? wallC : wallC - dp, x1 = nx > 0 ? wallC + dp : wallC; g.box(bk, x0, x1, cy - h / 2 - f, cy + h / 2 + f, cx - w / 2 - f, cx + w / 2 + f, col, { skip: nx > 0 ? { nx: 1 } : { px: 1 } }); pic(Fr, wallC + nx * (dp + 0.004), cy, cx, nx, 0, w, h, id, tint); }
    }

    /* =====================================================================
       СЕРЕБРО: предметы. Профили — единичная высота (r в долях высоты), s — высота, м
       ===================================================================== */
    const PR = {
      jug: [[0, 0], [0.15, 0, 'k'], [0.13, 0.06, 'k'], [0.24, 0.25], [0.27, 0.4, 'c', 'NI'], [0.23, 0.53, 'c', 'SV'], [0.1, 0.74], [0.09, 0.84], [0.14, 1.0, 'k', 'IN'], [0, 0.93]],
      // кувшин мастера: широкий пояс черни в позолоченных кантах на тулове, узкий — на горле, позолоченные кромки
      master: [[0, 0], [0.16, 0, 'k'], [0.16, 0.03, 'k', 'GI'], [0.13, 0.065, 'k', 'SV'], [0.19, 0.14], [0.235, 0.235, 'c', 'GI'], [0.245, 0.255, 'c', 'NI'], [0.27, 0.36], [0.265, 0.46, 'c', 'GI'], [0.255, 0.48, 'c', 'SV'],
        [0.13, 0.7], [0.1, 0.77, 'c', 'GI'], [0.095, 0.79, 'c', 'NI'], [0.095, 0.86, 'c', 'GI'], [0.1, 0.88, 'c', 'SV'], [0.14, 0.99], [0.145, 1.0, 'k', 'IN'], [0, 0.93]],
      goblet: [[0, 0], [0.24, 0, 'k'], [0.2, 0.05, 'k'], [0.06, 0.13], [0.05, 0.42, 'c', 'GI'], [0.09, 0.5, 'k', 'SV'], [0.28, 0.63], [0.33, 0.8, 'c', 'NI'], [0.35, 0.9, 'c', 'GI'], [0.35, 1.0, 'k', 'IN'], [0, 0.92]],
      vase: [[0, 0], [0.17, 0, 'k'], [0.13, 0.07, 'k'], [0.24, 0.28], [0.28, 0.42, 'c', 'NI'], [0.24, 0.56, 'c', 'SV'], [0.12, 0.76], [0.1, 0.86], [0.17, 1.0, 'k', 'IN'], [0, 0.95]],
      bowl: [[0, 0], [0.32, 0, 'k'], [0.3, 0.14, 'k'], [0.68, 0.45], [0.92, 0.82, 'c', 'GI'], [1.0, 1.0, 'k'], [0, 0.5, '', 'SV']],
      // блюдо: дно (наружу, лицом вниз) → кромка (позолота) → лицо блюда к середине (лицом вверх): поверхность, которую профиль
      // проходит наружу, смотрит вниз — было наоборот (лицо отбрасывалось, сверху было видно дно вровень с тканью: «дыры»)
      plate: [[0, 0], [0.5, 0], [0.97, 0.03, 'k', 'GI'], [1.0, 0.09, 'k', 'SV'], [0.9, 0.075], [0.6, 0.05, 'c', 'NI'], [0.5, 0.04, 'c', 'SV'], [0.42, 0.02], [0, 0.035]],
      ewer: [[0, 0], [0.13, 0, 'k'], [0.11, 0.05, 'k'], [0.2, 0.18], [0.24, 0.32, 'c', 'NI'], [0.2, 0.46, 'c', 'SV'], [0.09, 0.62], [0.075, 0.78], [0.11, 0.86, 'k', 'GI'], [0.07, 0.93, 'k', 'SV'], [0.025, 0.98], [0, 1.04]],
      cup: [[0, 0], [0.24, 0, 'k'], [0.3, 0.6], [0.34, 1.0, 'k', 'IN'], [0, 0.82]],
    };
    // band: 1 — пояс черни (как в профиле), 0 — гладкое серебро, 2 — пояс позолоты, 3 — «старое» серебро с тёмным поясом
    const prof = (key, base, band = 1) => { const NI = band === 0 ? base : band === 2 ? P.gi : P.ni, PC = { NI, SV: base, GI: P.gi, IN: P.inr };
      return PR[key].map(p => [p[0], p[1], p[2] || '', p[3] ? PC[p[3]] : undefined]); };
    // предмет kind в точке (x, y, z) рамки Fr высотой s; yaw — куда смотрит носик (в рамке Fr); base — основной цвет (серебро/медь)
    function item(Fr, kind, x, y, z, s, yaw, o = {}) {
      yaw = yaw || 0; const g = Fr === F ? G : kit(Fr), base = o.col || svC(), seg = o.seg || SEGS, band = o.band !== undefined ? o.band : [1, 1, 0, 2, 1][Math.floor(R() * 5)], dir = [Math.sin(yaw), 0, Math.cos(yaw)], up = [0, 1, 0];
      const at = (h, r, sd = 1) => [x + dir[0] * r * s * sd, y + h * s, z + dir[2] * r * s * sd];
      const bn = [dir[2], 0, -dir[0]];
      if (kind === 'jug' || kind === 'ewer' || kind === 'copper') {
        const ew = kind === 'ewer', pk = ew ? 'ewer' : o.master ? 'master' : 'jug';
        g.lathe(sv, [x, y, z], up, prof(pk, base, band), { seg, s, col: base, a0: yaw });
        // носик: прямая конусная трубка от плеча вверх-наружу
        const s0 = ew ? at(0.26, 0.18) : at(0.62, 0.15), ax = ew ? [dir[0] * 0.42, 0.9, dir[2] * 0.42] : [dir[0] * 0.62, 0.78, dir[2] * 0.62];
        g.lathe(sv, s0, ax, ew ? [[0.035, 0], [0.014, 0.66]] : [[0.05, 0], [0.024, 0.34]], { seg: 5, s, col: base });
        // ручка: дуга с обратной стороны
        const hp = ew ? [[0.84, 0.07], [0.92, 0.2], [0.8, 0.3], [0.56, 0.3], [0.38, 0.2]] : [[0.82, 0.08], [0.9, 0.2], [0.78, 0.31], [0.58, 0.32], [0.44, 0.25]];
        g.sweep(sv, hp.map(([h, r]) => at(h, r, -1)), 0.022 * s, 4, bn, base);
        if (o.lid) { g.lathe(sv, at(1.0, 0), up, [[0.135, 0], [0.12, 0.05], [0.04, 0.1], [0.05, 0.16], [0, 0.2]], { seg, s, col: P.gi }); }
      } else if (kind === 'goblet') {
        g.lathe(sv, [x, y, z], up, prof('goblet', base, band), { seg, s, col: base, a0: yaw });
        if (o.lid) g.lathe(sv, [x, y + s, z], up, [[0.36, 0], [0.3, 0.1], [0.08, 0.2], [0.06, 0.26], [0.09, 0.3], [0, 0.36]], { seg, s, col: base });
      } else if (kind === 'vase' || kind === 'cup' || kind === 'bowl') {
        g.lathe(sv, [x, y, z], up, prof(kind, base, band), { seg: kind === 'bowl' ? seg + 2 : seg, s: kind === 'bowl' ? s * 0.42 : s, col: base, a0: yaw });
      } else if (kind === 'plateS') {   // блюдо стоймя на подставке: лицом к dir, чуть откинуто назад; подставка — планка и упор
        const R0 = s * 0.5, SF = new K.Frame(...Fr.p(x, 0, z), Fr.ry + yaw), sg = kit(SF);
        sg.lathe(sv, [0, y + R0 + 0.012, -0.02], [0, 0.26, 0.97], prof('plate', base, band), { seg: seg + 3, s: R0, col: base });
        sg.box(ib, -R0 * 0.45, R0 * 0.45, y, y + 0.018, -0.03, 0.03, P.steelD); sg.box(ib, -0.008, 0.008, y, y + R0 * 1.15, -0.09, -0.074, P.steelD);
      } else if (kind === 'plate') {   // лежит
        g.lathe(sv, [x, y + 0.002, z], up, prof('plate', base, band), { seg: seg + 3, s: s * 0.5, col: base, sq: [1, 1] });   // на 2 мм над тканью
      } else if (kind === 'casket') {   // шкатулка: короб, пояс черни, крышка, шишечка
        const SF = new K.Frame(...Fr.p(x, 0, z), Fr.ry + yaw), w = s * 1.3, d = s * 0.9, h = s * 0.55;
        sv.box(SF, 0, y + h / 2, 0, w, h, d, { col: base, skip: { ny: 1 } }); sv.box(SF, 0, y + h * 0.55, 0, w + 0.006, h * 0.22, d + 0.006, { col: P.ni, skip: { ny: 1, py: 1 } });
        sv.box(SF, 0, y + h + 0.012, 0, w + 0.012, 0.024, d + 0.012, { col: P.gi }); sv.box(SF, 0, y + h + 0.03, 0, w * 0.8, 0.014, d * 0.75, { col: base, skip: { ny: 1 } });
        const kp = SF.p(0, y + h + 0.05, 0); sv.sph(kp[0], kp[1], kp[2], 0.012, 0.012, 0.012, P.gi, { seg: 5, rings: 3 });
      } else if (kind === 'dagger') {   // кинжал в ножнах, лежит; dir — вдоль клинка
        const L = s, b = [x - dir[0] * L * 0.3, y + 0.036 * L * 0.42, z - dir[2] * L * 0.3];
        g.lathe(sv, b, dir, [[0.032, 0], [0.036, 0.1], [0.028, 0.72], [0.012, 0.8], [0, 0.82]], { seg: 6, s: L, col: base, sq: [0.4, 1], u: [0, 1, 0] });
        g.lathe(sv, b, [-dir[0], 0, -dir[2]], [[0.06, 0], [0.06, 0.014, 'k'], [0.022, 0.018, 'k', P.ni], [0.024, 0.18], [0.04, 0.2, 'k', P.gi], [0, 0.22]], { seg: 6, s: L, col: base, sq: [0.55, 1], u: [0, 1, 0] });
      } else if (kind === 'belt') {   // пояс: тёмный ремешок и серебряные бляхи (вдоль dir)
        const L = s, n = 7, SF = new K.Frame(...Fr.p(x, 0, z), Fr.ry + yaw);
        ib.box(SF, 0, y + 0.003, 0, 0.026, 0.006, L * 1.12, { col: hex('#3A2A22'), skip: { ny: 1 } });
        for (let i = 0; i < n; i++) sv.box(SF, 0, y + 0.009, (i / (n - 1) - 0.5) * L, 0.055, 0.012, 0.062, { col: i % 3 === 1 ? P.gi : base, skip: { ny: 1 } });
      } else if (kind === 'bracelet') {
        const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU; pts.push([x + Math.cos(a) * s, y + 0.012, z + Math.sin(a) * s]); }
        g.sweep(sv, pts, 0.012, 3, [0, 1, 0], o.col || P.gi);
      }
    }
    // случайный набор для полки: высота доступная h, ширина w; → [{ kind, s, w(занимает) }]
    const KINDS = ['jug', 'goblet', 'vase', 'ewer', 'plateS', 'casket', 'cup', 'bowl', 'jug', 'vase', 'goblet', 'copper'];
    function shelfSet(w, h) {
      const L = []; let used = 0, tries = 0;
      while (tries++ < 12) {
        const k = KINDS[Math.floor(R() * KINDS.length)], hh = Math.min(h * (0.62 + R() * 0.3), k === 'cup' ? 0.13 : k === 'casket' ? 0.12 : k === 'bowl' ? 0.3 : k === 'plateS' ? 0.34 : 0.36);
        const ww = k === 'plateS' ? hh * 0.75 : k === 'bowl' ? hh * 0.9 : k === 'casket' ? hh * 1.5 : k === 'goblet' ? hh * 0.75 : k === 'vase' || k === 'cup' ? hh * 0.62 : hh * 0.72;
        if (used + ww + 0.025 > w) break; L.push({ k, s: hh, w: ww }); used += ww + 0.025;
      }
      return L;
    }

    /* =====================================================================
       1. КОРИДОР (фото: синий низ ≈ 1,5 м, белый верх, синие двери и наличники, ряд «фото» мастеров, кабель-каналы, шары-лампы, ламинат)
       ===================================================================== */
    const PH = FL + 1.5, LAMPX = [-10.6, -6.4, -2.2, 2.0, 6.2, 10.4];
    // ламинат «под дерево»: доски 1,38 × 0,185 вдоль коридора вразбежку; под лампами светлее — «блик» натёртого пола (как на фото)
    const shine = (x, z) => { let k = 0; LAMPX.forEach(lx => { k += Math.exp(-(((x - lx) / 1.4) ** 2)); }); return 1 + 0.13 * Math.min(1, k) * Math.exp(-(((z - CZm) / 0.7) ** 2)); };
    G.fy(ib, X0, X1, CZ0, CZ1, FL + 0.004, 1, hex('#A5A6A2'));   // подложка: в щелях Т-стыков досок (вразбежку) иначе мелькала земля под зданием
    { const pw = (CZ1 - CZ0) / 13, pl = 1.38;
      for (let j = 0; j < 13; j++) { const z0 = CZ0 + j * pw, z1 = z0 + pw, off = ((j * 5) % 7) / 7 * pl;
        for (let x0 = X0 - off, n = 0; x0 < X1; x0 += pl, n++) { const a = Math.max(X0, x0), b = Math.min(X1, x0 + pl); if (b - a < 0.02) continue;
          const t = P.lam[(j * 3 + n * 2) % P.lam.length], cf = (x, z) => mulC(t, shine(x, z));
          G.fy(ib, a, b, z0, z1, FL + 0.006, 1, [cf(a, z0), cf(b, z0), cf(b, z1), cf(a, z1)]); } } }
    // пороги в проёмах (серый металл)
    [[OP.museum.x0, OP.museum.x1, OP.museum.z0, OP.museum.z1], [OP.work.x0, OP.work.x1, OP.work.z0, OP.work.z1], [OP.lobby.x0, OP.lobby.x1, OP.lobby.z0, OP.lobby.z1], [OP.vest.x0, OP.vest.x1, OP.vest.z0, OP.vest.z1], [OP.auto.x0, OP.auto.x1, OP.auto.z0, OP.auto.z0 + 0.15]]
      .forEach(([x0, x1, z0, z1]) => G.fy(ib, x0, x1, z0 - 0.01, z1 + 0.01, FL + 0.01, 1, hex('#A4A6A4')));
    // стены коридора: синяя панель (у пола темнее), кант, белый верх (до потолка) — пластины в 1,2 см от стен, проёмы пропущены
    const blueC = () => [mulC(P.blue, 0.9), mulC(P.blue, 0.9), P.blue, P.blue];
    const wallZ = (segs, z, dir, opens) => {
      segs.forEach(([a, b]) => { G.fz(ib, a, b, FL, PH, z, dir, blueC()); G.fz(ib, a, b, PH - 0.03, PH, z + dir * 0.003, dir, P.blueD); G.fz(ib, a, b, PH, HC, z, dir, P.white); });
      opens.forEach(([a, b, h]) => G.fz(ib, a, b, FL + h, HC, z, dir, P.white));
    };
    wallZ([[X0, OP.museum.x0], [OP.museum.x1, OP.work.x0], [OP.work.x1, X1]], CZ0 + 0.012, 1, [[OP.museum.x0, OP.museum.x1, OP.museum.h], [OP.work.x0, OP.work.x1, OP.work.h]]);
    wallZ([[X0, OP.lobby.x0], [OP.lobby.x1, X1]], CZ1 - 0.012, -1, [[OP.lobby.x0, OP.lobby.x1, OP.lobby.h]]);
    [[X0 + 0.012, 1], [X1 - 0.012, -1]].forEach(([x, d]) => { G.fx(ib, CZ0, CZ1, FL, PH, x, d, blueC()); G.fx(ib, CZ0, CZ1, PH - 0.03, PH, x + d * 0.003, d, P.blueD); G.fx(ib, CZ0, CZ1, PH, HC, x, d, P.white); });
    // плинтус (тёмно-синий, у ламината)
    [[X0, OP.museum.x0], [OP.museum.x1, OP.work.x0], [OP.work.x1, X1]].forEach(([a, b]) => G.box(ib, a, b, FL, FL + 0.07, CZ0, CZ0 + 0.025, P.blueD, { skip: { nz: 1, ny: 1 } }));
    [[X0, OP.lobby.x0], [OP.lobby.x1, X1]].forEach(([a, b]) => G.box(ib, a, b, FL, FL + 0.07, CZ1 - 0.025, CZ1, P.blueD, { skip: { pz: 1, ny: 1 } }));

    // --- двери: полотно, филёнка, наличник, фрамуга со стеклом, ручка, табличка. Рамка двери D: z = 0 — плоскость стены, +z — в помещение
    function door(D, w, h, o = {}) {
      const g = kit(D), col = o.col || P.door, cas = o.cas || P.casing, ht = o.tr ? h + 0.58 : h;
      g.box(ib, -w / 2, w / 2, FL, FL + h, 0.004, 0.04, col, { skip: { nz: 1 } });
      g.fz(ib, -w / 2 + 0.11, w / 2 - 0.11, FL + 0.22, FL + h - 0.32, 0.043, 1, o.pan || P.doorP);
      g.fz(ib, -w / 2 + 0.14, w / 2 - 0.14, FL + 0.25, FL + h - 0.35, 0.046, 1, mixC(o.pan || P.doorP, col, 0.45));
      // o.niche — дверь коридора в глубокой нише, как на фото: синие откосы-косяки 0,14 м в коридор, полотно — в глубине
      const jw = o.niche ? 0.1 : 0.08, jd = o.niche ? 0.14 : 0.028;
      g.box(ib, -w / 2 - jw, -w / 2, FL, FL + ht + jw, 0, jd, cas, { skip: { nz: 1 } }); g.box(ib, w / 2, w / 2 + jw, FL, FL + ht + jw, 0, jd, cas, { skip: { nz: 1 } });
      g.box(ib, -w / 2 - jw, w / 2 + jw, FL + ht, FL + ht + jw, 0, jd, cas, { skip: { nz: 1 } });
      if (o.tr) { g.box(ib, -w / 2, w / 2, FL + h, FL + h + 0.06, 0, 0.032, cas, { skip: { nz: 1 } });
        g.fz(ib, -w / 2 + 0.02, w / 2 - 0.02, FL + h + 0.06, FL + ht, 0.019, 1, [hex('#7FA3B4'), hex('#7FA3B4'), hex('#C9DCE4'), hex('#C9DCE4')]);
        g.box(ib, -0.012, 0.012, FL + h + 0.06, FL + ht, 0.01, 0.03, cas); }
      const hx = o.hinge === 'R' ? -w / 2 + 0.1 : w / 2 - 0.1, hd = o.hinge === 'R' ? 1 : -1;
      g.box(ib, hx - 0.02, hx + 0.02, FL + 0.93, FL + 1.07, 0.04, 0.05, P.steelD); g.box(ib, Math.min(hx, hx + hd * 0.12), Math.max(hx, hx + hd * 0.12), FL + 1.0, FL + 1.025, 0.05, 0.075, hex('#C9C9C4'));
      if (o.plq) pic(D, 0, FL + 1.62, 0.05, 0, 1, 0.3, 0.094, o.plq);
    }
    const dFrame = (wall, a) => wall === 'S' ? G.sub(a, CZ1, PI) : wall === 'N' ? G.sub(a, CZ0, 0) : wall === 'W' ? G.sub(X0, a, PI / 2) : G.sub(X1, a, -PI / 2);
    SPEC.doors.forEach((d, i) => {
      const a = d.x !== undefined ? d.x : d.z;
      door(dFrame(d.wall, a), 0.9, 2.1, { tr: d.tr, plq: 'plq' + i, hinge: i % 2 ? 'R' : 'L', niche: true });
      // косяки ниши выступают в коридор на 0,14 м — коллайдер (полотно в глубине — за ним)
      if (d.wall === 'S') coll(a - 0.55, a + 0.55, CZ1 - 0.14, CZ1, FL - 0.5, FL + 2.3, 'kmbDoorJamb');
      else if (d.wall === 'N') coll(a - 0.55, a + 0.55, CZ0, CZ0 + 0.14, FL - 0.5, FL + 2.3, 'kmbDoorJamb');
      else if (d.wall === 'W') coll(X0, X0 + 0.14, a - 0.55, a + 0.55, FL - 0.5, FL + 2.3, 'kmbDoorJamb');
      else coll(X1 - 0.14, X1, a - 0.55, a + 0.55, FL - 0.5, FL + 2.3, 'kmbDoorJamb');
      if (d.back === 'M') door(G.sub(a, RM.M.z1, PI), 0.9, 2.1, { col: hex('#E8E4DC'), pan: hex('#F1EEE8'), cas: hex('#D9D4CA'), hinge: 'R' });
      if (d.back === 'Wk') door(G.sub(a, RM.Wk.z1, PI), 0.9, 2.1, { col: hex('#8FA89E'), pan: hex('#9DB5AB'), cas: hex('#7E978D'), hinge: 'L' });
    });
    // наличники открытых проёмов (обе стороны) и фрамуга над входом в музей
    function portal(D, x0, x1, h, col, w = 0.09, d = 0.03) { const g = kit(D); g.box(ib, x0 - w, x0, FL, FL + h + w, 0, d, col, { skip: { nz: 1 } }); g.box(ib, x1, x1 + w, FL, FL + h + w, 0, d, col, { skip: { nz: 1 } }); g.box(ib, x0 - w, x1 + w, FL + h, FL + h + w, 0, d, col, { skip: { nz: 1 } }); }
    { const mx = (OP.museum.x0 + OP.museum.x1) / 2, mw = OP.museum.x1 - OP.museum.x0, th = OP.museum.transom, hh = OP.museum.h;
      [[G.sub(mx, CZ0, 0), P.casing], [G.sub(mx, RM.M.z1, PI), hex('#D9D4CA')]].forEach(([D, col]) => { const g = kit(D);
        portal(D, -mw / 2, mw / 2, hh + th + 0.04, col);
        g.box(ib, -mw / 2, mw / 2, FL + hh, FL + hh + 0.06, 0, 0.032, col, { skip: { nz: 1 } });
        g.fz(ib, -mw / 2 + 0.02, mw / 2 - 0.02, FL + hh + 0.06, FL + hh + th + 0.04, 0.019, 1, [hex('#86A9BA'), hex('#86A9BA'), hex('#D2E2E9'), hex('#D2E2E9')]);
        [-mw / 6, mw / 6].forEach(x => g.box(ib, x - 0.012, x + 0.012, FL + hh + 0.06, FL + hh + th + 0.04, 0.012, 0.03, col)); });
      const wx = (OP.work.x0 + OP.work.x1) / 2, ww = OP.work.x1 - OP.work.x0;
      portal(G.sub(wx, CZ0, 0), -ww / 2, ww / 2, OP.work.h, P.casing); portal(G.sub(wx, RM.Wk.z1, PI), -ww / 2, ww / 2, OP.work.h, hex('#7E978D'));
      const lx = (OP.lobby.x0 + OP.lobby.x1) / 2, lw = OP.lobby.x1 - OP.lobby.x0;
      portal(G.sub(lx, CZ1, PI), -lw / 2, lw / 2, OP.lobby.h, P.casing); portal(G.sub(lx, RM.L.z0, 0), -lw / 2, lw / 2, OP.lobby.h, P.woodL, 0.08, 0.03);
      const vx = (OP.vest.x0 + OP.vest.x1) / 2, vw = OP.vest.x1 - OP.vest.x0;
      portal(G.sub(vx, OP.vest.z0, PI), -vw / 2, vw / 2, OP.vest.h, hex('#D9D6CF'), 0.14, 0.04); portal(G.sub(vx, OP.vest.z1, 0), -vw / 2, vw / 2, OP.vest.h, hex('#D9D6CF'), 0.14, 0.06);   // со стороны тамбура — 6 см: лицо 4 см совпадало с каменным цоколем фасада (мерцание)
      // таблички у входов в музей и цех (на стене коридора справа от проёма)
      pic(F, OP.museum.x1 + 0.38, FL + 1.62, CZ0 + 0.018, 0, 1, 0.42, 0.13, 'plqM'); G.box(ib, OP.museum.x1 + 0.15, OP.museum.x1 + 0.61, FL + 1.545, FL + 1.695, CZ0, CZ0 + 0.014, P.gold, { skip: { nz: 1 } });
      pic(F, OP.work.x0 - 0.36, FL + 1.62, CZ0 + 0.018, 0, 1, 0.42, 0.13, 'plqW'); G.box(ib, OP.work.x0 - 0.59, OP.work.x0 - 0.13, FL + 1.545, FL + 1.695, CZ0, CZ0 + 0.014, P.gold, { skip: { nz: 1 } }); }

    // старые «фото» зверей-мастеров в светлых деревянных рамах (северная стена — справа, если смотреть с востока, как на фото)
    { const segs = [[X0 + 0.22, -11.62], [-10.38, OP.museum.x0 - 0.2], [OP.museum.x1 + 0.75, OP.work.x0 - 0.7], [OP.work.x1 + 0.2, 9.38], [10.62, X1 - 0.2]], pw = 0.33, ph = 0.44, step = 0.5, cy = PH + 0.07 + ph / 2;
      let k = 0; segs.forEach(([a, b]) => { const n = Math.max(0, Math.floor((b - a - pw) / step) + 1); const x0 = (a + b) / 2 - (n - 1) * step / 2;
        for (let i = 0; i < n; i++) framed(F, ib, x0 + i * step, cy, CZ0 + 0.012, 0, 1, pw, ph, 0.03, 0.028, P.frameW, 'por' + (k++ * 3 % 8)); }); }
    // южная стена: эскизы орнамента в чёрных рамах между дверями (слева, как на фото), огнетушитель у вестибюля
    { const doorsS = SPEC.doors.filter(d => d.wall === 'S').map(d => d.x).concat([OP.lobby.x0 - 0.1, OP.lobby.x1 + 0.1]).sort((a, b) => a - b);
      const gaps = []; let prev = X0 + 0.1; doorsS.forEach(x => { gaps.push([prev, x - 0.56]); prev = x + 0.56; }); gaps.push([prev, X1 - 0.1]);
      let k = 0; gaps.forEach(([a, b]) => { if (a > OP.lobby.x0 - 1 && b < OP.lobby.x1 + 1) return; const n = Math.floor((b - a + 0.25) / 1.0); if (n < 1) return; const x0 = (a + b) / 2 - (n - 1) * 0.5;
        for (let i = 0; i < n; i++) framed(F, ib, x0 + i * 1.0, PH + 0.48, CZ1 - 0.012, 0, -1, 0.46, 0.58, 0.03, 0.025, P.black, 'sk' + (k++ % 4)); });
      // огнетушитель на кронштейне
      const ex = OP.lobby.x0 - 0.38, ez = CZ1 - 0.12, p = F.p(ex, 0, ez); G.box(ib, ex - 0.06, ex + 0.06, FL + 0.2, FL + 0.3, CZ1 - 0.04, CZ1 - 0.005, P.steelD);
      ib.cyl(p[0], FL + 0.22 + OY, p[2], 0.085, 0.085, 0.5, { seg: 8, col: hex('#C8322B') }); ib.cyl(p[0], FL + 0.72 + OY, p[2], 0.05, 0.02, 0.07, { seg: 6, col: P.black });
      G.sweep(ib, [[ex + 0.03, FL + 0.76, ez], [ex + 0.11, FL + 0.7, ez - 0.02], [ex + 0.12, FL + 0.4, ez - 0.03]], 0.012, 3, [0, 0, 1], P.black); }
    ceilP(X0, X1, CZ0, CZ1, HC - 0.004);
    // кабель-каналы под потолком по обеим стенам, труба по южной стене на кронштейнах, распаечные коробки, выключатели, извещатели
    { const yk = HC - 0.13;
      G.box(ib, X0, X1, yk, yk + 0.05, CZ0 + 0.012, CZ0 + 0.045, P.white, { skip: { nz: 1 } }); G.box(ib, X0, X1, yk, yk + 0.05, CZ1 - 0.045, CZ1 - 0.012, P.white, { skip: { pz: 1 } });
      G.lathe(ib, [X0, HC - 0.34, CZ1 - 0.085], [1, 0, 0], [[0.045, 0], [0.045, X1 - X0]], { seg: 6, col: hex('#EDEDE8') });
      for (let x = X0 + 1.2; x < X1; x += 2.4) G.box(ib, x - 0.02, x + 0.02, HC - 0.4, HC - 0.3, CZ1 - 0.12, CZ1 - 0.012, P.steelD);
      [-9.3, -1.6, 9.9].forEach(x => { G.box(ib, x - 0.08, x + 0.08, HC - 0.62, HC - 0.46, CZ0 + 0.012, CZ0 + 0.07, P.white, { skip: { nz: 1 } }); G.box(ib, x - 0.012, x + 0.012, HC - 0.46, yk, CZ0 + 0.012, CZ0 + 0.035, P.white, { skip: { nz: 1 } }); });
      [-5.0, 3.8, 10.8].forEach(x => { G.box(ib, x - 0.09, x + 0.09, HC - 0.75, HC - 0.55, CZ1 - 0.07, CZ1 - 0.012, P.white, { skip: { pz: 1 } }); G.fz(ib, x - 0.025, x + 0.025, HC - 0.7, HC - 0.65, CZ1 - 0.072, -1, hex('#D23A2E')); });
      SPEC.doors.filter(d => d.wall === 'S' || d.wall === 'N').forEach((d, i) => { const z = d.wall === 'S' ? CZ1 : CZ0, dz = d.wall === 'S' ? -1 : 1, x = d.x + (i % 2 ? -0.62 : 0.62);
        G.box(ib, x - 0.012, x + 0.012, FL + 1.45, yk, Math.min(z, z + dz * 0.025), Math.max(z, z + dz * 0.025), P.white); G.box(ib, x - 0.045, x + 0.045, FL + 1.32, FL + 1.42, Math.min(z, z + dz * 0.03), Math.max(z, z + dz * 0.03), hex('#F7F7F4')); });
      // щиток у восточного торца
      G.box(ib, X1 - 0.13, X1 - 0.012, FL + 1.55, FL + 2.15, 1.45, 1.9, hex('#C9CCC8'), { skip: { px: 1 } }); G.box(ib, X1 - 0.135, X1 - 0.125, FL + 1.85, FL + 1.95, 1.84, 1.87, P.steelD); }
    // лампы-шары на коротких штангах
    LAMPX.forEach(x => { G.cyl(ib, x, HC - 0.035, CZm, 0.075, 0.07, 0.035, { seg: 8, col: P.white }); G.cyl(ib, x, HC - 0.33, CZm, 0.012, 0.012, 0.3, { seg: 5, col: P.white, cap: false });
      G.sph(glow, x, HC - 0.45, CZm, 0.13, 0.13, 0.13, P.glowW, { seg: 8, rings: 5 }); lamp(x, HC - 0.45, CZm); });

    /* =====================================================================
       2. ЗАЛ МУЗЕЯ (фото: паркет, белые стены, высокие витрины слева, витрины-столы на бордовой ткани, картины, ковёр, окна справа)
       ===================================================================== */
    const M = RM.M;
    // паркет вдоль зала (доски 1,25 × 0,2), у стен чуть темнее
    G.fy(ib, M.x0, M.x1, M.z0, M.z1, FL + 0.004, 1, hex('#BC8550'));   // подложка паркета (щели Т-стыков)
    { const pw = (M.z1 - M.z0) / 31, pl = 1.25;
      for (let j = 0; j < 31; j++) { const z0 = M.z0 + j * pw, z1 = z0 + pw, off = ((j * 7) % 5) / 5 * pl;
        for (let x0 = M.x0 - off, n = 0; x0 < M.x1; x0 += pl, n++) { const a = Math.max(M.x0, x0), b = Math.min(M.x1, x0 + pl); if (b - a < 0.02) continue;
          const t = P.parq[(j * 2 + n * 3) % P.parq.length], ed = (x, z) => mulC(t, 0.94 + 0.06 * Math.min(1, Math.min(x - M.x0, M.x1 - x, z - M.z0, M.z1 - z) / 0.8));
          G.fy(ib, a, b, z0, z1, FL + 0.006, 1, [ed(a, z0), ed(b, z0), ed(b, z1), ed(a, z1)]); } } }
    // плинтус
    [[M.x0, -11.53, M.z1 - 0.02, M.z1], [-10.47, OP.museum.x0 - 0.09, M.z1 - 0.02, M.z1], [OP.museum.x1 + 0.09, M.x1, M.z1 - 0.02, M.z1], [M.x0, M.x1, M.z0, M.z0 + 0.02]].forEach(([a, b, z0, z1]) => G.box(ib, a, b, FL, FL + 0.08, z0, z1, P.plinth, { skip: { ny: 1 } }));
    G.box(ib, M.x0, M.x0 + 0.02, FL, FL + 0.08, M.z0, M.z1, P.plinth, { skip: { ny: 1 } }); G.box(ib, M.x1 - 0.02, M.x1, FL, FL + 0.08, M.z0, M.z1, P.plinth, { skip: { ny: 1 } });
    // потолок «армстронг»: светлая сетка 0,6 м и квадратные светильники
    ceilP(M.x0, M.x1, M.z0, M.z1, HC - 0.004, hex('#E6E5E1'));
    { const yc = HC - 0.008, gcol = hex('#BDBFC0');
      for (let z = M.z0 + 0.6; z < M.z1 - 0.1; z += 0.6) ceilP(M.x0, M.x1, z - 0.008, z + 0.008, yc, gcol);
      for (let x = M.x0 + 0.62; x < M.x1 - 0.1; x += 0.6) ceilP(x - 0.008, x + 0.008, M.z0, M.z1, yc, gcol);
      [-10.4, -6.4, -2.4].forEach(x => [-2.2, -4.95].forEach(z => { G.box(ib, x - 0.32, x + 0.32, HC - 0.03, HC - 0.004, z - 0.32, z + 0.32, P.white, { skip: { py: 1 } }); G.fy(glow, x - 0.28, x + 0.28, z - 0.28, z + 0.28, HC - 0.032, -1, P.glowW); lamp(x, HC - 0.1, z); })); }

    // --- высокие шкафы-витрины вдоль стены к коридору: тонкие серые рамы, стекло, стеклянные полки, бордовый цоколь, серебро битком
    const CAB_H = 2.3, CAB_D = 0.5;
    function cabinet(cx, w) {
      const D = G.sub(cx, M.z1 - 0.015 - CAB_D / 2, PI), g = kit(D), hw = w / 2, hd = CAB_D / 2, y0 = FL + 0.14, y1 = FL + CAB_H - 0.05;
      g.box(ib, -hw, hw, FL, y0, -hd, hd, P.bordo, { cols: { pz: P.bordoD }, skip: { ny: 1 } }); g.box(ib, -hw, hw, FL, FL + 0.03, -hd + 0.01, hd - 0.01, P.black, { skip: { ny: 1, py: 1 } });
      g.box(ib, -hw, hw, y1, FL + CAB_H, -hd, hd, P.steel, { skip: { ny: 0 } });
      [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(([x, z]) => g.box(ib, x - (x > 0 ? 0.025 : 0), x + (x < 0 ? 0.025 : 0), y0, y1, z - (z > 0 ? 0.025 : 0), z + (z < 0 ? 0.025 : 0), P.steel, { skip: { py: 1, ny: 1 } }));
      g.fz(ib, -hw + 0.02, hw - 0.02, y0, y1, -hd + 0.012, 1, [mulC(P.velvet, 0.8), mulC(P.velvet, 0.8), P.velvet, P.velvet]);   // задник — тёмно-синий бархат: светлое серебро на нём «светится» (на фото в шкафах темно)
      const lv = [y0, FL + 0.66, FL + 1.12, FL + 1.58];
      lv.slice(1).forEach(y => { gl.box(D, 0, y - 0.005, 0, w - 0.04, 0.01, CAB_D - 0.04, { col: hex('#CFE4EE'), skip: { ny: 1 } }); g.box(ib, -hw + 0.02, hw - 0.02, y - 0.022, y - 0.008, hd - 0.035, hd - 0.02, P.steel, { skip: { nz: 1 } }); });
      gl.box(D, 0, (y0 + y1) / 2, hd - 0.006, w - 0.03, y1 - y0, 0.006, { col: hex('#CFE4EE'), skip: { py: 1, ny: 1 } });
      [-1, 1].forEach(sd => gl.box(D, sd * (hw - 0.006), (y0 + y1) / 2, 0, 0.006, y1 - y0, CAB_D - 0.03, { col: hex('#CFE4EE'), skip: { py: 1, ny: 1 } }));
      g.box(ib, -0.01, 0.01, y0, y1, hd - 0.012, hd + 0.004, P.steel); g.box(ib, -0.012, 0.012, y0 + 0.95, y0 + 0.99, hd + 0.004, hd + 0.011, P.steelD);   // шов створок и маленький замок на нём
      // серебро по полкам: в ряд, носики в стороны, тяжёлое — вниз
      lv.forEach((y, li) => { const hAv = (li < 3 ? lv[li + 1] : y1) - y - 0.04, set = shelfSet(w - 0.08, hAv); let x = -hw + 0.04 + (w - 0.08 - set.reduce((s, q) => s + q.w + 0.025, -0.025)) / 2;
        set.forEach((q, i) => { const xc = x + q.w / 2, zc = (i % 2 ? -0.06 : 0.04) + (R() - 0.5) * 0.03;
          item(D, q.k === 'copper' ? 'jug' : q.k, xc, y + (li ? 0.0 : 0.002), zc, q.s, q.k === 'plateS' ? 0 : (R() < 0.5 ? PI / 2 : -PI / 2), { col: q.k === 'copper' ? P.cu : undefined, lid: q.k === 'goblet' && R() < 0.4 });
          x += q.w + 0.025; }); });
    }
    const cabA = [-10.3, OP.museum.x0 - 0.2], cabB = [OP.museum.x1 + 0.2, M.x1 - 0.25];
    // над шкафами — ряд небольших картин и эскизов в рамах (как на фото: над витринами по левой стене)
    [[-9.7, 'pa2'], [-8.6, 'sk1'], [-4.6, 'pa0'], [-3.45, 'sk0'], [-2.3, 'pa1'], [-1.15, 'sk3']].forEach(([x, id]) => { const pa = id[0] === 'p';
      framed(F, ib, x, FL + 2.78, M.z1 - 0.012, 0, -1, pa ? 0.62 : 0.4, pa ? 0.46 : 0.5, 0.045, 0.03, pa ? P.gold : P.woodD, id); });
    [[cabA, 3], [cabB, 5]].forEach(([[a, b], n]) => { const w = (b - a) / n; for (let i = 0; i < n; i++) cabinet(a + w * (i + 0.5), w - 0.02); coll(a, b, M.z1 - CAB_D - 0.03, M.z1, FL - 0.5, FL + CAB_H, 'kmbCase', { cam: true }); });

    // --- витрины-столы: тонкие ножки, бордовая ткань, стеклянный короб; на ткани — блюда, кувшины, кинжалы, пояса, браслеты
    function tableCase(cx, cz, L, Dp, set) {
      const g = G, x0 = cx - L / 2, x1 = cx + L / 2, z0 = cz - Dp / 2, z1 = cz + Dp / 2, yt = FL + 0.84, yg = FL + 1.3;
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => g.box(ib, x - (x > cx ? 0.03 : 0), x + (x < cx ? 0.03 : 0), FL, yt, z - (z > cz ? 0.03 : 0), z + (z < cz ? 0.03 : 0), P.steel, { skip: { py: 1, ny: 1 } }));
      g.box(ib, x0, x1, FL + 0.74, yt - 0.06, z0, z1, P.steel, { skip: { py: 1 } });
      g.box(ib, x0 - 0.015, x1 + 0.015, yt - 0.06, yt, z0 - 0.015, z1 + 0.015, P.bordo, { cols: { py: mulC(P.bordo, 1.08), px: P.bordoD, nx: P.bordoD, pz: P.bordoD, nz: P.bordoD } });
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => g.box(ib, x - (x > cx ? 0.02 : 0), x + (x < cx ? 0.02 : 0), yt, yg, z - (z > cz ? 0.02 : 0), z + (z < cz ? 0.02 : 0), P.steel, { skip: { py: 1, ny: 1 } }));
      g.box(ib, x0, x1, yg, yg + 0.025, z0, z0 + 0.02, P.steel); g.box(ib, x0, x1, yg, yg + 0.025, z1 - 0.02, z1, P.steel); g.box(ib, x0, x0 + 0.02, yg, yg + 0.025, z0, z1, P.steel); g.box(ib, x1 - 0.02, x1, yg, yg + 0.025, z0, z1, P.steel);
      gl.box(F, cx, yg + 0.012, cz, L - 0.03, 0.006, Dp - 0.03, { col: hex('#CFE4EE'), skip: { ny: 1 } });
      [[cx, z0 + 0.004, L, 0.006], [cx, z1 - 0.004, L, 0.006]].forEach(([x, z, w, d]) => gl.box(F, x, (yt + yg) / 2, z, w - 0.03, yg - yt, d, { col: hex('#CFE4EE'), skip: { py: 1, ny: 1 } }));
      [[x0 + 0.004], [x1 - 0.004]].forEach(([x]) => gl.box(F, x, (yt + yg) / 2, cz, 0.006, yg - yt, Dp - 0.03, { col: hex('#CFE4EE'), skip: { py: 1, ny: 1 } }));
      // этикетки
      [-0.3, 0.3].forEach(t => G.box(ib, cx + t * L - 0.05, cx + t * L + 0.05, yt, yt + 0.004, z1 - 0.1, z1 - 0.04, P.paper));
      set.forEach(([k, u, v, s, yaw]) => item(F, k, cx + u * L / 2, yt, cz + v * Dp / 2, s * (['vase', 'jug', 'ewer', 'goblet', 'plateS', 'copper'].includes(k) ? 1.2 : 1), yaw, { col: k === 'copper' ? P.cu : undefined, lid: k === 'goblet' }));
      coll(x0 - 0.02, x1 + 0.02, z0 - 0.02, z1 + 0.02, FL - 0.5, yg + 0.03, 'kmbVitrine');
    }
    const TC = [
      [-10.4, -5.7, 2.6, 0.9, [['plate', -0.75, 0.2, 0.3], ['vase', -0.45, -0.25, 0.36, 0.3], ['jug', -0.12, 0.05, 0.34, PI / 2], ['dagger', 0.25, 0.35, 0.42, PI / 2 + 0.15], ['plateS', 0.52, -0.3, 0.3, 0.0], ['bracelet', 0.82, 0.3, 0.05], ['goblet', 0.82, -0.25, 0.24, 0]]],
      [-6.4, -5.7, 2.6, 0.9, [['ewer', -0.78, -0.2, 0.38, -PI / 2], ['plate', -0.45, 0.25, 0.26], ['casket', -0.15, -0.25, 0.14, 0.2], ['belt', 0.2, 0.32, 0.55, PI / 2], ['vase', 0.45, -0.2, 0.34, 0.6], ['bowl', 0.78, 0.15, 0.26, 0]]],
      [-2.4, -5.7, 2.6, 0.9, [['plateS', -0.8, -0.25, 0.32, 0], ['jug', -0.5, 0.1, 0.32, -PI / 2], ['copper', -0.2, -0.25, 0.3, PI / 2], ['dagger', 0.15, 0.3, 0.4, PI / 2 - 0.1], ['goblet', 0.45, -0.25, 0.26, 0], ['cup', 0.65, 0.3, 0.1, 0], ['vase', 0.83, -0.2, 0.36, 1]]],
      [-9.9, -3.15, 2.4, 0.9, [['plate', -0.7, 0.0, 0.3], ['ewer', -0.3, -0.2, 0.36, PI / 2], ['casket', 0.05, 0.25, 0.13, -0.3], ['bracelet', 0.35, 0.3, 0.045], ['vase', 0.4, -0.22, 0.33, 0], ['plateS', 0.78, -0.1, 0.28, 0]]],
      [-3.6, -3.15, 2.0, 0.9, [['jug', -0.72, -0.15, 0.33, -PI / 2], ['dagger', -0.25, 0.3, 0.42, PI / 2], ['plate', 0.1, -0.15, 0.28], ['goblet', 0.42, 0.25, 0.25, 0], ['belt', 0.55, -0.3, 0.45, PI / 2], ['bowl', 0.82, 0.15, 0.22, 0]]],
    ];
    TC.forEach(([x, z, L, Dp, set]) => tableCase(x, z, L, Dp, set));

    // --- «Кувшин мастера» под стеклянным колпаком на пьедестале в середине зала (виден из двери)
    const JUG = { x: OP.museum.x0 + 0.1, z: -3.15 };   // на 0,9 м западнее оси двери: из двери его видно рядом с героиней, проход по оси свободен
    { const { x, z } = JUG, yt = FL + 0.92;
      G.box(ib, x - 0.32, x + 0.32, FL, yt, z - 0.32, z + 0.32, hex('#EEEAE2'), { skip: { ny: 1 } }); G.box(ib, x - 0.34, x + 0.34, FL, FL + 0.1, z - 0.34, z + 0.34, hex('#B9B3A8'), { skip: { ny: 1 } });
      G.box(ib, x - 0.3, x + 0.3, yt, yt + 0.025, z - 0.3, z + 0.3, P.bordo);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => G.box(ib, x + a * 0.28 - 0.01, x + a * 0.28 + 0.01, yt + 0.025, yt + 0.66, z + b * 0.28 - 0.01, z + b * 0.28 + 0.01, P.steel, { skip: { ny: 1 } }));
      G.box(ib, x - 0.29, x + 0.29, yt + 0.66, yt + 0.68, z - 0.29, z + 0.29, P.steel);
      gl.box(F, x, yt + 0.34, z, 0.56, 0.62, 0.56, { col: hex('#CFE4EE'), skip: { ny: 1 } });
      item(F, 'jug', x, yt + 0.025, z, 0.52, PI / 2, { seg: SEG + 5, col: P.sv3, lid: true, master: true, band: 1 });
      pic(F, x, FL + 0.6, z + 0.32 + 0.004, 0, 1, 0.34, 0.106, 'plqJ');
      coll(x - 0.36, x + 0.36, z - 0.36, z + 0.36, FL - 0.5, yt + 0.7, 'kmbPedestal'); }

    // --- западная стена: этажерка с блюдами и книгами, ковёр, картины; восточная — картины; скамья для посетителей
    { const x0 = M.x0, ez0 = -4.55, ez1 = -3.4, d = 0.38, hgt = 1.95, g = G;
      g.box(ib, x0, x0 + d, FL, FL + 0.08, ez0, ez1, P.woodD); [ez0, ez1].forEach(z => g.box(ib, x0, x0 + d, FL, FL + hgt, z - (z > ez0 ? 0.03 : 0), z + (z < ez1 ? 0.03 : 0), P.woodD));
      g.fx(ib, ez0, ez1, FL, FL + hgt, x0 + 0.01, 1, mulC(P.woodD, 0.85));
      const ys = [FL + 0.08, FL + 0.55, FL + 1.02, FL + 1.49, FL + hgt - 0.03];
      ys.slice(1).forEach(y => g.box(ib, x0, x0 + d, y - 0.03, y, ez0 + 0.03, ez1 - 0.03, P.woodD));
      const Ds = G.sub(x0 + d / 2, (ez0 + ez1) / 2, PI / 2);   // рамка этажерки: +z — в зал (+x)
      ys.slice(0, 4).forEach((y, i) => {
        if (i === 1) { let u = -0.5; for (let k = 0; k < 9; k++) { const bw = 0.035 + R() * 0.02, bh = 0.24 + R() * 0.12, cc = [hex('#7A2436'), hex('#23305A'), hex('#3E5E40'), hex('#A0763A'), hex('#5A4A3A')][k % 5]; kit(Ds).box(ib, u, u + bw, y, y + bh, -0.12, 0.1, cc, { skip: { ny: 1 } }); u += bw + 0.004; } item(Ds, 'vase', 0.32, y, 0, 0.3, PI / 2); }
        else if (i === 0) { item(Ds, 'plateS', -0.3, y, -0.02, 0.36, 0); item(Ds, 'plateS', 0.12, y, -0.02, 0.36, 0); item(Ds, 'copper', 0.4, y, 0, 0.3, -PI / 2, { col: P.cu }); }
        else { item(Ds, 'plateS', -0.33, y, -0.04, 0.3, 0); item(Ds, i === 2 ? 'goblet' : 'jug', 0.0, y, 0, 0.3, PI / 2, { lid: true }); item(Ds, 'plateS', 0.33, y, -0.04, 0.3, 0); }
      });
      coll(x0, x0 + d + 0.02, ez0 - 0.02, ez1 + 0.02, FL - 0.5, FL + hgt, 'kmbEtagere', { cam: true });
      // ковёр на стене (на латунном пруте)
      const kz = -2.0, kw = 1.3, kh = 2.1, ky = FL + 0.6 + kh / 2;
      G.box(ib, x0 + 0.01, x0 + 0.025, ky - kh / 2, ky + kh / 2, kz - kw / 2, kz + kw / 2, hex('#5A1A20'), { skip: { nx: 1 } }); pic(F, x0 + 0.03, ky, kz, 1, 0, kw, kh, 'rug');
      G.lathe(ib, [x0 + 0.06, ky + kh / 2 + 0.03, kz - kw / 2 - 0.08], [0, 0, 1], [[0.013, 0], [0.013, kw + 0.16]], { seg: 5, col: P.gold });
      // картины в золочёных рамах
      framed(F, ib, -5.6, FL + 1.75, x0 + 0.01, 1, 0, 1.15, 0.86, 0.07, 0.04, P.gold, 'pa0');
      framed(F, ib, (ez0 + ez1) / 2, FL + 2.62, x0 + 0.01, 1, 0, 0.82, 0.62, 0.06, 0.04, P.gold, 'pa2');
      framed(F, ib, -4.6, FL + 1.85, M.x1 - 0.01, -1, 0, 1.0, 0.75, 0.065, 0.04, P.gold, 'pa1');
      framed(F, ib, -1.75, FL + 1.85, M.x1 - 0.01, -1, 0, 1.0, 0.75, 0.065, 0.04, P.gold, 'pa3');
      // скамья у восточной стены — сидя смотреть вдоль зала
      const bx = -1.05, bz0 = -3.85, bz1 = -2.45;
      G.box(ib, bx - 0.2, bx + 0.2, FL + 0.42, FL + 0.47, bz0, bz1, P.woodL); [bz0 + 0.1, bz1 - 0.1].forEach(z => G.box(ib, bx - 0.17, bx + 0.17, FL, FL + 0.42, z - 0.025, z + 0.025, P.woodD, { skip: { ny: 1 } }));
      coll(bx - 0.22, bx + 0.22, bz0 - 0.02, bz1 + 0.02, FL - 0.5, FL + 0.5, 'kmbBench'); }

    /* =====================================================================
       3. ЦЕХ МАСТЕРОВ: верстаки у окон, лампы, тиски, наковаленки, заготовки; стеллаж, станок, стол с эскизами, плакаты
       ===================================================================== */
    const Wk = RM.Wk;
    // пол — тёплый линолеум крупными плитами (была бледная «шахматка» 25 × 12 — цех выглядел больничным)
    { const tw = (Wk.x1 - Wk.x0) / 10, td = (Wk.z1 - Wk.z0) / 5;
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) G.fy(ib, Wk.x0 + i * tw, Wk.x0 + (i + 1) * tw, Wk.z0 + j * td, Wk.z0 + (j + 1) * td, FL + 0.006, 1, P.lino[(i + j) % 2]); }
    // нижняя крашеная панель (шалфей) на глухих стенах, плинтус у окон
    { const ph = FL + 1.2;
      [[Wk.x0 + 0.012, 1], [Wk.x1 - 0.012, -1]].forEach(([x, d]) => { G.fx(ib, Wk.z0, Wk.z1, FL, ph, x, d, [mulC(P.sage, 0.92), mulC(P.sage, 0.92), P.sage, P.sage]); G.fx(ib, Wk.z0, Wk.z1, ph - 0.025, ph, x + d * 0.003, d, P.sageD); });
      [[Wk.x0, OP.work.x0], [OP.work.x1, Wk.x1]].forEach(([a, b]) => { G.fz(ib, a, b, FL, ph, Wk.z1 - 0.012, -1, [mulC(P.sage, 0.92), mulC(P.sage, 0.92), P.sage, P.sage]); G.fz(ib, a, b, ph - 0.025, ph, Wk.z1 - 0.015, -1, P.sageD); });
      G.box(ib, Wk.x0, Wk.x1, FL, FL + 0.1, Wk.z0, Wk.z0 + 0.02, P.sageD, { skip: { ny: 1 } }); }
    ceilP(Wk.x0, Wk.x1, Wk.z0, Wk.z1, HC - 0.004);
    // лампы дневного света (подвесы)
    [[3.2, -4.9], [9.5, -4.9], [3.2, -2.3], [9.5, -2.3]].forEach(([x, z]) => {
      [-0.5, 0.5].forEach(dx => G.box(ib, x + dx - 0.005, x + dx + 0.005, HC - 0.3, HC, z - 0.005, z + 0.005, P.steelD));
      G.box(ib, x - 0.65, x + 0.65, HC - 0.38, HC - 0.3, z - 0.1, z + 0.1, P.white, { skip: { ny: 1 } }); G.fy(glow, x - 0.6, x + 0.6, z - 0.07, z + 0.07, HC - 0.385, -1, P.glowSoft); lamp(x, HC - 0.42, z); });   // свет — мягкий тёплый
    // верстаки: мастер сидит за верстаком спиной к окну, лицом в цех (к двери и героине)
    const BENCH = [{ x: 2.35, role: 'engraver' }, { x: 6.35, role: 'niello' }, { x: 10.35, role: 'filigree' }], BZc = -5.05, BTOP = FL + 0.88, SEAT = FL + 0.42;
    BENCH.forEach((b, bi) => {
      const x0 = b.x - 0.75, x1 = b.x + 0.75, z0 = BZc - 0.35, z1 = BZc + 0.35;
      G.box(ib, x0, x1, BTOP - 0.05, BTOP, z0, z1, P.wood, { cols: { py: P.woodL } });
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => G.box(ib, x - (x > b.x ? 0.06 : 0), x + (x < b.x ? 0.06 : 0), FL, BTOP - 0.05, z - (z > BZc ? 0.06 : 0), z + (z < BZc ? 0.06 : 0), P.woodD, { skip: { py: 1, ny: 1 } }));
      G.box(ib, x0 + 0.06, x1 - 0.06, FL + 0.18, FL + 0.24, z1 - 0.05, z1 - 0.02, P.woodD);
      G.box(ib, x1 - 0.5, x1 - 0.06, BTOP - 0.3, BTOP - 0.05, z0 + 0.05, z1 - 0.05, P.woodD, { cols: { nz: mulC(P.woodL, 0.9) } });   // тумбочка с ящиками (к мастеру)
      [BTOP - 0.12, BTOP - 0.22].forEach(y => G.box(ib, x1 - 0.32, x1 - 0.24, y - 0.01, y + 0.01, z0 + 0.03, z0 + 0.05, P.steelD));
      G.box(ib, b.x - 0.07, b.x + 0.07, BTOP - 0.035, BTOP - 0.005, z0 - 0.16, z0, P.woodL);   // колышек верстака — к мастеру
      G.box(ib, b.x - 0.36, b.x + 0.36, BTOP - 0.16, BTOP - 0.14, z0 - 0.05, z0 + 0.32, hex('#6B4A33'));   // кожаный фартук-поддон под колышком (ловит опилки серебра)
      // тумбочка-«горка» с ящичками на дальнем конце верстака, на ней баночки
      G.box(ib, x0 + 0.04, x0 + 0.3, BTOP, BTOP + 0.22, z1 - 0.26, z1 - 0.04, P.woodD, { cols: { nz: P.wood } });
      for (let i = 0; i < 3; i++) { const y = BTOP + 0.025 + i * 0.065; G.box(ib, x0 + 0.06, x0 + 0.28, y, y + 0.055, z1 - 0.265, z1 - 0.26, P.woodL); G.box(ib, x0 + 0.155, x0 + 0.185, y + 0.02, y + 0.035, z1 - 0.275, z1 - 0.265, P.steel); }
      [[0.1, hex('#9DB2C8')], [0.18, hex('#D8C9A0')], [0.25, hex('#B8C9C4')]].forEach(([dx, cc]) => G.cyl(ib, x0 + dx, BTOP + 0.22, z1 - 0.14, 0.028, 0.028, 0.07, { seg: 6, col: cc }));
      // тиски
      { const vx = x0 + 0.18, vz = z0 + 0.16; G.box(ib, vx - 0.07, vx + 0.07, BTOP, BTOP + 0.04, vz - 0.06, vz + 0.06, hex('#4F6A5E')); G.box(ib, vx - 0.06, vx + 0.06, BTOP + 0.04, BTOP + 0.12, vz - 0.04, vz - 0.01, hex('#4F6A5E')); G.box(ib, vx - 0.06, vx + 0.06, BTOP + 0.04, BTOP + 0.12, vz + 0.01, vz + 0.04, hex('#4F6A5E'));
        G.lathe(ib, [vx - 0.1, BTOP + 0.07, vz + 0.06], [1, 0, 0], [[0.008, 0], [0.008, 0.2]], { seg: 4, col: P.steelD }); }
      // наковаленка на чурбаке у края
      { const ax = x0 + 0.48, az = z0 + 0.2; G.box(ib, ax - 0.06, ax + 0.06, BTOP, BTOP + 0.05, az - 0.04, az + 0.04, hex('#3E4248')); G.box(ib, ax - 0.04, ax + 0.04, BTOP + 0.05, BTOP + 0.08, az - 0.03, az + 0.03, hex('#55595F'));
        G.lathe(ib, [ax + 0.06, BTOP + 0.065, az], [1, 0, 0], [[0.025, 0], [0, 0.08]], { seg: 5, col: hex('#55595F') }); }
      // молоточек, резцы в стаканчике, напильник
      G.box(ib, b.x + 0.05, b.x + 0.25, BTOP, BTOP + 0.018, z0 + 0.14, z0 + 0.16, P.woodL); G.box(ib, b.x + 0.22, b.x + 0.25, BTOP, BTOP + 0.035, z0 + 0.12, z0 + 0.18, P.steelD);
      G.cyl(ib, x1 - 0.2, BTOP, z1 - 0.18, 0.035, 0.035, 0.09, { seg: 6, col: P.woodD }); [[-0.012, 0], [0.012, 0.01], [0, -0.012]].forEach(([dx, dz]) => G.box(ib, x1 - 0.2 + dx - 0.003, x1 - 0.2 + dx + 0.003, BTOP + 0.09, BTOP + 0.17, z1 - 0.18 + dz - 0.003, z1 - 0.18 + dz + 0.003, P.steel));
      // заготовки: пластина, «бочонок» будущего кувшина, медный лист; эскиз на бумаге
      item(F, 'plate', b.x - 0.05, BTOP, BZc + 0.05, 0.2); item(F, bi === 1 ? 'casket' : 'cup', b.x + 0.32, BTOP, BZc + 0.1, bi === 1 ? 0.12 : 0.12, 0.4);
      if (bi === 2) item(F, 'bracelet', b.x - 0.3, BTOP, BZc + 0.12, 0.04, 0);
      G.box(ib, x0 + 0.08, x0 + 0.3, BTOP, BTOP + 0.004, z1 - 0.2, z1 - 0.06, P.cu);
      picFlat(F, b.x - 0.22, BTOP + 0.003, BZc + 0.18, 0.24, 0.3, 0.2 + bi * 0.3, 'sk' + ((bi + 1) % 4));
      // лампа на кронштейне: основание, стойка, плечо, абажур (свет — тёплый круг снизу)
      // абажур — ниже лица мастера и правее: с места «Цех мастеров» и из прохода он не закрывает мастеру лицо
      { const lx = x1 - 0.12, lz = z1 - 0.08, tx = b.x + 0.24, tz = BZc - 0.05, hy = BTOP + 0.34;
        G.cyl(ib, lx, BTOP, lz, 0.06, 0.055, 0.02, { seg: 7, col: P.black }); G.box(ib, lx - 0.01, lx + 0.01, BTOP + 0.02, hy, lz - 0.01, lz + 0.01, P.black);
        G.sweep(ib, [[lx, hy, lz], [(lx + tx) / 2, hy + 0.04, (lz + tz) / 2], [tx, hy - 0.02, tz]], 0.009, 4, [-(tz - lz), 0, tx - lx], P.black);
        G.cyl(ib, tx, hy - 0.16, tz, 0.1, 0.035, 0.14, { seg: 8, col: hex('#2F5D50') }); G.cyl(glow, tx, hy - 0.165, tz, 0.092, 0.092, 0.006, { seg: 8, col: P.glowWarm }); lamp(tx, hy - 0.2, tz); }
      // резиновый коврик под табуретом и кружка кофе у мастера
      G.fy(ib, b.x - 0.55, b.x + 0.55, BZc - 1.25, BZc - 0.42, FL + 0.011, 1, hex('#56635A')); G.fy(ib, b.x - 0.5, b.x + 0.5, BZc - 1.2, BZc - 0.47, FL + 0.0125, 1, hex('#61705F'));
      G.cyl(ib, b.x + 0.33, BTOP, z0 + 0.12, 0.034, 0.034, 0.09, { seg: 7, col: hex('#F4F1EA') }); G.cyl(ib, b.x + 0.33, BTOP + 0.086, z0 + 0.12, 0.029, 0.029, 0.004, { seg: 7, col: hex('#4A2E1F'), cap: true });
      // табурет мастера (сидит на SEAT)
      { const sx = b.x, sz = BZc - 0.8; G.cyl(ib, sx, SEAT - 0.04, sz, 0.17, 0.17, 0.04, { seg: 8, col: P.woodL }); [0, 1, 2].forEach(k => { const a = k / 3 * TAU, px = sx + Math.sin(a) * 0.11, pz = sz + Math.cos(a) * 0.11; G.box(ib, px - 0.015, px + 0.015, FL, SEAT - 0.04, pz - 0.015, pz + 0.015, P.woodD, { skip: { py: 1, ny: 1 } }); }); }
      out.npcSlots.masters.push({ lx: b.x, lz: +(BZc - 0.8).toFixed(3), ry: 0, y: +(SEAT + OY).toFixed(3), floor: +(FL + OY).toFixed(3), seat: true, role: b.role });
      coll(x0 - 0.02, x1 + 0.02, Wk.z0, z1 + 0.02, FL - 0.5, BTOP + 0.06, 'kmbWorkbench');
    });
    // стеллаж у восточной стены: коробки, медные листы, банки, рулоны эскизов, серебряные заготовки
    { const x0 = Wk.x1 - 0.45, x1 = Wk.x1 - 0.02, z0 = -3.7, z1 = -1.3, hgt = 2.0, col = hex('#5E7A70');
      [[x0, z0], [x1 - 0.03, z0], [x0, z1 - 0.03], [x1 - 0.03, z1 - 0.03]].forEach(([x, z]) => G.box(ib, x, x + 0.03, FL, FL + hgt, z, z + 0.03, col, { skip: { ny: 1 } }));
      const ys = [FL + 0.12, FL + 0.6, FL + 1.08, FL + 1.56, FL + hgt - 0.02];
      ys.forEach(y => G.box(ib, x0, x1, y - 0.025, y, z0, z1, mulC(col, 1.12)));
      const Ds = G.sub((x0 + x1) / 2, (z0 + z1) / 2, -PI / 2), g = kit(Ds), L = z1 - z0;   // рамка стеллажа: +z — в цех (−x)
      ys.slice(0, 4).forEach((y, i) => { let u = -L / 2 + 0.06;
        while (u < L / 2 - 0.2) { const k = Math.floor(R() * 4), w = 0.16 + R() * 0.2;
          if (k === 0) g.box(ib, u, u + w, y, y + 0.14 + R() * 0.12, -0.16, 0.14, P.card, { cols: { py: mulC(P.card, 1.1) }, skip: { ny: 1 } });
          else if (k === 1) for (let q = 0; q < 4; q++) g.box(ib, u, u + w, y + q * 0.008, y + q * 0.008 + 0.006, -0.17, 0.12, q % 2 ? P.cu : P.cuD);
          else if (k === 2) { for (let q = 0; q < 3; q++) g.cyl(ib, u + 0.05 + q * 0.07, y, 0.02, 0.03, 0.03, 0.1, { seg: 6, col: [hex('#B8C9C4'), hex('#D8C9A0'), hex('#9DB2C8')][q] }); }
          else { for (let q = 0; q < 3; q++) g.lathe(ib, [u, y + 0.03 + q * 0.055, -0.02 + (q % 2) * 0.03], [1, 0, 0], [[0.026, 0], [0.026, w]], { seg: 5, col: q % 2 ? P.paper : hex('#E8DFC8') }); }
          u += w + 0.05; } });
      coll(x0 - 0.02, Wk.x1, z0 - 0.02, z1 + 0.02, FL - 0.5, FL + hgt, 'kmbRack', { cam: true }); }
    // полировальный станок на тумбе (два круга-«бафа» по бокам мотора), у западной стены
    { const x = 1.0, z = -2.6, y = FL + 0.82;
      G.box(ib, x - 0.22, x + 0.22, FL, y, z - 0.2, z + 0.2, hex('#5E7A70'), { skip: { ny: 1 } });
      G.lathe(ib, [x - 0.14, y + 0.11, z], [1, 0, 0], [[0.075, 0], [0.085, 0.04], [0.085, 0.24], [0.075, 0.28]], { seg: 8, col: hex('#4F6A5E') }); G.box(ib, x - 0.09, x + 0.09, y, y + 0.05, z - 0.07, z + 0.07, hex('#4F6A5E'));
      [-1, 1].forEach(sd => { G.lathe(ib, [x + sd * 0.14, y + 0.11, z], [sd, 0, 0], [[0.012, 0], [0.012, 0.1]], { seg: 4, col: P.steel }); G.lathe(ib, [x + sd * 0.2, y + 0.11, z], [sd, 0, 0], [[0, 0], [0.09, 0.0], [0.095, 0.02], [0.09, 0.04], [0, 0.04]], { seg: 10, col: hex('#EDE8DC') });
        G.box(ib, x + sd * 0.22 - 0.035, x + sd * 0.22 + 0.035, y + 0.02, y + 0.24, z - 0.11, z - 0.08, P.steelD); });
      coll(x - 0.36, x + 0.36, z - 0.24, z + 0.24, FL - 0.5, y + 0.25, 'kmbPolish'); }
    // стол с эскизами и заготовками в середине цеха
    { const x0 = 8.6, x1 = 10.4, z0 = -2.85, z1 = -2.05, yt = FL + 0.8;
      G.box(ib, x0, x1, yt - 0.04, yt, z0, z1, P.woodL, { cols: { py: hex('#C79A6A') } }); [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x1 - 0.05, z1 - 0.05], [x0 + 0.05, z1 - 0.05]].forEach(([x, z]) => G.box(ib, x - 0.03, x + 0.03, FL, yt - 0.04, z - 0.03, z + 0.03, P.woodD, { skip: { py: 1, ny: 1 } }));
      picFlat(F, x0 + 0.35, yt + 0.002, (z0 + z1) / 2, 0.36, 0.46, 0.15, 'sk0'); picFlat(F, x0 + 0.8, yt + 0.002, (z0 + z1) / 2 + 0.05, 0.36, 0.46, -0.1, 'sk1'); picFlat(F, x0 + 1.25, yt + 0.003, (z0 + z1) / 2 - 0.05, 0.36, 0.46, 0.25, 'sk2');
      item(F, 'jug', x1 - 0.2, yt, z0 + 0.2, 0.3, -PI / 2); item(F, 'bowl', x1 - 0.22, yt, z1 - 0.18, 0.2, 0);
      G.box(ib, x0 + 0.15, x0 + 0.65, yt, yt + 0.006, z1 - 0.1, z1 - 0.07, P.steel);   // линейка
      coll(x0 - 0.02, x1 + 0.02, z0 - 0.02, z1 + 0.02, FL - 0.5, yt + 0.05, 'kmbTable'); }
    // шкаф с ящиками для инструмента у западной стены, плакаты-орнаменты, часы
    { const x0 = Wk.x0 + 0.02, x1 = x0 + 0.45, z0 = -5.0, z1 = -4.1, yh = FL + 1.15;
      G.box(ib, x0, x1, FL, yh, z0, z1, hex('#5E7A70'), { skip: { ny: 1 } });
      for (let i = 0; i < 5; i++) { const y = FL + 0.1 + i * 0.21; G.fx(ib, z0 + 0.04, z1 - 0.04, y, y + 0.18, x1 + 0.002, 1, hex('#6E8B80')); G.box(ib, x1, x1 + 0.025, y + 0.07, y + 0.1, (z0 + z1) / 2 - 0.08, (z0 + z1) / 2 + 0.08, P.steel); }
      coll(x0, x1 + 0.03, z0 - 0.02, z1 + 0.02, FL - 0.5, yh, 'kmbDrawers');
      // перфодоска над шкафом: молоточки, плоскогубцы, резцы, циркуль — каждый на своём месте
      { const bx = Wk.x0 + 0.012, y0 = FL + 1.32, y1 = FL + 2.02; G.box(ib, bx, bx + 0.02, y0, y1, z0 - 0.05, z1 + 0.05, hex('#B99A72'), { skip: { nx: 1 } });
        const T = (z, y, w, h, col) => G.box(ib, bx + 0.02, bx + 0.035, y - h / 2, y + h / 2, z - w / 2, z + w / 2, col, { skip: { nx: 1 } });
        [-4.92, -4.78, -4.64].forEach((z, i) => { T(z, y1 - 0.2, 0.025, 0.22, P.woodD); T(z, y1 - 0.08, 0.07, 0.035 + i * 0.008, P.steelD); });   // молоточки
        [-4.42, -4.3].forEach(z => { T(z, y0 + 0.3, 0.02, 0.2, hex('#B5332E')); T(z, y0 + 0.43, 0.018, 0.08, P.steelD); });   // плоскогубцы
        for (let i = 0; i < 6; i++) T(-4.98 + i * 0.08, y0 + 0.14, 0.012, 0.16, i % 2 ? P.woodL : P.steel);   // резцы
        T(-4.18, y0 + 0.5, 0.012, 0.22, P.steel); T(-4.13, y0 + 0.5, 0.012, 0.22, P.steel); }   // циркуль
      framed(F, ib, -5.75, FL + 1.85, Wk.x0 + 0.01, 1, 0, 0.6, 0.84, 0.0, 0.012, P.paper, 'wp0');
      framed(F, ib, -3.4, FL + 1.85, Wk.x0 + 0.01, 1, 0, 0.6, 0.84, 0.0, 0.012, P.paper, 'wp1');
      framed(F, ib, -1.45, FL + 1.85, Wk.x0 + 0.01, 1, 0, 0.6, 0.84, 0.0, 0.012, P.paper, 'wp0', hex('#E8ECF4'));
      framed(F, ib, -2.6, FL + 2.75, Wk.x1 - 0.01, -1, 0, 0.36, 0.36, 0.02, 0.04, P.black, 'clock'); }

    // сейф для серебра в углу, ящик с заготовками у стола, огнетушитель у двери
    { const x0 = Wk.x1 - 0.55, x1 = Wk.x1 - 0.03, z0 = Wk.z0 + 0.05, z1 = Wk.z0 + 0.6;
      G.box(ib, x0, x1, FL, FL + 1.05, z0, z1, hex('#3F5A4E'), { cols: { nx: hex('#4A6658') }, skip: { ny: 1 } }); G.fx(ib, z0 + 0.05, z1 - 0.05, FL + 0.08, FL + 0.98, x0 - 0.003, -1, hex('#46604F'));
      G.lathe(ib, [x0 - 0.002, FL + 0.6, (z0 + z1) / 2], [-1, 0, 0], [[0.06, 0], [0.06, 0.025, 'k'], [0, 0.03]], { seg: 8, col: P.gold }); G.box(ib, x0 - 0.04, x0, FL + 0.38, FL + 0.42, z1 - 0.14, z1 - 0.1, P.steel);
      coll(x0 - 0.05, Wk.x1, z0 - 0.02, z1 + 0.02, FL - 0.5, FL + 1.1, 'kmbSafe');
      const cx = 7.9, cz = -2.45; G.box(ib, cx - 0.25, cx + 0.25, FL, FL + 0.3, cz - 0.18, cz + 0.18, P.card, { skip: { ny: 1 } }); [-0.12, 0.0, 0.12].forEach((dx, i) => item(F, i === 1 ? 'cup' : 'plate', cx + dx, FL + 0.3, cz, i === 1 ? 0.1 : 0.16, 0, { band: 0 }));
      coll(cx - 0.27, cx + 0.27, cz - 0.2, cz + 0.2, FL - 0.5, FL + 0.4, 'kmbCrate');
      const ex = OP.work.x0 - 0.3, ez = Wk.z1 - 0.12, p = F.p(ex, 0, ez); G.box(ib, ex - 0.06, ex + 0.06, FL + 0.2, FL + 0.3, Wk.z1 - 0.035, Wk.z1 - 0.005, P.steelD);
      ib.cyl(p[0], FL + 0.22 + OY, p[2], 0.085, 0.085, 0.5, { seg: 8, col: hex('#C8322B') }); ib.cyl(p[0], FL + 0.72 + OY, p[2], 0.05, 0.02, 0.07, { seg: 6, col: P.black }); }

    // уют цеха: цветы в кадках между окнами, над ними — эскизы на кнопках
    [[4.35, 'sk2'], [8.35, 'sk3']].forEach(([x, sk], k) => { const z = Wk.z0 + 0.32;
      G.cyl(ib, x, FL, z, 0.15, 0.12, 0.36, { seg: 8, col: hex(k ? '#B5623E' : '#5E7A70') }); G.cyl(ib, x, FL + 0.35, z, 0.14, 0.14, 0.02, { seg: 8, col: hex('#5A4636') });
      [[0, 0.62, 0, 0.24], [0.1, 0.8, 0.05, 0.19], [-0.08, 0.92, -0.04, 0.17], [0.03, 1.08, 0.02, 0.14]].forEach(([dx, y, dz, r], i) => G.sph(ib, x + dx, FL + y, z + dz, r, r * 1.1, r, i % 2 ? P.green : P.greenD, { seg: 7, rings: 4 }));
      collC(x, z, 0.2, FL - 0.5, FL + 1.3, 'kmbPlant');
      framed(F, ib, x - 0.22, FL + 1.78, Wk.z0 + 0.01, 0, 1, 0.3, 0.38, 0, 0.008, P.paper, sk); framed(F, ib, x + 0.2, FL + 1.66, Wk.z0 + 0.01, 0, 1, 0.3, 0.38, 0, 0.008, P.paper, 'sk' + ((k + 1) % 4)); });

    /* =====================================================================
       4. ВЕСТИБЮЛЬ (обновлённый: керамогранит, стойка с синей орнаментальной полосой, деревянные рейки, эмблема, стенд «История»)
       ===================================================================== */
    const L = RM.L;
    { const nx = 8, nz = 8, tw = (L.x1 - L.x0) / nx, td = (L.z1 - L.z0) / nz; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) G.fy(ib, L.x0 + i * tw, L.x0 + (i + 1) * tw, L.z0 + j * td, L.z0 + (j + 1) * td, FL + 0.006, 1, P.tileL[(i + j) % 2]); }
    [[L.x0, L.x0 + 0.02, L.z0, L.z1], [L.x1 - 0.02, L.x1, L.z0, L.z1]].forEach(([a, b, z0, z1]) => G.box(ib, a, b, FL, FL + 0.08, z0, z1, hex('#BDB6AA'), { skip: { ny: 1 } }));
    [[L.x0, OP.vest.x0 - 0.14], [OP.vest.x1 + 0.14, L.x1]].forEach(([a, b]) => G.box(ib, a, b, FL, FL + 0.08, L.z1 - 0.02, L.z1, hex('#BDB6AA'), { skip: { ny: 1 } }));
    // ковровая дорожка от тамбура к коридору (повтор узора)
    { const x0 = 3.75, x1 = 5.25, z0 = L.z0 + 0.35, z1 = L.z1 - 0.15, n = 3, step = (z1 - z0) / n;
      G.box(ib, x0, x1, FL + 0.006, FL + 0.016, z0, z1, hex('#23305A'), { skip: { ny: 1 } });
      for (let i = 0; i < n; i++) picFlat(F, (x0 + x1) / 2, FL + 0.0175, z0 + step * (i + 0.5), x1 - x0, step, PI, 'runner'); }
    // стойка ресепшена у восточной стены (администратор — между стойкой и стеной)
    { const x0 = 5.45, x1 = 6.0, z0 = 3.7, z1 = 5.2, yt = FL + 1.05;
      G.box(ib, x0, x1, FL, yt, z0, z1, hex('#F4F2EE'), { skip: { ny: 1 } }); G.box(ib, x0 - 0.06, x1 + 0.04, yt, yt + 0.04, z0 - 0.06, z1 + 0.06, P.woodL, { cols: { py: hex('#C99B68') } });
      G.box(ib, x0 - 0.002, x0 + 0.02, FL, FL + 0.06, z0, z1, hex('#3A3B3F'));
      pic(F, x0 - 0.004, FL + 0.66, (z0 + z1) / 2, -1, 0, z1 - z0 - 0.02, 0.19, 'band');
      G.box(ib, x1, 6.45, FL + 0.72, FL + 0.76, z0, z1, P.woodL);   // рабочая полка администратора
      G.box(ib, 6.15, 6.19, FL + 0.76, FL + 0.98, 4.2, 4.65, P.black); G.box(ib, 6.12, 6.14, FL + 0.76, FL + 0.8, 4.35, 4.5, P.black);   // монитор
      item(F, 'vase', x0 + 0.15, yt + 0.04, z0 + 0.22, 0.26, 0, { seg: SEG });
      [[0.0, 0.05], [0.06, -0.04], [-0.04, -0.06]].forEach(([dx, dz], k) => G.sph(ib, x0 + 0.15 + dx, yt + 0.32 + k * 0.03, z0 + 0.22 + dz, 0.05, 0.05, 0.05, [hex('#E8C24A'), hex('#D9455A'), hex('#F2EEE6')][k], { seg: 6, rings: 4 }));
      G.cyl(ib, x0 + 0.12, yt + 0.04, z1 - 0.3, 0.05, 0.05, 0.012, { seg: 7, col: P.gold }); G.sph(ib, x0 + 0.12, yt + 0.06, z1 - 0.3, 0.035, 0.03, 0.035, P.gold, { seg: 6, rings: 3, cut: 0.0 });   // звонок
      [[0, hex('#2E4A8E')], [0.05, hex('#F2EEE6')], [0.1, hex('#B5332E')]].forEach(([dz, cc]) => G.box(ib, x0 + 0.08, x0 + 0.3, yt + 0.04, yt + 0.046 + dz * 0.04, (z0 + z1) / 2 + dz - 0.06, (z0 + z1) / 2 + dz + 0.06, cc));   // буклеты
      // рейки на стене за стойкой
      for (let z = 3.3; z < 5.62; z += 0.12) G.box(ib, L.x1 - 0.05, L.x1 - 0.01, FL, FL + 2.75, z - 0.03, z + 0.03, P.woodL, { cols: { nx: hex('#C08F5E') }, skip: { px: 1 } });
      // два подвеса над стойкой
      [4.05, 4.85].forEach(z => { const x = 5.75; G.cyl(ib, x, FL + 2.55, z, 0.006, 0.006, HC - FL - 2.55, { seg: 4, col: P.black, cap: false }); G.cyl(ib, x, FL + 2.38, z, 0.13, 0.04, 0.18, { seg: 9, col: P.navy });
        G.cyl(glow, x, FL + 2.375, z, 0.12, 0.12, 0.006, { seg: 9, col: P.glowWarm }); lamp(x, FL + 2.33, z); });
      coll(x0 - 0.07, L.x1, z0 - 0.07, z1 + 0.07, FL - 0.5, yt + 0.05, 'kmbDesk');
      out.npcSlots.desk = { lx: 6.42, lz: +((z0 + z1) / 2).toFixed(3), ry: -PI / 2, y: +(FL + OY).toFixed(3) }; }
    // западная стена: эмблема на подложке, ниже — стенд «История комбината»
    { const x = L.x0, ez = (L.z0 + L.z1) / 2;
      G.box(ib, x, x + 0.03, FL + 1.98, FL + 3.12, ez - 0.57, ez + 0.57, hex(embBg), { skip: { nx: 1 } });
      pic(F, x + 0.034, FL + 2.55, ez, 1, 0, 1.06, 1.06, 'emb');
      framed(F, ib, ez, FL + 1.32, x + 0.01, 1, 0, 1.8, 1.125, 0.04, 0.03, P.woodL, 'hist'); }
    // пьедестал с большим кувшином в углу у тамбура, растения, скамья
    { const x = 2.62, z = 6.2; G.box(ib, x - 0.25, x + 0.25, FL, FL + 0.85, z - 0.25, z + 0.25, hex('#EDEAE3'), { skip: { ny: 1 } }); G.box(ib, x - 0.27, x + 0.27, FL + 0.85, FL + 0.88, z - 0.27, z + 0.27, P.woodL);
      item(F, 'jug', x, FL + 0.88, z, 0.62, PI / 2 + 0.6, { seg: SEG + 2, lid: true });
      coll(x - 0.28, x + 0.28, z - 0.28, z + 0.28, FL - 0.5, FL + 1.6, 'kmbPedestal'); }
    [[2.36, 2.42], [6.64, 2.42]].forEach(([x, z], k) => {
      G.cyl(ib, x, FL, z, 0.13, 0.16, 0.48, { seg: 8, col: hex('#EDEAE3') }); G.cyl(ib, x, FL + 0.47, z, 0.15, 0.15, 0.02, { seg: 8, col: hex('#5A4636') });
      G.cyl(ib, x, FL + 0.48, z, 0.018, 0.012, 0.75, { seg: 4, col: hex('#6B5440'), cap: false });
      [[0, 0.75, 0, 0.26], [0.09, 1.0, 0.04, 0.22], [-0.07, 1.12, -0.05, 0.2], [0.02, 1.33, 0.02, 0.17], [-0.05, 0.88, 0.07, 0.18]].forEach(([dx, y, dz, r], i) => G.sph(ib, x + dx, FL + y, z + dz, r, r * 1.15, r, i % 2 ? P.green : P.greenD, { seg: 7, rings: 4 }));
      collC(x, z, 0.18, FL - 0.5, FL + 1.5, 'kmbPlant'); });
    { const x0 = 6.42, x1 = 6.8, z0 = 5.55, z1 = 6.5; for (let i = 0; i < 4; i++) G.box(ib, x0 + i * 0.095, x0 + i * 0.095 + 0.08, FL + 0.42, FL + 0.46, z0, z1, P.woodL);
      [z0 + 0.08, z1 - 0.08].forEach(z => G.box(ib, x0 + 0.02, x1 - 0.02, FL, FL + 0.42, z - 0.02, z + 0.02, P.black, { skip: { ny: 1 } }));
      coll(x0 - 0.02, x1 + 0.03, z0 - 0.02, z1 + 0.02, FL - 0.5, FL + 0.5, 'kmbBench'); }
    // встраиваемые светильники
    ceilP(L.x0, L.x1, L.z0, L.z1, HC - 0.004);
    [[3.4, 3.0], [3.4, 5.9], [4.5, 4.45]].forEach(([x, z]) => { G.cyl(glow, x, HC - 0.012, z, 0.09, 0.09, 0.008, { seg: 9, col: P.glowW }); lamp(x, HC - 0.05, z); });

    /* =====================================================================
       5. ТАМБУР (стеклянный): гранит, коврик с синей каймой, урна, стенд выставки на ножках
       ===================================================================== */
    const Vs = RM.V;
    { const nx = 8, nz = 5, tw = (Vs.x1 - Vs.x0) / nx, td = (Vs.z1 - Vs.z0) / nz; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) G.fy(ib, Vs.x0 + i * tw, Vs.x0 + (i + 1) * tw, Vs.z0 + j * td, Vs.z0 + (j + 1) * td, FL + 0.006, 1, P.gran[(i * 2 + j) % 3]); }
    { const x0 = 3.7, x1 = 5.3, z0 = 8.5, z1 = 9.6; G.box(ib, x0, x1, FL + 0.006, FL + 0.02, z0, z1, hex('#3A3B3E'), { skip: { ny: 1 } });
      [[x0, x1, z0, z0 + 0.07], [x0, x1, z1 - 0.07, z1], [x0, x0 + 0.07, z0, z1], [x1 - 0.07, x1, z0, z1]].forEach(([a, b, c, d]) => G.fy(ib, a, b, c, d, FL + 0.0215, 1, hex('#2E4A8E'))); }
    { const x = 2.62, z = 9.3, p = F.p(x, 0, z); ib.cyl(p[0], FL + OY, p[2], 0.17, 0.17, 0.62, { seg: 9, col: hex('#9AA0A6') }); ib.cyl(p[0], FL + 0.62 + OY, p[2], 0.18, 0.15, 0.04, { seg: 9, col: hex('#3A3B3F') }); collC(x, z, 0.2, FL - 0.5, FL + 0.7, 'kmbBin'); }
    { const x = 6.4, z0 = 7.55, z1 = 8.95, y0 = FL + 0.85, y1 = FL + 1.85;
      [z0 + 0.06, z1 - 0.06].forEach(z => { G.box(ib, x - 0.02, x + 0.02, FL, y1, z - 0.02, z + 0.02, P.steel, { skip: { ny: 1 } }); G.box(ib, x - 0.18, x + 0.18, FL, FL + 0.03, z - 0.04, z + 0.04, P.steelD); });
      G.box(ib, x - 0.025, x + 0.02, y0 - 0.03, y1 + 0.03, z0, z1, P.steel); pic(F, x - 0.029, (y0 + y1) / 2, (z0 + z1) / 2, -1, 0, z1 - z0 - 0.06, y1 - y0, 'vst');
      coll(x - 0.2, x + 0.2, z0 - 0.02, z1 + 0.02, FL - 0.5, y1 + 0.05, 'kmbStand'); }
    ceilP(Vs.x0, Vs.x1, Vs.z0, Vs.z1, HVc - 0.004);
    [[4.5, 7.9], [4.5, 9.1]].forEach(([x, z]) => { G.cyl(glow, x, HVc - 0.012, z, 0.08, 0.08, 0.008, { seg: 9, col: P.glowW }); lamp(x, HVc - 0.05, z); });

    /* =====================================================================
       6. МЕСТА, ЖИТЕЛИ
       ===================================================================== */
    out.npcSlots.owl = { lx: -1.55, lz: -1.8, ry: -PI / 2, y: +(FL + OY).toFixed(3) };   // сова-хранительница: у восточного конца зала, лицом к входу
    const N = named;
    out.spots.push(
      { id: 'museum', lx: -3.3, lz: -1.85, r: 1.3, icon: '🏛️', label: 'Музей комбината', action: 'Посмотреть витрины',
        sheet: { title: 'Музей комбината', text: ['В витринах — серебро: кувшины, кубки, вазы, блюда, кинжалы и пояса.', 'Гравировка, чернь, филигрань, насечка — всё это умеют здешние мастера.'] },
        cam: { pos: [-0.55, FL + 1.75, -2.75], target: [-12.7, FL + 1.05, -3.75], fov: 58 } },
      { id: 'kmb_jug', lx: JUG.x - 0.4, lz: -2.3, r: 0.95, icon: '🏺', label: 'Кувшин мастера', action: 'Рассмотреть',
        sheet: { title: 'Кувшин мастера', text: ['Высокий кувшин с носиком и ручкой — весь в узоре.', N ? 'Узор «тутта» — ветка с парными побегами. Его вырезали резцом, а канавки залили чернью.' : 'Узор-ветка с парными побегами. Его вырезали резцом, а канавки залили чернью.', 'Тёмный узор на светлом серебре — как кружево.'] },
        cam: { pos: [JUG.x + 0.6, FL + 1.45, -2.1], target: [JUG.x, FL + 1.18, -3.15], fov: 40 } },   // место — левее кувшина: героиня сбоку, не в кадре
      { id: 'kmb_work', lx: BENCH[1].x, lz: -3.75, r: 1.3, icon: '⚒️', label: 'Цех мастеров', action: 'Как работают мастера',
        sheet: { title: 'Как работают мастера', text: ['Сначала узор вырезают резцом — это гравировка.', 'Канавки заливают чернью — и рисунок темнеет. Потом изделие полируют до блеска.', 'Филигрань — узор из тонкой серебряной проволоки, как кружево.', 'Умение передают в семьях — от старших к младшим.'] },
        cam: { pos: [BENCH[1].x + 1.2, FL + 1.7, -2.6], target: [BENCH[1].x, FL + 0.95, -5.2], fov: 50 } },
      { id: 'kmb_history', lx: L.x0 + 0.85, lz: (L.z0 + L.z1) / 2, r: 0.95, icon: '📜', label: 'История комбината', action: 'Почитать стенд',
        sheet: { title: 'История комбината', text: ['В 1924 году мастера собрались в артель.', 'В 1960-м артель стала художественным комбинатом.', N ? 'Здесь работают кубачинские мастера: гравировка, чернь, филигрань.' : 'Здесь работают мастера: гравировка, чернь, филигрань.'] },
        cam: { pos: [L.x0 + 2.4, FL + 1.6, (L.z0 + L.z1) / 2 + 0.3], target: [L.x0, FL + 1.6, (L.z0 + L.z1) / 2], fov: 50 } },
    );

    /* ---------- сборка сетки картинок, счёт треугольников ---------- */
    if (ART.n) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(ART.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(ART.N, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(ART.U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(ART.C, 3));
      g.setIndex(ART.n > 65535 ? new T.Uint32BufferAttribute(ART.I, 1) : new T.Uint16BufferAttribute(ART.I, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); if (K.keep) K.keep(g);
      const map = artMap = K.tex ? K.tex(acv) : new T.CanvasTexture(acv); map.anisotropy = Math.max(map.anisotropy || 1, HI ? 4 : 2);
      const mo = { map, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
      const mat = K.BAKED || !K.toon ? new T.MeshBasicMaterial(mo) : K.toon('#FFFFFF', mo); if (K.keep && K.BAKED) K.keep(mat);
      mat.userData.dn = 'none';
      const m = new T.Mesh(g, mat); m.name = 'kombinat:art'; m.castShadow = false; m.receiveShadow = false; m.userData.noRay = true;
      out.meshes.push(m);
    }
    out.stats.ms = { atlas: Math.round(tB - tA), geo: Math.round(now() - tB) };
    out.stats.tris = uniq.reduce((s, b, i) => s + b.count() - tri0[i], 0) + ART.I.length / 3;
    out.stats.art = ART.I.length / 3; out.stats.silver = sv !== ib ? sv.count() - tri0[uniq.indexOf(sv)] : 0;
    out.atlas = acv;
    return out;
  }

  V.kombinatInterior = { SPEC, furnish, silverMat };
})();
