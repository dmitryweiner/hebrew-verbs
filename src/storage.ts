import { isGameId, type GameId } from './games';
import { START_OPEN, type GameStats, type VerbStat } from './stats';

export interface Settings {
  /** Show verb forms with nikud (else the plene spelling without it). */
  nikud: boolean;
  /** Show the Cyrillic transliteration under Hebrew words. */
  translit: boolean;
  /** Move to the next task by itself after a right answer (decision 39). */
  autoNext: boolean;
}

/** Statistics by game; a game never played is absent. */
export type Stats = Partial<Record<GameId, GameStats>>;

export interface SavedState {
  settings: Settings;
  stats: Stats;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const STORAGE_KEY = __APP_ID__;
/**
 * 3: the autoNext setting; version 2 is read as it is (autoNext gets its
 * default). 2: statistics added; version 1 held the settings only, they are kept.
 */
const VERSION = 3;

export const DEFAULT_SETTINGS: Settings = { nikud: true, translit: true, autoNext: false };

export function emptyState(): SavedState {
  return { settings: { ...DEFAULT_SETTINGS }, stats: {} };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isCount = (value: unknown): value is number => Number.isInteger(value) && typeof value === 'number' && value >= 0;

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const { nikud, translit, autoNext } = value;
  return {
    nikud: isBoolean(nikud) ? nikud : DEFAULT_SETTINGS.nikud,
    translit: isBoolean(translit) ? translit : DEFAULT_SETTINGS.translit,
    autoNext: isBoolean(autoNext) ? autoNext : DEFAULT_SETTINGS.autoNext,
  };
}

function parseVerbStat(value: unknown): VerbStat | undefined {
  if (!isRecord(value)) return undefined;
  const { shown, correct, wrong, streak, lastSeen } = value;
  if (!isCount(shown) || !isCount(correct) || !isCount(wrong) || !isCount(streak)) return undefined;
  if (correct + wrong !== shown || streak > correct) return undefined;
  if (lastSeen !== null && !(typeof lastSeen === 'number' && Number.isFinite(lastSeen))) return undefined;
  return { shown, correct, wrong, streak, lastSeen };
}

function parseStats(value: unknown): Stats {
  if (!isRecord(value)) return {};
  const stats: Stats = {};
  for (const [game, entry] of Object.entries(value)) {
    if (!isGameId(game) || !isRecord(entry)) continue;
    const verbs: Record<string, VerbStat> = {};
    if (isRecord(entry.verbs))
      for (const [id, raw] of Object.entries(entry.verbs)) {
        const stat = parseVerbStat(raw);
        if (stat) verbs[id] = stat;
      }
    stats[game] = { open: isCount(entry.open) && entry.open > 0 ? entry.open : START_OPEN, verbs };
  }
  return stats;
}

/** The saved state; unreadable data is replaced with defaults, field by field. */
export function loadState(storage: KeyValueStorage | null): SavedState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return emptyState();
    if (data.version === 1) return { settings: parseSettings(data.settings), stats: {} };
    if ((data.version !== VERSION && data.version !== 2) || !isRecord(data.settings)) return emptyState();
    return { settings: parseSettings(data.settings), stats: parseStats(data.stats) };
  } catch {
    return emptyState();
  }
}

/** Saves the state; false when storage is unavailable or full (the app keeps working without saving). */
export function saveState(storage: KeyValueStorage | null, state: SavedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
