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

## Commands

Node.js — the version in `.node-version` (`fnm use`; check `node -v`).

- `npm ci` — install dependencies.
- `npm run dev` — dev server.
- `npm run check` — typecheck + oxlint + prettier + unit tests. Must pass before
  any work is called done.
- `npm run smoke` — browser smoke on the dev server (port 5397); `-- --preview`
  builds and also checks offline mode (port 4397); `-- --shots` saves
  screenshots to `shots/`.
- `npm run build` — typecheck and build into `dist/`.
- `npm run format` — prettier.
- `npm run icons` — render the PWA PNG icons from `public/icon.svg`.

CI (`.github/workflows/ci.yml`) runs `check` and the preview smoke on every
push and PR; a push to `main` publishes `dist/` to GitHub Pages.

## Data scripts

Run with Node, no npm script; each file's header says how. They read the
downloaded sources in `.cache/` (git-ignored, ~40 MB) and write their results
there. A fresh clone first runs `sh scripts/fetch-sources.sh` (curl, perl,
iconv; seconds, network-bound), then `node scripts/verb-frequency.mjs`; Wiktionary pages are
fetched on demand and cached in `.cache/wikt/`.

- `scripts/fetch-sources.sh` — downloads FrequencyWords and Hspell, turns
  Hspell's generators into UTF-8 word lists in `.cache/dl/`.
- `scripts/verb-frequency.mjs` — ranks Hspell's verbs by the OpenSubtitles
  frequencies of their forms; the top needs a manual pass (nouns slip in).
- `scripts/lib/conjugate.mjs` — the model conjugator: root + binyan + flags →
  forms in classical nikud and plene spelling. Its header lists the flags and
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
  frequent verbs with binyan, root and flags from Wiktionary, `--summary`
  prints one line per differing verb.
- `scripts/probe/wiktionary-coverage.mjs` — how many of the top verbs have a
  Wiktionary table.

What costs what: `fetch-sources.sh` — seconds (network); `verb-frequency.mjs` ~0.5 s;
`wiktionary.mjs` ~0.5 s per uncached page (a polite delay); `compare.mjs` ~0.3 s;
`conjugator-golden.mjs` ~0.5 s.

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

- `src/main.ts` — entry: starts the app, registers the service worker in
  production.
- `src/app.ts` — DOM wiring and rendering.
- `src/texts.ts` — every interface text (Russian).
- `src/storage.ts` — versioned, validated settings in localStorage.
- `src/sw-plugin.ts` — Vite plugin emitting `sw.js` that precaches the build;
  `src/pwa.ts` — its registration, an update check on every return to the
  page and a reload when a new version takes control (`_conventions/pwa.md`).
- `src/style.css` — mobile first, logical properties, light and dark.
- `public/` — manifest, icons (`icon.svg` is the source).
- `scripts/lib/harness.mjs` — Playwright plumbing; `scripts/smoke.mjs` — the
  smoke; `scripts/icons.mjs` — icon rendering.
- `docs/` — user and design docs; `plans/` — plans and reports (Russian).

## Invariants

- **No i18n**: the interface is Russian only, deliberately. Every text lives
  in `src/texts.ts`; `index.html` repeats only what shows before the script
  runs, and a test keeps them equal.
- Verb forms are shown in **classical nikud** (דִּבֵּר); without nikud — the
  Academy's plene spelling (דיבר), derived from the nikud by rules and checked
  against Hspell. Never strip nikud to get the plain form.
- Hebrew inside Russian text is isolated (`dir`/`unicode-bidi`), see the RTL
  lessons in `~/projects/CLAUDE.md`.
- The verb data is CC BY-SA 4.0 (Wiktionary, FrequencyWords), the code
  GPL-3.0-or-later; Hspell (AGPL) is used by build scripts only and nothing of
  it ships.

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
- A helper script that may be needed again goes to `scripts/` with a header
  comment and a line in this file. A new browser check is a step or a flag in
  `scripts/smoke.mjs`, not a new file.
- Stages 0–1 went straight to `main`; from stage 2 on, each feature gets its
  own branch and a pull request.
