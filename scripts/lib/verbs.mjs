// The verb list (data/verbs.tsv) and the hand tables (data/tables.tsv) as
// data, and the forms of a listed verb: from the conjugator, or from its
// hand table for a verb flagged "manual".
//
//   import { readList, readTables, formsOf } from './lib/verbs.mjs';
//   const tables = readTables();
//   for (const verb of readList()) formsOf(verb, tables)['past.3ms'];
//   // -> { defective: 'דִּבֵּר', plain: 'דיבר' }

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conjugate } from './conjugate.mjs';

const data = resolve(import.meta.dirname, '../../data');

/** TSV lines without comments, split into columns. */
const rows = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'));

/** @returns {{ rank: number, lemma: string, freq: number, binyan: string, root: string, flags: Record<string, any>, note: string }[]} */
export function readList(file = resolve(data, 'verbs.tsv')) {
  return rows(file).map(([lemma, freq, binyan, root, flags, note = ''], i) => ({
    rank: i + 1,
    lemma,
    freq: Number(freq),
    binyan,
    root,
    flags: flags ? JSON.parse(flags) : {},
    note,
  }));
}

/** lemma -> slot -> { defective, plain } */
export function readTables(file = resolve(data, 'tables.tsv')) {
  const tables = new Map();
  for (const [lemma, slot, defective, plain] of rows(file)) {
    if (!tables.has(lemma)) tables.set(lemma, {});
    tables.get(lemma)[slot] = { defective, plain };
  }
  return tables;
}

/** The forms of a listed verb, slot -> { defective, plain }. */
export function formsOf(verb, tables) {
  if (!verb.flags.manual) return conjugate(verb);
  const table = tables.get(verb.lemma);
  if (!table) throw new Error(`no hand table for ${verb.lemma} in data/tables.tsv`);
  return table;
}
