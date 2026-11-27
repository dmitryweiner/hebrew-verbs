// A game (plan, section 3): a round of ten tasks with a progress bar; after
// an answer the verb's card with its picture, in parts 2–4 also the phrase
// "pronoun + form" with its Russian, takes the right option's place, alone
// after a right answer (decision 79), and the game waits for "Дальше" (a
// right answer moves on by itself when the autoNext setting is on). The
// round ends with the results and "Повторить ошибки". A round starts with a
// card of each of its verbs not known in the part yet: nothing is asked
// before it is met (decision 68).

import { checkWritten } from '../answer';
import { h, hebrewWord } from '../dom';
import { gamePart, gameTense, type GameId } from '../games';
import { normalizeInput } from '../hebrew';
import { toMeet } from '../meeting';
import { labelOf, withPronoun } from '../persons';
import { ruPhrase } from '../phrases';
import { pictureOf } from '../pictures';
import { personsWith, type Question } from '../questions';
import { hashOf } from '../routes';
import { current, mistakes, newRound, record, retryRound, type Round } from '../round';
import { fill, texts } from '../texts';
import type { Verb } from '../verbs';
import type { AppContext } from './context';
import { gameHead } from './head';
import { listening } from './listen';
import { meetCard } from './meet-card';
import { pictureElement } from './picture';

/** How long a right answer stays on screen before the next task, with autoNext on. */
export const CORRECT_DELAY = 1500;

type ChoiceQuestion = Extract<Question, { kind: 'he-ru' | 'ru-he' | 'form' | 'person' }>;
type TenseQuestion = Extract<Question, { kind: 'form' | 'person' }>;
type WriteQuestion = Extract<Question, { kind: 'write' }>;

const isTense = (q: Question): q is TenseQuestion => q.kind === 'form' || q.kind === 'person';

const translations = (verb: Verb) => verb.ru.join(', ');

/** A game's name; in parts 2–4 the tense first: "Прошедшее · Местоимение → форма" (decision 49). */
export function gameTitle(game: GameId): string {
  const tense = gameTense(game);
  return tense ? `${texts.tenses[tense]} · ${texts.games[game]}` : texts.games[game];
}
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
    const part = gamePart(game);

    // Listening after a right answer: stay on it.
    const { listen, noVoice, stop: stopListening } = listening(ctx, () => clearTimeout(timer));

    function head(): HTMLElement {
      const n = round.results.length;
      const total = round.questions.length;
      return gameHead(gameTitle(game), n, total, fill(texts.game.count, { n: Math.min(n + 1, total), total }));
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

    /** What each option shows, and its other side, revealed after a mistake: what the chosen one means. */
    function sides(q: ChoiceQuestion): { face: Node; reveal: Node | string }[] {
      // Who says this form: אוכל is я (м.), ты (м.), он.
      if (q.kind === 'form')
        return q.options.map((f) => ({ face: he(f), reveal: labelOf(personsWith(q.verb, q.tense, f, round.spelling)) }));
      // Under a phrase its pronoun, "он"; the right one turns into the answer's card, with the phrase in Russian.
      if (q.kind === 'person') return q.options.map((p) => ({ face: he(withPronoun(p, q.form)), reveal: p.pronoun.label }));
      if (q.kind === 'he-ru') return q.options.map((v) => ({ face: h('span', { class: 'ru' }, translations(v)), reveal: word(v) }));
      return q.options.map((v) => ({ face: word(v), reveal: translations(v) }));
    }

    function choiceTask(q: ChoiceQuestion, area: HTMLElement): HTMLElement {
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
        const shown = answered(correct, q.verb);
        // The card in place of the right option, where the eye already is (decision 79): alone after a
        // right answer; after a mistake the others stay, each with what it is.
        if (correct) {
          area.replaceChildren(shown);
          return;
        }
        buttons.forEach((button, j) => {
          button.disabled = true;
          if (j === i) button.classList.add('wrong');
          const reveal = options[j]?.reveal;
          if (reveal) button.append(h('span', { class: 'reveal' }, reveal));
        });
        buttons[q.answer]?.replaceWith(shown);
      }
      pickByKey = pick;
      area.replaceChildren(...buttons);
      area.className = 'options';
      return area;
    }

    function writeTask(q: WriteQuestion, area: HTMLElement): HTMLElement {
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
      const actions = h('div', { class: 'write-actions' }, check, dontKnow);
      const form = h('form', { class: 'write' }, input, actions);

      /** The card takes the buttons' place, and the field's too unless a wrong answer is typed in it (decision 79). */
      function finish(correct: boolean, verb: Verb, remark: Node | null) {
        input.readOnly = true;
        const shown = answered(correct, verb, remark);
        if (correct || normalizeInput(input.value) === '') {
          area.replaceChildren(shown);
          return;
        }
        input.classList.add('wrong');
        actions.remove();
        area.append(shown);
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

    /** A tense task's verb, small under a line: headword and translations on one baseline, its 🔊 if asked for. */
    function verbLine(verb: Verb, sound: boolean): HTMLElement {
      return h('div', { class: 'lemma' }, word(verb), h('span', { class: 'ru' }, translations(verb)), sound && listen(verb.lemma.nikud));
    }

    /**
     * The task's card: what is asked, with 🔊 where it is Hebrew. A tense task's card is built like the answer's
     * (decision 80): what is asked big on top (the pronoun, its Russian under it; or the form), the verb under a line.
     */
    function card(q: Question): HTMLElement {
      if (q.kind === 'form')
        return h(
          'div',
          { class: 'card' },
          h('p', { class: 'pronoun' }, he(q.person.pronoun), h('span', { class: 'label' }, q.person.label)),
          verbLine(q.verb, true),
          noInfinitive(q.verb),
        );
      if (q.kind === 'person')
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'verb-word big form' }, he(q.form), listen(q.form.nikud)),
          verbLine(q.verb, false),
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
      // The answer's card appears in it: a screen reader hears it.
      const area = h('div', { 'aria-live': 'polite' });
      root.replaceChildren(
        h(
          'section',
          { class: 'game' },
          head(),
          card(q),
          q.kind !== 'ru-he' && q.kind !== 'write' && noVoice(),
          h('p', { class: 'task' }, task),
          q.kind === 'write' ? writeTask(q, area) : choiceTask(q, area),
        ),
      );
    }

    /** The round's verbs not known in the part, a card at a time, then its first task. */
    function meet(verbs: readonly Verb[], i = 0) {
      const verb = verbs[i];
      if (!verb) return showTask();
      const next = h('button', { type: 'button', class: 'meet-next primary' }, texts.meeting.got);
      next.addEventListener('click', () => {
        ctx.meet(part, verb);
        meet(verbs, i + 1);
      });
      root.replaceChildren(
        h(
          'section',
          { class: 'game meeting' },
          head(),
          h('p', { class: 'meet-label' }, fill(texts.meeting.newVerb, { n: i + 1, total: verbs.length })),
          meetCard(verb, part, ctx, he, listen),
          noVoice(),
          next,
        ),
      );
      queueMicrotask(() => next.focus());
    }

    const begin = () =>
      meet(
        toMeet(
          round.questions.map((q) => q.verb),
          ctx.met(part),
        ),
      );

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
        begin();
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
    begin();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      stopListening();
    };
  };
}
