export interface Settings {
  /** Show verb forms with nikud (else the plene spelling without it). */
  nikud: boolean;
  /** Show the Cyrillic transliteration under Hebrew words. */
  translit: boolean;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const STORAGE_KEY = __APP_ID__;
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { nikud: true, translit: true };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Saved settings; unreadable data is replaced with defaults, field by field. */
export function loadSettings(storage: KeyValueStorage | null): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== VERSION || !isRecord(data.settings)) return { ...DEFAULT_SETTINGS };
    const { nikud, translit } = data.settings;
    return {
      nikud: isBoolean(nikud) ? nikud : DEFAULT_SETTINGS.nikud,
      translit: isBoolean(translit) ? translit : DEFAULT_SETTINGS.translit,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, settings }));
  } catch {
    // Private mode or full storage: the app keeps working without saving.
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
