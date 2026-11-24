// Writes a review page of the verb list (data/verbs.tsv) for a person to
// approve: rank, infinitive (or past 3ms for pual and hufal), binyan, root,
// a form of each tense, frequency and the list's note. One self-contained
// HTML file (Russian, like the app); rows can be marked and the marks copied
// as text to send back.
//
//   node scripts/review-list.mjs [out.html]   (default .cache/review-list.html)
//   node scripts/review-list.mjs --ru [out.html]   (default .cache/review-ru.html)
//
// --ru: the Russian instead of the frequency and the note — translit, the
// translations, the aspect pair and three phrases built from
// data/ru-forms.json (scripts/ru-forms.py); a marked row takes a comment.
//
// Reads data/verbs.tsv, data/tables.tsv (--ru: data/ru.tsv,
// data/ru-forms.json); no network.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formsOf, readList, readTables } from './lib/verbs.mjs';

const ru = process.argv.includes('--ru');
const target = process.argv.slice(2).find((a) => a !== '--ru');
const out = resolve(target ?? resolve(import.meta.dirname, `../.cache/review-${ru ? 'ru' : 'list'}.html`));
const tables = readTables();
const data = resolve(import.meta.dirname, '../data');
const ruRows = new Map(
  ru
    ? readFileSync(resolve(data, 'ru.tsv'), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => [l.split('\t')[0], l.split('\t')])
    : [],
);
const ruForms = ru ? JSON.parse(readFileSync(resolve(data, 'ru-forms.json'), 'utf8')) : {};

const both = (a, b) => (b ? `${a} / ${b}` : a);

/** Three phrases of a verb: [Hebrew pronoun + form, its translit, Russian]. */
function phrases(f, r) {
  const list = [];
  if (r.short) {
    if (f['present.ms']) list.push(['הוּא', 'present.ms', `он ${r.short.m}`]);
    list.push(['הִיא', 'past.3fs', `она была ${r.short.f}`]);
    if (f['future.2ms']) list.push(['אַתָּה', 'future.2ms', `ты (м.) будешь ${r.short.m}`]);
  } else {
    if (f['present.ms'] && r.present) list.push(['הוּא', 'present.ms', `он ${r.present['3s']}`]);
    list.push(['הִיא', 'past.3fs', `она ${both(r.past.ipf.f, r.past.pf?.f)}`]);
    const ipf = r.future.ipf?.['2s'] ?? `будешь ${r.ipf}`;
    if (f['future.2ms']) list.push(['אַתָּה', 'future.2ms', `ты (м.) ${both(ipf, r.future.pf?.['2s'])}`]);
  }
  return list.map(([pron, key, text]) => [`${pron} ${f[key].defective}`, f[key].translit, text]);
}

const rows = readList().map((v) => {
  const f = formsOf(v, tables);
  const head = f['infinitive.inf'] ?? f['past.3ms'];
  const pick = (k) => f[k]?.defective ?? '';
  const status = v.note.startsWith('checked:') ? 'checked' : v.note.startsWith('by hand:') ? 'hand' : '';
  if (ru) {
    const [, translations, ipf, pf] = ruRows.get(v.lemma) ?? [];
    return [
      v.rank,
      v.lemma,
      head.defective,
      head.plain,
      f['infinitive.inf'] ? 1 : 0,
      v.binyan,
      v.root,
      head.translit,
      translations ?? '',
      pf ? `${ipf} / ${pf}` : (ipf ?? ''),
      phrases(f, ruForms[v.lemma]),
    ];
  }
  return [
    v.rank,
    v.lemma,
    head.defective,
    head.plain,
    f['infinitive.inf'] ? 1 : 0,
    v.binyan,
    v.root,
    pick('present.ms'),
    pick('past.3ms'),
    pick('future.3ms'),
    v.freq,
    status,
    v.note.replace(/^(checked|by hand): ?/, ''),
  ];
});

const TEXT = ru
  ? {
      title: 'Переводы глаголов',
      h1: 'Переводы на утверждение',
      lede: 'Переводы (первый — основной, он в играх «русский → иврит»), пара видов для фраз после ответа и три такие фразы. Транслитерация — как говорят. Отметьте строки с ошибкой, напишите, что исправить, и отправьте список в чат.',
      head: '<th></th><th>№</th><th>Глагол</th><th>Биньян</th><th>Перевод</th><th>Пара видов</th><th>Фразы</th>',
      search: 'Поиск: глагол, корень, перевод, номер',
    }
  : {
      title: 'Список глаголов',
      h1: 'Список глаголов на утверждение',
      lede: '1000 самых частотных глаголов по субтитрам, после ручного прохода. Заглавная форма — инфинитив; у пуаля и хуфаля, где инфинитива нет, — прошедшее 3 л. м. р. Отметьте строки, которые надо убрать или исправить, и отправьте список в чат.',
      head: '<th></th><th>№</th><th>Глагол</th><th>Биньян</th><th>Корень</th><th>Наст. м. р.</th><th>Прош. 3 л.</th><th>Буд. 3 л.</th><th>Частота</th><th>Пометка</th>',
      search: 'Поиск: глагол без огласовок, корень, номер',
    };

const html = `<title>${TEXT.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* A working ledger: a quiet sticky toolbar over one dense table; Hebrew in a
   book face with full nikud, the rest in a plain sans. */
:root {
  --bg: #f6f7f4; --surface: #ffffff; --fg: #1d2421; --muted: #66706b; --line: #dfe3df;
  --accent: #2f6b5a; --accent-soft: #e2efe9; --mark: #fff1c9; --mark-line: #e2c25a;
  --hand: #8a5a12; --hand-soft: #f7ead5;
  --he: "Frank Ruhl Libre", "Times New Roman", serif;
  --ui: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141917; --surface: #1b211e; --fg: #e4e9e6; --muted: #98a39d; --line: #2c3430;
  --accent: #7cc4ab; --accent-soft: #1f3530; --mark: #3a3420; --mark-line: #a08a3c;
  --hand: #e0b46a; --hand-soft: #352a19; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141917; --surface: #1b211e; --fg: #e4e9e6; --muted: #98a39d; --line: #2c3430;
  --accent: #7cc4ab; --accent-soft: #1f3530; --mark: #3a3420; --mark-line: #a08a3c;
  --hand: #e0b46a; --hand-soft: #352a19; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 14px/1.45 var(--ui);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg) }
header { max-width: 1100px; margin: 0 auto; padding-block: 24px 8px; display: grid; gap: 6px }
h1 { margin: 0; font-size: 22px; font-weight: 600; text-wrap: balance }
.lede { margin: 0; color: var(--muted); max-width: 70ch }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg);
  max-width: 1100px; margin: 0 auto; padding-block: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-bottom: 1px solid var(--line) }
input[type="search"] { flex: 1 1 220px; min-width: 0; font: inherit; padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg) }
.chips { display: flex; flex-wrap: wrap; gap: 4px }
.chip { font: 500 12px var(--ui); padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--fg); cursor: pointer }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent) }
.chip:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.count { color: var(--muted); font-variant-numeric: tabular-nums; margin-inline-start: auto }
.marks { max-width: 1100px; margin: 0 auto; padding-block: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
.marks button { font: 500 13px var(--ui); padding: 7px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--surface); cursor: pointer }
.marks button.plain { background: transparent; color: var(--accent) }
.marks textarea { flex: 1 1 100%; min-height: 60px; font: 12px var(--mono); border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg); padding: 8px }
.wrap { max-width: 1100px; margin: 0 auto; overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px }
table { border-collapse: collapse; width: 100%; min-width: 860px }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: start; vertical-align: baseline }
th { font: 600 11px var(--ui); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); background: var(--surface) }
td.n, td.f { font-variant-numeric: tabular-nums; color: var(--muted); text-align: end; white-space: nowrap }
.he { font-family: var(--he); font-size: 19px; direction: rtl; unicode-bidi: isolate; white-space: nowrap }
.he small { display: block; font: 12px var(--ui); color: var(--muted) }
.verb .he { font-size: 22px; font-weight: 500 }
.root { font-family: var(--he); font-size: 16px; letter-spacing: .25em; direction: rtl; unicode-bidi: isolate; white-space: nowrap }
.b { font-size: 12px; color: var(--accent); white-space: nowrap }
.tag { display: inline-block; font: 500 11px var(--ui); padding: 1px 7px; border-radius: 999px; background: var(--hand-soft); color: var(--hand); margin-inline-end: 6px }
.note { color: var(--muted); font-size: 12px; max-width: 34ch }
.note .he { font-size: 15px; white-space: normal }
tr.marked td { background: var(--mark) }
tr.marked td:first-child { box-shadow: inset 3px 0 0 var(--mark-line) }
td.m { width: 1%; text-align: center }
td.m input { width: 16px; height: 16px; accent-color: var(--accent) }
.no-inf { font: 11px var(--ui); color: var(--muted) }
.tr { display: block; font: italic 12px var(--ui); color: var(--muted) }
.ru-main { font-weight: 600 }
.ru-rest { color: var(--muted) }
.pair { max-width: 16ch }
.ph { display: grid; gap: 6px; font-size: 13px; min-width: 200px }
.ph .he { font-size: 17px; white-space: nowrap }
.ph .tr { display: inline; margin-inline-start: 6px }
.ph .ru { display: block }
td.c textarea { display: block; width: 100%; min-width: 220px; margin-top: 6px; font: 12px var(--ui); border: 1px solid var(--mark-line); border-radius: 6px; background: var(--surface); color: var(--fg); padding: 6px }
</style>

<header>
  <h1>${TEXT.h1}</h1>
  <p class="lede">${TEXT.lede}</p>
</header>
<div class="bar" role="search">
  <input id="q" type="search" placeholder="${TEXT.search}" aria-label="Поиск">
  <div class="chips" id="binyanim"></div>
  <div class="chips">
    <button class="chip" id="only-hand" aria-pressed="false" type="button"${ru ? ' hidden' : ''}>заданные вручную</button>
    <button class="chip" id="only-marked" aria-pressed="false" type="button">отмеченные</button>
  </div>
  <span class="count" id="count"></span>
</div>
<div class="marks">
  <button type="button" id="copy">Скопировать отмеченные</button>
  <button type="button" class="plain" id="clear">Снять отметки</button>
  <span class="count" id="marked-count"></span>
  <textarea id="out" readonly hidden aria-label="Отмеченные строки"></textarea>
</div>
<div class="wrap">
  <table>
    <thead><tr>${TEXT.head}</tr></thead>
    <tbody id="rows"></tbody>
  </table>
</div>

<script>
const ROWS = ${JSON.stringify(rows)};
const RU = ${ru};
const BINYAN = { paal: 'пааль', nifal: 'нифаль', piel: 'пиэль', pual: 'пуаль', hifil: 'хифиль', hufal: 'хуфаль', hitpael: 'хитпаэль' };
const KEY = RU ? 'hebrew-verbs-review-ru' : 'hebrew-verbs-review-list';
let marks = new Set();
let notes = {};
try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); marks = new Set(Array.isArray(saved) ? saved : saved.marks); notes = (!Array.isArray(saved) && saved.notes) || {}; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(RU ? { marks: [...marks], notes } : [...marks])); } catch {} };
const state = { q: '', binyan: null, hand: false, marked: false };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const plain = (s) => s.replace(/[\\u0591-\\u05C7]/g, '');
const fmt = new Intl.NumberFormat('ru-RU');

const chipBox = document.getElementById('binyanim');
for (const [b, name] of Object.entries(BINYAN)) {
  const n = ROWS.filter((r) => r[5] === b).length;
  const el = document.createElement('button');
  el.className = 'chip'; el.type = 'button'; el.dataset.b = b; el.setAttribute('aria-pressed', 'false');
  el.textContent = name + ' ' + n;
  el.onclick = () => { state.binyan = state.binyan === b ? null : b; render(); };
  chipBox.append(el);
}
const toggle = (id, key) => { document.getElementById(id).onclick = () => { state[key] = !state[key]; render(); }; };
toggle('only-hand', 'hand'); toggle('only-marked', 'marked');
document.getElementById('q').oninput = (e) => { state.q = e.target.value.trim(); render(); };

function matches(r) {
  if (state.binyan && r[5] !== state.binyan) return false;
  if (state.hand && !r[11]) return false;
  if (state.marked && !marks.has(r[1])) return false;
  const q = plain(state.q).replace(/[־.\\-\\s]/g, '');
  if (!q) return true;
  if (/^\\d+$/.test(q)) return String(r[0]) === q;
  if (RU) return r[1].includes(q) || r[3].includes(q) || r[6].includes(q) || (r[8] + ' ' + r[9]).toLowerCase().includes(state.q.toLowerCase());
  return r[1].includes(q) || r[3].includes(q) || r[6].includes(q) || plain(r[7] + r[8] + r[9]).includes(q);
}

const he = (s) => '<span class="he">' + esc(s) + '</span>';
function ruRow(r) {
  const [rank, lemma, head, headPlain, hasInf, b, , translit, translations, pair, phrases] = r;
  const [first, ...rest] = translations.split(', ');
  const marked = marks.has(lemma);
  return '<tr data-lemma="' + esc(lemma) + '"' + (marked ? ' class="marked"' : '') + '>' +
    '<td class="m"><input type="checkbox" aria-label="Отметить ' + esc(headPlain) + '"' + (marked ? ' checked' : '') + '></td>' +
    '<td class="n">' + rank + '</td>' +
    '<td class="verb"><span class="he">' + esc(head) + '<small>' + esc(headPlain) + (hasInf ? '' : ' · <span class="no-inf">нет инфинитива</span>') + '</small></span><span class="tr">' + esc(translit) + '</span></td>' +
    '<td class="b">' + BINYAN[b] + '</td>' +
    '<td class="c"><span class="ru-main">' + esc(first) + '</span>' + (rest.length ? '<span class="ru-rest">, ' + esc(rest.join(', ')) + '</span>' : '') +
    (marked ? '<textarea aria-label="Что исправить" placeholder="Что исправить">' + esc(notes[lemma] || '') + '</textarea>' : '') + '</td>' +
    '<td class="pair">' + esc(pair) + '</td>' +
    '<td><div class="ph">' + phrases.map(([h, t, ruText]) => '<div>' + he(h) + '<span class="tr">' + esc(t) + '</span><span class="ru">' + esc(ruText) + '</span></div>').join('') + '</div></td></tr>';
}

function row(r) {
  if (RU) return ruRow(r);
  const [rank, lemma, head, headPlain, hasInf, b, root, pres, past, fut, freq, status, note] = r;
  const tag = status === 'hand' ? '<span class="tag">вручную</span>' : status === 'checked' ? '<span class="tag">решено</span>' : '';
  return '<tr data-lemma="' + esc(lemma) + '"' + (marks.has(lemma) ? ' class="marked"' : '') + '>' +
    '<td class="m"><input type="checkbox" id="m-' + rank + '" aria-label="Отметить ' + esc(headPlain) + '"' + (marks.has(lemma) ? ' checked' : '') + '></td>' +
    '<td class="n">' + rank + '</td>' +
    '<td class="verb"><span class="he">' + esc(head) + '<small>' + esc(headPlain) + (hasInf ? '' : ' · <span class="no-inf">нет инфинитива</span>') + '</small></span></td>' +
    '<td class="b">' + BINYAN[b] + '</td>' +
    '<td><span class="root">' + esc(root.replace(/[\\u05BF]/g, '')) + '</span></td>' +
    '<td><span class="he">' + esc(pres) + '</span></td>' +
    '<td><span class="he">' + esc(past) + '</span></td>' +
    '<td><span class="he">' + esc(fut) + '</span></td>' +
    '<td class="f">' + fmt.format(freq) + '</td>' +
    '<td class="note">' + tag + esc(note).replace(/([\\u05D0-\\u05EA][\\u0591-\\u05EA]*)/g, '<span class="he">$1</span>') + '</td></tr>';
}

function render() {
  const shown = ROWS.filter(matches);
  document.getElementById('rows').innerHTML = shown.map(row).join('');
  document.getElementById('count').textContent = 'показано ' + shown.length + ' из ' + ROWS.length;
  document.getElementById('marked-count').textContent = marks.size ? 'отмечено: ' + marks.size : '';
  for (const el of chipBox.children) el.setAttribute('aria-pressed', String(el.dataset.b === state.binyan));
  document.getElementById('only-hand').setAttribute('aria-pressed', String(state.hand));
  document.getElementById('only-marked').setAttribute('aria-pressed', String(state.marked));
}

document.getElementById('rows').addEventListener('change', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const lemma = tr.dataset.lemma;
  if (e.target.type !== 'checkbox') return;
  if (e.target.checked) marks.add(lemma); else marks.delete(lemma);
  tr.classList.toggle('marked', e.target.checked);
  save();
  if (RU) tr.outerHTML = row(ROWS.find((x) => x[1] === lemma));
  document.getElementById('marked-count').textContent = marks.size ? 'отмечено: ' + marks.size : '';
});

document.getElementById('rows').addEventListener('input', (e) => {
  if (e.target.tagName !== 'TEXTAREA') return;
  notes[e.target.closest('tr').dataset.lemma] = e.target.value;
  save();
});

document.getElementById('copy').onclick = () => {
  const line = (r) => r[0] + ' ' + r[1] + ' (' + r[3] + ')' + (RU ? ' «' + r[8].split(', ')[0] + '»' + (notes[r[1]] ? ': ' + notes[r[1]] : '') : '');
  const text = ROWS.filter((r) => marks.has(r[1])).map(line).join('\\n') || 'ничего не отмечено';
  const out = document.getElementById('out');
  out.value = text; out.hidden = false;
  const fallback = () => { out.focus(); out.select(); };
  try { navigator.clipboard.writeText(text).then(() => { document.getElementById('copy').textContent = 'Скопировано'; }, fallback); } catch { fallback(); }
};
document.getElementById('clear').onclick = () => { marks.clear(); notes = {}; save(); document.getElementById('out').hidden = true; render(); };
render();
</script>
`;

writeFileSync(out, html);
console.log(`${rows.length} verbs → ${out}`);
