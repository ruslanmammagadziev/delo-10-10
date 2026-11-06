#!/usr/bin/env python3
"""Записи мотора для js/engine_sound.js: из присланных записей — бесшовные петли audio/engine_<машина>.<sha8>.mp3.

Запуск:
  python3 tools/engine_audio.py --src ПАПКА        (в папке cabrio.mp3 — жёлтый кабриолет, sedan.mp3 — красный седан)
  python3 tools/engine_audio.py --src ПАПКА --wav ПАПКА2   (+ wav петель и «петля ×4» для прослушивания)
Нужны ffmpeg (с libmp3lame), numpy, scipy. Пишет audio/engine_*.mp3 (старые engine_*.mp3 удаляет) и блок REC в
js/engine_sound.js (между строками-метками «ЗАПИСИ МОТОРОВ»). Печатает замеры стыков.

Что делает с каждой записью (обе — разгон по передачам, ровного «холостого» в них нет):
  1) моно 44,1 кГц, срез ниже 40 Гц (гул дороги и ветра в микрофоне);
  2) два слоя: lo — медленный ход (начало первой передачи), hi — под нагрузкой (ровный участок старшей передачи);
     отрезки и опорная линия спектра (самая яркая гармоника выхлопа) — SEGS ниже;
  3) тон выравнивается: опорная линия отслеживается по спектру (пик ±W, сглаживание полиномом), запись «растягивается»
     во времени так, чтобы линия стояла ровно на f_target (разгон внутри отрезка — +6…27 % — уходит); громкость и
     тембр — тоже ровно (4 полосы, огибающая каждой 200 мс, не больше ±6 дБ);
  4) длина петли — по наибольшему сходству окрестностей стыка (поиск ±150 мс), хвост петли плавно переходит в звук,
     который в записи стоит перед её началом (кроссфейд с поправкой на корреляцию: громкость на стыке не проседает);
  5) файл: [lo, lo, hi, hi] — каждая петля дважды подряд. Плеер крутит петлю из середины пары (loopStart/loopEnd),
     поэтому задержка кодека mp3 (≈ 25 мс в начале; одни браузеры её срезают, другие нет) не ломает стык;
  6) проверка: стык в «петле ×2» (скачок и производная — против 99,9-го процентиля внутри петли, спектр 46 мс до/после
     стыка — против соседних окон внутри, огибающая RMS 20 мс).
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
# (начало, конец отрезка в записи, с; опорная линия в начале отрезка, Гц; ширина поиска пика; окно БПФ)
# cabrio: lo — 1-я передача 0,60–1,60 с (линия 215→232 Гц), hi — 3-я передача 5,92–7,72 с (272→316 Гц, ровная громкость)
# sedan:  lo — 1-я передача 0,62–1,62 с (72→90 Гц), hi — 3-я передача 6,82–8,06 с (130→142 Гц)
SEGS = {
    'cabrio': {'lo': (0.60, 1.60, 215.0, 0.06, 8192), 'hi': (5.92, 7.72, 272.0, 0.06, 8192)},
    'sedan': {'lo': (0.62, 1.62, 75.5, 0.05, 16384), 'hi': (6.82, 8.06, 128.0, 0.05, 16384)},
}
PRE = 0.12      # запас перед отрезком (с): из него — хвост кроссфейда
XF = 0.07       # длина кроссфейда стыка (с)
SEARCH = 0.15   # поиск длины петли: ± (с)
RMS_DB = -16.0  # громкость петель в файле (dBFS RMS); общая громкость — в js/engine_sound.js
KBPS = 128

# запретные слова сканера сборки (tools/scan_words.py): имя файла с хэшем их не задевает (хэш — случайные буквы и цифры)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from scan_words import TERMS
except Exception:   # без сканера — без проверки
    TERMS = []
def banned(s):
    return [t for t, rxs in TERMS for rx in rxs if re.search(rx, s, re.I)]


def die(msg):
    print('ОШИБКА:', msg, file=sys.stderr); sys.exit(2)


def decode(fn):
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, 'x.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', fn, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_f32le', out], check=True)
        sr, x = wavfile.read(out)
    return x.astype(np.float64)


def track(x, t0, t1, f0, W, N, tpre):
    """Опорная линия: от t0 (там она f0) вперёд до t1 и назад до tpre — пик в окне ±W от прошлого значения, уточнение
    параболой; → полином 3-й степени f(t) (вес — амплитуда пика) и разброс точек вокруг него."""
    hop = 256
    f, t, Z = signal.stft(x, SR, window='hann', nperseg=N, noverlap=N - hop, boundary=None, padded=False)
    A = np.abs(Z); df = f[1] - f[0]
    j0 = int(np.argmin(np.abs(t - t0)))
    pts = []
    def run(js, cur):
        for j in js:
            k = np.where((f >= cur * (1 - W)) & (f <= cur * (1 + W)))[0]
            kk = k[np.argmax(A[k, j])]
            a, b, c = (np.log(A[kk + d, j] + 1e-12) for d in (-1, 0, 1))
            p = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0.0
            cur = (kk + p) * df
            pts.append((t[j], cur, A[kk, j]))
    run([j for j in range(j0, len(t)) if t[j] <= t1], f0)
    run([j for j in range(j0 - 1, -1, -1) if t[j] >= tpre], f0)
    P = np.array(sorted(pts))
    co = np.polyfit(P[:, 0], P[:, 1], 3, w=np.sqrt(P[:, 2]))
    res = P[:, 1] - np.polyval(co, P[:, 0])
    return co, P, float(np.sqrt(np.mean(res ** 2)))


def warp(x, co, ta, tb, ftar):
    """Растяжка во времени: выход n — вход t(n), dt/dn = ftar / f(t) / SR (линия стоит на ftar)."""
    U = 4
    xu = signal.resample_poly(x, U, 1)
    n = int((tb - ta) * SR * 1.3) + 10
    tin = ta + np.arange(n) / SR
    for _ in range(4):
        r = ftar / np.polyval(co, tin)
        tin = ta + np.concatenate(([0.0], np.cumsum(r[:-1]))) / SR
    tin = tin[tin <= tb]
    return np.interp(tin * SR * U, np.arange(len(xu)), xu), tin


def flatten(y):
    """Громкость и тембр ровно: 4 полосы (до 250 Гц, 250–700, 700–2000, выше; разбиение без потерь — фильтр
    без сдвига фазы и остаток), огибающая каждой — 200 мс (у краёв — с поправкой на неполное окно), каждая — к своей
    медиане, не больше ±6 дБ. Иначе в петле слышно, как запись «светлеет» и «темнеет» по ходу разгона (уа-уа раз в секунду)."""
    w = int(0.2 * SR); h = np.hanning(w)
    sm = lambda v: signal.fftconvolve(v, h, mode='same') / signal.fftconvolve(np.ones_like(v), h, mode='same')
    bands, rest = [], y.copy()
    for fc in (250, 700, 2000):
        b, a = signal.butter(2, fc / (SR / 2))
        lo = signal.filtfilt(b, a, rest); bands.append(lo); rest = rest - lo
    bands.append(rest)
    out = np.zeros_like(y)
    for v in bands:
        env = np.sqrt(np.abs(sm(v ** 2)) + 1e-12)
        out += v * sm(np.clip(np.median(env) / env, 0.5, 2.0))
    return out


def ncorr(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float(np.dot(a, b) / (np.sqrt(np.dot(a, a) * np.dot(b, b)) + 1e-12))


def make_loop(y, s, Ldes):
    """Петля y[s : s+L] с хвостом, переходящим в y[s-X : s]; L — лучшее сходство окрестностей стыка."""
    X, D = int(XF * SR), int(SEARCH * SR)
    best = None
    for L in range(Ldes - D, Ldes + 1, 3):
        if s + L + X > len(y): break
        c = ncorr(y[s - X:s + X], y[s + L - X:s + L + X])
        if best is None or c > best[0]: best = (c, L)
    for L in range(best[1] - 3, best[1] + 4):   # уточнение по сэмплу
        if s + L + X > len(y): continue
        c = ncorr(y[s - X:s + X], y[s + L - X:s + L + X])
        if c > best[0]: best = (c, L)
    rho, L = best
    loop = y[s:s + L].copy()
    w = (np.arange(X) + 0.5) / X
    a, b = 0.5 + 0.5 * np.cos(np.pi * w), 0.5 - 0.5 * np.cos(np.pi * w)
    rc = ncorr(y[s + L - X:s + L], y[s - X:s])
    nrm = np.sqrt(a * a + b * b + 2 * max(0.0, rc) * a * b)
    loop[L - X:] = (y[s + L - X:s + L] * a + y[s - X:s] * b) / nrm
    return loop, rho, rc


def seam_check(loop):
    """Стык в «петле ×2» против того же замера в 24 местах внутри петли: скачок соседних сэмплов и вторая разность
    (щелчок), спектр 46 мс до/после (дБ, 100 Гц…8 кГц), размах RMS 20-мс окон ±0,2 с вокруг."""
    L = len(loop); z = np.concatenate([loop, loop, loop])
    d1 = np.abs(np.diff(z)); d2 = np.abs(np.diff(z, 2))
    N = 2048; win = np.hanning(N); hop = int(0.02 * SR)
    spec = lambda c: 20 * np.log10(np.abs(np.fft.rfft(z[c - N // 2:c + N // 2] * win))[5:372] + 1e-9)
    sdist = lambda c: float(np.sqrt(np.mean((spec(c - N // 2) - spec(c + N // 2)) ** 2)))
    rms = lambda c: 20 * np.log10(np.sqrt(np.mean(z[c:c + hop] ** 2)) + 1e-12)
    rng = lambda c: (lambda e: max(e) - min(e))([rms(c + k * hop) for k in range(-10, 10)])
    pos = [int(L + N + i * (L - 2 * N) / 23) for i in range(24)]   # внутри средней копии, стык — на L
    inner = {'spec': [sdist(c) for c in pos], 'rms': [rng(c) for c in pos]}
    return {'jump': float(d1[2 * L - 1]), 'jump_p999': float(np.percentile(d1[L:2 * L - 1], 99.9)),
            'd2': float(max(d2[2 * L - 3:2 * L])), 'd2_p999': float(np.percentile(d2[L:2 * L - 3], 99.9)),
            'spec_seam_db': sdist(2 * L), 'spec_inner_med_db': float(np.median(inner['spec'])), 'spec_inner_max_db': float(max(inner['spec'])),
            'rms_seam_db': rng(2 * L), 'rms_inner_med_db': float(np.median(inner['rms'])), 'rms_inner_max_db': float(max(inner['rms']))}


def layer(x, name, part):
    t0, t1, f0, W, N = SEGS[name][part]
    co, P, res = track(x, t0, t1 + 0.05, f0, W, N, t0 - PRE - 0.02)
    fa, fb = float(np.polyval(co, t0)), float(np.polyval(co, t1))
    ftar = float(np.exp(np.mean(np.log(np.polyval(co, np.linspace(t0, t1, 64))))))   # среднее (геом.) — растяжка ±
    y, tin = warp(x, co, t0 - PRE, t1 + 0.04, ftar)
    y = flatten(y)
    s = int(np.argmin(np.abs(tin - t0)))
    Ldes = int(np.argmin(np.abs(tin - t1))) - s - int(XF * SR)
    loop, rho, rc = make_loop(y, s, Ldes)
    # проверка выравнивания: линия в готовой петле (БПФ всей петли — пик у ftar)
    sp = np.abs(np.fft.rfft(np.concatenate([loop] * 4) * np.hanning(4 * len(loop))))
    fr = np.fft.rfftfreq(4 * len(loop), 1 / SR); k = (fr > ftar * 0.9) & (fr < ftar * 1.1)
    fpk = float(fr[k][np.argmax(sp[k])])
    info = {'t0': t0, 't1': t1, 'f_start': round(fa, 2), 'f_end': round(fb, 2), 'rise_pct': round(100 * (fb / fa - 1), 1),
            'track_resid_hz': round(res, 2), 'f': round(ftar, 2), 'f_loop_peak': round(fpk, 2), 'n': len(loop),
            'sec': round(len(loop) / SR, 3), 'corr_seam': round(rho, 3), 'corr_xf': round(rc, 3)}
    return loop, info


def main():
    ap = argparse.ArgumentParser(description='Петли мотора для js/engine_sound.js')
    ap.add_argument('--src', required=True, help='папка с cabrio.mp3 и sedan.mp3')
    ap.add_argument('--out', default=os.path.join(ROOT, 'audio'))
    ap.add_argument('--js', default=os.path.join(ROOT, 'js', 'engine_sound.js'))
    ap.add_argument('--wav', help='папка для wav петель (прослушать)')
    ap.add_argument('--json', help='куда записать замеры')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rec, report = {}, {}
    for name in ('cabrio', 'sedan'):
        fn = os.path.join(a.src, name + '.mp3')
        if not os.path.isfile(fn): die('нет ' + fn)
        x = decode(fn)
        b, aa = signal.butter(2, 40 / (SR / 2), 'highpass'); x = signal.filtfilt(b, aa, x)
        lo, ilo = layer(x, name, 'lo'); hi, ihi = layer(x, name, 'hi')
        g = lambda v: v * (10 ** (RMS_DB / 20) / np.sqrt(np.mean(v ** 2)))
        lo, hi = g(lo), g(hi)
        ilo['seam'], ihi['seam'] = seam_check(lo), seam_check(hi)
        pcm = np.concatenate([lo, lo, hi, hi])
        peak = float(np.max(np.abs(pcm)))
        if peak > 0.97: pcm *= 0.97 / peak
        with tempfile.TemporaryDirectory() as d:
            w = os.path.join(d, 'x.wav'); m = os.path.join(d, 'x.mp3')
            wavfile.write(w, SR, pcm.astype(np.float32))
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', f'{KBPS}k',
                            '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', m], check=True)
            data = open(m, 'rb').read()
        h = hashlib.sha256(data).hexdigest()[:8]
        hit = banned(f'engine_{name}.{h}.mp3')
        if hit: die(f'имя файла задевает запретные слова сканера ({hit}) — поменяй KBPS на 1 и перезапусти')
        for f in os.listdir(a.out):
            if f.startswith(f'engine_{name}.') and f.endswith('.mp3'): os.remove(os.path.join(a.out, f))
        fname = f'engine_{name}.{h}.mp3'
        open(os.path.join(a.out, fname), 'wb').write(data)
        rec[name] = {'file': fname, 'sr': SR, 'lo': {'a': 0, 'n': len(lo), 'f': ilo['f']}, 'hi': {'a': 2 * len(lo), 'n': len(hi), 'f': ihi['f']}}
        report[name] = {'file': fname, 'kb': round(len(data) / 1024, 1), 'peak_dbfs': round(20 * np.log10(peak), 2), 'lo': ilo, 'hi': ihi}
        if a.wav:
            os.makedirs(a.wav, exist_ok=True)
            for part, v in (('lo', lo), ('hi', hi)):
                wavfile.write(os.path.join(a.wav, f'{name}_{part}.wav'), SR, v.astype(np.float32))
                wavfile.write(os.path.join(a.wav, f'{name}_{part}_x4.wav'), SR, np.tile(v, 4).astype(np.float32))
    # блок в js/engine_sound.js
    src = open(a.js, encoding='utf-8').read()
    blk = '  const REC = ' + json.dumps(rec, ensure_ascii=False, separators=(',', ':')) + ';\n'
    rx = re.compile(r'(  /\* ЗАПИСИ МОТОРОВ[^\n]*\n)(.*?)(  /\* /ЗАПИСИ МОТОРОВ \*/)', re.S)
    if not rx.search(src): die('в ' + a.js + ' нет меток «ЗАПИСИ МОТОРОВ»')
    src = rx.sub(lambda m_: m_.group(1) + blk + m_.group(3), src, count=1)
    open(a.js, 'w', encoding='utf-8').write(src)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if a.json: open(a.json, 'w').write(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
