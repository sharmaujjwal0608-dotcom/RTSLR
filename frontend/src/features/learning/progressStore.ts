/**
 * Learning progress store: favourites, saved lessons, lesson positions, the
 * self-rated practice cards, quiz history and active days.
 *
 * Storage contract:
 *  - Everything lives in the browser under one `localStorage` key that starts
 *    with "rtslr.learning.". Nothing is sent anywhere.
 *  - The record carries a schema number. It is validated in full on the way
 *    back in; an unreadable or newer record is reported (`storage: "invalid"`)
 *    and left untouched until the user resets. It is never partly applied and
 *    never overwritten silently.
 *  - When storage is missing or refuses writes the store keeps working in
 *    memory (`storage: "memory"`) so the pages stay usable; the interface shows
 *    a notice because progress will be lost when the tab closes.
 *
 * `LEARNING_STORAGE_KEYS` is exported for the global "delete my local data"
 * control: removing those keys (or every key with LEARNING_STORAGE_PREFIX) and
 * calling `progressStore.reload()` clears this feature.
 */

import type { QuizDirection } from "./quiz";
import { addDays, dayKey, isDayKey, MAX_BOX, rateCard, type SelfRating, type SrsCard } from "./srs";

export const LEARNING_STORAGE_PREFIX = "rtslr.learning.";

export const LEARNING_STORAGE_KEYS = {
  /** JSON `ProgressState` (see PROGRESS_SCHEMA). */
  progress: "rtslr.learning.progress",
  /** Written and removed at once to test that storage accepts writes. */
  probe: "rtslr.learning.probe",
} as const;

export const PROGRESS_SCHEMA = 1;
export const MAX_QUIZ_RECORDS = 50;
export const MAX_ACTIVE_DAYS = 730;
const MAX_IDS = 2_000;
const MAX_STORED_CHARS = 1_000_000;

export type LessonProgress = {
  /** Index of the item the learner is on (0-based). */
  index: number;
  /** ISO timestamp, or null while the lesson is not finished. */
  completedAt: string | null;
  updatedAt: string;
};

export type QuizRecord = {
  /** ISO timestamp at which the quiz was finished. */
  at: string;
  direction: QuizDirection;
  /** Category id the questions came from, or "all". */
  category: string;
  total: number;
  correct: number;
};

export type ProgressState = {
  schema: typeof PROGRESS_SCHEMA;
  /** Sign ids, oldest first. */
  favourites: string[];
  /** Lesson ids, oldest first. */
  savedLessons: string[];
  lessons: Record<string, LessonProgress>;
  /** Lesson to offer under "Continue". */
  lastLessonId: string | null;
  /** Self-rated practice cards by sign id. */
  cards: Record<string, SrsCard>;
  /** Newest first, at most MAX_QUIZ_RECORDS. */
  quizzes: QuizRecord[];
  /** Local calendar days (YYYY-MM-DD) with any learning activity, ascending. */
  activeDays: string[];
};

/** local: saved in this browser. memory: not saved. invalid: stored record unreadable. */
export type StorageMode = "local" | "memory" | "invalid";

export type ProgressSnapshot = {
  /** False until the store has read storage in the browser. */
  ready: boolean;
  state: ProgressState;
  storage: StorageMode;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function emptyProgress(): ProgressState {
  return {
    schema: PROGRESS_SCHEMA,
    favourites: [],
    savedLessons: [],
    lessons: {},
    lastLessonId: null,
    cards: {},
    quizzes: [],
    activeDays: [],
  };
}

/* ------------------------------------------------------------------ */
/* Validation of stored data                                           */
/* ------------------------------------------------------------------ */

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isIsoTime = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

function idList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_IDS) return null;
  if (!value.every(isId)) return null;
  return [...new Set(value)];
}

function lessonProgress(value: unknown): LessonProgress | null {
  if (!isRecord(value)) return null;
  const { index, completedAt, updatedAt } = value;
  if (!isCount(index) || index > 1_000) return null;
  if (completedAt !== null && !isIsoTime(completedAt)) return null;
  if (!isIsoTime(updatedAt)) return null;
  return { index, completedAt, updatedAt };
}

function srsCard(value: unknown): SrsCard | null {
  if (!isRecord(value)) return null;
  const { box, due, lastRating, reviews, lastReviewedAt } = value;
  if (!isCount(box) || box < 1 || box > MAX_BOX) return null;
  if (!isDayKey(due)) return null;
  if (lastRating !== "got-it" && lastRating !== "need-practice") return null;
  if (!isCount(reviews) || !isIsoTime(lastReviewedAt)) return null;
  return { box, due, lastRating, reviews, lastReviewedAt };
}

function quizRecord(value: unknown): QuizRecord | null {
  if (!isRecord(value)) return null;
  const { at, direction, category, total, correct } = value;
  if (!isIsoTime(at)) return null;
  if (direction !== "en-hi" && direction !== "hi-en") return null;
  if (category !== "all" && !isId(category)) return null;
  if (!isCount(total) || !isCount(correct) || total < 1 || total > 500 || correct > total) return null;
  return { at, direction, category, total, correct };
}

/** Validates every entry of an id-keyed map; one bad entry rejects the map. */
function idMap<T>(value: unknown, parse: (entry: unknown) => T | null): Record<string, T> | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length > MAX_IDS) return null;
  const entries: [string, T][] = [];
  for (const key of keys) {
    if (!isId(key)) return null;
    const parsed = parse(value[key]);
    if (parsed === null) return null;
    entries.push([key, parsed]);
  }
  return Object.fromEntries(entries);
}

export type ParseResult =
  | { ok: true; state: ProgressState }
  | { ok: false; reason: "not_json" | "too_large" | "unknown_schema" | "invalid_shape" };

/**
 * Upgrades an older record to the current schema. There is only schema 1 so
 * far; add a case here (and a test) when the shape changes.
 */
function migrate(record: Record<string, unknown>): Record<string, unknown> | null {
  if (record.schema === PROGRESS_SCHEMA) return record;
  return null;
}

/** Strict parser for a stored or imported progress record. */
export function parseProgress(raw: string): ParseResult {
  if (raw.length > MAX_STORED_CHARS) return { ok: false, reason: "too_large" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  if (!isRecord(data)) return { ok: false, reason: "invalid_shape" };
  const record = migrate(data);
  if (!record) return { ok: false, reason: "unknown_schema" };

  const favourites = idList(record.favourites);
  const savedLessons = idList(record.savedLessons);
  const lessons = idMap(record.lessons, lessonProgress);
  const cards = idMap(record.cards, srsCard);
  const lastLessonId = record.lastLessonId;
  const quizzesIn = record.quizzes;
  const daysIn = record.activeDays;
  if (!favourites || !savedLessons || !lessons || !cards) return { ok: false, reason: "invalid_shape" };
  if (lastLessonId !== null && !isId(lastLessonId)) return { ok: false, reason: "invalid_shape" };
  if (!Array.isArray(quizzesIn) || quizzesIn.length > MAX_QUIZ_RECORDS) return { ok: false, reason: "invalid_shape" };
  if (!Array.isArray(daysIn) || daysIn.length > MAX_ACTIVE_DAYS) return { ok: false, reason: "invalid_shape" };

  const quizzes: QuizRecord[] = [];
  for (const entry of quizzesIn) {
    const parsed = quizRecord(entry);
    if (!parsed) return { ok: false, reason: "invalid_shape" };
    quizzes.push(parsed);
  }
  if (!daysIn.every(isDayKey)) return { ok: false, reason: "invalid_shape" };

  return {
    ok: true,
    state: {
      schema: PROGRESS_SCHEMA,
      favourites,
      savedLessons,
      lessons,
      lastLessonId,
      cards,
      quizzes,
      activeDays: [...new Set(daysIn)].sort(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Streak                                                              */
/* ------------------------------------------------------------------ */

export type Streak = {
  /** Consecutive active days ending today, or yesterday if today has no activity yet. */
  current: number;
  longest: number;
  activeToday: boolean;
};

export function computeStreak(activeDays: readonly string[], today: string): Streak {
  const days = new Set(activeDays);
  const activeToday = days.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest, activeToday };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type ProgressExport = {
  app: "RTSLR";
  kind: "learning-progress";
  exportedAt: string;
  schema: typeof PROGRESS_SCHEMA;
  progress: ProgressState;
};

export type ProgressStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ProgressSnapshot;
  getServerSnapshot(): ProgressSnapshot;
  /** Adds or removes a favourite; returns true when it is now a favourite. */
  toggleFavourite(signId: string): boolean;
  /** Adds or removes a saved lesson; returns true when it is now saved. */
  toggleSavedLesson(lessonId: string): boolean;
  /** Remembers where the learner is in a lesson (resume). */
  setLessonPosition(lessonId: string, index: number): void;
  completeLesson(lessonId: string): void;
  /** Clears the position and completion of one lesson. */
  restartLesson(lessonId: string): void;
  /** Records a self-rating and schedules the next review. */
  rateSign(signId: string, rating: SelfRating): SrsCard;
  recordQuiz(result: Omit<QuizRecord, "at">): void;
  /** Deletes all learning progress from memory and from storage. */
  reset(): void;
  /** Reads storage again (after another part of the app deleted the keys). */
  reload(): void;
  exportJson(): string;
};

export type ProgressStoreOptions = {
  /** Returns the storage to use, or null when there is none. May throw. */
  getStorage?: () => StorageLike | null;
  now?: () => Date;
};

const SERVER_SNAPSHOT: ProgressSnapshot = Object.freeze({
  ready: false,
  state: emptyProgress(),
  storage: "local",
});

function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * Throws unless storage can be written and read back. Some browsers expose
 * the object but refuse to use it (private mode, zero quota, blocked site data).
 */
function probe(storage: StorageLike): void {
  storage.setItem(LEARNING_STORAGE_KEYS.probe, "1");
  const readBack = storage.getItem(LEARNING_STORAGE_KEYS.probe);
  storage.removeItem(LEARNING_STORAGE_KEYS.probe);
  if (readBack !== "1") throw new Error("storage did not keep the probe value");
}

export function createProgressStore(options: ProgressStoreOptions = {}): ProgressStore {
  const getStorage = options.getStorage ?? browserStorage;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<() => void>();

  let loaded = false;
  let storage: StorageLike | null = null;
  let snapshot: ProgressSnapshot = { ready: false, state: emptyProgress(), storage: "local" };

  const emit = () => listeners.forEach((listener) => listener());

  function load(): void {
    loaded = true;
    let mode: StorageMode = "local";
    let state = emptyProgress();
    try {
      storage = getStorage();
      if (!storage) {
        mode = "memory";
      } else {
        const raw = storage.getItem(LEARNING_STORAGE_KEYS.progress);
        if (raw !== null) {
          const parsed = parseProgress(raw);
          if (parsed.ok) state = parsed.state;
          else mode = "invalid";
        }
        if (mode === "local") probe(storage);
      }
    } catch {
      storage = null;
      mode = "memory";
    }
    snapshot = { ready: true, state, storage: mode };
  }

  function ensureLoaded(): void {
    if (!loaded) load();
  }

  function commit(state: ProgressState): void {
    let mode = snapshot.storage;
    if (mode === "local" && storage) {
      try {
        storage.setItem(LEARNING_STORAGE_KEYS.progress, JSON.stringify(state));
      } catch {
        mode = "memory";
      }
    }
    snapshot = { ready: true, state, storage: mode };
    emit();
  }

  function withActivity(state: ProgressState): ProgressState {
    const today = dayKey(now());
    if (state.activeDays.includes(today)) return state;
    return { ...state, activeDays: [...state.activeDays, today].sort().slice(-MAX_ACTIVE_DAYS) };
  }

  function toggle(list: readonly string[], id: string): { next: string[]; present: boolean } {
    return list.includes(id)
      ? { next: list.filter((entry) => entry !== id), present: false }
      : { next: [...list, id], present: true };
  }

  return {
    subscribe(listener) {
      ensureLoaded();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      ensureLoaded();
      return snapshot;
    },

    getServerSnapshot() {
      return SERVER_SNAPSHOT;
    },

    toggleFavourite(signId) {
      ensureLoaded();
      const { next, present } = toggle(snapshot.state.favourites, signId);
      commit({ ...snapshot.state, favourites: next });
      return present;
    },

    toggleSavedLesson(lessonId) {
      ensureLoaded();
      const { next, present } = toggle(snapshot.state.savedLessons, lessonId);
      commit({ ...snapshot.state, savedLessons: next });
      return present;
    },

    setLessonPosition(lessonId, index) {
      ensureLoaded();
      const state = snapshot.state;
      const previous = Object.hasOwn(state.lessons, lessonId) ? state.lessons[lessonId] : undefined;
      const entry: LessonProgress = {
        index: Math.max(0, Math.floor(index)),
        completedAt: previous?.completedAt ?? null,
        updatedAt: now().toISOString(),
      };
      commit(
        withActivity({
          ...state,
          lessons: { ...state.lessons, [lessonId]: entry },
          lastLessonId: lessonId,
        }),
      );
    },

    completeLesson(lessonId) {
      ensureLoaded();
      const state = snapshot.state;
      const previous = Object.hasOwn(state.lessons, lessonId) ? state.lessons[lessonId] : undefined;
      const stamp = now().toISOString();
      const entry: LessonProgress = { index: previous?.index ?? 0, completedAt: stamp, updatedAt: stamp };
      commit(
        withActivity({
          ...state,
          lessons: { ...state.lessons, [lessonId]: entry },
          lastLessonId: state.lastLessonId === lessonId ? null : state.lastLessonId,
        }),
      );
    },

    restartLesson(lessonId) {
      ensureLoaded();
      const state = snapshot.state;
      const lessons = Object.fromEntries(Object.entries(state.lessons).filter(([id]) => id !== lessonId));
      commit({
        ...state,
        lessons,
        lastLessonId: state.lastLessonId === lessonId ? null : state.lastLessonId,
      });
    },

    rateSign(signId, rating) {
      ensureLoaded();
      const state = snapshot.state;
      const previous = Object.hasOwn(state.cards, signId) ? state.cards[signId] : undefined;
      const card = rateCard(previous, rating, now());
      commit(withActivity({ ...state, cards: { ...state.cards, [signId]: card } }));
      return card;
    },

    recordQuiz(result) {
      ensureLoaded();
      const record: QuizRecord = { ...result, at: now().toISOString() };
      const state = snapshot.state;
      commit(withActivity({ ...state, quizzes: [record, ...state.quizzes].slice(0, MAX_QUIZ_RECORDS) }));
    },

    reset() {
      ensureLoaded();
      let mode: StorageMode = "memory";
      try {
        storage = storage ?? getStorage();
        if (storage) {
          storage.removeItem(LEARNING_STORAGE_KEYS.progress);
          probe(storage);
          mode = "local";
        }
      } catch {
        mode = "memory";
      }
      snapshot = { ready: true, state: emptyProgress(), storage: mode };
      emit();
    },

    reload() {
      load();
      emit();
    },

    exportJson() {
      ensureLoaded();
      const payload: ProgressExport = {
        app: "RTSLR",
        kind: "learning-progress",
        exportedAt: now().toISOString(),
        schema: PROGRESS_SCHEMA,
        progress: snapshot.state,
      };
      return JSON.stringify(payload, null, 2);
    },
  };
}

/** Shared store used by every learning page. */
export const progressStore: ProgressStore = createProgressStore();
