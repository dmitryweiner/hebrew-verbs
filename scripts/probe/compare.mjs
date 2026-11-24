// Stage 0 probe: compares the sources of verb forms slot by slot on the
// sample verbs — Wiktionary vs Hspell (plain spelling) and, with
// --conjugator, the own conjugator vs both (plain and nikud).
//
//   node scripts/probe/compare.mjs [--conjugator] [--verbose] [--sample scripts/probe/holdout-50.tsv]
//
// Needs .cache/wiktionary.json (scripts/probe/wiktionary.mjs) and
// .cache/dl/woo-forms.txt (see scripts/verb-frequency.mjs).
// Prints per-verb differences and a summary; writes .cache/compare-<sample>.json.

import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readSample } from './sample.mjs';
import { loadHspell, loadWiktionary, slotKeys, wiktionarySlots } from './sources.mjs';

const { values: args } = parseArgs({
  options: { conjugator: { type: 'boolean' }, verbose: { type: 'boolean' }, sample: { type: 'string' } },
});
const conjugate = args.conjugator ? (await import('../lib/conjugate.mjs')).conjugate : null;

const sample = readSample(args.sample);
const hspell = loadHspell();
const wikt = loadWiktionary();
const keys = slotKeys();

/** The Hspell block of this verb: the one agreeing most with Wiktionary. */
function hspellBlock(lemma, w) {
  const blocks = hspell.get(lemma) ?? [];
  const score = (b) => keys.filter((k) => w?.[k]?.some((f) => b[k]?.includes(f.plain))).length;
  return blocks.toSorted((a, b) => score(b) - score(a))[0] ?? null;
}

const stats = {
  verbs: sample.length,
  wiktionary: 0,
  hspell: 0,
  wiktVsHspell: { slots: 0, differ: 0, verbs: 0 },
  conj: { plainVsWikt: 0, nikudVsWikt: 0, plainVsHspell: 0, slotsWikt: 0, slotsHspell: 0, verbsExact: 0 },
};
const report = [];

for (const verb of sample) {
  const w = wiktionarySlots(wikt[verb.lemma]);
  const h = hspellBlock(verb.lemma, w);
  if (w) stats.wiktionary++;
  if (h) stats.hspell++;
  /** @type {{ lemma: string, binyan: string, wiktVsHspell: string[], conj: string[] }} */
  const entry = { lemma: verb.lemma, binyan: verb.binyan, wiktVsHspell: [], conj: [] };

  if (w && h) {
    let differ = false;
    for (const k of keys) {
      if (!w[k] || !h[k]) continue;
      stats.wiktVsHspell.slots++;
      const wp = w[k].map((f) => f.plain);
      if (!wp.some((p) => h[k].includes(p))) {
        stats.wiktVsHspell.differ++;
        differ = true;
        entry.wiktVsHspell.push(`${k}: wikt ${wp.join('/')} ≠ hspell ${h[k].join('/')}`);
      }
    }
    if (differ) stats.wiktVsHspell.verbs++;
  }

  if (conjugate) {
    const c = verb.flags.manual ? {} : conjugate(verb);
    let exact = Boolean(w);
    for (const k of keys) {
      const mine = c[k];
      if (w?.[k]) {
        stats.conj.slotsWikt++;
        const wn = w[k].map((f) => f.nikud);
        const wp = w[k].map((f) => f.plain);
        if (!mine || !wn.some((n) => n.normalize('NFC') === mine.defective.normalize('NFC'))) {
          stats.conj.nikudVsWikt++;
          exact = false;
          entry.conj.push(`${k}: nikud ${mine?.defective ?? '—'} ≠ wikt ${wn.join(' / ')}`);
        }
        if (!mine || !wp.includes(mine.plain)) {
          stats.conj.plainVsWikt++;
          entry.conj.push(`${k}: plain ${mine?.plain ?? '—'} ≠ wikt ${wp.join(' / ')}`);
        }
      }
      if (h?.[k]) {
        stats.conj.slotsHspell++;
        if (!mine || !h[k].includes(mine.plain)) {
          stats.conj.plainVsHspell++;
          entry.conj.push(`${k}: plain ${mine?.plain ?? '—'} ≠ hspell ${h[k].join(' / ')}`);
        }
      }
      if (!w && mine && args.verbose) entry.conj.push(`${k}: ${mine.defective} (no reference)`);
    }
    if (exact) stats.conj.verbsExact++;
  }

  report.push(entry);
  const lines = [...entry.wiktVsHspell.map((l) => `  W≠H ${l}`), ...entry.conj.map((l) => `  C ${l}`)];
  console.log(`${verb.lemma} (${verb.binyan})${w ? '' : ' [no wiktionary]'}${h ? '' : ' [no hspell]'}`);
  for (const l of lines) console.log(l);
}

console.log('\n' + JSON.stringify(stats, null, 1));
writeFileSync(
  resolve(import.meta.dirname, `../../.cache/compare-${basename(args.sample ?? 'sample-50.tsv', '.tsv')}.json`),
  JSON.stringify({ stats, report }, null, 1),
);
