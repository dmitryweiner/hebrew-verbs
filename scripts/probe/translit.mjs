// The transliteration of the listed verbs for a person to look over after a
// change of the rules (scripts/lib/translit.mjs) or of the conjugator:
// forms that look odd, then a sample table, one verb a line.
//
//   node scripts/probe/translit.mjs                 # odd forms + every 10th verb
//   node scripts/probe/translit.mjs --every 1       # all 1000 verbs
//   node scripts/probe/translit.mjs --odd           # odd forms only
//
// Odd: a doubled consonant (legitimate across a boundary: хехлатти, шахха),
// йй, ьь, ь at the start or the end, ь before a consonant. To see what a rule
// change did to every form: node scripts/build-verbs.mjs, then git diff
// src/data/verbs.json.

import { parseArgs } from 'node:util';
import { formsOf, readList, readTables } from '../lib/verbs.mjs';

const { values: args } = parseArgs({
  options: { every: { type: 'string', default: '10' }, odd: { type: 'boolean' } },
});
const ODD = /([бвгджзйклмнпрстфхцчшh])\1|йй|ьь|^ь|ьй|йь|ь$|[^л]ь[^еёюяои]/u;
const SAMPLE = ['infinitive.inf', 'past.3ms', 'past.3fs', 'past.2mp', 'present.ms', 'present.mp', 'future.3ms', 'future.3mp'];

const tables = readTables();
const list = readList();

const odd = list.flatMap((v) =>
  Object.entries(formsOf(v, tables))
    // ль is one sound: leave it out of the ь checks.
    .filter(([, f]) => ODD.test(f.translit.replaceAll('ль', 'L')))
    .map(([key, f]) => `${v.lemma}\t${key}\t${f.defective}\t${f.translit}`),
);
console.log(`odd forms: ${odd.length}`);
console.log(odd.join('\n'));

if (!args.odd) {
  const every = Number(args.every);
  console.log(`\nevery ${every === 1 ? '' : `${every}th `}verb: ${SAMPLE.join(' ')}`);
  for (const [i, v] of list.entries()) {
    if (i % every) continue;
    const f = formsOf(v, tables);
    console.log(`${v.rank}\t${v.binyan}\t${SAMPLE.map((k) => (f[k] ? `${f[k].defective}=${f[k].translit}` : '-')).join(' ')}`);
  }
}
