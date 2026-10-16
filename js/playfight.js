/* =====================================================================
   ПОНАРОШКУ: мультяшная возня героини с жителями («бить других персонажей», как в детском мультике).
   Никакого вреда: ни здоровья, ни нокаутов, ни страха. Толкнуть ладошкой, «бамс» с разворота, «финальный хлоп»
   с подскоком; пищащий молоточек из «Юлы» — «пиу!»; руки заняты — «бум» бедром. Житель кувыркается, над головой
   звёздочки и птички (1,5 с), облачко «Ой!», встаёт и отряхивается, а дальше — по характеру: дуется понарошку
   («Так нечестно!»), смеётся («Ха-ха, ещё!») или догоняет («Ну держись!» — догнал: оба падают от смеха).
   Третий раз за 30 с — «Всё-всё, сдаюсь!» с белым платочком, минуту держится на вежливом расстоянии.
   «Лежачего не бьют»: серия — не больше трёх тапов; пока житель лежит, дуется, догоняет, сдаётся или кланяется, он не цель
   (кнопка прячется), частые тапы не превращаются в бесконечную серию.
   Зверят (собачка-компаньон, кошки, утки, мелочь) НИКОГДА не бьют: кнопка становится «Бупнуть» — буп в носик,
   зверёк радостно виляет, сердечко. Осенью — охапка листьев, зимой — снежки и «снежная битва» на счёт (3+ жителя рядом).
   Пальтары (ряженые на свадьбе) возятся понарошку: прыгают вокруг, кувыркаются с размахом и кланяются.

   Ванильный JS, Three.js r149, без сети и файлов: всё — кодом (сетки, канва-текстуры, звуки WebAudio).
   Позы героини — слой ПОСЛЕ HeroAnim.update (и после Interact.update): кости, которые поставил anim, поправляются
   поверх (как js/interact.js); если игра пропустила anim.update, слой это замечает и не копит позу.
   Реакции жителя — временная «прослойка» (Group) между корнем жителя и его детьми: корень (им владеет игра — жизнь
   города, регион) не трогается вовсе; после реакции дети возвращаются на корень в том же порядке, прослойка удаляется.
   Бюджет: без возни слой не рисует ничего (0 вызовов); на пике возни ≤ 6 вызовов отрисовки — все звёздочки, сердечки,
   пух и звукоподражания идут двумя пачками из одного атласа, птички — двумя пачками инстансов, снежки и шлепки — по одной
   (облачка реплик рисует say игры). В кадре слой не создаёт объектов, массивов и замыканий (всё — заранее).

   PlayFight.create({ THREE, scene, camera, hero, anim, getNpcs, isPet, canTarget, moveNpc, season, say, sfx, buttonsHost,
                      // необязательно:
                      interact, setYaw, moveHero, ground, isPaltar, persona, gradientMap, seed, on, slots, keys })
       -> api | null (нет THREE / scene / hero)
     hero        — корень героини в мире (Object3D) или { root } (W.hero города);
     anim        — HeroAnim.create(...) (кости anim.bones); без него — без поз (статуэтка), реакции жителей всё равно есть;
     getNpcs()   — массив жителей рядом: { root, id?, speaker?, x?, z?, headY?, r?, faceHero?, I?, pfBody? } (формат life.npcs / h.npcs);
                   pfBody — у зверят одной сеткой со скелетом (свадьба): узел-«тело», которым владеет только этот слой
                   (пустая кость между корнем и телом); реакция пишется в него и в конце возвращается (headY — в метрах мира);
     isPet(n)    — зверёк (только «Бупнуть»); по умолчанию PlayFight.isPetDefault (c.pet, c.small, собачки, кошки, утки…);
     canTarget(n)— можно ли сейчас трогать (не в диалоге, не в задании, не за прилавком); по умолчанию — да;
     moveNpc(n, dx, dz) — сдвинуть жителя (отлёт при кувырке, догонялки, «вежливое расстояние»); столкновения и высоту
                   земли решает игра; по умолчанию: n.x/n.z (если есть) и root.position;
     season()    — 'autumn' (листья) | 'winter' (снежки) | другое (без броска);
     say(n, text, speaker) — облачко + голос (life.say / облачко региона); по умолчанию — своё облачко-спрайт;
     sfx(name)   — 'bonk' 'slap' 'whoosh' 'squeak' 'piu' 'boop' 'thud' 'tweet' 'pop' 'splat' 'leaves' 'throw' 'jingle';
                   по умолчанию PlayFight.synth (WebAudio в шину G.audioBus('sfx'), если звук включён; иначе тишина);
     buttonsHost — куда положить кнопки «Бум!» и «Листья»/«Снежок» (и табло битвы). По умолчанию — столбик справа НАД
                   рядом «Прыжок»/«Бег» (Move.mountButtons: right 14, bottom 150, высота 80): «Бум!» right 23 / bottom 242,
                   бросок — bottom 316 (62 px, зазоры 12 px). Так они не задевают ни 👋 и «действие» города (.w-wave, .w-act),
                   ни второе действие региона (.wr-act2, bottom 84), ни ряд Move. slots — свои места; .pf-inline у хозяина —
                   кнопки встают в его поток;
     interact    — слой Interact героини: занят — не начинать; молоточек в левой руке (IA.give) — режим «Пиу!»;
     setYaw(yaw) — повернуть героиню (игра пишет свой угол: s.ang); по умолчанию hero.rotation.y;
     moveHero(dx, dz) — шажок к жителю (игра: s.px/s.pz + столкновения); по умолчанию hero.position;
     ground(x, z)— высота земли (листья, снежки ложатся на неё); по умолчанию — высота корня героини;
     on(name, data) — события: hit, boop, tumble, react, surrender, chase, caught, giveup, toss, snowHit, heroHit,
                   battle, spar, bow, restore, miss.
   api:
     update(dt)  — раз в кадр ПОСЛЕ anim.update / IA.update и после того, как игра поставила корни жителей и героини
                   (и камеру: пачки спрайтов разворачиваются к камере по мировому повороту камеры);
     bonk()      — кнопка «Бум!» (тапы подряд — серия: толчок → «бамс» с разворота → «хлоп» с подскоком);
     toss()      — кнопка «Листья» / «Снежок» (3+ жителя рядом зимой — снежная битва 45 с);
     active()    — героиня занята возней (игре: не двигать героиню джойстиком, не начинать другие действия);
     animState(s)— ПЕРЕД anim.update: на время возни idle/waving/sniff выключены, сидя на земле — speed 0;
     dispose()   — вернуть всё как было (позы, прослойки жителей, эффекты, кнопки, геометрия, текстуры).
     enable(on)  — false (машина, велосипед, комната, диалог, лестница): кнопки прячутся, действие героини снимается сразу
                   (поза отдана HeroAnim), снежная битва заканчивается «все смеются», пальтар кланяется, догонялки — «Уф!»;
     Ещё: target(), giveHammer(), dropHammer(), hasHammer(), battle(), spar(), isReacting(n), isDown(n) (лежит/дуется/догоняет —
          не цель), surrendered(n), state(), _dbg.
   PlayFight.makeHammer(THREE, gradientMap) -> Mesh «squeaky_hammer» (одна сетка, контур в ней же);
   PlayFight.hammerItem(THREE, Interact, gradientMap) — он же, обёрнутый Interact.items.wrap с хватом HAMMER_HOLD;
   PlayFight.synth(name) — звуки по умолчанию; PlayFight.isPetDefault(n); PlayFight.PERSONA — характеры по speaker.
   Реплики — js/playfight_lines.js (window.PlayFightLines, { who, text } для озвучки).
   ===================================================================== */
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2, D = PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const win = (u, a, b, c, d) => sst(a, b, u) * (1 - sst(c, d, u));    // окно: нарастает a→b, спадает c→d
  const bump = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  const angW = a => a - TAU * Math.round(a / TAU);
  const easeOut = u => 1 - (1 - u) * (1 - u);
  const easeIn = u => u * u;
  const easeInOut = u => u * u * (3 - 2 * u);
  const backOut = u => { const s = 1.9, v = u - 1; return v * v * ((s + 1) * v + s) + 1; };
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------------
     ХАРАКТЕРЫ (по speaker / id жителя). react — из чего выбирать после возни; speed — бег в догонялках (м/с);
     curl — ёжик сворачивается клубком и катится; gentle — бабушки и тётушки не падают, только качаются;
     soft — пушистые (кувырок мягче, отскок больше); throwsBack — как часто кидает снежок/листья в ответ.
     --------------------------------------------------------------------- */
  const PERSONA = {
    raccoon: { react: ['laugh', 'chase'], speed: 2.5, throwsBack: 0.6 },
    sheep: { react: ['laugh', 'laugh', 'pout'], soft: true, speed: 2.2, throwsBack: 0.4 },
    bunny: { react: ['chase', 'laugh'], speed: 2.8, throwsBack: 0.6 },
    goose: { react: ['chase', 'pout'], speed: 2.6, throwsBack: 0.7 },
    hedgehog: { react: ['pout', 'laugh'], curl: true, speed: 2.0, throwsBack: 0.4 },
    fox: { react: ['pout', 'chase', 'laugh'], speed: 2.7, throwsBack: 0.5 },
    badger: { react: ['laugh', 'pout'], speed: 2.1, throwsBack: 0.5 },
    owl_keeper: { react: ['pout', 'laugh'], speed: 2.0, throwsBack: 0.3 },
    mtn_sheep: { react: ['laugh', 'chase'], soft: true, speed: 2.4, throwsBack: 0.5 },
    baker_bunny: { react: ['chase', 'laugh'], speed: 2.7, throwsBack: 0.6 },
    spring_hedgehog: { react: ['laugh', 'chase'], curl: true, speed: 2.1, throwsBack: 0.5 },
    mouse: { react: ['laugh', 'pout', 'chase'], speed: 2.3, throwsBack: 0.5 },
    granny_hedgehog: { react: ['laugh'], gentle: true, throwsBack: 0.2 },
    wed_aunt: { react: ['laugh'], gentle: true, throwsBack: 0.3 },
    paltar: { spar: true, throwsBack: 0.8 },
    _default: { react: ['laugh', 'pout', 'chase'], speed: 2.4, throwsBack: 0.5 },
  };
  // зверята: бупают, не бьют (собачки, кошки, утки, капибара, мыши-трио, ёжик с листьями, голуби, лошадка, коровы)
  const PET_RE = /^(dog_|cat_|ducks?$|ducklings$|mice$|capybara$|hedgehog_leaf$|roof_cat$|pony$|cow\d*$|pigeon|poodle$|eagle$|wed_kid$|companion)/;
  function isPetDefault(n) {
    if (!n) return false;
    if (n.pet === true || n.isPet === true) return true;
    if (n.pet === false) return false;
    const c = n.c || {};
    if (c.pet || c.small || n.small) return true;
    if (/^(dog|cat|capy|ducks|mice|hedge)$/.test(String(c.beh || ''))) return true;
    return PET_RE.test(String(n.speaker || n.voice || n.id || ''));
  }
  const isPaltarDefault = n => !!n && (n.paltar === true || n.speaker === 'paltar' || /^paltar/.test(String(n.id || '')));
  const GENERIC = { oops: ['Ой!', 'Эй!'], pout: ['Так нечестно!'], laugh: ['Ха-ха, ещё!'], chase: ['Ну держись!'], caught: ['Попалась! Ха-ха!'],
    giveup: ['Уф! Ты быстрая!'], surrender: ['Всё-всё, сдаюсь!'], sneeze: ['Апчхи!'], snow: ['Ай, холодно! Ха-ха!'], throw: ['Лови!'], boop: ['!'],
    curl: ['Фух!'], spar: ['Ну-ка, кто кого?'], tumble: ['Уа-а-а!'], bow: ['Ловко! Кланяюсь!'], champion: ['Сдаюсь! Ты — чемпионка!'] };

  /* ---------------------------------------------------------------------
     СЕТКИ: детали с цветом в вершинах → одна геометрия (+ вывернутая тёмная оболочка-контур, как предметы Interact)
     --------------------------------------------------------------------- */
  const OL = [0x4A / 255, 0x3A / 255, 0x48 / 255];
  function mergeParts(T, parts, olT) {
    const pos = [], nor = [], col = [];
    const nm = new T.Matrix3(), c = new T.Color(), v = new T.Vector3(), n = new T.Vector3();
    const push = (g, m, rgb, shell) => {
      const src = g.index ? g.toNonIndexed() : g;
      const P = src.attributes.position, N = src.attributes.normal;
      nm.getNormalMatrix(m);
      const cnt = P.count;
      for (let i = 0; i < cnt; i += 3) {
        const order = shell ? [0, 2, 1] : [0, 1, 2];
        for (let k = 0; k < 3; k++) {
          const j = i + order[k];
          v.fromBufferAttribute(P, j).applyMatrix4(m); n.fromBufferAttribute(N, j).applyMatrix3(nm).normalize();
          if (shell) { v.addScaledVector(n, shell); n.negate(); }
          pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(rgb[0], rgb[1], rgb[2]);
        }
      }
      if (src !== g) src.dispose();
    };
    parts.forEach(p => { c.set(p.c); push(p.g, p.m, [c.r, c.g, c.b], 0); });
    if (olT) parts.forEach(p => { if (p.ol !== false) push(p.g, p.m, OL, p.olT || olT); });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    parts.forEach(p => { if (p.own) p.g.dispose(); });
    return g;
  }
  function m4(T, p, r, s) {
    const M = new T.Matrix4(), q = new T.Quaternion();
    if (r) q.setFromEuler(new T.Euler(r[0] || 0, r[1] || 0, r[2] || 0));
    return M.compose(new T.Vector3(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), q, new T.Vector3(s ? s[0] : 1, s ? (s[1] === undefined ? s[0] : s[1]) : 1, s ? (s[2] === undefined ? s[0] : s[2]) : 1));
  }
  let defGrad = null;
  function gradOf(T, g) {
    if (g) return g;
    if (!defGrad || defGrad.__T !== T) {
      const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 245, 245, 245, 255, 255, 255, 255, 255]);
      defGrad = new T.DataTexture(d, 4, 1, T.RGBAFormat); defGrad.minFilter = defGrad.magFilter = T.NearestFilter; defGrad.generateMipmaps = false; defGrad.needsUpdate = true; defGrad.__T = T;
    }
    return defGrad;
  }

  /* ---------------------------------------------------------------------
     ПИЩАЩИЙ МОЛОТОЧЕК (игрушка из «Юлы»): мятная ручка, розовая «гармошка»-головка с жёлтыми торцами, звёздочка.
     Оси «в руке» (как у предметов Interact): +y — вверх (большой палец, вдоль ручки), +z — вперёд (пальцы);
     начало — центр кулака на ручке. Головка — поперёк ручки, вдоль z (в плоскости замаха).
     --------------------------------------------------------------------- */
  const HAMMER_HOLD = { in: 0, up: 0, fwd: 0, rot: [0, 0, 0] };
  const HAMMER_HEAD = [0, 0.19, 0];       // центр головки (оси предмета)
  function makeHammer(T, gradientMap) {
    const P = [];
    const cyl = (c, rt, rb, h, p, r, seg) => P.push({ g: new T.CylinderGeometry(rt, rb, h, seg || 14), c, m: m4(T, p, r), own: true });
    const sph = (c, p, s, ol) => P.push({ g: new T.SphereGeometry(1, 12, 9), c, m: m4(T, p, null, s), own: true, ol });
    const tor = (c, R, rr, p, r) => P.push({ g: new T.TorusGeometry(R, rr, 6, 18), c, m: m4(T, p, r), own: true, ol: false });
    // ручка
    cyl('#8ED3E6', 0.0115, 0.0125, 0.2, [0, 0.07, 0], null, 10);
    cyl('#F6A6C0', 0.0135, 0.0135, 0.05, [0, -0.005, 0], null, 10);         // мягкая розовая обмотка под кулак
    sph('#FFF6EE', [0, -0.035, 0], [0.016, 0.016, 0.016]);                    // шарик на конце
    // головка: розовая середина, «гармошка» и жёлтые торцы вдоль z
    cyl('#F2667F', 0.045, 0.045, 0.07, [0, HAMMER_HEAD[1], 0], [PI / 2, 0, 0], 16);
    [-1, 1].forEach(s => {
      tor('#D94E6A', 0.046, 0.006, [0, HAMMER_HEAD[1], s * 0.022], null);
      cyl('#FFD166', 0.05, 0.043, 0.026, [0, HAMMER_HEAD[1], s * 0.047], [PI / 2, 0, 0], 16);
      tor('#F2B84B', 0.047, 0.005, [0, HAMMER_HEAD[1], s * 0.052], null);
      cyl('#FFE29A', 0.038, 0.038, 0.004, [0, HAMMER_HEAD[1], s * 0.061], [PI / 2, 0, 0], 16);
    });
    // звёздочка-наклейка сбоку (белая) и блик
    sph('#FFFFFF', [0.044, HAMMER_HEAD[1] + 0.008, 0], [0.004, 0.014, 0.014], false);
    sph('#FFFFFF', [0.03, HAMMER_HEAD[1] + 0.03, -0.012], [0.006, 0.004, 0.012], false);
    const g = mergeParts(T, P, 0.0028);
    const mat = new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: gradOf(T, gradientMap) });
    const m = new T.Mesh(g, mat);
    m.name = 'squeaky_hammer'; m.castShadow = true;
    m.userData.pfHammer = true;
    m.userData.pfDispose = () => { if (m.parent) m.parent.remove(m); g.dispose(); mat.dispose(); };
    return m;
  }
  function hammerItem(T, Interact, gradientMap) {
    const m = makeHammer(T, gradientMap);
    if (Interact && Interact.items && Interact.items.wrap) {
      Interact.items.wrap(m, HAMMER_HOLD);
      const it = m.userData.it; if (it) { it.name = 'squeaky_hammer'; const d0 = it.dispose; it.dispose = () => { d0 && d0(); m.userData.pfDispose(); }; it.def.bottom = -0.05; }
    }
    return m;
  }

  /* ---------------------------------------------------------------------
     ЗВУКИ ПО УМОЛЧАНИЮ: мягкие, синтез WebAudio в шину эффектов игры (G.audioBus('sfx')); звук выключен — тишина
     --------------------------------------------------------------------- */
  const lastS = {};
  let noiseB = null;
  function synth(name) {
    const G = window.G;
    if (!G || typeof G.audioBus !== 'function') return false;
    let out = null; try { out = G.audioBus('sfx'); } catch (e) { out = null; }
    if (!out || !out.context) return false;
    const a = out.context, t = a.currentTime + 0.005;
    if (lastS[name] && t - lastS[name] < 0.05) return false;
    lastS[name] = t;
    const tone = (type, f0, f1, dt, dur, vol, att) => {
      const s = a.createOscillator(), g = a.createGain(), t0 = t + dt; att = att || 0.006;
      s.type = type; s.frequency.setValueAtTime(f0, t0); s.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dur);
      s.connect(g); g.connect(out); s.start(t0); s.stop(t0 + att + dur + 0.05);
    };
    const noise = (dt, dur, vol, type, f0, f1, q) => {
      if (!noiseB || noiseB.sampleRate !== a.sampleRate) { noiseB = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t0 = t + dt;
      s.buffer = noiseB; f.type = type; f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q || 1;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.04, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    };
    const S = {
      bonk: () => { tone('sine', 190, 85, 0, 0.16, 0.09); noise(0, 0.07, 0.03, 'lowpass', 700); },          // мягкое «бум»
      slap: () => { noise(0, 0.08, 0.06, 'bandpass', 1600, 900, 0.9); tone('sine', 230, 120, 0, 0.12, 0.06); },   // «хлоп»
      whoosh: () => noise(0, 0.26, 0.035, 'bandpass', 420, 1700, 1.4),
      throw: () => noise(0, 0.16, 0.03, 'bandpass', 700, 2000, 1.6),
      squeak: () => { tone('triangle', 980, 1500, 0, 0.07, 0.05); tone('triangle', 1500, 760, 0.07, 0.1, 0.045); },
      piu: () => { tone('triangle', 1450, 520, 0, 0.2, 0.05); tone('sine', 2900, 1040, 0, 0.18, 0.015); },     // «пиу!»
      boop: () => tone('sine', 640, 1000, 0, 0.08, 0.05),
      thud: () => { tone('sine', 120, 60, 0, 0.18, 0.08); noise(0, 0.1, 0.02, 'lowpass', 400); },
      tweet: () => { [0, 0.11, 0.2].forEach((d, i) => tone('sine', 2300 + i * 260, 2900 + i * 180, d, 0.06, 0.018)); },
      pop: () => tone('sine', 480, 820, 0, 0.06, 0.035),
      splat: () => { noise(0, 0.14, 0.05, 'lowpass', 1200, 300); tone('sine', 150, 90, 0, 0.1, 0.03); },
      leaves: () => { for (let i = 0; i < 5; i++) noise(i * 0.05, 0.06, 0.02, 'bandpass', 2400 + (i % 2) * 700, null, 2.2); },
      jingle: () => { [1568, 2093, 1760].forEach((f, i) => { tone('sine', f, f, i * 0.06, 0.4, 0.02); tone('sine', f * 2.76, f * 2.76, i * 0.06, 0.15, 0.006); }); },
    };
    try { (S[name] || S.pop)(); } catch (e) { /* звук не главное */ }
    return true;
  }

  /* ---------------------------------------------------------------------
     КАНВА-ТЕКСТУРЫ: звёздочка, сердечко, «пух», звукоподражания («Бамс!»), облачко реплики
     --------------------------------------------------------------------- */
  const FONT = '"Nunito", "Comfortaa", system-ui, -apple-system, "Segoe UI", sans-serif';
  function canvasTex(T, w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); draw(cx, w, h);
    const tx = new T.CanvasTexture(cv); tx.minFilter = T.LinearFilter; tx.generateMipmaps = false; tx.needsUpdate = true;
    tx.userData.aspect = w / h;
    return tx;
  }
  const starPath = (cx, x, y, R, r, n) => { cx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, rr = i % 2 ? r : R; cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } cx.closePath(); };
  const heartPath = (cx, x, y, s) => { cx.beginPath(); cx.moveTo(x, y + s * 0.9); cx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.45); cx.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); cx.closePath(); };
  function rrect(cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

  /* =====================================================================
     СЛОЙ
     ===================================================================== */
  function create(o) {
    o = o || {};
    const T = o.THREE || window.THREE;
    const heroRoot = o.hero && (o.hero.isObject3D ? o.hero : o.hero.root);
    if (!T || !o.scene || !heroRoot || typeof document === 'undefined') return null;
    const scene = o.scene, anim = o.anim && o.anim.bones ? o.anim : null, B = anim ? anim.bones : null;
    const model = B ? B.hips.parent : null;
    const getNpcs = typeof o.getNpcs === 'function' ? o.getNpcs : () => [];
    const isPet = typeof o.isPet === 'function' ? o.isPet : isPetDefault;
    const isPaltar = typeof o.isPaltar === 'function' ? o.isPaltar : isPaltarDefault;
    const canTarget = typeof o.canTarget === 'function' ? o.canTarget : () => true;
    const season = typeof o.season === 'function' ? o.season : () => (o.season || 'autumn');
    const IA = o.interact || null;
    const rand = rng(o.seed !== undefined ? o.seed : (Date.now() ^ 0x5F3759DF));
    const pick = arr => arr[Math.floor(rand() * arr.length) % arr.length];
    const emit = (name, data) => { try { if (o.on) o.on(name, data || {}); } catch (e) { /* чужая ошибка */ } };
    const sfx = name => { try { if (typeof o.sfx === 'function') o.sfx(name); else synth(name); } catch (e) { /* звук не главное */ } };
    const grad = gradOf(T, o.gradientMap);
    const V = () => new T.Vector3(), Q = () => new T.Quaternion();
    const UP = new T.Vector3(0, 1, 0), IDQ = new T.Quaternion();
    const RANGE = 1.6, TOSS_RANGE = 9;
    let now = 0, enabled = true, disposed = false;

    /* ---------- что выделили: вернуть в dispose ---------- */
    const GEO = [], MAT = [], TEX = [];
    const keepG = g => (GEO.push(g), g), keepM = m => (MAT.push(m), m), keepT = t => (TEX.push(t), t);
    const fxRoot = new T.Group(); fxRoot.name = 'playfight:fx'; scene.add(fxRoot);
    const toonM = (c, extra) => keepM(new T.MeshToonMaterial(Object.assign({ color: new T.Color(c), gradientMap: grad }, extra || {})));
    const vtxM = keepM(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: grad }));

    /* ---------- атлас: значки (звёздочка, сердечко, пух, снежинка) и звукоподражания («Бамс!») — ОДНА текстура.
       Все спрайты-эффекты рисуются двумя пачками (с глубиной и поверх всего): 2 вызова отрисовки на любое их число.
       Полки слева направо; известные звукоподражания рисуются заранее (одна загрузка текстуры), новые — по мере надобности. --- */
    const ATL = (() => {
      const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const tex = keepT(new T.CanvasTexture(cv)); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
      return { W, H, cv, cx: cv.getContext('2d'), tex, sx: 0, sy: 0, sh: 0, warm: false };
    })();
    function atlasDraw(w, h, draw) {
      w = Math.ceil(w); h = Math.ceil(h);
      if (ATL.sx + w > ATL.W) { ATL.sy += ATL.sh + 2; ATL.sx = 0; ATL.sh = 0; }
      if (ATL.sy + h > ATL.H || w > ATL.W) return null;                  // места нет — вызывающий возьмёт свою текстуру
      const x = ATL.sx, y = ATL.sy; ATL.sx += w + 2; ATL.sh = Math.max(ATL.sh, h);
      const c = ATL.cx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); draw(c, w, h); c.restore();
      ATL.tex.needsUpdate = true;
      return { atlas: true, u0: (x + 0.5) / ATL.W, u1: (x + w - 0.5) / ATL.W, v0: 1 - (y + h - 0.5) / ATL.H, v1: 1 - (y + 0.5) / ATL.H, userData: { aspect: w / h } };
    }
    const TX = {};
    TX.star = atlasDraw(64, 64, c => {
      starPath(c, 32, 34, 28, 12, 5); c.fillStyle = '#FFD54A'; c.fill(); c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#E8962E'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(25, 26, 5, 3.5, -0.6, 0, TAU); c.fill();
    });
    TX.heart = atlasDraw(64, 64, c => {
      heartPath(c, 32, 34, 20); c.fillStyle = '#FF86A8'; c.fill(); c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#E0507A'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(22, 24, 5, 3, -0.7, 0, TAU); c.fill();
    });
    TX.puff = atlasDraw(64, 64, c => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(32, 32, 30, 0, TAU); c.fill();
    });
    TX.flake = atlasDraw(64, 64, c => {
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 5; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = i * PI / 3; c.beginPath(); c.moveTo(32 - Math.cos(a) * 24, 32 - Math.sin(a) * 24); c.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); c.stroke(); }
    });
    const textCache = new Map();
    let measureCx = null;
    // звукоподражание: толстые буквы с тёмной обводкой и жёлто-персиковой заливкой (как в комиксе); в атлас (¾ от 112 px)
    function popTex(text, col) {
      const k = 'p|' + text + '|' + (col || ''); if (textCache.has(k)) return textCache.get(k);
      if (!measureCx) measureCx = document.createElement('canvas').getContext('2d');
      measureCx.font = '900 72px ' + FONT;
      const w = Math.ceil(measureCx.measureText(text).width) + 56, h = 112;
      const paint = (c) => {
        c.font = '900 72px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
        c.lineWidth = 16; c.strokeStyle = '#4A3A48'; c.strokeText(text, w / 2, h / 2 + 4);
        const g = c.createLinearGradient(0, 18, 0, h - 18);
        const cs = col === 'pink' ? ['#FFE1EC', '#FF8FB1'] : col === 'blue' ? ['#F2FBFF', '#9AD3F2'] : col === 'green' ? ['#F1FFD8', '#A9DB6A'] : ['#FFF3A6', '#FFA45A'];
        g.addColorStop(0, cs[0]); g.addColorStop(1, cs[1]); c.fillStyle = g; c.fillText(text, w / 2, h / 2 + 4);
        c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.7)'; c.strokeText(text, w / 2, h / 2 + 2);
      };
      const K = 0.75;
      let tx = atlasDraw(w * K, h * K, c => { c.scale(K, K); paint(c); });
      if (!tx) tx = keepT(canvasTex(T, w, h, paint));                  // атлас полон (необычный текст) — своя текстура
      textCache.set(k, tx); return tx;
    }
    // все звукоподражания слоя — заранее, когда шрифт уже загружен (иначе первый «Бамс!» перезагружал бы атлас посреди возни)
    const POPS = [['Толк!'], ['Бамс!'], ['Хлоп!'], ['Бух!'], ['Пиу!'], ['Пиу-пиу!'], ['ПИИУ!'], ['Бум!'], ['Бум-бум!'], ['Бу-бух!'], ['!'],
      ['Буп!', 'pink'], ['ха-ха!', 'pink'], ['ха-ха-ха!', 'pink'], ['Шурх!', 'green'], ['Апчхи!', 'green'], ['Хоп!', 'blue'], ['Плюх!', 'blue']];
    function warmAtlas(force) {
      if (ATL.warm) return;
      let ready = true; try { ready = !document.fonts || document.fonts.status === 'loaded' || document.fonts.check('900 72px ' + FONT); } catch (e) { ready = true; }
      if (!ready && !force) return;
      ATL.warm = true; POPS.forEach(p => popTex(p[0], p[1]));
    }
    warmAtlas(false);
    // облачко реплики (своё — если игра не дала say): своя текстура (многострочное, редко)
    function bubbleTex(text) {
      const k = 'b|' + text; if (textCache.has(k)) return textCache.get(k);
      const font = '800 40px ' + FONT, m = document.createElement('canvas').getContext('2d'); m.font = font;
      const words = text.split(' '), lines = []; let cur = '';
      words.forEach(wd => { const t2 = cur ? cur + ' ' + wd : wd; if (m.measureText(t2).width > 420 && cur) { lines.push(cur); cur = wd; } else cur = t2; });
      if (cur) lines.push(cur);
      const tw = Math.max(...lines.map(l => m.measureText(l).width)), w = Math.ceil(tw) + 56, h = lines.length * 50 + 44 + 22;
      const tx = keepT(canvasTex(T, w, h, (c) => {
        c.lineJoin = 'round'; rrect(c, 5, 5, w - 10, h - 32, 26); c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#4A3A48'; c.stroke();
        c.beginPath(); c.moveTo(w / 2 - 16, h - 29); c.lineTo(w / 2, h - 6); c.lineTo(w / 2 + 14, h - 29); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#FFFFFF'; c.fillRect(w / 2 - 13, h - 34, 25, 8);
        c.font = font; c.fillStyle = '#3A2E3F'; c.textAlign = 'center'; c.textBaseline = 'middle';
        lines.forEach((l, i) => c.fillText(l, w / 2, 5 + 22 + 25 + i * 50 - 2));
      }));
      tx.userData.lines = lines.length;
      textCache.set(k, tx); return tx;
    }

    /* ---------- спрайты (общий пул): из атласа — «виртуальные» (рисуются пачкой), облачка — настоящие Sprite ---------- */
    const sprites = [];
    const QN = 128;              // четырёхугольников в пачке
    function mkBatch(top) {
      const g = keepG(new T.BufferGeometry());
      const idx = new Uint16Array(QN * 6);
      for (let i = 0; i < QN; i++) { const a = i * 4, j = i * 6; idx[j] = a; idx[j + 1] = a + 1; idx[j + 2] = a + 2; idx[j + 3] = a; idx[j + 4] = a + 2; idx[j + 5] = a + 3; }
      const P = new T.BufferAttribute(new Float32Array(QN * 12), 3), U = new T.BufferAttribute(new Float32Array(QN * 8), 2), Cl = new T.BufferAttribute(new Float32Array(QN * 16), 4);
      P.setUsage(T.DynamicDrawUsage); U.setUsage(T.DynamicDrawUsage); Cl.setUsage(T.DynamicDrawUsage);
      g.setAttribute('position', P); g.setAttribute('uv', U); g.setAttribute('color', Cl); g.setIndex(new T.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
      const m = keepM(new T.MeshBasicMaterial({ map: ATL.tex, vertexColors: true, transparent: true, depthWrite: false, depthTest: !top }));
      const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = top ? 20 : 2; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = false;
      mesh.name = 'playfight:sprites-' + (top ? 'top' : 'depth'); mesh.raycast = () => {};
      fxRoot.add(mesh);
      return { mesh, g, P, U, Cl, n: 0 };
    }
    const BD = mkBatch(false), BT = mkBatch(true);
    function spr(tex, o2) {
      const vs = !!(tex && tex.atlas);
      let s = null;
      for (let i = 0; i < sprites.length; i++) if (!sprites[i].userData.live && !!sprites[i].isVS === vs) { s = sprites[i]; break; }
      if (!s) {
        if (vs) s = { isVS: true, e: null, top: false, visible: false, position: V(), scale: V(), material: { opacity: 1, rotation: 0, color: new T.Color(1, 1, 1) }, userData: {} };
        else { s = new T.Sprite(keepM(new T.SpriteMaterial({ transparent: true, depthWrite: false }))); s.userData = {}; fxRoot.add(s); }
        sprites.push(s);
      }
      const m = s.material;
      if (vs) { s.e = tex; s.top = !!(o2 && o2.top); }
      else { if (m.map !== tex) { m.map = tex; m.needsUpdate = true; } m.depthTest = !(o2 && o2.top); s.renderOrder = o2 && o2.top ? 20 : 2; }
      m.color.set(o2 && o2.color !== undefined ? o2.color : 0xFFFFFF); m.opacity = 1; m.rotation = (o2 && o2.rot) || 0;
      s.visible = true; s.userData.live = true; s.scale.set(0.1, 0.1, 0.1);
      return s;
    }
    const sprFree = s => { if (!s) return; s.visible = false; s.userData.live = false; };
    // пачки: четырёхугольники лицом к камере (как Sprite: масштаб в метрах, поворот в плоскости экрана)
    const bR = V(), bU = V(), bQ = Q();
    function fillSprites() {
      if (o.camera && o.camera.isObject3D) { o.camera.getWorldQuaternion(bQ); bR.set(1, 0, 0).applyQuaternion(bQ); bU.set(0, 1, 0).applyQuaternion(bQ); } else { bR.set(1, 0, 0); bU.set(0, 1, 0); }
      const nd0 = BD.n, nt0 = BT.n; BD.n = 0; BT.n = 0;
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i]; if (!s.isVS || !s.userData.live || !s.visible) continue;
        const b = s.top ? BT : BD; if (b.n >= QN) continue;
        const k = b.n++, e = s.e, m = s.material, p = s.position, hx = s.scale.x * 0.5, hy = s.scale.y * 0.5, cr = Math.cos(m.rotation), sr = Math.sin(m.rotation);
        const pa = b.P.array, ua = b.U.array, ca = b.Cl.array;
        for (let c = 0; c < 4; c++) {
          const x = c === 1 || c === 2 ? hx : -hx, y = c >= 2 ? hy : -hy, rx = cr * x - sr * y, ry = sr * x + cr * y, j = k * 12 + c * 3, q = k * 8 + c * 2, w = k * 16 + c * 4;
          pa[j] = p.x + bR.x * rx + bU.x * ry; pa[j + 1] = p.y + bR.y * rx + bU.y * ry; pa[j + 2] = p.z + bR.z * rx + bU.z * ry;
          ua[q] = c === 1 || c === 2 ? e.u1 : e.u0; ua[q + 1] = c >= 2 ? e.v1 : e.v0;
          ca[w] = m.color.r; ca[w + 1] = m.color.g; ca[w + 2] = m.color.b; ca[w + 3] = m.opacity;
        }
      }
      for (let i = 0; i < 2; i++) {
        const b = i ? BT : BD, was = i ? nt0 : nd0;
        b.mesh.visible = b.n > 0;
        if (!b.n && !was) continue;
        b.g.setDrawRange(0, b.n * 6);
        if (b.n) {
          b.P.updateRange.offset = 0; b.P.updateRange.count = b.n * 12; b.P.needsUpdate = true;
          b.U.updateRange.offset = 0; b.U.updateRange.count = b.n * 8; b.U.needsUpdate = true;
          b.Cl.updateRange.offset = 0; b.Cl.updateRange.count = b.n * 16; b.Cl.needsUpdate = true;
        }
      }
    }

    /* ---------- эффекты: список «живых» с update(dt) → false, когда кончились ---------- */
    const FX = [];
    const fx = e => { e.t = 0; FX.push(e); return e; };
    const tmpA = V(), tmpB = V(), tmpC = V(), tmpD = V(), tmpQ = Q();

    // звукоподражание у точки: выскакивает, подрастает и тает
    function popText(text, at, o2) {
      const tex = popTex(text, o2 && o2.col), s = spr(tex, { top: true, rot: (rand() - 0.5) * 0.35 });
      const H = (o2 && o2.h) || 0.26, asp = tex.userData.aspect, p0 = at.clone(), up = (o2 && o2.up) || 0.32;
      return fx({ dur: (o2 && o2.dur) || 0.85, upd(e) {
        const u = e.t / e.dur, k = u < 0.2 ? backOut(u / 0.2) : 1;
        s.scale.set(H * asp * k, H * k, 1); s.position.set(p0.x, p0.y + up * easeOut(u), p0.z);
        s.material.opacity = 1 - sst(0.65, 1, u);
        return u < 1;
      }, kill() { sprFree(s); } });
    }
    function hearts(at, n) {
      for (let i = 0; i < (n || 2); i++) {
        const s = spr(TX.heart, { top: true }), dx = (rand() - 0.5) * 0.3, dz = (rand() - 0.5) * 0.3, d0 = i * 0.18, p0 = at.clone();
        fx({ dur: 1.3 + d0, upd(e) {
          const u = clamp((e.t - d0) / 1.3, 0, 1); s.visible = e.t >= d0;
          const k = u < 0.18 ? backOut(u / 0.18) : 1, sz = 0.11 * k;
          s.scale.set(sz, sz, 1); s.position.set(p0.x + dx * u + Math.sin(e.t * 6 + i) * 0.03, p0.y + 0.45 * easeOut(u), p0.z + dz * u);
          s.material.opacity = 1 - sst(0.7, 1, u); return e.t < e.dur;
        }, kill() { sprFree(s); } });
      }
    }
    // «пух»: пыль после кувырка (беж) или снег (белый), разлетается и тает
    function puffs(at, n, color, size, spread) {
      for (let i = 0; i < n; i++) {
        const s = spr(TX.puff, { color }), a = rand() * TAU, sp = (spread || 0.6) * (0.5 + rand() * 0.7), vy = 0.2 + rand() * 0.5, p0 = at.clone(), sz0 = (size || 0.12) * (0.7 + rand() * 0.6);
        fx({ dur: 0.55 + rand() * 0.35, upd(e) {
          const u = e.t / e.dur; s.position.set(p0.x + Math.cos(a) * sp * easeOut(u), p0.y + vy * u, p0.z + Math.sin(a) * sp * easeOut(u));
          const sz = sz0 * (0.6 + 1.1 * easeOut(u)); s.scale.set(sz, sz, 1); s.material.opacity = 0.95 * (1 - u); return u < 1;
        }, kill() { sprFree(s); } });
      }
    }
    // звёздочки «из глаз» — короткий разлёт трёх штук
    function starBurst(at, n) {
      for (let i = 0; i < (n || 3); i++) {
        const s = spr(TX.star, { top: true }), a = -PI / 2 + (i - (n - 1) / 2) * 0.9 + (rand() - 0.5) * 0.3, p0 = at.clone(), r = 0.22 + rand() * 0.08;
        const ax = Math.cos(a), ay = -Math.sin(a);
        fx({ dur: 0.55, upd(e) {
          const u = e.t / e.dur, k = u < 0.3 ? backOut(u / 0.3) : 1;
          const right = tmpA.set(1, 0, 0); if (o.camera) right.applyQuaternion(o.camera.quaternion);
          s.position.set(p0.x + right.x * ax * r * easeOut(u), p0.y + ay * r * easeOut(u) * -1 + 0.04, p0.z + right.z * ax * r * easeOut(u));
          const sz = 0.075 * k * (1 - 0.4 * u); s.scale.set(sz, sz, 1); s.material.rotation = e.t * 5; s.material.opacity = 1 - sst(0.7, 1, u); return u < 1;
        }, kill() { sprFree(s); } });
      }
    }

    /* ---------- птички (кружат над головой вместе со звёздочками): две пачки инстансов (тельца, крылышки) — 2 вызова на всех.
       Птичка в пуле — Object3D вне сцены (позиция, поворот, масштаб; userData.wings — два узла крыльев), матрицы — в fillBirds ---------- */
    const BIRD = { geo: null, wingG: null, wingM: null, pool: [], N: 12, body: null, wings: null };
    {
      const sphG = new T.SphereGeometry(1, 10, 8), coneG = new T.ConeGeometry(1, 1, 8);
      BIRD.geo = keepG(mergeParts(T, [
        { g: sphG, c: '#8FCBF2', m: m4(T, [0, 0, 0], null, [0.026, 0.024, 0.034]) },
        { g: sphG, c: '#E6F6FF', m: m4(T, [0, -0.008, 0.012], null, [0.019, 0.016, 0.022]), ol: false },
        { g: sphG, c: '#8FCBF2', m: m4(T, [0, 0.022, 0.026], null, [0.02, 0.02, 0.02]) },
        { g: coneG, c: '#FFC24D', m: m4(T, [0, 0.019, 0.05], [PI / 2, 0, 0], [0.007, 0.016, 0.007]) },
        { g: sphG, c: '#3A2E3F', m: m4(T, [0.011, 0.028, 0.039], null, [0.0042, 0.0042, 0.0042]), ol: false },
        { g: sphG, c: '#3A2E3F', m: m4(T, [-0.011, 0.028, 0.039], null, [0.0042, 0.0042, 0.0042]), ol: false },
        { g: sphG, c: '#FFB3C7', m: m4(T, [0.014, 0.017, 0.036], null, [0.005, 0.003, 0.003]), ol: false },
        { g: sphG, c: '#FFB3C7', m: m4(T, [-0.014, 0.017, 0.036], null, [0.005, 0.003, 0.003]), ol: false },
        { g: coneG, c: '#7AB8E2', m: m4(T, [0, 0.006, -0.038], [-PI / 2 - 0.4, 0, 0], [0.012, 0.024, 0.006]) },
      ], 0.0035));
      sphG.dispose(); coneG.dispose();
      BIRD.wingG = keepG(new T.SphereGeometry(1, 8, 6)); BIRD.wingG.scale(0.024, 0.004, 0.015); BIRD.wingG.translate(0.02, 0, 0);
      BIRD.wingM = toonM('#B7E0FA');
      const zero = new T.Matrix4().makeScale(0, 0, 0);
      BIRD.body = new T.InstancedMesh(BIRD.geo, vtxM, BIRD.N); BIRD.wings = new T.InstancedMesh(BIRD.wingG, BIRD.wingM, BIRD.N * 2);
      [BIRD.body, BIRD.wings].forEach((im, k) => {
        im.name = k ? 'playfight:bird-wings' : 'playfight:birds'; im.frustumCulled = false; im.castShadow = im.receiveShadow = false; im.visible = false; im.count = 0; im.raycast = () => {};
        for (let i = 0; i < im.instanceMatrix.count; i++) im.setMatrixAt(i, zero);
        fxRoot.add(im);
      });
    }
    function birdMesh() {
      for (let i = 0; i < BIRD.pool.length; i++) { const b = BIRD.pool[i]; if (!b.userData.live) { b.visible = true; b.userData.live = true; return b; } }
      const b = new T.Object3D(); b.userData.live = true;
      // левое крыло — правое, развёрнутое на 180° вокруг y (без отражения: инстансы не переворачивают грани)
      b.userData.wings = [-1, 1].map(sd => { const w = new T.Object3D(); w.position.set(sd * 0.016, 0.008, 0); w.userData.left = sd < 0; return w; });
      BIRD.pool.push(b);
      return b;
    }
    const bwM = new T.Matrix4(), bwM2 = new T.Matrix4(), RYPI = new T.Matrix4().makeRotationY(PI);
    function fillBirds() {
      let k = 0;
      for (let i = 0; i < BIRD.pool.length && k < BIRD.N; i++) {
        const b = BIRD.pool[i]; if (!b.userData.live || !b.visible) continue;
        b.updateMatrix(); BIRD.body.setMatrixAt(k, b.matrix);
        for (let j = 0; j < 2; j++) {
          const w = b.userData.wings[j];
          bwM.makeRotationZ(w.rotation.z); bwM.setPosition(w.position); if (w.userData.left) bwM.multiply(RYPI);
          BIRD.wings.setMatrixAt(k * 2 + j, bwM2.multiplyMatrices(b.matrix, bwM));
        }
        k++;
      }
      const was = BIRD.body.count;
      BIRD.body.count = k; BIRD.wings.count = k * 2; BIRD.body.visible = BIRD.wings.visible = k > 0;
      if (k || was) { BIRD.body.instanceMatrix.needsUpdate = true; BIRD.wings.instanceMatrix.needsUpdate = true; }
    }
    // звёздочки + птички по кольцу над головой; center(out) — где голова сейчас (едет с кувырком)
    function orbit(center, dur, opt) {
      opt = opt || {};
      const nS = opt.stars || 5, nB = opt.birds === undefined ? 3 : opt.birds, R = opt.r || 0.24, bs = opt.birdScale || 1.15;
      const stars = []; for (let i = 0; i < nS; i++) stars.push(spr(TX.star, {}));
      const birds = []; for (let i = 0; i < nB; i++) birds.push(birdMesh());
      let tweetT = 0.1;
      return fx({ dur, upd(e, dt) {
        center(tmpB);
        const a = e.t * 4.4, k = sst(0, 0.18, e.t) * (1 - sst(e.dur - 0.25, e.dur, e.t));
        for (let i = 0; i < nS; i++) {
          const s = stars[i], ang = a + i * TAU / nS, sz = 0.085 * k * (0.85 + 0.15 * Math.sin(e.t * 9 + i));
          s.position.set(tmpB.x + Math.cos(ang) * R, tmpB.y + Math.sin(ang * 2 + i) * 0.025 + Math.sin(ang) * 0.05, tmpB.z + Math.sin(ang) * R * 0.9);
          s.scale.set(sz, sz, 1); s.material.rotation = e.t * 3 + i;
        }
        for (let i = 0; i < nB; i++) {
          const b = birds[i], ang = -a * 0.75 + i * TAU / nB, r2 = R * 1.12, fl = 0.25 + Math.sin(e.t * 30 + i) * 0.75;
          b.position.set(tmpB.x + Math.cos(ang) * r2, tmpB.y + 0.07 + Math.sin(e.t * 7 + i * 2) * 0.02 - Math.sin(ang) * 0.04, tmpB.z + Math.sin(ang) * r2 * 0.9);
          b.rotation.set(0, -ang + PI, Math.sin(e.t * 5 + i) * 0.2);   // летит по касательной (против часовой)
          b.scale.setScalar(Math.max(0.001, k) * bs);
          b.userData.wings[0].rotation.z = fl; b.userData.wings[1].rotation.z = -fl;
        }
        tweetT -= dt; if (tweetT <= 0 && nB) { tweetT = 0.55; sfx('tweet'); }
        return e.t < e.dur;
      }, kill() { stars.forEach(sprFree); birds.forEach(b => { b.visible = false; b.userData.live = false; }); } });
    }

    /* ---------- листья (одна пачка инстансов) ---------- */
    const LEAF_N = 160;
    const LEAF = (() => {
      const sh = new T.Shape(); sh.moveTo(0, -0.055); sh.bezierCurveTo(0.04, -0.028, 0.042, 0.026, 0, 0.06); sh.bezierCurveTo(-0.042, 0.026, -0.04, -0.028, 0, -0.055);
      const g = keepG(new T.ShapeGeometry(sh, 6));
      const m = keepM(new T.MeshToonMaterial({ color: 0xFFFFFF, gradientMap: grad, side: T.DoubleSide }));
      const mesh = new T.InstancedMesh(g, m, LEAF_N); mesh.frustumCulled = false; mesh.name = 'playfight:leaves'; mesh.castShadow = false; mesh.visible = false; mesh.raycast = () => {};
      const zero = new T.Matrix4().makeScale(0, 0, 0), c = new T.Color(), PAL = ['#F2A541', '#E9763A', '#D9533B', '#F3C969', '#C8743F', '#E8A04F', '#EFB84E'];
      for (let i = 0; i < LEAF_N; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, c.set(PAL[i % PAL.length])); }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      fxRoot.add(mesh);
      return { mesh, p: new Float32Array(LEAF_N * 3), v: new Float32Array(LEAF_N * 3), r: new Float32Array(LEAF_N * 3), w: new Float32Array(LEAF_N * 3),
        life: new Float32Array(LEAF_N), st: new Uint8Array(LEAF_N), off: new Float32Array(LEAF_N * 3), gy: new Float32Array(LEAF_N), next: 0, live: 0 };
    })();
    const leafM = new T.Matrix4(), leafE = new T.Euler(), leafQ = new T.Quaternion(), leafS = new T.Vector3(), leafP = new T.Vector3();
    function leafAlloc() { for (let k = 0; k < LEAF_N; k++) { const i = (LEAF.next + k) % LEAF_N; if (LEAF.st[i] === 0) { LEAF.next = (i + 1) % LEAF_N; return i; } } return -1; }
    function leavesHeld(n) {      // охапка в руках: позиции — вокруг точки между ладонями (ставит поза)
      const ids = [];
      for (let k = 0; k < n; k++) { const i = leafAlloc(); if (i < 0) break; LEAF.st[i] = 2; ids.push(i);
        LEAF.off[i * 3] = (rand() - 0.5) * 0.24; LEAF.off[i * 3 + 1] = (rand() - 0.3) * 0.16; LEAF.off[i * 3 + 2] = (rand() - 0.5) * 0.14;
        LEAF.r[i * 3] = rand() * TAU; LEAF.r[i * 3 + 1] = rand() * TAU; LEAF.r[i * 3 + 2] = rand() * TAU; LEAF.life[i] = 0; }
      return ids;
    }
    function leavesThrow(ids, from, to, T0) {        // полетели: к точке to за ~T0 с, веером, потом кружат и падают
      const gy0 = groundY(to.x, to.z);
      ids.forEach(i => {
        if (LEAF.st[i] !== 2 && LEAF.st[i] !== 0) return;
        LEAF.st[i] = 1; LEAF.life[i] = 0; LEAF.gy[i] = gy0;
        const px = from.x + LEAF.off[i * 3], py = from.y + LEAF.off[i * 3 + 1], pz = from.z + LEAF.off[i * 3 + 2];
        LEAF.p[i * 3] = px; LEAF.p[i * 3 + 1] = py; LEAF.p[i * 3 + 2] = pz;
        const tt = T0 * (0.8 + rand() * 0.4), tx = to.x + (rand() - 0.5) * 0.9, ty = to.y + (rand() - 0.3) * 0.6, tz = to.z + (rand() - 0.5) * 0.9;
        LEAF.v[i * 3] = (tx - px) / tt; LEAF.v[i * 3 + 2] = (tz - pz) / tt; LEAF.v[i * 3 + 1] = (ty - py) / tt + 0.5 * 4.0 * tt;
        LEAF.w[i * 3] = (rand() - 0.5) * 14; LEAF.w[i * 3 + 1] = (rand() - 0.5) * 10; LEAF.w[i * 3 + 2] = (rand() - 0.5) * 14;
      });
    }
    function leafBurst(from, to, n, T0) { const ids = leavesHeld(n); leavesThrow(ids, from, to, T0); return ids; }
    function updateLeaves(dt, heldAt) {
      let live = 0;
      for (let i = 0; i < LEAF_N; i++) {
        const st = LEAF.st[i]; if (!st) continue; live++;
        const j = i * 3; let sc = 1;
        if (st === 2) {          // в охапке
          if (heldAt) { LEAF.p[j] = heldAt.x + LEAF.off[j]; LEAF.p[j + 1] = heldAt.y + LEAF.off[j + 1]; LEAF.p[j + 2] = heldAt.z + LEAF.off[j + 2]; }
          else { LEAF.st[i] = 0; continue; }
        } else if (st === 1) {   // летит: лёгкий лист — гравитация слабее, сопротивление воздуха, кружится
          LEAF.life[i] += dt;
          LEAF.v[j + 1] -= 4.0 * dt;
          if (LEAF.v[j + 1] < 0) { const k = Math.exp(-2.4 * dt); LEAF.v[j] *= k; LEAF.v[j + 2] *= k; LEAF.v[j + 1] = Math.max(LEAF.v[j + 1], -0.75); }
          LEAF.p[j] += (LEAF.v[j] + Math.sin(LEAF.life[i] * 5 + i) * 0.35) * dt; LEAF.p[j + 1] += LEAF.v[j + 1] * dt; LEAF.p[j + 2] += (LEAF.v[j + 2] + Math.cos(LEAF.life[i] * 4 + i) * 0.3) * dt;
          LEAF.r[j] += LEAF.w[j] * dt; LEAF.r[j + 1] += LEAF.w[j + 1] * dt; LEAF.r[j + 2] += LEAF.w[j + 2] * dt;
          if (LEAF.p[j + 1] <= LEAF.gy[i] + 0.006 && LEAF.v[j + 1] < 0) { LEAF.st[i] = 3; LEAF.life[i] = 0; LEAF.p[j + 1] = LEAF.gy[i] + 0.006 + (i % 5) * 0.0008; LEAF.r[j] = -PI / 2; LEAF.r[j + 1] = 0; }
        } else if (st === 3) {   // лежит, потом тает
          LEAF.life[i] += dt; sc = 1 - sst(2.2, 3.0, LEAF.life[i]);
          if (LEAF.life[i] > 3.0) { LEAF.st[i] = 0; LEAF.mesh.setMatrixAt(i, leafM.makeScale(0, 0, 0)); continue; }
        }
        leafE.set(LEAF.r[j], LEAF.r[j + 1], LEAF.r[j + 2]); leafQ.setFromEuler(leafE); leafS.set(sc, sc, sc); leafP.set(LEAF.p[j], LEAF.p[j + 1], LEAF.p[j + 2]);
        LEAF.mesh.setMatrixAt(i, leafM.compose(leafP, leafQ, leafS));
      }
      if (live || LEAF.live) LEAF.mesh.instanceMatrix.needsUpdate = true;
      LEAF.live = live; LEAF.mesh.visible = live > 0;          // нет листьев — нет и вызова отрисовки
    }

    /* ---------- снежки, шлепки снега ---------- */
    const SNOW = { ballG: keepG(new T.SphereGeometry(0.055, 14, 10)), ballM: toonM('#FFFFFF'), splatG: null, balls: [], splats: [] };
    SNOW.splatG = keepG(mergeParts(T, [
      { g: new T.SphereGeometry(1, 10, 7), c: '#FFFFFF', m: m4(T, [0, 0, 0], null, [0.07, 0.06, 0.022]), own: true },
      { g: new T.SphereGeometry(1, 8, 6), c: '#F4FAFF', m: m4(T, [0.05, 0.03, 0.004], null, [0.035, 0.03, 0.016]), own: true },
      { g: new T.SphereGeometry(1, 8, 6), c: '#FFFFFF', m: m4(T, [-0.048, -0.022, 0.003], null, [0.032, 0.03, 0.016]), own: true },
      { g: new T.SphereGeometry(1, 8, 6), c: '#EAF5FF', m: m4(T, [0.012, -0.05, 0.002], null, [0.024, 0.02, 0.012]), own: true },
      { g: new T.SphereGeometry(1, 8, 6), c: '#FFFFFF', m: m4(T, [-0.02, 0.055, 0.002], null, [0.02, 0.018, 0.012]), own: true },
    ]));
    // снежки и шлепки — тоже пачками инстансов (по 1 вызову; снежки ещё и в тени); в пулах — Object3D вне сцены
    const SNOW_N = 16, SPLAT_N = 12;
    SNOW.ballIM = new T.InstancedMesh(SNOW.ballG, SNOW.ballM, SNOW_N); SNOW.ballIM.castShadow = true;
    SNOW.splatIM = new T.InstancedMesh(SNOW.splatG, vtxM, SPLAT_N);
    [SNOW.ballIM, SNOW.splatIM].forEach((im, k) => { im.name = k ? 'playfight:splats' : 'playfight:snowballs'; im.frustumCulled = false; im.visible = false; im.count = 0; im.raycast = () => {}; fxRoot.add(im); });
    function ballGet() {
      let b = null;
      for (let i = 0; i < SNOW.balls.length; i++) if (!SNOW.balls[i].userData.live) { b = SNOW.balls[i]; break; }
      if (!b) { b = new T.Object3D(); b.userData = {}; SNOW.balls.push(b); }
      b.visible = true; b.userData.live = true; b.scale.setScalar(1); b.rotation.set(0, 0, 0); return b;
    }
    const ballFree = b => { if (b) { b.visible = false; b.userData.live = false; } };
    // шлепок снега: едет за точкой (follow(out, quatOut) → мировая точка и поворот), тает за dur
    function splat(follow, dur, size) {
      let m = null;
      for (let i = 0; i < SNOW.splats.length; i++) if (!SNOW.splats[i].userData.live) { m = SNOW.splats[i]; break; }
      if (!m) { m = new T.Object3D(); m.userData = {}; SNOW.splats.push(m); }
      m.visible = true; m.userData.live = true; m.scale.setScalar(0.001);
      const sz = size || 1;
      return fx({ dur: dur || 2.6, upd(e) {
        if (!follow(m.position, m.quaternion)) return false;
        const k = e.t < 0.12 ? backOut(e.t / 0.12) : 1, f = 1 - sst(e.dur - 0.5, e.dur, e.t);
        m.scale.set(Math.max(1e-3, sz * k * (0.6 + 0.4 * f)), Math.max(1e-3, sz * k * f), Math.max(1e-3, sz * k)); return e.t < e.dur;
      }, kill() { m.visible = false; m.userData.live = false; } });
    }
    function fillPool(list, im, cap) {
      let k = 0;
      for (let i = 0; i < list.length && k < cap; i++) { const b = list[i]; if (!b.userData.live || !b.visible) continue; b.updateMatrix(); im.setMatrixAt(k++, b.matrix); }
      const was = im.count; im.count = k; im.visible = k > 0; if (k || was) im.instanceMatrix.needsUpdate = true;
    }

    /* ---------- белый платочек «сдаюсь» ---------- */
    TX.flag = keepT(canvasTex(T, 96, 68, c => {      // белый платочек с тёмной каёмкой и розовым сердечком (видно и на светлом фоне)
      c.fillStyle = '#FFFFFF'; rrect(c, 3, 3, 90, 62, 10); c.fill(); c.lineWidth = 5; c.strokeStyle = '#4A3A48'; c.stroke();
      heartPath(c, 48, 36, 11); c.fillStyle = '#FF86A8'; c.fill();
    }));
    const FLAG = { stickG: keepG(new T.CylinderGeometry(0.008, 0.008, 0.48, 6)), clothG: keepG(new T.PlaneGeometry(0.22, 0.156, 6, 3)), stickM: toonM('#B98A5E'), clothM: toonM('#FFFFFF', { side: T.DoubleSide, map: TX.flag }), pool: [] };
    FLAG.clothG.translate(0.1, 0, 0); FLAG.stickG.translate(0, 0.24, 0);
    function flagGet() {
      let f = FLAG.pool.find(x => !x.userData.live);
      if (!f) {
        f = new T.Group(); f.userData = {};
        const st = new T.Mesh(FLAG.stickG, FLAG.stickM); f.add(st);
        const cl = new T.Mesh(FLAG.clothG, FLAG.clothM); cl.position.set(0.006, 0.4, 0); f.add(cl); f.userData.cloth = cl;
        fxRoot.add(f); FLAG.pool.push(f);
      }
      f.visible = true; f.userData.live = true; return f;
    }

    /* ---------- облачко по умолчанию (если игра не дала say) ---------- */
    const ownBubbles = new Map();
    function defaultSay(n, text) {
      const old = ownBubbles.get(n); if (old) { old.dead = true; }
      const tex = bubbleTex(text), s = spr(tex, { top: true }), asp = tex.userData.aspect, Hh = 0.1 + 0.13 * (tex.userData.lines || 1);
      const e = fx({ dur: clamp(1.4 + text.length * 0.05, 1.8, 3.2), upd(e2) {
        if (e2.dead || !n.root) return false;
        const h = headOf(n); n.root.localToWorld(tmpC.set(0, h + 0.42, 0));
        const k = e2.t < 0.15 ? backOut(e2.t / 0.15) : 1;
        s.position.copy(tmpC); s.position.y += Hh * 0.5; s.scale.set(Hh * asp * k, Hh * k, 1); s.material.opacity = 1 - sst(e2.dur - 0.3, e2.dur, e2.t);
        return e2.t < e2.dur;
      }, kill() { sprFree(s); if (ownBubbles.get(n) === e) ownBubbles.delete(n); } });
      ownBubbles.set(n, e);
    }
    const lineIdx = {};
    function lineFor(kind, speaker) {
      const L = window.PlayFightLines;
      const own = L && L.by && L.by[speaker] && L.by[speaker][kind];
      if (own && own.length) { const k = speaker + '|' + kind, i = (lineIdx[k] || 0) % own.length; lineIdx[k] = i + 1; return { who: own[i].who || speaker, text: own[i].text }; }
      const g = (L && L.generic && L.generic[kind]) || GENERIC[kind] || GENERIC.oops, k = '*|' + kind, i = (lineIdx[k] || 0) % g.length; lineIdx[k] = i + 1;
      return { who: speaker, text: g[i] };
    }
    const speakerOf = n => String((n && (n.speaker || n.voice || n.id)) || 'resident');
    function sayKind(n, kind) {
      const l = lineFor(kind, speakerOf(n));
      if (!l || !l.text || l.text === '!') return null;
      try { if (typeof o.say === 'function') o.say(n, l.text, l.who); else defaultSay(n, l.text); } catch (e) { defaultSay(n, l.text); }
      emit('say', { npc: n.id, kind, who: l.who, text: l.text });
      return l;
    }

    /* ---------- жители: где они, рост, радиус ---------- */
    const npcHead = new WeakMap();
    function headOf(n) {
      if (npcHead.has(n)) return npcHead.get(n);
      let h = +n.headY;
      if (!(h > 0)) {
        try { const bb = new T.Box3(), inv = new T.Matrix4().copy(n.root.matrixWorld).invert(); n.root.updateWorldMatrix(true, true); bb.setFromObject(n.root); if (!bb.isEmpty()) { bb.applyMatrix4(inv); h = bb.max.y; } } catch (e) { h = 0; }
        if (!(h > 0.05)) h = 1.0;
      }
      npcHead.set(n, h); return h;
    }
    const scV = V(), gyV = V();
    const scaleOf = obj => { obj.getWorldScale(scV); return Math.max(1e-4, scV.y); };
    const npcPos = (n, out) => n.root.getWorldPosition(out);
    const npcRadius = n => clamp(+n.r || 0.3, 0.12, 0.7);      // в метрах мира (как у жизни города: столкновения)
    const heroPos = out => heroRoot.getWorldPosition(out);
    function heroYaw() { heroRoot.getWorldQuaternion(tmpQ); tmpA.set(0, 0, 1).applyQuaternion(tmpQ); return Math.atan2(tmpA.x, tmpA.z); }
    const setYaw = typeof o.setYaw === 'function' ? o.setYaw : (y => { heroRoot.rotation.y = y; });
    const moveHero = typeof o.moveHero === 'function' ? o.moveHero : ((dx, dz) => { heroRoot.position.x += dx; heroRoot.position.z += dz; });
    const moveNpc = typeof o.moveNpc === 'function' ? o.moveNpc : ((n, dx, dz) => {
      if (typeof n.x === 'number') n.x += dx; if (typeof n.z === 'number') n.z += dz;
      if (n.root) { n.root.position.x += dx; n.root.position.z += dz; }
    });
    const groundY = (x, z) => { if (typeof o.ground === 'function') { const g = +o.ground(x, z); if (isFinite(g)) return g; } heroRoot.getWorldPosition(gyV); return gyV.y; };
    const personaOf = n => { const sp = speakerOf(n), P = o.persona || {}; return Object.assign({}, PERSONA._default, PERSONA[sp] || PERSONA[String(n.id || '')] || {}, P[sp] || {}); };
    const valid = n => !!(n && n.root && n.root.parent && n.root.visible !== false);

    /* ---------- статистика жителя: эпизоды возни, «сдаюсь» ---------- */
    const STATS = new WeakMap();
    const statOf = n => { let s = STATS.get(n); if (!s) { s = { eps: [], last: -99, surrender: -99, react: 0 }; STATS.set(n, s); } return s; };
    const surrendered = n => !!n && statOf(n).surrender > now;

    /* ---------- кого трогать: ближайший спереди ---------- */
    const pH = V(), pN = V();
    // «лежачего не бьют»: пока житель лежит, сидит после кувырка, дуется, догоняет, сдаётся или кланяется — он не цель
    // (и для «Бум!», и для снежков/листьев). Серия — максимум три тапа: третий кладёт жителя, дальше пауза до конца реакции.
    const DOWN = { tumble: 1, curl: 1, flip: 1, caughtLie: 1, surrender: 1, giveup: 1, pout: 1, chaseStart: 1, chase: 1, bow: 1 };
    function isDown(n) { const R = RX.get(n); return !!(R && R.cur && (DOWN[R.cur.kind] || (R.pending && R.pending.final))); }
    const TG = { n: null, d: 0, ang: 0, pet: false, paltar: false, dx: 0, dz: 0 }, NOOPT = {};
    function findTarget(range, opt) {
      opt = opt || NOOPT;
      const list = getNpcs() || []; if (!list.length) return null;
      heroPos(pH); const yaw = heroYaw();
      let best = null, bs = 1e9;
      for (let i = 0; i < list.length; i++) {
        const n = list[i]; if (!valid(n)) continue;
        const pet = isPet(n);
        if (opt.noPets && pet) continue;
        if (!pet && (surrendered(n) || isDown(n))) continue;
        let ok = true; try { ok = canTarget(n) !== false; } catch (e) { ok = false; } if (!ok) continue;
        npcPos(n, pN);
        if (Math.abs(pN.y - pH.y) > 1.3) continue;
        const dx = pN.x - pH.x, dz = pN.z - pH.z, d = Math.hypot(dx, dz), dd = d - npcRadius(n) * 0.5;
        if (dd > range) continue;
        const ang = d > 1e-4 ? Math.abs(angW(Math.atan2(dx, dz) - yaw)) : 0;
        if (ang > (opt.cone || 1.95)) continue;
        const sc = dd + ang * (opt.angK || 0.4);
        if (sc < bs) { bs = sc; best = n; TG.n = n; TG.d = d; TG.ang = ang; TG.pet = pet; TG.dx = dx; TG.dz = dz; }
      }
      if (!best) return null;
      TG.paltar = isPaltar(best);
      return TG;          // один объект на все вызовы: читать сразу, не хранить
    }

    /* =====================================================================
       ГЕРОИНЯ: позы поверх HeroAnim
       ===================================================================== */
    const OVN = B ? ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'upperarm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upperarm_R', 'forearm_R', 'hand_R',
      'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R', 'coat_L', 'coat_R'].filter(n => B[n]) : [];
    const OV = { base: {}, wrote: {}, hipsBase: V(), hipsWrote: V(), on: false, aimed: false };
    OVN.forEach(n => { OV.base[n] = Q(); OV.wrote[n] = Q(); });
    const LEG = B ? { th: B.shin_L.position.length(), sh: B.foot_L.position.length() } : { th: 0.37, sh: 0.34 };
    function ovRestoreStale() {
      if (!OV.on) return;
      for (let i = 0; i < OVN.length; i++) { const n = OVN[i]; if (B[n].quaternion.equals(OV.wrote[n])) B[n].quaternion.copy(OV.base[n]); }
      if (B.hips.position.equals(OV.hipsWrote)) B.hips.position.copy(OV.hipsBase);
      OV.on = false;
    }
    function ovBegin() { ovRestoreStale(); for (let i = 0; i < OVN.length; i++) OV.base[OVN[i]].copy(B[OVN[i]].quaternion); OV.hipsBase.copy(B.hips.position); OV.aimed = false; }
    function ovEnd() { for (let i = 0; i < OVN.length; i++) OV.wrote[OVN[i]].copy(B[OVN[i]].quaternion); OV.hipsWrote.copy(B.hips.position); OV.on = true; }
    const pe = new T.Euler(), pq = Q(), pq2 = Q(), aS = V(), aH = V(), aT = V(), aQ = Q(), aP = Q(), aW = Q();
    // точки кисти (оси кисти: пальцы −y, большой палец +z; ладонь левой — к телу, −x)
    const PALM = { _L: new T.Vector3(0.004, -0.062, 0.012), _R: new T.Vector3(-0.004, -0.062, 0.012) };
    const TIP = { _L: new T.Vector3(0.0, -0.098, 0.012), _R: new T.Vector3(0.0, -0.098, 0.012) };
    const GRIPV = new T.Vector3(0.004, -0.07, 0.012);
    const HAM_TIP = new T.Vector3(GRIPV.x, GRIPV.y, GRIPV.z + HAMMER_HEAD[1]);   // головка молоточка в осях кисти (ручка — вдоль большого пальца)
    let PW = 1;          // общий вес позы (плавная смена шага серии: прошлый шаг тает, новый нарастает)
    const P = {
      set(n, x, y, z, w) { w *= PW; if (!(w > 0.001) || !B[n]) return; pe.set(x * D, y * D, z * D); pq.setFromEuler(pe); B[n].quaternion.slerp(pq, Math.min(1, w)); OV.aimed = false; },
      add(n, x, y, z, k) { k = (k === undefined ? 1 : k) * PW; if (!k || !B[n]) return; pe.set(x * D * k, y * D * k, z * D * k); pq.setFromEuler(pe); B[n].quaternion.multiply(pq); OV.aimed = false; },
      hips(dx, dy, dz) { B.hips.position.x += dx * PW; B.hips.position.y += dy * PW; B.hips.position.z += dz * PW; OV.aimed = false; },
      yaw(a) { a *= PW; if (!a) return; pq.setFromAxisAngle(UP, a); B.hips.quaternion.premultiply(pq); OV.aimed = false; },
      // присесть: бёдра −a, колени +2a, стопы −a, таз ниже ровно на столько, чтобы стопы остались на земле
      crouch(a) { a *= PW; if (!(a > 0.01)) return; const k = PW; PW = 1; P.add('thigh_L', -a, 0, 0); P.add('thigh_R', -a, 0, 0); P.add('shin_L', 2 * a, 0, 0); P.add('shin_R', 2 * a, 0, 0); P.add('foot_L', -a, 0, 0); P.add('foot_R', -a, 0, 0); PW = k; B.hips.position.y -= (LEG.th + LEG.sh) * (1 - Math.cos(a * D)); },
      // рука к точке мира: локоть сгибается под расстояние (закон косинусов — бисекцией), плечо целится; ref — точка кисти
      reach(sd, target, w, ref) {
        w *= PW;
        if (!(w > 0.001) || !target) return;
        const ua = B['upperarm' + sd], fa = B['forearm' + sd], ha = B['hand' + sd];
        if (!OV.aimed) { model.updateWorldMatrix(true, true); OV.aimed = true; } else ua.updateWorldMatrix(false, true);
        ref = ref || PALM[sd];
        ua.getWorldPosition(aS);
        const want = aS.distanceTo(target) / scaleOf(ua);
        // кисть (поза кисти уже поставлена) в осях предплечья
        aH.copy(ref).applyQuaternion(ha.quaternion).add(ha.position);
        let lo = 4 * D, hi = 150 * D;
        if (elbowDist(fa, lo) <= want) hi = lo; else if (elbowDist(fa, hi) >= want) lo = hi;
        else for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (elbowDist(fa, m) > want) lo = m; else hi = m; }
        pe.set(-(lo + hi) / 2, 0, 0); pq.setFromEuler(pe); fa.quaternion.slerp(pq, Math.min(1, w));
        ua.updateWorldMatrix(false, true);
        aimRaw(sd, target, w, ref);
      },
      aim(sd, target, w, ref) { aimRaw(sd, target, w * PW, ref); },
    };
    // плечо → точка кисти при сгибе локтя phi (кисть в осях предплечья — в aH); без замыканий в кадре
    function elbowDist(fa, phi) { pe.set(-phi, 0, 0); pq.setFromEuler(pe); return aT.copy(aH).applyQuaternion(pq).add(fa.position).length(); }
    function aimRaw(sd, target, w, ref) {
        if (!(w > 0.001) || !target) return;
        const ua = B['upperarm' + sd], ha = B['hand' + sd];
        if (!OV.aimed) { model.updateWorldMatrix(true, true); OV.aimed = true; }
        ua.getWorldPosition(aS); aH.copy(ref || PALM[sd]); ha.localToWorld(aH);
        aH.sub(aS); aT.copy(target).sub(aS);
        if (aH.lengthSq() < 1e-10 || aT.lengthSq() < 1e-10) return;
        aQ.setFromUnitVectors(aH.normalize(), aT.normalize());
        aW.copy(IDQ).slerp(aQ, Math.min(1, w));
        ua.getWorldQuaternion(pq2); pq2.premultiply(aW);
        ua.parent.getWorldQuaternion(aP); ua.quaternion.copy(aP.invert().multiply(pq2));
        ua.updateWorldMatrix(false, true);
    }

    /* ---------- точки цели (мир) ---------- */
    const C = { head: V(), headUp: V(), chest: V(), nose: V(), shoulder: V(), ground: V(), groundL: V(), groundR: V(), hold: V(), up: V(), mouth: V(), fwd: V(), throwAt: V() };
    function targetPoints(n) {
      heroPos(pH); const yaw = heroYaw(); C.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
      const lx = Math.cos(yaw), lz = -Math.sin(yaw);          // влево от героини
      const gy = groundY(pH.x, pH.z);
      C.ground.set(pH.x + C.fwd.x * 0.45, gy + 0.05, pH.z + C.fwd.z * 0.45);
      C.groundL.set(C.ground.x + lx * 0.13, C.ground.y, C.ground.z + lz * 0.13); C.groundR.set(C.ground.x - lx * 0.13, C.ground.y, C.ground.z - lz * 0.13);
      C.hold.set(pH.x + C.fwd.x * 0.33, pH.y + 1.08, pH.z + C.fwd.z * 0.33);
      C.up.set(pH.x + C.fwd.x * 0.45, pH.y + 2.05, pH.z + C.fwd.z * 0.45);
      if (B) B.head.localToWorld(C.mouth.set(0, 0.066, 0.16)); else C.mouth.set(pH.x, pH.y + 1.4, pH.z);
      if (!n || !valid(n)) { C.throwAt.set(pH.x + C.fwd.x * 4, pH.y + 0.6, pH.z + C.fwd.z * 4); return; }
      const h = headOf(n), r = npcRadius(n) / scaleOf(n.root);
      npcPos(n, pN);
      const dx = pH.x - pN.x, dz = pH.z - pN.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;   // к героине
      const s = scaleOf(n.root);
      C.head.set(pN.x + ux * r * 0.3 * s, pN.y + h * 0.98 * s, pN.z + uz * r * 0.3 * s);
      C.headUp.set(pN.x + ux * r * 0.2 * s, pN.y + (h + 0.02) * s, pN.z + uz * r * 0.2 * s);
      C.chest.set(pN.x + ux * r * 0.85 * s, pN.y + h * 0.58 * s, pN.z + uz * r * 0.85 * s);
      C.shoulder.set(pN.x + ux * r * 0.7 * s, pN.y + h * 0.78 * s, pN.z + uz * r * 0.7 * s);
      C.nose.set(pN.x + ux * (r + 0.1) * s, pN.y + h * 0.82 * s, pN.z + uz * (r + 0.1) * s);
      // у зверька со скелетом — настоящая голова (кость), буп — в сторону головы, ближнюю к героине
      const hb = n.I && n.I.B && (n.I.B.head || n.I.B.momHead);
      if (hb && hb.isObject3D) { hb.getWorldPosition(C.nose); const hr = clamp(h * 0.24, 0.07, 0.16) * s; C.nose.x += ux * hr; C.nose.z += uz * hr; C.nose.y += 0.01 * s; }
      C.throwAt.set(pN.x, pN.y + h * 0.7 * s, pN.z);
    }

    /* ---------- действия героини ---------- */
    // dur — длина, hits — моменты касания (с), reach — расстояние «корень героини — центр жителя», на котором бить;
    // pop — звукоподражание, kind — реакция жителя (stagger / spin / tumble / squash / squash2 / hip)
    const ACTS = {
      push: { dur: 0.62, hits: [0.24], reach: 0.6, pop: 'Толк!', snd: 'bonk', kind: 'stagger', pose(t, c) {
        const wind = win(t, 0, 0.1, 0.12, 0.2), str = win(t, 0.13, 0.21, 0.32, 0.54);
        P.set('upperarm_L', 22, 0, 18, wind); P.set('forearm_L', -80, 0, 0, wind); P.add('chest', 0, 14, 0, wind); P.add('spine', -3, 4, 0, wind);
        P.set('hand_L', 10, -20, 78, str); P.add('chest', 5, -18, 0, str); P.add('spine', 6, -8, 0, str); P.hips(0, 0, 0.06 * str);
        P.add('upperarm_R', 22, 0, -10, str); P.add('head', -4, 8, 0, str);
        P.reach('_L', C.chest, str);
      } },
      spin: { dur: 0.92, hits: [0.62], reach: 0.62, pop: 'Бамс!', snd: 'bonk', kind: 'spin', pose(t, c) {
        const sp = sst(0, 0.42, t);
        P.yaw(TAU * sp); P.hips(0, 0.05 * Math.sin(PI * sp), 0);
        const out = win(t, 0, 0.08, 0.34, 0.44);
        P.set('upperarm_L', -18, 0, 78, out); P.set('upperarm_R', -18, 0, -78, out); P.set('forearm_L', -12, 0, 0, out); P.set('forearm_R', -12, 0, 0, out);
        P.add('head', 0, 0, 8 * Math.sin(t * 20) * out);
        const up = win(t, 0.38, 0.5, 0.54, 0.6);
        P.set('upperarm_L', -165, 0, 14, up); P.set('forearm_L', -28, 0, 0, up); P.add('chest', -8, 6, 0, up);
        const str = win(t, 0.54, 0.62, 0.7, 0.88);
        P.set('hand_L', 40, 0, 20, str); P.add('chest', 12, -12, 0, str); P.add('spine', 7, 0, 0, str); P.hips(0, 0, 0.04 * str); P.add('upperarm_R', 20, 0, -12, str);
        P.reach('_L', C.headUp, str);
      } },
      slap: { dur: 1.06, hits: [0.62], reach: 0.62, pop: 'Хлоп!', snd: 'slap', kind: 'tumble', pose(t, c) {
        const cr1 = win(t, 0, 0.14, 0.18, 0.28), air = t > 0.26 && t < 0.56 ? Math.sin(PI * (t - 0.26) / 0.3) : 0, cr2 = win(t, 0.56, 0.62, 0.7, 0.94);
        P.crouch(24 * cr1 + 22 * cr2); P.hips(0, 0.16 * air, 0.06 * air);
        P.add('thigh_L', -24 * air, 0, 0); P.add('thigh_R', -18 * air, 0, 0); P.add('shin_L', 46 * air, 0, 0); P.add('shin_R', 36 * air, 0, 0);
        const back = win(t, 0, 0.12, 0.18, 0.28); P.set('upperarm_L', 42, 0, 16, back); P.set('upperarm_R', 42, 0, -16, back);
        const up = win(t, 0.24, 0.36, 0.46, 0.56); P.set('upperarm_L', -158, 0, 22, up); P.set('upperarm_R', -150, 0, -26, up); P.set('forearm_L', -22, 0, 0, up); P.set('forearm_R', -22, 0, 0, up);
        const str = win(t, 0.52, 0.6, 0.72, 0.94);
        P.set('hand_L', 10, -20, 74, str); P.add('chest', 12, -14, 0, str); P.add('spine', 6, 0, 0, str);
        P.set('upperarm_R', -70, 0, -55, str); P.set('forearm_R', -30, 0, 0, str); P.add('head', -6, 0, 0, str);
        P.reach('_L', C.shoulder, str);
      } },
      ham1: { dur: 0.76, hits: [0.42], reach: 0.52, pop: 'Пиу!', snd: 'piu', kind: 'squash', ham: true, pose(t, c) {
        const up = win(t, 0, 0.18, 0.3, 0.38);
        P.set('upperarm_L', -170, 0, 8, up); P.set('forearm_L', -100, 0, 0, up); P.set('hand_L', 40, 0, 0, up); P.add('chest', -8, 10, 0, up); P.add('spine', -4, 0, 0, up);
        const str = win(t, 0.3, 0.4, 0.5, 0.7);
        P.set('hand_L', 80, 0, 0, str); P.add('chest', 12, -10, 0, str); P.add('spine', 8, 0, 0, str); P.hips(0, 0, 0.04 * str); P.add('upperarm_R', 18, 0, -10, str);
        P.reach('_L', C.headUp, str, HAM_TIP);
      } },
      ham2: { dur: 0.98, hits: [0.33, 0.68], reach: 0.52, pop: 'Пиу-пиу!', snd: 'piu', kind: 'squash2', ham: true, pose(t, c) {
        const up1 = win(t, 0, 0.12, 0.18, 0.25), str1 = win(t, 0.2, 0.3, 0.38, 0.46), up2 = win(t, 0.4, 0.5, 0.54, 0.6), str2 = win(t, 0.56, 0.66, 0.74, 0.92);
        P.set('upperarm_L', -160, 0, 8, Math.max(up1, up2)); P.set('forearm_L', -90, 0, 0, Math.max(up1, up2)); P.set('hand_L', 40, 0, 0, Math.max(up1, up2));
        const str = Math.max(str1, str2);
        P.set('hand_L', 80, 0, 0, str); P.add('chest', 10, -8, 0, str); P.add('spine', 6, 0, 0, str); P.hips(0, 0.02 * Math.sin(t * 20) * str, 0.03 * str);
        P.reach('_L', C.headUp, str, HAM_TIP);
      } },
      ham3: { dur: 1.2, hits: [0.8], reach: 0.52, pop: 'ПИИУ!', snd: 'piu', kind: 'tumble', ham: true, pose(t, c) {
        const cr = win(t, 0, 0.18, 0.24, 0.36), air = t > 0.34 && t < 0.74 ? Math.sin(PI * (t - 0.34) / 0.4) : 0, land = win(t, 0.74, 0.8, 0.88, 1.1);
        P.crouch(26 * cr + 24 * land); P.hips(0, 0.17 * air, 0.05 * air);
        P.add('thigh_L', -22 * air, 0, 0); P.add('thigh_R', -22 * air, 0, 0); P.add('shin_L', 40 * air, 0, 0); P.add('shin_R', 40 * air, 0, 0);
        const up = win(t, 0.06, 0.3, 0.62, 0.72);
        P.set('upperarm_L', -175, 0, 4, up); P.set('forearm_L', -120, 0, 0, up); P.set('hand_L', 30, 0, 0, up); P.add('chest', -12, 10, 0, up); P.set('upperarm_R', -40, 0, -50, up);
        const str = win(t, 0.66, 0.78, 0.9, 1.12);
        P.set('hand_L', 85, 0, 0, str); P.add('chest', 16, -12, 0, str); P.add('spine', 10, 0, 0, str); P.set('upperarm_R', -70, 0, -60, str);
        P.reach('_L', C.headUp, str, HAM_TIP);
      } },
      hip1: { dur: 0.66, hits: [0.3], reach: 0.42, side: true, pop: 'Бум!', snd: 'bonk', kind: 'stagger', pose(t, c) { hipPose(t, 1); } },
      hip2: { dur: 0.66, hits: [0.3], reach: 0.42, side: true, pop: 'Бум-бум!', snd: 'bonk', kind: 'spin', pose(t, c) { hipPose(t, 1.15); } },
      hip3: { dur: 0.9, hits: [0.46], reach: 0.42, side: true, pop: 'Бу-бух!', snd: 'slap', kind: 'tumble', pose(t, c) {
        const air = t > 0.12 && t < 0.42 ? Math.sin(PI * (t - 0.12) / 0.3) : 0; P.hips(0, 0.13 * air, 0); P.add('thigh_L', -14 * air, 0, 0); P.add('shin_L', 30 * air, 0, 0);
        P.set('upperarm_R', -60, 0, -70, air); P.set('upperarm_L', -40, 0, 75, air);
        hipPose(Math.max(0, t - 0.16), 1.35);
      } },
      // присед 62°, спина 44° + грудь 32°: пальчик достаёт носик, а колени остаются ≈13 см позади него (не упираются в мордочку)
      boop: { dur: 1.45, hits: [0.62], reach: 0.36, nose: 0.38, bp: { cr: 62, sp: 44, ch: 32, hd: -10, hz: -0.08 }, pop: 'Буп!', popCol: 'pink', snd: 'boop', kind: 'wiggle', pet: true, pose(t, c) {
        const bend = win(t, 0.04, 0.4, 0.95, 1.35), rch = win(t, 0.28, 0.56, 0.7, 0.98);
        const bp = ACTS.boop.bp;
        P.crouch(bp.cr * bend); P.add('spine', bp.sp * bend, 0, 0); P.add('chest', bp.ch * bend, 0, 0); P.add('head', bp.hd * bend, 0, 0); P.hips(0, 0, bp.hz * bend);
        const sd = c.side || '_L';
        P.set('hand' + sd, -10, 0, 0, rch);
        P.reach(sd, C.nose, rch, TIP[sd]);
        const gg = win(t, 0.7, 0.85, 1.15, 1.4); P.add('chest', 4 * Math.sin(t * 24) * gg, 0, 0); P.add('head', -6 * gg, 0, 6 * gg);
      } },
      leaves: { dur: 1.55, rel: 1.02, scoop: 0.36, reach: 0, pop: 'Шурх!', popCol: 'green', snd: 'leaves', pose(t, c) {
        const sc = win(t, 0, 0.3, 0.42, 0.64); P.crouch(40 * sc); P.add('spine', 30 * sc, 0, 0); P.add('chest', 14 * sc, 0, 0); P.add('head', -8 * sc, 0, 0);
        const gw = win(t, 0.1, 0.28, 0.4, 0.56); P.set('hand_L', -20, 0, 20, gw); P.set('hand_R', -20, 0, -20, gw);
        P.reach('_L', C.groundL, gw); P.reach('_R', C.groundR, gw);
        const hw = win(t, 0.44, 0.6, 0.8, 0.92);
        tmpC.copy(C.hold).addScaledVector(lateral(), 0.15); tmpD.copy(C.hold).addScaledVector(lateral(), -0.15);
        P.set('hand_L', 0, 0, -10, hw); P.set('hand_R', 0, 0, 10, hw); P.reach('_L', tmpC, hw); P.reach('_R', tmpD, hw);
        const tw = win(t, 0.82, 0.94, 1.06, 1.32); P.add('chest', -10 * win(t, 0.8, 0.9, 0.92, 1.0) + 8 * win(t, 0.98, 1.04, 1.1, 1.3), 0, 0);
        tmpC.copy(C.up).addScaledVector(lateral(), 0.18); tmpD.copy(C.up).addScaledVector(lateral(), -0.18);
        P.reach('_L', tmpC, tw); P.reach('_R', tmpD, tw);
      } },
      snow: { dur: 1.3, rel: 0.94, scoop: 0.22, reach: 0, pop: 'Хоп!', popCol: 'blue', snd: 'throw', pose(t, c) {
        const sc = win(t, 0, 0.16, 0.26, 0.42); P.crouch(32 * sc); P.add('spine', 22 * sc, 0, 0); P.add('chest', 8 * sc, 0, 0);
        const gw = win(t, 0.06, 0.16, 0.24, 0.36); P.reach('_L', C.groundL, gw);
        const pat = win(t, 0.34, 0.44, 0.58, 0.68);
        tmpC.copy(C.hold).addScaledVector(lateral(), 0.06); tmpC.y += 0.02 * Math.sin(t * 34); tmpD.copy(C.hold).addScaledVector(lateral(), -0.07);
        P.reach('_L', tmpC, pat); P.reach('_R', tmpD, pat);
        const wind = win(t, 0.62, 0.76, 0.84, 0.9);
        P.set('upperarm_L', -150, 0, 42, wind); P.set('forearm_L', -115, 0, 0, wind); P.add('chest', -6, 24, 0, wind); P.add('spine', 0, 8, 0, wind); P.hips(0, 0, -0.03 * wind);
        const thr = win(t, 0.86, 0.93, 1.0, 1.22);
        tmpC.copy(C.throwAt); tmpC.y += 0.9; P.add('chest', 10, -20, 0, thr); P.add('spine', 4, -8, 0, thr); P.hips(0, 0, 0.05 * thr); P.set('hand_L', 30, 0, 0, thr);
        P.reach('_L', tmpC, thr);
      } },
      giggle: { dur: 1.35, reach: 0, pose(t, c) {
        const w = win(t, 0, 0.15, 1.0, 1.35);
        P.add('chest', 6 * Math.sin(t * 24) * w, 0, 0); P.add('spine', -6 * w, 0, 0); P.add('head', (-12 + 4 * Math.sin(t * 12)) * w, 10 * Math.sin(t * 6) * w, 6 * w);
        P.add('shoulder_L', 0, 0, 6 * Math.abs(Math.sin(t * 12)) * w); P.add('shoulder_R', 0, 0, -6 * Math.abs(Math.sin(t * 12)) * w);
        if (leftFree()) { const hw = win(t, 0.05, 0.25, 0.95, 1.2); tmpC.copy(C.mouth).addScaledVector(C.fwd, 0.05); P.set('hand_L', 0, 0, 30, hw); P.reach('_L', tmpC, hw); }
      } },
      sitlaugh: { dur: 2.95, reach: 0, lock: true, pose(t, c) {
        const d = easeInOut(win(t, 0, 0.32, 2.4, 2.9));
        P.hips(0, -0.69 * d + 0.04 * bump(t, 0.38, 0.05), -0.1 * d);
        P.set('thigh_L', -84, 0, 8, d); P.set('thigh_R', -84, 0, -8, d); P.set('shin_L', 10, 0, 0, d); P.set('shin_R', 10, 0, 0, d);
        P.set('foot_L', 0, 0, 0, d); P.set('foot_R', 0, 0, 0, d); P.set('coat_L', -46, 0, 6, d); P.set('coat_R', -46, 0, -6, d);
        P.set('spine', -14, 0, 0, d); P.set('chest', -6, 0, 0, d);
        P.set('upperarm_L', 38, 0, 26, d); P.set('upperarm_R', 38, 0, -26, d); P.set('forearm_L', -8, 0, 0, d); P.set('forearm_R', -8, 0, 0, d); P.set('hand_L', 70, 0, 0, d); P.set('hand_R', 70, 0, 0, d);
        const lt = win(t, 0.35, 0.55, 2.15, 2.4);
        P.add('chest', 7 * Math.sin(t * 21) * lt, 0, 0); P.add('spine', -10 * lt, 0, 0); P.add('head', (-16 + 6 * Math.sin(t * 10)) * lt, 8 * Math.sin(t * 5.5) * lt, 0);
        P.add('thigh_L', 10 * Math.sin(t * 9) * lt, 0, 0); P.add('thigh_R', -10 * Math.sin(t * 9) * lt, 0, 0);
      } },
    };
    function hipPose(t, k) {
      const wind = win(t, 0, 0.1, 0.13, 0.2), str = win(t, 0.16, 0.28, 0.36, 0.6);
      P.hips(-0.04 * wind + 0.075 * k * str, 0, 0); P.add('hips', 0, 0, (4 * wind - 9 * k * str)); P.add('spine', 0, 0, (-3 * wind + 14 * k * str)); P.add('chest', 0, 0, 6 * k * str);
      P.set('upperarm_L', -20, 0, 40, str); P.set('upperarm_R', -30, 0, -55, str); P.set('forearm_R', -40, 0, 0, str);
      P.add('head', 0, 18 * str, -8 * str); P.add('thigh_R', 0, 0, -6 * str);
    }
    const lateral = () => tmpA.set(Math.cos(heroYaw()), 0, -Math.sin(heroYaw()));

    /* ---------- молоточек ---------- */
    let ownHammer = null;
    function leftItem() { try { return IA && IA.holding ? IA.holding('L') : null; } catch (e) { return null; } }
    function hasHammer() { const it = leftItem(); return !!((it && (it.name === 'squeaky_hammer' || (it.userData && it.userData.pfHammer))) || ownHammer); }
    function leftFree() { return !leftItem() && !ownHammer; }
    function giveHammer() {
      if (hasHammer()) return true;
      if (!leftFree()) return false;
      if (IA && IA.give && window.Interact) { const m = hammerItem(T, window.Interact, o.gradientMap); const r = IA.give(m, 'L'); if (r) return true; m.userData.pfDispose(); }
      if (!B) return false;
      ownHammer = makeHammer(T, o.gradientMap);
      // как Interact: центр кулака GRIP, предмет повёрнут на +90° вокруг x (вверх предмета — вдоль большого пальца)
      ownHammer.position.copy(GRIPV); ownHammer.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), PI / 2);
      B.hand_L.add(ownHammer);
      return true;
    }
    function dropHammer() {
      if (ownHammer) { ownHammer.userData.pfDispose(); ownHammer = null; return true; }
      const it = leftItem(); if (it && (it.name === 'squeaky_hammer' || (it.userData && it.userData.pfHammer)) && IA.drop) { const d = IA.drop('L'); if (d && d.userData.it) d.userData.it.dispose(); else if (d && d.userData.pfDispose) d.userData.pfDispose(); return true; }
      return false;
    }
    function hammerMesh() { if (ownHammer) return ownHammer; const it = leftItem(); return it && (it.name === 'squeaky_hammer' || (it.userData && it.userData.pfHammer)) ? it : null; }

    /* =====================================================================
       ЖИТЕЛИ: реакции на прослойке
       ===================================================================== */
    const RX = new Map(), RXA = [];          // жители в реакции: поиск по жителю и список для обхода (без выделений в кадре)
    function rxDrop(R) { RX.delete(R.n); const i = RXA.indexOf(R); if (i >= 0) { RXA[i] = RXA[RXA.length - 1]; RXA.length--; } }
    function attachPivot(R) {
      const root = R.root, p = new T.Group(); p.name = 'playfight:pivot';
      R.kids = root.children.slice();
      R.kids.forEach(k => p.add(k));
      root.add(p); R.pivot = p;
    }
    function detachPivot(R) {
      const p = R.pivot, root = R.root; if (!p) return;
      const extra = root.children.filter(c => c !== p);
      extra.forEach(c => root.remove(c));
      root.remove(p);
      R.kids.forEach(k => { if (k.parent === p) root.add(k); });
      p.children.slice().forEach(k => root.add(k));     // что положили в прослойку во время реакции — тоже на корень
      extra.forEach(c => root.add(c));
      R.pivot = null;
    }
    function rxGet(n) {
      let R = RX.get(n);
      if (!R) {
        R = { n, root: n.root, pivot: null, kids: null, body: null, base: null, cur: null, q: [], dirW: V(), dirL: V(), r: 0.3, head: headOf(n), persona: personaOf(n), slideDone: 0, flag: null };
        if (n.pfBody && n.pfBody.isObject3D) {
          // «тело» отдельно от корня (зверята одной сеткой со скелетом — свадьба): узел, которым владеет только этот слой
          // (например, пустая кость между корнем и телом); его покой запоминаем и в конце возвращаем; headY — в метрах мира
          R.body = n.pfBody; R.base = { p: R.body.position.clone(), q: R.body.quaternion.clone(), s: R.body.scale.clone() };
          const fr = R.body.parent || R.root; R.r = npcRadius(n) / scaleOf(fr); R.head = headOf(n) / scaleOf(fr);
        } else { R.r = npcRadius(n) / scaleOf(n.root); attachPivot(R); }
        RX.set(n, R); RXA.push(R);
        heroPos(pH); npcPos(n, pN); setDir(R, pN.x - pH.x, pN.z - pH.z);
      }
      return R;
    }
    function setDir(R, dx, dz) { const l = Math.hypot(dx, dz); if (l < 1e-4) { R.root.getWorldQuaternion(tmpQ); tmpA.set(0, 0, -1).applyQuaternion(tmpQ); dx = tmpA.x; dz = tmpA.z; } const l2 = Math.hypot(dx, dz) || 1; R.dirW.set(dx / l2, 0, dz / l2); }
    function rxPlay(R, kind, opt) {
      const K = RK[kind]; if (!K) return;
      if (R.cur && RK[R.cur.kind].end) RK[R.cur.kind].end(R, R.cur);
      R.cur = { kind, t: 0, opt: opt || {}, dur: typeof K.dur === 'function' ? K.dur(R, opt || {}) : K.dur, fired: {}, slid: 0 };
      if (K.start) K.start(R, R.cur);
    }
    function rxEnd(R) {
      if (R.cur && RK[R.cur.kind] && RK[R.cur.kind].end) RK[R.cur.kind].end(R, R.cur);
      if (R.flag) { R.flag.visible = false; R.flag.userData.live = false; R.flag = null; }
      restoreNode(R); rxDrop(R); emit('restore', { npc: R.n.id });
    }
    const once = (c, key, at) => { if (c.fired[key] || c.t < at) return false; c.fired[key] = true; return true; };
    // отлёт по направлению удара (через moveNpc: столкновения и землю решает игра)
    function slide(R, c, dist, t0, t1, ease) {
      const u = (ease || easeOut)(clamp((c.t - t0) / (t1 - t0), 0, 1)), want = dist * u, d = want - c.slid;
      if (Math.abs(d) > 1e-5) { moveNpc(R.n, R.dirW.x * d, R.dirW.z * d); c.slid = want; }
    }
    function restoreNode(R) { if (R.body) { R.body.position.copy(R.base.p); R.body.quaternion.copy(R.base.q); R.body.scale.copy(R.base.s); R.body = null; } else detachPivot(R); }
    const space = R => { const o = R.pivot || R.body || R.root; if (R.body) o.updateWorldMatrix(true, false); return o; };
    const headW = (R, out, up) => space(R).localToWorld(out.set(0, R.head + (up || 0.1), 0));
    // кольцо звёздочек: над головой по вертикали мира (и когда житель лежит — над лицом, а не внутри головы)
    const ringW = (R, out, up) => { const o = space(R); o.localToWorld(out.set(0, R.head * 0.8, 0)); out.y += (R.head * 0.17 + (up === undefined ? 0.03 : up)) * scaleOf(R.body ? (R.body.parent || R.root) : R.root); return out; };
    const X = { tilt: 0, tk: 1, ty: 0, spin: 0, yaw: 0, wob: 0, lift: 0, sq: 1, ox: 0, oz: 0 };
    const resetX = () => { X.tilt = 0; X.tk = 1; X.ty = 0; X.spin = 0; X.yaw = 0; X.wob = 0; X.lift = 0; X.sq = 1; X.ox = 0; X.oz = 0; };
    const cq = Q(), cq1 = Q(), cq2 = Q(), cax = V(), cP = V();
    const VP = { position: V(), quaternion: Q(), scale: V() };
    function composePivot(R) {
      const p = R.pivot || (R.body ? VP : null); if (!p) return;
      // направление удара — в осях корня (корень жителя может поворачиваться: жизнь города смотрит на героиню)
      if (R.body) { (R.body.parent || R.root).getWorldQuaternion(tmpQ); tmpQ.multiply(R.base.q); } else R.root.getWorldQuaternion(tmpQ);
      tmpQ.invert(); R.dirL.copy(R.dirW).applyQuaternion(tmpQ); R.dirL.y = 0;
      if (R.dirL.lengthSq() < 1e-8) R.dirL.set(0, 0, -1); R.dirL.normalize();
      const dl = R.dirL;
      cax.set(dl.z, 0, -dl.x); cq.setFromAxisAngle(cax, X.tilt);          // наклон «верхом к направлению удара»
      cq1.setFromAxisAngle(dl, X.wob); cq.multiply(cq1);                   // покачивание из стороны в сторону
      cq2.setFromAxisAngle(UP, X.spin + X.yaw); cq.multiply(cq2);          // кружение вокруг себя
      cP.set(dl.x * R.r * X.tk, X.ty, dl.z * R.r * X.tk);                  // точка опоры (край «пятки», центр клубка…)
      p.quaternion.copy(cq);
      p.position.copy(cP).sub(tmpA.copy(cP).applyQuaternion(cq));
      p.position.y += X.lift; p.position.x += X.ox; p.position.z += X.oz;
      const sq = clamp(X.sq, 0.3, 2), s = 1 / Math.sqrt(sq); p.scale.set(s, sq, s);
      if (R.body) {   // узел-тело: покой · прослойка (как если бы прослойка была его ребёнком)
        const b = R.body, B0 = R.base;
        b.position.copy(VP.position).multiply(B0.s).applyQuaternion(B0.q).add(B0.p);
        b.quaternion.copy(B0.q).multiply(VP.quaternion);
        b.scale.copy(B0.s).multiply(VP.scale);
      }
    }
    function holdNpc(n, sec) { if (typeof n.faceHero !== 'number' || n.faceHero < sec) { try { n.faceHero = sec; } catch (e) { /* только чтение */ } } }
    const crit = n => (n.I && n.I.st ? n.I : null);
    const kick = (t, a) => Math.sin(Math.min(1, t / (a || 0.09)) * PI / 2);

    // виды реакций: dur, start, eval (пишет X, может звать эффекты), end
    const RK = {
      stagger: { dur: 0.8, eval(R, c) {
        X.tilt = 0.36 * kick(c.t) * Math.exp(-4.2 * c.t) * Math.cos(10 * c.t); X.tk = 0.9;
        X.sq = 1 - 0.12 * bump(c.t, 0.05, 0.05);
        slide(R, c, R.persona.soft ? 0.18 : 0.13, 0, 0.2);
        if (once(c, 'fx', 0.02)) starBurst(headW(R, tmpB, 0.02).clone(), 3);
      } },
      spin: { dur: 1.15, eval(R, c) {
        X.spin = TAU * 1.5 * easeOut(clamp(c.t / 0.78, 0, 1)); X.wob = 0.2 * Math.sin(c.t * 14) * (1 - c.t / 1.15);
        X.lift = 0.09 * Math.sin(PI * clamp(c.t / 0.36, 0, 1)); X.sq = 1 + 0.1 * Math.sin(PI * clamp(c.t / 0.36, 0, 1));
        slide(R, c, 0.22, 0, 0.32);
        if (once(c, 'orb', 0.3)) orbit(o2 => ringW(R, o2), 0.95, { birds: 0, stars: 4 });
      } },
      tumble: { dur: 3.3, eval(R, c) {
        const t = c.t, soft = R.persona.soft ? 1 : 0, LIE = 1.42;
        if (t < 0.42) { X.tilt = LIE * easeIn(t / 0.42); X.sq = 1 + 0.08 * Math.sin(PI * t / 0.42); }
        else if (t < 0.62) { X.tilt = LIE - (0.22 + 0.1 * soft) * Math.sin(PI * (t - 0.42) / 0.2); X.lift = (0.04 + 0.04 * soft) * Math.sin(PI * (t - 0.42) / 0.2); }
        else if (t < 2.1) { X.tilt = LIE; X.wob = 0.08 * Math.sin(t * 9); X.sq = 1 + 0.03 * Math.sin(t * 6); }
        else if (t < 2.56) { const u = (t - 2.1) / 0.46; X.tilt = LIE * (1 - backOut(u)); X.lift = 0.06 * Math.sin(PI * u); }
        else { const u = (t - 2.56) / 0.74; X.wob = 0.32 * Math.sin(TAU * 5 * u) * (1 - u); X.sq = 1 + 0.08 * Math.sin(TAU * 5 * u) * (1 - u); }
        X.tk = 1; slide(R, c, 0.36 + 0.06 * soft, 0, 0.48);
        if (once(c, 'land', 0.42)) { npcPos(R.n, tmpB); tmpB.addScaledVector(R.dirW, R.r * scaleOf(R.root) * 1.6); puffs(tmpB, 6, 0xE8DCCB, 0.13, 0.5); sfx('thud'); popText('Бух!', tmpB.clone().setY(tmpB.y + 0.3), { h: 0.2 }); }
        if (once(c, 'orb', 0.48)) orbit(o2 => ringW(R, o2), 1.5, {});
        if (once(c, 'shake', 2.6)) sfx('pop');
      } },
      curl: { dur: 3.0, eval(R, c) {           // ёжик: клубочек, катится, звёздочки, разворачивается
        const t = c.t;
        X.ty = R.head * 0.26; X.tk = 0;
        X.sq = t < 0.2 ? 1 - 0.38 * easeOut(t / 0.2) : t < 2.4 ? 0.62 : 0.62 + 0.38 * backOut(clamp((t - 2.4) / 0.4, 0, 1));
        X.tilt = TAU * 1.5 * easeOut(clamp((t - 0.15) / 0.85, 0, 1));
        X.lift = t > 2.4 ? 0.1 * Math.sin(PI * clamp((t - 2.4) / 0.35, 0, 1)) : 0;
        slide(R, c, 0.7, 0.15, 1.0);
        if (once(c, 'orb', 1.0)) orbit(o2 => R.root.localToWorld(o2.set(0, R.head * 0.75, 0)), 1.4, {});
        if (once(c, 'say', 2.45)) sayKind(R.n, 'curl');
      } },
      gentle: { dur: 1.4, eval(R, c) {        // бабушки: не падают — качаются и смеются
        X.wob = 0.2 * Math.sin(c.t * 12) * Math.exp(-2 * c.t); X.tilt = 0.1 * kick(c.t) * Math.exp(-3 * c.t); X.tk = 0.8;
        if (once(c, 'h', 0.25)) hearts(headW(R, tmpB, 0.2).clone(), 2);
      } },
      squash: { dur: 1.75, eval(R, c) {       // молоточек: «боинг» — сплющился и спружинил; звёздочки и птички
        const t = c.t; X.sq = 1 - 0.36 * Math.exp(-5.5 * t) * Math.cos(17 * t); X.tk = 0;
        X.wob = 0.06 * Math.sin(t * 8) * (1 - sst(1.2, 1.7, t));
        if (once(c, 'orb', 0.05)) orbit(o2 => ringW(R, o2), 1.5, {});
      } },
      squash2: { dur: 1.95, eval(R, c) {
        const t = c.t, t2 = Math.max(0, t - 0.35);
        X.sq = 1 - 0.3 * Math.exp(-6 * t) * Math.cos(17 * t) - (t > 0.35 ? 0.34 * Math.exp(-5.5 * t2) * Math.cos(17 * t2) : 0); X.tk = 0;
        if (once(c, 'orb', 0.05)) orbit(o2 => ringW(R, o2), 1.5, {});
      } },
      flip: { dur: 2.5, eval(R, c) {          // пальтар: кувырок назад с размахом, сел, звёздочки, вскочил и поклонился
        const t = c.t;
        X.ty = R.head * 0.45; X.tk = 0;
        if (t < 0.72) { const u = t / 0.72; X.tilt = TAU * easeInOut(u); X.lift = 0.55 * Math.sin(PI * u); X.sq = 1 - 0.15 * Math.sin(PI * u); }
        else if (t < 0.9) { X.sq = 1 - 0.25 * Math.sin(PI * (t - 0.72) / 0.18); }
        else if (t < 1.65) { X.tilt = 0.18 + 0.05 * Math.sin(t * 9); X.ty = 0; X.tk = 1; X.wob = 0.1 * Math.sin(t * 7); }
        else if (t < 1.95) { X.lift = 0.12 * Math.sin(PI * (t - 1.65) / 0.3); X.tilt = 0.18 * (1 - (t - 1.65) / 0.3); X.ty = 0; X.tk = 1; }
        else { X.tilt = -0.72 * win(t, 1.95, 2.12, 2.3, 2.5); X.ty = 0; X.tk = -0.6; }
        slide(R, c, 0.55, 0, 0.72, easeInOut);
        if (once(c, 'say', 0.08)) sayKind(R.n, 'tumble');
        if (once(c, 'land', 0.72)) { npcPos(R.n, tmpB); puffs(tmpB, 5, 0xE8DCCB, 0.13, 0.5); sfx('thud'); sfx('jingle'); }
        if (once(c, 'orb', 0.8)) orbit(o2 => ringW(R, o2), 1.05, {});
      } },
      bow: { dur: 1.2, eval(R, c) { X.tilt = -0.75 * win(c.t, 0.05, 0.3, 0.75, 1.1); X.tk = -0.6; } },
      laugh: { dur: 1.9, start(R, c) { sayKind(R.n, 'laugh'); const I = crit(R.n); if (I) I.st.happy = 1; }, eval(R, c) {
        const w = win(c.t, 0, 0.12, 1.6, 1.9);
        X.lift = Math.abs(Math.sin(c.t * 11)) * 0.05 * w; X.tilt = (0.14 + 0.05 * Math.sin(c.t * 11)) * w; X.tk = 0.4; X.wob = 0.08 * Math.sin(c.t * 7) * w;
        if (once(c, 'pop', 0.25)) popText('ха-ха!', headW(R, tmpB, 0.32).clone(), { h: 0.17, col: 'pink', dur: 1.0 });
      }, end(R) { const I = crit(R.n); if (I) I.st.happy = 0; } },
      pout: { dur: 2.3, start(R, c) { sayKind(R.n, 'pout'); }, eval(R, c) {     // дуется понарошку: отвернулся, надул щёки, вернулся
        const w = sst(0.1, 0.5, c.t) * (1 - sst(1.75, 2.2, c.t));
        X.yaw = PI * 0.78 * w; X.sq = 1 - 0.05 * w; X.tilt = -0.08 * w; X.tk = 0.3;
        if (once(c, 'p1', 0.45)) puffs(headW(R, tmpB, 0.12).clone(), 2, 0xEDE6F2, 0.07, 0.15);
        if (once(c, 'p2', 0.9)) puffs(headW(R, tmpB, 0.12).clone(), 2, 0xEDE6F2, 0.07, 0.15);
      } },
      chaseStart: { dur: 0.6, start(R, c) { sayKind(R.n, 'chase'); popText('!', headW(R, tmpB, 0.35).clone(), { h: 0.24, up: 0.1, dur: 0.6 }); }, eval(R, c) {
        X.sq = c.t < 0.3 ? 1 - 0.15 * Math.sin(PI * c.t / 0.3) : 1 + 0.1 * Math.sin(PI * (c.t - 0.3) / 0.3); X.tk = 0;
      } },
      chase: { dur: (R, opt) => opt.dur || 5, start(R, c) { c.v = 0; emit('chase', { npc: R.n.id }); }, eval(R, c, dt) {
        if (!heroFree() && c.t > 0.05) { c.t = c.dur; return; }        // героиня села в машину / ушла в диалог — «Уф! Ты быстрая!»
        heroPos(pH); npcPos(R.n, pN);
        const dx = pH.x - pN.x, dz = pH.z - pN.z, d = Math.hypot(dx, dz);
        const V0 = R.persona.speed || 2.4; c.v = Math.min(V0, c.v + dt * 5);
        if (d > 0.05) { const st = Math.min(d - 0.2, c.v * dt); if (st > 0) moveNpc(R.n, dx / d * st, dz / d * st); }
        setDir(R, -dx, -dz);                               // «назад» = от героини: наклон вперёд — отрицательный
        X.lift = Math.abs(Math.sin(c.t * 15)) * 0.07; X.tilt = -0.2; X.tk = 0; X.wob = 0.12 * Math.sin(c.t * 15);
        const I = crit(R.n); if (I) I.st.spd = c.v;
        R.n.pfRun = c.v;                                   // жизнь города (residents.js) берёт скорость шага отсюда, пока догоняет
        if (d < npcRadius(R.n) + 0.4 && c.t > 0.3) { c.caught = true; c.t = c.dur; }
      }, end(R, c) { const I = crit(R.n); if (I) I.st.spd = 0; R.n.pfRun = 0; } },
      caughtLie: { dur: 2.9, start(R, c) { sayKind(R.n, 'caught'); emit('caught', { npc: R.n.id }); }, eval(R, c) {
        const t = c.t, d = win(t, 0, 0.3, 2.35, 2.85);
        X.tilt = 1.38 * easeInOut(d); X.tk = 1; X.wob = 0.26 * Math.sin(t * 9) * win(t, 0.3, 0.5, 2.1, 2.35);
        if (once(c, 'pop', 0.4)) popText('ха-ха-ха!', headW(R, tmpB, 0.3).clone(), { h: 0.2, col: 'pink', dur: 1.2 });
        if (once(c, 'h', 0.9)) hearts(headW(R, tmpB, 0.2).clone(), 2);
      } },
      giveup: { dur: 1.7, start(R, c) { sayKind(R.n, 'giveup'); emit('giveup', { npc: R.n.id }); }, eval(R, c) {
        const w = win(c.t, 0, 0.2, 1.3, 1.7); X.tilt = -0.28 * w; X.tk = -0.5; X.sq = 1 + 0.04 * Math.sin(c.t * 16) * w;
      } },
      surrender: { dur: 2.6, start(R, c) {
        sayKind(R.n, 'surrender'); emit('surrender', { npc: R.n.id }); R.flag = flagGet();
        // платочек — с той стороны жителя, что дальше от героини на экране (иначе его закрывают волосы и берет героини)
        c.sx = 1;
        if (o.camera && o.camera.isObject3D) {
          o.camera.getWorldQuaternion(bQ); bR.set(1, 0, 0).applyQuaternion(bQ);
          heroPos(pH); npcPos(R.n, pN); const side = (pN.x - pH.x) * bR.x + (pN.z - pH.z) * bR.z;
          R.root.getWorldQuaternion(tmpQ); tmpA.set(1, 0, 0).applyQuaternion(tmpQ);
          c.sx = (tmpA.x * bR.x + tmpA.z * bR.z) * (Math.abs(side) > 0.05 ? side : 1) >= 0 ? 1 : -1;
        }
      }, eval(R, c) {
        X.lift = Math.abs(Math.sin(c.t * 8)) * 0.04; X.tilt = -0.1; X.tk = 0;
        const f = R.flag; if (f) {
          // поднятая лапка спереди-сбоку; платочек крупный (×1,4), над головой, машет широко в сторону
          const fs = clamp(R.head / 1.15, 0.55, 1.1) * 1.4, sx = c.sx || 1;
          R.root.localToWorld(tmpB.set(sx * R.r * 0.8, R.head * 0.66, R.r * 0.45)); f.position.copy(tmpB);
          R.root.getWorldQuaternion(f.quaternion); tmpQ.setFromAxisAngle(tmpA.set(0, 0, 1), sx * (-0.45 + 0.35 * Math.sin(c.t * 8))); f.quaternion.multiply(tmpQ);
          if (sx < 0) { tmpQ.setFromAxisAngle(UP, PI); f.quaternion.multiply(tmpQ); }      // зеркально: полотно — наружу
          f.scale.setScalar(scaleOf(R.root) * fs);
          f.userData.cloth.rotation.y = 0.35 + 0.3 * Math.sin(c.t * 12); const k = c.t < 0.2 ? backOut(c.t / 0.2) : 1 - sst(2.3, 2.6, c.t); f.scale.multiplyScalar(Math.max(0.001, k));
        }
      }, end(R) { if (R.flag) { R.flag.visible = false; R.flag.userData.live = false; R.flag = null; } } },
      wiggle: { dur: 1.35, start(R, c) { const I = crit(R.n); if (I) { I.st.happy = 1; if (I.hop) I.hop(); } else if (R.n.hop) R.n.hop(); }, eval(R, c) {   // зверёк: радостно виляет
        X.wob = 0.22 * Math.sin(c.t * 20) * (1 - c.t / 1.35); X.lift = 0.05 * Math.abs(Math.sin(c.t * 10)) * (1 - c.t / 1.35); X.tk = 0;
        if (once(c, 'h1', 0.08)) hearts(headW(R, tmpB, 0.1).clone(), 1);
        if (once(c, 'h2', 0.5)) hearts(headW(R, tmpB, 0.1).clone(), 1);
      }, end(R) { const I = crit(R.n); if (I) I.st.happy = 0; } },
      sneeze: { dur: 1.35, eval(R, c) {
        const t = c.t; X.tk = 0.2;
        if (t < 0.45) { X.tilt = 0.25 * easeIn(t / 0.45); X.sq = 1 + 0.08 * (t / 0.45); }
        else { const u = (t - 0.45) / 0.9; X.tilt = u < 0.33 ? lerp(0.25, -0.38, Math.sin(PI / 2 * u / 0.33)) : -0.38 * (1 - (u - 0.33) / 0.67); X.sq = 1 - 0.08 * bump(u, 0.15, 0.1); }
        if (once(c, 'say', 0.45)) { const l = sayKind(R.n, 'sneeze'); if (!l || !/Апчхи/.test(l.text)) popText('Апчхи!', headW(R, tmpB, 0.3).clone(), { h: 0.2, col: 'green' }); }
      } },
      snowHit: { dur: 0.9, eval(R, c) {
        X.tilt = 0.26 * kick(c.t) * Math.exp(-4.5 * c.t) * Math.cos(9 * c.t); X.tk = 0.8; X.wob = 0.1 * Math.sin(c.t * 18) * (1 - c.t / 0.9);
      } },
      npcThrow: { dur: 0.95, eval(R, c) {      // житель кидает в ответ (снежок / охапку листьев)
        const t = c.t; heroPos(pH); npcPos(R.n, pN); setDir(R, pN.x - pH.x, pN.z - pH.z);
        X.tk = 0; X.tilt = t < 0.4 ? 0.3 * easeOut(t / 0.4) : t < 0.52 ? lerp(0.3, -0.28, (t - 0.4) / 0.12) : -0.28 * (1 - (t - 0.52) / 0.43);
        X.sq = t < 0.4 ? 1 - 0.1 * (t / 0.4) : 1;
        if (once(c, 'say', 0.05) && rand() < 0.5) sayKind(R.n, 'throw');
        if (once(c, 'rel', 0.46)) npcRelease(R, c.opt.what || 'snow');
      } },
      sparIdle: { dur: (R, opt) => opt.dur || 1e9, start(R, c) { c.ang = null; }, eval(R, c, dt) {    // пальтар: прыгает вокруг, «боксирует» понарошку
        heroPos(pH); npcPos(R.n, pN);
        if (c.ang === null) c.ang = Math.atan2(pN.x - pH.x, pN.z - pH.z);
        c.ang += dt * 1.05;
        const rr = 1.15, tx = pH.x + Math.sin(c.ang) * rr, tz = pH.z + Math.cos(c.ang) * rr, dx = tx - pN.x, dz = tz - pN.z, d = Math.hypot(dx, dz);
        if (d > 0.01) { const st = Math.min(d, 2.0 * dt); moveNpc(R.n, dx / d * st, dz / d * st); }
        setDir(R, pN.x - pH.x, pN.z - pH.z);
        X.lift = Math.abs(Math.sin(c.t * 9)) * 0.12; X.wob = 0.2 * Math.sin(c.t * 4.5); X.yaw = 0.25 * Math.sin(c.t * 9); X.tk = 0; X.sq = 1 + 0.06 * Math.sin(c.t * 18);
        const jk = Math.floor(c.t / 1.6); if (jk !== c.jk) { c.jk = jk; sfx('jingle'); }
      } },
    };

    /* ---------- удар: реакция по виду, серия, «сдаюсь», характер ---------- */
    function onHit(n, act, hitIdx) {
      if (!valid(n)) return;
      const A = act.A, R = rxGet(n), S = statOf(n), pet = isPet(n);
      heroPos(pH); npcPos(n, pN); setDir(R, pN.x - pH.x, pN.z - pH.z);
      holdNpc(n, 2.5);
      // звук и звукоподражание у точки касания
      const at = (A.ham || act.kind === 'spin' ? C.headUp : act.kind === 'boop' ? C.nose : C.chest).clone(); at.y += 0.12;
      if (A.snd) sfx(A.snd); if (A.ham) sfx('squeak');
      popText(A.pop, at, { col: A.popCol, h: A.ham ? 0.28 : 0.25 });
      if (A.ham) squishHammer();
      if (pet) { rxPlay(R, 'wiggle'); R.q = []; if (rand() < 0.6) sayKind(n, 'boop'); emit('boop', { npc: n.id }); return; }
      // эпизоды: удары подряд (серия) — один эпизод; три эпизода за 30 с — «сдаюсь»
      const newEp = now - S.last > 1.7;
      if (newEp) { S.eps.push(now); S.eps = S.eps.filter(x => now - x < 30); }
      S.last = now;
      const P0 = R.persona, sparring = !!(spar && spar.n === n);
      let kind = A.kind;
      if (P0.spar || sparring) kind = A.kind === 'spin' && !(spar && spar.hits >= 2) ? 'spin' : 'flip';
      else if (P0.gentle) kind = 'gentle';
      else if (P0.curl && kind === 'tumble') kind = 'curl';
      if (kind === 'squash2' && hitIdx > 0 && R.cur && R.cur.kind === 'squash2') { /* второй «пиу» той же серии — пружинит дальше */ }
      else rxPlay(R, kind);
      R.q = [];
      const big = kind === 'tumble' || kind === 'curl' || kind === 'flip' || kind === 'squash' || kind === 'squash2';
      // «Ой!» — в начале возни и на большом кувырке (не на каждый тап серии)
      if (!sparring && hitIdx === 0 && kind !== 'flip' && (newEp || kind === 'tumble' || kind === 'curl' || kind === 'squash')) sayKind(n, 'oops');
      emit('hit', { npc: n.id, act: act.kind, kind, combo: act.combo || 0, eps: S.eps.length });
      if (kind === 'tumble' || kind === 'curl' || kind === 'flip') emit('tumble', { npc: n.id, kind });
      if (sparring) { spar.hits++; spar.lastHit = now; if (spar.hits >= 3) { R.q = ['bow']; spar.done = true; } else R.q = ['sparIdle']; return; }
      R.pending = { big, final: act.combo === 3 || A.kind === 'tumble' || !act.comboNext };
    }
    // после возни (серия закончилась): характер или «сдаюсь»
    function afterEpisode(R) {
      const n = R.n, S = statOf(n), P0 = R.persona, pend = R.pending; R.pending = null;
      if (!pend) return;
      if (S.eps.length >= 3) { S.surrender = now + 60; politeUntil = Math.max(politeUntil, S.surrender); S.eps = []; R.q.push('surrender'); return; }
      let r = pick(P0.react || ['laugh']);
      if (r === 'chase' && (!pend.big || P0.gentle || chaseOn())) r = rand() < 0.5 ? 'laugh' : 'pout';
      if (P0.gentle) r = 'laugh';
      S.react++;
      emit('react', { npc: n.id, react: r });
      if (r === 'chase') { R.q.push('chaseStart'); R.q.push({ kind: 'chase', opt: { dur: 4 + rand() * 2 } }); }
      else R.q.push(r);
    }
    const chaseOn = () => { for (let i = 0; i < RXA.length; i++) { const c = RXA[i].cur; if (c && (c.kind === 'chase' || c.kind === 'chaseStart')) return true; } return false; };

    /* ---------- молоточек: «пищит» — сжимается на миг ---------- */
    let hamSquish = -1;
    function squishHammer() { hamSquish = 0; }
    function updHammer(dt) {
      const m = hammerMesh(); if (!m) { hamSquish = -1; return; }
      if (hamSquish >= 0) { hamSquish += dt; const s = 1 - 0.22 * Math.exp(-14 * hamSquish) * Math.cos(26 * hamSquish); m.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); if (hamSquish > 0.4) { hamSquish = -1; m.scale.setScalar(1); } }
    }

    /* =====================================================================
       ДЕЙСТВИЕ ГЕРОИНИ: старт, подход, поворот, касания
       ===================================================================== */
    let act = null, combo = 0, comboUntil = -1, comboN = null, queued = 0;
    function actKindFor(tg) {
      if (tg.pet) return 'boop';
      const nextCombo = (comboN === tg.n && now < comboUntil) ? combo % 3 + 1 : 1;
      if (hasHammer()) return ['ham1', 'ham2', 'ham3'][nextCombo - 1];
      if (!leftFree()) return ['hip1', 'hip2', 'hip3'][nextCombo - 1];
      return ['push', 'spin', 'slap'][nextCombo - 1];
    }
    function startAct(kind, n, extra) {
      const A = ACTS[kind];
      act = Object.assign({ kind, A, t: 0, n, hitI: 0, yaw0: heroYaw(), moved: 0, combo: 0 }, extra || {});
      if (n && valid(n)) {
        holdNpc(n, A.dur + 1.2);              // житель остановится и повернётся к ней (жизнь города: faceHero)
        heroPos(pH); npcPos(n, pN);
        const dx = pN.x - pH.x, dz = pN.z - pH.z, d = Math.hypot(dx, dz);
        const yf = Math.atan2(dx, dz);
        act.yawT = A.side ? yf - PI / 2 : yf;
        if (A.nose) {
          // буп: встать так, чтобы носик оказался на A.nose м впереди — колени в присяде не упираются зверьку в мордочку.
          // Зверёк сейчас повернётся к ней (faceHero), поэтому носик считаем спереди: центр − (голова от центра + носик)
          const s0 = scaleOf(n.root), hb = n.I && n.I.B && (n.I.B.head || n.I.B.momHead);
          let front = (npcRadius(n) / s0 + 0.1) * s0;
          if (hb && hb.isObject3D) { hb.getWorldPosition(tmpC); front = Math.hypot(tmpC.x - pN.x, tmpC.z - pN.z) + clamp(headOf(n) * 0.24, 0.07, 0.16) * s0; }
          act.need = clamp(d - front - A.nose, -0.35, 1.0);
          act.ndir = d > 1e-4 ? [dx / d, dz / d] : [Math.sin(act.yaw0), Math.cos(act.yaw0)];
        } else if (A.reach) {
          const want = A.reach + npcRadius(n) * 0.75;
          act.need = clamp(d - want, -0.25, 1.0);
          act.ndir = d > 1e-4 ? [dx / d, dz / d] : [Math.sin(act.yaw0), Math.cos(act.yaw0)];
        }
      }
      if (kind === 'boop' && !leftFree()) act.side = '_R';
      return act;
    }
    function bonk() {
      if (!enabled || disposed) return false;
      if (act && (act.A.lock || act.kind === 'leaves' || act.kind === 'snow')) return false;
      if (act && act.kind === 'giggle') act = null;          // хихиканье не мешает: новый тап его сменяет
      try { if (IA && IA.busy && IA.busy()) return false; } catch (e) { /* нет */ }
      // во время удара: следующий тап — следующий шаг серии (когда текущий «ударил»)
      if (act && act.n && ACTS[act.kind] && ACTS[act.kind].hits) { queued = 1; return true; }
      const tg = findTarget(RANGE);
      if (!tg) { emit('miss', {}); return false; }
      if (tg.paltar && !tg.pet && !spar && sparCool < now) { startSpar(tg.n); return true; }
      const kind = actKindFor(tg);
      if (kind !== 'boop') { combo = (comboN === tg.n && now < comboUntil) ? combo % 3 + 1 : 1; comboN = tg.n; }
      startAct(kind, tg.n, { combo: kind === 'boop' ? 0 : combo, comboNext: kind !== 'boop' && combo < 3 });
      sfx('whoosh');
      return true;
    }
    function updateAct(dt) {
      if (!act) return;
      const A = act.A; act.t += dt;
      const t = act.t;
      // повернуться к жителю (первые 0.15 с) и подойти (первые 0.2 с)
      if (act.yawT !== undefined && !act.turned) { const u = easeOut(clamp(t / 0.15, 0, 1)); setYaw(act.yaw0 + angW(act.yawT - act.yaw0) * u); if (u >= 1) act.turned = true; }
      if (act.need && act.moved < 1) {
        const u = easeOut(clamp(t / 0.2, 0, 1)), d = (u - act.moved) * act.need; act.moved = u;
        if (Math.abs(d) > 1e-5) moveHero(act.ndir[0] * d, act.ndir[1] * d);
      }
      targetPoints(act.n);
      // касания
      if (A.hits) while (act.hitI < A.hits.length && t >= A.hits[act.hitI]) { const i = act.hitI++; if (act.n) onHit(act.n, act, i); comboUntil = now + (A.dur - t) + 0.9; }
      // следующий тап серии уже нажат: не ждать конца «отдачи» — прошлый шаг плавно тает, новый начинается
      if (queued && A.hits && act.kind !== 'boop' && act.hitI >= A.hits.length && t >= A.hits[A.hits.length - 1] + 0.12) {
        const n = act.n, k = act.kind; queued = 0;
        const tg = n && valid(n) ? findTarget(RANGE + 0.4) : null;
        if (tg && tg.n === n && k !== 'boop') { fading = { act, t0: now }; act = null; bonk(); if (!act) { act = fading.act; fading = null; } return; }
      }
      // листья и снежки
      if (act.kind === 'leaves') { if (!act.ids && t >= A.scoop) { act.ids = leavesHeld(30); sfx('leaves'); } if (!act.thrown && t >= A.rel) { act.thrown = true; throwLeaves(act); } }
      if (act.kind === 'snow') { if (!act.ball && !act.thrown && t >= A.scoop) {   /* после броска новый снежок не лепим (раньше он оставался висеть в мире) */ act.ball = ballGet(); act.ball.scale.setScalar(0.4); } if (act.ball && !act.thrown && t >= A.rel) { act.thrown = true; throwSnow(act); } }
      if (t >= A.dur) {
        const n = act.n, wasHit = !!A.hits, k = act.kind;
        if (act.ids && !act.thrown) act.ids.forEach(i => { LEAF.st[i] = 0; });
        if (act.ball && !act.thrown) ballFree(act.ball);
        act = null;
        if (wasHit && queued) { queued = 0; const tg = n && valid(n) ? findTarget(RANGE + 0.4) : null; if (tg && tg.n === n && k !== 'boop') { bonk(); return; } }
        queued = 0;
      }
    }
    // поза (если есть кости)
    let fading = null;
    function applyPose(dt) {
      if (!B) return;
      if (fading && now - fading.t0 > 0.18) fading = null;
      if ((!act || !act.A.pose) && !fading) { ovRestoreStale(); return; }
      ovBegin();
      if (fading) { fading.act.t += dt; PW = 1 - easeInOut(clamp((now - fading.t0) / 0.18, 0, 1)); fading.act.A.pose(Math.min(fading.act.t, fading.act.A.dur), fading.act); }
      PW = 1;
      if (act && act.A.pose) act.A.pose(act.t, act);
      ovEnd();
    }

    /* =====================================================================
       БРОСКИ: листья (осень), снежки (зима), снежная битва
       ===================================================================== */
    const TOSS_OPT = { noPets: true, cone: 1.3, angK: 1.2 };
    const throwTarget = () => findTarget(TOSS_RANGE, TOSS_OPT);
    function toss() {
      if (!enabled || disposed) return false;
      if (act && act.kind !== 'giggle') return false;          // хихиканье после снежка в пальто не мешает кинуть в ответ
      try { if (IA && IA.busy && IA.busy()) return false; } catch (e) { /* нет */ }
      const se = season(); if (se !== 'autumn' && se !== 'winter') return false;
      if (!leftFree()) return false;
      const tg = throwTarget();
      if (se === 'winter' && !battle) { const near = battleCandidates(); if (near.length >= 3) startBattle(near); }
      if (act) act = null;
      startAct(se === 'winter' ? 'snow' : 'leaves', tg ? tg.n : null);
      if (tg) { act.reach = 0; act.need = 0; }
      emit('toss', { kind: se === 'winter' ? 'snow' : 'leaves', npc: tg ? tg.n.id : null });
      return true;
    }
    const handMid = out => { if (!B) return heroPos(out).setY(out.y + 1.0); B.hand_L.localToWorld(out.copy(PALM._L)); B.hand_R.localToWorld(tmpD.copy(PALM._R)); return out.add(tmpD).multiplyScalar(0.5); };
    const leafHeldAt = V();
    function throwLeaves(a) {
      handMid(tmpB); targetPoints(a.n);
      const to = a.n && valid(a.n) ? C.throwAt.clone() : C.throwAt.clone();
      const d = tmpB.distanceTo(to), T0 = clamp(d / 6, 0.35, 0.9);
      leavesThrow(a.ids || leavesHeld(30), tmpB, to, T0);
      sfx('leaves'); popText('Шурх!', tmpB.clone().addScaledVector(C.fwd, 0.5), { col: 'green', h: 0.2 });
      if (a.n && valid(a.n)) { const n = a.n; later(T0 * 0.95, () => leafArrive(n, to)); }
    }
    function leafArrive(n, to) {
      if (!valid(n)) return;
      npcPos(n, pN); if (Math.hypot(pN.x - to.x, pN.z - to.z) > 1.4) return;
      const R = rxGet(n); holdNpc(n, 2); heroPos(pH); setDir(R, pN.x - pH.x, pN.z - pH.z);
      const P0 = R.persona;
      if (rand() < 0.6) rxPlay(R, 'sneeze'); else rxPlay(R, 'laugh');
      R.q = []; if (rand() < (P0.throwsBack || 0.4)) R.q.push({ kind: 'npcThrow', opt: { what: 'leaves' } });
      emit('leafHit', { npc: n.id });
    }
    function throwSnow(a) {
      const b = a.ball; a.ball = null;
      if (!b) return;
      targetPoints(a.n);
      const from = b.position.clone(), to = C.throwAt.clone();
      if (a.n && valid(a.n)) to.copy(C.throwAt); else to.set(from.x + C.fwd.x * 5, groundY(from.x, from.z), from.z + C.fwd.z * 5);
      b.scale.setScalar(1);
      launch(b, from, to, 'hero', a.n && valid(a.n) ? a.n : null);
      sfx('throw');
    }
    // снаряды: снежок по баллистике; t ≥ T — проверка попадания, иначе падает и рассыпается
    const shots = [];
    const G = 9.8;
    function launch(ball, from, to, who, target) {
      const d = Math.hypot(to.x - from.x, to.z - from.z), Tt = clamp(d / 9 + 0.18, 0.32, 0.95);
      const v = new T.Vector3((to.x - from.x) / Tt, (to.y - from.y) / Tt + 0.5 * G * Tt, (to.z - from.z) / Tt);
      shots.push({ ball, p0: from.clone(), v, t: 0, T: Tt, who, target, checked: false });
    }
    function updShots(dt) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.t += dt;
        const t = s.t, p = s.ball.position;
        p.set(s.p0.x + s.v.x * t, s.p0.y + s.v.y * t - 0.5 * G * t * t, s.p0.z + s.v.z * t);
        s.ball.rotation.x += dt * 9;
        if (!s.checked && t >= s.T) {
          s.checked = true;
          // попадание — в точке прилёта (t = T), а не там, куда снежок успел улететь за длинный кадр (10 к/с)
          p.set(s.p0.x + s.v.x * s.T, s.p0.y + s.v.y * s.T - 0.5 * G * s.T * s.T, s.p0.z + s.v.z * s.T);
          if (s.who === 'hero' && s.target && valid(s.target)) {
            npcPos(s.target, pN); const h = headOf(s.target) * scaleOf(s.target.root);
            const dxz = Math.hypot(p.x - pN.x, p.z - pN.z), dy = p.y - pN.y;
            if (dxz < npcRadius(s.target) + 0.35 && dy > -0.1 && dy < h + 0.25) { snowHitNpc(s.target, p.clone()); ballFree(s.ball); shots.splice(i, 1); continue; }
          }
          if (s.who === 'npc') {
            heroPos(pH);
            const dxz = Math.hypot(p.x - pH.x, p.z - pH.z), dy = p.y - pH.y;
            if (dxz < 0.42 && dy > 0.3 && dy < 1.9) { snowHitHero(p.clone()); ballFree(s.ball); shots.splice(i, 1); continue; }
          }
        }
        const gy = groundY(p.x, p.z);
        if (p.y <= gy + 0.04 || t > 3) { puffs(p.setY(gy + 0.05), 5, 0xFFFFFF, 0.1, 0.35); sfx('splat'); ballFree(s.ball); shots.splice(i, 1); }
      }
    }
    function snowHitNpc(n, at) {
      puffs(at, 8, 0xFFFFFF, 0.11, 0.45); sfx('splat'); popText('Плюх!', at.clone().setY(at.y + 0.2), { col: 'blue', h: 0.21 });
      const R = rxGet(n); holdNpc(n, 2); heroPos(pH); npcPos(n, pN); setDir(R, pN.x - pH.x, pN.z - pH.z);
      // шлепок снега — на «груди» жителя со стороны героини (едет за корнем жителя)
      const root = n.root, loc = root.worldToLocal(at.clone()), h = headOf(n);
      loc.y = clamp(loc.y, h * 0.35, h * 0.95);
      { const l = Math.hypot(loc.x, loc.z) || 1, rr = R.r * 0.95; loc.x = loc.x / l * rr; loc.z = loc.z / l * rr; }
      const yawLocal = Math.atan2(loc.x, loc.z);
      splat((pos, q) => { if (!valid(n)) return false; root.localToWorld(pos.copy(loc)); root.getWorldQuaternion(q); tmpQ.setFromAxisAngle(UP, yawLocal); q.multiply(tmpQ); return true; }, 2.6, 0.9 * scaleOf(root));
      rxPlay(R, 'snowHit'); R.q = [];
      if (battle && battle.npcs.has(n)) { battle.me++; if (rand() < 0.45) sayKind(n, 'snow'); }
      else { if (rand() < 0.7) sayKind(n, 'snow'); if (rand() < (R.persona.throwsBack || 0.5)) R.q.push({ kind: 'npcThrow', opt: { what: 'snow' } }); else R.q.push('laugh'); }
      emit('snowHit', { npc: n.id, me: battle ? battle.me : null });
    }
    function npcRelease(R, what) {
      const n = R.n; if (!valid(n)) return;
      heroPos(pH); npcPos(n, pN);
      const s = scaleOf(n.root), h = headOf(n) * s;
      const from = new T.Vector3(pN.x, pN.y + h * 0.85, pN.z);
      const dx = pH.x - pN.x, dz = pH.z - pN.z, dl = Math.hypot(dx, dz) || 1;
      from.x += dx / dl * (R.r * s + 0.1); from.z += dz / dl * (R.r * s + 0.1);
      // упреждение: куда идёт героиня
      const lead = heroVel.clone().multiplyScalar(clamp(dl / 9 + 0.18, 0.32, 0.95) * 0.85);
      // зверята кидают не снайперски: разброс ~0.45 м (стоять на месте — попадут через раз, бегать — реже)
      const spread = what === 'leaves' ? 0 : battle ? 0.6 : 0.45, sa = rand() * TAU, sr = Math.sqrt(rand()) * spread;   // в битве мажут чаще: счёт обычно в пользу героини
      const to = new T.Vector3(pH.x + lead.x + Math.cos(sa) * sr, pH.y + 1.15, pH.z + lead.z + Math.sin(sa) * sr);
      if (what === 'leaves') {
        const T0 = clamp(dl / 6, 0.35, 0.9); leafBurst(from, to, 24, T0); sfx('leaves');
        later(T0, () => { heroPos(pH); if (Math.hypot(pH.x - to.x, pH.z - to.z) < 1.2) heroGiggle('leaves'); });
      } else { const b = ballGet(); b.position.copy(from); launch(b, from, to, 'npc', null); sfx('throw'); }
    }
    let heroSplatE = null;
    function snowHitHero(at) {
      puffs(at, 8, 0xFFFFFF, 0.11, 0.45); sfx('splat'); popText('Плюх!', at.clone().setY(at.y + 0.25), { col: 'blue', h: 0.21 });
      if (heroSplatE) heroSplatE.t = Math.min(heroSplatE.t, 0.12);
      else heroSplatE = splat((pos, q) => {
        if (B) { B.chest.localToWorld(pos.set(0.035, 0.03, 0.135)); B.chest.getWorldQuaternion(q); } else { heroRoot.localToWorld(pos.set(0, 1.15, 0.17)); heroRoot.getWorldQuaternion(q); }
        return true;
      }, 3.2, 0.85);
      if (heroSplatE) { const k0 = heroSplatE.kill; heroSplatE.kill = () => { k0(); heroSplatE = null; }; }
      if (battle) battle.them++;
      heroGiggle('snow');
      emit('heroHit', { them: battle ? battle.them : null });
    }
    function heroGiggle() { if (!heroFree()) return; if (!act || act.kind === 'giggle') startAct('giggle', null); }

    // снежная битва: 45 с, счёт «ты : они», жители кидают по очереди; конец — все смеются
    let battle = null;
    function battleCandidates() {
      const out = []; heroPos(pH);
      (getNpcs() || []).forEach(n => { if (!valid(n) || isPet(n) || surrendered(n)) return; let ok = true; try { ok = canTarget(n) !== false; } catch (e) { ok = false; } if (!ok) return; npcPos(n, pN); if (Math.hypot(pN.x - pH.x, pN.z - pH.z) < TOSS_RANGE && Math.abs(pN.y - pH.y) < 2) out.push(n); });
      return out;
    }
    function startBattle(list) {
      battle = { t: 0, dur: clamp(+o.battleSec || 45, 30, 60), me: 0, them: 0, npcs: new Set(list), list: list.slice(), timers: new Map(), ended: false, endT: 0 };
      list.forEach((n, i) => battle.timers.set(n, 1.4 + i * 0.7 + rand() * 1.2));
      emit('battle', { phase: 'start', n: list.length, dur: battle.dur });
      chip(true);
    }
    function updBattle(dt) {
      if (!battle) return;
      const b = battle; b.t += dt;
      if (b.ended) { b.endT += dt; if (b.endT > 3.5) { battle = null; chip(false); } else chip(true); return; }
      heroPos(pH);
      let near = 0;
      for (let i = b.list.length - 1; i >= 0; i--) {
        const n = b.list[i];
        if (!valid(n) || canTargetSafe(n) === false) { b.npcs.delete(n); b.list[i] = b.list[b.list.length - 1]; b.list.length--; continue; }
        holdNpc(n, 0.8);
        let tm = b.timers.get(n) - dt;
        npcPos(n, pN);
        const d = Math.hypot(pN.x - pH.x, pN.z - pH.z); if (d < 14) near++;
        if (tm <= 0) {
          const R = RX.get(n);
          if (d < 12 && (!R || !R.cur || R.cur.kind === 'laugh' || R.cur.kind === 'snowHit')) { const R2 = rxGet(n); rxPlay(R2, 'npcThrow', { what: 'snow' }); R2.q = []; tm = 3.0 + rand() * 2.4 + 0.5 * b.npcs.size; }
          else tm = 0.6;
        }
        b.timers.set(n, tm);
      }
      if (b.t >= b.dur || !b.npcs.size || !near) endBattle();          // время вышло / все разошлись / героиня ушла далеко
      else chip(true);
    }
    const canTargetSafe = n => { try { return canTarget(n); } catch (e) { return false; } };
    function endBattle() {
      const b = battle; if (!b || b.ended) return;
      b.ended = true; b.endT = 0;
      b.npcs.forEach(n => { if (!valid(n)) return; const R = rxGet(n); R.q = []; rxPlay(R, 'laugh'); });
      emit('battle', { phase: 'end', me: b.me, them: b.them });
      chip(true);
    }

    /* ---------- пальтар: возня понарошку ---------- */
    let spar = null, sparCool = -1;
    function startSpar(n) {
      spar = { n, t: 0, hits: 0, done: false, lastHit: now, cool: 0 };
      const R = rxGet(n); R.q = []; rxPlay(R, 'sparIdle');
      sayKind(n, 'spar'); sfx('jingle'); emit('spar', { phase: 'start', npc: n.id });
    }
    function updSpar(dt) {
      if (!spar) return;
      spar.t += dt;
      const R = RX.get(spar.n);
      if (!valid(spar.n)) { spar = null; return; }
      if (spar.done && R && R.cur && R.cur.kind === 'bow' && !spar.said) { spar.said = true; sayKind(spar.n, 'champion'); emit('spar', { phase: 'end', npc: spar.n.id, hits: spar.hits }); }
      if (spar.done && (!R || !R.cur)) { spar = null; sparCool = now + 6; return; }
      heroPos(pH); npcPos(spar.n, pN);
      if (!spar.done && (now - spar.lastHit > 14 || Math.hypot(pN.x - pH.x, pN.z - pH.z) > 4)) { spar.done = true; if (R) { R.q = ['bow']; rxPlay(R, 'bow'); R.q = []; } sayKind(spar.n, 'bow'); spar.said = true; emit('spar', { phase: 'end', npc: spar.n.id, hits: spar.hits }); }
    }

    /* ---------- «вежливое расстояние» после «сдаюсь» ---------- */
    let politeUntil = -1;          // пока кто-то «сдался» (минута); иначе — ни одного вызова getNpcs в кадре
    function updPolite(dt) {
      if (now > politeUntil) return;
      const list = getNpcs() || []; heroPos(pH);
      for (let i = 0; i < list.length; i++) {
        const n = list[i]; if (!valid(n) || !surrendered(n) || RX.has(n)) continue;
        npcPos(n, pN); const dx = pN.x - pH.x, dz = pN.z - pH.z, d = Math.hypot(dx, dz);
        if (d < 1.9 && d > 1e-3) { const st = Math.min(1.9 - d, 1.3 * dt); moveNpc(n, dx / d * st, dz / d * st); holdNpc(n, 0.5); }
      }
    }

    /* ---------- отложенные события (по времени слоя) ---------- */
    const timers = [];
    const later = (sec, fn) => timers.push({ at: now + sec, fn });
    function updTimers() { for (let i = timers.length - 1; i >= 0; i--) if (now >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); try { f(); } catch (e) { console.warn('playfight', e); } } }

    /* =====================================================================
       КНОПКИ
       ===================================================================== */
    const host = o.buttonsHost || null;
    const UI = { bonk: null, toss: null, chip: null, bl: '', tl: '', cl: '', ck: null, hudOn: false, hudN: 0, saved: null };
    const HAM_SVG = '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><rect x="14.2" y="12" width="3.6" height="17" rx="1.8" fill="#8ED3E6" stroke="#4A3A48" stroke-width="1.6"/><rect x="5" y="4" width="22" height="10" rx="4" fill="#F2667F" stroke="#4A3A48" stroke-width="1.6"/><rect x="3" y="4.6" width="5" height="8.8" rx="2" fill="#FFD166" stroke="#4A3A48" stroke-width="1.4"/><rect x="24" y="4.6" width="5" height="8.8" rx="2" fill="#FFD166" stroke="#4A3A48" stroke-width="1.4"/></svg>';
    const HAM_BTN = '<i>' + HAM_SVG + '</i><b>Пиу!</b>';
    const CSS = `
:where(.pf-btn){position:absolute;right:23px;bottom:calc(242px + var(--safe-bottom,0px));width:62px;height:62px;padding:0;border:0;border-radius:50%;background:rgba(255,253,249,.95);color:var(--cherry,#C2405B);font:inherit;font-family:Nunito,system-ui,sans-serif;font-weight:900;font-size:12.5px;line-height:1.05;box-shadow:0 4px 0 rgba(58,46,63,.16),0 8px 18px rgba(58,46,63,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;z-index:19;cursor:pointer;user-select:none;-webkit-user-select:none;transition:transform .08s,box-shadow .08s}
:where(.pf-btn) i{font-style:normal;font-size:21px;line-height:1;display:block;height:24px}
:where(.pf-btn) b{display:block;white-space:nowrap}
:where(.pf-btn):active,:where(.pf-btn.go){transform:translateY(3px) scale(.95);box-shadow:0 1px 0 rgba(58,46,63,.16)}
:where(.pf-btn.hidden){display:none}
:where(.pf-toss){bottom:calc(316px + var(--safe-bottom,0px))}
:where(.pf-btn.pet){color:#D9718E}
:where(.pf-btn.snow){color:#3E7FA6}
:where(.pf-btn.leaf){color:#C2702E}
:where(.pf-inline) .pf-btn{position:relative;right:auto;bottom:auto}
:where(.pf-chip){position:absolute;left:50%;top:calc(64px + var(--safe-top,0px));transform:translateX(-50%);z-index:21;background:rgba(255,253,249,.96);color:var(--ink,#3A2E3F);font-family:Nunito,system-ui,sans-serif;font-weight:900;font-size:14px;padding:8px 14px;border-radius:16px;box-shadow:0 3px 0 rgba(58,46,63,.12),0 8px 18px rgba(58,46,63,.1);white-space:nowrap;pointer-events:none}
:where(.pf-chip) em{font-style:normal;color:#3E7FA6}
:where(.pf-chip) u{text-decoration:none;color:var(--cherry,#C2405B)}
:where(.pf-chip.end){background:#EAF6FD}
:where(.pf-chip.hidden){display:none}
`;
    function ensureCss() { if (document.getElementById('pfCss')) return; const st = document.createElement('style'); st.id = 'pfCss'; st.textContent = CSS; document.head.insertBefore(st, document.head.firstChild); }
    function mkBtn(cls, fn) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pf-btn ' + cls + ' hidden';
      // HUD v2: маленькая круглая кнопка дуги (значок; подпись — aria-label): «Бум!» — s2 (по диагонали от P), «Листья»/«Снежок» — s4
      if (!(o.slots && o.slots[cls === 'pf-bonk' ? 'bonk' : 'toss'])) b.dataset.hudSlot = cls === 'pf-bonk' ? 's2' : 's4';
      const go = e => { e.preventDefault(); e.stopPropagation(); b.classList.add('go'); setTimeout(() => b.classList.remove('go'), 120); fn(); };
      b.addEventListener('pointerdown', go);
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (e.detail === 0) fn(); });   // клавиатура (Enter/пробел)
      b.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      host.appendChild(b); return b;
    }
    if (host) {
      ensureCss();
      UI.bonk = mkBtn('pf-bonk', bonk); UI.toss = mkBtn('pf-toss', toss);
      if (o.slots && o.slots.bonk) Object.assign(UI.bonk.style, o.slots.bonk);
      if (o.slots && o.slots.toss) Object.assign(UI.toss.style, o.slots.toss);
      UI.chip = document.createElement('div'); UI.chip.className = 'pf-chip hidden'; host.appendChild(UI.chip);
    }
    function setBtn(b, key, html, cls, show) {
      if (!b) return;
      const k = show ? key : '';
      if (b.dataset.k === k) return; b.dataset.k = k;
      b.classList.toggle('hidden', !show); if (!show) return;
      b.innerHTML = html; b.classList.toggle('pet', cls === 'pet'); b.classList.toggle('snow', cls === 'snow'); b.classList.toggle('leaf', cls === 'leaf');
      b.setAttribute('aria-label', key); b.title = key;
    }
    let uiT = 0, lastTg = null;
    function updUI(dt) {
      uiT -= dt; if (uiT > 0) return; uiT = 0.1;
      const on = enabled && !disposed;
      const tg = on ? findTarget(RANGE) : null; lastTg = tg;
      const busy = act && (act.A.lock || act.kind === 'leaves' || act.kind === 'snow');
      if (!tg && !(act && act.A.hits)) setBtn(UI.bonk, '', '', '', false);
      else if (tg && tg.pet) setBtn(UI.bonk, 'Бупнуть', '<i>🐾</i><b>Бупнуть</b>', 'pet', !busy);
      else if (hasHammer()) setBtn(UI.bonk, 'Пиу!', HAM_BTN, '', !busy);
      else setBtn(UI.bonk, 'Бум!', '<i>💫</i><b>Бум!</b>', '', !busy);
      const se = season();
      const canToss = on && (se === 'autumn' || se === 'winter') && leftFree() && !busy && (!!battle || !!throwTarget());
      if (se === 'winter') setBtn(UI.toss, 'Снежок', '<i>❄️</i><b>Снежок</b>', 'snow', canToss);
      else setBtn(UI.toss, 'Листья', '<i>🍂</i><b>Листья</b>', 'leaf', canToss);
    }
    function chip(show) {
      if (!UI.chip) return;
      // строку собираем, только когда меняются секунды или счёт (в кадре — без выделений)
      const b0 = show ? battle : null, key = !b0 ? -1 : (b0.ended ? 1e7 : 0) + Math.max(0, Math.ceil(b0.dur - b0.t)) * 1e4 + Math.min(99, b0.me) * 100 + Math.min(99, b0.them);
      if (key === UI.ck) return; UI.ck = key;
      let html = '';
      if (show && battle) {
        const b = battle, left = Math.max(0, Math.ceil(b.dur - b.t));
        if (b.ended) html = b.me >= b.them ? `❄️ Ты победила в снежной битве: <u>${b.me}</u> : <em>${b.them}</em>! Все в снегу и смеются` : `❄️ Снежная битва — всё! Ты попала <u>${b.me}</u> ${plural(b.me, 'раз', 'раза', 'раз')}, в тебя — <em>${b.them}</em>. Все в снегу и смеются`;
        else html = `❄️ Снежная битва · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ты <u>${b.me}</u> : <em>${b.them}</em> они`;
      }
      if (html === UI.cl) return; UI.cl = html;
      // HUD v2: счёт битвы — пилюля цели в верхней полосе («❄️ 0:45 · 3 : 2»), итог — тостом; прежняя цель вернётся после битвы
      const HUD = window.HUD;
      if (HUD && HUD.objective) {
        UI.chip.classList.add('hidden');
        if (show && battle && !battle.ended) {
          const b = battle, left = Math.max(0, Math.ceil(b.dur - b.t));
          if (!UI.hudOn) { UI.hudOn = true; UI.saved = HUD.objective.get(); }
          HUD.objective.set({ icon: '❄️', text: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ${b.me} : ${b.them}`, title: 'Снежная битва', full: `Ты ${b.me} : ${b.them} они`, bounce: UI.hudN++ === 0, expand: false });
        } else if (UI.hudOn) {
          UI.hudOn = false; UI.hudN = 0;
          if (show && battle && battle.ended) HUD.toast(html.replace(/<[^>]+>/g, ''), 3600);
          HUD.objective.set(UI.saved ? Object.assign({}, UI.saved, { bounce: false, expand: false }) : null); UI.saved = null;
        }
        return;
      }
      UI.chip.innerHTML = html; UI.chip.classList.toggle('hidden', !html); UI.chip.classList.toggle('end', !!(battle && battle.ended));
    }
    const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

    // клавиатура (по желанию): o.keys = { bonk: 'KeyF', toss: 'KeyG' }
    const onKey = e => { if (!o.keys || e.repeat) return; if (e.code === o.keys.bonk) bonk(); else if (e.code === o.keys.toss) toss(); };
    if (o.keys) window.addEventListener('keydown', onKey);

    /* =====================================================================
       КАДР
       ===================================================================== */
    const heroVel = V(), prevHero = V(); let havePrev = false;
    function update(dt) {
      if (disposed) return;
      dt = clamp(+dt || 0, 0, 0.1);
      now += dt;
      if (!ATL.warm) warmAtlas(now > 3);
      heroPos(pH);
      if (havePrev && dt > 0) { tmpA.subVectors(pH, prevHero).divideScalar(dt); tmpA.y = 0; if (tmpA.length() < 8) heroVel.lerp(tmpA, Math.min(1, dt * 8)); } prevHero.copy(pH); havePrev = true;
      updTimers();
      updateAct(dt);
      applyPose(dt);
      // жители
      for (let i = RXA.length - 1; i >= 0; i--) {
        const R = RXA[i]; if (!R) continue;
        if (!valid(R.n) || R.root !== R.n.root) { rxEnd(R); continue; }      // житель пропал / сменил корень: вернуть всё (и платочек)
        if (R.cur) {
          const c = R.cur; c.t += dt;
          resetX();
          RK[c.kind].eval(R, c, dt);
          composePivot(R);
          holdNpc(R.n, 0.5);
          if (c.t >= c.dur) {
            const done = c;
            if (RK[done.kind].end) RK[done.kind].end(R, done);
            R.cur = null;
            if (done.kind === 'chase') { if (done.caught && heroFree()) { R.q.unshift('caughtLie'); heroCaught(R.n); } else R.q.unshift('giveup'); }
            if (R.q.length) { const nx = R.q.shift(); if (typeof nx === 'string') rxPlay(R, nx); else rxPlay(R, nx.kind, nx.opt); resetX(); RK[R.cur.kind].eval(R, R.cur, 0); composePivot(R); }
          }
        }
        if (!R.cur) {
          // ждём: серия ещё может продолжиться (следующий тап) — не уходить сразу
          if (R.pending && act && act.n === R.n) continue;
          if (R.pending && now < comboUntil && comboN === R.n) continue;
          if (R.pending) { afterEpisode(R); if (R.q.length) { const nx = R.q.shift(); if (typeof nx === 'string') rxPlay(R, nx); else rxPlay(R, nx.kind, nx.opt); continue; } }
          rxEnd(R);
        }
      }
      updSpar(dt); updBattle(dt); updPolite(dt);
      updShots(dt);
      // листья в охапке — между ладонями
      let heldAt = null;
      if (act && act.kind === 'leaves' && act.ids && !act.thrown) heldAt = handMid(leafHeldAt);
      updateLeaves(dt, heldAt);
      if (act && act.kind === 'snow' && act.ball && !act.thrown) { if (B) B.hand_L.localToWorld(act.ball.position.copy(PALM._L)); else handMid(act.ball.position); act.ball.scale.setScalar(Math.min(1, act.ball.scale.x + dt * 2.2)); }
      updHammer(dt);
      for (let i = FX.length - 1; i >= 0; i--) { const e = FX[i]; e.t += dt; let keep = false; try { keep = e.upd(e, dt); } catch (er) { keep = false; } if (!keep) { FX.splice(i, 1); if (e.kill) e.kill(); } }
      // пачки: спрайты (2 вызова), птички (2), снежки (1 + тень), шлепки (1) — невидимы, когда пусты
      fillSprites(); fillBirds(); fillPool(SNOW.balls, SNOW.ballIM, SNOW_N); fillPool(SNOW.splats, SNOW.splatIM, SPLAT_N);
      updUI(dt);
    }
    const iaBusy = () => { try { return !!(IA && IA.busy && IA.busy()); } catch (e) { return false; } };
    const heroFree = () => enabled && !disposed && !iaBusy();      // можно ли героине упасть от смеха / хихикнуть
    // снять действие героини (машина, комната, диалог): поза отдаётся HeroAnim со следующего кадра
    function cancelAct() {
      if (act && act.ids && !act.thrown) act.ids.forEach(i => { LEAF.st[i] = 0; });
      if (act && act.ball && !act.thrown) ballFree(act.ball);
      act = null; fading = null; queued = 0;
    }
    function heroCaught(n) {
      // догнал: оба падают от смеха (героиня садится на землю, смеётся, встаёт)
      if (act && act.ids && !act.thrown) act.ids.forEach(i => { LEAF.st[i] = 0; });
      if (act && act.ball && !act.thrown) ballFree(act.ball);
      act = null; queued = 0;
      startAct('sitlaugh', null);
      heroPos(pH); puffs(pH.clone().setY(pH.y + 0.05), 6, 0xE8DCCB, 0.14, 0.5); sfx('thud');
      popText('ха-ха!', pH.clone().setY(pH.y + 1.3), { col: 'pink', h: 0.2, dur: 1.2 });
    }

    const AS = {};          // один объект на все кадры (без выделений); вход s не меняем
    function animState(s) {
      if (!act) return s;
      s = s || {};
      for (const k in AS) if (!(k in s)) AS[k] = undefined;
      for (const k in s) AS[k] = s[k];
      AS.idle = false; AS.waving = false; AS.sniff = 0; AS.celebrate = false;
      if (act.A.lock || act.A.hits || act.kind === 'leaves' || act.kind === 'snow') AS.speed = 0;
      AS.turnRate = 0;
      return AS;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (OV.on && B) { for (let i = 0; i < OVN.length; i++) { const n = OVN[i]; if (B[n].quaternion.equals(OV.wrote[n])) B[n].quaternion.copy(OV.base[n]); } if (B.hips.position.equals(OV.hipsWrote)) B.hips.position.copy(OV.hipsBase); OV.on = false; }
      for (const R of RXA.slice()) { if (R.cur && RK[R.cur.kind].end) RK[R.cur.kind].end(R, R.cur); R.cur = null; if (R.flag) { R.flag.visible = false; R.flag.userData.live = false; R.flag = null; } restoreNode(R); }
      RX.clear(); RXA.length = 0;
      FX.slice().forEach(e => { if (e.kill) e.kill(); }); FX.length = 0;
      shots.length = 0; timers.length = 0; act = null; battle = null; spar = null;
      if (ownHammer) { ownHammer.userData.pfDispose(); ownHammer = null; }
      if (fxRoot.parent) fxRoot.parent.remove(fxRoot);
      [LEAF.mesh, BIRD.body, BIRD.wings, SNOW.ballIM, SNOW.splatIM].forEach(im => { if (im && im.dispose) im.dispose(); });
      GEO.forEach(g => g.dispose()); MAT.forEach(m => m.dispose()); TEX.forEach(t => t.dispose());
      textCache.clear();
      ['bonk', 'toss', 'chip'].forEach(k => { const el = UI[k]; if (el && el.parentNode) el.parentNode.removeChild(el); UI[k] = null; });
      if (o.keys) window.removeEventListener('keydown', onKey);
    }

    const api = {
      update, bonk, toss, dispose, animState,
      active: () => !!(act || fading),
      locked: () => !!(act && (act.A.lock || act.A.hits || act.kind === 'leaves' || act.kind === 'snow')),
      target: () => { const t = findTarget(RANGE); return t ? t.n : null; },
      enable(on) {
        on = !!on; if (on === enabled) return; enabled = on;
        if (enabled) return;
        setBtn(UI.bonk, '', '', '', false); setBtn(UI.toss, '', '', '', false);
        // героиня ушла из возни (машина, велосипед, комната, диалог): поза сразу отдаётся, битва и пальтар заканчиваются по-доброму,
        // догонялки — «Уф! Ты быстрая!» (см. RK.chase); жители доигрывают свои реакции сами
        cancelAct();
        if (battle && !battle.ended) endBattle();
        if (spar && !spar.done) { const R = RX.get(spar.n); spar.done = true; spar.said = true; if (R) { R.q = []; rxPlay(R, 'bow'); } }
      },
      enabled: () => enabled,
      giveHammer, dropHammer, hasHammer,
      battle: () => (battle ? { t: +battle.t.toFixed(2), dur: battle.dur, me: battle.me, them: battle.them, n: battle.npcs.size, ended: battle.ended } : null),
      spar: () => (spar ? { npc: spar.n.id, hits: spar.hits, done: !!spar.done } : null),
      isReacting: n => RX.has(n),
      isDown: n => isDown(n),
      reaction: n => { const R = RX.get(n); return R && R.cur ? R.cur.kind : null; },
      surrendered,
      state: () => ({ act: act ? act.kind : null, t: act ? +act.t.toFixed(3) : 0, combo, reacting: Array.from(RX.keys()).map(n => n.id), battle: api.battle(), spar: api.spar(), hammer: hasHammer(), fx: FX.length, leaves: LEAF.live, shots: shots.length, now: +now.toFixed(2) }),
      _dbg: { RX, STATS, ACTS, RK, FX, LEAF, sprites, SNOW, BIRD, OV, C, P, startAct, rxGet, rxPlay, onHit, startBattle, endBattle, battleCandidates, findTarget, fxRoot, UI, setNow: v => { now = v; } },
    };
    return api;
  }

  window.PlayFight = { create, makeHammer, hammerItem, HAMMER_HOLD, HAMMER_HEAD, synth, isPetDefault, isPaltarDefault, PERSONA, version: 1 };
})();
