/* =====================================================================
   ХРОНИКА КУБАЧИ — виды шагов дела (VILLAGE.history.kinds): всё, что не диалог и не карточка.
     council  — «расставь семерых по должностям» (DOM: выбрать фигуру, потом место)
     relief   — тренировки дружины на «резном камне» (2D-холст, один палец): game = 'run' | 'throw' | 'shoot'
     watch    — ночной дозор на башне: сцена села ночью своим циклом кадров, найти огонь на дальнем посту, зажечь факел
     artifact — каменный тимпан с настоящим рельефом (карта высот → сетка + карта нормалей), вращается пальцем
     choice   — вопрос с вариантами (ответ ведёт к своей реплике)
   Каждый вид: async (ses, beat) → результат; всё своё убирает через ses.ui.onCleanup (движок зовёт и при выходе ✕).
   3D-шаги рисуют ТЕМ ЖЕ рендерером, что и село (ses.host.renderer): хозяин на паузе, свой rAF — только пока идёт шаг.
   Мини-игры нарочно на 2D-холсте в манере каменного рельефа: по книге, тренировки дружины вырезаны на камнях (с. 78).
   ===================================================================== */
(function () {
  'use strict';
  const V = window.VILLAGE = window.VILLAGE || {};
  const H = V.history; if (!H) return;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sleep = (ses, ms) => ses.ui.wait(new Promise(r => setTimeout(r, ms)));

  let cssEl = null;
  function ensureCss() {
    if (cssEl) return;
    cssEl = document.createElement('style'); cssEl.setAttribute('data-kh', 'games');
    cssEl.textContent = `
.kh-cn{width:100%;max-width:460px;padding:4px 14px 0;display:flex;flex-direction:column;gap:8px;height:100%}
.kh-cn h3{margin:0;font-family:var(--font-title,inherit);font-size:20px;color:var(--kcd);text-align:center}
.kh-cn .tip{text-align:center;font-size:13.5px;color:var(--ki2);font-weight:800;min-height:18px}
.kh-roles{display:flex;flex-direction:column;gap:7px}
.kh-role{display:flex;align-items:center;gap:8px;background:rgba(255,253,249,.9);border:2px dashed #E3C294;border-radius:18px;padding:6px 10px;min-height:54px;cursor:pointer;transition:border-color .15s,background .15s}
.kh-role.aim{border-color:var(--kc);background:#FFF6E6}
.kh-role.full{border-style:solid;border-color:#9CC6A4;background:#F4FBF2;cursor:default}
.kh-role .nm{flex:none;width:112px;font-size:14px;font-weight:900;color:var(--kcd);line-height:1.15}
.kh-role .nm small{display:block;font-size:11px;color:var(--ki2);font-weight:800}
.kh-role .seats{flex:1;display:flex;gap:6px;justify-content:flex-end}
.kh-seat{width:40px;height:40px;border-radius:50%;background:#F3E3CB;display:flex;align-items:center;justify-content:center;font-size:22px}
.kh-seat.on{background:#fff;box-shadow:0 2px 0 rgba(59,42,32,.15)}
.kh-pool{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:2px;overflow:auto;touch-action:pan-y;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))}
.kh-tok{display:flex;align-items:center;gap:8px;text-align:left;background:#FFFDF9;border:2px solid #EBD6BB;border-radius:16px;padding:7px 9px;min-height:54px;font:inherit;font-size:12.5px;font-weight:800;line-height:1.2;color:var(--ki);cursor:pointer;box-shadow:0 3px 0 rgba(59,42,32,.1)}
.kh-tok i{font-style:normal;font-size:24px;flex:none}
.kh-tok.sel{border-color:var(--kc);background:#FFEFD6;transform:translateY(-2px)}
.kh-tok.gone{visibility:hidden}
.kh-tok.no{animation:khShake .3s}
.kh-rl{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center}
.kh-rl canvas{display:block;border-radius:22px;box-shadow:0 0 0 3px #8A6238,0 8px 0 rgba(59,42,32,.25),0 18px 30px rgba(59,42,32,.25);touch-action:none}
.kh-rl .cap{margin-top:12px;font-size:15px;font-weight:900;color:var(--kcd);text-align:center;padding:0 16px;min-height:40px}
.kh-rl .tapz{position:absolute;inset:0;cursor:pointer}
.kh-fire{position:absolute;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9;white-space:nowrap;animation:khPop .3s cubic-bezier(.2,1.3,.4,1)}
.kh-horses{position:absolute;left:10px;right:10px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:8;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(20,16,34,.0),rgba(20,14,22,.82));padding:6px 0 0;animation:khUp .5s ease-out;pointer-events:none}
.kh-horses canvas{display:block;width:100%}
.kh-horses div{color:#FFE3B0;font-size:13px;font-weight:900;text-align:center;padding:2px 10px 9px;letter-spacing:.02em}
.kh-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(90% 70% at 50% 42%,rgba(0,0,0,0) 40%,rgba(18,10,6,.7) 100%)}
.kh-drag{position:absolute;inset:0;z-index:5;touch-action:none}
`;
    document.head.appendChild(cssEl);
  }

  /* =====================================================================
     СОВЕТ: семеро и должности
     ===================================================================== */
  H.kinds.council = function (ses, b) {
    ensureCss();
    const ui = ses.ui, el = ui.el, esc = ui.esc;
    return ui.wait(new Promise(res => {
      const w = el('div', 'kh-cn');
      w.innerHTML = `<h3>${esc(b.title)}</h3><div class="tip">${esc(b.tip)}</div><div class="kh-roles"></div><div class="kh-pool"></div>`;
      const rolesEl = w.querySelector('.kh-roles'), pool = w.querySelector('.kh-pool'), tip = w.querySelector('.tip');
      const seats = {}; let sel = null, left = b.people.length, miss = 0;
      b.roles.forEach(r => {
        const row = el('div', 'kh-role', `<div class="nm">${esc(r.name)}<small>${esc(r.sub || '')}</small></div><div class="seats">${'<div class="kh-seat"></div>'.repeat(r.n)}</div>`);
        row.dataset.role = r.id; rolesEl.appendChild(row); seats[r.id] = { row, n: 0, max: r.n };
        row.addEventListener('click', () => {
          if (!sel) { tip.textContent = 'Сначала выбери кого-нибудь внизу.'; return; }
          const p = sel.p, s = seats[r.id];
          if (p.role !== r.id || s.n >= s.max) { miss++; sel.btn.classList.remove('no'); void sel.btn.offsetWidth; sel.btn.classList.add('no'); tip.textContent = b.wrong[miss % b.wrong.length]; try { if (ses.host.haptic) ses.host.haptic('light'); } catch (e) { /* ok */ } return; }
          const st = row.querySelectorAll('.kh-seat')[s.n]; st.textContent = p.icon; st.classList.add('on'); s.n++;
          sel.btn.classList.add('gone'); sel = null; left--;
          rolesEl.querySelectorAll('.kh-role').forEach(q => q.classList.remove('aim'));
          if (s.n >= s.max) row.classList.add('full');
          tip.textContent = left ? b.right[(b.people.length - left) % b.right.length] : b.done;
          if (!left) setTimeout(() => res({ miss }), 900);
        });
      });
      // порядок фигур — вперемешку, но одинаково (без случайности: тесты и повтор)
      b.people.forEach((p, i) => { p._o = (i * 5 + 3) % b.people.length; });
      b.people.slice().sort((a, c) => a._o - c._o).forEach(p => {
        const btn = el('button', 'kh-tok', `<i>${p.icon}</i><span>${esc(p.hint)}</span>`); btn.type = 'button'; btn.dataset.role = p.role;
        btn.addEventListener('click', () => {
          pool.querySelectorAll('.kh-tok').forEach(q => q.classList.remove('sel')); btn.classList.add('sel'); sel = { p, btn };
          rolesEl.querySelectorAll('.kh-role').forEach(q => q.classList.toggle('aim', !q.classList.contains('full')));
          tip.textContent = 'Теперь — на какую должность?';
        });
        pool.appendChild(btn);
      });
      ui.stage.appendChild(w);
    }));
  };

  /* =====================================================================
     ВОПРОС С ВАРИАНТАМИ
     ===================================================================== */
  H.kinds.choice = async function (ses, b) {
    const v = await ses.ui.sheet({ kick: b.kick, title: b.title, text: b.text, buttons: b.options.map((o, i) => ({ t: o.t, v: i, soft: i > 0 })) });
    const o = b.options[v] || b.options[0];
    if (o.say) await ses.ui.say(o.say);
    if (b.after) await ses.ui.say(b.after);
    return v;
  };

  /* =====================================================================
     РЕЛЬЕФ: тренировки дружины на резном камне (2D-холст)
     ===================================================================== */
  const STONE = { base: '#C9A877', hi: 'rgba(255,241,214,.8)', lo: 'rgba(74,44,20,.55)', fig: '#B8935F', dark: '#8A6238', line: '#6E4B28' };
  function stoneTexture(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#D6B685'); g.addColorStop(1, '#BC9A69'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < w * h / 26; i++) { const a = rnd(); x.fillStyle = a > 0.5 ? 'rgba(255,244,220,' + (0.05 + rnd() * 0.1) + ')' : 'rgba(80,50,24,' + (0.04 + rnd() * 0.09) + ')'; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.2, 1 + rnd() * 1.6); }
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(70,40,16,.28)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
    return c;
  }
  // выпуклая фигура: блик сверху-слева, тень снизу-справа, тело чуть светлее камня
  function emboss(x, draw, col, d = 1.4) {
    x.save(); x.translate(-d, -d); x.fillStyle = x.strokeStyle = STONE.hi; draw(); x.restore();
    x.save(); x.translate(d * 1.2, d * 1.4); x.fillStyle = x.strokeStyle = STONE.lo; draw(); x.restore();
    x.fillStyle = x.strokeStyle = col || STONE.fig; draw();
  }
  // врезанная линия (узор, земля)
  function engrave(x, draw, d = 1) {
    x.save(); x.translate(d, d); x.strokeStyle = x.fillStyle = STONE.hi; draw(); x.restore();
    x.strokeStyle = x.fillStyle = STONE.line; draw();
  }
  // человечек сбоку: px, py — таз; s — рост в пикселях; pose — углы (рад) от вертикали вниз/вверх
  function figure(x, px, py, s, pose) {
    const L = s * 0.24, T = s * 0.3, A = s * 0.17, hw = s * 0.085;
    const lean = pose.lean || 0;
    const sx = px + Math.sin(lean) * T, sy = py - Math.cos(lean) * T;
    const seg = (ax, ay, a, l) => [ax + Math.sin(a) * l, ay + Math.cos(a) * l];
    const limbs = [];
    [[pose.l1 || 0, pose.k1 || 0], [pose.l2 || 0, pose.k2 || 0]].forEach(([a, k]) => { const kn = seg(px, py, a, L), ft = seg(kn[0], kn[1], a - k, L); limbs.push([px, py, kn[0], kn[1], ft[0], ft[1]]); });
    [[pose.a1 || 0, pose.e1 || 0], [pose.a2 || 0, pose.e2 || 0]].forEach(([a, e]) => { const el = seg(sx, sy, a, A), hd = seg(el[0], el[1], a + e, A); limbs.push([sx, sy, el[0], el[1], hd[0], hd[1]]); });
    const hx = sx + Math.sin(lean) * s * 0.13, hy = sy - Math.cos(lean) * s * 0.13;
    const draw = () => {
      x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = hw * 1.9;
      x.beginPath(); x.moveTo(px, py); x.lineTo(sx, sy); x.stroke();
      x.lineWidth = hw * 1.35;
      limbs.forEach(l => { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.lineTo(l[4], l[5]); x.stroke(); });
      x.beginPath(); x.arc(hx, hy, s * 0.1, 0, TAU); x.fill();
      // шапка-папаха — узнаваемый силуэт
      x.beginPath(); x.ellipse(hx, hy - s * 0.085, s * 0.115, s * 0.07, 0, PI, TAU); x.fill();
    };
    emboss(x, draw, STONE.fig, Math.max(1, s * 0.022));
    return { hand1: [limbs[2][4], limbs[2][5]], hand2: [limbs[3][4], limbs[3][5]], head: [hx, hy], sh: [sx, sy] };
  }
  function tower(x, cx, base, h) {
    const w = h * 0.34;
    emboss(x, () => { x.beginPath(); x.moveTo(cx - w / 2, base); x.lineTo(cx - w * 0.42, base - h); x.lineTo(cx + w * 0.42, base - h); x.lineTo(cx + w / 2, base); x.closePath(); x.fill(); for (let i = 0; i < 4; i++) x.fillRect(cx - w * 0.46 + i * w * 0.26, base - h - h * 0.06, w * 0.14, h * 0.07); }, STONE.fig, 1.6);
    x.fillStyle = STONE.line; for (let i = 0; i < 3; i++) x.fillRect(cx - 2 + (i - 1) * w * 0.16, base - h * (0.3 + i * 0.22), 4, h * 0.07);
  }
  function frieze(x, w, h, t) {
    x.lineWidth = 2;
    engrave(x, () => { x.beginPath(); const y = 13, n = Math.ceil(w / 22); for (let i = 0; i <= n; i++) { const px = i * 22 - (t % 22); x.moveTo(px, y + 5); x.quadraticCurveTo(px + 5.5, y - 7, px + 11, y); x.quadraticCurveTo(px + 16.5, y + 7, px + 22, y - 5); } x.stroke(); });
    engrave(x, () => { x.beginPath(); x.moveTo(0, 26); x.lineTo(w, 26); x.moveTo(0, h - 10); x.lineTo(w, h - 10); x.stroke(); });
  }
  function label(x, t, px, py, size, col, align) { x.font = '900 ' + size + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif'); x.textAlign = align || 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,241,214,.7)'; x.fillText(t, px + 1, py + 1); x.fillStyle = col || '#5A3A1C'; x.fillText(t, px, py); }

  // общая оболочка: холст-камень, цикл, касание; game(ctx) → { tap(), step(dt), draw(x), done → итог }
  function reliefStage(ses, make) {
    ensureCss();
    const ui = ses.ui, el = ui.el;
    return ui.wait(new Promise(res => {
      const w = el('div', 'kh-rl'), cv = document.createElement('canvas'), cap = el('div', 'cap'), tapz = el('div', 'tapz');
      w.appendChild(cv); w.appendChild(cap); w.appendChild(tapz); ui.stage.appendChild(w);
      const sw = Math.min(ui.stage.clientWidth || 390, 520), sh = ui.stage.clientHeight || 700;
      const W = Math.round(sw - 24), Hh = Math.round(clamp(sh - 96, 240, W * 1.5));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = stoneTexture(Math.round(W * dpr), Math.round(Hh * dpr));
      const g = make({ W, H: Hh, cap: t => { cap.textContent = t; } });
      let raf = 0, last = performance.now(), ended = false, t = 0;
      const onTap = e => { e.preventDefault(); if (!ended) { try { if (ses.host.haptic) ses.host.haptic('light'); } catch (er) { /* ok */ } g.tap(); } };
      tapz.addEventListener('pointerdown', onTap);
      const frame = now => {
        raf = requestAnimationFrame(frame);
        let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0; t += dt;
        g.step(dt, t);
        x.drawImage(bg, 0, 0, W, Hh);
        g.draw(x, t);
        if (g.done && !ended) { ended = true; setTimeout(() => res(g.done), 700); }
      };
      raf = requestAnimationFrame(frame);
      ui.onCleanup(() => { cancelAnimationFrame(raf); tapz.removeEventListener('pointerdown', onTap); w.remove(); bg.width = bg.height = 0; cv.width = cv.height = 0; });
    }));
  }

  const GAMES = {
    /* --- бег на дистанцию: камни на тропе, касание — прыжок --- */
    run(o, b) {
      const W = o.W, Hh = o.H, gy = Hh * 0.8, hx = W * 0.26, S = Hh * 0.3, v0 = W * 0.62, DIST = b.dist || 200, LEN = v0 * 24;
      const st = { d: 0, y: 0, vy: 0, slow: 0, hits: 0, ph: 0, t: 0, done: null, obs: [], flash: 0 };
      let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let p = v0 * 2.4; p < LEN - v0 * 1.5; p += v0 * (1.15 + rnd() * 0.9)) st.obs.push({ p, w: 20 + rnd() * 12, h: 16 + rnd() * 10, hit: false });
      o.cap(b.how);
      return {
        get done() { return st.done; },
        tap() { if (st.y <= 0.5 && !st.done) { st.vy = Hh * 1.55; st.y = 1; } },
        step(dt) {
          if (st.done) return; st.t += dt;
          const v = v0 * (st.slow > 0 ? 0.45 : 1); st.slow -= dt; st.flash -= dt;
          st.d += v * dt; st.ph += dt * (st.slow > 0 ? 7 : 13);
          if (st.y > 0) { st.vy -= Hh * 5.2 * dt; st.y += st.vy * dt; if (st.y <= 0) { st.y = 0; st.vy = 0; } }
          st.obs.forEach(ob => { if (ob.hit) return; const dx = ob.p - st.d; if (Math.abs(dx) < ob.w * 0.5 + 7 && st.y < ob.h - 3) { ob.hit = true; st.hits++; st.slow = 0.9; st.flash = 0.8; } });
          if (st.d >= LEN) { st.done = { game: 'run', time: +st.t.toFixed(1), hits: st.hits, score: st.hits === 0 ? 3 : st.hits <= 2 ? 2 : 1 }; o.cap(b.fin); }
        },
        draw(x, t) {
          frieze(x, W, Hh, st.d * 0.5);
          // дальние холмы и башня-финиш
          x.lineWidth = 2; engrave(x, () => { x.beginPath(); for (let i = -1; i < 5; i++) { const px = i * W * 0.42 - (st.d * 0.12) % (W * 0.42); x.moveTo(px, gy - S * 0.9); x.quadraticCurveTo(px + W * 0.21, gy - S * 1.5, px + W * 0.42, gy - S * 0.9); } x.stroke(); });
          const fx = hx + (LEN - st.d); if (fx < W + 80) tower(x, fx + 40, gy, S * 1.7);
          x.lineWidth = 3; engrave(x, () => { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }, 1.5);
          st.obs.forEach(ob => { const px = hx + (ob.p - st.d); if (px < -40 || px > W + 40) return; emboss(x, () => { x.beginPath(); x.ellipse(px, gy, ob.w / 2, ob.h, 0, PI, TAU); x.fill(); }, ob.hit ? STONE.dark : STONE.fig, 1.3); });
          const k = Math.sin(st.ph), air = st.y > 0, stum = st.slow > 0;
          figure(x, hx, gy - S * 0.48 - st.y + (air ? 0 : Math.abs(k) * -3), S, air
            ? { lean: 0.25, l1: 0.9, k1: 1.3, l2: -0.5, k2: 0.9, a1: -2.2, e1: 0.4, a2: 2.0, e2: -0.5 }
            : { lean: stum ? 0.55 : 0.22, l1: k * 0.85, k1: 0.25 + Math.max(0, -k) * 1.1, l2: -k * 0.85, k2: 0.25 + Math.max(0, k) * 1.1, a1: -k * 0.9, e1: -0.9, a2: k * 0.9, e2: -0.9 });
          if (st.flash > 0) label(x, 'Ой, камень!', hx + 30, gy - S * 1.25, 17, '#8B2E12');
          const pr = clamp(st.d / LEN, 0, 1);
          x.fillStyle = 'rgba(90,58,28,.25)'; x.fillRect(16, Hh - 30, W - 32, 8); x.fillStyle = '#8B4A12'; x.fillRect(16, Hh - 30, (W - 32) * pr, 8);
          label(x, Math.round(pr * DIST) + ' из ' + DIST + ' шагов', W / 2, Hh - 46, 14);
        },
      };
    },
    /* --- метание камней на дальность: шкала силы, касание — бросок; три попытки --- */
    throw(o, b) {
      const W = o.W, Hh = o.H, gy = Hh * 0.8, hx = W * 0.16, S = Hh * 0.3, N = b.tries || 3, MAX = 50;
      const st = { ph: 0, n: 0, fly: null, marks: [], best: 0, wait: 0, done: null, wind: 0 };
      o.cap(b.how);
      const gauge = () => 0.5 - 0.5 * Math.cos(st.ph);
      return {
        get done() { return st.done; },
        tap() {
          if (st.done || st.fly || st.wait > 0 || st.n >= N) return;
          const g = gauge(), dist = Math.round(14 + g * g * (MAX - 14));
          st.fly = { t: 0, T: 0.75 + g * 0.5, dist, g }; st.wind = 0.35;
        },
        step(dt) {
          if (st.done) return;
          st.wait -= dt; st.wind -= dt;
          if (!st.fly && st.wait <= 0 && st.n < N) st.ph += dt * (4.2 + st.n * 0.9);
          if (st.fly) {
            st.fly.t += dt;
            if (st.fly.t >= st.fly.T) { st.marks.push(st.fly.dist); st.best = Math.max(st.best, st.fly.dist); st.n++; st.fly = null; st.wait = 0.7; st.ph = 0; o.cap(st.n < N ? 'Бросок ' + (st.n + 1) + ' из ' + N + '. Лови верх шкалы!' : b.fin); }
          }
          if (st.n >= N && st.wait <= 0 && !st.fly) st.done = { game: 'throw', best: st.best, marks: st.marks.slice(), score: st.best >= 42 ? 3 : st.best >= 30 ? 2 : 1 };
        },
        draw(x) {
          frieze(x, W, Hh, 0);
          x.lineWidth = 3; engrave(x, () => { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }, 1.5);
          const x0 = hx + S * 0.35, x1 = W - 22, px = d => x0 + (x1 - x0) * d / MAX;
          x.lineWidth = 2; for (let d = 10; d <= MAX; d += 10) { engrave(x, () => { x.beginPath(); x.moveTo(px(d), gy); x.lineTo(px(d), gy + 9); x.stroke(); }); label(x, String(d), px(d), gy + 21, 12); }
          st.marks.forEach((d, i) => { emboss(x, () => { x.beginPath(); x.ellipse(px(d), gy - 4, 7, 5.5, 0, 0, TAU); x.fill(); }, d === st.best ? '#D9A24E' : STONE.fig, 1.1); label(x, String(d), px(d), gy - 20 - (i % 2) * 14, 13); });
          const g = gauge(), wind = st.wind > 0 ? st.wind / 0.35 : 0, held = !st.fly && st.wait <= 0 && st.n < N;
          const f = figure(x, hx, gy - S * 0.48, S, { lean: held ? -0.18 + g * 0.1 : 0.3 * (1 - wind) + 0.1, l1: 0.35, k1: 0.1, l2: -0.4, k2: 0.15, a1: held ? -2.3 - g * 0.5 : 1.9 - wind * 3.6, e1: held ? -0.5 : 0.1, a2: 0.9, e2: -0.6 });
          if (held) emboss(x, () => { x.beginPath(); x.arc(f.hand1[0], f.hand1[1] - 5, 6.5, 0, TAU); x.fill(); }, STONE.dark, 1);
          if (st.fly) { const k = st.fly.t / st.fly.T, sx = hx + 6, ex = px(st.fly.dist), cx = lerp(sx, ex, k), top = Hh * (0.2 + st.fly.g * 0.34), cy = gy - S * 0.9 - (gy - S * 0.9 - (gy - 5)) * k - Math.sin(k * PI) * top * 0.9; emboss(x, () => { x.beginPath(); x.arc(cx, Math.min(gy - 5, cy), 6.5, 0, TAU); x.fill(); }, STONE.dark, 1); }
          // шкала силы
          const bx = 14, bw = 15, by = 40, bh = gy - by - 70 > 60 ? gy - by - 70 : 60;
          x.fillStyle = 'rgba(90,58,28,.22)'; x.fillRect(bx, by, bw, bh);
          x.fillStyle = 'rgba(217,134,30,.55)'; x.fillRect(bx, by, bw, bh * 0.14);
          if (held) { x.fillStyle = '#8B2E12'; x.fillRect(bx - 3, by + bh * (1 - g) - 3, bw + 6, 6); }
          label(x, 'сила', bx + bw / 2 + 2, by + bh + 12, 11);
          label(x, 'Лучший: ' + st.best + ' шагов', W / 2, Hh - 30, 14);
        },
      };
    },
    /* --- стрельба по цели: прицел «гуляет», касание — выстрел; пять стрел --- */
    shoot(o, b) {
      const W = o.W, Hh = o.H, gy = Hh * 0.84, hx = W * 0.15, S = Hh * 0.3, N = b.tries || 5;
      const cx = W * 0.68, cy = Hh * 0.46, R = Math.min(W * 0.2, Hh * 0.22);
      const st = { t: 0, n: 0, hits: [], score: 0, fly: null, wait: 0, done: null, last: '' };
      o.cap(b.how);
      const aim = t => [cx + Math.sin(t * 1.9 + 0.4) * R * 1.3, cy + Math.sin(t * 2.7 + 1.3) * R * 1.15];
      return {
        get done() { return st.done; },
        tap() { if (st.done || st.fly || st.wait > 0 || st.n >= N) return; const a = aim(st.t); st.fly = { t: 0, T: 0.28, x: a[0], y: a[1] }; },
        step(dt) {
          if (st.done) return; st.wait -= dt;
          if (!st.fly && st.wait <= 0) st.t += dt * (1 + st.n * 0.08);
          if (st.fly) {
            st.fly.t += dt;
            if (st.fly.t >= st.fly.T) {
              const d = Math.hypot(st.fly.x - cx, st.fly.y - cy) / R, pts = d < 0.22 ? 10 : d < 0.5 ? 7 : d < 0.78 ? 4 : d < 1.02 ? 2 : 0;
              st.hits.push({ x: st.fly.x, y: st.fly.y, pts }); st.score += pts; st.n++; st.fly = null; st.wait = 0.55;
              st.last = pts === 10 ? 'В самый центр!' : pts ? '+' + pts : 'Мимо. Бывает!';
              o.cap(st.n < N ? st.last + ' Стрела ' + (st.n + 1) + ' из ' + N + '.' : b.fin);
            }
          }
          if (st.n >= N && st.wait <= 0 && !st.fly) st.done = { game: 'shoot', points: st.score, max: N * 10, score: st.score >= 34 ? 3 : st.score >= 18 ? 2 : 1 };
        },
        draw(x) {
          frieze(x, W, Hh, 0);
          x.lineWidth = 3; engrave(x, () => { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }, 1.5);
          // мишень на стойке: круги на щите
          emboss(x, () => { x.fillRect(cx - 4, cy, 8, gy - cy); }, STONE.dark, 1.2);
          [[1, STONE.fig], [0.78, '#D2B07C'], [0.5, STONE.fig], [0.22, '#D9A24E']].forEach(([k, c]) => emboss(x, () => { x.beginPath(); x.arc(cx, cy, R * k, 0, TAU); x.fill(); }, c, 1.3));
          st.hits.forEach(h => { x.lineWidth = 3; x.lineCap = 'round'; x.strokeStyle = '#5A3A1C'; x.beginPath(); x.moveTo(h.x, h.y); x.lineTo(h.x - 15, h.y - 5); x.stroke(); x.fillStyle = '#8B2E12'; x.beginPath(); x.arc(h.x, h.y, 3.2, 0, TAU); x.fill(); });
          // лучница-следователь с луком
          const drawn = !st.fly && st.wait <= 0 && st.n < N;
          const f = figure(x, hx, gy - S * 0.48, S, { lean: 0.02, l1: 0.3, k1: 0.05, l2: -0.3, k2: 0.05, a1: 1.5, e1: 0.05, a2: drawn ? -1.3 : 1.0, e2: drawn ? 2.3 : -0.4 });
          const bx = f.hand1[0], by = f.hand1[1];
          x.lineWidth = 3.4; emboss(x, () => { x.beginPath(); x.arc(bx - S * 0.2, by, S * 0.42, -1.05, 1.05); x.stroke(); }, STONE.dark, 1.1);
          const tx = bx - S * 0.2 + Math.cos(1.05) * S * 0.42, ty = Math.sin(1.05) * S * 0.42, pull = drawn ? S * 0.22 : 0;
          x.lineWidth = 1.4; x.strokeStyle = STONE.line; x.beginPath(); x.moveTo(tx, by - ty); x.lineTo(tx - pull, by); x.lineTo(tx, by + ty); x.stroke();
          if (drawn) { x.lineWidth = 2.4; x.strokeStyle = '#5A3A1C'; x.beginPath(); x.moveTo(tx - pull, by); x.lineTo(bx + S * 0.26, by); x.stroke(); }
          if (st.fly) { const k = st.fly.t / st.fly.T, ax = lerp(bx + S * 0.2, st.fly.x, k), ay = lerp(by, st.fly.y, k); x.lineWidth = 2.6; x.strokeStyle = '#5A3A1C'; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax - 20, ay - (st.fly.y - by) * 0.08); x.stroke(); }
          if (drawn) { const a = aim(st.t); x.lineWidth = 2.6; x.strokeStyle = '#8B2E12'; x.beginPath(); x.arc(a[0], a[1], 12, 0, TAU); x.moveTo(a[0] - 19, a[1]); x.lineTo(a[0] - 6, a[1]); x.moveTo(a[0] + 6, a[1]); x.lineTo(a[0] + 19, a[1]); x.moveTo(a[0], a[1] - 19); x.lineTo(a[0], a[1] - 6); x.moveTo(a[0], a[1] + 6); x.lineTo(a[0], a[1] + 19); x.stroke(); }
          label(x, 'Очки: ' + st.score, W / 2, Hh - 24, 14);
          for (let i = 0; i < N; i++) { x.fillStyle = i < N - st.n ? '#5A3A1C' : 'rgba(90,58,28,.25)'; x.fillRect(W - 20 - i * 9, 36, 4, 20); }
        },
      };
    },
  };
  H.kinds.relief = async function (ses, b) {
    const ui = ses.ui;
    for (;;) {
      ui.clear(); ui.mode('');
      await ui.sheet({ kick: b.kick, title: b.title, text: [b.intro], buttons: [{ t: 'Начать', v: 1 }] });
      const r = await reliefStage(ses, o => GAMES[b.game](o, b));
      ses.lastGame = r;
      const stars = '★'.repeat(r.score) + '☆'.repeat(3 - r.score);
      const line = b.result(r);
      const v = await ui.sheet({ kick: b.title + ' · ' + stars, title: b.verdict[r.score - 1], text: [line], buttons: [{ t: 'Ещё раз', v: 0, soft: true }, { t: 'Дальше', v: 1 }] });
      ui.runCleanups();
      if (v) return r;
    }
  };

  /* =====================================================================
     3D: общий помощник — тот же рендерер, свой цикл
     ===================================================================== */
  function glOf(ses) {
    if (ses.gl) return ses.gl;
    const host = ses.host, T = host.THREE || window.THREE, r = host.renderer;
    if (!T || !r) return null;
    let raf = 0, fn = null, last = 0;
    const tick = now => { raf = requestAnimationFrame(tick); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0; if (fn && !document.hidden) { try { fn(dt, now / 1000); } catch (e) { console.error('history frame', e); fn = null; } } };
    const gl = ses.gl = {
      T, r,
      size() { const c = r.domElement; return { w: c.clientWidth || c.width || 390, h: c.clientHeight || c.height || 844 }; },
      loop(f) { fn = f; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); },
      stop() { fn = null; if (raf) cancelAnimationFrame(raf); raf = 0; },
      // кадр: холст могли повернуть или растянуть (хозяин сам меняет размер рендерера) — камера шага подстраивается
      render(scene, cam) {
        const c = r.domElement, w = c.clientWidth || c.width, h = c.clientHeight || c.height, a = w / Math.max(1, h);
        if (cam.isPerspectiveCamera && Math.abs(cam.aspect - a) > 0.002) { cam.aspect = a; cam.updateProjectionMatrix(); }
        if (r.info && r.info.autoReset === false) r.info.reset(); r.render(scene, cam);
      },
      dispose() { gl.stop(); },
    };
    return gl;
  }
  // перетаскивание одним пальцем: onMove(dx, dy), onTap(x, y) — если палец почти не двигался
  function dragLayer(ses, onMove, onTap) {
    const d = ses.ui.el('div', 'kh-drag'); ses.ui.root.appendChild(d);
    let id = null, lx = 0, ly = 0, sx = 0, sy = 0, moved = 0, t0 = 0;
    const down = e => { if (id !== null) return; id = e.pointerId; lx = sx = e.clientX; ly = sy = e.clientY; moved = 0; t0 = performance.now(); try { d.setPointerCapture(id); } catch (er) { /* ok */ } e.preventDefault(); };
    const move = e => { if (e.pointerId !== id) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy); onMove(dx, dy); e.preventDefault(); };
    const up = e => { if (e.pointerId !== id) return; id = null; if (moved < 12 && performance.now() - t0 < 600 && onTap) onTap(sx, sy); };
    d.addEventListener('pointerdown', down); d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    ses.ui.onCleanup(() => d.remove());
    return d;
  }
  function glowTexture(T, stops, size = 128) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new T.CanvasTexture(c); t.userData = { own: true }; return t;
  }

  /* =====================================================================
     НОЧНОЙ ДОЗОР: башня, огонь на дальнем посту, факел
     ===================================================================== */
  H.kinds.watch = async function (ses, b) {
    ensureCss();
    const ui = ses.ui, host = ses.host, gl = glOf(ses), h = host.handle, scene = host.scene;
    if (!gl || !h || !scene) { await ui.sheet({ title: b.title, text: [b.fallback] }); return { skipped: true }; }
    const T = gl.T, DN = window.DayNight || null, dn = host.dn || null;
    const TW = (h.places && h.places.tower) || { x: 0, z: 0, floor: 10, rT: 3 };
    const floor = TW.floor || 16.9, own = [];
    const keep = o => { own.push(o); return o; };
    ui.mode('clear');
    const sz = gl.size();
    const cam = new T.PerspectiveCamera(sz.w / sz.h < 0.8 ? 60 : 48, sz.w / sz.h, 0.1, (h.camera && h.camera.far) || 1600);
    // ночь: общий переключатель DayNight (сразу), потом — как было
    const ov0 = DN && DN.override ? DN.override() : null;
    if (DN && DN.set) { try { DN.set(23, { persist: false, instant: true }); } catch (e) { /* без ночи */ } }
    // героиня — на площадке башни, лицом к ущелью (юг = +z)
    const hero = host.hero || null, hr = hero && hero.root ? hero.root : null;
    const keepHero = hr ? { p: hr.position.clone(), r: hr.rotation.clone(), v: hr.visible, par: hr.parent } : null;
    const HP = { x: TW.x + 0.55, y: floor, z: TW.z + 1.25 };
    if (hr) { if (hr.parent !== scene) scene.add(hr); hr.visible = true; }
    const root = new T.Group(); root.name = 'history:watch'; root.userData.dn = 'none'; scene.add(root);
    // дальний огонь: пост «крепость тревоги» к югу, в ущелье
    const side = (H.progress(ses.c.id).n % 2) ? -1 : 1, az = side * (b.az || 0.62);
    const FD = b.dist || 430, FP = new T.Vector3(TW.x + Math.sin(az) * FD, floor - (b.drop || 58), TW.z + Math.cos(az) * FD);
    const fireTex = keep(glowTexture(T, [[0, 'rgba(255,250,225,1)'], [0.12, 'rgba(255,214,120,1)'], [0.35, 'rgba(255,140,40,.55)'], [1, 'rgba(255,90,10,0)']]));
    const mkSprite = (tex, o = {}) => { const m = keep(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depth !== false, blending: T.AdditiveBlending, fog: false, opacity: 0 })); m.userData.dn = 'none'; const s = new T.Sprite(m); s.userData.dn = 'none'; s.renderOrder = 50; root.add(s); return s; };
    const fire = mkSprite(fireTex, { depth: false }); fire.position.copy(FP); fire.scale.setScalar(1);
    const fireHalo = mkSprite(fireTex, { depth: false }); fireHalo.position.copy(FP);
    // факел на парапете: стойка, чаша, пламя (зажигается кнопкой)
    const TP = new T.Vector3(TW.x - 0.75, floor, TW.z + (TW.rT || 3.4) - 0.55);
    const iron = keep(new T.MeshBasicMaterial({ color: 0x140f0c })); iron.userData.dn = 'none';
    const pole = new T.Mesh(keep(new T.CylinderGeometry(0.045, 0.06, 1.85, 6)), iron); pole.position.set(TP.x, TP.y + 0.92, TP.z); root.add(pole);
    const bowl = new T.Mesh(keep(new T.CylinderGeometry(0.2, 0.09, 0.2, 8)), iron); bowl.position.set(TP.x, TP.y + 1.93, TP.z); root.add(bowl);
    const flameTex = keep(glowTexture(T, [[0, 'rgba(255,252,235,1)'], [0.25, 'rgba(255,205,95,.95)'], [0.6, 'rgba(255,120,30,.45)'], [1, 'rgba(255,80,0,0)']]));
    const flame = mkSprite(flameTex), flame2 = mkSprite(flameTex), glow = mkSprite(fireTex);
    [flame, flame2, glow].forEach(s => s.position.set(TP.x, TP.y + 2.25, TP.z));
    const S = { talk: true, yaw: -az * 0.55, pitch: -0.06, t: 0, phase: 'look', lit: 0, litT: 0, found: 0, auto: 0, fov: cam.fov };
    const YAW = 1.75, P0 = -0.5, P1 = 0.3;
    const pv = new T.Vector3(), tmp = new T.Vector3();
    const place = () => {
      const cy = Math.cos(S.pitch), dx = Math.sin(S.yaw) * cy, dy = Math.sin(S.pitch), dz = Math.cos(S.yaw) * cy, sx = Math.sin(S.yaw), sz2 = Math.cos(S.yaw);
      // героиня — чуть впереди середины площадки, лицом туда же, куда смотрит камера; камера — за её плечом, внутри парапета
      HP.x = TW.x + sx * 0.75; HP.z = TW.z + sz2 * 0.75;
      if (hr) { hr.position.set(HP.x, HP.y, HP.z); hr.rotation.set(0, S.yaw, 0); }
      pv.set(TW.x - sx * 1.75 - sz2 * 0.55, floor + 2.5, TW.z - sz2 * 1.75 + sx * 0.55);
      cam.position.copy(pv);
      cam.lookAt(pv.x + dx * 10, pv.y + dy * 10 - 1.1, pv.z + dz * 10);
    };
    const hint = t => ui.hint(t, 'calc(30px + env(safe-area-inset-bottom,0px))');
    let done = null; const fin = new Promise(r => { done = r; });
    const screenOf = p => { const q = gl.size(); tmp.copy(p).project(cam); return tmp.z > 1 ? null : { x: (tmp.x + 1) / 2 * q.w, y: (1 - tmp.y) / 2 * q.h }; };
    dragLayer(ses, (dx, dy) => {
      if (S.phase === 'end') return;
      S.yaw = clamp(S.yaw + dx * 0.0052, -YAW, YAW); S.pitch = clamp(S.pitch + dy * 0.004, P0, P1);   // картинка едет за пальцем (восток — слева, когда смотришь на юг)
    }, (x, y) => {
      if (S.phase !== 'look' || S.talk || S.t < 2.2) return;
      const rc = gl.r.domElement.getBoundingClientRect(), p = screenOf(FP); if (!p) return;
      if (Math.hypot(p.x + rc.left - x, p.y + rc.top - y) < 54) found();
    });
    function found() {
      if (S.phase !== 'look') return; S.phase = 'found'; S.found = S.t;
      try { if (host.haptic) host.haptic('success'); } catch (e) { /* ok */ }
      ui.toast(b.toastFound, 1600); hint(b.hintTorch);
      const btn = ui.el('button', 'kh-btn kh-fire', b.btnTorch); btn.type = 'button'; ui.root.appendChild(btn); ui.onCleanup(() => btn.remove());
      btn.addEventListener('click', () => {
        if (S.phase !== 'found') return; S.phase = 'lit'; S.litT = S.t; btn.remove(); hint(null);
        try { if (host.haptic) host.haptic('medium'); } catch (e) { /* ok */ }
        if (dn && dn.actorWarm) { try { dn.actorWarm(1); } catch (e) { /* ok */ } }
        ui.toast(b.toastLit, 1800);
      });
    }
    // для проверок (стенд, автотесты касаниями): где огонь на экране и что сейчас происходит
    ses.debug = { kind: 'watch', state: () => ({ phase: S.phase, t: +S.t.toFixed(1), yaw: +S.yaw.toFixed(2), az, talk: S.talk }), fire: () => { const p = screenOf(FP), rc = gl.r.domElement.getBoundingClientRect(); return p ? { x: p.x + rc.left, y: p.y + rc.top } : null; } };
    let horses = null;
    function showHorses() {
      horses = ui.el('div', 'kh-horses'); const cv = document.createElement('canvas'); const W = 720, Hh = 176; cv.width = W; cv.height = Hh; horses.appendChild(cv);
      const cap = ui.el('div', '', ui.esc(b.horses)); horses.appendChild(cap); ui.root.appendChild(horses);
      const x = cv.getContext('2d');
      const g = x.createRadialGradient(W * 0.5, Hh * 1.05, 10, W * 0.5, Hh * 1.05, W * 0.6); g.addColorStop(0, 'rgba(255,170,70,.5)'); g.addColorStop(1, 'rgba(255,150,50,0)'); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 7; i++) horseSil(x, 58 + i * 101, Hh - 12, 0.98 + (i % 3) * 0.04, i % 3 === 1 ? -1 : 1);
      ui.onCleanup(() => { if (horses) horses.remove(); });
    }
    const anim = hero && hero.rig && hero.rig.anim ? hero.rig.anim : null;
    let nightK = -1;
    gl.loop((dt, now) => {
      S.t += dt; if (S.talk && S.t > 1.2) S.t = 1.2;
      // огонь разгорается через пару секунд; не нашли — подсказка, куда смотреть
      const fk = sst(2.2, 4.5, S.t), fl = 0.82 + 0.18 * Math.sin(now * 13.1) * Math.sin(now * 7.3 + 1);
      const big = S.phase === 'look' ? 1 + sst(14, 26, S.t) * 0.8 : 1.25;
      fire.material.opacity = fk * fl; fire.scale.setScalar(FD * 0.03 * big * (0.9 + fl * 0.15));
      fireHalo.material.opacity = fk * 0.3 * fl; fireHalo.scale.setScalar(FD * 0.12 * big);
      if (S.phase === 'look' && S.t > 13 && !S.hinted) { S.hinted = true; hint(Math.sin(az - S.yaw) > 0 ? b.hintLeft : b.hintRight); }
      if (S.phase === 'look' && S.t > 24 && !S.hinted2) { S.hinted2 = true; hint(b.hintTap); }
      if (S.phase === 'lit' || S.phase === 'end') {
        const k = sst(0, 1.3, S.t - S.litT), f2 = 0.85 + 0.15 * Math.sin(now * 17) * Math.sin(now * 9.7 + 2);
        flame.material.opacity = k; flame.scale.set(0.75 * f2, 1.25 * (0.9 + f2 * 0.2), 1); flame.position.y = TP.y + 2.35 + f2 * 0.05;
        flame2.material.opacity = k * 0.8; flame2.scale.set(0.42, 0.72 * f2, 1); flame2.position.y = TP.y + 2.2;
        glow.material.opacity = k * 0.26 * f2; glow.scale.setScalar(3.6);
        // камера сама поворачивается к факелу и героине
        const e = 1 - Math.exp(-dt * 1.6); S.yaw += (0.2 - S.yaw) * e; S.pitch += (0.0 - S.pitch) * e;
        if (S.phase === 'lit' && S.t - S.litT > 2.6) { S.phase = 'end'; showHorses(); setTimeout(() => done({ found: +S.found.toFixed(1) }), 2600); }
      }
      place();
      if (anim) { try { anim.update(dt, { speed: 0, sitting: false, idle: true }); } catch (e) { /* поза как есть */ } }
      try { h.update(dt, HP, cam); } catch (e) { /* ok */ }
      if (dn) {
        try {
          dn.update(dt, cam);
          const k = dn.lampsOn() ? Math.max(0.65, dn.night()) : dn.night() * 0.5;
          if (Math.abs(k - nightK) > 0.004 && h.setNight) { nightK = k; h.setNight(k); }
        } catch (e) { /* ok */ }
      }
      gl.render(scene, cam);
    });
    ui.onCleanup(() => {
      gl.stop();
      scene.remove(root); own.forEach(o => { try { o.dispose(); } catch (e) { /* ok */ } });
      if (hr && keepHero) { if (keepHero.par && hr.parent !== keepHero.par) keepHero.par.add(hr); hr.position.copy(keepHero.p); hr.rotation.copy(keepHero.r); hr.visible = keepHero.v; }
      if (dn && dn.actorWarm) { try { dn.actorWarm(0); } catch (e) { /* ok */ } }
      if (DN && DN.set) { try { DN.set(ov0, { persist: false, instant: true }); } catch (e) { /* ok */ } }
      // вернуть селу его время суток сразу (хозяин сравнивает со своим прошлым значением и сам бы не пересчитал)
      if (dn) { try { dn.update(0.016, cam); const k = dn.lampsOn() ? Math.max(0.65, dn.night()) : dn.night() * 0.5; if (h.setNight) h.setNight(k); } catch (e) { /* ok */ } }
    });
    if (b.before) await ui.say(b.before);
    hint(b.hintLook); S.talk = false;
    S.t = Math.min(S.t, 1.2);   // огонь загорается после слов глашатая
    const r = await ui.wait(fin);
    if (b.after) await ui.say(b.after);
    return r;
  };
  // силуэт осёдланной лошади (тёмный, с тёплым контуром от факела)
  function horseSil(x, cx, gy, s, dir) {
    x.save(); x.translate(cx, gy); x.scale(dir * s, s);
    const body = () => {
      x.beginPath(); x.ellipse(0, -52, 34, 17, 0, 0, TAU); x.fill();
      x.beginPath(); x.moveTo(20, -62); x.quadraticCurveTo(34, -92, 46, -100); x.lineTo(60, -92); x.quadraticCurveTo(64, -84, 58, -80); x.lineTo(48, -82); x.quadraticCurveTo(40, -66, 34, -48); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(44, -101); x.lineTo(47, -110); x.lineTo(51, -100); x.fill();
      [[-26, 0], [-16, 2], [18, 0], [27, 2]].forEach(([lx, d]) => x.fillRect(lx - 3.5, -44, 7, 44 - d));
      x.beginPath(); x.moveTo(-32, -58); x.quadraticCurveTo(-48, -50, -44, -22); x.quadraticCurveTo(-38, -44, -30, -48); x.fill();
    };
    x.fillStyle = 'rgba(255,176,84,.55)'; x.save(); x.translate(-1.5 * dir, -2); body(); x.restore();
    x.fillStyle = '#17110f'; body();
    x.fillStyle = '#C8772A'; x.beginPath(); x.ellipse(-2, -68, 15, 6, 0, PI, TAU); x.fill(); x.fillRect(-13, -68, 22, 5);
    x.restore();
  }

  /* =====================================================================
     НАХОДКА: каменный тимпан с всадником (карта высот → рельеф)
     ===================================================================== */
  function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = src; }); }
  function buildTympan(T, im, o) {
    const W = im.naturalWidth || im.width, Hh = im.naturalHeight || im.height;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0); const D = x.getImageData(0, 0, W, Hh).data;
    const hAt = (px, py) => D[(clamp(py | 0, 0, Hh - 1) * W + clamp(px | 0, 0, W - 1)) * 4] / 255;
    const aAt = (px, py) => D[(clamp(py | 0, 0, Hh - 1) * W + clamp(px | 0, 0, W - 1)) * 4 + 3];
    // сглаженная высота для сетки (3×3), точная — в карту нормалей
    const hS = (px, py) => { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += hAt(px + i * 2, py + j * 2); return s / 9; };
    const step = o.step || 4, NX = Math.floor(W / step), NY = Math.floor(Hh / step);
    const SW = o.width, SH = SW * Hh / W, TH = o.thick, DEP = o.depth;
    const pos = [], uv = [], idx = [], vid = new Int32Array((NX + 1) * (NY + 1)).fill(-1), inside = new Uint8Array((NX + 1) * (NY + 1));
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) inside[j * (NX + 1) + i] = aAt(Math.min(i * step, W - 1), Math.min(j * step, Hh - 1)) > 127 ? 1 : 0;
    const vert = (i, j) => {
      const k = j * (NX + 1) + i; if (vid[k] >= 0) return vid[k];
      const u = i / NX, v = j / NY; vid[k] = pos.length / 3;
      pos.push((u - 0.5) * SW, (0.5 - v) * SH, hS(Math.min(i * step, W - 1), Math.min(j * step, Hh - 1)) * DEP); uv.push(u, 1 - v); return vid[k];
    };
    const cell = (i, j) => i >= 0 && j >= 0 && i < NX && j < NY && inside[j * (NX + 1) + i] && inside[j * (NX + 1) + i + 1] && inside[(j + 1) * (NX + 1) + i] && inside[(j + 1) * (NX + 1) + i + 1];
    const cells = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (cell(i, j)) { const a = vert(i, j), b = vert(i + 1, j), d = vert(i, j + 1), e = vert(i + 1, j + 1); idx.push(a, d, b, b, d, e); cells.push(i, j); }
    const front = new T.BufferGeometry();
    front.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); front.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); front.setIndex(idx); front.computeVertexNormals();
    // бока и спина — одной сеткой, без текстуры рельефа
    const p2 = [], n2 = [];
    const P = (i, j, z) => [(i / NX - 0.5) * SW, (0.5 - j / NY) * SH, z];
    // нормаль бока — по градиенту размытого силуэта: арка гладкая, хотя сетка ступенчатая
    const aB = (px, py) => { let t = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) t += aAt(px + i * 5, py + j * 5); return t / 25; };
    const sideN = q => { const px = (q[0] / SW + 0.5) * W, py = (0.5 - q[1] / SH) * Hh, gx = aB(px + 6, py) - aB(px - 6, py), gy = aB(px, py + 6) - aB(px, py - 6), l = Math.hypot(gx, gy); return l > 4 ? [-gx / l, gy / l, 0] : null; };
    const quad = (a, b, c2, d, n, side) => { [a, b, c2, a, c2, d].forEach(q => { const m = (side && sideN(q)) || n; p2.push(q[0], q[1], q[2]); n2.push(m[0], m[1], m[2]); }); };
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k], j = cells[k + 1];
      quad(P(i, j, -TH), P(i + 1, j, -TH), P(i + 1, j + 1, -TH), P(i, j + 1, -TH), [0, 0, -1]);
      const zf = (ii, jj) => hS(Math.min(ii * step, W - 1), Math.min(jj * step, Hh - 1)) * DEP;
      if (!cell(i, j - 1)) quad(P(i, j, zf(i, j)), P(i + 1, j, zf(i + 1, j)), P(i + 1, j, -TH), P(i, j, -TH), [0, 1, 0], true);
      if (!cell(i, j + 1)) quad(P(i + 1, j + 1, zf(i + 1, j + 1)), P(i, j + 1, zf(i, j + 1)), P(i, j + 1, -TH), P(i + 1, j + 1, -TH), [0, -1, 0], true);
      if (!cell(i - 1, j)) quad(P(i, j + 1, zf(i, j + 1)), P(i, j, zf(i, j)), P(i, j, -TH), P(i, j + 1, -TH), [-1, 0, 0], true);
      if (!cell(i + 1, j)) quad(P(i + 1, j, zf(i + 1, j)), P(i + 1, j + 1, zf(i + 1, j + 1)), P(i + 1, j + 1, -TH), P(i + 1, j, -TH), [1, 0, 0], true);
    }
    const back = new T.BufferGeometry(); back.setAttribute('position', new T.Float32BufferAttribute(p2, 3)); back.setAttribute('normal', new T.Float32BufferAttribute(n2, 3));
    // карта нормалей (в полном разрешении) и цвет камня с затемнением в бороздах
    const nc = document.createElement('canvas'); nc.width = W; nc.height = Hh; const nx = nc.getContext('2d'); const ND = nx.createImageData(W, Hh);
    const cc = document.createElement('canvas'); cc.width = W; cc.height = Hh; const cx = cc.getContext('2d'); const CD = cx.createImageData(W, Hh);
    const K = o.bump || 3.2; let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
      const q = (py * W + px) * 4, dx = (hAt(px + 1, py) - hAt(px - 1, py)) * K, dy = (hAt(px, py + 1) - hAt(px, py - 1)) * K, l = 1 / Math.hypot(dx, dy, 1);
      ND.data[q] = (-dx * l * 0.5 + 0.5) * 255; ND.data[q + 1] = (dy * l * 0.5 + 0.5) * 255; ND.data[q + 2] = (l * 0.5 + 0.5) * 255; ND.data[q + 3] = 255;
      const hh = hAt(px, py), sh = 0.7 + hh * 0.36 + (rnd() - 0.5) * 0.07;
      CD.data[q] = clamp(205 * sh, 0, 255); CD.data[q + 1] = clamp(186 * sh, 0, 255); CD.data[q + 2] = clamp(152 * sh, 0, 255); CD.data[q + 3] = 255;
    }
    nx.putImageData(ND, 0, 0); cx.putImageData(CD, 0, 0);
    const tex = cv => { const t = new T.CanvasTexture(cv); t.generateMipmaps = false; t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; };
    const map = tex(cc), nmap = tex(nc);
    const matF = new T.MeshPhongMaterial({ map, normalMap: nmap, normalScale: new T.Vector2(0.9, 0.9), shininess: 6, specular: new T.Color(0x1c1814) });
    const matB = new T.MeshPhongMaterial({ color: 0xB9A888, shininess: 4, specular: new T.Color(0x1a140e) });
    const g = new T.Group(), mf = new T.Mesh(front, matF), mb = new T.Mesh(back, matB); g.add(mf); g.add(mb);
    c.width = c.height = 0;
    return { group: g, front: mf, tris: idx.length / 3 + p2.length / 9, size: [SW, SH], dispose() { front.dispose(); back.dispose(); matF.dispose(); matB.dispose(); map.dispose(); nmap.dispose(); nc.width = nc.height = 0; cc.width = cc.height = 0; } };
  }
  H.kinds.artifact = async function (ses, b) {
    ensureCss();
    const ui = ses.ui, host = ses.host, gl = glOf(ses), A = V.historyAssets && V.historyAssets[b.asset];
    let im = null;
    if (gl && A) { try { im = await ui.wait(loadImage(A.src)); } catch (e) { if (e === H.EXIT) throw e; im = null; } }
    if (!gl || !im) { await ui.sheet({ kick: b.kick, title: b.title, text: [b.fallback] }); return { skipped: true }; }
    const T = gl.T;
    ui.mode('clear');
    const vig = ui.el('div', 'kh-vig'); ui.root.insertBefore(vig, ui.root.firstChild); ui.onCleanup(() => vig.remove());
    const scene = new T.Scene(); scene.background = new T.Color(0x2A1B12);
    const ty = buildTympan(T, im, { width: 1.05, thick: 0.13, depth: 0.02, step: 4, bump: 2.6 });   // 105 × 66 × 13 см, как в книге
    const pivot = new T.Group(); pivot.add(ty.group); scene.add(pivot);
    // тёплый боковой свет (скользящий: рельеф читается), слабый холодный встречный и общий
    const key = new T.DirectionalLight(0xFFE0B0, 0.92); key.position.set(-1.6, 0.9, 0.7); scene.add(key);
    const rim = new T.DirectionalLight(0x9FB2DC, 0.22); rim.position.set(1.4, -0.3, 0.6); scene.add(rim);
    scene.add(new T.AmbientLight(0xFFEEDC, 0.3));
    const sz = gl.size(), asp = sz.w / sz.h;
    const cam = new T.PerspectiveCamera(32, asp, 0.05, 20);
    const dist = Math.max((1.05 / 0.93) / (2 * Math.tan(cam.fov * PI / 360) * asp), (0.66 / 0.5) / (2 * Math.tan(cam.fov * PI / 360)));
    cam.position.set(0, 0, dist); pivot.position.y = Math.tan(cam.fov * PI / 360) * dist * 0.12;
    const S = { yaw: -0.5, pitch: 0.08, vy: 0, touched: false, t: 0, found: false, foundT: 0 };
    const ray = new T.Raycaster(), nd = new T.Vector2();
    let done = null; const fin = new Promise(r => { done = r; });
    let taps = 0; S.talk = true;
    dragLayer(ses, (dx, dy) => { S.touched = true; S.yaw = clamp(S.yaw + dx * 0.008, -1.25, 1.25); S.pitch = clamp(S.pitch + dy * 0.006, -0.55, 0.55); }, (x, y) => {
      if (S.found || S.talk) return;
      const rc = gl.r.domElement.getBoundingClientRect(); nd.set((x - rc.left) / rc.width * 2 - 1, -((y - rc.top) / rc.height * 2 - 1));
      ray.setFromCamera(nd, cam); const hit = ray.intersectObject(ty.front, false)[0];
      if (!hit || !hit.uv) return;
      const u = hit.uv.x, v = hit.uv.y, r = b.target;
      if (u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) { S.found = true; S.foundT = S.t; try { if (host.haptic) host.haptic('success'); } catch (e) { /* ok */ } ui.toast(b.toastFound, 1700); ui.hint(null); setTimeout(() => done({ taps }), 2200); }
      else { taps++; ui.toast(b.toastMiss[taps % b.toastMiss.length], 1900); }
    });
    gl.loop(dt => {
      S.t += dt;
      if (!S.touched) S.yaw = -0.5 + Math.sin(S.t * 0.7) * 0.28;   // пока не трогали — сам покачивается: видно, что это объём
      if (S.found) { const e = 1 - Math.exp(-dt * 3); S.yaw += (-0.42 - S.yaw) * e; S.pitch += (0.05 - S.pitch) * e; }
      if (!S.found && S.t > 22 && !S.h2) { S.h2 = true; ui.hint(b.hintFind, 'calc(30px + env(safe-area-inset-bottom,0px))'); }
      pivot.rotation.set(S.pitch, S.yaw, 0);
      gl.render(scene, cam);
    });
    ui.onCleanup(() => { gl.stop(); ty.dispose(); });
    ses.debug = { kind: 'artifact', state: () => ({ found: S.found, talk: S.talk, tris: ty.tris, yaw: +S.yaw.toFixed(2) }), rider: () => { const r = b.target, v = new T.Vector3(((r[0] + r[2]) / 2 - 0.5) * ty.size[0], ((r[1] + r[3]) / 2 - 0.5) * ty.size[1] + 0.02, 0.02); ty.front.localToWorld(v); v.project(cam); const rc = gl.r.domElement.getBoundingClientRect(); return { x: (v.x + 1) / 2 * rc.width + rc.left, y: (1 - v.y) / 2 * rc.height + rc.top }; } };
    if (b.before) await ui.say(b.before);
    S.talk = false; S.t = 0; ui.hint(b.hintSpin, 'calc(30px + env(safe-area-inset-bottom,0px))');
    const r = await ui.wait(fin);
    if (b.after) await ui.say(b.after);
    return Object.assign({ tris: ty.tris }, r);
  };
  H._buildTympan = buildTympan;
})();
