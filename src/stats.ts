// Statistics of one game: per verb, and how many verbs of the game are open
// (plan 3.3, section 6). The weights follow alef-bet/src/stats.ts.

export interface VerbStat {
  shown: number;
  correct: number;
  wrong: number;
  /** Correct answers in a row, 0 after a mistake. */
  streak: number;
  /** Timestamp (ms) of the last answer, null if never answered. */
  lastSeen: number | null;
}

export interface GameStats {
  /** The first `open` verbs of the game's pool are studied (src/selection.ts). */
  open: number;
  /** By verb id. */
  verbs: Record<string, VerbStat>;
}

/** Decision 9: 20 verbs at the start, a verb is learned after 3 correct answers in a row. */
export const START_OPEN = 20;
export const LEARNED_STREAK = 3;

const HOUR = 60 * 60 * 1000;
/** After this long a verb counts as fully "forgotten". */
export const STALE_AFTER = 3 * 24 * HOUR;
/** Weight of the error rate and staleness on top of the base weight 1. */
const ERROR_WEIGHT = 4;
const STALE_WEIGHT = 3;

export function emptyGameStats(): GameStats {
  return { open: START_OPEN, verbs: {} };
}

export function emptyStat(): VerbStat {
  return { shown: 0, correct: 0, wrong: 0, streak: 0, lastSeen: null };
}

export function recordAnswer(game: GameStats, id: string, correct: boolean, now: number): GameStats {
  const prev = game.verbs[id] ?? emptyStat();
  const next: VerbStat = correct
    ? { ...prev, shown: prev.shown + 1, correct: prev.correct + 1, streak: prev.streak + 1, lastSeen: now }
    : { ...prev, shown: prev.shown + 1, wrong: prev.wrong + 1, streak: 0, lastSeen: now };
  return { ...game, verbs: { ...game.verbs, [id]: next } };
}

export function isLearned(stat: VerbStat | undefined): boolean {
  return stat !== undefined && stat.streak >= LEARNED_STREAK;
}

/** Smoothed share of mistakes (Laplace prior): 0.5 for an unseen verb. */
export function errorRate(stat: VerbStat | undefined): number {
  if (!stat) return 0.5;
  return (stat.wrong + 1) / (stat.shown + 2);
}

/** 0 right after the verb was seen, 1 when it is unseen or seen STALE_AFTER ago. */
export function staleness(stat: VerbStat | undefined, now: number): number {
  if (!stat || stat.lastSeen === null) return 1;
  const age = Math.max(0, now - stat.lastSeen);
  return Math.min(1, Math.log1p(age / HOUR) / Math.log1p(STALE_AFTER / HOUR));
}

/** How strongly a verb is preferred when a round is built. */
export function verbWeight(stat: VerbStat | undefined, now: number): number {
  return 1 + ERROR_WEIGHT * errorRate(stat) + STALE_WEIGHT * staleness(stat, now);
}
