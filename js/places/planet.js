/* =====================================================================
   МЕСТО ПРОГУЛКИ: planet — Планетарий «Ясно» (kind new, x 38.1), голубь Тихо.
   Полукупол со звёздным небом (одни Points), на куполе — пустой круг
   с полоской «Солнце (временно отсутствует)», звёздный проектор, три
   кресла-лежака, мобиль с планетами на ниточках, табличка «8 минут».
   Мини «Ковш»: прилечь в кресло, купол темнеет (api.dim), камера смотрит
   на купол, тапы по звёздам — api.intercept (12 звёзд — один Points,
   линии — один меш, подсказка 1–7 — одна плоскость). Открывается
   на неделе 2. Комната 7×5: дверь — левая стена (exit −3.05, −0.8),
   spawn (−2.6, −2.4).
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'planet';
  const wk = () => { try { return Math.max(0, Math.min(6, Town.week())); } catch (e) { return 0; } };
  const CAM = { portrait: { dx: 0, y: 4.2, dz: 6.4, ly: 1.5, lz: -1.2, fov: 56 }, landscape: { dx: 0, y: 3.9, dz: 7.4, ly: 1.6, lz: -1.5, fov: 46 } };
  const DC = { x: 0, y: 0, z: -1.6 }, DR = 3.4;   // центр и радиус полукупола
  // точка на куполе: азимут a (0 — прямо назад), высота e, радиус r
  const onDome = (a, e, r = 3.26) => [DC.x + r * Math.cos(e) * Math.sin(a), DC.y + r * Math.sin(e), DC.z - r * Math.cos(e) * Math.cos(a)];
  // «Ковш» (от ручки к ковшу: η ζ ε δ γ β α) и «Бант» — в метрах по куполу, вокруг центра области
  const DIP = [[-0.36, 0.62], [-0.2, 0.36], [-0.17, 0.12], [-0.13, -0.1], [0.12, -0.26], [0.0, -0.5], [-0.24, -0.42]];
  const BOWS = [[0.42, -0.02], [0.24, 0.1], [0.24, -0.14], [0.6, 0.1], [0.6, -0.14]];
  const SEG = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3], [7, 8], [8, 9], [9, 7], [7, 10], [10, 11], [11, 7]];
  const E0 = 0.62, A0 = -0.02;   // центр области мини (высота ~36°, почти прямо; пустой круг — выше)
  const starPos = ([u, v]) => { const e = E0 + v / 3.26, a = A0 + u / (3.26 * Math.cos(E0)); return onDome(a, e, 3.2); };
  const MINI = DIP.concat(BOWS).map(starPos);
  // фон за разрезом — ночное небо с редкими звёздочками (только CSS)
  const SKYBG = (() => { const q = (() => { let a = 3; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; })(); const dots = [];
    for (let i = 0; i < 34; i++) { const r = (0.6 + q() * 1.1).toFixed(1); dots.push(`radial-gradient(${r}px ${r}px at ${(q() * 100).toFixed(1)}% ${(q() * 34).toFixed(1)}%, rgba(255,244,216,${(0.45 + q() * 0.5).toFixed(2)}) 60%, transparent 100%)`); }
    return dots.join(', ') + ', radial-gradient(120% 85% at 50% 28%, #323A62 0%, #171B30 74%)'; })();

  /* ---------------------------- 3D-комната ---------------------------- */
  if (window.City3D && City3D.registerRoom) City3D.registerRoom(P, {
    look: { sky: '#C9CFEA', gnd: '#3E4C72', hi: 0.56, sun: '#ECE6FF', si: 0.3, off: [-2.4, 7, 5], bg: SKYBG, rim: ['#B8C6F0', 0.14], fog: '#171B30' },
    cam: CAM,
    build(R) {
      const { T, PI, group: g, put, box, cyl, rbox, sphS, GEO } = R;
      const W = 7, D = 5, week = wk();
      const toon = R.toon;
      const basic = (c, x) => R.keep(new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, x || {})));
      const hitM = basic('#FFFFFF', { visible: false });
      const grp = (par, x, y, z, ry, key) => { const q = new T.Group(); q.position.set(x, y, z); if (ry) q.rotation.y = ry; if (key) q.userData.key = key; par.add(q); return q; };
      const hit = (par, x, y, z, w, h, d) => { const m = put(par, GEO.box, hitM, [x, y, z], [w, h, d]); m.castShadow = false; m.receiveShadow = false; return m; };
      const prox = (key, x, y, z, w, h, d) => { const q = grp(g, x, y, z, 0, key); hit(q, 0, 0, 0, w, h, d); return q; };
      const M = {
        navy: toon('#3E4C72'), navyD: toon('#2A3150'), cream: toon('#FFF4EC'),
        brass: toon('#E8C770', { emissive: new T.Color('#B8903A'), emissiveIntensity: 0.22 }),
        velvet: toon('#9E2F47'), ink: toon('#3A2E3F'),
        lamp: toon('#FFE9B8', { emissive: new T.Color('#FFD27A'), emissiveIntensity: 0.9 }),
      };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // точки-звёзды: свой маленький шейдер (размер и прозрачность — у каждой точки)
      const starMat = (add) => R.keep(new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uK: { value: 1 } },
        vertexShader: 'attribute float size; attribute float alpha; attribute float phase; attribute vec3 scol; uniform float uDpr; uniform float uTime; uniform float uK; varying float vA; varying vec3 vC;\n' +
          'void main(){ vC = scol; vA = alpha * uK * (0.72 + 0.28 * sin(uTime * 1.6 + phase)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uDpr; }',
        fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); a = a * a * 1.4; gl_FragColor = vec4(vC, min(1.0, a) * vA); }',
        transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
      }));
      const pointsGeo = (pos, size, alpha, col, phase) => {
        const ge = R.keep(new T.BufferGeometry());
        ge.setAttribute('position', new T.BufferAttribute(pos, 3)); ge.setAttribute('size', new T.BufferAttribute(size, 1));
        ge.setAttribute('alpha', new T.BufferAttribute(alpha, 1)); ge.setAttribute('scol', new T.BufferAttribute(col, 3)); ge.setAttribute('phase', new T.BufferAttribute(phase, 1));
        return ge;
      };

      /* ---------- атлас: «ВЫХОД», полоска на пустом круге, табличка «8 минут», палитра планет, проектор ---------- */
      const AW = 1024, AH = 512, [acv, ac] = R.cnv(AW, AH);
      const atlasM = toon('#FFFFFF', { map: R.tex(acv) });
      const aplane = (par, [sx, sy, sw, sh], p, s, r, mat) => {
        const ge = R.keep(new T.PlaneGeometry(1, 1)), u0 = sx / AW, u1 = (sx + sw) / AW, v0 = 1 - (sy + sh) / AH, v1 = 1 - sy / AH;
        ge.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
        const m = put(par, ge, mat || atlasM, p, s, r); m.castShadow = false; return m;
      };
      { const c = ac;
        c.fillStyle = '#171B30'; R.rrect(c, 4, 4, 312, 88, 18); c.fill(); R.text(c, 'ВЫХОД', 160, 50, 58, '#BFF0CE');
        // белая полоска скотча с надписью
        c.fillStyle = '#FFFDF6'; c.beginPath(); c.moveTo(8, 112); for (let x = 8; x <= 1016; x += 24) c.lineTo(x, 108 + (x / 24 % 2) * 6); c.lineTo(1016, 222); for (let x = 1016; x >= 8; x -= 24) c.lineTo(x, 226 - (x / 24 % 2) * 6); c.closePath(); c.fill();
        R.text(c, 'Солнце', 512, 148, 50, '#3A2E3F', { f: 'Caveat', w: 700 }); R.text(c, '(временно отсутствует)', 512, 194, 40, '#5A4C5C', { f: 'Caveat', w: 700, max: 900 });
        // латунная табличка «8 минут»
        const gr = c.createLinearGradient(0, 240, 0, 400); gr.addColorStop(0, '#F3D88A'); gr.addColorStop(1, '#D4AE58'); c.fillStyle = gr; R.rrect(c, 4, 244, 412, 150, 22); c.fill();
        c.strokeStyle = '#9E7A2E'; c.lineWidth = 6; R.rrect(c, 16, 256, 388, 126, 16); c.stroke();
        R.text(c, '8 минут', 210, 320, 74, '#5A4320', { f: 'Comfortaa', w: 700, max: 360 });
        [[30, 270], [390, 270], [30, 368], [390, 368]].forEach(([x, y]) => { c.fillStyle = '#9E7A2E'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); });
        // палитра планет (по одной клетке на цвет)
        ['#B9B4C2', '#F2D7A0', '#7FB8D6', '#E58A64', '#E9C890', '#D9B77A', '#8FC48A', '#FFE9B8'].forEach((col, i) => { c.fillStyle = col; c.fillRect(440 + i * 32, 248, 32, 32); });
        c.fillStyle = '#A88B58'; c.fillRect(440, 284, 256, 6); }
      const palUV = i => [(440 + i * 32 + 16) / AW, 1 - 264 / AH];
      const tint = (geo, i) => { const ge = geo.clone(); const uv = ge.attributes.uv, [u, v] = palUV(i); for (let k = 0; k < uv.count; k++) uv.setXY(k, u, v); return R.keep(ge); };

      const S = new T.Group(); g.add(S);   // без тени
      const F = new T.Group(); g.add(F);   // с тенью

      /* ---------- пол: тёмный, ковёр-круг с латунной каймой ---------- */
      box(S, M.navyD, 0, -0.07, -D / 2, W + 0.4, 0.14, D + 0.2);
      put(S, R.keep(new T.CircleGeometry(3.0, 48)), M.navy, [0, 0.004, -2.0], null, [-PI / 2, 0, 0]).receiveShadow = true;
      put(S, R.keep(new T.RingGeometry(2.96, 3.02, 72)), M.brass, [0, 0.008, -2.0], null, [-PI / 2, 0, 0]);
      put(S, R.keep(new T.RingGeometry(1.22, 1.26, 56)), M.brass, [0, 0.007, -2.0], null, [-PI / 2, 0, 0]);
      { const q = R.rng(3); for (let i = 0; i < 26; i++) { const a = q() * PI * 2, r = 1.4 + q() * 1.45; put(S, R.keep(new T.CircleGeometry(0.012 + q() * 0.018, 6)), M.brass, [Math.cos(a) * r, 0.009, -2.0 + Math.sin(a) * r], null, [-PI / 2, 0, 0]); } }

      /* ---------- полукупол со звёздами, латунная кромка ---------- */
      const domeM = toon('#2E3558', { side: T.BackSide });
      put(S, R.keep(new T.SphereGeometry(DR, 48, 18, PI, PI, 0, PI / 2)), domeM, [DC.x, DC.y, DC.z]).receiveShadow = false;
      put(S, R.keep(new T.TorusGeometry(DR, 0.06, 8, 64, PI)), M.brass, [DC.x, 0, DC.z]);
      // передние стенки-барабан по бокам (от купола до разреза) с дверью слева
      [-1, 1].forEach(sd => { rbox(S, M.navy, sd * (W / 2 + 0.06), 1.3, -0.8, 0.14, 2.6, 1.7, 0.03); box(S, M.cream, sd * (W / 2 - 0.01), 2.55, -0.8, 0.05, 0.1, 1.7); box(S, M.cream, sd * (W / 2 - 0.01), 0.08, -0.8, 0.05, 0.16, 1.7); });
      // фоновые звёзды: ~300 точек по куполу, кремовые и золотистые
      const NS = 300, sp = new Float32Array(NS * 3), ss = new Float32Array(NS), sa = new Float32Array(NS), sc = new Float32Array(NS * 3), sph = new Float32Array(NS);
      { const q = R.rng(42), cols = [[1, 0.96, 0.88], [1, 0.88, 0.62], [0.9, 0.92, 1]];
        for (let i = 0; i < NS; i++) {
          const a = (q() - 0.5) * PI * 0.98, e = Math.asin(0.12 + q() * 0.86), r = 3.32;
          sp.set([r * Math.cos(e) * Math.sin(a), r * Math.sin(e), -r * Math.cos(e) * Math.cos(a)], i * 3);
          ss[i] = 2 + q() * 2 + (q() < 0.06 ? 2 : 0); sa[i] = 0.55 + q() * 0.45; sc.set(cols[i % 3], i * 3); sph[i] = q() * 6.3;
        } }
      const sky = new T.Points(pointsGeo(sp, ss, sa, sc, sph), starMat(true)); sky.position.set(DC.x, DC.y, DC.z); sky.frustumCulled = false; sky.renderOrder = 2; g.add(sky);

      /* ---------- пустой круг на куполе: «Солнце (временно отсутствует)» ---------- */
      const BL = onDome(0, 0.98, 3.22);
      const [kcv, kc] = R.cnv(512, 512);
      { const gr = kc.createRadialGradient(256, 236, 20, 256, 256, 200); gr.addColorStop(0, '#5A6A98'); gr.addColorStop(1, '#46557F'); kc.fillStyle = gr; kc.beginPath(); kc.arc(256, 256, 196, 0, 7); kc.fill();
        kc.strokeStyle = '#FFF4EC'; kc.lineWidth = 11; kc.setLineDash([30, 18]); kc.beginPath(); kc.arc(256, 256, 204, 0, 7); kc.stroke(); kc.setLineDash([]);
        kc.save(); kc.translate(256, 262); kc.rotate(-0.1); kc.fillStyle = 'rgba(0,0,0,.18)'; kc.fillRect(-236, -50, 472, 112);
        kc.fillStyle = '#FFFDF6'; kc.beginPath(); kc.moveTo(-240, -56); for (let x = -240; x <= 240; x += 20) kc.lineTo(x, -56 + ((x / 20) % 2 ? 5 : 0)); kc.lineTo(240, 54); for (let x = 240; x >= -240; x -= 20) kc.lineTo(x, 54 - ((x / 20) % 2 ? 5 : 0)); kc.closePath(); kc.fill();
        R.text(kc, 'Солнце', 0, -16, 62, '#3A2E3F', { f: 'Caveat', w: 700 }); R.text(kc, '(временно отсутствует)', 0, 30, 44, '#5A4C5C', { f: 'Caveat', w: 700, max: 440 }); kc.restore(); }
      const blank = grp(S, BL[0], BL[1], BL[2]); blank.lookAt(DC.x, DC.y + 0.9, DC.z + 1.5);
      put(blank, GEO.plane, toon('#FFFFFF', { map: R.tex(kcv), alphaTest: 0.5 }), [0, 0, 0.02], [1.15, 1.15, 1]).castShadow = false;
      { const pb = grp(g, BL[0], BL[1], BL[2]); pb.lookAt(DC.x, DC.y + 0.9, DC.z + 1.5); pb.userData.key = 'spot:blank'; hit(pb, 0, 0, 0.12, 1.4, 1.1, 0.2); }

      /* ---------- проектор: шар с дырочками на подставке ---------- */
      const PX = 0, PZ = -2.7;
      { const pf = grp(F, PX, 0, PZ);
        cyl(pf, M.navyD, 0, 0.06, 0, 0.32, 0.12); cyl(pf, M.brass, 0, 0.13, 0, 0.26, 0.03);
        cyl(pf, M.ink, 0, 0.5, 0, 0.07, 0.74); cyl(pf, M.brass, 0, 0.88, 0, 0.12, 0.05);
        [-1, 1].forEach(sd => box(pf, M.brass, sd * 0.2, 1.05, 0, 0.03, 0.34, 0.06)); }
      const [bcv, bc] = R.cnv(256, 128); bc.fillStyle = '#2A2238'; bc.fillRect(0, 0, 256, 128);
      { const q = R.rng(9); for (let i = 0; i < 90; i++) { const x = q() * 256, y = 10 + q() * 108, r = 1.5 + q() * 2.4; bc.fillStyle = q() < 0.5 ? '#FFD98A' : '#E8C770'; bc.beginPath(); bc.arc(x, y, r, 0, 7); bc.fill(); } }
      const ball = put(g, GEO.sph, toon('#FFFFFF', { map: R.tex(bcv), emissive: new T.Color('#3A2E3F'), emissiveIntensity: 0.3 }), [PX, 1.2, PZ], [0.3, 0.3, 0.3]);
      ball.raycast = () => {};
      prox('spot:projector', PX, 0.75, PZ, 0.75, 1.6, 0.75);

      /* ---------- пульт и голубь Тихо в очках ---------- */
      const KX = 0.88, KZ = -2.92, KT = 0.78;
      { const kf = grp(F, KX, 0, KZ, -0.35);
        rbox(kf, M.navyD, 0, KT / 2, 0, 0.5, KT, 0.42, 0.03);
        const top = grp(kf, 0, KT, 0.02); top.rotation.x = 0.3; rbox(top, M.navy, 0, 0, 0, 0.52, 0.05, 0.44, 0.02);
        const ks = grp(S, KX, 0, KZ, -0.35), kt = grp(ks, 0, KT + 0.03, 0.02); kt.rotation.x = 0.3;
        [[-0.16, 0.12, M.lamp], [-0.06, 0.12, M.brass], [0.04, 0.12, M.lamp], [0.14, 0.12, M.velvet]].forEach(([x, z, m]) => cyl(kt, m, x, 0.01, z, 0.025, 0.02)); }
      const ty = R.npc.pigeon();
      ty.id = 'tycho'; ty.root.userData.key = 'npc:tycho';
      { const ink = M.ink; [-1, 1].forEach(sd => put(ty.head, R.ringG(0.024, 0.005), ink, [sd * 0.028, 0.006, 0.058], null, [0, sd * 0.3, 0]).castShadow = false); box(ty.head, ink, 0, 0.008, 0.066, 0.012, 0.004, 0.004).castShadow = false; }
      put(ty.root, GEO.sph, hitM, [0, 0.2, 0], [0.18, 0.2, 0.18]).castShadow = false;
      ty.root.scale.setScalar(1.45); ty.root.position.set(KX - 0.04, KT + 0.04, KZ + 0.02); ty.root.rotation.y = 0.15; g.add(ty.root);

      /* ---------- три кресла-лежака (откинуты назад, лицом к куполу) ---------- */
      const SEATS = [-1.6, 0, 1.6], SZ = -1.3;
      SEATS.forEach(x => {
        const sf = grp(F, x, 0, SZ);
        rbox(sf, M.navyD, 0, 0.16, 0, 0.56, 0.32, 0.62, 0.04);
        rbox(sf, M.velvet, 0, 0.4, 0.02, 0.62, 0.16, 0.66, 0.06);
        const bk = grp(sf, 0, 0.42, 0.3); bk.rotation.x = 0.62;
        rbox(bk, M.velvet, 0, 0.36, 0.06, 0.62, 0.78, 0.16, 0.07); rbox(bk, M.velvet, 0, 0.8, 0.02, 0.4, 0.18, 0.16, 0.07);
        [-1, 1].forEach(sd => { rbox(sf, M.velvet, sd * 0.34, 0.56, 0.06, 0.1, 0.12, 0.56, 0.04); box(sf, M.brass, sd * 0.34, 0.63, 0.06, 0.1, 0.012, 0.5); });
      });
      prox('spot:seats', 0, 0.55, SZ + 0.05, 4.0, 1.1, 0.8);

      /* ---------- мобиль: пять планет на ниточках (одна палитра — один вызов) ---------- */
      const MX = 1.55, MY = 2.12, MZ = -2.7;
      const domeY = Math.sqrt(Math.max(0.1, DR * DR - (MX - DC.x) ** 2 - (MZ - DC.z) ** 2));
      cyl(S, M.cream, MX, (MY + domeY) / 2 + 0.05, MZ, 0.004, domeY - MY - 0.1);
      const mob = grp(g, MX, MY, MZ);
      { const mm = new T.Group(); mob.add(mm);
        const palM = atlasM, sphG = R.keep(new T.SphereGeometry(1, 18, 12));
        put(mm, R.ringG(0.42, 0.012), M.brass, [0, 0, 0], null, [PI / 2, 0, 0]);
        [[0, 0.06, 0], [1, 0.08, 0], [2, 0.1, 0], [3, 0.075, 0], [4, 0.13, 1]].forEach(([ci, r, ring], i) => {
          const a = i / 5 * PI * 2, x = Math.cos(a) * 0.42, z = Math.sin(a) * 0.42, hy = -0.22 - (i % 3) * 0.13;
          cyl(mm, M.cream, x, hy / 2, z, 0.003, -hy);
          put(mm, tint(sphG, ci === 4 ? 5 : ci), palM, [x, hy - r, z], [r, r, r]);
          if (ring) put(mm, tint(R.ringG(0.2, 0.025), 4), palM, [x, hy - r, z], [1, 1, 0.25], [PI / 2 + 0.35, 0, 0.2]);
        });
        R.bake(mm, null, { cast: false }); }
      mob.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      prox('spot:mobile', MX, MY - 0.2, MZ, 1.1, 0.9, 1.1);

      /* ---------- подставка с латунной табличкой «8 минут» ---------- */
      const LX = -1.3, LZ = -3.3;
      { const lf = grp(F, LX, 0, LZ, 0.25);
        cyl(lf, M.navyD, 0, 0.04, 0, 0.2, 0.08); cyl(lf, M.brass, 0, 0.5, 0, 0.03, 0.9);
        const tp = grp(lf, 0, 0.98, 0.02); tp.rotation.x = -0.55; rbox(tp, M.navyD, 0, 0, 0, 0.5, 0.04, 0.34, 0.015);
        aplane(tp, [4, 244, 412, 150], [0, 0.022, 0], [0.44, 0.16, 1], [-PI / 2, 0, 0]); }
      prox('spot:plaque', LX, 0.6, LZ, 0.6, 1.3, 0.5);

      /* ---------- неделя 6: гирлянда из звёзд фольги по кромке купола ---------- */
      if (week >= 6) {
        const st = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + PI / 2, r = i % 2 ? 0.045 : 0.1; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); } st.closePath();
        const sg = R.extrude(st, 0.02), foil = [M.brass, M.cream];
        for (let i = 1; i < 16; i++) { const a = i / 16 * PI, x = DC.x + Math.cos(a) * (DR - 0.15), y = Math.sin(a) * (DR - 0.15) - 0.12 - Math.abs(Math.sin(i * 1.7)) * 0.06; put(S, sg, foil[i % 2], [x, y, DC.z + 0.04], null, [0, 0, i * 0.4]).castShadow = false; }
      }

      /* ---------- дверь (левая стенка) с табличкой «ВЫХОД» ---------- */
      const DZ = -0.8;
      { const dg = grp(S, -W / 2 + 0.02, 0, DZ, PI / 2);
        put(dg, R.extrude(R.archShape(1.1, 2.15), 0.06), M.cream, [0, 0, 0.02]);
        put(dg, R.extrude(R.archShape(0.94, 2.03), 0.05), M.navyD, [0, 0, 0.06]);
        cyl(dg, M.lamp, 0, 1.55, 0.12, 0.11, 0.03, [PI / 2, 0, 0]); sphS(dg, M.brass, 0.33, 1.0, 0.13, 0.04);
        aplane(dg, [4, 4, 312, 88], [0, 2.38, 0.09], [0.64, 0.18, 1]); }
      prox('exitDoor', -W / 2 + 0.12, 1.1, DZ, 0.2, 2.2, 1.05);
      R.halo(g, -W / 2 + 0.28, 2.38, DZ, 0.7, '#BFF0CE', 0.4);
      // тёплый свет от пульта и ночник у таблички
      R.halo(g, KX - 0.1, KT + 0.25, KZ + 0.15, 0.7, '#FFD9A0', 0.35);

      /* ---------- мини «Ковш»: 12 звёзд (один Points), линии (один меш), цифры 1–7 (одна плоскость) ---------- */
      const N12 = 12, mp = new Float32Array(N12 * 3), msz = new Float32Array(N12), mal = new Float32Array(N12), mcol = new Float32Array(N12 * 3), mph = new Float32Array(N12);
      MINI.forEach((p, i) => { mp.set(p, i * 3); msz[i] = 14; mal[i] = 0; mcol.set(i < 7 ? [1, 0.93, 0.7] : [1, 0.8, 0.86], i * 3); mph[i] = i * 0.9; });
      const miniGeo = pointsGeo(mp, msz, mal, mcol, mph), miniMat = starMat(true);
      const mini = new T.Points(miniGeo, miniMat); mini.frustumCulled = false; mini.renderOrder = 6; mini.visible = false; g.add(mini);
      const anchors = MINI.map((p, i) => { const o = new T.Object3D(); o.position.set(p[0], p[1], p[2]); o.userData.tap = i < 7 ? 'd' + i : 'w' + (i - 7); o.visible = false; g.add(o); return o; });
      // линии: 13 отрезков-ленточек, видимая часть растёт через drawRange
      const lp = new Float32Array(SEG.length * 6 * 3), dc = new T.Vector3(DC.x, DC.y, DC.z), A = new T.Vector3(), B = new T.Vector3(), nn = new T.Vector3(), sd = new T.Vector3();
      SEG.forEach(([i, j], k) => {
        A.fromArray(MINI[i]); B.fromArray(MINI[j]); nn.copy(A).add(B).multiplyScalar(0.5).sub(dc).normalize();
        A.addScaledVector(nn, -0.03); B.addScaledVector(nn, -0.03);
        sd.copy(B).sub(A).cross(nn).normalize().multiplyScalar(0.016);
        const v = [A.clone().add(sd), A.clone().sub(sd), B.clone().add(sd), B.clone().sub(sd)];
        [v[0], v[1], v[2], v[2], v[1], v[3]].forEach((q, n) => lp.set([q.x, q.y, q.z], (k * 6 + n) * 3));
      });
      const lineGeo = R.keep(new T.BufferGeometry()); lineGeo.setAttribute('position', new T.BufferAttribute(lp, 3)); lineGeo.setDrawRange(0, 0);
      const lines = new T.Mesh(lineGeo, basic('#FFD98A', { transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false }));
      lines.frustumCulled = false; lines.renderOrder = 5; lines.visible = false; lines.raycast = () => {}; g.add(lines);
      // цифры 1–7: плоскость перед областью, цифры рисуются по лучам камера → звезда
      const [ncv, nctx] = R.cnv(512, 512), numTex = R.tex(ncv);
      const nums = new T.Mesh(R.keep(new T.PlaneGeometry(1, 1)), basic('#FFFFFF', { map: numTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      nums.renderOrder = 7; nums.visible = false; nums.raycast = () => {}; g.add(nums);
      const wob = new Float32Array(N12).fill(-1), pul = new Float32Array(N12).fill(-1);
      let miniK = 0, miniOn = false, numsK = 0, numsOn = false, lineN = 0, lineShown = 0;

      const blockers = [
        { x0: -1.92, x1: -1.28, z0: -1.62, z1: -1.0 }, { x0: -0.32, x1: 0.32, z0: -1.62, z1: -1.0 }, { x0: 1.28, x1: 1.92, z0: -1.62, z1: -1.0 },   // кресла
        { x0: PX - 0.34, x1: PX + 0.34, z0: PZ - 0.34, z1: PZ + 0.34 },   // проектор
        { x0: KX - 0.3, x1: KX + 0.3, z0: KZ - 0.26, z1: KZ + 0.26 },     // пульт
        { x0: LX - 0.22, x1: LX + 0.22, z0: LZ - 0.22, z1: LZ + 0.22 },   // табличка
        { x0: -W / 2, x1: -2.55, z0: -D, z1: -3.6 }, { x0: 2.55, x1: W / 2, z0: -D, z1: -3.6 },   // края купола
        { x0: -W / 2, x1: -1.5, z0: -D, z1: -4.25 }, { x0: 1.5, x1: W / 2, z0: -D, z1: -4.25 },
      ];

      R.bake(F, null, { cast: true });
      R.bake(S, null, { cast: false });
      [F, S].forEach(q => q.traverse(m => { if (m.isMesh) m.raycast = () => {}; }));

      const SEAT_H = 0.48;
      return {
        W, D,
        bounds: { x0: -3.05, x1: 3.05, z0: -4.3, z1: -0.3 },
        exit: { x: -3.05, z: DZ }, exitDir: [-0.9, 0],
        spawn: { x: -2.6, z: -2.4 },
        cam: { x0: -2.0, x1: 1.4, z: -1.6 },
        blockers,
        catSpot: { x: 1.6, z: -1.3, ry: Math.PI },
        spots: [
          { id: 'blank', x: -0.72, z: -3.62, act: 'Посмотреть', bubble: 'пустое место' },
          { id: 'plaque', x: -1.3, z: -2.7, act: 'Прочитать', bubble: 'табличка «8 минут»' },
          { id: 'mobile', x: 2.05, z: -2.2, act: 'Посмотреть', bubble: 'планеты на ниточках' },
          { id: 'seats', x: 0, z: -0.65, act: 'Прилечь', bubble: 'кресла' },
          { id: 'projector', x: 0, z: -1.95, act: 'Посмотреть', bubble: 'звёздный проектор' },
        ],
        npcs: { tycho: ty },
        // для содержимого места
        mini: {
          stars: MINI, seat: { x: 0, z: SZ, ry: Math.PI, from: [0, -0.65], recline: 0.6, h: SEAT_H },
          show(on) { miniOn = !!on; if (on) { mini.visible = true; lines.visible = true; } anchors.forEach((a, i) => { a.visible = !!on && i < 7; }); if (!on) { numsOn = false; lineGeo.setDrawRange(0, 0); lineN = lineShown = 0; for (let i = 0; i < N12; i++) { mal[i] = 0; } miniGeo.attributes.alpha.needsUpdate = true; } },
          dipper(on) { for (let i = 0; i < 7; i++) mal[i] = on ? 0.95 : 0; miniGeo.attributes.alpha.needsUpdate = true; },
          bow(on) { for (let i = 7; i < 12; i++) { mal[i] = on ? 0.9 : 0; anchors[i].visible = !!on; } miniGeo.attributes.alpha.needsUpdate = true; },
          pulse(i) { pul[i] = 0; }, wobble(i) { wob[i] = 0; },
          lines(n) { lineN = Math.max(0, Math.min(SEG.length, n)); },
          numbers(on, camPos) {
            numsOn = !!on; if (!on || !camPos) return;
            // плоскость в центре области, лицом к камере; цифры — там, где луч к звезде пересекает плоскость
            const C = new T.Vector3(); DIP.forEach((_, i) => C.add(new T.Vector3().fromArray(MINI[i]))); C.multiplyScalar(1 / 7);
            const cp = new T.Vector3().fromArray(camPos), n = cp.clone().sub(C).normalize();
            nums.position.copy(C).addScaledVector(n, 0.25); nums.lookAt(cp); nums.updateMatrixWorld(true);
            const size = 2.2; nums.scale.set(size, size, 1); nums.updateMatrixWorld(true);
            const inv = nums.matrixWorld.clone().invert(), pl = new T.Plane().setFromNormalAndCoplanarPoint(n, nums.position), ray = new T.Ray(), hp = new T.Vector3();
            nctx.clearRect(0, 0, 512, 512);
            for (let i = 0; i < 7; i++) {
              const s = new T.Vector3().fromArray(MINI[i]); ray.set(cp, s.clone().sub(cp).normalize());
              if (!ray.intersectPlane(pl, hp)) continue;
              const l = hp.clone().applyMatrix4(inv), px = (l.x + 0.5) * 512 + 20, py = (0.5 - l.y) * 512 - 18;
              nctx.font = '700 34px Nunito, sans-serif'; nctx.textAlign = 'center'; nctx.textBaseline = 'middle';
              nctx.fillStyle = 'rgba(23,27,48,.55)'; nctx.beginPath(); nctx.arc(px, py, 17, 0, 7); nctx.fill();
              nctx.fillStyle = '#FFE9B8'; nctx.fillText(String(i + 1), px, py + 1);
            }
            numTex.needsUpdate = true; nums.visible = true;
          },
          centroid() { const C = [0, 0, 0]; MINI.forEach(p => { C[0] += p[0] / N12; C[1] += p[1] / N12; C[2] += p[2] / N12; }); return C; },
        },
        tick(t, dt, ctx) {
          sky.material.uniforms.uTime.value = t; miniMat.uniforms.uTime.value = t * 1.6;
          sky.rotation.y = Math.sin(t * 0.05) * 0.05;
          ball.rotation.y = t * 0.25; ball.rotation.z = Math.sin(t * 0.2) * 0.15;
          mob.rotation.y = t * 0.22;
          // мини: появление, пульс, покачивание, линии, цифры
          miniK += ((miniOn ? 1 : 0) - miniK) * Math.min(1, dt * 3); miniMat.uniforms.uK.value = miniK; if (!miniOn && miniK < 0.02) { mini.visible = false; lines.visible = false; }
          let dirty = false;
          for (let i = 0; i < N12; i++) {
            let s = i < 7 ? 15 : 13;
            if (pul[i] >= 0) { pul[i] += dt; s += Math.sin(Math.min(1, pul[i] / 0.5) * PI) * 12; if (pul[i] > 0.5) pul[i] = -1; }
            if (i >= 7 && mal[i] > 0) s += Math.sin(t * 5 + i) * 3.5;
            if (s !== msz[i]) { msz[i] = s; dirty = true; }
            if (wob[i] >= 0) { wob[i] += dt; const k = Math.sin(wob[i] * 40) * 0.035 * (1 - wob[i] / 0.45); mp[i * 3] = MINI[i][0] + k; if (wob[i] > 0.45) { wob[i] = -1; mp[i * 3] = MINI[i][0]; } miniGeo.attributes.position.needsUpdate = true; }
          }
          if (dirty) miniGeo.attributes.size.needsUpdate = true;
          if (lineShown < lineN) lineShown = Math.min(lineN, lineShown + dt * 6); else if (lineShown > lineN) lineShown = lineN;
          lineGeo.setDrawRange(0, Math.floor(lineShown + 0.0001) * 6 + (lineShown % 1 > 0.5 ? 6 : 0));
          numsK += ((numsOn ? 0.75 : 0) - numsK) * Math.min(1, dt * 2.5); nums.material.opacity = numsK; if (!numsOn && numsK < 0.02) nums.visible = false;
          // кот в кресле: подсаживаем на сиденье
          const c = ctx && ctx.cat;
          if (c && c.root.visible) { const d = Math.hypot(c.root.position.x - 1.6, c.root.position.z - SZ); if (d < 0.45) c.root.position.y = SEAT_H * Math.min(1, (0.45 - d) / 0.25); }
        },
      };
    },
  });

  /* ---------------------------- содержимое ---------------------------- */
  G.addSpeakers({
    tycho: { name: () => 'Голубь Тихо', art: () => { try { return Art.pigeon({ crop: true }).replace('</svg>', '<g fill="none" stroke="#5B4A3E" stroke-width="1.3"><circle cx="45.6" cy="16.2" r="3.3"/><path d="M42.3,16 L39.5,15.4"/></g></svg>'); } catch (e) { return G.emojiAvatar('🕊', '#D9DDF2'); } } },
  });
  const roomRoot = () => document.querySelector('#stage .screen:not(.out) .city3d.room3d');
  function strip(text, chips) {
    const root = roomRoot(), el = document.createElement('div'); el.className = 'room-puzzle i4-strip';
    el.innerHTML = `<div class="i4-task">${G.esc(text)}</div><div class="i4-row"></div>`;
    chips.forEach(c => { const b = document.createElement('button'); b.className = 'chip room-back'; b.textContent = c.label; b.addEventListener('click', e => { e.stopPropagation(); G.haptic('light'); c.fn(); }); el.querySelector('.i4-row').appendChild(b); });
    if (root) root.appendChild(el);
    return el;
  }
  Town.style('i4-strip', `.i4-strip .i4-task{font-weight:800;font-size:14px;text-align:center;line-height:1.3}
.i4-strip .i4-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.i4-strip .room-back{min-height:40px;font-size:14px;padding:8px 14px}`);
  Town.style('i4-sky', `.i4-sky{display:flex;flex-direction:column;align-items:center;gap:8px}
.i4-sky svg{width:min(78vw,300px);height:auto;border-radius:22px;background:radial-gradient(120% 90% at 50% 30%,#323A62,#171B30);touch-action:manipulation}
.i4-sky .st{cursor:pointer}.i4-sky .st circle.c{transition:r .2s}
.i4-sky .st.on circle.c{fill:#FFD98A}.i4-sky .st.wob{animation:i4wob .4s}
.i4-sky .st.bow circle.c{fill:#F7C9D3;animation:i4tw 1.2s ease-in-out infinite}
.i4-sky .num{opacity:0;transition:opacity .6s;font:700 11px Nunito,sans-serif;fill:#FFE9B8}
.i4-sky.hint .num{opacity:.8}
.i4-sky p{margin:0;font-weight:800;font-size:14px;text-align:center;color:#F3E3D3}
.i4-sky .row{display:flex;gap:8px;justify-content:center}
@keyframes i4wob{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes i4tw{0%,100%{opacity:1}50%{opacity:.45}}`);

  const DIP_LINE = { who: 'tycho', f: 'dipper' };
  const BOW_LINE = { who: 'tycho', text: 'В звёздном атласе Банта нет. Зато теперь он появился здесь. И, кажется, тебе подходит.', s: 'z_bow' };
  const CAT_LINE = { text: 'Под куполом мурлычет Пирожок. Впервые за день Тихо не просит тишины.', s: 'z_cat' };

  // камера для мини: смотрим из кресла на область, отходим, пока все 12 звёзд не влезут в кадр
  function miniView(m) {
    const T = THREE, root = roomRoot(), w = (root && root.clientWidth) || 390, h = (root && root.clientHeight) || 844, a = w / h;
    const cam = new T.PerspectiveCamera(a < 0.75 ? CAM.portrait.fov : CAM.landscape.fov, a, 0.1, 60);
    const C = new T.Vector3().fromArray(m.centroid()), eye = new T.Vector3(0, 2.1, -0.5), dir = eye.clone().sub(C).normalize();
    let d = 1.6, pos = null;
    for (let k = 0; k < 40; k++, d += 0.12) {
      pos = C.clone().addScaledVector(dir, d); cam.position.copy(pos); cam.lookAt(C); cam.updateMatrixWorld(true);
      const ok = m.stars.every(p => { const v = new T.Vector3().fromArray(p).project(cam); return Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.66 && v.z < 1; });
      if (ok) break;
    }
    return { pos: [pos.x, pos.y, pos.z], look: [C.x, C.y, C.z] };
  }

  async function kovsh3D(ctx, room) {
    const m = room.mini, rr = roomRoot();
    let phase = 'demo', next = 0, misses = 0, quit = false, skip = false, el = null, view = null;
    const bowGot = new Set();
    try {
      await ctx.sit(m.seat);
      if (ctx.catHere) ctx.api.catTo(1.6, -1.3, { ry: Math.PI });
      ctx.mark('kovsh');
      ctx.dim(0.45);
      view = miniView(m);
      ctx.focus(view.pos, view.look); ctx.api.focusMode(true);
      m.show(true); m.dipper(true);
      el = strip('Ковш: звёзды по порядку — от ручки к ковшу', [{ label: 'пропустить', fn: () => { skip = true; } }, { label: 'Встать', fn: () => { quit = true; } }]);
      await ctx.wait(1300);
      { // проверка кадра (в журнал отладки): сколько из 12 звёзд в окне
        const w = (rr && rr.clientWidth) || 390, h = (rr && rr.clientHeight) || 844, ar = G.app.getBoundingClientRect(), rb = rr ? rr.getBoundingClientRect() : ar;
        const sc = m.stars.map(p => { const q = ctx.api.toScreen(p[0], p[1], p[2]); return [Math.round(q.x - (rb.left - ar.left)), Math.round(q.y - (rb.top - ar.top))]; });
        const inView = sc.filter(([x, y]) => x > 8 && x < w - 8 && y > 60 && y < h - 8).length;
        ctx.mark('kovsh-view ' + inView + '/12'); ctx.mark('kovsh-xy ' + JSON.stringify(sc));
      }
      for (let i = 0; i < 7; i++) { m.pulse(i); await ctx.wait(260); }
      await ctx.say({ who: 'tycho', text: 'Найдите Ковш. Звёзды по порядку — от ручки к ковшу.' });
      phase = 'dipper';
      ctx.api.intercept(hh => {
        const nm = hh && hh.name;
        if (phase === 'dipper') {
          if (nm && nm[0] === 'd') {
            const i = +nm.slice(1);
            if (i === next) { m.pulse(i); G.haptic('select'); next++; m.lines(Math.max(0, next - 1)); if (next >= 7) { m.lines(7); phase = 'dipDone'; } }
            else if (i >= next) { m.wobble(i); G.haptic('light'); misses++; }
          } else if (!nm) misses++;
          if (misses >= 2) m.numbers(true, view.pos);
        } else if (phase === 'bow') {
          if (nm && nm[0] === 'w') { const i = +nm.slice(1); if (!bowGot.has(i)) { bowGot.add(i); m.pulse(7 + i); G.haptic('select'); if (bowGot.size >= 5) phase = 'bowDone'; } }
        }
        return true;   // под куполом тапы не поднимают героиню
      });
      ctx.mark('intercept');
      while (phase === 'dipper' && !quit && !skip) await ctx.wait(80);
      if (quit) return true;
      if (skip) { skip = false; m.lines(7); next = 7; }
      m.numbers(false); el.querySelector('.i4-task').textContent = 'Ковш готов!';
      ctx.sparkle('star');
      await ctx.wait(600);
      await ctx.say(DIP_LINE);
      // звёзды «Банта»
      m.bow(true); phase = 'bow';
      el.querySelector('.i4-task').textContent = 'Ещё пять звёздочек мерцают — в любом порядке';
      ctx.mark('bow');
      while (phase === 'bow' && !quit && !skip) await ctx.wait(80);
      if (quit) return true;
      m.lines(SEG_TOTAL); ctx.sparkle('heart');
      el.querySelector('.i4-task').textContent = 'Созвездие Банта';
      await ctx.wait(900);
      await ctx.say(BOW_LINE);
      if (ctx.catHere) await ctx.say(CAT_LINE);
      await ctx.wait(400);
    } finally {
      if (el) el.remove();
      if (rr) rr.classList.remove('focus-on');
      if (!ctx.gone) { ctx.api.intercept(null); m.show(false); ctx.api.focusMode(false); ctx.release(); ctx.dim(1); ctx.stand(); if (ctx.catHere) ctx.api.catFree(); }
    }
    return true;
  }
  const SEG_TOTAL = 13;

  // 2D: лист с картой неба — 7 точек «Ковша» и 5 точек «Банта»
  function skySVG() {
    const X = u => 150 + u * 150, Y = v => 128 - v * 150;
    const pts = [].concat(DIP.map(([u, v], i) => ({ id: 'd' + i, x: X(u), y: Y(v), n: i + 1 })), BOWS.map(([u, v], i) => ({ id: 'w' + i, x: X(u), y: Y(v), n: 0 })));
    const segs = SEG.map(([i, j], k) => `<line class="sg" data-k="${k}" x1="${pts[i].x.toFixed(1)}" y1="${pts[i].y.toFixed(1)}" x2="${pts[j].x.toFixed(1)}" y2="${pts[j].y.toFixed(1)}" stroke="#FFD98A" stroke-width="2.4" stroke-linecap="round" opacity="0"/>`).join('');
    const q = (() => { let a = 7; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; })();
    let bg = ''; for (let i = 0; i < 60; i++) bg += `<circle cx="${(q() * 300).toFixed(1)}" cy="${(q() * 260).toFixed(1)}" r="${(0.6 + q() * 1.1).toFixed(2)}" fill="#FFF4D8" opacity="${(0.3 + q() * 0.5).toFixed(2)}"/>`;
    const stars = pts.map(p => `<g class="st ${p.n ? '' : 'w'}" data-s="${p.id}" style="${p.n ? '' : 'display:none'}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" fill="transparent"/><circle class="c" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#FFF4D8"/>${p.n ? `<text class="num" x="${(p.x + 12).toFixed(1)}" y="${(p.y - 9).toFixed(1)}">${p.n}</text>` : ''}</g>`).join('');
    return `<svg viewBox="0 0 300 260" role="img" aria-label="звёздное небо">${bg}${segs}${stars}</svg>`;
  }
  // два листа подряд (реплика Тихо — между ними: поверх листа реплику не видно)
  function skySheet(ctx, phase) {
    return ctx.sheet({
      title: phase === 'dipper' ? 'Ковш' : 'Ещё пять звёздочек', dark: true,
      body: `<div class="i4-sky">${skySVG()}<p class="tx">${phase === 'dipper' ? 'Звёзды по порядку — от ручки к ковшу' : 'Пять звёздочек мерцают — в любом порядке'}</p><div class="row"><button class="chip" data-skip>пропустить</button></div></div>`,
      onMount(el, close) {
        const box = el.querySelector('.i4-sky'), tx = el.querySelector('.tx');
        let next = 0, misses = 0, done = false; const got = new Set();
        const seg = n => el.querySelectorAll('.sg').forEach(l => { if (+l.dataset.k < n) l.setAttribute('opacity', '1'); });
        const finish = (v, n, text) => { if (done) return; done = true; seg(n); tx.textContent = text; G.haptic('success'); setTimeout(() => close(v), 650); };
        if (phase === 'bow') { el.querySelectorAll('.st:not(.w)').forEach(g => g.classList.add('on')); seg(7); el.querySelectorAll('.st.w').forEach(g => { g.style.display = ''; g.classList.add('bow'); }); }
        box.addEventListener('click', e => {
          if (done) return;
          if (e.target.closest('[data-skip]')) { if (phase === 'dipper') finish('dip', 7, 'Ковш готов!'); else finish('bow', 13, 'Созвездие Банта'); return; }
          const g = e.target.closest('.st');
          if (phase === 'dipper') {
            if (g && g.dataset.s[0] === 'd') { const i = +g.dataset.s.slice(1); if (i === next) { g.classList.add('on'); G.haptic('select'); next++; seg(next - 1); if (next >= 7) finish('dip', 7, 'Ковш готов!'); } else if (i > next) { g.classList.remove('wob'); g.classList.add('wob'); setTimeout(() => g.classList.remove('wob'), 420); misses++; G.haptic('light'); } }
            else if (e.target.closest('svg')) misses++;
            if (misses >= 2) box.classList.add('hint');
          } else if (g && g.dataset.s[0] === 'w') { const i = +g.dataset.s.slice(1); if (!got.has(i)) { got.add(i); g.classList.add('on'); G.haptic('select'); if (got.size >= 5) finish('bow', 13, 'Созвездие Банта'); } }
        });
      },
    });
  }
  async function kovsh2D(ctx) {
    ctx.mark('kovsh');
    if (await skySheet(ctx, 'dipper') !== 'dip') return true;
    await ctx.say(DIP_LINE);
    ctx.mark('bow');
    if (await skySheet(ctx, 'bow') !== 'bow') return true;
    await ctx.say(BOW_LINE);
    if (ctx.catHere) await ctx.say(CAT_LINE);
    return true;
  }
  async function seatsUse(ctx) {
    const room = ctx.is3d ? ctx.api.room : null;
    if (room && room.mini) return kovsh3D(ctx, room);
    return kovsh2D(ctx);
  }
  async function projectorUse(ctx) {
    const n = ctx.n('projector');
    if (n === 3 && !ctx.has('z_star')) {
      if (ctx.is3d) {
        try {
          const T = THREE, hd = ctx.api.heroHead(), [cv, c] = (() => { const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 64; return [cv2, cv2.getContext('2d')]; })();
          c.fillStyle = '#FFD98A'; c.strokeStyle = '#B8903A'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 12 : 28; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
          const tx = new T.CanvasTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
          sp.scale.setScalar(0.14); sp.position.set(-0.08, 0.36, 0.06); hd.add(sp);
          setTimeout(() => { try { hd.remove(sp); sp.material.dispose(); tx.dispose(); } catch (e) { /* комнаты уже нет */ } }, 6000);
        } catch (e) { /* без звезды */ }
      }
      ctx.sparkle('star');
      await ctx.say({ text: 'Звезда села прямо на берет. Кажется, теперь у тебя собственное созвездие.', s: 'z_star' });
      return true;
    }
    await ctx.line('projector');
    return true;
  }

  Town.place({
    id: P, kind: 'new',
    name: 'Планетарий «Ясно»', short: 'Планетарий',
    sign: 'ЯСНО', motto: 'планетарий · звёзды без выходных',
    icon: '🔭', color: '#C9CFEA',
    street: { x: 38.1, w: 4.0, doorDx: 0, bkey: null },
    room: P, opens: 2,
    host: { who: 'tycho', npc: 'tycho' },
    greet: {
      first: 'Тс-с! Добро пожаловать в планетарий. Звёзды здесь работают без выходных.',
      again: Town.v('Снова под куполом? Я проверил звёзды. Все на месте, кроме одной известной.', '{name}! Купол как раз потемнел.', 'Тихо… вот, теперь можно. Здравствуйте.'),
      regular: Town.v('Для постоянных звёзды горят на полтона ярче.', 'Проектор уже прогрет, Ковш на месте.', 'Ты бываешь здесь чаще некоторых комет. Это именно комплимент.'),
      away: 'Ты давно не заходила. Звёзды немного сдвинулись, но я всё помню.',
    },
    bark: 'Тихо! А, это вы — проходите.',
    weekly: { 6: 'Повесили гирлянду из звёзд фольги. Настоящие пока заняты: дежурят.' },
    fresh: [6],
    react: {
      cup: 'Какао под куполом можно. Только без крошек: звёзды пугаются.',
      popcorn: 'Попкорн можно. Но если кто-то проснётся от хруста — вини галактику.',
      bouquet: 'Цветы под звёздами? Хорошо придумано.',
      look: 'Новый образ виден даже в темноте. Это я как специалист по свету.',
    },
    spots: {
      blank: { icon: '⚪', label: 'Пустое место',
        lines: ['Табличка на куполе: „Солнце (временно отсутствует)“.', { f: 'mass' }] },
      plaque: { icon: '⏱', label: 'Табличка «8 минут»',
        lines: [{ f: '8min' }, 'Табличка начищена до блеска. „8 минут“ — и больше ни слова.'] },
      mobile: { icon: '🪐', label: 'Планеты на ниточках',
        lines: [{ f: 'planet' }, { f: 'venus' }] },
      seats: { icon: '💺', label: 'Кресла', secrets: ['z_bow', 'z_cat'], lines: [], onUse: seatsUse },
      projector: { icon: '⭐', label: 'Звёздный проектор', secret: 'z_star',
        lines: ['Шар с дырочками. Через каждую выглядывает звезда.', 'Тихо протирает его крылом. Звёзды от этого ярче — проверено.'], onUse: projectorUse },
    },
    npc: {
      tycho: [
        { who: 'tycho', text: 'Почему «Ясно»? Под куполом я хотя бы могу гарантировать погоду.' },
        { who: 'tycho', f: 'pigsn' },
        { who: 'tycho', text: 'Тихо — моё имя. И, если честно, пожелание на всю жизнь.' },
      ],
    },
    facts: {
      mass: { text: 'В Солнце сосредоточено около 99,8% массы Солнечной системы. Такую пропажу трудно не заметить.', wk: 0 },
      '8min': { text: 'Солнечный свет добирается до Земли примерно за 8 минут 20 секунд. Даже пропажа солнца раскрывается с задержкой.', wk: 0 },
      planet: { text: '„Планета“ по-гречески — „странница“: древние видели, что эти звёзды гуляют по небу.', wk: 0 },
      venus: { text: 'Венера поворачивается вокруг себя за 243 земных дня, а облетает Солнце за 225. Оборот дольше года!', wk: 0 },
      dipper: { text: 'Ковш — это не целое созвездие, а только часть Большой Медведицы.', wk: 0 },
      pigsn: { text: 'Голуби находят дорогу и по солнцу. Так что если мы сейчас немного кружим — это обстоятельства.', wk: 0 },
    },
    secrets: [
      { id: 'z_bow', title: 'Созвездие Банта', trigger: 'кресла: «Ковш», потом пять звёзд «Банта»' },
      { id: 'z_star', title: 'Звезда на берете', trigger: 'проектор: третий раз за визит' },
      { id: 'z_cat', title: 'Музыка под куполом', trigger: 'конец «Ковша», кот рядом' },
    ],
    stamp: { title: 'Ясно', icon: '🔭' },
  });
})();
