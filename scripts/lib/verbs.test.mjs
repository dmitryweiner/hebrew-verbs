import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/** Do these generated forms come from this pair? */
const same = (f, ipf, pf) => f?.ipf === ipf && (f?.pf ?? '') === pf;

describe('the Russian of the list', () => {
  const data = resolve(import.meta.dirname, '../../data');
  const ru = readFileSync(resolve(data, 'ru.tsv'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'));
  const forms = JSON.parse(readFileSync(resolve(data, 'ru-forms.json'), 'utf8'));

  it('translates every listed verb once, with an imperfective for the phrases', () => {
    expect(ru.map(([lemma]) => lemma).toSorted()).toEqual(list.map((v) => v.lemma).toSorted());
    expect(ru.filter(([, translations, ipf]) => !translations || !ipf)).toEqual([]);
  });

  it('has the forms of the current pairs (scripts/ru-forms.py was run)', () => {
    const stale = ru.filter(
      ([lemma, , ipf, pf = '', ipfF = '', pfF = '']) =>
        !same(forms[lemma], ipf, pf) || (ipfF ? !same(forms[lemma].f, ipfF, pfF) : forms[lemma]?.f),
    );
    expect(stale.map(([lemma]) => lemma)).toEqual([]);
  });

  it('gives a woman her own pair where Russian says it otherwise: она вышла замуж', () => {
    for (const lemma of ['התחתן', 'נישא']) {
      expect(forms[lemma].past.ipf.m).toBe('женился');
      expect(forms[lemma].f.past.pf.f).toBe('вышла замуж');
    }
  });
});
