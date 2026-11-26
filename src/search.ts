// The dictionary's search (plan, section 5): one field, the kind of query
// told by its letters. Hebrew is found by any form, without nikud and with
// final letters as regular ones: first the verbs with that very form, then
// the verbs of that root, then the forms that start with it. A root spelled
// with separators (כ־ת־ב, כ.ת.ב) finds its root only; Russian is found by the
// start of a word of a translation, without case and ё.

import { normalizeInput, regularLetters, stripNikud } from './hebrew';
import { labelOf, personsOf, TENSES, type Person, type Tense } from './persons';
import type { Spelling } from './questions';
import type { Form, Verb } from './verbs';

/** Where a matched form sits: the infinitive, a tense, or the literary future (decision 6). */
export type Where = 'infinitive' | Tense | 'literary';

/** A form of a verb that the query names, with the persons that take it (none for the infinitive). */
export interface FormHit {
  where: Where;
  form: Form;
  persons: readonly Person[];
}

export interface Found {
  verb: Verb;
  /** The forms equal to the query, but the headword: what to tell beside it (אָכַלְתִּי · прошедшее, я). */
  hits: FormHit[];
}

interface Entry {
  verb: Verb;
  hit: FormHit | null;
}

export interface SearchIndex {
  /** By rank. */
  verbs: readonly Verb[];
  /** Every spelling of every form, as letters to compare (regularLetters): plene, variants, defective. */
  forms: Map<string, Entry[]>;
  roots: Map<string, Verb[]>;
  /** Each verb's translations, as compared. */
  ru: Map<Verb, string[]>;
}

const HEBREW = /[א-ת]/u;
const CYRILLIC = /[а-яё]/iu;
/** Root letters with separators: maqaf, a dot, a hyphen or a space. */
const ROOT = /^[א-ת](?:[־.\-\s]+[א-ת])+$/u;

const lettersOf = (text: string) => regularLetters(normalizeInput(text));
const russian = (text: string) => text.toLowerCase().replaceAll('ё', 'е').trim().replace(/\s+/gu, ' ');

function spellings(form: Form): string[] {
  return [...new Set([form.plain, ...(form.variants ?? []), stripNikud(form.nikud)].map(lettersOf))];
}

function hitsOf(verb: Verb): FormHit[] {
  const hits: FormHit[] = [];
  if (verb.infinitive) hits.push({ where: 'infinitive', form: verb.infinitive, persons: [] });
  const tables: Record<Tense, Partial<Record<string, Form>> | undefined> = {
    present: verb.present,
    past: verb.past,
    future: verb.future,
  };
  for (const tense of TENSES) {
    const table = tables[tense];
    if (!table) continue;
    for (const [slot, form] of Object.entries(table))
      if (form) hits.push({ where: tense, form, persons: personsOf(tense).filter((p) => p.slot === slot) });
  }
  for (const [slot, form] of Object.entries(verb.futureLiterary ?? {}))
    hits.push({ where: 'literary', form, persons: personsOf('future').filter((p) => p.slot === slot) });
  return hits;
}

function add<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function searchIndex(verbs: readonly Verb[]): SearchIndex {
  const sorted = verbs.toSorted((a, b) => a.rank - b.rank);
  const forms = new Map<string, Entry[]>();
  const roots = new Map<string, Verb[]>();
  for (const verb of sorted) {
    for (const key of spellings(verb.lemma)) add(forms, key, { verb, hit: null });
    for (const hit of hitsOf(verb)) {
      const headword = hit.form.nikud === verb.lemma.nikud;
      for (const key of spellings(hit.form)) add(forms, key, { verb, hit: headword ? null : hit });
    }
    add(roots, lettersOf(verb.root.join('')), verb);
  }
  return { verbs: sorted, forms, roots, ru: new Map(sorted.map((v) => [v, v.ru.map(russian)])) };
}

/** Collects the verbs in the order given, each once, with the hits it brought. */
function collect(entries: Iterable<Entry>): Found[] {
  const found = new Map<Verb, FormHit[]>();
  for (const { verb, hit } of entries) {
    const hits = found.get(verb) ?? [];
    if (hit && !hits.includes(hit)) hits.push(hit);
    found.set(verb, hits);
  }
  return [...found].map(([verb, hits]) => ({ verb, hits }));
}

function searchHebrew(index: SearchIndex, query: string): Found[] {
  const exact = collect(index.forms.get(query) ?? []);
  const byRoot = (index.roots.get(query) ?? []).map((verb) => ({ verb, hit: null }));
  const starting: Entry[] = [];
  for (const [key, entries] of index.forms)
    if (key !== query && key.startsWith(query)) for (const { verb } of entries) starting.push({ verb, hit: null });
  const rest = collect([...byRoot, ...starting.toSorted((a, b) => a.verb.rank - b.verb.rank)]).filter(
    (f) => !exact.some((e) => e.verb === f.verb),
  );
  return [...exact.toSorted((a, b) => a.verb.rank - b.verb.rank), ...rest];
}

/** 0: a translation is the query, 1: starts with it, 2: a word inside starts with it; undefined: no match. */
function ruLevel(translations: readonly string[], query: string): number | undefined {
  let best: number | undefined;
  for (const t of translations) {
    let level: number | undefined;
    if (t === query) level = 0;
    else if (t.startsWith(query)) level = 1;
    else
      for (let i = t.indexOf(query); i > 0; i = t.indexOf(query, i + 1))
        if (/[\s(-]/u.test(t[i - 1] ?? '')) {
          level = 2;
          break;
        }
    if (level !== undefined && (best === undefined || level < best)) best = level;
  }
  return best;
}

function searchRussian(index: SearchIndex, query: string): Found[] {
  const levels: { verb: Verb; level: number }[] = [];
  for (const verb of index.verbs) {
    const level = ruLevel(index.ru.get(verb) ?? [], query);
    if (level !== undefined) levels.push({ verb, level });
  }
  return levels.toSorted((a, b) => a.level - b.level || a.verb.rank - b.verb.rank).map(({ verb }) => ({ verb, hits: [] }));
}

/** The verbs the query finds, best first; an empty query lists them all by rank. */
export function search(index: SearchIndex, query: string): Found[] {
  const q = query.trim();
  if (q === '') return index.verbs.map((verb) => ({ verb, hits: [] }));
  if (ROOT.test(normalizeInput(q))) {
    const letters = lettersOf(q).replace(/[^א-ת]/gu, '');
    return (index.roots.get(letters) ?? []).map((verb) => ({ verb, hits: [] }));
  }
  if (HEBREW.test(q)) return searchHebrew(index, lettersOf(q));
  if (CYRILLIC.test(q)) return searchRussian(index, russian(q));
  return [];
}

/** A verb's hits as shown: a form in the spelling shown, where it sits, and who says it ("я (м.), ты (м.), он"). */
export function describeHits(hits: readonly FormHit[], spelling: Spelling): { form: Form; where: Where; persons: string }[] {
  const groups: { form: Form; where: Where; persons: Person[] }[] = [];
  for (const hit of hits) {
    const same = groups.find((g) => g.where === hit.where && g.form[spelling] === hit.form[spelling]);
    if (same) same.persons.push(...hit.persons);
    else groups.push({ form: hit.form, where: hit.where, persons: [...hit.persons] });
  }
  return groups.map(({ form, where, persons }) => ({ form, where, persons: labelOf(persons) }));
}
