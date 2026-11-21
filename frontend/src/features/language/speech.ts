/**
 * Web Speech synthesis wrapper for the transcript.
 *
 * Privacy (CAM-18): a voice with `localService === true` is synthesised on the
 * device. Any other voice may send the text to the browser vendor's speech
 * service. This module always prefers a local voice, exposes whether the voice
 * it would use is a network voice, and refuses to speak through a network voice
 * until the caller has recorded the user's acceptance.
 *
 * Speech reads the transcript text aloud. It does not translate anything.
 */

import type { OutputLanguage } from "./vocabulary";

export type SpeechState = "idle" | "speaking" | "paused" | "unsupported";

export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 2;
export const SPEECH_RATE_DEFAULT = 1;

/** BCP 47 tag requested when no voice object is available for the language. */
export const SPEECH_LANG_TAG: Record<OutputLanguage, string> = { en: "en-IN", hi: "hi-IN" };

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return SPEECH_RATE_DEFAULT;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
}

/* ------------------------------------------------------------------ */
/* Feature detection and voices                                        */
/* ------------------------------------------------------------------ */

export function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  const synth = (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const hasUtterance = typeof (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance === "function";
  return synth && hasUtterance ? synth : null;
}

export function isSpeechSupported(): boolean {
  return getSpeechSynthesis() !== null;
}

/**
 * Resolves with the voice list. Browsers that load voices asynchronously
 * return an empty list first and fire `voiceschanged` later; this waits for
 * that event, up to `timeoutMs`, and then resolves with whatever exists.
 */
export function loadVoices(synth: SpeechSynthesis, timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", finish);
  });
}

const tagOf = (voice: SpeechSynthesisVoice) => voice.lang.replace(/_/g, "-").toLowerCase();

export type VoiceChoice = {
  /** Voice that would be used, or null when none matches the language. */
  voice: SpeechSynthesisVoice | null;
  /** The chosen voice is synthesised on the device. */
  local: boolean;
  /** A voice was chosen and it is NOT local: text may leave the device. */
  network: boolean;
  /** Voices exist for the language, but none of them is local. */
  networkOnly: boolean;
  /** region: en-IN / hi-IN. language: another en-* / hi-* voice. */
  match: "region" | "language" | "none";
};

/**
 * Picks the voice for an output language.
 * Order: local en-IN/hi-IN, local other region, network en-IN/hi-IN, network
 * other region. A `preferredVoiceURI` chosen by the user wins when it belongs
 * to the language. Never returns a voice of a different language.
 */
export function selectVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: OutputLanguage,
  preferredVoiceURI?: string | null,
): VoiceChoice {
  const region = SPEECH_LANG_TAG[language].toLowerCase();
  const candidates = voices.filter((v) => {
    const tag = tagOf(v);
    return tag === language || tag.startsWith(`${language}-`);
  });
  const networkOnly = candidates.length > 0 && !candidates.some((v) => v.localService === true);
  const describe = (voice: SpeechSynthesisVoice): VoiceChoice => ({
    voice,
    local: voice.localService === true,
    network: voice.localService !== true,
    networkOnly,
    match: tagOf(voice) === region ? "region" : "language",
  });

  const preferred = preferredVoiceURI ? candidates.find((v) => v.voiceURI === preferredVoiceURI) : undefined;
  if (preferred) return describe(preferred);

  const score = (v: SpeechSynthesisVoice) =>
    (v.localService === true ? 100 : 0) + (tagOf(v) === region ? 10 : 0) + (v.default ? 1 : 0);
  let best: SpeechSynthesisVoice | null = null;
  for (const v of candidates) if (best === null || score(v) > score(best)) best = v;
  return best ? describe(best) : { voice: null, local: false, network: false, networkOnly: false, match: "none" };
}

/* ------------------------------------------------------------------ */
/* Text preparation                                                    */
/* ------------------------------------------------------------------ */

export type SpeechSegment = { text: string; language: OutputLanguage };

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

/**
 * Turns transcript text into utterances.
 *  - Each word is spoken by the voice of its script: Devanagari by the Hindi
 *    voice, Latin by the English voice. So in Hindi output, fingerspelled Latin
 *    letters and labels with no Hindi mapping are still read as English.
 *  - A fingerspelled word arrives as a run of capitals ("CAT"). Runs of two or
 *    more capitals are lower-cased so the voice says the word instead of
 *    spelling it. A single capital is left alone and is read as a letter.
 *  - Line breaks split utterances.
 */
export function prepareSpeech(text: string, language: OutputLanguage): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  for (const line of text.split(/\r?\n/)) {
    let current: SpeechSegment | null = null;
    let neutral: string[] = []; // digits/punctuation seen before any letters
    for (const word of line.split(/\s+/)) {
      if (word === "") continue;
      const script: OutputLanguage | null = DEVANAGARI.test(word) ? "hi" : LATIN.test(word) ? "en" : null;
      const spoken = word.replace(/[A-Z]{2,}/g, (run) => run.toLowerCase());
      if (script === null) {
        if (current) current.text += ` ${spoken}`;
        else neutral.push(spoken);
        continue;
      }
      if (current && current.language === script) {
        current.text += ` ${spoken}`;
      } else {
        current = { text: [...neutral, spoken].join(" "), language: script };
        neutral = [];
        segments.push(current);
      }
    }
    if (!current && neutral.length > 0) segments.push({ text: neutral.join(" "), language });
  }
  return segments;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type SpeakFailure = "unsupported" | "empty" | "no_voice" | "network_consent_required";

export type SpeakResult =
  | { ok: true; segments: number; usedNetworkVoice: boolean }
  | { ok: false; reason: SpeakFailure; language?: OutputLanguage };

export type SpeechSnapshot = {
  /** False until the store has looked for speech support in the browser. */
  ready: boolean;
  supported: boolean;
  state: SpeechState;
  voices: readonly SpeechSynthesisVoice[];
  rate: number;
  /** Voice the user picked per language, or null for automatic selection. */
  voiceURI: Readonly<Record<OutputLanguage, string | null>>;
  /** The user has been warned about, and accepted, a network voice. */
  networkVoiceAccepted: boolean;
  /** `SpeechSynthesisErrorEvent.error` of the last failed utterance. */
  error: string | null;
};

export type SpeechStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SpeechSnapshot;
  getServerSnapshot(): SpeechSnapshot;
  /** Voice that `speak` would use for a language right now. */
  voiceFor(language: OutputLanguage): VoiceChoice;
  /** Stops anything in progress, then speaks `text`. `language` is the output
   *  language; it decides the voice for text without letters. */
  speak(text: string, language: OutputLanguage): SpeakResult;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  setVoice(language: OutputLanguage, voiceURI: string | null): void;
  /** Record that the user accepted sending text to a network voice. Memory only. */
  acceptNetworkVoice(): void;
};

export type SpeechEnvironment = {
  /** Defaults to window.speechSynthesis; null forces "unsupported". */
  synth?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
};

const SERVER_SNAPSHOT: SpeechSnapshot = Object.freeze({
  ready: false,
  supported: false,
  state: "idle",
  voices: Object.freeze([]) as readonly SpeechSynthesisVoice[],
  rate: SPEECH_RATE_DEFAULT,
  voiceURI: Object.freeze({ en: null, hi: null }),
  networkVoiceAccepted: false,
  error: null,
});

export function createSpeechStore(env: SpeechEnvironment = {}): SpeechStore {
  const listeners = new Set<() => void>();
  let snapshot: SpeechSnapshot = SERVER_SNAPSHOT;
  let synth: SpeechSynthesis | null = null;
  let attached = false;
  /** Bumped on every speak/stop so events from cancelled utterances are ignored. */
  let generation = 0;
  let remaining = 0;
  /** Held so the browser cannot garbage-collect a queued utterance (which
   *  drops its `end` event in Chromium). */
  let active: SpeechSynthesisUtterance[] = [];

  const set = (patch: Partial<SpeechSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  const refreshVoices = () => {
    if (synth) set({ voices: synth.getVoices() });
  };

  const attach = () => {
    if (attached) return;
    attached = true;
    synth = env.synth === undefined ? getSpeechSynthesis() : env.synth;
    if (!synth) {
      set({ ready: true, supported: false, state: "unsupported" });
      return;
    }
    synth.addEventListener?.("voiceschanged", refreshVoices);
    set({ ready: true, supported: true, state: "idle", voices: synth.getVoices() });
  };

  const halt = () => {
    generation++;
    remaining = 0;
    active = [];
    if (!synth) return;
    // Some engines stay paused after cancel() and then swallow the next speak().
    if (snapshot.state === "paused") synth.resume();
    synth.cancel();
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
    if (synth) {
      synth.removeEventListener?.("voiceschanged", refreshVoices);
      // Cancel on unmount, but only speech this store started.
      if (snapshot.state === "speaking" || snapshot.state === "paused") halt();
    }
    synth = null;
    snapshot = { ...snapshot, state: "idle", ready: false };
  };

  const voiceFor = (language: OutputLanguage) =>
    selectVoice(snapshot.voices, language, snapshot.voiceURI[language]);

  const createUtterance = env.createUtterance ?? ((text: string) => new SpeechSynthesisUtterance(text));

  return {
    subscribe(listener) {
      listeners.add(listener);
      attach();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) detach();
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    voiceFor,

    speak(text, language) {
      attach();
      if (!synth) return { ok: false, reason: "unsupported" };
      const segments = prepareSpeech(text, language);
      if (segments.length === 0) return { ok: false, reason: "empty" };

      const listed = snapshot.voices.length > 0;
      const choices = new Map<OutputLanguage, VoiceChoice>();
      for (const segment of segments) {
        if (choices.has(segment.language)) continue;
        const choice = voiceFor(segment.language);
        // Never read Hindi with an English voice or the reverse.
        if (listed && !choice.voice) return { ok: false, reason: "no_voice", language: segment.language };
        choices.set(segment.language, choice);
      }
      // No voice object (empty list) means the engine picks one we cannot
      // inspect, so it is treated as a possible network voice.
      const usedNetworkVoice = [...choices.values()].some((c) => !c.local);
      if (usedNetworkVoice && !snapshot.networkVoiceAccepted) {
        const language = [...choices].find(([, c]) => !c.local)?.[0];
        return { ok: false, reason: "network_consent_required", language };
      }

      halt();
      const run = generation;
      remaining = segments.length;
      const settle = (error: string | null) => {
        if (run !== generation) return;
        if (error !== null) {
          halt();
          set({ state: "idle", error });
          return;
        }
        remaining--;
        if (remaining <= 0) {
          active = [];
          set({ state: "idle" });
        }
      };
      active = segments.map((segment) => {
        const utterance = createUtterance(segment.text);
        const voice = choices.get(segment.language)?.voice ?? null;
        utterance.voice = voice;
        utterance.lang = voice ? voice.lang.replace(/_/g, "-") : SPEECH_LANG_TAG[segment.language];
        utterance.rate = snapshot.rate;
        utterance.onend = () => settle(null);
        utterance.onerror = (event) => {
          const code = (event as SpeechSynthesisErrorEvent).error ?? "unknown";
          // cancel() reports these on the utterances it removes; not failures.
          settle(code === "canceled" || code === "interrupted" ? null : code);
        };
        return utterance;
      });
      set({ state: "speaking", error: null });
      for (const utterance of active) synth.speak(utterance);
      return { ok: true, segments: segments.length, usedNetworkVoice };
    },

    pause() {
      if (!synth || snapshot.state !== "speaking") return;
      synth.pause();
      set({ state: "paused" });
    },

    resume() {
      if (!synth || snapshot.state !== "paused") return;
      synth.resume();
      set({ state: "speaking" });
    },

    stop() {
      if (!synth) return;
      halt();
      if (snapshot.state !== "idle") set({ state: "idle" });
    },

    setRate(rate) {
      set({ rate: clampRate(rate) });
    },

    setVoice(language, voiceURI) {
      set({ voiceURI: { ...snapshot.voiceURI, [language]: voiceURI } });
    },

    acceptNetworkVoice() {
      if (!snapshot.networkVoiceAccepted) set({ networkVoiceAccepted: true });
    },
  };
}
