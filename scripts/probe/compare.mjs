// Compares the sources of verb forms slot by slot — Wiktionary vs Hspell
// (plain spelling) and, with --conjugator, the own conjugator vs the
// expected forms (Wiktionary nikud, Hspell spelling, the plan's decisions:
// `expectedForms` in sources.mjs).
//
//   node scripts/probe/compare.mjs [--conjugator] [--verbose] [--sample scripts/probe/holdout-50.tsv]
//   node scripts/probe/compare.mjs --conjugator --top 1000 [--summary]
//
// --sample: a hand-made list (lemma, binyan, root, flags). --top N: the N
// most frequent lemmas of .cache/verb-frequency.json, binyan, root and flags
// from their Wiktionary parameters (scripts/lib/wiktionary-flags.mjs);
// lemmas without a Wiktionary table, or with only a loose match, are listed
// and skipped. --summary
// prints only the verbs that differ, one line each.
//
// Needs .cache/wiktionary.json (scripts/probe/wiktionary.mjs) and
// .cache/dl/woo-forms.txt (scripts/fetch-sources.sh).
// Writes .cache/compare-<sample | top-N>.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fromWiktionary } from '../lib/wiktionary-flags.mjs';
import { readSample } from './sample.mjs';
import { expectedForms, hspellBlock, loadHspell, loadWiktionary, slotKeys, wiktionarySlots } from './sources.mjs';

const { values: args } = parseArgs({
  options: {
    conjugator: { type: 'boolean' },
    verbose: { type: 'boolean' },
    summary: { type: 'boolean' },
    sample: { type: 'string' },
    top: { type: 'string' },
  },
});
const conjugate = args.conjugator ? (await import('../lib/conjugate.mjs')).conjugate : null;

const root = resolve(import.meta.dirname, '../..');
const hspell = loadHspell();
const wikt = loadWiktionary();
const keys = slotKeys();

/** The N most frequent lemmas, as sample entries from their Wiktionary parameters. */
function topSample(n) {
  const ranked = JSON.parse(readFileSync(resolve(root, '.cache/verb-frequency.json'), 'utf8'));
  const lemmas = [...new Set(ranked.map((v) => v.lemma))].slice(0, n);
  return lemmas.map((lemma, i) => {
    const entry = wikt[lemma];
    if (entry?.loose) return { lemma, rank: i + 1, binyan: '?', missing: `loose match: ${entry.title}` };
    let mapped = null;
    try {
      mapped = entry ? fromWiktionary(entry.params) : null;
    } catch (error) {
      return { lemma, rank: i + 1, binyan: '?', missing: `parameters: ${error.message}` };
    }
    if (!mapped) return { lemma, rank: i + 1, binyan: '?', missing: entry ? 'manual table' : 'no wiktionary' };
    return Object.assign(mapped, { lemma, rank: i + 1 });
  });
}

const sample = args.top ? topSample(Number(args.top)) : readSample(args.sample);
const name = args.top ? `top-${args.top}` : basename(args.sample ?? 'sample-50.tsv', '.tsv');

const stats = {
  verbs: sample.length,
  wiktionary: 0,
  hspell: 0,
  wiktVsHspell: { slots: 0, differ: 0, verbs: 0 },
  conj: { nikud: 0, plain: 0, slots: 0, verbsExact: 0, verbsCompared: 0 },
};
const report = [];

for (const verb of sample) {
  /** @type {{ lemma: string, binyan: string, rank?: number, missing?: string, notes?: string[], wiktVsHspell: string[], conj: string[] }} */
  const entry = { lemma: verb.lemma, binyan: verb.binyan, rank: verb.rank, wiktVsHspell: [], conj: [] };
  if (verb.notes?.length) entry.notes = verb.notes;
  if (verb.missing) {
    entry.missing = verb.missing;
    report.push(entry);
    if (!args.summary) console.log(`${verb.lemma} [${verb.missing}]`);
    continue;
  }
  const w = wiktionarySlots(wikt[verb.lemma]);
  const h = hspellBlock(hspell, verb.lemma, w);
  if (w) stats.wiktionary++;
  if (h) stats.hspell++;

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

  if (conjugate && w && !verb.flags?.manual) {
    stats.conj.verbsCompared++;
    let c = {};
    try {
      c = conjugate(verb);
    } catch (error) {
      entry.conj.push(`error: ${error.message}`);
    }
    const expected = expectedForms(verb, w, h);
    for (const [k, e] of Object.entries(expected)) {
      const mine = c[k];
      stats.conj.slots++;
      if (!mine || !e.nikud.includes(mine.defective)) {
        stats.conj.nikud++;
        entry.conj.push(`${k}: nikud ${mine?.defective ?? '—'} ≠ ${e.nikud.join(' / ')}`);
      }
      if (!mine || !e.plain.includes(mine.plain)) {
        stats.conj.plain++;
        entry.conj.push(`${k}: plain ${mine?.plain ?? '—'} ≠ ${e.plain.join(' / ')}`);
      }
    }
    for (const k of Object.keys(c)) if (!expected[k] && args.verbose) entry.conj.push(`${k}: ${c[k].defective} (no reference)`);
    if (entry.conj.length === 0) stats.conj.verbsExact++;
  }

  report.push(entry);
  const head = `${verb.rank ? `${verb.rank}. ` : ''}${verb.lemma} (${verb.binyan} ${verb.root ?? ''})`;
  if (args.summary) {
    if (entry.conj.length) console.log(`${head}: ${entry.conj.length} differences, ${entry.conj[0]}`);
    continue;
  }
  const lines = [...entry.wiktVsHspell.map((l) => `  W≠H ${l}`), ...entry.conj.map((l) => `  C ${l}`)];
  console.log(`${head}${w ? '' : ' [no wiktionary]'}${h ? '' : ' [no hspell]'}`);
  for (const l of lines) console.log(l);
}

console.log('\n' + JSON.stringify(stats, null, 1));
writeFileSync(resolve(root, `.cache/compare-${name}.json`), JSON.stringify({ stats, report }, null, 1));
