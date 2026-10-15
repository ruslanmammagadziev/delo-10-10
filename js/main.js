/* =====================================================================
   ЗАПУСК: приглашение подружки, продолжение, меню сезона.
   ===================================================================== */
(function () {
  const { esc, show, choose, haptic, toast } = G;
  const C = G.C;
  const S = () => G.state();
  // единый город: строится фоном после первого касания (WorldHub, js/world/hub.js); нет города — ничего не происходит
  const hub = () => window.WorldHub || null;
  function prewarm() {
    try { const h = hub(); if (h && typeof h.prewarm === 'function') Promise.resolve(h.prewarm()).catch(() => {}); } catch (e) { /* город не обязателен */ }
  }
  const engine = () => { try { return window.Missions ? Missions.engine() : hub() && hub().engine ? hub().engine() : 'street'; } catch (e) { return 'street'; } };
  // переключатель «Лёгкий город»: улица-полоса вместо большого города (виден, когда город доступен или уже выбрана улица)
  function lightCityHTML() {
    const h = hub(), st = S();
    if (!h || typeof h.setTier !== 'function' || !window.City3D || !City3D.supported || st.force2d) return '';
    const on = !!(st.world && st.world.tier === 'street');
    if (!on && engine() !== 'world') return '';
    return `<button class="light-city${on ? ' on' : ''}" id="lightCity" role="switch" aria-checked="${on}"><span class="lc-tx"><b>Лёгкий город</b><span>${on ? 'Сейчас — улица: телефону так проще' : 'Улица вместо большого города, если телефон устаёт'}</span></span><i class="lc-sw"></i></button>`;
  }
  function bindLightCity(scr) {
    const b = scr.querySelector('#lightCity');
    if (!b) return;
    b.addEventListener('click', () => {
      const on = !b.classList.contains('on');
      haptic('select');
      try { hub().setTier(on ? 'street' : 'auto'); } catch (e) { /* ignore */ }
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
      b.querySelector('.lc-tx span').textContent = on ? 'Сейчас — улица: телефону так проще' : 'Улица вместо большого города, если телефон устаёт';
      toast(on ? 'Включила лёгкую улицу. Дела и места — те же.' : 'Большой город снова включён.', 2200);
    });
  }

  function inviteWelcome(inv) {
    return new Promise(res => {
      const st = S();
      const role = G.team[inv.role];
      if (!role) return res();
      const scr = show(`
        <div class="grow col center pad title-screen" style="gap:12px">
          <div class="case-badge">Дело №10/10</div>
          <div class="char bob" style="width:130px">${role.art({})}</div>
          <div class="title h2">${inv.name ? esc(inv.name) + ', тебя назначили в команду!' : 'У тебя новая роль в детективе!'}</div>
          <p class="muted" style="font-weight:800">Роль: ${esc(role.role)}.${inv.from ? `<br/>Приглашение от ${esc(inv.from)}.` : ''}</p>
          <p class="small muted" style="font-weight:700">Можешь пройти первую серию сама. ${inv.role === 'hedgehog' ? 'Твоя сцена — во второй серии.' : 'Да, ты там появишься!'}</p>
          <button class="btn" id="ok" style="min-width:240px">Я в деле</button>
        </div>`);
      scr.querySelector('#ok').addEventListener('click', () => {
        haptic('medium');
        if (inv.name) st.team[inv.role] = inv.name;
        st.invite = inv; G.save(); res();
      });
    });
  }

  // прогулка «Город нараспашку»: карточка под сериями (только если town.js загрузился)
  function townCard() {
    if (!window.Town) return '';
    const st = S(), open = !!(st.eps[1] && st.eps[1].done);
    if (!open) return `<button class="ep-card locked town-entry" data-town="0"><div class="num">🔒</div><div class="grow"><div class="t">Город нараспашку</div><div class="s">После первой серии</div></div></button>`;
    let c = null; try { c = Town.counts(); } catch (e) { c = null; }
    return `<button class="ep-card town-entry" data-town="1"><div class="num">🏙</div><div class="grow"><div class="t">Город нараспашку</div><div class="s">Город открыт. Загляни куда захочешь.</div>${c ? `<div class="s" style="font-size:12px">Штампы ${c.stamps}/12 · Факты ${c.facts}/${c.factsAvail} · Секретики ${c.secrets}/${c.secretsTotal}</div>` : ''}</div></button>`;
  }
  function seasonMenu() {
    const st = S();
    G.setHud({ hidden: true });
    const last = C.EPISODES[C.EPISODES.length - 1];
    // закрытая серия: «Выйдет: суббота, 21 ноября»; у финала без объявленной даты — «Финал — в декабре»
    const soon = ep => (ep.when ? (ep === last ? `Финал — ${ep.when}` : `Выйдет ${ep.when}`) : `Выйдет: ${Ep1.whenText(ep)}`);
    const card = ep => {
      const e = st.eps[ep.n];
      const released = G.isReleased(ep);
      const open = ep.built && (released || ep.n === 1);
      const sub = open
        ? (e && e.done ? `Пройдена${st.ratings[ep.n] ? ` · твоя оценка ${st.ratings[ep.n]}/10` : ''}` : e && e.cp.length ? 'Расследование идёт' : 'Можно смотреть')
        : (released ? 'Готовим новую серию' : soon(ep));
      return `<button class="ep-card ${open ? '' : 'locked'}" data-n="${ep.n}" data-open="${open ? 1 : 0}">
        <div class="num">${open ? ep.n : '🔒'}</div>
        <div class="grow"><div class="t">Серия&nbsp;${ep.n} «${esc(ep.title)}»</div><div class="s">${esc(sub)}</div></div>
      </button>`;
    };
    const scr = show(`
      <div class="grow season pad col" style="gap:12px;padding-bottom:calc(26px + var(--safe-bottom))">
        <div style="text-align:center"><div class="case-badge">Сезон 1</div></div>
        <div class="title h2" style="text-align:center">${esc(C.SEASON_TITLE)}</div>
        <div class="char bob" style="width:110px;margin:0 auto">${Art.heroine({ bow: st.bow, coat: st.coat, hair: st.hair, magnifier: true })}</div>
        <div class="col">${C.EPISODES.map((ep, i) => card(ep) + (i === 0 ? townCard() : '')).join('')}</div>
        <div class="row" style="gap:10px;margin-top:4px">
          <button class="btn soft grow" id="nb">📒 Блокнот</button>
          <button class="btn soft grow" id="cr">🎬 Титры</button>
        </div>
        ${lightCityHTML()}
        <p class="tiny muted" style="text-align:center;font-weight:700">${C.EPISODES.length === 3 ? 'В сезоне три серии' : `Серий в сезоне: ${C.EPISODES.length}`}. Следующая откроется сама, дата — на карточке.</p>
      </div>`);
    const tc = scr.querySelector('[data-town="1"]');
    if (tc) tc.addEventListener('click', () => { if (Town.running) return; haptic('medium'); Town.run({ from: 'menu' }).then(seasonMenu); });
    scr.querySelectorAll('.ep-card:not(.town-entry)').forEach(b => b.addEventListener('click', async () => {
      haptic('light');
      const n = +b.dataset.n;
      if (b.dataset.open !== '1') {
        const ep = C.EPISODES.find(x => x.n === n);
        toast(ep.teaser ? `Серия\u00A0${n}: ${ep.teaser}` : `Серия\u00A0${n}. ${soon(ep)}`, 3200);
        return;
      }
      if (n === 1) {
        const e = st.eps[1];
        if (e && e.done) {
          const v = await choose('Серия\u00A01', [{ label: 'Открыть финал серии', value: 'end' }].concat(window.Town ? [{ label: 'Гулять по городу', value: 'town' }] : []).concat([{ label: 'Пройти заново', value: 'again' }, { label: 'Назад', value: 'back' }]));
          if (v === 'end') Ep1.endCard();
          if (v === 'town' && !Town.running) Town.run({ from: 'menu' }).then(seasonMenu);
          if (v === 'again') { Ep1.restart(); Ep1.run(); }
        } else Ep1.run();
      }
    }));
    scr.querySelector('#nb').addEventListener('click', () => { haptic('light'); G.notebook(); });
    scr.querySelector('#cr').addEventListener('click', () => { haptic('light'); Ep1.credits().then(seasonMenu); });
    bindLightCity(scr);
  }

  // серия 1 пройдена и город доступен: короткий титул → сразу в город; «← в меню» в шапке — меню сезона
  async function cityStart() {
    const st = S();
    G.setHud({ hidden: true });
    const card = window.Missions ? Missions.cardHTML(Missions.caseCard(), { inline: true }) : '';
    show(`<div class="grow col center pad title-screen" style="gap:12px">
      <div class="case-badge">Дело №\u00A010/10</div>
      <div class="char bob" style="width:130px">${Art.heroine({ bow: st.bow, coat: st.coat, hair: st.hair, magnifier: true })}</div>
      <div class="title h2">Город на месте</div>
      <p class="muted" style="font-weight:800">Фонари горят, кот делает вид, что не скучал.</p>
      ${card ? `<div class="title-case">${card}</div>` : ''}</div>`);
    const v = await choose('', [{ label: 'В город', value: 'city' }, { label: 'Меню сезона', value: 'menu', cls: 'soft' }]);
    if (v === 'city' && window.Town && !Town.running) { await Town.run({ from: 'boot' }); }
    seasonMenu();
  }

  // стенд для разработки: ?debug=1&room=<id> — открыть 3D-комнату напрямую
  function roomHarness(rid) {
    const st = S();
    window.City3D.run({
      room: rid, hudLabel: 'Комната: ' + rid, mode: /[?&]mode=free/.test(location.search) ? 'free' : 'story',
      hero: { bow: st.bow || '#F08FA8', coat: st.coat || '#E9D4B6', hair: st.hair || '#4A3128', cup: null },
      catHelper: true, held: st.bouquet ? { kind: 'bouquet', data: st.bouquet } : null,
      onSpot: id => toast('spot: ' + id, 1500), onNpc: id => toast('npc: ' + id, 1500),
      done: v => { toast('done: ' + v, 1500); setTimeout(() => roomHarness(rid), 800); },
      fallback: () => toast('нет WebGL'),
    });
  }

  function freeHarness(spawnAt) {
    const st = S();
    const D = [['cinema', 0, 'Кинотеатр', null], ['bureau', 6.2, 'Бюро', 'fresh'], ['silver', 12.47, 'Часовщик', 'new'], ['sweets', 17.25, 'Кондитерская', null], ['stairs', 23.7, 'Подъезд', 'new', 'roof']]
      .concat(City3D.shops().map(x => [x.key, x.x + (x.doorDx || 0), x.name || x.key, 'new']));
    window.City3D.run({
      free: { doors: D.map(([id, x, label, mark, bkey]) => ({ id, x, label, mark, bkey })), spawnAt, bounds: { x0: -16.2, x1: 39.6 }, cam: { x0: -14.6, x1: 37.6 }, catAt: { x: 1.3, z: -0.9 }, hintDoor: 'silver', exitText: '← в меню' },
      idx: 4, hudLabel: 'Город нараспашку (стенд)',
      hero: { bow: st.bow || '#F08FA8', coat: st.coat || '#E9D4B6', hair: st.hair || '#4A3128', cup: null }, catHelper: false,
      spots: [{ id: 'kiosk', x: 9.6, z: -0.3, act: 'Газета', bubble: 'киоск' }, { id: 'mailbox', x: 13.6, z: -0.9, act: 'Почта', bubble: 'почта' }, { id: 'endL', x: -16.6, z: -0.5, act: 'Смотреть', bubble: 'конец улицы' }],
      onSpot: id => toast('spot: ' + id, 1200), onNpc: id => toast('npc: ' + id, 1200),
      done: r => { toast('итог: ' + JSON.stringify(r), 1200); window.__lastDoor = r; if (r !== 'menu') setTimeout(() => freeHarness(r.door), 900); },
      fallback: () => toast('нет WebGL'),
    });
  }
  async function boot() {
    show(`<div class="grow col center title-screen"><div class="case-badge pulse">Дело №\u00A010/10</div></div>`);
    if (/debug=1/.test(location.search) && /[?&]free=1/.test(location.search) && window.City3D) { await G.loadCloud(); freeHarness(null); return; }
    const rid = /debug=1/.test(location.search) && new URLSearchParams(location.search).get('room');
    if (rid && window.City3D && City3D.hasRoom && City3D.hasRoom(rid)) { await G.loadCloud(); roomHarness(rid); return; }
    if (G.wantsReset()) {
      G.markResetDone();
      const ok = await choose('Сбросить весь прогресс? (Режим проверки для сценариста.)', [{ label: 'Сбросить', value: true }, { label: 'Нет', value: false }]);
      if (ok) { G.resetAll(); toast('Прогресс сброшен', 1500); }
      else await G.loadCloud();
    } else await G.loadCloud();
    const st = S();
    const inv = G.readInvite();
    if (inv && !st.invite) await inviteWelcome(inv);
    const e = st.eps[1];
    if (!e || !e.cp.length) {
      const mode = await Ep1.title();
      prewarm();
      await Ep1.run({ recap: mode === 'recap' });
    } else if (!e.done) {
      G.setHud({ hidden: true });
      show(`<div class="grow col center pad title-screen" style="gap:12px">
        <div class="case-badge">Дело №\u00A010/10</div>
        <div class="char bob" style="width:130px">${Art.heroine({ bow: st.bow, coat: st.coat, hair: st.hair, magnifier: true })}</div>
        <div class="title h2">А вот и главная героиня</div>
        <p class="muted" style="font-weight:800">Твоё расследование на месте. Кот делает вид, что не ждал.</p></div>`);
      const v = await choose('', [{ label: 'Продолжить', value: 'go' }, { label: 'Начать сначала', value: 'again' }]);
      prewarm();
      if (v === 'again') { st.eps[1] = { cp: [], done: false, start: Date.now(), time: 0 }; G.save(); const mode = await Ep1.title(); await Ep1.run({ recap: mode === 'recap' }); }
      else await Ep1.run();
    } else {
      prewarm();
      if (window.Town && engine() === 'world') await cityStart();
      else seasonMenu();
    }
  }

  window.Main = { seasonMenu };
  boot();
})();
