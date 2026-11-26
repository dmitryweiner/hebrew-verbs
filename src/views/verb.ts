// A verb's card (plan, section 5): its picture (always, decision 14), the
// headword with its sound, translations, root, binyan (a link to the
// menorah), rank, and the tables of the three tenses, a row per form with
// who says it and its sound; the literary future small beside the spoken
// one (decision 6).

import { BINYAN_HEBREW } from '../binyanim';
import { h, hebrewWord } from '../dom';
import { labelOf, personsOf, TENSES, type Tense } from '../persons';
import { pictureOf } from '../pictures';
import { hashOf, menorahHash } from '../routes';
import { texts } from '../texts';
import { FUTURE_SLOTS, PAST_SLOTS, PRESENT_SLOTS, type Form, type Verb } from '../verbs';
import type { AppContext } from './context';
import { listening } from './listen';
import { pictureElement } from './picture';

/** A tense's forms in table order, or undefined where the verb lacks the tense (היה has no present). */
function rowsOf(verb: Verb, tense: Tense): { slot: string; form: Form }[] | undefined {
  const table: Partial<Record<string, Form>> | undefined = tense === 'present' ? verb.present : tense === 'past' ? verb.past : verb.future;
  const slots: readonly string[] = tense === 'present' ? PRESENT_SLOTS : tense === 'past' ? PAST_SLOTS : FUTURE_SLOTS;
  return (
    table &&
    slots.flatMap((slot) => {
      const form = table[slot];
      return form ? [{ slot, form }] : [];
    })
  );
}

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

    function tense(t: Tense): HTMLElement {
      const rows = rowsOf(verb, t)?.map(({ slot, form }) => {
        const literary = t === 'future' && (slot === '2fp' || slot === '3fp') && verb.futureLiterary?.[slot];
        return h(
          'tr',
          {},
          h('th', { scope: 'row' }, labelOf(personsOf(t).filter((p) => p.slot === slot))),
          h('td', {}, he(form), literary && h('span', { class: 'literary' }, `${texts.verb.literary} `, he(literary))),
          h('td', {}, listen(form.nikud)),
        );
      });
      return h(
        'section',
        { class: `tense tense-${t}` },
        h('h2', {}, texts.verb.tenses[t]),
        rows ? h('table', { class: 'forms' }, h('tbody', {}, ...rows)) : h('p', { class: 'note' }, texts.verb.missing[t]),
      );
    }

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
              { class: 'binyan', href: menorahHash(verb.binyan) },
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
