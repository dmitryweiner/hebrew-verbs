// The app: loads the verb data, keeps the saved state and shows the view of
// the current hash route (src/routes.ts).

import type { EmojiSupport } from './emoji';
import { gamePool, type GameId } from './games';
import { parsePictures, type Pictures } from './pictures';
import { routeOf, type Route } from './routes';
import { answer, type Random } from './selection';
import type { Speaker } from './speech';
import { emptyGameStats } from './stats';
import { loadState, saveState, type KeyValueStorage } from './storage';
import { texts } from './texts';
import { parseVerbs, type Verb } from './verbs';
import type { AppContext, View } from './views/context';
import { dictionaryView } from './views/dictionary';
import { gameView } from './views/game';
import { homeView } from './views/home';
import { settingsView } from './views/settings';
import { verbView } from './views/verb';

export interface AppOptions {
  storage: KeyValueStorage | null;
  /** The parsed JSON of src/data/verbs.json and src/data/pictures.json. */
  loadData: () => Promise<{ verbs: unknown; pictures: unknown }>;
  speaker: Speaker;
  emoji: EmojiSupport;
  now?: () => number;
  random?: Random;
}

function required<T extends Element>(selector: string, type: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`index.html has no ${selector}`);
  return el;
}

function message(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'status';
  p.textContent = text;
  return p;
}

function viewOf(route: Route): View {
  if (route.page === 'settings') return settingsView;
  if (route.page === 'game') return gameView(route.game);
  if (route.page === 'dict') return dictionaryView(route.query);
  if (route.page === 'verb') return verbView(route.id);
  return homeView;
}

/** Starts the app on the current page; returns a function that clears it. */
export function startApp({ storage, loadData, speaker, emoji, now = Date.now, random = Math.random }: AppOptions): () => void {
  const root = required('#app', HTMLElement);
  const headerLinks = [required('.dict-link', HTMLElement), required('.settings-link', HTMLElement)];
  const state = loadState(storage);
  const pools = new Map<GameId, Verb[]>();
  let stopView: (() => void) | undefined;
  let stopped = false;
  let lastQuery = '';

  root.replaceChildren(message(texts.loading));

  function context(verbs: readonly Verb[], pictures: Pictures): AppContext {
    const pool = (game: GameId) => {
      let found = pools.get(game);
      if (!found) {
        found = gamePool(verbs, game);
        pools.set(game, found);
      }
      return found;
    };
    return {
      verbs,
      pictures,
      settings: () => state.settings,
      saveSettings(settings) {
        state.settings = settings;
        saveState(storage, state);
      },
      gameStats: (game) => state.stats[game] ?? emptyGameStats(),
      recordAnswer(game, verb, correct) {
        state.stats[game] = answer(pool(game), state.stats[game] ?? emptyGameStats(), verb.id, correct, now());
        saveState(storage, state);
      },
      lastQuery: () => lastQuery,
      setLastQuery(query) {
        lastQuery = query;
      },
      speaker,
      emoji,
      now,
      random,
    };
  }

  let ctx: AppContext | undefined;

  function show() {
    if (!ctx) return;
    const route = routeOf(window.location.hash);
    stopView?.();
    for (const link of headerLinks) link.hidden = route.page === 'game';
    document.documentElement.scrollTop = 0;
    stopView = viewOf(route)(root, ctx);
  }

  loadData()
    .then(({ verbs, pictures }) => {
      if (stopped) return;
      ctx = context(parseVerbs(verbs), parsePictures(pictures));
      show();
    })
    .catch((error: unknown) => {
      if (stopped) return;
      root.replaceChildren(message(texts.loadFailed));
      console.error(error);
    });

  window.addEventListener('hashchange', show);
  return () => {
    stopped = true;
    stopView?.();
    window.removeEventListener('hashchange', show);
    root.replaceChildren();
  };
}
