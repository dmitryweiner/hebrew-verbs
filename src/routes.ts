// Hash routes (plan, section 8): #/, #/part/1/he-ru, #/part/2/form, #/part/1/intro,
// #/dict?q=…, #/dict/<id>, #/menorah, #/menorah/<binyan>, #/progress, #/settings, #/about. A game of part 1 is named by its id,
// a game of parts 2–4 by its kind; a part's meeting with its verbs is intro.

import { GAMES, gamePart, PARTS, type GameId, type Part } from './games';
import { BINYANIM, type Binyan } from './verbs';

export type Route =
  | { page: 'home' }
  | { page: 'settings' }
  | { page: 'progress' }
  | { page: 'about' }
  | { page: 'game'; game: GameId }
  | { page: 'intro'; part: Part }
  | { page: 'dict'; query: string }
  | { page: 'verb'; id: string }
  | { page: 'menorah'; binyan?: Binyan };

/** The last part of a game's hash: he-ru in part 1, form in present-form. */
const slug = (game: GameId): string => game.replace(/^(present|past|future)-/u, '');

export function hashOf(route: Route): string {
  if (route.page === 'home') return '#/';
  if (route.page === 'settings') return '#/settings';
  if (route.page === 'progress') return '#/progress';
  if (route.page === 'about') return '#/about';
  if (route.page === 'dict') return route.query === '' ? '#/dict' : `#/dict?${new URLSearchParams({ q: route.query })}`;
  if (route.page === 'verb') return `#/dict/${encodeURIComponent(route.id)}`;
  if (route.page === 'menorah') return route.binyan ? `#/menorah/${route.binyan}` : '#/menorah';
  if (route.page === 'intro') return `#/part/${route.part}/intro`;
  return `#/part/${gamePart(route.game)}/${slug(route.game)}`;
}

/** A game or a meeting: the header hides its links, and a new version waits until it is left (decision 74). */
export function isExercise(route: Route): boolean {
  return route.page === 'game' || route.page === 'intro';
}

function decoded(text: string): string | undefined {
  try {
    return decodeURIComponent(text);
  } catch {
    return undefined; // a broken %-escape
  }
}

/** The route of a hash; anything unknown is the home page. */
export function routeOf(hash: string): Route {
  const path = hash.replace(/^#\/?/u, '');
  if (path === 'settings') return { page: 'settings' };
  if (path === 'progress') return { page: 'progress' };
  if (path === 'about') return { page: 'about' };
  if (path === 'dict' || path.startsWith('dict?')) return { page: 'dict', query: new URLSearchParams(path.slice(5)).get('q') ?? '' };
  if (path.startsWith('dict/')) {
    const id = decoded(path.slice(5));
    return id ? { page: 'verb', id } : { page: 'home' };
  }
  if (path === 'menorah') return { page: 'menorah' };
  const binyan = BINYANIM.find((b) => path === `menorah/${b}`);
  if (binyan) return { page: 'menorah', binyan };
  const intro = PARTS.find(({ part }) => path === `part/${part}/intro`);
  if (intro) return { page: 'intro', part: intro.part };
  const game = GAMES.find((g) => path === `part/${gamePart(g)}/${slug(g)}`);
  return game ? { page: 'game', game } : { page: 'home' };
}
