import { describe, expect, it } from 'vitest';
import { checkWritten } from './answer';
import { verb } from './testing';

const said = [verb('אמר'), verb('הגיד'), verb('דיבר')];

describe('checkWritten', () => {
  it('takes the plene spelling, with or without nikud', () => {
    expect(checkWritten('לאכול', [verb('אכל')])).toEqual({ correct: true, verb: verb('אכל'), finalLetters: false });
    expect(checkWritten('לֶאֱכוֹל', [verb('אכל')]).correct).toBe(true);
  });

  it('takes the defective spelling too (decision 7)', () => {
    expect(checkWritten('לאכל', [verb('אכל')]).correct).toBe(true);
    expect(checkWritten('לדבר', [verb('דיבר')]).correct).toBe(true);
  });

  it('takes a variant: the literary infinitive', () => {
    expect(checkWritten('לאמור', [verb('אמר')])).toMatchObject({ correct: true, verb: verb('אמר') });
  });

  it('takes any verb with the translation and says which one it was', () => {
    expect(checkWritten('להגיד', said)).toMatchObject({ correct: true, verb: verb('הגיד') });
    expect(checkWritten('לדבר', said)).toMatchObject({ correct: true, verb: verb('דיבר') });
  });

  it('takes a regular letter for a final one, with a remark', () => {
    expect(checkWritten('לחלומ', [verb('חלם')])).toEqual({ correct: true, verb: verb('חלם'), finalLetters: true });
    expect(checkWritten('לחלום', [verb('חלם')])).toMatchObject({ finalLetters: false });
  });

  it('ignores spaces and direction marks around the word', () => {
    expect(checkWritten(' ‏לאכול ', [verb('אכל')]).correct).toBe(true);
  });

  it('refuses another word, an empty answer, a word with extra letters', () => {
    expect(checkWritten('לשתות', [verb('אכל')])).toEqual({ correct: false });
    expect(checkWritten('', [verb('אכל')])).toEqual({ correct: false });
    expect(checkWritten('לאכולx', [verb('אכל')])).toEqual({ correct: false });
    expect(checkWritten('אכל', [verb('אכל')])).toEqual({ correct: false });
  });
});
