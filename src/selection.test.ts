import { describe, expect, it } from 'vitest';
import { advance, answer, MAX_NEW, openVerbs, pickRound, ROUND_LENGTH, seededRandom, shuffle } from './selection';
import { emptyGameStats, type GameStats, type VerbStat } from './stats';
import { verbs } from './testing';

const NOW = Date.UTC(2026, 10, 25);
const DAY = 24 * 60 * 60 * 1000;
const pool = verbs.slice(0, 100);
const ids = (list: readonly { id: string }[]) => list.map((v) => v.id);
const known = (streak: number, wrong = 0): VerbStat => ({ shown: streak + wrong, correct: streak, wrong, streak, lastSeen: NOW - DAY });
/** Stats where the first `count` verbs of the pool have the given stat. */
const withStats = (count: number, stat: VerbStat, open = 20): GameStats => ({
  open,
  verbs: Object.fromEntries(pool.slice(0, count).map((v) => [v.id, stat])),
});

describe('random helpers', () => {
  it('repeat with the same seed and shuffle without losing items', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a()]).toEqual([b(), b()]);
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, seededRandom(1)).toSorted((x, y) => x - y)).toEqual(items);
  });
});

describe('openVerbs', () => {
  it('are the first verbs of the pool', () => {
    expect(ids(openVerbs(pool, emptyGameStats()))).toEqual(ids(pool.slice(0, 20)));
    expect(openVerbs(pool.slice(0, 5), emptyGameStats())).toHaveLength(5);
  });
});

describe('advance', () => {
  it('opens 10 more verbs when 80 % of the open ones are learned (decision 9)', () => {
    expect(advance(pool, withStats(15, known(3))).open).toBe(20);
    expect(advance(pool, withStats(16, known(3))).open).toBe(30);
  });

  it('does not count a verb learned before a mistake', () => {
    expect(advance(pool, withStats(16, { ...known(3), streak: 0 })).open).toBe(20);
  });

  it('opens as many steps as are due, up to the whole pool', () => {
    expect(advance(pool, withStats(39, known(3))).open).toBe(50);
    expect(advance(pool, withStats(40, known(3))).open).toBe(60);
    expect(advance(pool.slice(0, 25), withStats(25, known(3))).open).toBe(25);
  });
});

describe('answer', () => {
  it('records the answer and opens new verbs when due', () => {
    const game = withStats(15, known(3));
    const next = answer(pool, game, pool[15]?.id ?? '', true, NOW);
    expect(next.verbs[pool[15]?.id ?? '']?.correct).toBe(1);
    expect(next.open).toBe(20);
    const learned = withStats(16, known(2));
    const after = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].reduce(
      (g, i) => answer(pool, g, pool[i]?.id ?? '', true, NOW),
      learned,
    );
    expect(after.open).toBe(30);
  });
});

describe('pickRound', () => {
  it('starts with the ten most frequent verbs, each once', () => {
    for (const seed of [1, 2, 3]) {
      const round = pickRound(pool, emptyGameStats(), NOW, seededRandom(seed));
      expect(ids(round).toSorted()).toEqual(ids(pool.slice(0, ROUND_LENGTH)).toSorted());
    }
  });

  it('fills the round with new verbs while fewer seen ones than its tasks are open', () => {
    const game = withStats(4, known(1));
    const round = pickRound(pool, game, NOW, seededRandom(4));
    expect(ids(round).toSorted()).toEqual(ids(pool.slice(0, ROUND_LENGTH)).toSorted());
  });

  it('takes at most three new verbs, the most frequent of them, the rest from the seen ones', () => {
    const game = withStats(12, known(1));
    const round = pickRound(pool, game, NOW, seededRandom(5));
    expect(new Set(ids(round)).size).toBe(ROUND_LENGTH);
    const fresh = ids(round).filter((id) => !game.verbs[id]);
    expect(fresh.toSorted()).toEqual(ids(pool.slice(12, 12 + MAX_NEW)).toSorted());
  });

  it('takes only open verbs', () => {
    const game = withStats(20, known(1));
    const open = new Set(ids(pool.slice(0, 20)));
    for (const seed of [1, 2, 3]) expect(pickRound(pool, game, NOW, seededRandom(seed)).every((v) => open.has(v.id))).toBe(true);
  });

  it('brings verbs with mistakes back more often', () => {
    const game: GameStats = {
      open: 20,
      verbs: Object.fromEntries(pool.slice(0, 20).map((v, i) => [v.id, i < 10 ? known(1, 4) : known(5)])),
    };
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 50; seed++)
      for (const v of pickRound(pool, game, NOW, seededRandom(seed))) {
        if (v.rank <= 10) hard++;
        else easy++;
      }
    expect(hard).toBeGreaterThan(easy);
  });

  it('repeats verbs only when fewer are open than its tasks, never twice in a row', () => {
    const small = pool.slice(0, 4);
    for (const seed of [1, 2, 3]) {
      const round = pickRound(small, emptyGameStats(), NOW, seededRandom(seed));
      expect(round).toHaveLength(ROUND_LENGTH);
      expect(new Set(ids(round))).toEqual(new Set(ids(small)));
      expect(round.every((v, i) => i === 0 || v !== round[i - 1])).toBe(true);
    }
  });

  it('gives an empty round for an empty pool', () => {
    expect(pickRound([], emptyGameStats(), NOW, seededRandom(1))).toEqual([]);
  });
});
