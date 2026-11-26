// The progress page (plan, section 6): every part with how many of its verbs
// are met (decision 68), every game with how many of its open verbs are
// learned, how far it is open, the share of right answers and its hardest
// verbs, each a link to its card. A game played can be reset on its own,
// asked again under its button (decision 57); every game at once is reset in
// the settings.

import { h, hebrewWord } from '../dom';
import { gamePool, PARTS, type GameId } from '../games';
import { partPool } from '../meeting';
import { gameProgress } from '../progress';
import { hashOf } from '../routes';
import { fill, texts } from '../texts';
import type { AppContext } from './context';
import { gameTitle } from './game';
import { resetBox } from './reset';

const note = (text: string) => h('p', { class: 'note' }, text);
const tile = (label: string, value: string) => h('div', { class: 'tile' }, h('dt', {}, label), h('dd', {}, value));

export function progressView(root: HTMLElement, ctx: AppContext): () => void {
  const { translit } = ctx.settings();
  const spelling = ctx.settings().nikud ? 'nikud' : 'plain';

  function gameStats(game: GameId): HTMLElement {
    const heading = h('h3', {}, h('a', { href: hashOf({ page: 'game', game }) }, texts.games[game]));
    const progress = gameProgress(gamePool(ctx.verbs, game), ctx.gameStats(game));
    if (progress.answers === 0) return h('article', { class: 'game-stats', 'data-game': game }, heading, note(texts.progress.notPlayed));

    const { learned, open, total, answers, correct, hardest } = progress;
    const body = h(
      'div',
      {},
      h(
        'dl',
        { class: 'tiles' },
        tile(texts.progress.learned, fill(texts.progress.of, { n: learned, total: open })),
        tile(texts.progress.opened, fill(texts.progress.of, { n: open, total })),
        tile(texts.progress.right, `${Math.round((100 * correct) / answers)} %`),
        tile(texts.progress.answers, String(answers)),
      ),
      h('h4', {}, texts.progress.hardest),
      hardest.length === 0
        ? note(texts.progress.noMistakes)
        : h(
            'ul',
            { class: 'hardest' },
            ...hardest.map(({ verb, stat }) =>
              h(
                'li',
                {},
                h(
                  'a',
                  { class: 'dict-item', href: hashOf({ page: 'verb', id: verb.id }) },
                  hebrewWord(verb.lemma, spelling, translit),
                  h('span', { class: 'ru' }, verb.ru.join(', ')),
                  h('span', { class: 'mistakes' }, fill(texts.progress.wrong, { wrong: stat.wrong, shown: stat.shown })),
                ),
              ),
            ),
          ),
    );
    const reset = resetBox({
      label: texts.progress.reset,
      question: fill(texts.progress.resetQuestion, { game: gameTitle(game) }),
      done: texts.progress.resetDone,
      onReset() {
        ctx.resetStats(game);
        body.replaceChildren(note(texts.progress.notPlayed));
      },
    });
    return h('article', { class: 'game-stats', 'data-game': game }, heading, body, reset);
  }

  root.replaceChildren(
    h('h1', {}, texts.progress.heading),
    h('p', { class: 'hint' }, texts.progress.intro),
    ...PARTS.map(({ part, games }) => {
      const pool = partPool(ctx.verbs, part);
      const met = ctx.met(part);
      const known = fill(texts.meeting.progress, { known: pool.filter((v) => met.has(v.id)).length, total: pool.length });
      return h(
        'section',
        { class: 'part' },
        h('h2', {}, texts.parts[part]),
        h('p', { class: 'part-known' }, known),
        ...games.map(gameStats),
      );
    }),
  );
  return () => {};
}
