// The menorah of the binyanim (plan, section 4): seven branches, hitpael in
// the middle, each active binyan on the right and its passive mirrored on
// the left, on one arc. A branch opens its binyan's card under the menorah:
// the meaning, the features, the model forms on פ־ע־ל and examples from the
// dictionary.

import { BINYAN_EXAMPLES, BINYAN_HEBREW, BINYAN_KIND, BINYAN_MODELS, MENORAH, PAIR, type BinyanKind, type Model } from '../binyanim';
import { h, hebrewWord, withHebrew } from '../dom';
import { TENSES } from '../persons';
import { hashOf } from '../routes';
import { fill, texts } from '../texts';
import type { Binyan, Form } from '../verbs';
import type { AppContext } from './context';

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  return el;
}

/**
 * The arms under the branches, in a box 700 wide: the branches' centres are
 * 100 apart, like the seven columns above. A pair's arms are the two halves
 * of one arc meeting the stem; the selected binyan's arm is coloured.
 */
function arms(selected: Binyan | undefined): SVGElement {
  const box = svg('svg', { class: 'menorah-arms', viewBox: '0 0 700 380', 'aria-hidden': 'true' });
  const arm = (binyan: Binyan, d: string) => {
    const kind = binyan === selected ? ` arm-selected kind-${BINYAN_KIND[binyan]}` : '';
    box.append(svg('path', { class: `arm${kind}`, d }));
  };
  box.append(
    svg('path', { class: 'arm', d: 'M 350 300 V 345' }),
    svg('path', { class: 'menorah-base', d: 'M 270 375 L 300 345 H 400 L 430 375 Z' }),
  );
  MENORAH.forEach((binyan, i) => {
    const r = Math.abs(i - 3) * 100;
    const x = 50 + i * 100;
    arm(binyan, r === 0 ? 'M 350 0 V 300' : `M ${x} 0 A ${r} ${r} 0 0 ${i < 3 ? 0 : 1} 350 ${r}`);
  });
  return box;
}

/** A binyan named in Russian and in Hebrew: "пиэль פִּעֵל". */
const nameOf = (b: Binyan) => [`${texts.binyanim[b]} `, h('span', { class: 'he', lang: 'he', dir: 'rtl' }, BINYAN_HEBREW[b])];

export function menorahView(binyan: Binyan | undefined) {
  return (root: HTMLElement, ctx: AppContext): (() => void) => {
    const { translit } = ctx.settings();
    const spelling = ctx.settings().nikud ? 'nikud' : 'plain';
    const he = (form: Pick<Form, 'nikud' | 'plain' | 'translit'>) => hebrewWord(form, spelling, translit);

    const branches = MENORAH.map((b) =>
      h(
        'a',
        {
          class: `branch branch-${BINYAN_KIND[b]}`,
          href: hashOf({ page: 'menorah', binyan: b }),
          'aria-current': b === binyan && 'page',
        },
        h('span', { class: 'he', lang: 'he', dir: 'rtl' }, BINYAN_HEBREW[b]),
        h('span', { class: 'name' }, texts.binyanim[b]),
        h('span', { class: 'flame', 'aria-hidden': 'true' }),
      ),
    );
    const legend = h(
      'ul',
      { class: 'menorah-legend' },
      ...(['active', 'passive', 'reflexive'] satisfies BinyanKind[]).map((kind) =>
        h('li', {}, h('span', { class: `dot kind-${kind}`, 'aria-hidden': 'true' }), texts.menorah.kinds[kind]),
      ),
    );

    function modelRows(model: Model): HTMLElement[] {
      const formOf = (label: string, form: Form) => h('span', { class: 'model-form' }, h('span', { class: 'person' }, label), he(form));
      const infinitive = h(
        'tr',
        {},
        h('th', { scope: 'row' }, texts.menorah.infinitive),
        h('td', {}, model.infinitive ? h('span', { class: 'model-form' }, he(model.infinitive)) : texts.menorah.noInfinitive),
      );
      const tenses = TENSES.map((t) => {
        const persons: Record<string, string> = texts.menorah.persons[t];
        const forms: Record<string, Form> = model[t];
        return h(
          'tr',
          {},
          h('th', { scope: 'row' }, texts.tenses[t]),
          h('td', {}, ...Object.entries(forms).map(([slot, form]) => formOf(persons[slot] ?? '', form))),
        );
      });
      return [infinitive, ...tenses];
    }

    function card(b: Binyan): HTMLElement {
      const kind = BINYAN_KIND[b];
      const pair = PAIR[b];
      const { meaning, features } = texts.menorah.binyanim[b];
      const examples = BINYAN_EXAMPLES[b].flatMap((id) => {
        const verb = ctx.verbs.find((v) => v.id === id);
        return verb
          ? [
              h(
                'li',
                {},
                h(
                  'a',
                  { class: 'dict-item', href: hashOf({ page: 'verb', id }) },
                  he(verb.lemma),
                  h('span', { class: 'ru' }, verb.ru.join(', ')),
                ),
              ),
            ]
          : [];
      });
      return h(
        'article',
        { class: `binyan-card kind-${kind}` },
        h('h2', {}, ...nameOf(b)),
        h('p', { class: 'kind' }, texts.menorah.kinds[kind]),
        h('p', { class: 'meaning' }, ...withHebrew(meaning)),
        pair &&
          h(
            'p',
            { class: 'pair' },
            `${kind === 'active' ? texts.menorah.passiveIs : texts.menorah.passiveOf} `,
            h('a', { href: hashOf({ page: 'menorah', binyan: pair }) }, ...nameOf(pair)),
          ),
        h('ul', { class: 'features' }, ...features.map((f) => h('li', {}, ...withHebrew(f)))),
        h('h3', {}, ...withHebrew(texts.menorah.model)),
        h('table', { class: 'model' }, h('tbody', {}, ...modelRows(BINYAN_MODELS[b]))),
        h('h3', {}, texts.menorah.examples),
        h('ul', { class: 'examples dict-results' }, ...examples),
        h('p', { class: 'count' }, fill(texts.menorah.count, { n: ctx.verbs.filter((v) => v.binyan === b).length })),
      );
    }

    root.replaceChildren(
      h(
        'section',
        { class: 'menorah-page' },
        h('h1', {}, texts.menorah.heading),
        h('p', { class: 'intro' }, texts.menorah.intro),
        h('nav', { class: 'menorah', 'aria-label': texts.menorah.branches }, h('div', { class: 'branches' }, ...branches), arms(binyan)),
        legend,
        binyan ? card(binyan) : h('p', { class: 'hint' }, texts.menorah.choose),
      ),
    );
    return () => {};
  };
}
