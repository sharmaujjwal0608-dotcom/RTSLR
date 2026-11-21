"use client";

/**
 * React binding for the speech store. Speech stops when the last component
 * using the store unmounts.
 *
 *   const speech = useSpeech();
 *   const result = speech.speak(transcript.text, transcript.outputLanguage);
 *   if (!result.ok && result.reason === "network_consent_required") { ...warn, then
 *     speech.acceptNetworkVoice() and speak again from the user's click... }
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  createSpeechStore,
  selectVoice,
  type SpeakResult,
  type SpeechState,
  type SpeechStore,
  type VoiceChoice,
} from "./speech";
import type { OutputLanguage } from "./vocabulary";

export type UseSpeechOptions = {
  /** Inject a store (tests, or sharing one store between components). */
  store?: SpeechStore;
};

export type UseSpeechResult = {
  /** False during server render and the first client render. */
  ready: boolean;
  supported: boolean;
  /** "unsupported" once the browser is known to lack speech synthesis. */
  state: SpeechState;
  voices: readonly SpeechSynthesisVoice[];
  /** Voice that will be used per language, with its local/network flags. */
  voice: Readonly<Record<OutputLanguage, VoiceChoice>>;
  /** True when speaking that language would use a network voice: show the
   *  warning that text may be sent to the browser vendor. */
  networkVoice: Readonly<Record<OutputLanguage, boolean>>;
  networkVoiceAccepted: boolean;
  acceptNetworkVoice: () => void;
  rate: number;
  setRate: (rate: number) => void;
  selectedVoiceURI: Readonly<Record<OutputLanguage, string | null>>;
  setVoice: (language: OutputLanguage, voiceURI: string | null) => void;
  speak: (text: string, language: OutputLanguage) => SpeakResult;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Error code of the last failed utterance, or null. */
  error: string | null;
};

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechResult {
  const [store] = useState<SpeechStore>(() => options.store ?? createSpeechStore());
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const voice = useMemo(
    () => ({
      en: selectVoice(snapshot.voices, "en", snapshot.voiceURI.en),
      hi: selectVoice(snapshot.voices, "hi", snapshot.voiceURI.hi),
    }),
    [snapshot.voices, snapshot.voiceURI],
  );

  return useMemo(
    () => ({
      ready: snapshot.ready,
      supported: snapshot.supported,
      state: snapshot.state,
      voices: snapshot.voices,
      voice,
      networkVoice: { en: voice.en.network, hi: voice.hi.network },
      networkVoiceAccepted: snapshot.networkVoiceAccepted,
      acceptNetworkVoice: store.acceptNetworkVoice,
      rate: snapshot.rate,
      setRate: store.setRate,
      selectedVoiceURI: snapshot.voiceURI,
      setVoice: store.setVoice,
      speak: store.speak,
      pause: store.pause,
      resume: store.resume,
      stop: store.stop,
      error: snapshot.error,
    }),
    [snapshot, store, voice],
  );
}
