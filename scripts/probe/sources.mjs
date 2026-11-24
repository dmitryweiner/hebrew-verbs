// Loaders shared by the probe scripts: the app's slots, Hspell's verb forms
// and the parsed Wiktionary tables, all as { slot: [plain spellings] }.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export const SLOTS = {
  present: ['ms', 'fs', 'mp', 'fp'],
  past: ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'],
  // 2fp/3fp are the spoken forms (= 2mp/3mp); the -נה forms are "literary".
  future: ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3mp', '3fp'],
  literary: ['2fp', '3fp'],
  infinitive: ['inf'],
};
export const slotKeys = () => Object.entries(SLOTS).flatMap(([tense, slots]) => slots.map((s) => `${tense}.${s}`));

export const strip = (s) => s.replace(/[\u0591-\u05C7]/g, '');

const HSPELL_PERSON = {
  אני: '1s',
  אתה: '2ms',
  את: '2fs',
  הוא: '3ms',
  היא: '3fs',
  אנו: '1p',
  אתם: '2mp',
  אתן: '2fp',
  הם: '3p',
  הן: '3p',
};

/** Hspell blocks by past 3ms: lemma -> [{ 'past.1s': ['אכלתי'], ... }]. */
export function loadHspell() {
  const text = readFileSync(resolve(root, '.cache/dl/woo-forms.txt'), 'utf8');
  const byLemma = new Map();
  let block = null;
  const add = (key, word) => (block[key] ??= []).includes(word) || block[key].push(word);
  for (const line of text.split('\n')) {
    if (line.startsWith('-----')) {
      block = null;
      continue;
    }
    if (line.startsWith('#') || line.includes('+') || line.includes('כינוי')) continue;
    const [raw, tag] = line.trim().split(' ');
    // B: an infinitive with ב- (בנפול).
    if (!raw || !tag || tag.includes('סמיכות') || raw.startsWith('B')) continue;
    const word = raw.replace(/^L/, 'ל');
    if (!block) {
      block = {};
      const list = byLemma.get(word) ?? [];
      list.push(block);
      byLemma.set(word, list);
    }
    const [, tense, a, b] = tag.split(',');
    if (tense === 'עבר') add(`past.${HSPELL_PERSON[a]}`, word);
    if (tense === 'עתיד') {
      let slot = HSPELL_PERSON[a];
      if (a === 'הם') slot = '3mp';
      if (a === 'הן') slot = '3fp';
      if (slot === '2fp' || slot === '3fp') add(`literary.${slot}`, word);
      else add(`future.${slot}`, word);
    }
    if (tense === 'הווה') add(`present.${b === 'ז' ? 'm' : 'f'}${a === 'יחיד' ? 's' : 'p'}`, word);
    if (tense === 'מקור') add('infinitive.inf', word);
  }
  // Spoken future 2fp/3fp = 2mp/3mp.
  for (const blocks of byLemma.values())
    for (const b of blocks) {
      if (b['future.2mp']) b['future.2fp'] = b['future.2mp'];
      if (b['future.3mp']) b['future.3fp'] = b['future.3mp'];
    }
  return byLemma;
}

/** Wiktionary entry -> { slot: [{ plain, nikud }] } in the app's slots. */
export function wiktionarySlots(entry) {
  if (!entry) return null;
  const out = {};
  for (const [s, forms] of Object.entries(entry.present ?? {})) out[`present.${s}`] = forms;
  for (const [s, forms] of Object.entries(entry.past ?? {})) out[`past.${s}`] = forms;
  for (const [s, forms] of Object.entries(entry.future ?? {})) {
    if (s === '2fp' || s === '3fp') out[`literary.${s}`] = forms;
    else out[`future.${s}`] = forms;
  }
  if (out['future.2mp']) out['future.2fp'] = out['future.2mp'];
  if (out['future.3mp']) out['future.3fp'] = out['future.3mp'];
  if (entry.infinitive) out['infinitive.inf'] = entry.infinitive;
  return out;
}

/** The Hspell block of a verb: of the blocks under its lemma, the one agreeing most with Wiktionary. */
export function hspellBlock(hspell, lemma, wslots) {
  const keys = slotKeys();
  const blocks = hspell.get(lemma) ?? [];
  const score = (b) => keys.filter((k) => wslots?.[k]?.some((f) => b[k]?.includes(f.plain))).length;
  return blocks.toSorted((a, b) => score(b) - score(a))[0] ?? null;
}

export function loadWiktionary() {
  return JSON.parse(readFileSync(resolve(root, '.cache/wiktionary.json'), 'utf8'));
}

/** Plain spellings the plan prefers to Hspell's, by "lemma slot". */
const PLAIN = {
  // Decision 17: the spoken infinitive first; Hspell has only literary לאמור.
  'אמר infinitive.inf': ['לומר'],
};

/**
 * The expected forms of a verb, slot -> { nikud: [...], plain: [...] }:
 * Wiktionary's nikud, Hspell's spelling (Wiktionary's where Hspell has none),
 * with the plan's decisions applied. `flags.noPresent` drops the present.
 */
export function expectedForms(verb, wslots, hblock) {
  const out = {};
  for (const key of slotKeys()) {
    if (verb.flags?.noPresent && key.startsWith('present.')) continue;
    if (!wslots?.[key]) continue;
    let nikud = [...new Set(wslots[key].map((f) => f.nikud.normalize('NFC')))];
    // Decision 15, classical nikud: 1st person future אֶקַּח, not Wiktionary's אֵקַּח.
    if (key === 'future.1s') nikud = nikud.map((n) => n.replace(/^א\u05B5(?=.[\u05B0-\u05BB]*\u05BC)/u, 'א\u05B6'));
    const plain = PLAIN[`${verb.lemma} ${key}`] ?? hblock?.[key] ?? [...new Set(wslots[key].map((f) => strip(f.plain)))];
    out[key] = { nikud, plain };
  }
  return out;
}
