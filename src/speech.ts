// Hebrew speech through speechSynthesis (plan, section 7; after
// misparim/src/speech.ts). Without a Hebrew voice the app keeps its 🔊
// buttons disabled and tells how to install one.

/** The part of speechSynthesis the app uses; U is the utterance type. */
export interface Synth<U> {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: U): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

interface Utterance {
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
}

export interface Speaker {
  /** The Hebrew voice's name, null when there is none. */
  voice(): string | null;
  say(text: string): void;
  /** Calls `listener` when the voices change; returns a function that stops it. */
  watch(listener: () => void): () => void;
}

/** A little slower than the default, so a learner hears every vowel. */
const RATE = 0.9;

export function isHebrewVoice(voice: Pick<SpeechSynthesisVoice, 'lang'>): boolean {
  return /^(he|iw)([-_]|$)/iu.test(voice.lang);
}

export function createSpeaker<U extends Utterance>(synth: Synth<U> | null, utterance: (text: string) => U): Speaker {
  const hebrewVoice = () => synth?.getVoices().find(isHebrewVoice) ?? null;
  return {
    voice: () => hebrewVoice()?.name ?? null,
    say(text) {
      const voice = hebrewVoice();
      if (!synth || !voice) return;
      synth.cancel();
      const u = utterance(text);
      u.lang = voice.lang;
      u.voice = voice;
      u.rate = RATE;
      synth.speak(u);
    },
    watch(listener) {
      synth?.addEventListener('voiceschanged', listener);
      return () => synth?.removeEventListener('voiceschanged', listener);
    },
  };
}

/** The browser's speech, or a speaker without voices where there is no speechSynthesis. */
export function browserSpeaker(): Speaker {
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  return createSpeaker(supported ? window.speechSynthesis : null, (text) => new SpeechSynthesisUtterance(text));
}
