// Fetches the English Wiktionary conjugation tables ({{he-conj}}) of the
// sample verbs and writes them as JSON, one entry per verb.
//
//   node scripts/probe/wiktionary.mjs [scripts/probe/sample-50.tsv]
//
// Pages are cached in .cache/wikt/<title>.html (delete to refetch); output
// is merged into .cache/wiktionary.json:
//   { [lemma]: { title, params, past: {slot: [{plain, nikud}]}, ... } | null }
// A page is looked up by the plene lemma, then by its defective spelling
// (דיבר → דבר). Of its tables the one whose past 3ms is the lemma is taken:
// by Wiktionary's own plain spelling, else by the conjugator's spelling of
// the table's parameters (Wiktionary writes התכון for התכוון, ערב for both
// עָרַב and עֵרֵב), else by the letters without ו/י — then marked `loose`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conjugate } from '../lib/conjugate.mjs';
import { fromWiktionary } from '../lib/wiktionary-flags.mjs';
import { readSample } from './sample.mjs';

const root = resolve(import.meta.dirname, '../..');
const cacheDir = resolve(root, '.cache/wikt');
mkdirSync(cacheDir, { recursive: true });
const USER_AGENT = 'hebrew-verbs-probe/0.1 (https://github.com/dmitryweiner/hebrew-verbs)';

async function page(title) {
  const file = resolve(cacheDir, `${title}.html`);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  await new Promise((r) => setTimeout(r, 300));
  const url = `https://en.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const html = res.ok ? await res.text() : '';
  writeFileSync(file, html);
  return html;
}

const NIKUD = /[֑-ׇ]/;
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

/** Alternatives in one table cell: [{ plain, nikud }]. */
function cell(html) {
  const out = [];
  // The link target is the plain spelling; a self-link has no title, so href.
  for (const m of html.matchAll(/<a [^>]*href="\.\/([^"?#]+)[^"]*"[^>]*>(.*?)<\/a>/gs)) {
    const plain = decodeURIComponent(m[1]);
    const parts = decode(m[2])
      .split('/')
      .map((s) => s.trim());
    const nikud = parts.find((p) => NIKUD.test(p)) ?? parts[0];
    out.push({ plain, nikud });
  }
  return out;
}

const SLOTS = {
  past: { first: ['1s', '1p'], second: ['2ms', '2fs', '2mp', '2fp'], third: ['3ms', '3fs', '3p'] },
  future: {
    first: ['1s', '1p'],
    second: ['2ms', '2fs', '2mp', '2fp'],
    third: ['3ms', '3fs', '3mp', '3fp'],
  },
  imperative: { positive: ['2ms', '2fs', '2mp', '2fp'] },
};

function parseTable(table) {
  const params = JSON.parse(decode(table.match(/data-mw='([^']+)'/)?.[1] ?? '{}').replace(/&quot;/g, '"') || '{}').parts?.[0]?.template
    ?.params;
  const result = { params: Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, v.wt])) };
  let tense = null;
  for (const row of table.matchAll(/<tr>(.*?)<\/tr>/gs)) {
    const heads = [...row[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => decode(m[1]));
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => cell(m[1]));
    if (heads.includes('to-infinitive')) result.infinitive = cells[0];
    for (const h of heads) if (h in SLOTS || h === 'present') tense = h;
    if (!tense || cells.length === 0) continue;
    if (tense === 'present') {
      result.present = Object.fromEntries(['ms', 'fs', 'mp', 'fp'].map((s, i) => [s, cells[i]]));
      tense = null;
      continue;
    }
    const person = heads.find((h) => h in SLOTS[tense]);
    if (!person) continue;
    result[tense] ??= {};
    SLOTS[tense][person].forEach((slot, i) => (result[tense][slot] = cells[i]));
  }
  const notes = table.match(/<\/table>(.*)$/s)?.[1];
  if (notes) result.notes = decode(notes).replace(/\s+/g, ' ').slice(0, 600);
  return result;
}

/** Forms in a {{he-verb-conjugation}} parameter: [[target|text]] links. */
const manualForms = (wt) =>
  [...wt.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((m) => {
    const parts = (m[2] ?? m[1]).split('/').map((x) => x.trim());
    return { plain: strip(m[1]), nikud: parts.find((x) => NIKUD.test(x)) ?? parts[0] };
  });

/** {{he-verb-conjugation}}: a hand-written table, forms in its parameters. */
function manualTable(html) {
  const raw = html.match(/data-mw='([^']*he-verb-conjugation[^']*)'/)?.[1];
  if (!raw) return null;
  const json = raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
  const params = JSON.parse(json).parts[0].template.params;
  const result = { params: { manual: '+' } };
  const tense = { p: 'past', pr: 'present', fut: 'future', imp: 'imperative' };
  for (const [key, { wt }] of Object.entries(params)) {
    if (key === 'inf') result.infinitive = manualForms(wt);
    const [t, slot] = key.split('.');
    if (!tense[t] || !slot) continue;
    result[tense[t]] ??= {};
    result[tense[t]][slot] = manualForms(wt);
  }
  return result;
}

const strip = (s) => s.replace(/[\u0591-\u05C7]/g, '');
/** Spelling-insensitive key: no matres lectionis (ו, י), no final forms. */
const skeleton = (s) => strip(s).replace(/[וי]/g, '');

function tables(html) {
  const out = [];
  const manual = manualTable(html);
  if (manual) out.push(manual);
  const re = /<div class="inflection-table-wrapper[^"]*"[^>]*data-mw='[^']*he-conj[^']*'[^>]*>.*?<\/table>.*?<\/div>/gs;
  for (const m of html.matchAll(re)) out.push(parseTable(m[0]));
  return out;
}

/** The conjugator's plain past 3ms for a table's parameters, if it can tell. */
function ownLemma(table) {
  try {
    const verb = fromWiktionary(table.params);
    return verb ? conjugate(verb)['past.3ms']?.plain : undefined;
  } catch {
    return undefined;
  }
}

/** דיבר → דבר, סיפר → ספר: the defective spelling of a piel lemma. */
const defective = (lemma) => [lemma.replace(/^(.)י/, '$1'), lemma.replace(/^(.)ו/, '$1')];

const sample = readSample(process.argv[2]);
const outFile = resolve(root, '.cache/wiktionary.json');
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
for (const { lemma } of sample) {
  out[lemma] = null;
  for (const title of new Set([lemma, ...defective(lemma)])) {
    const all = tables(await page(title));
    const loose = all.find((t) => t.past?.['3ms']?.some((f) => skeleton(f.plain) === skeleton(lemma)));
    const found = all.find((t) => t.past?.['3ms']?.some((f) => f.plain === lemma)) ?? all.find((t) => ownLemma(t) === lemma);
    if (found || loose) {
      out[lemma] = found ? { title, ...found } : { title, loose: true, ...loose };
      break;
    }
  }
  console.log(`${lemma}\t${out[lemma] ? `${out[lemma].title}\t${JSON.stringify(out[lemma].params)}` : '—'}`);
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
