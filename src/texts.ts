/**
 * Every interface text. The app is Russian only (no i18n, see AGENTS.md);
 * index.html repeats the few texts shown before the script runs, and a test
 * keeps them equal.
 */
export const texts = {
  title: 'Глаголы иврита',
  description: 'Тренажёр тысячи самых частотных глаголов иврита: значение, настоящее, прошедшее и будущее время.',
  heading: 'Глаголы иврита',
  intro: 'Тысяча самых частотных глаголов иврита: значение, настоящее, прошедшее и будущее время.',
  source: 'Исходный код',
  loading: 'Загрузка глаголов…',
  loadFailed: 'Не удалось загрузить глаголы. Обновите страницу.',
  settingsLink: 'Настройки',
  home: {
    hint: 'Начните с части 1: значения глаголов. Все части открыты сразу.',
    learned: 'выучено {learned} из {open}',
    soon: 'скоро',
  },
  parts: { 1: 'Часть 1. Глаголы', 2: 'Часть 2. Настоящее время', 3: 'Часть 3. Прошедшее время', 4: 'Часть 4. Будущее время' },
  games: {
    'he-ru': 'Иврит → русский',
    'ru-he': 'Русский → иврит',
    write: 'Напиши на иврите',
    'present-form': 'Местоимение → форма',
    'present-person': 'Форма → местоимение',
    'past-form': 'Местоимение → форма',
    'past-person': 'Форма → местоимение',
    'future-form': 'Местоимение → форма',
    'future-person': 'Форма → местоимение',
  },
  game: {
    quit: '← Выйти',
    count: 'Задание {n} из {total}',
    task: { 'he-ru': 'Выберите перевод', 'ru-he': 'Выберите глагол на иврите', write: 'Напишите инфинитив на иврите' },
    /** The write task for a verb without an infinitive (pual, hufal): its headword is the past "он". */
    taskNoInfinitive: 'Инфинитива нет — напишите прошедшее время «он»',
    noInfinitive: 'нет инфинитива',
    listen: 'Послушать',
    noVoice: 'Нет голоса иврита — как установить, см. в настройках',
    answerLabel: 'Ответ на иврите',
    check: 'Проверить',
    dontKnow: 'Не знаю',
    right: 'Верно!',
    wrong: 'Неверно',
    finalLetters: 'Засчитано, но проверьте конечные буквы:',
    otherVerb: 'Это другой глагол с тем же переводом — тоже верно.',
    next: 'Дальше',
    results: 'Итоги',
  },
  summary: {
    heading: 'Итоги раунда',
    score: '{right} из {total}',
    perfect: 'Без ошибок!',
    retry: 'Повторить ошибки',
    again: 'Ещё раунд',
    home: 'К частям',
  },
  settings: {
    heading: 'Настройки',
    nikud: 'Огласовки',
    nikudNote: 'Формы с огласовками, как в словаре (דִּבֵּר); без них — полное написание (דיבר). Действует с нового раунда.',
    translit: 'Транслитерация',
    translitNote: 'Произношение кириллицей под словом на иврите.',
    autoNext: 'Автопереход',
    autoNextNote: 'После верного ответа следующее задание открывается само через полторы секунды. После ошибки игра всегда ждёт «Дальше».',
    voice: 'Озвучка',
    voiceFound: 'Голос иврита: {name}.',
    voiceMissing: 'Голоса иврита нет, кнопки 🔊 неактивны. Его можно установить в системе:',
    voiceHowTo: [
      'Android: Настройки → Специальные возможности → Синтез речи → Синтезатор Google → Установка голосовых данных → иврит.',
      'iPhone, iPad: Настройки → Универсальный доступ → Устное содержимое → Голоса → иврит.',
      'Windows: Параметры → Время и язык → Речь → Добавить голоса → иврит.',
      'macOS: Системные настройки → Универсальный доступ → Устное содержимое → Системный голос → Управлять голосами → иврит.',
    ],
    voiceReload: 'После установки перезапустите браузер.',
    done: 'Готово',
  },
  /** Pronoun labels (src/persons.ts); мы has a gender in the present only. */
  persons: {
    'ani-m': 'я (м.)',
    'ani-f': 'я (ж.)',
    ata: 'ты (м.)',
    at: 'ты (ж.)',
    hu: 'он',
    hi: 'она',
    anachnu: 'мы',
    'anachnu-m': 'мы (м.)',
    'anachnu-f': 'мы (ж.)',
    atem: 'вы (м.)',
    aten: 'вы (ж.)',
    hem: 'они (м.)',
    hen: 'они (ж.)',
  },
};

/** A text with its {name} placeholders filled. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));
}
