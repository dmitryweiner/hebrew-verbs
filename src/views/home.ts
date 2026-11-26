// The home page: the four parts, each with its meeting (how many of its
// verbs are known) and the progress of each game (plan, section 3: all parts
// open at once, a hint to start with part 1), and a link to the progress page.

import { h } from '../dom';
import { gamePool, PARTS } from '../games';
import { partPool } from '../meeting';
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
    const pool = partPool(ctx.verbs, part);
    const met = ctx.met(part);
    const meeting = h(
      'li',
      {},
      h(
        'a',
        { class: 'meet-link', href: hashOf({ page: 'intro', part }) },
        h('span', { class: 'game-name' }, texts.meeting.name),
        h(
          'span',
          { class: 'meet-progress' },
          fill(texts.meeting.known, { known: pool.filter((v) => met.has(v.id)).length, total: pool.length }),
        ),
      ),
    );
    return h('section', { class: 'part' }, h('h2', {}, texts.parts[part]), h('ul', { class: 'games' }, meeting, ...items));
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
