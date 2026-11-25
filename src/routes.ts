// Hash routes (plan, section 8): #/, #/part/1/he-ru, #/part/2/form, #/settings.
// A game of part 1 is named by its id, a game of parts 2–4 by its kind.

import { GAMES, gamePart, type GameId } from './games';

export type Route = { page: 'home' } | { page: 'settings' } | { page: 'game'; game: GameId };

/** The last part of a game's hash: he-ru in part 1, form in present-form. */
const slug = (game: GameId): string => game.replace(/^(present|past|future)-/u, '');

export function hashOf(route: Route): string {
  if (route.page === 'home') return '#/';
  if (route.page === 'settings') return '#/settings';
  return `#/part/${gamePart(route.game)}/${slug(route.game)}`;
}

/** The route of a hash; anything unknown is the home page. */
export function routeOf(hash: string): Route {
  const path = hash.replace(/^#\/?/u, '');
  if (path === 'settings') return { page: 'settings' };
  const game = GAMES.find((g) => path === `part/${gamePart(g)}/${slug(g)}`);
  return game ? { page: 'game', game } : { page: 'home' };
}
