/* =====================================================================
   ДЕНЬ И НОЧЬ (волна 4): время суток по часам телефона (местное время) — город, горное село, серпантин.
   Обычный <script>: глобальное window.DayNight, без модулей. Нужен THREE r149 (передаётся в create).

   Фазы (по местным часам): утро 6–10, день 10–17, золотой час 17–19, вечер 19–20, ночь 20–6.
   Переходы плавные (рассвет 5:30–6:30, 9:30–10:30, 16:30–17:30, 18:36–19:12, сумерки 19:42–20:00 — в 20:00 уже ночь).
   «Вернуться в утро» — DayNight.set('morning'): утро, что бы ни показывали часы; держится всю сессию
   (sessionStorage), общее для всех экземпляров (город и регион). «Как на часах» — DayNight.set(null).

   Как устроено (почему так):
     • Ночь — это «грейд» в шейдере, а не перекраска сцены: каждому материалу при attach() добавляется
       onBeforeCompile (цепочкой, чужие патчи — атлас, свечение окон, rim, mood — сохраняются) с общими uniform-ами:
       c = grade(c − свечение) + свечение × dnP.y, grade(x) = mix(серое, x, dnP.x) × dnMul + dnAdd. Так одинаково темнеют тун-материалы города
       (настоящий свет), и запечённый свет села (MeshBasic + цвет вершин, quality:'low'), где свет сцены ничего не
       решает. Окна и лампы не гаснут: их излучение (totalEmissiveRadiance, атрибут emis города, uGlow окон села)
       добавляется уже после затемнения. Небо (сфера) — свой вид 'sky': горизонт и зенит тонируются отдельно.
       Пересборки света, геометрии и цвета вершин нет — кадр стоит столько же, переход — только uniform-ы.
     • Uniform-ы общие на модуль: героиня переезжает из сцены города в сцену региона — её материалы уже готовы,
       и правильный вид всегда у той сцены, чей экземпляр обновлялся последним (рисуется одна сцена за раз).
     • Свет, туман и фон: регион ставит их сам (село — при setMood, серпантин — каждый кадр). DayNight запоминает
       «базу» — то, что поставил регион, — и замечает, когда значение поменяли не мы (сравнение с последним
       записанным): итог = база × оттенок фазы. Поэтому update(dt) зовём ПОСЛЕ h.update(...) и ДО render.
     • Своего освещения ночью нет (ни одного PointLight): лампы — одна сетка (1 вызов: ореол-билборд у плафона и
       тёплое пятно на земле под ним), звёзды — Points (1 вызов, мерцают в шейдере), луна — Sprite (1 вызов).
       Днём все три скрыты: +0 вызовов. Метки города (группа 'markers') и всё с userData.dn = 'none' — без грейда.
     • Небо города — CSS-градиент за прозрачным холстом: туда кладутся два слоя (сумерки, ночь) — только opacity.
     • Без выделений памяти в кадре (замер CDP: 0 Б/кадр ровно, ~2 Б/кадр с переходами — события onChange):
       часы — Date.now() и смещение пояса раз в минуту; состояние — Float32/64Array; скаляры uniform-ов упакованы
       в vec4 с числовыми полями (запись дроби в общее поле value упаковывала бы число); строки opacity — заранее.

   API
     DayNight.create({ THREE, scene, renderer?, camera?, sun?, hemi?, fog?, sky?, preset?, quality?, root?,
                       stars?, moon?, moonDir?, ground?, autoLamps?, lampSize?, rescan?, tau? }) → dn
       sun/hemi — DirectionalLight/HemisphereLight (нет — найдутся в сцене при attach); fog — по умолчанию scene.fog
       (берётся живым каждый кадр); sky — Mesh неба | HTMLElement (CSS-небо города) | 'auto' (сфера BackSide в сцене);
       preset — 'city' | 'village' | 'road' | объект; quality 'low'|'high' — число звёзд; root — сразу attach(root);
       rescan — раз в N с досматривать сцену на новые материалы и убирать лампы ушедших объектов (1; 0 — выкл.);
       moonDir { az, el } — где луна (градусы, az 0 = −z, 90 = +x); ground(x, z) — высота земли для пятен света ламп;
       tau — постоянная сглаживания перехода, с (0,8: смена «утро ↔ часы» за ~2,5 с).
     dn.update(dt, camera?)    — раз в кадр, после h.update(), до renderer.render
     dn.hour() → 0…24 (с учётом «утра»); dn.clockHour() — по часам; dn.phase() → 'morning'|'day'|'golden'|'evening'|'night'
     dn.set(ov|null, { persist?, instant? }) — ov: 'morning' | любая фаза | число-час; null — как на часах
     dn.override() → ov | null; dn.onChange(cb) → отписка; cb({ phase, prev, hour, override, lamps, night })
     dn.lampsOn() → bool; dn.night() → 0…1 (звёзды); dn.apply(preset) — сменить набор (плавно)
     dn.attach(root, { kind?, owner? }) — пропатчить материалы поддерева (вид сам: sky / lamp / glow / actor / world);
       userData.dn = 'world'|'actor'|'sky'|'window'|'lamp'|'glow'|'none' у объекта или материала — вид вручную
     dn.attachRegion(h) — регион села/дороги целиком: h.lights, h.npcs (как 'actor'), h.root, h.night (если есть)
     dn.detach(owner) — убрать лампы, окна, ореолы, uniform-ы, зарегистрированные с этим owner
     dn.patch(material, kind) — один материал; dn.addWindows(target, { strength }) — окна теплеют к ночи
     dn.addLamp(pos | Object3D, { size, color, offset, follow, owner }) → id; dn.addLamps(list, o); dn.removeLamp(id)
     dn.addHalo(points | material, { boost, grow, owner }) — готовые ореолы (город: MAP.halos) ярче и больше ночью
     dn.addUniform(u, { from:'glow'|'lamps'|'night', scale, owner }) — любой float-uniform растёт к ночи (max с базой)
     dn.setLights(sun, hemi); dn.setMoon({az, el}); dn.setGround(fn); dn.setSky(mesh|el); dn.exclude(obj); dn.info(); dn.dispose()
     DayNight.set / override / clockHour / phaseAt / label(h) / onChange / setClock(fn) / mountToggle(host, o)
     DayNight.PRESETS / PHASES / PHASE_RU / PHASE_HOUR / LINES
   ===================================================================== */
(function () {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hexRGB = h => { const n = parseInt(String(h).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const rgbOf = c => (Array.isArray(c) ? c : typeof c === 'string' ? hexRGB(c) : c && c.isColor ? [c.r, c.g, c.b] : [1, 0.82, 0.55]);

  /* ---------- фазы ---------- */
  const PHASES = ['morning', 'day', 'golden', 'evening', 'night'];
  const PHASE_RU = { morning: 'утро', day: 'день', golden: 'золотой час', evening: 'вечер', night: 'ночь' };
  const PHASE_HOUR = { morning: 8, day: 13, golden: 18, evening: 19.5, night: 22.5 };
  const norm24 = h => { h = h % 24; return h < 0 ? h + 24 : h; };
  function phaseAt(h) {
    h = norm24(+h || 0);
    return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'golden' : h >= 19 && h < 20 ? 'evening' : 'night';
  }
  // опорные точки вида по кругу суток: между ними — smoothstep; 20:00 — уже полная ночь (как просил автор)
  const KH = [5.5, 6.5, 9.5, 10.5, 16.5, 17.5, 18.6, 19.2, 19.7, 20.0];
  const KP = ['night', 'morning', 'morning', 'day', 'day', 'golden', 'golden', 'evening', 'evening', 'night'];
  const label = h => { h = norm24(h); const m = Math.floor(h * 60 + 1e-6); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  /* ---------- часы телефона (без выделений в кадре) ---------- */
  // HB — «регистр» для часа в кадре: числа с плавающей точкой в замыканиях и возвратах функций V8 упаковывает
  // в новые объекты (выделение на каждый кадр), а запись в Float64Array — нет
  const HB = new Float64Array(4);   // [0] час для вида, [1] смещение пояса (мс), [2] когда обновлено (мс)
  HB[2] = -1e15;
  let clockFn = null;
  function clockInto() {   // → HB[0]
    if (clockFn) { try { HB[0] = norm24(+clockFn() || 0); return; } catch (e) { /* ниже — настоящие часы */ } }
    const now = Date.now();
    if (now - HB[2] > 60000) { HB[2] = now; HB[1] = new Date(now).getTimezoneOffset() * 60000; }
    let h = ((now - HB[1]) / 3600000) % 24; if (h < 0) h += 24; HB[0] = h;
  }
  function clockHour() { clockInto(); return HB[0]; }

  /* ---------- вид (вектор параметров) ---------- */
  const L = { MUL: 0, ADD: 3, SAT: 6, EMIS: 7, SHM: 8, SHA: 11, SZM: 14, SZA: 17, SUNK: 20, SUNT: 21, HEMK: 24, HEMT: 25, GLOW: 28, LAMP: 29, STAR: 30, MOON: 31, DUSK: 32, NCSS: 33, ACT: 34, N: 35 };
  function compile(o) {
    o = o || {}; const v = new Float32Array(L.N), one = [1, 1, 1], zero = [0, 0, 0];
    const put3 = (i, a, d) => { a = a || d; v[i] = a[0]; v[i + 1] = a[1]; v[i + 2] = a[2]; };
    put3(L.MUL, o.mul, one); put3(L.ADD, o.add, zero); v[L.SAT] = o.sat == null ? 1 : o.sat; v[L.EMIS] = o.emis || 0;
    const sh = o.skyH || {}, sz = o.skyZ || sh;
    put3(L.SHM, sh.mul, one); put3(L.SHA, sh.add, zero); put3(L.SZM, sz.mul, one); put3(L.SZA, sz.add, zero);
    const su = o.sun || {}, he = o.hemi || {};
    v[L.SUNK] = su.k == null ? 1 : su.k; put3(L.SUNT, su.tint, one); v[L.HEMK] = he.k == null ? 1 : he.k; put3(L.HEMT, he.tint, one);
    v[L.GLOW] = o.glow || 0; v[L.LAMP] = o.lamps || 0; v[L.STAR] = o.stars || 0; v[L.MOON] = o.moon || 0;
    v[L.DUSK] = o.dusk || 0; v[L.NCSS] = o.nightSky || 0; v[L.ACT] = o.actor == null ? 0.66 : o.actor;   // жители и героиня темнеют на ⅔ — ночью читаются
    return v;
  }

  /* ---------- наборы по типу места ----------
     Ночь — глубокий синий, никогда не чёрный: dnAdd держит «пол» ≈ #0A0C1A…#121A33, тени — синие, а не серые;
     окна и лампы тёплые. Вечер — сиренево-персиковый. Золотой час — тёплый, горизонт персиковый.
     Город уже нарисован в «золотом часе» (LOOKS[3] в js/world/main.js) — его «день» = как есть. */
  const MOUNTAIN = {
    // утро: розово-золотой свет, мягче контраст, персиковый горизонт, светлый зенит
    morning: { mul: [1.03, 0.975, 0.955], add: [0.035, 0.022, 0.035], sat: 0.9, skyH: { mul: [1.0, 0.9, 0.88], add: [0.12, 0.08, 0.07] }, skyZ: { mul: [0.9, 0.95, 1.0], add: [0.06, 0.05, 0.05] }, sun: { k: 0.95, tint: [1, 0.92, 0.84] }, hemi: { k: 1, tint: [1, 0.97, 1] } },
    day: {},
    golden: { mul: [1.07, 0.93, 0.79], add: [0.03, 0.012, 0], sat: 1.06, emis: 0.05, skyH: { mul: [1.0, 0.82, 0.62], add: [0.22, 0.12, 0.03] }, skyZ: { mul: [0.96, 0.9, 0.93], add: [0.05, 0.03, 0.03] }, sun: { k: 1.08, tint: [1, 0.84, 0.64] }, hemi: { k: 1, tint: [1, 0.93, 0.86] }, glow: 0.3 },
    evening: { mul: [0.74, 0.63, 0.78], add: [0.03, 0.02, 0.06], sat: 0.86, emis: 0.15, skyH: { mul: [0.92, 0.62, 0.66], add: [0.13, 0.05, 0.08] }, skyZ: { mul: [0.42, 0.4, 0.66], add: [0.03, 0.03, 0.1] }, sun: { k: 0.8, tint: [1, 0.82, 0.75] }, hemi: { k: 0.96, tint: [0.94, 0.9, 1] }, glow: 0.75, lamps: 1, stars: 0.3, moon: 0.7, dusk: 1 },
    night: { mul: [0.38, 0.44, 0.72], add: [0.03, 0.04, 0.09], sat: 0.62, emis: 0.25, skyH: { mul: [0.33, 0.37, 0.6], add: [0.035, 0.045, 0.11] }, skyZ: { mul: [0.12, 0.16, 0.38], add: [0.012, 0.022, 0.075] }, sun: { k: 0.7, tint: [0.8, 0.86, 1] }, hemi: { k: 1.08, tint: [0.86, 0.9, 1] }, glow: 1, lamps: 1, stars: 1, moon: 1, nightSky: 1 },
  };
  const PRESETS = {
    village: { id: 'village', looks: MOUNTAIN, moon: { az: 25, el: 21 }, stars: 1 },
    road: { id: 'road', looks: MOUNTAIN, moon: { az: 200, el: 22 }, stars: 1.1 },
    city: {
      id: 'city', moon: { az: 135, el: 24 }, stars: 0.8,
      looks: {
        morning: { mul: [0.98, 1.0, 1.04], add: [0.02, 0.03, 0.05], sat: 0.92, skyH: { mul: [0.96, 0.99, 1.04], add: [0.02, 0.03, 0.05] }, skyZ: { mul: [0.92, 0.97, 1.04], add: [0.03, 0.04, 0.06] }, sun: { k: 0.95, tint: [0.97, 0.98, 1.02] } },
        day: {},
        golden: { mul: [1.04, 0.97, 0.9], add: [0.015, 0.005, 0], sat: 1.04, emis: 0.05, skyH: { mul: [1.03, 0.94, 0.86], add: [0.03, 0.01, 0] }, sun: { k: 1.05, tint: [1, 0.92, 0.82] }, glow: 0.3 },
        evening: { mul: [0.76, 0.66, 0.8], add: [0.03, 0.02, 0.06], sat: 0.88, emis: 0.5, skyH: { mul: [0.78, 0.62, 0.72], add: [0.06, 0.03, 0.07] }, skyZ: { mul: [0.4, 0.4, 0.66], add: [0.03, 0.03, 0.1] }, sun: { k: 0.8, tint: [1, 0.82, 0.76] }, hemi: { k: 0.96, tint: [0.94, 0.9, 1] }, glow: 0.75, lamps: 1, stars: 0.3, moon: 0.7, dusk: 0.85 },
        // волна 4B: окна города ночью теплее и ярче (свечение стёкол ×2,1: «окна горят»), метки и лучи — без грейда
        night: { mul: [0.38, 0.44, 0.72], add: [0.03, 0.04, 0.09], sat: 0.62, emis: 1.1, skyH: { mul: [0.26, 0.31, 0.56], add: [0.03, 0.04, 0.09] }, skyZ: { mul: [0.1, 0.13, 0.32], add: [0.01, 0.02, 0.07] }, sun: { k: 0.7, tint: [0.8, 0.86, 1] }, hemi: { k: 1.08, tint: [0.86, 0.9, 1] }, glow: 1, lamps: 1, stars: 1, moon: 1, nightSky: 1 },
      },
      // CSS-небо города (поверх SKY3D[…] корня): низ ночного слоя совпадает с ночным туманом (#F8D9CC × skyH)
      css: {
        dusk: 'linear-gradient(180deg,#6F6AAE 0%,#A98BC4 18%,#E3A6B8 32%,#F2BFA6 40%,#F2BFA6 100%)',
        night: 'linear-gradient(180deg,#101838 0%,#18234C 14%,#2C366A 28%,#484E89 40%,#484E89 100%)',
      },
    },
  };
  function resolvePreset(p) { return typeof p === 'string' ? (PRESETS[p] || PRESETS.village) : (p && p.looks ? p : PRESETS.village); }
  function compiledPreset(p) {
    if (p._c) return p._c;
    const looks = {}; PHASES.forEach(k => { looks[k] = compile(p.looks[k] || {}); });
    const az = ((p.moon && p.moon.az) || 0) * Math.PI / 180, el = ((p.moon && p.moon.el) || 22) * Math.PI / 180;
    p._c = { id: p.id || 'custom', L: looks, moonDir: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)], stars: p.stars || 1, css: p.css || null };
    return p._c;
  }
  function lookAt(h, C, out) { HB[0] = norm24(h); return lookAtHB(C, out); }
  function lookAtHB(C, out) {   // час — в HB[0]
    let h = HB[0], i = -1; for (let k = 0; k < KH.length; k++) if (h >= KH[k]) i = k;
    let a, b, h0, h1;
    if (i < 0 || i === KH.length - 1) { a = KH.length - 1; b = 0; h0 = KH[a]; h1 = KH[0] + 24; if (h < KH[0]) h += 24; } else { a = i; b = i + 1; h0 = KH[a]; h1 = KH[b]; }
    let t = (h - h0) / (h1 - h0); t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
    const A = C.L[KP[a]], B = C.L[KP[b]];
    for (let j = 0; j < L.N; j++) out[j] = A[j] + (B[j] - A[j]) * t;
    return out;
  }

  /* ---------- общие uniform-ы (на модуль) ---------- */
  // Значения — объекты класса DV с числовыми полями x…w: запись дробного числа в такое поле не выделяет память,
  // а в общее для three поле «value» (там бывают и текстуры) — выделяет. Поэтому скаляры упакованы в vec4.
  class DV { constructor(x, y, z, w) { this.x = 0.5; this.y = 0.5; this.z = 0.5; this.w = 0.5; this.x = x; this.y = y; this.z = z; this.w = w; } }
  const u3 = (x, y, z) => ({ value: new DV(x, y, z, 0) }), u4 = (x, y, z, w) => ({ value: new DV(x, y, z, w) });
  const UW = { dnMul: u3(1, 1, 1), dnAdd: u3(0, 0, 0), dnP: u4(1, 1, 0, 0) };   // dnP: x — насыщенность, y — множитель свечения
  const UA = { dnMul: u3(1, 1, 1), dnAdd: u3(0, 0, 0), dnP: u4(1, 1, 0, 0) };
  const US = { dnMul: u3(1, 1, 1), dnAdd: u3(0, 0, 0), dnP: u4(1, 1, 0, 0), dnMulZ: u3(1, 1, 1), dnAddZ: u3(0, 0, 0) };
  const UX = { dnWarm: u3(1, 0.8, 0.5), dnX: u4(0, 0, 0, 0) };   // dnX: x — окна, y — лампы, z — гашение отражений под светом
  const KINDS = { world: 1, actor: 1, sky: 1, window: 1, lamp: 1 };
  function uniformsFor(kind) { return kind === 'actor' ? UA : kind === 'sky' ? US : UW; }
  function resetUniforms() {
    [UW, UA, US].forEach(U => { U.dnMul.value.x = U.dnMul.value.y = U.dnMul.value.z = 1; U.dnAdd.value.x = U.dnAdd.value.y = U.dnAdd.value.z = 0; U.dnP.value.x = 1; U.dnP.value.y = 1; });
    US.dnMulZ.value.x = US.dnMulZ.value.y = US.dnMulZ.value.z = 1; US.dnAddZ.value.x = US.dnAddZ.value.y = US.dnAddZ.value.z = 0;
    UX.dnX.value.x = UX.dnX.value.y = UX.dnX.value.z = 0;
    GLOWU.forEach(s => { if (s.ref) s.u.value = s.v[0]; s.ref = false; });
  }

  /* ---------- патч шейдера ---------- */
  const LUMA = 'vec3(0.299, 0.587, 0.114)';
  function fragHeader(kind) {
    let s = '\nuniform vec3 dnMul;\nuniform vec3 dnAdd;\nuniform vec4 dnP;\nuniform vec4 dnX;\n';
    if (kind === 'sky') s += 'uniform vec3 dnMulZ;\nuniform vec3 dnAddZ;\nvarying float vDnY;\n';
    if (kind === 'window') s += 'uniform vec3 dnWarm;\nuniform float dnWinK;\n';
    // свечение e (окна, лампы) вычитается до затемнения и возвращается после, ×dnP.y (1 днём): оттенок окон не синеет;
    // ночью там, где горит свет, отражения стекла гаснут (dnX.z — окна × фонари фазы): окно читается тёплым, а не белым
    s += 'vec3 dnGrade(vec3 c, vec3 e) { vec3 b = max(c - e, 0.0); b *= 1.0 - clamp(dot(e, ' + LUMA + ') * 1.6, 0.0, 0.85) * dnX.z; float l = dot(b, ' + LUMA + '); return mix(vec3(l), b, dnP.x) * dnMul + dnAdd + e * dnP.y; }\n';
    if (kind === 'sky') s += 'vec3 dnGradeSky(vec3 c) { float t = smoothstep(0.0, 0.6, vDnY); float l = dot(c, ' + LUMA + '); return mix(vec3(l), c, dnP.x) * mix(dnMul, dnMulZ, t) + mix(dnAdd, dnAddZ, t); }\n';
    return s;
  }
  function gradeExpr(kind, c, e) {
    if (kind === 'sky') return 'dnGradeSky(' + c + ')';
    if (kind === 'window') return 'mix(dnGrade(' + c + ', ' + e + '), dnWarm, clamp(dnX.x * dnWinK, 0.0, 1.0))';
    if (kind === 'lamp') return 'mix(dnGrade(' + c + ', ' + e + '), ' + c + ' * 1.12, dnX.y)';
    return 'dnGrade(' + c + ', ' + e + ')';
  }
  function emisExpr(fs) {
    if (/vec3\s+totalEmissiveRadiance\b/.test(fs)) return 'totalEmissiveRadiance';
    if (fs.indexOf('uGlowCol * (uGlow * vGlowI * gMask)') >= 0) return '(uGlowCol * (uGlow * vGlowI * gMask))';   // окна села (запечённый режим)
    return 'vec3(0.0)';
  }
  const lastBrace = (s, ins) => { const i = s.lastIndexOf('}'); return i < 0 ? s : s.slice(0, i) + ins + '\n' + s.slice(i); };
  function inject(sh, rec, isSM) {
    const kind = rec.kind, U = uniformsFor(kind);
    sh.uniforms.dnMul = U.dnMul; sh.uniforms.dnAdd = U.dnAdd; sh.uniforms.dnP = U.dnP; sh.uniforms.dnX = UX.dnX;
    if (kind === 'sky') { sh.uniforms.dnMulZ = US.dnMulZ; sh.uniforms.dnAddZ = US.dnAddZ; }
    if (kind === 'window') { sh.uniforms.dnWarm = UX.dnWarm; sh.uniforms.dnWinK = rec.k; }
    let fs = sh.fragmentShader;
    const head = fragHeader(kind), e = emisExpr(fs);
    if (!isSM && fs.indexOf('#include <output_fragment>') >= 0) {
      fs = fs.replace('#include <output_fragment>', 'outgoingLight = ' + gradeExpr(kind, 'outgoingLight', e) + ';\n#include <output_fragment>');
    } else {
      const ins = 'gl_FragColor.rgb = ' + gradeExpr(kind, 'gl_FragColor.rgb', 'vec3(0.0)') + ';\n';
      const fi = fs.lastIndexOf('#include <fog_fragment>');
      fs = fi >= 0 ? fs.slice(0, fi) + ins + fs.slice(fi) : lastBrace(fs, ins);
    }
    sh.fragmentShader = head + fs;
    if (kind === 'sky') {
      let vs = 'varying float vDnY;\n' + sh.vertexShader;
      if (!isSM && vs.indexOf('#include <begin_vertex>') >= 0) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDnY = normalize(position).y;');
      else vs = lastBrace(vs, 'vDnY = normalize(position).y;');
      sh.vertexShader = vs;
    }
  }
  const PATCHED = new WeakMap();    // material → rec { kind, k }
  const GLOWU = [];                 // uniform-ы свечения окон села (K.GLOW.amt), пойманные при компиляции
  function catchGlow(u) { for (let i = 0; i < GLOWU.length; i++) if (GLOWU[i].u === u) return; GLOWU.push({ u, v: new Float64Array([u.value, NaN, 0.85]), ref: false }); if (GLOWU.length > 8) GLOWU.shift(); }   // v: [база, записано, масштаб]
  function patch(mat, kind) {
    if (!mat || mat.isRawShaderMaterial || mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial || mat.isShadowMaterial) return null;
    kind = KINDS[kind] ? kind : 'world';
    const had = PATCHED.get(mat);
    if (had) { if (had.kind !== kind && had.kind !== 'none' && had.kind !== 'glow') { had.kind = kind; mat.needsUpdate = true; } return had; }
    const rec = { kind, k: { value: 1 } };
    PATCHED.set(mat, rec);
    const own = n => (Object.prototype.hasOwnProperty.call(mat, n) ? mat[n] : null);
    const prev = own('onBeforeCompile'), prevKey = own('customProgramCacheKey'), prevStr = prev ? String(prev) : '';
    const isSM = !!mat.isShaderMaterial;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (sh.uniforms && sh.uniforms.uGlow && sh.uniforms.uGlowCol) catchGlow(sh.uniforms.uGlow);
      inject(sh, rec, isSM);
    };
    mat.customProgramCacheKey = function () { return 'dn1' + rec.kind + '|' + (prevKey ? prevKey.call(this) : prevStr); };
    mat.needsUpdate = true;
    return rec;
  }
  function mark(mat, kind) { if (mat && !PATCHED.has(mat)) PATCHED.set(mat, { kind, k: { value: 1 } }); }

  /* ---------- текстуры (canvas) ---------- */
  function cnv(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
  function starCanvas() {
    const [c, x] = cnv(64), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,255,255,0.3)';   // мягкие лучики-крестик (видны у крупных)
    x.beginPath(); x.ellipse(32, 32, 30, 2.2, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(32, 32, 2.2, 30, 0, 0, Math.PI * 2); x.fill();
    return c;
  }
  function moonCanvas() {
    const [c, x] = cnv(128), g = x.createRadialGradient(64, 64, 18, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,246,220,0.55)'); g.addColorStop(0.35, 'rgba(220,226,255,0.16)'); g.addColorStop(1, 'rgba(200,210,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const d = x.createRadialGradient(58, 58, 2, 64, 64, 25); d.addColorStop(0, '#FFFDF2'); d.addColorStop(0.75, '#FFF3CF'); d.addColorStop(1, '#F4E2B4');
    x.fillStyle = d; x.beginPath(); x.arc(64, 64, 24, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(214,196,150,0.38)';   // мягкие «моря»
    [[56, 58, 6], [71, 66, 4.5], [62, 74, 3.5], [74, 54, 2.6]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); });
    return c;
  }

  /* ---------- глобальное «утро» и экземпляры ---------- */
  const SKEY = 'delo1010.daynight';
  let OVR = null;
  try { const s = window.sessionStorage && sessionStorage.getItem(SKEY); if (s) { const o = JSON.parse(s); if (o && (PHASE_HOUR[o.o] !== undefined || typeof o.o === 'number')) OVR = o.o; } } catch (e) { /* приватный режим */ }
  const INST = new Set(), GL = new Set();
  function normOv(ov) { if (ov == null || ov === 'clock' || ov === false) return null; if (typeof ov === 'number' && isFinite(ov)) return norm24(ov); return PHASE_HOUR[ov] !== undefined ? ov : null; }
  function setGlobal(ov, o) {
    o = o || {}; OVR = normOv(ov);
    if (o.persist !== false) { try { if (OVR === null) sessionStorage.removeItem(SKEY); else sessionStorage.setItem(SKEY, JSON.stringify({ o: OVR })); } catch (e) { /* без хранилища — только в памяти */ } }
    INST.forEach(d => d._ov(o));
    GL.forEach(cb => { try { cb({ override: OVR }); } catch (e) { /* чужая ошибка */ } });
    return OVR;
  }
  function effInto() { if (OVR === null) clockInto(); else HB[0] = typeof OVR === 'number' ? OVR : PHASE_HOUR[OVR]; }   // → HB[0]
  const effHour = () => { effInto(); return HB[0]; };
  // индекс фазы по HB[0] (0 утро … 4 ночь) — без передачи числа в функцию
  function phaseIdx() { const h = HB[0]; return h >= 6 && h < 10 ? 0 : h >= 10 && h < 17 ? 1 : h >= 17 && h < 19 ? 2 : h >= 19 && h < 20 ? 3 : 4; }
  const OPS = []; for (let i = 0; i <= 100; i++) OPS.push(String(i / 100));

  /* =====================================================================
     ЭКЗЕМПЛЯР
     ===================================================================== */
  function create(opts) {
    opts = opts || {};
    const T = opts.THREE || window.THREE, scene = opts.scene || null;
    if (!T) throw new Error('DayNight: нужен THREE');
    let P = compiledPreset(resolvePreset(opts.preset || 'village'));
    let moonDir = null;   // opts.moonDir = { az, el } (градусы; az 0 — на −z, 90 — на +x) — луна там, куда чаще смотрит камера
    const setMoon = m => { if (!m) { moonDir = null; return; } const az = (+m.az || 0) * Math.PI / 180, el = (m.el == null ? 22 : +m.el) * Math.PI / 180; moonDir = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]; };
    setMoon(opts.moonDir);
    const cur = new Float32Array(L.N), tgt = new Float32Array(L.N);
    let first = true, snap = false, camera = opts.camera || null, disposed = false;
    const NS = new Float64Array(4);   // [0] время, [1] таймер досмотра сцены
    let sun = opts.sun || null, hemi = opts.hemi || null, fogOpt = opts.fog || null, groundFn = typeof opts.ground === 'function' ? opts.ground : null, groundOwner = null;
    const HI = opts.quality === 'high';
    const TAU = opts.tau || 0.8;
    const own = [];                          // свои объекты (не патчим)
    const keep = x => { own.push(x); return x; };
    const cbs = new Set();
    let lastPhase = null, lastLamps = null, lastOv = undefined;

    /* --- свет, туман, фон: база = то, что поставил регион --- */
    const slotC = () => ({ ref: null, b: new Float64Array([1, 1, 1]), w: new Float64Array([NaN, NaN, NaN]) }), slotN = () => ({ ref: null, v: new Float64Array([1, NaN]) });   // v: [база, записано]
    const SL = { sunC: slotC(), sunI: slotN(), hemC: slotC(), hemG: slotC(), hemI: slotN(), fog: slotC(), bg: slotC() };
    // mi / ai — индексы множителя и сдвига в cur (ai < 0 — без сдвига): в функцию идут только целые
    function trackColor(s, col, mi, ai, cl) {
      const w = s.w, bs = s.b;
      if (s.ref !== col || Math.abs(col.r - w[0]) > 2e-4 || Math.abs(col.g - w[1]) > 2e-4 || Math.abs(col.b - w[2]) > 2e-4) { s.ref = col; bs[0] = col.r; bs[1] = col.g; bs[2] = col.b; }
      w[0] = bs[0] * cur[mi] + (ai < 0 ? 0 : cur[ai]); w[1] = bs[1] * cur[mi + 1] + (ai < 0 ? 0 : cur[ai + 1]); w[2] = bs[2] * cur[mi + 2] + (ai < 0 ? 0 : cur[ai + 2]);
      if (cl) for (let q = 0; q < 3; q++) w[q] = w[q] < 0 ? 0 : w[q] > 1 ? 1 : w[q];
      col.r = w[0]; col.g = w[1]; col.b = w[2];
    }
    function trackInt(s, obj, ki) {   // obj.intensity
      const v = s.v;
      if (s.ref !== obj || Math.abs(obj.intensity - v[1]) > 1e-5) { s.ref = obj; v[0] = obj.intensity; v[1] = NaN; }
      const nv = v[0] * cur[ki]; if (nv !== v[1]) { v[1] = nv; obj.intensity = nv; }
    }
    function restoreSlots() {
      const rc = s => { if (s.ref) { s.ref.r = s.b[0]; s.ref.g = s.b[1]; s.ref.b = s.b[2]; s.ref = null; } };
      rc(SL.sunC); rc(SL.hemC); rc(SL.hemG); rc(SL.fog); rc(SL.bg);
      if (SL.sunI.ref) { SL.sunI.ref.intensity = SL.sunI.v[0]; SL.sunI.ref = null; } if (SL.hemI.ref) { SL.hemI.ref.intensity = SL.hemI.v[0]; SL.hemI.ref = null; }
    }
    function applyLights() {
      if (sun && sun.color) { trackColor(SL.sunC, sun.color, L.SUNT, -1, false); trackInt(SL.sunI, sun, L.SUNK); }
      if (hemi && hemi.color) { trackColor(SL.hemC, hemi.color, L.HEMT, -1, false); trackColor(SL.hemG, hemi.groundColor, L.HEMT, -1, false); trackInt(SL.hemI, hemi, L.HEMK); }
      const fog = fogOpt || (scene && scene.fog);
      if (fog && fog.color) trackColor(SL.fog, fog.color, L.SHM, L.SHA, true);
      const bg = scene && scene.background;
      if (bg && bg.isColor) trackColor(SL.bg, bg, L.SHM, L.SHA, true);
    }
    function writeUniforms() {
      UW.dnMul.value.x = cur[0]; UW.dnMul.value.y = cur[1]; UW.dnMul.value.z = cur[2];
      UW.dnAdd.value.x = cur[3]; UW.dnAdd.value.y = cur[4]; UW.dnAdd.value.z = cur[5];
      UW.dnP.value.x = cur[L.SAT]; UW.dnP.value.y = 1 + cur[L.EMIS];
      const a = cur[L.ACT];
      UA.dnMul.value.x = 1 + (cur[0] - 1) * a; UA.dnMul.value.y = 1 + (cur[1] - 1) * a; UA.dnMul.value.z = 1 + (cur[2] - 1) * a;
      UA.dnAdd.value.x = cur[3] * a; UA.dnAdd.value.y = cur[4] * a; UA.dnAdd.value.z = cur[5] * a;
      UA.dnP.value.x = 1 + (cur[L.SAT] - 1) * a; UA.dnP.value.y = 1 + cur[L.EMIS] * a;
      US.dnMul.value.x = cur[L.SHM]; US.dnMul.value.y = cur[L.SHM + 1]; US.dnMul.value.z = cur[L.SHM + 2];
      US.dnAdd.value.x = cur[L.SHA]; US.dnAdd.value.y = cur[L.SHA + 1]; US.dnAdd.value.z = cur[L.SHA + 2];
      US.dnMulZ.value.x = cur[L.SZM]; US.dnMulZ.value.y = cur[L.SZM + 1]; US.dnMulZ.value.z = cur[L.SZM + 2];
      US.dnAddZ.value.x = cur[L.SZA]; US.dnAddZ.value.y = cur[L.SZA + 1]; US.dnAddZ.value.z = cur[L.SZA + 2];
      US.dnP.value.x = 1 + (cur[L.SAT] - 1) * 0.5; US.dnP.value.y = 1;
      const X = UX.dnX.value; X.x = cur[L.GLOW]; X.y = cur[L.LAMP]; X.z = cur[L.GLOW] * cur[L.LAMP];
      // окна села: uGlow = max(то, что поставил регион, свечение фазы)
      for (let i = 0; i < GLOWU.length; i++) {
        const s = GLOWU[i], u = s.u, v = s.v;
        if (!s.ref || Math.abs(u.value - v[1]) > 1e-5) { v[0] = u.value; s.ref = true; }
        const nv = Math.round(Math.max(v[0], cur[L.GLOW] * v[2]) * 512) / 512; if (nv !== v[1]) { v[1] = nv; u.value = nv; }   // чужое поле value: пишем только при смене
      }
      for (let i = 0; i < UREG.length; i++) {
        const s = UREG[i], u = s.u, v = s.v, ki = s.ki;
        if (!s.ref || Math.abs(u.value - v[1]) > 1e-5) { v[0] = u.value; s.ref = true; }
        const nv = Math.round(Math.max(v[0], cur[ki] * v[2]) * 512) / 512; if (nv !== v[1]) { v[1] = nv; u.value = nv; }
      }
    }

    /* --- лампы: одна сетка (1 вызов) — ореол-«билборд» у плафона + тёплое пятно света на земле под ним ---
       Без текстуры: спад яркости считается в шейдере. Пятно на земле — если известна высота земли
       (o.ground — число, или opts.ground(x, z) / h.ground региона); туман гасит пятно и (слабее) ореол. */
    const LAMPS = []; let lampId = 0, glowPts = null, glowMat = null, followN = 0;
    const LAMPOBJ = new WeakSet();
    const UREG = [], HALOS = [];
    const GLOW_V = `attribute vec2 corner;
attribute float aSize;
attribute float aMode;
attribute vec3 aCol;
varying vec2 vC;
varying vec3 vCol;
varying float vMode;
varying float vDepth;
void main() {
  vec4 mv;
  if (aMode < 0.5) { mv = modelViewMatrix * vec4(position, 1.0); mv.xy += corner * aSize * 0.5; }
  else { vec3 p = position; p.xz += corner * aSize * 0.5; mv = modelViewMatrix * vec4(p, 1.0); }
  gl_Position = projectionMatrix * mv;
  vC = corner; vCol = aCol; vMode = aMode; vDepth = -mv.z;
}`;
    const GLOW_F = `uniform vec4 uP;
uniform float fogNear;
uniform float fogFar;
varying vec2 vC;
varying vec3 vCol;
varying float vMode;
varying float vDepth;
void main() {
  float d = length(vC);
  float a = vMode < 0.5 ? 0.85 * exp(-d * d * 7.0) + 0.2 * max(0.0, 1.0 - d) + smoothstep(0.17, 0.02, d) : 0.3 * smoothstep(1.0, 0.15, d);
  float f = 1.0;
#ifdef USE_FOG
  f = 1.0 - smoothstep(fogNear, fogFar * 1.2, vDepth) * (vMode < 0.5 ? 0.55 : 1.0);
#endif
  gl_FragColor = vec4(vCol, clamp(a * uP.x * f, 0.0, 1.0));
}`;
    function glowMaterial() {
      if (glowMat) return glowMat;
      glowMat = keep(new T.ShaderMaterial({
        uniforms: { uP: u4(0, 0, 0, 0), fogNear: { value: 1e4 }, fogFar: { value: 2e4 }, fogColor: { value: new T.Color() }, fogDensity: { value: 0 } },
        vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: true,
      }));
      mark(glowMat, 'none');
      return glowMat;
    }
    function rebuildLamps() {
      if (!scene) return;
      const n = LAMPS.length;
      if (glowPts) glowPts.geometry.dispose();
      if (!n) { if (glowPts) glowPts.visible = false; return; }
      let nv = 0; LAMPS.forEach(l => { l.v0 = nv; nv += l.pool ? 8 : 4; });
      const pos = new Float32Array(nv * 3), cor = new Float32Array(nv * 2), siz = new Float32Array(nv), mode = new Float32Array(nv), col = new Float32Array(nv * 3), idx = new (nv > 65000 ? Uint32Array : Uint16Array)(nv / 4 * 6);
      const CR = [-1, -1, 1, -1, 1, 1, -1, 1];
      let q = 0; followN = 0;
      const quad = (v0, x, y, z, size, m, c) => {
        for (let k = 0; k < 4; k++) { const v = v0 + k; pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; cor[v * 2] = CR[k * 2]; cor[v * 2 + 1] = CR[k * 2 + 1]; siz[v] = size; mode[v] = m; col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2]; }
        idx[q++] = v0; idx[q++] = m ? v0 + 2 : v0 + 1; idx[q++] = m ? v0 + 1 : v0 + 2; idx[q++] = v0; idx[q++] = m ? v0 + 3 : v0 + 2; idx[q++] = m ? v0 + 2 : v0 + 3;
      };
      LAMPS.forEach(l => {
        quad(l.v0, l.x, l.y, l.z, l.size, 0, l.c);
        if (l.pool) quad(l.v0 + 4, l.x, l.pool.y, l.z, l.pool.r * 2, 1, l.pc);
        if (l.obj) followN++;
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('corner', new T.BufferAttribute(cor, 2)); g.setAttribute('aSize', new T.BufferAttribute(siz, 1));
      g.setAttribute('aMode', new T.BufferAttribute(mode, 1)); g.setAttribute('aCol', new T.BufferAttribute(col, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
      if (!glowPts) { glowPts = new T.Mesh(g, glowMaterial()); glowPts.name = 'daynight:lamps'; glowPts.frustumCulled = false; glowPts.renderOrder = 5; glowPts.userData.dn = 'none'; glowPts.visible = false; scene.add(glowPts); }
      else glowPts.geometry = g;
    }
    function addLamp(at, o) {
      o = o || {};
      let x = 0, y = 0, z = 0, obj = null; const off = o.offset || [0, 0, 0];
      if (at && at.isObject3D) {
        obj = at; LAMPOBJ.add(obj);
        if (obj.material && !o.keepMaterial) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => patch(m, 'lamp'));
        obj.updateMatrixWorld(true); const e = obj.matrixWorld.elements;
        x = e[0] * off[0] + e[4] * off[1] + e[8] * off[2] + e[12]; y = e[1] * off[0] + e[5] * off[1] + e[9] * off[2] + e[13]; z = e[2] * off[0] + e[6] * off[1] + e[10] * off[2] + e[14];
      } else if (Array.isArray(at)) { x = at[0]; y = at[1]; z = at[2]; } else if (at) { x = at.x; y = at.y; z = at.z; }
      if (o.source && o.source.isObject3D) LAMPOBJ.add(o.source);
      const id = ++lampId, c = rgbOf(o.color || '#FFC777'), follow = !!(o.follow && obj);
      // пятно света на земле: o.ground (высота земли) | opts.ground(x, z); o.pool === false — без пятна
      let gy = typeof o.ground === 'number' ? o.ground : null;
      if (gy === null && typeof o.ground === 'function') { try { gy = o.ground(x, z); } catch (e) { gy = null; } }
      if (gy === null && groundFn) { try { gy = groundFn(x, z); } catch (e) { gy = null; } }
      const pool = !follow && o.pool !== false && typeof gy === 'number' && isFinite(gy) && y - gy > 0.6 && y - gy < 9 ? { y: gy + 0.04, r: o.poolR || clamp((y - gy) * 0.8, 1.4, 3.4) } : null;
      LAMPS.push({ id, x, y, z, obj: follow ? obj : null, src: o.src || obj || (o.owner && o.owner.isObject3D ? o.owner : null), off, c, pc: [c[0], c[1] * 0.94, c[2] * 0.8], size: o.size || 1.6, owner: o.owner || null, pool, v0: 0 });
      if (!o.noRebuild) rebuildLamps();
      return id;
    }
    function addLamps(list, o) { o = Object.assign({}, o, { noRebuild: true }); const ids = (list || []).map(a => addLamp(a, o)); rebuildLamps(); return ids; }
    function removeWhere(fn) { let k = 0; for (let i = LAMPS.length - 1; i >= 0; i--) if (fn(LAMPS[i])) { LAMPS.splice(i, 1); k++; } if (k) rebuildLamps(); return k; }
    // лампы, чей источник ушёл из сцены (регион выгружен без detach), убираются при досмотре
    function pruneLamps() {
      let dead = false;
      for (let i = 0; i < LAMPS.length; i++) { const sr = LAMPS[i].src; if (sr && !isInside(sr, scene)) { dead = true; break; } }
      if (dead) removeWhere(l => l.src && !isInside(l.src, scene));
    }
    function followLamps() {
      if (!followN || !glowPts) return;
      const p = glowPts.geometry.attributes.position, a = p.array;
      for (let i = 0; i < LAMPS.length; i++) {
        const l = LAMPS[i]; if (!l.obj) continue;
        const e = l.obj.matrixWorld.elements, o = l.off;
        const x = e[0] * o[0] + e[4] * o[1] + e[8] * o[2] + e[12], y = e[1] * o[0] + e[5] * o[1] + e[9] * o[2] + e[13], z = e[2] * o[0] + e[6] * o[1] + e[10] * o[2] + e[14];
        for (let k = 0; k < 4; k++) { const v = (l.v0 + k) * 3; a[v] = x; a[v + 1] = y; a[v + 2] = z; }
      }
      p.needsUpdate = true;
    }
    // лампы из склеенной сетки (село: все лампы — шарики в одной сетке glowB) — кластеры вершин
    function lampsFromMesh(obj, owner) {
      const g = obj.geometry, pa = g && g.attributes && g.attributes.position; if (!pa) return 0;
      obj.updateMatrixWorld(true);
      if (obj.isInstancedMesh) {   // инстансы: центр геометрии каждого инстанса
        if (!g.boundingSphere) g.computeBoundingSphere();
        const c = g.boundingSphere.center, m = new T.Matrix4(), v = new T.Vector3(), list = [];
        for (let i = 0; i < Math.min(obj.count, 160); i++) { obj.getMatrixAt(i, m); v.copy(c).applyMatrix4(m).applyMatrix4(obj.matrixWorld); list.push([v.x, v.y, v.z]); }
        if (list.length) addLamps(list, { owner, src: obj, size: opts.lampSize || 1.5 });
        return list.length;
      }
      const e = obj.matrixWorld.elements, cell = 0.5, M = new Map();
      for (let i = 0; i < pa.count; i++) {
        const lx = pa.getX(i), ly = pa.getY(i), lz = pa.getZ(i);
        const x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], y = e[1] * lx + e[5] * ly + e[9] * lz + e[13], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
        const k = Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell);
        let c = M.get(k); if (!c) M.set(k, c = [0, 0, 0, 0]); c[0] += x; c[1] += y; c[2] += z; c[3]++;
      }
      const cl = []; M.forEach(c => { if (c[3] >= 3) cl.push([c[0] / c[3], c[1] / c[3], c[2] / c[3], c[3]]); });
      const out = [];
      cl.forEach(c => { const m = out.find(q => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) < 0.45); if (m) { const n = m[3] + c[3]; for (let j = 0; j < 3; j++) m[j] = (m[j] * m[3] + c[j] * c[3]) / n; m[3] = n; } else out.push(c.slice()); });
      if (!out.length || out.length > 160) return 0;
      addLamps(out.map(c => [c[0], c[1], c[2]]), { owner, src: obj, size: opts.lampSize || 1.5 });
      return out.length;
    }

    /* --- звёзды и луна --- */
    let stars = null, starMat = null, starU = null, moon = null, moonMat = null, moonU = null;
    function makeSky() {
      if (!scene) return;
      if (opts.stars !== false) {
        // вертикальный кадр видит узкую полоску неба (≈ 30° по горизонтали, до ~30° вверх): звёзд много и гуще у горизонта
        const n = Math.round((HI ? 1100 : 720) * P.stars), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n), ph = new Float32Array(n);
        let a = 1010; const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        const y0 = Math.sin(4 * Math.PI / 180);
        for (let i = 0; i < n; i++) {
          const y = y0 + (1 - y0) * Math.pow(R(), 1.9), r = Math.sqrt(1 - y * y), t = R() * Math.PI * 2;
          pos[i * 3] = Math.cos(t) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(t) * r;
          const tone = R(), big = R() < 0.09;
          const c = tone < 0.2 ? [1, 0.93, 0.78] : tone < 0.38 ? [0.8, 0.88, 1] : [1, 1, 1];
          col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2];
          col[i * 4 + 3] = sst(Math.sin(5 * Math.PI / 180), Math.sin(16 * Math.PI / 180), y) * (0.6 + 0.4 * R());   // у гор звёзд нет
          sz[i] = big ? 8 + R() * 3 : 3.2 + R() * 1.8; ph[i] = R();
        }
        const g = keep(new T.BufferGeometry());
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 4)); g.setAttribute('aSize', new T.BufferAttribute(sz, 1)); g.setAttribute('aPh', new T.BufferAttribute(ph, 1));
        const tex = keep(new T.CanvasTexture(starCanvas())); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;   // мипы гасят точки в 3 px
        starMat = keep(new T.PointsMaterial({ size: 1, sizeAttenuation: false, map: tex, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false }));   // прозрачность — uT.y (не material.opacity)
        starU = { uT: u4(0, 0, 0, 0) };
        starMat.onBeforeCompile = sh => {
          sh.uniforms.uT = starU.uT;
          sh.vertexShader = 'attribute float aSize;\nattribute float aPh;\nuniform vec4 uT;\n' + sh.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize * (0.72 + 0.28 * sin(uT.x * (1.1 + aPh * 1.7) + aPh * 6.2831));');
          sh.fragmentShader = 'uniform vec4 uT;\n' + sh.fragmentShader.replace('#include <output_fragment>', 'diffuseColor.a *= uT.y;\n#include <output_fragment>');
        };
        starMat.customProgramCacheKey = () => 'dnstars1';
        mark(starMat, 'none');
        stars = new T.Points(g, starMat); stars.name = 'daynight:stars'; stars.frustumCulled = false; stars.renderOrder = -10; stars.visible = false; stars.userData.dn = 'none';
        scene.add(stars);
      }
      if (opts.moon !== false) {
        const tex = keep(new T.CanvasTexture(moonCanvas()));
        moonMat = keep(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false, fog: false }));
        moonU = u4(0, 0, 0, 0);
        moonMat.onBeforeCompile = sh => { sh.uniforms.uMo = moonU; sh.fragmentShader = 'uniform vec4 uMo;\n' + sh.fragmentShader.replace('#include <output_fragment>', 'diffuseColor.a *= uMo.x;\n#include <output_fragment>'); };
        moonMat.customProgramCacheKey = () => 'dnmoon1';
        mark(moonMat, 'none');
        moon = new T.Sprite(moonMat); moon.name = 'daynight:moon'; moon.frustumCulled = false; moon.renderOrder = -9; moon.visible = false; moon.userData.dn = 'none';
        scene.add(moon);
      }
    }
    function updateSkyObjects() {
      const sK = cur[L.STAR], mK = cur[L.MOON], lK = cur[L.LAMP];
      const cam = camera;
      const R = cam ? Math.min(cam.far * 0.9, 1300) : 1000;
      if (stars) { stars.visible = sK > 0.01 && !!cam; if (stars.visible) { stars.position.copy(cam.position); const sc = stars.scale; sc.x = R; sc.y = R; sc.z = R; starU.uT.value.x = NS[0] % 1000; starU.uT.value.y = sK; } }
      if (moon) {
        moon.visible = mK > 0.01 && !!cam;
        if (moon.visible) { const d = moonDir || P.moonDir, p = cam.position, mp = moon.position, k = R * 0.97; mp.x = p.x + d[0] * k; mp.y = p.y + d[1] * k; mp.z = p.z + d[2] * k; const ms = moon.scale; ms.x = ms.y = R * 0.085; ms.z = 1; moonU.value.x = mK; }
      }
      if (glowPts) { glowPts.visible = lK > 0.01 && LAMPS.length > 0; if (glowPts.visible) { glowMat.uniforms.uP.value.x = lK; followLamps(); } }
      for (let i = 0; i < HALOS.length; i++) {
        const h = HALOS[i], m = h.mat, v = h.v;
        if (!h.ref || Math.abs(m.opacity - v[2]) > 1e-4) { v[0] = m.opacity; h.ref = true; }
        if (Math.abs(m.size - v[3]) > 1e-4 && v[3] === v[3]) v[1] = m.size;
        const no = Math.min(1, v[0] * (1 + v[4] * lK)), ns = v[1] * (1 + v[5] * lK);
        if (no !== v[2]) { v[2] = no; m.opacity = no; } if (ns !== v[3]) { v[3] = ns; m.size = ns; }
      }
    }

    /* --- CSS-небо (город) --- */
    let skyEl = opts.sky && opts.sky.nodeType === 1 ? opts.sky : null, ovDusk = null, ovNight = null, ovD = -1, ovN = -1;
    function makeOverlays() {
      if (!skyEl || ovNight || !P.css) return;
      const mk = bg => { const d = document.createElement('div'); d.className = 'dn-sky'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:' + bg; skyEl.insertBefore(d, skyEl.firstChild); return d; };
      ovDusk = mk(P.css.dusk); ovNight = mk(P.css.night);   // порядок: ночь, сумерки, холст — оба слоя под холстом
    }
    function updateOverlays() {
      if (!ovNight) return;
      const d = Math.round(clamp(cur[L.DUSK] * (1 - cur[L.NCSS]), 0, 1) * 100), n = Math.round(clamp(cur[L.NCSS], 0, 1) * 100);
      if (d !== ovD) { ovD = d; ovDusk.style.opacity = OPS[d]; }
      if (n !== ovN) { ovN = n; ovNight.style.opacity = OPS[n]; }
    }

    /* --- обход сцены и вид материала --- */
    const STACK = [], KST = []; let SP = 0;   // стек обхода по индексу: длина массива не меняется — нет перевыделений
    function isSkyMesh(o, m) {
      if (!o.isMesh || m.side !== T.BackSide || m.depthWrite !== false) return false;
      const g = o.geometry; if (!g) return false;
      if (g.parameters && g.parameters.radius) return g.parameters.radius * Math.max(o.scale.x, 1) > 50;   // небо: большая сфера изнутри без записи глубины
      if (!g.boundingSphere) g.computeBoundingSphere();
      return !!g.boundingSphere && g.boundingSphere.radius * Math.max(o.scale.x, 1) > 50;
    }
    function warmBright(o, m) {
      if (!m.isMeshBasicMaterial || m.map || m.transparent) return false;
      const col = m.color;
      if (!m.vertexColors) {
        if (!(col.r > 0.82 && col.r - col.b > 0.1 && col.g > 0.6)) return false;
        const g = o.geometry; if (!g) return false; if (!g.boundingSphere) g.computeBoundingSphere();
        return !!g.boundingSphere && g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) <= 0.4;
      }
      const ca = o.geometry && o.geometry.attributes && o.geometry.attributes.color; if (!ca || ca.count > 40000) return false;
      for (let i = 0; i < ca.count; i++) { const r = ca.getX(i) * col.r, b = ca.getZ(i) * col.b, g = ca.getY(i) * col.g; if (!(r > 0.8 && r - b > 0.08 && g > 0.6)) return false; }
      return true;
    }
    function classify(o, m) {
      const ud = (m.userData && m.userData.dn) || (o.userData && o.userData.dn); if (ud) return ud;
      if (m.isRawShaderMaterial) return 'none';
      if ((o.isPoints || o.isSprite) && m.blending === T.AdditiveBlending) return 'glow';
      if (isSkyMesh(o, m)) return 'sky';
      if (warmBright(o, m)) return 'lamp';
      if (o.isSkinnedMesh) return 'actor';
      return null;
    }
    let skyMesh = opts.sky && opts.sky.isObject3D ? opts.sky : null;
    function attach(root, o) {
      o = o || {}; if (!root) return 0;
      const force = o.kind || null, owner = o.owner || root, auto = opts.autoLamps !== false && o.autoLamps !== false;
      let n = 0;
      // userData.dn у объекта наследуют потомки (например, группа меток города → 'none': метки остаются дневными и
      // читаются ночью); группа с именем 'markers' (js/world/markers.js) — 'none' по умолчанию
      SP = 0; KST[SP] = (root.userData && root.userData.dn) || null; STACK[SP++] = root;
      while (SP > 0) {
        const ob = STACK[--SP]; STACK[SP] = null;
        const ok = (ob.userData && ob.userData.dn) || (ob.name === 'markers' ? 'none' : null) || KST[SP];
        const ch = ob.children; for (let i = 0; i < ch.length; i++) { KST[SP] = ok; STACK[SP++] = ch[i]; }
        if (ok === 'none' || !(ob.isMesh || ob.isPoints || ob.isSprite || ob.isLine) || !ob.material) continue;
        const ms = ob.material, many = Array.isArray(ms), cnt = many ? ms.length : 1;
        for (let j = 0; j < cnt; j++) {
          const m = many ? ms[j] : ms; if (!m) continue;
          let rec = PATCHED.get(m);
          if (!rec) {
            const k = (ob === skyMesh && 'sky') || force || (m.userData && m.userData.dn) || ok || classify(ob, m) || o.default || 'world';
            if (k === 'none' || k === 'glow') { mark(m, k); if (k === 'glow' && ob.isPoints) addHalo(m, { owner }); continue; }
            rec = patch(m, k); n++;
          }
          if (rec && rec.kind === 'lamp' && auto && !LAMPOBJ.has(ob)) { LAMPOBJ.add(ob); lampsFromMesh(ob, owner); }
        }
      }
      if (!sun || !hemi) findLights(root);
      return n;
    }
    function findLights(root) {
      SP = 0; STACK[SP++] = root;
      while (SP > 0) { const ob = STACK[--SP]; STACK[SP] = null; const ch = ob.children; for (let i = 0; i < ch.length; i++) STACK[SP++] = ch[i]; if (!sun && ob.isDirectionalLight) sun = ob; if (!hemi && ob.isHemisphereLight) hemi = ob; }
    }
    function addHalo(t, o) {
      o = o || {}; const m = t && t.isPoints ? t.material : t; if (!m || HALOS.some(h => h.mat === m)) return;
      mark(m, 'glow');
      HALOS.push({ mat: m, v: new Float64Array([m.opacity, m.size, NaN, NaN, o.boost == null ? 0.25 : o.boost, o.grow == null ? 0.35 : o.grow]), ref: false, owner: o.owner || null });   // v: [база o, база size, записано o, записано size, boost, grow]
    }
    function addWindows(t, o) {
      o = o || {}; const list = [];
      const take = m => { if (m && list.indexOf(m) < 0) list.push(m); };
      if (Array.isArray(t)) t.forEach(x => (x && x.isMaterial ? take(x) : x && x.traverse && x.traverse(c => c.material && [].concat(c.material).forEach(take))));
      else if (t && t.isMaterial) take(t); else if (t && t.traverse) t.traverse(c => c.material && [].concat(c.material).forEach(take));
      list.forEach(m => { const r = patch(m, 'window'); if (r) r.k.value = o.strength == null ? 0.85 : o.strength; });
      if (o.color) { const c = rgbOf(o.color); UX.dnWarm.value.x = c[0]; UX.dnWarm.value.y = c[1]; UX.dnWarm.value.z = c[2]; }
      return list.length;
    }
    function addUniform(u, o) { o = o || {}; if (!u || UREG.some(s => s.u === u)) return; const from = o.from || 'glow'; UREG.push({ u, v: new Float64Array([u.value, NaN, o.scale == null ? 1 : o.scale]), ref: false, ki: from === 'lamps' ? L.LAMP : from === 'night' ? L.STAR : L.GLOW, owner: o.owner || null }); }
    function detach(owner) {
      const k = removeWhere(l => l.owner === owner || (l.src && owner && owner.isObject3D && isInside(l.src, owner)));
      for (let i = HALOS.length - 1; i >= 0; i--) if (HALOS[i].owner === owner) { const h = HALOS[i]; if (h.ref) { h.mat.opacity = h.v[0]; h.mat.size = h.v[1]; } HALOS.splice(i, 1); }
      for (let i = UREG.length - 1; i >= 0; i--) if (UREG[i].owner === owner) { const s = UREG[i]; if (s.ref) s.u.value = s.v[0]; UREG.splice(i, 1); }
      if (sun && owner && owner.isObject3D && isInside(sun, owner)) sun = opts.sun || null;
      if (hemi && owner && owner.isObject3D && isInside(hemi, owner)) hemi = opts.hemi || null;
      if (skyMesh && owner && owner.isObject3D && isInside(skyMesh, owner)) skyMesh = null;
      if (groundOwner && owner === groundOwner) { groundFn = typeof opts.ground === 'function' ? opts.ground : null; groundOwner = null; }
      return k;
    }
    const isInside = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
    function attachRegion(h, o) {
      if (!h) return 0; o = o || {};
      const owner = h.root || h;
      if (typeof h.ground === 'function' && !opts.ground) { groundFn = h.ground; groundOwner = owner; }
      const lt = h.lights || { sun: h.sun && h.sun.isLight ? h.sun : null, hemi: h.hemi && h.hemi.isLight ? h.hemi : null };   // село: h.lights; серпантин: h.sun/h.hemi
      if (lt.sun) { sun = lt.sun; SL.sunC.ref = SL.sunI.ref = null; } if (lt.hemi) { hemi = lt.hemi; SL.hemC.ref = SL.hemG.ref = SL.hemI.ref = null; }
      let n = 0;
      (h.npcs || []).forEach(np => { if (np && np.root) n += attach(np.root, { kind: 'actor', owner }); });
      const nt = h.night || {};
      if (nt.sky) skyMesh = nt.sky;
      if (nt.windows) addWindows(nt.windows, { strength: nt.windowStrength });
      if (nt.glow) addUniform(nt.glow, { from: 'glow', scale: nt.glowScale == null ? 0.9 : nt.glowScale, owner });
      if (nt.lamps && nt.lamps.length) addLamps(nt.lamps, { owner, size: nt.lampSize || 1.5 });
      if (nt.halos) [].concat(nt.halos).forEach(p => addHalo(p, { owner }));
      n += attach(owner, { owner, autoLamps: !(nt.lamps && nt.lamps.length) });
      return n;
    }

    /* --- перебор времени --- */
    const rescanEvery = opts.rescan == null ? 1 : +opts.rescan;
    const RESCAN_O = { owner: scene };
    const ev = { phase: null, prev: null, hour: 0, override: null, lamps: false, night: 0 };
    function update(dt, cam) {
      if (disposed) return;
      if (cam) camera = cam;
      NS[2] = dt > 0 ? (dt > 0.25 ? 0.25 : dt) : 0; NS[0] += NS[2];
      effInto(); lookAtHB(P, tgt);
      if (first || snap) { cur.set(tgt); first = snap = false; } else { NS[3] = 1 - Math.exp(-NS[2] / TAU); blend(); }
      writeUniforms(); applyLights(); updateSkyObjects(); updateOverlays();
      if (rescanEvery > 0 && scene) { NS[1] += NS[2]; if (NS[1] >= rescanEvery) { NS[1] = 0; rescan(); } }
      effInto();
      const ph = PHASES[phaseIdx()], lo = cur[L.LAMP] > 0.5;
      if (ph !== lastPhase || lo !== lastLamps || OVR !== lastOv) fire(ph, lo);
    }
    // горячий цикл — отдельной маленькой функцией: оптимизируется сам, даже если update вдруг деоптимизирован
    function blend() { const k = NS[3]; for (let j = 0; j < L.N; j++) cur[j] += (tgt[j] - cur[j]) * k; }
    function rescan() { attach(scene, RESCAN_O); pruneLamps(); }
    function fire(ph, lo) {
      const prev = lastPhase; lastPhase = ph; lastLamps = lo; lastOv = OVR;
      if (cbs.size) { const e = { phase: ph, prev, hour: HB[0], override: OVR, lamps: lo, night: cur[L.STAR] }; cbs.forEach(cb => { try { cb(e); } catch (er) { console.warn('daynight cb', er); } }); }
    }

    const dn = {
      update, attach, attachRegion, detach, patch, addWindows, addLamp, addLamps, addHalo, addUniform,
      removeLamp: id => removeWhere(l => l.id === id),
      clearLamps: () => removeWhere(() => true),
      hour: () => effHour(), clockHour, phase: () => phaseAt(effHour()),
      set: (ov, o) => setGlobal(ov, o), override: () => OVR,
      onChange: cb => { cbs.add(cb); return () => cbs.delete(cb); },
      lampsOn: () => cur[L.LAMP] > 0.5, night: () => cur[L.STAR], glow: () => cur[L.GLOW],
      apply: name => { P = compiledPreset(resolvePreset(name)); if (P.css && skyEl && !ovNight) makeOverlays(); return P.id; },
      preset: () => P.id,
      setLights: (s, hm) => { if (s !== undefined) { sun = s; SL.sunC.ref = SL.sunI.ref = null; } if (hm !== undefined) { hemi = hm; SL.hemC.ref = SL.hemG.ref = SL.hemI.ref = null; } },
      setCamera: c => { camera = c; },
      exclude: o => { if (o && o.userData) o.userData.dn = 'none'; return o; },   // поддерево остаётся «дневным» (метки, подсказки)
      setMoon,
      setGround: fn => { groundFn = typeof fn === 'function' ? fn : null; groundOwner = null; },
      setSky: s => { if (s && s.nodeType === 1) { skyEl = s; makeOverlays(); } else if (s && s.isObject3D) { skyMesh = s; const m = s.material; if (m) patch(m, 'sky'); } },
      look: () => cur,
      info: () => ({ hour: +effHour().toFixed(3), clock: +clockHour().toFixed(3), phase: phaseAt(effHour()), override: OVR, preset: P.id, lamps: LAMPS.length, lampsOn: cur[L.LAMP] > 0.5, night: +cur[L.STAR].toFixed(3), glow: +cur[L.GLOW].toFixed(3),
        extraCalls: (stars && stars.visible ? 1 : 0) + (moon && moon.visible ? 1 : 0) + (glowPts && glowPts.visible ? 1 : 0), halos: HALOS.length, glowUniforms: GLOWU.length + UREG.length, sun: !!sun, hemi: !!hemi, sky: skyMesh ? 'mesh' : skyEl ? 'css' : 'auto' }),
      _ov: o => { if (o && o.instant) snap = true; },
      dispose() {
        if (disposed) return; disposed = true; INST.delete(dn);
        restoreSlots();
        HALOS.forEach(h => { if (h.ref) { h.mat.opacity = h.v[0]; h.mat.size = h.v[1]; } }); HALOS.length = 0;
        UREG.forEach(s => { if (s.ref) s.u.value = s.v[0]; }); UREG.length = 0;
        [stars, moon, glowPts].forEach(o => { if (o && o.parent) o.parent.remove(o); });
        if (glowPts) glowPts.geometry.dispose();
        own.forEach(x => { try { x.dispose && x.dispose(); } catch (e) { /* уже */ } });
        [ovDusk, ovNight].forEach(d => { if (d && d.parentNode) d.parentNode.removeChild(d); });
        cbs.clear();
        if (!INST.size) resetUniforms();
      },
    };
    INST.add(dn);
    if (skyMesh && skyMesh.material) patch(skyMesh.material, 'sky');
    makeSky(); makeOverlays();
    if (opts.root) attach(opts.root);
    return dn;
  }

  /* ---------- кнопка «Вернуться в утро» / «Как на часах» (для интерфейса игры) ---------- */
  const LINES = {
    nightHint: 'Стемнело — зажглись фонарики. Утро — в меню ☰',
    toMorning: 'Доброе утро! Солнышко снова встало.',
    toClock: 'Теперь время — как на часах.',
  };
  function mountToggle(host, o) {
    o = o || {};
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dn-toggle' + (o.className ? ' ' + o.className : '');
    if (!o.className) b.style.cssText = 'position:absolute;left:12px;top:calc(64px + env(safe-area-inset-top, 0px));z-index:6;border:0;border-radius:16px;padding:8px 12px;font:inherit;font-weight:900;font-size:13px;background:rgba(255,253,249,.94);color:#C2405B;box-shadow:0 3px 0 rgba(58,46,63,.14);cursor:pointer;pointer-events:auto';
    const refresh = () => {
      const ov = OVR, ph = phaseAt(clockHour());
      const show = o.always || ov !== null || ph === 'night' || ph === 'evening' || ph === 'golden';
      b.style.display = show ? '' : 'none';
      b.textContent = ov !== null ? (o.clockText || '🕗 Как на часах') : (o.morningText || '☀️ Вернуться в утро');
      b.dataset.state = ov !== null ? 'override' : 'clock';
    };
    b.addEventListener('click', e => {
      e.stopPropagation();
      const to = OVR !== null ? null : 'morning';
      setGlobal(to);
      if (o.onSet) { try { o.onSet(to, to ? LINES.toMorning : LINES.toClock); } catch (er) { /* ignore */ } }
      refresh();
    });
    (host || document.body).appendChild(b);
    const off = cb => GL.delete(cb), cb = () => refresh(); GL.add(cb);
    const iv = setInterval(refresh, 5000);   // W4A: стемнело по часам — кнопка появляется за ≤ 5 с (было 20)
    refresh();
    return { el: b, refresh, destroy() { clearInterval(iv); off(cb); if (b.parentNode) b.parentNode.removeChild(b); } };
  }

  // HUD v2: строка меню ☰ «Время суток» вместо кнопки на экране (mountToggle остаётся для стендов).
  // → объект для HUD.menu.add: значок фазы, «Вернуться в утро» / «Как на часах» (когда уместно), подпись «Сейчас вечер · 21:40».
  // o = { onSet(to, line) — после переключения (по умолчанию — тост G.toast), always — кнопка и днём }
  const PH_ICON = { morning: '🌄', day: '☀️', golden: '🌅', evening: '🌆', night: '🌙' };
  function menuItem(o) {
    o = o || {};
    const can = () => o.always || OVR !== null || ['night', 'evening', 'golden'].indexOf(phaseAt(clockHour())) >= 0;
    const now = () => `Сейчас ${PHASE_RU[phaseAt(effHour())] || 'день'} · ${label(effHour())}`;
    return {
      id: 'dn', order: 40, tint: 'sun', keepOpen: true,
      icon: () => PH_ICON[phaseAt(effHour())] || '☀️',
      label: () => (!can() ? 'Время суток' : OVR !== null ? (o.clockText || 'Как на часах') : (o.morningText || 'Вернуться в утро')),
      sub: now,
      onTap: () => {
        if (!can()) { try { if (window.G) G.toast(now(), 1800, { replace: true }); } catch (e) { /* ignore */ } return; }
        const to = OVR !== null ? null : 'morning';
        setGlobal(to);
        const line = to ? LINES.toMorning : LINES.toClock;
        if (o.onSet) { try { o.onSet(to, line); } catch (er) { /* ignore */ } } else { try { if (window.G) G.toast(line, 2400); } catch (e) { /* ignore */ } }
      },
    };
  }

  window.DayNight = {
    __v: 1, create, phaseAt, label, clockHour, PHASES, PHASE_RU, PHASE_HOUR, PRESETS, LINES, mountToggle, menuItem,
    hour: effHour, phase: () => phaseAt(effHour()),
    set: (ov, o) => setGlobal(ov, o), override: () => OVR,
    onChange: cb => { GL.add(cb); return () => GL.delete(cb); },
    setClock: fn => { clockFn = typeof fn === 'function' ? fn : null; },
    lookAt: (h, preset) => Array.from(lookAt(h, compiledPreset(resolvePreset(preset || 'village')), new Float32Array(L.N))),
    LOOK: L, uniforms: { world: UW, actor: UA, sky: US, extra: UX },
  };
})();
