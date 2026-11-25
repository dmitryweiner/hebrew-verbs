// Pronouns and the persons of each tense (plan, section 2): which form of a
// tense a pronoun takes and how the Russian phrase says it.

import { texts } from './texts';
import type { Form, FutureSlot, PastSlot, PresentSlot, RuGender, RuPerson, Verb } from './verbs';

export type Tense = 'present' | 'past' | 'future';
export const TENSES: readonly Tense[] = ['present', 'past', 'future'];

export type PronounId = 'ani' | 'ata' | 'at' | 'hu' | 'hi' | 'anachnu' | 'atem' | 'aten' | 'hem' | 'hen';

/** A Hebrew pronoun, spelled like a verb form. */
export interface Pronoun {
  id: PronounId;
  nikud: string;
  plain: string;
  translit: string;
}

const pronoun = (id: PronounId, nikud: string, plain: string, translit: string): Pronoun => ({ id, nikud, plain, translit });

export const PRONOUNS: Record<PronounId, Pronoun> = {
  ani: pronoun('ani', 'אֲנִי', 'אני', 'ани'),
  ata: pronoun('ata', 'אַתָּה', 'אתה', 'ата'),
  at: pronoun('at', 'אַתְּ', 'את', 'ат'),
  hu: pronoun('hu', 'הוּא', 'הוא', 'hу'),
  hi: pronoun('hi', 'הִיא', 'היא', 'hи'),
  anachnu: pronoun('anachnu', 'אֲנַחְנוּ', 'אנחנו', 'анахну'),
  atem: pronoun('atem', 'אַתֶּם', 'אתם', 'атем'),
  aten: pronoun('aten', 'אַתֶּן', 'אתן', 'атен'),
  hem: pronoun('hem', 'הֵם', 'הם', 'hем'),
  hen: pronoun('hen', 'הֵן', 'הן', 'hен'),
};

export type PersonId = keyof typeof texts.persons;

/** How the Russian phrase says a person; feminine picks a verb's pair for a woman (вышла замуж). */
export interface RuSubject {
  person: RuPerson;
  gender: RuGender;
  feminine: boolean;
}

interface PersonBase {
  id: PersonId;
  pronoun: Pronoun;
  /** The Russian label: "ты (ж.)". */
  label: string;
  ru: RuSubject;
}

/** A pronoun in a tense: я (ж.) is a person of its own, the form is the one of its slot. */
export type Person = PersonBase &
  ({ tense: 'present'; slot: PresentSlot } | { tense: 'past'; slot: PastSlot } | { tense: 'future'; slot: FutureSlot });

type Row<S> = [id: PersonId, pronoun: PronounId, person: RuPerson, gender: 'm' | 'f' | 'pl' | 'fpl', slot: S];

const subject = (person: RuPerson, gender: Row<unknown>[3]): RuSubject => ({
  person,
  gender: gender === 'fpl' ? 'pl' : gender,
  feminine: gender === 'f' || gender === 'fpl',
});

const PRESENT: readonly Person[] = (
  [
    ['ani-m', 'ani', '1s', 'm', 'ms'],
    ['ani-f', 'ani', '1s', 'f', 'fs'],
    ['ata', 'ata', '2s', 'm', 'ms'],
    ['at', 'at', '2s', 'f', 'fs'],
    ['hu', 'hu', '3s', 'm', 'ms'],
    ['hi', 'hi', '3s', 'f', 'fs'],
    ['anachnu-m', 'anachnu', '1p', 'pl', 'mp'],
    ['anachnu-f', 'anachnu', '1p', 'fpl', 'fp'],
    ['atem', 'atem', '2p', 'pl', 'mp'],
    ['aten', 'aten', '2p', 'fpl', 'fp'],
    ['hem', 'hem', '3p', 'pl', 'mp'],
    ['hen', 'hen', '3p', 'fpl', 'fp'],
  ] satisfies Row<PresentSlot>[]
).map(([id, p, person, gender, slot]) => ({
  id,
  pronoun: PRONOUNS[p],
  label: texts.persons[id],
  ru: subject(person, gender),
  tense: 'present',
  slot,
}));

const PAST: readonly Person[] = (
  [
    ['ani-m', 'ani', '1s', 'm', '1s'],
    ['ani-f', 'ani', '1s', 'f', '1s'],
    ['ata', 'ata', '2s', 'm', '2ms'],
    ['at', 'at', '2s', 'f', '2fs'],
    ['hu', 'hu', '3s', 'm', '3ms'],
    ['hi', 'hi', '3s', 'f', '3fs'],
    ['anachnu', 'anachnu', '1p', 'pl', '1p'],
    ['atem', 'atem', '2p', 'pl', '2mp'],
    ['aten', 'aten', '2p', 'fpl', '2fp'],
    ['hem', 'hem', '3p', 'pl', '3p'],
    ['hen', 'hen', '3p', 'fpl', '3p'],
  ] satisfies Row<PastSlot>[]
).map(([id, p, person, gender, slot]) => ({
  id,
  pronoun: PRONOUNS[p],
  label: texts.persons[id],
  ru: subject(person, gender),
  tense: 'past',
  slot,
}));

const FUTURE: readonly Person[] = (
  [
    ['ani-m', 'ani', '1s', 'm', '1s'],
    ['ani-f', 'ani', '1s', 'f', '1s'],
    ['ata', 'ata', '2s', 'm', '2ms'],
    ['at', 'at', '2s', 'f', '2fs'],
    ['hu', 'hu', '3s', 'm', '3ms'],
    ['hi', 'hi', '3s', 'f', '3fs'],
    ['anachnu', 'anachnu', '1p', 'pl', '1p'],
    ['atem', 'atem', '2p', 'pl', '2mp'],
    ['aten', 'aten', '2p', 'fpl', '2fp'],
    ['hem', 'hem', '3p', 'pl', '3mp'],
    ['hen', 'hen', '3p', 'fpl', '3fp'],
  ] satisfies Row<FutureSlot>[]
).map(([id, p, person, gender, slot]) => ({
  id,
  pronoun: PRONOUNS[p],
  label: texts.persons[id],
  ru: subject(person, gender),
  tense: 'future',
  slot,
}));

export function personsOf(tense: Tense): readonly Person[] {
  if (tense === 'present') return PRESENT;
  return tense === 'past' ? PAST : FUTURE;
}

/** The verb's form for a person, or undefined where the verb lacks the tense (היה has no present). */
export function formOf(verb: Verb, person: Person): Form | undefined {
  if (person.tense === 'present') return verb.present?.[person.slot];
  if (person.tense === 'past') return verb.past[person.slot];
  return verb.future?.[person.slot];
}
