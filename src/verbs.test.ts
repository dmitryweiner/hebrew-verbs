import { describe, expect, it } from 'vitest';
import { parseVerbs } from './verbs.ts';

const form = (nikud: string, plain: string, translit: string) => ({ nikud, plain, translit });
const persons = (w: string) => ({ '1s': w, '2s': w, '3s': w, '1p': w, '2p': w, '3p': w });
const slots = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, form('אָכַל', 'אכל', 'ахаль')]));
const PAST = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'];

const verb = () => ({
  id: 'אכל',
  rank: 38,
  binyan: 'paal',
  root: ['א', 'כ', 'ל'],
  ru: ['есть'],
  lemma: form('לֶאֱכֹל', 'לאכול', 'леэхоль'),
  infinitive: form('לֶאֱכֹל', 'לאכול', 'леэхоль'),
  past: slots(PAST),
  ruForms: {
    ipf: 'есть',
    pf: 'съесть',
    present: persons('ем'),
    past: { ipf: { m: 'ел', f: 'ела', pl: 'ели' } },
    future: { pf: persons('съем') },
  },
});

describe('parseVerbs', () => {
  it('takes verb data of the right shape, optional tenses missing', () => {
    const [v] = parseVerbs([verb()]);
    expect(v?.id).toBe('אכל');
    expect(v?.future).toBeUndefined();
  });

  it('takes a passive: the short form by gender', () => {
    const passive = { ...verb(), ruForms: { ipf: 'быть приглашённым', short: { m: 'приглашён', f: 'приглашена', pl: 'приглашены' } } };
    expect(parseVerbs([passive])).toHaveLength(1);
  });

  it('refuses a missing slot, an empty translation, an unknown binyan', () => {
    const { '3p': _, ...past } = slots(PAST);
    expect(() => parseVerbs([{ ...verb(), past }])).toThrow('verb 1');
    expect(() => parseVerbs([verb(), { ...verb(), ru: [] }])).toThrow('verb 2');
    expect(() => parseVerbs([{ ...verb(), binyan: 'qal' }])).toThrow('verb 1');
    expect(() => parseVerbs({})).toThrow('not a list');
  });
});
