// The dictionary (plan, section 5): one search field, the verbs found as one
// types (all of them by frequency for an empty query), each a link to its
// card; a verb found by another form tells which (decision 52). The query
// stays in the hash without a redraw.

import { h, hebrewWord } from '../dom';
import { hashOf } from '../routes';
import { describeHits, search, searchIndex, type Found, type SearchIndex } from '../search';
import { fill, texts } from '../texts';
import type { Verb } from '../verbs';
import type { AppContext } from './context';

/** Built once per verb list (~50 ms), on the first visit. */
const indexes = new WeakMap<readonly Verb[], SearchIndex>();
function indexOf(verbs: readonly Verb[]): SearchIndex {
  let index = indexes.get(verbs);
  if (!index) {
    index = searchIndex(verbs);
    indexes.set(verbs, index);
  }
  return index;
}

export function dictionaryView(query: string) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const { translit } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    const he = (form: { nikud: string; plain: string; translit: string }) => hebrewWord(form, spelling, translit);
    const index = indexOf(ctx.verbs);

    const item = ({ verb, hits }: Found) =>
      h(
        'li',
        {},
        h(
          'a',
          { class: 'dict-item', href: hashOf({ page: 'verb', id: verb.id }) },
          he(verb.lemma),
          h('span', { class: 'ru' }, verb.ru.join(', ')),
          ...describeHits(hits, spelling).map(({ form, where, persons }) =>
            h('span', { class: 'hit' }, he(form), ` · ${texts.dictionary.where[where]}${persons && `, ${persons}`}`),
          ),
        ),
      );

    const input = h('input', {
      type: 'search',
      dir: 'auto', // Hebrew types right to left, Russian left to right
      enterkeyhint: 'search',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      placeholder: texts.dictionary.placeholder,
      'aria-label': texts.dictionary.searchLabel,
    });
    input.value = query;
    const count = h('p', { class: 'dict-count', 'aria-live': 'polite' });
    const list = h('ul', { class: 'dict-results' });

    function show() {
      const q = input.value.trim();
      const found = search(index, q);
      count.textContent =
        q === ''
          ? fill(texts.dictionary.all, { n: found.length })
          : found.length
            ? fill(texts.dictionary.found, { n: found.length })
            : texts.dictionary.nothing;
      list.replaceChildren(...found.map(item));
      ctx.setLastQuery(q);
    }

    input.addEventListener('input', () => {
      show();
      // replaceState fires no hashchange: the view stays, the field keeps its focus.
      history.replaceState(history.state, '', hashOf({ page: 'dict', query: input.value.trim() }));
    });
    const form = h('form', { class: 'dict-search', role: 'search' }, input);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      input.blur(); // closes a phone's keyboard over the list
    });

    root.replaceChildren(h('h1', {}, texts.dictionary.heading), form, h('p', { class: 'hint' }, texts.dictionary.hint), count, list);
    show();
    return () => {};
  };
}
