// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppOptions } from './app';
import type { EmojiSupport } from './emoji';
import { parsePictures } from './pictures';
import { seededRandom } from './selection';
import type { Speaker } from './speech';
import { loadState, saveState, STORAGE_KEY, type KeyValueStorage } from './storage';
import { verb, verbs } from './testing';
import { texts } from './texts';
import type { Verb } from './verbs';
import { CORRECT_DELAY } from './views/game';

const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<script[^>]*><\/script>/g, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const pictures = parsePictures(JSON.parse(readFileSync(resolve(import.meta.dirname, 'data/pictures.json'), 'utf8')));
const NOW = 1_700_000_000_000;

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function fakeSpeaker(voice: string | null) {
  const listeners = new Set<() => void>();
  const speaker = {
    name: voice,
    said: [] as string[],
    voice: () => speaker.name,
    say: (text: string) => void speaker.said.push(text),
    watch: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
    install(name: string) {
      speaker.name = name;
      listeners.forEach((l) => l());
    },
  };
  return speaker satisfies Speaker;
}

const emoji: EmojiSupport = { renders: () => true, twemoji: () => Promise.resolve({}) };
const flush = () => new Promise<void>((r) => queueMicrotask(r)).then(() => new Promise<void>((r) => queueMicrotask(r)));

/** The data, loaded a moment later, as over the network. */
const later = () => new Promise<{ verbs: unknown; pictures: unknown }>((r) => setTimeout(() => r({ verbs, pictures })));

let stop: () => void = () => {};
let storage = memoryStorage();
let speaker = fakeSpeaker(null);

/** Sets the hash and waits for its hashchange: jsdom fires it later, and a late one would redraw the view mid-test. */
async function setHash(hash: string) {
  if (window.location.hash === hash) return;
  const changed = new Promise<void>((r) => window.addEventListener('hashchange', () => r(), { once: true }));
  window.location.hash = hash;
  await changed;
}

async function start(hash = '#/', overrides: Partial<AppOptions> = {}) {
  await setHash(hash);
  stop = startApp({
    storage,
    loadData: () => Promise.resolve({ verbs, pictures }),
    speaker,
    emoji,
    now: () => NOW,
    random: seededRandom(7),
    ...overrides,
  });
  await flush();
  await flush();
}

async function go(hash: string) {
  await setHash(hash);
  await flush();
}

/** The first element matching, of the given type. */
function $as<T extends Element>(selector: string, type: abstract new () => T): T | null {
  const el = document.querySelector(selector);
  return el instanceof type ? el : null;
}
function $$as<T extends Element>(selector: string, type: abstract new () => T): T[] {
  return [...document.querySelectorAll(selector)].filter((el): el is T => el instanceof type);
}
const $ = (selector: string) => $as(selector, HTMLElement);
const $$ = (selector: string) => $$as(selector, HTMLElement);
const text = (selector: string) => $(selector)?.textContent ?? '';
const ru = (v: Verb) => v.ru.join(', ');

/** The verb a task asks about, read from its card as a learner would. */
function asked(): Verb {
  const he = $('.card .he')?.textContent;
  const found = he ? verbs.find((v) => v.lemma.nikud === he || v.lemma.plain === he) : verbs.find((v) => ru(v) === text('.card .ru'));
  if (!found) throw new Error('no verb on the card');
  return found;
}

/** The option buttons and the index of the right one. */
function options(): { buttons: HTMLButtonElement[]; right: number } {
  const v = asked();
  const buttons = $$as('.option', HTMLButtonElement);
  const right = buttons.findIndex(
    (b) => b.querySelector('.ru')?.textContent === ru(v) || b.querySelector('.he')?.textContent === v.lemma.nikud,
  );
  return { buttons, right };
}

// jsdom's progress element has no value of its own: read the attribute.
/** After start: jsdom fires hashchange through setTimeout, so faked timers before it would hold the route. */
const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
const progress = () => Number($('.game-head progress')?.getAttribute('value'));
const stats = () => loadState(storage).stats;

const input = () => $as('.answer-input', HTMLInputElement);
const type = (word: string) => {
  const field = input();
  if (field) field.value = word;
};
const submit = () => $as('form.write', HTMLFormElement)?.requestSubmit();

/** Turns on the move to the next task after a right answer (off by default). */
function autoNext() {
  const state = loadState(storage);
  saveState(storage, { ...state, settings: { ...state.settings, autoNext: true } });
}

/** A game where the verbs of ranks 1..seen were answered: its first round brings the next three. */
function playedBefore(game: 'write', seen: number) {
  const state = loadState(null);
  const stat = { shown: 1, correct: 1, wrong: 0, streak: 1, lastSeen: NOW };
  state.stats[game] = { open: 30, verbs: Object.fromEntries(verbs.filter((v) => v.rank <= seen).map((v) => [v.id, stat])) };
  saveState(storage, state);
}

/** Answers "Не знаю" until the task asks this verb (a round of ten has each of its verbs). */
function skipTo(id: string) {
  for (let i = 0; i < 10 && asked().id !== id; i++) {
    $$as('.write-actions button', HTMLButtonElement)[1]?.click();
    $as('.next', HTMLButtonElement)?.click();
  }
  expect(asked().id).toBe(id);
}

beforeEach(() => {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  storage = memoryStorage();
  speaker = fakeSpeaker(null);
});
afterEach(async () => {
  stop();
  vi.useRealTimers();
  document.body.innerHTML = '';
  await setHash('');
});

describe('loading', () => {
  it('says it loads, then shows the home page', async () => {
    await setHash('#/');
    stop = startApp({ storage, loadData: later, speaker, emoji });
    expect(text('#app .status')).toBe(texts.loading);
    await new Promise((r) => setTimeout(r));
    await flush();
    expect(text('h1')).toBe(texts.heading);
  });

  it('tells when the data fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await start('#/', { loadData: () => Promise.reject(new Error('offline')) });
    expect(text('#app .status')).toBe(texts.loadFailed);
    expect(error).toHaveBeenCalled();
  });

  it('renders again from scratch on a second start', async () => {
    await start();
    stop();
    await start();
    expect($$('h1')).toHaveLength(1);
  });
});

describe('home page', () => {
  it('shows the four parts: the games of part 1 with their progress, the others to come', async () => {
    await start();
    expect(text('h1')).toBe(texts.heading);
    expect(text('.hint')).toBe(texts.home.hint);
    expect($$('.part h2').map((h) => h.textContent)).toEqual(Object.values(texts.parts));
    const links = $$as('.part a.game-link', HTMLAnchorElement);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#/part/1/he-ru', '#/part/1/ru-he', '#/part/1/write']);
    expect(links.map((a) => a.querySelector('.game-progress')?.textContent)).toEqual(Array(3).fill('выучено 0 из 20'));
    expect($$('.game-link.disabled')).toHaveLength(6);
  });

  it('counts the verbs learned of the open ones', async () => {
    const state = loadState(null);
    state.stats['ru-he'] = { open: 20, verbs: { היה: { shown: 3, correct: 3, wrong: 0, streak: 3, lastSeen: NOW } } };
    saveState(storage, state);
    await start();
    expect($$('.game-progress')[1]?.textContent).toBe('выучено 1 из 20');
  });

  it('sends a game of a part not ready yet home', async () => {
    await start('#/part/2/form');
    expect(text('h1')).toBe(texts.heading);
  });
});

describe('a choice game', () => {
  it('asks a verb of the first three, with four translations and a progress bar', async () => {
    await start('#/part/1/he-ru');
    expect(text('.game-title')).toBe(texts.games['he-ru']);
    expect(text('.task')).toBe(texts.game.task['he-ru']);
    expect(asked().rank).toBeLessThanOrEqual(3);
    expect(options().buttons).toHaveLength(4);
    expect(options().right).toBeGreaterThanOrEqual(0);
    expect(progress()).toBe(0);
    expect($('.settings-link')?.hidden).toBe(true);
  });

  it('shows a right answer with the verb card, saves it and waits for "Дальше"', async () => {
    await start('#/part/1/he-ru');
    fakeTimers();
    const v = asked();
    const { buttons, right } = options();
    buttons[right]?.click();
    expect(buttons[right]?.classList.contains('right')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect($('.feedback.good .verdict')?.textContent).toContain(texts.game.right);
    expect(text('.feedback .verb-card .he')).toBe(v.lemma.nikud);
    expect(text('.feedback .verb-card .ru')).toBe(ru(v));
    expect(stats()['he-ru']?.verbs[v.id]).toMatchObject({ shown: 1, correct: 1, streak: 1, lastSeen: NOW });
    vi.advanceTimersByTime(CORRECT_DELAY * 5);
    expect(progress()).toBe(0);
    $as('.next', HTMLButtonElement)?.click();
    expect(progress()).toBe(1);
  });

  it('with autoNext on moves on by itself after a right answer', async () => {
    autoNext();
    await start('#/part/1/he-ru');
    fakeTimers();
    const { buttons, right } = options();
    buttons[right]?.click();
    vi.advanceTimersByTime(CORRECT_DELAY);
    expect(progress()).toBe(1);
    expect($('.feedback')).toBeNull();
  });

  it('after a mistake marks both, reveals what every option is, and waits for "Дальше"', async () => {
    await start('#/part/1/he-ru');
    fakeTimers();
    const v = asked();
    const { buttons, right } = options();
    const wrong = (right + 1) % 4;
    buttons[wrong]?.click();
    expect(buttons[wrong]?.classList.contains('wrong')).toBe(true);
    expect(buttons[right]?.classList.contains('right')).toBe(true);
    expect(buttons.map((b) => b.querySelector('.reveal .he')?.textContent).filter(Boolean)).toHaveLength(4);
    expect(buttons[right]?.querySelector('.reveal .he')?.textContent).toBe(v.lemma.nikud);
    expect(stats()['he-ru']?.verbs[v.id]).toMatchObject({ shown: 1, wrong: 1 });
    vi.advanceTimersByTime(CORRECT_DELAY * 5);
    expect(progress()).toBe(0);
    $as('.next', HTMLButtonElement)?.click();
    expect(progress()).toBe(1);
  });

  it('takes the digit keys 1–4 for the options', async () => {
    await start('#/part/1/ru-he');
    const { buttons, right } = options();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(right + 1) }));
    expect(buttons[right]?.classList.contains('right')).toBe(true);
  });

  it('shows the headwords in ru-he and their translations after the answer', async () => {
    await start('#/part/1/ru-he');
    const v = asked();
    const { buttons, right } = options();
    expect(buttons[right]?.querySelector('.he')?.textContent).toBe(v.lemma.nikud);
    expect(buttons.every((b) => b.querySelector('.translit'))).toBe(true);
    buttons[right]?.click();
    expect(buttons[right]?.querySelector('.reveal')?.textContent).toBe(ru(v));
  });

  it('shows the picture of the verb after the answer, never before', async () => {
    await start('#/part/1/he-ru');
    expect($('.picture')).toBeNull();
    const v = asked();
    const { buttons, right } = options();
    buttons[right]?.click();
    const entry = pictures[v.id];
    expect(Boolean($('.feedback .picture'))).toBe(entry?.review === 'ok' && entry.kind !== 'none');
  });

  it('ends with the results and repeats the mistakes', async () => {
    await start('#/part/1/he-ru');
    const wrongVerbs = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { buttons, right } = options();
      const correct = i % 3 !== 0;
      if (!correct) wrongVerbs.add(asked().id);
      buttons[correct ? right : (right + 1) % 4]?.click();
      $as('.next', HTMLButtonElement)?.click();
    }
    expect(text('.summary h1')).toBe(texts.summary.heading);
    expect(text('.score')).toBe('6 из 10');
    expect($$('.results li')).toHaveLength(10);
    expect($$('.results li.bad')).toHaveLength(4);
    const [retry, again] = $$as('.summary .actions button', HTMLButtonElement);
    expect(retry?.textContent).toBe(texts.summary.retry);
    expect(again?.textContent).toBe(texts.summary.again);
    expect($as('.summary .actions a', HTMLAnchorElement)?.getAttribute('href')).toBe('#/');

    retry?.click();
    const seen = new Set<string>();
    while ($('.option')) {
      seen.add(asked().id);
      const { buttons, right } = options();
      buttons[right]?.click();
      $as('.next', HTMLButtonElement)?.click();
    }
    expect(seen).toEqual(wrongVerbs);
    expect(text('.score')).toBe(`${wrongVerbs.size} из ${wrongVerbs.size} · ${texts.summary.perfect}`);
    expect($$('.summary .actions button').map((b) => b.textContent)).toEqual([texts.summary.again]);
  });

  it('leaves the game by its link and shows the settings link again', async () => {
    await start('#/part/1/he-ru');
    expect($as('.quit', HTMLAnchorElement)?.getAttribute('href')).toBe('#/');
    await go('#/');
    expect(text('h1')).toBe(texts.heading);
    expect($('.settings-link')?.hidden).toBe(false);
  });
});

describe('speech in a game', () => {
  it('without a Hebrew voice keeps 🔊 disabled and points to the settings', async () => {
    await start('#/part/1/he-ru');
    expect($as('.card .listen', HTMLButtonElement)?.disabled).toBe(true);
    expect($('.no-voice')?.hidden).toBe(false);
    expect($as('.no-voice a', HTMLAnchorElement)?.getAttribute('href')).toBe('#/settings');
  });

  it('says the headword with nikud, and a voice that loads later turns it on', async () => {
    await start('#/part/1/he-ru');
    speaker.install('Carmit');
    expect($('.no-voice')?.hidden).toBe(true);
    $as('.card .listen', HTMLButtonElement)?.click();
    expect(speaker.said).toEqual([asked().lemma.nikud]);
  });

  it('listening after a right answer stops the move to the next task', async () => {
    speaker = fakeSpeaker('Carmit');
    autoNext();
    await start('#/part/1/ru-he');
    fakeTimers();
    const { buttons, right } = options();
    buttons[right]?.click();
    $as('.feedback .listen', HTMLButtonElement)?.click();
    vi.advanceTimersByTime(CORRECT_DELAY * 2);
    expect(progress()).toBe(0);
  });
});

describe('the write game', () => {
  it('takes the infinitive typed in its field, which has the focus', async () => {
    await start('#/part/1/write');
    const v = asked();
    expect(text('.task')).toBe(v.infinitive ? texts.game.task.write : texts.game.taskNoInfinitive);
    expect(document.activeElement).toBe(input());
    type(v.lemma.plain);
    submit();
    expect($('.feedback.good')).not.toBeNull();
    expect(input()?.readOnly).toBe(true);
    expect(stats().write?.verbs[v.id]).toMatchObject({ correct: 1 });
  });

  it('ignores an empty answer, and "Не знаю" shows the answer as a mistake', async () => {
    await start('#/part/1/write');
    const v = asked();
    submit();
    expect($('.feedback')).toBeNull();
    $$as('.write-actions button', HTMLButtonElement)[1]?.click();
    expect($('.feedback.bad')).not.toBeNull();
    expect(text('.feedback .verb-card .he')).toBe(v.lemma.nikud);
    expect(stats().write?.verbs[v.id]).toMatchObject({ wrong: 1 });
  });

  it('marks a wrong spelling wrong', async () => {
    await start('#/part/1/write');
    type('אבג');
    submit();
    expect($('.feedback.bad')).not.toBeNull();
    expect(input()?.classList.contains('wrong')).toBe(true);
  });

  it('takes a regular letter for a final one with a remark, and waits', async () => {
    playedBefore('write', 25);
    autoNext();
    await start('#/part/1/write');
    fakeTimers();
    skipTo('התכוון');
    const field = input();
    if (field) field.value = 'להתכוונ';
    submit();
    expect($('.feedback.good')).not.toBeNull();
    expect(text('.remark')).toContain(texts.game.finalLetters);
    expect(text('.remark .he')).toBe('להתכוון');
    vi.advanceTimersByTime(CORRECT_DELAY * 2);
    expect($('.feedback')).not.toBeNull();
  });

  it('takes another verb with the same translation and says so', async () => {
    playedBefore('write', 8);
    await start('#/part/1/write');
    skipTo('אמר');
    const field = input();
    if (field) field.value = 'להגיד';
    submit();
    expect($('.feedback.good')).not.toBeNull();
    expect(text('.remark')).toBe(texts.game.otherVerb);
    expect(text('.feedback .verb-card .he')).toBe(verb('הגיד').lemma.nikud);
    expect(stats().write?.verbs['אמר']).toMatchObject({ shown: 1, correct: 1 });
  });
});

describe('settings', () => {
  it('turn nikud and transliteration off for the next round', async () => {
    await start('#/settings');
    expect(text('h1')).toBe(texts.settings.heading);
    const [nikud, translit, next] = $$as('input[type="checkbox"]', HTMLInputElement);
    expect([nikud?.checked, translit?.checked, next?.checked]).toEqual([true, true, false]);
    nikud?.click();
    translit?.click();
    next?.click();
    expect(loadState(storage).settings).toEqual({ nikud: false, translit: false, autoNext: true });

    await go('#/part/1/he-ru');
    const v = asked();
    expect(text('.card .he')).toBe(v.lemma.plain);
    expect($('.translit')).toBeNull();
  });

  it('tell how to install a Hebrew voice, and name one once it is there', async () => {
    await start('#/settings');
    expect(text('.voice-status')).toContain(texts.settings.voiceMissing);
    expect($$('.voice-status li')).toHaveLength(texts.settings.voiceHowTo.length);
    speaker.install('Carmit');
    expect(text('.voice-status')).toBe('Голос иврита: Carmit.');
  });

  it('keep the statistics when saved', async () => {
    await start('#/part/1/he-ru');
    const { buttons, right } = options();
    buttons[right]?.click();
    await go('#/settings');
    $as('input[name="translit"]', HTMLInputElement)?.click();
    expect(Object.keys(loadState(storage).stats)).toEqual(['he-ru']);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });
});

describe('the verbs of the tests', () => {
  it('include the most frequent, which the first round asks', () => {
    expect([verb('היה'), verb('ידע'), verb('עשה')].map((v) => v.rank)).toEqual([1, 2, 3]);
  });
});
