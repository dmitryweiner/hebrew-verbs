import { describe, expect, it } from 'vitest';
import { GAMES, gamePool, gameTense } from './games';
import { formOf, personsOf, type Person } from './persons';
import { BAND, makeQuestion, OPTION_COUNT, sharesTranslation, spell, type Question, type Spelling } from './questions';
import { seededRandom } from './selection';
import { verb, verbs } from './testing';
import type { Form, Verb } from './verbs';

const SPELLINGS: Spelling[] = ['nikud', 'plain'];
const ids = (list: readonly Verb[]) => list.map((v) => v.id);

/** The forms a pronoun takes in a tense: אני is ms and fs in the present. */
const pronounForms = (q: { verb: Verb }, p: Person): Form[] =>
  personsOf(p.tense)
    .filter((x) => x.pronoun.id === p.pronoun.id)
    .flatMap((x) => formOf(q.verb, x) ?? []);

/** What makes an option right, as a person would check it from what is shown. */
function rightOptions(q: Question, spelling: Spelling): boolean[] {
  if (q.kind === 'he-ru' || q.kind === 'ru-he')
    return q.options.map((o) => sharesTranslation(o, q.verb) || spell(o.lemma, spelling) === spell(q.verb.lemma, spelling));
  if (q.kind === 'form') {
    const right = formOf(q.verb, q.person);
    return q.options.map((o) => right !== undefined && spell(o, spelling) === spell(right, spelling));
  }
  if (q.kind === 'person') return q.options.map((p) => pronounForms(q, p).some((f) => spell(f, spelling) === spell(q.form, spelling)));
  return [];
}

/** The text of each option as it is shown. */
function shown(q: Question, spelling: Spelling): string[] {
  if (q.kind === 'he-ru') return q.options.map((o) => o.ru.join(', '));
  if (q.kind === 'ru-he') return q.options.map((o) => spell(o.lemma, spelling));
  if (q.kind === 'form') return q.options.map((o) => spell(o, spelling));
  if (q.kind === 'person') return q.options.map((p) => spell(p.pronoun, spelling));
  return [];
}

describe('makeQuestion on the whole data', () => {
  it('has exactly one right option, the answer, and no two options shown alike', () => {
    const bad: string[] = [];
    const short: string[] = [];
    let seed = 1;
    for (const game of GAMES.filter((g) => g !== 'write'))
      for (const spelling of SPELLINGS)
        for (const v of gamePool(verbs, game)) {
          const q = makeQuestion(game, v, verbs, spelling, seededRandom(seed++));
          if (q.kind === 'write') continue;
          const right = rightOptions(q, spelling);
          const texts = shown(q, spelling);
          if (right.filter(Boolean).length !== 1 || !right[q.answer] || new Set(texts).size !== texts.length)
            bad.push(`${game} ${spelling} ${v.id}: ${texts.join(' | ')}`);
          if (q.options.length !== OPTION_COUNT) short.push(`${game} ${spelling} ${v.id}`);
        }
    expect(bad).toEqual([]);
    // Only a present whose plain forms coincide (עושה is ms and fs) leaves fewer forms than options.
    expect(short.filter((s) => !s.startsWith('present-form plain'))).toEqual([]);
  });
});

describe('he-ru and ru-he', () => {
  it('ask about the verb with distractors of about the same frequency', () => {
    const v = verb('אכל');
    for (const game of ['he-ru', 'ru-he'] as const) {
      const q = makeQuestion(game, v, verbs, 'nikud', seededRandom(3));
      if (q.kind !== game) throw new Error(q.kind);
      expect(q.verb).toBe(v);
      expect(q.options[q.answer]).toBe(v);
      for (const o of q.options) expect(Math.abs(o.rank - v.rank)).toBeLessThanOrEqual(BAND);
    }
  });

  it('never offer a verb that shares a translation: no говорить among the options for сказать', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const q = makeQuestion('ru-he', verb('אמר'), verbs, 'plain', seededRandom(seed));
      if (q.kind !== 'ru-he') throw new Error(q.kind);
      expect(ids(q.options)).not.toContain('הגיד');
      expect(ids(q.options)).not.toContain('דיבר');
    }
  });

  it('give a verb without an infinitive distractors without one', () => {
    const q = makeQuestion('he-ru', verb('הוזמן'), verbs, 'nikud', seededRandom(1));
    if (q.kind !== 'he-ru') throw new Error(q.kind);
    expect(q.options.every((o) => o.infinitive === undefined)).toBe(true);
  });

  it('vary the distractors from seed to seed', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const q = makeQuestion('he-ru', verb('אכל'), verbs, 'nikud', seededRandom(seed));
      if (q.kind === 'he-ru') sets.add(ids(q.options).toSorted().join());
    }
    expect(sets.size).toBeGreaterThan(5);
  });
});

describe('write', () => {
  it('accepts every verb with a shared translation: говорить = לדבר / לומר', () => {
    const q = makeQuestion('write', verb('אמר'), verbs, 'nikud', seededRandom(1));
    if (q.kind !== 'write') throw new Error(q.kind);
    expect(q.accepted[0]).toBe(verb('אמר'));
    expect(ids(q.accepted)).toEqual(expect.arrayContaining(['אמר', 'הגיד', 'דיבר']));
    expect(q.accepted.every((v) => sharesTranslation(v, verb('אמר')))).toBe(true);
  });
});

describe('tense games', () => {
  it('ask a form for a pronoun among other forms of the same tense', () => {
    const q = makeQuestion('past-form', verb('אכל'), verbs, 'nikud', seededRandom(2));
    if (q.kind !== 'form') throw new Error(q.kind);
    expect(q.tense).toBe('past');
    expect(q.options[q.answer]).toBe(formOf(verb('אכל'), q.person));
    const past = Object.values(verb('אכל').past);
    expect(q.options.every((o) => past.includes(o))).toBe(true);
  });

  it('give fewer forms than four where the plain present has only three: עושה', () => {
    const q = makeQuestion('present-form', verb('עשה'), verbs, 'plain', seededRandom(2));
    expect(q.kind === 'form' && q.options.map((o) => o.plain).toSorted()).toEqual(['עושה', 'עושות', 'עושים'].toSorted());
  });

  it('ask the pronoun of a form, leaving out other pronouns of the same spelling', () => {
    const second: string[][] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const q = makeQuestion('past-person', verb('אכל'), verbs, 'plain', seededRandom(seed));
      if (q.kind !== 'person') throw new Error(q.kind);
      expect(q.options[q.answer]).toBe(q.person);
      expect(q.form).toBe(formOf(verb('אכל'), q.person));
      const pronouns = q.options.map((p) => p.pronoun.id);
      if (q.form.plain === 'אכלת') second.push(pronouns.filter((p) => p === 'ata' || p === 'at'));
    }
    expect(second.length).toBeGreaterThan(0);
    expect(second.filter((p) => p.length !== 1)).toEqual([]);
  });

  it('pick the person at random among all of the tense', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = makeQuestion('future-form', verb('אכל'), verbs, 'nikud', seededRandom(seed));
      if (q.kind === 'form') seen.add(q.person.id);
    }
    expect(seen.size).toBe(personsOf('future').length);
  });

  it('belong to the tense of the game', () => {
    for (const game of GAMES) {
      const q = makeQuestion(game, verb('אכל'), verbs, 'nikud', seededRandom(1));
      expect(q.game).toBe(game);
      expect(q.kind === 'form' || q.kind === 'person' ? q.tense : undefined).toBe(gameTense(game));
    }
  });
});
