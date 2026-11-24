import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conjugate } from './conjugate.mjs';
import { fromWiktionary } from './wiktionary-flags.mjs';

const golden = JSON.parse(readFileSync(resolve(import.meta.dirname, 'conjugate.golden.json'), 'utf8'));

describe('conjugator input from Wiktionary parameters', () => {
  it('reads binyan, root and flags', () => {
    expect(fromWiktionary({ 1: 'pa', 2: 'חשׁב', nochataf: '+' })).toEqual({
      binyan: 'paal',
      root: 'חשב',
      flags: { noChataf: true },
      notes: [],
    });
    expect(fromWiktionary({ 1: 'pi', 2: 'ק', 3: 'ו', 4: 'ה' })?.root).toBe('קוה');
    expect(fromWiktionary({ 1: 'pa', 2: 'שׂים' })?.root).toBe('שׂים');
  });

  it('leaves a hand-written table and an explicit infinitive to a person', () => {
    expect(fromWiktionary({ manual: '+' })).toBeNull();
    expect(fromWiktionary({ 1: 'pa', 2: 'אמר', elide: '+', inf: 'לוֹמַר' })?.notes).toEqual(['inf: לוֹמַר']);
  });

  // The hand-set flags of the golden verbs are the reference: the mapped
  // ones must conjugate to the same forms. A hand `override` is kept where
  // the mapping asks a person for it.
  for (const verb of golden.filter((v) => !v.wiktionary.manual)) {
    it(`${verb.lemma} (${verb.binyan})`, () => {
      const mapped = fromWiktionary(verb.wiktionary);
      expect(mapped?.binyan).toBe(verb.binyan);
      const flags = mapped?.notes.length ? { ...mapped.flags, override: verb.flags.override } : mapped?.flags;
      expect(conjugate({ ...verb, root: mapped?.root, flags })).toEqual(conjugate(verb));
    });
  }
});
