#!/usr/bin/env python3
"""Озвучка реплик: голоса персонажей (RHVoice) → voice/<файл>.mp3 + voice/manifest.json.

Запуск (из корня игры):
  python3 tools/voice_build.py                 озвучить всё, что изменилось (кэш tools/.voice_cache), убрать лишние файлы
  python3 tools/voice_build.py --dry           только список реплик и объём, без синтеза
  python3 tools/voice_build.py --only cat,hero переозвучить только этих героев (остальное — из кэша)
  python3 tools/voice_build.py --only village  то же для всех говорящих горного села и серпантина (js/village/*.js)
  python3 tools/voice_build.py --only w4       волна 4: базар, свадьба (пальтар — «из-под маски»), отель, мышка с казом
  python3 tools/voice_build.py --casting OUT.html   страница кастинга: по 3 варианта голоса на героя (героиня — 6)

Как переозвучить героя (пере-кастинг):
  1) послушать страницу кастинга, выбрать варианты; кнопка «Скопировать выбор» даёт JSON —
     положить его в tools/voice_pick.json (например {"hero": "H3", "cat": "C2"});
     или поправить пресет прямо в CAST ниже (voice / pitch / tempo / range / formant / fx);
  2) python3 tools/voice_build.py — пересинтезируются только реплики изменённых героев.
  Новый говорящий без пресета озвучен не будет (в игре — «лепет»), сборка напишет его id в предупреждениях.

Что озвучивается: реплики в окне диалога (say/choose/ask с говорящим, рассказчик тоже), облачка «Помахать»,
приветствия хозяев мест, жители прототипа города. НЕ озвучиваются: тосты, кнопки, вывески, записки.
Реплики собирает tools/voice_lines.js (разбор исходников, AST); плюс tools/voice_harvest.json — реплики,
которые игра не нашла в манифесте во время прогона тестов (window.Voice.misses(), см. js/voice.js).

Имя героини голосом НЕ звучит никогда: реплика режется по {name}, на месте имени — мягкое «мм-м» тем же голосом
(по высоте говорящего). Так же — любые подстановки, которые нельзя знать заранее (числа, слова недели): слот {*}.

Пресет: voice — голос RHVoice; pitch — сдвиг высоты в полутонах (через -t RHVoice, без искажений);
tempo — темп (через -r RHVoice); range — размах интонации (Praat, 1 — как есть; >1 живее, <1 суше);
formant — сдвиг формант (Praat «Change gender»; >1 «меньше» персонаж, <1 «больше»); fx — эффекты ffmpeg
(названия из FX ниже); gain — поправка громкости, дБ; en= / ru= — отдельный пресет для реплик на этом языке
(героиня: hero_en; утята: английский голос, русское «Пи-пи!» — ru=).

Выход: mp3 моно 24 кГц 32 кбит/с (CBR, проигрывается на iOS/Android/в Telegram), громкость выровнена
(около -18 LUFS), тишина по краям срезана. Ключ реплики = FNV-1a(who + '|' + текст с {name}) с затравкой
из манифеста (seed: без коллизий и без запретных слов scan_words.py в ключах/именах) — так же считает js/voice.js.
Имя файла = ключ + хэш пресета (сменили голос — новый файл, кэш браузера не мешает).
"""
import argparse, base64, concurrent.futures as cf, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile, time
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, 'tools')
OUT = os.path.join(ROOT, 'voice')
CACHE = os.path.join(TOOLS, '.voice_cache')
PICK = os.path.join(TOOLS, 'voice_pick.json')
HARVEST = os.path.join(TOOLS, 'voice_harvest.json')
SR = 24000
PIPE_V = 3          # версия обработки: поменяли цепочку — всё пересинтезируется
LUFS = -18.0
BITRATE = '32k'

# средняя высота голосов RHVoice (Гц, замер Praat на фразе-образце) — для гула на месте имени и границ анализа
VOICE_F0 = {'anna': 224, 'arina': 188, 'elena': 212, 'irina': 180, 'tatiana': 207, 'victoria': 187,
            'aleksandr': 138, 'aleksandr-hq': 136, 'artemiy': 90, 'evgeniy-rus': 105, 'mikhail': 99, 'pavel': 106,
            'vitaliy': 108, 'yuriy': 115, 'slt': 171, 'clb': 173, 'lyubov': 209, 'alan': 122, 'bdl': 108, 'evgeniy-eng': 110}

# эффекты (ffmpeg -af)
FX = {
    'buzz': 'tremolo=f=36:d=0.22',                         # пчела: лёгкое жужжание (модуляция громкости)
    'buzz_light': 'tremolo=f=32:d=0.12',
    'quaver': 'vibrato=f=6:d=0.1',                          # овечье «бе-е»: дрожание высоты
    'drama': 'vibrato=f=5:d=0.06',                          # мелодраматическая дрожь в голосе
    'honk': 'highpass=f=260,equalizer=f=1250:t=q:w=1.3:g=8,equalizer=f=2700:t=q:w=1.2:g=3,lowpass=f=5200',   # гусь: носовой «га»
    'honk_soft': 'highpass=f=200,equalizer=f=1150:t=q:w=1.4:g=5,lowpass=f=6000',
    'chorus': 'chorus=0.6:0.85:45|58:0.45|0.35:0.3|0.45:2|1.4',   # голуби: «хор»
    'echo': 'aecho=0.8:0.75:300|600:0.38|0.2',               # эхо в подъезде
    'soft': 'lowpass=f=4200',                               # тихий, мягкий
    'purr': 'tremolo=f=24:d=0.09',                          # кот: чуть мурчит
    'warm': 'equalizer=f=220:t=q:w=1:g=2,lowpass=f=7000',
    'mask': 'lowpass=f=2700,equalizer=f=850:t=q:w=1.1:g=4,vibrato=f=7:d=0.07',   # пальтар: голос «из-под войлочной маски», нарочно смешной
}

# ---------------------------------------------------------------------------------------------------------
# КАСТИНГ. Для каждого героя — варианты; rec — рекомендованный (по умолчанию в игре). Выбор автора —
# tools/voice_pick.json ({"hero": "H3"}). line — реплика для страницы кастинга (настоящая, из игры).
# ---------------------------------------------------------------------------------------------------------
P = lambda voice, pitch=0, tempo=1.0, range=1.0, formant=1.0, fx=(), gain=0.0, note='', **k: dict(voice=voice, pitch=pitch, tempo=tempo, range=range, formant=formant, fx=list(fx), gain=gain, note=note, **k)
EN_HERO = {'E1': P('lyubov', 2, 1.04, 1.3, note='lyubov: мягкий, тёплый'), 'E2': P('slt', 5, 1.04, 1.45, 1.03, note='slt: звонче, «американский»'), 'E3': P('clb', 5, 1.06, 1.4, 1.03, note='clb: светлый, быстрый')}
CAST = {
    'hero': dict(label='Героиня', who='нежная, милая, позитивная, весёлая, активная', rec='H1',
                 line=['Так. Теперь я ещё и с цветами. Прекрасный рабочий день!', 'Секундочку. Это МОЙ бант. Я теперь ещё и актриса без гонорара?'],
                 opts={'H1': P('elena', 3, 1.08, 1.35, note='elena: самый чистый голос; +3 тона, живая интонация'),
                       'H2': P('tatiana', 3, 1.08, 1.35, note='tatiana: тоже чистый, чуть звонче'),
                       'H3': P('arina', 4, 1.08, 1.4, 1.04, note='arina: мягче и теплее, +4 тона'),
                       'H4': P('victoria', 4, 1.10, 1.55, note='victoria: юная, самый быстрый темп'),
                       'H5': P('irina', 4, 1.06, 1.35, 1.05, note='irina: нежная, чуть тише по характеру'),
                       'H6': P('anna', 2, 1.10, 1.25, note='anna: бодрая, «дикторская»')}),
    'hero_en': dict(label='Героиня — английские облачка', who='«Hi, I\'m …!» — имя голосом не звучит, на его месте «мм-м»', rec='E1',
                    line=["Hi, I'm {name}!", 'Hey there!'], opts=EN_HERO),
    'cat': dict(label='Кот Пирожок', who='ленивый, сухой, низкий', rec='C1',
                line=['Мяу. Перевожу: я Пирожок, местный информатор. Работаю за еду. Уважение можешь оставить себе.'],
                opts={'C1': P('vitaliy', -1, 0.92, 0.6, note='vitaliy: низко, ровно, лениво'),
                      'C2': P('mikhail', 0, 0.9, 0.55, note='mikhail: суше и с хрипотцой'),
                      'C3': P('aleksandr-hq', -2, 0.9, 0.6, 0.97, ['purr'], note='aleksandr: бархатнее и чуть мурчит')}),
    'raccoon': dict(label='Енот-киномеханик', who='мелодраматичный', rec='R1',
                    line=['Вы вернулись! А я репетировал, как спокойно вас встретить. Не вышло.'],
                    opts={'R1': P('aleksandr', 2, 1.0, 1.7, note='aleksandr: широкий размах, «театр»'),
                          'R2': P('yuriy', 2, 0.97, 1.6, note='yuriy: ещё драматичнее, медленнее'),
                          'R3': P('pavel', 4, 1.02, 1.6, 1.04, ['drama'], note='pavel: дрожь в голосе')}),
    'goose': dict(label='Гусь Финалыч', who='не умеет хранить спойлеры, «гусиный»', rec='G1',
                  line=['Га! Привет! Хочешь, расскажу, чем всё кончится?.. Молчу-молчу.'],
                  opts={'G1': P('pavel', 3, 1.15, 1.35, 1.06, ['honk'], note='pavel: носовой «га», быстрый'),
                        'G2': P('artemiy', 5, 1.15, 1.3, 1.08, ['honk'], note='artemiy: выше и смешнее'),
                        'G3': P('yuriy', 3, 1.18, 1.45, 1.05, ['honk_soft'], note='yuriy: суетливый, мягче гудит')}),
    'parrot': dict(label='Попугай-стажёр', who='самоуверенный, быстрый, высокий', rec='P1',
                   line=['Я уже перевёл записку похитителя. Очень точно! Ну… я так чувствую.'],
                   opts={'P1': P('yuriy', 7, 1.22, 1.35, 1.1, note='yuriy: высоко и бойко'),
                         'P2': P('aleksandr', 8, 1.22, 1.3, 1.12, note='aleksandr: выше, звонче'),
                         'P3': P('artemiy', 9, 1.25, 1.3, 1.12, note='artemiy: самый «птичий»')}),
    'fox': dict(label='Лиса-архивариус', who='спокойная, взрослая', rec='F1',
                line=['Я принесла словарь. На всякий случай. Попугай сегодня особенно уверен в себе.'],
                opts={'F1': P('irina', -1, 0.95, 0.85, note='irina: спокойная, ниже'),
                      'F2': P('elena', -2, 0.94, 0.85, note='elena: строже'),
                      'F3': P('tatiana', -2, 0.95, 0.9, 0.98, ['warm'], note='tatiana: теплее')}),
    'bunny': dict(label='Зайка-кондитер', who='милая', rec='B1',
                  line=['Заходи! Свидетели на витрине. Прошу не есть их до окончания допроса.'],
                  opts={'B1': P('victoria', 5, 1.06, 1.4, 1.08, note='victoria: мягкая, «маленькая»'),
                        'B2': P('arina', 5, 1.06, 1.4, 1.08, note='arina: теплее'),
                        'B3': P('tatiana', 5, 1.08, 1.35, 1.06, note='tatiana: звонче')}),
    'hedgehog': dict(label='Ёжик-звукорежиссёр', who='бойкая, с абсолютным слухом', rec='He1',
                     line=['Стоп! Я слышала утром странное «пшш» над крышей. Думала, кто-то открыл газировку.'],
                     opts={'He1': P('tatiana', 4, 1.12, 1.3, 1.07, note='tatiana: бойкая, «маленькая»'),
                           'He2': P('irina', 5, 1.12, 1.3, 1.08, note='irina: нежнее'),
                           'He3': P('anna', 3, 1.15, 1.2, 1.05, note='anna: деловитая')}),
    'bee': dict(label='Пчёлка Жу, флористка', who='жужжащая, весёлая', rec='Be1',
                line=['Ой, следователь! Я Жу. Цветы выбирай любые. День такой, что без букета нельзя.'],
                opts={'Be1': P('anna', 5, 1.12, 1.35, 1.08, ['buzz'], note='anna: звонкая, жужжит'),
                      'Be2': P('elena', 5, 1.12, 1.35, 1.08, ['buzz_light'], note='elena: чище, жужжит легко'),
                      'Be3': P('victoria', 6, 1.14, 1.45, 1.1, ['buzz'], note='victoria: самая маленькая')}),
    'narrator': dict(label='Рассказчик', who='тёплый, спокойный (можно выключить: долгое нажатие на 🔊)', rec='N1',
                     line=['Улица опустела. Самые красивые мелочи — теперь у тебя.'],
                     opts={'N1': P('aleksandr-hq', 0, 1.0, 1.0, note='aleksandr: тёплый мужской'),
                           'N2': P('elena', -1, 0.96, 0.95, note='elena: тёплый женский'),
                           'N3': P('vitaliy', 0, 0.98, 1.05, 1.0, ['warm'], note='vitaliy: ниже, «сказочник»')}),
    'sheep': dict(label='Овечка Кашемира, ателье', who='мягкая, модница', rec='Sh1',
                  line=['Пятый образ за визит! Ты не примеряешь, ты устраиваешь Неделю моды.'],
                  opts={'Sh1': P('elena', 1, 0.98, 1.15, 1.03, ['quaver'], note='elena: с овечьим «бе-е»'),
                        'Sh2': P('irina', 2, 0.98, 1.1, 1.04, ['quaver'], note='irina: мягче'),
                        'Sh3': P('tatiana', 1, 1.0, 1.15, note='tatiana: без дрожи')}),
    'turtle': dict(label='Черепаха Минутка, фотостудия', who='медленная', rec='T1',
                   line=['Не двигайся… Да, знаю, тяжело. Ещё секундочку…'],
                   opts={'T1': P('arina', 0, 0.74, 0.8, note='arina: медленно и тепло'),
                         'T2': P('irina', -1, 0.72, 0.8, 0.97, note='irina: ещё медленнее'),
                         'T3': P('victoria', 1, 0.76, 0.85, note='victoria: моложе')}),
    'gaunt': dict(label='Матушка Гусыня, книжная', who='уютная, «мама-сказочница»', rec='Ga1',
                  line=['Закладка — маленькое обещание вернуться. Хорошее, между прочим.'],
                  opts={'Ga1': P('anna', -2, 0.95, 1.1, note='anna: по-матерински'),
                        'Ga2': P('tatiana', -3, 0.94, 1.1, 0.97, ['warm'], note='tatiana: ниже, теплее'),
                        'Ga3': P('irina', -3, 0.95, 1.1, 1.0, ['honk_soft'], note='irina: чуть «гусиная»')}),
    'zhuzha': dict(label='Тётушка Жужа, оранжерея', who='тёплая, жужжит', rec='Z1',
                   line=['Я читаю растениям прогноз. Им нравится, что он оптимистичный.'],
                   opts={'Z1': P('tatiana', 1, 1.0, 1.2, 1.02, ['buzz_light'], note='tatiana: тёплая, слегка жужжит'),
                         'Z2': P('anna', 0, 1.0, 1.15, 1.0, ['buzz_light'], note='anna: бодрая'),
                         'Z3': P('elena', 0, 0.98, 1.15, 1.0, ['buzz'], note='elena: жужжит сильнее')}),
    'tycho': dict(label='Голубь Тихо, планетарий', who='тихий, спокойный астроном', rec='Ty1',
                  line=['Тихо — моё имя. И, если честно, пожелание на всю жизнь.'],
                  opts={'Ty1': P('aleksandr-hq', 1, 0.92, 0.8, 1.0, ['soft'], note='aleksandr: тихо и мягко'),
                        'Ty2': P('evgeniy-rus', 2, 0.92, 0.85, 1.02, ['soft'], note='evgeniy: моложе'),
                        'Ty3': P('pavel', 2, 0.9, 0.8, 1.0, ['soft'], note='pavel: шёпотом')}),
    'owl': dict(label='Сова', who='мудрая, неторопливая (отвечает на «Помахать»)', rec='O1',
                line=['И тебе привет!'],
                opts={'O1': P('vitaliy', -2, 0.85, 0.8, note='vitaliy: низко, медленно'),
                      'O2': P('evgeniy-rus', -1, 0.85, 0.85, 0.96, ['warm'], note='evgeniy: теплее'),
                      'O3': P('aleksandr-hq', -3, 0.86, 0.85, 0.95, note='aleksandr: бархатный')}),
    'pigeons': dict(label='Голуби, подъезд', who='хор, «гуль-гуль»', rec='Pi1',
                    line=['Гуль-гуль.'],
                    opts={'Pi1': P('pavel', 3, 1.05, 1.3, 1.05, ['chorus'], note='pavel: хором'),
                          'Pi2': P('yuriy', 4, 1.05, 1.3, 1.06, ['chorus'], note='yuriy: выше'),
                          'Pi3': P('artemiy', 6, 1.08, 1.3, 1.08, ['chorus'], note='artemiy: смешнее')}),
    'poodle': dict(label='Пудель Пудра', who='весёлая собачка', rec='Po1',
                   line=['Тяф! Привет! Я Пудра. Охраняю эклеры. Пока все целы.'],
                   opts={'Po1': P('victoria', 6, 1.14, 1.45, 1.1, note='victoria: звонкая'),
                         'Po2': P('anna', 5, 1.14, 1.4, 1.08, note='anna: бойкая'),
                         'Po3': P('tatiana', 6, 1.12, 1.4, 1.1, note='tatiana: «маленькая»')}),
    # второстепенные — один пресет (на странице кастинга не показываются, можно переопределить так же)
    'cinnabon': dict(label='Булочка', who='впечатлительная', rec='A', line=['Привет-привет!'], opts={'A': P('arina', 4, 1.05, 1.35, 1.06)}),
    'macaron': dict(label='Макарон', who='важный', rec='A', line=['И тебе привет!'], opts={'A': P('aleksandr', 3, 0.95, 1.2, 1.03)}),
    'bubbletea': dict(label='Бабл-ти', who='пузырчатый, врунишка', rec='A', line=['Ладно, это я соврал. Но прежде чем осуждать, посмотрите на мои жемчужинки.'],
                      opts={'A': P('yuriy', 5, 1.18, 1.35, 1.08)}),
    'pigeon': dict(label='Голубь (город)', who='добродушный', rec='A', line=['Курлы! Привет!'], opts={'A': P('pavel', 4, 1.1, 1.3, 1.05)}),
    'echo': dict(label='Эхо', who='голос героини, эхом', rec='A', line=['…а можно я сама? Привет!'], opts={'A': dict(inherit='hero', fx=['echo'], gain=-2.0)}),
    # хозяева лавок единого города (js/world/interiors.js) — по одному пресету
    'g_mouse': dict(label='Мышка Сайка, пекарня', who='тонкий, быстрый', rec='A', line=['Заходи, заходи! Только что из печи.'], opts={'A': P('arina', 6, 1.16, 1.4, 1.1)}),
    'g_llama': dict(label='Лама Мокко, какао', who='мягкий, неторопливый', rec='A', line=['Секрет хорошего какао — не торопиться.'], opts={'A': P('anna', 0, 0.9, 1.05, 1.0, ['warm'])}),
    'g_bear': dict(label='Медвежонок Мишутка, игрушки', who='низкий, добрый', rec='A', line=['Самая важная игрушка — та, которую обнимают.'], opts={'A': P('mikhail', 1, 0.95, 1.2, 0.98, ['warm'])}),
    'g_stork': dict(label='Аист Депеша, почта', who='важный, чёткий', rec='A', line=['Почта открыта!'], opts={'A': P('evgeniy-rus', 0, 0.98, 1.1)}),
    'g_hippo': dict(label='Бегемотик Плюх, прачечная', who='басовитый, весёлый', rec='A', line=['Плюх! Ой, это я, а не стиралка.'], opts={'A': P('artemiy', -2, 1.0, 1.4, 0.95, ['warm'])}),
    'g_giraffe': dict(label='Жираф Штрих, галерея', who='спокойный, высокий', rec='A', line=['Смотреть можно долго, трогать — глазами.'], opts={'A': P('yuriy', 1, 0.95, 0.9)}),
    'g_duck': dict(label='Утка Капа, зонтики', who='звонкий', rec='A', line=['Кря! Заходи под крышу.'], opts={'A': P('tatiana', 5, 1.12, 1.4, 1.06, ['honk_soft'])}),
    'g_alpaca': dict(label='Альпака Пряжа, пряжа', who='тёплый, мягкий', rec='A', line=['Заходи, тут тепло.'], opts={'A': P('arina', 1, 0.96, 1.1, 1.0, ['warm'])}),
    # горное село и серпантин (js/village/lines.js — VILLAGE.SPEAKERS, js/village/serpentine.js — тур): реплики { who, text }
    # (и варианты n: для named = false) tools/voice_lines.js находит сам, как все js/**; здесь — только голоса, по одному пресету
    'badger': dict(label='Барсук-гравёр, село', who='тёплый, неторопливый, мастер', rec='A', line=['Привет! Сначала гравирую узор. Потом заливаю чернью — и он темнеет.'], opts={'A': P('mikhail', 0, 0.92, 1.15, 0.98, ['warm'])}),
    'owl_keeper': dict(label='Сова-хранительница, село', who='тихий, бережный, «музейный»', rec='A', line=['Тише, тут образцы. Серебро, золото и даже кость.'], opts={'A': P('tatiana', -2, 0.88, 0.85, 0.98, ['soft'])}),
    'eagle': dict(label='Беркут, село', who='спокойный, гордый', rec='A', line=['Привет! С башни видно всё село. Если нет тумана.'], opts={'A': P('aleksandr', -1, 0.94, 1.0, 0.97)}),
    'roof_cat': dict(label='Кошка на крыше, село', who='ленивое мурлыканье', rec='A', line=['Мур. Это крыша соседей снизу. А для меня — двор.'], opts={'A': P('arina', 1, 0.9, 0.8, 1.04, ['purr'])}),
    'pony': dict(label='Лошадка, село', who='добродушный, размеренный', rec='A', line=['Привет! Везу сено. Сенокосы прямо за селом.'], opts={'A': P('yuriy', 0, 0.93, 1.1, 0.98, ['warm'])}),
    'mtn_sheep': dict(label='Овечка, село', who='мечтательный, лёгкий', rec='A', line=['Внизу облака. Как будто у неба стрижка.'], opts={'A': P('victoria', 3, 0.98, 1.2, 1.05, ['quaver'])}),
    'baker_bunny': dict(label='Зайка-пекарь, село', who='бодрый, заботливый', rec='A', line=['Хлеб только из печи. Тёплый, с хрустом.'], opts={'A': P('anna', 4, 1.08, 1.35, 1.06)}),
    'spring_hedgehog': dict(label='Ёжик у родника, село', who='звонкий, весёлый', rec='A', line=['Кувшин медный. На солнце горит, как огонёк.'], opts={'A': P('elena', 5, 1.12, 1.4, 1.08)}),
    'mouse': dict(label='Мышка-вышивальщица, село', who='тоненький, ласковый', rec='A', line=['Утром тут стучат молоточки. А пахнет хлебом.'], opts={'A': P('victoria', 7, 1.1, 1.35, 1.12)}),
    'granny_hedgehog': dict(label='Бабушка-ежиха, село', who='мягкий, бабушкин', rec='A', line=['Присядь, отдохни. Отсюда хорошо смотреть на горы.'], opts={'A': P('irina', -2, 0.88, 1.1, 1.02, ['warm'])}),
    'pigeon_metro': dict(label='Голубь в «метро», село', who='воркующий', rec='A', line=['Курлы. Это наше метро. Без турникетов.'], opts={'A': P('artemiy', 4, 1.0, 1.25, 1.06, ['soft'])}),
    'tur': dict(label='Тур, серпантин', who='басовитый, добродушный, неторопливый', rec='A', line=['Рога? Большие, загнуты назад. Ношу с достоинством.'], opts={'A': P('artemiy', -3, 0.88, 1.05, 0.94, ['warm'])}),
    # волна 4: село — корова и лавочники базарной площади (js/village/lines.js, VILLAGE.SPEAKERS); реплики { who, text } находит voice_lines.js
    'cow': dict(label='Корова, село', who='добродушный, протяжный, с «му»', rec='A', line=['Му! Ничего, у родника отмоешь.'], opts={'A': P('vitaliy', -2, 0.8, 0.9, 0.95, ['warm'])}),
    'goat_grocer': dict(label='Козочка-лавочница, базар', who='звонкий, приветливый', rec='A', line=['Творог, сметана, яйца — всё свежее!'], opts={'A': P('tatiana', 3, 1.06, 1.3, 1.05, ['quaver'])}),
    'bear_craft': dict(label='Медвежонок-медник, базар', who='басовитый, мягкий, неторопливый', rec='A', line=['Медный кувшинчик звенит, как колокольчик. Послушай!'], opts={'A': P('mikhail', -1, 0.9, 1.1, 0.97, ['warm'])}),
    'lamb_cloth': dict(label='Ягнёнок с пряжей, базар', who='тоненький, застенчивый', rec='A', line=['Платочки лёгкие и тёплые. Выбирай любой!'], opts={'A': P('victoria', 5, 1.0, 1.15, 1.08, ['soft'])}),
    'squirrel_nuts': dict(label='Белочка с орешками, базар', who='быстрый, весёлый', rec='A', line=['Сегодня базар — шумно и весело!'], opts={'A': P('anna', 6, 1.18, 1.4, 1.1)}),
    # волна 4: свадьба во дворе (js/village/wedding.js — VILLAGE.wedding.SPEAKERS / LINES / EVENTS; реплики берёт module_lines())
    'wed_bride': dict(label='Невеста-овечка, свадьба', who='нежный, радостный', rec='A', line=['Спасибо, что пришла! Угощайся!'], opts={'A': P('arina', 3, 1.04, 1.35, 1.05)}),
    'wed_groom': dict(label='Жених-барашек, свадьба', who='добрый, гордый, тёплый', rec='A', line=['Танцуют все — и гости, и мы!'], opts={'A': P('evgeniy-rus', 1, 0.98, 1.2, 1.0, ['warm'])}),
    'wed_zurna': dict(label='Барсучок с зурной, свадьба', who='бодрый, звонкий', rec='A', line=['Музыка у нас только живая: зурна и барабан!'], opts={'A': P('yuriy', 3, 1.1, 1.35, 1.04)}),
    'wed_drum': dict(label='Медвежонок-барабанщик, свадьба', who='басовитый, весёлый', rec='A', line=['Бум-бум! Держи ритм — и в круг!'], opts={'A': P('artemiy', -2, 1.02, 1.35, 0.95, ['warm'])}),
    'wed_aunt': dict(label='Тётушка-ежиха, свадьба', who='тёплый, хлопотливый', rec='A', line=['Свадьба у нас — целых три дня!'], opts={'A': P('irina', -1, 1.04, 1.25, 1.02, ['warm'])}),
    'wed_kid': dict(label='Котёнок, свадьба', who='звонкий, детский', rec='A', line=['Конфетки! Лови!'], opts={'A': P('victoria', 7, 1.12, 1.45, 1.12)}),
    'paltar': dict(label='Пальтар (ряженый), свадьба', who='нарочно изменённый, смешной, озорной — «из-под маски»', rec='A', line=['Звяк-звяк! Это я так здороваюсь!'],
                   opts={'A': P('artemiy', 6, 1.04, 1.75, 0.92, ['mask'])}),
    # волна 4: «Отель на вершине» (js/village/hotel.js — VILLAGE.hotel.SPEAKERS / LINES / EVENTS)
    'hotel_goat': dict(label='Козочка-администратор, отель', who='приветливая, звонкая, чуть торжественная', rec='A', line=['Добро пожаловать! Отсюда горы видно лучше всего — особенно на закате.'], opts={'A': P('elena', 2, 1.0, 1.25, 1.02)}),
    'hotel_raccoon': dict(label='Енот-тренер, отель', who='бодрый, спортивный, с улыбкой', rec='A', line=['Падел, мини-футбол, мини-гольф. Мячик выдам бесплатно!'], opts={'A': P('aleksandr', 2, 1.1, 1.35, 1.02)}),
    'hotel_otter': dict(label='Выдра у бассейна, отель', who='весёлая, быстрая, «мокрая» интонация', rec='A', line=['Вода в бассейне тёплая — с подогревом!'], opts={'A': P('tatiana', 4, 1.15, 1.4, 1.06, ['quaver'])}),
    'hotel_bear': dict(label='Медвежонок у костра, отель', who='тёплый, басовитый, неторопливый', rec='A', line=['Садись к огню, тут тепло!'], opts={'A': P('mikhail', -2, 0.86, 1.0, 0.96, ['warm'])}),
    'hotel_marmot': dict(label='Сурок-инструктор, отель', who='задорный, уверенный, чуть с хрипотцой', rec='A', line=['Держись крепче — и вжу-у-ух, через всю долину!'], opts={'A': P('pavel', 3, 1.08, 1.35, 1.03)}),
    # жители города волны 3 (js/world/residents.js, companion.js — LIFE): собачки, кошки, капибара, утки, мышиное трио, ёжик с листом
    'dog_spitz': dict(label='Шпиц Зефирка', who='восторг, только «Тяф!»', rec='A', line=['Тяф-тяф!'], opts={'A': P('victoria', 7, 1.2, 1.5, 1.12)}),
    'dog_dachshund': dict(label='Такса Багет', who='бодрый, всё меряет в таксах', rec='A', line=['До фонтана — сорок две таксы. Мерил лично.'], opts={'A': P('artemiy', 3, 1.08, 1.35, 1.04)}),
    'dog_corgi': dict(label='Корги Пельмень', who='сонный философ', rec='A', line=['Хрр… Я не сплю. Я жду, когда станет интересно.'], opts={'A': P('mikhail', 0, 0.88, 0.8, 0.98, ['warm'])}),
    'cat_ginger': dict(label='Кот Бублик', who='солнечный, ленивый', rec='A', line=['Мр-р. Я занял тёплую скамейку.'], opts={'A': P('aleksandr-hq', 1, 0.92, 0.9, 1.0, ['purr'])}),
    'cat_tabby': dict(label='Кот Тапок', who='суховатый, смотрит витрины', rec='A', line=['Мяу. Я смотрю витрины. Ничего не покупаю.'], opts={'A': P('yuriy', 2, 1.0, 1.0, 1.02)}),
    'cat_tux': dict(label='Кот Сажа', who='торжественный, «во фраке»', rec='A', line=['Мяу. Я во фраке. Всегда готов к празднику.'], opts={'A': P('evgeniy-rus', 0, 0.95, 1.1, 1.0)}),
    'capybara': dict(label='Капибара Пауза', who='очень спокойная, медленная', rec='A', line=['Привет. Ничего делать не надо. Это и есть занятие.'], opts={'A': P('vitaliy', -1, 0.78, 0.7, 0.98, ['soft'])}),
    'ducks': dict(label='Утка Кряквина', who='мама-утка, звонкая', rec='A', line=['Кря! Это мои утята. Плывём строго по порядку.'], opts={'A': P('anna', 2, 1.05, 1.3, 1.04, ['honk_soft'])}),
    'ducklings': dict(label='Утята', who='крошечные, «Hello!» — по-английски', rec='A', line=['Hello! Hello!'],
                      opts={'A': P('clb', 8, 1.15, 1.4, 1.12, ru=P('victoria', 9, 1.2, 1.45, 1.12))}),   # английский голос русское «Пи-пи!» не читает
    'mice': dict(label='Трио «До-Ре-Мышь»', who='писклявое трио, хором', rec='A', line=['Пи! Привет! Играем всё, кроме грустного.'], opts={'A': P('victoria', 8, 1.22, 1.45, 1.12, ['chorus'])}),
    'hedgehog_leaf': dict(label='Ёжик Шуршик', who='маленький, шуршащий', rec='A', line=['Шур-шур! Привет!'], opts={'A': P('tatiana', 5, 1.1, 1.3, 1.08)}),
}
# группы для --only: «--only village» = все говорящие горного села и серпантина
W4_BAZAAR = ['cow', 'goat_grocer', 'bear_craft', 'lamb_cloth', 'squirrel_nuts']
W4_WEDDING = ['wed_bride', 'wed_groom', 'wed_zurna', 'wed_drum', 'wed_aunt', 'wed_kid', 'paltar']
W4_HOTEL = ['hotel_goat', 'hotel_raccoon', 'hotel_otter', 'hotel_bear', 'hotel_marmot']
SPEAKER_GROUPS = {'village': ['badger', 'owl_keeper', 'eagle', 'roof_cat', 'pony', 'mtn_sheep', 'baker_bunny', 'spring_hedgehog', 'mouse', 'granny_hedgehog', 'pigeon_metro', 'tur'] + W4_BAZAAR + W4_WEDDING + W4_HOTEL,
                  'w4': W4_BAZAAR + W4_WEDDING + W4_HOTEL + ['mouse'], 'bazaar': W4_BAZAAR, 'wedding': W4_WEDDING, 'hotel': W4_HOTEL,
                  'life': ['dog_spitz', 'dog_dachshund', 'dog_corgi', 'cat_ginger', 'cat_tabby', 'cat_tux', 'capybara', 'ducks', 'ducklings', 'mice', 'hedgehog_leaf']}
CASTING_ORDER = ['hero', 'hero_en', 'cat', 'raccoon', 'goose', 'parrot', 'fox', 'bunny', 'hedgehog', 'bee', 'narrator',
                 'sheep', 'turtle', 'gaunt', 'zhuzha', 'tycho', 'owl', 'pigeons', 'poodle']
SPEAKER_ALIAS = {}     # id в игре → id пресета (если у двух говорящих один голос)


def load_pick():
    try:
        with open(PICK, encoding='utf-8') as f:
            d = json.load(f)
        return {k: v for k, v in d.items() if isinstance(v, str)}
    except FileNotFoundError:
        return {}


def preset_for(who, pick=None, lang='ru'):
    """Готовый пресет героя (с учётом выбора автора); None — героя нет в кастинге."""
    pick = pick if pick is not None else load_pick()
    who = SPEAKER_ALIAS.get(who, who)
    c = CAST.get(who)
    if not c:
        return None
    oid = pick.get(who) if pick.get(who) in c['opts'] else c['rec']
    p = dict(c['opts'][oid])
    if p.get('inherit'):
        base = preset_for(p['inherit'], pick, lang)
        if not base:
            return None
        base = dict(base); base['fx'] = list(base.get('fx', [])) + list(p.get('fx', [])); base['gain'] = base.get('gain', 0) + p.get('gain', 0)
        base['id'] = f"{p['inherit']}>{oid}"
        return base
    if who == 'hero' and lang == 'en':
        e = CAST['hero_en']; eid = pick.get('hero_en') if pick.get('hero_en') in e['opts'] else e['rec']
        p = dict(e['opts'][eid]); oid = eid
    elif isinstance(p.get(lang), dict):   # отдельный пресет для реплик на другом языке: P(..., ru=P(...)) / P(..., en=P(...))
        p = dict(p[lang]); oid = f'{oid}/{lang}'
    p['id'] = oid
    return p


def sig(p):
    keys = ('voice', 'pitch', 'tempo', 'range', 'formant', 'fx', 'gain')
    return json.dumps([PIPE_V] + [p.get(k) for k in keys], ensure_ascii=False)


# ---------------------------------------------------------------------------------------------------------
# текст → то, что произносит синтезатор
# ---------------------------------------------------------------------------------------------------------
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍←-⇿■-◿✀-➿✦★☆♪♫]')
PRON = [
    (r'10\s*/\s*10', 'десять из десяти'), (r'№\s*', 'номер '), (r'33⅓', 'тридцать три и одна треть'), (r'⅓', ' и одна треть'),
    (r'\bP\.P\.S\.', 'пи-пи-эс'), (r'\bP\.S\.', 'пи-эс'), (r'\bOK\b', 'окей'), (r'Ж-ж-ж', 'Жжжж'), (r'\bТВ\b', 'тэвэ'),
    (r'(\d)\s*°', r'\1 градусов'), (r'\+', ' плюс '), (r'&', ' и '),
]


def speakable(s):
    s = EMOJI.sub('', s)
    s = re.sub(r'\s*\([^()]*\)\s*', ' ', s)   # ремарки в скобках «(не просыпаясь)», «(прослезившись)» — видно в облачке, вслух не читаем
    for a, b in PRON:
        s = re.sub(a, b, s)
    s = s.replace('„', '«').replace('“', '»').replace('"', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def has_letters(s):
    return bool(re.search(r'[A-Za-zА-Яа-яЁё0-9]', s))


def lang_of(text):
    return 'ru' if re.search('[А-Яа-яЁё]', text) else 'en'


# ---------------------------------------------------------------------------------------------------------
# ключи (то же, что в js/voice.js)
# ---------------------------------------------------------------------------------------------------------
SEED0 = 0x811c9dc5


def fnv(s, seed=SEED0):
    h = seed
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def norm(t):
    return re.sub(r'\s+', ' ', t).strip()


def line_key(who, text, seed=SEED0):
    return fnv(who + '|' + norm(text), seed)


def scan_terms():
    """Регулярки запретных слов из tools/scan_words.py: ни ключ, ни имя файла не должны на них попадать
    (например, «911» внутри шестнадцатеричного хэша)."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location('scan_words', os.path.join(TOOLS, 'scan_words.py'))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        return [re.compile(rx, re.I) for _, rxs in m.TERMS for rx in rxs]
    except Exception as e:
        print('  ⚠ scan_words.py не загрузился:', e)
        return [re.compile(r'911')]


def file_name(who, text, p, seed):
    return f"{line_key(who, text, seed)}{fnv(sig(p) + text, seed)[:4]}.mp3"


def pick_seed(plan):
    """Затравка хэша: без коллизий ключей и без запретных слов в ключах и именах файлов (js/voice.js берёт её из манифеста)."""
    terms = scan_terms()
    try:   # прежняя затравка, если ещё годится: имена файлов не меняются, кэш браузера не сбрасывается
        prev = [json.load(open(os.path.join(OUT, 'manifest.json'))).get('seed')]
    except Exception:
        prev = []
    for seed in [x for x in prev if isinstance(x, int)] + list(range(SEED0, SEED0 + 500)):
        keys, ok = {}, True
        for it, p in plan:
            k, fn = line_key(it['who'], it['text'], seed), file_name(it['who'], it['text'], p, seed)
            if keys.setdefault(k, (it['who'], it['text'])) != (it['who'], it['text']) or any(t.search(k) or t.search(fn) for t in terms):
                ok = False; break
        if ok:
            return seed
    sys.exit('не нашлась затравка хэша без коллизий')


# ---------------------------------------------------------------------------------------------------------
# синтез одной реплики
# ---------------------------------------------------------------------------------------------------------
def run(cmd, inp=None):
    r = subprocess.run(cmd, input=inp, capture_output=True)
    if r.returncode:
        raise RuntimeError(' '.join(cmd[:3]) + ': ' + r.stderr.decode('utf-8', 'replace')[-400:])
    return r.stdout


def read_wav(path):
    import wave
    with wave.open(path, 'rb') as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    a = np.frombuffer(raw, dtype=np.int16 if sw == 2 else np.int32).astype(np.float32) / (32768.0 if sw == 2 else 2147483648.0)
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        from scipy.signal import resample_poly
        g = np.gcd(sr, SR); a = resample_poly(a, SR // g, sr // g).astype(np.float32)
    return a


def write_wav(path, a, sr=SR):
    import wave
    b = (np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(b)


def synth_segment(text, p, tmp):
    """RHVoice (+ Praat: размах и форманты) (+ ffmpeg fx) → float32 @ 24 кГц, без тишины по краям."""
    t = speakable(text)
    if not has_letters(t):
        return np.zeros(0, np.float32)
    f1 = os.path.join(tmp, 'a.wav')
    run(['RHVoice-test', '-p', p['voice'], '-t', str(int(round(100 * 2 ** (p.get('pitch', 0) / 12)))), '-r', str(int(round(100 * p.get('tempo', 1.0)))), '-o', f1], t.encode('utf-8'))
    a = read_wav(f1)
    rng, fm = p.get('range', 1.0), p.get('formant', 1.0)
    if abs(rng - 1) > 1e-3 or abs(fm - 1) > 1e-3:
        import parselmouth
        from parselmouth.praat import call
        f0 = VOICE_F0.get(p['voice'], 150) * 2 ** (p.get('pitch', 0) / 12)
        snd = parselmouth.Sound(a.astype(np.float64), sampling_frequency=SR)
        try:
            snd = call(snd, 'Change gender', max(50, f0 * 0.45), min(900, f0 * 2.4), fm, 0, rng, 1.0)
            a = snd.values[0].astype(np.float32)
            if int(snd.sampling_frequency) != SR:
                from scipy.signal import resample_poly
                a = resample_poly(a, SR, int(snd.sampling_frequency)).astype(np.float32)
        except Exception as e:   # короткие кусочки без голоса — как есть
            print('  praat:', text[:30], e, file=sys.stderr)
    if p.get('fx'):
        chain = ','.join(FX[x] if x in FX else x for x in p['fx'])
        f2, f3 = os.path.join(tmp, 'b.wav'), os.path.join(tmp, 'c.wav')
        pad = np.zeros(int(SR * 0.35), np.float32)          # хвост для эха/хора
        write_wav(f2, np.concatenate([a, pad]))
        run(['ffmpeg', '-v', 'error', '-y', '-i', f2, '-af', chain, '-ar', str(SR), '-ac', '1', f3])
        a = read_wav(f3)
    return trim(a)


def trim(a, db=-42, pre=0.03, post=0.07):
    if not len(a):
        return a
    fr = int(SR * 0.01)
    n = len(a) // fr
    if n < 2:
        return a
    rms = np.sqrt(np.mean(a[:n * fr].reshape(n, fr) ** 2, axis=1) + 1e-12)
    thr = rms.max() * 10 ** (db / 20)
    idx = np.where(rms > thr)[0]
    if not len(idx):
        return a[:0]
    s, e = max(0, idx[0] * fr - int(pre * SR)), min(len(a), (idx[-1] + 1) * fr + int(post * SR))
    a = a[s:e].copy()
    k = min(len(a) // 4, int(SR * 0.006))
    if k > 1:
        a[:k] *= np.linspace(0, 1, k); a[-k:] *= np.linspace(1, 0, k)
    return a


def median_f0(a, guess):
    try:
        import parselmouth
        s = parselmouth.Sound(a.astype(np.float64), sampling_frequency=SR)
        v = s.to_pitch_ac(pitch_floor=max(50, guess * 0.5), pitch_ceiling=min(900, guess * 2.2)).selected_array['frequency']
        v = v[v > 0]
        return float(np.median(v)) if len(v) > 5 else guess
    except Exception:
        return guess


def hum(f0, rms, last=False):
    """Мягкое «мм-м» вместо имени: два слога, второй выше, носовой (низкочастотный) тембр."""
    from scipy.signal import butter, sosfilt
    dur = 0.36
    n = int(SR * dur)
    t = np.arange(n) / SR
    cut = int(n * 0.46)
    i = np.arange(n)
    # каждый слог чуть скользит вверх (дружелюбное «мм?»), второй выше первого
    hi = 1.2 if last else 1.15
    f = np.where(i < cut, f0 * (0.93 + 0.07 * i / cut), f0 * (1.04 + (hi - 1.04) * (i - cut) / max(1, n - cut)))
    f = np.convolve(np.pad(f, 300, mode='edge'), np.ones(301) / 301, mode='same')[300:-300]
    rng = np.random.default_rng(int(f0))
    jit = np.convolve(rng.standard_normal(n), np.ones(480) / 480, mode='same') * 0.6
    f = f * (1 + 0.022 * np.sin(2 * np.pi * 5.4 * t) + 0.01 * jit)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = sum((1.0 / k ** 1.35) * np.sin(k * ph + 0.3 * k) for k in range(1, 12))
    sos = butter(2, min(1500, f0 * 5.5), 'low', fs=SR, output='sos')
    sig = sosfilt(sos, sig)
    # «носовая» полоса м/н около 250 Гц и немного дыхания
    pk = butter(1, [max(120, f0 * 0.8), min(2000, f0 * 2.6)], 'band', fs=SR, output='sos')
    sig = sig + 0.6 * sosfilt(pk, sig)
    br = sosfilt(butter(2, [300, 2400], 'band', fs=SR, output='sos'), rng.standard_normal(n))
    sig = sig / (np.abs(sig).max() + 1e-9) + 0.035 * br / (np.abs(br).max() + 1e-9)
    env = np.zeros(n)

    def bump(a, b, att=0.025, rel=0.06):
        i0, i1 = int(a * SR), min(n, int(b * SR))
        seg = np.ones(i1 - i0)
        na, nr = int(att * SR), int(rel * SR)
        seg[:na] = np.linspace(0, 1, na) ** 1.5
        seg[-nr:] *= np.linspace(1, 0, nr) ** 1.2
        env[i0:i1] = np.maximum(env[i0:i1], seg)
    bump(0.0, dur * 0.47, rel=0.05)
    bump(dur * 0.5, dur, rel=0.11)
    sig = sig * env
    r = np.sqrt(np.mean(sig[env > 0.5] ** 2) + 1e-12)
    return (sig / r * rms * 0.55).astype(np.float32)


def loud(a):
    """Громкость к -18 LUFS, пик не выше -1,5 дБFS (мягкое ограничение)."""
    if not len(a):
        return a
    import pyloudnorm as pyln
    m = pyln.Meter(SR, block_size=0.2)
    x = a if len(a) >= int(SR * 0.45) else np.concatenate([a, a, np.zeros(int(SR * 0.45), np.float32)])
    try:
        L = m.integrated_loudness(x.astype(np.float64))
    except Exception:
        L = -99
    if not np.isfinite(L) or L < -70:
        L = 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9) - 0.7
    a = a * 10 ** ((LUFS - L) / 20)
    lim, knee = 0.84, 0.6
    ab = np.abs(a)
    over = ab > knee
    if over.any():
        a = a.copy()
        a[over] = np.sign(a[over]) * (knee + (lim - knee) * np.tanh((ab[over] - knee) / (lim - knee)))
    return a.astype(np.float32)


def render(parts, p, tmp):
    """Куски текста и слоты → одна реплика: речь + «мм-м» на месте имени/подстановок."""
    segs, f0g = [], VOICE_F0.get(p['voice'], 150) * 2 ** (p.get('pitch', 0) / 12)
    for x in parts:
        if isinstance(x, str):
            a = synth_segment(x, p, tmp)
            if len(a):
                segs.append(('s', a))
        else:
            segs.append(('h', None))
    speech = [a for k, a in segs if k == 's']
    if not speech:
        return np.zeros(0, np.float32)
    rms = float(np.sqrt(np.mean(np.concatenate(speech) ** 2)))
    f0 = median_f0(np.concatenate(speech), f0g) if any(k == 'h' for k, _ in segs) else f0g
    out, gap = [], np.zeros(int(SR * 0.06), np.float32)
    for i, (k, a) in enumerate(segs):
        if k == 's':
            out.append(a)
        else:
            if out:
                out.append(gap)
            out.append(hum(f0, rms, last=(i == len(segs) - 1)))
            out.append(gap)
    a = np.concatenate(out)
    a = loud(a)
    if p.get('gain'):
        a = a * 10 ** (p['gain'] / 20)
    return a


def encode_mp3(a, path, bitrate=BITRATE):
    raw = np.clip(a, -1, 1).astype('<f4').tobytes()
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', bitrate,
         '-ar', str(SR), '-ac', '1', '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', path], raw)


# ---------------------------------------------------------------------------------------------------------
# реплики из исходников
# ---------------------------------------------------------------------------------------------------------
def parts_text(parts):
    return ''.join(x if isinstance(x, str) else ('{name}' if x['s'] == 'name' else '{*}') for x in parts)


def split_text(t):
    return [({'s': 'name'} if x == '{name}' else {'s': '*'} if x == '{*}' else x) for x in re.split(r'(\{name\}|\{\*\})', t) if x]


def ensure_acorn():
    """tools/voice_lines.js разбирает исходники через acorn из tools/node_modules; в свежей копии исходников
    (без node_modules) ставим закреплённую версию один раз."""
    if os.path.isdir(os.path.join(TOOLS, 'node_modules', 'acorn')):
        return
    print('  ставлю acorn@8.19.0 в tools/node_modules (один раз)…')
    r = subprocess.run(['npm', 'install', '--prefix', TOOLS, '--no-save', '--no-package-lock', '--no-audit', '--no-fund', 'acorn@8.19.0'], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('npm install acorn не удался:\n' + r.stderr[-2000:])


# Волна 4: реплики модулей гор, которые разбор исходников не разворачивает — свадьба (wedding.js: L('who', 'текст', 'нейтрально')),
# каз (kaz.js: { text, n } — говорит мышка-вышивальщица, кроме строк героини), отель (hotel.js: LINES/EVENTS — для надёжности).
# Модули — обычные IIFE без DOM при загрузке: node выполняет их в песочнице (vm) и читает таблицы VILLAGE.*.
# Строки героини (who: 'hero', kaz 'heroOn'/'giveBack' — тост) не озвучиваются.
MODULE_SRC = ['js/village/lines.js', 'js/village/wedding.js', 'js/village/kaz.js', 'js/village/hotel.js', 'js/village/bazaar.js']
MODULE_JS = r'''
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = process.argv[1], files = process.argv.slice(2);   // node -e: argv[1] — первый аргумент
const win = { VILLAGE: {} }; const ctx = vm.createContext({ window: win, console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, Object, Array, Set, Map, Float32Array, Uint8Array, Uint16Array, Uint32Array, Int32Array, Float64Array, performance: { now: () => 0 } });
const out = [], ok = [];
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); ok.push(f); } catch (e) { process.stderr.write('module_lines: ' + f + ': ' + e.message + '\n'); } }
const V = win.VILLAGE;
const put = (l, src) => { if (!l || typeof l !== 'object') return; if (l.who && l.text && l.who !== 'hero') out.push({ who: l.who, text: l.text, src }); if (l.n && typeof l.n === 'object') put(l.n, src); };
const walk = (o, src, d = 0) => { if (!o || d > 3) return; if (Array.isArray(o)) o.forEach(x => walk(x, src, d + 1)); else if (typeof o === 'object') { if (o.who && o.text) put(o, src); else Object.values(o).forEach(x => walk(x, src, d + 1)); } };
if (V.wedding) { walk(V.wedding.LINES, 'js/village/wedding.js'); walk(V.wedding.EVENTS, 'js/village/wedding.js'); }
if (V.hotel) { walk(V.hotel.LINES, 'js/village/hotel.js'); walk(V.hotel.EVENTS, 'js/village/hotel.js'); }
if (V.kaz && V.kaz.lines) ['offer', 'pattern', 'fringe', 'careful'].forEach(k => { const l = V.kaz.lines[k]; if (!l) return; [l.text, l.n].filter(Boolean).forEach(t => out.push({ who: 'mouse', text: t, src: 'js/village/kaz.js' })); });
if (V.LINES_SRC) walk(V.LINES_SRC, 'js/village/lines.js');
if (V.EVENTS_SRC) walk(V.EVENTS_SRC, 'js/village/lines.js');
process.stdout.write(JSON.stringify({ ok, lines: out }));
'''


def module_lines():
    try:
        r = subprocess.run(['node', '-e', MODULE_JS, ROOT] + MODULE_SRC, capture_output=True, text=True, timeout=120)
    except Exception as e:
        print('  ⚠ module_lines:', e); return []
    if r.stderr.strip():
        print('  ⚠', r.stderr.strip()[:400])
    try:
        d = json.loads(r.stdout or '{}')
    except Exception:
        return []
    return [{'who': x['who'], 'parts': split_text(x['text']), 'src': x['src'], 'kind': 'module'} for x in d.get('lines', [])]


def collect():
    ensure_acorn()
    js = run(['node', os.path.join(TOOLS, 'voice_lines.js')])
    L = json.loads(js.decode('utf-8'))
    L.extend(module_lines())
    try:
        with open(HARVEST, encoding='utf-8') as f:
            for h in json.load(f):
                if h.get('who') and h.get('text'):
                    L.append({'who': h['who'], 'parts': split_text(h['text']), 'src': 'harvest', 'kind': 'harvest'})
    except FileNotFoundError:
        pass
    uniq = {}
    for x in L:
        t = norm(parts_text(x['parts']))
        if not re.search('[A-Za-zА-Яа-яЁё]', re.sub(r'\{name\}|\{\*\}', '', t)):
            continue
        k = (x['who'], t)
        if k not in uniq:
            uniq[k] = {'who': x['who'], 'text': t, 'parts': split_text(t), 'src': [x['src']], 'kind': x['kind']}
        elif x['src'] not in uniq[k]['src']:
            uniq[k]['src'].append(x['src'])
    return list(uniq.values())


def cache_name(item, p):
    return hashlib.sha1((sig(p) + '|' + item['who'] + '|' + item['text']).encode('utf-8')).hexdigest()[:20] + '.mp3'


def job(item, p, outdir, seed):
    """→ (файл, длительность, байт) или исключение."""
    name = file_name(item['who'], item['text'], p, seed)
    dst = os.path.join(outdir, name)
    cached = os.path.join(CACHE, cache_name(item, p))
    if not os.path.exists(cached):
        with tempfile.TemporaryDirectory(prefix='vb_') as tmp:
            a = render(item['parts'], p, tmp)
            if not len(a):
                return None
            encode_mp3(a, cached + '.tmp.mp3')
            os.replace(cached + '.tmp.mp3', cached)
            with open(cached + '.json', 'w') as f:
                json.dump({'d': round(len(a) / SR, 2)}, f)
    if os.path.abspath(dst) != os.path.abspath(cached):
        shutil.copyfile(cached, dst)
    try:
        d = json.load(open(cached + '.json'))['d']
    except Exception:
        d = 0
    return name, d, os.path.getsize(dst)


def build(args):
    pick = load_pick()
    items = collect()
    only = set(w for x in args.only.split(',') if x for w in SPEAKER_GROUPS.get(x, [x])) if args.only else None
    os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    plan, skipped = [], {}
    for it in items:
        p = preset_for(it['who'], pick, lang_of(it['text']))
        if not p:
            skipped[it['who']] = skipped.get(it['who'], 0) + 1
            continue
        plan.append((it, p))
    print(f'реплик: {len(items)}, к озвучке: {len(plan)}, символов: {sum(len(it["text"]) for it, _ in plan)}')
    if skipped:
        print('  ⚠ нет пресета (останется «лепет»):', ', '.join(f'{k} ({v})' for k, v in sorted(skipped.items())))
    if args.dry:
        by = {}
        for it, p in plan:
            by.setdefault(it['who'], []).append(it)
        for w, l in sorted(by.items(), key=lambda kv: -len(kv[1])):
            print(f'  {w:10s} {len(l):4d} реплик, {sum(len(x["text"]) for x in l):6d} симв.  [{preset_for(w, pick)["voice"]}]')
        return
    if only:   # переозвучка героев: их кэш сбрасывается
        for it, p in plan:
            if it['who'] in only:
                n = cache_name(it, p)
                for ext in ('', '.json'):
                    try: os.remove(os.path.join(CACHE, n + ext))
                    except FileNotFoundError: pass
    t0 = time.time()
    seed = pick_seed(plan)
    man = {'v': 1, 'seed': seed, 'fmt': 'mp3', 'sr': SR, 'lufs': LUFS, 'lines': {}, 'pats': {}, 'cast': {}}
    keys = {}
    res = {}
    with cf.ThreadPoolExecutor(max_workers=args.jobs) as ex:
        futs = {ex.submit(job, it, p, OUT, seed): (it, p) for it, p in plan}
        done = 0
        for f in cf.as_completed(futs):
            it, p = futs[f]
            done += 1
            try:
                r = f.result()
            except Exception as e:
                print('  ✗', it['who'], it['text'][:50], e, file=sys.stderr); continue
            if r:
                res[(it['who'], it['text'])] = r
            if done % 100 == 0:
                print(f'  … {done}/{len(plan)} ({time.time() - t0:.0f} с)')
    total = 0
    for it, p in plan:
        r = res.get((it['who'], it['text']))
        if not r:
            continue
        name, d, size = r
        total += size
        k = line_key(it['who'], it['text'], seed)
        if '{*}' in it['text']:
            man['pats'].setdefault(it['who'], []).append([it['text'].split('{*}'), name, d])
            continue
        if k in keys and keys[k] != (it['who'], it['text']):
            sys.exit(f'Коллизия ключа {k}: {keys[k]} / {(it["who"], it["text"])}')
        keys[k] = (it['who'], it['text'])
        man['lines'][k] = [name, d]
    for w in sorted({it['who'] for it, _ in plan}):
        p = preset_for(w, pick)
        man['cast'][w] = p['id']
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, separators=(',', ':'))
    # лишние файлы (старые пресеты) — прочь
    keep = {v[0] for v in man['lines'].values()} | {x[1] for l in man['pats'].values() for x in l} | {'manifest.json'}
    gone = 0
    for fn in os.listdir(OUT):
        if fn not in keep:
            os.remove(os.path.join(OUT, fn)); gone += 1
    # кэш: только то, что нужно нынешнему кастингу (старые пресеты — прочь)
    used = {cache_name(it, p) for it, p in plan}
    for fn in os.listdir(CACHE):
        base = fn[:-5] if fn.endswith('.json') else fn
        if base not in used and fn != 'last_build.json':
            os.remove(os.path.join(CACHE, fn))
    msize = os.path.getsize(os.path.join(OUT, 'manifest.json'))
    dur = sum(v[1] for v in man['lines'].values()) + sum(x[2] for l in man['pats'].values() for x in l)
    print(f'готово за {time.time() - t0:.0f} с: {len(man["lines"])} реплик + {sum(len(l) for l in man["pats"].values())} шаблонов, '
          f'{dur / 60:.1f} мин звука, {total / 1048576:.2f} МБ mp3 + манифест {msize / 1024:.0f} КБ; удалено старых: {gone}')
    with open(os.path.join(CACHE, 'last_build.json'), 'w', encoding='utf-8') as f:
        json.dump({'lines': len(man['lines']), 'pats': sum(len(l) for l in man['pats'].values()), 'bytes': total, 'manifest': msize,
                   'minutes': round(dur / 60, 1), 'skipped': skipped,
                   'by_speaker': {w: sum(1 for it, _ in plan if it['who'] == w) for w in man['cast']}}, f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------------------------------------------------
# страница кастинга
# ---------------------------------------------------------------------------------------------------------
def casting(path, jobs):
    items = []
    for g in CASTING_ORDER:
        c = CAST[g]
        for oid, p0 in c['opts'].items():
            p = dict(p0); p['id'] = oid
            items.append((g, oid, p, c['line']))

    def one(a):
        g, oid, p, lines = a
        with tempfile.TemporaryDirectory(prefix='vc_') as tmp:
            chunks = []
            for t in lines:
                x = render(split_text(t), p, tmp)
                if len(x):
                    chunks += [x, np.zeros(int(SR * 0.45), np.float32)]
            a = np.concatenate(chunks[:-1])
            f = os.path.join(tmp, 'o.mp3')
            encode_mp3(a, f, '48k')
            return g, oid, base64.b64encode(open(f, 'rb').read()).decode(), round(len(a) / SR, 1)
    with cf.ThreadPoolExecutor(max_workers=jobs) as ex:
        got = {(g, oid): (b, d) for g, oid, b, d in ex.map(one, items)}
    pick = load_pick()
    E = html.escape
    cards = []
    for g in CASTING_ORDER:
        c = CAST[g]
        cur = pick.get(g, c['rec'])
        rows = []
        for oid, p in c['opts'].items():
            b, d = got[(g, oid)]
            tech = f"{p['voice']}, {p['pitch']:+g} тон., темп ×{p['tempo']:g}" + (f", интонация ×{p['range']:g}" if p['range'] != 1 else '') + \
                   (f", форманты ×{p['formant']:g}" if p['formant'] != 1 else '') + (f", {' + '.join(p['fx'])}" if p['fx'] else '')
            rows.append(f'''<label class="opt{' rec' if oid == c['rec'] else ''}"><input type="radio" name="{g}" value="{oid}"{' checked' if oid == cur else ''}>
<span class="oid">{oid}</span><span class="txt"><b>{E(p['note'].split(':')[0])}</b>{E(':' + p['note'].split(':', 1)[1]) if ':' in p['note'] else ''}{'<em>★ рекомендую</em>' if oid == c['rec'] else ''}<small>{E(tech)} · {d} с</small></span>
<button type="button" class="play" data-src="data:audio/mpeg;base64,{b}" aria-label="Слушать {oid}">▶</button></label>''')
        lines = ' / '.join(c['line']).replace('{name}', '[имя]')
        cards.append(f'''<section class="card"><h2>{E(c['label'])}</h2><p class="who">{E(c['who'])}</p><p class="line">«{E(lines)}»</p>{''.join(rows)}</section>''')
    page = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Кастинг голосов</title><style>
:root{{--bg:#FFF4EC;--card:#fff;--ink:#3A2E3F;--mut:#8A7A86;--acc:#C2405B;--soft:#FBE1E7;--line:#F1DCCF}}
@media (prefers-color-scheme:dark){{:root{{--bg:#221C24;--card:#2F2731;--ink:#F6ECEF;--mut:#B9A9B4;--acc:#F08FA8;--soft:#4A3240;--line:#46394A}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}}
main{{max-width:760px;margin:0 auto;padding:18px 16px 120px}}h1{{font-size:24px;margin:6px 0 4px}}.lead{{color:var(--mut);margin:0 0 16px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 14px 8px;margin:14px 0}}
h2{{font-size:18px;margin:0}}.who{{margin:2px 0 6px;color:var(--mut)}}.line{{margin:0 0 10px;font-style:italic}}
.opt{{display:flex;align-items:center;gap:10px;padding:9px 6px;border-top:1px solid var(--line);cursor:pointer}}
.opt input{{accent-color:var(--acc);width:18px;height:18px;flex:none}}.oid{{font-weight:800;min-width:30px}}
.txt{{flex:1;min-width:0}}.txt small{{display:block;color:var(--mut);font-size:12px;overflow-wrap:anywhere}}
.txt em{{font-style:normal;color:var(--acc);font-weight:800;margin-left:6px;font-size:13px}}
.rec{{background:var(--soft);border-radius:12px}}
.play{{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--acc);color:#fff;font-size:17px;cursor:pointer}}
.play.on{{background:var(--ink)}}
.bar{{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}}
.bar div{{max-width:760px;margin:0 auto;display:flex;gap:10px;align-items:center}}
.bar button{{border:0;border-radius:14px;background:var(--acc);color:#fff;font-weight:800;padding:12px 16px;font-size:15px;cursor:pointer}}
.bar code{{flex:1;min-width:0;font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
</style></head><body><main>
<h1>Кастинг голосов</h1>
<p class="lead">Для автора. У каждого героя — варианты голоса, они говорят настоящую реплику из игры. ★ — мой выбор по умолчанию.
Отметь, что нравится, и нажми «Скопировать выбор»: этот текст кладётся в <b>tools/voice_pick.json</b>, потом <b>python3 tools/voice_build.py</b>.
Имя героини голосом не звучит нигде — на его месте мягкое «мм-м». Синтез — RHVoice, без интернета.</p>
{''.join(cards)}
</main><div class="bar"><div><code id="out"></code><button id="copy" type="button">Скопировать выбор</button></div></div>
<script>
(function(){{
  var au=new Audio(), cur=null;
  document.querySelectorAll('.play').forEach(function(b){{b.addEventListener('click',function(e){{
    e.preventDefault(); e.stopPropagation();
    if(cur===b&&!au.paused){{au.pause();b.classList.remove('on');b.textContent='▶';return;}}
    if(cur){{cur.classList.remove('on');cur.textContent='▶';}}
    cur=b; au.src=b.dataset.src; au.play(); b.classList.add('on'); b.textContent='■';
    var r=b.closest('.opt').querySelector('input'); if(r) {{r.checked=true; upd();}}
  }});}});
  au.addEventListener('ended',function(){{if(cur){{cur.classList.remove('on');cur.textContent='▶';}}}});
  function val(){{var o={{}};document.querySelectorAll('input[type=radio]:checked').forEach(function(r){{o[r.name]=r.value;}});return JSON.stringify(o);}}
  function upd(){{document.getElementById('out').textContent=val();}}
  document.querySelectorAll('input[type=radio]').forEach(function(r){{r.addEventListener('change',upd);}}); upd();
  document.getElementById('copy').addEventListener('click',function(){{
    var t=val(), b=this;
    function ok(){{b.textContent='Скопировано';setTimeout(function(){{b.textContent='Скопировать выбор';}},1600);}}
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok,function(){{prompt('Скопируй:',t);}});
    else prompt('Скопируй:',t);
  }});
}})();
</script></body></html>'''
    with open(path, 'w', encoding='utf-8') as f:
        f.write(page)
    print(f'кастинг: {path} — {len(items)} вариантов, {os.path.getsize(path) / 1048576:.2f} МБ')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--jobs', type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument('--casting', default='')
    a = ap.parse_args()
    for tool in ('RHVoice-test', 'ffmpeg', 'node'):
        if not shutil.which(tool):
            sys.exit(f'нет {tool} — озвучка собирается только там, где он установлен (игра без папки voice/ работает с «лепетом»)')
    if a.casting:
        casting(a.casting, a.jobs)
    else:
        build(a)


if __name__ == '__main__':
    main()
