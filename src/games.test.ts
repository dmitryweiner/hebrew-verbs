import { describe, expect, it } from 'vitest';
import { GAMES, gamePart, gamePool, gameTense, isGameId, PARTS } from './games';
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

  it('make up the four parts in order: verbs, then the present, past and future', () => {
    expect(PARTS.flatMap((p) => p.games)).toEqual(GAMES);
    expect(PARTS.map((p) => p.part)).toEqual([1, 2, 3, 4]);
    expect(PARTS.map((p) => p.games.map(gameTense)[0])).toEqual([undefined, 'present', 'past', 'future']);
    expect(gamePart('write')).toBe(1);
    expect(gamePart('past-person')).toBe(3);
  });
});
