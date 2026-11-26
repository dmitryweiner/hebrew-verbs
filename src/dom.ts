// Small DOM builders shared by the views.

import type { Spelling } from './questions';

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/** An element with attributes (true: present, false or undefined: absent) and children. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs))
    if (value !== undefined && value !== false) el.setAttribute(name, value === true ? '' : String(value));
  el.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

/**
 * A Hebrew word inside Russian text: isolated right to left (the RTL lessons
 * in ~/projects/CLAUDE.md), the transliteration under it when it is on.
 */
export function hebrewWord(form: { nikud: string; plain: string; translit: string }, spelling: Spelling, translit: boolean): HTMLElement {
  return h(
    'span',
    { class: 'word' },
    h('span', { class: 'he', lang: 'he', dir: 'rtl' }, form[spelling]),
    translit && h('span', { class: 'translit' }, form.translit),
  );
}

/** A Russian text with each Hebrew run (letters, nikud, maqaf) isolated right to left, as hebrewWord does. */
export function withHebrew(text: string): (Node | string)[] {
  return text
    .split(/([֑-״]+)/u)
    .filter((part) => part !== '')
    .map((part) => (/[א-ת]/u.test(part) ? h('span', { class: 'he', lang: 'he', dir: 'rtl' }, part) : part));
}
