/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: интерфейс поверх 3D (контракт классов §9.2-I world_unify).
   .w-root — корень; .w-case (.w-case-t/.w-case-x/.w-case-d/.w-case-p) — «Сегодняшнее дело»; .w-edge[data-side] — стрелка
   у края (--rot — угол); .w-tag — ярлык метки; .w-act — кнопка действия; .w-wave — 👋; .w-say (.hero) — облачка;
   .w-joy — джойстик; .w-toast — подсказка города; .w-horn «Би-бип» (в машине), .w-bell «Дзынь» (на велосипеде). Стили по умолчанию — здесь, через :where() (вес 0):
   любые правила css/style.css их перекрывают.
   Волна 4: .w-dnbox (справа сверху: по умолчанию — под радаром волны 3, .hdr — под кнопками шапки, если радар в другом углу)
   — чип времени суток .w-dn-i (☀️/🌅/🌙) и кнопка .w-dn-t
   «☀️ Вернуться в утро» / «🕗 Как на часах»; .w-swap «Другая машина» — у стоящей машины, когда можно выбрать
   «Ретро-купе» / «Красный седан». Радар (мини-карта) — свой элемент minimap.js; город сдвигает чип, если радар справа сверху.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const CSS = `
:where(.w-root){position:absolute;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
:where(.w-root) canvas.c3d{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
:where(.w-ui){position:absolute;inset:0;pointer-events:none;z-index:5}
:where(.w-ui) > *{pointer-events:auto}
:where(.w-joy){position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;z-index:20;pointer-events:none!important;background:rgba(255,253,249,.42);box-shadow:inset 0 0 0 3px rgba(255,255,255,.85),0 6px 18px rgba(58,46,63,.12)}
:where(.w-joy) .joy-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:var(--paper,#FFFDF9);box-shadow:0 4px 0 rgba(58,46,63,.18),0 6px 14px rgba(58,46,63,.15)}
:where(.w-joy.ghost){left:86px;top:auto;bottom:calc(32px + var(--safe-bottom,0px));margin:0 0 0 -56px;opacity:.6;animation:wBreathe 2.4s ease-in-out infinite}
@keyframes wBreathe{50%{transform:scale(1.06)}}
:where(.w-act){position:absolute;right:14px;bottom:calc(16px + var(--safe-bottom,0px));height:58px;padding:0 22px;border:0;border-radius:29px;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-size:16px;font-weight:900;box-shadow:0 5px 0 var(--cherry-d,#9E2F47),0 10px 20px rgba(158,47,71,.25);cursor:pointer;z-index:21;max-width:62%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}
:where(.w-act):active{transform:translateY(4px);box-shadow:0 1px 0 var(--cherry-d,#9E2F47)}
:where(.w-act.soft){background:rgba(255,253,249,.95);color:var(--cherry,#C2405B);box-shadow:0 4px 0 rgba(58,46,63,.16)}
:where(.w-wave){position:absolute;right:16px;bottom:calc(88px + var(--safe-bottom,0px));width:54px;height:54px;border:0;border-radius:50%;font-size:26px;background:rgba(255,253,249,.94);box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 18px rgba(58,46,63,.12);cursor:pointer;z-index:21;display:grid;place-items:center;touch-action:manipulation}
:where(.w-wave.go){animation:wWave .8s ease-in-out}
@keyframes wWave{20%{transform:rotate(-18deg)}45%{transform:rotate(16deg)}70%{transform:rotate(-10deg)}}
:where(.w-round){position:absolute;right:18px;width:58px;height:58px;padding:0;white-space:nowrap;border:0;border-radius:50%;background:rgba(255,253,249,.94);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:12.5px;box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 18px rgba(58,46,63,.12);z-index:21;cursor:pointer}
:where(.w-pill){position:absolute;left:50%;transform:translateX(-50%);bottom:calc(92px + var(--safe-bottom,0px));border:0;border-radius:22px;padding:11px 16px;background:var(--paper,#FFFDF9);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:14px;box-shadow:0 4px 0 rgba(58,46,63,.16);z-index:21}
:where(.w-case){position:absolute;left:10px;top:calc(58px + var(--safe-top,0px));max-width:min(64%,250px);padding:8px 11px 9px;border-radius:16px;background:rgba(255,253,249,.94);box-shadow:0 3px 0 rgba(58,46,63,.10),0 8px 18px rgba(58,46,63,.10);z-index:18;cursor:pointer;line-height:1.2;animation:wCaseIn .45s cubic-bezier(.2,1.4,.4,1) both}
@keyframes wCaseIn{from{opacity:0;transform:translateX(-14px)}}
:where(.w-case-t){font-size:11px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--cherry,#C2405B)}
:where(.w-case-x){margin-top:2px;font-size:13.5px;font-weight:800;color:var(--ink,#3A2E3F)}
:where(.w-case-d){margin-top:3px;font-size:12px;font-weight:900;color:var(--ink-2,#6E6272)}
:where(.w-case-p){margin-top:5px;display:flex;gap:4px}
:where(.w-case-p) i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#F2DCE2}
:where(.w-case-p) i.on{background:var(--cherry,#C2405B)}
:where(.w-case-i){margin-right:4px}
:where(.w-case.lock){opacity:.92}
:where(.w-edge){position:absolute;z-index:16;transform:translate(-50%,-50%);background:var(--cherry,#C2405B);color:#fff;font-weight:900;font-size:12.5px;padding:7px 10px;border-radius:12px;box-shadow:0 3px 0 var(--cherry-d,#9E2F47);white-space:nowrap;pointer-events:none!important;display:flex;align-items:center;gap:6px}
:where(.w-edge) i{display:inline-block;font-style:normal;transform:rotate(var(--rot,0deg));line-height:1}
:where(.w-tag){position:absolute;z-index:14;transform:translate(-50%,-100%);background:#fff;color:var(--ink,#3A2E3F);font-weight:900;font-size:12px;padding:5px 9px;border-radius:11px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap;pointer-events:none!important}
:where(.w-near){position:absolute;z-index:13;transform:translate(-50%,-100%);background:#fff;color:var(--ink,#3A2E3F);font-weight:900;font-size:12.5px;padding:6px 10px;border-radius:12px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap;pointer-events:none!important}
:where(.w-say){position:absolute;left:0;top:0;max-width:230px;padding:7px 11px;border-radius:14px;background:#fff;color:var(--ink,#3A2E3F);font-size:13px;font-weight:800;line-height:1.3;box-shadow:0 3px 0 rgba(58,46,63,.12);opacity:0;transition:opacity .25s;text-align:center;pointer-events:none!important;z-index:12}
:where(.w-say.on){opacity:1}
:where(.w-say)::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#fff}
:where(.w-say) b{display:block;font-size:11px;color:var(--cherry,#C2405B);letter-spacing:.02em}
:where(.w-say.hero){background:#FFF0F3;color:#9E2F47}
:where(.w-say.hero)::after{border-top-color:#FFF0F3}
:where(.w-hint){position:absolute;left:12px;bottom:calc(284px + var(--safe-bottom,0px));max-width:min(46%,176px);z-index:20;background:rgba(58,46,63,.86);color:#fff;font-weight:800;font-size:13px;line-height:1.3;padding:8px 12px;border-radius:12px;white-space:normal;pointer-events:none!important;transition:opacity .9s}
:where(.w-hint.off){opacity:0}
:where(.w-toast){position:absolute;left:50%;top:calc(64px + var(--safe-top,0px));transform:translateX(-50%);z-index:22;background:var(--ink,#3A2E3F);color:#fff;font-weight:800;font-size:14px;padding:10px 16px;border-radius:14px;max-width:86%;text-align:center;pointer-events:none!important}
:where(.w-loading){position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:linear-gradient(180deg,#F3D9E6 0%,#FFF4EC 70%);transition:opacity .5s}
:where(.w-loading.done){opacity:0;pointer-events:none}
:where(.w-loading) .ld{text-align:center;padding:24px}
:where(.w-loading) .ld-t{font-family:var(--font-title,inherit);font-weight:700;font-size:22px;color:var(--cherry,#C2405B)}
:where(.w-loading) .ld-m{margin-top:14px;font-weight:800;font-size:14px;color:var(--ink-2,#6E6272)}
:where(.w-loading) .ld-b{margin:12px auto 0;width:190px;height:10px;border-radius:99px;background:#F2DCE2;overflow:hidden}
:where(.w-loading) .ld-b i{display:block;height:100%;width:0;background:var(--cherry,#C2405B);border-radius:99px;transition:width .3s}
:where(.w-dnbox){position:absolute;right:12px;top:calc(168px + var(--safe-top,0px));transition:top .22s ease;z-index:17;display:flex;flex-direction:row-reverse;align-items:center;gap:6px;pointer-events:none!important}
:where(.w-dnbox) > *{pointer-events:auto}
:where(.w-dnbox.hdr){top:calc(62px + var(--safe-top,0px))}
:where(.w-dn-i){width:36px;height:36px;padding:0;border:0;border-radius:50%;background:rgba(255,253,249,.94);font-size:18px;line-height:36px;text-align:center;box-shadow:0 3px 0 rgba(58,46,63,.12);cursor:pointer;touch-action:manipulation}
:where(.w-dn-t){height:36px;padding:0 12px;border:0;border-radius:18px;background:rgba(255,253,249,.96);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:13px;white-space:nowrap;box-shadow:0 3px 0 rgba(58,46,63,.14);cursor:pointer;touch-action:manipulation}
:where(.w-dnbox.night) .w-dn-i{background:#2C366A;box-shadow:0 3px 0 rgba(10,12,26,.35),inset 0 0 0 2px rgba(255,244,214,.35)}
:where(.w-swap){position:absolute;right:14px;bottom:calc(390px + var(--safe-bottom,0px));height:42px;padding:0 14px;border:0;border-radius:21px;background:rgba(255,253,249,.95);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:13.5px;white-space:nowrap;box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 18px rgba(58,46,63,.12);z-index:21;cursor:pointer;touch-action:manipulation}
:where(.w-root.busy) .w-swap{display:none!important}
:where(.w-root.busy) .w-joy,:where(.w-root.busy) .w-act,:where(.w-root.busy) .w-wave,:where(.w-root.busy) .w-round,:where(.w-root.busy) .w-pill,:where(.w-root.busy) .w-near{display:none!important}
/* волна 5: правый столбик кнопок (снизу вверх, всё у правого края, над джойстиком и радаром слева не заходит):
   действие .w-act (16) · 👋 (88) · ряд «Прыжок» 80 + «Бег» 64 (150) · «Бум!»/«Бупнуть»/«Пиу!» 62 (242) · «Листья» 62 (316) ·
   «🚗 Другая машина» (390). В машине и на велосипеде ряд Move и «Бум!» спрятаны — там «Би-бип» (150), «цвет» (216), «Дзынь» (88). */
.w-ui .mv-btns{right:14px;bottom:calc(150px + var(--safe-bottom,0px));z-index:21}
.w-ui .pf-btn{right:23px;bottom:calc(242px + var(--safe-bottom,0px));z-index:21}
.w-ui .pf-btn.pf-toss{bottom:calc(316px + var(--safe-bottom,0px))}
:where(.w-root.busy) .mv-btns,:where(.w-root.busy) .pf-btn,:where(.w-root.busy) .pf-chip{display:none!important}
`;
  function ensureCss() {
    if (document.getElementById('wUiCss')) return;
    const st = document.createElement('style'); st.id = 'wUiCss'; st.textContent = CSS;
    document.head.insertBefore(st, document.head.firstChild);   // раньше style.css: при равном весе правила игры главнее
  }

  WORLD.makeUI = function (root) {
    ensureCss();
    const ui = document.createElement('div'); ui.className = 'w-ui';
    ui.innerHTML = `
      <div class="w-bubbles"></div>
      <div class="w-near hidden"></div>
      <div class="w-tag hidden"></div>
      <div class="w-edge hidden"><span></span></div>
      <div class="w-case hidden"><div class="w-case-t"></div><div class="w-case-x"></div><div class="w-case-d"></div><div class="w-case-p"></div></div>
      <div class="w-joy joy hidden"><div class="joy-knob"></div></div>
      <div class="w-joy joy ghost hidden"><div class="joy-knob"></div></div>
      <button class="w-act hidden" type="button"></button>
      <button class="w-wave hidden" type="button" aria-label="Помахать">👋</button>
      <button class="w-round w-horn hidden" type="button" style="bottom:calc(150px + var(--safe-bottom,0px))">Би-бип</button>
      <button class="w-round w-bell hidden" type="button" style="bottom:calc(88px + var(--safe-bottom,0px))" aria-label="Звонок">Дзынь</button>
      <button class="w-round w-color hidden" type="button" style="bottom:calc(216px + var(--safe-bottom,0px));width:48px;height:48px;right:23px;font-size:11px">цвет</button>
      <button class="w-pill w-reset hidden" type="button">Поставить на дорогу</button>
      <button class="w-swap hidden" type="button">🚗 Другая машина</button>
      <div class="w-dnbox hidden"><button class="w-dn-i" type="button" aria-label="Время суток">☀️</button><button class="w-dn-t hidden" type="button"></button></div>
      <div class="w-hint hidden"></div>`;
    root.appendChild(ui);
    const $ = s => ui.querySelector(s);
    const R = {
      ui, bubbles: $('.w-bubbles'), near: $('.w-near'), tag: $('.w-tag'), edge: $('.w-edge'), edgeTx: $('.w-edge span'),
      card: $('.w-case'), cardT: $('.w-case-t'), cardX: $('.w-case-x'), cardD: $('.w-case-d'), cardP: $('.w-case-p'),
      joy: $('.w-joy:not(.ghost)'), knob: $('.w-joy:not(.ghost) .joy-knob'), ghost: $('.w-joy.ghost'),
      act: $('.w-act'), wave: $('.w-wave'), horn: $('.w-horn'), bell: $('.w-bell'), color: $('.w-color'), reset: $('.w-reset'), hint: $('.w-hint'),
      swap: $('.w-swap'), dnBox: $('.w-dnbox'), dnIcon: $('.w-dn-i'), dnText: $('.w-dn-t'),
    };
    const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
    let actNow = null;
    R.setAct = (label, soft) => {
      const key = label ? label + (soft ? '~' : '') : '';
      if (key === actNow) return; actNow = key;
      R.act.textContent = label || ''; R.act.classList.toggle('soft', !!soft); show(R.act, !!label);
    };
    R.setCase = card => {
      if (!card) { show(R.card, false); return; }
      R.cardT.innerHTML = ''; const ic = document.createElement('span'); ic.className = 'w-case-i'; ic.textContent = card.icon || '🔍'; R.cardT.appendChild(ic); R.cardT.appendChild(document.createTextNode(card.title || 'Сегодняшнее дело'));
      R.cardX.textContent = card.text || '';
      const p = card.progress;
      R.cardP.innerHTML = p && p[1] ? Array.from({ length: p[1] }, (_, i) => `<i class="${i < p[0] ? 'on' : ''}"></i>`).join('') : '';
      R.card.classList.toggle('lock', !!card.lock); R.card.dataset.tap = card.tap || (card.door ? 'focus' : 'none');
      show(R.cardP, !!(p && p[1])); R.cardD.textContent = ''; show(R.cardD, false);
      show(R.card, true);
    };
    R.setDist = m => { if (m == null) { show(R.cardD, false); return; } R.cardD.textContent = m < 4 ? 'ты на месте' : Math.round(m) + ' м'; show(R.cardD, true); };
    R.setEdge = (on, x, y, side, rot, txt) => {
      if (!on) { show(R.edge, false); return; }
      R.edge.dataset.side = side; R.edge.style.left = x + 'px'; R.edge.style.top = y + 'px';
      R.edge.style.setProperty('--rot', rot + 'deg');
      R.edgeTx.innerHTML = '';
      const i = document.createElement('i'); i.textContent = '➜'; const s = document.createElement('span'); s.textContent = txt;
      if (side === 'l') { R.edgeTx.appendChild(i); R.edgeTx.appendChild(s); } else { R.edgeTx.appendChild(s); R.edgeTx.appendChild(i); }
      show(R.edge, true);
    };
    // день/ночь (волна 4): icon — значок фазы, text — подпись кнопки («☀️ Вернуться в утро» / «🕗 Как на часах») или '' — без неё
    let dnNow = null;
    R.setDayNight = (on, icon, text, night) => {
      const key = on ? icon + '|' + (text || '') + '|' + (night ? 1 : 0) : '';
      if (key === dnNow) return; dnNow = key;
      show(R.dnBox, !!on); if (!on) return;
      R.dnIcon.textContent = icon; R.dnText.textContent = text || ''; show(R.dnText, !!text);
      R.dnBox.classList.toggle('night', !!night);
    };
    R.placeDayNight = (top, hdr) => { R.dnBox.style.top = top == null ? '' : Math.round(top) + 'px'; if (hdr !== undefined) R.dnBox.classList.toggle('hdr', !!hdr); };
    R.setTag = (on, x, y, txt) => { if (!on || !txt) { show(R.tag, false); return; } R.tag.textContent = txt; R.tag.style.left = x + 'px'; R.tag.style.top = y + 'px'; show(R.tag, true); };
    R.setNear = (on, x, y, txt) => { if (!on || !txt) { show(R.near, false); return; } R.near.textContent = txt; R.near.style.left = x + 'px'; R.near.style.top = y + 'px'; show(R.near, true); };
    let hintT = 0;
    R.hintShow = (txt, ms = 4800) => { R.hint.textContent = txt; R.hint.classList.remove('off'); show(R.hint, true); clearTimeout(hintT); hintT = setTimeout(() => R.hint.classList.add('off'), ms); };
    R.hintOff = () => { clearTimeout(hintT); show(R.hint, false); };
    // облачка над героями: obj.getPos(v) → мировая точка над головой
    const SAY = [];
    R.say = (obj, html, ms, cls) => {
      let b = SAY.find(s => s.obj === obj);
      if (!b) { const el = document.createElement('div'); el.className = 'w-say'; R.bubbles.appendChild(el); b = { el, obj }; SAY.push(b); }
      b.el.className = 'w-say' + (cls ? ' ' + cls : '');
      b.el.innerHTML = html; b.until = performance.now() + ms; b.el.classList.add('on');
      return b;
    };
    R.sayClear = () => { SAY.forEach(b => { b.until = 0; b.el.classList.remove('on'); }); };
    R.sayList = () => SAY.filter(b => performance.now() < b.until).map(b => b.el.textContent);
    R.placeSay = (project, w, h) => {
      const now = performance.now();
      SAY.forEach(b => {
        if (now > b.until) { b.el.classList.remove('on'); return; }
        const p = project(b.obj);
        if (!p || p.x < -40 || p.x > w + 40 || p.y < 30 || p.y > h + 40) { b.el.style.opacity = 0; return; }
        b.el.style.opacity = '';
        const hw = (b.el.offsetWidth || 180) / 2 + 8;
        b.el.style.transform = `translate(${Math.max(hw, Math.min(w - hw, p.x))}px, ${Math.max(70, Math.min(h - 40, p.y))}px) translate(-50%, -100%)`;
      });
    };
    R.show = show;
    return R;
  };
  WORLD.uiCss = ensureCss;
})();
