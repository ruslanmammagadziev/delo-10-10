/* =====================================================================
   world.html — стенд единого города и «Замер» для телефона автора (не игра: js/main.js здесь не грузится).
   Прогулка по городу через тот же WorldHub.runStreet(o), что и в игре: все места открыты, двери ведут в комнаты
   (Town.visit, если прогулка уже открыта в сохранении, иначе пустая комната движка) и обратно к той же двери;
   поддельная миссия на кинотеатре (луч, карточка), лавки g_* — шаблон, машина ездит.
   ?story=0..3 — сюжетный отрезок серии 1 с меткой на нужной двери (без ep1: только улица, вход — назад в город).
   Счётчик кадров (тап — панель), «Замер (≈ 45 с)»: 8 точек и круг на машине, текст — «Скопировать».
   Сохранение игры не меняется (кроме st.world: качество города).
   ===================================================================== */
(function () {
  'use strict';
  const QS = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const PI = Math.PI;
  const T3 = ['cinema', 'bureau', 'sweets', 'roof'];
  const LBL = { cinema: '🎬 Кинотеатр', bureau: '📜 Бюро переводов', sweets: '🧁 Кондитерская', roof: '🏠 Подъезд' };

  function freeO(spawn, done) {
    const doors = WorldHub.doors().filter(d => d.kind === 'story' || d.kind === 'place');
    return {
      idx: 4,
      free: { doors: doors.map(d => ({ id: d.id, bkey: d.bkey, x: d.x, label: d.label, mark: d.id === 'records' ? 'new' : d.id === 'books' ? 'fresh' : null })), spawnAt: spawn, exitText: '↺ заново' },
      openDoors: doors.map(d => d.id), closedText: 'Здесь пока закрыто.',
      hero: lookOf(), catHelper: true,
      spots: [{ id: 'flowers', x: -3.2, z: -0.3, act: 'Букет', bubble: 'бутик Жу' }, { id: 'weather', x: 3.1, z: -0.6, act: 'Прогноз', bubble: 'табло прогноза' },
        { id: 'bench1', x: 4.4, z: -0.55, act: 'Присесть', bubble: 'лавочка' }, { id: 'kiosk', x: 9.6, z: -0.3, act: 'Газета', bubble: 'свежий номер' },
        { id: 'mailbox', x: 13.6, z: -0.9, act: 'Почта', bubble: 'почтовый ящик' }, { id: 'bench2', x: 20.4, z: -0.55, act: 'Присесть', bubble: 'лавочка' }],
      onSpot: async (id, api) => {
        if (id === 'bench1' || id === 'bench2') { await api.sit({ x: id === 'bench1' ? 4.4 : 20.4, z: -1.15, ry: 0 }); await sleep(1500); G.toast('Голубь сел рядом и молчит. Хороший собеседник.', 2600); return; }
        if (id === 'flowers') { G.toast('Бутик Жу: букет собирается в игре, здесь — стенд города.', 3000); return; }
        G.toast({ weather: 'Пасмурно. Зато идеальная погода зайти за какао.', kiosk: 'Свежий номер: «Город хорошеет».', mailbox: 'Почтовый ящик. Писем нет — все ушли гулять.' }[id] || id, 2600);
      },
      hudLabel: '🏙 Стенд города',
      world: { markers: [{ id: 'stand', door: 'cinema', style: 'case', icon: '🔍', label: 'Кинотеатр' }], hud: { title: 'Сегодняшнее дело', text: 'Стенд: дойти до кинотеатра по лучу', door: 'cinema', progress: [1, 4], tap: 'focus', icon: '🔍' }, vehicles: 'drive', generic: true, mood: 'free' },
      done, fallback: () => done('2d'),
    };
  }
  function storyO(idx, done) {
    const target = T3[idx];
    return {
      target, idx, justLit: idx > 0 ? T3[idx - 1] : null, isLit: k => T3.indexOf(k) < idx, hero: lookOf(), catHelper: true, rain: idx === 0,
      hudLabel: LBL[target], arrowText: { cinema: 'Кинотеатр', bureau: 'Бюро', sweets: 'Кондитерская', roof: 'Подъезд' }[target],
      headline: 'Стенд: дом раскрыт, город теплеет.', spots: [{ id: 'flowers', x: -3.2, z: -0.3, act: 'Букет', bubble: 'собрать букет' }], onSpot: () => null,
      world: { residents: { hedgehog: false }, vehicles: 'covered', nudge: { after: 20, dist: 20, every: 30, who: 'cat', lines: ['Луч — там. Я бы пошёл. Если бы не лень.'] } },
      done, fallback: () => done('2d'),
    };
  }
  // образ героини: из сейва (G.look); ?look=<id> — посмотреть другой образ на стенде (только отладка, в сейв не пишется)
  const lookOf = () => {
    try {
      const HL = window.HeroLooks, q = new URLSearchParams(location.search).get('look');
      const id = HL && HL.valid(q) ? q : (G.look ? G.look() : null);
      if (HL && HL.valid(id)) return Object.assign({ look: id }, HL.legacy(id));
      const s = G.state(); return { bow: s.bow, coat: s.coat, hair: s.hair };
    } catch (e) { return {}; }
  };
  const unlocked = () => { try { return !!(G.state().eps[1] && G.state().eps[1].done); } catch (e) { return false; } };

  async function enterRoom(id) {
    const room = id === 'stairs' ? 'roof' : id;
    if (window.Town && Town.visit && unlocked()) { const r = await Town.visit(id, {}); if (r !== 'closed') return; }
    if (!City3D.hasRoom(room)) { G.toast('Комнаты пока нет.', 2000); return; }
    await new Promise(res => City3D.run({ room, mode: 'free', hudLabel: '🚪 ' + id, hero: lookOf(), catHelper: true, done: res, fallback: () => res('fallback') }));
  }

  async function loop() {
    const story = QS.get('story');
    let spawn = QS.get('spawn') || 'cinema';
    if (story !== null && T3[+story]) {
      for (let i = +story; i < 4; i++) {
        await new Promise(res => WorldHub.runStreet(storyO(i, res)));
        await enterRoom(T3[i] === 'roof' ? 'stairs' : T3[i]);
      }
      spawn = 'stairs';
    }
    for (;;) {
      const v = await new Promise(res => WorldHub.runStreet(freeO(spawn, res)));
      if (v === '2d') { G.toast('3D не открылся на этом устройстве.', 4000); return; }
      if (v && v.door) { await enterRoom(v.door); spawn = v.door; await G.untilNotSkipping(); }
      else spawn = 'cinema';
    }
  }

  /* ---------- счётчик и «Замер» ---------- */
  const SPOTS = [
    { name: 'старт у кинотеатра (фасады)', x: 3.4, z: 1.6, yaw: PI, dist: 9.5 },
    { name: 'Октябрьская, вид вдоль улицы на запад', x: 36, z: 1.4, yaw: -PI / 2 - 0.35, dist: 9.5 },
    { name: 'край площади, вид на север', x: 8, z: 15.6, yaw: PI, dist: 10.5 },
    { name: 'у фонтана, на северо-восток', x: 6, z: 26.5, yaw: PI * 0.8, dist: 9.5 },
    { name: 'юг площади, на север через фонтан', x: 11, z: 47.5, yaw: PI, dist: 11 },
    { name: 'парк, на юг', x: -43.4, z: 21, yaw: 0, dist: 9.5 },
    { name: 'набережная, на север', x: 4, z: 63.5, yaw: PI, dist: 11 },
    { name: 'Солнечный проспект, на север', x: 58.4, z: 40, yaw: PI, dist: 9.5 },
  ];
  function stats() {
    const el = document.createElement('div'); el.className = 'stats'; el.innerHTML = '<div class="pill">… fps</div><div class="panel hidden"></div>';
    document.body.appendChild(el);
    const pill = el.querySelector('.pill'), panel = el.querySelector('.panel');
    let open = QS.get('stats') === '1', f0 = 0, t0 = performance.now();
    if (QS.get('stats') === '0') el.classList.add('hidden');
    pill.addEventListener('click', () => { open = !open; panel.classList.toggle('hidden', !open); });
    panel.classList.toggle('hidden', !open);
    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.q) { World.setQuality(b.dataset.q, true); WorldHub.setTier('auto'); }
      if (b.dataset.bench) runBench().then(showBench);
    });
    setInterval(() => {
      const fr = World.frames ? World.frames() : 0, now = performance.now(), fps = Math.round((fr - f0) / ((now - t0) / 1000)); f0 = fr; t0 = now;
      pill.textContent = fps + ' fps'; pill.className = 'pill ' + (fps >= 30 ? 'ok' : fps >= 24 ? 'mid' : 'bad');
      if (!open) return;
      const i = World.info() || {}, q = World.quality();
      panel.innerHTML = `<div class="row"><b>${fps}</b> fps</div><div class="row">вызовов <b>${i.calls}</b> · треуг. <b>${Math.round((i.tris || 0) / 1000)}</b> тыс.</div>`
        + `<div class="row dim">на тени: ${i.shCalls} вызовов · ${Math.round((i.shTris || 0) / 1000)} тыс.</div><div class="row">геометрий ${i.geometries} · текстур ${i.textures}</div>`
        + `<div class="row">качество: ${q ? World.QUAL[q].name : '—'} · героиня: ${i.hero}</div><div class="row dim">x ${(i.x || 0).toFixed(1)} z ${(i.z || 0).toFixed(1)} · построен за ${((i.buildMs || 0) / 1000).toFixed(1)} с · ${window.WORLD_BUILD || 'dev'}</div>`
        + `<div class="row dim">${String(i.gpu || '').slice(0, 48)}</div>`
        + `<div class="btns">${World.ORDER.map(k => `<button data-q="${k}" class="${k === q ? 'on' : ''}">${World.QUAL[k].name}</button>`).join('')}</div>`
        + '<div class="btns"><button data-bench="1" class="wide">Замер (≈ 45 с)</button></div>';
    }, 500);
  }
  async function measure(S, sec) {
    const rec = { n: 0, t: 0, worst: 0, calls: 0, tris: 0, shCalls: 0, shTris: 0 };
    S.benchRec = (dt, info) => { if (rec.n++ === 0) return; rec.t += dt; rec.worst = Math.max(rec.worst, dt); rec.calls = Math.max(rec.calls, info.calls); rec.tris = Math.max(rec.tris, info.tris); rec.shCalls = Math.max(rec.shCalls, info.shCalls); rec.shTris = Math.max(rec.shTris, info.shTris); };
    const tEnd = performance.now() + sec * 1000; while (performance.now() < tEnd) await frame();
    S.benchRec = null;
    const n = Math.max(1, rec.n - 1);
    return { fps: Math.round(n / Math.max(rec.t, 1e-3)), min: Math.round(1 / Math.max(rec.worst, 1e-3)), calls: rec.calls, tris: rec.tris, shCalls: rec.shCalls, shTris: rec.shTris };
  }
  async function runBench(o = {}) {
    const S = World.session(); if (!S || S.benching) return null;
    S.benching = true; document.body.classList.add('benching');
    const res = [], tp = (x, z, yaw, d) => { S.dbg.placeAt(x, z, yaw + PI, yaw); S.dist = d; S.manualT = 6; };
    for (const sp of SPOTS) { tp(sp.x, sp.z, sp.yaw, sp.dist); await sleep((o.settle || 0.8) * 1000); const m = await measure(S, o.dur || 2.6); m.name = sp.name; res.push(m); if (o.shot) await o.shot(sp.name); }
    const W = World._w(), car = W.car;
    tp(-10, 7.7, PI / 2, 9.5); car.S.x = -10; car.S.z = 7.75; car.S.ry = PI / 2; car.S.v = 0; car.place();
    S.dbg.enterCar(true);
    S.autopilot = () => { const P = W.L.loopPath; let bi = 0, bd = 1e9; P.forEach(([x, z], i) => { const d = (x - car.S.x) ** 2 + (z - car.S.z) ** 2; if (d < bd) { bd = d; bi = i; } }); const [tx, tz] = P[(bi + 7) % P.length], dx = tx - car.S.x, dz = tz - car.S.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, 0.85]; };
    await sleep(1500);
    const md = await measure(S, o.drive || 12); md.name = 'за рулём, круг по кольцу'; res.push(md);
    S.autopilot = null; car.S.v = 0; S.dbg.exitCar(); await sleep(700);
    tp(3.4, 1.6, PI, 9.5);
    S.benching = false; document.body.classList.remove('benching');
    return res;
  }
  function benchText(res) {
    const ok = res.filter(Boolean), fps = ok.map(r => r.fps), i = World.info() || {};
    const ua = (navigator.userAgent.match(/\(([^)]+)\)/) || [0, ''])[1].split(';').slice(0, 3).join(';');
    const lines = [`Замер города · версия ${window.WORLD_BUILD || 'dev'} · качество ${World.QUAL[World.quality()].name} · героиня ${i.hero}`, ua, `GPU: ${i.gpu}`, `город построен за ${((i.buildMs || 0) / 1000).toFixed(1)} с`];
    ok.forEach((r, k) => lines.push(`${k + 1}. ${r.name}: ${r.fps} fps (худший кадр ${r.min}) · вызовов ${r.calls} (тени ${r.shCalls}) · ${Math.round(r.tris / 1000)} тыс. треуг. (тени ${Math.round(r.shTris / 1000)})`));
    lines.push(`итог: средний ${Math.round(fps.reduce((a, b) => a + b, 0) / fps.length)} fps, худшая точка ${Math.min(...fps)} fps; вызовов до ${Math.max(...ok.map(r => r.calls))}, треугольников до ${Math.round(Math.max(...ok.map(r => r.tris)) / 1000)} тыс.`);
    return lines.join('\n');
  }
  function showBench(res) {
    if (!res) return;
    const txt = benchText(res), md = document.createElement('div'); md.className = 'stand-modal';
    md.innerHTML = `<div class="card"><div class="ttl">Замер готов</div><pre></pre><div class="btns"><button class="copy">Скопировать</button><button class="close">Закрыть</button></div><div class="note">Скопируй и пришли этот текст — по нему видно, тянет ли телефон город.</div></div>`;
    md.querySelector('pre').textContent = txt; document.body.appendChild(md);
    md.querySelector('.close').onclick = () => md.remove();
    md.querySelector('.copy').onclick = () => { try { navigator.clipboard.writeText(txt).then(() => G.toast('Скопировано', 1200), () => sel()); } catch (e) { sel(); } };
    const sel = () => { const r = document.createRange(); r.selectNodeContents(md.querySelector('pre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); G.toast('Текст выделен — нажми «Копировать»', 2400); };
  }
  window.__stand = { runBench, benchText, showBench, SPOTS };

  async function boot() {
    if (!window.WorldHub || !window.G) return;
    stats();
    if (WorldHub.engine() !== 'world') G.toast('Город на этом устройстве не открылся — будет улица.', 3600);
    loop().catch(e => console.error('stand', e));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
