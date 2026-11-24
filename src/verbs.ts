// The verb data (src/data/verbs.json, written by scripts/build-verbs.mjs):
// its types and a check of its shape, so the app reads it without casts.

export type Binyan = 'paal' | 'nifal' | 'piel' | 'pual' | 'hifil' | 'hufal' | 'hitpael';
export const BINYANIM: readonly Binyan[] = ['paal', 'nifal', 'piel', 'pual', 'hifil', 'hufal', 'hitpael'];

export const PRESENT_SLOTS = ['ms', 'fs', 'mp', 'fp'] as const;
export const PAST_SLOTS = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'] as const;
export const FUTURE_SLOTS = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3mp', '3fp'] as const;
export const LITERARY_SLOTS = ['2fp', '3fp'] as const;
export const RU_PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
export const RU_GENDERS = ['m', 'f', 'pl'] as const;

export type PresentSlot = (typeof PRESENT_SLOTS)[number];
export type PastSlot = (typeof PAST_SLOTS)[number];
export type FutureSlot = (typeof FUTURE_SLOTS)[number];
export type LiterarySlot = (typeof LITERARY_SLOTS)[number];
export type RuPerson = (typeof RU_PERSONS)[number];
export type RuGender = (typeof RU_GENDERS)[number];

/** A verb form: classical nikud, plene spelling, other accepted spellings, Cyrillic as spoken. */
export interface Form {
  nikud: string;
  plain: string;
  variants?: string[];
  translit: string;
}

/** Russian forms of an ordinary verb for the phrases after an answer (plan, 1.3). */
export interface RuVerb {
  ipf: string;
  pf?: string;
  present?: Record<RuPerson, string>;
  past: { ipf: Record<RuGender, string>; pf?: Record<RuGender, string> };
  /** ipf only where the future is simple (быть: буду); else "будешь" + ipf. */
  future: { ipf?: Record<RuPerson, string>; pf?: Record<RuPerson, string> };
  /** The pair for a woman where Russian says it otherwise: выйти замуж. */
  f?: RuVerb;
}

/** A passive or a state: the short form by gender; был / буду come from the app. */
export interface RuPassive {
  ipf: string;
  short: Record<RuGender, string>;
}

export type RuForms = RuVerb | RuPassive;

export interface Verb {
  /** The past 3ms in plene spelling (דיבר): statistics are kept by it, never change it. */
  id: string;
  /** 1 = the most frequent. */
  rank: number;
  binyan: Binyan;
  root: string[];
  /** Translations, the first is the main one. */
  ru: string[];
  /** The headword: the infinitive, or the past 3ms where there is none (pual, hufal). */
  lemma: Form;
  infinitive?: Form;
  present?: Record<PresentSlot, Form>;
  past: Record<PastSlot, Form>;
  future?: Record<FutureSlot, Form>;
  /** תֹּאכַלְנָה: shown in the dictionary only (decision 6). */
  futureLiterary?: Record<LiterarySlot, Form>;
  ruForms: RuForms;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(isString);

function isForm(value: unknown): value is Form {
  if (!isRecord(value)) return false;
  const { nikud, plain, variants, translit } = value;
  return isString(nikud) && isString(plain) && isString(translit) && (variants === undefined || isStrings(variants));
}

/** A record with exactly these keys, each value passing the check. */
function isTable<K extends string, T>(value: unknown, keys: readonly K[], check: (v: unknown) => v is T): value is Record<K, T> {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((k) => check(value[k]));
}
const optional = (value: unknown, check: (v: unknown) => boolean): boolean => value === undefined || check(value);

function isRuVerb(value: unknown): value is RuVerb {
  if (!isRecord(value)) return false;
  const { ipf, pf, present, past, future, f } = value;
  const persons = (v: unknown): v is Record<RuPerson, string> => isTable(v, RU_PERSONS, isString);
  const genders = (v: unknown): v is Record<RuGender, string> => isTable(v, RU_GENDERS, isString);
  return (
    isString(ipf) &&
    optional(pf, isString) &&
    optional(present, persons) &&
    isRecord(past) &&
    genders(past.ipf) &&
    optional(past.pf, genders) &&
    isRecord(future) &&
    optional(future.ipf, persons) &&
    optional(future.pf, persons) &&
    optional(f, isRuVerb)
  );
}

function isRuPassive(value: unknown): value is RuPassive {
  return isRecord(value) && isString(value.ipf) && isTable(value.short, RU_GENDERS, isString);
}

const isBinyan = (value: unknown): value is Binyan => BINYANIM.some((b) => b === value);

export function isVerb(value: unknown): value is Verb {
  if (!isRecord(value)) return false;
  const v = value;
  return (
    isString(v.id) &&
    typeof v.rank === 'number' &&
    isBinyan(v.binyan) &&
    isStrings(v.root) &&
    isStrings(v.ru) &&
    isForm(v.lemma) &&
    optional(v.infinitive, isForm) &&
    optional(v.present, (x): x is Record<PresentSlot, Form> => isTable(x, PRESENT_SLOTS, isForm)) &&
    isTable(v.past, PAST_SLOTS, isForm) &&
    optional(v.future, (x): x is Record<FutureSlot, Form> => isTable(x, FUTURE_SLOTS, isForm)) &&
    optional(v.futureLiterary, (x): x is Record<LiterarySlot, Form> => isTable(x, LITERARY_SLOTS, isForm)) &&
    (isRuVerb(v.ruForms) || isRuPassive(v.ruForms))
  );
}

/** The verb list from parsed JSON; throws on the first verb of a wrong shape. */
export function parseVerbs(data: unknown): Verb[] {
  if (!Array.isArray(data)) throw new Error('verb data: not a list');
  const bad = data.findIndex((v) => !isVerb(v));
  if (bad >= 0) throw new Error(`verb data: verb ${bad + 1} has a wrong shape`);
  return data.filter(isVerb);
}
