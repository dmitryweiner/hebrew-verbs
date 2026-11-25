# Games

The rules of the nine games as the core (`src/`, no DOM) implements them. The
decisions behind them are in the plan (`plans/2026-11-24-hebrew-verbs.md`,
sections 2–3 and 6, decisions 5–10, 13, 25–27, 35–37).

## The games

`src/games.ts`. Part 1 asks about the verbs, parts 2–4 about a tense each:

| Id               | Shows                               | Options / input                                         |
| ---------------- | ----------------------------------- | ------------------------------------------------------- |
| `he-ru`          | the headword                        | 4 verbs, shown by their translations                    |
| `ru-he`          | the translations                    | 4 headwords                                             |
| `write`          | the translations                    | the headword, typed                                     |
| `<tense>-form`   | headword, translation and a pronoun | 4 forms of the verb in the tense                        |
| `<tense>-person` | a form                              | 4 pronouns, each shown with that form (אַתְּ אָכַלְתְּ) |

`<tense>` is `present`, `past` or `future`. The headword is the infinitive, or
the past 3ms for a verb without one (pual, hufal, יכול). A game's pool is the
verbs that have its tense, most frequent first (`gamePool`): היה has no
present, נהיה and אירע no future.

## Persons

`src/persons.ts`. A person is a pronoun in a tense with its form's slot, its
Russian label (from `texts.persons`) and how a Russian phrase says it. я (м.)
and я (ж.) are two persons in every tense, even where Hebrew has one form
(decision 35). мы has a gender only in the present. Present: 12 persons;
past and future: 11 each.

## Which verbs, which round

`src/stats.ts`, `src/selection.ts`. Every game keeps its own statistics
(`GameStats`): `open`, the number of open verbs (the first of the pool), and
per verb id `shown`, `correct`, `wrong`, `streak` (correct in a row) and
`lastSeen`.

- 20 verbs open at the start. A verb is learned at a streak of 3, and a
  mistake unlearns it. When 80 % of the open verbs are learned, 10 more open
  (`advance`, called by `answer` after every answer). `open` never goes down.
- A round has 10 tasks (`pickRound`). At most 3 of its verbs are new to the
  game: the most frequent ones not yet seen. The rest are seen verbs, chosen
  by weight `1 + 4 · error rate + 3 · staleness` (taken from alef-bet). With
  too few verbs the round repeats them, never the same one twice in a row.
  The first round is the 3 most frequent verbs, 3–4 times each (decision 36).

## Tasks

`src/questions.ts`, `makeQuestion(game, verb, verbs, spelling, rng)`.
Exactly one option is right **in the spelling shown**: `nikud`, or `plain`
when the nikud setting is off (decision 37). A round's tasks are built for
the spelling the round started with, so the nikud switch lives outside a game.

- `he-ru`, `ru-he`: distractors are picked at random from the 20 verbs nearest
  in frequency. Where possible they are of the same kind (with or without an
  infinitive). None shares a translation (ё = е) or a shown headword with the
  right verb or with another distractor.
- `write`: every verb sharing a translation is right (говорить = לדבר /
  לומר), the asked one first.
- `<tense>-form`: the other forms of the tense, none spelled like the right
  one. Without nikud a present like עושה (ms = fs) leaves only 3 options.
- `<tense>-person`: a pronoun is right when any of its persons takes the
  shown spelling (אכלת: אתה and את), so only one of the right pronouns is
  offered.

The whole-data test (`src/questions.test.ts`) builds a task for every verb of
every game in both spellings and checks these rules.

## A typed answer

`src/answer.ts`, `checkWritten(input, accepted)`. Nikud and direction marks
in the input are ignored. Accepted spellings: plene (`plain`), `variants`
and the defective one (the nikud's letters). A regular letter in place of a
final one (or the other way round) is right with `finalLetters: true`, for a
remark. The verdict names the verb that matched.

## The phrase after an answer

`src/phrases.ts`, `ruPhrase(verb, person)`, from the verb's `ruForms`
(`docs/data.md`, "Russian forms"):

- present: "я (ж.) ем";
- past: both aspects by gender, "ты (ж.) ела / съела";
- future: "будешь" + the imperfective, then the perfective, "ты (м.) будешь
  есть / съешь". `future.ipf` is used where the data has it (буду);
- the pair for a woman for feminine persons: "она вышла замуж";
- a passive: был / буду + the short form, "она была приглашена".

## Storage

`src/storage.ts`: one key, `hebrew-verbs`, holding `{ version: 2, settings,
stats }`. `stats` maps a game id to its `GameStats`. Every field is checked
on load: an unknown game, a bad verb entry (counts that do not add up, a
streak above the correct answers) or a bad `open` is dropped or reset on its
own. Version 1 (settings only) keeps its settings.
