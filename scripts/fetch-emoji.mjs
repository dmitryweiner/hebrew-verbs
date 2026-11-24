// Downloads the Twemoji SVG of every emoji in src/data/pictures.json into
// public/emoji/: the app shows it instead of an emoji the device's font
// lacks (old phones). Twemoji graphics are CC BY 4.0 (jdecked/twemoji).
// Files already there are kept. Rerun after adding emoji to pictures.json;
// src/data/pictures.test.ts fails while a copy is missing.
//
//   node scripts/fetch-emoji.mjs

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emojiFile } from '../src/pictures.ts';
import { readPictures } from './lib/pictures.mjs';

const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';
const OUT = resolve(import.meta.dirname, '../public/emoji');

const codePoints = (emoji) => [...emoji].map((ch) => ch.codePointAt(0).toString(16));

mkdirSync(OUT, { recursive: true });
const emoji = [...new Set(Object.values(readPictures()).flatMap((e) => (e.kind === 'emoji' ? [e.emoji] : [])))];
let failed = 0;
for (const e of emoji) {
  const target = resolve(OUT, emojiFile(e));
  if (existsSync(target)) continue;
  // Twemoji keeps ZWJ sequences with FE0F, single emoji without.
  const candidates = [emojiFile(e), `${codePoints(e).join('-')}.svg`];
  let svg;
  for (const name of candidates) {
    const res = await fetch(BASE + name);
    if (res.ok) {
      svg = await res.text();
      break;
    }
  }
  if (svg) {
    writeFileSync(target, svg);
    console.log('ok  ', e, emojiFile(e));
  } else {
    failed++;
    console.error('FAIL', e, candidates.join(' / '));
  }
}
process.exit(failed ? 1 : 0);
