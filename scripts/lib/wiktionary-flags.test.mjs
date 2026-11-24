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
    expect(fromWiktionary({ 1: 'hif', 2: 'חלט', nochataf: '1' })?.flags).toEqual({ noChataf: true });
    expect(fromWiktionary({ 1: 'pi', 2: 'ק', 3: 'ו', 4: 'ה' })?.root).toBe('קוה');
    expect(fromWiktionary({ 1: 'pa', 2: 'שׂים' })?.root).toBe('שׂים');
    expect(fromWiktionary({ 1: 'hitpo', 2: 'סבב' })).toMatchObject({ binyan: 'hitpael', flags: { polel: true } });
    expect(fromWiktionary({ 1: 'po', 2: 'פצץ' })).toMatchObject({ binyan: 'piel', flags: { polel: true } });
    expect(fromWiktionary({ 1: 'pa', 2: 'נשם', assim: '-' })?.flags).toEqual({ noAssim: true });
    expect(fromWiktionary({ 1: 'pa', 2: 'שׂנא', past_char: 'i' })?.flags).toEqual({ pastVowel: 'E' });
    // A rafe stays (פִסְפֵס has no dagesh); other points go.
    expect(fromWiktionary({ 1: 'pi', 2: 'פֿספֿס' })?.root).toBe('פֿספֿס');
    expect(() => fromWiktionary({ 1: 'pu', 2: 'ס', 3: 'נְכְר', 4: 'ן' })).toThrow(/five-letter/);
  });

  it('leaves a hand-written table and an explicit infinitive to a person', () => {
    expect(fromWiktionary({ manual: '+' })).toBeNull();
    expect(fromWiktionary({ 1: 'pa', 2: 'אמר', elide: '+', inf: 'לוֹמַר' })?.notes).toEqual(['inf: לוֹמַר']);
    expect(fromWiktionary({ 1: 'pa', 2: 'חנה', fut_pre_stem: 'ַחֲנ' })?.notes).toEqual(['fut_pre_stem: ַחֲנ']);
  });

  // The hand-set flags of the golden verbs are the reference: the mapped
  // ones must conjugate to the same forms. A hand `override` (an explicit
  // infinitive, a form where the sources disagree) is a person's decision
  // and is kept.
  for (const verb of golden.filter((v) => !v.wiktionary.manual)) {
    it(`${verb.lemma} (${verb.binyan})`, () => {
      const mapped = fromWiktionary(verb.wiktionary);
      expect(mapped?.binyan).toBe(verb.binyan);
      const flags = verb.flags.override ? { ...mapped?.flags, override: verb.flags.override } : mapped?.flags;
      expect(conjugate({ ...verb, root: mapped?.root, flags })).toEqual(conjugate(verb));
    });
  }
});
