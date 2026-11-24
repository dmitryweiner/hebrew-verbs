import { describe, expect, it } from 'vitest';
import { formsOf, readList, readTables } from './verbs.mjs';

const list = readList();
const tables = readTables();
const verb = (lemma) => list.find((v) => v.lemma === lemma);
/** The transliteration of these slots of a listed verb. */
const t = (lemma, keys) => {
  const forms = formsOf(verb(lemma), tables);
  return keys.map((k) => forms[k].translit);
};

describe('transliteration into Cyrillic, as spoken', () => {
  it('reads begedkefet by the dagesh and does not double a consonant', () => {
    expect(t('דיבר', ['past.3ms', 'past.2mp', 'infinitive.inf'])).toEqual(['дибер', 'дибартем', 'ледабер']);
    expect(t('לקח', ['future.1s', 'past.3ms'])).toEqual(['эках', 'лаках']);
  });

  it('sounds a sheva on a prefix, the second of two, before the same letter', () => {
    expect(t('דיבר', ['present.ms', 'future.3ms', 'future.1p'])).toEqual(['медабер', 'едабер', 'недабер']);
    expect(t('כתב', ['future.3mp', 'future.2fs'])).toEqual(['ихтеву', 'тихтеви']);
    expect(t('התמודד', ['past.3p'])).toEqual(['hитмодеду']);
  });

  it('keeps a sheva silent after a vowel and under a doubled letter, as spoken', () => {
    expect(t('כתב', ['past.3fs', 'present.mp'])).toEqual(['катва', 'котвим']);
    expect(t('דיבר', ['present.mp', 'future.2fs'])).toEqual(['медабрим', 'тедабри']);
  });

  it('reads the paal past 2nd plural as spoken: катавтем, not ктавтем', () => {
    expect(t('כתב', ['past.2mp', 'past.2fp'])).toEqual(['катавтем', 'катавтен']);
    expect(t('ראה', ['past.2mp'])).toEqual(['раитем']);
    expect(t('אכל', ['past.2mp'])).toEqual(['ахальтем']);
  });

  it('writes ль before a consonant and at the end, э after a vowel or a guttural', () => {
    expect(t('אכל', ['present.ms', 'future.1s'])).toEqual(['охель', 'охаль']);
    expect(t('שאל', ['present.ms', 'past.1s'])).toEqual(['шоэль', 'шаальти']);
    expect(t('ראה', ['present.ms', 'future.2ms'])).toEqual(['роэ', 'тирэ']);
  });

  it('writes ה as a Latin h, as Russian textbooks do, and no hyphen after ל', () => {
    expect(t('הלך', ['past.3ms', 'infinitive.inf'])).toEqual(['hалах', 'лалехет']);
    expect(t('אכל', ['infinitive.inf'])).toEqual(['леэхоль']);
    expect(t('עבד', ['infinitive.inf', 'future.3ms'])).toEqual(['лаавод', 'яавод']);
  });

  it('reads ו and י as consonants or vowel letters', () => {
    expect(t('היה', ['past.3ms', 'past.3fs', 'past.1s', 'future.3ms'])).toEqual(['hая', 'hайта', 'hайити', 'иhье']);
    expect(t('התיישב', ['past.3ms'])).toEqual(['hитьяшев']);
    expect(t('סיים', ['past.3ms'])).toEqual(['сием']);
    expect(t('הוריד', ['past.3ms'])).toEqual(['hорид']);
    expect(t('התכוון', ['past.3ms'])).toEqual(['hиткавен']);
    expect(t('נולד', ['past.3ms', 'future.3ms'])).toEqual(['нолад', 'ивалед']);
    expect(t('אמר', ['infinitive.inf'])).toEqual(['ломар']);
    expect(t('הלך', ['future.3ms', 'infinitive.inf'])).toEqual(['елех', 'лалехет']);
  });

  it('reads a furtive patah before its letter, sin as с', () => {
    expect(t('שמע', ['present.ms', 'past.1s'])).toEqual(['шомеа', 'шамати']);
    expect(t('הגיע', ['past.3ms', 'infinitive.inf'])).toEqual(['hигиа', 'леhагиа']);
    expect(t('שם', ['past.3ms'])).toEqual(['сам']);
  });

  it('reads the hufal prefix as spoken: hуавар', () => {
    expect(t('הוכן', ['past.3ms', 'present.ms'])).toEqual(['hухан', 'мухан']);
    expect(t('הועבר', ['past.3ms'])).toEqual(['hуавар']);
  });

  it('gives every form of every listed verb a transliteration in Cyrillic (and h)', () => {
    const bad = [];
    for (const v of list)
      for (const [key, form] of Object.entries(formsOf(v, tables)))
        if (!/^[а-яёh]+$/.test(form.translit ?? '')) bad.push(`${v.lemma} ${key} ${form.translit}`);
    expect(bad).toEqual([]);
  });
});
