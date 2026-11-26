// Settings (decisions 37–39: a page of its own, outside a game): nikud,
// transliteration, autoNext, whether there is a Hebrew voice, with how to
// install one, and a reset of the statistics of every game, asked again
// right under its button (decision 57; not confirm()); one game is reset on
// the progress page. At the end, a link to the about page (decision 73).

import { h } from '../dom';
import { GAMES, PARTS } from '../games';
import { hashOf } from '../routes';
import type { Settings } from '../storage';
import { fill, texts } from '../texts';
import type { AppContext } from './context';
import { resetBox } from './reset';

export function settingsView(root: HTMLElement, ctx: AppContext): () => void {
  const toggle = (name: keyof Settings, label: string, note: string) => {
    const input = h('input', { type: 'checkbox', name });
    input.checked = ctx.settings()[name];
    input.addEventListener('change', () => ctx.saveSettings({ ...ctx.settings(), [name]: input.checked }));
    return h('div', { class: 'setting' }, h('label', { class: 'toggle' }, input, h('span', {}, label)), h('p', { class: 'note' }, note));
  };
  const voice = h('div', { class: 'voice-status', 'aria-live': 'polite' });
  const showVoice = () => {
    const name = ctx.speaker.voice();
    voice.replaceChildren(
      ...(name !== null
        ? [h('p', {}, fill(texts.settings.voiceFound, { name }))]
        : [
            h('p', {}, texts.settings.voiceMissing),
            h('ul', {}, ...texts.settings.voiceHowTo.map((line) => h('li', {}, line))),
            h('p', {}, texts.settings.voiceReload),
          ]),
    );
  };
  showVoice();

  const reset = resetBox({
    label: texts.settings.reset,
    question: texts.settings.resetQuestion,
    done: texts.settings.resetDone,
    disabled:
      GAMES.every((game) => Object.keys(ctx.gameStats(game).verbs).length === 0) && PARTS.every(({ part }) => ctx.met(part).size === 0),
    onReset: () => ctx.resetStats(),
  });

  root.replaceChildren(
    h('h1', {}, texts.settings.heading),
    toggle('nikud', texts.settings.nikud, texts.settings.nikudNote),
    toggle('translit', texts.settings.translit, texts.settings.translitNote),
    toggle('autoNext', texts.settings.autoNext, texts.settings.autoNextNote),
    h('h2', {}, texts.settings.voice),
    voice,
    h('h2', {}, texts.settings.stats),
    h('p', {}, h('a', { class: 'progress-link', href: hashOf({ page: 'progress' }) }, texts.settings.oneGame)),
    reset,
    h('p', {}, h('a', { class: 'about-link', href: hashOf({ page: 'about' }) }, texts.settings.about)),
    h('a', { class: 'button', href: '#/' }, texts.settings.done),
  );
  return ctx.speaker.watch(showVoice);
}
