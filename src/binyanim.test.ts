import { describe, expect, it } from 'vitest';
import { BINYAN_EXAMPLES, BINYAN_KIND, BINYAN_MODELS, MENORAH, PAIR } from './binyanim';
import { verbs } from './testing';
import { texts } from './texts';
import { BINYANIM, type Form } from './verbs';

describe('the menorah', () => {
  it('has each binyan on one branch, hitpael in the middle', () => {
    expect(MENORAH.toSorted()).toEqual(BINYANIM.toSorted());
    expect(MENORAH[3]).toBe('hitpael');
    expect(BINYAN_KIND.hitpael).toBe('reflexive');
  });

  it('mirrors each active binyan by its passive on one arc', () => {
    for (let i = 0; i < 3; i++) {
      const [passive, active] = [MENORAH[i], MENORAH[6 - i]];
      expect(passive && BINYAN_KIND[passive]).toBe('passive');
      expect(active && BINYAN_KIND[active]).toBe('active');
      expect(passive && PAIR[passive]).toBe(active);
      expect(active && PAIR[active]).toBe(passive);
    }
    expect(PAIR.hitpael).toBeUndefined();
  });
});

describe('a binyan', () => {
  it('has three to five examples, verbs of the dictionary in that binyan', () => {
    for (const binyan of BINYANIM) {
      const examples = BINYAN_EXAMPLES[binyan];
      expect(examples.length).toBeGreaterThanOrEqual(3);
      expect(examples.length).toBeLessThanOrEqual(5);
      expect(new Set(examples).size).toBe(examples.length);
      for (const id of examples) expect({ id, binyan: verbs.find((v) => v.id === id)?.binyan }).toEqual({ id, binyan });
    }
  });

  it('has its model forms, an infinitive but in pual and hufal', () => {
    for (const binyan of BINYANIM) {
      const model = BINYAN_MODELS[binyan];
      expect(Object.keys(model.present)).toEqual(['ms', 'fs', 'mp', 'fp']);
      expect(Object.keys(model.past)).toEqual(['3ms', '3fs', '1s', '3p']);
      expect(Object.keys(model.future)).toEqual(['1s', '3ms', '2fs', '3mp']);
      expect(model.infinitive === undefined).toBe(binyan === 'pual' || binyan === 'hufal');
    }
    expect(BINYAN_MODELS.piel.past['3ms'].nikud).toBe('פִּעֵל');
  });
});

const forms = (table: Partial<Record<string, Form>> | undefined): (Form | undefined)[] => Object.values(table ?? {});
/** Both spellings of each form. */
const spellings = (list: (Form | undefined)[]): string[] => list.flatMap((f) => (f ? [f.nikud, f.plain] : []));

const letters = (word: string) => word.replace(/[^\u05D0-\u05EA]/gu, '').length;

describe('the texts of the cards', () => {
  it('spell every Hebrew word as the data does, a prefix, a letter or a root aside', () => {
    const known = new Set([
      ...verbs.flatMap((v) =>
        spellings([v.lemma, v.infinitive].concat(forms(v.present), forms(v.past), forms(v.future), forms(v.futureLiterary))),
      ),
      ...Object.values(BINYAN_MODELS).flatMap((m) => spellings([m.infinitive].concat(forms(m.present), forms(m.past), forms(m.future)))),
    ]);
    const words = Object.values(texts.menorah.binyanim)
      .flatMap(({ meaning, features }) => [meaning, features].flat())
      .flatMap((text) => text.match(/[\u0591-\u05F4]+/gu) ?? []);
    const other = words.filter((w) => !w.endsWith('־') && letters(w) > 1 && !/^(.[\u05C1\u05C2]?־)+.$/u.test(w));
    expect(other.length).toBeGreaterThan(40);
    expect(other.filter((w) => !known.has(w))).toEqual([]);
  });
});
