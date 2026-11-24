// Transliteration of a conjugated form into Cyrillic, as Israelis speak
// (decision 16): no doubled consonants, a sheva sounded only where speech
// sounds it, the paal past 2nd plural as כָּתַבְתֶּם (катавтем), the hufal
// prefix as הוּ (хуавар). Works on the conjugator's segments, which know
// what the nikud alone does not: vocal or silent sheva, kamatz katan,
// vowel letters.
//
//   import { translit } from './lib/translit.mjs';
//   translit(segs, { key: 'past.3ms', binyan: 'piel' }); // -> 'дибер'
//
// Conventions of Russian textbooks: ח, כ, ה — х; ל before a consonant and at
// the end — ль (ахальтем, охель); е after a consonant, э elsewhere (шоэль);
// י before a vowel — я, е, йо, ю, йи (ь after a consonant: ихье); the
// infinitive ל before a guttural with a hyphen, as the plan writes it
// (ле-эхоль).

const SHIN_DOT = 'ׁ';
const RAFE = 'ֿ';
const CONSONANT = {
  ג: 'г',
  ד: 'д',
  ה: 'х',
  ו: 'в',
  ז: 'з',
  ח: 'х',
  ט: 'т',
  ל: 'л',
  מ: 'м',
  נ: 'н',
  ס: 'с',
  צ: 'ц',
  ק: 'к',
  ר: 'р',
  ת: 'т',
  ם: 'м',
  ן: 'н',
  ץ: 'ц',
};
const STOP = { ב: ['б', 'в'], כ: ['к', 'х'], ך: ['к', 'х'], פ: ['п', 'ф'], ף: ['п', 'ф'] };
const VOWEL = { a: 'a', A: 'a', '~a': 'a', e: 'e', E: 'e', '~e': 'e', i: 'i', o: 'o', Q: 'o', '~A': 'o', u: 'u', U: 'u' };
const CYR = { a: 'а', e: 'е', i: 'и', o: 'о', u: 'у' };
const IOTATED = { a: 'я', e: 'е', i: 'йи', o: 'йо', u: 'ю' };
const AFTER_SOFT = { a: 'я', e: 'е', o: 'о', u: 'ю' }; // ь + vowel: ихье, лихьот

const isSheva = (v) => v === ':' || v === '%';

/** A letter that only carries or marks a vowel: holam male, shuruk, a mater. */
function isVowelLetter(s, k, segs) {
  if (s.quiet) return true;
  // A letter before a holam or shuruk ו is its consonant: הוֹרִיד, הוּכַן.
  const beforeShuruk = segs[k + 1]?.l === 'ו' && 'oU'.includes(segs[k + 1].v) && segs[k + 1].root === 0;
  if (s.root === 0) return (s.l === 'ו' && (s.v === 'o' || s.v === 'U')) || (s.v === '' && 'ויאה'.includes(s.l) && !beforeShuruk);
  return s.v === '' && s.l === 'ה' && k === segs.length - 1;
}

/**
 * @param {{ l: string, dot?: string, v: string, forte?: boolean, lene?: boolean, root: number,
 *   quiet?: boolean, furtive?: boolean, medium?: boolean }[]} segs
 * @param {{ key: string, binyan: string }} ctx
 */
export function translit(segs, { key, binyan }) {
  /** @type {({ t: 'c', ch: string } | { t: 'j' } | { t: 'g' } | { t: 'v', ch: string } | { t: '-' })[]} */
  const toks = [];
  const sounded = []; // per segment: does its sheva sound
  segs.forEach((s, k) => {
    const p = segs[k - 1];
    const n = segs[k + 1];
    if (isVowelLetter(s, k, segs)) {
      if (s.v === 'o' || s.v === 'U') toks.push({ t: 'v', ch: VOWEL[s.v] });
      return;
    }
    if (s.furtive) toks.push({ t: 'v', ch: 'a' });
    if (s.l === 'א' || s.l === 'ע') toks.push({ t: 'g' });
    else if (s.l === 'י') toks.push({ t: 'j' });
    else if (s.l === 'ש') toks.push({ t: 'c', ch: s.dot === SHIN_DOT ? 'ш' : 'с' });
    else if (STOP[s.l]) toks.push({ t: 'c', ch: STOP[s.l][(s.forte || s.lene) && s.dot !== RAFE ? 0 : 1] });
    else toks.push({ t: 'c', ch: CONSONANT[s.l] ?? s.l });

    if (isSheva(s.v) && n) {
      let v = '';
      if (s.medium) v = n.l === s.l ? 'e' : '';
      else if (k === 0) v = s.root === 0 ? 'e' : binyan === 'paal' && /^past\.2[mf]p$/.test(key) ? 'a' : 'e';
      else if ((isSheva(p.v) && !sounded[k - 1] && !isVowelLetter(p, k - 1, segs)) || n.l === s.l) v = 'e';
      sounded[k] = Boolean(v);
      if (v) toks.push({ t: 'v', ch: v });
    } else if (VOWEL[s.v]) {
      // The hufal prefix as spoken: הָעֳבַר -> хуавар.
      const hufal = binyan === 'hufal' && (s.root === 0 ? s.v === 'Q' : s.v === '~A');
      toks.push({ t: 'v', ch: hufal ? (s.root === 0 ? 'u' : 'a') : VOWEL[s.v] });
    }
    if (key === 'infinitive.inf' && k === 0 && s.l === 'ל' && VOWEL[s.v] && (n?.l === 'א' || n?.l === 'ע') && VOWEL[n.v])
      toks.push({ t: '-' });
  });

  let out = '';
  toks.forEach((tok, i) => {
    const next = toks[i + 1];
    if (tok.t === 'c') out += tok.ch === 'л' && next?.t !== 'v' && next?.t !== 'j' ? 'ль' : tok.ch;
    else if (tok.t === '-') out += '-';
    else if (tok.t === 'j') {
      if (next?.t !== 'v') out += 'й';
    } else if (tok.t === 'v') {
      const prev = toks[i - 1];
      if (prev?.t === 'j') {
        const before = toks[i - 2];
        if (tok.ch === 'i') out += before?.t === 'c' ? 'ьи' : before ? 'йи' : 'и';
        else out += before?.t === 'c' ? `ь${AFTER_SOFT[tok.ch]}` : IOTATED[tok.ch];
      } else if (prev?.t === 'c') out += CYR[tok.ch];
      else out += tok.ch === 'e' ? 'э' : CYR[tok.ch];
    }
  });
  return out;
}
