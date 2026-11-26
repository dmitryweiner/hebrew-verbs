// The home page: the four parts and the progress of each game (plan,
// section 3: all parts open at once, a hint to start with part 1), and a
// link to the progress page.

import { h } from '../dom';
import { gamePool, PARTS } from '../games';
import { gameProgress } from '../progress';
import { hashOf } from '../routes';
import { fill, texts } from '../texts';
import type { AppContext } from './context';

export function homeView(root: HTMLElement, ctx: AppContext): () => void {
  const parts = PARTS.map(({ part, games }) => {
    const items = games.map((game) => {
      const { learned, open } = gameProgress(gamePool(ctx.verbs, game), ctx.gameStats(game));
      return h(
        'li',
        {},
        h(
          'a',
          { class: 'game-link', href: hashOf({ page: 'game', game }) },
          h('span', { class: 'game-name' }, texts.games[game]),
          h('span', { class: 'game-progress' }, fill(texts.home.learned, { learned, open })),
        ),
      );
    });
    return h('section', { class: 'part' }, h('h2', {}, texts.parts[part]), h('ul', { class: 'games' }, ...items));
  });
  root.replaceChildren(
    h('h1', {}, texts.heading),
    h('p', {}, texts.intro),
    h('p', { class: 'hint' }, texts.home.hint),
    ...parts,
    h('p', { class: 'to-progress' }, h('a', { class: 'button progress-link', href: hashOf({ page: 'progress' }) }, texts.home.progress)),
  );
  return () => {};
}
