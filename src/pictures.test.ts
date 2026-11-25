import { describe, expect, it } from 'vitest';
import { emojiFile, emojiParts, parsePictures, pictureOf } from './pictures.ts';

describe('parsePictures', () => {
  it('reads the three kinds with a review status and an optional comment', () => {
    const pictures = parsePictures({
      הלך: { kind: 'emoji', emoji: '🚶', review: 'ok' },
      ישב: { kind: 'svg', review: 'redo', comment: 'стул ниже' },
      ידע: { kind: 'none', review: 'pending' },
    });
    expect(Object.keys(pictures)).toEqual(['הלך', 'ישב', 'ידע']);
    expect(pictures['ישב']).toEqual({ kind: 'svg', review: 'redo', comment: 'стул ниже' });
  });

  it('names the verb of an entry of a wrong shape', () => {
    expect(() => parsePictures([])).toThrow('not a record');
    expect(() => parsePictures({ הלך: { kind: 'emoji', review: 'ok' } })).toThrow('הלך');
    expect(() => parsePictures({ ישב: { kind: 'svg', review: 'fine' } })).toThrow('ישב');
    expect(() => parsePictures({ ידע: { kind: 'none', review: 'ok', comment: 5 } })).toThrow('ידע');
    expect(() => parsePictures({ ידע: { kind: 'gif', review: 'ok' } })).toThrow('ידע');
  });
});

describe('emojiFile', () => {
  it('names the Twemoji copy by code points without the variation selector', () => {
    expect(emojiFile('🚶')).toBe('1f6b6.svg');
    expect(emojiFile('✍️')).toBe('270d.svg');
    expect(emojiFile('🧑‍🍳')).toBe('1f9d1-200d-1f373.svg');
  });
});

describe('emojiParts', () => {
  it('splits a pair of emoji, keeping ZWJ sequences and variation selectors whole', () => {
    expect(emojiParts('🧠💭')).toEqual(['🧠', '💭']);
    expect(emojiParts('🫳📦')).toEqual(['🫳', '📦']);
    expect(emojiParts('❤️‍🩹')).toEqual(['❤️‍🩹']);
    expect(emojiParts('▶️')).toEqual(['▶️']);
  });
});

describe('pictureOf', () => {
  const pictures = parsePictures({
    הלך: { kind: 'emoji', emoji: '🚶', review: 'ok' },
    ישב: { kind: 'svg', review: 'ok' },
    שתה: { kind: 'svg', review: 'pending' },
    לקח: { kind: 'emoji', emoji: '🫴', review: 'redo', comment: 'непонятно' },
    זכר: { kind: 'emoji', emoji: '🧠💭', review: 'ok' },
    ידע: { kind: 'none', review: 'ok' },
  });

  it('gives an approved emoji with a fallback copy of each, an approved drawing with its file', () => {
    expect(pictureOf(pictures, 'הלך')).toEqual({ kind: 'emoji', emoji: '🚶', twemoji: ['1f6b6.svg'] });
    expect(pictureOf(pictures, 'זכר')).toEqual({ kind: 'emoji', emoji: '🧠💭', twemoji: ['1f9e0.svg', '1f4ad.svg'] });
    expect(pictureOf(pictures, 'ישב')).toEqual({ kind: 'svg', src: 'pictures/ישב.svg' });
  });

  it('gives nothing for an abstract verb, one not approved yet and one without an entry', () => {
    expect(pictureOf(pictures, 'ידע')).toBeUndefined();
    expect(pictureOf(pictures, 'שתה')).toBeUndefined();
    expect(pictureOf(pictures, 'לקח')).toBeUndefined();
    expect(pictureOf(pictures, 'רצה')).toBeUndefined();
  });
});
