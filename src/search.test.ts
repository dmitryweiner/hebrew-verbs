import { describe, expect, it } from 'vitest';
import { describeHits, search, searchIndex } from './search';
import { verb, verbs } from './testing';

const index = searchIndex(verbs);
const ids = (query: string) => search(index, query).map((f) => f.verb.id);
const hitsOf = (query: string, id: string) => search(index, query).find((f) => f.verb.id === id)?.hits ?? [];

describe('dictionary search', () => {
  it('lists every verb by frequency for an empty query', () => {
    const found = search(index, '  ');
    expect(found).toHaveLength(verbs.length);
    expect(found.map((f) => f.verb.rank)).toEqual(verbs.map((v) => v.rank).toSorted((a, b) => a - b));
    expect(found.every((f) => f.hits.length === 0)).toBe(true);
  });

  it('finds a Hebrew word by any of its forms, ignoring nikud and final letters', () => {
    expect(ids('אכלתי')[0]).toBe('אכל');
    expect(ids('אָכַלְתִּי')[0]).toBe('אכל');
    expect(ids('ללכת')[0]).toBe('הלך');
    expect(ids('הלכ')[0]).toBe('הלך');
    expect(ids('תאכלנה')[0]).toBe('אכל'); // a literary future
  });

  it('takes the plene, the defective and the variant spelling', () => {
    expect(ids('דיבר')[0]).toBe('דיבר');
    expect(ids('דבר')).toContain('דיבר');
    expect(ids('לאמור')[0]).toBe('אמר');
  });

  it('puts the verbs with that form first, then the verbs of that root, then the forms that start so', () => {
    const found = ids('משך');
    expect(found.slice(0, 4)).toEqual(['משך', 'המשיך', 'נמשך', 'התמשך']);
    // חשב is a form of חשב and, defective, of חישב; then the rest of the root by frequency.
    expect(ids('חשב').slice(0, 5)).toEqual(['חשב', 'חישב', 'נחשב', 'התחשב', 'החשיב']);
    expect(ids('לאכ')).toContain('אכל');
    expect(new Set(ids('א')).size).toBe(ids('א').length);
  });

  it('finds a root spelled with separators by its root only', () => {
    expect(ids('ח־ש־ב')).toEqual(['חשב', 'חישב', 'נחשב', 'התחשב', 'החשיב']);
    expect(ids('ח.ש.ב')).toEqual(ids('ח־ש־ב'));
    expect(ids('ח-ש-ב')).toEqual(ids('ח־ש־ב'));
    expect(ids('ה.ל.ך')).toEqual(['הלך']);
    expect(ids('ה.ל.כ')).toEqual(['הלך']);
    expect(ids('ח־ש')).toEqual([]);
  });

  it('finds Russian by the start of a word of a translation, without case and ё', () => {
    expect(ids('есть')[0]).toBe('אכל');
    expect(ids('Писать')[0]).toBe('כתב');
    expect(ids('замуж')).toEqual(['התחתן', 'נישא']);
    expect(ids('выходить за')).toEqual(['התחתן', 'נישא']);
    expect(ids('освобожден')).toContain('שוחרר');
    expect(ids('исать')).not.toContain('כתב');
  });

  it('puts a translation equal to the query before the ones that only start with it', () => {
    // נטל (rank 661) is "брать", השתלט (392) "брать под контроль".
    expect(ids('брать').slice(0, 3)).toEqual(['לקח', 'נטל', 'השתלט']);
    expect(ids('ходить')).toContain('הלך');
  });

  it('finds nothing for a query in neither language', () => {
    expect(ids('write')).toEqual([]);
    expect(ids('123')).toEqual([]);
  });

  it('tells which forms matched, but not the headword itself', () => {
    expect(hitsOf('אכלתי', 'אכל')).toEqual([{ where: 'past', form: verb('אכל').past['1s'], persons: expect.any(Array) }]);
    expect(hitsOf('לאכול', 'אכל')).toEqual([]);
    expect(hitsOf('ללכת', 'הלך')).toEqual([]);
    expect(hitsOf('משך', 'המשיך')).toEqual([]); // by its root
    expect(hitsOf('לאכ', 'אכל')).toEqual([]); // by the start
  });
});

/** The hits of a verb found by the query, as [form shown, where, persons]. */
const described = (query: string, id: string, spelling: 'nikud' | 'plain') =>
  describeHits(hitsOf(query, id), spelling).map(({ form, where, persons }) => [form[spelling], where, persons]);

describe('the matched forms, described', () => {
  it('name the tense and the persons that take the form', () => {
    expect(described('אכלתי', 'אכל', 'nikud')).toEqual([['אָכַלְתִּי', 'past', 'я']]);
    expect(described('אוכל', 'אכל', 'plain')).toEqual([
      ['אוכל', 'present', 'я (м.), ты (м.), он'],
      ['אוכל', 'future', 'я'],
    ]);
    expect(described('תאכלנה', 'אכל', 'plain')).toEqual([['תאכלנה', 'literary', 'вы (ж.), они (ж.)']]);
  });

  it('keep the forms apart that the spelling shown tells apart', () => {
    expect(described('היית', 'היה', 'plain')).toEqual([['היית', 'past', 'ты (м.), ты (ж.)']]);
    expect(described('היית', 'היה', 'nikud')).toEqual([
      ['הָיִיתָ', 'past', 'ты (м.)'],
      ['הָיִית', 'past', 'ты (ж.)'],
    ]);
  });
});
