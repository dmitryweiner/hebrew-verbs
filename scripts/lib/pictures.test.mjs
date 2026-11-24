import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyReview, PICTURES_FILE, readPictures, reviewPage, serializePictures } from './pictures.mjs';

const ranks = new Map([
  ['היה', 1],
  ['ידע', 2],
  ['הלך', 8],
]);

describe('serializePictures', () => {
  it('writes one verb a line in order of frequency', () => {
    const text = serializePictures({ הלך: { kind: 'emoji', emoji: '🚶', review: 'ok' }, ידע: { kind: 'none', review: 'pending' } }, ranks);
    expect(text).toBe('{\n"ידע": {"kind":"none","review":"pending"},\n"הלך": {"kind":"emoji","emoji":"🚶","review":"ok"}\n}\n');
  });

  it('fails on a verb that is not in the list', () => {
    expect(() => serializePictures({ רץ: { kind: 'svg', review: 'pending' } }, ranks)).toThrow('רץ');
  });

  it('is the format of the committed file', () => {
    const verbs = JSON.parse(readFileSync(new URL('../../src/data/verbs.json', import.meta.url), 'utf8'));
    const text = readFileSync(PICTURES_FILE, 'utf8');
    expect(serializePictures(readPictures(), new Map(verbs.map((v) => [v.id, v.rank])))).toBe(text);
  });
});

describe('applyReview', () => {
  const pictures = {
    הלך: { kind: 'emoji', emoji: '🚶', review: 'pending' },
    ישב: { kind: 'svg', review: 'pending', comment: 'старый' },
    ידע: { kind: 'none', review: 'pending' },
  };

  it('approves, keeping a comment when one is given and dropping an empty one', () => {
    expect(applyReview(pictures, { id: 'הלך', action: 'ok', comment: 'отлично' }).entry).toEqual({
      kind: 'emoji',
      emoji: '🚶',
      review: 'ok',
      comment: 'отлично',
    });
    expect(applyReview(pictures, { id: 'ישב', action: 'ok', comment: ' ' }).entry).toEqual({ kind: 'svg', review: 'ok' });
  });

  it('sends a picture back only with a comment', () => {
    expect(applyReview(pictures, { id: 'ישב', action: 'redo', comment: 'стул ниже' }).entry).toEqual({
      kind: 'svg',
      review: 'redo',
      comment: 'стул ниже',
    });
    expect(() => applyReview(pictures, { id: 'ישב', action: 'redo', comment: '' })).toThrow('comment');
  });

  it('removes a picture: the verb gets an approved "no picture", a drawing is to be deleted', () => {
    const result = applyReview(pictures, { id: 'ישב', action: 'remove', comment: '' });
    expect(result.entry).toEqual({ kind: 'none', review: 'ok' });
    expect(result.pictures['ישב']).toEqual({ kind: 'none', review: 'ok' });
    expect(result.deleteDrawing).toBe(true);
    expect(applyReview(pictures, { id: 'הלך', action: 'remove', comment: '' }).deleteDrawing).toBe(false);
  });

  it('leaves the given pictures as they were', () => {
    applyReview(pictures, { id: 'הלך', action: 'ok', comment: '' });
    expect(pictures['הלך'].review).toBe('pending');
  });

  it('fails on an unknown verb or action', () => {
    expect(() => applyReview(pictures, { id: 'רץ', action: 'ok', comment: '' })).toThrow('רץ');
    expect(() => applyReview(pictures, { id: 'הלך', action: 'maybe', comment: '' })).toThrow('maybe');
  });
});

const verb = (id, rank, nikud, ru) => ({ id, rank, lemma: { nikud }, ru });
const cards = (html) => [...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);

describe('reviewPage', () => {
  const verbs = [
    verb('ידע', 2, 'לָדַעַת', ['знать']),
    verb('הלך', 8, 'לָלֶכֶת', ['идти']),
    verb('ישב', 80, 'לָשֶׁבֶת', ['сидеть', '<садиться>']),
  ];
  const pictures = {
    ידע: { kind: 'none', review: 'ok' },
    הלך: { kind: 'emoji', emoji: '🚶', review: 'pending' },
    ישב: { kind: 'svg', review: 'redo', comment: 'стул "ниже"' },
  };
  const drawings = new Map([['ישב', '<svg viewBox="0 0 128 128"><path d="M0 0"/></svg>']]);
  const page = (query) => reviewPage({ verbs, pictures, drawings, query: new URLSearchParams(query) });

  it('shows the verbs with a picture entry in order of frequency', () => {
    expect(cards(page(''))).toEqual(['ידע', 'הלך', 'ישב']);
  });

  it('takes a range of ranks and a review status', () => {
    expect(cards(page('from=1&to=10'))).toEqual(['ידע', 'הלך']);
    expect(cards(page('status=redo'))).toEqual(['ישב']);
    expect(cards(page('status=pending&to=50'))).toEqual(['הלך']);
  });

  it('shows a drawing inline, an emoji with its Twemoji copy, escapes the texts', () => {
    const html = page('');
    expect(html).toContain('<path d="M0 0"/>');
    expect(html).toContain('emoji/1f6b6.svg');
    expect(html).toContain('&lt;садиться&gt;');
    expect(html).toContain('стул &quot;ниже&quot;');
  });
});
