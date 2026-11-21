import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  clampRate,
  createSpeechStore,
  loadVoices,
  prepareSpeech,
  selectVoice,
} from "./speech";

function voice(name: string, lang: string, localService: boolean, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, localService, default: isDefault, voiceURI: `uri:${name}` };
}

type FakeUtterance = {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

/** Minimal speechSynthesis double: a queue plus the voiceschanged event. */
function createFakeSynth(initialVoices: SpeechSynthesisVoice[] = []) {
  let voices = initialVoices;
  const listeners = new Set<() => void>();
  const queue: FakeUtterance[] = [];
  const synth = {
    queue,
    getVoices: vi.fn(() => voices),
    speak: vi.fn((u: FakeUtterance) => {
      queue.push(u);
    }),
    cancel: vi.fn(() => {
      const dropped = queue.splice(0);
      for (const u of dropped) u.onerror?.({ error: "canceled" });
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    addEventListener: vi.fn((_type: string, l: () => void) => listeners.add(l)),
    removeEventListener: vi.fn((_type: string, l: () => void) => listeners.delete(l)),
    setVoices(next: SpeechSynthesisVoice[]) {
      voices = next;
      listeners.forEach((l) => l());
    },
    finishNext() {
      queue.shift()?.onend?.();
    },
    failNext(error: string) {
      queue.shift()?.onerror?.({ error });
    },
    listenerCount: () => listeners.size,
  };
  return synth;
}

function createStore(synth: ReturnType<typeof createFakeSynth> | null) {
  const store = createSpeechStore({
    synth: synth as unknown as SpeechSynthesis | null,
    createUtterance: (text) =>
      ({ text, lang: "", voice: null, rate: 1, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance,
  });
  const unsubscribe = store.subscribe(() => {});
  return { store, unsubscribe };
}

const EN_IN_LOCAL = voice("Local en-IN", "en-IN", true);
const EN_US_LOCAL = voice("Local en-US", "en-US", true, true);
const EN_IN_NET = voice("Network en-IN", "en-IN", false);
const EN_GB_NET = voice("Network en-GB", "en-GB", false);
const HI_LOCAL = voice("Local hi-IN", "hi_IN", true);
const HI_NET = voice("Network hi-IN", "hi-IN", false);
const FR_LOCAL = voice("Local fr-FR", "fr-FR", true, true);

afterEach(() => {
  vi.useRealTimers();
});

describe("selectVoice", () => {
  it("prefers a local en-IN voice over everything else", () => {
    const choice = selectVoice([EN_GB_NET, EN_US_LOCAL, EN_IN_NET, EN_IN_LOCAL], "en");
    expect(choice).toMatchObject({ voice: EN_IN_LOCAL, local: true, network: false, networkOnly: false, match: "region" });
  });

  it("prefers a local voice of another region over a network en-IN voice", () => {
    const choice = selectVoice([EN_IN_NET, EN_US_LOCAL], "en");
    expect(choice).toMatchObject({ voice: EN_US_LOCAL, local: true, network: false, match: "language" });
  });

  it("flags the case where only network voices exist", () => {
    const choice = selectVoice([EN_GB_NET, EN_IN_NET, FR_LOCAL], "en");
    expect(choice).toMatchObject({ voice: EN_IN_NET, local: false, network: true, networkOnly: true, match: "region" });
  });

  it("selects Hindi voices by language, accepting the hi_IN spelling", () => {
    expect(selectVoice([EN_IN_LOCAL, HI_NET, HI_LOCAL], "hi")).toMatchObject({ voice: HI_LOCAL, local: true });
    expect(selectVoice([EN_IN_LOCAL, HI_NET], "hi")).toMatchObject({ voice: HI_NET, network: true, networkOnly: true });
  });

  it("never substitutes a voice of another language", () => {
    expect(selectVoice([EN_IN_LOCAL, FR_LOCAL], "hi")).toEqual({
      voice: null,
      local: false,
      network: false,
      networkOnly: false,
      match: "none",
    });
    expect(selectVoice([], "en").voice).toBeNull();
  });

  it("does not treat a missing localService flag as local", () => {
    const unknown = { ...EN_IN_LOCAL, localService: undefined } as unknown as SpeechSynthesisVoice;
    expect(selectVoice([unknown], "en")).toMatchObject({ local: false, network: true, networkOnly: true });
  });

  it("honours the user's voice only when it belongs to the language", () => {
    const voices = [EN_IN_LOCAL, EN_GB_NET, HI_LOCAL];
    expect(selectVoice(voices, "en", EN_GB_NET.voiceURI)).toMatchObject({ voice: EN_GB_NET, network: true, networkOnly: false });
    expect(selectVoice(voices, "en", HI_LOCAL.voiceURI).voice).toBe(EN_IN_LOCAL);
  });
});

describe("prepareSpeech", () => {
  it("speaks fingerspelled words as words and isolated letters as letters", () => {
    expect(prepareSpeech("CAT", "en")).toEqual([{ text: "cat", language: "en" }]);
    expect(prepareSpeech("A", "en")).toEqual([{ text: "A", language: "en" }]);
    expect(prepareSpeech("HELLO A B", "en")).toEqual([{ text: "hello A B", language: "en" }]);
    expect(prepareSpeech("Hello World", "en")).toEqual([{ text: "Hello World", language: "en" }]);
  });

  it("routes each script to its own voice in Hindi output", () => {
    expect(prepareSpeech("नमस्ते RAM धन्यवाद", "hi")).toEqual([
      { text: "नमस्ते", language: "hi" },
      { text: "ram", language: "en" },
      { text: "धन्यवाद", language: "hi" },
    ]);
  });

  it("keeps digits and punctuation with their neighbours and splits on line breaks", () => {
    expect(prepareSpeech("42 HELLO 7\nपानी", "en")).toEqual([
      { text: "42 hello 7", language: "en" },
      { text: "पानी", language: "hi" },
    ]);
    expect(prepareSpeech("123", "hi")).toEqual([{ text: "123", language: "hi" }]);
    expect(prepareSpeech("  \n ", "en")).toEqual([]);
  });
});

describe("loadVoices", () => {
  it("resolves at once when voices are already there", async () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    await expect(loadVoices(synth as unknown as SpeechSynthesis)).resolves.toEqual([EN_IN_LOCAL]);
    expect(synth.addEventListener).not.toHaveBeenCalled();
  });

  it("waits for voiceschanged when the list starts empty", async () => {
    const synth = createFakeSynth();
    const pending = loadVoices(synth as unknown as SpeechSynthesis, 5000);
    synth.setVoices([HI_LOCAL]);
    await expect(pending).resolves.toEqual([HI_LOCAL]);
    expect(synth.listenerCount()).toBe(0);
  });

  it("gives up after the timeout and resolves with what exists", async () => {
    vi.useFakeTimers();
    const synth = createFakeSynth();
    const pending = loadVoices(synth as unknown as SpeechSynthesis, 300);
    vi.advanceTimersByTime(300);
    await expect(pending).resolves.toEqual([]);
    expect(synth.listenerCount()).toBe(0);
  });
});

describe("speech store", () => {
  it("reports unsupported when there is no speechSynthesis", () => {
    const { store } = createStore(null);
    expect(store.getSnapshot()).toMatchObject({ ready: true, supported: false, state: "unsupported" });
    expect(store.speak("HELLO", "en")).toEqual({ ok: false, reason: "unsupported" });
    expect(store.getServerSnapshot()).toMatchObject({ ready: false, supported: false, state: "idle" });
  });

  it("picks up voices that arrive later through voiceschanged", () => {
    const synth = createFakeSynth();
    const { store } = createStore(synth);
    expect(store.getSnapshot().voices).toEqual([]);
    synth.setVoices([EN_IN_LOCAL, HI_NET]);
    expect(store.getSnapshot().voices).toHaveLength(2);
    expect(store.voiceFor("en")).toMatchObject({ voice: EN_IN_LOCAL, local: true });
    expect(store.voiceFor("hi")).toMatchObject({ network: true, networkOnly: true });
  });

  it("speaks with the local voice, the chosen rate, and returns to idle", () => {
    const synth = createFakeSynth([EN_US_LOCAL, EN_IN_LOCAL]);
    const { store } = createStore(synth);
    store.setRate(1.5);
    expect(store.speak("CAT A", "en")).toEqual({ ok: true, segments: 1, usedNetworkVoice: false });
    expect(store.getSnapshot().state).toBe("speaking");
    expect(synth.queue).toHaveLength(1);
    expect(synth.queue[0]).toMatchObject({ text: "cat A", voice: EN_IN_LOCAL, lang: "en-IN", rate: 1.5 });
    synth.finishNext();
    expect(store.getSnapshot().state).toBe("idle");
  });

  it("queues one utterance per script and stays speaking until the last ends", () => {
    const synth = createFakeSynth([EN_IN_LOCAL, HI_LOCAL]);
    const { store } = createStore(synth);
    expect(store.speak("नमस्ते RAM", "hi")).toMatchObject({ ok: true, segments: 2 });
    expect(synth.queue.map((u) => [u.text, u.voice, u.lang])).toEqual([
      ["नमस्ते", HI_LOCAL, "hi-IN"],
      ["ram", EN_IN_LOCAL, "en-IN"],
    ]);
    synth.finishNext();
    expect(store.getSnapshot().state).toBe("speaking");
    synth.finishNext();
    expect(store.getSnapshot().state).toBe("idle");
  });

  it("refuses a network voice until the user accepts, then says it used one", () => {
    const synth = createFakeSynth([EN_IN_LOCAL, HI_NET]);
    const { store } = createStore(synth);
    expect(store.speak("नमस्ते", "hi")).toEqual({ ok: false, reason: "network_consent_required", language: "hi" });
    expect(synth.speak).not.toHaveBeenCalled();
    expect(store.getSnapshot().state).toBe("idle");
    // English alone needs no consent: its voice is local.
    expect(store.speak("HELLO", "en")).toMatchObject({ ok: true, usedNetworkVoice: false });
    store.stop();
    store.acceptNetworkVoice();
    expect(store.speak("नमस्ते", "hi")).toEqual({ ok: true, segments: 1, usedNetworkVoice: true });
    expect(synth.queue[0].voice).toBe(HI_NET);
  });

  it("treats an empty voice list as a possible network voice", () => {
    const synth = createFakeSynth([]);
    const { store } = createStore(synth);
    expect(store.speak("HELLO", "en")).toMatchObject({ ok: false, reason: "network_consent_required" });
    store.acceptNetworkVoice();
    expect(store.speak("HELLO", "en")).toMatchObject({ ok: true, usedNetworkVoice: true });
    expect(synth.queue[0]).toMatchObject({ voice: null, lang: "en-IN" });
  });

  it("does not read Hindi with an English voice", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store } = createStore(synth);
    expect(store.speak("नमस्ते", "hi")).toEqual({ ok: false, reason: "no_voice", language: "hi" });
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("reports empty text without touching the engine", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store } = createStore(synth);
    expect(store.speak("   ", "en")).toEqual({ ok: false, reason: "empty" });
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it("pauses, resumes and stops", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store } = createStore(synth);
    store.pause();
    expect(synth.pause).not.toHaveBeenCalled();
    store.speak("HELLO", "en");
    store.pause();
    expect(store.getSnapshot().state).toBe("paused");
    expect(synth.pause).toHaveBeenCalledTimes(1);
    store.resume();
    expect(store.getSnapshot().state).toBe("speaking");
    store.stop();
    expect(store.getSnapshot().state).toBe("idle");
    expect(synth.queue).toHaveLength(0);
  });

  it("ignores events from a cancelled run when speaking again", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store } = createStore(synth);
    store.speak("HELLO", "en");
    const first = synth.queue[0];
    store.speak("WATER", "en");
    expect(store.getSnapshot().state).toBe("speaking");
    first.onend?.();
    expect(store.getSnapshot().state).toBe("speaking");
    expect(synth.queue.map((u) => u.text)).toEqual(["water"]);
  });

  it("records a real synthesis error and goes back to idle", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store } = createStore(synth);
    store.speak("HELLO\nWATER", "en");
    synth.failNext("synthesis-failed");
    expect(store.getSnapshot()).toMatchObject({ state: "idle", error: "synthesis-failed" });
    expect(synth.queue).toHaveLength(0);
    store.speak("HELLO", "en");
    expect(store.getSnapshot().error).toBeNull();
  });

  it("clamps the rate", () => {
    const { store } = createStore(createFakeSynth([EN_IN_LOCAL]));
    store.setRate(99);
    expect(store.getSnapshot().rate).toBe(SPEECH_RATE_MAX);
    store.setRate(0);
    expect(store.getSnapshot().rate).toBe(SPEECH_RATE_MIN);
    expect(clampRate(Number.NaN)).toBe(1);
  });

  it("cancels its own speech and stops listening when the last subscriber leaves", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { store, unsubscribe } = createStore(synth);
    store.speak("HELLO", "en");
    synth.cancel.mockClear();
    unsubscribe();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(synth.listenerCount()).toBe(0);
    expect(store.getSnapshot().state).toBe("idle");
  });

  it("does not cancel someone else's speech on unmount when idle", () => {
    const synth = createFakeSynth([EN_IN_LOCAL]);
    const { unsubscribe } = createStore(synth);
    unsubscribe();
    expect(synth.cancel).not.toHaveBeenCalled();
  });
});
