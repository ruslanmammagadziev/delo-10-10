/* =====================================================================
   «БЕГ ПО КУБАЧИ» — ИНТЕРФЕЙС РАННЕРА (роль UI): window.VILLAGE.runnerUI
   Экраны (заставка, пауза, конец забега), HUD забега (очки, монеты со значком, метры и множитель, усилители с таймером,
   пауза), баннер этапа, подсказки свайпов первого забега — DOM поверх холста; и синтезированные звуки раннера.
   Обычный <script>, без модулей и без THREE. Стиль — как HUD игры (токены css/style.css: --cherry, --ink, --paper,
   --hud-safe-t, --tg-content-top…; шрифты css/fonts.css: Nunito, Comfortaa, Caveat); без них — свои значения по умолчанию.

   Контракт (SPEC.md, «Контракты между частями»; как зовёт ядро — NOTES роли CORE §3):
     create(ctx) → ui         ctx: { root (DOM-контейнер: у него pointer-events none, у кнопок — auto), named, haptic(kind),
                                     sfx(name, data), onStart, onExit, onPause, onResume }
     ui.screen('start', { title, best, bestDist, coins, runs, first, named }) — заставка: название, рекорд, «Бежать!»,
               «Как играть», «Выйти»; 'run' — HUD; 'pause', { score, coins, dist } — «Дальше» / «Выйти»;
               'over', { score, coins, dist, best, bestDist, record, stage, totalCoins, runs, named } — «Пальтар догнал!»,
               счёт, монеты, рекорд (✨ «Новый рекорд!»), «Ещё раз» / «Выйти»
     ui.hud(h)       — каждый кадр, ОДИН объект { score, coins, dist, mult, stage, power: [{ id, t, T }] }: DOM трогаем только
                       там, что изменилось (числа — textContent, кольцо таймера — не чаще 10 раз в секунду)
     ui.banner(text) — «Этап 2 — Базарная площадь»: «Этап 2» мелко сверху, название крупно; сам уходит через 2,6 с
     ui.tutorial(step) — 'lr' | 'up' | 'down' | null: подсказка свайпа (палец по стрелке)
     ui.dispose()    — DOM, стили, таймеры
   VILLAGE.runnerUI.sound({ audio() → AudioContext | null, bus() → AudioNode | null }) → sfx(name, data) — синтезированные
     эффекты раннера через звук игры (G.audio / G.audioBus('sfx'): звук выключен — audio() даёт null, тишина). Имена — события
     ядра (NOTES CORE §4): step, lane, edge, jump, land, slide, drop, boing, coin (pitch 0…12 — серия выше), power, powerEnd,
     glideStart, glideEnd, moveStart (cow | cart | barrels), stumble, crash, caught, jingle (n — дистанция), crack, stage,
     record, over, start, pause, resume, tap. Музыки нет — точка подключения дорожки у хоста (host.music).

   Почему так:
     • Кнопки — <button> (ядро не считает касание кнопки свайпом), карточки — с data-runner-ui (касание карточки — не свайп).
     • HUD — один и тот же объект каждый кадр: сравнение с прошлым и запись только изменившегося — без пересборки DOM и без
       перерасчёта раскладки на каждом кадре; монетка «подпрыгивает» через Web Animations (без reflow-трюков).
     • Заставка и конец забега — «карточка сверху, кнопки снизу»: пара героиня + пальтар (кадр ядра, ~40–75 % высоты)
       остаётся видна посередине — и на заставке, и в сцене поимки (карточка снизу закрывала пару).
     • Нейтральная сборка (named === false): строки с названием села и словами «пальтар»/«каз» — отдельными литералами в
       ветке named (сборщик их вычищает), рядом — нейтральные («ряженый», «горное село»).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 12 345 — тонкие пробелы между разрядами
  const fmt = n => String(Math.max(0, Math.floor(+n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const plural = (n, a, b, c) => { n = Math.abs(Math.floor(n)) % 100; const k = n % 10; return n > 10 && n < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
  const fmtM = m => { m = Math.max(0, Math.floor(+m || 0)); return m < 10000 ? fmt(m) + ' м' : (m / 1000).toFixed(1).replace('.', ',') + ' км'; };

  // серебряная монетка с кубачинской розеткой (8 лепестков, точки по кругу) — значок HUD и карточек
  const COIN = '<svg class="rui-coin" viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="ruiCg" cx="35%" cy="30%" r="75%">' +
    '<stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#DCE0E4"/><stop offset="1" stop-color="#8E959C"/></radialGradient></defs>' +
    '<circle cx="20" cy="20" r="18.5" fill="url(#ruiCg)" stroke="#7D848B" stroke-width="1.5"/><circle cx="20" cy="20" r="14.5" fill="none" stroke="#A7AEB4" stroke-width="1"/>' +
    '<g fill="#9AA1A8">' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<ellipse cx="20" cy="12.6" rx="2.3" ry="5" transform="rotate(${a} 20 20)"/>`).join('') + '</g>' +
    '<circle cx="20" cy="20" r="3.2" fill="#F4F6F8" stroke="#8E959C"/>' +
    '<g fill="#B9C0C6">' + Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<circle cx="${(20 + Math.cos(a) * 16.6).toFixed(2)}" cy="${(20 + Math.sin(a) * 16.6).toFixed(2)}" r=".9"/>`; }).join('') + '</g>' +
    '<path d="M10 11 Q14 7 19 6.5" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/></svg>';
  const POWER = {
    magnet: { icon: '🏺', name: 'Кувшин-магнит', cls: 'mag' },
    x2: { icon: '×2', name: 'Двойное серебро', cls: 'x2' },
    glide: { icon: '🪂', name: 'Параплан', cls: 'gl' },
  };

  /* ---------------------------------------------------------------------
     СТИЛИ (один <style> на интерфейс; классы rui-*)
     --------------------------------------------------------------------- */
  const CSS = `
.rui{position:absolute;inset:0;pointer-events:none;font-family:var(--font,'Nunito',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);color:var(--ink,#3A2E3F);
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;z-index:30;overflow:hidden;
  --r-top:calc(var(--hud-safe-t,env(safe-area-inset-top,0px)) + var(--tg-content-top,0px) + 10px);
  --r-bot:calc(var(--hud-safe-b,env(safe-area-inset-bottom,0px)) + 14px);
  --r-l:calc(env(safe-area-inset-left,0px) + 12px);--r-r:calc(env(safe-area-inset-right,0px) + 12px);
  --r-cherry:var(--cherry,#C2405B);--r-cherry-d:var(--cherry-d,#9E2F47);--r-paper:var(--paper,#FFFDF9);--r-ink2:var(--ink-2,#6E6272);
  --r-glass:var(--hud-glass,rgba(255,253,249,.90));--r-shadow:var(--hud-shadow,0 3px 0 rgba(58,46,63,.10),0 8px 18px rgba(58,46,63,.10))}
/* размеры — с полями внутри (как в css/style.css игры): на стенде без style.css карточки не шире экрана */
.rui,.rui *,.rui *::before,.rui *::after{box-sizing:border-box}
.rui button{pointer-events:auto;font:inherit;border:0;cursor:pointer;-webkit-appearance:none;appearance:none;touch-action:manipulation}
.rui .rui-coin{width:1.15em;height:1.15em;flex:none;vertical-align:-.2em;filter:drop-shadow(0 1px 0 rgba(58,46,63,.18))}
/* --- HUD --- */
.rui-hud{position:absolute;left:var(--r-l);right:var(--r-r);top:var(--r-top);display:flex;align-items:flex-start;gap:6px;opacity:0;transform:translateY(-8px);transition:opacity .25s,transform .25s}
.rui.run .rui-hud{opacity:1;transform:none}
.rui-pill{background:var(--r-glass);border-radius:16px;box-shadow:var(--r-shadow);padding:5px 11px 4px;white-space:nowrap;font-weight:900;line-height:1.05;-webkit-backdrop-filter:blur(var(--hud-blur,8px));backdrop-filter:blur(var(--hud-blur,8px))}
.rui-score{min-width:74px}
.rui-score b{display:block;font-size:22px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.rui-pill small{display:block;font-size:10.5px;font-weight:800;color:var(--r-ink2);letter-spacing:.02em}
.rui-coins{display:flex;align-items:center;gap:5px;font-size:19px;padding:8px 11px 7px;font-variant-numeric:tabular-nums}
.rui-dist{font-size:15.5px;padding:7px 10px 6px;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}
.rui-mult{display:none;background:linear-gradient(180deg,#FFE7A6,#F7B267);color:#7A4A12;border-radius:10px;padding:2px 6px 1px;font-size:13px;box-shadow:0 2px 0 rgba(122,74,18,.25)}
.rui-mult.on{display:inline-block}
.rui-pill{flex:none}
.rui-sp{flex:1;min-width:0}
.rui-pause{flex:none;width:46px;height:46px;border-radius:16px;background:var(--r-glass);box-shadow:var(--r-shadow);display:grid;place-items:center}
.rui-pause i{display:block;width:14px;height:16px;border-left:5px solid var(--ink,#3A2E3F);border-right:5px solid var(--ink,#3A2E3F);border-radius:2px}
.rui-pw{position:absolute;left:var(--r-l);top:calc(var(--r-top) + 58px);display:flex;gap:8px;opacity:0;transition:opacity .2s}
.rui.run .rui-pw{opacity:1}
.rui-chip{position:relative;width:46px;height:46px;border-radius:50%;background:var(--r-glass);box-shadow:var(--r-shadow);display:grid;place-items:center;font-size:21px;font-weight:900}
.rui-chip.x2 b{font-size:15px;color:#8A5A12}
.rui-chip svg{position:absolute;inset:-3px;width:52px;height:52px;transform:rotate(-90deg)}
.rui-chip circle{fill:none;stroke-width:4;stroke-linecap:round}
.rui-chip .bg{stroke:rgba(58,46,63,.10)}
.rui-chip .fg{stroke:var(--r-cherry);transition:stroke-dashoffset .12s linear}
.rui-chip.mag .fg{stroke:#C77D4F}.rui-chip.x2 .fg{stroke:#E2B04E}.rui-chip.gl .fg{stroke:#5FA8D3}
.rui-chip em{position:absolute;bottom:-13px;left:50%;transform:translateX(-50%);font-style:normal;font-size:10.5px;font-weight:900;color:#FFFDF9;background:rgba(58,46,63,.72);border-radius:8px;padding:0 5px;line-height:15px;white-space:nowrap}
.rui-chip.low{animation:rui-blink .5s ease-in-out infinite alternate}
@keyframes rui-blink{to{opacity:.45}}
/* --- баннер этапа --- */
.rui-ban{position:absolute;left:50%;top:calc(var(--r-top) + 118px);transform:translate(-50%,-10px) scale(.85);opacity:0;pointer-events:none;
  background:linear-gradient(180deg,#FFFBEA,#FFF1C7);border:3px solid #E8C770;border-radius:22px;padding:8px 22px 9px;text-align:center;
  box-shadow:0 5px 0 rgba(168,122,34,.22),0 12px 26px rgba(58,46,63,.18);white-space:nowrap;max-width:calc(100% - 32px)}
.rui-ban.on{animation:rui-ban 2.6s cubic-bezier(.2,.9,.3,1.2) both}
.rui-ban small{display:block;font-weight:900;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#A87A22}
.rui-ban b{display:block;font-family:var(--font-title,'Comfortaa','Nunito',sans-serif);font-weight:700;font-size:20px;color:#7A4A2A;overflow:hidden;text-overflow:ellipsis}
.rui-ban::before,.rui-ban::after{content:'✦';position:absolute;top:50%;transform:translateY(-50%);color:#E2B04E;font-size:15px}
.rui-ban::before{left:7px}.rui-ban::after{right:7px}
@keyframes rui-ban{0%{opacity:0;transform:translate(-50%,-14px) scale(.7)}12%{opacity:1;transform:translate(-50%,0) scale(1.05)}20%{transform:translate(-50%,0) scale(1)}86%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-8px) scale(.96)}}
/* --- подсказки свайпов --- */
/* подсказка — на всю ширину между полями (не left:50%: тогда ширина текста — половина экрана), строка переносится на узком;
   ВНИЗУ, под героиней (на 54 % палец и карточка ложились прямо на неё в первые секунды первого забега) */
.rui-tut{position:absolute;left:var(--r-l);right:var(--r-r);bottom:calc(var(--r-bot) + 6px);display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.rui-tut.on{display:flex;animation:rui-in .25s ease-out both}
.rui-tut .pad{position:relative;width:170px;height:96px}
.rui-tut .ar{position:absolute;left:50%;top:50%;font-size:46px;font-weight:900;color:#FFFDF9;text-shadow:0 2px 0 rgba(58,46,63,.35),0 0 18px rgba(255,255,255,.6);transform:translate(-50%,-50%)}
.rui-tut .fi{position:absolute;left:50%;top:50%;font-size:44px;filter:drop-shadow(0 3px 2px rgba(58,46,63,.35))}
.rui-tut.lr .fi{animation:rui-lr 1.1s ease-in-out infinite}
.rui-tut.up .fi{animation:rui-up 1s ease-in-out infinite}
.rui-tut.down .fi{animation:rui-down 1s ease-in-out infinite}
.rui-tut p{margin:0;background:rgba(58,46,63,.78);color:#FFFDF9;font-weight:900;font-size:17px;padding:9px 16px;border-radius:16px;max-width:100%;text-align:center;text-wrap:balance;box-shadow:0 4px 14px rgba(58,46,63,.25)}
@keyframes rui-lr{0%,100%{transform:translate(-110%,-30%) rotate(-12deg)}50%{transform:translate(10%,-30%) rotate(12deg)}}
@keyframes rui-up{0%{transform:translate(-40%,20%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translate(-40%,-90%);opacity:0}}
@keyframes rui-down{0%{transform:translate(-40%,-90%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translate(-40%,20%);opacity:0}}
@keyframes rui-in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
/* --- экраны --- */
.rui-scr{position:absolute;inset:0;display:none;pointer-events:none}
.rui-scr.on{display:block}
.rui-start .head{position:absolute;left:var(--r-l);right:var(--r-r);top:calc(var(--r-top) + 6px);text-align:center;animation:rui-drop .5s cubic-bezier(.2,.9,.3,1.25) both}
.rui-title{margin:0;font-family:var(--font-title,'Comfortaa','Nunito',sans-serif);font-weight:700;font-size:31px;line-height:1.08;color:var(--r-cherry);
  text-shadow:0 2px 0 #FFFDF9,2px 0 0 #FFFDF9,-2px 0 0 #FFFDF9,0 -2px 0 #FFFDF9,0 4px 0 rgba(158,47,71,.25),0 8px 18px rgba(58,46,63,.18)}
.rui-sub{margin:4px 0 0;font-family:var(--font-hand,'Caveat',cursive);font-weight:700;font-size:24px;color:#5A3E52;text-shadow:0 1px 0 #FFFDF9,0 0 10px rgba(255,253,249,.9)}
.rui-stats{display:inline-flex;gap:8px;margin-top:9px;flex-wrap:wrap;justify-content:center}
.rui-stats span{background:var(--r-glass);border-radius:14px;padding:5px 11px;font-weight:900;font-size:14px;box-shadow:var(--r-shadow);display:inline-flex;align-items:center;gap:5px}
.rui-start .foot{position:absolute;left:var(--r-l);right:var(--r-r);bottom:var(--r-bot);display:flex;flex-direction:column;align-items:center;gap:10px;animation:rui-rise .5s .1s cubic-bezier(.2,.9,.3,1.2) both}
.rui-go{width:min(100%,330px);height:64px;border-radius:22px;background:linear-gradient(180deg,#D4506B,var(--r-cherry));color:#FFFDF9;font-weight:900;font-size:23px;
  box-shadow:0 6px 0 var(--r-cherry-d),0 12px 24px rgba(158,47,71,.32);letter-spacing:.01em;transition:transform .08s}
.rui-go:active,.rui-soft:active{transform:translateY(3px)}
.rui-go:active{box-shadow:0 3px 0 var(--r-cherry-d),0 6px 14px rgba(158,47,71,.3)}
.rui-row{display:flex;gap:10px;width:min(100%,330px)}
.rui-soft{flex:1;height:50px;border-radius:18px;background:var(--r-paper);color:var(--ink,#3A2E3F);font-weight:900;font-size:16px;box-shadow:0 5px 0 #E8D9DE,0 10px 18px rgba(58,46,63,.10);transition:transform .08s}
.rui-new{position:relative}
.rui-new::after{content:'';position:absolute;top:7px;right:9px;width:9px;height:9px;border-radius:50%;background:var(--r-cherry);box-shadow:0 0 0 2px #FFFDF9}
.rui-dim{position:absolute;inset:0;background:rgba(58,46,63,.34);pointer-events:auto;animation:rui-fade .2s ease-out both}
.rui-card{position:absolute;left:50%;transform:translateX(-50%);width:min(calc(100% - 32px),360px);background:var(--r-paper);border-radius:26px;padding:18px 18px 16px;
  box-shadow:0 10px 0 rgba(58,46,63,.08),0 18px 40px rgba(58,46,63,.28);text-align:center;pointer-events:auto}
.rui-card h2{margin:0;font-family:var(--font-title,'Comfortaa','Nunito',sans-serif);font-weight:700;font-size:25px;color:var(--r-cherry);line-height:1.15}
.rui-card .line{margin:5px 0 0;font-family:var(--font-hand,'Caveat',cursive);font-size:22px;font-weight:700;color:#6E5468}
.rui-card .btns{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:14px}
.rui-pause-card{top:50%;transform:translate(-50%,-50%);animation:rui-pop .28s cubic-bezier(.2,.9,.3,1.3) both}
.rui-over-card{top:var(--r-top);padding:14px 16px 12px;animation:rui-drop2 .45s cubic-bezier(.2,.9,.3,1.15) both}
.rui-over .foot{position:absolute;left:var(--r-l);right:var(--r-r);bottom:var(--r-bot);display:flex;justify-content:center;--rx:0;animation:rui-rise .45s .12s cubic-bezier(.2,.9,.3,1.2) both}
.rui-over .foot .rui-row{width:min(100%,340px)}.rui-over .foot .rui-go{flex:2;width:auto;height:60px}.rui-over .foot .rui-soft{flex:1;height:60px}
.rui-big{margin:10px 0 2px;font-weight:900;font-size:44px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.rui-big small{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--r-ink2);margin-top:4px}
.rui-facts{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px}
.rui-facts span{background:#F6EFF2;border-radius:14px;padding:6px 11px;font-weight:900;font-size:15px;display:inline-flex;align-items:center;gap:5px}
.rui-best{margin-top:9px;font-weight:800;font-size:14px;color:var(--r-ink2)}
.rui-rec{display:none;margin:2px auto 0;background:linear-gradient(90deg,#FFE7A6,#FFD0DA,#D9CCF4,#FFE7A6);background-size:300% 100%;border-radius:14px;padding:6px 14px;
  font-weight:900;font-size:17px;color:#7A3E52;animation:rui-shine 2.4s linear infinite,rui-pop2 .5s .25s cubic-bezier(.2,.9,.3,1.4) both;width:max-content}
.rui-rec.on{display:block}
.rui-howto{top:50%;transform:translate(-50%,-50%);text-align:left;animation:rui-pop .28s cubic-bezier(.2,.9,.3,1.3) both;max-height:calc(100% - 40px);overflow:auto}
.rui-howto h2{text-align:center}
.rui-g{display:grid;grid-template-columns:44px 1fr;gap:8px 10px;align-items:center;margin-top:12px}
.rui-g i{font-style:normal;width:44px;height:44px;border-radius:14px;background:#F6EFF2;display:grid;place-items:center;font-size:22px;font-weight:900}
.rui-g b{font-weight:900;font-size:15px}.rui-g span{display:block;font-size:13.5px;font-weight:700;color:var(--r-ink2);line-height:1.25}
.rui-note{margin:12px 0 0;font-size:13.5px;font-weight:700;color:var(--r-ink2);line-height:1.3;text-align:center}
@keyframes rui-pop{from{opacity:0;transform:translate(-50%,-50%) scale(.86)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes rui-pop2{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.rui-over-card .rui-big{margin-top:4px;font-size:40px}.rui-over-card .rui-facts{margin-top:7px}.rui-over-card .rui-best{margin-top:7px}
@keyframes rui-rise{from{opacity:0;transform:translate(var(--rx,-50%),40px)}to{opacity:1;transform:translate(var(--rx,-50%),0)}}
@keyframes rui-drop{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:none}}
@keyframes rui-drop2{from{opacity:0;transform:translate(-50%,-24px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes rui-fade{from{opacity:0}to{opacity:1}}
@keyframes rui-shine{to{background-position:300% 0}}
.rui-start .foot{--rx:0}
.rui-over-card .rui-coin{width:1.05em;height:1.05em}
@media (max-width:380px){.rui-hud{gap:4px}.rui-pill{padding:4px 8px 3px}.rui-score{min-width:64px}.rui-score b{font-size:19px}.rui-coins{font-size:17px;padding:7px 9px 6px;gap:4px}
  .rui-dist{font-size:14px;padding:7px 8px 6px;gap:4px}.rui-mult{font-size:12px;padding:2px 5px 1px}.rui-pause{width:42px;height:42px}.rui-title{font-size:28px}}
@media (max-height:760px){.rui-tut .pad{height:78px}.rui-tut .ar{font-size:40px}.rui-tut .fi{font-size:38px}.rui-tut p{font-size:16px;padding:8px 14px}}
@media (max-height:700px){.rui-title{font-size:27px}.rui-sub{font-size:21px}.rui-go{height:58px;font-size:21px}.rui-soft{height:46px}.rui-big,.rui-over-card .rui-big{font-size:34px}.rui-card{padding:14px 16px 13px}.rui-over-card{padding:12px 14px 10px}.rui-over-card .line{font-size:20px}.rui-over .foot .rui-go,.rui-over .foot .rui-soft{height:54px}}
@media (orientation:landscape) and (max-height:500px){.rui-ban{top:calc(var(--r-top) + 64px)}.rui-tut{bottom:calc(var(--r-bot) + 2px)}.rui-over-card{width:min(calc(100% - 32px),420px)}}
@media (prefers-reduced-motion:reduce){.rui *{animation-duration:.01s!important;animation-iteration-count:1!important}}
`;

  /* ---------------------------------------------------------------------
     ТЕКСТЫ (мило, без имени героини; нейтральные варианты — отдельными литералами)
     --------------------------------------------------------------------- */
  function texts(named) {
    const N = named !== false;
    return {
      sub: N ? 'Убегай от пальтара — собирай серебро!' : 'Убегай от ряженого — собирай серебро!',
      over: N ? 'Пальтар догнал!' : 'Ряженый догнал!',
      overLines: N
        ? ['Звяк-звяк! Он просто хотел поздороваться.', 'Пальтар доволен: догонялки удались!', 'Ещё разок? Бубенцы уже звенят!', 'Почти убежала! Он бегает быстро.']
        : ['Звяк-звяк! Он просто хотел поздороваться.', 'Ряженый доволен: догонялки удались!', 'Ещё разок? Бубенцы уже звенят!', 'Почти убежала! Он бегает быстро.'],
      chase: N ? 'Пальтар отстаёт, пока ты не спотыкаешься. Споткнулась\u00a0— он тут как тут, второй раз\u00a0— догонит!'
        : 'Ряженый отстаёт, пока ты не спотыкаешься. Споткнулась\u00a0— он тут как тут, второй раз\u00a0— догонит!',
      pause: ['Передышка. Ветер в горах подождёт.', 'Пауза! Монетки никуда не денутся.', 'Отдышись\u00a0— бег продолжится с того же места.'],
    };
  }

  /* ---------------------------------------------------------------------
     ИНТЕРФЕЙС
     --------------------------------------------------------------------- */
  function create(ctx) {
    ctx = ctx || {};
    const host = ctx.root || document.body, named = ctx.named !== false, TX = texts(named);
    const hap = k => { try { if (ctx.haptic) ctx.haptic(k || 'light'); } catch (e) { /* ok */ } };
    const snd = n => { try { if (ctx.sfx) ctx.sfx(n, {}); } catch (e) { /* ok */ } };
    const style = document.createElement('style'); style.textContent = CSS; style.dataset.runnerUi = '1';
    document.head.appendChild(style);
    // сам слой — без data-runner-ui и с pointer-events: none (касание сквозь него — свайп по холсту); карточкам и подложкам —
    // data-runner-ui (касание по ним — не свайп), кнопки ядро отсеивает само
    const el = document.createElement('div'); el.className = 'rui';
    el.innerHTML =
      '<div class="rui-hud"><div class="rui-pill rui-score"><b data-k="score">0</b><small>очки</small></div>' +
      '<div class="rui-pill rui-coins">' + COIN + '<b data-k="coins">0</b></div>' +
      '<div class="rui-pill rui-dist"><b data-k="dist">0 м</b><span class="rui-mult" data-k="mult">×2</span></div>' +
      '<div class="rui-sp"></div><button class="rui-pause" aria-label="Пауза" title="Пауза"><i></i></button></div>' +
      '<div class="rui-pw"></div>' +
      '<div class="rui-ban"><small></small><b></b></div>' +
      '<div class="rui-tut"><div class="pad"><div class="ar"></div><div class="fi">👆</div></div><p></p></div>' +
      '<div class="rui-scr rui-start"></div><div class="rui-scr rui-pause-scr"></div><div class="rui-scr rui-over"></div><div class="rui-scr rui-how"></div>';
    host.appendChild(el);
    const $ = s => el.querySelector(s);
    const K = { score: $('[data-k=score]'), coins: $('[data-k=coins]'), dist: $('[data-k=dist]'), mult: $('[data-k=mult]'), coinIc: $('.rui-coins .rui-coin'), pw: $('.rui-pw'), ban: $('.rui-ban'), tut: $('.rui-tut') };
    const S = { start: $('.rui-start'), pause: $('.rui-pause-scr'), over: $('.rui-over'), how: $('.rui-how') };
    const last = { score: -1, coins: -1, dist: -1, mult: -1, pw: '' };
    let cur = '', banT = 0, alive = true, lastStart = null;
    $('.rui-pause').addEventListener('click', e => { e.stopPropagation(); hap('light'); if (ctx.onPause) ctx.onPause(); });

    // кнопки экранов: data-a → действие (касание кнопки — не свайп: это <button>)
    function bind(box) {
      box.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const a = b.dataset.a; hap(a === 'start' || a === 'again' ? 'medium' : 'light'); snd('tap');
        if (a === 'start' || a === 'again') { if (ctx.onStart) ctx.onStart(); }
        else if (a === 'resume') { if (ctx.onResume) ctx.onResume(); }
        else if (a === 'exit') { if (ctx.onExit) ctx.onExit(); }
        else if (a === 'how') howTo(true);
        else if (a === 'howClose') howTo(false);
      }));
    }
    function show(name) {
      Object.keys(S).forEach(k => S[k].classList.toggle('on', k === name));
    }
    function startScreen(d) {
      d = d || {};
      lastStart = d;
      const title = d.title || (V.runner && V.runner.title ? V.runner.title(named, true) : 'Бег');
      const stats = (d.best > 0 ? '<span>🏆 ' + fmt(d.best) + '</span>' : '') + (d.bestDist > 0 ? '<span>🏁 ' + fmtM(d.bestDist) + '</span>' : '') + (d.coins > 0 ? '<span>' + COIN + ' ' + fmt(d.coins) + '</span>' : '');
      S.start.innerHTML = '<div class="head"><h1 class="rui-title">' + esc(title) + '</h1><p class="rui-sub">' + esc(TX.sub) + '</p>' +
        (stats ? '<div class="rui-stats">' + stats + '</div>' : '') + '</div>' +
        '<div class="foot"><button class="rui-go" data-a="start">Бежать!</button>' +
        '<div class="rui-row"><button class="rui-soft' + (d.first ? ' rui-new' : '') + '" data-a="how">Как играть</button><button class="rui-soft" data-a="exit">Выйти</button></div></div>';
      bind(S.start);
    }
    function pauseScreen(d) {
      d = d || {};
      S.pause.innerHTML = '<div class="rui-dim" data-runner-ui></div><div class="rui-card rui-pause-card" data-runner-ui><h2>Пауза</h2><p class="line">' + esc(TX.pause[Math.floor(Math.random() * TX.pause.length)]) + '</p>' +
        '<div class="rui-facts"><span>⭐ ' + fmt(d.score) + '</span><span>' + COIN + ' ' + fmt(d.coins) + '</span><span>🏁 ' + fmtM(d.dist) + '</span></div>' +
        '<div class="btns"><button class="rui-go" data-a="resume">Дальше</button><div class="rui-row"><button class="rui-soft" data-a="how">Как играть</button><button class="rui-soft" data-a="exit">Выйти</button></div></div></div>';
      bind(S.pause);
    }
    function overScreen(d) {
      d = d || {};
      const line = TX.overLines[Math.floor(Math.random() * TX.overLines.length)];
      // карточка — сверху, кнопки — снизу: сцена поимки (пара посередине кадра, ~40–75 % высоты) остаётся видна, как на заставке
      S.over.innerHTML = '<div class="rui-card rui-over-card" data-runner-ui><h2>' + esc(TX.over) + '</h2><p class="line">' + esc(line) + '</p>' +
        '<div class="rui-rec' + (d.record ? ' on' : '') + '">✨ Новый рекорд! ✨</div>' +
        '<div class="rui-big">' + fmt(d.score) + '<small>очки</small></div>' +
        '<div class="rui-facts"><span>' + COIN + ' +' + fmt(d.coins) + '</span><span>🏁 ' + fmtM(d.dist) + '</span>' + (d.stage > 1 ? '<span>🏔 этап ' + (d.stage | 0) + '</span>' : '') + '</div>' +
        '<div class="rui-best">' + (!d.record && d.best > d.score ? 'До рекорда\u00a0— ещё ' + fmt(d.best - d.score) + '\u00a0' + plural(d.best - d.score, 'очко', 'очка', 'очков') + (d.bestDist > d.dist ? ' (' + fmtM(d.bestDist - d.dist) + ')' : '') : 'Рекорд: ' + fmt(d.best)) +
          (d.totalCoins > 0 ? ' · всего монет: ' + fmt(d.totalCoins) : '') + '</div>' +
        '</div><div class="foot"><div class="rui-row"><button class="rui-go" data-a="again">Ещё раз</button><button class="rui-soft" data-a="exit">Выйти</button></div></div>';
      bind(S.over);
      if (d.record) hap('success');
    }
    // «Как играть»: свайпы, усилители, кто догоняет (поверх заставки или паузы; «Понятно!» — назад)
    let howFrom = '';
    function howTo(on) {
      if (on) {
        howFrom = cur;
        S.how.innerHTML = '<div class="rui-dim" data-runner-ui></div><div class="rui-card rui-howto" data-runner-ui><h2>Как играть</h2><div class="rui-g">' +
          '<i>⇆</i><div><b>Свайп влево-вправо</b><span>сменить полосу (или стрелки, A / D)</span></div>' +
          '<i>↑</i><div><b>Свайп вверх</b><span>прыжок через сено, лавки и корзины (пробел, W)</span></div>' +
          '<i>↓</i><div><b>Свайп вниз</b><span>подкат под ковры и балки; в прыжке — быстро вниз (S)</span></div>' +
          '<i>' + COIN + '</i><div><b>Серебряные монетки</b><span>с узором-розеткой: каждая\u00a0— 10\u00a0очков</span></div>' +
          '<i>🏺</i><div><b>Кувшин-магнит</b><span>монетки сами летят к тебе</span></div>' +
          '<i style="font-size:17px">×2</i><div><b>Двойное серебро</b><span>каждая монетка — за две</span></div>' +
          '<i>🪂</i><div><b>Параплан</b><span>полёт над улицей за монетками</span></div></div>' +
          '<p class="rui-note">' + esc(TX.chase) + '</p><div class="btns"><button class="rui-go" data-a="howClose">Понятно!</button></div></div>';
        bind(S.how); show('how');
      } else {
        show(howFrom === 'pause' ? 'pause' : howFrom === 'start' ? 'start' : '');
        if (howFrom === 'start' && lastStart) { lastStart.first = false; const b = S.start.querySelector('.rui-new'); if (b) b.classList.remove('rui-new'); }
      }
    }
    function screen(name, d) {
      if (!alive) return;
      cur = name;
      el.classList.toggle('run', name === 'run' || name === 'pause');
      if (name === 'run') { show(''); return; }
      tutorial(null);
      if (name === 'start') { startScreen(d); show('start'); clearBanner(); }
      else if (name === 'pause') { pauseScreen(d); show('pause'); }
      else if (name === 'over') { overScreen(d); show('over'); clearBanner(); el.classList.remove('run'); }
    }

    // HUD: только изменившееся; кольца таймеров — по десятым секунды
    const pwEls = {};
    function chip(id) {
      if (pwEls[id]) return pwEls[id];
      const P = POWER[id] || { icon: '★', cls: '' }, c = document.createElement('div');
      c.className = 'rui-chip ' + P.cls; c.title = P.name || '';
      c.innerHTML = '<svg viewBox="0 0 52 52"><circle class="bg" cx="26" cy="26" r="23"/><circle class="fg" cx="26" cy="26" r="23" stroke-dasharray="144.5" stroke-dashoffset="0"/></svg><b>' + P.icon + '</b><em></em>';
      pwEls[id] = { el: c, fg: c.querySelector('.fg'), em: c.querySelector('em'), k: -1, s: -1, low: false };
      return pwEls[id];
    }
    let pwKey = '';
    function hud(h) {
      if (!alive || !h) return;
      if (h.score !== last.score) { last.score = h.score; K.score.textContent = fmt(h.score); }
      if (h.coins !== last.coins) {
        const up = h.coins > last.coins && last.coins >= 0; last.coins = h.coins; K.coins.textContent = fmt(h.coins);
        if (up && K.coinIc.animate) { try { K.coinIc.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); } catch (e) { /* ok */ } }
      }
      if (h.dist !== last.dist) { last.dist = h.dist; K.dist.textContent = fmtM(h.dist); }
      if (h.mult !== last.mult) {
        const up = h.mult > last.mult && last.mult > 0; last.mult = h.mult; K.mult.textContent = '×' + h.mult; K.mult.classList.toggle('on', h.mult > 1);
        if (up && K.mult.animate) { try { K.mult.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.4)' }); } catch (e) { /* ok */ } }
      }
      // усилители: набор (порядок) — пересобрать только при смене состава
      const P = h.power || [];
      let key = ''; for (let i = 0; i < P.length; i++) key += P[i].id + ',';
      if (key !== pwKey) {
        pwKey = key; while (K.pw.firstChild) K.pw.removeChild(K.pw.firstChild);
        for (let i = 0; i < P.length; i++) { const c = chip(P[i].id); c.k = -1; c.s = -1; K.pw.appendChild(c.el); if (c.el.animate) { try { c.el.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }); } catch (e) { /* ok */ } } }
      }
      for (let i = 0; i < P.length; i++) {
        const p = P[i], c = pwEls[p.id], f = p.T > 0 ? clamp(p.t / p.T, 0, 1) : 0, k = Math.round(f * 100), s = Math.ceil(p.t);
        if (k !== c.k) { c.k = k; c.fg.setAttribute('stroke-dashoffset', String((144.5 * (1 - f)).toFixed(1))); }
        if (s !== c.s) { c.s = s; c.em.textContent = s + ' с'; const low = p.t < 2.5; if (low !== c.low) { c.low = low; c.el.classList.toggle('low', low); } }
      }
    }
    function clearBanner() { clearTimeout(banT); K.ban.classList.remove('on'); }
    function banner(text) {
      if (!alive) return;
      const s = String(text || ''), i = s.indexOf(' — ');
      K.ban.querySelector('small').textContent = i > 0 ? s.slice(0, i) : '';
      K.ban.querySelector('b').textContent = i > 0 ? s.slice(i + 3) : s;
      K.ban.classList.remove('on'); void K.ban.offsetWidth; K.ban.classList.add('on');   // перезапуск анимации — раз на этап
      clearTimeout(banT); banT = setTimeout(() => K.ban.classList.remove('on'), 2700);
    }
    const TUT = { lr: ['⇆', 'Свайп влево или вправо\u00a0— другая полоса'], up: ['↑', 'Свайп вверх\u00a0— прыжок!'], down: ['↓', 'Свайп вниз\u00a0— подкат!'] };
    let tutCur = null;
    function tutorial(step) {
      if (!alive || step === tutCur) return;
      tutCur = step || null;
      const t = K.tut;
      t.classList.remove('on', 'lr', 'up', 'down');
      if (!step || !TUT[step]) return;
      t.querySelector('.ar').textContent = TUT[step][0]; t.querySelector('p').textContent = TUT[step][1];
      void t.offsetWidth; t.classList.add('on', step);
    }
    function dispose() {
      if (!alive) return; alive = false;
      clearTimeout(banT);
      if (el.parentNode) el.parentNode.removeChild(el);
      if (style.parentNode) style.parentNode.removeChild(style);
    }
    return { screen, hud, banner, tutorial, dispose, get screenName() { return cur; }, el };
  }

  /* ---------------------------------------------------------------------
     ЗВУК: синтез (как js/engine.js sfx — мягкая палитра: маримба, колокольчик, шорох), через шину эффектов игры
     --------------------------------------------------------------------- */
  function sound(o) {
    o = o || {};
    const audio = typeof o.audio === 'function' ? o.audio : () => null, bus = typeof o.bus === 'function' ? o.bus : () => null;
    let noiseBuf = null, noiseCtx = null, stepN = 0;
    const lastAt = {};
    // не чаще: одинаковый звук — с паузой (монеты — 40 мс, шаги — 90, бубенцы — 120)
    const GAP = { coin: 0.04, step: 0.09, jingle: 0.12, lane: 0.06 };
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
    function env(a, g, t, vol, att, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur); }
    function osc(a, out, type, f, t, dur, vol, op) {
      op = op || {};
      const s = a.createOscillator(), g = a.createGain(); s.type = type; s.frequency.setValueAtTime(f, t);
      if (op.to) s.frequency.exponentialRampToValueAtTime(op.to, t + (op.toT || dur));
      env(a, g, t, vol, op.att || 0.004, dur);
      let n = s; if (op.lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = op.lp; s.connect(fl); n = fl; }
      n.connect(g); g.connect(out); s.start(t); s.stop(t + (op.att || 0.004) + dur + 0.05);
      return s;
    }
    function noise(a, out, t, dur, vol, type, f, q, f2) {
      if (!noiseBuf || noiseCtx !== a) { noiseCtx = a; noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q || 1;
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      env(a, g, t, vol, Math.min(0.04, dur * 0.3), dur);
      s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1);
    }
    const bell = (a, out, f, t, vol, dur) => { osc(a, out, 'sine', f, t, dur, vol, { lp: 5200 }); osc(a, out, 'sine', f * 2.76, t, dur * 0.4, vol * 0.3, { lp: 5200 }); };
    const marimba = (a, out, f, t, vol, dur) => { osc(a, out, 'sine', f, t, dur || 0.3, vol); osc(a, out, 'sine', f * 4, t, 0.05, vol * 0.2); };
    const S = {
      step: (a, out, t, d) => { const wood = d && d.kind === 'wood', k = (stepN++ % 2) ? 1 : 0.84; noise(a, out, t, wood ? 0.05 : 0.035, wood ? 0.028 : 0.022, wood ? 'lowpass' : 'bandpass', (wood ? 700 : 2000) * k, wood ? 0.7 : 1.4); },
      lane: (a, out, t) => noise(a, out, t, 0.13, 0.022, 'bandpass', 700, 1.2, 2100),
      edge: (a, out, t) => { osc(a, out, 'sine', 150, t, 0.12, 0.05, { to: 90 }); osc(a, out, 'triangle', 620, t + 0.03, 0.12, 0.022, { to: 420 }); },
      jump: (a, out, t) => { osc(a, out, 'sine', 420, t, 0.15, 0.04, { to: 820, toT: 0.12 }); noise(a, out, t, 0.12, 0.012, 'bandpass', 900, 1, 2400); },
      land: (a, out, t, d) => { if (d && d.kind === 'top') { marimba(a, out, 196, t, 0.035, 0.12); noise(a, out, t, 0.05, 0.02, 'lowpass', 900); } else { osc(a, out, 'sine', 170, t, 0.09, 0.04, { to: 105 }); noise(a, out, t, 0.06, 0.016, 'lowpass', 700); } },
      slide: (a, out, t) => { noise(a, out, t, 0.36, 0.03, 'lowpass', 1500, 0.8, 380); osc(a, out, 'sine', 300, t, 0.2, 0.018, { to: 180 }); },
      drop: (a, out, t) => osc(a, out, 'sine', 760, t, 0.11, 0.035, { to: 260 }),
      boing: (a, out, t) => { const s = osc(a, out, 'sine', 240, t, 0.34, 0.05, { to: 520, toT: 0.08 }); s.frequency.exponentialRampToValueAtTime(330, t + 0.34); const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 18; lg.gain.value = 30; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + 0.4); },
      coin: (a, out, t, d) => { const p = clamp(Math.round(d && d.pitch || 0), 0, PENTA.length - 1), f = 1046.5 * Math.pow(2, PENTA[p] / 12); bell(a, out, f, t, 0.03, 0.22); osc(a, out, 'triangle', f * 2, t, 0.05, 0.008); },
      power: (a, out, t) => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(a, out, f, t + i * 0.06, 0.03, 0.5)),
      powerEnd: (a, out, t) => { marimba(a, out, 783.99, t, 0.03, 0.2); marimba(a, out, 587.33, t + 0.1, 0.03, 0.3); },
      glideStart: (a, out, t) => { noise(a, out, t, 0.6, 0.03, 'bandpass', 400, 0.9, 1800); [392, 523.25, 659.25, 783.99].forEach((f, i) => bell(a, out, f, t + 0.15 + i * 0.08, 0.025, 0.6)); },
      glideEnd: (a, out, t) => { noise(a, out, t, 0.35, 0.02, 'bandpass', 1500, 0.9, 500); marimba(a, out, 523.25, t + 0.1, 0.03, 0.3); },
      moveStart: (a, out, t, d) => {
        const id = d && d.id;
        if (id === 'cow') { osc(a, out, 'sawtooth', 160, t, 0.55, 0.03, { to: 118, att: 0.08, lp: 600 }); }
        else if (id === 'cart') { noise(a, out, t, 0.3, 0.02, 'bandpass', 520, 3, 380); marimba(a, out, 220, t + 0.05, 0.02, 0.15); }
        else noise(a, out, t, 0.45, 0.025, 'lowpass', 300, 1, 180);
      },
      stumble: (a, out, t) => { osc(a, out, 'triangle', 560, t, 0.2, 0.035, { to: 300 }); osc(a, out, 'sine', 140, t + 0.04, 0.12, 0.04, { to: 90 }); },
      crash: (a, out, t) => { osc(a, out, 'sine', 130, t, 0.3, 0.06, { to: 70 }); noise(a, out, t, 0.18, 0.03, 'lowpass', 500); bell(a, out, 2637, t + 0.05, 0.012, 0.3); },
      caught: (a, out, t) => { [783.99, 739.99, 698.46, 659.25].forEach((f, i) => marimba(a, out, f, t + i * 0.16, 0.035, i === 3 ? 0.55 : 0.18)); [2637, 3136, 2793].forEach((f, i) => bell(a, out, f, t + 0.05 + i * 0.07, 0.01, 0.25)); },
      jingle: (a, out, t, d) => { const near = d && d.n !== undefined ? clamp(1.3 - d.n / 11, 0.25, 1) : 0.6; for (let i = 0; i < 3; i++) bell(a, out, 2400 + Math.random() * 1200, t + i * 0.045 + Math.random() * 0.02, 0.011 * near, 0.16); },
      crack: (a, out, t) => { noise(a, out, t, 0.035, 0.06, 'highpass', 2600, 0.8); osc(a, out, 'square', 1800, t, 0.012, 0.015); },
      stage: (a, out, t) => { [523.25, 659.25, 783.99].forEach((f, i) => marimba(a, out, f, t + i * 0.1, 0.045, 0.3)); bell(a, out, 1046.5, t + 0.32, 0.035, 0.9); },
      record: (a, out, t) => [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(a, out, f, t + i * 0.07, 0.026, 0.8)),
      over: (a, out, t) => { [261.63, 329.63, 392].forEach(f => osc(a, out, 'triangle', f, t, 1.2, 0.02, { att: 0.12, lp: 1400 })); },
      start: (a, out, t) => { marimba(a, out, 392, t, 0.04, 0.15); marimba(a, out, 523.25, t + 0.1, 0.04, 0.15); marimba(a, out, 783.99, t + 0.2, 0.045, 0.35); },
      pause: (a, out, t) => osc(a, out, 'sine', 660, t, 0.08, 0.03, { to: 440 }),
      resume: (a, out, t) => osc(a, out, 'sine', 440, t, 0.08, 0.03, { to: 660 }),
      tap: (a, out, t) => { osc(a, out, 'sine', 880, t, 0.12, 0.035); osc(a, out, 'sine', 880 * 5.95, t, 0.05, 0.006); },
    };
    return function sfx(name, d) {
      const fn = S[name]; if (!fn) return;
      let a = null, out = null;
      try { a = audio(); out = a && bus(); } catch (e) { a = null; }
      if (!a || !out) return;
      const now = a.currentTime, g = GAP[name] || 0.05;
      if (lastAt[name] !== undefined && now - lastAt[name] < g) return;
      lastAt[name] = now;
      try { fn(a, out, now + 0.005, d); } catch (e) { /* звук не главное */ }
    };
  }

  V.runnerUI = { create, sound, version: 1 };
})();
