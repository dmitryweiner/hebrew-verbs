// Settings (decisions 37–39: a page of its own, outside a game): nikud,
// transliteration, autoNext, and whether there is a Hebrew voice, with how
// to install one.

import { h } from '../dom';
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
  root.replaceChildren(
    h('h1', {}, texts.settings.heading),
    toggle('nikud', texts.settings.nikud, texts.settings.nikudNote),
    toggle('translit', texts.settings.translit, texts.settings.translitNote),
    toggle('autoNext', texts.settings.autoNext, texts.settings.autoNextNote),
    h('h2', {}, texts.settings.voice),
    voice,
    h('a', { class: 'button', href: '#/' }, texts.settings.done),
  );
  return ctx.speaker.watch(showVoice);
}
