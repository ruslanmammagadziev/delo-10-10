/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: мини-карта, большая карта и «Поехать сюда» (волна 3, MAPUI).
   Только DOM и 2D-холст: ни одного вызова отрисовки WebGL. Рисуется по WORLD.LAYOUT: дороги (drivable), река,
   газоны и дорожки парка, площадь с фонтаном, районы, точки pois; дома — по коллайдерам карты. Любого поля может
   не быть: тогда замена (см. analyze): граница — по коллайдерам и дверям, река — к югу от границы, районы и точки —
   по планировке волны 2 и реестру дверей.

   Мини-карта (круг 96 px справа сверху, под кнопками шапки) поворачивается вместе с камерой: «вверх на карте» —
   это «джойстик вверх» и «куда смотрит камера». На тротуаре Октябрьской камера и так смотрит на север, поэтому там
   карта совпадает с большой (север сверху); буква «С» на ободке всегда показывает север. Можно 'north' (опция rotate).
   Перерисовка 10 раз в секунду; между перерисовками холст доворачивается одним CSS-поворотом (без перерисовки).

   API
     WORLD.Minimap.create(opts) → mm. Всё в opts необязательно; чего нет — берётся у живого города
     (World.session(), World._w()), а без города — из WORLD.LAYOUT и WORLD.doorsStatic().
       layout        WORLD.LAYOUT
       colliders     { boxes: [{ x0, x1, z0, z1, h }], circles } — дома на карте (по умолчанию MAP.colliders города)
       doors         реестр дверей ({ list, get(id) }) или массив — точки у дверей и «появиться у двери»
       getHero()     → { x, z, ang } — ang: куда смотрит героиня, atan2(dx, dz)
       getCamYaw()   → yaw камеры (вперёд = (sin yaw, cos yaw)); null — север сверху
       getTarget()   → { x, z, label, door } | null — дверь текущего дела (луч 🔍)
       getMarkers()  → [{ x, z, style, label, door }] — прочие метки (замок «скоро» и т. п.)
       getVehicles() → [{ kind: 'car' | 'bike', x, z, ry, covered }]
       pois          массив или () => массив: { id, kind, x, z, label, line?, icon?, door?, locked?, lockText? };
                     onlyPois: true — только они (без точек из дверей, площади, парка и набережной)
                     kind: mission | place | shop | view | edge | garage | bikes | dogpark | square | park
       isBusy()      → true — идёт диалог или мини-игра: карта недоступна (круг бледнеет, тап не открывает)
       checkTravel(poi) → { ok, text, note } — ok:false — вместо «Поехать сюда» строка замка (text)
       onTravel(poi, spot) → Promise — перенести героиню; spot = { x, z, ang, yaw, door }
       edgeOpen()    → true — выезд из города открыт: значок дороги (подпись — layout.edge.label)
       districtOpen(id) → false — район серый, «скоро»
       root          куда поставить мини-карту (по умолчанию .w-ui города, иначе #app)
       layer         куда открыть большую карту (по умолчанию #layer, иначе #app)
       rotate        'camera' (по умолчанию) | 'north'
       onOpen(), onClose(), onArrive(poi)
     mm.update(dt) — каждый кадр (dt в секундах). mm.open() / close() / isOpen() — большая карта.
     mm.setVisible(b), mm.collapse(b), mm.travel(id) → Promise<bool>, mm.rebuild(), mm.dispose(), mm.stats(), mm.el
     WORLD.Minimap.travelDefault(poi, spot) — перенос по умолчанию (api.travelTo сессии, иначе placeAt): для своего onTravel.
     WORLD.Minimap.openSheet(opts) → sheet — большая карта без мини-карты (2D-город: рисунок + список мест);
       opts как выше + travelLabel ('Поехать сюда'), clouds (false), title. sheet.close().
   Классы: .w-mini.wmm (контракт .w-mini из css/style.css), .wmm-wrap (угол HUD v2; свернуть — строкой меню ☰), .modal.wm-sheet, .wm-cloud.
   Большая карта — .modal в #layer: пока она открыта, город сам стоит (его blocked() видит .modal).

   ВОЛНА 4B (MAP): «карта как в GTA»
     • Радар — круг 110 px СЛЕВА СНИЗУ, над джойстиком: left 12 px, bottom 160 px (+ safe-area). Призрак джойстика
       (ui.js: центр 86 px от левого края, низ 32 px, 112 px) кончается на 700 px из 844 — радар (574…684) его не задевает,
       а тап по радару джойстик не перехватывает (радар — <button>, у города isUI). Свернуть — «–» справа сверху круга.
       Карта крутится вместе с камерой; веер — куда смотрит камера; стрелка — героиня; дело и метка «📍» — капля, далеко —
       на ободке со стрелкой; машина (купе — мятная, седан — красная), велосипед, собачка; значки мест, лавок, видов,
       велопроката, гаража, собачьей площадки, выезда.
     • Радар в горах: WORLD.Minimap.region(o) → { update(dt), dispose(), open(), setWaypoint(), debug(), stats(), el } —
       серпантин / село / отель (контракт — js/world/regions.js «Радар»): земля, дороги и дома из ручки региона
       (handle.groundInfo — растр в простое, кусками; дома и деревья — коллайдеры; дорога — VILLAGE.regions.serpentine.path()),
       точки o.pois() (+ крыша-терраса, уступ, шпильки, падел и футбол — из ручки).
     • Большая карта с вкладками «Город» / «Кубачи» (при named:false — «Горы») / «Обзор»:
       «Кубачи» — село, отель и дорога (переключатель), точки списком; «Обзор» — нарисованная карта: город, дорога из города,
       серпантин, село, отель на холме, трос зиплайна, «ты здесь» и путь «как попасть в Кубачи» (закрытое — с датой замка).
       «Поехать сюда» к точке в горах — только когда поездка открыта (opts.tripOpen / edgeOpen, Missions.unlock('trip'|'hotel'|'zipline')):
       зовёт opts.onTravelRegion(regionId, poiId, poi) (город) или o.onTravel(regionId, poiId, poi) (регион) — их пишет интегратор.
       «📍 Отметить на радаре» — метка-путеводитель (работает без интегратора; в другом регионе стрелка ведёт к нужному выезду).
     • WORLD.Minimap.overview(o) — лист сразу на «Обзоре»; WORLD.Minimap.waypoint() / setWaypoint(w) / clearWaypoint().
     • Ноль вызовов WebGL: всё — 2D-холст и DOM. Перерисовка радара 10 раз в секунду, между ними — CSS-поворот.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => performance.now();
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const G_ = () => window.G || null;
  const haptic = k => { try { const g = G_(); if (g && g.haptic) g.haptic(k); } catch (e) { /* без вибрации */ } };
  const sfx = (k, o) => { try { const g = G_(); if (g && g.sfx) g.sfx(k, o); } catch (e) { /* без звука */ } };
  const safe = (f, ...a) => { try { return f(...a); } catch (e) { return null; } };
  const LS_KEY = 'delo1010_minimap';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const lsSet = p => { try { localStorage.setItem(LS_KEY, JSON.stringify(Object.assign(lsGet(), p))); } catch (e) { /* приватное окно */ } };
  const DPR = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /* ---------- живой город (если есть) ---------- */
  const live = () => { try { const W = window.World; return { w: W && W._w ? W._w() : null, s: W && W.session ? W.session() : null }; } catch (e) { return { w: null, s: null }; } };
  const liveS = () => { const s = live().s; return s && !s.finished ? s : null; };

  /* ---------- палитра карты ---------- */
  const COL = {
    paper: '#F2E6E3', ground: '#FBF4EF', road: [214, 205, 222], curb: [196, 184, 206], path: [239, 222, 199], lawn: [204, 225, 178],
    water: [190, 221, 241], waterLine: 'rgba(255,255,255,.75)', plaza: '#F6E3D6', plazaRing: 'rgba(214,170,150,.35)',
    block: ['#EBCBD0', '#DDD0EA', '#F0DCC6', '#D3E4D5', '#F2D5DC', '#DBD6EE', '#F3E1CB', '#D9E6F0'],
    tree: ['#E9A86A', '#E59B8F', '#EBC56A', '#A9C98E', '#E7A3B2', '#D99A64'],
    label: '#6F5470', hero: '#C2405B',
  };
  const KINDS = {
    mission: { col: '#C2405B', g: 'case', name: 'Дело', group: 'Дело' },
    place: { col: '#9A84C6', g: 'house', name: 'Места', group: 'Места прогулки' },
    shop: { col: '#55A887', g: 'bag', name: 'Лавки', group: 'Лавки' },
    view: { col: '#6C9FD0', g: 'eye', name: 'Виды', group: 'Прогулки и виды' },
    square: { col: '#E3A93E', g: 'sun', name: 'Площадь', group: 'Прогулки и виды' },
    park: { col: '#76AA62', g: 'tree', name: 'Парк', group: 'Прогулки и виды' },
    dogpark: { col: '#E58AA2', g: 'paw', name: 'Собачья площадка', group: 'Прогулки и виды' },
    bikes: { col: '#DE9A34', g: 'bike', name: 'Велики', group: 'Транспорт' },
    garage: { col: '#DD7E63', g: 'car', name: 'Гараж', group: 'Транспорт' },
    edge: { col: '#D06F4C', g: 'road', name: 'Выезд из города', group: 'Транспорт' },
    car: { col: '#7FB8A4', g: 'car', name: 'Машинка', group: 'Транспорт' },
    bike: { col: '#E0A63C', g: 'bike', name: 'Велосипед', group: 'Транспорт' },
    // волна 4B: горы (село, отель, дорога); group — раздел списка на вкладке «Кубачи»
    tower: { col: '#C98A4E', g: 'tower', name: 'Башня', group: 'В селе' },
    bakery: { col: '#D9A04A', g: 'bread', name: 'Пекарня', group: 'В селе' },
    spring: { col: '#5DA6D6', g: 'drop', name: 'Родник', group: 'В селе' },
    wedding: { col: '#D9718E', g: 'note', name: 'Свадьба', group: 'В селе' },
    kaz: { col: '#B58ACB', g: 'scarf', name: 'Примерка', group: 'В селе' },
    workshop: { col: '#9E9AB4', g: 'hammer', name: 'Мастерская', group: 'В селе' },
    museum: { col: '#A08FC2', g: 'columns', name: 'Комната образцов', group: 'В селе' },
    roof: { col: '#E48C6A', g: 'roof', name: 'Крыша-терраса', group: 'В селе' },
    zip: { col: '#5E9FB8', g: 'zip', name: 'Зиплайн', group: 'В селе' },
    parking: { col: '#8E8AA6', g: 'P', name: 'Парковка', group: 'Транспорт' },
    hotel: { col: '#6F9BC9', g: 'hotel', name: 'Отель', group: 'Отель на вершине' },
    pool: { col: '#4FA7D8', g: 'waves', name: 'Бассейн', group: 'Отель на вершине' },
    golf: { col: '#62A866', g: 'flag', name: 'Мини-гольф', group: 'Отель на вершине' },
    fire: { col: '#E4824E', g: 'flame', name: 'Костёр', group: 'Отель на вершине' },
    spa: { col: '#C88FB0', g: 'steam', name: 'Банный комплекс', group: 'Отель на вершине' },
    sport: { col: '#58A47C', g: 'ball', name: 'Спорт', group: 'Отель на вершине' },
    bench: { col: '#B48A62', g: 'bench', name: 'Лавочка', group: 'Дорога' },
    fork: { col: '#9C7BB8', g: 'fork', name: 'Развилка', group: 'Дорога' },
    gate: { col: '#C98A4E', g: 'gate', name: 'Ворота села', group: 'Дорога' },
    city: { col: '#C2405B', g: 'city', name: 'Город', group: 'Дорога' },
    hairpin: { col: '#B9A7C6', g: 'uturn', name: 'Шпилька', group: 'Дорога' },
    dog: { col: '#E58AA2', g: 'paw', name: 'Собачка', group: 'Транспорт' },
    waypoint: { col: '#E0457B', g: 'pin', name: 'Метка', group: 'Транспорт' },
  };
  // группы списка на вкладке «Кубачи» и порядок
  const MTN_GROUPS = ['В селе', 'Отель на вершине', 'Дорога', 'Прогулки и виды', 'Лавки', 'Транспорт'];
  const LINES = {
    place: 'Место прогулки.', shop: 'Лавка с хозяином.', view: 'Красивый вид.', square: 'Фонтан и часы, которые показывают 10:10.',
    park: 'Дорожки, лавочки и листопад.', dogpark: 'Площадка для собачек.', bikes: 'Велосипеды: садись и катись.', garage: 'Здесь живёт машинка.',
    edge: 'Дорога из города.', mission: 'Дом из дела.', car: 'Машинка стоит здесь.', bike: 'Велосипед ждёт здесь.',
    tower: 'Старая круглая башня. Внутри — лестница наверх.', bakery: 'Тёплый хлеб из лап зайки.', spring: 'Холодная вода — из ладошек.',
    wedding: 'Музыка, танцы и ряженые-шутники.', kaz: 'Примерить праздничную накидку с узором.', workshop: 'Мастера чеканят узоры по металлу.',
    museum: 'Узоры мастеров на стенах.', roof: 'Плоская крыша, с неё видно вершины.', zip: 'Трос через долину.', parking: 'Машинка ждёт здесь.',
    hotel: 'Белый корпус, двор и вид на вершины.', pool: 'Тёплая вода за стеклом.', golf: 'Три лунки с флажками.', fire: 'Скамейки вокруг огонька.',
    spa: 'Купели с паром — только посмотреть.', sport: 'Мячик выдают бесплатно.', bench: 'Присесть и посмотреть на долину.',
    fork: 'Вверх — к отелю на вершине.', gate: 'Ещё чуть-чуть — и площадь с лавками.', city: 'Вниз по серпантину — домой.',
  };
  const rgba = (hex, a) => { const h = String(hex || '#F2DCE2').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const shade = (hex, k) => { const h = String(hex || '#ccc').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); const f = v => clamp(Math.round(v * k), 0, 255); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  /* ---------- CSS (свой; вид .w-mini может перекрыть css/style.css) ---------- */
  const CSS = `
:where(.wmm-wrap){position:absolute;left:var(--hud-l,12px);bottom:var(--hud-b,calc(12px + var(--safe-bottom,0px)));width:var(--hud-radar,96px);height:var(--hud-radar,96px);z-index:18;pointer-events:none;transition:opacity .18s}
:where(.wmm-wrap) > *{pointer-events:auto}
:where(.wmm){position:absolute;inset:0;padding:0;border:0;border-radius:50%;overflow:hidden;background:rgba(255,253,249,.9);box-shadow:0 0 0 1.5px rgba(176,122,142,.5),0 5px 16px rgba(58,46,63,.2);cursor:pointer;touch-action:manipulation;transition:opacity .25s,transform .3s cubic-bezier(.2,1.3,.4,1),width .3s,height .3s;-webkit-tap-highlight-color:transparent}
.wmm canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none}
.wmm::after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 3.5px #fff,inset 0 0 14px rgba(58,46,63,.16);pointer-events:none}
.wmm:active{transform:scale(.95)}
.wmm .wmm-ic{position:absolute;inset:0;display:none;place-items:center;pointer-events:none}
.wmm-wrap.off .wmm{opacity:.38;pointer-events:none}
.wmm-wrap.hide{display:none}
.wmm-wrap.collapsed{width:44px;height:44px}
.wmm-wrap.collapsed .wmm canvas{display:none}
.wmm-wrap.collapsed .wmm .wmm-ic{display:grid}
:where(.w-root.busy) .wmm-wrap{display:none}
:where(.w-reg.zip) .wmm-wrap,:where(.w-reg.look) .wmm-wrap{display:none}
:where([data-hud-mode="zip"]) .wmm-wrap,:where([data-hud-mode="look"]) .wmm-wrap,:where([data-hud-mode="sport"]) .wmm-wrap,:where([data-hud-mode="dance"]) .wmm-wrap{display:none}
.wmm-wrap.wmm-off{display:none!important}
.wm-tabs{display:flex;gap:4px;margin:0 10px 8px;padding:4px;border-radius:16px;background:#F8EEF1;flex:none}
.wm-tab{flex:1;min-width:0;height:36px;border:0;border-radius:12px;background:transparent;color:#8A6E7E;font:inherit;font-weight:900;font-size:14px;cursor:pointer;touch-action:manipulation;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wm-tab.on{background:#fff;color:#9E2F47;box-shadow:0 2px 0 rgba(58,46,63,.08)}
.wm-pane{display:flex;flex-direction:column;flex:1;min-height:0}
.wm-pane.hidden{display:none}
.wm-seg{position:absolute;left:8px;top:8px;display:flex;gap:4px;z-index:2}
.wm-seg button{height:30px;padding:0 11px;border:0;border-radius:15px;background:rgba(255,253,249,.94);color:#8A6E7E;font:inherit;font-weight:900;font-size:12.5px;box-shadow:0 2px 0 rgba(58,46,63,.12);cursor:pointer;touch-action:manipulation}
.wm-seg button.on{background:#C2405B;color:#fff}
.wm-route{flex:1;min-height:0;overflow:auto;padding:4px 12px 14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.wm-route.pad{padding-bottom:178px}
.wm-route h4{margin:10px 2px 4px;font-family:var(--font-title,'Comfortaa',sans-serif);font-size:15px;font-weight:700;color:#9E2F47}
.wm-step{display:flex;gap:10px;align-items:flex-start;padding:7px 10px;margin-top:6px;border-radius:14px;background:#fff;box-shadow:0 2px 0 rgba(58,46,63,.07),0 0 0 1px #F5EAEE inset;font-size:13.5px;font-weight:700;color:#3A2E3F;line-height:1.3}
.wm-step b{flex:none;width:22px;height:22px;border-radius:50%;background:#C2405B;color:#fff;font-size:12px;line-height:22px;text-align:center}
.wm-step.lock{color:#8E89A6}
.wm-step.lock b{background:#B7B0C4}
.wm-step small{display:block;font-size:11.5px;color:#8A7E8E;margin-top:1px}
.wm-ovgo{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.wm-ovgo button{flex:1 1 40%;min-height:42px;border:0;border-radius:14px;background:#F8EEF1;color:#9E2F47;font:inherit;font-weight:900;font-size:13.5px;cursor:pointer;touch-action:manipulation}
.wm-pin2{margin-top:8px;width:100%;height:40px;border:0;border-radius:20px;background:#FFF4D9;color:#8A6412;font:inherit;font-weight:900;font-size:14px;cursor:pointer;touch-action:manipulation}
.wm-pin2.on{background:#F8EEF1;color:#6E6272}
.wm-ovbox .wm-tools{left:auto;right:8px;top:8px;bottom:auto}
.wm-ovbox .wm-north{right:auto;left:9px;top:12px;bottom:auto}
.modal.wm-sheet{position:absolute;inset:0;z-index:76;display:flex;align-items:stretch;justify-content:center;padding:calc(62px + var(--safe-top,0px)) 8px calc(8px + var(--safe-bottom,0px));background:rgba(58,46,63,.38);animation:wmFade .22s ease both;font-family:var(--font,'Nunito',system-ui,sans-serif)}
.modal.wm-sheet.out{animation:wmOut .2s ease both}
@keyframes wmFade{from{opacity:0}}
@keyframes wmOut{to{opacity:0}}
.wm-card{position:relative;width:100%;max-width:440px;max-height:100%;min-height:0;display:flex;flex-direction:column;background:#FFFDF9;border-radius:24px;overflow:hidden;box-shadow:0 10px 0 rgba(58,46,63,.12),0 24px 50px rgba(58,46,63,.28);animation:wmPop .34s cubic-bezier(.2,1.25,.4,1) both}
@keyframes wmPop{from{opacity:0;transform:translateY(22px) scale(.97)}}
.wm-head{display:flex;align-items:center;gap:8px;padding:12px 12px 8px 16px;flex:none}
.wm-title{flex:1;min-width:0;font-family:var(--font-title,'Comfortaa',sans-serif);font-weight:700;font-size:19px;color:#9E2F47}
.wm-x{width:42px;height:42px;border:0;border-radius:14px;background:#F8EEF1;color:#6E6272;font-size:17px;font-weight:900;cursor:pointer;flex:none;touch-action:manipulation}
.wm-x:active,.wm-tools button:active,.wm-row:active{transform:translateY(2px)}
.wm-mapbox{position:relative;margin:0 10px;border-radius:18px;overflow:hidden;background:#F2E6E3;box-shadow:inset 0 0 0 2px #F1E2E6;flex:none}
.wm-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}
.wm-tools{position:absolute;left:8px;bottom:8px;display:flex;gap:6px}
.wm-tools button{width:36px;height:36px;border:0;border-radius:12px;background:rgba(255,253,249,.95);color:#9E2F47;font:900 20px/1 system-ui,sans-serif;box-shadow:0 3px 0 rgba(58,46,63,.14);cursor:pointer;touch-action:manipulation;display:grid;place-items:center}
.wm-tools button.me{font-size:12px;font-family:inherit}
.wm-north{position:absolute;right:9px;bottom:9px;width:26px;height:26px;border-radius:50%;background:rgba(255,253,249,.92);display:grid;place-items:center;font:900 12px/1 var(--font-title,'Comfortaa',sans-serif);color:#C2405B;box-shadow:0 2px 0 rgba(58,46,63,.12);pointer-events:none}
.wm-north::before{content:'';position:absolute;top:-5px;left:50%;margin-left:-4px;border:4px solid transparent;border-top:0;border-bottom:6px solid #C2405B}
.wm-legend{display:flex;flex-wrap:wrap;gap:5px 5px;padding:8px 12px 2px;flex:none}
.wm-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;color:#6E6272;background:#FBF1EE;border-radius:99px;padding:2px 9px 2px 2px;line-height:20px}
.wm-chip img{width:20px;height:20px;display:block}
.wm-list{flex:1;min-height:0;overflow:auto;padding:2px 10px 14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.wm-list.pad{padding-bottom:178px}
.wm-group{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#C2405B;margin:12px 6px 2px}
.wm-row{display:flex;align-items:center;gap:10px;width:100%;border:0;background:#fff;border-radius:14px;padding:7px 10px;margin-top:6px;box-shadow:0 2px 0 rgba(58,46,63,.07),0 0 0 1px #F5EAEE inset;text-align:left;font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}
.wm-row img{width:28px;height:28px;flex:none}
.wm-row .n{flex:1;min-width:0;font-weight:800;font-size:14px;color:#3A2E3F;line-height:1.2}
.wm-row .n small{display:block;font-size:11.5px;font-weight:700;color:#8A7E8E;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wm-row .d{font-size:12px;font-weight:900;color:#B07A12;white-space:nowrap}
.wm-row.lock .n{color:#8E89A6}
.wm-row.on{box-shadow:0 0 0 2px #C2405B inset}
.wm-poi{position:absolute;left:8px;right:8px;bottom:8px;background:#fff;border-radius:20px;padding:12px;box-shadow:0 -2px 0 rgba(58,46,63,.04),0 12px 30px rgba(58,46,63,.24);animation:wmUp .3s cubic-bezier(.2,1.3,.4,1) both;z-index:3}
@keyframes wmUp{from{opacity:0;transform:translateY(24px)}}
.wm-poi-h{display:flex;gap:10px;align-items:center;padding-right:34px}
.wm-poi-h img{width:40px;height:40px;flex:none}
.wm-poi-n{font-family:var(--font-title,'Comfortaa',sans-serif);font-weight:700;font-size:16.5px;color:#3A2E3F;line-height:1.2}
.wm-poi-l{font-size:13px;font-weight:700;color:#6E6272;margin-top:2px;line-height:1.3}
.wm-poi-d{font-size:12px;font-weight:900;color:#B07A12;margin-top:3px}
.wm-poi-x{position:absolute;right:8px;top:8px;width:34px;height:34px;border:0;border-radius:12px;background:#F8EEF1;color:#6E6272;font-weight:900;font-size:14px;cursor:pointer}
.wm-go{margin-top:10px;width:100%;height:50px;border:0;border-radius:25px;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-weight:900;font-size:16px;box-shadow:0 4px 0 var(--cherry-d,#9E2F47),0 8px 16px rgba(158,47,71,.22);cursor:pointer;touch-action:manipulation}
.wm-go:active{transform:translateY(3px);box-shadow:0 1px 0 var(--cherry-d,#9E2F47)}
.wm-note{margin-top:10px;padding:10px 12px;border-radius:14px;background:#F4F0F8;color:#6E6272;font-weight:800;font-size:13.5px;line-height:1.3}
.wm-note.lock::before{content:'🔒 '}
.wm-note.here{background:#FFF4D9;color:#8A6412}
.wm-pref{display:flex;gap:6px;align-items:center;justify-content:center;padding:4px 12px 10px;font-size:11.5px;font-weight:800;color:#8A7E8E;flex:none}
.wm-pref button{border:0;border-radius:99px;padding:5px 10px;background:#F8EEF1;color:#6E6272;font:inherit;font-weight:800;cursor:pointer}
.wm-pref button.on{background:#C2405B;color:#fff}
:where(.wm-cloud){position:absolute;inset:0;z-index:96;overflow:hidden;pointer-events:all}
.wm-cloud .wm-fog{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,#FFF9F4 0%,#FCE6EC 66%,#F4D5E1 100%);opacity:0;transition:opacity .42s ease}
.wm-cloud.in .wm-fog{opacity:1}
.wm-cloud .wm-puff{position:absolute;width:220px;height:150px;border-radius:50%;background:#FFFDF9;transition:transform .6s cubic-bezier(.3,.85,.3,1);box-shadow:70px 24px 0 -8px #FFF7F3,-74px 30px 0 -14px #FFFAF7,22px -46px 0 -4px #FFFDF9,-30px -30px 0 -18px #FFF5F2}
.wm-cloud .wm-puff.l{transform:translateX(-170%)}
.wm-cloud .wm-puff.r{transform:translateX(170%)}
.wm-cloud.in .wm-puff{transform:none}
.wm-cloud .wm-dest{position:absolute;left:0;right:0;top:46%;text-align:center;font-family:var(--font-title,'Comfortaa',sans-serif);font-weight:700;font-size:20px;color:#9E2F47;opacity:0;transform:translateY(8px);transition:opacity .3s .15s,transform .3s .15s;padding:0 24px}
.wm-cloud .wm-dest small{display:block;font-family:var(--font,'Nunito',sans-serif);font-size:13px;font-weight:800;color:#B07A8E;margin-bottom:4px}
.wm-cloud.in .wm-dest{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){.wm-cloud .wm-puff{display:none}.wm-card,.wm-poi{animation:none}}
`;
  function ensureCss() {
    if (document.getElementById('wMiniCss')) return;
    const st = document.createElement('style'); st.id = 'wMiniCss'; st.textContent = CSS;
    document.head.insertBefore(st, document.head.firstChild);   // раньше style.css: при равном весе правила игры главнее
  }

  /* ---------- значки: белый рисунок в цветном круге (без эмодзи-шрифта) ---------- */
  function glyph(c, g, r, fg, bg) {
    c.fillStyle = fg; c.strokeStyle = fg; c.lineCap = 'round'; c.lineJoin = 'round';
    const lw = k => { c.lineWidth = k * r; };
    const P = (pts, close) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * r, y * r) : c.moveTo(x * r, y * r))); if (close) c.closePath(); };
    switch (g) {
      case 'case': lw(0.17); c.beginPath(); c.arc(-0.12 * r, -0.12 * r, 0.34 * r, 0, TAU); c.stroke(); lw(0.24); P([[0.14, 0.14], [0.44, 0.44]]); c.stroke(); break;
      case 'house': P([[-0.52, -0.02], [0, -0.5], [0.52, -0.02]], true); c.fill(); c.fillRect(-0.36 * r, -0.08 * r, 0.72 * r, 0.52 * r); c.fillStyle = bg; c.fillRect(-0.09 * r, 0.14 * r, 0.18 * r, 0.3 * r); break;
      case 'bag': c.beginPath(); c.moveTo(-0.4 * r, -0.12 * r); c.lineTo(0.4 * r, -0.12 * r); c.lineTo(0.34 * r, 0.46 * r); c.lineTo(-0.34 * r, 0.46 * r); c.closePath(); c.fill(); lw(0.12); c.beginPath(); c.arc(0, -0.14 * r, 0.2 * r, PI, 0); c.stroke(); break;
      case 'eye': c.beginPath(); c.moveTo(-0.5 * r, 0); c.quadraticCurveTo(0, -0.5 * r, 0.5 * r, 0); c.quadraticCurveTo(0, 0.5 * r, -0.5 * r, 0); c.fill(); c.fillStyle = bg; c.beginPath(); c.arc(0, 0, 0.17 * r, 0, TAU); c.fill(); break;
      case 'sun': c.beginPath(); c.arc(0, 0, 0.24 * r, 0, TAU); c.fill(); lw(0.11); for (let i = 0; i < 8; i++) { const a = i * PI / 4; P([[Math.cos(a) * 0.36, Math.sin(a) * 0.36], [Math.cos(a) * 0.5, Math.sin(a) * 0.5]]); c.stroke(); } break;
      case 'tree': c.fillRect(-0.06 * r, 0.05 * r, 0.12 * r, 0.42 * r); c.beginPath(); c.arc(0, -0.12 * r, 0.32 * r, 0, TAU); c.fill(); c.beginPath(); c.arc(-0.2 * r, 0.05 * r, 0.2 * r, 0, TAU); c.arc(0.2 * r, 0.05 * r, 0.2 * r, 0, TAU); c.fill(); break;
      case 'paw': c.beginPath(); c.ellipse(0, 0.16 * r, 0.24 * r, 0.2 * r, 0, 0, TAU); c.fill(); [[-0.3, -0.08], [-0.11, -0.3], [0.11, -0.3], [0.3, -0.08]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, 0.1 * r, 0, TAU); c.fill(); }); break;
      case 'bike': lw(0.1); c.beginPath(); c.arc(-0.27 * r, 0.14 * r, 0.2 * r, 0, TAU); c.stroke(); c.beginPath(); c.arc(0.27 * r, 0.14 * r, 0.2 * r, 0, TAU); c.stroke(); P([[-0.27, 0.14], [-0.05, -0.16], [0.18, -0.16], [0.27, 0.14]]); c.stroke(); P([[-0.05, -0.16], [0.02, 0.14], [0.18, -0.16]]); c.stroke(); P([[-0.12, -0.28], [0.02, -0.28]]); c.stroke(); break;
      case 'car': c.beginPath(); c.moveTo(-0.5 * r, 0.16 * r); c.quadraticCurveTo(-0.48 * r, -0.08 * r, -0.26 * r, -0.1 * r); c.quadraticCurveTo(-0.12 * r, -0.38 * r, 0.12 * r, -0.36 * r); c.quadraticCurveTo(0.34 * r, -0.32 * r, 0.42 * r, -0.08 * r); c.quadraticCurveTo(0.52 * r, -0.02 * r, 0.5 * r, 0.16 * r); c.closePath(); c.fill(); c.fillStyle = bg; [[-0.27, 0.18], [0.27, 0.18]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, 0.15 * r, 0, TAU); c.fill(); }); c.fillStyle = fg; [[-0.27, 0.18], [0.27, 0.18]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, 0.09 * r, 0, TAU); c.fill(); }); break;
      case 'road': P([[-0.16, -0.46], [0.16, -0.46], [0.42, 0.46], [-0.42, 0.46]], true); c.fill(); c.fillStyle = bg; [[-0.36, -0.2], [0.08, 0.06], [0.24, 0.32]].forEach((_, i) => { const y = -0.3 + i * 0.27; c.fillRect(-0.035 * r, y * r, 0.07 * r, 0.14 * r); }); break;
      case 'lock': lw(0.11); c.beginPath(); c.arc(0, -0.1 * r, 0.2 * r, PI, 0); c.stroke(); c.fillRect(-0.3 * r, -0.1 * r, 0.6 * r, 0.48 * r); break;
      case 'check': lw(0.16); P([[-0.3, 0.02], [-0.08, 0.24], [0.32, -0.2]]); c.stroke(); break;
      case 'clock': c.beginPath(); c.arc(0, 0, 0.42 * r, 0, TAU); c.fill(); c.strokeStyle = bg; lw(0.09); P([[0, 0], [-0.21, -0.12]]); c.stroke(); P([[0, 0], [0.24, -0.17]]); c.stroke(); break;
      // волна 4B: горы
      case 'tower': c.fillRect(-0.24 * r, -0.26 * r, 0.48 * r, 0.72 * r); for (let i = 0; i < 3; i++) c.fillRect((-0.32 + i * 0.25) * r, -0.46 * r, 0.14 * r, 0.24 * r); c.fillRect(-0.32 * r, -0.3 * r, 0.64 * r, 0.1 * r); c.fillStyle = bg; c.fillRect(-0.07 * r, 0.16 * r, 0.14 * r, 0.3 * r); break;
      case 'bread': c.beginPath(); c.ellipse(0, 0.04 * r, 0.48 * r, 0.3 * r, -0.25, 0, TAU); c.fill(); c.strokeStyle = bg; lw(0.08); [-0.2, 0, 0.2].forEach(x => { P([[x - 0.06, -0.12], [x + 0.08, 0.16]]); c.stroke(); }); break;
      case 'drop': c.beginPath(); c.moveTo(0, -0.5 * r); c.bezierCurveTo(0.2 * r, -0.2 * r, 0.38 * r, 0.02 * r, 0.38 * r, 0.16 * r); c.arc(0, 0.16 * r, 0.38 * r, 0, PI); c.bezierCurveTo(-0.38 * r, 0.02 * r, -0.2 * r, -0.2 * r, 0, -0.5 * r); c.fill(); break;
      case 'note': c.beginPath(); c.ellipse(-0.18 * r, 0.3 * r, 0.17 * r, 0.13 * r, -0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.26 * r, 0.2 * r, 0.17 * r, 0.13 * r, -0.4, 0, TAU); c.fill(); lw(0.09); P([[-0.03, 0.28], [-0.03, -0.38], [0.41, -0.48], [0.41, 0.18]]); c.stroke(); break;
      case 'scarf': c.beginPath(); c.moveTo(-0.4 * r, -0.3 * r); c.quadraticCurveTo(0, -0.52 * r, 0.4 * r, -0.3 * r); c.lineTo(0.26 * r, 0.44 * r); c.lineTo(0.06 * r, 0.3 * r); c.lineTo(-0.1 * r, 0.46 * r); c.closePath(); c.fill(); c.fillStyle = bg; [[0.12, 0.02], [-0.12, -0.12], [0.02, -0.26]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, 0.05 * r, 0, TAU); c.fill(); }); break;
      case 'hammer': lw(0.13); P([[-0.32, 0.4], [0.12, -0.04]]); c.stroke(); c.save(); c.rotate(-PI / 4); c.fillRect(-0.06 * r, -0.62 * r, 0.42 * r, 0.24 * r); c.restore(); break;
      case 'columns': P([[-0.46, -0.18], [0, -0.48], [0.46, -0.18]], true); c.fill(); [-0.3, -0.04, 0.22].forEach(x => c.fillRect(x * r, -0.1 * r, 0.1 * r, 0.42 * r)); c.fillRect(-0.44 * r, 0.34 * r, 0.88 * r, 0.1 * r); break;
      case 'zip': lw(0.08); P([[-0.5, -0.32], [0.5, 0.06]]); c.stroke(); c.fillRect(-0.06 * r, -0.2 * r, 0.12 * r, 0.24 * r); c.beginPath(); c.arc(0, 0.16 * r, 0.16 * r, 0, TAU); c.fill(); lw(0.08); P([[-0.12, 0.3], [-0.2, 0.48]]); c.stroke(); P([[0.12, 0.3], [0.2, 0.48]]); c.stroke(); break;
      case 'P': c.font = `900 ${0.92 * r}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, 0.06 * r); break;
      case 'hotel': c.fillRect(-0.4 * r, -0.26 * r, 0.8 * r, 0.7 * r); c.fillStyle = bg; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.fillRect((-0.28 + i * 0.22) * r, (-0.14 + j * 0.24) * r, 0.12 * r, 0.12 * r); c.fillStyle = fg; P([[-0.46, -0.24], [0, -0.5], [0.46, -0.24]], true); c.fill(); break;
      case 'waves': lw(0.1); [-0.2, 0.06, 0.32].forEach(y => { c.beginPath(); c.moveTo(-0.44 * r, y * r); for (let i = 0; i < 4; i++) c.quadraticCurveTo((-0.33 + i * 0.22) * r, (y - 0.12) * r, (-0.22 + i * 0.22) * r, y * r); c.stroke(); }); break;
      case 'flag': lw(0.09); P([[-0.16, 0.46], [-0.16, -0.46]]); c.stroke(); P([[-0.12, -0.46], [0.4, -0.28], [-0.12, -0.1]], true); c.fill(); c.beginPath(); c.ellipse(-0.06 * r, 0.42 * r, 0.32 * r, 0.08 * r, 0, 0, TAU); c.fill(); break;
      case 'flame': c.beginPath(); c.moveTo(0, -0.5 * r); c.bezierCurveTo(0.34 * r, -0.16 * r, 0.4 * r, 0.12 * r, 0.3 * r, 0.3 * r); c.arc(0, 0.22 * r, 0.31 * r, 0.25, PI - 0.25); c.bezierCurveTo(-0.4 * r, 0.06 * r, -0.2 * r, -0.12 * r, 0, -0.5 * r); c.fill(); c.fillStyle = bg; c.beginPath(); c.ellipse(0, 0.26 * r, 0.12 * r, 0.16 * r, 0, 0, TAU); c.fill(); break;
      case 'steam': c.beginPath(); c.ellipse(0, 0.3 * r, 0.46 * r, 0.16 * r, 0, 0, TAU); c.fill(); lw(0.09); [-0.18, 0.04, 0.26].forEach(x => { c.beginPath(); c.moveTo(x * r, 0.08 * r); c.bezierCurveTo((x - 0.14) * r, -0.08 * r, (x + 0.12) * r, -0.2 * r, x * r, -0.44 * r); c.stroke(); }); break;
      case 'ball': c.beginPath(); c.arc(0, 0, 0.44 * r, 0, TAU); c.fill(); c.fillStyle = bg; c.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; c.lineTo(Math.cos(a) * 0.17 * r, Math.sin(a) * 0.17 * r); } c.closePath(); c.fill(); break;
      case 'bench': c.fillRect(-0.44 * r, -0.08 * r, 0.88 * r, 0.14 * r); c.fillRect(-0.44 * r, -0.36 * r, 0.88 * r, 0.12 * r); c.fillRect(-0.36 * r, 0.06 * r, 0.1 * r, 0.32 * r); c.fillRect(0.26 * r, 0.06 * r, 0.1 * r, 0.32 * r); break;
      case 'city': c.fillRect(-0.46 * r, -0.06 * r, 0.3 * r, 0.5 * r); c.fillRect(-0.12 * r, -0.42 * r, 0.26 * r, 0.86 * r); c.fillRect(0.18 * r, -0.18 * r, 0.28 * r, 0.62 * r); c.fillStyle = bg; [[-0.36, 0.06], [-0.04, -0.28], [-0.04, -0.02], [0.27, -0.06], [0.27, 0.16]].forEach(([x, y]) => c.fillRect(x * r, y * r, 0.09 * r, 0.1 * r)); break;
      case 'fork': lw(0.14); P([[0, 0.48], [0, 0.02], [-0.36, -0.42]]); c.stroke(); P([[0, 0.02], [0.36, -0.42]]); c.stroke(); break;
      case 'uturn': lw(0.13); c.beginPath(); c.moveTo(-0.24 * r, 0.44 * r); c.lineTo(-0.24 * r, -0.04 * r); c.arc(0, -0.04 * r, 0.24 * r, PI, 0); c.lineTo(0.24 * r, 0.24 * r); c.stroke(); P([[0.08, 0.14], [0.24, 0.38], [0.4, 0.14]]); c.stroke(); break;
      case 'gate': lw(0.12); c.beginPath(); c.moveTo(-0.36 * r, 0.46 * r); c.lineTo(-0.36 * r, -0.06 * r); c.arc(0, -0.06 * r, 0.36 * r, PI, 0); c.lineTo(0.36 * r, 0.46 * r); c.stroke(); break;
      case 'roof': c.beginPath(); c.arc(0, 0.12 * r, 0.26 * r, PI, 0); c.fill(); c.fillRect(-0.48 * r, 0.16 * r, 0.96 * r, 0.1 * r); lw(0.08); for (let i = 0; i < 5; i++) { const a = PI + i * PI / 4; P([[Math.cos(a) * 0.34, 0.12 + Math.sin(a) * 0.34], [Math.cos(a) * 0.46, 0.12 + Math.sin(a) * 0.46]]); c.stroke(); } break;
      case 'pin': c.beginPath(); c.arc(0, -0.12 * r, 0.3 * r, 0, TAU); c.fill(); P([[-0.2, 0.06], [0, 0.48], [0.2, 0.06]], true); c.fill(); c.fillStyle = bg; c.beginPath(); c.arc(0, -0.12 * r, 0.12 * r, 0, TAU); c.fill(); break;
      case 'mountain': P([[-0.5, 0.36], [-0.12, -0.36], [0.06, -0.06], [0.2, -0.24], [0.5, 0.36]], true); c.fill(); c.fillStyle = bg; P([[-0.2, -0.2], [-0.12, -0.36], [-0.03, -0.2]], true); c.fill(); break;
      default: c.beginPath(); c.arc(0, 0, 0.22 * r, 0, TAU); c.fill();
    }
  }
  // круглый значок: белый ободок, цветной круг, белый рисунок; o: { g, col, dim, shadow }
  function pin(c, kind, x, y, r, o = {}) {
    const K = KINDS[kind] || KINDS.place, col = o.dim ? '#B7B0C4' : (o.col || K.col);
    c.save(); c.translate(x, y);
    if (o.shadow !== false) { c.fillStyle = 'rgba(58,46,63,.2)'; c.beginPath(); c.ellipse(0, r * 0.9, r * 0.82, r * 0.3, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.8, 0, TAU); c.fill();
    if (r >= 4.5) glyph(c, o.g || K.g, r * 0.8, '#FFFFFF', col);
    c.restore();
  }
  // метка дела: «капля» над точкой двери
  function dropPin(c, x, y, r, col, g) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(58,46,63,.22)'; c.beginPath(); c.ellipse(0, 0, r * 0.6, r * 0.22, 0, 0, TAU); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, -r * 1.45, r * 1.04, PI * 0.82, PI * 0.18); c.lineTo(0, 0); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, -r * 1.45, r * 0.84, PI * 0.8, PI * 0.2); c.lineTo(0, -r * 0.3); c.closePath(); c.fill();
    c.translate(0, -r * 1.45); glyph(c, g || 'case', r * 0.84, '#FFFFFF', col);
    c.restore();
  }
  const ICONS = {};
  function iconURL(kind, o = {}) {
    const key = kind + (o.dim ? ':d' : '') + (o.g || '') + (o.drop ? ':p' : '');
    if (ICONS[key]) return ICONS[key];
    const c = cnv(64, 64), x = c.getContext('2d');
    if (o.drop) dropPin(x, 32, 58, 15, (KINDS[kind] || KINDS.mission).col, o.g); else pin(x, kind, 32, 30, 26, Object.assign({ shadow: false }, o));
    try { ICONS[key] = c.toDataURL(); } catch (e) { ICONS[key] = ''; }
    return ICONS[key];
  }

  /* ---------- разбор планировки ---------- */
  function toShapes(v) {
    if (!v) return [];
    let arr = Array.isArray(v) ? v : [v];
    if (Array.isArray(v) && v.length >= 3 && Array.isArray(v[0]) && v[0].length === 2 && typeof v[0][0] === 'number') arr = [v];   // один многоугольник
    return arr.map(r => {
      if (!r) return null;
      if (Array.isArray(r)) {
        if (r.length >= 3 && Array.isArray(r[0])) return { poly: r };
        if (r.length >= 4 && r.every(n => typeof n === 'number')) return { x0: Math.min(r[0], r[1]), x1: Math.max(r[0], r[1]), z0: Math.min(r[2], r[3]), z1: Math.max(r[2], r[3]) };
        return null;
      }
      if (Array.isArray(r.poly) || Array.isArray(r.pts)) return { poly: r.poly || r.pts };
      if (typeof r.r === 'number' && typeof r.x === 'number' && typeof r.z === 'number' && r.x0 === undefined) return { cx: r.x, cz: r.z, cr: r.r };
      if ([r.x0, r.x1, r.z0, r.z1].some(n => typeof n === 'number')) return { x0: num(r.x0, -1e9), x1: num(r.x1, 1e9), z0: num(r.z0, -1e9), z1: num(r.z1, 1e9) };
      return null;
    }).filter(Boolean);
  }
  const inPoly = (pts, x, z) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };
  const inShape = (r, x, z) => (r.poly ? inPoly(r.poly, x, z) : r.cr !== undefined ? (x - r.cx) * (x - r.cx) + (z - r.cz) * (z - r.cz) <= r.cr * r.cr : x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  // дверь в одном виде: реестр города ({ x, z, ax, az, nx, nz }) или doorsStatic ({ x, z — точка подхода, yaw })
  function normDoor(d) {
    if (!d || typeof d.x !== 'number') return null;
    const nx = typeof d.nx === 'number' ? d.nx : Math.sin(d.yaw || 0), nz = typeof d.nz === 'number' ? d.nz : Math.cos(d.yaw || 0);
    const ax = typeof d.ax === 'number' ? d.ax : d.x, az = typeof d.az === 'number' ? d.az : d.z;
    const x = typeof d.ax === 'number' ? d.x : ax - nx * 0.73, z = typeof d.az === 'number' ? d.z : az - nz * 0.73;
    return { id: d.id, kind: d.kind, x, z, ax, az, nx, nz, label: d.label || '', short: d.short || d.label || '', w: d.w || 3.4, bkey: d.bkey, raw: d };
  }
  function doorListOf(src) {
    let list = null;
    if (Array.isArray(src)) list = src;
    else if (src && Array.isArray(src.list)) list = src.list;
    else if (src && typeof src.info === 'function') list = safe(src.info);
    if (!list && typeof WORLD.doorsStatic === 'function') list = safe(WORLD.doorsStatic);
    return (list || []).map(normDoor).filter(Boolean);
  }

  function analyze(L, C, doors, o = {}) {
    L = L || {};
    const boxes = (C && Array.isArray(C.boxes) ? C.boxes : []).filter(b => b && [b.x0, b.x1, b.z0, b.z1].every(n => typeof n === 'number'));
    let B0 = L.bounds && [L.bounds.x0, L.bounds.x1, L.bounds.z0, L.bounds.z1].every(n => typeof n === 'number') ? L.bounds : null;
    if (!B0) {   // граница по дверям и мелким коллайдерам
      const xs = doors.map(d => d.ax), zs = doors.map(d => d.az);
      boxes.forEach(b => { if ((b.x1 - b.x0) * (b.z1 - b.z0) < 900) { xs.push(b.x0, b.x1); zs.push(b.z0, b.z1); } });
      B0 = xs.length ? { x0: Math.min(...xs) - 8, x1: Math.max(...xs) + 8, z0: Math.min(...zs) - 4, z1: Math.max(...zs) + 30 } : { x0: -50, x1: 70, z0: -2, z1: 66 };
    }
    const F = { x0: B0.x0 - 4, x1: B0.x1 + 4, z0: B0.z0 - 12, z1: B0.z1 + 11 };   // рамка: ряд домов на севере, река на юге
    const drivableF = typeof L.drivable === 'function' ? L.drivable : null;
    const drivable = drivableF ? (x, z) => { try { return !!drivableF(x, z, 0); } catch (e) { return false; } } : () => false;
    const waterS = toShapes(L.water || L.river || L.waters);
    const riverZ = B0.z1 + 0.65;
    const water = waterS.length ? (x, z) => waterS.some(r => inShape(r, x, z)) : (x, z) => z > riverZ;
    let lawnS = toShapes(L.lawns || L.parks || L.green), pathS = toShapes(L.parkPaths || L.trails);
    if (!lawnS.length && L.inner && L.outer && L.oct) {   // планировка волны 2 (map.js): газоны у площади, у часов и парк
      const I = L.inner, O = L.outer, oc = L.oct;
      lawnS = [{ x0: I.x0 + 3, x1: -6, z0: I.z0 + 3, z1: I.z1 - 3 }, { x0: 36, x1: I.x1 - 3, z0: I.z0 + 3, z1: I.z1 - 3 }, { x0: B0.x0, x1: O.x0 - 3, z0: oc.z1 + 3, z1: O.z1 - 3 }];
      if (!pathS.length) pathS = [{ x0: -44.4, x1: -42.0, z0: 18.5, z1: 53.5 }, { cx: -43.2, cz: 36, cr: 3.4 }];
    }
    const lawn = (x, z) => lawnS.some(r => inShape(r, x, z));
    // тропинки велосипеда (rideable) — только если это настоящие тропинки, а не «всё, где можно ходить»
    let rideIn = null;
    if (typeof L.rideable === 'function' && lawnS.length) {
      let n = 0, yes = 0;
      lawnS.forEach(r => { if (r.poly || r.cr !== undefined) return; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = r.x0 + (r.x1 - r.x0) * (i + 0.5) / 8, z = r.z0 + (r.z1 - r.z0) * (j + 0.5) / 8; n++; if (safe(L.rideable, x, z)) yes++; } });
      if (n && yes / n < 0.6) rideIn = L.rideable;
    }
    const pathAt = (x, z) => pathS.some(r => inShape(r, x, z)) || (!!rideIn && lawn(x, z) && !!safe(rideIn, x, z));
    const squares = toShapes(L.squares || L.plazas).filter(r => r.cr !== undefined);
    if (L.fountain && typeof L.fountain.x === 'number' && !squares.length) squares.push({ cx: L.fountain.x, cz: L.fountain.z, cr: 13 });
    // дома: коробки коллайдеров (высокие); длинный ряд — на отдельные домики; без коллайдеров — по дверям
    const blocks = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const addRow = (x0, x1, z0, z1, ci) => {
      const along = x1 - x0 >= z1 - z0, len = along ? x1 - x0 : z1 - z0;
      if (len <= 9) { blocks.push({ x0, x1, z0, z1, col: COL.block[ci % COL.block.length] }); return; }
      let t = 0, k = ci;
      while (t < len - 0.5) {
        const w = Math.min(len - t, 3.2 + rnd() * 3); const a = t + 0.18, b = t + w - 0.18;
        if (b - a > 0.6) blocks.push(along ? { x0: x0 + a, x1: x0 + b, z0, z1, col: COL.block[k % COL.block.length] } : { x0, x1, z0: z0 + a, z1: z0 + b, col: COL.block[k % COL.block.length] });
        t += w; k++;
      }
    };
    const landmarks = [];
    if (L.tower && typeof L.tower.x === 'number') landmarks.push({ kind: 'clock', x: L.tower.x, z: L.tower.z });
    toShapes(L.blocks).forEach((r, i) => { if (r.x0 > -1e8) addRow(r.x0, r.x1, r.z0, r.z1, i); });
    if (!blocks.length && boxes.length) {
      boxes.forEach((b, i) => {
        if ((b.h || 5) < 2.2 || (b.cam && b.noWalk)) return;
        const x0 = Math.max(b.x0, F.x0 - 4), x1 = Math.min(b.x1, F.x1 + 4), z0 = Math.max(b.z0, F.z0 - 4), z1 = Math.min(b.z1, F.z1 + 4);
        if (x1 - x0 < 0.3 || z1 - z0 < 0.3) return;
        addRow(x0, x1, z0, z1, i * 3);
      });
    }
    if (!blocks.length) doors.forEach((d, i) => {   // домик за каждой дверью: ширина фасада, глубина 4 м
      const tx = -d.nz, tz = d.nx, hw = Math.min(d.w || 3.4, 7) / 2, bx = d.x - d.nx * 2.1, bz = d.z - d.nz * 2.1;
      const xs = [bx - tx * hw - d.nx * 2, bx + tx * hw - d.nx * 2, bx - tx * hw + d.nx * 2, bx + tx * hw + d.nx * 2], zs = [bz - tz * hw - d.nz * 2, bz + tz * hw - d.nz * 2, bz - tz * hw + d.nz * 2, bz + tz * hw + d.nz * 2];
      blocks.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), col: COL.block[i % COL.block.length] });
    });
    // районы
    let districts = (Array.isArray(L.districts) ? L.districts : []).filter(d => d && [d.x0, d.x1, d.z0, d.z1].every(n => typeof n === 'number')).map(d => Object.assign({}, d));
    if (!districts.length && L.oct && L.inner && L.outer) {
      const I = L.inner, O = L.outer, oc = L.oct;
      districts = [
        { id: 'oct', name: 'ул. Октябрьская', x0: F.x0, x1: F.x1, z0: F.z0, z1: oc.z1, color: '#F6D3DB', lx: -26, lz: oc.zc },
        { id: 'square', name: 'Площадь Солнца', x0: I.x0, x1: I.x1, z0: I.z0, z1: I.z1, color: '#FBE3B8', lx: (I.x0 + I.x1) / 2 - 3, lz: I.z0 + 4.2 },
        { id: 'park', name: 'Парк «Каштановый»', x0: F.x0, x1: O.x0, z0: oc.z1, z1: O.z1, color: '#D6E8C4' },
        { id: 'embank', name: 'Набережная', x0: F.x0, x1: F.x1, z0: O.z1, z1: B0.z1 + 0.6, color: '#D4E5F2', lx: (F.x0 + F.x1) / 2, lz: (O.z1 + B0.z1) / 2 + 0.6 },
        { id: 'sun', name: 'Солнечный проспект', x0: O.x1, x1: F.x1, z0: oc.z1, z1: O.z1, color: '#E4DAF2' },
      ];
    }
    districts.forEach(d => { if (d.locked || (typeof o.districtOpen === 'function' && safe(o.districtOpen, d.id) === false)) d.soon = true; });
    const A = { L, F, B: B0, drivable, water, lawn, pathAt, squares, blocks, landmarks, districts, rasters: {}, fountain: L.fountain || null, edge: L.edge || null };
    A.districtAt = (x, z) => { let best = null; districts.forEach(d => { if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1 && (!best || (d.x1 - d.x0) * (d.z1 - d.z0) < (best.x1 - best.x0) * (best.z1 - best.z0))) best = d; }); return best; };
    // проходимо ли (для точки прибытия): тротуар, площадь, газон — не дом, не вода, не ствол дерева
    const circles = C && Array.isArray(C.circles) ? C.circles : [];
    A.free = (x, z, r = 0.4) => {
      if (x < B0.x0 + 0.5 || x > B0.x1 - 0.5 || z < B0.z0 + 0.2 || z > B0.z1 - 0.2 || water(x, z)) return false;
      if (typeof L.walkable === 'function' && !o.noWalkable) { const w = safe(L.walkable, x, z); if (w === false) return false; }
      for (const c of circles) if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < (c.r + r) * (c.r + r)) return false;
      for (const b of boxes) if (b.noWalk !== false && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
      return true;
    };
    // растр 1 пиксель = cell м: вода, дороги (с бордюром), дорожки, газоны; считается по строкам (можно в простое)
    A.raster = (cell, budgetMs) => {
      let R = A.rasters[cell];
      if (!R) {
        const nx = Math.ceil((F.x1 - F.x0) / cell), nz = Math.ceil((F.z1 - F.z0) / cell);
        R = A.rasters[cell] = { cell, nx, nz, x0: F.x0, z0: F.z0, cls: new Uint8Array(nx * nz), j: 0, done: false, cv: null };
      }
      if (R.done) return R;
      const t0 = now(), lim = budgetMs === undefined ? 1e9 : budgetMs;
      while (R.j < R.nz) {
        const z = R.z0 + (R.j + 0.5) * cell, row = R.j * R.nx;
        for (let i = 0; i < R.nx; i++) {
          const x = R.x0 + (i + 0.5) * cell;
          R.cls[row + i] = water(x, z) ? 1 : drivable(x, z) ? 2 : lawn(x, z) ? (pathAt(x, z) ? 3 : 4) : pathAt(x, z) ? 3 : 0;
        }
        R.j++;
        if ((R.j & 3) === 0 && now() - t0 > lim) return R;
      }
      // цвет: бордюр — клетка рядом с дорогой
      const cv = cnv(R.nx, R.nz), cx = cv.getContext('2d'), img = cx.createImageData(R.nx, R.nz), d = img.data, cl = R.cls, NX = R.nx;
      const PAL = [null, COL.water, COL.road, COL.path, COL.lawn];
      for (let k = 0; k < cl.length; k++) {
        let c = cl[k], col = PAL[c];
        if (c !== 2 && c !== 1) { const i = k % NX; if ((i > 0 && cl[k - 1] === 2) || (i < NX - 1 && cl[k + 1] === 2) || (k >= NX && cl[k - NX] === 2) || (k + NX < cl.length && cl[k + NX] === 2)) col = COL.curb; }
        if (!col) continue;
        d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; d[k * 4 + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      R.cv = cv; R.done = true;
      return R;
    };
    return A;
  }

  /* ---------- рисунок города (общий для мини- и большой карты) ---------- */
  // c — 2D-контекст; s — пикселей на метр; (ox, oz) — мир в точке (0, 0) холста; o: { cell, trees, waves, mini }
  function paint(c, A, s, ox, oz, W, H, o = {}) {
    const X = x => (x - ox) * s, Y = z => (z - oz) * s, F = A.F;
    c.save();
    c.fillStyle = COL.paper; c.fillRect(0, 0, W, H);
    const fx = X(F.x0), fy = Y(F.z0), fw = (F.x1 - F.x0) * s, fh = (F.z1 - F.z0) * s, cr = Math.min(fw, fh, 6 * s) * 0.5;
    c.beginPath(); c.moveTo(fx + cr, fy); c.arcTo(fx + fw, fy, fx + fw, fy + fh, cr); c.arcTo(fx + fw, fy + fh, fx, fy + fh, cr); c.arcTo(fx, fy + fh, fx, fy, cr); c.arcTo(fx, fy, fx + fw, fy, cr); c.closePath(); c.clip();
    c.fillStyle = COL.ground; c.fillRect(fx, fy, fw, fh);
    A.districts.forEach(d => { c.fillStyle = rgba(d.color, o.mini ? 0.32 : 0.45); c.fillRect(X(d.x0), Y(d.z0), (d.x1 - d.x0) * s, (d.z1 - d.z0) * s); });
    // площади: плитка кольцами
    A.squares.forEach(q => {
      c.fillStyle = COL.plaza; c.beginPath(); c.arc(X(q.cx), Y(q.cz), q.cr * s, 0, TAU); c.fill();
      if (!o.mini) { c.strokeStyle = COL.plazaRing; c.lineWidth = Math.max(1, 0.12 * s); for (let r = q.cr - 2.2; r > 4; r -= 2.6) { c.beginPath(); c.arc(X(q.cx), Y(q.cz), r * s, 0, TAU); c.stroke(); } }
    });
    const R = A.raster(o.cell || 0.5);
    if (R && R.cv) { c.imageSmoothingEnabled = true; try { c.imageSmoothingQuality = 'high'; } catch (e) { /* старый браузер */ } c.drawImage(R.cv, X(R.x0), Y(R.z0), R.nx * R.cell * s, R.nz * R.cell * s); }
    // волны на реке
    if (o.waves) {
      c.strokeStyle = COL.waterLine; c.lineWidth = Math.max(1, 0.18 * s); c.lineCap = 'round';
      let sd = 3; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (let i = 0; i < 140; i++) {
        const x = F.x0 + rn() * (F.x1 - F.x0), z = F.z0 + rn() * (F.z1 - F.z0); if (!A.water(x, z) || !A.water(x + 2, z)) continue;
        const w = (1.4 + rn() * 1.6) * s; c.beginPath(); c.moveTo(X(x), Y(z)); c.quadraticCurveTo(X(x) + w / 2, Y(z) - 0.5 * s, X(x) + w, Y(z)); c.stroke();
      }
    }
    // фонтан
    if (A.fountain && typeof A.fountain.x === 'number') {
      const fr = (A.fountain.r || 3) * s;
      c.fillStyle = '#FFFDF9'; c.beginPath(); c.arc(X(A.fountain.x), Y(A.fountain.z), fr, 0, TAU); c.fill();
      c.fillStyle = 'rgb(176,214,238)'; c.beginPath(); c.arc(X(A.fountain.x), Y(A.fountain.z), fr * 0.8, 0, TAU); c.fill();
      c.fillStyle = '#FFFDF9'; c.beginPath(); c.arc(X(A.fountain.x), Y(A.fountain.z), fr * 0.28, 0, TAU); c.fill();
    }
    // деревья на газонах
    if (o.trees) {
      let sd = 11; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const step = 3.3, tr = Math.max(1.6, 1.05 * s);
      for (let z = F.z0 + 1; z < F.z1; z += step) for (let x = F.x0 + 1; x < F.x1; x += step) {
        const jx = x + (rn() - 0.5) * 1.6, jz = z + (rn() - 0.5) * 1.6, k = rn();
        if (k < 0.18 || !A.lawn(jx, jz) || A.pathAt(jx, jz) || A.pathAt(jx + 0.9, jz) || A.pathAt(jx - 0.9, jz) || A.drivable(jx, jz)) continue;
        const col = COL.tree[Math.floor(rn() * COL.tree.length)];
        c.fillStyle = 'rgba(80,90,60,.16)'; c.beginPath(); c.arc(X(jx) + tr * 0.25, Y(jz) + tr * 0.35, tr, 0, TAU); c.fill();
        c.fillStyle = col; c.beginPath(); c.arc(X(jx), Y(jz), tr, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(X(jx) - tr * 0.3, Y(jz) - tr * 0.3, tr * 0.42, 0, TAU); c.fill();
      }
    }
    // дома: «вид чуть сверху» — тёмная южная стенка, сверху крыша
    const wall = Math.max(1, 0.7 * s);
    A.blocks.forEach(b => {
      const x = X(b.x0), y = Y(b.z0), w = (b.x1 - b.x0) * s, h = (b.z1 - b.z0) * s;
      if (x > W || y > H || x + w < 0 || y + h + wall < 0) return;
      c.fillStyle = shade(b.col, 0.84); c.fillRect(x, y + wall, w, h);
      c.fillStyle = b.col; c.fillRect(x, y, w, h);
      if (!o.mini && w > 3 && h > 3) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 1, y + 1, w - 2, Math.max(1, h * 0.18)); }
    });
    // ориентиры
    A.landmarks.forEach(m => { if (m.kind === 'clock') { const r = Math.max(3, 1.9 * s); c.save(); c.translate(X(m.x), Y(m.z)); c.fillStyle = '#B9475F'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); glyph(c, 'clock', r, '#FFFDF9', '#B9475F'); c.restore(); } });
    // районы «скоро»: серая штриховка
    A.districts.forEach(d => {
      if (!d.soon) return;
      const x = X(d.x0), y = Y(d.z0), w = (d.x1 - d.x0) * s, h = (d.z1 - d.z0) * s;
      c.fillStyle = 'rgba(200,196,210,.55)'; c.fillRect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, 0.6 * s);
      for (let t = -h; t < w; t += 3.2 * s) { c.beginPath(); c.moveTo(x + t, y + h); c.lineTo(x + t + h, y); c.stroke(); }
      c.restore();
    });
    // край карты тает в «тумане»
    const fade = Math.min(7 * s, fw * 0.12, fh * 0.12), P = COL.paper;
    [[fx, fy, fx + fade, fy, fx, fy, fade, fh], [fx + fw, fy, fx + fw - fade, fy, fx + fw - fade, fy, fade, fh], [fx, fy, fx, fy + fade, fx, fy, fw, fade], [fx, fy + fh, fx, fy + fh - fade, fx, fy + fh - fade, fw, fade]].forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
      const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, rgba(P, 0.95)); g.addColorStop(1, rgba(P, 0)); c.fillStyle = g; c.fillRect(rx, ry, rw, rh);
    });
    c.restore();
  }

  /* ---------- точки большой карты ---------- */
  function placeLine(id) { try { const p = window.Town && Town.get ? Town.get(id) : null; return p ? p.motto || '' : ''; } catch (e) { return ''; } }
  function shopLine(id) { const g = (WORLD.INTERIORS || {})[id]; if (!g) return ''; const h = g.host || {}; return h.name ? (h.emoji ? h.emoji + ' ' : '') + h.name : (g.front && g.front.sub) || ''; }
  function collectPois(o, A, doors) {
    const out = [], seen = new Set(), L = A.L;
    const raw = typeof o.pois === 'function' ? safe(o.pois) : o.pois || L.pois;
    const doorOf = id => doors.find(d => d.id === id) || doors.find(d => d.bkey === id) || null;
    const norm = (p, id, door) => {
      const kind = KINDS[p.kind] ? p.kind : 'place', d = door || null;
      const x = d ? d.ax : p.x, z = d ? d.az : p.z;
      const label = p.label || (d && d.label) || KINDS[kind].name;
      const line = p.line || p.desc || (kind === 'shop' ? shopLine(d ? d.id : id) : kind === 'place' || kind === 'mission' ? placeLine(d ? d.id : id) : '') || LINES[kind] || '';
      return { id, kind, x, z, label, line, icon: p.icon || '', door: d, src: p };
    };
    (Array.isArray(raw) ? raw : []).forEach(p => {
      if (!p || typeof p.x !== 'number' || typeof p.z !== 'number') return;
      const id = String(p.id || p.kind + ':' + p.x.toFixed(1) + ',' + p.z.toFixed(1)); if (seen.has(id)) return; seen.add(id);
      const d = doorOf(p.door || p.id);
      out.push(norm(p, id, d && Math.hypot(d.ax - p.x, d.az - p.z) < 12 ? d : null));
    });
    if (o.onlyPois) return out;   // 2D-город: только переданные точки
    doors.forEach(d => {
      if (d.kind === 'filler' || !d.id || seen.has(d.id) || /^f\d+$/.test(d.id)) return;
      if (out.some(p => Math.hypot(p.x - d.ax, p.z - d.az) < 2.5)) return;
      seen.add(d.id);
      out.push(norm({ id: d.id, kind: d.kind === 'story' ? 'mission' : d.kind === 'generic' ? 'shop' : 'place', x: d.ax, z: d.az, label: d.label || d.short }, d.id, d));
    });
    // площадь, парк, набережная — если раскладка не дала своих (планировка волны 2)
    const has = k => out.some(p => p.kind === k);
    if (!has('square') && A.fountain && typeof A.fountain.x === 'number') out.push(norm({ kind: 'square', x: A.fountain.x, z: A.fountain.z, label: 'Площадь Солнца' }, 'square'));
    if (!has('park') && L.outer && L.oct && A.B) out.push(norm({ kind: 'park', x: -43.2, z: 36, label: 'Парк «Каштановый»' }, 'park'));
    if (!has('view') && L.outer && A.B) out.push(norm({ kind: 'view', x: 30, z: Math.min(A.B.z1 - 2.2, L.outer.z1 + 4.2), label: 'Набережная', line: 'Река, фонари и лавочки у воды.' }, 'embank'));
    return out;
  }

  /* ---------- окружение: опции или живой город ---------- */
  function makeEnv(o) {
    const W = () => live().w, S = liveS;
    const env = {
      layout: () => o.layout || WORLD.LAYOUT || null,
      colliders: () => o.colliders || (W() && W().MAP && W().MAP.colliders) || null,
      doorsSrc: () => o.doors || (W() && W().doors) || null,
      hero() {
        if (o.getHero) return safe(o.getHero);
        if (o.getHero === null) return null;
        const s = S(), w = W(); if (!s || !s.active) return null;
        if (s.mode === 'drive' && w && w.car && w.car.S) return { x: w.car.S.x, z: w.car.S.z, ang: w.car.S.ry, mode: 'drive' };
        return { x: s.px, z: s.pz, ang: s.ang, mode: s.mode };
      },
      yaw() { if (o.getCamYaw) return safe(o.getCamYaw); if (o.getCamYaw === null) return null; const s = S(); return s ? s.yaw : null; },
      target() {
        if (o.getTarget) return safe(o.getTarget);
        if (o.getTarget === null) return null;
        const w = W(); const m = w && w.markers && w.markers.main ? safe(w.markers.main) : null;
        if (m && m.door) return { x: m.door.ax, z: m.door.az, label: (m.spec && m.spec.label) || m.door.short || '', door: m.door.id };
        return null;
      },
      markers() {
        if (o.getMarkers) return safe(o.getMarkers) || [];
        const w = W(); const l = w && w.markers && w.markers.all ? safe(w.markers.all) || [] : [];
        return l.filter(m => m.spec && (m.spec.style || 'case') !== 'case').map(m => ({ x: m.door.ax, z: m.door.az, style: m.spec.style, label: m.spec.label || m.door.short || '', sub: m.spec.sub || '', door: m.door.id }));
      },
      vehicles() {
        if (o.getVehicles) return safe(o.getVehicles) || [];
        const w = W(), out = []; if (!w) return out;
        if (w.car && w.car.root && w.car.root.visible && w.car.S) out.push({ kind: 'car', x: w.car.S.x, z: w.car.S.z, ry: w.car.S.ry, covered: !!(w.cover && w.cover.visible) });
        const b = w.bike; if (b && b.pos && typeof b.pos.x === 'number') out.push({ kind: 'bike', x: b.pos.x, z: b.pos.z, ry: b.ry || 0 });
        return out;
      },
      busy() {
        if (o.isBusy) return !!safe(o.isBusy);
        if (document.querySelector('#layer .dlg-wrap, #layer .modal:not(.wm-sheet), .img-full')) return true;
        const s = S(); return !!(s && (s.busy || s.anim || s.spotBusy || s.pkBusy || s.benching || s.paused || !s.active));
      },
      edgeOpen: () => (o.edgeOpen ? !!safe(o.edgeOpen) : !!(o.layout || WORLD.LAYOUT || {}).edgeOpen),
      districtOpen: id => (o.districtOpen ? safe(o.districtOpen, id) !== false : true),
    };
    return env;
  }
  // правила «Поехать сюда»: строка замка у закрытой или будущей двери дела
  function defaultCheck(env, A, poi) {
    const d = A.districtAt(poi.x, poi.z);
    if (d && (d.soon || !env.districtOpen(d.id))) return { ok: false, text: d.soonText || 'Этот район пока на ремонте. Скоро откроется.' };
    if (poi.src && poi.src.locked) return { ok: false, text: poi.src.lockText || 'Пока закрыто.' };
    const s = liveS(), w = live().w;
    const wd = poi.door && w && w.doors && w.doors.get ? w.doors.get(poi.door.id) : null;
    if (s && s.dbg && typeof s.dbg.doorState === 'function' && wd) {
      const st = safe(s.dbg.doorState, wd) || {};
      if (wd.kind === 'story' && !st.open) return { ok: false, text: st.text || 'Пока закрыто.' };
      if (!st.open && st.text) return { ok: true, note: st.text };
      return { ok: true };
    }
    // без города: таблица дел (дверь дела будущей серии или ещё не открытая)
    const M = window.Missions;
    if (poi.kind === 'mission' && M && M.list && M.state) {
      const id = poi.door ? poi.door.id : poi.src && (poi.src.door || poi.id);
      const defs = (safe(M.list) || []).filter(m => m.door === id);
      if (defs.length && !defs.some(m => { const st = safe(M.state, m.id); return st === 'open' || st === 'done'; })) return { ok: false, text: (M.T && M.T.FIRST) || 'Закрыто. Сначала — сегодняшнее дело.' };
    }
    return { ok: true };
  }
  // куда поставить героиню: у двери — как после комнаты (лицом к камере); иначе ближайшее свободное место у точки
  function spotOf(A, poi) {
    const d = poi.door;
    if (d) { const ang = Math.atan2(d.nx, d.nz); return { x: d.ax + d.nx * 0.55, z: d.az + d.nz * 0.55, ang, yaw: ang + PI, door: d.id }; }
    let x = poi.x, z = poi.z, found = A.free(x, z, 0.45) && !A.drivable(x, z);
    if (!found) {
      outer: for (let r = 0.75; r <= 14; r += 0.75) {
        const n = Math.max(8, Math.round(r * 5));
        for (let i = 0; i < n; i++) {   // сначала с юга (к камере), потом по кругу
          const a = PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * TAU / n, px = poi.x + Math.cos(a) * r, pz = poi.z + Math.sin(a) * r;
          if (A.free(px, pz, 0.45) && !A.drivable(px, pz)) { const k = r < 1.2 ? 0 : 1.6; const ex = px + Math.cos(a) * k, ez = pz + Math.sin(a) * k; if (k && A.free(ex, ez, 0.45) && !A.drivable(ex, ez)) { x = ex; z = ez; } else { x = px; z = pz; } found = true; break outer; }
        }
      }
    }
    if (poi.src && typeof poi.src.ry === 'number') return { x, z, ang: poi.src.ry, yaw: poi.src.ry + PI };
    const far = Math.hypot(poi.x - x, poi.z - z) > 0.8;
    const yaw = far ? Math.atan2(poi.x - x, poi.z - z) : PI;   // камера смотрит на место, героиня — в камеру
    return { x, z, ang: yaw + PI, yaw };
  }
  // перенос по умолчанию: через город (api.travelTo, если интегратор добавил; иначе — placeAt сессии)
  async function defaultTravel(poi, spot) {
    const s = liveS(), w = live().w;
    if (!s || !w) throw new Error('no world');
    if (s.api && typeof s.api.travelTo === 'function') return s.api.travelTo(spot, poi);
    const t0 = now(), within = (pr, ms) => Promise.race([Promise.resolve(pr).catch(() => null), sleep(ms)]);
    // машина и велосипед остаются там, где их оставили (их видно на карте); героиня выходит пешком
    if (s.mode === 'ride' && w.bike && typeof w.bike.dismount === 'function') await within(w.bike.dismount(), 1500);
    if (s.mode === 'drive' && s.dbg && s.dbg.exitCar) { s.dbg.exitCar(); while ((s.mode === 'drive' || s.anim) && now() - t0 < 1500) await sleep(30); }
    if (s.anim && typeof s.anim.done === 'function') { const a = s.anim; try { a.done(); } catch (e) { s.anim = null; } }
    if (s.sitting && !s.sitting.car) { s.sitting = null; if (w.hero && w.hero.body) w.hero.body.rotation.x = 0; }
    s.moveTo = null;
    s.dbg.placeAt(spot.x, spot.z, spot.ang, spot.yaw);
  }

  /* ---------- облака: мягкий переход «Поехать сюда» ---------- */
  async function cloudsTravel(host, label, mid) {
    ensureCss();
    const el = document.createElement('div'); el.className = 'wm-cloud';
    const puffs = [[-6, 4, 'l'], [-12, 30, 'l'], [-4, 58, 'l'], [-10, 82, 'l'], [52, 10, 'r'], [58, 36, 'r'], [48, 62, 'r'], [56, 86, 'r']];
    el.innerHTML = '<div class="wm-fog"></div>' + puffs.map(([x, y, s], i) => `<div class="wm-puff ${s}" style="left:${x}%;top:${y}%;transition-delay:${(i % 4) * 40}ms"></div>`).join('') +
      `<div class="wm-dest"><small>едем…</small>${esc(label || '')}</div>`;
    (host || document.body).appendChild(el);
    sfx('flutter'); haptic('light');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.classList.add('in');
    await sleep(560);
    let err = null;
    try { await Promise.race([Promise.resolve(mid()), sleep(6000)]); } catch (e) { err = e; }
    await sleep(260);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.classList.remove('in');
    await sleep(640);
    el.remove();
    if (err) throw err;
  }

  /* =====================================================================
     БОЛЬШАЯ КАРТА (лист): рисунок города, легенда, список мест, карточка точки и «Поехать сюда»
     ===================================================================== */
  function openSheet(o, env, getA, hooks = {}) {
    ensureCss();
    env = env || makeEnv(o);
    const A = getA ? getA() : analyze(env.layout(), env.colliders(), doorListOf(env.doorsSrc()), o);
    const doors = doorListOf(env.doorsSrc());
    const pois = collectPois(o, A, doors);
    const hero = env.hero();
    const target = env.target();
    const marks = env.markers();
    const vehicles = env.vehicles();
    const edgeOn = env.edgeOpen() && A.edge && typeof A.edge.x === 'number';
    if (edgeOn && !pois.some(p => p.kind === 'edge')) pois.push({ id: 'edge', kind: 'edge', x: A.edge.x, z: A.edge.z, label: A.edge.label || A.edge.labelNeutral || KINDS.edge.name, line: LINES.edge, door: null, src: A.edge });
    const showPoi = p => p.kind !== 'edge' || edgeOn;
    // машина и велосипед — тоже точки (поехать к ним)
    vehicles.forEach(v => { if (typeof v.x === 'number') pois.push({ id: '@' + v.kind, kind: v.kind === 'bike' ? 'bike' : 'car', x: v.x, z: v.z, label: KINDS[v.kind === 'bike' ? 'bike' : 'car'].name, line: v.covered ? 'Под чехлом с бантом. Ждёт своей серии.' : LINES[v.kind === 'bike' ? 'bike' : 'car'], door: null, src: { ry: v.ry }, vehicle: v }); });
    const check = p => {
      let r = o.checkTravel ? safe(o.checkTravel, p) : defaultCheck(env, A, p);
      if (r === true || r == null) r = { ok: true }; else if (r === false) r = { ok: false, text: 'Пока закрыто.' }; else if (typeof r === 'string') r = { ok: false, text: r };
      return r;
    };
    const info = new Map(); pois.forEach(p => info.set(p.id, check(p)));
    const isTarget = p => !!target && ((p.door && target.door && (p.door.id === target.door || p.door.bkey === target.door)) || Math.hypot(p.x - target.x, p.z - target.z) < 1.2);
    const stateOf = p => (isTarget(p) ? 'target' : !info.get(p.id).ok ? 'lock' : marks.some(m => m.door && p.door && m.door === p.door.id && m.style === 'soon') ? 'soon' : 'ok');
    // дом из дела, куда просто можно зайти (дело раскрыто, прогулка) — на карте как место прогулки
    const kindOf = p => (p.kind === 'mission' && stateOf(p) === 'ok' ? 'place' : p.kind);
    const dist = p => (hero ? Math.hypot(p.x - hero.x, p.z - hero.z) : null);
    const HERE = 3.5;
    const fmtD = m => (m == null ? '' : m < HERE ? 'ты здесь' : (m < 60 ? Math.round(m) : Math.round(m / 5) * 5) + ' м');
    const fmtT = m => { const t = m / 3.4; return t < 60 ? `пешком ~${Math.max(5, Math.round(t / 5) * 5)} с` : `пешком ~${Math.round(t / 60)} мин`; };

    const layer = o.layer || document.querySelector('#layer') || document.querySelector('#app') || document.body;
    const m = document.createElement('div'); m.className = 'modal wm-sheet';
    const kindsHere = [...new Set(pois.filter(showPoi).map(p => kindOf(p)))].filter(k => KINDS[k]);
    const order = ['mission', 'place', 'shop', 'square', 'park', 'view', 'dogpark', 'bikes', 'garage', 'edge', 'car', 'bike'];
    kindsHere.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const pref = lsGet();
    // волна 4B: вкладки «Город» / «Кубачи» / «Обзор» (если подключены модули гор; o.tabs === false — без них)
    const named = mtnNamed(o), tabsOn = o.tabs !== false && mtnOk();
    const TT = { city: o.title || 'Карта города', mtn: villageTitle(named), ov: 'Дорога наверх' };
    let tabNow = tabsOn && (o.tab === 'mtn' || o.tab === 'ov') ? o.tab : 'city';
    m.innerHTML = `<div class="wm-card" role="dialog" aria-label="Карта города">
      <div class="wm-head"><div class="wm-title">${esc(TT[tabNow])}</div><button class="wm-x" type="button" aria-label="Закрыть">✕</button></div>
      ${tabsOn ? `<div class="wm-tabs" role="tablist"><button type="button" class="wm-tab" data-tab="city">Город</button><button type="button" class="wm-tab" data-tab="mtn">${esc(mtnTab(named))}</button><button type="button" class="wm-tab" data-tab="ov">Обзор</button></div>` : ''}
      <div class="wm-pane" data-tab="city">
      <div class="wm-mapbox"><canvas class="wm-canvas"></canvas><div class="wm-north">С</div>
        <div class="wm-tools"><button type="button" data-z="in" aria-label="Ближе">+</button><button type="button" data-z="out" aria-label="Дальше">−</button>${hero ? '<button type="button" class="me" data-z="me" aria-label="Где я">я</button>' : ''}</div></div>
      <div class="wm-legend">${hero ? `<span class="wm-chip"><img alt="" src="${heroURL()}">ты</span>` : ''}${kindsHere.map(k => `<span class="wm-chip"><img alt="" src="${iconURL(k)}">${esc(KINDS[k].name)}</span>`).join('')}</div>
      <div class="wm-list"></div>
      ${o.miniPref ? `<div class="wm-pref">Мини-карта: <button type="button" data-rot="camera" class="${pref.rot !== 'north' ? 'on' : ''}">по камере</button><button type="button" data-rot="north" class="${pref.rot === 'north' ? 'on' : ''}">север сверху</button></div>` : ''}
      </div>${tabsOn ? '<div class="wm-pane hidden" data-tab="mtn"></div><div class="wm-pane hidden" data-tab="ov"></div>' : ''}
      <div class="wm-poi hidden"></div></div>`;
    layer.appendChild(m);
    const $ = s => m.querySelector(s);
    const cv = $('.wm-canvas'), box = $('.wm-mapbox'), list = $('.wm-list'), card = $('.wm-poi');
    const panes = {};
    if (!A.blocks.length && !A.districts.length && !A.L.drivable) box.style.display = 'none';

    // список мест по группам
    const groups = {};
    pois.filter(showPoi).forEach(p => { const g = (KINDS[kindOf(p)] || KINDS.place).group; (groups[g] = groups[g] || []).push(p); });
    const gOrder = ['Дело', 'Места прогулки', 'Лавки', 'Прогулки и виды', 'Транспорт'];
    list.innerHTML = gOrder.filter(g => groups[g]).map(g => `<div class="wm-group">${esc(g)}</div>` + groups[g].sort((a, b) => (stateOf(b) === 'target') - (stateOf(a) === 'target') || (dist(a) || 0) - (dist(b) || 0)).map(p => {
      const st = stateOf(p), ic = st === 'target' ? iconURL('mission', { drop: true }) : iconURL(kindOf(p), { dim: st === 'lock', g: st === 'lock' ? 'lock' : undefined });
      const sub = st === 'target' ? 'Сегодняшнее дело' : st === 'lock' ? info.get(p.id).text : p.line;
      return `<button type="button" class="wm-row${st === 'lock' ? ' lock' : ''}" data-id="${esc(p.id)}"><img alt="" src="${ic}"><span class="n">${esc(p.label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="d">${esc(fmtD(dist(p)))}</span></button>`;
    }).join('')).join('');

    // вид карты: центр (vx, vz) и масштаб vs (css px на метр)
    const F = A.F, fw = F.x1 - F.x0, fh = F.z1 - F.z0;
    let bw = 0, bh = 0, fit = 1, vs = 0, pulseT = 0, vx = (F.x0 + F.x1) / 2, vz = (F.z0 + F.z1) / 2, D = DPR(), base = null, sel = null, hits = [], raf = 0, closed = false;
    function layout() {
      const cardW = m.querySelector('.wm-card').clientWidth || 360;
      bw = Math.max(200, cardW - 20);
      const maxH = Math.max(200, Math.min((m.clientHeight || 700) * 0.46, 420));
      bh = Math.round(clamp(bw * fh / fw + 4, 200, maxH));
      box.style.height = bh + 'px';
      D = DPR(); cv.width = Math.round(bw * D); cv.height = Math.round(bh * D);
      fit = Math.min(bw / fw, bh / fh);
      // первый раз: весь город; большой город — крупнее, вокруг героини
      if (!vs) { vs = Math.max(fit, Math.min(fit * 3, 2.6)); if (hero && vs > fit * 1.01) { vx = hero.x; vz = hero.z; } }
      vs = clamp(vs, fit, fit * 6);
      // рисунок один раз (крупнее, чем нужно, — для приближения); дорогое — растр — уже посчитан
      const bs = clamp(fit * D * 2.2, 2, 1600 / Math.max(fw, fh));   // не больше 1600 px по длинной стороне (≈ 7 МБ), рисуется при открытии
      const bc = cnv(fw * bs, fh * bs);
      paint(bc.getContext('2d'), A, bs, F.x0, F.z0, bc.width, bc.height, { cell: 0.25, trees: true, waves: true });
      base = { cv: bc, s: bs };
    }
    const clampView = () => {
      vs = clamp(vs, fit, fit * 6);
      const hw = bw / 2 / vs, hh = bh / 2 / vs;
      vx = fw <= 2 * hw ? (F.x0 + F.x1) / 2 : clamp(vx, F.x0 + hw, F.x1 - hw);
      vz = fh <= 2 * hh ? (F.z0 + F.z1) / 2 : clamp(vz, F.z0 + hh, F.z1 - hh);
    };
    const toS = (x, z) => [(x - vx) * vs + bw / 2, (z - vz) * vs + bh / 2];
    const toW = (sx, sy) => [(sx - bw / 2) / vs + vx, (sy - bh / 2) / vs + vz];
    const req = () => { if (!raf && !closed) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    function draw() {
      const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = COL.paper; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(D, 0, 0, D, 0, 0);
      const [bx, by] = toS(F.x0, F.z0);
      c.imageSmoothingEnabled = true; c.drawImage(base.cv, bx, by, fw * vs, fh * vs);
      hits = [];
      // подписи районов
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      A.districts.forEach(d => {
        if (!d.name) return;
        // подпись — в середине видимой части района (район за краем — без подписи)
        const [w0x, w0z] = toW(0, 0), [w1x, w1z] = toW(bw, bh);
        const vx0 = Math.max(d.x0, w0x), vx1 = Math.min(d.x1, w1x), vz0 = Math.max(d.z0, w0z), vz1 = Math.min(d.z1, w1z);
        if (vx1 - vx0 < 26 / vs || vz1 - vz0 < 12 / vs) return;
        const inView = (x, z) => x > vx0 + 6 / vs && x < vx1 - 6 / vs && z > vz0 + 6 / vs && z < vz1 - 6 / vs;
        const cx0 = num(d.lx, (d.x0 + d.x1) / 2), cz0 = num(d.lz, (d.z0 + d.z1) / 2);
        const [lx, ly] = inView(cx0, cz0) ? toS(cx0, cz0) : toS((vx0 + vx1) / 2, (vz0 + vz1) / 2);
        const soon = d.soon || !env.districtOpen(d.id), t = d.name.toUpperCase();
        const vert = (d.z1 - d.z0) > (d.x1 - d.x0) * 1.6 && d.lx === undefined;
        const avail = Math.max(30, (vert ? d.z1 - d.z0 : d.x1 - d.x0) * vs - 10);
        // подпись влезает в район: меньше шрифт, иначе две строки
        let fs = clamp(9.5 + (vs - fit) * 0.8, 10, 14), lines = [t];
        c.font = `700 ${fs}px 'Comfortaa', 'Nunito', sans-serif`;
        if (c.measureText(t).width > avail) { fs = Math.max(8.5, fs * avail / c.measureText(t).width); c.font = `700 ${fs}px 'Comfortaa', 'Nunito', sans-serif`; }
        if (c.measureText(t).width > avail && t.includes(' ')) { const sp = t.split(' '), h = Math.ceil(sp.length / 2); lines = [sp.slice(0, h).join(' '), sp.slice(h).join(' ')]; }
        if (soon) lines.push('· скоро ·');
        const lw = Math.max(...lines.map(q => c.measureText(q).width)), lh = fs * 1.15;
        let px = lx, py = ly;
        if (!vert) { px = clamp(lx, lw / 2 + 4, bw - lw / 2 - 4); }
        c.save(); c.translate(px, py); if (vert) c.rotate(-PI / 2);
        c.lineWidth = 3.5; c.strokeStyle = 'rgba(255,253,249,.92)'; c.fillStyle = soon ? '#8E89A6' : shade(d.color || '#C9A0B0', 0.55);
        lines.forEach((q, i) => { const y = (i - (lines.length - 1) / 2) * lh; c.strokeText(q, 0, y); c.fillText(q, 0, y); });
        c.restore();
      });
      // точки
      const r = clamp(6.8 + (vs - fit) * 0.9, 6.8, 12);
      const drawn = pois.filter(showPoi).map(p => ({ p, st: stateOf(p), s: toS(p.x, p.z) }));
      drawn.sort((a, b) => (a.st === 'target') - (b.st === 'target') || (a.p.id === sel) - (b.p.id === sel) || a.s[1] - b.s[1]);
      marks.forEach(mk => { if (mk.style !== 'soon' || pois.some(p => p.door && p.door.id === mk.door)) return; const [sx, sy] = toS(mk.x, mk.z); pin(c, 'place', sx, sy, r * 0.8, { dim: true, g: 'lock' }); });
      drawn.forEach(({ p, st, s: [sx, sy] }) => {
        if (sx < -20 || sy < -20 || sx > bw + 20 || sy > bh + 20) return;
        if (st === 'target') return;
        if (p.vehicle) { pin(c, p.kind, sx, sy, r * 0.95, { col: p.vehicle.covered ? '#C9B8C2' : undefined }); }
        else pin(c, kindOf(p), sx, sy, r, { dim: st === 'lock', g: st === 'lock' ? 'lock' : st === 'soon' ? 'lock' : undefined });
        hits.push({ id: p.id, x: sx, y: sy, r: r + 8 });
      });
      // текущее дело: капля с лупой и пульс
      const tp = drawn.find(d => d.st === 'target');
      const tx = tp ? tp.s : target ? toS(target.x, target.z) : null;
      if (tx) {
        const k = (now() % 1400) / 1400;
        c.strokeStyle = rgba('#F2557A', 0.6 * (1 - k)); c.lineWidth = 2.5; c.beginPath(); c.arc(tx[0], tx[1], 6 + k * 14, 0, TAU); c.stroke();
        dropPin(c, tx[0], tx[1], r * 1.05, KINDS.mission.col, 'case');
        hits.push({ id: tp ? tp.p.id : '@target', x: tx[0], y: tx[1] - r * 1.4, r: r + 12 });
      }
      // героиня: обзор камеры, стрелка, «ты здесь»
      if (hero) {
        const [hx, hy] = toS(hero.x, hero.z), yaw = env.yaw();
        if (typeof yaw === 'number') { const a = Math.atan2(Math.cos(yaw), Math.sin(yaw)); const g = c.createRadialGradient(hx, hy, 2, hx, hy, 46); g.addColorStop(0, 'rgba(255,214,120,.55)'); g.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(hx, hy); c.arc(hx, hy, 46, a - 0.5, a + 0.5); c.closePath(); c.fill(); }
        heroArrow(c, hx, hy, 8.5, Math.atan2(Math.cos(hero.ang || 0), Math.sin(hero.ang || 0)));
        hits.push({ id: '@hero', x: hx, y: hy, r: 16 });
      }
      // выбранная точка: подпись над значком
      const sp = sel && pois.find(p => p.id === sel);
      if (sp) {
        const [sx, sy] = toS(sp.x, sp.z), lift = isTarget(sp) ? r * 2.7 : r + 4;
        c.font = `800 12.5px 'Nunito', sans-serif`; const t = sp.label, tw = Math.min(220, c.measureText(t).width + 16);
        const lx = clamp(sx, tw / 2 + 4, bw - tw / 2 - 4), ly = Math.max(14, sy - lift - 12);
        c.fillStyle = 'rgba(58,46,63,.18)'; rrect(c, lx - tw / 2, ly - 11 + 2, tw, 22, 11); c.fill();
        c.fillStyle = '#FFFFFF'; rrect(c, lx - tw / 2, ly - 11, tw, 22, 11); c.fill();
        c.fillStyle = '#3A2E3F'; c.textAlign = 'center'; c.fillText(t, lx, ly + 0.5, 210);
        c.strokeStyle = '#C2405B'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, r + 3.5, 0, TAU); c.stroke();
      }
      if (tx && !pulseT && !closed) pulseT = setTimeout(() => { pulseT = 0; req(); }, 66);   // пульс метки дела, ~15 кадров в секунду
    }

    // карточка точки
    function showCard(p) {
      sel = p ? p.id : null;
      m.querySelectorAll('.wm-row').forEach(b => b.classList.toggle('on', !!p && b.dataset.id === p.id));
      list.classList.toggle('pad', !!p);
      if (!p) { card.classList.add('hidden'); req(); return; }
      const st = p.id === '@hero' ? 'hero' : stateOf(p), inf = info.get(p.id) || { ok: true }, d = dist(p);
      // «уже здесь» — у точки прибытия (у площади это шаг от фонтана, а не его середина)
      const sp0 = hero && st !== 'hero' ? spotOf(A, p) : null, atSpot = !!sp0 && Math.hypot(sp0.x - hero.x, sp0.z - hero.z) < 1.5;
      const ic = p.id === '@hero' ? heroURL() : st === 'target' ? iconURL('mission', { drop: true }) : iconURL(kindOf(p), { dim: st === 'lock', g: st === 'lock' ? 'lock' : undefined });
      const line = st === 'target' ? 'Сегодняшнее дело — здесь, под лучом.' : p.line;
      let action = '';
      if (st === 'hero') action = '<div class="wm-note here">Ты здесь.</div>';
      else if (!inf.ok) action = `<div class="wm-note lock">${esc(inf.text || 'Пока закрыто.')}</div>`;
      else if ((d != null && d < HERE) || atSpot) action = '<div class="wm-note here">Ты уже здесь.</div>';
      else action = (inf.note ? `<div class="wm-note">${esc(inf.note)}</div>` : '') + `<button type="button" class="wm-go">${esc(o.travelLabel || 'Поехать сюда')}</button>`;
      // волна 4B: карта открыта в горах — к точке города только через «Вернуться в город»
      const backCity = !!o.here && st !== 'hero';
      if (backCity) action = (hooks.travelRegion || typeof o.onTravelRegion === 'function') ? '<button type="button" class="wm-go">Вернуться в город</button>' : '<div class="wm-note">Это в городе — внизу, под горами.</div>';
      card.innerHTML = `<button type="button" class="wm-poi-x" aria-label="Закрыть">✕</button><div class="wm-poi-h"><img alt="" src="${ic}"><div><div class="wm-poi-n">${esc(p.label)}</div>${line ? `<div class="wm-poi-l">${esc(line)}</div>` : ''}${d != null && st !== 'hero' && d >= HERE ? `<div class="wm-poi-d">${esc(fmtD(d))}${inf.ok ? ' · ' + esc(fmtT(d)) : ''}</div>` : ''}</div></div>${action}`;
      card.classList.remove('hidden');
      card.querySelector('.wm-poi-x').onclick = e => { e.stopPropagation(); showCard(null); };
      const go = card.querySelector('.wm-go');
      if (go) go.onclick = e => { e.stopPropagation(); haptic('medium'); if (backCity) goRegion({ o, hooks, api }, { rid: 'city', id: 'city', kind: 'city', label: 'Город', x: 0, z: 0 }); else api.go(p); };
      if (!inf.ok) haptic('light');
      req();
    }
    const select = (id, pan) => {
      const p = id === '@hero' ? (hero ? { id: '@hero', kind: 'place', x: hero.x, z: hero.z, label: 'Это ты', line: '' } : null) : id === '@target' ? null : pois.find(q => q.id === id);
      if (!p) { showCard(null); return; }
      if (pan) { const [sx, sy] = toS(p.x, p.z); if (sx < 30 || sy < 30 || sx > bw - 30 || sy > bh - 30) { vx = p.x; vz = p.z; clampView(); } }
      showCard(p); sfx('tap');
    };

    // жесты на карте: тап, перетаскивание, щипок, двойной тап, колесо
    const ptr = new Map(); let g0 = null, lastTap = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* старый браузер */ } const [x, y] = pos(e); ptr.set(e.pointerId, { x, y, x0: x, y0: y, t: now(), moved: false }); g0 = null; e.preventDefault(); });
    cv.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return; const [x, y] = pos(e);
      if (ptr.size === 1) { const dx = x - p.x, dy = y - p.y; if (Math.hypot(x - p.x0, y - p.y0) > 6) p.moved = true; if (p.moved) { vx -= dx / vs; vz -= dy / vs; clampView(); req(); } }
      else if (ptr.size === 2) {
        p.moved = true; const [a, b] = [...ptr.values()]; const pa = a === p ? [x, y] : [a.x, a.y], pb = b === p ? [x, y] : [b.x, b.y];
        const dd = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        if (!g0) g0 = { dd, vs, w: toW(mx, my) };
        vs = clamp(g0.vs * dd / Math.max(10, g0.dd), fit, fit * 6); vx = g0.w[0] - (mx - bw / 2) / vs; vz = g0.w[1] - (my - bh / 2) / vs; clampView(); req();
      }
      p.x = x; p.y = y;
    });
    const up = e => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (ptr.size === 0 && !p.moved && now() - p.t < 450) {
        const t = now();
        if (t - lastTap < 300) { zoomAt(p.x, p.y, 2); lastTap = 0; return; }
        lastTap = t; tapAt(p.x, p.y);
      }
      if (ptr.size < 2) g0 = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    function zoomAt(x, y, k) { const w0 = toW(x, y); vs = clamp(vs * k, fit, fit * 6); vx = w0[0] - (x - bw / 2) / vs; vz = w0[1] - (y - bh / 2) / vs; clampView(); req(); }
    function tapAt(x, y) {
      let best = null, bd = 1e9;
      hits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < Math.max(18, h.r) && d < bd) { bd = d; best = h; } });
      if (best) select(best.id); else if (sel) showCard(null);
    }
    m.querySelector('.wm-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return; e.stopPropagation(); haptic('select');
      if (b.dataset.z === 'in') zoomAt(bw / 2, bh / 2, 1.6); else if (b.dataset.z === 'out') zoomAt(bw / 2, bh / 2, 1 / 1.6);
      else if (hero) { vs = Math.max(vs, fit * 2.2); vx = hero.x; vz = hero.z; clampView(); req(); }
    });
    list.addEventListener('click', e => { const b = e.target.closest('.wm-row'); if (!b) return; haptic('light'); select(b.dataset.id, true); });
    m.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); lsSet({ rot: b.dataset.rot }); m.querySelectorAll('[data-rot]').forEach(x => x.classList.toggle('on', x === b)); if (hooks.onPref) hooks.onPref(b.dataset.rot); }));
    $('.wm-x').addEventListener('click', e => { e.stopPropagation(); api.close(); });
    m.addEventListener('click', e => { if (e.target === m) api.close(); });
    const onKey = e => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onKey);
    const onResize = () => { if (closed) return; layout(); clampView(); req(); };
    window.addEventListener('resize', onResize);

    const api = {
      el: m, pois, info,
      close(instant) {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(pulseT); base = null;
        Object.keys(panes).forEach(k => { if (panes[k] && panes[k].destroy) safe(panes[k].destroy); });
        if (instant) m.remove(); else { m.classList.add('out'); setTimeout(() => m.remove(), 210); }
        if (hooks.onClose) hooks.onClose();
      },
      select: id => select(id, true),
      go(p) {
        const inf = info.get(p.id) || { ok: true };
        if (!inf.ok) { showCard(p); return Promise.resolve(false); }
        if (hooks.travel) return hooks.travel(p, api);
        api.close();
        return Promise.resolve(o.onTravel ? o.onTravel(p, spotOf(A, p)) : null).then(() => true);
      },
      // для проверок: экранная точка значка (в css px окна)
      screenOf(id) { const p = id === '@hero' ? hero : pois.find(q => q.id === id); if (!p) return null; const r = cv.getBoundingClientRect(); const [sx, sy] = toS(p.x, p.z); const lift = p.id && isTarget(p) ? 14 : 0; return { x: r.left + sx, y: r.top + sy - lift, inside: sx >= 0 && sy >= 0 && sx <= bw && sy <= bh }; },
      view: () => ({ vx, vz, vs, fit, bw, bh }),
    };
    layout(); clampView(); draw();
    if (o.select) select(o.select, true);
    // вкладки гор и обзора (строятся при первом показе)
    const ctx = { o, env, m, card, named, hooks, api, cityList: list, showCityCard: p => showCard(p), closeCityCard: () => { if (sel) showCard(null); } };
    function showTab(t) {
      if (!tabsOn) return;
      tabNow = t;
      m.querySelectorAll('.wm-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      m.querySelectorAll('.wm-pane').forEach(pn => pn.classList.toggle('hidden', pn.dataset.tab !== t));
      $('.wm-title').textContent = TT[t];
      if (sel) showCard(null);
      card.classList.add('hidden'); delete card.dataset.mtn;
      Object.keys(panes).forEach(k => { if (panes[k] && panes[k].hideCard) panes[k].hideCard(); });
      if (t !== 'city' && !panes[t]) panes[t] = t === 'mtn' ? mtnPane(ctx, m.querySelector('.wm-pane[data-tab="mtn"]')) : ovPane(ctx, m.querySelector('.wm-pane[data-tab="ov"]'));
      if (t === 'city') { layout(); clampView(); req(); }
      else if (panes[t] && panes[t].shown) panes[t].shown();
    }
    if (tabsOn) {
      m.querySelector('.wm-tabs').addEventListener('click', e => { const b = e.target.closest('.wm-tab'); if (!b || b.dataset.tab === tabNow) return; e.stopPropagation(); haptic('select'); sfx('tap'); showTab(b.dataset.tab); });
      showTab(tabNow);
    }
    api.tab = t => { if (t === undefined) return tabNow; showTab(t); return tabNow; };
    api.pane = t => panes[t || tabNow] || null;
    return api;
  }
  /* =====================================================================
     БОЛЬШАЯ КАРТА, волна 4B: вкладки «Кубачи» (село / отель / дорога) и «Обзор»
     ===================================================================== */
  // просмотрщик: холст с рисунком (один раз), живой слой поверх, жесты — перетащить, щипок, двойной тап, колесо, кнопки
  // V: { bounds() → {x0,x1,z0,z1}, paintBase(c, s, ox, oz, W, H), live(c, toS, vs, hits, view), onTap(hit|null), height(bw, fw, fh), zoom0, maxZoom, focus() → {x,z}|null }
  function mapViewer(box, cv, V) {
    let bw = 0, bh = 0, fit = 1, vs = 0, vx = 0, vz = 0, D = DPR(), base = null, hits = [], raf = 0, dead = false;
    const B = () => V.bounds();
    function layout(keep) {
      const b = B(), fw = b.x1 - b.x0, fh = b.z1 - b.z0;
      const cardW = (box.closest('.wm-card') || {}).clientWidth || 360;
      bw = Math.max(200, cardW - 20);
      bh = Math.round(V.height ? V.height(bw, fw, fh) : clamp(bw * fh / fw + 4, 200, 400));
      box.style.height = bh + 'px';
      D = DPR(); cv.width = Math.round(bw * D); cv.height = Math.round(bh * D);
      fit = Math.min(bw / fw, bh / fh);
      if (!keep || !vs) {
        vs = fit * (V.zoom0 || 1); vx = (b.x0 + b.x1) / 2; vz = (b.z0 + b.z1) / 2;
        const f = V.focus ? V.focus() : null; if (f && vs > fit * 1.01) { vx = f.x; vz = f.z; }
      }
      const bs = clamp(fit * D * (V.baseK || 2.4), 0.5, 1700 / Math.max(fw, fh));
      const bc = cnv(fw * bs, fh * bs);
      V.paintBase(bc.getContext('2d'), bs, b.x0, b.z0, bc.width, bc.height);
      base = { cv: bc, s: bs, b };
      clampView();
    }
    const maxZ = () => fit * (V.maxZoom || 6);
    function clampView() {
      const b = B(), fw = b.x1 - b.x0, fh = b.z1 - b.z0;
      vs = clamp(vs, fit, maxZ());
      const hw = bw / 2 / vs, hh = bh / 2 / vs;
      vx = fw <= 2 * hw ? (b.x0 + b.x1) / 2 : clamp(vx, b.x0 + hw, b.x1 - hw);
      vz = fh <= 2 * hh ? (b.z0 + b.z1) / 2 : clamp(vz, b.z0 + hh, b.z1 - hh);
    }
    const toS = (x, z) => [(x - vx) * vs + bw / 2, (z - vz) * vs + bh / 2];
    const toW = (sx, sy) => [(sx - bw / 2) / vs + vx, (sy - bh / 2) / vs + vz];
    const req = () => { if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    function draw() {
      if (dead || !base) return;
      const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = COL.paper; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(D, 0, 0, D, 0, 0);
      const b = base.b, [bx, by] = toS(b.x0, b.z0);
      c.imageSmoothingEnabled = true; c.drawImage(base.cv, bx, by, (b.x1 - b.x0) * vs, (b.z1 - b.z0) * vs);
      hits = [];
      if (V.live) V.live(c, toS, vs, hits, { bw, bh, fit, toW });
    }
    // жесты
    const ptr = new Map(); let g0 = null, lastTap = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onDown = e => { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* старый браузер */ } const [x, y] = pos(e); ptr.set(e.pointerId, { x, y, x0: x, y0: y, t: now(), moved: false }); g0 = null; e.preventDefault(); };
    const onMove = e => {
      const p = ptr.get(e.pointerId); if (!p) return; const [x, y] = pos(e);
      if (ptr.size === 1) { const dx = x - p.x, dy = y - p.y; if (Math.hypot(x - p.x0, y - p.y0) > 6) p.moved = true; if (p.moved) { vx -= dx / vs; vz -= dy / vs; clampView(); req(); } }
      else if (ptr.size === 2) {
        p.moved = true; const [a, b] = [...ptr.values()]; const pa = a === p ? [x, y] : [a.x, a.y], pb = b === p ? [x, y] : [b.x, b.y];
        const dd = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        if (!g0) g0 = { dd, vs, w: toW(mx, my) };
        vs = clamp(g0.vs * dd / Math.max(10, g0.dd), fit, maxZ()); vx = g0.w[0] - (mx - bw / 2) / vs; vz = g0.w[1] - (my - bh / 2) / vs; clampView(); req();
      }
      p.x = x; p.y = y;
    };
    const onUp = e => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (ptr.size === 0 && !p.moved && now() - p.t < 450) {
        const t = now();
        if (t - lastTap < 300) { zoomAt(p.x, p.y, 2); lastTap = 0; return; }
        lastTap = t; tapAt(p.x, p.y);
      }
      if (ptr.size < 2) g0 = null;
    };
    const onWheel = e => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, e.deltaY < 0 ? 1.25 : 0.8); };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    function zoomAt(x, y, k) { const w0 = toW(x, y); vs = clamp(vs * k, fit, maxZ()); vx = w0[0] - (x - bw / 2) / vs; vz = w0[1] - (y - bh / 2) / vs; clampView(); req(); }
    function tapAt(x, y) {
      let best = null, bd = 1e9;
      hits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < Math.max(18, h.r) && d < bd) { bd = d; best = h; } });
      if (V.onTap) V.onTap(best, toW(x, y));
    }
    const tools = box.querySelector('.wm-tools');
    if (tools) tools.addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return; e.stopPropagation(); haptic('select');
      if (b.dataset.z === 'in') zoomAt(bw / 2, bh / 2, 1.6); else if (b.dataset.z === 'out') zoomAt(bw / 2, bh / 2, 1 / 1.6);
      else { const f = V.focus ? V.focus() : null; if (f) { vs = Math.max(vs, fit * 2.2); vx = f.x; vz = f.z; clampView(); req(); } }
    });
    const onResize = () => { if (!dead) { layout(true); req(); } };
    window.addEventListener('resize', onResize);
    return {
      layout, draw, req,
      rebase() { layout(false); draw(); },
      center(x, z, zoom) { if (zoom) vs = Math.max(vs, fit * zoom); vx = x; vz = z; clampView(); req(); },
      ensureIn(x, z) { const [sx, sy] = toS(x, z); if (sx < 30 || sy < 30 || sx > bw - 30 || sy > bh - 30) { vx = x; vz = z; clampView(); req(); } },
      screenOf(x, z) { const r = cv.getBoundingClientRect(), [sx, sy] = toS(x, z); return { x: r.left + sx, y: r.top + sy, inside: sx >= 0 && sy >= 0 && sx <= bw && sy <= bh }; },
      view: () => ({ vx, vz, vs, fit, bw, bh }),
      destroy() { dead = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); base = null; },
    };
  }
  // подпись на карте: белый ореол
  function mapLabel(c, t, x, y, o = {}) {
    c.save(); c.font = `${o.weight || 700} ${o.size || 12}px ${o.font || "'Comfortaa', 'Nunito', sans-serif"}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (o.rot) { c.translate(x, y); c.rotate(o.rot); x = 0; y = 0; }
    c.lineWidth = o.halo || 3.6; c.strokeStyle = 'rgba(255,253,249,.94)'; c.strokeText(t, x, y);
    c.fillStyle = o.col || '#6F5470'; c.fillText(t, x, y);
    c.restore();
  }
  function lockBadge(c, x, y, t) {
    c.save(); c.font = "800 11px 'Nunito', sans-serif"; const tw = c.measureText(t).width + 26;
    c.fillStyle = 'rgba(58,46,63,.16)'; rrect(c, x - tw / 2, y - 10 + 2, tw, 20, 10); c.fill();
    c.fillStyle = '#F4F0F8'; rrect(c, x - tw / 2, y - 10, tw, 20, 10); c.fill();
    pin(c, 'place', x - tw / 2 + 11, y, 7, { dim: true, g: 'lock', shadow: false });
    c.fillStyle = '#6E6272'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, x - tw / 2 + 21, y + 0.5);
    c.restore();
  }
  // замки поездки: тексты Missions.unlock (с датой) — '' значит открыто
  function mtnLocks(ctx) {
    const lk = k => { try { if (window.Missions && Missions.unlock) { const r = Missions.unlock(k); return r && !r.ok ? { text: r.text || 'Пока закрыто.', when: r.when || '' } : null; } } catch (e) { /* без таблицы */ } return null; };
    const o = ctx.o, tripOk = o.here ? true : (typeof o.tripOpen === 'function' ? !!safe(o.tripOpen) : ctx.env.edgeOpen());
    const trip = lk('trip'), hotel = lk('hotel'), zip = lk('zipline');
    if (!tripOk) return { tripOk: false, trip: trip || { text: 'Дорога наверх пока закрыта.', when: '' }, hotel: null, zip: null };
    // поездка открыта (или предпросмотр): отель и зиплайн закрыты, только если у них своя, более поздняя дата
    return { tripOk: true, trip: null, hotel: trip ? null : hotel, zip: trip ? null : (zip || hotel) };
  }
  // «Поехать сюда» к точке гор: { ok, text } | { none } — без обработчика (2D-город, старый регион)
  function regionTravelInfo(ctx, p) {
    const o = ctx.o, has = !!ctx.hooks.travelRegion || typeof o.onTravelRegion === 'function';
    if (!has) return { ok: false, none: true };
    const L = mtnLocks(ctx);
    if (!L.tripOk) return { ok: false, text: L.trip.text };
    if (p.rid === 'hotel' && L.hotel) return { ok: false, text: L.hotel.text };
    return { ok: true };
  }
  async function goRegion(ctx, p) {
    haptic('medium');
    if (ctx.hooks.travelRegion) return ctx.hooks.travelRegion(p, ctx.api);
    ctx.api.close();
    try { await ctx.o.onTravelRegion(p.rid, p.id, p); return true; } catch (e) { console.warn('minimap region travel', e); const g = G_(); if (g && g.toast) g.toast('Сюда пока не доехать.', 2000); return false; }
  }
  function toggleWaypoint(ctx, p) {
    const w = WAYPOINT, same = w && w.rid === p.rid && Math.hypot(w.x - p.x, w.z - p.z) < 0.5;
    if (same) { setWaypoint(null); haptic('light'); return false; }
    setWaypoint({ rid: p.rid, id: p.id, x: p.x, z: p.z, label: p.label, kind: p.kind }); haptic('success'); sfx('tap');
    try { const g = G_(); if (g && g.toast) g.toast('📍 Метка на радаре: ' + p.label, 1800); } catch (e) { /* без тоста */ }
    setTimeout(() => ctx.api.close(), 380);
    return true;
  }
  // карточка точки гор (в общем .wm-poi листа)
  function mtnCard(ctx, p, here, onX) {
    const card = ctx.card;
    if (!p) { card.classList.add('hidden'); delete card.dataset.mtn; return; }
    const h = here && here.rid === p.rid ? here.get() : null, d = h ? Math.hypot(p.x - h.x, p.z - h.z) : null;
    const inf = regionTravelInfo(ctx, p), atHere = d != null && d < 4;
    const w = WAYPOINT, wpOn = w && w.rid === p.rid && Math.hypot(w.x - p.x, w.z - p.z) < 0.5;
    let action = '';
    if (atHere) action = '<div class="wm-note here">Ты уже здесь.</div>';
    else if (inf.none) action = '';
    else if (!inf.ok) action = `<div class="wm-note lock">${esc(inf.text || 'Пока закрыто.')}</div>`;
    else action = '<button type="button" class="wm-go">Поехать сюда</button>';
    const pinBtn = ctx.o.radar && !atHere ? `<button type="button" class="wm-pin2${wpOn ? ' on' : ''}">${wpOn ? 'Убрать метку с радара' : '📍 Отметить на радаре'}</button>` : '';
    const WHERE = { kubachi: ctx.named ? 'В ' + villageTitle(true) : 'В горном селе', hotel: 'У отеля на вершине', serpentine: 'На серпантине', city: 'В городе' };
    const dTxt = d != null && !atHere ? `${d < 60 ? Math.round(d) : Math.round(d / 5) * 5} м · пешком ~${d / 3.4 < 60 ? Math.max(5, Math.round(d / 3.4 / 5) * 5) + ' с' : Math.round(d / 3.4 / 60) + ' мин'}` : d == null && WHERE[p.rid] ? WHERE[p.rid] : '';
    card.innerHTML = `<button type="button" class="wm-poi-x" aria-label="Закрыть">✕</button><div class="wm-poi-h"><img alt="" src="${iconURL(p.kind)}"><div><div class="wm-poi-n">${esc(p.label)}</div>${p.line ? `<div class="wm-poi-l">${esc(p.line)}</div>` : ''}${dTxt ? `<div class="wm-poi-d">${esc(dTxt)}</div>` : ''}</div></div>${action}${pinBtn}`;
    card.classList.remove('hidden'); card.dataset.mtn = p.rid + ':' + p.id;
    card.querySelector('.wm-poi-x').onclick = e => { e.stopPropagation(); mtnCard(ctx, null); if (onX) onX(); };
    const go = card.querySelector('.wm-go'); if (go) go.onclick = e => { e.stopPropagation(); goRegion(ctx, p); };
    const pb = card.querySelector('.wm-pin2'); if (pb) pb.onclick = e => { e.stopPropagation(); toggleWaypoint(ctx, p); mtnCard(ctx, p, here, onX); };
    if (!inf.ok && !inf.none) haptic('light');
  }

  // вкладка «Кубачи»: карта села / отеля / дороги (переключатель) и все точки гор списком
  function mtnPane(ctx, el) {
    const o = ctx.o, named = ctx.named, here = o.here || null;
    let sub = o.sub || (here && here.rid) || 'kubachi', sel = null;
    el.innerHTML = `<div class="wm-mapbox"><canvas class="wm-canvas wm-mcv"></canvas><div class="wm-seg">${['kubachi', 'hotel', 'serpentine'].map(r => `<button type="button" data-r="${r}">${esc(rTitle(r, named))}</button>`).join('')}</div><div class="wm-north">С</div>
      <div class="wm-tools"><button type="button" data-z="in" aria-label="Ближе">+</button><button type="button" data-z="out" aria-label="Дальше">−</button>${here ? '<button type="button" class="me" data-z="me" aria-label="Где я">я</button>' : ''}</div></div>
      <div class="wm-list wm-mlist"></div>`;
    const box = el.querySelector('.wm-mapbox'), cv = el.querySelector('canvas'), list = el.querySelector('.wm-mlist');
    const models = {};
    const model = r => models[r] || (models[r] = (o.regionModel && o.regionModel[r]) || mtnModel(r, null, named));
    const poisOf = r => {
      const lv = o.livePois && typeof o.livePois[r] === 'function' ? safe(o.livePois[r]) : null;
      const arr = (lv && lv.length ? lv : LIVE_POIS[r] && LIVE_POIS[r].length ? LIVE_POIS[r] : model(r).staticPois()).filter(p => !p.far);
      return arr.map(p => Object.assign({}, p, { rid: r, line: p.line || mtnLine(p, named) }));
    };
    const heroOf = r => (here && here.rid === r ? here.get() : null);
    const findP = (r, id) => poisOf(r).find(p => p.id === id);
    const V = mapViewer(box, cv, {
      bounds: () => model(sub).bounds,
      paintBase: (c, s, ox, oz, W, H) => model(sub).paint(c, s, ox, oz, W, H, {}),
      height: (bw, fw, fh) => clamp(bw * fh / fw, 230, Math.min(((ctx.m.clientHeight || 700) * 0.42), 380)),
      zoom0: sub === 'serpentine' ? 1 : 1.15, maxZoom: 7, baseK: 2.4,
      focus: () => { const h = heroOf(sub); return h ? { x: h.x, z: h.z } : null; },
      live(c, toS, vs, hits, vw) {
        const r = clamp(6.8 + (vs - vw.fit) * 0.5, 6.8, 11.5);
        // шпильки (без строки в списке)
        if (sub === 'serpentine') model(sub).hairpins.forEach(p => { const [sx, sy] = toS(p.x, p.z); pin(c, 'hairpin', sx, sy, r * 0.75, { shadow: false }); });
        const ps = poisOf(sub).map(p => ({ p, s: toS(p.x, p.z) })).sort((a, b) => (a.p.id === sel) - (b.p.id === sel) || a.s[1] - b.s[1]);
        ps.forEach(({ p, s: [sx, sy] }) => { if (sx < -20 || sy < -20 || sx > vw.bw + 20 || sy > vw.bh + 20) return; pin(c, p.kind, sx, sy, r); hits.push({ id: p.id, x: sx, y: sy, r: r + 8 }); });
        // метка
        const w = WAYPOINT; if (w && w.rid === sub) { const [sx, sy] = toS(w.x, w.z); dropPin(c, sx, sy, r * 1.05, KINDS.waypoint.col, 'pin'); }
        // героиня
        const h = heroOf(sub);
        if (h) {
          const [hx, hy] = toS(h.x, h.z);
          if (typeof h.yaw === 'number') { const a = Math.atan2(Math.cos(h.yaw), Math.sin(h.yaw)); const g = c.createRadialGradient(hx, hy, 2, hx, hy, 46); g.addColorStop(0, 'rgba(255,214,120,.55)'); g.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(hx, hy); c.arc(hx, hy, 46, a - 0.5, a + 0.5); c.closePath(); c.fill(); }
          heroArrow(c, hx, hy, 8.5, Math.atan2(Math.cos(h.ang || 0), Math.sin(h.ang || 0)));
          hits.push({ id: '@hero', x: hx, y: hy, r: 14 });
        }
        // выбранная точка: подпись
        const sp = sel && findP(sub, sel);
        if (sp) {
          const [sx, sy] = toS(sp.x, sp.z);
          c.font = `800 12.5px 'Nunito', sans-serif`; const t = sp.label, tw = Math.min(230, c.measureText(t).width + 16);
          const lx = clamp(sx, tw / 2 + 4, vw.bw - tw / 2 - 4), ly = Math.max(14, sy - r - 16);
          c.fillStyle = 'rgba(58,46,63,.18)'; rrect(c, lx - tw / 2, ly - 11 + 2, tw, 22, 11); c.fill();
          c.fillStyle = '#FFFFFF'; rrect(c, lx - tw / 2, ly - 11, tw, 22, 11); c.fill();
          c.fillStyle = '#3A2E3F'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, lx, ly + 0.5, 220);
          c.strokeStyle = '#C2405B'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, r + 3.5, 0, TAU); c.stroke();
        }
      },
      onTap(hit) { if (hit && hit.id !== '@hero') select(sub, hit.id); else if (sel) select(null); },
    });
    function setSub(r, keep) {
      sub = r; el.querySelectorAll('.wm-seg button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
      V.layout(!!keep); V.req();
    }
    function select(r, id) {
      if (!r) { sel = null; mtnCard(ctx, null); list.classList.remove('pad'); list.querySelectorAll('.wm-row').forEach(b => b.classList.remove('on')); V.req(); return; }
      if (r !== sub) setSub(r);
      const p = findP(r, id); if (!p) return;
      sel = id; V.ensureIn(p.x, p.z);
      list.querySelectorAll('.wm-row').forEach(b => b.classList.toggle('on', b.dataset.id === r + ':' + id));
      list.classList.add('pad');
      mtnCard(ctx, p, here, () => { sel = null; list.classList.remove('pad'); V.req(); });
      sfx('tap'); V.req();
    }
    // список: регион, где она сейчас, — первым
    function fillList() {
      const order = ['kubachi', 'hotel', 'serpentine'].sort((a, b) => ((here && here.rid === b) - (here && here.rid === a)));
      const head = { kubachi: named ? 'В ' + villageTitle(true) : 'В селе', hotel: 'Отель на вершине', serpentine: 'Дорога' };
      list.innerHTML = order.map(r => {
        const h = heroOf(r), ps = poisOf(r).slice();
        if (h) ps.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
        return `<div class="wm-group">${esc(head[r])}</div>` + ps.map(p => {
          const inf = regionTravelInfo(ctx, p), d = h ? Math.hypot(p.x - h.x, p.z - h.z) : null;
          const sub2 = !inf.ok && !inf.none && inf.text ? inf.text : p.line;
          return `<button type="button" class="wm-row${!inf.ok && !inf.none ? ' lock' : ''}" data-id="${esc(r + ':' + p.id)}"><img alt="" src="${iconURL(p.kind, { dim: !inf.ok && !inf.none })}"><span class="n">${esc(p.label)}${sub2 ? `<small>${esc(sub2)}</small>` : ''}</span><span class="d">${d != null ? esc(d < 4 ? 'ты здесь' : (d < 60 ? Math.round(d) : Math.round(d / 5) * 5) + ' м') : ''}</span></button>`;
        }).join('');
      }).join('');
    }
    el.querySelector('.wm-seg').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b || b.dataset.r === sub) return; e.stopPropagation(); haptic('select'); select(null); setSub(b.dataset.r); });
    list.addEventListener('click', e => { const b = e.target.closest('.wm-row'); if (!b) return; haptic('light'); const [r, ...rest] = b.dataset.id.split(':'); select(r, rest.join(':')); });
    fillList();
    let built = false;
    return {
      shown() { if (!built) { built = true; setSub(sub); } else { V.layout(true); V.req(); } },
      hideCard() { if (sel) { sel = null; list.classList.remove('pad'); } },
      select: (r, id) => select(r, id), sub: r => { if (r) setSub(r); return sub; },
      screenOf: (r, id) => { const p = findP(r, id); return p && r === sub ? V.screenOf(p.x, p.z) : null; },
      pois: r => poisOf(r || sub), view: () => V.view(), redraw: () => V.req(),
      destroy() { V.destroy(); },
    };
  }

  // ---------- «Обзор»: нарисованная карта дороги в горы ----------
  const OV_B = { x0: -156, x1: 566, z0: -132, z1: 566 };
  const OV_CITY = { x0: -140, x1: -12, z0: 448, z1: 534 };
  const ovCity = (L, x, z) => { const b = (L && L.bounds) || { x0: -121, x1: 121, z0: -84, z1: 78.6 }; return [OV_CITY.x0 + (x - b.x0) / (b.x1 - b.x0) * (OV_CITY.x1 - OV_CITY.x0), OV_CITY.z0 + (z - b.z0) / (b.z1 - b.z0) * (OV_CITY.z1 - OV_CITY.z0)]; };
  // дорога от выезда из города до начала серпантина и «облачный» переезд от ворот к селу (схема, не масштаб)
  function ovRoads(L) {
    const P = path0(), a = P[0], e = (L && L.edge && isFinite(L.edge.x)) ? ovCity(L, L.edge.x, L.edge.z) : [OV_CITY.x1 - 14, OV_CITY.z0];
    const bez = (p0, p1, p2, p3, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return out; };
    const z = P[P.length - 1], kd = V_().regions.kubachi.data || {}, R0 = kd.ROAD || [[26.7, -4.5], [112, -27]], vEnd = R0[R0.length - 1];
    return {
      cityRoad: bez(e, [e[0] + 10, e[1] - 70], [a.x - 70, a.z + 30], [a.x, a.z], 24),
      cloudRoad: bez([z.x, z.z], [z.x + 90, z.z - 120], [vEnd[0] + 150, vEnd[1] + 40], vEnd, 30),
      villageRoad: R0,
    };
  }
  function paintOverview(c, s, ox, oz, W, H, k) {
    const V = V_(), X = x => (x - ox) * s, Y = z => (z - oz) * s, L = k.L;
    c.save();
    c.fillStyle = '#EEF1E6'; c.fillRect(0, 0, W, H);
    // рельеф склонов (тот же, что у дороги и села), мягко
    const gm = V.regions.serpentine.groundMacro, gy = (x, z) => { const y = gm(x, z); return isFinite(y) ? clamp(y, -160, 60) : 0; };
    hillshade(c, { bounds: OV_B, height: gy }, s, ox, oz, W, H, 8, [[232, 238, 240], [222, 236, 214], [232, 238, 210], [242, 238, 220], [248, 244, 234]], 0.1, 0.9, 1.06);
    // море облаков над долиной: мягкая маска там, где рельеф ниже облаков (−90 м)
    {
      const st = 10, nx = Math.ceil((OV_B.x1 - OV_B.x0) / st) + 1, nz = Math.ceil((OV_B.z1 - OV_B.z0) / st) + 1;
      const fc = cnv(nx, nz), fx = fc.getContext('2d'), img = fx.createImageData(nx, nz), d = img.data;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = OV_B.x0 + i * st, z = OV_B.z0 + j * st, y = gy(x, z), q = (j * nx + i) * 4;
        const inCity = x < OV_CITY.x1 + 14 && z > OV_CITY.z0 - 14;
        const a = inCity ? 0 : clamp((-86 - y) / 16, 0, 1) * (0.78 + 0.18 * Math.sin(x * 0.045 + z * 0.03));
        d[q] = 255; d[q + 1] = 255; d[q + 2] = 255; d[q + 3] = Math.round(a * 230);
      }
      fx.putImageData(img, 0, 0);
      c.save(); try { c.filter = `blur(${Math.max(1, 3 * s).toFixed(1)}px)`; } catch (e) { /* без фильтра */ }
      c.imageSmoothingEnabled = true; c.drawImage(fc, X(OV_B.x0 - st / 2), Y(OV_B.z0 - st / 2), nx * st * s, nz * st * s);
      c.restore();
    }
    // горный хребет по верхнему краю (над селом)
    let sd = 17; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    [['#DDD3EA', -62, 46], ['#D1D9EA', -78, 38]].forEach(([col, base, amp], layer) => {
      const pts = []; for (let x = OV_B.x0 - 10; x <= OV_B.x1 + 40; x += 34 + rn() * 26) pts.push([x, base - amp * (0.45 + rn() * 0.55) - (layer ? 0 : 6)]);
      c.fillStyle = col; c.beginPath(); c.moveTo(X(OV_B.x0 - 10), Y(base + 6));
      pts.forEach((q, i) => { c.lineTo(X(q[0]), Y(q[1])); if (i < pts.length - 1) c.lineTo(X((q[0] + pts[i + 1][0]) / 2), Y(base - amp * 0.18)); });
      c.lineTo(X(OV_B.x1 + 40), Y(base + 6)); c.closePath(); c.fill();
      if (layer === 0) pts.forEach(q => { const hgt = base - amp * 0.18 - q[1]; if (hgt < amp * 0.55) return; c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(X(q[0] - hgt * 0.32), Y(q[1] + hgt * 0.34)); c.lineTo(X(q[0]), Y(q[1])); c.lineTo(X(q[0] + hgt * 0.32), Y(q[1] + hgt * 0.34)); c.lineTo(X(q[0] + hgt * 0.1), Y(q[1] + hgt * 0.26)); c.lineTo(X(q[0] - hgt * 0.06), Y(q[1] + hgt * 0.36)); c.closePath(); c.fill(); });
    });
    // город: свои районы в рамке (схема), река снизу
    const cb = OV_CITY, cr = 10 * s;
    c.fillStyle = 'rgba(58,46,63,.12)'; rrect(c, X(cb.x0) + 2, Y(cb.z0) + 3, (cb.x1 - cb.x0) * s, (cb.z1 - cb.z0) * s, cr); c.fill();
    c.fillStyle = '#FBF4EF'; rrect(c, X(cb.x0), Y(cb.z0), (cb.x1 - cb.x0) * s, (cb.z1 - cb.z0) * s, cr); c.fill();
    c.save(); rrect(c, X(cb.x0), Y(cb.z0), (cb.x1 - cb.x0) * s, (cb.z1 - cb.z0) * s, cr); c.clip();
    const ds = (L && Array.isArray(L.districts)) ? L.districts : [];
    ds.forEach(d => { if (![d.x0, d.x1, d.z0, d.z1].every(isFinite)) return; const [a0, b0] = ovCity(L, d.x0, d.z0), [a1, b1] = ovCity(L, d.x1, d.z1); c.fillStyle = rgba(d.color || (d.soon ? '#D8D4E2' : '#F6D3DB'), 0.7); c.fillRect(X(a0), Y(b0), (a1 - a0) * s, (b1 - b0) * s); });
    for (let i = 0; i < 70; i++) { const x = cb.x0 + 6 + rn() * (cb.x1 - cb.x0 - 12), z = cb.z0 + 5 + rn() * (cb.z1 - cb.z0 - 22); c.fillStyle = COL.block[i % COL.block.length]; c.fillRect(X(x), Y(z), 3.4 * s, 2.6 * s); }
    c.fillStyle = 'rgb(190,221,241)'; c.fillRect(X(cb.x0), Y(cb.z1 - 9), (cb.x1 - cb.x0) * s, 9 * s);
    c.restore();
    // дороги: из города к серпантину, серпантин с веткой, «облачный» переезд к селу
    const RD = ovRoads(L);
    polyline(c, RD.cityRoad, s, ox, oz, 9, 'rgb(196,184,206)'); polyline(c, RD.cityRoad, s, ox, oz, 7, 'rgb(220,212,228)');
    paintRoad(c, { bounds: OV_B }, s, ox, oz, W, H, {});
    c.save(); c.setLineDash([5, 4]); polyline(c, RD.cloudRoad, s, ox, oz, 5, 'rgba(176,160,196,.75)', 'butt'); c.restore();
    // село: ряды, дома, башня
    paintVillage(c, { h: null, bounds: MB.kubachi }, s, ox, oz, W, H, {}, false);
    // отель на холме: холм, площадки, корпус, башня
    const HD = (V.regions.hotel && V.regions.hotel.data) || {}, tm = (x, z) => { try { const q = HD.toMacro(x, 0, z); return [q.x, q.z]; } catch (e) { return [490 + x, 500 + z]; } };
    const F = (V.ZIP_GEO && V.ZIP_GEO.frame) || { x: 490, z: 500 };
    const hg = c.createRadialGradient(X(F.x), Y(F.z), 4, X(F.x), Y(F.z), 120 * s); hg.addColorStop(0, 'rgba(160,196,140,.55)'); hg.addColorStop(1, 'rgba(160,196,140,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(X(F.x), Y(F.z), 120 * s, 0, TAU); c.fill();
    const quad = (q, col) => { const pts = [tm(q.x0, q.z0), tm(q.x1, q.z0), tm(q.x1, q.z1), tm(q.x0, q.z1)]; c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.closePath(); c.fill(); };
    (HD.PADS || []).forEach(p => quad(p, { yard: '#F8EEE4', park: '#E4DDE8', sport: '#C9E3BE', relax: '#D6EBCF', deck: '#E2CBB1' }[p.kind] || '#EDE6DA'));
    quad(STATIC_HOTEL.main, '#FFFFFF'); quad(STATIC_HOTEL.pool, '#BFE0F2');
    let hroad = null; try { hroad = HD.road ? HD.road() : null; } catch (e) { hroad = null; }
    if (hroad && hroad.length) { const pts = hroad.map(q => tm(q.x !== undefined ? q.x : q[0], q.z !== undefined ? q.z : q[1])); polyline(c, pts, s, ox, oz, 6.6, 'rgb(196,184,206)'); polyline(c, pts, s, ox, oz, 5.2, 'rgb(220,212,228)'); }
    // зиплайн
    try { const r = V.zipline.route('macro'); c.strokeStyle = 'rgba(78,74,82,.75)'; c.lineWidth = Math.max(1.2, 0.9 * s); c.beginPath(); c.moveTo(X(r.from.x), Y(r.from.z)); c.lineTo(X(r.to.x), Y(r.to.z)); c.stroke(); } catch (e) { /* без зиплайна */ }
    c.restore();
  }
  // где героиня на обзоре: город — в рамке города; отель — через toMacro
  function ovHere(ctx) {
    const o = ctx.o, L = ctx.env.layout();
    if (o.here) { const h = o.here.get(); if (!h) return null; if (o.here.rid === 'hotel') { const M = mtnModel('hotel', null, ctx.named), q = M.toMacro(h.x, h.z); return { rid: 'hotel', x: q[0], z: q[1] }; } return { rid: o.here.rid, x: h.x, z: h.z }; }
    const h = ctx.env.hero(); if (!h) return null;
    const q = ovCity(L, h.x, h.z); return { rid: 'city', x: q[0], z: q[1] };
  }
  function ovPane(ctx, el) {
    const o = ctx.o, named = ctx.named, L = ctx.env.layout(), V = V_();
    el.innerHTML = `<div class="wm-mapbox wm-ovbox"><canvas class="wm-canvas wm-ocv"></canvas><div class="wm-north">С</div>
      <div class="wm-tools"><button type="button" data-z="in" aria-label="Ближе">+</button><button type="button" data-z="out" aria-label="Дальше">−</button><button type="button" class="me" data-z="me" aria-label="Где я">я</button></div></div>
      <div class="wm-route"></div>`;
    const box = el.querySelector('.wm-mapbox'), cv = el.querySelector('canvas'), route = el.querySelector('.wm-route');
    const locks = mtnLocks(ctx), RD = ovRoads(L), P = path0();
    const hr = hotelRoad0(), zr = (() => { try { return V.zipline.route('macro'); } catch (e) { return null; } })();
    const F = (V.ZIP_GEO && V.ZIP_GEO.frame) || { x: 490, z: 500 };
    const cityC = [(OV_CITY.x0 + OV_CITY.x1) / 2, (OV_CITY.z0 + OV_CITY.z1) / 2 - 6];
    const kd = V.regions.kubachi.data || {}, SQ = kd.SQUARE || { x: 12.3, z: -6.3 };
    // узлы обзора (тап → карточка)
    const nodes = [
      { id: 'city', rid: 'city', kind: 'city', x: cityC[0], z: cityC[1], label: 'Город', line: 'Дома, площадь, парк и река.' },
      { id: 'serpentine', rid: 'serpentine', kind: 'hairpin', x: P[Math.round(P.length * 0.55)].x, z: P[Math.round(P.length * 0.55)].z - 4, label: 'Серпантин', line: 'Дорога вдоль склона: справа скала, слева обрыв и вид на село.', poi: 'toCity', lock: 'trip' },
      { id: 'kubachi', rid: 'kubachi', kind: 'tower', x: 4, z: 10, label: villageTitle(named), line: 'Башня, базарная площадь, пекарня и родник.', poi: 'square', lock: 'trip' },
      { id: 'hotel', rid: 'hotel', kind: 'hotel', x: F.x, z: F.z, label: 'Отель на вершине', line: 'Двор, бассейн, мини-гольф, падел, костёр и вид на вершины.', poi: 'courtyard', lock: 'hotel' },
    ];
    if (hr && hr.fork) nodes.push({ id: 'fork', rid: 'serpentine', kind: 'fork', x: hr.fork.x, z: hr.fork.z, label: 'Развилка', line: 'Вверх — к отелю, прямо — к воротам села.', poi: 'fork', lock: 'trip', small: true });
    if (zr) nodes.push({ id: 'zip', rid: 'hotel', kind: 'zip', x: (zr.from.x + zr.to.x) / 2, z: (zr.from.z + zr.to.z) / 2, label: 'Зиплайн', line: 'С башни отеля — через долину, к площадке у села.', poi: 'tower', lock: 'zip', small: true });
    const lockOf = n => (n.lock === 'trip' ? locks.trip : n.lock === 'hotel' ? locks.trip || locks.hotel : n.lock === 'zip' ? locks.trip || locks.zip : null);
    let sel = null, showRoute = true;
    const here = () => ovHere(ctx);
    // путь «как попасть в село»: от «ты здесь» до площади села
    function routePts() {
      const h = here(), out = [];
      const road = (from) => { for (let i = from; i < P.length; i++) out.push([P[i].x, P[i].z]); RD.cloudRoad.forEach(q => out.push(q)); RD.villageRoad.slice().reverse().forEach(q => out.push(q)); out.push([SQ.x, SQ.z]); };
      if (!h || h.rid === 'city') { if (h) out.push([h.x, h.z]); RD.cityRoad.forEach(q => out.push(q)); road(0); return out; }
      if (h.rid === 'serpentine') { let bi = 0, bd = 1e9; P.forEach((q, i) => { const d = Math.hypot(q.x - h.x, q.z - h.z); if (d < bd) { bd = d; bi = i; } }); out.push([h.x, h.z]); road(bi); return out; }
      if (h.rid === 'hotel' && zr) { out.push([h.x, h.z], [zr.from.x, zr.from.z], [zr.to.x, zr.to.z], [SQ.x, SQ.z]); return out; }
      return null;
    }
    const RP = routePts();
    let dash = 0, animT = 0;
    const Vw = mapViewer(box, cv, {
      bounds: () => OV_B,
      paintBase: (c, s, ox, oz, W, H) => paintOverview(c, s, ox, oz, W, H, { L, named }),
      height: bw => clamp(bw * 1.0, 260, Math.min((ctx.m.clientHeight || 700) * 0.46, 400)),
      zoom0: 1, maxZoom: 4, baseK: 2.6,
      focus: () => { const h = here(); return h ? { x: h.x, z: h.z } : null; },
      live(c, toS, vs, hits, vw) {
        // путь
        if (showRoute && RP && RP.length > 1) {
          const line = (w, col, dashA) => { c.save(); c.beginPath(); RP.forEach((q, i) => { const [sx, sy] = toS(q[0], q[1]); if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy); }); c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; if (dashA) { c.setLineDash(dashA); c.lineDashOffset = -dash; } c.stroke(); c.restore(); };
          const lockedRoute = !!locks.trip;
          line(9, lockedRoute ? 'rgba(160,150,180,.35)' : 'rgba(194,64,91,.32)');
          line(3.4, lockedRoute ? 'rgba(142,137,166,.9)' : '#C2405B', lockedRoute ? [5, 6] : null);
          if (!lockedRoute) line(1.6, 'rgba(255,253,249,.95)', [4, 9]);
        }
        // подписи мест
        const lab = (t, x, z, o2) => { const [sx, sy] = toS(x, z); if (sx < -40 || sx > vw.bw + 40 || sy < -20 || sy > vw.bh + 20) return; mapLabel(c, t, sx, sy, o2); };
        const labC = (t, sx, sy, o2) => { c.font = `${(o2 && o2.weight) || 700} ${(o2 && o2.size) || 12}px 'Comfortaa', 'Nunito', sans-serif`; const tw = c.measureText(t).width; mapLabel(c, t, clamp(sx, tw / 2 + 5, vw.bw - tw / 2 - 5), clamp(sy, 10, vw.bh - 10), o2); };
        lab('море облаков', 150, 200, { size: 11, weight: 700, col: '#8FA6BC', font: "'Nunito', sans-serif" });
        if (zr) { const [ax, ay] = toS(zr.from.x, zr.from.z), [bx, by] = toS(zr.to.x, zr.to.z); let a = Math.atan2(by - ay, bx - ax); if (a > PI / 2) a -= PI; if (a < -PI / 2) a += PI; const L2 = Math.hypot(bx - ax, by - ay) || 1, nx2 = -(by - ay) / L2, ny2 = (bx - ax) / L2, sg = ny2 < 0 ? 1 : -1; mapLabel(c, 'зиплайн', ax + (bx - ax) * 0.7 + nx2 * 9 * sg, ay + (by - ay) * 0.7 + ny2 * 9 * sg, { size: 11, rot: a, col: '#5E7F94', font: "'Nunito', sans-serif", weight: 800 }); }
        // узлы
        nodes.forEach(n => {
          const [sx, sy] = toS(n.x, n.z), r = n.small ? 8 : 11, lk = lockOf(n);
          pin(c, n.kind, sx, sy, r, { dim: !!lk });
          hits.push({ id: n.id, x: sx, y: sy, r: r + 10 });
          if (!n.small) labC(n.label, sx, sy + r + 11 > vw.bh - 12 ? sy - r - 11 : sy + r + 11, { size: 13, col: n.id === 'city' ? '#9E2F47' : '#5E4660' });
          if (n.id === sel) { c.strokeStyle = '#C2405B'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, r + 3.5, 0, TAU); c.stroke(); }
        });
        // замки с датой
        if (locks.trip) { const [sx, sy] = toS(P[0].x + 30, P[0].z - 26); lockBadge(c, sx, sy, locks.trip.when ? 'с ' + locks.trip.when : 'скоро'); }
        else {
          if (locks.hotel) { const [sx, sy] = toS(F.x - 10, F.z - 38); lockBadge(c, sx, sy, locks.hotel.when ? 'с ' + locks.hotel.when : 'скоро'); }
          if (locks.zip && zr) { const [sx, sy] = toS((zr.from.x + zr.to.x) / 2, (zr.from.z + zr.to.z) / 2 + 24); lockBadge(c, sx, sy, locks.zip.when ? 'с ' + locks.zip.when : 'скоро'); }
        }
        // ты здесь
        const h = here();
        if (h) {
          const [hx, hy] = toS(h.x, h.z), k2 = (now() % 1600) / 1600;
          c.strokeStyle = rgba('#F2557A', 0.55 * (1 - k2)); c.lineWidth = 2.5; c.beginPath(); c.arc(hx, hy, 7 + k2 * 16, 0, TAU); c.stroke();
          heroArrow(c, hx, hy, 8, -PI / 2);
          c.font = "900 11.5px 'Nunito', sans-serif"; const t = 'ты здесь', tw = c.measureText(t).width + 14;
          const lx = clamp(hx, tw / 2 + 4, vw.bw - tw / 2 - 4), ly = Math.max(12, hy - 24);
          c.fillStyle = '#C2405B'; rrect(c, lx - tw / 2, ly - 10, tw, 20, 10); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, lx, ly + 0.5);
          hits.push({ id: '@hero', x: hx, y: hy, r: 14 });
        }
      },
      onTap(hit) { if (hit && hit.id !== '@hero') selectNode(hit.id); else if (sel) selectNode(null); },
    });
    // бегущий пунктир пути и пульс «ты здесь» ~12 кадров в секунду, пока вкладка видна (≤ 6 с, потом стоит)
    let anim0 = 0;
    const tick = () => { animT = 0; if (el.classList.contains('hidden') || !el.isConnected) return; dash += 1.2; Vw.draw(); if (now() - anim0 < 6000) animT = setTimeout(tick, 85); };
    const startAnim = () => { anim0 = now(); clearTimeout(animT); animT = setTimeout(tick, 85); };
    function selectNode(id) {
      sel = id; Vw.req();
      if (!id) { mtnCard(ctx, null); route.classList.remove('pad'); return; }
      const n = nodes.find(q => q.id === id); if (!n) return;
      route.classList.add('pad');
      if (n.rid === 'city') {
        const h = here(), inCity = h && h.rid === 'city', card = ctx.card;
        const back = !inCity && (ctx.hooks.travelRegion || typeof o.onTravelRegion === 'function');
        card.innerHTML = `<button type="button" class="wm-poi-x" aria-label="Закрыть">✕</button><div class="wm-poi-h"><img alt="" src="${iconURL('city')}"><div><div class="wm-poi-n">Город</div><div class="wm-poi-l">${esc(n.line)}</div></div></div>${inCity ? '<div class="wm-note here">Ты здесь.</div>' : back ? '<button type="button" class="wm-go">Вернуться в город</button>' : ''}`;
        card.classList.remove('hidden'); card.dataset.mtn = 'city';
        card.querySelector('.wm-poi-x').onclick = e => { e.stopPropagation(); selectNode(null); };
        const go = card.querySelector('.wm-go'); if (go) go.onclick = e => { e.stopPropagation(); goRegion(ctx, { rid: 'city', id: 'city', kind: 'city', label: 'Город', x: 0, z: 0 }); };
        return;
      }
      // точка региона: та же карточка, что во вкладке «Кубачи» (поехать, метка)
      const M = mtnModel(n.rid, null, named);
      const live = o.livePois && typeof o.livePois[n.rid] === 'function' ? safe(o.livePois[n.rid]) : null;
      const src = (live && live.length ? live : LIVE_POIS[n.rid] && LIVE_POIS[n.rid].length ? LIVE_POIS[n.rid] : M.staticPois());
      const p0 = src.find(q => q.id === n.poi) || src[0];
      const p = Object.assign({}, p0, { rid: n.rid, label: n.label, line: n.line, kind: n.kind === 'hairpin' ? 'gate' : n.kind });
      if (n.id === 'serpentine') { p.kind = 'city'; p.label = 'Серпантин'; }
      if (n.id === 'fork' || n.id === 'zip') { p.kind = n.kind; p.label = n.label; }
      mtnCard(ctx, p, o.here || null, () => { sel = null; route.classList.remove('pad'); Vw.req(); });
    }
    // шаги «как попасть»
    function steps() {
      const h = here(), title = villageTitle(named), lk = locks.trip;
      const car = (() => { try { return WORLD.carTitle ? WORLD.carTitle() : 'Машинка'; } catch (e) { return 'Машинка'; } })();
      const st = (n, t, sub2, lock) => `<div class="wm-step${lock ? ' lock' : ''}"><b>${n}</b><div>${esc(t)}${sub2 ? `<small>${esc(sub2)}</small>` : ''}</div></div>`;
      let html = `<h4>${h && h.rid === 'kubachi' ? 'Ты в ' + esc(named ? villageTitle(true) : 'горном селе') + '!' : esc(named ? 'Как попасть в ' + villageTitle(true) : 'Как попасть наверх')}</h4>`;
      if (lk) html += `<div class="wm-note lock">${esc(lk.text)}</div>`;
      if (!h || h.rid === 'city') {
        html += st(1, 'Сесть в машину', car + ' ждёт у гаража «Круглые фары».', false)
          + st(2, 'Выезд из города — под аркой на севере', (L && L.edge && L.edge.label ? 'Табличка «' + L.edge.label.replace(/\s*↑\s*$/, '') + ' ↑».' : 'Табличка со стрелкой вверх.'), !!lk)
          + st(3, 'Серпантин наверх', 'Газ и тормоз — справа, руль — пальцем слева. Можно выйти и посидеть на лавочке.', !!lk)
          + st(4, 'Ворота села', 'И ты в ' + (named ? villageTitle(true) : 'горном селе') + '!', !!lk)
          + `<div class="wm-step${lk || locks.hotel ? ' lock' : ''}"><b>★</b><div>Или — на развилке вверх, к отелю<small>${esc(locks.zip ? locks.zip.text : 'А оттуда — зиплайн через долину.')}</small></div></div>`;
      } else if (h.rid === 'serpentine') {
        html += st(1, 'Вверх по горной дороге', 'Справа скала, слева обрыв. Лавочки над долиной — по пути.', false) + st(2, 'Ворота села', 'И ты в ' + (named ? villageTitle(true) : 'горном селе') + '!', false)
          + `<div class="wm-step${locks.hotel ? ' lock' : ''}"><b>★</b><div>На развилке — вверх, к отелю<small>${esc(locks.hotel ? locks.hotel.text : 'Двор, бассейн, мини-гольф и зиплайн.')}</small></div></div>`;
      } else if (h.rid === 'hotel') {
        html += `<div class="wm-step${locks.zip ? ' lock' : ''}"><b>1</b><div>Башня во дворе — наверх<small>${esc(locks.zip ? locks.zip.text : 'Оттуда — зиплайн через долину, к площадке у села.')}</small></div></div>`
          + st(2, 'Или — вниз, в село', 'От нижних ворот — по дороге мимо школы, прямо к площади.', false);
      } else {
        html += st('·', 'Пекарня, родник, башня и базарная площадь', 'Все места — во вкладке «' + mtnTab(named) + '».', false) + st('·', 'Дорога вниз — от парковки', 'Серпантин ведёт в город.', false);
      }
      // кнопки
      const btns = [];
      const kp = { rid: 'kubachi', id: 'square', kind: 'square', x: SQ.x, z: SQ.z, label: villageTitle(named) };
      const hp = { rid: 'hotel', id: 'courtyard', kind: 'hotel', x: -3, z: -3, label: 'Отель на вершине' };
      const ti = regionTravelInfo(ctx, kp), th = regionTravelInfo(ctx, hp);
      if (!h || h.rid !== 'kubachi') { if (ti.ok) btns.push(`<button type="button" data-go="kubachi">${esc(named ? '🚗 Поехать в ' + villageTitle(true) : '🚗 Поехать наверх')}</button>`); if (o.radar && !lk) btns.push('<button type="button" data-pin="kubachi">📍 Метка: дорога наверх</button>'); }
      if (!h || h.rid !== 'hotel') { if (th.ok) btns.push('<button type="button" data-go="hotel">🏨 К отелю на вершине</button>'); }
      if (btns.length) html += `<div class="wm-ovgo">${btns.join('')}</div>`;
      route.innerHTML = html;
      route.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goRegion(ctx, b.dataset.go === 'hotel' ? hp : kp); }));
      route.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toggleWaypoint(ctx, kp); }));
      void title;
    }
    steps();
    let built = false;
    return {
      shown() { if (!built) { built = true; Vw.layout(false); } else Vw.layout(true); Vw.draw(); startAnim(); },
      hideCard() { if (sel) { sel = null; route.classList.remove('pad'); } },
      select: id => selectNode(id), nodes: () => nodes.slice(), route: () => (RP ? RP.length : 0), here: () => here(),
      screenOf: id => { const n = nodes.find(q => q.id === id); return n ? Vw.screenOf(n.x, n.z) : null; },
      view: () => Vw.view(), toggleRoute(b) { showRoute = b === undefined ? !showRoute : !!b; Vw.req(); return showRoute; },
      destroy() { clearTimeout(animT); Vw.destroy(); },
    };
  }

  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // стрелка героини: a — угол на экране (atan2(dy, dx))
  function heroArrow(c, x, y, r, a) {
    c.save(); c.translate(x, y); c.rotate(a + PI / 2);
    c.fillStyle = 'rgba(58,46,63,.16)'; c.beginPath(); c.moveTo(0, -r * 1.2); c.lineTo(r * 1.1, r * 1.12); c.lineTo(-r * 1.1, r * 1.12); c.closePath(); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(0, -r * 1.35); c.lineTo(r * 1.05, r * 0.95); c.lineTo(0, r * 0.45); c.lineTo(-r * 1.05, r * 0.95); c.closePath(); c.fill();
    c.fillStyle = COL.hero; c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(r * 0.72, r * 0.68); c.lineTo(0, r * 0.25); c.lineTo(-r * 0.72, r * 0.68); c.closePath(); c.fill();
    c.restore();
  }
  let HERO_URL = '';
  function heroURL() { if (HERO_URL) return HERO_URL; const c = cnv(64, 64), x = c.getContext('2d'); x.fillStyle = '#FBE1E7'; x.beginPath(); x.arc(32, 32, 28, 0, TAU); x.fill(); heroArrow(x, 32, 34, 15, -PI / 2); try { HERO_URL = c.toDataURL(); } catch (e) { HERO_URL = ''; } return HERO_URL; }

  /* =====================================================================
     ГОРЫ (волна 4B): модель карты региона — серпантин / село / отель
     Источники: ручка региона (если он загружен) и статичные данные модулей села — VILLAGE.regions.serpentine.path() /
     hotelRoad() / groundMacro, VILLAGE.regions.kubachi.data (ряды, площадь, башня, дорога) и дома (_test.unpackHouses),
     VILLAGE.regions.hotel.data (площадки PADS, лестницы, дорога, рамка toMacro), VILLAGE.ZIP_GEO / zipline.route('macro').
     Серпантин и село — в общих «макро»-осях (x восток, z юг), отель — в своих (на обзоре — через frame.toMacro).
     ===================================================================== */
  const V_ = () => window.VILLAGE || null;
  const mtnOk = () => { const V = V_(); return !!(V && V.regions && V.regions.serpentine && V.regions.kubachi && typeof V.regions.serpentine.path === 'function'); };
  function mtnNamed(o) {
    if (o && typeof o.named === 'boolean') return o.named;
    try { if (WORLD.Regions && WORLD.Regions.settings) return WORLD.Regions.settings().named !== false; } catch (e) { /* ниже */ }
    const C = window.CONFIG || {}; return C.VILLAGE_NAMED === undefined ? true : !!C.VILLAGE_NAMED;
  }
  // название села — у модуля села (название и слова про село — только в js/village/*: правило scan_words --allow-village)
  const villageTitle = named => { try { const k = V_() && V_().regions.kubachi; if (k && typeof k.title === 'function') return k.title(named); } catch (e) { /* без модуля */ } return 'Наверху'; };
  const mtnTab = named => (named ? villageTitle(true) : 'В горах');
  const RTITLE = { serpentine: 'Дорога', kubachi: 'Мастера', hotel: 'Отель' };
  const rTitle = (r, named) => (r === 'kubachi' && named ? villageTitle(true) : RTITLE[r]);
  // границы карт регионов (с запасом вокруг ходьбы; отель — в своих осях)
  const MB = { kubachi: { x0: -84, x1: 92, z0: -112, z1: 86 }, hotel: { x0: -104, x1: 92, z0: -118, z1: 40 }, serpentine: { x0: -403, x1: 342, z0: -2, z1: 470 } };
  // точки, если регион ещё не загружали (замер ручек волны 4A/4B; при загрузке берутся живые)
  const STATIC_POIS = {
    kubachi: [['tower', 'tower', -6.7, -14.2], ['square', 'square', 12.3, -6.3], ['bakery', 'bakery', 2.4, -7.3], ['spring', 'spring', 5.5, 62], ['spring_lid', 'spring', 5.1, 66.4],
      ['wedding', 'wedding', 26.3, -20.5], ['shop_craft', 'shop', 6.3, -11.1, 'Лавка мастера'], ['shop_food', 'shop', 23.9, -8.6, 'Фрукты с нижних склонов'], ['shop_cloth', 'shop', 10.3, 0, 'Платочки'],
      ['kaz_try', 'kaz', 1.7, 29.7], ['workshop', 'workshop', 19.1, 17], ['museum', 'museum', 14.9, -9.7], ['roof', 'roof', -19.9, 7.1], ['knoll', 'view', -43.2, 29.5, 'Западный уступ'],
      ['zipLanding', 'zip', 53, 5], ['park', 'parking', 26.7, -4.5], ['toRoad', 'city', 62, -10],
      // волна 6: дороги села — школа, школьный двор, разворот у башни, дорога к отелю
      ['school', 'place', 21, -92, 'Школа'], ['schoolYard', 'sport', 18.65, -66, 'Школьный двор'], ['towerPark', 'view', -11.5, -27.8, 'Разворот у башни'], ['toHotel', 'hotel', 76.9, -99.7]],
    hotel: [['main', 'hotel', -2, 23], ['courtyard', 'square', -3, -3], ['pool', 'pool', 36, 18], ['green', 'golf', 27, -56], ['sports_look', 'sport', 40, -62], ['spa', 'spa', -54, -55],
      ['fire', 'fire', -40, -86], ['view', 'view', -5, -36.9], ['tower', 'zip', -26, -24], ['park', 'parking', -50, 13]],
    serpentine: [['toCity', 'city', -380.2, 11.4], ['road_view', 'view', -280.1, 291.3], ['road_bench1', 'bench', -221.7, 319], ['road_bench2', 'bench', -34.7, 414.9],
      ['road_bench3', 'bench', 112.2, 435], ['road_bench4', 'bench', 238.7, 397.4], ['fork', 'fork', 266.6, 386.8], ['toHotel', 'hotel', 325.8, 409.5], ['toVillage', 'gate', 313, 350.4]],
  };
  const STATIC_HOTEL = { main: { x0: -26, x1: 22, z0: 16, z1: 30 }, pool: { x0: 24, x1: 48, z0: 6, z1: 30, px0: 27, px1: 45, pz0: 15, pz1: 22 }, spa: { x0: -66, x1: -42, z0: -62, z1: -48 },
    green: { x: 27, z: -56, rx: 9.5, rz: 7 }, fire: { x: -40, z: -86, r: 1.3 }, tower: { x: -26, z: -24 }, courtyard: { x: -3, z: -3 } };
  // подписи точек гор (одинаковые для радара, списка и карточки); named:false — без названия села и этнографии
  function mtnLabel(id, kind, named, rid) {
    const L = {
      tower: rid === 'hotel' ? 'Башня — старт зиплайна' : 'Башня', square: rid === 'hotel' ? 'Двор с фонтаном' : 'Базарная площадь', bakery: 'Пекарня', spring: 'Родник', spring_lid: 'Родник с крышкой',
      wedding: named ? 'Пальтары и свадьба' : 'Ряженые и свадьба', kaz_try: named ? 'Каз — примерка' : 'Праздничный платок', workshop: 'Мастерская', museum: 'Комната образцов',
      roof: 'Крыша-терраса', zipLanding: 'Финиш зиплайна', park: 'Парковка', toRoad: 'Дорога вниз, в город', main: 'Отель', courtyard: 'Двор с фонтаном', pool: 'Бассейн', green: 'Мини-гольф',
      sports_look: 'Падел и мини-футбол', padel: 'Падел', football: 'Мини-футбол', spa: 'Банный комплекс', fire: 'Костровой круг', view: rid === 'hotel' ? 'Смотровая' : 'Смотровая',
      school: 'Школа', schoolYard: 'Школьный двор', towerPark: 'Разворот у башни',   // волна 6
      toCity: 'Город', road_view: 'Смотровая с лавочкой', fork: 'Развилка: к отелю', toHotel: 'Отель на вершине', toVillage: 'Ворота села', hotel: 'Отель на вершине',
    };
    if (/^road_bench/.test(id)) return 'Лавочка над долиной';
    return L[id] || (KINDS[kind] && KINDS[kind].name) || id;
  }
  function mtnLine(p, named) {
    if (p.id === 'toVillage') return 'Ещё чуть-чуть — и ворота.';
    if (p.id === 'toHotel') return 'Ветка вверх, к отелю на вершине.';
    if (p.id === 'zipLanding') return 'Сюда прилетают с троса от отеля.';
    if (p.id === 'tower' && p.rid === 'hotel') return 'Наверх — и вжух через долину.';
    if (p.id === 'square' || p.id === 'courtyard') return p.rid === 'hotel' ? 'Белые стены и фонтан.' : 'Лавки, лотки и годекан.';
    if (p.id === 'view' && p.rid === 'hotel') return 'Скамья и вид через долину.';
    if (p.kind === 'square') return 'Площадь.';
    if (p.id === 'knoll') return 'Видно все дома и крыши.';
    if (p.id === 'road_view') return 'Лавочка и вид над облаками.';
    if (p.id === 'toRoad') return 'Серпантин вниз.';
    if (p.id === 'spring_lid') return 'Крышку — открыть, воду — в ладошки.';
    if (p.id === 'padel') return 'Стеклянная коробка с сеткой.';
    if (p.id === 'football') return 'Маленькое поле с воротами.';
    if (p.kind === 'shop') return 'Лавка у площади.';
    return LINES[p.kind] || '';
  }
  // точка гор в одном виде: { id, kind, x, z, label, line, rid, far, list }
  function mtnPoi(raw, rid, named) {
    let kind = raw.kind;
    if (kind === 'park' && rid !== 'city') kind = 'parking';
    if (kind === 'village') kind = 'gate';
    if (!KINDS[kind]) kind = 'view';
    const p = { id: String(raw.id), kind, x: +raw.x, z: +raw.z, rid, far: !!raw.far, list: raw.list !== false };
    p.label = mtnLabel(p.id, kind, named, rid);
    if (p.label === p.id && raw.label) p.label = raw.label;
    if (raw.label && /^shop_/.test(p.id)) p.label = raw.label;
    p.line = mtnLine(p, named);
    return p;
  }
  const RCACHE = {};   // растры земли регионов (на сессию): rid → { cv, x0, z0, cell, nx, nz }

  // модель карты региона: h — ручка (или null — статичные данные)
  function mtnModel(rid, h, named) {
    const V = V_() || {}, B = MB[rid];
    const M = { rid, h: h || null, named, bounds: B, space: rid === 'hotel' ? 'hotel' : 'macro', ver: 0 };
    // высота для рельефа (тени склонов)
    const HD = (V.regions.hotel && V.regions.hotel.data) || {};
    M.height = h && typeof h.ground === 'function' ? (x, z) => h.ground(x, z)
      : rid === 'hotel' ? (typeof HD.ground === 'function' ? (x, z) => HD.ground(x, z) : () => 0)
        : (V.regions.serpentine && V.regions.serpentine.groundMacro ? (x, z) => V.regions.serpentine.groundMacro(x, z) : () => 0);
    M.toMacro = rid === 'hotel' ? (x, z) => { try { const f = (h && h.frame && h.frame.toMacro) || HD.toMacro; const q = f(x, 0, z); return [q.x, q.z]; } catch (e) { const F = (V.ZIP_GEO && V.ZIP_GEO.frame) || { x: 490, z: 500, ry: 0.722 }; const c = Math.cos(F.ry), s = Math.sin(F.ry); return [F.x + x * c + z * s, F.z - x * s + z * c]; } } : (x, z) => [x, z];
    // точки: живые (o.pois) — снаружи; здесь — статичные и добавки из ручки
    M.staticPois = () => (STATIC_POIS[rid] || []).map(a => mtnPoi({ id: a[0], kind: a[1], x: a[2], z: a[3], label: a[4] }, rid, named));
    M.extraPois = () => {
      const out = []; if (!h) return out;
      const sp = id => (h.spots || []).find(s => s.id === id);
      if (rid === 'kubachi') {
        const r = sp('roof'); if (r) out.push(mtnPoi({ id: 'roof', kind: 'roof', x: r.x, z: r.z }, rid, named));
        const k = sp('knoll'); if (k) out.push(mtnPoi({ id: 'knoll', kind: 'view', x: k.x, z: k.z, label: 'Западный уступ' }, rid, named));
        const ex = (h.exits || []).find(e => e.id === 'toRoad'); if (ex) out.push(mtnPoi({ id: 'toRoad', kind: 'city', x: ex.x, z: ex.z }, rid, named));
      } else if (rid === 'hotel') {
        const avg = re => { let n = 0, x = 0, z = 0; (h.colliders || []).forEach(c => { if (re.test(String(c.id || ''))) { n++; x += c.x; z += c.z; } }); return n ? [x / n, z / n] : null; };
        const pd = avg(/^padel$/), gl = avg(/^goal$/);
        if (pd) out.push(mtnPoi({ id: 'padel', kind: 'sport', x: pd[0], z: pd[1] }, rid, named));
        if (gl) out.push(mtnPoi({ id: 'football', kind: 'sport', x: gl[0], z: gl[1] }, rid, named));
      }
      return out;
    };
    // шпильки серпантина (на карте, без строки в списке)
    M.hairpins = [];
    if (rid === 'serpentine') {
      try {
        const P = path0(), runs = {};
        P.forEach((q, i) => { if (/^H\d$/.test(q.tag)) (runs[q.tag] = runs[q.tag] || []).push(i); });
        Object.keys(runs).sort().forEach(t => { const a = runs[t], q = P[a[a.length >> 1]]; M.hairpins.push({ id: 'hp' + t.slice(1), kind: 'hairpin', x: q.x, z: q.z, label: 'Шпилька ' + t.slice(1), list: false, rid }); });
      } catch (e) { /* без шпилек */ }
    }
    // растр земли по groundInfo (только с ручкой; в простое кусками) — село 0,6 м, отель 0,5 м; серпантин — без растра
    M.raster = RCACHE[rid] || null;
    let job = 0;
    M.startRaster = onDone => {
      if (M.raster || !h || typeof h.groundInfo !== 'function' || rid === 'serpentine') return;
      const cell = rid === 'kubachi' ? 0.6 : 0.5, nx = Math.ceil((B.x1 - B.x0) / cell), nz = Math.ceil((B.z1 - B.z0) / cell);
      const kinds = new Uint8Array(nx * nz), ys = new Float32Array(nx * nz), KI = {}; let kn = 0, j = 0;
      const step = () => {
        job = 0; if (M.dead) return;
        const t0 = now();
        while (j < nz) {
          const z = B.z0 + (j + 0.5) * cell, row = j * nx;
          for (let i = 0; i < nx; i++) {
            const x = B.x0 + (i + 0.5) * cell; let g = null;
            try { g = h.groundInfo(x, z); } catch (e) { g = null; }
            const k = g && g.kind ? g.kind : ''; let ki = KI[k]; if (ki === undefined) { ki = KI[k] = ++kn; }
            kinds[row + i] = ki; ys[row + i] = g && isFinite(g.y) ? g.y : 0;
          }
          j++;
          if (now() - t0 > 5) { job = setTimeout(step, 30); return; }
        }
        // цвет: вид земли × тень склона (по разнице высот соседей) — террасы и уступы читаются рельефом
        const cv = cnv(nx, nz), cx = cv.getContext('2d'), img = cx.createImageData(nx, nz), d = img.data, names = [];
        Object.keys(KI).forEach(k => { names[KI[k]] = k; });
        const PAL = GROUND_PAL[rid] || {};
        for (let q = 0; q < kinds.length; q++) {
          const col = PAL[names[kinds[q]]]; if (!col) continue;
          const i = q % nx, jj = (q / nx) | 0;
          const yl = ys[i > 0 ? q - 1 : q], yr = ys[i < nx - 1 ? q + 1 : q], yu = ys[jj > 0 ? q - nx : q], yd = ys[jj < nz - 1 ? q + nx : q];
          const sh = clamp(1 + ((yl - yr) + (yu - yd)) * 0.09, 0.8, 1.08), edge = Math.abs(yl - yr) + Math.abs(yu - yd) > 0.9 ? 0.86 : 1;
          d[q * 4] = clamp(col[0] * sh * edge, 0, 255); d[q * 4 + 1] = clamp(col[1] * sh * edge, 0, 255); d[q * 4 + 2] = clamp(col[2] * sh * edge, 0, 255); d[q * 4 + 3] = 255;
        }
        cx.putImageData(img, 0, 0);
        M.raster = RCACHE[rid] = { cv, x0: B.x0, z0: B.z0, cell, nx, nz };
        M.ver++;
        if (onDone) safe(onDone);
      };
      job = setTimeout(step, 400);
    };
    M.stop = () => { M.dead = true; clearTimeout(job); };
    // рисунок региона: c — 2D-контекст, s — пикселей на метр, (ox, oz) — мир в (0, 0) холста
    M.paint = (c, s, ox, oz, W, H, o = {}) => paintMtn(c, M, s, ox, oz, W, H, o);
    return M;
  }
  let PATH0 = null;
  const path0 = () => PATH0 || (PATH0 = V_().regions.serpentine.path());
  let HROAD0 = null;
  const hotelRoad0 = () => { if (HROAD0) return HROAD0; try { HROAD0 = V_().regions.serpentine.hotelRoad(); } catch (e) { HROAD0 = null; } return HROAD0; };
  const GROUND_PAL = {
    kubachi: { crest: [229, 219, 196], field: [214, 229, 188], rock: [206, 198, 191], ledge: [201, 191, 181], roof: [238, 223, 207], strip: [243, 231, 213], stair: [233, 207, 180], lot: [234, 224, 210],
      yard: [241, 229, 215], knoll: [214, 229, 188], tower: [222, 197, 162], path: [240, 223, 200], gravel: [227, 219, 207], square: [247, 228, 214], spring: [190, 221, 241], road: [214, 205, 222] },
    hotel: { relax: [212, 233, 204], slope: [219, 231, 202], road: [214, 205, 222], park: [227, 221, 231], stairs: [233, 215, 197], yard: [247, 238, 228], tower: [222, 197, 162], deck: [223, 201, 177], sport: [197, 225, 187] },
  };
  const ROOF_COL = { yard: '#EADBC8', silver: '#D6DAD4', silverRust: '#D9BFAB', rust: '#DDA080', slate: '#A9AEBA', red: '#D9928A' };
  // рельеф (тень склонов) — сетка step м, мягко растянутая; база для всех трёх регионов
  function hillshade(c, M, s, ox, oz, W, H, step, ramp, sk = 0.16, slo = 0.78, shi = 1.1) {
    const B = M.bounds, x0 = Math.max(B.x0, ox), z0 = Math.max(B.z0, oz), x1 = Math.min(B.x1, ox + W / s), z1 = Math.min(B.z1, oz + H / s);
    if (x1 <= x0 || z1 <= z0) return;
    const nx = Math.max(2, Math.ceil((x1 - x0) / step) + 1), nz = Math.max(2, Math.ceil((z1 - z0) / step) + 1);
    const ys = new Float32Array(nx * nz); let lo = 1e9, hi = -1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let y = 0; try { y = M.height(x0 + i * step, z0 + j * step); } catch (e) { y = 0; } if (!isFinite(y)) y = 0; ys[j * nx + i] = y; if (y < lo) lo = y; if (y > hi) hi = y; }
    const cv = cnv(nx, nz), cx = cv.getContext('2d'), img = cx.createImageData(nx, nz), d = img.data;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const q = j * nx + i, y = ys[q], t = hi > lo ? clamp((y - lo) / (hi - lo), 0, 1) : 0.5;   // ys — Float32: без clamp округление даёт t < 0
      const yl = ys[i > 0 ? q - 1 : q], yr = ys[i < nx - 1 ? q + 1 : q], yu = ys[j > 0 ? q - nx : q], yd = ys[j < nz - 1 ? q + nx : q];
      const sh = clamp(1 + ((yl - yr) * 0.7 + (yu - yd)) / step * sk, slo, shi);
      const k = clamp(Math.floor(t * (ramp.length - 1)), 0, ramp.length - 2), f = t * (ramp.length - 1) - k, a = ramp[k], b = ramp[k + 1];
      for (let ch = 0; ch < 3; ch++) d[q * 4 + ch] = clamp((a[ch] + (b[ch] - a[ch]) * f) * sh, 0, 255);
      d[q * 4 + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, (x0 - step / 2 - ox) * s, (z0 - step / 2 - oz) * s, nx * step * s, nz * step * s);
  }
  // повёрнутый прямоугольник по контракту коллайдеров (локальное x → (cos ry, −sin ry))
  function rbox(c, s, ox, oz, x, z, w, d, ry, fill, stroke) {
    const co = Math.cos(ry || 0), si = Math.sin(ry || 0);
    c.save(); c.transform(co * s, -si * s, si * s, co * s, (x - ox) * s, (z - oz) * s);
    c.fillStyle = fill; c.fillRect(-w / 2, -d / 2, w, d);
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1 / s; c.strokeRect(-w / 2, -d / 2, w, d); }
    c.restore();
  }
  function polyline(c, pts, s, ox, oz, w, col, cap) {
    if (!pts || pts.length < 2) return;
    c.beginPath(); pts.forEach((q, i) => { const x = ((q.x !== undefined ? q.x : q[0]) - ox) * s, y = ((q.z !== undefined ? q.z : q[1]) - oz) * s; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = col; c.lineWidth = Math.max(1, w * s); c.lineCap = cap || 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function paintMtn(c, M, s, ox, oz, W, H, o) {
    const V = V_() || {}, rid = M.rid, h = M.h, X = x => (x - ox) * s, Y = z => (z - oz) * s;
    c.save();
    c.fillStyle = rid === 'serpentine' ? '#E6EEDF' : '#EBF0DF'; c.fillRect(0, 0, W, H);
    // рельеф
    hillshade(c, M, s, ox, oz, W, H, rid === 'serpentine' ? 3 : 2, rid === 'serpentine' ? [[220, 230, 234], [216, 233, 206], [228, 237, 204], [243, 238, 214]] : [[220, 233, 206], [230, 238, 210], [242, 240, 220]], rid === 'serpentine' ? 0.06 : 0.1, rid === 'serpentine' ? 0.95 : 0.88, 1.05);
    // растр земли (виды покрытия)
    const R = M.raster;
    if (R && R.cv) { c.imageSmoothingEnabled = true; c.drawImage(R.cv, X(R.x0), Y(R.z0), R.nx * R.cell * s, R.nz * R.cell * s); }
    if (rid === 'kubachi') paintVillage(c, M, s, ox, oz, W, H, o, !!R);
    else if (rid === 'hotel') paintHotel(c, M, s, ox, oz, W, H, o, !!R);
    else paintRoad(c, M, s, ox, oz, W, H, o);
    // деревья — круги коллайдеров ручки (село, отель, серпантин)
    if (h && h.colliders) {
      let sd = 5; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      h.colliders.forEach(cl => {
        if (cl.type !== 'circle' || !/tree|trunk|crown|pine|oak/i.test(String(cl.id || cl.kind || ''))) return;
        const r = Math.max(1.3, (cl.r || 0.3) * 4) * s, col = COL.tree[Math.floor(rn() * COL.tree.length)];
        const x = X(cl.x), y = Y(cl.z); if (x < -r || y < -r || x > W + r || y > H + r) return;
        c.fillStyle = 'rgba(80,90,60,.16)'; c.beginPath(); c.arc(x + r * 0.25, y + r * 0.3, r, 0, TAU); c.fill();
        c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      });
    }
    c.restore();
  }
  function paintVillage(c, M, s, ox, oz, W, H, o, hasRaster) {
    const V = V_(), kd = V.regions.kubachi.data || {}, X = x => (x - ox) * s, Y = z => (z - oz) * s, h = M.h;
    const CZ = kd.CZ || 96;
    // без растра: улицы-полосы рядов дугами амфитеатра (P(r, φ) = (r·sinφ, CZ − r·cosφ) → угол на экране φ − π/2)
    if (!hasRaster && Array.isArray(kd.ROWS)) {
      c.lineCap = 'butt';
      kd.ROWS.forEach(r => {
        const sp = r.span || [-0.5, 0.5];
        c.strokeStyle = '#EFE2CF'; c.lineWidth = Math.max(1, (r.depth || 6) * s); c.beginPath(); c.arc(X(0), Y(CZ), (r.rb - (r.depth || 6) / 2) * s, sp[0] - PI / 2, sp[1] - PI / 2); c.stroke();
        c.strokeStyle = '#F6EBDB'; c.lineWidth = Math.max(1, (r.strip || 1.5) * s); c.beginPath(); c.arc(X(0), Y(CZ), (r.rb + (r.strip || 1.5) / 2) * s, sp[0] - PI / 2, sp[1] - PI / 2); c.stroke();
      });
    }
    // площадь
    const SQ = (h && h.places && h.places.square) || kd.SQUARE;
    if (SQ) rbox(c, s, ox, oz, SQ.x, SQ.z, SQ.w || 16, SQ.d || 11, SQ.ry || 0, COL.plaza, 'rgba(214,170,150,.45)');
    // дорога к парковке и вниз
    if (Array.isArray(kd.ROAD)) { polyline(c, kd.ROAD, s, ox, oz, 6.4, 'rgb(196,184,206)'); polyline(c, kd.ROAD, s, ox, oz, 5.2, 'rgb(214,205,222)'); }
    // волна 6: проезды села (улица, переулок к башне, дорога мимо школы к отелю) — оси из ручки h.drive.roads; площадь — уже выше
    const DR = h && h.drive && Array.isArray(h.drive.roads) ? h.drive.roads : null;
    if (DR) { DR.forEach(r => polyline(c, r.pts, s, ox, oz, (r.width || 5) + 1.2, 'rgb(196,184,206)')); DR.forEach(r => polyline(c, r.pts, s, ox, oz, r.width || 5, 'rgb(214,205,222)')); }
    // двор свадьбы
    const WD = h && h.places && h.places.wedding;
    if (WD) rbox(c, s, ox, oz, WD.x, WD.z, WD.w || 20, WD.d || 12, WD.ry || 0, '#F8E6E4', 'rgba(217,113,142,.5)');
    // дома: статичный список (цвет крыши) — иначе коллайдеры ручки
    let houses = null;
    try { houses = typeof kd.houses === 'function' ? kd.houses() : V.regions.kubachi._test && V.regions.kubachi._test.unpackHouses ? V.regions.kubachi._test.unpackHouses() : null; } catch (e) { houses = null; }
    const wall = Math.max(0.6, 0.55 * s);
    const drawHouse = (x, z, w, d, ry, col) => { rbox(c, s, ox, oz, x, z + wall / s, w, d, ry, shade(col, 0.82)); rbox(c, s, ox, oz, x, z, w, d, ry, col); };
    if (houses && houses.length) houses.forEach(q => { if (isFinite(q.x)) drawHouse(q.x, q.z, q.w, q.d, q.ry, ROOF_COL[q.roofMat] || '#E6D6C4'); });
    if (h && h.colliders) h.colliders.forEach(cl => {
      if (cl.type !== 'box') return; const id = String(cl.id || '');
      if (houses && houses.length && /^h\d/.test(id)) return;
      if (!/^(h\d|ht|museum|bakery|annex|shed|wed_house|shop|school(Annex)?\b)/.test(id) || /stair/.test(id)) return;
      drawHouse(cl.x, cl.z, cl.w, cl.d, cl.ry, /museum/.test(id) ? '#DCD3EC' : /bakery/.test(id) ? '#F2D9B8' : /wed_house/.test(id) ? '#F2D5DC' : '#E6D6C4');
    });
    else { [[kd.MUSEUM, '#DCD3EC'], [kd.BAKERY, '#F2D9B8']].forEach(([b, col]) => { if (b) drawHouse(b.x, b.z, b.w, b.d, b.ry, col); }); }
    // башня
    const TW = kd.TOWER;
    if (TW) {
      const r = (TW.rB || 3.7) * s;
      c.fillStyle = 'rgba(58,46,63,.18)'; c.beginPath(); c.arc(X(TW.x) + r * 0.2, Y(TW.z) + r * 0.3, r, 0, TAU); c.fill();
      c.fillStyle = '#D9B98C'; c.beginPath(); c.arc(X(TW.x), Y(TW.z), r, 0, TAU); c.fill();
      c.strokeStyle = '#B98C5A'; c.lineWidth = Math.max(1, 0.5 * s); c.setLineDash([Math.max(1, 0.6 * s), Math.max(1, 0.6 * s)]); c.beginPath(); c.arc(X(TW.x), Y(TW.z), r * 0.84, 0, TAU); c.stroke(); c.setLineDash([]);
    }
    // площадка финиша зиплайна и трос (в сторону отеля)
    const ZL = (h && h.places && h.places.zipLanding) || (V.ZIP_GEO && V.ZIP_GEO.landing);
    if (ZL) {
      rbox(c, s, ox, oz, ZL.x, ZL.z, 4, 3, ZL.ry || -2.46, '#E7D2B6', 'rgba(150,110,70,.5)');
      try { const r = V.zipline.route('macro'), dx = r.from.x - r.to.x, dz = r.from.z - r.to.z, L = Math.hypot(dx, dz); c.strokeStyle = 'rgba(78,74,82,.6)'; c.lineWidth = Math.max(1, 0.25 * s); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(r.to.x), Y(r.to.z)); c.lineTo(X(r.to.x + dx / L * 260), Y(r.to.z + dz / L * 260)); c.stroke(); c.setLineDash([]); } catch (e) { /* без троса */ }
    }
  }
  function paintHotel(c, M, s, ox, oz, W, H, o, hasRaster) {
    const V = V_(), HD = (V.regions.hotel && V.regions.hotel.data) || {}, h = M.h, P = (h && h.places) || STATIC_HOTEL, X = x => (x - ox) * s, Y = z => (z - oz) * s;
    const PADC = { yard: '#F8EEE4', park: '#E4DDE8', sport: '#C9E3BE', relax: '#D6EBCF', deck: '#E2CBB1' };
    if (!hasRaster) {
      (HD.PADS || []).forEach(p => { c.fillStyle = PADC[p.kind] || '#EDE6DA'; c.fillRect(X(p.x0), Y(p.z0), (p.x1 - p.x0) * s, (p.z1 - p.z0) * s); });
      (HD.STAIRS || []).forEach(p => { c.fillStyle = '#E8D3BC'; c.fillRect(X(p.x0), Y(p.z0), (p.x1 - p.x0) * s, (p.z1 - p.z0) * s); });
    }
    // дорога к отелю (снизу, от развилки серпантина)
    let road = null; try { road = h && h.road && h.road.points ? h.road.points() : HD.road ? HD.road() : null; } catch (e) { road = null; }
    if (road && road.length) { polyline(c, road, s, ox, oz, 6.6, 'rgb(196,184,206)'); polyline(c, road, s, ox, oz, 5.4, 'rgb(214,205,222)'); }
    // бассейн, грин, купели, костёр
    const pool = P.pool; if (pool) { c.fillStyle = '#DCEAF2'; c.fillRect(X(pool.x0), Y(pool.z0), (pool.x1 - pool.x0) * s, (pool.z1 - pool.z0) * s); if (pool.px0 !== undefined) { c.fillStyle = 'rgb(150,206,236)'; c.fillRect(X(pool.px0), Y(pool.pz0), (pool.px1 - pool.px0) * s, (pool.pz1 - pool.pz0) * s); } }
    const g = P.green; if (g) { c.fillStyle = '#A9D69A'; c.beginPath(); c.ellipse(X(g.x), Y(g.z), (g.rx || 9) * s, (g.rz || 7) * s, 0, 0, TAU); c.fill(); }
    const sp = P.spa; if (sp) { c.fillStyle = '#F1DDE6'; c.fillRect(X(sp.x0), Y(sp.z0), (sp.x1 - sp.x0) * s, (sp.z1 - sp.z0) * s); }
    // корпуса и спорт — коллайдеры ручки; без ручки — корпус из таблицы
    if (h && h.colliders) h.colliders.forEach(cl => {
      const id = String(cl.id || ''); if (cl.type !== 'box') return;
      const col = id === 'main' ? '#FFFFFF' : id === 'poolHall' ? '#D8ECF6' : id === 'spa' ? '#F4E2EA' : /^padel/.test(id) ? 'rgba(170,214,236,.8)' : /canopy/.test(id) ? '#F4E6D6' : id === 'gate' ? '#E9DCCB' : null;
      if (!col || (cl.w < 0.6 && cl.d < 0.6)) return;
      rbox(c, s, ox, oz, cl.x, cl.z + (id === 'main' ? 0.5 : 0), cl.w, cl.d, cl.ry, shade(col === '#FFFFFF' ? '#E8E2EC' : col, 0.85));
      rbox(c, s, ox, oz, cl.x, cl.z, cl.w, cl.d, cl.ry, col, id === 'main' ? 'rgba(111,155,201,.6)' : null);
    });
    else if (P.main) { c.fillStyle = '#DCD5E2'; c.fillRect(X(P.main.x0), Y(P.main.z0) + 0.7 * s, (P.main.x1 - P.main.x0) * s, (P.main.z1 - P.main.z0) * s); c.fillStyle = '#FFFFFF'; c.fillRect(X(P.main.x0), Y(P.main.z0), (P.main.x1 - P.main.x0) * s, (P.main.z1 - P.main.z0) * s); c.strokeStyle = 'rgba(111,155,201,.7)'; c.lineWidth = Math.max(1, 0.35 * s); c.strokeRect(X(P.main.x0), Y(P.main.z0), (P.main.x1 - P.main.x0) * s, (P.main.z1 - P.main.z0) * s); }
    // фонтан двора, костёр, башня
    const ct = P.courtyard; if (ct) { c.fillStyle = '#FFFDF9'; c.beginPath(); c.arc(X(ct.x), Y(ct.z), 2.4 * s, 0, TAU); c.fill(); c.fillStyle = 'rgb(176,214,238)'; c.beginPath(); c.arc(X(ct.x), Y(ct.z), 1.9 * s, 0, TAU); c.fill(); }
    const f = P.fire; if (f) { c.fillStyle = '#D9C2A6'; c.beginPath(); c.arc(X(f.x), Y(f.z), 4.2 * s, 0, TAU); c.fill(); c.fillStyle = '#F0A060'; c.beginPath(); c.arc(X(f.x), Y(f.z), Math.max(1.5, (f.r || 1.3) * s), 0, TAU); c.fill(); }
    const tw = P.tower; if (tw) { const r = 1.8 * s; c.fillStyle = '#D9B98C'; c.beginPath(); c.arc(X(tw.x), Y(tw.z), r, 0, TAU); c.fill(); c.strokeStyle = '#B98C5A'; c.lineWidth = Math.max(1, 0.35 * s); c.beginPath(); c.arc(X(tw.x), Y(tw.z), r * 0.8, 0, TAU); c.stroke(); }
    // трос зиплайна из башни — в сторону села
    if (tw) { try { const r = V.zipline.route('hotel'), dx = r.dir ? r.dir.x : 0, dz = r.dir ? r.dir.z : -1; c.strokeStyle = 'rgba(78,74,82,.6)'; c.lineWidth = Math.max(1, 0.25 * s); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(tw.x), Y(tw.z)); c.lineTo(X(tw.x + dx * 260), Y(tw.z + dz * 260)); c.stroke(); c.setLineDash([]); } catch (e) { /* без троса */ } }
  }
  function paintRoad(c, M, s, ox, oz, W, H, o) {
    let P = null; try { P = path0(); } catch (e) { P = null; }
    const hr = hotelRoad0();
    // ветка к отелю, потом основная дорога: бордюр и полотно
    if (hr && hr.points) { polyline(c, hr.points, s, ox, oz, 7.4, 'rgb(196,184,206)'); polyline(c, hr.points, s, ox, oz, 6, 'rgb(220,212,226)'); }
    if (P) {
      polyline(c, P, s, ox, oz, 8, 'rgb(196,184,206)'); polyline(c, P, s, ox, oz, 6.6, 'rgb(214,205,222)');
      // середина — пунктир (старая дорога)
      c.save(); c.setLineDash([Math.max(1.5, 1.4 * s), Math.max(2, 2.6 * s)]); polyline(c, P, s, ox, oz, 0.35, 'rgba(255,253,249,.8)', 'butt'); c.restore();
    }
  }

  /* =====================================================================
     РАДАР (волна 4B): общий круг для города и гор — «как в GTA», слева снизу над джойстиком
     ===================================================================== */
  const MAP_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" fill="#FBE1E7" stroke="#C2405B" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="#C2405B" stroke-width="2"/></svg>';
  // метка-путеводитель «📍» (одна на игру): { rid: 'city' | 'serpentine' | 'kubachi' | 'hotel', id, x, z, label, kind }
  let WAYPOINT = null;
  function setWaypoint(w) { WAYPOINT = w && isFinite(w.x) && isFinite(w.z) ? Object.assign({ rid: 'city' }, w) : null; return WAYPOINT; }
  // куда вести стрелку, если метка в другом регионе: выход текущего региона
  const EXIT_TO = { serpentine: { kubachi: 'toVillage', hotel: 'toHotel', city: 'toCity' }, kubachi: { serpentine: 'toRoad', hotel: 'toHotel', city: 'toRoad' }, hotel: { kubachi: 'zipline', serpentine: 'toRoad', city: 'toRoad' } };
  const CAR_COL = { sedan: '#D23A4A', coupe: '#79C2AA' };
  const carColOf = v => (v && v.covered ? '#C9B8C2' : CAR_COL[(v && v.model) || (window.WORLD && WORLD.carChoice ? safe(WORLD.carChoice) : 'coupe')] || CAR_COL.coupe);
  // машина сверху: a — угол «вперёд» на экране
  function carIcon(c, x, y, a, col, D) {
    const w = 6.2 * D, l = 10.4 * D;
    c.save(); c.translate(x, y); c.rotate(a + PI / 2);
    c.fillStyle = 'rgba(58,46,63,.22)'; rrect(c, -w / 2 + D, -l / 2 + 1.4 * D, w, l, 2.6 * D); c.fill();
    c.fillStyle = '#FFFFFF'; rrect(c, -w / 2 - 1.1 * D, -l / 2 - 1.1 * D, w + 2.2 * D, l + 2.2 * D, 3.4 * D); c.fill();
    c.fillStyle = col; rrect(c, -w / 2, -l / 2, w, l, 2.6 * D); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; rrect(c, -w / 2 + 1.1 * D, -l / 2 + 2 * D, w - 2.2 * D, 2.2 * D, 0.8 * D); c.fill();
    c.fillStyle = 'rgba(58,46,63,.18)'; rrect(c, -w / 2 + 1.1 * D, l / 2 - 3 * D, w - 2.2 * D, 1.6 * D, 0.6 * D); c.fill();
    c.restore();
  }
  // капля (дело / метка) в круге или на ободке со стрелкой наружу
  function rimDrop(X, x, z, col, g, id, kind) {
    const D = X.D, s = X.toS(x, z), c = X.c;
    if (X.inR(s, 9 * D)) { dropPin(c, s[0], s[1], 5.6 * D, col, g); X.add(id, kind, s, false); return; }
    const [rx, ry, ang] = X.onRing(s, 8.5 * D);
    c.save(); c.translate(rx, ry); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.moveTo(9.5 * D, 0); c.lineTo(5.5 * D, -4 * D); c.lineTo(5.5 * D, 4 * D); c.closePath(); c.fill(); c.restore();
    pin(c, kind === 'waypoint' ? 'waypoint' : 'mission', rx, ry, 6.2 * D, { shadow: false, col, g });
    X.add(id, kind, [rx, ry], true);
  }

  // cfg: { root(), label, size, hz, maxDpr, rotate, hero() → {x,z,ang,mode}, yaw(), busy(), base() → {cv,s,ox,oz}|null,
  //        items(X), key() → строка «что ещё сдвинулось», radius: {walk, drive}, onTap(), sheetOpen(), paper }
  function makeRadar(cfg) {
    ensureCss();
    // HUD v2: радар в углу слева внизу (12 px от краёв, Ø --hud-radar: 89 · 96 · 104 при 360 · 390 · 430); свернуть — строкой меню ☰
    const autoSize = () => { try { return window.HUD ? Math.round(HUD.metrics().radar.d) : 110; } catch (e) { return 110; } };
    let SIZE = cfg.size || autoSize();
    const HZ = cfg.hz || 10;
    const wrap = document.createElement('div'); wrap.className = 'wmm-wrap' + (cfg.cls ? ' ' + cfg.cls : '');
    wrap.innerHTML = `<button type="button" class="w-mini wmm" aria-label="${esc(cfg.label || 'Карта')}"><canvas></canvas><span class="wmm-ic">${MAP_SVG}</span></button>`;
    if (window.HUD) HUD.radarSlot(wrap);
    const btn = wrap.querySelector('.wmm'), mcv = wrap.querySelector('canvas');
    let MC = null; const mctx = () => MC || (MC = mcv.getContext('2d'));
    let mountedIn = null;
    const mount = () => { const r = cfg.root(); if (r && wrap.parentNode !== r) { r.appendChild(wrap); mountedIn = r; } };
    mount();
    let collapsed = !!lsGet().fold, visible = true, disposed = false, busy = false, under = false;
    wrap.classList.toggle('collapsed', collapsed);
    let D = 1, NB = null, lastKey = '';
    const sizeCanvas = () => { if (!cfg.size) SIZE = autoSize(); D = Math.min(DPR(), cfg.maxDpr || 2); mcv.width = mcv.height = Math.round(SIZE * D); NB = null; };
    sizeCanvas();
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { NB = null; lastKey = ''; }); } catch (e) { /* без шрифтов */ }
    const northBadge = () => { if (NB) return NB; const r = 6.5 * D, c = cnv(r * 2 + 2, r * 2 + 2), x = c.getContext('2d'); x.fillStyle = 'rgba(255,253,249,.95)'; x.beginPath(); x.arc(r + 1, r + 1, r, 0, TAU); x.fill(); x.fillStyle = '#C2405B'; x.font = `900 ${8.5 * D}px 'Comfortaa', 'Nunito', sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('С', r + 1, r + 1.5 * D / 2); NB = c; return c; };
    btn.addEventListener('click', e => { e.stopPropagation(); if (collapsed) { R.collapse(false); return; } if (cfg.onTap) cfg.onTap(); });
    const onResize = () => { if (!disposed) { sizeCanvas(); lastDraw = lastCheck = -1e9; if (cfg.onDpr) cfg.onDpr(D); } };
    window.addEventListener('resize', onResize);

    let rotMode = cfg.rotate || lsGet().rot || 'camera';
    let th = null, thDrawn = 0, rad = (cfg.radius && cfg.radius.walk) || 40, lastDraw = -1e9, lastCheck = -1e9, lastHero = null, speed = 0, cssRot = 0, lastYaw = null, lastT = now(), busyT = 0, wasOn = null;
    const stats = { calls: 0, sumMs: 0, maxMs: 0, draws: 0, drawMs: 0, drawMax: 0, frames: 0 };
    const dbg = { icons: [], th: 0, rad: 0, hero: null };
    const finishStat = t0 => { const ms = now() - t0; stats.calls++; stats.sumMs += ms; if (ms > stats.maxMs) stats.maxMs = ms; };

    function draw(h) {
      const t0 = now(), b = cfg.base ? cfg.base(D) : null, c = mctx(), S = mcv.width, Rr = S / 2;
      const k = (Rr - 2 * D) / rad, cos = Math.cos(th), sin = Math.sin(th);
      // круг обрезает CSS (border-radius + overflow) — без clip() на холсте: так дешевле
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = cfg.paper || COL.paper; c.fillRect(0, 0, S, S);
      if (b && b.cv) {
        c.save(); c.translate(Rr, Rr); c.rotate(th); const sc = k / b.s; c.scale(sc, sc);
        const half = rad * 1.5 * b.s, hx = (h.x - b.ox) * b.s, hy = (h.z - b.oz) * b.s;
        const cx0 = Math.max(0, hx - half), cy0 = Math.max(0, hy - half), cx1 = Math.min(b.cv.width, hx + half), cy1 = Math.min(b.cv.height, hy + half);
        if (cx1 > cx0 && cy1 > cy0) { c.imageSmoothingEnabled = true; c.drawImage(b.cv, cx0, cy0, cx1 - cx0, cy1 - cy0, cx0 - hx, cy0 - hy, cx1 - cx0, cy1 - cy0); }
        c.restore();
      }
      const toS = (x, z) => { const dx = (x - h.x) * k, dz = (z - h.z) * k; return [Rr + dx * cos - dz * sin, Rr + dx * sin + dz * cos]; };
      const scr = a => { const fx = Math.sin(a), fz = Math.cos(a); return Math.atan2(fx * sin + fz * cos, fx * cos - fz * sin); };
      dbg.icons = [];
      // веер — куда смотрит камера (при «по камере» — всегда вверх)
      if (typeof lastYaw === 'number') {
        const a = scr(lastYaw), rr = Rr * 0.92, g = c.createRadialGradient(Rr, Rr, 2 * D, Rr, Rr, rr);
        g.addColorStop(0, 'rgba(255,214,120,.5)'); g.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(Rr, Rr); c.arc(Rr, Rr, rr, a - 0.5, a + 0.5); c.closePath(); c.fill();
      }
      const X = {
        c, D, R: Rr, k, th, h, toS, scr,
        inR: (p, m) => Math.hypot(p[0] - Rr, p[1] - Rr) < Rr - m,
        onRing: (p, m) => { const a = Math.atan2(p[1] - Rr, p[0] - Rr); return [Rr + Math.cos(a) * (Rr - m), Rr + Math.sin(a) * (Rr - m), a]; },
        add: (id, kind, p, ring) => { dbg.icons.push({ id, kind, x: p[0] / D, y: p[1] / D, ring: !!ring }); },
      };
      cfg.items(X);
      // героиня в центре
      heroArrow(c, Rr, Rr, 6.4 * D, scr(h.ang || 0));
      // «С» на ободке — где север
      const na = -PI / 2 + th, nx = Rr + Math.cos(na) * (Rr - 8 * D), ny = Rr + Math.sin(na) * (Rr - 8 * D);
      const nb = northBadge(); c.drawImage(nb, nx - nb.width / 2, ny - nb.height / 2);
      dbg.icons.push({ id: '@north', kind: 'north', x: nx / D, y: ny / D });
      dbg.th = th; dbg.rad = rad; dbg.hero = { x: h.x, z: h.z };
      thDrawn = th; cssRot = 0; mcv.style.transform = '';
      const ms = now() - t0; stats.draws++; stats.drawMs += ms; stats.drawMax = Math.max(stats.drawMax, ms);
    }

    const R = {
      el: wrap, btn, canvas: mcv,
      get D() { return D; },
      update(dt) {
        if (disposed) return;
        const t0 = now();
        if (typeof dt !== 'number' || !(dt > 0)) dt = Math.min(0.1, (t0 - lastT) / 1000);
        dt = Math.min(dt, 0.25); lastT = t0; stats.frames++;
        if (cfg.sheetOpen && cfg.sheetOpen()) { finishStat(t0); return; }
        if (!visible) { finishStat(t0); return; }
        if (wrap.parentNode !== mountedIn || !wrap.isConnected) mount();
        const h = cfg.hero();
        const on = !!h;
        if (on !== wasOn) { wrap.classList.toggle('hide', !on); wasOn = on; }
        if (!on || collapsed) { finishStat(t0); return; }
        // недоступен во время диалога / мини-игры; бледнее, когда над ним палец джойстика (проверка 5 раз в секунду)
        if ((busyT -= dt) <= 0) {
          busyT = 0.2;
          const bz = !!cfg.busy(); if (bz !== busy) { busy = bz; wrap.classList.toggle('off', bz); }
          // HUD v2: джойстик под пальцем на радар не заезжает (HUD.joyPlace) — бледнеть не нужно
          const un = false;
          if (un !== under) { under = un; btn.style.opacity = un ? '.45' : ''; }
        }
        // поворот: к камере (плавно) или север сверху
        const yw = cfg.yaw(); lastYaw = typeof yw === 'number' ? yw : null;
        const yaw = rotMode === 'north' ? null : lastYaw;
        const thT = typeof yaw === 'number' ? -PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw)) : 0;
        if (th === null) th = thT; else th += angDiff(thT, th) * (1 - Math.exp(-dt * 8));
        // масштаб от скорости: пешком — radius.walk, на машине — до radius.drive
        if (lastHero) { const v = Math.hypot(h.x - lastHero.x, h.z - lastHero.z) / Math.max(dt, 1e-3); speed += (Math.min(v, 30) - speed) * (1 - Math.exp(-dt * 2)); }
        const jump = !!lastHero && Math.hypot(h.x - lastHero.x, h.z - lastHero.z) > 6;
        lastHero = { x: h.x, z: h.z };
        if (jump) speed = 0;
        const rw = (cfg.radius && cfg.radius.walk) || 40, rdv = (cfg.radius && cfg.radius.drive) || 62;
        const radT = rw + clamp((speed - 3.5) / 7, 0, 1) * (rdv - rw); rad += (radT - rad) * (1 - Math.exp(-dt * 1.5));
        // перерисовка 10 раз в секунду — только если что-то сдвинулось (стоит на месте — холст не трогаем)
        let drew = false;
        if (jump || t0 - lastCheck >= 1000 / HZ - 4) {
          lastCheck = t0;
          const key = Math.round(h.x * 8) + ',' + Math.round(h.z * 8) + ',' + Math.round(th * 300) + ',' + Math.round((h.ang || 0) * 40) + ',' + Math.round(rad * 4) + ',' + Math.round((lastYaw || 0) * 60) + ',' + (cfg.key ? cfg.key() : '');
          if (jump || key !== lastKey || t0 - lastDraw > 2000) { lastDraw = t0; lastKey = key; draw(h); drew = true; }
        }
        if (!drew) {   // между перерисовками — только CSS-поворот (без перерисовки холста)
          const d = th - thDrawn;
          if (Math.abs(d - cssRot) > 0.004) { cssRot = d; mcv.style.transform = `rotate(${d.toFixed(4)}rad)`; }
        }
        finishStat(t0);
      },
      redraw() { lastDraw = lastCheck = -1e9; lastKey = ''; },
      resetMotion() { lastHero = null; lastDraw = lastCheck = -1e9; },
      setVisible(b) { visible = !!b; wrap.classList.toggle('hide', !visible); wasOn = visible ? null : false; if (visible) lastDraw = lastCheck = -1e9; },
      collapse(b) { collapsed = !!b; wrap.classList.toggle('collapsed', collapsed); lsSet({ fold: collapsed }); lastDraw = lastCheck = -1e9; },
      isCollapsed: () => collapsed,
      rotate(mode) { rotMode = mode === 'north' ? 'north' : 'camera'; lastDraw = lastCheck = -1e9; },
      get rot() { return rotMode; },
      stats: () => ({ calls: stats.calls, avgMs: stats.calls ? stats.sumMs / stats.calls : 0, maxMs: stats.maxMs, draws: stats.draws, drawAvgMs: stats.draws ? stats.drawMs / stats.draws : 0, drawMaxMs: stats.drawMax, frames: stats.frames }),
      resetStats() { Object.assign(stats, { calls: 0, sumMs: 0, maxMs: 0, draws: 0, drawMs: 0, drawMax: 0 }); },
      debug: () => ({ icons: dbg.icons.slice(), th: dbg.th, rad: dbg.rad, hero: dbg.hero, busy, collapsed, visible, rot: rotMode, cssRot, under }),
      dispose() { disposed = true; window.removeEventListener('resize', onResize); wrap.remove(); },
    };
    return R;
  }
  // прибытие к метке: снять и сказать
  function wpArrive(h, rid) {
    const w = WAYPOINT; if (!w || w.rid !== rid || !h) return false;
    if (Math.hypot(h.x - w.x, h.z - w.z) > 4) return false;
    setWaypoint(null); haptic('success');
    try { const g = G_(); if (g && g.toast) g.toast('📍 На месте: ' + (w.label || 'метка'), 1800); } catch (e) { /* без тоста */ }
    return true;
  }

  /* =====================================================================
     МИНИ-КАРТА ГОРОДА (радар)
     ===================================================================== */
  // особые точки — значок с рисунком; двери (места, лавки, дела) — маленькие точки
  const RADAR_PIN = { view: 1, square: 1, park: 1, dogpark: 1, bikes: 1, garage: 1 };
  function create(opts = {}) {
    ensureCss();
    const o = opts, env = makeEnv(o);
    let A = null, sigA = '', base = null, sheet = null;
    const sigOf = () => { const L = env.layout() || {}, b = L.bounds || {}; const C = env.colliders(); return [b.x0, b.x1, b.z0, b.z1, (L.pois || []).length, (L.districts || []).length, C ? (C.boxes || []).length : 0, !!L.drivable].join('|'); };
    const getA = () => { const sg = sigOf(); if (!A || sg !== sigA) { A = analyze(env.layout(), env.colliders(), doorListOf(env.doorsSrc()), o); sigA = sg; base = null; api._pois = null; } return A; };
    const rootEl = () => o.root || (live().w && live().w.ui && live().w.ui.ui) || document.querySelector('#app') || document.body;
    // рисунок мини-карты: свой (растр 0,5 м, без деревьев), около 3,6 пикселя на метр
    function ensureBase(D) {
      const a = getA();
      if (base && base.a === a && base.D === D) return base;
      const F = a.F, ppm = clamp(1.25 * D * 1.1, 1.6, 4.4), maxDim = 1800, s = Math.min(ppm, maxDim / Math.max(F.x1 - F.x0, F.z1 - F.z0));
      const c = cnv((F.x1 - F.x0) * s, (F.z1 - F.z0) * s);
      paint(c.getContext('2d'), a, s, F.x0, F.z0, c.width, c.height, { cell: 0.5, mini: true });
      base = { a, D, cv: c, s, ox: F.x0, oz: F.z0 };
      return base;
    }
    // большая карта: растр 0,25 м считаем заранее, в простое, кусками по 6 мс
    let idleT = 0, disposed = false;
    const idleRaster = () => { if (disposed) return; const a = getA(); const R = a.raster(0.25, 6); if (!R.done) idleT = setTimeout(idleRaster, 60); };
    idleT = setTimeout(idleRaster, 1500);
    // что ещё может сдвинуться на карте: дело, машина, велосипед, собачка, метки «скоро», выезд, метка «📍»
    const pets = () => { if (o.getPets) return safe(o.getPets) || []; const w = live().w; const d = w && w.dog; if (!d || !d.state) return []; const st = safe(() => d.state()); return st && st.on && isFinite(st.x) ? [{ kind: 'dog', x: st.x, z: st.z }] : []; };
    const iconKey = () => { const t = env.target(), v = env.vehicles(), p = pets(), w = WAYPOINT; return (t ? Math.round(t.x) + ':' + Math.round(t.z) : '-') + '|' + v.map(q => Math.round(q.x * 4) + ':' + Math.round(q.z * 4) + ':' + Math.round((q.ry || 0) * 20) + (q.covered ? 'c' : '') + (q.model || '')).join(';') + '|' + p.map(q => Math.round(q.x * 2) + ':' + Math.round(q.z * 2)).join(';') + '|' + env.markers().length + '|' + (env.edgeOpen() ? 1 : 0) + '|' + (w ? w.rid + w.x + w.z : '-'); };
    function items(X) {
      const { c, D } = X, a = getA(), h = X.h;
      if (!api._pois || api._poisSig !== sigA) { api._pois = collectPois(o, a, doorListOf(env.doorsSrc())); api._poisSig = sigA; }
      const pr = 3.4 * D;
      api._pois.forEach(p => {
        if (p.kind === 'edge') return;
        const s = X.toS(p.x, p.z);
        if (RADAR_PIN[p.kind]) { if (!X.inR(s, 5 * D)) return; pin(c, p.kind, s[0], s[1], 4.7 * D, { shadow: false }); X.add(p.id, p.kind, s); return; }
        if (!X.inR(s, pr + 2 * D)) return;
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(s[0], s[1], pr, 0, TAU); c.fill();
        c.fillStyle = (KINDS[p.kind === 'mission' ? 'place' : p.kind] || KINDS.place).col; c.beginPath(); c.arc(s[0], s[1], pr * 0.68, 0, TAU); c.fill();
        X.add(p.id, p.kind, s);
      });
      env.markers().forEach(m => { if (m.style !== 'soon') return; const s = X.toS(m.x, m.z); if (!X.inR(s, 6 * D)) return; pin(c, 'place', s[0], s[1], 5 * D, { dim: true, g: 'lock', shadow: false }); X.add('soon:' + m.door, 'soon', s); });
      // выезд из города (если открыт): далеко — на ободке
      if (env.edgeOpen() && a.edge && typeof a.edge.x === 'number') {
        let s = X.toS(a.edge.x, a.edge.z), ring = false; if (!X.inR(s, 8 * D)) { s = X.onRing(s, 8 * D); ring = true; }
        pin(c, 'edge', s[0], s[1], 6.5 * D, { shadow: false }); X.add('edge', 'edge', s, ring);
      }
      // собачка-компаньон
      pets().forEach(p => { const s = X.toS(p.x, p.z); if (!X.inR(s, 4 * D)) return; pin(c, 'dog', s[0], s[1], 4 * D, { shadow: false }); X.add('@dog', 'dog', s); });
      // машина (сверху, цвет по модели) и велосипед: машина далеко — на ободке
      const drive = h.mode === 'drive';
      env.vehicles().forEach(v => {
        if (typeof v.x !== 'number') return;
        let s = X.toS(v.x, v.z), ring = false;
        if (!X.inR(s, 7 * D)) { if (v.kind !== 'car') return; s = X.onRing(s, 7 * D); ring = true; }
        if (v.kind === 'car') { if (drive && !ring) return; if (ring) pin(c, 'car', s[0], s[1], 5.2 * D, { shadow: false, col: carColOf(v) }); else carIcon(c, s[0], s[1], X.scr(v.ry || 0), carColOf(v), D); }
        else pin(c, 'bike', s[0], s[1], 5.4 * D, { shadow: false });
        X.add('@' + v.kind, v.kind, s, ring);
      });
      // метка «📍»: в городе — точкой; в горах — стрелкой к выезду
      const w = WAYPOINT;
      if (w) {
        if (w.rid === 'city') rimDrop(X, w.x, w.z, KINDS.waypoint.col, 'pin', '@waypoint', 'waypoint');
        else if (a.edge && typeof a.edge.x === 'number') rimDrop(X, a.edge.x, a.edge.z, KINDS.waypoint.col, 'pin', '@waypoint', 'waypoint');
      }
      // дело: капля; за краем — на ободке со стрелкой наружу
      const tg = env.target();
      if (tg && typeof tg.x === 'number') rimDrop(X, tg.x, tg.z, KINDS.mission.col, 'case', '@target', 'target');
    }
    const R = makeRadar({
      root: rootEl, label: 'Карта города', size: o.size, hz: o.hz || 10, maxDpr: o.maxDpr, rotate: o.rotate,
      hero: () => env.hero(), yaw: () => env.yaw(), busy: () => env.busy(),
      base: D => ensureBase(D), items, key: () => { const hh = env.hero(); if (hh) wpArrive(hh, 'city'); return iconKey(); },
      radius: { walk: 42, drive: 66 }, onTap: () => api.open(), sheetOpen: () => { if (sheet) { if (env.busy() && !sheet._busyOk) api.close(true); return true; } return false; },
    });
    const wrap = R.el;
    const api = {
      el: wrap,
      update(dt) { R.update(dt); },
      open(tab) {
        if (disposed || sheet) return false;
        if (env.busy()) { haptic('light'); return false; }
        haptic('light'); sfx('tap');
        const a = getA(); a.raster(0.25);
        sheet = openSheet(Object.assign({}, o, { miniPref: o.miniPref !== false, tab: typeof tab === 'string' ? tab : o.tab, radar: true }), env, () => a, {
          onClose: () => { sheet = null; R.redraw(); if (o.onClose) safe(o.onClose); },
          onPref: r => { R.rotate(r); },
          travel: (p, sh) => api._go(p, sh),
        });
        if (o.onOpen) safe(o.onOpen);
        return true;
      },
      close(instant) { if (sheet) sheet.close(instant); },
      isOpen: () => !!sheet,
      sheet: () => sheet,
      setVisible(b) { R.setVisible(b); },
      collapse(b) { R.collapse(b); },
      isCollapsed: () => R.isCollapsed(),
      rotate(mode) { R.rotate(mode); },
      rebuild() { A = null; base = null; api._pois = null; R.redraw(); },
      // «Поехать сюда» по id точки (для проверок и интегратора); false — замок или нет точки
      async travel(id) {
        const a = getA(); const pois = collectPois(o, a, doorListOf(env.doorsSrc()));
        const p = pois.find(q => q.id === id); if (!p) return false;
        const inf = o.checkTravel ? safe(o.checkTravel, p) : defaultCheck(env, a, p);
        if (inf && inf.ok === false) return false;
        return api._go(p, null);
      },
      async _go(p, sh) {
        const a = getA(), spot = spotOf(a, p);
        if (sh) sh.close();
        const host = o.cloudRoot || document.querySelector('#app') || document.body;
        const run = () => (o.onTravel ? o.onTravel(p, spot) : defaultTravel(p, spot));
        let ok = true;
        try {
          if (o.clouds === false) await run(); else await cloudsTravel(host, p.label, run);
        } catch (e) { ok = false; console.warn('minimap travel', e); const g = G_(); if (g && g.toast) g.toast('Сюда пока не доехать. Давай пешком?', 2200); }
        R.resetMotion();
        if (ok && o.onArrive) safe(o.onArrive, p);
        return ok;
      },
      setWaypoint: w => { setWaypoint(w); R.redraw(); return WAYPOINT; },
      stats: () => R.stats(),
      resetStats() { R.resetStats(); },
      debug: () => R.debug(),
      analysis: () => getA(),
      dispose() {
        disposed = true; clearTimeout(idleT);
        if (sheet) sheet.close(true);
        R.dispose(); base = null; A = null;
      },
    };
    if (/debug=1/.test(location.search)) window.__minimap = api;
    return api;
  }

  /* =====================================================================
     РАДАР В ГОРАХ — WORLD.Minimap.region(o) (зовёт js/world/regions.js при каждой загрузке региона)
     o = { host, layer, rid, handle, named, season, info() → R.mapInfo(), getHero(), getCamYaw(), getVehicles(), pois(), isBusy(),
           onTravel?(regionId, poiId, poi) — «Поехать сюда» (интегратор), tripOpen?() }
     ===================================================================== */
  const LIVE_POIS = {};   // последние живые точки региона (для большой карты из города в ту же сессию)
  function region(o = {}) {
    ensureCss();
    if (!mtnOk() || !o.rid || !MB[o.rid]) return { update() {}, dispose() {}, open() { return false; }, el: null, debug: () => null, stats: () => null };
    const rid = o.rid, named = o.named !== false, h = o.handle || null;
    const M = mtnModel(rid, h, named);
    let base = null, info = null, pois = [], poisT = -1e9, sheet = null, disposed = false;
    const refreshPois = () => {
      const raw = (typeof o.pois === 'function' ? safe(o.pois) : null) || (info && info.pois) || null;
      let list = raw && raw.length ? raw.map(p => mtnPoi(p, rid, named)) : M.staticPois();
      // добавки из ручки (крыша-терраса, уступ, дорога вниз; падел и футбол — отдельно)
      M.extraPois().forEach(p => { if (!list.some(q => q.id === p.id)) list.push(p); });
      if (list.some(q => q.id === 'padel' || q.id === 'football')) list = list.filter(q => q.id !== 'sports_look');
      list.forEach(p => { if (p.id === 'spa') p.label = mtnLabel('spa', 'spa', named, rid); });
      pois = list; LIVE_POIS[rid] = list.filter(p => !p.far);
    };
    function ensureBase(D) {
      if (base && base.D === D && base.ver === M.ver) return base;
      const B = M.bounds, ppm = clamp(1.6 * D * 1.1, 1.8, 4.4), s = Math.min(ppm, 1600 / Math.max(B.x1 - B.x0, B.z1 - B.z0));
      const c = cnv((B.x1 - B.x0) * s, (B.z1 - B.z0) * s);
      M.paint(c.getContext('2d'), s, B.x0, B.z0, c.width, c.height, { mini: true });
      base = { D, ver: M.ver, cv: c, s, ox: B.x0, oz: B.z0 };
      return base;
    }
    M.startRaster(() => { if (!disposed) Rd.redraw(); });
    const inCar = () => !!(info && info.car && info.car.inCar);
    const exitPos = id => { const e = info && info.exits && info.exits.find(q => q.id === id); return e ? e : (STATIC_POIS[rid] || []).filter(a => a[0] === id).map(a => ({ x: a[2], z: a[3] }))[0] || null; };
    function items(X) {
      const { c, D } = X;
      // шпильки серпантина
      M.hairpins.forEach(p => { const s = X.toS(p.x, p.z); if (!X.inR(s, 5 * D)) return; pin(c, 'hairpin', s[0], s[1], 4 * D, { shadow: false }); X.add(p.id, 'hairpin', s); });
      // точки региона; далёкие (отель из села) — на ободке
      pois.forEach(p => {
        let s = X.toS(p.x, p.z), ring = false;
        if (!X.inR(s, 5.5 * D)) { if (!p.far) return; s = X.onRing(s, 6.5 * D); ring = true; }
        pin(c, p.kind, s[0], s[1], (ring ? 4.4 : 4.9) * D, { shadow: false });
        X.add(p.id, p.kind, s, ring);
      });
      // зверята
      (info && info.pets || []).forEach((p, i) => { const s = X.toS(p.x, p.z); if (!X.inR(s, 4 * D)) return; pin(c, 'dog', s[0], s[1], 3.8 * D, { shadow: false, col: p.kind === 'cat' ? '#C9A27E' : undefined }); X.add('@pet' + i, p.kind || 'dog', s); });
      // машина, когда она не за рулём: сверху, далеко — на ободке
      const car = info && info.car;
      if (car && !car.inCar && isFinite(car.x)) {
        let s = X.toS(car.x, car.z), ring = false;
        if (!X.inR(s, 7 * D)) { s = X.onRing(s, 7 * D); ring = true; }
        if (ring) pin(c, 'car', s[0], s[1], 5.2 * D, { shadow: false, col: carColOf({ model: car.kind }) }); else carIcon(c, s[0], s[1], X.scr(car.ry || 0), carColOf({ model: car.kind }), D);
        X.add('@car', 'car', s, ring);
      }
      // метка «📍»: в этом регионе — точкой; в другом — к выезду, который туда ведёт
      const w = WAYPOINT;
      if (w) {
        if (w.rid === rid) rimDrop(X, w.x, w.z, KINDS.waypoint.col, 'pin', '@waypoint', 'waypoint');
        else { const ex = EXIT_TO[rid] && EXIT_TO[rid][w.rid] && exitPos(EXIT_TO[rid][w.rid]); if (ex) rimDrop(X, ex.x, ex.z, KINDS.waypoint.col, 'pin', '@waypoint', 'waypoint'); }
      }
    }
    const hero = () => {
      if (disposed) return null;
      const hh = safe(o.getHero); if (!hh || !isFinite(hh.x)) return null;
      if (inCar() && info.car) return { x: hh.x, z: hh.z, ang: info.car.ry, mode: 'drive' };
      return hh;
    };
    const host = () => (o.host && o.host.isConnected ? o.host : null);
    const Rd = makeRadar({
      root: host, label: 'Карта: ' + (rid === 'kubachi' ? villageTitle(named) : rid === 'hotel' ? 'отель на вершине' : 'дорога наверх'), size: o.size, hz: o.hz || 10, maxDpr: o.maxDpr,
      hero, yaw: () => safe(o.getCamYaw), busy: () => !!safe(o.isBusy),
      base: D => ensureBase(D), items,
      key: () => {
        info = safe(o.info) || info;
        const t = now(); if (t - poisT > 1500) { poisT = t; refreshPois(); }
        const hh = safe(o.getHero); if (hh) wpArrive(hh, rid);
        const car = info && info.car, w = WAYPOINT;
        return (car ? Math.round(car.x * 4) + ':' + Math.round(car.z * 4) + ':' + (car.inCar ? 1 : 0) + ':' + Math.round((car.ry || 0) * 20) : '-') + '|' + ((info && info.pets) || []).map(p => Math.round(p.x * 2) + ':' + Math.round(p.z * 2)).join(';') + '|' + pois.length + '|' + M.ver + '|' + (w ? w.rid + w.x + w.z : '-');
      },
      radius: rid === 'serpentine' ? { walk: 46, drive: 78 } : rid === 'kubachi' ? { walk: 32, drive: 48 } : { walk: 38, drive: 56 },
      paper: '#E6EDDC',
      onTap: () => api.open(),
      sheetOpen: () => { if (sheet) { if (!sheet.el || !sheet.el.isConnected) { sheet = null; return false; } return true; } return false; },
    });
    info = safe(o.info); refreshPois();
    // радар города (та же .w-root, город на паузе) прячем, пока в горах свой радар; вернём при выгрузке региона
    const hidden = [];
    try { const top = (o.host && (o.host.closest('.w-root') || o.host.parentNode)) || document; top.querySelectorAll('.wmm-wrap').forEach(e => { if (e !== Rd.el && !e.classList.contains('wmm-off')) { e.classList.add('wmm-off'); hidden.push(e); } }); } catch (e) { /* без города */ }
    const api = {
      el: Rd.el, model: M,
      update(dt) { Rd.update(dt); },
      open(tab) {
        if (disposed || sheet) return false;
        if (safe(o.isBusy)) { haptic('light'); return false; }
        haptic('light'); sfx('tap');
        const env = makeEnv({ getHero: null, getCamYaw: null, getTarget: null, getMarkers: () => [], getVehicles: () => [], isBusy: () => false });
        sheet = openSheet({ title: 'Карта', tab: typeof tab === 'string' ? tab : 'mtn', sub: rid, radar: true, named, layer: o.layer || undefined, here: { rid, get: () => { const hh = hero(); return hh ? { x: hh.x, z: hh.z, ang: hh.ang, yaw: safe(o.getCamYaw) } : null; } }, livePois: { [rid]: () => pois }, regionModel: { [rid]: M },
          onTravelRegion: o.onTravel || null, tripOpen: o.tripOpen || (() => true), miniPref: false }, env, null, {
          onClose: () => { sheet = null; Rd.redraw(); },
          travelRegion: typeof o.onTravel === 'function' ? (p, sh) => api._goRegion(p, sh) : undefined,
        });
        return true;
      },
      close(instant) { if (sheet) sheet.close(instant); },
      isOpen: () => !!sheet,
      sheet: () => sheet,
      async _goRegion(p, sh) {
        if (sh) sh.close();
        if (typeof o.onTravel !== 'function') return false;
        try { await o.onTravel(p.rid, p.id, p); } catch (e) { console.warn('region travel', e); return false; }
        Rd.resetMotion();
        return true;
      },
      setWaypoint: w => { setWaypoint(w); Rd.redraw(); return WAYPOINT; },
      pois: () => pois.slice(),
      stats: () => Rd.stats(), resetStats: () => Rd.resetStats(),
      debug: () => Object.assign(Rd.debug(), { rid, raster: !!M.raster, pois: pois.length }),
      setVisible: b => Rd.setVisible(b), collapse: b => Rd.collapse(b), isCollapsed: () => Rd.isCollapsed(),
      dispose() { if (disposed) return; disposed = true; M.stop(); if (sheet) sheet.close(true); Rd.dispose(); base = null; hidden.forEach(e => e.classList.remove('wmm-off')); hidden.length = 0; },
    };
    if (/debug=1/.test(location.search)) window.__radar = api;
    return api;
  }

  WORLD.Minimap = {
    create,
    // радар в горах (js/world/regions.js зовёт при каждой загрузке региона) — см. заголовок файла
    region, createRegion: region,
    // большая карта без мини-карты (2D-город): рисунок, если есть WORLD.LAYOUT, и список мест; с модулями гор — вкладки «Кубачи» и «Обзор»
    openSheet(o = {}) {
      const env = makeEnv(Object.assign({ getHero: o.getHero || null, getCamYaw: o.getCamYaw || null, getTarget: o.getTarget || null }, o));
      const sh = openSheet(o, env, null, { onClose: o.onClose, travel: (p, s2) => { s2.close(); const spot = spotOf(analyze(env.layout(), env.colliders(), doorListOf(env.doorsSrc()), o), p); const run = () => (o.onTravel ? o.onTravel(p, spot) : null); return o.clouds ? cloudsTravel(o.cloudRoot || document.querySelector('#app') || document.body, p.label, run).then(() => true) : Promise.resolve(run()).then(() => true); } });
      return sh;
    },
    // лист сразу на «Обзоре» (кнопка «Как добраться», 2D-город)
    overview(o = {}) { return WORLD.Minimap.openSheet(Object.assign({ tab: 'ov' }, o)); },
    // метка-путеводитель «📍» (одна на игру; радар города и гор показывают метку стрелкой)
    waypoint: () => (WAYPOINT ? Object.assign({}, WAYPOINT) : null),
    setWaypoint: w => setWaypoint(w), clearWaypoint: () => setWaypoint(null),
    analyze: (L, C, doors, o) => analyze(L || WORLD.LAYOUT, C, doorListOf(doors), o),
    travelDefault: defaultTravel,   // перенос через живой город — чтобы обернуть своим onTravel (звук, событие, задержка)
    paint, pin, KINDS,
    // для проверок: модель карты региона и точки по умолчанию
    _mtn: { model: (rid, h, named) => mtnModel(rid, h || null, named !== false), STATIC_POIS, LIVE_POIS, RCACHE, OV_B },
  };
})();
