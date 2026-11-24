// Model conjugator for Hebrew verbs: root + binyan (+ a few lexical flags)
// -> present, past, future and infinitive, each as defective (classical)
// nikud and as plene spelling without nikud (the Academy's ktiv male).
//
// A form is built from a pattern string over the root, then rewritten by
// phonological rules (gutturals, weak letters, assimilation, dagesh) and
// rendered. Tested against Wiktionary and Hspell on the sample verbs
// (conjugate.test.mjs, conjugate.golden.json).
//
//   import { conjugate } from './lib/conjugate.mjs';
//   conjugate({ binyan: 'paal', root: ['א','כ','ל'], flags: { peAlef: true } })
//   // -> { 'past.1s': { defective: 'אָכַלְתִּי', plain: 'אכלתי' }, ... }
//
// Pattern notation: 1 2 3 (4) = root letters; a Hebrew letter = itself; after a
// letter: '*' dagesh forte, then a vowel — ':' silent sheva, '%' vocal sheva,
// a patah, A kamatz, Q kamatz katan, e segol, E tsere, i hiriq, o holam, u kubutz,
// U shuruk (on ו), ~a ~e ~A hataf. ו/י/א/ה without a vowel are vowel letters.
//
// Flags (lexical facts the root and binyan do not give; most are the same as
// Wiktionary's {{he-conj}} parameters, in brackets):
//   peAlef         paal פ"א with a quiet א: יֹאכַל, אֹמַר (elide)
//   peYod          paal future and infinitive as פ"י: הלך → יֵלֵךְ, לָלֶכֶת
//   assim          paal future with C1 assimilated: לקח → יִקַּח (assim)
//   assimT         C3 נ assimilates to the suffix ת: נָתַתִּי (assim_t)
//   futureVowel    paal future stem vowel: 'o' | 'a' | 'E' (fut_char);
//                  hollow verbs: 'o' (יָבוֹא), default u (יָמוּת), ע"י i (יָשִׂים)
//   pastVowel      paal past vowel 'E': hollow מֵת, stative שָׂנֵא (past_char)
//   keepYod        paal פ"י keeping the yod: יִישַׁן, לִישֹׁן (elide=-); future
//                  vowel a; פ"י ל"ה (יִירֶה) keeps it without the flag
//   presentShort   paal present on the adjective pattern: יָשֵׁן, יְשֵׁנָה (pres_short)
//   noChataf       guttural C1 keeps a silent sheva: יַחְשֹׁב (nochataf)
//   keepPrefix     no guttural change of the prefix: יִהְיֶה
//   hatafSegol     a word-initial guttural takes hataf segol: הֱיִיתֶם
//   segolPrefix    hifil past with segol: הֶרְאָה
//   noPresent      no present tense (היה)
//   omit           tenses without forms: ['future', 'literary', 'infinitive'] (נהיה)
//   patahPrefix    paal ח ל"ה/ל"א with patah: יַחֲנֶה (fut_pre_stem)
//   segolateInfinitive  לָקַחַת-type infinitive
//   hollow         treat as ע"ו/ע"י even if C2 is not ו/י
//   noAssim        paal פ"נ keeping its נ: יִנְשֹׁם (assim=-)
//   strong         a root that looks hollow or geminate is strong: הִרְוִיחַ, הִפְלִיל
//   polel          piel and hitpael on the polel stem: פּוֹצֵץ, שׂוֹחֵחַ,
//                  הִתְמוֹדֵד, הִתְעוֹרֵר (Wiktionary po, hitpo)
//   override       { 'infinitive.inf': pattern, ... } for single forms (inf)
// Pual and hufal have no infinitive. A four-letter root (שחרר) takes the
// piel, pual and hitpael patterns with the doubled C2 split in two.
// Not covered yet: pual ל"ה, geminates outside hifil (paal סַבּוֹתִי,
// nifal נָסַב), five-letter roots.

const MARK = {
  ':': '\u05B0',
  '%': '\u05B0',
  '~e': '\u05B1',
  '~a': '\u05B2',
  '~A': '\u05B3',
  i: '\u05B4',
  E: '\u05B5',
  e: '\u05B6',
  a: '\u05B7',
  A: '\u05B8',
  Q: '\u05B8',
  o: '\u05B9',
  u: '\u05BB',
};
const DAGESH = '\u05BC';
const SHIN_DOT = '\u05C1';
const SIN_DOT = '\u05C2';
const RAFE = '\u05BF';
const GUTTURALS = new Set(['א', 'ה', 'ח', 'ע']);
const NO_DOUBLING = new Set(['א', 'ה', 'ח', 'ע', 'ר']);
const BEGEDKEFET = new Set(['ב', 'ג', 'ד', 'כ', 'פ', 'ת']);
const FINAL = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
const SIBILANTS = new Set(['ס', 'ש', 'צ', 'ז']);

/**
 * @typedef {{ l: string, dot?: string, v: string, forte?: boolean, lene?: boolean,
 *   root: 0|1|2|3, medium?: boolean }} Seg
 */

/** Pattern string + root -> segments. */
function parse(pattern, root) {
  /** @type {Seg[]} */
  const segs = [];
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i++];
    let seg;
    if (ch >= '1' && ch <= '4') {
      const r = root[Number(ch) - 1];
      seg = { l: r[0], dot: r[1], v: '', root: Number(ch) };
    } else seg = { l: ch, v: '', root: 0 };
    if (pattern[i] === '*') {
      seg.forte = true;
      i++;
    }
    if (pattern[i] === '~') {
      seg.v = pattern.slice(i, i + 2);
      i += 2;
    } else if (pattern[i] && /[:%aAeEiouUQ]/.test(pattern[i])) seg.v = pattern[i++];
    segs.push(seg);
  }
  return segs;
}

const isVowelLetter = (s) => s.root === 0 && ((s.l === 'ו' && (s.v === 'o' || s.v === 'U')) || (s.v === '' && 'ויאה'.includes(s.l)));

/** Phonology, in order. `opts`: verb flags plus { binyan }. */
function rules(segs, opts) {
  // Assimilation into the suffix: נָתַן+תִּי -> נָתַתִּי, הֵבִין+נוּ -> הֵבַנּוּ.
  for (let k = 0; k < segs.length - 1; k++) {
    const a = segs[k];
    const b = segs[k + 1];
    if (a.root !== opts.last || b.root !== 0 || !(a.v === ':' || a.v === '')) continue;
    if (a.l === b.l || (opts.assimT && a.l === 'נ' && b.l === 'ת')) {
      b.forte = true;
      segs.splice(k, 1);
    }
  }
  // Gutturals and ר take no dagesh forte; before them hiriq -> tsere, in piel
  // only before א/ר (בֵּרֵךְ; נִהֵל, שִׁעֵר), in nifal before all (יֵרָגַע, יֵחָשֵׁב).
  // The Academy writes this tsere with י: בירך, יירגע; in nifal also the
  // segol of the 1st person (אֶרָגַע -> אירגע, as Hspell).
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (!s.forte || s.root === 0 || !NO_DOUBLING.has(s.l)) continue;
    s.forte = false;
    const prev = segs[k - 1];
    if (prev?.v === 'i' && ('אר'.includes(s.l) || opts.binyan === 'nifal')) {
      prev.v = 'E';
      // Not in a geminate: מְפֵרָה -> מפרה (as Hspell).
      prev.compensatory = !(opts.geminate && s.root === 3);
    }
    if (prev?.v === 'e' && prev.root === 0 && opts.binyan === 'nifal') prev.compensatory = true;
    // Patah -> kamatz before א/ר: מְבָרֵךְ, הִתְרָאָה.
    if (prev?.v === 'a' && 'אר'.includes(s.l)) prev.v = 'A';
  }
  // Prefix + guttural first root letter with silent sheva: יִעְבֹד -> יַעֲבֹד.
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    const p = segs[k - 1];
    if (s.root !== 1 || s.v !== ':' || !GUTTURALS.has(s.l) || p.root !== 0) continue;
    if (opts.keepPrefix) continue;
    if (opts.noChataf) {
      // יַחְשֹׁב; the hifil past הֶחְזִיק.
      // Nifal: נֶחְשַׁב, but נִהְיָה.
      if (p.v === 'i') p.v = opts.binyan === 'hifil' ? 'e' : opts.binyan === 'nifal' ? (s.l === 'ה' ? 'i' : 'e') : 'a';
      continue;
    }
    if (p.v === 'u') {
      // Hufal: הָעֳבַר (kamatz katan, hataf kamatz).
      p.v = 'Q';
      s.v = '~A';
    } else if (p.v === 'a') {
      // Hifil present, future, infinitive: מַאֲמִין, יַעֲבִיר.
      s.v = '~a';
    } else if (p.v === 'e' || s.l === 'א' || opts.binyan === 'nifal' || opts.binyan === 'hifil') {
      p.v = 'e';
      s.v = '~e';
    } else if (p.v === 'i') {
      p.v = 'a';
      s.v = '~a';
    }
  }
  // Paal פ"י keeping its yod: the yod is a vowel letter after hiriq: יִירֶה, אִישַׁן.
  if (opts.binyan === 'paal')
    for (let k = 1; k < segs.length; k++) {
      const s = segs[k];
      const p = segs[k - 1];
      if (s.root !== 1 || s.l !== 'י' || s.v !== ':' || p.root !== 0) continue;
      p.v = 'i';
      s.v = '';
      s.quiet = true;
    }
  // Vocal sheva on a guttural -> hataf, in harmony with the vowel before.
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (s.v !== '%' || !GUTTURALS.has(s.l)) continue;
    s.v = segs[k - 1]?.v === 'e' || (k === 0 && opts.hatafSegol) ? '~e' : '~a';
  }
  // Hifil: the prefix hataf patah before a guttural with patah is patah: הַעַרְתֶּם, הַאַטְתֶּם.
  for (let k = 0; k < segs.length - 1; k++) {
    const s = segs[k];
    const n = segs[k + 1];
    if (opts.binyan !== 'hifil' || s.root !== 0 || s.v !== '~a') continue;
    if (n.root === 1 && GUTTURALS.has(n.l) && n.v === 'a') s.v = 'a';
  }
  // Hataf before a vocal sheva becomes a full vowel: תַּעֲבְדִי -> תַּעַבְדִי.
  for (let k = 0; k < segs.length - 1; k++) {
    const s = segs[k];
    const n = segs[k + 1];
    if (s.v.startsWith('~') && n.v === '%') {
      // ~A -> A: the same sign, written without ו (הָעָבְרָה -> הועברה).
      s.v = s.v[1];
      n.v = ':';
      n.medium = true;
    } else if (s.v.startsWith('~') && n.v.startsWith('~')) s.v = s.v[1]; // נֶאֶחֱזָה
  }
  // Quiescent א (ל"א, ע"ו+א): מָצַאתִי -> מָצָאתִי, יִמְצַא -> יִמְצָא; outside
  // paal a patah before it is tsere (הוֹצֵאתִי) and the -נָה ending takes
  // segol (תּוֹצֶאנָה).
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    if (s.l !== 'א' || s.root !== opts.last) continue;
    const last = k === segs.length - 1;
    if (s.v === ':' || (s.v === '' && last)) {
      s.v = '';
      s.quiet = true;
      const p = segs[k - 1];
      const n = segs[k + 1];
      if (p.v === 'a') p.v = opts.binyan === 'paal' || last ? 'A' : 'E';
      if (p.v === 'E' && n?.l === 'נ' && n.v === 'A') p.v = 'e';
    }
  }
  // Tsere/hiriq/holam before a closing ח/ע: תַּגֵּעְנָה -> תַּגַּעְנָה.
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    if (s.root !== opts.last || (s.l !== 'ח' && s.l !== 'ע') || s.v !== ':') continue;
    const p = segs[k - 1];
    if (p.v === 'E' || p.v === 'o') p.v = 'a';
  }
  // Dagesh lene: בגדכפת at the start or after a silent sheva.
  segs.forEach((s, k) => {
    if (!BEGEDKEFET.has(s.l) || s.forte || s.dot === RAFE) return;
    const p = segs[k - 1];
    if (k === 0 || (p.v === ':' && !p.medium)) s.lene = true;
  });
  // Furtive patah: שׁוֹמֵעַ, הִגִּיעַ.
  const last = segs[segs.length - 1];
  if ((last.l === 'ח' || last.l === 'ע') && last.v === '') {
    const p = segs[segs.length - 2];
    const before = isVowelLetter(p) ? segs[segs.length - 3]?.v : p.v;
    if (before !== 'a' && before !== 'A') last.furtive = true;
  }
  return segs;
}

function render(segs) {
  let out = '';
  segs.forEach((s, k) => {
    const isLast = k === segs.length - 1;
    let l = isLast && FINAL[s.l] ? FINAL[s.l] : s.l;
    if (s.dot && s.dot !== RAFE) l += s.dot;
    if (s.forte || s.lene || s.v === 'U') l += DAGESH;
    let v = s.v === 'U' ? '' : (MARK[s.v] ?? '');
    if (isLast && s.v === '' && l.startsWith('ך')) v = MARK[':'];
    if (isLast && (s.v === ':' || s.v === '%')) {
      // A word-final sheva is written on ך and on a dageshed ת (אָכַלְתְּ).
      if (!(l.startsWith('ך') || (s.l === 'ת' && (s.forte || s.lene)))) v = '';
    }
    if (s.furtive) v = MARK.a;
    out += l + v;
  });
  return out.normalize('NFC');
}

/**
 * Plene spelling without nikud (the Academy's rules, the cases verbs need):
 * holam -> ו, kubutz -> ו, hiriq -> י in an open syllable, consonantal ו
 * doubled, consonantal י doubled between vowels.
 */
function plene(segs, opts) {
  let out = '';
  segs.forEach((s, k) => {
    const p = segs[k - 1];
    const n = segs[k + 1];
    const isLast = k === segs.length - 1;
    let l = isLast && FINAL[s.l] ? FINAL[s.l] : s.l;
    const consonantal = !isVowelLetter(s) || (s.l === 'ו' && s.root !== 0);
    if (s.l === 'ו' && s.root !== 0 && k > 0 && !isLast) {
      if (!isVowelLetter(p ?? {}) && !(n && n.l === 'ו' && isVowelLetter(n))) l = 'וו';
    }
    if (s.l === 'י' && s.root !== 0 && k > 0 && !isLast && consonantal && !s.quiet) {
      // Not next to a vowel letter (הָיָה -> היה, הָיוּ -> היו), not after a silent sheva.
      const nearMater = (n && isVowelLetter(n)) || (p && isVowelLetter(p));
      if (!nearMater && p.l !== 'י' && s.v !== 'i') l = 'יי';
    }
    out += l;
    if (s.v === 'o' && !(s.l === 'ו' && s.root === 0)) {
      const quietAlef = n && n.l === 'א' && n.v === '' && n.root === 1;
      if (!quietAlef) out += 'ו';
    }
    if (s.v === 'u' || s.v === 'Q') out += 'ו';
    if (s.compensatory) out += 'י';
    // Nifal 1st person before a doubled ו: אֶוָּסֵף -> איווסף (as Hspell).
    if (s.v === 'e' && s.root === 0 && opts.binyan === 'nifal' && n?.l === 'ו' && n.forte) out += 'י';
    if (s.v === 'i' && n) {
      const closed = n.v === ':' && !n.forte && !n.medium;
      // Before a י of its own (a mater or a root י: סִיֵּם -> סיים) no second י.
      const beforeYod = n.l === 'י';
      const geminateC3 = opts.geminate && n.root === 3;
      const hifilPrefix = opts.binyan === 'hifil' && k === 0 && s.l === 'ה';
      if (!closed && !beforeYod && !hifilPrefix && !geminateC3) out += 'י';
    }
  });
  return out;
}

// --- Patterns -------------------------------------------------------------

const PERSONS = {
  past: ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'],
  future: ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3mp', '3fp'],
};
const FUT_PREFIX = { '1s': 'א', '2ms': 'ת', '2fs': 'ת', '3ms': 'י', '3fs': 'ת', '1p': 'נ', '2mp': 'ת', '2fp': 'ת', '3mp': 'י', '3fp': 'י' };
// 2fp/3fp are the spoken forms (= 2mp/3mp); literary -נָה forms are separate.

/** Past from three stems: before a consonant suffix, 3rd person, 2nd plural. */
function past({ c, third, thirdV, pl2 = c }) {
  return {
    'past.1s': `${c}:תiי`,
    'past.2ms': `${c}:תA`,
    'past.2fs': `${c}:ת:`,
    'past.3ms': third,
    'past.3fs': `${thirdV}Aה`,
    'past.1p': `${c}:נוU`,
    'past.2mp': `${pl2}:תeם`,
    'past.2fp': `${pl2}:תeן`,
    'past.3p': `${thirdV}וU`,
  };
}
/** Future from a stem builder: stem(prefixLetter, isFirstSingular). */
function future({ base, vowelEnd, literary }) {
  const out = {};
  for (const p of PERSONS.future) {
    const pre = FUT_PREFIX[p];
    if (['2fs'].includes(p)) out[`future.${p}`] = `${vowelEnd(pre)}iי`;
    else if (['2mp', '3mp', '2fp', '3fp'].includes(p)) out[`future.${p}`] = `${vowelEnd(pre)}וU`;
    else out[`future.${p}`] = base(pre);
  }
  out['literary.2fp'] = literary('ת');
  out['literary.3fp'] = literary('ת');
  return out;
}
const ls = {
  past: (s) => ({
    'past.1s': `${s.c}${s.v12 ?? 'i'}יתiי`,
    'past.2ms': `${s.c}${s.v12 ?? 'i'}יתA`,
    'past.2fs': `${s.c}${s.v12 ?? 'i'}ית`,
    'past.3ms': `${s.c}${s.v3 ?? 'A'}ה`,
    'past.3fs': `${s.c}%תAה`,
    'past.1p': `${s.c}${s.v12 ?? 'i'}ינוU`,
    'past.2mp': `${s.pl2 ?? s.c}${s.v12 ?? 'i'}יתeם`,
    'past.2fp': `${s.pl2 ?? s.c}${s.v12 ?? 'i'}יתeן`,
    'past.3p': `${s.c}וU`,
  }),
};

/** Segolate tail on C2 C3 (+ת): אוֹכֶלֶת, שׁוֹמַעַת, מוֹצֵאת. */
function segolate(root) {
  const c3 = root.at(-1)[0];
  if (c3 === 'א') return '2E3ת';
  if (c3 === 'ח' || c3 === 'ע') return '2a3aת';
  return '2e3eת';
}

const guttural = (c) => GUTTURALS.has(c);

function paal(root, f) {
  const [c1, c2, c3] = root.map((r) => r[0]);
  const P = {};
  // The prefix before a ח takes segol (יֶחֱצֶה, יֶחֱטָא; but יַעֲשֶׂה), unless
  // patahPrefix (יַחֲנֶה).
  const hetPrefix = c1 === 'ח' && (c3 === 'ה' || c3 === 'א') && !f.patahPrefix;
  // פ"נ assimilates (יִטֶּה), unless noAssim or a geminate (יִנְדֹּד).
  const assimilate = (c1 === 'נ' && !guttural(c2) && !f.noAssim && c2 !== c3) || f.assim;
  if (c3 === 'ה') {
    // The future stem up to C2: יִבְ־נ, פ"נ יִ־טּ, פ"א יֹא־פ, ח יֶחֱ־צ.
    const lhStem = (p, first) =>
      f.peAlef ? (first ? 'אo2' : `${p}o12`) : assimilate ? `${p}${first ? 'e' : 'i'}2*` : `${p}${first || hetPrefix ? 'e' : 'i'}1:2`;
    Object.assign(P, ls.past({ c: '1A2', pl2: '1%2' }), {
      'present.ms': '1וo2eה',
      'present.fs': '1וo2Aה',
      'present.mp': '1וo2iים',
      'present.fp': '1וo2וoת',
      ...future({
        base: (p) => `${lhStem(p, p === 'א')}eה`,
        vowelEnd: (p) => lhStem(p, false),
        literary: (p) => `${lhStem(p, false)}eינAה`,
      }),
      'infinitive.inf': 'לi1:2וoת',
    });
    return P;
  }
  if (f.hollow || ((c2 === 'ו' || c2 === 'י') && !f.strong)) {
    const pv = f.pastVowel ?? 'A';
    // ע"י: יָשִׂים; ע"ו: יָקוּם, with futureVowel o: יָבוֹא.
    const iFuture = c2 === 'י' && !f.futureVowel;
    const fv = iFuture ? 'iי' : f.futureVowel === 'o' ? 'וo' : 'וU';
    Object.assign(P, {
      'past.1s': '1a3:תiי',
      'past.2ms': '1a3:תA',
      'past.2fs': '1a3:ת:',
      'past.3ms': `1${pv}3`,
      'past.3fs': `1${pv}3Aה`,
      'past.1p': '1a3:נוU',
      'past.2mp': '1a3:תeם',
      'past.2fp': '1a3:תeן',
      'past.3p': `1${pv}3וU`,
      'present.ms': `1${pv}3`,
      'present.fs': `1${pv}3Aה`,
      'present.mp': `1${pv}3iים`,
      'present.fp': `1${pv}3וoת`,
      ...future({ base: (p) => `${p}A1${fv}3`, vowelEnd: (p) => `${p}A1${fv}3`, literary: (p) => `${p}A1${iFuture ? 'E' : 'o'}3:נAה` }),
      'infinitive.inf': `לA1${fv}3`,
    });
    return P;
  }
  // Stative (pastVowel E): שָׂנֵא; before a consonant ending patah, but ל"א keeps tsere.
  const stative = f.pastVowel === 'E';
  const tsere = stative && c3 === 'א' ? 'E' : 'a';
  Object.assign(P, past({ c: `1A2${tsere}3`, third: stative ? '1A2E3' : '1A2a3', thirdV: '1A2%3', pl2: `1%2${tsere}3` }), {
    'present.ms': '1וo2E3',
    'present.fs': `1וo${segolate(root)}`,
    'present.mp': '1וo2%3iים',
    'present.fp': '1וo2%3וoת',
    'infinitive.inf': 'לi1:2o3',
  });
  if (f.presentShort)
    Object.assign(P, {
      'present.ms': '1A2E3',
      'present.fs': '1%2E3Aה',
      'present.mp': '1%2E3iים',
      'present.fp': '1%2E3וoת',
    });
  let fv = f.futureVowel ?? (guttural(c2) || guttural(c3) || f.peAlef || f.keepYod ? 'a' : 'o');
  if (f.peAlef) {
    Object.assign(
      P,
      future({
        base: (p) => (p === 'א' ? `אo2${fv}3` : `${p}o12${fv}3`),
        vowelEnd: (p) => (p === 'א' ? `אo2%3` : `${p}o12%3`),
        literary: (p) => `${p}o12${fv}3:נAה`,
      }),
    );
  } else if ((c1 === 'י' && !f.keepYod) || f.peYod) {
    fv = f.futureVowel ?? (c3 === 'ח' || c3 === 'ע' ? 'a' : 'E');
    Object.assign(
      P,
      future({
        base: (p) => `${p}E2${fv}3`,
        vowelEnd: (p) => `${p}E2%3`,
        literary: (p) => `${p}E2${c3 === 'א' ? 'e' : fv}3:נAה`,
      }),
    );
    P['infinitive.inf'] = `לA${segolate(root)}`;
  } else if (assimilate) {
    Object.assign(
      P,
      future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}2*${fv}3`,
        vowelEnd: (p) => `${p}i2*%3`,
        literary: (p) => `${p}i2*${c3 === 'א' ? 'e' : fv}3:נAה`,
      }),
    );
  } else {
    Object.assign(
      P,
      future({
        base: (p) => `${p}${p === 'א' || hetPrefix ? 'e' : 'i'}1:2${fv}3`,
        vowelEnd: (p) => `${p}${hetPrefix ? 'e' : 'i'}1:2%3`,
        literary: (p) => `${p}${hetPrefix ? 'e' : 'i'}1:2${c3 === 'א' ? 'e' : fv}3:נAה`,
      }),
    );
  }
  if (f.segolateInfinitive) P['infinitive.inf'] = `לA${segolate(root)}`;
  return P;
}

function piel(root, f) {
  const c3 = root[2][0];
  if (c3 === 'ה')
    return {
      ...ls.past({ c: '1i2*' }),
      'present.ms': 'מ%1a2*eה',
      'present.fs': 'מ%1a2*Aה',
      'present.mp': 'מ%1a2*iים',
      'present.fp': 'מ%1a2*וoת',
      ...future({ base: (p) => `${p}%1a2*eה`, vowelEnd: (p) => `${p}%1a2*`, literary: (p) => `${p}%1a2*eינAה` }),
      'infinitive.inf': 'ל%1a2*וoת',
    };
  // The stem 1-2: past דִּבֵּ, elsewhere דַבֵּ; polel פּוֹצֵץ, hollow שׂוֹחֵחַ.
  const P = f.polel ? polelStem(root) : '1i2*';
  const S = f.polel ? polelStem(root) : '1a2*';
  return {
    ...past({ c: `${P}a3`, third: `${P}E3`, thirdV: `${P}%3` }),
    'present.ms': `מ%${S}E3`,
    'present.fs': `מ%${S.slice(0, -2)}${segolate(root).replace('2', S.slice(-2))}`,
    'present.mp': `מ%${S}%3iים`,
    'present.fp': `מ%${S}%3וoת`,
    ...future({ base: (p) => `${p}%${S}E3`, vowelEnd: (p) => `${p}%${S}%3`, literary: (p) => `${p}%${S}E3:נAה` }),
    'infinitive.inf': `ל%${S}E3`,
  };
}

/** The polel stem: 1וֹ2 (מוֹדֵד), for a hollow root 1וֹ3 with C3 twice (כּוֹנֵן). */
function polelStem(root) {
  return root[1][0] === 'ו' || root[1][0] === 'י' ? '1וo3' : '1וo2';
}

function pual(root) {
  return {
    ...past({ c: '1u2*a3', third: '1u2*a3', thirdV: '1u2*%3' }),
    'present.ms': 'מ%1u2*A3',
    'present.fs': `מ%1u${segolate(root).replace('2', '2*')}`,
    'present.mp': 'מ%1u2*A3iים',
    'present.fp': 'מ%1u2*A3וoת',
    ...future({ base: (p) => `${p}%1u2*a3`, vowelEnd: (p) => `${p}%1u2*%3`, literary: (p) => `${p}%1u2*a3:נAה` }),
  };
}

function hufal(root, f) {
  const [c1, c2] = root.map((r) => r[0]);
  // The stem up to the consonant before C3: strong הֻשְׁ־ל, hollow הוּ־כ,
  // פ"י/ו הוּ־ר, פ"נ (and assim) הֻ־גּ.
  const stem = (pre) =>
    (c2 === 'ו' || c2 === 'י') && !f.strong
      ? `${pre}וU1`
      : c1 === 'נ' || f.assim
        ? `${pre}u2*`
        : c1 === 'י' || c1 === 'ו'
          ? `${pre}וU2`
          : `${pre}u1:2`;
  const last = stem('').at(-1) === '*' ? '2*' : stem('').at(-1);
  if (root[2][0] === 'ה')
    // הֻכָּה, מֻכֶּה / מֻכֵּית, יֻכֶּה.
    return {
      ...ls.past({ c: stem('ה'), v12: 'E' }),
      'present.ms': `${stem('מ')}eה`,
      'present.fs': `${stem('מ')}Eית`,
      'present.mp': `${stem('מ')}iים`,
      'present.fp': `${stem('מ')}וoת`,
      ...future({ base: (p) => `${stem(p)}eה`, vowelEnd: (p) => stem(p), literary: (p) => `${stem(p)}eינAה` }),
    };
  return {
    ...past({ c: `${stem('ה')}a3`, third: `${stem('ה')}a3`, thirdV: `${stem('ה')}%3` }),
    'present.ms': `${stem('מ')}A3`,
    'present.fs': `${stem('מ').slice(0, -last.length)}${segolate(root).replace('2', last)}`,
    'present.mp': `${stem('מ')}A3iים`,
    'present.fp': `${stem('מ')}A3וoת`,
    ...future({ base: (p) => `${stem(p)}a3`, vowelEnd: (p) => `${stem(p)}%3`, literary: (p) => `${stem(p)}a3:נAה` }),
  };
}

function hifil(root, f) {
  const [c1, c2, c3] = root.map((r) => r[0]);
  if (c2 === c3 && !f.strong)
    // Geminate: הֵגֵן, מֵגֵן / מְגִנָּה, יָגֵן, לְהָגֵן.
    return {
      ...past({ c: 'הE1a3', third: 'הE1E3', thirdV: 'הE1E3*', pl2: 'ה%1a3' }),
      'present.ms': 'מE1E3',
      'present.fs': 'מ%1i3*Aה',
      'present.mp': 'מ%1i3*iים',
      'present.fp': 'מ%1i3*וoת',
      ...future({ base: (p) => `${p}A1E3`, vowelEnd: (p) => `${p}A1E3*`, literary: (p) => `${p}A1E3:נAה` }),
      'infinitive.inf': 'ל%הA1E3',
    };
  const pastV = f.segolPrefix ? 'e' : 'i';
  // Hollow, unless ל"ה (הִלְוָה) or strong (הִרְוִיחַ).
  if ((c2 === 'ו' || c2 === 'י') && c3 !== 'ה' && !f.strong)
    return {
      ...past({ c: 'הE1a3', third: 'הE1iי3', thirdV: 'הE1iי3', pl2: 'ה%1a3' }),
      'present.ms': 'מE1iי3',
      'present.fs': 'מ%1iי3Aה',
      'present.mp': 'מ%1iי3iים',
      'present.fp': 'מ%1iי3וoת',
      ...future({ base: (p) => `${p}A1iי3`, vowelEnd: (p) => `${p}A1iי3`, literary: (p) => `${p}A1E3:נAה` }),
      'infinitive.inf': 'ל%הA1iי3',
    };
  // The stem up to C2: strong הִפְ־ס, פ"נ (and פ"י with assim) הִ־גּ, פ"י/ו הוֹ־ד.
  const assimilated = (c1 === 'נ' && !f.noAssim) || f.assim;
  const stem = (pre, v) => (assimilated ? `${pre}${v}2*` : c1 === 'י' || c1 === 'ו' ? `${pre}וo2` : `${pre}${v}1:2`);
  if (c3 === 'ה')
    return {
      'past.1s': `${stem('ה', pastV)}Eיתiי`,
      'past.2ms': `${stem('ה', pastV)}EיתA`,
      'past.2fs': `${stem('ה', pastV)}Eית`,
      'past.3ms': `${stem('ה', pastV)}Aה`,
      'past.3fs': `${stem('ה', pastV)}%תAה`,
      'past.1p': `${stem('ה', pastV)}EינוU`,
      'past.2mp': `${stem('ה', pastV)}Eיתeם`,
      'past.2fp': `${stem('ה', pastV)}Eיתeן`,
      'past.3p': `${stem('ה', pastV)}וU`,
      'present.ms': `${stem('מ', 'a')}eה`,
      'present.fs': `${stem('מ', 'a')}Aה`,
      'present.mp': `${stem('מ', 'a')}iים`,
      'present.fp': `${stem('מ', 'a')}וoת`,
      ...future({ base: (p) => `${stem(p, 'a')}eה`, vowelEnd: (p) => stem(p, 'a'), literary: (p) => `${stem(p, 'a')}eינAה` }),
      'infinitive.inf': `ל%${stem('ה', 'a')}וoת`,
    };
  return {
    ...past({ c: `${stem('ה', pastV)}a3`, third: `${stem('ה', pastV)}iי3`, thirdV: `${stem('ה', pastV)}iי3` }),
    'present.ms': `${stem('מ', 'a')}iי3`,
    'present.fs': `${stem('מ', 'a')}iי3Aה`,
    'present.mp': `${stem('מ', 'a')}iי3iים`,
    'present.fp': `${stem('מ', 'a')}iי3וoת`,
    ...future({
      base: (p) => `${stem(p, 'a')}iי3`,
      vowelEnd: (p) => `${stem(p, 'a')}iי3`,
      literary: (p) => `${stem(p, 'a')}E3:נAה`,
    }),
    'infinitive.inf': `ל%${stem('ה', 'a')}iי3`,
  };
}

function nifal(root, f) {
  const [c1, c2, c3] = root.map((r) => r[0]);
  if ((c2 === 'ו' || c2 === 'י') && c3 !== 'ה' && !f.strong)
    // Hollow: נָסוֹג, יִסּוֹג; the past as spoken and Hspell: נָסוֹגְתִּי, not נְסוּגוֹתִי.
    return {
      'past.1s': 'נA1וo3:תiי',
      'past.2ms': 'נA1וo3:תA',
      'past.2fs': 'נA1וo3:ת:',
      'past.3ms': 'נA1וo3',
      'past.3fs': 'נA1וo3Aה',
      'past.1p': 'נA1וo3:נוU',
      'past.2mp': 'נA1וo3:תeם',
      'past.2fp': 'נA1וo3:תeן',
      'past.3p': 'נA1וo3וU',
      'present.ms': 'נA1וo3',
      'present.fs': 'נ%1וo3Aה',
      'present.mp': 'נ%1וo3iים',
      'present.fp': 'נ%1וo3וoת',
      ...future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1*וo3`,
        vowelEnd: (p) => `${p}i1*וo3`,
        literary: (p) => `${p}i1*o3:נAה`,
      }),
      'infinitive.inf': 'ל%הi1*וo3',
    };
  // ל"ה with ע takes patah: נַעֲשָׂה (but נֶהֱנָה).
  const L = c1 === 'ע' ? 'נa' : 'נi';
  if (root[2][0] === 'ה')
    return {
      ...ls.past({ c: `${L}1:2`, v12: 'E' }),
      'present.ms': `${L}1:2eה`,
      'present.fs': `${L}1:2Eית`,
      'present.mp': `${L}1:2iים`,
      'present.fp': `${L}1:2וoת`,
      ...future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1*A2eה`,
        vowelEnd: (p) => `${p}i1*A2`,
        literary: (p) => `${p}i1*A2eינAה`,
      }),
      'infinitive.inf': 'ל%הi1*A2וoת',
    };
  // Before a final ח/ע the stem tsere is patah: יֵרָגַע, לְהִשָּׁמַע.
  const v2 = root[2][0] === 'ח' || root[2][0] === 'ע' ? 'a' : 'E';
  // Past and present נִכְנַס, פ"ו/פ"י נוֹסַף; the future has ו for both: יִוָּסֵף, יִוָּלֵד.
  // Up to C2: נִכְ־נ, פ"נ נִ־תּ (נִתַּן), פ"ו/פ"י נוֹ־ס.
  const N = c1 === 'נ' ? 'נi2*' : c1 === 'ו' || c1 === 'י' ? 'נוo2' : 'נi1:2';
  return {
    ...past({ c: `${N}a3`, third: `${N}a3`, thirdV: `${N}%3` }),
    'present.ms': `${N}A3`,
    'present.fs': `${N}${segolate(root).slice(1)}`,
    'present.mp': `${N}A3iים`,
    'present.fp': `${N}A3וoת`,
    ...future({
      base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1*A2${v2}3`,
      vowelEnd: (p) => `${p}i1*A2%3`,
      literary: (p) => `${p}i1*A2E3:נAה`,
    }),
    'infinitive.inf': `ל%הi1*A2${v2}3`,
  };
}

function hitpael(root, f) {
  if (root[2][0] === 'ה')
    return {
      ...ls.past({ c: 'הiת:1a2*', v12: 'E' }),
      'present.ms': 'מiת:1a2*eה',
      'present.fs': 'מiת:1a2*Aה',
      'present.mp': 'מiת:1a2*iים',
      'present.fp': 'מiת:1a2*וoת',
      ...future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}ת:1a2*eה`,
        vowelEnd: (p) => `${p}iת:1a2*`,
        literary: (p) => `${p}iת:1a2*eינAה`,
      }),
      'infinitive.inf': 'ל%הiת:1a2*וoת',
    };
  // The stem 1-2: הִתְפַּעֵל, polel הִתְמוֹדֵד.
  const S = f.polel ? polelStem(root) : '1a2*';
  return {
    ...past({ c: `הiת:${S}a3`, third: `הiת:${S}E3`, thirdV: `הiת:${S}%3` }),
    'present.ms': `מiת:${S}E3`,
    'present.fs': `מiת:${S.slice(0, -2)}${segolate(root).replace('2', S.slice(-2))}`,
    'present.mp': `מiת:${S}%3iים`,
    'present.fp': `מiת:${S}%3וoת`,
    ...future({
      base: (p) => `${p}${p === 'א' ? 'e' : 'i'}ת:${S}E3`,
      vowelEnd: (p) => `${p}iת:${S}%3`,
      literary: (p) => `${p}iת:${S}E3:נAה`,
    }),
    'infinitive.inf': `ל%הiת:${S}E3`,
  };
}

/** הִתְצַעֵר -> הִצְטַעֵר: ת swaps with a sibilant C1 (ט after צ, ד after ז). */
function metathesis(segs) {
  for (let k = 0; k < segs.length - 1; k++) {
    const t = segs[k];
    const c = segs[k + 1];
    if (t.l !== 'ת' || t.root !== 0 || c.root !== 1 || !SIBILANTS.has(c.l)) continue;
    const swapped = c.l === 'צ' ? 'ט' : c.l === 'ז' ? 'ד' : 'ת';
    [t.l, t.dot, t.root, c.l, c.dot, c.root] = [c.l, c.dot, 1, swapped, undefined, 0];
    break;
  }
  return segs;
}

const BUILD = { paal, nifal, piel, pual, hifil, hufal, hitpael };

/** Root letters with an optional shin/sin dot or rafe: 'עשׂה' -> ['ע', 'שׂ', 'ה']; פֿ never takes a dagesh. */
export function splitRoot(root) {
  const letters = typeof root === 'string' ? root.match(/.[\u05C1\u05C2\u05BF]?/gu) : root;
  const plain = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
  return letters.map((r) => (r === 'ש' ? `ש${SHIN_DOT}` : (plain[r] ?? r)));
}

/**
 * @param {{ binyan: string, root: string | string[], flags?: Record<string, any> }} verb
 * @returns {Record<string, { defective: string, plain: string }>}
 */
export function conjugate({ binyan, root, flags = {} }) {
  const r = splitRoot(root).map((x) => [x[0], x[1]]);
  // Nifal פ"י is conjugated as פ"ו: נוֹלַד, יִוָּלֵד.
  if (binyan === 'nifal' && r[0][0] === 'י') r[0] = ['ו', undefined];
  const quad = r.length === 4;
  // A quadriliteral takes the triliteral patterns of C1 C2 C4 with the
  // doubled C2 split in two: דִּבֵּר -> שִׁחְרֵר (2* -> 2:3, 3 -> 4).
  const patterns = BUILD[binyan](quad ? [r[0], r[1], r[3]] : r, flags);
  if (quad) for (const k of Object.keys(patterns)) patterns[k] = patterns[k].replaceAll('3', '4').replaceAll('2*', '2:3');
  const opts = { ...flags, binyan, last: r.length, geminate: !quad && !flags.strong && r[1][0] === r[2][0] };
  for (const [k, v] of Object.entries(flags.override ?? {})) patterns[k] = v;
  const out = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    if (flags.noPresent && key.startsWith('present.')) continue;
    if (flags.omit?.some((tense) => key.startsWith(`${tense}.`))) continue;
    let segs = parse(pattern, r);
    if (binyan === 'hitpael') segs = metathesis(segs);
    segs = rules(segs, opts);
    out[key] = { defective: render(segs), plain: plene(segs, opts) };
  }
  return out;
}
export { SIN_DOT };
