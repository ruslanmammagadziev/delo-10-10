"""Образы героини: ролики экрана выбора образа (вместо кастинга «бант / тренч / волосы») — мультяшные, из самой игры.

Ролик = 3D-героиня игры (js/hero3d.js + образ js/hero_outfits.js, поза js/hero_anim.js) на простом мультяшном фоне
(tools/looks_toon.html). Цепочка целиком (после любой правки 3D-образов или фонов):
  NODE_PATH=/opt/node22/lib/node_modules node tools/looks_toon.js --out ~/looks_toon    рендер (swiftshader: ~2,5 мин на образ)
  python3 -I tools/looks_build.py --src ~/looks_toon                                     кодирование -> looks/
  python3 -I tools/looks_build.py --src ~/looks_toon --no-webm                           без запасного VP9
Исходники (~25 МБ на образ) лежат ВНЕ репозитория: <id>.mkv — FFV1 600×900, 24 к/с, 144 кадра (6 с), петля без шва
(кадр 144 = кадр 0), и <id>.json от looks_toon.js (кадры, шов петли, sha1 js/hero_outfits.js). Нужны ffmpeg/ffprobe и Pillow.

Пишет:
  looks/<id>.<sha8>.mp4    H.264 main@3.1, yuv420p, 600×900, 24 к/с, без звука, +faststart, CRF 23, потолок 2,5 Мбит/с
  looks/<id>.<sha8>.webm   VP9 (CRF 36) — для сборок Chromium без H.264 (Linux, тестовый браузер playwright)
  looks/<id>.<sha8>.jpg    постер 600×900 = первый кадр сжатого ролика (постер -> видео без скачка)
  js/looks_data.js         window.LOOKS_DATA: только медиа (имена и подписи — в js/hero_looks.js), встроенные
                           миниатюры 240×360 и заглушки 24×36
Имена файлов — с хэшем содержимого (как у voice/): новый ролик = новое имя, кэш на год без риска устареть.
Старые файлы в looks/ удаляются. Сборка tools/build_single.py копирует looks/ рядом с итоговым файлом (site/looks/).
Проверки: все шесть исходников 600×900 и нужной длины; все шесть сняты с одного js/hero_outfits.js (иначе ошибка);
не тот, что сейчас в репозитории, — предупреждение (перерендерь). Ролик длиннее 1,5 МБ — ошибка (подними --crf)."""
import argparse, base64, hashlib, io, json, os, subprocess, sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# порядок карусели = сетка образов автора (js/hero_looks.js)
LOOKS = ['aurora', 'suede', 'pink', 'rust', 'cream', 'floral']
W, H = 600, 900
LIMIT = 1_500_000


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('ОШИБКА: ' + ' '.join(cmd[:6]) + ' …\n' + r.stderr[-2000:])
    return r.stdout


def sha8(b):
    return hashlib.sha1(b).hexdigest()[:8]


def jpeg(img, q, progressive=True):
    b = io.BytesIO()
    img.save(b, 'JPEG', quality=q, optimize=True, progressive=progressive)
    return b.getvalue()


def probe(fn):
    """ширина, высота и число кадров исходника"""
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames',
               '-of', 'json', fn])
    s = json.loads(out)['streams'][0]
    return int(s['width']), int(s['height']), int(s.get('nb_read_frames') or 0)


def sources(src):
    """исходники шести образов и их паспорта (<id>.json от tools/looks_toon.js); проверки — до кодирования"""
    res, shas = {}, {}
    for lid in LOOKS:
        mkv, meta = os.path.join(src, lid + '.mkv'), os.path.join(src, lid + '.json')
        if not os.path.isfile(mkv):
            sys.exit(f'ОШИБКА: нет исходника {mkv} — сначала tools/looks_toon.js --out {src}')
        m = json.load(open(meta, encoding='utf-8')) if os.path.isfile(meta) else {}
        w, h, n = probe(mkv)
        if (w, h) != (W, H):
            sys.exit(f'ОШИБКА: {mkv} {w}×{h}, нужно {W}×{H}')
        if m.get('frames') and n != m['frames']:
            sys.exit(f'ОШИБКА: {mkv} {n} кадров, по паспорту {m["frames"]} (рендер оборван?)')
        if m.get('seam') is not None and m['seam'] > 1e-4:
            print(f'  ВНИМАНИЕ: {lid} — шов петли {m["seam"]:.1e} (кадр N ≠ кадр 0)', flush=True)
        if m.get('heroOutfitsSha1'):
            shas.setdefault(m['heroOutfitsSha1'], []).append(lid)
        res[lid] = (mkv, n)
    if len(shas) > 1:
        sys.exit('ОШИБКА: ролики сняты с разных js/hero_outfits.js: ' + '; '.join(f'{k[:12]} — {", ".join(v)}' for k, v in shas.items())
                 + ' — перерендерь все шесть')
    cur = hashlib.sha1(open(os.path.join(ROOT, 'js', 'hero_outfits.js'), 'rb').read()).hexdigest()
    if shas and cur not in shas:
        print(f'  ВНИМАНИЕ: ролики сняты с js/hero_outfits.js {next(iter(shas))[:12]}, а в репозитории {cur[:12]} — перерендерь', flush=True)
    return res, (next(iter(shas)) if shas else None)


def main():
    ap = argparse.ArgumentParser(description='мультяшные ролики образов (tools/looks_toon.js) -> looks/ + js/looks_data.js')
    ap.add_argument('--src', required=True, help='папка с <id>.mkv и <id>.json от tools/looks_toon.js (вне репозитория)')
    ap.add_argument('--crf', type=int, default=23)
    ap.add_argument('--no-webm', action='store_true')
    ap.add_argument('--threads', default='2')
    a = ap.parse_args()
    src = os.path.abspath(os.path.expanduser(a.src))
    srcs, osha = sources(src)
    out = os.path.join(ROOT, 'looks')
    tmp = os.path.join(out, '.tmp')
    os.makedirs(tmp, exist_ok=True)
    items, keep = [], set()
    for lid in LOOKS:
        inp, n = srcs[lid]
        common = ['-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', f'scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p',
                  '-r', '24', '-threads', a.threads]
        mp4 = os.path.join(tmp, lid + '.mp4')
        run(['ffmpeg', '-v', 'error', '-y', '-i', inp, *common, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'main', '-level', '3.1',
             '-crf', str(a.crf), '-maxrate', '2500k', '-bufsize', '5000k', '-g', '48', '-keyint_min', '24', '-tag:v', 'avc1',
             '-movflags', '+faststart', mp4])
        files = {'mp4': open(mp4, 'rb').read()}
        if len(files['mp4']) > LIMIT:
            sys.exit(f'ОШИБКА: {lid}.mp4 {len(files["mp4"])} байт > {LIMIT} — подними --crf')
        if not a.no_webm:
            webm = os.path.join(tmp, lid + '.webm')
            run(['ffmpeg', '-v', 'error', '-y', '-i', inp, *common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-deadline', 'good',
                 '-cpu-used', '2', '-row-mt', '1', '-tile-columns', '1', '-g', '48', webm])
            files['webm'] = open(webm, 'rb').read()
        dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).strip() or 6)
        png = os.path.join(tmp, lid + '.png')
        run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-frames:v', '1', png])
        im = Image.open(png).convert('RGB')
        files['jpg'] = jpeg(im, 80)
        thumb = jpeg(im.resize((240, 360), Image.LANCZOS), 72)
        lqip = jpeg(im.resize((24, 36), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6)), 60, progressive=False)
        avg = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        it = {'id': lid}
        for ext, key in (('mp4', 'mp4'), ('webm', 'webm'), ('jpg', 'poster')):
            if ext not in files:
                continue
            fn = f'{lid}.{sha8(files[ext])}.{ext}'
            open(os.path.join(out, fn), 'wb').write(files[ext])
            keep.add(fn)
            it[key] = fn
        it['thumb'] = 'data:image/jpeg;base64,' + base64.b64encode(thumb).decode()
        it['lqip'] = 'data:image/jpeg;base64,' + base64.b64encode(lqip).decode()
        it['bg'] = '#%02X%02X%02X' % avg
        it['w'], it['h'], it['dur'] = W, H, round(dur, 2)
        items.append(it)
        print(f"{lid:7s} {n} кадров · mp4 {len(files['mp4']) / 1024:6.0f} КБ" + (f" · webm {len(files['webm']) / 1024:5.0f} КБ" if 'webm' in files else '')
              + f" · постер {len(files['jpg']) / 1024:3.0f} КБ · миниатюра {len(thumb) / 1024:4.1f} КБ", flush=True)
    for fn in os.listdir(tmp):
        os.remove(os.path.join(tmp, fn))
    os.rmdir(tmp)
    for fn in os.listdir(out):
        if fn not in keep and os.path.isfile(os.path.join(out, fn)):
            os.remove(os.path.join(out, fn))
    head = ('/* =====================================================================\n'
            '   ОБРАЗЫ ГЕРОИНИ: медиа шести роликов экрана выбора. Файл пишет tools/looks_build.py — руками не править.\n'
            '   Ролики — мультяшный рендер 3D-героини игры в каждом образе (tools/looks_toon.js).\n'
            '   Имена и подписи образов — в js/hero_looks.js.\n'
            '   base: в исходной папке — looks/ рядом с js/ (по адресу этого скрипта, годится и для стендов в tests/);\n'
            '   в однофайловой сборке скрипт встроен (адреса нет) — looks/ рядом с index.html (site/looks/).\n'
            '   thumb / lqip встроены: экран выбора виден и без сети, и без папки looks/.\n'
            '   ===================================================================== */\n')
    base = ("(function () {\n    try {\n      const s = document.currentScript && document.currentScript.src;\n"
            "      if (s) return new URL('../looks/', s).href;\n    } catch (e) {\n      /* ignore */\n    }\n    return 'looks/';\n  })()")
    body = ',\n'.join('    ' + json.dumps(it, ensure_ascii=False) for it in items)
    js = head + f'window.LOOKS_DATA = {{\n  base: {base},\n  items: [\n{body},\n  ],\n}};\n'
    open(os.path.join(ROOT, 'js', 'looks_data.js'), 'w', encoding='utf-8').write(js)
    tot = sum(os.path.getsize(os.path.join(out, f)) for f in keep)
    print(f'looks/: {len(keep)} файлов, {tot / 1048576:.1f} МБ; js/looks_data.js {len(js) / 1024:.0f} КБ'
          + (f'; js/hero_outfits.js {osha[:12]}' if osha else ''))


if __name__ == '__main__':
    main()
