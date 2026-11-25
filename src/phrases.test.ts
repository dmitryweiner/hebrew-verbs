import { describe, expect, it } from 'vitest';
import { formOf, personsOf, TENSES, type Tense } from './persons';
import { ruPhrase } from './phrases';
import { verb, verbs } from './testing';

const phrase = (id: string, tense: Tense, person: string) => {
  const p = personsOf(tense).find((x) => x.id === person);
  if (!p) throw new Error(`no person ${person}`);
  return ruPhrase(verb(id), p);
};

describe('ruPhrase', () => {
  it('says the present by person', () => {
    expect(phrase('אכל', 'present', 'ani-f')).toBe('я (ж.) ем');
    expect(phrase('אכל', 'present', 'hen')).toBe('они (ж.) едят');
  });

  it('says the past by gender, both aspects (decision 13)', () => {
    expect(phrase('אכל', 'past', 'at')).toBe('ты (ж.) ела / съела');
    expect(phrase('אכל', 'past', 'anachnu')).toBe('мы ели / съели');
  });

  it('builds the compound future of the imperfective, the perfective is simple (decision 26)', () => {
    expect(phrase('אכל', 'future', 'ata')).toBe('ты (м.) будешь есть / съешь');
  });

  it('takes a simple imperfective future where the data has one', () => {
    expect(phrase('היה', 'future', 'atem')).toBe('вы (м.) будете');
  });

  it("takes a verb's pair for a woman (decision 27)", () => {
    expect(phrase('התחתן', 'past', 'hu')).toBe('он женился');
    expect(phrase('התחתן', 'past', 'hi')).toBe('она выходила замуж / вышла замуж');
    expect(phrase('התחתן', 'future', 'hen')).toBe('они (ж.) будут выходить замуж / выйдут замуж');
  });

  it('says a passive with был / буду and the short form (decision 25)', () => {
    expect(phrase('הוזמן', 'present', 'hi')).toBe('она приглашена');
    expect(phrase('הוזמן', 'past', 'hi')).toBe('она была приглашена');
    expect(phrase('הוזמן', 'past', 'hem')).toBe('они (м.) были приглашены');
    expect(phrase('הוזמן', 'future', 'ani-m')).toBe('я (м.) буду приглашён');
  });
});

describe('ruPhrase on the data', () => {
  it('says every form of every verb in words', () => {
    const bad = verbs.flatMap((v) =>
      TENSES.flatMap((t) => personsOf(t).filter((p) => formOf(v, p) !== undefined)).flatMap((p) => {
        const s = ruPhrase(v, p);
        return /undefined| \/ $|^\S+ $/u.test(s) ? [`${v.id} ${p.tense} ${p.id}: ${s}`] : [];
      }),
    );
    expect(bad).toEqual([]);
  });
});
