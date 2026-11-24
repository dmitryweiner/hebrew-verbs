// Estimates how many of the most frequent verbs have a conjugation table on
// the English Wiktionary: lists the pages that use {{he-conj}} or
// {{he-verb-conjugation}} and matches them against .cache/verb-frequency.json
// by spelling skeleton (no ו/י, no final forms), so plene and defective
// spellings meet. Binyan is not checked: an upper estimate.
//
//   node scripts/probe/wiktionary-coverage.mjs [--top 1000]
//
// Caches the page list in .cache/wikt-conj-pages.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const { values: args } = parseArgs({ options: { top: { type: 'string', default: '1000' } } });
const cache = resolve(root, '.cache/wikt-conj-pages.json');
const USER_AGENT = 'hebrew-verbs-probe/0.1 (https://github.com/dmitryweiner/hebrew-verbs)';

async function embeddedIn(template) {
  const titles = [];
  let cont = {};
  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'embeddedin',
      eititle: template,
      einamespace: '0',
      eilimit: '500',
      format: 'json',
      formatversion: '2',
      ...cont,
    });
    const res = await fetch(`https://en.wiktionary.org/w/api.php?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    const data = await res.json();
    titles.push(...data.query.embeddedin.map((p) => p.title));
    cont = data.continue ?? null;
  } while (cont);
  return titles;
}

if (!existsSync(cache)) {
  const pages = [...(await embeddedIn('Template:he-conj')), ...(await embeddedIn('Template:he-verb-conjugation'))];
  writeFileSync(cache, JSON.stringify(pages));
}
const pages = JSON.parse(readFileSync(cache, 'utf8'));
const finals = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const skeleton = (s) => [...s.replace(/[וי]/g, '')].map((c) => finals[c] ?? c).join('');
const known = new Set(pages.map(skeleton));

const ranked = JSON.parse(readFileSync(resolve(root, '.cache/verb-frequency.json'), 'utf8'));
const top = ranked.slice(0, Number(args.top));
const missing = top.filter((v) => !known.has(skeleton(v.lemma)));
console.log(`pages with a table: ${pages.length}`);
console.log(`top ${top.length} Hspell verbs (unreviewed, junk included): ${top.length - missing.length} matched`);
console.log(
  `missing, most frequent first: ${missing
    .slice(0, 60)
    .map((v) => v.lemma)
    .join(' ')}`,
);
