import { describe, expect, it, vi } from "vitest";
import {
  HISTORY_MAX_AGE_MS,
  HISTORY_MAX_ENTRIES,
  TRANSCRIPT_STORAGE_KEYS,
  createHistoryStore,
  parseHistory,
  parseSession,
  serializeHistory,
} from "./sessionHistory";
import { applyCommit, createSession, createTranscriptState } from "./transcript";

const NOW = Date.UTC(2026, 10, 21);

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn((k: string) => void data.delete(k)),
  };
}

function session(id: string, endedAt = NOW - 1000) {
  const state = applyCommit(createTranscriptState(), {
    classId: "HELLO",
    label: "HELLO",
    modelId: "m1",
    signLanguage: "ISL",
    timestamp: 5,
  });
  return createSession(state.tokens, { id, startedAt: endedAt - 500, endedAt, outputLanguage: "en" });
}

function open(storage: ReturnType<typeof memoryStorage> | null) {
  const store = createHistoryStore({ storage, now: () => NOW });
  store.subscribe(() => {});
  return store;
}

describe("storage keys", () => {
  it("all start with rtslr", () => {
    for (const key of Object.values(TRANSCRIPT_STORAGE_KEYS)) expect(key.startsWith("rtslr")).toBe(true);
  });
});

describe("history store", () => {
  it("keeps sessions in memory only by default and writes nothing", () => {
    const storage = memoryStorage();
    const store = open(storage);
    expect(store.getSnapshot()).toMatchObject({ ready: true, keepHistory: false, sessions: [], outputLanguage: "en" });
    store.add(session("a"));
    store.add(session("b", NOW - 10));
    expect(store.getSnapshot().sessions.map((s) => s.id)).toEqual(["b", "a"]);
    store.remove("a");
    expect(store.getSnapshot().sessions.map((s) => s.id)).toEqual(["b"]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it("persists only after the user opts in, and deletes the stored copy on opt-out", () => {
    const storage = memoryStorage();
    const store = open(storage);
    store.add(session("a"));
    store.setKeepHistory(true);
    expect(store.getSnapshot().keepHistory).toBe(true);
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.keepHistory)).toBe("1");
    expect(parseHistory(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)!)).toMatchObject({ ok: true });
    store.add(session("b", NOW - 10));
    const stored = parseHistory(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)!);
    expect(stored.ok && stored.sessions.map((s) => s.id)).toEqual(["b", "a"]);

    store.setKeepHistory(false);
    expect(storage.data.has(TRANSCRIPT_STORAGE_KEYS.history)).toBe(false);
    expect(storage.data.has(TRANSCRIPT_STORAGE_KEYS.keepHistory)).toBe(false);
    expect(store.getSnapshot().keepHistory).toBe(false);
    // The in-memory list of this page session is untouched.
    expect(store.getSnapshot().sessions).toHaveLength(2);
  });

  it("restores persisted history in a new page load", () => {
    const storage = memoryStorage();
    const first = open(storage);
    first.setKeepHistory(true);
    first.add(session("a"));
    const second = open(storage);
    expect(second.getSnapshot()).toMatchObject({ keepHistory: true, storageError: null });
    expect(second.getSnapshot().sessions.map((s) => s.id)).toEqual(["a"]);
    expect(second.getSnapshot().sessions[0].text).toEqual({ en: "HELLO", hi: "नमस्ते" });
  });

  it("does not read stored history when the opt-in flag is absent", () => {
    const storage = memoryStorage({ [TRANSCRIPT_STORAGE_KEYS.history]: serializeHistory([session("a")]) });
    expect(open(storage).getSnapshot().sessions).toEqual([]);
  });

  it("deletes one and all, in memory and in storage", () => {
    const storage = memoryStorage();
    const store = open(storage);
    store.setKeepHistory(true);
    store.add(session("a"));
    store.add(session("b", NOW - 10));
    store.remove("b");
    let stored = parseHistory(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)!);
    expect(stored.ok && stored.sessions.map((s) => s.id)).toEqual(["a"]);
    store.removeAll();
    expect(store.getSnapshot().sessions).toEqual([]);
    stored = parseHistory(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)!);
    expect(stored).toEqual({ ok: true, sessions: [] });
  });

  it("drops sessions past the retention period at load and caps the count", () => {
    const old = session("old", NOW - HISTORY_MAX_AGE_MS - 1);
    const storage = memoryStorage({
      [TRANSCRIPT_STORAGE_KEYS.keepHistory]: "1",
      [TRANSCRIPT_STORAGE_KEYS.history]: serializeHistory([session("fresh"), old]),
    });
    const store = open(storage);
    expect(store.getSnapshot().sessions.map((s) => s.id)).toEqual(["fresh"]);
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)).not.toContain('"old"');

    for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) store.add(session(`s${i}`, NOW - 100 + i));
    expect(store.getSnapshot().sessions).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(store.getSnapshot().sessions[0].id).toBe(`s${HISTORY_MAX_ENTRIES + 4}`);
  });

  it("reports an unreadable record, leaves it untouched, and clears it on delete-all", () => {
    const storage = memoryStorage({
      [TRANSCRIPT_STORAGE_KEYS.keepHistory]: "1",
      [TRANSCRIPT_STORAGE_KEYS.history]: "{not json",
    });
    const store = open(storage);
    expect(store.getSnapshot()).toMatchObject({ keepHistory: true, storageError: "invalid", sessions: [] });
    store.add(session("a"));
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)).toBe("{not json");
    expect(store.getSnapshot().storageError).toBe("invalid");
    store.removeAll();
    expect(store.getSnapshot()).toMatchObject({ storageError: null, sessions: [] });
    expect(parseHistory(storage.data.get(TRANSCRIPT_STORAGE_KEYS.history)!)).toEqual({ ok: true, sessions: [] });
  });

  it("works without storage and says so only when the user asks to keep history", () => {
    const store = open(null);
    store.add(session("a"));
    expect(store.getSnapshot()).toMatchObject({ storageError: null, keepHistory: false });
    store.setKeepHistory(true);
    expect(store.getSnapshot()).toMatchObject({ storageError: "unavailable", keepHistory: false });
    expect(store.getSnapshot().sessions).toHaveLength(1);
  });

  it("reports a full storage and does not claim history is kept", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const store = open(storage);
    store.setKeepHistory(true);
    expect(store.getSnapshot()).toMatchObject({ storageError: "quota", keepHistory: false });
  });

  it("stores the output language only when the user changes it", () => {
    const storage = memoryStorage();
    const store = open(storage);
    expect(storage.setItem).not.toHaveBeenCalled();
    store.setOutputLanguage("hi");
    expect(storage.data.get(TRANSCRIPT_STORAGE_KEYS.outputLanguage)).toBe("hi");
    expect(open(storage).getSnapshot().outputLanguage).toBe("hi");
    expect(open(memoryStorage({ [TRANSCRIPT_STORAGE_KEYS.outputLanguage]: "fr" })).getSnapshot().outputLanguage).toBe("en");
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createHistoryStore({ storage: null, now: () => NOW });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    listener.mockClear();
    store.add(session("a"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.add(session("b"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("validation of stored data", () => {
  it("round-trips a valid session and recomputes derived fields", () => {
    const original = session("a");
    const tampered = { ...JSON.parse(JSON.stringify(original)), text: { en: "FAKE", hi: "FAKE" }, modelIds: ["evil"] };
    expect(parseSession(tampered)).toEqual(original);
  });

  it("rejects malformed sessions and tokens", () => {
    const good = JSON.parse(JSON.stringify(session("a")));
    expect(parseSession(null)).toBeNull();
    expect(parseSession({ ...good, schema: "other" })).toBeNull();
    expect(parseSession({ ...good, id: "" })).toBeNull();
    expect(parseSession({ ...good, endedAt: "yesterday" })).toBeNull();
    expect(parseSession({ ...good, outputLanguage: "fr" })).toBeNull();
    expect(parseSession({ ...good, tokens: [{ ...good.tokens[0], source: "robot" }] })).toBeNull();
    expect(parseSession({ ...good, tokens: [{ ...good.tokens[0], en: 5 }] })).toBeNull();
    expect(parseSession({ ...good, tokens: [{ ...good.tokens[0], signLanguage: "BSL" }] })).toBeNull();
    expect(parseSession({ ...good, tokens: [{ ...good.tokens[0], timestamp: Number.NaN }] })).toBeNull();
  });

  it("rejects a history with the wrong shape, duplicates or too many entries", () => {
    const one = session("a");
    expect(parseHistory("[]")).toEqual({ ok: false });
    expect(parseHistory(JSON.stringify({ schema: "x", sessions: [] }))).toEqual({ ok: false });
    expect(parseHistory(serializeHistory([one, one]))).toEqual({ ok: false });
    const many = Array.from({ length: HISTORY_MAX_ENTRIES + 1 }, (_, i) => session(`s${i}`));
    expect(parseHistory(serializeHistory(many))).toEqual({ ok: false });
    expect(parseHistory(serializeHistory([one]))).toMatchObject({ ok: true });
  });
});
