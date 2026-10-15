/* =====================================================================
   3D-КОМНАТА: зал кинотеатра «Саспенс».
   Экран с «застрявшим» кадром, кулисы, три ряда бархатных кресел,
   будка киномеханика с лучом проектора, попкорн, афиши, дверь «ВЫХОД».

   FREE MODE: (R.o.mode === 'free', прогулка «Город нараспашку»)
   - Размер 10×7; дверь на улицу — левая стена, exit {x:-4.35, z:-2.7}; spawn {x:-3.4, z:-1.35}; bounds x −4.6…4.6, z −6.0…−0.4.
   - Точки базы: screen (−2.55, −5.6) «Разглядеть», booth (3.25, −0.75) «Поговорить», popcorn (−3.55, −0.62) «Попкорн»,
     posters (−4.3, −4.8) «Смотреть», clock (4.3, −2.95) «Смотреть». Объекты: spot:screen (меш экрана, userData.tap='screen'),
     spot:popcorn, spot:posters (две афиши на левой стене), spot:clock (часы на правой стене), exitDoor.
   - Жители: raccoon (в будке справа, y 1.66). Гусь Финалыч на прогулке СКРЫТ (он работает в «Стороне Б»).
   - Ряды кресел: z −4.7, −3.5, −2.3; блоки x −3.98…−0.78 и 0.78…3.98 (это blockers); центральный проход |x| < 0.54,
     боковые проходы у стен; сцена x −3.3…3.3, z −7…−6.1 (blocker); тележка попкорна x −4.7…−4.0, z −0.95…−0.3.
   - Экран: base.screen = { canvas (720×480), ctx, w, h, commit(), idle(), showFrame(playing), mark(x,y,r), ready(), rect };
     base.screenMesh — меш экрана (4.4×2.93, центр (0, 2.35, −6.95)); base.beamMat — материал луча проектора.
     В режиме прогулки сюжетный кадр не загружается: на экране заставка, рисуйте свой фильм в base.screen.ctx и вызывайте commit().
     Камеру на экран: api.fitScreen(base.screenMesh, { margin: 1.06, y: 2.6 }); тапы по экрану — api.intercept(h => h.name === 'screen' && h.uv …).
   ===================================================================== */
(function () {
  if (!window.City3D || !City3D.registerRoom) return;
  City3D.registerRoom('cinema', {
    look: { sky: '#EBD7E8', gnd: '#7A3A50', hi: 0.56, sun: '#FFDCC0', si: 0.52, off: [-3, 7.5, 6], bg: 'radial-gradient(130% 90% at 50% 30%, #5A2C44 0%, #2E1C2C 72%)', rim: ['#FFC9B0', 0.28], fog: '#2E1C2C' },
    cam: { portrait: { dx: 0, y: 4.5, dz: 7.9, ly: 1.35, lz: -2.7, fov: 58 }, landscape: { dx: 0.2, y: 4.2, dz: 7.4, ly: 1.4, lz: -2.5, fov: 48 } },
    build(R) {
      const { T, PI, group: g, put, box, sph, cyl, rbox, plane, toon, GEO } = R;
      const W = 10, D = 7, H = 4.2;
      const K = R.makeKit(true);
      const wine = toon('#7A3550'), wineD = toon('#5E2840'), gold = toon('#E8C770', { emissive: new T.Color('#B8903A'), emissiveIntensity: 0.12 }), carpet = toon('#6E2C44'),
        runner = toon('#B9475F'), seatM = toon('#C24A63'), seatD = toon('#9E2F47'), dark = toon('#3E2A38'), curtain = toon('#B9364F'), curtainD = toon('#93283E'),
        cream = toon('#FFF0CE'), white = toon('#FFFDF9'), corn = toon('#FFE9A8'), glass = toon('#FFF3DC', { emissive: new T.Color('#FFD9A0'), emissiveIntensity: 0.35 });
      const st = new T.Group(); g.add(st);   // всё статичное — потом склеим

      // пол, ковровая дорожка, стены
      rbox(st, carpet, 0, -0.05, -D / 2, W + 0.4, 0.1, D + 0.2, 0.03);
      put(st, GEO.plane, runner, [0, 0.006, -3.1], [1.1, 6.0, 1], [-PI / 2, 0, 0]).castShadow = false;
      [-0.56, 0.56].forEach(x => put(st, GEO.plane, gold, [x, 0.008, -3.1], [0.05, 6.0, 1], [-PI / 2, 0, 0]).castShadow = false);
      rbox(st, wine, 0, H / 2, -D - 0.1, W + 0.4, H, 0.2, 0.05);
      [-1, 1].forEach(sd => {
        rbox(st, wine, sd * (W / 2 + 0.1), H / 2, -D / 2, 0.2, H, D, 0.05);
        rbox(st, wineD, sd * (W / 2 - 0.02), 0.55, -D / 2, 0.08, 1.1, D, 0.03);               // панели внизу
        box(st, gold, sd * (W / 2 - 0.05), 1.12, -D / 2, 0.04, 0.05, D);                     // золотой поясок
        box(st, gold, sd * (W / 2 - 0.05), H - 0.08, -D / 2, 0.06, 0.1, D);
      });
      rbox(st, wineD, 0, 0.55, -D + 0.02, W, 1.1, 0.08, 0.03); box(st, gold, 0, 1.12, -D + 0.05, W, 0.05, 0.04);

      // сцена, экран в золотой раме, кулисы с ламбрекеном
      rbox(st, wineD, 0, 0.12, -6.55, 6.8, 0.24, 0.9, 0.06); box(st, gold, 0, 0.245, -6.1, 6.8, 0.03, 0.04);
      rbox(st, gold, 0, 2.35, -6.99, 4.64, 3.15, 0.06, 0.04);   // экран 3:2 — кадр 720×480 не растягивается
      const [scv, sc] = R.cnv(720, 480);
      const paintIdle = () => { const gr = sc.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, '#FFF6E6'); gr.addColorStop(1, '#F6DCC8'); sc.fillStyle = gr; sc.fillRect(0, 0, 720, 480); R.text(sc, 'кадр заело', 360, 240, 64, '#C9A2AE', { f: 'Caveat', w: 700 }); };
      paintIdle();
      const screenTex = R.tex(scv);
      const screen = put(g, GEO.plane, R.keep(new T.MeshBasicMaterial({ map: screenTex, fog: false })), [0, 2.35, -6.95], [4.4, 2.93, 1]);
      screen.castShadow = false; screen.receiveShadow = false; screen.userData.key = 'spot:screen'; screen.userData.tap = 'screen';
      // кадр из 2D-сцены — на экран (SVG → картинка → холст)
      const tag = (txt, col) => { sc.fillStyle = 'rgba(46,28,44,.72)'; R.rrect(sc, 18, 18, 230, 52, 14); sc.fill(); R.text(sc, txt, 133, 45, 30, col || '#FFF0CE', { w: 800 }); };
      let frameImg = null, playingNow = false;
      const marks = [];   // найденные места: кольца в координатах кадра 360×240
      const drawMarks = () => marks.forEach(([x, y, r]) => { sc.save(); sc.strokeStyle = '#C2405B'; sc.lineWidth = 7; sc.shadowColor = '#FFE3A8'; sc.shadowBlur = 14; sc.beginPath(); sc.ellipse(x * 2, y * 2, r * 2, r * 2 * 0.92, -0.08, 0, PI * 2); sc.stroke(); sc.restore(); });
      const showFrame = (playing) => { playingNow = !!playing; if (!frameImg) return; sc.drawImage(frameImg, 0, 0, 720, 480); drawMarks(); tag(playing ? '▶ кадр снова движется' : '❚❚ кадр заело', playing ? '#BFE6D3' : '#FFF0CE'); screenTex.needsUpdate = true; };
      try {
        const svg = window.Art && Art.cinemaFrame ? Art.cinemaFrame({ bow: (R.o.hero && R.o.hero.bow) || '#F08FA8' }) : null;
        // на прогулке экран занят фильмом недели — сюжетный кадр не рисуем поверх афиши
        if (svg && R.o.mode !== 'free') { const im = new Image(); im.onload = () => { frameImg = im; showFrame(false); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
      } catch (e) { /* остаётся заставка */ }
      [-1, 1].forEach(sd => {
        for (let i = 0; i < 6; i++) { const x = sd * (2.75 + i * 0.17), wv = Math.sin(i * 1.7) * 0.04; cyl(st, i % 2 ? curtainD : curtain, x, 2.0, -6.82 + wv, 0.11, 3.9); }
        sph(st, gold, sd * 2.62, 1.6, -6.72, 0.07);   // подхват
      });
      rbox(st, curtain, 0, 3.98, -6.8, 6.4, 0.36, 0.22, 0.06);
      R.lace(st, curtainD, -3.1, 3.1, 3.8, -6.68, 0.12, gold);

      // кресла: три ряда, два блока, проход посередине и вдоль стен
      const ROWS = [-4.7, -3.5, -2.3], SX = [];
      for (let i = 0; i < 5; i++) { SX.push(-3.7 + i * 0.66); SX.push(1.06 + i * 0.66); }
      const seat = (x, z) => {
        rbox(st, seatM, x, 0.42, z, 0.56, 0.14, 0.5, 0.06);
        rbox(st, seatM, x, 0.78, z + 0.24, 0.56, 0.62, 0.13, 0.06);
        box(st, dark, x, 0.2, z + 0.05, 0.4, 0.32, 0.36);
        [-1, 1].forEach(s2 => rbox(st, seatD, x + s2 * 0.3, 0.6, z + 0.05, 0.06, 0.08, 0.5, 0.025));
      };
      ROWS.forEach(z => SX.forEach(x => seat(x, z)));
      [-1, 1].forEach(sd => ROWS.forEach(z => { cyl(st, gold, sd * 0.62, 0.42, z + 0.05, 0.03, 0.84); sph(st, gold, sd * 0.62, 0.88, z + 0.05, 0.05); }));

      // будка киномеханика на правой стене, проектор и луч
      const bx = 4.32, bz = -1.55;
      rbox(st, wineD, bx, 1.6, bz, 1.4, 0.12, 1.5, 0.04);
      rbox(st, wine, 3.67, 1.95, bz, 0.1, 0.6, 1.5, 0.03); rbox(st, wine, bx, 1.86, -0.84, 1.4, 0.42, 0.1, 0.03);
      box(st, gold, 3.67, 2.27, bz, 0.13, 0.05, 1.52); box(st, gold, bx, 2.09, -0.82, 1.42, 0.05, 0.13);
      rbox(st, wineD, bx, 3.3, bz, 1.5, 0.12, 1.6, 0.04);
      [[3.7, -0.9], [3.7, -2.25]].forEach(([x, z]) => cyl(st, gold, x, 0.8, z, 0.04, 1.6));
      [-0.92, -2.2].forEach(z => cyl(st, gold, 3.7, 2.62, z, 0.03, 1.36));
      rbox(st, dark, 4.55, 1.86, -2.0, 0.5, 0.42, 0.34, 0.05);
      [[4.43, -2.0], [4.68, -2.0]].forEach(([x, z]) => cyl(st, dark, x, 2.22, z, 0.13, 0.04, [PI / 2, 0, 0]));
      cyl(st, gold, 4.28, 1.9, -2.0, 0.07, 0.12, [0, 0, PI / 2]);
      let beamMesh = null;
      { const a = new T.Vector3(4.2, 1.9, -2.05), b = new T.Vector3(0, 2.35, -6.9), dir = b.clone().sub(a), L = dir.length();
        const beam = beamMesh = new T.Mesh(R.keep(new T.CylinderGeometry(0.06, 1.25, L, 20, 1, true)), R.keep(new T.MeshBasicMaterial({ color: 0xFFF0C8, transparent: true, opacity: 0.1, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false })));
        beam.position.copy(a).add(b).multiplyScalar(0.5); beam.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir.normalize()); beam.renderOrder = 3; g.add(beam); }
      const raccoon = R.npc.raccoon(); raccoon.root.position.set(4.3, 1.66, -1.45); raccoon.root.rotation.y = -0.55; g.add(raccoon.root);

      // гусь Финалыч: встал из третьего ряда, с попкорном, смотрит в зал (на прогулке он работает в «Стороне Б»)
      const goose = R.npc.goose(); goose.root.position.set(2.4, 0, -1.55); goose.root.rotation.y = -0.25; g.add(goose.root);
      if (R.o.mode === 'free') goose.root.visible = false;

      // попкорн у входа
      { const px = -4.3, pz = -0.62, pg = new T.Group(); pg.position.set(px, 0, pz); pg.rotation.y = 0.7; pg.scale.setScalar(0.78); pg.userData.key = 'spot:popcorn'; g.add(pg);
        rbox(pg, seatD, 0, 0.36, 0, 0.62, 0.72, 0.48, 0.05); box(pg, gold, 0, 0.74, 0, 0.66, 0.04, 0.52);
        rbox(pg, glass, 0, 1.06, 0, 0.56, 0.58, 0.42, 0.03);
        for (let i = 0; i < 18; i++) R.sphS(pg, corn, -0.2 + (i % 6) * 0.08, 0.84 + Math.floor(i / 6) * 0.07, -0.1 + ((i * 7) % 5) * 0.05, 0.045);
        rbox(pg, seatM, 0, 1.4, 0, 0.66, 0.1, 0.52, 0.04); put(pg, GEO.cone, seatM, [0, 1.56, 0], [0.3, 0.24, 0.24]); sph(pg, gold, 0, 1.72, 0, 0.05);
        const [pcv, pc] = R.cnv(384, 96); pc.fillStyle = '#FFF0CE'; R.rrect(pc, 0, 0, 384, 96, 22); pc.fill(); R.text(pc, 'ПОПКОРН', 192, 50, 56, '#9E2F47');
        plane(pg, toon('#FFFFFF', { map: R.tex(pcv) }), 0, 0.5, 0.245, 0.5, 0.125);
        [-0.22, 0.22].forEach(x => cyl(pg, dark, x, 0.04, 0.18, 0.05, 0.05, [0, 0, PI / 2])); }

      // дверь на улицу и табличка «ВЫХОД»
      const dz = -2.7, dg = new T.Group(); dg.position.set(-W / 2 + 0.01, 0, dz); dg.rotation.y = PI / 2; dg.userData.key = 'exitDoor'; g.add(dg);
      put(dg, R.extrude(R.archShape(1.18, 2.22), 0.06), gold, [0, 0, 0.02]);
      put(dg, R.extrude(R.archShape(1.0, 2.1), 0.05), seatD, [0, 0, 0.06]);
      cyl(dg, glass, 0, 1.55, 0.12, 0.13, 0.03, [PI / 2, 0, 0]); sph(dg, gold, 0.36, 1.0, 0.13, 0.04);
      const [ecv, ec] = R.cnv(320, 96); ec.fillStyle = '#2E1C2C'; R.rrect(ec, 0, 0, 320, 96, 18); ec.fill(); R.text(ec, 'ВЫХОД', 160, 50, 58, '#BFF0CE');
      plane(dg, R.keep(new T.MeshBasicMaterial({ map: R.tex(ecv), fog: false })), 0, 2.55, 0.08, 0.7, 0.21);
      R.halo(g, -W / 2 + 0.25, 2.55, dz, 0.7, '#BFF0CE', 0.35);

      // афиши на левой стене, бра с тёплыми ореолами, часы
      [[-4.15, R.signs.poster1], [-5.35, R.signs.poster2]].forEach(([z, cv], i) => {
        const fg = new T.Group(); fg.position.set(-W / 2 + 0.02, 0, z); fg.rotation.y = PI / 2; fg.userData.key = 'spot:posters'; g.add(fg);
        rbox(fg, gold, 0, 2.05, 0.02, 0.86, 1.2, 0.05, 0.03); plane(fg, toon('#FFFFFF', { map: R.tex(cv) }), 0, 2.05, 0.05, 0.74, 1.06);
      });
      [[-1, -1.0], [-1, -6.2], [1, -3.6], [1, -5.4]].forEach(([sd, z]) => {
        const sg = new T.Group(); sg.position.set(sd * (W / 2 - 0.02), 0, z); sg.rotation.y = -sd * PI / 2; g.add(sg); R.sconce(sg, K, 0, 2.75);
        R.halo(g, sd * (W / 2 - 0.3), 2.72, z, 1.0, '#FFC890', 0.55);
      });
      { const cg = new T.Group(); cg.position.set(W / 2 - 0.02, 3.05, -2.3); cg.rotation.y = -PI / 2; cg.userData.key = 'spot:clock'; g.add(cg);
        cyl(cg, gold, 0, 0, 0.02, 0.28, 0.05, [PI / 2, 0, 0]); cyl(cg, cream, 0, 0, 0.05, 0.24, 0.02, [PI / 2, 0, 0]);
        box(cg, dark, 0, 0.08, 0.07, 0.025, 0.17, 0.01); box(cg, dark, 0.06, 0, 0.072, 0.13, 0.022, 0.01, [0, 0, 0.3]); }

      R.bake(st, null, {});
      st.traverse(m => { if (m.isMesh) m.raycast = () => {}; });   // мебель не перехватывает тапы

      const blockers = [{ x0: -3.3, x1: 3.3, z0: -7, z1: -6.1 }, { x0: -4.7, x1: -4.0, z0: -0.95, z1: -0.3 }];
      ROWS.forEach(z => { blockers.push({ x0: -3.98, x1: -0.78, z0: z - 0.3, z1: z + 0.34 }); blockers.push({ x0: 0.78, x1: 3.98, z0: z - 0.3, z1: z + 0.34 }); });
      return {
        W, D,
        bounds: { x0: -4.6, x1: 4.6, z0: -6.0, z1: -0.4 },
        exit: { x: -4.35, z: dz }, exitDir: [-0.9, 0],
        spawn: { x: -2.6, z: -1.3 },   // подальше от двери и от точки попкорна
        cam: { x0: -2.6, x1: 2.6, z: -1.2 },
        blockers,
        spots: [
          { id: 'screen', x: -2.55, z: -5.6, act: 'Разглядеть', bubble: 'кадр заело' },
          { id: 'booth', x: 3.25, z: -0.75, act: 'Поговорить', bubble: 'киномеханик' },
          { id: 'popcorn', x: -3.55, z: -0.62, act: 'Попкорн', bubble: 'попкорн' },
          { id: 'posters', x: -4.3, z: -4.8, act: 'Смотреть', bubble: 'афиши' },
          { id: 'clock', x: 4.3, z: -2.95, act: 'Смотреть', bubble: 'часы' },
        ],
        npcs: R.o.mode === 'free' ? { raccoon } : { raccoon, goose },
        screenMesh: screen, beamMat: beamMesh ? beamMesh.material : null,
        screen: {
          canvas: scv, ctx: sc, w: 720, h: 480,
          commit: () => { screenTex.needsUpdate = true; },
          idle: () => { paintIdle(); screenTex.needsUpdate = true; },
          showFrame,
          mark: (x, y, r) => { marks.push([x, y, r]); showFrame(playingNow); },
          ready: () => !!frameImg,
          rect: { u0: 0, v0: 0, u1: 1, v1: 1 },   // картинка заполняет экран целиком (пропорции совпадают)
        },
        tick(t) { goose.root.visible && goose.popcorn && (goose.popcorn.rotation.z = Math.sin(t * 2) * 0.05); },
      };
    },
  });
})();
