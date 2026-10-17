/* =====================================================================
   СВАДЬБА ВО ДВОРЕ (волна 4): праздник двух жителей-зверят, героиня — приглашённая на праздник.
   Факты — plan2/kubachi_spec2.md §2 (пальтары), §4 (свадьба): три дня, под открытым небом, живая музыка (зурна и
   барабан), круг танца, общий стол (чуду, пельмени, плов в казане, фрукты, мёд, сладости), невесту осыпают
   сладостями, пальтары — на 2-й и 3-й день: высокие статные ряженые (по фото p1–p4) — войлочная маска-капюшон с полосами,
   носом и длинным нагрудником, кольчуга до середины бедра поверх белой рубахи, пояс с пряжкой, перчатки; звенят кольчугой,
   пляшут, хлопают, «пугают» понарошку, фотографируются с детьми. По просьбе: у кого-то — короткая плётка, ею только
   щёлкают в воздухе для веселья, никогда ни в кого и рядом с детьми — за поясом. Только праздничные народные элементы:
   без обрядов, без денег в танце, без чая и вина, без оружия. Героиню не ставят на место невесты, ей ничего «свадебного» не дарят.

   Обычный <script>: VILLAGE.wedding. Нужен THREE r149 и набор села (VILLAGE.vkit.makeKit → kit), всё — кодом.

   VILLAGE.wedding.build({ THREE, kit, anchor:{x,y,z,ry,w,d, gate?, house?}, named, season, quality, night? }) -> h
     Оси двора (anchor): x — поперёк (w), z — вглубь (d); −z — к дому (почётное место молодых), +z — к воротам.
     h.group      — добавить в сцену (сам стоит в 0,0,0; внутри — двор по anchor; «головы» жителей — в мировых осях)
     h.npcs       — [{ id, name, speaker, root, x, y, z, headY, talkR, lines:[строки], lineObjs:[{who,text}], silent? }]
                    root — пустышка над жителем в мировых осях (едет за танцором/ряженым); faceHero > 0 — повернётся к героине
     h.spots      — [{ id:'wedding_treat'|'wedding_dance'|'wedding_congrats', x, y, z, r, label, icon, use(ctx) }]
                    use() → описание действия (см. h.act) — для стенда/игры
     h.colliders  — [{type:'box'|'circle', ...}] в мировых осях (столы, помост, музыканты, столбы навеса)
     h.update(dt, heroPos{x,y,z}, camera?) — раз в кадр (анимация, LOD по камере/героине, розыгрыш пальтара)
     h.act(id, ctx) — 'wedding_treat' → { kind:'treat', item, from:{x,y,z}, stand:[x,y,z,ry], text, who? }
                      'wedding_dance' → { kind:'dance', slot:{x,y,z,ry}, text } и сразу h.dance.start()
                      'wedding_congrats' → { kind:'congrats', text (героиня), reply:{ who, name, text } } + сладости над молодыми
     h.dance      — мини-игра «в такт»: start() → { slot, dur, bpm }; tap() → { grade:'perfect'|'good'|'miss', combo };
                    stop(); active; slot (где стоять героине: в кругу, лицом к центру); on(ev) — {type:'start'|'beat'|'hit'|'end'}
     h.onPrank(cb) — розыгрыш пальтара: { type:'beret'|'jingle', phase:'start'|'take'|'return'|'end', who, text }
                    'beret' — «утащил» берет на пару секунд и вернул с поклоном (нужен h.setHero(hero) — тогда берет героини
                    правда пропадает: VILLAGE.kaz.hideBeret); в казе или без героини — 'jingle' (звенит колокольчиками и кланяется)
     h.setHero(hero[, anim]) — героиня из buildHeroRig (для берета и точки над головой); h.prank() — начать розыгрыш сейчас; h.stopPrank() — прервать
     h.onEvent(cb) — { type:'beat'|'shower'|'bell'|'prank'|'jingle'|'crack'|'flash'|'say', who?, text? } — для звука и облачков
                    (jingle — звон кольчуги, crack — щелчок плётки в воздухе, flash — «фото», say — короткий возглас ряженого);
                    h.setNight(k 0..1) — гирлянды-фонарики светят
     h.info       — { calls, tris, animals, bones }; h.lod — 0 близко / 1 средне / 2 далеко; h.dispose()
   Бюджет: ≤ 40 вызовов и ≤ 60 тыс. треугольников на всю сцену. Все зверята и ряженые — ОДНА сетка со скелетом (SkinnedMesh) +
   контур + лица (атлас) + «ткани» (маски, кольчуги, платки — атлас 1024×2048): 4 вызова на всех. Реквизит — 2 сетки.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // «колокол» 0 → 1 → 0 на x 0..1 с нулевой скоростью на краях (синус на краях трогал позу с места рывком)
  const bell = x => { const s = Math.sin(clamp(x, 0, 1) * PI); return s * s; };
  const angW = a => a - TAU * Math.round(a / TAU);
  const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------------
     РЕПЛИКИ (правда — §10 spec2; «n» — для named=false: без «зурна», «пальтар», «чуду»)
     --------------------------------------------------------------------- */
  const SPEAKERS = {
    wed_bride: { name: 'Невеста-овечка', icon: '🐑', voice: 'нежный, радостный' },
    wed_groom: { name: 'Жених-барашек', icon: '🐏', voice: 'добрый, гордый, тёплый' },
    wed_zurna: { name: 'Барсучок с зурной', n: 'Барсучок с дудочкой', icon: '🦡', voice: 'бодрый, звонкий' },
    wed_drum: { name: 'Медвежонок-барабанщик', icon: '🐻', voice: 'басовитый, весёлый' },
    wed_aunt: { name: 'Тётушка-ежиха', icon: '🦔', voice: 'тёплый, хлопотливый' },
    wed_kid: { name: 'Котёнок', icon: '🐱', voice: 'звонкий, детский' },
    paltar: { name: 'Пальтар', n: 'Ряженый', icon: '🎭', voice: 'нарочно изменённый, смешной, озорной' },
  };
  const L = (who, text, n) => (n ? { who, text, n: { who, text: n } } : { who, text });
  const LINES = {
    wed_bride: [L('wed_bride', 'Спасибо, что пришла! Угощайся!'), L('wed_bride', 'Сегодня второй день свадьбы. Впереди ещё один!')],
    wed_groom: [L('wed_groom', 'Танцуют все — и гости, и мы!'), L('wed_groom', 'Пальтары пришли — значит, будет весело!', 'Ряженые пришли — значит, будет весело!')],
    wed_zurna: [L('wed_zurna', 'Музыка у нас только живая: зурна и барабан!', 'Музыка у нас только живая: дудочка и барабан!'), L('wed_zurna', 'Без музыки свадьбы не бывает. Слушай!')],
    wed_drum: [L('wed_drum', 'Бум-бум! Держи ритм — и в круг!'), L('wed_drum', 'Сейчас танцуем во дворе. А потом — на площади!')],
    wed_aunt: [L('wed_aunt', 'Свадьба у нас — целых три дня!'), L('wed_aunt', 'Готовим все вместе: кто лепит, кто печёт чуду.', 'Готовим все вместе: кто лепит, кто печёт пироги.'), L('wed_aunt', 'Если дождь — танцуем под навесом.')],
    wed_kid: [L('wed_kid', 'Невесту осыпают сладостями — на счастье. Лови конфетку!')],
    paltar: [L('paltar', 'Я пальтар! Маска войлочная, узор — белый.', 'Я ряженый! Маска из войлока, с белым узором.'), L('paltar', 'Не узнаёшь? Так и задумано. Я даже голос меняю!'),
      L('paltar', 'Кольчуга — как настоящая! Для свадеб их снова плетут.'), L('paltar', 'Давным-давно мы стерегли крепость. А теперь — веселим свадьбу!'),
      // need — реплика только для тех, у кого это есть (перчатки — не у A с голыми руками, плётка — только у D и E)
      Object.assign(L('paltar', 'Перчатки — чтобы хлопать громче! Хлоп-хлоп, в такт!'), { need: 'gloves' }), Object.assign(L('paltar', 'Щёлк — только в воздух и понарошку! Это я зову всех в круг.'), { need: 'whip' }),
      L('paltar', 'Хочешь фото на память? Встану рядом — улыбнёмся!')],
  };
  const EV = {
    prankBeret: L('paltar', 'Ой, чей это берет? Шучу-шучу, держи!'),
    prankJingle: L('paltar', 'Звяк-звяк! Это я так здороваюсь!'),
    // короткие возгласы ряженых (облачко над маской)
    palSay: { boo: L('paltar', 'Бу-у!'), hey: L('paltar', 'Хэй!'), hi: L('paltar', 'Звяк-звяк! Привет!'), smile: L('paltar', 'Улыбочку!'), win: L('paltar', 'Ура! Звяк!'), squeal: L('wed_kid', 'И-и-и! Не догонишь!') },
    congrats: L('hero', 'Поздравляю! Пусть в доме будет много радости!'),
    congratsReply: L('wed_bride', 'Спасибо большое! Угощайся!'),   // W4A: без обращения из стоп-списка scan_words
    treat: { chudu: L('hero', 'Ммм, тёплое чуду!', 'Ммм, тёплый пирожок!'), apple: L('hero', 'Яблочко — хрустит!'), grapes: L('hero', 'Виноград — сладкий!'), pear: L('hero', 'Груша — мягкая и сладкая!') },
    danceStart: L('wed_drum', 'В круг! Хлопай в такт!'),
    danceGood: L('hero', 'Ух, как здорово! Круг стал ещё веселее!'),
    danceOk: L('hero', 'Почти в такт! Зато как весело!'),
    shower: L('wed_kid', 'Конфетки! Лови!'),
  };
  const pick = (l, named) => (l ? (named === false && l.n ? l.n : { who: l.who, text: l.text }) : null);

  /* ---------------------------------------------------------------------
     АТЛАС 1024×2048 (canvas): верхняя половина — лица зверят (клетки 128), ковёр, дорожка, платок; нижняя — блок пальтаров
     (маски-капюшоны пяти видов, нагрудники, кольчуга, перчатки, борода, мех, ворот, плётка) — всё в ОДНОЙ текстуре: 4 вызова
     на всю толпу остаются. Координаты v (flipY): верхняя половина — v 0,5..1, блок пальтаров — v 0..0,5
     --------------------------------------------------------------------- */
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  const FACE = {
    bride: { muzzle: '#F6EAE0', muzzleW: 96, muzzleH: 60, nose: '#C9858E', noseW: 13, noseH: 9, mouth: 'smile', white: true, er: 28, ey: 345, lash: true },
    groom: { muzzle: '#E8CDB0', muzzleW: 96, muzzleH: 60, nose: '#5E4A40', noseW: 14, noseH: 9, mouth: 'smile', white: true, er: 28, ey: 345 },
    badger: { bands: '#4A4442', nose: '#2E2A3B', mouth: 'w', ey: 356, white: true, er: 30 },
    bear: { muzzle: '#E8CFAE', muzzleW: 92, muzzleH: 62, nose: '#3A2E3F', noseW: 18, noseH: 12, mouth: 'smile', ey: 350, er: 30 },
    fox: { muzzle: '#FFF4E6', muzzleW: 104, muzzleH: 64, nose: '#2E2A3B', noseW: 14, noseH: 10, mouth: 'w', ey: 345, er: 30, lash: true },
    hare: { nose: '#E8798F', mouth: 'w', ey: 352, er: 30, lash: true },
    cat: { nose: '#E8798F', noseW: 12, noseH: 8, mouth: 'w', ey: 340, er: 30, ex: 84 },
    hedgehog: { nose: '#2E2A3B', mouth: 'smile', ey: 356, glasses: '#9C7A5A' },
    goat: { muzzle: '#F3EDE4', muzzleW: 90, muzzleH: 58, nose: '#8E6E66', noseW: 13, noseH: 8, mouth: 'smile', white: true, er: 28, ey: 340 },
    squirrel: { muzzle: '#FFF1DE', muzzleW: 92, muzzleH: 58, nose: '#5E3A2E', noseW: 12, noseH: 9, mouth: 'w', ey: 345, er: 30, lash: true },
    mouse: { nose: '#E8798F', noseW: 13, noseH: 10, mouth: 'smile', ey: 350, lash: true },
    raccoon: { mask: '#4E4650', muzzle: '#F4EEE8', muzzleW: 90, muzzleH: 56, nose: '#2E2A3B', noseW: 13, noseH: 9, mouth: 'w', ey: 345, er: 28, white: true },
    kitten: { nose: '#E8798F', noseW: 12, noseH: 8, mouth: 'w', ey: 345, er: 34, ex: 86 },
    lambkid: { muzzle: '#F6EAE0', muzzleW: 96, muzzleH: 60, nose: '#C9858E', noseW: 13, noseH: 9, mouth: 'smile', white: true, er: 32, ey: 345 },
  };
  const FACE_KEYS = Object.keys(FACE);
  // клетка лица k: открытые глаза — (2k mod 8, ...), закрытые — соседняя справа (v — в верхней половине атласа)
  const faceCell = k => { const c = (k * 2) % 8, r = Math.floor(k * 2 / 8); return { u0: c * 0.125, v0: 0.5 + (1 - (r + 1) * 0.125) / 2 }; };

  /* --- блок пальтаров (1024×1024 в координатах блока; в атласе — y + 1024). Слот вида k = 0..4 (A..E): x0 = (k % 2)·512,
     y0 = ⌊k / 2⌋·256; в слоте: лицо 256×256, капюшон сзади 128×256, нагрудник 128×256. Лицо: x 0..256 — азимут −75°..+75°
     (x = 0 — правая щека носящего), y 0..256 — макушка..низ капюшона, линейно по высоте. Глаза (87,119) и (169,119), кончик
     носа y 152, рот (128,182), подбородок y 217. Круги — эллипсами ry = 0,86·rx (на капюшоне выглядят круглыми). Капюшон
     сзади: x 0 = +75° (стык с правым краем лица), x 128 = −75°. Нагрудник: 128 px = самая широкая часть, щит нарисован внутри --- */
  const KY = 0.86;
  const PCOL = {
    feltK: '#23201E', chalk: '#EEE8DE', edgeK: '#141210', skin: '#E8B596', eye: '#2E2A3B', lip: '#C9474B', mouth: '#4A2430', teeth: '#FFF8F0',
    cBase: '#B8B19B', cDark: '#4F473B', cFur: '#DAD5C4', dBase: '#2F251E', dGold: '#CBA046', dGoldS: '#B98A2A', dFelt: '#4A3828', dLip: '#C0605A',
    eRed: '#B83A5E', eRedS: '#7E2643', eWool: '#EEE6E9',
    mailGap: '#34363C', mail: '#8C9098', mailHi: '#D8DBE0', mailLo: '#5C5F66',
  };
  const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // «совиные» полосы: d — мягкое объединение расстояний до двух глаз (ниже глаз круги вытянуты вниз в o.low раз); белое — в полосах
  // o.bands [[от, до, маска?], ...] или по периоду (o.r0, o.P, o.duty, o.rMax); маска (px, py) → запас в пикселях (> 0 — можно);
  // spiral — закрутка (вид A: ровно виток на период, поэтому без шва). Клетку пишем целиком (фон o.bg) — без чтения холста обратно
  // (getImageData на большом холсте медленный). w, mapX — для затылка: x клетки → «виртуальная» x лица (узор идёт дальше за ±75°)
  function pBands(c, x0, y0, o, w, mapX) {
    w = w || 256;
    const h = 256, img = c.createImageData(w, h), D = img.data, fg = hexRGB(o.fg), bg = hexRGB(o.bg), k = o.soft || 9, P = o.P, aa = mapX ? 2.2 : 1, bands = o.bands, nb = bands ? bands.length : 0;
    // по столбцам — заранее (пиксельный цикл — самая долгая часть сборки двора); оба глаза на одной высоте (y 119)
    const PX = new Float32Array(w); for (let x = 0; x < w; x++) PX[x] = mapX ? mapX(x + 0.5) : x + 0.5;
    for (let y = 0; y < h; y++) {
      const py = y + 0.5, sy = KY * (py > 119 ? o.low || 1 : 1), dy = (py - 119) / sy, dy2 = dy * dy;
      for (let x = 0; x < w; x++) {
        const px = PX[x], ax = px - 87, bx = px - 169, d0 = Math.sqrt(ax * ax + dy2), d1 = Math.sqrt(bx * bx + dy2);
        // мягкий минимум двух расстояний: min − k·ln(1 + e^(−|d0 − d1| / k))
        const d = Math.min(d0, d1) - k * Math.log(1 + Math.exp(-Math.abs(d0 - d1) / k));
        let s = -9;
        if (nb) for (let q = 0; q < nb; q++) { const bb = bands[q]; if (d < bb[0] - 9 || d > bb[1] + 9) continue; let v = Math.min(d - bb[0], bb[1] - d); if (bb[2]) v = Math.min(v, bb[2](px, py)); if (v > s) s = v; }
        else if (d > o.r0 - 1 && !(o.rMax && d > o.rMax + 1)) {
          let dd = d;
          if (o.spiral) { const ex = px < 128 ? 87 : 169, th = Math.atan2(dy, px - ex), wq = Math.min(1, Math.abs(px - 128) / 34); dd += (px < 128 ? -1 : 1) * th / TAU * P * o.spiral * wq * wq * (3 - 2 * wq); }
          const f = (dd - o.r0) / P, fr = f - Math.floor(f);
          s = fr < o.duty ? Math.min(fr, o.duty - fr) * P : -Math.min(fr - o.duty, 1 - fr) * P;
          s = Math.min(s, d - o.r0); if (o.rMax) s = Math.min(s, o.rMax - d);
        }
        const al = clamp(0.5 + s / aa, 0, 1), i = (y * w + x) * 4;
        D[i] = bg[0] + (fg[0] - bg[0]) * al; D[i + 1] = bg[1] + (fg[1] - bg[1]) * al; D[i + 2] = bg[2] + (fg[2] - bg[2]) * al; D[i + 3] = 255;
      }
    }
    c.putImageData(img, x0, y0);
  }
  // C: волнистые тёмные полосы по всему капюшону — дугами на лбу, «ёлочкой» вниз на щеках, подбородке и шее (по фото p1);
  // вокруг каждого глаза — узкая светлая кайма с тёмным ободком (полосы подходят к самой прорези, как на фото p1; большой
  // светлый диск делал глаза круглыми «совиными», «очки»-полоса через глаза — енотом)
  function pChevField(c, x0, y0, w, mapX) {
    const h = 256, img = c.createImageData(w, h), D = img.data, fg = hexRGB(PCOL.cDark), bg = hexRGB(PCOL.cBase), aa = mapX ? 2.2 : 1, P = 30, duty = 0.5;
    // столбцы и строки — заранее; синусы суммы углов — через синусы и косинусы слагаемых
    const PX = new Float32Array(w), GG = new Float32Array(w), SA = new Float32Array(w), CA = new Float32Array(w), SA2 = new Float32Array(w), CA2 = new Float32Array(w);
    for (let x = 0; x < w; x++) { const px = mapX ? mapX(x + 0.5) : x + 0.5, g = Math.sqrt((px - 128) * (px - 128) + 80); PX[x] = px; GG[x] = Math.min(g, 170) + 0.4 * Math.max(0, g - 170); SA[x] = Math.sin(px * 0.075); CA[x] = Math.cos(px * 0.075); SA2[x] = Math.sin(px * 0.21); CA2[x] = Math.cos(px * 0.21); }
    for (let y = 0; y < h; y++) {
      const py = y + 0.5, kk = lerp(-0.34, 0.62, sst(70, 150, py)), sb = Math.sin(py * 0.045), cb = Math.cos(py * 0.045), sb2 = Math.sin(py * 0.13), cb2 = Math.cos(py * 0.13), ey = (py - 119) / KY, ey2 = ey * ey;
      for (let x = 0; x < w; x++) {
        const px = PX[x], phi = py + kk * GG[x] + 4.5 * (SA[x] * cb + CA[x] * sb) + 2.5 * (SA2[x] * cb2 - CA2[x] * sb2);
        const f = phi / P, fr = f - Math.floor(f);
        let s = fr < duty ? Math.min(fr, duty - fr) * P : -Math.min(fr - duty, 1 - fr) * P;
        const e0 = px - 87, e1 = px - 169, de = Math.sqrt(Math.min(e0 * e0, e1 * e1) + ey2);
        s = Math.max(Math.min(s, de - 12), Math.min(de - 12, 15 - de));
        const al = clamp(0.5 + s / aa, 0, 1), i = (y * w + x) * 4;
        D[i] = bg[0] + (fg[0] - bg[0]) * al; D[i + 1] = bg[1] + (fg[1] - bg[1]) * al; D[i + 2] = bg[2] + (fg[2] - bg[2]) * al; D[i + 3] = 255;
      }
    }
    c.putImageData(img, x0, y0);
  }
  const pEl = (c, x, y, rx) => { c.beginPath(); c.ellipse(x, y, rx, rx * KY, 0, 0, TAU); };
  const pDisc = (c, x, y, r, col) => { c.fillStyle = col; pEl(c, x, y, r); c.fill(); };
  // глазница — дырка в войлоке: кожа носящего, тёмный край, глаз с маленьким бликом (взгляд добрый — маска весёлая, не страшная)
  function pEye(c, x, y, r, rim) {
    pDisc(c, x, y, r, rim || PCOL.skin);
    c.strokeStyle = '#2A1E1C'; c.lineWidth = 1.5; pEl(c, x, y, r); c.stroke();
    c.fillStyle = PCOL.eye; c.beginPath(); c.ellipse(x, y + 0.5, r * 0.5, r * 0.58, 0, 0, TAU); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.2, r * 0.15, 0, TAU); c.fill();
  }
  // рот: открытая улыбка с красными губами
  function pMouth(c, x, y, rx, ry, lip, open) {
    c.fillStyle = PCOL.mouth; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    if (open) { c.fillStyle = PCOL.teeth; c.fillRect(x - rx * 0.55, y - ry * 0.75, rx * 1.1, ry * 0.45); }
    c.strokeStyle = lip; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
  }
  // ворс войлока и вязки: короткие волоски
  function pFuzz(c, x0, y0, w, h, n, cols, alpha, seed, len) {
    const R = rng(seed); c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.globalAlpha = alpha; c.lineWidth = 1.2;
    for (let i = 0; i < n; i++) { const x = x0 + R() * w, y = y0 + R() * h, a = R() * TAU, l = (len || 4) * (0.5 + R()); c.strokeStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    c.restore();
  }
  // затылок — продолжение лица: x клетки 0..64 — азимут +75..180° (x лица 256..435), 64..128 — −180..−75° (x лица −179..0);
  // по горизонтали на затылке в 2,8 раза меньше пикселей на градус — рисуем тот же узор сжатым (на модели — та же ширина)
  const backX = x => (x < 64 ? 256 + 2.8 * x : -358.4 + 2.8 * x);
  function pBack(c, x0, y0, fn) {
    [[0, 64, -256 / 2.8], [64, 128, 358.4 / 2.8]].forEach(([a, b, ox]) => { c.save(); c.beginPath(); c.rect(x0 + a, y0, b - a, 256); c.clip(); c.setTransform(1 / 2.8, 0, 0, 1, x0 + ox, y0); fn(c); c.restore(); });
  }
  // силуэт нагрудника-щита в клетке 128×256: верх w0, самая широкая часть wm на доле pm длины, круглый кончик
  function shieldPath(c, x0, y0, w0, wm, pm) {
    const cx = x0 + 64, H = 256, t = wm / 2, s = w0 / 2;
    c.beginPath(); c.moveTo(cx - s, y0); c.bezierCurveTo(cx - t, y0 + H * pm * 0.5, cx - t, y0 + H * pm, cx - t * 0.98, y0 + H * pm);
    c.bezierCurveTo(cx - t * 0.95, y0 + H * 0.82, cx - t * 0.45, y0 + H, cx, y0 + H);
    c.bezierCurveTo(cx + t * 0.45, y0 + H, cx + t * 0.95, y0 + H * 0.82, cx + t * 0.98, y0 + H * pm);
    c.bezierCurveTo(cx + t, y0 + H * pm, cx + t, y0 + H * pm * 0.5, cx + s, y0); c.closePath();
  }
  // та же кривая для сетки: полуширина щита (px) на доле длины u 0..1 — по точкам двух кубических кривых
  function shieldHW(w0, wm, pm) {
    const t = wm / 2, s = w0 / 2, H = 256, pts = [];
    const bz = (p0, p1, p2, p3, k) => { const m = 1 - k; return m * m * m * p0 + 3 * m * m * k * p1 + 3 * m * k * k * p2 + k * k * k * p3; };
    for (let i = 0; i <= 24; i++) { const k = i / 24; pts.push([bz(s, t, t, t * 0.98, k), bz(0, H * pm * 0.5, H * pm, H * pm, k)]); }
    for (let i = 1; i <= 24; i++) { const k = i / 24; pts.push([bz(t * 0.98, t * 0.95, t * 0.45, 0, k), bz(H * pm, H * 0.82, H, H, k)]); }
    return u => { const y = u * H; for (let i = 1; i < pts.length; i++) if (pts[i][1] >= y) { const a = pts[i - 1], b = pts[i], k = b[1] > a[1] ? (y - a[1]) / (b[1] - a[1]) : 1; return a[0] + (b[0] - a[0]) * k; } return 0; };
  }
  function pChev(c, x0, y0, y, depth, w, col, inset, curve) {
    c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
    const L = x0 + inset, Rr = x0 + 128 - inset, M = x0 + 64;
    c.beginPath(); c.moveTo(L, y0 + y); c.quadraticCurveTo(L + (M - L) * 0.45, y0 + y + depth * (curve || 0.8), M, y0 + y + depth);
    c.quadraticCurveTo(Rr - (Rr - M) * 0.45, y0 + y + depth * (curve || 0.8), Rr, y0 + y); c.stroke();
  }
  function pZigEl(c, cx, cy, rx, ry, amp, per, col, w) {
    const n = Math.max(24, Math.round(TAU * Math.max(rx, ry) / per * 2)); c.strokeStyle = col; c.lineWidth = w; c.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + (i % 2 ? amp : -amp) / Math.max(rx, ry); const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  // маски по видам: field — фон и узор по пикселям (на затылке — то же поле дальше по кругу), paths — штрихи в осях лица (на затылок
  // тоже, сжатыми), feats — только на лице (глаза, рот), fuzz — ворс, glit — искры нити, nape — низ затылка, top — пушистая макушка, bib — нагрудник.
  // A — чёрно-белый «вихрь», B — «совиные» кольца с «сердцем», C — лохматый серо-кремовый «ёлочкой», D — тёмный с золотом,
  // E — малиновый вязаный с белыми зигзагами (по фото p1–p4)
  const PAINT = {
    A: {
      // одно толстое белое кольцо вокруг широкой чёрной «капли» у глаза, закрученное «вихрем»; кольца сходятся над переносицей
      field: (c, x0, y0, w, mx) => pBands(c, x0, y0, { fg: PCOL.chalk, bg: PCOL.feltK, r0: 24, P: 30, duty: 0.42, spiral: 1, soft: 10, rMax: 64, low: 1.15 }, w, mx),
      paths(c) {
        // белый «листок» от макушки к переносице (с чёрной каймой) и белая подкова под губами; низ лица — чёрный
        c.fillStyle = PCOL.feltK; c.beginPath(); c.ellipse(128, 44, 15, 46, 0, 0, TAU); c.fill();
        c.fillStyle = PCOL.chalk; c.beginPath(); c.ellipse(128, 44, 9, 40, 0, 0, TAU); c.fill();
        c.strokeStyle = PCOL.chalk; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(54, 180); c.quadraticCurveTo(128, 240, 202, 180); c.stroke();
      },
      feats(c) { c.fillStyle = PCOL.feltK; c.beginPath(); c.ellipse(128, 166, 30, 18, 0, 0, TAU); c.fill(); [87, 169].forEach(x => pEye(c, x, 119, 9)); pMouth(c, 128, 172, 14, 7, PCOL.lip, true); },
      bib(c, x0, y0, sh) {
        c.fillStyle = PCOL.feltK; c.fillRect(x0, y0, 128, 256);
        c.save(); shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.clip();
        pChev(c, x0, y0, 150, 26, 14, PCOL.chalk, 18, 0.6);
        c.strokeStyle = PCOL.chalk; c.lineWidth = 12; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke(); c.restore();
      },
    },
    B: {
      // кольца: дырка — чёрное — белое — чёрное — белое «сердце» над переносицей — чёрное — белая дуга над сердцем, внизу она же —
      // подкова под губами; дальше по кругу головы (виски, затылок) — те же кольца, макушка чёрная
      field(c, x0, y0, w, mx) {
        const top = (px, py) => py - 40, bands = [[17, 29], [43, 57], [71, 83]];
        for (let r = 99; r < 320; r += 28) bands.push([r, r + 12, top]);
        pBands(c, x0, y0, { fg: PCOL.chalk, bg: PCOL.feltK, soft: 9, low: 1.25, bands }, w, mx);
      },
      // белая полоса от макушки до «сердца» над переносицей, с чёрными краями
      paths(c) { c.fillStyle = PCOL.feltK; c.fillRect(116, -2, 24, 76); c.fillStyle = PCOL.chalk; c.fillRect(122, -2, 12, 78); },
      feats(c) {
        // нос и рот — на чёрном (низ второго кольца убираем)
        c.fillStyle = PCOL.feltK; c.beginPath(); c.ellipse(128, 165, 30, 19, 0, 0, TAU); c.fill();
        [87, 169].forEach(x => pEye(c, x, 119, 9)); pMouth(c, 128, 171, 14, 7, PCOL.lip, true);
      },
      bib(c, x0, y0, sh) {
        c.fillStyle = PCOL.feltK; c.fillRect(x0, y0, 128, 256);
        c.save(); shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.clip();
        pChev(c, x0, y0, 22, 78, 14, PCOL.chalk, 12, 0.75); pChev(c, x0, y0, 118, 78, 14, PCOL.chalk, 10, 0.75);
        c.strokeStyle = PCOL.chalk; c.lineWidth = 16; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke();
        c.strokeStyle = PCOL.edgeK; c.lineWidth = 4; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke(); c.restore();
      },
    },
    C: {
      field: (c, x0, y0, w, mx) => pChevField(c, x0, y0, w, mx),
      feats(c) { [87, 169].forEach(x => pEye(c, x, 119, 9)); pMouth(c, 128, 172, 13, 7, PCOL.lip, true); },
      fuzz: [1600, [PCOL.cFur, PCOL.cDark, '#8E8672'], 0.35, 11, 5],
      bib(c, x0, y0, sh) {
        c.fillStyle = PCOL.cBase; c.fillRect(x0, y0, 128, 256);
        c.save(); shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.clip();
        for (let y = 6; y < 250; y += 32) pChev(c, x0, y0, y, 34, 15, PCOL.cDark, -4, 0.9);
        c.strokeStyle = PCOL.cDark; c.lineWidth = 10; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke(); c.restore();
        pFuzz(c, x0, y0, 128, 256, 700, [PCOL.cFur, PCOL.cDark], 0.35, 13, 5);
      },
    },
    D: {
      // золотые «совиные» кольца у глаз (внешние сходятся над переносицей); над ними — два обруча: дугой на лбу, ровно по затылку
      field: (c, x0, y0, w, mx) => pBands(c, x0, y0, { fg: PCOL.dGold, bg: PCOL.dBase, soft: 10, low: 1.1, bands: [[20, 32.6], [50, 62.6]] }, w, mx),
      paths(c) {
        c.strokeStyle = PCOL.dGold; c.lineWidth = 13; c.lineCap = 'butt';
        [20, 46].forEach(yc => { c.beginPath(); for (let xv = -192; xv <= 448; xv += 4) { const s = Math.sin(Math.min(Math.abs(xv - 128) * 0.01023, PI / 2)), y = yc + 50.4 * s * s; if (xv > -192) c.lineTo(xv, y); else c.moveTo(xv, y); } c.stroke(); });
      },
      // рот открыт, с губами, на тёмном войлоке между носом и бородой (фото p3; без рта нос с золотыми кольцами читался совой)
      feats(c) {
        [87, 169].forEach(x => { pDisc(c, x, 119, 20, PCOL.dFelt); pEye(c, x, 119, 10, '#C99470'); });
        c.fillStyle = PCOL.dBase; c.beginPath(); c.ellipse(128, 163, 25, 16, 0, 0, TAU); c.fill(); pMouth(c, 128, 164, 11, 8, PCOL.dLip, true);
      },
      fuzz: [900, ['#5A4636', '#1C1612'], 0.3, 21, 4],
      // золотая нить блестит искрами (фото p3), а не ровной жёлтой краской
      glit: [900, ['#F4E2A0', '#8C6A28'], 0.4, 22, 2],
      bib(c, x0, y0, sh) {
        c.fillStyle = PCOL.dBase; c.fillRect(x0, y0, 128, 256);
        c.save(); shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.clip();
        // три острые «ёлочки» (фото p3: V, а не U — полосы-дуги под бородой читались брюшком пчелы)
        [50, 114, 178].forEach(y => pChev(c, x0, y0, y, 48, 17, PCOL.dGold, 2, 0.42));
        c.strokeStyle = PCOL.dGoldS; c.lineWidth = 8; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke(); c.restore();
        pFuzz(c, x0, y0, 128, 256, 450, ['#F4E2A0', '#8C6A28'], 0.4, 24, 2);
      },
    },
    E: {
      field(c, x0, y0, w) { c.fillStyle = PCOL.eRed; c.fillRect(x0, y0, w, 256); },
      // белые зигзаги кругами вокруг лица — через переносицу, щёки под глазами и подбородок, дальше по всей голове (как на
      // фото p4: ровного малинового «пятачка» нет — иначе лицо читалось мордочкой)
      paths(c) { for (let i = 0; i < 12; i++) { const r = 40 + i * 30; pZigEl(c, 128, 138, r, r * 0.96, 2, 12, PCOL.eWool, 13); } },
      feats(c) {
        // узкая малиновая кайма вокруг глазниц и рта (вязка у прорезей), без белых «очков»
        c.fillStyle = PCOL.eRed; [96, 160].forEach(x => { c.beginPath(); c.ellipse(x, 124, 16, 10, 0, 0, TAU); c.fill(); });
        c.beginPath(); c.ellipse(128, 176, 17, 10, 0, 0, TAU); c.fill();
        [96, 160].forEach(x => { c.fillStyle = PCOL.skin; c.beginPath(); c.ellipse(x, 124, 12, 6.5, 0, 0, TAU); c.fill(); c.strokeStyle = '#2A1E1C'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = PCOL.eye; c.beginPath(); c.ellipse(x, 124.5, 5, 5.5, 0, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x + 1.6, 122.5, 1.3, 0, TAU); c.fill(); });
        pMouth(c, 128, 176, 12, 6, PCOL.eRedS, true);
      },
      fuzz: [1200, [PCOL.eRedS, PCOL.eWool, '#D8668A'], 0.25, 31, 3],
      // низ затылка (шея под воротом и лоскут на спине) — малиновая вязка без зигзагов: на лоскуте под воротом зигзаги
      // складывались в ряд белых зубцов
      nape(c, x0, y0, w) { const g = c.createLinearGradient(0, y0 + 196, 0, y0 + 205); g.addColorStop(0, 'rgba(184,58,94,0)'); g.addColorStop(1, PCOL.eRed); c.fillStyle = g; c.fillRect(x0, y0 + 196, w, 60); pFuzz(c, x0, y0 + 200, w, 56, 160, [PCOL.eRedS, '#D8668A'], 0.3, 34, 3); },
      // макушка — пушистая, без полос
      top(c, x0, y0, w) { c.save(); c.globalAlpha = 0.92; const g = c.createLinearGradient(0, y0, 0, y0 + 28); g.addColorStop(0, PCOL.eRed); g.addColorStop(1, 'rgba(184,58,94,0)'); c.fillStyle = g; c.fillRect(x0, y0, w, 28); c.restore(); },
      bib(c, x0, y0, sh) {
        c.fillStyle = PCOL.eRed; c.fillRect(x0, y0, 128, 256);
        c.save(); shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.clip();
        c.fillStyle = PCOL.eWool; c.fillRect(x0, y0, 128, 256);
        c.fillStyle = PCOL.eRed; c.strokeStyle = PCOL.eRedS; c.lineWidth = 2;
        for (let r = 0; r < 11; r++) for (let q = -1; q < 6; q++) { const x = x0 + 20 + q * 22 + (r % 2) * 11, y = y0 + 16 + r * 23; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 8, y); c.lineTo(x, y + 9); c.lineTo(x - 8, y); c.closePath(); c.fill(); c.stroke(); }
        c.strokeStyle = PCOL.eRed; c.lineWidth = 16; shieldPath(c, x0, y0, sh[0], sh[1], sh[2]); c.stroke(); c.restore();
        pFuzz(c, x0, y0, 128, 256, 400, [PCOL.eRedS, '#FFFFFF'], 0.2, 33, 3);
      },
    },
  };
  // лицо (клетка 256×256) и затылок (128×256) одного вида: на затылке — то же поле и те же штрихи, продолженные по кругу головы
  function paintFace(c, x0, y0, Pn) {
    Pn.field(c, x0, y0, 256, null);
    c.save(); c.translate(x0, y0); if (Pn.paths) Pn.paths(c); Pn.feats(c); c.restore();
    if (Pn.fuzz) pFuzz(c, x0, y0, 256, 256, Pn.fuzz[0], Pn.fuzz[1], Pn.fuzz[2], Pn.fuzz[3], Pn.fuzz[4]);
    if (Pn.glit) pFuzz(c, x0, y0, 256, 256, Pn.glit[0], Pn.glit[1], Pn.glit[2], Pn.glit[3], Pn.glit[4]);
    if (Pn.top) Pn.top(c, x0, y0, 256);
  }
  function paintHood(c, x0, y0, Pn) {
    Pn.field(c, x0, y0, 128, backX);
    if (Pn.paths) pBack(c, x0, y0, Pn.paths);
    if (Pn.fuzz) pFuzz(c, x0, y0, 128, 256, Pn.fuzz[0] >> 1, Pn.fuzz[1], Pn.fuzz[2], Pn.fuzz[3] + 1, Pn.fuzz[4]);
    if (Pn.glit) pFuzz(c, x0, y0, 128, 256, Pn.glit[0] >> 1, Pn.glit[1], Pn.glit[2], Pn.glit[3] + 1, Pn.glit[4]);
    if (Pn.nape) Pn.nape(c, x0, y0, 128);
    if (Pn.top) Pn.top(c, x0, y0, 128);
  }
  // нагрудники-щиты (px в клетке 128×256): верх, самая широкая часть, где она
  const PSH = { A: [72, 88, 0.4], B: [88, 124, 0.42], C: [100, 124, 0.45], D: [96, 122, 0.4], E: [120, 128, 0.55] };
  const PKEYS = ['A', 'B', 'C', 'D', 'E'];
  function paintPaltarBlock(c, ox, oy, used) {
    const cell = (fn, x, y, w, h, arg) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); fn(c, x, y, arg); c.restore(); };
    PKEYS.forEach((key, k) => {
      if (used && !used.includes(key)) return;
      const x0 = ox + (k % 2) * 512, y0 = oy + Math.floor(k / 2) * 256, Pn = PAINT[key];
      cell((c2, x, y) => paintFace(c2, x, y, Pn), x0, y0, 256, 256); cell((c2, x, y) => paintHood(c2, x, y, Pn), x0 + 256, y0, 128, 256); cell(Pn.bib, x0 + 384, y0, 128, 256, PSH[key]);
    });
    // кольчуга 512×256: колечки «4 в 1» (64 по кругу рубахи, ≈ 2 см), бесшовная плитка 32×32; тёмные щели и светлые кольца —
    // контраст стали как на фото p2 (иначе издали — серый вязаный свитер)
    {
      const [tc, t2] = cnv(32, 32); t2.fillStyle = '#1A1B1E'; t2.fillRect(0, 0, 32, 32);
      for (let r = -1; r <= 8; r++) for (let q = -1; q <= 4; q++) {
        const x = q * 8 + (r % 2 ? 4 : 0), y = r * 4, tilt = r % 2 ? 0.45 : -0.45;
        [[0, 0], [32, 0], [0, 32], [-32, 0], [0, -32]].forEach(([dx, dy]) => {
          t2.strokeStyle = '#9AA0A8'; t2.lineWidth = 1.6; t2.beginPath(); t2.ellipse(x + dx, y + dy, 4.1, 3.1, tilt, 0, TAU); t2.stroke();
          t2.strokeStyle = '#4E5158'; t2.lineWidth = 0.9; t2.beginPath(); t2.ellipse(x + dx, y + dy, 4.1, 3.1, tilt, PI * 0.1, PI * 0.6); t2.stroke();
          t2.strokeStyle = '#E6E9EE'; t2.lineWidth = 1.0; t2.beginPath(); t2.ellipse(x + dx, y + dy, 4.1, 3.1, tilt, PI * 0.95, PI * 1.7); t2.stroke();
        });
      }
      c.save(); c.translate(ox, oy + 768); c.fillStyle = c.createPattern(tc, 'repeat'); c.fillRect(0, 0, 512, 256); c.restore();
    }
    // перчатки: белая с синими точками, кремовая с коричневыми точками (кончики пальцев открыты), синяя вязаная с зигзагами
    const gx = ox + 768, gy = oy + 512;
    c.fillStyle = '#ECF0EE'; c.fillRect(gx + 128, gy, 128, 128);
    c.fillStyle = '#4A78B8'; for (let r = 0; r < 11; r++) for (let q = 0; q < 11; q++) { c.beginPath(); c.arc(gx + 128 + 6 + q * 12 + (r % 2) * 6, gy + 6 + r * 12, 3, 0, TAU); c.fill(); }
    // кремовая: мелкие чёткие точки ровной сеткой (крупные размытые читались «леопардом»)
    c.fillStyle = '#DCCDA8'; c.fillRect(gx, gy + 128, 128, 128);
    c.fillStyle = '#5A3E22'; for (let r = 0; r < 13; r++) for (let q = 0; q < 13; q++) { c.beginPath(); c.arc(gx + 5 + q * 10, gy + 128 + 5 + r * 10, 2, 0, TAU); c.fill(); }
    c.fillStyle = '#2F4F7A'; c.fillRect(gx + 128, gy + 128, 128, 128);
    c.strokeStyle = '#E8EEF5'; c.lineWidth = 3.5; for (let y = 8; y < 128; y += 12) { c.beginPath(); for (let x = 0; x <= 128; x += 4) { const yy = y + ((x / 4) % 2 ? 3 : -3); if (x) c.lineTo(gx + 128 + x, gy + 128 + yy); else c.moveTo(gx + 128 + x, gy + 128 + yy); } c.stroke(); }
    // жёлтая резиновая (клетка про запас: перчатки C — цветом вершин)
    const gr = c.createLinearGradient(gx, gy, gx + 128, gy + 128); gr.addColorStop(0, '#FFF07A'); gr.addColorStop(0.45, '#F6D23C'); gr.addColorStop(1, '#D9AE2C'); c.fillStyle = gr; c.fillRect(gx, gy, 128, 128);
    // малиновый ворот E, серая вязаная гетра E (бороды D и C — ниже, прядками)
    const woolly = (x, y, w, h, base, cols, seed) => { c.fillStyle = base; c.fillRect(x, y, w, h); pFuzz(c, x, y, w, h, Math.round(w * h / 18), cols, 0.55, seed, 6); };
    woolly(ox + 768, oy + 768, 128, 128, PCOL.eRed, [PCOL.eRedS, '#D8668A', '#9E2E50'], 53);
    c.fillStyle = '#C9D1D6'; c.fillRect(ox + 896, oy + 768, 128, 128); c.strokeStyle = '#AEB8BF'; c.lineWidth = 3; for (let x = 4; x < 128; x += 8) { c.beginPath(); c.moveTo(ox + 896 + x, oy + 768); c.lineTo(ox + 896 + x, oy + 896); c.stroke(); }
    // плётка: кожаная косичка (256×64) и рукоять с латунными кольцами (256×64)
    for (let i = 0; i < 33; i++) { c.fillStyle = i % 2 ? '#8A5E3E' : '#5E3E26'; c.beginPath(); c.moveTo(ox + 768 + i * 8, oy + 896); c.lineTo(ox + 768 + i * 8 + 8, oy + 928); c.lineTo(ox + 768 + i * 8, oy + 960); c.lineTo(ox + 768 + i * 8 - 8, oy + 928); c.closePath(); c.fill(); }
    c.fillStyle = '#3A2A20'; c.fillRect(ox + 768, oy + 960, 256, 64); c.fillStyle = '#C9A23F'; [40, 120, 200].forEach(x => c.fillRect(ox + 768 + x, oy + 960, 10, 64));
    // войлочный нос (128×64: верх — корень в маске, низ — кончик): полосы маски идут по нему кольцами — C тёмный с волнистыми
    // полосами, E малиновый с белыми зигзагами (фото p1, p4: нос — невысокий бугорок в узоре, а не гладкий «клюв» или рожок)
    const nose = (y, base, col, rows, zig, fz) => {
      c.save(); c.beginPath(); c.rect(ox + 512, oy + y, 128, 64); c.clip(); c.fillStyle = base; c.fillRect(ox + 512, oy + y, 128, 64);
      c.strokeStyle = col; c.lineWidth = 8;
      rows.forEach(ry => { c.beginPath(); for (let x = 0; x <= 128; x += 4) { const yy = oy + y + ry + (zig ? ((x / 4) % 2 ? 2.5 : -2.5) : Math.sin(x / 128 * TAU * 2) * 2.5); if (x) c.lineTo(ox + 512 + x, yy); else c.moveTo(ox + 512 + x, yy); } c.stroke(); });
      c.restore(); pFuzz(c, ox + 512, oy + y, 128, 64, 260, fz, 0.35, 61 + y, 3);
    };
    const has = k => !used || used.includes(k);
    if (has('C')) nose(512, '#8E8672', PCOL.cDark, [12, 38], false, [PCOL.cFur, PCOL.cDark]);
    // E: малиновый нос с бело-розовым вязаным кончиком (фото p4; белый зигзаг поверх носа читался колпачком, большой белый
    // кончик — шариком клоуна)
    if (has('E')) { nose(576, PCOL.eRed, PCOL.eWool, [], true, [PCOL.eRedS, PCOL.eWool]); c.fillStyle = '#F0D4DC'; c.fillRect(ox + 512, oy + 576 + 47, 128, 17); pFuzz(c, ox + 512, oy + 576 + 42, 128, 22, 220, [PCOL.eRed, '#E8A0B8', PCOL.eWool], 0.5, 66, 3); }
    // пряди-«волосы» (клетка образца конуса: v — вдоль пряди): продольные волоски — толстая прядь читается копной конского волоса,
    // а не гладким шипом. C — соломенная (128×256), A — чёрная (128×128)
    const streak = (x, y, w, h, base, cols, seed) => {
      const R = rng(seed); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = base; c.fillRect(x, y, w, h); c.lineWidth = 2;
      for (let i = 0; i < w * 1.4; i++) { const sx = x + R() * w, a2 = (R() - 0.5) * 10; c.globalAlpha = 0.45 + R() * 0.5; c.strokeStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(sx, y); c.bezierCurveTo(sx + a2, y + h * 0.33, sx - a2, y + h * 0.66, sx + a2 * 0.5, y + h); c.stroke(); }
      c.restore();
    };
    if (has('C')) streak(ox + 640, oy + 512, 128, 256, '#B5AE96', ['#DAD5C4', '#8E8672', '#C9C2AE', '#6E6858'], 71);
    if (has('A')) streak(ox + 512, oy + 640, 128, 128, '#201E22', ['#46424C', '#0E0D10', '#33303A'], 72);
    // бороды D (тёмно-бурая) и C (серо-оливковая): шерсть волнистыми прядками сверху вниз, поверх — короткий ворс (ровный ворс во
    // все стороны на гладкой бороде читался картонкой, войлочной подушкой)
    if (has('D')) { streak(ox + 512, oy + 768, 128, 256, '#4A3B2E', ['#5E4E3E', '#342A20', '#6A5848', '#3E3226'], 73); pFuzz(c, ox + 512, oy + 768, 128, 256, 1400, ['#7E6C58', '#2A2018', '#5E4E3E'], 0.45, 74, 6); }
    if (has('C')) { streak(ox + 640, oy + 768, 128, 256, '#665C48', ['#776C54', '#4E4636', '#867A62', '#463E30'], 75); pFuzz(c, ox + 640, oy + 768, 128, 256, 1400, ['#9C9076', '#3E3828', '#6E644E'], 0.45, 76, 6); }
  }
  function paintAtlas(faceCanvas, used) {
    const [cv, c] = cnv(1024, 2048);
    c.clearRect(0, 0, 1024, 2048);
    FACE_KEYS.forEach((k, i) => {
      const cc = (i * 2) % 8, rr = Math.floor(i * 2 / 8);
      [false, true].forEach((closed, j) => { const f = faceCanvas(FACE[k], closed); c.drawImage(f, (cc + j) * 128, rr * 128, 128, 128); });
    });
    // --- ковёр (x 512..768, y 768..1024): тёмно-красное поле, медальон, кайма с ромбами ---
    c.save(); c.beginPath(); c.rect(512, 768, 256, 256); c.clip();
    c.fillStyle = '#9E2F3E'; c.fillRect(512, 768, 256, 256);
    c.fillStyle = '#2F4F7A'; c.fillRect(512, 768, 256, 26); c.fillRect(512, 998, 256, 26); c.fillRect(512, 768, 26, 256); c.fillRect(742, 768, 26, 256);
    c.fillStyle = '#E8C770'; for (let i = 0; i < 10; i++) { const x = 525 + i * 26; [781, 1011].forEach(y => { c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x, y + 7); c.lineTo(x - 7, y); c.fill(); }); }
    c.fillStyle = '#F2E6CC'; c.beginPath(); c.moveTo(640, 820); c.lineTo(700, 896); c.lineTo(640, 972); c.lineTo(580, 896); c.closePath(); c.fill();
    c.fillStyle = '#2F4F7A'; c.beginPath(); c.moveTo(640, 845); c.lineTo(680, 896); c.lineTo(640, 947); c.lineTo(600, 896); c.closePath(); c.fill();
    c.fillStyle = '#E8C770'; c.beginPath(); c.arc(640, 896, 14, 0, TAU); c.fill();
    c.restore();
    // --- праздничная дорожка на стол (x 768..1024, y 512..768): малиновая с золотыми полосами и цветочками ---
    c.save(); c.beginPath(); c.rect(768, 512, 256, 256); c.clip();
    c.fillStyle = '#C2405B'; c.fillRect(768, 512, 256, 256);
    c.fillStyle = '#E8C770'; c.fillRect(768, 530, 256, 10); c.fillRect(768, 740, 256, 10);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = 790 + i * 42, y = 575 + j * 45; c.fillStyle = '#FFE7A6'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + Math.cos(k * PI / 2) * 6, y + Math.sin(k * PI / 2) * 6, 5, 0, TAU); c.fill(); } c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); }
    c.restore();
    // --- белый платок с золотыми точками (x 768..1024, y 768..1024) ---
    c.save(); c.beginPath(); c.rect(768, 768, 256, 256); c.clip();
    c.fillStyle = '#FFFDF8'; c.fillRect(768, 768, 256, 256);
    c.fillStyle = '#D9A632'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.beginPath(); c.arc(784 + i * 32 + (j % 2) * 16, 784 + j * 32, 4, 0, TAU); c.fill(); }
    c.fillStyle = '#D9A632'; c.fillRect(768, 1006, 256, 18);
    c.restore();
    // --- блок пальтаров (нижняя половина атласа) ---
    paintPaltarBlock(c, 0, 1024, used);
    return cv;
  }
  // атлас рисуется один раз за сессию (для набора ряженых; хранится последний): повторный вход во двор — без пиксельных циклов
  // масок (≈ 0,3–0,5 с на слабом телефоне)
  let ATLAS = null;
  function paintAtlasCached(faceCanvas, used) {
    const k = used.join('') + (faceCanvas ? '' : '-');
    if (!ATLAS || ATLAS.k !== k) ATLAS = { k, cv: paintAtlas(faceCanvas, used) };
    return ATLAS.cv;
  }
  // прямоугольники атласа (u0, v0, du, dv) — v от низа текстуры (flipY); верхняя половина атласа — v 0,5..1
  const VY = r => [r[0], 0.5 + r[1] / 2, r[2], r[3] / 2];
  const UVR = { carpet: VY([0.5, 0, 0.25, 0.25]), runner: VY([0.75, 0.25, 0.25, 0.25]), scarf: VY([0.75, 0, 0.25, 0.25]) };
  // клетка блока пальтаров (px блока: x, y, ширина, высота) → (u0, v0, du, dv)
  const PR = (x, y, w, h) => [x / 1024, (1 - (y + h) / 1024) / 2, w / 1024, h / 2048];
  const PUV = {};
  PKEYS.forEach((key, k) => { const x0 = (k % 2) * 512, y0 = Math.floor(k / 2) * 256; PUV[key] = { face: PR(x0, y0, 256, 256), hood: PR(x0 + 256, y0, 128, 256), bib: PR(x0 + 384, y0, 128, 256) }; });
  Object.assign(PUV, { mail: PR(0, 768, 512, 256), gYellow: PR(768, 512, 128, 128), gDots: PR(896, 512, 128, 128), gCream: PR(768, 640, 128, 128), gNavy: PR(896, 640, 128, 128),
    beardD: PR(512, 768, 128, 256), furC: PR(640, 768, 128, 256), ruff: PR(768, 768, 128, 128), warmer: PR(896, 768, 128, 128), lash: PR(768, 896, 256, 64), grip: PR(768, 960, 256, 64),
    noseC: PR(514, 514, 124, 60), noseE: PR(514, 578, 124, 60), hairA: PR(516, 644, 120, 120), hairC: PR(644, 516, 120, 248) });

  /* ---------------------------------------------------------------------
     ТОЛПА СО СКЕЛЕТОМ: детали (сфера, капсула, конус...) копятся в общие буферы; у каждой — своя кость
     --------------------------------------------------------------------- */
  function Crowd(T) {
    this.T = T; this.bones = []; this.parts = { body: [], ol: [], face: [], tex: [] };
  }
  const _m = (T) => new T.Matrix4();
  function bake(T, list, opts) {
    // list: [{ geo, m (Matrix4 в осях двора), col, bone, uv: [u0,v0,du,dv] | null, idx }]
    let nv = 0, ni = 0;
    list.forEach(p => { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; });
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
    const UV = opts.uv ? new Float32Array(nv * 2) : null, AI = opts.idx ? new Float32Array(nv) : null;
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v = new T.Vector3(), nm = new T.Matrix3();
    let ov = 0, oi = 0;
    list.forEach(p => {
      const g = p.geo, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color, n = pa.count;
      nm.getNormalMatrix(p.m);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(p.m); P[(ov + i) * 3] = v.x; P[(ov + i) * 3 + 1] = v.y; P[(ov + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(ov + i) * 3] = v.x; N[(ov + i) * 3 + 1] = v.y; N[(ov + i) * 3 + 2] = v.z;
        // цвет детали × цвет вершины (если у образца он есть: кончики ворса, пряди)
        const col = p.col || [1, 1, 1]; Cc[(ov + i) * 3] = col[0] * (ca ? ca.getX(i) : 1); Cc[(ov + i) * 3 + 1] = col[1] * (ca ? ca.getY(i) : 1); Cc[(ov + i) * 3 + 2] = col[2] * (ca ? ca.getZ(i) : 1);
        SI[(ov + i) * 4] = p.bone; SW[(ov + i) * 4] = 1;
        if (UV) { const r = p.uv || [0, 0, 1, 1]; const uu = ua ? ua.getX(i) : 0, vv = ua ? ua.getY(i) : 0; UV[(ov + i) * 2] = r[0] + clamp(uu, 0.002, 0.998) * r[2]; UV[(ov + i) * 2 + 1] = r[1] + clamp(vv, 0.002, 0.998) * r[3]; }
        if (AI) AI[ov + i] = p.idx || 0;
      }
      if (g.index) { const gi = g.index.array; for (let k = 0; k < gi.length; k++) I[oi + k] = gi[k] + ov; oi += gi.length; }
      else { for (let k = 0; k < n; k++) I[oi + k] = ov + k; oi += n; }
      ov += n;
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('color', new T.BufferAttribute(Cc, 3));
    geo.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
    if (UV) geo.setAttribute('uv', new T.BufferAttribute(UV, 2));
    if (AI) geo.setAttribute('aIdx', new T.BufferAttribute(AI, 1));
    geo.setIndex(new T.BufferAttribute(I, 1));
    return geo;
  }

  /* ---------------------------------------------------------------------
     BUILD
     --------------------------------------------------------------------- */
  function build(o) {
    o = o || {};
    const T = o.THREE || window.THREE, VK = V.vkit || {}, K = o.kit || o.K || null;
    const named = o.named !== false, season = o.season === 'winter' ? 'winter' : 'autumn', HI = o.quality !== 'low';
    const A = Object.assign({ x: 0, y: 0, z: 0, ry: 0, w: 20, d: 12 }, o.anchor || {});
    const t0 = performance.now();
    const own = [];                     // всё, что освобождаем сами
    const keep = x => { own.push(x); return x; };
    const group = new T.Group(); group.name = 'wedding';
    const stage = new T.Group(); stage.name = 'wedding:yard'; stage.position.set(A.x, A.y, A.z); stage.rotation.y = A.ry; group.add(stage);
    stage.updateMatrixWorld(true);
    const toW = (x, z, y) => { const c = Math.cos(A.ry), s = Math.sin(A.ry); return { x: A.x + x * c + z * s, y: A.y + (y || 0), z: A.z - x * s + z * c }; };
    const HW = A.w / 2, HD = A.d / 2;
    const S = Math.min(1, A.w / 20, A.d / 12);   // двор меньше расчётного — всё поджимаем
    // какие пальтары на свадьбе (виды по фото, см. PV ниже): на low — три, на high — четыре; зимой A вместо C
    const PSET = (HI ? ['B', 'C', 'D', 'E'] : ['B', 'C', 'D']).map(k => (k === 'C' && season === 'winter' ? 'A' : k));

    // общие материалы
    let GRAD = K && K.GRAD;
    if (!GRAD) { const d = new Uint8Array(64); [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255].forEach((v, i) => d.set([v, v, v, 255], i * 4)); GRAD = keep(new T.DataTexture(d, 16, 1, T.RGBAFormat)); GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true; }
    const rim = m => (K && K.addRim ? K.addRim(m, 1) : m);
    const faceCanvas = (K && K.faceCanvas) || VK.faceCanvas;
    const tp0 = performance.now(), atlasTex = keep(new T.CanvasTexture(paintAtlasCached(faceCanvas, PSET))), paintMs = Math.round(performance.now() - tp0);
    atlasTex.anisotropy = 4;
    const matBody = keep(rim(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, gradientMap: GRAD })));
    const matTex = keep(rim(new T.MeshToonMaterial({ color: 0xFFFFFF, vertexColors: true, map: atlasTex, gradientMap: GRAD })));
    const matTexS = keep(new T.MeshToonMaterial({ color: 0xFFFFFF, map: atlasTex, gradientMap: GRAD, side: T.DoubleSide }));
    const BL = { value: new Float32Array(32) };
    const matFace = keep(new T.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false }));
    matFace.onBeforeCompile = sh => {
      sh.uniforms.uBl = BL;
      sh.vertexShader = 'attribute float aIdx;\nuniform float uBl[32];\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv.x += uBl[int(aIdx + 0.5)] * 0.125;');
    };
    matFace.customProgramCacheKey = () => 'wedface';
    const matOl = keep(new T.ShaderMaterial({
      uniforms: { thick: { value: 0.0011 }, col: { value: new T.Color('#4A3A48') } },
      vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nuniform float thick;\nvoid main(){\n vec3 objectNormal = vec3(normal);\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n vec3 transformed = vec3(position);\n#include <skinning_vertex>\n vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vec3 nn = normalize(normalMatrix * objectNormal); mv.xyz += nn * thick * (-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
      side: T.BackSide,
    }));

    /* --- геометрия-образцы --- */
    const G = {
      sph: keep(new T.SphereGeometry(1, HI ? 8 : 7, HI ? 6 : 5)), sphLo: keep(new T.SphereGeometry(1, HI ? 7 : 6, HI ? 5 : 4)), cyl: keep(new T.CylinderGeometry(1, 1, 1, 8)),
      cylO: keep(new T.CylinderGeometry(1, 1, 1, 12, 1, true)), cone: keep(new T.ConeGeometry(1, 1, 8)), box: keep(new T.BoxGeometry(1, 1, 1)),
      hemi: keep(new T.SphereGeometry(1, 10, 5, 0, TAU, 0, PI / 2)), torus: keep(new T.TorusGeometry(1, 0.28, 5, 12)),
      face: keep(new T.SphereGeometry(1.012, HI ? 10 : 8, HI ? 7 : 6, PI / 2 - PI / 3, PI * 2 / 3, 10 * PI / 180, 120 * PI / 180)),
      scarfBack: keep(new T.CylinderGeometry(1, 1.08, 1, 9, 1, true, PI / 2 + 0.5, PI - 1.0)),
      plane: keep(new T.PlaneGeometry(1, 1)),
    };
    const capC = new Map(); const cap = (r, l) => { const k = r + '|' + l; if (!capC.has(k)) capC.set(k, keep(new T.CapsuleGeometry(r, l, HI ? 2 : 1, HI ? 6 : 5))); return capC.get(k); };
    // пальтар: капсулы попроще (руки, ноги) — треугольников меньше
    const capPC = new Map(); const capP = (r, l) => { const k = r + '|' + l; if (!capPC.has(k)) capPC.set(k, keep(new T.CapsuleGeometry(r, l, 1, HI ? 6 : 5))); return capPC.get(k); };

    /* --- зверята --- */
    const bones = [], animals = [], partsBody = [], partsOl = [], partsFace = [], partsTex = [];
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), VP = new T.Vector3(), VS = new T.Vector3();
    const C = h => (Array.isArray(h) ? h : hex(h));
    // детали жителя: в осях зверька (покой), кость → смещение кости от корня (off); kind: 'ol' — тело и контур, 'plain' — тело,
    // { uv } — «ткани» (атлас), 'face' — лицо
    function partFns(a, B, off, rootM) {
      a.P = (bone, geo, col, p, s, r, kind) => {
        const o2 = off[bone]; VP.set(o2[0] + p[0], o2[1] + p[1], o2[2] + p[2]); VS.set(s[0], s[1], s[2]);
        E.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); Q.setFromEuler(E);
        const m = new T.Matrix4().multiplyMatrices(rootM, M4.compose(VP, Q, VS));
        const part = { geo, m, col: col ? C(col) : [1, 1, 1], bone: B[bone].userData.i, idx: a.idx };
        kind = kind || 'ol';
        if (kind === 'face') partsFace.push(Object.assign(part, { uv: kind.uv }));
        else if (kind === 'tex' || (kind && kind.uv)) partsTex.push(Object.assign(part, { uv: kind.uv || UVR.scarf }));
        else { partsBody.push(part); if (kind === 'ol') partsOl.push(part); }
        return part;
      };
      a.tex = (bone, geo, uvKey, p, s, r, col) => { const part = a.P(bone, geo, col || '#FFFFFF', p, s, r, { uv: UVR[uvKey] }); part.uv = UVR[uvKey]; return part; };
      a.faceDecal = (key, p, s) => { const fc = faceCell(FACE_KEYS.indexOf(key)); const part = a.P('head', G.face, '#FFFFFF', p, s, null, 'face'); part.uv = [fc.u0, fc.v0, 0.125, 0.0625]; return part; };
    }
    function makeAnimal(spec) {
      const a = { spec, id: spec.id, role: spec.role, x: spec.x, z: spec.z, ry: spec.ry || 0, scale: spec.scale || 1.15, ph: Math.random() * 6, blinkT: 1 + Math.random() * 3, idx: animals.length, look: 0 };
      const sc = a.scale, rootM = new T.Matrix4().compose(new T.Vector3(a.x, spec.y || 0, a.z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a.ry), new T.Vector3(sc, sc, sc));
      const mk = (name, parent, pos) => { const b = new T.Bone(); b.name = a.id + ':' + name; b.position.set(pos[0], pos[1], pos[2]); (parent || stage).add(b); b.userData.i = bones.length; bones.push(b); return b; };
      // пальтар — человек в костюме: свой скелет (таз, грудь, голова, плечо-локоть-кисть-пальцы, бедро-голень)
      if (spec.role === 'paltar') { makePaltar(a, spec, rootM, mk); animals.push(a); return a; }
      const B = {};
      B.root = mk('root', null, [a.x, spec.y || 0, a.z]); B.root.rotation.y = a.ry; B.root.scale.setScalar(sc);
      const hipY = spec.hipY || 0.22, shY = spec.shY || 0.56, neckY = spec.neckY || 0.72;
      B.body = mk('body', B.root, [0, hipY, 0]);
      B.head = mk('head', B.body, [0, neckY - hipY, spec.headZ || 0.02]);
      B.armL = mk('armL', B.body, [spec.shX || 0.2, shY - hipY, 0.03]); B.armR = mk('armR', B.body, [-(spec.shX || 0.2), shY - hipY, 0.03]);
      B.legL = mk('legL', B.root, [0.1, hipY, 0.02]); B.legR = mk('legR', B.root, [-0.1, hipY, 0.02]);
      a.B = B; a.rest = { hipY, neckY };
      partFns(a, B, { root: [0, 0, 0], body: [0, hipY, 0], head: [0, neckY, spec.headZ || 0.02], armL: [spec.shX || 0.2, shY, 0.03], armR: [-(spec.shX || 0.2), shY, 0.03], legL: [0.1, hipY, 0.02], legR: [-0.1, hipY, 0.02] }, rootM);
      SPECIES[spec.sp](a, spec);
      animals.push(a);
      return a;
    }
    // общее тело зверька: туловище, животик, лапки, ножки (одежда — поверх)
    function torso(a, fur, belly, r) {
      r = r || [0.25, 0.27, 0.23];
      a.P('body', G.sph, fur, [0, 0.2, 0], r); if (belly) a.P('body', G.sph, belly, [0, 0.18, 0.12], [r[0] * 0.6, r[1] * 0.65, r[2] * 0.45], null, 'plain');
      a.torsoR = r;
      ['armL', 'armR'].forEach((b, i) => { a.P(b, cap(0.05, 0.16), fur, [0, -0.11, 0.02], [1, 1, 1], null, 'plain'); a.P(b, G.sphLo, a.spec.paw || fur, [0, -0.22, 0.03], [0.055, 0.05, 0.055], null, 'plain'); });
      ['legL', 'legR'].forEach(b => { a.P(b, cap(0.06, 0.1), a.spec.leg || fur, [0, -0.1, 0], [1, 1, 1], null, 'plain'); a.P(b, G.sphLo, a.spec.foot || a.spec.leg || fur, [0, -0.2, 0.04], [0.07, 0.045, 0.09], null, 'plain'); });
    }
    function headBall(a, col, r) { r = r || [0.23, 0.21, 0.21]; a.P('head', G.sph, col, [0, 0.14, 0], r); return r; }
    // наряды: платье до пола (женские), жилет (мужские), платок, папаха
    // длинное платье (подол до земли, кайма), лиф по фигуре; размеры — от туловища зверька
    function dress(a, col, trim, belt) {
      const R = a.torsoR || [0.25, 0.27, 0.23], w = Math.max(R[0], R[2]) + 0.035;
      a.P('body', G.cone, col, [0, 0.0, 0.0], [w + 0.08, 0.52, w + 0.06], null, 'ol');
      a.P('body', G.cylO, trim || '#E8C770', [0, -0.235, 0], [w + 0.07, 0.04, w + 0.055], null, 'plain');
      a.P('body', G.sph, col, [0, 0.22, 0.0], [R[0] + 0.025, R[1] * 0.85, R[2] + 0.025], null, 'plain');
      a.P('body', G.cylO, belt || trim || '#E8C770', [0, 0.1, 0], [R[0] + 0.03, 0.035, R[2] + 0.03], null, 'plain');
    }
    // жилет поверх рубахи: тёмный «бочонок», спереди белая планка рубахи с золотыми пуговками, пояс
    function vest(a, col, shirt) {
      const R = a.torsoR || [0.25, 0.27, 0.23], w = R[0] + 0.03, d = R[2] + 0.03;
      a.P('body', G.cyl, col, [0, 0.2, 0], [w, 0.34, d], null, 'ol');
      a.P('body', G.sph, col, [0, 0.37, 0], [w * 0.92, 0.09, d * 0.92], null, 'plain');
      a.P('body', G.box, shirt || '#FFFDF8', [0, 0.24, d - 0.005], [0.1, 0.24, 0.03], null, 'plain');
      [0.3, 0.22, 0.14].forEach(y => a.P('body', G.sphLo, '#E8C770', [0, y, d + 0.015], [0.016, 0.016, 0.01], null, 'plain'));
      a.P('body', G.cylO, '#8A5A3E', [0, 0.06, 0], [w + 0.005, 0.045, d + 0.005], null, 'plain');
    }
    function scarf(a, r, long) {   // белый платок с золотыми точками (как у гостий-кубачинок): на голову и мягко за спину
      a.tex('head', G.hemi, 'scarf', [0, 0.16, -0.02], [r[0] * 1.1, r[1] * 1.02, r[2] * 1.1], [-0.25, 0, 0]);
      a.tex('head', G.scarfBack, 'scarf', [0, long ? -0.12 : 0.0, -0.03], [r[0] * 1.04, long ? 0.62 : 0.3, r[2] * 1.04], [0.12, 0, 0]);
    }
    function papakha(a, col) { a.P('head', G.cyl, col, [0, 0.36, -0.01], [0.17, 0.14, 0.17], null, 'ol'); a.P('head', G.sphLo, col, [0, 0.43, -0.01], [0.17, 0.04, 0.17], null, 'plain'); }

    /* --- виды зверят: голова, ушки, хвост, лицо; наряд — по роли --- */
    const SPECIES = {
      lamb(a, s) {
        const wool = s.fur || '#F4EEE4', woolD = s.fur2 || '#E6DDD0', face = s.faceCol || '#F2E6DA';
        torso(a, wool, null, [0.26, 0.27, 0.24]);
        [[0.14, 0.32, 0.06], [-0.14, 0.32, 0.06], [0, 0.4, 0.1], [0.1, 0.12, -0.1], [-0.1, 0.12, -0.1]].forEach(([x, y, z], i) => a.P('body', G.sphLo, i % 2 ? woolD : wool, [x, y, z], [0.12, 0.11, 0.12], null, 'plain'));
        const r = headBall(a, face, [0.2, 0.2, 0.2]);
        a.P('head', G.sph, wool, [0, 0.3, -0.02], [0.17, 0.1, 0.16], null, 'plain');
        [-1, 1].forEach(sd => a.P('head', G.sph, face, [sd * 0.2, 0.15, -0.02], [0.09, 0.035, 0.05], [0, 0, -sd * 0.5], 'plain'));
        a.faceDecal(s.face || 'bride', [0, 0.14, 0], r);
        a.headR = r;
      },
      bear(a, s) {
        const f = s.fur || '#A8784E', m = s.fur2 || '#E8CFAE';
        torso(a, f, m, [0.27, 0.28, 0.25]);
        const r = headBall(a, f, [0.24, 0.22, 0.22]);
        [-1, 1].forEach(sd => { a.P('head', G.sph, f, [sd * 0.16, 0.31, -0.02], [0.075, 0.075, 0.05]); a.P('head', G.sphLo, m, [sd * 0.16, 0.31, 0.01], [0.04, 0.04, 0.02], null, 'plain'); });
        a.faceDecal('bear', [0, 0.14, 0], r); a.headR = r;
      },
      badger(a, s) {
        const g = s.fur || '#8E8A86', w = '#F2EEE8', gd = '#55504E';
        torso(a, g, w, [0.26, 0.26, 0.24]);
        const r = headBall(a, w, [0.23, 0.21, 0.22]);
        [-1, 1].forEach(sd => a.P('head', G.sph, gd, [sd * 0.16, 0.29, -0.05], [0.06, 0.05, 0.04]));
        a.faceDecal('badger', [0, 0.14, 0], r); a.headR = r;
      },
      fox(a, s) {
        const f = s.fur || '#E8894A', w = '#FFF4E6', d = '#5E3A2E';
        torso(a, f, w, [0.24, 0.26, 0.22]);
        const r = headBall(a, f, [0.22, 0.2, 0.2]);
        [-1, 1].forEach(sd => { a.P('head', G.cone, f, [sd * 0.12, 0.33, -0.02], [0.07, 0.15, 0.05], [0, 0, -sd * 0.3]); a.P('head', G.cone, d, [sd * 0.135, 0.39, -0.02], [0.03, 0.06, 0.025], [0, 0, -sd * 0.3], 'plain'); });
        if (!s.noTail) { a.P('body', G.sph, f, [0.05, 0.08, -0.3], [0.09, 0.09, 0.2], [0.6, 0.3, 0]); a.P('body', G.sphLo, w, [0.08, 0.0, -0.45], [0.06, 0.06, 0.07], null, 'plain'); }
        a.faceDecal('fox', [0, 0.14, 0], r); a.headR = r;
      },
      hare(a, s) {
        const f = s.fur || '#D9C8B4', pk = '#F7B9C4';
        torso(a, f, '#F4ECE2', [0.23, 0.27, 0.21]);
        const r = headBall(a, f, [0.21, 0.2, 0.2]);
        [-1, 1].forEach(sd => { a.P('head', G.sph, f, [sd * 0.08, 0.45, -0.04], [0.05, 0.19, 0.035], [0, 0, -sd * 0.18]); a.P('head', G.sphLo, pk, [sd * 0.08, 0.45, -0.015], [0.026, 0.13, 0.015], [0, 0, -sd * 0.18], 'plain'); });
        a.faceDecal('hare', [0, 0.14, 0], r); a.headR = r;
      },
      cat(a, s) {
        const f = s.fur || '#A7A9B0', pk = '#F7B9C4';
        torso(a, f, '#F4F2EE', [0.23, 0.25, 0.21]);
        const r = headBall(a, f, [0.21, 0.19, 0.19]);
        [-1, 1].forEach(sd => { a.P('head', G.cone, f, [sd * 0.12, 0.3, -0.01], [0.065, 0.12, 0.045], [0, 0, -sd * 0.38]); a.P('head', G.cone, pk, [sd * 0.12, 0.29, 0.01], [0.035, 0.07, 0.02], [0, 0, -sd * 0.38], 'plain'); });
        a.P('body', G.sph, f, [0.08, 0.05, -0.26], [0.045, 0.045, 0.16], [0.9, 0.4, 0]);
        a.faceDecal(s.face || 'cat', [0, 0.14, 0], r); a.headR = r;
      },
      hedgehog(a, s) {
        const b = s.fur || '#A88A72', sp = '#6E5A4E', cr = '#EFDCC8';
        torso(a, b, cr, [0.25, 0.27, 0.23]);
        const up = new T.Vector3(0, 1, 0), dir = new T.Vector3();
        const NSP = HI ? 14 : 9; for (let i = 0; i < NSP; i++) { const ang = (i / NSP) * PI * 2 * 2.1, k = i / NSP, yy = -0.2 + k * 0.8, rr = Math.sqrt(Math.max(0.05, 1 - yy * yy)); dir.set(Math.sin(ang) * rr, yy, -Math.abs(Math.cos(ang)) * rr - 0.25).normalize(); const e2 = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(up, dir)); a.P('body', G.cone, sp, [dir.x * 0.22, 0.24 + dir.y * 0.25, dir.z * 0.2], [0.05, 0.15, 0.05], [e2.x, e2.y, e2.z], 'plain'); }
        const r = headBall(a, cr, [0.21, 0.2, 0.2]);
        a.faceDecal('hedgehog', [0, 0.14, 0], r); a.headR = r;
      },
      goat(a, s) {
        const f = s.fur || '#F3EDE4', h = '#CDBFA6';
        torso(a, f, null, [0.24, 0.26, 0.22]);
        const r = headBall(a, f, [0.21, 0.21, 0.21]);
        [-1, 1].forEach(sd => { a.P('head', G.cone, h, [sd * 0.08, 0.36, -0.05], [0.04, 0.16, 0.04], [-0.4, 0, -sd * 0.25]); a.P('head', G.sph, f, [sd * 0.2, 0.16, -0.02], [0.08, 0.03, 0.045], [0, 0, -sd * 0.4], 'plain'); });
        a.faceDecal('goat', [0, 0.14, 0], r); a.headR = r;
      },
      squirrel(a, s) {
        const f = s.fur || '#C9733E';
        torso(a, f, '#FFF1DE', [0.22, 0.25, 0.2]);
        const r = headBall(a, f, [0.2, 0.19, 0.19]);
        [-1, 1].forEach(sd => a.P('head', G.cone, f, [sd * 0.1, 0.32, -0.02], [0.05, 0.11, 0.04], [0, 0, -sd * 0.2]));
        a.P('body', G.sph, f, [0, 0.38, -0.3], [0.12, 0.3, 0.12], [-0.35, 0, 0]);
        a.faceDecal('squirrel', [0, 0.14, 0], r); a.headR = r;
      },
      mouse(a, s) {
        const g = s.fur || '#B9AFA8', pk = '#F2B8C2';
        torso(a, g, '#E8DED8', [0.2, 0.23, 0.19]);
        const r = headBall(a, g, [0.18, 0.17, 0.17]);
        [-1, 1].forEach(sd => { a.P('head', G.cyl, g, [sd * 0.15, 0.27, -0.02], [0.1, 0.02, 0.1], [PI / 2, 0, 0]); a.P('head', G.cyl, pk, [sd * 0.15, 0.27, -0.008], [0.07, 0.02, 0.07], [PI / 2, 0, 0], 'plain'); });
        a.faceDecal('mouse', [0, 0.14, 0], r); a.headR = r;
      },
      raccoon(a, s) {
        const g = s.fur || '#9A949C', d = '#4E4650';
        torso(a, g, '#F4EEE8', [0.24, 0.26, 0.22]);
        const r = headBall(a, g, [0.22, 0.2, 0.2]);
        [-1, 1].forEach(sd => a.P('head', G.sph, g, [sd * 0.15, 0.3, -0.03], [0.065, 0.065, 0.04]));
        if (!s.noTail) for (let i = 0; i < 4; i++) a.P('body', G.sphLo, i % 2 ? d : g, [0.04 + i * 0.03, 0.06 + i * 0.03, -0.26 - i * 0.07], [0.07, 0.07, 0.06], null, 'plain');
        a.faceDecal('raccoon', [0, 0.14, 0], r); a.headR = r;
      },
    };
    /* --- ПАЛЬТАР (по фото p1–p4): высокий статный ряженый, не зверёк — ничего звериного не видно. Войлочный капюшон-маска
       (яйцом, с полосами, выпуклым носом, красными губами) переходит в длинный нагрудник; кольчуга до середины бедра с рваным
       подолом и рукавами-колоколами до локтя поверх белой рубахи; кожаный пояс с пряжкой; светлые штаны, тёмные сапоги;
       перчатки (жёлтые резиновые, белые и кремовые в точку, синие вязаные) или голые руки; султан, коса, хвост, мех, борода;
       у D и E — короткая кожаная плётка (ею только щёлкают в воздухе, никогда ни в кого). Кости — как у человека.
       Метры, масштаб 1: макушка 2,25, султан до 2,42; глаза 2,06; плечи 1,69; пояс 1,28; подол 0,84; колено 0,53 --- */
    const PH = { hip: 1.0, waist: 1.24, neck: 1.8, shX: 0.29, shY: 1.685, elb: 1.35, wri: 1.035, fing: 0.075, kn: 0.53, legX: 0.105 };
    const PV = {
      A: { base: '#23201E', glove: 'bare', belt: '#6B3A22', buckle: null, hair: 'pony', bibW: 0.2, bibL: 0.46 },
      B: { base: '#23201E', glove: 'dots', belt: '#3A2A22', buckle: 'iron', hair: 'plume', bibW: 0.27, bibL: 0.43 },
      C: { base: '#B8B19B', glove: 'yellow', belt: '#3A2A22', buckle: 'brass', hair: 'shag', bibW: 0.28, bibL: 0.4 },
      D: { base: '#2F251E', glove: 'cream', belt: '#3A2A22', buckle: null, hair: 'beard', bibW: 0.27, bibL: 0.52, whip: true, satin: true },
      E: { base: '#B83A5E', glove: 'navy', belt: '#2A221F', buckle: 'brass', hair: 'tuft', bibW: 0.28, bibL: 0.42, whip: true, ruff: true },
    };
    // профиль, у которого v текстуры — линейно по высоте (как на рисунке лица): точки снизу вверх [r, y]
    function latheV(pts, segs, phi0, phiL, y0, y1) {
      const g = keep(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), segs, phi0, phiL));
      const P = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) U.setY(i, (P.getY(i) - y0) / (y1 - y0));
      return g;
    }
    // капюшон (оси головы: шея — 0; подбородок 0,06; макушка 0,45): лицо — спереди 150°, затылок — 210°
    const HOODP = [[0.122, -0.02], [0.133, 0.05], [0.158, 0.12], [0.176, 0.19], [0.182, 0.25], [0.177, 0.31], [0.161, 0.36], [0.133, 0.403], [0.094, 0.432], [0.048, 0.449], [0, 0.455]];
    // на low профиль капюшона — без двух почти лишних точек (щека, висок: хорда внутри не больше 6 мм)
    const HOODL = HI ? HOODP : HOODP.filter((p, i) => i !== 3 && i !== 5), MSEG = HI ? 14 : 10;
    const hoodR = yl => { for (let i = 1; i < HOODP.length; i++) if (yl <= HOODP[i][1]) { const a = HOODP[i - 1], b = HOODP[i]; return lerp(a[0], b[0], clamp((yl - a[1]) / (b[1] - a[1]), 0, 1)); } return 0; };
    // профиль кольчуги [r, y]: плечи покатые (рукав-колокол висит вдоль руки, а не «плечики вешалки»)
    const MAILUP = [[0.24, 1.27], [0.258, 1.4], [0.28, 1.56], [0.27, 1.67], [0.24, 1.765], [0.13, 1.8]];
    const PG = {
      hoodF: latheV(HOODL, HI ? 10 : 8, -PI * 75 / 180, PI * 150 / 180, -0.02, 0.455),
      hoodB: latheV(HOODL, HI ? 8 : 6, PI * 75 / 180, PI * 210 / 180, -0.02, 0.455),
      // кольчуга: верх (на кости груди, мир 1,27..1,80) и юбка до середины бедра (на тазу) — шов сзади
      mailUp: latheV(MAILUP, MSEG, PI, TAU, 0.84, 1.8),
      mailLo: latheV([[0.315, 0.84], [0.29, 0.97], [0.262, 1.13], [0.242, 1.31]], MSEG, PI, TAU, 0.84, 1.8),
      sleeve: keep(new T.CylinderGeometry(0.075, 0.128, 0.33, 10, 1, true)),
      // пушистый ворот E: спереди открыт (нагрудник идёт от подбородка без разрыва, концы ворота — за его краями), невысокий
      // мягкий валик у основания капюшона (сечение — замкнутый четырёхугольник): сверху и сзади не просвечивает (материал
      // атласа — односторонний); низ ровный и плотный — сквозь зубцы просвечивал лоскут
      ruff: keep(new T.LatheGeometry([[0.24, -0.06], [0.14, 0.05], [0.115, 0.03], [0.215, -0.07], [0.24, -0.06]].map(p => new T.Vector2(p[0], p[1])), 22, PI * 48 / 180, PI * 264 / 180)),
      // пальцы: кончик (−y) тоньше основания — на low не «корона» из плоских цилиндров
      finger: HI ? keep(new T.CapsuleGeometry(1, 1, 1, 4)) : keep(new T.CylinderGeometry(1, 0.6, 3, 5)),
      cone5: keep(new T.ConeGeometry(1, 1, 5, 1, true)), cyl6: keep(new T.CylinderGeometry(1, 1, 1, 6)), cylO8: keep(new T.CylinderGeometry(1, 1, 1, 8, 1, true)),
      // прядь с волосками: у корня полная, кончик тупой и круглый (острый конус в копне читался иглой, «аниме»-шипами, заострённые
      // лопасти — соломенной крышей); на low — на одно кольцо меньше
      lock: keep(new T.LatheGeometry((HI ? [[0.9, -0.5], [1, -0.15], [0.8, 0.27], [0, 0.45]] : [[0.9, -0.5], [0.86, 0.2], [0, 0.44]]).map(p => new T.Vector2(p[0], p[1])), 5)),
      // coil — виток свёрнутой плётки: тонкий и круглый (толстые квадратные витки читались стопкой блинов)
      cyl8: keep(new T.CylinderGeometry(1, 1, 1, 8)), sph5: keep(new T.SphereGeometry(1, 5, 3)), sph6: keep(new T.SphereGeometry(1, 6, 4)), coil: keep(new T.TorusGeometry(1, 0.12, 5, 12)),
      // нос: войлочный, к кончику сужается и скругляется (+y — корень в маске, −y — кончик); плоский торец читался пятачком
      snout: keep(new T.LatheGeometry([[0, -0.04], [0.017, -0.037], [0.024, -0.026], [0.027, -0.007], [0.03, 0.018], [0.034, 0.04]].map(p => new T.Vector2(p[0], p[1])), HI ? 7 : 6)),
      // тот же нос круглее (10 граней) — для C и E: кольца полос на 6–7 гранях спереди читались гайкой
      snout10: keep(new T.LatheGeometry([[0, -0.044], [0.013, -0.04], [0.019, -0.028], [0.023, -0.006], [0.029, 0.02], [0.034, 0.04]].map(p => new T.Vector2(p[0], p[1])), 10)),
      // нос C: низкий бугор-эллипсоид, наполовину в маске (цилиндр с круглым торцом в 3/4 читался пробкой, пятачком)
      mound: keep(new T.SphereGeometry(1, 10, 6)), tri: keep(new T.CylinderGeometry(1, 1, 1, 3)), ring: keep(new T.TorusGeometry(1, 0.28, 3, 8)),
    };
    // рваный край: каждая вторая вершина нижнего кольца — ниже
    const ragged = (g, yBottom, dy, segs) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) if (Math.abs(P.getY(i) - yBottom) < 1e-4) { const k = Math.round((Math.atan2(P.getX(i), P.getZ(i)) + PI) / TAU * segs); if (k % 2) P.setY(i, yBottom - dy); } P.needsUpdate = true; g.computeVertexNormals(); };
    ragged(PG.mailLo, 0.84, 0.035, MSEG); ragged(PG.sleeve, -0.165, 0.035, 10);
    {
      // ворот: лохматый верхний край (сдвиг — по сегменту дуги), нижний — ровный мягкий валик (зубцы снизу читались зубами или
      // бумажной короной), кончики ворса снизу темнее (цвет вершин)
      const P = PG.ruff.attributes.position, NP = 5, Cv = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        const sg = Math.floor(i / NP), j = i % NP, top = j === 1 || j === 2, k = top ? 1 : 0.7;
        if (top) P.setY(i, P.getY(i) + ((sg * 5) % 3) * 0.008);
        Cv[i * 3] = k; Cv[i * 3 + 1] = k * 0.92; Cv[i * 3 + 2] = k * 0.95;
      }
      PG.ruff.setAttribute('color', new T.BufferAttribute(Cv, 3)); P.needsUpdate = true; PG.ruff.computeVertexNormals();
      // торцы дуги спереди (у нагрудника) закрыты — с обеих сторон, без щели внутрь валика
      const cp = [], last = P.count / NP - 1, vx = (sg, q) => [P.getX(sg * NP + q), P.getY(sg * NP + q), P.getZ(sg * NP + q)];
      [0, last].forEach(sg => [[0, 1, 2], [0, 2, 3], [2, 1, 0], [3, 2, 0]].forEach(tr => tr.forEach(q => cp.push(...vx(sg, q)))));
      PG.ruffCap = keep(new T.BufferGeometry()); PG.ruffCap.setAttribute('position', new T.Float32BufferAttribute(cp, 3));
      PG.ruffCap.setAttribute('uv', new T.Float32BufferAttribute(new Array(cp.length / 3 * 2).fill(0.5), 2));
      PG.ruffCap.setAttribute('color', new T.Float32BufferAttribute(new Array(cp.length).fill(0.75), 3)); PG.ruffCap.computeVertexNormals();
    }
    // кольчуга одной текстурой: юбка и верх — v 0..0,75 клетки по высоте 0,84..1,80; рукав — та же частота колец
    const MAILR = PUV.mail, SLVR = [PUV.mail[0], PUV.mail[1], PUV.mail[2] * 0.49, PUV.mail[3] * 0.34], MAILT = '#BCC0C6';
    // поверхность груди (для нагрудника, косы): радиус кольчуги на высоте y; спереди назад сплюснута (× MZ)
    const MAILPROF = [[0.84, 0.315], [0.97, 0.29], [1.13, 0.262], [1.31, 0.242]].concat(MAILUP.slice(1).map(p => [p[1], p[0]]));
    const mailR = y => { for (let i = 1; i < MAILPROF.length; i++) if (y <= MAILPROF[i][0]) { const a = MAILPROF[i - 1], b = MAILPROF[i]; return lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0])); } return 0.13; };
    const MZ = 0.66;
    // глубина поверхности (кольчуга или капюшон) в точке x на высоте y — эллипс сечения
    const surfZ = (x, y) => {
      const rm = mailR(y), zm = rm > Math.abs(x) ? rm * MZ * Math.sqrt(1 - (x / rm) * (x / rm)) : 0;
      const rh = y > PH.neck - 0.02 ? hoodR(y - PH.neck) : 0, zh = rh > Math.abs(x) ? rh * 1.09 * Math.sqrt(1 - (x / rh) * (x / rh)) : 0;
      return Math.max(zm, zh);
    };
    // нагрудник-щит сеткой по силуэту рисунка — целиком на кости груди: голова поворачивается над ним, ничего не рвётся;
    // висит от подбородка чуть впереди капюшона и кольчуги, ниже ложится на грудь (нигде не уходит в кольчугу — без мерцания)
    function bibGeo(key) {
      const v = PV[key], sh = PSH[key], hw = shieldHW(sh[0], sh[1], sh[2]), Wc = v.bibW * 128 / sh[1], L = v.bibL || 0.36, yTop = 1.866, yBot = 1.86 - L;
      const NR = 9, NC = 4, P = [], U = [], I = [];
      let zp = 0;
      for (let i = 0; i <= NR; i++) {
        const y = lerp(yTop, yBot, i / NR), u = clamp((1.86 - y) / L, 0, 1), hwm = hw(u) / 128 * Wc;
        zp = i ? Math.max(surfZ(0, y) + 0.018, zp - 0.012) : surfZ(0, y) + 0.018;
        for (let j = 0; j <= NC; j++) { const s = j / NC * 2 - 1, x = s * hwm; P.push(x, y, Math.max(zp - 0.035 * s * s, surfZ(x, y) + 0.012)); U.push(0.5 + s * hw(u) / 128, 1 - u); }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
      return g;
    }
    // лоскут капюшона сзади (затылок → спина, 1,80..1,57): полосы капюшона продолжаются вниз; тоже не уходит в кольчугу
    function flapGeo() {
      const P = [], Uv = [], I = [], NR = 5, NC = 4;
      for (let i = 0; i <= NR; i++) {
        const t = i / NR, y = lerp(1.8, 1.57, t), hw = 0.135 * Math.sqrt(Math.max(0, 1 - Math.pow(t, 3)));
        for (let j = 0; j <= NC; j++) { const s2 = j / NC * 2 - 1, x = -s2 * hw; P.push(x, y, -Math.max(surfZ(0, y) + 0.02 - 0.03 * s2 * s2, surfZ(x, y) + 0.012)); Uv.push(0.5 + s2 * hw / 0.3, 0.2 * (1 - t)); }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(Uv, 2)); g.setIndex(I); g.computeVertexNormals();
      return g;
    }
    const FLAPG = flapGeo();
    // борода (C, D) сеткой: мягкая выпуклая «подушка» с волнистым нижним краем (o.nl лопастей глубиной o.lobe, края — короче на
    // o.pt), сверху уже (o.w0), книзу сужается (o.taper), края у щёк загнуты назад (o.curl), низ — вперёд по груди (o.tilt); перед и
    // тонкая спинка — сбоку линза, насквозь не видно; v текстуры — сверху вниз (пряди шерсти идут по бороде вниз)
    function beardGeo(o) {
      const NR = HI ? 6 : 4, NC = HI ? 8 : 6, P = [], Uv = [], I = [];
      for (let sd = 0; sd < 2; sd++) {
        const b0 = P.length / 3;
        for (let i = 0; i <= NR; i++) for (let j = 0; j <= NC; j++) {
          const u = j / NC * 2 - 1, v = i / NR * (1 - o.lobe * (1 - Math.cos(o.nl * PI * u)) / 2) * (1 - o.pt * u * u);
          const hw = o.w * lerp(o.w0, 1, sst(0, 0.35, v)) * lerp(1, o.taper, sst(0.35, 1, v));
          const dome = Math.pow(Math.max(0, 1 - u * u), 0.6) * (0.3 + 0.7 * sst(0, 0.45, v)) * (1 - 0.3 * sst(0.6, 1, v));
          const zc = o.z0 + o.tilt * v - o.curl * u * u * (1 - v) * (1 - v);
          P.push(u * hw, -o.l * v, zc + (sd ? -0.3 : 1) * o.d * dome); Uv.push(0.5 + u * 0.5, 1 - v);
        }
        for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) { const a = b0 + i * (NC + 1) + j, b = a + NC + 1; if (sd) I.push(a, a + 1, b, a + 1, b + 1, b); else I.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(Uv, 2)); g.setIndex(I); g.computeVertexNormals();
      return g;
    }
    const BEARDO = {
      D: { w: 0.118, w0: 0.78, taper: 0.8, l: 0.21, nl: 3, lobe: 0.13, pt: 0.12, d: 0.042, tilt: 0.035, curl: 0.05, z0: -0.008 },
      C: { w: 0.072, w0: 0.85, taper: 0.5, l: 0.18, nl: 3, lobe: 0.1, pt: 0.25, d: 0.034, tilt: 0.03, curl: 0.03, z0: -0.006 },
    };
    const BEARDG = {};
    const BIBG = {};
    const _up = new T.Vector3(0, 1, 0), _dv = new T.Vector3(), _eu = new T.Euler();
    // поворот, который ведёт ось +y к направлению d (для конусов, прядей, усов)
    const aimE = (dx, dy, dz) => { _dv.set(dx, dy, dz).normalize(); _eu.setFromQuaternion(new T.Quaternion().setFromUnitVectors(_up, _dv)); return [_eu.x, _eu.y, _eu.z]; };
    // коса B: путь (оси ряженого) — из-за правого уха (за краем маски), через плечо, вниз по груди сбоку от нагрудника до пояса
    const BRAID = [[-0.15, 1.95, -0.06], [-0.19, 1.81, 0.1], [-0.2, 1.7, 0.15], [-0.2, 1.5, 0.152], [-0.19, 1.33, 0.13]];
    function makePaltar(a, spec, rootM, mk) {
      const key = spec.variant || 'B', v = PV[key], B = {}, U = PUV[key];
      a.variant = key; a.pv = v;
      B.root = mk('root', null, [a.x, 0, a.z]); B.root.rotation.y = a.ry;
      // W5 «Бум!» понарошку (js/playfight.js): пустая кость pf между корнем и телом/ногами (без весов, не в скелете) —
      // в неё слой возни пишет кувырок, сальто, поклон и в конце возвращает в покой; корнем по-прежнему владеет двор
      const pf = new T.Bone(); pf.name = a.id + ':pf'; B.root.add(pf); B.pf = pf;
      B.body = mk('body', pf, [0, PH.hip, 0]);
      B.chest = mk('chest', B.body, [0, PH.waist - PH.hip, 0]);
      B.head = mk('head', B.chest, [0, PH.neck - PH.waist, 0]);
      const off = { root: [0, 0, 0], body: [0, PH.hip, 0], chest: [0, PH.waist, 0], head: [0, PH.neck, 0] };
      [['L', 1], ['R', -1]].forEach(([s, sd]) => {
        B['arm' + s] = mk('arm' + s, B.chest, [sd * PH.shX, PH.shY - PH.waist, 0]);
        B['fore' + s] = mk('fore' + s, B['arm' + s], [0, PH.elb - PH.shY, 0]);
        B['hand' + s] = mk('hand' + s, B['fore' + s], [0, PH.wri - PH.elb, 0]); B['hand' + s].rotation.order = 'YZX';
        B['fing' + s] = mk('fing' + s, B['hand' + s], [0, -PH.fing, 0]);
        B['leg' + s] = mk('leg' + s, pf, [sd * PH.legX, PH.hip, 0]);
        B['shin' + s] = mk('shin' + s, B['leg' + s], [0, PH.kn - PH.hip, 0]);
        Object.assign(off, { ['arm' + s]: [sd * PH.shX, PH.shY, 0], ['fore' + s]: [sd * PH.shX, PH.elb, 0], ['hand' + s]: [sd * PH.shX, PH.wri, 0], ['fing' + s]: [sd * PH.shX, PH.wri - PH.fing, 0], ['leg' + s]: [sd * PH.legX, PH.hip, 0], ['shin' + s]: [sd * PH.legX, PH.kn, 0] });
      });
      // пряди (хвост, султан, кисточка, макушка) и борода — свои кости (пружинят); коса — на груди (не рвётся при повороте головы);
      // плётка — цепочка костей от кисти
      const hb = { pony: [0, 0.44, -0.06], plume: [0, 0.445, -0.02], tuft: [0.02, 0.44, -0.04], shag: [0, 0.44, -0.02] }[v.hair];
      if (hb) { B.hair0 = mk('hair0', B.head, hb); off.hair0 = [hb[0], PH.neck + hb[1], hb[2]]; }
      if (v.hair === 'plume') { B.hair1 = mk('hair1', B.chest, [BRAID[0][0], BRAID[0][1] - PH.waist, BRAID[0][2]]); off.hair1 = BRAID[0].slice(); }
      if (v.hair === 'beard' || v.hair === 'shag') { B.beard = mk('beard', B.head, [0, 0.11, 0.16]); off.beard = [0, PH.neck + 0.11, 0.16]; }
      if (v.whip) {
        B.whip0 = mk('whip0', B.handR, [0, -0.085, 0.0]); off.whip0 = [-PH.shX, PH.wri - 0.085, 0];
        let prev = B.whip0, py = PH.wri - 0.085, pz = 0.2;
        B.whip1 = mk('whip1', prev, [0, 0, 0.2]); off.whip1 = [-PH.shX, py, pz]; prev = B.whip1;
        for (let i = 2; i <= 5; i++) { B['whip' + i] = mk('whip' + i, prev, [0, -0.1, 0]); py -= 0.1; off['whip' + i] = [-PH.shX, py, pz]; prev = B['whip' + i]; }
        B.coil = mk('coil', B.body, [-0.235, 0.2, 0.06]); off.coil = [-0.235, PH.hip + 0.2, 0.06];
      }
      a.B = B; a.rest = { hipY: PH.hip, neckY: PH.neck };
      partFns(a, B, off, rootM);
      const P = a.P, tex = (bone, geo, uv, p, s, r, col, ol) => { const part = P(bone, geo, col || '#FFFFFF', p, s, r, { uv }); part.uv = uv; if (ol) partsOl.push(part); return part; };
      const cap = capP, skin = '#E8B596';
      // прядь-конус: корень (оси кости), направление, длина, толщина у корня; uv — прядь с волосками из атласа (цвет — множитель)
      const strand = (bone, rt, d, L2, r, col, uv) => { const l = Math.hypot(d[0], d[1], d[2]), c3 = [rt[0] + d[0] / l * L2 * 0.5, rt[1] + d[1] / l * L2 * 0.5, rt[2] + d[2] / l * L2 * 0.5]; if (uv) tex(bone, PG.lock, uv, c3, [r, L2, r], aimE(d[0], d[1], d[2]), col); else P(bone, PG.cone5, col, c3, [r, L2, r], aimE(d[0], d[1], d[2]), 'plain'); return [rt[0] + d[0] / l * L2, rt[1] + d[1] / l * L2, rt[2] + d[2] / l * L2]; };
      // точка на поверхности капюшона (оси головы): азимут an (0 — вперёд, + — к левому плечу), высота yl
      const onHood = (an, yl, out) => { const r = hoodR(yl) + (out || 0); return [Math.sin(an) * r, yl, Math.cos(an) * r * 1.09]; };
      // --- капюшон-маска, нос, нагрудник, лоскут сзади ---
      tex('head', PG.hoodF, U.face, [0, 0, 0], [1, 1, 1.09], null, null, true);
      tex('head', PG.hoodB, U.hood, [0, 0, 0], [1, 1, 1.09], null, null, true);
      // нос: у C и E — короткий круглый войлочный бугорок, полосы маски идут по нему кольцами (атлас; длинный гладкий нос читался
      // клювом, нос с белыми обручами — рожком-дуделкой); у A, B, D — тёмный войлок, короче и площе (длинный острый в 3/4 — клюв, у D
      // с кольцами вокруг глаз — сова)
      // C: тёмный войлочный бугор (фото p1: нос темнее полос), низ чуть вперёд
      if (key === 'C') P('head', PG.mound, '#5E5646', [0, 0.205, 0.1855], [0.028, 0.042, 0.03], [-0.3, 0, 0], 'plain');
      else if (key === 'E') tex('head', PG.snout10, PUV.noseE, [0, 0.221, 0.207], [1.1, 0.5, 1.1], aimE(0, 0.05, -0.075), '#FFFFFF');
      else P('head', PG.snout, v.base, [0, 0.221, 0.209], [1.1, 0.78, 1], aimE(0, 0.05, -0.075), 'plain');
      if (!BIBG[key]) BIBG[key] = bibGeo(key);
      tex('chest', BIBG[key], U.bib, [0, -PH.waist, 0], [1, 1, 1]);
      // лоскут сзади (затылок переходит на спину): полосы капюшона
      tex('chest', FLAPG, U.hood, [0, -PH.waist, 0], [1, 1, 1]);
      // --- рубаха: ворот, рукава ниже кольчужных; кольчуга с рукавами-колоколами (контраст колец — из атласа, общий тон чуть
      // притушен: днём — тёмная сталь, а не серебристая вязка, как на фото p2, p4) ---
      P('chest', G.cylO, '#F3EDE3', [0, 0.535, 0], [0.142, 0.035, 0.115], null, 'plain');
      tex('chest', PG.mailUp, MAILR, [0, -PH.waist, 0], [1, 1, MZ], null, MAILT, true);
      tex('body', PG.mailLo, MAILR, [0, -PH.hip, 0], [1, 1, MZ], null, MAILT, true);
      const shirt = v.satin ? '#F0E2BE' : '#F3EDE3';
      ['L', 'R'].forEach((s, i) => {
        const sd = i ? -1 : 1;
        // рукав в контуре — только на high (на low контур у капюшона и кольчуги)
        tex('arm' + s, PG.sleeve, SLVR, [sd * 0.01, -0.165, 0], [1, 1, 1], null, MAILT, HI);
        P('arm' + s, cap(0.056, 0.2), shirt, [0, -0.18, 0], [1, 1, 1], null, 'plain');
        if (v.satin) { P('fore' + s, PG.sph6, shirt, [0, -0.14, 0], [0.085, 0.17, 0.085], null, 'plain'); P('fore' + s, PG.ring, '#E2CFA0', [0, -0.29, 0], [0.06, 0.06, 0.08], [PI / 2, 0, 0], 'plain'); }
        else P('fore' + s, cap(0.063, 0.2), shirt, [0, -0.14, 0], [1, 1, 1], null, 'plain');
        if (key === 'A') P('fore' + s, PG.ring, '#F3EDE3', [0, -0.3, 0], [0.07, 0.07, 0.1], [PI / 2, 0, 0], 'plain');
        // перчатки: ладонь, большой палец (на кисти), три пальца (на кости «пальцы» — сгиб и растопырка); манжета
        const gk = v.glove, guv = { dots: PUV.gDots, cream: PUV.gCream, navy: PUV.gNavy }[gk], gcol = gk === 'yellow' ? '#F6D23C' : gk === 'bare' ? skin : '#FFFFFF';
        const gp = (bone, geo, p, sc, r, k) => (guv ? tex(bone, geo, guv, p, sc, r) : P(bone, geo, gcol, p, sc, r, k || 'plain'));
        gp('hand' + s, HI ? PG.sph6 : PG.sph5, [0, -0.05, 0.003], [0.033, 0.062, 0.058]);
        // большой палец: ось развёрнута, чтобы кончик (−y образца) смотрел от кисти, как у остальных пальцев
        gp('hand' + s, PG.finger, [-sd * 0.006, -0.065, 0.056], [0.019, 0.025, 0.019], aimE(sd * 0.15, 0.6, -0.75));
        for (let f = 0; f < 3; f++) {
          const z = (f / 2 - 0.5) * 0.075, len = 0.037 - Math.abs(f - 1) * 0.005;
          gp('fing' + s, PG.finger, [0, -len * 1.4, z * 1.15], [0.0155, len, 0.0155], [-z * 3.2, 0, 0]);
          if (gk === 'cream') P('fing' + s, PG.sph5, skin, [0, -len * 2.85, z * 1.15 + len * 1.45 * Math.sin(z * 3.2)], [0.0165, 0.018, 0.0165], null, 'plain');
        }
        if (gk === 'yellow') P('hand' + s, PG.cylO8, '#F0EBD6', [0, 0.005, 0], [0.058, 0.07, 0.058], null, 'plain');
        else if (gk === 'navy') P('hand' + s, PG.cylO8, '#C9D1D6', [0, 0.06, 0], [0.066, 0.16, 0.066], null, 'plain');
        else if (gk !== 'bare') gp('hand' + s, PG.cylO8, [0, 0.0, 0], [0.056, 0.06, 0.056]);
        // ноги: штаны (бедро под подолом и голень), сапоги
        P('leg' + s, cap(0.095, 0.3), '#E6DED0', [0, -0.25, 0], [1, 1, 1], null, 'plain');
        P('shin' + s, cap(0.086, 0.14), '#E6DED0', [0, -0.07, 0], [1, 1, 1], null, 'plain');
        P('shin' + s, HI ? PG.cyl8 : PG.cyl6, '#3A2E28', [0, -0.32, 0.005], [0.085, 0.3, 0.09], null, 'plain');
        P('shin' + s, HI ? PG.sph6 : PG.sph5, '#3A2E28', [0, -0.47, 0.055], [0.085, 0.06, 0.15], null, 'plain');
      });
      // пояс с пряжкой (A — тёплая коричневая кожа; B — тёмная железная бляха с тиснёным треугольником; C, E — латунная пряжка)
      // радиус пояса — с запасом над кольчугой (у подола пояса не торчат её углы)
      const BR = 0.258;
      P('body', G.cylO, v.belt, [0, 0.28, 0], [BR, 0.065, BR * MZ], null, 'plain');
      if (v.buckle === 'brass') { P('body', G.box, '#C9A23F', [0, 0.28, BR * MZ + 0.006], [0.085, 0.075, 0.015], null, 'plain'); P('body', G.box, '#7A5A20', [0, 0.28, BR * MZ + 0.014], [0.05, 0.04, 0.006], null, 'plain'); }
      if (v.buckle === 'iron') { P('body', G.box, '#3E3A42', [0, 0.28, BR * MZ + 0.006], [0.078, 0.066, 0.012], null, 'plain'); P('body', PG.tri, '#6E6A74', [0, 0.282, BR * MZ + 0.014], [0.03, 0.006, 0.03], [PI / 2, 0, 0], 'plain'); }
      P('body', G.box, v.belt, [0.2, 0.22, 0.12], [0.03, 0.11, 0.008], [0, 0.6, 0], 'plain');
      // --- волосы, мех, бороды по видам (фото p1–p4) ---
      if (v.hair === 'pony') {
        // A (фото p2): большой чёрный хвост конского волоса — от макушки коротко назад (корни лежат, не торчат), дальше мягкой массой вниз за спину и к
        // правому плечу (в кадре спереди — слева от маски); пряди свисают и сбоку от маски
        P('hair0', PG.cyl6, '#6A4A3A', [0, 0.01, 0], [0.024, 0.035, 0.024], null, 'plain');
        const R = rng(77), cols = ['#1A181C', '#3E3A44', '#28252B'];
        // масса гривы: толстые пряди с волосками (атлас) от правого бока макушки вниз по капюшону к плечу — мягкая чёрная копна, а не
        // веер игл (на кости хвоста — пружинят вместе)
        const onH0 = (an, yl, o) => { const q = onHood(an, yl, o); return [q[0] - hb[0], q[1] - hb[1], q[2] - hb[2]]; };
        for (let i = 0, nm = HI ? 9 : 6; i < nm; i++) { const an = -lerp(0.95, 2.7, (i + R() * 0.6) / nm); strand('hair0', onH0(an, 0.39 + R() * 0.04, -0.012), [Math.sin(an) * 0.25, -1, Math.cos(an) * 0.2], 0.3 + R() * 0.14, 0.046 + R() * 0.01, i % 2 ? '#FFFFFF' : '#CFCAD4', PUV.hairA); }
        // отдельные пряди по краю копны: корень лежит назад, дальше — прямо вниз (вбок торчали крылом)
        for (let i = 0, ne = HI ? 12 : 8; i < ne; i++) {
          const sx = -0.05 - R() * 0.25 + (i % 6 === 0 ? 0.25 : 0), sz = -0.5 - R() * 0.45;
          const e = strand('hair0', [0, 0.02, 0], [sx * 0.45, -0.04 + R() * 0.1, sz], 0.05 + R() * 0.02, 0.02, cols[i % 3]);
          strand('hair0', e, [sx * 0.4, -1, sz * 0.2], 0.28 + R() * 0.17, 0.018, cols[(i + 1) % 3]);
        }
        for (let i = 0; i < 6; i++) strand('head', onHood(-1.2 - i * 0.08, 0.4, 0.005), [-0.25 - R() * 0.15, -1, -0.1 + R() * 0.15], 0.25 + R() * 0.1, 0.015, cols[i % 3]);
        // короткая кисточка над завязкой
        for (let k = 0; k < 3; k++) strand('hair0', [0, 0.03, 0], [(k - 1) * 0.3, 1, -0.2], 0.05, 0.012, '#1A181C');
      } else if (v.hair === 'plume') {
        // B: мягкий белый султан конского волоса на макушке (пружинит): пучок вверх, кончики мягко свисают назад (фото p2; веер
        // кончиков во все стороны читался звёздочкой из шипов); светлая коса — гладким жгутом-основой с косичкой из перекрывающихся
        // наклонённых звеньев поверх
        const RB = rng(91);
        for (let i = 0, npl = HI ? 22 : 14; i < npl; i++) {
          const an = i / npl * TAU + RB() * 0.3, rr = 0.011 + RB() * 0.003, c2 = i % 3 ? '#F4EFE6' : '#CFC6B8';
          const e = strand('hair0', [Math.sin(an) * 0.012, 0, Math.cos(an) * 0.012], [Math.sin(an) * 0.16, 1, Math.cos(an) * 0.16 - 0.1], 0.09 + RB() * 0.04, rr, c2);
          strand('hair0', e, [Math.sin(an) * 0.45, 0.15 - RB() * 0.55, Math.cos(an) * 0.35 - 0.6], 0.05 + RB() * 0.05, rr * 0.85, c2);
        }
        const pts = [], seg = [];
        for (let i = 1; i < BRAID.length; i++) seg.push(Math.hypot(BRAID[i][0] - BRAID[i - 1][0], BRAID[i][1] - BRAID[i - 1][1], BRAID[i][2] - BRAID[i - 1][2]));
        const tot = seg.reduce((p, q) => p + q, 0), NB = HI ? 24 : 12;
        const at = d => { let k = 0; while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; } const f = Math.min(1, d / seg[k]), A0 = BRAID[k], A1 = BRAID[k + 1]; return [lerp(A0[0], A1[0], f), lerp(A0[1], A1[1], f), lerp(A0[2], A1[2], f)]; };
        for (let i = 0; i <= NB; i++) pts.push(at(tot * i / NB));
        const o = BRAID[0];
        // жгут-основа по отрезкам пути (силуэт — одна верёвка, а не бусы)
        for (let i = 1; i < BRAID.length; i++) { const p0 = BRAID[i - 1], p1 = BRAID[i]; P('hair1', PG.cyl6, '#C9A676', [(p0[0] + p1[0]) / 2 - o[0], (p0[1] + p1[1]) / 2 - o[1], (p0[2] + p1[2]) / 2 - o[2]], [0.011, seg[i - 1], 0.011], aimE(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), 'plain'); }
        for (let i = 0; i < NB; i++) {
          const p0 = pts[i], p1 = pts[i + 1], t = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], sg = i % 2 ? 1 : -1, w = 0.015;
          P('hair1', PG.sph5, i % 2 ? '#C49E6C' : '#D2B07E', [(p0[0] + p1[0]) / 2 - o[0], (p0[1] + p1[1]) / 2 - o[1], (p0[2] + p1[2]) / 2 - o[2]], [w, tot / NB * 0.9, w * 0.8], aimE(t[0] + sg * 0.3 * Math.abs(t[1]), t[1], t[2]), 'plain');
        }
        const e = pts[NB];
        P('hair1', PG.cyl6, '#5E3E26', [e[0] - o[0], e[1] - o[1] + 0.005, e[2] - o[2]], [0.017, 0.02, 0.017], null, 'plain');
        for (let i = 0; i < 3; i++) strand('hair1', [e[0] - o[0], e[1] - o[1], e[2] - o[2]], [(i - 1) * 0.25, -1, 0.05], 0.07, 0.013, '#D4AE82');
      } else if (v.hair === 'shag') {
        // C (фото p1): копна светлой «соломы» — толстые мягкие пряди с волосками (атлас) лежат от макушки наружу и вниз, концы
        // свисают за край капюшона по бокам и сзади (вбок и вверх торчавшие у углов макушки читались ушками-рожками); спереди
        // макушку накрывает чёлка-соломка; поверх — тонкие волоски одним конусом (ломаные пряди с «коленом» читались ногами
        // паука); мягкие брови; борода — тёмная шерстяная бородка прямо из-под губ
        const R = rng(33), cols = ['#C9C2AE', '#9C9682', '#B5AE96', '#A8A08A'], tint = ['#E4DECD', '#D2CBB8', '#C2BBA6'];
        for (let i = 0, nm = HI ? 12 : 8; i < nm; i++) {
          const an = lerp(0.85, TAU - 0.85, (i + 0.2 + R() * 0.6) / nm);
          strand('head', onHood(an, 0.4 + R() * 0.02, -0.006), [Math.sin(an) * 0.6, -0.8 - R() * 0.3, Math.cos(an) * 0.6], 0.16 + R() * 0.05, 0.034 + R() * 0.008, tint[i % 3], PUV.hairC);
        }
        // чёлка: короткие пряди с темени вперёд и вниз — макушка без лысины между прядями; крайние — ниже, к вискам (копна одна, а
        // не «шапочка» и отдельные пряди-уши по бокам)
        for (let i = 0, nf = HI ? 7 : 5; i < nf; i++) {
          const u = (i + 0.5) / nf * 2 - 1, an = u * 1.05;
          strand('head', onHood(an, 0.445 - 0.035 * u * u, -0.01), [Math.sin(an) * (0.5 + 0.3 * u * u), -0.45 - 0.3 * u * u, 0.9 - 0.3 * u * u], 0.11 + R() * 0.03, 0.036, tint[(i + 2) % 3], PUV.hairC);
        }
        for (let i = 0, ns = HI ? 8 : 6; i < ns; i++) {
          const an = (i % 2 ? 1 : -1) * lerp(1.2, 2.9, ((i >> 1) + R() * 0.5) / Math.ceil(ns / 2));
          strand('head', onHood(an, 0.33 + R() * 0.05, -0.006), [Math.sin(an) * 0.45, -1, Math.cos(an) * 0.3], 0.14 + R() * 0.05, 0.03 + R() * 0.006, tint[(i + 1) % 3], PUV.hairC);
        }
        // волоски-вихры (пружинят): на макушке — наружу почти лёжа (вверх торчали шипами), по краю копны — в стороны и вниз
        for (let i = 0, nw = HI ? 16 : 9; i < nw; i++) {
          const an = i / nw * TAU + R() * 0.4, up = i % 3 === 0;
          strand('hair0', [Math.sin(an) * 0.03, -0.01, Math.cos(an) * 0.03 - 0.01], [Math.sin(an) * (up ? 0.75 : 0.95), up ? -0.12 : -0.35 + R() * 0.3, Math.cos(an) * (up ? 0.75 : 0.95) - 0.1], (up ? 0.06 : 0.13) + R() * 0.04, 0.0065, cols[i % 4]);
        }
        // брови: короткие пушистые пряди над глазами, вверх и чуть в стороны (длинные «в стороны» читались кошачьими усами)
        [-1, 1].forEach(sd => { for (let i = 0; i < 6; i++) strand('head', [sd * (0.05 + i * 0.011), 0.266 + (i % 2) * 0.008, 0.172 - i * 0.006], [sd * (0.55 + R() * 0.3), 0.55 + R() * 0.35, 0.55], 0.03 + R() * 0.02, 0.007, i % 2 ? '#9C9682' : '#B5AE96'); });
        // борода (фото p1): тёмная серо-оливковая шерстяная бородка из-под губ, уже лица, книзу сужается, низ волнистый (клин с
        // плоскими прядями сверху читался бумажным абажуром, морковкой; комки — плюшевым мишкой)
        if (!BEARDG.C) BEARDG.C = beardGeo(BEARDO.C);
        tex('beard', BEARDG.C, PUV.furC, [0, 0.008, 0.008], [1, 1, 1]);
      } else if (v.hair === 'beard') {
        // D (фото p3): широкая тёмная шерстяная борода из-под рта — шире низа лица, мягкой подушкой до первой «ёлочки» нагрудника,
        // низ волнистый (клин с плоскими прядями сверху читался бумажным абажуром, клочья по краям — шипами, комки — картошкой)
        // (светлые пряди на щеках у бороды в 3/4 читались бумажными клиньями — их нет, борода и так шире низа лица)
        if (!BEARDG.D) BEARDG.D = beardGeo(BEARDO.D);
        tex('beard', BEARDG.D, PUV.beardD, [0, 0.012, 0.012], [1, 1, 1]);
        // соломинка поперёк лица (фото p3): светлая, длиной с лицо
        strand('head', [-0.02, 0.19, 0.25], [-1, 0.15, 0.2], 0.22, 0.005, '#CDB98A');
      } else if (v.hair === 'tuft') {
        // E: тонкая рыже-бурая кисточка от завязки — пучок вверх, кончики загибаются назад и чуть расходятся (фото p4; веер прядей из
        // одной точки читался гребнем-ирокезом), пушистый малиновый ворот на плечах (шишек на висках нет — читались ушками)
        for (let i = 0; i < 8; i++) {
          const sx = (i - 3.5) * 0.01, e = strand('hair0', [sx * 0.3, -0.01, 0], [0.1 + sx * 2, 1, -0.15], 0.09, 0.014, i % 2 ? '#9A5434' : '#7A3E2C');
          strand('hair0', e, [0.25 + sx * 9, 0.35, -0.9], 0.09 + (i % 3) * 0.02, 0.011, i % 2 ? '#C07A52' : '#9A5434');
        }
        P('hair0', PG.cyl6, '#5A2A1E', [0, 0.004, 0], [0.016, 0.02, 0.016], null, 'plain');
      }
      // (сзади ворот шире по глубине — лоскут под ним не торчит наружу полосатой лентой)
      if (v.ruff) [PG.ruff, PG.ruffCap].forEach(g => tex('chest', g, PUV.ruff, [0, 0.545, -0.022], [1, 1, 0.92], null, '#FFFFFF'));
      // --- плётка (D, E): рукоять с латунными кольцами в кулаке, косичка из 4 звеньев, кисточка; на поясе — свёрнутая ---
      if (v.whip) {
        tex('whip0', PG.cyl6, PUV.grip, [0, 0, 0.06], [0.016, 0.28, 0.016], [PI / 2, 0, 0]);
        P('whip0', PG.sph5, '#C9A23F', [0, 0, -0.085], [0.022, 0.022, 0.022], null, 'plain');
        P('whip0', PG.ring, '#3A2A20', [0, -0.02, -0.07], [0.05, 0.05, 0.05], [0, PI / 2, 0], 'plain');
        for (let i = 1; i <= 5; i++) tex('whip' + i, PG.cyl6, PUV.lash, [0, -0.05, 0], [0.012 - i * 0.0014, 0.105, 0.012 - i * 0.0014]);
        const tc = key === 'E' ? '#2F4F7A' : '#8A5E3E';
        for (let i = 0; i < 3; i++) P('whip5', PG.cone5, tc, [(i - 1) * 0.006, -0.13, 0], [0.008, 0.07, 0.008], aimE((i - 1) * 0.3, -1, 0), 'plain');
        // три тонких круглых витка кожи один в другом (видны дырки витков), к зрителю и с наклоном, под поясом снаружи бедра (ребром
        // спереди или наполовину в кольчуге — крючок; толстые веером — стопкой блинов); рукоять — над поясом, с латунной головкой
        for (let i = 0; i < 3; i++) P('coil', PG.coil, ['#7A5034', '#5E3E2A', '#86603E'][i], [-0.06 + i * 0.006, -0.06 - i * 0.006, 0.02 + i * 0.01], [0.068 - i * 0.01, 0.09 - i * 0.012, 0.09], [0.35, 1.15, 0], 'plain');
        P('coil', PG.sph5, '#C9A23F', [-0.026, 0.165, 0.02], [0.02, 0.02, 0.02], null, 'plain');
        P('coil', PG.cyl6, '#3A2A20', [-0.01, 0.06, 0.02], [0.015, 0.2, 0.015], [0, 0, 0.15], 'plain');
      }
      a.headR = [0.17, 0.25, 0.18];
    }

    /* --- кто где: двор 20 × 12 (оси двора), всё ×S --- */
    const R0 = 2.5 * S, RC = [0, 0.4 * S];          // круг танца: радиус и центр
    const dais = { x: 0, z: -HD + 1.25 * S };
    const tableX = HW - 2.6 * S, tableL = Math.min(8, A.d - 4.2);
    const SPEC = [];
    // молодые на помосте (сидят рядом, но каждый на своём стуле)
    SPEC.push({ id: 'wed_bride', sp: 'lamb', face: 'bride', role: 'sit', x: dais.x + 0.62, z: dais.z, ry: 0, y: 0.25, fur: '#F7F2EA', faceCol: '#F6EAE0', outfit: 'bride', speaker: 'wed_bride' });
    SPEC.push({ id: 'wed_groom', sp: 'lamb', face: 'groom', role: 'sit', x: dais.x - 0.62, z: dais.z, ry: 0, y: 0.25, fur: '#D9B48A', fur2: '#C9A27A', faceCol: '#EAD3B8', outfit: 'groom', speaker: 'wed_groom' });
    // музыканты — слева от помоста
    SPEC.push({ id: 'wed_zurna', sp: 'badger', role: 'zurna', x: -3.9 * S, z: -HD + 2.3 * S, ry: 0.45, outfit: 'vest', vest: '#2F4F7A', speaker: 'wed_zurna' });
    SPEC.push({ id: 'wed_drum', sp: 'bear', role: 'drum', x: -2.9 * S, z: -HD + 1.75 * S, ry: 0.3, outfit: 'vest', vest: '#7A2E3E', speaker: 'wed_drum' });
    // круг танца
    const DANCERS = HI
      ? [['fox', 'f', '#2F7A5E'], ['bear', 'm', '#3A3550', { fur: '#8E6A4E' }], ['hare', 'f', '#C2405B'], ['goat', 'm', '#5E4A7A'], ['squirrel', 'f', '#2F4F7A'], ['cat', 'm', '#3A5E46'], ['mouse', 'f', '#8E3A7A'], ['raccoon', 'm', '#7A2E3E']]
      : [['fox', 'f', '#2F7A5E'], ['bear', 'm', '#3A3550', { fur: '#8E6A4E' }], ['hare', 'f', '#C2405B'], ['goat', 'm', '#5E4A7A'], ['squirrel', 'f', '#2F4F7A'], ['cat', 'm', '#3A5E46']];
    DANCERS.forEach((d, i) => SPEC.push(Object.assign({ id: 'dancer' + i, sp: d[0], role: 'dance', ring: i, x: RC[0], z: RC[1], outfit: d[1] === 'f' ? 'dress' : 'vest', dressCol: d[2], vest: d[2] }, d[3] || {})));
    // гости за столами (сидят) и тётушка-ежиха у казана
    const KZ = [tableX - 0.9 * S, -tableL / 2 - 1.05 * S];
    SPEC.push({ id: 'wed_aunt', sp: 'hedgehog', role: 'cook', x: KZ[0] - 0.85 * S, z: KZ[1] + 0.35 * S, ry: Math.atan2(0.85, -0.35), outfit: 'dress', dressCol: '#2F7A5E', speaker: 'wed_aunt' });
    [[1, -1.6, 'owl'], [1, 1.2, 'cat'], [-1, -0.6, 'hare'], [-1, 2.0, 'bear']].slice(0, HI ? 4 : 2).forEach(([side, zz, sp], i) => {
      const x = side * (tableX + 0.72 * S), m = sp === 'owl' ? 'mouse' : sp;
      SPEC.push({ id: 'guest' + i, sp: m, role: 'sit', eat: true, x, z: zz * S, ry: side > 0 ? -PI / 2 : PI / 2, y: 0.27, outfit: i % 2 ? 'vest' : 'dress', dressCol: ['#8E3A7A', '#2F4F7A', '#C2405B', '#3A3550'][i], vest: ['#3A5E46', '#5E4A7A'][i % 2], fur: sp === 'bear' ? '#B88A5E' : undefined });
    });
    // детёныши — ловят конфеты
    SPEC.push({ id: 'wed_kid', sp: 'cat', face: 'kitten', role: 'kid', x: 1.6 * S, z: -HD + 3.1 * S, ry: PI * 0.9, scale: 0.85, outfit: 'shirt', fur: '#E8B07A', speaker: 'wed_kid' });
    SPEC.push({ id: 'kid2', sp: 'lamb', face: 'lambkid', role: 'kid', x: -1.4 * S, z: -HD + 3.3 * S, ry: PI * 1.1, scale: 0.8, outfit: 'shirt' });
    // пальтары
    // пальтары (виды по фото): B — чёрно-белый с султаном и косой (он и разговаривает), C — лохматый в жёлтых перчатках
    // (зимой вместо него A — «вихрь» с чёрным хвостом), D — тёмный с золотом, бородой и плёткой; на high ещё E — малиновый
    [[3.8, 2.6, PI], [-3.8, 2.8, PI], [4.2, -1.8, -PI / 2], [-4.2, -1.6, PI / 2]].slice(0, PSET.length).forEach(([x, z, ry], i) => {
      SPEC.push({ id: 'paltar' + i, sp: 'paltar', variant: PSET[i], role: 'paltar', x: x * S, z: z * S, ry, scale: 1, speaker: i ? undefined : 'paltar' });
    });

    SPEC.forEach(sp => {
      const a = makeAnimal(Object.assign({ hipY: 0.22, shY: 0.56, neckY: 0.72 }, sp));
      void a;
    });
    // одежда после тела (поверх): платья, жилеты, платки, папаха, фата невесты, инструменты
    animals.forEach(a => {
      const s = a.spec, r = a.headR || [0.22, 0.2, 0.2];
      if (s.role === 'paltar') return;
      if (s.outfit === 'bride') {
        // невеста: платье цвета сливок с золотым шитьём (поясок, кайма, планка), монисто
        dress(a, '#FFF1D2', '#D9A632', '#D9A632');
        [-0.08, -0.04, 0, 0.04, 0.08].forEach((x, i) => a.P('body', G.sphLo, '#F2D27A', [x, 0.34 - Math.abs(x) * 0.6, a.torsoR[2] + 0.02], [0.022, 0.022, 0.012], null, 'plain'));
        // каз невесты: белый, длинный, с золотой каймой (на голову и до пояса за спину)
        scarf(a, [r[0] * 1.05, r[1] * 1.05, r[2] * 1.05], true);
        [-1, 1].forEach(sd => a.P('head', G.sphLo, '#E8C770', [sd * 0.17, 0.02, 0.1], [0.025, 0.025, 0.025], null, 'plain'));
      } else if (s.outfit === 'groom') {
        vest(a, '#2B2B3F', '#FFFDF8'); papakha(a, '#9C9894');
      } else if (s.outfit === 'dress') {
        dress(a, s.dressCol || '#2F7A5E', '#E8C770'); scarf(a, r);
      } else if (s.outfit === 'vest') {
        vest(a, s.vest || '#3A3550');
        if (a.role === 'dance' && a.idx % 4 === 1) papakha(a, '#6E6A70');
      } else if (s.outfit === 'shirt') {
        a.P('body', G.sph, a.spec.sp === 'lamb' ? '#F6D36B' : '#8FC1E3', [0, 0.2, 0.02], [0.24, 0.22, 0.22], null, 'plain');
      }
      if (a.role === 'zurna') {
        // зурна: деревянная дудка с раструбом — у рта, лапки держат её
        a.P('head', G.cyl, '#8A5A3E', [0, 0.02, 0.36], [0.022, 0.34, 0.022], [PI / 2 + 0.55, 0, 0], 'plain');
        a.P('head', G.cone, '#A86E48', [0, -0.11, 0.5], [0.065, 0.12, 0.065], [-(PI / 2 - 0.55), 0, 0], 'plain');
      }
      if (a.role === 'drum') {
        // барабан на ремне: тёмное дерево, светлая кожа, красный шнур
        a.P('body', G.cyl, '#7A4E32', [0, 0.2, 0.3], [0.2, 0.22, 0.2], [PI / 2, 0, 0], 'ol');
        [-1, 1].forEach(sd => a.P('body', G.cyl, '#F2E6CC', [0, 0.2, 0.3 + sd * 0.112], [0.205, 0.008, 0.205], [PI / 2, 0, 0], 'plain'));
        a.P('body', G.torus, '#C2405B', [0, 0.2, 0.3], [0.2, 0.2, 0.08], [0, 0, 0], 'plain');
        ['armL', 'armR'].forEach(b => { a.P(b, G.cyl, '#C9A27A', [0, -0.33, 0.04], [0.013, 0.2, 0.013], [0.15, 0, 0], 'plain'); a.P(b, G.sphLo, '#F2E6CC', [0, -0.44, 0.06], [0.025, 0.025, 0.025], null, 'plain'); });
      }
    });
    stage.updateMatrixWorld(true);

    /* --- сетки толпы: тело, контур, лица, «ткани» --- */
    const skel = new T.Skeleton(bones);
    const crowd = [];
    const mkSkinned = (parts, mat, opts) => {
      if (!parts.length) return null;
      const geo = keep(bake(T, parts, opts || {}));
      geo.boundingSphere = new T.Sphere(new T.Vector3(0, 1, 0), Math.hypot(HW, HD) + 2);
      const m = new T.SkinnedMesh(geo, mat); m.frustumCulled = true;
      stage.add(m); m.bind(skel, stage.matrixWorld.clone().multiply(new T.Matrix4().copy(m.matrix)));
      crowd.push(m); return m;
    };
    const meshBody = mkSkinned(partsBody, matBody); if (meshBody) { meshBody.castShadow = true; meshBody.name = 'wedding:crowd'; }
    const meshOl = mkSkinned(partsOl, matOl); if (meshOl) { meshOl.userData.outline = true; meshOl.raycast = () => {}; }
    // тени — только от тел (экономия на тенях)
    const meshTex = mkSkinned(partsTex, matTex, { uv: true }); if (meshTex) { meshTex.castShadow = false; meshTex.name = 'wedding:crowdTex'; }
    const meshFace = mkSkinned(partsFace, matFace, { uv: true, idx: true }); if (meshFace) { meshFace.renderOrder = 2; meshFace.raycast = () => {}; }
    // для стенда: треугольники по жителям и сеткам (бюджет)
    const trisBy = {};
    [['body', partsBody], ['ol', partsOl], ['tex', partsTex], ['face', partsFace]].forEach(([k, L]) => L.forEach(p => { const a = animals[p.idx], id = a ? a.id + (a.variant ? ':' + a.variant : '') : '?', r = trisBy[id] || (trisBy[id] = {}); r[k] = (r[k] || 0) + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3; }));

    /* ---------------------------------------------------------------------
       РЕКВИЗИТ (одна сетка с цветом вершин + одна с атласом): помост, ковёр, стулья, столы с угощением, навесы,
       гирлянды флажков, фонарики, мангал
       --------------------------------------------------------------------- */
    const bk = K && K.Baker ? new K.Baker('vc') : null;
    const flagBk = [], flagMeta = [];   // волна 4 (интегратор): каждая гирлянда — свой меш, у камеры прячется (иначе огромные флажки закрывали кадр)
    const F0 = K && K.Frame ? new K.Frame(0, 0, 0, 0) : null;
    const lit = [];     // фонарики: позиции
    const texQuads = [];
    const plates = {};   // где лежит угощение (для «взять»)
    const colliders = [];
    const R2 = rng(1010);
    if (bk) {
      const col = h => hex(h);
      const box = (x, y, z, w, h, d, c, ry, cols) => bk.box(F0, x, y, z, w, h, d, { col: col(c), rot: ry || 0, cols: cols ? Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, col(v)])) : undefined });
      const cylY = (x, y, z, r0, r1, h, c, seg) => bk.cyl(x, y, z, r0, r1, h, { col: col(c), seg: seg || 10 });
      const ball = (x, y, z, r, c, seg) => bk.sph(x, y, z, r, r * 0.92, r, col(c), { seg: HI ? seg || 6 : 5, rings: HI ? 4 : 3 });
      // помост молодых: низкая деревянная платформа, ковёр за спиной на раме, два стула с подушками, столик со сладостями
      box(dais.x, 0.09, dais.z, 2.8 * S, 0.18, 1.5, '#B98A5E', 0, { py: '#C99A6A' });
      [-0.62, 0.62].forEach(dx => {
        box(dais.x + dx, 0.18 + 0.2, dais.z - 0.05, 0.62, 0.06, 0.55, '#8A5A3E');
        box(dais.x + dx, 0.18 + 0.5, dais.z - 0.32, 0.62, 0.6, 0.06, '#8A5A3E');
        box(dais.x + dx, 0.18 + 0.25, dais.z - 0.05, 0.56, 0.04, 0.5, '#C2405B');
        [[-0.27, -0.24], [0.27, -0.24], [-0.27, 0.18], [0.27, 0.18]].forEach(([lx, lz]) => box(dais.x + dx + lx, 0.18 + 0.1, dais.z - 0.05 + lz, 0.05, 0.2, 0.05, '#6E4632'));
      });
      box(dais.x, 0.18 + 0.2, dais.z + 0.05, 0.42, 0.04, 0.36, '#8A5A3E'); box(dais.x, 0.18 + 0.1, dais.z + 0.05, 0.06, 0.2, 0.06, '#6E4632');
      cylY(dais.x, 0.42, dais.z + 0.05, 0.16, 0.18, 0.03, '#E8C770', 12);
      for (let i = 0; i < 9; i++) ball(dais.x + Math.sin(i * 2.4) * 0.1, 0.47, dais.z + 0.05 + Math.cos(i * 2.4) * 0.1, 0.028, ['#E8455A', '#F2C94C', '#5FB3B3', '#F5F0E6', '#8E3A7A'][i % 5]);
      // рама ковра и гирлянда-дуга с цветами над помостом
      [-1.5, 1.5].forEach(dx => box(dais.x + dx * S, 1.25, dais.z - 0.62, 0.08, 2.5, 0.08, '#6E4632'));
      box(dais.x, 2.48, dais.z - 0.62, 3.2 * S, 0.08, 0.1, '#6E4632');
      texQuads.push({ uv: UVR.carpet, c: [dais.x, 1.35, dais.z - 0.57], w: 2.7 * S, h: 1.9, ry: 0 });
      for (let i = 0; i <= 16; i++) { const t = i / 16, x = dais.x + (t - 0.5) * 3.0 * S, y = 2.6 + Math.sin(t * PI) * 0.25; ball(x, y, dais.z - 0.55, 0.075, ['#F2C94C', '#E8455A', '#FFFFFF', '#F7B9C4'][i % 4], 6); }
      // длинные столы под навесами (по бокам двора): скатерть, лавки, угощение
      [-1, 1].forEach(side => {
        const tx = side * tableX;
        box(tx, 0.7, 0, 0.95, 0.06, tableL, '#F6F1E6', 0, { py: '#FBF8F0' });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(tx + a * 0.38, 0.35, b * (tableL / 2 - 0.3), 0.06, 0.7, 0.06, '#8A5A3E'));
        texQuads.push({ uv: UVR.runner, c: [tx, 0.735, 0], w: 0.42, h: tableL - 0.2, ry: 0, flat: true });
        [-1, 1].forEach(bs => { box(tx + bs * 0.72, 0.42, 0, 0.32, 0.05, tableL - 0.2, '#B98A5E'); [-1, 1].forEach(e => box(tx + bs * 0.72, 0.2, e * (tableL / 2 - 0.4), 0.28, 0.4, 0.05, '#8A5A3E')); });
        colliders.push({ type: 'box', l: [tx, 0], w: 2.2, d: tableL + 0.2, y1: 0.8, id: 'wed_table' + (side > 0 ? 'E' : 'W') });
        // навес: четыре столба и полосатая крыша (две половины — двускатная)
        const cw = 2.3, ch = 2.55;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { cylY(tx + a * cw / 2, 0, b * (tableL / 2 + 0.25), 0.05, 0.05, ch, '#8A5A3E', 6); colliders.push({ type: 'circle', l: [tx + a * cw / 2, b * (tableL / 2 + 0.25)], r: 0.12, y1: ch, id: 'wed_pole' }); });
        const n = 10;
        for (let i = 0; i < n; i++) {
          const z0 = -tableL / 2 - 0.35 + (tableL + 0.7) * i / n, z1 = -tableL / 2 - 0.35 + (tableL + 0.7) * (i + 1) / n, c = i % 2 ? '#FFFDF8' : (side > 0 ? '#C2405B' : '#2F7A5E');
          const yT = ch + 0.42, yE = ch;
          bk.quad([tx - cw / 2 - 0.1, yE, z1], [tx - cw / 2 - 0.1, yE, z0], [tx, yT, z0], [tx, yT, z1], col(c));
          bk.quad([tx, yT, z1], [tx, yT, z0], [tx + cw / 2 + 0.1, yE, z0], [tx + cw / 2 + 0.1, yE, z1], col(c));
          if (season === 'winter') { bk.quad([tx - cw / 4, yT - 0.18 + 0.03, z1], [tx - cw / 4, yT - 0.18 + 0.03, z0], [tx, yT + 0.03, z0], [tx, yT + 0.03, z1], col('#F7F9FB')); bk.quad([tx, yT + 0.03, z1], [tx, yT + 0.03, z0], [tx + cw / 4, yT - 0.18 + 0.03, z0], [tx + cw / 4, yT - 0.18 + 0.03, z1], col('#F7F9FB')); }
          // фестон по краю
          [-1, 1].forEach(e => bk.tri([tx + e * (cw / 2 + 0.1), yE, z0], [tx + e * (cw / 2 + 0.1), yE, z1], [tx + e * (cw / 2 + 0.1), yE - 0.16, (z0 + z1) / 2], col(i % 2 ? '#E8C770' : '#FFFDF8')));
        }
        // угощение по столу: блюда с чуду, пельмени, плов в казане, фрукты, мёд, сладости, медные кувшины с водой
        for (let k = 0; k < 6; k++) {
          // последнее блюдо — у самого края стола (со стороны ворот): отсюда героиня берёт угощение руками
          const z = k < 5 ? -tableL / 2 + 0.6 + k * (tableL - 1.6) / 4.6 : tableL / 2 - 0.2, x = k < 5 ? tx + (k % 2 ? 0.18 : -0.18) : tx - 0.2;
          const kind = ['honey', 'pelmeni', 'sweets', 'fruit2', 'fruit', 'chudu'][k];
          cylY(x, 0.735, z, 0.17, 0.15, 0.02, '#F4F1EA', 14);
          if (kind === 'chudu') {
            for (let q = 0; q < 3; q++) cylY(x, 0.757 + q * 0.018, z, 0.14, 0.14, 0.016, q % 2 ? '#E2B062' : '#D69A48', 12); plates[side > 0 ? 'chuduE' : 'chuduW'] = [x, 0.82, z];
            // рядом на краю — ваза с фруктами (яблоки, груши, виноград)
            const fx = tx + 0.22; cylY(fx, 0.735, z, 0.15, 0.12, 0.05, '#C77D4F', 12);
            for (let q = 0; q < 8; q++) ball(fx + Math.sin(q * 2.1) * 0.075, 0.81 + (q > 5 ? 0.05 : 0), z + Math.cos(q * 2.1) * 0.075, 0.042, ['#D9455A', '#F2C94C', '#9C6AB0', '#B5C95A', '#D9455A', '#9C6AB0', '#F2C94C', '#D9455A'][q], 6);
            plates[side > 0 ? 'fruitEndE' : 'fruitEndW'] = [fx, 0.84, z];
          }
          if (kind === 'fruit' || kind === 'fruit2') { for (let q = 0; q < 7; q++) ball(x + Math.sin(q * 2.1) * 0.08, 0.79 + (q > 4 ? 0.05 : 0), z + Math.cos(q * 2.1) * 0.08, 0.045, ['#D9455A', '#F2C94C', '#E8894A', '#9C6AB0', '#D9455A', '#B5C95A', '#E8894A'][q], 6); plates[(kind === 'fruit' ? 'fruit' : 'fruit2') + (side > 0 ? 'E' : 'W')] = [x, 0.82, z]; }
          if (kind === 'pelmeni') for (let q = 0; q < 10; q++) bk.sph(x + Math.sin(q * 2.4) * 0.09, 0.765, z + Math.cos(q * 2.4) * 0.09, 0.03, 0.018, 0.022, col('#F6EEDC'), { seg: 5, rings: 3 });
          if (kind === 'sweets') for (let q = 0; q < 12; q++) ball(x + Math.sin(q * 1.7) * 0.1, 0.765, z + Math.cos(q * 1.7) * 0.1, 0.022, ['#E8455A', '#F2C94C', '#5FB3B3', '#8E3A7A', '#F7B9C4'][q % 5], 5);
          if (kind === 'honey') { cylY(x, 0.745, z, 0.05, 0.05, 0.1, '#E8A33A', 10); cylY(x, 0.845, z, 0.052, 0.04, 0.02, '#C2405B', 10); }
          // медный кувшин с водой (без чая, без вина)
          if (k === 1 || k === 3) { const jx = tx - (k % 2 ? 0.18 : -0.18); cylY(jx, 0.735, z + 0.25, 0.05, 0.07, 0.12, '#C77D4F', 10); cylY(jx, 0.855, z + 0.25, 0.07, 0.035, 0.08, '#C77D4F', 10); cylY(jx, 0.935, z + 0.25, 0.035, 0.045, 0.04, '#D9935F', 10); }
        }
      });
      // казан с пловом у тётушки (на каменном очаге)
      { const kx = KZ[0], kz = KZ[1];
        cylY(kx, 0, kz, 0.42, 0.4, 0.32, '#9C917F', 10); cylY(kx, 0.32, kz, 0.38, 0.3, 0.26, '#3A3436', 12); bk.sph(kx, 0.6, kz, 0.31, 0.1, 0.31, col('#E8B94A'), { seg: 10, rings: 4 });
        for (let q = 0; q < 6; q++) ball(kx + Math.sin(q) * 0.16, 0.66, kz + Math.cos(q) * 0.16, 0.035, '#E8894A', 5);
        plates.kazan = [kx, 0.7, kz]; colliders.push({ type: 'circle', l: [kx, kz], r: 0.5, y1: 0.7, id: 'wed_kazan' }); }
      // мангал у ворот: тёплый свет вечером (без дыма в лицо)
      { const mx = HW - 1.2 * S, mz = HD - 1.2 * S;
        box(mx, 0.5, mz, 0.9, 0.22, 0.4, '#4E4650'); [[-0.4, -0.15], [0.4, -0.15], [-0.4, 0.15], [0.4, 0.15]].forEach(([a, b]) => box(mx + a, 0.2, mz + b, 0.04, 0.4, 0.04, '#3A3436'));
        for (let q = 0; q < 8; q++) lit.push({ p: [mx - 0.35 + q * 0.1, 0.62, mz + (q % 2 ? 0.06 : -0.06)], c: '#FF9A4A', s: 0.05, coal: true });
        colliders.push({ type: 'box', l: [mx, mz], w: 1.0, d: 0.5, y1: 0.7, id: 'wed_mangal' }); }
      // гирлянды флажков и фонариков поперёк двора (от галереи до галереи)
      const strings = [[-HD + 2.2 * S, 3.5], [-0.4 * S, 3.7], [HD - 2.4 * S, 3.5]];
      strings.forEach(([z, h], si) => {
        const fb = K && K.Baker ? (flagBk[si] = new K.Baker('vc')) : bk; flagMeta[si] = { z, h };
        const x0 = -HW - 0.6, x1 = HW + 0.6, nF = Math.round((x1 - x0) / 0.42);
        let prev = null;
        for (let i = 0; i <= nF; i++) {
          const t = i / nF, x = lerp(x0, x1, t), y = h - Math.sin(t * PI) * 0.65, zz = z + Math.sin(t * PI * 2 + si) * 0.15;
          if (prev) fb.quad([prev[0], prev[1] + 0.012, prev[2]], [x, y + 0.012, zz], [x, y - 0.012, zz], [prev[0], prev[1] - 0.012, prev[2]], col('#5E4A40'));
          if (i < nF) { const c = ['#E8455A', '#F2C94C', '#3E8FD0', '#5DAA6E', '#FFFDF8', '#8E3A7A'][(i + si) % 6], xm = x + 0.21; fb.tri([x + 0.03, y, zz], [xm + 0.18, y - 0.02, zz], [xm + 0.05, y - 0.26, zz], col(c)); fb.tri([xm + 0.05, y - 0.26, zz], [xm + 0.18, y - 0.02, zz], [x + 0.03, y, zz], col(c)); }
          if (i % 3 === 1) lit.push({ p: [x, y - 0.09, zz], c: '#FFE7A6', s: 0.075 });
          prev = [x, y, zz];
        }
      });
    }
    let meshProps = null, meshPropsD = null;
    if (bk && bk.count()) { const g = bk.build(); keep(g); meshProps = new T.Mesh(g, K.vcMatD || K.vcMat); meshProps.castShadow = true; meshProps.receiveShadow = true; meshProps.name = 'wedding:props'; stage.add(meshProps); }
    const flagMeshes = flagBk.map((b, si) => { if (!b || !b.count()) return null; const g = keep(b.build()); const m = new T.Mesh(g, K.vcMatD || K.vcMat); m.castShadow = true; m.receiveShadow = true; m.name = 'wedding:flags' + si; m.userData.flag = flagMeta[si]; stage.add(m); return m; }).filter(Boolean);
    // атласные квадраты: ковёр на раме, дорожки на столах
    let meshCloth = null;
    if (texQuads.length) {
      const P = [], U = [], N = [], I = [];
      texQuads.forEach(q => {
        const r = q.uv, i0 = P.length / 3, hw = q.w / 2, hh = q.h / 2;
        const pts = q.flat ? [[-hw, 0, hh], [hw, 0, hh], [hw, 0, -hh], [-hw, 0, -hh]] : [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]];
        pts.forEach(([x, y, z], k) => { P.push(q.c[0] + x, q.c[1] + y, q.c[2] + z); N.push(0, q.flat ? 1 : 0, q.flat ? 0 : 1); U.push(r[0] + (k === 1 || k === 2 ? 1 : 0) * r[2] * 0.996 + 0.001, r[1] + (k >= 2 ? 1 : 0) * r[3] * 0.996 + 0.001); });
        I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      });
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I);
      meshCloth = new T.Mesh(g, matTexS); meshCloth.receiveShadow = true; stage.add(meshCloth);
    }
    // фонарики (одна сетка): днём — молочные, ночью — тёплые
    let meshLit = null; const litMat = keep(new T.MeshBasicMaterial({ vertexColors: true }));
    if (lit.length) {
      const og = new T.OctahedronGeometry(1, 0), P = [], Cc = [];
      lit.forEach(l => { const a = og.attributes.position; for (let i = 0; i < a.count; i++) { P.push(l.p[0] + a.getX(i) * l.s, l.p[1] + a.getY(i) * l.s * 1.2, l.p[2] + a.getZ(i) * l.s); Cc.push(1, 1, 1); } });
      og.dispose();
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); g.computeVertexNormals();
      meshLit = new T.Mesh(g, litMat); meshLit.name = 'wedding:lights'; stage.add(meshLit);
    }
    // конфеты (осыпают невесту): разноцветные точки, падают и тают
    // конфеты и искры пальтаров (вспышка фото, хлопок плётки, звёздочки) — одна сетка точек
    const NCANDY = 36, NSPARK = 24, NPT = NCANDY + NSPARK, candy = { pos: new Float32Array(NPT * 3), vel: new Float32Array(NPT * 3), life: new Float32Array(NPT), t: -1 };
    for (let i = 0; i < NPT; i++) candy.pos[i * 3 + 1] = -5;
    const candyGeo = keep(new T.BufferGeometry()); candyGeo.setAttribute('position', new T.BufferAttribute(candy.pos, 3));
    { const cc = new Float32Array(NPT * 3); for (let i = 0; i < NPT; i++) cc.set(hex(['#E8455A', '#F2C94C', '#5FB3B3', '#8E3A7A', '#F7B9C4', '#5DAA6E'][i % 6]), i * 3); candyGeo.setAttribute('color', new T.BufferAttribute(cc, 3)); }
    const dot = (() => { const [cv, c] = cnv(32, 32); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(16, 16, 13, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.0)'; return keep(new T.CanvasTexture(cv)); })();
    const candyMat = keep(new T.PointsMaterial({ size: 0.09, vertexColors: true, map: dot, alphaTest: 0.5, sizeAttenuation: true }));
    const candyPts = new T.Points(candyGeo, candyMat); candyPts.frustumCulled = false; candyPts.visible = false; stage.add(candyPts);
    // берет-копия для розыгрыша (бордовый, с розовым бантом), появляется только на время
    let beretMesh = null;
    if (K && K.Baker) {
      const b2 = new K.Baker('vc'), F2 = new K.Frame(0, 0, 0, 0);
      b2.sph(0, 0, 0, 0.17, 0.05, 0.165, hex('#8E2C44'), { seg: 12, rings: 6 }); b2.sph(0.02, 0.05, 0, 0.012, 0.02, 0.012, hex('#8E2C44'), { seg: 6, rings: 3 });
      [-1, 1].forEach(s => b2.sph(0.13 + s * 0.035, 0.0, 0.08, 0.035, 0.025, 0.02, hex('#F6B2B5'), { seg: 6, rings: 3 })); b2.sph(0.13, 0.0, 0.085, 0.014, 0.014, 0.014, hex('#F6B2B5'), { seg: 5, rings: 3 });
      void F2; const g = b2.build(); keep(g); beretMesh = new T.Mesh(g, K.vcMat); beretMesh.visible = false; group.add(beretMesh);
    }
    // коллайдеры: в мировые оси
    const worldCol = colliders.map(c => { const p = toW(c.l[0], c.l[1]); return c.type === 'box' ? { type: 'box', x: p.x, z: p.z, w: c.w, d: c.d, ry: A.ry, y0: A.y - 0.2, y1: A.y + c.y1, id: c.id } : { type: 'circle', x: p.x, z: p.z, r: c.r, y0: A.y - 0.2, y1: A.y + c.y1, id: c.id }; });
    [[dais.x, dais.z, 1.5 * S, 'wed_dais']].forEach(([x, z, r, id]) => { const p = toW(x, z); worldCol.push({ type: 'box', x: p.x, z: p.z, w: 2.9 * S, d: 1.6, ry: A.ry, y0: A.y - 0.2, y1: A.y + 1.2, id }); void r; });
    animals.filter(a => a.role === 'zurna' || a.role === 'drum' || a.role === 'cook').forEach(a => { const p = toW(a.x, a.z); worldCol.push({ type: 'circle', x: p.x, z: p.z, r: 0.38, y0: A.y - 0.2, y1: A.y + 1.2, id: 'wed_' + a.id }); });

    /* ---------------------------------------------------------------------
       ЖИТЕЛИ-СОБЕСЕДНИКИ (пустышки над головами — в мировых осях) и МЕСТА
       --------------------------------------------------------------------- */
    // реплики жителя; ряженому — только те, что подходят его костюму
    const linesFor = (id, a) => (LINES[id] || []).filter(l => !l.need || !a || !a.pv || (l.need === 'whip' ? !!a.pv.whip : a.pv.glove !== 'bare')).map(l => pick(l, named));
    const npcs = [];
    const byId = {};
    animals.forEach(a => { byId[a.id] = a; });
    const talkers = [['wed_bride', 'wed_bride'], ['wed_groom', 'wed_groom'], ['wed_zurna', 'wed_zurna'], ['wed_drum', 'wed_drum'], ['wed_aunt', 'wed_aunt'], ['wed_kid', 'wed_kid'], ['paltar0', 'paltar']];
    talkers.forEach(([aid, spk]) => {
      const a = byId[aid]; if (!a) return;
      const root = new T.Object3D(); root.name = 'npc:' + aid; group.add(root);
      const p = toW(a.x, a.z);
      root.position.set(p.x, p.y + (a.spec.y || 0), p.z);
      const sp = SPEAKERS[spk];
      const lo = linesFor(spk, a.role === 'paltar' ? a : null);
      const n = { id: aid === 'paltar0' ? 'paltar' : aid, speaker: spk, name: named || !sp.n ? sp.name : sp.n, icon: sp.icon, root, x: p.x, y: root.position.y, z: p.z, headY: a.role === 'paltar' ? 2.3 : 1.15 * a.scale, talkR: a.role === 'sit' ? 2.4 : a.role === 'paltar' ? 2.2 : 2.0, lines: lo.map(l => l.text), lineObjs: lo, animal: a, faceHero: 0, wedding: true };
      a.npc = n; npcs.push(n);
    });
    // W5: остальные пальтары — тоже «жители» для возни понарошку; шутки — те же, но по своему костюму
    animals.filter(a => a.role === 'paltar' && !a.npc).forEach(a => {
      const root = new T.Object3D(); root.name = 'npc:' + a.id; group.add(root);
      const p = toW(a.x, a.z); root.position.set(p.x, p.y + (a.spec.y || 0), p.z);
      const sp = SPEAKERS.paltar, lo = linesFor('paltar', a);
      const n = { id: a.id, speaker: 'paltar', name: named || !sp.n ? sp.name : sp.n, icon: sp.icon, root, x: p.x, y: root.position.y, z: p.z, headY: 2.3, talkR: 2.2, lines: lo.map(l => l.text), lineObjs: lo, animal: a, faceHero: 0, wedding: true };
      a.npc = n; npcs.push(n);
    });
    // пальтары: кость возни, радиус для «Бум!», на «помахать»/разговор — большое приветствие
    npcs.forEach(n => { const a = n.animal; if (a && a.role === 'paltar') { n.pfBody = a.B.pf; n.paltar = true; n.r = 0.38; n.hop = () => { if (!a.hold && !(st.prank && st.prank.a === a) && st.t > (a.hopT || 0) && ['walk', 'clap', 'guard', 'jingle', 'dance', 'bow'].includes(a.mode)) { a.hopT = st.t + 4; palStart(a, 'wave'); } }; } });
    const spotW = (id, lx, lz, r, label, icon) => { const p = toW(lx, lz); return { id, x: p.x, y: p.y, z: p.z, r, label, icon, wedding: true }; };
    const spots = [
      spotW('wedding_treat', tableX, tableL / 2 + 0.55, 1.2, 'Угоститься', '🥟'),
      spotW('wedding_dance', RC[0], RC[1] + R0 + 0.9, 1.5, 'В круг — танцевать', '💃'),
      spotW('wedding_congrats', dais.x, dais.z + 1.35, 1.4, 'Поздравить молодых', '💐'),
    ];

    /* ---------------------------------------------------------------------
       ДВИЖЕНИЕ
       --------------------------------------------------------------------- */
    const BPM = 116, BEAT = 60 / BPM;
    const ring = animals.filter(a => a.role === 'dance');
    const pal = animals.filter(a => a.role === 'paltar');
    const st = { t: 0, a0: 0, spin: 0.32, gap: 0, gapAng: 0, lod: 0, heroIn: 0, prankDone: false, prank: null, events: [], night: 0, beatN: -1, shower: -1, congrats: -1, hero: null, heroAnim: null };
    ring.forEach((a, i) => { a.ang = i / ring.length * TAU; a.angT = a.ang; });
    // маршрут ряженых (оси двора): две дуги — восточная и западная, туда и обратно, снаружи круга танца. Не по северной полосе
    // у помоста (там живут дети) и не мимо места «В круг — танцевать» у ворот (там героиня, а за ней — камера)
    const ARC = [[1.8, 4.5], [3.9, 3.1], [4.6, 1.0], [4.4, -0.6]];
    const PATHS = [1, -1].map(sd => { const p = ARC.map(([x, z]) => [sd * x * S, z * S]); return p.concat(p.slice(1, -1).reverse()); });
    pal.forEach((a, i) => { a.path = PATHS[i % 2]; a.seg = (i >> 1) * 2 % a.path.length; a.px = a.x; a.pz = a.z; a.pry = a.ry; a.spd = 0.9; a.cool = { boo: 3 + i * 4, whip: 8 + i * 5 }; a.gph = i * 1.3; });
    const kids = animals.filter(a => a.role === 'kid');
    // дети: дом, свой кружок для догонялок (вне круга танца и не у помоста), состояние игры с ряжеными
    kids.forEach((a, i) => { a.home = [a.x, a.z]; a.px = a.x; a.pz = a.z; a.pry = a.ry; a.ks = { mode: null, t: 0 }; a.loopC = i ? [-4.6 * S, -2.3 * S] : [3.7 * S, -3.0 * S]; a.loopR = 0.75 * S; });
    const emit = (type, data) => { const e = Object.assign({ type }, data || {}); (st.evCb || []).forEach(cb => { try { cb(e); } catch (er) { /* звук — не наш */ } }); return e; };
    const prankCbs = [];
    const prankEmit = (data) => { prankCbs.forEach(cb => { try { cb(data); } catch (er) { /* */ } }); emit('prank', data); };

    // смотрит на героиню, когда с ней говорят
    function lookUpd(a, dt) {
      if (a.npc && a.npc.faceHero > 0 && st.heroPos) {
        a.npc.faceHero -= dt;
        const wp = toW(a.B.root.position.x, a.B.root.position.z), want = Math.atan2(st.heroPos.x - wp.x, st.heroPos.z - wp.z) - A.ry - a.B.root.rotation.y;
        a.look += (clamp(angW(want), -1.0, 1.0) - a.look) * Math.min(1, dt * 5);
      } else a.look *= Math.max(0, 1 - dt * 3);
    }
    function pose(a, t, dt) {
      const B = a.B, s = a.spec, ph = a.ph, beat = (st.t / BEAT);
      if (a.role === 'paltar') { lookUpd(a, dt); palPose(a, t, beat, dt); return; }
      // сброс к позе покоя
      B.body.rotation.set(0, 0, 0); B.body.position.y = a.rest.hipY; B.body.scale.set(1, 1, 1);
      B.head.rotation.set(0, 0, 0); B.head.scale.set(1, 1, 1);
      B.armL.rotation.set(0, 0, 0); B.armR.rotation.set(0, 0, 0); B.legL.rotation.set(0, 0, 0); B.legR.rotation.set(0, 0, 0);
      const breathe = Math.sin(t * 2.2 + ph) * 0.015;
      B.body.scale.y = 1 + breathe;
      if (a.role === 'sit') {
        B.legL.rotation.x = B.legR.rotation.x = -1.35;
        if (s.outfit === 'bride' || s.outfit === 'dress') { B.legL.rotation.x = B.legR.rotation.x = -1.1; }
        B.armL.rotation.x = B.armR.rotation.x = -0.5; B.armL.rotation.z = 0.12; B.armR.rotation.z = -0.12;
        B.body.rotation.z = Math.sin(beat * PI) * 0.035;                       // покачиваются в такт
        if (s.eat) { const k = Math.pow(Math.max(0, Math.sin(t * 0.9 + ph)), 6); B.armL.rotation.x = -0.5 - 1.6 * k; B.armL.rotation.z = 0.12 + 0.5 * k; B.head.rotation.x = -0.15 * k; }
        if (a.id === 'wed_bride' || a.id === 'wed_groom') {
          const other = a.id === 'wed_bride' ? -1 : 1; B.head.rotation.y = Math.max(0, Math.sin(t * 0.37 + ph)) * 0.45 * other;
          if (st.congrats >= 0) { const k = Math.sin(clamp(st.congrats / 2.4, 0, 1) * PI); B.armL.rotation.z = 0.12 + 2.2 * k; B.armL.rotation.x = -0.3; B.armL.rotation.y = Math.sin(t * 12) * 0.35 * k; B.head.rotation.x = 0.25 * k; }
        }
        if (s.eat && st.beatClap) { const k = 0.5 + 0.5 * Math.sin(beat * TAU); B.armL.rotation.x = B.armR.rotation.x = -1.2; B.armL.rotation.y = -0.6 * k; B.armR.rotation.y = 0.6 * k; }
      } else if (a.role === 'zurna') {
        B.armL.rotation.x = B.armR.rotation.x = -1.25; B.armL.rotation.z = -0.35; B.armR.rotation.z = 0.35;
        B.head.rotation.x = 0.25 + Math.sin(beat * PI) * 0.06; B.head.scale.x = 1 + Math.max(0, Math.sin(beat * TAU)) * 0.06;   // щёки «дуют»
        B.body.rotation.z = Math.sin(beat * PI) * 0.06; B.root.position.y = (a.spec.y || 0) + Math.abs(Math.sin(beat * PI)) * 0.02;
        B.legL.rotation.x = Math.max(0, Math.sin(beat * PI)) * 0.3;
      } else if (a.role === 'drum') {
        const hitL = Math.pow(Math.max(0, Math.sin(beat * PI)), 3), hitR = Math.pow(Math.max(0, -Math.sin(beat * PI)), 3);
        B.armL.rotation.x = -1.0 - 0.7 * (1 - hitL); B.armR.rotation.x = -1.0 - 0.7 * (1 - hitR);
        B.armL.rotation.z = -0.25; B.armR.rotation.z = 0.25;
        B.body.rotation.x = 0.04 * (hitL + hitR); B.head.rotation.z = Math.sin(beat * PI * 0.5) * 0.08;
        B.root.position.y = (a.spec.y || 0) + Math.abs(Math.sin(beat * PI)) * 0.025;
      } else if (a.role === 'cook') {
        const k = Math.sin(t * 1.4 + ph); B.armL.rotation.x = -1.0 + k * 0.4; B.armR.rotation.x = -0.9 - k * 0.3; B.armL.rotation.z = -0.3; B.body.rotation.x = 0.12; B.head.rotation.x = 0.25;
      } else if (a.role === 'dance') {
        // круговой танец: шаг в сторону на каждый удар, подскок, руки — то в стороны, то одна вверх (у мужских — «орёл»)
        const male = s.outfit === 'vest', step = Math.sin(beat * PI), hop = Math.abs(step);
        B.root.position.y = (a.spec.y || 0) + hop * (male ? 0.07 : 0.035);
        B.legL.rotation.x = step * 0.5; B.legR.rotation.x = -step * 0.5;
        B.body.rotation.z = Math.sin(beat * PI) * 0.09; B.body.rotation.y = Math.sin(beat * PI * 0.5) * 0.25;
        const side = Math.floor(beat / 4 + a.idx) % 2 ? 1 : -1;
        if (male) { B.armL.rotation.z = side > 0 ? 2.5 : 1.45; B.armR.rotation.z = side > 0 ? -1.45 : -2.5; }
        else { B.armL.rotation.z = 1.25 + Math.sin(beat * PI * 0.5) * 0.25; B.armR.rotation.z = -1.25 + Math.sin(beat * PI * 0.5) * 0.25; B.armL.rotation.x = B.armR.rotation.x = -0.3; }
        B.head.rotation.z = -B.body.rotation.z * 0.6; B.head.rotation.y = -B.body.rotation.y * 0.5;
      } else if (a.role === 'kid' && a.ks && a.ks.mode === 'pose') {
        // «селфи» с ряженым: лапки перед мордочкой — держит воображаемый телефон
        B.armL.rotation.set(-2.1, 0, -0.35); B.armR.rotation.set(-2.1, 0, 0.35); B.head.rotation.x = -0.12; B.head.rotation.z = 0.12;
      } else if (a.role === 'kid' && a.ks && (a.ks.mode === 'flee' || a.ks.mode === 'cheer')) {
        // убегает с визгом / радуется: подскоки, лапки вверх
        const fl = a.ks.mode === 'flee', hop = Math.abs(Math.sin(t * (fl ? 9 : 7) + ph));
        B.root.position.y = (a.spec.y || 0) + hop * (fl ? 0.08 : 0.14);
        B.armL.rotation.z = 2.5 * (0.6 + 0.4 * hop); B.armR.rotation.z = -2.5 * (0.6 + 0.4 * hop);
        B.legL.rotation.x = Math.sin(t * (fl ? 14 : 6) + ph) * (fl ? 0.7 : 0.3); B.legR.rotation.x = -B.legL.rotation.x;
      } else if (a.role === 'kid') {
        const k = st.shower >= 0 ? 1 : 0.25, hop = Math.abs(Math.sin(t * (st.shower >= 0 ? 7 : 3) + ph));
        B.root.position.y = (a.spec.y || 0) + hop * 0.12 * k;
        B.armL.rotation.z = (st.shower >= 0 ? 2.6 : 0.4) * (0.6 + 0.4 * hop); B.armR.rotation.z = -(st.shower >= 0 ? 2.6 : 0.4) * (0.6 + 0.4 * hop);
        B.legL.rotation.x = Math.sin(t * 6 + ph) * 0.4 * k; B.legR.rotation.x = -B.legL.rotation.x;
      }
      lookUpd(a, dt);
      B.head.rotation.y += a.look;
    }
    /* ---------------------------------------------------------------------
       ПАЛЬТАРЫ: поза за кадр (направления плеча и предплечья — «мягкий IK» в осях груди), пружинки волос, бороды и плётки,
       выступления по очереди (хлопают в такт, пляшут «орла», «Бу-у!», звенят кольчугой, прыгают с поворотом, догоняют
       котёнка понарошку, щёлкают плёткой в воздух, шуточная борьба, фото с ребёнком, прятки, поклон, приветствие)
       --------------------------------------------------------------------- */
    const RP = rng(4242);
    const _qa = new T.Quaternion(), _qb = new T.Quaternion(), _va = new T.Vector3(), _vb = new T.Vector3(), _vc = new T.Vector3(), _vd = new T.Vector3(), _ve = new T.Vector3();
    const _NY = new T.Vector3(0, -1, 0), _X = new T.Vector3(1, 0, 0);
    // рука: up — от плеча к локтю, fo — от локтя к кисти, palm — куда смотрит ладонь (оси груди, x «наружу» уже со знаком стороны)
    function aimArm(B, s, A, sd) {
      const arm = B['arm' + s], fore = B['fore' + s], hand = B['hand' + s], fing = B['fing' + s];
      const up = _va.set(A.up[0], A.up[1], A.up[2]).normalize(), fo = _vb.set(A.fo[0], A.fo[1], A.fo[2]).normalize();
      _qa.setFromUnitVectors(_NY, up);
      _vc.copy(fo).addScaledVector(up, -fo.dot(up));
      if (_vc.lengthSq() < 1e-4) { _vc.set(0, 0, 1).addScaledVector(up, -up.z); if (_vc.lengthSq() < 1e-4) _vc.set(0, 1, 0); }
      _vc.normalize();
      _vd.set(0, 0, 1).applyQuaternion(_qa);
      const tw = Math.atan2(_ve.crossVectors(_vd, _vc).dot(up), _vd.dot(_vc));
      _qb.setFromAxisAngle(up, tw); arm.quaternion.multiplyQuaternions(_qb, _qa);
      fore.quaternion.setFromAxisAngle(_X, -Math.acos(clamp(up.dot(fo), -1, 1)));
      if (A.palm) {
        _qa.copy(arm.quaternion).multiply(fore.quaternion).invert();
        _vd.set(A.palm[0], A.palm[1], A.palm[2]).applyQuaternion(_qa);
        hand.rotation.set(0, sd > 0 ? Math.atan2(_vd.z, -_vd.x) : Math.atan2(-_vd.z, _vd.x), sd * (A.flex || 0));
      } else hand.rotation.set(0, 0, sd * (A.flex || 0));
      fing.rotation.set(0, 0, -sd * (A.curl || 0)); fing.scale.set(1, 1 + (A.spread || 0) * 0.08, 1 + (A.spread || 0) * 0.3);
    }
    // поза: рука стороны s (+1 левая, −1 правая); векторы — x «наружу», ладонь [−1,0,0] — «внутрь, к телу»
    const ARM0 = () => ({ up: [0, -1, 0], fo: [0, -1, 0], palm: [-1, 0, 0], curl: 0, spread: 0, flex: 0 });
    // flex — кисть отогнута к тыльной стороне (ладонь «вперёд» при руке к зрителю); palm тогда — куда смотрела бы ладонь до сгиба
    function arm(q, s, up, fo, palm, curl, spread, flex) {
      const A = s > 0 ? q.L : q.R;
      A.up[0] = up[0] * s; A.up[1] = up[1]; A.up[2] = up[2]; A.fo[0] = fo[0] * s; A.fo[1] = fo[1]; A.fo[2] = fo[2];
      if (palm) { A.palm = A.palm || [0, 0, 0]; A.palm[0] = palm[0] * s; A.palm[1] = palm[1]; A.palm[2] = palm[2]; } else A.palm = null;
      A.curl = curl || 0; A.spread = spread || 0; A.flex = flex || 0;
    }
    const mixV = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const smix = (a, b, k) => { const o = b.slice(); slerpV(a, o, k); return o; };
    // смесь двух положений руки: плечо и предплечье — по дуге (прямая между почти противоположными «вниз» и «вверх» шла через
    // «ноль»: рука до середины стояла, потом за 2 кадра перелетала вверх)
    function armMix(q, s, A1, A2, k) { arm(q, s, smix(A1[0], A2[0], k), smix(A1[1], A2[1], k), A1[2] && A2[2] ? mixV(A1[2], A2[2], k) : (k < 0.5 ? A1[2] : A2[2]), lerp(A1[3] || 0, A2[3] || 0, k), lerp(A1[4] || 0, A2[4] || 0, k)); }
    // готовые положения рук: [up, fo, palm, curl, spread]
    const AP = {
      hang: [[0.12, -1, 0.03], [0.1, -1, 0.15], [-1, 0, 0.3], 0.35, 0],
      chest: [[0.3, -0.5, 0.55], [-0.75, 0.55, 0.25], [-0.3, 0, -1], 0.5, 0],
      boo: [[0.95, 0.32, 0.5], [0.12, 1, 0.22], [0, 0, 1], 0, 1],
      up: [[0.42, 0.92, 0.05], [0.25, 1, 0.05], [0, 0, 1], 0, 0.6],
      guard: [[0.22, -0.45, 0.75], [-0.35, 0.92, 0.3], [-0.6, 0, 0.4], 1, 0],
      cross: [[0.32, -0.6, 0.55], [-1, 0.12, 0.2], [0, -1, 0], 0.6, 0],
      out: [[0.85, -0.5, 0.15], [0.9, -0.42, 0.15], [0, -1, 0.2], 0.2, 0.5],
      side: [[1, 0.06, 0.1], [1, 0.12, 0.18], [0, -0.3, 1], 0.1, 0.4],
      over: [[0.45, 0.9, 0.05], [-0.85, 0.5, 0.05], [0, -1, 0], 0.2, 0.3],
      hip: [[0.55, -0.75, -0.15], [-0.7, -0.15, 0.45], [-1, 0, 0], 1, 0],
      thumb: [[0.25, -0.35, 0.85], [0.05, 0.8, 0.6], [-1, 0, 0], 1, 0],
      back: [[0.3, -0.75, -0.6], [0.25, -0.9, -0.35], [0, -1, 0], 0.2, 0.3],
      face: [[0.3, 0.05, 0.92], [-0.58, 0.78, -0.12], [0, 0, -1], 0.3, 0],
    };
    const setArm = (q, s, k) => arm(q, s, k[0], k[1], k[2], k[3], k[4], k[5]);
    // рука стороны s — от того, где она в позе сейчас, к положению A2 (доля k)
    const armTo = (q, s, A2, k) => { const A = s > 0 ? q.L : q.R; armMix(q, s, [[A.up[0] * s, A.up[1], A.up[2]], [A.fo[0] * s, A.fo[1], A.fo[2]], A.palm ? [A.palm[0] * s, A.palm[1], A.palm[2]] : null, A.curl, A.spread], A2, k); };
    const leg = (q, s, sw, kn, ab) => { if (s > 0) { q.lx = sw; q.lk = kn; q.lz = ab || 0; } else { q.rx = sw; q.rk = kn; q.rz = ab || 0; } };
    function palReset(a) {
      const q = a.q || (a.q = { L: ARM0(), R: ARM0() });
      q.y = 0; q.drop = 0; q.lean = 0; q.twist = 0; q.side = 0; q.bx = 0; q.by = 0; q.bz = 0; q.sq = 1;
      q.hx = -0.04; q.hy = 0; q.hz = 0; q.lx = q.rx = q.lk = q.rk = q.lz = q.rz = 0; q.whip = 'hand'; q.lash = null; q.lashZ = null; q.hang = 0;
      setArm(q, 1, AP.hang); setArm(q, -1, AP.hang);
      return q;
    }
    // ходьба «важным шагом»: фаза — по пройденному пути (ноги не скользят)
    function gaitLegs(a, q, k, amp) {
      const ph = a.gph || 0, sw = Math.sin(ph) * (amp || 0.36) * k, ks = Math.max(0, Math.sin(ph + 1.9)), kr = Math.max(0, Math.sin(ph + 1.9 + PI));
      leg(q, 1, -sw, (0.08 + 0.75 * ks) * k); leg(q, -1, sw, (0.08 + 0.75 * kr) * k);
      return ph;
    }
    function gait(a, q, k, amp) {
      const ph = gaitLegs(a, q, k, amp);
      q.y = Math.abs(Math.cos(ph)) * 0.035 * k; q.twist = Math.sin(ph) * 0.09 * k; q.lean = -0.05 * k; q.hx = -0.07;
      const as = Math.sin(ph) * 0.5 * k;
      arm(q, 1, [0.16, -1, as], [0.12, -1, as + 0.4], [-1, 0, 0.3], 0.75); arm(q, -1, [0.16, -1, -as], [0.12, -1, -as + 0.4], [-1, 0, 0.3], 0.75);
    }
    // присесть на d метров (бедро и голень поровну)
    function crouch(q, d) { const al = Math.acos(clamp(1 - d, -1, 1)); q.drop += d; q.lx -= al; q.rx -= al; q.lk += 2 * al; q.rk += 2 * al; q.lean += al * 0.35; }
    // сидит на земле (упал понарошку)
    // таз опускается не ниже, чем позволяют ноги (бедро 0,47 + голень 0,53): сапоги не уходят в землю ни на одном кадре
    function sitPose(q, k) { q.lx = q.rx = -1.5 * k; q.lk = q.rk = 0.12 * k; q.lz = 0.12 * k; q.rz = 0.12 * k; q.drop += Math.min(0.82 * k, Math.max(0, 1 - 0.47 * Math.cos(q.lx) - 0.53 * Math.cos(q.lx + q.lk) - 0.01)); q.lean = -0.25 * k; armMix(q, 1, AP.hang, AP.back, k); armMix(q, -1, AP.hang, AP.back, k); }
    // (наклон и голова — от того, что было в позе: в начале и в конце поклона без скачка)
    function bowPose(q, k) { q.lean = lerp(q.lean, 0.85, k); q.hx = lerp(q.hx, 0.3, k); armMix(q, -1, AP.hang, AP.chest, k); armMix(q, 1, AP.hang, AP.out, k); }
    function palApply(a, dt) {
      const B = a.B, q = a.q;
      B.root.position.y = q.y - q.drop;
      B.body.rotation.set(q.bx, q.by, q.bz); B.body.scale.set(1, q.sq, 1);
      // голова поворачивается не больше чем на ±0,4 рад — остальное доворачивает грудь (маска с нагрудником не «рвётся»)
      const hy = q.hy + a.look, hyc = clamp(hy, -0.4, 0.4);
      B.chest.rotation.set(q.lean, q.twist + (hy - hyc) * 0.9, q.side);
      B.head.rotation.set(q.hx, hyc, q.hz);
      aimArm(B, 'L', q.L, 1); aimArm(B, 'R', q.R, -1);
      B.legL.rotation.set(q.lx, 0, q.lz); B.legR.rotation.set(q.rx, 0, -q.rz); B.shinL.rotation.set(q.lk, 0, 0); B.shinR.rotation.set(q.rk, 0, 0);
      // пружинки: разгон, подскок, поворот, наклон — пряди и борода отстают
      const sp = a.spr || (a.spr = { x: 0, vx: 0, z: 0, vz: 0, x2: 0, vx2: 0, z2: 0, vz2: 0, py: 0, vy: 0, pry: a.pry, v0: 0, wl: [0, 0, 0, 0, 0] });
      if (dt > 0) {
        const vy = (B.root.position.y - sp.py) / dt, ay = clamp((vy - sp.vy) / dt, -60, 60), sv = a.vel || 0, af = clamp((sv - sp.v0) / dt, -8, 8), tr = clamp(angW(a.pry - sp.pry) / dt, -6, 6);
        sp.py = B.root.position.y; sp.vy = vy; sp.v0 = sv; sp.pry = a.pry;
        const tx = clamp(-q.lean * 0.7 - af * 0.05 + ay * 0.006 + sv * 0.12, -0.9, 0.9), tz = clamp(-tr * 0.18 - q.side * 0.8, -0.7, 0.7);
        const st2 = Math.min(dt, 0.033);
        sp.vx += (40 * (tx - sp.x) - 6 * sp.vx) * st2; sp.x += sp.vx * st2; sp.vz += (40 * (tz - sp.z) - 6 * sp.vz) * st2; sp.z += sp.vz * st2;
        sp.vx2 += (28 * (sp.x - sp.x2) - 4 * sp.vx2) * st2; sp.x2 += sp.vx2 * st2; sp.vz2 += (28 * (sp.z - sp.z2) - 4 * sp.vz2) * st2; sp.z2 += sp.vz2 * st2;
      }
      if (B.hair0) B.hair0.rotation.set(sp.x * 0.8, 0, sp.z * 0.8);
      if (B.hair1) B.hair1.rotation.set(-Math.abs(sp.x2) * 0.08 - q.lean * 0.3, 0, sp.z2 * 0.12);
      // борода висит: голова запрокинута — борода не торчит вперёд доской (поворот головы по x почти снят), опущена — ложится на грудь
      if (B.beard) B.beard.rotation.set(clamp(-q.lean * 0.6 + sp.x * 0.4, -0.5, 0.15) - (q.hx < 0 ? 0.85 : 0.15) * q.hx, 0, sp.z * 0.4);
      // плётка: в руке (косичка висит вниз по миру и пружинит) или свёрнута на поясе
      if (B.whip0) {
        const inHand = q.whip === 'hand';
        B.whip0.scale.setScalar(inHand ? 1 : 1e-3); B.coil.scale.setScalar(inHand ? 1e-3 : 1);
        if (inHand) {
          // висит вниз по миру и пружинит (первое звено — поворот, обратный повороту рукояти в мире); в щелчке — поза косички из
          // номера, после щелчка (q.hang → 1) косичка плавно обвисает (не торчит вверх «удочкой»)
          const hang = q.lash ? clamp(q.hang || 0, 0, 1) : 1;
          if (hang > 0) { B.whip0.updateWorldMatrix(true, false); B.whip0.getWorldQuaternion(_qa).invert(); _qb.setFromEuler(_eu.set(sp.x * 0.6, 0, sp.z * 0.6)); _qa.multiply(_qb); }
          for (let i = 1; i <= 5; i++) {
            const hx = sp.x2 * 0.25, hz = sp.z2 * 0.2 + Math.sin(st.t * 3 + i) * 0.04, k = i > 1 ? hang : 0;
            if (q.lash) B['whip' + i].rotation.set(lerp(q.lash[i - 1], hx, k), 0, lerp(q.lashZ ? q.lashZ[i - 1] : 0, hz, k)); else B['whip' + i].rotation.set(hx, 0, hz);
          }
          if (hang > 0) B.whip1.quaternion.slerp(_qa, hang);
        }
      }
    }
    // ---- кто где: герой, дети, гости (оси двора) ----
    const HEROC = { x: 0, z: 0, ok: false, still: 0, lx: 0, lz: 0, vx: 0, vz: 0 };
    function heroUpdate(dt) {
      const hl = heroLocal(); HEROC.ok = !!hl && Math.abs(hl.x) < HW + 0.5 && Math.abs(hl.z) < HD + 0.5;
      if (!hl) return;
      const mv = Math.hypot(hl.x - HEROC.lx, hl.z - HEROC.lz);
      HEROC.still = mv < 0.3 * Math.max(dt, 0.016) ? HEROC.still + dt : 0;
      // скорость героини (сглаженная; скачок — телепорт, вход во двор — не скорость)
      if (dt > 1e-3 && mv < 0.5) { const k = Math.min(1, dt * 8); HEROC.vx += ((hl.x - HEROC.lx) / dt - HEROC.vx) * k; HEROC.vz += ((hl.z - HEROC.lz) / dt - HEROC.vz) * k; } else if (mv >= 0.5) { HEROC.vx = 0; HEROC.vz = 0; }
      HEROC.lx = HEROC.x = hl.x; HEROC.lz = HEROC.z = hl.z;
    }
    // куда отступать от героини: от неё, а если она идёт или бежит прямо на него — ещё и вбок, с её пути (бегущую прямо от неё не
    // обогнать — толкала его перед собой и догоняла); la — насколько раньше (м) начинать отступ при её скорости
    function heroAway(a, ex, ez, e) {
      let nx = ex / e, nz = ez / e, la = 0;
      const hv = Math.hypot(HEROC.vx, HEROC.vz);
      if (hv > 0.6) {
        const ux = HEROC.vx / hv, uz = HEROC.vz / hv, ah = nx * ux + nz * uz;
        if (ah > 0.2) {
          let px = -uz, pz = ux; const pn = px * nx + pz * nz; if (pn < 0 || (Math.abs(pn) < 0.05 && a.idx % 2)) { px = -px; pz = -pz; }
          const w = (ah - 0.2) * 1.8; nx += px * w; nz += pz * w; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
          la = Math.min(1.2, 0.35 * hv) * ah;
        }
      }
      return [nx, nz, la];
    }
    const dist2 = (a, x, z) => Math.hypot(x - a.px, z - a.pz);
    const facing = (a, x, z) => Math.abs(angW(Math.atan2(x - a.px, z - a.pz) - a.pry));
    // поворот к курсу goal: мягко (доля k·dt), но не быстрее YAWR рад/с — рослый ряженый не разворачивается на 40–60° за кадр
    const YAWR = 5;
    const steer = (a, goal, dt, k, lim) => { const r = (lim || YAWR) * dt; a.pry += clamp(angW(goal - a.pry) * Math.min(1, dt * k), -r, r); };
    const turnTo = (a, x, z, dt, k) => steer(a, Math.atan2(x - a.px, z - a.pz), dt, k || 6);
    // флажки над двором: сколько места над головой (м) в точке — для прыжков
    function headroom(x, z) {
      let h = 9;
      flagMeta.forEach(f => { if (!f || Math.abs(z - f.z) > 1.1) return; const tt = (x + HW + 0.6) / (A.w + 1.2); h = Math.min(h, f.h - Math.sin(clamp(tt, 0, 1) * PI) * 0.65 - 0.28); });
      return h;
    }
    // свободное место для плётки: в конусе ±60° на 2,5 м и вокруг на 2 м никого (гости, дети, танцоры, героиня, ряженые;
    // при замахе косичка уходит за спину — до 1,4 м от ряженого)
    function whipDir(a, pref) {
      const pts = animals.filter(b => b !== a && b.B).map(b => [b.B.root.position.x, b.B.root.position.z]);
      if (HEROC.ok) pts.push([HEROC.x, HEROC.z]);
      if (pts.some(p => Math.hypot(p[0] - a.px, p[1] - a.pz) < 2.0)) return null;
      for (const da of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, PI]) {
        const ang = (pref === undefined || pref === null ? a.pry : pref) + da, bx = a.px + Math.sin(ang) * 1.2, bz = a.pz + Math.cos(ang) * 1.2;
        if (Math.abs(bx) > HW - 0.3 || Math.abs(bz) > HD - 0.3) continue;
        if (!pts.some(p => { const d = Math.hypot(p[0] - a.px, p[1] - a.pz); return d < 2.5 && Math.abs(angW(Math.atan2(p[0] - a.px, p[1] - a.pz) - ang)) < PI / 3; })) return ang;
      }
      return null;
    }
    // перед каждым щелчком: героиня не ближе 3 м, вокруг никого ближе 2 м, в конусе ±60° на 2,5 м — никого
    // и детей ближе 3 м нет (с ребёнком рядом плётка — за поясом, номер — только поклон)
    function whipClear(a) {
      if (HEROC.ok && dist2(a, HEROC.x, HEROC.z) < 3) return false;
      if (kids.some(k => dist2(a, k.px, k.pz) < 3)) return false;
      return !animals.some(b => { if (b === a || !b.B) return false; const x = b.B.root.position.x, z = b.B.root.position.z, d = dist2(a, x, z); return d < 2.0 || (d < 2.5 && Math.abs(angW(Math.atan2(x - a.px, z - a.pz) - a.wdir)) < PI / 3); });
    }
    // ребёнок занят: в своём номере (бежит, позирует, радуется) или его уже выбрал другой ряженый (идёт к нему — режим ребёнка
    // ещё пуст): иначе двое берут одного, и догоняющий стоит в беге на месте
    const busyKid = k => (k.ks && k.ks.mode) || pal.some(b => b.kid === k && ['chase', 'selfie', 'peek'].includes(b.mode));
    const freeKid = (a, r) => kids.filter(k => !busyKid(k) && st.shower < 0 && dist2(a, k.px, k.pz) < r).sort((p, q) => dist2(a, p.px, p.pz) - dist2(a, q.px, q.pz))[0];
    // свободное место вне круга танца и не у столов
    // точка у круга танца снаружи на угле ang (0 — к воротам): не у ворот (место «В круг» и камера) и не у помоста (дети)
    // и не ближе 1,6 м к героине (руки «орла» и хлопки — не сквозь неё), не ближе 1,3 м к другим ряженым и их местам: угол
    // сдвигается на ±0,5 рад, пока место не свободно
    function ringSpot(ang, r, a) {
      const lim = an => { an = angW(an); if (Math.abs(an) < 0.62) an = an < 0 ? -0.62 : 0.62; if (Math.abs(an) > PI - 0.75) an = an < 0 ? -(PI - 0.75) : PI - 0.75; return an; };
      const busyAt = p => pal.some(b => b !== a && (Math.hypot(b.px - p[0], b.pz - p[1]) < 1.3 || (b.goal && b.phase === 'go' && Math.hypot(b.goal[0] - p[0], b.goal[1] - p[1]) < 1.3)));
      let best = null;
      for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0]) {
        const an = lim(ang + da), p = freeSpot(RC[0] + Math.sin(an) * r, RC[1] + Math.cos(an) * r, true);
        if ((!HEROC.ok || Math.hypot(p[0] - HEROC.x, p[1] - HEROC.z) >= 1.6) && !busyAt(p)) return p;
        if (!best) best = p;
      }
      return freeSpot(best[0], best[1]);
    }
    function freeSpot(x, z, noHero) {
      // от героини — не ближе 1,6 м (отодвигаем точку от неё)
      if (!noHero && HEROC.ok) { const hx = x - HEROC.x, hz = z - HEROC.z, hd = Math.hypot(hx, hz); if (hd < 1.6) { const k = hd > 1e-3 ? 1.6 / hd : 0; x = HEROC.x + (k ? hx * k : 1.6); z = HEROC.z + (k ? hz * k : 0); } }
      let dx = x - RC[0], dz = z - RC[1], d = Math.hypot(dx, dz) || 1;
      if (d < R0 + 1.0) { x = RC[0] + dx / d * (R0 + 1.0); z = RC[1] + dz / d * (R0 + 1.0); }
      return [clamp(x, -tableX + 1.9, tableX - 1.9), clamp(z, -HD + 2.4, HD - 1.2)];
    }
    // героиня в разговоре (окно диалога с кем угодно из двора или занята игрой — st.busyFn от региона): возгласы молчат,
    // розыгрыш ждёт
    const heroTalking = () => npcs.some(n => n.faceHero > 3) || !!(st.busyFn && st.busyFn());
    const say = (a, key) => { if (heroTalking() || (a.npc && a.npc.faceHero > 3)) return; const l = pick(EV.palSay[key], named); if (l) emit('say', { who: a.id, text: l.text }); };
    // руки крадущегося в догонялках: вперёд и вверх, пальцы растопырены
    const CREEP = [[0.55, 0.4, 0.6], [0.1, 1, 0.35], [0, 0, 1], 0, 1];
    // плётка: сколько секунд достают с пояса (и убирают обратно) и где кисть в этот миг — у свёрнутой плётки на правом бедре
    const WD = 0.35, WDRAW = [[0.42, -0.85, 0.3], [0.08, -0.72, 0.68], [-1, 0, 0], 1, 0];
    // ---- выступления ----
    const ACTS = {
      // важный шаг по маршруту (мимо круга, столов и музыкантов) — один отрезок
      walk: { go: a => a.path[a.seg], dur: () => 0, done(a) { a.seg = (a.seg + 1) % a.path.length; } },
      // хлопают в такт на краю круга
      clap: {
        go(a) { return ringSpot(Math.atan2(a.px - RC[0], a.pz - RC[1]), R0 + 1.05, a); },
        dur: () => 4 + RP() * 3, face: () => RC,
        pose(a, q, t, beat) {
          const k = Math.pow(0.5 + 0.5 * Math.cos(beat * TAU), 3), w = 0.08 + 0.42 * (1 - k);
          arm(q, 1, [0.18, -0.5, 0.82], [-w, 0.25, 0.85], [-1, 0, 0], 0.05); arm(q, -1, [0.18, -0.5, 0.82], [-w, 0.25, 0.85], [-1, 0, 0], 0.05);
          crouch(q, 0.025 * k); q.hx = -0.05 + 0.08 * Math.max(0, Math.sin(beat * TAU + PI));
          if (Math.floor(beat) % 16 === 0 && Math.floor(beat) !== a.heyB) { a.heyB = Math.floor(beat); say(a, 'hey'); }
        },
      },
      // круговой танец «орёл»: шаг-подскок, одна рука в сторону, другая над головой, каждые 8 ударов — поворот
      // пляшет у самого круга снаружи, лицом к нему (сквозь вращающийся круг танцоров не ходит); второй — рядом, дуэтом
      dance: {
        go(a) {
          const o = pal.find(b => b !== a && b.mode === 'dance' && dist2(a, b.px, b.pz) < 4.5);
          // дуэт — в 1,7 м по дуге от напарника (от того места, где он пляшет; ближе — отталкиваются и топчутся)
          return ringSpot(o ? Math.atan2(o.px - RC[0], o.pz - RC[1]) + 1.7 / (R0 + 1.2) : Math.atan2(a.px - RC[0], a.pz - RC[1]), R0 + 1.2, a);
        },
        dur: () => (8 + Math.floor(RP() * 3) * 4) * BEAT, face: a => (a.spin || Math.floor(st.t / BEAT) % 8 === 6 ? null : RC),
        end(a) { a.spin = false; a.spinB = undefined; },
        pose(a, q, t, beat) {
          const bi = Math.floor(beat), f = beat - bi, sdL = bi % 2 ? 1 : -1, hop = Math.sin(f * PI);
          // на ударе обе ноги одинаково чуть согнуты — смена ноги без скачка ступней
          leg(q, sdL, 0.05 - 0.7 * hop, 0.1 + 1.1 * hop); leg(q, -sdL, 0.05, 0.1);
          q.y = 0.06 * hop; q.lean = -0.08; q.hx = -0.15;
          const sw = Math.floor(beat / 4) % 2 ? 1 : -1, blend = sst(0, 0.34 / BEAT, beat % 4);
          armMix(q, sw, AP.over, AP.side, Math.floor(beat / 4) > 0 ? 1 - blend : 1); armMix(q, -sw, AP.side, AP.over, Math.floor(beat / 4) > 0 ? 1 - blend : 1);
          // каждые 8 ударов — полный оборот за два удара (лицом к кругу его не тянет, пока крутится: раньше поворот спорил с
          // разворотом к кругу и выходило только «туда-обратно» на четверть оборота)
          if (bi % 8 === 6 && a.spinB !== bi) { a.spinB = bi; a.spinA = 0; }
          a.spin = a.spinB !== undefined && bi - a.spinB < 2 && a.spinA < TAU;
          if (a.spin) { const dd = Math.min(TAU - a.spinA, TAU / (2 * BEAT) * (a.dtLast || 0)); a.pry += dd; a.spinA += dd; }
          q.twist = Math.sin(beat * PI) * 0.1;
        },
      },
      // «Бу-у!»: руки в стороны и вверх, пальцы растопырены, потом смеётся; цель — героиня, ребёнок или гость впереди
      boo: {
        dur: () => 2.2,
        start(a) { a.cool.boo = st.t + 12; st.booT = st.t + 25; },
        face: a => a.tgt,
        pose(a, q, t) {
          if (t < 0.35) { const k = sst(0, 0.3, t); armMix(q, 1, AP.hang, AP.chest, k); armMix(q, -1, AP.hang, AP.chest, k); crouch(q, 0.07 * k); q.hx = 0.18 * k; }
          else if (t < 1.25) {
            const k = sst(0.35, 0.5, t), wg = t > 0.55 ? Math.sin(t * 9 * TAU) * 0.06 : 0;
            armMix(q, 1, AP.chest, AP.boo, k); armMix(q, -1, AP.chest, AP.boo, k); q.L.fo[0] += wg; q.R.fo[0] -= wg;
            q.y = 0.05 * k * (1 - sst(0.9, 1.25, t)); q.hz = 0.22 * k; q.lean = -0.1 * k;
            // присед и кивок из подготовки уходят плавно (обрывались за кадр — корпус подскакивал на 7 см)
            crouch(q, 0.07 * (1 - k)); q.hx = 0.18 * (1 - k);
            if (t > 0.45 && !a.saidBoo) { a.saidBoo = true; say(a, 'boo'); }
          } else {
            const u = t - 1.25, hop = Math.abs(Math.sin(u / 0.3 * PI));
            q.y = 0.06 * hop * (1 - sst(0.75, 0.95, u)); q.side = Math.sin(u * 12 * TAU / 2) * 0.06; q.hx = -0.15;
            arm(q, 1, [0.35, -0.75, 0.45], [-0.55, -0.2, 0.75], [-1, 0, 0], 0.6); arm(q, -1, [0.35, -0.75, 0.45], [-0.55, -0.2, 0.75], [-1, 0, 0], 0.6);
          }
        },
        // смех после «Бу-у!» — своя поза (перетекает из растопыренных рук)
        sub: (a, t) => (t < 1.25 ? 0 : 1),
        tick(a, dt, t) { if (t > 1.3 && t < 1.9 && a.tgt) { const d = dist2(a, a.tgt[0], a.tgt[1]); if (d < 1.35) { const dx = a.px - a.tgt[0], dz = a.pz - a.tgt[1]; a.px += dx / d * 0.25 * dt; a.pz += dz / d * 0.25 * dt; } } },
        end(a) { a.saidBoo = false; },
      },
      // «Звяк-звяк!» — трясёт плечами, кольчуга звенит
      jingle: {
        dur: () => 1.4, start(a) { emit('jingle', { who: a.id }); emit('bell', { who: a.id }); },
        pose(a, q, t) { setArm(q, 1, AP.out); setArm(q, -1, AP.out); q.side = Math.sin(t * 12 * TAU / 2) * 0.12; q.twist = Math.sin(t * 6 * TAU / 2) * 0.08; crouch(q, 0.03 * Math.abs(Math.sin(t * 8))); q.hz = -q.side * 0.6; },
      },
      // высокий прыжок с поворотом (не выше флажков)
      jump: {
        dur: () => 1.25, start(a) { a.jh = clamp(headroom(a.px, a.pz) - 2.47, 0, 0.3); },
        pose(a, q, t) {
          if (t < 0.75) {
            // присел, руки назад → толчок: ноги поджаты, руки вверх — всё за 0,1–0,15 с, без скачка позы за кадр
            const cr = sst(0, 0.2, t) * (1 - sst(0.2, 0.32, t)), u = clamp((t - 0.25) / 0.5, 0, 1), tk = sst(0.25, 0.36, t) * (1 - sst(0.64, 0.75, t)), up = sst(0.06, 0.42, t);
            crouch(q, 0.12 * cr); q.y = (a.jh || 0) * 4 * u * (1 - u) + 0.02 * sst(0.25, 0.3, t) * (1 - sst(0.7, 0.75, t));
            q.lx -= 0.55 * tk; q.rx -= 0.55 * tk; q.lk += tk; q.rk += tk;
            armMix(q, 1, AP.hang, AP.up, up); armMix(q, -1, AP.hang, AP.up, up); q.L.up[2] -= 0.4 * (1 - up); q.R.up[2] -= 0.4 * (1 - up);
          } else { const u = t - 0.75; q.sq = 1 - 0.08 * sst(0, 0.04, u) * Math.max(0, 1 - u / 0.12); crouch(q, 0.08 * sst(0, 0.05, u) * Math.max(0, 1 - u / 0.3)); armMix(q, 1, AP.up, AP.out, sst(0, 0.3, u)); armMix(q, -1, AP.up, AP.out, sst(0, 0.3, u)); if (!a.landed) { a.landed = true; emit('jingle', { who: a.id }); } }
        },
        tick(a, dt, t) { if (t > 0.25 && t < 0.75) a.pry += TAU / 0.5 * dt; },
        end(a) { a.landed = false; },
      },
      // стоит на страже: руки скрещены, поглядывает; в конце — прыжок-поворот с распахнутыми руками и смех
      guard: {
        dur: () => 4.5 + RP() * 2, face: () => RC,
        // в конце — прыжок-поворот: голова, только что глядевшая по сторонам, поворачивается вперёд плавно
        sub: (a, t) => (t < a.actDur - 1.3 ? 0 : 1),
        pose(a, q, t) {
          const T2 = a.actDur - 1.3;
          if (t < T2) { setArm(q, 1, AP.cross); setArm(q, -1, AP.cross); q.L.up[2] += 0.05; leg(q, 1, 0, 0, 0.1); leg(q, -1, 0, 0, 0.1); q.hy = Math.sin(t * 0.9) * 0.55; q.lean = -0.06; q.side = Math.sin(t * 1.6) * 0.06; q.y = Math.abs(Math.sin(t * 1.8)) * 0.015; }
          else { const u = t - T2, k = sst(0, 0.2, u); q.y = Math.sin(clamp(u / 0.4, 0, 1) * PI) * 0.12; armMix(q, 1, AP.cross, AP.boo, k); armMix(q, -1, AP.cross, AP.boo, k); q.hz = 0.2 * k; if (u > 0.5) q.side = Math.sin(u * 30) * 0.05; }
        },
      },
      // догонялки с котёнком понарошку: крадётся на цыпочках, ребёнок с визгом убегает по кругу, ряженый «спотыкается» и садится
      chase: {
        // встаёт по другую сторону от кружка догонялок: ребёнок убегает от ряженого к своему кружку, а не на него
        go(a) { const k = a.kid; if (!k) return null; const lx = k.px - k.loopC[0], lz = k.pz - k.loopC[1], d = Math.hypot(lx, lz) || 1; return freeSpot(k.px + lx / d * 1.6, k.pz + lz / d * 1.6); },
        dur: () => 10.7, face: a => (a.kid ? [a.kid.px, a.kid.pz] : null),
        start(a) { st.chaseT = st.t + 40; },
        // этапы (на цыпочках, бег, «спотыкается» и садится) перетекают один в другой; садится — после перетекания, за 0,5 с (не
        // падает на 0,8 м за треть секунды); сидит и встаёт — одна поза без смены этапа (без двойного разгона таза)
        sub: (a, t) => (t < 1.5 ? 0 : t < 7.8 ? 1 : 2),
        tick(a, dt, t) {
          const k = a.kid; if (!k) return true;
          if (t > 1.5 && t < 8 && !k.ks.mode) { k.ks.mode = 'flee'; k.ks.t = 0; k.ks.c = k.loopC; k.ks.ang = Math.atan2(k.px - k.loopC[0], k.pz - k.loopC[1]); if (!heroTalking()) emit('say', { who: k.id, text: pick(EV.palSay.squeal, named).text }); }
          // ребёнок не убегает (его перехватили для фото или он уже набегался) — догонялки кончаются, а не стоят в беге на месте
          if (t > 1.5 && t < 7.8 && k.ks.mode !== 'flee') return true;
          if (t > 1.5 && t < 7.8 && k.ks.mode === 'flee') {
            // бежит по кругу пошире, чем у ребёнка, отставая на четверть круга: не наступает ему на пятки и не догоняет
            const RR = k.loopR + 0.95, an = k.ks.ang - 1.2, sp = freeSpotNear(k.loopC[0] + Math.sin(an) * RR, k.loopC[1] + Math.cos(an) * RR);
            walkTo(a, sp[0], sp[1], dt, 1.25);
            // срезая круг (или у края двора), всё равно не ближе 0,8 м к ребёнку
            const ex = a.px - k.px, ez = a.pz - k.pz, e = Math.hypot(ex, ez); if (e < 0.8 && e > 1e-3) { const mv = Math.min(0.8 - e, 1.5 * dt); a.px += ex / e * mv; a.pz += ez / e * mv; }
            // и не ближе 1,15 м к героине: руки «крадётся» тянутся вперёд на 0,75 м — не касаются её
            if (HEROC.ok) { const hx = a.px - HEROC.x, hz = a.pz - HEROC.z, h = Math.hypot(hx, hz); if (h < 1.15 && h > 1e-3) { const mv = Math.min(1.15 - h, 1.5 * dt); a.px += hx / h * mv; a.pz += hz / h * mv; a.gph = (a.gph || 0) + mv / 1.15 * TAU; } }
          }
          if (t >= 7.8 && k.ks.mode === 'flee') { k.ks.mode = 'cheer'; k.ks.t = 0; }
          // героиня рядом, когда пора «спотыкаться», — не садится (она прошла бы сквозь сидящего): сразу поклон стоя
          const hd = HEROC.ok ? dist2(a, HEROC.x, HEROC.z) : 9;
          if (t >= 7.8 && t < 7.9 && hd < 1.8) { a.at = 9.85; a.sat = true; return false; }
          // сидит, а героиня идёт к нему — встаёт (подъём и поклон из номера, а не прыжком за кадр) и, поднимаясь, отходит от неё
          if (t > 8.35 && t < 9.3 && hd < 1.4) a.at = 9.3;
          if (t > 8.25 && !a.sat) { a.sat = true; emit('jingle', { who: a.id }); sparks(a.px, 2.2, a.pz, 6, '#F2C94C', 0.5); }
          return false;
        },
        pose(a, q, t) {
          if (t < 1.5) { const ph = t * PI; leg(q, 1, -0.7 * Math.max(0, Math.sin(ph)), 1.3 * Math.max(0, Math.sin(ph))); leg(q, -1, -0.7 * Math.max(0, -Math.sin(ph)), 1.3 * Math.max(0, -Math.sin(ph))); arm(q, 1, [0.5, 0.45, 0.65], [0.1, 1, 0.3], [0, 0, 1], 0, 0.5 + 0.5 * Math.sin(t * 20)); arm(q, -1, [0.5, 0.45, 0.65], [0.1, 1, 0.3], [0, 0, 1], 0, 0.5 + 0.5 * Math.cos(t * 20)); q.lean = 0.2; crouch(q, 0.06); }
          else if (t < 7.8) { gait(a, q, 1, 0.5); setArm(q, 1, CREEP); setArm(q, -1, CREEP); q.lean = 0.12; }
          else if (t < 9.3) { const k = sst(7.85, 8.35, t); sitPose(q, k); armMix(q, 1, CREEP, AP.back, k); armMix(q, -1, CREEP, AP.back, k); }
          else { const u = t - 9.3; sitPose(q, 1 - sst(0, 0.55, u)); if (u > 0.55) bowPose(q, bell((u - 0.55) / 0.8)); }
        },
        end(a) { a.sat = false; if (a.kid && a.kid.ks.mode === 'flee') a.kid.ks.mode = null; a.kid = null; },
      },
      // щелчок плёткой в воздух (D, E): только в пустую сторону, высоко и от людей; дважды, потом «лассо» над головой и поклон
      whip: {
        // выходит на свободное место у ворот и щёлкает в сторону ворот — от людей; если кто-то оказался рядом — только кланяется
        go(a) {
          const w = whipPlace(a) || (() => { const sp = WHIPSPOTS.slice().sort((p, q) => dist2(a, p[0], p[1]) - dist2(a, q[0], q[1]))[0]; return { p: sp, wdir: Math.atan2(sp[0] - RC[0], sp[1] - RC[1]) }; })();
          a.wdir = w.wdir; return w.here ? null : w.p;
        },
        dur: () => 3.0 + 2 * WD, start(a) { a.cool.whip = st.t + 15; const d = whipDir(a, a.wdir); if (d === null) { a.actDur = 1.3; a.noCrack = true; } else { a.wdir = d; a.noCrack = !whipClear(a); if (a.noCrack) a.actDur = 1.3; } },
        face: a => [a.px + Math.sin(a.wdir) * 3, a.pz + Math.cos(a.wdir) * 3],
        // кто-то подошёл посреди номера — без щелчка, поклон (перетекает из замаха)
        sub: a => (a.noCrack ? 1 : 0),
        tick(a, dt, t) { if (!a.noCrack && t < 2.3 + WD && !whipClear(a)) { a.noCrack = true; a.at = 0; a.actDur = 1.3; } return false; },
        pose(a, q, t0) {
          // рука после щелчка опускается (между щелчками и перед поклоном — плётка висит из опущенной руки)
          const LOW = [[0.3, -0.2, 0.6], [0.1, -0.5, 0.8]];
          const crack = (u, T, A0) => {
            // u: 0..1 (фаза длиной T с) — замах за голову → бросок вперёд-вверх → волна по косичке → рука вниз
            // (направления — по дуге: прямая между замахом и броском шла через «ноль» — кисть прыгала на метр за кадр)
            const wind = sst(0, 0.35, u) * (1 - sst(0.36, 0.52, u)), snap = sst(0.34, 0.52, u), lw = sst(0.62, 0.9, u);
            arm(q, -1, smix(smix(smix(A0[0], [0.35, 0.85, -0.45], wind), [0.25, 0.55, 0.8], snap), LOW[0], lw), smix(smix(smix(A0[1], [0.1, 0.5, -0.85], wind), [0.05, 0.2, 1], snap), LOW[1], lw), [-1, 0, 0], 1);
            // к концу щелчка корпус возвращается прямо: следующий щелчок и поклон начинаются из той же позы (без рывка корпуса)
            const ez = 1 - sst(0.75, 1, u); q.twist = (0.3 * wind - 0.25 * snap) * ez; q.lean = (-0.12 * wind + 0.12 * snap) * ez;
            // волна: каждое звено догоняет предыдущее через 0,035 с — петля бежит к кончику и там «щёлкает»; косичка всегда изогнута
            // (не палка), после щелчка провисает
            const L = [], LZ = [], ts = 0.5 * T;
            for (let i = 0; i < 5; i++) {
              const tau = u * T - 0.035 * i, k = sst(ts - 0.02, ts + 0.08, tau), loop = Math.sin(PI * clamp((tau - ts) / 0.14, 0, 1)), settle = tau > ts + 0.14 ? Math.exp(-(tau - ts - 0.14) * 5) : 1;
              let th = lerp(0.18, lerp(0.25, -0.05, k) - 0.55 * loop, settle);
              if (!i) th += lerp(-1.2 + 2.0 * wind, -1.1, snap);
              L.push(th); LZ.push(0.08 + 0.04 * i * (1 - k));
            }
            q.lash = L; q.lashZ = LZ;
            // обвисает после щелчка; в начале замаха (u ≈ 0) ещё висит — без рывка из прежней позы
            q.hang = Math.max(sst(ts + 0.12, ts + 0.45, u * T), 1 - sst(0, 0.22, u));
          };
          setArm(q, 1, AP.hip);
          if (a.noCrack) { bowPose(q, Math.sin(clamp(t0 / 1.2, 0, 1) * PI)); q.whip = 'tuck'; return; }
          // достаёт плётку с пояса (рука к бедру — там свёрнутая плётка) и в конце убирает её обратно
          const t = t0 - WD;
          if (t < 0) { armMix(q, -1, AP.hang, WDRAW, sst(0, WD * 0.85, t0)); q.whip = 'tuck'; return; }
          if (t > 3.0) { armMix(q, -1, AP.hang, WDRAW, bell((t - 3.0) / WD)); q.whip = t - 3.0 > WD * 0.5 ? 'tuck' : 'hand'; q.lash = null; return; }
          if (t < 1.25) crack(t / 1.25, 1.25, WDRAW);
          else if (t < 2.4) crack((t - 1.25) / 1.15, 1.15, LOW);
          else {
            const u = t - 2.4, k = bell(u / 0.6); bowPose(q, k);
            // свободная левая рука — из «руки в бок» в поклон и обратно в бок (прыгала с бедра вниз на 0,4 м за кадр)
            armMix(q, 1, AP.hip, AP.out, k);
            // рука с плёткой — из опущенного положения в поклон (без рывка); косичка висит
            const R1 = q.R, cur = [[-R1.up[0], R1.up[1], R1.up[2]], [-R1.fo[0], R1.fo[1], R1.fo[2]], R1.palm ? [-R1.palm[0], R1.palm[1], R1.palm[2]] : null, R1.curl, R1.spread];
            armMix(q, -1, [LOW[0], LOW[1], [-1, 0, 0], 1, 0], cur, sst(0, 0.3, u)); q.lash = null;
          }
          const cr = t < 1.25 ? t / 1.25 : (t - 1.25) / 1.15;
          if (t < 2.4 && cr > 0.62 && cr < 0.7 && !a.cracked && !a.noCrack) { a.cracked = true; emit('crack', { who: a.id }); const tip = a.B.whip5.getWorldPosition(_vd); sparks(tip.x, tip.y, tip.z, 7, '#FFFFFF', 0.45, true); }
          if (cr < 0.3) a.cracked = false;
        },
      },
      // шуточная борьба двух ряженых: круги, «грудью» — отскок со звоном, мимо-махи, один падает, победитель поднимает, оба кланяются
      fight: {
        go(a) { const F = a.fight; if (!F) return null; return [F.M[0] + Math.sin(F.ang + a.fside * PI) * 0.75, F.M[1] + Math.cos(F.ang + a.fside * PI) * 0.75]; },
        dur: () => 8.8, face: a => (a.fight ? a.fight.M : null),
        // этапы борьбы (стойка, «грудью», махи, падение, подъём, поклон) — позы перетекают одна в другую
        sub: a => { const ft = a.fight ? a.fight.t || 0 : 0; return ft < 2.6 ? 0 : ft < 3.0 ? 1 : ft < 5.0 ? 2 : ft < 6.4 ? 3 : ft < 7.6 ? 4 : 5; },
        tick(a, dt, t) {
          const F = a.fight, o = F && (F.a0 === a ? F.a1 : F.a0); if (!F || !o || o.mode !== 'fight' || o.fight !== F) return true;
          // героиня подошла в самый круг борьбы — заканчивают
          if (HEROC.ok && Math.hypot(HEROC.x - F.M[0], HEROC.z - F.M[1]) < 1.3) return true;
          if (a.fside === 0) F.t = t;
          const ft = F.t, ang = F.ang + (ft < 2 ? ft * 0.8 : 1.6), r = ft < 2 ? 0.7 : ft < 2.6 ? lerp(0.7, 0.24, sst(2, 2.6, ft)) : ft < 3.0 ? lerp(0.24, 0.42, sst(2.6, 3, ft)) : ft < 6.4 ? 0.42 : 0.42;
          // в круг борьбы входит шагом в обход (не прыжком через полдвора и не сквозь героиню); за 3 с не вошёл — борьбы нет
          const tx = F.M[0] + Math.sin(ang + a.fside * PI) * r, tz = F.M[1] + Math.cos(ang + a.fside * PI) * r;
          let walked = false;
          if (a.fightIn) { a.px = tx; a.pz = tz; } else {
            // последние 0,3 м — прямо к точке (место в круге само движется), без рывка в конце
            const ex = tx - a.px, ez = tz - a.pz, e = Math.hypot(ex, ez), mv = 1.8 * dt;
            if (e <= mv) { a.px = tx; a.pz = tz; a.fightIn = true; }
            else if (e < 0.3) { a.px += ex / e * mv; a.pz += ez / e * mv; a.gph = (a.gph || 0) + mv / 1.15 * TAU; }
            else { walkTo(a, tx, tz, dt, 1.5, [o]); walked = true; if (t > 3) return true; }
          }
          // лицом к середине круга — когда уже не идёт в обход (шаг сам поворачивает его по пути; оба поворота в один кадр — 12 рад/с)
          if (!walked) steer(a, Math.atan2(F.M[0] - a.px, F.M[1] - a.pz), dt, 12, 7);
          if (ft > 2.6 && !F.bump) { F.bump = true; emit('jingle', { who: a.id }); sparks(F.M[0], 1.5, F.M[1], 8, '#E8DCCB', 0.6); }
          if (ft > 5.0 && !F.fall && a === F.loser) { F.fall = true; sparks(a.px, 1.0, a.pz, 6, '#F2C94C', 0.5); if (!heroTalking()) emit('say', { who: F.winner.id, text: pick(EV.palSay.win, named).text }); }
          return false;
        },
        pose(a, q, t) {
          const F = a.fight; if (!F) return; const ft = F.t || 0, me = a === F.loser;
          // пружинит в стойке по общим часам (со сдвигом у второго): напарник ещё идёт — не застывает, пришёл — без скачка фазы
          const bt = st.t + a.fside * 0.3;
          if (ft < 2.6) { setArm(q, 1, AP.guard); setArm(q, -1, AP.guard); q.y = Math.abs(Math.sin(bt * 5)) * 0.05; leg(q, 1, Math.sin(bt * 5) * 0.2, 0.3); leg(q, -1, -Math.sin(bt * 5) * 0.2, 0.3); q.lean = ft > 2 ? -0.15 : 0.08; }
          else if (ft < 3.0) { setArm(q, 1, AP.out); setArm(q, -1, AP.out); q.lean = -0.25 + 0.2 * sst(2.6, 3, ft); }
          else if (ft < 5.0) {
            const u = (ft - 3.0 + (a.fside ? 0.5 : 0)) % 1.0, s = Math.floor((ft - 3 + (a.fside ? 0.5 : 0)) / 1.0) % 2 ? 1 : -1;
            setArm(q, -s, AP.guard);
            // мах — за четверть секунды (за 0,15 с кулак пролетал полметра за кадр)
            const w = sst(0, 0.45, u) * (1 - sst(0.45, 0.7, u)), hit = sst(0.45, 0.7, u) * (1 - sst(0.76, 1, u));
            arm(q, s, smix(smix(AP.guard[0], [0.6, 0.3, -0.3], w), [0.6, 0.1, 0.8], hit), smix(smix(AP.guard[1], [0.2, 0.8, -0.5], w), [0.9, 0.1, 0.4], hit), null, 1);
            q.twist = s * (0.3 * w - 0.4 * hit); crouch(q, 0.05);
          } else if (ft < 6.4) {
            // проигравший садится после перетекания из махов, за полсекунды (не падает на 0,8 м за треть секунды)
            if (me) sitPose(q, sst(5.1, 5.6, ft)); else { setArm(q, 1, AP.up); setArm(q, -1, AP.up); q.y = Math.abs(Math.sin(ft * 7)) * 0.08; }
          } else if (ft < 7.6) {
            if (me) { sitPose(q, 1 - sst(6.9, 7.5, ft)); arm(q, 1, [0.1, 0.1, 1], [0.1, 0.2, 1], [0, 0, -1], 0.8); }
            else { arm(q, 1, [0.1, -0.45, 0.9], [0.1, -0.55, 0.8], [0, 0, 1], 0.8); q.lean = 0.35 * (1 - sst(7.0, 7.5, ft)); }
          } else bowPose(q, Math.sin(clamp((ft - 7.6) / 1.2, 0, 1) * PI));
        },
        end(a) { a.fight = null; a.fightIn = false; },
      },
      // фото на память с ребёнком (или с героиней): встаёт рядом, наклоняется, «класс!», вспышка
      selfie: {
        go(a) {
          const k = a.kid;
          if (k) return outRing(freeSpotNear(k.px + Math.cos(a.sfFace) * 0.62, k.pz - Math.sin(a.sfFace) * 0.62));
          if (a.withHero && HEROC.ok) return [HEROC.x + a.sfSide[0] * 0.78, HEROC.z + a.sfSide[1] * 0.78];
          return null;
        },
        dur: () => 3.4, face: a => [a.px + Math.sin(a.sfFace) * 3, a.pz + Math.cos(a.sfFace) * 3],
        start(a) {
          // ребёнок уже занят (убегает в догонялках, радуется) — фото не будет, режим ребёнка не перебиваем
          if (a.kid && a.kid.ks.mode) { a.kid = null; a.actDur = 0; return; }
          st.selfieT = st.t + 25; if (a.kid) { a.kid.ks.mode = 'pose'; a.kid.ks.t = 0; a.kid.ks.face = a.sfFace; } say(a, 'smile');
        },
        tick(a, dt, t) { if (t > 2.0 && !a.flashed) { a.flashed = true; emit('flash', { who: a.id }); const k = a.kid; if (k) sparks(k.B.root.position.x + Math.sin(a.sfFace) * 0.3, 1.0, k.B.root.position.z + Math.cos(a.sfFace) * 0.3, 8, '#FFFFFF', 0.35, true); else sparks(a.px + Math.sin(a.sfFace) * 0.6, 2.1, a.pz + Math.cos(a.sfFace) * 0.6, 8, '#FFFFFF', 0.35, true); } return false; },
        pose(a, q, t) {
          const k = sst(0, 0.5, t) * (1 - sst(2.7, 3.2, t)), ts = a.sfTilt || 1;
          q.lean = 0.42 * k * (a.kid ? 1 : 0.4); q.side = (0.17 * ts + Math.sin(t * 2.6) * 0.05) * k; q.hz = 0.2 * k * ts; q.hx = 0.1 * k;
          // ближняя к ребёнку рука (правая, если он справа) — над его плечом, не касаясь; другая — «класс!»
          const near = ts > 0 ? -1 : 1;
          armMix(q, near, AP.hang, [[0.6, -0.75, 0.25], [0.55, -0.8, 0.2], [0, -1, 0], 0.2, 0.3], k);
          armMix(q, -near, AP.hang, AP.thumb, k);
          if (t > 2.3) { const w = sst(2.3, 2.5, t); armMix(q, -near, AP.thumb, AP.up, w); q.R.fo[0] += Math.sin(t * 18) * 0.25 * w; q.L.fo[0] += Math.sin(t * 18) * 0.25 * w; }
        },
        end(a) { a.flashed = false; if (a.kid && a.kid.ks.mode === 'pose') { a.kid.ks.mode = 'cheer'; a.kid.ks.t = 0; } a.kid = null; a.withHero = false; },
      },
      // прятки: ладони на глаза — наклон к малышу — «бу!»
      peek: {
        go(a) { const k = a.kid; if (!k) return null; const d = dist2(a, k.px, k.pz) || 1; return outRing(freeSpotNear(k.px + (a.px - k.px) / d * 1.05, k.pz + (a.pz - k.pz) / d * 1.05)); },
        dur: () => 1.8, face: a => (a.kid ? [a.kid.px, a.kid.pz] : null),
        pose(a, q, t) {
          // ладони на глаза → «бу!» (руки в стороны) → руки вниз (а не обратно на лицо, откуда следующий номер их выдёргивал)
          const cover = sst(0, 0.4, t) * (1 - sst(1.0, 1.15, t)), open = sst(1.0, 1.15, t), back = sst(1.5, 1.8, t);
          [1, -1].forEach(s => { if (back > 0) armMix(q, s, AP.boo, AP.hang, back); else if (open > 0) armMix(q, s, AP.face, AP.boo, open); else armMix(q, s, AP.hang, AP.face, cover); });
          q.lean = 0.35 * sst(0.3, 0.9, t) * (1 - sst(1.2, 1.7, t)); q.hx = 0.25 * cover;
        },
        tick(a, dt, t) { if (t > 1.05 && a.kid && !a.kid.ks.mode) { a.kid.ks.mode = 'cheer'; a.kid.ks.t = 0; } return false; },
        end(a) { a.kid = null; },
      },
      // поклон (после выступлений и когда героиня хлопает или здоровается)
      bow: { dur: () => 1.3, face: a => a.tgt, pose(a, q, t) { bowPose(q, Math.sin(clamp(t / 1.2, 0, 1) * PI)); } },
      // стенд/снимки: поза по описанию a.photo { L, R: [up, fo, palm, curl, spread], lean, side, twist, hx, hy, hz, whip }
      photo: {
        dur: () => 1e9,
        pose(a, q) { const o = a.photo || {}; if (o.L) setArm(q, 1, o.L); if (o.R) setArm(q, -1, o.R); ['lean', 'side', 'twist', 'hx', 'hy', 'hz', 'y', 'whip'].forEach(k => { if (o[k] !== undefined) q[k] = o[k]; }); if (o.legs) { leg(q, 1, o.legs[0], o.legs[1], o.legs[2]); leg(q, -1, o.legs[3], o.legs[4], o.legs[5]); } },
      },
      // большое приветствие: обе руки вверх, машет, звенит
      wave: {
        dur: () => 1.6, face: a => (HEROC.ok ? [HEROC.x, HEROC.z] : a.tgt), start(a) { emit('jingle', { who: a.id }); a.saidHi = false; },
        // «Привет!» — чуть позже начала (если героиня заговорила с ним — молчит: облачко не поверх диалога) и не чаще раза в 8 с
        tick(a, dt, t) { if (t > 0.2 && !a.saidHi) { a.saidHi = true; if (st.t > (a.hiT || 0)) { a.hiT = st.t + 8; say(a, 'hi'); } } return false; },
        pose(a, q, t) { const w = Math.sin(t * 3 * TAU) * 0.45; arm(q, 1, AP.up[0], [0.25 + w, 1, 0.05], [0, 0, 1], 0, 0.8); arm(q, -1, AP.up[0], [0.25 - w, 1, 0.05], [0, 0, 1], 0, 0.8); q.y = Math.abs(Math.sin(t * 6)) * 0.04; q.hz = Math.sin(t * 3) * 0.1; },
      },
    };
    // где щёлкать плёткой: здесь, если просторно (наружу от круга танца, не идёт через полдвора), или ближайшее свободное место
    // у края двора (героиня и дети — не ближе 4 м, остальные — 2 м); null — сейчас негде (номер не предлагаем)
    function whipPlace(a) {
      const free = (x, z) => !(HEROC.ok && Math.hypot(x - HEROC.x, z - HEROC.z) < 4) && !kids.some(k => Math.hypot(k.px - x, k.pz - z) < 4) && !animals.some(b => b !== a && b.B && Math.hypot(b.B.root.position.x - x, b.B.root.position.z - z) < 2);
      if (free(a.px, a.pz) && !inCollider(a.px, a.pz, 0.6)) { const d = whipDir(a, Math.atan2(a.px - RC[0], a.pz - RC[1])); if (d !== null) return { here: true, wdir: d }; }
      const sp = WHIPSPOTS.filter(p => free(p[0], p[1])).sort((p, q) => dist2(a, p[0], p[1]) - dist2(a, q[0], q[1]))[0];
      return sp ? { p: sp, wdir: Math.atan2(sp[0] - RC[0], sp[1] - RC[1]) } : null;
    }
    // места у ворот, где для щелчка плёткой просторно (оси двора)
    const WHIPSPOTS = [[-2.9 * S, HD - 1.35], [2.9 * S, HD - 1.35], [4.5 * S, 2.9 * S], [-4.5 * S, 2.9 * S], [4.6 * S, -0.8 * S], [-4.6 * S, 0.4 * S]];
    function freeSpotNear(x, z) { return [clamp(x, -tableX + 1.9, tableX - 1.9), clamp(z, -HD + 2.3, HD - 1.0)]; }
    // точка вне круга танца (на R0 + 1 от центра) — там, где ряженому можно стоять в номере
    function outRing(p) { const rx = p[0] - RC[0], rz = p[1] - RC[1], rr = Math.hypot(rx, rz); return rr < R0 + 1.0 ? (rr > 1e-3 ? [RC[0] + rx / rr * (R0 + 1.0), RC[1] + rz / rr * (R0 + 1.0)] : [RC[0], RC[1] + R0 + 1.0]) : p; }
    // начать выступление
    function palStart(a, name, o) {
      const prev = a.mode; if (prev && ACTS[prev] && ACTS[prev].end && prev !== name) ACTS[prev].end(a);
      a.mode = name; a.act = name; a.at = 0; Object.assign(a, o || {});
      const Ac = ACTS[name];
      a.goal = Ac.go ? Ac.go(a) : null; a.goT = 0; a.goBest = undefined; a.goStall = 0; a.wpDone = false; a.actDur = Ac.dur ? Ac.dur(a) : 2;
      // сколько можно идти до места: по расстоянию (обход круга и соседей — с запасом), не меньше 5 с
      a.goLim = a.goal ? Math.max(5, 2 + 1.3 * dist2(a, a.goal[0], a.goal[1]) / (name === 'walk' ? 0.9 : 1.1)) : 5;
      a.phase = a.goal ? 'go' : 'do';
      if (a.phase === 'do' && Ac.start) Ac.start(a);
    }
    // что дальше: после прогулки — номер; после номера — отрезок маршрута
    function palNext(a) {
      if (a.mode !== 'walk' && a.mode !== 'bow' && RP() < 0.25) { palStart(a, 'bow', { tgt: HEROC.ok ? [HEROC.x, HEROC.z] : [dais.x, dais.z] }); return; }
      if (a.mode !== 'walk') { palStart(a, 'walk'); return; }
      const busy = n => pal.some(b => b !== a && b.mode === n), opts = [];
      const add = (n, w) => { if (w > 0) opts.push([n, w]); };
      add('clap', busy('clap') ? 0 : 20);
      add('dance', pal.filter(b => b.mode === 'dance').length >= 2 ? 0 : 20);
      // звон плечами и прыжок — на месте: рядом с героиней (ближе 1,6 м) их не начинают
      const heroNear = HEROC.ok && dist2(a, HEROC.x, HEROC.z) < 1.6;
      add('jingle', busy('jingle') || heroNear ? 0 : 10);
      add('jump', busy('jump') || heroNear ? 0 : 10);
      add('guard', busy('guard') ? 0 : 5);
      // «бу» гостю впереди (за столом или в кругу)
      const g = animals.filter(b => b.role !== 'paltar' && b.B && dist2(a, b.B.root.position.x, b.B.root.position.z) < 3 && facing(a, b.B.root.position.x, b.B.root.position.z) < 1.0)[0];
      if (g && !busy('boo') && st.t > (a.cool.boo || 0) && st.t > (st.booT || 0) - 13) add('boo', 15);
      const kid = freeKid(a, 7);
      if (kid && st.t > (st.chaseT || 0) && !busy('chase')) add('chase', 8);
      if (kid && !busy('peek') && dist2(a, kid.px, kid.pz) < 4) add('peek', 5);
      if (kid && !busy('selfie') && st.t > (st.selfieT || 0)) add('selfie', 5);
      const whipOk = a.pv.whip && st.t > (a.cool.whip || 0) && !busy('whip') && !!whipPlace(a);
      // героиня во дворе — номер с плёткой непременно покажут (раз за визит, в первые ~15 с), дальше — по очереди со всеми
      if (whipOk && st.heroIn > 5 && !st.whipShown && !(a.failN === 'whip' && st.t < a.failT)) { st.whipShown = true; palStart(a, 'whip'); return; }
      if (whipOk) add('whip', 22);
      // номер, до места которого только что не дошёл, — пока не предлагаем
      opts.forEach(o => { if (o[0] === a.failN && st.t < a.failT) o[1] = 0; });
      const mate = pal.filter(b => b !== a && b.mode === 'walk' && !b.hold && !b.listen && (!st.prank || st.prank.a !== b) && dist2(a, b.px, b.pz) < 8)[0];
      const FM = mate && !busy('fight') && st.t > (st.fightT || 0) ? fightSpot(a, mate) : null;
      if (FM) add('fight', 7);
      let sum = 0; opts.forEach(o => { sum += o[1]; });
      let r = RP() * sum, name = 'clap'; for (const o of opts) { r -= o[1]; if (r <= 0) { name = o[0]; break; } }
      if (name === 'boo') palStart(a, 'boo', { tgt: [g.B.root.position.x, g.B.root.position.z], booHero: false });
      else if (name === 'chase') { kid.ks.mode = null; palStart(a, 'chase', { kid }); }
      else if (name === 'peek') palStart(a, 'peek', { kid });
      else if (name === 'selfie') { const fc = HEROC.ok ? Math.atan2(HEROC.x - kid.px, HEROC.z - kid.pz) : 0; palStart(a, 'selfie', { kid, sfFace: fc, sfTilt: 1 }); }
      else if (name === 'whip') palStart(a, 'whip');
      else if (name === 'fight') {
        st.fightT = st.t + 35;
        const M = FM, F = { M, ang: Math.atan2(a.px - M[0], a.pz - M[1]), a0: a, a1: mate, loser: RP() < 0.5 ? a : mate, t: 0 };
        F.winner = F.loser === a ? mate : a;
        palStart(a, 'fight', { fight: F, fside: 0 }); palStart(mate, 'fight', { fight: F, fside: 1 });
      } else palStart(a, name, name === 'bow' ? { tgt: [dais.x, dais.z] } : null);
    }
    // реакции на героиню: «Бу-у!» вблизи, фото, если она стоит рядом, приветствие при входе во двор
    // места двора, где героиня занята (угощение, круг танца, поздравление молодых): там с фото не подходят
    const SPOTL = [[tableX, tableL / 2 + 0.55, 1.2], [RC[0], RC[1] + R0 + 0.9, 1.5], [dais.x, dais.z + 1.35, 1.4]];
    function palReact(dt) {
      if (!HEROC.ok || st.prank || dance.active) return;
      // свободен: не возится, не слушает героиню (окно диалога), гуляет или стоит в несложном номере
      const free = a => !a.hold && !a.listen && !(a.npc && a.npc.faceHero > 3) && ['walk', 'clap', 'guard', 'jingle', 'dance'].includes(a.mode);
      if (!st.greeted && st.heroIn > 0.6) {
        st.greeted = true; const a = pal.filter(free).sort((p, q) => dist2(p, HEROC.x, HEROC.z) - dist2(q, HEROC.x, HEROC.z))[0];
        if (a && dist2(a, HEROC.x, HEROC.z) < 9) { palStart(a, 'wave', { tgt: [HEROC.x, HEROC.z] }); st.heroReactT = st.t + 6; }
      }
      // события для героини не громоздятся: после приветствия, «Бу-у!», фото, розыгрыша и разговора — пауза; до розыгрыша
      // (он — через 6 с во дворе) «Бу-у!» и фото не начинаем
      if (st.t < (st.heroReactT || 0) || (!st.prankDone && st.heroIn > 2.5 && st.heroIn < 8.5)) return;
      if (st.t > (st.booT || 0)) {
        const a = pal.find(b => free(b) && st.t > (b.cool.boo || 0) && dist2(b, HEROC.x, HEROC.z) < 2.5 && dist2(b, HEROC.x, HEROC.z) > 0.9 && facing(b, HEROC.x, HEROC.z) < 1.3);
        if (a) { palStart(a, 'boo', { tgt: [HEROC.x, HEROC.z], booHero: true }); st.heroReactT = st.t + 7; return; }
      }
      // фото с героиней: только если она стоит без дела (рядом нет другого жителя, не у стола с угощением, не у круга, не у
      // помоста — не мешаем ей угощаться, болтать, танцевать) и ряженый уже недалеко; не чаще раза в 45 с
      const busyHero = animals.some(b => b.role !== 'paltar' && b.B && Math.hypot(b.B.root.position.x - HEROC.x, b.B.root.position.z - HEROC.z) < 2.4) || SPOTL.some(q => Math.hypot(q[0] - HEROC.x, q[1] - HEROC.z) < q[2] + 0.3);
      if (HEROC.still > 3 && !busyHero && st.t > (st.selfieT || 0) && st.t > (st.selfieHeroT || 0) && !pal.some(b => b.mode === 'selfie')) {
        const a = pal.filter(free).sort((p, q) => dist2(p, HEROC.x, HEROC.z) - dist2(q, HEROC.x, HEROC.z))[0];
        if (a && dist2(a, HEROC.x, HEROC.z) < 3.4) {
          // встаёт сбоку от героини — справа в кадре (не между камерой и героиней), лицом к камере; место — во дворе и не в столе
          let cx = 0, cz = 1;
          if (st.camL) { cx = st.camL.x - HEROC.x; cz = st.camL.z - HEROC.z; const l = Math.hypot(cx, cz) || 1; cx /= l; cz /= l; }
          const side = [cz, -cx], face = Math.atan2(cx, cz), sx = HEROC.x + side[0] * 0.78, sz = HEROC.z + side[1] * 0.78;
          if (Math.abs(sx) < HW - 0.8 && Math.abs(sz) < HD - 0.8 && !inCollider(sx, sz, 0.4)) { st.selfieHeroT = st.t + 45; st.heroReactT = st.t + 8; palStart(a, 'selfie', { withHero: true, kid: null, sfSide: side, sfFace: face, sfTilt: 1 }); }
        }
      }
    }
    // кто мешает идти (оси двора): [x, z, радиус, кто] — танцоры, дети, музыканты, тётушка, помост, ряженые, героиня; раз в кадр
    const OBS0 = animals.filter(b => b.role === 'zurna' || b.role === 'drum' || b.role === 'cook').map(b => [b.x, b.z, 0.4, b]).concat([-1, 0, 1].map(k => [dais.x + k * 1.0 * S, dais.z + 0.25, 0.75, 'dais']));
    // у тех, кто движется (танцоры в круге, бегущие дети, ряженые), — ещё скорость: обходим не их, а место, где они будут
    function obsUpd(dt) {
      const o = st.obs || (st.obs = []); o.length = 0;
      OBS0.forEach(q => o.push(q));
      const mov = (b, x, z, r) => { const vx = b.ox === undefined || dt <= 0 ? 0 : (x - b.ox) / dt, vz = b.oz === undefined || dt <= 0 ? 0 : (z - b.oz) / dt; b.ox = x; b.oz = z; o.push([x, z, r, b, clamp(vx, -3, 3), clamp(vz, -3, 3)]); };
      ring.forEach(b => mov(b, b.B.root.position.x, b.B.root.position.z, 0.32));
      kids.forEach(k => mov(k, k.px, k.pz, 0.34));
      // кто щёлкает плёткой — большой круг: остальные ряженые обходят его на 2 м с лишним
      // кто пляшет, хлопает, звенит (руки в стороны до 1 м) — круг побольше: мимо идущие не задевают его руки
      pal.forEach(b => o.push([b.px, b.pz, b.mode === 'whip' && b.phase === 'do' && !b.noCrack ? 1.5 : bigDo(b) ? 0.75 : 0.38, b]));
      if (HEROC.ok) o.push([HEROC.x, HEROC.z, 0.5, 'hero']);
    }
    // шаг ряженого к точке (оси двора) в обход соседей: мягко отталкивается и обходит сбоку; круг танцоров (если цель снаружи)
    // обходит по дуге снаружи; ign — кого не обходить (ребёнок для фото, героиня для розыгрыша). true — пришёл
    function walkTo(a, x, z, dt, spd, ign) {
      let dx = x - a.px, dz = z - a.pz, ax = 0, az = 0, mx = 0, mz = 0;
      const d = Math.hypot(dx, dz), here = d < 0.08;
      // уже на месте — не идёт, но отступы ниже действуют (героиня подошла вплотную к тому, кто ждёт)
      if (!here) {
        dx /= d; dz /= d;
        const cx = a.px - RC[0], cz = a.pz - RC[1], cr = Math.hypot(cx, cz) || 1e-3, tr = Math.hypot(x - RC[0], z - RC[1]);
        let arc = false;
        if (tr > R0 + 0.5 && cr > R0 + 0.3 && cr < R0 + 1.85) {
          // дуга обхода — на R0 + 0,95, а для цели у самого круга (место сбоку от героини, стоящей в кругу) — по радиусу цели:
          // иначе ряженый кружит снаружи, до цели не доходит и топчется рядом
          const RB = Math.min(R0 + 0.95, tr - 0.05), tt = clamp(-(cx * dx + cz * dz), 0, d), cl = Math.hypot(cx + dx * tt, cz + dz * tt);
          // обход — только если путь и правда заходит в круг впереди; в короткую сторону по кругу, и сторона держится, пока он идёт
          // (у цели почти напротив знак менялся каждый кадр — стоял, переступая на месте)
          if (cl < RB && tt > 1e-3) {
            arc = true;
            const da = angW(Math.atan2(x - RC[0], z - RC[1]) - Math.atan2(cx, cz)), want = da > 0 ? -1 : 1;
            if (!a.arcSd || (a.arcSd !== want && Math.abs(da) < PI - 0.3)) a.arcSd = want;
            let tx = -cz / cr * a.arcSd, tz = cx / cr * a.arcSd;
            const out = clamp((RB - cr) / 0.4, -0.6, 1.2); dx = tx + cx / cr * out; dz = tz + cz / cr * out; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
          } else if (cr < RB) {
            // стоит в полосе у круга, а цель — наружу или вбок: к цели и заодно наружу (а не боком по дуге на месте)
            const out = clamp((RB - cr) / 0.4, 0.5, 1.2); dx += cx / cr * out; dz += cz / cr * out; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
          }
        }
        if (!arc) a.arcSd = 0;
        let slow = 1;
        (st.obs || []).forEach(o => {
          if (o[3] === a || (ign && (o[3] === ign || (Array.isArray(ign) && ign.includes(o[3]))))) return;
          const vx = o[4] || 0, vz = o[5] || 0, moving = vx * vx + vz * vz > 0.04;
          const ex = a.px - o[0] - vx * 0.45, ez = a.pz - o[1] - vz * 0.45, e = Math.hypot(ex, ez), R = o[2] + 0.6;
          if (e > R || e < 1e-4) return;
          const w = (R - e) / R, nx = ex / e, nz = ez / e;
          ax += nx * w * 3; az += nz * w * 3;
          // впереди — обходим сбоку: стоящего — в ту сторону, где ближе к цели; идущего — сзади (пропускаем его, притормозив)
          // встречный идущий ряженый — оба берут вправо (а не зеркалят друг друга, топчась лицом к лицу)
          if (nx * dx + nz * dz < 0) {
            let tx = -nz, tz = nx;
            const pw = o[3] && o[3].role === 'paltar' && o[3].phase === 'go';
            // стоящего — с той стороны, что выбрана в начале обхода (цель прямо за ним — знак менялся каждый кадр, топтался)
            if (!pw && !moving) {
              const av = a.avs || (a.avs = new Map()), k0 = o[3] || o, m0 = av.get(k0), td = tx * dx + tz * dz, pref = td < 0 ? -1 : 1;
              const sd = m0 && st.t - m0[1] < 0.4 && (m0[0] === pref || Math.abs(td) < 0.3) ? m0[0] : pref; av.set(k0, [sd, st.t]);
              if (sd < 0) { tx = -tx; tz = -tz; }
            } else if (pw ? tz * dx - tx * dz < 0 : tx * vx + tz * vz > 0) { tx = -tx; tz = -tz; }
            ax += tx * w * 1.6; az += tz * w * 1.6;
            if (moving) slow = Math.min(slow, 1 - 0.7 * w);
          }
        });
        mx = dx + ax; mz = dz + az;
        const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        // разворачивается (курс далеко от того, куда смотрит) — притормаживает: не едет боком, пока поворачивается
        const v = Math.min(d, (spd || a.spd) * dt) * clamp(mx * dx + mz * dz + 0.4, 0.25, 1) * slow * (0.45 + 0.55 * Math.max(0, Math.cos(angW(Math.atan2(mx, mz) - a.pry))));
        a.px = clamp(a.px + mx * v, -HW + 0.6, HW - 0.6); a.pz = clamp(a.pz + mz * v, -HD + 0.6, HD - 0.6); a.gph = (a.gph || 0) + v / 1.15 * TAU;
      }
      // мимо героини — не ближе 0,85 м (руки на ходу не проходят сквозь неё); кто идёт к ней нарочно (ign), — не ближе 0,55 м;
      // внутрь круга — мягко, не быстрее 2,4 м/с (без рывка, когда номер сменился прогулкой), а глубже 0,15 м — быстрее, но не
      // скачком (≤ 8 см за кадр); сдвиг идёт и в шаг ног: не скользит
      // (сразу после розыгрыша он стоит у неё вплотную — отступ растёт от 0,6 м за 0,6 с, а не толчком по 8 см за кадр)
      // (бежит прямо на него — сначала шаг в сторону с её пути, заранее)
      if (HEROC.ok) { const ignH = ign === 'hero' || (Array.isArray(ign) && ign.includes('hero')), R1n = ignH ? 0.55 : st.talkNow ? 1.3 : 0.85, R1 = a.r1T > st.t ? Math.min(R1n, lerp(0.6, R1n, 1 - (a.r1T - st.t) / 0.6)) : R1n;
        if (!ignH) { const ex = a.px - HEROC.x, ez = a.pz - HEROC.z, e = Math.hypot(ex, ez); if (e > 1e-3) { const [nx, nz, la] = heroAway(a, ex, ez, e); if (la > 0 && e < R1 + la) { const mv = Math.min(R1 + la - e, 2.4 * dt); a.px += nx * mv; a.pz += nz * mv; a.gph = (a.gph || 0) + mv / 1.15 * TAU; } } }
        const ex = a.px - HEROC.x, ez = a.pz - HEROC.z, e = Math.hypot(ex, ez); if (e < R1 && e > 1e-3) { const e2 = Math.max(e + Math.min(R1 - e, 2.4 * dt), Math.min(R1 - 0.15, e + 0.08)); a.px = HEROC.x + ex / e * e2; a.pz = HEROC.z + ez / e * e2; a.gph += (e2 - e) / 1.15 * TAU; } }
      // танцоров — не ближе 0,72 м (рука на ходу не задевает танцора в круге), детей — 0,65 м (мягко; и уж точно не ближе 0,62 м),
      // других ряженых — 0,55 м, а того, кто пляшет, хлопает, кланяется (руки в стороны), — 0,8 м, мягко (обход выше иногда срезает
      // вплотную); напарник по борьбе и тот, к кому идут нарочно (ign), — не в счёт
      (st.obs || []).forEach(o => {
        const b = o[3], lim = b && b.role === 'paltar' ? (a.fight && b.fight === a.fight ? 0 : bigDo(b) ? 0.8 : 0.55) : b && b.role === 'dance' ? 0.72 : b && b.role === 'kid' ? 0.65 : 0;
        if (!lim || b === a || (ign && (b === ign || (Array.isArray(ign) && ign.includes(b))))) return;
        const ex = a.px - o[0], ez = a.pz - o[1], e = Math.hypot(ex, ez); if (e < lim && e > 1e-3) { const mv = Math.max(Math.min(lim - e, 2.4 * dt), b.role !== 'paltar' && lim > 0.6 ? Math.min(0.62 - e, 0.08) : 0); a.px += ex / e * mv; a.pz += ez / e * mv; a.gph += mv / 1.15 * TAU; }
      });
      if (!here) steer(a, Math.atan2(mx, mz), dt, 6);
      // цель занята кем-то (стоит прямо у точки) — считаем, что пришёл
      return here || (d < 0.4 && ax * ax + az * az > 0.3);
    }
    // точка внутри препятствия двора (столы, столбы навесов, казан, мангал, помост) с запасом r
    function inCollider(x, z, r) {
      if (Math.abs(x - dais.x) < 1.45 * S + r && Math.abs(z - dais.z) < 0.8 + r) return true;
      return colliders.some(c => (c.type === 'box' ? Math.abs(x - c.l[0]) < c.w / 2 + r && Math.abs(z - c.l[1]) < c.d / 2 + r : Math.hypot(x - c.l[0], z - c.l[1]) < c.r + r));
    }
    // расстояние от точки (px, pz) до отрезка (x0, z0)–(x1, z1)
    function segD(x0, z0, x1, z1, px, pz) { const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz, u = l2 > 1e-9 ? clamp(((px - x0) * dx + (pz - z0) * dz) / l2, 0, 1) : 0; return Math.hypot(x0 + dx * u - px, z0 + dz * u - pz); }
    // место для шуточной борьбы: у середины между двумя, но вне круга танца, не ближе 1,6 м к детям, гостям, танцорам,
    // музыкантам и другим ряженым, не ближе 2,2 м к героине, мимо детских кружков догонялок; нет такого места — борьбы нет
    function fightSpot(a, b) {
      const mx = (a.px + b.px) / 2, mz = (a.pz + b.pz) / 2, c = [[mx, mz]];
      [1, 1.7, 2.4].forEach(r => { for (let i = 0; i < 8; i++) c.push([mx + Math.sin(i / 8 * TAU) * r, mz + Math.cos(i / 8 * TAU) * r]); });
      for (const p0 of c) {
        const p = freeSpot(p0[0], p0[1]);
        if (Math.hypot(p[0] - RC[0], p[1] - RC[1]) < R0 + 1.75 || (HEROC.ok && Math.hypot(p[0] - HEROC.x, p[1] - HEROC.z) < 2.2) || inCollider(p[0], p[1], 1.2)) continue;
        if (animals.some(o => o !== a && o !== b && o.B && Math.hypot(o.B.root.position.x - p[0], o.B.root.position.z - p[1]) < 1.6)) continue;
        if (kids.some(k => Math.hypot(k.loopC[0] - p[0], k.loopC[1] - p[1]) < k.loopR + 1.3 || Math.hypot(k.home[0] - p[0], k.home[1] - p[1]) < 1.6)) continue;
        // путь каждого к своему месту в круге — не ближе 1 м к героине (иначе упирается в неё и ждёт у плеча)
        if (HEROC.ok) { const ax = a.px - p[0], az = a.pz - p[1], al = Math.hypot(ax, az) || 1, ox = ax / al * 0.75, oz = az / al * 0.75; if (segD(a.px, a.pz, p[0] + ox, p[1] + oz, HEROC.x, HEROC.z) < 1.0 || segD(b.px, b.pz, p[0] - ox, p[1] - oz, HEROC.x, HEROC.z) < 1.0) continue; }
        return p;
      }
      return null;
    }
    // искры (общий пул с конфетами): вспышка фото, хлопок плётки, звёздочки после падения
    function sparks(x, y, z, n, col, life, burst) {
      const c = hex(col), C2 = candyGeo.attributes.color;
      for (let k = 0; k < n; k++) {
        const i = NCANDY + (st.spk = ((st.spk || 0) + 1) % NSPARK);
        const an = RP() * TAU, el = (RP() - 0.3) * 1.4, sp = burst ? 1.6 + RP() : 0.5 + RP() * 0.6;
        candy.pos[i * 3] = x; candy.pos[i * 3 + 1] = y; candy.pos[i * 3 + 2] = z;
        candy.vel[i * 3] = Math.cos(an) * Math.cos(el) * sp; candy.vel[i * 3 + 1] = Math.sin(el) * sp + (burst ? 0 : 0.6); candy.vel[i * 3 + 2] = Math.sin(an) * Math.cos(el) * sp;
        candy.life[i] = life * (0.7 + RP() * 0.6); C2.setXYZ(i, c[0], c[1], c[2]);
      }
      C2.needsUpdate = true; candyPts.visible = st.lod === 0; if (candy.t < 0) candy.t = 0;
    }
    // голова героини в осях двора (для розыгрыша): по кости головы, если героиню дали, иначе — над позицией
    const _hv = new T.Vector3(), _inv = new T.Matrix4();
    function heroHeadLocal() {
      if (st.heroAnim && st.heroAnim.bones && st.heroAnim.bones.head) {
        st.heroAnim.bones.head.getWorldPosition(_hv); _hv.y += 0.42;
      } else if (st.heroPos) _hv.set(st.heroPos.x, (st.heroPos.y || A.y) + 1.86, st.heroPos.z);
      else return null;
      _inv.copy(stage.matrixWorld).invert(); return _hv.clone().applyMatrix4(_inv);
    }
    function heroLocal() { if (!st.heroPos) return null; _inv.copy(stage.matrixWorld).invert(); return new T.Vector3(st.heroPos.x, st.heroPos.y || A.y, st.heroPos.z).applyMatrix4(_inv); }
    // номера с размашистыми руками: героиня, подошедшая ближе 1,2 м, отодвигает ряженого (рука «орла» в сторону — до 0,85 м)
    const BIGARMS = ['dance', 'clap', 'jingle', 'jump', 'guard', 'boo'];
    // руки в стороны на 0,8–1 м (номера с размахом, поклон, приветствие): мимо идущие и соседи держатся дальше
    const WIDE = BIGARMS.concat(['bow', 'wave']);
    const bigDo = b => b.role === 'paltar' && b.phase === 'do' && WIDE.includes(b.mode) && !b.hold && !b.listen;
    function updatePaltars(t, dt) {
      heroUpdate(dt);
      // героиня в разговоре — остальные ряженые держатся от неё подальше (не толпятся у окна диалога)
      st.talkNow = heroTalking();
      obsUpd(dt);
      palReact(dt);
      pal.forEach(a => {
        const x0 = a.px, z0 = a.pz; a.dtLast = dt;
        if (!a.mode) palStart(a, 'walk');
        // стенд: застывшая поза
        if (a.freeze) { a.mode = a.freeze.name; a.phase = 'do'; a.at = a.freeze.t; a.vel = a.freeze.vel || 0; return; }
        // W5: возится с героиней понарошку — маршрут на паузе (двигает его слой возни: скорость — по сдвигу за кадр)
        if (a.hold) { if (a.mode !== 'hold') { if (ACTS[a.mode] && ACTS[a.mode].end) ACTS[a.mode].end(a); a.mode = 'hold'; } a.vel = a.lpx === undefined ? 0 : Math.hypot(a.px - a.lpx, a.pz - a.lpz) / Math.max(dt, 1e-3); a.lpx = a.px; a.lpz = a.pz; return; }
        a.lpx = a.px; a.lpz = a.pz;
        if (a.mode === 'hold') palStart(a, 'walk');
        // с ним разговаривают (окно диалога) — стоит, слушает, смотрит на героиню; номер ждёт (тот, кто разыгрывает, — не слушает)
        const isPrank = !!(st.prank && st.prank.a === a), wasL = a.listen;
        a.listen = !isPrank && !!(a.npc && a.npc.faceHero > 3 && HEROC.ok && dist2(a, HEROC.x, HEROC.z) < 4);
        // заговорили посреди шуточной борьбы — борьба кончается (напарник сам уйдёт гулять)
        if (a.listen && a.mode === 'fight') palStart(a, 'walk');
        // заговорили — приветствие (n.hop на разговор) отменяется: иначе оно ждёт под позой «слушает» и звучит после окна
        if (a.listen && !wasL) { if (a.mode === 'wave') palStart(a, 'walk'); a.hiT = Math.max(a.hiT || 0, st.t + 8); }
        // после разговора — без «Бу-у!», «Привет» и розыгрыша от того же собеседника (реакции не громоздятся)
        // «Бу-у!» или фото с героиней, прерванные разговором, не доигрываются после него (без возгласа) — короткий поклон ей
        if (wasL && !a.listen) { a.cool.boo = Math.max(a.cool.boo || 0, st.t + 10); a.hiT = Math.max(a.hiT || 0, st.t + 8); a.talkT = st.t + 10; st.heroReactT = Math.max(st.heroReactT || 0, st.t + 6); if (a.mode === 'boo' || (a.mode === 'selfie' && a.withHero)) palStart(a, 'bow', { tgt: HEROC.ok ? [HEROC.x, HEROC.z] : a.tgt }); }
        // разыгрывает: двигает его розыгрыш (после обхода всех) — скорость по сдвигу с прошлого кадра (для шага ног)
        if (isPrank) { a.vel = a.ppx === undefined ? 0 : Math.hypot(a.px - a.ppx, a.pz - a.ppz) / Math.max(dt, 1e-3); a.ppx = a.px; a.ppz = a.pz; a.velS = (a.velS || 0) + (a.vel - (a.velS || 0)) * Math.min(1, dt * 8); return; }
        a.ppx = undefined;
        if (a.mode === 'approach' || a.mode === 'prank') palStart(a, 'walk');
        if (a.listen) { turnTo(a, HEROC.x, HEROC.z, dt, 4); a.vel = 0; return; }
        const Ac = ACTS[a.mode] || ACTS.walk;
        if (a.phase === 'go') {
          a.goT += dt;
          // фото с героиней: сначала — точка в 1,3 м сбоку от неё (в обход), и только последний шаг — к ней вплотную
          let gx = a.goal ? a.goal[0] : 0, gz = a.goal ? a.goal[1] : 0, ign = null;
          if (a.mode === 'selfie' && a.withHero && a.sfSide) { if (!a.wpDone && HEROC.ok) { const wx = HEROC.x + a.sfSide[0] * 1.3, wz = HEROC.z + a.sfSide[1] * 1.3; if (Math.hypot(wx - a.px, wz - a.pz) < 0.35) a.wpDone = true; else { gx = wx; gz = wz; } } if (a.wpDone) ign = 'hero'; }
          // застрял у самой цели (соседи отталкивают, а до точки — меньше метра) — начинает номер там, где стоит
          const gd = Math.hypot(a.goal ? a.goal[0] - a.px : 0, a.goal ? a.goal[1] - a.pz : 0);
          if (gd < (a.goBest === undefined ? 1e9 : a.goBest) - 0.05) { a.goBest = gd; a.goStall = 0; } else a.goStall = (a.goStall || 0) + dt;
          // (но не вплотную к героине: в номере её отступ сразу толкнул бы его — стоит, упёршись в неё, — другой номер)
          const heroNear = HEROC.ok && a.mode !== 'walk' && !(a.mode === 'selfie' && a.withHero) && dist2(a, HEROC.x, HEROC.z) < (st.talkNow ? 1.5 : BIGARMS.includes(a.mode) ? 1.2 : 0.75) + 0.2;
          const stuck = gd < (a.mode === 'walk' ? 1.2 : 1.0) && a.goStall > 0.7 && !(a.mode === 'selfie' && a.withHero && !a.wpDone) && !heroNear;
          // начинать номер вплотную к другому ряженому нельзя (дошёл «впритык» — ещё ищет место, по тайм-ауту — другой номер)
          const crowd = a.mode !== 'walk' && a.mode !== 'fight' && pal.some(b => b !== a && dist2(a, b.px, b.pz) < (WIDE.includes(a.mode) || bigDo(b) ? 1.05 : 0.85));
          const arrived = !a.goal || (walkTo(a, gx, gz, dt, a.mode === 'walk' ? 0.9 : 1.1, ign) && gx === a.goal[0] && gz === a.goal[1] || stuck) && !crowd;
          if (arrived) {
            if (a.mode === 'walk') { if (Ac.done) Ac.done(a); palNext(a); }
            else { a.phase = 'do'; a.at = 0; if (Ac.start) Ac.start(a); }
          } else if (a.goT > a.goLim || (a.goStall > 1.0 && (a.netV || 0) < 0.15 && (gd >= 1.0 || crowd || heroNear))) {
            // так и не дошёл (или стоит, упёршись, — путь загорожен, или у самой цели стоит другой ряженый) — этот номер пока не
            // предлагаем, сразу другой (без поклона и лишней прогулки)
            if (a.mode === 'walk') { if (Ac.done) Ac.done(a); palNext(a); }
            else if (a.mode === 'fight') {
              // почти дошёл — начинает; путь загорожен (героиня, гости) — борьбы нет у обоих (не идёт напролом)
              if (gd < 1.0) { a.phase = 'do'; a.at = 0; if (Ac.start) Ac.start(a); }
              else { const F = a.fight, o = F && (F.a0 === a ? F.a1 : F.a0); a.failN = 'fight'; a.failT = st.t + 12; palStart(a, 'walk'); if (o && o.mode === 'fight' && o.fight === F) palStart(o, 'walk'); }
            }
            else { a.failN = a.mode; a.failT = st.t + 12; if (ACTS[a.mode] && ACTS[a.mode].end) ACTS[a.mode].end(a); a.mode = 'walk'; palNext(a); }
          }
        } else {
          a.at += dt;
          // (в догонялках, пока бежит, поворачивает шаг — не ещё и «лицом к ребёнку» в тот же кадр)
          const f = Ac.face ? Ac.face(a) : null; if (f && a.mode !== 'fight' && !(a.mode === 'chase' && a.at > 1.5 && a.at < 7.8)) turnTo(a, f[0], f[1], dt, 5);
          const sx0 = a.px, sz0 = a.pz, stop = Ac.tick ? Ac.tick(a, dt, a.at) : false;
          // героиня идёт прямо на стоящего ряженого — он отступает (коллайдера у ряженых нет, иначе она проходит сквозь)
          // в номерах с размашистыми руками (пляска, хлопки, звон, прыжок, страж, «Бу-у!» — растопыренные руки не достают до неё)
          // — отступает на 1,2 м (и в догонялках, пока крадётся на цыпочках и когда уже поднимается на поклон; и в фото с ребёнком)
          const R1 = st.talkNow ? 1.5 : BIGARMS.includes(a.mode) ? 1.2 : 0.75;
          const pushed = HEROC.ok && !['fight', 'peek'].includes(a.mode) && !(a.mode === 'selfie' && a.withHero) && !(a.mode === 'chase' && a.at > 1.5 && a.at < 9.45);
          if (pushed) { const ex = a.px - HEROC.x, ez = a.pz - HEROC.z, e = Math.hypot(ex, ez); if (e > 1e-3) { const [nx, nz, la] = heroAway(a, ex, ez, e); if (e < R1 + la) { const mv = Math.min(R1 + la - e, 2.2 * dt); a.px += nx * mv; a.pz += nz * mv; a.pushV = mv / Math.max(dt, 1e-3); a.gph = (a.gph || 0) + mv / 1.15 * TAU; } } }
          // в круг танцоров не заступает (и отступая от героини): не ближе R0 + 0,95 к центру круга — выходит шагом, не быстрее
          // 2,2 м/с (номер начался у самого круга — без скачка за кадр); героиня прижала к кругу — отступает вдоль него (в сторону
          // от неё), а не стоит у неё вплотную
          if (a.mode !== 'fight') {
            const rx = a.px - RC[0], rz = a.pz - RC[1], rr = Math.hypot(rx, rz);
            if (rr < R0 + 0.95 && rr > 1e-3) {
              const mo = Math.min(R0 + 0.95 - rr, 2.2 * dt); a.px += rx / rr * mo; a.pz += rz / rr * mo; a.pushV = Math.max(a.pushV || 0, mo / Math.max(dt, 1e-3)); a.gph = (a.gph || 0) + mo / 1.15 * TAU;
              const e = pushed ? Math.hypot(a.px - HEROC.x, a.pz - HEROC.z) : 9;
              if (e < R1 - 0.02) { let tx = -rz / rr, tz = rx / rr; if (tx * (a.px - HEROC.x) + tz * (a.pz - HEROC.z) < 0) { tx = -tx; tz = -tz; } const mv = Math.min(R1 - e, 2.2 * dt); a.px += tx * mv; a.pz += tz * mv; a.pushV = mv / Math.max(dt, 1e-3); a.gph = (a.gph || 0) + mv / 1.15 * TAU; }
            }
          }
          // в номере на месте — не вплотную к другому ряженому и к ребёнку (номер начался рядом, из круга вытолкнуло к соседу,
          // малыш бежит мимо): отходит шагом; свой ребёнок в фото, прятках и догонялках — не в счёт (там свои расстояния)
          // (у кого руки в стороны — пляшет, хлопает, звенит — или рядом такой, — не ближе 1,05 м: руки не проходят сквозь соседа)
          if (a.mode !== 'fight') pal.concat(kids).forEach(b => { if (b === a || b.hold || b === a.kid) return; const lim = b.role === 'kid' ? 0.62 : WIDE.includes(a.mode) || bigDo(b) ? 1.05 : 0.6, ex = a.px - b.px, ez = a.pz - b.pz, e = Math.hypot(ex, ez); if (e < lim && e > 1e-3) { const mv = Math.min(lim - e, 1.2 * dt); a.px += ex / e * mv; a.pz += ez / e * mv; a.pushV = Math.max(a.pushV || 0, mv / Math.max(dt, 1e-3)); a.gph = (a.gph || 0) + mv / 1.15 * TAU; } });
          // весь сдвиг за кадр (ход в номере и отступы от героини, круга, соседей вместе) — не быстрее 2,2 м/с (как один отступ): без
          // толчка, когда толкают сразу с нескольких сторон
          { const mx = a.px - sx0, mz = a.pz - sz0, ml = Math.hypot(mx, mz), lim = 2.2 * dt; if (ml > lim) { a.px = sx0 + mx / ml * lim; a.pz = sz0 + mz / ml * lim; } }
          if (stop || a.at >= a.actDur) palNext(a);
        }
        // отступает от героини быстрее 0,4 м/с — ноги переступают (не скользит в позе номера); плавно, без рывка
        a.pushK = (a.pushK || 0) + (((a.pushV || 0) > 0.4 ? 1 : 0) - (a.pushK || 0)) * Math.min(1, dt * 10); a.pushV = 0;
        a.vel = Math.hypot(a.px - x0, a.pz - z0) / Math.max(dt, 1e-3);
        // размах шага — по сглаженной скорости (толчок за кадр не раскачивает руки рывком)
        a.velS = (a.velS || 0) + (a.vel - (a.velS || 0)) * Math.min(1, dt * 8);
        // настоящий ход — по сглаженной точке (≈ 0,5 с): дрожит туда-сюда на месте — почти 0, хотя скорость за кадр большая
        if (a.sx === undefined) { a.sx = a.px; a.sz = a.pz; }
        a.sx += (a.px - a.sx) * Math.min(1, dt / 0.5); a.sz += (a.pz - a.sz) * Math.min(1, dt / 0.5); a.netV = Math.hypot(a.px - a.sx, a.pz - a.sz) / 0.5;
      });
      // розыгрыш
      const P = st.prank;
      if (P) {
        const a = P.a, hl = heroLocal(), hh = heroHeadLocal();
        P.t += dt; P.T += dt;
        if (!hl || P.T > 14) { endPrank(P.phase === 'approach' || P.phase === 'reach' || P.phase === 'jingle'); return; }
        const talk = heroTalking(), dh = Math.hypot(hl.x - a.px, hl.z - a.pz), early = P.phase === 'approach' || P.phase === 'reach' || P.phase === 'jingle';
        // пока берет не взят: героиня заговорила с кем-то, ушла со двора или ряженый так до неё и не дошёл — розыгрыш тихо
        // откладывается (через 8 с — заново); берет уже в руке — сразу возвращает его, без облачков поверх диалога
        if (early && (talk || !HEROC.ok || (P.phase === 'approach' && (P.T > 9 || (P.t > 6 && dh > 2.5))))) { endPrank(true); return; }
        if ((P.phase === 'take' || P.phase === 'show') && (talk || dh > 1.6)) { P.quiet = P.quiet || talk; setPhase('return'); P.fast = true; }
        const fx = hl.x + Math.sin(P.side) * 0.72, fz = hl.z + Math.cos(P.side) * 0.72;
        // начинает, только когда рука достаёт до берета: пришёл на место сбоку (или почти, а путь загорожен)
        // (или стоит больше секунды, не приближаясь к месту, и рука почти достаёт — место сбоку загородили)
        if (P.phase === 'approach') {
          a.mode = 'approach'; const at = walkTo(a, fx, fz, dt, 1.1, 'hero'), fd = Math.hypot(fx - a.px, fz - a.pz);
          if (fd < (P.fBest === undefined ? 1e9 : P.fBest) - 0.03) { P.fBest = fd; P.stall = 0; } else P.stall = (P.stall || 0) + dt;
          if ((dh < (P.kind === 'beret' ? 1.0 : 1.3) && (at || P.t > 3.5 || fd < 0.25)) || (P.stall > 1.0 && dh < (P.kind === 'beret' ? 1.12 : 1.3))) { setPhase(P.kind === 'beret' ? 'reach' : 'jingle'); a.mode = 'prank'; if (P.kind === 'jingle') prankEmit({ type: 'jingle', phase: 'jingle', who: a.id, text: pick(EV.prankJingle, named).text }); }
        } else {
          // с беретом в руке держится сбоку от героини (отходит она — догоняет, копия не летит через полдвора)
          if ((P.phase === 'reach' || P.phase === 'take' || P.phase === 'show') && Math.hypot(fx - a.px, fz - a.pz) > 0.15) walkTo(a, fx, fz, dt, 1.4, 'hero');
          steer(a, Math.atan2(hl.x - a.px, hl.z - a.pz), dt, 6);
        }
        // героиня идёт прямо на него (показ, возврат берета, поклон) — отступает шагом, не ближе 0,6 м: сквозь него не проходит
        if (P.phase !== 'approach') { const ex = a.px - hl.x, ez = a.pz - hl.z, e = Math.hypot(ex, ez); if (e < 0.6 && e > 1e-3) { const mv = Math.min(0.6 - e, 2.2 * dt); a.px += ex / e * mv; a.pz += ez / e * mv; a.gph = (a.gph || 0) + mv / 1.15 * TAU; } }
        P.head = hh;
        if (P.phase === 'reach' && P.t > 0.55) { setPhase('take'); if (st.hero && V.kaz && V.kaz.hideBeret) P.hid = V.kaz.hideBeret(st.hero, true); prankEmit({ type: 'beret', phase: 'take', who: a.id, text: pick(EV.prankBeret, named).text }); }
        if (P.phase === 'take' && P.t > 0.45) setPhase('show');
        if (P.phase === 'show' && P.t > 1.6) setPhase('return');
        if (P.phase === 'return' && (P.t > 1.0 || P.fast)) { if (P.hid && V.kaz) V.kaz.hideBeret(st.hero, false); P.hid = false; setPhase('bow'); prankEmit({ type: 'beret', phase: 'return', who: a.id, quiet: !!P.quiet }); }
        if (P.phase === 'jingle' && P.t > 1.8) { setPhase('bow'); emit('bell', { who: a.id }); }
        if (P.phase === 'bow' && P.t > 1.3) endPrank();
      }
    }
    // поза ряженого за кадр (после движения): номер, розыгрыш, возня
    function palPose(a, t, beat, dt) {
      const q = palReset(a), m = a.mode;
      if (a.hold) {
        // возня понарошку: стойка «боксёра», пружинит, плётка на поясе
        setArm(q, 1, AP.guard); setArm(q, -1, AP.guard); q.y = Math.abs(Math.sin(t * 6)) * 0.04; crouch(q, 0.05); q.whip = 'tuck'; q.lean = 0.08;
        if (a.vel > 0.2) { const k = Math.min(1, a.vel / 1.5), w = t * 11; q.lx += Math.sin(w) * 0.45 * k; q.rx -= Math.sin(w) * 0.45 * k; q.lk += Math.max(0, Math.sin(w)) * 0.6 * k; q.rk += Math.max(0, -Math.sin(w)) * 0.6 * k; }
      } else if (a.listen) {
        // слушает: руки в боки, кивает, чуть пружинит
        setArm(q, 1, AP.hip); setArm(q, -1, AP.hip); q.hx = 0.08 + Math.sin(t * 2.4) * 0.07; q.hz = Math.sin(t * 0.9) * 0.08; q.y = Math.abs(Math.sin(t * 2.4)) * 0.022; q.whip = 'tuck';
      } else if (m === 'approach') { gait(a, q, 1); q.whip = 'tuck'; }
      else if (m === 'prank') prankPose(a, q, t);
      else {
        const Ac = ACTS[m];
        // в пути — шаг по скорости (затихает плавно); ждёт, пока освободится дорога, — не столбом: руки в боки, поглядывает и
        // поворачивается по сторонам
        if (a.phase === 'go' || !Ac || !Ac.pose) {
          const vs = a.velS || 0; if (vs > 0.05) gait(a, q, clamp(vs / 0.9, 0.3, 1.2) * sst(0.05, 0.25, vs));
          if (vs < 0.25) { const k = 1 - sst(0.05, 0.25, vs); q.hx = lerp(q.hx, -0.05, k); q.hy += Math.sin(t * 0.8 + a.idx * 2) * 0.35 * k; q.twist += Math.sin(t * 0.9 + a.idx * 2) * 0.18 * k; q.y += Math.abs(Math.sin(t * 1.7 + a.idx)) * 0.015 * k; armTo(q, 1, AP.hip, 0.85 * k); armTo(q, -1, AP.hip, 0.85 * k); }
        }
        else {
          Ac.pose(a, q, a.at, beat);
          // отступает (героиня идёт на него) — ноги шагом поверх позы номера; ниже всех — та же ступня, что в позе (не в землю)
          if (a.pushK > 0.02) {
            const k = a.pushK, ph = a.gph || 0, sw = Math.sin(ph) * 0.36, Lv = (x, kn) => 0.47 * Math.cos(x) + 0.53 * Math.cos(x + kn), m0 = Math.max(Lv(q.lx, q.lk), Lv(q.rx, q.rk));
            q.lx = lerp(q.lx, -sw, k); q.lk = lerp(q.lk, 0.08 + 0.75 * Math.max(0, Math.sin(ph + 1.9)), k); q.rx = lerp(q.rx, sw, k); q.rk = lerp(q.rk, 0.08 + 0.75 * Math.max(0, Math.sin(ph + 1.9 + PI)), k);
            q.drop -= Math.max(Lv(q.lx, q.lk), Lv(q.rx, q.rk)) - m0;
          }
        }
        // плётка свёрнута на поясе всегда, кроме номера «whip» у места щелчка (там её достают, щёлкают и убирают обратно)
        if (m !== 'whip' || a.phase === 'go') q.whip = 'tuck';
      }
      if (!a.pv.whip) q.whip = null;
      palBlend(a, q, dt);
      palApply(a, dt);
      if (m === 'prank') prankBeret(a, t);
    }
    // смена номера, фазы (и этапа номера — sub), «слушает», возни или шага розыгрыша — новая поза не сразу: 0,3 с перетекает из
    // последней показанной (руки, ноги, наклоны; без рывка кисти на метр за кадр и без прыжка из сидячих). Стенд (застывшая
    // поза) — без перетекания
    const QK = ['y', 'drop', 'lean', 'twist', 'side', 'bx', 'by', 'bz', 'sq', 'hx', 'hy', 'hz', 'lx', 'rx', 'lk', 'rk', 'lz', 'rz'];
    const QA = ['up', 'fo'], QS = ['curl', 'spread', 'flex'], BLT = 0.3;
    // направление плеча/предплечья — по дуге (ровная угловая скорость; прямая между почти противоположными векторами давала
    // рывок в середине); результат — в b
    function slerpU(ax, ay, az, bx, by, bz, k, o) {
      const d = clamp(ax * bx + ay * by + az * bz, -1, 1), th = Math.acos(d);
      if (th < 0.02) { o[0] = lerp(ax, bx, k); o[1] = lerp(ay, by, k); o[2] = lerp(az, bz, k); return; }
      const sn = Math.sin(th), wa = Math.sin((1 - k) * th) / sn, wb = Math.sin(k * th) / sn;
      o[0] = ax * wa + bx * wb; o[1] = ay * wa + by * wb; o[2] = az * wa + bz * wb;
    }
    // почти противоположные (рука вниз → вверх, локоть сложен → выпрямлен) — дуга через середину, сдвинутую вперёд: иначе
    // плоскость дуги зависит от малых боковых долей, и цель, чуть качнувшись (машет рукой), перебрасывает руку с бока на бок
    function slerpV(a0, b, k) {
      const la = Math.hypot(a0[0], a0[1], a0[2]) || 1, lb = Math.hypot(b[0], b[1], b[2]) || 1, ax = a0[0] / la, ay = a0[1] / la, az = a0[2] / la, bx = b[0] / lb, by = b[1] / lb, bz = b[2] / lb;
      const c = 0.6 * sst(-0.55, -0.95, ax * bx + ay * by + az * bz);
      if (c <= 0) { slerpU(ax, ay, az, bx, by, bz, k, b); return; }
      let mx = ax + bx, my = ay + by, mz = az + bz + c;
      const ml = Math.hypot(mx, my, mz); if (ml < 1e-4) { mx = 0; my = 0; mz = 1; } else { mx /= ml; my /= ml; mz /= ml; }
      if (k < 0.5) slerpU(ax, ay, az, mx, my, mz, k * 2, b); else slerpU(mx, my, mz, bx, by, bz, k * 2 - 1, b);
    }
    const legV = (x, kn) => 0.47 * Math.cos(x) + 0.53 * Math.cos(x + kn);
    function qCopy(d, q) {
      QK.forEach(n => { d[n] = q[n]; });
      ['L', 'R'].forEach(s2 => { const A2 = q[s2], D2 = d[s2] || (d[s2] = { up: [0, 0, 0], fo: [0, 0, 0], palm: null }); QA.forEach(n => { D2[n][0] = A2[n][0]; D2[n][1] = A2[n][1]; D2[n][2] = A2[n][2]; }); D2.palm = A2.palm ? A2.palm.slice() : null; QS.forEach(n => { D2[n] = A2[n] || 0; }); });
      return d;
    }
    // скорость позы в миг смены (по двум последним кадрам) — перетекание стартует с ней и гасит её за ≈ 0,07 с: кисть, летевшая
    // со скоростью 2–3 м/с, не замирает на кадр (из «застывшего» снимка рука останавливалась, потом трогалась заново); предел —
    // VMAX рад/с, иначе скачок прошлого кадра унёс бы позу
    const VT = 0.07, VMAX = 4, QV = ['lean', 'twist', 'side', 'bx', 'by', 'bz', 'hx', 'hy', 'hz'];
    function palBlend(a, q, dt) {
      const P = st.prank, Ac = ACTS[a.mode], key = a.hold ? 'hold' : a.listen ? 'listen' : a.mode + ':' + (a.mode === 'prank' && P ? P.phase : a.phase) + (Ac && Ac.sub && a.phase === 'do' ? ':' + Ac.sub(a, a.at) : '');
      if (a.freeze) { a.qb = null; a.qp = null; }
      else if (key !== a.bk && a.qs) {
        a.qb = qCopy(a.qb || {}, a.qs); a.blT = 0; a.blOn = true;
        const V0 = a.qv || (a.qv = { L: { up: [0, 0, 0], fo: [0, 0, 0] }, R: { up: [0, 0, 0], fo: [0, 0, 0] } }), ok = !!a.qp && a.qdt > 1e-3;
        // (только корпус, голова и руки: таз и ноги — без разгона, ступни не отрываются от земли)
        QK.forEach(n => { V0[n] = ok && QV.includes(n) ? clamp((a.qs[n] - a.qp[n]) / a.qdt, -VMAX, VMAX) : 0; });
        // (размах рук: руки через полкруга — сверху вниз, из стороны к груди — перетекают дольше, до +0,25 с; встаёт с земли —
        // номер прервали, пока сидел, — до +0,5 с: таз не взлетает на 0,2 м за кадр)
        let mA = 0;
        ['L', 'R'].forEach(s2 => QA.forEach(n => {
          const c0 = a.qs[s2][n], c1 = q[s2][n], l0 = Math.hypot(c0[0], c0[1], c0[2]) || 1, l1 = Math.hypot(c1[0], c1[1], c1[2]) || 1;
          mA = Math.max(mA, Math.acos(clamp((c0[0] * c1[0] + c0[1] * c1[1] + c0[2] * c1[2]) / (l0 * l1), -1, 1)));
          for (let i = 0; i < 3; i++) V0[s2][n][i] = ok ? clamp((c0[i] - a.qp[s2][n][i]) / a.qdt, -VMAX, VMAX) : 0;
        }));
        a.blD = BLT + 0.25 * mA / PI + 0.5 * Math.min(1, Math.abs(a.qs.drop - q.drop) / 0.6);
      }
      a.bk = key;
      if (a.blOn && !a.freeze) {
        a.blT += dt; const k = sst(0, a.blD || BLT, a.blT), B0 = a.qb, V0 = a.qv, ex = VT * (1 - Math.exp(-a.blT / VT));
        if (k >= 1) a.blOn = false;
        else {
          QK.forEach(n => { q[n] = lerp(B0[n] + V0[n] * ex, q[n], k); });
          ['L', 'R'].forEach(s2 => {
            const A2 = q[s2], C2 = B0[s2], W2 = V0[s2];
            QA.forEach(n => { const c = C2[n], w = W2[n]; slerpV([c[0] + w[0] * ex, c[1] + w[1] * ex, c[2] + w[2] * ex], A2[n], k); });
            if (A2.palm && C2.palm) for (let i = 0; i < 3; i++) A2.palm[i] = lerp(C2.palm[i], A2.palm[i], k); else if (k < 0.5) A2.palm = C2.palm ? C2.palm.slice() : null;
            QS.forEach(n => { A2[n] = lerp(C2[n], A2[n] || 0, k); });
          });
          // смешанные углы ног длиннее прямой линии между позами — таз не ниже, чем позволяют ноги (сапоги не в землю)
          q.drop = Math.min(q.drop, Math.max(0, q.y + 1 - Math.max(legV(q.lx, q.lk), legV(q.rx, q.rk))));
        }
      }
      // два последних показанных кадра (для скорости позы в миг следующей смены)
      const qo = a.qp; a.qp = a.qs || null; a.qs = qCopy(qo || {}, q); a.qdt = dt;
    }
    const _bw = new T.Vector3(), _bh = new T.Vector3();
    function prankPose(a, q, t) {
      const P = st.prank, ph = P ? P.phase : ''; q.whip = 'tuck';
      // левая рука тянется к берету героини (точка в осях груди)
      const reachTo = (k) => {
        // (от того, где рука в позе сейчас: при возврате берета — от поклона; k = 0 — рука поклона, без рывка в конце)
        if (!P || !P.head) return;
        _bw.copy(P.head).applyMatrix4(stage.matrixWorld); a.B.chest.updateWorldMatrix(true, false); a.B.chest.worldToLocal(_bw);
        _bw.x -= PH.shX; _bw.y -= PH.shY - PH.waist; _bw.normalize();
        armTo(q, 1, [[_bw.x + 0.15, _bw.y + 0.35, _bw.z], [_bw.x, _bw.y - 0.25, _bw.z], [0, -1, 0], 0, 0.6], k);
        q.lean = 0.32 * k;
      };
      // (взял — рука остаётся у берета: время этапа начинается заново, и прежний reachTo(sst(0, 0.5, P.t)) опускал кисть к груди)
      if (ph === 'reach') reachTo(sst(0, 0.5, P.t));
      else if (ph === 'take') { reachTo(1); q.L.curl = 0.6 * sst(0, 0.3, P.t); }
      else if (ph === 'show') { arm(q, 1, [0.25, 1, 0.05], [0.1, 1, 0.05], [0, 0, 1], 0.7); arm(q, -1, [0.8, -0.3, 0.3], [0.6, 0.5, 0.4], [0, 0, 1], 0, 1); q.y = Math.abs(Math.sin(t * 8)) * 0.07; q.twist = Math.sin(t * 4) * 0.35; leg(q, 1, Math.sin(t * 8) * 0.25, 0.4 * Math.max(0, Math.sin(t * 8))); }
      else if (ph === 'return') { const kb = sst(0.5, 1.0, P.t); bowPose(q, kb * 0.6); reachTo(1 - kb); q.lean = Math.max(q.lean, 0.51 * kb); q.L.curl = 0.6; }
      else if (ph === 'bow') bowPose(q, Math.sin(clamp(P.t / 1.2, 0, 1) * PI));
      else if (ph === 'jingle') { setArm(q, 1, AP.out); setArm(q, -1, AP.out); q.side = Math.sin(t * 16) * 0.12; q.y = Math.abs(Math.sin(t * 8)) * 0.05; }
      // идёт за героиней с беретом в руке — ногами, а не скользит в позе; шаг включается плавно по сглаженной скорости (порог по
      // скорости за кадр переключал ноги рывком — ступни прыгали на 0,2–0,3 м)
      const g = ph === 'jingle' ? 0 : sst(0.1, 0.45, a.velS || 0);
      if (g > 0.01) { const l0 = [q.lx, q.lk, q.rx, q.rk]; gaitLegs(a, q, Math.min(1, (a.velS || 0) / 0.9)); q.lx = lerp(l0[0], q.lx, g); q.lk = lerp(l0[1], q.lk, g); q.rx = lerp(l0[2], q.rx, g); q.rk = lerp(l0[3], q.rk, g); }
    }
    // берет-копия: с головы героини в левую руку ряженого и обратно — по кисти, какой её видно в кадре (после перетекания поз;
    // по позе до перетекания копия прыгала на метр в начале показа и возврата)
    function prankBeret(a, t) {
      const P = st.prank; if (!beretMesh || !P || P.a !== a) return;
      const ph = P.phase;
      a.B.fingL.updateWorldMatrix(true, false); a.B.fingL.getWorldPosition(_bh); _bh.y += 0.02;
      const head = P.head ? _bw.copy(P.head).applyMatrix4(stage.matrixWorld) : _bh;
      // взял — с головы в кисть (рука уже у берета); вернул — в кисти, пока рука не дойдёт до её головы, потом на голову (раньше
      // берет летел дугой на 0,25 м над кистью, стоявшей у головы)
      let k = -1;
      if (ph === 'take') k = sst(0, 0.45, P.t); else if (ph === 'show') k = 1; else if (ph === 'return') k = 1 - sst(0.25, 0.55, P.t);
      beretMesh.visible = k >= 0 && !!P.hid;
      if (beretMesh.visible) { beretMesh.position.lerpVectors(head, _bh, k); beretMesh.position.y += Math.sin(k * PI) * 0.04; beretMesh.rotation.set(0.25 * Math.sin(t * 6) * k, A.ry + a.pry, 0.1 * k); }
    }
    function setPhase(ph) { const P = st.prank; P.phase = ph; P.t = 0; }
    function startPrank() {
      if (st.prank || !pal.length || pal.some(b => b.hold)) return false;
      const hl = heroLocal(); if (!hl) return false;
      const cand = pal.filter(b => !b.listen && !b.freeze && !(b.npc && b.npc.faceHero > 3) && st.t > (b.talkT || 0));
      if (!cand.length) return false;
      const a = cand.sort((p, q) => Math.hypot(p.px - hl.x, p.pz - hl.z) - Math.hypot(q.px - hl.x, q.pz - hl.z))[0];
      const kazOn = !!(V.kaz && V.kaz.isWorn && V.kaz.isWorn());
      const kind = st.hero && !kazOn && V.kaz && V.kaz.hideBeret ? 'beret' : 'jingle';
      if (a.mode === 'fight' && a.fight) { const F = a.fight, o = F.a0 === a ? F.a1 : F.a0; a.fight = null; if (o.mode === 'fight') palStart(o, 'walk'); }
      if (ACTS[a.mode] && ACTS[a.mode].end) ACTS[a.mode].end(a);
      // сторона, с которой подойти к героине: ближняя к ряженому, но где никто не стоит (иначе он топчется вокруг занятого места)
      // и не на самой дорожке хоровода (героиня встала в круг — танцоры идут через это место и отталкивают ряженого)
      const sideFree = an => { const x = hl.x + Math.sin(an) * 0.72, z = hl.z + Math.cos(an) * 0.72; return !(st.obs || []).some(o => o[3] !== a && o[3] !== 'hero' && Math.hypot(o[0] - x, o[1] - z) < o[2] + 0.45) && !inCollider(x, z, 0.3) && (dance.active || Math.abs(Math.hypot(x - RC[0], z - RC[1]) - R0) > 0.6); };
      let side = Math.atan2(a.px - hl.x, a.pz - hl.z);
      for (const d of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, PI]) if (sideFree(side + d)) { side += d; break; }
      st.prank = { a, kind, phase: 'approach', t: 0, T: 0, side, hid: false };
      a.mode = 'approach';
      prankEmit({ type: kind, phase: 'start', who: a.id, text: '' });
      return true;
    }
    // silent — розыгрыш отложен (берет не трогали): без облачков, через 8 с — заново; quiet — без облачков (героиня в разговоре)
    function endPrank(silent) {
      const P = st.prank; if (!P) return;
      if (P.hid && V.kaz) V.kaz.hideBeret(st.hero, false);
      if (beretMesh) beretMesh.visible = false;
      st.prank = null; st.heroReactT = st.t + 6; P.a.r1T = st.t + 0.6; palStart(P.a, 'walk');
      if (silent) { st.prankDone = false; st.prankRetryT = st.t + 8; } else st.prankDone = true;
      const q = !!(silent || P.quiet);
      // в конце — без облачка ряженого («Шучу-шучу, держи!» уже было, когда взял берет): отвечает героиня
      prankEmit({ type: P.kind, phase: 'end', who: P.a.id, text: '', quiet: q });
    }
    // круг: равные промежутки; во время танца героини — «окошко» для неё
    function updateRing(t, dt) {
      if (!dance.active) st.a0 += st.spin * dt;
      const n = ring.length;
      ring.forEach((a, i) => {
        let ang;
        if (dance.active) ang = dance.ang + (i + 1) / (n + 1) * TAU;
        else ang = st.a0 + i / n * TAU;
        a.angT = ang; a.ang += angW(a.angT - a.ang) * Math.min(1, dt * (dance.active ? 3 : 8));
        const x = RC[0] + Math.sin(a.ang) * R0, z = RC[1] + Math.cos(a.ang) * R0;
        a.B.root.position.x = x; a.B.root.position.z = z;
        // лицом к центру, с поворотом по ходу круга
        a.B.root.rotation.y = a.ang + PI + Math.sin(st.t / BEAT * PI * 0.25 + i) * 0.5;
      });
    }
    function updateCandy(dt) {
      if (candy.t < 0) return;
      candy.t += dt;
      const P = candy.pos, Vv = candy.vel;
      let alive = 0, sweets = 0;
      for (let i = 0; i < NPT; i++) {
        if (candy.life[i] <= 0) continue;
        candy.life[i] -= dt; alive++;
        if (i >= NCANDY) { const dr = Math.max(0, 1 - dt * 3); Vv[i * 3] *= dr; Vv[i * 3 + 1] = Vv[i * 3 + 1] * dr - 0.6 * dt; Vv[i * 3 + 2] *= dr; P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt; }
        else { sweets++; if (P[i * 3 + 1] > 0.05) { Vv[i * 3 + 1] -= 6.5 * dt; P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt; if (P[i * 3 + 1] < 0.05) P[i * 3 + 1] = 0.05; } }
        if (candy.life[i] <= 0) P[i * 3 + 1] = -5;
      }
      candyGeo.attributes.position.needsUpdate = true;
      candyPts.visible = alive > 0 && st.lod === 0;
      if (!sweets) st.shower = -1;
      if (!alive) candy.t = -1;
    }
    function shower() {
      for (let i = 0; i < NCANDY; i++) {
        candy.pos[i * 3] = dais.x + (R2() - 0.5) * 0.6; candy.pos[i * 3 + 1] = 1.6 + R2() * 0.3; candy.pos[i * 3 + 2] = dais.z + 0.1;
        const a = R2() * TAU, sp = 0.8 + R2() * 1.6; candy.vel[i * 3] = Math.sin(a) * sp; candy.vel[i * 3 + 1] = 2 + R2() * 2.2; candy.vel[i * 3 + 2] = Math.abs(Math.cos(a)) * sp + 0.4;
        candy.life[i] = 3.5 + R2() * 1.5;
      }
      candy.t = 0; st.shower = 0; candyPts.visible = true;
      emit('shower', { text: pick(EV.shower, named).text });
    }

    /* --- мини-игра «в такт» --- */
    const dance = {
      active: false, t: 0, dur: 12, bpm: BPM, combo: 0, hits: 0, misses: 0, perfect: 0, beats: 0, lastBeat: -1, ang: 0, slot: null, on: null, result: null, tapped: new Set(),
      start() {
        if (this.active) return { slot: this.slot, dur: this.dur, bpm: this.bpm };
        const hl = heroLocal();
        this.ang = hl ? Math.atan2(hl.x - RC[0], hl.z - RC[1]) : st.a0;
        const x = RC[0] + Math.sin(this.ang) * R0, z = RC[1] + Math.cos(this.ang) * R0, w = toW(x, z);
        this.slot = { x: w.x, y: w.y, z: w.z, ry: A.ry + this.ang + PI };
        if (st.prank) endPrank();
        this.active = true; this.t = 0; this.combo = 0; this.hits = 0; this.misses = 0; this.perfect = 0; this.beats = 0; this.result = null; this.tapped = new Set();
        st.beatClap = true;
        this.fire({ type: 'start', text: pick(EV.danceStart, named).text, who: 'wed_drum', slot: this.slot, dur: this.dur, bpm: this.bpm });
        return { slot: this.slot, dur: this.dur, bpm: this.bpm };
      },
      // нажатие: ближайший удар (каждые BEAT с) — точно ±0,1 с, хорошо ±0,2 с
      tap() {
        if (!this.active) return { grade: 'none' };
        const ph = this.t / BEAT, k = Math.round(ph), d = Math.abs(ph - k) * BEAT;
        let grade = 'miss';
        if (!this.tapped.has(k)) { if (d <= 0.1) grade = 'perfect'; else if (d <= 0.2) grade = 'good'; }
        if (grade !== 'miss') { this.tapped.add(k); this.hits++; this.combo++; if (grade === 'perfect') this.perfect++; } else { this.combo = 0; this.misses++; }
        const res = { grade, combo: this.combo, text: grade === 'perfect' ? 'Хоп!' : grade === 'good' ? 'Так!' : '' };
        this.fire(Object.assign({ type: 'hit' }, res));
        return res;
      },
      stop() { if (!this.active) return null; return this.finish(); },
      finish() {
        this.active = false; st.beatClap = false;
        // точность: попадания минус половина лишних нажатий (стучать без остановки не выгодно)
        const acc = this.beats ? Math.max(0, (this.hits - 0.5 * this.misses) / this.beats) : 0;
        this.result = { hits: this.hits, misses: this.misses, beats: this.beats, perfect: this.perfect, acc: +acc.toFixed(2), text: pick(acc >= 0.5 ? EV.danceGood : EV.danceOk, named).text };
        this.fire(Object.assign({ type: 'end' }, this.result));
        return this.result;
      },
      update(dt) {
        if (!this.active) return;
        this.t += dt;
        const k = Math.floor(this.t / BEAT);
        if (k !== this.lastBeat) { this.lastBeat = k; this.beats++; this.fire({ type: 'beat', n: k }); }
        if (this.t >= this.dur) this.finish();
      },
      fire(ev) { if (this.on) { try { this.on(ev); } catch (e) { /* интерфейс — не наш */ } } },
    };

    /* --- действия на местах --- */
    const TREATS = ['chudu', 'apple', 'grapes', 'pear'];
    let treatN = 0;
    function act(id, ctx) {
      ctx = ctx || {};
      if (id === 'wedding_treat') {
        const item = TREATS[treatN++ % TREATS.length];
        const pl = item === 'chudu' ? plates.chuduE : plates.fruitEndE || plates.chuduE;
        const from = pl ? toW(pl[0], pl[2], pl[1]) : toW(tableX, 0, 0.8);
        const sp = toW(tableX, tableL / 2 + 0.32);
        return { kind: 'treat', interact: 'take', item, from, stand: [sp.x, sp.y, sp.z, A.ry + PI], text: pick(EV.treat[item], named).text, label: 'Угоститься' };
      }
      if (id === 'wedding_dance') { const r = dance.start(); return { kind: 'dance', slot: r.slot, dur: r.dur, bpm: r.bpm, text: pick(EV.danceStart, named).text, who: 'wed_drum' }; }
      if (id === 'wedding_congrats') {
        st.congrats = 0; shower();
        const rep = pick(EV.congratsReply, named);
        return { kind: 'congrats', text: pick(EV.congrats, named).text, reply: { who: rep.who, name: SPEAKERS.wed_bride.name, text: rep.text, npc: 'wed_bride' } };
      }
      return null;
    }
    spots.forEach(sp => { sp.use = ctx => act(sp.id, ctx); });

    /* --- ночь: фонарики и угли --- */
    function setNight(k) {
      st.night = clamp(k, 0, 1);
      if (!meshLit) return;
      const C2 = meshLit.geometry.attributes.color, per = C2.count / lit.length;
      lit.forEach((l, i) => { const day = l.coal ? hex('#8A5A4A') : hex('#F6EEDC'), nt = hex(l.c); for (let v = 0; v < per; v++) { const j = i * per + v; C2.setXYZ(j, lerp(day[0], nt[0] * 1.15, st.night), lerp(day[1], nt[1] * 1.1, st.night), lerp(day[2], nt[2], st.night)); } });
      C2.needsUpdate = true;
    }
    setNight(o.night ? 1 : 0);

    /* --- кадр --- */
    const _cam = new T.Vector3();
    function update(dt, heroPos, cam) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      st.t += dt; const t = st.t;
      st.heroPos = heroPos || null;
      // LOD: по камере (если дали) и по героине
      const cw = toW(0, 0);
      let d = heroPos ? Math.hypot(heroPos.x - cw.x, heroPos.z - cw.z) : 0;
      if (cam && cam.position) { _cam.copy(cam.position); d = Math.min(d || 1e9, Math.hypot(_cam.x - cw.x, _cam.y - cw.y, _cam.z - cw.z)); }
      st.lod = d < 30 ? 0 : d < 75 ? 1 : 2;
      const showCrowd = st.lod < 2;
      crowd.forEach(m => { m.visible = showCrowd; });
      if (meshOl) meshOl.visible = st.lod === 0;
      if (meshFace) meshFace.visible = st.lod === 0;
      candyPts.visible = candyPts.visible && st.lod === 0;
      if (meshCloth) meshCloth.visible = st.lod < 2;
      // гирлянда в 3 м от камеры (камера за спиной героини над галереей) — прячем: флажки у самого объектива закрывали четверть экрана
      if (flagMeshes.length && cam && cam.position) { _inv.copy(stage.matrixWorld).invert(); const lc = _cam.copy(cam.position).applyMatrix4(_inv); flagMeshes.forEach(m => { const f = m.userData.flag; m.visible = st.lod < 2 && !(Math.abs(lc.z - f.z) < 3.2 && Math.abs(lc.x) < HW + 2.5 && lc.y > f.h - 2.4 && lc.y < f.h + 3.0); }); }
      st.camL = cam && cam.position ? (_inv.copy(stage.matrixWorld).invert(), (st._cl || (st._cl = new T.Vector3())).copy(cam.position).applyMatrix4(_inv)) : null;
      // героиня во дворе — розыгрыш один раз за визит (через 6 с)
      if (heroPos) {
        const hl = heroLocal(), inYard = hl && Math.abs(hl.x) < HW + 0.5 && Math.abs(hl.z) < HD + 0.5;
        st.heroIn = inYard ? st.heroIn + dt : 0;
        if (!inYard && d > 25) { st.prankDone = false; st.whipShown = false; }
        // не во время разговора с кем-то из двора и не поверх приветствия, «Бу-у!» или фото с героиней — подождёт
        const talking = heroTalking(), reacting = pal.some(b => b.mode === 'wave' || (b.mode === 'boo' && b.booHero) || (b.mode === 'selfie' && b.withHero));
        // после любого разговора (окно диалога закрылось) — 6 с без розыгрыша: реакции не громоздятся
        if (talking) st.talkEndT = st.t;
        if (inYard && st.heroIn > 6 && !st.prankDone && !st.prank && !dance.active && !talking && !reacting && st.t > (st.prankRetryT || 0) && st.t > (st.heroReactT || 0) && st.t > (st.talkEndT === undefined ? -1 : st.talkEndT + 6)) startPrank();
      }
      if (!showCrowd) return;
      const beatN = Math.floor(t / BEAT); if (beatN !== st.beatN) { st.beatN = beatN; if (st.lod === 0) emit('beat', { n: beatN }); }
      if (st.congrats >= 0) { st.congrats += dt; if (st.congrats > 2.6) st.congrats = -1; }
      if (st.shower >= 0) st.shower += dt;
      // каждые ~40 с — сладости над невестой (сами, без героини)
      if (!st.nextShower) st.nextShower = 25;
      if (t > st.nextShower) { st.nextShower = t + 40 + R2() * 15; if (st.shower < 0) shower(); }
      dance.update(dt);
      updateRing(t, dt);
      updatePaltars(t, dt);
      pal.forEach(a => { a.B.root.position.x = a.px; a.B.root.position.z = a.pz; a.B.root.rotation.y = a.pry; });
      kids.forEach(a => {
        let tx = a.home[0], tz = a.home[1], spd = 1.2;
        const ks = a.ks; ks.t += dt;
        // догонялки: бежит по своему кружку; «селфи» — стоит лицом к «камере»; радуется 2 с и идёт домой
        if (ks.mode === 'flee') { ks.ang += 1.75 / a.loopR * dt; tx = a.loopC[0] + Math.sin(ks.ang) * a.loopR; tz = a.loopC[1] + Math.cos(ks.ang) * a.loopR; spd = 2.2; if (ks.t > 9) ks.mode = null; }
        else if (ks.mode === 'pose') { tx = a.px; tz = a.pz; a.pry += angW((ks.face || 0) - a.pry) * Math.min(1, dt * 5); if (ks.t > 6) ks.mode = null; }
        else if (ks.mode === 'cheer') { tx = a.px; tz = a.pz; if (ks.t > 2) ks.mode = null; }
        else if (st.shower >= 0) { tx = dais.x + Math.sin(t * 1.3 + a.idx * 2) * 1.2; tz = dais.z + 1.6 + Math.cos(t * 1.1 + a.idx) * 0.5; }
        const dx = tx - a.px, dz = tz - a.pz, dd = Math.hypot(dx, dz);
        if (dd > 0.05) { const v = Math.min(dd, spd * dt); a.px += dx / dd * v; a.pz += dz / dd * v; a.pry += angW(Math.atan2(dx, dz) - a.pry) * Math.min(1, dt * 5); }
        // дети обегают ряженых (кроме фото — там ряженый стоит рядом нарочно)
        if (ks.mode !== 'pose') pal.forEach(p => { const ex = a.px - p.px, ez = a.pz - p.pz, e = Math.hypot(ex, ez); if (e < 0.78 && e > 1e-3) { const mv = Math.min(0.78 - e, 1.8 * dt); a.px += ex / e * mv; a.pz += ez / e * mv; } });
        a.B.root.position.x = a.px; a.B.root.position.z = a.pz; a.B.root.rotation.y = a.pry;
      });
      animals.forEach(a => {
        pose(a, t, dt);
        a.blinkT -= dt;
        if (a.blinkT <= 0) { a.closed = !a.closed; BL.value[a.idx] = a.closed ? 1 : 0; a.blinkT = a.closed ? 0.13 : 2 + R2() * 3; }
      });
      updateCandy(dt);
      // пустышки собеседников — над своими зверятами (мировые оси)
      npcs.forEach(n => { const a = n.animal, w = toW(a.B.root.position.x, a.B.root.position.z); n.root.position.set(w.x, A.y + a.B.root.position.y, w.z); n.x = w.x; n.z = w.z; });
    }

    // первый кадр: поза покоя → круг на местах
    update(0.016, null, null);
    stage.updateMatrixWorld(true);

    let tris = 0; [meshBody, meshOl, meshTex, meshFace, meshProps, meshCloth, meshLit, ...flagMeshes].forEach(m => { if (m) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
    const h = {
      group, stage, npcs, spots, colliders: worldCol, update, act, dance, setNight,
      onPrank(cb) { if (typeof cb === 'function') prankCbs.push(cb); return h; },
      onEvent(cb) { (st.evCb || (st.evCb = [])).push(cb); return h; },
      setHero(hero, anim) { st.hero = hero || null; st.heroAnim = anim || (hero && hero.rig ? hero.rig.anim : null); return h; },
      // регион: fn() → true, пока героиня занята (окно диалога, шторка, угощение) — возгласы ряженых молчат, розыгрыш ждёт
      setBusy(fn) { st.busyFn = typeof fn === 'function' ? fn : null; return h; },
      prank() { st.prankDone = false; return startPrank(); },
      // W5: пальтар возится с героиней («Бум!» понарошку) — не ходит по маршруту и не начинает розыгрыш; id — npc.id / id зверька / npc
      paltarHold(idOrNpc, on) {
        const n = typeof idOrNpc === 'object' && idOrNpc ? idOrNpc : npcs.find(q => q.id === idOrNpc || (q.animal && q.animal.id === idOrNpc));
        const a = n && n.animal; if (!a || a.role !== 'paltar') return false;
        a.hold = !!on; if (on && st.prank && st.prank.a === a) endPrank();
        if (on && a.mode !== 'hold') { if (a.mode === 'fight' && a.fight) { const F = a.fight, o2 = F.a0 === a ? F.a1 : F.a0; if (o2.mode === 'fight') palStart(o2, 'walk'); } if (ACTS[a.mode] && ACTS[a.mode].end) ACTS[a.mode].end(a); a.mode = 'hold'; }
        return true;
      },
      // сдвинуть зверька двора (отлёт при кувырке, «вежливое расстояние»): мир → оси двора; в пределах двора
      moveNpc(n, dx, dz) {
        const a = n && n.animal; if (!a) return false;
        const c = Math.cos(A.ry), s2 = Math.sin(A.ry), lx = dx * c - dz * s2, lz = dx * s2 + dz * c;
        if (a.px === undefined) { a.px = a.x; a.pz = a.z; }
        a.px = clamp(a.px + lx, -HW + 0.6, HW - 0.6); a.pz = clamp(a.pz + lz, -HD + 0.6, HD - 0.6);
        if (a.role !== 'paltar' && a.role !== 'kid') { a.x = a.px; a.z = a.pz; a.B.root.position.x = a.px; a.B.root.position.z = a.pz; }
        return true;
      },
      stopPrank() { if (st.prank) { endPrank(); return true; } return false; },
      // для стенда и снимков: застывшая поза ряженого (name — выступление, t — время в нём; o — x, z, ry, данные номера); name = null — отпустить
      paltarPose(id, name, t, o) {
        const a = pal.find(b => b.id === id || (b.npc && b.npc.id === id)); if (!a) return false;
        if (!name) { a.freeze = null; palStart(a, 'walk'); return true; }
        o = o || {}; a.freeze = { name, t: t || 0, vel: o.vel || 0 };
        if (o.x !== undefined) { a.px = o.x; a.pz = o.z; } if (o.ry !== undefined) a.pry = o.ry;
        ['tgt', 'kid', 'wdir', 'fight', 'fside', 'sfFace', 'sfTilt', 'gph', 'jh', 'actDur', 'withHero', 'photo'].forEach(k => { if (o[k] !== undefined) a[k] = o[k]; });
        return true;
      },
      get lod() { return st.lod; },
      // для стенда: внутренности (зверята, ряженые, дети, состояние)
      dbg() { return { animals, pal, kids, st, PG, PV, trisBy }; },
      get paltars() { return pal.map(a => ({ id: a.id, mode: a.mode, x: +a.px.toFixed(2), z: +a.pz.toFixed(2), ry: +a.pry.toFixed(2), seg: a.seg })); },
      get prankState() { return st.prank ? { kind: st.prank.kind, phase: st.prank.phase, who: st.prank.a.id } : null; },
      animals: animals.map(a => ({ id: a.id, role: a.role, sp: a.variant ? 'paltar:' + a.variant : a.spec.sp, bone: a.B.root })),
      speakers: SPEAKERS, lines: LINES, events: EV,
      info: { calls: [meshBody, meshOl, meshTex, meshFace, meshProps, meshCloth, meshLit, candyPts, ...flagMeshes].filter(Boolean).length, tris: Math.round(tris), animals: animals.length, bones: bones.length, buildMs: Math.round(performance.now() - t0), paintMs },
      dispose() {
        if (st.prank) endPrank();
        if (group.parent) group.parent.remove(group);
        crowd.forEach(m => { if (m.skeleton) m.skeleton.dispose(); });
        own.forEach(x => { try { x.dispose && x.dispose(); } catch (e) { /* уже */ } });
        if (meshProps) meshProps.geometry.dispose(); flagMeshes.forEach(m => m.geometry.dispose());
        if (beretMesh) beretMesh.geometry.dispose();
        prankCbs.length = 0; if (st.evCb) st.evCb.length = 0;
      },
    };
    return h;
  }

  V.wedding = { build, SPEAKERS, LINES, EVENTS: EV };
})();
