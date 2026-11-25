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
  soon: 'Приложение в разработке — упражнения появятся здесь.',
  source: 'Исходный код',
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
