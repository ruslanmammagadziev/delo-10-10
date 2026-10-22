/* =====================================================================
   ПОЕЗДКА В ГОРЫ КАРТОЧКАМИ (волна 3, REGION) — запас для 2D и слабых телефонов.
   Когда 3D-регион не может (движок '2d' / 'street', FORCE2D, лестница качества дошла до низа, потеря WebGL посреди
   поездки), та же поездка идёт тихой книжкой карточек: дорога наверх (3 карточки) → село мастеров (4 карточки с
   жителями: их реплики из js/village/lines.js, голосом — через окно диалога игры) → дорога вниз (1 карточка).
   Картинки нарисованы кодом (SVG, без файлов), осень/зима. Название села — только если named (CONFIG.VILLAGE_NAMED),
   иначе — «Горное село мастеров» и нейтральные реплики (VILLAGE.linesFor(false)).

   API
     Волна 4B / W8: дорога наверх → село: площадь, базарная площадь с лавками, пекарня, мастерская, свадьба во дворе (ряженые —
     пальтары, только при named), башня → из села вторым серпантином на гору, «Отель на вершине», и зиплайн с вершины назад,
     к селу (если отель открыт: CONFIG.UNLOCK.hotel) → вниз. W8: развилки на серпантине больше нет — в отель только через село.
     WORLD.Trip2D.run(o) → Promise<{ done: true, seen: [id…], talked: [speaker…] }>
       o = { named (CONFIG.VILLAGE_NAMED, по умолчанию true), season ('autumn'|'winter'; по умолчанию как WORLD.Regions),
             from: 'city' (вся поездка) | 'up' | 'village' | 'hotel' | 'down' — откуда продолжить (3D бросил посреди пути),
             hotel: false — без отеля и зиплайна,
             host (куда положить; по умолчанию G.layer), say (G.say), voice (G.voiceLine), onCard(i, card) }
     WORLD.Trip2D.cards(o) → [{ id, title, text[], who[], art, act? }] — то же содержимое без показа (для тестов)
   Классы: .t2d (оверлей в #layer, z 50 — окна диалога 60 и листы 75 поверх), .t2d-card, .t2d-art, .t2d-who, .t2d-go.
   HUD v2 (js/world/hud.js): «Сразу в город» — значок 🏙 в правом слоте полосы (HUD.status exit; полоса встаёт над #layer, рядом ☰),
   своя кнопка .t2d-skip тогда спрятана (жива для тестов); карточки начинаются под полосой (--hud-bar-b).
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const G_ = () => window.G || null;
  const V_ = () => window.VILLAGE || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
.t2d{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:calc(58px + var(--safe-top,0px)) 12px calc(14px + var(--safe-bottom,0px));padding:calc(var(--hud-bar-b,50px) + 8px) var(--hud-r,12px) var(--hud-b,14px) var(--hud-l,12px);background:linear-gradient(180deg,#F3D9E6 0%,#FFF4EC 70%);animation:t2dIn .35s ease both;font-family:var(--font,'Nunito',system-ui,sans-serif);color:var(--ink,#3A2E3F)}
.t2d.winter{background:linear-gradient(180deg,#DCE7F2 0%,#F7FAFC 70%)}
@keyframes t2dIn{from{opacity:0}}
.t2d.t2d-hud .t2d-skip{display:none}
.t2d-skip{position:absolute;right:12px;top:calc(64px + var(--safe-top,0px));border:0;border-radius:14px;padding:8px 12px;background:rgba(255,253,249,.92);color:var(--cherry,#C2405B);font:inherit;font-weight:900;font-size:13px;box-shadow:0 3px 0 rgba(58,46,63,.12);cursor:pointer;z-index:2}
.t2d-card{width:100%;max-width:420px;max-height:100%;overflow:auto;background:var(--paper,#FFFDF9);border-radius:26px;box-shadow:0 10px 0 rgba(58,46,63,.10),0 24px 50px rgba(58,46,63,.22);animation:t2dCard .45s cubic-bezier(.2,1.3,.4,1) both}
@keyframes t2dCard{from{opacity:0;transform:translateY(24px) scale(.97)}}
.t2d-art{display:block;width:100%;height:auto;border-radius:26px 26px 0 0;background:#F6E7EB}
.t2d-body{padding:12px 18px 16px}
.t2d-step{font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--cherry,#C2405B)}
.t2d-title{font-family:var(--font-title,inherit);font-weight:700;font-size:21px;color:var(--cherry-d,#9E2F47);margin:2px 0 6px}
.t2d-text p{margin:0 0 8px;font-size:15.5px;line-height:1.4;font-weight:650}
.t2d-who{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
.t2d-who button{display:flex;align-items:center;gap:6px;border:0;border-radius:16px;padding:7px 12px 7px 8px;background:#F6EEF2;color:var(--ink,#3A2E3F);font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 3px 0 rgba(58,46,63,.08)}
.t2d-who button i{font-style:normal;font-size:20px;line-height:1}
.t2d-who button.done{background:#EAF4EE}
.t2d-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.t2d-acts button{flex:1 1 40%;min-height:48px;border:0;border-radius:16px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;background:#F6E7EB;color:var(--ink,#3A2E3F)}
.t2d-acts button.t2d-back{flex:0 0 auto;padding:0 16px}
.t2d-acts button.t2d-go{flex:1 1 auto;background:var(--cherry,#C2405B);color:#fff;box-shadow:0 5px 0 var(--cherry-d,#9E2F47)}
.t2d-body>.t2d-acts{position:sticky;bottom:0;z-index:1;margin:10px -18px -16px;padding:8px 18px 16px;background:var(--paper,#FFFDF9);border-radius:0 0 26px 26px}
.t2d-note{margin-top:6px;font-size:13.5px;font-weight:800;color:var(--ink-2,#6E6272);min-height:1em}
.t2d-tap{display:block;margin:6px auto 0;width:min(60vw,220px);cursor:pointer;touch-action:manipulation}
`;
  function ensureCss() { if (document.getElementById('t2dCss')) return; const st = document.createElement('style'); st.id = 't2dCss'; st.textContent = CSS; document.head.insertBefore(st, document.head.firstChild); }

  /* ---------- картинки (SVG 400 × 260) ---------- */
  function pal(season) {
    const W = season === 'winter';
    return {
      W, sky0: W ? '#CFDDEB' : '#F2CFD8', sky1: W ? '#F5F8FB' : '#FDEFE4', far: W ? '#E3EBF3' : '#E7C9C6', hill: W ? '#F1F5F9' : '#E3B98F', hill2: W ? '#E2EAF1' : '#D49B72',
      tree: W ? ['#FFFFFF', '#EEF3F8', '#F7FAFC'] : ['#E8913B', '#D9663F', '#F2B84B'], trunk: '#8A6A5A', road: W ? '#A7ADB8' : '#B9A99E', roadE: W ? '#FFFFFF' : '#F4E6D8',
      wall: ['#EDE3CF', '#C9B9A2', '#F3EFE6', '#EBC6C0', '#D3C8E2'], roof: W ? '#FFFFFF' : '#C9C2B8', blue: '#4A90D8', cloud: '#FFFFFF', car: '#FCD93A',
      sedan: (() => { try { return !!(WORLD.carChoice && WORLD.carChoice() === 'sedan'); } catch (e) { return false; } })(),
    };
  }
  const svgWrap = (P, inner) => `<svg class="t2d-art" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><defs><linearGradient id="t2dSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky0}"/><stop offset="1" stop-color="${P.sky1}"/></linearGradient></defs><rect width="400" height="260" fill="url(#t2dSky)"/>${inner}${P.W ? snow() : ''}</svg>`;
  function snow() { let s = '<g fill="#fff" opacity=".9">'; for (let i = 0; i < 38; i++) { const x = (i * 97) % 400, y = (i * 53) % 250, r = 1.2 + (i % 3) * 0.7; s += `<circle cx="${x}" cy="${y}" r="${r}"/>`; } return s + '</g>'; }
  const cloud = (x, y, s, o = 1) => `<g fill="#fff" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="34" ry="14"/><ellipse cx="-20" cy="4" rx="22" ry="11"/><ellipse cx="22" cy="5" rx="24" ry="10"/><ellipse cx="4" cy="-9" rx="18" ry="12"/></g>`;
  const tree = (P, x, y, s, i) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="-2" width="4" height="14" rx="2" fill="${P.trunk}"/><circle cx="0" cy="-10" r="12" fill="${P.tree[i % 3]}"/><circle cx="-6" cy="-5" r="8" fill="${P.tree[(i + 1) % 3]}" opacity=".9"/></g>`;
  // жёлтый кабриолет (W7): низкий нос, круглая фара на крыле, покатая корма с «утиным хвостом», рамка стекла; без значков
  const car = (P, x, y, s, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><ellipse cx="0" cy="13" rx="35" ry="5" fill="#000" opacity=".12"/><path d="M-34 7 Q-35 -3 -31 -6 L-29 -8.5 Q-20 -12 -9 -11 L5 -11 Q19 -11 27 -6.5 Q34 -3.5 34 2 L34 8 L-34 8 Z" fill="${P.car}"/><path d="M8.5 -11 L3 -19 L5.6 -19.6 L12 -11 Z" fill="#DDEFF7" opacity=".9" stroke="#3A3440" stroke-width="1.2"/><rect x="-14" y="-15" width="6" height="5" rx="2" fill="#3A3440"/><circle cx="-21" cy="8" r="7.5" fill="#4A3F4F"/><circle cx="21" cy="8" r="7.5" fill="#4A3F4F"/><circle cx="-21" cy="8" r="3.4" fill="#D9DCE4"/><circle cx="21" cy="8" r="3.4" fill="#D9DCE4"/><circle cx="27" cy="-5" r="3.6" fill="#FFF6D8" stroke="#E7DDB0"/><rect x="-33" y="-2" width="5" height="2.6" rx="1.2" fill="#E2405E"/></g>`;
  // красный седан (выбор в гараже города): закрытая крыша, круглые фары, без значков
  const sedan = (P, x, y, s, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><ellipse cx="0" cy="13" rx="38" ry="5" fill="#000" opacity=".12"/><path d="M-37 7 Q-36 -4 -24 -6 L-14 -7 Q-6 -19 8 -19 Q20 -18 26 -7 Q36 -6 38 3 L38 8 L-37 8 Z" fill="#C8102E"/><path d="M-9 -8 Q-3 -16 6 -16 L6 -8 Z M9 -16 Q18 -15 22 -8 L9 -8 Z" fill="#DDEFF7" opacity=".9"/><circle cx="-22" cy="9" r="7" fill="#4A3F4F"/><circle cx="23" cy="9" r="7" fill="#4A3F4F"/><circle cx="-22" cy="9" r="3" fill="#C9C2CE"/><circle cx="23" cy="9" r="3" fill="#C9C2CE"/><circle cx="34" cy="0" r="3.6" fill="#FFF6D8" stroke="#E7DDB0"/></g>`;
  const carArt = (P, x, y, s, flip) => (P.sedan ? sedan(P, x, y, s, flip) : car(P, x, y, s, flip));
  function houses(P, x0, y0, rows, w) {
    let s = '';
    for (let r = 0; r < rows; r++) for (let i = 0; i < 6 - r; i++) {
      const x = x0 + i * w + r * w * 0.5, y = y0 - r * 26, c = P.wall[(i + r * 2) % P.wall.length];
      s += `<rect x="${x}" y="${y}" width="${w - 3}" height="26" fill="${c}"/><rect x="${x - 1}" y="${y - 4}" width="${w - 1}" height="5" rx="1" fill="${P.roof}"/>`;
      s += `<rect x="${x + 5}" y="${y + 8}" width="6" height="8" rx="1" fill="${(i + r) % 3 ? '#4D5A66' : P.blue}"/><rect x="${x + w - 15}" y="${y + 8}" width="6" height="8" rx="1" fill="#4D5A66"/>`;
    }
    return s;
  }
  function towerSvg(P, x, y, s) {
    let z = ''; for (let k = 0; k < 6; k++) z += `<rect x="${-15 + k * 5.6}" y="-52" width="3.2" height="5" fill="#C9A86E"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-15 0 L-14 -47 L14 -47 L15 0 Z" fill="#D9BC86"/><rect x="-16" y="-49" width="32" height="3" fill="#B99A63"/>${z}<rect x="-3" y="-28" width="5" height="8" rx="2" fill="#5A4A3E"/><rect x="5" y="-40" width="3" height="5" rx="1" fill="#5A4A3E"/><path d="M-4 0 Q0 -10 4 0 Z" fill="#5A4A3E"/></g>`;
  }
  const ART = {
    edge: P => svgWrap(P, `<path d="M0 150 Q100 110 200 130 T400 120 L400 260 L0 260 Z" fill="${P.far}"/><path d="M0 190 Q120 160 230 175 T400 165 L400 260 L0 260 Z" fill="${P.hill}"/>
      <path d="M150 260 L190 160 L210 160 L250 260 Z" fill="${P.road}"/><path d="M200 165 L200 180 M200 192 L200 210 M200 224 L200 250" stroke="${P.roadE}" stroke-width="3" stroke-linecap="round"/>
      <rect x="165" y="150" width="9" height="30" rx="3" fill="#E9DED2"/><rect x="226" y="150" width="9" height="30" rx="3" fill="#E9DED2"/><rect x="258" y="128" width="4" height="40" fill="#8A7A70"/><rect x="236" y="116" width="48" height="18" rx="4" fill="#4A7FC0"/><path d="M276 120 l4 5 l-4 5" fill="none" stroke="#fff" stroke-width="2"/>
      ${tree(P, 70, 200, 1.4, 0)}${tree(P, 105, 210, 1.1, 1)}${tree(P, 320, 205, 1.3, 2)}${cloud(90, 70, 1.1)}${cloud(300, 55, 0.9, 0.9)}${carArt(P, 200, 228, 1.25)}`),
    hairpins: P => svgWrap(P, `<path d="M0 120 L400 60 L400 260 L0 260 Z" fill="${P.hill}"/><path d="M0 200 L400 150 L400 260 L0 260 Z" fill="${P.hill2}" opacity=".6"/>
      <path d="M40 240 L330 205 Q352 200 340 188 L80 160 Q60 156 78 146 L330 112 Q350 108 336 98 L120 78" fill="none" stroke="${P.road}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 240 L330 205 Q352 200 340 188 L80 160 Q60 156 78 146 L330 112 Q350 108 336 98 L120 78" fill="none" stroke="${P.roadE}" stroke-width="1.6" stroke-dasharray="6 8"/>
      ${tree(P, 60, 215, 1, 0)}${tree(P, 250, 180, 0.9, 1)}${tree(P, 150, 135, 0.8, 2)}${tree(P, 300, 95, 0.7, 0)}${cloud(330, 40, 0.8)}${carArt(P, 230, 176, 0.75, true)}`),
    clouds: P => svgWrap(P, `<path d="M200 150 Q260 90 330 100 Q370 105 400 90 L400 170 L200 170 Z" fill="${P.far}"/>${towerSvg(P, 318, 104, 0.9)}${houses(P, 250, 140, 2, 22)}
      <g>${cloud(60, 175, 2.2)}${cloud(190, 182, 2.6)}${cloud(330, 178, 2.1)}<rect x="0" y="180" width="400" height="80" fill="#fff"/></g>
      <path d="M0 260 L0 200 Q60 170 120 196 L160 260 Z" fill="${P.hill}"/><path d="M26 200 q4 -16 22 -18 q22 -2 30 10 q4 8 0 12 Z" fill="#A89A8C"/><g transform="translate(52 168)"><ellipse cx="0" cy="6" rx="16" ry="9" fill="#9C7A5E"/><rect x="-11" y="10" width="3.4" height="11" rx="1.6" fill="#7E6048"/><rect x="-4" y="11" width="3.4" height="10" rx="1.6" fill="#7E6048"/><rect x="5" y="11" width="3.4" height="10" rx="1.6" fill="#7E6048"/><rect x="10" y="10" width="3.4" height="11" rx="1.6" fill="#7E6048"/><ellipse cx="15" cy="-4" rx="7" ry="6.5" fill="#A8866A"/><path d="M12 -9 q-4 -12 -14 -12 q8 3 9 12 M17 -9 q0 -12 -9 -15 q6 5 5 15" fill="none" stroke="#6E5A4A" stroke-width="2.6" stroke-linecap="round"/><circle cx="18" cy="-5" r="1.4" fill="#3A2E3F"/><path d="M19 1 q2 4 0 6" stroke="#E9DED2" stroke-width="2" fill="none" stroke-linecap="round"/></g>${car(P, 120, 222, 0.9)}`),
    square: P => svgWrap(P, `${towerSvg(P, 300, 120, 1.25)}<path d="M0 260 L0 210 L400 190 L400 260 Z" fill="${P.hill2}"/>${houses(P, 20, 206, 4, 40)}
      <ellipse cx="120" cy="240" rx="70" ry="10" fill="#fff" opacity=".35"/>${cloud(70, 50, 0.9)}${cloud(220, 40, 0.7, 0.9)}`),
    bakery: P => svgWrap(P, `<rect x="60" y="70" width="280" height="190" rx="10" fill="${P.wall[0]}"/><rect x="50" y="60" width="300" height="16" rx="6" fill="${P.roof}"/>
      <rect x="130" y="110" width="140" height="90" rx="14" fill="#5B4A44"/><rect x="138" y="118" width="124" height="74" rx="10" fill="#F7D9A8"/><ellipse cx="200" cy="176" rx="48" ry="10" fill="#E8B46A"/><ellipse cx="200" cy="172" rx="40" ry="7" fill="#F2C97E"/>
      <path d="M170 104 q-8 -14 0 -26 q8 -12 0 -24 M200 100 q-8 -14 0 -26 q8 -12 0 -24 M230 104 q-8 -14 0 -26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>
      <rect x="110" y="200" width="180" height="10" rx="4" fill="#C9A27E"/><g transform="translate(232 150)"><ellipse cx="0" cy="18" rx="16" ry="18" fill="#FFF6F0"/><ellipse cx="-7" cy="-12" rx="5" ry="16" fill="#FFF6F0"/><ellipse cx="7" cy="-12" rx="5" ry="16" fill="#FFF6F0"/><circle cx="0" cy="4" r="13" fill="#FFF6F0"/><circle cx="-4" cy="2" r="1.8" fill="#3A2E3F"/><circle cx="4" cy="2" r="1.8" fill="#3A2E3F"/><ellipse cx="0" cy="7" rx="2" ry="1.4" fill="#E58FA6"/></g>`),
    workshop: P => svgWrap(P, `<rect x="0" y="170" width="400" height="90" fill="#C9A27E"/><rect x="0" y="166" width="400" height="8" fill="#B08A68"/>
      <rect x="110" y="112" width="180" height="82" rx="18" fill="#DDE3E8" stroke="#9AA6AF" stroke-width="3"/><path d="M140 153 H260 M170 153 q8 -20 22 -24 M170 153 q8 20 22 24 M200 153 q8 -20 22 -24 M200 153 q8 20 22 24 M230 153 q8 -18 18 -20 M230 153 q8 18 18 20" fill="none" stroke="#2F3940" stroke-width="3" stroke-linecap="round"/>
      <rect x="128" y="120" width="34" height="66" rx="12" fill="#fff" opacity=".45" transform="skewX(-16)"/><g transform="translate(318 140) rotate(-30)"><rect x="-3" y="0" width="6" height="56" rx="3" fill="#9C7A5E"/><rect x="-16" y="-10" width="32" height="14" rx="4" fill="#7E8992"/></g>
      <g fill="#FFF3B0">${[[100, 90], [300, 96], [250, 80]].map(([x, y]) => `<path d="M${x} ${y - 8} L${x + 2} ${y - 2} L${x + 8} ${y} L${x + 2} ${y + 2} L${x} ${y + 8} L${x - 2} ${y + 2} L${x - 8} ${y} L${x - 2} ${y - 2} Z"/>`).join('')}</g>`),
    tower: P => svgWrap(P, `${cloud(80, 210, 2.6)}${cloud(250, 220, 3)}${cloud(380, 205, 2.2)}<rect x="0" y="215" width="400" height="45" fill="#fff"/>${towerSvg(P, 200, 210, 2.6)}
      <g transform="translate(110 70)"><path d="M0 0 q-22 -8 -40 4 q18 -2 26 6 q-6 6 -4 12 q10 -10 18 -10 q8 0 18 10 q2 -6 -4 -12 q8 -8 26 -6 q-18 -12 -40 -4 Z" fill="#7A5A44"/><circle cx="0" cy="-3" r="3.5" fill="#F3E5C8"/></g>`),
    // волна 4B / вершина: отель на горе над селом, зиплайн с вершины к домам, базарная площадь, свадьба во дворе
    hotel: P => svgWrap(P, `<path d="M0 138 Q90 100 200 116 T400 104 L400 260 L0 260 Z" fill="${P.far}"/><path d="M0 192 Q140 152 260 170 T400 160 L400 260 L0 260 Z" fill="${P.hill}"/>
      <rect x="146" y="122" width="178" height="8" rx="3" fill="${P.roof}"/><rect x="150" y="128" width="170" height="46" rx="6" fill="#F3EFE6"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${160 + i * 19}" y="138" width="11" height="13" rx="2" fill="#9CC7E0"/>`).join('')}
      <rect x="226" y="156" width="18" height="18" rx="2" fill="#8A6A5A"/>${towerSvg(P, 122, 174, 1.05)}<path d="M122 122 L122 104 L136 109 L122 114" fill="#C2405B" stroke="#8A6A5A" stroke-width="1.2"/>
      <rect x="252" y="176" width="72" height="22" rx="4" fill="#CFEAF5" stroke="#8FB8CC" stroke-width="2"/><path d="M256 190 q8 -4 16 0 t16 0 t16 0 t16 0" stroke="#4A90D8" stroke-width="2" fill="none"/>
      <ellipse cx="80" cy="216" rx="50" ry="14" fill="${P.W ? '#E6EEF4' : '#8FCB6B'}"/><rect x="104" y="192" width="1.8" height="24" fill="#6E6272"/><path d="M106 192 l10 4 l-10 4 Z" fill="#F2B84B"/><circle cx="96" cy="214" r="2.6" fill="#fff"/>
      <g transform="translate(340 222)"><rect x="-12" y="2" width="24" height="5" rx="2" fill="#8A6A5A" transform="rotate(-12)"/><rect x="-12" y="2" width="24" height="5" rx="2" fill="#7A5A4A" transform="rotate(14)"/><path d="M-7 2 Q-6 -12 0 -18 Q5 -10 7 2 Z" fill="#F2B84B"/><path d="M-3 2 Q-2 -6 1 -10 Q3 -5 4 2 Z" fill="#FFE7A8"/></g>
      ${(d => `<path d="${d}" fill="none" stroke="#B9A7C6" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#E6DEEC" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round"/>`)('M2 258 L31 247 L6 236 L32 225 L8 214 L34 203 L12 192 L64 183 L118 176')}
      ${cloud(300, 52, 0.9)}${cloud(80, 66, 0.7, 0.9)}`),
    zipline: P => svgWrap(P, `${cloud(300, 46, 0.8, 0.9)}<path d="M0 118 Q60 98 120 106 L150 260 L0 260 Z" fill="${P.hill}"/><path d="M230 204 Q320 172 400 182 L400 260 L210 260 Z" fill="${P.hill2}"/>
      ${houses(P, 262, 226, 2, 21)}<g transform="translate(78 120) scale(.7)"><path d="M-15 0 L-14 -47 L14 -47 L15 0 Z" fill="#D9BC86"/><rect x="-16" y="-49" width="32" height="3" fill="#B99A63"/></g>
      <path d="M80 82 Q220 164 368 200" stroke="#4E4A52" stroke-width="1.8" fill="none"/>${cloud(170, 236, 2.2)}${cloud(40, 246, 1.6)}
      <g class="t2d-rider" style="transition:transform 2.2s cubic-bezier(.4,0,.3,1)"><g transform="translate(150 124)"><rect x="-5" y="-6" width="10" height="5" rx="2" fill="#F2B84B"/><path d="M0 -1 L0 8" stroke="#3A2E3F" stroke-width="1.4"/><path d="M-7 8 L7 8" stroke="#3A2E3F" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M-6 9 Q-7 24 -3 30 L4 30 Q7 24 6 9 Z" fill="#E9D4B6"/><circle cx="0" cy="4" r="5.2" fill="#F7DCC8"/><ellipse cx="0.5" cy="-0.6" rx="6" ry="2.4" fill="#C2405B"/><path d="M-6 3 Q-8 12 -6 16 M6 3 Q8 12 6 16" stroke="#5A3A2E" stroke-width="2.4" fill="none"/>
      <path d="M-2 30 L-4 38 M3 30 L5 38" stroke="#3A2E3F" stroke-width="2" stroke-linecap="round"/></g></g>
      <path d="M118 112 h-18 M124 120 h-24 M120 128 h-16" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`),
    bazaar: P => svgWrap(P, `<rect x="0" y="150" width="400" height="110" fill="${P.W ? '#EEF2F6' : '#D9CBB8'}"/><path d="M60 152 L60 66 L340 66 L340 152 L304 152 Q200 64 96 152 Z" fill="#C9B9A2"/>
      <rect x="56" y="54" width="288" height="16" rx="3" fill="${P.blue}"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<rect x="${66 + i * 31}" y="58" width="5" height="10" fill="#2F5A8A"/>`).join('')}
      ${[[30, '#C2405B', 'apple'], [150, '#2F7A5E', 'cloth'], [270, '#E2B04E', 'copper']].map(([x, c, k], j) => `<g transform="translate(${x} 166)"><path d="M0 0 L100 0 L92 -18 L8 -18 Z" fill="${c}"/>${[0, 1, 2, 3, 4].map(i => `<path d="M${8 + i * 17} -18 L${16 + i * 17} -18 L${14 + i * 18} 0 L${4 + i * 18} 0 Z" fill="#FFFDF8" opacity=".85"/>`).join('')}
        <rect x="6" y="0" width="88" height="26" rx="3" fill="#B98A5E"/><rect x="6" y="0" width="88" height="5" fill="#8A6A5A"/>
        ${k === 'apple' ? [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${18 + i * 13}" cy="-3" r="5" fill="${i % 3 === 2 ? '#7AA84B' : '#D9463E'}"/>`).join('') + '<circle cx="62" cy="-4" r="2.6" fill="#7A4E8E"/><circle cx="66" cy="-2" r="2.6" fill="#7A4E8E"/><circle cx="64" cy="-7" r="2.6" fill="#7A4E8E"/>'
          : k === 'cloth' ? [0, 1, 2, 3].map(i => `<rect x="${14 + i * 19}" y="-9" width="14" height="9" rx="2" fill="${['#F2B8C6', '#C9DCEF', '#FFF0C8', '#D3C8E2'][i]}"/>`).join('')
          : [0, 1, 2].map(i => `<path d="M${22 + i * 22} -2 q-6 -10 2 -16 q8 6 2 16 Z" fill="#D9874A"/><rect x="${21 + i * 22}" y="-18" width="4" height="3" fill="#B86E38"/>`).join('')}</g>`).join('')}
      ${cloud(320, 30, 0.7, 0.9)}`),
    wedding: P => svgWrap(P, `<rect x="0" y="150" width="400" height="110" fill="#E8DCCB"/><rect x="0" y="70" width="400" height="82" fill="#EDE3CF"/><rect x="0" y="96" width="400" height="8" fill="${P.blue}"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${12 + i * 52}" y="104" width="6" height="46" fill="#7A5A44"/>`).join('')}
      <path d="M0 62 Q100 86 200 66 T400 64" stroke="#8A6A5A" stroke-width="1.2" fill="none"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `<path d="M${10 + i * 33} ${70 + Math.round(Math.sin(i * 0.9) * 6)} l12 0 l-6 12 Z" fill="${['#C2405B', '#F2B84B', '#2F7A5E', '#4A90D8'][i % 4]}"/>`).join('')}
      <rect x="18" y="186" width="116" height="12" rx="3" fill="#F6F1E6"/><rect x="18" y="189" width="116" height="4" fill="#C2405B"/><circle cx="40" cy="184" r="5" fill="#E8B46A"/><circle cx="66" cy="184" r="5" fill="#D9463E"/><circle cx="92" cy="184" r="5" fill="#7AA84B"/>
      <ellipse cx="262" cy="210" rx="78" ry="22" fill="#fff" opacity=".35"/>
      ${[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + 0.4, x = 262 + Math.cos(a) * 68, y = 208 + Math.sin(a) * 18, c = ['#C2405B', '#2F7A5E', '#F2B84B', '#4A90D8', '#E8798F', '#7A4E8E'][i]; return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M-7 0 Q-6 -16 0 -18 Q6 -16 7 0 Z" fill="${c}"/><circle cx="0" cy="-22" r="5.5" fill="#F3E5D0"/><path d="M-5 -10 l-6 -6 M5 -10 l6 -6" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/></g>`; }).join('')}
      <g transform="translate(352 196)"><path d="M-9 4 Q-10 -26 0 -34 Q10 -26 9 4 Z" fill="#3A3238"/><path d="M-5 -24 q5 4 10 0 M-5 -16 q5 4 10 0" stroke="#fff" stroke-width="1.4" fill="none"/><circle cx="-3" cy="-28" r="1.6" fill="#fff"/><circle cx="3" cy="-28" r="1.6" fill="#fff"/><path d="M-9 -20 l-6 -2 M9 -20 l6 -2" stroke="#EDE3CF" stroke-width="1.6"/><circle cx="0" cy="6" r="2" fill="#F2B84B"/></g>
      <g transform="translate(330 150)"><ellipse cx="0" cy="8" rx="11" ry="6" fill="#8A5A3E"/><ellipse cx="0" cy="4" rx="11" ry="5" fill="#F3E5D0"/></g>`),
    down: P => svgWrap(P, `<path d="M0 120 Q120 80 240 100 T400 90 L400 260 L0 260 Z" fill="${P.far}"/>
      ${[[30, 180, 30, 50, '#EBC6C0'], [70, 165, 34, 65, '#F3EFE6'], [112, 175, 28, 55, '#D3C8E2'], [148, 160, 36, 70, '#EDE3CF'], [190, 172, 30, 58, '#C9DCEF'], [228, 158, 34, 72, '#EBC6C0'], [270, 170, 30, 60, '#F3EFE6'], [308, 162, 36, 68, '#EDE3CF'], [350, 176, 34, 54, '#D3C8E2']].map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/><rect x="${x - 2}" y="${y - 5}" width="${w + 4}" height="7" rx="3" fill="${P.W ? '#fff' : '#C98B7A'}"/><rect x="${x + 7}" y="${y + 14}" width="7" height="9" rx="1" fill="#FFE6A8"/><rect x="${x + w - 14}" y="${y + 14}" width="7" height="9" rx="1" fill="#FFE6A8"/>`).join('')}
      <rect x="0" y="225" width="400" height="35" fill="${P.road}"/><path d="M10 243 H390" stroke="${P.roadE}" stroke-width="3" stroke-dasharray="14 12"/>${carArt(P, 210, 236, 1.1, true)}${cloud(320, 50, 0.9)}`),
  };

  /* ---------- содержание карточек ---------- */
  function settings() {
    try { if (WORLD.Regions && WORLD.Regions.settings) return WORLD.Regions.settings(); } catch (e) { /* ignore */ }
    const C = window.CONFIG || {}, d = new Date(), m = d.getMonth();
    return { named: C.VILLAGE_NAMED === undefined ? true : !!C.VILLAGE_NAMED, season: C.VILLAGE_SEASON === 'winter' || C.VILLAGE_SEASON === 'autumn' ? C.VILLAGE_SEASON : (d >= new Date('2026-12-01T00:00') && (m === 11 || m <= 1) ? 'winter' : 'autumn') };
  }
  function cards(o = {}) {
    const st = settings(), named = o.named !== undefined ? !!o.named : st.named, V = V_();
    const A = V.activities ? V.activities(named) : {};
    const title = V.regions && V.regions.kubachi && V.regions.kubachi.title ? V.regions.kubachi.title(named) : 'Наверху';
    const up = [
      { id: 'edge', stage: 'up', title: 'Дорога наверх', text: ['Город остаётся позади. У столбов-ворот — синий щит «' + (named ? title + ' ↑' : 'В горы ↑') + '».', 'Машинка бодро катит к облакам.'], who: [] },
      { id: 'hairpins', stage: 'up', title: 'Серпантин', text: ['Плечо, поворот, снова плечо. Шесть крутых шпилек — руль, газ и тормоз у тебя: машинка сама не сбавляет ход.', 'Можно остановиться, выйти и посидеть на лавочке над долиной.'], who: [] },
      { id: 'clouds', stage: 'up', title: 'Над облаками', text: ['Ещё поворот — и облака остаются внизу. Через долину видна круглая башня.', 'На камне у смотровой стоит тур.'], who: ['tur'] },
    ];
    // волна 4B / W8 / вершина: отель на горе над селом (от школы — вторым серпантином) и зиплайн с вершины назад, к домам —
    // если отель открыт (CONFIG.UNLOCK.hotel).
    // В 2D у отеля одна игра — мини-гольф (act 'golf'): падел и мини-футбол здесь не обещаем
    const hotelOpen = o.hotel !== false && !!(V.regions && V.regions.hotel) && (() => { try { return !WORLD.Regions || !WORLD.Regions.hotelLock || WORLD.Regions.hotelLock().ok; } catch (e) { return true; } })();
    const hotel = hotelOpen ? [
      { id: 'hotel', stage: 'hotel', title: 'Отель на вершине', text: ['Дорога мимо школы — и выше, серпантином на гору, к отелю на вершине.', 'Во дворе башня, бассейн под крышей, мини-гольф, купели с паром и костровой круг. Внизу видны дома ступеньками и круглая башня.'], who: ['hotel_goat', 'hotel_raccoon', 'hotel_otter', 'hotel_bear'], act: 'golf' },
      { id: 'zipline', stage: 'hotel', title: 'Зиплайн вниз', text: ['С башни во дворе натянут трос — с вершины прямо к домам.', 'Руки — на ручку, сама — в обвязку…'], who: ['hotel_marmot'], act: 'zip' },
    ] : [];
    // волна 5B: параплан с башни — если открыт (CONFIG.UNLOCK.paraglider, вместе с поездкой)
    const flyOpen = (() => { try { return !WORLD.Regions || !WORLD.Regions.flyLock || WORLD.Regions.flyLock().ok; } catch (e) { return true; } })();
    const village = [
      { id: 'square', stage: 'village', title, text: ['Дома стоят ступеньками: плоская крыша нижнего — двор верхнего.', 'Машина ждёт на парковке, а дальше — пешком.'], who: ['pony', 'mtn_sheep', 'granny_hedgehog'] },
      { id: 'bazaar', stage: 'village', title: (A.bazaar && A.bazaar.title) || 'Базарная площадь', text: ((A.bazaar && A.bazaar.text) || ['Раз в неделю здесь большой базар.']).concat(['Над площадью — арка-мост с голубой галереей.']), who: ['goat_grocer', 'bear_craft', 'lamb_cloth', 'squirrel_nuts'], act: 'shop' },
      { id: 'bakery', stage: 'village', title: (A.bakery && A.bakery.title) || 'Пекарня', text: ['Из окошка пахнет тёплым тестом. Зайка протягивает покупку прямо в ладошки.'], who: ['baker_bunny', 'roof_cat'], act: 'bakery' },
      { id: 'workshop', stage: 'village', title: (A.workshop && A.workshop.title) || 'Мастерская', text: ['Гравировка, чернь, полировка — три шага до блеска.', 'Тапни по пластине три раза.'], who: ['badger', 'mouse'], act: 'workshop' },
      { id: 'wedding', stage: 'village', title: 'Свадьба во дворе', text: named ? ['Во дворе большого дома — свадьба: живая музыка, круг танца и общий стол.', 'Высокие пальтары в кольчугах и войлочных масках пляшут, хлопают и веселят гостей.'] : ['Во дворе большого дома — свадьба: живая музыка, круг танца и общий стол.', 'Высокие ряженые в кольчугах и масках пляшут, хлопают и веселят гостей.'], who: ['wed_bride', 'wed_groom', 'wed_zurna', 'wed_drum', 'wed_aunt', 'paltar'], act: 'dance' },
      { id: 'tower', stage: 'village', title: (A.tower && A.tower.title) || 'Башня', text: ((A.tower_top && A.tower_top.text) || ['Внизу — море облаков и крыши ступеньками.']).slice(0, 2).concat(flyOpen ? ['С площадки башни можно полететь на параплане — над крышами и обратно на землю.'] : []), who: ['eagle', 'owl_keeper', 'spring_hedgehog'] },
    ];
    // W8: после отеля — назад через площадь, к машине (трос приносит к домам), и вниз
    const down = [{ id: 'down', stage: 'down', title: 'Вниз, к городу', text: (hotel.length ? ['Трос приносит назад, к домам: через площадь — к машине на парковке.'] : []).concat(['Шпилька за шпилькой — и вот уже знакомые улицы и фонари.']), who: [], last: true }];
    const from = o.from || 'city';
    // W8: порядок — дорога наверх → село → отель (выше села) → назад через село → вниз
    const list = from === 'down' ? down : from === 'hotel' ? hotel.concat(down) : from === 'village' ? village.concat(hotel, down) : up.concat(village, hotel, down);
    return list.map(c => Object.assign({ art: c.id }, c));
  }
  // реплики жителя: села (lines.js) или тура (serpentine.js → VILLAGE.ROAD_LINES), с учётом named
  const pickN = (l, named) => (named === false && l.n ? { who: l.n.who, text: l.n.text } : { who: l.who, text: l.text });
  function linesOf(id, named) {
    const V = V_();
    if (V.linesFor) { const L = V.linesFor(named); if (L[id] && L[id].length) return L[id]; }
    const R = V.ROAD_LINES && V.ROAD_LINES[id];
    if (R) return R.map(l => pickN(l, named));
    const W = V.wedding && V.wedding.LINES && V.wedding.LINES[id];
    if (W && W.length) return W.map(l => pickN(l, named));
    if (V.hotel && V.hotel.linesFor) { const H = V.hotel.linesFor(named); if (H[id] && H[id].length) return H[id]; }
    return [];
  }
  function speakerOf(id, named) {
    const V = V_();
    for (const S of [V.SPEAKERS, V.wedding && V.wedding.SPEAKERS, V.hotel && V.hotel.SPEAKERS]) if (S && S[id]) return { name: named === false && S[id].n ? S[id].n : S[id].name, icon: S[id].icon };
    if (id === 'tur') return { name: 'Тур', icon: '🐐' };
    return { name: id, icon: '🐾' };
  }
  // строка события модуля гор: { who, text } (озвучена) — с учётом named
  function evLine(src, key, named) { const e = src && src[key]; return e ? pickN(e, named) : null; }

  function run(o = {}) {
    ensureCss();
    const st = settings(), named = o.named !== undefined ? !!o.named : st.named, season = o.season === 'winter' || o.season === 'autumn' ? o.season : st.season;
    const P = pal(season), list = cards(Object.assign({}, o, { named }));
    const g = G_();
    const say = o.say || (g && g.say ? l => g.say(l) : null);
    const voice = o.voice || (g && g.voiceLine ? (w, t, op) => g.voiceLine(w, t, op) : null);
    const host = o.host || (g && g.layer) || document.body;
    const seen = [], talked = [], idx = {};
    // говорящие села в окне диалога — на время карточек
    const prev = {};
    if (g && g.addSpeakers && g.speakers) {
      const add = {};
      ['tur', 'badger', 'owl_keeper', 'eagle', 'roof_cat', 'pony', 'mtn_sheep', 'baker_bunny', 'spring_hedgehog', 'mouse', 'granny_hedgehog', 'pigeon_metro',
        'cow', 'goat_grocer', 'bear_craft', 'lamb_cloth', 'squirrel_nuts', 'wed_bride', 'wed_groom', 'wed_zurna', 'wed_drum', 'wed_aunt', 'wed_kid', 'paltar',
        'hotel_goat', 'hotel_raccoon', 'hotel_otter', 'hotel_bear', 'hotel_marmot'].forEach((id, i) => { const sp = speakerOf(id, named); prev[id] = g.speakers[id] || null; add[id] = { name: () => sp.name, art: () => (g.emojiAvatar ? g.emojiAvatar(sp.icon || '🐾', ['#E6EEF6', '#F6E7EB', '#EEF3E2', '#FFF0DC'][i % 4]) : '') }; });
      g.addSpeakers(add);
    }
    const restore = () => { if (!g || !g.speakers) return; Object.keys(prev).forEach(id => { if (prev[id]) g.speakers[id] = prev[id]; else delete g.speakers[id]; }); };
    return new Promise(res => {
      const H = window.HUD && window.HUD.v && window.HUD.status && document.getElementById('hudStatus') ? window.HUD : null;
      const ov = document.createElement('div'); ov.className = 't2d' + (season === 'winter' ? ' winter' : '') + (H ? ' t2d-hud' : '');
      ov.innerHTML = '<button class="t2d-skip" type="button" aria-label="Сразу в город">Сразу в город</button><div class="t2d-card"></div>';
      host.appendChild(ov);
      const card = ov.querySelector('.t2d-card');
      let i = 0, done = false;
      // полоса на время карточек: ☰ · 🏙 (цель города — спрятана, после поездки — как была)
      const prevStatus = H && H.status.get ? H.status.get() : null, prevObj = H && H.objective && H.objective.get ? H.objective.get() : null;
      const finish = () => {
        if (done) return; done = true; restore();
        if (H) { try { H.status(prevStatus); if (prevObj && H.objective) H.objective.set(Object.assign({}, prevObj, { bounce: false })); } catch (x) { /* ok */ } }
        ov.style.transition = 'opacity .35s'; ov.style.opacity = '0'; setTimeout(() => ov.remove(), 380); res({ done: true, seen, talked });
      };
      if (H) { try { H.status({ kind: 'exit', icon: '🏙', label: 'Сразу в город', onTap: finish }); if (prevObj && H.objective) H.objective.set(null); } catch (x) { /* ok */ } }
      ov.querySelector('.t2d-skip').addEventListener('click', e => { e.stopPropagation(); finish(); });
      const stepName = c => (c.stage === 'up' ? 'Дорога наверх' : c.stage === 'down' ? 'Дорога вниз' : 'Пешком');
      function show(k) {
        const c = list[k]; i = k; seen.push(c.id);
        const who = c.who.filter(id => linesOf(id, named).length);
        card.innerHTML = (ART[c.art] ? ART[c.art](P) : '') + `<div class="t2d-body"><div class="t2d-step">${esc(stepName(c))} · ${k + 1} / ${list.length}</div><div class="t2d-title">${esc(c.title)}</div><div class="t2d-text">${c.text.map(t => `<p>${esc(t)}</p>`).join('')}</div>`
          + (who.length ? `<div class="t2d-who">${who.map(id => { const sp = speakerOf(id, named); return `<button type="button" data-who="${esc(id)}"><i>${esc(sp.icon || '🐾')}</i>${esc(sp.name)}</button>`; }).join('')}</div>` : '')
          + `<div class="t2d-act"></div><div class="t2d-note"></div><div class="t2d-acts">${k > 0 && !c.last ? '<button type="button" class="t2d-back">← Назад</button>' : ''}<button type="button" class="t2d-go">${c.last ? 'В город' : 'Дальше →'}</button></div></div>`;
        card.scrollTop = 0;
        card.querySelectorAll('.t2d-who button').forEach(b => b.addEventListener('click', async e => {
          e.stopPropagation(); const id = b.dataset.who, L = linesOf(id, named); if (!L.length) return;
          const n = idx[id] || 0; idx[id] = (n + 1) % L.length; talked.push(id); b.classList.add('done');
          try { if (g && g.haptic) g.haptic('light'); } catch (x) { /* нет */ }
          if (say) await say([L[n]]); else card.querySelector('.t2d-note').textContent = speakerOf(id, named).name + ': ' + L[n].text;
        }));
        const actBox = card.querySelector('.t2d-act'), note = card.querySelector('.t2d-note');
        if (c.act === 'bakery') {
          const A = V_().activities ? V_().activities(named) : {}, menu = (A.bakery && A.bakery.menu) || ['Пирог', 'Хлеб'];
          actBox.innerHTML = `<div class="t2d-acts">${menu.slice(0, 4).map((m, j) => `<button type="button" data-m="${j}">${esc(m)}</button>`).join('')}</div>`;
          actBox.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); note.textContent = ((A.bakery && A.bakery.after) || 'Вкусно!') + ' ' + ((A.bakery && A.bakery.drink) || ''); actBox.querySelectorAll('button').forEach(x => { x.disabled = true; }); }));
        }
        if (c.act === 'workshop') {
          const A = V_().activities ? V_().activities(named) : {}, W = A.workshop || {};
          actBox.innerHTML = `<svg class="t2d-tap" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="184" height="94" rx="20" fill="#DDE3E8" stroke="#9AA6AF" stroke-width="3"/><path class="cut" d="M40 55 H160 M70 55 q8 -20 22 -24 M70 55 q8 20 22 24 M100 55 q8 -20 22 -24 M100 55 q8 20 22 24" fill="none" stroke="#7D8992" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 6"/><rect class="shine" x="20" y="14" width="34" height="82" rx="12" fill="#fff" opacity="0" transform="skewX(-16)"/></svg>`;
          let taps = 0; const steps = W.steps || [];
          const svg = actBox.querySelector('svg'), cut = svg.querySelector('.cut'), shine = svg.querySelector('.shine');
          svg.addEventListener('click', e => {
            e.stopPropagation(); if (taps >= 3) return; taps++;
            if (taps === 1) cut.setAttribute('stroke-dasharray', 'none');
            if (taps === 2) cut.setAttribute('stroke', '#2F3940');
            if (taps === 3) shine.setAttribute('opacity', '.65');
            note.textContent = taps < 3 ? ((steps[taps] && steps[taps].title) || 'Дальше') + '…' : 'Блестит! ' + (W.reward ? W.reward + ' — на память.' : '');
          });
        }
        // волна 4B: мини-гольф (три удара), зиплайн, лавка базара (монетка — покупка в ладошки), танец «Хоп!» и угощение
        const Vv = V_(), voiceIt = l => { try { if (l && voice) voice(l.who, l.text, { mode: 'bubble' }); } catch (x) { /* без голоса */ } };
        const btns = (list2, fn) => { actBox.innerHTML = `<div class="t2d-acts">${list2.map((m, j) => `<button type="button" data-m="${j}">${esc(m)}</button>`).join('')}</div>`; actBox.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); fn(+b.dataset.m, b); })); };
        if (c.act === 'golf') {
          let tries = 0; const E = Vv.hotel && Vv.hotel.EVENTS;
          btns(['⛳ Ударить'], (j, b) => {
            tries++; const holed = tries >= 2 && (tries === 3 || Math.random() < 0.5), l = evLine(E, holed ? 'golfHoled' : tries >= 3 ? 'golfOut' : 'golfMiss', named);
            note.textContent = (l ? speakerOf('hotel_raccoon', named).name + ': ' + l.text : '') + (holed ? ' ⛳' : ''); voiceIt(l);
            if (holed || tries >= 3) b.disabled = true;
          });
        }
        if (c.act === 'zip') {
          const E = Vv.hotel && Vv.hotel.EVENTS, ready = evLine(E, 'zipReady', named);
          btns(['🪂 Держись крепче — поехали!'], (j, b) => {
            b.disabled = true; voiceIt(ready);
            const r = card.querySelector('.t2d-rider'); if (r) r.style.transform = 'translate(196px, 66px)';
            note.textContent = 'Вжу-у-ух! С вершины — вниз, к домам, и мягко на настил «Финиш».';
          });
        }
        if (c.act === 'shop') {
          const A2 = Vv.activities ? Vv.activities(named) : {}, F = A2.shop_food || {}, C2 = A2.shop_craft || {}, L2 = A2.shop_cloth || {};
          const goods = [[F, (F.items || [])[0], 'shopThanks_food', 'goat_grocer'], [C2, (C2.items || [])[1], 'shopThanks_craft', 'bear_craft'], [L2, (L2.items || [])[0], 'shopThanks_cloth', 'lamb_cloth']].filter(g => g[1]);
          const bag = [];
          btns(goods.map(g => g[1].title), (j, b) => {
            const [, it, th, who] = goods[j], l = Vv.eventLine ? Vv.eventLine(th, named) : null;
            b.disabled = true; bag.push(it.title); voiceIt(l);
            note.textContent = 'Монетка — в лапку, ' + it.title.toLowerCase() + ' — в ладошки. ' + (it.hero || '') + ' В сумке: ' + bag.join(', ') + '.';
            void who;
          });
        }
        if (c.act === 'dance') {
          let hops = 0; const E = Vv.wedding && Vv.wedding.EVENTS;
          btns(['Хоп!', named ? 'Угоститься чуду' : 'Угоститься пирожком'], (j, b) => {
            if (j === 0) { hops++; note.textContent = hops < 4 ? 'Хоп! ' + '♪'.repeat(hops) : ((evLine(E, 'danceGood', named) || {}).text || 'Ух, как здорово!'); if (hops >= 4) b.disabled = true; try { if (g && g.sfx) g.sfx('drum'); } catch (x) { /* без звука */ } }
            else { b.disabled = true; const t = E && E.treat && E.treat.chudu ? evLine(E.treat, 'chudu', named) : null; note.textContent = (t && t.text) || 'Ммм, вкусно!'; }
          });
        }
        const back = card.querySelector('.t2d-back'); if (back) back.addEventListener('click', e => { e.stopPropagation(); show(Math.max(0, i - 1)); });
        card.querySelector('.t2d-go').addEventListener('click', e => { e.stopPropagation(); try { if (g && g.haptic) g.haptic('light'); } catch (x) { /* нет */ } if (k + 1 >= list.length) finish(); else show(k + 1); });
        try { if (o.onCard) o.onCard(k, c); } catch (x) { /* ignore */ }
      }
      show(0);
    });
  }

  WORLD.Trip2D = { run, cards, can: () => true, version: 2 };
})();
