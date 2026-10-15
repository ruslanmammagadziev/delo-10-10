/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: метки дверей «как в GTA» (§3 world_unify).
   case  — высокий мягкий луч (у земли золотой, наверху розовый, пульсирует, ширина растёт с расстоянием),
           кольцо на земле расходится и тает, значок-лупа над дверью виден сквозь дома. 3 вызова на метку.
   soon  — табличка с замком и датой (без луча); new — розовая точка; fresh — золотая бирка «НОВОЕ»; done — галочка на 3 с.
   Обычное альфа-смешивание с насыщенным цветом: аддитивный свет на пастельном небе не виден (спайк 2).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI;

  WORLD.makeMarkers = function (H, scene) {
    const T = H.T, { keep, cnv, rrect, text } = H;
    const BEAM_H = 14;
    const beamGeo = keep(new T.CylinderGeometry(0.55, 0.75, BEAM_H, 24, 1, true)); beamGeo.translate(0, BEAM_H / 2, 0);
    const ringGeo = keep(new T.RingGeometry(0.62, 0.9, 40)); ringGeo.rotateX(-PI / 2);
    const BEAM_VS = 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y / ' + BEAM_H.toFixed(1) + '; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }';
    const BEAM_FS = 'uniform float uT; uniform vec3 uCol; uniform vec3 uCore; uniform float uNear; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 2.0); float fall = pow(1.0 - vY, 1.25); float pulse = 0.8 + 0.2 * sin(uT * 2.6); float bands = 0.82 + 0.18 * sin(vY * 34.0 - uT * 3.0); vec3 col = mix(uCore, uCol, clamp(vY * 1.6 + rim * 0.5, 0.0, 1.0)); float a = min(0.9, fall * pulse * bands * (0.45 + 0.55 * (1.0 - rim)) * uNear); gl_FragColor = vec4(col + 0.25 * (1.0 - rim) * (1.0 - vY), a); }';

    // значки рисуются путями (без эмодзи-шрифта): лупа, замок, точка, «НОВОЕ», галочка
    const icons = {};
    const pin = (draw) => { const [cv, c] = cnv(128, 128); c.fillStyle = '#C2405B'; c.beginPath(); c.arc(64, 58, 50, 0, 7); c.fill(); c.beginPath(); c.moveTo(46, 98); c.lineTo(82, 98); c.lineTo(64, 125); c.fill(); c.fillStyle = '#FFF6EE'; c.beginPath(); c.arc(64, 58, 42, 0, 7); c.fill(); draw(c); return cv; };
    const iconTex = kind => {
      if (icons[kind]) return icons[kind];
      let cv;
      if (kind === 'case') cv = pin(c => { c.strokeStyle = '#C2405B'; c.lineWidth = 9; c.beginPath(); c.arc(58, 52, 18, 0, 7); c.stroke(); c.lineCap = 'round'; c.lineWidth = 11; c.beginPath(); c.moveTo(71, 65); c.lineTo(86, 80); c.stroke(); });
      else if (kind === 'star') cv = pin(c => { c.fillStyle = '#E8A93A'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 13 : 30; c.lineTo(64 + Math.cos(a) * r, 58 + Math.sin(a) * r); } c.closePath(); c.fill(); });
      else if (kind === 'heart') cv = pin(c => { c.fillStyle = '#E8607E'; c.beginPath(); c.moveTo(64, 82); c.bezierCurveTo(30, 60, 40, 30, 64, 46); c.bezierCurveTo(88, 30, 98, 60, 64, 82); c.fill(); });
      else if (kind === 'done') { [cv] = cnv(128, 128); const c = cv.getContext('2d'); c.fillStyle = '#5FAE84'; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(38, 66); c.lineTo(57, 85); c.lineTo(91, 46); c.stroke(); }
      else if (kind === 'new') { [cv] = cnv(64, 64); const c = cv.getContext('2d'); c.fillStyle = '#F08FA8'; c.beginPath(); c.arc(32, 32, 24, 0, 7); c.fill(); c.fillStyle = '#FFF6EE'; c.beginPath(); c.arc(25, 25, 7, 0, 7); c.fill(); }
      else if (kind === 'fresh') { [cv] = cnv(192, 72); const c = cv.getContext('2d'); c.fillStyle = '#9E6B2E'; rrect(c, 0, 0, 192, 72, 20); c.fill(); text(c, 'НОВОЕ', 96, 38, 40, '#FFD98A'); }
      icons[kind] = keep(new T.CanvasTexture(cv));
      return icons[kind];
    };
    const soonTex = sub => { const [cv, c] = cnv(256, 112); c.fillStyle = '#FFF6EE'; rrect(c, 2, 2, 252, 108, 26); c.fill(); c.strokeStyle = '#8E89A6'; c.lineWidth = 6; rrect(c, 10, 10, 236, 92, 20); c.stroke();
      c.fillStyle = '#8E89A6'; rrect(c, 30, 50, 44, 36, 8); c.fill(); c.strokeStyle = '#8E89A6'; c.lineWidth = 7; c.beginPath(); c.arc(52, 50, 13, PI, 0); c.stroke();
      text(c, sub || 'скоро', 160, 58, 44, '#6E6272', { f: 'Comfortaa', w: 700, max: 150 }); return new T.CanvasTexture(cv); };

    const live = new Map();   // id → метка
    const group = new T.Group(); group.name = 'markers'; scene.add(group);
    let t0 = performance.now();

    function make(spec, door) {
      const g = new T.Group(); g.position.set(door.x + door.nx * 0.55, 0, door.z + door.nz * 0.55); group.add(g);
      const m = { spec, door, g, beam: null, ring: null, icon: null, U: null, born: performance.now(), own: [] };
      const own = x => { m.own.push(x); return x; };
      const style = spec.style || 'case';
      if (style === 'case') {
        const U = { uT: { value: 0 }, uCol: { value: new T.Color(spec.color || '#F2557A') }, uCore: { value: new T.Color('#FFC23A') }, uNear: { value: 1 } };
        const mat = own(new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false, vertexShader: BEAM_VS, fragmentShader: BEAM_FS }));
        m.beam = new T.Mesh(beamGeo, mat); m.beam.renderOrder = 5; m.beam.frustumCulled = false; g.add(m.beam); m.U = U;
        const rm = own(new T.MeshBasicMaterial({ color: '#FFD45E', transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
        m.ring = new T.Mesh(ringGeo, rm); m.ring.position.y = 0.035; m.ring.renderOrder = 4; g.add(m.ring);
        const ic = spec.icon === '⭐' ? 'star' : spec.icon === '❤' || spec.icon === '❤️' ? 'heart' : 'case';
        m.icon = new T.Sprite(own(new T.SpriteMaterial({ map: iconTex(ic), depthTest: false, depthWrite: false, fog: false, sizeAttenuation: false })));
        m.icon.scale.set(0.085, 0.085, 1); m.icon.position.y = 4.6; m.icon.renderOrder = 10; g.add(m.icon); m.iconY = 4.6;
      } else if (style === 'soon') {
        m.icon = new T.Sprite(own(new T.SpriteMaterial({ map: own(soonTex(spec.sub)), depthTest: true, fog: false })));
        m.icon.scale.set(1.05, 0.46, 1); m.icon.position.y = 2.95; m.icon.renderOrder = 9; g.add(m.icon); m.iconY = 2.95;
      } else {
        const tx = iconTex(style === 'fresh' ? 'fresh' : style === 'done' ? 'done' : 'new');
        m.icon = new T.Sprite(own(new T.SpriteMaterial({ map: tx, depthTest: false, depthWrite: false, fog: false })));
        if (style === 'fresh') m.icon.scale.set(0.72, 0.27, 1); else if (style === 'done') m.icon.scale.setScalar(0.55); else m.icon.scale.setScalar(0.32);
        m.icon.position.y = 2.75; m.icon.renderOrder = 9; g.add(m.icon); m.iconY = 2.75;
      }
      return m;
    }
    function drop(m) { group.remove(m.g); m.own.forEach(x => { try { x.dispose(); } catch (e) { /* уже освобождено */ } }); m.own.length = 0; }

    // specs: MarkerSpec[]; doors: реестр (get(id))
    function set(specs, doors) {
      const want = new Map();
      (specs || []).forEach(sp => { if (!sp || !sp.door) return; const d = doors.get(sp.door); if (!d) return; want.set(sp.id || sp.door + ':' + (sp.style || 'case'), { sp, d }); });
      live.forEach((m, id) => { const w = want.get(id); if (!w || w.d !== m.door || (w.sp.style || 'case') !== (m.spec.style || 'case')) { drop(m); live.delete(id); } else m.spec = w.sp; });
      want.forEach((w, id) => { if (!live.has(id)) live.set(id, make(w.sp, w.d)); });
    }
    const _v = new T.Vector3();
    function update(camera, dt) {
      const t = (performance.now() - t0) / 1000;
      live.forEach((m, id) => {
        const g = m.g, d = Math.hypot(camera.position.x - g.position.x, camera.position.z - g.position.z);
        if (m.beam) {
          m.U.uT.value = t; m.U.uNear.value = Math.min(1, Math.max(0.25, (d - 4) / 10));
          const wk = Math.max(1, d / 16); m.beam.scale.set(wk, 1, wk);
          const k = (t * 0.8) % 1; m.ring.scale.setScalar(1 + k * 0.6); m.ring.material.opacity = 0.85 * (1 - k);
        }
        if (m.icon) m.icon.position.y = m.iconY + Math.sin(t * 2 + g.position.x) * 0.1;
        if (m.spec.style === 'done' && performance.now() - m.born > 3000) { drop(m); live.delete(id); }
      });
    }
    // точка метки на экране (для ярлыка и стрелки у края): {x, y, on, behind}
    function screenOf(m, camera, w, h) {
      _v.set(m.g.position.x, (m.iconY || 2.6) + 0.4, m.g.position.z).project(camera);
      const behind = _v.z > 1;
      return { x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h, behind, on: !behind && _v.x > -0.95 && _v.x < 0.95 && _v.y > -0.92 && _v.y < 0.9 };
    }
    return {
      set, update, screenOf, group,
      list: () => [...live.values()].map(m => ({ id: m.spec.id || m.door.id, door: m.door.id, style: m.spec.style || 'case', label: m.spec.label || '', x: m.g.position.x, z: m.g.position.z })),
      main: () => { for (const m of live.values()) if ((m.spec.style || 'case') === 'case') return m; return null; },
      all: () => [...live.values()],
      clear: () => { live.forEach(m => drop(m)); live.clear(); },
    };
  };
})();
