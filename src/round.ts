// A round of a game (plan, section 3): ten tasks built at its start in the
// spelling then shown (decision 37), the answers given so far, and the
// round of its mistakes.

import { gamePool, type GameId } from './games';
import { makeQuestion, type Question, type Spelling } from './questions';
import { pickRound, type Random } from './selection';
import type { GameStats } from './stats';
import type { Verb } from './verbs';

export interface Round {
  game: GameId;
  spelling: Spelling;
  questions: Question[];
  /** Whether each answered task was right, in order. */
  results: boolean[];
}

const build = (game: GameId, chosen: readonly Verb[], verbs: readonly Verb[], spelling: Spelling, rng: Random): Round => ({
  game,
  spelling,
  questions: chosen.map((verb) => makeQuestion(game, verb, verbs, spelling, rng)),
  results: [],
});

/** A new round of the game from its statistics; `verbs` are all the verbs. */
export function newRound(game: GameId, verbs: readonly Verb[], stats: GameStats, spelling: Spelling, now: number, rng: Random): Round {
  return build(game, pickRound(gamePool(verbs, game), stats, now, rng), verbs, spelling, rng);
}

/** The task to answer now; undefined when the round is over. */
export function current(round: Round): Question | undefined {
  return round.questions[round.results.length];
}

export function record(round: Round, correct: boolean): Round {
  if (!current(round)) throw new Error('the round is over');
  return { ...round, results: [...round.results, correct] };
}

/** The verbs answered wrong, each once, in the order met. */
export function mistakes(round: Round): Verb[] {
  return [...new Set(round.questions.filter((_, i) => round.results[i] === false).map((q) => q.verb))];
}

/** "Повторить ошибки": a task for each verb answered wrong, new options, the same spelling. */
export function retryRound(round: Round, verbs: readonly Verb[], rng: Random): Round {
  return build(round.game, mistakes(round), verbs, round.spelling, rng);
}
