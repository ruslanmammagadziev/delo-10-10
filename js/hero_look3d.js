/* =====================================================================
   ОБРАЗ 3D-ГЕРОИНИ: бант, берет, тренч и волосы на модели автора (js/hero3d.js).
   У модели одна запечённая текстура, поэтому образ перекрашивает саму текстуру. Она общая для улицы
   и комнат (js/city3d.js), открытого города (js/world/main.js) и гор (js/world/regions.js берёт героиню
   города) — образ везде один и тот же.
   Области ищем один раз за сессию и только когда образ не авторский:
     зона — по главной кости и позе покоя каждой вершины (лицо, голова, верх берета, бант, тело, кисти, ноги),
     растром треугольников в UV; внутри зоны — по цвету пикселя (CIE Lab): волосы, тренч с поясом, бант, берет.
   Перекраска — тот же приём, что у рисунка (HERO.recolorPixels в js/hero_assets.js): яркость пикселя
   относительно яркости области -> цвет образа, складки и тени остаются. Берет — под цвет банта (HERO.beretOf).
   HeroLook3D.apply(H3, look) -> true, если текстура теперь в этом образе (H3 — то, что отдал HERO3D.load()).
     look = { bow, coat, hair } как в G.state(); совпадающее с цветом по умолчанию не трогаем — пиксели автора.
   HeroLook3D.look() — последний применённый образ; HeroLook3D.stats — время разметки и перекраски (для тестов).
   HeroLook3D.source(map) — исходная картинка текстуры (авторские цвета) — для тех, кто ищет по цвету пикселя
     (лупа в js/interact.js, берет и пряди под казом в js/village/kaz.js): разметка не должна зависеть от образа.
   HeroLook3D.hair() — цвет волос на модели в нынешнем образе (как HERO3D.hair, но перекрашенный): «шапочка» под казом и т. п.
   Рамки лица (глаза, брови, губы) и банта заданы в метрах под нынешнюю модель: при замене js/hero3d.js — перепроверить.
   ===================================================================== */
(function () {
  'use strict';
  const DEF = { bow: '#F08FA8', coat: '#E9D4B6', hair: '#4A3128' };
  const KEYS = ['hair', 'coat', 'bow', 'beret'];
  // зоны вершин и пикселей
  const Z_FACE = 1, Z_LEG = 2, Z_HAND = 3, Z_BODY = 4, Z_HEAD = 5, Z_TOP = 6, Z_BOW = 7;
  // в какую сторону уводить яркость: допустимое r = Y(пиксель) / Y(область) у каждой области
  const RANGE = { hair: [0.2, 1.8], coat: [0.25, 1.15], bow: [0.5, 1.1], beret: [0.35, 1.6] };
  const GAMMA_MIN = 0.45;
  const stats = { prepMs: 0, paintMs: 0, paints: 0, px: [0, 0, 0, 0] };
  const preps = new WeakMap();
  // текстура -> её исходная картинка (до перекраски)
  const srcs = new WeakMap();
  let lastLook = null, lastP = null;

  const hex = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const same = (a, b) => !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();
  const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
  const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // sRGB -> CIE Lab (D65), точно (на решётке цвета кожи у ворота путались с тренчем)
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const fLab = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  function toLab(r, g, b, out) {
    const R = LIN[r], G = LIN[g], B = LIN[b];
    const fx = fLab((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
    const fy = fLab(0.2126729 * R + 0.7151522 * G + 0.0721750 * B);
    const fz = fLab((0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883);
    out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  }

  // зона вершины: по главной кости скина (имена костей — HERO3D.rig.bones) и позе покоя (ноги на y = 0, лицом к +Z)
  function vertexZones(geo) {
    const p = geo.attributes.position, n = p.count, zone = new Uint8Array(n);
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const RB = (window.HERO3D && HERO3D.rig && HERO3D.rig.bones) || null;
    const A = (window.HERO3D && HERO3D.anchors) || {}, hem = A.hem || 0.54;
    const kind = RB && si && sw ? RB.map(b => {
      const nm = b[0];
      if (nm === 'head' || nm === 'hair') return 'head';
      if (/^(shin|foot)_/.test(nm)) return 'leg';
      if (/^thigh_/.test(nm)) return 'thigh';
      if (/^hand_/.test(nm)) return 'hand';
      return 'body';
    }) : null;
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let k;
      if (kind) {
        let best = 0, bw = -1;
        for (let c = 0; c < 4; c++) { const w = sw.array[i * 4 + c]; if (w > bw) { bw = w; best = si.array[i * 4 + c]; } }
        k = kind[best] || 'body';
      } else k = y > 1.28 ? 'head' : y < hem ? 'leg' : (Math.abs(x) > 0.17 && y < 0.82) ? 'hand' : 'body';
      if (k === 'thigh') k = y < hem ? 'leg' : 'body';
      let zz;
      if (k === 'leg') zz = Z_LEG;
      else if (k === 'hand') zz = Z_HAND;
      else if (k === 'body') zz = Z_BODY;
      // лицо: глаза с ресницами, брови, нос и губы не трогаем никогда (тёмные прядки у висков — уже волосы);
      // верх берета и бант — свои зоны
      // (модель чуть несимметрична: левая бровь и стрелка левого глаза — до x ≈ 0.14, справа у виска — прядь от x ≈ -0.1)
      else if (z > 0.06 && ((y > 1.5 && y < 1.58 && x > -0.118 && x < 0.142) || (y >= 1.58 && y < 1.632 && x > -0.101 && x < 0.14) || (y > 1.36 && y <= 1.5 && Math.abs(x) < 0.07))) zz = Z_FACE;
      else if (x > 0.09 && y > 1.6 && z > -0.1) zz = Z_BOW;
      else if (y > 1.62) zz = Z_TOP;
      else zz = Z_HEAD;
      zone[i] = zz;
    }
    return zone;
  }

  // растр зон в UV (центры пикселей), потом зоны «растекаются» на поля между островами текстуры
  function zoneRaster(geo, vz, W, H) {
    const uv = geo.attributes.uv, idx = geo.index, zr = new Uint8Array(W * H);
    const nt = idx ? idx.count / 3 : uv.count / 3, ia = idx ? idx.array : null;
    const U = new Float32Array(uv.count), V = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) { U[i] = uv.getX(i) * W; V[i] = uv.getY(i) * H; }
    for (let t = 0; t < nt; t++) {
      const a = ia ? ia[t * 3] : t * 3, b = ia ? ia[t * 3 + 1] : t * 3 + 1, c = ia ? ia[t * 3 + 2] : t * 3 + 2;
      const za = vz[a], zb = vz[b], zc = vz[c];
      // зона треугольника — большинством; все три разные — самая «осторожная» (меньший код)
      const z = za === zb || za === zc ? za : zb === zc ? zb : Math.min(za, zb, zc);
      const x0 = U[a], y0 = V[a], x1 = U[b], y1 = V[b], x2 = U[c], y2 = V[c];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const s = area > 0 ? 1 : -1;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let py = minY; py <= maxY; py++) {
        const cy = py + 0.5;
        for (let px = minX; px <= maxX; px++) {
          const cx = px + 0.5;
          const w0 = ((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)) * s;
          const w1 = ((x0 - x2) * (cy - y2) - (y0 - y2) * (cx - x2)) * s;
          const w2 = ((x1 - x0) * (cy - y0) - (y1 - y0) * (cx - x0)) * s;
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) zr[py * W + px] = z;
        }
      }
    }
    // поля островов: до 4 проходов «соседа» — для фильтрации и мип-уровней край острова того же цвета
    const tmp = new Uint8Array(W * H);
    for (let pass = 0; pass < 4; pass++) {
      tmp.set(zr);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (tmp[i]) continue;
          const v = (x > 0 && tmp[i - 1]) || (x < W - 1 && tmp[i + 1]) || (y > 0 && tmp[i - W]) || (y < H - 1 && tmp[i + W]) || 0;
          if (v) zr[i] = v;
        }
      }
    }
    return zr;
  }

  // вес каждой области у пикселя (0..1) по зоне и цвету
  function weights(z, L, a, b, out) {
    out[0] = out[1] = out[2] = out[3] = 0;
    if (z === Z_BODY || z === Z_HAND) {
      // тренч, пояс, хлястики, пуговицы: тёплый серо-бежевый любой яркости (кожа краснее, золото лупы желтее, колготки синее)
      let c = sm(22, 30, L) * sm(11, 8.5, a) * sm(-6, -3, a) * sm(4, 7, b) * sm(31, 27, b) * sm(0.62, 0.48, a / b);
      if (z === Z_HAND) c *= sm(42, 50, L) * sm(25, 21, b);
      out[1] = c;
      return;
    }
    if (z === Z_HEAD || z === Z_TOP || z === Z_BOW) {
      // волосы: всё тёмное и не малиновое (кожа светлее, у бордового берета a заметно больше b); глаза и брови — в зоне лица
      // (у почти чёрных пикселей оттенок ненадёжен — там малиновым считаем только явно малиновое)
      const lo = 0.2 + 0.3 * sm(10, 18, L);
      out[0] = sm(44, 36, L) * sm(30, 25, a) * sm(-4, -1, b) * (a < 8 ? 1 : sm(lo, lo + 0.25, b / a));
    }
    if (z === Z_TOP || z === Z_BOW) {
      // берет: малиновый, не светлый (бант светлее)
      out[3] = sm(18, 24, a) * sm(1.2, 1.6, a / Math.max(b, 1)) * (z === Z_BOW ? sm(56, 48, L) : sm(64, 56, L));
    }
    if (z === Z_BOW) {
      // бант: светло-розовый, «холоднее» кожи (у кожи и румянца a ≈ b)
      out[2] = sm(14, 20, a) * sm(1.3, 1.7, a / Math.max(b, 1)) * sm(48, 56, L);
    }
  }

  function prep(H3) {
    if (preps.has(H3)) return preps.get(H3);
    let P = null;
    try {
      const t0 = performance.now(), map = H3.map, img = map && map.image, geo = H3.geometry;
      const W = img && (img.naturalWidth || img.width), H = img && (img.naturalHeight || img.height);
      if (!W || !H || !geo || !geo.attributes.uv || typeof document === 'undefined') throw new Error('no texture');
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, W, H);
      const orig = cx.getImageData(0, 0, W, H).data.slice();
      const zr = zoneRaster(geo, vertexZones(geo), W, H);
      const cls = new Uint8Array(W * H), wv = new Float32Array(4), lab = new Float32Array(3);
      // типичная яркость и цвет области: по «чистым» пикселям (вес 1), средние тона
      const hist = KEYS.map(() => new Uint32Array(256)), cnt = [0, 0, 0, 0];
      for (let i = 0, j = 0, n = W * H; i < n; i++, j += 4) {
        const z = zr[i];
        if (z < Z_HAND) continue;
        const r = orig[j], g = orig[j + 1], b = orig[j + 2];
        toLab(r, g, b, lab);
        weights(z, lab[0], lab[1], lab[2], wv);
        let k = 0; for (let m = 1; m < 4; m++) if (wv[m] > wv[k]) k = m;
        const w = Math.round(wv[k] * 31);
        if (!w) continue;
        cls[i] = ((k + 1) << 5) | w;
        if (w === 31) { hist[k][Math.round(luma(r, g, b))]++; cnt[k]++; }
      }
      const base = KEYS.map((key, k) => {
        if (!cnt[k]) return null;
        const h = hist[k], c = cnt[k];
        let acc = 0, med = 128;
        for (let y = 0; y < 256; y++) { acc += h[y]; if (acc >= c / 2) { med = y; break; } }
        return Math.max(med, 1);
      });
      stats.px = cnt.slice();
      P = { W, H, orig, cls, base, cv, cx, out: null, img0: img, key: '', tabs: null };
      srcs.set(map, img);
      stats.prepMs = Math.round(performance.now() - t0);
    } catch (e) { console.warn('hero look 3d', e); P = null; }
    preps.set(H3, P);
    return P;
  }

  // цели перекраски: как HERO.targets у рисунка (берет — под бант)
  function targets(look) {
    const t = {};
    if (look.hair && !same(look.hair, DEF.hair)) t.hair = look.hair;
    if (look.coat && !same(look.coat, DEF.coat)) t.coat = look.coat;
    if (look.bow && !same(look.bow, DEF.bow)) {
      t.bow = look.bow;
      let br = null;
      try { br = window.HERO && typeof HERO.beretOf === 'function' ? HERO.beretOf(look.bow) : null; } catch (e) { br = null; }
      if (!br) { const c = hex(look.bow), Y = luma(c[0], c[1], c[2]), k = Y > 70 ? 0.55 : 1.6; br = '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join(''); }
      t.beret = br;
    }
    return t;
  }

  function paint(P, t) {
    const t0 = performance.now(), { W, H, orig, cls, base } = P;
    if (!P.out) P.out = P.cx.createImageData(W, H);
    const d = P.out.data; d.set(orig);
    // на каждую область — таблица «яркость пикселя -> множитель цвета образа» (pow один раз на уровень, а не на пиксель)
    const tabs = KEYS.map((key, k) => {
      if (!t[key] || !base[k]) return null;
      const T = hex(t[key]), lt = Math.max(luma(T[0], T[1], T[2]), 1), lb = base[k], R = RANGE[key];
      const g = Math.min(1, Math.max(GAMMA_MIN, Math.sqrt(lb / lt))), tab = new Float32Array(256);
      for (let y = 0; y < 256; y++) tab[y] = Math.pow(Math.min(R[1], Math.max(R[0], y / lb)), g);
      return { T, tab };
    });
    P.tabs = tabs;
    for (let i = 0, n = W * H; i < n; i++) {
      const c = cls[i];
      if (!c) continue;
      const tb = tabs[(c >> 5) - 1];
      if (!tb) continue;
      const j = i << 2, r0 = d[j], g0 = d[j + 1], b0 = d[j + 2], w = (c & 31) / 31;
      const k = tb.tab[Math.round(luma(r0, g0, b0))], T = tb.T;
      let v0 = T[0] * k, v1 = T[1] * k, v2 = T[2] * k;
      const mx = Math.max(v0, v1, v2);
      if (mx > 255) {
        // пересвет уводим к белому, сохраняя яркость
        const Y = Math.min(luma(v0, v1, v2), 255), s = (255 - Y) / Math.max(mx - Y, 1e-6);
        v0 = Y + (v0 - Y) * s; v1 = Y + (v1 - Y) * s; v2 = Y + (v2 - Y) * s;
      }
      d[j] = r0 + (v0 - r0) * w; d[j + 1] = g0 + (v1 - g0) * w; d[j + 2] = b0 + (v2 - b0) * w;
    }
    P.cx.putImageData(P.out, 0, 0);
    stats.paintMs = Math.round(performance.now() - t0); stats.paints++;
  }

  function apply(H3, look) {
    if (!H3 || !H3.map) return false;
    const lk = {};
    if (look) KEYS.forEach(k => { if (look[k]) lk[k] = look[k]; });
    look = Object.assign({}, DEF, lastLook || {}, lk);
    const t = targets(look), key = KEYS.map(k => t[k] || '').join('|');
    const map = H3.map, P0 = preps.get(H3);
    lastLook = look; lastP = P0 || null;
    // авторский образ: исходная картинка (разметку не считаем, пока она не понадобится)
    if (!key.replace(/\|/g, '')) {
      if (P0 && map.image !== P0.img0) { map.image = P0.img0; map.needsUpdate = true; }
      if (P0) P0.key = '';
      return true;
    }
    const P = prep(H3);
    if (!P) return false;
    lastP = P;
    if (P.key === key && map.image === P.cv) return true;
    if (P.key !== key) { paint(P, t); P.key = key; }
    map.image = P.cv; map.needsUpdate = true;
    return true;
  }

  // цвет области модели (k — индекс в KEYS) в нынешнем образе: та же таблица, что у её пикселей; образ авторский — как есть
  function tone(k, h) {
    const P = lastP, tb = P && P.key && P.tabs ? P.tabs[k] : null;
    if (!tb || !h) return h;
    const c = hex(h), m = tb.tab[Math.round(luma(c[0], c[1], c[2]))];
    return '#' + tb.T.map(v => Math.max(0, Math.min(255, Math.round(v * m))).toString(16).padStart(2, '0')).join('');
  }

  window.HeroLook3D = {
    apply,
    look: () => Object.assign({}, DEF, lastLook || {}),
    source: map => (map && srcs.get(map)) || (map && map.image) || null,
    hair: () => tone(0, (window.HERO3D && HERO3D.hair) || '#3B1E0A'),
    stats,
    // для отладки: какие пиксели к какой области (0 — нет, 1 волосы, 2 тренч, 3 бант, 4 берет)
    _prep: prep,
  };
})();
