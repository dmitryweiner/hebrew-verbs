// Which verbs a game studies and which of them make a round (plan 3.3): the
// open verbs are the first of the pool; heavier ones (mistakes, long unseen)
// come more often; a round brings at most three new verbs.

import { isLearned, recordAnswer, verbWeight, type GameStats } from './stats';
import type { Verb } from './verbs';

export type Random = () => number;

export const ROUND_LENGTH = 10;
export const MAX_NEW = 3;
/** Decision 9: 10 more verbs open when 80 % of the open ones are learned. */
export const OPEN_STEP = 10;
export const OPEN_SHARE = 0.8;

/** Small deterministic PRNG (mulberry32) for tests. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Random): T[] {
  return weightedOrder(items, () => 1, rng);
}

/** Random permutation where heavier items tend to come first (Efraimidis–Spirakis). */
export function weightedOrder<T>(items: readonly T[], weight: (item: T) => number, rng: Random): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(1 - rng(), 1 / weight(item)) }))
    .toSorted((a, b) => b.key - a.key)
    .map((x) => x.item);
}

/** The verbs the game studies now: the first `open` of its pool (most frequent first). */
export function openVerbs(pool: readonly Verb[], game: GameStats): Verb[] {
  return pool.slice(0, game.open);
}

/** Opens the next verbs while 80 % of the open ones are learned. */
export function advance(pool: readonly Verb[], game: GameStats): GameStats {
  let open = Math.min(game.open, pool.length);
  const learned = (n: number) => pool.slice(0, n).filter((v) => isLearned(game.verbs[v.id])).length;
  while (open < pool.length && learned(open) >= OPEN_SHARE * open) open = Math.min(open + OPEN_STEP, pool.length);
  return open === game.open ? game : { ...game, open };
}

/** Records an answer and opens new verbs when that is due. */
export function answer(pool: readonly Verb[], game: GameStats, id: string, correct: boolean, now: number): GameStats {
  return advance(pool, recordAnswer(game, id, correct, now));
}

/**
 * The verbs of a round, one per task. At most MAX_NEW verbs never seen in the
 * game, the most frequent of them; the rest are seen verbs, heavier ones more
 * likely. When there are fewer verbs than tasks they repeat, never twice in a row.
 */
export function pickRound(pool: readonly Verb[], game: GameStats, now: number, rng: Random, length = ROUND_LENGTH): Verb[] {
  const open = openVerbs(pool, game);
  const fresh = open.filter((v) => !game.verbs[v.id]).slice(0, MAX_NEW);
  const weight = (v: Verb) => verbWeight(game.verbs[v.id], now);
  const seen = weightedOrder(
    open.filter((v) => game.verbs[v.id]),
    weight,
    rng,
  ).slice(0, length - fresh.length);
  const chosen = [...fresh, ...seen];
  if (chosen.length === 0) return [];
  const round: Verb[] = [];
  while (round.length < length) {
    const pass = weightedOrder(chosen, weight, rng);
    if (pass.length > 1 && pass[0] === round.at(-1)) [pass[0], pass[1]] = [pass[1]!, pass[0]!];
    round.push(...pass);
  }
  return round.slice(0, length);
}
