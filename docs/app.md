# The app

What holds for the app as a whole rather than one screen: the about page,
offline mode, how a new version arrives, and the version shown (plan,
stage 9; decisions 18 and 73–77 of the plan).

## The about page

Route `#/about` (`src/views/about.ts`), "О приложении". The footer's link
"Источники и лицензии" opens it from every screen, and so does the last link
of the settings. It holds:

- what the app is, that it works offline and installs on a phone, and that
  the progress lives in this browser only (no backup, decision 11);
- **the sources** — the attribution CC BY-SA and CC BY ask for. Each source
  by its own name, a link to it, what it gave, and the license of what ships:
  Wiktionary and FrequencyWords (CC BY-SA 4.0), Twemoji (CC BY 4.0). Hspell
  and pymorphy3 are used by the build scripts only, nothing of them ships, so
  they have no license line. Names, addresses and licenses are constants of
  the view; what each source gave is in `src/texts.ts`;
- **the licenses**: the verb data CC BY-SA 4.0, the code GPL-3.0-or-later,
  the source code on GitHub;
- **the version**: "1.0.0 от 26.11.2026".

## The version

`package.json`'s version and a date, both injected by Vite (`vite.config.ts`:
`__APP_VERSION__`, `__APP_DATE__`) and passed to the app by `src/main.ts`
(`AppOptions.build`, so tests give their own).

The date is not the build's: it is the date of the last commit that changed
what ships (`src/` without the tests, `public/`, `index.html`). A build date
would change the bundle on every build, so a docs-only commit to `main`
would ship a "new" version and every phone would download the data again.
With the commit date the same commit always builds the same files. CI
checks out the whole history for it (`fetch-depth: 0`); without git the date
is today's.

## Offline

The service worker (`src/sw-plugin.ts`, the convention in
`~/projects/_conventions/pwa.md`) precaches the whole build on its first
visit: the page, the bundle, the verb data and the pictures' list
(`assets/*.json`), the own drawings (`pictures/<id>.svg`, Hebrew file
names), the Twemoji copies (`twemoji.json`, loaded only where the font lacks
an emoji) and the icons. After that everything works without the network.
The preview smoke checks it on a phone: the home page, a round, a drawing,
the Twemoji copies and the about page, all offline.

## A new version

Phones suspend a page rather than close it, so the app asks for a new
service worker every time the page returns to the foreground
(`src/pwa.ts`). A new worker takes control at once (`skipWaiting`), and the
page reloads to run the new version.

The reload never interrupts an exercise (decision 74): during a game or a
meeting (`isExercise` in `src/routes.ts`, the same routes that hide the
header's links) it waits for the route change that leaves it, then reloads
on the new screen. The answers are saved one by one anyway; what the wait
keeps is the round in progress. The old page may run on under the new
worker because it loads no hashed asset after its start: the data is
fetched once, the drawings and the Twemoji copies keep their names from
version to version.
