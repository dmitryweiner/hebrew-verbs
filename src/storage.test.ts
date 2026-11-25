import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyState, loadState, saveState, STORAGE_KEY, type KeyValueStorage, type SavedState } from './storage';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const broken: KeyValueStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

const stored = (data: unknown) => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
  return storage;
};

const stat = { shown: 3, correct: 2, wrong: 1, streak: 2, lastSeen: 1_790_000_000_000 };

describe('state storage', () => {
  it('uses the package name as the key', () => {
    expect(STORAGE_KEY).toBe('hebrew-verbs');
  });

  it('returns an empty state when nothing is saved or storage is unavailable', () => {
    expect(loadState(new MemoryStorage())).toEqual(emptyState());
    expect(loadState(null)).toEqual(emptyState());
    expect(loadState(broken)).toEqual(emptyState());
    expect(emptyState()).toEqual({ settings: DEFAULT_SETTINGS, stats: {} });
  });

  it('saves and loads settings and statistics', () => {
    const storage = new MemoryStorage();
    const state: SavedState = { settings: { nikud: false, translit: true }, stats: { 'past-form': { open: 30, verbs: { אכל: stat } } } };
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it('reports a failed write', () => {
    expect(saveState(broken, emptyState())).toBe(false);
    expect(saveState(null, emptyState())).toBe(false);
  });

  it.each(['not json', '[]', '{"version":3,"settings":{"nikud":false}}', '{"version":2}'])('resets unreadable data: %s', (raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    expect(loadState(storage)).toEqual(emptyState());
  });

  it('keeps the settings of version 1, which had no statistics', () => {
    expect(loadState(stored({ version: 1, settings: { nikud: false, translit: false } }))).toEqual({
      settings: { nikud: false, translit: false },
      stats: {},
    });
  });

  it('replaces bad settings with defaults one by one', () => {
    expect(loadState(stored({ version: 2, settings: { nikud: 'no', translit: false }, stats: {} })).settings).toEqual({
      nikud: true,
      translit: false,
    });
  });

  it('drops unknown games, bad verb entries and a bad open count', () => {
    const state = loadState(
      stored({
        version: 2,
        settings: DEFAULT_SETTINGS,
        stats: {
          'he-ru': { open: 40, verbs: { אכל: stat, שתה: { ...stat, shown: -1 }, הלך: { ...stat, lastSeen: 'yesterday' } } },
          'past-form': { open: 0, verbs: { אכל: { ...stat, lastSeen: null } } },
          'write-fast': { open: 20, verbs: {} },
          'ru-he': 'broken',
        },
      }),
    );
    expect(state.stats).toEqual({
      'he-ru': { open: 40, verbs: { אכל: stat } },
      'past-form': { open: 20, verbs: { אכל: { ...stat, lastSeen: null } } },
    });
  });

  it('drops a verb entry whose counts do not add up', () => {
    const state = loadState(
      stored({ version: 2, settings: DEFAULT_SETTINGS, stats: { write: { open: 20, verbs: { אכל: { ...stat, streak: 5 } } } } }),
    );
    expect(state.stats.write?.verbs).toEqual({});
  });

  it('shows nikud and transliteration by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ nikud: true, translit: true });
  });
});
