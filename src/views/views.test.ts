// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { h, hebrewWord } from '../dom';
import type { EmojiSupport } from '../emoji';
import { pictureElement } from './picture';

afterEach(() => {
  document.body.innerHTML = '';
});

const form = { nikud: 'לֶאֱכֹל', plain: 'לאכול', translit: 'леэхоль' };
const support = (renders: boolean): EmojiSupport => ({
  renders: () => renders,
  twemoji: () => Promise.resolve({ '1f9e0.svg': '<svg id="brain"/>', '1f4ad.svg': '<svg id="bubble"/>' }),
});
const flush = () => new Promise((r) => setTimeout(r));

describe('dom helpers', () => {
  it('build an element with attributes and children, skipping the empty ones', () => {
    const el = h('button', { class: 'x', type: 'button', disabled: true, hidden: false, title: undefined }, 'a', null, h('b', {}, 'b'));
    expect(el.outerHTML).toBe('<button class="x" type="button" disabled="">a<b>b</b></button>');
  });

  it('show a Hebrew word isolated, in the chosen spelling, with or without transliteration', () => {
    const word = hebrewWord(form, 'nikud', true);
    const he = word.querySelector('[lang="he"]');
    expect(he?.getAttribute('dir')).toBe('rtl');
    expect(he?.textContent).toBe('לֶאֱכֹל');
    expect(word.querySelector('.translit')?.textContent).toBe('леэхоль');
    const plain = hebrewWord(form, 'plain', false);
    expect(plain.textContent).toBe('לאכול');
    expect(plain.querySelector('.translit')).toBeNull();
  });
});

describe('a picture', () => {
  it('is the emoji itself where the font draws it', () => {
    const el = pictureElement({ kind: 'emoji', emoji: '🧠💭', twemoji: ['1f9e0.svg', '1f4ad.svg'] }, support(true));
    expect(el.textContent).toBe('🧠💭');
    expect(el.querySelector('img')).toBeNull();
  });

  it('is the Twemoji copy of each emoji the font lacks', async () => {
    const el = pictureElement({ kind: 'emoji', emoji: '🧠💭', twemoji: ['1f9e0.svg', '1f4ad.svg'] }, support(false));
    await flush();
    const imgs = [...el.querySelectorAll('img')];
    expect(imgs.map((i) => i.alt)).toEqual(['🧠', '💭']);
    expect(decodeURIComponent(imgs[0]?.src ?? '')).toContain('<svg id="brain"/>');
  });

  it('is a drawing painted in the text colour (a mask), by an absolute address', () => {
    const el = pictureElement({ kind: 'svg', src: 'pictures/אחז.svg' }, support(true));
    expect(el.classList.contains('drawing')).toBe(true);
    expect(el.style.getPropertyValue('--picture')).toBe(`url("${new URL('pictures/אחז.svg', document.baseURI).href}")`);
  });
});
