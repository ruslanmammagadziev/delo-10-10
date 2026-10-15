/* =====================================================================
   ОТКРЫТЫЙ ГОРОД (прототип): витрины новых мест (фотостудия, ателье, оранжерея,
   пластинки, книжная лавка, планетарий) — копия js/shops3d.js, регистрируются в WORLD.SHOPS.
   ===================================================================== */
(function () {
  const WORLD = window.WORLD = window.WORLD || {};
  const SHOPS = WORLD.SHOPS = WORLD.SHOPS || {};
  const registerShop = (key, def) => { SHOPS[key] = def; };
  const D = 2.4;                     // глубина коробки за фасадом: за витриной не видно голой земли
  const CREAM = '#FFFDF9', INK = '#3A2E3F', GOLD = '#E8C770', SKIN = '#F7DCC8';
  const HEDGE = ['#9DB08E', '#C9B26A', '#C98A5C', '#D98C8C'];

  /* ---------- общий набор: материалы, склейка, окна, двери, маркизы ---------- */
  function kit(R) {
    const T = R.T, PI = R.PI, K = R.K, g = R.group, mats = {};
    const S = {
      R, T, PI, K, g,
      m: hex => K.m(hex),                                                  // матовый → общий меш с цветами вершин
      glass: hex => K.m(hex || '#FFF1DA', { glow: '#FFC870', gi: 0.35 }),  // тёплое стекло витрин
      bulb: hex => K.m(hex || '#FFE3A3', { glow: '#FFC46B', gi: 0.9 }),    // лампочки
      glint: R.keep(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.42, depthWrite: false })),
      put: R.put, box: R.box, rbox: R.rbox, sph: R.sph, sphS: R.sphS, cyl: R.cyl,
    };
    const geoC = {};
    S.geo = (k, f) => geoC[k] || (geoC[k] = R.keep(f()));
    S.plane = (par, mat, x, y, z, w, h, rz = 0) => { const p = R.plane(par, mat, x, y, z, w, h, rz); p.receiveShadow = false; return p; };

    /* склейка: одна сетка на «вид» материала; всё помечается dyn, чтобы общий bake города его не трогал */
    S.merge = (root, o = {}) => {
      root.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(root.matrixWorld).invert(), M4 = new T.Matrix4(), B = new Map(), gone = [];
      root.traverse(ms => {
        if (!ms.isMesh || ms.userData.dyn) return;
        for (let p = ms.parent; p && p !== root; p = p.parent) if (p.userData.dyn) return;
        const mt = ms.material; let key, kind;
        if (mt.map || mt.transparent || !mt.isMeshToonMaterial) { key = mt; kind = 0; }
        else if (mt.emissive && mt.emissiveIntensity > 0 && mt.emissive.getHex()) { key = 'g' + mt.emissive.getHex() + '|' + mt.emissiveIntensity; kind = 2; }
        else { key = 'b'; kind = 1; }
        if (!B.has(key)) B.set(key, { kind, mt, list: [] });
        B.get(key).list.push(ms); gone.push(ms);
      });
      gone.forEach(ms => ms.parent.remove(ms));
      const out = {};
      B.forEach(({ kind, mt, list }, key) => {
        let n = 0;
        const parts = list.map(ms => { const gg = ms.geometry.index ? ms.geometry.toNonIndexed() : ms.geometry.clone(); gg.applyMatrix4(M4.multiplyMatrices(inv, ms.matrixWorld)); n += gg.attributes.position.count; return [gg, ms.material.color]; });
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ex = new Float32Array(n * (kind ? 3 : 2));
        let off = 0;
        parts.forEach(([gg, col]) => {
          const c = gg.attributes.position.count;
          pos.set(gg.attributes.position.array, off * 3);
          if (gg.attributes.normal) nor.set(gg.attributes.normal.array, off * 3);
          if (kind) for (let i = 0; i < c; i++) { const q = (off + i) * 3; ex[q] = col.r; ex[q + 1] = col.g; ex[q + 2] = col.b; }
          else if (gg.attributes.uv) ex.set(gg.attributes.uv.array, off * 2);
          off += c; gg.dispose();
        });
        const mg = R.keep(new T.BufferGeometry());
        mg.setAttribute('position', new T.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
        mg.setAttribute(kind ? 'color' : 'uv', new T.BufferAttribute(ex, kind ? 3 : 2));
        mg.computeBoundingSphere(); mg.computeBoundingBox();
        const mk = kind === 1 ? 'b' : kind === 2 ? key : null;
        const mat = mk ? (mats[mk] || (mats[mk] = R.toon('#FFFFFF', kind === 2 ? { vertexColors: true, emissive: mt.emissive.clone(), emissiveIntensity: mt.emissiveIntensity } : { vertexColors: true }))) : mt;
        const mesh = new T.Mesh(mg, mat);
        mesh.userData.dyn = true; mesh.castShadow = kind === 1 && o.cast !== false; mesh.receiveShadow = !mt.transparent;
        root.add(mesh); out[kind === 1 ? 'body' : kind === 2 ? key : (mt.userData.tag || 'mat' + Object.keys(out).length)] = mesh;
      });
      return out;
    };

    // в открытом городе витрины склеивает общий кусок города (WORLD mergeChunk): своя склейка не нужна
    S.merge = () => ({});

    /* атлас вывесок: один канвас и один материал на витрину; плоскости получают свой прямоугольник UV */
    S.atlas = (W, H) => {
      const [cv, c] = R.cnv(W, H); let mat = null;
      const A = {
        cv, c, W, H,
        mat() { if (!mat) { mat = R.toon('#FFFFFF', { map: R.tex(cv), alphaTest: 0.5 }); mat.userData.tag = 'sign'; } return mat; },
        uv(geo, rc) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (rc[0] + uv.getX(i) * rc[2]) / W, 1 - (rc[1] + (1 - uv.getY(i)) * rc[3]) / H); uv.needsUpdate = true; return geo; },
        plane(par, rc, x, y, z, w, h, rz = 0) { const ms = S.put(par, R.keep(A.uv(new T.PlaneGeometry(w, h), rc)), A.mat(), [x, y, z], null, [0, 0, rz]); ms.castShadow = false; return ms; },
        disc(par, rc, x, y, z, r, back) {
          const ms = S.put(par, R.keep(A.uv(new T.CircleGeometry(r, 40), rc)), A.mat(), [x, y, z]); ms.castShadow = false;
          if (back) { const b = S.put(par, R.keep(A.uv(new T.CircleGeometry(r, 40), rc)), A.mat(), [x, y, z - 0.004], null, [0, PI, 0]); b.castShadow = false; }
          return ms;
        },
        geo(rc, g0) { return R.keep(A.uv(g0, rc)); },
        refresh() { if (mat) mat.map.needsUpdate = true; },
      };
      return A;
    };

    /* коробка дома: стены, цоколь, карниз */
    S.shell = (P) => {
      S.rbox(g, P.wall, 0, P.H / 2, -D / 2, P.W, P.H, D, 0.14);
      S.rbox(g, P.plinth, 0, 0.17, -D / 2 + 0.03, P.W + 0.1, 0.34, D + 0.06, 0.1);
      // карниз чуть уже, чем у сюжетных домов: соседние витрины стоят в 0.4 м и не должны врезаться друг в друга
      if (P.cap) { S.rbox(g, P.cap, 0, P.H + 0.08, -D / 2, P.W + 0.18, 0.16, D + 0.2, 0.07); S.rbox(g, P.cap, 0, P.H + 0.27, -D / 2, P.W + 0.32, 0.22, D + 0.32, 0.1); }
    };
    /* окно: рама, тёплое стекло, блики, подоконник */
    S.win = (x, y, w, h, o = {}) => {
      const par = o.par || g, fm = o.frame;
      S.put(par, R.frameGeo(w, h, 0.09, !!o.arch), fm, [x, y, 0]);
      if (o.arch) S.put(par, S.geo('arch' + w + 'x' + h, () => new T.ShapeGeometry(R.archShape(w, h), 10)), o.glass || S.glass(o.tint), [x, y - h / 2, 0.02]);
      else S.box(par, o.glass || S.glass(o.tint), x, y, 0.02, w, h, 0.04);
      if (o.glints !== false) { S.plane(par, S.glint, x - w * 0.18, y + h * 0.1, 0.045, 0.07, h * 0.55, -0.55); S.plane(par, S.glint, x - w * 0.05, y + h * 0.16, 0.045, 0.035, h * 0.3, -0.55); }
      if (o.cross) { S.box(par, fm, x, y + h * 0.12, 0.05, w, 0.04, 0.05); S.box(par, fm, x, y, 0.05, 0.04, h, 0.05); }
      if (o.sill !== false) S.rbox(par, fm, x, y - h / 2 - 0.13, 0.11, w + 0.36, 0.09, 0.24, 0.04);
    };
    /* витрина-«ящик»: светящийся задник, рама вглубь, блики стекла спереди — товар стоит внутри */
    S.vitrine = (x, y, w, h, o = {}) => {
      const dp = o.depth || 0.3, t = 0.08, fm = o.frame;
      S.box(g, o.back || S.glass(o.tint), x, y, 0.02, w, h, 0.04);
      S.rbox(g, fm, x, y + h / 2 + t / 2, dp / 2, w + 2 * t, t, dp + 0.04, 0.03);
      S.rbox(g, fm, x, y - h / 2 - t / 2, dp / 2 + 0.03, w + 2 * t + 0.1, t, dp + 0.1, 0.03);
      [-1, 1].forEach(s => S.rbox(g, fm, x + s * (w / 2 + t / 2), y, dp / 2, t, h + 2 * t, dp + 0.04, 0.03));
      S.plane(g, S.glint, x - w * 0.22, y + h * 0.12, dp + 0.03, 0.06, h * 0.6, -0.5);
      S.plane(g, S.glint, x - w * 0.1, y + h * 0.18, dp + 0.03, 0.03, h * 0.32, -0.5);
      S.plane(g, S.glint, x + w * 0.3, y - h * 0.2, dp + 0.03, 0.035, h * 0.25, -0.5);
      return { z: dp, bottom: y - h / 2, top: y + h / 2 };
    };
    /* полосатая маркиза: четверть-цилиндры полосками и фестоны по краю */
    S.awning = (x0, x1, y, depth, rise, ma, mb, o = {}) => {
      const n = Math.max(2, Math.round((x1 - x0) / (o.stripe || 0.3))), st = (x1 - x0) / n;
      const q = S.geo('awq', () => new T.CylinderGeometry(1, 1, 1, 10, 1, false, 0, PI / 2));
      for (let i = 0; i < n; i++) {
        const x = x0 + st * (i + 0.5), m = i % 2 ? mb : ma;
        S.put(g, q, m, [x, y, 0.04], [rise, st, depth], [0, 0, PI / 2]);
        if (o.scallop !== false) S.put(g, R.GEO.halfDisc, o.edge ? (i % 2 ? o.edge[1] : o.edge[0]) : m, [x, y + 0.002, depth + 0.045], [st / 2, 0.03, st * 0.42], [PI / 2, 0, 0]);
      }
      S.rbox(g, o.bar || ma, (x0 + x1) / 2, y + rise + 0.02, 0.06, x1 - x0 + 0.1, 0.09, 0.14, 0.04);
    };
    /* дверь-арка 1.0 × 2.1: наличник, тёплый «интерьер» за створкой, створка на петле слева (своя группа, dyn) */
    S.door = (x, o = {}) => {
      const dw = o.w || 1.0, dh = o.h || 2.1;
      S.put(g, R.extrude(R.archShape(dw + 0.2, dh + 0.1, x), 0.06), o.frame);
      S.put(g, S.geo('inner' + dw, () => new T.ShapeGeometry(R.archShape(dw - 0.02, dh - 0.01), 12)), S.glass('#FFE0AE'), [x, 0, 0.064]);
      S.rbox(g, o.step || o.frame, x, 0.035, 0.2, dw + 0.36, 0.07, 0.36, 0.03);
      const p = new T.Group(); p.position.set(x - dw / 2, 0, 0.068); p.userData.dyn = true; g.add(p);
      S.put(p, R.extrude(R.archShape(dw, dh, dw / 2), 0.07), o.leaf);
      const gl = o.glass || S.glass(o.tint);
      if (o.win === 'round') { S.cyl(p, gl, dw / 2, 1.5, 0.075, 0.2, 0.03, [PI / 2, 0, 0]); S.put(p, R.ringG(0.21, 0.035), o.trim || o.frame, [dw / 2, 1.5, 0.09]); }
      else if (o.win !== 'none') S.put(p, S.geo('dwin' + dw, () => new T.ShapeGeometry(R.archShape(dw * 0.56, 0.62), 10)), gl, [dw / 2, 1.12, 0.072]);
      if (o.panel !== false) S.rbox(p, o.trim || o.frame, dw / 2, 0.5, 0.08, dw * 0.62, 0.5, 0.02, 0.02);
      S.sph(p, o.knob || S.m(GOLD), dw - 0.13, 0.95, 0.105, 0.04);
      if (o.deco) o.deco(p, dw, dh);
      S.merge(p);
      return { p, open: -1.35 };
    };
    /* живая изгородь в просвете между витринами */
    S.hedge = (x, w, seed = 0) => {
      for (let i = 0; i < 3; i++) S.put(g, R.blobGeo, S.m(HEDGE[(seed + i) % 4]), [x, 0.34 - i * 0.02, -0.32 - i * 0.55], [w / 2 + 0.04, 0.36, 0.3], [0, seed + i * 1.7, 0]);
    };
    /* горшок с цветами у двери */
    S.pot = (x, z, pot, leaf, fl, s = 1) => {
      S.put(g, R.GEO.pot, pot, [x, 0.13 * s, z], [0.15 * s, 0.26 * s, 0.15 * s]);
      S.put(g, R.blobGeo, leaf, [x, 0.3 * s, z], [0.17 * s, 0.1 * s, 0.17 * s]);
      [[0, 0.4, 0, 0.08], [0.09, 0.35, 0.04, 0.065], [-0.08, 0.36, 0.05, 0.065], [0.03, 0.36, -0.08, 0.06]].forEach(([dx, dy, dz, r], i) => S.sphS(g, fl[i % fl.length], x + dx * s, dy * s, z + dz * s, r * s, r * s * 0.8, r * s));
    };
    S.text = (c, s, x, y, size, col, o) => R.text(c, s, x, y, size, col, o);
    S.rr = (c, x, y, w, h, r) => R.rrect(c, x, y, w, h, r);
    return S;
  }

  /* вывеска-доска на канвасе: крупное слово Comfortaa 700 и строка Nunito 800 */
  function board(S, A, rc, o) {
    const c = A.c, [x, y, w, h] = rc;
    c.fillStyle = o.bg; S.rr(c, x + 4, y + 4, w - 8, h - 8, o.r || 34); c.fill();
    if (o.border) { c.strokeStyle = o.border; c.lineWidth = o.bw || 8; S.rr(c, x + 16, y + 16, w - 32, h - 32, (o.r || 34) - 10); c.stroke(); }
    if (o.dots) { c.fillStyle = o.dots; [[x + 40, y + h / 2], [x + w - 40, y + h / 2]].forEach(([px, py]) => { c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill(); }); }
    S.text(c, o.big, x + w / 2, y + h * (o.small ? 0.4 : 0.52), o.bigSize, o.col, { f: 'Comfortaa', w: 700, max: w - (o.pad || 120) });
    if (o.small) S.text(c, o.small, x + w / 2, y + h * 0.79, o.smallSize || Math.round(h * 0.2), o.col2 || o.col, { w: 800, max: w - (o.pad || 120) - 40 });
  }
  const star5 = (S, r0, r1) => { const s = new S.T.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; };

  /* ================= Фотостудия «Светопись» ================= */
  function portraitArt(c, x, y, w, h, kind, look) {
    const E = (ex, ey, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x + ex * w, y + ey * h, rx * w, ry * w, 0, 0, 7); c.fill(); };
    const BG = { poodle: '#DDF0E6', pigeon: '#F8E6EC', raccoon: '#FFF1C9', empty: '#FFF6EE' };
    c.fillStyle = BG[kind] || '#FFF6EE'; c.fillRect(x, y, w, h);
    const eyes = (ex, ey, d, r) => { E(ex - d, ey, r, r * 1.15, '#2E2A3B'); E(ex + d, ey, r, r * 1.15, '#2E2A3B'); E(ex - d + r * 0.35, ey - r * 0.4, r * 0.35, r * 0.35, '#FFFFFF'); E(ex + d + r * 0.35, ey - r * 0.4, r * 0.35, r * 0.35, '#FFFFFF'); };
    if (kind === 'poodle') {   // Пудра и гусёнок
      E(0.5, 0.86, 0.42, 0.22, '#F6DCE3');
      [[0.3, 0.3], [0.5, 0.22], [0.7, 0.3], [0.26, 0.48], [0.74, 0.48]].forEach(([a, b]) => E(a, b, 0.17, 0.17, '#FBEAEE'));
      E(0.5, 0.5, 0.25, 0.23, '#FFF4F6'); E(0.2, 0.58, 0.1, 0.18, '#F3CBD6'); E(0.8, 0.58, 0.1, 0.18, '#F3CBD6');
      eyes(0.5, 0.48, 0.1, 0.035); E(0.5, 0.6, 0.05, 0.035, '#3A2E3F');
      E(0.78, 0.83, 0.13, 0.12, '#FFE07A'); E(0.73, 0.8, 0.02, 0.022, '#2E2A3B'); E(0.86, 0.83, 0.05, 0.025, '#F2A04A');
    } else if (kind === 'pigeon') {
      E(0.5, 0.86, 0.36, 0.24, '#B9B4CC'); E(0.5, 0.64, 0.24, 0.13, '#9FD2C0'); E(0.5, 0.67, 0.2, 0.08, '#E6A9C6');
      E(0.5, 0.42, 0.22, 0.22, '#C9C4DA'); eyes(0.5, 0.4, 0.09, 0.03); E(0.5, 0.52, 0.05, 0.03, '#F2A04A');
    } else if (kind === 'raccoon') {   // енот с платочком
      E(0.27, 0.22, 0.1, 0.12, '#8D8496'); E(0.73, 0.22, 0.1, 0.12, '#8D8496');
      E(0.5, 0.48, 0.32, 0.28, '#B1A9BA'); E(0.5, 0.45, 0.28, 0.1, '#4A4152'); E(0.5, 0.62, 0.16, 0.11, '#F4EFF3');
      eyes(0.5, 0.45, 0.13, 0.035); E(0.5, 0.57, 0.04, 0.03, '#2E2A3B');
      c.fillStyle = '#F7A8BE'; c.beginPath(); c.moveTo(x + 0.62 * w, y + 0.95 * h); c.lineTo(x + 0.96 * w, y + 0.7 * h); c.lineTo(x + 0.92 * w, y + 0.98 * h); c.closePath(); c.fill();
      E(0.5, 0.95, 0.4, 0.16, '#B1A9BA');
    } else {   // пустая рамка: ждёт свою фотокарточку
      c.strokeStyle = '#D9CCF4'; c.lineWidth = 4; c.setLineDash([9, 7]); c.strokeRect(x + 12, y + 12, w - 24, h - 24); c.setLineDash([]);
      E(0.5, 0.5, 0.05, 0.05, '#E6DDF6');
    }
  }
  function PI2(k) { return Math.PI * k; }

  registerShop('photo', {
    x: -14.8, w: 3.4, h: 3.85, doorDx: 0, name: 'Фотостудия',
    garland: [[-1.68, 3.62, 0.16], [1.68, 3.62, 0.16]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, W = 3.4, H = 3.85;
      const wall = S.m('#D9CCF4'), cream = S.m(CREAM), ink = S.m(INK), lav = S.m('#B7A6E3'), lavD = S.m('#8E7BC4'), gold = S.m(GOLD), silver = S.m('#DCE1E8');
      S.shell({ W, H, wall, plinth: S.m('#BCA9E4'), cap: cream });
      R.lace(g, cream, -1.62, 1.62, H - 0.02, 0.1, 0.09, lav);
      // вывеска
      const A = S.atlas(1024, 384);
      board(S, A, [0, 0, 1024, 256], { bg: CREAM, border: INK, bw: 7, big: 'СВЕТОПИСЬ', bigSize: 120, small: 'фото · вспышка · без солнца', smallSize: 54, col: INK, col2: '#7D68B8', dots: '#B7A6E3' });
      S.rbox(g, ink, 0, 3.32, 0.1, 3.02, 0.8, 0.16, 0.08);
      A.plane(g, [0, 0, 1024, 256], 0, 3.32, 0.185, 2.92, 0.73);
      // витрина слева: три крошечные карточки и пустая четвёртая рамка
      const look = null;
      const kinds = ['poodle', 'pigeon', 'raccoon', 'empty'];
      kinds.forEach((k, i) => portraitArt(A.c, 8 + i * 124, 262, 112, 120, k, look));
      const vx = -1.14, v = S.vitrine(vx, 1.38, 0.8, 1.2, { frame: cream, depth: 0.26, tint: '#FFF4E6' });
      const fr = [gold, ink, cream, gold];
      [[-0.2, 0.26, 0.05], [0.2, 0.28, -0.04], [-0.2, -0.24, -0.03], [0.2, -0.22, 0.04]].forEach(([dx, dy, rz], i) => {
        const fx = vx + dx, fy = 1.38 + dy, z = 0.075;
        S.rbox(g, fr[i], fx, fy, z, 0.35, 0.38, 0.04, 0.015, [0, 0, rz]);
        A.plane(g, [8 + i * 124, 262, 112, 120], fx, fy, z + 0.022, 0.28, 0.3, rz);
      });
      S.box(g, lavD, vx, v.bottom + 0.03, 0.14, 0.8, 0.02, 0.22);
      // круглое окно-объектив справа
      const lx = 1.14, ly = 1.45;
      S.cyl(g, S.glass('#EFE8FF'), lx, ly, 0.03, 0.38, 0.05, [PI / 2, 0, 0]);
      S.put(g, R.ringG(0.42, 0.075), ink, [lx, ly, 0.07]);
      S.put(g, R.ringG(0.28, 0.024), lavD, [lx, ly, 0.075]);
      S.cyl(g, S.m('#2E3558'), lx, ly, 0.065, 0.17, 0.03, [PI / 2, 0, 0]); S.put(g, R.ringG(0.17, 0.02), lav, [lx, ly, 0.08]);
      S.sphS(g, S.m('#FFFFFF'), lx - 0.06, ly + 0.06, 0.085, 0.035, 0.035, 0.01);
      S.put(g, R.ringG(0.5, 0.025), cream, [lx, ly, 0.05]);
      S.plane(g, S.glint, lx - 0.12, ly + 0.1, 0.08, 0.05, 0.3, -0.7); S.plane(g, S.glint, lx - 0.02, ly + 0.17, 0.08, 0.03, 0.14, -0.9);
      S.rbox(g, cream, lx, ly - 0.58, 0.1, 0.7, 0.08, 0.2, 0.03);
      // лавандово-кремовые маркизы над окнами
      S.awning(-1.66, -0.62, 2.12, 0.62, 0.42, lav, cream, { bar: lavD, stripe: 0.26 });
      S.awning(0.62, 1.66, 2.12, 0.62, 0.42, lav, cream, { bar: lavD, stripe: 0.26 });
      // вывеска-фотоаппарат с мехами над дверью; вспышка светится
      const cy = 2.55;
      [-0.2, 0.2].forEach(dx => S.box(g, ink, dx, cy - 0.17, 0.1, 0.06, 0.06, 0.2));
      S.rbox(g, ink, 0, cy, 0.25, 0.66, 0.44, 0.3, 0.06);
      S.rbox(g, lav, 0, cy - 0.12, 0.405, 0.66, 0.12, 0.02, 0.02);
      [[0.46, 0.4, 0.45], [0.41, 0.36, 0.52], [0.36, 0.32, 0.59], [0.31, 0.28, 0.66]].forEach(([w, h, z], i) => S.rbox(g, i % 2 ? lavD : lav, 0, cy, z, w, h, 0.075, 0.025));
      S.rbox(g, gold, 0, cy, 0.72, 0.3, 0.3, 0.045, 0.02);
      S.cyl(g, ink, 0, cy, 0.78, 0.115, 0.1, [PI / 2, 0, 0]); S.put(g, R.ringG(0.115, 0.018), gold, [0, cy, 0.83]);
      S.cyl(g, S.glass('#E9F0FF'), 0, cy, 0.832, 0.08, 0.01, [PI / 2, 0, 0]);
      S.rbox(g, gold, -0.2, cy + 0.26, 0.25, 0.14, 0.08, 0.12, 0.02);
      S.cyl(g, silver, 0.2, cy + 0.27, 0.25, 0.014, 0.12);
      S.put(g, R.GEO.cone, silver, [0.2, cy + 0.35, 0.28], [0.1, 0.075, 0.1], [-PI / 2 + 0.3, 0, 0]);
      const flash = S.bulb('#FFF8DA'); S.sph(g, flash, 0.2, cy + 0.35, 0.32, 0.055);
      // дверь — чернильная, с круглым окошком
      const door = S.door(0, { frame: cream, leaf: ink, trim: lav, win: 'round', tint: '#F1EBFF', step: S.m('#C3B3E6') });
      S.pot(-0.78, 0.24, S.m('#B9A5E8'), S.m('#8FAE62'), [S.m('#C9B6F0'), S.m('#F7C9D3')]);
      S.pot(0.8, 0.24, S.m('#B9A5E8'), S.m('#8FAE62'), [S.m('#FFFDF9'), S.m('#C9B6F0')], 0.9);
      S.hedge(W / 2 + 0.2, 0.42, 1);
      const out = S.merge(g);
      const fm = out['g' + new T.Color('#FFC46B').getHex() + '|0.9'];
      return {
        doors: [door],
        // если улица когда-нибудь позовёт tick витрин: вспышка мигает раз в 6 с
        tick(t) { if (fm) fm.material.emissiveIntensity = (t % 6) < 0.25 ? 2.2 : 0.9; },
      };
    },
  });

  /* ================= Ателье «Бант и берет» ================= */
  registerShop('atelier', {
    x: -11.0, w: 3.4, h: 3.9, doorDx: 0, name: 'Ателье',
    garland: [[-1.68, 3.62, 0.16], [1.68, 3.62, 0.16]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, W = 3.4, H = 3.9;
      const wall = S.m('#FBE1E7'), cream = S.m(CREAM), cherry = S.m('#C2405B'), cherryD = S.m('#9E2F47'), gold = S.m(GOLD),
        trench = S.m('#E9D4B6'), trenchD = S.m('#D2B48E'), powder = S.m('#F7C9D3'), mann = S.m('#F3E6D6'), btn = S.m('#8A5A44');
      S.shell({ W, H, wall, plinth: S.m('#F0C3CF'), cap: cream });
      R.lace(g, cream, -1.62, 1.62, H - 0.02, 0.1, 0.09, S.m('#F7C9D3'));
      const A = S.atlas(1024, 256);
      board(S, A, [0, 0, 1024, 256], { bg: CREAM, border: '#C2405B', bw: 7, big: 'БАНТ и БЕРЕТ', bigSize: 112, small: 'ателье · примерочная · зеркало', smallSize: 52, col: '#C2405B', col2: '#9E2F47', dots: '#F7C9D3' });
      S.rbox(g, cherry, 0, 3.4, 0.1, 3.02, 0.8, 0.16, 0.08);
      A.plane(g, [0, 0, 1024, 256], 0, 3.4, 0.185, 2.92, 0.73);
      // фестончатая маркиза вишня/крем во всю ширину
      S.awning(-1.72, 1.72, 2.36, 0.72, 0.46, cherry, cream, { bar: cherryD, stripe: 0.29 });
      // огромный вишнёвый бант над дверью — на краю маркизы
      R.bow(g, cherry, 0, 2.56, 0.9, 0.66);
      S.sph(g, cherryD, 0, 2.56, 1.0, 0.1, 0.11, 0.06);
      // левая витрина: манекен в бежевом тренче
      const vx = -1.14, v = S.vitrine(vx, 1.36, 0.8, 1.2, { frame: cream, depth: 0.34, tint: '#FFEFE8' });
      { const mx = vx, mz = 0.17, b0 = v.bottom;
        S.cyl(g, gold, mx, b0 + 0.015, mz, 0.12, 0.03); S.cyl(g, gold, mx, b0 + 0.18, mz, 0.014, 0.34);
        S.put(g, S.geo('skirt', () => new T.CylinderGeometry(0.12, 0.19, 0.34, 16)), trench, [mx, b0 + 0.48, mz]);
        S.put(g, S.geo('torso', () => new T.CapsuleGeometry(0.115, 0.26, 4, 12)), trench, [mx, b0 + 0.78, mz], [1, 1, 0.72]);
        S.cyl(g, trenchD, mx, b0 + 0.66, mz, 0.125, 0.04).scale.set(0.125, 0.04, 0.095);
        S.rbox(g, gold, mx, b0 + 0.66, mz + 0.09, 0.05, 0.04, 0.02, 0.008);
        [-1, 1].forEach(s => { S.box(g, trenchD, mx + s * 0.05, b0 + 0.93, mz + 0.07, 0.07, 0.15, 0.02, [0, 0, s * 0.45]); S.put(g, S.geo('arm', () => new T.CapsuleGeometry(0.035, 0.3, 3, 8)), trench, [mx + s * 0.15, b0 + 0.74, mz], null, [0, 0, s * 0.12]); });
        [[-0.04, 0.84], [0.04, 0.84], [-0.04, 0.58], [0.04, 0.58]].forEach(([dx, dy]) => S.sphS(g, btn, mx + dx, b0 + dy, mz + 0.085, 0.014));
        S.cyl(g, mann, mx, b0 + 1.03, mz, 0.03, 0.06); S.sph(g, mann, mx, b0 + 1.09, mz, 0.07, 0.075, 0.07);
        S.put(g, R.blobGeo, powder, [mx + 0.01, b0 + 1.15, mz], [0.095, 0.033, 0.095], [0, 0, 0.18]); }
      // правая витрина: шляпная стойка с пудровым беретом и шляпная коробка
      const hx = 1.14, v2 = S.vitrine(hx, 1.36, 0.8, 1.2, { frame: cream, depth: 0.34, tint: '#FFEFE8' });
      { const b0 = v2.bottom, z = 0.17;
        S.cyl(g, cherryD, hx + 0.12, b0 + 0.015, z, 0.09, 0.03); S.cyl(g, cherryD, hx + 0.12, b0 + 0.42, z, 0.014, 0.8); S.sph(g, mann, hx + 0.12, b0 + 0.86, z, 0.07, 0.075, 0.07);
        S.put(g, R.blobGeo, powder, [hx + 0.13, b0 + 0.93, z], [0.15, 0.05, 0.15], [0, 0, -0.2]); S.cyl(g, powder, hx + 0.13, b0 + 0.985, z, 0.012, 0.03);
        S.cyl(g, cream, hx - 0.17, b0 + 0.13, z + 0.02, 0.14, 0.24); S.cyl(g, cherry, hx - 0.17, b0 + 0.13, z + 0.02, 0.143, 0.04); S.cyl(g, powder, hx - 0.17, b0 + 0.265, z + 0.02, 0.15, 0.03);
        R.bowAt(g, cherry, cherryD, hx - 0.17, b0 + 0.31, z + 0.06, 0.9);
        [S.m('#BFE6D3'), S.m('#FFD98A'), S.m('#B9A5E8')].forEach((m, i) => S.cyl(g, m, hx - 0.3 + i * 0.09, b0 + 0.05, z + 0.12, 0.035, 0.07)); }
      // дверь вишнёвая с арочным окошком и маленьким бантом
      const door = S.door(0, { frame: cream, leaf: cherry, trim: S.m('#F7C9D3'), tint: '#FFF1EA', step: S.m('#F0C3CF'),
        deco: (p, dw) => R.bowAt(p, cream, S.m('#F7C9D3'), dw / 2, 1.62, 0.16, 1.2) });
      S.pot(-0.8, 0.24, S.m('#FFFDF9'), S.m('#8FAE62'), [S.m('#F08FA8'), S.m('#F7C9D3')]);
      S.pot(0.8, 0.24, S.m('#FFFDF9'), S.m('#8FAE62'), [S.m('#C2405B'), S.m('#F7C9D3')], 0.9);
      S.hedge(W / 2 + 0.22, 0.44, 2);
      S.merge(g);
      return { doors: [door] };
    },
  });

  /* ================= Оранжерея «Тепло» ================= */
  registerShop('orangery', {
    x: -7.2, w: 3.3, h: 3.6, doorDx: 0, name: 'Оранжерея',
    garland: [[-1.65, 2.5, 0.08], [1.65, 2.5, 0.08]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, W = 3.3, HW = 2.5, HR = 3.55, w2 = W / 2;
      const frame = S.m(CREAM), terra = S.m('#C98A5C'), terraL = S.m('#E0A77A'), leaf = S.m('#6FA77E'), leafD = S.m('#4F8A63'), leafL = S.m('#9BCB86'),
        lemon = S.m('#F6D55C'), orange = S.m('#F7A24A'), band = S.m('#9DB08E'), trunk = S.m('#8A6A55'), honey = S.m('#E8B04A'), back = S.m('#A9D3B6');
      const glassM = R.toon('#BFE6D3', { transparent: true, opacity: 0.36, depthWrite: false }); glassM.userData.tag = 'glass';
      // кирпичный цоколь и пол
      S.rbox(g, terra, 0, 0.24, -D / 2, W, 0.48, D, 0.05);
      for (let i = 0; i < 6; i++) S.box(g, terraL, -w2 + 0.28 + i * 0.55, 0.16 + (i % 2) * 0.16, 0.003, 0.44, 0.02, 0.01);
      S.rbox(g, frame, 0, 0.5, -D / 2, W + 0.08, 0.06, D + 0.08, 0.02);
      // задняя стена (не просвечивает), щипец сзади
      const gable = new T.Shape(); gable.moveTo(-w2, 0); gable.lineTo(w2, 0); gable.lineTo(w2, HW); gable.lineTo(0, HR); gable.lineTo(-w2, HW); gable.closePath();
      S.put(g, R.extrude(gable, 0.05), back, [0, 0, -D]);
      // каркас: белые переплёты
      const mull = (x, y, z, w, h, d) => S.box(g, frame, x, y, z, w, h, d);
      [-w2, -1.1, -0.6, 0.6, 1.1, w2].forEach(x => mull(x, (0.5 + HW) / 2, 0, Math.abs(x) === w2 ? 0.09 : 0.06, HW - 0.5, 0.08));
      [1.5, HW].forEach(y => { mull(-(w2 + 0.6) / 2, y, 0, w2 - 0.6, 0.06, 0.08); mull((w2 + 0.6) / 2, y, 0, w2 - 0.6, 0.06, 0.08); });
      [-1, 1].forEach(s => {
        [0, -0.8, -1.6, -D].forEach(z => mull(s * w2, (0.5 + HW) / 2, z, 0.08, HW - 0.5, 0.08));
        [1.5, HW].forEach(y => mull(s * w2, y, -D / 2, 0.07, 0.06, D));
        // скат крыши: стропила и конёк
        const L = Math.hypot(w2, HR - HW), ang = Math.atan2(HR - HW, w2);
        [0, -0.8, -1.6, -D].forEach(z => S.box(g, frame, s * w2 / 2, (HW + HR) / 2, z, L + 0.08, 0.07, 0.08, [0, 0, -s * ang]));
        S.box(g, frame, s * w2 / 2, (HW + HR) / 2 - 0.02, -D / 2, 0.06, 0.06, D, [0, 0, -s * ang]);
      });
      S.box(g, frame, 0, HR, -D / 2, 0.09, 0.09, D + 0.1);
      for (let i = 0; i < 9; i++) S.sphS(g, frame, 0, HR + 0.07, -0.05 - i * 0.29, 0.04);
      S.sph(g, S.m(GOLD), 0, HR + 0.12, 0.02, 0.07);
      // стекло: одна прозрачная сетка (перед, бока, скаты, щипец)
      const gp = (geo, p, r) => { const m = S.put(g, geo, glassM, p, null, r); m.castShadow = false; return m; };
      const pl = (w, h) => R.keep(new T.PlaneGeometry(w, h));
      [-1, 1].forEach(s => {
        gp(pl(w2 - 0.6, HW - 0.5), [s * (w2 + 0.6) / 2, (HW + 0.5) / 2, 0.005]);
        gp(pl(D, HW - 0.5), [s * w2, (HW + 0.5) / 2, -D / 2], [0, s * PI / 2, 0]);
        const L = Math.hypot(w2, HR - HW), ang = Math.atan2(HR - HW, w2);
        gp(pl(L, D), [s * w2 / 2, (HW + HR) / 2 + 0.012, -D / 2]).rotation.set(-PI / 2, 0, -s * ang, 'ZYX');
      });
      const tri = new T.Shape(); tri.moveTo(-w2, HW); tri.lineTo(w2, HW); tri.lineTo(0, HR); tri.closePath();
      gp(R.keep(new T.ShapeGeometry(tri)), [0, 0, 0.005]);
      // внутри: растения и «лампы вместо солнца»
      const blob = (m, x, y, z, sx, sy, sz) => S.put(g, R.blobGeo, m, [x, y, z], [sx, sy || sx, sz || sx], [0, x * 3, 0]);
      S.cyl(g, frame, -0.95, 0.68, -1.2, 0.22, 0.36); S.cyl(g, trunk, -0.95, 1.1, -1.2, 0.04, 0.6);
      blob(leaf, -0.95, 1.6, -1.2, 0.5, 0.42); blob(leafL, -0.75, 1.82, -1.05, 0.28); blob(leafD, -1.2, 1.45, -1.0, 0.3);
      [[-0.7, 1.45, -0.8], [-1.15, 1.7, -0.85], [-0.9, 1.95, -0.85], [-0.6, 1.7, -0.95]].forEach(([x, y, z]) => S.sphS(g, orange, x, y, z, 0.065));
      S.cyl(g, terra, 0.95, 0.66, -1.5, 0.24, 0.32);
      for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; S.put(g, R.leafUp, i % 2 ? leaf : leafD, [0.95 + Math.cos(a) * 0.2, 1.25, -1.5 + Math.sin(a) * 0.2], [0.28, 0.9, 0.28], [Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5]).castShadow = false; }
      blob(leafL, 1.1, 0.95, -0.7, 0.32, 0.26); blob(leaf, 0.6, 0.85, -0.55, 0.26, 0.22);
      [[-1.3, -0.35], [-0.95, -0.3], [1.0, -0.3], [1.35, -0.35]].forEach(([x, z], i) => { S.put(g, R.GEO.pot, terra, [x, 0.6, z], [0.09, 0.16, 0.09]); blob(i % 2 ? leafL : leaf, x, 0.74, z, 0.1, 0.08); S.sphS(g, S.m(['#F7C9D3', '#FFD98A', '#F08FA8', '#FFFDF9'][i]), x, 0.8, z + 0.02, 0.05); });
      // «лампы вместо солнца»: три тёплые лампочки на шнурах
      [-0.8, 0, 0.8].forEach(x => { const top = HR - (HR - HW) * Math.abs(x) / w2 - 0.03, by = top - (x ? 0.32 : 0.55); S.cyl(g, S.m('#7A6670'), x, (top + by) / 2, -1.1, 0.006, top - by); S.put(g, R.GEO.cone, S.m('#7A6670'), [x, by + 0.07, -1.1], [0.07, 0.06, 0.07]); S.sph(g, S.bulb('#FFE9B5'), x, by, -1.1, 0.055); });
      // медовая табличка-соты «ТЕПЛО»
      const A = S.atlas(768, 320), c = A.c;
      { const pw = 760, ph = 300, cx = 384, cy = 152;
        const hexP = (x, y, w, h) => { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2 + h / 2, y - h / 2); c.lineTo(x + w / 2 - h / 2, y - h / 2); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2 - h / 2, y + h / 2); c.lineTo(x - w / 2 + h / 2, y + h / 2); c.closePath(); };
        hexP(cx, cy, pw - 8, ph - 8); c.fillStyle = '#E8B04A'; c.fill();
        hexP(cx, cy, pw - 40, ph - 40); c.fillStyle = '#FFD98A'; c.fill();
        c.strokeStyle = 'rgba(158,107,46,0.22)'; c.lineWidth = 4;
        const cell = (x, y, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.stroke(); };
        [[120, 110], [150, 162], [120, 214], [650, 110], [618, 162], [650, 214], [90, 162], [680, 162]].forEach(([x, y]) => cell(x, y, 26));
        S.text(c, 'ТЕПЛО', cx, cy - 26, 124, '#8A5A22', { f: 'Comfortaa', w: 700, max: 470 });
        S.text(c, 'оранжерея семьи Жу', cx, cy + 78, 50, '#8A5A22', { w: 800, max: 500 });
        // пчёлка-подпись
        c.fillStyle = '#3A2E3F'; c.beginPath(); c.ellipse(560, 72, 22, 16, 0, 0, 7); c.fill(); c.fillStyle = '#FFD45E'; c.fillRect(548, 58, 8, 28); c.fillRect(564, 58, 8, 28);
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(552, 50, 12, 9, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(570, 50, 12, 9, 0.5, 0, 7); c.fill(); }
      const plate = new T.Shape(); { const pw = 1.9, ph = 0.76; plate.moveTo(-pw / 2, 0); plate.lineTo(-pw / 2 + ph / 2, ph / 2); plate.lineTo(pw / 2 - ph / 2, ph / 2); plate.lineTo(pw / 2, 0); plate.lineTo(pw / 2 - ph / 2, -ph / 2); plate.lineTo(-pw / 2 + ph / 2, -ph / 2); plate.closePath(); }
      S.put(g, R.extrude(plate, 0.06), honey, [0, 2.92, 0.04]);
      A.plane(g, [0, 0, 768, 304], 0, 2.92, 0.106, 1.92, 0.76);
      // дверь: белая рама, мятное стекло
      const door = S.door(0, { frame, leaf: S.m('#8CCBB0'), trim: frame, tint: '#E6F6EC', step: terra, panel: false,
        deco: (p, dw) => { S.put(p, S.geo('ogl', () => new T.ShapeGeometry(R.archShape(dw * 0.7, 1.5), 10)), S.glass('#E6F6EC'), [dw / 2, 0.42, 0.072]); S.box(p, frame, dw / 2, 1.05, 0.075, dw * 0.7, 0.05, 0.02); } });
      // лимонные кадки и горшки у двери
      [-1, 1].forEach(s => {
        const x = s * 0.98;
        S.cyl(g, frame, x, 0.2, 0.2, 0.17, 0.4); S.cyl(g, band, x, 0.3, 0.2, 0.175, 0.06);
        S.cyl(g, trunk, x, 0.62, 0.2, 0.025, 0.46); blob(leaf, x, 1.0, 0.2, 0.27, 0.25, 0.22); blob(leafL, x + 0.1, 1.12, 0.24, 0.13);
        [[0.12, 0.92, 0.36], [-0.14, 1.04, 0.32], [0.04, 1.17, 0.34], [-0.06, 0.88, 0.38]].forEach(([dx, y, z]) => S.sph(g, lemon, x + dx, y, z, 0.05, 0.042, 0.042));
      });
      S.pot(-1.45, 0.2, terra, leaf, [S.m('#F7C9D3'), S.m('#FFFDF9')], 0.85); S.pot(1.45, 0.22, terra, leaf, [S.m('#FFD98A'), S.m('#F7A24A')], 0.8);
      S.merge(g);
      return { doors: [door] };
    },
  });

  /* ================= Пластинки «Сторона Б» ================= */
  registerShop('records', {
    x: 30.1, w: 3.4, h: 3.8, doorDx: 0, name: 'Пластинки',
    garland: [[-1.68, 3.5, 0.16], [1.68, 3.5, 0.16]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, W = 3.4, H = 3.8;
      const wall = S.m('#FFF1A8'), ink = S.m(INK), cream = S.m('#FFF4EC'), lav = S.m('#D9CCF4'), lavD = S.m('#B9A5E8'), pink = S.m('#F7C9D3'), vinyl = S.m('#2E2A3B'), gold = S.m(GOLD);
      const sleeves = ['#BFE6D3', '#F7C9D3', '#D9CCF4', '#FFD3A8', '#9FC2E8', '#F08FA8', '#FFF4EC'].map(h => S.m(h));
      S.shell({ W, H, wall, plinth: lavD, cap: ink });
      // клавиши под карнизом
      for (let i = 0; i < 17; i++) S.box(g, cream, -1.6 + i * 0.2, H - 0.13, 0.06, 0.18, 0.2, 0.06);
      for (let i = 0; i < 16; i++) if (i % 7 !== 2 && i % 7 !== 6) S.box(g, ink, -1.5 + i * 0.2, H - 0.08, 0.1, 0.1, 0.12, 0.04);
      // вывеска
      const A = S.atlas(1024, 512), c = A.c;
      board(S, A, [0, 0, 1024, 256], { bg: INK, border: '#F7C9D3', bw: 6, big: 'СТОРОНА Б', bigSize: 120, small: 'пластинки · будка · джаз', smallSize: 54, col: '#FFF4EC', col2: '#D9CCF4', dots: '#F7C9D3' });
      S.rbox(g, lavD, 0, 3.14, 0.1, 3.04, 0.8, 0.16, 0.08);
      A.plane(g, [0, 0, 1024, 256], 0, 3.14, 0.185, 2.92, 0.73);
      // большая пластинка на крыше: бороздки, розовая наклейка с «Б»
      { const cx = 128, cy = 384, r = 124;
        c.fillStyle = '#2E2A3B'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.09)'; c.lineWidth = 2; for (let k = 50; k < r - 6; k += 7) { c.beginPath(); c.arc(cx, cy, k, 0, 7); c.stroke(); }
        c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, r * 0.72, -2.5, -1.9); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.86, 0.6, 1.1); c.stroke();
        c.fillStyle = '#F7C9D3'; c.beginPath(); c.arc(cx, cy, 46, 0, 7); c.fill();
        c.strokeStyle = '#C2405B'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 40, 0, 7); c.stroke();
        S.text(c, 'Б', cx, cy + 2, 46, '#C2405B', { f: 'Comfortaa', w: 700 }); c.fillStyle = '#2E2A3B'; c.beginPath(); c.arc(cx, cy + 26, 5, 0, 7); c.fill(); }
      const rec = new T.Group(); rec.position.set(0, H + 1.28, -0.35); rec.userData.dyn = true; g.add(rec);
      A.disc(rec, [4, 260, 248, 248], 0, 0, 0.012, 0.86, true);
      S.merge(rec);
      S.cyl(g, ink, 0, H + 0.6, -0.4, 0.05, 0.5); S.rbox(g, ink, 0, H + 0.42, -0.4, 0.5, 0.1, 0.3, 0.04);
      S.cyl(g, gold, 0, H + 1.28, -0.33, 0.035, 0.08, [PI / 2, 0, 0]);
      // ноты на проволочках
      const note = (x, y, z, m, s) => { S.sph(g, m, x, y, z, 0.07 * s, 0.055 * s, 0.04 * s); S.box(g, m, x + 0.06 * s, y + 0.17 * s, z, 0.022 * s, 0.34 * s, 0.03 * s); S.box(g, m, x + 0.11 * s, y + 0.3 * s, z, 0.1 * s, 0.03 * s, 0.03 * s, [0, 0, -0.5]); S.cyl(g, S.m('#7A6670'), x + 0.06 * s, y - 0.4 * s, z - 0.02, 0.005, 0.7 * s); };
      note(-1.15, H + 1.25, -0.5, ink, 1.1); note(1.05, H + 1.55, -0.5, S.m('#C2405B'), 0.9);
      // витрины с пастельными конвертами
      [-1.14, 1.14].forEach((vx, wi) => {
        const v = S.vitrine(vx, 1.38, 0.8, 1.2, { frame: ink, depth: 0.26, tint: '#FFF6DE' });
        const b0 = v.bottom;
        S.box(g, cream, vx, b0 + 0.55, 0.12, 0.8, 0.025, 0.2);
        [[-0.2, 0.08, -0.08], [0.17, 0.12, 0.1]].forEach(([dx, dz, rz], i) => { const m = sleeves[(i + wi * 3) % 7]; S.box(g, m, vx + dx, b0 + 0.21, 0.09 + dz * 0.3, 0.32, 0.32, 0.02, [0, 0, rz]); });
        [[-0.17, 0.75, 0.06], [0.18, 0.74, -0.05]].forEach(([dx, dy, rz], i) => { const m = sleeves[(i + 2 + wi * 2) % 7]; S.box(g, m, vx + dx, b0 + dy, 0.08, 0.3, 0.3, 0.02, [0, 0, rz]); });
        // пластинка выглядывает из конверта
        const px = vx + (wi ? -0.2 : 0.17), py = b0 + (wi ? 0.21 : 0.74) + 0.13;
        S.cyl(g, vinyl, px, py, 0.08, 0.13, 0.012, [PI / 2, 0, 0]); S.cyl(g, pink, px, py, 0.088, 0.045, 0.006, [PI / 2, 0, 0]);
        S.rbox(g, wi ? sleeves[5] : sleeves[0], px, py - 0.1, 0.095, 0.31, 0.2, 0.02, 0.01);
      });
      // дверь лавандовая, окошко — как пластинка
      const door = S.door(0, { frame: ink, leaf: lavD, trim: lav, win: 'round', tint: '#FFF4D6', step: lavD,
        deco: (p, dw) => { S.put(p, R.ringG(0.13, 0.02), vinyl, [dw / 2, 1.5, 0.095]); S.cyl(p, pink, dw / 2, 1.5, 0.092, 0.06, 0.01, [PI / 2, 0, 0]); } });
      R.sconce(g, S.K, 0, 2.5);
      S.hedge(W / 2 + 0.25, 0.48, 3);
      S.merge(g);
      return { doors: [door], tick(t, dt) { rec.rotation.z -= (dt || 0.016) * 0.6; } };
    },
  });

  /* ================= Книжная лавка «Закладка» ================= */
  registerShop('books', {
    x: 33.9, w: 3.2, h: 4.4, doorDx: 0, name: 'Книжная лавка',
    garland: [[-1.58, 2.38, 0.14], [1.58, 2.38, 0.14]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, W = 3.2, H = 4.4;
      const wall = S.m('#FFF4EC'), wine = S.m('#9E2F47'), cherry = S.m('#C2405B'), cream = S.m(CREAM), gold = S.m(GOLD), stone = S.m('#E8D6C8'), iron = S.m('#5B4A63'), navy = S.m('#3E4C72');
      const BK = ['#F08FA8', '#8FB3D9', '#F7B267', '#BFE6D3', '#B9A5E8', '#C2405B', '#3E4C72', '#FFD98A'].map(h => S.m(h));
      S.shell({ W, H, wall, plinth: stone, cap: wine });
      // полукруглый фронтон с круглым окошком
      const ped = R.extrude(R.archShape(1.7, 0.85), 0.3); S.put(g, ped, wine, [0, H + 0.36, -0.4]);
      S.put(g, R.extrude(R.archShape(1.36, 0.68), 0.03), cream, [0, H + 0.4, -0.08]);
      S.cyl(g, S.glass('#FFF0D6'), 0, H + 0.73, -0.04, 0.17, 0.02, [PI / 2, 0, 0]); S.put(g, R.ringG(0.18, 0.03), wine, [0, H + 0.73, -0.03]);
      // поясок между этажами
      S.rbox(g, wine, 0, 2.38, 0.05, W + 0.06, 0.08, 0.14, 0.03);
      // вывеска между этажами
      const A = S.atlas(1024, 512), c = A.c;
      board(S, A, [0, 0, 1024, 256], { bg: '#9E2F47', border: '#F7C9D3', bw: 6, big: 'ЗАКЛАДКА', bigSize: 118, small: 'книги · тишина · кресло', smallSize: 54, col: '#FFF4EC', col2: '#F7C9D3', dots: '#F7C9D3' });
      S.rbox(g, cream, 0, 2.78, 0.1, 2.84, 0.76, 0.14, 0.08);
      A.plane(g, [0, 0, 1024, 256], 0, 2.78, 0.175, 2.74, 0.685);
      // первый этаж: эркер слева (стопки книг и крошечная лампа), витрина справа
      const v = S.vitrine(-1.06, 1.32, 0.7, 1.1, { frame: wine, depth: 0.36, tint: '#FFEFD8' });
      { const b0 = v.bottom, x0 = -1.06, z = 0.19;
        S.awning(x0 - 0.47, x0 + 0.47, v.top + 0.09, 0.44, 0.24, wine, wine, { edge: [cream, S.m('#F7C9D3')], stripe: 0.16, bar: wine });
        [[-0.2, 5], [0.02, 4], [0.22, 3]].forEach(([dx, n], si) => { let y = b0; for (let i = 0; i < n; i++) { const h = 0.05 + ((i + si) % 3) * 0.012; S.box(g, BK[(i * 3 + si) % 8], x0 + dx + ((i % 2) - 0.5) * 0.02, y + h / 2, z, 0.2 - (i % 3) * 0.02, h, 0.15, [0, (i % 3 - 1) * 0.12, 0]); y += h; } });
        S.cyl(g, gold, x0 + 0.22, b0 + 0.3, z - 0.02, 0.008, 0.16); S.put(g, R.GEO.cone, S.bulb('#FFE3A6'), [x0 + 0.22, b0 + 0.42, z - 0.02], [0.075, 0.08, 0.075]); S.sphS(g, S.bulb('#FFE3A6'), x0 + 0.22, b0 + 0.37, z - 0.02, 0.03); }
      const v2 = S.vitrine(1.06, 1.32, 0.7, 1.1, { frame: wine, depth: 0.26, tint: '#FFEFD8' });
      { const b0 = v2.bottom, x0 = 1.0, z = 0.13;
        S.box(g, gold, x0 - 0.1, b0 + 0.1, z, 0.03, 0.2, 0.03, [0.3, 0, 0]);
        S.box(g, cream, x0 - 0.18, b0 + 0.25, z + 0.03, 0.17, 0.22, 0.012, [0.3, 0, 0.12]); S.box(g, cream, x0 - 0.02, b0 + 0.25, z + 0.03, 0.17, 0.22, 0.012, [0.3, 0, -0.12]);
        S.box(g, cherry, x0 - 0.1, b0 + 0.16, z + 0.05, 0.012, 0.16, 0.012);
        for (let i = 0; i < 5; i++) { const h = 0.2 + (i % 3) * 0.04; S.box(g, BK[(i + 2) % 8], x0 + 0.1 + i * 0.045, b0 + 0.55 + h / 2, z - 0.03, 0.04, h, 0.14, [0, 0, i === 4 ? -0.25 : 0]); }
        S.box(g, cream, x0 + 0.18, b0 + 0.55, z - 0.03, 0.3, 0.02, 0.18);
        S.put(g, R.GEO.pot, S.m('#C98A5C'), [x0 + 0.2, b0 + 0.08, z], [0.07, 0.14, 0.07]); S.put(g, R.blobGeo, S.m('#8FAE62'), [x0 + 0.2, b0 + 0.2, z], [0.09, 0.07, 0.09]); }
      // второй этаж: окна с цветами и висячая вывеска-книга с вишнёвой закладкой
      S.win(-0.62, 3.7, 0.62, 0.78, { frame: cream, arch: true, tint: '#FFF0D6', sill: false });
      S.win(0.32, 3.7, 0.62, 0.78, { frame: cream, arch: true, tint: '#FFF0D6', sill: false });
      [-0.62, 0.32].forEach(x => R.flowerBox(g, wine, S.m('#7FB07A'), [S.m('#F7C9D3'), S.m('#FFD98A'), cherry], x, 3.27, 0.66));
      { const bx = 1.22, by = 3.55, bz = 0.42;
        S.box(g, iron, bx - 0.02, 3.98, 0.27, 0.035, 0.035, 0.56); S.put(g, R.ringG(0.07, 0.012), iron, [bx - 0.02, 3.9, 0.1]); S.box(g, iron, bx - 0.02, 3.9, 0.06, 0.03, 0.16, 0.03);
        [-0.13, 0.13].forEach(dx => S.cyl(g, iron, bx + dx * 0.9, 3.9, bz, 0.006, 0.16));
        S.rbox(g, wine, bx, by, bz, 0.4, 0.5, 0.11, 0.025); S.box(g, cream, bx + 0.02, by, bz, 0.37, 0.46, 0.09);
        for (let k = 0; k < 4; k++) S.box(g, S.m('#E8D6C8'), bx + 0.02, by - 0.18 + k * 0.12, bz + 0.0, 0.372, 0.005, 0.092);
        S.box(g, cherry, bx + 0.08, by - 0.36, bz + 0.05, 0.05, 0.24, 0.006);
        S.put(g, S.geo('tail', () => { const sh = new T.Shape(); sh.moveTo(-0.025, 0); sh.lineTo(0.025, 0); sh.lineTo(0.025, -0.06); sh.lineTo(0, -0.03); sh.lineTo(-0.025, -0.06); sh.closePath(); return new T.ShapeGeometry(sh); }), cherry, [bx + 0.08, by - 0.48, bz + 0.054]);
        // обложка: золотая рамка и раскрытая книжка
        c.save(); c.translate(0, 52); c.fillStyle = '#9E2F47'; c.fillRect(0, 210, 200, 250); c.strokeStyle = '#E8C770'; c.lineWidth = 6; c.strokeRect(14, 224, 172, 222); c.lineWidth = 3; c.strokeRect(24, 234, 152, 202);
        c.fillStyle = '#E8C770'; c.beginPath(); c.moveTo(100, 300); c.quadraticCurveTo(70, 284, 46, 292); c.lineTo(46, 362); c.quadraticCurveTo(70, 354, 100, 370); c.quadraticCurveTo(130, 354, 154, 362); c.lineTo(154, 292); c.quadraticCurveTo(130, 284, 100, 300); c.fill();
        c.strokeStyle = '#9E2F47'; c.lineWidth = 3; c.beginPath(); c.moveTo(100, 302); c.lineTo(100, 368); c.stroke(); c.restore();
        A.plane(g, [0, 262, 200, 250], bx, by, bz + 0.057, 0.38, 0.47); }
      // табличка на двери
      c.fillStyle = '#FFF4EC'; S.rr(c, 214, 266, 380, 132, 18); c.fill(); c.strokeStyle = '#9E2F47'; c.lineWidth = 5; S.rr(c, 224, 276, 360, 112, 12); c.stroke();
      S.text(c, 'Гусям с концовками —', 404, 310, 32, '#9E2F47', { w: 800, max: 330 }); S.text(c, 'с закрытым клювом', 404, 352, 32, '#9E2F47', { w: 800, max: 330 });
      const door = S.door(0, { frame: wine, leaf: wine, trim: S.m('#C9566E'), tint: '#FFF0D6', step: stone,
        deco: (p, dw) => { S.box(p, gold, dw / 2, 0.88, 0.085, 0.6, 0.23, 0.01); A.plane(p, [214, 266, 380, 132], dw / 2, 0.88, 0.092, 0.57, 0.2); } });
      S.hedge(W / 2 + 0.25, 0.48, 0);
      S.merge(g);
      return { doors: [door] };
    },
  });

  /* ================= Планетарий «Ясно» ================= */
  registerShop('planet', {
    x: 37.9, w: 3.8, h: 3.1, doorDx: 0.2, name: 'Планетарий',
    garland: [[-0.62, 2.42, 0.1], [1.02, 2.42, 0.1]],
    build(R) {
      const S = kit(R), { g, T, PI } = S, Rr = 1.9, Zc = -1.9, HD = 3.1, dx = 0.2;
      const navy = S.m('#3E4C72'), navyD = S.m('#33406A'), deep = S.m('#2E3558'), cream = S.m('#FFF4EC'), gold = S.m(GOLD), brass = S.m('#D9B25A');
      const at = (phi, y, out = 0) => [Math.sin(phi) * (Rr + out), y, Zc + Math.cos(phi) * (Rr + out)];
      // барабан, цоколь, карниз
      S.put(g, S.geo('drum', () => new T.CylinderGeometry(Rr, Rr, HD, 48)), navy, [0, HD / 2, Zc]);
      S.put(g, S.geo('drumP', () => new T.CylinderGeometry(Rr + 0.05, Rr + 0.07, 0.34, 48)), navyD, [0, 0.17, Zc]);
      S.put(g, S.geo('drumC', () => new T.CylinderGeometry(Rr + 0.12, Rr + 0.08, 0.16, 48)), cream, [0, HD + 0.08, Zc]);
      S.put(g, R.keep(new T.TorusGeometry(Rr + 0.1, 0.025, 6, 64)), gold, [0, HD - 0.02, Zc], null, [PI / 2, 0, 0]);
      // кремовый купол с тёмной щелью и латунным телескопом
      S.put(g, S.geo('dome', () => new T.SphereGeometry(Rr - 0.04, 40, 16, 0, PI * 2, 0, PI / 2)), cream, [0, HD + 0.16, Zc]);
      { const pts = []; for (let i = 0; i <= 14; i++) { const a = 0.25 + i / 14 * (PI / 2 - 0.25 + 0.12); pts.push(new T.Vector3(0, HD + 0.16 + Math.sin(a) * (Rr - 0.01), Zc + Math.cos(a) * (Rr - 0.01))); }
        const cv = new T.CatmullRomCurve3(pts); S.put(g, R.keep(new T.TubeGeometry(cv, 24, 0.11, 6)), deep);
        [-1, 1].forEach(s => S.put(g, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(s * 0.15, p.y + 0.005, p.z + 0.005))), 24, 0.025, 5)), S.m('#E9DCCB'))); }
      { const a = 0.95, bx = 0, by = HD + 0.16 + Math.sin(a) * Rr, bz = Zc + Math.cos(a) * Rr;
        const tg = new T.Group(); tg.position.set(bx, by, bz); tg.rotation.set(0.42, 0, -0.62); g.add(tg);
        S.put(tg, S.geo('scope', () => new T.CylinderGeometry(0.1, 0.075, 1.0, 16)), brass, [0, 0.36, 0]); S.cyl(tg, gold, 0, 0.88, 0, 0.125, 0.1); S.cyl(tg, S.glass('#E9F0FF'), 0, 0.935, 0, 0.1, 0.01);
        S.cyl(tg, gold, 0, -0.12, 0, 0.05, 0.12); S.put(tg, R.ringG(0.08, 0.015), deep, [0, 0.55, 0], null, [PI / 2, 0, 0]);
        S.cyl(g, deep, bx, by - 0.02, bz - 0.02, 0.15, 0.14, [0.95, 0, 0]); }
      S.sph(g, gold, 0, HD + 0.16 + Rr - 0.02, Zc, 0.08);
      // швы купола
      [-2.2, -1.45, -0.7, 0.7, 1.45, 2.2].forEach(phi => { const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * (PI / 2 - 0.08); pts.push(new T.Vector3(Math.sin(phi) * Math.cos(a) * (Rr - 0.03), HD + 0.16 + Math.sin(a) * (Rr - 0.03), Zc + Math.cos(phi) * Math.cos(a) * (Rr - 0.03))); } S.put(g, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.018, 4)), S.m('#EADCC9')); });
      // портал-арка с дверью
      S.put(g, R.extrude(R.archShape(1.56, 2.4, dx), 0.62), cream, [0, 0, -0.6]);
      S.put(g, R.extrude(R.archShape(1.32, 2.28, dx), 0.03), deep, [0, 0, 0.01]);
      const door = S.door(dx, { frame: gold, leaf: deep, trim: gold, win: 'round', tint: '#FFF0C8', step: cream,
        deco: (p, dw) => S.put(p, R.extrude(star5(S, 0.09, 0.04), 0.015), gold, [dw / 2, 0.88, 0.085]) });
      // вывеска-лента по барабану
      const A = S.atlas(1024, 256), c = A.c;
      { c.fillStyle = '#FFF4EC'; c.fillRect(0, 0, 1024, 200); c.fillStyle = '#E8C770'; c.fillRect(0, 0, 1024, 10); c.fillRect(0, 190, 1024, 10);
        const st = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
        c.fillStyle = '#E8C770'; [[296, 62, 16], [322, 124, 10], [728, 62, 16], [702, 124, 10], [120, 100, 11], [904, 100, 11]].forEach(([x, y, r]) => st(x, y, r));
        S.text(c, 'ЯСНО', 512, 80, 120, '#3E4C72', { f: 'Comfortaa', w: 700, max: 380 });
        S.text(c, 'планетарий · звёзды без выходных', 512, 160, 44, '#3E4C72', { w: 800, max: 660 }); }
      const band = A.geo([0, 0, 1024, 200], new T.CylinderGeometry(Rr + 0.025, Rr + 0.025, 0.6, 40, 1, true, -1.12 + 0.05, 2.24));
      const bm = S.put(g, band, A.mat(), [0, 2.76, Zc]); bm.castShadow = false;
      // иллюминаторы и золотые звёздочки на барабане
      [-0.82, 0.95].forEach(phi => { const [x, y, z] = at(phi, 1.4, 0.0); const wg = new T.Group(); wg.position.set(x, y, z); wg.rotation.y = phi; g.add(wg);
        S.cyl(wg, S.glass('#FFEFC8'), 0, 0, 0.0, 0.26, 0.06, [PI / 2, 0, 0]); S.put(wg, R.ringG(0.28, 0.055), cream, [0, 0, 0.035]);
        S.put(wg, R.ringG(0.17, 0.012), S.m('#E9DCCB'), [0, 0, 0.04]); S.plane(wg, S.glint, -0.07, 0.06, 0.05, 0.04, 0.22, -0.6); S.rbox(wg, cream, 0, -0.36, 0.05, 0.5, 0.06, 0.12, 0.02); });
      [[-1.3, 2.05], [-0.55, 1.95], [1.3, 2.05], [-1.05, 0.75], [1.2, 0.7], [0.62, 2.1]].forEach(([phi, y], i) => { const [x, yy, z] = at(phi, y, 0.005); const sg = S.put(g, R.extrude(star5(S, 0.07 + (i % 2) * 0.03, 0.03 + (i % 2) * 0.012), 0.02), gold, [x, yy, z]); sg.rotation.y = phi; });
      // пастельные флажки двумя гирляндами по барабану
      const flags = ['#F7C9D3', '#BFE6D3', '#FFD98A', '#D9CCF4', '#FFF4EC'].map(h => S.m(h)), pen = R.extrude(R.triShape(0.13, 0.16), 0.008);
      [[-1.32, -0.48], [0.82, 1.42]].forEach(([p0, p1], fi) => { const n = 7;
        const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, phi = p0 + (p1 - p0) * t; pts.push(new T.Vector3(...at(phi, 2.3 - Math.sin(t * PI) * 0.22, 0.04))); }
        S.put(g, R.keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 0.006, 4)), S.m('#7A6670'));
        for (let i = 1; i < n; i++) { const t = i / n, phi = p0 + (p1 - p0) * t, [x, y, z] = at(phi, 2.3 - Math.sin(t * PI) * 0.22, 0.05); const f = S.put(g, pen, flags[(i + fi) % 5], [x, y, z]); f.rotation.set(0, phi, PI); } });
      // ступенька-полукруг
      S.put(g, S.geo('stepH', () => new T.CylinderGeometry(0.85, 0.85, 0.08, 24, 1, false, -PI / 2, PI)), cream, [dx, 0.04, 0.0]);
      S.merge(g);
      return { doors: [door] };
    },
  });
})();
