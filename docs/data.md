# Verb data

How the app's verb data is made, what it holds and how to change it. The
decisions behind it are in the plan (`plans/2026-11-24-hebrew-verbs.md`,
decisions 15–31) and the stage 2 report (`plans/2026-11-24-stage2-progress.md`).

## Pipeline

```
FrequencyWords + Hspell ──verb-frequency.mjs──▶ ranking (.cache/)
ranking + Wiktionary ──verb-list.mjs + a person──▶ data/verbs.tsv, data/not-verbs.tsv
data/verbs.tsv ──lib/conjugate.mjs (+ data/tables.tsv by hand)──▶ forms, translit
data/ru.tsv (by hand) ──ru-forms.py (pymorphy3)──▶ data/ru-forms.json
all of data/ ──build-verbs.mjs──▶ src/data/verbs.json (the app reads only this)
```

Only the first two steps need the downloaded sources in `.cache/`
(`scripts/fetch-sources.sh`). Everything the app needs is committed:
`build-verbs.mjs` runs from `data/` alone, with no network and no Python.

## Files

| File                  | What                                                                                                           | Made by                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `data/verbs.tsv`      | the 1000 verbs, most frequent first: lemma (the id), frequency, binyan, root, conjugator flags, note           | `verb-list.mjs`, then a person    |
| `data/not-verbs.tsv`  | frequent candidates that are not verbs to learn, with the reason                                               | a person                          |
| `data/tables.tsv`     | hand tables of the verbs the conjugator does not build (יכול, חי, ניגש), with translit                         | a person                          |
| `data/ru.tsv`         | translations (the first is the main one), the aspect pair for phrases, a feminine pair where Russian needs one | a person                          |
| `data/ru-forms.json`  | Russian forms of those pairs                                                                                   | `scripts/ru-forms.py`             |
| `data/hspell.tsv`     | Hspell's spellings of the listed verbs — a test fixture (AGPL), never shipped                                  | `compare.mjs --list … --snapshot` |
| `src/data/verbs.json` | the app's data, one verb a line                                                                                | `scripts/build-verbs.mjs`         |

A line of `data/verbs.tsv` whose note starts with `by hand:` or `checked:` is
a person's decision: `verb-list.mjs` keeps it as is.

## Changing a verb

1. Edit `data/verbs.tsv` (binyan, root, flags; `override` and `variants` for
   single forms), `data/tables.tsv` or `data/ru.tsv`.
2. After a change of `ru.tsv`: `.cache/venv/bin/python scripts/ru-forms.py`
   (set the venv up once: the script's header).
3. `node scripts/build-verbs.mjs`.
4. A spelling change: `node scripts/probe/compare.mjs --conjugator --list
data/verbs.tsv --summary` against the sources, and `--snapshot
data/hspell.tsv` if the verb list changed.
5. `npm run check`: it fails on a stale `ru-forms.json` or `verbs.json`.

## The data

The shape is the `Verb` type in `src/verbs.ts`; `parseVerbs` checks it when
the data is read. Per verb: `id` (the past 3ms in plene spelling — statistics
are kept by it, never change it), `rank`, `binyan`, `root`, `ru`, `lemma`
(the infinitive, or the past 3ms for a verb without one), the tenses and
`ruForms`. A tense a verb lacks is absent: היה has no present, נהיה and אירע
no future, pual, hufal and יכול no infinitive.

A form is `{ nikud, plain, variants?, translit }`:

- `nikud` — classical (defective) nikud: דִּבֵּר.
- `plain` — the Academy's plene spelling as Hspell writes it: דיבר. Built
  from the conjugator's segments, never by stripping nikud; the data test
  checks it is the nikud's letters plus vowel letters ו/י, and Hspell's.
- `variants` — other accepted spellings, e.g. the literary infinitive לאמור.
- `translit` — Cyrillic as Israelis speak: ח and כ are х, ה is a Latin h
  (леhагид), ל before a consonant or at the end is ль, е after a consonant,
  э elsewhere (шоэль, леэхоль); a sheva sounds only where speech sounds it
  (медабрим, ихтеву); paal past 2nd plural катавтем; hufal prefix hу-.

The future 2fp/3fp are the spoken forms (= 2mp/3mp); the literary -נָה forms
are in `futureLiterary`, for the dictionary only.

## Russian forms

`ruForms` gives the phrase after an answer ("ты (ж.) ела / съела"):

- An ordinary verb: `ipf`, `pf?`, `present` by person (1s…3p), `past` by
  gender (m, f, pl) for both aspects, `future.pf` by person. The compound
  future is not stored: the app says "будешь" + `ipf`; only `быть` has its own
  `future.ipf` (буду).
- `f` — a pair for a woman where Russian says it otherwise: התחתן is "он
  женился", "она вышла замуж".
- A passive or a state (`short` instead of tenses): the short form by gender,
  "приглашён / приглашена / приглашены"; the app adds был / была / буду.

Russian person and gender come from the Hebrew pronoun: я (м.) / я (ж.) →
1s with m / f, ты (м.) / ты (ж.) → 2s, он / она → 3s, мы → 1p, вы → 2p,
они → 3p; the plural past takes pl.

## Licences

The verb data is CC BY-SA 4.0 (Wiktionary, FrequencyWords); the app's code
GPL-3.0-or-later. Hspell (AGPL) and pymorphy3 (MIT) are used by the scripts
and tests only; nothing of them ships.
