// Hebrew text helpers: nikud, final letters, typed input.

/** Points, dagesh, shin dots and cantillation; not the maqaf (U+05BE) and other punctuation. */
const MARKS = /[֑-ׇֽֿׁׂׅׄ]/gu;
const DIRECTION_MARKS = /[‎‏؜‪-‮⁦-⁩]/gu;
const REGULAR: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** The letters without nikud: the defective spelling of a pointed word (לֶאֱכֹל → לאכל), not the plene one. */
export function stripNikud(text: string): string {
  return text.replace(MARKS, '');
}

/** Final letters as regular ones, so that a word compares letter by letter. */
export function regularLetters(text: string): string {
  return text.replace(/[ךםןףץ]/gu, (ch) => REGULAR[ch] ?? ch);
}

/** Typed Hebrew as letters only: presentation forms decomposed, nikud and direction marks dropped, spaces collapsed. */
export function normalizeInput(text: string): string {
  return stripNikud(text.normalize('NFKD')).replace(DIRECTION_MARKS, '').trim().replace(/\s+/gu, ' ');
}
