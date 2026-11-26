import { describe, expect, it } from 'vitest';
import { FIRST_MEETING, MEETING, nextToMeet, partPool, toMeet } from './meeting';
import { verbs } from './testing';

const ids = (list: readonly { id: string }[]) => list.map((v) => v.id);

describe('partPool', () => {
  it('is the verbs of the part, most frequent first: in parts 2–4 those with its tense', () => {
    expect(ids(partPool(verbs, 1).slice(0, 3))).toEqual(['היה', 'ידע', 'עשה']);
    expect(partPool(verbs, 1)).toHaveLength(verbs.length);
    // היה has no present.
    expect(ids(partPool(verbs, 2))).not.toContain('היה');
    expect(partPool(verbs, 2).every((v, i, all) => i === 0 || all[i - 1]!.rank < v.rank)).toBe(true);
    expect(partPool(verbs, 4).every((v) => v.future)).toBe(true);
  });
});

describe('nextToMeet', () => {
  const pool = partPool(verbs, 1);

  it(`gives the ${FIRST_MEETING} most frequent verbs the first time`, () => {
    expect(ids(nextToMeet(pool, new Set()))).toEqual(ids(pool.slice(0, FIRST_MEETING)));
  });

  it(`then the next ${MEETING} not known yet, skipping the known ones`, () => {
    const known = new Set([...ids(pool.slice(0, 10)), pool[12]!.id]);
    expect(ids(nextToMeet(pool, known))).toEqual(ids([pool[10]!, pool[11]!, pool[13]!, pool[14]!, pool[15]!]));
  });

  it('is empty when every verb is known', () => {
    expect(nextToMeet(pool.slice(0, 3), new Set(ids(pool.slice(0, 3))))).toEqual([]);
  });
});

describe('toMeet', () => {
  it('gives the verbs not known yet, each once, in the order met', () => {
    const [a, b, c] = verbs;
    expect(ids(toMeet([b!, a!, b!, c!, a!], new Set([c!.id])))).toEqual(ids([b!, a!]));
    expect(toMeet([a!], new Set([a!.id]))).toEqual([]);
  });
});
