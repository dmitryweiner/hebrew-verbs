import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTwemoji } from './emoji';

describe('twemoji copies', () => {
  it('read the file of the app', () => {
    const copies = parseTwemoji(JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/twemoji.json'), 'utf8')));
    expect(copies['1f9e0.svg']).toMatch(/^<svg /u);
  });

  it('reject anything but a record of SVG texts', () => {
    expect(() => parseTwemoji([])).toThrow('not a record');
    expect(() => parseTwemoji({ 'a.svg': 1 })).toThrow('a.svg is not an SVG');
  });
});
