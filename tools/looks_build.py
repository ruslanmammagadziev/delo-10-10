"""Образы героини: ролики экрана выбора образа (вместо кастинга «бант / тренч / волосы»).

Запуск (один раз после замены роликов; нужны ffmpeg/ffprobe, Pillow, numpy и OpenCV):
  python3 -I tools/looks_build.py --src ~/looks_src            исходники 784×1176 лежат ВНЕ репозитория (≈33 МБ)
  python3 -I tools/looks_build.py --src ~/looks_src --no-webm  без запасного VP9

Пишет:
  looks/<id>.<sha8>.mp4    H.264 main@3.1, yuv420p, 600×900, 24 к/с, без звука, +faststart, CRF 23, потолок 2,5 Мбит/с
  looks/<id>.<sha8>.webm   VP9 (CRF 36) — для сборок Chromium без H.264 (Linux, тестовый браузер playwright)
  looks/<id>.<sha8>.jpg    постер 600×900 = первый кадр сжатого ролика (постер -> видео без скачка)
  js/looks_data.js         window.LOOKS_DATA: только медиа (имена и подписи — в js/hero_looks.js), встроенные
                           миниатюры 240×360 и заглушки 24×36
Имена файлов — с хэшем содержимого (как у voice/): новый ролик = новое имя, кэш на год без риска устареть.
Старые файлы в looks/ удаляются. Сборка tools/build_single.py копирует looks/ рядом с итоговым файлом (site/looks/).

Без надписей и значков в кадре:
  pink  — красные бирки (подол платья, язычок сапога) в нижних 60 % кадра закрашиваются по соседним белым пикселям;
  cream — тиснёная надпись на сумке стирается по ключевым кадрам (координаты сняты с исходника; другой исходник —
          предупреждение, проверь кадры глазами). Остальные ролики проверены глазами: надписей нет.
Ролик длиннее 1,5 МБ — ошибка (подними --crf)."""
import argparse, base64, hashlib, io, json, os, subprocess, sys

import numpy as np
import cv2
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# id и исходник; порядок карусели = сетка образов автора (js/hero_looks.js)
LOOKS = [
    ('aurora', 'aurora_blazer_v3.mp4'),
    ('suede', 'suede_coat_v5.mp4'),
    ('pink', 'pink_cardigan_v2.mp4'),
    ('rust', 'rust_dress_v4.mp4'),
    ('cream', 'cream_suit_v1.mp4'),
    ('floral', 'floral_gown_v6.mp4'),
]
W, H = 600, 900
LIMIT = 1_500_000
# sha1 исходника (12 знаков), под который сняты ключевые кадры чистки
SRC_SHA = {'pink': 'f725b7d9db49', 'cream': 'a4714379e1ce'}
# надпись на сумке (cream): кадр, центр x, y, ширина и высота надписи — в кадре 600×900
CREAM_KF = [(0, 186, 578, 14, 10), (24, 183, 578, 14, 10), (48, 190, 587, 14, 10), (72, 193, 625, 15, 11), (84, 187, 648, 16, 12),
            (96, 196, 664, 22, 16), (101, 204, 673, 24, 17), (104, 212.5, 686.5, 24, 17), (107, 222.5, 695.5, 24, 17), (110, 232, 701.5, 25, 18),
            (113, 244.5, 718.5, 25, 18), (116, 255, 727.5, 25, 18), (119, 263, 735, 26, 18), (122, 265.5, 741.5, 25, 18), (125, 262.5, 749, 26, 19),
            (128, 261, 765.5, 26, 19), (136, 255, 795, 30, 21), (144, 236, 817, 30, 21)]


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


# ---------- чистка кадров ----------
def clean_pink(f, st):
    """Красные бирки в нижних 60 %: насыщенный красный в окружении белого -> закрасить по соседям (и маска прошлого кадра)."""
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    hh, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (((hh <= 5) | (hh >= 173)) & (s > 95) & (v > 70)).astype(np.uint8)
    m[:int(H * 0.4)] = 0
    white = ((v > 200) & (s < 40)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 3 or stats[i, cv2.CC_STAT_AREA] >= 600:
            continue
        c = (lab == i).astype(np.uint8)
        ring = cv2.dilate(c, np.ones((9, 9), np.uint8)) - c
        # губы и кожа не трогаем: бирка всегда на белом (платье, сапог)
        if white[ring > 0].mean() > 0.4:
            keep |= c
    keep = cv2.dilate(keep, np.ones((7, 7), np.uint8))
    mask = keep | st['prev'] if st.get('prev') is not None else keep
    st['prev'] = keep
    st['px'] = st.get('px', 0) + int(mask.sum())
    return cv2.inpaint(f, mask, 4, cv2.INPAINT_TELEA) if mask.any() else f


def cream_box(k):
    for a, b in zip(CREAM_KF, CREAM_KF[1:]):
        if a[0] <= k <= b[0]:
            t = (k - a[0]) / max(1, b[0] - a[0])
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 5)]
    return list(CREAM_KF[-1][1:])


def clean_cream(f, st):
    """Надпись на сумке: в окне ключевого кадра закрасить штрихи букв (не касающиеся края окна) + мягкое размытие овалом."""
    k = st['k'] = st.get('k', -1) + 1
    cx, cy, w, h = cream_box(k)
    w, h = w * 1.7 + 8, h * 1.9 + 8
    x0, y0 = max(0, int(cx - w / 2)), max(0, int(cy - h / 2))
    x1, y1 = min(W, int(cx + w / 2) + 1), min(H, int(cy + h / 2) + 1)
    gr = cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    g, med = gr.astype(np.int16), cv2.medianBlur(gr, 9).astype(np.int16)
    sm = (((med - g) > 5) | ((g - med) > 7)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(sm, 8)
    keep = np.zeros_like(sm)
    for i in range(1, n):
        x, y, ww, hh, _a = stats[i]
        # касается края окна — это ручка или кант сумки, не буква
        if x == 0 or y == 0 or x + ww >= sm.shape[1] or y + hh >= sm.shape[0]:
            continue
        keep[lab == i] = 1
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8))
    full = np.zeros((H, W), np.uint8)
    full[y0:y1, x0:x1] = keep
    g2 = cv2.inpaint(f, full, 3, cv2.INPAINT_TELEA)
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(cx), int(cy)), (int(w * 0.36), int(h * 0.36)), 0, 0, 360, 1, -1)
    m = cv2.GaussianBlur(m, (0, 0), 2.5)[..., None]
    bl = cv2.GaussianBlur(g2, (0, 0), 1.6)
    st['px'] = st.get('px', 0) + int(keep.sum())
    return (g2 * (1 - m) + bl * m).astype(np.uint8)


CLEAN = {'pink': clean_pink, 'cream': clean_cream}


def cleaned(lid, sp, tmp, threads):
    """Кадры 600×900 через OpenCV -> промежуточный файл без потерь (FFV1); из него кодируются mp4 и webm."""
    out = os.path.join(tmp, lid + '.ffv1.mkv')
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', sp, '-map', '0:v:0', '-vf', f'scale={W}:{H}:flags=lanczos,setsar=1', '-r', '24',
                            '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                            '-c:v', 'ffv1', '-pix_fmt', 'bgr0', '-threads', threads, out], stdin=subprocess.PIPE)
    st, n = {}, 0
    while True:
        b = dec.stdout.read(W * H * 3)
        if len(b) < W * H * 3:
            break
        f = np.frombuffer(b, np.uint8).reshape(H, W, 3).copy()
        enc.stdin.write(CLEAN[lid](f, st).tobytes())
        n += 1
    enc.stdin.close()
    if dec.wait() != 0 or enc.wait() != 0:
        sys.exit(f'ОШИБКА: чистка кадров {lid}')
    print(f'  {lid}: чистка {n} кадров, закрашено {st.get("px", 0)} пикселей', flush=True)
    return out


def main():
    ap = argparse.ArgumentParser(description='ролики образов -> looks/ + js/looks_data.js')
    ap.add_argument('--src', required=True, help='папка с исходными роликами (вне репозитория)')
    ap.add_argument('--crf', type=int, default=23)
    ap.add_argument('--no-webm', action='store_true')
    ap.add_argument('--threads', default='2')
    a = ap.parse_args()
    out = os.path.join(ROOT, 'looks')
    tmp = os.path.join(out, '.tmp')
    os.makedirs(tmp, exist_ok=True)
    vf = f'scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p'
    items, keep = [], set()
    for lid, src in LOOKS:
        sp = os.path.join(a.src, src)
        if not os.path.isfile(sp):
            sys.exit(f'ОШИБКА: нет исходника {sp}')
        inp, filt = sp, vf
        if lid in CLEAN:
            sha = hashlib.sha1(open(sp, 'rb').read()).hexdigest()[:12]
            if sha != SRC_SHA[lid]:
                print(f'  ВНИМАНИЕ: {src} не тот исходник ({sha}), чистка надписей настроена на {SRC_SHA[lid]} — проверь кадры глазами', flush=True)
            inp, filt = cleaned(lid, sp, tmp, a.threads), 'format=yuv420p'
        common = ['-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', filt, '-r', '24', '-threads', a.threads]
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
        print(f"{lid:7s} mp4 {len(files['mp4']) / 1024:6.0f} КБ" + (f" · webm {len(files['webm']) / 1024:5.0f} КБ" if 'webm' in files else '')
              + f" · постер {len(files['jpg']) / 1024:3.0f} КБ · миниатюра {len(thumb) / 1024:4.1f} КБ", flush=True)
    for fn in os.listdir(tmp):
        os.remove(os.path.join(tmp, fn))
    os.rmdir(tmp)
    for fn in os.listdir(out):
        if fn not in keep and os.path.isfile(os.path.join(out, fn)):
            os.remove(os.path.join(out, fn))
    head = ('/* =====================================================================\n'
            '   ОБРАЗЫ ГЕРОИНИ: медиа шести роликов экрана выбора. Файл пишет tools/looks_build.py — руками не править.\n'
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
    print(f'looks/: {len(keep)} файлов, {tot / 1048576:.1f} МБ; js/looks_data.js {len(js) / 1024:.0f} КБ')


if __name__ == '__main__':
    main()
