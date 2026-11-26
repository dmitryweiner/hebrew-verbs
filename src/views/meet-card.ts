// A verb's card for meeting it (decisions 68–70): its picture (always), the
// headword with its sound and the translations; in parts 2–4 also its table
// of the part's tense and a link to the binyan that builds the forms.

import { BINYAN_HEBREW } from '../binyanim';
import { h } from '../dom';
import { partTense, type Part } from '../games';
import { pictureOf } from '../pictures';
import { hashOf } from '../routes';
import { texts } from '../texts';
import type { Form, Verb } from '../verbs';
import type { AppContext } from './context';
import { formsTable } from './forms';
import { pictureElement } from './picture';

/** `he` shows a form in the spelling of the settings, `listen` gives its 🔊. */
export function meetCard(
  verb: Verb,
  part: Part,
  ctx: AppContext,
  he: (form: Form) => HTMLElement,
  listen: (text: string) => HTMLElement,
): HTMLElement {
  const picture = pictureOf(ctx.pictures, verb.id);
  const tense = partTense(part);
  return h(
    'div',
    { class: 'card meet-card' },
    h(
      'div',
      { class: 'verb-card' },
      picture && pictureElement(picture, ctx.emoji),
      h(
        'div',
        { class: 'verb-text' },
        h('div', { class: 'verb-word big' }, he(verb.lemma), listen(verb.lemma.nikud)),
        h('p', { class: 'ru' }, verb.ru.join(', ')),
        !verb.infinitive && h('p', { class: 'note' }, texts.game.noInfinitive),
      ),
    ),
    tense && h('h2', {}, texts.verb.tenses[tense]),
    tense && formsTable(verb, tense, he, listen),
    tense &&
      h(
        'p',
        { class: 'how' },
        `${texts.meeting.how} `,
        h(
          'a',
          { href: hashOf({ page: 'menorah', binyan: verb.binyan }) },
          `${texts.binyanim[verb.binyan]} `,
          h('span', { class: 'he', lang: 'he', dir: 'rtl' }, BINYAN_HEBREW[verb.binyan]),
        ),
      ),
  );
}
