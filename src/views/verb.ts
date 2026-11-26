// A verb's card (plan, section 5): its picture (always, decision 14), the
// headword with its sound, translations, root, binyan (a link to the
// menorah), rank, and the tables of the three tenses (src/views/forms.ts).

import { BINYAN_HEBREW } from '../binyanim';
import { h, hebrewWord } from '../dom';
import { TENSES, type Tense } from '../persons';
import { pictureOf } from '../pictures';
import { hashOf } from '../routes';
import { texts } from '../texts';
import type { Verb } from '../verbs';
import type { AppContext } from './context';
import { formsTable } from './forms';
import { listening } from './listen';
import { pictureElement } from './picture';

export function verbView(id: string) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const back = h('a', { class: 'back', href: hashOf({ page: 'dict', query: ctx.lastQuery() }) }, texts.verb.back);
    const found = ctx.verbs.find((v) => v.id === id);
    if (!found) {
      root.replaceChildren(h('section', { class: 'verb-page' }, back, h('p', {}, texts.verb.notFound)));
      return () => {};
    }
    const verb: Verb = found; // narrowed for the functions below
    const { translit } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    const he = (form: { nikud: string; plain: string; translit: string }) => hebrewWord(form, spelling, translit);
    const { listen, noVoice, stop } = listening(ctx);
    const picture = pictureOf(ctx.pictures, verb.id);

    const tense = (t: Tense) =>
      h('section', { class: `tense tense-${t}` }, h('h2', {}, texts.verb.tenses[t]), formsTable(verb, t, he, listen));

    const variants = verb.lemma.variants;
    root.replaceChildren(
      h(
        'section',
        { class: 'verb-page' },
        back,
        h(
          'div',
          { class: 'verb-head' },
          picture && pictureElement(picture, ctx.emoji),
          h(
            'div',
            { class: 'verb-text' },
            h('h1', { class: 'verb-word' }, he(verb.lemma), listen(verb.lemma.nikud)),
            variants &&
              h(
                'p',
                { class: 'note' },
                `${texts.verb.also} `,
                ...variants.map((v) => h('span', { class: 'he', lang: 'he', dir: 'rtl' }, v)),
              ),
            h('p', { class: 'ru' }, verb.ru.join(', ')),
            !verb.infinitive && h('p', { class: 'note' }, texts.game.noInfinitive),
          ),
        ),
        noVoice(),
        h(
          'dl',
          { class: 'verb-meta' },
          h('dt', {}, texts.verb.root),
          h('dd', {}, h('span', { class: 'he root', lang: 'he', dir: 'rtl' }, verb.root.join('־'))),
          h('dt', {}, texts.verb.binyan),
          h(
            'dd',
            {},
            h(
              'a',
              { class: 'binyan', href: hashOf({ page: 'menorah', binyan: verb.binyan }) },
              `${texts.binyanim[verb.binyan]} `,
              h('span', { class: 'he', lang: 'he', dir: 'rtl' }, BINYAN_HEBREW[verb.binyan]),
            ),
          ),
          h('dt', {}, texts.verb.rank),
          h('dd', { class: 'rank' }, String(verb.rank)),
        ),
        ...TENSES.map(tense),
      ),
    );
    return stop;
  };
}
