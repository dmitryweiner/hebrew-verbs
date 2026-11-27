import { describe, expect, it } from 'vitest';
import { GAMES, PARTS } from './games';
import { hashOf, isExercise, routeOf } from './routes';
import { BINYANIM } from './verbs';

describe('routes', () => {
  it('open a game of part 1 by its id, of parts 2–4 by form or person', () => {
    expect(routeOf('#/part/1/he-ru')).toEqual({ page: 'game', game: 'he-ru' });
    expect(routeOf('#/part/1/write')).toEqual({ page: 'game', game: 'write' });
    expect(routeOf('#/part/2/form')).toEqual({ page: 'game', game: 'present-form' });
    expect(routeOf('#/part/4/person')).toEqual({ page: 'game', game: 'future-person' });
  });

  it('give every game a hash that leads back to it', () => {
    expect(hashOf({ page: 'game', game: 'ru-he' })).toBe('#/part/1/ru-he');
    expect(hashOf({ page: 'game', game: 'past-form' })).toBe('#/part/3/form');
    for (const game of GAMES) expect(routeOf(hashOf({ page: 'game', game }))).toEqual({ page: 'game', game });
  });

  it("open a part's meeting with its verbs", () => {
    expect(routeOf('#/part/1/intro')).toEqual({ page: 'intro', part: 1 });
    expect(routeOf('#/part/4/intro')).toEqual({ page: 'intro', part: 4 });
    for (const { part } of PARTS) expect(routeOf(hashOf({ page: 'intro', part }))).toEqual({ page: 'intro', part });
    expect(hashOf({ page: 'intro', part: 3 })).toBe('#/part/3/intro');
  });

  it('open the settings, the progress and the home page', () => {
    expect(routeOf('#/settings')).toEqual({ page: 'settings' });
    expect(hashOf({ page: 'settings' })).toBe('#/settings');
    expect(routeOf('#/progress')).toEqual({ page: 'progress' });
    expect(hashOf({ page: 'progress' })).toBe('#/progress');
    expect(routeOf('#/about')).toEqual({ page: 'about' });
    expect(hashOf({ page: 'about' })).toBe('#/about');
    expect(routeOf('#/')).toEqual({ page: 'home' });
    expect(routeOf('')).toEqual({ page: 'home' });
    expect(hashOf({ page: 'home' })).toBe('#/');
  });

  it('open the dictionary with its query and a verb card by its id', () => {
    expect(routeOf('#/dict')).toEqual({ page: 'dict', query: '' });
    expect(hashOf({ page: 'dict', query: '' })).toBe('#/dict');
    expect(routeOf('#/dict?q=%D7%90%D7%9B%D7%9C')).toEqual({ page: 'dict', query: 'אכל' });
    expect(routeOf('#/dict?q=выйти+замуж')).toEqual({ page: 'dict', query: 'выйти замуж' });
    for (const query of ['אכלתי', 'кто я', 'כ.ת.ב', 'a&b=c'])
      expect(routeOf(hashOf({ page: 'dict', query }))).toEqual({ page: 'dict', query });
    expect(hashOf({ page: 'verb', id: 'דיבר' })).toBe(`#/dict/${encodeURIComponent('דיבר')}`);
    expect(routeOf(hashOf({ page: 'verb', id: 'דיבר' }))).toEqual({ page: 'verb', id: 'דיבר' });
    expect(routeOf('#/dict/דיבר')).toEqual({ page: 'verb', id: 'דיבר' });
  });

  it('open the menorah, with a binyan or without', () => {
    expect(routeOf('#/menorah')).toEqual({ page: 'menorah' });
    expect(hashOf({ page: 'menorah' })).toBe('#/menorah');
    expect(routeOf('#/menorah/piel')).toEqual({ page: 'menorah', binyan: 'piel' });
    expect(hashOf({ page: 'menorah', binyan: 'piel' })).toBe('#/menorah/piel');
    for (const binyan of BINYANIM) expect(routeOf(hashOf({ page: 'menorah', binyan }))).toEqual({ page: 'menorah', binyan });
  });

  it('tell a game and a meeting, where the header hides its links and a new version waits', () => {
    for (const hash of ['#/part/1/he-ru', '#/part/4/person', '#/part/1/intro', '#/part/3/intro'])
      expect(isExercise(routeOf(hash))).toBe(true);
    for (const hash of ['#/', '#/settings', '#/progress', '#/about', '#/dict', '#/dict/דיבר', '#/menorah', '#/menorah/piel'])
      expect(isExercise(routeOf(hash))).toBe(false);
  });

  it('send an unknown or broken hash home', () => {
    for (const hash of [
      '#/part/1/form',
      '#/part/2/he-ru',
      '#/part/5/form',
      '#/part/1',
      '#/nothing',
      '#settings/x',
      '#/dict/%E0%A4%A',
      '#/dict/',
      '#/menorah/qal',
      '#/menorah/',
      '#/progress/he-ru',
      '#/part/5/intro',
      '#/part/0/intro',
      '#/about/x',
    ])
      expect(routeOf(hash)).toEqual({ page: 'home' });
  });
});
