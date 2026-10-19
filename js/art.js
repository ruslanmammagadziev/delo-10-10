/* =====================================================================
   АРТ. Все персонажи и декорации — inline SVG, без внешних файлов.
   ===================================================================== */
(function () {
  const INK = '#3A2E3F', SKIN = '#FCE3D3', BLUSH = '#F59AAE', MOUTH = '#6B3A48';

  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Универсальное «милое лицо»
  function face(cx, cy, s, o = {}) {
    const er = o.er || 3.4, ery = er * 1.32, ec = o.eyeColor || '#2E2A3B';
    let eyes;
    if (o.closed) {
      eyes = `<path d="M${cx - s - 3.5},${cy + 1} Q${cx - s},${cy - 4} ${cx - s + 3.5},${cy + 1}" stroke="${ec}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
              <path d="M${cx + s - 3.5},${cy + 1} Q${cx + s},${cy - 4} ${cx + s + 3.5},${cy + 1}" stroke="${ec}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    } else {
      eyes = `<g class="blink-eyes"><ellipse cx="${cx - s}" cy="${cy}" rx="${er}" ry="${ery}" fill="${ec}"/><ellipse cx="${cx + s}" cy="${cy}" rx="${er}" ry="${ery}" fill="${ec}"/></g>
              <circle cx="${cx - s + er * .38}" cy="${cy - ery * .4}" r="${er * .38}" fill="#fff"/><circle cx="${cx + s + er * .38}" cy="${cy - ery * .4}" r="${er * .38}" fill="#fff"/>`;
    }
    const my = cy + (o.my || s * .75);
    const mouths = {
      smile: `<path d="M${cx - 3.6},${my} Q${cx},${my + 4} ${cx + 3.6},${my}" stroke="${MOUTH}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      big: `<path d="M${cx - 5},${my - 1} Q${cx},${my + 7} ${cx + 5},${my - 1} Z" fill="${MOUTH}"/><path d="M${cx - 2.6},${my + 2.6} Q${cx},${my + 5} ${cx + 2.6},${my + 2.6}" fill="#F48FA3"/>`,
      o: `<ellipse cx="${cx}" cy="${my + 1.5}" rx="2.4" ry="3" fill="${MOUTH}"/>`,
      cat: `<path d="M${cx - 4},${my} Q${cx - 2},${my + 3} ${cx},${my} Q${cx + 2},${my + 3} ${cx + 4},${my}" stroke="${MOUTH}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      flat: `<path d="M${cx - 3},${my + 1} L${cx + 3},${my + 1}" stroke="${MOUTH}" stroke-width="2" stroke-linecap="round"/>`,
      wobble: `<path d="M${cx - 5},${my + 1} q1.6,-2 3.3,0 t3.3,0 t3.3,0" stroke="${MOUTH}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      none: '',
    };
    const blush = o.noBlush ? '' :
      `<ellipse cx="${cx - s - er - 3}" cy="${cy + ery + 1.5}" rx="${er * 1.5}" ry="${er * .85}" fill="${BLUSH}" opacity=".55"/>
       <ellipse cx="${cx + s + er + 3}" cy="${cy + ery + 1.5}" rx="${er * 1.5}" ry="${er * .85}" fill="${BLUSH}" opacity=".55"/>`;
    return eyes + blush + (mouths[o.mouth || 'smile'] || '');
  }

  const svg = (vb, body, cls = '') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="${cls}">${body}</svg>`;

  /* ---------- ГЕРОИНЯ ---------- */
  // Стройная, длинные объёмные волосы (кончики в цвет волос; омбре — вариант, HERO.ombreOn), густые прямые брови,
  // миндалевидные глаза, пухлые губы. Стиль — плоский, без обводок.
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) * (1 - t)) + ((pb >> 16) * t));
    const g = Math.round((((pa >> 8) & 255) * (1 - t)) + (((pb >> 8) & 255) * t));
    const bl = Math.round(((pa & 255) * (1 - t)) + ((pb & 255) * t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  // кончики волос: как у HERO.tipsOf (по умолчанию в цвет волос); без hero_assets — тоже в цвет волос
  const tipsOf = hair => (window.HERO && typeof HERO.tipsOf === 'function' ? HERO.tipsOf(hair) : hair);
  // образ героини (один из шести роликов, js/hero_looks.js): o.look, если он из шести, иначе текущий образ игры
  // (G.look), иначе образ по умолчанию. Без реестра образов — null (старый путь: перекраска тренча по bow/coat/hair).
  function lookOf(o) {
    const HL = window.HeroLooks;
    if (!HL || typeof HL.valid !== 'function') return null;
    if (o && HL.valid(o.look)) return o.look;
    try { if (window.G && typeof G.look === 'function') { const id = G.look(); if (HL.valid(id)) return id; } } catch (e) { /* ignore */ }
    return HL.DEFAULT;
  }
  // запасная векторная героиня в цветах образа: пальто = основной цвет, волосы, ноги/обувь; без берета и банта
  function lookVec(o, id) {
    const e = window.HeroLooks.get(id), p = e.pal || {};
    return Object.assign({}, o, { coat: p.main, hair: p.hair, legs: p.legs, shoes: p.shoes, noHat: true });
  }
  // Векторная героиня — запасной вариант, если нет js/hero_assets.js (window.HERO)
  function heroineVec(o = {}) {
    if (o.view === 'back') return heroineBack(o);
    const side = o.view === 'side';
    const bow = o.bow || '#F08FA8', coat = o.coat || '#E9D4B6', hair = o.hair || '#4A3128';
    const beret = o.beret || shade(bow, -35);
    const coatD = shade(coat, -16), bowD = shade(bow, -18);
    const tips = tipsOf(hair);
    const SK = '#F7DCC8', SKD = '#EBC4AC';
    const mood = o.mood || 'smile';
    const vb = o.crop ? '20 16 80 80' : '0 0 120 188';
    const cup = o.cup ? drinkMini(o.cup, 84, 120) : '';
    const bq = o.bouquet ? `<g transform="translate(${side ? 21 : 16.8} ${side ? 85 : 83.3}) scale(.42)">${bouquet(o.bouquet, { shadow: false }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>` : '';
    const mag = o.magnifier ? `<g transform="translate(37 124) rotate(-22)"><rect x="-2" y="7" width="4" height="14" rx="2" fill="#8C6A4F"/><circle cx="0" cy="0" r="8.5" fill="rgba(191,217,242,.55)" stroke="#C9A24A" stroke-width="3"/><path d="M-4.5,-3.5 Q-2.5,-6 1,-6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>` : '';
    const body = `
      <ellipse cx="60" cy="183" rx="20" ry="3.6" fill="rgba(58,46,63,.15)"/>
      <!-- волосы сзади: длинные, ниже плеч -->
      <path d="M33,38 C21,50 19,65 22,77 C24,86 18,94 20,104 C22,114 17,124 22,134 C26,142 36,142 44,138 L76,138 C84,142 94,142 98,134 C103,124 98,114 100,104 C102,94 96,86 98,77 C101,65 99,50 87,38 Z" fill="${hair}"/>
      <path d="M20,108 C21,116 17,124 22,134 C26,142 36,142 44,138 L76,138 C84,142 94,142 98,134 C103,124 99,116 100,108 C85,116 35,116 20,108 Z" fill="${tips}"/>
      <!-- ноги -->
      <g class="leg-l"><rect x="52" y="150" width="6.5" height="27" rx="3.2" fill="${o.legs || INK}"/><ellipse cx="55" cy="178.5" rx="5.6" ry="3.2" fill="${o.shoes || '#6B3A4F'}"/></g>
      <g class="leg-r"><rect x="61.5" y="150" width="6.5" height="27" rx="3.2" fill="${o.legs || INK}"/><ellipse cx="65" cy="178.5" rx="5.6" ry="3.2" fill="${o.shoes || '#6B3A4F'}"/></g>
      <!-- шея -->
      <rect x="55.5" y="78" width="9" height="12" rx="3" fill="${SKD}"/>
      <!-- тренч -->
      <path d="M47,88 Q60,84 73,88 L76,111 L82,152 Q60,157 38,152 L44,111 Z" fill="${coat}"/>
      <path d="M60,99 L60,154" stroke="${coatD}" stroke-width="1.3"/>
      <rect x="43.5" y="109.5" width="33" height="5" rx="2.5" fill="${coatD}"/>
      <rect x="57" y="109" width="6" height="6" rx="1.2" fill="none" stroke="${shade(coat, -30)}" stroke-width="1.3"/>
      <circle cx="55.5" cy="102" r="1.4" fill="${coatD}"/><circle cx="64.5" cy="102" r="1.4" fill="${coatD}"/>
      <circle cx="55" cy="128" r="1.4" fill="${coatD}"/><circle cx="65" cy="128" r="1.4" fill="${coatD}"/>
      <path d="M51.5,87 L60,99 L55.5,85.5 Z M68.5,87 L60,99 L64.5,85.5 Z" fill="${coatD}"/>
      <!-- руки -->
      <g class="arm-l"><path d="M48,90 Q42,104 42,124" stroke="${coat}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="42" cy="127" r="3.8" fill="${SK}"/></g>
      <g class="arm-r"><path d="M72,90 Q78,104 78,124" stroke="${coat}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="78" cy="127" r="3.8" fill="${SK}"/></g>
      ${mag}${cup}
      <!-- пряди спереди, на плечах -->
      <path d="M33,76 C29,87 36,95 33,104 C31,110 33,114 37,118 C41,113 43,106 42,99 C41,91 44,85 41,77 Z" fill="${hair}"/>
      <path d="M32.6,106 C32,111 33.5,114.5 37,118 C40.5,114 42.3,109 42.2,104 Z" fill="${tips}"/>
      <path d="M87,76 C91,87 84,95 87,104 C89,110 87,114 83,118 C79,113 77,106 78,99 C79,91 76,85 79,77 Z" fill="${hair}"/>
      <path d="M87.4,106 C88,111 86.5,114.5 83,118 C79.5,114 77.7,109 77.8,104 Z" fill="${tips}"/>
      ${bq}
      <!-- лицо -->
      <ellipse cx="60" cy="56" rx="26" ry="29" fill="${SK}"/>
      <!-- волосы спереди: пробор чуть сбоку, пряди у лица -->
      <path d="M31,50 C29,30 43,19 60,19 C77,19 91,30 89,50 C82,40 72,35 60,35 C48,35 38,40 31,50 Z" fill="${hair}"/>
      <path d="M55,23 C40,24 29,35 29,52 C28,62 32,70 29,81 C34,77 36,71 37,64 C38,56 41,46 46,40 C49,36 52,33 55,31 Z" fill="${hair}"/>
      <path d="M55,23 C74,21 91,32 91,52 C92,62 88,71 92,81 C86,77 84,71 83,63 C81,54 78,45 72,39 C67,34 61,32 55,31 Z" fill="${hair}"/>
      <!-- берет и бант (в образах из роликов их нет — noHat) -->
      ${o.noHat ? '' : `<g transform="rotate(-12 60 24)">
        <ellipse cx="60" cy="24" rx="30" ry="9.5" fill="${beret}"/>
        <ellipse cx="60" cy="27" rx="27" ry="3.6" fill="${shade(beret, -14)}" opacity=".55"/>
        <circle cx="60" cy="14.5" r="2.8" fill="${beret}"/>
      </g>
      <g transform="translate(85 20) rotate(14)">
        <path d="M-1.6,2.4 L-7,14 L-2.8,12.2 Z M1.6,2.4 L7,14 L2.8,12.2 Z" fill="${bowD}"/>
        <path d="M0,0 C-12,-10 -15,7 0,2 Z" fill="${bow}"/><path d="M0,0 C12,-10 15,7 0,2 Z" fill="${bow}"/>
        <path d="M-3.2,-0.8 C-7,-4 -9.5,0.8 -4.8,1.2" stroke="${shade(bow, 25)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <circle cx="0" cy="1" r="3" fill="${bowD}"/>
      </g>`}
      ${side ? `<path d="M31,50 C29,62 31,74 35,85 L42,85 C39,73 39,61 43,50 Z" fill="${hair}"/>` : ''}
      ${side ? `<g transform="translate(6 0)">${heroFace(mood)}</g>` : heroFace(mood)}`;
    let out = side ? body.replace('<path d="M33,38 C21,50', '<path transform="translate(-5 0)" d="M33,38 C21,50') : body;
    if (o.step) out = stepPose(out, o.step);
    return svg(vb, out, 'hero-svg');
  }
  function stepPose(body, k) {
    return body
      .replace('<g class="leg-l">', `<g class="leg-l" transform="rotate(${16 * k} 55 150)">`)
      .replace('<g class="leg-r">', `<g class="leg-r" transform="rotate(${-16 * k} 65 150)">`)
      .replace('<g class="arm-l">', `<g class="arm-l" transform="rotate(${-12 * k} 48 90)">`)
      .replace('<g class="arm-r">', `<g class="arm-r" transform="rotate(${12 * k} 72 90)">`);
  }
  function heroineBack(o = {}) {
    const bow = o.bow || '#F08FA8', coat = o.coat || '#E9D4B6', hair = o.hair || '#4A3128';
    const beret = o.beret || shade(bow, -35), coatD = shade(coat, -16), bowD = shade(bow, -18);
    const tips = tipsOf(hair);
    const wrapStep = b => (o.step ? stepPose(b, o.step) : b);
    return svg('0 0 120 188', wrapStep(`
      <ellipse cx="60" cy="183" rx="20" ry="3.6" fill="rgba(58,46,63,.15)"/>
      <g class="leg-l"><rect x="52" y="150" width="6.5" height="27" rx="3.2" fill="${o.legs || INK}"/><ellipse cx="55" cy="178.5" rx="5.6" ry="3.2" fill="${o.shoes || '#6B3A4F'}"/></g>
      <g class="leg-r"><rect x="61.5" y="150" width="6.5" height="27" rx="3.2" fill="${o.legs || INK}"/><ellipse cx="65" cy="178.5" rx="5.6" ry="3.2" fill="${o.shoes || '#6B3A4F'}"/></g>
      <path d="M47,88 Q60,84 73,88 L76,111 L82,152 Q60,157 38,152 L44,111 Z" fill="${coat}"/>
      <path d="M60,118 L60,154" stroke="${coatD}" stroke-width="1.3"/><path d="M60,140 L56,154 M60,140 L64,154" stroke="${coatD}" stroke-width="1.1"/>
      <rect x="43.5" y="109.5" width="33" height="5" rx="2.5" fill="${coatD}"/>
      <g class="arm-l"><path d="M48,90 Q42,104 42,124" stroke="${coat}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="42" cy="127" r="3.8" fill="#F7DCC8"/></g>
      <g class="arm-r"><path d="M72,90 Q78,104 78,124" stroke="${coat}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="78" cy="127" r="3.8" fill="#F7DCC8"/></g>
      <path d="M33,38 C24,52 25,70 28,84 C30,96 27,108 31,120 C34,128 44,130 52,127 L68,127 C76,130 86,128 89,120 C93,108 90,96 92,84 C95,70 96,52 87,38 Z" fill="${hair}"/>
      <path d="M29,106 C29,112 27,116 31,120 C34,128 44,130 52,127 L68,127 C76,130 86,128 89,120 C93,116 91,112 91,106 C78,112 42,112 29,106 Z" fill="${tips}"/>
      <ellipse cx="60" cy="50" rx="28" ry="30" fill="${hair}"/>
      ${o.noHat ? '' : `<g transform="rotate(12 60 24)"><ellipse cx="60" cy="24" rx="30" ry="9.5" fill="${beret}"/><circle cx="60" cy="14.5" r="2.8" fill="${beret}"/></g>
      <g transform="translate(35 20) rotate(-14)">
        <path d="M-1.6,2.4 L-7,14 L-2.8,12.2 Z M1.6,2.4 L7,14 L2.8,12.2 Z" fill="${bowD}"/>
        <path d="M0,0 C-12,-10 -15,7 0,2 Z" fill="${bow}"/><path d="M0,0 C12,-10 15,7 0,2 Z" fill="${bow}"/><circle cx="0" cy="1" r="3" fill="${bowD}"/>
      </g>`}`), 'hero-svg');
  }
  function heroFace(mood) {
    const BR = '#2B1D18', EY = '#2E1E18';
    const raise = mood === 'think' ? -2.2 : 0;
    const brows = `<path d="M41,48.4 Q46,44.6 53.2,46.2 L53,49.4 Q46.5,47.9 41.6,50.4 Z" fill="${BR}"/>
      <path d="M79,${48.4 + raise} Q74,${44.6 + raise} 66.8,${46.2 + raise} L67,${49.4 + raise} Q73.5,${47.9 + raise} 78.4,${50.4 + raise} Z" fill="${BR}"/>`;
    const eyes = mood === 'happy'
      ? `<path d="M41.5,58 Q47,52.5 52.5,58" stroke="${EY}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M67.5,58 Q73,52.5 78.5,58" stroke="${EY}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : `<g class="blink-eyes">
          <path d="M41,57.5 Q47,51.6 53,57 Q47,61.6 41,57.5 Z" fill="${EY}"/>
          <path d="M79,57.5 Q73,51.6 67,57 Q73,61.6 79,57.5 Z" fill="${EY}"/>
        </g>
        <path d="M40.4,57 Q47,50.6 53.6,56.6" stroke="${BR}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
        <path d="M79.6,57 Q73,50.6 66.4,56.6" stroke="${BR}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
        <path d="M40.6,56.8 L38.6,55.2 M79.4,56.8 L81.4,55.2" stroke="${BR}" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="48.6" cy="55.6" r="1.25" fill="#fff"/><circle cx="74.6" cy="55.6" r="1.25" fill="#fff"/>`;
    const nose = `<path d="M59.2,64.8 Q60.6,66.6 62,65.8" stroke="#D9A58F" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    const mouth = mood === 'wow'
      ? `<ellipse cx="60" cy="72" rx="2.6" ry="3.2" fill="#B85A6A"/>`
      : mood === 'happy'
        ? `<path d="M55.5,70.2 Q60,76.5 64.5,70.2 Q60,71.6 55.5,70.2 Z" fill="#C9677A"/><path d="M57.2,72.6 Q60,74.6 62.8,72.6" fill="#F0A5B0"/>`
        : `<path d="M56,70.6 Q58,68.9 60,70.1 Q62,68.9 64,70.6 Q60,71.7 56,70.6 Z" fill="#D47F8A"/><path d="M56.4,70.8 Q60,75.2 63.6,70.8 Q60,71.9 56.4,70.8 Z" fill="#E2949C"/>`;
    return `${brows}${eyes}${nose}<ellipse cx="42" cy="66" rx="5" ry="2.6" fill="${BLUSH}" opacity=".42"/><ellipse cx="78" cy="66" rx="5" ry="2.6" fill="${BLUSH}" opacity=".42"/>${mouth}`;
  }

  /* ---------- ГЕРОИНЯ ПО РИСУНКУ АВТОРА ----------
     Рисунок, карта меток, вид со спины и заплатка моргания — window.HERO из js/hero_assets.js (всё в data:, см. ASSETS.md).
     Art.heroine(o) отдаёт inline <svg> с <image href="data:…">, поэтому CSS-размеры, .char/.bob/.walk и экспорт работают как раньше.
     Кадр тот же, что у векторной героини (120×188, ноги в той же точке), только в пикселях рисунка: 1 ед. = U px,
     поэтому все места, где героиня стоит, сохраняют прежнюю раскладку.
     Перекраска по o.bow / o.coat / o.hair (берет = HERO.beretOf(bow)) — алгоритм HERO.recolorPixels, но по заранее
     собранным спискам пикселей каждой области и на холсте 0.75 от рисунка (WS; на экране неотличимо, при WS = 1
     результат совпадает с HERO.paint до бита). Считается синхронно один раз на образ, data:-адрес кешируется.
     Пока картинки не декодированы (первые кадры), отдаётся рисунок в цветах по умолчанию с пометкой data-hk —
     после декода такие <image> перекрашиваются сами. Без HERO — векторная героиня (heroineVec).
     Образы из роликов (o.look или G.look, см. lookOf): готовые рисунки window.HERO_LOOKS2D (js/hero_looks2d.js) —
     тот же кадр и якоря, лицо и кисти автора; без перекраски, кроп аватара — свой у образа (item.head).
     Нет рисунка образа — прежняя перекраска тренча (в сейве лежат цвета образа). */
  const HeroPic = (function () {
    const H = window.HERO;
    if (!H || !H.full || !H.labels || !H.w || !H.h || !H.anchors || typeof H.targets !== 'function' || typeof document === 'undefined') return null;
    const U = 5.8, FW = 120 * U, FH = 188 * U;                    // кадр 696 × 1090.4
    const feet = H.anchors.feet || [H.w / 2, H.h - 8];
    const OX = FW / 2 - feet[0], OY = 181.7 * U - feet[1];       // рисунок в кадре: ноги там же, где у векторной
    // Рабочий холст — 0.75 от рисунка (304×750): этого хватает на самую крупную героиню (заставка ~240 css px × DPR 3),
    // а перекраска + PNG укладываются в ~25–55 мс при CPU ×4 (средний телефон). Потом в простое — WebP (в 4 раза короче).
    const WS = 0.75;
    const W = Math.round(H.w * WS), HH = Math.round(H.h * WS), KEYS = ['hair', 'coat', 'bow', 'beret', 'shoes'], LG = [-1, 0, 1, 2, 3, 4, 0];
    const views = {}, cache = new Map(), MAXC = 16, pending = new Map(), ids = new Map();
    const stats = { decodeMs: 0, n: 0, last: 0, max: 0, sum: 0, recolor: 0, encode: 0, workScale: WS, len: 0 };
    let ready = false, failed = false, work = null, wctx = null, warmT = 0;
    const n1 = v => Math.round(v * 10) / 10;
    const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const lumaA = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

    // картинка + метки -> пиксели рабочего размера и списки пикселей по областям (0 волосы, 1 пальто, 2 бант, 3 берет, 4 туфли).
    // При уменьшении под каждым рабочим пикселем 1–4 пикселя рисунка. Если все видимые из них — одной области, пиксель
    // «внутренний» и перекрашивается обычным алгоритмом. Если областей несколько (стык волос с лицом, волос с пальто,
    // край банта), пиксель «смешанный»: каждая его область сдвигает цвет на свою долю (площадь × альфа × «своя доля»
    // исходного пикселя) — как ветка «стык» в HERO.recolorPixels. Иначе на стыках оставалась бы кайма из исходного
    // цвета соседа.
    // генератор: отдаёт управление между кусками строк, чтобы не было длинной задачи на старте (на медленном телефоне ~0.3 с)
    function* prep(img, labImg) {
      const SW = H.w, SH = H.h, c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(labImg, 0, 0); const src = x.getImageData(0, 0, SW, SH).data;
      x.clearRect(0, 0, SW, SH); x.drawImage(img, 0, 0);
      const n = W * HH, grp = new Int8Array(n).fill(-1);
      if (W === SW && HH === SH) {   // без уменьшения — ровно HERO.recolorPixels
        const pix = x.getImageData(0, 0, SW, SH), a = pix.data;
        for (let i = 0; i < n; i++) { const L = src[i << 2]; if (L > 0 && L < 7 && a[(i << 2) + 3]) grp[i] = LG[L]; }
        return { pix, idx: lists(grp), bnd: null };
      }
      const al = x.getImageData(0, 0, SW, SH).data;
      // «своя доля» f каждого пикселя рисунка — как в HERO.recolorPixels: 1 внутри области, по яркости — на сглаженном
      // стыке. Зависит только от базовых цветов, поэтому считается один раз здесь.
      const lbG = KEYS.map(k => Math.max(lumaA(hex(H.base[k])), 1)), bH = hex(H.base.hair), bT = hex(H.base.hairTips);
      const lbRow = new Float64Array(SH);
      for (let r = 0; r < SH; r++) { let w = Math.min(1, Math.max(0, (r - H.ombre[0]) / (H.ombre[1] - H.ombre[0]))); w = w * w * (3 - 2 * w); lbRow[r] = Math.max(lumaA([0, 1, 2].map(k => bH[k] * (1 - w) + bT[k] * w)), 1); }
      const NS = SW * SH, sg = new Int8Array(NS), sh = new Float32Array(NS);   // область и доля каждого пикселя рисунка
      for (let q = 0, row = 0; q < NS; q++) {
        if (q && q % SW === 0) { row++; if (row % 200 === 0) yield; }
        const k4 = q << 2, L = src[k4], g = L > 0 && L < 7 && al[k4 + 3] ? LG[L] : -1;
        sg[q] = g; if (g < 0) continue;
        const Yp = al[k4] * 0.299 + al[k4 + 1] * 0.587 + al[k4 + 2] * 0.114, lb = g === 0 ? lbRow[row] : lbG[g], R = H.range[KEYS[g]], r = Yp / lb;
        sh[q] = r >= R[0] && r <= R[1] ? 1 : r > R[1] ? Math.min(1, Math.max(0, (H.yLight - Yp) / Math.max(H.yLight - lb, 1e-6))) : Math.min(1, Math.max(0, (Yp - H.yDark) / Math.max(lb - H.yDark, 1e-6)));
      }
      // уменьшение сами, усреднением по площади (с альфой): тогда рабочий пиксель — смесь ровно тех пикселей рисунка,
      // по которым он размечен (drawImage сглаживает шире, и в «чистые» пиксели волос подмешивалась кожа)
      const axis = (nOut, nSrc) => { const tab = []; for (let o = 0; o < nOut; o++) { const a0 = o / WS, a1 = Math.min(nSrc, (o + 1) / WS), e = []; for (let s = Math.floor(a0); s < a1 && s < nSrc; s++) { const w = Math.min(a1, s + 1) - Math.max(a0, s); if (w > 1e-6) e.push(s, w); } tab.push(e); } return tab; };
      const tx = axis(W, SW), ty = axis(HH, SH), pix = new ImageData(W, HH), a = pix.data;
      const wv = new Float64Array(5), bi = [], b1 = [], w1 = [], b2 = [], w2 = [];
      for (let yy = 0; yy < HH; yy++) {
        if (yy % 60 === 59) yield;
        const ey = ty[yy];
        for (let xx = 0; xx < W; xx++) {
          const ex = tx[xx], i = yy * W + xx, j = i << 2;
          let sw = 0, sa = 0, sr = 0, sgr = 0, sb = 0, first = -2, mixed = false;
          wv.fill(0);
          for (let k = 0; k < ey.length; k += 2) {
            const sy = ey[k], wy = ey[k + 1];
            for (let m = 0; m < ex.length; m += 2) {
              const w = wy * ex[m + 1], p = sy * SW + ex[m], q = p << 2, A = al[q + 3];
              sw += w; if (!A) continue;
              const wa = w * A; sa += wa; sr += wa * al[q]; sgr += wa * al[q + 1]; sb += wa * al[q + 2];
              const g = sg[p];
              if (first === -2) first = g; else if (g !== first) mixed = true;
              if (g >= 0) wv[g] += wa * sh[p];
            }
          }
          if (!sa) continue;
          a[j] = Math.round(sr / sa); a[j + 1] = Math.round(sgr / sa); a[j + 2] = Math.round(sb / sa); a[j + 3] = Math.round(sa / sw);
          if (!a[j + 3]) continue;
          if (!mixed) { if (first >= 0) grp[i] = first; continue; }   // внутренний (или целиком «ничья»: кожа, лицо, колготки, лупа)
          let g1 = -1, g2 = -1;
          for (let g = 0; g < 5; g++) if (wv[g] > 0) { if (g1 < 0 || wv[g] > wv[g1]) { g2 = g1; g1 = g; } else if (g2 < 0 || wv[g] > wv[g2]) g2 = g; }
          if (g1 < 0) continue;
          bi.push(i); b1.push(g1); w1.push(wv[g1] / sa); b2.push(g2); w2.push(g2 >= 0 ? wv[g2] / sa : 0);
        }
      }
      return { pix, idx: lists(grp), bnd: { i: Int32Array.from(bi), g1: Int8Array.from(b1), w1: Float32Array.from(w1), g2: Int8Array.from(b2), w2: Float32Array.from(w2) } };
    }
    function lists(grp) {
      const n = grp.length, cnt = [0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) if (grp[i] >= 0) cnt[grp[i]]++;
      const idx = cnt.map(k => new Int32Array(k)), k = [0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) { const g = grp[i]; if (g >= 0) idx[g][k[g]++] = i; }
      return idx;
    }
    const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; })
      .then(im => (im.decode ? im.decode().then(() => im, () => im) : im));
    const t0 = performance.now();
    // по кускам в простое: Promise с результатом генератора
    const idle = gen => new Promise(res => {
      const step = () => { const t = performance.now(); let r; do { r = gen.next(); } while (!r.done && performance.now() - t < 10); if (r.done) res(r.value); else setTimeout(step, 0); };
      step();
    });
    // спина: картинки декодируются сразу, разметка — в простое по кускам или целиком при первом запросе вида со спины
    let backImgs = null, backGen = null, backMs = 0;
    const backLoad = H.back && H.backLabels ? Promise.all([load(H.back), load(H.backLabels)]).then(r => { backImgs = r; }, () => {}) : Promise.resolve();
    function backStep(all) {   // true — вид со спины готов
      if (views.back) return true;
      if (!backImgs) return false;
      if (!backGen) backGen = prep(backImgs[0], backImgs[1]);
      const t = performance.now(); let r;
      do { r = backGen.next(); } while (!r.done && (all || performance.now() - t < 10));
      backMs += performance.now() - t;
      if (!r.done) return false;
      views.back = r.value; views.back.img = backImgs[0]; stats.prepBack = Math.round(backMs);
      return true;
    }
    const prepBack = () => backStep(true);
    const prepBackIdle = () => { if (!backStep(false)) setTimeout(prepBackIdle, 16); };
    const whenReady = Promise.all([load(H.full), load(H.labels), backLoad]).then(([f, l]) => {
      const t = performance.now();
      return idle(prep(f, l)).then(v => { views.front = v; views.front.img = f; stats.prepFront = Math.round(performance.now() - t); });
    }).then(() => {
      work = document.createElement('canvas'); work.width = W; work.height = HH;
      wctx = work.getContext('2d', { willReadFrequently: true });
      // холст в памяти (willReadFrequently): без чтения с GPU при каждом toDataURL
      ready = true; stats.decodeMs = Math.round(performance.now() - t0);
      flush();
      // в простое: прогрев (JIT перекраски всех областей и PNG-кодер — первый тап по образцу не платит за «холодный
      // старт»; считаем настоящий образ из кастинга, он ляжет в кеш), потом разметка вида со спины
      const ric = window.requestIdleCallback || (f => setTimeout(f, 300));
      ric(() => {
        // с рисунками образов (HERO_LOOKS2D) перекраска — только запасной путь: её прогрев не нужен
        try { if (!stats.n && !window.HERO_LOOKS2D) urlOf({ bow: '#B0304A', coat: '#6B6F7A', hair: '#1F1A1D' }, 'warm'); } catch (e) { /* ignore */ }
        ric(() => { try { prepBackIdle(); } catch (e) { /* ignore */ } }, { timeout: 5000 });
      }, { timeout: 3000 });
    }).catch(() => { failed = true; pending.clear(); });

    // параметры области: база B, цель T (как в HERO.recolorPixels)
    // lut: (Yp/lb)^g по сетке Yp с шагом 1/4 (линейная интерполяция, ошибка < 0.01 уровня) — вместо Math.pow на каждый пиксель
    function par(B, T, key, withLut) {
      const lb = Math.max(lumaA(B), 1), lt = Math.max(lumaA(T), 1), R = H.range[key];
      const g = Math.min(1, Math.max(H.gammaMin, Math.sqrt(lb / lt)));
      let lut = null;
      if (withLut) { lut = new Float64Array(1026); for (let q = 0; q < 1026; q++) lut[q] = Math.pow(q / 4 / lb, g); }
      return { T0: T[0], T1: T[1], T2: T[2], d0: T[0] - B[0], d1: T[1] - B[1], d2: T[2] - B[2], lb, g, lut, lo: R[0], hi: R[1],
        eL: Math.max(H.yLight - lb, 1e-6), eD: Math.max(lb - H.yDark, 1e-6) };
    }
    function run(a, list, P, rowPar) {
      const yL = H.yLight, yD = H.yDark;
      let row = -1, Q = P;
      for (let n = 0, m = list.length; n < m; n++) {
        const i = list[n];
        if (rowPar) { const y = (i / W) | 0; if (y !== row) { row = y; Q = rowPar(y); } }
        const j = i << 2, r0 = a[j], g0 = a[j + 1], b0 = a[j + 2];
        const Yp = r0 * 0.299 + g0 * 0.587 + b0 * 0.114, r = Yp / Q.lb;
        let v0, v1, v2;
        if (r > Q.hi || r < Q.lo) {     // сглаженный стык с соседом: сдвигаем только «свою» долю пикселя
          const f = r > Q.hi ? Math.min(1, Math.max(0, (yL - Yp) / Q.eL)) : Math.min(1, Math.max(0, (Yp - yD) / Q.eD));
          v0 = r0 + f * Q.d0; v1 = g0 + f * Q.d1; v2 = b0 + f * Q.d2;
        } else {
          let k;
          if (Q.lut) { const qf = Yp * 4, q = qf | 0; k = Q.lut[q] + (Q.lut[q + 1] - Q.lut[q]) * (qf - q); } else k = Math.pow(r, Q.g);
          v0 = Q.T0 * k; v1 = Q.T1 * k; v2 = Q.T2 * k;
          const mx = v0 > v1 ? (v0 > v2 ? v0 : v2) : (v1 > v2 ? v1 : v2);
          if (mx > 255) {   // пересвет — к белому с сохранением яркости
            const Y = Math.min(v0 * 0.299 + v1 * 0.587 + v2 * 0.114, 255), s = (255 - Y) / Math.max(mx - Y, 1e-6);
            v0 = Y + (v0 - Y) * s; v1 = Y + (v1 - Y) * s; v2 = Y + (v2 - Y) * s;
          }
        }
        a[j] = Math.round(v0); a[j + 1] = Math.round(v1); a[j + 2] = Math.round(v2);   // Uint8ClampedArray сам ограничит 0..255
      }
    }
    // волосы: параметры по строке рабочего холста (корни и кончики — общие, с lut; полоса омбре — по строкам рисунка)
    function hairRows(t) {
      if (!t.hair) return null;
      const bH = hex(H.base.hair), bT = hex(H.base.hairTips), tH = hex(t.hair), tT = hex(t.hairTips || H.tipsOf(t.hair));
      const o0 = H.ombre[0], o1 = H.ombre[1], P0 = par(bH, tH, 'hair', true), P1 = par(bT, tT, 'hair', true), memo = [];
      return yw => {
        const y = WS === 1 ? yw : (yw + 0.5) / WS - 0.5;
        if (y <= o0) return P0;
        if (y >= o1) return P1;
        if (memo[yw]) return memo[yw];
        let w = (y - o0) / (o1 - o0); w = w * w * (3 - 2 * w);
        const B = [0, 1, 2].map(c => bH[c] * (1 - w) + bT[c] * w), T = [0, 1, 2].map(c => tH[c] * (1 - w) + tT[c] * w);
        return (memo[yw] = par(B, T, 'hair', false));
      };
    }
    // перекрашенный рисунок на рабочем холсте work. Инкрементально: буфер прошлого образа этого вида
    // переиспользуется, пересчитываются только области, чья цель поменялась (тап по одному образцу — одна область),
    // и смешанные пиксели стыков (их мало). Области не пересекаются, так что результат тот же, что и с нуля.
    function paint(v, t) {
      const src = v.pix.data;
      if (!v.last) v.last = { a: new Uint8ClampedArray(src), t: {}, im: null };
      const st = v.last, a = st.a, was = st.t;
      if (!st.im) st.im = new ImageData(a, W, HH);
      const restore = list => { for (let n = 0, m = list.length; n < m; n++) { const j = list[n] << 2; a[j] = src[j]; a[j + 1] = src[j + 1]; a[j + 2] = src[j + 2]; } };
      const pars = [hairRows(t)];
      for (let g = 1; g < 5; g++) pars.push(t[KEYS[g]] ? par(hex(H.base[KEYS[g]]), hex(t[KEYS[g]]), KEYS[g], true) : null);
      let changed = false;
      if (was.hair !== t.hair || was.hairTips !== t.hairTips) { changed = true; restore(v.idx[0]); if (pars[0]) run(a, v.idx[0], null, pars[0]); }
      for (let g = 1; g < 5; g++) {
        if (was[KEYS[g]] === t[KEYS[g]]) continue;
        changed = true; restore(v.idx[g]);
        if (pars[g]) run(a, v.idx[g], pars[g], null);
      }
      const B = v.bnd;
      if (B && changed) {
        const P = (g, y) => (g === 0 ? (pars[0] ? pars[0](y) : null) : g > 0 ? pars[g] : null);
        for (let n = 0, m = B.i.length; n < m; n++) {
          const i = B.i[n], j = i << 2, y = (i / W) | 0;
          let d0 = 0, d1 = 0, d2 = 0;
          const p1 = P(B.g1[n], y), p2 = B.w2[n] > 0 ? P(B.g2[n], y) : null;
          if (p1) { const w = B.w1[n]; d0 += w * p1.d0; d1 += w * p1.d1; d2 += w * p1.d2; }
          if (p2) { const w = B.w2[n]; d0 += w * p2.d0; d1 += w * p2.d1; d2 += w * p2.d2; }
          a[j] = Math.round(src[j] + d0); a[j + 1] = Math.round(src[j + 1] + d1); a[j + 2] = Math.round(src[j + 2] + d2);
        }
      }
      st.t = t;
      wctx.putImageData(st.im, 0, 0);
      return work;
    }
    const encode = c => c.toDataURL('image/png');
    function compute(view, t) {
      const a = performance.now();
      const c = paint(views[view], t), b = performance.now();
      const href = encode(c), e = performance.now();
      stats.n++; stats.last = Math.round(e - a); stats.max = Math.max(stats.max, stats.last); stats.sum += e - a;
      stats.recolor = Math.round(b - a); stats.encode = Math.round(e - b); stats.len = href.length;
      return href;
    }
    function put(k, href) { cache.set(k, href); while (cache.size > MAXC) cache.delete(cache.keys().next().value); }
    // в простое перекодировать PNG в WebP: короче строка — быстрее innerHTML при каждой смене позы (Safari WebP не кодирует — остаётся PNG)
    const slimQ = [];
    let slimBusy = false;
    function slim(k) {
      if (!window.FileReader || !HTMLCanvasElement.prototype.toBlob) return;
      if (!slimQ.includes(k)) slimQ.push(k);
      if (slimBusy) return;
      slimBusy = true;
      const next = () => {
        const key = slimQ.shift(), png = key && cache.get(key);
        if (!key) { slimBusy = false; return; }
        if (!png || png.indexOf('data:image/png') !== 0) { next(); return; }
        const im = new Image();
        im.onload = () => {
          const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          c.getContext('2d').drawImage(im, 0, 0);
          c.toBlob(b => {
            if (!b || b.type !== 'image/webp') { slimQ.length = 0; slimBusy = false; return; }   // WebP не кодируется — бросаем
            const fr = new FileReader();
            fr.onload = () => { if (cache.get(key) === png && typeof fr.result === 'string') cache.set(key, fr.result); setTimeout(next, 50); };
            fr.onerror = () => setTimeout(next, 50);
            fr.readAsDataURL(b);
          }, 'image/webp', 0.92);
        };
        im.onerror = () => setTimeout(next, 50);
        im.src = png;
      };
      setTimeout(next, 700);
    }
    const idOf = k => { if (!ids.has(k)) ids.set(k, 'h' + ids.size); return ids.get(k); };
    // после декода: перекрасить то, что успели нарисовать в цветах по умолчанию
    function flush() {
      pending.forEach((p, k) => { if (!cache.has(k)) { try { put(k, compute(p.view, p.t)); slim(k); } catch (e) { /* ignore */ } } });
      pending.clear();
      const list = document.querySelectorAll('image[data-hk]');
      if (!list.length) return;
      const byId = {}; ids.forEach((id, k) => { byId[id] = k; });
      list.forEach(el => { const k = byId[el.getAttribute('data-hk')], href = k && cache.get(k); if (href) { el.setAttribute('href', href); el.removeAttribute('data-hk'); } });
    }
    function prewarm(look) {   // вид со спины того же образа — заранее, в простое (нужен у дверей)
      if (!H.back) return;
      clearTimeout(warmT);
      warmT = setTimeout(() => {
        const ric = window.requestIdleCallback || (f => setTimeout(f, 1));
        ric(() => { try { urlOf(look, 'back'); } catch (e) { /* ignore */ } }, { timeout: 4000 });
      }, 1500);
    }
    // синхронно: { href, hk } — data:-адрес рисунка в образе look; hk — пометка «перекрасить после декода»
    function urlOf(look, view) {
      const warm = view === 'warm'; if (warm) view = 'front';
      const t = H.targets(look), plain = !Object.keys(t).length, orig = view === 'back' ? H.back : H.full;
      if (plain || failed) return { href: orig, hk: '' };
      const k = view + JSON.stringify(t), hit = cache.get(k);
      if (hit) { cache.delete(k); cache.set(k, hit); return { href: hit, hk: '' }; }
      if (!ready) { pending.set(k, { view, t }); return { href: orig, hk: idOf(k) }; }
      if (view === 'back' && !prepBack()) return { href: orig, hk: '' };
      try {
        const h = compute(view, t); put(k, h); slim(k);
        if (view === 'front' && !warm) prewarm(look);
        if (pending.size) flush();
        return { href: h, hk: '' };
      } catch (e) { return { href: orig, hk: '' }; }
    }

    // ---- образы из роликов: готовые рисунки, декод — в простое (текущий образ сразу, остальные — по запросу)
    const L2 = window.HERO_LOOKS2D && window.HERO_LOOKS2D.items ? window.HERO_LOOKS2D : null;
    const lookImgs = new Map(), warmed = new Set();
    function lookItem(o) {
      if (!L2) return null;
      const id = lookOf(o), it = id && L2.items[id];
      return it && it.full ? { id, it } : null;
    }
    // Promise<Image | null>: декодированный рисунок образа (для экспорта блокнота и прогрева)
    function lookImg(id, view) {
      const it = L2 && L2.items[id], src = it && (view === 'back' ? it.back : it.full);
      if (!src) return Promise.resolve(null);
      const k = id + ':' + view;
      if (!lookImgs.has(k)) lookImgs.set(k, load(src).catch(() => null));
      return lookImgs.get(k);
    }
    function warmLook(id) {
      if (!id || warmed.has(id) || !L2 || !L2.items[id]) return;
      warmed.add(id);
      const ric = window.requestIdleCallback || (f => setTimeout(f, 200));
      ric(() => { lookImg(id, 'front'); ric(() => { lookImg(id, 'back'); }, { timeout: 4000 }); }, { timeout: 2500 });
    }
    // все образы (или один): например, когда открывается гардероб
    function warm(id) {
      if (!L2) return;
      if (id) { warmLook(id); return; }
      Object.keys(L2.items).forEach(warmLook);
    }
    if (L2 && typeof window.addEventListener === 'function') {
      window.addEventListener('herolook', e => { try { warmLook(e && e.detail && e.detail.id); } catch (er) { /* ignore */ } });
    }

    const BLINK = H.blink && H.blink.src
      ? `<image href="${H.blink.src}" x="${n1(OX + H.blink.x)}" y="${n1(OY + H.blink.y)}" width="${H.blink.w}" height="${H.blink.h}" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.93;.945;.975;1" dur="4.2s" repeatCount="indefinite"/></image>` : '';
    const SHADOW = `<ellipse cx="${n1(FW / 2)}" cy="${n1(183 * U)}" rx="100" ry="19" fill="rgba(58,46,63,.15)"/>`;
    const stripSvg = s => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
    function svgOf(o) {
      const view = o.view === 'back' ? 'back' : 'front';
      const lk = lookItem(o), A = H.anchors;
      let u, head = A.head;
      if (lk && (view === 'front' || lk.it.back)) {
        // образ из ролика: готовый рисунок, свой кроп аватара (макушка без берета ниже)
        u = { href: view === 'back' ? lk.it.back : lk.it.full, hk: '' };
        if (lk.it.head) head = lk.it.head;
        warmLook(lk.id);
      } else {
        if (view === 'back' && !views.back && (failed || !H.back)) return null;   // нет вида со спины — векторный
        u = urlOf({ bow: o.bow, coat: o.coat, hair: o.hair, beret: o.beret }, view);
      }
      let fig = `<image${u.hk ? ` data-hk="${u.hk}"` : ''} href="${u.href}" x="${n1(OX)}" y="${n1(OY)}" width="${H.w}" height="${H.h}"/>`;
      if (view === 'front') {
        if (o.blink !== false) fig += BLINK;
        // стакан и букет — в свободной руке (справа на картинке); оба сразу — букет в руке с лупой, как раньше
        const hf = A.handFree, hm = A.handMag || hf;
        if (o.cup) fig += `<g transform="translate(${n1(OX + hf[0])} ${n1(OY + hf[1])}) scale(${n1(U * .86)})">${drinkMini(o.cup, -1, 2.2)}</g>`;   // стакан по центру кисти
        if (o.bouquet) {
          const h = o.cup ? hm : hf;
          fig += `<g transform="translate(${n1(OX + h[0])} ${n1(OY + h[1])}) scale(${n1(U * .4 * 100) / 100}) translate(-60 -104)">${stripSvg(bouquet(o.bouquet, { shadow: false }))}</g>`;
        }
        if (o.view === 'side') fig = `<g transform="matrix(.93 0 0 1 ${n1(FW / 2 * .07)} 0)">${fig}</g>`;
      }
      const vb = o.crop ? `${n1(OX + head[0])} ${n1(OY + head[1])} ${n1(head[2])} ${n1(head[3])}` : `0 0 ${n1(FW)} ${n1(FH)}`;
      return svg(vb, (o.crop ? '' : SHADOW) + fig, 'hero-svg hero-pic');
    }
    // Promise<canvas | null>: героиня в том же кадре 120×188 (FW×FH px), полное разрешение — для экспорта в PNG
    function raster(o) {
      const lk = lookItem(o);
      if (lk) {
        const view = o.view === 'back' && lk.it.back ? 'back' : 'front';
        return lookImg(lk.id, view).then(img => {
          if (!img) return null;
          const c = document.createElement('canvas'); c.width = Math.round(FW * WS); c.height = Math.round(FH * WS);
          const x = c.getContext('2d');
          x.scale(WS, WS);
          x.fillStyle = 'rgba(58,46,63,.15)'; x.beginPath(); x.ellipse(FW / 2, 183 * U, 100, 19, 0, 0, Math.PI * 2); x.fill();
          x.drawImage(img, OX, OY, H.w, H.h);
          return c;
        }).catch(() => null);
      }
      return whenReady.then(() => {
        if (!ready) return null;
        const view = o.view === 'back' && prepBack() ? 'back' : 'front', t = H.targets({ bow: o.bow, coat: o.coat, hair: o.hair, beret: o.beret });
        const c = document.createElement('canvas'); c.width = Math.round(FW * WS); c.height = Math.round(FH * WS);
        const x = c.getContext('2d');
        x.scale(WS, WS);
        x.fillStyle = 'rgba(58,46,63,.15)'; x.beginPath(); x.ellipse(FW / 2, 183 * U, 100, 19, 0, 0, Math.PI * 2); x.fill();
        x.drawImage(Object.keys(t).length ? paint(views[view], t) : views[view].img, OX, OY, H.w, H.h);
        return c;
      }).catch(() => null);
    }
    return { svg: svgOf, raster, stats, frame: { U, FW, FH, OX, OY, WS }, isReady: () => ready, whenReady, views, warm, lookImg };
  })();

  function heroine(o = {}) {
    if (HeroPic) { try { const s = HeroPic.svg(o); if (s) return s; } catch (e) { /* ниже — векторная */ } }
    const id = lookOf(o);
    return heroineVec(id ? lookVec(o, id) : o);
  }
  // для экспорта блокнота: Promise<canvas> в кадре героини (или null — тогда рисуют SVG)
  function heroineRaster(o = {}) { return HeroPic ? HeroPic.raster(o) : Promise.resolve(null); }

  /* ---------- КОТ ПИРОЖОК ---------- */
  function cat(o = {}) {
    const fur = '#F0B36A', furD = '#D9934A';
    const vb = o.crop ? '17 4 56 56' : '0 0 90 82';
    const hat = o.noHat ? '' : `<g transform="rotate(-14 45 20)"><ellipse cx="45" cy="22.5" rx="17" ry="4.2" fill="#7D6B5A"/><path d="M33,22.5 Q34,9 45,8 Q56,9 57,22.5 Z" fill="#927F6B"/><rect x="33.5" y="18" width="23" height="3.6" fill="#5E4F42"/></g>`;
    const sleeping = o.sleep;
    const body = `
      <ellipse cx="45" cy="77" rx="25" ry="4" fill="rgba(58,46,63,.15)"/>
      <path class="tail-wag" d="M65,66 Q86,62 80,44 Q78,37 73,41" stroke="${fur}" stroke-width="7.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="45" cy="62" rx="22" ry="15.5" fill="${fur}"/>
      <ellipse cx="45" cy="66" rx="12" ry="9" fill="#FFE9CB"/>
      <ellipse cx="34" cy="75" rx="6" ry="3.6" fill="${fur}"/><ellipse cx="56" cy="75" rx="6" ry="3.6" fill="${fur}"/>
      <path d="M28,31 L26,12 L41,24 Z" fill="${fur}"/><path d="M62,31 L64,12 L49,24 Z" fill="${fur}"/>
      <path d="M30,27 L29.5,17 L37,24 Z" fill="#F7B9C4"/><path d="M60,27 L60.5,17 L53,24 Z" fill="#F7B9C4"/>
      <circle cx="45" cy="39" r="19.5" fill="${fur}"/>
      <path d="M41,21 L43,27 M45,20 L45,26.5 M49,21 L47,27" stroke="${furD}" stroke-width="2.2" stroke-linecap="round"/>
      ${face(45, 41, 7.5, { er: 2.6, closed: sleeping, mouth: 'cat', my: 6 })}
      <path d="M43.4,44.4 L46.6,44.4 L45,46.2 Z" fill="#E8798F"/>
      <path d="M27,43 L35,44 M27,47 L35,46.5 M63,43 L55,44 M63,47 L55,46.5" stroke="#B7864F" stroke-width="1.1" stroke-linecap="round"/>
      ${hat}
      ${sleeping ? `<text x="64" y="20" font-family="Nunito, sans-serif" font-weight="900" font-size="11" fill="#9AA3AD">z</text><text x="71" y="12" font-family="Nunito, sans-serif" font-weight="900" font-size="8" fill="#9AA3AD">z</text>` : ''}`;
    return svg(vb, body);
  }

  /* ---------- ЕНОТ-КИНОМЕХАНИК ---------- */
  function raccoon(o = {}) {
    const vb = o.crop ? '14 6 62 62' : '0 0 90 96';
    const body = `
      <ellipse cx="45" cy="92" rx="24" ry="4" fill="rgba(0,0,0,.18)"/>
      <path d="M62,80 Q84,74 80,56" stroke="#8C939E" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M70,77 L74,70 M77,70 L79,62" stroke="#4F5560" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="45" cy="74" rx="19" ry="16" fill="#9AA1AB"/>
      <ellipse cx="45" cy="78" rx="10" ry="9" fill="#E7E9EC"/>
      <path d="M26,28 L24,12 L38,22 Z" fill="#8C939E"/><path d="M64,28 L66,12 L52,22 Z" fill="#8C939E"/>
      <circle cx="45" cy="38" r="21" fill="#9AA1AB"/>
      <path d="M26,38 Q30,30 40,33 Q45,36 50,33 Q60,30 64,38 Q60,46 50,43 Q45,41 40,43 Q30,46 26,38 Z" fill="#454B55"/>
      <ellipse cx="45" cy="48" rx="11" ry="8" fill="#EEF0F2"/>
      ${face(45, 38, 9, { er: 2.8, noBlush: false, mouth: 'none' })}
      <ellipse cx="45" cy="47" rx="3" ry="2.2" fill="#2E2A3B"/>
      <path d="M45,49.5 Q38,52 34,49 M45,49.5 Q52,52 56,49" stroke="#2E2A3B" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M28,22 Q45,10 62,22 L62,26 L28,26 Z" fill="#C2405B"/><rect x="22" y="24" width="30" height="5" rx="2.5" fill="#9E2F47"/>`;
    return svg(vb, body);
  }

  /* ---------- ПОПУГАЙ-СТАЖЁР ---------- */
  function parrot(o = {}) {
    const vb = o.crop ? '16 4 58 58' : '0 0 90 104';
    const body = `
      <ellipse cx="45" cy="100" rx="20" ry="3.6" fill="rgba(58,46,63,.15)"/>
      <path d="M40,86 L36,100 M50,86 L54,100" stroke="#E8A53C" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M38,88 Q30,104 26,104 L44,92 Z" fill="#3E9E6E"/>
      <ellipse cx="45" cy="70" rx="19" ry="21" fill="#58C08A"/>
      <ellipse cx="45" cy="76" rx="11" ry="13" fill="#B9EBC9"/>
      <path d="M28,66 Q20,80 30,92 Q36,80 34,66 Z" fill="#3E9E6E"/>
      <path d="M41,52 L49,52 L52,62 L45,68 L38,62 Z" fill="#E2405E"/><path d="M45,56 L45,66" stroke="#B42F4A" stroke-width="1.4"/>
      <path d="M36,18 Q40,6 46,12 Q48,4 54,10" stroke="#58C08A" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="45" cy="35" r="19" fill="#62CB94"/>
      <circle cx="37" cy="33" r="6.5" fill="#fff"/><circle cx="53" cy="33" r="6.5" fill="#fff"/>
      <g class="blink-eyes"><circle cx="38" cy="33.5" r="3.4" fill="#2E2A3B"/><circle cx="52" cy="33.5" r="3.4" fill="#2E2A3B"/></g>
      <circle cx="39.2" cy="32.2" r="1.1" fill="#fff"/><circle cx="53.2" cy="32.2" r="1.1" fill="#fff"/>
      <path d="M45,38 Q55,39 53,50 Q49,46 45,46 Z" fill="#F5B940"/><path d="M45,38 Q36,40 40,47 Q42,45 45,46 Z" fill="#E09A28"/>
      <ellipse cx="30" cy="42" rx="4" ry="2.4" fill="${BLUSH}" opacity=".6"/><ellipse cx="60" cy="42" rx="4" ry="2.4" fill="${BLUSH}" opacity=".6"/>`;
    return svg(vb, body);
  }

  /* ---------- ГУСЬ ИЗ ТРЕТЬЕГО РЯДА ---------- */
  function goose(o = {}) {
    const vb = o.crop ? '28 2 52 52' : '0 0 100 100';
    const body = `
      <ellipse cx="50" cy="80" rx="26" ry="16" fill="#F4F2EE"/>
      <path d="M44,78 Q40,46 50,30" stroke="#F4F2EE" stroke-width="14" fill="none" stroke-linecap="round"/>
      <circle cx="52" cy="26" r="13" fill="#FBFAF7"/>
      <path d="M62,24 Q76,26 75,31 Q68,33 62,31 Z" fill="#F29A38"/>
      <g class="blink-eyes"><circle cx="54" cy="22" r="2.6" fill="#2E2A3B"/></g><circle cx="54.8" cy="21.2" r=".9" fill="#fff"/>
      <ellipse cx="49" cy="30" rx="3.6" ry="2" fill="${BLUSH}" opacity=".5"/>
      ${o.badge === false ? '' : `<path d="M41,42 L43,55 M50,40 L47,55" stroke="#C2405B" stroke-width="1.4" fill="none"/><g transform="rotate(-8 45 59)"><rect x="33" y="54" width="24" height="10" rx="2" fill="#FFFDF9" stroke="#E7D8DD" stroke-width=".8"/><text x="45" y="61.4" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="4.4" fill="#3A2E3F">ФИНАЛЫЧ</text></g>`}
      ${o.popcorn !== false ? `<g transform="translate(64 66)"><path d="M-12,0 L12,0 L9,24 L-9,24 Z" fill="#fff"/><path d="M-8,0 L-6.5,24 M0,0 L0,24 M8,0 L6.5,24" stroke="#E2405E" stroke-width="3.4"/><circle cx="-8" cy="-2" r="4.5" fill="#FFF3C4"/><circle cx="0" cy="-4" r="5" fill="#FFF3C4"/><circle cx="8" cy="-2" r="4.5" fill="#FFF3C4"/><circle cx="-3" cy="-7" r="4" fill="#FFE9A0"/><circle cx="5" cy="-8" r="3.6" fill="#FFF3C4"/></g>` : ''}`;
    return svg(vb, body);
  }

  /* ---------- НАПАРНИЦЫ ---------- */
  function bunny(o = {}) {
    const vb = o.crop ? '15 24 60 60' : '0 0 90 120';
    const body = `
      <ellipse cx="45" cy="116" rx="22" ry="4" fill="rgba(58,46,63,.15)"/>
      <ellipse cx="45" cy="96" rx="18" ry="17" fill="#FFFFFF"/>
      <path d="M30,92 Q45,84 60,92 L58,112 Q45,116 32,112 Z" fill="#F7C9D3"/>
      <path d="M38,95 Q45,99 52,95" stroke="#E79AAC" stroke-width="2" fill="none"/>
      <ellipse cx="34" cy="26" rx="7.5" ry="22" fill="#FFFFFF" transform="rotate(-10 34 26)"/>
      <ellipse cx="34" cy="28" rx="3.6" ry="16" fill="#F7B9C4" transform="rotate(-10 34 28)"/>
      <ellipse cx="57" cy="24" rx="7.5" ry="22" fill="#FFFFFF" transform="rotate(14 57 24)"/>
      <ellipse cx="57" cy="26" rx="3.6" ry="16" fill="#F7B9C4" transform="rotate(14 57 26)"/>
      <circle cx="45" cy="62" r="21" fill="#FFFFFF"/>
      <path d="M28,44 Q26,32 36,32 Q38,24 46,26 Q54,22 58,30 Q66,30 64,42 Z" fill="#FFFDF9" stroke="#EADFD9" stroke-width="1.4"/>
      <rect x="29" y="40" width="34" height="7" rx="2" fill="#F2EBE6"/>
      ${face(45, 64, 8, { er: 3, mouth: 'cat', my: 6 })}
      <ellipse cx="45" cy="68" rx="2" ry="1.5" fill="#E8798F"/>`;
    return svg(vb, body);
  }
  function fox(o = {}) {
    const vb = o.crop ? '15 16 60 60' : '0 0 90 116';
    const body = `
      <ellipse cx="45" cy="112" rx="22" ry="4" fill="rgba(58,46,63,.15)"/>
      <path d="M60,100 Q86,96 80,72 Q74,84 62,86 Z" fill="#F08A45"/><path d="M80,72 Q76,82 70,84 Q78,84 80,72 Z" fill="#fff"/>
      <ellipse cx="45" cy="92" rx="17" ry="18" fill="#F39A55"/>
      <ellipse cx="45" cy="97" rx="9" ry="11" fill="#FFF3E6"/>
      <path d="M30,80 Q45,90 60,80 L60,86 Q45,95 30,86 Z" fill="#B9A5E8"/><path d="M50,86 L54,100 L58,98 L55,85 Z" fill="#A08CDB"/>
      <path d="M26,40 L22,16 L40,30 Z" fill="#F08A45"/><path d="M64,40 L68,16 L50,30 Z" fill="#F08A45"/>
      <path d="M27,36 L25,22 L35,30 Z" fill="#3A2E3F" opacity=".7"/><path d="M63,36 L65,22 L55,30 Z" fill="#3A2E3F" opacity=".7"/>
      <circle cx="45" cy="52" r="21" fill="#F39A55"/>
      <path d="M26,56 Q36,52 45,62 Q54,52 64,56 Q60,72 45,73 Q30,72 26,56 Z" fill="#FFF3E6"/>
      ${face(45, 52, 8, { er: 2.8, mouth: 'cat', my: 9 })}
      <ellipse cx="45" cy="59.5" rx="2.4" ry="1.8" fill="#2E2A3B"/>
      <circle cx="37" cy="52" r="7" fill="none" stroke="#5B4A3E" stroke-width="2"/><circle cx="53" cy="52" r="7" fill="none" stroke="#5B4A3E" stroke-width="2"/><path d="M44,52 L46,52" stroke="#5B4A3E" stroke-width="2"/>`;
    return svg(vb, body);
  }
  function hedgehog(o = {}) {
    const vb = o.crop ? '13 28 64 64' : '0 0 90 110';
    const body = `
      <ellipse cx="45" cy="106" rx="24" ry="4" fill="rgba(58,46,63,.15)"/>
      <path d="M14,70 L8,58 L18,58 L14,44 L24,48 L24,32 L34,40 L40,24 L46,38 L56,26 L58,42 L70,34 L68,50 L80,48 L74,60 L84,64 L74,72 Z" fill="#8A6A55"/>
      <ellipse cx="45" cy="88" rx="20" ry="17" fill="#A9866D"/>
      <ellipse cx="45" cy="92" rx="11" ry="10" fill="#F2DCC4"/>
      <circle cx="45" cy="60" r="20" fill="#F2DCC4"/>
      <path d="M25,58 Q27,38 45,38 Q63,38 65,58 Q58,48 45,48 Q32,48 25,58 Z" fill="#8A6A55"/>
      ${face(45, 62, 8, { er: 2.8, mouth: 'smile', my: 7 })}
      <ellipse cx="45" cy="66.5" rx="2.4" ry="1.8" fill="#2E2A3B"/>
      <path d="M24,60 Q24,36 45,36 Q66,36 66,60" stroke="#8C7AD6" stroke-width="4" fill="none"/>
      <rect x="18" y="55" width="10" height="15" rx="5" fill="#A897EA"/><rect x="62" y="55" width="10" height="15" rx="5" fill="#A897EA"/>`;
    return svg(vb, body);
  }

  /* ---------- ДЕСЕРТЫ-СВИДЕТЕЛИ ---------- */
  function cinnabon(o = {}) {
    const body = `
      <ellipse cx="45" cy="78" rx="30" ry="5" fill="rgba(58,46,63,.12)"/>
      <ellipse cx="45" cy="56" rx="32" ry="22" fill="#E7B47C"/>
      <path d="M45,56 m-4,0 a4,4 0 1,1 8,0 a9,9 0 1,1 -18,0 a14,14 0 1,1 28,0 a19,15 0 1,1 -38,0" stroke="#C88D52" stroke-width="3" fill="none"/>
      <path d="M20,46 Q30,36 45,38 Q62,36 70,46 Q66,52 60,48 Q56,56 50,50 Q44,58 38,50 Q32,56 28,49 Q22,52 20,46 Z" fill="#FFF8F0"/>
      ${face(45, 60, 9, { er: 2.8, mouth: o.mouth || 'smile', my: 7, closed: o.closed })}`;
    return svg('0 0 90 86', body);
  }
  function macaron(o = {}) {
    const body = `
      <ellipse cx="45" cy="80" rx="28" ry="5" fill="rgba(58,46,63,.12)"/>
      <ellipse cx="45" cy="64" rx="30" ry="12" fill="#C9B6F0"/>
      <rect x="17" y="50" width="56" height="10" rx="5" fill="#FFF6E8"/>
      <path d="M17,55 q4,4 8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0" stroke="#F2E2CC" stroke-width="2" fill="none"/>
      <ellipse cx="45" cy="44" rx="30" ry="14" fill="#D6C6F6"/>
      <ellipse cx="36" cy="38" rx="9" ry="3" fill="#fff" opacity=".5"/>
      ${face(45, 44, 9, { er: 2.6, mouth: o.mouth || 'smile', my: 5.5, closed: o.closed })}`;
    return svg('0 0 90 88', body);
  }
  function bubbletea(o = {}) {
    const liquid = o.liquid || '#D9B08C', top = o.top || 'pearls';
    const tops = {
      pearls: `<circle cx="34" cy="82" r="3.6" fill="#3A2B2B"/><circle cx="43" cy="85" r="3.6" fill="#3A2B2B"/><circle cx="52" cy="82" r="3.6" fill="#3A2B2B"/><circle cx="39" cy="77" r="3.4" fill="#4A3636"/><circle cx="48" cy="78" r="3.4" fill="#3A2B2B"/><circle cx="57" cy="85" r="3.2" fill="#4A3636"/>`,
      marsh: `<rect x="31" y="74" width="8" height="8" rx="2.5" fill="#fff" transform="rotate(10 35 78)"/><rect x="45" y="78" width="8" height="8" rx="2.5" fill="#FFE3EA" transform="rotate(-12 49 82)"/><rect x="38" y="83" width="8" height="8" rx="2.5" fill="#fff"/>`,
      none: '',
    };
    const name = o.name ? `<text x="45" y="62" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="${o.name.length > 8 ? 9.5 : o.name.length > 5 ? 11.5 : 14}" fill="#7A3E4E">${esc(o.name)}</text>` : '';
    const body = `
      <ellipse cx="45" cy="98" rx="20" ry="4" fill="rgba(58,46,63,.12)"/>
      <rect x="52" y="0" width="6" height="40" rx="3" fill="#F08FA8" transform="rotate(12 55 20)"/>
      <path d="M22,32 L68,32 L62,94 Q45,99 28,94 Z" fill="rgba(255,255,255,.75)" stroke="#EDE3E6" stroke-width="1.5"/>
      <path d="M24.5,46 L65.5,46 L62,94 Q45,99 28,94 Z" fill="${liquid}"/>
      ${tops[top] || ''}
      <path d="M20,32 Q45,14 70,32 Z" fill="rgba(255,255,255,.9)" stroke="#EDE3E6" stroke-width="1.5"/>
      <rect x="18" y="30" width="54" height="5" rx="2.5" fill="#F7D7DF"/>
      <rect x="27" y="50" width="36" height="17" rx="5" fill="#FFFDF9" opacity="${o.name ? .95 : 0}"/>
      ${name}
      ${o.face === false ? '' : face(45, o.name ? 76 : 62, 8, { er: 2.6, mouth: o.mouth || 'smile', my: 6, closed: o.closed })}`;
    return svg('0 0 90 104', body);
  }
  function drinkMini(cup, x, y) {
    const liquid = cup.liquid || '#D9B08C';
    return `<g transform="translate(${x - 9} ${y - 18}) scale(.24)"><rect x="52" y="0" width="7" height="40" rx="3" fill="#F08FA8" transform="rotate(12 55 20)"/><path d="M22,32 L68,32 L62,94 Q45,99 28,94 Z" fill="#fff"/><path d="M24.5,46 L65.5,46 L62,94 Q45,99 28,94 Z" fill="${liquid}"/><path d="M20,32 Q45,14 70,32 Z" fill="#fff"/></g>`;
  }


  /* ---------- ЦВЕТЫ И БУКЕТ ---------- */
  const FLOWERS = [
    { id: 'hydrangea', name: 'Флокс голубой', c: '#A9C2F0' },   // id прежний — ради сохранений
    { id: 'hydrangeaPink', name: 'Флокс розовый', c: '#F3B8D0' },
    { id: 'peony', name: 'Пион', c: '#F6A9BF' },
    { id: 'ranunculus', name: 'Ранункулюс', c: '#FBC2A0' },
    { id: 'tulip', name: 'Тюльпан', c: '#F08FA8' },
    { id: 'hyacinth', name: 'Гиацинт', c: '#B9A5E8' },
    { id: 'lavender', name: 'Лаванда', c: '#A88BD8' },
    { id: 'chamomile', name: 'Ромашка', c: '#FFFDF6' },
    { id: 'aster', name: 'Астра', c: '#B79BE6' },
    { id: 'eucalyptus', name: 'Эвкалипт', c: '#9DBFA8' },
    { id: 'pampas', name: 'Пампасная трава', c: '#E8D7B5' },
  ];
  const FL = id => FLOWERS.find(f => f.id === id) || FLOWERS[0];
  // головка цветка в точке (x, y), масштаб k (1 ≈ 14px в радиусе)
  function flowerHead(id, x, y, k = 1, rot = 0) {
    const f = FL(id), c = f.c, d = shade(c, -14), l = shade(c, 30);
    const g = inner => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">${inner}</g>`;
    switch (id) {
      case 'hydrangea': case 'hydrangeaPink': {
        let o = `<circle r="13" fill="${d}"/>`;
        [[0, 0], [-7, -5], [7, -5], [-8, 4], [8, 4], [0, -9], [0, 8], [-4, -1], [4, 2]].forEach(([a, b], i) => {
          o += `<g transform="translate(${a} ${b}) rotate(${i * 23})"><circle cx="-2" cy="0" r="2.6" fill="${i % 2 ? c : l}"/><circle cx="2" cy="0" r="2.6" fill="${c}"/><circle cx="0" cy="-2" r="2.6" fill="${l}"/><circle cx="0" cy="2" r="2.6" fill="${c}"/><circle r="1" fill="${d}"/></g>`;
        });
        return g(o);
      }
      case 'peony': {
        let o = '';
        for (let i = 0; i < 7; i++) o += `<ellipse cx="0" cy="-8" rx="6.5" ry="8" fill="${i % 2 ? c : d}" transform="rotate(${i * 51.4})"/>`;
        o += `<circle r="8.5" fill="${l}"/><path d="M-6,0 Q0,-8 6,0 Q0,-3 -6,0 Z M-5,3 Q0,-3 5,3 Q0,1 -5,3 Z" fill="${c}"/><circle cy="-1" r="2.4" fill="${shade(c, 45)}"/>`;
        return g(o);
      }
      case 'ranunculus':
        return g(`<circle r="11.5" fill="${d}"/><circle r="9" fill="${c}"/><circle r="6.4" fill="${shade(c, -6)}"/><circle r="4.2" fill="${l}"/><circle r="2.2" fill="${shade(c, -20)}"/>
          <path d="M-9,-3 Q0,-10 9,-3" stroke="${l}" stroke-width="1.2" fill="none"/><path d="M-7,3 Q0,-3 7,3" stroke="${l}" stroke-width="1" fill="none"/>`);
      case 'tulip':
        return g(`<path d="M-8,-2 Q-9,9 0,10 Q9,9 8,-2 Q5,2 3,-6 Q0,0 -3,-6 Q-5,2 -8,-2 Z" fill="${c}"/><path d="M-3,-6 Q0,0 3,-6 Q1,6 0,9 Q-1,6 -3,-6 Z" fill="${l}" opacity=".7"/>`);
      case 'hyacinth': {
        let o = '';
        for (let i = 0; i < 9; i++) { const yy = -14 + i * 3.4, w = 3 + Math.sin(i / 8 * Math.PI) * 4; o += `<circle cx="${-w / 2}" cy="${yy}" r="2.6" fill="${i % 2 ? c : l}"/><circle cx="${w / 2}" cy="${yy + 1.2}" r="2.6" fill="${i % 2 ? l : c}"/>`; }
        return g(o);
      }
      case 'lavender': {
        let o = `<path d="M0,14 L0,-14" stroke="#7FA36C" stroke-width="1.4"/>`;
        for (let i = 0; i < 8; i++) o += `<ellipse cx="${i % 2 ? 1.8 : -1.8}" cy="${-15 + i * 2.6}" rx="1.9" ry="2.6" fill="${i % 3 ? c : d}"/>`;
        return g(o);
      }
      case 'chamomile': {
        let o = '';
        for (let i = 0; i < 12; i++) o += `<ellipse cx="0" cy="-7" rx="2.6" ry="6" fill="${i % 2 ? '#FFFFFF' : '#F6F2EA'}" transform="rotate(${i * 30})"/>`;
        return g(o + `<circle r="4.2" fill="#F4C64E"/><circle cx="-1" cy="-1" r="1.4" fill="#F9DD86"/>`);
      }
      case 'aster': {   // астра: два круга тонких лепестков и жёлтая серединка
        let o = '';
        for (let i = 0; i < 16; i++) o += `<ellipse cx="0" cy="-7.4" rx="1.5" ry="6.4" fill="${i % 2 ? c : l}" transform="rotate(${i * 22.5})"/>`;
        for (let i = 0; i < 10; i++) o += `<ellipse cx="0" cy="-4.6" rx="1.3" ry="4" fill="${i % 2 ? d : c}" transform="rotate(${i * 36 + 18})"/>`;
        return g(o + `<circle r="3.2" fill="#F4C64E"/><circle cx="-0.8" cy="-0.8" r="1.1" fill="#F9DD86"/>`);
      }
      case 'eucalyptus': {
        let o = `<path d="M0,14 Q3,0 -1,-15" stroke="#7E9E88" stroke-width="1.3" fill="none"/>`;
        [[-4, -12], [4, -8], [-4, -3], [4, 2], [-3, 7]].forEach(([a, b], i) => { o += `<ellipse cx="${a}" cy="${b}" rx="4.4" ry="3.6" fill="${i % 2 ? c : d}"/>`; });
        return g(o);
      }
      case 'pampas': {
        let o = `<path d="M0,15 Q1,0 0,-16" stroke="#C9B48E" stroke-width="1.2" fill="none"/>`;
        for (let i = 0; i < 7; i++) o += `<ellipse cx="${i % 2 ? 2 : -2}" cy="${-14 + i * 3.6}" rx="${3.2 + (i % 3)}" ry="4" fill="${i % 2 ? c : l}" opacity=".9"/>`;
        return g(o);
      }
      default: return '';
    }
  }
  function flowerIcon(id) {
    const tall = ['hyacinth', 'lavender', 'eucalyptus', 'pampas'].includes(id);
    return svg('0 0 40 40', `<path d="M20,38 L20,${tall ? 24 : 22}" stroke="#7FA36C" stroke-width="2" stroke-linecap="round"/><path d="M20,32 Q13,30 12,25 Q18,26 20,31" fill="#8FBF86"/>${flowerHead(id, 20, tall ? 18 : 16, tall ? 1.05 : 1.05)}`);
  }
  // b = { f: [ids], paper, ribbon }
  function bouquet(b = {}, o = {}) {
    const list = (b.f && b.f.length ? b.f : ['tulip', 'chamomile', 'aster']).slice(0, 9);
    const paper = b.paper || '#E8D3B6', ribbon = b.ribbon || '#F08FA8';
    const tallIds = ['hyacinth', 'lavender', 'eucalyptus', 'pampas'];
    const tall = list.filter(id => tallIds.includes(id)), round = list.filter(id => !tallIds.includes(id));
    const SLOT = [[60, 46], [42, 52], [78, 52], [60, 32], [30, 64], [90, 64], [48, 64], [72, 64], [60, 58]];
    const TSLOT = [[46, 30, -14], [74, 30, 14], [60, 18, 0], [34, 40, -24], [86, 40, 24], [52, 22, -6], [68, 22, 6], [40, 34, -18], [80, 34, 18]];
    let stems = '', backHeads = '', heads = '';
    tall.forEach((id, i) => { const [x, y, r] = TSLOT[i]; stems += `<path d="M60,104 Q${(x + 60) / 2},${(y + 104) / 2 + 6} ${x},${y + 10}" stroke="#7FA36C" stroke-width="2.2" fill="none"/>`; backHeads += flowerHead(id, x, y, 1.15, r); });
    round.forEach((id, i) => { const [x, y] = SLOT[i]; stems += `<path d="M60,104 L${x},${y + 6}" stroke="#7FA36C" stroke-width="2.4"/>`; heads += flowerHead(id, x, y, id === 'peony' || id.indexOf('hydrangea') === 0 ? 1.12 : 1, (i * 37) % 40 - 20); });
    const leaves = `<path d="M44,74 Q28,70 24,58 Q38,60 46,72 Z" fill="#8FBF86"/><path d="M76,74 Q92,70 96,58 Q82,60 74,72 Z" fill="#7FB07A"/>`;
    const body = `
      ${o.shadow === false ? '' : '<ellipse cx="60" cy="136" rx="26" ry="3.5" fill="rgba(58,46,63,.12)"/>'}
      <path d="M22,60 L60,134 L98,60 Q60,46 22,60 Z" fill="${shade(paper, -10)}"/>
      ${stems}${leaves}${backHeads}${heads}
      <path d="M30,78 L60,134 L90,78 Q75,90 60,86 Q45,90 30,78 Z" fill="${paper}"/>
      <path d="M30,78 Q45,90 60,86 L60,134 Z" fill="${shade(paper, 6)}"/>
      <path d="M50,100 Q60,104 70,100 L68,106 Q60,109 52,106 Z" fill="${ribbon}"/>
      <path d="M60,103 C48,92 40,104 58,105 Z" fill="${ribbon}"/><path d="M60,103 C72,92 80,104 62,105 Z" fill="${ribbon}"/>
      <path d="M58,105 L52,122 L56,120 Z M62,105 L68,122 L64,120 Z" fill="${shade(ribbon, -14)}"/>
      <circle cx="60" cy="104" r="3.2" fill="${shade(ribbon, -14)}"/>`;
    return svg('0 0 120 140', body);
  }
  function flowerCart() {
    let heads = '';
    [[34, 'tulip'], [58, 'aster'], [82, 'chamomile'], [106, 'hyacinth']].forEach(([x, id], i) => {
      heads += `<path d="M${x - 9},78 L${x + 9},78 L${x + 7},96 L${x - 7},96 Z" fill="#B9C3CF"/>`;
      heads += flowerHead(id, x - 6, 70, 0.62, -10) + flowerHead(id, x + 6, 68, 0.62, 12) + flowerHead(id, x, 62, 0.7, 0);
    });
    return svg('0 0 140 150', `
      <ellipse cx="70" cy="146" rx="56" ry="4" fill="rgba(58,46,63,.14)"/>
      <rect x="22" y="14" width="3" height="84" fill="#6C7682"/><rect x="115" y="14" width="3" height="84" fill="#6C7682"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${16 + i * 18.3},12 L${34.3 + i * 18.3},12 L${34.3 + i * 18.3},24 Q${25.2 + i * 18.3},32 ${16 + i * 18.3},24 Z" fill="${i % 2 ? '#FFFDF9' : '#F6C6D0'}"/>`).join('')}
      <rect x="14" y="8" width="112" height="6" rx="3" fill="#E7A6B6"/>
      ${flowerHead('lavender', 46, 52, 0.8, -8)}${flowerHead('pampas', 96, 50, 0.85, 10)}
      ${heads}
      <rect x="14" y="94" width="112" height="34" rx="8" fill="#C9946A"/>
      <rect x="18" y="104" width="104" height="2" fill="#A87452"/><rect x="18" y="114" width="104" height="2" fill="#A87452"/>
      <rect x="44" y="100" width="52" height="20" rx="4" fill="#3E4C3F"/>
      <text x="70" y="114.5" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="13" fill="#FFFDF9">Цветы</text>
      <circle cx="32" cy="132" r="13" fill="none" stroke="#A87452" stroke-width="5"/><circle cx="108" cy="132" r="13" fill="none" stroke="#A87452" stroke-width="5"/>
      <circle cx="32" cy="132" r="3" fill="#6C7682"/><circle cx="108" cy="132" r="3" fill="#6C7682"/>`);
  }
  /* ---------- ПЧЁЛКА-ФЛОРИСТКА ---------- */
  function bee(o = {}) {
    const vb = o.crop ? '14 8 62 62' : '0 0 90 96';
    const body = `
      <ellipse cx="45" cy="92" rx="20" ry="3.4" fill="rgba(58,46,63,.12)"/>
      <ellipse cx="30" cy="34" rx="13" ry="9" fill="#E8F2FF" opacity=".9" transform="rotate(-25 30 34)"/>
      <ellipse cx="60" cy="34" rx="13" ry="9" fill="#E8F2FF" opacity=".9" transform="rotate(25 60 34)"/>
      <ellipse cx="45" cy="64" rx="22" ry="20" fill="#FFD45E"/>
      <path d="M25,58 Q45,52 65,58 L66,64 Q45,58 24,64 Z M25,72 Q45,66 65,72 L62,78 Q45,73 28,78 Z" fill="#4A3A48"/>
      <path d="M32,70 Q45,92 58,70 Q52,84 45,84 Q38,84 32,70 Z" fill="#F6C6D0"/>
      <circle cx="45" cy="38" r="16" fill="#FFD45E"/>
      <path d="M38,24 Q34,12 28,10 M52,24 Q56,12 62,10" stroke="#4A3A48" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="28" cy="10" r="3" fill="#F08FA8"/><circle cx="62" cy="10" r="3" fill="#F08FA8"/>
      ${face(45, 39, 6.5, { er: 2.4, mouth: 'smile', my: 6 })}
      <g transform="translate(66 60) rotate(18)">${flowerHead('tulip', 0, 0, 0.6)}</g>`;
    return svg(vb, body);
  }


  /* ---------- НАХОДКИ (иконки для блокнота и 2D-улицы) ---------- */
  function findTicket() { return svg('0 0 100 100', `<g transform="rotate(-10 50 50)"><rect x="14" y="32" width="72" height="36" rx="6" fill="#F6C6D0"/><rect x="66" y="32" width="20" height="36" rx="4" fill="#FFF1E6"/>
    <path d="M66,34 L66,66" stroke="#C9A2AE" stroke-width="2" stroke-dasharray="3 3"/><text x="40" y="48" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3A2E3F">РЯД 3</text><text x="40" y="60" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3A2E3F">МЕСТО 13</text>
    <g transform="translate(76 50) scale(.7)"><path d="M0,8 L-7,-6 M0,8 L0,-9 M0,8 L7,-6" stroke="#E9955A" stroke-width="4" stroke-linecap="round"/><path d="M-7,-6 L0,-9 L7,-6 L0,8 Z" fill="#F0B07A" opacity=".8"/></g></g>`); }
  function findUmbrella() { return svg('0 0 100 100', `<g transform="rotate(-20 50 50)"><path d="M18,46 Q50,10 82,46 Z" fill="#F4C7D0"/><path d="M50,22 L50,46 M50,22 L30,46 M50,22 L70,46" stroke="#FFFDF9" stroke-width="2"/>
    <path d="M18,46 Q26,40 34,46 Q42,40 50,46 Q58,40 66,46 Q74,40 82,46" fill="#F08FA8"/><rect x="48.5" y="44" width="3" height="40" rx="1.5" fill="#E9D3B6"/><circle cx="50" cy="20" r="3" fill="#FFFDF9"/></g>`); }
  function findSweater() { return svg('0 0 100 100', `<path d="M32,24 L18,34 L12,58 L24,62 L28,46 L28,82 L72,82 L72,46 L76,62 L88,58 L82,34 L68,24 Q50,34 32,24 Z" fill="#FFF1E2" stroke="#EBD9C8" stroke-width="2"/>
    <path d="M28,76 L72,76" stroke="#F4C7D0" stroke-width="6"/><path d="M38,25 Q50,34 62,25" stroke="#F4C7D0" stroke-width="4" fill="none"/>
    <circle cx="50" cy="52" r="7" fill="#FFD45A"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="49" y="39" width="2" height="5" fill="#FFD45A" transform="rotate(${a} 50 52)"/>`).join('')}`); }
  function findWatch() { return svg('0 0 100 100', `<path d="M50,16 Q40,8 30,14" stroke="#C9CED6" stroke-width="3" fill="none" stroke-dasharray="4 2"/><circle cx="50" cy="20" r="4" fill="none" stroke="#C9CED6" stroke-width="3"/>
    <circle cx="50" cy="56" r="32" fill="#C9CED6"/><circle cx="50" cy="56" r="27" fill="#FFFDF9"/>
    <text x="50" y="40" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="10" fill="#3A2E3F">13</text><text x="70" y="60" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8" fill="#3A2E3F">3</text>
    <text x="50" y="78" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8" fill="#3A2E3F">6</text><text x="30" y="60" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8" fill="#3A2E3F">9</text>
    <path d="M50,56 L50,38 M50,56 L50,44" stroke="#3A2E3F" stroke-width="2.4" stroke-linecap="round"/>`); }
  function findFeather() { return svg('0 0 100 100', `<g transform="rotate(30 50 50)"><path d="M50,10 Q66,30 60,62 Q56,78 50,86 Q44,78 40,62 Q34,30 50,10 Z" fill="#FFFDF9" stroke="#EDE6DE" stroke-width="2"/>
    <path d="M50,14 L50,92" stroke="#E9D3B6" stroke-width="2.4"/><path d="M58,40 L63,37 M42,52 L37,50 M58,58 L62,58" stroke="#E2DAD0" stroke-width="2"/></g>`); }
  function findSaucer() { return svg('0 0 100 100', `<ellipse cx="50" cy="56" rx="38" ry="22" fill="#FAFAFA" stroke="#E2E6EE" stroke-width="2"/><ellipse cx="50" cy="54" rx="22" ry="12" fill="#F1F3F7"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = i / 10 * Math.PI * 2; return `<ellipse cx="${50 + Math.cos(a) * 31}" cy="${56 + Math.sin(a) * 17}" rx="2.6" ry="1.8" fill="#F08FA8"/>`; }).join('')}
    <ellipse cx="50" cy="54" rx="13" ry="7" fill="none" stroke="#B98C6A" stroke-width="1.6" opacity=".55"/>
    <path d="M44,34 Q40,26 45,20 M54,32 Q58,24 53,18" stroke="#DCE2EA" stroke-width="2.4" fill="none" stroke-linecap="round"/>`); }
  function findStar() { let d = ''; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 17 : 38; d += `${i ? 'L' : 'M'}${50 + Math.cos(a) * r},${52 + Math.sin(a) * r} `; }
    return svg('0 0 100 100', `<path d="${d}Z" fill="#FFD45E" stroke="#F0C04A" stroke-width="2" stroke-linejoin="round"/>${[0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2 - Math.PI / 2; return `<path d="M50,52 L${50 + Math.cos(a) * 34},${52 + Math.sin(a) * 34}" stroke="#F0C04A" stroke-width="1.4"/>`; }).join('')}`); }
  function findTulips() { return bouquet({ f: ['tulip', 'chamomile', 'tulip'], paper: '#E8D3B6', ribbon: '#F08FA8' }, { shadow: false }); }
  function stPockets() { return svg('0 0 100 100', `<path d="M22,30 L78,30 L74,82 Q50,92 26,82 Z" fill="#E9D4B6"/><path d="M22,30 L78,30 L76,42 L24,42 Z" fill="#D9C2A0"/><path d="M27,46 L73,46" stroke="#C9AE88" stroke-width="1.6" stroke-dasharray="3 3"/>
    <g transform="translate(34 14) rotate(-12)">${(function () { let d = ''; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 5 : 11; d += `${i ? 'L' : 'M'}${Math.cos(a) * r},${Math.sin(a) * r} `; } return `<path d="${d}Z" fill="#FFD45E"/>`; })()}</g>
    <path d="M58,34 Q66,8 72,4 Q70,18 62,34 Z" fill="#FFFDF9" stroke="#E9D3B6" stroke-width="1.4"/><rect x="40" y="18" width="18" height="14" rx="2" fill="#F6C6D0" transform="rotate(10 49 25)"/>`); }

  /* ---------- ЗДАНИЯ ---------- */
  function cinemaB() {
    let bulbs = '';
    for (let i = 0; i < 11; i++) bulbs += `<circle cx="${44 + i * 21.2}" cy="88" r="4" fill="#FFD45E"/><circle cx="${44 + i * 21.2}" cy="150" r="4" fill="#FFD45E"/>`;
    const body = `
      <rect x="18" y="52" width="264" height="312" rx="6" fill="#B9475F"/>
      <rect x="10" y="40" width="280" height="20" rx="6" fill="#9E2F47"/>
      <path d="M110,40 L150,8 L190,40 Z" fill="#9E2F47"/>
      <circle cx="150" cy="30" r="9" fill="#FFD45E"/>
      <rect x="34" y="80" width="232" height="78" rx="14" fill="#FFF0CE"/>${bulbs}
      <text x="150" y="104" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="12" letter-spacing="3" fill="#C2405B">КИНОТЕАТР</text>
      <text x="150" y="138" text-anchor="middle" font-family="Comfortaa, Nunito, sans-serif" font-weight="700" font-size="30" fill="#9E2F47">Саспенс</text>
      <rect x="38" y="178" width="66" height="92" rx="6" fill="#2F2834"/><rect x="44" y="184" width="54" height="80" rx="3" fill="#463A4E"/>
      <circle cx="71" cy="214" r="13" fill="#FFF4EC"/><circle cx="71" cy="214" r="6" fill="#2F2834"/><circle cx="73" cy="212" r="2" fill="#fff"/>
      <text x="71" y="252" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#F7C9D3">ТИХИЙ ВЕЧЕР</text>
      <rect x="196" y="178" width="66" height="92" rx="6" fill="#2F2834"/><rect x="202" y="184" width="54" height="80" rx="3" fill="#463A4E"/>
      <text x="229" y="232" text-anchor="middle" font-family="Comfortaa, Nunito, sans-serif" font-weight="700" font-size="40" fill="#F7C9D3">?</text>
      <text x="229" y="256" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8.5" fill="#F7C9D3">СКОРО</text>
      <rect x="114" y="250" width="72" height="114" rx="8" fill="#5A2333"/>
      <rect x="120" y="256" width="28" height="102" rx="5" fill="#73304A"/><rect x="152" y="256" width="28" height="102" rx="5" fill="#73304A"/>
      <circle cx="134" cy="282" r="9" fill="#FFE4B0" opacity=".85"/><circle cx="166" cy="282" r="9" fill="#FFE4B0" opacity=".85"/>
      <rect x="143" y="300" width="3" height="18" rx="1.5" fill="#FFD45E"/><rect x="154" y="300" width="3" height="18" rx="1.5" fill="#FFD45E"/>
      <rect x="108" y="198" width="84" height="34" rx="8" fill="#FFF0CE"/>
      <text x="150" y="220" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="12" fill="#9E2F47">КАССА</text>`;
    return svg('0 0 300 364', body);
  }
  function bureauB() {
    let books = '';
    const cols = ['#F08FA8', '#8FB3D9', '#F7B267', '#BFE6D3', '#B9A5E8', '#C2405B'];
    for (let s = 0; s < 2; s++) for (let i = 0; i < 7; i++) {
      books += `<rect x="${44 + i * 9 + (s ? 0 : 0)}" y="${206 + s * 36 - (i % 3) * 3}" width="7" height="${24 + (i % 3) * 3}" rx="1.5" fill="${cols[(i + s * 2) % 6]}"/>`;
      books += `<rect x="${200 + i * 9}" y="${206 + s * 36 - ((i + 1) % 3) * 3}" width="7" height="${24 + ((i + 1) % 3) * 3}" rx="1.5" fill="${cols[(i + s * 3) % 6]}"/>`;
    }
    const body = `
      <rect x="18" y="36" width="264" height="328" rx="6" fill="#8FB3D9"/>
      <rect x="10" y="26" width="280" height="18" rx="6" fill="#FFFDF9"/>
      <rect x="28" y="62" width="244" height="66" rx="12" fill="#FFFDF9"/>
      <circle cx="58" cy="95" r="18" fill="#BFE6D3"/><path d="M40,95 L76,95 M58,77 Q48,95 58,113 M58,77 Q68,95 58,113" stroke="#2F3A5A" stroke-width="2" fill="none"/>
      <text x="168" y="92" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="17" fill="#2F3A5A" letter-spacing="1">LOST IN</text>
      <text x="168" y="113" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="17" fill="#2F3A5A" letter-spacing="1">TRANSLATION</text>
      <rect x="92" y="138" width="116" height="24" rx="8" fill="#2F3A5A"/>
      <text x="150" y="155" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#FFFDF9">бюро переводов</text>
      <rect x="36" y="186" width="74" height="96" rx="8" fill="#FFFDF9"/><rect x="40" y="190" width="66" height="88" rx="5" fill="#E9F1F9"/>
      <rect x="40" y="232" width="66" height="3" fill="#C9D8E8"/><rect x="40" y="268" width="66" height="3" fill="#C9D8E8"/>
      <rect x="190" y="186" width="74" height="96" rx="8" fill="#FFFDF9"/><rect x="194" y="190" width="66" height="88" rx="5" fill="#E9F1F9"/>
      <rect x="194" y="232" width="66" height="3" fill="#C9D8E8"/><rect x="194" y="268" width="66" height="3" fill="#C9D8E8"/>
      ${books}
      <rect x="116" y="236" width="68" height="128" rx="34" fill="#2F3A5A"/>
      <rect x="124" y="246" width="52" height="40" rx="20" fill="#C9D8E8" opacity=".55"/>
      <circle cx="170" cy="306" r="4" fill="#FFD45E"/>
      <rect x="126" y="292" width="48" height="14" rx="4" fill="#FFFDF9"/>
      <text x="150" y="302.5" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8" fill="#2F3A5A">ОТКРЫТО</text>`;
    return svg('0 0 300 364', body);
  }
  function sweetsB() {
    let stripes = '';
    for (let i = 0; i < 10; i++) stripes += `<path d="M${16 + i * 26.8},168 L${42.8 + i * 26.8},168 L${42.8 + i * 26.8},196 Q${29.4 + i * 26.8},210 ${16 + i * 26.8},196 Z" fill="${i % 2 ? '#FFFDF9' : '#F08FA8'}"/>`;
    const body = `
      <rect x="18" y="40" width="264" height="324" rx="6" fill="#F6C6D0"/>
      <path d="M10,40 Q24,24 38,40 Q52,24 66,40 Q80,24 94,40 Q108,24 122,40 Q136,24 150,40 Q164,24 178,40 Q192,24 206,40 Q220,24 234,40 Q248,24 262,40 Q276,24 290,40 L290,50 L10,50 Z" fill="#FFFDF9"/>
      <rect x="40" y="70" width="220" height="68" rx="34" fill="#FFFDF9"/>
      <text x="150" y="100" text-anchor="middle" font-family="Comfortaa, Nunito, sans-serif" font-weight="700" font-size="22" fill="#C2405B">Сахарная</text>
      <text x="150" y="124" text-anchor="middle" font-family="Comfortaa, Nunito, sans-serif" font-weight="700" font-size="22" fill="#C2405B">пудра</text>
      <rect x="14" y="160" width="272" height="10" rx="5" fill="#C2405B"/>
      ${stripes}
      <rect x="32" y="222" width="138" height="104" rx="12" fill="#FFFDF9"/><rect x="38" y="228" width="126" height="92" rx="8" fill="#FFF3F5"/>
      <rect x="38" y="290" width="126" height="4" fill="#F1CDD6"/>
      <path d="M50,290 L50,272 Q62,258 74,272 L74,290 Z" fill="#F7C9D3"/><path d="M50,272 Q62,264 74,272" stroke="#fff" stroke-width="3" fill="none"/><circle cx="62" cy="262" r="4" fill="#C2405B"/>
      <ellipse cx="102" cy="284" rx="16" ry="7" fill="#E7B47C"/><ellipse cx="102" cy="280" rx="13" ry="4" fill="#FFF8F0"/>
      <rect x="126" y="270" width="26" height="20" rx="4" fill="#C9B6F0"/><rect x="126" y="268" width="26" height="6" rx="3" fill="#FFF6E8"/>
      <rect x="190" y="222" width="70" height="142" rx="35" fill="#C2405B"/>
      <circle cx="225" cy="262" r="18" fill="#FFE4EA" opacity=".8"/>
      <circle cx="248" cy="300" r="4" fill="#FFD45E"/>
      <path d="M225,180 L225,212" stroke="#9E2F47" stroke-width="2"/>`;
    return svg('0 0 300 364', body);
  }
  function roofB(o = {}) {
    let win = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) win += `<rect x="${40 + c * 66}" y="${74 + r * 70}" width="44" height="50" rx="6" fill="#DDE6F0"/><rect x="${40 + c * 66}" y="${97 + r * 70}" width="44" height="3" fill="#BCC8D6"/>`;
    // пожарная лестница: пролёты, в первом сломаны ступеньки
    let stairs = '';
    for (let f = 0; f < 4; f++) {
      const y = 330 - f * 74;
      stairs += `<rect x="186" y="${y}" width="96" height="6" rx="2" fill="#4F5966"/>`;
      stairs += `<path d="M190,${y} L190,${y - 22} M278,${y} L278,${y - 22} M190,${y - 22} L278,${y - 22}" stroke="#4F5966" stroke-width="3" fill="none"/>`;
      const x1 = f % 2 ? 196 : 270, x2 = f % 2 ? 270 : 196;
      if (o.broken && f === 0) {
        // нижний пролёт пропал: огрызки перил и табличка
        stairs += `<path d="M${x2},${y - 74} L${x2 + 14},${y - 60}" stroke="#4F5966" stroke-width="4" stroke-linecap="round"/>`;
        stairs += `<path d="M${x2 - 8},${y - 72} L${x2 + 4},${y - 61}" stroke="#4F5966" stroke-width="4" stroke-linecap="round"/>`;
        stairs += `<path d="M${x1},${y} L${x1 - 12},${y - 12}" stroke="#4F5966" stroke-width="4" stroke-linecap="round"/>`;
        stairs += `<g transform="translate(212 ${y - 50}) rotate(-6)"><path d="M14,-14 L14,0 M50,-14 L50,0" stroke="#6C7682" stroke-width="1.5"/><rect x="0" y="0" width="64" height="26" rx="4" fill="#FFFDF9" stroke="#C2405B" stroke-width="2"/><text x="32" y="11" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="7.5" fill="#C2405B">СТУПЕНЬКИ</text><text x="32" y="20.5" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="7.5" fill="#C2405B">УШЛИ НА ОБЕД</text></g>`;
        continue;
      }
      stairs += `<path d="M${x1},${y} L${x2},${y - 74}" stroke="#4F5966" stroke-width="4"/>`;
      stairs += `<path d="M${x1 + (f % 2 ? 8 : -8)},${y + 2} L${x2 + (f % 2 ? 8 : -8)},${y - 72}" stroke="#4F5966" stroke-width="4"/>`;
      for (let s = 1; s < 8; s++) {
        const t = s / 8, sx = x1 + (x2 - x1) * t, sy = y - 74 * t;
        stairs += `<path d="M${sx - 1},${sy + 1} L${sx + (f % 2 ? 9 : -9)},${sy + 1}" stroke="#6C7682" stroke-width="3.4" stroke-linecap="round"/>`;
      }
    }
    const body = `
      <rect x="18" y="40" width="264" height="364" rx="6" fill="#A3AEBB"/>
      <rect x="10" y="30" width="280" height="16" rx="6" fill="#8A95A3"/>
      <path d="M60,30 L60,4 M48,10 L72,10 M52,18 L68,18" stroke="#6C7682" stroke-width="3"/>
      ${win}
      ${stairs}
      <rect x="40" y="350" width="96" height="54" rx="4" fill="#C9D1DA"/>
      <rect x="196" y="334" width="66" height="70" rx="6" fill="#5C6673"/>
      <rect x="202" y="340" width="54" height="22" rx="4" fill="#FFFDF9"/>
      <text x="229" y="349" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="7" fill="#3A2E3F">ВЫХОД</text>
      <text x="229" y="358" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="7" fill="#3A2E3F">НА КРЫШУ</text>
      <circle cx="252" cy="380" r="3.5" fill="#FFD45E"/>
      ${o.note ? `<rect x="214" y="366" width="28" height="22" fill="#FFFBF2" transform="rotate(4 228 377)"/><circle cx="228" cy="366" r="3" fill="#C2405B"/>` : ''}`;
    return svg('0 0 300 404', body);
  }
  function kiosk() {
    const body = `
      <rect x="10" y="40" width="120" height="120" rx="8" fill="#7FB59A"/>
      <path d="M2,40 Q70,6 138,40 Z" fill="#5E9A7E"/>
      <rect x="20" y="56" width="100" height="56" rx="6" fill="#FFFDF9"/>
      <rect x="26" y="62" width="40" height="44" rx="2" fill="#F2EEE6"/><rect x="74" y="62" width="40" height="44" rx="2" fill="#F2EEE6"/>
      <path d="M30,70 L62,70 M30,78 L58,78 M30,86 L62,86 M78,70 L110,70 M78,78 L106,78" stroke="#B8B0A4" stroke-width="3" stroke-linecap="round"/>
      <text x="70" y="132" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="12" fill="#FFFDF9">ГАЗЕТЫ</text>
      <rect x="18" y="140" width="104" height="20" fill="#5E9A7E"/>`;
    return svg('0 0 140 160', body);
  }
  function weatherBoard() {
    const body = `
      <rect x="54" y="60" width="8" height="90" fill="#6C7682"/>
      <rect x="8" y="10" width="100" height="62" rx="10" fill="#2F3A5A"/>
      <rect x="14" y="16" width="88" height="50" rx="6" fill="#3E4C72"/>
      <text x="58" y="34" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="10" fill="#BFE6D3">ПРОГНОЗ</text>
      <path d="M38,52 Q38,42 48,42 Q52,36 60,40 Q70,38 70,48 Q76,50 74,56 L40,56 Q34,56 38,52 Z" fill="#C9D1DA"/>`;
    return svg('0 0 116 150', body);
  }
  function lamp() {
    return svg('0 0 40 200', `<rect x="17" y="40" width="6" height="160" fill="#5C6673"/><path d="M8,40 L32,40 L28,24 L12,24 Z" fill="#5C6673"/><circle cx="20" cy="44" r="6" fill="#FFE9A8" opacity=".9"/><rect x="11" y="192" width="18" height="8" rx="3" fill="#4F5966"/>`);
  }
  function cloud(w = 120) {
    return svg('0 0 120 60', `<path d="M20,50 Q4,50 6,36 Q8,24 22,26 Q26,8 46,12 Q58,0 74,10 Q92,6 96,24 Q114,24 114,38 Q114,50 100,50 Z" fill="#E7EBF0"/>`);
  }

  /* ---------- КАДР ИЗ ФИЛЬМА (пазл) ---------- */
  function cinemaFrame(o = {}) {
    const bow = o.bow || '#F08FA8', look = lookOf(o);
    const body = `
      <rect width="360" height="240" fill="#EAD9C8"/>
      <rect y="180" width="360" height="60" fill="#B98C6A"/>
      <rect y="176" width="360" height="6" fill="#9C7356"/>
      <ellipse cx="200" cy="214" rx="120" ry="16" fill="#C9A182"/>
      <rect x="18" y="26" width="84" height="96" rx="4" fill="#FFFDF9"/>
      <rect x="24" y="32" width="72" height="84" fill="#9AA6B4"/>
      <path d="M60,32 L60,116 M24,74 L96,74" stroke="#FFFDF9" stroke-width="4"/>
      <path d="M34,40 L30,52 M50,44 L46,56 M78,40 L74,52 M86,58 L82,70 M40,84 L36,96 M70,88 L66,100" stroke="#DDE6F0" stroke-width="2" stroke-linecap="round"/>
      <rect x="122" y="36" width="40" height="30" rx="2" fill="#C9A24A"/><rect x="126" y="40" width="32" height="22" fill="#BFE6D3"/><path d="M126,62 L136,50 L144,58 L150,52 L158,62 Z" fill="#7FB59A"/><circle cx="150" cy="46" r="3" fill="#FFD98A"/>
      <path d="M112,180 L118,160 L134,160 L140,180 Z" fill="#C2405B"/>
      <path d="M126,160 Q114,140 108,132 M126,160 Q126,136 128,124 M126,160 Q138,142 146,136" stroke="#5E9A7E" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="108" cy="131" rx="7" ry="4" fill="#7FB59A" transform="rotate(-30 108 131)"/><ellipse cx="128" cy="122" rx="7" ry="4" fill="#7FB59A" transform="rotate(-80 128 122)"/><ellipse cx="147" cy="135" rx="7" ry="4" fill="#7FB59A" transform="rotate(20 147 135)"/>
      <rect x="158" y="158" width="84" height="7" rx="3" fill="#8A5E44"/><rect x="164" y="165" width="6" height="16" fill="#8A5E44"/><rect x="230" y="165" width="6" height="16" fill="#8A5E44"/>
      <g class="candle"><rect x="164" y="143" width="12" height="15" rx="2.5" fill="#EAF0F4" opacity=".75"/><rect x="165" y="148" width="10" height="9.5" rx="2" fill="#8E8FD0"/>
        <rect x="164.5" y="150.5" width="11" height="3.6" fill="#FFFDF9"/><circle cx="167.6" cy="152.3" r=".9" fill="#3E4A8C"/><circle cx="170" cy="152.6" r=".9" fill="#3E4A8C"/><circle cx="172.3" cy="152.2" r=".9" fill="#3E4A8C"/><ellipse cx="174" cy="151.3" rx="1.2" ry=".6" fill="#7FB59A"/>
        <path d="M170,146.5 L170,144" stroke="#3A2E3F" stroke-width=".7"/><path d="M170,138.5 Q172.4,141.6 170,144.2 Q167.6,141.6 170,138.5 Z" fill="#FFC56A"/>
        <path class="candle-smoke" d="M168,136 Q166,132 168.5,129 Q171,126 169,122 M172,135 Q174,131 171.5,128" stroke="#B9A5E8" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".8"/></g>
      <rect x="24" y="168" width="72" height="5" rx="2" fill="#8A5E44"/><rect x="28" y="173" width="4" height="5" fill="#8A5E44"/><rect x="88" y="173" width="4" height="5" fill="#8A5E44"/>
      <rect x="32" y="147" width="7" height="21" rx="1" fill="#F4C7D0"/><rect x="40" y="149" width="7" height="19" rx="1" fill="#BFE6D3"/><rect x="48" y="146" width="7" height="22" rx="1" fill="#DCCFF2"/>
      <rect x="57" y="148" width="7" height="20" rx="1" fill="#7E2238" transform="rotate(8 60 168)"/><rect x="57.6" y="152" width="5.8" height="1.6" fill="#C9A24A" transform="rotate(8 60 168)"/>
      <path d="M193,158 Q187,144 193,136 L207,136 Q213,144 207,158 Z" fill="#8FB3D9"/>
      <path d="M197,136 Q193,122 189,118 M200,136 L200,114 M203,136 Q207,122 213,118" stroke="#5E9A7E" stroke-width="2.4" fill="none"/>
      <ellipse cx="189" cy="116" rx="5" ry="6.5" fill="#F08FA8"/><ellipse cx="200" cy="111" rx="5" ry="6.5" fill="#F7B267"/><ellipse cx="213" cy="116" rx="5" ry="6.5" fill="#C2405B"/>
      <ellipse cx="200" cy="58" rx="31" ry="42" fill="#C9A24A"/>
      <ellipse cx="200" cy="58" rx="25" ry="36" fill="#DCE8F0"/>
      <path d="M182,36 Q194,30 212,40" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>
      <rect x="180" y="84" width="40" height="4" rx="2" fill="#A8B6C2"/><rect x="184" y="88" width="3.5" height="6" fill="#A8B6C2"/><rect x="212.5" y="88" width="3.5" height="6" fill="#A8B6C2"/>
      <circle cx="272" cy="44" r="25" fill="#FFFDF9" stroke="#8A5E44" stroke-width="4"/>
      <text x="272" y="31" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="10" fill="#3A2E3F">13</text>
      <text x="291" y="48" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3A2E3F">3</text>
      <text x="272" y="66" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3A2E3F">6</text>
      <text x="253" y="48" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3A2E3F">9</text>
      <path d="M272,44 L272,28 M272,44 L284,44" stroke="#3A2E3F" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M232,124 L236,96 L300,96 L304,124 Z" fill="#C2405B"/><rect x="226" y="122" width="84" height="30" rx="10" fill="#D6576F"/>
      <rect x="226" y="118" width="16" height="40" rx="7" fill="#B23A54"/><rect x="294" y="118" width="16" height="40" rx="7" fill="#B23A54"/>
      <rect x="234" y="152" width="6" height="26" fill="#8A3446"/><rect x="296" y="152" width="6" height="26" fill="#8A3446"/>
      <g transform="translate(246 86) scale(.5)">${cat({ sleep: true, noHat: false }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
      <rect x="318" y="0" width="42" height="240" fill="#9E2F47"/>
      <path d="M318,0 Q330,60 320,120 Q332,180 318,240" stroke="#7E2238" stroke-width="3" fill="none"/>
      <path d="M338,0 Q346,70 340,140 Q348,190 342,240" stroke="#7E2238" stroke-width="2" fill="none"/>
      ${look ? `<g transform="translate(320 116) rotate(-10)">${sigIcon(look)}</g>` : `<g transform="translate(320 116) rotate(-20)">
        <path d="M0,0 C-11,-10 -14,7 0,2 Z" fill="${bow}"/><path d="M0,0 C11,-10 14,7 0,2 Z" fill="${bow}"/>
        <circle cx="0" cy="1" r="3" fill="${shade(bow, -18)}"/>
      </g>`}
      <path d="M10,232 L350,232" stroke="rgba(0,0,0,.08)" stroke-width="2"/>`;
    return svg('0 0 360 240', body);
  }
  // примета образа на занавесе кадра (вместо банта; та же точка и та же зона нажатия):
  // пиджак на плечиках, сумочка, очки «кошачий глаз», золотая серьга, сливовый цветок
  function sigIcon(id) {
    switch (id) {
      case 'aurora': return `<path d="M0,-15 Q3.2,-15 3.2,-12 Q3.2,-10 0,-9 L0,-7.5" stroke="#E2C27A" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <path d="M-12,-5 L0,-8.5 L12,-5" stroke="#B88B64" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M-12,-5 L-14,12 L-4.5,13 L0,1 L4.5,13 L14,12 L12,-5 L4.5,-7.5 L0,1 L-4.5,-7.5 Z" fill="#23262E" stroke="#3A3F4A" stroke-width=".8"/>
        <path d="M5,-6 L9,4 L12,11" stroke="#3FA88C" stroke-width="3.2" fill="none" opacity=".9"/><path d="M8,-4 L12,6" stroke="#7CD9B0" stroke-width="1.2" fill="none"/>
        <path d="M-12,6 L-6,10" stroke="#3D4E96" stroke-width="3" opacity=".85"/>`;
      case 'suede': return `<path d="M-6.5,-5 Q0,-15 6.5,-5" stroke="#3A0E10" stroke-width="2.4" fill="none"/>
        <path d="M-13,-1 Q0,-9 13,-1 L15,11 Q0,14 -15,11 Z" fill="#5A1A1C" stroke="#8A3A3A" stroke-width="1.1"/>
        <path d="M-11,-1 Q0,-6.5 11,-1" stroke="#C9A45C" stroke-width="1.3" fill="none"/><rect x="0.5" y="-5.5" width="2" height="4" fill="#C9A45C"/>
        <path d="M-10,4 Q-8,8 -4,9" stroke="#8A3A3A" stroke-width="1.4" fill="none" opacity=".9"/>`;
      case 'pink': return `<path d="M-16,-3 Q-9,-8 -1.5,-4 Q-1,4 -8,5.5 Q-14,5.5 -16,-3 Z" fill="#2B1D1A" stroke="#7A5A50" stroke-width="1"/>
        <path d="M16,-3 Q9,-8 1.5,-4 Q1,4 8,5.5 Q14,5.5 16,-3 Z" fill="#2B1D1A" stroke="#7A5A50" stroke-width="1"/>
        <path d="M-1.5,-3.5 Q0,-5 1.5,-3.5" stroke="#2B1D1A" stroke-width="1.6" fill="none"/>
        <path d="M-12,-2 L-8,2" stroke="#fff" stroke-width="1.2" opacity=".6" stroke-linecap="round"/><path d="M5,-2 L9,2" stroke="#fff" stroke-width="1.2" opacity=".6" stroke-linecap="round"/>`;
      case 'rust': return `<circle cx="0" cy="-11" r="2.8" fill="none" stroke="#A87C30" stroke-width="1.8"/>
        <path d="M0,-7.5 C9,-6 10,6 3.5,11.5 C-4.5,15 -10,7.5 -8,0 C-7,-4.5 -3.5,-6.5 0,-7.5 Z" fill="none" stroke="#E2B85C" stroke-width="3.8"/>
        <path d="M3,-6 C8,-4 9,3 6,8" stroke="#FFE9A8" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
      case 'cream': return `<path d="M-6,-5 Q0,-14 6,-5" stroke="#C7B9A2" stroke-width="2.2" fill="none"/>
        <path d="M-9.5,-3 L9.5,-3 L13,11 L-13,11 Z" fill="#E6DCCB" stroke="#3A2A22" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-9.5,-3 L9.5,-3 L10,0 L-10,0 Z" fill="#F5EFE4"/><rect x="9.6" y="1.5" width="2.6" height="3.2" fill="#E0B860"/>`;
      case 'floral': {
        let p = '';
        for (let i = 0; i < 8; i++) p += `<ellipse cx="0" cy="-7" rx="4.2" ry="7.4" fill="${i % 2 ? '#7E3A5E' : '#5A2440'}" transform="rotate(${i * 45} 0 0)"/>`;
        return `<path d="M2,8 Q10,14 15,10 Q10,6 2,8 Z" fill="#7F8E52"/><path d="M3,8.5 Q9,11 14,10" stroke="#B7B2B5" stroke-width=".8" fill="none"/>${p}
          <circle cx="0" cy="0" r="3.4" fill="#E6E0CC"/><circle cx="0" cy="0" r="1.2" fill="#B9B48E"/>`;
      }
      default: return '';
    }
  }
  function seats() {
    let s = '';
    for (let i = 0; i < 7; i++) s += `<path d="M${i * 66 - 10},70 Q${i * 66 - 10},30 ${i * 66 + 23},30 Q${i * 66 + 56},30 ${i * 66 + 56},70 L${i * 66 + 56},120 L${i * 66 - 10},120 Z" fill="#6E2A3E"/><rect x="${i * 66 - 6}" y="64" width="58" height="12" rx="6" fill="#88344D"/>`;
    return svg('0 0 440 120', s);
  }

  /* ---------- СТИКЕРЫ ---------- */
  function stFilm() {
    return svg('0 0 100 100', `
      <circle cx="40" cy="44" r="28" fill="#4A3B4F"/><circle cx="40" cy="44" r="9" fill="#F7B267"/>
      <circle cx="40" cy="25" r="6" fill="#2F2834"/><circle cx="40" cy="63" r="6" fill="#2F2834"/><circle cx="21" cy="44" r="6" fill="#2F2834"/><circle cx="59" cy="44" r="6" fill="#2F2834"/>
      <path d="M58,62 Q76,76 92,70 L94,86 Q72,92 52,74 Z" fill="#F7B267"/>
      <rect x="64" y="70" width="8" height="8" rx="1" fill="#FFF3D6" transform="rotate(20 68 74)"/><rect x="78" y="76" width="8" height="8" rx="1" fill="#FFF3D6" transform="rotate(10 82 80)"/>
      <path d="M80,16 L83,24 L91,27 L83,30 L80,38 L77,30 L69,27 L77,24 Z" fill="#FFD98A"/>`);
  }
  function stScroll() {
    return svg('0 0 100 100', `
      <rect x="22" y="22" width="56" height="58" rx="4" fill="#FFF3D6"/>
      <rect x="16" y="16" width="68" height="12" rx="6" fill="#E9C98E"/><rect x="16" y="74" width="68" height="12" rx="6" fill="#E9C98E"/>
      <path d="M30,40 L70,40 M30,50 L62,50 M30,60 L68,60" stroke="#C9A26A" stroke-width="3" stroke-linecap="round"/>
      <path d="M50,86 L44,98 L50,95 L56,98 Z" fill="#C2405B"/><circle cx="50" cy="86" r="5" fill="#C2405B"/>`);
  }
  function stDesserts() {
    return svg('0 0 100 100', `
      <g transform="translate(2 34) scale(.42)">${cinnabon({ closed: true }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
      <g transform="translate(55 38) scale(.42)">${macaron({ closed: true }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
      <g transform="translate(30 2) scale(.45)">${bubbletea({ mouth: 'wobble' }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`);
  }
  function teacup(stroke = '#3B2F4F', w = 2.6) {
    return `<path d="M14,22 L44,22 Q44,44 29,44 Q14,44 14,22 Z" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>
      <path d="M44,26 Q54,26 52,34 Q50,40 42,38" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>
      <path d="M10,48 Q29,54 48,48" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>
      <path d="M22,16 Q18,10 23,5 M30,16 Q26,9 31,3 M38,16 Q34,10 39,5" fill="none" stroke="${stroke}" stroke-width="${w * .8}" stroke-linecap="round"/>`;
  }
  function stNote() {
    return svg('0 0 100 100', `
      <rect x="16" y="14" width="68" height="76" rx="3" fill="#FFFBF2" transform="rotate(-6 50 52)"/>
      <circle cx="48" cy="16" r="5" fill="#C2405B"/>
      <g transform="translate(22 28) scale(1)">${teacup('#3B2F4F', 2.8)}</g>`);
  }
  function stSecret() {
    return svg('0 0 100 100', `
      <path d="M50,84 C14,60 14,30 32,24 C42,21 48,28 50,34 C52,28 58,21 68,24 C86,30 86,60 50,84 Z" fill="#A98BE8"/>
      <path d="M34,34 Q38,30 44,33" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M80,14 L82,20 L88,22 L82,24 L80,30 L78,24 L72,22 L78,20 Z" fill="#FFD98A"/>
      <path d="M18,66 L19.5,70 L23.5,71.5 L19.5,73 L18,77 L16.5,73 L12.5,71.5 L16.5,70 Z" fill="#FFD98A"/>`);
  }
  function sunOff() {
    return svg('0 0 100 100', `<circle cx="50" cy="50" r="30" fill="#E8E2D8" stroke="#D3CCC0" stroke-width="3"/><path d="M38,50 Q42,46 46,50 M54,50 Q58,46 62,50" stroke="#9A9184" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M45,60 Q50,63 55,60" stroke="#9A9184" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
  }
  function sunOn() {
    let rays = '';
    for (let i = 0; i < 12; i++) rays += `<rect x="47" y="2" width="6" height="16" rx="3" fill="#FFC857" transform="rotate(${i * 30} 50 50)"/>`;
    return svg('0 0 100 100', `${rays}<circle cx="50" cy="50" r="28" fill="#FFD25E"/>${face(50, 48, 9, { er: 3, mouth: 'big', my: 8 })}`);
  }

  /* ---------- ИНТЕРЬЕРЫ ---------- */
  const inner = s => s.replace(/<svg[^>]*>|<\/svg>/g, '');
  function booth() {
    return svg('0 0 160 120', `
      <rect x="6" y="10" width="148" height="104" rx="14" fill="#1E151D"/>
      <rect x="18" y="22" width="124" height="80" rx="10" fill="#3B2A39"/>
      <circle cx="122" cy="44" r="12" fill="#FFF3D6"/><circle cx="122" cy="44" r="6" fill="#FFD98A"/>
      <g transform="translate(20 22) scale(.9)">${inner(raccoon())}</g>
      <rect x="18" y="92" width="124" height="10" rx="5" fill="#2A1E28"/>`);
  }
  function counter(kind) {
    if (kind === 'bureau') return svg('0 0 400 120', `
      <rect x="0" y="0" width="400" height="18" rx="6" fill="#B8977A"/>
      <rect x="0" y="14" width="400" height="106" fill="#C9AA8B"/>
      <rect x="18" y="30" width="170" height="74" rx="8" fill="#BC9C7E"/><rect x="212" y="30" width="170" height="74" rx="8" fill="#BC9C7E"/>
      <g transform="translate(170 40) rotate(-8)"><rect width="60" height="40" rx="4" fill="#FFFDF9"/><text x="30" y="17" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#C2405B">ПРОВЕРЕНО</text><text x="30" y="30" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#C2405B">СЛОВАРЁМ</text></g>
      <rect x="40" y="-14" width="34" height="16" rx="2" fill="#8FB3D9"/><rect x="44" y="-24" width="30" height="12" rx="2" fill="#F08FA8"/><rect x="330" y="-12" width="22" height="14" rx="3" fill="#FFF3D6"/>`);
    return svg('0 0 400 120', `
      <rect x="0" y="0" width="400" height="18" rx="6" fill="#F3B6C4"/>
      <rect x="0" y="14" width="400" height="106" fill="#F8CBD5"/>
      <path d="M0,40 Q25,58 50,40 Q75,58 100,40 Q125,58 150,40 Q175,58 200,40 Q225,58 250,40 Q275,58 300,40 Q325,58 350,40 Q375,58 400,40" stroke="#FFFDF9" stroke-width="6" fill="none"/>
      <circle cx="60" cy="80" r="9" fill="#FFFDF9" opacity=".7"/><circle cx="200" cy="86" r="9" fill="#FFFDF9" opacity=".7"/><circle cx="340" cy="80" r="9" fill="#FFFDF9" opacity=".7"/>
      <g transform="translate(300 -30)"><path d="M0,30 L40,30 L36,8 L4,8 Z" fill="#FFFDF9"/><ellipse cx="20" cy="8" rx="16" ry="6" fill="#F7C9D3"/><circle cx="20" cy="2" r="4" fill="#C2405B"/></g>`);
  }
  function noteMini() {
    return svg('0 0 60 60', `<rect x="6" y="6" width="48" height="50" rx="2" fill="#FFFBF2" transform="rotate(5 30 30)"/><circle cx="30" cy="8" r="4" fill="#C2405B"/><g transform="translate(10 16) scale(.65)">${teacup('#3B2F4F', 3)}</g>`);
  }

  function pigeon(o = {}) {
    const leg = o.oneLeg
      ? `<path d="M30,44 L30,52" stroke="#E8798F" stroke-width="2" stroke-linecap="round"/><path d="M26,52 L34,52" stroke="#E8798F" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M27,44 L26,52 M33,44 L34,52" stroke="#E8798F" stroke-width="2" stroke-linecap="round"/>`;
    return svg('0 0 60 56', `
      <ellipse cx="30" cy="53" rx="12" ry="2.2" fill="rgba(58,46,63,.15)"/>
      ${leg}
      <path d="M8,30 Q4,26 10,24 L18,30 Z" fill="#7C8592"/>
      <ellipse cx="29" cy="34" rx="16" ry="11" fill="#A9B2BE"/>
      <path d="M20,30 Q30,22 40,32 Q30,40 20,30 Z" fill="#8E97A4"/>
      <ellipse cx="42" cy="26" rx="6" ry="7" fill="#8FA7A0"/>
      <ellipse cx="41" cy="27" rx="4" ry="5" fill="#9D8BC2" opacity=".55"/>
      <circle cx="44" cy="17" r="7" fill="#A9B2BE"/>
      <circle cx="46" cy="16" r="1.6" fill="#2E2A3B"/><circle cx="46.5" cy="15.4" r=".5" fill="#fff"/>
      <path d="M50,17 L55,18.5 L50,20 Z" fill="#E7C27A"/>`);
  }

  // дальний план 2D-улицы: мягкие холмы с рощицей (без сёл и снежных вершин)
  function mountains() {
    let trees = '';
    [[318, 128], [344, 120], [372, 116], [402, 118], [430, 124], [612, 132], [636, 128]].forEach(([x, y], i) => {
      trees += `<path d="M${x},${y - 16 - (i % 2) * 4} L${x + 7},${y} L${x - 7},${y} Z" fill="${i % 2 ? '#9FA6B8' : '#A7AEC0'}"/>`;
    });
    return svg('0 0 800 220', `
      <path d="M0,160 C70,120 140,118 220,138 C300,98 400,84 480,112 C560,92 650,96 720,124 C760,112 790,112 800,116 L800,220 L0,220 Z" fill="#B9B4CC"/>
      <path d="M0,198 C90,160 180,156 270,170 C350,124 450,118 540,148 C630,136 720,140 800,162 L800,220 L0,220 Z" fill="#ADA8C3"/>
      ${trees}`);
  }
  // часовая мастерская на 2D-улице: вывеска с двумя циферблатами, в витрине часы-домик и карманные часы
  function silverShop() {
    const dial = (cx, cy, r, a1, a2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFDF9" stroke="#8E7C6E" stroke-width="1.4"/><path d="M${cx},${cy} L${(cx + Math.sin(a1) * r * 0.5).toFixed(1)},${(cy - Math.cos(a1) * r * 0.5).toFixed(1)} M${cx},${cy} L${(cx + Math.sin(a2) * r * 0.75).toFixed(1)},${(cy - Math.cos(a2) * r * 0.75).toFixed(1)}" stroke="#3A2E3F" stroke-width="1.3" stroke-linecap="round"/>`;
    return svg('0 0 150 200', `
      <rect x="6" y="20" width="138" height="180" rx="6" fill="#8E7C6E"/>
      <path d="M0,24 L75,2 L150,24 Z" fill="#6F5F54"/>
      <rect x="20" y="34" width="110" height="22" rx="6" fill="#F4EFE6"/>
      ${dial(32, 45, 7, 0.5, 2.1)}${dial(118, 45, 7, 5.2, 3.6)}
      <text x="75" y="50" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="12" fill="#6F5F54">ЧАСЫ</text>
      <rect x="18" y="70" width="70" height="80" rx="6" fill="#F4EFE6"/><rect x="22" y="74" width="62" height="72" rx="4" fill="#E7E2D8"/>
      <path d="M36,104 L46,94 L56,104 Z" fill="#6F5F54"/><rect x="38" y="104" width="16" height="26" rx="2" fill="#7A6A5E"/>
      ${dial(46, 112, 5, 0.3, 1.9)}<path d="M46,118 L46,126" stroke="#E8D9A8" stroke-width="1.2"/><circle cx="46" cy="127" r="2" fill="#E8D9A8"/>
      ${dial(68, 128, 6, 5.6, 2.6)}<circle cx="68" cy="120.5" r="1.6" fill="none" stroke="#C9CED8" stroke-width="1.2"/>
      <rect x="98" y="110" width="36" height="90" rx="4" fill="#5E4E44"/><circle cx="127" cy="156" r="2.6" fill="#E8D9A8"/>
      <rect x="18" y="150" width="70" height="6" rx="3" fill="#7A6A5E"/>`);
  }


  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  window.Art = {
    shade, esc, heroine, heroineRaster, heroPic: HeroPic ? { stats: HeroPic.stats, frame: HeroPic.frame, isReady: HeroPic.isReady, whenReady: HeroPic.whenReady, warm: HeroPic.warm, _views: HeroPic.views } : null, cat, FLOWERS, flowerHead, flowerIcon, bouquet, bee, flowerCart, findTicket, findUmbrella, findSweater, findWatch, findFeather, findSaucer, findStar, findTulips, stPockets, raccoon, parrot, goose, bunny, fox, hedgehog,
    cinnabon, macaron, bubbletea, cinemaB, bureauB, sweetsB, roofB, kiosk, weatherBoard, lamp, cloud,
    cinemaFrame, seats, stFilm, stScroll, stDesserts, stNote, stSecret, sunOff, sunOn, teacup, booth, counter, noteMini, pigeon, mountains, silverShop,
  };
})();
