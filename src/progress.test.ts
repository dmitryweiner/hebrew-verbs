import { describe, expect, it } from 'vitest';
import { gamePool } from './games';
import { gameProgress, HARDEST } from './progress';
import { emptyGameStats, type GameStats, type VerbStat } from './stats';
import { verbs } from './testing';

const NOW = Date.UTC(2026, 10, 26);
const pool = gamePool(verbs, 'he-ru');
const stat = (correct: number, wrong: number, streak = 0): VerbStat => ({ shown: correct + wrong, correct, wrong, streak, lastSeen: NOW });
const ids = (list: readonly { verb: { id: string } }[]) => list.map((x) => x.verb.id);
const id = (i: number) => pool[i]?.id ?? '';

describe('gameProgress', () => {
  it('of a game never played: its verbs, the first 20 open, nothing learned or answered', () => {
    expect(gameProgress(pool, emptyGameStats())).toEqual({ total: pool.length, open: 20, learned: 0, answers: 0, correct: 0, hardest: [] });
    expect(gameProgress(pool.slice(0, 5), emptyGameStats())).toMatchObject({ total: 5, open: 5 });
  });

  it('counts the learned of the open verbs, every answer and the right ones', () => {
    const game: GameStats = {
      open: 30,
      verbs: { [id(0)]: stat(3, 0, 3), [id(1)]: stat(4, 1, 3), [id(2)]: stat(1, 2), [id(3)]: stat(2, 0, 2) },
    };
    expect(gameProgress(pool, game)).toMatchObject({ open: 30, learned: 2, answers: 13, correct: 10 });
  });

  it('names the verbs answered wrong, the highest share of mistakes first, then more mistakes, then more frequent', () => {
    const game: GameStats = {
      open: 20,
      verbs: {
        [id(0)]: stat(5, 0, 5), // no mistakes: never hard
        [id(1)]: stat(5, 1, 5), // 2/8
        [id(2)]: stat(0, 1), // 2/3
        [id(3)]: stat(1, 3), // 4/6
        [id(4)]: stat(0, 1), // 2/3, less frequent than id(2)
        [id(5)]: stat(2, 2, 1), // 3/6
      },
    };
    expect(ids(gameProgress(pool, game).hardest)).toEqual([id(3), id(2), id(4), id(5), id(1)]);
    expect(gameProgress(pool, game).hardest[0]?.stat).toEqual(stat(1, 3));
  });

  it(`lists at most ${HARDEST} hardest verbs, and only verbs of the game`, () => {
    const game: GameStats = {
      open: 20,
      verbs: { אאא: stat(0, 5), ...Object.fromEntries(pool.slice(0, 8).map((v) => [v.id, stat(0, 1)])) },
    };
    expect(ids(gameProgress(pool, game).hardest)).toEqual(pool.slice(0, HARDEST).map((v) => v.id));
  });
});
