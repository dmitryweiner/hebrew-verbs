// Meeting new verbs before a game asks them (plan 3.0, decisions 68–71):
// every part keeps the verbs the learner knows in it. Its introduction shows
// the next ones not known yet, and a round shows those of its verbs first.

import { gamePool, PARTS, type Part } from './games';
import type { Verb } from './verbs';

/** Decision 71: the first meeting brings as many verbs as the first round asks, then five at a time. */
export const FIRST_MEETING = 10;
export const MEETING = 5;

/** The verbs a part teaches, most frequent first: the pool of its games (parts 2–4: the verbs with its tense). */
export function partPool(verbs: readonly Verb[], part: Part): Verb[] {
  const game = PARTS.find((p) => p.part === part)?.games[0];
  return game ? gamePool(verbs, game) : [];
}

/** The verbs to meet next: the most frequent of the pool not known yet, ten the first time, then five. */
export function nextToMeet(pool: readonly Verb[], known: ReadonlySet<string>): Verb[] {
  const count = pool.some((v) => known.has(v.id)) ? MEETING : FIRST_MEETING;
  return pool.filter((v) => !known.has(v.id)).slice(0, count);
}

/** The verbs of a round not known yet, each once, in the order they come. */
export function toMeet(verbs: readonly Verb[], known: ReadonlySet<string>): Verb[] {
  return [...new Set(verbs)].filter((v) => !known.has(v.id));
}
