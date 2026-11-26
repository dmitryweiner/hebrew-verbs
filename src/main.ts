import './style.css';
import picturesUrl from './data/pictures.json?url';
import verbsUrl from './data/verbs.json?url';
import { startApp } from './app';
import { browserEmoji } from './emoji';
import { registerServiceWorker } from './pwa';
import { isExercise, routeOf } from './routes';
import { browserSpeaker } from './speech';
import { browserStorage } from './storage';

/** The data is fetched as JSON files, not bundled as code: JSON parses faster and the service worker caches it. */
async function json(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

startApp({
  storage: browserStorage(),
  loadData: async () => {
    const [verbs, pictures] = await Promise.all([json(verbsUrl), json(picturesUrl)]);
    return { verbs, pictures };
  },
  speaker: browserSpeaker(),
  emoji: browserEmoji(document),
  build: { version: __APP_VERSION__, date: __APP_DATE__ },
});
// A new version waits until a game or a meeting is left (decision 74).
if (import.meta.env.PROD) registerServiceWorker(navigator, window, document, () => isExercise(routeOf(window.location.hash)));
