// Sets the picture entries of a batch in src/data/pictures.json from lines
// "<id> <what>" on stdin: what = an emoji or a pair of them (🧠💭), "svg"
// (the drawing public/pictures/<id>.svg must exist) or "none". An entry is
// replaced whole, its comment dropped. The review is "ok" (decided
// 2026-11-25: pictures are accepted without a review; the review page stays
// for a spot check), --review pending to ask for one. Then run
// scripts/fetch-emoji.mjs for the new emoji.
//
//   node scripts/set-pictures.mjs < batch.txt
//   printf 'הלך 🚶\nהיה none\n' | node scripts/set-pictures.mjs --review pending

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRAWINGS_DIR, parseBatch, PICTURES_FILE, readPictures, serializePictures } from './lib/pictures.mjs';

const at = process.argv.indexOf('--review');
const review = at > 0 ? process.argv[at + 1] : 'ok';
const verbs = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/data/verbs.json'), 'utf8'));
const batch = parseBatch(readFileSync(0, 'utf8'), review);
const missing = Object.entries(batch).filter(([id, e]) => e.kind === 'svg' && !existsSync(resolve(DRAWINGS_DIR, `${id}.svg`)));
if (missing.length) throw new Error(`no drawing for ${missing.map(([id]) => id).join(' ')}`);
const pictures = { ...readPictures(), ...batch };
writeFileSync(PICTURES_FILE, serializePictures(pictures, new Map(verbs.map((v) => [v.id, v.rank]))));
const counts = {};
for (const e of Object.values(pictures)) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
console.log(`set ${Object.keys(batch).length}; all ${Object.keys(pictures).length}:`, counts);
