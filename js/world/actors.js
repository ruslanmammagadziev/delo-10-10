/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: героиня-статуэтка по модели автора, кот Пирожок, жители.
   Строители — копия из js/city3d.js; склейка своя: у каждой подвижной части тело и контур
   по одному вызову отрисовки (в city3d контур рисуется отдельно на каждую деталь).
   Волна 3 (LIFE): A.critters — зверята города одной сеткой со скелетом (1 вызов тела + 1 контура на зверька),
   те же жители волны 2 (A.NPC) — тоже одной сеткой ('npc:<id>'). Жизнь (ходьба, реплики) — residents.js.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  WORLD.makeActors = function (H) {
    const { T, PI, keep, GEO_HI: GEO, GRAD, put, box, sph, sphS, cyl, rbox, toon, tex, cnv, ringG, blobGeo, outlineMat, mergeActor, angDiff,
      catFaceCanvas, animalFaceCanvas } = H;
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
    function buildHeroGLB(hk, H3) {
      const A = (window.HERO3D && HERO3D.anchors) || {};
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const U = { hdSwing: { value: 0 }, hdSit: { value: 0 }, hdRig: { value: new T.Vector3(A.hem || 0.54, A.hip || 0.8, A.knee || 0.45) } };
      const map = H3.map;
      // игра рисует без перевода цвета (цвета в коде = цвета на экране), поэтому и текстура — «как есть», без sRGB
      map.encoding = T.LinearEncoding; map.anisotropy = 4; map.needsUpdate = true;
      const mode = heroLookMode();
      if (!GRAD3 && mode === 'soft') {
        const d3 = new Uint8Array(64); GV3.forEach((v, i) => d3.set([v, v, v, 255], i * 4));
        GRAD3 = keep(new T.DataTexture(d3, 16, 1, T.RGBAFormat)); GRAD3.minFilter = GRAD3.magFilter = T.LinearFilter; GRAD3.generateMipmaps = false; GRAD3.needsUpdate = true;
      }
      const mat = mode === 'lambert' ? keep(new T.MeshLambertMaterial({ map })) : keep(new T.MeshToonMaterial({ map, color: 0xFFFFFF, gradientMap: mode === 'soft' ? GRAD3 : GRAD }));
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
      // arms[0] — свободная рука (левая): сюда setHeld кладёт букет, стакан, находку; в правой лупа
      const arms = [hand(A.handFree || [0.21, 0.71, 0]), hand(A.handMag || [-0.21, 0.73, 0])];
      rootG.userData.key = 'hero';
      return {
        root: rootG, body, torso, head, beret: bg, legs, arms, curtain,
        faceMat: { map: null, opacity: 1 }, faceOpen: null, faceClosed: null,   // лицо в текстуре: моргание — со вставкой век (позже)
        mats: [mat], parts: {}, setCols: () => {},
        statue: { U, mesh, outline, sit: 0, head0: head.position.clone(), tmp: new T.Vector3() },
      };
    }

    /* --- героиня со скелетом (tools/rig_heroine.py + js/hero_anim.js) — копия buildHeroRig из js/city3d.js ---
       Та же сетка и текстура, что у статуэтки, но кости: шаг и бег с IK стоп, посадка, «помахать», «ура», предметы в руке.
       Вызовы отрисовки те же (сетка + контур). Нет скелета или HeroAnim — null (тогда статуэтка). */
    function heroMat(map) {
      map.encoding = T.LinearEncoding; map.anisotropy = 4; map.needsUpdate = true;
      const mode = heroLookMode();
      if (!GRAD3 && mode === 'soft') {
        const d3 = new Uint8Array(64); GV3.forEach((v, i) => d3.set([v, v, v, 255], i * 4));
        GRAD3 = keep(new T.DataTexture(d3, 16, 1, T.RGBAFormat)); GRAD3.minFilter = GRAD3.magFilter = T.LinearFilter; GRAD3.generateMipmaps = false; GRAD3.needsUpdate = true;
      }
      return mode === 'lambert' ? keep(new T.MeshLambertMaterial({ map })) : keep(new T.MeshToonMaterial({ map, color: 0xFFFFFF, gradientMap: mode === 'soft' ? GRAD3 : GRAD }));
    }
    function buildHeroRig(hk, H3) {
      if (!H3 || !H3.rig || !window.HeroAnim || !H3.geometry.attributes.skinIndex || window.HERO3D_NORIG) return null;
      const A = (window.HERO3D && HERO3D.anchors) || {};
      const rootG = new T.Group(), body = new T.Group(); rootG.add(body);
      const mat = heroMat(H3.map);
      const RB = H3.rig.bones, J = {}, bones = RB.map(b => { const o = new T.Bone(); o.name = b[0]; J[b[0]] = b[2]; return o; });
      RB.forEach((b, i) => { const p = b[1] >= 0 ? RB[b[1]][2] : [0, 0, 0]; bones[i].position.set(b[2][0] - p[0], b[2][1] - p[1], b[2][2] - p[2]); if (b[1] >= 0) bones[b[1]].add(bones[i]); });
      const mesh = new T.SkinnedMesh(H3.geometry, mat); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
      RB.forEach((b, i) => { if (b[1] < 0) mesh.add(bones[i]); });
      body.add(mesh); rootG.updateMatrixWorld(true);
      const skeleton = new T.Skeleton(bones); mesh.bind(skeleton);
      const anim = window.HeroAnim.create(mesh);
      if (!anim) return null;
      if (!H3.geometry.boundingBox) H3.geometry.computeBoundingBox();
      const hb = H3.geometry.boundingBox.clone(), hbW = new T.Box3(), hitV = new T.Vector3();
      mesh.raycast = (rc, out) => { hbW.copy(hb).applyMatrix4(mesh.matrixWorld); if (rc.ray.intersectBox(hbW, hitV)) { const d = rc.ray.origin.distanceTo(hitV); if (d >= rc.near && d <= rc.far) out.push({ distance: d, point: hitV.clone(), object: mesh }); } };
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
      const at = (bn, p) => { const g = new T.Group(), j = J[bn]; g.position.set(p[0] - j[0], p[1] - j[1], p[2] - j[2]); anim.bones[bn].add(g); return g; };
      const torso = at('chest', J.chest);
      const curtain = at('hair', J.hair);
      const head = at('head', A.head || [0, 1.5, -0.09]);
      const bg = new T.Group(); bg.position.set(0, 0.235, -0.02); head.add(bg);
      const legs = ['shin_L', 'shin_R'].map(n => at(n, J[n]));
      const hand = (bn, p) => { const pv = at(bn, p); pv.userData.p0 = pv.position.clone(); const inner = new T.Group(); pv.add(inner); return { pv, inner }; };
      const arms = [hand('hand_L', A.handFree || [0.21, 0.71, 0]), hand('hand_R', A.handMag || [-0.21, 0.73, 0])];
      rootG.userData.key = 'hero';
      return {
        root: rootG, body, torso, head, beret: bg, legs, arms, curtain,
        faceMat: { map: null, opacity: 1 }, mats: [mat], parts: {}, setCols: () => {},
        rig: { anim, mesh, outline, skeleton, hip: (J.thigh_L || [0, 0.8])[1], seat: 0.12, sit: 0, seatY: 0, cap: 0, spd: 0, step: 0, prev: null, q: new T.Quaternion(), qa: new T.Quaternion() },
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
      // та же диета: туловище, голова, шляпа (ищут как группу в голове), хвост; лапки двигаются по одной
      face.userData.dyn = true;
      [head, tail].forEach(g => { g.userData.dyn = true; });
      { const olSet = new Set(ol); mergeActor(body, olSet); mergeActor(head, olSet); mergeActor(tail, olSet); }
      rootG.traverse(m => { if (m.isMesh && m.material === outlineMat) m.castShadow = false; });
      rootG.userData.key = 'cat';
      return { root: rootG, body, head, tail, paws, faceMat, faceOpen, faceClosed };
    }

    /* --- жители (3D): енот, гусь, лиса, попугай, сова, зайка, ёжик — как в 2D-сценах --- */
    const FACEG = keep(new T.SphereGeometry(1.012, 24, 18, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180));
    let RAW = false;
    const capG = (r, l) => keep(new T.CapsuleGeometry(r, l, 4, 10));
    function npcMake(id, build) {
      const root = new T.Group(), body = new T.Group(); root.add(body); root.userData.key = 'npc:' + id;
      const ol = [];
      const P = (par, geo, mat, p, sc, r, line = true) => { const m = put(par, geo, mat, p, sc, r); m.receiveShadow = false; m.userData.ol = !!line; if (line) ol.push(m); return m; };
      const n = { id, root, body, head: null, ph: Math.random() * 6, hopT: -1, blinkT: 1 + Math.random() * 2, closed: false, look: 0 };
      const face = (head, f, sc) => {
        const fo = tex(animalFaceCanvas(f, false)), fc = tex(animalFaceCanvas(f, true));
        const fm = keep(new T.MeshBasicMaterial({ map: fo, transparent: true, depthWrite: false }));
        const m = put(head, FACEG, fm, [0, 0, 0], sc); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.userData.dyn = true;
        m.userData.face = { open: fo.image, closed: fc.image };   // для склейки зверька в одну сетку (critters.bakeNPC)
        n.faceMat = fm; n.faceOpen = fo; n.faceClosed = fc; return m;
      };
      build({ n, root, body, P, face, M: (c, x) => toon(c, x) });
      const dynG = [n.head, n.tail, n.neck, n.popcorn].concat(n.ears || [], n.needles || []).filter(Boolean);
      dynG.forEach(g => { g.userData.dyn = true; });
      // RAW — сырые детали без склейки: их запекает в одну сетку со скелетом critters.bakeNPC (волна 3)
      if (!RAW) { const olSet = new Set(ol); mergeActor(body, olSet); dynG.forEach(g => mergeActor(g, olSet, { cast: false })); }
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
    };

    /* =====================================================================
       ЗВЕРЯТА ГОРОДА (волна 3, LIFE): каждый зверёк — ОДНА сетка со скелетом (SkinnedMesh) + контур.
       Тело, голова, уши, хвост, лапы, веки — кости одной сетки: 1 вызов отрисовки на тело и 1 на контур
       (раньше житель стоил 6–8 вызовов). Цвет — в вершинах, мордочки и узоры — в общем атласе 1024² (клетки 128²),
       материал и шейдер контура — одни на всех зверьков. Сетка вида общая для всех особей вида.
       API (A.critters):
         species()                 → список видов: ['spitz', 'dachshund', 'corgi', 'cat_ginger', … , 'npc:raccoon', …]
         make(kind, opt)           → инстанс { root, mesh, outline, B (кости), rest, st (цели позы), kind, rig, meta,
                                     anim(dt, t, lod) — поза по st, hop(), blink(), setShadow(b), dispose() }
                                     kind — вид из SPECIES или 'npc:<id>' (жители волны 2: тот же A.NPC[id], но в одну сетку)
         st (цели, плавно): spd (м/с), sit, lie, sleep, sniff, wag, happy, look (рад, голова), lookUp, stretch, wash,
                            play, purr, swim, perch (сидит на возвышении), members[] (стайка: утята, трио мышей)
         MAT, OLM — общие материалы; atlas — холст атласа (для отладки).
       ===================================================================== */
    let critters = null;   // создаётся при первом обращении (A.critters): без жизни города — ни атласа, ни материалов
    const makeCritters = () => {
      const SZ = 1024, CELL = 128, COLS = SZ / CELL;
      const [acv, acx] = cnv(SZ, SZ); acx.fillStyle = '#FFFFFF'; acx.fillRect(0, 0, SZ, SZ);
      const atlasTex = keep(new T.CanvasTexture(acv)); atlasTex.anisotropy = 4;
      let nCell = 1;                                   // клетка 0 — белая (цвет — в вершинах)
      const WHITE = [(CELL / 2) / SZ, 1 - (CELL / 2) / SZ];
      const cellCache = new Map();
      function addCell(key, draw) {
        if (key && cellCache.has(key)) return cellCache.get(key);
        if (nCell >= COLS * COLS) return null;
        const i = nCell++, x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
        acx.save(); acx.beginPath(); acx.rect(x, y, CELL, CELL); acx.clip(); draw(acx, x, y, CELL); acx.restore();
        atlasTex.needsUpdate = true;
        const r = { u0: (x + 1.5) / SZ, u1: (x + CELL - 1.5) / SZ, v0: 1 - (y + CELL - 1.5) / SZ, v1: 1 - (y + 1.5) / SZ };
        if (key) cellCache.set(key, r);
        return r;
      }
      const MAT = keep(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, map: atlasTex, gradientMap: GRAD }));
      if (H.addRim) H.addRim(MAT, 1);
      const OLM = keep(new T.ShaderMaterial({
        uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
        vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
        side: T.BackSide,
      }));
      const FACE_LO = keep(new T.SphereGeometry(1.012, 14, 10, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180));
      const SPH = keep(new T.SphereGeometry(1, 12, 9)), SPH_LO = keep(new T.SphereGeometry(1, 8, 6)), CONE = keep(new T.ConeGeometry(1, 1, 10)), CYL = keep(new T.CylinderGeometry(1, 1, 1, 10));
      const capC = new Map(), cap = (r, l) => { const k = r + '|' + l; if (!capC.has(k)) capC.set(k, keep(new T.CapsuleGeometry(r, l, 3, 9))); return capC.get(k); };
      const tubeC = new Map(), tube = (pts, r, key) => { if (!tubeC.has(key)) tubeC.set(key, keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2]))), 12, r, 7))); return tubeC.get(key); };
      // мордочка: лицо жителя (kit.animalFaceCanvas) + дорисовка вида (усы, полоски, «звёздочка» корги…)
      const faceCv = (f, closed) => { const cv = animalFaceCanvas(f, closed); if (f.extra) { try { f.extra(cv.getContext('2d'), closed); } catch (e) { /* без дорисовки */ } } return cv; };
      const _m4 = new T.Matrix4(), _inv = new T.Matrix4(), _v = new T.Vector3(), _c = new T.Color();

      /* --- заготовка: группы-кости и детали из примитивов (материалы — только носители цвета) --- */
      function tpl(build) {
        const root = new T.Group(), B = {}, MC = new Map(), meta = {};
        const M = c => { if (typeof c !== 'string') return c; if (!MC.has(c)) MC.set(c, new T.MeshBasicMaterial({ color: new T.Color(c) })); return MC.get(c); };
        const at = par => (typeof par === 'string' ? B[par] : par || root);
        const bone = (name, par, p) => { const g = new T.Group(); g.userData.bone = name; g.position.set(p[0], p[1], p[2]); at(par).add(g); B[name] = g; return g; };
        const P = (par, geo, col, p, s, r, line = true) => { const m = new T.Mesh(geo, M(col)); if (p) m.position.set(p[0], p[1], p[2]); if (s) m.scale.set(s[0], s[1], s[2]); if (r) m.rotation.set(r[0], r[1], r[2]); m.userData.ol = !!line; at(par).add(m); return m; };
        const face = (par, f, sc, bg, off) => { const m = new T.Mesh(FACE_LO, M('#FFFFFF')); m.scale.set(sc[0], sc[1], sc[2]); if (off) m.position.set(off[0], off[1], off[2]); m.userData.face = { open: faceCv(f, false), closed: faceCv(f, true), bg, key: f.key }; at(par).add(m); return m; };
        build({ root, B, bone, P, face, M, meta, SPH, SPH_LO, CONE, CYL, cap, tube, blobGeo });
        return { root, B, meta };
      }

      /* --- запекание: заготовка → общая сетка (позиция, нормаль, цвет, uv атласа, кость) + сетка контура --- */
      function bake(t) {
        const root = t.root; root.updateMatrixWorld(true);
        _inv.copy(root.matrixWorld).invert();
        const bones = [{ name: 'root', parent: -1, pos: new T.Vector3() }], idx = new Map([[root, 0]]);
        const boneOf = o => { let p = o; while (p && !idx.has(p)) p = p.parent; return p ? idx.get(p) : 0; };
        const visible = o => { for (let p = o; p && p !== root; p = p.parent) if (p.visible === false) return false; return true; };
        root.traverse(o => { if (o === root || !o.userData.bone) return; const pi = boneOf(o.parent); idx.set(o, bones.length); bones.push({ name: o.userData.bone, parent: pi, pos: new T.Vector3().setFromMatrixPosition(_m4.multiplyMatrices(_inv, o.matrixWorld)) }); });
        const parts = [], ol = [];
        const meshes = []; root.traverse(m => { if (m.isMesh && visible(m)) meshes.push(m); });
        meshes.forEach(m => {
          const bi = boneOf(m), mt = m.material, src = m.geometry;
          const g = new T.BufferGeometry();
          ['position', 'normal', 'uv', 'color'].forEach(k => { if (src.attributes[k]) g.setAttribute(k, src.attributes[k].clone()); });
          if (src.index) g.setIndex(src.index.clone());
          g.applyMatrix4(_m4.multiplyMatrices(_inv, m.matrixWorld));
          const col = mt && mt.color ? mt.color.clone() : new T.Color(1, 1, 1);
          if (m.userData.face) {
            const F = m.userData.face;
            const bg = F.bg || '#FFFFFF', key = F.key ? F.key + '|' + bg : null;
            const draw = cvx => (c, x, y, s) => { c.fillStyle = bg; c.fillRect(x, y, s, s); c.drawImage(cvx, x, y, s, s); };
            const ro = addCell(key && key + '|o', draw(F.open)), rc = addCell(key && key + '|c', draw(F.closed));
            parts.push({ g, bi, col: new T.Color(1, 1, 1), rect: ro });
            // закрытые глаза — та же шапочка на кости «веки» (масштаб 0 — не видно, 1 — моргнул)
            const pv = new T.Vector3().setFromMatrixPosition(_m4.multiplyMatrices(_inv, m.matrixWorld));
            const li = bones.length; bones.push({ name: 'lid' + (li), parent: bi, pos: pv.clone(), lid: true });
            const g2 = g.clone(), p2 = g2.attributes.position;
            for (let i = 0; i < p2.count; i++) { _v.fromBufferAttribute(p2, i).sub(pv).multiplyScalar(1.006).add(pv); p2.setXYZ(i, _v.x, _v.y, _v.z); }
            parts.push({ g: g2, bi: li, col: new T.Color(1, 1, 1), rect: rc });
            return;
          }
          let rect = null;
          if (mt && mt.map && mt.map.image) { const im = mt.map.image; rect = addCell('tex:' + mt.map.uuid, (c, x, y, s) => c.drawImage(im, x, y, s, s)); }
          parts.push({ g, bi, col, rect, vc: !!src.attributes.color });
          if (mt && mt.side === T.DoubleSide) { const gb = g.clone(); const nb = gb.attributes.normal; if (nb) for (let i = 0; i < nb.count; i++) nb.setXYZ(i, -nb.getX(i), -nb.getY(i), -nb.getZ(i)); gb.userData.flip = true; parts.push({ g: gb, bi, col, rect, vc: !!src.attributes.color, flip: true }); }
          if (m.userData.ol) ol.push({ g: g.clone(), bi });
        });
        const pack = (list, full) => {
          let n = 0, ni = 0; list.forEach(p => { const c = p.g.attributes.position.count; n += c; ni += p.g.index ? p.g.index.count : c; });
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
          const col = full ? new Float32Array(n * 3) : null, uv = full ? new Float32Array(n * 2) : null;
          const ix = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
          let off = 0, io = 0;
          list.forEach(p => {
            const g = p.g, c = g.attributes.position.count, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, VC = g.attributes.color;
            for (let i = 0; i < c; i++) {
              const q = off + i;
              pos[q * 3] = P.getX(i); pos[q * 3 + 1] = P.getY(i); pos[q * 3 + 2] = P.getZ(i);
              if (N) { nor[q * 3] = N.getX(i); nor[q * 3 + 1] = N.getY(i); nor[q * 3 + 2] = N.getZ(i); }
              si[q * 4] = p.bi; sw[q * 4] = 1;
              if (full) {
                let r = p.col.r, gg = p.col.g, b = p.col.b; if (VC) { r *= VC.getX(i); gg *= VC.getY(i); b *= VC.getZ(i); }
                col[q * 3] = r; col[q * 3 + 1] = gg; col[q * 3 + 2] = b;
                if (p.rect && U) { uv[q * 2] = p.rect.u0 + (p.rect.u1 - p.rect.u0) * Math.min(1, Math.max(0, U.getX(i))); uv[q * 2 + 1] = p.rect.v0 + (p.rect.v1 - p.rect.v0) * Math.min(1, Math.max(0, U.getY(i))); }
                else { uv[q * 2] = WHITE[0]; uv[q * 2 + 1] = WHITE[1]; }
              }
            }
            if (g.index) { const a = g.index.array; if (p.flip) for (let i = 0; i < a.length; i += 3) { ix[io++] = a[i] + off; ix[io++] = a[i + 2] + off; ix[io++] = a[i + 1] + off; } else for (let i = 0; i < a.length; i++) ix[io++] = a[i] + off; }
            else if (p.flip) for (let i = 0; i < c; i += 3) { ix[io++] = off + i; ix[io++] = off + i + 2; ix[io++] = off + i + 1; }
            else for (let i = 0; i < c; i++) ix[io++] = off + i;
            off += c; g.dispose();
          });
          const geo = keep(new T.BufferGeometry());
          geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
          if (full) { geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); }
          geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
          geo.setIndex(new T.BufferAttribute(ix, 1));
          geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.25;
          return geo;
        };
        const geo = pack(parts, true), olGeo = ol.length ? pack(ol, false) : null;
        const tris = geo.index.count / 3 + (olGeo ? olGeo.index.count / 3 : 0);
        return { geo, olGeo, bones, tris, meta: t.meta };
      }

      /* --- особь: свой скелет на общей сетке вида --- */
      function spawn(bk) {
        const bones = bk.bones.map(b => { const o = new T.Bone(); o.name = b.name; return o; });
        bk.bones.forEach((b, i) => { const pp = b.parent >= 0 ? bk.bones[b.parent].pos : null; bones[i].position.set(b.pos.x - (pp ? pp.x : 0), b.pos.y - (pp ? pp.y : 0), b.pos.z - (pp ? pp.z : 0)); if (b.parent >= 0) bones[b.parent].add(bones[i]); });
        const mesh = new T.SkinnedMesh(bk.geo, MAT); mesh.add(bones[0]);
        mesh.castShadow = false; mesh.receiveShadow = false; mesh.raycast = () => {};
        const sk = new T.Skeleton(bones); mesh.bind(sk);
        let outline = null;
        if (bk.olGeo) { outline = new T.SkinnedMesh(bk.olGeo, OLM); outline.bind(sk, mesh.bindMatrix); outline.castShadow = false; outline.receiveShadow = false; outline.userData.outline = true; outline.raycast = () => {}; }
        const B = {}, rest = {}, lids = [];
        bk.bones.forEach((b, i) => { B[b.name] = bones[i]; rest[b.name] = bones[i].position.clone(); if (b.lid) { lids.push(bones[i]); bones[i].scale.setScalar(1e-4); } });
        return { mesh, outline, B, rest, lids, sk };
      }

      /* --- виды --- */
      const SPECIES = {};
      const DOG_LEGS = (P, bone, col, paw, y, x, zf, zb, len, r, pawS) => [['legFL', x, zf], ['legFR', -x, zf], ['legBL', x, zb], ['legBR', -x, zb]].forEach(([n, lx, lz]) => {
        bone(n, 'body', [lx, y, lz]); P(n, cap(r, len), col, [0, -len / 2 - r * 0.4, 0]); P(n, SPH_LO, paw, [0, -len - r * 1.2, r * 0.35], pawS, null, true);
      });
      // шпиц Зефирка: сливочный пушистый шарик, хвост-перо на спине, розовый бантик
      SPECIES.spitz = { rig: 'quad', h: 0.47, r: 0.26, stride: 0.2, tail: 'wag', tailUp: true, ears: 'perk', build: ({ bone, P, face }) => {
        const cr = '#FFF1DE', crL = '#FFF9F0', crD = '#F3D9BC', pk = '#F7B9C4', ink = '#3A2E3F', bow = '#F29BB4';
        bone('body', null, [0, 0.2, 0]);
        P('body', blobGeo, cr, [0, 0, -0.01], [0.15, 0.135, 0.18]);
        P('body', blobGeo, crL, [0, 0.03, 0.1], [0.13, 0.13, 0.1]);
        DOG_LEGS(P, bone, cr, crL, -0.06, 0.07, 0.09, -0.09, 0.05, 0.032, [0.036, 0.024, 0.042]);
        bone('head', 'body', [0, 0.12, 0.13]);
        P('head', SPH, cr, [0, 0, 0], [0.125, 0.115, 0.115]);
        [-1, 1].forEach(s => P('head', blobGeo, crL, [s * 0.07, -0.04, 0.0], [0.055, 0.05, 0.05], null, false));
        face('head', { key: 'spitz', muzzle: '#FFFDF8', muzzleW: 96, muzzleH: 60, nose: ink, noseW: 22, noseH: 15, mouth: 'w', er: 40, ex: 94, ey: 334, white: false }, [0.125, 0.115, 0.115], cr);
        [-1, 1].forEach(s => { const e = bone(s > 0 ? 'earL' : 'earR', 'head', [s * 0.065, 0.085, -0.02]); P(e, CONE, cr, [0, 0.04, 0], [0.042, 0.085, 0.032], [0, 0, -s * 0.22]); P(e, CONE, pk, [s * -0.002, 0.036, 0.012], [0.024, 0.055, 0.016], [0, 0, -s * 0.22], false); });
        P('head', SPH_LO, bow, [0.06, 0.1, 0.04], [0.035, 0.022, 0.016], [0, 0, 0.5], false); P('head', SPH_LO, bow, [0.1, 0.085, 0.04], [0.035, 0.022, 0.016], [0, 0, -0.3], false); P('head', SPH_LO, '#E07A98', [0.08, 0.093, 0.045], [0.014, 0.014, 0.014], null, false);
        bone('tail', 'body', [0, 0.07, -0.15]);
        P('tail', blobGeo, crL, [0, 0.06, 0.04], [0.095, 0.11, 0.12], [-0.7, 0, 0]); P('tail', blobGeo, crD, [0, 0.12, 0.09], [0.05, 0.05, 0.06], null, false);
      } };
      // такса Багет: длинная рыжая, уши-лопушки, вязаный шарфик
      SPECIES.dachshund = { rig: 'quad', h: 0.42, r: 0.3, stride: 0.16, tail: 'wag', ears: 'flop', build: ({ bone, P, face }) => {
        const fur = '#C47A45', furL = '#E6A877', furD = '#9C5A33', ink = '#3A2E3F', sc = '#F08FA8', scD = '#D9718E';
        bone('body', null, [0, 0.165, 0]);
        P('body', cap(0.085, 0.27), fur, [0, 0, 0], null, [PI / 2, 0, 0]);
        P('body', SPH, furL, [0, -0.035, 0.12], [0.07, 0.06, 0.09], null, false);
        DOG_LEGS(P, bone, fur, furD, -0.065, 0.055, 0.15, -0.15, 0.03, 0.028, [0.032, 0.02, 0.038]);
        P('body', keep(ringG(0.075, 0.026)), sc, [0, 0.055, 0.19], [1, 1, 1], [PI / 2 - 0.5, 0, 0], false); P('body', H.GEO.box, scD, [0.05, 0.0, 0.25], [0.035, 0.08, 0.02], [0.3, 0, -0.25], false);
        bone('head', 'body', [0, 0.1, 0.24]);
        P('head', SPH, fur, [0, 0, 0], [0.1, 0.095, 0.105]);
        P('head', SPH, fur, [0, -0.03, 0.1], [0.05, 0.046, 0.085]);
        P('head', SPH_LO, ink, [0, -0.018, 0.183], [0.022, 0.018, 0.016], null, false);
        P('head', SPH_LO, '#F48FA4', [0, -0.062, 0.15], [0.02, 0.008, 0.024], [0.3, 0, 0], false);
        face('head', { key: 'dachshund', er: 34, ex: 78, ey: 300, noBlush: false }, [0.1, 0.095, 0.105], fur);
        [-1, 1].forEach(s => { const e = bone(s > 0 ? 'earL' : 'earR', 'head', [s * 0.08, 0.035, -0.015]); P(e, SPH, furD, [s * 0.012, -0.07, 0.005], [0.028, 0.08, 0.052], [0, 0, s * 0.12]); });
        bone('tail', 'body', [0, 0.04, -0.2]);
        P('tail', CONE, fur, [0, 0.07, -0.035], [0.022, 0.16, 0.022], [-0.5, 0, 0]);
      } };
      // корги Пельмень: рыжий с белым, большие уши, хвостик-кнопка, пушистые «штанишки»
      SPECIES.corgi = { rig: 'quad', h: 0.46, r: 0.28, stride: 0.17, tail: 'nub', ears: 'perk', build: ({ bone, P, face }) => {
        const fur = '#E9A05A', wh = '#FFF7EE', pk = '#F7B9C4', ink = '#3A2E3F';
        bone('body', null, [0, 0.18, 0]);
        P('body', cap(0.1, 0.17), fur, [0, 0, 0], null, [PI / 2, 0, 0]);
        P('body', SPH, wh, [0, -0.04, 0.03], [0.085, 0.07, 0.15], null, false);
        P('body', SPH, wh, [0, 0.0, 0.15], [0.08, 0.09, 0.06], null, false);
        [-1, 1].forEach(s => P('body', SPH, wh, [s * 0.045, 0.0, -0.165], [0.06, 0.07, 0.05], null, false));
        DOG_LEGS(P, bone, wh, wh, -0.07, 0.065, 0.12, -0.12, 0.028, 0.03, [0.034, 0.022, 0.04]);
        bone('head', 'body', [0, 0.12, 0.2]);
        P('head', SPH, fur, [0, 0, 0], [0.115, 0.105, 0.105]);
        P('head', SPH, wh, [0, -0.035, 0.085], [0.055, 0.045, 0.06]);
        P('head', SPH_LO, ink, [0, -0.02, 0.14], [0.02, 0.016, 0.014], null, false);
        face('head', { key: 'corgi', er: 34, ex: 86, ey: 318, extra: (c) => { c.fillStyle = '#FFF7EE'; c.beginPath(); c.ellipse(256, 230, 26, 120, 0, 0, PI * 2); c.fill(); } }, [0.115, 0.105, 0.105], fur);
        [-1, 1].forEach(s => { const e = bone(s > 0 ? 'earL' : 'earR', 'head', [s * 0.06, 0.08, -0.02]); P(e, CONE, fur, [0, 0.055, 0], [0.052, 0.12, 0.035], [0, 0, -s * 0.22]); P(e, CONE, pk, [0, 0.05, 0.013], [0.03, 0.08, 0.016], [0, 0, -s * 0.22], false); });
        bone('tail', 'body', [0, 0.04, -0.2]);
        P('tail', SPH_LO, fur, [0, 0.01, -0.01], [0.032, 0.03, 0.03]);
      } };
      // кошки: одна заготовка, перекраска; tabby — полоски текстурой на спинке
      const tabbyTex = (() => { const [cv, c] = cnv(128, 128); c.fillStyle = '#A8957C'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#76634F';
        for (let i = 0; i < 9; i++) { const x = i * 14.2 + 4; c.beginPath(); c.moveTo(x - 3, 0); c.quadraticCurveTo(x + 6, 40, x - 2, 82); c.lineTo(x + 3, 82); c.quadraticCurveTo(x + 11, 40, x + 3, 0); c.closePath(); c.fill(); }
        const g = c.createLinearGradient(0, 70, 0, 128); g.addColorStop(0, 'rgba(232,219,200,0)'); g.addColorStop(0.45, 'rgba(232,219,200,1)'); c.fillStyle = g; c.fillRect(0, 70, 128, 58);
        const t = new T.CanvasTexture(cv); return t; })();
      const catBuild = o => ({ bone, P, face, M }) => {
        const fur = o.fur, bel = o.belly, paw = o.paw || o.fur, pk = '#F5B3C1';
        bone('body', null, [0, 0.17, 0]);
        P('body', SPH, o.tex ? new T.MeshBasicMaterial({ color: 0xFFFFFF, map: o.tex }) : fur, [0, 0, 0], [0.11, 0.1, 0.17]);
        P('body', SPH, bel, [0, -0.035, 0.04], [0.075, 0.065, 0.12], null, false);
        if (o.bib) P('body', SPH, o.bib, [0, 0.02, 0.13], [0.07, 0.075, 0.05], null, false);
        DOG_LEGS(P, bone, fur, paw, -0.07, 0.055, 0.1, -0.1, 0.035, 0.026, [0.03, 0.02, 0.038]);
        bone('head', 'body', [0, 0.11, 0.15]);
        P('head', SPH, o.headCol || fur, [0, 0, 0], [0.12, 0.105, 0.11]);
        face('head', Object.assign({ key: o.key, er: 33, ex: 80, ey: 336, nose: '#E8798F', noseW: 15, noseH: 10, mouth: 'w' }, o.face || {}), [0.12, 0.105, 0.11], o.headCol || fur);
        [-1, 1].forEach(s => { const e = bone(s > 0 ? 'earL' : 'earR', 'head', [s * 0.07, 0.07, -0.01]); P(e, CONE, o.ear || o.headCol || fur, [0, 0.04, 0], [0.045, 0.085, 0.034], [0, 0, -s * 0.32]); P(e, CONE, pk, [0, 0.036, 0.012], [0.026, 0.055, 0.016], [0, 0, -s * 0.32], false); });
        bone('tail', 'body', [0, 0.04, -0.16]);
        P('tail', tube([[0, 0, 0], [0, 0.06, -0.06], [0, 0.15, -0.09], [0.025, 0.215, -0.06]], 0.021, 'cattail'), o.tail || fur);
        P('tail', SPH_LO, o.tip || o.tail || fur, [0.025, 0.215, -0.06], [0.025, 0.025, 0.025], null, false);
      };
      const whisk = col => (c, closed) => { c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; [[150, 420, 60, 405], [150, 438, 62, 446], [362, 420, 452, 405], [362, 438, 450, 446]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }); };
      SPECIES.cat_ginger = { rig: 'quad', h: 0.42, r: 0.24, stride: 0.15, tail: 'cat', ears: 'perk', cat: true, build: catBuild({ key: 'cginger', fur: '#F2A65A', belly: '#FFE6C9', tip: '#E08A40', face: { extra: (c, cl) => { whisk('#C98A4F')(c, cl); c.strokeStyle = '#DD8A44'; c.lineWidth = 12; c.lineCap = 'round'; [[226, 150, 222, 215], [256, 140, 256, 210], [286, 150, 290, 215]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }); } } }) };
      SPECIES.cat_tabby = { rig: 'quad', h: 0.42, r: 0.24, stride: 0.15, tail: 'cat', ears: 'perk', cat: true, build: catBuild({ key: 'ctabby', fur: '#A8957C', tex: tabbyTex, belly: '#EBDDC9', headCol: '#A8957C', tail: '#97846C', tip: '#6F5D4A', face: { extra: (c, cl) => { whisk('#6F5D4A')(c, cl); c.strokeStyle = '#76634F'; c.lineWidth = 11; c.lineCap = 'round'; [[214, 160, 230, 222], [256, 146, 256, 214], [298, 160, 282, 222]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }); } } }) };
      SPECIES.cat_tux = { rig: 'quad', h: 0.42, r: 0.24, stride: 0.15, tail: 'cat', ears: 'perk', cat: true, build: catBuild({ key: 'ctux', fur: '#45404C', belly: '#FFF8F2', bib: '#FFF8F2', paw: '#FFF8F2', cheek: '#FFF8F2', face: { muzzle: '#FFF8F2', muzzleW: 92, muzzleH: 56, white: true, er: 30, extra: whisk('#E8E0E6') } }) };
      // капибара Пауза: спокойная, с апельсином на голове
      SPECIES.capybara = { rig: 'quad', h: 0.56, r: 0.36, stride: 0.2, tail: 'none', ears: 'twitch', build: ({ bone, P, face }) => {
        const fur = '#A9805C', furD = '#8E6849', snout = '#9B7352', ink = '#4A3830', org = '#F59A3B';
        bone('body', null, [0, 0.25, 0]);
        P('body', SPH, fur, [0, 0, 0], [0.2, 0.175, 0.27]);
        DOG_LEGS(P, bone, fur, furD, -0.11, 0.11, 0.15, -0.15, 0.04, 0.045, [0.05, 0.028, 0.056]);
        bone('head', 'body', [0, 0.1, 0.24]);
        P('head', SPH, fur, [0, 0.0, 0.05], [0.115, 0.13, 0.16]);
        P('head', SPH, snout, [0, -0.025, 0.165], [0.095, 0.095, 0.075]);
        [-1, 1].forEach(s => P('head', SPH_LO, ink, [s * 0.03, 0.0, 0.232], [0.012, 0.016, 0.008], null, false));
        face('head', { key: 'capy', er: 22, ex: 96, ey: 262, noBlush: false }, [0.115, 0.13, 0.16], fur, [0, 0, 0.05]);
        [-1, 1].forEach(s => { const e = bone(s > 0 ? 'earL' : 'earR', 'head', [s * 0.075, 0.11, -0.03]); P(e, SPH_LO, furD, [0, 0.012, 0], [0.032, 0.026, 0.018]); });
        P('head', SPH, org, [0, 0.165, 0.02], [0.058, 0.052, 0.058], null, true);
        P('head', SPH_LO, '#7FAE5A', [0.02, 0.215, 0.02], [0.03, 0.008, 0.016], [0, 0.4, 0.3], false);
      } };
      // утка Кряквина с тремя утятами — одна сетка: у каждой птички своя «корневая» кость
      SPECIES.ducks = { rig: 'flock', h: 0.32, r: 0.3, flock: ['mom', 'd1', 'd2', 'd3'], build: ({ bone, P, face }) => {
        const br = '#C8A47A', brD = '#A6835E', hd = '#CDAA80', bk = '#F0A040', sp = '#5A7BC4', yl = '#F7D65A', ylD = '#EAC248';
        bone('mom', null, [0, 0, 0]);
        P('mom', SPH, br, [0, 0.1, 0], [0.13, 0.1, 0.19]);
        [-1, 1].forEach(s => { P('mom', SPH, brD, [s * 0.11, 0.115, -0.02], [0.035, 0.07, 0.13], null, false); P('mom', H.GEO.box, sp, [s * 0.135, 0.12, -0.05], [0.01, 0.03, 0.06], null, false); });
        P('mom', CONE, brD, [0, 0.15, -0.2], [0.05, 0.1, 0.035], [-1.9, 0, 0]);
        bone('momHead', 'mom', [0, 0.22, 0.13]);
        P('momHead', SPH, hd, [0, 0, 0], [0.08, 0.075, 0.08]);
        P('momHead', SPH, bk, [0, -0.012, 0.085], [0.038, 0.014, 0.05]);
        face('momHead', { key: 'duck', er: 30, ex: 82, ey: 318, extra: c => { c.strokeStyle = 'rgba(110,80,60,.55)'; c.lineWidth = 14; c.beginPath(); c.moveTo(100, 300); c.lineTo(412, 300); c.stroke(); } }, [0.08, 0.075, 0.08], hd);
        ['d1', 'd2', 'd3'].forEach((n, i) => {
          bone(n, null, [0, 0, -0.5 - i * 0.38]);
          P(n, SPH, yl, [0, 0.05, 0], [0.06, 0.05, 0.072]);
          P(n, CONE, ylD, [0, 0.07, -0.07], [0.022, 0.04, 0.016], [-1.9, 0, 0], false);
          const h = bone(n + 'Head', n, [0, 0.105, 0.04]);
          P(h, SPH, yl, [0, 0, 0], [0.046, 0.043, 0.046]);
          P(h, SPH_LO, bk, [0, -0.008, 0.046], [0.02, 0.008, 0.024], null, false);
          face(h, { key: 'duckling', er: 46, ex: 100, ey: 320 }, [0.046, 0.043, 0.046], yl);
        });
      } };
      // мышиное трио «До-Ре-Мышь»: балалайка, барабан, гармошка
      SPECIES.mice = { rig: 'flock', h: 0.3, r: 0.45, flock: ['m1', 'm2', 'm3'], build: ({ bone, P, face }) => {
        const gr = '#BDB4C6', grL = '#E9E3EE', pk = '#F2B7C0', pkD = '#E79AA8';
        [['m1', -0.32, 0.02, '#E2A563'], ['m2', 0, 0.12, '#F08FA8'], ['m3', 0.32, 0.02, '#8FB8E8']].forEach(([n, x, z, ic], k) => {
          bone(n, null, [x, 0, z]);
          P(n, SPH, gr, [0, 0.085, 0], [0.068, 0.075, 0.07]);
          P(n, SPH, grL, [0, 0.075, 0.035], [0.045, 0.05, 0.04], null, false);
          [-1, 1].forEach(s => P(n, SPH_LO, pk, [s * 0.035, 0.012, 0.03], [0.022, 0.012, 0.03], null, false));
          P(n, tube([[0, 0, 0], [0, 0.02, -0.08], [0.04, 0.06, -0.14], [0.03, 0.12, -0.16]], 0.008, 'mtail'), pk, [0, 0.03, -0.05], null, null, false);
          const h = bone(n + 'Head', n, [0, 0.18, 0.02]);
          P(h, SPH, gr, [0, 0, 0], [0.072, 0.066, 0.068]);
          [-1, 1].forEach(s => { P(h, SPH, gr, [s * 0.06, 0.055, -0.01], [0.042, 0.042, 0.012], [0, s * 0.3, 0]); P(h, SPH_LO, pk, [s * 0.06, 0.055, -0.0], [0.028, 0.028, 0.006], [0, s * 0.3, 0], false); });
          P(h, SPH_LO, pkD, [0, -0.008, 0.07], [0.014, 0.012, 0.012], null, false);
          face(h, { key: 'mouse', er: 40, ex: 92, ey: 330, mouth: 'w' }, [0.072, 0.066, 0.068], gr);
          const it = bone(n + 'Inst', n, [0, 0.08, 0.075]);
          if (k === 0) { P(it, keep(new T.ConeGeometry(1, 1, 3)), ic, [0, 0, 0], [0.06, 0.012, 0.06], [PI / 2, 0, 0.0]); P(it, H.GEO.box, '#8A5E3C', [0.0, 0.055, 0.0], [0.012, 0.09, 0.008], [0, 0, 0]); }
          else if (k === 1) { P(it, CYL, ic, [0, 0, 0.01], [0.045, 0.04, 0.045]); P(it, CYL, '#FFFDF9', [0, 0.021, 0.01], [0.042, 0.004, 0.042], null, false); }
          else { [-1, 0, 1].forEach(q => P(it, H.GEO.box, q ? ic : '#FFFDF9', [q * 0.03, 0, 0], [0.025, 0.05, 0.035], null, q !== 0)); }
        });
      } };
      // ёжик Шуршик: колючки, листик на спинке
      SPECIES.hedgehog2 = { rig: 'quad', h: 0.3, r: 0.2, stride: 0.09, tail: 'none', ears: 'none', build: ({ bone, P, face }) => {
        const sp = '#8C6B55', spD = '#755844', cr = '#F2DCC4', ink = '#3A2E3F';
        bone('body', null, [0, 0.12, 0]);
        P('body', SPH, sp, [0, 0, -0.01], [0.13, 0.105, 0.15]);
        P('body', SPH, cr, [0, -0.04, 0.05], [0.085, 0.06, 0.09], null, false);
        const up = new T.Vector3(0, 1, 0);
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * PI * 2 * 2.6, k = i / 26, yy = -0.1 + k * 0.9, rr = Math.sqrt(Math.max(0.05, 1 - yy * yy));
          const dir = new T.Vector3(Math.sin(a) * rr * 0.9, yy + 0.25, -Math.abs(Math.cos(a)) * rr - 0.35).normalize();
          const c = P('body', CONE, i % 3 ? sp : spD, [dir.x * 0.12, dir.y * 0.095 + 0.01, dir.z * 0.13], [0.03, 0.09, 0.03], null, false); c.quaternion.setFromUnitVectors(up, dir);
        }
        P('body', SPH_LO, '#E58A3A', [0.02, 0.12, -0.03], [0.065, 0.012, 0.09], [0.15, 0.6, 0.2], false);
        P('body', SPH_LO, '#C9672B', [0.02, 0.124, -0.03], [0.008, 0.008, 0.08], [0.15, 0.6, 0.2], false);
        DOG_LEGS(P, bone, cr, '#8C6B55', -0.07, 0.06, 0.07, -0.07, 0.012, 0.018, [0.02, 0.012, 0.024]);
        bone('head', 'body', [0, 0.005, 0.105]);
        P('head', SPH, cr, [0, 0, 0], [0.07, 0.066, 0.07]);
        P('head', SPH, sp, [0, 0.03, -0.035], [0.078, 0.06, 0.06], null, true);
        P('head', CONE, cr, [0, -0.014, 0.07], [0.028, 0.055, 0.028], [PI / 2, 0, 0], false);
        P('head', SPH_LO, ink, [0, -0.014, 0.1], [0.013, 0.011, 0.011], null, false);
        [-1, 1].forEach(s => P('head', SPH_LO, spD, [s * 0.05, 0.05, -0.0], [0.018, 0.02, 0.01], null, false));
        face('head', { key: 'hedgehog2', er: 40, ex: 88, ey: 310, noBlush: false }, [0.07, 0.066, 0.07], cr);
      } };

      /* --- жители волны 2 (A.NPC) — та же модель, но одна сетка со скелетом; стопы — свои кости (шажки) --- */
      function npcTpl(id) {
        // те же строители, но на простых примитивах набора (шар 12×8 вместо 16×11): вдвое меньше треугольников
        RAW = true; let n = null;
        const hi = { sph: GEO.sph, sphLo: GEO.sphLo, cone: GEO.cone, cyl: GEO.cyl, hemi: GEO.hemi };
        Object.assign(GEO, { sph: H.GEO.sph, sphLo: H.GEO.sphLo, cone: H.GEO.cone, cyl: H.GEO.cyl, hemi: H.GEO.hemi });
        try { n = NPC[id](); } finally { RAW = false; Object.assign(GEO, hi); }
        n.root.traverse(m => { if (m.isMesh && m.userData.face) m.geometry = FACE_LO; });
        const body = n.body;
        body.userData.bone = 'body';
        if (n.head) n.head.userData.bone = 'head';
        if (n.tail) n.tail.userData.bone = 'tail';
        (n.ears || []).forEach((e, i) => { e.userData.bone = i ? 'earR' : 'earL'; });
        (n.needles || []).forEach((e, i) => { e.userData.bone = 'nd' + i; });
        if (n.neck) n.neck.userData.bone = 'neck';
        // стопы: детали прямо в теле, низко и не по центру
        const low = body.children.filter(m => m.isMesh && m.position.y < 0.13 && Math.abs(m.position.x) > 0.02);
        const quad = low.some(m => m.position.z > 0.02) && low.some(m => m.position.z < -0.02);
        const groups = {};
        low.forEach(m => { const k = (m.position.x > 0 ? 'L' : 'R') + (quad ? (m.position.z > 0 ? 'F' : 'B') : ''); (groups[k] = groups[k] || []).push(m); });
        Object.keys(groups).forEach(k => {
          const list = groups[k], c = new T.Vector3(); list.forEach(m => c.add(m.position)); c.multiplyScalar(1 / list.length);
          const g = new T.Group(); g.userData.bone = 'foot' + k; g.position.copy(c); body.add(g);
          list.forEach(m => { m.position.sub(c); g.add(m); });
        });
        const meta = { id, quad, feet: Object.keys(groups), headY: n.head ? n.head.position.y : 0.5 };
        // цвет головы под мордочкой (непрозрачная клетка атласа): самая крупная деталь в центре головы
        if (n.head) {
          let best = null, bs = 0;
          n.head.children.forEach(m => { if (m.isMesh && !m.userData.face && m.position.length() < 0.03 && m.material && m.material.color) { const s = m.scale.x * m.scale.y * m.scale.z; if (s > bs) { bs = s; best = m; } } });
          n.head.traverse(m => { if (m.userData && m.userData.face) { m.userData.face.bg = best ? '#' + best.material.color.getHexString() : '#FFFFFF'; m.userData.face.key = 'npc:' + id; } });
        }
        const root = new T.Group(); root.add(n.root);
        n.root.userData.bone = null;
        return { root, B: {}, meta, npc: n };
      }

      const BAKED = new Map();
      function baked(kind) {
        if (BAKED.has(kind)) return BAKED.get(kind);
        let t = null, sp = null;
        if (kind.startsWith('npc:')) { const id = kind.slice(4); if (!NPC[id]) return null; t = npcTpl(id); sp = { rig: 'blob', h: 1, r: 0.42, npc: id, stride: 0.13 }; }
        else { sp = SPECIES[kind]; if (!sp) return null; t = tpl(sp.build); }
        const bk = bake(t); bk.sp = sp; bk.kind = kind;
        if (sp.rig === 'flock') { bk.geo.boundingSphere.radius += 1.8; if (bk.olGeo) { bk.olGeo.computeBoundingSphere(); bk.olGeo.boundingSphere.radius += 2; } }
        BAKED.set(kind, bk);
        return bk;
      }

      /* --- позы --- */
      const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
      const ST0 = () => ({ spd: 0, sit: 0, lie: 0, sleep: 0, sniff: 0, wag: 0.25, happy: 0, look: 0, lookUp: 0, stretch: 0, wash: 0, play: 0, purr: 0, swim: 0, perch: 0 });
      function make(kind, opt = {}) {
        const bk = baked(kind); if (!bk) return null;
        const sp = bk.sp, S = spawn(bk), B = S.B, R = S.rest;
        const root = new T.Group(); root.add(S.mesh); if (S.outline) root.add(S.outline);
        root.userData.key = 'critter:' + kind;
        const I = { kind, sp, rig: sp.rig, root, mesh: S.mesh, outline: S.outline, B, rest: R, lids: S.lids, meta: bk.meta, tris: bk.tris,
          st: ST0(), cur: ST0(), ph: Math.random() * 6, hopT: -1, blinkT: 0.5 + Math.random() * 3, blinkD: 0, ph2: Math.random() * 6, ear: 0, earT: 2 + Math.random() * 4, members: null };
        I.hop = () => { I.hopT = 0; };
        I.blink = (d = 0.14) => { I.blinkD = d; };
        I.setShadow = b => { S.mesh.castShadow = !!b; };
        I.setLids = v => S.lids.forEach(l => l.scale.setScalar(v ? 1 : 1e-4));
        I.dispose = () => { if (root.parent) root.parent.remove(root); S.sk.dispose && S.sk.dispose(); };
        I.anim = (dt, t, lod) => animate(I, dt, t, lod || 0);
        return I;
      }
      // общие слои: моргание, прыжок, «вилять»
      function animate(I, dt, t, lod) {
        const st = I.st, c = I.cur, k = Math.min(1, dt * 6), B = I.B, R = I.rest;
        for (const key in st) if (typeof st[key] === 'number') c[key] += (st[key] - c[key]) * (key === 'spd' ? Math.min(1, dt * 10) : key === 'look' ? Math.min(1, dt * 5) : k);
        // моргание (во сне — глаза закрыты)
        const shut = c.sleep > 0.5 || c.purr > 0.6;
        I.blinkT -= dt; if (I.blinkT <= 0 && I.blinkD <= 0) { I.blinkD = 0.13; I.blinkT = 2.2 + Math.random() * 3.5; }
        let closed = shut; if (I.blinkD > 0) { I.blinkD -= dt; closed = true; }
        if (closed !== I.closed) { I.closed = closed; I.lids.forEach(b => b.scale.setScalar(closed ? 1 : 1e-4)); }
        if (lod >= 2) return;            // далеко: только моргание (и то почти не видно), скелет не трогаем
        let hop = 0; if (I.hopT >= 0) { I.hopT += dt; hop = Math.sin(Math.min(1, I.hopT / 0.42) * PI) * 0.1; if (I.hopT > 0.42) I.hopT = -1; }
        if (I.rig === 'quad') quadPose(I, c, t, dt, hop);
        else if (I.rig === 'blob') blobPose(I, c, t, dt, hop);
        else if (I.rig === 'flock') flockPose(I, c, t, dt, hop);
      }
      function quadPose(I, c, t, dt, hop) {
        const B = I.B, R = I.rest, sp = I.sp;
        const a = clamp01(c.spd / 0.9), run = clamp01((c.spd - 1.6) / 1.6);
        I.ph += dt * (c.spd / (sp.stride || 0.16)) * PI;
        const ph = I.ph, sit = c.sit * (1 - c.lie), lie = Math.max(c.lie, c.sleep), sw = Math.sin(ph), cw = Math.cos(ph);
        const amp = (0.55 + run * 0.25) * a * (1 - lie) * (1 - sit);
        const b = B.body; if (!b) return;
        // тело: покачивание и подъём на шаге; сидя — задом вниз, носом вверх; лёжа — на землю
        const drop = R.body.y * (sit * 0.28 + lie * 0.55) + c.perch * 0;
        b.position.set(R.body.x, R.body.y + Math.abs(sw) * 0.014 * a * (1 + run) - drop + hop + c.happy * Math.abs(Math.sin(t * 15)) * 0.01, R.body.z - sit * 0.02);
        b.rotation.set(-sit * 0.42 + c.stretch * 0.3 + run * 0.06 * Math.sin(ph * 2), 0, sw * 0.035 * a + Math.sin(t * 16) * 0.12 * c.happy + Math.sin(t * 30) * 0.015 * c.purr);
        const breathe = 1 + Math.sin(t * (lie > 0.5 ? 1.4 : 2.4) + I.ph2) * (lie > 0.5 ? 0.025 : 0.012);
        b.scale.set(1, breathe, 1);
        // лапы: рысь (диагональные пары), сидя — задние под себя, лёжа — вперёд
        const legs = [['legFL', 0, 1], ['legBR', 0, -1], ['legFR', PI, 1], ['legBL', PI, -1]];
        legs.forEach(([n, o, fr]) => {
          const L = B[n]; if (!L) return;
          const s = Math.sin(ph + o);
          let rx = -s * amp;
          if (fr > 0) rx += sit * 0.42 - lie * 1.35 - c.stretch * 1.1 + c.wash * (n === 'legFL' ? -1.7 : 0);
          else rx += -sit * 1.15 - lie * 1.25 + c.stretch * 0.25;
          L.rotation.set(rx, 0, 0);
          const lift = fr > 0 ? 0 : sit * 0.03;
          L.position.set(R[n].x, R[n].y + Math.max(0, -Math.cos(ph + o)) * 0.02 * amp + lift + (fr < 0 ? lie * 0.02 : lie * 0.03), R[n].z + (fr < 0 ? sit * 0.03 : 0));
        });
        // голова: смотрит (look), нюхает (вниз и подёргивания), лёжа — подбородок на лапы, во сне — уткнулась
        const h = B.head;
        if (h) {
          const sniff = c.sniff * (1 - lie);
          h.rotation.set(sit * 0.32 + sniff * 0.55 + Math.sin(t * 13) * 0.05 * sniff - c.lookUp * 0.35 + lie * 0.12 + c.sleep * 0.25 - c.stretch * 0.2 + c.wash * 0.25 - a * Math.sin(ph * 2) * 0.03,
            c.look * (1 - c.sleep) + c.wash * 0.4, Math.sin(t * 0.9 + I.ph2) * 0.05 + c.happy * Math.sin(t * 9) * 0.1 + c.wash * 0.25);
          h.position.set(R.head.x, R.head.y - lie * 0.05 - c.sleep * 0.02 - c.stretch * 0.03, R.head.z + lie * 0.03);
        }
        // уши: шевелятся; у таксы болтаются в такт
        I.earT -= dt; if (I.earT <= 0) { I.ear = 1; I.earT = 2.5 + Math.random() * 5; } I.ear = Math.max(0, I.ear - dt * 4);
        ['earL', 'earR'].forEach((n, i) => {
          const e = B[n]; if (!e) return; const sd = i ? -1 : 1;
          if (sp.ears === 'flop') e.rotation.set(Math.sin(ph * 2) * 0.25 * a + c.happy * Math.sin(t * 14) * 0.3, 0, sd * (0.1 + Math.abs(Math.sin(ph)) * 0.25 * a + lie * 0.25));
          else e.rotation.set(-c.sleep * 0.3, 0, sd * (Math.sin(I.ear * PI) * 0.25 * (i ? 0.6 : 1) - lie * 0.15 + c.happy * 0.1));
        });
        // хвост: собаки виляют (быстрее, если рады), кошки — плавно, на ходу трубой, во сне обвивают лапы
        const tl = B.tail;
        if (tl) {
          if (sp.tail === 'wag' || sp.tail === 'nub') {
            const w = Math.max(c.wag, c.happy) * (1 - c.sleep);
            tl.rotation.set((sp.tailUp ? 0.1 : -0.15 * a - c.sit * 0.55 - lie * 0.7), Math.sin(t * (9 + 9 * w)) * (0.25 + 0.55 * w), 0);
          } else if (sp.tail === 'cat') {
            const up = a * (1 - lie);
            tl.rotation.set(-0.75 + up * 0.6 - lie * 0.75 - c.sit * 0.75, Math.sin(t * 1.3 + I.ph2) * 0.25 * (1 - c.sleep) + lie * 1.1 + c.sit * 0.9, Math.sin(t * 2.1 + I.ph2) * 0.12 * (1 - c.sleep));
          }
        }
      }
      // жители волны 2: «утиная» походка вперевалку, шажки стопами; на лавочке сидят, ножки вперёд
      function blobPose(I, c, t, dt, hop) {
        const B = I.B, R = I.rest, id = I.sp.npc, ph0 = I.ph2;
        const a = clamp01(c.spd / 0.6);
        I.ph += dt * (c.spd / (I.sp.stride || 0.13)) * PI;
        const ph = I.ph, sw = Math.sin(ph), sit = c.sit;
        const b = B.body; if (!b) return;
        b.position.set(R.body.x, R.body.y + Math.abs(sw) * 0.025 * a + hop, R.body.z);
        b.rotation.set(-sit * 0.12 + a * 0.05, Math.sin(ph) * 0.06 * a, sw * 0.1 * a + Math.sin(t * 14) * 0.08 * c.happy);
        b.scale.set(1, 1 + Math.sin(t * 2.2 + ph0) * 0.014, 1);
        (I.meta.feet || []).forEach(f => {
          const F = B['foot' + f]; if (!F) return;
          const o = f[0] === 'L' ? 0 : PI, q = f.length > 1 ? (f[1] === 'F' ? 0 : PI) : 0, s = Math.sin(ph + o + q);
          F.position.set(R['foot' + f].x, R['foot' + f].y + Math.max(0, s) * 0.035 * a + sit * 0.05, R['foot' + f].z + Math.cos(ph + o + q) * 0.045 * a + sit * 0.09);
        });
        const h = B.head;
        if (h) { h.rotation.set(-c.lookUp * 0.25 + (id === 'pigeon' ? Math.pow(Math.max(0, Math.sin(t * 2.4 + ph0)), 10) * 0.9 * (1 - a) : 0), c.look, Math.sin(t * 0.8 + ph0) * 0.05 + sw * 0.04 * a); }
        if (B.tail) { if (id === 'raccoon') B.tail.rotation.z = Math.sin(t * 2.4 + ph0) * 0.15 + sw * 0.1 * a; else if (id === 'fox') B.tail.rotation.y = Math.sin(t * 1.8 + ph0) * 0.25 + sw * 0.15 * a; }
        if (B.earL && id === 'bunny') { B.earL.rotation.x = Math.max(0, Math.sin(t * 1.1 + ph0)) * 0.2 + a * Math.abs(sw) * 0.15; if (B.earR) B.earR.rotation.x = Math.max(0, Math.sin(t * 1.1 + 1 + ph0)) * 0.2 + a * Math.abs(Math.cos(ph)) * 0.15; }
        if (B.nd0) { B.nd0.rotation.z = Math.sin(t * 7) * 0.18; if (B.nd1) B.nd1.rotation.z = Math.sin(t * 7 + PI) * 0.18; }
      }
      // стайка: позиции участников задаёт поведение (I.members: [{x, z, ry}] в осях корня), здесь — покачивание
      function flockPose(I, c, t, dt, hop) {
        const B = I.B, R = I.rest, names = I.sp.flock;
        names.forEach((n, i) => {
          const b = B[n]; if (!b) return; const m = I.members && I.members[i];
          if (m) { b.position.set(m.x, (m.y || 0), m.z); b.rotation.y = m.ry || 0; }
          const ph = t * (c.swim > 0.5 ? 2.2 : 9) + i * 1.7;
          const play = c.play;
          b.position.y += c.swim > 0.5 ? Math.sin(ph) * 0.01 : Math.abs(Math.sin(ph)) * 0.02 * clamp01(c.spd / 0.5) + play * Math.abs(Math.sin(t * 6 + i * 0.9)) * 0.03 + (i === 0 ? hop : hop * 0.6);
          b.rotation.z = c.swim > 0.5 ? Math.sin(ph * 0.7) * 0.05 : Math.sin(ph) * 0.08 * clamp01(c.spd / 0.5) + play * Math.sin(t * 6 + i) * 0.08;
          const h = B[n === 'mom' ? 'momHead' : n + 'Head'];
          if (h) h.rotation.set(Math.pow(Math.max(0, Math.sin(t * 0.7 + i * 2.1)), 12) * 0.8 * (c.swim > 0.5 ? 1 : 0) - c.lookUp * 0.3 + play * Math.sin(t * 6 + i) * 0.1, i === 0 ? c.look : Math.sin(t * 0.5 + i) * 0.3, 0);
          const ins = B[n + 'Inst']; if (ins) { ins.visible = true; ins.rotation.z = play * Math.sin(t * (i === 1 ? 12 : 6) + i) * 0.25; ins.scale.setScalar(0.4 + 0.6 * play); }
        });
      }
      return {
        species: () => Object.keys(SPECIES).concat(Object.keys(NPC).map(k => 'npc:' + k)),
        SPECIES, make, baked, MAT, OLM, atlas: acv, atlasTex, cells: () => nCell,
      };
    };

    return { buildHeroGLB, buildHeroRig, heroDeformPt, buildCat, npcMake, NPC, get critters() { return critters || (critters = makeCritters()); } };
  };
})();
