// Writes the conjugator's test fixture, scripts/lib/conjugate.golden.json:
// for each verb of the given sample lists, the expected form of every slot —
// nikud from the English Wiktionary table, spelling without nikud from
// Hspell (Wiktionary's own plain spellings are unreliable, stage 0 report),
// with the plan's decisions applied (`expectedForms` in probe/sources.mjs);
// and the verb's {{he-conj}} parameters, the test of
// scripts/lib/wiktionary-flags.mjs.
//
//   node scripts/conjugator-golden.mjs scripts/probe/sample-50.tsv scripts/probe/holdout-50.tsv
//
// Needs .cache/wiktionary.json for these verbs (scripts/probe/wiktionary.mjs
// <list>) and .cache/dl/woo-forms.txt (scripts/fetch-sources.sh). Verbs
// already in the fixture keep their `todo` mark (a known difference the
// conjugator does not handle yet: scripts/lib/conjugate.test.mjs skips it);
// verbs without a Wiktionary table are left out.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readSample } from './probe/sample.mjs';
import { expectedForms, hspellBlock, loadHspell, loadWiktionary, wiktionarySlots } from './probe/sources.mjs';

const OUT = resolve(import.meta.dirname, 'lib/conjugate.golden.json');
const files = process.argv.slice(2);
if (files.length === 0) throw new Error('usage: node scripts/conjugator-golden.mjs <sample.tsv>...');

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const todo = new Map(previous.filter((v) => v.todo).map((v) => [v.lemma, v.todo]));
const hspell = loadHspell();
const wikt = loadWiktionary();

const verbs = new Map(previous.map((v) => [v.lemma, v]));
for (const verb of files.flatMap((f) => readSample(resolve(f)))) {
  const w = wiktionarySlots(wikt[verb.lemma]);
  if (!w || verb.flags.manual) continue;
  const expected = expectedForms(verb, w, hspellBlock(hspell, verb.lemma, w));
  const forms = Object.fromEntries(Object.entries(expected).map(([key, e]) => [key, [e.nikud.join(' / '), e.plain.join(' / ')]]));
  const { params } = wikt[verb.lemma];
  const entry = { lemma: verb.lemma, binyan: verb.binyan, root: verb.root, flags: verb.flags, wiktionary: params };
  if (todo.has(verb.lemma)) entry.todo = todo.get(verb.lemma);
  verbs.set(verb.lemma, { ...entry, forms });
}

// One verb per block, one slot per line: readable diffs.
const block = ({ forms, ...head }) => {
  const top = Object.entries(head).map(([k, x]) => `    ${JSON.stringify(k)}: ${JSON.stringify(x)},`);
  const body = Object.entries(forms).map(([k, f]) => `      ${JSON.stringify(k)}: ${JSON.stringify(f)}`);
  return `  {\n${top.join('\n')}\n    "forms": {\n${body.join(',\n')}\n    }\n  }`;
};
writeFileSync(OUT, `[\n${[...verbs.values()].map(block).join(',\n')}\n]\n`);
console.log(`${verbs.size} verbs → ${OUT}`);
