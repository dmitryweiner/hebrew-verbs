// The real verb data for unit tests (node only: reads the file, never shipped).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseVerbs, type Verb } from './verbs';

export const verbs: readonly Verb[] = parseVerbs(JSON.parse(readFileSync(resolve(import.meta.dirname, 'data/verbs.json'), 'utf8')));

/** A verb of the data by id; throws for an unknown one, so a test fails loudly. */
export function verb(id: string): Verb {
  const found = verbs.find((v) => v.id === id);
  if (!found) throw new Error(`no verb ${id}`);
  return found;
}
