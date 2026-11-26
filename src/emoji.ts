// Emoji pictures on devices whose font lacks an emoji (plan 1.4, decision
// 34): the app draws the emoji on a canvas to see whether the font has it,
// and only then loads the Twemoji copies (public/twemoji.json, one file).

/** Twemoji copies: file name (src/pictures.ts emojiFile) → SVG text. */
export type Twemoji = Record<string, string>;

export interface EmojiSupport {
  /** Whether the system font draws this single emoji as one colour glyph. */
  renders(emoji: string): boolean;
  /** The Twemoji copies, loaded once. */
  twemoji(): Promise<Twemoji>;
}

export function parseTwemoji(data: unknown): Twemoji {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('twemoji: not a record');
  const copies: Twemoji = {};
  for (const [name, svg] of Object.entries(data)) {
    if (typeof svg !== 'string' || !svg.startsWith('<svg')) throw new Error(`twemoji: ${name} is not an SVG`);
    copies[name] = svg;
  }
  return copies;
}

const SIZE = 32;
/** Pixels whose channels differ this much are coloured, not grey antialiasing. */
const COLOURED = 40;
const MIN_COLOURED_PIXELS = 8;

/**
 * Draws the emoji in black: a font that has it paints colours, a missing one
 * leaves a grey box or nothing. A sequence the font lacks (🧑‍🍳) falls apart
 * into its parts in colour, which the width shows. Browser only: jsdom has
 * no canvas, tests pass their own `renders`.
 */
export function canvasEmojiCheck(doc: Document): (emoji: string) => boolean {
  const canvas = doc.createElement('canvas');
  canvas.width = SIZE * 3;
  canvas.height = SIZE * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const known = new Map<string, boolean>();
  return (emoji) => {
    if (!ctx) return false;
    const cached = known.get(emoji);
    if (cached !== undefined) return cached;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${SIZE}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(emoji, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let coloured = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r = 0, g = 0, b = 0, a = 0] = data.subarray(i, i + 4);
      if (a > 0 && Math.max(r, g, b) - Math.min(r, g, b) > COLOURED) coloured++;
    }
    const result = coloured >= MIN_COLOURED_PIXELS && ctx.measureText(emoji).width < SIZE * 1.8;
    known.set(emoji, result);
    return result;
  };
}

/** The browser's emoji support: the canvas check and twemoji.json fetched next to the page. */
export function browserEmoji(doc: Document): EmojiSupport {
  let copies: Promise<Twemoji> | undefined;
  return {
    renders: canvasEmojiCheck(doc),
    twemoji: () => {
      copies ??= fetch('twemoji.json')
        .then((r) => r.json())
        .then(parseTwemoji)
        .catch((error: unknown) => {
          copies = undefined; // offline before the file was cached: try again next time
          throw error;
        });
      return copies;
    },
  };
}
