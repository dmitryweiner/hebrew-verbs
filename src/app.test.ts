// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppOptions } from './app';
import type { EmojiSupport } from './emoji';
import { BINYAN_EXAMPLES, BINYAN_HEBREW, BINYAN_MODELS } from './binyanim';
import { formOf, labelOf, personsOf, PRONOUNS, withPronoun, type Person, type Tense } from './persons';
import { ruPhrase } from './phrases';
import { parsePictures, pictureOf } from './pictures';
import { hashOf, routeOf } from './routes';
import { personsWith } from './questions';
import { seededRandom } from './selection';
import type { Speaker } from './speech';
import { loadState, saveState, STORAGE_KEY, type KeyValueStorage } from './storage';
import { verb, verbs } from './testing';
import { fill, texts } from './texts';
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
  it('shows the four parts, each game with its progress', async () => {
    await start();
    expect(text('h1')).toBe(texts.heading);
    expect(text('.hint')).toBe(texts.home.hint);
    expect($$('.part h2').map((h) => h.textContent)).toEqual(Object.values(texts.parts));
    const links = $$as('.part a.game-link', HTMLAnchorElement);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#/part/1/he-ru',
      '#/part/1/ru-he',
      '#/part/1/write',
      '#/part/2/form',
      '#/part/2/person',
      '#/part/3/form',
      '#/part/3/person',
      '#/part/4/form',
      '#/part/4/person',
    ]);
    expect(links.map((a) => a.querySelector('.game-progress')?.textContent)).toEqual(Array(9).fill('выучено 0 из 20'));
  });

  it('counts the verbs learned of the open ones', async () => {
    const state = loadState(null);
    state.stats['ru-he'] = { open: 20, verbs: { היה: { shown: 3, correct: 3, wrong: 0, streak: 3, lastSeen: NOW } } };
    saveState(storage, state);
    await start();
    expect($$('.game-progress')[1]?.textContent).toBe('выучено 1 из 20');
  });

  it('sends an unknown game home', async () => {
    await start('#/part/2/write');
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
    expect($('.dict-link')?.hidden).toBe(true);
    expect($('.menorah-link')?.hidden).toBe(true);
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
    // A verb of the results opens its card (the round is over).
    const cardLinks = $$as('.results li a', HTMLAnchorElement).map((a) => routeOf(a.getAttribute('href') ?? ''));
    expect(cardLinks).toHaveLength(10);
    expect(cardLinks.filter((r) => r.page === 'verb' && wrongVerbs.has(r.id))).toHaveLength(wrongVerbs.size);

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

const optionHe = (b: HTMLElement) => b.querySelector('.he')?.textContent;

/** A tense task as a learner reads it: the verb, the person asked (form game) or the form shown (person game), the right option. */
function tenseTask(tense: Tense) {
  const lemma = text('.card .lemma .he');
  const v = verbs.find((x) => x.lemma.nikud === lemma || x.lemma.plain === lemma);
  if (!v) throw new Error(`no verb ${lemma} on the card`);
  const buttons = $$as('.option', HTMLButtonElement);
  const label = text('.card .pronoun .label');
  const person = personsOf(tense).find((p) => p.label === label);
  if (person) {
    const form = formOf(v, person);
    return { verb: v, person, buttons, right: buttons.findIndex((b) => optionHe(b) === form?.nikud || optionHe(b) === form?.plain) };
  }
  const shownForm = text('.card .form .he');
  const says = (p: Person) => {
    const f = formOf(v, p);
    return f !== undefined && (f.nikud === shownForm || f.plain === shownForm);
  };
  const pronouns = personsOf(tense)
    .filter(says)
    .map((p) => p.pronoun);
  const right = buttons.findIndex((b) =>
    pronouns.some((p) => optionHe(b) === `${p.nikud} ${shownForm}` || optionHe(b) === `${p.plain} ${shownForm}`),
  );
  return { verb: v, person: undefined, buttons, right };
}

describe('a form game', () => {
  it('asks the form of a pronoun, the verb and its translation on the card', async () => {
    await start('#/part/3/form');
    expect(text('.game-title')).toBe(`${texts.tenses.past} · ${texts.games['past-form']}`);
    expect(text('.task')).toBe(texts.game.task.form);
    const { verb: v, person, buttons, right } = tenseTask('past');
    expect(person).toBeDefined();
    expect(text('.card .ru')).toBe(ru(v));
    expect(text('.card .pronoun .he')).toBe(person?.pronoun.nikud);
    expect(buttons).toHaveLength(4);
    const past = new Set(Object.values(v.past).map((f) => f.nikud));
    expect(buttons.every((b) => past.has(optionHe(b) ?? ''))).toBe(true);
    expect(right).toBeGreaterThanOrEqual(0);
  });

  it('after the answer shows the phrase with its translation and who says each option', async () => {
    await start('#/part/2/form');
    const { verb: v, person, buttons, right } = tenseTask('present');
    if (!person) throw new Error('no person on the card');
    buttons[(right + 1) % 4]?.click();
    expect($('.feedback.bad')).not.toBeNull();
    expect(buttons[right]?.classList.contains('right')).toBe(true);
    expect(text('.feedback .phrase .he')).toBe(withPronoun(person, formOf(v, person) ?? v.past['3ms']).nikud);
    expect(text('.feedback .phrase .ru')).toBe(ruPhrase(v, person));
    expect(text('.feedback .verb-card .he')).toBe(v.lemma.nikud);
    for (const b of buttons) {
      const form = Object.values(v.present ?? {}).find((f) => f.nikud === b.querySelector('.he')?.textContent);
      expect(form && b.querySelector('.reveal')?.textContent).toBe(form && labelOf(personsWith(v, 'present', form, 'nikud')));
    }
    expect(stats()['present-form']?.verbs[v.id]).toMatchObject({ shown: 1, wrong: 1 });
  });

  it('without nikud takes no key 4 where the present has three forms: עושה', async () => {
    const state = loadState(storage);
    saveState(storage, { ...state, settings: { ...state.settings, nikud: false } });
    await start('#/part/2/form');
    for (let i = 0; i < 10 && tenseTask('present').verb.id !== 'עשה'; i++) {
      $$as('.option', HTMLButtonElement)[0]?.click();
      $as('.next', HTMLButtonElement)?.click();
    }
    expect(tenseTask('present').buttons).toHaveLength(3);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
    expect($('.feedback')).toBeNull();
  });
});

describe('a person game', () => {
  it('asks the pronoun of a form, offering it said with four pronouns', async () => {
    await start('#/part/4/person');
    expect(text('.game-title')).toBe(`${texts.tenses.future} · ${texts.games['future-person']}`);
    expect(text('.task')).toBe(texts.game.task.person);
    const form = text('.card .form .he');
    const { verb: v, buttons, right } = tenseTask('future');
    expect(Object.values(v.future ?? {}).map((f) => f.nikud)).toContain(form);
    expect(buttons).toHaveLength(4);
    expect(buttons.every((b) => b.querySelector('.he')?.textContent?.endsWith(` ${form}`))).toBe(true);
    expect(right).toBeGreaterThanOrEqual(0);
    // No Russian among the options: it would tell the answer.
    expect(buttons.every((b) => !/[а-я]/i.test(b.querySelector('.he')?.textContent ?? ''))).toBe(true);
  });

  it('after the answer names every pronoun, without a gender where the form takes both, and gives the phrase', async () => {
    await start('#/part/4/person');
    const reveals = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { verb: v, buttons, right } = tenseTask('future');
      const shownForm = text('.card .form .he');
      const form = Object.values(v.future ?? {}).find((f) => f.nikud === shownForm);
      if (!form) throw new Error(`no form ${shownForm}`);
      const pronounOf = (b: HTMLElement) => Object.values(PRONOUNS).find((p) => optionHe(b) === `${p.nikud} ${shownForm}`);
      buttons[right]?.click();
      expect($('.feedback.good')).not.toBeNull();
      expect(text('.feedback .phrase .he')).toBe(optionHe(buttons[right] ?? document.body));
      const sayers = personsWith(v, 'future', form, 'nikud').filter((p) => p.pronoun === pronounOf(buttons[right] ?? document.body));
      const person = sayers.find((p) => ruPhrase(v, p) === text('.feedback .phrase .ru'));
      expect(person).toBeDefined();
      buttons.forEach((b, j) => {
        const reveal = b.querySelector('.reveal')?.textContent ?? '';
        reveals.add(reveal);
        expect(reveal).toBe(j === right ? labelOf(sayers) : pronounOf(b)?.label);
      });
      expect(stats()['future-person']?.verbs[v.id]).toMatchObject({ shown: 1, correct: 1 });
      $as('.next', HTMLButtonElement)?.click();
    }
    expect(reveals.has('я (м.)') || reveals.has('я (ж.)')).toBe(false);
  });

  it('without nikud offers the plain phrases', async () => {
    const state = loadState(storage);
    saveState(storage, { ...state, settings: { ...state.settings, nikud: false } });
    await start('#/part/3/person');
    const { verb: v, buttons } = tenseTask('past');
    const plain = Object.values(v.past).map((f) => f.plain);
    expect(plain).toContain(text('.card .form .he'));
    expect(buttons.every((b) => /^[\u05d0-\u05ea ]+$/u.test(b.querySelector('.he')?.textContent ?? ''))).toBe(true);
  });

  it('says the form on the card and the phrase after the answer', async () => {
    speaker = fakeSpeaker('Carmit');
    await start('#/part/2/person');
    $as('.card .listen', HTMLButtonElement)?.click();
    const { buttons, right } = tenseTask('present');
    buttons[right]?.click();
    $as('.feedback .phrase .listen', HTMLButtonElement)?.click();
    expect(speaker.said).toEqual([text('.card .form .he'), text('.feedback .phrase .he')]);
  });

  it('ends with the results, each task as its phrase and translation', async () => {
    await start('#/part/4/person');
    const phrases: string[] = [];
    const translations: string[] = [];
    for (let i = 0; i < 10; i++) {
      const { buttons, right } = tenseTask('future');
      buttons[right]?.click();
      phrases.push(text('.feedback .phrase .he'));
      translations.push(text('.feedback .phrase .ru'));
      $as('.next', HTMLButtonElement)?.click();
    }
    expect(text('.score')).toBe(`10 из 10 · ${texts.summary.perfect}`);
    expect($$('.results li .he').map((el) => el.textContent)).toEqual(phrases);
    expect($$('.results li .ru').map((el) => el.textContent)).toEqual(translations);
    const pages = $$as('.results li a', HTMLAnchorElement).map((a) => routeOf(a.getAttribute('href') ?? '').page);
    expect(pages).toEqual(Array(10).fill('verb'));
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

  it('reset the statistics of every game after a question, keeping the settings', async () => {
    await start('#/part/1/he-ru');
    const { buttons, right } = options();
    buttons[right]?.click();
    await go('#/settings');
    $as('input[name="translit"]', HTMLInputElement)?.click();
    const reset = $as('.reset', HTMLButtonElement);
    expect(reset?.textContent).toBe(texts.settings.reset);
    expect($('.reset-confirm')?.hidden).toBe(true);

    reset?.click();
    expect($('.reset-confirm')?.hidden).toBe(false);
    expect(text('.reset-confirm p')).toBe(texts.settings.resetQuestion);
    $as('.reset-cancel', HTMLButtonElement)?.click();
    expect($('.reset-confirm')?.hidden).toBe(true);
    expect(Object.keys(loadState(storage).stats)).toEqual(['he-ru']);

    reset?.click();
    $as('.reset-yes', HTMLButtonElement)?.click();
    expect(loadState(storage).stats).toEqual({});
    expect(loadState(storage).settings.translit).toBe(false);
    expect($('.reset-confirm')?.hidden).toBe(true);
    expect(text('.reset-status')).toBe(texts.settings.resetDone);
    expect(reset?.disabled).toBe(true);

    await go('#/');
    expect($$('.game-progress').map((p) => p.textContent)).toEqual(Array(9).fill('выучено 0 из 20'));
  });

  it('offer no reset while there are no statistics', async () => {
    await start('#/settings');
    expect($as('.reset', HTMLButtonElement)?.disabled).toBe(true);
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

/** Types a query into the dictionary's field, as a learner would. */
function search(query: string) {
  const field = $as('.dict-search input', HTMLInputElement);
  if (!field) throw new Error('no search field');
  field.value = query;
  field.dispatchEvent(new Event('input'));
}

const firstFound = () => $('.dict-results li');

describe('the dictionary', () => {
  it('opens from the header and lists every verb by frequency', async () => {
    await start();
    expect($as('.dict-link', HTMLAnchorElement)?.getAttribute('href')).toBe('#/dict');
    expect(text('.dict-link')).toBe(texts.dictLink);
    await go('#/dict');
    expect(text('h1')).toBe(texts.dictionary.heading);
    expect($$('.dict-results li')).toHaveLength(verbs.length);
    expect(text('.dict-count')).toBe(fill(texts.dictionary.all, { n: verbs.length }));
    expect($as('.dict-results li a', HTMLAnchorElement)?.getAttribute('href')).toBe(hashOf({ page: 'verb', id: 'היה' }));
    expect(firstFound()?.querySelector('.he')?.textContent).toBe(verb('היה').lemma.nikud);
  });

  it('searches as one types, tells the form found and keeps the query in the hash', async () => {
    await start('#/dict');
    const field = $('.dict-search input');
    expect(field?.getAttribute('dir')).toBe('auto');
    search('אכלתי');
    expect(firstFound()?.querySelector('a')?.getAttribute('href')).toBe(hashOf({ page: 'verb', id: 'אכל' }));
    expect(firstFound()?.querySelector('.hit .he')?.textContent).toBe('אָכַלְתִּי');
    expect(firstFound()?.querySelector('.hit')?.textContent).toContain(`${texts.dictionary.where.past}, я`);
    expect(text('.dict-count')).toBe(fill(texts.dictionary.found, { n: $$('.dict-results li').length }));
    expect(window.location.hash).toBe(hashOf({ page: 'dict', query: 'אכלתי' }));
    await flush();
    expect($('.dict-search input')).toBe(field); // no redraw from the hash
    search('');
    expect(window.location.hash).toBe('#/dict');
  });

  it('opens with the query of its hash', async () => {
    await start(hashOf({ page: 'dict', query: 'есть' }));
    expect($as('.dict-search input', HTMLInputElement)?.value).toBe('есть');
    expect(firstFound()?.querySelector('.ru')?.textContent).toBe(ru(verb('אכל')));
    expect(firstFound()?.querySelector('.hit')).toBeNull();
  });

  it('says when nothing is found', async () => {
    await start(hashOf({ page: 'dict', query: 'write' }));
    expect($$('.dict-results li')).toHaveLength(0);
    expect(text('.dict-count')).toBe(texts.dictionary.nothing);
  });

  it('shows the spelling and the transliteration of the settings', async () => {
    const state = loadState(storage);
    saveState(storage, { ...state, settings: { ...state.settings, nikud: false, translit: false } });
    await start('#/dict');
    expect(firstFound()?.querySelector('.he')?.textContent).toBe(verb('היה').lemma.plain);
    expect($('.dict-results .translit')).toBeNull();
  });
});

/** A verb card's rows of a tense; a row's person and form. */
const rows = (tense: Tense) => $$(`.tense-${tense} tbody tr`);
function cells(tense: Tense, i: number) {
  const row = rows(tense)[i];
  return [row?.querySelector('th')?.textContent, row?.querySelector('.he')?.textContent];
}

describe('a verb card', () => {
  it('shows the headword with its sound, the translations, the root, the binyan and the rank', async () => {
    await start(hashOf({ page: 'verb', id: 'דיבר' }));
    expect(text('h1 .he')).toBe('לְדַבֵּר');
    expect(text('.verb-page > .verb-head .ru')).toBe(ru(verb('דיבר')));
    expect(text('.verb-meta .root')).toBe('ד־ב־ר');
    const binyan = $as('.verb-meta a.binyan', HTMLAnchorElement);
    expect(binyan?.getAttribute('href')).toBe('#/menorah/piel');
    expect(binyan?.textContent).toContain(texts.binyanim.piel);
    expect(text('.verb-meta .rank')).toBe(String(verb('דיבר').rank));
    expect($('.dict-link')?.hidden).toBe(false);
  });

  it('gives the three tenses, a person and a form a row', async () => {
    await start(hashOf({ page: 'verb', id: 'אכל' }));
    expect($$('.tense h2').map((h) => h.textContent)).toEqual(Object.values(texts.verb.tenses));
    expect([rows('present').length, rows('past').length, rows('future').length]).toEqual([4, 9, 10]);
    expect(cells('present', 0)).toEqual(['я (м.), ты (м.), он', 'אוֹכֵל']);
    expect(cells('past', 0)).toEqual(['я', 'אָכַלְתִּי']);
    expect(cells('past', 8)).toEqual(['они (м.), они (ж.)', 'אָכְלוּ']);
    expect(cells('future', 9)).toEqual(['они (ж.)', 'יֹאכְלוּ']);
    // The literary future, small beside the spoken one (decision 6).
    expect(rows('future')[9]?.querySelector('.literary .he')?.textContent).toBe('תֹּאכַלְנָה');
    expect($$('.tense .literary')).toHaveLength(2);
  });

  it('says every form, once a Hebrew voice is there', async () => {
    await start(hashOf({ page: 'verb', id: 'אכל' }));
    const buttons = $$as('.verb-page .listen', HTMLButtonElement);
    expect(buttons).toHaveLength(1 + 4 + 9 + 10);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect($('.no-voice')?.hidden).toBe(false);
    speaker.install('Carmit');
    expect($('.no-voice')?.hidden).toBe(true);
    rows('past')[0]?.querySelector('button')?.click();
    $as('h1 .listen', HTMLButtonElement)?.click();
    expect(speaker.said).toEqual(['אָכַלְתִּי', 'לֶאֱכֹל']);
  });

  it('always shows the picture, and the spelling of the settings', async () => {
    const id = verbs.find((v) => pictureOf(pictures, v.id))?.id ?? '';
    const state = loadState(storage);
    saveState(storage, { ...state, settings: { ...state.settings, nikud: false } });
    await start(hashOf({ page: 'verb', id }));
    expect($('.verb-head .picture')).not.toBeNull();
    expect(text('h1 .he')).toBe(verb(id).lemma.plain);
  });

  it('tells a tense the verb lacks and a headword that is no infinitive', async () => {
    await start(hashOf({ page: 'verb', id: 'היה' }));
    expect(rows('present')).toHaveLength(0);
    expect(text('.tense-present .note')).toBe(texts.verb.missing.present);
    await go(hashOf({ page: 'verb', id: 'שוחרר' }));
    expect(text('.verb-head .note')).toBe(texts.game.noInfinitive);
  });

  it('leads back to the search it came from', async () => {
    await start('#/dict');
    search('есть');
    await go($as('.dict-results a', HTMLAnchorElement)?.getAttribute('href') ?? '');
    expect($as('.verb-page .back', HTMLAnchorElement)?.getAttribute('href')).toBe(hashOf({ page: 'dict', query: 'есть' }));
  });

  it('tells an unknown verb', async () => {
    await start(hashOf({ page: 'verb', id: 'אאא' }));
    expect(text('.verb-page p')).toBe(texts.verb.notFound);
    expect($as('.verb-page .back', HTMLAnchorElement)?.getAttribute('href')).toBe('#/dict');
  });
});

const branches = () => $$as('.menorah .branch', HTMLAnchorElement);

describe('the menorah', () => {
  it('opens from the header: seven branches, hitpael in the middle, no card yet', async () => {
    await start();
    expect($as('.menorah-link', HTMLAnchorElement)?.getAttribute('href')).toBe('#/menorah');
    expect(text('.menorah-link')).toBe(texts.menorahLink);
    await go('#/menorah');
    expect(text('h1')).toBe(texts.menorah.heading);
    expect(branches().map((a) => a.getAttribute('href'))).toEqual(
      ['nifal', 'pual', 'hufal', 'hitpael', 'hifil', 'piel', 'paal'].map((b) => `#/menorah/${b}`),
    );
    expect(branches()[6]?.querySelector('.he')?.textContent).toBe(BINYAN_HEBREW.paal);
    expect(branches()[6]?.querySelector('.name')?.textContent).toBe(texts.binyanim.paal);
    expect(branches()[3]?.classList.contains('branch-reflexive')).toBe(true);
    expect($$('.menorah .branch[aria-current]')).toHaveLength(0);
    expect($('.binyan-card')).toBeNull();
    expect(text('.menorah-page .hint')).toBe(texts.menorah.choose);
    expect($('.menorah-link')?.hidden).toBe(false);
  });

  it('opens a binyan: its meaning, features, model forms and examples', async () => {
    await start('#/menorah/piel');
    expect(branches()[5]?.getAttribute('aria-current')).toBe('page');
    expect($$('.menorah .branch[aria-current]')).toHaveLength(1);
    expect(text('.binyan-card h2 .he')).toBe(BINYAN_HEBREW.piel);
    expect(text('.binyan-card h2')).toContain(texts.binyanim.piel);
    expect(text('.binyan-card .meaning')).toBe(texts.menorah.binyanim.piel.meaning);
    expect($$('.binyan-card .features li').map((li) => li.textContent)).toEqual(texts.menorah.binyanim.piel.features);
    expect($('.binyan-card .features .he[dir="rtl"]')).not.toBeNull();
    // The pair: piel's passive is pual, a link to it.
    expect($as('.binyan-card .pair a', HTMLAnchorElement)?.getAttribute('href')).toBe('#/menorah/pual');
    const model = $$('.binyan-card .model tr');
    expect(model.map((tr) => tr.querySelector('th')?.textContent)).toEqual([
      texts.menorah.infinitive,
      texts.tenses.present,
      texts.tenses.past,
      texts.tenses.future,
    ]);
    expect(model[0]?.querySelector('.he')?.textContent).toBe(BINYAN_MODELS.piel.infinitive?.nikud);
    expect([...(model[2]?.querySelectorAll('.model-form') ?? [])].map((f) => f.textContent)).toEqual([
      `он${BINYAN_MODELS.piel.past['3ms'].nikud}${BINYAN_MODELS.piel.past['3ms'].translit}`,
      `она${BINYAN_MODELS.piel.past['3fs'].nikud}${BINYAN_MODELS.piel.past['3fs'].translit}`,
      `я${BINYAN_MODELS.piel.past['1s'].nikud}${BINYAN_MODELS.piel.past['1s'].translit}`,
      `они${BINYAN_MODELS.piel.past['3p'].nikud}${BINYAN_MODELS.piel.past['3p'].translit}`,
    ]);
    const examples = $$as('.binyan-card .examples a', HTMLAnchorElement);
    expect(examples.map((a) => a.getAttribute('href'))).toEqual(BINYAN_EXAMPLES.piel.map((id) => hashOf({ page: 'verb', id })));
    expect(examples[0]?.querySelector('.he')?.textContent).toBe('לְדַבֵּר');
    expect(examples[0]?.querySelector('.ru')?.textContent).toBe(ru(verb('דיבר')));
    expect(text('.binyan-card .count')).toBe(fill(texts.menorah.count, { n: verbs.filter((v) => v.binyan === 'piel').length }));
  });

  it('tells a binyan without an infinitive and the active one of a passive', async () => {
    await start('#/menorah/hufal');
    expect(text('.binyan-card .model tr th')).toBe(texts.menorah.infinitive);
    expect(text('.binyan-card .model tr td')).toBe(texts.menorah.noInfinitive);
    expect(text('.binyan-card .pair')).toContain(texts.menorah.passiveOf);
    expect($as('.binyan-card .pair a', HTMLAnchorElement)?.getAttribute('href')).toBe('#/menorah/hifil');
    await go('#/menorah/hitpael');
    expect($('.binyan-card .pair')).toBeNull();
  });

  it('shows the spelling and the transliteration of the settings', async () => {
    const state = loadState(storage);
    saveState(storage, { ...state, settings: { ...state.settings, nikud: false, translit: false } });
    await start('#/menorah/piel');
    expect(text('.binyan-card .model tr .he')).toBe(BINYAN_MODELS.piel.infinitive?.plain);
    expect(text('.binyan-card .examples .he')).toBe('לדבר');
    expect($('.binyan-card .translit')).toBeNull();
    // The names on the branches and the texts keep their nikud: they tell the vowels.
    expect(branches()[5]?.querySelector('.he')?.textContent).toBe(BINYAN_HEBREW.piel);
  });

  it('is where a verb card leads by its binyan', async () => {
    await start(hashOf({ page: 'verb', id: 'דיבר' }));
    await go($as('.verb-meta a.binyan', HTMLAnchorElement)?.getAttribute('href') ?? '');
    expect(text('.binyan-card h2 .he')).toBe(BINYAN_HEBREW.piel);
  });
});

describe('the verbs of the tests', () => {
  it('include the most frequent, which the first round asks', () => {
    expect([verb('היה'), verb('ידע'), verb('עשה')].map((v) => v.rank)).toEqual([1, 2, 3]);
  });
});
