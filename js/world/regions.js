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

  /* ---------- стиль: шторка-облака, педали, лист-запас, мастерская, волна 4 (каз, «Хоп!», зиплайн, гольф) ---------- */
  const CSS = `
.wr-touch{position:absolute;inset:0;z-index:4;touch-action:none}
.w-reg{z-index:6}
.w-reg .wr-act2{bottom:calc(84px + var(--safe-bottom,0px))}
.w-reg.drive .w-act{bottom:calc(122px + var(--safe-bottom,0px))}
.w-reg.drive .wr-act2{bottom:calc(188px + var(--safe-bottom,0px))}
.wr-pedals{position:absolute;right:14px;bottom:calc(18px + var(--safe-bottom,0px));display:none;gap:10px;z-index:21}
.w-reg.drive .wr-pedals{display:flex}
.w-reg.sit .wr-pedals,.w-reg.sit .w-joy,.w-reg.sit .wr-speed{display:none!important}
.wr-pedal{width:72px;height:90px;border:0;border-radius:22px;font:inherit;font-size:14px;font-weight:900;color:var(--ink,#3A2E3F);display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;box-shadow:0 4px 0 rgba(58,46,63,.18);cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none}
.wr-pedal.gas{background:#A8D8C4}.wr-pedal.brk{background:#F2B8C6}.wr-pedal.down{transform:translateY(3px) scale(.97);filter:brightness(.95)}
.wr-speed{position:absolute;right:12px;top:calc(60px + var(--safe-top,0px));background:rgba(255,253,249,.88);border-radius:12px;padding:4px 10px;font-weight:900;font-size:13px;display:none;pointer-events:none!important;z-index:15}
.w-reg.drive .wr-speed{display:block}
.w-reg .w-hint{white-space:normal;width:max-content;max-width:80%;text-align:center}
.w-reg.drive .w-hint{bottom:calc(300px + var(--safe-bottom,0px))}
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
.wr-dn,.wr-kaz{position:absolute;left:10px;z-index:19;border:0;border-radius:16px;padding:8px 12px;font:inherit;font-weight:900;font-size:13px;background:rgba(255,253,249,.94);color:var(--cherry,#C2405B);box-shadow:0 3px 0 rgba(58,46,63,.14);cursor:pointer;white-space:nowrap}
.wr-dn{top:calc(60px + var(--safe-top,0px))}
.wr-kaz{top:calc(104px + var(--safe-top,0px))}
.wr-tap{position:absolute;left:50%;bottom:calc(150px + var(--safe-bottom,0px));width:108px;height:108px;margin-left:-54px;border:0;border-radius:50%;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-size:21px;font-weight:900;box-shadow:0 6px 0 var(--cherry-d,#9E2F47);touch-action:none;transition:transform .08s;z-index:22;cursor:pointer}
.wr-tap.beat{transform:scale(1.12)}
.wr-skip{position:absolute;right:12px;top:calc(60px + var(--safe-top,0px));height:44px;padding:0 16px;border:0;border-radius:22px;background:rgba(255,253,249,.96);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:15px;box-shadow:0 4px 0 rgba(58,46,63,.16);z-index:22;cursor:pointer}
.wr-golf{position:absolute;left:50%;transform:translateX(-50%);top:calc(60px + var(--safe-top,0px));background:rgba(255,253,249,.94);border-radius:16px;padding:8px 14px;font-weight:900;font-size:14px;line-height:1.25;box-shadow:0 3px 0 rgba(58,46,63,.12);text-align:center;pointer-events:none!important;z-index:15;white-space:nowrap}
.wr-golf small{color:var(--ink-2,#6E6272);font-weight:800}
.wr-sticker{position:absolute;left:50%;top:calc(112px + var(--safe-top,0px));z-index:23;transform:translateX(-50%) rotate(-4deg) scale(.6);background:#FFF6D8;border:3px dashed #E2B04E;color:#7A5418;font-weight:900;font-size:15px;padding:10px 16px;border-radius:18px;box-shadow:0 5px 0 rgba(58,46,63,.15);opacity:0;transition:opacity .3s,transform .35s cubic-bezier(.3,1.6,.5,1);pointer-events:none!important;white-space:nowrap}
.wr-sticker.on{opacity:1;transform:translateX(-50%) rotate(-4deg) scale(1)}
.wr-blink{position:absolute;inset:0;z-index:30;background:#2A2230;opacity:0;pointer-events:none!important;transition:opacity .13s}
.wr-blink.on{opacity:.82}
.w-reg.zip .w-act,.w-reg.zip .wr-act2,.w-reg.zip .w-joy,.w-reg.zip .wr-pedals,.w-reg.zip .wr-kaz,.w-reg.zip .wr-speed{display:none!important}
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
    const toast = (t, ms) => { if (!t) return; (S.toastLog = S.toastLog || []).push(t); if (S.toastLog.length > 30) S.toastLog.shift(); if (refs.toast) refs.toast(t, ms); else if (G_() && G_().toast) G_().toast(t, ms); else ownToast(t, ms); };
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
    };
    let renderer = refs.renderer || null, ownR = false, canvas = null, host = refs.host || null, cam = null, scene = null;
    let ui = null, raf = 0, last = 0, cap = null, tripRes = null, drv = null, chase = null, blob = null, hidden = [], prevSpk = null, inCarNow = false;
    let IA = null, prevHands = null, shadowProxy = null, dn = null, dnToggle = null, dnOff = null, radar = null, pets = [];

    /* ---------- облачка, тост, лист-запас ---------- */
    const bubbles = [];
    const tmpV = new T.Vector3();
    function bubble(getPos, text, title, ms, cls) {
      if (!ui || !text) return;
      S.said.push((title ? title + ': ' : '') + text); if (S.said.length > 40) S.said.shift();
      let b = bubbles.find(x => x.getPos === getPos);
      if (!b) { const el = document.createElement('div'); el.className = 'w-say'; ui.bub.appendChild(el); b = { el, getPos }; bubbles.push(b); }
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
        b.el.style.transform = `translate(${clamp(x, hw, W - hw)}px, ${clamp(y, 110, H - 150)}px) translate(-50%, -100%)`;
      }
    }
    // голос облачка: запись из voice/ или «лепет» (G.voiceLine), как у жителей города
    function voiceBubble(who, text) {
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
    function sticker(t) { if (!ui || !t || S.stickers.includes(t)) return; S.stickers.push(t); ui.sticker.textContent = '🐄 ' + t; ui.sticker.classList.add('on'); try { sfx('sticker'); } catch (e) { /* ok */ } setTimeout(() => ui && ui.sticker.classList.remove('on'), 3600); }
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

    /* ---------- интерфейс региона ---------- */
    function makeUI() {
      const root = document.createElement('div'); root.className = 'w-ui w-reg';
      root.innerHTML = `
        <div class="w-bubbles"></div>
        <div class="w-joy joy hidden"><div class="joy-knob"></div></div>
        <div class="w-joy joy ghost"><div class="joy-knob"></div></div>
        <button class="w-act hidden" type="button"></button>
        <button class="w-act soft wr-act2 hidden" type="button"></button>
        <div class="wr-pedals"><button class="wr-pedal brk" type="button">тормоз</button><button class="wr-pedal gas" type="button">газ</button></div>
        <div class="wr-speed"></div>
        <button class="wr-kaz hidden" type="button"></button>
        <button class="wr-tap hidden" type="button">Хоп!</button>
        <button class="wr-skip hidden" type="button">⏭ Пропустить</button>
        <div class="wr-golf hidden"><span class="wr-golf-t">Потяни назад и отпусти</span><br><small class="wr-golf-n">удары: 3</small></div>
        <div class="wr-sticker"></div>
        <div class="wr-blink"></div>
        <div class="w-hint hidden"></div>`;
      const touch = document.createElement('div'); touch.className = 'wr-touch';
      const fade = document.createElement('div'); fade.className = 'wr-fade'; fade.innerHTML = '<div class="lbl"></div><div class="sub"></div>';
      const $ = s => root.querySelector(s);
      return { root, touch, fade, bub: $('.w-bubbles'), joy: $('.w-joy:not(.ghost)'), knob: $('.w-joy:not(.ghost) .joy-knob'), ghost: $('.w-joy.ghost'), act: $('.w-act:not(.wr-act2)'), act2: $('.wr-act2'), gas: $('.wr-pedal.gas'), brk: $('.wr-pedal.brk'), speed: $('.wr-speed'), hint: $('.w-hint'),
        kaz: $('.wr-kaz'), tap: $('.wr-tap'), skip: $('.wr-skip'), golf: $('.wr-golf'), golfT: $('.wr-golf-t'), golfN: $('.wr-golf-n'), sticker: $('.wr-sticker'), blink: $('.wr-blink') };
    }
    const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
    let hintT = 0;
    function hint(t, ms = 5200) { if (!ui) return; ui.hint.textContent = t; ui.hint.classList.remove('off'); show(ui.hint, true); clearTimeout(hintT); hintT = setTimeout(() => ui && ui.hint.classList.add('off'), ms); }

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
    const keys = {}, joy = { id: null, x: 0, y: 0, cx: 0, cy: 0, x0: 0, y0: 0, t0: 0, moved: 0 }, look = new Map(), ped = { gas: false, brk: false }, pts = new Map();
    const KM = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyQ: 'q', KeyE: 'e' };
    const canInput = () => S.active && !S.busy && !blocked();
    const onKeyDown = e => {
      if (!S.active || blocked()) return;
      if (KM[e.code]) { keys[KM[e.code]] = true; S.moveTo = null; e.preventDefault(); return; }
      if (e.code === 'KeyB' || e.code === 'ShiftLeft') ped.brk = true;
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); act(); }
    };
    const onKeyUp = e => { if (KM[e.code]) keys[KM[e.code]] = false; if (e.code === 'KeyB' || e.code === 'ShiftLeft') ped.brk = false; };
    const onBlur = () => { Object.keys(keys).forEach(k => { keys[k] = false; }); joy.id = null; joy.x = joy.y = 0; ped.gas = ped.brk = false; pts.clear(); look.clear(); if (S.golf) S.golf.drag = null; if (ui) { show(ui.joy, false); ui.gas.classList.remove('down'); ui.brk.classList.remove('down'); } };
    const rel = e => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
    const onDown = e => {
      e.stopPropagation(); if (!S.active) return;
      const [x, y, r] = rel(e);
      pts.set(e.pointerId, { x, y });
      try { ui.touch.setPointerCapture(e.pointerId); } catch (x2) { /* старые браузеры */ }
      if (S.golf && canInput()) { const G = S.golf.G; if (!G.rolling && G.tries < G.maxTries && !G.holed) { S.golf.drag = { x, y, id: e.pointerId }; return; } }
      if (S.look) { if (pts.size === 2) { const [a, b] = [...pts.values()]; S.look.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: S.look.fov }; } return; }
      if (x < r.width * 0.5 && joy.id === null) {
        joy.id = e.pointerId; joy.cx = clamp(x, 70, r.width * 0.5 - 20); joy.cy = clamp(y, 120, r.height - 60); joy.x = joy.y = 0; joy.x0 = x; joy.y0 = y; joy.t0 = performance.now(); joy.moved = 0;
        if (canInput()) { ui.joy.style.left = joy.cx + 'px'; ui.joy.style.top = joy.cy + 'px'; show(ui.joy, true); ui.ghost.style.display = 'none'; ui.knob.style.transform = ''; }
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
        let dx = x - joy.cx, dy = y - joy.cy; const d = Math.hypot(dx, dy), R0 = 46;
        if (d > R0) { dx *= R0 / d; dy *= R0 / d; }
        ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        joy.x = d < 8 ? 0 : dx / R0; joy.y = d < 8 ? 0 : dy / R0;
        if (d >= 8) S.moveTo = null;
        return;
      }
      const p = look.get(e.pointerId); if (!p) return;
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y; p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.moved > 6) { S.yaw -= dx * 0.0085; S.manualT = 3; }
    };
    const onUp = e => {
      e.stopPropagation();
      pts.delete(e.pointerId);
      if (S.golf && S.golf.drag && e.pointerId === S.golf.drag.id) { const dr = S.golf.drag; S.golf.drag = null; if (e.type === 'pointerup' && dr.aimed) golfShoot(); return; }
      if (S.look && pts.size < 2) S.look.pinch = null;
      if (e.pointerId === joy.id) {
        joy.id = null; joy.x = joy.y = 0; show(ui.joy, false); ui.ghost.style.display = '';
        if (e.type === 'pointerup' && joy.moved < 10 && performance.now() - joy.t0 < 320) onTap(joy.x0, joy.y0);
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
    const inCarMode = () => S.mode === 'drive' || !!(drv && (drv.mode === 'enter' || drv.mode === 'exit' || drv.mode === 'stopping'));
    let tAnim = 0;
    function animHero(dt) {
      if (!hero) return;
      tAnim += dt;
      // в машине, садится или выходит: корнем героини владеет контроллер машины (drive.js), поза — drv.animState()
      const R = hero.rig, car_ = inCarNow || !!(drv && (drv.mode === 'enter' || drv.mode === 'exit' || drv.mode === 'stopping'));
      if (!car_) { hero.root.position.set(S.px, S.py + (S.iaDy || 0), S.pz); hero.root.rotation.set(0, S.ang, 0); hero.root.visible = true; }
      if (blob) { blob.position.set(S.px, S.py + 0.03, S.pz); blob.visible = !car_ && S.mode !== 'drive' && S.mode !== 'zip'; }
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
        const st2 = IA ? IA.animState(st) : st; S.animSt = st2;
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
    function ensureCar() {
      if (car) return car;
      const V = V_();
      try {
        if (wantSedan() && window.VEHICLES && VEHICLES.sedan) car = V.drive.makeCar(T, { kit: refs.kit, factory: () => VEHICLES.sedan.makeCar(refs.kit || T, { kit: refs.kit, quality: regionQ, lite: regionQ !== 'high' }) });
        else car = V.drive.makeCar(T, { kit: refs.kit, color: '#A8D8C4' });
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
        drv = V.drive.create({ THREE: T, car: c, ground: h.ground, colliders: h.colliders, road: h.road, start: h.carSpawn, blob: true, dynamic: h.dynamic, collide: h.collide, season, cfg: c.driveCfg });
        chase = V.drive.chase({ THREE: T, camera: cam, ground: h.ground });
        if (from === 'kubachi') placeCarTop(); else if (from === 'hotel') placeCarHotel(); else placeCarStart();
        if (hero) { if (drv.heroIn) drv.heroIn(hero, { instant: true }); else heroToCar(); }
        petsToCar();
        inCarNow = true; S.mode = 'drive'; S.sitting = null;
        S.px = drv.S.x; S.py = drv.S.y; S.pz = drv.S.z;
      } else if (h.carSpawn) { scene.add(cr); parkCar(h.carSpawn.x, h.carSpawn.z, h.carSpawn.ry); }
      S.carLamps = null;
      return c;
    }
    // «Выйти» где угодно (машина сама дотормаживает), «Сесть за руль» у стоящей машины
    async function getOut() {
      if (S.mode !== 'drive' || !drv || !drv.heroOut || !drv.canExit() || S.busy) return false;
      S.busy = true; let r = null;
      try { r = await drv.heroOut(hero, scene, {}); } catch (e) { console.warn('region heroOut', e); }
      S.busy = false;
      if (!r || !S.active) return false;
      inCarNow = false; S.mode = 'walk'; S.px = r.x; S.pz = r.z; S.py = S.h.ground(r.x, r.z); S.ang = r.ry; S.yaw = drv.S.ry; S.camInit = false; S.vx = S.vz = 0;
      if (hero.rig) hero.rig.prev = null;
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
      ui.root.classList.toggle('drive', true); emit('region:car', { mode: 'in' });
      return true;
    }

    /* ---------- кот и собачка: едут сзади; в селе и отеле ходят за ней, ждут у машины / лавки / башни ---------- */
    function findPets() {
      const out = [], P = refs.pets || {};
      const add = (kind, root, extra) => { if (!root || !root.isObject3D || out.some(p => p.root === root) || (hero && root === hero.root)) return; out.push(Object.assign({ kind, root, x: 0, y: 0, z: 0, ry: 0, spd: 0, phase: 0, state: 'car', stuckT: 0, wx: 0, wz: 0 }, extra || {})); };
      const onBody = r => !!(car && car.body && r && r.parent === car.body);
      // явно переданные (refs.pets): едут с ней, если сидят в машине или гуляют рядом (видны); собачка — только если гуляет с ней
      if (P.cat) { const r = P.cat.root || P.cat; if (onBody(r) || r.visible) add('cat', r, { cat: P.cat.body && P.cat.tail ? P.cat : null }); }
      if (P.dog) { const n = P.dog.n || null, r = P.dog.root || (n && n.root) || P.dog, on = typeof P.dog.active === 'function' ? P.dog.active() : true; if (on && (onBody(r) || r.visible !== false)) add('dog', r, { I: (n && n.I) || P.dog.I || null }); }
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
      const h = S.h, hold = !!(S.inShop || S.climb || S.level === 'top' || S.mode === 'zip' || S.mode === 'climb');
      pets.forEach((p, i) => {
        if (p.state === 'car') return;
        let tx, tz;
        if (p.state === 'wait') {
          tx = p.wx; tz = p.wz;
          if (!hold && Math.hypot(S.px - p.x, S.pz - p.z) < 6) { p.state = 'follow'; if (p.I) { p.I.hop(); p.I.st.happy = 1; setTimeout(() => { if (p.I) p.I.st.happy = 0; }, 1200); } }
        } else if (hold) { p.state = 'wait'; p.wx = p.x; p.wz = p.z; tx = p.x; tz = p.z; }
        else {
          const side = i ? -1 : 1, back = 1.15 + i * 0.35;
          tx = S.px - Math.sin(S.ang) * back + Math.cos(S.ang) * 0.62 * side; tz = S.pz - Math.cos(S.ang) * back - Math.sin(S.ang) * 0.62 * side;
        }
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (p.state === 'follow' && (d > 14 || p.stuckT > 2.2)) {   // отстали (лестница, терраса) — догоняют «за кадром»
          const g = h.ground(tx, tz); if ((!h.walkable || h.walkable(tx, tz)) && Math.abs(g - S.py) < 0.6) { p.x = tx; p.z = tz; p.y = g; } else { p.x = S.px - Math.sin(S.ang) * 0.6; p.z = S.pz - Math.cos(S.ang) * 0.6; p.y = S.py; }
          p.stuckT = 0;
        }
        const vmax = p.kind === 'cat' ? 4.6 : 5.2, spd = d > 0.35 ? Math.min(vmax, d * 2.6) : 0;
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
      if (mode === 'auto') afterCurtain(600, () => { if (S.rid === 'kubachi' && kazWear({ delay: 500 })) later(3400, () => toast('Снять ' + kazWord() + ' можно кнопкой слева.', 2600)); });
      else later(1300, async () => {
        if (S.rid !== 'kubachi' || S.busy || blocked()) return;
        const m = npcBy('mouse'), text = kazLine('offer');
        if (m) { m.faceHero = 4; m.hop && m.hop(); }
        voiceBubble('mouse', text);
        const r = await sheetFn({ title: (m && m.name) || (named ? 'Каз' : 'Праздничный платок'), body: paras([text]), actions: [{ label: 'Примерить', value: 1 }, { label: 'Потом', value: 0, cls: 'soft' }] });
        if (r && S.rid === 'kubachi') kazWear({});
      });
    }
    function updKazBtn() { if (!ui) return; const on = S.rid === 'kubachi' && kazOk() && S.mode === 'walk' && !S.dance && !S.zip; show(ui.kaz, on); if (on) ui.kaz.textContent = '🧣 ' + (kazWorn() ? 'Снять ' : 'Надеть ') + kazWord(); }
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
      S.epoch++;
      S.climb = null; S.look = null; S.inShop = null; S.sitting = null; S.view = null; S.treat = null; S.shopBuy = null; S.springT = false; S.iaDy = 0;
      if (S.mode === 'climb' || S.mode === 'zip') S.mode = 'walk';
      radarDrop();
      petsToCar();
      if (S.h && dn) { try { dn.detach(S.h.root || S.h); } catch (e) { /* ok */ } }
      if (hero && scene && hero.root.parent && hero.root.parent !== scene) { if (hero.root.parent.remove) hero.root.parent.remove(hero.root); }
      inCarNow = false;
      if (drv && drv.dispose) { try { drv.dispose(); } catch (e) { /* ok */ } } drv = null; chase = null;
      if (car && (car.root || car).parent === scene) scene.remove(car.root || car);
      if (hero && hero.root.parent === scene) scene.remove(hero.root);
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
      if (hero && hero.root.parent !== scene) scene.add(hero.root);
      if (id !== 'serpentine') {
        S.mode = 'walk';
        const sp = (from === 'zipline' && h.places && h.places.zipLanding) || h.spawn;
        heroToGround(sp.x, sp.z, sp.ry || 0); S.yaw = sp.ry || 0;
      }
      setupCar(h, id, from);
      if (id !== 'serpentine') petsOut(h, from);
      if (blob && blob.parent !== scene) scene.add(blob);
      if (blob) blob.visible = S.mode === 'walk';
      if (shadowProxy) shadowProxy.attach(scene);
      // W4A: свадьба — героиня модулю (розыгрыш с беретом), облачка пальтара
      if (h.wedding) { try { if (hero && h.wedding.setHero) h.wedding.setHero(hero, hero.rig ? hero.rig.anim : null); if (h.wedding.onPrank) h.wedding.onPrank(onPrank); } catch (e) { console.warn('region wedding hero', e); } }
      // день и ночь (R2): свет, жители, небо, окна и фонари региона
      if (dn) { try { dn.apply(id === 'serpentine' ? 'road' : 'village'); dn.attachRegion(h); dn.attach(scene); } catch (e) { console.warn('region daynight', e); } }
      ui.root.classList.toggle('drive', S.mode === 'drive');
      S.buildMs = Math.round(performance.now() - t0);
      setHud();
      emit('region:enter', { id, from, buildMs: S.buildMs });
      resize();
      radarMount();
      if (id === 'kubachi') kazArrive();
      updKazBtn();
      if (kazBack) afterCurtain(500, () => toast(kazLine('giveBack'), 3400));
      return true;
    }
    function titleOf() { const h = S.h; if (h && h.title) return h.title; const k = REG('kubachi'); return k && k.title ? k.title(named) : ''; }
    function setHud() {
      const o = { label: (S.rid === 'serpentine' ? (S.dir === 'down' ? 'Дорога вниз' : 'Дорога наверх') : titleOf()), onExit: () => goHome(), exitText: '← в город' };
      try { if (refs.setHud) refs.setHud(o); else if (G_() && G_().setHud) G_().setHud(o); } catch (e) { /* ignore */ }
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
        if (P.park) put('park', 'park', P.park.x, P.park.z, 'Парковка');
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
      if (S.mode === 'drive') { await getOut(); if (S.mode !== 'walk') return false; }
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
      // интерфейс города прячем (его кнопки и карточки), свой — поверх холста
      hidden = [];
      Array.from(host.children).forEach(el => { if (el === canvas || el.tagName === 'CANVAS') return; hidden.push([el, el.style.display]); el.style.display = 'none'; });
      host.appendChild(ui.touch); host.appendChild(ui.root); host.appendChild(ui.fade);
      bindPedal(ui.gas, 'gas'); bindPedal(ui.brk, 'brk');
      ui.act.addEventListener('click', e => { e.stopPropagation(); act(); });
      ui.act2.addEventListener('click', e => { e.stopPropagation(); act2(); });
      ui.kaz.addEventListener('click', e => { e.stopPropagation(); kazBtn(); });
      ui.tap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); danceTap(); });
      ui.skip.addEventListener('click', e => { e.stopPropagation(); if (S.zip && S.zip.skip) S.zip.skip(); });
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
      // день и ночь (R1): экземпляр на сцену региона; кнопка «Вернуться в утро» — слева под шапкой
      if (window.DayNight) {
        try {
          dn = DayNight.create({ THREE: T, scene, renderer, camera: cam, preset: 'village', quality: regionQ });
          dnOff = dn.onChange(e => { if (e.lamps && (e.phase === 'evening' || e.phase === 'night') && !WORLD._dnHinted) { WORLD._dnHinted = true; toast(DayNight.LINES.nightHint, 4200); } });
          if (DayNight.mountToggle) dnToggle = DayNight.mountToggle(ui.root, { className: 'wr-dn', onSet: (to, line) => toast(line, 2400) });
        } catch (e) { console.warn('region daynight', e); dn = null; }
      }
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
      hidden.forEach(([el, d]) => { el.style.display = d; }); hidden = [];
      const f = ui.fade, uiOld = ui;
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
    const npcHead = n => () => ({ x: n.root.position.x, y: n.root.position.y + (n.headY || 1.1) * (n.root.scale.y || 1) + 0.5, z: n.root.position.z });
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
      if (!sp || S.busy || (IA && IA.busy())) return;
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
      const n = S.h.npcs.filter(q => q.ext && (q.id === ev.who || q.speaker === 'paltar')).sort((a, b) => Math.hypot(a.root.position.x - S.px, a.root.position.z - S.pz) - Math.hypot(b.root.position.x - S.px, b.root.position.z - S.pz))[0];
      if (ev.text && n) { bubble(npcHead(n), ev.text, n.name, 2600); voiceBubble(n.speaker || 'paltar', ev.text); }
      if (ev.type === 'beret' && ev.phase === 'take') { S.cheerT = 0.8; later(700, () => heroSay2(SAY.beret, 1600)); }
      if (ev.phase === 'end') later(300, () => heroSay2(ev.type === 'beret' ? SAY.beretBack : SAY.jingle, 1500));
      if (ev.phase === 'start' || ev.phase === 'take') sfx('chime', { f: 1568 });
      S.prankLog.push(ev.type + ':' + ev.phase);
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

    /* ---------- W4A: зиплайн — со старта на башне отеля через долину к селу ---------- */
    async function startZip(d) {
      const h = S.h, V = V_();
      if (!V.zipline || !V.zipline.ride || !hero || S.zip) { if (!S.zip) toast(d.text || 'Зиплайн'); return null; }
      { const lk = zipLock(); if (!lk.ok) { toast(lk.text, 2600); return null; } }
      S.busy = true;
      if (IA) { iaStop(); try { if (IA.drop) iaDrop(); } catch (e) { /* ok */ } if (IA.canPocket && IA.canPocket() && !(IA.pocketed && IA.pocketed())) { try { await IA.play('pocket'); } catch (e) { /* ok */ } } }
      const n = d.npc && npcBy(d.npc); if (n && d.line) { bubble(npcHead(n), d.line.text, n.name, 2600); voiceBubble(d.line.who, d.line.text); n.faceHero = 3; }
      S.sitting = null; S.view = null; S.look = null;
      if (h.idleTrolley) h.idleTrolley.visible = false;
      show(ui.skip, true); ui.root.classList.add('zip'); updKazBtn();
      S.zipEv = []; S.mode = 'zip';
      const dur = +(DEBUG && QS.get('zipdur')) || 27;
      emit('region:zip', { phase: 'start' });
      const ride = S.zip = V.zipline.ride({ THREE: T, scene, camera: cam, hero, anim: hero.rig && hero.rig.anim, ia: IA, route: d.route || h.zipline, external: true, ground: h.ground, duration: dur,
        onEvent: (e, data) => { S.zipEv.push(e); if (data && data.line && e !== 'done') heroSay2(data.line, 1800); } });
      S.busy = false;
      let r = null;
      try { r = await ride; } catch (e) { console.warn('region zip', e); }
      if (ui) { show(ui.skip, false); ui.root.classList.remove('zip'); }
      S.zipResult = r; S.trip.zip = true;
      emit('region:zip', { phase: 'end', skipped: !!(r && r.skipped) });
      if (!S.active || S.rid !== 'hotel' || S.zip !== ride) return r;   // ушли посреди поездки
      const K = REG('kubachi'), vt = K && K.title ? K.title(named) : '';   // название — из модуля села (named / нейтральное)
      await fade(vt ? 'Финиш! Добро пожаловать в ' + vt + '…' : 'Финиш!', () => { S.zip = null; S.mode = 'walk'; load('kubachi', 'zipline'); });
      S.trip.village = true;
      if (IA && IA.pocketed && IA.pocketed()) later(700, () => { try { IA.play('unpocket'); } catch (e) { /* ok */ } });
      return r;
    }

    /* ---------- W4A: мини-гольф отеля — потянуть назад и отпустить, 3 удара; руки на клюшке (golf.heroPose) ---------- */
    function golfLabel() { const g = S.golf; if (!g || !ui) return; ui.golfN.textContent = 'удары: ' + (g.G.maxTries - g.G.tries) + ' из ' + g.G.maxTries; }
    function golfStance() { const g = S.golf, st = g.G.stance(g.angle); S.px = st.x; S.pz = st.z; S.py = S.h.ground(st.x, st.z); S.ang = st.ry; if (hero && hero.rig) hero.rig.prev = null; }
    function startGolf(d) {
      const G = d.golf || S.h.golf; if (!G) { toast(d.text); return; }
      iaStop(); if (IA && IA.drop) iaDrop();
      const st = G.start(); S.golf = { G, angle: G.aimAngle(), power: 0.45, drag: null }; G.aim(S.golf.angle, S.golf.power);
      golfStance(); setView(st.view || d.view || 'golf', true); S.sitting = null;
      show(ui.golf, true); ui.golfT.textContent = 'Потяни назад и отпусти'; golfLabel();
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
      if (r && r.done && ui) ui.golfT.textContent = r.holed ? 'В лунке! «Встать» — закончить' : 'Удары кончились. «Встать» — закончить';
      else if (S.golf) { g.angle = g.G.aimAngle(); golfStance(); }
      S.golfLast = r; return r;
    }
    function stopGolf(quietly) { if (!S.golf) return; try { S.golf.G.stop(); } catch (e) { /* ok */ } S.golf = null; if (ui) show(ui.golf, false); if (!quietly) { setView(null); S.camInit = false; } }

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
        h.exits.forEach(ex => { const d = Math.hypot(cx - ex.x, cz - ex.z); if (d < (ex.r || 6) + 6 && (!best || d < best.d)) best = { kind: 'exit', ref: ex, d, label: '☁ ' + ex.label }; });
        if (slow) {
          h.spots.forEach(sp => { const d = Math.hypot(cx - sp.x, cz - sp.z); if (d < 9 && (!best || d < best.d + 3)) best = { kind: 'spot', ref: sp, d, label: (sp.icon ? sp.icon + ' ' : '') + 'Посидеть: ' + String(sp.label || '').toLowerCase() }; });
          const tur = h.npcs.find(n => !n.silent && n.lines && n.lines.length && Math.hypot(cx - n.root.position.x, cz - n.root.position.z) < (n.talkR || 2.8) + 11);
          if (tur) { if (best && best.kind === 'spot') S.near2 = { kind: 'npc', ref: tur, label: 'Поговорить: ' + tur.name }; else if (!best) best = { kind: 'npc', ref: tur, d: 0, label: 'Поговорить: ' + tur.name }; }
        }
        if (drv.heroOut && drv.canExit && drv.canExit() && !S.near2) { const g = { kind: 'carOut', d: 0, label: '🚪 Выйти' }; if (best) S.near2 = g; else best = g; }
      }
      return best;
    }
    function act() {
      if (!S.active || S.busy || blocked() || S.zip) return;
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
      if (!S.active || S.busy || S.zip) return;
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
    function updAct() {
      if (!ui) return;
      const a = ui.act, a2 = ui.act2;
      ui.root.classList.toggle('sit', !!(S.sitting || S.view || S.look || S.inShop || S.golf));
      if (S.busy || blocked() || !S.active || S.zip || S.shopBuy || S.springT || S.treat || (IA && IA.busy())) { show(a, false); show(a2, false); return; }
      const lbl = (el, t, soft) => { show(el, true); el.textContent = t; el.classList.toggle('soft', !!soft); };
      if (S.dance) { show(a, false); lbl(a2, 'Хватит танцевать', true); return; }
      if (S.golf) { lbl(a, 'Встать', true); show(a2, false); return; }
      if (S.climb) { lbl(a, S.climb.auto > 0 ? '⏸ Стоп' : '▲ Вверх', true); lbl(a2, S.climb.auto < 0 ? '⏸ Стоп' : '▼ Вниз', true); return; }
      if (S.look) { lbl(a, 'Хватит смотреть', true); show(a2, false); return; }
      if (S.inShop) { lbl(a, '🛍️ Купить', false); lbl(a2, 'Выйти из лавки', true); return; }
      if (S.sitting || S.view) { lbl(a, 'Встать', true); show(a2, false); return; }
      a.classList.remove('soft');
      S.near = nearest();
      if (S.near) lbl(a, S.near.label, false); else show(a, false);
      if (S.near2) lbl(a2, S.near2.label, true); else show(a2, false);
    }

    /* ---------- шаги ---------- */
    const HR = 0.3;
    function stepWalk(dt) {
      const h = S.h;
      // палец на джойстике прерывает действие рук (один раз: cancel доигрывает 0,35 с «вернуть руки»)
      if (IA && IA.busy()) { if (moveInput() && !S.inShop && !S.springT && !S.iaCancel) { S.iaCancel = true; iaStop(); } S.vx = S.vz = 0; S.walking = false; return; }
      S.iaCancel = false;
      if (S.dance) { const sl = S.dance.slot; S.px = sl.x; S.pz = sl.z; S.ang = sl.ry; S.vx = S.vz = 0; S.walking = false; if (moveInput() && !S.danceAuto) endDance(S.dance.W.dance.stop()); return; }
      if (S.busy || S.sitting || S.view || S.look || S.inShop || S.golf || blocked()) { S.vx = S.vz = 0; S.walking = false; return; }
      const inDir = moveInput(); let dir = inDir, speed = 0;
      if (dir) { speed = 1.2 + 2.2 * dir[2]; S.moveTo = null; }
      else if (S.moveTo) {
        const m = S.moveTo; let tx = m.x, tz = m.z;
        while (m.wp && m.wp.length) { const q = m.wp[0]; if (Math.hypot(q[0] - S.px, q[1] - S.pz) < 0.45) m.wp.shift(); else { tx = q[0]; tz = q[1]; break; } }
        const fd = Math.hypot(m.x - S.px, m.z - S.pz), dx = tx - S.px, dz = tz - S.pz, d = Math.hypot(dx, dz) || 1e-6;
        if (fd < (m.stop || 0.25) && !(m.wp && m.wp.length)) { arrive(); }
        else { dir = [dx / d, dz / d, 1]; speed = fd > 6 ? 3.2 : Math.min(2.4, 1.1 + fd * 0.6); }
      }
      const tvx = dir ? dir[0] * speed : 0, tvz = dir ? dir[1] * speed : 0, k = Math.min(1, dt * 10);
      S.vx += (tvx - S.vx) * k; S.vz += (tvz - S.vz) * k;
      // W4A: шаг больше 12 см (медленный кадр, 10 кадров/с) — по частям, чтобы не «протиснуться» сквозь угол дома
      let nx = S.px, nz = S.pz; const mvx = S.vx * dt, mvz = S.vz * dt, nSub = Math.max(1, Math.min(6, Math.ceil(Math.hypot(mvx, mvz) / 0.12)));
      for (let q = 0; q < nSub; q++) { nx += mvx / nSub; nz += mvz / nSub; if (h.collide) [nx, nz] = h.collide(nx, nz, HR, S.py); }
      // жители и машина на парковке — мягкие круги (сквозь них не пройти)
      h.npcs.forEach(n => { if (!n.root.visible) return; const p = n.root.position; if (Math.abs(p.y - S.py) > 1.5) return; const dx = nx - p.x, dz = nz - p.z, dd = Math.hypot(dx, dz), m = 0.42 + HR; if (dd < m && dd > 1e-4) { nx = p.x + dx / dd * m; nz = p.z + dz / dd * m; } });
      if (!drv && car && car.S && (car.root || car).parent === scene) { const c = car.S, fx = Math.sin(c.ry), fz = Math.cos(c.ry), half = (car.driveCfg && car.driveCfg.halfL) || 1.8; [-half * 0.6, 0, half * 0.6].forEach(q => { const cx = c.x + fx * q, cz = c.z + fz * q, dx = nx - cx, dz = nz - cz, dd = Math.hypot(dx, dz), m = 0.85 + HR; if (dd < m && dd > 1e-4) { nx = cx + dx / dd * m; nz = cz + dz / dd * m; } }); }
      const ny = h.ground(nx, nz), moved0 = Math.hypot(nx - S.px, nz - S.pz);
      if (Math.abs(ny - S.py) < 0.7 || S.level === 'top') { S.px = nx; S.pz = nz; S.py += (ny - S.py) * Math.min(1, dt * 16); if (Math.abs(ny - S.py) > 0.3) S.py = ny; }
      if (S.moveTo && !inDir) { S.blockT = moved0 < speed * dt * 0.3 ? (S.blockT || 0) + dt : 0; if (S.blockT > 0.8) { S.blockT = 0; const m = S.moveTo; if (Math.hypot(m.x - S.px, m.z - S.pz) < 1.6) arrive(); else S.moveTo = null; } }
      const sp = Math.hypot(S.vx, S.vz); S.walking = sp > 0.25;
      if (sp > 0.25) { S.ang += angDiff(Math.atan2(S.vx, S.vz), S.ang) * Math.min(1, dt * 11); S.moveT += dt; } else S.moveT = 0;
      // жители здороваются сами, когда подходишь (не чаще раза в 25 с)
      const now = performance.now();
      h.npcs.forEach(n => { if (!n.root.visible || n.silent || !n.lines || !n.lines.length) return; const p = n.root.position, d = Math.hypot(p.x - S.px, p.z - S.pz); if (d < 2.6 && Math.abs(p.y - S.py) < 2.5 && now - (S.lastGreet[n.id] || -1e9) > 25000) greet(n); });
    }
    function arrive() {
      const m = S.moveTo; S.moveTo = null; if (!m || !m.thing) return;
      const t = m.thing;
      if (t.kind === 'npc') talk(t.ref); else if (t.kind === 'spot') useSpot(t.ref); else if (t.kind === 'exit') useExit(t.ref);
    }
    let momentLook = null, momentW = 0;
    function moments(dt) {
      momentLook = null; momentW = 0; const h = S.h; if (!h || !drv) return;
      (h.moments || []).forEach(m => { if (!m.done && drv.S.s > m.s0 && drv.S.s < m.s1 && drv.S.v > 0.5 && S.dir === 'up') { m.done = true; m.t = 0; } if (m.t != null && m.t < m.dur) { m.t += dt; momentLook = m.look; momentW = Math.min(1, m.t / 1.2, (m.dur - m.t) / 1.2); } });
    }
    // без помощников: газ, тормоз и руль — только от игрока (drive.touchInput); автопилот — только для отладки и тестов
    function driveInput() {
      if (S.busy || S.sitting || S.view || blocked()) return { brake: true };
      if (S.auto) return { auto: true, thr: S.auto, road: S.autoRoad || undefined };
      if (keys.u || keys.d || keys.l || keys.r) return { thr: (keys.u ? 1 : 0) - (keys.d ? 1 : 0), str: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), brake: ped.brk };
      const V = V_();
      if (V && V.drive && V.drive.touchInput) return V.drive.touchInput({ jx: canInput() ? joy.x : 0, jy: canInput() ? joy.y : 0, gas: ped.gas, brake: ped.brk, v: drv.S.v });
      if (ped.gas || ped.brk) return { thr: ped.gas ? 1 : (drv.S.v > 0.6 ? 0 : -1), brake: ped.brk && drv.S.v > 0.6 };
      return {};
    }
    function stepDrive(dt, inp) {
      if (!drv) return;
      drv.update(dt, inp || driveInput());
      if (drv.brakeLabel && ui) { const lb = drv.brakeLabel(); if (lb !== S.brkLabel) { S.brkLabel = lb; ui.brk.textContent = lb; } }
      S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y;
      if (!S.trip.down && S.dir === 'down') S.trip.down = drv.S.s < (S.h.road.len * 0.5);
      moments(dt);
      checkExits();
    }

    /* ---------- камера ---------- */
    const camPos = new T.Vector3(), lookP = new T.Vector3(), want = new T.Vector3(), camUp = new T.Vector3(), tp = new T.Vector3(), tl = new T.Vector3(), lk = new T.Vector3(), alt = new T.Vector3();
    // точка камеры за спиной по направлению yaw (с подъёмом над рельефом между головой и камерой)
    function camAt(out, yaw, dist, hgt, top) {
      const h = S.h;
      out.set(S.px - Math.sin(yaw) * dist, S.py + hgt, S.pz - Math.cos(yaw) * dist);
      const gy = h.ground(out.x, out.z); if (out.y < gy + 1.2) out.y = gy + 1.2;
      if (!top) { let up = 0; for (const t of [0.5, 0.75]) { camUp.lerpVectors(lookP, out, t); const g = h.ground(camUp.x, camUp.z) + 0.35; if (camUp.y + up * t < g) up = (g - camUp.y) / t; } out.y += Math.min(3.5, up); }
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
      if ((S.mode === 'drive' || inCarMode()) && chase && drv) {
        let bias = 0; try { bias = h.cameraBias ? h.cameraBias(drv.S.x, drv.S.y, drv.S.z, drv.S.ry, drv.S.s) : 0; } catch (e) { bias = 0; }
        if (S.dir === 'down') bias = 0;
        chase.update(dt, drv, { yawBias: bias, look: momentLook, lookW: momentW });
        return;
      }
      if (keys.q) { S.yaw += dt * 1.8; S.manualT = 2.5; } if (keys.e) { S.yaw -= dt * 1.8; S.manualT = 2.5; }
      S.manualT = Math.max(0, S.manualT - dt);
      if (S.manualT <= 0 && S.walking && S.moveT > 0.6) { const e = angDiff(S.ang, S.yaw); if (Math.abs(e) < 2.3) S.yaw += clamp(e, -1.2 * dt, 1.2 * dt); }
      const top = S.level === 'top', dist = top ? 6.0 : 7.2, hgt = top ? 3.2 : 4.4;
      lookP.set(S.px, S.py + 1.35, S.pz);
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
      if (h.rayHit && !top) { const t2 = h.rayHit(lookP, camPos); if (t2 < 1) camPos.lerpVectors(lookP, camPos, Math.max(0.03, t2 - 0.07)); }
      cam.position.copy(camPos);
      // взгляд: если камера всё же над головой, смотреть чуть ниже груди — кадр не «сверху на макушку»
      const hz = Math.hypot(camPos.x - lookP.x, camPos.z - lookP.z), dyc = camPos.y - lookP.y;
      if (hz < 1.2 && dyc > 1.5) { lk.copy(lookP); lk.x += (lookP.x - camPos.x) * 0.8; lk.z += (lookP.z - camPos.z) * 0.8; cam.lookAt(lk); } else cam.lookAt(lookP);
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
        if (S.zip && S.mode === 'zip') {   // зиплайн: поездка сама ведёт героиню, руки и камеру
          S.zip.update(dt);
          if (hero) { hero.root.getWorldPosition(tmpV); S.px = tmpV.x; S.py = tmpV.y; S.pz = tmpV.z; }
          if (kazWorn()) { try { V_().kaz.update(dt, { sitting: true }); } catch (e) { /* ok */ } }
          if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
          if (blob) blob.visible = false;
          S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam);
          nightStep(dt);
          draw();
          if (S.frames % 6 === 0) updAct();
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
        petsUpdate(dt);
        if (shadowProxy) { hero.root.updateMatrixWorld(true); shadowProxy.update(); }
        updCamera(dt);
        S.h.update(dt, { x: S.px, y: S.py, z: S.pz }, cam);
        pollEvents();
        nightStep(dt);
        draw();
        if (S.frames % 6 === 0) { updAct(); if (S.mode === 'drive' && drv && ui) ui.speed.textContent = Math.round(Math.abs(drv.S.v) * 3.6) + ' км/ч'; }
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
        if (S.mode === 'drive') hint('Газ и тормоз — справа · палец слева — руль', 6000);
        return;
      }
      const prev = S.rid;
      await fade(enterLabel(id, prev), () => load(id, from || prev), 'облака расступаются');
      if (id === 'kubachi') { S.trip.village = true; later(1400, () => heroSay(HERO.arrive, 2600)); hint('Палец слева — идти · справа — крутить камеру · тап — туда', 6000); }
      if (id === 'hotel') { S.trip.hotel = true; hint('Двор, бассейн, мини-гольф, костёр — а с башни зиплайн через долину', 6000); }
      if (id === 'serpentine' && S.dir === 'down') hint('Газ и тормоз — справа · палец слева — руль', 5000);
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
        pos: () => ({ x: S.px, y: S.py, z: S.pz, ry: S.ang, mode: S.mode, level: S.level, rid: S.rid, sitting: !!S.sitting, view: S.view && S.view.id, viewT: S.view ? +S.view.t.toFixed(2) : null, busy: S.busy, active: S.active, inCar: inCarNow, look: S.look && S.look.id, climb: S.climb ? +S.climb.s.toFixed(2) : null, shop: S.inShop ? S.inShop.id : null, dance: !!S.dance, golf: !!S.golf, zip: !!S.zip }),
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
        buttons: () => (ui ? { act: ui.act.classList.contains('hidden') ? null : ui.act.textContent, act2: ui.act2.classList.contains('hidden') ? null : ui.act2.textContent, kaz: ui.kaz.classList.contains('hidden') ? null : ui.kaz.textContent, tap: !ui.tap.classList.contains('hidden'), skip: !ui.skip.classList.contains('hidden'), dn: (ui.root.querySelector('.dn-toggle') || {}).textContent || null } : null),
        go: id => { if (!id) { setView(null); return true; } setView(id, false); return !!S.view; },
        stand: () => standUp(),
        drive: () => (drv ? Object.assign(drv.info(), { door: drv.doorPoint ? (q => ({ x: +q.x.toFixed(2), z: +q.z.toFixed(2) }))(drv.doorPoint(1)) : null, dir: S.dir, len: +S.h.road.len.toFixed(1), trip: Object.assign({}, S.trip), busy: S.busy, near: S.near && S.near.label, near2: S.near2 && S.near2.label, view: S.view && S.view.id, fov: +cam.fov.toFixed(1), mode: drv.mode, canExit: drv.canExit(), heroInCar: !!(hero && car && isChildOf(hero.root, car.body)) }) : null),
        teleportS: (s, rev) => { if (!drv) return null; const q = S.h.road.sample(s); drv.teleport(rev ? { x: q.x, z: q.z, ry: q.th + PI } : s); S.dir = rev ? 'down' : 'up'; S.exitArmed = {}; if (chase) chase.snap(); S.px = drv.S.x; S.pz = drv.S.z; S.py = drv.S.y; setHud(); return drv.info(); },
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
        kaz: () => ({ mode: KAZ_MODE(), ok: kazOk(), worn: kazWorn(), btn: ui && !ui.kaz.classList.contains('hidden') ? ui.kaz.textContent : null, beretHidden: !!(V_() && V_().kaz && V_().kaz.beretHidden && V_().kaz.beretHidden()) }),
        kazOn: on => (on ? kazWear({ instant: true, say: false }) : kazRemove()),
        kazBtn: () => kazBtn(),
        car: () => ({ kind: car ? carKind() : null, own: ownCar, drv: drv ? drv.mode : null, cfg: drv ? { halfL: drv.cfg.halfL, halfW: drv.cfg.halfW } : null, lamps: S.carLamps }),
        pets: () => pets.map(p => ({ kind: p.kind, state: p.state, x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +Math.hypot(p.x - S.px, p.z - S.pz).toFixed(2), anim: !!p.I || !!p.cat, inScene: !!scene && p.root.parent === scene, onCar: !!(car && p.root.parent === car.body) })),
        wed: () => { const W = S.h && S.h.wedding; return W ? { dance: !!S.dance, danceActive: W.dance.active, last: S.lastDance || null, treats: S.treats, treat: S.treat || null, prank: W.prankState, prankLog: S.prankLog.slice(), lod: W.lod } : null; },
        wedSpot: id => goSpot(id),
        danceTap: () => danceTap(),
        danceAuto: on => { S.danceAuto = !!on; return S.danceAuto; },
        prank: () => { const W = S.h && S.h.wedding; return W ? W.prank() : null; },
        zip: () => { const sp = spotBy('zipline_start'); if (!sp) return false; S.level = 'top'; S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); useSpot(sp); return true; },
        zipState: () => (S.zip && S.zip.state ? S.zip.state() : null), zipEvents: () => S.zipEv.slice(), zipResult: () => S.zipResult || null,
        skip: () => { if (S.zip && S.zip.skip) { S.zip.skip(); return true; } return false; },
        golfStart: () => { const sp = spotBy('golf_putt'); if (!sp) return false; S.px = sp.x; S.pz = sp.z; S.py = S.h.ground(sp.x, sp.z); useSpot(sp); return !!S.golf; },
        golfShoot: (a, p) => golfShoot(a, p), golfState: () => (S.golf ? S.golf.G.state() : null), golfStop: () => stopGolf(), golfAngle: () => (S.golf ? S.golf.G.aimAngle() : null), golfLast: () => S.golfLast,
        heroAt: (x, z, ry, level) => { iaStop(); S.level = level || 'ground'; placeHero(x, z, ry, ry); S.view = null; S.sitting = null; return S.py; },
        cam: (pos, target, fov) => { if (!pos) { S.view = null; S.camInit = false; return true; } S.view = { id: 'probe', v: { pos, target, fov: fov || 50 }, t: 10, from: new T.Vector3(), fromLook: new T.Vector3(), smooth: false, fov: fov || 50 }; return true; },
        camPitch: () => { if (!cam) return null; const d = cam.getWorldDirection(tmpV); return +(Math.asin(clamp(d.y, -1, 1)) * 180 / PI).toFixed(1); },
        dn: () => (window.DayNight ? { hour: +DayNight.hour().toFixed(2), phase: DayNight.phase(), override: DayNight.override(), lamps: dn ? dn.lampsOn() : null, night: S.night, toggle: ui && ui.root.querySelector('.dn-toggle') && ui.root.querySelector('.dn-toggle').style.display !== 'none' ? ui.root.querySelector('.dn-toggle').textContent : null } : null),
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

  WORLD.Regions = { can, unlocked, settings, signLabel, create, hotelLock, zipLock, version: 2 };
})();
