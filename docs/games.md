# Games

The rules of the nine games as the core (`src/`, no DOM) implements them, and
how the app shows them and their progress (the last two sections). The
decisions behind them are in the plan (`plans/2026-11-24-hebrew-verbs.md`,
sections 2–3 and 6, decisions 5–10, 13, 25–27, 35, 37, 41, 45–49, 57, 64–67).

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
- A round has 10 tasks, 10 different verbs (`pickRound`, decision 45). At
  most 3 of them are new to the game, the most frequent ones not yet seen,
  unless fewer than 7 verbs are seen: then new ones fill the round. The rest
  are seen verbs, chosen by weight `1 + 4 · error rate + 3 · staleness`
  (taken from alef-bet). The first round is the 10 most frequent verbs.
  Only a game with fewer than 10 open verbs repeats them, never the same one
  twice in a row.

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
  shown spelling (אכלת: אתה and את, `personsWith`), so only one of the right
  pronouns is offered.

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

`src/storage.ts`: one key, `hebrew-verbs`, holding `{ version: 3, settings,
stats }`; `settings` are `nikud`, `translit` and `autoNext`. `stats` maps a
game id to its `GameStats`. Every field is checked on load: an unknown game,
a bad verb entry (counts that do not add up, a streak above the correct
answers) or a bad `open` is dropped or reset on its own. Version 2 is read as
it is (`autoNext` off); version 1 (settings only) keeps its settings.

"Сбросить статистику" in the settings empties `stats` of every game after a
question right under the button; the settings stay (decision 57). The
progress page resets one game the same way: its entry goes, the others and
the settings stay.

## In the app

`src/views/game.ts`, `src/round.ts`; one view for all nine games.
`src/views/home.ts`: all four parts open, each game with "выучено N из M"
(learned of its open verbs).

- A round's tasks are built when it starts, in the spelling of the nikud
  setting then. Every answer goes to the game's statistics at once.
- After an answer: the right option green, a wrong choice red, and under
  every option its other side: the headword under a translation and back;
  under a form who says it (`labelOf`: "я (ж.), ты (ж.), она"); under a
  phrase its pronoun ("он"; the right one "я (м.)" only where the form tells
  the gender, else "я"). A tense task then shows the phrase, pronoun + form
  (`withPronoun`), with 🔊 and its Russian (`ruPhrase`). The verb's card
  follows: picture, headword with 🔊, translations. The answer's card is
  centred like the task's: a band of its colour on top, the verdict as a
  badge, the phrase, a line, the verb, "Дальше" (decision 58).
- The cards of parts 2–4: `<tense>-form` shows the headword with 🔊, its
  translations and the pronoun asked ("הוּא · он"); `<tense>-person` the form
  with 🔊, the headword and translations small under it. The head names the
  tense: "Прошедшее · Местоимение → форма".
- Without a Hebrew voice every 🔊 is disabled, and under a card with 🔊
  (`he-ru`, the tense games) a line links the settings, which tell how to
  install one. A voice installed later turns them on (`voiceschanged`).
- The game waits for "Дальше". With `autoNext` on, a right answer moves on
  after 1.5 s, unless there is a remark or 🔊 was pressed.
- `write`: the field takes the focus; "Не знаю" is a mistake that shows the
  answer; an empty answer is ignored. A remark names the final letters or
  says that another verb with the same translation was typed.
- The results list every task ✓/✗ (a tense task as its phrase and Russian);
  "Повторить ошибки" makes a round of the verbs answered wrong, each once,
  with a new person.
- Digit keys 1–4 pick an option (a plain present with three forms takes no 4).

## Progress

`src/progress.ts`, `gameProgress(pool, stats)`; the page `#/progress`,
`src/views/progress.ts`. Entry: a button at the end of the home page and a
link in the settings' statistics (the header has no room on a phone).

- Every game by part, its name a link to the game. A game never answered
  says "Ещё не играли." and nothing else.
- A played game: four tiles — learned of the open verbs ("0 из 20", as on
  the home page), open of the game's pool ("20 из 1000"), the share of right
  answers of all its answers, and the number of answers.
- Its hardest verbs, at most five: the verbs of its pool answered wrong at
  least once, the highest error rate (`errorRate`, smoothed as for the
  weights) first, then more mistakes, then more frequent. Each is a link to
  its card, in the spelling and transliteration of the settings, with
  "неверно 2 из 3"; none — "Ошибок нет.".
- "Сбросить статистику игры" asks right under the button, naming the game
  with its tense ("Прошедшее · Местоимение → форма"); after the reset the
  game says "Ещё не играли." and the button is disabled. Every game at once
  is reset in the settings (`src/views/reset.ts` builds both).
