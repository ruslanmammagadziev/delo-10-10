/* =====================================================================
   ОТКРЫТЫЙ ГОРОД: реестр дверей (§9.2-D world_unify).
   Id дверей — общий словарь с Town и таблицей миссий: cinema, bureau, sweets, stairs (bkey roof), silver,
   orangery, atelier, photo, records, books, planet; лавки g_*; дома-заполнители — 'f<N>' (вход — тост).
   Координаты — мировые (Октябрьская в прежних координатах: начало отсчёта у двери кинотеатра, фасады на z = −2).
   Каждая дверь: { id, kind, x, z (порог), ax, az (точка подхода, 0,75 м наружу), nx, nz (наружу), yaw (взгляд наружу),
   bkey, label, room, district, w (ширина фасада для тапа) }.
   ===================================================================== */
(function () {
  'use strict';
  const WORLD = window.WORLD = window.WORLD || {};
  const FZ = -2;
  // сюжет и места прогулки: x двери на Октябрьской (как у улицы: DOOR_X в town.js, doorPos в city3d.js)
  const OCT = [
    ['cinema', 'story', 0, 'cinema', 'Кинотеатр «Саспенс»', 'cinema', 4.6],
    ['bureau', 'story', 6.2, 'bureau', 'Бюро переводов', 'bureau', 4.4],
    ['sweets', 'story', 17.25, 'sweets', 'Кондитерская', 'sweets', 4.6],
    ['stairs', 'story', 23.7, 'roof', 'Подъезд', 'roof', 4.4],
    ['silver', 'place', 11.9, 'silver', 'Часовщик', 'silver', 1.9],
    ['orangery', 'place', -7.2, 'orangery', 'Оранжерея', 'orangery', 3.3],
    ['atelier', 'place', -11.0, 'atelier', 'Ателье', 'atelier', 3.4],
    ['photo', 'place', -14.8, 'photo', 'Фотостудия', 'photo', 3.4],
    ['records', 'place', 30.1, 'records', 'Пластинки', 'records', 3.4],
    ['books', 'place', 33.9, 'books', 'Книжная лавка', 'books', 3.2],
    ['planet', 'place', 38.1, 'planet', 'Планетарий', 'planet', 3.8],
  ];
  // короткие подписи (как SHORT0 в town.js)
  const SHORT = { cinema: 'Кинотеатр', bureau: 'Бюро', sweets: 'Кондитерская', stairs: 'Подъезд', silver: 'Часовщик', orangery: 'Оранжерея', atelier: 'Ателье', photo: 'Фотостудия', records: 'Пластинки', books: 'Книжная лавка', planet: 'Планетарий' };

  // те же двери без сборки города (для WorldHub.doors() до первого отрезка): ряды домов считаются как в map.js
  WORLD.doorsStatic = function () {
    const INT = WORLD.INTERIORS || {}, GEN = WORLD.GEN_SLOTS || { w0: 'g_bakery', w1: 'g_cocoa', e0: 'g_toys', e1: 'g_post', s1: 'g_wash', s2: 'g_gallery', s3: 'g_umbrella', s4: 'g_yarn' };
    const fd = [];
    const doorWx = w => { const cols = Math.max(1, Math.floor(w / 1.25)), c = Math.floor(cols / 2); return -w / 2 + (c + 0.5) * w / cols; };
    { let x = -17.2, sd = 11, i = 0; while (x > -63 && i < 4) { const w = 3.2 + (sd % 3) * 0.5; fd.push({ slot: 'w' + i++, x: x - w / 2 + doorWx(w), z: FZ + 0.02, ax: x - w / 2 + doorWx(w), az: FZ + 0.75, nx: 0, nz: 1, w }); x -= w + 0.35; sd += 1; } }
    { let x = 40.6, sd = 31, i = 0; while (x < 86 && i < 4) { const w = 3.2 + (sd % 3) * 0.5; fd.push({ slot: 'e' + i++, x: x + w / 2 + doorWx(w), z: FZ + 0.02, ax: x + w / 2 + doorWx(w), az: FZ + 0.75, nx: 0, nz: 1, w }); x += w + 0.35; sd += 1; } }
    [[16, 6.2], [23.5, 5.4], [31, 5.8], [41.2, 7.2], [49.5, 6], [56.4, 5.2]].forEach(([z, w], i) => fd.push({ slot: 's' + i, x: 61.18, z: z + doorWx(w), ax: 61.2 - 0.75, az: z + doorWx(w), nx: -1, nz: 0, w }));
    const out = OCT.map(([id, kind, x, bkey, label, room]) => ({ id, kind, x, z: FZ + 0.75, yaw: 0, bkey, label, room, district: 'oct' }));
    fd.forEach(f => { const id = GEN[f.slot], g = id && INT[id]; if (g) out.push({ id, kind: 'generic', x: f.ax, z: f.az, yaw: Math.atan2(f.nx, f.nz), bkey: id, label: g.label || g.front.sign, room: id, district: f.nx < -0.5 ? 'sun' : 'oct' }); });
    return out;
  };

  WORLD.makeDoors = function (MAP) {
    const list = [];
    const add = d => { d.yaw = Math.atan2(d.nx, d.nz); list.push(d); return d; };
    OCT.forEach(([id, kind, x, bkey, label, room, w]) => add({ id, kind, x, z: FZ + 0.02, ax: x, az: FZ + 0.75, nx: 0, nz: 1, bkey, label, short: SHORT[id], room, district: 'oct', w }));
    const INT = WORLD.INTERIORS || {};
    let fi = 0;
    (MAP.fillerDoors || []).forEach(f => {
      const g = f.id && INT[f.id];
      if (g) add({ id: f.id, kind: 'generic', x: f.x, z: f.z, ax: f.ax, az: f.az, nx: f.nx, nz: f.nz, bkey: f.id, label: g.label || g.front.sign, short: g.short || g.front.sign, room: f.id, district: f.nx < -0.5 ? 'sun' : 'oct', w: f.w });
      else add({ id: 'f' + fi++, kind: 'filler', x: f.x, z: f.z, ax: f.ax, az: f.az, nx: f.nx, nz: f.nz, bkey: null, label: '', short: '', room: null, district: f.district || (f.nx < -0.5 ? 'sun' : 'oct'), w: f.w });
    });
    const byId = {}; list.forEach(d => { byId[d.id] = d; });
    // 'roof' (target серии 1) → дверь 'stairs'; любой bkey → своя дверь
    const alias = { roof: 'stairs' };
    const get = id => byId[id] || byId[alias[id]] || list.find(d => d.bkey === id) || null;
    // ближайшая дверь к точке (по точке подхода)
    const near = (x, z, r = 1.15, filter) => {
      let best = null, bd = r;
      for (const d of list) { if (filter && !filter(d)) continue; const q = Math.hypot(x - d.ax, z - d.az); if (q < bd) { bd = q; best = d; } }
      return best;
    };
    // тап по фасаду: луч против «коробки» у двери (ширина фасада, высота 3,4 м, толщина 0,6 м)
    const _b = { min: null, max: null };
    const hit = (ray, T) => {
      if (!_b.min) { _b.min = new T.Vector3(); _b.max = new T.Vector3(); _b.box = new T.Box3(); _b.p = new T.Vector3(); }
      let best = null, bd = 1e9;
      for (const d of list) {
        const hw = Math.min(d.w || 3, 4.6) / 2, tx = -d.nz, tz = d.nx;   // вдоль фасада
        const x0 = d.x - tx * hw - d.nx * 0.5, x1 = d.x + tx * hw + d.nx * 0.1, z0 = d.z - tz * hw - d.nz * 0.5, z1 = d.z + tz * hw + d.nz * 0.1;
        _b.box.min.set(Math.min(x0, x1), 0, Math.min(z0, z1)); _b.box.max.set(Math.max(x0, x1), 3.4, Math.max(z0, z1));
        if (ray.intersectBox(_b.box, _b.p)) { const q = ray.origin.distanceTo(_b.p); if (q < bd) { bd = q; best = d; } }
      }
      return best ? { door: best, dist: bd } : null;
    };
    // публичный список для WorldHub.doors(): без домов-заполнителей
    const info = () => list.filter(d => d.kind !== 'filler').map(d => ({ id: d.id, kind: d.kind, x: d.ax, z: d.az, yaw: d.yaw, bkey: d.bkey, label: d.label, room: d.room, district: d.district }));
    return { list, byId, get, near, hit, info, SHORT };
  };
})();
