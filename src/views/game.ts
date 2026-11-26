// A game (plan, section 3): a round of ten tasks with a progress bar; after
// an answer the right one is shown with the verb's picture, in parts 2–4 also
// the phrase "pronoun + form" with its Russian, and the game waits for
// "Дальше" (a right answer moves on by itself when the autoNext setting is
// on). The round ends with the results and "Повторить ошибки".

import { checkWritten } from '../answer';
import { h, hebrewWord } from '../dom';
import { gameTense, type GameId } from '../games';
import { normalizeInput } from '../hebrew';
import { labelOf, withPronoun } from '../persons';
import { ruPhrase } from '../phrases';
import { pictureOf } from '../pictures';
import { personsWith, type Question } from '../questions';
import { hashOf } from '../routes';
import { current, mistakes, newRound, record, retryRound, type Round } from '../round';
import { fill, texts } from '../texts';
import type { Verb } from '../verbs';
import type { AppContext } from './context';
import { listening } from './listen';
import { pictureElement } from './picture';

/** How long a right answer stays on screen before the next task, with autoNext on. */
export const CORRECT_DELAY = 1500;

type ChoiceQuestion = Extract<Question, { kind: 'he-ru' | 'ru-he' | 'form' | 'person' }>;
type TenseQuestion = Extract<Question, { kind: 'form' | 'person' }>;
type WriteQuestion = Extract<Question, { kind: 'write' }>;

const isTense = (q: Question): q is TenseQuestion => q.kind === 'form' || q.kind === 'person';

const translations = (verb: Verb) => verb.ru.join(', ');
const noInfinitive = (verb: Verb) => !verb.infinitive && h('p', { class: 'note' }, texts.game.noInfinitive);

export function gameView(game: GameId) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const { translit, autoNext } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    let round: Round = newRound(game, ctx.verbs, ctx.gameStats(game), spelling, ctx.now(), ctx.random);
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Digit keys 1–4 pick an option while a choice task waits for an answer. */
    let pickByKey: ((index: number) => void) | undefined;

    const he = (form: { nikud: string; plain: string; translit: string }) => hebrewWord(form, round.spelling, translit);
    const word = (verb: Verb) => he(verb.lemma);
    const tense = gameTense(game);

    // Listening after a right answer: stay on it.
    const { listen, noVoice, stop: stopListening } = listening(ctx, () => clearTimeout(timer));

    function head(): HTMLElement {
      const n = round.results.length;
      const total = round.questions.length;
      const count = fill(texts.game.count, { n: Math.min(n + 1, total), total });
      return h(
        'div',
        { class: 'game-head' },
        h('a', { class: 'quit', href: '#/' }, texts.game.quit),
        h('span', { class: 'game-title' }, tense ? `${texts.tenses[tense]} · ${texts.games[game]}` : texts.games[game]),
        h('span', { class: 'count', 'aria-hidden': 'true' }, `${Math.min(n + 1, total)} / ${total}`),
        h('progress', { max: total, value: n, 'aria-label': count, title: count }),
      );
    }

    /** A tense task's phrase, "pronoun + form", with its sound and its Russian. */
    function phrase(q: TenseQuestion): HTMLElement {
      const said = withPronoun(q.person, q.form);
      return h(
        'div',
        { class: 'phrase' },
        h('div', { class: 'verb-word' }, he(said), listen(said.nikud)),
        h('p', { class: 'ru' }, ruPhrase(q.verb, q.person)),
      );
    }

    /** The answer's card: the phrase of a tense task, picture, headword with its sound, translations, and a remark. */
    function feedback(correct: boolean, verb: Verb, remark: Node | null, q: Question | undefined, last: boolean): HTMLElement {
      const picture = pictureOf(ctx.pictures, verb.id);
      const next = h('button', { type: 'button', class: 'next primary' }, last ? texts.game.results : texts.game.next);
      next.addEventListener('click', () => {
        clearTimeout(timer);
        showTask();
      });
      const box = h(
        'div',
        { class: `feedback ${correct ? 'good' : 'bad'}` },
        h('p', { class: 'verdict' }, correct ? `✓ ${texts.game.right}` : `✗ ${texts.game.wrong}`),
        q && isTense(q) && phrase(q),
        h(
          'div',
          { class: 'verb-card' },
          picture && pictureElement(picture, ctx.emoji),
          h(
            'div',
            { class: 'verb-text' },
            h('div', { class: 'verb-word' }, word(verb), listen(verb.lemma.nikud)),
            h('p', { class: 'ru' }, translations(verb)),
            !verb.infinitive && h('p', { class: 'note' }, texts.game.noInfinitive),
          ),
        ),
        remark && h('p', { class: 'remark' }, remark),
        next,
      );
      queueMicrotask(() => next.focus());
      if (autoNext && correct && !remark) timer = setTimeout(showTask, CORRECT_DELAY);
      return box;
    }

    function answered(correct: boolean, verb: Verb, remark: Node | null = null): HTMLElement {
      pickByKey = undefined;
      const q = current(round);
      if (q) ctx.recordAnswer(game, q.verb, correct);
      round = record(round, correct);
      return feedback(correct, verb, remark, q, current(round) === undefined);
    }

    /** What each option shows, and its other side, revealed after the answer: what the chosen one means. */
    function sides(q: ChoiceQuestion): { face: Node; reveal: Node | string }[] {
      // Who says this form: אוכל is я (м.), ты (м.), он.
      if (q.kind === 'form')
        return q.options.map((f) => ({ face: he(f), reveal: labelOf(personsWith(q.verb, q.tense, f, round.spelling)) }));
      if (q.kind === 'person') {
        // The right pronoun keeps its gender only where the form has one: אֲנִי אוֹכֵל is я (м.), אֲנִי אָכַלְתִּי is я.
        const sayers = personsWith(q.verb, q.tense, q.form, round.spelling).filter((p) => p.pronoun === q.person.pronoun);
        return q.options.map((p) => ({ face: he(withPronoun(p, q.form)), reveal: p === q.person ? labelOf(sayers) : p.pronoun.label }));
      }
      if (q.kind === 'he-ru') return q.options.map((v) => ({ face: h('span', { class: 'ru' }, translations(v)), reveal: word(v) }));
      return q.options.map((v) => ({ face: word(v), reveal: translations(v) }));
    }

    function choiceTask(q: ChoiceQuestion, area: HTMLElement, result: HTMLElement): HTMLElement {
      const options = sides(q);
      const buttons = options.map(({ face }, i) => {
        const button = h('button', { type: 'button', class: 'option' }, face);
        button.addEventListener('click', () => pick(i));
        return button;
      });
      function pick(i: number) {
        // A plain present may have three options: the key 4 picks nothing.
        if (pickByKey === undefined || i >= buttons.length) return;
        const correct = i === q.answer;
        buttons.forEach((button, j) => {
          button.disabled = true;
          if (j === q.answer) button.classList.add('right');
          else if (j === i) button.classList.add('wrong');
          const reveal = options[j]?.reveal;
          if (reveal) button.append(h('span', { class: 'reveal' }, reveal));
        });
        result.replaceChildren(answered(correct, q.verb));
      }
      pickByKey = pick;
      area.replaceChildren(...buttons);
      area.className = 'options';
      return area;
    }

    function writeTask(q: WriteQuestion, area: HTMLElement, result: HTMLElement): HTMLElement {
      const input = h('input', {
        type: 'text',
        class: 'answer-input',
        lang: 'he',
        dir: 'rtl',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        'aria-label': texts.game.answerLabel,
      });
      const check = h('button', { type: 'submit', class: 'primary' }, texts.game.check);
      const dontKnow = h('button', { type: 'button' }, texts.game.dontKnow);
      const form = h('form', { class: 'write' }, input, h('div', { class: 'write-actions' }, check, dontKnow));

      function finish(correct: boolean, verb: Verb, remark: Node | null) {
        input.readOnly = true;
        input.classList.add(correct ? 'right' : 'wrong');
        for (const button of form.querySelectorAll('button')) button.disabled = true;
        result.replaceChildren(answered(correct, verb, remark));
      }
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (input.readOnly) return;
        if (normalizeInput(input.value) === '') {
          input.focus();
          return;
        }
        const verdict = checkWritten(input.value, q.accepted);
        if (!verdict.correct) return finish(false, q.verb, null);
        const remark = verdict.finalLetters
          ? h('span', {}, `${texts.game.finalLetters} `, hebrewWord(verdict.verb.lemma, 'plain', false))
          : verdict.verb === q.verb
            ? null
            : h('span', {}, texts.game.otherVerb);
        finish(true, verdict.verb, remark);
      });
      dontKnow.addEventListener('click', () => finish(false, q.verb, null));
      area.replaceChildren(form);
      area.className = 'answer';
      // On a phone this opens the system keyboard at once: it is the only way to type.
      queueMicrotask(() => input.focus());
      return area;
    }

    /** The task's card: what is asked, with 🔊 where it is Hebrew. */
    function card(q: Question): HTMLElement {
      if (q.kind === 'form')
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'verb-word lemma' }, word(q.verb), listen(q.verb.lemma.nikud)),
          h('p', { class: 'ru' }, translations(q.verb)),
          noInfinitive(q.verb),
          h(
            'p',
            { class: 'pronoun big' },
            he(q.person.pronoun),
            h('span', { 'aria-hidden': 'true' }, '·'),
            h('span', { class: 'label' }, q.person.label),
          ),
        );
      if (q.kind === 'person')
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'verb-word big form' }, he(q.form), listen(q.form.nikud)),
          h('p', { class: 'lemma' }, word(q.verb), h('span', { class: 'ru' }, translations(q.verb))),
          noInfinitive(q.verb),
        );
      if (q.kind === 'he-ru')
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'verb-word big' }, word(q.verb), listen(q.verb.lemma.nikud)),
          noInfinitive(q.verb),
        );
      return h('div', { class: 'card' }, h('p', { class: 'ru big' }, translations(q.verb)));
    }

    function showTask() {
      clearTimeout(timer);
      const q = current(round);
      if (!q) return showSummary();
      const task = q.kind === 'write' && !q.verb.infinitive ? texts.game.taskNoInfinitive : texts.game.task[q.kind];
      const result = h('div', { class: 'result', 'aria-live': 'polite' });
      const area = h('div');
      root.replaceChildren(
        h(
          'section',
          { class: 'game' },
          head(),
          card(q),
          q.kind !== 'ru-he' && q.kind !== 'write' && noVoice(),
          h('p', { class: 'task' }, task),
          q.kind === 'write' ? writeTask(q, area, result) : choiceTask(q, area, result),
          result,
        ),
      );
    }

    function showSummary() {
      const right = round.results.filter(Boolean).length;
      const total = round.questions.length;
      const wrong = mistakes(round);
      const items = round.questions.map((q, i) => {
        const ok = round.results[i] === true;
        return h(
          'li',
          { class: ok ? 'good' : 'bad' },
          h('span', { class: 'mark', 'aria-label': ok ? texts.game.right : texts.game.wrong }, ok ? '✓' : '✗'),
          // The round is over: a verb opens its card.
          h(
            'a',
            { class: 'to-card', href: hashOf({ page: 'verb', id: q.verb.id }) },
            isTense(q) ? he(withPronoun(q.person, q.form)) : word(q.verb),
          ),
          h('span', { class: 'ru' }, isTense(q) ? ruPhrase(q.verb, q.person) : translations(q.verb)),
        );
      });
      const retry = h('button', { type: 'button', class: 'primary' }, texts.summary.retry);
      retry.addEventListener('click', () => {
        round = retryRound(round, ctx.verbs, ctx.random);
        showTask();
      });
      const again = h('button', { type: 'button', class: wrong.length ? '' : 'primary' }, texts.summary.again);
      again.addEventListener('click', () => {
        round = newRound(game, ctx.verbs, ctx.gameStats(game), spelling, ctx.now(), ctx.random);
        showTask();
      });
      const first = wrong.length > 0 ? retry : again;
      root.replaceChildren(
        h(
          'section',
          { class: 'summary' },
          h('h1', {}, texts.summary.heading),
          h('p', { class: 'score' }, fill(texts.summary.score, { right, total }), right === total && ` · ${texts.summary.perfect}`),
          h('ol', { class: 'results' }, ...items),
          h('div', { class: 'actions' }, wrong.length > 0 && retry, again, h('a', { class: 'button', href: '#/' }, texts.summary.home)),
        ),
      );
      queueMicrotask(() => first.focus());
    }

    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (pickByKey && !event.ctrlKey && !event.metaKey && !event.altKey && index >= 0 && index < 4) pickByKey(index);
    };
    document.addEventListener('keydown', onKey);
    showTask();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      stopListening();
    };
  };
}
