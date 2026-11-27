# Games

The rules of the nine games as the core (`src/`, no DOM) implements them, and
how the app shows them and their progress (the last two sections). The
decisions behind them are in the plan (`plans/2026-11-24-hebrew-verbs.md`,
sections 2–3 and 6, decisions 5–10, 13, 25–27, 35, 37, 41, 45–49, 57, 64–72,
78–80).

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

## Meeting the verbs

`src/meeting.ts`. Nothing is asked before it is met (decisions 68–72).
Every part keeps the verbs met in it (`met` in the storage): its pool
(`partPool`, the pool of its games: in parts 2–4 the verbs with the tense)
in the order met. A verb met in part 1 is known to all three of its games;
a tense part meets its verbs again, in its tense.

- The part's meeting, `#/part/<n>/intro`, shows the next verbs not met, the
  most frequent first (`nextToMeet`): ten the first time (what the first
  round asks), then five.
- A round starts with a card of each of its verbs not met yet (`toMeet`),
  then its tasks. A part met ahead asks at once: rounds take the most
  frequent new verbs, the ones met first.
- "Понятно" on a card meets the verb: it goes into the part's games. It is
  not learned: that still takes three right answers in a row.

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

`src/storage.ts`: one key, `hebrew-verbs`, holding `{ version: 4, settings,
stats, met }`; `settings` are `nikud`, `translit` and `autoNext`. `stats` maps a
game id to its `GameStats`, `met` a part (1–4) to the verb ids met in it.
Every field is checked on load: an unknown game, a bad verb entry (counts
that do not add up, a streak above the correct answers), a bad `open`, an
unknown part or a non-string id is dropped or reset on its own. Versions 2
and 3 are read as they are (version 2: `autoNext` off), their parts meeting
the verbs their games asked; version 1 (settings only) keeps its settings.

"Сбросить статистику" in the settings empties `stats` of every game and
`met` after a question right under the button; the settings stay (decisions
57, 69). The progress page resets one game the same way: its entry goes,
the others, the verbs met and the settings stay.

## In the app

`src/views/game.ts`, `src/round.ts`; one view for all nine games.
`src/views/home.ts`: all four parts open, each first with its meeting,
"знакомо N" (met of the part's verbs; not of how many: "знакомо 10 из 1000"
frightened the learners, decision 78), then each game with "выучено N из M"
(learned of its open verbs).

- A meeting's card (`src/views/meet-card.ts`): the picture, the headword
  with 🔊, the translations; in parts 2–4 also the verb's table of the tense
  (who says it, the form, 🔊, as in the dictionary's card) and "Как строятся
  формы:" with a link to the binyan on the menorah. The part's meeting
  (`src/views/meeting.ts`) ends with the verbs met, "Проверить себя" (the
  part's first game), "Ещё 5" and "К частям". A game and a meeting hide the
  header's links.
- A round's tasks are built when it starts, in the spelling of the nikud
  setting then; its verbs not met come first, "Новый глагол · 1 из 3".
  Every answer goes to the game's statistics at once.
- After an answer the answer's card takes the right option's place, where
  the eye already is (decision 79). After a right answer it stands alone,
  the other options go. After a mistake they stay, the wrong choice red, and
  under each its other side: the headword under a translation and back;
  under a form who says it (`labelOf`: "я (ж.), ты (ж.), она"); under a
  phrase its pronoun ("он"). On a desktop's two columns the card spans a
  row, and an option after it fills the cell it leaves.
- The answer's card is centred like the task's: a band of its colour on top,
  the verdict as a badge (the wrong choice may be off a phone's screen), in
  a tense task the phrase, pronoun + form (`withPronoun`), with 🔊 and its
  Russian (`ruPhrase`), a line, then the verb: picture, headword with 🔊,
  translations; "Дальше" (decision 58).
- The cards of parts 2–4 are built like the answer's (decision 80): what is
  asked big on top, under a line the verb, its headword and translations on
  one baseline. `<tense>-form` asks the pronoun, its Russian under it
  (אֲנַחְנוּ, мы (м.)), the 🔊 with the headword; `<tense>-person` the form
  with its 🔊. A 🔊 beside a centred word leaves the word in the middle. The
  head names the tense: "Прошедшее · Местоимение → форма".
- Without a Hebrew voice every 🔊 is disabled, and under a card with 🔊
  (`he-ru`, the tense games) a line links the settings, which tell how to
  install one. A voice installed later turns them on (`voiceschanged`).
- The game waits for "Дальше". With `autoNext` on, a right answer moves on
  after 1.5 s, unless there is a remark or 🔊 was pressed.
- `write`: the field takes the focus; "Не знаю" is a mistake that shows the
  answer; an empty answer is ignored. The answer's card takes the buttons'
  place, and the field's too, unless a wrong answer is typed in it: that one
  stays, red, over the card. A remark names the final letters or says that
  another verb with the same translation was typed.
- The results list every task ✓/✗ (a tense task as its phrase and Russian);
  "Повторить ошибки" makes a round of the verbs answered wrong, each once,
  with a new person.
- Digit keys 1–4 pick an option (a plain present with three forms takes no 4).

## Progress

`src/progress.ts`, `gameProgress(pool, stats)`; the page `#/progress`,
`src/views/progress.ts`. Entry: a button at the end of the home page and a
link in the settings' statistics (the header has no room on a phone).

- Under each part's heading: "Знакомство: знакомо N из M".

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
