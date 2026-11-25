import { describe, expect, it } from 'vitest';
import { GAMES, gamePool, gameTense, isGameId } from './games';
import { verbs } from './testing';

describe('games', () => {
  it('are the nine of the plan: three of part 1, two per tense', () => {
    expect(GAMES).toEqual([
      'he-ru',
      'ru-he',
      'write',
      'present-form',
      'present-person',
      'past-form',
      'past-person',
      'future-form',
      'future-person',
    ]);
    expect(GAMES.map(gameTense)).toEqual([undefined, undefined, undefined, 'present', 'present', 'past', 'past', 'future', 'future']);
  });

  it('recognise their ids', () => {
    expect(isGameId('past-form')).toBe(true);
    expect(isGameId('past')).toBe(false);
    expect(isGameId(3)).toBe(false);
  });

  it('take the verbs that have the tense, in order of frequency', () => {
    expect(gamePool(verbs, 'he-ru')).toHaveLength(1000);
    const present = gamePool(verbs, 'present-form');
    expect(present.map((v) => v.id)).not.toContain('היה');
    expect(present).toHaveLength(999);
    expect(gamePool(verbs, 'future-person').every((v) => v.future)).toBe(true);
    expect(present.map((v) => v.rank)).toEqual(present.map((v) => v.rank).toSorted((a, b) => a - b));
  });
});
