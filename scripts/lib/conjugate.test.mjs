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
