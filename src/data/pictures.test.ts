// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emojiFile, emojiParts, parsePictures } from '../pictures.ts';
import { parseVerbs } from '../verbs.ts';

// The illustrations (plan 1.4) as the app will read them, and their files.
// Paths as strings: under jsdom the global URL is not the one node:fs accepts.
const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const pictures = parsePictures(JSON.parse(read('pictures.json')));
const verbs = parseVerbs(JSON.parse(read('verbs.json')));
const entries = Object.entries(pictures);
const drawings = resolve(import.meta.dirname, '../../public/pictures');
const emojiDir = resolve(import.meta.dirname, '../../public/emoji');

const MAX_BYTES = 4096;
const BANNED = new Set(['text', 'tspan', 'title', 'desc', 'script', 'style', 'foreignObject', 'image', 'a', 'use']);
const PAINTS = new Set(['none', 'currentColor']);

/** What is wrong with a drawing, by the rules of plan 1.4; empty when nothing. */
function drawingFaults(source: string): string[] {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg') return ['not an SVG'];
  const faults: string[] = [];
  if (root.getAttribute('viewBox') !== '0 0 128 128') faults.push('viewBox');
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (BANNED.has(el.localName)) faults.push(`<${el.localName}>`);
    for (const { name, value } of el.attributes) {
      if (/^on/i.test(name) || name === 'style' || /href$/i.test(name)) faults.push(`${name}=`);
      if ((name === 'fill' || name === 'stroke') && !PAINTS.has(value)) faults.push(`${name}="${value}"`);
    }
  }
  if (/url\(|\bhttps?:/i.test(source.replace('http://www.w3.org/2000/svg', ''))) faults.push('external reference');
  return faults;
}

describe('the pictures', () => {
  it('belong to listed verbs', () => {
    const ids = new Set(verbs.map((v) => v.id));
    expect(entries.filter(([id]) => !ids.has(id)).map(([id]) => id)).toEqual([]);
  });

  it('carry a comment where a drawing is to be redone', () => {
    expect(entries.filter(([, e]) => e.review === 'redo' && !e.comment).map(([id]) => id)).toEqual([]);
  });

  it('have a Twemoji copy of every emoji', () => {
    const missing = entries.flatMap(([id, e]) =>
      e.kind === 'emoji'
        ? emojiParts(e.emoji)
            .filter((part) => !existsSync(resolve(emojiDir, emojiFile(part))))
            .map((part) => `${id} ${part}`)
        : [],
    );
    expect(missing).toEqual([]);
  });

  it('ship no Twemoji copy that no entry uses', () => {
    const used = new Set(entries.flatMap(([, e]) => (e.kind === 'emoji' ? emojiParts(e.emoji).map(emojiFile) : [])));
    expect(readdirSync(emojiDir).filter((f) => !used.has(f))).toEqual([]);
  });

  it('have a drawing for every svg entry and no drawing without one', () => {
    const files = readdirSync(drawings).filter((f) => f.endsWith('.svg'));
    const wanted = entries.filter(([, e]) => e.kind === 'svg').map(([id]) => `${id}.svg`);
    expect(wanted.filter((f) => !files.includes(f))).toEqual([]);
    expect(files.filter((f) => !wanted.includes(f))).toEqual([]);
  });

  it('draw within the rules: 128×128, no text, scripts or links, currentColor only, at most 4 KB', () => {
    const bad = readdirSync(drawings)
      .filter((f) => f.endsWith('.svg'))
      .flatMap((f) => {
        const path = resolve(drawings, f);
        const faults = drawingFaults(readFileSync(path, 'utf8'));
        if (statSync(path).size > MAX_BYTES) faults.push(`${statSync(path).size} bytes`);
        return faults.map((fault) => `${f}: ${fault}`);
      });
    expect(bad).toEqual([]);
  });
});

const svg = (body: string, attrs = 'viewBox="0 0 128 128"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe('drawingFaults', () => {
  it('passes a drawing in currentColor', () => {
    expect(drawingFaults(svg('<path d="M0 0h10" stroke="currentColor" fill="none"/>'))).toEqual([]);
  });

  it('finds what the rules forbid', () => {
    expect(drawingFaults('<html/>')).toEqual(['not an SVG']);
    expect(drawingFaults(svg('', 'viewBox="0 0 100 100"'))).toEqual(['viewBox']);
    expect(drawingFaults(svg('<text>ab</text><title>есть</title>'))).toEqual(['<text>', '<title>']);
    expect(drawingFaults(svg('<path onclick="x()" fill="#f00"/>'))).toEqual(['onclick=', 'fill="#f00"']);
    expect(drawingFaults(svg('<rect style="fill:red"/>'))).toEqual(['style=']);
    expect(drawingFaults(svg('<rect filter="url(https://x.org/f)"/>'))).toEqual(['external reference']);
  });
});
