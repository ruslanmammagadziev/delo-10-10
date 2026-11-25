/* =====================================================================
   ХРОНИКА КУБАЧИ — движок познавательных дел сезона «Дело о кольчужниках» (docs/kubachi/SEASON.md).
   Обычный <script>: window.VILLAGE.history. Дела — данными (js/village/history_case5.js → register), их будет десять;
   виды шагов (мини-игры, ночной дозор, просмотр находки) — js/village/history_games.js (VILLAGE.history.kinds).

   Как устроено (почему так):
     • Дело идёт «сеансом» поверх села, как бег-раннер: хозяин (js/world/regions.js или стенд village.html) ставит свой
       цикл и ввод на паузу и отдаёт ТОТ ЖЕ рендерер (второй WebGL-контекст на телефоне — риск вылета). Сеанс рисует свой
       слой DOM (диалоги, карточки, мини-игры на 2D-холсте), а в шагах с 3D — свою маленькую сцену или сцену села
       (ночной дозор) своим циклом кадров. Всё своё создаётся при входе в шаг и освобождается при выходе из него.
     • Прогресс — ключ kub общего сохранения игры (G.state().kub; на стенде без движка — localStorage):
       kub[<id дела>] = { a: взято, s: пройдено шагов, d: закрыто, k: биты карточек, n: сколько раз закрыто }.
       Выйти можно в любой миг (✕): пройденные шаги и карточки уже записаны, вернуться — у глашатая на площади.
     • Тексты — только в данных дела; у каждой карточки статус и страница источника (правила подачи SEASON.md).
     • В режиме без названия (VILLAGE.named === false) дел нет: они целиком про историю названного села.

   API
     register(def)            — добавить дело (см. history_case5.js)
     resident(ctx)            — зовёт kubachi.js при сборке села: глашатай на площади и место «Сход!» (use → { kind: 'history' })
     open(host, o?) → Promise — сеанс дела. host = { THREE, renderer, scene, handle, hero?, dn?, named, pause(), resume(),
                                haptic?(k), root? }; o = { chronicle: true } — сразу блокнот «Хроника»
     chronicle()              — блокнот дел без села (город, меню ☰): только DOM
     goal()                   — { icon, text, title, full, x, z } для пилюли цели в селе или null
     active(), progress(id), cardsGot(id), reset(id) (стенд), kinds, STATUS
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G_ = () => (window.G && typeof window.G.state === 'function' ? window.G : null);
  const EXIT = { exit: true };

  const STATUS = {
    fact: { label: 'установлено', cls: 'fact' },
    author: { label: 'версия автора', cls: 'author' },
    dispute: { label: 'спорно', cls: 'dispute' },
    legend: { label: 'легенда', cls: 'legend' },
    refuted: { label: 'опровергнуто', cls: 'refuted' },
  };
  const CASES = [];
  const SPEAK = {
    herald: { name: 'Петух-глашатай', icon: '🐓' },
    hero: { name: '', icon: '' },
  };
  if (V.SPEAKERS && !V.SPEAKERS.herald_rooster) V.SPEAKERS.herald_rooster = { name: 'Петух-глашатай', icon: '🐓', voice: 'звонкий, торжественный, чуть важный' };

  /* ---------- сохранение ---------- */
  const LS = 'delo1010_kub_stand';
  let local = null;
  function bag() {
    const g = G_();
    if (g) { const st = g.state(); if (!st.kub || typeof st.kub !== 'object' || Array.isArray(st.kub)) st.kub = {}; return st.kub; }
    if (!local) { try { local = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { local = {}; } if (typeof local !== 'object') local = {}; }
    return local;
  }
  function persist(flush) {
    const g = G_();
    if (g) { try { g.save(flush ? { flush: true } : undefined); } catch (e) { /* без сохранения */ } return; }
    try { localStorage.setItem(LS, JSON.stringify(local || {})); } catch (e) { /* без хранилища */ }
  }
  const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0);
  function progress(id) {
    const b = bag(); let p = b[id];
    if (!p || typeof p !== 'object') p = b[id] = {};
    p.a = p.a ? 1 : 0; p.s = num(p.s); p.d = p.d ? 1 : 0; p.k = num(p.k); p.n = num(p.n);
    return p;
  }
  const hasCard = (c, i) => !!(progress(c.id).k & (1 << i));
  const cardsGot = id => { const c = caseBy(id); return c ? c.cards.filter((_, i) => hasCard(c, i)).length : 0; };
  const caseBy = id => CASES.find(c => c.id === id) || null;
  function register(def) { if (def && def.id && !caseBy(def.id)) { CASES.push(def); CASES.sort((a, b) => a.n - b.n); } }
  const namedOk = () => V.named !== false;
  // дело, которое сейчас предлагает глашатай: первое незакрытое, иначе — последнее закрытое (перечитать)
  function current() { if (!namedOk() || !CASES.length) return null; return CASES.find(c => !progress(c.id).d) || CASES[CASES.length - 1]; }

  /* ---------- стили ---------- */
  let cssEl = null;
  function ensureCss() {
    if (cssEl) return;
    cssEl = document.createElement('style'); cssEl.setAttribute('data-kh', '1');
    cssEl.textContent = `
body.kh-on #hud,body.kh-on #fx,body.kh-on .w-root>:not(canvas),body.kh-on #ui,body.kh-on #dbg,body.kh-on .dnbtn{visibility:hidden!important}
.kh{--kc:#B5520E;--kcd:#6B3517;--ki:#3B2A20;--ki2:#735E4E;--kcr:#FFF3E2;--kp:#F9CF9C;--kp2:#FCE7CC;--ka:#F39A2B;position:fixed;inset:0;z-index:90;overflow:hidden;color:var(--ki);
  font-family:var(--font,'Nunito',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);font-weight:700;-webkit-user-select:none;user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;
  background:radial-gradient(120% 80% at 50% 0%,#FFF7EA 0%,#FBE3C2 55%,#F3C78E 100%)}
.kh *{box-sizing:border-box}
.kh.kh-clear{background:none}
.kh.kh-veil{background:linear-gradient(180deg,rgba(43,27,18,.28) 0%,rgba(43,27,18,.08) 30%,rgba(43,27,18,.2) 62%,rgba(43,27,18,.62) 100%)}
.kh.kh-dark{background:radial-gradient(110% 80% at 50% 35%,#4A3122 0%,#2A1B12 70%,#1B110B 100%);color:var(--kcr)}
.kh-top{position:absolute;left:0;right:0;top:0;z-index:6;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 0}
.kh-pill{flex:1;min-width:0;background:rgba(255,253,249,.94);color:var(--ki);border-radius:18px;padding:7px 14px;box-shadow:0 3px 0 rgba(59,42,32,.14);font-size:13px;line-height:1.25}
.kh-pill b{display:block;color:var(--kc);font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:900}
.kh-pill span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:900;font-size:15px}
.kh-dots{display:flex;gap:4px;margin-top:4px}.kh-dots i{flex:1;height:4px;border-radius:2px;background:#EBD6BB}.kh-dots i.on{background:var(--ka)}.kh-dots i.now{background:var(--kc)}
.kh-x{flex:none;width:44px;height:44px;border:0;border-radius:15px;background:rgba(255,253,249,.94);color:var(--kcd);font-size:19px;font-weight:900;box-shadow:0 3px 0 rgba(59,42,32,.14);cursor:pointer}
.kh-stage{position:absolute;left:0;right:0;top:calc(74px + env(safe-area-inset-top,0px));bottom:0;display:flex;flex-direction:column;align-items:center}
.kh-dlg{position:absolute;left:10px;right:10px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:8;background:#FFFDF9;border-radius:22px;padding:14px 16px 12px;box-shadow:0 6px 0 rgba(107,53,23,.18),0 14px 30px rgba(59,42,32,.22);
  cursor:pointer;animation:khUp .22s ease-out;color:var(--ki)}
.kh-dlg.hero{background:var(--kp2);margin-left:34px}
.kh-dlg .who{display:inline-flex;align-items:center;gap:6px;background:var(--kc);color:#fff;border-radius:12px;padding:3px 10px;font-size:12px;font-weight:900;margin-bottom:7px}
.kh-dlg.hero .who{background:var(--kcd)}
.kh-dlg .txt{font-size:17px;line-height:1.35;font-weight:800;min-height:46px}
.kh-dlg .more{text-align:right;color:var(--kc);font-size:12px;font-weight:900;margin-top:4px;letter-spacing:.04em}
.kh-btn{border:0;border-radius:18px;padding:13px 18px;background:var(--kc);color:#fff;font:inherit;font-weight:900;font-size:16px;box-shadow:0 5px 0 var(--kcd),0 10px 20px rgba(107,53,23,.25);cursor:pointer;min-height:48px}
.kh-btn:active{transform:translateY(4px);box-shadow:0 1px 0 var(--kcd)}
.kh-btn.soft{background:#FFFDF9;color:var(--kcd);box-shadow:0 5px 0 #E6D5BE,0 10px 18px rgba(59,42,32,.1)}
.kh-btn.block{display:block;width:100%}
.kh-row{display:flex;gap:10px}.kh-row>*{flex:1}
.kh-modal{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));background:rgba(43,27,18,.55);animation:khIn .2s ease-out}
.kh-sheet{width:100%;max-width:420px;max-height:100%;overflow:auto;background:#FFFDF9;color:var(--ki);border-radius:26px;padding:20px 18px 18px;box-shadow:0 8px 0 rgba(107,53,23,.22),0 20px 40px rgba(43,27,18,.35);animation:khPop .26s cubic-bezier(.2,1.3,.4,1);touch-action:pan-y}
.kh-sheet h3{margin:0 0 8px;font-family:var(--font-title,inherit);font-size:21px;line-height:1.15;color:var(--kcd)}
.kh-sheet p{margin:0 0 10px;font-size:15.5px;line-height:1.4;font-weight:700}
.kh-kick{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ki2);font-weight:900;margin-bottom:8px}
.kh-card{position:relative;background:linear-gradient(180deg,#FFF9EE,#FCEBD0);border:2px solid #EBCFA6;border-radius:20px;padding:16px 15px 13px;margin-bottom:14px;text-align:left}
.kh-card h4{margin:8px 0 6px;font-family:var(--font-title,inherit);font-size:19px;line-height:1.18;color:var(--ki)}
.kh-card p{margin:0;font-size:15.5px;line-height:1.4;font-weight:700}
.kh-card .src{margin-top:10px;font-size:12px;color:var(--ki2);font-weight:900;letter-spacing:.02em}
.kh-st{display:inline-block;border-radius:10px;padding:3px 10px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#4F8F5F}
.kh-st.author{background:#D9861E}.kh-st.dispute{background:#C2552B}.kh-st.legend{background:#7A5AA8}.kh-st.refuted{background:#7C7168}
.kh-card.lock{background:#F6EADB;border-style:dashed;color:var(--ki2);text-align:center;padding:14px}
.kh-card.final{background:linear-gradient(180deg,#FFF3DC,#F9D9A6);border-color:var(--ka)}
.kh-stamp{position:absolute;right:10px;top:8px;transform:rotate(9deg);border:3px solid var(--kc);color:var(--kc);border-radius:10px;padding:3px 9px;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;opacity:.9;background:rgba(255,253,249,.6)}
.kh-list{position:absolute;inset:0;z-index:10;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:calc(70px + env(safe-area-inset-top,0px)) 14px calc(24px + env(safe-area-inset-bottom,0px));background:radial-gradient(120% 80% at 50% 0%,#FFF7EA 0%,#FBE3C2 55%,#F3C78E 100%)}
.kh-list h2{margin:0 0 2px;font-family:var(--font-title,inherit);font-size:25px;color:var(--kcd)}
.kh-list .sub{font-size:13px;color:var(--ki2);font-weight:800;margin-bottom:14px}
.kh-case{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:900;color:var(--kc);margin:14px 0 8px;display:flex;justify-content:space-between}
.kh-hint{position:absolute;left:50%;transform:translateX(-50%);z-index:7;max-width:92%;background:rgba(43,27,18,.78);color:#FFF3E2;border-radius:16px;padding:8px 14px;font-size:14px;font-weight:800;text-align:center;line-height:1.3;pointer-events:none;transition:opacity .3s}
.kh-toast{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);z-index:14;background:#FFFDF9;color:var(--kcd);border-radius:18px;padding:10px 18px;font-size:17px;font-weight:900;box-shadow:0 5px 0 rgba(107,53,23,.2);pointer-events:none;animation:khPop .25s cubic-bezier(.2,1.3,.4,1);white-space:nowrap}
.kh-intro{position:absolute;inset:0;z-index:20;background:#1B110B;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(16px + env(safe-area-inset-bottom,0px))}
.kh-intro .frame{position:relative;height:min(74vh,calc((100vw - 28px)*16/9));aspect-ratio:9/16;border-radius:22px;overflow:hidden;border:3px solid #E8B56B;box-shadow:0 0 0 6px #3B2A20,0 18px 40px rgba(0,0,0,.5);background:#000}
.kh-intro video{width:100%;height:100%;object-fit:cover;display:block}
.kh-intro .cap{color:#F9CF9C;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:900}
.kh-intro .ttl{color:#FFF3E2;font-family:var(--font-title,inherit);font-size:19px;font-weight:900}
@keyframes khUp{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
@keyframes khIn{from{opacity:0}to{opacity:1}}
@keyframes khPop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes khShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
.kh-nb{margin-top:18px;padding:14px;border-radius:20px;background:linear-gradient(180deg,#FFF9EE,#FCEBD0);border:2px solid #EBCFA6}
.kh-nb b{display:block;font-size:16px;color:#6B3517}.kh-nb span{display:block;font-size:13px;color:#735E4E;font-weight:800;margin:2px 0 10px}
`;
    document.head.appendChild(cssEl);
  }
  const mountPoint = () => document.getElementById('app') || document.body;
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const haptic = k => { const g = G_(); try { if (SES && SES.host.haptic) SES.host.haptic(k); else if (g && g.haptic) g.haptic(k); } catch (e) { /* ok */ } };
  const sfx = n => { const g = G_(); try { if (g && g.sfx) g.sfx(n); } catch (e) { /* ok */ } };

  /* ---------- карточки ---------- */
  function cardHTML(c, card, o = {}) {
    const st = STATUS[card.status] || STATUS.fact;
    return `<div class="kh-card${card.final ? ' final' : ''}">${o.stamp ? '<div class="kh-stamp">Дело закрыто</div>' : ''}<span class="kh-st ${st.cls}">${esc(st.label)}</span>` +
      `<h4>${esc(card.title)}</h4><p>${esc(card.text)}</p><div class="src">${esc(c.source)}, с. ${esc(card.page)}</div></div>`;
  }
  function listHTML() {
    const cs = CASES.filter(c => progress(c.id).a || progress(c.id).k);
    let h = `<h2>Хроника Кубачи</h2><div class="sub">Блокнот дел. Статус и страница — на каждой карточке.</div>`;
    if (!cs.length) h += `<div class="kh-card lock">Пока пусто. Дела раздаёт петух-глашатай на площади.</div>`;
    cs.forEach(c => {
      const p = progress(c.id), n = c.cards.filter((_, i) => hasCard(c, i)).length;
      h += `<div class="kh-case"><span>Дело ${c.n} · «${esc(c.title)}»</span><span>${n}/${c.cards.length}</span></div>`;
      c.cards.forEach((card, i) => { h += hasCard(c, i) ? cardHTML(c, card) : `<div class="kh-card lock">Карточка ${i + 1} — ещё не найдена</div>`; });
      if (p.d && c.final) h += cardHTML(c, Object.assign({ final: true }, c.final), { stamp: true });
    });
    h += `<div class="sub" style="margin-top:6px">${esc(CASES[0] ? CASES[0].credit : '')}</div>`;
    return h;
  }
  // блокнот «Хроника» отдельным экраном (в сеансе — поверх шага; без сеанса — сам по себе)
  function chronicleView(parent) {
    return new Promise(res => {
      const w = el('div', 'kh-list', listHTML());
      const top = el('div', 'kh-top'); top.style.position = 'fixed'; top.style.zIndex = 11;
      top.innerHTML = '<div class="kh-pill"><b>Блокнот</b><span>Хроника Кубачи</span></div>';
      const x = el('button', 'kh-x', '✕'); x.setAttribute('aria-label', 'Закрыть'); top.appendChild(x);
      const wrap = el('div'); wrap.style.cssText = 'position:absolute;inset:0;z-index:16'; wrap.appendChild(w); wrap.appendChild(top);
      parent.appendChild(wrap);
      x.addEventListener('click', () => { haptic('light'); wrap.remove(); res(); });
    });
  }
  function chronicle() {
    if (SES) return SES.ui.chronicle();
    ensureCss();
    const root = el('div', 'kh'); mountPoint().appendChild(root);
    return chronicleView(root).then(() => root.remove());
  }

  /* ---------- сеанс ---------- */
  let SES = null;
  function open(host, o = {}) {
    if (SES) return SES.done;
    if (!host || !namedOk()) return Promise.resolve(false);
    const c = current(); if (!c) return Promise.resolve(false);
    ensureCss();
    const ses = SES = { host, c, alive: true, kinds: V.history.kinds };
    const mem0 = host.renderer && host.renderer.info ? Object.assign({}, host.renderer.info.memory) : null;
    let paused = false;
    try { if (host.pause) { host.pause(); paused = true; } } catch (e) { console.warn('history pause', e); }
    document.body.classList.add('kh-on');
    const root = el('div', 'kh'); (host.root || mountPoint()).appendChild(root);
    root.innerHTML = '<div class="kh-top"><div class="kh-pill"><b></b><span></span><div class="kh-dots"></div></div><button class="kh-x" aria-label="Выйти">✕</button></div><div class="kh-stage"></div>';
    const $ = s => root.querySelector(s), stage = $('.kh-stage');
    let exitRej = null; ses.exitP = new Promise((_, rej) => { exitRej = rej; }); ses.exitP.catch(() => {});
    const wait = p => Promise.race([p, ses.exitP]);
    const cleanups = [];
    const ui = ses.ui = {
      root, stage, wait, el, esc,
      mode(m) { root.classList.toggle('kh-clear', m === 'clear'); root.classList.toggle('kh-dark', m === 'dark'); root.classList.toggle('kh-veil', m === 'veil'); },
      head(kick, title, i, n) {
        $('.kh-pill b').textContent = kick; $('.kh-pill span').textContent = title;
        const d = $('.kh-dots'); d.innerHTML = ''; for (let k = 0; k < (n || 0); k++) { const s = el('i', k < i ? 'on' : k === i ? 'now' : ''); d.appendChild(s); }
      },
      clear() { stage.innerHTML = ''; },
      onCleanup(fn) { cleanups.push(fn); return fn; },
      runCleanups() { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { console.warn('history cleanup', e); } } },
      toast(t, ms = 1300) { const e = el('div', 'kh-toast', esc(t)); root.appendChild(e); setTimeout(() => e.remove(), ms); },
      hint(t, bottom) { let e = root.querySelector('.kh-hint'); if (!t) { if (e) e.remove(); return null; } if (!e) { e = el('div', 'kh-hint'); root.appendChild(e); } e.textContent = t; e.style.bottom = (bottom == null ? 'calc(26px + env(safe-area-inset-bottom,0px))' : bottom); return e; },
      // реплики: [{ who: 'herald' | 'hero', text }] — по одной, касание — дальше
      say(lines) {
        return wait(new Promise(res => {
          let i = 0, box = null, at = 0;
          const show = () => {
            if (box) box.remove();
            if (i >= lines.length) { res(); return; }
            const l = lines[i], sp = SPEAK[l.who] || SPEAK.herald, hero = l.who === 'hero';
            box = el('div', 'kh-dlg' + (hero ? ' hero' : ''), `<div class="who">${hero ? 'Следователь' : esc(sp.icon + ' ' + sp.name)}</div><div class="txt">${esc(l.text)}</div><div class="more">${i < lines.length - 1 ? 'дальше ▸' : 'понятно ▸'}</div>`);
            box.setAttribute('role', 'button'); box.setAttribute('data-kh', 'say'); root.appendChild(box); at = performance.now();
            const g = G_(); if (g && g.voiceLine && !hero) { try { g.voiceLine('herald_rooster', l.text); } catch (e) { /* без голоса */ } }
            box.addEventListener('click', () => { if (performance.now() - at < 180) return; haptic('light'); sfx('tap'); i++; show(); });
          };
          ui.onCleanup(() => { if (box) box.remove(); });
          show();
        }));
      },
      // лист: заголовок, абзацы, кнопки [{ t, v, soft }] → v
      sheet(o) {
        return wait(new Promise(res => {
          const m = el('div', 'kh-modal'), s = el('div', 'kh-sheet');
          s.innerHTML = (o.kick ? `<div class="kh-kick">${esc(o.kick)}</div>` : '') + (o.title ? `<h3>${esc(o.title)}</h3>` : '') + (o.html || '') + (o.text || []).map(t => `<p>${esc(t)}</p>`).join('') + '<div class="kh-row"></div>';
          const row = s.querySelector('.kh-row'); if ((o.buttons || []).length > 2) row.style.flexDirection = 'column';
          (o.buttons && o.buttons.length ? o.buttons : [{ t: 'Дальше', v: true }]).forEach(b => { const bt = el('button', 'kh-btn' + (b.soft ? ' soft' : ''), esc(b.t)); bt.addEventListener('click', () => { haptic('light'); sfx('tap'); m.remove(); res(b.v !== undefined ? b.v : b.t); }); row.appendChild(bt); });
          m.appendChild(s); root.appendChild(m); ui.onCleanup(() => m.remove());
        }));
      },
      // новые карточки дела: показать по одной и записать
      async cards(ids) {
        for (const id of ids) {
          const i = c.cards.findIndex(x => x.id === id); if (i < 0) continue;
          const had = hasCard(c, i);
          if (!had) { progress(c.id).k |= (1 << i); persist(true); }
          haptic('success'); if (!had) sfx('sticker');
          await ui.sheet({ kick: had ? 'Уже в блокноте' : 'Новая карточка · ' + (c.cards.filter((_, k) => hasCard(c, k)).length) + ' из ' + c.cards.length, html: cardHTML(c, c.cards[i]), buttons: [{ t: had ? 'Дальше' : 'В блокнот', v: true }] });
        }
      },
      chronicle: () => wait(chronicleView(root)),
    };
    $('.kh-x').addEventListener('click', async () => {
      if (!ses.alive || ses.asking) return; ses.asking = true; haptic('light');
      const m = el('div', 'kh-modal'); m.style.zIndex = 30;
      m.innerHTML = '<div class="kh-sheet"><h3>Выйти из дела?</h3><p>Пройденные шаги и карточки уже в блокноте. Вернуться можно у петуха-глашатая на площади.</p><div class="kh-row"><button class="kh-btn soft" data-v="0">Остаться</button><button class="kh-btn" data-v="1">Выйти</button></div></div>';
      root.appendChild(m);
      m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; m.remove(); ses.asking = false; if (b.dataset.v === '1') exitRej(EXIT); });
    });
    let closed = false;
    const close = res => {
      if (closed) return; closed = true; ses.alive = false;
      ui.runCleanups();
      if (ses.gl) { try { ses.gl.dispose(); } catch (e) { console.warn('history gl', e); } ses.gl = null; }
      root.remove(); document.body.classList.remove('kh-on');
      SES = null;
      if (paused) { try { if (host.resume) host.resume(); } catch (e) { console.warn('history resume', e); } }
      const m1 = host.renderer && host.renderer.info ? host.renderer.info.memory : null;
      return Object.assign({ mem0, mem1: m1 ? Object.assign({}, m1) : null }, res);
    };
    ses.done = (async () => {
      try {
        if (o.chronicle) { await ui.chronicle(); return close({ id: c.id, chronicle: true }); }
        const r = await play(ses);
        return close(Object.assign({ id: c.id }, r));
      } catch (e) {
        if (e !== EXIT) console.error('history', e);
        return close({ id: c.id, exit: e === EXIT, error: e !== EXIT ? String(e && e.message || e) : undefined, step: progress(c.id).s });
      }
    })();
    return ses.done;
  }

  async function play(ses) {
    const c = ses.c, ui = ses.ui, p = progress(c.id), N = c.steps.length;
    const kick = 'Дело ' + c.n + ' · «' + c.title + '»';
    ui.mode('veil');
    // закрытое дело: перечитать блокнот или пройти заново
    if (p.d && p.s >= N) {
      ui.head(kick, 'Дело закрыто', N, N);
      if (c.again) await ui.say(c.again);
      const v = await ui.sheet({ kick, title: 'Дело закрыто', text: ['Карточки — в блокноте «Хроника Кубачи». Можно пройти дело ещё раз: карточки и отметка останутся.'], buttons: [{ t: 'Открыть блокнот', v: 'nb' }, { t: 'Пройти заново', v: 're', soft: true }, { t: 'В село', v: 'x', soft: true }] });
      if (v === 'nb') { await ui.chronicle(); return { done: true }; }
      if (v !== 're') return { done: true };
      p.s = 0; persist(true);
    }
    if (!p.a) {
      ui.head(kick, 'Сход на площади', -1, N);
      await ui.say(c.offer);
      const v = await ui.sheet({ kick: 'Дело ' + c.n + ' из 10', title: '«' + c.title + '»', text: [c.question, 'Шагов: ' + N + '. Выйти можно в любой момент — прогресс сохранится.'], buttons: [{ t: 'Потом', v: 0, soft: true }, { t: 'Взять дело', v: 1 }] });
      if (!v) return { later: true };
      p.a = 1; persist(true);
      if (c.intro) await intro(ses, c.intro);
    }
    else if (p.s > 0 && p.s < N && c.back) { ui.head(kick, 'Продолжаем', p.s, N); await ui.say(c.back); }
    for (let i = p.s; i < N; i++) {
      const st = c.steps[i];
      ui.head(kick, 'Шаг ' + (i + 1) + ' из ' + N + ' · ' + st.title, i, N);
      for (const b of st.beats) {
        ui.clear(); ui.mode(b.mode || (b.kind === 'say' || b.kind === 'cards' || b.kind === 'choice' ? 'veil' : ''));
        try {
          if (b.kind === 'say') await ui.say(b.lines);
          else if (b.kind === 'cards') await ui.cards(b.ids);
          else if (ses.kinds[b.kind]) await ses.kinds[b.kind](ses, b);
          else console.warn('history: нет вида шага', b.kind);
        } finally { ui.runCleanups(); ui.hint(null); }
      }
      ui.clear(); ui.mode('veil');
      p.s = i + 1; persist(true);
    }
    // развязка
    ui.head(kick, 'Развязка', N, N);
    const first = !p.d; p.d = 1; p.n = num(p.n) + 1; persist(true);
    haptic('success'); const g = G_(); if (g && g.confetti && first) { try { g.confetti(); } catch (e) { /* ok */ } }
    await ui.sheet({ kick: 'Итоговая запись', html: cardHTML(c, Object.assign({ final: true }, c.final), { stamp: true }) + `<p style="font-size:13px;color:#735E4E">${esc(c.credit)}</p>`, buttons: [{ t: 'Открыть блокнот', v: 'nb', soft: true }, { t: 'В село', v: 'x' }] }).then(v => (v === 'nb' ? ui.chronicle() : null));
    return { done: true, first };
  }

  /* ---------- заставка: вертикальный ролик 9:16 (необязательная: нет файла или не грузится 3 с — молча дальше) ---------- */
  function intro(ses, o) {
    const ui = ses.ui;
    return ui.wait(new Promise(res => {
      let done = false, t0 = 0, unsub = null, started = false;
      const w = el('div', 'kh-intro');
      w.innerHTML = `<div class="ttl">${esc(o.title || '')}</div><div class="frame"><video playsinline webkit-playsinline preload="auto"></video></div><div class="cap">${esc(o.caption || 'художественная реконструкция')}</div><button class="kh-btn soft">Пропустить ▸</button>`;
      w.style.visibility = 'hidden';
      const v = w.querySelector('video');
      const fin = why => { if (done) return; done = true; clearTimeout(t0); try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ok */ } if (unsub) { try { unsub(); } catch (e) { /* ok */ } } w.remove(); ses.introEnd = why; res(why); };
      ui.onCleanup(() => fin('exit'));
      const g = G_(), soundOn = () => { try { return g && g.ambOn ? !!g.ambOn() : true; } catch (e) { return false; } };
      v.muted = !soundOn();
      if (g && g.onSound) { try { unsub = g.onSound(m => { v.muted = m === 'off'; }); } catch (e) { unsub = null; } }
      v.addEventListener('playing', () => { if (started) return; started = true; clearTimeout(t0); w.style.visibility = ''; });
      v.addEventListener('ended', () => fin('ended'));
      v.addEventListener('error', () => fin('error'));
      w.querySelector('button').addEventListener('click', () => { haptic('light'); fin('skip'); });
      ui.root.appendChild(w);
      t0 = setTimeout(() => { if (!started) fin('timeout'); }, o.timeout || 3000);
      try {
        v.src = o.file;
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => { if (done) return; v.muted = true; const p2 = v.play(); if (p2 && p2.catch) p2.catch(() => fin('blocked')); });
      } catch (e) { fin('error'); }
    }));
  }

  /* ---------- глашатай на площади (зовёт kubachi.js при сборке села) ---------- */
  function resident(ctx) {
    if (!ctx || ctx.named === false || !CASES.length || !ctx.place || !ctx.K) return null;
    const K = ctx.K, T = ctx.T, PI = Math.PI;
    const make = () => K.npc('herald_rooster', ({ n, body, P, face, M, GEO }) => {
      const w = M('#F6EFE2'), rd = M('#C2402E'), og = M('#E8A23A'), dk = M('#3B2A20'), tl = M('#2F6B62'), tl2 = M('#B5520E'), br = M('#C9A040', { emissive: '#C9A040', emissiveIntensity: 0.15 });
      P(body, GEO.sph, w, [0, 0.4, 0], [0.23, 0.27, 0.25]);
      P(body, GEO.sph, M('#EADFCB'), [0, 0.34, 0.13], [0.15, 0.17, 0.12], null, false);
      [-1, 1].forEach(sd => { P(body, GEO.sph, tl2, [sd * 0.22, 0.42, -0.02], [0.06, 0.17, 0.16], [0, 0, sd * 0.18]); P(body, GEO.cyl, og, [sd * 0.09, 0.07, 0.03], [0.022, 0.14, 0.022], null, false); P(body, GEO.box, og, [sd * 0.09, 0.012, 0.07], [0.09, 0.024, 0.13], null, false); });
      // перевязь глашатая и рожок
      P(body, GEO.torus, rd, [0, 0.47, 0], [0.235, 0.235, 0.16], [PI / 2 - 0.5, 0, 0.5], false);
      P(body, GEO.cone, br, [0.2, 0.36, 0.17], [0.06, 0.2, 0.06], [1.2, 0, -0.5], false);
      n.tail = new T.Group(); n.tail.position.set(0, 0.5, -0.2); body.add(n.tail);
      [[0, tl, 0.34], [-0.5, tl2, 0.3], [0.5, dk, 0.3], [-0.95, tl, 0.24], [0.95, tl2, 0.24]].forEach(([a, m, l]) => P(n.tail, GEO.sph, m, [Math.sin(a) * 0.09, l * 0.45, -0.07 - Math.abs(a) * 0.02], [0.045, l, 0.07], [-0.55, 0, -a * 0.5], false));
      const head = new T.Group(); head.position.set(0, 0.84, 0.03); body.add(head); n.head = head;
      P(head, GEO.sph, w, [0, 0, 0], [0.17, 0.165, 0.165]);
      face(head, { nose: '#E8A23A', noseW: 16, noseH: 14, mouth: 'smile', ey: 330, er: 28, ex: 80 }, [0.17, 0.165, 0.165]);
      P(head, GEO.cone, og, [0, -0.03, 0.17], [0.05, 0.11, 0.05], [PI / 2, 0, 0], false);
      [[-0.06, 0.07], [0, 0.1], [0.06, 0.07]].forEach(([z, s]) => P(head, GEO.sph, rd, [0, 0.17 + s * 0.3, z - 0.01], [0.035, s, 0.05], null, false));
      P(head, GEO.sph, rd, [0, -0.13, 0.11], [0.035, 0.06, 0.035], null, false);
      n.extra = t => { const k = Math.pow(Math.max(0, Math.sin(t * 0.55 + n.ph)), 14); if (n.head) n.head.rotation.x = -k * 0.5; n.tail.rotation.x = Math.sin(t * 1.7) * 0.06; };
    });
    const at = ctx.at || { x: 0, z: 0, ry: 0 };
    const n = ctx.place('herald_rooster', at.x, at.z, at.ry, { make, scale: 1.2, headY: 1.1, talkR: 2.6, name: 'Петух-глашатай' });
    n.lines = []; n.history = true;   // без «Поговорить»: у глашатая одно действие — место «Сход!» (иначе две кнопки спорят)
    const spot = {
      id: 'history_call', x: at.x + Math.sin(at.ry) * 0.9, y: n.y, z: at.z + Math.cos(at.ry) * 0.9, r: 2.6, icon: '📜', label: 'Сход на площади', play: true, npc: 'herald_rooster',
      get action() { return actionLabel(); },
      use: () => { if (n.hop) n.hop(); n.faceHero = 3; return { id: 'history_call', kind: 'history', npc: 'herald_rooster' }; },
    };
    ctx.spots.push(spot);
    return { npc: n, spot };
  }
  function actionLabel() {
    const c = current(); if (!c) return 'Сход!';
    const p = progress(c.id);
    return p.d ? 'Хроника: дело закрыто' : p.a && p.s > 0 ? 'Продолжить дело' : p.a ? 'К делу' : 'Сход! Что случилось?';
  }
  // цель для пилюли HUD в селе: взятое и незакрытое дело ведёт к глашатаю
  function goal(h) {
    const c = current(); if (!c) return null;
    const p = progress(c.id); if (!p.a || p.d) return null;
    const sp = h && h.spots ? h.spots.find(s => s.id === 'history_call') : null; if (!sp) return null;
    const st = c.steps[Math.min(p.s, c.steps.length - 1)];
    return { icon: '📜', text: '«' + c.title + '»', title: 'Дело ' + c.n + ' · шаг ' + Math.min(p.s + 1, c.steps.length) + ' из ' + c.steps.length, full: 'Дальше — «' + st.title + '». Продолжить можно у петуха-глашатая на площади.', x: sp.x, z: sp.z };
  }

  /* ---------- блокнот игры (☰ → «Блокнот»): строка-вход в «Хронику», если есть хоть одна карточка ---------- */
  function hookNotebook() {
    const g = G_(); if (!g || g.khNb) return; g.khNb = true;
    const prevH = g.nbExtras, prevB = g.nbBind;
    g.nbExtras = () => {
      let h = ''; try { h = prevH ? prevH() || '' : ''; } catch (e) { h = ''; }
      if (!namedOk() || !CASES.some(c => progress(c.id).k)) return h;
      ensureCss();
      const n = CASES.reduce((a, c) => a + cardsGot(c.id), 0);
      return h + `<div class="kh-nb"><b>Хроника Кубачи</b><span>Карточек: ${n}. Со статусом и страницей источника.</span><button class="btn block powder" data-kh-nb>Открыть хронику</button></div>`;
    };
    g.nbBind = m => { try { if (prevB) prevB(m); } catch (e) { /* ok */ } const b = m.querySelector('[data-kh-nb]'); if (b) b.addEventListener('click', () => { chronicle(); }); };
  }
  if (document.readyState === 'complete') setTimeout(hookNotebook, 0); else window.addEventListener('load', () => setTimeout(hookNotebook, 0));

  V.history = {
    register, resident, open, chronicle, goal, progress, cardsGot, STATUS, EXIT, kinds: {}, cases: CASES, current,
    active: () => !!SES, session: () => SES,
    close: () => { if (SES && SES.ui) { const x = SES.ui.root.querySelector('.kh-x'); if (x) x.click(); } },
    reset(id) { const b = bag(); if (id) delete b[id]; else Object.keys(b).forEach(k => delete b[k]); persist(true); },
  };
})();
