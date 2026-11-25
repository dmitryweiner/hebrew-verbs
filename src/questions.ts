// The tasks of the nine games (plan 3.1, 3.2): a verb, the options and the
// right one. Exactly one option is right as the learner sees it: options are
// compared in the spelling shown (with nikud or without).

import { gameTense, type GameId } from './games';
import { formOf, personsOf, type Person, type Tense } from './persons';
import { shuffle, type Random } from './selection';
import type { Form, Verb } from './verbs';

export type Spelling = 'nikud' | 'plain';

export const OPTION_COUNT = 4;
/** Distractors come from the BAND verbs nearest in frequency. */
export const BAND = 20;

interface Choice<T> {
  game: GameId;
  verb: Verb;
  options: T[];
  /** The index of the right option. */
  answer: number;
}

export type Question =
  /** The headword, options are translations; or a translation, options are headwords. */
  | (Choice<Verb> & { kind: 'he-ru' | 'ru-he' })
  /** A translation to type the headword of; any verb sharing a translation is right, the asked one first. */
  | { kind: 'write'; game: GameId; verb: Verb; accepted: Verb[] }
  /** A pronoun, options are forms of the tense. */
  | (Choice<Form> & { kind: 'form'; tense: Tense; person: Person })
  /** A form, options are pronouns to say it with. */
  | (Choice<Person> & { kind: 'person'; tense: Tense; person: Person; form: Form });

export const spell = (form: { nikud: string; plain: string }, spelling: Spelling): string => form[spelling];

const normalizeRu = (text: string) => text.toLowerCase().replaceAll('ё', 'е');
/** A verb's translations, normalized once: distractors compare a verb with every other. */
const translations = new WeakMap<Verb, string[]>();

function translationsOf(verb: Verb): string[] {
  let ru = translations.get(verb);
  if (!ru) {
    ru = verb.ru.map(normalizeRu);
    translations.set(verb, ru);
  }
  return ru;
}

export function sharesTranslation(a: Verb, b: Verb): boolean {
  const ru = translationsOf(b);
  return translationsOf(a).some((t) => ru.includes(t));
}

const pick = <T>(items: readonly T[], rng: Random): T | undefined => items[Math.floor(rng() * items.length)];

/** The options in random order and the index of the right one. */
function arrange<T>(right: T, others: readonly T[], rng: Random): { options: T[]; answer: number } {
  const options = shuffle([right, ...others], rng);
  return { options, answer: options.indexOf(right) };
}

/**
 * Up to OPTION_COUNT - 1 verbs to offer next to `verb`: none shares a
 * translation or a shown headword with it or with each other. Taken at random
 * from the BAND nearest in frequency, of the same kind (with or without an
 * infinitive) where possible.
 */
function distractors(verb: Verb, verbs: readonly Verb[], spelling: Spelling, rng: Random): Verb[] {
  const apart = (a: Verb, b: Verb) => a.id !== b.id && !sharesTranslation(a, b) && spell(a.lemma, spelling) !== spell(b.lemma, spelling);
  const otherKind = (v: Verb) => Number((v.infinitive === undefined) !== (verb.infinitive === undefined));
  const near = verbs
    .filter((v) => apart(v, verb))
    .toSorted((a, b) => otherKind(a) - otherKind(b) || Math.abs(a.rank - verb.rank) - Math.abs(b.rank - verb.rank) || a.rank - b.rank);
  const chosen: Verb[] = [];
  for (const v of [...shuffle(near.slice(0, BAND), rng), ...near.slice(BAND)]) {
    if (chosen.length === OPTION_COUNT - 1) break;
    if (chosen.every((c) => apart(c, v))) chosen.push(v);
  }
  return chosen;
}

function tenseQuestion(game: GameId, tense: Tense, verb: Verb, spelling: Spelling, rng: Random): Question {
  const persons = personsOf(tense).filter((p) => formOf(verb, p) !== undefined);
  const person = pick(persons, rng);
  const form = person && formOf(verb, person);
  if (!person || !form) throw new Error(`${verb.id} has no ${tense}`);
  const same = (f: Form | undefined) => f !== undefined && spell(f, spelling) === spell(form, spelling);

  if (game.endsWith('-form')) {
    const others = new Map<string, Form>();
    for (const p of shuffle(persons, rng)) {
      const f = formOf(verb, p);
      if (f && !same(f)) others.set(spell(f, spelling), f);
    }
    return { kind: 'form', game, tense, verb, person, ...arrange(form, [...others.values()].slice(0, OPTION_COUNT - 1), rng) };
  }

  // A pronoun is right when any of its persons takes this spelling: אתה and את for אכלת.
  const rightPronouns = new Set(persons.filter((p) => same(formOf(verb, p))).map((p) => p.pronoun.id));
  const others = new Map<string, Person>();
  for (const p of shuffle(persons, rng)) if (!rightPronouns.has(p.pronoun.id)) others.set(p.pronoun.id, p);
  return { kind: 'person', game, tense, verb, person, form, ...arrange(person, [...others.values()].slice(0, OPTION_COUNT - 1), rng) };
}

/** The task of a game about a verb; `verbs` are all the verbs, for distractors and other right answers. */
export function makeQuestion(game: GameId, verb: Verb, verbs: readonly Verb[], spelling: Spelling, rng: Random): Question {
  const tense = gameTense(game);
  if (tense) return tenseQuestion(game, tense, verb, spelling, rng);
  if (game === 'write')
    return { kind: 'write', game, verb, accepted: [verb, ...verbs.filter((v) => v !== verb && sharesTranslation(v, verb))] };
  const kind = game === 'ru-he' ? 'ru-he' : 'he-ru';
  return { kind, game, verb, ...arrange(verb, distractors(verb, verbs, spelling, rng), rng) };
}
