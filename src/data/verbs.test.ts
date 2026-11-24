import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVerbs, type Form, type Verb } from '../verbs.ts';

// The generated data (scripts/build-verbs.mjs), checked as the app will read it.
const verbs = parseVerbs(JSON.parse(readFileSync(new URL('verbs.json', import.meta.url), 'utf8')));

const NIKUD = /[֑-ׇ]/u;
const strip = (s: string) => s.replace(/[֑-ׇ]/gu, '');
const skeleton = (s: string) => strip(s).replace(/[וי]/gu, '');
const FINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const letters = (s: string) => s.replace(/[ךםןףץ]/gu, (c) => FINAL[c] ?? c);
/** All forms of a verb with their slot names. */
const formsOf = (v: Verb): [string, Form][] => [
  ['lemma', v.lemma],
  ...Object.entries({ infinitive: v.infinitive }).filter((e): e is [string, Form] => e[1] !== undefined),
  ...[v.present, v.past, v.future, v.futureLiterary].flatMap((t) => Object.entries(t ?? {})),
];

describe('the verb data', () => {
  it('has the 1000 verbs in order of frequency, ids unique', () => {
    expect(verbs).toHaveLength(1000);
    expect(verbs.map((v) => v.rank)).toEqual(verbs.map((_, i) => i + 1));
    expect(new Set(verbs.map((v) => v.id)).size).toBe(verbs.length);
  });

  it('takes its id from the past 3ms and its headword from the infinitive, where there is one', () => {
    expect(verbs.filter((v) => v.id !== v.past['3ms'].plain).map((v) => v.id)).toEqual([]);
    expect(verbs.filter((v) => v.lemma.nikud !== (v.infinitive ?? v.past['3ms']).nikud).map((v) => v.id)).toEqual([]);
  });

  it('writes nikud with marks, plain without, translit in Cyrillic', () => {
    const bad = verbs.flatMap((v) =>
      formsOf(v)
        .filter(([, f]) => !NIKUD.test(f.nikud) || NIKUD.test(f.plain) || !/^[а-яёh]+$/u.test(f.translit))
        .map(([slot]) => `${v.id} ${slot}`),
    );
    expect(bad).toEqual([]);
  });

  it('spells plain as the nikud letters plus vowel letters ו and י', () => {
    const bad = verbs.flatMap((v) =>
      formsOf(v)
        .filter(([, f]) => skeleton(f.nikud) !== skeleton(f.plain))
        .map(([slot, f]) => `${v.id} ${slot} ${f.nikud} ${f.plain}`),
    );
    expect(bad).toEqual([]);
  });

  it('has the strong root letters in the past 3ms', () => {
    const bad = verbs.filter((v) => v.root.some((r) => !'אהוינ'.includes(r) && !letters(v.past['3ms'].plain).includes(letters(r))));
    expect(bad.map((v) => `${v.id} ${v.root.join('')}`)).toEqual([]);
  });

  it('has no two verbs with the same infinitive and the same translation', () => {
    const seen = new Map<string, string>();
    const twins: string[] = [];
    for (const v of verbs)
      for (const ru of v.ru) {
        const key = `${v.lemma.plain} ${ru}`;
        const other = seen.get(key);
        if (other) twins.push(`${other} ${v.id} ${ru}`);
        seen.set(key, v.id);
      }
    expect(twins).toEqual([]);
  });

  it('spells plain as Hspell does (data/hspell.tsv, compare.mjs --snapshot)', () => {
    const hspell = new Map(
      readFileSync(new URL('../../data/hspell.tsv', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => l.split('\t'))
        .map(([lemma = '', slot = '', spellings = '']) => [`${lemma} ${slot}`, spellings.split(' ')]),
    );
    // Decided otherwise, by hand (data/verbs.tsv, the notes "checked: …").
    const decided = new Set(['יצר future.1s', 'נע literary.2fp', 'נע literary.3fp']);
    const bad: string[] = [];
    for (const v of verbs) {
      const tenses: [string, Partial<Record<string, Form>> | undefined][] = [
        ['present', v.present],
        ['past', v.past],
        ['future', v.future],
        ['literary', v.futureLiterary],
      ];
      const slots: [string, Form | undefined][] = [['infinitive.inf', v.infinitive]];
      for (const [tense, table] of tenses) for (const [slot, f] of Object.entries(table ?? {})) slots.push([`${tense}.${slot}`, f]);
      for (const [slot, f] of slots) {
        const expected = hspell.get(`${v.id} ${slot}`);
        if (!f || !expected || decided.has(`${v.id} ${slot}`)) continue;
        if (![f.plain, ...(f.variants ?? [])].some((p) => expected.includes(p)))
          bad.push(`${v.id} ${slot} ${f.plain} ≠ ${expected.join('/')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
