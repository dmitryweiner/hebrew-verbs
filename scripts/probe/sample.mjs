// Reads a sample list (TSV: lemma, binyan, root, flags as JSON; # comments)
// for the probe scripts. Default: scripts/probe/sample-50.tsv.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readSample(file = resolve(import.meta.dirname, 'sample-50.tsv')) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const [lemma, binyan, root, flags] = l.split('\t');
      return { lemma, binyan, root, flags: flags ? JSON.parse(flags) : {} };
    });
}
