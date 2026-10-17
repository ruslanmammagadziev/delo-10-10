/* =====================================================================
   ОБРАЗЫ ГЕРОИНИ — реестр шести образов (вместо кастинга «бант / тренч / волосы»).
   Чистые данные: без DOM и зависимостей; грузится сразу после js/config.js на всех страницах.
   Порядок = сетка образов автора: aurora, suede, pink, rust, cream, floral.
   legacy — цвета для старого сейва (bow / coat / hair): пишутся в сейв при каждой смене образа,
   так старые сборки и старые читатели (букет, вывески, перекраска тренча) продолжают работать.
   pal — только для запасных рисунков (кукла, вектор, портрет в витрине, значок кадра);
   полные тона ткани — в 3D (js/hero_outfits.js) и 2D (js/hero_looks2d.js).
   ===================================================================== */
(function () {
  'use strict';
  const LIST = [
    {
      id: 'aurora', n: 1, name: 'Северное сияние', tag: 'Для дел, что раскрываются ночью',
      legacy: { coat: '#23262E', bow: '#3FA88C', hair: '#2E1C14' },
      pal: { main: '#23262E', main2: '#1A1A1D', accent: '#3FA88C', hair: '#2E1C14', shoes: '#1A1A1D', legs: '#1A1A1D' },
      sig: { my: 'МОЙ пиджак', icon: 'blazer' }, bottom: 'trousers', bag: null,
    },
    {
      id: 'suede', n: 2, name: 'Конная прогулка', tag: 'Улики любят тех, кто в сапогах',
      legacy: { coat: '#4A2C1C', bow: '#A9C6E3', hair: '#2E1C14' },
      pal: { main: '#4A2C1C', main2: '#E8E0D0', accent: '#A9C6E3', hair: '#2E1C14', shoes: '#3A2218', legs: '#3A2218' },
      sig: { my: 'МОЯ сумочка', icon: 'bag' }, bottom: 'coat', bag: 'forearm',
    },
    {
      id: 'pink', n: 3, name: 'Зефирка', tag: 'Очки сниму, когда всё станет ясно',
      legacy: { coat: '#F2C9D0', bow: '#C9B3E0', hair: '#2A1A12' },
      pal: { main: '#F2C9D0', main2: '#F7F6F4', accent: '#C9B3E0', hair: '#2A1A12', shoes: '#F1EBE1', legs: '#F1EBE1' },
      sig: { my: 'МОИ очки', icon: 'glasses' }, bottom: 'mini', bag: 'forearm',
    },
    {
      id: 'rust', n: 4, name: 'Медный закат', tag: 'Ветер — свидетель защиты',
      legacy: { coat: '#B8521F', bow: '#E2B85C', hair: '#3A1E12' },
      pal: { main: '#B8521F', main2: '#A9471B', accent: '#E2B85C', hair: '#3A1E12', shoes: '#D2A878', legs: '#B8521F' },
      sig: { my: 'МОЯ серёжка', icon: 'earring' }, bottom: 'maxi', bag: 'clutch',
    },
    {
      id: 'cream', n: 5, name: 'Сливочный шик', tag: 'Строго, светло, по делу',
      legacy: { coat: '#F1EBDD', bow: '#E0B860', hair: '#2A1D16' },
      pal: { main: '#F1EBDD', main2: '#EDE5D6', accent: '#E0B860', hair: '#2A1D16', shoes: '#EFE6DA', legs: '#EDE5D6' },
      sig: { my: 'МОЯ сумочка', icon: 'bag' }, bottom: 'trousers', bag: 'forearm',
    },
    {
      id: 'floral', n: 6, name: 'Звезда вечера', tag: 'Финал дела — только в плаще',
      legacy: { coat: '#F4EFE8', bow: '#5A2440', hair: '#1E140F' },
      pal: { main: '#EFE7DE', main2: '#F4EFE8', accent: '#5A2440', hair: '#1E140F', shoes: '#D9B79A', legs: '#EFE7DE' },
      sig: { my: 'МОЙ цветок', icon: 'flower' }, bottom: 'gown', bag: null,
    },
  ];
  const IDS = LIST.map(x => x.id);
  const DEFAULT = 'suede';
  const BY = {};
  LIST.forEach(x => { BY[x.id] = x; });
  const valid = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(BY, id);
  const get = id => BY[valid(id) ? id : DEFAULT];
  const index = id => Math.max(0, IDS.indexOf(valid(id) ? id : DEFAULT));
  const legacy = id => Object.assign({}, get(id).legacy);
  const low = c => String(c || '').trim().toLowerCase();
  const rgb = c => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  // старый тренч -> образ (§2.3 дизайна): графитовый и звёздный — ночь, пудровый — розовый, молочный — сливочный…
  const COAT = { '#6b6f7a': 'aurora', '#3e4c72': 'aurora', '#f2c4ce': 'pink', '#fffdf9': 'cream', '#b0304a': 'rust', '#d9ccf4': 'floral' };
  // бежевый тренч (или без тренча) — решает бант; остальные банты (розовый, мятный…) — замшевое пальто
  const BOW = { '#b0304a': 'rust', '#ee9a55': 'rust', '#a98be8': 'floral', '#fff1e6': 'cream', '#c9ced6': 'cream' };
  function fromLegacy(o) {
    o = o || {};
    const bow = low(o.bow), coat = low(o.coat);
    // 1) ровно цвета образа (круговой путь: образ -> сейв -> образ)
    const exact = LIST.find(x => low(x.legacy.coat) === coat && low(x.legacy.bow) === bow);
    if (exact) return exact.id;
    // 2) чёрный бант — ночной образ
    if (bow === '#2e2a3b') return 'aurora';
    // 3) по цвету тренча
    if (COAT[coat]) return COAT[coat];
    // 4) бежевый тренч или его нет — по банту
    if (!coat || coat === '#e9d4b6') return BOW[bow] || DEFAULT;
    // 5) ближайший тренч образа по RGB
    const c = rgb(coat);
    if (!c) return DEFAULT;
    let best = DEFAULT, bd = Infinity;
    LIST.forEach(x => {
      const k = rgb(x.legacy.coat), d = (k[0] - c[0]) ** 2 + (k[1] - c[1]) ** 2 + (k[2] - c[2]) ** 2;
      if (d < bd) { bd = d; best = x.id; }
    });
    return best;
  }
  // образ сейва: st.look, иначе по старым цветам, иначе образ по умолчанию
  function current(st) {
    if (st && valid(st.look)) return st.look;
    if (st && (st.bow || st.coat)) return fromLegacy(st);
    return DEFAULT;
  }
  window.HeroLooks = { IDS, DEFAULT, LIST, get, valid, index, legacy, fromLegacy, current };
})();
