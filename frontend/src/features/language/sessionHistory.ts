/**
 * Transcript session history and transcript settings.
 *
 * Privacy contract (docs/SECURITY_PRIVACY.md, section 8):
 *  - Finished sessions live in memory only. Nothing about a transcript is
 *    written to storage unless the user turns on "keep history" (off by default).
 *  - With "keep history" on: at most HISTORY_MAX_ENTRIES sessions, none older
 *    than HISTORY_MAX_AGE_MS; older ones are dropped when the store loads.
 *  - Turning "keep history" off deletes the stored copy immediately.
 *  - The output-language choice is a plain setting; it is written only when the
 *    user changes it.
 *  - Every key starts with "rtslr" so the delete-all control finds it.
 *  - Stored data is validated on the way back in; an unreadable record is
 *    reported (`storageError: "invalid"`) and left untouched until the user
 *    deletes it. It is never partly applied and never overwritten silently.
 */

import type { SignLanguage } from "@/types/recognition";
import {
  SESSION_SCHEMA,
  createSession,
  type TokenKind,
  type TranscriptSession,
  type TranscriptToken,
} from "./transcript";
import type { OutputLanguage } from "./vocabulary";

export const TRANSCRIPT_STORAGE_KEYS = {
  /** "1" when the user opted in to keeping history. Absent otherwise. */
  keepHistory: "rtslr.transcript.keepHistory",
  /** JSON `{ schema, sessions }`. Present only while keepHistory is on. */
  history: "rtslr.transcript.history",
  /** "en" | "hi". Written only when the user changes the output language. */
  outputLanguage: "rtslr.transcript.outputLanguage",
} as const;

export const HISTORY_SCHEMA = "rtslr-transcript-history-1";
export const HISTORY_MAX_ENTRIES = 50;
export const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_CHARS = 2_000_000;
const MAX_TOKENS_PER_SESSION = 5_000;
const MAX_TOKEN_TEXT = 20_000;

export type HistoryStorageError =
  /** Storage threw or is absent: history stays in memory only. */
  | "unavailable"
  /** The stored record failed validation. It is left as is until deleted. */
  | "invalid"
  /** The browser refused the write (quota). */
  | "quota";

export type HistorySnapshot = {
  /** False until the store has read its settings in the browser. */
  ready: boolean;
  /** Newest first. */
  sessions: readonly TranscriptSession[];
  keepHistory: boolean;
  outputLanguage: OutputLanguage;
  storageError: HistoryStorageError | null;
};

export type HistoryStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): HistorySnapshot;
  getServerSnapshot(): HistorySnapshot;
  add(session: TranscriptSession): void;
  remove(id: string): void;
  /** Deletes every session from memory and from storage. */
  removeAll(): void;
  setKeepHistory(keep: boolean): void;
  setOutputLanguage(language: OutputLanguage): void;
};

/* ------------------------------------------------------------------ */
/* Validation of stored data                                           */
/* ------------------------------------------------------------------ */

const TOKEN_KINDS: readonly TokenKind[] = ["letter", "digit", "word", "phrase", "control", "text"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isSignLanguage = (v: unknown): v is SignLanguage => v === "ISL" || v === "ASL";
const isLanguage = (v: unknown): v is OutputLanguage => v === "en" || v === "hi";

function parseToken(value: unknown): TranscriptToken | null {
  if (!isRecord(value)) return null;
  const { id, source, kind, classId, modelId, signLanguage, timestamp, en, hi, hiReviewed, auto } = value;
  if (!isText(id, 32)) return null;
  if (source !== "recognition" && source !== "manual") return null;
  if (!TOKEN_KINDS.includes(kind as TokenKind)) return null;
  if (classId !== null && !isText(classId, 128)) return null;
  if (modelId !== null && !isText(modelId, 128)) return null;
  if (signLanguage !== null && !isSignLanguage(signLanguage)) return null;
  if (!isTime(timestamp)) return null;
  if (!isText(en, MAX_TOKEN_TEXT)) return null;
  if (hi !== null && !isText(hi, MAX_TOKEN_TEXT)) return null;
  if (typeof hiReviewed !== "boolean") return null;
  const token: TranscriptToken = {
    id,
    source,
    kind: kind as TokenKind,
    classId,
    modelId,
    signLanguage,
    timestamp,
    en,
    hi,
    hiReviewed,
  };
  if (auto === true) token.auto = true;
  return token;
}

/** Rebuilds a session from untrusted data, or returns null. Derived fields
 *  (text, model ids) are recomputed from the tokens, never trusted. */
export function parseSession(value: unknown): TranscriptSession | null {
  if (!isRecord(value) || value.schema !== SESSION_SCHEMA) return null;
  const { id, startedAt, endedAt, outputLanguage, tokens } = value;
  if (!isText(id, 64) || id === "") return null;
  if (!isTime(startedAt) || !isTime(endedAt) || !isLanguage(outputLanguage)) return null;
  if (!Array.isArray(tokens) || tokens.length > MAX_TOKENS_PER_SESSION) return null;
  const parsed: TranscriptToken[] = [];
  for (const raw of tokens) {
    const token = parseToken(raw);
    if (!token) return null;
    parsed.push(token);
  }
  return createSession(parsed, { id, startedAt, endedAt, outputLanguage });
}

export type ParsedHistory = { ok: true; sessions: TranscriptSession[] } | { ok: false };

export function parseHistory(raw: string): ParsedHistory {
  if (raw.length > MAX_STORED_CHARS) return { ok: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!isRecord(data) || data.schema !== HISTORY_SCHEMA || !Array.isArray(data.sessions)) return { ok: false };
  if (data.sessions.length > HISTORY_MAX_ENTRIES) return { ok: false };
  const sessions: TranscriptSession[] = [];
  const seen = new Set<string>();
  for (const item of data.sessions) {
    const session = parseSession(item);
    if (!session || seen.has(session.id)) return { ok: false };
    seen.add(session.id);
    sessions.push(session);
  }
  return { ok: true, sessions };
}

export function serializeHistory(sessions: readonly TranscriptSession[]): string {
  return JSON.stringify({ schema: HISTORY_SCHEMA, sessions });
}

/** Newest first, capped, and without sessions older than the retention period. */
export function pruneSessions(sessions: readonly TranscriptSession[], now: number): TranscriptSession[] {
  return sessions
    .filter((s) => now - s.endedAt <= HISTORY_MAX_AGE_MS)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, HISTORY_MAX_ENTRIES);
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type HistoryStoreOptions = {
  /** Defaults to window.localStorage, resolved lazily in the browser. */
  storage?: StorageLike | null | (() => StorageLike | null);
  now?: () => number;
};

const SERVER_SNAPSHOT: HistorySnapshot = Object.freeze({
  ready: false,
  sessions: Object.freeze([]) as readonly TranscriptSession[],
  keepHistory: false,
  outputLanguage: "en",
  storageError: null,
});

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createHistoryStore(options: HistoryStoreOptions = {}): HistoryStore {
  const now = options.now ?? Date.now;
  const listeners = new Set<() => void>();
  let snapshot: HistorySnapshot = SERVER_SNAPSHOT;
  let loaded = false;
  /** True while an unreadable stored record must not be overwritten. */
  let blocked = false;

  const storage = (): StorageLike | null => {
    const s = options.storage;
    if (s === undefined) return defaultStorage();
    return typeof s === "function" ? s() : s;
  };

  const set = (patch: Partial<HistorySnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  /** Writes or removes the stored copy to match memory. Returns the error, if any. */
  const persist = (sessions: readonly TranscriptSession[], keep: boolean): HistoryStorageError | null => {
    if (blocked) return "invalid";
    const s = storage();
    if (!s) return keep ? "unavailable" : null;
    try {
      if (keep) {
        s.setItem(TRANSCRIPT_STORAGE_KEYS.keepHistory, "1");
        s.setItem(TRANSCRIPT_STORAGE_KEYS.history, serializeHistory(sessions));
      } else {
        s.removeItem(TRANSCRIPT_STORAGE_KEYS.history);
        s.removeItem(TRANSCRIPT_STORAGE_KEYS.keepHistory);
      }
      return null;
    } catch (error) {
      // A DOMException is not always `instanceof Error`; read the name directly.
      const name = String((error as { name?: unknown } | null)?.name ?? "");
      return /quota/i.test(name) ? "quota" : "unavailable";
    }
  };

  const load = () => {
    if (loaded) return;
    loaded = true;
    const s = storage();
    if (!s) {
      set({ ready: true });
      return;
    }
    try {
      const language = s.getItem(TRANSCRIPT_STORAGE_KEYS.outputLanguage);
      const keepHistory = s.getItem(TRANSCRIPT_STORAGE_KEYS.keepHistory) === "1";
      const patch: Partial<HistorySnapshot> = { ready: true, keepHistory };
      if (isLanguage(language)) patch.outputLanguage = language;
      if (keepHistory) {
        const raw = s.getItem(TRANSCRIPT_STORAGE_KEYS.history);
        if (raw !== null) {
          const parsed = parseHistory(raw);
          if (parsed.ok) {
            const kept = pruneSessions(parsed.sessions, now());
            patch.sessions = kept;
            // Retention: expired sessions are removed from storage at start.
            if (kept.length !== parsed.sessions.length) patch.storageError = persist(kept, true);
          } else {
            blocked = true;
            patch.storageError = "invalid";
          }
        }
      }
      set(patch);
    } catch {
      set({ ready: true, storageError: "unavailable" });
    }
  };

  const commit = (sessions: readonly TranscriptSession[]) => {
    const storageError = snapshot.keepHistory ? persist(sessions, true) : snapshot.storageError;
    set({ sessions, storageError });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      load();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,

    add(session) {
      load();
      const others = snapshot.sessions.filter((s) => s.id !== session.id);
      commit(pruneSessions([session, ...others], now()));
    },

    remove(id) {
      load();
      commit(snapshot.sessions.filter((s) => s.id !== id));
    },

    removeAll() {
      load();
      // An explicit delete also discards an unreadable stored record.
      blocked = false;
      const storageError = persist([], snapshot.keepHistory);
      set({ sessions: [], storageError });
    },

    setKeepHistory(keep) {
      load();
      if (!keep) {
        // Turning the switch off deletes the stored history, readable or not.
        blocked = false;
        set({ keepHistory: false, storageError: persist([], false) });
        return;
      }
      const storageError = persist(snapshot.sessions, true);
      // Only report "on" when the opt-in really reached storage.
      set({ keepHistory: storageError === null || blocked, storageError });
    },

    setOutputLanguage(language) {
      load();
      let storageError = snapshot.storageError;
      try {
        storage()?.setItem(TRANSCRIPT_STORAGE_KEYS.outputLanguage, language);
      } catch {
        storageError = storageError ?? "unavailable";
      }
      set({ outputLanguage: language, storageError });
    },
  };
}

/** Shared store: in-memory history survives client-side route changes and is
 *  gone on reload unless the user opted in to keeping it. */
export const transcriptHistory: HistoryStore = createHistoryStore();
