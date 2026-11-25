// The Russian phrase shown after an answer: "ты (ж.) ела / съела" (plan 3.2,
// docs/data.md "Russian forms").

import type { Person } from './persons';
import type { RuForms, RuGender, RuPerson, RuVerb } from './verbs';

const BUDU: Record<RuPerson, string> = { '1s': 'буду', '2s': 'будешь', '3s': 'будет', '1p': 'будем', '2p': 'будете', '3p': 'будут' };
const BYL: Record<RuGender, string> = { m: 'был', f: 'была', pl: 'были' };

const both = (ipf: string | undefined, pf: string | undefined): string => [ipf, pf].filter((s) => s !== undefined).join(' / ');

function verbPhrase(ru: RuVerb, person: Person): string {
  const { person: p, gender } = person.ru;
  if (person.tense === 'present') return ru.present?.[p] ?? ru.ipf;
  if (person.tense === 'past') return both(ru.past.ipf[gender], ru.past.pf?.[gender]);
  return both(ru.future.ipf?.[p] ?? `${BUDU[p]} ${ru.ipf}`, ru.future.pf?.[p]);
}

function predicate(ru: RuForms, person: Person): string {
  const { person: p, gender, feminine } = person.ru;
  if ('short' in ru) {
    const short = ru.short[gender];
    if (person.tense === 'present') return short;
    return `${person.tense === 'past' ? BYL[gender] : BUDU[p]} ${short}`;
  }
  return verbPhrase(feminine && ru.f ? ru.f : ru, person);
}

/** The verb's form for a person in Russian, the pronoun label first; both aspects where there is a pair. */
export function ruPhrase(verb: { ruForms: RuForms }, person: Person): string {
  return `${person.label} ${predicate(verb.ruForms, person)}`;
}
