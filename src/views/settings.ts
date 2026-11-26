// Settings (decisions 37–39: a page of its own, outside a game): nikud,
// transliteration, autoNext, whether there is a Hebrew voice, with how to
// install one, and a reset of the statistics, asked again right under its
// button (decision 57; not confirm()).

import { h } from '../dom';
import { GAMES } from '../games';
import type { Settings } from '../storage';
import { fill, texts } from '../texts';
import type { AppContext } from './context';

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

  const hasStats = () => GAMES.some((game) => Object.keys(ctx.gameStats(game).verbs).length > 0);
  const reset = h('button', { type: 'button', class: 'reset', disabled: !hasStats() }, texts.settings.reset);
  const yes = h('button', { type: 'button', class: 'reset-yes danger' }, texts.settings.resetYes);
  const cancel = h('button', { type: 'button', class: 'reset-cancel' }, texts.settings.resetCancel);
  const confirm = h(
    'div',
    { class: 'reset-confirm', hidden: true },
    h('p', {}, texts.settings.resetQuestion),
    h('div', { class: 'actions' }, yes, cancel),
  );
  const status = h('p', { class: 'reset-status', 'aria-live': 'polite' });
  reset.addEventListener('click', () => {
    confirm.hidden = false;
    status.textContent = '';
    cancel.focus();
  });
  cancel.addEventListener('click', () => {
    confirm.hidden = true;
    reset.focus();
  });
  yes.addEventListener('click', () => {
    ctx.resetStats();
    confirm.hidden = true;
    reset.disabled = true;
    status.textContent = texts.settings.resetDone;
  });

  root.replaceChildren(
    h('h1', {}, texts.settings.heading),
    toggle('nikud', texts.settings.nikud, texts.settings.nikudNote),
    toggle('translit', texts.settings.translit, texts.settings.translitNote),
    toggle('autoNext', texts.settings.autoNext, texts.settings.autoNextNote),
    h('h2', {}, texts.settings.voice),
    voice,
    h('h2', {}, texts.settings.stats),
    h('div', { class: 'reset-box' }, reset, confirm, status),
    h('a', { class: 'button', href: '#/' }, texts.settings.done),
  );
  return ctx.speaker.watch(showVoice);
}
