import { describe, expect, it } from 'vitest';
import { gamePool } from './games';
import { current, mistakes, newRound, record, retryRound } from './round';
import { ROUND_LENGTH, seededRandom } from './selection';
import { emptyGameStats } from './stats';
import { verbs } from './testing';

const NOW = 1_700_000_000_000;
const ids = (round: { questions: { verb: { id: string } }[] }) => round.questions.map((q) => q.verb.id);

describe('a round', () => {
  it('has ten tasks of its game in the spelling it starts with; the first is about the three most frequent verbs', () => {
    const round = newRound('ru-he', verbs, emptyGameStats(), 'plain', NOW, seededRandom(1));
    expect(round.questions).toHaveLength(ROUND_LENGTH);
    expect(round.questions.every((q) => q.kind === 'ru-he' && q.game === 'ru-he')).toBe(true);
    expect(round.spelling).toBe('plain');
    expect(new Set(ids(round))).toEqual(
      new Set(
        gamePool(verbs, 'ru-he')
          .slice(0, 3)
          .map((v) => v.id),
      ),
    );
  });

  it('goes task by task and keeps whether each answer was right', () => {
    let round = newRound('write', verbs, emptyGameStats(), 'nikud', NOW, seededRandom(2));
    expect(current(round)).toBe(round.questions[0]);
    round = record(round, true);
    round = record(round, false);
    expect(round.results).toEqual([true, false]);
    expect(current(round)).toBe(round.questions[2]);
    for (let i = 2; i < ROUND_LENGTH; i++) round = record(round, true);
    expect(current(round)).toBeUndefined();
    expect(() => record(round, true)).toThrow('the round is over');
  });

  it('repeats the mistakes: each verb answered wrong once, in the order met', () => {
    let round = newRound('he-ru', verbs, emptyGameStats(), 'nikud', NOW, seededRandom(3));
    const answers = [true, false, true, false, false, true, true, false, true, true];
    for (const correct of answers) round = record(round, correct);
    const wrong = [...new Set(ids(round).filter((_, i) => !answers[i]))];
    expect(mistakes(round).map((v) => v.id)).toEqual(wrong);

    const retry = retryRound(round, verbs, seededRandom(4));
    expect(ids(retry)).toEqual(wrong);
    expect(retry).toMatchObject({ game: 'he-ru', spelling: 'nikud', results: [] });
  });
});
