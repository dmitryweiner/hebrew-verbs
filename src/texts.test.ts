// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fill, texts } from './texts';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('texts', () => {
  it('are the ones index.html shows before the script runs', () => {
    expect(doc.documentElement.lang).toBe('ru');
    expect(doc.title).toBe(texts.title);
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(texts.description);
    expect(doc.querySelector('.brand')?.textContent).toBe(texts.title);
    expect(doc.querySelector('.settings-link')?.getAttribute('aria-label')).toBe(texts.settingsLink);
    expect(doc.querySelector('.dict-link')?.textContent).toBe(texts.dictLink);
    expect(doc.querySelector('.menorah-link')?.textContent).toBe(texts.menorahLink);
    expect(doc.querySelector('#app .status')?.textContent).toBe(texts.loading);
  });

  it('are all non-empty Russian strings', () => {
    const strings = (value: unknown, key: string): [string, unknown][] =>
      typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([k, v]) => strings(v, `${key}.${k}`)) : [[key, value]];
    for (const [key, text] of strings(texts, 'texts'))
      expect({ key, ok: typeof text === 'string' && /[а-яё]/i.test(text) }).toEqual({ key, ok: true });
  });

  it('fill their placeholders, leaving unknown ones as they are', () => {
    expect(fill(texts.home.learned, { learned: 3, open: 20 })).toBe('выучено 3 из 20');
    expect(fill('{a} и {b}', { a: 'да' })).toBe('да и {b}');
  });
});
