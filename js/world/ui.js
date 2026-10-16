/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: интерфейс поверх 3D (контракт классов §9.2-I world_unify) — HUD v2 (plan2/hud_spec.md, общий модуль js/world/hud.js).
   .w-root — корень; .w-act — главная кнопка P справа внизу (значок + слово, полная подпись — aria-label; без действия — 👋 «Помахать»);
   дуга маленьких кнопок 46 px (data-hud-slot s1…s4): в машине .w-horn 📯 (s1), .w-color 🎨 (s2), .w-reset 🛟 (s3), на велосипеде
   .w-bell 🔔 (s1), пешком — «Прыжок»/«Бег» (move.js) и «Бум!»/«Листья» (playfight.js); .w-swap «🔁 Другая машина» — пилюля A2 над дугой;
   .w-joy.hud-joy — джойстик снизу по центру (HUD.joystick: в покое — кружок, под пальцем — плавающий); .w-edge.hud-chev — шеврон у края
   с расстоянием; .w-tag — ярлык метки; .w-near — подпись у двери; .w-say (.hero) — облачка. Карточка дела — пилюля цели в верхней
   полосе (HUD.objective; ui.setCase/setDist — прежние имена); день и ночь — строка меню ☰ (ui.setDayNight хранит состояние);
   подсказки управления — тостом (ui.hintShow). Стили по умолчанию — здесь, через :where() (вес 0): правила css/style.css главнее.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const CSS = `
:where(.w-root){position:absolute;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
:where(.w-root) canvas.c3d{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
:where(.w-ui){position:absolute;inset:0;pointer-events:none;z-index:5}
:where(.w-ui) > *{pointer-events:auto}
:where(.w-act){position:absolute;right:12px;bottom:calc(12px + var(--safe-bottom,0px));width:64px;height:64px;padding:0;border:0;border-radius:50%;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-weight:900;box-shadow:0 5px 0 var(--cherry-d,#9E2F47),0 10px 20px rgba(158,47,71,.25);cursor:pointer;z-index:21;touch-action:manipulation}
:where(.w-act):active{transform:translateY(4px);box-shadow:0 1px 0 var(--cherry-d,#9E2F47)}
:where(.w-act.soft){background:rgba(255,253,249,.95);color:var(--cherry,#C2405B);box-shadow:0 4px 0 rgba(58,46,63,.16)}
@keyframes wWave{20%{transform:rotate(-18deg)}45%{transform:rotate(16deg)}70%{transform:rotate(-10deg)}}
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
:where(.w-tag){position:absolute;z-index:14;transform:translate(-50%,-100%);background:#fff;color:var(--ink,#3A2E3F);font-weight:900;font-size:12px;padding:5px 9px;border-radius:11px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap;pointer-events:none!important}
:where(.w-near){position:absolute;z-index:13;transform:translate(-50%,-100%);background:#fff;color:var(--ink,#3A2E3F);font-weight:900;font-size:12.5px;padding:6px 10px;border-radius:12px;box-shadow:0 3px 0 rgba(58,46,63,.12);white-space:nowrap;pointer-events:none!important}
:where(.w-say){position:absolute;left:0;top:0;max-width:230px;padding:7px 11px;border-radius:14px;background:#fff;color:var(--ink,#3A2E3F);font-size:13px;font-weight:800;line-height:1.3;box-shadow:0 3px 0 rgba(58,46,63,.12);opacity:0;transition:opacity .25s;text-align:center;pointer-events:none!important;z-index:12}
:where(.w-say.on){opacity:1}
:where(.w-say)::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#fff}
:where(.w-say) b{display:block;font-size:11px;color:var(--cherry,#C2405B);letter-spacing:.02em}
:where(.w-say.hero){background:#FFF0F3;color:#9E2F47}
:where(.w-say.hero)::after{border-top-color:#FFF0F3}
:where(.w-toast){position:absolute;left:50%;top:calc(64px + var(--safe-top,0px));transform:translateX(-50%);z-index:22;background:var(--ink,#3A2E3F);color:#fff;font-weight:800;font-size:14px;padding:10px 16px;border-radius:14px;max-width:86%;text-align:center;pointer-events:none!important}
:where(.w-loading){position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:linear-gradient(180deg,#F3D9E6 0%,#FFF4EC 70%);transition:opacity .5s}
:where(.w-loading.done){opacity:0;pointer-events:none}
:where(.w-loading) .ld{text-align:center;padding:24px}
:where(.w-loading) .ld-t{font-family:var(--font-title,inherit);font-weight:700;font-size:22px;color:var(--cherry,#C2405B)}
:where(.w-loading) .ld-m{margin-top:14px;font-weight:800;font-size:14px;color:var(--ink-2,#6E6272)}
:where(.w-loading) .ld-b{margin:12px auto 0;width:190px;height:10px;border-radius:99px;background:#F2DCE2;overflow:hidden}
:where(.w-loading) .ld-b i{display:block;height:100%;width:0;background:var(--cherry,#C2405B);border-radius:99px;transition:width .3s}
:where(.w-root.busy) .w-swap{display:none!important}
:where(.w-root.busy) .w-joy,:where(.w-root.busy) .w-act,:where(.w-root.busy) .hud-sbtn,:where(.w-root.busy) .hud-a2,:where(.w-root.busy) .w-near{display:none!important}
/* HUD v2: кнопки Move и PlayFight встают в слоты дуги (data-hud-slot, style.css); контейнер .mv-btns — display: contents */
:where(.w-root.busy) .mv-btns,:where(.w-root.busy) .pf-btn,:where(.w-root.busy) .pf-chip{display:none!important}
`;
  function ensureCss() {
    if (document.getElementById('wUiCss')) return;
    const st = document.createElement('style'); st.id = 'wUiCss'; st.textContent = CSS;
    document.head.insertBefore(st, document.head.firstChild);   // раньше style.css: при равном весе правила игры главнее
  }

  WORLD.makeUI = function (root) {
    ensureCss();
    const HUD = window.HUD || null;
    if (HUD) WORLD.hud = HUD;
    const ui = document.createElement('div'); ui.className = 'w-ui';
    ui.innerHTML = `
      <div class="w-bubbles"></div>
      <div class="w-near hidden"></div>
      <div class="w-tag hidden"></div>
      <div class="w-edge hud-chev hidden" aria-hidden="true"></div>
      <button class="w-act hud-act hidden" type="button" data-hud-slot="P"></button>
      <button class="hud-sbtn w-horn hidden" type="button" data-hud-slot="s1" aria-label="Би-бип" title="Би-бип"><i aria-hidden="true">📯</i></button>
      <button class="hud-sbtn w-bell hidden" type="button" data-hud-slot="s1" aria-label="Дзынь" title="Дзынь"><i aria-hidden="true">🔔</i></button>
      <button class="hud-sbtn w-color hidden" type="button" data-hud-slot="s2" aria-label="Цвет машины" title="Цвет машины"><i aria-hidden="true">🎨</i></button>
      <button class="hud-sbtn w-reset hidden" type="button" data-hud-slot="s3" aria-label="Поставить на дорогу" title="Поставить на дорогу"><i aria-hidden="true">🛟</i></button>
      <button class="hud-a2 w-swap hidden" type="button" data-hud-slot="a2" aria-label="Другая машина"><i aria-hidden="true">🔁</i><span>Другая машина</span></button>`;
    root.appendChild(ui);
    const $ = s => ui.querySelector(s);
    // джойстик (HUD.joystick): один элемент — в покое кружок снизу по центру, под пальцем — плавающий
    const joyCtl = HUD ? HUD.joystick.create(ui, { root }) : null;
    const R = {
      ui, bubbles: $('.w-bubbles'), near: $('.w-near'), tag: $('.w-tag'), edge: $('.w-edge'),
      joyCtl, joy: joyCtl ? joyCtl.el : null, knob: joyCtl ? joyCtl.knob : null, ghost: joyCtl ? joyCtl.el : null,
      act: $('.w-act'), horn: $('.w-horn'), bell: $('.w-bell'), color: $('.w-color'), reset: $('.w-reset'), swap: $('.w-swap'),
      // совместимость: отдельной 👋 больше нет — это та же главная кнопка P (без действия — «Помахать»)
      wave: $('.w-act'),
      card: null, onCaseTap: null,
    };
    const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
    let actNow = null;
    // главная кнопка P: значок + слово (HUD.paintAct), полная подпись — aria-label/title/data-full
    R.setAct = (label, soft) => {
      const key = label ? label + (soft ? '~' : '') : '';
      if (key === actNow) return; actNow = key;
      if (label) { if (HUD) HUD.paintAct(R.act, label, soft); else { R.act.textContent = label; R.act.classList.toggle('soft', !!soft); } }
      R.act.dataset.label = label || '';
      show(R.act, !!label);
    };
    R.actLabel = () => R.act.dataset.label || '';
    // карточка дела → пилюля цели в верхней полосе (тап — карточка, тап по карточке — R.onCaseTap); «Следующее дело» — строка в шапке меню
    let caseNow = null;
    R.setCase = card => {
      caseNow = card || null;
      if (!HUD) return;
      if (!card) { HUD.objective.set(null); HUD.menu.note(null); return; }
      if (card.lock || card.tap === 'none' && !card.door) {
        HUD.objective.set(null);
        HUD.menu.note(`${card.icon || '🔒'} ${card.title || 'Следующее дело'}: ${card.text || ''}`);
        return;
      }
      HUD.menu.note(null);
      const short = card.short || String(card.text || '').split(/[:·—]/)[0].trim() || card.title || 'Дело';
      HUD.objective.set({
        icon: card.icon || '🔍', text: short, title: card.title || 'Сегодняшнее дело', full: card.text || '', progress: card.progress || null,
        expand: card.expand, onTap: () => { if (R.onCaseTap) R.onCaseTap(caseNow); },
      });
    };
    R.caseNow = () => caseNow;
    R.setDist = m => { if (HUD) HUD.objective.dist(m == null ? null : m); };
    // стрелка у края → шеврон с расстоянием (имя — в пилюле цели)
    R.setEdge = (on, x, y, side, rot, txt, dist) => {
      if (!on) { show(R.edge, false); return; }
      if (dist === undefined && txt) { const m = String(txt).match(/(\d+)\s*м\b/); dist = m ? +m[1] : null; }
      if (HUD) HUD.chev(R.edge, { on: true, x, y, side, rot, dist, label: txt || '' });
      else { R.edge.textContent = txt || '➜'; R.edge.style.left = x + 'px'; R.edge.style.top = y + 'px'; show(R.edge, true); }
    };
    // день/ночь (волна 4) — строка меню ☰ (город регистрирует её сам через DayNight.menuItem); здесь — только состояние
    R.dn = { on: false, icon: '☀️', text: '', night: false };
    R.setDayNight = (on, icon, text, night) => { R.dn = { on: !!on, icon: icon || '☀️', text: text || '', night: !!night }; };
    R.placeDayNight = () => {};
    // ярлыки — по высоте не выше строки тоста и не ниже кластера/джойстика (HUD.labelY)
    const ly = (y, H) => (HUD ? HUD.labelY(y, H || root.clientHeight) : y);
    // по ширине — целиком на экране (ярлык двери у самого края не уезжает за него)
    const lx = (el, x) => { const W = root.clientWidth || 390, hw = (el.offsetWidth || 90) / 2 + 8; return Math.max(hw, Math.min(W - hw, x)); };
    const label = (el, on, x, y, txt) => {
      if (!on || !txt) { show(el, false); return; }
      if (el.textContent !== txt) el.textContent = txt;
      show(el, true);
      el.style.left = Math.round(lx(el, x)) + 'px'; el.style.top = Math.round(ly(y)) + 'px';
    };
    R.setTag = (on, x, y, txt) => label(R.tag, on, x, y, txt);
    R.setNear = (on, x, y, txt) => label(R.near, on, x, y, txt);
    // подсказки управления — тостом
    R.hintShow = (txt, ms = 4000) => { if (HUD) HUD.toast(txt, ms); else if (window.G) G.toast(txt, ms); };
    R.hintOff = () => {};
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
        b.el.style.transform = `translate(${Math.max(hw, Math.min(w - hw, p.x))}px, ${Math.round(ly(p.y, h))}px) translate(-50%, -100%)`;
      });
    };
    R.show = show;
    return R;
  };
  WORLD.uiCss = ensureCss;
})();
