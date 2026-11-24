// Verb illustrations (src/data/pictures.json, plan 1.4): an emoji, an own
// drawing in public/pictures/<id>.svg, or an explicit "no picture" for an
// abstract verb. Each entry carries a person's review; the app shows only
// approved ones.

export type Review = 'pending' | 'ok' | 'redo';
export const REVIEWS: readonly Review[] = ['pending', 'ok', 'redo'];

export type PictureEntry = ({ kind: 'emoji'; emoji: string } | { kind: 'svg' } | { kind: 'none' }) & {
  review: Review;
  comment?: string;
};

/** Entries by verb id. */
export type Pictures = Record<string, PictureEntry>;

/** What the app shows: an emoji with its Twemoji copy for devices without it, or a drawing. */
export type Picture = { kind: 'emoji'; emoji: string; fallback: string } | { kind: 'svg'; src: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isReview = (value: unknown): value is Review => REVIEWS.some((r) => r === value);

function toEntry(value: unknown): PictureEntry | undefined {
  if (!isRecord(value) || !isReview(value.review)) return undefined;
  const { kind, emoji, review, comment } = value;
  if (comment !== undefined && !isString(comment)) return undefined;
  const note = comment === undefined ? {} : { comment };
  if (kind === 'emoji' && isString(emoji)) return { kind, emoji, review, ...note };
  if ((kind === 'svg' || kind === 'none') && emoji === undefined) return { kind, review, ...note };
  return undefined;
}

/** The pictures from parsed JSON; throws naming the first verb whose entry has a wrong shape. */
export function parsePictures(data: unknown): Pictures {
  if (!isRecord(data)) throw new Error('pictures: not a record');
  const pictures: Pictures = {};
  for (const [id, value] of Object.entries(data)) {
    const entry = toEntry(value);
    if (!entry) throw new Error(`pictures: ${id} has a wrong shape`);
    pictures[id] = entry;
  }
  return pictures;
}

/** The Twemoji file name: code points in hex without the variation selector FE0F. */
export function emojiFile(emoji: string): string {
  // oxlint-disable-next-line typescript/no-misused-spread -- code points are wanted: Twemoji names its files by them
  const points = [...emoji].map((ch) => ch.codePointAt(0)?.toString(16) ?? '').filter((cp) => cp !== 'fe0f');
  return `${points.join('-')}.svg`;
}

/** The approved picture of a verb, if it has one; paths are relative to the page. */
export function pictureOf(pictures: Pictures, id: string): Picture | undefined {
  const entry = pictures[id];
  if (!entry || entry.review !== 'ok') return undefined;
  if (entry.kind === 'emoji') return { kind: 'emoji', emoji: entry.emoji, fallback: `emoji/${emojiFile(entry.emoji)}` };
  if (entry.kind === 'svg') return { kind: 'svg', src: `pictures/${id}.svg` };
  return undefined;
}
