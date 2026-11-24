import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conjugate } from './conjugate.mjs';

// Expected forms: Wiktionary nikud, Hspell spelling, the plan's decisions
// (scripts/conjugator-golden.mjs). A slot lists its accepted alternatives.
const golden = JSON.parse(readFileSync(resolve(import.meta.dirname, 'conjugate.golden.json'), 'utf8'));
const alternatives = (s) => s.split(' / ');
// Where the conjugator gives an accepted form, expect that one, so a failure
// shows only the slots that are wrong.
const pick = (form, accepted) => (accepted.includes(form) ? form : accepted.join(' / '));

describe('conjugator against the golden forms', () => {
  for (const verb of golden) {
    it.skipIf(verb.todo)(`${verb.lemma} (${verb.binyan})`, () => {
      const actual = conjugate(verb);
      const got = {};
      const want = {};
      for (const [key, [nikud, plain]] of Object.entries(verb.forms)) {
        const a = actual[key];
        got[key] = a ? [a.defective, a.plain] : null;
        want[key] = [pick(a?.defective, alternatives(nikud)), pick(a?.plain, alternatives(plain))];
      }
      for (const key of Object.keys(actual)) if (!verb.forms[key]) got[key] = [actual[key].defective, actual[key].plain];
      expect(got).toEqual(want);
    });
  }
});

/** Forms of these slots as "nikud plain". */
const forms = (verb, keys) => {
  const c = conjugate(verb);
  return keys.map((k) => `${c[k].defective} ${c[k].plain}`);
};

describe('conjugator on roots that only look weak', () => {
  const keys = ['past.3ms', 'past.1s', 'present.ms', 'future.3ms', 'infinitive.inf'];

  it('takes a consonantal ו with the strong flag: הִרְוִיחַ', () => {
    expect(forms({ binyan: 'hifil', root: 'רוח', flags: { strong: true } }, keys)).toEqual([
      'הִרְוִיחַ הרוויח',
      'הִרְוַחְתִּי הרווחתי',
      'מַרְוִיחַ מרוויח',
      'יַרְוִיחַ ירוויח',
      'לְהַרְוִיחַ להרוויח',
    ]);
  });

  it('takes C2 = C3 as strong with the strong flag: הִפְלִיל', () => {
    expect(forms({ binyan: 'hifil', root: 'פלל', flags: { strong: true } }, keys)).toEqual([
      'הִפְלִיל הפליל',
      'הִפְלַלְתִּי הפללתי',
      'מַפְלִיל מפליל',
      'יַפְלִיל יפליל',
      'לְהַפְלִיל להפליל',
    ]);
  });

  it('takes ו before a final ה as ל"ה, not hollow: הִלְוָה', () => {
    expect(forms({ binyan: 'hifil', root: 'לוה' }, keys)).toEqual([
      'הִלְוָה הלווה',
      'הִלְוֵיתִי הלוויתי',
      'מַלְוֶה מלווה',
      'יַלְוֶה ילווה',
      'לְהַלְווֹת להלוות',
    ]);
  });
});
