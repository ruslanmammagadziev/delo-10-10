/* =====================================================================
   Место прогулки: sweets — Кондитерская «Сахарная пудра» (§7.3).
   Комната — сюжетная (js/rooms/sweets.js, L); здесь расширение для
   прогулки: ещё два круглых столика (T1 — столик базы у окна, T2, T3),
   тарелочки с десертом (скрыты), какао на подставке на витрине и пар над
   ним, мешочек какао-бобов, гусёнок, который ходит за Пудрой (и за ней).
   Точки базы: showcase, menu, table, cake; свои: counter, poodle, cocoa.
   Мини «Заказ»: какао с пенкой / горячий шоколад / десерт недели. Чая нет.
   ===================================================================== */
(function () {
  if (!window.Town) return;
  const P = 'sweets';
  // десерт недели (§9)
  const DESSERT = ['Эклер „Улика“', 'Тыквенный чизкейк', 'Улитка с корицей „Младшая“ — не та, та на пенсии', 'Печенье с корицей „Алиби“', 'Безе „Облако“ — лёгкое, как алиби', 'Пломбир „В мороз — для смелых“', 'Медовик: мёд от Жу, коржи от зайки'];
  const dessertOf = w => DESSERT[Math.max(0, Math.min(6, w))];
  const DRINK = { c: { label: 'Какао с пенкой', liquid: '#8B5A3C', foam: true }, h: { label: 'Горячий шоколад', liquid: '#5A3A2E', foam: false } };
  // столики: T1 — базовый у окна; места для сидения и точки подхода
  const TABLES = [
    { x: -2.2, z: -2.45, seat: { x: -1.7, z: -3.07, ry: -0.4, from: [-1.1, -3.15] }, plate: [-2.25, 0.775, -2.4] },
    { x: 0.4, z: -1.5, seat: { x: -0.2, z: -1.5, ry: Math.PI / 2, from: [-0.2, -0.75] }, plate: [0.42, 0.775, -1.5] },
    { x: 2.9, z: -2.35, seat: { x: 2.3, z: -2.35, ry: Math.PI / 2, from: [2.0, -1.6] }, plate: [2.92, 0.775, -2.35] },
  ];
  const CUP = [-0.45, 0.985, -4.06];
  const GOS0 = { x: 2.75, z: -0.62 };
  const LOOP = [[3.1, -0.48], [3.6, -0.55], [3.98, -0.95], [3.95, -1.25], [3.6, -1.82], [3.0, -1.86], [2.55, -1.4], [GOS0.x, GOS0.z]];

  /* ---------- Расширение сюжетной комнаты (только в режиме прогулки) ---------- */
  if (window.City3D && City3D.extendRoom) City3D.extendRoom(P, {
    build(R, base) {
      const { T, PI, put, box, cyl, GEO } = R;
      const g = R.group;
      const tn = (c, x) => R.toon(c, x);
      const hidM = R.keep(new T.MeshBasicMaterial({ visible: false }));
      const hit = (key, x, y, z, w, h, d, ry = 0) => { const m = put(g, GEO.box, hidM, [x, y, z], [w, h, d], [0, ry, 0]); m.castShadow = m.receiveShadow = false; m.userData.key = key; return m; };
      // одноцветная статика → одна сетка с цветами вершин
      const vcM = tn('#FFFFFF', { vertexColors: true });
      const vcBake = (group, cast) => {
        group.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(group.matrixWorld).invert(), parts = [], gone = [];
        let n = 0;
        group.traverse(m => {
          if (!m.isMesh || m.userData.dyn) return;
          for (let q = m.parent; q && q !== group; q = q.parent) if (q.userData.dyn) return;
          const mt = m.material;
          if (!mt || !mt.isMeshToonMaterial || mt.map || mt.transparent || mt.vertexColors || mt.alphaTest || mt.side !== T.FrontSide || (mt.emissiveIntensity > 0 && mt.emissive && mt.emissive.getHex())) return;
          const ge = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          ge.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
          parts.push([ge, mt.color]); n += ge.attributes.position.count; gone.push(m);
        });
        gone.forEach(m => m.parent.remove(m));
        if (n) {
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
          let off = 0;
          parts.forEach(([ge, c]) => { const k = ge.attributes.position.count; pos.set(ge.attributes.position.array, off * 3); nor.set(ge.attributes.normal.array, off * 3); for (let i = 0; i < k; i++) { col[(off + i) * 3] = c.r; col[(off + i) * 3 + 1] = c.g; col[(off + i) * 3 + 2] = c.b; } off += k; ge.dispose(); });
          const mg = R.keep(new T.BufferGeometry()); mg.setAttribute('position', new T.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T.BufferAttribute(nor, 3)); mg.setAttribute('color', new T.BufferAttribute(col, 3)); mg.computeBoundingSphere();
          const mesh = new T.Mesh(mg, vcM); mesh.castShadow = !!cast; mesh.receiveShadow = true; mesh.userData.dyn = true; group.add(mesh);
        }
        R.bake(group, null, { cast: !!cast });
        group.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
      };
      const pm = R.pm, gold = pm('#E8C770'), cream = pm('#FFFDF9'), stripe = pm('#F08FA8'), pink = pm('#F6C6D0'), cherry = pm('#C2405B');
      const st = new T.Group(); g.add(st);

      // столики T2 и T3: круглая столешница, ножка, два стула-сердечка по бокам
      const chair = (x, z, ry) => {
        const c = new T.Group(); c.position.set(x, 0, z); c.rotation.y = ry; st.add(c);
        [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].forEach(([a, b]) => put(c, GEO.cylLo, gold, [a, 0.22, b], [0.014, 0.44, 0.014]));
        cyl(c, gold, 0, 0.445, 0, 0.2, 0.02);
        put(c, GEO.sphLo, stripe, [0, 0.47, 0], [0.2, 0.045, 0.2]);
        [-0.11, 0.11].forEach(a => put(c, GEO.cylLo, gold, [a, 0.64, -0.16], [0.012, 0.38, 0.012]));
        put(c, R.heartG, gold, [0, 0.88, -0.2], [0.42, 0.42, 0.12]);
        put(c, R.heartG, pink, [0, 0.885, -0.19], [0.35, 0.35, 0.2]);
      };
      TABLES.slice(1).forEach((t, i) => {
        cyl(st, gold, t.x, 0.015, t.z, 0.2, 0.03); cyl(st, gold, t.x, 0.38, t.z, 0.032, 0.72);
        cyl(st, cream, t.x, 0.75, t.z, 0.36, 0.045); put(st, R.ringG(0.36, 0.02), cherry, [t.x, 0.75, t.z], null, [PI / 2, 0, 0]);
        // вазочка с цветком
        put(st, GEO.cylLo, pm(i ? '#C9B6F0' : '#BFE6D3'), [t.x + 0.16, 0.81, t.z - 0.12], [0.03, 0.07, 0.03]);
        put(st, GEO.sphLo, pm(i ? '#F08FA8' : '#FFE08A'), [t.x + 0.16, 0.9, t.z - 0.12], [0.035, 0.03, 0.035]);
        chair(t.x - 0.6, t.z, PI / 2); chair(t.x + 0.6, t.z, -PI / 2);
      });
      // мешочек какао-бобов у правой стены
      const SK = { x: 3.95, z: -3.38 };
      { const sack = R.keep(new T.LatheGeometry([[0.001, 0], [0.2, 0.01], [0.25, 0.12], [0.24, 0.32], [0.17, 0.44], [0.1, 0.5], [0.13, 0.58], [0.001, 0.6]].map(([a, b]) => new T.Vector2(a, b)), 16));
        put(st, sack, pm('#C9A27A'), [SK.x, 0, SK.z], [1, 1, 0.9]);
        put(st, R.ringG(0.105, 0.018), pm('#8E6248'), [SK.x, 0.5, SK.z], null, [PI / 2, 0, 0]);
        put(st, GEO.cylLo, pm('#E6CBA6'), [SK.x - 0.18, 0.26, SK.z + 0.12], [0.1, 0.1, 0.004], [PI / 2, 0, 0.9]);
        const bean = pm('#7A4A33');
        [[-0.3, 0.03, 0.15], [-0.36, 0.03, 0.05], [-0.26, 0.03, 0.26], [-0.42, 0.03, 0.18], [-0.05, 0.6, 0.0], [0.04, 0.59, 0.05]].forEach(([dx, y, dz], i) => put(st, GEO.sphLo, bean, [SK.x + dx, y, SK.z + dz], [0.03, 0.022, 0.02], [0, i, 0])); }
      vcBake(st, true);

      // тарелочки с десертом — по одной на столик (скрыты)
      const plates = TABLES.map(t => {
        const q = new T.Group(); q.position.set(t.plate[0], t.plate[1], t.plate[2]); g.add(q);
        cyl(q, cream, 0, 0.005, 0, 0.11, 0.01); put(q, R.ringG(0.105, 0.006), stripe, [0, 0.012, 0], null, [PI / 2, 0, 0]);
        cyl(q, pm('#E7B47C'), 0, 0.035, 0, 0.055, 0.05); cyl(q, pm('#FFF4E4'), 0, 0.066, 0, 0.057, 0.014); put(q, GEO.sphLo, cherry, [0.01, 0.085, 0], [0.018, 0.018, 0.018]);
        put(q, GEO.cylLo, pm('#E8C770'), [0.07, 0.02, 0.05], [0.006, 0.005, 0.06], [0, 0.6, PI / 2]);
        vcBake(q, false); q.visible = false; return q;
      });
      // какао на подставке на витрине и пар над ним (скрыты, пока не заказали)
      const cupG = new T.Group(); cupG.position.set(...CUP); g.add(cupG);
      cyl(cupG, cream, 0, 0.006, 0, 0.09, 0.012);
      put(cupG, R.keep(new T.CylinderGeometry(0.055, 0.042, 0.09, 14)), pink, [0, 0.058, 0]);
      cyl(cupG, pm('#8B5A3C'), 0, 0.101, 0, 0.05, 0.006);
      put(cupG, R.ringG(0.03, 0.008), pink, [0.065, 0.06, 0], null, [0, 0, 0]);
      vcBake(cupG, false); cupG.visible = false;
      const [scv, sctx] = R.cnv(64, 64); { const gr = sctx.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sctx.fillStyle = gr; sctx.fillRect(0, 0, 64, 64); }
      const steamTex = R.tex(scv);
      const steam = [0, 1].map(i => { const s = new T.Sprite(R.keep(new T.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.5, fog: false }))); s.renderOrder = 4; s.visible = false; g.add(s); return { s, ph: i / 2 }; });

      // гусёнок: ходит кругом за Пудрой, по тапу — за героиней
      const gos = (R.npc.gosling || R.npc.bunny)();
      gos.root.position.set(GOS0.x, 0, GOS0.z); gos.root.rotation.y = 0.4; g.add(gos.root);
      gos.root.traverse(m => { if (m.isMesh) m.castShadow = false; });
      let gMode = 'rest', gT = 0, gSeg = 0, gFollow = 0;

      // ловушки тапа
      hit('spot:counter', CUP[0], 1.12, CUP[2], 0.5, 0.3, 0.4);
      hit('spot:counter', -1.85, 1.25, -6.15, 0.75, 0.7, 0.55);
      TABLES.slice(1).forEach(t => hit('spot:table', t.x, 0.5, t.z, 1.6, 1.0, 0.8));
      hit('spot:poodle', 3.2, 0.32, -1.2, 0.86, 0.64, 0.86);
      hit('spot:cocoa', SK.x - 0.1, 0.32, SK.z, 0.7, 0.66, 0.6);

      const blockers = [];
      TABLES.slice(1).forEach(t => { blockers.push({ x0: t.x - 0.36, x1: t.x + 0.36, z0: t.z - 0.36, z1: t.z + 0.36 }); [-1, 1].forEach(s => blockers.push({ x0: t.x + s * 0.6 - 0.21, x1: t.x + s * 0.6 + 0.21, z0: t.z - 0.21, z1: t.z + 0.21 })); });
      blockers.push({ x0: SK.x - 0.27, x1: SK.x + 0.27, z0: SK.z - 0.24, z1: SK.z + 0.24 });

      const move = (to, sp, dt) => {
        const p = gos.root.position, dx = to[0] - p.x, dz = to[1] - p.z, d = Math.hypot(dx, dz), s = sp * dt;
        if (d > 0.01) gos.root.rotation.y = Math.atan2(dx, dz);
        if (d <= s) { p.x = to[0]; p.z = to[1]; return true; }
        p.x += dx / d * s; p.z += dz / d * s; return false;
      };
      // кот на стуле напротив T1 — сидит на сиденье
      const CS = { x: -2.7, z: -3.07 };
      let catY = 0;
      return {
        spawn: { x: -2.6, z: -0.9 },
        catSpot: { x: CS.x, z: CS.z, ry: 0.4 },
        blockers,
        spots: [
          { id: 'counter', x: -0.7, z: -3.45, act: 'Заказать', bubble: 'меню дня' },
          { id: 'poodle', x: 2.3, z: -0.85, act: 'Погладить', bubble: 'Пудра' },
          { id: 'cocoa', x: 3.35, z: -3.05, act: 'Понюхать', bubble: 'мешочек какао' },
        ],
        npcs: { gosling: gos },
        i3s: {
          plates,
          showCup(on) { cupG.visible = !!on; steam.forEach(q => { q.s.visible = !!on; }); },
          follow(sec) { gFollow = sec; gMode = 'follow'; },
        },
        tick(t, dt, ctx) {
          // пар над какао
          steam.forEach((q, i) => { if (!q.s.visible) return; const k = (t * 0.6 + q.ph) % 1; q.s.position.set(CUP[0] + (i ? 0.03 : -0.03) + Math.sin(t * 1.5 + i * 3) * 0.02, CUP[1] + 0.14 + k * 0.35, CUP[2]); q.s.scale.setScalar(0.06 + k * 0.14); q.s.material.opacity = 0.55 * Math.min(1, k * 5) * (1 - k); });
          // гусёнок
          gT += dt;
          if (gMode === 'rest') { gos.bob = false; gos.noLook = false; if (gT > 12) { gMode = 'loop'; gSeg = 0; gT = 0; } }
          else if (gMode === 'loop') { gos.bob = true; gos.noLook = true; if (move(LOOP[gSeg], 0.55, dt) && ++gSeg >= LOOP.length) { gMode = 'rest'; gT = 0; gos.root.rotation.y = 0.4; } }
          else if (gMode === 'follow') {
            gFollow -= dt; gos.noLook = true;
            if (ctx) { const hx = ctx.px, hz = ctx.pz, p = gos.root.position, d = Math.hypot(hx - p.x, hz - p.z); if (d > 0.55) { gos.bob = true; const k = (d - 0.5) / d; move([p.x + (hx - p.x) * k, p.z + (hz - p.z) * k], 1.3, dt); } else { gos.bob = false; gos.root.rotation.y = Math.atan2(hx - p.x, hz - p.z); } }
            if (gFollow <= 0) gMode = 'back';
          } else if (gMode === 'back') { gos.bob = true; if (move([GOS0.x, GOS0.z], 0.9, dt)) { gMode = 'rest'; gT = 0; gos.root.rotation.y = 0.4; } }
          // кот на стуле
          if (ctx && ctx.cat && ctx.cat.root.visible) { const cp = ctx.cat.root.position, on = Math.hypot(cp.x - CS.x, cp.z - CS.z) < 0.1; catY += ((on ? 0.46 : 0) - catY) * Math.min(1, dt * (on ? 5 : 9)); cp.y = catY; }
        },
      };
    },
  });

  /* ---------- Помощники ---------- */
  const room = ctx => (ctx.is3d && ctx.api && ctx.api.room && ctx.api.room.i3s ? ctx.api.room : null);
  const pop = m => { let n = 0; m = m >>> 0; while (m) { n += m & 1; m >>>= 1; } return n; };
  const hopNpc = (ctx, id) => { try { const n = ctx.is3d && ctx.api.npcs && ctx.api.npcs[id]; if (n && n.hop) n.hop(); } catch (e) { /* ignore */ } };
  // тарелочки с десертом — на этот визит (уходя, столики убирают)
  const VS = new WeakMap();
  const vs = ctx => { let v = VS.get(ctx); if (!v) { v = { plates: [false, false, false] }; VS.set(ctx, v); } return v; };
  function showPlate(ctx, i) {
    vs(ctx).plates[i] = true;
    const R3 = room(ctx); if (R3 && R3.i3s.plates[i]) R3.i3s.plates[i].visible = true;
  }
  async function asSpot(ctx, id) {
    const sp = ctx.place.spots[id]; if (!sp) return false;
    ctx.used(id);
    let h = false; if (sp.onUse) h = await sp.onUse(ctx, sp);
    if (!h) await ctx.line(id);
    if (pop(ctx.town.u[Town.REG.places.indexOf(P)] || 0) >= 3) await ctx.giveStamp();
    return true;
  }

  /* ---------- Мини «Заказ» ---------- */
  async function order(ctx) {
    hopNpc(ctx, 'bunny');
    const last = ctx.flag('o');
    const opts = [{ label: DRINK.c.label, value: 'c' }, { label: DRINK.h.label, value: 'h' }];
    if (last === 'c' || last === 'h') opts.push({ label: 'Как в прошлый раз', value: 'last' });
    opts.push({ label: 'Десерт недели', value: 'dessert', cls: 'soft' });
    const v = await ctx.choose('Что будете?', opts, { who: 'bunny' });
    if (!v) { ctx.mark('mini-end'); return true; }
    if (v === 'dessert') {
      let i = vs(ctx).plates.findIndex(x => !x); if (i < 0) i = 0;
      showPlate(ctx, i); hopNpc(ctx, 'bunny'); ctx.sparkle('heart');
      await ctx.say({ who: 'bunny', text: `${dessertOf(ctx.week)}. Приятного расследования.` });
      ctx.mark('mini-end');
      return true;
    }
    const k = v === 'last' ? last : v, d = DRINK[k];
    if (v === 'last') await ctx.say({ who: 'bunny', text: `Ваш „${d.label}“ — помню. Записала в книгу рецептов следователей.` });
    hopNpc(ctx, 'bunny'); ctx.sparkle('star'); ctx.haptic('medium');
    const R3 = room(ctx);
    // волна 4: в 3D зайка протягивает стаканчик через витрину, героиня берёт его настоящей рукой; без слоя рук — как было
    const hands = ctx.is3d && ctx.api.hands && ctx.api.hands();
    if (hands) await ctx.api.takeItem({ kind: 'cup', data: { liquid: d.liquid, foam: d.foam }, npc: 'bunny', color: '#FFFFFF', height: 0.55, meetY: 1.08, chestFwd: 0.5, walkTo: [0.75, -3.72], face: Math.atan2(-0.75, -1.58) });
    else if (R3) { R3.i3s.showCup(true); await ctx.wait(600); R3.i3s.showCup(false); }
    ctx.setHeld('cup', { liquid: d.liquid, foam: d.foam });   // сначала — в руке (и в прогулке), потом первый глоток
    if (hands) await ctx.api.nibble({ focus: true });
    if (ctx.flag('o') !== k) ctx.flag('o', k);
    await ctx.say({ who: 'bunny', text: 'Осторожно, горячее! Но ради этого и заказывали.' });
    ctx.mark('mini-end');
    return true;
  }

  /* ---------- Столик: присесть ---------- */
  async function sitTable(ctx) {
    const i = (ctx.n('table') - 1) % 3;   // T1 → T2 → T3 по кругу
    const withCup = ctx.held === 'cup';
    ctx.mark('sit');
    await ctx.sit(TABLES[i].seat);
    const mask = (ctx.flag('t') || 0) | (1 << i);
    if (mask !== ctx.flag('t')) ctx.flag('t', mask);
    await ctx.wait(ctx.is3d ? 1500 : 300);
    if (withCup && !ctx.has('s_syr')) {
      showPlate(ctx, i);
      await ctx.say({ who: 'bunny', text: 'К какао полагается сырник. Просто сырник — без хлеба, без истории, без подозрений.', s: 's_syr' });
    } else {
      await ctx.line('table');
    }
    if (vs(ctx).plates[i] && ctx.catHere) await ctx.say([{ who: 'cat', text: 'Я не крал. Я убедился, что всё свежее.' }, { f: 'catsw' }]);
    if (mask === 7 && !ctx.has('s_tab')) await ctx.say({ who: 'bunny', text: 'Ты перепробовала все столики. Я оцениваю такую обстоятельность.', s: 's_tab' });
    ctx.mark('mini-end');
    return true;
  }

  /* ---------- Место ---------- */
  Town.place({
    id: P, kind: 'story',
    name: 'Кондитерская «Сахарная пудра»', short: 'Кондитерская',
    sign: 'САХАРНАЯ ПУДРА', motto: 'какао · десерты · Пудра',
    icon: '🧁', color: '#FBE1E7',
    street: { x: 16.2, w: 3.8, doorDx: 1.05, bkey: null },
    room: P, opens: 0,
    host: { who: 'bunny', npc: 'bunny' },
    greet: {
      first: 'Без улик сегодня? Тогда только десерты.',
      again: Town.v('Вы снова тут! Столик у окна для вас всегда свободен.', '{name}! Какао уже греется — на всякий случай.', 'Снова к нам? Пудра виляет хвостом, гусёнок — как умеет.'),
      regular: Town.v(ctx => (ctx.flag('o') ? 'Вам как обычно?' : 'Для своих — самый тёплый столик.'), 'Ваш столик ждёт, ложечка уже блестит.', 'Для своих пенка всегда погуще.'),
      away: 'Неделю вас не было. Пудра каждый день проверяла дверь — говорит, гуляла.',
    },
    bark: 'Вернулась? Как раз достала новые сырники.',
    weekly: [1, 2, 3, 4, 5, 6].reduce((o, w) => { o[w] = 'Новый десерт недели! Этот пока не давал ложных показаний.'; return o; }, {}),
    fresh: [1, 2, 3, 4, 5, 6],
    react: {
      popcorn: 'Попкорн? После всего моего меню? Ладно, не обижусь. Сильно.',
      bouquet: 'Цветы на столике — это уже кондитерская мечты.',
      cup: 'Какао ещё с вами? Значит, рецепт удался.',
      look: 'Новый образ? Пудра сегодня тоже с бантиком — совпадение.',
    },
    spots: {
      counter: { icon: '☕', label: 'Заказать', onUse: ctx => order(ctx) },
      showcase: {
        icon: '🧁', label: 'Витрина',
        lines: [
          ctx => `Десерт недели: ${dessertOf(ctx.week)}.`,
          'Булочка с корицей, макарон и бабл-ти на пенсии. Дают интервью.',
          { f: 'vanil' },
          'Макарон: „Я по-прежнему не макароны. Спасибо, что не путаете“.',
        ],
        onUse: async ctx => {
          const R3 = room(ctx);
          if (R3 && R3.witnesses) { const ids = ['cinnabon', 'macaron', 'bubbletea'], n = R3.witnesses[ids[Math.floor(Math.random() * 3)]]; try { if (n && n.hop) n.hop(); } catch (e) { /* ignore */ } }
          return false;
        },
      },
      menu: {
        icon: '📋', label: 'Меню',
        lines: [{ f: 'white' }, { f: 'marsh' }, 'Сегодня всё то же, но с бантиком.'],
        onUse: async ctx => {
          hopNpc(ctx, 'bunny');
          await ctx.say({ who: 'bunny', text: 'Меню!' });
          await ctx.line('menu');
          return true;
        },
      },
      table: {
        icon: '🪑', label: 'Столик',
        lines: [
          'Просто сесть с какао и никуда не спешить. Великолепный план.',
          'По улице провезли тыкву. Она выглядит важнее всех в этом городе.',
          { text: 'Пирожок изучает меню. Меню вверх ногами.', if: c => c.catHere },
        ],
        onUse: ctx => sitTable(ctx),
      },
      poodle: {
        icon: '🐩', label: 'Пудра',
        lines: [
          'Пудра кружится. Гусёнок повторяет — и плюхается.',
          'Гусёнок вырос на целый сантиметр. Всё ещё уверен, что Пудра — мама.',
          'Пудра спит, гусёнок караулит. Иногда тоже спит.',
        ],
        // волна 4: в 3D героиня присаживается и гладит Пудру по-настоящему; Пудра и гусёнок радуются, когда ладонь легла
        onUse: async ctx => {
          const hop = () => { hopNpc(ctx, 'poodle'); hopNpc(ctx, 'gosling'); };
          if (ctx.is3d && ctx.api.petNpc && ctx.api.hands && ctx.api.hands()) { let done = false; await ctx.api.petNpc('poodle', { onPet: k => { if (k === 0) { done = true; hop(); } } }); if (!done) hop(); }
          else hop();
          return false;
        },
      },
      cocoa: {
        icon: '🫘', label: 'Мешочек какао-бобов',
        lines: [{ f: 'cocoa' }, 'Мешочек пахнет так, что Пирожок проверил его дважды.'],
      },
      cake: {
        icon: '🎂', label: 'Трёхъярусный торт',
        lines: [
          'Торт высотой с амбиции Зайки. И примерно такой же красивый.',
          'Вишенка на самом верху держится за веточку. Как следователь за версию.',
          { who: 'bunny', text: 'Этот торт — для красоты. Режем только по большим праздникам и маленьким радостям.' },
          { text: 'Пирожок смотрит на торт. Торт смотрит на Пирожка. Силы неравны.', if: c => c.catHere },
        ],
      },
    },
    npc: {
      poodle: ['Пудра приоткрыла один глаз, вздохнула и снова уснула. Гусёнок караулит.'],
      gosling: ['Гусёнок топает следом за следователем. Берёт пример.', 'Гусёнок проверил, на месте ли Пудра. На месте.'],
    },
    onNpc: async (ctx, id) => {
      if (id === 'bunny') return asSpot(ctx, 'counter');
      if (id === 'poodle') return asSpot(ctx, 'poodle');
      if (id === 'gosling') {
        const R3 = room(ctx); if (R3) R3.i3s.follow(8);
        hopNpc(ctx, 'gosling');
        if (!ctx.has('s_gos')) { await ctx.say({ text: 'Гусёнок перепроверил: мама — всё-таки Пудра. А ты — почти старшая сестра.', s: 's_gos' }); return true; }
        return false;
      }
      return false;
    },
    enter: async ctx => {
      const R3 = room(ctx);
      if (R3) R3.i3s.plates.forEach(p => { p.visible = false; });
    },
    facts: {
      vanil: { text: 'Эклер: „Ваниль — плод орхидеи. Так что я, можно сказать, в цветах“.' },
      white: { text: 'В белом шоколаде есть какао-масло, а тёртого какао нет совсем. Поэтому он белый.' },
      marsh: { text: 'Маршмеллоу назван по растению алтей: раньше сладость варили из его корня.' },
      catsw: { text: 'Кошки не чувствуют сладкого: ген этого вкуса у них не работает.' },
      cocoa: { text: 'У ацтеков и майя какао-бобы ходили вместо денег. Тут они ходят только в какао.' },
    },
    secrets: [
      { id: 's_syr', title: 'Просто сырник', trigger: 'sit at a table while holding a cup' },
      { id: 's_tab', title: 'Ревизия столиков', trigger: 'sat at all three tables (k.t = 7)' },
      { id: 's_gos', title: 'Почти сестра', trigger: 'tap the gosling' },
    ],
    stamp: { title: 'Кондитерская', icon: '🧁' },
  });
})();
