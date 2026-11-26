import { describe, expect, it } from 'vitest';
import { GAMES } from './games';
import { hashOf, menorahHash, routeOf } from './routes';

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

  it('open the settings and the home page', () => {
    expect(routeOf('#/settings')).toEqual({ page: 'settings' });
    expect(hashOf({ page: 'settings' })).toBe('#/settings');
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

  it('give each binyan a hash of the menorah', () => {
    expect(menorahHash('piel')).toBe('#/menorah/piel');
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
    ])
      expect(routeOf(hash)).toEqual({ page: 'home' });
  });
});
