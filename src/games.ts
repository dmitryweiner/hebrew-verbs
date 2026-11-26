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

export type Part = 1 | 2 | 3 | 4;

/** The parts of the app (plan, section 3): the verbs, then a tense each. */
export const PARTS: readonly { part: Part; games: readonly GameId[] }[] = [
  { part: 1, games: ['he-ru', 'ru-he', 'write'] },
  { part: 2, games: ['present-form', 'present-person'] },
  { part: 3, games: ['past-form', 'past-person'] },
  { part: 4, games: ['future-form', 'future-person'] },
];

export function gamePart(game: GameId): Part {
  return PARTS.find((p) => p.games.includes(game))?.part ?? 1;
}

/** The tense of a game of parts 2–4. */
export function gameTense(game: GameId): Tense | undefined {
  if (game.startsWith('present-')) return 'present';
  if (game.startsWith('past-')) return 'past';
  return game.startsWith('future-') ? 'future' : undefined;
}

/** The tense of a part: none for part 1. */
export function partTense(part: Part): Tense | undefined {
  const game = PARTS.find((p) => p.part === part)?.games[0];
  return game && gameTense(game);
}

/** The verbs a game asks about, most frequent first: those that have its tense. */
export function gamePool(verbs: readonly Verb[], game: GameId): Verb[] {
  const tense = gameTense(game);
  return verbs.filter((v) => tense === undefined || v[tense] !== undefined).toSorted((a, b) => a.rank - b.rank);
}
