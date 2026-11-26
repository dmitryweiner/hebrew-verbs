// A reset of statistics, asked again right under its button (decision 57;
// not confirm()): the question with "Сбросить" and "Отмена", then a line
// telling it is done. The settings reset every game, the progress page one.

import { h } from '../dom';
import { texts } from '../texts';

export interface ResetOptions {
  label: string;
  question: string;
  done: string;
  disabled?: boolean;
  onReset: () => void;
}

export function resetBox({ label, question, done, disabled = false, onReset }: ResetOptions): HTMLElement {
  const reset = h('button', { type: 'button', class: 'reset', disabled }, label);
  const yes = h('button', { type: 'button', class: 'reset-yes danger' }, texts.reset.yes);
  const cancel = h('button', { type: 'button', class: 'reset-cancel' }, texts.reset.cancel);
  const confirm = h('div', { class: 'reset-confirm', hidden: true }, h('p', {}, question), h('div', { class: 'actions' }, yes, cancel));
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
    onReset();
    confirm.hidden = true;
    reset.disabled = true;
    status.textContent = done;
  });
  return h('div', { class: 'reset-box' }, reset, confirm, status);
}
