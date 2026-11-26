// A verb's table of one tense (decision 53): a row per form with who says
// it and its sound, the literary future small beside the spoken one
// (decision 6). The verb's card shows all three, a meeting the part's one.

import { h } from '../dom';
import { labelOf, personsOf, type Tense } from '../persons';
import { texts } from '../texts';
import { FUTURE_SLOTS, PAST_SLOTS, PRESENT_SLOTS, type Form, type Verb } from '../verbs';

/** A tense's forms in table order, or undefined where the verb lacks the tense (היה has no present). */
function rowsOf(verb: Verb, tense: Tense): { slot: string; form: Form }[] | undefined {
  const table: Partial<Record<string, Form>> | undefined = tense === 'present' ? verb.present : tense === 'past' ? verb.past : verb.future;
  const slots: readonly string[] = tense === 'present' ? PRESENT_SLOTS : tense === 'past' ? PAST_SLOTS : FUTURE_SLOTS;
  return (
    table &&
    slots.flatMap((slot) => {
      const form = table[slot];
      return form ? [{ slot, form }] : [];
    })
  );
}

/** The table, or a line telling the verb lacks the tense; `he` shows a form, `listen` gives its 🔊. */
export function formsTable(verb: Verb, tense: Tense, he: (form: Form) => HTMLElement, listen: (text: string) => HTMLElement): HTMLElement {
  const rows = rowsOf(verb, tense)?.map(({ slot, form }) => {
    const literary = tense === 'future' && (slot === '2fp' || slot === '3fp') && verb.futureLiterary?.[slot];
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, labelOf(personsOf(tense).filter((p) => p.slot === slot))),
      h('td', {}, he(form), literary && h('span', { class: 'literary' }, `${texts.verb.literary} `, he(literary))),
      h('td', {}, listen(form.nikud)),
    );
  });
  return rows ? h('table', { class: 'forms' }, h('tbody', {}, ...rows)) : h('p', { class: 'note' }, texts.verb.missing[tense]);
}
