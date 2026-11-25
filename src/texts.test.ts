// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { texts } from './texts';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('texts', () => {
  it('are the ones index.html shows before the script runs', () => {
    expect(doc.documentElement.lang).toBe('ru');
    expect(doc.title).toBe(texts.title);
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(texts.description);
    expect(doc.querySelector('.brand')?.textContent).toBe(texts.title);
  });

  it('are all non-empty Russian strings', () => {
    const strings = (value: unknown, key: string): [string, unknown][] =>
      typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([k, v]) => strings(v, `${key}.${k}`)) : [[key, value]];
    for (const [key, text] of strings(texts, 'texts'))
      expect({ key, ok: typeof text === 'string' && /[а-яё]/i.test(text) }).toEqual({ key, ok: true });
  });
});
