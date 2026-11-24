import { texts } from './texts';

function required<T extends Element>(selector: string, type: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`index.html has no ${selector}`);
  return el;
}

function element(tag: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

/** Starts the app on the current page; returns a function that clears it. */
export function startApp(): () => void {
  const root = required('#app', HTMLElement);
  root.replaceChildren(element('h1', texts.heading), element('p', texts.intro), element('p', texts.soon));
  return () => root.replaceChildren();
}
