import { describe, expect, it } from 'vitest';
import { emptyGameStats, errorRate, isLearned, recordAnswer, staleness, START_OPEN, verbWeight, type VerbStat } from './stats';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 25);
const stat = (s: Partial<VerbStat>): VerbStat => ({ shown: 0, correct: 0, wrong: 0, streak: 0, lastSeen: null, ...s });

describe('recordAnswer', () => {
  it('counts answers, the streak of correct ones and when the verb was seen', () => {
    let game = emptyGameStats();
    game = recordAnswer(game, 'אכל', true, NOW - DAY);
    game = recordAnswer(game, 'אכל', true, NOW - HOUR);
    expect(game.verbs['אכל']).toEqual({ shown: 2, correct: 2, wrong: 0, streak: 2, lastSeen: NOW - HOUR });
    game = recordAnswer(game, 'אכל', false, NOW);
    expect(game.verbs['אכל']).toEqual({ shown: 3, correct: 2, wrong: 1, streak: 0, lastSeen: NOW });
  });

  it('does not change the previous stats', () => {
    const before = emptyGameStats();
    const after = recordAnswer(before, 'אכל', true, NOW);
    expect(before.verbs).toEqual({});
    expect(after.open).toBe(START_OPEN);
  });
});

describe('isLearned', () => {
  it('needs three correct answers in a row (decision 9)', () => {
    expect(isLearned(undefined)).toBe(false);
    expect(isLearned(stat({ shown: 5, correct: 4, wrong: 1, streak: 2 }))).toBe(false);
    expect(isLearned(stat({ shown: 3, correct: 3, streak: 3 }))).toBe(true);
  });
});

describe('weights', () => {
  it('rate mistakes with a neutral start', () => {
    expect(errorRate(undefined)).toBeCloseTo(0.5);
    expect(errorRate(stat({ shown: 4, wrong: 4 }))).toBeGreaterThan(0.5);
    expect(errorRate(stat({ shown: 4, correct: 4 }))).toBeLessThan(0.5);
  });

  it('grow with the time since the verb was seen', () => {
    const seen = (ago: number) => staleness(stat({ shown: 1, lastSeen: NOW - ago }), NOW);
    expect(staleness(undefined, NOW)).toBe(1);
    expect(seen(0)).toBe(0);
    expect(seen(HOUR)).toBeLessThan(seen(DAY));
    expect(seen(30 * DAY)).toBe(1);
  });

  it('prefer verbs with mistakes and verbs not seen for long (plan 3.3)', () => {
    const good = stat({ shown: 3, correct: 3, streak: 3, lastSeen: NOW });
    expect(verbWeight(stat({ shown: 3, wrong: 3, lastSeen: NOW }), NOW)).toBeGreaterThan(verbWeight(good, NOW));
    expect(verbWeight({ ...good, lastSeen: NOW - 10 * DAY }, NOW)).toBeGreaterThan(verbWeight(good, NOW));
    expect(verbWeight(good, NOW)).toBeGreaterThanOrEqual(1);
  });
});
