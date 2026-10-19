/* Ролики экрана выбора образа: рендер 3D-героини игры в шести образах (tools/looks_toon.html) -> исходники без потерь.

Запуск (Node 18+, playwright, Chromium со swiftshader; ffmpeg):
  NODE_PATH=/opt/node22/lib/node_modules node tools/looks_toon.js --out ~/looks_toon            все шесть
  NODE_PATH=/opt/node22/lib/node_modules node tools/looks_toon.js --out ~/looks_toon --only rust,pink
  ... --still 0,36,72      только кадры PNG 600×900 (<id>_f036.png) — быстро проверить фон и кадрирование
  ... --jobs 2             два образа одновременно (два браузера; на 4 ядрах медленнее: swiftshader и так занимает все)
  ... --ss 2 --frames 144  суперсэмплинг (кадр 1200×1800 -> 600×900, lanczos) и число кадров (24 к/с)
  ... --still 0 --yaw 90 --no-bg   проверка образа сбоку/сзади: неподвижная камера под углом, без декораций (<id>_y90_f000.png)
Потом: python3 -I tools/looks_build.py --src ~/looks_toon  (mp4 / webm / постеры в looks/ и js/looks_data.js).

Пишет в --out (вне репозитория): <id>.mkv — FFV1 600×900, 24 к/с, N кадров, петля (кадр N = кадр 0), и <id>.json
(кадры, время рендера, sha1 js/hero_outfits.js, шов петли: расхождение костей шага N с кадром 0, ws — правка переминания
в js/hero_anim.js нашлась, wind — что развевается: куски одежды и число вершин). Страницу отдаёт свой http-сервер
(корень репозитория, 127.0.0.1, свободный порт) — внешний сервер не нужен. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process'), { once } = require('events');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const IDS = ['aurora', 'suede', 'pink', 'rust', 'cream', 'floral'];
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const OW = 600, OH = 900, FPS = 24;
// версия образов 3D: все шесть роликов должны быть из одного js/hero_outfits.js (sha1 — в <id>.json, сверяет looks_build.py)
const outfitsSha = () => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'js', 'hero_outfits.js'))).digest('hex');

function opts() {
  const a = process.argv.slice(2), o = { ss: 2, frames: 144, jobs: 1, only: IDS.slice(), still: null, out: null, chrome: process.env.CHROME || CHROME };
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = a[i + 1];
    if (k === '--out') { o.out = path.resolve(v.replace(/^~(?=$|\/)/, process.env.HOME || '~')); i++; }
    else if (k === '--only') { o.only = v.split(',').map(s => s.trim()).filter(Boolean); i++; }
    else if (k === '--ss') { o.ss = +v; i++; }
    else if (k === '--frames') { o.frames = +v; i++; }
    else if (k === '--jobs') { o.jobs = Math.max(1, +v | 0); i++; }
    else if (k === '--still') { o.still = v.split(',').map(Number); i++; }
    else if (k === '--chrome') { o.chrome = v; i++; }
    else if (k === '--yaw') { o.yaw = +v; i++; }
    else if (k === '--no-bg') { o.bg = false; }
    else { console.error('неизвестный ключ ' + k); process.exit(2); }
  }
  if (!o.out) { console.error('нужен --out <папка вне репозитория>'); process.exit(2); }
  if (path.resolve(o.out).startsWith(ROOT + path.sep)) { console.error('--out должен быть вне репозитория: ' + o.out); process.exit(2); }
  const bad = o.only.filter(id => IDS.indexOf(id) < 0);
  if (bad.length) { console.error('нет такого образа: ' + bad.join(', ')); process.exit(2); }
  if (!(o.frames > 1) || o.frames % 2) { console.error('--frames — чётное число > 1'); process.exit(2); }
  return o;
}

// статический сервер корня репозитория (только чтение, без выхода за корень)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
function serve() {
  const srv = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    const fp = path.join(ROOT, path.normalize(p));
    if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (err, b) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(b);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  p.done = new Promise((ok, no) => p.on('close', c => (c === 0 ? ok() : no(new Error('ffmpeg ' + c)))));
  return p;
}
const raw = (W, H) => ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(FPS), '-i', '-'];
// readPixels отдаёт строки снизу вверх; уменьшение 2× — lanczos (чистые края контура)
const VF = `vflip,scale=${OW}:${OH}:flags=lanczos+accurate_rnd+full_chroma_int`;

async function look(browser, base, id, o) {
  const t0 = Date.now(), W = OW * o.ss, H = OH * o.ss, N = o.frames, sha = outfitsSha();
  const page = await browser.newPage({ viewport: { width: OW, height: OH } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const yawQ = (o.yaw == null ? '' : `&yaw=${o.yaw}`) + (o.bg === false ? '&bg=0' : '');
  await page.goto(`${base}tools/looks_toon.html?look=${id}&ss=${o.ss}&frames=${N}${yawQ}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.title === 'OK' || document.title === 'FAIL', null, { timeout: 600000 });
  const st = await page.evaluate(() => (window.TOON && window.TOON.error) || null);
  if (st) throw new Error(id + ': ' + st + '\n' + logs.join('\n'));
  const tLoad = Date.now() - t0;
  if (o.still) {
    const want = new Set(o.still.map(i => ((i % N) + N) % N)), last = Math.max(...want);
    for (let i = 0; i <= last; i++) {
      const b = await page.evaluate(([i, r]) => TOON.frame(i, r), [i, want.has(i)]);
      if (!b) continue;
      const fn = path.join(o.out, `${id}${o.yaw == null ? '' : '_y' + o.yaw}_f${String(i).padStart(3, '0')}.png`);
      const ff = ffmpeg([...raw(W, H), '-vf', VF, '-frames:v', '1', fn]);
      ff.stdin.end(Buffer.from(b, 'base64')); await ff.done;
      console.log('  ' + fn);
    }
    await page.close();
    return { id, still: true };
  }
  const out = path.join(o.out, id + '.mkv'), tmp = out + '.part.mkv';
  const ff = ffmpeg([...raw(W, H), '-vf', VF + ',format=bgr0', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-f', 'matroska', tmp]);
  let tRead = 0;
  for (let i = 0; i < N; i++) {
    const b = await page.evaluate(i => TOON.frame(i), i);
    const t1 = Date.now();
    if (!ff.stdin.write(Buffer.from(b, 'base64'))) await once(ff.stdin, 'drain');
    tRead += Date.now() - t1;
    if (i % 24 === 23) process.stdout.write(`  ${id}: ${i + 1}/${N}\r`);
  }
  ff.stdin.end(); await ff.done;
  fs.renameSync(tmp, out);
  const seam = await page.evaluate(() => TOON.seam());
  const stats = await page.evaluate(() => TOON.stats());
  const inf = await page.evaluate(() => TOON.info);
  await page.close();
  const ms = Date.now() - t0;
  if (outfitsSha() !== sha) { fs.unlinkSync(out); throw new Error(id + ': js/hero_outfits.js изменился во время рендера — перезапусти'); }
  const meta = { id, frames: N, fps: FPS, w: OW, h: OH, ss: o.ss, heroOutfitsSha1: sha, seam, loadMs: tLoad, renderMs: ms, perFrameMs: Math.round((ms - tLoad) / N), calls: stats.calls, tris: stats.tris, ws: inf.ws, wind: inf.wind, warnings: logs.slice(0, 20) };
  fs.writeFileSync(path.join(o.out, id + '.json'), JSON.stringify(meta, null, 1));
  if (seam > 1e-4) console.log(`  ВНИМАНИЕ: ${id} — шов петли ${seam.toExponential(2)} (кадр N ≠ кадр 0)`);
  if (!inf.ws || !inf.ws.ok) console.log(`  ВНИМАНИЕ: ${id} — переминание без правки js/hero_anim.js (рывок на смене опоры), см. warnings в ${id}.json`);
  if (inf.wind) console.log(`  ветер: ${inf.wind.pieces.length} куск., ${inf.wind.verts} вершин ниже ${inf.wind.yTop} м (+${inf.wind.shell} оболочки)`);
  console.log(`${id.padEnd(7)} ${N} кадров за ${(ms / 1000).toFixed(0)} с (${meta.perFrameMs} мс/кадр), шов ${seam.toExponential(1)}, ${stats.calls} вызовов, ${stats.tris} треугольников -> ${out}`);
  return meta;
}

(async () => {
  const o = opts();
  fs.mkdirSync(o.out, { recursive: true });
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const queue = o.only.slice(), done = [];
  let err = null;
  async function worker() {
    const browser = await chromium.launch({ executablePath: o.chrome, args: ARGS });
    try {
      while (queue.length && !err) { const id = queue.shift(); try { done.push(await look(browser, base, id, o)); } catch (e) { err = e; } }
    } finally { await browser.close(); }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(o.jobs, queue.length) }, worker));
  srv.close();
  if (err) { console.error('ОШИБКА: ' + (err.stack || err)); process.exit(1); }
  const shas = [...new Set(done.map(m => m.heroOutfitsSha1).filter(Boolean))];
  console.log(`готово: ${done.length} за ${((Date.now() - t0) / 1000).toFixed(0)} с -> ${o.out}` + (shas.length ? `; js/hero_outfits.js sha1 ${shas.join(', ')}` : ''));
})();
