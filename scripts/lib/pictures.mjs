// The illustrations' data src/data/pictures.json (plan 1.4; the app reads it
// with src/pictures.ts): reading, writing in a stable form (one verb a line,
// in order of frequency) and applying a person's decision from the review
// page (scripts/review-pictures.mjs) and that page itself.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emojiFile, emojiParts } from '../../src/pictures.ts';

export const PICTURES_FILE = resolve(import.meta.dirname, '../../src/data/pictures.json');
export const DRAWINGS_DIR = resolve(import.meta.dirname, '../../public/pictures');

export const readPictures = () => JSON.parse(readFileSync(PICTURES_FILE, 'utf8'));

/** The file's text; ranks maps a verb id to its rank. */
export function serializePictures(pictures, ranks) {
  const unknown = Object.keys(pictures).filter((id) => !ranks.has(id));
  if (unknown.length) throw new Error(`pictures of verbs not in the list: ${unknown.join(' ')}`);
  const lines = Object.entries(pictures)
    .toSorted(([a], [b]) => ranks.get(a) - ranks.get(b))
    .map(([id, entry]) => `${JSON.stringify(id)}: ${JSON.stringify(entry)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/**
 * Entries from "<id> <what>" lines, what = an emoji (or a pair), "svg" or
 * "none"; blank lines and "#" comments are skipped. All get the given review.
 */
export function parseBatch(text, review) {
  const entries = {};
  for (const line of text.split('\n')) {
    const [id, what] = line.trim().split(/\s+/);
    if (!id || id.startsWith('#')) continue;
    if (!what) throw new Error(`no picture for ${id}`);
    if (entries[id]) throw new Error(`${id} is given twice`);
    entries[id] = what === 'svg' || what === 'none' ? { kind: what, review } : { kind: 'emoji', emoji: what, review };
  }
  return entries;
}

/**
 * A decision on one verb: ok, redo (needs a comment) or remove (the verb gets
 * an approved "no picture"). Returns new pictures, the new entry and whether
 * the verb's drawing file is to be deleted.
 */
export function applyReview(pictures, { id, action, comment }) {
  const old = pictures[id];
  if (!old) throw new Error(`no picture entry for ${id}`);
  const note = typeof comment === 'string' && comment.trim() ? { comment: comment.trim() } : {};
  let entry;
  if (action === 'ok') entry = { ...withoutComment(old), review: 'ok', ...note };
  else if (action === 'redo') {
    if (!note.comment) throw new Error('redo needs a comment');
    entry = { ...withoutComment(old), review: 'redo', ...note };
  } else if (action === 'remove') entry = { kind: 'none', review: 'ok', ...note };
  else throw new Error(`unknown action ${action}`);
  return { pictures: { ...pictures, [id]: entry }, entry, deleteDrawing: action === 'remove' && old.kind === 'svg' };
}

function withoutComment(entry) {
  const { comment: _, ...rest } = entry;
  return rest;
}

const STATUS = { pending: 'ждёт', ok: 'хорошо', redo: 'переделать' };
const link = (q, text) => `<a href="?${new URLSearchParams(q)}">${text}</a>`;
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The review page (Russian, like the app): a card per verb with a picture
 * entry, in order of frequency, the picture on a light and a dark ground, the
 * status, a comment and the decisions. query: from, to (ranks), status.
 * drawings maps a verb id to its SVG source.
 */
export function reviewPage({ verbs, pictures, drawings, query }) {
  const from = Number(query.get('from') ?? 1);
  const to = Number(query.get('to') ?? Infinity);
  const status = query.get('status');
  const shown = verbs.filter((v) => pictures[v.id] && v.rank >= from && v.rank <= to && (!status || pictures[v.id].review === status));
  const art = (v, e) =>
    e.kind === 'svg'
      ? (drawings.get(v.id) ?? '<p>нет файла</p>')
      : e.kind === 'emoji'
        ? `<span class="emoji">${e.emoji}</span><span class="twemoji">${emojiParts(e.emoji)
            .map((part) => `<img src="emoji/${emojiFile(part)}" alt="">`)
            .join('')}</span>`
        : '<p>без картинки</p>';
  const card = (v) => {
    const e = pictures[v.id];
    return `<article class="card ${e.review}" data-id="${escape(v.id)}" data-kind="${e.kind}">
<header><span class="rank">${v.rank}</span> <b lang="he" dir="rtl">${v.lemma.nikud}</b> <span class="status">${STATUS[e.review]}</span></header>
<p class="ru">${escape(v.ru.join(', '))}</p>
<div class="art"><div class="light">${art(v, e)}</div><div class="dark">${art(v, e)}</div></div>
<textarea rows="2" placeholder="комментарий">${escape(e.comment ?? '')}</textarea>
<div class="buttons"><button data-action="ok">хорошо</button><button data-action="redo">переделать</button>${
      e.kind === 'none' ? '' : '<button data-action="remove">убрать картинку</button>'
    }</div><p class="error"></p></article>`;
  };
  const counts = {};
  for (const e of Object.values(pictures)) counts[e.review] = (counts[e.review] ?? 0) + 1;
  const batches = Array.from({ length: Math.ceil(verbs.length / 100) }, (_, i) =>
    link({ from: i * 100 + 1, to: i * 100 + 100 }, `${i * 100 + 1}–${i * 100 + 100}`),
  );
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Иллюстрации — проверка</title>
<style>
body { font: 15px/1.4 system-ui, sans-serif; margin: 16px; background: #f3f7f5; color: #142821; }
nav { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-block-end: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.card { background: #fff; border: 2px solid #ccd; border-radius: 8px; padding: 10px; }
.card.ok { border-color: #16725f; } .card.redo { border-color: #c0392b; }
.status { float: inline-end; font-size: 13px; } .ok .status { color: #16725f; } .redo .status { color: #c0392b; }
.rank { color: #53675f; } b[lang] { font-size: 20px; } .ru { margin: 4px 0; }
.art { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.art > div { display: grid; place-items: center; block-size: 128px; border-radius: 6px; position: relative; }
.light { background: #fff; color: #142821; outline: 1px solid #dde; } .dark { background: #182823; color: #e4f0eb; }
.art svg { inline-size: 112px; block-size: 112px; } .emoji { font-size: 60px; line-height: 1; white-space: nowrap; }
.twemoji { position: absolute; inset-block-end: 4px; inset-inline-end: 4px; } .twemoji img { inline-size: 24px; }
textarea { box-sizing: border-box; inline-size: 100%; margin-block: 8px 4px; font: inherit; }
.buttons { display: flex; gap: 6px; flex-wrap: wrap; } button { font: inherit; padding: 4px 10px; }
.error { color: #c0392b; margin: 4px 0 0; min-block-size: 1em; }
</style></head><body>
<h1>Иллюстрации</h1>
<nav>${link({}, 'все')} ${batches.join(' ')}</nav>
<nav>${link({ ...Object.fromEntries(query), status: 'pending' }, `ждут: ${counts.pending ?? 0}`)} ${link({ ...Object.fromEntries(query), status: 'redo' }, `переделать: ${counts.redo ?? 0}`)} ${link({ ...Object.fromEntries(query), status: 'ok' }, `хорошо: ${counts.ok ?? 0}`)}</nav>
<p>Показано: ${shown.length}. Решение сразу пишется в src/data/pictures.json; «переделать» — с комментарием.</p>
<div class="grid">${shown.map(card).join('\n')}</div>
<script type="module">
const STATUS = ${JSON.stringify(STATUS)};
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('.card');
  const error = card.querySelector('.error');
  const comment = card.querySelector('textarea').value;
  const action = button.dataset.action;
  if (action === 'redo' && !comment.trim()) {
    error.textContent = 'Напишите, что переделать.';
    card.querySelector('textarea').focus();
    return;
  }
  const res = await fetch(location.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: card.dataset.id, action, comment }) });
  if (!res.ok) return (error.textContent = await res.text());
  if (action === 'remove') return location.reload();
  const entry = await res.json();
  error.textContent = '';
  card.className = 'card ' + entry.review;
  card.querySelector('.status').textContent = STATUS[entry.review];
});
</script></body></html>
`;
}
