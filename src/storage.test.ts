import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEY, type KeyValueStorage } from './storage';

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

describe('settings storage', () => {
  it('uses the package name as the key', () => {
    expect(STORAGE_KEY).toBe('hebrew-verbs');
  });

  it('returns defaults when nothing is saved or storage is unavailable', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads settings', () => {
    const storage = new MemoryStorage();
    const settings = { nikud: false, translit: true };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('ignores write errors', () => {
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
    expect(() => saveSettings(null, DEFAULT_SETTINGS)).not.toThrow();
  });

  it.each(['not json', '[]', '{"version":2,"settings":{"nikud":false}}', '{"version":1}'])('resets unreadable data: %s', (raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces bad fields with defaults one by one', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: { nikud: 'no', translit: false } }));
    expect(loadSettings(storage)).toEqual({ nikud: true, translit: false });
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: { nikud: false, translit: 0 } }));
    expect(loadSettings(storage)).toEqual({ nikud: false, translit: true });
  });

  it('shows nikud and transliteration by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ nikud: true, translit: true });
  });
});
