// Model conjugator for Hebrew verbs: root + binyan (+ a few lexical flags)
// -> present, past, future and infinitive, each as defective (classical)
// nikud and as plene spelling without nikud (the Academy's ktiv male).
//
// A form is built from a pattern string over the root, then rewritten by
// phonological rules (gutturals, weak letters, assimilation, dagesh) and
// rendered. Stage 0 prototype: covers the classes of the 50-verb sample.
//
//   import { conjugate } from './lib/conjugate.mjs';
//   conjugate({ binyan: 'paal', root: ['א','כ','ל'], flags: { peAlef: true } })
//   // -> { 'past.1s': { defective: 'אָכַלְתִּי', plain: 'אכלתי' }, ... }
//
// Pattern notation: 1 2 3 = root letters; a Hebrew letter = itself; after a
// letter: '*' dagesh forte, then a vowel — ':' silent sheva, '%' vocal sheva,
// a patah, A kamatz, e segol, E tsere, i hiriq, o holam, u kubutz,
// U shuruk (on ו), ~a ~e ~A hataf. ו/י/א/ה without a vowel are vowel letters.
//
// Flags (lexical facts the root and binyan do not give; most are the same as
// Wiktionary's {{he-conj}} parameters, in brackets):
//   peAlef         paal פ"א with a quiet א: יֹאכַל, אֹמַר (elide)
//   peYod          paal future and infinitive as פ"י: הלך → יֵלֵךְ, לָלֶכֶת
//   assim          paal future with C1 assimilated: לקח → יִקַּח (assim)
//   assimT         C3 נ assimilates to the suffix ת: נָתַתִּי (assim_t)
//   futureVowel    paal future stem vowel: 'o' | 'a' | 'E' (fut_char);
//                  hollow verbs: 'o' (יָבוֹא), default u (יָמוּת)
//   pastVowel      hollow paal past/present vowel: 'E' (מֵת) (past_char)
//   noChataf       guttural C1 keeps a silent sheva: יַחְשֹׁב (nochataf)
//   keepPrefix     no guttural change of the prefix: יִהְיֶה
//   hatafSegol     a word-initial guttural takes hataf segol: הֱיִיתֶם
//   noPresent      no present tense (היה)
//   segolateInfinitive  לָקַחַת-type infinitive
//   hollow         treat as ע"ו/ע"י even if C2 is not ו/י
//   override       { 'infinitive.inf': pattern, ... } for single forms (inf)
// Not covered yet (stage 0 report, section 4): pual, hufal, geminates,
// quadriliterals, hitpael ל"ה, stative paal, ע"י future (יָשִׂים), פ"י with
// a kept yod (יִירֶה), ל"א outside paal, nifal with a guttural C1/C3.

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
  o: '\u05B9',
  u: '\u05BB',
};
const DAGESH = '\u05BC';
const SHIN_DOT = '\u05C1';
const SIN_DOT = '\u05C2';
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
    if (ch >= '1' && ch <= '3') {
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
    } else if (pattern[i] && /[:%aAeEiouU]/.test(pattern[i])) seg.v = pattern[i++];
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
    if (a.root !== 3 || b.root !== 0 || !(a.v === ':' || a.v === '')) continue;
    if (a.l === b.l || (opts.assimT && a.l === 'נ' && b.l === 'ת')) {
      b.forte = true;
      segs.splice(k, 1);
    }
  }
  // Gutturals and ר take no dagesh forte; before them hiriq -> tsere (piel).
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (!s.forte || s.root === 0 || !NO_DOUBLING.has(s.l)) continue;
    s.forte = false;
    const prev = segs[k - 1];
    if (prev && prev.v === 'i' && 'אער'.includes(s.l)) prev.v = 'E';
  }
  // Prefix + guttural first root letter with silent sheva: יִעְבֹד -> יַעֲבֹד.
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    const p = segs[k - 1];
    if (s.root !== 1 || s.v !== ':' || !GUTTURALS.has(s.l) || p.root !== 0) continue;
    if (opts.keepPrefix) continue;
    if (opts.noChataf) {
      if (p.v === 'i') p.v = 'a';
      continue;
    }
    if (p.v === 'e' || s.l === 'א' || opts.binyan === 'nifal' || opts.binyan === 'hifil') {
      p.v = 'e';
      s.v = '~e';
    } else if (p.v === 'i' || p.v === 'a') {
      p.v = 'a';
      s.v = '~a';
    }
  }
  // Vocal sheva on a guttural -> hataf, in harmony with the vowel before.
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (s.v !== '%' || !GUTTURALS.has(s.l)) continue;
    s.v = segs[k - 1]?.v === 'e' || (k === 0 && opts.hatafSegol) ? '~e' : '~a';
  }
  // Hataf before a vocal sheva becomes a full vowel: תַּעֲבְדִי -> תַּעַבְדִי.
  for (let k = 0; k < segs.length - 1; k++) {
    const s = segs[k];
    const n = segs[k + 1];
    if (s.v.startsWith('~') && n.v === '%') {
      s.v = s.v[1];
      n.v = ':';
      n.medium = true;
    }
  }
  // Quiescent א (ל"א, ע"ו+א): מָצַאתִי -> מָצָאתִי, יִמְצַא -> יִמְצָא.
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    if (s.l !== 'א' || s.root !== 3) continue;
    const last = k === segs.length - 1;
    if (s.v === ':' || (s.v === '' && last)) {
      s.v = '';
      s.quiet = true;
      const p = segs[k - 1];
      if (p.v === 'a') p.v = 'A';
    }
  }
  // Tsere/hiriq/holam before a closing ח/ע: תַּגֵּעְנָה -> תַּגַּעְנָה.
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    if (s.root !== 3 || (s.l !== 'ח' && s.l !== 'ע') || s.v !== ':') continue;
    const p = segs[k - 1];
    if (p.v === 'E' || p.v === 'o') p.v = 'a';
  }
  // Dagesh lene: בגדכפת at the start or after a silent sheva.
  segs.forEach((s, k) => {
    if (!BEGEDKEFET.has(s.l) || s.forte) return;
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
    if (s.dot) l += s.dot;
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
    if (s.l === 'י' && s.root !== 0 && k > 0 && !isLast && consonantal) {
      // Not next to a vowel letter (הָיָה -> היה, הָיוּ -> היו), not after a silent sheva.
      const nearMater = (n && isVowelLetter(n)) || (p && isVowelLetter(p));
      if (!nearMater && p.v !== ':' && s.v !== 'i') l = 'יי';
    }
    out += l;
    if (s.v === 'o' && !(s.l === 'ו' && s.root === 0)) {
      const quietAlef = n && n.l === 'א' && n.v === '' && n.root === 1;
      if (!quietAlef) out += 'ו';
    }
    if (s.v === 'u') out += 'ו';
    if (s.v === 'i' && n) {
      const closed = n.v === ':' && !n.forte && !n.medium;
      const hasMater = n.l === 'י' && isVowelLetter(n);
      const hifilPrefix = opts.binyan === 'hifil' && k === 0 && s.l === 'ה';
      if (!closed && !hasMater && !hifilPrefix && !(n.l === 'י' && n.root !== 0 && isVowelLetter(n))) out += 'י';
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
    'past.1s': `${s.c}iיתiי`,
    'past.2ms': `${s.c}iיתA`,
    'past.2fs': `${s.c}iית`,
    'past.3ms': `${s.c}${s.v3 ?? 'A'}ה`,
    'past.3fs': `${s.c}%תAה`,
    'past.1p': `${s.c}iינוU`,
    'past.2mp': `${s.pl2 ?? s.c}iיתeם`,
    'past.2fp': `${s.pl2 ?? s.c}iיתeן`,
    'past.3p': `${s.c}וU`,
  }),
};

/** Segolate tail on C2 C3 (+ת): אוֹכֶלֶת, שׁוֹמַעַת, מוֹצֵאת. */
function segolate(root) {
  const c3 = root[2][0];
  if (c3 === 'א') return '2E3ת';
  if (c3 === 'ח' || c3 === 'ע') return '2a3aת';
  return '2e3eת';
}

const guttural = (c) => GUTTURALS.has(c);

function paal(root, f) {
  const [c1, c2, c3] = root.map((r) => r[0]);
  const P = {};
  if (c3 === 'ה') {
    Object.assign(P, ls.past({ c: '1A2', pl2: '1%2' }), {
      'present.ms': '1וo2eה',
      'present.fs': '1וo2Aה',
      'present.mp': '1וo2iים',
      'present.fp': '1וo2וoת',
      ...future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1:2eה`,
        vowelEnd: (p) => `${p}i1:2`,
        literary: (p) => `${p}i1:2eינAה`,
      }),
      'infinitive.inf': 'לi1:2וoת',
    });
    return P;
  }
  if (f.hollow || c2 === 'ו' || c2 === 'י') {
    const pv = f.pastVowel ?? 'A';
    const fv = f.futureVowel === 'o' ? 'וo' : 'וU';
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
      ...future({ base: (p) => `${p}A1${fv}3`, vowelEnd: (p) => `${p}A1${fv}3`, literary: (p) => `${p}A1o3:נAה` }),
      'infinitive.inf': `לA1${fv}3`,
    });
    return P;
  }
  Object.assign(P, past({ c: '1A2a3', third: '1A2a3', thirdV: '1A2%3', pl2: '1%2a3' }), {
    'present.ms': '1וo2E3',
    'present.fs': `1וo${segolate(root)}`,
    'present.mp': '1וo2%3iים',
    'present.fp': '1וo2%3וoת',
    'infinitive.inf': 'לi1:2o3',
  });
  let fv = f.futureVowel ?? (guttural(c2) || guttural(c3) || f.peAlef ? 'a' : 'o');
  if (f.peAlef) {
    Object.assign(
      P,
      future({
        base: (p) => (p === 'א' ? `אo2${fv}3` : `${p}o12${fv}3`),
        vowelEnd: (p) => (p === 'א' ? `אo2%3` : `${p}o12%3`),
        literary: (p) => `${p}o12${fv}3:נAה`,
      }),
    );
  } else if (c1 === 'י' || f.peYod) {
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
  } else if ((c1 === 'נ' && !guttural(c2)) || f.assim) {
    Object.assign(
      P,
      future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}2*${fv}3`,
        vowelEnd: (p) => `${p}i2*%3`,
        literary: (p) => `${p}i2*${fv}3:נAה`,
      }),
    );
  } else {
    Object.assign(
      P,
      future({
        base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1:2${fv}3`,
        vowelEnd: (p) => `${p}i1:2%3`,
        literary: (p) => `${p}i1:2${c3 === 'א' ? 'e' : fv}3:נAה`,
      }),
    );
  }
  if (f.segolateInfinitive) P['infinitive.inf'] = `לA${segolate(root)}`;
  return P;
}

function piel(root) {
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
  return {
    ...past({ c: '1i2*a3', third: '1i2*E3', thirdV: '1i2*%3' }),
    'present.ms': 'מ%1a2*E3',
    'present.fs': `מ%1a${segolate(root).replace('2', '2*')}`,
    'present.mp': 'מ%1a2*%3iים',
    'present.fp': 'מ%1a2*%3וoת',
    ...future({ base: (p) => `${p}%1a2*E3`, vowelEnd: (p) => `${p}%1a2*%3`, literary: (p) => `${p}%1a2*E3:נAה` }),
    'infinitive.inf': 'ל%1a2*E3',
  };
}

function hifil(root) {
  const [c1, c2, c3] = root.map((r) => r[0]);
  if (c2 === 'ו' || c2 === 'י')
    return {
      ...past({ c: 'הE1a3', third: 'הE1iי3', thirdV: 'הE1iי3', pl2: 'ה%1a3' }),
      'present.ms': 'מE1iי3',
      'present.fs': 'מ%1iי3Aה',
      'present.mp': 'מ%1iי3iים',
      'present.fp': 'מ%1iי3וoת',
      ...future({ base: (p) => `${p}A1iי3`, vowelEnd: (p) => `${p}A1iי3`, literary: (p) => `${p}A1E3:נAה` }),
      'infinitive.inf': 'ל%הA1iי3',
    };
  // The stem up to C2: strong הִפְ־ס, פ"נ הִ־גּ, פ"י/ו הוֹ־ד.
  const stem = (pre, v) => (c1 === 'נ' ? `${pre}${v}2*` : c1 === 'י' || c1 === 'ו' ? `${pre}וo2` : `${pre}${v}1:2`);
  if (c3 === 'ה')
    return {
      'past.1s': `${stem('ה', 'i')}Eיתiי`,
      'past.2ms': `${stem('ה', 'i')}EיתA`,
      'past.2fs': `${stem('ה', 'i')}Eית`,
      'past.3ms': `${stem('ה', 'i')}Aה`,
      'past.3fs': `${stem('ה', 'i')}%תAה`,
      'past.1p': `${stem('ה', 'i')}EינוU`,
      'past.2mp': `${stem('ה', 'i')}Eיתeם`,
      'past.2fp': `${stem('ה', 'i')}Eיתeן`,
      'past.3p': `${stem('ה', 'i')}וU`,
      'present.ms': `${stem('מ', 'a')}eה`,
      'present.fs': `${stem('מ', 'a')}Aה`,
      'present.mp': `${stem('מ', 'a')}iים`,
      'present.fp': `${stem('מ', 'a')}וoת`,
      ...future({ base: (p) => `${stem(p, 'a')}eה`, vowelEnd: (p) => stem(p, 'a'), literary: (p) => `${stem(p, 'a')}eינAה` }),
      'infinitive.inf': `ל%${stem('ה', 'a')}וoת`,
    };
  return {
    ...past({ c: `${stem('ה', 'i')}a3`, third: `${stem('ה', 'i')}iי3`, thirdV: `${stem('ה', 'i')}iי3` }),
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

function nifal(root) {
  return {
    ...past({ c: 'נi1:2a3', third: 'נi1:2a3', thirdV: 'נi1:2%3' }),
    'present.ms': 'נi1:2A3',
    'present.fs': `נi1:${segolate(root)}`,
    'present.mp': 'נi1:2A3iים',
    'present.fp': 'נi1:2A3וoת',
    ...future({
      base: (p) => `${p}${p === 'א' ? 'e' : 'i'}1*A2E3`,
      vowelEnd: (p) => `${p}i1*A2%3`,
      literary: (p) => `${p}i1*A2E3:נAה`,
    }),
    'infinitive.inf': 'ל%הi1*A2E3',
  };
}

function hitpael(root) {
  return {
    ...past({ c: 'הiת:1a2*a3', third: 'הiת:1a2*E3', thirdV: 'הiת:1a2*%3' }),
    'present.ms': 'מiת:1a2*E3',
    'present.fs': `מiת:1a${segolate(root).replace('2', '2*')}`,
    'present.mp': 'מiת:1a2*%3iים',
    'present.fp': 'מiת:1a2*%3וoת',
    ...future({
      base: (p) => `${p}${p === 'א' ? 'e' : 'i'}ת:1a2*E3`,
      vowelEnd: (p) => `${p}iת:1a2*%3`,
      literary: (p) => `${p}iת:1a2*E3:נAה`,
    }),
    'infinitive.inf': 'ל%הiת:1a2*E3',
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

const BUILD = { paal, piel, hifil, nifal, hitpael };

/** Root letters with an optional shin/sin dot: 'עשׂה' -> ['ע', 'שׂ', 'ה']. */
export function splitRoot(root) {
  const letters = typeof root === 'string' ? root.match(/.[\u05C1\u05C2]?/gu) : root;
  const plain = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
  return letters.map((r) => (r === 'ש' ? `ש${SHIN_DOT}` : (plain[r] ?? r)));
}

/**
 * @param {{ binyan: string, root: string | string[], flags?: Record<string, any> }} verb
 * @returns {Record<string, { defective: string, plain: string }>}
 */
export function conjugate({ binyan, root, flags = {} }) {
  const r = splitRoot(root).map((x) => [x[0], x[1]]);
  const patterns = BUILD[binyan](r, flags);
  for (const [k, v] of Object.entries(flags.override ?? {})) patterns[k] = v;
  const out = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    if (flags.noPresent && key.startsWith('present.')) continue;
    let segs = parse(pattern, r);
    if (binyan === 'hitpael') segs = metathesis(segs);
    segs = rules(segs, { ...flags, binyan });
    out[key] = { defective: render(segs), plain: plene(segs, { ...flags, binyan }) };
  }
  return out;
}
export { SIN_DOT };
