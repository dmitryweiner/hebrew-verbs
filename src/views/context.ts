// What the views get from the app (src/app.ts): the data, the saved state
// and the browser services, so tests can replace each of them.

import type { EmojiSupport } from '../emoji';
import type { GameId } from '../games';
import type { Pictures } from '../pictures';
import type { Random } from '../selection';
import type { Speaker } from '../speech';
import type { GameStats } from '../stats';
import type { Settings } from '../storage';
import type { Verb } from '../verbs';

export interface AppContext {
  verbs: readonly Verb[];
  pictures: Pictures;
  settings(): Settings;
  saveSettings(settings: Settings): void;
  gameStats(game: GameId): GameStats;
  /** Records an answer in the game's statistics and saves them. */
  recordAnswer(game: GameId, verb: Verb, correct: boolean): void;
  /** Forgets the statistics of every game; the settings stay. */
  resetStats(): void;
  /** The dictionary's last query, in memory only: a card leads back to it. */
  lastQuery(): string;
  setLastQuery(query: string): void;
  speaker: Speaker;
  emoji: EmojiSupport;
  now: () => number;
  random: Random;
}

/** A view draws itself into the root and returns a function that stops its timers and listeners. */
export type View = (root: HTMLElement, ctx: AppContext) => () => void;
