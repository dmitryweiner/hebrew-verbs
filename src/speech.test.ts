import { describe, expect, it, vi } from 'vitest';
import { createSpeaker, isHebrewVoice, type Synth } from './speech';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
}

function fakeSynth(langs: string[]) {
  const listeners = new Set<() => void>();
  const synth = {
    voices: langs.map((lang) => ({ lang, name: `voice ${lang}` }) as SpeechSynthesisVoice),
    spoken: [] as FakeUtterance[],
    getVoices: () => synth.voices,
    speak: (u: FakeUtterance) => synth.spoken.push(u),
    cancel: vi.fn<() => void>(),
    addEventListener: (_: 'voiceschanged', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'voiceschanged', l: () => void) => listeners.delete(l),
    fire: () => listeners.forEach((l) => l()),
    listeners,
  };
  return synth;
}
const utterance = (text: string): FakeUtterance => ({ text, lang: '', voice: null, rate: 1 });

describe('speech', () => {
  it('knows a Hebrew voice by its language, old code iw included', () => {
    expect(['he-IL', 'he', 'iw_IL', 'HE-il'].every((lang) => isHebrewVoice({ lang }))).toBe(true);
    expect(['en-US', 'hr-HR', 'hev'].some((lang) => isHebrewVoice({ lang }))).toBe(false);
  });

  it('says a text with the Hebrew voice, stopping what it was saying', () => {
    const synth = fakeSynth(['en-US', 'he-IL']);
    const speaker = createSpeaker(synth satisfies Synth<FakeUtterance>, utterance);
    expect(speaker.voice()).toBe('voice he-IL');
    speaker.say('שָׁלוֹם');
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: 'שָׁלוֹם', lang: 'he-IL', voice: synth.voices[1] });
  });

  it('stays silent without a Hebrew voice or without speech at all', () => {
    const synth = fakeSynth(['en-US']);
    const speaker = createSpeaker(synth, utterance);
    expect(speaker.voice()).toBeNull();
    speaker.say('שָׁלוֹם');
    expect(synth.spoken).toEqual([]);
    expect(createSpeaker(null, utterance).voice()).toBeNull();
  });

  it('reports voices that load later (Chrome loads them after the page)', () => {
    const synth = fakeSynth([]);
    const speaker = createSpeaker(synth, utterance);
    const changed = vi.fn<() => void>();
    const stop = speaker.watch(changed);
    synth.voices.push({ lang: 'he-IL', name: 'Carmit' } as SpeechSynthesisVoice);
    synth.fire();
    expect(changed).toHaveBeenCalledOnce();
    expect(speaker.voice()).toBe('Carmit');
    stop();
    expect(synth.listeners.size).toBe(0);
  });
});
