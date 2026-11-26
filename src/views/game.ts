// A game of part 1 (plan 3.1): a round of ten tasks with a progress bar;
// after an answer the right one is shown with the verb's picture, and the
// game waits for "Дальше" (a right answer moves on by itself when the
// autoNext setting is on). The round ends with the results and "Повторить ошибки".

import { checkWritten } from '../answer';
import { h, hebrewWord } from '../dom';
import type { GameId } from '../games';
import { normalizeInput } from '../hebrew';
import { pictureOf } from '../pictures';
import type { Question } from '../questions';
import { current, mistakes, newRound, record, retryRound, type Round } from '../round';
import { fill, texts } from '../texts';
import type { Verb } from '../verbs';
import type { AppContext } from './context';
import { pictureElement } from './picture';

/** How long a right answer stays on screen before the next task, with autoNext on. */
export const CORRECT_DELAY = 1500;

type ChoiceQuestion = Extract<Question, { kind: 'he-ru' | 'ru-he' }>;
type WriteQuestion = Extract<Question, { kind: 'write' }>;

const translations = (verb: Verb) => verb.ru.join(', ');

export function gameView(game: GameId) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const { translit, autoNext } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    let round: Round = newRound(game, ctx.verbs, ctx.gameStats(game), spelling, ctx.now(), ctx.random);
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Digit keys 1–4 pick an option while a choice task waits for an answer. */
    let pickByKey: ((index: number) => void) | undefined;
    const listenButtons = new Set<HTMLButtonElement>();

    const word = (verb: Verb) => hebrewWord(verb.lemma, round.spelling, translit);

    function updateListen() {
      const voice = ctx.speaker.voice() !== null;
      for (const button of listenButtons) {
        if (!button.isConnected) listenButtons.delete(button);
        else button.disabled = !voice;
      }
      root.querySelector('.no-voice')?.toggleAttribute('hidden', voice);
    }

    function listen(verb: Verb): HTMLButtonElement {
      const button = h('button', { type: 'button', class: 'listen', 'aria-label': texts.game.listen, title: texts.game.listen }, '🔊');
      button.disabled = ctx.speaker.voice() === null;
      button.addEventListener('click', () => {
        clearTimeout(timer); // listening after a right answer: stay on it
        ctx.speaker.say(verb.lemma.nikud);
      });
      listenButtons.add(button);
      return button;
    }

    const noVoice = () =>
      h('p', { class: 'no-voice', hidden: ctx.speaker.voice() !== null }, h('a', { href: '#/settings' }, texts.game.noVoice));

    function head(): HTMLElement {
      const n = round.results.length;
      const total = round.questions.length;
      const count = fill(texts.game.count, { n: Math.min(n + 1, total), total });
      return h(
        'div',
        { class: 'game-head' },
        h('a', { class: 'quit', href: '#/' }, texts.game.quit),
        h('span', { class: 'game-title' }, texts.games[game]),
        h('span', { class: 'count', 'aria-hidden': 'true' }, `${Math.min(n + 1, total)} / ${total}`),
        h('progress', { max: total, value: n, 'aria-label': count, title: count }),
      );
    }

    /** The answer's card: picture, headword with its sound, translations, and a remark. */
    function feedback(correct: boolean, verb: Verb, remark: Node | null, last: boolean): HTMLElement {
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
        h(
          'div',
          { class: 'verb-card' },
          picture && pictureElement(picture, ctx.emoji),
          h(
            'div',
            { class: 'verb-text' },
            h('div', { class: 'verb-word' }, word(verb), listen(verb)),
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
      return feedback(correct, verb, remark, current(round) === undefined);
    }

    function choiceTask(q: ChoiceQuestion, area: HTMLElement, result: HTMLElement): HTMLElement {
      const face = (v: Verb) => (q.kind === 'he-ru' ? h('span', { class: 'ru' }, translations(v)) : word(v));
      const buttons = q.options.map((option, i) => {
        const button = h('button', { type: 'button', class: 'option' }, face(option));
        button.addEventListener('click', () => pick(i));
        return button;
      });
      function pick(i: number) {
        if (pickByKey === undefined) return;
        const correct = i === q.answer;
        buttons.forEach((button, j) => {
          button.disabled = true;
          if (j === q.answer) button.classList.add('right');
          else if (j === i) button.classList.add('wrong');
          // The other side of every option: what the chosen word means.
          const v = q.options[j];
          if (v) button.append(h('span', { class: 'reveal' }, q.kind === 'he-ru' ? word(v) : translations(v)));
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

    function showTask() {
      clearTimeout(timer);
      const q = current(round);
      if (!q) return showSummary();
      if (q.kind !== 'he-ru' && q.kind !== 'ru-he' && q.kind !== 'write') throw new Error(`${game} is not a game of part 1`);
      const card =
        q.kind === 'he-ru'
          ? h(
              'div',
              { class: 'card' },
              h('div', { class: 'verb-word big' }, word(q.verb), listen(q.verb)),
              !q.verb.infinitive && h('p', { class: 'note' }, texts.game.noInfinitive),
            )
          : h('div', { class: 'card' }, h('p', { class: 'ru big' }, translations(q.verb)));
      const task = q.kind === 'write' && !q.verb.infinitive ? texts.game.taskNoInfinitive : texts.game.task[q.kind];
      const result = h('div', { class: 'result', 'aria-live': 'polite' });
      const area = h('div');
      root.replaceChildren(
        h(
          'section',
          { class: 'game' },
          head(),
          card,
          q.kind === 'he-ru' && noVoice(),
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
          word(q.verb),
          h('span', { class: 'ru' }, translations(q.verb)),
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
    const stopWatching = ctx.speaker.watch(updateListen);
    showTask();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      stopWatching();
    };
  };
}
