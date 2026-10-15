/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: собачка-компаньон (волна 3, LIFE; план v2 §4.3).
   На собачьей площадке гуляют три собачки — шпиц Зефирка, такса Багет, корги Пельмень. Когда она впервые подходит,
   все трое подбегают и садятся рядком, виляя хвостами. Кого она погладит — того и можно взять гулять («Гуляем вместе!»).
   Собачка идёт по следу героини справа (кот Пирожок — слева сзади, они не мешают друг другу), догоняет бегом, садится рядом,
   когда она стоит, нюхает вокруг, иногда забегает вперёд и оглядывается. У двери ждёт и радуется, когда она выходит.
   В машине сидит сзади (car.seatDog: интегратор передаёт w.dog.root в WORLD.Car.enter), на велосипеде бежит рядом
   (bike.dogPoint). Тап по собачке — меню: «Погладить», «Новое имя» (G.ask; имя видно только в облачках и заголовках,
   голосом не звучит), «Домой, на площадку» (вернуть можно когда угодно; варианта «забрать насовсем» нет).
   Сохранение: st.world.pet = { id, names: { id: 'имя' }, on, walks, met } — пишет только город (World.saveWorld).

   WORLD.makeCompanion(life, o) → cp (создаёт WORLD.makeLife сам, если файл подключён)
     cp.active()             — собачка гуляет с ней
     cp.n                    — агент собачки (x, z, root, I — зверёк), cp.root — корень собачки (для места в машине)
     cp.carRoot()            → root | null — только если гуляет
     cp.adopt(id|n, quiet)   — взять гулять; cp.release(quiet) — отпустить на площадку
     cp.menu()               — меню собачки (тап); cp.rename() — новое имя
     cp.nameOf(id)           — имя, которое дала она (или null)
     cp.state()              → { on, id, name, mode, x, z, dist }
     cp.update / session / afterPet / onWave — зовёт жизнь (residents.js)
   События окна: 'life:companion' { id, on }, 'life:walked' { id, sec } (для штампа «Выгуляла»).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI, TAU = PI * 2;
  WORLD.COMPANION_DOGS = { dog_spitz: 'Зефирка', dog_dachshund: 'Багет', dog_corgi: 'Пельмень' };
  // реплики компаньона ({ who, text } — для озвучки)
  WORLD.COMPANION_LINES = {
    adopt: [{ who: 'dog_spitz', text: 'Тяф-тяф!' }, { who: 'dog_dachshund', text: 'Гуляем! До конца улицы — сто такс!' }, { who: 'dog_corgi', text: 'Хрр… Гулять? Гулять! Я проснулся.' }],
    welcome: [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_dachshund', text: 'Ты вернулась! Я ждал ровно одну таксу времени.' }, { who: 'dog_corgi', text: 'О. Ты тут. Я посторожил дверь.' }],
    home: [{ who: 'dog_spitz', text: 'Тяф!' }, { who: 'dog_dachshund', text: 'Спасибо за прогулку! Побегу мерить площадку.' }, { who: 'dog_corgi', text: 'Хорошо погуляли. Пойду полежу об этом.' }],
  };
  const lineFor = (k, id) => (WORLD.COMPANION_LINES[k] || []).find(l => l.who === id) || null;

  WORLD.makeCompanion = function (life, o) {
    const T = window.THREE, G_ = () => window.G || null;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const toast = (t, ms) => { const g = G_(); if (g && g.toast && t) g.toast(t, ms || 2600); };
    const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* старый браузер */ } };
    const scene = o.scene;

    /* ---------- сохранение ---------- */
    function ps() {
      try {
        if (window.World && World.wState) { const ws = World.wState(); if (!ws.pet || typeof ws.pet !== 'object') ws.pet = { id: null, names: {}, on: false, walks: 0, met: 0 }; if (!ws.pet.names) ws.pet.names = {}; return ws.pet; }
        const g = G_(); if (g && g.state) { const st = g.state(); st.world = st.world || {}; if (!st.world.pet) st.world.pet = { id: null, names: {}, on: false, walks: 0, met: 0 }; if (!st.world.pet.names) st.world.pet.names = {}; return st.world.pet; }
      } catch (e) { /* без сохранения */ }
      return MEM;
    }
    const MEM = { id: null, names: {}, on: false, walks: 0, met: 0 };
    function save(patch) {
      const p = ps(); Object.assign(p, patch || {});
      try { if (window.World && World.saveWorld) World.saveWorld({ pet: p }); else { const g = G_(); if (g && g.save) g.save(); } } catch (e) { /* ignore */ }
    }
    const nameOf = id => { const nm = (ps().names || {})[id]; return nm ? String(nm) : null; };
    const shortName = id => nameOf(id) || WORLD.COMPANION_DOGS[id] || 'Собачка';
    const clean = s => String(s || '').replace(/[<>{}\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

    const cp = { n: null, mode: 'off', nameOf };
    // подпись облачка жителя (WORLD.RESIDENT_NAMES) — с её именем для собачки
    const KIND = { dog_spitz: 'Шпиц', dog_dachshund: 'Такса', dog_corgi: 'Корги' };
    Object.keys(WORLD.COMPANION_DOGS).forEach(id => { const def = (WORLD.RESIDENT_NAMES || {})[id]; try { Object.defineProperty(WORLD.RESIDENT_NAMES, id, { configurable: true, enumerable: true, get: () => (nameOf(id) ? KIND[id] + ' ' + nameOf(id) : def) }); } catch (e) { /* без подписи */ } });
    let crumbs = [], idleT = 0, walkT = 0, aheadCd = rnd(12, 20), modeT = 0, tx = 0, tz = 0, stuckT = 0, lx = 0, lz = 0, chk = 0, hidden = false, metSession = false, meetT = 0, adoptAt = 0;
    const dogs = () => Object.keys(WORLD.COMPANION_DOGS).map(id => life.WHO[id]).filter(Boolean);
    cp.active = () => !!(cp.n && cp.n.follow);
    Object.defineProperty(cp, 'root', { get: () => (cp.n ? cp.n.root : null) });
    cp.carRoot = () => (cp.active() && !hidden ? cp.n.root : null);
    cp.state = () => { const n = cp.n; return { on: cp.active(), id: n ? n.id : null, name: n ? shortName(n.id) : null, mode: cp.mode, x: n ? n.x : null, z: n ? n.z : null, dist: n && CTXs ? Math.hypot(n.x - CTXs.hx, n.z - CTXs.hz) : null }; };
    let CTXs = null;

    /* ---------- взять гулять / отпустить ---------- */
    cp.adopt = (who, quiet) => {
      const n = typeof who === 'string' ? life.WHO[who] : who;
      if (!n || !WORLD.COMPANION_DOGS[n.id]) return false;
      if (cp.active()) { if (cp.n === n) return true; cp.release(true); }
      n.follow = true; n.isCompanion = true; n.act = 'follow'; n.bench = null; n.perch = null; n.y = 0; n.faceHero = 0; n.noticeT = 0;
      if (n.slot && n.slot.occ === n) n.slot.occ = null; n.slot = null;
      const i = life.npcs.indexOf(n); if (i >= 0) life.npcs.splice(i, 1);
      cp.n = n; cp.mode = 'follow'; crumbs = []; idleT = 0; walkT = 0; adoptAt = performance.now();
      if (n.root.parent !== scene) scene.add(n.root);
      n.root.visible = true; n.I.st.sit = 0; n.I.st.lie = 0; n.I.st.sleep = 0;
      save({ id: n.id, on: true, met: 1 });
      if (!quiet) {
        n.I.st.happy = 1; n.I.hop(); setTimeout(() => n.I.hop(), 420); setTimeout(() => { n.I.st.happy = 0; }, 1500);
        toast(`${shortName(n.id)} идёт гулять с тобой! Тап по собачке — её меню.`, 3200);
        const l = lineFor('adopt', n.id); if (l) setTimeout(() => life.sayLine(n, l, 2600), 500);
      }
      emit('life:companion', { id: n.id, on: true });
      return true;
    };
    cp.release = quiet => {
      const n = cp.n; if (!n) return;
      const sec = Math.round((performance.now() - adoptAt) / 1000);
      if (n.root.parent !== scene) scene.attach(n.root);
      n.follow = false; n.isCompanion = false; n.act = 'stand'; n.actT = 1; n.y = 0;
      if (life.npcs.indexOf(n) < 0) life.npcs.push(n);
      cp.mode = 'leaving'; modeT = 0; cp.leaving = n; cp.n = null;
      save({ on: false, walks: (ps().walks || 0) + 1 });
      if (!quiet) {
        const l = lineFor('home', n.id); if (l) life.sayLine(n, l, 2600);
        toast(`${shortName(n.id)} — домой, на площадку. Хорошая была прогулка!`, 3000);
      }
      emit('life:companion', { id: n.id, on: false }); emit('life:walked', { id: n.id, sec });
      // убегает в сторону площадки; когда скроется (или через 5 с) — уже там
      const D = life.DP, dx = D.x - n.x, dz = D.z - n.z, d = Math.hypot(dx, dz) || 1;
      n.leaveT = 5; n.leaveTo = [n.x + dx / d * 6, n.z + dz / d * 6];
      life.setBlob(0, 0, 0, 0);
    };

    /* ---------- меню (тап по собачке) и новое имя ---------- */
    let menuOpen = false;
    cp.menu = async () => {
      const g = G_(), n = cp.n; if (!g || !g.choose || !n || menuOpen) return;
      menuOpen = true;
      try {
        const v = await g.choose('', [{ label: 'Погладить', value: 'pet' }, { label: 'Новое имя', value: 'name', cls: 'soft' }, { label: 'Домой, на площадку', value: 'home', cls: 'soft' }, { label: 'Гуляем дальше', value: 'stay', cls: 'soft' }], { who: n.id });
        if (v === 'pet') await life.pet(n);
        else if (v === 'name') await cp.rename();
        else if (v === 'home') cp.release();
      } finally { menuOpen = false; }
    };
    cp.rename = async () => {
      const g = G_(), n = cp.n; if (!g || !g.ask || !n) return false;
      const cur = shortName(n.id);
      const v = clean(await g.ask('Как будем звать?', { who: 'narrator', placeholder: cur, ok: 'Готово', skip: 'Оставить как есть', max: 14 }));
      if (!v || v === cur) return false;
      const names = Object.assign({}, ps().names || {}); names[n.id] = v; save({ names });
      n.I.st.happy = 1; n.I.hop(); setTimeout(() => { n.I.st.happy = 0; }, 1200);
      toast(`Теперь — «${v}». Хвост одобряет.`, 2600);
      return true;
    };
    // погладила собачку с площадки — предложить прогулку (если сейчас никто не гуляет)
    cp.afterPet = async n => {
      if (!n || !n.dogpark || n.follow || cp.active() || !CTXs || CTXs.mode !== 'walk' || cp.noOffer) return;
      const g = G_(); if (!g || !g.choose) { cp.adopt(n); return; }
      n.faceHero = 8;
      const v = await g.choose('Возьмёшь на прогулку?', [{ label: 'Гуляем вместе!', value: 1 }, { label: 'Просто погладить', value: 0, cls: 'soft' }], { who: 'narrator' });
      n.faceHero = 1;
      if (v === 1) cp.adopt(n);
    };
    cp.onWave = () => {
      const n = cp.n; if (!cp.active() || !CTXs) return;
      if (Math.hypot(n.x - CTXs.hx, n.z - CTXs.hz) < 7) { n.I.st.happy = 1; setTimeout(() => n.I.hop(), 250); setTimeout(() => { n.I.st.happy = 0; }, 1300); }
    };

    /* ---------- начало и конец отрезка прогулки ---------- */
    cp.session = (sctx, CTX) => {
      CTXs = CTX; metSession = false;
      if (!sctx) return;
      const p = ps();
      if (!cp.active() && p.on && p.id && life.WHO[p.id]) cp.adopt(p.id, true);
      if (cp.active()) { const n = cp.n, hx = sctx.hx !== undefined ? sctx.hx : CTX.hx, hz = sctx.hz !== undefined ? sctx.hz : CTX.hz; if (Math.hypot(n.x - hx, n.z - hz) > 6 || n.root.parent !== scene) placeNear(hx, hz, sctx.ha || 0); else welcome(); crumbs = []; }
    };

    /* ---------- помощники движения ---------- */
    function placeNear(hx, hz, ha) {
      const n = cp.n; if (!n) return;
      if (n.root.parent !== scene) scene.attach(n.root);
      n.root.rotation.set(0, n.root.rotation.y, 0);
      const fx = Math.sin(ha), fz = Math.cos(ha), rx = -Math.cos(ha), rz = Math.sin(ha);
      const cands = [[-1.3, 0.55], [-1.1, -0.6], [0.2, 1.0], [0.2, -1.0], [-1.8, 0], [1.0, 0.8]];
      for (const [b, r] of cands) { const x = hx + fx * b + rx * r, z = hz + fz * b + rz * r; if (!life.blockedAt(x, z, n.r)) { n.x = x; n.z = z; n.root.position.set(x, 0, z); return; } }
      const q = life.collide(hx - fx * 1.2, hz - fz * 1.2, n.r); n.x = q[0]; n.z = q[1];
    }
    function welcome() {
      const n = cp.n; if (!n) return;
      cp.mode = 'welcome'; modeT = 1.8;
      n.I.st.happy = 1; n.I.st.sit = 0; n.I.st.lie = 0; n.I.hop(); setTimeout(() => n.I.hop(), 450);
      setTimeout(() => { if (cp.n === n) n.I.st.happy = 0; }, 1600);
      if (Math.random() < 0.6) { const l = lineFor('welcome', n.id); if (l) setTimeout(() => life.sayLine(n, l, 2400), 300); }
    }
    // след героини: точки через ~0,3 м
    function crumb(hx, hz) {
      const L = crumbs[crumbs.length - 1];
      if (!L || Math.hypot(L[0] - hx, L[1] - hz) > 0.3) { crumbs.push([hx, hz]); if (crumbs.length > 70) crumbs.shift(); }
    }
    function behind(dist) {
      let acc = 0;
      for (let i = crumbs.length - 1; i > 0; i--) { const a = crumbs[i], b = crumbs[i - 1], l = Math.hypot(a[0] - b[0], a[1] - b[1]); if (acc + l >= dist) { const k = (dist - acc) / l; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(a[0] - b[0], a[1] - b[1])]; } acc += l; }
      return null;
    }
    function moveTo(n, x, z, speed, dt, CTX) {
      const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (d > 0.08) { const s = Math.min(speed, d / Math.max(dt, 1e-3)); vx = dx / d * s; vz = dz / d * s; }
      // не наступать на героиню и кота
      const push = (px, pz, R) => { const ex = n.x - px, ez = n.z - pz, e = Math.hypot(ex, ez); if (e < R && e > 1e-4) { const k = (R - e) / R; vx += ex / e * k * 2.2; vz += ez / e * k * 2.2; } };
      push(CTX.hx, CTX.hz, n.r + 0.38);
      if (CTX.cat && CTX.cat.on) push(CTX.cat.x, CTX.cat.z, n.r + 0.28);
      const ox = n.x, oz = n.z;
      const q = life.collide(n.x + vx * dt, n.z + vz * dt, n.r); n.x = q[0]; n.z = q[1];
      const moved = Math.hypot(n.x - ox, n.z - oz) / Math.max(dt, 1e-4);
      n.spd += (Math.min(moved, 7) - n.spd) * Math.min(1, dt * 10);
      if (moved > 0.15) n.head = Math.atan2(n.x - ox, n.z - oz);
      return d;
    }

    /* ---------- кадр ---------- */
    cp.update = (dt, t, ctx, CTX) => {
      CTXs = CTX;
      // уходит на площадку после «Домой»
      const lv = cp.leaving;
      if (lv && !lv.follow) {
        lv.leaveT -= dt;
        const far = Math.hypot(lv.x - CTX.hx, lv.z - CTX.hz) > 14;
        if (lv.leaveT <= 0 || far || !lv.vis) {
          const D = life.DP, a = Math.random() * TAU; lv.x = D.x + Math.cos(a) * 1.5; lv.z = D.z + Math.sin(a) * 1.5; const q = life.collide(lv.x, lv.z, lv.r); lv.x = q[0]; lv.z = q[1];
          lv.act = 'stand'; lv.actT = 2; lv.home = { x: lv.x, z: lv.z, ry: 0 }; cp.leaving = null; cp.mode = 'off';
        } else if (lv.leaveTo) { lv.act = 'goto'; lv.tx = lv.leaveTo[0]; lv.tz = lv.leaveTo[1]; lv.goAct = null; lv.want = 2.4; lv.actT = 5; }
      }
      if (!cp.active()) { meetDogs(dt, CTX); return; }
      const n = cp.n, I = n.I, st = I.st;
      // прогулка просит спрятать компаньона (например, сюжетная сцена)
      if (ctx && ctx.companion === false) { if (!hidden) { hidden = true; n.root.visible = false; life.setBlob(0, 0, 0, 0); } return; }
      if (hidden) { hidden = false; n.root.visible = true; placeNear(CTX.hx, CTX.hz, CTX.ha); }
      const hx = CTX.hx, hz = CTX.hz, ha = CTX.ha || 0;
      // в машине: место сзади (корень — у машины)
      if (n.root.parent && n.root.parent !== scene) {
        cp.mode = 'car'; st.sit = 1; st.spd = 0; st.look = Math.sin(t * 0.6) * 0.5; st.wag = 0.6; n.spd = 0;
        I.anim(dt, t, 0); life.setBlob(0, 0, 0, 0);
        const wp = new T.Vector3(); n.root.getWorldPosition(wp); n.x = wp.x; n.z = wp.z;
        return;
      }
      if (cp.mode === 'car') { cp.mode = 'follow'; n.root.rotation.x = 0; n.root.rotation.z = 0; n.y = 0; crumbs = []; if (Math.hypot(n.x - hx, n.z - hz) > 4) placeNear(hx, hz, ha); }
      // пауза (комната) — встретить героиню у двери
      if (CTX.gap > 0.8 && cp.mode !== 'welcome') { if (Math.hypot(n.x - hx, n.z - hz) > 6) placeNear(hx, hz, ha); welcome(); crumbs = []; }
      const dist = Math.hypot(n.x - hx, n.z - hz);
      if (dist > (CTX.mode === 'ride' ? 14 : 12) && CTX.mode !== 'drive') { placeNear(hx, hz, ha); crumbs = []; }
      let target = null, speed = 0, sit = 0, lie = 0, sniff = 0, lookAt = null;
      const heroMoving = CTX.hs > 0.35;
      if (CTX.mode === 'drive') {
        // машина уехала без собачки (интегратор не посадил): сидит и ждёт
        cp.mode = 'wait'; sit = 1; lookAt = Math.atan2(hx - n.x, hz - n.z);
      } else if (CTX.mode === 'ride' && CTX.bike) {
        cp.mode = 'ride';
        let p = null; try { p = CTX.bike.dogPoint ? CTX.bike.dogPoint(-1) : null; } catch (e) { p = null; }
        if (!p) { const rx = -Math.cos(ha), rz = Math.sin(ha); p = { x: hx + rx * 0.9 - Math.sin(ha) * 0.3, z: hz + rz * 0.9 - Math.cos(ha) * 0.3 }; }
        target = [p.x, p.z]; speed = clamp(Math.hypot(p.x - n.x, p.z - n.z) * 3 + CTX.hs, 0, 6.5);
      } else if (cp.mode === 'welcome') {
        modeT -= dt; lookAt = Math.atan2(hx - n.x, hz - n.z);
        if (dist > 1.3) { target = [hx, hz]; speed = 2.6; } if (modeT <= 0) cp.mode = 'follow';
      } else if (CTX.busy) {
        // заходит в дверь / сцена: сесть и смотреть на неё
        cp.mode = 'wait'; sit = 1; lookAt = Math.atan2(hx - n.x, hz - n.z);
      } else {
        crumb(hx, hz);
        if (heroMoving) { idleT = 0; walkT += dt; } else { idleT += dt; walkT = 0; }
        aheadCd -= dt;
        if (cp.mode === 'ahead') {
          modeT -= dt; lookAt = Math.atan2(hx - n.x, hz - n.z);
          if (Math.hypot(tx - n.x, tz - n.z) > 0.3) { target = [tx, tz]; speed = 3.2; } else sniff = 0.6;
          const fx = Math.sin(ha), fz = Math.cos(ha); if (modeT <= 0 || (n.x - hx) * fx + (n.z - hz) * fz < -0.6 || !heroMoving) cp.mode = 'follow';
        } else if (heroMoving) {
          cp.mode = 'follow';
          const b = behind(1.35);
          if (b) { const rx = -Math.cos(b[2]), rz = Math.sin(b[2]); target = [b[0] + rx * 0.42, b[1] + rz * 0.42]; }
          else { target = [hx - Math.sin(ha) * 1.2 - Math.cos(ha) * 0.4, hz - Math.cos(ha) * 1.2 + Math.sin(ha) * 0.4]; }
          const dt2 = Math.hypot(target[0] - n.x, target[1] - n.z);
          speed = clamp(CTX.hs * 1.05 + dt2 * 1.6, 0, 4.6);
          // иногда забегает вперёд и оглядывается
          if (walkT > 5 && aheadCd <= 0 && CTX.hs < 3) {
            aheadCd = rnd(14, 24);
            const fx = Math.sin(ha), fz = Math.cos(ha), ax = hx + fx * 2.4 - Math.cos(ha) * 0.5, az = hz + fz * 2.4 + Math.sin(ha) * 0.5;
            if (!life.blockedAt(ax, az, n.r) && life.clearLine(n.x, n.z, ax, az, n.r * 0.8)) { cp.mode = 'ahead'; tx = ax; tz = az; modeT = 3; }
          }
        } else {
          // она стоит: подойти справа и сесть; потом понюхать вокруг; потом прилечь
          const rx = -Math.cos(ha), rz = Math.sin(ha), fx = Math.sin(ha), fz = Math.cos(ha);
          if (cp.mode !== 'explore' && cp.mode !== 'sitBy') { cp.mode = 'sitBy'; let sx = hx + rx * 0.85 - fx * 0.15, sz = hz + rz * 0.85 - fz * 0.15; if (life.blockedAt(sx, sz, n.r)) { sx = hx - fx * 1.0 + rx * 0.3; sz = hz - fz * 1.0 + rz * 0.3; } tx = sx; tz = sz; modeT = rnd(5, 8); }
          if (cp.mode === 'sitBy') {
            const d2 = Math.hypot(tx - n.x, tz - n.z);
            if (d2 > 0.25 && idleT < 30) { target = [tx, tz]; speed = clamp(0.9 + d2 * 1.4, 0, 3.4); }
            else { if (idleT > 20) lie = 1; else sit = 1; lookAt = idleT > 2 ? Math.atan2(hx - n.x, hz - n.z) + Math.sin(t * 0.4) * 0.5 : null; }
            modeT -= dt;
            if (modeT <= 0 && idleT > 4 && idleT < 20) { const a = Math.random() * TAU, rr = rnd(1.2, 2.2), ex = hx + Math.cos(a) * rr, ez = hz + Math.sin(a) * rr; if (!life.blockedAt(ex, ez, n.r) && life.clearLine(n.x, n.z, ex, ez, n.r * 0.8)) { cp.mode = 'explore'; tx = ex; tz = ez; modeT = 2.2; } else modeT = 2; }
          } else {
            const d2 = Math.hypot(tx - n.x, tz - n.z);
            if (d2 > 0.25) { target = [tx, tz]; speed = 1.1; } else { sniff = 1; modeT -= dt; if (modeT <= 0) cp.mode = 'reSit'; }   // понюхала — назад к ней
          }
        }
      }
      // движение
      let d = 0;
      if (target) d = moveTo(n, target[0], target[1], speed, dt, CTX);
      else { moveTo(n, n.x, n.z, 0, dt, CTX); }
      // застряла за углом — появиться у неё за спиной
      chk += dt; if (chk > 1.2) { const mv = Math.hypot(n.x - lx, n.z - lz); if (target && speed > 0.8 && d > 2.5 && mv < 0.3) stuckT += chk; else stuckT = 0; lx = n.x; lz = n.z; chk = 0; if (stuckT > 2) { placeNear(hx, hz, ha); stuckT = 0; crumbs = []; } }
      // поворот и поза
      const walking = n.spd > 0.15;
      let want = n.root.rotation.y;
      if (walking && n.head !== undefined) want = n.head; else if (lookAt !== null) want = lookAt;
      n.root.rotation.y += angDiff(want, n.root.rotation.y) * Math.min(1, dt * 8);
      // высота пола (лестница и терраса холма, мостик, пирс — WORLD.LAYOUT.heightAt; интегратор волны 3)
      const LH = WORLD.LAYOUT && WORLD.LAYOUT.heightAt, ny = LH ? Math.max(0, LH(n.x, n.z) || 0) : 0;
      n.root.position.set(n.x, ny, n.z); n.y = ny;
      st.spd = n.spd; st.sit = walking ? 0 : sit; st.lie = walking ? 0 : lie; st.sniff = sniff; st.sleep = 0;
      st.wag = dist < 2.5 ? 0.85 : 0.5;
      st.look = walking ? 0 : clamp(angDiff(Math.atan2(hx - n.x, hz - n.z), n.root.rotation.y), -0.9, 0.9);
      st.lookUp = !walking && dist < 1.4 ? 0.6 : 0;
      I.anim(dt, t, 0);
      if (I.outline) I.outline.visible = !(ctx && ctx.q && ctx.q.outline === false);
      life.setBlob(n.x, ny, n.z, 0.55);
      n.ry0 = n.root.rotation.y;
    };

    /* ---------- первая встреча на площадке ---------- */
    // три собачки подбегают и садятся рядком перед ней (места считаются от того, где она сейчас и куда смотрит)
    let meeting = null;
    const meetSlots = (CTX, k3) => { const ha = CTX.ha || 0, fx = Math.sin(ha), fz = Math.cos(ha), rx = -Math.cos(ha), rz = Math.sin(ha); return k3.map((k, i) => [CTX.hx + fx * (1.25 + Math.abs(k) * 0.25) + rx * k, CTX.hz + fz * (1.25 + Math.abs(k) * 0.25) + rz * k]); };
    function meetDogs(dt, CTX) {
      if (meeting) {
        meeting.t -= dt;
        const live = meeting.dogs.filter(n => !n.follow && n.goAct === 'present');
        if (meeting.t <= 0 || !live.length) { meeting.dogs.forEach(n => { n.goSpeed = 0; }); meeting = null; return; }
        const S2 = meetSlots(CTX, meeting.k);
        meeting.dogs.forEach((n, i) => {
          if (n.goAct !== 'present' || n.follow) return;
          const dh = Math.hypot(n.x - CTX.hx, n.z - CTX.hz);
          // упёрлась (барьер, тоннель) или задержалась, но уже рядом — сесть, где стоит, лицом к ней
          if ((n.stuckN > 0 || meeting.t < 7) && dh < 3.2) { n.goAct = null; n.goSpeed = 0; n.act = 'sit'; n.actT = 12; n.faceHero = 12; n.stuckN = 0; Object.assign(n.I.st, { sit: 1, wag: 1 }); n.I.hop(); return; }
          let [x, z] = S2[i];
          // упёрлась далеко — к ней напрямую, на 1,4 м
          if (n.stuckN > 0) { const dx = CTX.hx - n.x, dz = CTX.hz - n.z, l = Math.hypot(dx, dz) || 1; x = CTX.hx - dx / l * 1.4 + (Math.random() - 0.5) * 1.2; z = CTX.hz - dz / l * 1.4 + (Math.random() - 0.5) * 1.2; n.stuckN = 0; }
          if (life.blockedAt(x, z, n.r)) { const q = life.collide(x, z, n.r); x = q[0]; z = q[1]; }
          n.tx = x; n.tz = z; n.noticeT = 0; n.noticeCd = 2;
        });
        return;
      }
      if (metSession || !CTX.active || CTX.mode !== 'walk' || CTX.blocked || cp.noMeet) return;
      // площадка за оградой (L.park.dog, волна 3) — встреча, когда она вошла внутрь; без ограды — ближе 9 м
      const D = life.DP, R = (WORLD.LAYOUT && WORLD.LAYOUT.park && WORLD.LAYOUT.park.dog) || null;
      if (R ? !(CTX.hx > R.x0 && CTX.hx < R.x1 && CTX.hz > R.z0 && CTX.hz < R.z1) : Math.hypot(CTX.hx - D.x, CTX.hz - D.z) > 9) return;
      const ds = dogs().filter(n => !n.follow && !n.bench && Math.hypot(n.x - CTX.hx, n.z - CTX.hz) < 20);
      if (!ds.length) return;
      metSession = true;
      const k3 = ds.map((n, i) => (i - (ds.length - 1) / 2) * 0.72);
      meeting = { dogs: ds, k: k3, t: 12 };
      ds.forEach(n => { n.act = 'goto'; n.goAct = 'present'; n.goSpeed = 2.1; n.actT = 12; n.faceHero = 0; n.noticeT = 0; n.noticeCd = 3; n.partner = null; });
      meetDogs(0, CTX);
      if (!ps().met) toast('Три хвоста виляют сразу. Погладь того, с кем хочешь погулять.', 3600);
    }
    return cp;
  };
})();
