// волна «комбинат»: вывеска Кубачинского художественного комбината — постоянная композитная панель вместо
// временного баннера с фото (ref/exterior.png). Как на баннере: белое поле, плотная синяя кубачинская рамка —
// четыре Г-образных поля растительного орнамента, между ними поле выходит к краю стрельчатыми арками (сверху по
// центру — «гребень» арки с навершием), в углах — медальоны-розетки. По центру — эмблема с ref/logo.png: розетка
// из четырёх завитков-«облаков» со светлой заливкой и лавандовой тенью, по бокам «ОСН.» и «1960», крупно
// «Кубачинский» (контрастная антиква с размашистыми выносными), ниже вразрядку «ХУДОЖЕСТВЕННЫЙ КОМБИНАТ».
// Всё — векторные пути на canvas, системные шрифты не используются:
//  · розетка и слово «Кубачинский» — свои контуры, снятые с logo.png (субпиксельная трассировка увеличенной
//    альфы, упрощение Дугласа—Пекера ≤ 0,05…0,1 px исходника; ROS/WORD ниже, упакованы приращениями base64);
//  · прописные («ХУДОЖЕСТВЕННЫЙ КОМБИНАТ», «ОСН.», «1960», запасной шрифт табличек) — свой штриховой
//    гуманистический гротеск: вся кириллица, цифры, знаки (CAPS).
// Таблички дверей — шрифт игры 'Nunito' (css/fonts.css); пока он не загружен — свои прописные, а после загрузки
// табличка перерисовывается в тот же холст и зовёт opts.onUpdate(canvas) (вызывающий ставит texture.needsUpdate).
//
// kombinatSignCanvas(opts) → HTMLCanvasElement
//   opts.kind     'facade' (по умолчанию) | 'emblem' | 'plaque'
//   opts.width    ширина холста: facade 2048, emblem 512, plaque 512 (по умолчанию)
//   opts.height   высота: facade 640 (панель 3,2 : 1), emblem = ширине, plaque 160 (3,2 : 1).
//                 Фасад не растягивается: масштаб задаёт высота, рамка удлиняется по ширине, середина та же
//                 (разумно 2,6 : 1 … 4,5 : 1; уже — середина ужимается целиком)
//   opts.night    facade: ночной «лайтбокс» — поле светится тёплым белым, рамка и буквы остаются чёткими
//   opts.named    false — нейтральная сборка (VILLAGE.named = false): без слова «Кубачинский» —
//                 эмблема, «ОСН.»/«1960» и крупнее «ХУДОЖЕСТВЕННЫЙ КОМБИНАТ»
//   opts.text     plaque: короткий текст таблички («Музей», «Цех гравировки»…)
//   opts.style    emblem: 'silver' (по умолчанию: светлое серебро, лавандовая тень и синий контур — для светлой
//                 стены), 'light' (как на logo.png — для тёмного фона), 'ink' (сплошной синий), 'medal' (на синем
//                 круге с латунным ободком — для калитки/стенда)
//   opts.font     plaque: 'auto' (по умолчанию: Nunito, если уже загружен, иначе свои прописные и перерисовка
//                 после загрузки), 'vector' (всегда свои прописные)
//   opts.onUpdate plaque: колбэк(canvas) после перерисовки шрифтом Nunito
//   opts.canvas   готовый canvas (иначе создаётся новый)
// kombinatSignCanvas.layout — размеры по умолчанию, соотношения сторон, места частей фасада (в долях холста)
(function (root) {
  'use strict';

  var BH = 640, BW = 2048;                // базовая сетка фасада: высота 640 = масштаб 1
  var DAY = {
    bg: '#f8f6ef', ink: '#1b2a6b', orn: '#24419d', line: '#1c3184', frame: '#1c3184',
    silver: ['#ffffff', '#d3d8ea'], lav: '#98a3d8', edge: '#22337c', glow: null
  };
  var NIGHT = {   // лайтбокс: светится поле (и белое между орнаментом), синее — плёнка поверх, чуть глубже тоном
    bg: '#fff4dc', ink: '#17225a', orn: '#1f3b95', line: '#182b78', frame: '#16276f',
    silver: ['#fffdf6', '#ece8e6'], lav: '#9da6d9', edge: '#1d2c72', glow: ['#fffdf5', '#fff4de', '#fae6c2']
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var r = Math.imul(seed ^ seed >>> 15, 1 | seed);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- контуры с logo.png ----------
  // строка = контуры через пробел; контур = первая точка (x, y по 3 знака base64, смещение 131072),
  // дальше приращения (по 2 знака, смещение 2048). WORD: высота «К» = 1000, y вниз, 0 — базовая линия,
  // x от левого края слова (ширина 9323). ROS: центр розетки (0, 0), самый дальний кончик «облака» = 1000, y вниз;
  // четыре «облака» по часовой от левого.
  var WORD =
    'gFZf/+a+gCfzf5f0fnf/f1gGf6ghf4ggfygYfugRfigEfOgBV6f9fMf7frfuflfofwfFfrf5f7gAfzgMfogIf6kef/gMgFgNgPgAgJfYg8fv' +
    'gnfvhWf9g5gAo6gFgjgQglgQgPgcgPgggIgJgHgDgLf8gPf7gL gNfgAPfNgEfMf7fXftfmfsfqfpftfnfvfjfFeOfdfKfMe+fafXeqe6flf' +
    'wfof3ftf1f3fygBfxgMf0gPf5gff9gPf3kebogRfkgGfQf6fdfpfVgDf6gJf3gPf4jagAgLgDgGgGgIgTgBgKf8gHf6gEfFgVflgSfpgVbpl' +
    'if2gQf+gJgGgGgegHgjgRgXgUgfgigSgcgZgwiKjwgWgigVgRgNgFgYf/gcf0gLgDgLgKgFgRf5gPfmgTffgQ gSHgAMfOfcfqftfyfvf8f3' +
    'gAf3gQfogMf8gPgCgrgegjgRg8gRgjgDgtf+hBfvgcfvgOfzgmfPgSfYgHfMf/ftf7f5f4gBfxgUfsgUfrgQffgPfvgGfTgGfbgAfFf4fUfv' +
    'fffsfZfffrfnftfffwfVf7fXgAdaf8fsf5f4f2f7fMf/fzf8f4f4f7f1f/f2gEf3gZfqgefsgjfvgtfxgWf8gcgAgLgDgNgKgJgNgCgUgCj5' +
    'gRhPgRgfgRgTgfgUgPgEgagDgxf+gUf8ggfvgdfmgQfrgQfdgQe7gEfXf+enf7fgf0fSfyfxfqf3f4f5f6f0gDfzgJf2gNf+iGf/gRgEgGgH' +
    'gBgJgAm5f0hffwgvfughfagvfQglfbgTfPgPfFgFe7f+fAfu gfQf/6fXfvfifufVfffpfpfdfQfvfiftfVfvfKfweWf+fIgCe2gRd8gQe5g' +
    'SfKgje2gjfKgzfKgWfugcfugpfthBfwgxf9h3gEg0f6gJf8gVfugefSgJf7gJgAgLgJgPgegGgnf6guf8gMfugafygNfngPfrgGfHgEezf6e' +
    '0fxfDf+fPgDfxgFflgQfugWftglfug8fxhsf8hSgBgKgFgGgEgBgGf9gYfhgjfegVfvgjftgrfwgWf9hDf+g0gGgxgQgngTgtghgfgfgjgxg' +
    'RgigSg2gFghgDhDf8hHf8gafxg0ftgrfvgeftgafkgefXghffgTfYgSfFgNfSgEfXf/ gg0f+/g4f5gjftgbfrghfZgTffgSfRgOe4gDfKf8' +
    'fVfxe7fufVfffOfpfqfifrfUfxfRf8fdgEfTgSfkgUffglfsgjfvgyf4hBf+gzgKhogSg2gTgmgegmgbgWgigR gzbf/KfegefngSfbgSfXg' +
    'GfVf9fzf8fqfwftflf6fuf3fIf7f9fxgHfXgtfXgifhgTfSgRe/gGfHf7fTfvfffrfZfcfcfKftfUfwfGf9fmf9ehgGeugRfBgRfXgmfEg0f' +
    'KgzfegsfthFfvg+f9hDgCg/gMg4gHgsgJgtgEgJgEgGgJgBgNfrgkf6glgCnRgDgNgFgIgKgGgRgGgRf+gYf6gYf2gNgCgJgJgGgNgAgK gs' +
    'If+ngggCggf9g0ftgcfugbfogjfVgLfogCaZf5fzf3f2fSfqfPf2fff/fmgCfPgMfdgUfqgTfrgafsgffvgrfwhSf+hDgDgwgPhMgRgpgfgn' +
    'gZgVgcgN g/If/4f4gGf1gCbpgAfxf6f2fogAf3gDf6gLf6gef6gafygSfvgGf1gJe9gAeef+fxf7f8f2gBfhgSfcgRfHgPfCgFfMf9fIfxf' +
    'dfuftfwfsfrfwfkfwfFf8fif9dTf8fzfxfifofff/f2gHf1gQf5hufygcf/gOgHgDgKgAj1gIg4gXgighgWgXgGgtgEhFf5gufvggfqgLfqf' +
    '/dvf4fKf7f3ftftfefvfof5f3f7f9f6gAf4gKfogPf6j0gAgPgCgLgGgFgJgAgKflgnfugjfwg0f8gYf9g8gBk+gEgigSgcgdgSgjgKgKgHg' +
    'DgR hN0f/1f2gIfwgDbsgAf1f9f5f6f7frgDfygJf6gef4gifsgOfvgMfdgDfcgAcDf+fyf5f8fvgKbckSfvgUf+gOgNgggGgKgYgSgkgLgL' +
    'gJgDgJgAgIf1gQfvgGbpgAfyf8f6f3f8fzf/f3gDf4gLf5gcf4gdfxgTfsgGfxgHfDgAavf+fVf3fRfofmfifxfmf5f3f7f9fygKfogGf8gJ' +
    'f+j0gAgTgDgKgJgDgJf+gJfmgkftglfthDf9hBf/i8gCgPgIgFgJf8k1bXgEfxf9fsftfifhftfjf2f3f5gAfugJftgNf8jygAgRgCgJgEgG' +
    'gLgAgNfjgrfuglfuhLf9g0gBlCgFgegRgcgegSghgJgLgIgFgP hcOf/6f4gEbjgCfzf9f4f4f5fzf+f1gEf3gJf6gef5gefxgUftgGf1gHf' +
    'cgCfkgAeNf8frf3f6f1f/bagAfzgEf8gPf/iRgDghgOgcgJgLgbgPgggJgLgHgFgQf7gQf1gHfxgDbugAfxf7f6f4f9fzgCfvgJf5gef4ggf' +
    'ugQfugMfcgDfNgAa7f+fKfzfZfqfqfifwfmf5f4f8f8f5gEfogFf4gHf7j5f/gRgCgLgGgEgJgAgKfjgpfvgjfuhFf9gyf/hBgFgOgNgFkmg' +
    'AgNf9gJf2gDfxf/eJf2fGf7f3fsfsfefwfkf5f5f8f8fzgHfugKf1gNf9j0gAgLgCgJgFgHgKgAgKfoghfvggfvgwf9gTf7hfgAkkgEgpgEg' +
    'NgVgXgVgMgcgIgLgHgGgP hklf/7fDgEezf9ezfufUfuflfwfnfsfVfUfsfmfwfjftfXfue/f7esgFengTe7gRfbgRfkglfQgnfegcfugrft' +
    'hBfwggf8hSf+g/gGgygQgggSgWgRgiglgUgngGgrf+glf8gXfvgffqgYfogQfOgOfkf/f4f6f9f3gCfzgOfpgOfKf/fUf0fcfwfpfsfufZft' +
    'fkf8fTgBe/gVfkgSfhgeftgefugsfuhhf/g8gEgsgPhDgRgpgVgggcgdgbgTgngRg+gNgdgDglf+g9fygnfugrfigTf3gJgBgLgGgOgSgDgP' +
    'f3gOfegifmgUfmgQfbgS huff/+bggCfvf8f2f1f9fvgGfygJf7gaf6ggfwgVfogHfsgDfVgBacf8fDf6fvfsfofbftfmf5f4f7f8f2gCfxg' +
    'Gf1gJf7gPf9j0gAgNgEgIgKgAgQfdg4fugtf3g/f8hLgAkPgIgzgJgTgLgKgXgPgjgKgKgJgDgJf+gNf8gL h0BgANfOgGfOf7fcfufsfvfk' +
    'fifrfleSdGfxftfhfofkfzf0fvgAfzgHf0gJf8gaf8gLf5h2dwgSfmgGfrgDfbf6fZf2fogKfxgMf3jNf/gSgEgIgNgDgTf7gLfdgKfggQfn' +
    'gTfugUdRjaf+gGgFgLg1glgWgWgigzheiagSgVgLgGgPgCgWf9gWf2gKgGgLgVf/gNfngU iC2f/6f5gFbjgBfuf8f2f1f8fvgGfzgIf7gcf' +
    '5ghfvgTfrgGfxgFfIgBcDf9f0f3f8f4gEbJknf9gLgDgVgRgcgXgSghgJgLgKgCgUf5gPfvgEbwgAfxf+f2f8f7f4f9f0gAf1gEf4gJf7gcf' +
    '4ghfugQftgKfogDfZgAaVf9fMf2fpf1fwf0f3fifwfmf5f5f8f9f5gBfrgFf3gIf7gQf9j0gAgNgDgIgJgDgJf/gJfdg2fugrf0hDf8g6gAi' +
    'xgBgJgGgEgWf0kkbrgMfxgDf3f/f3fyfif4f1fefqfkf4f3f6f+f3gAf1gLfvgJf8gLf+j0gAgRgGgHgLgAgKfZhBfvgrf8gSf7g4f+g2gAk' +
    'fgHgsgMgTgggWghgJgMgKgDgN iRff/5f5gFf2gCbpgAfzf8f3f1f7fvgFfzgJf7gcf4gffxgTfsgGfxgGfigCfhgAcIf+fzf4f7fxgHbckT' +
    'fvgTf9gLgDgPgSgggZgTghgJgLgJgCgPf3gUfzgEbpgAf2f+f3f8f1fugAf1gDf4gJf5gdf5ghfvgTfpgGfvgEfBgAazf9fEf7fqfofkfgfv' +
    'fkf5f5f8f8f5gAf1gHfvgKf5gLf9j3gAgOgEgKgKgCgNfoghfuggfsg7f6hSf+i6gDgQgIgEgPf4kxbdgEf1f+fzfrfafffrfif4f4f6f9f3' +
    'gCf3gLfsgPf7j0gAgNgCgJgFgHgKgAgKfnglftgjfwgxf8gSf9hQgAkwgFgsgQgXgcgSgjgJgNgKgCgP iOtfyOftgsftgTfigUfIgTe2gIf' +
    'Vf/euf2fXfwfmfufvfwfufnf7fof/fkgHfegPfqgNfzgKf5gcf0gSf9gNgCgNgHgFgLf/gLfygcf9gngFgcgQgVgcgRgSgEg6gCgnf8glftg' +
    'UfkgEfvf/fifyfbf/fxgCf3gHf5gIf9gPf/gOgDgegNgZgXgRgngCgW';
  var ROS =
    'f0KgFbf8f9f8f4f3f4f7f5fwfpf7f2f6f3f7f1f6f4f6fxf7f3f7fyf5fzf7fvf6fyf6fqf6fuf8flf5fdf+fwgAfYgAffgBfbgDfsgFftgE' +
    'fmgHfqgFfrgHfxgEfxgHf0gFfxgFf2gFf0gHf2gGfzgFf5gFf3gHf2gEf4gMfwgWfkgNfxgXfogNf0gafqgefpgKf7gIf6gKf7gIf6gNf6gI' +
    'f6gJf7gPf1gNf1gUfsgMfxgLfvgFf2gGf3gFfxgGf0gFfogFfvgDfxgAftgAfqf+fuf6ftf8frf5fyf7fyf2fuf8f4gBf8gCf+gMgCgHgCgL' +
    'gGgOgEgLgIgIgDgigXglgigGgJgQgSgFgJgFgHgHgLgGgIgFgMgHgLgEgOgGgNgEgVgFgMgDgIgCgXgBgggAgRf/gkf9gSf5gRf8gTf6gPf8' +
    'gNf5gLf7gMf5gJf8gKf5gIfvgYfpgYfygNfpgRf3gGf3gFf3gGf1gFf4gGfugFf9gDgAgDgDgDgEgCgagBgQgFgbgFgPgIgNgEgLgGgKgFgS' +
    'gNgWgUgSgTgMgQgFgKgHgKgFgNgGgLgEgQgHgTgDgPgAglgAgQf9gcf0glf7gKf7gOf6gIf5gLf2gOfygQfpgVfwgMf0gHf3gFf0gFf2gGfc' +
    'gLf2gCfrgBfogBfpf+fyf/f2f9fwf7f9f9f+f+gAf8gBf+gIf3gMfqgKfmgBf0gBfyf+fpf2fhf0fsf1f0f5f4fzf1fsf0fbf1f0f+fwgBfW' +
    'gMftgLfxgMfxgSfygUf8gPf7gMf+gIf4hCgBgSgCgVgFgigCgKgFgMgFgSgIgOgEgOgGgHgBgEgBgGf+gC f6qf0MgDf9gGf7gFf5gJf7gFf' +
    '6gPf0ggfrgLf7gJf5gLf8gKf5gOf7gLf6gNf8gOf5gQf7gRf5gUf8gaf5g/f3gZf+gngAgYgChDgJgLgCgPgFgVgEgQgHgSgEgOgIgPgFgKg' +
    'FgOgGgIgFgNgGgIgGgIgEgMgHgIgFgQgKgrgjgYgXgXgYgWgagWgggFgKgIgKgFgKgLgPgWgXgNgMgQgLgKgGgKgGgKgEgMgHgPgEgMgFgLg' +
    'EgsgEgZgAguf7gRf4gPf8gLf6gOf6gYfwgDgAgCgDgAgIf/gJf5gMf8gOf4gNf9gLf5gKf7gJfoghf1gOfygMfjgafygLf2gEf4gHf0gFf3g' +
    'FfxgFf0gHfugFf1gEfrgEfOgFf0gBfqf+fTf7fvf5ftf8fxf4f0f8f2f6f2f7f2f5f4f9fvf0fxfzfofpfvftf0fxf2fxf1ftf7fxf+f+f9f' +
    '+f9gCf+gFf+gff5gaf+gSf4gQf7gPf6gJf8gLfzgRfqgbfygMfygMf3gEf2gIf2gEf0gHfzgEfygGf6gCfsgCfvgEfmgCfGf4f5f9f1f7fwf' +
    '7f2f6f0f7fwf1fxf0fsftf0fyf1fxf7f3f6f2f7f0f6f1f7fuf5fsf/fzf+fggAfugCfrgCf0gDf3gCf8gGf+gFgBgVgOgFgCgfgKgMgBgOg' +
    'AgQf+gff2gUf0gPf0gPfwgMftgEfygFf0gCf3gCfvf/fmf9f3f2fif1fvf0fzfyfzfvf2f7f8fnf3f2f+fTf8fhgAfggDfsgCfrgIftgEfzg' +
    'HfxgFf3gHf2gDf3gHf8gAf9f/ gHrgMnf5f9fzf6f1f8f1f4f3f9f2f4f2f7fzf2frftfyf2f5f0fvfrfofdf6fyf7f2f8fyf5fyf8fsf6fu' +
    'f+f4f+fpf/fmgCfLgBf5gHfsgEfsgHfxgGfvgFf3gFf0gIf1gEf3gLfwgNfvgXfngffngQf1gIf8gLf4gLf8gJf6gRf7gDf9gAf9f+f+f8f+' +
    'fff+fof5fuf9fyf4f0f8f1f6f3f7fufzfzf1f3f3fsfrf1fyf7f2f6f3f7fyf6f2f9f6f9fvf5fuf/f2gAfmgAfcgBfzgHfugFfqgGf2gFfy' +
    'gGf3gGf2gXfjgNfzgQfzgOf0gOf6gIf6gMf8gLf5gXf7gSf6gLf/gZf/gigBgLgBgSgGgJgCgGgDgBgCgBgEf+gCf3gMf1gTf1gjf/gKgAgM' +
    'gBgQgGgQgFgRgLgUgMgOgTgSgUgLgjgMgPgBgXf/glf0gSf1gQfzgNfxgMftgMfkgHfLgDfof+flf8fof9fqf+f2f5fvf7fuf6f2f7fyf6f4' +
    'f/f5gCf+gCgAgEgDgEgHgHgHgGgJgGgHgKgQgFgJgFgIgGgLgHgKgFgNgGgKgFgOgFgLgFgQgHgOgEgTgIgSgDgYgGgZgCgQgDgsgBgff8hC' +
    'f9gTf7gTf9gZf4gTf8gTf5gOf7gQf7gMf7gNf5gMf8gMf5gJf7gLfvgbf7gIffgrfdgmfngXfTgjf3gFf5gFf2gFf2gHf1gEf3gHf2gGfygK' +
    'fygLfrgXf1gOf7gIf5gIf7gMf7gIf6gRf8gJf8gHf4gsf+gZgAgSgDgTgIgngDgFgFgKgFgOgLgVgEgIf/gDf+gC gFagLyf9gGf6gEf6gHf' +
    'vgNfUgefzgGf2gHf1gEf2gHfzgFf1gFfwgFfygIftgEfwgHfogEflgHexgHfggAewf4fmf5fqf9fvf5fvf8fxf4fwf8f1f6f0f7f0f5f1f8f' +
    '2f5f1f7f5f6fmfwfxf1fVfcfnfnfxfxfrfmf1fyf7f2f5f3f7f1f1fwf0fxfvftfkfof3f7f4f7f0f6f3f6fxf8f1f6f2f9fRf4f0f/fugAf' +
    'xgCfTgJfzgGfvgGf2gGf2gEftgOf9gAf9f9gAf8gAf6gCf7gFf2gFfvgHf0gEf1gGf2gGf0gXfigLfxgNf0gZfqgKf6gHf5gRf1gKf7gKf6g' +
    'Mf8gOf4gRf8gSf5hDf2gRf/gWgBgYgFgggFgPgHgSgEgNgIgMgDgKgHgKgFgigYgYgUgNgNgWgbgFgJgIgKgEgJgGgJgGgPgEgDgFgBgCf+g' +
    'Bf+gCfhgHfWgHfvgFfzgGf1gFf1gHf3gFf3gLfygXfogOf1gIf7gJf5gLf7gIf7gQf7gJf7gEf9gSf9gWf6gKf+gkgAgOgBgtgKgQgIgPgFg' +
    'hgWgQgMgOgNgLgMgMgSgGgJgFgJgFgLgHgMgEgQgGgOgCgHgCgSgCgkf8gwf9gJf9gCf8gBf4f+f7f9f2f5fif1fmf9fpgAfygDflgLfugMf' +
    'xgNf0gPf1gTf2gef+gOf/gTgDgOgKgegKgTgNgPgHgIgPgMgQgJgUgGgOgFgYgEgpgBgnf/gMf+gWf5gXf7gLf6gPf7gNf5gKf9gHf6gEf+g' +
    'Hf/';
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var unpacked = {};
  function unpack(key, s) {
    if (unpacked[key]) return unpacked[key];
    var D = {}, i;
    for (i = 0; i < 64; i++) D[B64.charAt(i)] = i;
    var cs = s.split(' '), out = [];
    for (i = 0; i < cs.length; i++) {
      var t = cs[i];
      var n = function (j, len) { var v = 0; for (var k = 0; k < len; k++) v = v * 64 + D[t.charAt(j + k)]; return v; };
      var x = n(0, 3) - 131072, y = n(3, 3) - 131072, pts = [x, y];
      for (var j = 6; j + 4 <= t.length; j += 4) { x += n(j, 2) - 2048; y += n(j + 2, 2) - 2048; pts.push(x, y); }
      out.push(pts);
    }
    return (unpacked[key] = out);
  }
  // контуры в путь: x = x0 + px·k, y = y0 + py·k
  function polys(c, cs, x0, y0, k) {
    for (var i = 0; i < cs.length; i++) {
      var p = cs[i];
      c.moveTo(x0 + p[0] * k, y0 + p[1] * k);
      for (var j = 2; j < p.length; j += 2) c.lineTo(x0 + p[j] * k, y0 + p[j + 1] * k);
      c.closePath();
    }
  }
  var WORD_W = 9323;                       // ширина слова в единицах (высота «К» = 1000)
  // «Кубачинский»: x — левый край, base — базовая линия, cap — высота прописной, px
  function drawWord(c, x, base, cap) {
    c.beginPath();
    polys(c, unpack('w', WORD), x + 3 * cap / 1000, base, cap / 1000);
    c.fill('evenodd');                     // дыры (чаши «б», «а») — чёт-нечет
  }

  // розетка: (cx, cy) — центр, r — радиус до кончиков «облаков», px. Тень — копия, сжатая к центру до 0,925
  // (подобрано по logo.png, IoU 0,973): лаванда видна по кромкам, обращённым к центру — в «глазках» завитков и
  // под хвостами
  function rosette(c, cx, cy, r, style, K) {
    var P = unpack('r', ROS), k = r / 1000;
    var path = function (s) { c.beginPath(); polys(c, P, cx, cy, k * s); };
    c.save();
    c.lineJoin = 'round';
    if (style === 'medal') {               // синий круг с латунным ободком, розетка светлая
      c.fillStyle = '#c9a24e'; c.beginPath(); c.arc(cx, cy, r * 1.16, 0, Math.PI * 2); c.fill();
      c.fillStyle = K.frame; c.beginPath(); c.arc(cx, cy, r * 1.1, 0, Math.PI * 2); c.fill();
    }
    if (style !== 'ink') { c.fillStyle = K.lav; path(0.925); c.fill(); }
    if (style === 'silver') {             // контур + мягкая тень вниз-вправо: «серебряная бляха» на светлом поле
      c.save();
      c.shadowColor = 'rgba(18,30,90,0.28)'; c.shadowBlur = r * 0.07; c.shadowOffsetX = r * 0.02; c.shadowOffsetY = r * 0.035;
      c.strokeStyle = K.edge; c.lineWidth = Math.max(1.6, r * 0.06); path(1); c.stroke();
      c.restore();
    }
    if (style === 'ink') c.fillStyle = K.frame;
    else {
      var g = c.createLinearGradient(cx - r * 0.7, cy - r * 0.8, cx + r * 0.7, cy + r * 0.8);
      g.addColorStop(0, K.silver[0]); g.addColorStop(1, style === 'light' ? '#f0f0f2' : K.silver[1]);
      c.fillStyle = g;
    }
    path(1); c.fill();
    c.restore();
  }

  // ---------- прописные: штриховой гуманистический гротеск ----------
  // ячейка: высота прописной 100, y вниз (0 — линия прописных, 100 — базовая), [ширина, путь]. Команды:
  // M/L x y; C x1 y1 x2 y2 x y; O cx cy rx ry — эллипс; E cx cy rx ry a0 a1 — дуга (градусы, по часовой от +x;
  // a1 < a0 — против часовой); D x y — точка (кружок 0,62 толщины штриха). Нижние выносные (Д, Ц, Щ) — до 118
  var CAPS = {
    'А': [72, 'M 2 100 L 36 0 L 70 100 M 14 66 L 58 66'],
    'Б': [62, 'M 54 0 L 8 0 L 8 100 L 32 100 C 50 100 58 88 58 74 C 58 59 49 48 32 48 L 8 48'],
    'В': [62, 'M 8 48 L 30 48 C 44 48 52 40 52 25 C 52 10 43 0 28 0 L 8 0 L 8 100 L 32 100 C 49 100 58 89 58 74 C 58 58 48 48 30 48'],
    'Г': [54, 'M 52 0 L 8 0 L 8 100'],
    'Д': [74, 'M 2 118 L 2 100 L 72 100 L 72 118 M 8 100 C 18 78 22 40 22 0 L 62 0 L 62 100'],
    'Е': [58, 'M 52 0 L 8 0 L 8 100 L 54 100 M 8 49 L 46 49'],
    'Ё': [58, 'M 52 0 L 8 0 L 8 100 L 54 100 M 8 49 L 46 49 D 20 -16 D 42 -16'],
    'Ж': [94, 'M 47 0 L 47 100 M 6 0 L 41 50 L 3 100 M 88 0 L 53 50 L 91 100 M 41 50 L 53 50'],
    'З': [60, 'M 6 16 C 10 6 18 0 29 0 C 43 0 51 10 51 24 C 51 39 41 48 26 48 M 26 48 C 44 48 55 58 55 74 C 55 90 44 100 28 100 C 17 100 8 95 3 85'],
    'И': [70, 'M 8 0 L 8 100 L 62 0 L 62 100'],
    'Й': [70, 'M 8 0 L 8 100 L 62 0 L 62 100 M 22 -20 C 25 -9 45 -9 48 -20'],
    'К': [66, 'M 8 0 L 8 100 M 58 0 L 8 58 M 26 37 L 63 100'],
    'Л': [66, 'M 2 100 C 12 100 18 92 20 72 L 24 0 L 60 0 L 60 100'],
    'М': [86, 'M 4 100 L 12 0 L 43 76 L 74 0 L 82 100'],
    'Н': [70, 'M 8 0 L 8 100 M 62 0 L 62 100 M 8 50 L 62 50'],
    'О': [86, 'O 43 50 39 50'],
    'П': [68, 'M 8 100 L 8 0 L 60 0 L 60 100'],
    'Р': [62, 'M 8 100 L 8 0 L 32 0 C 49 0 58 11 58 27 C 58 43 49 54 32 54 L 8 54'],
    'С': [74, 'E 41 50 38 50 -42 -318'],
    'Т': [62, 'M 0 0 L 62 0 M 31 0 L 31 100'],
    'У': [66, 'M 2 0 L 39 64 M 63 0 L 31 86 C 27 95 21 100 11 100'],
    'Ф': [86, 'O 43 50 39 30 M 43 0 L 43 100'],
    'Х': [68, 'M 4 0 L 64 100 M 64 0 L 4 100'],
    'Ц': [72, 'M 8 0 L 8 100 L 68 100 L 68 118 M 62 0 L 62 100'],
    'Ч': [64, 'M 8 0 L 8 28 C 8 46 18 56 34 56 C 42 56 50 53 56 49 M 56 0 L 56 100'],
    'Ш': [94, 'M 8 0 L 8 100 L 86 100 L 86 0 M 47 0 L 47 100'],
    'Щ': [98, 'M 8 0 L 8 100 L 92 100 L 92 118 M 47 0 L 47 100 M 86 0 L 86 100'],
    'Ъ': [70, 'M 0 0 L 16 0 L 16 100 L 40 100 C 57 100 66 89 66 74 C 66 59 57 48 40 48 L 16 48'],
    'Ы': [86, 'M 8 0 L 8 100 L 30 100 C 47 100 56 89 56 74 C 56 59 47 48 30 48 L 8 48 M 78 0 L 78 100'],
    'Ь': [62, 'M 8 0 L 8 100 L 32 100 C 49 100 58 89 58 74 C 58 59 49 48 32 48 L 8 48'],
    'Э': [74, 'E 33 50 38 50 -138 138 M 26 50 L 71 50'],
    'Ю': [100, 'M 8 0 L 8 100 M 8 50 L 30 50 O 63 50 33 50'],
    'Я': [62, 'M 54 100 L 54 0 L 30 0 C 13 0 4 11 4 27 C 4 43 13 54 30 54 L 54 54 M 32 54 L 3 100'],
    '0': [60, 'O 30 50 26 50'],
    '1': [44, 'M 8 18 L 28 0 L 28 100'],
    '2': [58, 'M 6 22 C 8 8 18 0 30 0 C 44 0 52 10 52 24 C 52 44 30 64 4 100 L 56 100'],
    '3': [58, 'M 6 12 C 11 4 19 0 28 0 C 42 0 50 9 50 24 C 50 38 40 47 24 47 M 24 47 C 44 47 54 58 54 73 C 54 90 42 100 26 100 C 16 100 8 96 3 88'],
    '4': [62, 'M 42 100 L 42 0 L 2 70 L 60 70'],
    '5': [58, 'M 50 0 L 12 0 L 8 44 C 14 40 22 38 30 38 C 46 38 54 52 54 68 C 54 88 42 100 26 100 C 16 100 8 96 3 88'],
    '6': [58, 'O 29 70 25 30 M 4 70 C 4 30 18 0 44 0'],
    '7': [56, 'M 4 0 L 54 0 L 20 100'],
    '8': [58, 'O 29 25 21 25 O 29 73 25 27'],
    '9': [58, 'O 29 30 25 30 M 54 30 C 54 70 40 100 14 100'],
    '.': [18, 'D 9 96'],
    ',': [18, 'D 9 94 M 10 98 L 4 112'],
    ':': [18, 'D 9 42 D 9 96'],
    '!': [18, 'M 9 0 L 9 72 D 9 96'],
    '?': [54, 'M 4 20 C 6 6 16 0 28 0 C 42 0 50 10 50 22 C 50 38 30 44 28 60 L 28 72 D 28 96'],
    '-': [40, 'M 6 58 L 34 58'],
    '–': [58, 'M 6 58 L 52 58'],
    '—': [80, 'M 4 58 L 76 58'],
    '«': [46, 'M 20 30 L 6 55 L 20 80 M 38 30 L 24 55 L 38 80'],
    '»': [46, 'M 8 30 L 22 55 L 8 80 M 26 30 L 40 55 L 26 80'],
    '№': [100, 'M 8 100 L 8 0 L 56 100 L 56 0 O 80 34 11 14 M 68 66 L 92 66'],
    '(': [28, 'M 22 -6 C 4 20 4 80 22 106'],
    ')': [28, 'M 6 -6 C 24 20 24 80 6 106'],
    '/': [40, 'M 4 106 L 36 -6'],
    ' ': [34, '']
  };
  var NARG = { M: 2, L: 2, C: 6, O: 4, E: 6, D: 2 };
  var parsed = {};
  function glyph(ch) {
    if (parsed[ch]) return parsed[ch];
    var g = CAPS[ch] || CAPS['?'], tk = g[1] ? g[1].split(/\s+/) : [], cm = [];
    for (var i = 0; i < tk.length;) {
      var op = tk[i++], a = [];
      for (var k = 0; k < NARG[op]; k++) a.push(+tk[i++]);
      cm.push([op, a]);
    }
    return (parsed[ch] = { w: g[0], cm: cm });
  }
  // ширина строки прописными: size — высота прописной px, o.track — разрядка в долях высоты
  function capsWidth(text, size, o) {
    var w = 0, n = 0, tr = (o && o.track) || 0;
    for (var i = 0; i < text.length; i++) { w += glyph(text.charAt(i)).w; n++; }
    return w * size / 100 + Math.max(0, n - 1) * tr * size;
  }
  // строка прописными: x — левый край, base — базовая линия, size — высота прописной (видимая, со штрихом),
  // o: { lw — толщина штриха в долях высоты, track — разрядка, cap — 'butt' | 'round' }
  function capsDraw(c, text, x, base, size, o) {
    o = o || {};
    var lw = (o.lw || 0.09) * size, tr = (o.track || 0) * size;
    var k = (size - lw) / 100, top = base - size + lw / 2, dots = [];
    c.save();
    c.lineWidth = lw; c.lineCap = o.cap || 'butt'; c.lineJoin = 'round';
    c.strokeStyle = c.fillStyle;
    c.beginPath();
    for (var i = 0; i < text.length; i++) {
      var g = glyph(text.charAt(i)), x0 = x + lw / 2 + (g.w * size / 100 - g.w * k) / 2;
      var X = function (v) { return x0 + v * k; }, Y = function (v) { return top + v * k; };
      for (var j = 0; j < g.cm.length; j++) {
        var op = g.cm[j][0], a = g.cm[j][1];
        if (op === 'M') c.moveTo(X(a[0]), Y(a[1]));
        else if (op === 'L') c.lineTo(X(a[0]), Y(a[1]));
        else if (op === 'C') c.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5]));
        else if (op === 'O') { c.moveTo(X(a[0] + a[2]), Y(a[1])); c.ellipse(X(a[0]), Y(a[1]), a[2] * k, a[3] * k, 0, 0, Math.PI * 2); }
        else if (op === 'E') {
          var a0 = a[4] * Math.PI / 180, a1 = a[5] * Math.PI / 180;
          c.moveTo(X(a[0] + a[2] * Math.cos(a0)), Y(a[1] + a[3] * Math.sin(a0)));
          c.ellipse(X(a[0]), Y(a[1]), a[2] * k, a[3] * k, 0, a0, a1, a1 < a0);
        } else if (op === 'D') dots.push(X(a[0]), Y(a[1]));
      }
      x += g.w * size / 100 + tr;
    }
    c.stroke();
    if (dots.length) {
      c.beginPath();
      for (var d = 0; d < dots.length; d += 2) { c.moveTo(dots[d] + lw * 0.62, dots[d + 1]); c.arc(dots[d], dots[d + 1], lw * 0.62, 0, Math.PI * 2); }
      c.fill();
    }
    c.restore();
  }
  // по центру: cx — середина строки
  function capsCenter(c, text, cx, base, size, o) {
    capsDraw(c, text, cx - capsWidth(text, size, o) / 2, base, size, o);
  }

  // ---------- рамка ----------
  // Г-поле левого верхнего угла (остальные три — зеркала): наружная кромка o, внутренняя — it (верх/низ) и is
  // (бока); поле выходит к наружной кромке стрельчатыми арками: сверху/снизу по центру (полуширина у кромки
  // полосы aw), по бокам на середине высоты (полувысота ah). Арка — кубические Безье от кромки полосы к вершине
  // в координатах (d — от оси арки, t — вглубь от наружной кромки), доли полуширины A и глубины h: плечо-«лепесток»
  // у полосы, выпуклая «луковица», вогнутый острый носик у вершины
  var FR = { edge: 15, o: 30, it: 118, is: 126, aw: 206, ah: 124 };
  var ARCH = [
    [1.0, 0.72, 0.98, 0.48, 0.82, 0.42],
    [0.62, 0.34, 0.36, 0.30, 0.22, 0.17],
    [0.12, 0.10, 0.04, 0.06, 0, 0]
  ];
  function geo(bw) {
    return { bw: bw, cx: bw / 2, cy: BH / 2, o: FR.o, it: FR.it, is: FR.is, aw: Math.min(FR.aw, bw / 2 - FR.is - 40), ah: FR.ah };
  }
  // обход Г-поля: вершина верхней арки → наружные кромки → боковая арка (от вершины к полосе) → внутренний
  // угол → верхняя арка (от полосы к вершине). to(x, y) / cu(x1, y1, x2, y2, x, y) — приёмник (путь или ломаная)
  function panelTL(G, to, cu) {
    var o = G.o, h = G.it - o, hs = G.is - o, i, s;
    to(G.cx, o, true); to(o, o); to(o, G.cy);
    // боковая арка: d = cy − y, t = x − o; сегменты в обратном порядке (от вершины к кромке)
    var SX = function (t) { return o + t * hs; }, SY = function (d) { return G.cy - d * G.ah; };
    for (i = ARCH.length - 1; i >= 0; i--) {
      s = ARCH[i];
      var p0 = i ? ARCH[i - 1] : null, ex = p0 ? p0[4] : 1, et = p0 ? p0[5] : 1;
      cu(SX(s[3]), SY(s[2]), SX(s[1]), SY(s[0]), SX(et), SY(ex));
    }
    to(G.is, G.it);
    // верхняя арка: d = cx − x, t = y − o
    var TX = function (d) { return G.cx - d * G.aw; }, TY = function (t) { return o + t * h; };
    to(TX(1), TY(1));
    for (i = 0; i < ARCH.length; i++) { s = ARCH[i]; cu(TX(s[0]), TY(s[1]), TX(s[2]), TY(s[3]), TX(s[4]), TY(s[5])); }
  }
  function panelPath(c, G) {
    panelTL(G, function (x, y, first) { if (first) c.moveTo(x, y); else c.lineTo(x, y); },
      function (a, b, d, e, x, y) { c.bezierCurveTo(a, b, d, e, x, y); });
    c.closePath();
  }
  function panelPoly(G) {        // ломаная для проверок «точка внутри»
    var P = [], lx = 0, ly = 0;
    panelTL(G, function (x, y) { P.push(x, y); lx = x; ly = y; }, function (a, b, d, e, x, y) {
      for (var i = 1; i <= 14; i++) {
        var t = i / 14, u = 1 - t;
        P.push(u * u * u * lx + 3 * u * u * t * a + 3 * u * t * t * d + t * t * t * x, u * u * u * ly + 3 * u * u * t * b + 3 * u * t * t * e + t * t * t * y);
      }
      lx = x; ly = y;
    });
    return P;
  }
  function inPoly(P, x, y) {
    var ins = false;
    for (var i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
      if ((P[i + 1] > y) !== (P[j + 1] > y) && x < (P[j] - P[i]) * (y - P[i + 1]) / (P[j + 1] - P[i + 1]) + P[i]) ins = !ins;
    }
    return ins;
  }
  // расстояние до ломаной контура (для отступа набивки от кромки)
  function distPoly(P, x, y) {
    var best = 1e9;
    for (var i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
      var ax = P[j], ay = P[j + 1], bx = P[i], by = P[i + 1], dx = bx - ax, dy = by - ay;
      var t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      var ex = ax + t * dx - x, ey = ay + t * dy - y, d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // мотивы орнамента (в базовых px): лист-миндалина (заливка), бутон, трилистник, завиток с листом, цветок
  function leafF(c, x, y, a, L, W) {
    var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, bend = W * 0.3;
    var tx = x + ca * L + nx * bend, ty = y + sa * L + ny * bend;
    c.moveTo(x, y);
    c.bezierCurveTo(x + ca * L * 0.3 + nx * W, y + sa * L * 0.3 + ny * W, x + ca * L * 0.8 + nx * W * 0.8, y + sa * L * 0.8 + ny * W * 0.8, tx, ty);
    c.bezierCurveTo(x + ca * L * 0.75 - nx * W * 0.45, y + sa * L * 0.75 - ny * W * 0.45, x + ca * L * 0.3 - nx * W * 0.8, y + sa * L * 0.3 - ny * W * 0.8, x, y);
  }
  // точка против часовой — как и листья: при общей заливке (nonzero) наложения не дают «дыр»
  function dot(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, -Math.PI * 2, true); }
  // S-завиток: кривизна растёт к концу — спираль с точкой; с листом на изгибе. Возвращает точки (для отступов)
  function scroll(c, F, R, x, y, a, n, sgn, step, leafAt) {
    var pts = [x, y];
    c.moveTo(x, y);
    for (var i = 0; i < n; i++) {
      var f = i / n;
      a += sgn * (-0.08 * (1 - f) * (1 - f) + 0.46 * f * f);
      var nx2 = x + Math.cos(a) * step, ny2 = y + Math.sin(a) * step;
      c.quadraticCurveTo(x, y, (x + nx2) / 2, (y + ny2) / 2);
      x = nx2; y = ny2; pts.push(x, y);
      if (leafAt && i === leafAt) leafF(F, x, y, a - sgn * (0.9 + R() * 0.4), 9 + R() * 4, 3.4 + R() * 1.2);
    }
    dot(F, x, y, 1.9);
    return pts;
  }
  function flower(c, x, y, r, n, a0) {
    for (var i = 0; i < n; i++) { var a = a0 + i / n * Math.PI * 2; dot(c, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.62); }
  }
  // орнамент Г-поля в базовых координатах: лоза-«ислими» по оси полосы (синусоида; на каждой полуволне —
  // завиток внутрь изгиба с цветком, на гребнях — листья), угловой медальон-розетка, затем густая набивка
  // листьями, цветками, бутонами, трилистниками и завитками (диск Пуассона, вдоль полосы) — как плотная синяя
  // «вязь» баннера: синего ≈ половина площади, чтобы рамка и издали читалась синей
  function ornament(c, G, K) {
    var R = rng(19601), P = panelPoly(G);
    var fillP = new Acc(), strokeP = new Acc(), vineP = new Acc(), holeP = new Acc();   // holeP — белые серединки
    // занятые места [x, y, r] — в сетке корзин 16 px: метка кладётся во все корзины, которые задевает круг метки
    // с запасом 8 px (наибольший радиус пробы), проверка смотрит одну корзину
    var CELL = 16, NX = Math.ceil(G.cx / CELL) + 2, grid = [];
    var mark = function (x, y, r) {
      var e = r + 8, i0 = Math.max(0, Math.floor((x - e) / CELL)), i1 = Math.floor((x + e) / CELL);
      var j0 = Math.max(0, Math.floor((y - e) / CELL)), j1 = Math.floor((y + e) / CELL);
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= Math.min(i1, NX - 1); i++) (grid[j * NX + i] || (grid[j * NX + i] = [])).push(x, y, r);
    };
    var free = function (x, y, r) {
      var b = grid[Math.floor(y / CELL) * NX + Math.floor(x / CELL)];
      if (!b) return true;
      for (var i = 0; i < b.length; i += 3) { var dx = b[i] - x, dy = b[i + 1] - y, rr = b[i + 2] + r; if (dx * dx + dy * dy < rr * rr) return false; }
      return true;
    };
    var o = G.o, bt = G.it - o, ay = (o + G.it) / 2, ax = (o + G.is) / 2;
    // угловой медальон: восьмилепестковая розетка с белой серединкой и точками между лепестками
    var mx = ax, my = ay, mr = bt * 0.42, m, am;
    for (m = 0; m < 8; m++) {
      am = m / 8 * Math.PI * 2 + Math.PI / 8;
      leafF(fillP, mx + Math.cos(am) * mr * 0.2, my + Math.sin(am) * mr * 0.2, am, mr * 0.86, mr * 0.36);
      dot(fillP, mx + Math.cos(am + Math.PI / 8) * mr * 0.74, my + Math.sin(am + Math.PI / 8) * mr * 0.74, mr * 0.085);
    }
    dot(fillP, mx, my, mr * 0.34); dot(holeP, mx, my, mr * 0.16);
    mark(mx, my, mr * 1.02);
    // цветок: n лепестков-кружков вокруг, белая серединка
    var bloom = function (x, y, r, n, a0) { flower(fillP, x, y, r, n, a0); dot(fillP, x, y, r * 0.7); dot(holeP, x, y, r * 0.32); };
    // лоза по верхней полосе и по боковой
    var vine = function (horiz, s0, s1, axis, A, lam) {
      var x, y, i = 0, half = 0;
      for (var s = s0; s <= s1; s += 3) {
        var ph = (s - s0) / lam * Math.PI * 2, off = A * Math.sin(ph);
        x = horiz ? s : axis + off; y = horiz ? axis + off : s;
        if (s === s0) vineP.moveTo(x, y); else vineP.lineTo(x, y);
        if (i % 2 === 0) mark(x, y, 4);
        i++;
        // полуволна пройдена — завиток внутрь изгиба (к наружной/внутренней кромке попеременно), на конце цветок
        var hw = Math.floor((s - s0) / (lam / 2));
        if (hw > half) {
          half = hw;
          var sg = hw % 2 ? 1 : -1;
          var dirA = horiz ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : (sg > 0 ? Math.PI : 0);
          var pts = scroll(strokeP, fillP, R, x, y, dirA + (horiz ? 1 : -1) * 0.9 * sg, 14, horiz ? sg : -sg, 2.5, 5);
          var ex = pts[pts.length - 2], ey = pts[pts.length - 1];
          for (var q = 0; q < pts.length; q += 4) mark(pts[q], pts[q + 1], 3);
          bloom(ex, ey, 3.6, 5, R() * 6);
          mark(ex, ey, 7);
        }
        // листья на гребнях — попеременно в стороны
        if (i % 8 === 4) {
          var d = A * Math.cos(ph) * Math.PI * 2 / lam, tang = horiz ? Math.atan2(d, 1) : Math.atan2(1, d);
          var side = (i / 8 | 0) % 2 ? 1 : -1;
          leafF(fillP, x, y, tang + side * 0.9, 13, 4.6);
          mark(x + Math.cos(tang + side * 0.9) * 7, y + Math.sin(tang + side * 0.9) * 7, 4.5);
        }
      }
    };
    vine(true, ax + mr * 1.15, G.cx - 4, ay, bt * 0.24, 104);
    vine(false, ay + mr * 1.15, G.cy - 4, ax, (G.is - o) * 0.24, 104);
    // набивка
    // пробы — попеременно в прямоугольниках верхней и боковой полосы (а не во всей четверти): обе плечи Г-поля
    // заполняются до насыщения одинаково густо
    var tries = 0, placed = 0;
    while (tries++ < 24000) {
      var top = tries & 1;
      var x = top ? o + R() * (G.cx - o) : o + R() * (G.is - o), y = top ? o + R() * (G.it - o) : o + R() * (G.cy - o);
      if (!inPoly(P, x, y)) continue;
      var dE = distPoly(P, x, y);
      if (dE < 7) continue;
      var r = Math.min(5 + R() * 4, dE - 2.5);
      if (!free(x, y, r * 0.74)) continue;
      var flow = (y < G.it + 6 && x > G.is + 4) ? 0 : (x < G.is + 6 && y > G.it + 4 ? Math.PI / 2 : Math.PI / 4);
      var a = flow + (R() - 0.5) * 2.4 + (R() < 0.5 ? Math.PI : 0), t = R();
      if (t < 0.44) leafF(fillP, x - Math.cos(a) * r * 1.05, y - Math.sin(a) * r * 1.05, a, r * 2.2, r * 1.0);
      else if (t < 0.58) bloom(x, y, r * 0.56, 5, a);
      else if (t < 0.7) { flower(fillP, x, y, r * 0.42, 3, a); vineStub(strokeP, x, y, a + Math.PI, r); }
      else if (t < 0.82) { leafF(fillP, x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7, a, r * 1.4, r * 1.05); dot(fillP, x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, r * 0.2); }
      else if (dE > 10) scroll(strokeP, fillP, R, x - Math.cos(a) * r * 0.6, y - Math.sin(a) * r * 0.6, a, 9, R() < 0.5 ? 1 : -1, 1.8, 0);
      else continue;
      mark(x, y, r * 0.74); placed++;
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = 3.4; vineP.stroke(c);
    c.lineWidth = 2.6; strokeP.stroke(c);
    fillP.fill(c);
    c.globalCompositeOperation = 'destination-out';
    holeP.fill(c);
    c.globalCompositeOperation = 'source-over';
    return placed;
  }
  function vineStub(c, x, y, a, r) { c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1); }
  // накопитель пути: команды копятся и проигрываются на холст разом (один fill/stroke на всю набивку)
  function Acc() { this.q = []; }
  Acc.prototype.moveTo = function (x, y) { this.q.push(0, x, y); };
  Acc.prototype.lineTo = function (x, y) { this.q.push(1, x, y); };
  Acc.prototype.quadraticCurveTo = function (a, b, x, y) { this.q.push(2, a, b, x, y); };
  Acc.prototype.bezierCurveTo = function (a, b, d, e, x, y) { this.q.push(3, a, b, d, e, x, y); };
  Acc.prototype.arc = function (x, y, r, a0, a1, ccw) { this.q.push(4, x, y, r, a0, a1, ccw ? 1 : 0); };
  Acc.prototype.play = function (c) {
    var q = this.q, i = 0;
    c.beginPath();
    while (i < q.length) {
      var op = q[i];
      if (op === 0) { c.moveTo(q[i + 1], q[i + 2]); i += 3; }
      else if (op === 1) { c.lineTo(q[i + 1], q[i + 2]); i += 3; }
      else if (op === 2) { c.quadraticCurveTo(q[i + 1], q[i + 2], q[i + 3], q[i + 4]); i += 5; }
      else if (op === 3) { c.bezierCurveTo(q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5], q[i + 6]); i += 7; }
      else { c.arc(q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5], q[i + 6] === 1); i += 7; }
    }
  };
  Acc.prototype.fill = function (c) { this.play(c); c.fill(); };
  Acc.prototype.stroke = function (c) { this.play(c); c.stroke(); };

  // навершие («гребень») над вершиной верхней арки: стебель, бутон-капля, два завитка; dir = 1 вверх, −1 вниз
  function finial(c, x, y, dir, K) {
    c.save();
    c.translate(x, y); c.scale(1, dir);
    c.fillStyle = K.line; c.strokeStyle = K.line; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -6); c.stroke();
    c.beginPath();                       // бутон-капля
    c.moveTo(0, -24);
    c.bezierCurveTo(4, -17, 6.5, -12, 6.5, -9.5); c.bezierCurveTo(6.5, -6, 3.5, -4.5, 0, -4.5);
    c.bezierCurveTo(-3.5, -4.5, -6.5, -6, -6.5, -9.5); c.bezierCurveTo(-6.5, -12, -4, -17, 0, -24);
    c.fill();
    c.lineWidth = 2.4;
    for (var s = -1; s <= 1; s += 2) {   // усики
      c.beginPath(); c.moveTo(0, -1);
      c.bezierCurveTo(s * 7, -1, s * 13, -4, s * 13, -9); c.bezierCurveTo(s * 13, -12, s * 10, -13, s * 8.5, -11);
      c.stroke();
    }
    c.restore();
  }

  // 2D-контекст в памяти (willReadFrequently — холст не на GPU): тысячи мелких кривых орнамента и контуры букв
  // растеризуются процессором в разы быстрее, чем через GPU-путь (на программном GL — ~220 мс против ~25 мс),
  // а текстура всё равно грузится из памяти в texImage2D. Если холст уже имел контекст — берётся как есть
  function ctx2d(cv) {
    try { return cv.getContext('2d', { willReadFrequently: true }) || cv.getContext('2d'); } catch (e) { return cv.getContext('2d'); }
  }

  // ---------- фасадная панель ----------
  function facade(cv, W, H, o) {
    var K = o.night ? NIGHT : DAY, named = o.named !== false;
    var s = H / BH, bw = W / s, G = geo(bw);
    var c = ctx2d(cv);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // поле
    if (K.glow) {                        // лайтбокс: свет ровный по середине, к краям чуть теплее и тише
      var g = c.createRadialGradient(W / 2, H * 0.48, H * 0.1, W / 2, H / 2, Math.max(W * 0.62, H));
      g.addColorStop(0, K.glow[0]); g.addColorStop(0.55, K.glow[1]); g.addColorStop(1, K.glow[2]);
      c.fillStyle = g;
    } else c.fillStyle = K.bg;
    c.fillRect(0, 0, W, H);
    // орнамент: четверть (левый верхний угол) в отдельный холст, затем 4 зеркальные копии — рамка симметрична
    var qw = Math.ceil(W / 2), qh = Math.ceil(H / 2);
    var q = document.createElement('canvas'); q.width = qw; q.height = qh;
    var qc = ctx2d(q);
    qc.setTransform(s, 0, 0, s, 0, 0);
    qc.save(); qc.beginPath(); panelPath(qc, G); qc.clip();
    qc.fillStyle = qc.strokeStyle = K.orn;
    ornament(qc, G, K);
    // белый зазор между набивкой и контуром поля
    qc.globalCompositeOperation = 'destination-out';
    qc.lineWidth = 15; qc.lineJoin = 'round'; qc.beginPath(); panelPath(qc, G); qc.stroke();
    qc.restore();
    var flips = [[1, 1, 0, 0], [-1, 1, W, 0], [1, -1, 0, H], [-1, -1, W, H]];
    var f;
    for (f = 0; f < 4; f++) { c.setTransform(flips[f][0], 0, 0, flips[f][1], flips[f][2], flips[f][3]); c.drawImage(q, 0, 0); }
    // контуры Г-полей и наружная рамка
    c.strokeStyle = K.line; c.lineJoin = 'round';
    for (f = 0; f < 4; f++) {
      c.setTransform(flips[f][0] * s, 0, 0, flips[f][1] * s, flips[f][2], flips[f][3]);
      c.lineWidth = 4.6; c.beginPath(); panelPath(c, G); c.stroke();
    }
    c.setTransform(s, 0, 0, s, 0, 0);
    c.strokeStyle = K.frame; c.lineWidth = 5;
    c.strokeRect(FR.edge, FR.edge, bw - 2 * FR.edge, BH - 2 * FR.edge);
    // навершия у вершин верхней и нижней арок
    finial(c, G.cx, G.o + 1, 1, K);
    finial(c, G.cx, BH - G.o - 1, -1, K);
    // середина: эмблема и надписи. Пропорции logo.png (единица — высота «К» Cw): розетка 2,75 Cw по высоте,
    // зазор до слова 0,56 Cw, слово 9,32 Cw в ширину, строка прописных 0,29 Cw на 0,45 Cw ниже строки слова,
    // «ОСН.»/«1960» — 0,24 Cw на уровне центра розетки, ±2,56 Cw от оси. Розетка здесь мельче (2,2 Cw), чтобы слово
    // было крупнее — панель читают с улицы
    var L = layout(bw, named);
    // узкая панель: середина ужимается целиком к центру поля, чтобы не наехать на боковые полосы
    var need = Math.max(L.wordW, 2 * L.side + 4.4 * L.sideCap, capsWidth('ХУДОЖЕСТВЕННЫЙ КОМБИНАТ', L.capsCap, { track: L.capsTrack })) + 2 * G.is + 80;
    if (bw < need) { var k = bw / need; c.translate(G.cx, BH / 2); c.scale(k, k); c.translate(-G.cx, -BH / 2); }
    c.fillStyle = K.ink;
    rosette(c, G.cx, L.ry, L.rr, 'silver', K);
    c.fillStyle = K.ink;
    capsCenter(c, 'ОСН.', G.cx - L.side, L.ry + L.sideCap / 2, L.sideCap, { lw: 0.1, track: 0.1 });
    capsCenter(c, '1960', G.cx + L.side, L.ry + L.sideCap / 2, L.sideCap, { lw: 0.1, track: 0.1 });
    if (named) drawWord(c, G.cx - L.wordW / 2, L.base, L.cw);
    capsCenter(c, 'ХУДОЖЕСТВЕННЫЙ КОМБИНАТ', G.cx, L.capsBase, L.capsCap, { lw: L.capsLw, track: L.capsTrack });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  // раскладка середины фасада в базовых px (высота 640); при узкой панели всё ужимается к центру
  function layout(bw, named) {
    var L = {};
    if (named) {
      L.cw = 104; L.rr = 108; L.ry = 52 + L.rr; L.base = L.ry + L.rr + 0.42 * L.cw + L.cw;
      L.wordW = WORD_W / 1000 * L.cw;
      L.capsCap = 0.32 * L.cw; L.capsBase = L.base + 0.42 * L.cw + L.capsCap; L.capsLw = 0.11; L.capsTrack = 0.34;
      L.sideCap = 0.29 * L.cw; L.side = 2.6 * L.cw;
    } else {
      L.cw = 98; L.rr = 136; L.ry = 62 + L.rr; L.wordW = 0;
      L.capsCap = 60; L.capsBase = L.ry + L.rr + 52 + L.capsCap; L.capsLw = 0.12; L.capsTrack = 0.26;
      L.sideCap = 29; L.side = 310;
    }
    return L;
  }

  // ---------- эмблема ----------
  function emblem(cv, W, H, o) {
    var c = ctx2d(cv), K = DAY, st = o.style || 'silver';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    var r = Math.min(W, H) / 2 * (st === 'medal' ? 0.84 : st === 'silver' ? 0.9 : 0.965);   // серебру — место под тень
    rosette(c, W / 2, H / 2, r, st, K);
  }

  // ---------- табличка двери ----------
  // Nunito готов, только если его грань реально загружена (иначе check() вернёт true и для «системного» Nunito,
  // которого нет — canvas подставит системный шрифт) и покрывает буквы текста (кириллица — отдельная грань)
  // Возвращает загруженное начертание (800 или 900 — 900 игра грузит заранее) или 0
  function nunitoReady(text) {
    try {
      if (typeof document === 'undefined' || !document.fonts || !document.fonts.check) return 0;
      var has = false;
      document.fonts.forEach(function (f) { if (f.family.replace(/["']/g, '') === 'Nunito' && f.status === 'loaded') has = true; });
      if (!has) return 0;
      return document.fonts.check('800 40px Nunito', text || 'А') ? 800 : document.fonts.check('900 40px Nunito', text || 'А') ? 900 : 0;
    } catch (e) { return 0; }
  }
  function plaque(cv, W, H, o) {
    var c = ctx2d(cv), text = String(o.text == null ? '' : o.text);
    c.setTransform(1, 0, 0, 1, 0, 0);
    var u = H / 160;                      // единица: табличка 160 px высотой
    // латунная окантовка во весь холст (без прозрачных углов — плоскости в игре непрозрачные)
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f3dc96'); g.addColorStop(0.45, '#c99b45'); g.addColorStop(0.55, '#b98a36'); g.addColorStop(1, '#e8c879');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // синее поле с лёгким градиентом и тонкой латунной линией внутри
    var b = 7 * u;
    var gb = c.createLinearGradient(0, b, 0, H - b);
    gb.addColorStop(0, '#2c4ea6'); gb.addColorStop(1, '#1b3683');
    c.fillStyle = gb;
    rr(c, b, b, W - 2 * b, H - 2 * b, 6 * u); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5 * u; rr(c, b, b, W - 2 * b, H - 2 * b, 6 * u); c.stroke();
    c.strokeStyle = '#d9b862'; c.lineWidth = 2 * u; rr(c, b + 9 * u, b + 9 * u, W - 2 * b - 18 * u, H - 2 * b - 18 * u, 4 * u); c.stroke();
    // латунные «винты» в углах
    var sc = [[b + 18 * u, b + 18 * u], [W - b - 18 * u, b + 18 * u], [b + 18 * u, H - b - 18 * u], [W - b - 18 * u, H - b - 18 * u]];
    for (var i = 0; i < 4; i++) {
      var gs = c.createRadialGradient(sc[i][0] - 1.5 * u, sc[i][1] - 1.5 * u, 0.5 * u, sc[i][0], sc[i][1], 4.5 * u);
      gs.addColorStop(0, '#fff1c4'); gs.addColorStop(1, '#a87b2c');
      c.fillStyle = gs; c.beginPath(); c.arc(sc[i][0], sc[i][1], 4.2 * u, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(90,60,20,0.7)'; c.lineWidth = 1.1 * u;
      c.beginPath(); c.moveTo(sc[i][0] - 2.6 * u, sc[i][1] + 1.2 * u); c.lineTo(sc[i][0] + 2.6 * u, sc[i][1] - 1.2 * u); c.stroke();
    }
    // текст
    var maxW = W - 2 * b - 64 * u, cy = H / 2;
    var wt = o.font !== 'vector' ? nunitoReady(text) : 0;
    c.fillStyle = '#fffdf6';
    if (wt) {
      var fs = 62 * u;
      c.font = wt + ' ' + fs + 'px Nunito';
      var mw = c.measureText(text).width;
      if (mw > maxW) { fs *= maxW / mw; c.font = wt + ' ' + fs + 'px Nunito'; }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = 'rgba(8,18,60,0.55)'; c.shadowOffsetY = 2 * u; c.shadowBlur = 2 * u;
      c.fillText(text, W / 2, cy + fs * 0.04);
      c.shadowColor = 'rgba(0,0,0,0)';
    } else {
      var T = text.toUpperCase(), cap = 46 * u, op = { lw: 0.15, track: 0.12, cap: 'round' };
      var tw = capsWidth(T, cap, op);
      if (tw > maxW) { cap *= maxW / tw; }
      c.save();
      c.shadowColor = 'rgba(8,18,60,0.55)'; c.shadowOffsetY = 2 * u; c.shadowBlur = 2 * u;
      capsCenter(c, T, W / 2, cy + cap / 2, cap, op);
      c.restore();
      // шрифт игры догрузится — перерисовать тем же холстом
      if (o.font !== 'vector' && typeof document !== 'undefined' && document.fonts && document.fonts.load && !o._retry) {
        document.fonts.load('800 40px Nunito', text).then(function () {
          if (!nunitoReady(text)) return;
          var o2 = {}; for (var k in o) o2[k] = o[k]; o2._retry = true;
          plaque(cv, W, H, o2);
          if (typeof o.onUpdate === 'function') o.onUpdate(cv);
        }, function () { /* нет шрифта — остаются свои прописные */ });
      }
    }
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  var DEF = { facade: [BW, BH], emblem: [512, 512], plaque: [512, 160] };
  function kombinatSignCanvas(opts) {
    opts = opts || {};
    var kind = DEF[opts.kind] ? opts.kind : 'facade';
    var W = Math.max(8, Math.round(opts.width || DEF[kind][0]));
    var H = Math.max(8, Math.round(opts.height || (kind === 'emblem' ? W : opts.width ? W * DEF[kind][1] / DEF[kind][0] : DEF[kind][1])));
    var cv = opts.canvas || document.createElement('canvas');
    cv.width = W; cv.height = H;
    if (kind === 'emblem') emblem(cv, W, H, opts);
    else if (kind === 'plaque') plaque(cv, W, H, opts);
    else facade(cv, W, H, opts);
    return cv;
  }

  // раскладка для сборщика: размеры по умолчанию, соотношения, и где на фасаде (доли холста по умолчанию,
  // u — слева, v — сверху) центр розетки и строка слова — например, чтобы поставить подсветку
  var LN = layout(BW, true), LF = layout(BW, false);
  kombinatSignCanvas.layout = {
    size: DEF, aspect: { facade: BW / BH, emblem: 1, plaque: 3.2 },
    frame: FR, base: [BW, BH],
    facade: {
      named: { emblem: [0.5, LN.ry / BH], emblemR: LN.rr / BH, wordBase: LN.base / BH, wordCap: LN.cw / BH },
      neutral: { emblem: [0.5, LF.ry / BH], emblemR: LF.rr / BH, titleBase: LF.capsBase / BH }
    }
  };
  kombinatSignCanvas.capsWidth = capsWidth;
  root.kombinatSignCanvas = kombinatSignCanvas;
})(typeof window !== 'undefined' ? window : globalThis);
