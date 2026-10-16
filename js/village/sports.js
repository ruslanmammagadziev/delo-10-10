/* =====================================================================
   СПОРТ В ОТЕЛЕ (волна 5): три коротких мини-игры на кортах отеля — падел, мини-футбол, мини-гольф.
   Желание автора: «чтобы она могла играть в падл, мини-футбол (поправить механику игры в гольф, т.к. я смог только
   один раз сыграть)». Каждая игра 30–90 с, в конце «Ещё раз» / «Хватит», лучший результат держится в сессии;
   игра не занимает и не «расходует» место — сыграть можно сколько угодно раз.

   Обычный <script> (без модулей), Three.js r149. Зависимостей нет (только THREE); по желанию — Interact (лупу — в карман).

   API:
     VILLAGE.sports.start(kind 'padel'|'football'|'golf', o) → ctrl
       o.THREE, o.scene, o.camera              — обязательно; камерой игра управляет сама (в конце — возвращает как было)
       o.hero      — корень героини (Object3D) или { root, body }; o.anim — HeroAnim.create(...) (кости anim.bones)
       o.court     — { x, y, z, ry, w, d, … } поле в осях сцены: центр, высота покрытия, поворот (локальная +z → (sin ry, cos ry)),
                     ширина (локальная x) и длина (локальная z). Готовые поля отеля — VILLAGE.sports.HOTEL.{padel,football,golf}.
                     падел: netH; футбол: goalW, goalH, goalD (ворота — на +z), spotD (11-метровая… тут 6 м);
                     гольф: shape 'ellipse', rim, tees [[x,z]…], holes [[x,z]…], bunker {x,z,rx,rz} (мировые x,z), par […].
       o.ui        — { host } элемент поверх холста (position: relative/absolute): игра кладёт туда свой слой и убирает его
       o.onEnd(r)  — один раз, когда игра закончилась: r = { kind, reason: 'quit'|'stop', rounds, last, best }
       o.onEvent(name, data) — по желанию: 'line' {who,text} (озвучка), 'hero' {text}, 'sfx' {k}, 'haptic' k, 'round' {…}
       o.ia        — по желанию: Interact (лупа уходит в карман на время игры и возвращается в конце)
       o.returnTo  — {x,y,z,ry}: куда поставить героиню в конце (по умолчанию — где она стояла до игры: у места)
       o.hide      — [Object3D]: спрятать на время игры (например, h.golf.ball — мяч старого гольфа отеля)
       o.variant   — футбол: 'penalty' (по умолчанию) | 'pass' (пас-пас с Зайкой)
       o.bubbles   — false: не рисовать свои облачка (реплики только через onEvent 'line' / 'hero')
       o.seed      — число: повторяемый случай (тесты)
     ctrl.update(dt) — раз в кадр ВМЕСТО своих anim.update / IA.update / камеры игры (как зиплайн с external:true):
                       двигает героиню, зовёт anim.update (+ ia.animState/ia.update), кладёт позы поверх, ведёт камеру.
     ctrl.stop()     — закончить сразу (onEnd с reason 'stop'); всё своё убирается: сетки, материалы, DOM, слушатели.
     ctrl.state()    — { kind, phase, round, score…, best } — для тестов и отладки; ctrl.kind, ctrl.active
     ctrl.debug      — для тестов: tap(), swipe(dx,dy,ms), drag(dx,dy), release(), again(), quit(), restart(), auto(mode),
                       aim(angle,power) / shoot() (гольф), objects() (что добавлено в сцену), ideal() …
     VILLAGE.sports.best() → { padel, football, golf } — лучшие за сессию; VILLAGE.sports.reset() — забыть
     VILLAGE.sports.HOTEL — поля отеля (копия констант js/village/hotel.js: PADEL, PITCH, GREEN) + spots у входов;
     VILLAGE.sports.spotsFor(h) → места, которых в h.spots ещё нет (padel_play, football_play; golf_putt у отеля уже есть):
       use() → { kind: 'sport', sport, court, returnTo, npc } — игра зовёт start(sport, …); kind 'golf' старого места — туда же
     VILLAGE.sports.LINES / SPEAKERS — реплики { who, text } (для озвучки) и голоса новых зверят

   Позы героини — поверх HeroAnim после anim.update (и после ia.update), как js/interact.js: ракетка в правой кисти
   (бэкхенд — двумя руками), удар ногой — правой (бедро/голень/стопа + полы пальто), паттер — двумя руками маятником.
   Соперники — свои мультяшные зверята: одна сетка со скелетом (тело, голова, лапки, ножки) и контуром → 1 вызов.
   Бюджет: ≤ 7 сеток на игру (замер: +3…6 вызовов); выделений в кадре — десятки байт (векторы заранее).
   Проверка: tests/w5_sports.js (стенд tests/w5/sports.html, ?real=1 — настоящий отель); отчёт и NEEDS — plan2/wave5_sports.md.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
  const angW = a => a - TAU * Math.round(a / TAU);
  const easeOut = u => 1 - (1 - u) * (1 - u);
  function rng(seed) {
    let s = (seed >>> 0) || 0x9E3779B9;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /* =====================================================================
     1. РЕПЛИКИ: { who, text } — литералы для озвучки (tools/voice_build.py); героиня — короткие строки облачком
     ===================================================================== */
  const SPEAKERS = {
    sport_fox: { name: 'Лисичка', icon: '🦊', voice: 'звонкая, задорная, спортивная' },
    sport_bear: { name: 'Мишка-вратарь', icon: '🐻', voice: 'добродушный, басовитый, смешливый' },
    sport_bunny: { name: 'Зайка', icon: '🐰', voice: 'быстрая, радостная, тоненькая' },
  };
  const LINES = {
    padelStart: { who: 'hotel_raccoon', text: 'Падел! Играем до трёх очков. Бей, когда мячик в кружке!' },
    padelGlass: { who: 'hotel_raccoon', text: 'От стекла можно отбивать — это и есть падел!' },
    foxPoint: [{ who: 'sport_fox', text: 'Очко моё!' }, { who: 'sport_fox', text: 'Хи-хи, не достала!' }, { who: 'sport_fox', text: 'Лови-лови!' }],
    foxMiss: [{ who: 'sport_fox', text: 'Ой! Не успела!' }, { who: 'sport_fox', text: 'Ух, какой мяч!' }, { who: 'sport_fox', text: 'Ай, ловко!' }],
    foxNet: { who: 'sport_fox', text: 'Ой, в сетку!' },
    foxWinner: { who: 'sport_fox', text: 'Хоп — в уголок!' },
    foxWin: { who: 'sport_fox', text: 'Хорошая игра! Ещё разок?' },
    foxLose: { who: 'sport_fox', text: 'Ты выиграла! Сыграем ещё?' },
    footStart: { who: 'hotel_raccoon', text: 'Пенальти! Пять ударов — проведи пальцем к воротам.' },
    footPassStart: { who: 'hotel_raccoon', text: 'Пас-пас! Зайка катит мяч — бей с ходу!' },
    bearSave: [{ who: 'sport_bear', text: 'Поймал!' }, { who: 'sport_bear', text: 'Хоп — и в лапах!' }],
    bearParry: { who: 'sport_bear', text: 'Отбил! Фух!' },
    bearGoal: [{ who: 'sport_bear', text: 'Ой, не успел!' }, { who: 'sport_bear', text: 'Ух, какой удар!' }, { who: 'sport_bear', text: 'Я прыгнул не туда!' }],
    bearPost: { who: 'sport_bear', text: 'Дзынь! Штанга меня спасла.' },
    bunnyPass: [{ who: 'sport_bunny', text: 'Пас!' }, { who: 'sport_bunny', text: 'Лови мячик!' }, { who: 'sport_bunny', text: 'Бей!' }],
    bunnyGoal: { who: 'sport_bunny', text: 'Ура, гол!' },
    footEnd: { who: 'hotel_raccoon', text: 'Отличная серия! Ещё пять ударов?' },
    golfStart: { who: 'hotel_raccoon', text: 'Три лунки! Потяни назад и отпусти, как рогатку.' },
    golfAce: { who: 'hotel_raccoon', text: 'С одного удара! Вот это да!' },
    golfHoled: { who: 'hotel_raccoon', text: 'В лунке! Отлично!' },
    golfSand: { who: 'hotel_raccoon', text: 'Песочек мячик притормозил.' },
    golfEnd: { who: 'hotel_raccoon', text: 'Все три лунки пройдены! Сыграем ещё?' },
  };
  const SAY = {
    perfect: 'Супер!', good: 'Есть!', weak: 'Достала!', reach: 'Не дотянулась!', early: 'Подожду мячик…', miss: 'Ой, мимо!', point: 'Очко!', win: 'Победа!', lose: 'Ничего, ещё сыграем!',
    goal: 'Гол!', saved: 'Почти!', post: 'Ой, штанга!', wide: 'Мимо… Ничего!', high: 'Высоковато!', serve: 'Подача!',
    ace: 'Ура! С одного удара!', holed: 'В лунку!', putt: 'Так, прицелимся…', sand: 'Ой, песочек!',
  };
  function pick(list, r) { return Array.isArray(list) ? list[Math.floor(r() * list.length) % list.length] : list; }
  function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; }

  /* ---------- лучшие за сессию ---------- */
  const BEST = { padel: null, football: null, golf: null };
  const ROUNDS = { padel: 0, football: 0, golf: 0 };

  /* ---------- поля отеля (те же константы, что в js/village/hotel.js: PADEL, PITCH, GREEN; y = −4 — средний ярус) ---------- */
  const HOTEL = {
    padel: { x: 8, y: -4, z: -79, ry: 0, w: 10, d: 20, netH: 0.9 },
    football: { x: 64, y: -4, z: -79, ry: PI / 2, w: 22, d: 34, goalW: 3, goalH: 2, goalD: 1, goalZ: 16.9, spotD: 6 },
    golf: { x: 27, y: -3.91, z: -56, ry: 0, w: 19, d: 14, shape: 'ellipse', rim: 1.06,
      tees: [[21.6, -51.6], [25.6, -56.0], [31.4, -56.6]], holes: [[29.4, -58.4], [33.5, -53.2], [24.2, -60.6]], par: [2, 3, 2],
      bunker: { x: 33.2, z: -50.4, rx: 1.6, rz: 1.0 } },
    // места для h.spots (у входов): use() → { kind: 'sport', sport } — игра зовёт VILLAGE.sports.start(sport, …)
    spots: [
      { id: 'padel_play', sport: 'padel', x: 14.6, y: -4, z: -79, r: 1.6, ry: -PI / 2, icon: '🎾', label: 'Падел', action: 'Сыграть в падел' },
      { id: 'football_play', sport: 'football', x: 64, y: -4, z: -65.6, r: 1.7, ry: PI, icon: '⚽', label: 'Мини-футбол', action: 'Пробить пенальти' },
      { id: 'golf_putt', sport: 'golf', x: 20.9, y: -4, z: -51.0, r: 1.6, ry: PI * 0.75, icon: '⛳', label: 'Мини-гольф', action: 'Сыграть: три лунки' },
    ],
  };

  /* ---------- оси поля ---------- */
  function Frame(c) {
    const cs = Math.cos(c.ry || 0), sn = Math.sin(c.ry || 0);
    return {
      c, cs, sn, y: c.y || 0,
      toW(lx, ly, lz, out) { out.x = c.x + lx * cs + lz * sn; out.y = (c.y || 0) + ly; out.z = c.z - lx * sn + lz * cs; return out; },
      toL(wx, wz, out) { const dx = wx - c.x, dz = wz - c.z; out.x = dx * cs - dz * sn; out.z = dx * sn + dz * cs; return out; },
      yaw: ly => ly + (c.ry || 0),
    };
  }

  /* =====================================================================
     2. СТИЛЬ (DOM): слой игры, счёт, подсказка, кнопки справа внизу, облачка, вспышка, карточка «Ещё раз / Хватит»
     ===================================================================== */
  const CSS = `
.vs-root{position:absolute;inset:0;z-index:46;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;font-family:inherit;color:var(--ink,#3A2E3F);overflow:hidden;cursor:pointer}
.vs-fade{position:absolute;inset:0;background:#FFF8F2;opacity:0;pointer-events:none}
.vs-score{position:absolute;left:50%;top:calc(60px + var(--safe-top,0px));transform:translateX(-50%);background:rgba(255,253,249,.95);border-radius:18px;padding:7px 16px;font-weight:900;font-size:16px;line-height:1.2;box-shadow:0 3px 0 rgba(58,46,63,.13);text-align:center;white-space:nowrap;pointer-events:none;max-width:calc(100% - 132px);overflow:hidden;text-overflow:ellipsis}
.vs-score small{display:block;font-size:12px;font-weight:800;color:var(--ink-2,#6E6272)}
.vs-score .dots{letter-spacing:2px;font-size:13px}
.vs-quit{position:absolute;right:12px;top:calc(60px + var(--safe-top,0px));height:44px;min-width:44px;padding:0 14px;border:0;border-radius:22px;background:rgba(255,253,249,.96);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:15px;box-shadow:0 4px 0 rgba(58,46,63,.16);cursor:pointer;touch-action:manipulation}
.vs-hint{position:absolute;left:50%;top:calc(116px + var(--safe-top,0px));transform:translateX(-50%);width:max-content;max-width:min(84%,340px);background:rgba(58,46,63,.74);color:#fff;border-radius:14px;padding:7px 12px;font-weight:800;font-size:14px;line-height:1.3;text-align:center;opacity:0;transition:opacity .25s;pointer-events:none}
.vs-hint.on{opacity:1}
.vs-main{position:absolute;right:16px;bottom:calc(22px + var(--safe-bottom,0px));width:104px;height:104px;border:0;border-radius:50%;background:var(--cherry,#C2405B);color:#fff;font:inherit;font-weight:900;font-size:16px;box-shadow:0 6px 0 var(--cherry-d,#9E2F47);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:none;cursor:pointer;transition:opacity .2s}
.vs-main i{font-style:normal;font-size:30px;line-height:1}
.vs-main.down{transform:translateY(4px);box-shadow:0 2px 0 var(--cherry-d,#9E2F47)}
.vs-main.soft{opacity:.5}
.vs-side{position:absolute;right:16px;bottom:calc(140px + var(--safe-bottom,0px));height:48px;padding:0 16px;border:0;border-radius:24px;background:rgba(255,253,249,.96);color:var(--ink,#3A2E3F);font:inherit;font-weight:900;font-size:15px;box-shadow:0 4px 0 rgba(58,46,63,.16);cursor:pointer;touch-action:manipulation}
.vs-side.low{bottom:calc(22px + var(--safe-bottom,0px))}
.vs-bub{position:absolute;left:0;top:0;transform:translate(-50%,-100%);background:#fff;border-radius:16px;padding:6px 12px;font-weight:800;font-size:14px;line-height:1.25;box-shadow:0 3px 0 rgba(58,46,63,.14);white-space:normal;width:max-content;max-width:min(280px,76vw);text-align:center;pointer-events:none;opacity:0;transition:opacity .2s;will-change:transform}
.vs-bub::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-top-color:#fff;border-bottom:0}
.vs-bub.on{opacity:1}
.vs-bub b{display:block;font-size:11px;color:var(--cherry,#C2405B);font-weight:900}
.vs-bub.hero{background:#FFF0F4}.vs-bub.hero::after{border-top-color:#FFF0F4}
.vs-flash{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);font-weight:900;font-size:42px;color:#fff;text-shadow:0 3px 0 var(--cherry-d,#9E2F47),0 0 18px rgba(194,64,91,.45);opacity:0;pointer-events:none;white-space:nowrap}
.vs-flash.on{animation:vsPop 1.3s ease-out forwards}
@keyframes vsPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}14%{opacity:1;transform:translate(-50%,-50%) scale(1.14)}30%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}
.vs-swipe{position:absolute;left:0;top:0;height:10px;border-radius:5px;background:linear-gradient(90deg,rgba(255,255,255,.2),rgba(255,255,255,.95));transform-origin:0 50%;pointer-events:none;display:none;box-shadow:0 0 8px rgba(255,255,255,.6)}
.vs-end{position:absolute;inset:0;display:none;align-items:flex-end;justify-content:center;padding:0 10px calc(10px + var(--safe-bottom,0px));background:rgba(58,46,63,.26);cursor:default}
.vs-end.on{display:flex}
.vs-end .card{width:100%;max-width:420px;background:var(--paper,#FFFDF9);border-radius:26px 26px 22px 22px;padding:16px 18px 16px;box-shadow:0 18px 44px rgba(58,46,63,.28);text-align:center;animation:vsUp .35s ease-out}
@keyframes vsUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.vs-end .t{font-weight:900;font-size:22px;color:var(--cherry-d,#9E2F47)}
.vs-end .r{font-weight:800;font-size:17px;margin-top:4px;line-height:1.35}
.vs-end .b{font-weight:700;font-size:14px;color:var(--ink-2,#6E6272);margin-top:5px}
.vs-end .acts{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.vs-end button{min-height:50px;border:0;border-radius:16px;font:inherit;font-weight:900;font-size:16px;background:#F6E7EB;color:var(--ink,#3A2E3F);cursor:pointer;touch-action:manipulation}
.vs-end button.main{background:var(--cherry,#C2405B);color:#fff}
.vs-root.ended .vs-main,.vs-root.ended .vs-side,.vs-root.ended .vs-hint{display:none}
`;
  function ensureCss() {
    if (document.getElementById('vSportsCss')) return;
    const st = document.createElement('style'); st.id = 'vSportsCss'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* =====================================================================
     3. ИГРУШКИ: детали склеиваются в одну сетку (цвет в вершинах + вывернутая оболочка-контур в той же сетке → 1 вызов),
        зверята — одна сетка со скелетом из 7 костей (корень, тело, голова, лапки, ножки)
     ===================================================================== */
  const OL = 0x4A3A48;
  function toyKit(T, bag) {
    const gd = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 242, 242, 242, 255, 255, 255, 255, 255]);
    const grad = bag(new T.DataTexture(gd, 4, 1, T.RGBAFormat)); grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
    const mat = bag(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad }));
    const G = {
      sph: bag(new T.SphereGeometry(1, 16, 12)), sphLo: bag(new T.SphereGeometry(1, 10, 7)), cyl: bag(new T.CylinderGeometry(1, 1, 1, 14)),
      cone: bag(new T.ConeGeometry(1, 1, 14)), box: bag(new T.BoxGeometry(1, 1, 1)), cap: bag(new T.CapsuleGeometry(1, 1, 4, 10)),
      tor: bag(new T.TorusGeometry(1, 0.13, 6, 28)), ico: bag(new T.IcosahedronGeometry(1, 3)),
    };
    const _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
    const m4 = (p, r, s) => {
      _e.set(r ? r[0] || 0 : 0, r ? r[1] || 0 : 0, r ? r[2] || 0 : 0, (r && r[3]) || 'XYZ'); _q.setFromEuler(_e);
      _p.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
      if (s === undefined) _s.set(1, 1, 1); else if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
      return new T.Matrix4().compose(_p, _q, _s);
    };
    const part = (g, c, p, r, s, o) => Object.assign({ g, c, m: m4(p, r, s) }, o || {});
    const col = new T.Color(), olc = new T.Color(OL);
    // склейка: { g, c, m, b?: кость, ol?: толщина контура (0 — без контура), cf?: (pos,nrm,color) → цвет по точке }
    function merge(parts, opt) {
      opt = opt || {};
      const olT = opt.ol === undefined ? 0.016 : opt.ol, skin = !!opt.skin;
      const list = []; let n = 0;
      parts.forEach(p => { if (!p) return; const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()); g.applyMatrix4(p.m); list.push([g, p]); n += g.attributes.position.count * ((p.ol === 0 || olT === 0) ? 1 : 2); });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3);
      const si = skin ? new Uint16Array(n * 4) : null, sw = skin ? new Float32Array(n * 4) : null;
      let o = 0;
      const put = (P, N, i, t, c, b) => {
        const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
        pos[o * 3] = P.getX(i) + nx * t; pos[o * 3 + 1] = P.getY(i) + ny * t; pos[o * 3 + 2] = P.getZ(i) + nz * t;
        nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
        cl[o * 3] = c.r; cl[o * 3 + 1] = c.g; cl[o * 3 + 2] = c.b;
        if (skin) { si[o * 4] = b || 0; sw[o * 4] = 1; }
        o++;
      };
      const tmpC = new T.Color(), tp = new T.Vector3(), tn = new T.Vector3();
      list.forEach(([g, p]) => {
        const P = g.attributes.position, N = g.attributes.normal, cnt = P.count;
        col.set(p.c === undefined ? 0xFFFFFF : p.c);
        for (let i = 0; i < cnt; i++) {
          if (p.cf) { tp.set(P.getX(i), P.getY(i), P.getZ(i)); tn.set(N.getX(i), N.getY(i), N.getZ(i)); tmpC.copy(col); p.cf(tp, tn, tmpC); put(P, N, i, 0, tmpC, p.b); }
          else put(P, N, i, 0, col, p.b);
        }
        const t = p.ol === undefined ? olT : p.ol;
        if (t > 0) for (let i = 0; i < cnt; i += 3) { put(P, N, i, t, olc, p.b); put(P, N, i + 2, t, olc, p.b); put(P, N, i + 1, t, olc, p.b); }
        g.dispose();
      });
      const out = new T.BufferGeometry();
      out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(cl, 3));
      if (skin) { out.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); }
      out.computeBoundingSphere();
      return bag(out);
    }
    function mesh(parts, opt) { const m = new T.Mesh(merge(parts, opt), mat); m.castShadow = true; return m; }
    return { T, grad, mat, G, m4, part, merge, mesh };
  }

  /* ---------- зверята: лисичка (падел), мишка-вратарь (в перчатках), зайка (пас-пас) ---------- */
  const BONES = ['root', 'body', 'head', 'armL', 'armR', 'footL', 'footR'];
  const BREST = [[0, 0, 0], [0, 0.3, 0], [0, 0.74, 0], [0.21, 0.64, 0], [-0.21, 0.64, 0], [0.11, 0.06, 0.04], [-0.11, 0.06, 0.04]];
  const BPAR = [-1, 0, 1, 1, 1, 0, 0];
  const ANIMALS = {
    fox: { who: 'sport_fox', name: 'Лисичка', headY: 1.28, build(K, o) {
      const { G, part: P } = K, F = '#F08A3C', C = '#FFE9CF', D = '#5A3E36', ink = '#3A2E3F';
      const L = [
        P(G.sph, F, [0, 0.5, 0], 0, [0.27, 0.31, 0.25], { b: 1 }), P(G.sph, C, [0, 0.45, 0.12], 0, [0.17, 0.21, 0.14], { b: 1, ol: 0 }),
        P(G.sph, F, [0, 0.36, -0.3], [-0.95, 0, 0], [0.11, 0.24, 0.11], { b: 1 }), P(G.sph, C, [0, 0.5, -0.47], [-0.95, 0, 0], 0.075, { b: 1 }),
        P(G.sph, F, [0, 0.92, 0.02], 0, 0.24, { b: 2 }),
        P(G.sph, C, [0.1, 0.85, 0.16], 0, [0.1, 0.08, 0.08], { b: 2, ol: 0 }), P(G.sph, C, [-0.1, 0.85, 0.16], 0, [0.1, 0.08, 0.08], { b: 2, ol: 0 }),
        P(G.sph, C, [0, 0.87, 0.22], 0, [0.075, 0.06, 0.1], { b: 2 }), P(G.sph, ink, [0, 0.885, 0.315], 0, 0.033, { b: 2, ol: 0 }),
        P(G.cone, F, [0.13, 1.14, 0], [0, 0, -0.32], [0.085, 0.2, 0.06], { b: 2 }), P(G.cone, F, [-0.13, 1.14, 0], [0, 0, 0.32], [0.085, 0.2, 0.06], { b: 2 }),
        P(G.cone, D, [0.158, 1.215, 0.005], [0, 0, -0.32], [0.04, 0.07, 0.03], { b: 2, ol: 0 }), P(G.cone, D, [-0.158, 1.215, 0.005], [0, 0, 0.32], [0.04, 0.07, 0.03], { b: 2, ol: 0 }),
        P(G.tor, '#F6C6D0', [0, 1.0, 0.01], [PI / 2 - 0.12, 0, 0], [0.228, 0.228, 0.32], { b: 2, ol: 0 }),
        P(G.sph, F, [0.25, 0.53, 0.02], [0, 0, 0.22], [0.058, 0.13, 0.058], { b: 3 }), P(G.sph, D, [0.275, 0.4, 0.035], 0, 0.065, { b: 3 }),
        P(G.sph, F, [-0.25, 0.53, 0.02], [0, 0, -0.22], [0.058, 0.13, 0.058], { b: 4 }), P(G.sph, D, [-0.275, 0.4, 0.035], 0, 0.065, { b: 4 }),
        P(G.sph, D, [0.11, 0.05, 0.06], 0, [0.08, 0.05, 0.11], { b: 5 }), P(G.sph, D, [-0.11, 0.05, 0.06], 0, [0.08, 0.05, 0.11], { b: 6 }),
      ];
      if (o.racket) {   // ракетка лисички — в правой лапке (часть сетки, качается вместе с лапкой)
        L.push(P(G.cyl, ink, [-0.28, 0.4, 0.13], [PI / 2, 0, 0], [0.018, 0.2, 0.018], { b: 4 }));
        L.push(P(G.sph, '#4A90D8', [-0.28, 0.42, 0.37], 0, [0.022, 0.125, 0.15], { b: 4, ol: 0.01 }));
        L.push(P(G.tor, '#FFFFFF', [-0.28, 0.42, 0.37], [0, PI / 2, 0], [0.15, 0.125, 0.12], { b: 4, ol: 0 }));
      }
      return L.concat(face(K, 2, 0.96, 0.2, 0.085, 0.235));
    } },
    bear: { who: 'sport_bear', name: 'Мишка', headY: 1.32, build(K) {
      const { G, part: P } = K, Br = '#A8774E', Lt = '#E9CFA8', J = '#6FB36A', Jd = '#4F8F4C', Gl = '#F2A23C', ink = '#3A2E3F';
      const L = [
        P(G.sph, J, [0, 0.5, 0], 0, [0.31, 0.33, 0.28], { b: 1 }), P(G.box, '#FFFFFF', [0, 0.52, 0.255], [0.05, 0, 0], [0.09, 0.2, 0.04], { b: 1, ol: 0 }),
        P(G.tor, Jd, [0, 0.74, 0], [PI / 2, 0, 0], [0.2, 0.2, 0.4], { b: 1, ol: 0 }),
        P(G.sph, Br, [0, 0.95, 0.02], 0, 0.26, { b: 2 }), P(G.sph, Lt, [0, 0.885, 0.2], 0, [0.11, 0.085, 0.085], { b: 2 }),
        P(G.sph, ink, [0, 0.91, 0.285], 0, [0.04, 0.03, 0.03], { b: 2, ol: 0 }),
        P(G.sph, Br, [0.18, 1.15, 0], 0, [0.085, 0.085, 0.06], { b: 2 }), P(G.sph, Br, [-0.18, 1.15, 0], 0, [0.085, 0.085, 0.06], { b: 2 }),
        P(G.sph, '#F2B8C6', [0.18, 1.15, 0.035], 0, [0.045, 0.045, 0.03], { b: 2, ol: 0 }), P(G.sph, '#F2B8C6', [-0.18, 1.15, 0.035], 0, [0.045, 0.045, 0.03], { b: 2, ol: 0 }),
        P(G.sph, Br, [0.27, 0.53, 0.02], [0, 0, 0.2], [0.065, 0.12, 0.065], { b: 3 }), P(G.sph, Gl, [0.3, 0.38, 0.05], 0, [0.095, 0.1, 0.085], { b: 3 }),
        P(G.sph, Br, [-0.27, 0.53, 0.02], [0, 0, -0.2], [0.065, 0.12, 0.065], { b: 4 }), P(G.sph, Gl, [-0.3, 0.38, 0.05], 0, [0.095, 0.1, 0.085], { b: 4 }),
        P(G.sph, Br, [0.12, 0.05, 0.05], 0, [0.09, 0.055, 0.12], { b: 5 }), P(G.sph, Br, [-0.12, 0.05, 0.05], 0, [0.09, 0.055, 0.12], { b: 6 }),
        P(G.sph, Br, [0, 0.32, -0.27], 0, 0.06, { b: 1 }),
      ];
      return L.concat(face(K, 2, 1.0, 0.215, 0.09, 0.245));
    } },
    bunny: { who: 'sport_bunny', name: 'Зайка', headY: 1.42, build(K) {
      const { G, part: P } = K, W = '#F7F3EE', Sh = '#9DD3F0', Pk = '#F4A9B8', ink = '#3A2E3F';
      const L = [
        P(G.sph, Sh, [0, 0.5, 0], 0, [0.25, 0.3, 0.23], { b: 1 }), P(G.sph, W, [0, 0.32, -0.25], 0, 0.08, { b: 1 }),
        P(G.sph, W, [0, 0.9, 0.02], 0, 0.23, { b: 2 }), P(G.sph, W, [0, 0.84, 0.17], 0, [0.1, 0.075, 0.08], { b: 2, ol: 0 }),
        P(G.sph, Pk, [0, 0.875, 0.245], 0, [0.035, 0.026, 0.024], { b: 2, ol: 0 }),
        P(G.sph, W, [0.085, 1.22, -0.02], [0.1, 0, -0.14], [0.055, 0.2, 0.04], { b: 2 }), P(G.sph, W, [-0.085, 1.22, -0.02], [0.1, 0, 0.14], [0.055, 0.2, 0.04], { b: 2 }),
        P(G.sph, Pk, [0.088, 1.22, 0.012], [0.1, 0, -0.14], [0.03, 0.16, 0.02], { b: 2, ol: 0 }), P(G.sph, Pk, [-0.088, 1.22, 0.012], [0.1, 0, 0.14], [0.03, 0.16, 0.02], { b: 2, ol: 0 }),
        P(G.sph, W, [0.24, 0.53, 0.02], [0, 0, 0.2], [0.05, 0.12, 0.05], { b: 3 }), P(G.sph, W, [-0.24, 0.53, 0.02], [0, 0, -0.2], [0.05, 0.12, 0.05], { b: 4 }),
        P(G.sph, W, [0.11, 0.05, 0.08], 0, [0.075, 0.05, 0.14], { b: 5 }), P(G.sph, W, [-0.11, 0.05, 0.08], 0, [0.075, 0.05, 0.14], { b: 6 }),
      ];
      return L.concat(face(K, 2, 0.94, 0.195, 0.08, 0.215));
    } },
  };
  // глазки с бликами и щёчки (без контура)
  function face(K, b, ey, ez, ex, gz) {
    const { G, part: P } = K;
    return [P(G.sph, '#2A2230', [ex, ey, ez], 0, [0.034, 0.04, 0.03], { b, ol: 0 }), P(G.sph, '#2A2230', [-ex, ey, ez], 0, [0.034, 0.04, 0.03], { b, ol: 0 }),
      P(G.sphLo, '#FFFFFF', [ex - 0.01, ey + 0.016, gz], 0, 0.011, { b, ol: 0 }), P(G.sphLo, '#FFFFFF', [-ex - 0.01, ey + 0.016, gz], 0, 0.011, { b, ol: 0 }),
      P(G.sphLo, '#F7A3B5', [ex + 0.065, ey - 0.075, ez - 0.03], 0, [0.04, 0.024, 0.02], { b, ol: 0 }), P(G.sphLo, '#F7A3B5', [-ex - 0.065, ey - 0.075, ez - 0.03], 0, [0.04, 0.024, 0.02], { b, ol: 0 })];
  }
  function makeAnimal(K, kind, o, bag) {
    const T = K.T, A = ANIMALS[kind];
    const geo = K.merge(A.build(K, o || {}), { skin: true, ol: 0.017 });
    geo.boundingSphere.radius += 0.6;
    const bones = BONES.map(n => { const b = new T.Bone(); b.name = n; return b; });
    BREST.forEach((p, i) => { const pp = BPAR[i] >= 0 ? BREST[BPAR[i]] : [0, 0, 0]; bones[i].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (BPAR[i] >= 0) bones[BPAR[i]].add(bones[i]); });
    const mesh = new T.SkinnedMesh(geo, K.mat); mesh.add(bones[0]); mesh.updateMatrixWorld(true);
    const sk = new T.Skeleton(bones); mesh.bind(sk); bag(sk);
    mesh.castShadow = true; mesh.name = 'sports:' + kind;
    const root = new T.Group(); root.name = 'sports:' + kind; root.add(mesh);
    const B = {}; BONES.forEach((n, i) => { B[n] = bones[i]; });
    const a = { kind, who: A.who, name: A.name, headY: A.headY, root, mesh, B, ph: 0, seed: Math.random() * 6,
      st: { spd: 0, lean: 0, twist: 0, roll: 0, hop: 0, crouch: 0, nod: 0, look: 0, tilt: 0, armL: [0, 0, 0.12], armR: [0, 0, -0.12] } };
    return a;
  }
  function animalPose(a, dt, t) {
    const s = a.st, B = a.B;
    a.ph += dt * Math.min(s.spd, 4.5) * 8.5;
    const mv = clamp(s.spd / 1.1, 0, 1), sw = Math.sin(a.ph), br = Math.sin(t * 2.3 + a.seed);
    B.body.position.set(0, 0.3 + Math.abs(sw) * 0.04 * mv + s.hop - s.crouch * 0.1 + br * 0.006, 0);
    B.body.rotation.set(s.lean + mv * 0.08, s.twist, sw * 0.14 * mv + s.roll);
    B.head.rotation.set(s.nod + Math.sin(t * 1.7 + a.seed) * 0.03, s.look, Math.sin(t * 1.1 + a.seed) * 0.05 + s.tilt);
    B.armL.rotation.set(s.armL[0] - sw * 0.55 * mv, s.armL[1], s.armL[2]);
    B.armR.rotation.set(s.armR[0] + sw * 0.55 * mv, s.armR[1], s.armR[2]);
    B.footL.position.set(0.11, 0.06 + Math.max(0, sw) * 0.08 * mv + s.hop * 0.4, 0.04 + Math.cos(a.ph) * 0.07 * mv);
    B.footR.position.set(-0.11, 0.06 + Math.max(0, -sw) * 0.08 * mv + s.hop * 0.4, 0.04 - Math.cos(a.ph) * 0.07 * mv);
  }

  /* ---------- предметы героини и мячи ---------- */
  function makeRacket(K) {   // ось ручка → голова — +y, лицо ракетки — ±z (у падела нет струн: сплошная, с дырочками)
    const { G, part: P } = K;
    const L = [P(G.cyl, '#3A2E3F', [0, 0.07, 0], 0, [0.017, 0.14, 0.017]), P(G.cyl, '#C2405B', [0, 0.155, 0], 0, [0.014, 0.05, 0.012]),
      P(G.sph, '#E25A7A', [0, 0.3, 0], 0, [0.128, 0.155, 0.02], { ol: 0.008 }), P(G.tor, '#FFF6F0', [0, 0.3, 0], 0, [0.128, 0.152, 0.13], { ol: 0 })];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = i ? 0.07 : 0; [1, -1].forEach(sd => L.push(P(G.sphLo, '#7E2440', [Math.cos(a) * r, 0.3 + Math.sin(a) * r * 1.15 + (i ? 0 : 0), sd * 0.017], 0, [0.014, 0.014, 0.006], { ol: 0 }))); }
    const m = K.mesh(L, { ol: 0.008 }); m.name = 'sports:racket'; return m;
  }
  function makePutter(K) {   // начало — верх рукояти, стержень вниз (−y), голова внизу, лицо — +z
    const { G, part: P } = K;
    const m = K.mesh([P(G.cyl, '#2F3440', [0, -0.11, 0], 0, [0.02, 0.22, 0.02]), P(G.cyl, '#B9BEC5', [0, -0.53, 0], 0, [0.011, 0.66, 0.011], { ol: 0.006 }),
      P(G.box, '#3E3A44', [0.03, -0.875, 0], 0, [0.12, 0.045, 0.055], { ol: 0.007 }), P(G.box, '#F2B544', [0.03, -0.85, 0], 0, [0.04, 0.006, 0.02], { ol: 0 })], { ol: 0.007 });
    m.name = 'sports:putter'; return m;
  }
  function makeBall(K, kind) {
    const { G, part: P } = K;
    if (kind === 'football') {   // белый с тёмными «пятиугольниками» (по 12 направлениям икосаэдра)
      const dirs = []; const t = (1 + Math.sqrt(5)) / 2;
      [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].forEach(d => { const l = Math.hypot(d[0], d[1], d[2]); dirs.push([d[0] / l, d[1] / l, d[2] / l]); });
      const m = K.mesh([P(G.ico, '#FFFFFF', [0, 0, 0], 0, 0.17, { cf: (p, n, c) => { for (let i = 0; i < 12; i++) { const d = dirs[i]; if (n.x * d[0] + n.y * d[1] + n.z * d[2] > 0.955) { c.set('#3A2E3F'); return; } } } })], { ol: 0.012 });
      m.name = 'sports:ball'; m.userData.r = 0.17; return m;
    }
    if (kind === 'golf') { const m = K.mesh([P(G.sph, '#FFFFFF', [0, 0, 0], 0, 0.06)], { ol: 0.008 }); m.name = 'sports:ball'; m.userData.r = 0.06; return m; }
    const m = K.mesh([P(G.sph, '#E2EE5A', [0, 0, 0], 0, 0.105, { cf: (p, n, c) => { const s = Math.abs(Math.sin(Math.atan2(n.z, n.x) * 2) * 0.6 - n.y); if (s < 0.09) c.set('#FFFFFF'); } })], { ol: 0.01 });
    m.name = 'sports:ball'; m.userData.r = 0.105; return m;
  }
  function makeBlob(T, bag) {
    const m = new T.Mesh(bag(new T.CircleGeometry(1, 20)), bag(new T.MeshBasicMaterial({ color: 0x3A2E3F, transparent: true, opacity: 0.24, depthWrite: false })));
    m.geometry.rotateX(-PI / 2); m.renderOrder = 2; m.name = 'sports:blob'; return m;
  }
  // кольца «по времени»: 2 экземпляра одного кольца (цель и сжимающееся) — 1 вызов
  function makeRings(T, bag, n) {
    const g = bag(new T.RingGeometry(0.86, 1, 44)); g.rotateX(-PI / 2);
    const m = new T.InstancedMesh(g, bag(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide })), n || 2);
    m.renderOrder = 3; m.frustumCulled = false; m.name = 'sports:rings';
    const c = new T.Color(1, 1, 1); for (let i = 0; i < m.count; i++) m.setColorAt(i, c);
    return m;
  }
  function makeDots(T, bag, n) {
    const g = bag(new T.CircleGeometry(1, 12)); g.rotateX(-PI / 2);
    const m = new T.InstancedMesh(g, bag(new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.95, depthWrite: false })), n);
    m.renderOrder = 3; m.frustumCulled = false; m.name = 'sports:dots';
    const c = new T.Color(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, c);
    return m;
  }
  // конфетти: 80 бумажек одной точечной сеткой
  function makeConfetti(T, bag) {
    const N = 80, g = bag(new T.BufferGeometry()), pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    const pal = ['#F6C6D0', '#C2405B', '#F2B544', '#7FD0B0', '#8CB8F0', '#FFFFFF'].map(c => new T.Color(c));
    for (let i = 0; i < N; i++) { const c = pal[i % pal.length]; cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(cl, 3));
    const m = new T.Points(g, bag(new T.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true })));
    m.visible = false; m.frustumCulled = false; m.name = 'sports:confetti'; m.renderOrder = 4;
    let t = 9, rr = Math.random;
    return {
      mesh: m,
      burst(x, y, z, r) {
        rr = r || rr; t = 0; m.visible = true;
        for (let i = 0; i < N; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; const a = rr() * TAU, s = 1.2 + rr() * 2.4; vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = 2.6 + rr() * 3.2; vel[i * 3 + 2] = Math.sin(a) * s; }
        g.attributes.position.needsUpdate = true;
      },
      update(dt) {
        if (!m.visible) return; t += dt;
        for (let i = 0; i < N; i++) { vel[i * 3 + 1] -= 5.5 * dt; vel[i * 3] *= 0.985; vel[i * 3 + 2] *= 0.985; if (vel[i * 3 + 1] < -1.2) vel[i * 3 + 1] = -1.2 + Math.sin(t * 7 + i) * 0.2; pos[i * 3] += vel[i * 3] * dt + Math.sin(t * 6 + i) * 0.004; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; }
        g.attributes.position.needsUpdate = true; m.material.opacity = 1 - sst(1.6, 2.4, t); if (t > 2.4) m.visible = false;
      },
    };
  }

  /* =====================================================================
     4. ИК РУКИ (две кости, локоть — шарнир, точное решение) — без выделений памяти
     ===================================================================== */
  function makeIK(T) {
    const A = new T.Vector3(), E0 = new T.Vector3(), W0 = new T.Vector3(), Dv = new T.Vector3(), Wt = new T.Vector3(), dW = new T.Vector3(), nrm = new T.Vector3(), E = new T.Vector3(), Wt2 = new T.Vector3();
    const piv = new T.Vector3(), va = new T.Vector3(), vb = new T.Vector3(), tmp = new T.Vector3();
    const q0 = new T.Quaternion(), q1 = new T.Quaternion(), q2 = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion(), qc = new T.Quaternion(), qx = new T.Quaternion();
    function aimBone(bone, childNow, want) {
      bone.getWorldPosition(piv);
      va.copy(childNow).sub(piv); vb.copy(want).sub(piv);
      if (va.lengthSq() < 1e-10 || vb.lengthSq() < 1e-10) return;
      va.normalize(); vb.normalize();
      q0.setFromUnitVectors(va, vb); bone.getWorldQuaternion(q1); q0.multiply(q1);
      bone.parent.getWorldQuaternion(q2).invert();
      bone.quaternion.copy(q2.multiply(q0)); bone.updateMatrixWorld(true);
    }
    function arm(B, sd, grip, pole, w, reach, handRx) {
      const up = B['upperarm_' + sd], fo = B['forearm_' + sd], ha = B['hand_' + sd];
      if (!up || !fo || !ha || w <= 0.001) return false;
      qa.copy(up.quaternion); qb.copy(fo.quaternion); qc.copy(ha.quaternion);
      up.updateMatrixWorld(true);
      up.getWorldPosition(A); fo.getWorldPosition(E0); ha.getWorldPosition(W0);
      const l1 = A.distanceTo(E0), l2 = E0.distanceTo(W0);
      Dv.copy(grip).sub(A); let d = Dv.length(); if (d < 1e-4) return false; Dv.divideScalar(d);
      Wt.copy(grip).addScaledVector(Dv, -(reach === undefined ? 0.07 : reach));
      d = clamp(Wt.distanceTo(A), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
      dW.copy(Wt).sub(A).normalize();
      const aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
      nrm.copy(pole).addScaledVector(dW, -pole.dot(dW)); if (nrm.lengthSq() < 1e-6) nrm.set(0, -1, 0); nrm.normalize();
      E.copy(A).addScaledVector(dW, aa).addScaledVector(nrm, h);
      Wt2.copy(A).addScaledVector(dW, d);
      aimBone(up, E0, E);
      ha.getWorldPosition(tmp); aimBone(fo, tmp, Wt2);
      ha.quaternion.identity(); ha.rotateX(handRx === undefined ? 0.3 : handRx);
      if (w < 0.999) {
        qx.copy(up.quaternion); up.quaternion.slerpQuaternions(qa, qx, w);
        qx.copy(fo.quaternion); fo.quaternion.slerpQuaternions(qb, qx, w);
        qx.copy(ha.quaternion); ha.quaternion.slerpQuaternions(qc, qx, w);
      }
      up.updateMatrixWorld(true);
      return true;
    }
    return { arm, aimBone };
  }

  /* =====================================================================
     5. ЯДРО КОНТРОЛЛЕРА: героиня, камера, шторка, облачка, кнопки, конец игры, уборка
     ===================================================================== */
  function start(kind, o) {
    o = o || {};
    const T = o.THREE || window.THREE;
    if (!T || !o.scene || !o.camera) throw new Error('sports: нужны THREE, scene, camera');
    if (!GAMES[kind]) throw new Error('sports: неизвестная игра ' + kind);
    ensureCss();
    const scene = o.scene, cam = o.camera;
    const heroRoot = o.hero ? (o.hero.isObject3D ? o.hero : o.hero.root) : null;
    const heroBody = o.hero && !o.hero.isObject3D ? o.hero.body : null;
    const anim = o.anim || (o.hero && o.hero.rig && o.hero.rig.anim) || null;
    const ia = o.ia || null;
    const R = rng(o.seed === undefined ? (Math.random() * 4294967296) >>> 0 : o.seed);
    const court = Object.assign({}, (HOTEL[kind] || {}), o.court || {});
    const F = Frame(court);
    const owned = [];
    const bag = x => { owned.push(x); return x; };
    const K = toyKit(T, bag);
    const IK = makeIK(T);
    const added = [];
    const add = obj => { scene.add(obj); added.push(obj); return obj; };
    const confetti = makeConfetti(T, bag); add(confetti.mesh);

    // камера и героиня — как были (вернём в конце)
    const cam0 = { pos: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov, near: cam.near, far: cam.far };
    const hero0 = heroRoot ? { pos: heroRoot.position.clone(), ry: heroRoot.rotation.y, body: heroBody ? heroBody.position.y : 0 } : null;
    const hidden = (o.hide || []).filter(Boolean).map(ob => [ob, ob.visible]);
    hidden.forEach(([ob]) => { ob.visible = false; });
    if (heroBody) heroBody.position.y = 0;
    let pocketed = false;
    if (ia) { try { ia.cancel(); if (ia.canPocket && ia.canPocket() && !(ia.pocketed && ia.pocketed())) { ia.play('pocket'); pocketed = true; } } catch (e) { /* без лупы */ } }

    /* ---------- DOM ---------- */
    const host = (o.ui && (o.ui.host || o.ui)) || null;
    const el = document.createElement('div'); el.className = 'vs-root vs-' + kind;
    el.innerHTML = `<div class="vs-score"></div><button class="vs-quit" type="button">Хватит</button><div class="vs-hint"></div>
      <div class="vs-swipe"></div><div class="vs-bub a"></div><div class="vs-bub hero"></div><div class="vs-flash"></div>
      <button class="vs-side" type="button" style="display:none"></button><button class="vs-main" type="button" style="display:none"><i></i><span></span></button>
      <div class="vs-end"><div class="card"><div class="t"></div><div class="r"></div><div class="b"></div><div class="acts"></div></div></div><div class="vs-fade"></div>`;
    const $ = s => el.querySelector(s);
    const ui = { score: $('.vs-score'), quit: $('.vs-quit'), hint: $('.vs-hint'), swipe: $('.vs-swipe'), bubA: $('.vs-bub.a'), bubH: $('.vs-bub.hero'), flash: $('.vs-flash'), side: $('.vs-side'), main: $('.vs-main'), mainI: $('.vs-main i'), mainT: $('.vs-main span'), end: $('.vs-end'), endT: $('.vs-end .t'), endR: $('.vs-end .r'), endB: $('.vs-end .b'), endActs: $('.vs-end .acts'), fade: $('.vs-fade') };
    if (host) host.appendChild(el);
    let scoreHtml = '';
    const setScore = h => { if (h !== scoreHtml) { scoreHtml = h; ui.score.innerHTML = h; } };
    let hintT = 0;
    const hint = (t, sec) => { ui.hint.textContent = t; ui.hint.classList.toggle('on', !!t); hintT = sec || 4; };
    const flash = t => { ui.flash.textContent = t; ui.flash.classList.remove('on'); void ui.flash.offsetWidth; ui.flash.classList.add('on'); };
    const mainBtn = (icon, text, on) => { ui.main.style.display = on === false ? 'none' : 'flex'; ui.mainI.textContent = icon; ui.mainT.textContent = text; };
    const sideBtn = (text, low) => { ui.side.style.display = text ? 'block' : 'none'; ui.side.textContent = text || ''; ui.side.classList.toggle('low', !!low); };

    /* ---------- события и облачка ---------- */
    const emit = (name, data) => { try { if (o.onEvent) o.onEvent(name, data); } catch (e) { console.warn('sports onEvent', e); } };
    const sfx = k => emit('sfx', { k, kind });
    const bubbles = o.bubbles !== false;
    const bub = { a: { el: ui.bubA, t: 0, obj: null, y: 1.3 }, h: { el: ui.bubH, t: 0, obj: null, y: 2.15 } };
    const said = [];
    function line(L, obj, sec) {
      if (!L) return; said.push(L.text); if (said.length > 40) said.shift();
      emit('line', { who: L.who, text: L.text, kind });
      if (!bubbles) return;
      const sp = SPEAKERS[L.who], nm = sp ? sp.name : L.who === 'hotel_raccoon' ? 'Енот-тренер' : '';
      const b = bub.a; b.el.innerHTML = (nm ? '<b>' + nm + '</b>' : '') + escapeHtml(L.text); b.t = sec || 2.6; b.obj = obj || null; b.y = obj && obj.userData && obj.userData.headY ? obj.userData.headY : 1.35; b.fixed = !obj;
    }
    function heroSay(text, sec) {
      if (!text) return; said.push(text); if (said.length > 40) said.shift();
      emit('hero', { text, kind });
      if (!bubbles) return;
      const b = bub.h; b.el.textContent = text; b.t = sec || 1.6; b.obj = heroRoot;
    }
    const pv = new T.Vector3();
    function placeBubbles(dt) {
      const w = el.clientWidth || (host && host.clientWidth) || 390, h = el.clientHeight || (host && host.clientHeight) || 844;
      for (const k in bub) {
        const b = bub[k];
        if (b.t > 0) { b.t -= dt; }
        const on = b.t > 0;
        if (on !== b.el.classList.contains('on')) b.el.classList.toggle('on', on);
        if (!on) continue;
        let x, y;
        if (b.fixed || !b.obj) { x = w * 0.5; y = 236; }
        else { b.obj.getWorldPosition(pv); pv.y += b.y; pv.project(cam); x = clamp((pv.x * 0.5 + 0.5) * w, 120, w - 120); y = clamp((-pv.y * 0.5 + 0.5) * h - 8, 150, h - 60); if (pv.z > 1) y = -200; if (k === 'h' && bub.a.t > 0 && bub.a.fixed && y < 300) y = 300; }
        b.el.style.transform = 'translate(' + (x | 0) + 'px,' + (y | 0) + 'px) translate(-50%,-100%)';
      }
    }

    /* ---------- героиня: положение в осях поля, шаг, поворот ---------- */
    const H = { x: 0, z: 0, yaw: 0, spd: 0, tr: 0, px: 0, pz: 0, pyaw: 0, celebrate: false, y: 0, still: true };
    const hv = new T.Vector3();
    function heroPlace(lx, lz, lyaw) { H.x = H.px = lx; H.z = H.pz = lz; H.yaw = H.pyaw = lyaw; H.spd = 0; }
    // идти к точке (lx, lz) со скоростью до vmax; лицом — по ходу, у цели — к faceYaw
    function heroMove(lx, lz, vmax, faceYaw, dt) {
      const dx = lx - H.x, dz = lz - H.z, d = Math.hypot(dx, dz);
      if (d > 0.02) { const s = Math.min(d, vmax * dt); H.x += dx / d * s; H.z += dz / d * s; }
      const want = d > 0.7 && vmax > 0.5 ? Math.atan2(dx, dz) : faceYaw;
      H.yaw += clamp(angW(want - H.yaw), -11 * dt, 11 * dt);
      return d;
    }
    const groundY = (lx, lz) => { if (o.ground) { F.toW(lx, 0, lz, hv); return o.ground(hv.x, hv.z); } return F.y; };
    function heroApply(dt) {
      if (!heroRoot) return;
      F.toW(H.x, 0, H.z, hv); hv.y = H.yOverride !== undefined ? H.yOverride : groundY(H.x, H.z);
      heroRoot.position.copy(hv); heroRoot.rotation.set(0, F.yaw(H.yaw), 0); heroRoot.visible = true;
      const sp = dt > 0 ? Math.hypot(H.x - H.px, H.z - H.pz) / dt : 0;
      H.spd = damp(H.spd, Math.min(sp, 4.2), 12, dt);
      H.tr = dt > 0 ? angW(H.yaw - H.pyaw) / dt : 0;
      H.px = H.x; H.pz = H.z; H.pyaw = H.yaw;
    }
    function heroAnimate(dt, extra) {
      if (!anim) return;
      const st = { speed: H.spd < 0.05 ? 0 : H.spd, turnRate: clamp(H.tr, -6, 6), idle: false, sitting: false, waving: false, celebrate: H.celebrate, carry: false };
      if (extra) Object.assign(st, extra);
      const st2 = ia && ia.animState ? ia.animState(st) : st;
      anim.update(dt, st2);
      if (ia && ia.update) { try { ia.update(dt); } catch (e) { /* ok */ } }
      if (heroRoot) heroRoot.updateMatrixWorld(true);
    }
    const iaBusy = () => !!(ia && ia.busy && ia.busy());

    /* ---------- камера: плавно к желаемой; FOV — чтобы поле влезло и в портрет ---------- */
    const camT = { pos: new T.Vector3(), look: new T.Vector3(), fov: 50, snap: true, k: 3.2 };
    const camLook = new T.Vector3();
    function fitFov(hfovDeg, vmin) {
      const a = cam.aspect || 1, hv2 = Math.tan(hfovDeg * PI / 360);
      return clamp(Math.max(vmin || 34, 2 * Math.atan(hv2 / a) * 180 / PI), 30, 74);
    }
    function camStep(dt) {
      if (camT.snap) { cam.position.copy(camT.pos); camLook.copy(camT.look); cam.fov = camT.fov; camT.snap = false; }
      else { const k = 1 - Math.exp(-(camT.k || 3.2) * dt); cam.position.lerp(camT.pos, k); camLook.lerp(camT.look, 1 - Math.exp(-(camT.k || 3.2) * 1.4 * dt)); cam.fov = damp(cam.fov, camT.fov, 3, dt); }
      cam.lookAt(camLook); cam.updateProjectionMatrix();
    }

    /* ---------- ввод ---------- */
    const ptr = { id: null, x0: 0, y0: 0, x: 0, y: 0, t0: 0, moved: 0 };
    const rel = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let tNow = 0;
    function onDown(e) {
      if (C.ended || !C.active || C.fading) return;
      if (ptr.id !== null) return;
      const [x, y] = rel(e); ptr.id = e.pointerId; ptr.x0 = ptr.x = x; ptr.y0 = ptr.y = y; ptr.t0 = tNow; ptr.moved = 0;
      try { el.setPointerCapture(e.pointerId); } catch (x2) { /* старые браузеры */ }
      if (game.down) game.down(x, y);
      e.preventDefault();
    }
    function onMove(e) {
      if (e.pointerId !== ptr.id) return;
      const [x, y] = rel(e); ptr.moved = Math.max(ptr.moved, Math.hypot(x - ptr.x0, y - ptr.y0)); ptr.x = x; ptr.y = y;
      if (game.move) game.move(x - ptr.x0, y - ptr.y0, x, y);
    }
    function onUp(e) {
      if (e.pointerId !== ptr.id) return;
      const [x, y] = rel(e); ptr.id = null;
      if (game.up) game.up(x - ptr.x0, y - ptr.y0, Math.max(0.016, tNow - ptr.t0), e.type === 'pointercancel');
    }
    const stopBtn = e => { e.stopPropagation(); };
    function onMain(e) { e.stopPropagation(); e.preventDefault(); if (C.ended || C.fading) return; ui.main.classList.add('down'); setTimeout(() => ui.main.classList.remove('down'), 120); if (game.main) game.main(); }
    function onSide(e) { e.stopPropagation(); e.preventDefault(); if (C.ended || C.fading) return; if (game.side) game.side(); }
    function onQuit(e) { e.stopPropagation(); e.preventDefault(); quit(); }
    function onKey(e) {
      if (!C.active) return;
      if (e.code === 'Escape') { quit(); return; }
      if (C.ended) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); again(); } return; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat && game.main) game.main(); }
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && game.key) { e.preventDefault(); game.key(e.code === 'ArrowLeft' ? -1 : 1); }
      else if (e.code === 'KeyR' && game.side) game.side();
    }
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', e => e.preventDefault());
    ui.main.addEventListener('pointerdown', onMain); ui.side.addEventListener('pointerdown', onSide); ui.quit.addEventListener('pointerdown', onQuit);
    [ui.end].forEach(x => x.addEventListener('pointerdown', stopBtn));
    window.addEventListener('keydown', onKey);

    /* ---------- конец раунда: карточка ---------- */
    function showEnd(o2) {
      C.ended = true; el.classList.add('ended');
      ui.endT.textContent = o2.title; ui.endR.innerHTML = o2.text; ui.endB.textContent = o2.best || '';
      ui.endActs.innerHTML = '';
      // кнопки карточки: срабатывают на отпускание пальца над той же кнопкой (не зависят от синтеза click) и не раньше 0,35 с
      // после появления карточки — быстрый тап из игры не попадёт в «Ещё раз» случайно; click — запасной путь (мышь, клавиатура)
      const shownAt = (window.performance || Date).now();
      let fired = false;
      const btn = (t, cls, fn) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (cls) b.className = cls;
        const go = () => { if (fired || (window.performance || Date).now() - shownAt < 350) return; fired = true; fn(); };
        b.addEventListener('pointerdown', e => { e.stopPropagation(); b.dataset.down = '1'; try { b.releasePointerCapture(e.pointerId); } catch (x) { /* ok */ } });
        b.addEventListener('pointerup', e => { e.stopPropagation(); if (b.dataset.down) { delete b.dataset.down; go(); } });
        b.addEventListener('pointerleave', () => { delete b.dataset.down; });
        b.addEventListener('click', e => { e.stopPropagation(); go(); });
        ui.endActs.appendChild(b); return b;
      };
      btn('Ещё раз', 'main', () => again());
      (o2.extra || []).forEach(x => btn(x[0], '', x[1]));
      btn('Хватит', '', () => quit());
      ui.end.classList.add('on');
      ROUNDS[kind]++; C.rounds++;
      emit('round', { kind, result: o2.result, best: BEST[kind] });
    }
    function hideEnd() { C.ended = false; el.classList.remove('ended'); ui.end.classList.remove('on'); }

    /* ---------- шторка (по времени игры: тесты идут без настоящих часов) ---------- */
    const fade = { t: -1, mid: null, end: null, dur: 0.22, hold: 0.06, out: 0.3 };
    function curtain(mid, end) { fade.t = 0; fade.mid = mid; fade.end = end; C.fading = true; }
    function fadeStep(dt) {
      if (fade.t < 0) return;
      const t0 = fade.t; fade.t += dt;
      const { dur, hold, out } = fade;
      if (t0 < dur + hold * 0.5 && fade.t >= dur + hold * 0.5 && fade.mid) { const f = fade.mid; fade.mid = null; f(); }
      const k = fade.t < dur ? fade.t / dur : fade.t < dur + hold ? 1 : 1 - (fade.t - dur - hold) / out;
      ui.fade.style.opacity = clamp(k, 0, 1).toFixed(3);
      if (fade.t >= dur + hold + out) { fade.t = -1; ui.fade.style.opacity = '0'; C.fading = false; const f = fade.end; fade.end = null; if (f) f(); }
    }

    /* ---------- общее состояние ---------- */
    const C = {
      kind, active: true, ended: false, fading: false, rounds: 0, t: 0,
      T, K, IK, F, R, court, scene, cam, heroRoot, anim, ia, add, bag, H, hv, camT, ui, line, heroSay, hint, flash, setScore, mainBtn, sideBtn, sfx, emit,
      heroPlace, heroMove, heroApply, heroAnimate, iaBusy, fitFov, showEnd, hideEnd, curtain, confetti, ptr, said, o, groundY,
      haptic: k => emit('haptic', k),
    };
    const game = GAMES[kind](C);

    function again() {
      if (!C.active) return;
      hideEnd();
      curtain(() => { game.reset(); camT.snap = true; }, null);
    }
    let endedOnce = false;
    function finish(reason) {
      if (!C.active) return;
      C.active = false;
      window.removeEventListener('keydown', onKey);
      try { if (game.dispose) game.dispose(); } catch (e) { console.warn('sports dispose', e); }
      added.forEach(ob => { if (ob.parent) ob.parent.remove(ob); });
      owned.forEach(x => { try { x.dispose(); } catch (e) { /* ok */ } });
      owned.length = 0; added.length = 0;
      hidden.forEach(([ob, v]) => { ob.visible = v; });
      cam.position.copy(cam0.pos); cam.quaternion.copy(cam0.q); cam.fov = cam0.fov; cam.near = cam0.near; cam.far = cam0.far; cam.updateProjectionMatrix();
      if (heroRoot) {
        const rt = o.returnTo || (hero0 && { x: hero0.pos.x, y: hero0.pos.y, z: hero0.pos.z, ry: hero0.ry });
        if (rt) { heroRoot.position.set(rt.x, rt.y === undefined ? heroRoot.position.y : rt.y, rt.z); heroRoot.rotation.set(0, rt.ry || 0, 0); }
        heroRoot.updateMatrixWorld(true);
      }
      if (anim && anim.reset) { try { anim.reset(); } catch (e) { /* ok */ } }
      if (pocketed && ia) { try { ia.play('unpocket'); } catch (e) { /* ok */ } }
      if (el.parentNode) {
        // мягкая шторка после ухода (только DOM; сама себя убирает)
        const par = el.parentNode, f = document.createElement('div');
        f.style.cssText = 'position:absolute;inset:0;background:#FFF8F2;opacity:1;pointer-events:none;z-index:46;transition:opacity .35s ease';
        par.appendChild(f); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.opacity = '0'; })); setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 450);
        par.removeChild(el);
      }
      if (!endedOnce) {
        endedOnce = true;
        const res = { kind, reason, rounds: C.rounds, last: game.result ? game.result() : null, best: BEST[kind], hero: heroRoot ? { x: heroRoot.position.x, y: heroRoot.position.y, z: heroRoot.position.z, ry: heroRoot.rotation.y } : null };
        try { if (o.onEnd) o.onEnd(res); } catch (e) { console.warn('sports onEnd', e); }
      }
    }
    function quit() { if (!C.active || C.quitting) return; C.quitting = true; hideEnd(); curtain(() => finish('quit'), null); }

    /* ---------- кадр ---------- */
    let hintShown = false;
    function update(dt) {
      if (!C.active) return;
      dt = clamp(dt || 0, 0, 0.1);
      tNow += dt; C.t = tNow;
      fadeStep(dt);
      if (!C.active) return;
      game.step(dt);
      heroApply(dt);
      heroAnimate(dt, game.animState ? game.animState() : null);
      H.celebrate = false;
      if (game.pose) game.pose(dt);
      if (game.camera) game.camera(camT, dt);
      camStep(dt);
      confetti.update(dt);
      if (hintT > 0) { hintT -= dt; if (hintT <= 0) ui.hint.classList.remove('on'); }
      placeBubbles(dt);
      if (!hintShown) hintShown = true;
    }

    // сразу на поле: героиня и камера на месте с первого кадра, шторка только открывается
    game.reset(); camT.snap = true;
    fade.t = fade.dur + fade.hold * 0.6; fade.mid = null; fade.end = null; C.fading = true; ui.fade.style.opacity = '1';

    const ctrl = {
      kind, get active() { return C.active; },
      update, stop: () => finish('stop'),
      state: () => Object.assign({ kind, active: C.active, ended: C.ended, fading: C.fading, rounds: C.rounds, best: BEST[kind], t: +tNow.toFixed(2) }, game.state ? game.state() : {}),
      debug: Object.assign({
        again, quit, said: () => said.slice(),
        objects: () => added.map(ob => ob.name || ob.type),
        setVisible: b => { added.forEach(ob => { ob.userData.vis0 = ob.userData.vis0 === undefined ? ob.visible : ob.userData.vis0; ob.visible = b ? ob.userData.vis0 : false; if (b) delete ob.userData.vis0; }); return added.length; },
        drawables: () => { let n = 0; added.forEach(ob => ob.traverse(x => { if ((x.isMesh || x.isPoints || x.isLine) && x.visible !== false) n++; })); return n; },
        el: () => el, endButtons: () => [...ui.endActs.querySelectorAll('button')].map(b => b.textContent),
        hero: () => ({ x: H.x, z: H.z, yaw: H.yaw, spd: H.spd }),
      }, game.debug || {}),
    };
    return ctrl;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* =====================================================================
     6. ПАДЕЛ: 1 на 1 с Лисичкой, до 3 очков. Героиня сама бежит к мячу; жмёшь, когда кольцо сжалось.
        Мяч отскакивает от стеклянных стен (вот он, падел!); подача — снизу, после отскока.
     ===================================================================== */
  const HERO_V = 4.0;
  const PADEL = { g: 5.6, r: 0.08, rest: 0.72, wall: 0.74, CONTACT: 0.17, GOOD: 0.26, PERFECT: 0.1, WIN: 3, DT: 1 / 120 };
  function padelGame(C) {
    const { T, K, F, R } = C;
    const W = C.court.w || 10, D = C.court.d || 20, NET = C.court.netH || 0.9;
    const HW = W / 2, HD = D / 2;
    const fox = makeAnimal(K, 'fox', { racket: true }, C.bag); fox.root.userData.headY = 1.55; fox.mesh.scale.setScalar(1.15); C.add(fox.root);
    const racket = makeRacket(K); C.add(racket);
    const ball = makeBall(K, 'padel'); C.add(ball);
    const blob = makeBlob(T, C.bag); C.add(blob);
    const rings = makeRings(T, C.bag, 2); C.add(rings);
    // мяч: локальные оси поля
    const B = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, b: 0, bs: 0, roll: false, pz: 0, live: false, glassSeen: false };
    const sim = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, b: 0, bs: 0, roll: false, pz: 0 };
    const S = { errs: [], hitLog: [], phase: 'intro', me: 0, fox: 0, server: 'hero', rally: 0, pointT: 0, expect: 'hero', hitter: null, last: null, serveT: 0, winner: null, auto: null, glass: 0, hits: 0, whiffs: 0, perfect: 0, lastQ: null };
    // ожидаемый удар (для принимающего)
    const inc = { on: false, who: 'hero', t: 0, x: 0, y: 0, z: 0, fore: true, plan: 'hit', q: null, tapped: false, tapT: 0, aim: 0 };
    // анимация замаха героини / лисички
    const sw = { on: false, t0: 0, tc: 0, fore: true, u: 0, done: true, hit: false };
    const fsw = { on: false, t0: 0, tc: 0, lunge: 0, dir: 0 };
    const F2 = { x: 0, z: 6.5, yaw: PI, tx: 0, tz: 6.5, pyaw: PI };
    const v3 = new T.Vector3(), v3b = new T.Vector3(), v3c = new T.Vector3(), qH = new T.Quaternion(), m4 = new T.Matrix4(), pole = new T.Vector3();
    const G1 = new T.Vector3(), H1 = new T.Vector3(), N1 = new T.Vector3(), X1 = new T.Vector3(), mat = new T.Matrix4(), dummy = new T.Object3D(), ringCol = new T.Color();

    function step(st, h) {   // один шаг мяча (чистая функция над состоянием) → флаги: 1 пол, 2 стена x, 4 стена z (стекло), 8 сетка, 16 покатился
      st.vy -= PADEL.g * h; st.x += st.vx * h; st.y += st.vy * h; st.z += st.vz * h;
      let ev = 0; const r = PADEL.r;
      if ((st.pz < 0) !== (st.z < 0) && st.y < NET + r) { st.z = st.pz < 0 ? -r - 0.01 : r + 0.01; st.vz = -st.vz * 0.15; st.vx *= 0.4; ev |= 8; }
      if (st.y < r) {
        st.y = r;
        if (st.vy < -0.7) { st.vy = -st.vy * PADEL.rest; st.vx *= 0.9; st.vz *= 0.9; st.b++; st.bs = st.z < 0 ? -1 : 1; ev |= 1; }
        else { st.vy = 0; st.vx *= 0.97; st.vz *= 0.97; if (!st.roll) { st.roll = true; st.b++; st.bs = st.z < 0 ? -1 : 1; ev |= 16; } }
      }
      const hw = HW - r, hd = HD - r;
      if (st.x > hw) { st.x = hw; st.vx = -Math.abs(st.vx) * PADEL.wall; ev |= 2; } else if (st.x < -hw) { st.x = -hw; st.vx = Math.abs(st.vx) * PADEL.wall; ev |= 2; }
      if (st.z > hd) { st.z = hd; st.vz = -Math.abs(st.vz) * PADEL.wall; ev |= 4; } else if (st.z < -hd) { st.z = -hd; st.vz = Math.abs(st.vz) * PADEL.wall; ev |= 4; }
      st.pz = st.z;
      return ev;
    }
    const copy = (a, b) => { b.x = a.x; b.y = a.y; b.z = a.z; b.vx = a.vx; b.vy = a.vy; b.vz = a.vz; b.b = a.b; b.bs = a.bs; b.roll = a.roll; b.pz = a.pz; return b; };
    // где принимающий (side −1 — героиня, +1 — лисичка) ударит: после первого отскока на своей стороне, мяч на высоте 0.45–1.25
    function predict(side) {
      copy(B, sim); sim.b = 0; sim.roll = false;
      let best = null, volley = null, apex = null;
      for (let i = 0; i < 480; i++) {
        const py = sim.y, pvy = sim.vy;
        step(sim, PADEL.DT);
        const t = (i + 1) * PADEL.DT, onSide = sim.z * side > 0;
        if (sim.b >= 2 && sim.bs === side) break;
        if (sim.b === 1 && sim.bs === side && onSide && Math.abs(sim.x) < HW - 0.3 && Math.abs(sim.z) < HD - (side < 0 ? 2.2 : 0.3) && Math.abs(sim.z) > 1.2) {
          if (sim.y >= 0.45 && sim.y <= 1.25 && sim.vy <= 0.4 && !best) { best = { t, x: sim.x, y: sim.y, z: sim.z }; break; }
          if (pvy > 0 && sim.vy <= 0 && py > 0.32 && !apex) apex = { t, x: sim.x, y: sim.y, z: sim.z };
        }
        if (sim.b === 0 && onSide && !volley && Math.abs(sim.z) > 1.6 && Math.abs(sim.z) < 5.5 && sim.y > 0.6 && sim.y < 1.5 && Math.abs(sim.x) < HW - 0.4) volley = { t, x: sim.x, y: sim.y, z: sim.z };
      }
      return best || apex || volley;
    }
    // удар в точку (x, z) на стороне соперника за время T: мяч всегда перелетает сетку с запасом
    function shoot(fromX, fromY, fromZ, tx, tz, Tf) {
      let Tq = Tf;
      for (let k = 0; k < 14; k++) {
        const vx = (tx - fromX) / Tq, vz = (tz - fromZ) / Tq, vy = (PADEL.r - fromY + 0.5 * PADEL.g * Tq * Tq) / Tq;
        const tn = Math.abs(vz) > 1e-3 ? -fromZ / vz : -1;
        const yn = tn > 0 ? fromY + vy * tn - 0.5 * PADEL.g * tn * tn : 9;
        if (yn > NET + 0.32 || k === 13) { B.x = fromX; B.y = fromY; B.z = fromZ; B.pz = fromZ; B.vx = vx; B.vy = vy; B.vz = vz; B.b = 0; B.roll = false; B.net = false; return; }
        Tq += 0.08;
      }
    }
    // поза: где стоит игрок относительно мяча в момент удара (оси игрока: +x — влево, +z — вперёд)
    const S_FORE = { x: -0.13, y: 1.18, z: 0.0 }, S_BACK = { x: 0.05, y: 1.14, z: 0.02 };
    function racketPose(fore, a, ballY, out) {   // a — угол замаха вокруг плеча; out: {gx,gy,gz, hx,hy,hz, tx,tz}
      const S0 = fore ? S_FORE : S_BACK, sx = fore ? -1 : 1, rad = fore ? 0.34 : 0.27;
      const dx = Math.sin(a) * sx, dz = Math.cos(a);
      const gy = clamp(ballY + 0.06, 0.74, 1.12), tilt = Math.asin(clamp((ballY - gy) / 0.3, -0.92, 0.92)), ct = Math.cos(tilt);
      out.gx = S0.x + dx * rad; out.gy = gy; out.gz = S0.z + dz * rad;
      out.hx = out.gx + dx * 0.26 * ct; out.hy = gy + Math.sin(tilt) * 0.26; out.hz = out.gz + dz * 0.26 * ct;
      out.tx = Math.cos(a) * sx; out.tz = -Math.sin(a);   // касательная (куда идёт ракетка при замахе вперёд)
      return out;
    }
    const A_BACK = 2.25, A_HIT = 0.95, A_FOL = -0.55;
    const pp = { gx: 0, gy: 0, gz: 0, hx: 0, hy: 0, hz: 0, tx: 0, tz: 0 }, pr = { gx: 0, gy: 0, gz: 0, hx: 0, hy: 0, hz: 0, tx: 0, tz: 0 };
    function contactOffset(fore, ballY) { racketPose(fore, A_HIT, ballY, pp); return { x: pp.hx, z: pp.hz }; }
    // героиня (лицом к +z): где встать, чтобы голова ракетки пришлась в мяч
    function heroSpot(bx, by, bz) {
      let fore = bx + 0.63 < HW - 0.25;
      if (bx > HW - 1.4) fore = false; if (bx < -HW + 1.4) fore = true;
      const c = contactOffset(fore, by);
      return { x: clamp(bx - c.x, -HW + 0.3, HW - 0.3), z: clamp(bz - c.z, -HD + 1.6, -0.6), fore };
    }

    function reset() {
      S.phase = 'serve'; S.me = 0; S.fox = 0; S.server = 'hero'; S.rally = 0; S.winner = null; S.hits = 0; S.whiffs = 0; S.perfect = 0; S.glass = 0;
      B.glassSeen = false; timers.length = 0;
      newServe(true);
      C.line(LINES.padelStart, null, 3.4);
      C.hint('Жми по экрану или «Удар!», когда кольцо сожмётся', 5);
      C.mainBtn('🎾', 'Удар!');
      C.sideBtn(null);
      score();
    }
    function score() { C.setScore('Ты ' + S.me + ' : ' + S.fox + ' Лисичка<small>до трёх очков</small>'); }
    function newServe(first) {
      S.phase = 'serve'; S.serveT = 0; S.rally = 0; S.hitter = null;
      inc.on = false; sw.on = false; fsw.on = false; fsw.lunge = 0;
      ball.visible = false; B.live = false;
      if (S.server === 'hero') { C.heroPlace(0.9, -HD + 2.7, 0); F2.x = -0.8; F2.z = HD - 3.5; }
      else { C.heroPlace(0.4, -HD + 3.4, 0); F2.x = -0.9; F2.z = HD - 2.6; }
      F2.tx = F2.x; F2.tz = F2.z; F2.yaw = PI;
      if (first) C.camT.snap = true;
    }
    // подача: мяч падает из руки, отскакивает — бить после отскока
    function dropBall(who) {
      const side = who === 'hero' ? -1 : 1;
      if (who === 'hero') { const c = contactOffset(true, 0.62); B.x = C.H.x + c.x; B.z = C.H.z + c.z; }
      else { B.x = F2.x + 0.55; B.z = F2.z - 0.4; }
      B.y = 1.0; B.vx = B.vy = B.vz = 0; B.b = 0; B.roll = false; B.pz = B.z; B.live = true; ball.visible = true;
      S.expect = who; S.hitter = null;
      plan(who, side);
    }
    function plan(who, side) {
      const p = predict(side);
      if (!p) { inc.on = false; return; }
      inc.on = true; inc.who = who; inc.t = C.t + p.t; inc.x = p.x; inc.y = p.y; inc.z = p.z; inc.tapped = false; inc.q = null; inc.aim = 0; inc.off = undefined; inc.reach = true;
      if (who === 'hero') { const s = heroSpot(p.x, p.y, p.z); inc.fore = s.fore; inc.hx = s.x; inc.hz = s.z; inc.plan = 'hit'; inc.reach = Math.hypot(s.x - C.H.x, s.z - C.H.z) / HERO_V <= p.t - 0.12; }
      else {
        // лисичка: успевает ли (скорость 3.4 м/с + реакция) и решит ли отбить (зависит от удара героини)
        const fx = clamp(p.x - 0.55, -HW + 0.3, HW - 0.3), fz = clamp(p.z + 0.4, 0.6, HD - 0.3);
        const reach = Math.hypot(fx - F2.x, fz - F2.z) / 3.4 + 0.15;
        const q = S.lastQ === 'perfect' ? 2 : S.lastQ === 'good' ? 1 : 0;
        let pr2 = 0.96 - q * 0.19 - S.rally * 0.045; if (S.fox - S.me >= 1) pr2 -= 0.14; if (S.me - S.fox >= 2) pr2 += 0.1;
        const serve = !S.hitter, ok = serve || (reach <= p.t && R() < clamp(pr2, 0.3, 0.95));
        inc.plan = ok ? (!serve && R() < 0.05 ? 'net' : 'hit') : 'miss'; inc.fx = fx; inc.fz = fz; inc.fore = true;
      }
    }
    function quality(dtap) { const a = Math.abs(dtap); return a <= PADEL.PERFECT ? 'perfect' : a <= PADEL.GOOD ? 'good' : 'weak'; }
    // нажатие: замах начинается сразу; удар — точно в момент, когда мяч в точке (мягко прощаем)
    function tap(aimSign) {
      if (C.ended || S.phase === 'point' || S.phase === 'over') return false;
      if (S.phase === 'serve' && S.server === 'hero' && !B.live) { dropBall('hero'); C.heroSay(SAY.serve, 1.0); return true; }
      if (!inc.on || inc.who !== 'hero' || inc.tapped || sw.on) return false;
      if (!inc.reach) { C.hint('Ух, далеко! Не успеть…', 1.2); return false; }
      const ideal = inc.t - PADEL.CONTACT, dtap = C.t - ideal;
      if (dtap < -0.55) { C.hint('Подожди мячик — кольцо ещё большое', 1.6); return false; }
      if (C.t > inc.t + 0.1) return false;
      inc.tapped = true; inc.q = quality(dtap); inc.aim = aimSign || 0;
      sw.on = true; sw.t0 = C.t; sw.tc = Math.max(C.t + 0.06, inc.t); sw.fore = inc.fore; sw.hit = false; sw.y = inc.y;
      C.sfx('swish');
      return true;
    }
    function heroHit() {
      const q = inc.q || 'weak'; S.lastQ = q; S.hits++; if (q === 'perfect') S.perfect++;
      if (C.heroRoot) { racket.updateMatrixWorld(true); v3.set(0, 0.3, 0).applyMatrix4(racket.matrixWorld); F.toW(B.x, B.y, B.z, v3b); S.errs.push(+v3.distanceTo(v3b).toFixed(3)); if (S.errs.length > 30) S.errs.shift(); S.hitLog.push({ t: +(C.t - inc.t).toFixed(3), hero: [+C.H.x.toFixed(2), +C.H.z.toFixed(2), +C.H.yaw.toFixed(2)], plan: [+inc.hx.toFixed(2), +inc.hz.toFixed(2)], ball: [+B.x.toFixed(2), +B.y.toFixed(2), +B.z.toFixed(2)], inc: [+inc.x.toFixed(2), +inc.y.toFixed(2), +inc.z.toFixed(2)], fore: inc.fore, head: [+v3.x.toFixed(2), +v3.y.toFixed(2), +v3.z.toFixed(2)], bw: [+v3b.x.toFixed(2), +v3b.y.toFixed(2), +v3b.z.toFixed(2)] }); }
      const side = inc.aim ? -inc.aim : (F2.x > 0.5 ? -1 : F2.x < -0.5 ? 1 : (R() < 0.5 ? -1 : 1));
      const ax = q === 'perfect' ? lerp(2.7, 3.7, R()) : q === 'good' ? lerp(1.3, 3.2, R()) : lerp(0, 2.0, R());
      const tz = q === 'perfect' ? lerp(6.6, 8.6, R()) : q === 'good' ? lerp(5, 8, R()) : lerp(3.4, 6, R());
      const Tf = q === 'perfect' ? 0.95 : q === 'good' ? 1.1 : 1.3;
      shoot(B.x, Math.max(B.y, 0.45), Math.min(B.z, -0.5), clamp(side * ax, -HW + 0.6, HW - 0.6), tz, Tf);
      S.hitter = 'hero'; S.expect = 'fox'; S.rally++; inc.on = false;
      C.sfx('hit'); C.haptic(q === 'perfect' ? 'medium' : 'light');
      C.heroSay(q === 'perfect' ? SAY.perfect : q === 'good' ? SAY.good : SAY.weak, 0.9);
      plan('fox', 1);
    }
    function foxHit(fault) {
      let pw = 0.17 + S.rally * 0.04; if (S.fox - S.me >= 1) pw = 0.06; if (S.me - S.fox >= 2) pw = 0.32; if (!S.hitter) pw = 0;
      const win = !fault && R() < pw, lob = !win && R() < 0.25 && !fault;
      const far = C.H.x > 0 ? -1 : 1;
      const tx = win ? far * lerp(3.5, 4.1, R()) : clamp(C.H.x + lerp(-2.2, 2.2, R()), -HW + 0.7, HW - 0.7), tz = win ? -lerp(2.6, 3.4, R()) : lob ? -HD + 2.6 : -lerp(3.8, 7.0, R());
      shoot(B.x, Math.max(B.y, 0.45), Math.max(B.z, 0.5), tx, tz, win ? 0.72 : lob ? 1.5 : lerp(1.15, 1.4, R()));
      if (win) { S.winners = (S.winners || 0) + 1; C.line(LINES.foxWinner, fox.root, 1.4); }
      if (fault) { B.vy *= 0.4; B.vz *= 0.85; }
      S.hitter = 'fox'; S.expect = 'hero'; S.rally++; inc.on = false;
      C.sfx('hit');
      plan('hero', -1);
    }
    function point(winner, why) {
      if (S.phase === 'point' || S.phase === 'over') return;
      if (winner === 'hero') S.me++; else S.fox++;
      S.phase = 'point'; S.pointT = 0; S.winner = winner; inc.on = false;
      score();
      if (winner === 'hero') { C.flash(SAY.point); C.sfx('point'); C.haptic('success'); C.H.celebrate = S.me >= PADEL.WIN; line2(why === 'net' ? LINES.foxNet : pick(LINES.foxMiss, R)); }
      else { C.sfx('aww'); line2(pick(LINES.foxPoint, R)); if (why === 'whiff') C.heroSay(SAY.miss, 1.2); }
      fox.st.hop = 0; fox.hopT = winner === 'fox' ? 0 : -1;
    }
    const line2 = L => C.line(L, fox.root, 2.2);
    function over() {
      S.phase = 'over';
      const won = S.me > S.fox, res = { me: S.me, them: S.fox, won, hits: S.hits, perfect: S.perfect };
      const b = BEST.padel; if (!b || (res.me - res.them) > (b.me - b.them)) BEST.padel = { me: res.me, them: res.them };
      if (won) { C.confetti.burst(...wpos(C.H.x, 1.6, C.H.z), R); C.line(LINES.foxLose, fox.root, 3); C.sfx('cheer'); }
      else C.line(LINES.foxWin, fox.root, 3);
      S.last = res;
      setTimeoutGame(1.4, () => C.showEnd({ title: won ? 'Победа! 🎾' : 'Хорошая игра!', text: 'Счёт <b>' + res.me + ' : ' + res.them + '</b> · отбито мячей: ' + res.hits + (res.perfect ? ' · супер-ударов: ' + res.perfect : ''), best: 'Лучший счёт за сегодня: ' + BEST.padel.me + ' : ' + BEST.padel.them, result: res }));
    }
    const wv = new T.Vector3();
    function wpos(lx, ly, lz) { F.toW(lx, ly, lz, wv); return [wv.x, wv.y, wv.z]; }
    const timers = [];
    function setTimeoutGame(sec, fn) { timers.push({ t: C.t + sec, fn }); }

    function stepGame(dt) {
      for (let i = timers.length - 1; i >= 0; i--) if (C.t >= timers[i].t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      if (S.phase === 'serve') {
        S.serveT += dt;
        if (!B.live && S.server === 'fox' && S.serveT > 1.0) { dropBall('fox'); }
        if (!B.live && S.server === 'hero' && (S.serveT > 2.4 || (S.auto && S.serveT > 0.7))) { dropBall('hero'); }
      }
      // мяч
      if (B.live) {
        let acc = dt;
        while (acc > 1e-6) {
          const h = Math.min(acc, PADEL.DT); acc -= h;
          const ev = step(B, h);
          if (ev & 4 && B.b >= 1 && (S.phase === 'rally' || S.phase === 'serve')) { S.glass++; C.sfx('glass'); if (!B.glassSeen) { B.glassSeen = true; C.line(LINES.padelGlass, null, 2.8); } }
          if (ev & 2) C.sfx('glass');
          if (ev & 8) { C.sfx('net'); B.net = true; }
          if (ev & 1) C.sfx('bounce');
          if ((ev & (1 | 16)) && (S.phase === 'rally' || S.phase === 'serve')) {
            const side = B.bs < 0 ? 'hero' : 'fox';
            if (S.hitter && side === S.hitter) { point(side === 'hero' ? 'fox' : 'hero', B.net ? 'net' : 'own'); break; }
            if (B.b >= 2 && !S.hitter) { C.hint('Ещё разок — подача!', 1.8); S.serveT = 0; B.live = false; ball.visible = false; inc.on = false; sw.on = false; if (S.server === 'hero') C.heroPlace(0.9, -HD + 2.7, 0); break; }
            if (B.b >= 2) { point(side === 'hero' ? 'fox' : 'hero', side === 'hero' ? 'whiff' : 'miss'); break; }
          }
        }
        if (S.phase === 'serve' && S.hitter) S.phase = 'rally';
      }
      // удар по плану: героиня (по нажатию), лисичка (сама)
      if (inc.on && inc.who === 'hero' && sw.on && !sw.hit && C.t >= sw.tc) { sw.hit = true; if (Math.hypot(C.H.x - inc.hx, C.H.z - inc.hz) < 0.85) heroHit(); else { inc.on = false; S.whiffs++; C.heroSay(SAY.reach, 1.2); } }
      if (inc.on && inc.who === 'hero' && S.auto && !inc.tapped && inc.reach) {
        if (inc.off === undefined) inc.off = S.auto === 'perfect' ? 0 : S.auto === 'weak' ? lerp(-0.5, 0.36, R()) : S.auto === 'whiff' ? 9 : (R() - 0.5) * 0.3;
        const ideal = inc.t - PADEL.CONTACT, off = inc.off;
        if (C.t >= ideal + off) tap(0);
      }
      if (inc.on && inc.who === 'hero' && !inc.tapped && C.t > inc.t + 0.12 && !sw.on) { inc.on = false; S.whiffs++; }
      if (inc.on && inc.who === 'fox') {
        if (!fsw.on && C.t >= inc.t - 0.3) { fsw.on = true; fsw.t0 = C.t; fsw.tc = inc.t; fsw.lunge = 0; fsw.dir = 0; }
        if (C.t >= inc.t) {
          if (inc.plan === 'hit') foxHit(false);
          else if (inc.plan === 'net') foxHit(true);
          else { inc.on = false; fsw.lunge = 1; fsw.dir = Math.sign(B.x - F2.x) || 1; C.sfx('whoosh'); }
        }
      }
      if (S.phase === 'rally' && B.live && (Math.abs(B.z) > HD + 1 || B.y > 6)) point(S.hitter === 'hero' ? 'fox' : 'hero', 'out');
      if (S.phase === 'point') {
        S.pointT += dt;
        if (S.pointT > 1.5) {
          if (S.me >= PADEL.WIN || S.fox >= PADEL.WIN) over();
          else { S.server = S.server === 'hero' ? 'fox' : 'hero'; newServe(false); }
        }
      }
      // героиня бежит к точке удара; лисичка — тоже
      const H = C.H;
      if (inc.on && inc.who === 'hero') C.heroMove(inc.hx, inc.hz, HERO_V, 0, dt);
      else if (S.phase === 'rally' || S.phase === 'point') C.heroMove(clamp(H.x * 0.6, -1.6, 1.6), -HD + 4.2, S.phase === 'point' ? 1.2 : 2.6, 0, dt);
      else C.heroMove(H.x, H.z, 0, 0, dt);
      // лисичка
      let ftx = F2.x, ftz = F2.z, fv = 0;
      if (inc.on && inc.who === 'fox') { ftx = inc.plan === 'miss' ? lerp(F2.x, inc.fx, 0.55) : inc.fx; ftz = inc.plan === 'miss' ? lerp(F2.z, inc.fz, 0.55) : inc.fz; fv = 3.4; }
      else if (S.phase === 'rally') { ftx = clamp(B.x * 0.4, -2, 2); ftz = HD - 3.4; fv = 2.2; }
      const fdx = ftx - F2.x, fdz = ftz - F2.z, fd = Math.hypot(fdx, fdz);
      if (fd > 0.02 && fv > 0) { const s = Math.min(fd, fv * dt); F2.x += fdx / fd * s; F2.z += fdz / fd * s; }
      fox.st.spd = damp(fox.st.spd, fd > 0.05 && fv > 0 ? Math.min(fv, fd / Math.max(dt, 1e-3)) : 0, 10, dt);
      const fWant = fd > 0.8 && fv > 0 ? Math.atan2(fdx, fdz) : PI;
      F2.yaw += clamp(angW(fWant - F2.yaw), -10 * dt, 10 * dt);
    }

    // позы: ракетка героини (ИК правой руки, бэкхенд — обеими), разворот корпуса; лисичка — лапка с ракеткой
    function pose(dt) {
      const AB = C.anim && C.anim.bones, hr = C.heroRoot;
      // фаза замаха
      let u = 0, wS = 0, fore = inc.on && inc.who === 'hero' ? inc.fore : sw.fore;
      if (sw.on) {
        const tc = sw.tc - sw.t0, t = C.t - sw.t0;
        if (t < tc) { const wind = Math.max(0.0001, tc - Math.min(0.11, tc * 0.5)); u = t < wind ? 0.25 * easeOut(t / wind) : 0.25 + 0.2 * ((t - wind) / Math.max(0.0001, tc - wind)); }
        else u = 0.45 + 0.55 * clamp((t - tc) / 0.32, 0, 1);
        wS = Math.min(sst(0, 0.1, u), 1 - sst(0.82, 1, u));
        if (t > tc + 0.34) sw.on = false;
        fore = sw.fore;
      }
      // ожидание: ракетка чуть отведена, если мяч летит к ней
      const ready = inc.on && inc.who === 'hero' ? sst(1.2, 0.35, inc.t - C.t) * 0.35 : 0;
      const a = u < 0.25 ? lerp(lerp(0.35, A_BACK, ready), A_BACK, u / 0.25) : u < 0.45 ? lerp(A_BACK, A_HIT, (u - 0.25) / 0.2) : lerp(A_HIT, A_FOL, (u - 0.45) / 0.55);
      racketPose(fore, wS > 0 ? a : lerp(0.35, A_BACK, ready), sw.on ? sw.y : inc.on ? inc.y : 0.9, pp);
      // покой: ракетка перед собой, голова вверх-вперёд
      pr.gx = -0.12; pr.gy = 0.96; pr.gz = 0.3; pr.hx = -0.03; pr.hy = 1.24; pr.hz = 0.42; pr.tx = 0; pr.tz = 1;
      const k = Math.max(wS, ready > 0.01 ? ready * 2.2 : 0), kk = clamp(k, 0, 1);
      const gx = lerp(pr.gx, pp.gx, kk), gy = lerp(pr.gy, pp.gy, kk), gz = lerp(pr.gz, pp.gz, kk);
      const hx = lerp(pr.hx, pp.hx, kk), hy = lerp(pr.hy, pp.hy, kk), hz = lerp(pr.hz, pp.hz, kk);
      const nx = lerp(pr.tx, pp.tx, kk), nz = lerp(pr.tz, pp.tz, kk);
      if (AB && hr && !C.iaBusy()) {
        // разворот корпуса: замах — плечи назад, удар — вперёд
        const tw = wS * (u < 0.25 ? -0.55 * (u / 0.25) : u < 0.45 ? lerp(-0.55, 0.25, (u - 0.25) / 0.2) : lerp(0.25, 0.5, (u - 0.45) / 0.55)) * (fore ? 1 : -1);
        if (AB.spine) AB.spine.rotation.y += tw * 0.45; if (AB.chest) AB.chest.rotation.y += tw * 0.55; if (AB.head) AB.head.rotation.y -= tw * 0.7;
        if (AB.spine) AB.spine.rotation.x += 0.08 * kk; if (AB.thigh_L) { AB.thigh_L.rotation.x -= 0.12 * kk; AB.shin_L.rotation.x += 0.2 * kk; AB.thigh_R.rotation.x -= 0.12 * kk; AB.shin_R.rotation.x += 0.2 * kk; }
        hr.updateMatrixWorld(true);
        G1.set(gx, gy, gz).applyMatrix4(hr.matrixWorld);
        hr.getWorldQuaternion(qH);
        pole.set(-0.7, -0.6, -0.25).applyQuaternion(qH);
        C.IK.arm(AB, 'R', G1, pole, 1, 0.065, 0.15);
        // бэкхенд и покой — вторая рука на ручке/горле ракетки
        const twoH = !fore && wS > 0.2 ? wS : (1 - kk) * 0.85;
        if (twoH > 0.05) {
          v3.set(hx - gx, hy - gy, hz - gz).normalize();
          const off = !fore && wS > 0.2 ? 0.085 : 0.16;
          v3b.set(gx + v3.x * off, gy + v3.y * off, gz + v3.z * off).applyMatrix4(hr.matrixWorld);
          pole.set(0.7, -0.6, -0.25).applyQuaternion(qH);
          C.IK.arm(AB, 'L', v3b, pole, twoH, 0.06, 0.15);
        }
      }
      // ракетка: в кисти; ось ручка → голова; лицо — по ходу замаха
      if (hr) {
        hr.updateMatrixWorld(true);
        hr.getWorldQuaternion(qH);
        G1.set(gx, gy, gz).applyMatrix4(hr.matrixWorld);
        H1.set(hx - gx, hy - gy, hz - gz).applyQuaternion(qH).normalize();
        N1.set(nx, 0, nz).applyQuaternion(qH); N1.addScaledVector(H1, -N1.dot(H1)); if (N1.lengthSq() < 1e-6) N1.set(0, 0, 1); N1.normalize();
        X1.crossVectors(H1, N1).normalize();
        m4.makeBasis(X1, H1, N1); racket.quaternion.setFromRotationMatrix(m4);
        racket.position.copy(G1).addScaledVector(H1, -0.06);
        racket.visible = !C.iaBusy();
      }
      // лисичка
      F.toW(F2.x, 0, F2.z, v3c); fox.root.position.copy(v3c); fox.root.rotation.y = F.yaw(F2.yaw);
      const fs = fox.st;
      let farm0 = 0, farmz = -0.15, ftw = 0, fhop = 0;
      if (fsw.on) {
        const t = C.t - fsw.t0, tc = fsw.tc - fsw.t0;
        if (fsw.lunge > 0) { const lu = clamp((C.t - fsw.tc) / 0.5, 0, 1); fs.roll = damp(fs.roll, -fsw.dir * 0.9 * Math.sin(lu * PI) , 14, dt); farm0 = -1.3; farmz = -1.2; fhop = Math.sin(lu * PI) * 0.12; if (lu >= 1) { fsw.on = false; fsw.lunge = 0; } }
        else {
          const u2 = t < tc ? 0.5 * (t / Math.max(0.01, tc)) : 0.5 + 0.5 * clamp((t - tc) / 0.3, 0, 1);
          farm0 = u2 < 0.5 ? lerp(0, 0.7, u2 / 0.5) : lerp(0.7, -1.4, (u2 - 0.5) / 0.5); farmz = u2 < 0.5 ? lerp(-0.15, -1.1, u2 / 0.5) : lerp(-1.1, -0.5, (u2 - 0.5) / 0.5);
          ftw = u2 < 0.5 ? lerp(0, -0.5, u2 / 0.5) : lerp(-0.5, 0.55, (u2 - 0.5) / 0.5);
          if (t > tc + 0.32) fsw.on = false;
        }
      } else fs.roll = damp(fs.roll, 0, 8, dt);
      if (fox.hopT !== undefined && fox.hopT >= 0) { fox.hopT += dt; fhop = Math.max(fhop, Math.abs(Math.sin(fox.hopT * 9)) * 0.12 * (1 - clamp(fox.hopT / 1.2, 0, 1))); if (fox.hopT > 1.2) fox.hopT = -1; }
      fs.armR[0] = farm0; fs.armR[2] = farmz; fs.twist = ftw; fs.hop = fhop; fs.armL[2] = 0.35;
      fs.look = clamp(angW(Math.atan2(B.x - F2.x, B.z - F2.z) - F2.yaw), -0.7, 0.7) * (B.live ? 1 : 0);
      animalPose(fox, dt, C.t);
      // мяч, тень, кольца
      F.toW(B.x, B.y, B.z, v3); ball.position.copy(v3); ball.rotation.x += B.vz * dt * 3; ball.rotation.z -= B.vx * dt * 3;
      F.toW(B.x, 0.058, B.z, v3); blob.position.copy(v3); const hb = clamp(B.y / 3, 0, 1); blob.scale.setScalar(0.12 * (1 - hb * 0.5)); blob.material.opacity = 0.28 * (1 - hb * 0.6); blob.visible = ball.visible;
      const showRing = inc.on && inc.who === 'hero' && !inc.tapped && inc.reach;
      rings.visible = showRing || (S.phase === 'serve' && S.server === 'hero' && !B.live);
      if (rings.visible) {
        let rx, rz, r1, colOk;
        if (showRing) { const ideal = inc.t - PADEL.CONTACT, dtt = ideal - C.t; rx = inc.x; rz = inc.z; r1 = dtt > 0 ? 0.42 + Math.min(1.5, dtt * 1.5) : Math.max(0.12, 0.42 + dtt * 1.2); colOk = Math.abs(dtt) <= PADEL.GOOD; }
        else { const c = contactOffset(true, 0.62); rx = C.H.x + c.x; rz = C.H.z + c.z; r1 = 0.42 + 0.15 * Math.abs(Math.sin(C.t * 4)); colOk = false; }
        F.toW(rx, 0.065, rz, v3);
        dummy.position.copy(v3); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.42); dummy.updateMatrix(); rings.setMatrixAt(0, dummy.matrix);
        dummy.scale.setScalar(r1); dummy.updateMatrix(); rings.setMatrixAt(1, dummy.matrix);
        rings.setColorAt(0, ringCol.set('#FFFFFF')); rings.setColorAt(1, ringCol.set(colOk ? '#7FD67F' : '#FFD34D'));
        rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
      }
      C.ui.main.classList.toggle('soft', !(showRing || (S.phase === 'serve' && S.server === 'hero')));
    }
    const camP = new T.Vector3(), camL = new T.Vector3();
    const cam = { x: 0, z: -HD + 0.3 };
    function camera(ct, dt) {
      // за спиной героини и выше (внутри корта — стёкла и тёмная полоса сверху не мешают): видно её целиком и дальний край
      const hz = S.phase === 'serve' && S.server === 'fox' ? -HD + 3 : C.H.z;
      cam.x = clamp(C.H.x * 0.8, -3.2, 3.2); cam.z = clamp(hz - 3.0, -HD + 0.25, -2.5);
      const fov = C.fitFov(40, 48), y = 3.7, dz = Math.max(0.6, hz - cam.z);
      const low = Math.atan2(y, dz) + fov * PI / 180 * 0.13, pitch = low - fov * PI / 360;
      F.toW(cam.x, y, cam.z, camP); F.toW(cam.x * 0.7, y - Math.tan(pitch) * 10, cam.z + 10, camL);
      ct.pos.copy(camP); ct.look.copy(camL); ct.fov = fov; ct.k = 5.5;
    }
    return {
      reset, step: stepGame, pose, camera,
      main: () => tap(0),
      down: () => { tap(0); },
      move: dx => { if (inc.tapped && Math.abs(dx) > 26) inc.aim = dx > 0 ? 1 : -1; },
      up: () => {},
      key: s => { if (inc.tapped) inc.aim = s; },
      animState: () => null,
      result: () => S.last,
      state: () => ({ phase: S.phase, me: S.me, them: S.fox, server: S.server, rally: S.rally, live: B.live, hits: S.hits, whiffs: S.whiffs, glass: S.glass, incoming: inc.on ? { who: inc.who, in: +(inc.t - C.t).toFixed(2), y: +inc.y.toFixed(2), plan: inc.plan, reach: inc.who === 'hero' ? !!inc.reach : null } : null, winners: S.winners || 0, ball: { x: +B.x.toFixed(2), y: +B.y.toFixed(2), z: +B.z.toFixed(2) }, fox: { x: +F2.x.toFixed(2), z: +F2.z.toFixed(2) } }),
      debug: { tap: () => tap(0), auto: m => { S.auto = m || null; return S.auto; }, ideal: () => (inc.on && inc.who === 'hero' ? inc.t - PADEL.CONTACT - C.t : null),
        swingErr: () => S.errs.slice(), hitLog: () => S.hitLog.slice() },
      dispose() { timers.length = 0; },
    };
  }

  /* =====================================================================
     7. МИНИ-ФУТБОЛ: пенальти — 5 ударов Мишке-вратарю (провести пальцем: куда и как сильно; или «Удар!» по метке);
        «Пас-пас» — Зайка катит мяч, бьёшь с ходу по кольцу. Вратарь прыгает смешно, иногда угадывает.
     ===================================================================== */
  const FOOT = { g: 6.9, r: 0.17, KICKS: 5, CONTACT: 0.24 };
  function footballGame(C) {
    const { T, K, F, R } = C;
    const c = C.court, GW = c.goalW || 3, GH = c.goalH || 2, GD = c.goalD || 1;
    const GZ = c.goalZ !== undefined ? c.goalZ : (c.d || 34) / 2 - 0.1, SPOT = GZ - (c.spotD || 6);
    const bear = makeAnimal(K, 'bear', {}, C.bag); bear.root.userData.headY = 1.42; C.add(bear.root);
    const bunny = makeAnimal(K, 'bunny', {}, C.bag); bunny.root.userData.headY = 1.55; bunny.root.visible = false; C.add(bunny.root);
    const ball = makeBall(K, 'football'); C.add(ball);
    const blob = makeBlob(T, C.bag); C.add(blob);
    const marks = makeRings(T, C.bag, 3); C.add(marks);   // 0 — метка в воротах, 1/2 — кольцо по времени (пас-пас)
    const S = { phase: 'intro', variant: C.o.variant === 'pass' ? 'pass' : 'penalty', kick: 0, goals: 0, res: [], t: 0, aimX: 0, aimY: 0.9, swipe: null, auto: null, outcome: null, last: null, passT: 0, power: 0.6, q: null };
    const Bl = { x: 0, y: FOOT.r, z: SPOT, vx: 0, vy: 0, vz: 0, live: false, spin: 0, inNet: false, held: false, crossed: false };
    const Kp = { x: 0, y: 0, z: GZ - 0.35, tx: 0, dive: 0, diveT: -1, diveX: 0, diveY: 0, save: null, sad: 0, back: 0 };
    const Bn = { x: -1.55, z: SPOT + 3.0 };
    const kick = { on: false, t0: 0, tc: 0, done: false, run: false, runT0: 0 };
    const v3 = new T.Vector3(), dummy = new T.Object3D(), col = new T.Color(), wv = new T.Vector3();
    const START = { x: 0.55, z: SPOT - 1.55 }, CONT = { x: 0.12, z: SPOT - 0.36 };
    const timers = []; const later = (sec, fn) => timers.push({ t: C.t + sec, fn });

    function reset() {
      S.kick = 0; S.goals = 0; S.res = []; S.outcome = null; timers.length = 0;
      bunny.root.visible = S.variant === 'pass';
      C.line(S.variant === 'pass' ? LINES.footPassStart : LINES.footStart, null, 3.2);
      C.hint(S.variant === 'pass' ? 'Зайка катит мяч — жми, когда он в кольце' : 'Проведи к воротам: куда и как сильно. Или «Удар!»', 5.5);
      C.mainBtn('⚽', 'Удар!');
      C.sideBtn(S.variant === 'pass' ? 'Пенальти' : 'Пас-пас', true);
      C.ui.side.classList.add('low'); C.ui.side.style.right = '132px';
      next(true);
    }
    function score() {
      let d = ''; for (let i = 0; i < FOOT.KICKS; i++) d += S.res[i] === 'goal' ? '⚽' : S.res[i] ? '·' : '○';
      C.setScore('Голы: ' + S.goals + ' из ' + FOOT.KICKS + '<small class="dots">' + d + '</small>');
    }
    function next(first) {
      S.phase = S.variant === 'pass' ? 'pass' : 'aim'; S.t = 0; S.outcome = null; S.swipe = null; S.passT = 0; S.q = null;
      Bl.live = false; Bl.inNet = false; Bl.held = false; Bl.crossed = false; Bl.vx = Bl.vy = Bl.vz = 0; Bl.spin = 0;
      if (S.variant === 'pass') { Bl.x = Bn.x + 0.35; Bl.z = Bn.z - 0.1; Bl.y = FOOT.r; C.heroPlace(CONT.x, CONT.z, 0); }
      else { Bl.x = 0; Bl.z = SPOT; Bl.y = FOOT.r; C.heroPlace(START.x, START.z, -0.32); }
      Kp.x = 0; Kp.tx = 0; Kp.dive = 0; Kp.diveT = -1; Kp.save = null; Kp.back = 0; bear.st.roll = 0;
      kick.on = false; kick.done = false; kick.run = false;
      score();
      if (first) C.camT.snap = true;
    }
    // куда летит мяч → исход (решаем заранее, вратарь потом это «играет»)
    function decide(tx, ty, power, weak) {
      const inX = Math.abs(tx) < GW / 2 - FOOT.r * 0.6, inY = ty < GH - FOOT.r * 0.6;
      const nearPost = Math.abs(Math.abs(tx) - GW / 2) < FOOT.r * 0.9 && ty < GH + 0.1, nearBar = Math.abs(ty - GH) < FOOT.r * 0.9 && Math.abs(tx) < GW / 2 + 0.1;
      if (nearPost || nearBar) return 'post';
      if (!inX) return 'wide';
      if (!inY) return 'high';
      const corner = clamp(Math.abs(tx) / (GW / 2), 0, 1), low = ty < 0.5 ? 0.08 : 0;
      let p = 0.55 - 0.35 * corner - 0.18 * power + (weak ? 0.22 : 0) - low;
      const shots = S.res.length; if (shots >= 2 && S.goals < shots / 2) p *= 0.6;
      if (S.goals === 0 && shots >= 3) p *= 0.4;
      return R() < clamp(p, 0.06, 0.62) ? 'save' : 'goal';
    }
    function launch() {
      // контакт: мяч летит в (aimX, aimY) на линии ворот
      const tx = S.aimX, ty = S.aimY, Tf = lerp(1.0, 0.5, S.power), dz = GZ - Bl.z;
      Bl.vx = (tx - Bl.x) / Tf; Bl.vz = dz / Tf; Bl.vy = (ty - Bl.y + 0.5 * FOOT.g * Tf * Tf) / Tf; Bl.live = true; Bl.spin = 14 + S.power * 10;
      S.outcome = decide(tx, ty, S.power, S.q === 'weak');
      S.phase = 'flight'; S.t = 0;
      // вратарь: при «сейв» — точно к мячу, иначе — не туда
      const o2 = S.outcome;
      if (o2 === 'save') { Kp.diveX = clamp(tx, -1.35, 1.35); Kp.diveY = clamp(ty, 0, 1.3); Kp.save = Math.abs(tx) < 0.75 && ty < 1.25 ? 'catch' : 'parry'; }
      else { const side = Math.abs(tx) > 0.35 ? -Math.sign(tx) : (R() < 0.5 ? -1 : 1); Kp.diveX = side * lerp(0.8, 1.25, R()); Kp.diveY = lerp(0.2, 0.9, R()); Kp.save = null; }
      Kp.diveT = 0.1 + (o2 === 'save' ? 0 : 0.08); Kp.tf = Tf;
      C.sfx('kick'); C.haptic('light');
    }
    function startKick() {
      if (S.phase !== 'aim' && S.phase !== 'pass') return false;
      if (S.variant === 'penalty') { S.phase = 'run'; kick.run = true; kick.runT0 = C.t; }
      return true;
    }
    // пенальти: свайп (dx, dy в пикселях, длительность)
    function swipeKick(dx, dy, sec) {
      if (S.phase !== 'aim' || C.ended) return false;
      const len = Math.hypot(dx, dy); if (len < 40 || dy > -20) { C.hint('Проведи пальцем вверх — к воротам', 2); return false; }
      aimFromSwipe(dx, dy);
      S.power = clamp((len / sec - 500) / 2400, 0.15, 1); S.q = 'good';
      return startKick();
    }
    const gp = new T.Vector3(), sp2 = new T.Vector3();
    function aimFromSwipe(dx, dy) {
      // продолжаем линию свайпа до высоты ворот на экране: так «куда провела» — туда и полетит
      const w = C.ui.score.parentNode.clientWidth || 390, h = C.ui.score.parentNode.clientHeight || 844;
      F.toW(0, GH * 0.5, GZ, gp); gp.project(C.cam); F.toW(Bl.x, FOOT.r, Bl.z, sp2); sp2.project(C.cam);
      const gy = (-gp.y * 0.5 + 0.5) * h, by = (-sp2.y * 0.5 + 0.5) * h, bx = (sp2.x * 0.5 + 0.5) * w;
      const dist = Math.max(60, by - gy), k = dist / Math.max(1, -dy);
      const sxp = bx + dx * k;
      // экранная x на уровне ворот → x на линии ворот (через две проекции стоек)
      F.toW(-GW / 2, GH * 0.5, GZ, gp); gp.project(C.cam); const xl = (gp.x * 0.5 + 0.5) * w;
      F.toW(GW / 2, GH * 0.5, GZ, gp); gp.project(C.cam); const xr = (gp.x * 0.5 + 0.5) * w;
      const u = (sxp - xl) / ((xr - xl) || 1);
      S.aimX = clamp(lerp(-GW / 2, GW / 2, u), -2.6, 2.6);
      S.aimY = clamp(0.25 + (Math.hypot(dx, dy) / dist) * 1.0, 0.2, 2.5);
    }
    // «Удар!» — по качающейся метке; пас-пас — по кольцу
    function main() {
      if (C.ended) return false;
      if (S.phase === 'aim') { S.aimX = markX(); S.aimY = markY(); S.power = 0.62; S.q = 'good'; return startKick(); }
      if (S.phase === 'pass' && Bl.live && !kick.on) {
        const ideal = S.arrive - FOOT.CONTACT, d = C.t - ideal;
        if (d < -0.6) { C.hint('Подожди мячик!', 1.4); return false; }
        if (C.t > S.arrive + 0.12) return false;
        const a = Math.abs(d); S.q = a < 0.1 ? 'perfect' : a < 0.27 ? 'good' : 'weak';
        const er = S.q === 'perfect' ? 0 : S.q === 'good' ? 0.35 : 0.9;
        S.aimX = clamp(markX() * (S.q === 'weak' ? 0.4 : 1) + (R() - 0.5) * er, -2.2, 2.2); S.aimY = clamp(markY() + (R() - 0.5) * er * 0.6, 0.2, 2.2);
        S.power = S.q === 'perfect' ? 0.85 : S.q === 'good' ? 0.65 : 0.3;
        kick.on = true; kick.t0 = C.t; kick.tc = Math.max(C.t + 0.08, S.arrive); kick.done = false;
        C.heroSay(S.q === 'perfect' ? SAY.perfect : S.q === 'good' ? SAY.good : SAY.weak, 0.8);
        return true;
      }
      return false;
    }
    const markX = () => Math.sin(C.t * 1.35) * (GW / 2 - 0.35);
    const markY = () => 0.75 + Math.sin(C.t * 0.83 + 1) * 0.5;
    function result(o2) {
      S.res.push(o2 === 'goal' ? 'goal' : o2); if (o2 === 'goal') S.goals++;
      S.phase = 'result'; S.t = 0; score();
      if (o2 === 'goal') { C.flash(SAY.goal); C.sfx('goal'); C.haptic('success'); C.H.celebrate = true; C.confetti.burst(...wpos(0, GH * 0.6, GZ + 0.2), R); C.line(pick(LINES.bearGoal, R), bear.root, 2.4); if (S.variant === 'pass') later(0.9, () => C.line(LINES.bunnyGoal, bunny.root, 1.8)); }
      else if (o2 === 'save') { C.sfx('save'); C.line(Kp.save === 'catch' ? pick(LINES.bearSave, R) : LINES.bearParry, bear.root, 2.2); C.heroSay(SAY.saved, 1.4); }
      else if (o2 === 'post') { C.sfx('post'); C.flash('Дзынь!'); C.line(LINES.bearPost, bear.root, 2.2); C.heroSay(SAY.post, 1.4); }
      else { C.sfx('aww'); C.heroSay(o2 === 'high' ? SAY.high : SAY.wide, 1.4); }
    }
    function wpos(lx, ly, lz) { F.toW(lx, ly, lz, wv); return [wv.x, wv.y, wv.z]; }
    function over() {
      S.phase = 'over';
      const res = { goals: S.goals, kicks: FOOT.KICKS, variant: S.variant, shots: S.res.slice() };
      const b = BEST.football; if (!b || res.goals > b.goals) BEST.football = { goals: res.goals, kicks: FOOT.KICKS };
      S.last = res;
      C.line(LINES.footEnd, null, 2.8);
      const title = res.goals >= 4 ? 'Бомбардир! ⚽' : res.goals >= 2 ? 'Здорово!' : 'Хорошая попытка!';
      later(0.6, () => C.showEnd({ title, text: 'Голов: <b>' + res.goals + ' из ' + FOOT.KICKS + '</b>' + (S.variant === 'pass' ? ' · пас-пас с Зайкой' : ' · пенальти'), best: 'Лучшее за сегодня: ' + BEST.football.goals + ' из ' + FOOT.KICKS,
        extra: [[S.variant === 'pass' ? 'Пенальти' : 'Пас-пас с Зайкой', () => { S.variant = S.variant === 'pass' ? 'penalty' : 'pass'; C.hideEnd(); C.curtain(() => { reset(); C.camT.snap = true; }, null); }]], result: res }));
    }
    function stepGame(dt) {
      for (let i = timers.length - 1; i >= 0; i--) if (C.t >= timers[i].t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      S.t += dt;
      const H = C.H;
      // автоигра для тестов
      if (S.auto && S.phase === 'aim' && S.t > 0.6) {
        if (S.auto === 'swipe') swipeKick(lerp(-90, 90, R()), -lerp(260, 420, R()), 0.22); else main();
      }
      if (S.auto && S.phase === 'pass' && Bl.live && !kick.on && C.t >= S.arrive - FOOT.CONTACT + (S.auto === 'perfect' ? 0 : (R() - 0.5) * 0.25)) main();
      // пас-пас: Зайка пасует
      if (S.phase === 'pass') {
        S.passT += dt;
        if (!Bl.live && S.passT > 1.1) {
          const tx = CONT.x - 0.12, tz = CONT.z + 0.38, Tp = 1.25, dx = tx - Bl.x, dz = tz - Bl.z;
          Bl.vx = dx / Tp; Bl.vz = dz / Tp; Bl.vy = 0; Bl.live = true; S.arrive = C.t + Tp; Bl.roll = true;
          bunny.kickT = 0; C.line(pick(LINES.bunnyPass, R), bunny.root, 1.3); C.sfx('kick');
        }
        if (Bl.live && !kick.on && C.t > S.arrive + 0.15) { Bl.live = true; S.phase = 'flight'; S.outcome = 'wide'; S.t = 0; Bl.vx *= 0.8; C.heroSay(SAY.miss, 1.2); }
      }
      // разбег (пенальти)
      if (S.phase === 'run') {
        const d = C.heroMove(CONT.x, CONT.z, 2.6, 0, dt);
        if (d < 0.05 || C.t - kick.runT0 > 1.2) { S.phase = 'kick'; kick.on = true; kick.t0 = C.t; kick.tc = C.t + FOOT.CONTACT; kick.done = false; }
      } else if (S.phase === 'aim') C.heroMove(START.x, START.z, 0, -0.32 + Math.sin(C.t * 1.3) * 0.04, dt);
      else C.heroMove(H.x, H.z, 0, 0, dt);
      if (kick.on && !kick.done && C.t >= kick.tc) { kick.done = true; if (S.variant === 'pass') { Bl.x = CONT.x - 0.12; Bl.z = CONT.z + 0.38; } launch(); }
      // мяч
      if (Bl.live) {
        if (S.phase === 'pass' || (S.phase === 'kick' && S.variant === 'pass' && !kick.done)) { Bl.x += Bl.vx * dt; Bl.z += Bl.vz * dt; Bl.vx *= 1 - 0.25 * dt; Bl.vz *= 1 - 0.25 * dt; Bl.y = FOOT.r; }
        else if (Bl.held) { /* в лапах у вратаря */ }
        else {
          Bl.vy -= FOOT.g * dt; Bl.x += Bl.vx * dt; Bl.y += Bl.vy * dt; Bl.z += Bl.vz * dt;
          if (Bl.y < FOOT.r) { Bl.y = FOOT.r; if (Bl.vy < -0.8) { Bl.vy = -Bl.vy * 0.5; C.sfx('bounce'); } else Bl.vy = 0; Bl.vx *= 0.985; Bl.vz *= 0.985; }
          // линия ворот: исход «играем»
          if (!Bl.crossed && Bl.z >= GZ - 0.25 && S.phase === 'flight') {
            Bl.crossed = true; const o2 = S.outcome;
            if (o2 === 'save') {
              if (Kp.save === 'catch') { Bl.held = true; Bl.vx = Bl.vy = Bl.vz = 0; }
              else { Bl.vz = -Math.abs(Bl.vz) * 0.3; Bl.vx = (Bl.x >= 0 ? 1 : -1) * 3.2; Bl.vy = 2.4; }
              result('save');
            } else if (o2 === 'post') { Bl.vz = -Math.abs(Bl.vz) * 0.45; Bl.vx *= -0.4; Bl.vy = Math.abs(Bl.vy) * 0.3 + 1; result('post'); }
            else if (o2 === 'goal') { Bl.inNet = true; result('goal'); }
            else result(o2);
          }
          if (Bl.inNet && Bl.z > GZ + GD * 0.75) { Bl.z = GZ + GD * 0.75; Bl.vz = -Math.abs(Bl.vz) * 0.12; Bl.vx *= 0.3; }
          if (!Bl.inNet && Bl.z > GZ + 2.5) { Bl.z = GZ + 2.5; Bl.vz = 0; Bl.vx *= 0.5; }
        }
      }
      if (S.phase === 'flight' && S.t > 2.4 && !Bl.crossed) { Bl.crossed = true; result(S.outcome || 'wide'); }
      if (S.phase === 'result' && S.t > 1.9) { if (S.res.length >= FOOT.KICKS) over(); else next(false); }
      // вратарь: покачивается, прыгает, встаёт
      const kst = bear.st;
      if (Kp.diveT >= 0 && S.phase !== 'aim' && S.phase !== 'pass') {
        Kp.diveT -= dt;
        if (Kp.diveT < 0 && Kp.dive === 0) Kp.dive = 0.0001;
      }
      if (Kp.dive > 0) {
        Kp.dive = Math.min(1, Kp.dive + dt / 0.42);
        const u = easeOut(Kp.dive), side = Math.sign(Kp.diveX) || 1, reach = Math.abs(Kp.diveX);
        Kp.x = Kp.diveX * u * (Kp.save === 'catch' && reach < 0.75 ? 0.8 : 0.82);
        Kp.y = Math.sin(Math.min(1, Kp.dive) * PI) * (0.25 + Kp.diveY * 0.35);
        kst.roll = -side * u * (reach > 0.5 ? 1.25 : 0.4);
        kst.armL = [-2.6 * u, 0, 0.3]; kst.armR = [-2.6 * u, 0, -0.3];
        if (S.phase === 'result' && S.t > 1.0) { Kp.back = Math.min(1, Kp.back + dt / 0.5); }
      } else {
        Kp.x = damp(Kp.x, Math.sin(C.t * 2.2) * 0.25, 4, dt); Kp.y = Math.abs(Math.sin(C.t * 4.4)) * 0.04;
        kst.roll = damp(kst.roll, 0, 8, dt); kst.armL = [-0.3, 0, 0.75]; kst.armR = [-0.3, 0, -0.75];
      }
      if (Kp.back > 0) { kst.roll *= 1 - Kp.back; Kp.y *= 1 - Kp.back; }
      if (Bl.held) { Bl.x = Kp.x; Bl.y = Math.max(FOOT.r, 0.55 + Kp.y); Bl.z = Kp.z + 0.32; }
      kst.spd = 0; kst.look = clamp(Math.atan2(Bl.x - Kp.x, -(Bl.z - Kp.z)) * -1, -0.6, 0.6);
      kst.hop = Kp.dive > 0 ? 0 : (S.phase === 'result' && S.outcome !== 'goal' ? Math.abs(Math.sin(S.t * 8)) * 0.08 : 0);
    }
    function pose(dt) {
      // удар ногой: правое бедро назад → вперёд, голень сгибается и выстреливает, руки в стороны, корпус чуть назад
      const AB = C.anim && C.anim.bones;
      if (AB && kick.on) {
        const t = C.t - kick.t0, tc = kick.tc - kick.t0, wind = Math.max(0.05, tc - 0.09);
        let th, sh, k;
        if (t < wind) { const u = sst(0, wind, t); th = 0.6 * u; sh = 1.35 * u; k = u; }
        else if (t < tc) { const u = (t - wind) / Math.max(0.01, tc - wind); th = lerp(0.6, -0.95, u); sh = lerp(1.35, 0.25, u); k = 1; }
        else { const u = clamp((t - tc) / 0.42, 0, 1); th = lerp(-0.95, 0, sst(0, 1, u)); sh = lerp(0.25, 0, u); k = 1 - sst(0.5, 1, u); if (u >= 1) kick.on = false; }
        AB.thigh_R.rotation.x += th; AB.shin_R.rotation.x += sh; AB.foot_R.rotation.x += -0.35 * k;
        if (AB.coat_R) AB.coat_R.rotation.x += th * 0.45;
        AB.upperarm_L.rotation.z += 0.75 * k; AB.upperarm_R.rotation.z -= 0.6 * k; AB.forearm_L.rotation.x -= 0.3 * k; AB.forearm_R.rotation.x -= 0.3 * k;
        AB.spine.rotation.x -= 0.1 * k; AB.head.rotation.x += 0.25 * k; AB.thigh_L.rotation.x -= 0.1 * k; AB.shin_L.rotation.x += 0.18 * k;
      } else if (AB && (S.phase === 'aim' || S.phase === 'pass')) { AB.head.rotation.x += 0.12; }
      // вратарь, зайка, мяч, метка
      F.toW(Kp.x, Kp.y, Kp.z, v3); bear.root.position.copy(v3); bear.root.rotation.set(0, F.yaw(PI), 0);
      animalPose(bear, dt, C.t);
      if (bunny.root.visible) {
        F.toW(Bn.x, 0, Bn.z, v3); bunny.root.position.copy(v3); bunny.root.rotation.y = F.yaw(Math.atan2(CONT.x - Bn.x, CONT.z - Bn.z));
        const bs = bunny.st; bs.spd = 0;
        if (bunny.kickT !== undefined && bunny.kickT >= 0) { bunny.kickT += dt; const u = clamp(bunny.kickT / 0.45, 0, 1); bunny.B.footR && (bs.lean = -0.15 * Math.sin(u * PI)); bs.hop = Math.sin(u * PI) * 0.06; if (u >= 1) bunny.kickT = -1; }
        bs.armL = [-0.2, 0, 0.5 + (S.phase === 'result' && S.outcome === 'goal' ? 1.8 : 0)]; bs.armR = [-0.2, 0, -0.5 - (S.phase === 'result' && S.outcome === 'goal' ? 1.8 : 0)];
        bs.hop = Math.max(bs.hop, S.phase === 'result' && S.outcome === 'goal' ? Math.abs(Math.sin(S.t * 9)) * 0.12 : 0);
        animalPose(bunny, dt, C.t);
      }
      F.toW(Bl.x, Bl.y, Bl.z, v3); ball.position.copy(v3); ball.rotation.x += Bl.spin * dt * (Bl.live && !Bl.held ? 1 : 0) + (S.phase === 'pass' ? Bl.vz * dt / FOOT.r : 0); ball.rotation.z -= (S.phase === 'pass' ? Bl.vx * dt / FOOT.r : 0);
      F.toW(Bl.x, 0.058, Bl.z, v3); blob.position.copy(v3); const hb = clamp((Bl.y - FOOT.r) / 2.5, 0, 1); blob.scale.setScalar(FOOT.r * 1.1 * (1 - hb * 0.5)); blob.material.opacity = 0.26 * (1 - hb * 0.6);
      // метка в воротах (качается; при свайпе — куда целишься)
      const showMark = S.phase === 'aim' || S.phase === 'pass' || (S.phase === 'run');
      marks.visible = showMark || (kick.on && S.variant === 'pass');
      if (marks.visible) {
        const mx = S.swipe ? S.aimX : S.phase === 'run' ? S.aimX : markX(), my = S.swipe ? S.aimY : S.phase === 'run' ? S.aimY : markY();
        F.toW(mx, my, GZ - 0.05, v3); dummy.position.copy(v3); dummy.rotation.set(PI / 2, F.yaw(0), 0, 'YXZ'); dummy.scale.setScalar(0.32 + 0.03 * Math.sin(C.t * 8)); dummy.updateMatrix(); marks.setMatrixAt(0, dummy.matrix);
        marks.setColorAt(0, col.set(S.swipe || S.phase === 'run' ? '#FFD34D' : '#FFFFFF'));
        const showT = S.variant === 'pass' && S.phase === 'pass' && Bl.live;
        if (showT) {
          const ideal = S.arrive - FOOT.CONTACT, dtt = ideal - C.t, r1 = dtt > 0 ? 0.45 + Math.min(1.5, dtt * 1.4) : Math.max(0.12, 0.45 + dtt * 1.2);
          F.toW(CONT.x - 0.12, 0.065, CONT.z + 0.38, v3); dummy.position.copy(v3); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.45); dummy.updateMatrix(); marks.setMatrixAt(1, dummy.matrix);
          dummy.scale.setScalar(r1); dummy.updateMatrix(); marks.setMatrixAt(2, dummy.matrix);
          marks.setColorAt(1, col.set('#FFFFFF')); marks.setColorAt(2, col.set(Math.abs(dtt) < 0.27 ? '#7FD67F' : '#FFD34D'));
        } else { dummy.scale.setScalar(0.0001); dummy.updateMatrix(); marks.setMatrixAt(1, dummy.matrix); marks.setMatrixAt(2, dummy.matrix); }
        marks.instanceMatrix.needsUpdate = true; if (marks.instanceColor) marks.instanceColor.needsUpdate = true;
      }
      C.ui.main.classList.toggle('soft', !(S.phase === 'aim' || (S.phase === 'pass' && Bl.live)));
    }
    const camP = new T.Vector3(), camL = new T.Vector3();
    function camera(ct) {
      const follow = S.phase === 'flight' || S.phase === 'result' ? 0.25 : 0;
      F.toW(0.2 + Bl.x * follow * 0.3, 4.0, SPOT - 5.6, camP); F.toW(-0.1 + Bl.x * follow * 0.4, 0.2, GZ, camL);
      ct.pos.copy(camP); ct.look.copy(camL); ct.fov = C.fitFov(30, 44);
    }
    // свайп: след пальца и живой прицел
    const trail = C.ui.swipe;
    function down(x, y) { if (S.variant === 'pass') { main(); return; } if (S.phase !== 'aim') return; S.swipe = { x, y }; trail.style.display = 'block'; trail.style.left = x + 'px'; trail.style.top = (y - 5) + 'px'; trail.style.width = '0px'; }
    function move(dx, dy) {
      if (!S.swipe) return;
      const len = Math.hypot(dx, dy); trail.style.width = len + 'px'; trail.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
      if (len > 30 && dy < -10) aimFromSwipe(dx, dy);
    }
    function up(dx, dy, sec, cancel) { if (!S.swipe) return; S.swipe = null; trail.style.display = 'none'; if (!cancel) swipeKick(dx, dy, sec); }
    return {
      reset, step: stepGame, pose, camera, main, down, move, up,
      side: () => { if (C.ended) return; S.variant = S.variant === 'pass' ? 'penalty' : 'pass'; C.curtain(() => { reset(); C.camT.snap = true; }, null); },
      key: s => { if (S.phase === 'aim') { S.aimX = clamp(S.aimX + s * 0.5, -1.4, 1.4); } },
      animState: () => null,
      result: () => S.last,
      state: () => ({ phase: S.phase, variant: S.variant, kick: S.res.length, goals: S.goals, res: S.res.slice(), outcome: S.outcome, aim: [+S.aimX.toFixed(2), +S.aimY.toFixed(2)], keeper: { x: +Kp.x.toFixed(2), dive: +Kp.dive.toFixed(2), save: Kp.save }, ball: { x: +Bl.x.toFixed(2), y: +Bl.y.toFixed(2), z: +Bl.z.toFixed(2), held: Bl.held, inNet: Bl.inNet } }),
      debug: { tap: () => main(), swipe: (dx, dy, sec) => swipeKick(dx, dy, sec || 0.25), auto: m => { S.auto = m || null; return S.auto; }, variant: v => { S.variant = v === 'pass' ? 'pass' : 'penalty'; reset(); return S.variant; },
        aimAt: (x, y, p) => { if (S.phase !== 'aim') return false; S.aimX = x; S.aimY = y; S.power = p === undefined ? 0.6 : p; S.q = 'good'; return startKick(); },
        screen: () => { const w = C.ui.score.parentNode.clientWidth || 390, h = C.ui.score.parentNode.clientHeight || 844, pr = (x, y, z) => { F.toW(x, y, z, gp); gp.project(C.cam); return [+((gp.x * 0.5 + 0.5) * w).toFixed(1), +((-gp.y * 0.5 + 0.5) * h).toFixed(1)]; }; return { ball: pr(Bl.x, FOOT.r, Bl.z), aim: pr(S.aimX, S.aimY, GZ), goalL: pr(GW / 2, GH * 0.5, GZ), goalR: pr(-GW / 2, GH * 0.5, GZ), goalC: pr(0, GH * 0.5, GZ) }; } },
      dispose() { timers.length = 0; trail.style.display = 'none'; },
    };
  }

  /* =====================================================================
     8. МИНИ-ГОЛЬФ: три лунки на грине (пар 2–3–2), потянуть назад и отпустить (линия прицела = сила), мяч катится с
        трением и отскакивает от бортиков и препятствий, песок тормозит; «С одного удара!» — конфетти. «↺ Заново» — в любой момент.
        Чем отличается от старого гольфа отеля (тот играется один раз): игра не держит своё «использовано», героиня в конце
        возвращается к коврику-старту (место снова рядом), мяч каждый раз на стартовом коврике, ударов не 3 на всё — до 6 на лунку.
     ===================================================================== */
  const GOLF = { DT: 1 / 120, FRIC: 0.92, SAND: 3.4, REST: 0.55, OBST: 0.6, HR: 0.11, CAP: 1.85, MAXS: 6, r: 0.06, CONTACT: 0.34 };
  function golfGame(C) {
    const { T, K, F, R } = C;
    const c = C.court, RX = (c.w || 19) / 2, RZ = (c.d || 14) / 2, RIM = c.rim || 1.06;
    const toL = (p, out) => F.toL(p[0], p[1], out);
    const tmpL = { x: 0, z: 0 };
    const L2 = p => { toL(p, tmpL); return [tmpL.x, tmpL.z]; };
    const TEES = (c.tees || [[-5.4, 4.4], [-1.4, 0], [4.4, -0.6]].map(q => [q[0] + c.x, q[1] + c.z])).map(L2);
    const HOLES = (c.holes || [[2.4, -2.4], [6.5, 2.8], [-2.8, -4.6]].map(q => [q[0] + c.x, q[1] + c.z])).map(L2);
    const PAR = c.par || [2, 3, 2];
    const bunker = c.bunker ? (() => { toL([c.bunker.x, c.bunker.z], tmpL); return { x: tmpL.x, z: tmpL.z, rx: c.bunker.rx, rz: c.bunker.rz }; })() : null;
    // препятствия (локальные оси грина): бревно на 2-й лунке, воротца на 3-й
    const mid = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    const m2 = mid(TEES[1], HOLES[1], 0.5), a2 = Math.atan2(HOLES[1][0] - TEES[1][0], HOLES[1][1] - TEES[1][1]);
    const m3 = mid(TEES[2], HOLES[2], 0.55), a3 = Math.atan2(HOLES[2][0] - TEES[2][0], HOLES[2][1] - TEES[2][1]);
    const OB = [
      { type: 'box', x: m2[0], z: m2[1], hw: 0.75, hd: 0.11, a: a2 },   // бревно поперёк пути: обойти или от борта
      { type: 'circ', x: m3[0] + Math.cos(a3) * 0.5, z: m3[1] - Math.sin(a3) * 0.5, r: 0.07 }, { type: 'circ', x: m3[0] - Math.cos(a3) * 0.5, z: m3[1] + Math.sin(a3) * 0.5, r: 0.07 },
    ];
    // сетки: мяч, тень, паттер, точки прицела, препятствия, метка лунки
    const ball = makeBall(K, 'golf'); C.add(ball);
    const blob = makeBlob(T, C.bag); C.add(blob);
    const putter = makePutter(K); C.add(putter);
    const dots = makeDots(T, C.bag, 16); C.add(dots);
    const obst = (() => {
      const { G, part: P } = K, L = [];
      const o0 = OB[0], ry0 = o0.a;
      L.push(P(G.cyl, '#B98A5E', [0, 0.11, 0], [0, 0, PI / 2], [0.11, o0.hw * 2, 0.11]));
      L.push(P(G.cyl, '#E8C9A0', [o0.hw, 0.11, 0], [0, 0, PI / 2], [0.09, 0.012, 0.09], { ol: 0 })); L.push(P(G.cyl, '#E8C9A0', [-o0.hw, 0.11, 0], [0, 0, PI / 2], [0.09, 0.012, 0.09], { ol: 0 }));
      const g0 = K.merge(L, { ol: 0.012 }); g0.applyMatrix4(new T.Matrix4().makeRotationY(ry0)); g0.translate(o0.x, 0, o0.z);
      const L3 = [], ry3 = a3, arch = C.bag(new T.TorusGeometry(0.5, 0.04, 6, 18, PI));
      [-0.5, 0.5].forEach(s => { L3.push(P(G.cyl, '#F6F6F2', [s, 0.18, 0], 0, [0.05, 0.36, 0.05])); L3.push(P(G.sph, '#D9455A', [s, 0.38, 0], 0, 0.065)); });
      L3.push(P(arch, '#D9455A', [0, 0.38, 0], 0, 1));
      const g3 = K.merge(L3, { ol: 0.01 });
      g3.applyMatrix4(new T.Matrix4().makeRotationY(ry3)); g3.translate(m3[0], 0, m3[1]);
      // склеиваем две сетки в одну (в локальных осях грина) и ставим в мир
      const g = mergeGeos(T, [g0, g3]); C.bag(g); g0.dispose(); g3.dispose();
      const m = new T.Mesh(g, K.mat); m.castShadow = true; m.name = 'sports:obstacles';
      F.toW(0, 0, 0, m.position); m.rotation.y = F.yaw(0); return m;
    })();
    C.add(obst);
    const marker = (() => {
      const { G, part: P } = K;
      const m = K.mesh([P(G.tor, '#FFD34D', [0, 0.02, 0], [PI / 2, 0, 0], [0.26, 0.26, 0.3], { ol: 0 }), P(G.cone, '#FFD34D', [0, 1.95, 0], [PI, 0, 0], [0.12, 0.24, 0.12]), P(G.cyl, '#FFD34D', [0, 2.15, 0], 0, [0.045, 0.2, 0.045])], { ol: 0.012 });
      m.name = 'sports:holeMarker'; return m;
    })();
    C.add(marker);

    const Bb = { x: 0, z: 0, vx: 0, vz: 0, rolling: false, holed: false, sand: false, y: 0 };
    const S = { phase: 'intro', hole: 0, strokes: [0, 0, 0], total: 0, aces: 0, aimA: 0, power: 0, drag: null, auto: null, t: 0, putt: null, last: null, walkT: 0, camDir: 0, sandSaid: false };
    const putt = { on: false, t0: 0, a: 0, p: 0, launched: false };
    const v3 = new T.Vector3(), v3b = new T.Vector3(), qH = new T.Quaternion(), pole = new T.Vector3(), grip = new T.Vector3(), lat = new T.Vector3(), fwd = new T.Vector3(), dn = new T.Vector3(), up = new T.Vector3(0, 1, 0), m4 = new T.Matrix4(), xb = new T.Vector3(), zb = new T.Vector3();
    const dummy = new T.Object3D(), col = new T.Color(), wv = new T.Vector3();
    const timers = []; const later = (sec, fn) => timers.push({ t: C.t + sec, fn });

    function ballStep(st, h) {
      const sp = Math.hypot(st.vx, st.vz);
      const inSand = bunker && ((st.x - bunker.x) / bunker.rx) ** 2 + ((st.z - bunker.z) / bunker.rz) ** 2 < 1;
      const fr = (inSand ? GOLF.SAND : GOLF.FRIC) * h;
      if (sp > 1e-5) { const k = Math.max(0, sp - fr) / sp; st.vx *= k; st.vz *= k; }
      st.sand = inSand;
      // лунка: медленный мячик притягивается (мягко прощаем «почти»)
      const hx = HOLES[S.hole][0], hz = HOLES[S.hole][1], dxh = hx - st.x, dzh = hz - st.z, dh = Math.hypot(dxh, dzh);
      if (dh < 0.34 && sp < 1.0 && dh > 1e-4) { st.vx += dxh / dh * 1.7 * h; st.vz += dzh / dh * 1.7 * h; }
      st.x += st.vx * h; st.z += st.vz * h;
      let ev = 0;
      if (dh < GOLF.HR) { if (sp < GOLF.CAP) return 'holed'; st.vx *= 0.97; st.vz *= 0.97; }
      // бортик-эллипс
      const ex = st.x / (RX * RIM), ez = st.z / (RZ * RIM), er = Math.hypot(ex, ez);
      if (er > 1) {
        const nx = ex / er / (RX * RIM), nz = ez / er / (RZ * RIM), nl = Math.hypot(nx, nz), ux = nx / nl, uz = nz / nl, dot = st.vx * ux + st.vz * uz;
        if (dot > 0) { st.vx -= (1 + GOLF.REST) * dot * ux; st.vz -= (1 + GOLF.REST) * dot * uz; ev = 'bump'; }
        st.x = ex / er * RX * RIM * 0.999; st.z = ez / er * RZ * RIM * 0.999;
      }
      // препятствия
      for (let i = 0; i < OB.length; i++) {
        const o2 = OB[i];
        if (o2.type === 'circ') {
          const dx = st.x - o2.x, dz = st.z - o2.z, d = Math.hypot(dx, dz), rr = o2.r + GOLF.r;
          if (d < rr && d > 1e-5) { const ux = dx / d, uz = dz / d, dot = st.vx * ux + st.vz * uz; st.x = o2.x + ux * rr; st.z = o2.z + uz * rr; if (dot < 0) { st.vx -= (1 + GOLF.OBST) * dot * ux; st.vz -= (1 + GOLF.OBST) * dot * uz; ev = 'bump'; } }
        } else {
          // в осях бревна: x' — вдоль бревна (поперёк пути), z' — вдоль пути
          const ca = Math.cos(o2.a), sa = Math.sin(o2.a), dx = st.x - o2.x, dz = st.z - o2.z;
          const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
          const cx = clamp(lx, -o2.hw, o2.hw), cz = clamp(lz, -o2.hd, o2.hd), qx = lx - cx, qz = lz - cz, d = Math.hypot(qx, qz);
          if (d < GOLF.r) {
            let ux, uz; if (d > 1e-5) { ux = qx / d; uz = qz / d; } else { ux = 0; uz = lz >= 0 ? 1 : -1; }
            const nlx = cx + ux * GOLF.r, nlz = cz + uz * GOLF.r;
            st.x = o2.x + nlx * ca + nlz * sa; st.z = o2.z - nlx * sa + nlz * ca;
            const wx = ux * ca + uz * sa, wz = -ux * sa + uz * ca, dot = st.vx * wx + st.vz * wz;
            if (dot < 0) { st.vx -= (1 + GOLF.OBST) * dot * wx; st.vz -= (1 + GOLF.OBST) * dot * wz; ev = 'bump'; }
          }
        }
      }
      if (Math.hypot(st.vx, st.vz) < 0.035) { st.vx = st.vz = 0; return 'stop'; }
      return ev;
    }
    const v0Of = p => 0.5 + clamp(p, 0, 1) * 5.2;
    const simSt = { x: 0, z: 0, vx: 0, vz: 0, sand: false };
    function simulate(a, p) {
      simSt.x = Bb.x; simSt.z = Bb.z; const v0 = v0Of(p); simSt.vx = Math.sin(a) * v0; simSt.vz = Math.cos(a) * v0;
      for (let i = 0; i < 120 * 14; i++) { const r = ballStep(simSt, GOLF.DT); if (r === 'holed') return { holed: true, d: 0 }; if (r === 'stop') break; }
      return { holed: false, d: Math.hypot(simSt.x - HOLES[S.hole][0], simSt.z - HOLES[S.hole][1]), x: simSt.x, z: simSt.z };
    }
    const holeDir = () => Math.atan2(HOLES[S.hole][0] - Bb.x, HOLES[S.hole][1] - Bb.z);
    // стойка: боком к линии удара, мяч перед носками (цель — слева от героини)
    function stance(a) { C.heroPlace(Bb.x + Math.cos(a) * 0.52, Bb.z - Math.sin(a) * 0.52, a - PI / 2); }

    function reset() { S.hole = 0; S.strokes = [0, 0, 0]; S.total = 0; S.aces = 0; timers.length = 0; S.sandSaid = false; startHole(true); C.line(LINES.golfStart, null, 3.2); C.hint('Потяни и отпусти: длиннее линия — сильнее удар', 5.5); C.mainBtn('', '', false); C.sideBtn('↺ Заново', true); }
    function startHole(first) {
      Bb.x = TEES[S.hole][0]; Bb.z = TEES[S.hole][1]; Bb.vx = Bb.vz = 0; Bb.rolling = false; Bb.holed = false; Bb.y = 0;
      S.phase = 'aim'; S.t = 0; S.aimA = holeDir(); S.power = 0; S.drag = null; S.camDir = holeDir(); putt.on = false;
      stance(S.aimA); C.H.yOverride = C.F.y; score();
      if (first) C.camT.snap = true;
    }
    function score() {
      const s = S.strokes[S.hole];
      C.setScore('Лунка ' + (S.hole + 1) + ' из 3 · пар ' + PAR[S.hole] + '<small>ударов: ' + s + (S.hole > 0 ? ' · всего ' + (S.total + (S.phase === 'holed' ? 0 : s)) : '') + '</small>');
    }
    // прицел из «рогатки»: тянем назад по экрану → бьём вперёд по земле
    const cf = new T.Vector3();
    function aimFromDrag(dx, dy) {
      const len = Math.hypot(dx, dy);
      C.cam.getWorldDirection(cf); const fl = Math.hypot(cf.x, cf.z) || 1, fx = cf.x / fl, fz = cf.z / fl, rx = -fz, rz = fx;
      const wx = -(rx * dx + fx * -dy), wz = -(rz * dx + fz * -dy);
      // мир → локальные оси грина
      const lx = wx * F.cs - wz * F.sn, lz = wx * F.sn + wz * F.cs;
      if (len > 6) S.aimA = Math.atan2(lx, lz);
      const w = C.ui.score.parentNode.clientWidth || 390, h = C.ui.score.parentNode.clientHeight || 844;
      S.power = clamp((len - 10) / (Math.min(w, h) * 0.42), 0, 1);
    }
    function doPutt(a, p) {
      if (S.phase !== 'aim' || C.ended || p < 0.04) return false;
      S.aimA = a; S.power = p; S.phase = 'putt'; putt.on = true; putt.t0 = C.t; putt.a = a; putt.p = p; putt.launched = false;
      stance(a); S.strokes[S.hole]++; score();
      if (S.strokes[S.hole] === 1 && S.hole === 0) C.heroSay(SAY.putt, 1.0);
      return true;
    }
    function launch() {
      const v0 = v0Of(putt.p); Bb.vx = Math.sin(putt.a) * v0; Bb.vz = Math.cos(putt.a) * v0; Bb.rolling = true; S.phase = 'roll'; S.t = 0; S.acc = 0;
      C.sfx('putt'); C.haptic('light');
    }
    function holed() {
      Bb.rolling = false; Bb.holed = true; Bb.vx = Bb.vz = 0; Bb.x = HOLES[S.hole][0]; Bb.z = HOLES[S.hole][1]; Bb.y = -0.07;
      const n = S.strokes[S.hole]; S.total += n; S.phase = 'holed'; S.t = 0;
      if (n === 1) { S.aces++; C.flash('С одного удара!'); C.line(LINES.golfAce, null, 2.8); C.heroSay(SAY.ace, 1.8); C.confetti.burst(...wpos(Bb.x, 0.3, Bb.z), R); C.H.celebrate = true; C.sfx('cheer'); C.haptic('success'); }
      else { C.flash(n <= PAR[S.hole] ? 'В лунке!' : 'Есть!'); C.line(LINES.golfHoled, null, 2.2); C.heroSay(SAY.holed, 1.3); if (n <= PAR[S.hole]) C.H.celebrate = true; C.sfx('holed'); C.haptic('success'); }
      score();
      later(1.8, () => { if (S.hole < 2) C.curtain(() => { S.hole++; startHole(true); }, null); else over(); });
    }
    function wpos(lx, ly, lz) { F.toW(lx, ly, lz, wv); return [wv.x, wv.y, wv.z]; }
    function over() {
      S.phase = 'over';
      const par = PAR[0] + PAR[1] + PAR[2], res = { total: S.total, par, strokes: S.strokes.slice(), aces: S.aces };
      const b = BEST.golf; if (!b || res.total < b.total) BEST.golf = { total: res.total, par };
      S.last = res;
      C.line(LINES.golfEnd, null, 2.8);
      const d = res.total - par, title = d <= 0 ? 'Чемпионка мини-гольфа! ⛳' : d <= 2 ? 'Отличная игра!' : 'Все лунки пройдены!';
      C.showEnd({ title, text: 'Три лунки — <b>' + res.total + ' ' + plural(res.total, 'удар', 'удара', 'ударов') + '</b> (пар ' + par + ')' + (res.aces ? ' · с одного удара: ' + res.aces : ''), best: 'Лучшее за сегодня: ' + BEST.golf.total + ' ' + plural(BEST.golf.total, 'удар', 'удара', 'ударов'), result: res });
    }
    function stepGame(dt) {
      for (let i = timers.length - 1; i >= 0; i--) if (C.t >= timers[i].t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      S.t += dt;
      if (S.auto && S.phase === 'aim' && S.t > 0.5) { const sh = bestShot(S.auto); doPutt(sh.a, sh.p); }
      if (putt.on && !putt.launched && C.t - putt.t0 >= GOLF.CONTACT) { putt.launched = true; launch(); }
      if (putt.on && C.t - putt.t0 > 1.1) putt.on = false;
      if (S.phase === 'roll') {
        S.acc += dt; let n = 0;
        while (S.acc >= GOLF.DT && n++ < 40) {
          S.acc -= GOLF.DT; const r = ballStep(Bb, GOLF.DT);
          if (r === 'holed') { holed(); break; }
          if (r === 'bump') C.sfx('bump');
          if (Bb.sand && !S.sandSaid) { S.sandSaid = true; C.line(LINES.golfSand, null, 2); C.heroSay(SAY.sand, 1.2); }
          if (r === 'stop') { Bb.rolling = false; afterStop(); break; }
        }
        if (S.t > 14 && Bb.rolling) { Bb.vx = Bb.vz = 0; Bb.rolling = false; afterStop(); }
      }
      if (S.phase === 'walk') {
        S.walkT += dt; const a = holeDir(), tx = Bb.x + Math.cos(a) * 0.52, tz = Bb.z - Math.sin(a) * 0.52;
        const d = C.heroMove(tx, tz, 2.2, a - PI / 2, dt);
        if ((d < 0.04 && Math.abs(angW(C.H.yaw - (a - PI / 2))) < 0.08) || S.walkT > 3) { stance(a); S.phase = 'aim'; S.t = 0; S.aimA = a; S.camDir = a; S.power = 0; }
      } else if (S.phase === 'aim' || S.phase === 'putt') C.heroMove(C.H.x, C.H.z, 0, C.H.yaw, dt);
    }
    function afterStop() {
      if (S.strokes[S.hole] >= GOLF.MAXS) {
        // шестой удар мимо — мячик «докатывается» сам (без проигрыша и без счёта сверх шести)
        C.hint('Шесть ударов — енот закатил мячик в лунку', 2.2);
        S.phase = 'holedAssist'; S.t = 0; later(0.6, () => holed());
        return;
      }
      S.phase = 'walk'; S.walkT = 0; C.H.yOverride = C.F.y; S.camDir = holeDir();   // камера поворачивается, пока героиня идёт к мячу
    }
    function bestShot(mode) {
      const base = holeDir(); let best = null;
      for (let i = -12; i <= 12; i++) for (let j = 1; j <= 20; j++) {
        const a = base + i * 0.025, p = j / 20, r = simulate(a, p);
        const sc = r.holed ? -1 + p * 0.1 : r.d;
        if (!best || sc < best.sc) best = { a, p, sc, holed: r.holed };
      }
      if (mode === 'weak') { best.a += (R() - 0.5) * 0.25; best.p = clamp(best.p * lerp(0.6, 1.25, R()), 0.08, 1); }
      return best;
    }
    function pose(dt) {
      const AB = C.anim && C.anim.bones, hr = C.heroRoot;
      // маятник паттера: замах (−) → удар (0 — у мяча) → проводка (+)
      let swing = 0;
      if (putt.on) {
        const t = C.t - putt.t0, back = -0.1 - putt.p * 0.5;
        swing = t < 0.22 ? lerp(0, back, sst(0, 0.22, t)) : t < GOLF.CONTACT ? lerp(back, 0, (t - 0.22) / (GOLF.CONTACT - 0.22)) : lerp(0, 0.12 + putt.p * 0.3, sst(GOLF.CONTACT, GOLF.CONTACT + 0.25, t)) * (1 - sst(0.75, 1.1, t));
      } else if (S.phase === 'aim' && S.drag) swing = -0.08 - S.power * 0.45;
      const stanceOn = S.phase === 'aim' || S.phase === 'putt' || S.phase === 'roll' || S.phase === 'holed';
      putter.visible = !C.iaBusy();
      if (AB && hr && stanceOn && !C.iaBusy()) {
        AB.spine.rotation.x += 0.34; AB.neck.rotation.x += 0.16; AB.head.rotation.x += 0.3; AB.thigh_L.rotation.x -= 0.08; AB.thigh_R.rotation.x -= 0.08; AB.shin_L.rotation.x += 0.14; AB.shin_R.rotation.x += 0.14;
        hr.updateMatrixWorld(true);
        hr.getWorldQuaternion(qH); lat.set(1, 0, 0).applyQuaternion(qH); fwd.set(0, 0, 1).applyQuaternion(qH);
        AB.upperarm_L.getWorldPosition(v3); AB.upperarm_R.getWorldPosition(v3b); v3.add(v3b).multiplyScalar(0.5);
        const Lp = 0.56;
        grip.copy(v3).addScaledVector(up, -Lp * Math.cos(swing)).addScaledVector(lat, Lp * Math.sin(swing)).addScaledVector(fwd, 0.2);
        pole.copy(lat).multiplyScalar(0.6).addScaledVector(fwd, -0.4);
        v3b.copy(grip).addScaledVector(up, 0.045); C.IK.arm(AB, 'L', v3b, pole, 1, 0.06, 0.2);
        pole.copy(lat).multiplyScalar(-0.6).addScaledVector(fwd, -0.4);
        v3b.copy(grip).addScaledVector(up, -0.05); C.IK.arm(AB, 'R', v3b, pole, 1, 0.06, 0.2);
        // паттер: от рукояти к мячу, качается в плоскости удара
        F.toW(Bb.x, 0.03, Bb.z, v3); v3.addScaledVector(lat, -0.075);
        const Lh = v3.distanceTo(grip);
        dn.copy(v3).sub(grip).normalize(); dn.applyAxisAngle(fwd, -swing * 0.95);
        // ось паттера: +y модели — вверх по стержню; голова — у мяча, стержень идёт через кисти
        zb.copy(fwd).addScaledVector(dn, -fwd.dot(dn)).normalize(); v3b.copy(dn).negate(); xb.crossVectors(v3b, zb).normalize();
        m4.makeBasis(xb, v3b, zb); putter.quaternion.setFromRotationMatrix(m4);
        putter.position.copy(grip).addScaledVector(dn, Lh - 0.875);
        putter.visible = true;
      } else if (hr && AB) {
        // идёт к мячу: паттер в правой руке, головкой вниз
        hr.updateMatrixWorld(true); AB.hand_R.getWorldPosition(v3); hr.getWorldQuaternion(qH);
        putter.position.copy(v3).add(v3b.set(0, 0.1, 0)); putter.quaternion.copy(qH); putter.rotateX(0.5);
      }
      // мяч, тень, точки прицела, метка лунки
      F.toW(Bb.x, GOLF.r + Bb.y, Bb.z, v3); ball.position.copy(v3); ball.rotation.x += Bb.vz * dt / GOLF.r; ball.rotation.z -= Bb.vx * dt / GOLF.r;
      F.toW(Bb.x, 0.006, Bb.z, v3); blob.position.copy(v3); blob.scale.setScalar(0.07); blob.visible = !Bb.holed;
      const showAim = S.phase === 'aim' && (S.drag || S.auto) && S.power > 0.01;
      dots.visible = showAim;
      if (showAim) {
        const n = 3 + Math.round(S.power * 13);
        for (let i = 0; i < 16; i++) {
          const on = i < n, d = 0.2 + i * 0.22;
          F.toW(Bb.x + Math.sin(S.aimA) * d, 0.012, Bb.z + Math.cos(S.aimA) * d, v3);
          dummy.position.copy(v3); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(on ? (i === n - 1 ? 0.095 : 0.055) : 0.0001); dummy.updateMatrix(); dots.setMatrixAt(i, dummy.matrix);
          col.setRGB(1, lerp(0.95, 0.55, i / 15), lerp(0.75, 0.25, i / 15)); dots.setColorAt(i, col);
        }
        dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
      }
      F.toW(HOLES[S.hole][0], Math.abs(Math.sin(C.t * 2.4)) * 0.06, HOLES[S.hole][1], v3); marker.position.copy(v3); marker.rotation.y = C.t * 1.2;
      marker.visible = S.phase !== 'over';
    }
    const camP = new T.Vector3(), camL = new T.Vector3();
    function camera(ct) {
      const a = S.camDir, d = Math.hypot(HOLES[S.hole][0] - Bb.x, HOLES[S.hole][1] - Bb.z);
      const bx = S.phase === 'roll' || S.phase === 'walk' ? lerp(Bb.x, C.H.x, 0.3) : Bb.x, bz = S.phase === 'roll' || S.phase === 'walk' ? lerp(Bb.z, C.H.z, 0.3) : Bb.z;
      const sx = -Math.cos(a) * 0.3, sz = Math.sin(a) * 0.3;   // чуть в сторону от героини: линия прицела не прячется за ней
      F.toW(bx - Math.sin(a) * 3.5 + sx, 3.0, bz - Math.cos(a) * 3.5 + sz, camP);
      const k = Math.min(d * 0.5, 3.6);
      F.toW(bx + Math.sin(a) * k + sx * 0.4, 0, bz + Math.cos(a) * k + sz * 0.4, camL);
      if (S.phase === 'roll') { F.toW(lerp(Bb.x + Math.sin(a) * 1.2, HOLES[S.hole][0], 0.3), 0, lerp(Bb.z + Math.cos(a) * 1.2, HOLES[S.hole][1], 0.3), camL); }
      ct.pos.copy(camP); ct.look.copy(camL); ct.fov = C.fitFov(44, 48); ct.k = 4.2;
    }
    return {
      reset, step: stepGame, pose, camera,
      down: () => { if (S.phase === 'aim' && !C.ended) { S.drag = { on: true }; S.power = 0; } },
      move: (dx, dy) => { if (S.drag) aimFromDrag(dx, dy); },
      up: (dx, dy, sec, cancel) => { if (!S.drag) return; S.drag = null; if (!cancel && S.power >= 0.04) doPutt(S.aimA, S.power); else S.power = 0; },
      side: () => { if (C.ended) return; C.curtain(() => reset(), null); },
      main: () => {},
      animState: () => null,
      result: () => S.last,
      state: () => ({ phase: S.phase, hole: S.hole, strokes: S.strokes.slice(), total: S.total, aces: S.aces, ball: { x: +Bb.x.toFixed(2), z: +Bb.z.toFixed(2), rolling: Bb.rolling, holed: Bb.holed }, hole2: HOLES[S.hole].slice(), aim: +S.aimA.toFixed(3), power: +S.power.toFixed(2) }),
      debug: { auto: m => { S.auto = m || null; return S.auto; }, shoot: (a, p) => doPutt(a === undefined ? holeDir() : a, p === undefined ? 0.5 : p), holeDir: () => holeDir(), simulate: (a, p) => simulate(a, p), best: () => bestShot('best'), restart: () => C.curtain(() => reset(), null),
        drag: (dx, dy) => { if (S.phase !== 'aim') return false; S.drag = { on: true }; aimFromDrag(dx, dy); return { a: S.aimA, p: S.power }; }, release: () => { if (!S.drag) return false; S.drag = null; return doPutt(S.aimA, S.power); }, layout: () => ({ tees: TEES, holes: HOLES, par: PAR, obstacles: OB }) },
      dispose() { timers.length = 0; C.H.yOverride = undefined; },
    };
  }
  // склейка готовых BufferGeometry с одинаковыми атрибутами (без индексов)
  function mergeGeos(T, list) {
    const keys = ['position', 'normal', 'color']; let n = 0; list.forEach(g => { n += g.attributes.position.count; });
    const out = new T.BufferGeometry();
    keys.forEach(k => { const a = new Float32Array(n * 3); let o = 0; list.forEach(g => { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }); out.setAttribute(k, new T.BufferAttribute(a, 3)); });
    out.computeBoundingSphere(); return out;
  }

  const GAMES = { padel: padelGame, football: footballGame, golf: golfGame };

  /* ---------- места для отеля: добавить в h.spots (use → { kind:'sport', sport }) ---------- */
  function spotsFor(h) {
    // уже есть в регионе (golf_putt отеля — kind 'golf') — не дублируем: игра направляет kind 'golf' сюда же
    return HOTEL.spots.filter(s => !(h && h.spots && h.spots.some(q => q.id === s.id))).map(s => {
      const sp = Object.assign({}, s);
      sp.use = () => ({ id: s.id, kind: 'sport', sport: s.sport, court: HOTEL[s.sport], returnTo: { x: s.x, y: s.y, z: s.z, ry: s.ry }, npc: 'hotel_raccoon' });
      return sp;
    });
  }

  V.sports = {
    start, version: 1, HOTEL, LINES, SPEAKERS, SAY, spotsFor,
    best: () => JSON.parse(JSON.stringify(BEST)), rounds: () => Object.assign({}, ROUNDS),
    reset: () => { BEST.padel = BEST.football = BEST.golf = null; ROUNDS.padel = ROUNDS.football = ROUNDS.golf = 0; },
  };
})();
