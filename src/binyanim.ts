// The binyanim (plan, section 4): their Hebrew names on the model root
// פ־ע־ל, the menorah's branches, the model forms and the examples of each
// card. The Russian texts are in src/texts.ts.

import type { Binyan, Form } from './verbs';

export const BINYAN_HEBREW: Record<Binyan, string> = {
  paal: 'פָּעַל',
  nifal: 'נִפְעַל',
  piel: 'פִּעֵל',
  pual: 'פֻּעַל',
  hifil: 'הִפְעִיל',
  hufal: 'הֻפְעַל',
  hitpael: 'הִתְפַּעֵל',
};

export type BinyanKind = 'active' | 'passive' | 'reflexive';

export const BINYAN_KIND: Record<Binyan, BinyanKind> = {
  paal: 'active',
  nifal: 'passive',
  piel: 'active',
  pual: 'passive',
  hifil: 'active',
  hufal: 'passive',
  hitpael: 'reflexive',
};

/** The branches from left to right: hitpael in the middle, each active binyan on the right, its passive mirrored on the left. */
export const MENORAH: readonly Binyan[] = ['nifal', 'pual', 'hufal', 'hitpael', 'hifil', 'piel', 'paal'];

/** An active binyan and its passive, both ways. */
export const PAIR: Partial<Record<Binyan, Binyan>> = {
  paal: 'nifal',
  nifal: 'paal',
  piel: 'pual',
  pual: 'piel',
  hifil: 'hufal',
  hufal: 'hifil',
};

/** The forms a card shows of each tense: where the stem changes, without the endings every binyan shares. */
export interface Model {
  infinitive?: Form;
  present: Record<'ms' | 'fs' | 'mp' | 'fp', Form>;
  past: Record<'3ms' | '3fs' | '1s' | '3p', Form>;
  future: Record<'1s' | '3ms' | '2fs' | '3mp', Form>;
}

const form = (nikud: string, plain: string, translit: string): Form => ({ nikud, plain, translit });

/** The conjugator's forms of פ־ע־ל (scripts/lib/binyanim.test.mjs keeps them equal). */
export const BINYAN_MODELS: Record<Binyan, Model> = {
  paal: {
    infinitive: form('לִפְעֹל', 'לפעול', 'лифоль'),
    present: {
      ms: form('פּוֹעֵל', 'פועל', 'поэль'),
      fs: form('פּוֹעֶלֶת', 'פועלת', 'поэлет'),
      mp: form('פּוֹעֲלִים', 'פועלים', 'поалим'),
      fp: form('פּוֹעֲלוֹת', 'פועלות', 'поалот'),
    },
    past: {
      '3ms': form('פָּעַל', 'פעל', 'пааль'),
      '3fs': form('פָּעֲלָה', 'פעלה', 'паала'),
      '1s': form('פָּעַלְתִּי', 'פעלתי', 'паальти'),
      '3p': form('פָּעֲלוּ', 'פעלו', 'паалу'),
    },
    future: {
      '1s': form('אֶפְעַל', 'אפעל', 'эфаль'),
      '3ms': form('יִפְעַל', 'יפעל', 'ифаль'),
      '2fs': form('תִּפְעֲלִי', 'תפעלי', 'тифали'),
      '3mp': form('יִפְעֲלוּ', 'יפעלו', 'ифалу'),
    },
  },
  nifal: {
    infinitive: form('לְהִפָּעֵל', 'להיפעל', 'леhипаэль'),
    present: {
      ms: form('נִפְעָל', 'נפעל', 'нифаль'),
      fs: form('נִפְעֶלֶת', 'נפעלת', 'нифэлет'),
      mp: form('נִפְעָלִים', 'נפעלים', 'нифалим'),
      fp: form('נִפְעָלוֹת', 'נפעלות', 'нифалот'),
    },
    past: {
      '3ms': form('נִפְעַל', 'נפעל', 'нифаль'),
      '3fs': form('נִפְעֲלָה', 'נפעלה', 'нифала'),
      '1s': form('נִפְעַלְתִּי', 'נפעלתי', 'нифальти'),
      '3p': form('נִפְעֲלוּ', 'נפעלו', 'нифалу'),
    },
    future: {
      '1s': form('אֶפָּעֵל', 'אפעל', 'эпаэль'),
      '3ms': form('יִפָּעֵל', 'ייפעל', 'ипаэль'),
      '2fs': form('תִּפָּעֲלִי', 'תיפעלי', 'типаали'),
      '3mp': form('יִפָּעֲלוּ', 'ייפעלו', 'ипаалу'),
    },
  },
  piel: {
    infinitive: form('לְפַעֵל', 'לפעל', 'лефаэль'),
    present: {
      ms: form('מְפַעֵל', 'מפעל', 'мефаэль'),
      fs: form('מְפַעֶלֶת', 'מפעלת', 'мефаэлет'),
      mp: form('מְפַעֲלִים', 'מפעלים', 'мефаалим'),
      fp: form('מְפַעֲלוֹת', 'מפעלות', 'мефаалот'),
    },
    past: {
      '3ms': form('פִּעֵל', 'פיעל', 'пиэль'),
      '3fs': form('פִּעֲלָה', 'פיעלה', 'пиала'),
      '1s': form('פִּעַלְתִּי', 'פיעלתי', 'пиальти'),
      '3p': form('פִּעֲלוּ', 'פיעלו', 'пиалу'),
    },
    future: {
      '1s': form('אֲפַעֵל', 'אפעל', 'афаэль'),
      '3ms': form('יְפַעֵל', 'יפעל', 'ефаэль'),
      '2fs': form('תְּפַעֲלִי', 'תפעלי', 'тефаали'),
      '3mp': form('יְפַעֲלוּ', 'יפעלו', 'ефаалу'),
    },
  },
  pual: {
    present: {
      ms: form('מְפֻעָל', 'מפועל', 'мефуаль'),
      fs: form('מְפֻעֶלֶת', 'מפועלת', 'мефуэлет'),
      mp: form('מְפֻעָלִים', 'מפועלים', 'мефуалим'),
      fp: form('מְפֻעָלוֹת', 'מפועלות', 'мефуалот'),
    },
    past: {
      '3ms': form('פֻּעַל', 'פועל', 'пуаль'),
      '3fs': form('פֻּעֲלָה', 'פועלה', 'пуала'),
      '1s': form('פֻּעַלְתִּי', 'פועלתי', 'пуальти'),
      '3p': form('פֻּעֲלוּ', 'פועלו', 'пуалу'),
    },
    future: {
      '1s': form('אֲפֻעַל', 'אפועל', 'афуаль'),
      '3ms': form('יְפֻעַל', 'יפועל', 'ефуаль'),
      '2fs': form('תְּפֻעֲלִי', 'תפועלי', 'тефуали'),
      '3mp': form('יְפֻעֲלוּ', 'יפועלו', 'ефуалу'),
    },
  },
  hifil: {
    infinitive: form('לְהַפְעִיל', 'להפעיל', 'леhафиль'),
    present: {
      ms: form('מַפְעִיל', 'מפעיל', 'мафиль'),
      fs: form('מַפְעִילָה', 'מפעילה', 'мафила'),
      mp: form('מַפְעִילִים', 'מפעילים', 'мафилим'),
      fp: form('מַפְעִילוֹת', 'מפעילות', 'мафилот'),
    },
    past: {
      '3ms': form('הִפְעִיל', 'הפעיל', 'hифиль'),
      '3fs': form('הִפְעִילָה', 'הפעילה', 'hифила'),
      '1s': form('הִפְעַלְתִּי', 'הפעלתי', 'hифальти'),
      '3p': form('הִפְעִילוּ', 'הפעילו', 'hифилу'),
    },
    future: {
      '1s': form('אַפְעִיל', 'אפעיל', 'афиль'),
      '3ms': form('יַפְעִיל', 'יפעיל', 'яфиль'),
      '2fs': form('תַּפְעִילִי', 'תפעילי', 'тафили'),
      '3mp': form('יַפְעִילוּ', 'יפעילו', 'яфилу'),
    },
  },
  hufal: {
    present: {
      ms: form('מֻפְעָל', 'מופעל', 'муфаль'),
      fs: form('מֻפְעֶלֶת', 'מופעלת', 'муфэлет'),
      mp: form('מֻפְעָלִים', 'מופעלים', 'муфалим'),
      fp: form('מֻפְעָלוֹת', 'מופעלות', 'муфалот'),
    },
    past: {
      '3ms': form('הֻפְעַל', 'הופעל', 'hуфаль'),
      '3fs': form('הֻפְעֲלָה', 'הופעלה', 'hуфала'),
      '1s': form('הֻפְעַלְתִּי', 'הופעלתי', 'hуфальти'),
      '3p': form('הֻפְעֲלוּ', 'הופעלו', 'hуфалу'),
    },
    future: {
      '1s': form('אֻפְעַל', 'אופעל', 'уфаль'),
      '3ms': form('יֻפְעַל', 'יופעל', 'юфаль'),
      '2fs': form('תֻּפְעֲלִי', 'תופעלי', 'туфали'),
      '3mp': form('יֻפְעֲלוּ', 'יופעלו', 'юфалу'),
    },
  },
  hitpael: {
    infinitive: form('לְהִתְפַּעֵל', 'להתפעל', 'леhитпаэль'),
    present: {
      ms: form('מִתְפַּעֵל', 'מתפעל', 'митпаэль'),
      fs: form('מִתְפַּעֶלֶת', 'מתפעלת', 'митпаэлет'),
      mp: form('מִתְפַּעֲלִים', 'מתפעלים', 'митпаалим'),
      fp: form('מִתְפַּעֲלוֹת', 'מתפעלות', 'митпаалот'),
    },
    past: {
      '3ms': form('הִתְפַּעֵל', 'התפעל', 'hитпаэль'),
      '3fs': form('הִתְפַּעֲלָה', 'התפעלה', 'hитпаала'),
      '1s': form('הִתְפַּעַלְתִּי', 'התפעלתי', 'hитпаальти'),
      '3p': form('הִתְפַּעֲלוּ', 'התפעלו', 'hитпаалу'),
    },
    future: {
      '1s': form('אֶתְפַּעֵל', 'אתפעל', 'этпаэль'),
      '3ms': form('יִתְפַּעֵל', 'יתפעל', 'итпаэль'),
      '2fs': form('תִּתְפַּעֲלִי', 'תתפעלי', 'титпаали'),
      '3mp': form('יִתְפַּעֲלוּ', 'יתפעלו', 'итпаалу'),
    },
  },
};

/** Frequent verbs with a strong root, where the model shows as it is; hitpael also with the swap of ת (הִסְתַּכֵּל). */
export const BINYAN_EXAMPLES: Record<Binyan, readonly string[]> = {
  paal: ['כתב', 'בדק', 'פגש', 'למד', 'לבש'],
  nifal: ['נכנס', 'נגמר', 'נפגש', 'נמשך', 'נכשל'],
  piel: ['דיבר', 'קיבל', 'סיפר', 'ביקש', 'שילם'],
  pual: ['בוצע', 'פוטר', 'תוקן', 'זומן', 'שולם'],
  hifil: ['הרגיש', 'הפסיק', 'הקשיב', 'המשיך', 'הזמין'],
  hufal: ['הוזמן', 'הושלם', 'הותקף', 'הושמד'],
  hitpael: ['התקשר', 'התקדם', 'התנצל', 'הסתכל', 'השתמש'],
};
