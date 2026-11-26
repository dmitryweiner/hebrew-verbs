// The home page: the four parts and the progress of each game (plan,
// section 3: all parts open at once, a hint to start with part 1).

import { h } from '../dom';
import { gamePool, PARTS } from '../games';
import { hashOf } from '../routes';
import { openVerbs } from '../selection';
import { isLearned } from '../stats';
import { fill, texts } from '../texts';
import type { AppContext } from './context';

export function homeView(root: HTMLElement, ctx: AppContext): () => void {
  const parts = PARTS.map(({ part, games }) => {
    const items = games.map((game) => {
      const stats = ctx.gameStats(game);
      const open = openVerbs(gamePool(ctx.verbs, game), stats);
      const learned = open.filter((v) => isLearned(stats.verbs[v.id])).length;
      return h(
        'li',
        {},
        h(
          'a',
          { class: 'game-link', href: hashOf({ page: 'game', game }) },
          h('span', { class: 'game-name' }, texts.games[game]),
          h('span', { class: 'game-progress' }, fill(texts.home.learned, { learned, open: open.length })),
        ),
      );
    });
    return h('section', { class: 'part' }, h('h2', {}, texts.parts[part]), h('ul', { class: 'games' }, ...items));
  });
  root.replaceChildren(h('h1', {}, texts.heading), h('p', {}, texts.intro), h('p', { class: 'hint' }, texts.home.hint), ...parts);
  return () => {};
}
