/* =====================================================================
   СВАДЬБА ВО ДВОРЕ (волна 4): праздник двух жителей-зверят, героиня — приглашённая на праздник.
   Факты — plan2/kubachi_spec2.md §2 (пальтары), §4 (свадьба): три дня, под открытым небом, живая музыка (зурна и
   барабан), круг танца, общий стол (чуду, пельмени, плов в казане, фрукты, мёд, сладости), невесту осыпают
   сладостями, пальтары — на 2-й и 3-й день (войлочная маска с белым узором и шерстяными усами, кольчуга поверх белой
   рубахи, колокольчики). Только праздничные народные элементы: без обрядов, без денег в танце, без чая и вина,
   без оружия и плёток. Героиню не ставят на место невесты, ей ничего «свадебного» не дарят.

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
     h.onEvent(cb) — { type:'beat'|'shower'|'bell'|'prank' } — для звука; h.setNight(k 0..1) — гирлянды-фонарики светят
     h.info       — { calls, tris, animals, bones }; h.lod — 0 близко / 1 средне / 2 далеко; h.dispose()
   Бюджет: ≤ 40 вызовов и ≤ 60 тыс. треугольников на всю сцену. Все зверята — ОДНА сетка со скелетом (SkinnedMesh) +
   контур + лица (атлас) + «ткани» (маски, кольчуги, платки — атлас): 4 вызова на 21 зверька. Реквизит — 2 сетки.
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
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
      L('paltar', 'Кольчуга — как настоящая! Для свадеб их снова плетут.'), L('paltar', 'Давным-давно мы стерегли крепость. А теперь — веселим свадьбу!')],
  };
  const EV = {
    prankBeret: L('paltar', 'Ой, чей это берет? Шучу-шучу, держи!'),
    prankJingle: L('paltar', 'Звяк-звяк! Это я так здороваюсь!'),
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
     АТЛАС 1024×1024 (canvas): лица зверят (верх, клетки 128), маска пальтара, кольчуга, «борода», ковёр, дорожка, платок
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
  // клетка лица k: открытые глаза — (2k mod 8, ...), закрытые — соседняя справа
  const faceCell = k => { const c = (k * 2) % 8, r = Math.floor(k * 2 / 8); return { u0: c * 0.125, v0: 1 - (r + 1) * 0.125 }; };
  function paintAtlas(faceCanvas) {
    const [cv, c] = cnv(1024, 1024);
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 1024, 1024);
    FACE_KEYS.forEach((k, i) => {
      const cc = (i * 2) % 8, rr = Math.floor(i * 2 / 8);
      [false, true].forEach((closed, j) => { const f = faceCanvas(FACE[k], closed); c.drawImage(f, (cc + j) * 128, rr * 128, 128, 128); });
    });
    // --- маска пальтара (256×512, x 0..256, y 512..1024): тёмный войлок, белые дуги вокруг глаз, нос-полоса, полосы сзади ---
    c.save(); c.beginPath(); c.rect(0, 512, 256, 512); c.clip();
    c.fillStyle = '#4A3E44'; c.fillRect(0, 512, 256, 512);
    // ворс войлока
    const R = rng(77); c.globalAlpha = 0.08; for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.5 ? '#FFFFFF' : '#000000'; c.fillRect(R() * 256, 512 + R() * 512, 1 + R() * 2, 1 + R() * 3); } c.globalAlpha = 1;
    const W2 = '#F6F1E6';
    c.lineCap = 'round'; c.lineJoin = 'round';
    // сзади и по бокам — горизонтальные дуги-полосы (u у краёв клетки)
    c.strokeStyle = W2; c.lineWidth = 9;
    for (let y = 560; y < 1010; y += 34) { c.beginPath(); c.moveTo(-10, y); c.quadraticCurveTo(30, y - 14, 70, y); c.stroke(); c.beginPath(); c.moveTo(186, y); c.quadraticCurveTo(226, y - 14, 266, y); c.stroke(); }
    // лоб — дуги над глазами (центр лица — x = 128, глаза на высоте y ≈ 840)
    const ey = 842, ex = 30;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(128, ey - 10, 64 + k * 22, PI * 1.12, PI * 1.88); c.stroke(); }
    // кольца вокруг глаз (концентрические)
    [-1, 1].forEach(s => { [36, 24].forEach((r, q) => { c.lineWidth = q ? 6 : 8; c.beginPath(); c.arc(128 + s * ex, ey, r, 0, TAU); c.stroke(); }); });
    // нос-полоса и щёки
    c.lineWidth = 9; c.beginPath(); c.moveTo(128, ey - 70); c.lineTo(128, ey + 40); c.stroke();
    [-1, 1].forEach(s => { c.beginPath(); c.arc(128 + s * 18, ey + 64, 46, s > 0 ? PI * 1.55 : PI * 0.95, s > 0 ? PI * 2.05 : PI * 1.45); c.stroke(); });
    // глазницы: внутри — мех и добрые круглые глаза с бликом, под ними румянец
    [-1, 1].forEach(s => {
      const x = 128 + s * ex;
      c.fillStyle = '#EADBC8'; c.beginPath(); c.arc(x, ey, 17, 0, TAU); c.fill();
      c.fillStyle = '#2E2A3B'; c.beginPath(); c.ellipse(x, ey + 1, 9.5, 12, 0, 0, TAU); c.fill();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x + 3.5, ey - 4, 3.6, 0, TAU); c.fill();
      c.fillStyle = 'rgba(245,154,174,0.65)'; c.beginPath(); c.ellipse(x + s * 6, ey + 30, 9, 5, 0, 0, TAU); c.fill();
    });
    // ротик-улыбка в прорези (под носом-пуговкой: на маске нос — на высоте y ≈ 944)
    c.fillStyle = '#EADBC8'; c.beginPath(); c.ellipse(128, 982, 22, 13, 0, 0, TAU); c.fill();
    c.strokeStyle = '#B5546A'; c.lineWidth = 4; c.beginPath(); c.moveTo(113, 978); c.quadraticCurveTo(128, 994, 143, 978); c.stroke();
    c.fillStyle = '#F29AAE'; c.beginPath(); c.ellipse(128, 987, 6, 3.5, 0, 0, TAU); c.fill();
    // макушка — белый «гребень»
    c.strokeStyle = W2; c.lineWidth = 8; c.beginPath(); c.moveTo(128, 520); c.lineTo(128, 690); c.stroke();
    c.restore();
    // --- кольчуга (x 256..512, y 512..1024): серебристые колечки рядами со сдвигом ---
    c.save(); c.beginPath(); c.rect(256, 512, 256, 512); c.clip();
    c.fillStyle = '#6E7076'; c.fillRect(256, 512, 256, 512);
    for (let r = 0; r < 34; r++) for (let q = 0; q < 17; q++) {
      const x = 256 + q * 16 + (r % 2) * 8, y = 512 + r * 15 + 7;
      c.strokeStyle = '#B9BDC4'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 6.5, 0, TAU); c.stroke();
      c.strokeStyle = '#EEF0F4'; c.lineWidth = 2; c.beginPath(); c.arc(x - 1, y - 1, 5.6, PI * 1.05, PI * 1.75); c.stroke();
    }
    c.restore();
    // --- «борода» маски (x 512..768, y 512..768): тёмная лента с белыми шевронами и белой каймой ---
    c.save(); c.beginPath(); c.rect(512, 512, 256, 256); c.clip();
    c.fillStyle = '#F6F1E6'; c.fillRect(512, 512, 256, 256);
    c.fillStyle = '#4A3E44'; c.fillRect(530, 512, 220, 256);
    c.strokeStyle = '#F6F1E6'; c.lineWidth = 10; c.lineJoin = 'round';
    for (let y = 540; y < 770; y += 44) { c.beginPath(); c.moveTo(552, y); c.lineTo(640, y + 30); c.lineTo(728, y); c.stroke(); }
    c.restore();
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
    return cv;
  }
  // прямоугольники атласа (u0, v0, du, dv) — v от низа текстуры (flipY)
  const UVR = { mask: [0, 0, 0.25, 0.5], mail: [0.25, 0, 0.25, 0.5], beard: [0.5, 0.25, 0.25, 0.25], carpet: [0.5, 0, 0.25, 0.25], runner: [0.75, 0.25, 0.25, 0.25], scarf: [0.75, 0, 0.25, 0.25] };

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
      const g = p.geo, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, n = pa.count;
      nm.getNormalMatrix(p.m);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(p.m); P[(ov + i) * 3] = v.x; P[(ov + i) * 3 + 1] = v.y; P[(ov + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(ov + i) * 3] = v.x; N[(ov + i) * 3 + 1] = v.y; N[(ov + i) * 3 + 2] = v.z;
        const col = p.col || [1, 1, 1]; Cc[(ov + i) * 3] = col[0]; Cc[(ov + i) * 3 + 1] = col[1]; Cc[(ov + i) * 3 + 2] = col[2];
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

    // общие материалы
    let GRAD = K && K.GRAD;
    if (!GRAD) { const d = new Uint8Array(64); [100, 100, 100, 104, 128, 160, 166, 168, 176, 212, 236, 244, 255, 255, 255, 255].forEach((v, i) => d.set([v, v, v, 255], i * 4)); GRAD = keep(new T.DataTexture(d, 16, 1, T.RGBAFormat)); GRAD.minFilter = GRAD.magFilter = T.LinearFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true; }
    const rim = m => (K && K.addRim ? K.addRim(m, 1) : m);
    const faceCanvas = (K && K.faceCanvas) || VK.faceCanvas;
    const atlasTex = keep(new T.CanvasTexture(paintAtlas(faceCanvas)));
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
    // капюшон-маска пальтара: высокий, заострённый, лицо — спереди (u = 0,5)
    const maskGeo = keep(new T.LatheGeometry([[0.2, -0.16], [0.235, -0.04], [0.25, 0.08], [0.235, 0.2], [0.19, 0.32], [0.13, 0.43], [0.07, 0.52], [0.02, 0.6], [0.001, 0.62]].map(p => new T.Vector2(p[0], p[1])), 14, PI, TAU));
    // фартук-«борода» маски и кольчуга-рубаха
    const beardGeo = keep(new T.PlaneGeometry(0.2, 0.34, 1, 3));
    const mailGeo = keep(new T.CylinderGeometry(0.25, 0.32, 0.5, 14, 1, true));

    /* --- зверята --- */
    const bones = [], animals = [], partsBody = [], partsOl = [], partsFace = [], partsTex = [];
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), VP = new T.Vector3(), VS = new T.Vector3();
    const C = h => (Array.isArray(h) ? h : hex(h));
    function makeAnimal(spec) {
      const a = { spec, id: spec.id, role: spec.role, x: spec.x, z: spec.z, ry: spec.ry || 0, scale: spec.scale || 1.15, ph: Math.random() * 6, blinkT: 1 + Math.random() * 3, idx: animals.length, look: 0 };
      const sc = a.scale, rootM = new T.Matrix4().compose(new T.Vector3(a.x, spec.y || 0, a.z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a.ry), new T.Vector3(sc, sc, sc));
      const mk = (name, parent, pos) => { const b = new T.Bone(); b.name = a.id + ':' + name; b.position.set(pos[0], pos[1], pos[2]); (parent || stage).add(b); b.userData.i = bones.length; bones.push(b); return b; };
      const B = {};
      B.root = mk('root', null, [a.x, spec.y || 0, a.z]); B.root.rotation.y = a.ry; B.root.scale.setScalar(sc);
      const hipY = spec.hipY || 0.22, shY = spec.shY || 0.56, neckY = spec.neckY || 0.72;
      B.body = mk('body', B.root, [0, hipY, 0]);
      B.head = mk('head', B.body, [0, neckY - hipY, spec.headZ || 0.02]);
      B.armL = mk('armL', B.body, [spec.shX || 0.2, shY - hipY, 0.03]); B.armR = mk('armR', B.body, [-(spec.shX || 0.2), shY - hipY, 0.03]);
      B.legL = mk('legL', B.root, [0.1, hipY, 0.02]); B.legR = mk('legR', B.root, [-0.1, hipY, 0.02]);
      // W5 «Бум!» понарошку (js/playfight.js): у пальтара — пустая кость pf между корнем и телом/ногами (без весов, не в скелете):
      // в неё слой возни пишет кувырок, сальто, поклон и в конце возвращает в покой; корнем по-прежнему владеет двор
      if (spec.role === 'paltar') { const pf = new T.Bone(); pf.name = a.id + ':pf'; B.root.add(pf); pf.add(B.body); pf.add(B.legL); pf.add(B.legR); B.pf = pf; }
      a.B = B; a.rest = { hipY, neckY };
      // деталь в осях зверька (покой): кость → смещение кости от корня
      const off = { root: [0, 0, 0], body: [0, hipY, 0], head: [0, neckY, spec.headZ || 0.02], armL: [spec.shX || 0.2, shY, 0.03], armR: [-(spec.shX || 0.2), shY, 0.03], legL: [0.1, hipY, 0.02], legR: [-0.1, hipY, 0.02] };
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
      a.faceDecal = (key, p, s) => { const fc = faceCell(FACE_KEYS.indexOf(key)); const part = a.P('head', G.face, '#FFFFFF', p, s, null, 'face'); part.uv = [fc.u0, fc.v0, 0.125, 0.125]; return part; };
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
    // пальтар: высокий войлочный капюшон с белыми дугами, «борода», усы из шерсти, пучок «конского волоса», кольчуга
    // поверх белой рубахи, пояс с колокольчиками. Видно, кто под маской: рожки козлика, ушки лисёнка, хвост енотика
    function paltar(a, s) {
      const tuft = s.tuft || '#2E2A30', under = s.speciesUnder || s.sp;
      // белая рубаха (рукава), кольчуга до колен, пояс, колокольчики
      a.P('body', G.sph, '#FFFDF8', [0, 0.22, 0], [0.24, 0.26, 0.22], null, 'plain');
      a.tex('body', mailGeo, 'mail', [0, 0.14, 0], [1, 1, 1], null, '#FFFFFF');
      a.tex('body', G.cylO, 'mail', [0, 0.42, 0], [0.25, 0.08, 0.23], null, '#FFFFFF');
      a.P('body', G.cylO, '#7A4E32', [0, 0.18, 0], [0.27, 0.045, 0.25], null, 'ol');
      [[-0.18, 0.15, 0.17], [0, 0.15, 0.27], [0.18, 0.15, 0.17], [0.24, 0.15, 0]].forEach(p => a.P('body', G.sphLo, '#F2C94C', p, [0.03, 0.03, 0.03], null, 'plain'));
      ['armL', 'armR'].forEach(b => { a.tex(b, cap(0.058, 0.08), 'mail', [0, -0.05, 0.02], [1, 1, 1]); a.P(b, cap(0.05, 0.1), '#FFFDF8', [0, -0.13, 0.02], [1, 1, 1], null, 'plain'); a.P(b, G.sphLo, s.paw || '#EADBC8', [0, -0.23, 0.03], [0.055, 0.05, 0.055], null, 'plain'); });
      ['legL', 'legR'].forEach(b => { a.P(b, cap(0.06, 0.1), '#FFFDF8', [0, -0.1, 0], [1, 1, 1], null, 'plain'); a.P(b, G.sphLo, '#5E4A40', [0, -0.2, 0.04], [0.07, 0.05, 0.095], null, 'plain'); });
      // голова под маской (не видна) не нужна: маска — сама голова
      a.tex('head', maskGeo, 'mask', [0, 0.14, 0], [1, 1, 1]);
      a.tex('head', beardGeo, 'beard', [0, -0.12, 0.215], [1, 1, 1], [0.12, 0, 0]);
      a.P('head', G.sph, '#2E2A30', [0, 0.13, 0.255], [0.04, 0.033, 0.04], null, 'plain');           // нос-пуговка
      a.P('head', G.sphLo, '#FFFFFF', [0.012, 0.142, 0.288], [0.01, 0.008, 0.006], null, 'plain');
      [-1, 1].forEach(sd => [0.1, -0.12].forEach((tw, q) => a.P('head', G.cone, s.must || '#D9C7A8', [sd * 0.085, 0.128 + q * 0.012, 0.235], [0.014, 0.11, 0.012], [0, 0, sd * (1.45 + tw)], 'plain')));   // шерстяные усы — пучками в стороны, чуть вверх (не «клыки»)
      // пучок «конского волоса» на макушке: мягкая кисточка, чуть свисает
      a.P('head', G.sphLo, tuft, [0, 0.765, 0], [0.035, 0.03, 0.035], null, 'plain');
      for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU, tilt = 0.22 + (i % 3) * 0.12; a.P('head', G.cone, tuft, [Math.sin(ang) * 0.018, 0.83, Math.cos(ang) * 0.018 - 0.01], [0.016, 0.13, 0.016], [Math.cos(ang) * tilt - 0.15, 0, -Math.sin(ang) * tilt], 'plain'); }
      if (under === 'goat') [-1, 1].forEach(sd => { a.P('head', G.cone, '#CDBFA6', [sd * 0.12, 0.5, -0.04], [0.035, 0.16, 0.035], [-0.3, 0, -sd * 0.5], 'plain'); a.P('head', G.sph, '#F3EDE4', [sd * 0.25, 0.22, -0.02], [0.08, 0.03, 0.045], [0, 0, -sd * 0.4], 'plain'); });
      if (under === 'fox') { [-1, 1].forEach(sd => a.P('head', G.cone, '#E8894A', [sd * 0.13, 0.45, -0.02], [0.065, 0.14, 0.045], [0, 0, -sd * 0.45])); a.P('body', G.sph, '#E8894A', [0.05, 0.06, -0.3], [0.09, 0.09, 0.2], [0.6, 0.3, 0]); a.P('body', G.sphLo, '#FFF4E6', [0.08, -0.02, -0.45], [0.06, 0.06, 0.07], null, 'plain'); }
      if (under === 'raccoon') { [-1, 1].forEach(sd => a.P('head', G.sph, '#9A949C', [sd * 0.19, 0.38, -0.03], [0.065, 0.065, 0.04])); for (let i = 0; i < 4; i++) a.P('body', G.sphLo, i % 2 ? '#4E4650' : '#9A949C', [0.04 + i * 0.03, 0.06 + i * 0.03, -0.26 - i * 0.07], [0.07, 0.07, 0.06], null, 'plain'); }
      a.headR = [0.25, 0.3, 0.25];
    }
    SPECIES.paltar = paltar;

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
    SPEC.push({ id: 'paltar0', sp: 'goat', role: 'paltar', x: 3.8 * S, z: 2.6 * S, ry: PI, tuft: '#2E2A30', speaker: 'paltar' });
    SPEC.push({ id: 'paltar1', sp: 'fox', role: 'paltar', x: -3.8 * S, z: 2.8 * S, ry: PI, tuft: '#F2E6CC', must: '#B98A5E' });
    if (HI) SPEC.push({ id: 'paltar2', sp: 'raccoon', role: 'paltar', x: 4.2 * S, z: -1.8 * S, ry: -PI / 2, tuft: '#2E2A30' });

    SPEC.forEach(sp => {
      const a = makeAnimal(Object.assign({ hipY: 0.22, shY: 0.56, neckY: 0.72 }, sp.role === 'paltar' ? { sp: 'paltar', kind: sp.sp } : {}, sp, sp.role === 'paltar' ? { sp: 'paltar', speciesUnder: sp.sp } : {}));
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
    const meshTex = mkSkinned(partsTex, matTex, { uv: true }); if (meshTex) meshTex.castShadow = false;   // тени — только от тел (экономия на тенях)
    const meshFace = mkSkinned(partsFace, matFace, { uv: true, idx: true }); if (meshFace) { meshFace.renderOrder = 2; meshFace.raycast = () => {}; }

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
    const NCANDY = 36, candy = { pos: new Float32Array(NCANDY * 3), vel: new Float32Array(NCANDY * 3), life: new Float32Array(NCANDY), t: -1 };
    const candyGeo = keep(new T.BufferGeometry()); candyGeo.setAttribute('position', new T.BufferAttribute(candy.pos, 3));
    { const cc = new Float32Array(NCANDY * 3); for (let i = 0; i < NCANDY; i++) cc.set(hex(['#E8455A', '#F2C94C', '#5FB3B3', '#8E3A7A', '#F7B9C4', '#5DAA6E'][i % 6]), i * 3); candyGeo.setAttribute('color', new T.BufferAttribute(cc, 3)); }
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
    const linesFor = id => (LINES[id] || []).map(l => pick(l, named));
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
      const lo = linesFor(spk);
      const n = { id: aid === 'paltar0' ? 'paltar' : aid, speaker: spk, name: named || !sp.n ? sp.name : sp.n, icon: sp.icon, root, x: p.x, y: root.position.y, z: p.z, headY: (a.role === 'paltar' ? 1.45 : 1.15) * a.scale, talkR: a.role === 'sit' ? 2.4 : 2.0, lines: lo.map(l => l.text), lineObjs: lo, animal: a, faceHero: 0, wedding: true };
      a.npc = n; npcs.push(n);
    });
    // W5: остальные пальтары — тоже «жители» для возни понарошку; говорят те же шутки, что и первый (общий список реплик)
    const palTalk = npcs.find(q => q.speaker === 'paltar' && q.lines && q.lines.length);
    animals.filter(a => a.role === 'paltar' && !a.npc).forEach(a => {
      const root = new T.Object3D(); root.name = 'npc:' + a.id; group.add(root);
      const p = toW(a.x, a.z); root.position.set(p.x, p.y + (a.spec.y || 0), p.z);
      const sp = SPEAKERS.paltar;
      const n = { id: a.id, speaker: 'paltar', name: named || !sp.n ? sp.name : sp.n, icon: sp.icon, root, x: p.x, y: root.position.y, z: p.z, headY: 1.45 * a.scale, talkR: 2.0, lines: palTalk ? palTalk.lines : [], lineObjs: palTalk ? palTalk.lineObjs : [], animal: a, faceHero: 0, wedding: true };
      a.npc = n; npcs.push(n);
    });
    npcs.forEach(n => { if (n.animal && n.animal.role === 'paltar') { n.pfBody = n.animal.B.pf; n.paltar = true; } });
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
    // маршрут ряженых: вокруг круга, мимо столов и музыкантов (оси двора)
    const PATH = [[0, R0 + 1.4], [3.2, 2.2], [4.3, -0.5], [3.0, -2.7], [0.9, -HD + 2.6], [-2.2, -HD + 2.9], [-4.4, -0.8], [-3.4, 2.2]].map(([x, z]) => [x * S, z * S]);
    pal.forEach((a, i) => { a.path = i % 2 ? PATH.slice().reverse() : PATH; a.seg = (i * 3) % PATH.length; a.mode = 'walk'; a.modeT = 2 + i * 3; a.px = a.x; a.pz = a.z; a.pry = a.ry; a.spd = 0.75; });
    const kids = animals.filter(a => a.role === 'kid');
    kids.forEach(a => { a.home = [a.x, a.z]; a.px = a.x; a.pz = a.z; a.pry = a.ry; });
    const emit = (type, data) => { const e = Object.assign({ type }, data || {}); (st.evCb || []).forEach(cb => { try { cb(e); } catch (er) { /* звук — не наш */ } }); return e; };
    const prankCbs = [];
    const prankEmit = (data) => { prankCbs.forEach(cb => { try { cb(data); } catch (er) { /* */ } }); emit('prank', data); };

    function pose(a, t, dt) {
      const B = a.B, s = a.spec, ph = a.ph, beat = (st.t / BEAT);
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
      } else if (a.role === 'kid') {
        const k = st.shower >= 0 ? 1 : 0.25, hop = Math.abs(Math.sin(t * (st.shower >= 0 ? 7 : 3) + ph));
        B.root.position.y = (a.spec.y || 0) + hop * 0.12 * k;
        B.armL.rotation.z = (st.shower >= 0 ? 2.6 : 0.4) * (0.6 + 0.4 * hop); B.armR.rotation.z = -(st.shower >= 0 ? 2.6 : 0.4) * (0.6 + 0.4 * hop);
        B.legL.rotation.x = Math.sin(t * 6 + ph) * 0.4 * k; B.legR.rotation.x = -B.legL.rotation.x;
      } else if (a.role === 'paltar') {
        palPose(a, t, beat);
      }
      // смотрит на героиню, когда с ней говорят
      if (a.npc && a.npc.faceHero > 0 && st.heroPos) {
        a.npc.faceHero -= dt;
        const wp = toW(a.B.root.position.x, a.B.root.position.z), want = Math.atan2(st.heroPos.x - wp.x, st.heroPos.z - wp.z) - A.ry - a.B.root.rotation.y;
        a.look += (clamp(angW(want), -1.0, 1.0) - a.look) * Math.min(1, dt * 5);
      } else a.look *= Math.max(0, 1 - dt * 3);
      B.head.rotation.y += a.look;
    }
    function palPose(a, t, beat) {
      const B = a.B, m = a.mode;
      if (m === 'walk' || m === 'approach' || m === 'back') {
        const w = t * 7 + a.ph;
        B.legL.rotation.x = Math.sin(w) * 0.55; B.legR.rotation.x = -Math.sin(w) * 0.55;
        B.armL.rotation.x = -Math.sin(w) * 0.5; B.armR.rotation.x = Math.sin(w) * 0.5; B.armL.rotation.z = 0.35; B.armR.rotation.z = -0.35;
        B.root.position.y = Math.abs(Math.sin(w)) * 0.05; B.body.rotation.z = Math.sin(w) * 0.08;
        B.head.rotation.z = Math.sin(w * 0.5) * 0.12;   // кисточка мотается
      } else if (m === 'tease') {
        const k = Math.sin(clamp(a.modeT0 - a.modeT, 0, 1.6) / 1.6 * PI);
        B.armL.rotation.z = 0.4 + 2.2 * k; B.armR.rotation.z = -0.4 - 2.2 * k; B.armL.rotation.x = B.armR.rotation.x = -0.6 * k;
        B.root.position.y = Math.abs(Math.sin(t * 9)) * 0.06 * k; B.body.rotation.x = -0.15 * k; B.head.rotation.z = Math.sin(t * 10) * 0.15 * k;
      } else if (m === 'dance') {
        const step = Math.sin(beat * PI);
        B.root.position.y = Math.abs(step) * 0.08; B.legL.rotation.x = step * 0.6; B.legR.rotation.x = -step * 0.6;
        B.armL.rotation.z = 2.4 + step * 0.3; B.armR.rotation.z = -2.4 + step * 0.3; B.body.rotation.z = step * 0.12;
      } else if (m === 'prank') {
        const P = st.prank, ph = P ? P.phase : '';
        if (ph === 'reach' || ph === 'take') { const k = sst(0, 0.5, P.t); B.armL.rotation.z = 0.3 + 2.4 * k; B.armL.rotation.x = -0.9 * k; B.armR.rotation.z = -0.3; }
        else if (ph === 'show') { B.armL.rotation.z = 2.8; B.armR.rotation.z = -1.2 - Math.sin(t * 8) * 0.3; B.root.position.y = Math.abs(Math.sin(t * 8)) * 0.07; B.body.rotation.y = Math.sin(t * 4) * 0.5; }
        else if (ph === 'return') { const k = 1 - sst(0.4, 1.0, P.t); B.armL.rotation.z = 0.3 + 2.4 * k; B.armL.rotation.x = -0.9 * k; B.body.rotation.x = 0.5 * sst(0.5, 1.0, P.t); B.head.rotation.x = 0.4 * sst(0.5, 1.0, P.t); }
        else if (ph === 'bow') { const k = Math.sin(clamp(P.t / 1.2, 0, 1) * PI); B.body.rotation.x = 0.6 * k; B.head.rotation.x = 0.4 * k; B.armR.rotation.z = -1.2 * k; B.armL.rotation.z = 0.3; }
        else if (ph === 'jingle') { B.armL.rotation.z = 1.2 + Math.sin(t * 16) * 0.3; B.armR.rotation.z = -1.2 - Math.sin(t * 16) * 0.3; B.body.rotation.z = Math.sin(t * 16) * 0.1; B.root.position.y = Math.abs(Math.sin(t * 8)) * 0.05; }
      }
    }
    // шаг ряженого к точке (оси двора); true — пришёл
    function walkTo(a, x, z, dt, spd) {
      const dx = x - a.px, dz = z - a.pz, d = Math.hypot(dx, dz);
      if (d < 0.08) return true;
      const v = Math.min(d, (spd || a.spd) * dt);
      a.px += dx / d * v; a.pz += dz / d * v;
      const want = Math.atan2(dx, dz); a.pry += angW(want - a.pry) * Math.min(1, dt * 6);
      return false;
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
    function updatePaltars(t, dt) {
      pal.forEach(a => {
        a.modeT -= dt;
        if (a.hold) { if (a.mode !== 'hold') a.mode = 'hold'; return; }   // W5: возится с героиней понарошку — маршрут на паузе
        if (a.mode === 'hold') a.mode = 'walk';
        if (a.mode === 'walk') {
          const p = a.path[a.seg];
          if (walkTo(a, p[0], p[1], dt)) {
            a.seg = (a.seg + 1) % a.path.length;
            if (R2() < 0.45) { a.mode = 'tease'; a.modeT = a.modeT0 = 1.8; emit('bell', { who: a.id }); }
            else if (R2() < 0.25 && !pal.some(b => b.mode === 'dance')) { a.mode = 'dance'; a.modeT = 6; }
          }
        } else if (a.mode === 'tease') {
          // повернуться к ближайшему гостю и «напугать» понарошку
          const g = animals.filter(b => b !== a && b.role !== 'paltar').reduce((best, b) => { const bx = b.role === 'dance' ? b.B.root.position.x : b.x, bz = b.role === 'dance' ? b.B.root.position.z : b.z, d = Math.hypot(bx - a.px, bz - a.pz); return !best || d < best.d ? { b, d, x: bx, z: bz } : best; }, null);
          if (g) a.pry += angW(Math.atan2(g.x - a.px, g.z - a.pz) - a.pry) * Math.min(1, dt * 6);
          if (a.modeT <= 0) a.mode = 'walk';
        } else if (a.mode === 'dance') {
          walkTo(a, RC[0], RC[1], dt, 0.9); a.pry += dt * 1.6;
          if (a.modeT <= 0) a.mode = 'walk';
        }
      });
      // розыгрыш
      const P = st.prank;
      if (P) {
        const a = P.a, hl = heroLocal(), hh = heroHeadLocal();
        P.t += dt; P.T += dt;
        if (!hl || P.T > 14) { endPrank(); return; }
        const fx = hl.x + Math.sin(P.side) * 0.75, fz = hl.z + Math.cos(P.side) * 0.75;
        if (P.phase === 'approach') { a.mode = 'approach'; if (walkTo(a, fx, fz, dt, 1.1)) { setPhase(P.kind === 'beret' ? 'reach' : 'jingle'); a.mode = 'prank'; } }
        else { a.pry += angW(Math.atan2(hl.x - a.px, hl.z - a.pz) - a.pry) * Math.min(1, dt * 6); }
        if (P.phase === 'reach' && P.t > 0.55) { setPhase('take'); if (st.hero && V.kaz && V.kaz.hideBeret) P.hid = V.kaz.hideBeret(st.hero, true); prankEmit({ type: 'beret', phase: 'take', who: a.id, text: pick(EV.prankBeret, named).text }); }
        if (P.phase === 'take' && P.t > 0.45) setPhase('show');
        if (P.phase === 'show' && P.t > 1.6) setPhase('return');
        if (P.phase === 'return' && P.t > 1.0) { if (P.hid && V.kaz) V.kaz.hideBeret(st.hero, false); P.hid = false; setPhase('bow'); prankEmit({ type: 'beret', phase: 'return', who: a.id }); }
        if (P.phase === 'jingle' && P.t > 1.8) { setPhase('bow'); emit('bell', { who: a.id }); }
        if (P.phase === 'bow' && P.t > 1.3) endPrank();
        // берет-копия: летит с головы героини в лапу ряженого и обратно
        if (beretMesh) {
          const paw = new T.Vector3(); a.B.armL.updateWorldMatrix(true, false); paw.set(0, -0.26, 0.04).applyMatrix4(a.B.armL.matrixWorld);
          const head = hh ? hh.clone().applyMatrix4(stage.matrixWorld) : paw.clone();
          let k = -1;
          if (P.phase === 'take') k = sst(0, 0.45, P.t); else if (P.phase === 'show') k = 1; else if (P.phase === 'return') k = 1 - sst(0, 0.9, P.t);
          beretMesh.visible = k >= 0 && !!P.hid;
          if (beretMesh.visible) { beretMesh.position.lerpVectors(head, paw, k); beretMesh.position.y += Math.sin(k * PI) * 0.25; beretMesh.rotation.set(0.25 * Math.sin(t * 6), A.ry + a.pry, 0.1); }
        }
      }
    }
    function setPhase(ph) { const P = st.prank; P.phase = ph; P.t = 0; }
    function startPrank() {
      if (st.prank || !pal.length || pal.some(b => b.hold)) return false;
      const hl = heroLocal(); if (!hl) return false;
      const a = pal.slice().sort((p, q) => Math.hypot(p.px - hl.x, p.pz - hl.z) - Math.hypot(q.px - hl.x, q.pz - hl.z))[0];
      const kazOn = !!(V.kaz && V.kaz.isWorn && V.kaz.isWorn());
      const kind = st.hero && !kazOn && V.kaz && V.kaz.hideBeret ? 'beret' : 'jingle';
      st.prank = { a, kind, phase: 'approach', t: 0, T: 0, side: Math.atan2(a.px - hl.x, a.pz - hl.z), hid: false };
      a.mode = 'approach';
      prankEmit({ type: kind, phase: 'start', who: a.id, text: kind === 'jingle' ? pick(EV.prankJingle, named).text : '' });
      return true;
    }
    function endPrank() {
      const P = st.prank; if (!P) return;
      if (P.hid && V.kaz) V.kaz.hideBeret(st.hero, false);
      if (beretMesh) beretMesh.visible = false;
      P.a.mode = 'walk'; st.prank = null; st.prankDone = true;
      prankEmit({ type: P.kind, phase: 'end', who: P.a.id, text: P.kind === 'jingle' ? '' : pick(EV.prankBeret, named).text });
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
      let alive = 0;
      for (let i = 0; i < NCANDY; i++) {
        if (candy.life[i] <= 0) continue;
        candy.life[i] -= dt; alive++;
        if (P[i * 3 + 1] > 0.05) { Vv[i * 3 + 1] -= 6.5 * dt; P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt; if (P[i * 3 + 1] < 0.05) P[i * 3 + 1] = 0.05; }
        if (candy.life[i] <= 0) P[i * 3 + 1] = -5;
      }
      candyGeo.attributes.position.needsUpdate = true;
      candyPts.visible = alive > 0;
      if (!alive) { candy.t = -1; st.shower = -1; }
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
      // героиня во дворе — розыгрыш один раз за визит (через 6 с)
      if (heroPos) {
        const hl = heroLocal(), inYard = hl && Math.abs(hl.x) < HW + 0.5 && Math.abs(hl.z) < HD + 0.5;
        st.heroIn = inYard ? st.heroIn + dt : 0;
        if (!inYard && d > 25) st.prankDone = false;
        if (inYard && st.heroIn > 6 && !st.prankDone && !st.prank && !dance.active) startPrank();
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
        let tx = a.home[0], tz = a.home[1];
        if (st.shower >= 0) { tx = dais.x + Math.sin(t * 1.3 + a.idx * 2) * 1.2; tz = dais.z + 1.6 + Math.cos(t * 1.1 + a.idx) * 0.5; }
        const dx = tx - a.px, dz = tz - a.pz, dd = Math.hypot(dx, dz);
        if (dd > 0.05) { const v = Math.min(dd, 1.2 * dt); a.px += dx / dd * v; a.pz += dz / dd * v; a.pry += angW(Math.atan2(dx, dz) - a.pry) * Math.min(1, dt * 5); }
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
      prank() { st.prankDone = false; return startPrank(); },
      // W5: пальтар возится с героиней («Бум!» понарошку) — не ходит по маршруту и не начинает розыгрыш; id — npc.id / id зверька / npc
      paltarHold(idOrNpc, on) {
        const n = typeof idOrNpc === 'object' && idOrNpc ? idOrNpc : npcs.find(q => q.id === idOrNpc || (q.animal && q.animal.id === idOrNpc));
        const a = n && n.animal; if (!a || a.role !== 'paltar') return false;
        a.hold = !!on; if (on && st.prank && st.prank.a === a) endPrank(); return true;
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
      stopPrank() { if (st.prank) { endPrank(); return true; } return false; },   // например, героиня ушла танцевать или в диалог
      get lod() { return st.lod; },
      get paltars() { return pal.map(a => ({ id: a.id, mode: a.mode, x: +a.px.toFixed(2), z: +a.pz.toFixed(2), ry: +a.pry.toFixed(2), seg: a.seg })); },
      get prankState() { return st.prank ? { kind: st.prank.kind, phase: st.prank.phase, who: st.prank.a.id } : null; },
      animals: animals.map(a => ({ id: a.id, role: a.role, sp: a.spec.speciesUnder || a.spec.sp, bone: a.B.root })),
      speakers: SPEAKERS, lines: LINES, events: EV,
      info: { calls: [meshBody, meshOl, meshTex, meshFace, meshProps, meshCloth, meshLit, candyPts, ...flagMeshes].filter(Boolean).length, tris: Math.round(tris), animals: animals.length, bones: bones.length, buildMs: Math.round(performance.now() - t0) },
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
