// The nine games (plan, section 3): part 1 on the verbs themselves, parts 2–4
// on a tense each, two games per tense.

import type { Tense } from './persons';
import type { Verb } from './verbs';

export const GAMES = [
  'he-ru',
  'ru-he',
  'write',
  'present-form',
  'present-person',
  'past-form',
  'past-person',
  'future-form',
  'future-person',
] as const;

/** he-ru: infinitive → translation; ru-he: back; write: type the infinitive; <tense>-form: pronoun → form; <tense>-person: form → pronoun. */
export type GameId = (typeof GAMES)[number];

export const isGameId = (value: unknown): value is GameId => GAMES.some((g) => g === value);

/** The tense of a game of parts 2–4. */
export function gameTense(game: GameId): Tense | undefined {
  if (game.startsWith('present-')) return 'present';
  if (game.startsWith('past-')) return 'past';
  return game.startsWith('future-') ? 'future' : undefined;
}

/** The verbs a game asks about, most frequent first: those that have its tense. */
export function gamePool(verbs: readonly Verb[], game: GameId): Verb[] {
  const tense = gameTense(game);
  return verbs.filter((v) => tense === undefined || v[tense] !== undefined).toSorted((a, b) => a.rank - b.rank);
}
