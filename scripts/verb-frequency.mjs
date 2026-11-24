// Ranks Hebrew verbs by how often their forms occur in spoken Hebrew.
//
// Verb forms (no nikud) come from Hspell's verb generator (AGPL; used only
// here, never shipped), counts from the OpenSubtitles word list
// (hermitdave/FrequencyWords he_50k.txt, CC BY-SA 4.0). A verb's frequency is
// the sum over its forms, with the common one-letter prefixes (ו, ש, כש, ה…)
// counted too. A form shared by several verbs is split in proportion to what
// each verb has from its unshared forms; a form that is also a noun, an
// adjective counts at half weight, one that is a function word (Hspell's
// milot/extrawords lists: של, אחד, יותר) not at all.
//
//   node scripts/verb-frequency.mjs [--top 300] [--detail אכל]
//
// Inputs, in .cache/dl/ (see scripts/fetch-sources.sh):
//   he_50k.txt, woo-forms.txt (perl woo -d woo.dat | iconv to UTF-8),
//   wolig-forms.txt (perl wolig.pl -d wolig.dat), milot.hif.txt,
//   extrawords.hif.txt (both iconv'ed to UTF-8).
// Writes .cache/verb-frequency.json: [{ lemma, freq, forms: {tag: form} }],
// most frequent first. Example: node scripts/verb-frequency.mjs --top 50

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const dl = resolve(root, '.cache/dl');
const { values: args } = parseArgs({
  options: { top: { type: 'string', default: '100' }, detail: { type: 'string' } },
});

const NOUN_PENALTY = 0.5;
const PREFIXES = ['', 'ו', 'ש', 'וש', 'כש', 'ה', 'שה', 'וה', 'כשה', 'מה'];
const INFINITIVE_PREFIXES = ['', 'ו', 'מ', 'ש'];

/** @type {Map<string, number>} */
const counts = new Map();
for (const line of readFileSync(resolve(dl, 'he_50k.txt'), 'utf8').split('\n')) {
  const [word, n] = line.trim().split(' ');
  if (word && n) counts.set(word, Number(n));
}

/** Verbs as { lemma, forms: Map<tag, form> }, one per Hspell block (root + binyan). */
const verbs = [];
let current = null;
for (const line of readFileSync(resolve(dl, 'woo-forms.txt'), 'utf8').split('\n')) {
  if (line.startsWith('#') || line.includes('+') || line.includes('כינוי')) continue;
  if (line.startsWith('-----')) {
    current = null;
    continue;
  }
  const [word, tag] = line.trim().split(' ');
  if (!word || !tag || tag.includes('סמיכות')) continue;
  if (!current) {
    current = { lemma: word.replace(/^L/, 'ל'), forms: new Map() };
    verbs.push(current);
  }
  const key = tag.replace(/^פ,/, '');
  if (!current.forms.has(key)) current.forms.set(key, word.replace(/^L/, 'ל'));
}

const nounish = new Set();
const functionWords = new Set();
for (const line of readFileSync(resolve(dl, 'wolig-forms.txt'), 'utf8').split('\n')) {
  if (line.startsWith('#') || line.includes('+') || line.includes('של/')) continue;
  const word = line.trim().split(' ')[0];
  if (word) nounish.add(word);
}
for (const file of ['milot.hif.txt', 'extrawords.hif.txt'])
  for (const line of readFileSync(resolve(dl, file), 'utf8').split('\n')) {
    const word = line.trim().split(' ')[0];
    if (word && !word.startsWith('#') && !word.startsWith('-')) functionWords.add(word);
  }

/** Surface tokens of a form: the form with each allowed prefix. */
function tokens(form) {
  if (form.startsWith('ל')) return INFINITIVE_PREFIXES.map((p) => p + form);
  return PREFIXES.map((p) => p + form);
}

/** token -> indices of verbs that produce it */
const owners = new Map();
verbs.forEach((verb, i) => {
  const seen = new Set();
  for (const form of verb.forms.values())
    for (const t of tokens(form)) {
      if (seen.has(t) || !counts.has(t)) continue;
      seen.add(t);
      if (!owners.has(t)) owners.set(t, []);
      owners.get(t).push(i);
    }
});

function weight(token) {
  const bare = token.replace(/^(וש|כשה|כש|שה|וה|מה|ו|ש|ה|מ)(?=.{2,})/, '');
  const n = counts.get(token) ?? 0;
  if (functionWords.has(token) || functionWords.has(bare)) return 0;
  return nounish.has(token) || nounish.has(bare) ? n * NOUN_PENALTY : n;
}

// Pass 1: mass from unshared tokens; pass 2: shared tokens split by that mass.
const own = verbs.map(() => 0);
for (const [t, list] of owners) if (list.length === 1) own[list[0]] += weight(t);
const freq = verbs.map(() => 0);
const detail = verbs.map(() => []);
for (const [t, list] of owners) {
  const total = list.reduce((s, i) => s + own[i] + 1, 0);
  for (const i of list) {
    const share = (weight(t) * (own[i] + 1)) / total;
    freq[i] += share;
    detail[i].push([t, Math.round(share), counts.get(t), list.length]);
  }
}

const ranked = verbs
  .map((v, i) => ({ lemma: v.lemma, freq: Math.round(freq[i]), forms: Object.fromEntries(v.forms), i }))
  .toSorted((a, b) => b.freq - a.freq);

writeFileSync(
  resolve(root, '.cache/verb-frequency.json'),
  JSON.stringify(
    ranked.map((v) => ({ lemma: v.lemma, freq: v.freq, forms: v.forms })),
    null,
    1,
  ),
);

const top = Number(args.top);
ranked.slice(0, top).forEach((v, r) => {
  console.log(`${r + 1}\t${v.lemma}\t${v.forms['מקור'] ?? ''}\t${v.freq}`);
});
if (args.detail) {
  for (const v of ranked.filter((x) => x.lemma === args.detail)) {
    console.log(`\n${v.lemma}: ${v.freq}`);
    for (const [t, share, n, k] of detail[v.i].toSorted((a, b) => b[1] - a[1]).slice(0, 30))
      console.log(`  ${t}\t${share}\tof ${n}${k > 1 ? ` shared by ${k}` : ''}`);
  }
}
