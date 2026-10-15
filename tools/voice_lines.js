#!/usr/bin/env node
/* =====================================================================
   Реплики для озвучки: статический разбор исходников игры (acorn, AST).
   Запускается из tools/voice_build.py; можно и руками:
     node tools/voice_lines.js > /tmp/lines.json
   Выход: JSON-массив { who, parts, src, kind }, где parts — куски текста и слоты:
     'строка' | { s: 'name' } (имя героини: голосом не звучит) | { s: '*' } (число, неделя… — тоже не звучит).
   Что считается репликой (тосты, кнопки, вывески — нет):
     1) объект { who: 'id', text|msg: … } — реплика id; объект { msg: … } без who — рассказчик (ep1: hit.who || 'narrator');
     2) say(X) / G.say(X) / ctx.say(X): строка или объект без who — рассказчик;
     3) choose(prompt, opts, { who }) / ask(prompt, { who }) — вопрос в окне диалога;
     4) Town.place({ host: { who: H }, greet/bark/react/weekly/reactFirst/mention }) — говорит хозяин H;
        facts.*.text — рассказчик (факт звучит как реплика); '{name}' в строках прогулки даёт два варианта:
        с именем (после «Помахать») и без имени (порт unnamed() из town.js);
     5) city3d.js: WAVE_REPLY / HI_AGAIN, engine.js: heroHi — облачка «Помахать»;
     6) js/world/main.js: LINES — жители прототипа города (+ «Ой! Привет!», «Би-би!»).
   Значения текста разворачиваются: литералы, шаблоны, ?:, ||, массивы, nx(id, [...]), Town.v(...),
   локальные переменные и функции (их return), obj.prop и ARR[i]. Что не разворачивается — слот '*'.
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const acorn = require(path.join(__dirname, 'node_modules', 'acorn'));
const ROOT = path.dirname(__dirname);

// все скрипты игры, кроме библиотек и данных (прогулка, комнаты, места, город — что появится, подхватится само)
const SKIP = /^(js\/vendor\/|js\/(hero_assets|hero3d|art|config|voice)\.js$)/;
const listJs = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listJs(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []));
const FILES = listJs('js').filter(f => !SKIP.test(f)).sort();

const HOST_KEYS = new Set(['greet', 'bark', 'react', 'weekly', 'reactFirst', 'mention']);
const PICKERS = new Set(['nx', 'next', 'pick', 'rnd', 'any', 'oneOf', 'choice', 'sample']);
// свойство неизвестного объекта (E.hero, w.parrot, it.cat, параметр hint) → все такие свойства объектов-литералов файла;
// общие имена не берём — слишком много мусора
const GENERIC = new Set(['text', 'label', 'name', 'msg', 'title', 'n', 't', 's', 'line', 'cap', 'say', 'id', 'k', 'v', 'x', 'e', 'it', 'w', 'r', 'L', 'p', 'q', 'o']);
const PASS1 = new Set(['fill', 'esc', 'unnamed', 'String', 'trim']);
const NAME_EXPR = /herName|heroName|\bstate\.name\b|\bst\.name\b|\bS\(\)\.name\b|^(?:nm|name|r\.name|inf\.name|ctx\.name)$/;
const MAXALT = 16;          // больше вариантов — слот '*'
const out = [];

function walk(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  if (fn(node, parent) === false) return;
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn, node));
    else if (v && typeof v.type === 'string') walk(v, fn, node);
  }
}
const propName = p => p && p.type === 'Property' && !p.computed ? (p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : null) : null;
const getProp = (obj, name) => obj && obj.type === 'ObjectExpression' ? obj.properties.find(p => propName(p) === name) : null;
const strLit = n => n && n.type === 'Literal' && typeof n.value === 'string' ? n.value : (n && n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const calleeName = c => !c ? '' : c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
const calleeFull = (c, src) => src.slice(c.start, c.end);

function analyze(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, locations: true }); }
  catch (e) { console.error('voice_lines: не разобрал', file, e.message); return; }
  const isTown = /^js\/(town|places\/)/.test(file);
  // имена → объявления (по всему файлу; ближайшее выше по тексту — первым)
  const decls = new Map();
  const addDecl = (name, node) => { if (!decls.has(name)) decls.set(name, []); decls.get(name).push(node); };
  walk(ast, n => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) addDecl(n.id.name, n.init);
    if (n.type === 'FunctionDeclaration' && n.id) addDecl(n.id.name, n);
    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && n.operator === '=') addDecl(n.left.name, n.right);
  });
  const where = n => `${file}:${n.loc ? n.loc.start.line : 0}`;
  const propsByName = new Map(), facts = new Map(), allObjs = [];
  walk(ast, n => {
    if (n.type === 'ObjectExpression') allObjs.push(n);
    if (n.type === 'Property' && !n.computed) { const k = propName(n); if (k) { if (!propsByName.has(k)) propsByName.set(k, []); propsByName.get(k).push(n.value); } }
    if (n.type === 'CallExpression' && calleeFull(n.callee, src) === 'Town.place' && n.arguments[0] && n.arguments[0].type === 'ObjectExpression') {
      const f = getProp(n.arguments[0], 'facts');
      if (f && f.value.type === 'ObjectExpression') f.value.properties.forEach(q => { const t = getProp(q.value, 'text'); if (t) facts.set(propName(q), t.value); });
    }
  });
  const byProp = (name, depth, seen) => {
    if (GENERIC.has(name) || seen.has('.' + name)) return [];
    const s2 = new Set(seen); s2.add('.' + name);
    return (propsByName.get(name) || []).filter(v => !/Function/.test(v.type)).flatMap(v => res(v, depth + 1, s2))
      .filter(x => x.parts.some(p => typeof p === 'string' && /[А-Яа-яЁё]{3}/.test(p)));
  };

  /* --- развернуть выражение в варианты текста: [{ parts, who }] --- */
  function returnsOf(fnNode) {
    if (fnNode.type === 'ArrowFunctionExpression' && fnNode.expression) return [fnNode.body];
    const r = [];
    walk(fnNode.body, (n) => {
      if (n !== fnNode.body && /Function/.test(n.type)) return false;   // вложенные функции — мимо
      if (n.type === 'ReturnStatement' && n.argument) r.push(n.argument);
    });
    return r;
  }
  const prod = (A, B) => {
    const r = [];
    for (const a of A) for (const b of B) { r.push({ parts: a.parts.concat(b.parts), who: a.who || b.who || null }); if (r.length > MAXALT) return null; }
    return r;
  };
  const STAR = () => [{ parts: [{ s: '*' }], who: null }];
  // во что может вычислиться выражение-объект: литералы объектов/массивов (ARR[i] → элементы, x → объявление)
  function objs(n, depth, seen) {
    if (!n || depth > 5) return [];
    if (n.type === 'ObjectExpression' || n.type === 'ArrayExpression') return [n];
    if (n.type === 'Identifier') {
      if (seen.has(n.name)) return [];
      const s2 = new Set(seen); s2.add(n.name);
      return (decls.get(n.name) || []).flatMap(d => objs(d, depth + 1, s2));
    }
    if (n.type === 'MemberExpression' && n.computed) return objs(n.object, depth + 1, seen).flatMap(b => (b.type === 'ArrayExpression' ? b.elements.filter(Boolean).flatMap(e => objs(e, depth + 1, seen)) : b.properties.flatMap(p => objs(p.value, depth + 1, seen))));
    if (n.type === 'MemberExpression') { const pn = n.property.name; return objs(n.object, depth + 1, seen).flatMap(b => { const p = b.type === 'ObjectExpression' && getProp(b, pn); return p ? objs(p.value, depth + 1, seen) : []; }); }
    if (n.type === 'ConditionalExpression') return objs(n.consequent, depth + 1, seen).concat(objs(n.alternate, depth + 1, seen));
    if (n.type === 'LogicalExpression') return objs(n.left, depth + 1, seen).concat(objs(n.right, depth + 1, seen));
    if (n.type === 'CallExpression') {
      const nm = calleeName(n.callee);
      if ((nm === 'find' || nm === 'filter') && n.callee.type === 'MemberExpression') return objs(n.callee.object, depth + 1, seen).flatMap(b => (b.type === 'ArrayExpression' ? b.elements.filter(Boolean).flatMap(e => objs(e, depth + 1, seen)) : []));
      if (n.callee.type === 'Identifier') { const ds = decls.get(n.callee.name) || []; return ds.filter(d => /Function/.test(d.type)).flatMap(d => returnsOf(d).flatMap(r => objs(r, depth + 1, seen))); }
    }
    return [];
  }
  function res(n, depth, seen, bind) {
    if (!n || depth > 7) return [];
    if (bind && n.type === 'Identifier' && bind.has(n.name)) { const b = bind.get(n.name); return b ? res(b.node, depth + 1, seen, b.bind) : []; }
    switch (n.type) {
      case 'Literal': return typeof n.value === 'string' ? [{ parts: [n.value], who: null }] : (typeof n.value === 'number' ? [{ parts: [String(n.value)], who: null }] : []);
      case 'TemplateLiteral': {
        if (!(bind && bind.__corr)) {
          const bases = new Set(), props = new Set();
          n.expressions.forEach(e => walk(e, q => { if (q.type === 'MemberExpression' && !q.computed && q.object.type === 'Identifier') { bases.add(q.object.name); props.add(q.property.name); } }));
          if (bases.size === 1) {
            const base = [...bases][0];
            if (!(bind && bind.has(base))) {
              const hasAll = o => [...props].every(x => getProp(o, x));
              let os = objs({ type: 'Identifier', name: base }, 0, new Set()).filter(o => o.type === 'ObjectExpression' && hasAll(o));
              // переменная из деструктуризации (const [it] = …) — берём объекты файла, у которых есть все эти свойства
              if (!os.length && (props.size >= 2 || ![...props].some(x => GENERIC.has(x)))) os = allObjs.filter(hasAll);
              if (os.length >= 2 && os.length <= 60) {
                const r = os.flatMap(o => { const b2 = new Map(bind || []); b2.set(base, { obj: o }); b2.__corr = true; return res(n, depth + 1, seen, b2); });
                if (r.length && r.every(x => !x.parts.some(p => p && p.s === '*'))) return r;
              }
            }
          }
        }
        let acc = [{ parts: [n.quasis[0].value.cooked], who: null }];
        n.expressions.forEach((e, i) => {
          const es = src.slice(e.start, e.end);
          let alt;
          if (NAME_EXPR.test(es) || /herName\(\)/.test(es)) alt = [{ parts: [{ s: 'name' }], who: null }];
          else {
            alt = res(e, depth + 1, seen, bind).filter(x => x.parts.every(p => typeof p === 'string' || p.s));
            if (!alt.length || alt.length > MAXALT) alt = STAR();
          }
          acc = prod(acc, alt) || prod(acc.slice(0, 1), STAR());
          acc = prod(acc, [{ parts: [n.quasis[i + 1].value.cooked], who: null }]);
        });
        return acc;
      }
      case 'BinaryExpression': {
        if (n.operator !== '+') return [];
        // X.charAt(0).toUpperCase() + X.slice(1)
        const L0 = n.left, R0 = n.right;
        if (L0.type === 'CallExpression' && calleeName(L0.callee) === 'toUpperCase' && L0.callee.object && L0.callee.object.type === 'CallExpression' && calleeName(L0.callee.object.callee) === 'charAt'
          && R0.type === 'CallExpression' && calleeName(R0.callee) === 'slice') {
          return res(L0.callee.object.callee.object, depth + 1, seen, bind).map(x => ({ who: x.who, parts: x.parts.map((p, i) => (i === 0 && typeof p === 'string' ? p.charAt(0).toUpperCase() + p.slice(1) : p)) }));
        }
        const L = res(n.left, depth + 1, seen, bind), R = res(n.right, depth + 1, seen, bind);
        if (!L.length && !R.length) return [];
        return prod(L.length ? L : STAR(), R.length ? R : STAR()) || STAR();
      }
      case 'ConditionalExpression': return res(n.consequent, depth + 1, seen, bind).concat(res(n.alternate, depth + 1, seen, bind));
      case 'LogicalExpression': return res(n.left, depth + 1, seen, bind).concat(res(n.right, depth + 1, seen, bind));
      case 'ArrayExpression': return n.elements.flatMap(e => (e ? res(e.type === 'SpreadElement' ? e.argument : e, depth + 1, seen, bind) : []));
      case 'SpreadElement': return res(n.argument, depth + 1, seen, bind);
      case 'ArrowFunctionExpression': case 'FunctionExpression': case 'FunctionDeclaration':
        return returnsOf(n).flatMap(r => res(r, depth + 1, seen));
      case 'ObjectExpression': {
        // { who, text } внутри варианта (Town.v('…', { who: 'parrot', text: '…' })) — реплика своего героя
        const w = getProp(n, 'who'), t = getProp(n, 'text') || getProp(n, 'msg'), f = getProp(n, 'f');
        const who = w ? strLit(w.value) : null;
        if (w && !who) return [];
        if (!t && f && strLit(f.value) && facts.has(strLit(f.value))) return res(facts.get(strLit(f.value)), depth + 1, seen).map(x => ({ parts: x.parts, who: who || 'narrator' }));
        if (!t) return [];
        return res(t.value, depth + 1, seen, bind).map(x => ({ parts: x.parts, who: who || x.who || (f ? 'narrator' : null) }));
      }
      case 'Identifier': {
        const ds = decls.get(n.name);
        if (!ds) return byProp(n.name, depth, seen);
        if (seen.has(n.name)) return [];
        const s2 = new Set(seen); s2.add(n.name);
        const r = ds.flatMap(d => res(d, depth + 1, s2));
        return r.length ? r : byProp(n.name, depth, seen);
      }
      case 'MemberExpression': {
        if (bind && n.object.type === 'Identifier' && bind.has(n.object.name) && bind.get(n.object.name) && bind.get(n.object.name).obj && !n.computed) {
          const p = getProp(bind.get(n.object.name).obj, n.property.name);
          return p ? res(p.value, depth + 1, seen) : [];
        }
        // ARR[i] → все элементы массива; obj.prop → свойство объекта-литерала
        if (n.computed && (n.object.type === 'ObjectExpression' || n.object.type === 'ArrayExpression')) {
          return n.object.type === 'ArrayExpression' ? res(n.object, depth + 1, seen) : n.object.properties.flatMap(p => res(p.value, depth + 1, seen));
        }
        if (n.computed) return objs(n.object, 0, new Set()).flatMap(b => (b.type === 'ArrayExpression' ? res(b, depth + 1, seen) : b.properties.flatMap(p => res(p.value, depth + 1, seen))));
        const pn = n.property.type === 'Identifier' ? n.property.name : null;
        if (!pn) return [];
        const r = objs(n.object, 0, new Set()).flatMap(b => { const p = b.type === 'ObjectExpression' && getProp(b, pn); return p ? res(p.value, depth + 1, seen) : []; });
        return r.length ? r : byProp(pn, depth, seen);
      }
      case 'CallExpression': {
        const nm = calleeName(n.callee), full = calleeFull(n.callee, src);
        if (/herName$/.test(full)) return [{ parts: [{ s: 'name' }], who: null }];
        if (full === 'Town.v' || nm === 'v' && /Town\.v/.test(full)) return n.arguments.flatMap(a => res(a, depth + 1, seen, bind));
        if (PICKERS.has(nm)) return n.arguments.filter(a => a.type !== 'Literal').flatMap(a => res(a, depth + 1, seen));
        if (PASS1.has(nm) && n.arguments[0]) return res(n.arguments[0], depth + 1, seen);
        if (nm === 'replace' && n.callee.type === 'MemberExpression') return res(n.callee.object, depth + 1, seen, bind);
        if (nm === 'concat' && n.callee.type === 'MemberExpression') return res(n.callee.object, depth + 1, seen, bind).concat(n.arguments.flatMap(a => res(a, depth + 1, seen, bind)));
        if (nm === 'slice' || nm === 'join' || nm === 'toUpperCase' || nm === 'toLowerCase') return [];
        if (n.callee.type === 'Identifier') {
          const ds = decls.get(n.callee.name);
          if (!ds || seen.has('()' + nm)) return [];
          const s2 = new Set(seen); s2.add('()' + nm);
          // локальный помощник: параметры связываем с аргументами (N = text => ({ who: 'narrator', text }))
          return ds.filter(d => /Function/.test(d.type)).flatMap(d => {
            const b = new Map(); d.params.forEach((pp, i) => { if (pp.type === 'Identifier') b.set(pp.name, n.arguments[i] ? { node: n.arguments[i], bind } : null); });
            return returnsOf(d).flatMap(r => res(r, depth + 1, s2, b));
          });
        }
        return [];
      }
      case 'AwaitExpression': return res(n.argument, depth + 1, seen);
      default: return [];
    }
  }
  const spoken = (node, defWho, kind, extra = {}) => {
    const R = res(node, 0, new Set());
    if (!R.length && process.env.VOICE_DIAG) console.error('voice_lines: пусто', where(node), kind, src.slice(node.start, Math.min(node.end, node.start + 90)).replace(/\s+/g, ' '));
    R.forEach(x => {
      const who = x.who || defWho;
      if (!who) return;
      emit(who, x.parts, where(node), kind, extra);
    });
  };
  function emit(who, parts, src, kind, extra) {
    // '{name}' / '{name|Ой}' внутри строк → слот имени; для прогулки ещё и вариант без имени
    const hasBrace = parts.some(p => typeof p === 'string' && /\{name(?:\|[^}]*)?\}/.test(p));
    if (hasBrace) {
      const joined = parts.map(p => (typeof p === 'string' ? p : p.s === 'name' ? '{name}' : '{*}')).join('');
      const filled = joined.replace(/\{name(?:\|[^}]*)?\}/g, '{name}');
      out.push({ who, parts: split(filled), src, kind, ...extra });
      if (isTown || extra.unnamed) out.push({ who, parts: split(unnamed(joined)), src, kind, variant: 'unnamed', ...extra });
      return;
    }
    out.push({ who, parts, src, kind, ...extra });
  }
  const split = s => s.split(/(\{name\}|\{\*\})/).filter(x => x !== '').map(x => (x === '{name}' ? { s: 'name' } : x === '{*}' ? { s: '*' } : x));
  // порт unnamed() из js/town.js (до «Помахать» имя из реплики убирается)
  function unnamed(s) {
    s = s.replace(/\{name\|([^}]*)\}/g, '$1');
    const lead = /^\s*\{name\}[\s!,.:…]*/;
    if (lead.test(s)) { s = s.replace(lead, ''); s = s.charAt(0).toUpperCase() + s.slice(1); }
    return s.replace(/,\s*\{name\},\s*/g, ' ').replace(/,\s*\{name\}(?=[\s!?.…]|$)/g, '').replace(/\s*\{name\}/g, '');
  }

  walk(ast, (n, parent) => {
    // 1) объекты-реплики
    if (n.type === 'ObjectExpression') {
      const w = getProp(n, 'who'), t = getProp(n, 'text'), m = getProp(n, 'msg'), f = getProp(n, 'f');
      if (w && (t || m)) { const who = strLit(w.value); if (who) spoken((t || m).value, who, 'line'); }
      else if (w && f && strLit(w.value)) spoken(n, strLit(w.value), 'fact');   // { who, f: 'id' } — факт голосом героя
      else if (m && !w && file === 'js/ep1.js') spoken(m.value, 'narrator', 'line');
    }
    if (n.type === 'CallExpression') {
      const nm = calleeName(n.callee), full = calleeFull(n.callee, src), a0 = n.arguments[0];
      // 2) say(…)
      if ((nm === 'say' || nm === 'sayOne') && a0 && !/sayBubble/.test(full)) spoken(a0, 'narrator', 'say');
      // 3) choose / ask — вопрос в окне
      if ((nm === 'choose' || nm === 'ask') && a0) {
        const o = n.arguments[nm === 'choose' ? 2 : 1], w = o && getProp(o, 'who');
        spoken(a0, (w && strLit(w.value)) || 'narrator', nm);
      }
      // 4) Town.place({...})
      if (full === 'Town.place' && a0 && a0.type === 'ObjectExpression') {
        const host = getProp(a0, 'host'), hw = host && host.value.type === 'ObjectExpression' ? getProp(host.value, 'who') : null;
        const H = hw ? strLit(hw.value) : null;
        a0.properties.forEach(p => {
          const k = propName(p);
          if (HOST_KEYS.has(k)) {
            if (p.value.type === 'ObjectExpression' && k !== 'reactFirst') p.value.properties.forEach(q => spoken(q.value, H, 'bark', { slot: k + '.' + propName(q) }));
            else if (p.value.type === 'CallExpression' && k === 'weekly') {
              // weekly: [1..6].reduce((o, w) => { o[w] = () => `…`; return o; }, {}) — тело стрелки
              walk(p.value, q => { if (q.type === 'ArrowFunctionExpression' && q.expression) spoken(q.body, H, 'bark', { slot: k }); });
            } else spoken(p.value, H, 'bark', { slot: k });
          }
          if (k === 'facts' && p.value.type === 'ObjectExpression') p.value.properties.forEach(q => { const t = getProp(q.value, 'text'); if (t) spoken(t.value, 'narrator', 'fact'); });
        });
      }
    }
    // 5) облачка «Помахать»
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
      if (n.id.name === 'WAVE_REPLY' && n.init.type === 'ObjectExpression') {
        const nameL = getProp(n.init, 'name'), plainL = getProp(n.init, 'plain'), catL = getProp(n.init, 'cat');
        WAVE_NPCS.forEach(id => { [nameL, plainL].forEach(l => l && res(l.value, 0, new Set()).forEach(x => emit(id, x.parts, where(n), 'wave', { unnamed: false }))); });
        if (catL) catL.value.properties.forEach(p => res(p.value, 0, new Set()).forEach(x => emit('cat', x.parts, where(n), 'wave', {})));
      }
      if (n.id.name === 'HI_AGAIN') res(n.init, 0, new Set()).forEach(x => emit('hero', x.parts, where(n), 'wave', {}));
      if (n.id.name === 'heroHi') spoken(n.init, 'hero', 'wave');
      // 6) жители прототипа города
      if (n.id.name === 'LINES' && file === 'js/world/main.js' && n.init.type === 'ObjectExpression') {
        n.init.properties.forEach(p => { const id = propName(p); res(p.value, 0, new Set()).forEach(x => emit(id, x.parts, where(p), 'world', {})); ['Ой! Привет!', 'Би-би!'].forEach(s => emit(id, [s], where(p), 'world', {})); });
      }
    }
  });
}
// кто может ответить на «Помахать» (жители комнат, пудель; кот — свой список)
const WAVE_NPCS = ['raccoon', 'goose', 'fox', 'parrot', 'owl', 'bunny', 'hedgehog', 'poodle', 'sheep', 'gaunt', 'turtle', 'zhuzha', 'tycho', 'pigeons', 'bee', 'cinnabon', 'macaron', 'bubbletea'];

FILES.forEach(analyze);
// чистка: пустые и чисто служебные реплики
const clean = out.filter(x => x.parts.some(p => typeof p === 'string' && /[A-Za-zА-Яа-яЁё]/.test(p)) && x.who !== 'note');
process.stdout.write(JSON.stringify(clean, null, 0));
