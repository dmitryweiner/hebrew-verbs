# Dictionary

The dictionary and a verb's card (plan, section 5; decisions 50–56 of the
plan). Routes: `#/dict`, `#/dict?q=…` (the query stays in the hash) and
`#/dict/<id>`, the card of a verb by its id (`src/routes.ts`). A link
"Словарь" in the header opens it from any screen but a game.

## Search

`src/search.ts`, `search(searchIndex(verbs), query)`. One field; the kind of
query is told by its letters:

- **Empty** — every verb by frequency.
- **Hebrew** — nikud and direction marks ignored, a final letter the same as
  a regular one. Every form of a verb counts (the infinitive, the three
  tenses, the literary future) in every spelling: plene, `variants` and the
  defective one (the nikud's letters). Found, in this order, each verb once:
  1. the verbs with a form equal to the query (אכלתי → לאכול), by rank;
  2. the verbs of that root (משך → להמשיך, להימשך), by rank;
  3. the verbs with a form that starts with the query (לאכ → לאכול), by rank.
- **A root with separators** — maqaf, dot, hyphen or space between single
  letters (כ־ת־ב, כ.ת.ב, כ-ת-ב): the verbs of exactly that root.
- **Russian** — case and ё ignored; a translation equal to the query first,
  then one that starts with it, then one with a word inside that starts with
  it (замуж → жениться, выходить замуж), each group by rank.
- Anything else finds nothing.

A verb found by a form other than its headword tells which, small under it
(`describeHits`): the form in the spelling shown, where it sits and who says
it — "אָכַלְתִּי · прошедшее, я", "אוֹכֵל · настоящее, я (м.), ты (м.), он".
Forms the shown spelling tells apart are told apart: היית without nikud is
"ты (м.), ты (ж.)", with nikud הָיִיתָ and הָיִית are two lines.

The index is built once, on the first visit (~50 ms); a query takes
0.2–3 ms (a single letter scans all ~22 000 spellings).

## A verb's card

`src/views/verb.ts`: the picture (always, decision 14), the headword with 🔊
and its other spellings ("также לאמור"), the translations, "нет инфинитива"
for a verb without one; the root (ח־ת־ן), the binyan in Russian and Hebrew
as a link to its card on the menorah (`#/menorah/<binyan>`,
[menorah.md](menorah.md)), the rank. Then a table per tense, a row per form:
who says it (the present's "я (м.), ты (м.), он", the past's "они (м.),
они (ж.)"), the form, 🔊. The literary future (תֹּאכַלְנָה) stands small in
the rows of вы (ж.) and они (ж.) (decision 6). A tense the verb lacks is
said in a line ("Настоящего времени у этого глагола нет.").

Spelling and transliteration follow the settings, as in the games. "←
Словарь" leads back to the last query (kept in memory, not stored). The
results of a round link each verb to its card.
