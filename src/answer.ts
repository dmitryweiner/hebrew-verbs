// A typed answer (plan 3.1, game "write"; decision 7): without nikud, plene or
// defective spelling, a regular letter for a final one is taken with a remark.

import { normalizeInput, regularLetters, stripNikud } from './hebrew';
import type { Form, Verb } from './verbs';

export type Verdict = { correct: true; verb: Verb; finalLetters: boolean } | { correct: false };

/** Every spelling taken for a form: plene, the variants, and defective (the nikud's letters). */
function spellings(form: Form): string[] {
  return [form.plain, ...(form.variants ?? []), stripNikud(form.nikud)];
}

/** Checks a typed headword against the right verbs, the asked one first; names the verb it matched. */
export function checkWritten(input: string, accepted: readonly Verb[]): Verdict {
  const typed = normalizeInput(input);
  if (typed === '') return { correct: false };
  const exact = accepted.find((v) => spellings(v.lemma).includes(typed));
  if (exact) return { correct: true, verb: exact, finalLetters: false };
  const loose = accepted.find((v) => spellings(v.lemma).some((s) => regularLetters(s) === regularLetters(typed)));
  return loose ? { correct: true, verb: loose, finalLetters: true } : { correct: false };
}
