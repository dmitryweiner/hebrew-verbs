// The menorah's model forms (src/binyanim.ts) are the conjugator's forms of
// the root פ־ע־ל, so the two never part.
import { describe, expect, it } from 'vitest';
import { BINYAN_MODELS } from '../../src/binyanim.ts';
import { conjugate } from './conjugate.mjs';

describe('the model forms of the menorah', () => {
  it('are the conjugated forms of פ־ע־ל', () => {
    for (const [binyan, model] of Object.entries(BINYAN_MODELS)) {
      const forms = conjugate({ binyan, root: ['פ', 'ע', 'ל'] });
      const shown = { 'infinitive.inf': model.infinitive };
      for (const tense of ['present', 'past', 'future'])
        for (const [slot, form] of Object.entries(model[tense])) shown[`${tense}.${slot}`] = form;
      for (const [key, form] of Object.entries(shown)) {
        const want = forms[key] && { nikud: forms[key].defective, plain: forms[key].plain, translit: forms[key].translit };
        expect({ binyan, key, form }).toEqual({ binyan, key, form: want });
      }
    }
  });
});
