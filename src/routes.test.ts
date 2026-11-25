import { describe, expect, it } from 'vitest';
import { GAMES } from './games';
import { hashOf, routeOf } from './routes';

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

  it('send an unknown or broken hash home', () => {
    for (const hash of ['#/part/1/form', '#/part/2/he-ru', '#/part/5/form', '#/part/1', '#/nothing', '#settings/x'])
      expect(routeOf(hash)).toEqual({ page: 'home' });
  });
});
