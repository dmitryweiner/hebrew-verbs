// Keeps public/twemoji.json — the Twemoji SVG of every emoji (each of a pair)
// in src/data/pictures.json, one file (Twemoji file name → SVG), precached
// by the service worker: the app shows a copy instead of an emoji the
// device's font lacks (old phones). Twemoji graphics are CC BY 4.0
// (jdecked/twemoji). Downloads the missing copies, drops the ones no entry
// uses any more. Rerun after changing emoji in pictures.json;
// src/data/pictures.test.ts fails while the file is not up to date.
//
//   node scripts/fetch-emoji.mjs

import { existsSync, writeFileSync } from 'node:fs';
import { emojiFile, emojiParts } from '../src/pictures.ts';
import { readPictures, readTwemoji, serializeTwemoji, TWEMOJI_FILE } from './lib/pictures.mjs';

const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';

const codePoints = (emoji) => [...emoji].map((ch) => ch.codePointAt(0).toString(16));

const old = existsSync(TWEMOJI_FILE) ? readTwemoji() : {};
const emoji = [...new Set(Object.values(readPictures()).flatMap((e) => (e.kind === 'emoji' ? emojiParts(e.emoji) : [])))];
const copies = {};
let failed = 0;
for (const e of emoji) {
  const name = emojiFile(e);
  if (old[name]) {
    copies[name] = old[name];
    continue;
  }
  // Twemoji keeps ZWJ sequences with FE0F, single emoji without.
  const candidates = [name, `${codePoints(e).join('-')}.svg`];
  for (const file of candidates) {
    const res = await fetch(BASE + file);
    if (res.ok) {
      copies[name] = (await res.text()).trim();
      break;
    }
  }
  if (copies[name]) console.log('ok  ', e, name);
  else {
    failed++;
    console.error('FAIL', e, candidates.join(' / '));
  }
}
for (const name of Object.keys(old).filter((n) => !copies[n])) console.log('del ', name);
writeFileSync(TWEMOJI_FILE, serializeTwemoji(copies));
console.log(`${Object.keys(copies).length} copies`);
process.exit(failed ? 1 : 0);
