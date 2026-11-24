// Drafts and refreshes the verb list, data/verbs.tsv: the most frequent verbs
// of .cache/verb-frequency.json that are not in data/not-verbs.tsv, with
// binyan, root and flags from their Wiktionary parameters
// (scripts/lib/wiktionary-flags.mjs). A line a person decided carries a note
// starting with "by hand:" or "checked:" and is kept (binyan, root, flags,
// note) with the new frequency — a verb Hspell lacks (יכול) with its own;
// any other line is drafted again; a lemma in not-verbs.tsv leaves the list.
// The list is ordered by frequency: the line number is the rank.
//
//   node scripts/verb-list.mjs [--count 1000]
//
// Needs .cache/verb-frequency.json (scripts/verb-frequency.mjs) and
// .cache/wiktionary.json for the candidates (scripts/probe/wiktionary.mjs).
// New lines are printed: a `?` binyan means no usable Wiktionary table — fill
// it in by hand or move the lemma to not-verbs.tsv.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fromWiktionary } from './lib/wiktionary-flags.mjs';

const root = resolve(import.meta.dirname, '..');
const LIST = resolve(root, 'data/verbs.tsv');
const NOT_VERBS = resolve(root, 'data/not-verbs.tsv');
const { values: args } = parseArgs({ options: { count: { type: 'string', default: '1000' } } });

const HEADER = `# The verb list: the most frequent Hebrew verbs, most frequent first (the
# line number is the rank). Drafted by scripts/verb-list.mjs, then by hand.
# lemma: past 3ms in plene spelling, as Hspell has it — the verb's id.
# freq: scripts/verb-frequency.mjs (by hand for a verb Hspell lacks).
# binyan, root (שׂ = sin, פֿ = no dagesh), flags: the conjugator's input
# (scripts/lib/conjugate.mjs); note: "by hand: …" or "checked: …" marks a
# line a person decided (kept as is), anything else is redrafted.
# lemma\tfreq\tbinyan\troot\tflags\tnote`;

/** TSV lines without comments, split into columns. */
const rows = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => l.split('\t'))
    : [];

const ranked = JSON.parse(readFileSync(resolve(root, '.cache/verb-frequency.json'), 'utf8'));
const wikt = JSON.parse(readFileSync(resolve(root, '.cache/wiktionary.json'), 'utf8'));
const notVerbs = new Set(rows(NOT_VERBS).map(([lemma]) => lemma));
const freq = new Map();
for (const v of ranked) if (!freq.has(v.lemma)) freq.set(v.lemma, v.freq);

/** @type {Map<string, { lemma: string, freq: number, binyan: string, root: string, flags: string, note: string }>} */
const list = new Map();
for (const [lemma, f, binyan, rootLetters, flags = '', note = ''] of rows(LIST))
  if (notVerbs.has(lemma)) console.log(`- ${lemma}`);
  else list.set(lemma, { lemma, freq: freq.get(lemma) ?? Number(f), binyan, root: rootLetters, flags, note });
// A line nobody has decided is drafted again: the table or the mapping may be better now.
for (const [lemma, v] of list) if (!/^(by hand|checked):/.test(v.note)) list.delete(lemma);

/** A new line from the lemma's Wiktionary table, or `?` fields and why. */
function draft(lemma) {
  const entry = wikt[lemma];
  const line = { lemma, freq: freq.get(lemma) ?? 0, binyan: '?', root: '?', flags: '', note: '' };
  if (entry === undefined) return { ...line, note: 'not fetched: scripts/probe/wiktionary.mjs' };
  if (entry === null) return { ...line, note: 'no Wiktionary table' };
  if (entry.loose) return { ...line, note: `only a loose Wiktionary match: ${entry.title}` };
  try {
    const verb = fromWiktionary(entry.params);
    if (!verb) return { ...line, note: 'hand-written Wiktionary table' };
    const flags = Object.keys(verb.flags).length ? JSON.stringify(verb.flags) : '';
    return { ...line, binyan: verb.binyan, root: verb.root, flags, note: verb.notes.join('; ') };
  } catch (error) {
    return { ...line, note: error.message };
  }
}

const added = [];
for (const lemma of freq.keys()) {
  if (list.size >= Number(args.count)) break;
  if (list.has(lemma) || notVerbs.has(lemma)) continue;
  const line = draft(lemma);
  list.set(lemma, line);
  added.push(line);
}

const sorted = [...list.values()].toSorted((a, b) => b.freq - a.freq);
const body = sorted.map((v) => [v.lemma, v.freq, v.binyan, v.root, v.flags, v.note].join('\t').trimEnd());
writeFileSync(LIST, `${HEADER}\n${body.join('\n')}\n`);
for (const v of added) console.log(`+ ${sorted.indexOf(v) + 1}\t${v.lemma}\t${v.binyan}\t${v.root}\t${v.flags}\t${v.note}`);
console.log(`${sorted.length} verbs in data/verbs.tsv, ${added.length} new`);
