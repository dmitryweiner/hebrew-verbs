# The menorah of the binyanim

Plan, section 4; decisions 59–63 of the plan. Routes: `#/menorah` (the
menorah alone, "Нажмите на ветвь…") and `#/menorah/<binyan>` (the menorah
with that binyan's card under it); a link "Биньяны" in the header opens it
from any screen but a game, and a verb's card links its binyan here.

## The menorah

`src/views/menorah.ts`. Seven branches, as in the teaching "menorah of the
binyanim": hitpael in the middle; on the right the active binyanim, from
the middle out hifil, piel, paal; on the left their passives mirrored on
the same arc: hufal, pual, nifal (`MENORAH`, `PAIR` in `src/binyanim.ts`).
The order is the menorah's in both directions of text (`direction: ltr` on
the branches).

Each branch is a link: the name in Hebrew (always with nikud: the vowels are
the point), in Russian, and a flame in the colour of its kind — action,
passive, reflexive (`BINYAN_KIND`; `--active`, `--passive`, `--reflexive`
in `src/style.css`, light and dark). The branches are seven equal columns
over an SVG of the arms whose box is 700 wide with the arms 100 apart, so
each flame stands on its arm at any width (the smoke measures it). The
chosen branch is marked (`aria-current`), its arm coloured.

## A binyan's card

Under the menorah: the names, the kind, the meaning, the link to its pair
("Его страдательный — пуаль", "Страдательный к пиэль"), the features, the
model forms on פ־ע־ל, three to five examples and the number of the
dictionary's verbs in the binyan.

- **Texts** — `texts.menorah.binyanim` in `src/texts.ts`. Hebrew inside
  them is plain text; the view isolates every Hebrew run (`withHebrew` in
  `src/dom.ts`). A test (`src/binyanim.test.ts`) finds every Hebrew word of
  them in the data — a form of a dictionary verb or a model form, in either
  spelling; prefixes (נִ־), single letters and roots (נ־ג־ע) aside — so a
  typo in the nikud fails.
- **Model forms** (decision 60) — the infinitive (none in pual and hufal),
  the four of the present, of the past он, она, я, они, of the future я,
  он, ты (ж.), они: where the stem changes, not the endings every binyan
  shares. `BINYAN_MODELS` in `src/binyanim.ts` holds them as the
  conjugator gives them for פ־ע־ל (`scripts/lib/binyanim.test.mjs` keeps
  them equal), so the model shows the guttural ע as it is: יִפְעַל in paal,
  no dagesh in piel; the features say so. Spelling and transliteration
  follow the settings.
- **Examples** (decision 61) — `BINYAN_EXAMPLES`, chosen by hand: frequent
  verbs with a strong root, where the model shows as it is (the most
  frequent paal verbs, היה, ידע, עשה, are all irregular); hitpael's also
  show the swap of ת (הִסְתַּכֵּל). Each is a link to its card; a test keeps
  them in the dictionary and in their binyan.
