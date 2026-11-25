import { describe, expect, it } from 'vitest';
import { formOf, personsOf, PRONOUNS, TENSES, type Tense } from './persons';
import { texts } from './texts';
import { verb } from './testing';
import { FUTURE_SLOTS, PAST_SLOTS, PRESENT_SLOTS } from './verbs';

const labels = (tense: Tense) => personsOf(tense).map((p) => `${p.pronoun.plain} ${p.label} ${p.slot}`);
const person = (tense: Tense, id: string) => personsOf(tense).find((p) => p.id === id);

describe('persons', () => {
  it('cover every slot of every tense', () => {
    expect(new Set(personsOf('present').map((p) => p.slot))).toEqual(new Set(PRESENT_SLOTS));
    expect(new Set(personsOf('past').map((p) => p.slot))).toEqual(new Set(PAST_SLOTS));
    expect(new Set(personsOf('future').map((p) => p.slot))).toEqual(new Set(FUTURE_SLOTS));
  });

  it('follow the plan: the present needs the gender of я and мы, the past and future only of я', () => {
    expect(labels('present')).toEqual([
      'אני я (м.) ms',
      'אני я (ж.) fs',
      'אתה ты (м.) ms',
      'את ты (ж.) fs',
      'הוא он ms',
      'היא она fs',
      'אנחנו мы (м.) mp',
      'אנחנו мы (ж.) fp',
      'אתם вы (м.) mp',
      'אתן вы (ж.) fp',
      'הם они (м.) mp',
      'הן они (ж.) fp',
    ]);
    expect(labels('past')).toEqual([
      'אני я (м.) 1s',
      'אני я (ж.) 1s',
      'אתה ты (м.) 2ms',
      'את ты (ж.) 2fs',
      'הוא он 3ms',
      'היא она 3fs',
      'אנחנו мы 1p',
      'אתם вы (м.) 2mp',
      'אתן вы (ж.) 2fp',
      'הם они (м.) 3p',
      'הן они (ж.) 3p',
    ]);
    expect(personsOf('future').map((p) => p.slot)).toEqual(['1s', '1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3mp', '3fp']);
  });

  it('give the Russian person and gender of the phrase', () => {
    expect(person('past', 'ani-f')?.ru).toEqual({ person: '1s', gender: 'f', feminine: true });
    expect(person('present', 'ata')?.ru).toEqual({ person: '2s', gender: 'm', feminine: false });
    expect(person('past', 'anachnu')?.ru).toEqual({ person: '1p', gender: 'pl', feminine: false });
    expect(person('future', 'hen')?.ru).toEqual({ person: '3p', gender: 'pl', feminine: true });
  });

  it('take their labels from the texts', () => {
    for (const tense of TENSES) for (const p of personsOf(tense)) expect(p.label).toBe(texts.persons[p.id]);
  });

  it('have pronouns with nikud and transliteration', () => {
    expect(PRONOUNS.at).toEqual({ id: 'at', nikud: 'אַתְּ', plain: 'את', translit: 'ат' });
    expect(PRONOUNS.hu.translit).toBe('hу');
  });
});

describe('formOf', () => {
  it("gives the verb's form for a person", () => {
    const ata = person('past', 'ata');
    expect(ata && formOf(verb('אכל'), ata)?.nikud).toBe('אָכַלְתָּ');
    const hen = person('future', 'hen');
    expect(hen && formOf(verb('אכל'), hen)?.plain).toBe('יאכלו');
  });

  it('gives nothing for a tense the verb lacks', () => {
    const hu = person('present', 'hu');
    expect(hu && formOf(verb('היה'), hu)).toBeUndefined();
  });
});
