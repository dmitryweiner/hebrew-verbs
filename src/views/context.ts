// What the views get from the app (src/app.ts): the data, the saved state
// and the browser services, so tests can replace each of them.

import type { EmojiSupport } from '../emoji';
import type { GameId, Part } from '../games';
import type { Pictures } from '../pictures';
import type { Random } from '../selection';
import type { Speaker } from '../speech';
import type { GameStats } from '../stats';
import type { Settings } from '../storage';
import type { Verb } from '../verbs';

/** The build's version (package.json) and the date of its last change, YYYY-MM-DD (vite.config.ts). */
export interface Build {
  version: string;
  date: string;
}

export interface AppContext {
  verbs: readonly Verb[];
  pictures: Pictures;
  settings(): Settings;
  saveSettings(settings: Settings): void;
  gameStats(game: GameId): GameStats;
  /** Records an answer in the game's statistics and saves them. */
  recordAnswer(game: GameId, verb: Verb, correct: boolean): void;
  /** The verb ids met in a part (decisions 68–69). */
  met(part: Part): ReadonlySet<string>;
  /** Marks a verb met in a part and saves it. */
  meet(part: Part, verb: Verb): void;
  /** Forgets the statistics of one game, or of every game and the verbs met; the settings stay. */
  resetStats(game?: GameId): void;
  /** The dictionary's last query, in memory only: a card leads back to it. */
  lastQuery(): string;
  setLastQuery(query: string): void;
  speaker: Speaker;
  emoji: EmojiSupport;
  now: () => number;
  random: Random;
  build: Build;
}

/** A view draws itself into the root and returns a function that stops its timers and listeners. */
export type View = (root: HTMLElement, ctx: AppContext) => () => void;
