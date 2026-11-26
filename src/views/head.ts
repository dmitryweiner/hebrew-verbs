// The head of a game or a meeting: the way out, the title, "3 / 10" and a
// progress bar.

import { h } from '../dom';
import { texts } from '../texts';

/** `done` of `total` are behind; `label` names the current one for a screen reader ("Задание 4 из 10"). */
export function gameHead(title: string, done: number, total: number, label: string): HTMLElement {
  return h(
    'div',
    { class: 'game-head' },
    h('a', { class: 'quit', href: '#/' }, texts.game.quit),
    h('span', { class: 'game-title' }, title),
    h('span', { class: 'count', 'aria-hidden': 'true' }, `${Math.min(done + 1, total)} / ${total}`),
    h('progress', { max: total, value: done, 'aria-label': label, title: label }),
  );
}
