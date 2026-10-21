/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: загрузчик регионов (волна 3, REGION; волна 4B — проводка гор из стенда village.html).
   Поездка из города наверх и назад: серпантин (героиня за рулём, без помощников; «Выйти» где угодно, пройтись,
   сесть на лавочку, «Сесть за руль») → развилка: ветка к «Отелю на вершине» (двор, бассейн за стеклом, мини-гольф,
   падел и мини-футбол, купели, костёр, смотровая) и зиплайн оттуда — в село; или ворота села → в село (каз по
   приезде, базарная площадь и лавки, пекарня — хлеб из лап зайки, родник с крышкой — вода из ладошек, свадьба
   с пальтарами, лестница в башне, коровья тропа) → вниз по серпантину → город.
   Регионы строит js/village/** (VILLAGE.regions.<id>.build → handle, см. js/village/README.md); здесь — всё, что
   нужно игре: облачная шторка, своя петля кадров на том же рендерере, героиня и машина города, ходьба/езда, камера,
   руки (js/interact.js), день и ночь (js/daynight.js), жители (G.say + голоса), места, выходы между регионами.

   Как устроено (почему так):
     • Город на паузе, а не разобран: регион живёт в СВОЕЙ сцене со своей камерой; сцена города не рисуется, но
       остаётся в памяти видеокарты. Слабый телефон (WorldHub._lowMem()) — интегратор отпускает видеокарту города и
       передаёт renderer: null: регион рисует на своём холсте, а при возврате город сам загружается в новый.
     • Петля кадров своя (как у комнат): город остановлен (loopStop + bindInput(false) — делает интегратор).
       Порядок кадра (как в стенде village.html): шаг (ходьба / лестница / машина) → HeroAnim (+ слой рук: animState)
       → IA.update → стойка гольфа → каз → зверята → тень-формы → камера → h.update → события региона → DayNight.update
       → render. Пока идёт зиплайн — только ride.update, h.update, DayNight и render.
     • Героиня и машина — те же объекты, что в городе (их корни переезжают в сцену региона вместе с котом и собачкой
       на заднем диванчике). На серпантине героиня за рулём (VILLAGE.drive: heroIn/heroOut, поза водителя из
       drv.animState(), ввод — только игрока через drive.touchInput), зверята ждут в машине; в селе и в отеле
       выпрыгивают и ходят за ней (ждут у машины, у лавки, у башни). Машина — выбранная в городе (refs.car или
       WORLD.carChoice() → VEHICLES.sedan); у городского купе свои размеры, у седана — car.driveCfg.
     • Руки — один слой Interact на героиню на всю игру: Interact.create на ту же модель отдаёт ручку общего слоя
       (interact.js), WORLD.heroHands держит одну ручку региона на героиню и перепривязывает ей сцену, setRoot и
       события; лупа-кость и копия геометрии создаются один раз (городом).
     • Каз — по CONFIG.KAZ_ON_ARRIVAL ('auto' | 'offer' | 'off'), снимается всегда при уходе из села (и при
       выгрузке, возврате в город, потере контекста): сетка героини общая с городом.

   API
     WORLD.Regions.can() → bool — есть модули села и WebGL
     WORLD.Regions.unlocked({ vehicles }) → bool — поездка открыта тогда же, когда машина ('drive' / не под замком)
     WORLD.Regions.settings() → { named, season } — CONFIG.VILLAGE_NAMED (по умолчанию true), CONFIG.VILLAGE_SEASON
     WORLD.Regions.create(refs) → R
       refs = { THREE, renderer (рендерер города или null — свой), host, hero (W.hero), car (W.car — машина города:
         купе WORLD.makeCar или седан VEHICLES.sedan.makeCar; без неё — своя по WORLD.carChoice()), carKind? ('coupe' |
         'sedan'), kit (W.H), layout (WORLD.LAYOUT), quality ('lite'|'low'|'mid'|'high'), regionQ?, named, season,
         pets? ({ cat: { root, body, tail, head }, dog: companion | { root, I } } — кто едет сзади; без них — найдутся на
         заднем диванчике машины), kaz? ('auto'|'offer'|'off'), say, sheet, toast, voice, setHud, haptic, sfx, onEvent }
       R.trip({ from }) → Promise<ret> — вся поездка. ret = { inCar, car: {x,z,ry}, hero: {x,z,ry}, x, z, ry,
         trip: {up, village, down, hotel, zip}, fallback? ('2d') }
       R.enter(id, from) → Promise — 'serpentine' | 'kubachi' | 'hotel'
       R.leave(to) → Promise<ret|undefined> — 'city' (конец поездки) или id другого региона
       R.active(), R.region(), R.handle(), R.info(), R.mapInfo() (данные для радара), R.dispose()
     WORLD.heroHands(hero, { THREE, scene, setRoot, on, gradientMap }) → IA — слой рук героини (создать или перепривязать)
     Радар (MAP, js/world/minimap.js): если есть WORLD.Minimap.region(o) → { update(dt), dispose() } — регион зовёт его
       при каждой загрузке: o = { host, layer, rid, handle, named, season, info: () => R.mapInfo(), getHero, getCamYaw,
       getVehicles, pois } (см. plan2/wave4b_region.md, NEEDS MAP).
     События (refs.onEvent и window 'region:*'): region:enter {id, from, buildMs}, region:leave {id, to},
       region:talk {npc}, region:spot {id, kind}, region:trip {phase: 'start'|'end'}, region:car {mode: 'out'|'in'},
       region:kaz {worn}, region:zip {phase}.
   Отладка (?debug=1, в --prod вырезается): window.__region — см. конец файла.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI, TAU = PI * 2;
  const DEBUG = /debug=1/.test(location.search);
  const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G_ = () => window.G || null;
  const V_ = () => window.VILLAGE || null;
  const blocked = () => !!document.querySelector('#layer .dlg-wrap, #layer .modal, .img-full, .wr-sheet');
  const HUD_ = () => (window.HUD && window.HUD.v ? window.HUD : null);   // HUD v2 (js/world/hud.js); без него — прежний интерфейс
  const emitWin = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* старый браузер */ } };

  /* ---------- настройки: название и сезон ---------- */
  function settings(now) {
    const C = window.CONFIG || {};
    const named = C.VILLAGE_NAMED === undefined ? true : !!C.VILLAGE_NAMED;
    let season = C.VILLAGE_SEASON === 'winter' || C.VILLAGE_SEASON === 'autumn' ? C.VILLAGE_SEASON : null;
    if (!season) { const d = now || new Date(), m = d.getMonth(); season = d >= new Date('2026-12-01T00:00') && (m === 11 || m <= 1) ? 'winter' : 'autumn'; }
    return { named, season };
  }
  function haveModules() { const V = V_(); return !!(window.THREE && V && V.regions && V.regions.serpentine && V.regions.kubachi && V.drive && V.regions.serpentine.build && V.regions.kubachi.build); }
  let glOk = null;
  function can() {
    if (!haveModules()) return false;
    if (glOk === null) { try { const c = document.createElement('canvas'); glOk = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { glOk = false; } }
    return glOk;
  }
  // открыта ли поездка: по состоянию машины в отрезке ({ vehicles }), иначе — CONFIG.UNLOCK.trip (Missions.unlock), иначе — общий замок машины
  function unlocked(o = {}) {
    if (o.vehicles) return o.vehicles === 'drive';
    try { if (window.Missions && Missions.unlock) return !!Missions.unlock('trip').ok; } catch (e) { /* ниже */ }
    try { if (WORLD.Car && WORLD.Car.isLocked) return !WORLD.Car.isLocked(); } catch (e) { /* ignore */ }
    return true;
  }
  // отель и зиплайн открываются вместе с поездкой (CONFIG.UNLOCK: hotel: 'trip', zipline: 'trip'). Закрыты, только если у них
  // своя, более поздняя дата, чем у родителя: если закрыт сам родитель, а поездка всё же идёт (предпросмотр, отладка) — как он
  function featureLock(key, parent) {
    const OPEN = { ok: true, text: '' };
    try {
      const U = window.CONFIG && CONFIG.UNLOCK;
      if (!U || U[key] === undefined || !window.Missions || !Missions.unlock) return OPEN;
      const r = Missions.unlock(key); if (r.ok) return OPEN;
      if (parent && !Missions.unlock(parent).ok) return OPEN;
      return { ok: false, text: r.text || 'Пока закрыто.' };
    } catch (e) { return OPEN; }
  }
  const hotelLock = () => featureLock('hotel', 'trip');
  const zipLock = () => featureLock('zipline', 'hotel');
  // указатель на выезде из города (map.js): «<название села> ↑»; при CONFIG.VILLAGE_NAMED = false — «В горы ↑»
  function signLabel() {
    if (!haveModules()) return null;
    const V = V_(), k = V.regions.kubachi;
    if (settings().named && k && typeof k.title === 'function') return k.title(true) + ' ↑';
    return 'В горы ↑';
  }

  /* ---------- руки героини: одна ручка региона на общий слой Interact ----------
     Interact.create на ту же модель отдаёт ручку общего слоя (кость лупы и копия геометрии — один раз, у первого);
     setRoot / on / scene идут той ручке, что последней звала update / play. Регион держит свою ручку на героиню
     (hero._hands) всю игру, а сцена, setRoot и события читаются через привязку B (перепривязка на каждую поездку).
     Со старым interact.js без общего слоя ручка чужого слоя (hero.ia) лупу второй раз не трогает (pocket: false). */
  function heroHands(hero, ctx) {
    if (!hero || !hero.rig || !hero.rig.anim || !hero.root || !window.Interact || !Interact.create) return null;
    let H = hero._hands;
    if (!H) {
      const T = (ctx && ctx.THREE) || window.THREE;
      const B = { scene: null, setRoot: null, on: null, gradientMap: null };
      const foreign = !!(hero.ia && !hero.ia._shared);   // чужой слой (создан мимо heroHands): лупу второй раз не трогаем
      const o = {
        THREE: T, anim: hero.rig.anim, heroRoot: hero.root,
        get scene() { return B.scene; }, get gradientMap() { return B.gradientMap; },
        setRoot: (p, yaw) => { if (B.setRoot) B.setRoot(p, yaw); },
        on: (n, d) => { if (B.on) B.on(n, d); },
      };
      if (foreign) o.pocket = false;
      let ia = null;
      try { ia = Interact.create(o); } catch (e) { console.warn('heroHands', e); ia = null; }
      if (!ia) return null;
      ia._shared = true;
      H = hero._hands = { ia, B, foreign };
    }
    if (ctx) ['scene', 'setRoot', 'on', 'gradientMap'].forEach(k => { if (k in ctx) H.B[k] = ctx[k]; });
    return H.ia;
  }
  heroHands.binding = hero => (hero && hero._hands ? Object.assign({}, hero._hands.B) : null);
  WORLD.heroHands = heroHands;

  /* ---------- стиль: шторка-облака, педали, лист-запас, мастерская, волна 4 (каз, «Хоп!», зиплайн, гольф) ----------
     HUD v2 (REGION-HUD): места кнопок — общие слоты и токены css/style.css ([data-hud-slot], --hud-*; js/world/hud.js), здесь —
     только своё гор: педали (газ — в углу главной кнопки, тормоз — над ним), «Хоп!» и «Зажми и держи» — на месте джойстика,
     что прятать в каком состоянии, и мини-игры отеля (js/village/sports.js) — по полосе и кластеру. Без HUD (стенды) — запасные числа. */
  const CSS = `
.wr-touch{position:absolute;inset:0;z-index:4;touch-action:none}
.w-reg{z-index:6}
.wr-pedals{display:none}
.w-reg.drive .wr-pedals{display:contents}
.wr-pedal{position:absolute;right:var(--hud-r,12px);left:auto;top:auto;width:64px;border:0;border-radius:22px;font:inherit;font-size:13px;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 0 8px;box-sizing:border-box;box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 16px rgba(58,46,63,.10);cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;z-index:21}
.wr-pedal.gas{bottom:var(--hud-b,12px);height:76px;background:#A8D8C4;color:#24584A}
.wr-pedal.brk{bottom:calc(var(--hud-b,12px) + 86px);height:56px;background:#F2B8C6;color:#7A2E44}
.wr-pedal.gas::before{content:'';position:absolute;top:13px;left:50%;margin-left:-9px;border:9px solid transparent;border-top:0;border-bottom:11px solid rgba(36,88,74,.32)}
.wr-pedal.down{transform:translateY(3px) scale(.97);filter:brightness(.95)}
.w-reg.sit .wr-pedals,.w-reg.sit .w-joy,.w-reg.look .w-joy,.w-reg.dance .w-joy,.w-reg.zip .w-joy,.w-reg.sport .w-joy{display:none!important}
.w-reg.look .wmm-wrap,.w-reg.dance .wmm-wrap,.w-reg.zip .wmm-wrap,.w-reg.sport .wmm-wrap{display:none!important}
.w-reg .wr-act:not([data-hud-slot]){position:absolute;right:var(--hud-r,12px);bottom:var(--hud-b,12px)}
.wr-fade{position:absolute;inset:0;z-index:40;pointer-events:none;opacity:0;display:none;transition:opacity .6s ease;background:radial-gradient(ellipse at 30% 40%,#FFFFFF 0%,#F4F7FA 35%,#E3EBF3 70%,#D5E0EC 100%);overflow:hidden}
.wr-fade::before,.wr-fade::after{content:'';position:absolute;border-radius:50%;background:rgba(255,255,255,.92);filter:blur(18px)}
.wr-fade::before{width:70vmax;height:40vmax;left:-10vmax;top:10vh;animation:wrDrift 7s ease-in-out infinite alternate}
.wr-fade::after{width:80vmax;height:46vmax;right:-20vmax;bottom:5vh;animation:wrDrift 9s ease-in-out infinite alternate-reverse}
@keyframes wrDrift{to{transform:translateX(6vmax)}}
.wr-fade.on{opacity:1;pointer-events:auto}
.wr-fade .lbl{position:absolute;left:0;right:0;top:46%;text-align:center;font-weight:900;font-size:20px;color:var(--cherry,#C2405B);z-index:2;padding:0 24px}
.wr-fade .sub{position:absolute;left:0;right:0;top:calc(46% + 34px);text-align:center;font-weight:800;font-size:13px;color:var(--ink-2,#6E6272);z-index:2}
.wr-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:3;touch-action:none}
.wr-sheet{position:absolute;inset:0;z-index:75;display:flex;align-items:flex-end;justify-content:center;padding:0 10px calc(10px + var(--safe-bottom,0px));background:rgba(58,46,63,.32)}
.wr-sheet .card{width:100%;max-width:420px;max-height:78%;overflow:auto;background:var(--paper,#FFFDF9);border-radius:26px 26px 22px 22px;padding:14px 18px 16px;box-shadow:0 18px 44px rgba(58,46,63,.28);font-weight:600;font-size:16px;line-height:1.42}
.wr-sheet .t{font-weight:900;font-size:18px;color:var(--cherry-d,#9E2F47);margin-bottom:6px}
.wr-sheet .acts{display:flex;flex-direction:column;gap:9px;margin-top:10px}
.wr-sheet .acts button{min-height:48px;border:0;border-radius:16px;font:inherit;font-weight:900;background:#F6E7EB;color:var(--ink,#3A2E3F)}
.wr-sheet .acts button.main{background:var(--cherry,#C2405B);color:#fff}
.wr-ws{display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0 2px}
.wr-ws svg{width:min(70vw,250px);height:auto;touch-action:manipulation;cursor:pointer;filter:drop-shadow(0 4px 0 rgba(58,46,63,.12))}
.wr-ws .bar{width:min(70vw,250px);height:10px;border-radius:99px;background:#F2DCE2;overflow:hidden}
.wr-ws .bar i{display:block;height:100%;width:0;background:var(--cherry,#C2405B);border-radius:99px}
.wr-ws .hint{font-size:14px;font-weight:800;color:var(--ink-2,#6E6272);text-align:center}
.wr-ws .step{font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--cherry,#C2405B)}
.wr-tap{position:absolute;left:calc(var(--hud-joy-cx,50%) - 52px);bottom:var(--hud-joy-b,16px);top:auto;right:auto;width:104px;height:104px;border:0;border-radius:50%;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-size:21px;font-weight:900;box-shadow:var(--hud-shadow-act,0 6px 0 #9E2F47);touch-action:none;transition:transform .08s;z-index:22;cursor:pointer}
.wr-tap.beat{transform:scale(1.1)}
.wr-blink{position:absolute;inset:0;z-index:30;background:#2A2230;opacity:0;pointer-events:none!important;transition:opacity .13s}
.wr-blink.on{opacity:.82}
.w-reg.zip .wr-act,.w-reg.zip .wr-act2,.w-reg.zip .w-joy,.w-reg.zip .wr-pedals{display:none!important}
.w-reg.drive .mv-btns,.w-reg.drive .pf-btn,.w-reg.sit .mv-btns,.w-reg.sit .pf-btn,.w-reg.zip .mv-btns,.w-reg.zip .pf-btn,.w-reg.dance .mv-btns,.w-reg.dance .pf-btn,.w-reg.look .mv-btns,.w-reg.look .pf-btn{display:none!important}
/* зиплайн «держись»: большая зона на месте джойстика (Ø 120); кольцо — сколько ещё можно не держать */
.wr-grip{position:absolute;left:calc(var(--hud-joy-cx,50%) - 60px);bottom:calc(var(--hud-joy-b,16px) - 8px);top:auto;right:auto;width:120px;height:120px;border-radius:50%;display:none;z-index:23;touch-action:none;-webkit-user-select:none;user-select:none;cursor:pointer;background:conic-gradient(#86C9A0 calc(var(--k,1) * 360deg),rgba(255,253,249,.45) 0);box-shadow:0 6px 0 rgba(58,46,63,.16),0 12px 26px rgba(58,46,63,.18);-webkit-tap-highlight-color:transparent}
.wr-grip.on{display:block}
.wr-grip .ring{position:absolute;inset:10px;border-radius:50%;background:rgba(255,253,249,.97);display:flex;align-items:flex-start;justify-content:center;padding-top:15px;box-sizing:border-box}
.wr-grip .ring i{font-style:normal;font-size:34px;line-height:1}
.wr-grip b{position:absolute;left:0;right:0;bottom:27px;text-align:center;font-weight:900;font-size:13px;color:var(--ink,#3A2E3F);pointer-events:none;white-space:nowrap}
.wr-grip.held{background:conic-gradient(#86C9A0 360deg,#86C9A0 0)}
.wr-grip.held .ring i{transform:scale(.92)}
.wr-grip.free{background:conic-gradient(#E0607E calc(var(--k,1) * 360deg),rgba(194,64,91,.16) 0);animation:wrGrip .45s ease-in-out infinite alternate}
.wr-grip.free b{color:var(--cherry,#C2405B)}
@keyframes wrGrip{to{transform:scale(1.07)}}
/* параплан: джойстик — руль, вариометр — в правом слоте полосы; спорт: свой слой поверх, кнопки региона спрятаны */
.w-reg.fly .wr-act2,.w-reg.fly .wr-pedals,.w-reg.fly .mv-btns,.w-reg.fly .pf-btn{display:none!important}
.w-reg.sport .wr-act,.w-reg.sport .wr-act2,.w-reg.sport .w-joy,.w-reg.sport .wr-pedals,.w-reg.sport .mv-btns,.w-reg.sport .pf-btn,.w-reg.sport .pf-chip{display:none!important}
/* мини-игры отеля (sports.js) по HUD v2: счёт — в полосе на месте пилюли, выход — ✕ в правом слоте, большая кнопка — в углу P,
   «↺ Заново» — на месте A2 (без большой кнопки — в углу P), подсказка — тостом игры */
.wr-v2 .vs-root .vs-score{left:var(--hud-l,12px);top:var(--hud-top,8px);transform:none;min-height:44px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:4px 14px;font-size:14.5px;line-height:1.15;border-radius:18px;max-width:calc(100% - var(--hud-l,12px) - var(--hud-r,12px) - 56px);background:var(--hud-glass-2,rgba(255,253,249,.96));box-shadow:var(--hud-shadow,0 3px 0 rgba(58,46,63,.13))}
.wr-v2 .vs-root .vs-score small{font-size:11.5px}
.wr-v2 .vs-root .vs-quit{top:var(--hud-top,8px);right:var(--hud-r,12px);width:44px;height:44px;min-width:44px;padding:0;border-radius:50%;font-size:0;display:grid;place-items:center;background:var(--hud-glass-2,rgba(255,253,249,.96));box-shadow:var(--hud-shadow,0 4px 0 rgba(58,46,63,.16))}
.wr-v2 .vs-root .vs-quit::before{content:'✕';font-size:18px;font-weight:900;line-height:1;color:var(--cherry,#C2405B)}
.wr-v2 .vs-root .vs-main{right:var(--hud-r,12px);bottom:var(--hud-b,12px)}
.wr-v2 .vs-root .vs-side,.wr-v2 .vs-root .vs-side.low{right:var(--hud-r,12px)!important;bottom:var(--hud-a2-b,192px)!important;height:44px;padding:0 16px;border-radius:22px;font-size:14px}
.wr-v2 .vs-root:has(.vs-main[style*="none"]) .vs-side{bottom:var(--hud-b,12px)!important}
.wr-v2 .vs-root .vs-hint{display:none!important}
body.wr-hud-sport #hudMenu,body.wr-hud-sport #hudObj,body.wr-hud-sport #hud .hud-card,body.wr-hud-zip #hudMenu,body.wr-hud-zip #hudObj,body.wr-hud-zip #hud .hud-card{display:none!important}
/* без HUD v2 (стенд без style.css) — прежние места */
.w-reg:not(.wr-v2) .wr-act2{right:14px;bottom:calc(84px + var(--safe-bottom,0px))}
`;
  function ensureCss() {
    if (WORLD.uiCss) { try { WORLD.uiCss(); } catch (e) { /* ignore */ } }
    if (document.getElementById('wRegCss')) return;
    const st = document.createElement('style'); st.id = 'wRegCss'; st.textContent = CSS;
    document.head.insertBefore(st, document.head.firstChild);
  }

  /* ---------- маленькие реплики героини и жителей (литералы { who, text } — их найдёт озвучка) ---------- */
  const HERO = {
    arrive: { who: 'hero', text: 'Ого! Облака — внизу.' },
    drink: { who: 'hero', text: 'Ух!' },
    tasty: { who: 'hero', text: 'Вкусно! Тонкий, как блинчик.' },
    view: { who: 'hero', text: 'Посижу минутку. Красота.' },
    jug: { who: 'hero', text: 'Несу воду! Осторожно, не расплескать.' },
    shine: { who: 'hero', text: 'Блестит!' },
  };
  // строки героини волны 4 — облачком, без голоса (как в стенде): короткие, без имени
  const SAY = {
    bread: 'Ммм, тёплый!', spring: 'Холодненькая!', beret: 'Ой! Мой берет!', beretBack: 'Ха-ха, спасибо!', jingle: 'Звяк-звяк!',
    holed: 'Ура! В лунку!', sports: 'Здорово! Сыграем потом.', sit: 'Посижу немножко.', back: 'Поехали дальше!',
  };
  const BUNNY_GIVE = [{ who: 'baker_bunny', text: 'Держи! Горячий.' }, { who: 'baker_bunny', text: 'Держи! Тёплый, с хрустом.' }];
  const SOFT_BG = ['#E6EEF6', '#F6E7EB', '#EEF3E2', '#FFF0DC', '#EDE6F6'];
  // события слоя рук → мягкие звуки движка (engine.js: tap, pop, blip, chime, door, flutter, step, wrong)
  const IA_SFX = { take: 'pop', give: 'pop', bite: 'pop', crunch: 'pop', lick: 'blip', sip: 'blip', gulp: 'blip', lid: 'door', lidClose: 'door', splash: 'flutter', step: 'step', pat: 'tap', clap: 'tap', coin: 'chime', clink: 'chime', busy: 'wrong' };

  function create(refs = {}) {
    const T = refs.THREE || window.THREE;
    if (!T) throw new Error('regions: нет THREE');
    ensureCss();
    const st0 = settings();
    const named = refs.named !== undefined ? !!refs.named : st0.named;
    const season = refs.season === 'winter' || refs.season === 'autumn' ? refs.season : st0.season;
    const regionQ = refs.regionQ === 'high' || refs.regionQ === 'low' ? refs.regionQ : refs.quality === 'high' ? 'high' : 'low';
    const lite = refs.quality === 'lite';
    const say = refs.say || (G_() && G_().say ? lines => G_().say(lines) : null);
    const sheetFn = refs.sheet || (window.Town && Town.sheet ? o => Town.sheet(o) : ownSheet);
    // HUD v2: один тост за раз, под полосой, очередью (HUD.toast → G.toast); kind: 'place' | 'sticker'
    const toast = (t, ms, o) => { if (!t) return; (S.toastLog = S.toastLog || []).push(t); if (S.toastLog.length > 30) S.toastLog.shift(); const H = HUD_(); if (refs.toast) refs.toast(t, ms, o); else if (H && H.toast && G_() && G_().toast) H.toast(t, ms, o); else if (G_() && G_().toast) G_().toast(t, ms); else ownToast(t, ms); };
    const voice = refs.voice || (G_() && G_().voiceLine ? (w, t, o) => G_().voiceLine(w, t, o) : null);
    const haptic = k => { try { if (refs.haptic) refs.haptic(k); else if (G_()) G_().haptic(k); } catch (e) { /* нет */ } };
    const sfx = (k, o) => { try { if (refs.sfx) refs.sfx(k, o); else if (G_()) G_().sfx(k, o); } catch (e) { /* нет */ } };
    const emit = (name, detail) => { try { if (refs.onEvent) refs.onEvent(name, detail); } catch (e) { /* ignore */ } emitWin(name, detail); };
    const hero = refs.hero || null;
    const L = () => refs.layout || WORLD.LAYOUT || {};
    let car = refs.car || null, ownCar = false;
    const KAZ_MODE = () => { const q = DEBUG ? QS.get('kaz') : null, v = refs.kaz || q || (window.CONFIG && CONFIG.KAZ_ON_ARRIVAL) || 'auto'; return v === 'offer' || v === 'off' ? v : 'auto'; };

    /* ---------- состояние ---------- */
    const S = {
      active: false, rid: null, h: null, mode: 'walk', px: 0, py: 0, pz: 0, ang: 0, vx: 0, vz: 0, yaw: 0, camInit: false, manualT: 0, walking: false, moveT: 0,
      sitting: null, view: null, busy: false, near: null, near2: null, lastGreet: {}, lineIdx: {}, frames: 0, fps: 0, info: { calls: 0, tris: 0 }, level: 'ground',
      flags: { bread: false, jug: false, askJug: false, granny: false, stones: new Set(), pendant: false }, trip: { up: false, village: false, down: false, hotel: false, zip: false },
      dir: 'up', exitArmed: {}, epoch: 0, moveTo: null, waveT: 0, cheerT: 0, buildMs: 0, auto: 0, autoRoad: null, fpsS: [], fpsT: 0, fbDone: false,
      // волна 4
      climb: null, look: null, inShop: null, iaDy: 0, iaGen: 0, iaEv: [], wipeT: 0, wipeDelay: 0, bag: [], pats: 0, stickers: [], night: 0, carLamps: null,
      zip: null, zipEv: [], zipResult: null, golf: null, golfLast: null, dance: null, lastDance: null, animSt: null, treat: null, treats: 0, shopBuy: null, springT: false,
      iaCancel: false, prankLog: [], evLog: [], said: [], sim: false, lastExit: null, camFix: 0, sat: 0, springs: 0, breads: 0, buys: 0, congrats: 0,
      // волна 5: бег и прыжки (Move), параплан, спорт отеля, «Бум!» (PlayFight), зиплайн «держись», фразы в тумане, «Помахать»
      mv: null, floor: null, camY: null, fly: null, flyLog: [], sport: null, sportLog: [], pf: null, pfLog: [], zipPts: 0, zipHoldKey: false, zipDrops: 0,
      fogLog: [], waveN: 0, waveLog: [], greeted: new Set(), mvLog: [], voiceLog: [],
      // W7: взгляд пальцем вверх-вниз (pitch, рад, + вверх; pitchT — с последнего касания, с), за рулём — вокруг машины (dYaw);
      // вид «из-за руля» (ck — VILLAGE.drive.cockpit, ckLook — поворот головы)
      pitch: 0, pitchT: 99, dYaw: 0, ck: null, ckLook: { yaw: 0, pitch: 0 },
    };
    let renderer = refs.renderer || null, ownR = false, canvas = null, host = refs.host || null, cam = null, scene = null;
    let ui = null, raf = 0, last = 0, cap = null, tripRes = null, drv = null, chase = null, blob = null, hidden = [], prevSpk = null, inCarNow = false;
    let IA = null, prevHands = null, shadowProxy = null, dn = null, dnToggle = null, dnOff = null, radar = null, pets = [];
    // кнопка «Прыжок» (Move.mountButtons) — одна на поездку, перепривязывается к Move каждого региона; бег — джойстик или Shift
    let mvUi = null;

    /* ---------- облачка, тост, лист-запас ---------- */
    const bubbles = [];
    const tmpV = new T.Vector3();
    function bubble(getPos, text, title, ms, cls) {
      if (!ui || !text) return;
      S.said.push((title ? title + ': ' : '') + text); if (S.said.length > 40) S.said.shift();
      // над ряженым свадьбы — одно облачко: новая строка встаёт в то же облачко (приветствие и «Звяк-звяк!» ложились друг на друга)
      const own = getPos.npc && getPos.npc.paltar ? getPos.npc : null;
      let b = bubbles.find(x => x.getPos === getPos || (own && x.getPos.npc === own && performance.now() < x.until));
      if (!b) { const el = document.createElement('div'); el.className = 'w-say'; ui.bub.appendChild(el); b = { el, getPos }; bubbles.push(b); }
      b.getPos = getPos;
      b.el.className = 'w-say' + (cls ? ' ' + cls : '');
      b.el.innerHTML = (title ? `<b>${esc(title)}</b>` : '') + `<span>${esc(text)}</span>`;
      b.until = performance.now() + (ms || Math.max(2600, Math.min(5200, 1400 + text.length * 45)));
      requestAnimationFrame(() => b.el.classList.add('on'));
    }
    function placeBubbles() {
      if (!ui || !cam) return;
      const now = performance.now(), W = host.clientWidth || 390, H = host.clientHeight || 844;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (now > b.until) { b.el.classList.remove('on'); if (now > b.until + 400) { b.el.remove(); bubbles.splice(i, 1); } continue; }
        const p = b.getPos(); tmpV.set(p.x, p.y, p.z).project(cam);
        if (tmpV.z > 1) { b.el.style.opacity = 0; continue; }
        b.el.style.opacity = '';
        const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H, hw = (b.el.offsetWidth || 180) / 2 + 8;
        const yy = HUD_() && HUD_().labelY ? HUD_().labelY(y, H) : clamp(y, 110, H - 150);   // HUD v2: ниже строки тоста, выше джойстика и дуги
        b.el.style.transform = `translate(${clamp(x, hw, W - hw)}px, ${yy}px) translate(-50%, -100%)`;
      }
    }
    // голос облачка: запись из voice/ или «лепет» (G.voiceLine), как у жителей города
    function voiceBubble(who, text) {
      if (text && who) { (S.voiceLog = S.voiceLog || []).push(who + '|' + text); if (S.voiceLog.length > 200) S.voiceLog.shift(); }
      if (!voice || !text || !who) return;
      try { const v = voice(who, text, { mode: 'bubble' }); const ep = S.epoch; if (typeof v === 'function') for (let i = 0; i < text.length; i++) setTimeout(() => { if (ep === S.epoch) v(i); }, 120 + i * 38); } catch (e) { /* без голоса */ }
    }
    let toastT = 0;
    function ownToast(t, ms = 2600) {
      if (!ui) return; let el = ui.root.querySelector('.w-toast');
      if (!el) { el = document.createElement('div'); el.className = 'w-toast'; ui.root.appendChild(el); }
      el.textContent = t; el.style.display = ''; clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = 'none'; }, ms);
    }
    function ownSheet(o = {}) {
      return new Promise(res => {
        const m = document.createElement('div'); m.className = 'wr-sheet';
        m.innerHTML = `<div class="card"><div class="t">${esc(o.title || '')}</div><div class="b"></div><div class="acts"></div></div>`;
        const body = m.querySelector('.b'), acts = m.querySelector('.acts');
        if (o.body instanceof Element) body.appendChild(o.body); else if (o.body != null) body.innerHTML = o.body;
        let done = false; const close = v => { if (done) return; done = true; m.remove(); res(v === undefined ? null : v); };
        (o.actions && o.actions.length ? o.actions : [{ label: 'Хорошо' }]).forEach((a, i) => { const b = document.createElement('button'); b.textContent = a.label; if (!i && a.cls !== 'soft') b.className = 'main'; b.onclick = e => { e.stopPropagation(); close(a.value !== undefined ? a.value : a.label); }; acts.appendChild(b); });
        m.addEventListener('click', e => { if (e.target === m && !o.sticky) close(null); });
        (G_() && G_().layer ? G_().layer : host || document.body).appendChild(m);
        if (o.onMount) { try { o.onMount(body, close, m); } catch (e) { console.warn('region sheet', e); } }
      });
    }
    const paras = arr => (arr || []).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
    async function runBusy(fn) { if (S.busy) return null; S.busy = true; try { return await fn(); } catch (e) { console.warn('region', e); return null; } finally { S.busy = false; } }
    function sticker(t) { if (!ui || !t || S.stickers.includes(t)) return; S.stickers.push(t); toast('🐄 ' + t, 3500, { kind: 'sticker' }); try { sfx('sticker'); } catch (e) { /* ok */ } }
    function blink() { if (!ui) return; ui.blink.classList.add('on'); setTimeout(() => ui && ui.blink.classList.remove('on'), 260); }

    /* ---------- говорящие гор в окне диалога (имя + значок), на время поездки ---------- */
    function speakerTable() {
      const V = V_() || {}, SP = {};
      const take = (src, nm) => Object.keys(src || {}).forEach(id => { const s = src[id]; SP[id] = { name: nm === false && s.n ? s.n : s.name, icon: s.icon }; });
      take(V.SPEAKERS, named); take(V.wedding && V.wedding.SPEAKERS, named); take(V.hotel && V.hotel.SPEAKERS, named);
      return SP;
    }
    function registerSpeakers() {
      const g = G_(); if (!g || !g.addSpeakers || !g.speakers) return;
      const SP = speakerTable();
      const add = {}; if (!prevSpk) prevSpk = {};
      const put = (id, name, icon, i) => { if (!(id in prevSpk)) prevSpk[id] = g.speakers[id] || null; add[id] = { name: () => name, art: () => (g.emojiAvatar ? g.emojiAvatar(icon || '🐾', SOFT_BG[i % SOFT_BG.length]) : '') }; };
      Object.keys(SP).forEach((id, i) => put(id, SP[id].name, SP[id].icon, i));
      if (S.h && S.h.npcs) S.h.npcs.forEach((n, i) => { const id = n.speaker || n.id; if (n.name && (!SP[id] || id === 'tur')) put(id, n.name, (SP[id] && SP[id].icon) || '🐐', i + 3); });
      g.addSpeakers(add);
    }
    function restoreSpeakers() {
      const g = G_(); if (!g || !g.speakers || !prevSpk) return;
      Object.keys(prevSpk).forEach(id => { if (prevSpk[id]) g.speakers[id] = prevSpk[id]; else delete g.speakers[id]; });
      prevSpk = null;
    }

    /* ---------- интерфейс региона (HUD v2): радар слева внизу (minimap.js), джойстик снизу по центру, справа — главная кнопка P
       (значок + слово; без дела — «👋 Помахать») и дуга маленьких кнопок («Прыжок» — move.js, «Бум!»/«Листья» — playfight.js; бег —
       джойстиком за край кружка),
       A2 — второе действие; за рулём: газ в углу P, тормоз над ним, главное действие («🚪 Выйти») — в A2, второе — в s3.
       Полоса сверху — общая (engine.js + hud.js): каз, «В город», время суток — строки меню ☰; скорость и вариометр — правый слот;
       маршрут — пилюля цели; название места — тост при въезде. ---------- */
    function makeUI() {
      const H = HUD_();
      const root = document.createElement('div'); root.className = 'w-ui w-reg' + (H ? ' wr-v2' : '');
      root.innerHTML = `
        <div class="w-bubbles"></div>
        ${H ? '' : '<div class="w-joy joy hidden"><div class="joy-knob"></div></div>'}
        <button class="w-act wr-act hidden" type="button"></button>
        <button class="wr-act2 hidden" type="button"></button>
        <div class="wr-pedals"><button class="wr-pedal brk hud-pedal" type="button" data-hud-slot="brake" aria-label="Тормоз">тормоз</button><button class="wr-pedal gas hud-pedal" type="button" data-hud-slot="gas" aria-label="Газ">газ</button></div>
        <button class="wr-tap hidden" type="button" data-hud-slot="joy">Хоп!</button>
        <button class="wr-skip hidden" type="button"></button>
        <div class="wr-grip" role="button" aria-label="Держись" data-hud-slot="joy"><div class="ring"><i>✊</i></div><b class="wr-grip-t">Зажми и держи</b></div>
        <div class="wr-blink"></div>`;
      const touch = document.createElement('div'); touch.className = 'wr-touch';
      const fade = document.createElement('div'); fade.className = 'wr-fade'; fade.innerHTML = '<div class="lbl"></div><div class="sub"></div>';
      const $ = s => root.querySelector(s);
      const J = H && H.joystick ? H.joystick.create(root) : null;
      // за рулём (телефон): «‹‹» «››» слева — руль вместо джойстика; педали — свои (.wr-pedal)
      const steer = H && H.driveCtl ? H.driveCtl.create(root, { pedals: false }) : null;
      const u = { root, touch, fade, J, steer, bub: $('.w-bubbles'), joy: J ? J.el : $('.w-joy'), knob: J ? J.knob : $('.w-joy .joy-knob'), act: $('.wr-act'), act2: $('.wr-act2'), gas: $('.wr-pedal.gas'), brk: $('.wr-pedal.brk'),
        tap: $('.wr-tap'), skip: $('.wr-skip'), blink: $('.wr-blink'), grip: $('.wr-grip'), gripT: $('.wr-grip-t') };
      paintBtn(u.skip, '⏭ Пропустить', true, 'P'); show(u.skip, false);   // зиплайн: «⏭ Дальше» на месте главной кнопки
      return u;
    }
    const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
    // кнопка по слоту: P — круг 64 (значок + слово, HUD.actFace), a2 — мягкая пилюля (значок + подпись), s1…s4 — круг 46 (значок)
    function paintBtn(el, label, soft, slot) {
      if (!el) return;
      const H = HUD_();
      show(el, true);
      if (!H) { el.textContent = label; el.classList.toggle('soft', !!soft); return; }
      // главная кнопка гор — .wr-act (в слоте P ещё и .w-act — общий вид P города); второе действие — .wr-act2; «Дальше» зиплайна — .wr-skip
      const keep = el.classList.contains('wr-act2') ? 'wr-act2' : el.classList.contains('wr-skip') ? 'wr-skip' : slot === 'P' ? 'w-act wr-act' : 'wr-act';
      const key = slot + '|' + label + '|' + (soft ? 1 : 0);
      if (el.dataset.wrKey === key) return;
      el.dataset.wrKey = key; el.className = keep; delete el.dataset.full; delete el.dataset.faceKey;
      if (H.paintSlot) { H.paintSlot(el, label, slot, soft); return; }   // общий модуль: P — значок + слово, a2 — пилюля, s1…s4 — круг 46
      H.slot(el, slot); H.paintAct(el, label, soft);
    }
    const btnLabel = el => (el && !el.classList.contains('hidden') ? (el.dataset.full || el.getAttribute('aria-label') || el.textContent) : null);
    // подсказки управления — тостом игры (один за раз, под полосой)
    function hint(t, ms = 3500) { if (!ui || !t) return; toast(t, Math.min(ms, 3500)); }
    const touchUi = () => { const H = HUD_(); return H && H.coarse ? H.coarse() : ('ontouchstart' in window); };
    const HINT = {
      drive: () => (touchUi() ? 'Руль — кнопки слева · газ и тормоз — справа' : 'Стрелки — руль и газ · B — тормоз'),
      walk: () => (touchUi() ? 'Кружок внизу — идти · тап по месту — подойти' : 'WASD — идти · Enter — действие · Q/E — камера'),
    };

    /* ---------- HUD v2: строки меню ☰, правый слот, пилюля маршрута, режим кластера ---------- */
    let hudSaved = null;
    // «🌙 Время суток» в меню: «Сейчас вечер · 21:40» и «В утро» / «Как на часах» (бывшая кнопка .wr-dn); у города своя — тогда не дублируем
    function dnMenuItem() {
      const D = window.DayNight; if (!D) return null;
      if (D.menuItem) { try { const it = D.menuItem({ onSet: (to, line) => toast(line, 2400, { replace: true }) }); if (it) return Object.assign({}, it, { id: 'r-dn', order: 40, when: () => S.active }); } catch (e) { /* ниже — своя */ } }
      const hhmm = h => { const m = Math.round((((h % 24) + 24) % 24) * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
      return {
        id: 'r-dn', order: 40, tint: 'sun', label: 'Время суток', when: () => S.active,
        icon: () => { const p = D.phase(); return p === 'night' || p === 'evening' ? '🌙' : p === 'golden' ? '🌇' : '☀️'; },
        sub: () => 'Сейчас ' + ((D.PHASE_RU && D.PHASE_RU[D.phase()]) || '') + ' · ' + hhmm(D.hour()),
        value: () => (D.override() !== null ? '🕗 Как на часах' : '☀️ В утро'),
        onTap: () => { const to = D.override() !== null ? null : 'morning'; D.set(to); toast(to ? D.LINES.toMorning : D.LINES.toClock, 2400, { replace: true }); },
      };
    }
    // текст «кнопки» дня/ночи для отладки: значение строки меню (или прежней кнопки без HUD)
    function dnRowText() {
      const H = HUD_(), it = H && H.menu && H.menu.get ? H.menu.get('r-dn') : null;
      if (it) { try { const v = it.value || it.label; return typeof v === 'function' ? v() : (v || null); } catch (e) { return null; } }
      const b = ui && ui.root.querySelector('.dn-toggle'); return b && b.style.display !== 'none' ? b.textContent : null;
    }
    function hudBegin() {
      const H = HUD_(); if (!H) return;
      hudSaved = { obj: H.objective && H.objective.get ? H.objective.get() : null, status: H.status && H.status.get ? H.status.get() : null };
      try { if (H.objective) H.objective.set(null); } catch (e) { /* ok */ }
      // строки меню ☰ гор (у города свои: «Карта», «Время суток», «Мини-карта» — пока идёт поездка, они спрятаны)
      if (H.menu) {
        H.menu.add({ id: 'r-map', icon: '🗺', label: 'Карта', order: 10, tint: 'mint', when: () => S.active && !!(radar && radar.open), onTap: () => { if (S.active && radar && radar.open && !S.busy && !S.zip) radar.open(); } });
        if (window.DayNight) { const it = dnMenuItem(); if (it) H.menu.add(it); }
        H.menu.add({ id: 'r-kaz', icon: '🧣', label: kazRowLabel, order: 45, tint: 'sun', when: kazRowOn, onTap: () => kazBtn() });
        H.menu.add({ id: 'r-radar', icon: '🧭', order: 70, tint: 'sky', keepOpen: true, when: () => S.active && !!(radar && radar.collapse),
          label: () => (radar && radar.isCollapsed && radar.isCollapsed() ? 'Мини-карта: показать' : 'Мини-карта: спрятать'),
          onTap: () => { if (radar && radar.collapse) radar.collapse(!(radar.isCollapsed && radar.isCollapsed())); } });
      }
      S.hudStatus = null; S.hudObj = null; S.hudMode = null; S.hudObjT = 0;
    }
    function hudEnd() {
      const H = HUD_(); document.body.classList.remove('wr-hud-sport', 'wr-hud-zip');
      if (!H) return;
      if (H.bar) H.bar({});
      try { if (H.menu) ['r-map', 'r-dn', 'r-kaz', 'r-radar'].forEach(id => H.menu.remove(id)); } catch (e) { /* ok */ }
      try { H.status(hudSaved ? hudSaved.status : null); } catch (e) { /* ok */ }
      try { if (H.objective) H.objective.set(hudSaved && hudSaved.obj ? Object.assign({}, hudSaved.obj, { bounce: false }) : null); } catch (e) { /* ok */ }
      hudSaved = null;
    }
    // режим кластера: что видно (data-hud-mode — общие правила style.css; классы .w-reg — свои правила гор)
    function hudMode() {
      if (!ui) return;
      const m = S.sport ? 'sport' : S.zip ? 'zip' : S.dance ? 'dance' : S.look ? 'look' : flyActive() ? 'fly' : (S.sitting || S.view || S.inShop || S.golf) ? 'sit' : S.mode === 'drive' ? 'drive-pedals' : 'walk';
      if (ui.steer) ui.steer.show(m === 'drive-pedals' && S.active && !S.busy);
      if (m === S.hudMode) return;
      S.hudMode = m;
      const H = HUD_(); if (H) H.mode(ui.root, m); else ui.root.dataset.hudMode = m;
      ui.root.classList.toggle('look', m === 'look'); ui.root.classList.toggle('dance', m === 'dance');
      // мини-игра и зиплайн: полоса без ☰ и пилюли (любое касание — игре / ручке)
      if (H && H.bar) H.bar(m === 'sport' || m === 'zip' ? { menu: false, obj: false } : {});
      else { document.body.classList.toggle('wr-hud-sport', m === 'sport'); document.body.classList.toggle('wr-hud-zip', m === 'zip'); }
    }
    // правый слот полосы: за рулём — «42 км/ч», в полёте — вариометр, в мини-игре и на зиплайне — пусто, иначе — звук
    function hudStatus() {
      const H = HUD_(); if (!H || !H.status || !ui) return;
      let o = null;
      if (S.sport || S.zip) o = { kind: 'none' };
      else if (flyActive()) o = { kind: 'chip', text: S.flyHud || '🪂' };
      else if (S.mode === 'drive' && drv && !S.sitting) o = { kind: 'chip', text: Math.round(Math.abs(drv.S.v) * 3.6) + ' км/ч' };
      const key = o ? o.kind + ':' + (o.text || '') : 'sound';
      if (key === S.hudStatus) return;
      S.hudStatus = key; H.status(o);
    }
    // пилюля цели в горах: куда ведёт дорога (серпантин), кувшин бабушке-ежихе (село), удары старого гольфа
    const fmtDist = d => (d == null ? null : d < 1000 ? Math.round(d) : (d / 1000).toFixed(1).replace('.', ',') + ' км');
    function routeGoal() {
      const h = S.h; if (!h || S.sport || S.zip || S.dance || S.look || S.inShop) return null;
      if (S.golf) { const g = S.golf.G; return { icon: '⛳', text: 'Удары: ' + (g.maxTries - g.tries) + ' из ' + g.maxTries, title: 'Мини-гольф', full: 'Потяни назад и отпусти — как рогатку. «Встать» — закончить.', d: null }; }
      if (S.rid === 'serpentine') {
        const down = S.dir === 'down', inCar = S.mode === 'drive' && drv, branch = !!(drv && drv.S && drv.S.rid === 1);
        const id = down ? 'toCity' : branch ? 'toHotel' : 'toVillage', ex = h.exits.find(e => e.id === id); if (!ex) return null;
        const px = inCar ? drv.S.x : S.px, pz = inCar ? drv.S.z : S.pz;
        let d = Math.hypot(ex.x - px, ex.z - pz);
        if (!branch && ex.s != null && h.road && h.road.project) { try { const pr = h.road.project(px, pz); if (pr && isFinite(pr.s)) d = Math.abs(ex.s - pr.s); } catch (e) { /* по прямой */ } }
        const name = id === 'toCity' ? 'Город' : id === 'toHotel' ? 'Отель на вершине' : (titleOf() || ex.label || '');
        return { icon: id === 'toCity' ? '🏙' : id === 'toHotel' ? '🏨' : '⛰️', text: name, title: down ? 'Дорога вниз' : 'Дорога наверх', d,
          full: (down ? 'Вниз по серпантину — в город.' : branch ? 'По ветке — к отелю на вершине.' : 'Вверх по серпантину, за облака.') + (touchUi() ? ' Газ и тормоз — справа, кружок внизу — руль.' : '') };
      }
      if (S.rid === 'kubachi' && S.flags.jug && !S.flags.granny) {
        const n = npcBy('granny_hedgehog');
        if (n) return { icon: '🫙', text: n.name || 'Бабушка-ежиха', title: 'Кувшин с водой', full: 'Отнеси воду бабушке-ежихе на площади.', d: Math.hypot(n.root.position.x - S.px, n.root.position.z - S.pz) };
      }
      return null;
    }
    function hudObjective(force) {
      const H = HUD_(); if (!H || !H.objective || !ui) return;
      const now = performance.now(); if (!force && (S.busy || now - (S.hudObjT || 0) < 500)) return; S.hudObjT = now;   // пока шторка или посадка — пилюля как была
      const o = routeGoal(), key = o ? o.icon + '|' + o.text + '|' + o.title : '';
      if (key !== S.hudObj) { S.hudObj = key; H.objective.set(o ? { icon: o.icon, text: o.text, title: o.title, full: o.full, dist: fmtDist(o.d), expand: false } : null); }
      else if (o) H.objective.dist(fmtDist(o.d));
    }

    /* ---------- шторка ---------- */
    function curtain(on, label, sub) {
      if (!ui) return Promise.resolve();
      const f = ui.fade;
      if (on) {
        f.querySelector('.lbl').textContent = label || ''; f.querySelector('.sub').textContent = sub || '';
        f.style.display = 'block';
        return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { f.classList.add('on'); setTimeout(r, 650); })));
      }
      f.classList.remove('on');
      return new Promise(r => setTimeout(() => { if (!f.classList.contains('on')) f.style.display = 'none'; r(); }, 650));
    }
    async function fade(label, fn, sub) {
      S.busy = true;
      await curtain(true, label, sub);
      await raf2();   // шторка точно нарисована до тяжёлой сборки
      try { await fn(); } catch (e) { console.error('region fade', e); }
      renderOnce();
      await raf2();
      S.busy = false;
      await curtain(false);
    }

    /* ---------- ввод: джойстик слева, камера справа, тап — идти туда, клавиши; гольф — «рогатка»; «Осмотреться» — взгляд и щипок ---------- */
    const keys = {}, joy = { id: null, x: 0, y: 0, lx: 0, ly: 0, cx: 0, cy: 0, x0: 0, y0: 0, t0: 0, moved: 0, late: false }, look = new Map(), ped = { gas: false, brk: false }, pts = new Map();
    const KM = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyQ: 'q', KeyE: 'e' };
    const canInput = () => S.active && !S.busy && !blocked();
    const onKeyDown = e => {
      if (!S.active || blocked()) return;
      // W5: зиплайн «держись» — пробел/Enter держат ручку (как палец на экране)
      if (S.zip && S.zip.hold && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (!e.repeat) { S.zipHoldKey = true; S.zip.hold(true); } return; }
      if (S.sport) return;   // спорт отеля: свой слой ловит касания и клавиши
      if (KM[e.code]) { keys[KM[e.code]] = true; S.moveTo = null; e.preventDefault(); return; }
      if (e.code === 'KeyB' || e.code === 'ShiftLeft') ped.brk = true;
      // W5: Shift — бег (пешком; в машине Shift — тормоз), пробел — прыжок, если рядом нет действия; H — «Помахать»
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && S.mode === 'walk' && S.mv) S.mv.holdRun(true);
      if (e.code === 'KeyH' && !e.repeat && S.mode === 'walk') { waveBtn(); return; }
      if (e.code === 'Space' && !e.repeat && mvOn() && freeWalk() && !S.near && !(IA && IA.busy())) { e.preventDefault(); S.mv.jump(); return; }
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); act(); }
    };
    const onKeyUp = e => {
      if (S.zip && S.zip.hold && S.zipHoldKey && (e.code === 'Space' || e.code === 'Enter')) { S.zipHoldKey = false; if (!S.zipPts) S.zip.hold(false); }
      if (KM[e.code]) keys[KM[e.code]] = false; if (e.code === 'KeyB' || e.code === 'ShiftLeft') ped.brk = false;
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && S.mv) S.mv.holdRun(false);
    };
    const onBlur = () => {
      Object.keys(keys).forEach(k => { keys[k] = false; }); joy.id = null; joy.x = joy.y = 0; ped.gas = ped.brk = false; pts.clear(); look.clear(); if (S.golf) S.golf.drag = null; if (ui) { joyEnd(); ui.gas.classList.remove('down'); ui.brk.classList.remove('down'); }
      S.zipPts = 0; S.zipHoldKey = false; gripPts.clear(); if (S.zip && S.zip.hold) S.zip.hold(false); if (S.mv) S.mv.holdRun(false);
    };
    const rel = e => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
    // джойстик HUD v2 (HUD.joystick: покой снизу, центр — сам палец, сила и курс — раз в кадр в joyRun); без HUD — прежний круг под пальцем
    const joyZone = (x, y, r) => { const H = HUD_(); return H && H.joyZone ? H.joyZone(x, y, r.width, r.height) : x < r.width * 0.5; };
    function joyBegin(x, y, r) {
      if (!ui) return; joy.live = true;
      if (ui.J) { ui.J.begin(x, y); show(ui.joy, true); return; }
      r = r || host.getBoundingClientRect();
      joy.cx = clamp(x, 70, r.width * 0.5 - 20); joy.cy = clamp(y, 120, r.height - 60);
      ui.joy.style.left = joy.cx + 'px'; ui.joy.style.top = joy.cy + 'px'; show(ui.joy, true); ui.knob.style.transform = '';
    }
    function joyDrag(x, y) {
      if (!ui || !joy.live) return { x: 0, y: 0, m: 0 };
      if (ui.J) return ui.J.drag(x, y);
      let dx = x - joy.cx, dy = y - joy.cy; const d = Math.hypot(dx, dy), R0 = 46;
      if (d > R0) { dx *= R0 / d; dy *= R0 / d; }
      ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      return d < 8 ? { x: 0, y: 0, m: 0 } : { x: dx / R0, y: dy / R0, m: Math.min(1, d / R0) };
    }
    function joyEnd() {
      const was = joy.live; joy.live = false; if (!ui) return;
      if (ui.J) { if (was || ui.J.active) ui.J.end(); joyRest(); return; }
      show(ui.joy, false);
    }
    // раз в кадр (tick): сила и курс джойстика (HUD.joystick.frame — кривая, сглаживание, удержание курса) → joy.x/y, без кривой —
    // joy.lx/ly (руль в горах); бег — палец за краем кружка держит одно направление 0,3 с (HUD.JOY), пока держит; назад внутрь хода
    // или отпустила — шаг. Бег — Move.holdRun (как Shift), на старте — лёгкий отклик. Отладка (walk, input, driveHold) пишет joy.x/y
    // сама — копия только, пока палец на экране
    function joyRun(ok) {
      const J = ui && ui.J, on = !!(J && J.frame && J.frame(ok && joy.live && !!S.mv));
      if (joy.live && J) { joy.x = J.x; joy.y = J.y; joy.lx = J.lx; joy.ly = J.ly; }
      if (on !== !!S.joyRun) { S.joyRun = on; if (S.mv) S.mv.holdRun(on); if (on) haptic('light'); }
      else if (on && !S.mv.run) S.mv.holdRun(true);
    }
    // кружок в покое (только на сенсорных экранах): когда можно идти, ехать, рулить крылом или шагать по лестнице
    function joyRest() {
      if (!ui || !ui.J) return;
      const on = S.active && !S.busy && !blocked() && !S.zip && !S.sport && !S.dance && !S.look && !S.sitting && !S.view && !S.inShop && !S.golf && !S.shopBuy
        && (S.mode === 'walk' || S.mode === 'drive' || S.mode === 'climb' || flyActive());
      if (ui.J.active) return;
      if (on !== ui.J.want) ui.J.show(on);
    }
    const onDown = e => {
      e.stopPropagation(); if (!S.active) return;
      // W5: зиплайн «держись» — любое касание экрана держит ручку, пока палец не отпустят
      if (S.zip && S.zip.hold) { zipDown(e.pointerId); try { ui.touch.setPointerCapture(e.pointerId); } catch (x2) { /* старые браузеры */ } return; }
      if (S.sport) return;
      const [x, y, r] = rel(e);
      pts.set(e.pointerId, { x, y });
      try { ui.touch.setPointerCapture(e.pointerId); } catch (x2) { /* старые браузеры */ }
      if (S.golf && canInput()) { const G = S.golf.G; if (!G.rolling && G.tries < G.maxTries && !G.holed) { S.golf.drag = { x, y, id: e.pointerId }; return; } }
      if (S.look) { if (pts.size === 2) { const [a, b] = [...pts.values()]; S.look.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: S.look.fov }; } return; }
      // HUD v2: джойстик — касание в нижней половине левее дуги кнопок (круг встаёт под палец, не заезжает на радар и дугу);
      // выше и правее — камера; мышь — камера (клавиатура ходит как раньше); короткий тап — «идти туда»
      // за рулём с кнопками руля (HUD.driveCtl) джойстика нет: касание мимо кнопок — камера
      if (joy.id === null && e.pointerType !== 'mouse' && joyZone(x, y, r) && !(ui.steer && ui.steer.vis)) {
        joy.id = e.pointerId; joy.x = joy.y = joy.lx = joy.ly = 0; joy.x0 = x; joy.y0 = y; joy.t0 = performance.now(); joy.moved = 0; joy.late = false;
        if (canInput()) joyBegin(x, y, r);
      } else look.set(e.pointerId, { x, y, x0: x, y0: y, t0: performance.now(), moved: 0 });
    };
    const onMove = e => {
      e.stopPropagation();
      const [x, y] = rel(e);
      const prev = pts.get(e.pointerId); if (prev) pts.set(e.pointerId, { x, y });
      if (S.golf && S.golf.drag && e.pointerId === S.golf.drag.id) { golfAim(x - S.golf.drag.x, y - S.golf.drag.y); return; }
      if (S.look) {
        if (pts.size >= 2 && S.look.pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); S.look.fov = clamp(S.look.pinch.fov * S.look.pinch.d / Math.max(20, d), S.look.L.fovMin, S.look.L.fovMax); }
        else if (prev) { const k = S.look.fov / 55; S.look.yaw -= (x - prev.x) * 0.006 * k; S.look.pitch = clamp(S.look.pitch + (y - prev.y) * 0.005 * k, S.look.L.pitchMin, S.look.L.pitchMax); }
        return;
      }
      if (e.pointerId === joy.id) {
        joy.moved = Math.max(joy.moved, Math.hypot(x - joy.x0, y - joy.y0));
        // палец лёг в паузе (шторка, рука занята) — джойстик начинается отсюда: без рывка и без тапа
        if (!joy.live && canInput()) { joyBegin(x, y); joy.late = true; }
        const v = joyDrag(x, y);
        if (!(ui && ui.J)) { joy.x = v.x; joy.y = v.y; }
        if (v.m > 0 || v.x || v.y) S.moveTo = null;
        return;
      }
      const p = look.get(e.pointerId); if (!p) return;
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y; p.moved += Math.abs(dx) + Math.abs(dy);
      // W7 (желание 3): палец вверх — взгляд на небо, вниз — сверху; за рулём — ещё и вокруг машины; в виде из-за руля — голова
      if (p.moved > 6) {
        if (S.ck && S.ck.active) { S.ckLook.yaw = clamp(S.ckLook.yaw - dx * 0.006, -1.3, 1.3); S.ckLook.pitch = clamp(S.ckLook.pitch - dy * 0.005, -0.5, 0.75); }
        else { if (S.mode === 'drive') S.dYaw = clamp(S.dYaw - dx * 0.0085, -1.4, 1.4); else S.yaw -= dx * 0.0085; S.pitch = clamp(S.pitch - dy * 0.0045, -1.2, 1.6); }
        S.manualT = 3; S.pitchT = 0;
      }
    };
    const onUp = e => {
      e.stopPropagation();
      if (zipUp(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (S.golf && S.golf.drag && e.pointerId === S.golf.drag.id) { const dr = S.golf.drag; S.golf.drag = null; if (e.type === 'pointerup' && dr.aimed) golfShoot(); return; }
      if (S.look && pts.size < 2) S.look.pinch = null;
      if (e.pointerId === joy.id) {
        joy.id = null; joy.x = joy.y = joy.lx = joy.ly = 0; joyEnd();
        // тап по кружку покоя — промах по джойстику, а не «идти туда»
        const H = HUD_(), r = host.getBoundingClientRect();
        if (e.type === 'pointerup' && !joy.late && joy.moved < 10 && performance.now() - joy.t0 < 320 && !(H && H.joyGuard && H.joyGuard(joy.x0, joy.y0, r.width, r.height))) onTap(joy.x0, joy.y0);
        return;
      }
      const p = look.get(e.pointerId); if (!p) return; look.delete(e.pointerId);
      if (e.type === 'pointerup' && p.moved < 10 && performance.now() - p.t0 < 350) onTap(p.x0, p.y0);
    };
    const onWheel = e => { if (!S.look) return; S.look.fov = clamp(S.look.fov * (e.deltaY > 0 ? 1.08 : 0.92), S.look.L.fovMin, S.look.L.fovMax); e.preventDefault(); };
    const onResize = () => resize();
    function bindPedal(el, k) {
      const on = v => e => { e.preventDefault(); e.stopPropagation(); ped[k] = v; el.classList.toggle('down', v); };
      el.addEventListener('pointerdown', on(true)); el.addEventListener('pointerup', on(false)); el.addEventListener('pointerleave', on(false)); el.addEventListener('pointercancel', on(false));
    }
    function bindInput(on) {
      const f = on ? 'addEventListener' : 'removeEventListener';
      window[f]('keydown', onKeyDown); window[f]('keyup', onKeyUp); window[f]('blur', onBlur); window[f]('resize', onResize);
      if (ui) { ui.touch[f]('pointerdown', onDown); ui.touch[f]('pointermove', onMove); ui.touch[f]('pointerup', onUp); ui.touch[f]('pointercancel', onUp); ui.touch[f]('contextmenu', ev => ev.preventDefault()); ui.touch[f]('wheel', onWheel, { passive: false }); }
      if (!on) onBlur();
    }
    function moveInput() {
      if (!canInput()) return null;
      let jx = joy.x, jy = joy.y;
      if (keys.u || keys.d || keys.l || keys.r) { jx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); jy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); }
      const mag = Math.min(1, Math.hypot(jx, jy)); if (mag < 0.06) return null;
      const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw);
      const dx = fx * -jy + rx * jx, dz = fz * -jy + rz * jx, l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l, mag];
    }
    const freeWalk = () => S.mode === 'walk' && !S.sitting && !S.view && !S.look && !S.inShop && !S.dance && !S.golf && !S.climb;
    // тап: житель / место / выход рядом с точкой экрана — подойти и сделать; иначе — идти туда (A* региона)
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function onTap(x, y) {
      if (!canInput() || !freeWalk() || (IA && IA.busy())) return;
      const h = S.h; if (!h) return;
      const W = host.clientWidth, H = host.clientHeight;
      let best = null;
      const consider = (kind, ref, px, py, pz) => { tmpV.set(px, py, pz).project(cam); if (tmpV.z > 1) return; const sx = (tmpV.x + 1) / 2 * W, sy = (1 - tmpV.y) / 2 * H, d = Math.hypot(sx - x, sy - y); if (d < 44 && (!best || d < best.d)) best = { kind, ref, d, x: px, z: pz }; };
      h.npcs.forEach(n => { if (!n.root.visible || n.silent || !n.lines || !n.lines.length) return; const p = n.root.position; consider('npc', n, p.x, p.y + (n.headY || 1.1) * 0.6, p.z); });
      h.spots.forEach(sp => { if ((sp.level || 'ground') === S.level) consider('spot', sp, sp.x, (sp.y || 0) + 0.6, sp.z); });
      h.exits.forEach(ex => { if (S.rid === 'serpentine' && ex.id === 'toCity') return; if ((ex.level || 'ground') === S.level) consider('exit', ex, ex.x, (ex.y || 0) + 0.6, ex.z); });
      if (best) { S.moveTo = { x: best.x, z: best.z, stop: best.kind === 'npc' ? 1.6 : 0.6, thing: best }; S.moveTo.wp = pathTo(best.x, best.z); haptic('light'); return; }
      ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, cam); ray.far = 60;
      const hits = ray.intersectObject(h.root, true);
      const hp = hits.find(q => q.object.isMesh && !(q.object.material && q.object.material.transparent));
      if (!hp) return;
      if (h.walkable && !h.walkable(hp.point.x, hp.point.z)) return;
      S.moveTo = { x: hp.point.x, z: hp.point.z, stop: 0.25 }; S.moveTo.wp = pathTo(hp.point.x, hp.point.z); haptic('light');
    }
    function pathTo(x, z) {
      const h = S.h; if (!h || !h.path) return [];
      try { const p = h.path(S.px, S.pz, x, z); return p ? p.map(q => [q[0], q[1]]) : []; } catch (e) { return []; }
    }

    /* ---------- героиня ---------- */
    const heroMats = () => (hero && hero.mats) || [];
    function heroOpacity(a) {
      heroMats().forEach(m => { const want = a < 0.999; if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; } m.opacity = a; });
      const ol = hero && (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = a > 0.97;
    }
    function makeBlob() {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(70,58,72,.34)'); g.addColorStop(1, 'rgba(70,58,72,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      const tx = new T.CanvasTexture(cv), m = new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false });
      const b = new T.Mesh(new T.PlaneGeometry(0.85, 0.55), m); b.rotation.x = -PI / 2; b.renderOrder = 1; b.userData.own = [tx, m, b.geometry];
      return b;
    }
    // W4A: тень героини на high — простые формы по костям (голова, корпус, волосы, ноги ≈ 600 треуг.) вместо полной сетки
    // (≈ 28 тыс. треуг. в проходе теней). Невидимы в кадре (colorWrite: false), только отбрасывают тень; ноги шагают
    function makeShadowProxy() {
      if (regionQ !== 'high' || !renderer || !renderer.shadowMap.enabled || QS.get('heroShadow') === 'full' || !hero || !hero.rig || !hero.rig.anim || !hero.rig.anim.bones) return null;
      const B = hero.rig.anim.bones; if (!B.head || !B.hips || !B.thigh_L || !B.foot_L || !B.thigh_R || !B.foot_R) return null;
      const mat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), parts = [];
      const sph = new T.SphereGeometry(1, 12, 8), cyl = new T.CylinderGeometry(1, 1, 1, 10, 1);
      const mk = geo => { const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.name = 'heroShadowProxy'; m.renderOrder = -1; m.userData.dn = 'none'; parts.push(m); return m; };
      const P = { head: mk(sph), torso: mk(cyl), hair: mk(sph), legL: mk(cyl), legR: mk(cyl) };
      const a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3(), up = new T.Vector3(0, 1, 0);
      const between = (m, p0, p1, r) => { d.subVectors(p1, p0); const l = d.length() || 1e-3; m.position.copy(p0).addScaledVector(d, 0.5); m.scale.set(r, l, r); m.quaternion.setFromUnitVectors(up, d.multiplyScalar(1 / l)); };
      hero.root.traverse(m => { if (m.isMesh && m.castShadow && m.name !== 'heroShadowProxy') { m.castShadow = false; m.userData.shadow0 = true; } });
      return {
        parts,
        attach(sc) { parts.forEach(m => sc.add(m)); },
        update() {
          const vis = hero.root.visible && !!scene && (hero.root.parent === scene || (car && hero.root.parent === car.body)); parts.forEach(m => { m.visible = vis; }); if (!vis) return;
          const k = hero.root.scale.y || 1;
          B.head.getWorldPosition(a); P.head.position.copy(a).addScaledVector(up, 0.12 * k); P.head.scale.set(0.3 * k, 0.33 * k, 0.3 * k);
          B.hips.getWorldPosition(b); between(P.torso, b, a, 0.17 * k);
          P.hair.position.copy(a).addScaledVector(up, -0.32 * k); P.hair.scale.set(0.24 * k, 0.36 * k, 0.2 * k);
          B.thigh_L.getWorldPosition(a); B.foot_L.getWorldPosition(b); between(P.legL, a, b, 0.07 * k);
          B.thigh_R.getWorldPosition(a); B.foot_R.getWorldPosition(b); between(P.legR, a, b, 0.07 * k);
        },
        dispose() { parts.forEach(m => { if (m.parent) m.parent.remove(m); }); sph.dispose(); cyl.dispose(); mat.dispose(); hero.root.traverse(m => { if (m.userData.shadow0) { m.castShadow = true; delete m.userData.shadow0; } }); },
      };
    }
    const seatLocal = () => (car.heroSeat ? car.heroSeat.clone() : new T.Vector3(car.seatDriver.x, car.seatDriver.y - 0.52, car.seatDriver.z));
    // в машину без анимации (возврат в город: машина города, контроллер города посадит сам)
    function heroToCar() {
      if (!hero || !car || !car.body) return;
      car.body.add(hero.root); hero.root.position.copy(seatLocal()); hero.root.rotation.set(0, 0, 0); hero.root.visible = true;
      if (hero.body) { hero.body.position.y = 0; hero.body.rotation.x = 0; }
      inCarNow = true; S.sitting = null;
      if (blob) blob.visible = false;
      if (hero.rig) hero.rig.prev = null;
    }
    function heroToGround(x, z, ang) {
      if (!hero) return;
      if (hero.root.parent !== scene) scene.add(hero.root);
      inCarNow = false;
      S.px = x; S.pz = z; S.py = S.h ? S.h.ground(x, z) : 0; S.ang = ang; S.vx = S.vz = 0; S.iaDy = 0;
      hero.root.position.set(S.px, S.py, S.pz); hero.root.rotation.set(0, ang, 0); hero.root.visible = true;
      const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = true;
      if (blob) blob.visible = true;
      if (hero.rig) hero.rig.prev = null;
    }
    // W4A: поставить героиню и СРАЗУ корень героини — до IA.play: слой рук запоминает корень в начале действия
    function placeHero(x, z, ang, yaw) {
      if (!S.h) return;
      S.px = x; S.pz = z; S.py = S.h.ground(x, z); if (ang !== undefined) S.ang = ang; if (yaw !== undefined) S.yaw = yaw; S.camInit = false; S.iaDy = 0; S.vx = S.vz = 0;
      if (hero) { hero.root.position.set(S.px, S.py, S.pz); hero.root.rotation.set(0, S.ang, 0); hero.root.updateMatrixWorld(true); if (hero.rig) hero.rig.prev = null; }
    }
    const inCarMode = () => S.mode === 'drive' || !!(drv && (drv.mode === 'enter' || drv.mode === 'exit' || drv.mode === 'stopping' || (drv.mode === 'drive' && drv.S && drv.S.hero)));
    let tAnim = 0;
    // образ героини (js/hero_outfits.js): сумочка прячется в машине, спорте, полёте и на зиплайне, длинный подол подбирается
    const outfitTick = (dt, st) => { if (hero && hero._outfit && window.HeroOutfits) { try { HeroOutfits.update(hero, dt, st); } catch (e) { /* без образа */ } } };
    function animHero(dt) {
      if (!hero) return;
      tAnim += dt;
      // в машине, садится или выходит: корнем героини владеет контроллер машины (drive.js), поза — drv.animState()
      // волна 6 (проверка): посадка кончается внутри drv.update (героиня уже в кузове, drv.mode 'drive'), а inCarNow = true ставит getIn()
      // только после await — в этом кадре её нельзя ставить по мировым S.px/S.pz: иначе она улетает от машины (~27 м) и пропадает с сиденья
      const R = hero.rig, car_ = inCarNow || !!(drv && (drv.mode === 'enter' || drv.mode === 'exit' || drv.mode === 'stopping' || (drv.mode === 'drive' && drv.S && drv.S.hero)));
      if (!car_) { hero.root.position.set(S.px, S.py + (S.iaDy || 0), S.pz); hero.root.rotation.set(0, S.ang, 0); hero.root.visible = true; }
      if (blob) {
        // W5: в прыжке тень остаётся на полу (под ней — земля, ящик или крыша) и чуть меньше
        const fl = S.floor != null && mvOn() ? S.floor : S.py, up = Math.max(0, S.py - fl);
        blob.position.set(S.px, fl + 0.03, S.pz); blob.scale.setScalar(Math.max(0.55, 1 - up * 0.18));
        blob.visible = !car_ && S.mode !== 'drive' && S.mode !== 'zip' && S.mode !== 'fly';
      }
      if (R) {
        if (car_) {
          const cs = drv && drv.animState ? drv.animState() : { speed: 0, sitting: true, sitPose: 'chair', drive: car && car.driveInput ? car.driveInput() : null };
          S.animSt = cs; R.anim.update(dt, cs); if (hero.body) { hero.body.position.y = 0; hero.body.rotation.x = 0; } return;
        }
        const dd = R.prev ? Math.hypot(S.px - R.prev.x, S.pz - R.prev.z) : 0;
        const spd = S.sitting ? 0 : dd > 0.6 ? 0 : dd / Math.max(1e-3, dt);
        R.spd += (Math.min(spd, 6) - R.spd) * Math.min(1, dt * 12);
        const tr = R.prev && dt > 0 ? angDiff(S.ang, R.prev.a) / dt : 0; R.prev = { x: S.px, z: S.pz, a: S.ang };
        R.sit += ((S.sitting ? 1 : 0) - R.sit) * Math.min(1, dt * 7);
        const st = { speed: R.spd, sitting: !!S.sitting, sitPose: 'chair', waving: S.waveT > 0, turnRate: tr, celebrate: S.cheerT > 0, idle: !S.walking && !S.sitting && !S.climb && !blocked(), carry: S.flags.jug ? 'item' : false };
        // W5: Move (в воздухе/кувырке — без шага и ожидания) → руки (Interact) → «Бум!» (на время возни — без ожидания и маханий)
        const useMv = mvOn() && !S.sitting;
        let st2 = useMv ? S.mv.animState(st) : st;
        if (IA) st2 = IA.animState(st2);
        if (S.pf && S.pf.animState) st2 = S.pf.animState(st2);
        S.animSt = st2;
        R.anim.update(dt, st2);
        if (R.anim.step !== R.step) { R.step = R.anim.step; if (!S.sitting && R.spd > 0.3) sfx('step', { surface: 'stone' }); }
        // волна 4: «вытереть ботинок о траву» после коровьей лепёшки — левая нога шаркает назад-вперёд
        if (S.wipeDelay > 0) S.wipeDelay -= dt; else if (S.wipeT > 0 && R.anim.bones) {
          S.wipeT -= dt; const B = R.anim.bones, k = Math.min(1, S.wipeT / 0.3, (1.5 - S.wipeT) / 0.3), w = Math.sin(tAnim * 15);
          if (B.thigh_L) B.thigh_L.rotation.x -= 0.32 * k * (0.6 + 0.4 * w); if (B.shin_L) B.shin_L.rotation.x += 0.55 * k; if (B.foot_L) B.foot_L.rotation.x += 0.25 * k * w;
          if (B.spine) B.spine.rotation.x += 0.12 * k; if (B.head) B.head.rotation.x += 0.25 * k;
        }
        const sk = R.sit < 0.002 ? 0 : R.sit > 0.998 ? 1 : R.sit, sitE = sk * sk * (3 - 2 * sk);
        const seatY = S.sitting ? S.sitting.h - S.py + R.seat - R.hip : (R.seatY || 0);
        if (S.sitting) R.seatY = seatY;
        hero.body.position.y = seatY * sitE; hero.body.rotation.x = 0;
        if (useMv) S.mv.pose(dt);   // прыжок, приземление, кувырок — поверх позы HeroAnim (до IA.update)
      } else if (hero.statue) {
        const U = hero.statue.U, moving = S.walking && !car_;
        if (moving) S.phase = (S.phase || 0) + dt * 10.5;
        S.walkAmt = (S.walkAmt || 0) + ((moving ? 1 : 0) - (S.walkAmt || 0)) * Math.min(1, dt * 10);
        U.hdSwing.value = Math.sin(S.phase || 0) * S.walkAmt * 0.42; U.hdSit.value = S.sitting || car_ || inCarNow ? 1 : 0;
        hero.body.position.y = S.sitting && !car_ ? S.sitting.h - S.py + 0.12 - U.hdRig.value.y : Math.abs(Math.sin(S.phase || 0)) * 0.035 * S.walkAmt;
      } else if (hero.legs) {
        if (S.walking) S.phase = (S.phase || 0) + dt * 10.5;
        hero.legs.forEach((l, i) => { l.rotation.x = (i ? -1 : 1) * Math.sin(S.phase || 0) * (S.walking ? 0.6 : 0); });
        hero.body.position.y = S.sitting && !car_ ? S.sitting.h - S.py - 0.35 : 0;
      }
      if (S.waveT > 0) S.waveT -= dt; if (S.cheerT > 0) S.cheerT -= dt;
    }

    /* ---------- руки (js/interact.js) ---------- */
    const iaSetRoot = (p, yaw) => { S.px = p.x; S.pz = p.z; S.ang = yaw; const g = S.h ? S.h.ground(p.x, p.z) : p.y; S.iaDy = p.y - g; S.py = g; };
    // interact.js не освобождает геометрию своих «лапок» жителей (makePaw) и брошенных недоеденных покупок (NEEDS CITY):
    // регион замечает лапки в сцене во время передачи и освобождает их геометрию, когда они убраны; покупки — при drop
    const iaLeft = new Set();
    function iaSweep(final) {
      if (scene) scene.children.forEach(o => { if (o.isMesh && (o.name === 'interact:paw' || o.name === 'interact:pawArm')) iaLeft.add(o); });
      iaLeft.forEach(o => { if (o.parent && !final) return; if (o.parent) o.parent.remove(o); try { o.geometry.dispose(); } catch (e) { /* ok */ } iaLeft.delete(o); });
    }
    function freeItem(k) { const it = k && k.userData && k.userData.it; if (it && it.def && it.def.parts && /^item:/.test(k.name || '') && it.dispose) { try { it.dispose(); } catch (e) { /* ok */ } } }
    function iaDrop() { if (!IA || !IA.drop) return null; let k = null; try { k = IA.drop(); } catch (e) { /* ok */ } freeItem(k); return k; }
    const iaOn = n => { iaSweep(false); S.iaEv.push(n); if (S.iaEv.length > 80) S.iaEv.shift(); const k = IA_SFX[n]; if (k) sfx(k, k === 'step' ? { surface: 'stone' } : undefined); if (n === 'busy') toast('Руки заняты', 1200); };
    function iaStop() { if (!IA) return; S.iaGen++; try { IA.cancel(); } catch (e) { /* ok */ } }
    // цепочка действий рук: alive() — не отменили (палец на джойстике), регион тот же
    function iaRun(fn) {
      const gen = ++S.iaGen, ep = S.epoch;
      const alive = () => gen === S.iaGen && ep === S.epoch && S.active;
      return Promise.resolve().then(() => fn(alive)).catch(e => { console.warn('region hands', e); });
    }
    const pawOf = (n, paw) => ({ root: n.root, color: (paw && paw.color) || '#EDE4DA', height: (paw && paw.height) || 0.62, meetY: (paw && paw.meetY) || 1.0 });

    /* ---------- машина ---------- */
    const wantSedan = () => { try { if (refs.carKind) return refs.carKind === 'sedan'; if (WORLD.carChoice) return WORLD.carChoice() === 'sedan'; } catch (e) { /* ниже */ } return false; };
    // кабриолет — быстрая машина (желание автора): на серпантине 21 м/с вместо 18, разгон 9,5 м/с², тормоз 12,5; седан — как был.
    // «чуть быстрее»: кабриолет 23 м/с, разгон 10, тормоз 13 (седан — 20 м/с в CFG drive.js)
    // Руль от скорости у drive.js свой (steerMax → steerHi к vmax) — растягивается сам
    const CAB_DRIVE = { vmax: 23, acc: 10, brake: 13, vCap: 25 };
    const driveCfgOf = c => Object.assign({}, c.driveCfg, c.kind === 'sedan' || wantSedan() ? null : CAB_DRIVE);
    function ensureCar() {
      if (car) return car;
      const V = V_();
      try {
        if (wantSedan() && window.VEHICLES && VEHICLES.sedan) car = V.drive.makeCar(T, { kit: refs.kit, factory: () => VEHICLES.sedan.makeCar(refs.kit || T, { kit: refs.kit, quality: regionQ, lite: regionQ !== 'high' }) });
        else car = V.drive.makeCar(T, { kit: refs.kit });
        ownCar = true;
      } catch (e) { console.warn('region car', e); car = null; }
      return car;
    }
    const carKind = () => (car && car.kind === 'sedan' ? 'sedan' : 'coupe');
    function parkCar(x, z, ry) {
      if (!car) return;
      const h = S.h, y = h ? h.ground(x, z) : 0;
      if (car.S && car.place) { Object.assign(car.S, { x, z, ry, v: 0, steer: 0, pitch: 0, roll: 0, sq: 0, squash: 0 }); car.place(); }
      const r = car.root || car; r.position.set(x, y, z); r.rotation.set(0, ry, 0);
    }
    function placeCarStart() {
      const h = S.h; if (!drv || !h) return;
      drv.teleport(h.carSpawn); if (chase) chase.snap();
      (h.moments || []).forEach(m => { m.done = false; m.t = null; });
      S.dir = 'up'; S.exitArmed = {};
    }
    function placeCarTop() {
      const h = S.h; if (!drv || !h) return;
      const ex = h.exits.find(e => e.id === 'toVillage'), s0 = Math.max(0, (ex && ex.s != null ? ex.s : h.road.len) - (ex ? ex.r : 5) - 9);
      const q = h.road.sample(s0); drv.teleport({ x: q.x, z: q.z, ry: q.th + PI }); if (chase) chase.snap();
      (h.moments || []).forEach(m => { m.done = true; m.t = null; });
      S.dir = 'down'; S.exitArmed = {};
    }
    // из отеля — в конце ветки носом вниз (у развилки направо — к городу, налево — к селу)
    function placeCarHotel() {
      const h = S.h; if (!drv || !h) return;
      const ex = h.exits.find(e => e.id === 'toHotel'), B = h.road && h.road.branch;
      if (ex && B && B.sample) { const q = B.sample(Math.max(0, (ex.s != null ? ex.s : B.len) - (ex.r || 5) - 8)); drv.teleport({ x: q.x, z: q.z, ry: q.th + PI }); }
      else { placeCarStart(); return; }
      if (chase) chase.snap();
      (h.moments || []).forEach(m => { m.done = true; m.t = null; });
      S.dir = 'down'; S.exitArmed = {};
    }
    function setupCar(h, id, from) {
      const c = ensureCar(); if (!c) return null;
      const cr = c.root || c, V = V_();
      if (id === 'serpentine' && V.drive) {
        scene.add(cr);
        drv = V.drive.create({ THREE: T, car: c, ground: h.ground, colliders: h.colliders, road: h.road, start: h.carSpawn, blob: true, dynamic: h.dynamic, collide: h.collide, season, cfg: driveCfgOf(c) });
        chase = V.drive.chase({ THREE: T, camera: cam, ground: h.ground });
        if (from === 'kubachi') placeCarTop(); else if (from === 'hotel') placeCarHotel(); else placeCarStart();
        if (hero) { if (drv.heroIn) drv.heroIn(hero, { instant: true }); else heroToCar(); }
        petsToCar();
        inCarNow = true; S.mode = 'drive'; S.sitting = null;
        S.px = drv.S.x; S.py = drv.S.y; S.pz = drv.S.z;
      } else if (h.drive && h.drive.road && V.drive) {
        // волна 6 (VILLAGE-ROADS): по селу тоже ездим — тот же drive.js, «дорога» — сеть проездов села (h.drive.road);
        // машина стоит на h.carSpawn (парковка; из отеля — наверху дороги к школе, и тогда героиня уже за рулём)
        scene.add(cr);
        drv = V.drive.create({ THREE: T, car: c, ground: h.drive.ground || h.ground, colliders: h.drive.colliders, road: h.drive.road, start: h.carSpawn, blob: true, dynamic: h.drive.dynamic || h.dynamic, collide: h.collide, season, cfg: Object.assign(driveCfgOf(c), h.drive.cfg) });   // по селу — тише (h.drive.cfg: vmax 13)
        chase = V.drive.chase({ THREE: T, camera: cam, ground: h.ground });
        S.dir = 'village'; S.exitArmed = {};
        if (h.drive.heroInCar && hero) {
          if (drv.heroIn) drv.heroIn(hero, { instant: true }); else heroToCar();
          petsToCar();
          inCarNow = true; S.mode = 'drive'; S.sitting = null;
          S.px = drv.S.x; S.py = drv.S.y; S.pz = drv.S.z; if (chase) chase.snap();
        } else { drv.S.mode = 'parked'; drv.update(1 / 60, { brake: true }); }
      } else if (h.carSpawn) { scene.add(cr); parkCar(h.carSpawn.x, h.carSpawn.z, h.carSpawn.ry); }
      S.carLamps = null;
      return c;
    }
    // W7 (желание 10): вид «из-за руля» вкл/выкл; наружу — следилка продолжает с того места, где камера (без рывка)
    function ckSet(on) {
      if (!S.ck) return false;
      const was = S.ck.active;
      on = !!on && S.mode === 'drive' && !!(car && car.cockpit);
      S.ck.on(on); S.ckLook.yaw = S.ckLook.pitch = 0;
      if (was && !on && chase && chase.resume) chase.resume();
      const H = HUD_(); if (ui && ui.ck && H && H.sicon) { ui.ck.classList.toggle('on', on); H.sicon(ui.ck, on ? '🎥' : '👁', on ? 'Вид сзади' : 'Вид из-за руля'); }
      if (on && !was) hint('Вид из-за руля · 🎥 — снова сзади', 1800);
      return on;
    }
    function ckBtn(sitLike) { if (ui && ui.ck) show(ui.ck, S.mode === 'drive' && !sitLike && !S.busy && !!(S.ck && car && car.cockpit && drv)); }
    // волна 7: внешние дороги села уходят за пешую сетку — там ей не пройти. Выйти можно, если проходимы точка выхода (drv.exitSpot —
    // туда она встанет) и хотя бы две из четырёх точек вокруг (0,7 м); иначе — подсказка тостом (не реплика: не в озвучку)
    const OUT_NO = 'Здесь не выйти — доедь до смотровой, развилки или конца дороги';
    function outBlocked() {
      const h = S.h; if (S.rid !== 'kubachi' || !h || !h.walkable || !drv) return false;
      const p = drv.exitSpot ? drv.exitSpot() : drv.doorPoint ? drv.doorPoint(1) : null; if (!p) return false;
      if (!h.walkable(p.x, p.z)) return true;
      if (h.reachable && !h.reachable(p.x, p.z)) return true;   // и не «остров»: оттуда пешком до площади
      let n = 0; for (let i = 0; i < 4; i++) { const a = drv.S.ry + i * PI / 2; if (h.walkable(p.x + Math.sin(a) * 0.7, p.z + Math.cos(a) * 0.7)) n++; }
      return n < 2;
    }
    // волна 7: по дорогам села можно ездить — подсказка один раз за сессию, когда она пришла пешком (после обычной подсказки)
    // (при каз «auto» её тост «Снять каз…» идёт до ≈ 7 с после шторки — подсказка про езду после него, не поверх; «один раз» —
    // только если и правда показали)
    function driveTip() {
      if (S.driveTip || S.rid !== 'kubachi' || S.mode !== 'walk' || !drv || !(S.h && S.h.drive)) return;
      const kazToast = KAZ_MODE() === 'auto' && kazOk() && !kazWorn();
      later(kazToast ? 7600 : 3700, () => { if (!S.driveTip && S.rid === 'kubachi' && S.mode === 'walk') { S.driveTip = true; hint('Здесь можно ездить по дорогам: садись за руль 🚗', 3500); } });
    }
    // «Выйти» где угодно (машина сама дотормаживает), «Сесть за руль» у стоящей машины
    async function getOut() {
      if (S.mode !== 'drive' || !drv || !drv.heroOut || !drv.canExit() || S.busy) return false;
      if (outBlocked()) { toast(OUT_NO, 2800, { replace: true }); haptic('light'); return false; }   // кнопка остаётся: тап — подсказка
      ckSet(false); S.busy = true; let r = null;
      try { r = await drv.heroOut(hero, scene, {}); } catch (e) { console.warn('region heroOut', e); }
      S.busy = false;
      if (!r || !S.active) return false;
      inCarNow = false; S.mode = 'walk'; S.px = r.x; S.pz = r.z; S.py = S.h.ground(r.x, r.z); S.ang = r.ry; S.yaw = drv.S.ry; S.camInit = false; S.vx = S.vz = 0;
      if (hero.rig) hero.rig.prev = null;
      if (S.rid !== 'serpentine' && S.h) petsOut(S.h, null);   // волна 6: в селе — выходят вместе с ней
      ui.root.classList.toggle('drive', false); emit('region:car', { mode: 'out' });
      later(500, () => heroSay2(S.h && S.h.benches && S.h.benches.some(b => Math.hypot(b.x - S.px, b.z - S.pz) < 12) ? 'Посижу на лавочке?' : 'Какой воздух!', 1800));
      return r;
    }
    async function getIn() {
      if (S.mode !== 'walk' || !drv || !drv.heroIn || !drv.canEnter(S.px, S.pz) || S.busy) return false;
      iaStop(); if (IA && IA.drop) iaDrop();
      S.busy = true; S.sitting = null; S.view = null;
      try { await drv.heroIn(hero, {}); } catch (e) { console.warn('region heroIn', e); }
      S.busy = false; if (!S.active) return false;
      inCarNow = true; S.mode = 'drive'; if (chase) chase.snap();
      if (S.rid !== 'serpentine') petsToCar();   // волна 6: в селе зверята запрыгивают следом
      ui.root.classList.toggle('drive', true); emit('region:car', { mode: 'in' });
      return true;
    }

    /* ---------- W5 MOVE (js/move.js): бег (джойстик за край кружка, Shift) и «Прыжок», запрыгнуть на всё, до чего достаёт
       (лавочки, ящики, крыша машины, крыши села), мультяшные падения (присела / кувырок «Ух!» / «Ой!» и мягкий возврат), машина
       твёрдая (коробки по модели). Один Move на регион; кнопка «Прыжок» — одна на поездку. На площадке башни (S.level 'top') — прежняя ходьба (парапет, лестница). */
    const mvPool = [], mvArr = [], mvCar = { type: 'car', src: null, kind: 'coupe' };
    // подвижные коллайдеры (каждый кадр, без выделений): жители — круги, машина — коробки (на серпантине — и после «Выйти»)
    function mvDyn() {
      mvArr.length = 0; const h = S.h; if (!h) return mvArr;
      let k = 0;
      for (let i = 0; i < h.npcs.length; i++) {
        const n = h.npcs[i]; if (!n.root.visible || n.noBlock) continue; const p = n.root.position;
        const c = mvPool[k] || (mvPool[k] = { type: 'circle', x: 0, z: 0, r: 0.42, y0: 0, y1: 0, id: 'npc' }); k++;
        c.x = p.x; c.z = p.z; c.r = n.blockR || 0.42; c.y0 = p.y - 0.5; c.y1 = p.y + 1.3; mvArr.push(c);
      }
      const cr = car && (car.root || car);
      if (cr && !inCarNow && cr.parent === scene && cr.visible !== false) { mvCar.src = car; mvCar.kind = carKind(); mvArr.push(mvCar); }
      // коробка машины контроллера серпантина (drive.collider, id 'car') — не нужна: машина уже коробками по модели
      if (h.dynamic) for (let i = 0; i < h.dynamic.length; i++) { const c = h.dynamic[i]; if (c && !c.off && c.id !== 'car') mvArr.push(c); }
      return mvArr;
    }
    const mvOn = () => !!(S.mv && S.level !== 'top' && S.mode === 'walk' && !inCarNow);
    const mvBusy = () => !!(S.mv && S.mv.busy());
    // игра сама переставила героиню (место, лавка, шторка, руки, «Бум!»): далеко — как телепорт (точки возврата заново), рядом — на
    // пол под точкой (ящик, крыша — если стояла на них)
    function mvFollow() {
      const m = S.mv; if (!m) return;
      const q = m.state.pos, d = Math.hypot(q.x - S.px, q.z - S.pz);
      if (d > 1.2) m.teleport({ x: S.px, y: S.py, z: S.pz }, S.ang);
      else if (d > 1e-4) { const y = m.supportAt(S.px, S.pz, S.py); m.sync(S.px, isFinite(y) && y > -1e8 ? y : undefined, S.pz); }
    }
    function mvPlace() { if (S.mv) { S.mv.teleport({ x: S.px, y: S.py, z: S.pz }, S.ang); S.floor = null; S.camY = null; } }
    function mvStep(dt, inp) {
      mvFollow();
      const st = S.mv.update(dt, inp);
      S.px = st.pos.x; S.pz = st.pos.z; S.py = st.pos.y; S.floor = st.floor; S.vx = st.vx; S.vz = st.vz;
      return st;
    }
    // короткие реплики героини при падениях (Move.CFG.sayTumble / sayRespawn) — голосом героини
    const MV_SAY = [{ who: 'hero', text: 'Ух!' }, { who: 'hero', text: 'Оп-па!' }, { who: 'hero', text: 'Уф!' }, { who: 'hero', text: 'Ой!' }];
    function mvCreate(h) {
      if (S.mv) { try { S.mv.dispose(); } catch (e) { /* ok */ } S.mv = null; }
      if (!window.Move || !Move.create || !hero || !h || !h.ground || !ui) return;
      try {
        S.mv = Move.create({
          THREE: T, hero, anim: hero.rig ? hero.rig.anim : null, face: false,
          ground: (x, z) => h.ground(x, z), colliders: () => (typeof h.moveColliders === 'function' ? h.moveColliders() : h.moveColliders || h.colliders), dynColliders: mvDyn,
          safe: h.walkable ? (x, z) => h.walkable(x, z) : null,
          scene, camera: cam, host: ui.root,
          sayTumble: MV_SAY.slice(0, 3).map(l => l.text), sayRespawn: [MV_SAY[3].text],
          say: t => { heroSay2(t, 1400); voiceBubble('hero', t); },
          onFall: (k, inf) => {
            S.mvLog.push(k + (inf && inf.drop ? ':' + inf.drop : '')); if (S.mvLog.length > 40) S.mvLog.shift();
            if (k === 'back') { S.camInit = false; S.camY = null; S.ang = S.mv ? S.mv.state.ang : S.ang; if (hero.rig) hero.rig.prev = null; }
          },
          on: n => {
            if (n === 'land') sfx('step', { surface: 'stone' }); else if (n === 'jump') sfx('tap');
            else if (n === 'tumble' || n === 'respawn') { sfx('pop'); haptic('light'); }
          },
        });
      } catch (e) { console.warn('region move', e); S.mv = null; }
      if (!S.mv) return;
      S.mv.teleport({ x: S.px, y: S.py, z: S.pz }, S.ang);
      try { if (mvUi) mvUi.bind(S.mv); else if (Move.mountButtons) mvUi = Move.mountButtons(ui.root, { move: S.mv }); } catch (e) { console.warn('region move buttons', e); }
    }
    function mvDrop() { if (S.mv) { try { S.mv.dispose(); } catch (e) { /* ok */ } S.mv = null; } S.floor = null; S.camY = null; }

    /* ---------- кот и собачка: едут сзади; в селе и отеле ходят за ней, ждут у машины / лавки / башни ---------- */
    function findPets() {
      const out = [], P = refs.pets || {};
      const add = (kind, root, extra) => { if (!root || !root.isObject3D || out.some(p => p.root === root) || (hero && root === hero.root)) return; out.push(Object.assign({ kind, root, x: 0, y: 0, z: 0, ry: 0, spd: 0, phase: 0, state: 'car', stuckT: 0, wx: 0, wz: 0 }, extra || {})); };
      const onBody = r => !!(car && car.body && r && r.parent === car.body);
      // явно переданные (refs.pets): едут с ней, если сидят в машине или гуляют рядом (видны); собачка — только если гуляет с ней
      if (P.cat) { const r = P.cat.root || P.cat; if (onBody(r) || r.visible) add('cat', r, { cat: P.cat.body && P.cat.tail ? P.cat : null }); }
      if (P.dog) { const n = P.dog.n || null, r = P.dog.root || (n && n.root) || P.dog, on = typeof P.dog.active === 'function' ? P.dog.active() : true; if (on && (onBody(r) || r.visible !== false)) add('dog', r, { I: (n && n.I) || P.dog.I || null, who: (n && n.id) || null }); }
      // запас: кто сидит на заднем диванчике машины города (car.seatPass — кот, car.seatDog — собачка)
      if (car && car.body) car.body.children.forEach(ch => {
        if (!ch.isObject3D || ch.isMesh || ch.isBone || (hero && ch === hero.root)) return;
        [['cat', car.seatPass], ['dog', car.seatDog]].forEach(([kind, seat]) => { if (seat && seat.isVector3 && ch.position.distanceTo(seat) < 0.12) add(kind, ch, {}); });
      });
      out.forEach(p => { p.home = { parent: p.root.parent, pos: p.root.position.clone(), rot: p.root.rotation.clone(), vis: p.root.visible }; p.state = onBody(p.root) ? 'car' : 'free'; });
      return out;
    }
    // зверята — на заднем диванчике текущей машины (кот — справа, собачка — слева); нет мест — ждут «в салоне» невидимыми
    function petsToCar() {
      if (!pets.length || !car) return;
      pets.forEach(p => {
        const seat = p.kind === 'cat' ? car.seatPass : car.seatDog;
        if (car.body && seat && seat.isVector3) { car.body.add(p.root); p.root.position.copy(seat); p.root.rotation.set(0, 0, 0); p.root.visible = true; }
        else { if (p.root.parent) p.root.parent.remove(p.root); p.root.visible = false; }
        p.state = 'car'; p.spd = 0;
        if (p.I) { p.I.st.spd = 0; p.I.st.sit = 1; }
      });
    }
    function petsOut(h, from) {
      if (!pets.length || !car || !scene) return;
      const c = car.S ? car.S : { x: h.carSpawn.x, z: h.carSpawn.z, ry: h.carSpawn.ry };
      pets.forEach((p, i) => {
        const side = i ? -1 : 1, ry = c.ry || 0;
        let x = c.x + Math.cos(ry) * 1.5 * side - Math.sin(ry) * (1.2 + i * 0.4), z = c.z - Math.sin(ry) * 1.5 * side - Math.cos(ry) * (1.2 + i * 0.4);
        if (h.walkable && !h.walkable(x, z)) { x = S.px - Math.sin(S.ang) * 1.2 + side * 0.5; z = S.pz - Math.cos(S.ang) * 1.2; }
        scene.add(p.root); p.root.visible = true;
        p.x = x; p.z = z; p.y = h.ground(x, z); p.ry = ry; p.spd = 0; p.stuckT = 0;
        p.root.position.set(p.x, p.y, p.z); p.root.rotation.set(0, p.ry, 0);
        // после зиплайна машина ждёт на парковке — зверята ждут у неё, пока героиня не подойдёт
        p.state = from === 'zipline' ? 'wait' : 'follow'; p.wx = x; p.wz = z;
        if (p.I) { p.I.st.sit = p.state === 'wait' ? 1 : 0; p.I.st.wag = 0.9; }
      });
    }
    function petsHome() {
      pets.forEach(p => { const H = p.home; if (H && H.parent) { H.parent.add(p.root); p.root.position.copy(H.pos); p.root.rotation.copy(H.rot); } else if (p.root.parent) p.root.parent.remove(p.root); p.root.visible = H ? H.vis : true; });
      pets = [];
    }
    let petT = 0;
    function petsUpdate(dt) {
      if (!pets.length || !S.h || S.rid === 'serpentine') return;
      petT += dt;
      const h = S.h, hold = !!(S.inShop || S.climb || S.level === 'top' || S.mode === 'zip' || S.mode === 'climb' || S.mode === 'fly' || S.sport || (S.sitting && S.sitting.hay));
      pets.forEach((p, i) => {
        if (p.state === 'car') return;
        let tx, tz;
        if (p.state === 'wait') {
          tx = p.wx; tz = p.wz;
          if (!hold && Math.hypot(S.px - p.x, S.pz - p.z) < 6) { p.state = 'follow'; if (p.I) { p.I.hop(); p.I.st.happy = 1; setTimeout(() => { if (p.I) p.I.st.happy = 0; }, 1200); } }
        } else if (hold) { p.state = 'wait'; p.wx = p.x; p.wz = p.z; tx = p.x; tz = p.z; }
        else if (S.mv && S.mv.state.speed < 0.15 && S.mv.state.grounded && Math.hypot(S.px - p.x, S.pz - p.z) < 2.4 && Math.hypot(S.px - p.x, S.pz - p.z) > 0.6 && Math.abs(p.y - S.py) < 0.5) { tx = p.x; tz = p.z; }   // стоит — зверёк сидит рядом (можно повернуться и бупнуть), не бегает ей за спину
        else {
          const side = i ? -1 : 1, back = 1.15 + i * 0.35;
          tx = S.px - Math.sin(S.ang) * back + Math.cos(S.ang) * 0.62 * side; tz = S.pz - Math.cos(S.ang) * back - Math.sin(S.ang) * 0.62 * side;
        }
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (p.state === 'follow' && (d > 14 || p.stuckT > 2.2)) {   // отстали (лестница, терраса) — догоняют «за кадром»
          const g = h.ground(tx, tz); if ((!h.walkable || h.walkable(tx, tz)) && Math.abs(g - S.py) < 0.6) { p.x = tx; p.z = tz; p.y = g; } else { p.x = S.px - Math.sin(S.ang) * 0.6; p.z = S.pz - Math.cos(S.ang) * 0.6; p.y = S.py; }
          p.stuckT = 0;
        }
        const vmax = p.kind === 'cat' ? 7.6 : 8.2, spd = d > 0.35 ? Math.min(vmax, d * 2.6) : 0;   // W6+: она бегает 6,8 м/с — зверята не отстают
        if (spd > 0) {
          let nx = p.x + dx / d * spd * dt, nz = p.z + dz / d * spd * dt;
          if (h.collide) [nx, nz] = h.collide(nx, nz, 0.2, p.y);
          const ny = h.ground(nx, nz), moved = Math.hypot(nx - p.x, nz - p.z);
          if (Math.abs(ny - p.y) < 0.8) { p.x = nx; p.z = nz; p.y += (ny - p.y) * Math.min(1, dt * 14); if (Math.abs(ny - p.y) > 0.3) p.y = ny; }
          p.stuckT = moved < spd * dt * 0.3 && d > 3 ? p.stuckT + dt : 0;
          p.ry += angDiff(Math.atan2(dx, dz), p.ry) * Math.min(1, dt * 9);
        } else { p.ry += angDiff(Math.atan2(S.px - p.x, S.pz - p.z), p.ry) * Math.min(1, dt * 3); p.stuckT = 0; }
        p.spd += (spd - p.spd) * Math.min(1, dt * 8);
        p.root.position.set(p.x, p.y, p.z); p.root.rotation.set(0, p.ry, 0);
        if (p.I) { p.I.st.spd = p.spd; p.I.st.sit = p.spd < 0.08 ? (p.state === 'wait' || S.sitting ? 1 : 0.6) : 0; try { p.I.anim(dt, petT, 0); } catch (e) { /* поза */ } }
        else if (p.cat) { p.phase += dt * 14 * Math.min(1, p.spd); const w = p.spd > 0.1 ? 1 : 0; p.cat.body.position.y = Math.abs(Math.sin(p.phase)) * 0.06 * w; p.cat.body.rotation.x = Math.sin(p.phase) * 0.06 * w; p.cat.tail.rotation.z = Math.sin(petT * 2.2) * 0.3; if (p.cat.head) p.cat.head.rotation.z = Math.sin(petT * 0.9) * 0.06; }
        else { p.phase += dt * 12 * Math.min(1, p.spd); p.root.position.y = p.y + Math.abs(Math.sin(p.phase)) * 0.04 * Math.min(1, p.spd); }
      });
    }

    /* ---------- каз (VILLAGE.kaz): примерка; по приезде — по правилу CONFIG.KAZ_ON_ARRIVAL ---------- */
    const kazWord = () => (named ? 'каз' : 'платок');
    const kazLine = k => { const V = V_(); return V && V.kaz && V.kaz.line ? V.kaz.line(k, named) : ''; };
    const kazOk = () => { const V = V_(); return !!(V && V.kaz && V.kaz.wear && hero && (hero.rig || hero.statue)); };
    const kazWorn = () => { const V = V_(); return !!(V && V.kaz && V.kaz.isWorn && V.kaz.isWorn()); };
    function kazWear(o = {}) {
      if (!kazOk() || kazWorn() || S.rid !== 'kubachi') return false;
      const V = V_();
      try { V.kaz.wear(hero, hero.rig ? hero.rig.anim : null, { instant: !!o.instant, quality: regionQ }); } catch (e) { console.warn('region kaz', e); return false; }
      if (shadowProxy && V.kaz.current) [V.kaz.current.mesh, V.kaz.current.outline, V.kaz.current.group].forEach(g => { if (g && g.traverse) g.traverse(m => { if (m.isMesh) m.castShadow = false; }); });
      updKazBtn(); emit('region:kaz', { worn: true });
      if (o.say !== false) later(o.delay || 700, () => heroSay2(kazLine('heroOn'), 2600));
      return true;
    }
    function kazRemove() { if (!kazWorn()) return false; try { V_().kaz.remove(); } catch (e) { console.warn('region kaz remove', e); } updKazBtn(); emit('region:kaz', { worn: false }); return true; }
    function kazArrive() {
      const mode = KAZ_MODE();
      if (!kazOk() || kazWorn() || mode === 'off') return;
      if (mode === 'auto') afterCurtain(600, () => { if (S.rid === 'kubachi' && kazWear({ delay: 500 })) later(3400, () => toast('Снять ' + kazWord() + ' можно в меню ☰', 3000)); });
      else later(1300, async () => {
        if (S.rid !== 'kubachi' || S.busy || blocked()) return;
        const m = npcBy('mouse'), text = kazLine('offer');
        if (m) { m.faceHero = 4; m.hop && m.hop(); }
        voiceBubble('mouse', text);
        const r = await sheetFn({ title: (m && m.name) || (named ? 'Каз' : 'Праздничный платок'), body: paras([text]), actions: [{ label: 'Примерить', value: 1 }, { label: 'Потом', value: 0, cls: 'soft' }] });
        if (r && S.rid === 'kubachi') kazWear({});
      });
    }
    // HUD v2: «🧣 Снять каз / Надеть каз» — строка меню ☰ (только в селе, пешком); регистрирует begin(), убирает end()
    const kazRowOn = () => !!(S.active && S.rid === 'kubachi' && kazOk() && S.mode === 'walk' && !S.dance && !S.zip);
    const kazRowLabel = () => (kazWorn() ? 'Снять ' : 'Надеть ') + kazWord();
    function updKazBtn() { const H = HUD_(); if (H && H.menu && H.menu.isOpen && H.menu.isOpen() && H.menu.redraw) H.menu.redraw(); }
    function kazBtn() { if (S.busy || (IA && IA.busy())) return kazWorn(); if (kazWorn()) { kazRemove(); toast('Сняла и бережно сложила.', 1600); } else kazWear({}); return kazWorn(); }
    // место у мышки-вышивальщицы (kubachi.js: spot 'kaz_try' → { kind:'kaz', npc:'mouse' })
    async function kazSpot(d) {
      const m = npcBy(d.npc || 'mouse');
      if (kazWorn()) { if (m) { const t = kazLine(Math.random() < 0.5 ? 'pattern' : 'fringe'); bubble(npcHead(m), t, m.name, 3200); voiceBubble('mouse', t); m.faceHero = 3; } return; }
      if (m) { const t = kazLine('offer'); bubble(npcHead(m), t, m.name, 3200); voiceBubble('mouse', t); m.faceHero = 4; m.hop && m.hop(); }
      await sleep(900);
      const r = await sheetFn({ title: named ? 'Каз' : 'Праздничный платок', body: paras([kazLine('pattern')]), actions: [{ label: 'Примерить', value: 1 }, { label: 'Потом', value: 0, cls: 'soft' }] });
      if (r && kazWear({})) { if (m) later(1600, () => { const t = kazLine('careful'); bubble(npcHead(m), t, m.name, 2400); voiceBubble('mouse', t); }); }
    }

    /* ---------- регионы: загрузка и выгрузка (под шторкой) ---------- */
    const REG = id => (V_() && V_().regions ? V_().regions[id] : null);
    function unload() {
      bubbles.forEach(b => { b.until = 0; });
      if (IA) { iaStop(); try { if (IA.drop) iaDrop(); } catch (e) { /* ok */ } }
      iaSweep(true);
      // карты теней солнца и фонарей региона (high) — render target на каждую загрузку; модули их не освобождают.
      // map = null: если свет понадобится снова, three создаст карту заново
      if (scene) scene.traverse(o => { if (o.isLight && o.shadow && o.shadow.map) { try { o.shadow.map.dispose(); } catch (e) { /* ok */ } o.shadow.map = null; } });
      if (S.dance) endDance(null);
      if (S.golf) stopGolf(true);
      if (S.zip) { try { if (S.zip.cancel) S.zip.cancel(); } catch (e) { /* ok */ } S.zip = null; if (ui) { show(ui.skip, false); ui.root.classList.remove('zip'); } }
      gripHud(true); gripPts.clear(); S.zipPts = 0; S.zipHoldKey = false; hayDrop();
      // W5: спорт, параплан, «Бум!» — убрать всё своё до выгрузки региона
      sportStop(); flyDrop(); pfDrop();
      if (ui) ui.root.classList.remove('sport', 'fly');
      S.epoch++;
      S.climb = null; S.look = null; S.inShop = null; S.sitting = null; S.view = null; S.treat = null; S.shopBuy = null; S.springT = false; S.iaDy = 0;
      if (S.mode === 'climb' || S.mode === 'zip' || S.mode === 'fly') S.mode = 'walk';
      radarDrop();
      petsToCar();
      if (S.h && dn) { try { dn.detach(S.h.root || S.h); } catch (e) { /* ok */ } }
      if (hero && scene && hero.root.parent && hero.root.parent !== scene) { if (hero.root.parent.remove) hero.root.parent.remove(hero.root); }
      inCarNow = false;
      if (drv && drv.dispose) { try { drv.dispose(); } catch (e) { /* ok */ } } drv = null; chase = null;
      if (car && (car.root || car).parent === scene) scene.remove(car.root || car);
      if (hero && hero.root.parent === scene) scene.remove(hero.root);
      mvDrop();
      if (S.h) { try { S.h.dispose(); } catch (e) { console.warn('region dispose', e); } }
      if (renderer && renderer.shadowMap.enabled) { renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true; }
      S.h = null; S.rid = null;
    }
    // модули села при сборке шумят в консоль (three.js: toNonIndexed() у уже неиндексированной геометрии; Chrome: частый
    // getImageData без willReadFrequently). На время сборки — тихо (поведение то же), после сборки всё как было.
    function quiet(fn) {
      const BG = T.BufferGeometry && T.BufferGeometry.prototype, tni = BG && BG.toNonIndexed;
      const HC = window.HTMLCanvasElement && HTMLCanvasElement.prototype, gc = HC && HC.getContext;
      if (tni) BG.toNonIndexed = function () { return this.index === null ? this : tni.apply(this, arguments); };
      if (gc) HC.getContext = function (type, opt) { return gc.call(this, type, type === '2d' ? Object.assign({ willReadFrequently: true }, opt || {}) : opt); };
      try { return fn(); } finally { if (tni) BG.toNonIndexed = tni; if (gc) HC.getContext = gc; }
    }
    // отель: падел и мини-футбол — только вид (своего места у hotel.js нет): «Посмотреть» у сетки грина
    function addSportsSpot(h) {
      if (!h || !h.spots || h.spots.some(s => s.id === 'sports_look') || !(h.camera && h.camera.views && h.camera.views.sports)) return;
      const C = [[40, -62], [38, -60], [44, -64], [36, -66], [42, -58]];
      const at = C.find(([x, z]) => (!h.walkable || h.walkable(x, z)) && Math.abs(h.ground(x, z) + 4) < 0.3);
      if (!at) return;
      const V = V_(), RL = V && V.hotel && V.hotel.LINES && V.hotel.LINES.hotel_raccoon;
      const line = RL && RL[1] ? { who: RL[1].who, text: RL[1].text } : null;
      h.spots.push({ id: 'sports_look', x: at[0], y: h.ground(at[0], at[1]), z: at[1], r: 1.6, icon: '⚽', label: 'Падел и мини-футбол', action: 'Посмотреть',
        use: () => ({ id: 'sports_look', kind: 'view', view: 'sports', npc: 'hotel_raccoon', line, text: 'Падел — в стеклянной коробке, рядом — мини-футбол. Мячик выдают бесплатно.', hero: SAY.sports }) });
    }
    function load(id, from) {
      const mod = REG(id); if (!mod) throw new Error('region ' + id + ' missing');
      // W7: смена места — вид «из-за руля» выключается (камера и её near — уже нового места; включить можно снова)
      ckSet(false);
      const prev = S.rid;
      const kazBack = prev === 'kubachi' && id !== 'kubachi' && kazRemove();
      unload();
      const V = V_(); V.named = named;
      const t0 = performance.now();
      // большой базар — по средам (как в Кубачах); в предпросмотре автора (UNLOCK.all) — каждый день, чтобы его можно было увидеть
      const bazaar = window.CONFIG && CONFIG.UNLOCK && CONFIG.UNLOCK.all ? true : undefined;
      S.h = quiet(() => mod.build({ THREE: T, scene, named, season, quality: regionQ, clouds: !lite, from, bazaar }));
      S.rid = id; S.level = 'ground'; S.sitting = null; S.view = null; S.camInit = false; S.lastGreet = {}; S.moveTo = null; S.exitArmed = {}; S.night = -1;
      const h = S.h;
      cam.near = (h.camera && h.camera.near) || 0.1; cam.far = (h.camera && h.camera.far) || 1600; cam.updateProjectionMatrix();
      registerSpeakers();
      if (id === 'hotel') addSportsSpot(h);
      // W5: падел и мини-футбол — места у настоящих кортов (golf_putt отеля уже есть: теперь он ведёт в новый гольф)
      if (id === 'hotel' && V.sports && V.sports.spotsFor) { try { V.sports.spotsFor(h).forEach(sp => h.spots.push(sp)); } catch (e) { console.warn('region sports spots', e); } }
      if (id === 'serpentine') fogReset();
      if (hero && hero.root.parent !== scene) scene.add(hero.root);
      if (id !== 'serpentine') {
        S.mode = 'walk';
        const sp = (from === 'zipline' && h.places && h.places.zipLanding) || h.spawn;
        heroToGround(sp.x, sp.z, sp.ry || 0); S.yaw = sp.ry || 0;
      }
      setupCar(h, id, from);
      if (id !== 'serpentine' && S.mode !== 'drive') petsOut(h, from);   // волна 6: приехала в село за рулём — зверята в машине
      mvCreate(h);   // W5: бег, прыжок, падения, твёрдая машина
      if (id === 'kubachi') flyCreate(h);   // W5: параплан (места fly_tower / fly_knoll)
      pfCreate();   // W5: «Бум!» понарошку
      if (blob && blob.parent !== scene) scene.add(blob);
      if (blob) blob.visible = S.mode === 'walk';
      if (shadowProxy) shadowProxy.attach(scene);
      // W4A: свадьба — героиня модулю (розыгрыш с беретом), облачка пальтара
      if (h.wedding) { try { if (hero && h.wedding.setHero) h.wedding.setHero(hero, hero.rig ? hero.rig.anim : null); if (h.wedding.onPrank) h.wedding.onPrank(onPrank); if (h.wedding.onEvent) h.wedding.onEvent(onWedEvent); if (h.wedding.setBusy) h.wedding.setBusy(() => S.busy || blocked()); } catch (e) { console.warn('region wedding hero', e); } }
      // день и ночь (R2): свет, жители, небо, окна и фонари региона
      if (dn) { try { dn.apply(id === 'serpentine' ? 'road' : 'village'); dn.attachRegion(h); dn.attach(scene); } catch (e) { console.warn('region daynight', e); } }
      ui.root.classList.toggle('drive', S.mode === 'drive');
      S.buildMs = Math.round(performance.now() - t0);
      setHud();
      { const t = placeTitle(); afterCurtain(250, () => { const H = HUD_(); if (H && H.arrive && t) H.arrive(t); }); }
      emit('region:enter', { id, from, buildMs: S.buildMs });
      resize();
      radarMount();
      if (id === 'kubachi') kazArrive();
      updKazBtn();
      if (kazBack) afterCurtain(500, () => toast(kazLine('giveBack'), 3400));
      return true;
    }
    function titleOf() { const h = S.h; if (h && h.title) return h.title; const k = REG('kubachi'); return k && k.title ? k.title(named) : ''; }
    const placeTitle = () => (S.rid === 'serpentine' ? (S.dir === 'down' ? 'Дорога вниз' : 'Дорога наверх') : titleOf());
    // HUD v2: название места — шапка меню ☰ (и тост при въезде), «🏙 В город» — строка меню (спрашивает подтверждение, как раньше)
    function setHud() {
      const o = { label: placeTitle(), onExit: () => goHome(), exitText: '← в город', exitPlace: 'menu', exitMenu: { icon: '🏙', label: 'В город' } };
      try { if (refs.setHud) refs.setHud(o); else if (G_() && G_().setHud) G_().setHud(o); } catch (e) { /* ignore */ }
      const H = HUD_(); if (H && H.menu && H.menu.get && H.menu.get('exit')) { try { H.menu.update('exit', { order: 55, tint: 'sky' }); } catch (e) { /* ok */ } }
      S.hudStatus = null; S.hudObj = null; hudStatus(); hudObjective(true);
    }
    async function goHome() {
      if (!S.active || S.busy || S.zip) return;
      const r = await sheetFn({ title: 'Вернуться в город?', body: paras(['Облака расступятся — и ты снова у выезда, машина рядом.']), actions: [{ label: 'В город', value: 1 }, { label: 'Ещё побуду здесь', value: 0, cls: 'soft' }] });
      if (r) leave('city');
    }

    /* ---------- радар (MAP): данные региона для круглой карты ---------- */
    function regionPois() {
      const h = S.h; if (!h) return [];
      const out = [], spot = id => h.spots.find(s => s.id === id), V = V_() || {};
      const put = (id, kind, x, z, label, extra) => { if (isFinite(x) && isFinite(z)) out.push(Object.assign({ id, kind, x: +x, z: +z, label }, extra || {})); };
      const at = (id, kind, label, extra) => { const s = spot(id); if (s) put(id, kind, s.x, s.z, label, extra); };
      if (S.rid === 'kubachi') {
        const P = h.places || {};
        at('tower', 'tower', 'Башня'); at('bakery', 'bakery', 'Пекарня'); at('spring', 'spring', 'Родник'); at('spring_lid', 'spring', 'Родник с крышкой');
        if (P.square) put('square', 'square', P.square.x, P.square.z, 'Базарная площадь');
        const w = h.spots.find(s => /^wedding_/.test(s.id)) || (P.wedding && P.wedding.gate ? { x: P.wedding.gate[0], z: P.wedding.gate[2] } : P.wedding);
        if (w) put('wedding', 'wedding', w.x, w.z, named ? 'Пальтары и свадьба' : 'Ряженые и свадьба');
        h.spots.filter(s => /^shop_/.test(s.id)).forEach(s => put(s.id, 'shop', s.x, s.z, s.label || 'Лавка'));
        at('kaz_try', 'kaz', named ? 'Каз' : 'Праздничный платок'); at('workshop', 'workshop', 'Мастерская'); at('museum', 'museum', 'Комната образцов');
        if (P.zipLanding) put('zipLanding', 'zip', P.zipLanding.x, P.zipLanding.z, 'Финиш зиплайна');
        // W5B: старт параплана на западном уступе (на башне — значок башни); вид 'fly' — у радара свой значок, без него — «Места»
        if (S.fly && flyLock().ok) at('fly_knoll', 'fly', 'Параплан: старт с уступа');
        if (P.park) put('park', 'park', P.park.x, P.park.z, 'Парковка');
        // волна 6: дороги села — школа и двор, разворот у башни, дорога к отелю (выход toHotel)
        if (P.school) put('school', 'place', P.school.x, P.school.z, 'Школа');
        if (P.schoolYard) put('schoolYard', 'sport', P.schoolYard.x, P.schoolYard.z, 'Школьный двор');
        if (P.towerPark) put('towerPark', 'view', P.towerPark.x, P.towerPark.z, 'Разворот у башни');
        { const eh = h.exits.find(e => e.id === 'toHotel'); if (eh) put('toHotel', 'hotel', eh.x, eh.z, 'Дорога к отелю'); }
        if (V.ZIP_GEO && V.ZIP_GEO.frame) put('hotel', 'hotel', V.ZIP_GEO.frame.x, V.ZIP_GEO.frame.z, 'Отель на вершине', { far: true });
      } else if (S.rid === 'hotel') {
        const P = h.places || {}, c = b => (b && b.x0 !== undefined ? [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2] : b ? [b.x, b.z] : null);
        [['courtyard', 'square', 'Двор с фонтаном'], ['pool', 'pool', 'Бассейн'], ['green', 'golf', 'Мини-гольф'], ['fire', 'fire', 'Костровой круг'], ['spa', 'spa', 'Купели'], ['park', 'park', 'Парковка'], ['view', 'view', 'Смотровая'], ['tower', 'zip', 'Башня и зиплайн'], ['main', 'hotel', 'Отель']]
          .forEach(([k, kind, label]) => { const q = c(P[k]); if (q) put(k, kind, q[0], q[1], label); });
        at('sports_look', 'sport', 'Падел и мини-футбол');
      } else if (S.rid === 'serpentine') {
        (h.benches || []).forEach(b => put(b.id, 'bench', b.x, b.z, 'Лавочка'));
        h.exits.forEach(e => put(e.id, e.id === 'toHotel' ? 'hotel' : e.id === 'toCity' ? 'city' : 'village', e.x, e.z, e.id === 'toHotel' ? 'Отель на вершине' : e.id === 'toCity' ? 'Город' : titleOf() || e.label));
        try { const hr = REG('serpentine').hotelRoad && REG('serpentine').hotelRoad(); if (hr && hr.fork) put('fork', 'fork', hr.fork.x, hr.fork.z, 'Развилка: к отелю'); } catch (e) { /* без ветки */ }
      }
      return out;
    }
    function mapInfo() {
      const h = S.h;
      const c = car && (drv ? { x: drv.S.x, z: drv.S.z, ry: drv.S.ry } : car.S ? { x: car.S.x, z: car.S.z, ry: car.S.ry } : (car.root || car).position ? { x: (car.root || car).position.x, z: (car.root || car).position.z, ry: (car.root || car).rotation.y } : null);
      return {
        rid: S.rid, title: titleOf(), named, season, mode: S.mode, level: S.level,
        hero: { x: S.px, z: S.pz, y: S.py, ang: S.ang }, camYaw: camYaw(),
        car: c ? Object.assign({ kind: carKind(), inCar: inCarNow }, c) : null,
        pets: pets.filter(p => p.state !== 'car').map(p => ({ kind: p.kind, x: p.x, z: p.z })),
        pois: regionPois(),
        exits: h ? h.exits.map(e => ({ id: e.id, x: e.x, z: e.z, label: e.label })) : [],
        // серпантин и село — в общих макро-осях; отель — в своих (h.frame.toMacro → макро)
        frame: h && h.frame ? h.frame : null,
        road: h && S.rid === 'serpentine' && h.road ? { len: h.road.len, sample: s => h.road.sample(s) } : null,
        roads: h && h.drive && h.drive.roads ? h.drive.roads.map(r => ({ id: r.id, width: r.width, pts: r.pts })) : null,   // волна 6: проезды села
      };
    }
    const camYaw = () => { if (!cam) return S.yaw; const d = cam.getWorldDirection(tmpV); return Math.atan2(d.x, d.z); };
    function radarMount() {
      radarDrop();
      const MM = WORLD.Minimap, fn = MM && (MM.region || MM.createRegion);
      if (typeof fn !== 'function' || !ui) return;
      try {
        radar = fn.call(MM, { host: ui.root, layer: (G_() && G_().layer) || null, rid: S.rid, handle: S.h, named, season, info: () => mapInfo(),
          getHero: () => ({ x: S.px, z: S.pz, ang: S.ang }), getCamYaw: () => camYaw(),
          getVehicles: () => { const m = mapInfo(); return m.car ? [{ kind: 'car', model: m.car.kind, x: m.car.x, z: m.car.z, ry: m.car.ry }] : []; },
          pois: () => regionPois(), isBusy: () => S.busy || blocked() || !!S.zip,
          onTravel: (rid, id, p) => mapTravel(rid, id, p) });   // волна 4B (MAP): «Поехать сюда» с большой карты
      } catch (e) { console.warn('region radar', e); radar = null; }
    }
    function radarDrop() { if (radar && radar.dispose) { try { radar.dispose(); } catch (e) { /* ok */ } } radar = null; }
    // «Поехать сюда» с большой карты (MAP, волна 4B): другой регион — через загрузчик (его шторка); точка — облачная шторка и
    // героиня рядом с точкой (на проходимом месте, лицом к ней); на серпантине за рулём — машина на полотно у точки
    async function mapTravel(rid, id, p) {
      if (!S.active || S.busy || S.zip || S.climb) return false;
      if (rid === 'city') { await leave('city'); return true; }
      if (!REG(rid)) return false;
      if (rid !== S.rid) await enter(rid, S.rid);
      if (!S.active || !S.h) return false;
      const h = S.h, q = p && isFinite(p.x) ? p : regionPois().find(t => t.id === id);
      if (!q) return true;
      if (S.rid === 'serpentine' && S.mode === 'drive' && drv && h.road && h.road.project) {
        const pr = h.road.project(q.x, q.z);
        if (pr && isFinite(pr.s)) await fade((q.label || 'Дорога') + '…', async () => { drv.teleport(clamp(pr.s - 8, 2, h.road.len - 2)); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; if (chase) chase.snap(); }, 'облака расступаются');
        return true;
      }
      if (S.mode === 'drive') { await getOut(); if (S.mode !== 'walk') return false; }   // волна 7: за пешей сеткой села getOut сам скажет тостом, почему нет
      iaStop(); standUp();
      await fade((q.label || '') + '…', async () => {
        let x = q.x, z = q.z, ok = !h.walkable || h.walkable(x, z);
        for (let r = 1; !ok && r <= 9; r++) for (let i = 0; i < 16 && !ok; i++) { const a = i / 16 * TAU, tx = q.x + Math.cos(a) * r, tz = q.z + Math.sin(a) * r; if (h.walkable(tx, tz)) { x = tx; z = tz; ok = true; } }
        if (h.collide) { const c = h.collide(x, z, 0.3, h.ground(x, z)); x = c[0]; z = c[1]; }
        S.level = 'ground'; S.view = null; S.sitting = null; S.look = null; S.moveTo = null;
        const ang = Math.hypot(q.x - x, q.z - z) > 0.3 ? Math.atan2(q.x - x, q.z - z) : S.ang;
        placeHero(x, z, ang, ang);
      }, 'облака расступаются');
      return true;
    }

    /* ---------- рендер ---------- */
    function resize() {
      if (!renderer || !host) return;
      const w = host.clientWidth || 390, ht = host.clientHeight || 844;
      renderer.setSize(w, ht, false);
      if (cam) { cam.aspect = w / ht; if (!S.view && !S.look) cam.fov = cam.aspect < 0.8 ? 58 : 48; cam.updateProjectionMatrix(); }
    }
    function renderOnce() {
      if (!S.h || !renderer || !cam) return;
      try {
        if (S.mode !== 'zip') updCamera(0.016);
        S.h.update(0.016, { x: S.px, y: S.py, z: S.pz }, cam);
        if (dn) dn.update(0.016, cam);
        renderer.info.reset(); renderer.render(scene, cam);
        S.info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      } catch (e) { console.warn('region render', e); }
    }
    function makeOwnRenderer() {
      canvas = document.createElement('canvas'); canvas.className = 'wr-canvas';
      host.appendChild(canvas);
      renderer = new T.WebGLRenderer({ canvas, antialias: regionQ === 'high', powerPreference: 'default' });
      renderer.info.autoReset = false;
      if (regionQ === 'high') { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; }
      ownR = true;
    }

    /* ---------- поездка: начало и конец ---------- */
    function begin(from) {
      host = host || (renderer && renderer.domElement && renderer.domElement.parentElement) || document.body;
      if (!renderer || (renderer.getContext && renderer.getContext().isContextLost && renderer.getContext().isContextLost())) { renderer = null; makeOwnRenderer(); }
      canvas = canvas || renderer.domElement;
      // запомнить всё, что вернуть городу
      cap = {
        pr: renderer.getPixelRatio(), shadow: renderer.shadowMap.enabled, shadowAuto: renderer.shadowMap.autoUpdate,
        heroParent: hero ? hero.root.parent : null, heroPos: hero ? hero.root.position.clone() : null, heroRot: hero ? hero.root.rotation.clone() : null,
        inCar: !!(hero && car && car.body && isChildOf(hero.root, car.body)),
        carParent: car ? (car.root || car).parent : null, carVis: car ? (car.root || car).visible : true, carS: car && car.S ? Object.assign({}, car.S) : null,
        outline: hero ? !!((hero.rig || hero.statue || {}).outline || {}).visible : false,
      };
      scene = new T.Scene();
      cam = new T.PerspectiveCamera(58, 390 / 844, 0.1, 1600);
      ui = makeUI();
      // W7 (желание 10): вид «из-за руля» — тот же модуль, что в городе; кнопка 👁 в дуге (слот s4 — слева от тормоза: угол P у педалей)
      S.ck = V_() && V_().drive && V_().drive.cockpit ? V_().drive.cockpit({ THREE: T, camera: cam, renderer: () => renderer }) : null;
      { const H = HUD_(); if (S.ck && H && H.sbtn) { ui.ck = H.sbtn(ui.root, { slot: 's4', icon: '👁', label: 'Вид из-за руля', cls: 'wr-ck hidden', onPress: () => ckSet(!(S.ck && S.ck.active)) }); ui.ck.style.setProperty('--s4-dx', '62px'); ui.ck.style.setProperty('--s4-dy', '82px'); } }
      // интерфейс города прячем (его кнопки и карточки), свой — поверх холста
      hidden = [];
      Array.from(host.children).forEach(el => { if (el === canvas || el.tagName === 'CANVAS') return; hidden.push([el, el.style.display]); el.style.display = 'none'; });
      host.appendChild(ui.touch); host.appendChild(ui.root); host.appendChild(ui.fade);
      bindPedal(ui.gas, 'gas'); bindPedal(ui.brk, 'brk');
      // главная кнопка P: действие рядом; без дела — «👋 Помахать»; в танце — «✋ Хватит» (клавиши Enter/пробел в танце — «Хоп!»)
      ui.act.addEventListener('click', e => { e.stopPropagation(); actBtn(); });
      ui.act2.addEventListener('click', e => { e.stopPropagation(); act2(); });
      ui.tap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); danceTap(); });
      ui.skip.addEventListener('click', e => { e.stopPropagation(); if (S.zip && S.zip.skip) S.zip.skip(); });
      // W5: зона «✊ Держись!» (зиплайн: держать палец; касание экрана тоже держит)
      const gDown = e => { e.preventDefault(); e.stopPropagation(); if (zipDown(e.pointerId)) { ui.grip.classList.add('down'); try { ui.grip.setPointerCapture(e.pointerId); } catch (x2) { /* ok */ } } };
      const gUp = e => { e.stopPropagation(); if (zipUp(e.pointerId) && !gripPts.size) ui.grip.classList.remove('down'); };
      ui.grip.addEventListener('pointerdown', gDown); ui.grip.addEventListener('pointerup', gUp); ui.grip.addEventListener('pointercancel', gUp);
      ['touchstart', 'touchend', 'mousedown', 'click', 'contextmenu'].forEach(t => ui.grip.addEventListener(t, ev => { ev.stopPropagation(); if (ev.cancelable && t !== 'touchstart') ev.preventDefault(); }, { passive: false }));
      const dpr = Math.min(window.devicePixelRatio || 1, regionQ === 'high' ? 1.25 : lite ? 0.75 : 1);
      renderer.setPixelRatio(dpr);
      if (!ownR && regionQ === 'high' && !renderer.shadowMap.enabled) renderer.shadowMap.enabled = true;
      blob = makeBlob();
      if (hero) heroOpacity(1);
      pets = findPets();
      // руки: общий слой героини, привязанный к сцене региона (setRoot — наши S.px/S.pz/S.ang)
      prevHands = heroHands.binding(hero);
      IA = DEBUG && QS.get('ia') === '0' ? null : heroHands(hero, { THREE: T, scene, setRoot: iaSetRoot, on: iaOn, gradientMap: null });
      try { shadowProxy = makeShadowProxy(); } catch (e) { console.warn('region shadow proxy', e); shadowProxy = null; }
      // день и ночь (R1): экземпляр на сцену региона; «Вернуться в утро» / «Как на часах» — строка меню ☰ (HUD v2; без HUD — прежняя кнопка)
      if (window.DayNight) {
        try {
          dn = DayNight.create({ THREE: T, scene, renderer, camera: cam, preset: 'village', quality: regionQ });
          dnOff = dn.onChange(e => { if (e.lamps && (e.phase === 'evening' || e.phase === 'night') && !WORLD._dnHinted) { WORLD._dnHinted = true; toast(DayNight.LINES.nightHint, 3500); try { const H = HUD_(); if (H && H.menu) H.menu.news('r-dn', true); } catch (x) { /* ok */ } } });
          if (!HUD_() && DayNight.mountToggle) dnToggle = DayNight.mountToggle(ui.root, { className: 'wr-dn', onSet: (to, line) => toast(line, 2400) });
        } catch (e) { console.warn('region daynight', e); dn = null; }
      }
      hudBegin();
      canvas.addEventListener('webglcontextlost', onLost, false);
      S.active = true; S.trip = { up: false, village: false, down: false, hotel: false, zip: false };
      S.flags = { bread: false, jug: false, askJug: false, granny: false, stones: new Set(), pendant: false }; S.lineIdx = {}; S.lastGreet = {}; S.bag = []; S.stickers = []; S.pats = 0;
      bindInput(true);
      emit('region:trip', { phase: 'start', from });
      last = performance.now(); raf = requestAnimationFrame(tick);
    }
    function isChildOf(o, p) { for (let x = o; x; x = x.parent) if (x === p) return true; return false; }
    function retSpot() {
      const l = L(), e = l.edge;
      if (e && isFinite(e.x) && isFinite(e.z)) {
        const ry = (e.ry !== undefined ? e.ry : PI) + PI, r = e.r || 6;
        // машина встаёт сразу за аркой снаружи, носом в город: табличка «В город» на арке — прямо перед камерой
        // (просьба CITY); но не в зоне выезда (d > r), иначе первое же движение снова спросит «Поехали?»
        let d = r + 6;
        if (isFinite(l.gateZ)) { const dg = Math.abs(l.gateZ - e.z) - 3; if (dg > r + 0.8 && dg < d) d = dg; }
        return { x: e.x + Math.sin(ry) * d, z: e.z + Math.cos(ry) * d, ry: Math.atan2(Math.sin(ry), Math.cos(ry)), at: 'edge' };
      }
      const g = l.spawnPoints && l.spawnPoints.car; if (g) return { x: g.x, z: g.z, ry: g.ry || 0, at: 'garage' };
      const sq = (l.pois || []).find(p => p.kind === 'square'); if (sq) return { x: sq.x, z: sq.z, ry: 0, at: 'square' };
      return { x: 8.8, z: 4.75, ry: PI / 2, at: 'start' };
    }
    function end() {
      const rs = retSpot();
      const ret = { inCar: cap ? cap.inCar : false, at: rs.at, trip: Object.assign({}, S.trip) };
      cancelAnimationFrame(raf); raf = 0;
      bindInput(false);
      hudEnd();
      if (S.ck) { try { S.ck.on(false); } catch (e) { /* ok */ } S.ck = null; }
      const kazBack = kazRemove();
      unload();
      // руки: отпустить предметы, вернуть привязку города (или отвязать)
      if (IA) { try { IA.cancel(); if (IA.drop) iaDrop(); } catch (e) { /* ok */ } heroHands(hero, prevHands || { scene: null, setRoot: null, on: null, gradientMap: null }); }
      IA = null; prevHands = null;
      if (shadowProxy) { try { shadowProxy.dispose(); } catch (e) { /* ok */ } shadowProxy = null; }
      if (dnToggle) { try { dnToggle.destroy(); } catch (e) { /* ok */ } dnToggle = null; }
      if (dnOff) { try { dnOff(); } catch (e) { /* ok */ } dnOff = null; }
      if (dn) { try { dn.dispose(); } catch (e) { /* ok */ } dn = null; }
      // машина и героиня — обратно в город
      if (car) {
        const r = car.root || car;
        if (S.carLamps && car.setNight) { try { car.setNight(0); } catch (e) { /* ok */ } }
        if (cap.carParent) cap.carParent.add(r); else if (r.parent) r.parent.remove(r);
        if (car.S && car.place) { Object.assign(car.S, { x: rs.x, z: rs.z, ry: rs.ry, v: 0, steer: 0, pitch: 0, roll: 0, sq: 0, squash: 0, stuckT: 0, edgeIn: true }); car.place(); }
        r.position.set(rs.x, 0, rs.z); r.rotation.set(0, rs.ry, 0); r.visible = cap.carVis;
        if (car.setWheelLift) { try { for (let k = 0; k < 4; k++) car.setWheelLift(k, 0); } catch (e) { /* ok */ } }
        ret.car = { x: rs.x, z: rs.z, ry: rs.ry };
      }
      if (hero) {
        if (ret.inCar && car) { heroToCar(); if (cap.heroPos) { hero.root.position.copy(cap.heroPos); hero.root.rotation.copy(cap.heroRot); } ret.hero = { x: rs.x, z: rs.z, ry: rs.ry }; }
        else {
          const side = rs.ry + PI / 2, hx = rs.x + Math.sin(side) * 1.7, hz = rs.z + Math.cos(side) * 1.7;
          if (cap.heroParent) cap.heroParent.add(hero.root);
          hero.root.position.set(hx, 0, hz); hero.root.rotation.set(0, rs.ry, 0);
          if (hero.body) { hero.body.position.y = 0; hero.body.rotation.x = 0; }
          ret.hero = { x: hx, z: hz, ry: rs.ry };
        }
        const ol = (hero.rig || hero.statue || {}).outline; if (ol) ol.visible = cap.outline;
        inCarNow = false;
        if (hero.rig) { hero.rig.prev = null; hero.rig.sit = ret.inCar ? 1 : 0; }
      }
      // зверята — туда, где были в городе (на заднем диванчике машины города или рядом с ней)
      petsHome();
      Object.assign(ret, ret.hero || {});
      if (blob) { if (blob.parent) blob.parent.remove(blob); blob.userData.own.forEach(x => x.dispose()); blob = null; }
      if (ownCar && car && car.dispose) { car.dispose(); car = null; ownCar = false; }
      // рендерер: как был (свой — отпустить)
      if (canvas) canvas.removeEventListener('webglcontextlost', onLost, false);
      if (ownR) { try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* ok */ } if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); renderer = refs.renderer || null; ownR = false; canvas = null; }
      else if (renderer) { renderer.setPixelRatio(cap.pr); renderer.shadowMap.enabled = cap.shadow; renderer.shadowMap.autoUpdate = cap.shadowAuto !== false; renderer.setSize(host.clientWidth || 390, host.clientHeight || 844, false); canvas = null; }
      restoreSpeakers();
      if (mvUi) { try { mvUi.dispose(); } catch (e) { /* ok */ } mvUi = null; }
      hidden.forEach(([el, d]) => { el.style.display = d; }); hidden = [];
      const f = ui.fade, uiOld = ui;
      if (uiOld.steer) uiOld.steer.dispose();   // снимает и body.hud-driving
      uiOld.touch.remove(); uiOld.root.remove();
      // шторку держим, пока город не нарисует первый кадр (интегратор продолжает петлю сразу после ответа)
      setTimeout(() => { f.classList.remove('on'); setTimeout(() => f.remove(), 700); }, 260);
      ui = null; scene = null; cam = null; S.active = false; cap = null; S.mode = 'walk';
      if (kazBack) setTimeout(() => toast(kazLine('giveBack'), 3400), 1100);
      emit('region:trip', { phase: 'end', ret });
      return ret;
    }
    function onLost(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!S.active || S.fbDone) return;
      console.warn('region: webgl context lost — карточки вместо 3D');
      fallback2d('lost');
    }
    // запас: 3D не тянет или контекст потерян — дорисовать поездку карточками (trip2d.js) и вернуться в город
    async function fallback2d(why) {
      if (S.fbDone) return; S.fbDone = true;
      const stage = S.rid === 'kubachi' ? 'village' : S.rid === 'hotel' ? 'hotel' : S.dir === 'down' ? 'down' : 'up';
      S.busy = true;
      if (why === 'fps') toast('Включаю лёгкую поездку: так телефону проще.', 2600);
      await curtain(true, '', '');
      try { if (WORLD.Trip2D) await WORLD.Trip2D.run({ named, season, from: stage, say, sheet: sheetFn, voice }); } catch (e) { console.warn('trip2d', e); }
      S.busy = false;
      const r = end(); r.fallback = '2d'; if (tripRes) { const f = tripRes; tripRes = null; f(r); }
    }

    /* ---------- жители ---------- */
    const npcBy = id => (S.h ? S.h.npcs.find(n => n.id === id) : null);
    // (у точки над головой — ссылка на жителя: облачка ряженых свадьбы не громоздятся над одной головой)
    const npcHead = n => { const f = () => ({ x: n.root.position.x, y: n.root.position.y + (n.headY || 1.1) * (n.root.scale.y || 1) + 0.5, z: n.root.position.z }); f.npc = n; return f; };
    const heroHeadV = new T.Vector3();
    const heroHead = () => { if (inCarNow && hero) { hero.root.getWorldPosition(heroHeadV); return { x: heroHeadV.x, y: heroHeadV.y + 2.0, z: heroHeadV.z }; } return { x: S.px, y: S.py + 2.2 + ((hero && hero.body.position.y) || 0), z: S.pz }; };
    function nextLine(n) {
      const i = S.lineIdx[n.id] || 0; S.lineIdx[n.id] = (i + 1) % n.lines.length;
      let text = n.lines[i];
      if (n.id === 'granny_hedgehog' && S.flags.jug) { const ev = V_().eventLine && V_().eventLine('grannyThanks', named); text = ev ? ev.text : text; S.flags.jug = false; S.flags.granny = true; S.cheerT = 1.2; }
      else if (n.id === 'granny_hedgehog' && i === 1) S.flags.askJug = true;
      return text;
    }
    // «Поговорить»: окно диалога игры (имя, значок, голос); мимоходом — облачко с голосом
    async function talk(n) {
      if (!n || !n.lines || !n.lines.length) return;
      const text = nextLine(n), who = n.speaker || n.id;
      n.hop && n.hop(); n.faceHero = 1e9; S.lastGreet[n.id] = performance.now();
      emit('region:talk', { npc: n.id, text });
      if (say) { bubbles.forEach(b => { b.until = 0; }); await runBusy(() => say([{ who, text }])); } else { bubble(npcHead(n), text, n.name, 3600); voiceBubble(who, text); }
      n.faceHero = 1.5;
    }
    // точка в кадре? (облачко над жителем, которого не видно, — тостом)
    function onScreen(p) { if (!cam) return false; tmpV.set(p.x, p.y, p.z).project(cam); return tmpV.z < 1 && Math.abs(tmpV.x) < 0.95 && Math.abs(tmpV.y) < 0.95; }
    function greet(n) {
      if (!n.lines || !n.lines.length) return;
      const text = nextLine(n); n.hop && n.hop(); n.faceHero = 2.5; S.lastGreet[n.id] = performance.now();
      if (onScreen(npcHead(n)())) bubble(npcHead(n), text, n.name, 3600); else toast(n.name + ': ' + text, 3600);
      voiceBubble(n.speaker || n.id, text);
    }
    function heroSay(line, ms) { bubble(heroHead, line.text, '', ms || 2400, 'hero'); voiceBubble('hero', line.text); }
    function heroSay2(text, ms) { if (text) bubble(heroHead, text, '', ms || 2200, 'hero'); }   // без голоса (строки волны 4)
    // реплика жителя с голосом: { who, text } (литерал модуля) над npc (или тостом, если его не видно)
    function npcLine(n, line, ms) {
      if (!line || !line.text) return;
      if (n && onScreen(npcHead(n)())) { n.hop && n.hop(); n.faceHero = 2.5; bubble(npcHead(n), line.text, n.name, ms || 3000); } else toast((n ? n.name + ': ' : '') + line.text, ms || 3000);
      voiceBubble(line.who || (n && (n.speaker || n.id)), line.text);
    }
    function npcSayEvent(id, evId, ms) {
      const ev = V_().eventLine && V_().eventLine(evId, named);
      if (!ev) return false;
      npcLine(npcBy(id), ev, ms || 3200);
      return true;
    }

    /* ---------- места ---------- */
    const ACT = () => (V_() && V_().activities ? V_().activities(named) : {});
    const later = (ms, fn) => { const ep = S.epoch; setTimeout(() => { if (ep === S.epoch && S.active) fn(); }, ms); };
    // то же, но отсчёт — после шторки: на медленном телефоне первая отрисовка новой сцены идёт секунды, и тост,
    // показанный «через 0,9 с после загрузки», успевал погаснуть ещё под облаками
    const afterCurtain = (ms, fn) => { const ep = S.epoch; const go = () => { if (ep !== S.epoch || !S.active) return; if (S.busy || (ui && ui.fade && ui.fade.classList.contains('on'))) { setTimeout(go, 250); return; } later(ms, fn); }; go(); };
    function sitAt(seat, ry, view) {
      if (!seat) return;
      const s = Array.isArray(seat) ? seat : [seat.x, seat.y, seat.z];
      S.sitting = { h: s[1], x: s[0], z: s[2], from: { x: S.px, z: S.pz, y: S.py } }; S.px = s[0]; S.pz = s[2]; S.ang = ry !== undefined ? ry : S.ang; S.moveTo = null; S.sat++;
      if (view) setView(view, true);
    }
    function standUp() {
      if (!S.sitting && !S.view) return;
      const road = S.sitting && S.sitting.road, roof = S.sitting && S.sitting.mood, from = S.sitting && S.sitting.from;
      // встаёт там, откуда садилась (перед лавочкой, а не внутри неё)
      if (from && S.h && Math.hypot(from.x - S.px, from.z - S.pz) < 4 && (!S.h.walkable || S.h.walkable(from.x, from.z))) { S.px = from.x; S.pz = from.z; S.py = S.h.ground(from.x, from.z); if (hero && hero.rig) hero.rig.prev = null; }
      S.sitting = null; if (S.view) setView(null);
      if (roof && S.h && S.h.setMood) S.h.setMood(season === 'winter' ? 'winter' : 'day');
      if (road && chase) chase.snap();
    }
    function setView(id, smooth) {
      // W4A: камера в лавке — тени не пересчитываются каждый кадр (внутри лавки они не меняются; ≈ 60 тыс. треуг. на high)
      if (renderer && renderer.shadowMap.enabled) { const fz = !!id && /^shop_/.test(id); if (renderer.shadowMap.autoUpdate === fz) { renderer.shadowMap.autoUpdate = !fz; renderer.shadowMap.needsUpdate = true; } }
      if (!id) { S.view = null; S.camInit = false; resize(); return; }
      const v = S.h && S.h.camera && S.h.camera.views[id]; if (!v) return;
      const from = cam.position.clone(), fromLook = cam.getWorldDirection(new T.Vector3()).multiplyScalar(10).add(cam.position);
      // кадры-совпадения с фото сняты в своём формате (v.aspect): сохраняем ширину кадра, высоту — сколько даст экран
      let fov = v.fov || 50;
      if (v.aspect && cam.aspect) fov = Math.min(62, 2 * Math.atan(Math.tan(fov * PI / 360) * v.aspect / cam.aspect) * 180 / PI);
      S.view = { id, v, t: 0, from, fromLook, smooth: !!smooth, fov };
      if (v.mood && S.h.setMood) S.h.setMood(v.mood);
    }
    async function useSpot(sp) {
      if (!sp || S.busy || (IA && IA.busy()) || mvBusy() || S.sport || flyActive()) return;
      if (S.pf && S.pf.active && S.pf.active()) return;
      const A = ACT(), a = A[sp.id] || {}, h = S.h;
      const d = sp.use ? sp.use({ named, flags: S.flags }) : { kind: 'toast', text: sp.label };
      S.lastUse = d;
      emit('region:spot', { id: sp.id, kind: d && d.kind });
      S.moveTo = null;
      if (!d) return;
      // волна 4: лавки, лестница в башне, «Осмотреться», родник с крышкой, каз, свадьба, отель — по полям описания
      if (d.shop) return enterShop(d.shop);
      if (d.climb && h.climb && h.climb.at) return startClimb(d.from === 'top' ? 'top' : 'bottom');
      if (d.look && h.camera && h.camera.looks && h.camera.looks[d.look]) { startLook(d.look); if (d.npc) later(1400, () => { if (!npcSayEvent(d.npc, d.event || 'climbTop', 3400)) { const e = npcBy(d.npc); if (e) greet(e); } }); return; }
      if (d.interact === 'drinkSpring' && d.spring && IA) return drinkSpring(d, a);
      if (d.kind === 'kaz') return kazSpot(d);
      if (d.kind === 'treat') return weddingTreat(d);
      if (d.kind === 'dance') return startDance(d);
      if (d.kind === 'congrats') return congrats(d);
      if (d.kind === 'zipline') return startZip(d);
      // W5: параплан и спорт; гольф — новый (VILLAGE.sports: три лунки, «Ещё раз»/«Хватит», героиня в конце у коврика)
      if (d.kind === 'fly') return startFly(d);
      if (d.kind === 'sport') return startSport(d.sport, d);
      if (d.kind === 'golf' && V_().sports && V_().sports.start) return startSport('golf', { returnTo: { x: sp.x, y: h.ground(sp.x, sp.z), z: sp.z, ry: PI * 0.75 } });
      if (d.kind === 'golf') return startGolf(d);
      if (sp.id === 'bakery' && d.give && IA) return bakeryHands(d, a);
      switch (d.kind) {
        case 'teleport':
          await fade(d.fade || '', () => {
            S.level = d.level || 'ground'; S.px = d.to[0]; S.pz = d.to[2]; S.py = h.ground(S.px, S.pz); S.camInit = false; S.iaDy = 0;
            if (S.rid === 'hotel' && d.level === 'top' && h.zipline) { S.yaw = h.zipline.heading; S.ang = S.yaw; }
            else if (d.level === 'top') { S.ang = 0; S.yaw = PI; }
            if (hero && hero.rig) hero.rig.prev = null;
          });
          if (d.level === 'top' && a.title) toast(a.title + ': наверху', 2200);
          if (d.npc) later(800, () => { const n = npcBy(d.npc); if (n) greet(n); });
          break;
        case 'sit': {
          sitAt(d.seat, d.ry, d.view);
          if (d.mood && h.setMood) { h.setMood(d.mood); if (S.sitting) S.sitting.mood = d.mood; }
          if (d.line) { const n = npcBy(d.npc); later(900, () => npcLine(n, d.line, 3000)); }
          else if (d.npc) { const n = npcBy(d.npc); if (n) later(1300, () => greet(n)); }
          if (d.hero) later(400, () => heroSay2(d.hero, 2200));
          if (d.text) later(1500, () => toast(d.text, 3600));
          else { const t = (a.text || [])[0]; if (t) later(600, () => toast(t, 3600)); else if (!d.hero) later(900, () => heroSay(HERO.view)); }
          break;
        }
        case 'view': {
          setView(d.view, true);
          if (d.line) { const n = npcBy(d.npc); later(900, () => npcLine(n, d.line, 3000)); }
          if (d.hero) later(500, () => heroSay2(d.hero, 2200));
          if (d.text) later(1400, () => toast(d.text, 3600));
          if (d.event && !d.line) later(900, () => npcSayEvent('eagle', d.event, 4200));
          break;
        }
        case 'drink': {
          S.cheerT = 0.6; heroSay(HERO.drink, 1600);
          if (d.event && d.npc) later(1300, () => npcSayEvent(d.npc, d.event, 2800));
          if (sp.id === 'spring') await jugAsk(a);
          break;
        }
        case 'talk': { const n = npcBy(d.npc); if (n) await talk(n); else toast((a.text || [''])[0]); break; }
        case 'sheet': await runBusy(() => activitySheet(sp, d, a)); break;
        default: toast(d.text ? d.text : sp.label, 2200);
      }
    }
    // кувшин для бабушки-ежихи (волна 3): после глотка у родника — набрать?
    async function jugAsk(a) {
      if (!S.flags.askJug || S.flags.granny || S.flags.jug) return;
      await sleep(900);
      const r = await sheetFn({ title: a.title || 'Родник', body: paras([a.jug || 'Набрать кувшин?']), actions: [{ label: 'Набрать', value: 1 }, { label: 'Потом', value: 0, cls: 'soft' }] });
      if (r) { S.flags.jug = true; heroSay(HERO.jug, 2400); later(2600, () => toast('Кувшин — бабушке-ежихе на площади.', 3000)); }
    }
    async function activitySheet(sp, d, a) {
      const id = d.activity || sp.id, h = S.h;
      if (id === 'bakery') {
        const menu = (a.menu || ['Пирог', 'Хлеб']);
        const bunny = npcBy('baker_bunny');
        const offer = bunny && bunny.lines && bunny.lines[0] ? bunny.lines[0] : '';
        const pick = await sheetFn({ title: a.title || 'Пекарня', body: paras([offer]), actions: menu.map((t, i) => ({ label: t, value: i + 1, cls: i ? 'soft' : '' })) });
        if (!pick) return;
        const give = BUNNY_GIVE[pick === menu.length ? 1 : 0];
        if (bunny) { bunny.hop && bunny.hop(); bunny.faceHero = 2.5; bubble(npcHead(bunny), give.text, bunny.name, 2400); voiceBubble(give.who, give.text); }
        later(1900, () => heroSay(HERO.tasty, 2600));
        S.flags.bread = true; S.breads++; later(4800, () => toast(a.drink || 'Запить — водой из родника.', 2600));
        return;
      }
      if (id === 'workshop') {
        const ok = await workshop(a);
        if (!ok) return;
        npcSayEvent('badger', 'badgerDone', 3200);
        S.flags.pendant = true; S.cheerT = 1.2; later(3400, () => toast('В кармане: ' + (a.reward || 'подвеска'), 2800));
        return;
      }
      if (id === 'museum') { await sheetFn({ title: a.title, body: paras((a.text || []).concat([a.mail])), actions: [{ label: 'Хорошо' }] }); return; }
      if (id === 'treasure') { await sheetFn({ title: a.title, body: paras((a.text || []).concat([a.plate])), actions: [{ label: 'Хорошо' }] }); return; }
      if (id.startsWith('carved_')) {
        S.flags.stones.add(id);
        const n = S.flags.stones.size;
        await sheetFn({ title: a.title || 'Резной камень', body: paras((a.text || []).concat([n >= 3 ? 'Все три камня найдены!' : 'Найдено камней: ' + n + ' из 3.'])), actions: [{ label: 'Хорошо' }] });
        if (n === 3 && !S.flags.stones3) { S.flags.stones3 = true; const ev = V_().eventLine('stones3', named); if (ev) { toast(ev.text, 4200); voiceBubble(ev.who, ev.text); } }
        return;
      }
      if (!a.title && d.activity && ACT()[d.activity]) { const aa = ACT()[d.activity]; await sheetFn({ title: aa.title || sp.label, body: paras(aa.text || [sp.label]), actions: [{ label: 'Хорошо' }] }); return; }
      void h;
      await sheetFn({ title: a.title || sp.label, body: paras(a.text || [sp.label]), actions: [{ label: 'Хорошо' }] });
    }
    // мастерская серебра: три коротких шага в листе (гравировка → чернь → полировка), по 4 тапа по пластине
    function workshop(a) {
      const steps = (a.steps && a.steps.length ? a.steps : [{ title: 'Гравировка', hint: 'Тапай по пластине.' }, { title: 'Чернь', hint: 'Тапай по канавкам.' }, { title: 'Полировка', hint: 'Потри пластину.' }]);
      const N = 4;
      const svg = `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wrPl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9EDF0"/><stop offset="1" stop-color="#B9C3CB"/></linearGradient></defs>
        <rect x="10" y="10" width="180" height="110" rx="22" fill="url(#wrPl)" stroke="#9AA6AF" stroke-width="3"/>
        <g class="cut" fill="none" stroke="#7D8992" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 6"><path d="M40 65 H160"/><path d="M70 65 q8 -22 22 -26 M70 65 q8 22 22 26 M100 65 q8 -22 22 -26 M100 65 q8 22 22 26 M130 65 q8 -20 18 -22 M130 65 q8 20 18 22"/></g>
        <rect class="shine" x="22" y="18" width="40" height="94" rx="14" fill="#fff" opacity="0" transform="skewX(-18)"/></svg>`;
      return new Promise(res => {
        let step = 0, taps = 0, finished = false;
        const p = sheetFn({
          title: a.title || 'Мастерская', sticky: true,
          body: `<div class="wr-ws"><div class="step"></div>${svg}<div class="bar"><i></i></div><div class="hint"></div></div>`,
          actions: [{ label: 'Выйти', value: 0, cls: 'soft' }],
          onMount: (body, close) => {
            const el = body.querySelector('.wr-ws'), plate = el.querySelector('svg'), cut = el.querySelector('.cut'), shine = el.querySelector('.shine'), bar = el.querySelector('.bar i'), hintEl = el.querySelector('.hint'), stepEl = el.querySelector('.step');
            const paint = () => {
              const k = taps / N;
              stepEl.textContent = (step + 1) + ' / ' + steps.length + ' · ' + steps[step].title;
              hintEl.textContent = steps[step].hint + (step === 0 && a.pattern ? ' Узор: ' + a.pattern + '.' : '');
              bar.style.width = Math.round(((step + k) / steps.length) * 100) + '%';
              if (step === 0) { cut.setAttribute('stroke-dasharray', `${5 + k * 20} ${6 - k * 6}`); }
              if (step >= 1) { cut.setAttribute('stroke-dasharray', 'none'); cut.setAttribute('stroke', step === 1 ? `rgb(${125 - k * 80},${137 - k * 90},${146 - k * 95})` : '#2F3940'); }
              if (step === 2) shine.setAttribute('opacity', String(0.15 + k * 0.55));
            };
            plate.addEventListener('click', e => {
              e.stopPropagation(); if (finished) return;
              taps++; haptic('light'); sfx('tap');
              if (taps >= N) { taps = 0; step++; if (step >= steps.length) { finished = true; bar.style.width = '100%'; hintEl.textContent = a.reward ? a.reward + '!' : 'Готово!'; setTimeout(() => close(1), 650); return; } }
              paint();
            });
            paint();
          },
        });
        p.then(v => { res(!!v && finished); });
      });
    }

    /* ---------- волна 4: пекарня — зайка протягивает, героиня берёт из лап и откусывает ---------- */
    async function bakeryHands(d, a) {
      if (S.iaBusyTask) return;
      const menu = a.menu || ['Пирог', 'Хлеб'];
      const bunny = npcBy('baker_bunny');
      const offer = bunny && bunny.lines && bunny.lines[0] ? bunny.lines[0] : '';
      S.iaBusyTask = true;
      let pick = null;
      try { pick = await sheetFn({ title: a.title || 'Пекарня', body: paras([offer]), actions: menu.map((t, i) => ({ label: t, value: i + 1, cls: i ? 'soft' : '' })) }); } finally { S.iaBusyTask = false; }
      if (!pick || !S.active) return;
      const idx = pick - 1, isBread = idx === menu.length - 1, give = BUNNY_GIVE[isBread ? 1 : 0];
      S.flags.bread = true; S.breads++;
      const st = d.give.stand; if (st) placeHero(st[0], st[2], st[3], st[3]);
      if (bunny) { bunny.hop && bunny.hop(); bunny.faceHero = 5; bubble(npcHead(bunny), give.text, bunny.name, 2400); voiceBubble(give.who, give.text); }
      return iaRun(async alive => {
        if (IA.holding && IA.holding('L') && IA.drop) iaDrop();
        await IA.play('takeFrom', { item: d.give.items[idx] || 'bread', from: pawOf(bunny || { root: hero.root }, d.give.from), approach: false });
        if (!alive()) return;
        await IA.play('eat', {}); if (!alive()) return;
        if (isBread) heroSay2(SAY.bread, 2600); else heroSay(HERO.tasty, 2600);
        await IA.play('eat', {}); if (!alive()) return;
        await sleep(300); if (IA.drop) iaDrop();   // остаток — «в сумку» (кошке на крыше); иначе рука занята
        S.bakeryAte = (S.bakeryAte || 0) + 1;
        later(1200, () => toast(a.drink || 'Запить — водой из родника.', 2600));
      });
    }
    /* ---------- волна 4: родник с крышкой — открыть, спуститься, зачерпнуть ладошками, попить, закрыть ---------- */
    function drinkSpring(d, a) {
      const st = d.spring.stand; if (st && st.pos) placeHero(st.pos.x, st.pos.z, st.yaw, st.yaw);
      S.springT = true;
      return iaRun(async alive => {
        if (IA.holding && IA.holding() && IA.drop) iaDrop();   // обе руки свободны — пить из ладошек
        try { await IA.play('drinkSpring', { spring: d.spring }); } catch (e) { console.warn('region drinkSpring', e); }
        S.springT = false; S.iaDy = 0;
        if (!alive()) return;
        S.springs++;
        heroSay2(SAY.spring, 2200); later(900, () => npcSayEvent('spring_hedgehog', 'springDrink', 2600));
        jugAsk(a || {});
      }).then(() => { S.springT = false; });
    }

    /* ---------- волна 4: лавки — войти, выбрать, заплатить монеткой, взять из лап, съесть / полюбоваться, выйти ---------- */
    async function enterShop(shop) {
      const h = S.h, seller = npcBy(shop.seller);
      iaStop();
      await fade('Заходим в лавку…', () => { S.inShop = shop; S.px = shop.inside[0]; S.pz = shop.inside[2]; S.py = h.ground(S.px, S.pz); S.ang = shop.inside[3]; S.vx = S.vz = 0; S.iaDy = 0; setView(shop.view, false); if (hero && hero.rig) hero.rig.prev = null; });
      if (seller) { seller.faceHero = 3; if (seller.lines && seller.lines[0]) { bubble(npcHead(seller), seller.lines[0], seller.name, 3000); voiceBubble(seller.speaker || seller.id, seller.lines[0]); } }
      await sleep(600);
      return shopMenu(shop);
    }
    async function shopMenu(shop) {
      if (!S.inShop || S.inShop !== shop || S.shopMenuOpen) return;
      const A = ACT()[shop.activity] || {}, items = (shop.items && shop.items.length ? shop.items : A.items) || [];
      S.shopMenuOpen = true;
      let pick;
      try { pick = await sheetFn({ title: A.title || shop.title || 'Лавка', body: paras((A.text || []).concat(S.bag.length ? ['В сумке: ' + S.bag.length] : [])), actions: items.map((it, i) => ({ label: it.title, value: 'i' + i, cls: i ? 'soft' : '' })).concat([{ label: 'Выйти', value: 'out', cls: 'soft' }]) }); } finally { S.shopMenuOpen = false; }
      if (!S.inShop || S.inShop !== shop) return;
      const i = typeof pick === 'string' && pick[0] === 'i' ? +pick.slice(1) : -1;
      if (i < 0 || !items[i]) return leaveShop(shop);
      await buy(shop, items[i]);
      if (S.inShop === shop) return shopMenu(shop);
    }
    async function buy(shop, it) {
      const seller = npcBy(shop.seller), V = V_(), thanks = shop.thanks && V.eventLine ? V.eventLine(shop.thanks, named) : null;
      S.shopBuy = it.id;
      const left = () => S.inShop !== shop;   // вышла из лавки посреди покупки — дальше не играем
      if (IA && seller && window.Interact) {
        const from = pawOf(seller, shop.paw);
        let item = it.item;
        if (V.bazaar && V.bazaar.ITEMS && V.bazaar.ITEMS.includes(item) && Interact.items && Interact.items.wrap) { try { const m = V.bazaar.makeItem(T, item); item = Interact.items.wrap(m.mesh, m.hold); } catch (e) { item = 'box'; } }
        seller.faceHero = 6;
        await iaRun(async alive => {
          await IA.play('pay', { to: from, approach: false }); if (!alive() || left()) return;
          await IA.play('takeFrom', { item, from, approach: false }); if (!alive() || left()) return;
          if (thanks) npcLine(seller, thanks, 2400);
          if (it.use === 'eat') { await IA.play('eat', {}); if (!alive() || left()) return; heroSay2(it.hero, 2200); await IA.play('eat', {}); }
          else { await IA.play('admire', {}); if (!alive() || left()) return; heroSay2(it.hero, 2200); }
          await sleep(500);
        });
        if (IA.drop) iaDrop();   // в «сумку»
        if (left()) { S.shopBuy = null; return; }
      } else {
        if (thanks) npcLine(seller, thanks, 2400);
        later(900, () => heroSay2(it.hero, 2200)); await sleep(1600);
      }
      S.bag.push(it.id); S.shopBuy = null; S.buys++;
      toast('В сумке: ' + it.title, 1800);
    }
    async function leaveShop(shop) {
      const h = S.h; iaStop(); if (IA && IA.drop) iaDrop();
      if (!S.inShop) return;
      await fade('', () => { S.inShop = null; setView(null); S.px = shop.door[0]; S.pz = shop.door[2]; S.py = h.ground(S.px, S.pz); S.ang = shop.door[3]; S.yaw = shop.door[3]; S.camInit = false; if (hero && hero.rig) hero.rig.prev = null; });
    }

    /* ---------- W4A: свадьба во дворе (VILLAGE.wedding) — героиня приглашена на праздник ---------- */
    function onPrank(ev) {
      const W = S.h && S.h.wedding; if (!W || !ev) return;
      S.prankLog.push(ev.type + ':' + ev.phase);
      // поверх окна диалога (и тихо отложенный розыгрыш) — без облачков, голоса и звона
      if (ev.quiet || S.busy || blocked()) return;
      // облачко — над тем, кто разыгрывает (ev.who — id ряженого); не нашли — над ближайшим ряженым
      const n = S.h.npcs.find(q => q.ext && q.animal && q.animal.id === ev.who) || S.h.npcs.filter(q => q.ext && q.speaker === 'paltar').sort((a, b) => Math.hypot(a.root.position.x - S.px, a.root.position.z - S.pz) - Math.hypot(b.root.position.x - S.px, b.root.position.z - S.pz))[0];
      if (ev.text && n) { bubble(npcHead(n), ev.text, n.name, 2600); voiceBubble(n.speaker || 'paltar', ev.text); }
      if (ev.type === 'beret' && ev.phase === 'take') { S.cheerT = 0.8; later(700, () => { if (!S.busy && !blocked()) heroSay2(SAY.beret, 1600); }); }
      if (ev.phase === 'end') later(300, () => { if (!S.busy && !blocked()) heroSay2(ev.type === 'beret' ? SAY.beretBack : SAY.jingle, 1500); });
      if (ev.phase === 'start' || ev.phase === 'take') sfx('chime', { f: 1568 });
    }
    // пальтары: звон кольчуги, щелчок плёткой в воздухе, «вспышка» фото, короткие возгласы — только рядом с героиней (≤ 14 м)
    function onWedEvent(ev) {
      if (!ev || !S.h || !S.h.wedding || !/^(jingle|bell|crack|flash|say)$/.test(ev.type)) return;
      // открыто окно диалога (или шторка) — ряженые не перебивают ни облачком, ни звоном
      if (S.busy || blocked()) return;
      const n = ev.who ? S.h.npcs.find(q => q.ext && q.animal && q.animal.id === ev.who) : null;
      if (!n || Math.hypot(n.root.position.x - S.px, n.root.position.z - S.pz) > 14) return;
      const pf = k => { try { if (window.PlayFight && PlayFight.synth) PlayFight.synth(k); } catch (e) { /* звук не главное */ } };
      if (ev.type === 'jingle' || ev.type === 'bell') pf('jingle');
      else if (ev.type === 'crack') { pf('slap'); later(60, () => pf('pop')); }
      else if (ev.type === 'flash') sfx('chime', { f: 2093 });
      // короткий возглас — не поверх облачка над этим же ряженым (приветствие, строка розыгрыша) и не впритык к другому возгласу
      else if (ev.type === 'say' && ev.text && onScreen(npcHead(n)())) {
        const now = performance.now();
        if (bubbles.some(b => b.getPos.npc === n && now < b.until) || now - (S.lastGreet[n.id] || -1e9) < 3600 || now - (S.wedSayT || -1e9) < 1200) return;
        S.wedSayT = now; bubble(npcHead(n), ev.text, n.name, 1500);
      }
    }
    // камера во дворе свадьбы — со стороны середины двора (у ворот и стен галереи коллайдеров камеры нет: створка ворот закрывала кадр)
    function yardYaw(x, z, fallback) { const W0 = S.h && S.h.places && S.h.places.wedding; return W0 && isFinite(W0.x) ? Math.atan2(x - W0.x, z - W0.z) : fallback; }
    function weddingTreat(d) {
      if (!IA || !window.Interact || !Interact.items || !d.from) { heroSay2(d.text, 2400); return; }
      const st = d.stand; if (st) { placeHero(st[0], st[2], st[3], yardYaw(st[0], st[2], st[3])); S.manualT = 2; }
      if (IA.holding && IA.holding('L') && IA.holding('R') && IA.drop) iaDrop();
      let item = null; try { item = Interact.items.make(d.item); } catch (e) { item = null; }
      if (!item) { heroSay2(d.text, 2400); return; }
      item.position.set(d.from.x, d.from.y, d.from.z); scene.add(item);   // на блюде, на краю стола
      S.treat = d.item;
      return iaRun(async alive => {
        try { await IA.play('take', { item, approach: false }); } catch (e) { console.warn('region treat', e); }
        if (item.parent === scene) { freeItem(item); S.treat = null; return; }   // не взяла (руки заняты / отмена)
        if (!alive()) { S.treat = null; return; }
        await IA.play('eat', {}); if (alive()) { heroSay2(d.text, 2400); await IA.play('eat', {}); }
        await sleep(300); if (IA.drop) iaDrop();
        S.treat = null; S.treats++;
      }).then(() => { if (item.parent === scene) freeItem(item); S.treat = null; });
    }
    function startDance(d) {
      const W = S.h.wedding; if (!W || !W.dance || !W.dance.active) { toast(d.text || 'Музыка!'); return; }
      iaStop();
      const sl = d.slot; placeHero(sl.x, sl.z, sl.ry, sl.ry); S.sitting = null; S.view = null;
      S.dance = { W, beats: 0, taps: 0, slot: sl };
      // волна 4 (интегратор): свой кадр на танец — сверху-сбоку со стороны двора (как вид «Свадьба», но ближе): видно круг, её и молодых;
      // камера «за спиной» упиралась в стену двора или смотрела сквозь гирлянды
      { const V = S.h.camera && S.h.camera.views, v0 = V && V.wedding;
        if (v0) { const fx = Math.sin(sl.ry), fz = Math.cos(sl.ry), tx = sl.x + fx * 1.4, tz = sl.z + fz * 1.4, ty = (isFinite(sl.y) ? sl.y : S.py) + 1.0;
          let dx = v0.pos[0] - v0.target[0], dz = v0.pos[2] - v0.target[2]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
          V.wedding_dance = { pos: [tx + dx * 8.0, ty + 6.0, tz + dz * 8.0], target: [tx, ty, tz], fov: 52 }; setView('wedding_dance', true); } }
      const tb = ui.tap;
      W.dance.on = ev => {
        if (!S.dance || !ui) return;
        if (ev.type === 'beat') { S.dance.beats++; if (ev.n % 2 === 0) S.waveT = 0.42; tb.classList.add('beat'); setTimeout(() => tb && tb.classList.remove('beat'), 110); sfx('drum'); }
        else if (ev.type === 'hit') { if (ev.grade === 'perfect') S.cheerT = 0.45; if (ev.text) { tb.textContent = ev.text; clearTimeout(S.dance.tt); S.dance.tt = setTimeout(() => { if (ui) tb.textContent = 'Хоп!'; }, 380); } }
        else if (ev.type === 'end') endDance(ev);
      };
      tb.textContent = 'Хоп!'; show(tb, true); updKazBtn();
      const dr = npcBy(d.who || 'wed_drum'); if (dr && d.text) { bubble(npcHead(dr), d.text, dr.name, 2600); voiceBubble(dr.speaker || dr.id, d.text); dr.faceHero = 2; }
      toast('Жми «Хоп!» в такт барабану', 2600);
    }
    function endDance(res) {
      const D = S.dance; if (!D) return; S.dance = null; if (ui) show(ui.tap, false); updKazBtn();
      if (S.view && S.view.id === 'wedding_dance') setView(null);
      if (D.W.dance.active) { try { D.W.dance.on = null; D.W.dance.stop(); } catch (e) { /* ok */ } }
      if (res) { S.lastDance = { hits: res.hits, misses: res.misses, beats: res.beats, acc: res.acc, text: res.text }; if (res.text) heroSay2(res.text, 2800); S.cheerT = 1.0; }
    }
    function danceTap() { if (!S.dance) return null; S.dance.taps++; haptic('light'); return S.dance.W.dance.tap(); }
    function congrats(d) {
      heroSay2(d.text, 2600); S.waveT = 1.4; S.congrats++;
      { const y = yardYaw(S.px, S.pz, S.yaw); if (Math.abs(angDiff(y, S.yaw)) > 0.6) { S.yaw = y; S.camInit = false; } }
      const n = npcBy((d.reply && d.reply.npc) || 'wed_bride');
      if (n && d.reply) later(2400, () => { bubble(npcHead(n), d.reply.text, d.reply.name || n.name, 3000); voiceBubble(d.reply.who || n.speaker || n.id, d.reply.text); n.faceHero = 3; });
    }

    /* ---------- W4A: зиплайн — со старта на башне отеля через долину к селу ----------
       W5 «держись крепче» (желание автора): на скольжении палец (или кнопка мыши, пробел) держит ручку — большая кнопка
       «✊ Держись!» внизу и любое касание экрана. Отпустила < 3 с — героиня только качнётся («Ой! Держись!»); дольше 3 с —
       разжимает руки и мультяшно «парит» вниз («Ой-ой!»), шторка «Плюх — прямо в мягкое сено!», под ней — стог сена у башни
       отеля: героиня сидит в сене, облачко соломы, «Ой! Мягонько!» — и снова на старт на башне («Ещё разок…»). «Пропустить» —
       как было. CONFIG.ZIP_HOLD = false — ехать без удержания (как в волне 4). */
    const ZIP_SAY = {
      hold: { who: 'hero', text: 'Держусь крепко-крепко!' }, slip: { who: 'hero', text: 'Ой! Держись!' }, drop: { who: 'hero', text: 'Ой-ой!' },
      hay: { who: 'hero', text: 'Ой! Мягонько!' }, again: { who: 'hero', text: 'Ух! Ещё разок — держусь крепче!' },
      marmot: { who: 'hotel_marmot', text: 'Держись за ручку крепко-крепко — не отпускай!' }, marmotHay: { who: 'hotel_marmot', text: 'Сено мягкое — я его специально тут держу!' },
    };
    const zipHoldOn = () => !(window.CONFIG && CONFIG.ZIP_HOLD === false) && !(DEBUG && QS.get('ziphold') === '0');
    // палец держит ручку: счётчик касаний (два пальца не «отпускают» друг друга) + пробел
    const gripPts = new Set();
    function zipDown(id) { if (!S.zip || !S.zip.hold) return false; gripPts.add(id); S.zipPts = gripPts.size; S.zip.hold(true); return true; }
    function zipUp(id) { if (!gripPts.has(id)) return false; gripPts.delete(id); S.zipPts = gripPts.size; if (S.zip && S.zip.hold && !S.zipPts && !S.zipHoldKey && !S.zipTestHold) S.zip.hold(false); return true; }
    let gripK = -1, gripTxt = '', gripOn = null, gripFree = null;
    function gripHud(off) {
      const el = ui && ui.grip; if (!el) return;
      const g = !off && S.zip && S.zip.grip ? S.zip.grip() : null, st = !off && S.zip && S.zip.state ? S.zip.state() : null;
      const on = !!(g && (g.on || (st && st.phase === 'prep' && zipHoldOn())));
      if (on !== gripOn) { gripOn = on; el.classList.toggle('on', on); }
      if (!on) return;
      const free = g.on && !g.held, k = g.held || !g.on ? 1 : Math.max(0, g.left / g.grace);
      if (free !== gripFree) { gripFree = free; el.classList.toggle('free', free); el.classList.toggle('held', !!g.held); }
      el.classList.toggle('held', !!g.held);
      if (Math.abs(k - gripK) > 0.01) { gripK = k; el.style.setProperty('--k', k.toFixed(3)); }
      const t = g.held ? 'Держусь!' : g.on ? 'Держись! ' + Math.max(1, Math.ceil(g.left)) : 'Зажми и держи';
      if (t !== gripTxt) { gripTxt = t; ui.gripT.textContent = t; }
    }
    async function startZip(d) {
      const h = S.h, V = V_();
      if (!V.zipline || !V.zipline.ride || !hero || S.zip) { if (!S.zip) toast(d.text || 'Зиплайн'); return null; }
      { const lk = zipLock(); if (!lk.ok) { toast(lk.text, 2600); return null; } }
      S.busy = true;
      if (S.pf) S.pf.enable(false);
      if (IA) { iaStop(); try { if (IA.drop) iaDrop(); } catch (e) { /* ok */ } if (IA.canPocket && IA.canPocket() && !(IA.pocketed && IA.pocketed())) { try { await IA.play('pocket'); } catch (e) { /* ok */ } } }
      const n = d.npc && npcBy(d.npc); if (n && d.line) { bubble(npcHead(n), d.line.text, n.name, 2600); voiceBubble(d.line.who, d.line.text); n.faceHero = 3; }
      S.sitting = null; S.view = null; S.look = null;
      hayHide();
      if (h.idleTrolley) h.idleTrolley.visible = false;
      show(ui.skip, true); ui.root.classList.add('zip'); updKazBtn();
      S.zipEv = []; S.mode = 'zip';
      const dur = +(DEBUG && QS.get('zipdur')) || 27, hold = zipHoldOn();
      S.zipPts = 0; gripPts.clear(); S.zipHoldKey = false; gripOn = gripFree = null; gripK = -1; gripTxt = '';
      emit('region:zip', { phase: 'start', hold });
      const ride = S.zip = V.zipline.ride({ THREE: T, scene, camera: cam, hero, anim: hero.rig && hero.rig.anim, ia: IA, route: d.route || h.zipline, external: true, ground: h.ground, duration: dur,
        hold, holdGrace: 3, held: !!S.zipTestHold,
        onEvent: (e, data) => {
          S.zipEv.push(e);
          if (e === 'holdHint') { hint('Зажми экран и держи — так она держится за ручку!', 3500); const m = npcBy('hotel_marmot'); if (m) npcLine(m, ZIP_SAY.marmot, 2600); }
          else if (e === 'slip') heroSay(ZIP_SAY.slip, 1400);
          else if (e === 'drop') { heroSay(ZIP_SAY.drop, 1300); haptic('medium'); }
          else if (e === 'fade') curtain(true, 'Плюх — прямо в мягкое сено!', '');
          else if (data && data.line && e !== 'done') heroSay2(data.line, 1800);
        } });
      if (S.zipTestHold && ride.hold) ride.hold(true);
      S.busy = false;
      let r = null;
      try { r = await ride; } catch (e) { console.warn('region zip', e); }
      if (ui) { show(ui.skip, false); ui.root.classList.remove('zip'); }
      gripHud(true); gripPts.clear(); S.zipPts = 0;
      S.zipResult = r;
      if (r && r.dropped) return zipDropped(r, ride);
      S.trip.zip = true;
      emit('region:zip', { phase: 'end', skipped: !!(r && r.skipped) });
      if (!S.active || S.rid !== 'hotel' || S.zip !== ride) return r;   // ушли посреди поездки
      const K = REG('kubachi'), vt = K && K.title ? K.title(named) : '';   // название — из модуля села (named / нейтральное)
      await fade(vt ? 'Финиш! Добро пожаловать в ' + vt + '…' : 'Финиш!', () => { S.zip = null; S.mode = 'walk'; load('kubachi', 'zipline'); });
      S.trip.village = true; driveTip();
      if (IA && IA.pocketed && IA.pocketed()) later(700, () => { try { IA.play('unpocket'); } catch (e) { /* ok */ } });
      return r;
    }
    // отпустила ручку: стог сена у башни (под шторкой) → «Ой! Мягонько!» → снова на старт
    let hay = null;
    function hayHide() { if (hay && hay.group) hay.group.visible = false; }
    function hayDrop() { if (hay) { try { if (hay.group.parent) hay.group.parent.remove(hay.group); hay.dispose(); } catch (e) { /* ok */ } hay = null; } }
    function hayPlace() {
      const h = S.h, V = V_(), TW = h && h.places && h.places.tower; if (!TW) return null;
      const door = TW.door || [TW.x + 3, 0, TW.z], dx = door[0] - TW.x, dz = door[2] - TW.z, dl = Math.hypot(dx, dz) || 1;
      let x = door[0] + dx / dl * 1.9, z = door[2] + dz / dl * 1.9;
      for (let a = 0; a < 8 && h.walkable && !h.walkable(x, z); a++) { const t = Math.atan2(dx, dz) + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.5; x = TW.x + Math.sin(t) * (dl + 1.9); z = TW.z + Math.cos(t) * (dl + 1.9); }
      const y = h.ground(x, z);
      if (!hay && V.zipline && V.zipline.haystack) { try { hay = V.zipline.haystack(T, { season }); } catch (e) { console.warn('region hay', e); hay = null; } }
      if (hay) { if (hay.group.parent !== scene) scene.add(hay.group); hay.group.visible = true; hay.group.position.set(x, y, z); }
      const ry = Math.atan2(dx, dz);   // спиной к башне — лицом во двор
      S.level = 'ground'; S.view = null; S.look = null;
      placeHero(x, z, ry, ry + PI * 0.15);
      S.sitting = { h: y + (hay ? hay.seat : 0.5), x, z, from: { x: x + Math.sin(ry) * 1.3, z: z + Math.cos(ry) * 1.3, y }, hay: true };
      if (hero && hero.rig) hero.rig.sit = 1;
      return { x, y, z };
    }
    async function zipDropped(r, ride) {
      S.zipDrops++;
      emit('region:zip', { phase: 'drop', drops: S.zipDrops });
      if (!S.active || S.rid !== 'hotel' || S.zip !== ride) return r;
      S.busy = true;
      if (!ui.fade.classList.contains('on')) await curtain(true, 'Плюх — прямо в мягкое сено!', '');
      await raf2();
      S.zip = null; S.mode = 'walk';
      let at = null; try { at = hayPlace(); } catch (e) { console.warn('region hay', e); }
      renderOnce(); await raf2();
      S.busy = false;
      await curtain(false);
      if (!S.active || S.rid !== 'hotel') return r;
      if (hay && hay.puff) hay.puff();
      sfx('pop'); S.cheerT = 0.6;
      heroSay(ZIP_SAY.hay, 2200);
      later(1300, () => { const m = npcBy('hotel_marmot'); if (m && Math.hypot(m.root.position.x - S.px, m.root.position.z - S.pz) < 30) npcLine(m, ZIP_SAY.marmotHay, 2600); });
      // посидеть в сене ≈ 2,6 с игрового времени (на медленном кадре — дольше по часам) и — на старт
      const f0 = S.frames, t0 = performance.now();
      while (S.active && S.rid === 'hotel' && (performance.now() - t0 < 2600 || S.frames - f0 < 26) && performance.now() - t0 < 20000) await sleep(120);
      if (!S.active || S.rid !== 'hotel' || S.zip) return r;
      await fade('Обратно на старт…', () => {
        const h = S.h, sp = h.spots.find(q => q.id === 'zipline_start'), p = sp || r.restart;
        S.sitting = null; hayHide(); if (hero && hero.rig) hero.rig.sit = 0;
        S.level = 'top'; S.px = p.x; S.pz = p.z; S.py = sp ? h.ground(p.x, p.z) : r.restart.y;
        S.ang = S.yaw = h.zipline && h.zipline.heading !== undefined ? h.zipline.heading : r.restart.ry;
        S.camInit = false; S.iaDy = 0; if (hero && hero.rig) hero.rig.prev = null; if (h.idleTrolley) h.idleTrolley.visible = true;
      });
      later(500, () => heroSay(ZIP_SAY.again, 2400));
      if (IA && IA.pocketed && IA.pocketed()) later(700, () => { try { IA.play('unpocket'); } catch (e) { /* ok */ } });
      void at;
      return r;
    }

    /* ---------- W5: параплан над крышами села (VILLAGE.paraglider) — с площадки башни или с западного уступа ----------
       Пока летит, модуль сам ведёт героиню, руки и камеру (как зиплайн); джойстик — руль; «⬇ Приземлиться» — сама сядет на
       ближайшую площадку; «Сама порулю» — снять авто-посадку. Зверята ждут у старта. После посадки — снова пешком. */
    const flyLock = () => featureLock('paraglider', 'trip');
    const flyIn = { x: 0, y: 0 };
    const flyActive = () => !!(S.fly && S.fly.active());
    function flyCreate(h) {
      flyDrop();
      const V = V_(); if (!V || !V.paraglider || !V.paraglider.create || !V.paraglider.kubachi || !hero) return;
      try {
        S.fly = V.paraglider.create(Object.assign(V.paraglider.kubachi(h), { THREE: T, scene, camera: cam, hero, anim: hero.rig ? hero.rig.anim : null, ia: IA, renderer, onEvent: flyEvent }));
      } catch (e) { console.warn('region fly', e); S.fly = null; }
      if (S.fly && S.fly.spots) S.fly.spots.forEach(sp => { if (!h.spots.some(q => q.id === sp.id)) h.spots.push(sp); });
    }
    function flyDrop() {
      if (S.fly) { try { if (S.fly.active()) S.fly.cancel(); S.fly.dispose(); } catch (e) { /* ok */ } S.fly = null; }
      if (ui) ui.root.classList.remove('fly');
      if (S.mode === 'fly') S.mode = 'walk';
    }
    // большой базар включили/выключили — карта высот для параплана заново
    function bazaarSet(on) { const h = S.h; if (!h || !h.setBazaar) return false; const r = h.setBazaar(!!on); if (S.fly && S.fly.refresh) S.fly.refresh(); return r; }
    function startFly(d) {
      if (!S.fly || S.fly.active() || S.busy || mvBusy()) return false;
      const lk = flyLock(); if (!lk.ok) { toast(lk.text, 2600); return false; }
      if (S.sitting || S.view) standUp();
      iaStop(); if (IA && IA.drop) iaDrop();
      if (S.pf) S.pf.enable(false);
      S.moveTo = null; S.look = null;
      let ok = false; try { ok = S.fly.takeoff(d.from); } catch (e) { console.warn('region fly takeoff', e); }
      if (!ok) { toast('Ветерок сейчас не тот. Попробуем чуть позже!', 2200); return false; }
      S.mode = 'fly'; ui.root.classList.add('fly'); updKazBtn();
      pets.forEach(p => { if (p.state !== 'car') { p.state = 'wait'; p.wx = p.x; p.wz = p.z; } });   // зверята ждут у старта
      S.flyLog.push('start:' + d.from);
      emit('region:fly', { phase: 'start', from: d.from });
      updAct();
      return true;
    }
    function flyEvent(name, data) {
      S.flyLog.push(name); if (S.flyLog.length > 60) S.flyLog.shift();
      if (data && data.line) { heroSay2(data.line, 1800); voiceBubble('hero', data.line); }
      if (name === 'done' && data && data.landed) flyLanded(data.landed);
    }
    function flyLanded(L) {
      S.mode = 'walk'; S.level = 'ground';
      S.px = L.x; S.py = L.y; S.pz = L.z; S.ang = S.yaw = L.ry; S.iaDy = 0; S.vx = S.vz = 0; S.moveTo = null;
      if (hero && hero.rig) hero.rig.prev = null;
      if (cam) camPos.copy(cam.position); S.camInit = true; S.camY = S.py;   // камера плавно продолжит оттуда, где её оставил полёт
      if (ui) ui.root.classList.remove('fly');
      mvPlace(); updKazBtn();
      // зверята: снова за ней; далеко (полёт через всю долину) — прибегают «за кадром», чтобы не бежать через дома
      pets.forEach((p, i) => {
        if (p.state === 'car') return;
        p.state = 'follow';
        if (Math.hypot(p.x - S.px, p.z - S.pz) > 25 && S.h) {
          const side = i ? -1 : 1; let x = S.px - Math.sin(S.ang) * 1.3 + Math.cos(S.ang) * 0.7 * side, z = S.pz - Math.cos(S.ang) * 1.3 - Math.sin(S.ang) * 0.7 * side;
          if (S.h.walkable && !S.h.walkable(x, z)) { x = S.px; z = S.pz; }
          p.x = x; p.z = z; p.y = S.h.ground(x, z); p.root.position.set(p.x, p.y, p.z); p.stuckT = 0;
        }
      });
      S.flyLog.push('landed:' + (L.zone || '')); emit('region:fly', { phase: 'end', zone: L.zone });
      updAct();
    }
    function flyInput() {
      let x = canInput() ? joy.x : 0, y = canInput() ? joy.y : 0;
      if (keys.l || keys.r || keys.u || keys.d) { x = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); y = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); }
      flyIn.x = x; flyIn.y = y; return flyIn;
    }

    /* ---------- W5: спорт отеля (VILLAGE.sports) — падел с Лисичкой, мини-футбол (пенальти Мишке / пас-пас с Зайкой) и новый
       мини-гольф на три лунки. Игра не «расходует» место: «Ещё раз» / «Хватит» сколько угодно раз, в конце героиня у места
       (старый гольф оставлял её в 5 м от коврика — поэтому «сыграть только один раз»). Пока идёт игра, модуль сам ведёт героиню,
       камеру и свой слой касаний (поверх кнопок региона). */
    const sportsLock = () => featureLock('sports', 'trip');
    const SPORT_SFX = { hit: 'pop', kick: 'pop', putt: 'pop', bounce: 'tap', bump: 'tap', glass: 'chime', post: 'chime', net: 'flutter', swish: 'flutter', whoosh: 'flutter', point: 'chime', goal: 'chime', holed: 'chime', cheer: 'chime', aww: 'blip', save: 'blip' };
    function startSport(kind, d) {
      const SP = V_() && V_().sports; if (!SP || !SP.start || S.sport || !hero || S.busy || mvBusy()) return false;
      const lk = sportsLock(); if (!lk.ok) { toast(lk.text, 2600); return false; }
      iaStop(); if (IA && IA.drop) iaDrop(); stopGolf(true);
      if (S.pf) S.pf.enable(false);
      S.sitting = null; S.view = null; S.moveTo = null; S.look = null; if (hero.rig) hero.rig.prev = null;
      const G = S.h.golf;
      try {
        S.sport = SP.start(kind, {
          THREE: T, scene, camera: cam, hero, anim: hero.rig && hero.rig.anim, ia: IA, ui: { host: ui.root },
          court: (d && d.court) || SP.HOTEL[kind], variant: d && d.variant,
          returnTo: (d && d.returnTo) || { x: S.px, y: S.py, z: S.pz, ry: S.ang },
          ground: (x, z) => S.h.ground(x, z),
          hide: G ? [G.ball, G.putter, G.arrow].filter(Boolean) : [],   // мяч и клюшка старого гольфа отеля
          onEvent: (n, e) => {
            if (n === 'line' && e) voiceBubble(e.who, e.text);           // облачка зверят и тренера модуль рисует сам — здесь голос
            else if (n === 'hero' && e && e.text) voiceBubble('hero', e.text);
            else if (n === 'sfx' && e) sfx(SPORT_SFX[e.k] || 'tap');
            else if (n === 'haptic') haptic(e === 'success' ? 'medium' : e);
            else if (n === 'round') { S.sportLog.push('round:' + (e && e.kind) + ':' + JSON.stringify(e && e.result)); emit('region:sport', e); }
          },
          onEnd: r => sportEnd(r),
        });
      } catch (e) { console.warn('region sport', e); S.sport = null; }
      if (!S.sport) return false;
      ui.root.classList.add('sport'); S.sportLog.push('start:' + kind);
      sportHintWatch();
      emit('region:sportStart', { kind });
      updAct();
      return true;
    }
    // HUD v2: подсказка мини-игры (.vs-hint) — тостом игры, а не своей плашкой (один тост за раз, под полосой)
    let vsObs = null;
    function sportHintWatch(off) {
      if (vsObs) { try { vsObs.disconnect(); } catch (e) { /* ok */ } vsObs = null; }
      const el = !off && HUD_() && ui && window.MutationObserver ? ui.root.querySelector('.vs-root .vs-hint') : null; if (!el) return;
      let last = '';
      vsObs = new MutationObserver(() => {
        const on = el.classList.contains('on'), t = (el.textContent || '').trim();
        if (on && t && t !== last) { last = t; toast(t, Math.min(3500, 1200 + 40 * t.length), { replace: true }); }
        if (!on) last = '';
      });
      vsObs.observe(el, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
      if (el.classList.contains('on') && el.textContent.trim()) { last = el.textContent.trim(); toast(last, 3500, { replace: true }); }
    }
    function sportEnd(r) {
      S.sport = null; sportHintWatch(true);
      if (r && r.hero && S.h) { S.px = r.hero.x; S.pz = r.hero.z; S.py = S.h.ground(r.hero.x, r.hero.z); S.ang = r.hero.ry; }
      S.yaw = S.ang; S.camInit = false; S.camY = null; S.vx = S.vz = 0; S.iaDy = 0; if (hero && hero.rig) hero.rig.prev = null;
      if (ui) ui.root.classList.remove('sport');
      mvPlace();
      S.sportLog.push('end:' + (r && r.kind) + ':' + (r && r.reason) + ':' + (r && r.rounds));
      emit('region:sportEnd', r);
      updAct();
    }
    function sportStop() { if (S.sport) { const sp = S.sport; try { sp.stop(); } catch (e) { /* ok */ } if (S.sport === sp) sportEnd({ kind: sp.kind, reason: 'stop' }); } }

    /* ---------- W5: «Бум!» понарошку (js/playfight.js) — толкнуть ладошкой, «бамс», «хлоп»; зверят — только «Бупнуть»;
       пальтары на свадьбе возятся понарошку (прыгают вокруг, сальто, «Сдаюсь! Ты — чемпионка!»). Жители «на работе»
       (молодые, музыканты, лавочники, персонал отеля) — не цели; во время диалогов, мест, игр, полёта — кнопки спрятаны. */
    const PF_BUSY = /^(wed_bride|wed_groom|wed_zurna|wed_drum|hotel_|goat_grocer|bear_craft|lamb_cloth|squirrel_nuts|owl_keeper|tur)/;
    const pfFree = () => S.mode === 'walk' && S.active && !S.busy && !blocked() && !S.sitting && !S.view && !S.look && !S.inShop && !S.golf && !S.dance && !S.climb && !S.sport && !S.zip && !flyActive() && S.level !== 'top' && !inCarNow && !mvBusy();
    function pfCan(n) {
      if (!n || !pfFree() || (IA && IA.busy())) return false;
      if (n.silent || !n.root || !n.root.visible) return false;
      if (n.petRef) return n.petRef.state !== 'car' && n.root.parent === scene && Math.abs(n.petRef.y - S.py) < 1.2;   // кот и собачка с ней — только «Бупнуть»
      const id = String(n.speaker || n.id || '');
      if (PF_BUSY.test(id) && !(window.PlayFight && PlayFight.isPetDefault && PlayFight.isPetDefault(n))) return false;
      if (S.mv && !S.mv.state.grounded) return false;
      return Math.abs((n.root.position.y || 0) - S.py) < 1.2;
    }
    function pfMoveNpc(n, dx, dz) {
      const h = S.h; if (!h || !n || !n.root) return;
      if (n.petRef) return;   // зверят не двигаем (буп — на месте)
      const W = h.wedding; if (W && n.wedding && W.moveNpc) { W.moveNpc(n, dx, dz); return; }
      const p = n.root.position; let x = p.x + dx, z = p.z + dz;
      if (h.collide) [x, z] = h.collide(x, z, n.r || 0.3, p.y);
      if (h.walkable && !h.walkable(x, z)) return;
      const y = h.ground ? h.ground(x, z) : p.y; if (Math.abs(y - p.y) > 0.8) return;
      p.set(x, y, z); n.x = x; n.z = z; if (n.y !== undefined) n.y = y;
    }
    function pfOn(name, data) {
      S.pfLog.push(name + (data && data.phase ? ':' + data.phase : '') + (data && data.npc ? ':' + (data.npc.id || data.npc) : '')); if (S.pfLog.length > 80) S.pfLog.shift();
      const W = S.h && S.h.wedding;
      if (name === 'spar' && W && W.paltarHold && data) W.paltarHold(data.npc, data.phase === 'start');
      if (name === 'hit' || name === 'boop') { if (W && W.stopPrank) { try { W.stopPrank(); } catch (e) { /* ok */ } } }
    }
    // жители региона + кот и собачка, которые гуляют с ней (для «Бупнуть»); список пересобирается, только когда что-то поменялось
    let pfList = [], pfH = null, pfNn = -1, pfNp = -1;
    function pfNpcs() {
      const h = S.h; if (!h) return pfList;
      if (h !== pfH || h.npcs.length !== pfNn || pets.length !== pfNp) {
        pfH = h; pfNn = h.npcs.length; pfNp = pets.length;
        pfList = h.npcs.concat(pets.map(p => p.pfN || (p.pfN = { root: p.root, id: 'pet_' + p.kind, speaker: p.kind === 'cat' ? 'cat' : (p.who || 'dog_spitz'), name: p.kind === 'cat' ? 'Пирожок' : '', pet: true, small: true, petRef: p, I: p.I || null, headY: p.kind === 'cat' ? 0.45 : 0.55, r: 0.3 })));
      }
      return pfList;
    }
    function pfCreate() {
      pfDrop();
      if (!window.PlayFight || !PlayFight.create || !hero || !hero.rig || !ui) return;
      try {
        S.pf = PlayFight.create({
          THREE: T, scene, camera: cam, hero: hero.root, anim: hero.rig.anim, interact: IA,
          getNpcs: () => pfNpcs(),
          canTarget: n => pfCan(n),
          moveNpc: (n, dx, dz) => pfMoveNpc(n, dx, dz),
          setYaw: y => { S.ang = y; },
          moveHero: (dx, dz) => { const h = S.h; if (!h) return; let x = S.px + dx, z = S.pz + dz; if (h.collide) [x, z] = h.collide(x, z, 0.3, S.py); if (h.walkable && !h.walkable(x, z)) return; S.px = x; S.pz = z; },
          ground: (x, z) => (S.h && S.h.ground ? S.h.ground(x, z) : S.py),
          season: () => season,
          say: (n, text, who) => { if (!text) return; if (n && n.root) bubble(npcHead(n), text, n.name, 2400); voiceBubble(who || (n && (n.speaker || n.id)), text); },
          buttonsHost: ui.root,
          on: (name, data) => pfOn(name, data),
          keys: { bonk: 'KeyF', toss: 'KeyG' },
        });
      } catch (e) { console.warn('region playfight', e); S.pf = null; }
      if (S.pf) S.pf.enable(false);   // кнопки появятся в updAct, когда она свободно гуляет
    }
    function pfDrop() { if (S.pf) { try { S.pf.dispose(); } catch (e) { /* ok */ } S.pf = null; } pfList = []; pfH = null; pfNn = pfNp = -1; }

    /* ---------- W5: «Помахать» в селе и отеле — как в городе: «Hi!» (с именем — только в облачке, голосом не звучит), жители
       рядом поворачиваются, зверята радуются, ближайший отвечает своей строкой (первый раз — по имени, если она его назвала) ---------- */
    const HI_AGAIN = ['Hi!', 'Hello!', 'Hey there!'];
    const R_WAVE = {
      badger: [{ who: 'badger', text: 'Привет, {name}! Заглядывай в мастерскую.' }, { who: 'badger', text: 'И тебе привет! Молоточки ждут.' }],
      owl_keeper: [{ who: 'owl_keeper', text: 'Привет, {name}. Только тихонько!' }, { who: 'owl_keeper', text: 'Привет-привет. Шёпотом.' }],
      eagle: [{ who: 'eagle', text: 'Привет, {name}! Сверху тебя хорошо видно.' }, { who: 'eagle', text: 'Привет! Машу крылом.' }],
      roof_cat: [{ who: 'roof_cat', text: 'Мур. Привет, {name}.' }, { who: 'roof_cat', text: 'Мур. Это «привет» с крыши.' }],
      pony: [{ who: 'pony', text: 'Привет, {name}! Иго-го — по-нашему «здравствуй».' }, { who: 'pony', text: 'Привет! Сено подождёт.' }],
      mtn_sheep: [{ who: 'mtn_sheep', text: 'Бе-е! Привет, {name}!' }, { who: 'mtn_sheep', text: 'Бе-е! И тебе привет!' }],
      baker_bunny: [{ who: 'baker_bunny', text: 'Привет, {name}! Хлеб уже тёплый.' }, { who: 'baker_bunny', text: 'Привет-привет! Заходи на хлебушек.' }],
      spring_hedgehog: [{ who: 'spring_hedgehog', text: 'Привет, {name}! Водичка холодненькая.' }, { who: 'spring_hedgehog', text: 'Привет! Фыр-фыр!' }],
      mouse: [{ who: 'mouse', text: 'Привет, {name}! Узор почти готов.' }, { who: 'mouse', text: 'Привет-привет! Пи!' }],
      granny_hedgehog: [{ who: 'granny_hedgehog', text: 'Здравствуй, {name}! Садись отдохни.' }, { who: 'granny_hedgehog', text: 'Здравствуй, моя хорошая!' }],
      pigeon_metro: [{ who: 'pigeon_metro', text: 'Курлы! Привет, {name}!' }, { who: 'pigeon_metro', text: 'Курлы! Привет из нашего метро!' }],
      cow: [{ who: 'cow', text: 'Му-у! Привет, {name}!' }, { who: 'cow', text: 'Му-у! Привет!' }],
      goat_grocer: [{ who: 'goat_grocer', text: 'Привет, {name}! Заходи за творожком!' }, { who: 'goat_grocer', text: 'Привет-привет! Всё свежее!' }],
      bear_craft: [{ who: 'bear_craft', text: 'Привет, {name}! Кувшинчики звенят тебе в ответ.' }, { who: 'bear_craft', text: 'И тебе привет!' }],
      lamb_cloth: [{ who: 'lamb_cloth', text: 'Привет, {name}…' }, { who: 'lamb_cloth', text: 'Ой… привет!' }],
      squirrel_nuts: [{ who: 'squirrel_nuts', text: 'Привет, {name}! Орешек хочешь?' }, { who: 'squirrel_nuts', text: 'Привет-привет-привет!' }],
      wed_bride: [{ who: 'wed_bride', text: 'Привет, {name}! Как хорошо, что ты пришла!' }, { who: 'wed_bride', text: 'Привет! Угощайся!' }],
      wed_groom: [{ who: 'wed_groom', text: 'Привет, {name}! Добро пожаловать на праздник!' }, { who: 'wed_groom', text: 'Привет! Танцуют все!' }],
      wed_zurna: [{ who: 'wed_zurna', text: 'Привет, {name}! Сыграю погромче!' }, { who: 'wed_zurna', text: 'Привет! Ту-ру-ру!' }],
      wed_drum: [{ who: 'wed_drum', text: 'Бум! Привет, {name}!' }, { who: 'wed_drum', text: 'Бум-бум! Привет!' }],
      wed_aunt: [{ who: 'wed_aunt', text: 'Здравствуй, {name}! Садись к столу!' }, { who: 'wed_aunt', text: 'Здравствуй, милая!' }],
      wed_kid: [{ who: 'wed_kid', text: 'Привет, {name}! Хочешь конфетку?' }, { who: 'wed_kid', text: 'Привет! Мяу!' }],
      paltar: [{ who: 'paltar', text: 'Звяк-звяк! Привет, {name}!' }, { who: 'paltar', text: 'Звяк-звяк! Это я так машу!' }],
      hotel_goat: [{ who: 'hotel_goat', text: 'Здравствуйте, {name}! Рады вам в отеле!' }, { who: 'hotel_goat', text: 'Здравствуйте! Хорошего отдыха!' }],
      hotel_raccoon: [{ who: 'hotel_raccoon', text: 'Привет, {name}! Сыграем?' }, { who: 'hotel_raccoon', text: 'Привет! Мячик ждёт!' }],
      hotel_otter: [{ who: 'hotel_otter', text: 'Привет, {name}! Водичка тёплая!' }, { who: 'hotel_otter', text: 'Привет-привет! Плюх!' }],
      hotel_bear: [{ who: 'hotel_bear', text: 'Привет, {name}. Иди греться к огню.' }, { who: 'hotel_bear', text: 'Привет! Тут тепло.' }],
      hotel_marmot: [{ who: 'hotel_marmot', text: 'Привет, {name}! Прокатимся?' }, { who: 'hotel_marmot', text: 'Привет! Вжу-у-ух — и через долину!' }],
      tur: [{ who: 'tur', text: 'Привет, {name}. Киваю рогами.' }, { who: 'tur', text: 'И тебе привет. Неторопливо.' }],
    };
    const R_WAVE_ANY = [{ text: 'Привет, {name}!' }, { text: 'Привет-привет!' }];
    function waveBtn() {
      if (!S.active || S.busy || blocked() || S.mode !== 'walk' || S.waveT > 0 || mvBusy() || S.dance || S.inShop || S.sport || S.zip || flyActive() || (IA && IA.busy())) return false;
      const h = S.h; if (!h) return false;
      S.waveT = 1.4; haptic('light');
      if (ui && ui.act && btnLabel(ui.act) === '👋 Помахать') { ui.act.classList.remove('go'); void ui.act.offsetWidth; ui.act.classList.add('go'); }
      let nn = null, bd = 4.2;
      h.npcs.forEach(n => { if (!n.root.visible || n.silent) return; const p = n.root.position, d = Math.hypot(p.x - S.px, p.z - S.pz); if (d < bd && Math.abs(p.y - S.py) < 2.5) { bd = d; nn = n; } });
      const g = G_(), spk = nn ? String(nn.speaker || nn.id) : null;
      let r = { first: false, hi: 'Hi!', reply: null, name: '' };
      try { if (g && g.wave) r = g.wave({ where: 'region', npc: spk }) || r; } catch (e) { /* без движка */ }
      const intro = !!(r.first || (nn && !S.greeted.has(nn.id)));
      const hi = intro ? (r.hi || 'Hi!') : HI_AGAIN[S.waveN++ % HI_AGAIN.length];
      bubble(heroHead, hi, '', 2200, 'hero'); voiceBubble('hero', hi);
      S.waveLog.push({ npc: nn ? nn.id : null, hi });
      // все рядом поворачиваются; зверята радуются
      h.npcs.forEach(n => { if (!n.root.visible) return; const p = n.root.position, d = Math.hypot(p.x - S.px, p.z - S.pz); if (d < 7) { n.faceHero = Math.max(n.faceHero || 0, 2.2); if (d < 4.5 && n.hop) setTimeout(() => { try { n.hop(); } catch (e) { /* ok */ } }, 300 + d * 60); } });
      pets.forEach(p => { if (p.I && p.state !== 'car') { p.I.st.happy = 1; setTimeout(() => { if (p.I) p.I.st.happy = 0; }, 1200); } });
      if (!nn) return true;
      S.greeted.add(nn.id); S.lastGreet[nn.id] = performance.now();
      const list = R_WAVE[spk], nm = r.name || '';
      const useName = intro && nm && (g && g.nameOk ? g.nameOk() : true);
      let line = list ? list[useName ? 0 : 1] : { who: spk, text: R_WAVE_ANY[useName ? 0 : 1].text };
      if (typeof r.reply === 'string' && r.reply) line = { who: spk, text: r.reply };
      const text = line.text.replace('{name}', nm);
      if (!useName && /\{name\}/.test(line.text)) return true;
      later(950, () => { if (!S.h || !nn.root) return; nn.hop && nn.hop(); nn.faceHero = 2.5; npcLine(nn, { who: line.who || spk, text }, 2600); S.waveLog.push({ npc: nn.id, reply: text }); });
      return true;
    }

    /* ---------- W5: фразы в тумане (серпантин): въехала в облако, внутри, вынырнула — облачко и голос героини; кот или
       собачка сзади отвечают. Оба направления; каждая фраза — раз за проезд облака (повтор не раньше чем через 40 с) ---------- */
    const FOG_LINES = {
      valley: { who: 'hero', text: 'Туманчик стелется по низу. Еду аккуратно!' },
      inUp: { who: 'hero', text: 'Ой, мы внутри облака!' }, midUp: { who: 'hero', text: 'Ничего не видно… едем тихонько.' }, outUp: { who: 'hero', text: 'Сейчас вынырнем!' },
      emerge: { who: 'hero', text: 'Ура, мы над облаками!' },
      inDown: { who: 'hero', text: 'Ныряем в облако!' }, midDown: { who: 'hero', text: 'Как в молоке… Тихонько-тихонько.' }, outDown: { who: 'hero', text: 'Вынырнули! Вот и долина.' },
      gate: { who: 'hero', text: 'Облачная шторка — а за ней домики на склоне!' }, hotel: { who: 'hero', text: 'Отель прячется в облачке!' },
    };
    const FOG_PET = {
      cat: { mid: { who: 'cat', text: 'Мур. Я зажмурился. Скажешь, когда вынырнем.' }, out: { who: 'cat', text: 'Мяу. Наконец-то солнышко.' } },
      dog_spitz: { mid: { who: 'dog_spitz', text: 'Тяф? Тяф-тяф!' }, out: { who: 'dog_spitz', text: 'Тяф!' } },
      dog_dachshund: { mid: { who: 'dog_dachshund', text: 'Облако длиной в сто такс. Не меньше!' }, out: { who: 'dog_dachshund', text: 'Вынырнули! Мерил носом.' } },
      dog_corgi: { mid: { who: 'dog_corgi', text: 'Хрр… В облаке мягко. Можно поспать.' }, out: { who: 'dog_corgi', text: 'О. Солнышко. Я не спал.' } },
    };
    const FOG = { inside: false, t: 0, mid: false, said: {}, prevS: null, dir: 1, valT: 0, lastT: -1e9, pend: null, fi: { cloud: 0, gate: 0, valley: 0 } };
    function fogReset() { FOG.inside = false; FOG.t = 0; FOG.mid = false; FOG.said = {}; FOG.prevS = null; FOG.valT = 0; FOG.lastT = -1e9; FOG.pend = null; }
    function petInCar(kind) { return pets.find(p => (kind === 'cat' ? p.kind === 'cat' : p.kind === 'dog') && p.state === 'car' && p.root.visible !== false); }
    function petSay(kind, key) {
      const p = petInCar(kind); if (!p) return false;
      const who = kind === 'cat' ? 'cat' : p.who, L = FOG_PET[who] && FOG_PET[who][key]; if (!L) return false;
      const W0 = new T.Vector3(), getPos = () => { p.root.getWorldPosition(W0); return { x: W0.x, y: W0.y + 1.3, z: W0.z }; };
      const nm = kind === 'cat' ? 'Пирожок' : (refs.pets && refs.pets.dog && refs.pets.dog.nameOf && refs.pets.dog.nameOf(who)) || (WORLD.COMPANION_DOGS && WORLD.COMPANION_DOGS[who]) || '';
      bubble(getPos, L.text, nm, 2600); voiceBubble(L.who, L.text);
      S.fogLog.push(L.who + ': ' + L.text);
      return true;
    }
    function fogSay(k, ms, pet) {
      const now = performance.now();
      if (FOG.said[k] && now - FOG.said[k] < 40000) return false;
      if (now - FOG.lastT < 2600 && k !== 'emerge') { if (!FOG.pend || FOG.pend.k === k || now - FOG.pend.t > 8000) FOG.pend = { k, ms, pet, t: FOG.pend && FOG.pend.k === k ? FOG.pend.t : now }; return false; }   // занято другой фразой — скажет чуть позже
      FOG.said[k] = now; FOG.lastT = now; if (FOG.pend && FOG.pend.k === k) FOG.pend = null;
      const L = FOG_LINES[k]; heroSay(L, ms || 2400); S.fogLog.push('hero: ' + L.text); if (S.fogLog.length > 60) S.fogLog.shift();
      if (pet) later(1700, () => { if (!petSay('cat', pet)) petSay('dog', pet); });
      emit('region:fog', { line: k });
      return true;
    }
    function fogTalk(dt) {
      const h = S.h; if (!h || !h.fogInfo || S.rid !== 'serpentine' || S.mode !== 'drive' || !drv || S.busy || S.sim) return;
      const f = h.fogInfo(FOG.fi), s = drv.S.s;
      if (FOG.pend) { const p = FOG.pend, now = performance.now(); if (now - p.t > 8000) FOG.pend = null; else if (now - FOG.lastT >= 2600) { FOG.pend = null; fogSay(p.k, p.ms, p.pet); } }
      if (FOG.prevS != null && Math.abs(s - FOG.prevS) > 0.02) FOG.dir = s > FOG.prevS ? 1 : -1;
      FOG.prevS = s;
      const go = Math.abs(drv.S.v) > 1.2, up = FOG.dir > 0 && drv.S.rid !== 1;
      if (!FOG.inside && f.cloud > 0.6 && go) { FOG.inside = true; FOG.t = 0; FOG.mid = false; fogSay(up ? 'inUp' : 'inDown'); }
      else if (FOG.inside) {
        FOG.t += dt;
        if (!FOG.mid && FOG.t > 4.5 && go) { FOG.mid = true; fogSay(up ? 'midUp' : 'midDown', 2600, 'mid'); }
        if (f.cloud < 0.2) { FOG.inside = false; fogSay(up ? 'outUp' : 'outDown', 2600, up ? null : 'out'); }
        else if (up && f.cloud < 0.45 && FOG.mid) fogSay('outUp', 2200);
      }
      if (f.valley > 0.9 && go && up) { FOG.valT += dt; if (FOG.valT > 3) fogSay('valley'); }
      if (f.gate > 0.55 && go) fogSay(drv.S.rid === 1 ? 'hotel' : 'gate');
    }

    /* ---------- W4A: мини-гольф отеля — потянуть назад и отпустить, 3 удара; руки на клюшке (golf.heroPose) ---------- */
    function golfLabel() { if (S.golf && ui) hudObjective(true); }   // HUD v2: «⛳ Удары: 2 из 3» — пилюля цели
    function golfStance() { const g = S.golf, st = g.G.stance(g.angle); S.px = st.x; S.pz = st.z; S.py = S.h.ground(st.x, st.z); S.ang = st.ry; if (hero && hero.rig) hero.rig.prev = null; }
    function startGolf(d) {
      const G = d.golf || S.h.golf; if (!G) { toast(d.text); return; }
      iaStop(); if (IA && IA.drop) iaDrop();
      const st = G.start(); S.golf = { G, angle: G.aimAngle(), power: 0.45, drag: null }; G.aim(S.golf.angle, S.golf.power);
      golfStance(); setView(st.view || d.view || 'golf', true); S.sitting = null;
      golfLabel(); toast('Потяни назад и отпусти — как рогатку', 3000);
      if (d.hero) later(300, () => heroSay2(d.hero, 1800)); if (d.text) toast(d.text, 2600);
    }
    function golfAim(dx, dy) {
      const g = S.golf; if (!g || !g.drag) return;
      const len = Math.hypot(dx, dy); if (len < 8) return;
      const f = cam.getWorldDirection(tmpV), fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, rx = -fz, rz = fx;
      const wx = rx * -dx + fx * dy, wz = rz * -dx + fz * dy;   // «рогатка»: тянем назад — бьём вперёд
      g.angle = Math.atan2(wx, wz); g.power = clamp(len / 170, 0.05, 1); g.drag.aimed = true; g.G.aim(g.angle, g.power); golfStance();
    }
    async function golfShoot(angle, power) {
      const g = S.golf; if (!g || g.G.rolling) return null;
      if (angle !== undefined) g.angle = angle; if (power !== undefined) g.power = power;
      const r = await g.G.shoot(g.angle, g.power); golfLabel();
      const n = npcBy('hotel_raccoon'); if (n && r && r.text) { bubble(npcHead(n), r.text, n.name, 2600); voiceBubble(r.who || 'hotel_raccoon', r.text); n.faceHero = 2.5; n.hop && n.hop(); }
      if (r && r.holed) { S.cheerT = 1.2; heroSay2(SAY.holed, 1800); }
      if (r && r.done && ui) toast(r.holed ? 'В лунке! «Встать» — закончить' : 'Удары кончились. «Встать» — закончить', 3000);
      else if (S.golf) { g.angle = g.G.aimAngle(); golfStance(); }
      S.golfLast = r; return r;
    }
    // W5: старый гольф (запас, если нет VILLAGE.sports): героиню — обратно к коврику, место снова рядом
    function stopGolf(quietly) {
      if (!S.golf) return; try { S.golf.G.stop(); } catch (e) { /* ok */ } S.golf = null; if (ui) hudObjective(true);
      const sp = S.h && S.h.spots.find(q => q.id === 'golf_putt');
      if (sp) { S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); S.ang = PI * 0.75; if (hero && hero.rig) hero.rig.prev = null; }
      if (!quietly) { setView(null); S.camInit = false; }
    }

    /* ---------- волна 4: лестница в башне (h.climb) — палец вверх/вниз или «▲ Вверх / ▼ Вниз» ---------- */
    const atTmp = {}, camW = new T.Vector3(), lookW = new T.Vector3();
    function startClimb(from) {
      const c = S.h.climb; if (!c || !c.at) return false;
      iaStop();
      S.climb = { s: from === 'top' ? c.len : 0, dir: from === 'top' ? -1 : 1, auto: from === 'top' ? -1 : 1, camMode: null };
      S.mode = 'climb'; S.sitting = null; S.view = null; S.look = null; S.level = 'ground';
      blink(); const a = ACT().tower || {}; toast(a.climb || 'Винтовая лестница', 2600);
      stepClimb(0); S.camInit = false;
      return true;
    }
    function stepClimb(dt) {
      const c = S.h.climb, C = S.climb; if (!c || !C) return;
      let inp = 0; const jy = (keys.u ? -1 : 0) + (keys.d ? 1 : 0) + (Math.abs(joy.y) > 0.25 ? joy.y : 0);
      if (jy < -0.2) inp = 1; else if (jy > 0.2) inp = -1;
      if (inp) C.auto = 0;
      const v = S.busy ? 0 : (inp || C.auto), spd = 1.55;
      if (v) { C.s = clamp(C.s + v * spd * dt, 0, c.len); C.dir = v > 0 ? 1 : -1; }
      const p = c.at(C.s, atTmp); S.px = p.x; S.py = p.y; S.pz = p.z; S.ang = C.dir > 0 ? p.ry : p.ry + PI; S.walking = !!v;
      if (C.dir > 0 && C.s >= c.len - 1e-4) finishClimb('top');
      else if (C.dir < 0 && C.s <= 1e-4) finishClimb('bottom');
    }
    function finishClimb(where) {
      const c = S.h.climb; S.climb = null; S.mode = 'walk'; blink(); S.camInit = false; if (hero && hero.rig) hero.rig.prev = null;
      if (where === 'top') { S.level = 'top'; S.px = c.top[0]; S.pz = c.top[2]; S.py = c.top[1]; S.yaw = S.ang; S.trip.tower = true; later(700, () => npcSayEvent('eagle', 'climbTop', 3200)); }
      else { S.level = 'ground'; const d = c.door; S.px = d[0]; S.pz = d[2]; S.py = S.h.ground(d[0], d[2]); const tw = S.h.places.tower; S.ang = Math.atan2(d[0] - tw.x, d[2] - tw.z); S.yaw = S.ang; }
    }
    /* ---------- волна 4: «Осмотреться» с площадки башни ---------- */
    function startLook(id) {
      const Lk = S.h.camera.looks[id]; S.look = { id, L: Lk, yaw: Lk.yaw0, pitch: Lk.pitch0, fov: Lk.fov0 }; S.view = null; S.sitting = null; S.level = 'top';
      const a = ACT().tower_top || {}; toast(a.look || 'Веди пальцем — оглядись.', 3600);
    }
    function stopLook() { S.look = null; S.camInit = false; resize(); }

    /* ---------- волна 4: события региона — коровья лепёшка: «Ой!» → подпрыгнула → шаркнула ботинком → «Фу-фу…», наклейка ---------- */
    function pollEvents() {
      const h = S.h; if (!h || !h.pollEvents) return;
      let evs = null; try { evs = h.pollEvents(); } catch (e) { evs = null; }
      (evs || []).forEach(ev => {
        S.evLog.push({ type: ev.type, id: ev.id, t: Math.round(performance.now()) }); if (S.evLog.length > 40) S.evLog.shift();
        if (ev.type !== 'cowpat') return;
        S.pats++; heroSay2((ev.hero || ['Ой!'])[0], 1100); later(1150, () => heroSay2((ev.hero || [])[1] || '', 1700));
        S.cheerT = 0.9; S.wipeDelay = 0.95; S.wipeT = 1.5;
        if (ev.sticker) later(600, () => sticker(ev.sticker));
        if (ev.line) { const cow = h.npcs.filter(n => n.speaker === 'cow' && n.root.visible).sort((a, b) => Math.hypot(a.root.position.x - S.px, a.root.position.z - S.pz) - Math.hypot(b.root.position.x - S.px, b.root.position.z - S.pz))[0]; if (cow && Math.hypot(cow.root.position.x - S.px, cow.root.position.z - S.pz) < 16) later(1700, () => { bubble(npcHead(cow), ev.line.text, cow.name, 2600); voiceBubble(ev.line.who || 'cow', ev.line.text); cow.faceHero = 2.5; }); }
      });
    }

    /* ---------- выходы ---------- */
    async function useExit(ex) {
      if (S.busy || S.zip) return;
      if (S.rid === 'kubachi') {
        // волна 6: дорога из села наверх — мимо школы к отелю (в отеле — приезд снизу, from 'kubachi')
        if (ex.id === 'toHotel' || ex.to === 'hotel') {
          if (!REG('hotel')) { toast('Отель скоро откроется.', 2600); return; }
          const lk = hotelLock(); if (!lk.ok) { toast(lk.text, 2600); return; }
          S.trip.hotel = true; await leave('hotel'); return;
        }
        if (ex.id === 'toCity') {
          const r = await sheetFn({ title: 'Машина ждёт', body: paras(['Машинка отдохнула на парковке. Куда теперь?']), actions: [{ label: 'Вниз по серпантину', value: 'road' }, { label: 'Сразу в город', value: 'city', cls: 'soft' }, { label: 'Ещё погуляю', value: 0, cls: 'soft' }] });
          if (r === 'road') await leave('serpentine'); else if (r === 'city') await leave('city');
          return;
        }
        await leave('serpentine');
        return;
      }
      if (S.rid === 'hotel') {
        if (ex.id === 'zipline' || ex.via === 'zipline') { const sp = S.h.spots.find(q => q.id === 'zipline_start'); if (sp) { if (sp.level === 'top') S.level = 'top'; return useSpot(sp); } }
        if (ex.id === 'toRoad' || ex.to === 'serpentine') { await leave('serpentine'); return; }
        if (ex.to && REG(ex.to)) { await leave(ex.to); return; }
        toast(ex.label || 'Выход'); return;
      }
      if (ex.id === 'toVillage') { S.trip.up = true; await leave('kubachi'); return; }
      if (ex.id === 'toHotel') {
        if (!REG('hotel')) { toast('Отель скоро откроется. Дорога дальше — к селу.', 2600); return; }
        const lk = hotelLock(); if (!lk.ok) { toast(lk.text, 2600); return; }
        S.trip.hotel = true; S.trip.up = true; await leave('hotel'); return;   // up — проехала серпантин сама (до развилки и по ветке)
      }
      if (ex.id === 'toCity') { S.trip.down = S.trip.down || S.dir === 'down'; await leave('city'); }
    }
    function checkExits() {
      const h = S.h; if (!h || S.mode !== 'drive' || !drv || S.busy) return null;
      for (const ex of h.exits) {
        if (ex.walk || (ex.level || 'ground') !== 'ground') continue;   // волна 6: пешие выходы (toCity села) — не из машины
        const d = Math.hypot(drv.S.x - ex.x, drv.S.z - ex.z);
        if (d > ex.r + 3) S.exitArmed[ex.id] = true;
        if (S.exitArmed[ex.id] && d < ex.r) { S.exitArmed[ex.id] = false; S.lastExit = { id: ex.id, t: performance.now() }; useExit(ex); return ex.id; }
      }
      return null;
    }

    /* ---------- кнопка действия: житель / место / выход / «Выйти» / «Сесть за руль» ---------- */
    function nearest() {
      const h = S.h; if (!h) return null;
      let best = null;
      const cand = (kind, ref, x, y, z, r, label) => { const d = Math.hypot(S.px - x, S.pz - z); if (d < r && Math.abs((y || 0) - S.py) < 2.4 && (!best || d < best.d)) best = { kind, ref, d, label }; };
      S.near2 = null;
      if (S.mode === 'walk') {
        h.npcs.forEach(n => { if (!n.root.visible || n.silent || !n.lines || !n.lines.length) return; const p = n.root.position; cand('npc', n, p.x, p.y, p.z, (n.talkR || 2.2) + (n.id === 'eagle' ? 1.5 : 0), (n.id === 'roof_cat' && S.flags.bread ? 'Угостить: ' : 'Поговорить: ') + n.name); });
        h.spots.forEach(sp => { if ((sp.level || 'ground') !== S.level) return; cand('spot', sp, sp.x, sp.y, sp.z, sp.r || 1.2, (sp.icon ? sp.icon + ' ' : '') + (sp.action || sp.label)); });
        h.exits.forEach(ex => { if (S.rid === 'serpentine' && ex.id === 'toCity') return; if ((ex.level || 'ground') !== S.level) return; cand('exit', ex, ex.x, ex.y, ex.z, ex.r || 2, (ex.icon ? ex.icon + ' ' : '') + ex.label); });
        if (drv && drv.canEnter && drv.canEnter(S.px, S.pz)) { const g = { kind: 'carIn', d: 0, label: '🚗 Сесть за руль' }; if (best) S.near2 = g; else best = g; }
      } else if (drv && S.mode === 'drive') {
        const slow = Math.abs(drv.S.v) < 1.6, cx = drv.S.x, cz = drv.S.z;
        h.exits.forEach(ex => { if (ex.walk || (ex.level || 'ground') !== 'ground') return; const d = Math.hypot(cx - ex.x, cz - ex.z); if (d < (ex.r || 6) + 6 && (!best || d < best.d)) best = { kind: 'exit', ref: ex, d, label: '☁ ' + ex.label }; });
        if (slow && S.rid === 'serpentine') {   // волна 6: «Посидеть»/«Поговорить» из машины — только на серпантине (в селе — «Выйти» и пешком)
          h.spots.forEach(sp => { const d = Math.hypot(cx - sp.x, cz - sp.z); if (d < 9 && (!best || d < best.d + 3)) best = { kind: 'spot', ref: sp, d, label: (sp.icon ? sp.icon + ' ' : '') + 'Посидеть: ' + String(sp.label || '').toLowerCase() }; });
          const tur = h.npcs.find(n => !n.silent && n.lines && n.lines.length && Math.hypot(cx - n.root.position.x, cz - n.root.position.z) < (n.talkR || 2.8) + 11);
          if (tur) { if (best && best.kind === 'spot') S.near2 = { kind: 'npc', ref: tur, label: 'Поговорить: ' + tur.name }; else if (!best) best = { kind: 'npc', ref: tur, d: 0, label: 'Поговорить: ' + tur.name }; }
        }
        if (drv.heroOut && drv.canExit && drv.canExit() && !S.near2) { const g = { kind: 'carOut', d: 0, label: '🚪 Выйти' }; if (best) S.near2 = g; else best = g; }
      }
      return best;
    }
    function act() {
      if (!S.active || S.busy || blocked() || S.zip || S.sport) return;
      if (flyActive()) { const st = S.fly.state(); if (st.auto) S.fly.manual(); else if (st.phase === 'fly') S.fly.land(); updAct(); return; }
      if (mvBusy()) return;
      if (S.dance) { danceTap(); return; }
      if (S.golf) { stopGolf(); updAct(); return; }
      if (S.climb) { S.climb.auto = S.climb.auto > 0 ? 0 : 1; return; }
      if (S.look) { stopLook(); updAct(); return; }
      if (S.inShop) { shopMenu(S.inShop); return; }
      if (S.sitting || S.view) { standUp(); updAct(); return; }
      if (IA && IA.busy()) return;
      const n = S.near; if (!n) return;
      haptic('light');
      if (n.kind === 'npc') {
        if (n.ref.id === 'roof_cat' && S.flags.bread && S.h.feedCat) { S.h.feedCat(); S.flags.bread = false; npcSayEvent('roof_cat', 'catFed', 2600); return; }
        talk(n.ref);
      } else if (n.kind === 'spot') { if (S.mode === 'drive') sitRoad(n.ref); else useSpot(n.ref); }
      else if (n.kind === 'exit') useExit(n.ref);
      else if (n.kind === 'carIn') getIn();
      else if (n.kind === 'carOut') getOut();
    }
    function act2() {
      if (!S.active || S.busy || S.zip || S.sport || flyActive() || mvBusy()) return;
      if (S.dance) { endDance(S.dance.W.dance.stop()); return; }
      if (S.climb) { S.climb.auto = S.climb.auto < 0 ? 0 : -1; return; }
      if (S.inShop) { leaveShop(S.inShop); return; }
      if (S.sitting || S.view) { standUp(); return; }
      if (!S.near2) return;
      if (S.near2.kind === 'npc') talk(S.near2.ref); else if (S.near2.kind === 'carIn') getIn(); else if (S.near2.kind === 'carOut') getOut();
    }
    // смотровая серпантина из машины: машина стоит, камера с лавочки плавно приближает (FOV 58 → 16), потом тур
    function sitRoad(sp) {
      if (!drv || Math.abs(drv.S.v) > 1.6) return;
      drv.S.v = 0; S.sitting = { h: drv.S.y, x: drv.S.x, z: drv.S.z, road: true };
      cam.fov = cam.aspect < 0.8 ? 58 : 48; cam.updateProjectionMatrix();
      setView(sp.view || 'viewpoint', true); if (S.view) S.view.zoom = true;
      later(1400, () => toast('Смотровая: посиди минутку, отсюда видно башню.', 3200));
      const tur = npcBy('tur'); if (tur) later(3200, () => { if (S.sitting && S.sitting.road) greet(tur); });
    }
    // W5: кнопки «Прыжок», «Бум!»/«Листья» (дуга s1–s4) — только когда она свободно гуляет (не в машине, не на месте, не в игре)
    const freeNow = () => S.active && !S.busy && !blocked() && S.mode === 'walk' && !inCarNow && !S.sitting && !S.view && !S.look && !S.golf && !S.dance && !S.inShop && !S.climb && !S.zip && !S.sport && !flyActive() && !S.shopBuy && !S.springT && !S.treat;
    function updW5Ui() {
      if (!ui) return;
      const free = freeNow();
      if (mvUi) mvUi.setVisible(free && !!S.mv && S.level !== 'top');
      if (S.pf) S.pf.enable(free && S.level !== 'top' && !(IA && IA.busy()));
    }
    // HUD v2: главное действие — P (за рулём — A2: в углу P газ), второе — A2 (за рулём — s3); подпись — aria-label, на кнопке значок + слово
    function updAct() {
      if (!ui) return;
      const a = ui.act, a2 = ui.act2;
      const sitLike = !!(S.sitting || S.view || S.look || S.inShop || S.golf);
      ui.root.classList.toggle('sit', sitLike);
      hudMode(); updW5Ui(); joyRest(); hudStatus();
      ckBtn(sitLike);
      const car = S.mode === 'drive' && !sitLike;
      const main = (t, soft) => paintBtn(a, t, soft, car ? 'a2' : 'P');
      const second = t => paintBtn(a2, t, true, car ? 's3' : 'a2');
      // W5: в полёте — одна кнопка: «⬇ Приземлиться» (сама сядет на площадку) или «Сама порулю» (снять авто-посадку)
      if (flyActive()) { const st = S.fly.state(); show(a2, false); if (st.phase === 'fly' && !st.auto) main('⬇ Приземлиться', false); else if (st.auto) main('🕹 Сама порулю', true); else show(a, false); return; }
      if (S.sport) { show(a, false); show(a2, false); return; }
      if (S.busy || blocked() || !S.active || S.zip || S.shopBuy || S.springT || S.treat || (IA && IA.busy()) || mvBusy()) { show(a, false); show(a2, false); return; }
      if (S.dance) { main('Хватит танцевать', true); show(a2, false); return; }
      if (S.golf) { main('Встать', true); show(a2, false); return; }
      if (S.climb) { main(S.climb.auto > 0 ? '⏸ Стоп' : '⬆️ Вверх', true); second(S.climb.auto < 0 ? '⏸ Стоп' : '⬇️ Вниз'); return; }
      if (S.look) { main('Хватит смотреть', true); show(a2, false); return; }
      if (S.inShop) { main('🛍️ Купить', false); second('Выйти из лавки'); return; }
      if (S.sitting || S.view) { main('Встать', true); show(a2, false); return; }
      S.near = nearest();
      if (S.near) main(S.near.label, false);
      else if (S.mode === 'walk' && freeNow() && S.level !== 'top') main('👋 Помахать', true);   // без дела — помахать (бывшая кнопка 👋)
      else show(a, false);
      if (S.near2) second(S.near2.label); else show(a2, false);
    }
    // нажатие P: в танце — закончить танец (Enter/пробел в танце — «Хоп!», как раньше); без дела — помахать; иначе — действие
    function actBtn() {
      if (S.dance) { act2(); return; }
      if (!S.near && !flyActive() && !S.sitting && !S.view && !S.look && !S.inShop && !S.golf && !S.climb && S.mode === 'walk') { waveBtn(); return; }
      act();
    }

    /* ---------- шаги ---------- */
    const HR = 0.3;
    function stepWalk(dt) {
      const h = S.h;
      // палец на джойстике прерывает действие рук (один раз: cancel доигрывает 0,35 с «вернуть руки»)
      if (IA && IA.busy()) { if (moveInput() && !S.inShop && !S.springT && !S.iaCancel) { S.iaCancel = true; iaStop(); } S.vx = S.vz = 0; S.walking = false; return; }
      S.iaCancel = false;
      if (S.dance) { const sl = S.dance.slot; S.px = sl.x; S.pz = sl.z; S.ang = sl.ry; S.vx = S.vz = 0; S.walking = false; if (moveInput() && !S.danceAuto) endDance(S.dance.W.dance.stop()); return; }
      // W5: «Бум!» — удар, бросок, сидит от смеха: джойстик не двигает (слой сам делает шажок к жителю); прыжок/падение доигрывает Move
      if (S.pf && S.pf.locked && S.pf.locked()) { S.vx = S.vz = 0; S.walking = false; S.moveTo = null; if (mvOn()) mvStep(dt, null); return; }
      if (S.busy || S.sitting || S.view || S.look || S.inShop || S.golf || blocked()) {
        S.vx = S.vz = 0; S.walking = false;
        // в прыжке или в кувырке (диалог, шторка) — Move доигрывает падение без ввода, иначе героиня «зависнет» в воздухе
        if (mvOn() && !S.sitting && !S.view && !S.inShop && !S.look && (S.mv.busy() || !S.mv.state.grounded)) mvStep(dt, null);
        return;
      }
      const inDir = moveInput(); let dir = inDir, speed = 0;
      if (dir) { speed = Math.max(0.35, 2.2 * dir[2]); S.moveTo = null; }
      else if (S.moveTo) {
        const m = S.moveTo; let tx = m.x, tz = m.z;
        while (m.wp && m.wp.length) { const q = m.wp[0]; if (Math.hypot(q[0] - S.px, q[1] - S.pz) < 0.45) m.wp.shift(); else { tx = q[0]; tz = q[1]; break; } }
        const fd = Math.hypot(m.x - S.px, m.z - S.pz), dx = tx - S.px, dz = tz - S.pz, d = Math.hypot(dx, dz) || 1e-6;
        if (fd < (m.stop || 0.25) && !(m.wp && m.wp.length)) { arrive(); }
        else { dir = [dx / d, dz / d, 1]; speed = fd > 6 ? 3.2 : Math.min(2.4, 1.1 + fd * 0.6); }
      }
      if (mvOn()) {   // W5: шаг — js/move.js (бег, прыжок, верхи коробок и машины, края террас, падения)
        const px0 = S.px, pz0 = S.pz, mag = dir ? (inDir ? dir[2] : 1) : 0;
        const st = mvStep(dt, { x: dir ? dir[0] * mag : 0, z: dir ? dir[1] * mag : 0, speed: dir && !inDir ? speed : undefined });
        const moved1 = Math.hypot(S.px - px0, S.pz - pz0), hs = Math.hypot(S.vx, S.vz);
        S.walking = st.speed > 0.25 || !st.grounded;
        if (hs > 0.25 && !st.busy && (dir || !st.grounded)) { S.ang += angDiff(Math.atan2(S.vx, S.vz), S.ang) * Math.min(1, dt * (st.grounded ? 11 : 6)); S.moveT += dt; } else if (st.speed <= 0.25) S.moveT = 0;
        if (S.moveTo && !inDir) { S.blockT = moved1 < speed * dt * 0.3 ? (S.blockT || 0) + dt : 0; if (S.blockT > 0.8) { S.blockT = 0; const m = S.moveTo; if (Math.hypot(m.x - S.px, m.z - S.pz) < 1.6) arrive(); else S.moveTo = null; } }
        greetNear();
        return;
      }
      S.floor = null;
      const tvx = dir ? dir[0] * speed : 0, tvz = dir ? dir[1] * speed : 0, k = Math.min(1, dt * 10);
      S.vx += (tvx - S.vx) * k; S.vz += (tvz - S.vz) * k;
      // W4A: шаг больше 12 см (медленный кадр, 10 кадров/с) — по частям, чтобы не «протиснуться» сквозь угол дома
      let nx = S.px, nz = S.pz; const mvx = S.vx * dt, mvz = S.vz * dt, nSub = Math.max(1, Math.min(6, Math.ceil(Math.hypot(mvx, mvz) / 0.12)));
      for (let q = 0; q < nSub; q++) { nx += mvx / nSub; nz += mvz / nSub; if (h.collide) [nx, nz] = h.collide(nx, nz, HR, S.py); }
      // жители и машина на парковке — мягкие круги (сквозь них не пройти)
      h.npcs.forEach(n => { if (!n.root.visible) return; const p = n.root.position; if (Math.abs(p.y - S.py) > 1.5) return; const dx = nx - p.x, dz = nz - p.z, dd = Math.hypot(dx, dz), m = 0.42 + HR; if (dd < m && dd > 1e-4) { nx = p.x + dx / dd * m; nz = p.z + dz / dd * m; } });
      if (!inCarNow && car && car.S && (car.root || car).parent === scene) { const c = car.S, fx = Math.sin(c.ry), fz = Math.cos(c.ry), half = (car.driveCfg && car.driveCfg.halfL) || 1.8; [-half * 0.6, 0, half * 0.6].forEach(q => { const cx = c.x + fx * q, cz = c.z + fz * q, dx = nx - cx, dz = nz - cz, dd = Math.hypot(dx, dz), m = 0.85 + HR; if (dd < m && dd > 1e-4) { nx = cx + dx / dd * m; nz = cz + dz / dd * m; } }); }
      const ny = h.ground(nx, nz), moved0 = Math.hypot(nx - S.px, nz - S.pz);
      if (Math.abs(ny - S.py) < 0.7 || S.level === 'top') { S.px = nx; S.pz = nz; S.py += (ny - S.py) * Math.min(1, dt * 16); if (Math.abs(ny - S.py) > 0.3) S.py = ny; }
      if (S.moveTo && !inDir) { S.blockT = moved0 < speed * dt * 0.3 ? (S.blockT || 0) + dt : 0; if (S.blockT > 0.8) { S.blockT = 0; const m = S.moveTo; if (Math.hypot(m.x - S.px, m.z - S.pz) < 1.6) arrive(); else S.moveTo = null; } }
      const sp = Math.hypot(S.vx, S.vz); S.walking = sp > 0.25;
      if (sp > 0.25) { S.ang += angDiff(Math.atan2(S.vx, S.vz), S.ang) * Math.min(1, dt * 11); S.moveT += dt; } else S.moveT = 0;
      greetNear();
    }
    // жители здороваются сами, когда подходишь (не чаще раза в 25 с; не посреди возни «Бум!» с этим жителем); ряженые свадьбы —
    // не больше одного за 6 с (их много и они подходят сами — облачка не громоздятся)
    function greetNear() {
      const h = S.h, now = performance.now();
      h.npcs.forEach(n => { if (!n.root.visible || n.silent || !n.lines || !n.lines.length) return; if (S.pf && S.pf.isReacting && S.pf.isReacting(n)) return; if (n.paltar && now - (S.palGreetT || -1e9) < 6000) return; const p = n.root.position, d = Math.hypot(p.x - S.px, p.z - S.pz); if (d < 2.6 && Math.abs(p.y - S.py) < 2.5 && now - (S.lastGreet[n.id] || -1e9) > 25000) { if (n.paltar) S.palGreetT = now; greet(n); } });
    }
    function arrive() {
      const m = S.moveTo; S.moveTo = null; if (!m || !m.thing) return;
      const t = m.thing;
      if (t.kind === 'npc') talk(t.ref); else if (t.kind === 'spot') useSpot(t.ref); else if (t.kind === 'exit') useExit(t.ref);
    }
    let momentLook = null, momentW = 0;
    function moments(dt) {
      momentLook = null; momentW = 0; const h = S.h; if (!h || !drv) return;
      (h.moments || []).forEach(m => { if (!m.done && drv.S.s > m.s0 && drv.S.s < m.s1 && drv.S.v > 0.5 && S.dir === 'up') { m.done = true; m.t = 0; if (m.id === 'emerge' && !S.sim) fogSay('emerge', 2800, 'out'); } if (m.t != null && m.t < m.dur) { m.t += dt; momentLook = m.look; momentW = Math.min(1, m.t / 1.2, (m.dur - m.t) / 1.2); } });
    }
    // без помощников: газ, тормоз и руль — только от игрока (drive.touchInput); автопилот — только для отладки и тестов
    function driveInput(dt) {
      // кнопки руля (HUD.driveCtl) — каждый кадр, даже если ввод сейчас не наш: отпущенный руль сам возвращается к центру
      const st = ui && ui.steer && ui.steer.vis ? ui.steer.frame(dt) : null;
      if (S.busy || S.sitting || S.view || blocked()) return { brake: true };
      if (S.auto) return { auto: true, thr: S.auto, road: S.autoRoad || undefined };
      if (keys.u || keys.d || keys.l || keys.r) return { thr: (keys.u ? 1 : 0) - (keys.d ? 1 : 0), str: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), brake: ped.brk };
      const V = V_();
      // телефон: руль — «‹‹» «››» (джойстика за рулём нет), газ и тормоз — педали
      if (st && V && V.drive && V.drive.touchInput) return V.drive.touchInput({ jx: canInput() ? st.str : 0, jy: 0, gas: ped.gas, brake: ped.brk, v: drv.S.v });
      // палец на экране — руль и газ без кривой джойстика (у touchInput своя: мёртвая зона 8 % и степень 1,35); отладка — joy.x/y
      const lv = joy.live && ui && ui.J;
      if (V && V.drive && V.drive.touchInput) return V.drive.touchInput({ jx: canInput() ? (lv ? joy.lx : joy.x) : 0, jy: canInput() ? (lv ? joy.ly : joy.y) : 0, gas: ped.gas, brake: ped.brk, v: drv.S.v });
      if (ped.gas || ped.brk) return { thr: ped.gas ? 1 : (drv.S.v > 0.6 ? 0 : -1), brake: ped.brk && drv.S.v > 0.6 };
      return {};
    }
    function stepDrive(dt, inp) {
      if (!drv) return;
      drv.update(dt, inp || driveInput(dt));
      if (drv.brakeLabel && ui) { const lb = drv.brakeLabel(); if (lb !== S.brkLabel) { S.brkLabel = lb; ui.brk.textContent = lb; } }
      S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y;
      if (!S.trip.down && S.dir === 'down' && S.h.road) S.trip.down = drv.S.s < (S.h.road.len * 0.5);
      moments(dt);
      fogTalk(dt);   // W5: фразы в тумане
      checkExits();
    }

    /* ---------- камера ---------- */
    const camPos = new T.Vector3(), lookP = new T.Vector3(), want = new T.Vector3(), camUp = new T.Vector3(), tp = new T.Vector3(), tl = new T.Vector3(), lk = new T.Vector3(), alt = new T.Vector3();
    // точка камеры за спиной по направлению yaw (с подъёмом над рельефом между головой и камерой)
    let camBase = 0;   // W5: высота, за которой идёт камера (в прыжке — сглаженная: камера не прыгает следом)
    function camAt(out, yaw, dist, hgt, top) {
      const h = S.h;
      out.set(S.px - Math.sin(yaw) * dist, camBase + hgt, S.pz - Math.cos(yaw) * dist);
      const gy = h.ground(out.x, out.z), lo = S.pitch > 0.05 && S.mode !== 'drive' ? 0.6 : 1.2; if (out.y < gy + lo) out.y = gy + lo;
      if (!top) { let up = 0; for (const t of [0.5, 0.75]) { camUp.lerpVectors(lookP, out, t); const g = h.ground(camUp.x, camUp.z) + 0.35; if (camUp.y + up * t < g) up = (g - camUp.y) / t; } out.y += Math.min(3.5, up); }
      return camOverCar(out);
    }
    // W7: пешком камера не влезает в стоящую машину и не смотрит на героиню сквозь неё — низко (взгляд вверх) камера
    // оказывалась в кузове (весь кадр — стенка машины) или за машиной (видна одна макушка): тогда она поднимается над крышей
    function camOverCar(out) {
      const d = drv && drv.S, cf = drv && drv.cfg;
      if (!d || !cf || S.mode === 'drive' || !car || !car.root || !car.root.visible) return out;
      const co = Math.cos(d.ry), si = Math.sin(d.ry), hw = (cf.halfW || 0.9) + 0.4, hl = (cf.halfL || 2) + 0.4;
      const inCar = (x, z) => { const dx = x - d.x, dz = z - d.z; return Math.abs(dx * co - dz * si) < hw && Math.abs(dx * si + dz * co) < hl; };
      const top = (d.yb != null ? d.yb : d.y) + ((car.dims && car.dims.height) || 1.4) + 0.35;
      if (inCar(out.x, out.z) && out.y < top) out.y = top;
      for (const t of [0.35, 0.65]) {
        if (inCar(out.x + (lookP.x - out.x) * t, out.z + (lookP.z - out.z) * t) && out.y + (lookP.y - out.y) * t < top) out.y = Math.max(out.y, (top - lookP.y * t) / (1 - t));
      }
      return out;
    }
    function updCamera(dt) {
      const h = S.h; if (!h || !cam) return;
      // вид места поставил камеру прямо у её головы (бассейн за стеклом: камера в 0,6 м) — пока так, героиню не рисуем,
      // иначе пол-экрана закрывают волосы; вне вида — снова видна
      const heroNear = !!(S.view && hero && hero.root.parent && Math.hypot(hero.root.position.x - cam.position.x, hero.root.position.z - cam.position.z) < 0.9 && Math.abs(hero.root.position.y + 1.4 - cam.position.y) < 1.2);
      if (hero && (heroNear || S.heroHid)) { S.heroHid = heroNear; hero.root.visible = !heroNear; }   // animHero каждый кадр ставит visible = true
      if (S.view) {
        const v = S.view.v; S.view.t += dt; const e = S.view.smooth ? Math.min(1, S.view.t / 1.4) : 1, ee = e * e * (3 - 2 * e);
        tp.set(v.pos[0], v.pos[1], v.pos[2]); tl.set(v.target[0], v.target[1], v.target[2]);
        cam.position.lerpVectors(S.view.from, tp, ee); lk.lerpVectors(S.view.fromLook, tl, ee); cam.lookAt(lk);
        const fov = S.view.fov;
        if (S.view.zoom) { const k = Math.min(1, S.view.t / 2.6), e2 = k * k * (3 - 2 * k); S.view.fov0 = S.view.fov0 || cam.fov; cam.fov = S.view.fov0 + (fov - S.view.fov0) * e2; cam.updateProjectionMatrix(); }
        else if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3 + (S.view.smooth ? 0 : 1)); cam.updateProjectionMatrix(); }
        return;
      }
      if (S.look) {   // «Осмотреться»: за плечом героини над парапетом, свободный взгляд
        const Lk = S.look.L, cy = Math.cos(S.look.pitch), f = [Math.sin(S.look.yaw) * cy, Math.sin(S.look.pitch), Math.cos(S.look.yaw) * cy], pv = Lk.pivot, fx = Math.sin(S.look.yaw), fz = Math.cos(S.look.yaw);
        // взгляд вниз: камера плавно выходит к парапету, героиня остаётся позади — видно село под башней, а не макушку
        const kq = clamp((-0.3 - S.look.pitch) / 0.5, 0, 1), k = kq * kq * (3 - 2 * kq), ahead = Lk.heroAhead * (1 - k) - 0.45 * k, back = Lk.dist * cy * (1 - k) - (Lk.edge || 2.4) * k;
        S.px = pv[0] + fx * ahead; S.pz = pv[2] + fz * ahead; S.py = Lk.heroY; S.ang = S.look.yaw; S.walking = false;
        cam.position.set(pv[0] - fx * back, pv[1] + Lk.up - f[1] * Lk.dist * 0.5 * (1 - k) + (Lk.edgeUp || 0.6) * k, pv[2] - fz * back);
        cam.lookAt(pv[0] + f[0] * 20, pv[1] + f[1] * 20, pv[2] + f[2] * 20);
        if (Math.abs(cam.fov - S.look.fov) > 0.01) { cam.fov += (S.look.fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
        return;
      }
      if (S.climb && h.climb && h.climb.cam) {   // лестница в башне: камера внутри, позади по лестнице
        const m = h.climb.cam(S.climb.s, S.climb.dir, camW, lookW);
        if (m !== S.climb.camMode) { if (S.climb.camMode) blink(); S.climb.camMode = m; camPos.copy(camW); }
        camPos.lerp(camW, 1 - Math.exp(-dt * 6)); cam.position.copy(camPos); cam.lookAt(lookW);
        const fovT = 66; if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
        return;
      }
      if (S.ck && S.ck.active && S.mode !== 'drive') ckSet(false);
      if ((S.mode === 'drive' || inCarMode()) && chase && drv) {
        let bias = 0; try { bias = h.cameraBias ? h.cameraBias(drv.S.x, drv.S.y, drv.S.z, drv.S.ry, drv.S.s) : 0; } catch (e) { bias = 0; }
        if (S.dir === 'down') bias = 0;
        // W7 (желание 3): палец — вокруг машины (dYaw) и вверх-вниз (pitch); 3 с без касаний — плавно назад за машину
        S.manualT = Math.max(0, S.manualT - dt); S.pitchT += dt;
        if (S.manualT <= 0) { const k = Math.exp(-dt * 1.6); S.dYaw *= k; S.pitch *= k; S.ckLook.yaw *= k; S.ckLook.pitch *= k; if (Math.abs(S.dYaw) < 0.002) S.dYaw = 0; if (Math.abs(S.pitch) < 0.002) S.pitch = 0; }
        // W7 (желание 10): вид «из-за руля» — камера в салоне (момент «посмотри туда» её не уводит)
        if (S.ck && S.ck.active) { if (S.ck.update(dt, car, hero, S.ckLook)) return; ckSet(false); }
        chase.update(dt, drv, { yawBias: bias, look: momentLook, lookW: momentW, yawOff: S.dYaw, pitch: S.pitch });
        return;
      }
      if (keys.q) { S.yaw += dt * 1.8; S.manualT = 2.5; } if (keys.e) { S.yaw -= dt * 1.8; S.manualT = 2.5; }
      S.manualT = Math.max(0, S.manualT - dt);
      // камера за героиней — только когда курс ушёл больше чем на 20°, мягко и не быстрее 34°/с: идёт чуть вбок — камера стоит
      if (S.manualT <= 0 && S.walking && S.moveT > 0.6) {
        const CAM_BAND = 0.35, CAM_T = 1.4, CAM_MAX = 0.6, e = angDiff(S.ang, S.yaw), ae = Math.abs(e);
        if (ae > CAM_BAND && ae < 2.3) S.yaw += clamp((e - Math.sign(e) * CAM_BAND) * (1 - Math.exp(-dt / CAM_T)), -CAM_MAX * dt, CAM_MAX * dt);
      }
      const top = S.level === 'top';
      let dist = top ? 6.0 : 7.2, hgt = top ? 3.2 : 4.4;
      // W7 (желание 3): взгляд вверх-вниз пальцем — камера по дуге вокруг головы: вниз — выше, вверх — ниже и ближе (небо,
      // героиня внизу кадра; у земли камера не ниже 0,6 м — дальше поднимается сам взгляд, у cam.lookAt). Отпустила — на ходу
      // через 4 с, стоя через 10 с плавно к обычному
      S.pitchT += dt; S.dYaw = 0;
      if (S.pitch && (S.pitchT > 10 || (S.pitchT > 4 && S.walking))) { S.pitch *= Math.exp(-dt * 1.6); if (Math.abs(S.pitch) < 0.002) S.pitch = 0; }
      const th0 = -Math.atan2(hgt - 1.35, dist); S.pitch = clamp(S.pitch, -0.72 - th0, 0.62 - th0);
      const th = th0 + S.pitch;
      if (S.pitch) { const R = Math.hypot(dist, hgt - 1.35), R2 = R * (1 - 0.45 * Math.max(0, th) / 0.62); dist = R2 * Math.cos(th); hgt = 1.35 - R2 * Math.sin(th); }
      // W5: прыжок и падение — камера догоняет мягко (в воздухе медленнее), после возврата/телепорта — сразу
      const air = mvOn() && !S.mv.state.grounded;
      S.camY = S.camY == null || !S.camInit ? S.py : S.camY + (S.py - S.camY) * (1 - Math.exp(-(air ? 3 : 12) * dt));
      if (!air && Math.abs(S.py - S.camY) > 3) S.camY = S.py + Math.sign(S.camY - S.py) * 3;
      camBase = S.camY;
      lookP.set(S.px, camBase + 1.35, S.pz);
      camAt(want, S.yaw, dist, hgt, top);
      if (h.rayHit && !top) {
        let t = h.rayHit(lookP, want);
        // 4B: в тесноте (дом за спиной ближе 2,6 м) — сначала повернуть камеру вбок, где свободно (без ручного поворота),
        // и только потом «над плечом»: раньше камера уходила на +3,2 м прямо над головой и смотрела сверху вниз
        if (t < 1 && t * lookP.distanceTo(want) < 2.6 && S.manualT <= 0) {
          let bestD = null, bestDa = t * lookP.distanceTo(want) + 0.8;
          for (const dy of [0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.3, -2.3, 2.8, -2.8]) {
            camAt(alt, S.yaw + dy, dist, hgt, false);
            const ta = h.rayHit(lookP, alt), da = ta * lookP.distanceTo(alt);
            if (da >= 3.2) { bestD = dy; break; }
            if (da > bestDa) { bestDa = da; bestD = dy; }   // совсем свободно нигде — хотя бы туда, где просторнее
          }
          // только что поставили (телепорт, место, лавка) — сразу; на ходу — плавно
          if (bestD !== null) { S.yaw += S.camInit ? clamp(bestD, -2.4 * dt, 2.4 * dt) : bestD; S.camFix++; camAt(want, S.yaw, dist, hgt, false); t = h.rayHit(lookP, want); }
        }
        if (t < 1) {
          const full = lookP.distanceTo(want), k = Math.max(0, t - 0.07);
          if (k * full < 1.2) {
            // совсем тесно: над плечом, но не сверху — по горизонтали не ближе 1,4 м (взгляд вниз ≤ ~55°)
            const hx = want.x - lookP.x, hz = want.z - lookP.z, hl = Math.hypot(hx, hz) || 1;
            let placed = false;
            for (const [b, u] of [[1.8, 1.5], [1.5, 1.6], [1.2, 1.4]]) {
              camUp.set(lookP.x + hx / hl * b, lookP.y + u, lookP.z + hz / hl * b);
              if (h.rayHit(lookP, camUp) >= 1 && camUp.y >= h.ground(camUp.x, camUp.z) + 0.6) { want.copy(camUp); placed = true; break; }
            }
            if (!placed) want.lerpVectors(lookP, want, Math.max(0.03, k));
          } else {
            want.lerpVectors(lookP, want, k);
            const d = k * full;
            if (d < 4) { camUp.copy(want); camUp.y += (4 - d) * 0.35; if (h.rayHit(lookP, camUp) >= 1 && camUp.y >= h.ground(camUp.x, camUp.z) + 0.6) want.copy(camUp); }
          }
        }
        // не круче ~50° вниз: камера над головой ниже, чем «сверху на макушку» (если земля позволяет)
        const hd = Math.hypot(want.x - lookP.x, want.z - lookP.z), cap = lookP.y + hd * 1.15 + 0.35;
        if (want.y > cap && cap >= h.ground(want.x, want.z) + 0.6) want.y = cap;
      }
      if (!S.camInit) { camPos.copy(want); S.camInit = true; }
      camPos.lerp(want, 1 - Math.exp(-dt * 7));
      const gc = h.ground(camPos.x, camPos.z); if (camPos.y < gc + 0.6) camPos.y = gc + 0.6;
      camOverCar(camPos);
      if (h.rayHit && !top) { const t2 = h.rayHit(lookP, camPos); if (t2 < 1) camPos.lerpVectors(lookP, camPos, Math.max(0.03, t2 - 0.07)); }
      cam.position.copy(camPos);
      // взгляд: если камера всё же над головой, смотреть чуть ниже груди — кадр не «сверху на макушку»
      const hz = Math.hypot(camPos.x - lookP.x, camPos.z - lookP.z), dyc = camPos.y - lookP.y;
      if (hz < 1.2 && dyc > 1.5) { lk.copy(lookP); lk.x += (lookP.x - camPos.x) * 0.8; lk.z += (lookP.z - camPos.z) * 0.8; cam.lookAt(lk); }
      // W7: героиня в кадре не ниже ~72 % высоты (над джойстиком): наклон вверх не больше угла до пояса + запас
      else if (S.pitch > 0.001) {
        const thE = Math.min(th, Math.atan2(lookP.y - 0.35 - camPos.y, Math.max(0.5, hz)) + Math.atan(0.44 * Math.tan(cam.fov * PI / 360)));
        lk.copy(lookP); lk.y = Math.max(lookP.y, camPos.y + hz * Math.tan(thE)); cam.lookAt(lk);
      }
      else cam.lookAt(lookP);
      const fovT = cam.aspect < 0.8 ? 58 : 48; if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    }

    /* ---------- кадр ---------- */
    let fpsAcc = 0, fpsN = 0;
    const soft = () => { try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'), s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; return /swiftshader|llvmpipe|software/i.test(s); } catch (e) { return true; } };
    let isSoft = null;
    function nightStep(dt) {
      if (!dn || !S.h) return;
      dn.update(dt, cam);
      const k = dn.lampsOn() ? Math.max(0.65, dn.night()) : dn.night() * 0.5;
      if (Math.abs(k - S.night) > 0.004 && S.h.setNight) { S.night = k; try { S.h.setNight(k); } catch (e) { /* ok */ } }
      const lo = dn.lampsOn(); if (car && car.setNight && lo !== S.carLamps) { S.carLamps = lo; try { car.setNight(lo ? 1 : 0); } catch (e) { /* ok */ } }
    }
    function draw() {
      renderer.info.reset(); renderer.render(scene, cam);
      S.info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      S.frames++;
    }
    function tick() {
      raf = requestAnimationFrame(tick);
      if (!S.active || !S.h || document.hidden) { last = performance.now(); return; }
      const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
      fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { S.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      try {
        // джойстик раз в кадр (сила и курс → joy.x/y, lx/ly) и бег — палец за краем кружка (только пешком: не в машине, не на
        // лестнице, не в полёте и не в игре)
        joyRun(mvOn() && !S.busy && !S.sitting && !S.view && !S.look && !S.inShop && !S.golf && !S.dance && !S.zip && !S.sport && !flyActive());
        if (S.zip && S.mode === 'zip') {   // зиплайн: поездка сама ведёт героиню, руки и камеру
          S.zip.update(dt);
          if (hero) { hero.root.getWorldPosition(tmpV); S.px = tmpV.x; S.py = tmpV.y; S.pz = tmpV.z; }
          if (kazWorn()) { try { V_().kaz.update(dt, { sitting: true }); } catch (e) { /* ok */ } }
          outfitTick(dt, { zip: true });
          if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
          if (blob) blob.visible = false;
          S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam);
          nightStep(dt);
          draw();
          gripHud();   // W5: «✊ Держусь!» / «Держись! 2»
          if (S.frames % 6 === 0) updAct();
          placeBubbles();
          return;
        }
        // W5: параплан — модуль сам ведёт героиню, руки, крыло и камеру (как зиплайн)
        if (S.fly && S.fly.active()) {
          const st = S.fly.update(dt, flyInput());
          if (S.fly && S.fly.active()) { S.px = st.x; S.py = st.y; S.pz = st.z; }
          if (kazWorn()) { try { V_().kaz.update(dt, { sitting: st.phase === 'fly' || st.phase === 'final' || st.phase === 'lift', flying: true }); } catch (e) { /* ok */ } }
          outfitTick(dt, { fly: true });
          if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
          if (blob) blob.visible = false;
          petsUpdate(dt);
          S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam); nightStep(dt); draw();
          if (st.hud) S.flyHud = st.hud;
          if (S.frames % 6 === 0) updAct();
          if (radar && radar.update) { try { radar.update(dt); } catch (e) { /* ok */ } }
          placeBubbles();
          return;
        }
        if (S.fly) S.fly.update(dt, null);   // без полёта: карта высот по кусочку (3 мс), птицы, пух, флюгеры
        // W5: спорт отеля — модуль ведёт героиню, позы, камеру и свой слой касаний
        if (S.sport) {
          S.sport.update(dt);
          if (S.sport && hero) { hero.root.getWorldPosition(tmpV); S.px = tmpV.x; S.py = tmpV.y; S.pz = tmpV.z; S.ang = hero.root.rotation.y; }
          outfitTick(dt, { sport: true });
          if (blob) { blob.position.set(S.px, S.py + 0.03, S.pz); blob.scale.setScalar(1); blob.visible = true; }
          if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
          petsUpdate(dt);
          if (S.h) { S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam); nightStep(dt); draw(); }
          if (S.frames % 6 === 0) updAct();
          if (radar && radar.update) { try { radar.update(dt); } catch (e) { /* ok */ } }
          placeBubbles();
          return;
        }
        if (S.sim) { /* simDrive сам ведёт машину */ }
        else if (S.mode === 'climb') stepClimb(dt);
        else if (S.mode === 'walk') { if (drv) drv.update(dt, { brake: true }); stepWalk(dt); }
        else stepDrive(dt);
        if (!S.h) return;
        animHero(dt);
        if (IA) { IA.update(dt); if (!IA.busy() && S.iaDy) { S.iaDy *= 0.7; if (Math.abs(S.iaDy) < 0.01) S.iaDy = 0; } }
        if (S.golf && hero && hero.rig) { S.walking = false; S.golf.G.heroPose(hero.rig.anim, dt, hero.root); }
        if (kazWorn()) { try { V_().kaz.update(dt, S.animSt || {}); } catch (e) { if (!S.kazErr) { S.kazErr = true; console.warn('region kaz update', e); } } }
        outfitTick(dt, Object.assign({ drive: inCarMode() }, S.animSt, S.golf ? { sport: true } : null));
        petsUpdate(dt);
        if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
        updCamera(dt);
        S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam);
        if (S.pf) { try { S.pf.update(dt); } catch (e) { if (!S.pfErr) { S.pfErr = true; console.warn('region playfight', e); } } }   // W5: после жителей и камеры
        pollEvents();
        nightStep(dt);
        draw();
        if (S.frames % 6 === 0) { updAct(); hudObjective(); }
        if (radar && radar.update) { try { radar.update(dt); } catch (e) { if (!S.radarErr) { S.radarErr = true; console.warn('region radar', e); } } }
        placeBubbles();
        fpsWatch(dt);
      } catch (e) { console.error('region tick', e); }
    }
    // слабый телефон: медиана кадра за 8 с ниже 12 кадров/с — дорисовать поездку карточками (не в swiftshader и не в тестах)
    function fpsWatch(dt) {
      if (S.fbDone || S.busy) return;
      if (isSoft === null) isSoft = soft() || !!navigator.webdriver;
      if (isSoft && !WORLD._regionFps) return;
      S.fpsT += dt; if (S.fpsT < 3) return;
      S.fpsS.push(WORLD._regionFps ? 1 / WORLD._regionFps : dt);
      if (S.fpsS.length < (WORLD._regionFps ? 12 : 240)) return;
      const a = S.fpsS.slice().sort((x, y) => x - y), med = a[a.length >> 1]; S.fpsS = [];
      if (1 / med < 12) fallback2d('fps');
    }

    /* ---------- публичное: войти, выйти, вся поездка ---------- */
    const enterLabel = (id, prev) => (id === 'kubachi' ? ((S.h && S.h.exits && (S.h.exits.find(e => e.id === 'toVillage') || {}).label) || titleOf() || '…') + '…'
      : id === 'hotel' ? 'К отелю…' : prev === 'hotel' ? 'На дорогу…' : 'Вниз по серпантину…');
    async function enter(id, from) {
      if (!REG(id)) throw new Error('region ' + id + ' missing');
      if (!S.active) {
        begin(from || 'city');
        await curtain(true, id === 'serpentine' ? 'Дорога наверх…' : '…', 'облака расступаются');
        await raf2();
        try { load(id, from || 'city'); } catch (e) { console.error('region load', e); const r = end(); if (tripRes) { const f = tripRes; tripRes = null; f(Object.assign(r, { error: String(e && e.message || e) })); } return; }
        renderOnce(); await raf2();
        await curtain(false);
        if (S.mode === 'drive') hint(HINT.drive()); else if (id === 'kubachi') driveTip();
        return;
      }
      const prev = S.rid;
      await fade(enterLabel(id, prev), () => load(id, from || prev), 'облака расступаются');
      if (id === 'kubachi') { S.trip.village = true; later(1400, () => heroSay(HERO.arrive, 2600)); hint(S.mode === 'drive' ? HINT.drive() : HINT.walk()); driveTip(); }   // волна 6: из отеля — за рулём; пешком — подсказка про езду
      if (id === 'hotel') { S.trip.hotel = true; hint('Бассейн, мини-гольф, костёр — а с башни зиплайн', 3500); }
      if (id === 'serpentine' && S.dir === 'down') hint(HINT.drive());
    }
    async function leave(to) {
      if (!S.active) return undefined;
      if (to && to !== 'city') { await enter(to, S.rid); return undefined; }
      emit('region:leave', { id: S.rid, to: 'city' });
      S.busy = true;
      await curtain(true, 'Город…', 'облака расступаются');
      await raf2();
      const r = end();
      if (tripRes) { const f = tripRes; tripRes = null; f(r); }
      return r;
    }
    function trip(o = {}) {
      if (S.active) return Promise.reject(new Error('region: поездка уже идёт'));
      S.fbDone = false;
      return new Promise(res => {
        tripRes = res;
        // волна 4B (MAP): с большой карты города — сразу в регион точки (o.to) и к самой точке (o.at / o.poi)
        const to = o.to && o.to !== 'city' && REG(o.to) ? o.to : 'serpentine';
        enter(to, o.from || 'city').then(() => { if (o.note && S.active) afterCurtain(700, () => toast(o.note, 4200)); return o.poi || o.at ? mapTravel(to, o.poi, o.at) : null; }).catch(e => {
          console.error('region trip', e);
          let r = { error: String((e && e.message) || e) };
          try { if (S.active) r = Object.assign(end(), r); } catch (x) { /* уже */ }
          if (tripRes) { const f = tripRes; tripRes = null; f(r); }
        });
      });
    }

    const R = {
      enter, leave, trip,
      active: () => S.active, region: () => S.rid, handle: () => S.h,
      info: () => Object.assign({ calls: S.info.calls, tris: S.info.tris, fps: S.fps, rid: S.rid, mode: S.mode, buildMs: S.buildMs, frames: S.frames, named, season, quality: regionQ, ownRenderer: ownR, car: car ? carKind() : null, hands: !!IA, kaz: kazWorn(), pets: pets.length }, renderer ? { mem: Object.assign({ programs: renderer.info.programs ? renderer.info.programs.length : 0 }, renderer.info.memory) } : {}),
      settings: () => ({ named, season, quality: regionQ }),
      mapInfo: () => (S.active && S.h ? mapInfo() : null),
      pois: () => (S.h ? regionPois() : []),
      dispose() { if (S.active) end(); },
      _S: S,
    };

    /* ---------- отладка и тесты ---------- */
    if (DEBUG) {
      const spotBy = id => S.h && S.h.spots.find(s => s.id === id);
      const goSpot = id => { const sp = spotBy(id); if (!sp) return false; S.level = sp.level || 'ground'; if (S.mode === 'walk') { S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); S.camInit = false; } useSpot(sp); return true; };
      const sheetBtns = () => [...document.querySelectorAll('.modal.sheet .sheet-actions button, .wr-sheet .acts button')];
      window.__region = {
        R, state: S,
        pos: () => ({ x: S.px, y: S.py, z: S.pz, ry: S.ang, mode: S.mode, level: S.level, rid: S.rid, sitting: !!S.sitting, view: S.view && S.view.id, viewT: S.view ? +S.view.t.toFixed(2) : null, busy: S.busy, active: S.active, inCar: inCarNow, look: S.look && S.look.id, climb: S.climb ? +S.climb.s.toFixed(2) : null, shop: S.inShop ? S.inShop.id : null, dance: !!S.dance, golf: !!S.golf, zip: !!S.zip,
          sport: S.sport ? S.sport.kind : null, fly: flyActive(), floor: S.floor, hay: !!(S.sitting && S.sitting.hay), mv: S.mv ? { mode: S.mv.state.mode, grounded: S.mv.state.grounded, onId: S.mv.state.onId, busy: S.mv.busy(), run: S.mv.run } : null }),
        info: () => Object.assign(R.info(), S.h && S.h.stats ? { stats: S.h.stats() } : {}),
        mem: () => (renderer ? Object.assign({ programs: renderer.info.programs ? renderer.info.programs.length : 0 }, renderer.info.memory) : null),
        frames: () => S.frames, handle: () => S.h, camera: () => cam, scene: () => scene, renderer: () => renderer,
        tp: (x, z, yaw) => { if (!S.h || S.mode !== 'walk') return null; S.px = x; S.pz = z; S.py = S.h.ground(x, z); if (yaw !== undefined) S.yaw = yaw; S.camInit = false; S.view = null; S.sitting = null; S.moveTo = null; S.look = null; return S.py; },
        talk: id => { const n = S.h && S.h.npcs.find(x => x.id === id); if (!n) return false; talk(n); return true; },
        spot: goSpot,
        exit: id => { const ex = S.h && S.h.exits.find(e => e.id === id); if (!ex) return false; useExit(ex); return true; },
        act: () => { updAct(); act(); return S.near && S.near.label; },
        act2: () => { updAct(); act2(); return S.near2 && S.near2.label; },
        near: () => { updAct(); return S.near ? S.near.label : null; },
        near2: () => { updAct(); return S.near2 ? S.near2.label : null; },
        // HUD v2: подписи кнопок — полные (aria-label), слоты; каз и время суток — строки меню ☰
        buttons: () => (ui ? { act: btnLabel(ui.act), act2: btnLabel(ui.act2), actSlot: ui.act.dataset.hudSlot || null, act2Slot: ui.act2.dataset.hudSlot || null, kaz: kazRowOn() ? '🧣 ' + kazRowLabel() : null, tap: !ui.tap.classList.contains('hidden'), skip: !ui.skip.classList.contains('hidden'), dn: dnRowText(), mode: S.hudMode || null } : null),
        menu: () => { const H = HUD_(); return H && H.menu ? H.menu.list() : null; },
        hudStatus: () => S.hudStatus, hudObj: () => { const H = HUD_(); const o = H && H.objective ? H.objective.get() : null; return o ? { icon: o.icon, text: o.text, title: o.title } : null; },
        go: id => { if (!id) { setView(null); return true; } setView(id, false); return !!S.view; },
        stand: () => standUp(),
        drive: () => (drv ? Object.assign(drv.info(), { door: drv.doorPoint ? (q => ({ x: +q.x.toFixed(2), z: +q.z.toFixed(2) }))(drv.doorPoint(1)) : null, dir: S.dir, len: S.h.road ? +S.h.road.len.toFixed(1) : null, trip: Object.assign({}, S.trip), busy: S.busy, near: S.near && S.near.label, near2: S.near2 && S.near2.label, view: S.view && S.view.id, fov: +cam.fov.toFixed(1), mode: drv.mode, canExit: drv.canExit(), heroInCar: !!(hero && car && isChildOf(hero.root, car.body)) }) : null),
        // волна 7: по селу — h.drive.road (s закодировано: 1000·(ri+1)+s), S.dir там всегда 'village'
        teleportS: (s, rev) => { const rd = S.h && (S.h.road || (S.h.drive && S.h.drive.road)); if (!drv || !rd) return null; const q = rd.sample(s); drv.teleport(rev ? { x: q.x, z: q.z, ry: q.th + PI } : s); if (S.rid !== 'kubachi') S.dir = rev ? 'down' : 'up'; S.exitArmed = {}; if (chase) chase.snap(); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; setHud(); return drv.info(); },
        teleportCar: (x, z, ry) => { if (!drv) return null; drv.teleport({ x, z, ry: ry || 0 }); S.exitArmed = {}; if (chase) chase.snap(); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; setHud(); return drv.info(); },   // машина — в точку (x, z), курс ry
        roads: () => (S.rid === 'kubachi' && S.h && S.h.drive && S.h.drive.roads ? S.h.drive.roads.map(r => ({ id: r.id, len: r.len, pts: r.pts })) : null),   // дороги села (QA)
        auto: (thr, road) => { S.auto = thr || 0; S.autoRoad = road || null; return S.auto; },
        sitRoad: () => { const sp = S.h && S.h.spots[0]; if (sp) sitRoad(sp); return !!S.view; },
        // быстрая езда без рендера (физика 60 Гц, выходы срабатывают как в игре; петля кадров машину в это время не трогает)
        simDrive: (sec, inp, o = {}) => new Promise(res => {
          const dt = 1 / 60; let t = 0; const start = S.rid; let exitAt = null; const t0 = performance.now();
          S.sim = true;
          const run = () => {
            for (let n = 0; n < 240 && t < sec; n++) {
              if (S.busy || S.rid !== start || S.mode !== 'drive' || !drv) { fin(); return; }
              const input = inp === 'auto' ? { auto: true, thr: o.thr || 1, road: o.road } : (inp || { thr: 1 });
              drv.update(dt, input); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; moments(dt);
              t += dt;
              const ex = checkExits(); if (ex) { exitAt = { id: ex, t: +t.toFixed(1) }; fin(); return; }
              if (o.until != null && (S.dir === 'down' ? drv.S.s <= o.until : drv.S.s >= o.until)) { for (let b = 0; b < 180 && Math.abs(drv.S.v) > 0.02; b++) drv.update(dt, { brake: true }); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; fin(); return; }
            }
            if (t >= sec) { fin(); return; }
            requestAnimationFrame(run);
          };
          const fin = () => {
            S.sim = false;
            if (!exitAt && S.lastExit && S.lastExit.t >= t0) exitAt = { id: S.lastExit.id, t: +t.toFixed(1) };
            if (chase) chase.snap(); res({ t: +t.toFixed(1), exit: exitAt, info: drv ? drv.info() : null });
          };
          run();
        }),
        // ---------- волна 4 ----------
        getOut: () => getOut(), getIn: () => getIn(),
        benches: () => (S.h && S.h.benches ? S.h.benches.map(b => ({ id: b.id, x: b.x, z: b.z, s: b.s })) : []),
        // подойти пешком к лавочке i (как палец на джойстике) и сесть кнопкой
        walkTo: (x, z, sec = 30) => new Promise(r => {
          const t0 = performance.now(); let lastD = 1e9, stuckT = performance.now();
          const kk = () => {
            const dx = x - S.px, dz = z - S.pz, d = Math.hypot(dx, dz);
            if (d < lastD - 0.05) { lastD = d; stuckT = performance.now(); }
            if (!S.active || d < 0.5 || performance.now() - t0 > sec * 1000 || performance.now() - stuckT > 2500) { joy.x = joy.y = 0; r({ ok: d < 0.5, d: +d.toFixed(2), x: +S.px.toFixed(2), z: +S.pz.toFixed(2) }); return; }
            const a = Math.atan2(dx, dz) - S.yaw; joy.x = -Math.sin(a); joy.y = -Math.cos(a); requestAnimationFrame(kk);
          };
          S.view = null; S.sitting = null; kk();
        }),
        // держать палец sec секунд ИГРОВОГО времени (кадр ≤ 0,1 с): на программном рендере 2 с настоящих — это 0,3 с игры
        walk: (jx, jy, sec) => new Promise(r => { const t0 = performance.now(), f0 = S.frames, nf = Math.ceil(sec * 10); const kk = () => { joy.x = jx; joy.y = jy; const el = performance.now() - t0; if (S.active && el < 90000 && (el < sec * 1000 || S.frames - f0 < nf)) requestAnimationFrame(kk); else { joy.x = joy.y = 0; r(window.__region.pos()); } }; kk(); }),
        hands: () => ({ ia: !!IA, busy: !!(IA && IA.busy()), holding: IA && IA.holding ? !!IA.holding() : false, pocketed: !!(IA && IA.pocketed && IA.pocketed()), canPocket: !!(IA && IA.canPocket && IA.canPocket()), events: S.iaEv.slice(-30) }),
        iaEvents: () => S.iaEv.slice(),
        counts: () => ({ sat: S.sat, springs: S.springs, breads: S.breads, bakeryAte: S.bakeryAte || 0, buys: S.buys, treats: S.treats, congrats: S.congrats, pats: S.pats, camFix: S.camFix, bag: S.bag.slice(), stickers: S.stickers.slice() }),
        sheet: () => { const b = sheetBtns(); return b.length ? b.map(x => x.textContent.trim()) : null; },
        pick: v => { const bs = sheetBtns(); const b = typeof v === 'number' ? bs[v] : bs.find(x => x.textContent.indexOf(v) >= 0); if (!b) return false; b.click(); return b.textContent.trim(); },
        // лавки: зайти (shop_food | shop_craft | shop_cloth); дальше — лист игры (pick), «Выйти»
        shop: id => goSpot(id),
        inShop: () => (S.inShop ? { id: S.inShop.id, bag: S.bag.slice(), buying: S.shopBuy || null } : null),
        leaveShop: () => { if (!S.inShop) return false; if (sheetBtns().length) window.__region.pick('Выйти'); else leaveShop(S.inShop); return true; },
        spring: () => goSpot('spring_lid'),
        climb: from => startClimb(from === 'top' ? 'top' : 'bottom'),
        look: (id, yaw, pitch, fov) => {
          if (id === false || id === null) { stopLook(); return null; }
          const looks = (S.h && S.h.camera.looks) || {}; id = id || 'tower_top'; if (!looks[id]) return false;
          if (!S.look || S.look.id !== id) startLook(id);
          if (yaw != null) S.look.yaw = yaw; if (pitch != null) S.look.pitch = clamp(pitch, S.look.L.pitchMin, S.look.L.pitchMax); if (fov != null) S.look.fov = clamp(fov, S.look.L.fovMin, S.look.L.fovMax);
          return { id, yaw: S.look.yaw, pitch: S.look.pitch, fov: S.look.fov };
        },
        pats: () => ({ list: ((S.h && S.h.pats) || []).map(p => ({ id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: p.r })), stepped: S.pats, stickers: S.stickers.slice(), events: S.evLog.slice(-10) }),
        // подойти к лепёшке за 1,6 м и наступить (как пальцем на джойстике) → { hit, pats, sticker }
        stepOnPat: (i, from) => new Promise(res => {
          const p = ((S.h && S.h.pats) || [])[i | 0]; if (!p) { res(null); return; }
          const a = from === undefined ? S.yaw : from; S.mode = 'walk'; S.level = 'ground'; S.view = null; S.sitting = null; S.look = null;
          S.px = p.x - Math.sin(a) * 1.6; S.pz = p.z - Math.cos(a) * 1.6; S.py = S.h.ground(S.px, S.pz); S.camInit = false;
          const n0 = S.pats, s0 = S.stickers.length, t0 = performance.now();
          const kk = () => { const dx = p.x - S.px, dz = p.z - S.pz, d = Math.hypot(dx, dz);
            if (S.pats > n0 || performance.now() - t0 > 6000 || d < 0.06) {
              joy.x = joy.y = 0; const hit = S.pats > n0, t1 = performance.now();
              // наклейка — после «Фу-фу…» (по игровым часам): ждём её, а не фиксированные 0,8 с
              // наклейка одна на поездку: если она уже была (наступила раньше по дороге) — новой не будет, отдаём ту
              const fin = () => { if (hit && !s0 && S.stickers.length <= s0 && performance.now() - t1 < 20000) { setTimeout(fin, 200); return; } res({ hit, pats: S.pats, d: +d.toFixed(2), sticker: S.stickers.slice(-1)[0] || null, before: s0 }); };
              fin(); return;
            }
            const b = Math.atan2(dx, dz) - S.yaw, m = d < 0.5 ? 0.35 : 0.7; joy.x = -Math.sin(b) * m; joy.y = -Math.cos(b) * m; requestAnimationFrame(kk); };
          requestAnimationFrame(kk);
        }),
        kaz: () => ({ mode: KAZ_MODE(), ok: kazOk(), worn: kazWorn(), btn: ui && kazRowOn() ? '🧣 ' + kazRowLabel() : null, beretHidden: !!(V_() && V_().kaz && V_().kaz.beretHidden && V_().kaz.beretHidden()) }),
        kazOn: on => (on ? kazWear({ instant: true, say: false }) : kazRemove()),
        kazBtn: () => kazBtn(),
        car: () => ({ kind: car ? carKind() : null, own: ownCar, drv: drv ? drv.mode : null, cfg: drv ? { halfL: drv.cfg.halfL, halfW: drv.cfg.halfW } : null, lamps: S.carLamps }),
        pets: () => pets.map(p => ({ kind: p.kind, state: p.state, x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +Math.hypot(p.x - S.px, p.z - S.pz).toFixed(2), anim: !!p.I || !!p.cat, inScene: !!scene && p.root.parent === scene, onCar: !!(car && p.root.parent === car.body) })),
        wed: () => { const W = S.h && S.h.wedding; return W ? { dance: !!S.dance, danceActive: W.dance.active, last: S.lastDance || null, treats: S.treats, treat: S.treat || null, prank: W.prankState, prankLog: S.prankLog.slice(), lod: W.lod } : null; },
        wedSpot: id => goSpot(id),
        danceTap: () => danceTap(),
        danceAuto: on => { S.danceAuto = !!on; return S.danceAuto; },
        prank: () => { const W = S.h && S.h.wedding; return W ? W.prank() : null; },
        // W5: тестовый «палец» держит ручку с самого начала (как раньше — поездка до села); zip({ hold: false }) — без пальца
        zip: o => { const sp = spotBy('zipline_start'); if (!sp) return false; S.zipTestHold = !(o && o.hold === false); S.level = 'top'; S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); useSpot(sp); return true; },
        zipHold: b => { S.zipTestHold = !!b; if (S.zip && S.zip.hold) { if (b) S.zip.hold(true); else if (!S.zipPts && !S.zipHoldKey) S.zip.hold(false); return true; } return false; },
        zipGrip: () => (S.zip && S.zip.grip ? S.zip.grip() : null), zipDrops: () => S.zipDrops, gripUi: () => (ui && ui.grip ? { on: ui.grip.classList.contains('on'), free: ui.grip.classList.contains('free'), held: ui.grip.classList.contains('held'), text: ui.gripT.textContent } : null),
        zipState: () => (S.zip && S.zip.state ? S.zip.state() : null), zipEvents: () => S.zipEv.slice(), zipResult: () => S.zipResult || null,
        skip: () => { if (S.zip && S.zip.skip) { S.zip.skip(); return true; } return false; },
        // гольф: место golf_putt → новый гольф (VILLAGE.sports); хуки волны 4 работают поверх него (удар, ждать, пока мяч встанет)
        golfStart: () => { const sp = spotBy('golf_putt'); if (!sp) return false; S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); useSpot(sp); return !!(S.golf || (S.sport && S.sport.kind === 'golf')); },
        golfShoot: (a, p) => {
          if (S.golf) return golfShoot(a, p);
          const c = S.sport; if (!c || c.kind !== 'golf' || !c.debug || !c.debug.shoot) return Promise.resolve(null);
          const st0 = c.state(), hole0 = st0.hole;
          if (!c.debug.shoot(a, p)) return Promise.resolve(null);
          return new Promise(res => { const t0 = performance.now(); const kk = () => { const st = S.sport && S.sport.state(); if (!st || st.ended || st.phase === 'aim' || st.phase === 'over' || st.hole !== hole0 || performance.now() - t0 > 60000) { const said = S.sport && S.sport.debug.said ? S.sport.debug.said() : []; const last = said.slice(-1)[0]; res({ done: !st || st.ended || st.phase === 'over' || st.hole !== hole0, holed: !!(st && (st.hole !== hole0 || st.phase === 'over')), text: (last && (last.text || last)) || 'Мячик катится!', strokes: st ? st.strokes : null, hole: st ? st.hole : null }); return; } setTimeout(kk, 150); }; setTimeout(kk, 300); });
        },
        golfState: () => (S.golf ? S.golf.G.state() : S.sport && S.sport.kind === 'golf' ? S.sport.state() : null),
        golfStop: () => { if (S.golf) return stopGolf(); if (S.sport) { sportStop(); return true; } return false; },
        golfAngle: () => (S.golf ? S.golf.G.aimAngle() : S.sport && S.sport.debug && S.sport.debug.holeDir ? S.sport.debug.holeDir() : null), golfLast: () => S.golfLast,
        // ---------- волна 5 ----------
        sport: () => (S.sport ? S.sport.state() : null), sportCtl: () => S.sport, sportLog: () => S.sportLog.slice(), sportStop: () => sportStop(),
        sportStart: (k, variant) => { const sp = spotBy(k === 'golf' ? 'golf_putt' : k + '_play'); if (!sp || S.mode !== 'walk') return false; S.level = 'ground'; S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); S.view = null; S.sitting = null; useSpot(sp); if (variant && S.sport && S.sport.debug && S.sport.debug.variant) S.sport.debug.variant(variant); return !!S.sport; },
        fly: from => { const sp = spotBy(from === 'knoll' ? 'fly_knoll' : 'fly_tower'); if (!sp || !S.fly) return false; S.level = sp.level || 'ground'; S.px = sp.x; S.pz = sp.z; S.py = sp.level === 'top' ? (sp.y || S.py) : S.h.ground(sp.x, sp.z); S.view = null; S.sitting = null; useSpot(sp); return flyActive(); },
        flyState: () => (S.fly ? S.fly.state() : null), flyLand: id => (S.fly && S.fly.active() ? S.fly.land(id) : null), flyManual: () => (S.fly ? S.fly.manual() : false), flyLog: () => S.flyLog.slice(),
        flyReady: () => (S.fly ? S.fly.prepare(50) : null), flyInput: (x, y) => { joy.x = x || 0; joy.y = y || 0; return true; },
        bazaar: on => bazaarSet(on),
        mv: () => (S.mv ? Object.assign({}, S.mv.state, { pos: Object.assign({}, S.mv.state.pos), busy: S.mv.busy(), stats: S.mv.stats(), lastSafe: Object.assign({}, S.mv.lastSafe) }) : null),
        mvLog: () => S.mvLog.slice(), jump: () => { if (!S.mv) return false; S.mv.jump(); return true; }, run: b => { if (!S.mv) return null; S.mv.setRun(b); return S.mv.run; },
        mvButtons: () => (mvUi ? { visible: !mvUi.el.classList.contains('hide'), run: !!(S.mv && S.mv.run) } : null),
        support: (x, z, y) => (S.mv ? S.mv.supportAt(x, z, y) : null),
        pf: () => (S.pf ? Object.assign(S.pf.state(), { enabled: S.pf.enabled(), target: S.pf.target() ? S.pf.target().id : null }) : null), pfLog: () => S.pfLog.slice(), pfCtl: () => S.pf,
        bonk: () => { if (!S.pf) return false; S.pf.bonk(); return true; },
        pfButtons: () => { const q = c => { const el = ui && ui.root.querySelector(c); return el && !el.classList.contains('hidden') && el.offsetParent !== null ? el.textContent.trim() : null; }; return { bonk: q('.pf-bonk'), toss: q('.pf-toss') }; },
        wave: () => waveBtn(), waveLog: () => S.waveLog.slice(),
        fogLog: () => S.fogLog.slice(), fogInfo: () => (S.h && S.h.fogInfo ? Object.assign({}, S.h.fogInfo({})) : null), fogState: () => ({ inside: FOG.inside, mid: FOG.mid, dir: FOG.dir, said: Object.keys(FOG.said) }),
        hay: () => (hay ? { visible: hay.group.visible, x: +hay.group.position.x.toFixed(2), z: +hay.group.position.z.toFixed(2) } : null),
        // ввод как палец игрока: педали и джойстик (руль в машине / ходьба / руль параплана)
        input: o => { o = o || {}; if (o.gas !== undefined) ped.gas = !!o.gas; if (o.brake !== undefined) ped.brk = !!o.brake; if (o.jx !== undefined) joy.x = o.jx; if (o.jy !== undefined) joy.y = o.jy; return true; },
        drvS: () => (drv ? { x: drv.S.x, z: drv.S.z, y: drv.S.y, ry: drv.S.ry, v: drv.S.v, s: drv.S.s, sb: drv.S.sb, rid: drv.S.rid, steer: drv.S.steer, mode: drv.S.mode, edges: drv.S.edges, dir: S.dir } : null),
        voiceLog: () => S.voiceLog.slice(),
        // езда настоящими «педалями и рулём» (как палец игрока): газ/тормоз и руль −1…1, sec — игровых секунд
        driveHold: (gas, brake, steer, sec) => new Promise(res => { const f0 = S.frames, t0 = performance.now(), nf = Math.ceil(sec * 10); ped.gas = !!gas; ped.brk = !!brake; joy.x = steer || 0; joy.y = 0; const kk = () => { const el = performance.now() - t0; if (S.active && S.mode === 'drive' && el < 120000 && (el < sec * 1000 || S.frames - f0 < nf)) requestAnimationFrame(kk); else { ped.gas = false; ped.brk = false; joy.x = 0; res(drv ? drv.info() : null); } }; kk(); }),
        heroAt: (x, z, ry, level) => { iaStop(); S.level = level || 'ground'; placeHero(x, z, ry, ry); S.view = null; S.sitting = null; return S.py; },
        cam: (pos, target, fov) => { if (!pos) { S.view = null; S.camInit = false; return true; } S.view = { id: 'probe', v: { pos, target, fov: fov || 50 }, t: 10, from: new T.Vector3(), fromLook: new T.Vector3(), smooth: false, fov: fov || 50 }; return true; },
        camPitch: () => { if (!cam) return null; const d = cam.getWorldDirection(tmpV); return +(Math.asin(clamp(d.y, -1, 1)) * 180 / PI).toFixed(1); },
        dn: () => (window.DayNight ? { hour: +DayNight.hour().toFixed(2), phase: DayNight.phase(), override: DayNight.override(), lamps: dn ? dn.lampsOn() : null, night: S.night, toggle: dnRowText() } : null),
        dnSet: v => { if (!window.DayNight) return null; DayNight.set(v, { persist: false, instant: true }); if (dnToggle) dnToggle.refresh(); return DayNight.phase(); },
        dnClock: hr => { if (!window.DayNight) return null; DayNight.setClock(hr == null ? null : () => hr); if (dnToggle) dnToggle.refresh(); return DayNight.phase(); },
        mapInfo: () => R.mapInfo(),
        bubbles: () => bubbles.filter(b => b.until > performance.now()).map(b => b.el.textContent),
        said: () => S.said.slice(),   // все облачка поездки (кто: текст) — тестам не нужно ловить облачко в его 2–3 секунды
        toasts: () => (S.toastLog || []).slice(),   // и все тосты
        lastUse: () => S.lastUse || null,
      };
    }
    return R;
  }

  const flyLockW = () => featureLock('paraglider', 'trip'), sportsLockW = () => featureLock('sports', 'trip');   // W5B: для карточек 2D (trip2d.js)
  WORLD.Regions = { can, unlocked, settings, signLabel, create, hotelLock, zipLock, flyLock: flyLockW, sportsLock: sportsLockW, version: 2 };
})();
