// A game's progress (plan, section 6): how many of its open verbs are
// learned, how far the game is open, how many answers were right, and the
// verbs with the most mistakes.

import { openVerbs } from './selection';
import { errorRate, isLearned, type GameStats, type VerbStat } from './stats';
import type { Verb } from './verbs';

/** How many of the hardest verbs a game names. */
export const HARDEST = 5;

export interface GameProgress {
  /** The verbs of the game's pool. */
  total: number;
  /** The open ones, the first of the pool. */
  open: number;
  /** Learned of the open verbs. */
  learned: number;
  /** Every answer of the game, and the right ones among them. */
  answers: number;
  correct: number;
  /** Verbs of the game answered wrong at least once: the highest share of mistakes, then more mistakes, then more frequent first. */
  hardest: { verb: Verb; stat: VerbStat }[];
}

export function gameProgress(pool: readonly Verb[], game: GameStats): GameProgress {
  const open = openVerbs(pool, game);
  const stats = Object.values(game.verbs);
  const wrong = pool.flatMap((verb) => {
    const stat = game.verbs[verb.id];
    return stat && stat.wrong > 0 ? [{ verb, stat }] : [];
  });
  return {
    total: pool.length,
    open: open.length,
    learned: open.filter((v) => isLearned(game.verbs[v.id])).length,
    answers: stats.reduce((sum, s) => sum + s.shown, 0),
    correct: stats.reduce((sum, s) => sum + s.correct, 0),
    // toSorted is stable: the pool's frequency order settles the rest.
    hardest: wrong.toSorted((a, b) => errorRate(b.stat) - errorRate(a.stat) || b.stat.wrong - a.stat.wrong).slice(0, HARDEST),
  };
}
