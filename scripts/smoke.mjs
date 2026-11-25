// Browser smoke of the real app: the home page renders with the verb data,
// a round of a part-1 game runs to its results, a typed answer is taken,
// no horizontal scroll on a phone (home and game screens),
// no console errors. In dev it also checks the canvas emoji test. With
// --preview it runs against a fresh production build and also checks that
// the service worker makes the app work offline and that a new deploy
// reaches a page that is already open (phones suspend pages, never close them).
//
//   npm run smoke               # dev server
//   npm run smoke -- --preview  # production build + offline check
//   npm run smoke -- --shots    # also saves shots/<viewport>-<screen>.png
//
// Prints one line per step; exits 1 on the first failed step or on any
// console error. New checks are new steps here, not new scripts.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { check, launch, parseArgs, VIEWPORTS } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2));
const preview = flags.has('preview');
const shots = flags.has('shots');
const app = await launch({ preview });
const HEADING = 'Глаголы иврита';

/** Answers the current choice task with its first option and goes on. */
async function answerFirst(page) {
  await page.locator('.option:not([disabled])').first().click();
  // A right answer moves on by itself after a moment: the button may go first.
  await page
    .locator('.next')
    .click({ timeout: 1000 })
    .catch(() => {});
}

async function step(name, fn) {
  app.label(name);
  await fn();
  console.log(`ok  ${name}`);
}

try {
  await step('the home page renders in Russian', async () => {
    const { page, context } = await app.open();
    check((await page.locator('html').getAttribute('lang')) === 'ru', 'the page is not marked Russian');
    check((await page.locator('h1').textContent()) === HEADING, 'the home page did not render');
    await context.close();
  });

  await step('a he-ru round runs to its results and repeats the mistakes', async () => {
    const { page, context } = await app.open();
    await page.goto(`${app.base}#/part/1/he-ru`);
    for (let i = 0; i < 10; i++) await answerFirst(page);
    await page.locator('.summary').waitFor();
    check((await page.locator('.results li').count()) === 10, 'the results do not list ten tasks');
    const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hebrew-verbs') ?? '{}').stats ?? {}));
    check(stored.includes('he-ru'), 'the answers were not saved');
    const retry = page.getByRole('button', { name: 'Повторить ошибки' });
    if (await retry.count()) {
      await retry.click();
      check((await page.locator('.option').count()) === 4, 'the mistakes round did not start');
    }
    await context.close();
  });

  await step('the write game takes a typed answer on a phone', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(`${app.base}#/part/1/write`);
    const asked = await page.locator('.card .ru').textContent();
    const lemma = await page.evaluate(async (ru) => {
      const verbs = await (
        await fetch(performance.getEntriesByType('resource').find((e) => /verbs[^/]*\.json$/.test(e.name))?.name ?? '')
      ).json();
      return verbs.find((v) => v.ru.join(', ') === ru)?.lemma.plain;
    }, asked);
    check(typeof lemma === 'string', `no verb translated "${asked}"`);
    check(await page.locator('.answer-input').evaluate((el) => el === document.activeElement), 'the answer field has no focus');
    await page.keyboard.type(lemma);
    await page.getByRole('button', { name: 'Проверить' }).click();
    await page.locator('.feedback.good').waitFor();
    await context.close();
  });

  if (!preview) {
    await step('the canvas emoji test tells a drawn emoji from a missing one', async () => {
      const { page, context } = await app.open();
      const [smile, privateUse] = await page.evaluate(async () => {
        const { canvasEmojiCheck } = await import('/src/emoji.ts');
        const renders = canvasEmojiCheck(document);
        return [renders('😀'), renders('\u{E000}')];
      });
      check(!privateUse, 'a private-use character passed for an emoji');
      // Linux runners may lack a colour emoji font; a Mac always has one.
      if (process.platform === 'darwin') check(smile, 'a common emoji was not seen as drawn');
      await context.close();
    });
  }

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    await step(`no horizontal scroll on ${name} (${viewport.width}px): home, the games, settings`, async () => {
      const { page, context } = await app.open({ viewport });
      const screens = [
        ['home', '#/', 'h1'],
        ['he-ru', '#/part/1/he-ru', '.option'],
        ['write', '#/part/1/write', '.answer-input'],
        ['settings', '#/settings', '.toggle'],
      ];
      for (const [screen, hash, ready] of screens) {
        await page.goto(`${app.base}${hash}`);
        await page.locator(ready).first().waitFor();
        if (screen === 'he-ru') await page.locator('.option').first().click();
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        check(width <= viewport.width, `${screen} is ${width}px wide`);
        if (shots) await page.screenshot({ path: `shots/${name}-${screen}.png`, fullPage: true });
      }
      await context.close();
    });
  }

  if (preview) {
    await step('works offline after the first visit', async () => {
      const { page, context } = await app.open();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload();
      check((await page.locator('h1').textContent()) === HEADING, 'the app did not load offline');
      await context.close();
    });

    await step('a new deploy reaches an already open page', async () => {
      const { page, context } = await app.open();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.evaluate(() => (window.oldPage = true));
      // A changed sw.js is what a deploy looks like to the browser.
      const worker = 'dist/sw.js';
      const original = readFileSync(worker, 'utf8');
      appendFileSync(worker, `\n// deploy ${Date.now()}\n`);
      try {
        const reloaded = page.waitForEvent('load', { timeout: 10_000 }).catch(() => null);
        // What a phone does when the user returns to a suspended page.
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        check((await reloaded) !== null, 'the open page never switched to the new version');
        check((await page.evaluate(() => window.oldPage)) === undefined, 'the page was not reloaded');
      } finally {
        writeFileSync(worker, original);
      }
      await context.close();
    });
  }

  check(app.errors.length === 0, `console errors:\n${app.errors.join('\n')}`);
  console.log(`smoke passed (${preview ? 'preview' : 'dev'})`);
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
