# Agents guide

Глаголы иврита — a trainer of the ~1000 most frequent Hebrew verbs for
Russian speakers. A static, offline-capable web app: TypeScript + Vite, no
framework, tests on Vitest (node and jsdom) and a Playwright smoke. The
interface is in Russian only. Deployed to GitHub Pages.

The shared conventions behind this setup are in `~/projects/CLAUDE.md` and
`~/projects/_conventions/`; this file is what holds for this repository.

## Plans

- `plans/2026-11-24-hebrew-verbs.md` — the app plan, decisions, stages 0–9.
- `plans/2026-11-24-stage0-report.md` — stage 0: data sources checked on
  100 verbs; the conjugator approach.
- `plans/2026-11-24-stage2-progress.md` — stage 2 (data pipeline): progress
  and the decisions taken on the way.
- `plans/2026-11-24-stage2a-progress.md` — stage 2a (illustrations): the
  style, the batches and their review.

## Commands

Node.js — the version in `.node-version` (`fnm use`; check `node -v`).

- `npm ci` — install dependencies.
- `npm run dev` — dev server.
- `npm run check` — typecheck + oxlint + prettier + unit tests. Must pass before
  any work is called done.
- `npm run smoke` — browser smoke on the dev server (port 5397): the home
  page, a `he-ru` round to its results, a `past-person` round on a phone, a
  typed answer on a phone, a dictionary search by a form and its card on a
  phone, the menorah on a phone (flames on their arms, a binyan's card, an
  example's card), the progress page on a phone (a played game's tiles, a
  hard verb's card, the reset), no horizontal scroll on the home, settings,
  dictionary (all, a form found), card, menorah (alone, hitpael's card),
  progress and game screens (`he-ru`, `write`, `present-form`,
  `future-person`), the canvas emoji test (dev only); `-- --preview` builds and also checks offline mode and an
  update (port 4397); `-- --shots` saves `shots/<viewport>-<screen>.png`.
- `npm run build` — typecheck and build into `dist/`.
- `npm run format` — prettier.
- `npm run icons` — render the PWA PNG icons from `public/icon.svg`.
- `npm run review:pictures` — the illustrations' review page on a dev server
  (port 5398): http://localhost:5398/review-pictures.

CI (`.github/workflows/ci.yml`) runs `check` and the preview smoke on every
push and PR; a push to `main` publishes `dist/` to GitHub Pages.

## Data scripts

Run with Node, no npm script; each file's header says how. The pipeline, the
files and the data format: `docs/data.md`. The probes read the downloaded
sources in `.cache/` (git-ignored, ~40 MB) and write their results there; the
app's data (`data/` → `src/data/verbs.json`) is committed and builds without
them. A fresh clone first runs `sh scripts/fetch-sources.sh` (curl, perl,
iconv; seconds, network-bound), then `node scripts/verb-frequency.mjs`;
Wiktionary pages are fetched on demand and cached in `.cache/wikt/`;
`scripts/ru-forms.py` needs a venv with pymorphy3 (its header).

After changing `data/`: `ru-forms.py` (if `ru.tsv` changed), then
`build-verbs.mjs`, then `npm run check` — it fails on a stale output.

- `scripts/fetch-sources.sh` — downloads FrequencyWords and Hspell, turns
  Hspell's generators into UTF-8 word lists in `.cache/dl/`.
- `scripts/verb-frequency.mjs` — ranks Hspell's verbs by the OpenSubtitles
  frequencies of their forms; the top needs a manual pass (nouns slip in).
- `scripts/verb-list.mjs` — drafts and refreshes the verb list `data/verbs.tsv`
  (the source of truth: lemma, frequency, binyan, root, flags, note) from the
  ranking and Wiktionary, keeping the lines a person decided (note `by hand:`
  or `checked:`); skips `data/not-verbs.tsv`. `data/tables.tsv` holds the hand
  tables of verbs the conjugator does not build (`manual` flag).
- `scripts/lib/verbs.mjs` — reads the list and the hand tables, gives a listed
  verb's forms; `verbs.test.mjs` checks the list (part of `npm test`).
- `scripts/lib/translit.mjs` — Cyrillic transliteration as spoken, from the
  conjugator's segments (`translit` of every form; hand tables carry their own).
- `data/ru.tsv` — Russian by hand: translations, the ipf/pf pair for phrases
  (passives as "быть приглашённым"). `scripts/ru-forms.py` (pymorphy3 in
  `.cache/venv`, header says how) checks aspects and writes `data/ru-forms.json`
  (generated, committed, so the build needs no Python; rerun after every
  change of `ru.tsv` — `verbs.test.mjs` fails on a stale pair).
- `scripts/probe/translit.mjs` — the transliteration for a person to look
  over after a rule change: odd forms (`--odd`), a sample table (`--every N`).
- `scripts/probe/wiktionary-glosses.mjs` — English glosses of the listed verbs
  from the cached Wiktionary pages, a reference for the translations.
- `scripts/build-verbs.mjs` — the app's data `src/data/verbs.json` (the
  `Verb` type of `src/verbs.ts`) from the list, the hand tables, `ru.tsv` and
  `ru-forms.json`; committed, one verb a line; `--check` fails when it is not
  up to date (`verbs.test.mjs` runs it). Rerun after any change of `data/`.
- `scripts/review-list.mjs` — writes the list's review page (HTML, Russian)
  for a person to approve; `--ru` — the translations' page (translit, pair,
  three phrases, a comment per marked row).
- `scripts/lib/conjugate.mjs` — the model conjugator: root + binyan + flags →
  forms in classical nikud, plene spelling and Cyrillic (`translit.mjs`). Its header lists the flags and
  what is not covered yet. Tested by `scripts/lib/conjugate.test.mjs` against
  `conjugate.golden.json` (part of `npm test`); a verb marked `todo` there is a
  known gap and skipped.
- `scripts/lib/wiktionary-flags.mjs` — binyan, root and conjugator flags from
  the parameters of a Wiktionary `{{he-conj}}` table; tested on the golden verbs.
- `scripts/conjugator-golden.mjs` — writes that golden fixture from the
  Wiktionary tables (nikud) and Hspell (plain spelling) of the given sample
  lists, with the plan's decisions applied; keeps the `todo` marks.
- `scripts/probe/wiktionary.mjs` — fetches and parses the Wiktionary
  `{{he-conj}}` tables of a sample list.
- `scripts/probe/compare.mjs` — Wiktionary vs Hspell vs the conjugator, form
  by form; `--sample` picks the list (`sample-50.tsv` — the conjugator was
  written on it, `holdout-50.tsv` — check only); `--top N` takes the N most
  frequent verbs with binyan, root and flags from Wiktionary, `--list
data/verbs.tsv` the verb list (no Wiktionary table: Hspell spelling only);
  `--summary` prints one line per differing verb; `--snapshot data/hspell.tsv`
  (with `--list`) rewrites Hspell's spellings that `src/data/verbs.test.ts`
  checks the data against.
- `scripts/probe/wiktionary-coverage.mjs` — how many of the top verbs have a
  Wiktionary table.

Illustrations (plan 1.4, `docs/data.md` "Illustrations"):

- `src/data/pictures.json` — a verb's picture (emoji, own drawing
  `public/pictures/<id>.svg`, or none) and its review; one verb a line,
  written by `scripts/lib/pictures.mjs`; `src/data/pictures.test.ts` holds
  the drawing rules.
- `scripts/review-pictures.mjs` (`npm run review:pictures`) — the review page
  on the dev server; a decision is written to `pictures.json` at once.
- `scripts/set-pictures.mjs` — sets a batch's entries from `<id> <emoji | svg
| none>` lines on stdin, approved (`--review pending` to ask for a review).
- `scripts/fetch-emoji.mjs` — Twemoji copies of the emoji into one file,
  `public/twemoji.json` (network), drops the unused ones; rerun after
  changing emoji.

What costs what: `fetch-sources.sh` — seconds (network); `verb-frequency.mjs` ~0.5 s;
`wiktionary.mjs` ~0.5 s per cached page, ~2.5 s per lemma uncached (up to three
titles, a polite delay; the top 1400 took ~70 min); `compare.mjs` ~0.3 s
(`--list` ~1 s); `conjugator-golden.mjs` ~0.5 s; `verb-list.mjs` ~0.3 s; `review-list.mjs` ~0.3 s; `ru-forms.py` ~1.5 s; `build-verbs.mjs` ~0.2 s; `probe/translit.mjs` ~0.2 s;
`fetch-emoji.mjs` ~0.3 s per new emoji (network); `set-pictures.mjs` ~0.1 s;
`review:pictures` starts in ~1 s. The app: a task (`makeQuestion`) ~0.2 ms for
`he-ru`/`ru-he` (distractors scan all verbs), ~0.005 ms for a tense game;
the dictionary's index (`searchIndex`) ~50 ms once, a query 0.2–3 ms;
`npm run check` ~5 s, of it the whole-data task test ~1 s and the app's
jsdom tests ~0.4 s — CI's runner is ~2.5× slower and vitest's timeout is
5 s, so keep a test well under 2 s; `npm run smoke` ~5 s, `-- --preview`
~7 s with the build.

## Test-driven development is mandatory

Every behaviour change goes red → green → refactor:

1. Write a failing test that describes the new behaviour or reproduces the bug.
   Run it and see it fail for the expected reason.
2. Write the minimal code that makes it pass.
3. Refactor with the tests green.

Pure logic → `*.test.ts` in node; anything touching the DOM → jsdom
(`// @vitest-environment jsdom`, the real `index.html`); what needs a real
browser (service worker, layout, workers) → a step in `scripts/smoke.mjs`.

## Layout

- `src/main.ts` — entry: fetches the data files (`?url` imports of
  `src/data/*.json`), starts the app with the browser's storage, speech and
  emoji support, registers the service worker in production.
- `src/app.ts` — loads and checks the data, keeps the saved state, shows the
  view of the hash route; `src/routes.ts` — the routes (`#/`, `#/settings`,
  `#/part/1/he-ru`, `#/part/2/form`, `#/dict?q=…`, `#/dict/<id>`, `#/menorah`,
  `#/menorah/<binyan>`, `#/progress`).
- `src/views/` — `home.ts` (the parts and each game's progress), `game.ts`
  (all nine games: a round, its feedback and results), `settings.ts`,
  `dictionary.ts` (the search and its results), `verb.ts` (a verb's card),
  `menorah.ts` (the menorah of the binyanim and a binyan's card),
  `progress.ts` (every game's progress, its hardest verbs, the reset of one
  game), `reset.ts` (a reset asked under its button, decision 57),
  `picture.ts` (emoji, Twemoji copy or drawing), `listen.ts` (🔊 buttons and
  the no-voice line); `context.ts` — what a view gets from the app;
  `src/dom.ts` — element builder, an isolated Hebrew word, the Hebrew runs
  of a Russian text isolated (`withHebrew`).
- `src/round.ts` — a round: its tasks, the answers, the round of mistakes.
- `src/speech.ts` — the Hebrew voice of `speechSynthesis`; `src/emoji.ts` —
  the canvas test whether the font draws an emoji, the Twemoji copies.
- `src/texts.ts` — every interface text (Russian).
- `src/storage.ts` — versioned, validated settings and statistics in
  localStorage (version 3: the `autoNext` setting; version 2 is read as it
  is, version 1's settings are kept).
- The core without the DOM (stage 3): `src/hebrew.ts` — nikud, final
  letters, typed input; `src/persons.ts` — pronouns and the persons of each
  tense (я (м.) / я (ж.) everywhere, decision 35), their labels and the
  phrase "pronoun + form"; `src/phrases.ts` — the Russian phrase after an
  answer; `src/games.ts` — the nine games and their verb pools; `src/stats.ts` — a game's statistics and weights;
  `src/selection.ts` — the open verbs, the frontier and the round;
  `src/progress.ts` — a game's progress for the progress page;
  `src/questions.ts` — the tasks, exactly one right option in the spelling
  shown (decision 37); `src/answer.ts` — a typed headword. The rules:
  `docs/games.md`. `src/search.ts` — the dictionary's search (by any form,
  root or Russian, `docs/dictionary.md`); `src/binyanim.ts` — the binyanim's
  Hebrew names, the menorah's branches and pairs, the model forms on פ־ע־ל
  (the conjugator's, `scripts/lib/binyanim.test.mjs` keeps them equal) and
  the examples (`docs/menorah.md`).
- `src/testing.ts` — the real verb data for unit tests (node and jsdom tests;
  reads the file, never shipped).
- `src/pictures.ts` — the illustrations' types, `parsePictures` and
  `pictureOf` (only approved pictures reach the app).
- `src/verbs.ts` — the verb data's types and `parseVerbs` (a shape check, so
  the data is read without casts); `src/data/verbs.json` — the data (~3 MB,
  ~410 KB gzip; the app fetches it and `pictures.json` as JSON files, which
  the service worker precaches, decision 44), `src/data/verbs.test.ts` — its
  test.
- `src/sw-plugin.ts` — Vite plugin emitting `sw.js` that precaches the build;
  `src/pwa.ts` — its registration, an update check on every return to the
  page and a reload when a new version takes control (`_conventions/pwa.md`).
- `src/style.css` — mobile first, logical properties, light and dark.
- `public/` — manifest, icons (`icon.svg` is the source); `pictures/` — own
  drawings, `twemoji.json` — Twemoji copies.
- `scripts/lib/harness.mjs` — Playwright plumbing; `scripts/smoke.mjs` — the
  smoke; `scripts/icons.mjs` — icon rendering.
- `data/` — the hand-curated verb list, its exclusions, hand tables and
  Russian (TSV), `ru-forms.json` (generated) and `hspell.tsv` (a test
  fixture); the app's generated data is in `src/data/`.
- `docs/` — user and design docs (`docs/data.md` — the verb data,
  `docs/games.md` — the games' rules, how the app shows them and the progress page,
  `docs/dictionary.md` — the search and the card, `docs/menorah.md` — the
  menorah); `plans/` —
  plans and reports (Russian).

## Invariants

- **No i18n**: the interface is Russian only, deliberately. Every text lives
  in `src/texts.ts`; `index.html` repeats only what shows before the script
  runs, and a test keeps them equal.
- Verb forms are shown in **classical nikud** (דִּבֵּר); without nikud — the
  Academy's plene spelling (דיבר), derived from the nikud by rules and checked
  against Hspell. Never strip nikud to get the plain form.
- Hebrew inside Russian text is isolated (`dir`/`unicode-bidi`), see the RTL
  lessons in `~/projects/CLAUDE.md`: views build a Hebrew word with
  `hebrewWord` (`src/dom.ts`), never as bare text.
- The verb data is CC BY-SA 4.0 (Wiktionary, FrequencyWords), the code
  GPL-3.0-or-later; Hspell (AGPL) is used by build scripts and as a test
  fixture (`data/hspell.tsv`) only; nothing of it ships. The Twemoji copies in
  `public/twemoji.json` are CC BY 4.0 (attribution in README).

## Conventions

- Code comments, docs and README in English; plans in Russian.
- Pure logic lives in modules without the DOM; time, randomness, storage and
  browser APIs are parameters so tests can replace them.
- The package name in `package.json` is the app id: Vite injects it as
  `__APP_ID__`, the storage key and the service worker's cache prefix. All
  apps on `<user>.github.io` share one origin, so it must be unique.
- Do not change the stored format without bumping `VERSION` in
  `src/storage.ts` and a test for the reset or migration.
- No `as` casts in app code; a disabled lint rule carries its reason.
- Scripts import the app's pure modules straight from `src/*.ts` (Node 24
  strips the types: `scripts/lib/pictures.mjs` uses `src/pictures.ts`), so
  the logic is not copied; such a module keeps to erasable TypeScript (no
  `enum`, no parameter properties).
- A helper script that may be needed again goes to `scripts/` with a header
  comment and a line in this file. A new browser check is a step or a flag in
  `scripts/smoke.mjs`, not a new file.
- Stages 0–1 went straight to `main`; from stage 2 on, each feature gets its
  own branch and a pull request.
