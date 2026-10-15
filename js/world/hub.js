/* =====================================================================
   WorldHub — единственный вход в уличные отрезки (§9.2-A world_unify).
   runStreet(o) — замена City3D.run(o) для улицы один к одному: та же схема o, тот же o.done(v).
   Ведёт открытый город (World.walk); город не смог — нынешняя улица (City3D.run с тем же o); не может и она — o.fallback() (2D).
   Лестница (§5.1):
     нет City3D / нет WebGL / st.force2d                                   → '2d'
     --no-world, ?world=off, st.world.tier === 'street', город не умеет
     (нет модулей, maxTextureSize < 4096), в сессии город уже дважды падал   → 'street'
     иначе                                                                  → 'world'
   Во время прогулки: низкий FPS — сначала ниже качество (среднее → низкое → облегчённое), потом улица (tier запоминается);
   потеря контекста WebGL — улица на этот отрезок (вторая за сессию — до конца сессии); сборка дольше 15 с или с ошибкой — улица.
   Пока героиня в комнате, видеокарту город держит; на слабых телефонах отпускает (§5.3).
   ===================================================================== */
(function () {
  'use strict';
  const QS = new URLSearchParams(location.search);
  const DEBUG = /debug=1/.test(location.search);
  const FORCE = DEBUG && QS.get('world') === 'force';
  const OFF = QS.get('world') === 'off' || !!window.WORLD_OFF;
  const has3D = () => !!(window.City3D && City3D.supported);
  const G_ = () => window.G || null;
  const st = () => { try { return G_() ? G_().state() : {}; } catch (e) { return {}; } };
  const W_ = () => window.World || null;
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* ignore */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const BUILD_LIMIT = 15000;

  let sideTotal = 0, last = null, fails = 0, lost = 0, prewarmP = null, buildFailed = false;
  const wst = () => { const W = W_(); if (W && W.wState) return W.wState(); const s = st(); return (s && s.world) || { v: 1, tier: 'auto', why: '', q: null, g: '' }; };
  const saveW = patch => { const W = W_(); if (W && W.saveWorld) W.saveWorld(patch); else { const g = G_(); if (!g) return; const s = g.state(); s.world = Object.assign(s.world || { v: 1, tier: 'auto', why: '', q: null, g: '' }, patch); g.save(); } };

  function engine() {
    if (!has3D()) return '2d';
    if (st().force2d) return '2d';
    const W = W_();
    if (!W || !W.can || !W.can()) return 'street';
    if (FORCE) return 'world';
    if (OFF) return 'street';
    if (wst().tier === 'street') return 'street';
    if (fails >= 2 || lost >= 2 || buildFailed) return 'street';
    return 'world';
  }
  // слабый телефон: на время комнаты город отпускает видеокарту (новая сцена загрузится обратно сама)
  function lowMem() {
    try {
      const ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (ios && screen.width * (window.devicePixelRatio || 1) <= 828) return true;
      if (navigator.deviceMemory && navigator.deviceMemory <= 3) return true;
    } catch (e) { /* ignore */ }
    return lost > 0 || (DEBUG && QS.get('wrelease') === '1');
  }

  function prewarm() {
    if (engine() !== 'world') return Promise.resolve(false);
    const W = W_();
    if (W.built()) return Promise.resolve(true);
    if (prewarmP) return prewarmP;
    prewarmP = W.build({ idle: true, q: wst().q }).then(() => true, e => { console.warn('world build', e); buildFailed = true; saveW({ tier: 'street', why: 'build' }); emit('world:fallback', { to: 'street', reason: 'build' }); prewarmP = null; return false; });
    return prewarmP;
  }

  // экран «строим город…» (как у комнат), пока сборка не закончилась
  function loadingScreen(o) {
    const g = G_(); if (!g) return () => {};
    const scr = g.show('<div class="w-loading"><div class="ld"><div class="ld-t">Дело № 10/10</div><div class="ld-m">строим город…</div><div class="ld-b"><i></i></div></div></div>', 'street street3d');
    if (window.WORLD && WORLD.uiCss) WORLD.uiCss();
    try { g.setHud({ label: o.hudLabel }); } catch (e) { /* ignore */ }
    const bar = scr.querySelector('.ld-b i'), W = W_();
    const upd = k => { if (bar) bar.style.width = Math.round(Math.min(1, k) * 100) + '%'; };
    upd(W.progress().k || 0.05);
    return W.onProgress(k => upd(k));
  }

  async function ensureBuilt(o) {
    const W = W_();
    if (W.built()) return true;
    const off = loadingScreen(o);
    const p = W.build({ idle: false, q: wst().q });
    let timer = null;
    const r = await Promise.race([p.then(() => 'ok', e => { console.warn('world build', e); return 'build'; }), new Promise(res => { timer = setTimeout(() => res('timeout'), BUILD_LIMIT); })]);
    clearTimeout(timer); off();
    if (r === 'ok') return true;
    buildFailed = true; saveW({ tier: 'street', why: r });
    emit('world:fallback', { to: 'street', reason: r });
    return r;
  }

  function streetRun(o) {
    try { return Promise.resolve(City3D.run(o)); } catch (e) { console.error('street', e); if (o.fallback) o.fallback(); return Promise.resolve(); }
  }

  async function runStreet(o) {
    const t0 = performance.now(), eng = engine(), side0 = sideTotal;
    const done0 = o.done;
    let fellBack = null;
    const record = (engName, extra) => { last = Object.assign({ engine: engName, ms: Math.round(performance.now() - t0), sideMs: Math.round(sideTotal - side0), side: [], fellBack }, extra || {}); };
    if (eng === '2d') { record('2d'); if (o.fallback) o.fallback(); return; }
    if (eng === 'street') {
      o.done = v => { o.done = done0; record('street'); if (done0) done0(v); };
      return streetRun(o);
    }
    // город
    const ok = await ensureBuilt(o);
    if (ok !== true) {
      fellBack = { to: 'street', reason: ok };
      o.done = v => { o.done = done0; record('street'); if (done0) done0(v); };
      return streetRun(o);
    }
    const W = W_();
    let r;
    try {
      r = await W.walk(o, {
        onSide: (id, ms) => { sideTotal += ms; },
        onQuality: q => saveW({ q }),
      });
    } catch (e) { console.error('world walk', e); r = { fail: 'error' }; }
    if (r && !r.fail) {
      record('world', { side: r.side || [] });
      if (lowMem()) W.release(); else W.pause();
      if (done0) done0(r.v);
      return;
    }
    // город не смог: отпускаем видеокарту, отрезок заново на улице с тем же o
    const reason = (r && r.fail) || 'error';
    if (reason === 'replaced') return;
    fellBack = { to: 'street', reason };
    W.release();
    if (reason === 'contextlost') { lost++; saveW({ why: 'contextlost' }); }
    else if (reason === 'fps') saveW({ tier: 'street', why: 'fps' });
    else fails++;
    emit('world:fallback', { to: 'street', reason });
    const g = G_();
    if (g) { try { g.skipDialogs(true); document.querySelectorAll('#layer .dlg-wrap, #layer .remark').forEach(el => el.remove()); await sleep(120); g.skipDialogs(false); } catch (e) { /* ignore */ } }
    if (reason === 'fps' && g) g.toast('Включаю лёгкую улицу: так телефону проще.', 2600);
    o.done = v => { o.done = done0; record('street'); if (done0) done0(v); };
    return streetRun(o);
  }

  const WorldHub = {
    engine,
    runStreet,
    prewarm,
    sideMs: () => Math.round(sideTotal),
    lastWalk: () => (last ? Object.assign({}, last) : null),
    setTier(t) { if (t !== 'auto' && t !== 'street') return; saveW({ tier: t, why: '' }); if (t === 'auto') { fails = 0; buildFailed = false; } },
    doors() {
      const W = W_();
      const d = W && W.doors ? W.doors() : null;
      if (d) return d;
      return window.WORLD && WORLD.doorsStatic ? WORLD.doorsStatic() : [];
    },
    _lowMem: () => lowMem(),
    _state: () => ({ fails, lost, buildFailed, prewarming: !!prewarmP, tier: wst().tier, why: wst().why, q: wst().q }),
  };
  window.WorldHub = WorldHub;
})();
