// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeEvent } from "react";
import type { CommitEvent } from "../../types/recognition";
import { languageMessages, formatMessage, outputLanguageNames } from "./messages";
import { TRANSCRIPT_STORAGE_KEYS, createHistoryStore } from "./sessionHistory";
import { createSpeechStore } from "./speech";
import { useSpeech } from "./useSpeech";
import { useTranscript } from "./useTranscript";
import { createVocabularyRegistry } from "./vocabulary";

afterEach(cleanup);

let clock = 0;
const commit = (label: string, classId = label): CommitEvent => ({
  classId,
  label,
  modelId: "isl-user-templates",
  signLanguage: "ISL",
  timestamp: (clock += 50),
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function setup() {
  const storage = memoryStorage();
  const registry = createVocabularyRegistry();
  const history = createHistoryStore({ storage, now: () => 5_000 });
  let time = 1_000;
  const hook = renderHook(() => useTranscript({ registry, history, now: () => (time += 5_000) }));
  return { ...hook, storage, registry, history };
}

describe("useTranscript", () => {
  it("builds the transcript from commits and reports counts", () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ isEmpty: true, text: "", outputLanguage: "en", canUndo: false });
    act(() => {
      for (const label of ["HELLO", "R", "A", "M"]) result.current.onCommit(commit(label));
    });
    expect(result.current).toMatchObject({
      text: "HELLO RAM",
      textByLanguage: { en: "HELLO RAM", hi: "नमस्ते RAM" },
      wordCount: 2,
      characterCount: 9,
      isEmpty: false,
      canUndo: true,
    });
  });

  it("switches output language without changing the tokens, and flags fallbacks", () => {
    const { result, storage } = setup();
    act(() => {
      result.current.onCommit(commit("HELLO"));
      result.current.onCommit(commit("Chai", "user-chai"));
    });
    const tokens = result.current.tokens;
    expect(result.current.showsMissingHindi).toBe(false);
    act(() => result.current.setOutputLanguage("hi"));
    expect(result.current.text).toBe("नमस्ते Chai");
    expect(result.current.tokens).toBe(tokens);
    expect(result.current.showsMissingHindi).toBe(true);
    expect(result.current.showsUnreviewedHindi).toBe(true);
    expect(result.current.missingHindi.map((t) => t.classId)).toEqual(["user-chai"]);
    expect(result.current.textareaProps.lang).toBe("hi");
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.outputLanguage)).toBe("hi");
  });

  it("binds a textarea two-way and keeps provenance for edits at the end", () => {
    const { result } = setup();
    act(() => {
      for (const label of ["C", "A", "T"]) result.current.onCommit(commit(label));
    });
    const type = (value: string) =>
      act(() => result.current.textareaProps.onChange({ target: { value } } as ChangeEvent<HTMLTextAreaElement>));
    type("CATS");
    expect(result.current.textareaProps.value).toBe("CATS");
    expect(result.current.tokens.map((t) => t.source)).toEqual(["recognition", "recognition", "recognition", "manual"]);
    type("CA");
    expect(result.current.tokens.map((t) => [t.source, t.en])).toEqual([
      ["recognition", "C"],
      ["recognition", "A"],
    ]);
    type("dog");
    expect(result.current.tokens.map((t) => [t.source, t.en])).toEqual([["manual", "dog"]]);
  });

  it("supports undo, clear and the manual control buttons", () => {
    const { result } = setup();
    act(() => {
      result.current.onCommit(commit("A"));
      result.current.insertSpace();
      result.current.onCommit(commit("B"));
      result.current.insertNewLine();
    });
    expect(result.current.text).toBe("A B\n");
    act(() => result.current.backspace());
    act(() => result.current.backspace());
    expect(result.current.text).toBe("A ");
    act(() => result.current.clear());
    expect(result.current.isEmpty).toBe(true);
    act(() => result.current.undo());
    expect(result.current.text).toBe("A ");
  });

  it("updates shown tokens when the user adds a Hindi gloss to a custom class", () => {
    const { result, registry } = setup();
    registry.registerCustomClass({ classId: "user-chai", label: "Chai", signLanguage: "ISL" });
    act(() => {
      result.current.onCommit(commit("Chai", "user-chai"));
      result.current.setOutputLanguage("hi");
    });
    expect(result.current.text).toBe("Chai");
    expect(result.current.showsMissingHindi).toBe(true);
    act(() => void registry.setHindiGloss("user-chai", "ISL", "चाय"));
    expect(result.current.text).toBe("चाय");
    expect(result.current.showsMissingHindi).toBe(false);
  });

  it("finishes a session into in-memory history and starts a new transcript", () => {
    const { result, storage } = setup();
    expect(result.current.currentSession()).toBeNull();
    let finished: ReturnType<typeof result.current.finishSession> = null;
    act(() => {
      expect(result.current.finishSession()).toBeNull();
      result.current.onCommit(commit("HELLO"));
    });
    expect(result.current.currentSession()).toMatchObject({ text: { en: "HELLO", hi: "नमस्ते" } });
    act(() => {
      finished = result.current.finishSession();
    });
    expect(finished).toMatchObject({ modelIds: ["isl-user-templates"], outputLanguage: "en" });
    expect(finished!.endedAt).toBeGreaterThanOrEqual(finished!.startedAt);
    expect(result.current).toMatchObject({ isEmpty: true, canUndo: false, keepHistory: false });
    expect(result.current.history).toHaveLength(1);
    expect(storage.data.size).toBe(0);
  });

  it("persists history only after keep-history is turned on, and deletes it again", () => {
    const { result, storage } = setup();
    const finishOne = (label: string) =>
      act(() => {
        result.current.onCommit(commit(label));
      });
    finishOne("HELLO");
    act(() => void result.current.finishSession());
    act(() => result.current.setKeepHistory(true));
    expect(result.current.keepHistory).toBe(true);
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)).toContain("HELLO");
    finishOne("WATER");
    act(() => void result.current.finishSession());
    expect(result.current.history).toHaveLength(2);
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)).toContain("WATER");

    act(() => result.current.deleteSession(result.current.history[0].id));
    expect(result.current.history).toHaveLength(1);
    act(() => result.current.deleteAllSessions());
    expect(result.current.history).toHaveLength(0);
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)).not.toContain("HELLO");
    act(() => result.current.setKeepHistory(false));
    expect(storage.data.has(TRANSCRIPT_STORAGE_KEYS.history)).toBe(false);
    expect(storage.data.has(TRANSCRIPT_STORAGE_KEYS.keepHistory)).toBe(false);
  });

  it("keeps onCommit stable across renders", () => {
    const { result } = setup();
    const first = result.current.onCommit;
    act(() => result.current.onCommit(commit("A")));
    expect(result.current.onCommit).toBe(first);
  });
});

describe("useSpeech", () => {
  const localEn = { name: "en", lang: "en-IN", localService: true, default: true, voiceURI: "uri:en" };
  const networkHi = { name: "hi", lang: "hi-IN", localService: false, default: false, voiceURI: "uri:hi" };

  function fakeSynth() {
    const queue: { onend: (() => void) | null }[] = [];
    return {
      queue,
      getVoices: () => [localEn, networkHi],
      speak: vi.fn((u: { onend: (() => void) | null }) => void queue.push(u)),
      cancel: vi.fn(() => void queue.splice(0)),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }

  function setupSpeech(synth: ReturnType<typeof fakeSynth> | null) {
    const store = createSpeechStore({
      synth: synth as unknown as SpeechSynthesis | null,
      createUtterance: (text) => ({ text, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance,
    });
    return renderHook(() => useSpeech({ store }));
  }

  it("reports unsupported browsers", () => {
    const { result } = setupSpeech(null);
    expect(result.current).toMatchObject({ ready: true, supported: false, state: "unsupported" });
  });

  it("exposes the voice flags, speaks, and follows the state", () => {
    const synth = fakeSynth();
    const { result } = setupSpeech(synth);
    expect(result.current).toMatchObject({ ready: true, supported: true, state: "idle" });
    expect(result.current.networkVoice).toEqual({ en: false, hi: true });
    expect(result.current.voice.hi.networkOnly).toBe(true);

    act(() => {
      expect(result.current.speak("नमस्ते", "hi")).toMatchObject({ ok: false, reason: "network_consent_required" });
    });
    act(() => result.current.acceptNetworkVoice());
    expect(result.current.networkVoiceAccepted).toBe(true);

    act(() => {
      expect(result.current.speak("HELLO", "en")).toMatchObject({ ok: true });
    });
    expect(result.current.state).toBe("speaking");
    act(() => result.current.pause());
    expect(result.current.state).toBe("paused");
    act(() => result.current.resume());
    act(() => synth.queue[0].onend?.());
    expect(result.current.state).toBe("idle");
    act(() => result.current.setRate(1.25));
    expect(result.current.rate).toBe(1.25);
  });

  it("cancels speech when the component unmounts", () => {
    const synth = fakeSynth();
    const { result, unmount } = setupSpeech(synth);
    act(() => void result.current.speak("HELLO", "en"));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("messages", () => {
  it("has the same keys in English and Hindi, none empty", () => {
    const enKeys = Object.keys(languageMessages.en).sort();
    expect(Object.keys(languageMessages.hi).sort()).toEqual(enKeys);
    for (const locale of ["en", "hi"] as const) {
      for (const [key, value] of Object.entries(languageMessages[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps the same placeholders in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(languageMessages.en) as (keyof typeof languageMessages.en)[]) {
      expect(placeholders(languageMessages.hi[key]), key).toEqual(placeholders(languageMessages.en[key]));
    }
  });

  it("writes Hindi in Devanagari and keeps RTSLR in Latin letters", () => {
    for (const [key, value] of Object.entries(languageMessages.hi)) {
      if (key === "outputEnglish") continue;
      expect(value, key).toMatch(/[ऀ-ॿ]/);
    }
    expect(languageMessages.hi.notTranslationBody).toContain("RTSLR");
  });

  it("never calls the transcript a translation", () => {
    expect(languageMessages.en.panelSubtitle).toBe("Transcript of recognised signs");
    expect(languageMessages.en.notTranslationTitle).toMatch(/not a translation/i);
    expect(languageMessages.hi.notTranslationTitle).toContain("अनुवाद नहीं");
    for (const key of ["panelTitle", "panelSubtitle", "transcriptLabel", "speak", "exportLabel"] as const) {
      expect(languageMessages.en[key]).not.toMatch(/translat/i);
    }
  });

  it("fills placeholders", () => {
    expect(formatMessage(languageMessages.en.noHindiMappingSummary, { count: 2 })).toBe(
      "2 label(s) have no Hindi mapping and are shown in English.",
    );
    expect(formatMessage(languageMessages.hi.speechNoVoice, { language: outputLanguageNames.hi.hi })).toContain("हिन्दी की कोई आवाज़");
    expect(formatMessage("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});
