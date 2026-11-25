import { describe, expect, it } from 'vitest';
import { normalizeInput, regularLetters, stripNikud } from './hebrew';

describe('stripNikud', () => {
  it('removes vowel points, dagesh, shin dots and cantillation', () => {
    expect(stripNikud('דִּבֵּר')).toBe('דבר');
    expect(stripNikud('שָׁמַרְתְּ')).toBe('שמרת');
    expect(stripNikud('לֶאֱכֹל')).toBe('לאכל');
    expect(stripNikud('בְּרֵאשִׁ֖ית')).toBe('בראשית');
  });

  it('keeps the maqaf between root letters', () => {
    expect(stripNikud('כ־ת־ב')).toBe('כ־ת־ב');
  });
});

describe('regularLetters', () => {
  it('turns final letters into regular ones', () => {
    expect(regularLetters('ךםןףץ')).toBe('כמנפצ');
    expect(regularLetters('אכלתם')).toBe('אכלתמ');
  });
});

describe('normalizeInput', () => {
  it('trims, collapses spaces and drops nikud', () => {
    expect(normalizeInput('  לְדַבֵּר  ')).toBe('לדבר');
    expect(normalizeInput('אני   אוכל')).toBe('אני אוכל');
  });

  it('drops direction marks a phone keyboard may insert', () => {
    expect(normalizeInput('‏לדבר‎')).toBe('לדבר');
  });

  it('reads presentation forms as plain letters', () => {
    expect(normalizeInput('שׁמר')).toBe('שמר');
  });
});
