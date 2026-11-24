// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp } from './app';
import { texts } from './texts';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<script[^>]*><\/script>/g, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

let stop: () => void = () => {};

beforeEach(() => {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
});
afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

describe('home page', () => {
  it('shows the app name and what it is for', () => {
    stop = startApp();
    expect(document.querySelector('h1')?.textContent).toBe(texts.heading);
    expect(document.querySelector('#app p')?.textContent).toBe(texts.intro);
  });

  it('renders again from scratch on a second start', () => {
    stop = startApp();
    stop();
    stop = startApp();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});
