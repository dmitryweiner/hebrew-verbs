import { describe, expect, it } from 'vitest';
import { formsOf, readList, readTables } from './verbs.mjs';

const list = readList();
const tables = readTables();

describe('the verb list', () => {
  it('has unique lemmas, a binyan and a root on every line', () => {
    expect(new Set(list.map((v) => v.lemma)).size).toBe(list.length);
    const binyanim = new Set(['paal', 'nifal', 'piel', 'pual', 'hifil', 'hufal', 'hitpael']);
    expect(list.filter((v) => !binyanim.has(v.binyan) || !v.root || v.root === '?')).toEqual([]);
  });

  it('is ordered by frequency', () => {
    expect(list.filter((v, i) => i > 0 && v.freq > list[i - 1].freq)).toEqual([]);
  });

  it('conjugates every verb to its lemma in the past 3ms', () => {
    const wrong = list.map((v) => [v.lemma, formsOf(v, tables)['past.3ms']?.plain]).filter(([lemma, plain]) => lemma !== plain);
    expect(wrong).toEqual([]);
  });
});
