/* =====================================================================
   ЗИПЛАЙН: от башни-копии во дворе отеля на холме — через долину к краю села (VILLAGE.zipline).
   Желание автора (волна 4): «схватиться за ручку и скатиться по тросу от отеля до самых Кубачей».
   По research (plan2/kubachi_spec2.md §1.3) зиплайна у Кубачей НЕТ — это чистая выдумка игры: никаких реплик-«фактов»
   («самый длинный» и т. п.), только «держись крепче — и вжу-у-ух!».

   Обычный <script> (без модулей), Three.js r149. Грузится после vkit.js (по желанию — после hotel.js; порядок не важен).

   ГЕОГРАФИЯ (общая с hotel.js, макро-координаты села и серпантина: x — восток, z — юг, y = 0 — площадь села):
     VILLAGE.ZIP_GEO = { frame: { x, y, z, ry } — начало и поворот локальных осей отеля (локальное +z → (sin ry, cos ry)),
                         tower: { x, z, floor } — башня-копия во дворе отеля (локальные оси отеля), floor — пол площадки,
                         landing: { x, y, z } — середина площадки приземления у восточного края села (макро) }
     Трос — парабола провиса между мачтой на башне и А-образной стойкой за площадкой; высота над площадкой подобрана так,
     чтобы стоящая героиня доставала ручку, а сидящая в обвязке пролетала над настилом.

   API:
     VILLAGE.zipline.route(space, o?) → { from, to, sag, len, u0, uStop, dir, heading, launch, land, spawn, stopY }
         space: 'hotel' — локальные оси отеля (для ride в сцене отеля), 'macro' | 'village' — макро (для села).
         launch — где встаёт героиня на башне (ноги), land — где она встаёт на настил, spawn — точка входа в село.
     VILLAGE.zipline.cable(from, to, sag) → { at(u, out?), tangent(u, out?), len, lenH, u(sH), points(n) }
     VILLAGE.zipline.cableMesh(THREE, cab, o?) → THREE.Group (тонкая труба + линия в 1 px, видно и вблизи, и за 600 м)
     VILLAGE.zipline.buildLanding({ THREE, season, ground?(x,z), named?, quality?, cable?: false }) → {
         group (макро-оси села), colliders [{type:'box'|'circle', …}], spot { id:'zipline_landing', … use() },
         spawn { x, y, z, ry } — для h.places.zipLanding, anchor, view { pos, target, fov } — вид на отель, dispose() }
         ← село (kubachi.js) вызывает это и кладёт группу в свой root (см. plan2/wave4_hotel.md, NEEDS).
     VILLAGE.zipline.ride({ THREE, scene, camera, hero, anim?, ia?, route?, from?, to?, sag?, distantVillage?, ground?(x,z),
                            duration? (с скольжения, по умолчанию 27), external?, onEvent?(name, data), camera?: false })
         ground — высота земли сцены (камера не уходит под склон; в отеле — h.ground)
         → Promise<{ ok, skipped, landing:{x,y,z,ry}, to:'kubachi', spawn:'zipline_landing', exit }>
           с методами: .update(dt) — кадр (external: true — звать ВМЕСТО своих anim.update / IA.update / камеры),
           .skip() — сразу на настил, .cancel(), .state() → { phase, t, k (0..1), v (м/с), phi }, .active.
         Без external поездка сама крутит requestAnimationFrame (игре — не трогать героиню и камеру, пока .active).
         Фазы: prep 2,4 с (руки к ручке, садится в обвязку) → slide (разгон 5 с, ход, тормоз 3,6 с) → settle 2,2 с
         (качнулась, встала на настил, отпустила ручку). Руки — свой IK двух костей по костям HeroAnim (upperarm → forearm →
         hand), локти наружу; тело качается маятником от разгона/торможения, лёгкий боковой ветер; ветер-штрихи у камеры.
         Предметы в руках: перед поездкой игре — IA.cancel(); лупу можно убрать IA.play('pocket') (вернуть — 'unpocket').
     VILLAGE.zipline.ik.arm(anim, side 'L'|'R', grip:Vector3, pole:Vector3, w?) — IK руки (кисть хватом в точку).
     VILLAGE.zipline.LINES — короткие строки героини (без имени, не озвучиваются): start, go, land.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angW = a => a - TAU * Math.round(a / TAU);

  /* ---------- общая география (то же самое — в hotel.js; кто загрузился первым, тот и задал) ---------- */
  const GEO = V.ZIP_GEO = V.ZIP_GEO || {
    frame: { x: 490, y: 38, z: 500, ry: 0.722 },
    tower: { x: -26, z: -24, floor: 8.6 },
    landing: { x: 53, y: 0, z: 5 },
  };
  const toMacro = (x, y, z) => { const F = GEO.frame, c = Math.cos(F.ry), s = Math.sin(F.ry); return { x: F.x + x * c + z * s, y: F.y + y, z: F.z - x * s + z * c }; };
  const toLocal = (X, Y, Z) => { const F = GEO.frame, c = Math.cos(F.ry), s = Math.sin(F.ry), dx = X - F.x, dz = Z - F.z; return { x: dx * c - dz * s, y: Y - F.y, z: dx * s + dz * c }; };

  const LINES = { start: 'Ух, как высоко!', go: 'Вжу-у-ух!', land: 'Ещё хочу!', skip: 'Уже внизу!' };

  /* ---------- трос: парабола провиса (горизонталь — прямая) ---------- */
  function cable(from, to, sag) {
    const dx = to.x - from.x, dz = to.z - from.z, lenH = Math.hypot(dx, dz), dy = to.y - from.y;
    const at = (u, out) => { out = out || {}; out.x = from.x + dx * u; out.z = from.z + dz * u; out.y = from.y + dy * u - 4 * sag * u * (1 - u); return out; };
    const tangent = (u, out) => { out = out || {}; const gy = dy - 4 * sag * (1 - 2 * u), l = Math.hypot(dx, gy, dz) || 1; out.x = dx / l; out.y = gy / l; out.z = dz / l; return out; };
    let len = 0; { let p = at(0); for (let i = 1; i <= 200; i++) { const q = at(i / 200); len += Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z); p = q; } }
    return { from, to, sag, lenH, len, at, tangent, u: sH => sH / lenH, points: n => { const out = []; for (let i = 0; i <= n; i++) out.push(at(i / n)); return out; } };
  }

  /* ---------- маршрут: мачта на башне → стойка за настилом; высоты под «достаёт ручку» ---------- */
  const BAR_STAND = 1.84, STRAP = 0.5;    // перекладина над ногами стоящей героини; от оси ролика до перекладины
  function route(space, o = {}) {
    const ground = o.ground || (() => GEO.landing.y || 0);
    const TW = GEO.tower, Lm = GEO.landing;
    const tM = toMacro(TW.x, 0, TW.z);
    const dX = Lm.x - tM.x, dZ = Lm.z - tM.z, dl = Math.hypot(dX, dZ), D = { x: dX / dl, z: dZ / dl };
    const gyL = o.landY !== undefined ? o.landY : ground(Lm.x, Lm.z);
    // мачта: чуть позади середины площадки башни; с точки старта (1,2 м вперёд) перекладина — на высоте рук стоящей
    const mast = { x: tM.x - D.x * 0.3, z: tM.z - D.z * 0.3 };
    const endM = { x: Lm.x + D.x * 2.4, z: Lm.z + D.z * 2.4 };
    const lenH = Math.hypot(endM.x - mast.x, endM.z - mast.z), sag = +(lenH * 0.02).toFixed(2);
    const u0 = 1.5 / lenH, uStop = 1 - 2.4 / lenH;
    const yS = gyL + BAR_STAND + STRAP;                         // ось ролика над настилом
    const yT = GEO.frame.y + TW.floor + BAR_STAND + STRAP;      // ось ролика над площадкой башни (в точке старта)
    // y(u) = y0 + (y1 − y0)u − 4·sag·u(1 − u): из двух условий (старт и стоп) — y0 и y1
    const a0 = u0, b0 = 4 * sag * u0 * (1 - u0), a1 = uStop, b1 = 4 * sag * uStop * (1 - uStop);
    // yT = y0 + (y1 − y0)a0 − b0 ; yS = y0 + (y1 − y0)a1 − b1  →  k = y1 − y0 = (yS + b1 − yT − b0)/(a1 − a0)
    const k = (yS + b1 - yT - b0) / (a1 - a0), y0 = yT + b0 - k * a0, y1 = y0 + k;
    let from = { x: mast.x, y: y0, z: mast.z }, to = { x: endM.x, y: y1, z: endM.z };
    const launchM = { x: tM.x + D.x * (1.5 - 0.3), y: GEO.frame.y + TW.floor, z: tM.z + D.z * (1.5 - 0.3) };
    const landM = { x: Lm.x, y: gyL, z: Lm.z };
    const spawnM = { x: Lm.x, y: gyL, z: Lm.z };    // где поездка кончилась: середина настила, лицом к селу (стык без скачка)
    let heading = Math.atan2(D.x, D.z), launch = launchM, land = landM, spawn = spawnM, dir = D;
    if (space === 'hotel') {
      const c = Math.cos(GEO.frame.ry), s = Math.sin(GEO.frame.ry), L = p => toLocal(p.x, p.y, p.z);
      from = L(from); to = L(to); launch = L(launchM); land = L(landM); spawn = L(spawnM);
      dir = { x: D.x * c - D.z * s, z: D.x * s + D.z * c }; heading = Math.atan2(dir.x, dir.z);
    }
    const ry = heading;
    return { space: space === 'hotel' ? 'hotel' : 'macro', from, to, sag, lenH, len: cable(from, to, sag).len, u0, uStop, dir, heading,
      launch: Object.assign({ ry }, launch), land: Object.assign({ ry }, land), spawn: Object.assign({ ry }, spawn), stopY: yS - (space === 'hotel' ? GEO.frame.y : 0) };
  }

  /* ---------- сетка троса: тонкая труба (вблизи) + линия 1 px (издалека не пропадает) ---------- */
  function cableMesh(T, cab, o = {}) {
    const g = new T.Group(); g.name = 'zipline:cable';
    const n = o.seg || Math.max(60, Math.round(cab.lenH / 4)), pts = cab.points(n).map(p => new T.Vector3(p.x, p.y, p.z));
    const curve = new T.CatmullRomCurve3(pts);
    const col = new T.Color(o.color || '#4E4A52');
    const tubeG = new T.TubeGeometry(curve, n, o.r || 0.028, 4, false);
    const tube = new T.Mesh(tubeG, new T.MeshBasicMaterial({ color: col, fog: o.fog !== undefined ? o.fog : true }));
    tube.name = 'cableTube'; tube.castShadow = false; tube.receiveShadow = false; tube.frustumCulled = false; g.add(tube);
    const lineG = new T.BufferGeometry().setFromPoints(pts);
    const line = new T.Line(lineG, new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85, fog: false }));
    line.name = 'cableLine'; line.frustumCulled = false; g.add(line);
    g.userData.dispose = () => { tubeG.dispose(); tube.material.dispose(); lineG.dispose(); line.material.dispose(); };
    return g;
  }

  /* ---------- IK руки: две кости (плечо → локоть → кисть), локоть по «полюсу»; кисть — хватом в точку ---------- */
  const IKV = {};
  function ikTmp(T) { if (IKV.T === T) return IKV; Object.assign(IKV, { T, a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), e: new T.Vector3(), w: new T.Vector3(), n: new T.Vector3(), d: new T.Vector3(), q0: new T.Quaternion(), q1: new T.Quaternion(), q2: new T.Quaternion(), qa: new T.Quaternion(), qb: new T.Quaternion(), qc: new T.Quaternion() }); return IKV; }
  function aimBone(T, bone, childNow, want) {
    const K = ikTmp(T), piv = bone.getWorldPosition(K.c);
    const a = K.d.copy(childNow).sub(piv).normalize(), b = K.n.copy(want).sub(piv).normalize();
    if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
    const qd = K.q0.setFromUnitVectors(a, b), qw = bone.getWorldQuaternion(K.q1);
    const qNew = qd.multiply(qw), qp = bone.parent.getWorldQuaternion(K.q2).invert();
    bone.quaternion.copy(qp.multiply(qNew)); bone.updateMatrixWorld(true);
  }
  function armIK(anim, sd, grip, pole, w = 1, reach = 0.07) {
    if (!anim || !anim.bones || w <= 0) return false;
    const B = anim.bones, up = B['upperarm_' + sd], fo = B['forearm_' + sd], ha = B['hand_' + sd];
    if (!up || !fo || !ha) return false;
    const T = window.THREE, K = ikTmp(T);
    const q0u = K.qa.copy(up.quaternion), q0f = K.qb.copy(fo.quaternion), q0h = K.qc.copy(ha.quaternion);
    up.updateMatrixWorld(true);
    const A = up.getWorldPosition(new T.Vector3()), E0 = fo.getWorldPosition(new T.Vector3()), W0 = ha.getWorldPosition(new T.Vector3());
    const l1 = A.distanceTo(E0), l2 = E0.distanceTo(W0);
    const dir = new T.Vector3().copy(grip).sub(A); let d = dir.length(); if (d < 1e-4) return false; dir.divideScalar(d);
    const Wt = new T.Vector3().copy(grip).addScaledVector(dir, -reach);   // запястье — чуть не доходя (пальцы обхватывают перекладину)
    d = clamp(Wt.distanceTo(A), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const dW = new T.Vector3().copy(Wt).sub(A).normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const nrm = new T.Vector3().copy(pole).addScaledVector(dW, -pole.dot(dW)); if (nrm.lengthSq() < 1e-6) nrm.set(0, -1, 0); nrm.normalize();
    const E = new T.Vector3().copy(A).addScaledVector(dW, a).addScaledVector(nrm, h);
    const Wt2 = new T.Vector3().copy(A).addScaledVector(dW, d);
    aimBone(T, up, E0, E);
    aimBone(T, fo, ha.getWorldPosition(new T.Vector3()), Wt2);
    ha.quaternion.set(0, 0, 0, 1); ha.rotateX(sd === 'L' ? 0.35 : 0.35);   // кисть по предплечью, пальцы чуть вперёд — «на перекладине»
    if (w < 1) { up.quaternion.slerpQuaternions(q0u, up.quaternion.clone(), w); fo.quaternion.slerpQuaternions(q0f, fo.quaternion.clone(), w); ha.quaternion.slerpQuaternions(q0h, ha.quaternion.clone(), w); }
    up.updateMatrixWorld(true);
    return true;
  }

  /* ---------- общие сетки поездки и площадки: материалы и простые формы ---------- */
  function mats(T, o = {}) {
    const grad = (() => { const d = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 240, 240, 240, 255, 255, 255, 255, 255]); const t = new T.DataTexture(d, 4, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
    const list = [grad];
    const toon = c => { const m = new T.MeshToonMaterial({ color: new T.Color(c), gradientMap: grad }); list.push(m); return m; };
    const basic = c => { const m = new T.MeshBasicMaterial({ color: new T.Color(c) }); list.push(m); return m; };
    const M = o.baked ? basic : toon;
    return { list, M, toon, basic, dispose() { list.forEach(x => x.dispose && x.dispose()); } };
  }
  function cylBetween(mesh, a, b, r) {
    const T = window.THREE, d = new T.Vector3().subVectors(b, a), l = d.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(d, 0.5); mesh.scale.set(r, l, r);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.divideScalar(l));
  }

  /* =====================================================================
     ПЛОЩАДКА ПРИЗЕМЛЕНИЯ (для села, макро-оси): настил, А-образная стойка с тормозом-пружиной, мат, табличка «Финиш»
     ===================================================================== */
  function signTex(T, text, o = {}) {
    const c = document.createElement('canvas'), fs = 60, pad = 26; const x0 = c.getContext('2d'); x0.font = `900 ${fs}px Nunito, system-ui, sans-serif`;
    c.width = Math.ceil(x0.measureText(text).width + pad * 2); c.height = Math.ceil(fs * 1.5);
    const x = c.getContext('2d'); x.fillStyle = o.bg || '#FFF6E6'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = o.border || '#C2405B'; x.lineWidth = 8; x.strokeRect(5, 5, c.width - 10, c.height - 10);
    x.font = `900 ${fs}px Nunito, system-ui, sans-serif`; x.fillStyle = o.fg || '#3A2E3F'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, c.width / 2, c.height / 2 + 3);
    const t = new T.CanvasTexture(c); t.anisotropy = 2; return { t, aspect: c.width / c.height };
  }
  // W4A: склеить сетки площадки по материалу (доски, мат, стойка, тормоз: ≈ 16 вызовов → ≈ 6); с текстурой (табличка) — как есть
  function mergeByMaterial(T, g) {
    const groups = new Map();
    g.children.slice().forEach(m => { if (!m.isMesh || !m.geometry || (m.material && m.material.map)) return; const k = m.material; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    groups.forEach((list, mat) => {
      if (list.length < 2) return;
      const pos = [], nor = [];
      list.forEach(m => { m.updateMatrix(); const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrix); pos.push(geo.attributes.position.array); nor.push(geo.attributes.normal.array); geo.dispose(); });
      const n = pos.reduce((a, b) => a + b.length, 0), P = new Float32Array(n), N = new Float32Array(n); let off = 0;
      pos.forEach((a, i) => { P.set(a, off); N.set(nor[i], off); off += a.length; });
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.computeBoundingSphere();
      const mm = new T.Mesh(geo, mat); mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; mm.name = 'zipLanding';
      list.forEach(m => { g.remove(m); m.geometry.dispose(); }); g.add(mm);
    });
  }
  function buildLanding(o = {}) {
    const T = o.THREE || window.THREE, WIN = o.season === 'winter', ground = o.ground || (() => 0);
    const R = route('macro', { ground }), D = R.dir, side = { x: -D.z, z: D.x }, L = R.land, gy = L.y;
    const MT = mats(T, { baked: o.quality !== 'high' });
    const g = new T.Group(); g.name = 'zipline:landing';
    const wood = MT.M(WIN ? '#B39A80' : '#A9805A'), woodD = MT.M('#7E5A3E'), steel = MT.M('#8E9298'), mat = MT.M('#D9455A'), matB = MT.M('#4A90D8'), snow = MT.M('#F4F7FA');
    const box = (m, cx, cy, cz, w, h, d, ry) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(cx, cy, cz); b.rotation.y = ry || 0; b.castShadow = o.quality === 'high'; b.receiveShadow = o.quality === 'high'; g.add(b); return b; };
    const ry = R.heading;
    const P = (a, s, y) => [L.x + D.x * a + side.x * s, gy + y, L.z + D.z * a + side.z * s];
    // настил 3,4 × 2,8 м из досок, вровень с землёй (ходьбе не мешает)
    for (let i = 0; i < 7; i++) { const a = -1.7 + 0.25 + i * 0.49; box(i % 2 ? wood : woodD, ...P(a, 0, 0.05), 2.8, 0.1, 0.44, ry); }
    if (WIN) box(snow, ...P(-0.2, 0, 0.11), 2.9, 0.02, 3.0, ry);
    // мат у дальнего края (мягко встать) — красный с синей каймой
    box(matB, ...P(1.1, 0, 0.16), 2.0, 0.12, 0.9, ry); box(mat, ...P(1.1, 0, 0.2), 1.8, 0.1, 0.78, ry);
    // А-образная стойка за настилом, верх — конец троса
    const top = new T.Vector3(R.to.x, R.to.y, R.to.z), legs = [];
    [-1, 1].forEach(s => { const foot = new T.Vector3(...P(2.4 + 0.7, s * 1.25, 0)); const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 7), woodD); cylBetween(m, foot, top.clone().add(new T.Vector3(D.x * 0.1, 0.25, D.z * 0.1)), 0.1); m.castShadow = o.quality === 'high'; g.add(m); legs.push(foot); });
    { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 7), woodD); cylBetween(m, new T.Vector3(...P(2.55, -1.0, 1.25)), new T.Vector3(...P(2.55, 1.0, 1.25)), 0.07); g.add(m); }
    // тормоз-пружина на тросе (за точкой остановки) и колодка
    { const u = R.uStop + 0.9 / R.lenH, cab = cable(R.from, R.to, R.sag), p = cab.at(u), tg = cab.tangent(u); const m = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 1.2, 10, 1, true), steel); m.position.set(p.x, p.y, p.z); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(tg.x, tg.y, tg.z)); g.add(m);
      const k = new T.Mesh(new T.BoxGeometry(0.3, 0.26, 0.26), mat); const p2 = cab.at(u + 0.65 / R.lenH); k.position.set(p2.x, p2.y, p2.z); k.rotation.y = ry; g.add(k); }
    // табличка «Финиш» на стойке
    { const S = signTex(T, 'Финиш'), hgt = 0.42, sm = new T.MeshBasicMaterial({ map: S.t }); MT.list.push(sm, S.t);
      const s1 = new T.Mesh(new T.PlaneGeometry(hgt * S.aspect, hgt), sm), p = P(2.35, 0, 1.75); s1.position.set(p[0], p[1], p[2]); s1.rotation.y = ry + PI; g.add(s1);
      const s2 = s1.clone(); s2.position.set(...P(2.45, 0, 1.75)); s2.rotation.y = ry; g.add(s2); }
    // трос до отеля (тот же, что в регионе отеля)
    mergeByMaterial(T, g);
    const cab = cable(R.from, R.to, R.sag), cm = o.cable === false ? null : cableMesh(T, cab, { color: '#4E4A52', fog: true }); if (cm) g.add(cm);
    const colliders = legs.map((f, i) => ({ type: 'circle', x: f.x, z: f.z, r: 0.22, y0: gy - 1, y1: gy + 3.4, id: 'zipLeg' + i }));   // мат низкий — по нему можно пройти
    const spawn = { x: R.spawn.x, y: R.spawn.y, z: R.spawn.z, ry: R.heading };
    const view = { pos: [L.x - D.x * 5 + side.x * 2.5, gy + 2.4, L.z - D.z * 5 + side.z * 2.5], target: [L.x - D.x * 400, gy + 30, L.z - D.z * 400], fov: 30 };
    const spot = { id: 'zipline_landing', x: L.x - D.x * 1.2, y: gy, z: L.z - D.z * 1.2, r: 1.6, icon: '🪂', label: 'Финиш зиплайна', action: 'Посмотреть на отель',
      use: () => ({ id: 'zipline_landing', kind: 'view', view: 'zip_hotel', text: 'Вон там, на холме, — отель. А трос — до самой площадки!' }) };
    return { group: g, colliders, spot, spawn, anchor: { x: R.to.x, y: R.to.y, z: R.to.z }, view, route: R,
      dispose() { g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); if (cm && cm.userData.dispose) cm.userData.dispose(); MT.dispose(); if (g.parent) g.parent.remove(g); } };
  }

  /* =====================================================================
     ПОЕЗДКА
     ===================================================================== */
  function ride(o = {}) {
    const T = o.THREE || window.THREE, scene = o.scene, cam = o.camera === false ? null : o.camera, hero = o.hero || null;
    const anim = o.anim || (hero && hero.rig && hero.rig.anim) || null, B = anim && anim.bones;
    const R = o.route || route('hotel'), from = o.from || R.from, to = o.to || R.to, sag = o.sag !== undefined ? o.sag : R.sag;
    const cab = cable(from, to, sag), Lh = cab.lenH;
    const u0 = R.u0 !== undefined ? R.u0 : 1.5 / Lh, uStop = R.uStop !== undefined ? R.uStop : 1 - 2.4 / Lh;
    const s0 = u0 * Lh, sStop = uStop * Lh, Ls = sStop - s0;
    const DIR = new T.Vector3(to.x - from.x, 0, to.z - from.z).normalize(), SIDE = new T.Vector3(-DIR.z, 0, DIR.x), UP = new T.Vector3(0, 1, 0);
    const heading = Math.atan2(DIR.x, DIR.z);
    const PREP = 2.4, SLIDE = clamp(o.duration || 27, 12, 40), SETTLE = 2.2, TA = 5.0, TB = 3.6, TC = SLIDE - TA - TB, VMAX = Ls / (TA / 2 + TC + TB / 2);
    const emit = (n, d) => { try { if (o.onEvent) o.onEvent(n, d || {}); } catch (e) { /* звук — не наша забота */ } };
    // где стоит героиня на старте: над точкой старта ролика, ноги на полу площадки (из маршрута, если трос не задан руками)
    const launch = !o.from && R.launch ? R.launch : (() => { const p = cab.at(u0); return { x: p.x, y: p.y - BAR_STAND - STRAP, z: p.z }; })();
    const landP = (() => { const p = cab.at(uStop); return { x: p.x, y: p.y - BAR_STAND - STRAP, z: p.z }; })();

    /* --- сетки поездки: ролик, стропы, перекладина, обвязка; ветер-штрихи --- */
    const MT = mats(T, { baked: false });
    const grp = new T.Group(); grp.name = 'zipline:ride'; if (scene) scene.add(grp);
    const red = MT.M('#D9455A'), dark = MT.M('#3E3A44'), steel = MT.M('#A9AEB5'), yel = MT.M('#F2B544'), strapM = MT.M('#2F3440');
    const cylG = new T.CylinderGeometry(1, 1, 1, 6), geos = [cylG];
    const trolley = new T.Group(); grp.add(trolley);
    { const g1 = new T.BoxGeometry(0.16, 0.2, 0.34), m1 = new T.Mesh(g1, red); m1.position.y = -0.06; trolley.add(m1); geos.push(g1);
      const wg = new T.CylinderGeometry(0.07, 0.07, 0.05, 12); geos.push(wg); [-0.09, 0.09].forEach(z => { const w = new T.Mesh(wg, steel); w.rotation.z = PI / 2; w.position.set(0, 0.0, z); trolley.add(w); });
      const g2 = new T.BoxGeometry(0.04, 0.16, 0.06), m2 = new T.Mesh(g2, dark); m2.position.set(0, -0.22, 0); trolley.add(m2); geos.push(g2); }
    const strap = new T.Mesh(cylG, strapM), lanL = new T.Mesh(cylG, yel), lanR = new T.Mesh(cylG, yel), bar = new T.Mesh(cylG, dark), grips = [new T.Mesh(cylG, red), new T.Mesh(cylG, red)];
    [strap, lanL, lanR, bar].concat(grips).forEach(m => { m.castShadow = false; m.frustumCulled = false; grp.add(m); });
    // обвязка: пояс и петли на бёдрах — на костях героини (едут со скином)
    const harness = [];
    if (B && B.hips) {
      const tg = new T.TorusGeometry(0.175, 0.026, 6, 20), lg = new T.TorusGeometry(0.095, 0.02, 6, 16); geos.push(tg, lg);
      const belt = new T.Mesh(tg, yel); belt.rotation.x = PI / 2; belt.position.set(0, 0.06, 0.0); belt.scale.set(1.0, 0.86, 1); B.hips.add(belt); harness.push(belt);
      ['thigh_L', 'thigh_R'].forEach(n => { if (!B[n]) return; const l = new T.Mesh(lg, yel); l.rotation.x = PI / 2; l.position.set(0, -0.09, 0.0); B[n].add(l); harness.push(l); });
      const rg = new T.TorusGeometry(0.035, 0.012, 5, 10); geos.push(rg); const ring = new T.Mesh(rg, steel); ring.position.set(0, 0.06, 0.17); B.hips.add(ring); harness.push(ring);
    }
    // ветер: короткие белые штрихи вокруг камеры, летят навстречу
    const NW = 34, wPos = new Float32Array(NW * 6), wSeed = [];
    const wG = new T.BufferGeometry(); wG.setAttribute('position', new T.BufferAttribute(wPos, 3)); geos.push(wG);
    const wM = new T.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false, fog: false }); MT.list.push(wM);
    const wind = new T.LineSegments(wG, wM); wind.frustumCulled = false; wind.renderOrder = 20; grp.add(wind);
    for (let i = 0; i < NW; i++) wSeed.push({ a: Math.random() * TAU, r: 1.5 + Math.random() * 5, k: Math.random(), y: (Math.random() - 0.5) * 4, l: 0.8 + Math.random() * 1.2 });

    /* --- состояние --- */
    const S = { t: 0, phase: 'prep', s: s0, v: 0, a: 0, phi: 0, phiV: 0, psi: 0, ik: 0, sit: false, hang: 0, done: false, skipped: false, events: {}, camMode: 'prep', camW: 0, k: 0 };   // camMode: prep → chase → front → chase → land
    const tmp = { p: {}, tg: {} }, axle = new T.Vector3(), barC = new T.Vector3(), q = new T.Quaternion(), e = new T.Euler(0, 0, 0, 'YXZ');
    const rootStand = new T.Vector3(launch.x, launch.y, launch.z), rootHang = new T.Vector3(), camPos = new T.Vector3(), camLook = new T.Vector3(), camWant = new T.Vector3(), lookWant = new T.Vector3();
    let camInit = false, rafId = 0, lastT = 0, resolveFn = null;
    const shL = new T.Vector3(), shR = new T.Vector3(), barModel = new T.Vector3(0, 1.5, 0.12), gripL = new T.Vector3(), gripR = new T.Vector3(), hipW = new T.Vector3();
    const prevBodyY = hero && hero.body ? hero.body.position.y : 0;
    if (hero && hero.body) hero.body.position.y = 0;
    if (o.ia) { try { o.ia.cancel(); } catch (err) { /* ok */ } }
    let fov0 = cam ? cam.fov : 50;

    function sOfT(t) {
      if (t <= 0) return 0;
      if (t < TA) { const x = t / TA; return VMAX * TA * (x * x * x - x * x * x * x / 2); }
      if (t < TA + TC) return VMAX * (TA / 2 + (t - TA));
      if (t < SLIDE) { const x = (t - TA - TC) / TB; return VMAX * (TA / 2 + TC + TB * (x - x * x * x + x * x * x * x / 2)); }
      return Ls;
    }
    function vOfT(t) { if (t <= 0 || t >= SLIDE) return 0; if (t < TA) return VMAX * sst(0, 1, t / TA); if (t < TA + TC) return VMAX; return VMAX * (1 - sst(0, 1, (t - TA - TC) / TB)); }
    function aOfT(t) { if (t <= 0 || t >= SLIDE) return 0; if (t < TA) { const x = t / TA; return VMAX * 6 * x * (1 - x) / TA; } if (t < TA + TC) return 0; const x = (t - TA - TC) / TB; return -VMAX * 6 * x * (1 - x) / TB; }

    function heroPose(dt) {
      if (!hero) return;
      const root = hero.root;
      // поворот: стоя — только курс; в обвязке — маятник (φ — вдоль хода, ψ — вбок)
      const yaw = heading + Math.sin(S.t * 0.7) * 0.03 * S.hang;
      e.set(S.phi * S.hang, yaw, S.psi * S.hang, 'YXZ'); root.quaternion.setFromEuler(e);
      if (!S._rootInit) { root.position.copy(rootStand); S._rootInit = true; }
      root.updateMatrixWorld(true);
      if (anim) anim.update(dt, { speed: 0, sitting: S.sit, sitPose: 'chair', idle: false, turnRate: 0, waving: false, celebrate: false });
      root.updateMatrixWorld(true);
      // где перекладина относительно героини: над серединой плеч (оси корня)
      if (B && B.upperarm_L && B.upperarm_R) {
        B.upperarm_L.getWorldPosition(shL); B.upperarm_R.getWorldPosition(shR); root.worldToLocal(shL); root.worldToLocal(shR);
        const want = new T.Vector3((shL.x + shR.x) / 2, (shL.y + shR.y) / 2 + 0.47, (shL.z + shR.z) / 2 + 0.12);
        if (!S._bm) { barModel.copy(want); S._bm = true; } else barModel.lerp(want, 1 - Math.exp(-dt * 8));
      }
      // корень: стоя — на точке; в обвязке — так, чтобы перекладина (barModel) пришлась на перекладину под роликом
      rootHang.copy(barModel).applyQuaternion(root.quaternion).negate().add(barC);
      root.position.lerpVectors(rootStand, rootHang, sst(0, 1, S.hang));
      root.updateMatrixWorld(true);
      // руки на перекладину
      if (anim && S.ik > 0) {
        const lat = new T.Vector3(1, 0, 0).applyQuaternion(root.quaternion), fwd = new T.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
        const barAx = new T.Vector3().copy(lat);
        gripL.copy(barC).addScaledVector(barAx, 0.17); gripR.copy(barC).addScaledVector(barAx, -0.17);
        const poleL = new T.Vector3().copy(lat).multiplyScalar(1).addScaledVector(fwd, 0.25).addScaledVector(UP, -0.3), poleR = new T.Vector3().copy(lat).multiplyScalar(-1).addScaledVector(fwd, 0.25).addScaledVector(UP, -0.3);
        const w = sst(0, 1, S.ik);
        armIK(anim, 'L', gripL, poleL, w); armIK(anim, 'R', gripR, poleR, w);
        // ветер: волосы чуть назад (в осях кости — лёгкий наклон и дрожь), только на ходу
        if (B.hair && S.phase === 'slide') { const k = clamp(S.v / 25, 0, 1); B.hair.rotation.x += (-0.18 + Math.sin(S.t * 13) * 0.03) * k; }
        root.updateMatrixWorld(true);
      }
      if (B && B.hips) hipW.set(0, 0.06, 0.17).applyMatrix4(B.hips.matrixWorld); else hipW.copy(root.position).add(new T.Vector3(0, 0.9, 0));
    }

    function rig() {
      // ролик на тросе, ремень до перекладины, перекладина, два строп-уса к поясу
      const u = S.s / Lh, p = cab.at(u, tmp.p), tg = cab.tangent(u, tmp.tg);
      axle.set(p.x, p.y, p.z);
      trolley.position.copy(axle); trolley.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(tg.x, tg.y, tg.z));
      // перекладина под роликом, качается вместе с телом
      e.set(S.phi * S.hang, heading, S.psi * S.hang, 'YXZ'); q.setFromEuler(e);
      barC.set(0, -STRAP, 0).applyQuaternion(q).add(axle);
    }
    function rigAfter() {
      cylBetween(strap, axle, barC, 0.012);
      const lat = new T.Vector3(1, 0, 0).applyQuaternion(hero ? hero.root.quaternion : q);
      const bl = new T.Vector3().copy(barC).addScaledVector(lat, 0.3), br = new T.Vector3().copy(barC).addScaledVector(lat, -0.3);
      cylBetween(bar, bl, br, 0.02);
      cylBetween(grips[0], new T.Vector3().copy(barC).addScaledVector(lat, 0.12), new T.Vector3().copy(barC).addScaledVector(lat, 0.28), 0.028);
      cylBetween(grips[1], new T.Vector3().copy(barC).addScaledVector(lat, -0.12), new T.Vector3().copy(barC).addScaledVector(lat, -0.28), 0.028);
      const show = S.hang > 0.05 || S.phase !== 'prep' || S.t > 1.4;
      [lanL, lanR].forEach((m, i) => { m.visible = !!(hero && B && show); if (m.visible) { const a = new T.Vector3().copy(axle).addScaledVector(lat, i ? -0.03 : 0.03).add(new T.Vector3(0, -0.12, 0)), b = new T.Vector3().copy(hipW).addScaledVector(lat, i ? -0.035 : 0.035); cylBetween(m, a, b, 0.011); } });
    }

    // камера: смещение считаем ОТНОСИТЕЛЬНО героини (перекладины) — на 28 м/с нет отставания; финиш — точка на настиле
    const offCur = new T.Vector3(), lookCur = new T.Vector3(), wantOff = new T.Vector3(), lookOff = new T.Vector3();
    function camera(dt) {
      if (!cam) return;
      const P = barC, k = S.k;
      let mode;
      if (S.phase === 'prep') mode = 'prep';
      else if (S.phase === 'settle' || (S.phase === 'slide' && S.t - PREP > SLIDE - 4.2)) mode = 'land';
      else if (k > 0.36 && k < 0.62) mode = 'front';
      else mode = 'chase';
      if (mode !== S.camMode) { S.camMode = mode; S.camW = 0; }
      S.camW = Math.min(1, S.camW + dt / 1.6);
      const U = (x) => new T.Vector3(0, x, 0);
      if (mode === 'prep') { wantOff.copy(rootStand).addScaledVector(SIDE, 2.7).addScaledVector(DIR, 2.9).add(U(1.9)).sub(P); lookOff.copy(rootStand).add(U(1.55)).addScaledVector(DIR, 0.6).sub(P); }
      else if (mode === 'chase') { wantOff.set(0, 0, 0).addScaledVector(DIR, -6.2).addScaledVector(SIDE, 1.7).add(U(1.5)); lookOff.set(0, 0, 0).addScaledVector(DIR, 26).add(U(-4.5)); }
      else if (mode === 'front') { wantOff.set(0, 0, 0).addScaledVector(DIR, 5.6).addScaledVector(SIDE, -2.4).add(U(0.35)); lookOff.set(0, 0, 0).add(U(-0.55)).addScaledVector(DIR, -1.2); }   // лицом к героине: за ней — трос вверх к отелю
      else { const L = landP; wantOff.set(L.x, L.y, L.z).addScaledVector(SIDE, 2.9).addScaledVector(DIR, 4.2).add(U(2.3)).sub(P); lookOff.set(0, 0, 0).lerp(new T.Vector3(L.x, L.y + 1.2, L.z).sub(P), S.phase === 'settle' ? 0.6 : 0.25); }
      if (!camInit) { offCur.copy(wantOff); lookCur.copy(lookOff); camInit = true; }
      const kk = 1 - Math.exp(-dt * 2.4 * (0.35 + S.camW));
      offCur.lerp(wantOff, kk); lookCur.lerp(lookOff, Math.min(1, kk * 1.5));
      camPos.copy(P).add(offCur); camLook.copy(P).add(lookCur);
      if (o.ground) { const gy = o.ground(camPos.x, camPos.z); if (camPos.y < gy + 1.4) camPos.y = gy + 1.4; }
      cam.position.copy(camPos); cam.lookAt(camLook);
      const fovT = mode === 'land' ? 52 : mode === 'front' ? 54 : mode === 'prep' ? 48 : 60;
      if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix(); }
    }

    function windTick(dt) {
      const k = S.phase === 'slide' ? clamp((S.v - 6) / 18, 0, 1) : 0;
      wM.opacity += (k * 0.55 - wM.opacity) * Math.min(1, dt * 3); wind.visible = wM.opacity > 0.02;
      if (!wind.visible || !cam) return;
      const c = cam.position;
      for (let i = 0; i < NW; i++) {
        const w = wSeed[i]; w.k -= dt * (S.v + 6) / 26; if (w.k < 0) { w.k += 1; w.a = Math.random() * TAU; w.r = 1.2 + Math.random() * 5; w.y = (Math.random() - 0.5) * 4; }
        const along = (w.k - 0.3) * 26, x = c.x + DIR.x * along + SIDE.x * Math.cos(w.a) * w.r, y = c.y + w.y + Math.sin(w.a) * w.r * 0.4, z = c.z + DIR.z * along + SIDE.z * Math.cos(w.a) * w.r;
        wPos.set([x, y, z, x - DIR.x * w.l, y, z - DIR.z * w.l], i * 6);
      }
      wG.attributes.position.needsUpdate = true;
    }

    function finish() {
      if (S.done) return; S.done = true; P.active = false;
      if (rafId) cancelAnimationFrame(rafId);
      harness.forEach(m => { if (m.parent) m.parent.remove(m); });
      if (grp.parent) grp.parent.remove(grp);
      geos.forEach(g => g.dispose()); MT.dispose();
      if (hero && hero.body) hero.body.position.y = prevBodyY;
      // W4A: корень — чистый поворот вокруг y (после quaternion.setFromEuler(…'YXZ') rotation в порядке XYZ мог стать (π, θ, −π):
      // игра, которая пишет только rotation.y, развернула бы героиню спиной вперёд)
      if (hero && hero.root) { hero.root.rotation.set(0, heading, 0); hero.root.updateMatrixWorld(true); }
      if (cam && Math.abs(cam.fov - fov0) > 0.01) { cam.fov = fov0; cam.updateProjectionMatrix(); }
      const L = landP;
      emit('done', { skipped: S.skipped });
      if (resolveFn) resolveFn({ ok: true, skipped: S.skipped, landing: { x: L.x, y: L.y, z: L.z, ry: heading }, to: 'kubachi', spawn: 'zipline_landing', exit: { id: 'zipline', to: 'kubachi', spawn: 'zipline_landing' }, t: +S.t.toFixed(2) });
    }

    function tick(dt) {
      if (S.done) return;
      dt = clamp(dt || 0, 0, 0.1); S.t += dt;
      const t = S.t;
      if (S.phase === 'prep') {
        S.s = s0; S.v = 0; S.a = 0;
        S.ik = clamp((t - 0.35) / 0.8, 0, 1);
        if (t > 1.5 && !S.sit) { S.sit = true; emit('clip'); }
        S.hang = clamp((t - 1.55) / 0.85, 0, 1);
        if (!S.events.start && t > 0.3) { S.events.start = true; emit('start', { line: LINES.start }); }
        if (t >= PREP) { S.phase = 'slide'; emit('go', { line: LINES.go }); }
      } else if (S.phase === 'slide') {
        const ts = t - PREP;
        S.s = s0 + sOfT(ts); S.v = vOfT(ts); S.a = aOfT(ts); S.ik = 1; S.hang = 1; S.sit = true;
        if (!S.events.mid && ts > SLIDE * 0.5) { S.events.mid = true; emit('mid'); }
        if (!S.events.brake && ts > TA + TC) { S.events.brake = true; emit('brake'); }
        if (ts >= SLIDE) { S.phase = 'settle'; S.tSettle = t; S.s = sStop; S.v = 0; S.a = 0; rootStand.set(landP.x, landP.y, landP.z); emit('stop'); }
      } else if (S.phase === 'settle') {
        const ts = t - S.tSettle; S.s = sStop; S.v = 0; S.a = 0;
        if (ts > 0.7 && S.sit) { S.sit = false; emit('land', { line: LINES.land }); }
        S.hang = 1 - clamp((ts - 0.6) / 0.7, 0, 1);
        S.ik = 1 - clamp((ts - 1.35) / 0.65, 0, 1);
        if (ts >= SETTLE) { finish(); return; }
      }
      S.k = clamp((S.s - s0) / Ls, 0, 1);
      // маятник: цель — наклон по ускорению (мягче настоящего), пружина с затуханием
      const om = 2.47, ze = 0.36, phiT = Math.atan(S.a * 0.3 / 9.8);
      S.phiV += (om * om * (phiT - S.phi) - 2 * ze * om * S.phiV) * dt; S.phi += S.phiV * dt; S.phi = clamp(S.phi, -0.36, 0.36);
      if (S.phase !== 'slide') { S.phi *= Math.exp(-dt * (S.phase === 'settle' ? 1.6 : 6)); S.phiV *= Math.exp(-dt * 4); }
      S.psi = S.phase === 'slide' ? (0.045 * Math.sin(t * 1.3) + 0.025 * Math.sin(t * 2.9 + 1)) * clamp(S.v / 12, 0, 1) : S.psi * Math.exp(-dt * 3);
      rig(); heroPose(dt); rigAfter(); camera(dt); windTick(dt);
    }

    function skip() {
      if (S.done) return;
      S.skipped = true; S.phase = 'settle'; S.tSettle = S.t - SETTLE; S.s = sStop; S.sit = false; S.hang = 0; S.ik = 0; S.phi = 0; S.phiV = 0;
      rootStand.set(landP.x, landP.y, landP.z);
      if (hero) { hero.root.position.copy(rootStand); e.set(0, heading, 0, 'YXZ'); hero.root.quaternion.setFromEuler(e); hero.root.updateMatrixWorld(true); }
      emit('skip', { line: LINES.skip });
      finish();
    }

    const P = new Promise(res => { resolveFn = res; });
    P.active = true; P.route = R; P.cable = cab;
    P.update = dt => tick(dt);
    P.skip = skip;
    P.cancel = () => { S.skipped = true; finish(); };
    P.state = () => ({ phase: S.phase, t: +S.t.toFixed(2), k: +S.k.toFixed(3), v: +S.v.toFixed(2), phi: +S.phi.toFixed(3), hang: +S.hang.toFixed(2), ik: +S.ik.toFixed(2), camMode: S.camMode, done: S.done, total: PREP + SLIDE + SETTLE, vmax: +VMAX.toFixed(1),
      bar: [+barC.x.toFixed(2), +barC.y.toFixed(2), +barC.z.toFixed(2)], gripL: [+gripL.x.toFixed(3), +gripL.y.toFixed(3), +gripL.z.toFixed(3)], gripR: [+gripR.x.toFixed(3), +gripR.y.toFixed(3), +gripR.z.toFixed(3)] });
    P.handErr = () => {   // QA: насколько кисти (точка хвата) у перекладины, м
      if (!anim || !B || !B.hand_L) return null;
      const g = (sd, tgt) => { const h = B['hand_' + sd], p = new T.Vector3(0, -0.07, 0.012).applyMatrix4(h.matrixWorld); return +p.distanceTo(tgt).toFixed(3); };
      return { L: g('L', gripL), R: g('R', gripR) };
    };
    // первый кадр сразу: героиня на старте, ролик и перекладина на месте
    tick(0);
    if (!o.external) { const loop = ts => { if (S.done) return; const dt = lastT ? (ts - lastT) / 1000 : 0; lastT = ts; tick(dt); rafId = requestAnimationFrame(loop); }; rafId = requestAnimationFrame(loop); }
    return P;
  }

  V.zipline = { GEO, LINES, route, cable, cableMesh, buildLanding, ride, ik: { arm: armIK, aim: aimBone }, toMacro, toLocal, version: 1 };
})();
