// Builds the app's verb data src/data/verbs.json (the Verb type of
// src/verbs.ts) from the verb list and its Russian: data/verbs.tsv and
// data/tables.tsv (forms by the conjugator or by hand), data/ru.tsv
// (translations), data/ru-forms.json (scripts/ru-forms.py). The output is
// committed: it is data, not a build artefact; src/data/verbs.test.ts checks it.
//
//   node scripts/build-verbs.mjs           # write src/data/verbs.json
//   node scripts/build-verbs.mjs --check   # fail if the file is not up to date
//
// Needs no network, no Python and nothing from .cache/.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formsOf, readList, readTables } from './lib/verbs.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'src/data/verbs.json');

const ru = new Map(
  readFileSync(resolve(root, 'data/ru.tsv'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .map(([lemma, translations]) => [lemma, translations.split(', ')]),
);
const ruForms = JSON.parse(readFileSync(resolve(root, 'data/ru-forms.json'), 'utf8'));
const tables = readTables();

/** Conjugator slots of one tense as a record: 'past.1s' -> '1s'. */
function tense(forms, name, variants) {
  const entries = Object.entries(forms)
    .filter(([key]) => key.startsWith(`${name}.`))
    .map(([key, f]) => [key.slice(name.length + 1), form(f, variants[key])]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

const form = (f, variants) => ({ nikud: f.defective, plain: f.plain, ...(variants ? { variants } : {}), translit: f.translit });

const verbs = readList().map((v) => {
  const forms = formsOf(v, tables);
  const variants = v.flags.variants ?? {};
  const infinitive = forms['infinitive.inf'] ? form(forms['infinitive.inf'], variants['infinitive.inf']) : undefined;
  if (!ru.has(v.lemma) || !ruForms[v.lemma]) throw new Error(`${v.lemma}: no Russian in data/ru.tsv or data/ru-forms.json`);
  return {
    id: v.lemma,
    rank: v.rank,
    binyan: v.binyan,
    // Without the sin dot and the "no dagesh" mark of the conjugator's input.
    root: v.root.replace(/[ֿׁׂ]/gu, '').split(''),
    ru: ru.get(v.lemma),
    lemma: infinitive ?? form(forms['past.3ms'], variants['past.3ms']),
    infinitive,
    present: tense(forms, 'present', variants),
    past: tense(forms, 'past', variants),
    future: tense(forms, 'future', variants),
    futureLiterary: tense(forms, 'literary', variants),
    ruForms: ruForms[v.lemma],
  };
});

// One verb a line: a diff shows the verbs that changed.
const text = `[\n${verbs.map((v) => JSON.stringify(v)).join(',\n')}\n]\n`;
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(out, 'utf8');
  } catch {
    // No file yet: not up to date.
  }
  if (current !== text) {
    console.error('src/data/verbs.json is not up to date: run node scripts/build-verbs.mjs');
    process.exit(1);
  }
  console.log('src/data/verbs.json is up to date');
} else {
  writeFileSync(out, text);
  console.log(`${verbs.length} verbs → ${out} (${Math.round(text.length / 1024)} KB)`);
}
