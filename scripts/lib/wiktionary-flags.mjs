// The conjugator's input from the parameters of an English Wiktionary
// {{he-conj}} table: binyan, root and the lexical flags of
// scripts/lib/conjugate.mjs. What has no flag (an explicit infinitive) comes
// back as a note for a person to turn into an `override`.
//
//   import { fromWiktionary } from './lib/wiktionary-flags.mjs';
//   fromWiktionary({ 1: 'pa', 2: 'חשׁב', nochataf: '+' })
//   // -> { binyan: 'paal', root: 'חשב', flags: { noChataf: true }, notes: [] }
//
// null for a hand-written table ({{he-verb-conjugation}}): no parameters.

const BINYAN = { pa: 'paal', nif: 'nifal', pi: 'piel', pu: 'pual', hif: 'hifil', huf: 'hufal', hit: 'hitpael' };
// Hitpolel is hitpael for the app, with the stem הִתְ־1וֹ2ֵ3: הִסְתּוֹבֵב.
const POLEL = { hitpo: 'hitpael' };
// fut_char: the paal future stem vowel; O is the holam of ע"ו (יָבוֹא).
const FUTURE_VOWEL = { a: 'a', o: 'o', O: 'o', i: 'E', e: 'E' };
const SHIN_DOT = '\u05C1';
// A switch is on as "+" or "1"; off as "-" or absent.
const on = (v) => v !== undefined && v !== '-' && v !== '0' && v !== '';

/**
 * @param {Record<string, string>} params
 * @returns {{ binyan: string, root: string, flags: Record<string, any>, notes: string[] } | null}
 */
export function fromWiktionary(params) {
  if (params.manual || !params[1]) return null;
  const binyan = BINYAN[params[1]] ?? POLEL[params[1]];
  if (!binyan) throw new Error(`unknown binyan ${params[1]}`);
  // The root is one parameter (חשׁב) or one per letter (ק, ו, ה); shin is the default.
  const letters = [params[2], params[3], params[4], params[5]].filter(Boolean).join('');
  const root = letters.replaceAll(SHIN_DOT, '');
  const c1 = root[0];
  const flags = {};
  const notes = [];
  if (POLEL[params[1]]) flags.polel = true;
  if (on(params.nochataf)) flags.noChataf = true;
  if (on(params.assim)) flags.assim = true;
  if (on(params.assim_t)) flags.assimT = true;
  if (on(params.pres_short)) flags.presentShort = true;
  if (params.past_char === 'E') flags.pastVowel = 'E';
  if (params.fut_char) {
    if (!FUTURE_VOWEL[params.fut_char]) throw new Error(`unknown fut_char ${params.fut_char}`);
    flags.futureVowel = FUTURE_VOWEL[params.fut_char];
  }
  if (binyan === 'paal' && params.elide === '+') {
    // The first root letter drops: אֹכַל, הלך as פ"י (יֵלֵךְ, לָלֶכֶת), לָקַחַת.
    if (c1 === 'א') flags.peAlef = true;
    else if (c1 === 'ה') flags.peYod = true;
    else if (c1 !== 'נ' && c1 !== 'י') flags.segolateInfinitive = true;
  }
  if (binyan === 'paal' && params.elide === '-') {
    // It stays: יִישַׁן; a פ"נ infinitive assimilates instead (לִפֹּל).
    if (c1 === 'י') flags.keepYod = true;
    if (c1 === 'נ') flags.override = { 'infinitive.inf': 'לi2*o3' };
  }
  // Wiktionary's module gives this one verb a segol: הֶרְאָה.
  if (binyan === 'hifil' && root === 'ראה') flags.segolPrefix = true;
  if (params.inf) notes.push(`inf: ${params.inf}`);
  return { binyan, root, flags, notes };
}
