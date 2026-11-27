// Browser smoke of the real app: the home page renders with the verb data,
// a round of a part-1 game and of a tense game run to their results, each
// after meeting its verbs (the answer's card as wide as the options), a meeting of part 3 leads to its game, a typed
// answer is taken, the dictionary finds a verb by a form and opens its card,
// the menorah opens a binyan and leads to an example's card, the progress
// page shows a played game and resets it, the about page gives the sources
// and the version, no horizontal scroll on a phone (home, game, dictionary,
// card, menorah, progress and about screens), the menorah's arms meet its
// branches, no console errors. In dev it also checks the canvas emoji test.
// With --preview it runs against a fresh production build and also checks
// that the service worker makes the app work offline on a phone (a round,
// the drawings, the Twemoji copies), that a new deploy reaches a page that is
// already open (phones suspend pages, never close them), and that it waits
// while a game is played.
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

/** Says "Понятно" to every verb a round or a meeting shows before its tasks. */
async function meetAll(page) {
  await page.locator('.meet-next, .option, .answer-input').first().waitFor();
  const next = page.locator('.meet-next');
  // The next card is drawn at the click: count needs no wait here.
  while ((await next.count()) > 0) await next.click();
}

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
    // A first round: ten verbs never met, a card each before the tasks.
    await page.locator('.meet-card').waitFor();
    // A game and its meeting hide the header's links (decision 55).
    check(!(await page.locator('.dict-link').isVisible()), 'the header shows its links in a game');
    await meetAll(page);
    // The answer's card takes the right option's place, across both columns of options (decision 79).
    await page.locator('.option').first().click();
    const [card, grid] = await Promise.all([page.locator('.feedback').boundingBox(), page.locator('.options').boundingBox()]);
    check(card && grid && Math.abs(card.width - grid.width) < 1, `the answer's card is ${card?.width}px wide of ${grid?.width}px`);
    await page.locator('.next').click();
    for (let i = 1; i < 10; i++) await answerFirst(page);
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

  await step('a past-person round on a phone runs to its results, each task a phrase', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(`${app.base}#/part/3/person`);
    await meetAll(page);
    for (let i = 0; i < 10; i++) {
      await page.locator('.option').first().waitFor();
      check((await page.locator('.option').count()) === 4, `task ${i + 1} has not four options`);
      await answerFirst(page);
    }
    await page.locator('.summary').waitFor();
    check((await page.locator('.results li .he').count()) === 10, 'the results do not list ten phrases');
    const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hebrew-verbs') ?? '{}').stats ?? {}));
    check(stored.includes('past-person'), 'the answers were not saved');
    await context.close();
  });

  await step('the write game takes a typed answer on a phone', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(`${app.base}#/part/1/write`);
    await meetAll(page);
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

  await step('a meeting of part 3 on a phone shows each verb with its past, then leads to its game', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(app.base);
    await page.locator('.meet-link[href="#/part/3/intro"]').click();
    await page.locator('.meet-card .forms').waitFor();
    check((await page.locator('.meet-card .forms tr').count()) === 9, 'the past table has not nine rows');
    await meetAll(page);
    await page.locator('.summary').waitFor();
    check((await page.locator('.results li').count()) === 10, 'the meeting did not show ten verbs');
    await page.locator('.summary .check').click();
    // The round asks the ten verbs just met: no meeting first.
    await page.locator('.option').first().waitFor();
    check((await page.locator('.meet-card').count()) === 0, 'the round met verbs already met');
    await context.close();
  });

  await step('the dictionary finds a verb by a form on a phone and opens its card', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(app.base);
    await page.locator('.dict-link').click();
    // The full list first: 1000 verbs drawn at once.
    await page.locator('.dict-results li').first().waitFor();
    check((await page.locator('.dict-results li').count()) >= 1000, 'the empty search does not list every verb');
    const started = Date.now();
    await page.locator('.dict-search input').fill('אכלתי');
    await page.locator('.dict-results li .hit').first().waitFor();
    const took = Date.now() - started;
    check(took < 1000, `the search took ${took} ms`);
    check(decodeURIComponent(new URL(page.url()).hash) === '#/dict?q=אכלתי', 'the query is not in the hash');
    await page.locator('.dict-results a').first().click();
    await page.locator('.tense-past tbody tr').first().waitFor();
    check((await page.locator('h1 .he').textContent()) === 'לֶאֱכֹל', 'the card is not of לאכול');
    check((await page.locator('.verb-page .listen').count()) === 24, 'the card has not a 🔊 per form');
    await page.locator('.verb-page .back').click();
    check((await page.locator('.dict-search input').inputValue()) === 'אכלתי', 'the card does not lead back to the search');
    await context.close();
  });

  await step('the menorah opens a binyan on a phone, its arms under the branches, an example leads to its card', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(app.base);
    await page.locator('.menorah-link').click();
    await page.locator('.menorah .branch').first().waitFor();
    check((await page.locator('.menorah .branch').count()) === 7, 'the menorah has not seven branches');
    // Each flame stands over the top of its arm: the columns and the SVG share one grid.
    const offsets = await page.evaluate(() => {
      const svg = document.querySelector('.menorah-arms');
      const box = svg.getBoundingClientRect();
      const scale = box.width / 700;
      return [...document.querySelectorAll('.menorah .flame')].map((flame, i) => {
        const r = flame.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - (box.left + (50 + 100 * i) * scale)) + Math.abs(box.top - r.bottom);
      });
    });
    check(
      offsets.every((d) => d < 12),
      `the flames miss their arms by ${offsets.map((d) => Math.round(d)).join(', ')} px`,
    );
    await page.locator('.menorah .branch[href="#/menorah/piel"]').click();
    await page.locator('.binyan-card .model').waitFor();
    check((await page.locator('.binyan-card h2 .he').textContent()) === 'פִּעֵל', 'the card is not of piel');
    await page.locator('.binyan-card .examples a').first().click();
    await page.locator('.tense-past tbody tr').first().waitFor();
    check((await page.locator('h1 .he').textContent()) === 'לְדַבֵּר', 'the first example is not לדבר');
    await context.close();
  });

  await step('the progress page on a phone shows a played game, leads to a hard verb and resets the game', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.goto(app.base);
    await page.evaluate(() => {
      const stat = { shown: 3, correct: 1, wrong: 2, streak: 0, lastSeen: Date.now() };
      const settings = { nikud: true, translit: true, autoNext: false };
      localStorage.setItem(
        'hebrew-verbs',
        JSON.stringify({ version: 3, settings, stats: { 'he-ru': { open: 20, verbs: { ידע: stat } } } }),
      );
    });
    await page.reload();
    await page.locator('main .progress-link').click();
    const game = page.locator('.game-stats[data-game="he-ru"]');
    await game.locator('.tiles').waitFor();
    check((await page.locator('.game-stats').count()) === 9, 'the page has not nine games');
    check(
      (await game.locator('.tiles dd').allTextContents()).join(' | ') === '0 из 20 | 20 из 1000 | 33\u00a0% | 3',
      'the tiles are wrong',
    );
    await game.locator('.hardest a').click();
    await page.locator('.tense-past tbody tr').first().waitFor();
    check((await page.locator('h1 .he').textContent()) === 'לָדַעַת', 'the hard verb is not לדעת');
    await page.goBack();
    await game.locator('.reset').click();
    await game.locator('.reset-yes').click();
    await game.locator('.reset-status').filter({ hasText: 'сброшена' }).waitFor();
    const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hebrew-verbs') ?? '{}').stats ?? {}));
    check(stored.length === 0, 'the game was not reset');
    await context.close();
  });

  await step('the about page opens from the footer on a phone: the sources, their licenses and the version', async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
    await page.locator('footer .about-link').click();
    await page.locator('.about-meta').waitFor();
    check((await page.locator('.sources li').count()) === 5, 'the page has not five sources');
    check((await page.locator('.sources a.license').count()) === 3, 'the shipped sources have not their licenses');
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    const shown = await page.locator('.about-meta .version').textContent();
    check(shown?.startsWith(`${version} от `) && /\d{2}\.\d{2}\.\d{4}$/.test(shown), `the version reads "${shown}"`);
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
    await step(
      `no horizontal scroll on ${name} (${viewport.width}px): home, the games, settings, dictionary, a card, the menorah, progress, meetings, about`,
      async () => {
        const { page, context } = await app.open({ viewport });
        const screens = [
          ['home', '#/', 'h1'],
          ['he-ru', '#/part/1/he-ru', '.option'],
          ['write', '#/part/1/write', '.answer-input'],
          ['present-form', '#/part/2/form', '.option'],
          ['future-person', '#/part/4/person', '.option'],
          ['settings', '#/settings', '.toggle'],
          ['dictionary', '#/dict', '.dict-results li'],
          // A form of two tenses: the found forms under the verb.
          ['dictionary-form', `#/dict?q=${encodeURIComponent('אוכל')}`, '.hit'],
          // The longest translations and a picture: התחתן, "жениться, выходить замуж".
          ['card', `#/dict/${encodeURIComponent('התחתן')}`, '.forms'],
          ['menorah', '#/menorah', '.menorah .branch'],
          // The longest model forms: hitpael's.
          ['menorah-hitpael', '#/menorah/hitpael', '.binyan-card .model'],
          ['meeting', '#/part/1/intro', '.meet-card'],
          // The longest table: the future, the literary forms under two of its rows.
          ['meeting-future', '#/part/4/intro', '.meet-card .forms'],
          // After the games above: each answered one task.
          ['progress', '#/progress', '.game-stats .tiles'],
          // The repository's link is the longest line.
          ['about', '#/about', '.about-meta'],
        ];
        for (const [screen, hash, ready] of screens) {
          await page.goto(`${app.base}${hash}`);
          if (ready === '.option' || ready === '.answer-input') await meetAll(page);
          await page.locator(ready).first().waitFor();
          // A choice game is measured after an answer: the feedback is its widest screen.
          if (ready === '.option') await page.locator('.option').first().click();
          const width = await page.evaluate(() => document.documentElement.scrollWidth);
          check(width <= viewport.width, `${screen} is ${width}px wide`);
          if (shots) await page.screenshot({ path: `shots/${name}-${screen}.png`, fullPage: true });
        }
        await context.close();
      },
    );
  }

  if (preview) {
    await step('works offline on a phone after the first visit: a round, a drawing, the Twemoji copies, the about page', async () => {
      const { page, context } = await app.open({ viewport: VIEWPORTS.phone });
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload();
      check((await page.locator('h1').textContent()) === HEADING, 'the app did not load offline');
      await page.goto(`${app.base}#/part/1/he-ru`);
      await meetAll(page);
      await page.locator('.option').first().waitFor();
      check((await page.locator('.option').count()) === 4, 'a round did not start offline');
      // Own drawings are files with Hebrew names; the Twemoji copies, one file, load only where the font lacks an emoji.
      const [drawing, twemoji] = await page.evaluate(
        (paths) =>
          Promise.all(
            paths.map((path) =>
              fetch(new URL(path, document.baseURI)).then(
                (r) => (r.ok ? r.text() : ''),
                () => '',
              ),
            ),
          ),
        ['pictures/בא.svg', 'twemoji.json'],
      );
      check(drawing.startsWith('<svg'), 'an own drawing is not served offline');
      check(Object.keys(JSON.parse(twemoji || '{}')).length > 500, 'the Twemoji copies are not served offline');
      await page.goto(`${app.base}#/about`);
      await page.locator('.about-meta').waitFor();
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

  if (preview) {
    await step('a new deploy waits until the game is left (decision 74)', async () => {
      const { page, context } = await app.open();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.goto(`${app.base}#/part/1/he-ru`);
      await page.locator('.meet-card').waitFor();
      await page.evaluate(() => {
        window.oldPage = true;
        window.newWorker = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(true), { once: true }));
      });
      const worker = 'dist/sw.js';
      const original = readFileSync(worker, 'utf8');
      appendFileSync(worker, `\n// deploy ${Date.now()}\n`);
      try {
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        const changed = await page.evaluate(() => Promise.race([window.newWorker, new Promise((r) => setTimeout(() => r(false), 10_000))]));
        check(changed === true, 'the new version did not take control');
        // A reload would have started by now.
        await page.waitForTimeout(500);
        check((await page.evaluate(() => window.oldPage)) === true, 'the page reloaded in the middle of a game');
        const reloaded = page.waitForEvent('load', { timeout: 10_000 }).catch(() => null);
        await page.evaluate(() => (window.location.hash = '#/'));
        check((await reloaded) !== null, 'the page did not switch to the new version when the game was left');
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
