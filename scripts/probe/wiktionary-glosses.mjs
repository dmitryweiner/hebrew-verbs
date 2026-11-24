// The English glosses of the listed verbs from the cached English Wiktionary
// pages — a reference for writing the Russian translations (data/ru.tsv) by
// hand, nothing of it is copied into the data.
//
//   node scripts/probe/wiktionary-glosses.mjs [--from 1] [--to 100]
//
// One line per verb: rank, lemma, binyan, the past 3ms (infinitive) in
// nikud, then the glosses of the Hebrew verb headword whose nikud is the
// conjugator's past 3ms; "?" marks glosses of all verb headwords of the page
// when none matches, "-" no cached page. Reads .cache/wiktionary.json and
// .cache/wikt/ (scripts/probe/wiktionary.mjs).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formsOf, readList, readTables } from '../lib/verbs.mjs';

const root = resolve(import.meta.dirname, '../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const from = arg('--from', 1);
const to = arg('--to', 1000);

const wikt = JSON.parse(readFileSync(resolve(root, '.cache/wiktionary.json'), 'utf8'));
const strip = (s) => s.normalize('NFC').replace(/[֑-ֽׅ֯ׄ]/g, '');
const text = (html) =>
  html
    .replace(/<style[^>]*>.*?<\/style>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\.mw-parser-output[^}]*\}/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** Top-level <li> texts of the <ol> starting at `at`, nested lists dropped. */
function glossList(html, at) {
  const out = [];
  let depth = 0;
  let cur = null;
  const re = /<(\/?)(ol|ul|dl|li)\b[^>]*>/g;
  re.lastIndex = at;
  let last = at;
  for (let m; (m = re.exec(html));) {
    if (cur !== null && depth === 2) cur += html.slice(last, m.index);
    last = re.lastIndex;
    const close = m[1] === '/';
    if (!close) {
      depth++;
      if (depth === 2 && m[2] === 'li') cur = '';
    } else {
      if (depth === 2 && m[2] === 'li') {
        out.push(text(cur));
        cur = null;
      }
      depth--;
      if (depth === 0) break;
    }
  }
  return out.filter(Boolean);
}

/** Hebrew verb headwords of a page: [{ head, glosses }]. */
function verbs(html) {
  const he = html.indexOf('id="Hebrew"');
  if (he < 0) return [];
  const out = [];
  const re = /<h[34][^>]*>(Verb)<\/h[34]>|<strong class="Hebr headword" lang="he">(.*?)<\/strong>/g;
  re.lastIndex = he;
  let inVerb = false;
  for (let m; (m = re.exec(html));) {
    if (m[1]) inVerb = true;
    else if (inVerb) {
      const ol = html.indexOf('<ol', re.lastIndex);
      // A headword may be "plain / nikud": ניסה / נִסָּה.
      out.push({ head: strip(text(m[2]).split(' / ').at(-1)), glosses: glossList(html, ol) });
      inVerb = false;
    }
    // A next language section ends the Hebrew one.
    const nextLang = html.indexOf('<h2', he + 10);
    if (nextLang > 0 && re.lastIndex > nextLang) break;
  }
  return out;
}

const tables = readTables();
for (const v of readList().slice(from - 1, to)) {
  const forms = formsOf(v, tables);
  const head = forms['past.3ms'].defective;
  const inf = forms['infinitive.inf']?.defective ?? '';
  const title = wikt[v.lemma]?.title ?? v.lemma;
  const file = resolve(root, '.cache/wikt', `${title}.html`);
  let glosses = '-';
  if (existsSync(file)) {
    const found = verbs(readFileSync(file, 'utf8'));
    const match = found.find((f) => f.head === strip(head));
    glosses = match ? match.glosses.join('; ') : `? ${found.map((f) => `${f.head}: ${f.glosses.join('; ')}`).join(' | ')}`;
  }
  console.log(`${v.rank}\t${v.lemma}\t${v.binyan}\t${head} ${inf}\t${glosses}`);
}
