// A part's meeting with its verbs (plan 3.0, decisions 68–71): the next
// verbs the learner does not know in the part, a card at a time, each met at
// "Понятно"; then the verbs met, "Проверить себя" (the part's first game),
// "Ещё 5" and the way home.

import { h, hebrewWord } from '../dom';
import { partTense, PARTS, type Part } from '../games';
import { nextToMeet, partPool } from '../meeting';
import { hashOf } from '../routes';
import { fill, texts } from '../texts';
import type { Form, Verb } from '../verbs';
import type { AppContext } from './context';
import { gameHead } from './head';
import { listening } from './listen';
import { meetCard } from './meet-card';

export function meetingView(part: Part) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const { translit } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    const he = (form: Form) => hebrewWord(form, spelling, translit);
    const { listen, noVoice, stop } = listening(ctx);
    const pool = partPool(ctx.verbs, part);
    const tense = partTense(part);
    const title = tense ? `${texts.tenses[tense]} · ${texts.meeting.name}` : texts.meeting.name;
    const firstGame = PARTS.find((p) => p.part === part)?.games[0] ?? 'he-ru';
    const home = h('a', { class: 'button', href: '#/' }, texts.summary.home);

    function show(batch: readonly Verb[], i: number) {
      const verb = batch[i];
      if (!verb) return showDone(batch);
      const next = h('button', { type: 'button', class: 'meet-next primary' }, texts.meeting.got);
      next.addEventListener('click', () => {
        ctx.meet(part, verb);
        show(batch, i + 1);
      });
      const label = fill(texts.meeting.count, { n: i + 1, total: batch.length });
      root.replaceChildren(
        h(
          'section',
          { class: 'game meeting' },
          gameHead(title, i, batch.length, label),
          meetCard(verb, part, ctx, he, listen),
          noVoice(),
          next,
        ),
      );
      queueMicrotask(() => next.focus());
    }

    function showDone(batch: readonly Verb[]) {
      const more = nextToMeet(pool, ctx.met(part)).length;
      const again = h('button', { type: 'button', class: 'more' }, fill(texts.meeting.more, { n: more }));
      again.addEventListener('click', begin);
      const check = h('a', { class: 'button primary check', href: hashOf({ page: 'game', game: firstGame }) }, texts.meeting.check);
      root.replaceChildren(
        h(
          'section',
          { class: 'summary' },
          h('h1', {}, texts.meeting.done),
          h('p', { class: 'score' }, fill(texts.meeting.met, { n: batch.length })),
          h(
            'ol',
            { class: 'results' },
            ...batch.map((verb) =>
              h(
                'li',
                {},
                h('a', { class: 'to-card', href: hashOf({ page: 'verb', id: verb.id }) }, he(verb.lemma)),
                h('span', { class: 'ru' }, verb.ru.join(', ')),
              ),
            ),
          ),
          h('div', { class: 'actions' }, check, more > 0 && again, home),
        ),
      );
      queueMicrotask(() => check.focus());
    }

    function begin() {
      const batch = nextToMeet(pool, ctx.met(part));
      if (batch.length > 0) return show(batch, 0);
      root.replaceChildren(
        h(
          'section',
          { class: 'meeting-over' },
          h('h1', {}, title),
          h('p', {}, texts.meeting.allKnown),
          h('div', { class: 'actions' }, home),
        ),
      );
    }

    begin();
    return stop;
  };
}
