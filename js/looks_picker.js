/* =====================================================================
   ВЫБОР ОБРАЗА — экран из шести роликов вместо кастинга «бант / тренч / волосы».
   LookPicker.mount(host, { start, mode, cta, onPick, onChange, onClose, haptic, noAutoplay })
     -> { go, index, id, pause, resume, pick, destroy };  LookPicker.last — живой экземпляр (для тестов).
   mode: 'casting' (значок «Кастинг») | 'migrate' (значок «Гардероб» и строка «Гардероб обновился») |
         'atelier' (вместо значка ✕ #lkx, кнопка «Надеть»).
   Имена и подписи — js/hero_looks.js (HeroLooks), медиа — js/looks_data.js (LOOKS_DATA).
   Видео на экране одно: единственный <video> переезжает в текущий слайд, у остальных — только постер.
   Так в памяти один декодер, качается только текущий ролик, а разрешение iOS «играть после касания»
   (энергосбережение) действует и на следующие ролики: оно выдаётся элементу, а элемент тот же.
   Переход: свайп (scroll-snap, по одному слайду), стрелки ‹ ›, миниатюры, клавиши ←/→, Enter — выбрать.
   Свайп «засчитывает» образ по окончании прокрутки (scrollend или 110 мс тишины): пролистанные ролики не грузятся.
   Стрелка / миниатюра / клавиша — сразу нужный слайд без плавной прокрутки (короткий въезд кадра): на занятом
   телефоне плавная прокрутка запаздывает, а запись scrollLeft во время неё сдвигает её цель ещё на слайд (Chromium).
   Без автозапуска («уменьшить движение», экономия трафика, 2g, отказ play() в энергосбережении iOS) —
   постер и большая ▶. Ролик не загрузился — постер; постер не загрузился — встроенная миниатюра;
   нет и данных — рисованная героиня в этом образе.
   Looks.casting / Looks.wardrobe / Looks.atelier — готовые сценарии для ep1.js, main.js и ателье.
   ===================================================================== */
(function () {
  'use strict';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const lowData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${d}</svg>`;
  const ICON = {
    prev: svg('<path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    play: svg('<path d="M8.5 5.8v12.4c0 .8.9 1.3 1.6.9l9.6-6.2c.6-.4.6-1.3 0-1.7l-9.6-6.2c-.7-.5-1.6 0-1.6.8z" fill="currentColor"/>'),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>'),
    close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  };
  const HL = () => window.HeroLooks;
  const G_ = () => window.G || null;
  const fx = (k, s) => { const g = G_(); try { if (g && k) g.haptic(k); if (g && s) g.sfx(s); } catch (e) { /* ignore */ } };
  // рисованная героиня в образе: look для новых рисунков, legacy-цвета — для старого пути перекраски
  const toon = (id, o) => { try { return window.Art ? Art.heroine(Object.assign({ look: id }, HL().legacy(id), o || {})) : ''; } catch (e) { return ''; } };

  // образы: реестр (имена) + медиа (файлы); нет медиа — слайд с рисованной героиней
  function items() {
    const D = window.LOOKS_DATA, by = {};
    if (D && Array.isArray(D.items)) D.items.forEach(it => { if (it && it.id) by[it.id] = it; });
    return HL().LIST.map(L => Object.assign({ id: L.id, name: L.name, tag: L.tag, pal: L.pal }, by[L.id] || {}));
  }

  function mount(host, o = {}) {
    const L = items(), N = L.length;
    const D = window.LOOKS_DATA || {};
    const base = D.base || 'looks/';
    const mode = o.mode || 'casting';
    const haptic = o.haptic || (k => fx(k));
    let cur = -1, dead = false, userPaused = false, scrollT = 0, nudgeT = 0, holdT = 0;
    // цель перехода (стрелка / миниатюра / клавиша): образ засчитан сразу, лента держит его, пока не встанет на него;
    // чужие образы в это время не засчитываются. Палец или колесо на ленте — цель снята, дальше решает лента
    let want = -1, fixes = 0;
    // автозапуск запрещён заранее: «уменьшить движение», экономия трафика или явный флаг
    let blocked = reduced() || lowData() || !!o.noAutoplay;
    const failed = new Set();
    const startI = typeof o.start === 'string' ? Math.max(0, L.findIndex(x => x.id === o.start)) : Math.max(0, Math.min(N - 1, o.start | 0));
    const badge = mode === 'atelier'
      ? `<button class="lk-ic lk-x" id="lkx" type="button" aria-label="Закрыть">${ICON.close}</button>`
      : `<div class="case-badge lk-badge">${mode === 'migrate' ? 'Гардероб' : 'Кастинг'}</div>`;
    const media = it => (it.thumb || it.poster
      ? `<div class="lk-blur" style="background-image:url(${it.lqip || it.thumb})"></div><div class="lk-media"><img class="lk-poster" alt="" draggable="false" decoding="async" src="${it.thumb || base + it.poster}"></div>`
      : `<div class="lk-media lk-toon" style="--a:${it.pal.main};--b:${it.pal.accent}">${toon(it.id, { magnifier: true })}</div>`);

    host.innerHTML = `
      <div class="lk lk-${mode}" role="region" aria-roledescription="карусель" aria-label="Образы героини">
        <div class="lk-stage">
          <div class="lk-track" id="pv" tabindex="0" aria-label="Выбираем образ главной героини">${L.map((it, i) => `
            <div class="lk-slide" data-look="${it.id}" role="group" aria-roledescription="слайд" aria-label="${i + 1} из ${N}: ${esc(it.name)}" style="--bg:${it.bg || '#2F2834'}">${media(it)}</div>`).join('')}
          </div>
          <div class="lk-top">${badge}<button class="lk-ic lk-pp" type="button" aria-label="Пауза">${ICON.pause}</button></div>
          <button class="lk-ic lk-arrow prev" type="button" aria-label="Предыдущий образ">${ICON.prev}</button>
          <button class="lk-ic lk-arrow next" type="button" aria-label="Следующий образ">${ICON.next}</button>
          <button class="lk-play" type="button" aria-label="Смотреть ролик" hidden>${ICON.play}</button>
        </div>
        <div class="lk-panel">
          ${mode === 'migrate' ? '<div class="lk-note">Гардероб обновился: шесть образов. Выбирай свой.</div>' : ''}
          <div class="lk-thumbs" role="tablist" aria-label="Образы">${L.map((it, i) => `
            <button class="lk-thumb" type="button" role="tab" data-look="${it.id}" data-i="${i}" aria-label="${esc(it.name)}" style="${it.thumb ? `background-image:url(${it.thumb})` : `background:linear-gradient(160deg, ${it.pal.main}, ${it.pal.accent})`}"></button>`).join('')}
          </div>
          <div class="lk-name"><div class="lk-title"></div><div class="lk-sub"></div></div>
          <button class="btn block" id="pick" type="button">${esc(o.cta || (mode === 'atelier' ? 'Надеть' : 'Выбираю этот образ'))}</button>
          <div class="lk-live" aria-live="polite"></div>
        </div>
      </div>`;
    const root = host.querySelector('.lk'), stage = root.querySelector('.lk-stage'), track = root.querySelector('.lk-track');
    const slides = [...root.querySelectorAll('.lk-slide')], thumbs = [...root.querySelectorAll('.lk-thumb')];
    const posters = slides.map(s => s.querySelector('.lk-poster'));
    const prevB = root.querySelector('.prev'), nextB = root.querySelector('.next'), pp = root.querySelector('.lk-pp'), big = root.querySelector('.lk-play');
    const title = root.querySelector('.lk-title'), sub = root.querySelector('.lk-sub'), live = root.querySelector('.lk-live'), cta = root.querySelector('#pick');

    // один <video> на весь экран; атрибуты — до первого play(), иначе iOS не играет «внутри» страницы
    const v = document.createElement('video');
    v.className = 'lk-video';
    ['muted', 'playsinline', 'webkit-playsinline', 'loop', 'disablepictureinpicture', 'disableremoteplayback'].forEach(a => v.setAttribute(a, ''));
    v.setAttribute('x-webkit-airplay', 'deny');
    v.setAttribute('preload', 'metadata');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    let canMp4 = false, canWebm = false;
    try { canMp4 = !!v.canPlayType('video/mp4; codecs="avc1.4D401F"'); canWebm = !!v.canPlayType('video/webm; codecs="vp9"'); } catch (e) { /* ignore */ }
    let tryWebm = false;
    const hasVideo = it => !!(it.mp4 || it.webm);
    const srcOf = it => base + ((!canMp4 || tryWebm || !it.mp4) && it.webm && canWebm ? it.webm : it.mp4 || it.webm);

    // постеры: полный кадр только у текущего и соседей, остальные — встроенная миниатюра; ошибка — остаётся миниатюра
    function posterNear(i) {
      posters.forEach((img, k) => {
        if (!img || Math.abs(k - i) > 1 || img.dataset.full || !L[k].poster) return;
        img.dataset.full = '1';
        const full = new Image();
        full.decoding = 'async';
        full.onload = () => { if (!dead) img.src = full.src; };
        full.src = base + L[k].poster;
      });
    }
    function ui(i) {
      thumbs.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      title.textContent = L[i].name;
      sub.textContent = `${i + 1} из ${N} · ${L[i].tag}`;
      prevB.hidden = i === 0; nextB.hidden = i === N - 1;
    }
    function state(s) {
      // s: 'playing' | 'paused' | 'blocked' | 'loading' | 'none'
      root.dataset.v = s;
      big.hidden = !(s === 'blocked' || s === 'paused');
      pp.hidden = s === 'none' || s === 'blocked';
      pp.innerHTML = s === 'paused' ? ICON.play : ICON.pause;
      pp.setAttribute('aria-label', s === 'paused' ? 'Смотреть ролик' : 'Пауза');
    }
    function unload() {
      try { v.pause(); } catch (e) { /* ignore */ }
      v.classList.remove('on');
      if (v.getAttribute('src')) { v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ } }
    }
    function play(fromTap) {
      if (dead || cur < 0) return;
      if (failed.has(cur) || !hasVideo(L[cur])) { state('none'); return; }
      if (blocked && !fromTap) { state('blocked'); return; }
      const box = slides[cur].querySelector('.lk-media');
      if (v.parentNode !== box) box.appendChild(v);
      const want = srcOf(L[cur]);
      if (v.getAttribute('src') !== want) { v.setAttribute('preload', 'auto'); v.setAttribute('src', want); }
      state('loading');
      let p = null;
      try { p = v.play(); } catch (e) { p = null; }
      if (p && p.catch) {
        p.catch(err => {
          if (dead) return;
          // NotAllowedError — энергосбережение / экономия трафика: ждём касания; AbortError — уже листнули дальше
          if (err && err.name === 'NotAllowedError') { blocked = true; state('blocked'); }
        });
      }
    }
    function activate(i, why) {
      i = Math.max(0, Math.min(N - 1, i));
      if (i === cur || dead) return;
      cur = i; userPaused = false; tryWebm = false;
      ui(i); posterNear(i); unload();
      live.textContent = `Образ ${i + 1} из ${N}: ${L[i].name}`;
      if (why !== 'init') { haptic('select'); fx(null, 'tap'); }
      play(false);
      if (o.onChange) { try { o.onChange(L[i].id, i); } catch (e) { console.warn('looks onChange', e); } }
    }
    // лента стоит на слайде i (с допуском: снап доводит до пикселя сам)
    const at = i => { const W = track.clientWidth; return W > 0 && Math.abs(track.scrollLeft / W - i) < 0.08; };
    // въезд нового кадра вместо плавной прокрутки; «уменьшить движение» — без него
    function slideIn(i, dir) {
      if (reduced()) return;
      const m = slides[i].querySelector('.lk-media');
      try { m.animate([{ transform: `translateX(${dir * 28}px)`, opacity: 0.35 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' }); } catch (e) { /* ignore */ }
    }
    function go(i) {
      if (typeof i === 'string') i = L.findIndex(x => x.id === i);
      i = Math.max(0, Math.min(N - 1, i | 0));
      if (dead) return;
      const from = cur;
      want = i; fixes = 0;
      clearTimeout(scrollT); clearTimeout(holdT);
      // без анимации: значение читается сразу, плавной прокрутки, которую можно сбить, нет
      if (!at(i)) track.scrollLeft = i * track.clientWidth;
      activate(i); ui(i);
      if (from >= 0 && from !== i) slideIn(i, i > from ? 1 : -1);
      // события прокрутки от этой записи придут позже (занятый телефон); через 600 мс цель отпускаем в любом случае
      holdT = setTimeout(() => settle(true), 600);
    }
    // лента остановилась: на цели — цель отпускаем; нет (запоздалый снап, свайп поверх) — ставим ровно, до 3 раз
    function settle(final) {
      if (want < 0 || dead) return;
      if (!at(want) && track.clientWidth > 0 && fixes < 3) { fixes++; track.scrollLeft = want * track.clientWidth; if (!final) return; }
      want = -1; clearTimeout(holdT);
      // не удержали — засчитываем то, что на экране: имя, ролик и «Надеть» всегда про видимый слайд
      const k = idx();
      if (track.clientWidth > 0 && k !== cur) activate(k); else ui(cur);
    }
    function toggle() {
      if (failed.has(cur) || !hasVideo(L[cur])) return;
      if (v.paused || blocked) { blocked = false; userPaused = false; play(true); } else { userPaused = true; v.pause(); state('paused'); }
    }
    function pick() {
      if (dead || cur < 0) return;
      haptic('medium');
      if (o.onPick) o.onPick(L[cur].id, cur);
    }
    // широкая сцена (шире 2:3) — видео целиком, по бокам размытый кадр; узкая — обрезаем бока (героиня по центру)
    function fit() {
      const r = stage.clientWidth / Math.max(1, stage.clientHeight);
      root.classList.toggle('lk-cover', r < 0.655);
    }

    v.addEventListener('playing', () => { if (!dead) { v.classList.add('on'); state('playing'); } });
    v.addEventListener('pause', () => { if (!dead && userPaused) state('paused'); });
    v.addEventListener('error', () => {
      if (dead || cur < 0 || !v.getAttribute('src')) return;
      const it = L[cur];
      // H.264 не пошёл — пробуем VP9; не пошло и оно — остаётся постер
      if (!tryWebm && it.webm && canWebm && v.getAttribute('src') !== base + it.webm) { tryWebm = true; v.removeAttribute('src'); play(true); return; }
      failed.add(cur); unload(); state('none');
    });

    const idx = () => Math.max(0, Math.min(N - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
    // свайп пальцем — засчитываем по тишине 110 мс или scrollend; есть цель (go) — только проверяем, что стоим на ней
    track.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      if (want >= 0) { scrollT = setTimeout(() => settle(false), 150); return; }
      ui(idx());
      scrollT = setTimeout(() => activate(idx()), 110);
    }, { passive: true });
    if ('onscrollend' in window) track.addEventListener('scrollend', () => { clearTimeout(scrollT); if (want >= 0) settle(false); else activate(idx()); });
    const drop = () => { if (want >= 0) { want = -1; clearTimeout(holdT); } };
    track.addEventListener('touchstart', drop, { passive: true });
    track.addEventListener('wheel', drop, { passive: true });
    prevB.addEventListener('click', e => { e.stopPropagation(); go(cur - 1); });
    nextB.addEventListener('click', e => { e.stopPropagation(); go(cur + 1); });
    thumbs.forEach(t => t.addEventListener('click', () => go(+t.dataset.i)));
    pp.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    big.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    // касание по самому ролику — пауза / дальше (свайп кликом не считается)
    track.addEventListener('click', e => { if (e.target.closest('.lk-slide')) toggle(); });
    cta.addEventListener('click', pick);
    const xB = root.querySelector('#lkx');
    if (xB) xB.addEventListener('click', e => { e.stopPropagation(); haptic('light'); if (o.onClose) o.onClose(); });
    const onKey = e => {
      if (dead || !root.isConnected) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      // поверх — имя следователя или реплика: клавиши принадлежат им
      if (host.querySelector('.lk-sheet') || document.querySelector('#layer .dlg-wrap')) return;
      if (e.key === 'ArrowLeft') { go(cur - 1); e.preventDefault(); } else if (e.key === 'ArrowRight') { go(cur + 1); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); pick(); } else if (e.key === 'Escape' && o.onClose) o.onClose();
    };
    document.addEventListener('keydown', onKey);
    const onVis = () => { if (dead) return; if (document.hidden) v.pause(); else if (!userPaused && !blocked) play(false); };
    document.addEventListener('visibilitychange', onVis);
    const onResize = () => { if (dead) return; fit(); if (cur >= 0) track.scrollLeft = cur * track.clientWidth; };
    window.addEventListener('resize', onResize);

    fit();
    track.scrollLeft = startI * track.clientWidth;
    activate(startI, 'init');
    // один раз подсказать, что образы листаются: стрелка «›» дважды покачивается
    if (!reduced() && startI < N - 1) { nextB.classList.add('nudge'); nudgeT = setTimeout(() => nextB.classList.remove('nudge'), 2400); }

    const api = {
      go, pick, index: () => cur, id: () => L[cur] && L[cur].id,
      pause: () => { try { v.pause(); } catch (e) { /* ignore */ } },
      resume: () => { if (!userPaused && !blocked) play(false); },
      destroy: () => {
        if (dead) return;
        dead = true; clearTimeout(scrollT); clearTimeout(nudgeT); clearTimeout(holdT); unload(); v.remove();
        document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize);
        host.innerHTML = '';
        if (LookPicker.last === api) LookPicker.last = null;
      },
      get dead() { return dead; },
      _video: v, root,
    };
    LookPicker.last = api;
    return api;
  }
  const LookPicker = window.LookPicker = { mount, last: null, items };

  /* ---------- Сценарии ---------- */
  const DARK = '#2F2834', LIGHT = '#FFF4EC';
  function screen() {
    const g = G_();
    g.setHud({ hidden: true }); g.tgHeader(DARK);
    const scr = g.show('<div class="casting lk-screen"></div>', '');
    return scr.querySelector('.lk-screen');
  }

  // шаг 2 кастинга: имя следователя — нижний лист поверх выбранного ролика (ролик продолжает играть)
  function nameSheet(host, id) {
    const g = G_(), st = g.state(), C = g.C || {}, H = HL().get(id), it = items().find(x => x.id === id) || {};
    return new Promise(res => {
      const m = document.createElement('div');
      m.className = 'lk-sheet';
      const nm0 = st.name || g.tgUserFirstName() || C.HER_NAME_DEFAULT || '';
      m.innerHTML = `
        <div class="sheet-card" role="dialog" aria-label="Имя следователя">
          <div class="sheet-head"><div class="sheet-title">Имя следователя</div><button class="sheet-x" type="button" aria-label="Назад к образам">✕</button></div>
          <div class="sheet-body">
            <div class="lk-pick">
              ${it.thumb ? `<div class="ph" style="background-image:url(${it.thumb})" aria-hidden="true"></div>` : ''}
              <div class="toon" aria-hidden="true">${toon(id, { crop: true })}</div>
              <div class="tx"><div class="k">Образ</div><div class="v">${esc(H.name)}</div></div>
              <button class="link lk-change" type="button">сменить</button>
            </div>
            <input class="field" id="nm" maxlength="20" placeholder="Как тебя зовут?" value="${esc(nm0)}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done"/>
            <p class="tiny muted lk-hint">Так тебя будут звать в деле и в титрах.</p>
          </div>
          <div class="sheet-actions"><button class="btn block" type="button" id="next">Всё. Я великолепна</button></div>
        </div>`;
      host.appendChild(m);
      const nm = m.querySelector('#nm');
      // лист поднимается над клавиатурой (как ask() в engine.js)
      const vv = window.visualViewport;
      const lift = () => { if (!vv) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); m.style.paddingBottom = kb + 'px'; };
      if (vv) vv.addEventListener('resize', lift);
      let done = false;
      const fin = v => {
        if (done) return; done = true;
        if (vv) vv.removeEventListener('resize', lift);
        try { nm.blur(); } catch (e) { /* ignore */ }
        m.classList.add('out'); setTimeout(() => m.remove(), 220);
        window.scrollTo(0, 0);
        res(v);
      };
      const back = () => { g.haptic('light'); fin(null); };
      m.querySelector('.sheet-x').addEventListener('click', back);
      m.querySelector('.lk-change').addEventListener('click', back);
      m.addEventListener('click', e => { if (e.target === m) back(); });
      nm.addEventListener('keydown', e => { if (e.key === 'Enter') nm.blur(); });
      m.querySelector('#next').addEventListener('click', () => {
        const v = nm.value.trim();
        if (!v) { nm.focus(); g.toast('У главной героини должно быть имя. Даже у легенды.'); return; }
        fin(v);
      });
    });
  }

  // кастинг: образ -> имя. Итог { id, name } (уже сохранены); дальше ep1.js показывает команду
  function casting(opts = {}) {
    const g = G_(), st = g.state();
    const host = screen();
    return new Promise(res => {
      let busy = false;
      const p = mount(host, {
        mode: 'casting', start: HL().valid(st.look) ? st.look : 0,
        async onPick(id) {
          if (busy) return; busy = true;
          const name = await nameSheet(host, id);
          busy = false;
          if (name == null) return;
          g.setLook(id, { save: false }); st.name = name; g.save();
          g.haptic('medium'); g.sfx('ok');
          p.destroy(); g.tgHeader(LIGHT);
          res({ id, name, recap: !!opts.recap });
        },
      });
    });
  }

  // гардероб для старого сейва (кастинг уже пройден, образа нет): один раз, без имени и без «закрыть»
  function wardrobe(opts = {}) {
    const g = G_();
    const host = screen();
    return new Promise(res => {
      const p = mount(host, {
        mode: opts.mode || 'migrate', start: HL().valid(opts.start) ? opts.start : g.look(),
        onPick(id) {
          g.setLook(id); g.sfx('ok');
          g.toast('Образ сохранён. Город уже оценил.', 2200);
          p.destroy(); g.tgHeader(LIGHT);
          res(id);
        },
      });
    });
  }

  // ателье: карусель поверх комнаты; итог — id образа («Надеть») или null (✕, ушла, пропуск)
  function atelier(ctx, o = {}) {
    const g = G_();
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'lk-ov';
      g.layer.appendChild(ov);
      let done = false, poll = 0, off = () => {}, p = null;
      const fin = id => {
        if (done) return; done = true;
        clearInterval(poll); off();
        // сначала вернуть комнате кадры и HUD — даже если разбор карусели споткнётся
        document.body.classList.remove('lk-on', 'scene-paused');
        try { if (p) p.destroy(); } catch (e) { console.warn('looks destroy', e); }
        ov.remove();
        if (!document.querySelector('#layer .modal.sheet:not(.out)')) document.body.classList.remove('sheet-on');
        g.tgHeader(LIGHT);
        res(id);
      };
      try {
        p = mount(ov, {
          mode: 'atelier', start: g.look(), cta: 'Надеть',
          onChange: o.onChange, onPick: id => fin(id), onClose: () => fin(null),
        });
      } catch (e) { console.warn('looks atelier', e); fin(null); return; }
      // верхняя полоса HUD лежит выше слоя #layer — на время гардероба её прячем (body.lk-on, css/style.css);
      // комната под непрозрачной каруселью не рисуется (body.scene-paused, js/city3d.js): батарея и кадры — ролику
      document.body.classList.add('sheet-on', 'lk-on', 'scene-paused');
      g.tgHeader(DARK);
      off = g.onSkip ? g.onSkip(() => fin(null)) : off;
      // визит закончился (выход, смена сцены) — карусель уходит вместе с ним
      poll = setInterval(() => { if ((ctx && ctx.gone) || !ov.isConnected) fin(null); }, 400);
    });
  }

  window.Looks = { casting, wardrobe, atelier, nameSheet };
})();
