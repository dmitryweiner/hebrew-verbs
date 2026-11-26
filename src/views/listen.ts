// 🔊 buttons and the "no Hebrew voice" line of a view (plan, section 7):
// disabled without a voice, turned on when one loads later (voiceschanged).

import { h } from '../dom';
import { texts } from '../texts';
import type { AppContext } from './context';

export interface Listening {
  /** 🔊 for a text with nikud: a headword, a form, a phrase. */
  listen: (text: string) => HTMLButtonElement;
  /** The link to the settings, shown while there is no Hebrew voice. */
  noVoice: () => HTMLElement;
  /** Stops following the voices. */
  stop: () => void;
}

/** onListen runs before a text is said: a game stays on a right answer then. */
export function listening(ctx: AppContext, onListen: () => void = () => {}): Listening {
  const buttons = new Set<HTMLButtonElement>();
  const notices = new Set<HTMLElement>();
  const hasVoice = () => ctx.speaker.voice() !== null;

  function update() {
    const voice = hasVoice();
    for (const button of buttons) {
      if (!button.isConnected) buttons.delete(button);
      else button.disabled = !voice;
    }
    for (const notice of notices) {
      if (!notice.isConnected) notices.delete(notice);
      else notice.hidden = voice;
    }
  }

  const stop = ctx.speaker.watch(update);
  return {
    listen(text) {
      const button = h('button', { type: 'button', class: 'listen', 'aria-label': texts.game.listen, title: texts.game.listen }, '🔊');
      button.disabled = !hasVoice();
      button.addEventListener('click', () => {
        onListen();
        ctx.speaker.say(text);
      });
      buttons.add(button);
      return button;
    },
    noVoice() {
      const notice = h('p', { class: 'no-voice', hidden: hasVoice() }, h('a', { href: '#/settings' }, texts.game.noVoice));
      notices.add(notice);
      return notice;
    },
    stop,
  };
}
