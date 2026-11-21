import { describe, expect, it, vi } from "vitest";
import { LESSONS } from "./content";
import { completedLessonCount, lessonStatus, lessonToContinue } from "./lessons";
import {
  LEARNING_STORAGE_KEYS,
  LEARNING_STORAGE_PREFIX,
  MAX_QUIZ_RECORDS,
  PROGRESS_SCHEMA,
  computeStreak,
  createProgressStore,
  emptyProgress,
  parseProgress,
  type ProgressExport,
  type ProgressState,
  type StorageLike,
} from "./progressStore";

const KEY = LEARNING_STORAGE_KEYS.progress;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { data, storage };
}

function clock(start = new Date(2026, 10, 21, 9, 0)) {
  let current = start;
  return {
    now: () => current,
    set: (date: Date) => {
      current = date;
    },
  };
}

const stored = (data: Map<string, string>): ProgressState => JSON.parse(data.get(KEY) ?? "null") as ProgressState;

describe("storage keys", () => {
  it("all start with the rtslr.learning. prefix", () => {
    expect(LEARNING_STORAGE_PREFIX).toBe("rtslr.learning.");
    for (const key of Object.values(LEARNING_STORAGE_KEYS)) expect(key.startsWith(LEARNING_STORAGE_PREFIX)).toBe(true);
  });
});

describe("progress store with working storage", () => {
  it("starts empty, ready and in local mode, and writes nothing until something changes", () => {
    const { data, storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage });
    expect(store.getServerSnapshot()).toMatchObject({ ready: false, storage: "local" });
    const snapshot = store.getSnapshot();
    expect(snapshot).toEqual({ ready: true, storage: "local", state: emptyProgress() });
    expect(data.size).toBe(0);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it("toggles favourites and saved lessons and persists them", () => {
    const { data, storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage });
    expect(store.toggleFavourite("isl-everyday-water")).toBe(true);
    expect(store.toggleFavourite("isl-family-mother")).toBe(true);
    expect(store.toggleFavourite("isl-everyday-water")).toBe(false);
    expect(store.toggleSavedLesson("family-close")).toBe(true);
    expect(stored(data).favourites).toEqual(["isl-family-mother"]);
    expect(stored(data).savedLessons).toEqual(["family-close"]);
    expect(stored(data).schema).toBe(PROGRESS_SCHEMA);
    // Favourites are not learning activity.
    expect(stored(data).activeDays).toEqual([]);
  });

  it("notifies subscribers with a new snapshot object on each change", () => {
    const { storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    store.toggleFavourite("isl-everyday-water");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    unsubscribe();
    store.toggleFavourite("isl-everyday-water");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("remembers the lesson position so a new store resumes where the learner left off", () => {
    const { storage } = memoryStorage();
    const time = clock();
    const lesson = LESSONS.find((entry) => entry.id === "family-close");
    if (!lesson) throw new Error("lesson missing");

    const first = createProgressStore({ getStorage: () => storage, now: time.now });
    expect(lessonStatus(lesson, first.getSnapshot().state)).toEqual({ status: "not-started", index: 0, total: 7 });
    first.setLessonPosition(lesson.id, 1);
    first.setLessonPosition(lesson.id, 3);

    const second = createProgressStore({ getStorage: () => storage, now: time.now });
    const state = second.getSnapshot().state;
    expect(lessonStatus(lesson, state)).toEqual({ status: "in-progress", index: 3, total: 7 });
    expect(lessonToContinue(state)?.id).toBe("family-close");
    expect(state.activeDays).toEqual(["2026-11-21"]);
  });

  it("marks a lesson complete, keeps it complete when revisited and can restart it", () => {
    const { storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage, now: clock().now });
    const lesson = LESSONS[0];
    store.setLessonPosition(lesson.id, lesson.signIds.length - 1);
    store.completeLesson(lesson.id);

    let state = store.getSnapshot().state;
    expect(lessonStatus(lesson, state).status).toBe("completed");
    expect(completedLessonCount(state)).toBe(1);
    expect(lessonToContinue(state)).toBeUndefined();

    store.setLessonPosition(lesson.id, 0);
    state = store.getSnapshot().state;
    expect(lessonStatus(lesson, state)).toMatchObject({ status: "completed", index: 0 });

    store.restartLesson(lesson.id);
    state = store.getSnapshot().state;
    expect(lessonStatus(lesson, state).status).toBe("not-started");
    expect(completedLessonCount(state)).toBe(0);
  });

  it("clamps an out-of-range stored position when read", () => {
    const { storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage, now: clock().now });
    const lesson = LESSONS[0];
    store.setLessonPosition(lesson.id, 999);
    expect(lessonStatus(lesson, store.getSnapshot().state).index).toBe(lesson.signIds.length - 1);
    store.setLessonPosition(lesson.id, -4);
    expect(lessonStatus(lesson, store.getSnapshot().state).index).toBe(0);
  });

  it("records self-ratings as spaced-repetition cards", () => {
    const { data, storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage, now: clock().now });
    expect(store.rateSign("isl-everyday-water", "got-it")).toMatchObject({ box: 2, due: "2026-11-22", reviews: 1 });
    expect(store.rateSign("isl-everyday-water", "got-it")).toMatchObject({ box: 3, due: "2026-11-24", reviews: 2 });
    expect(store.rateSign("isl-everyday-food", "need-practice")).toMatchObject({ box: 1, due: "2026-11-21" });
    expect(Object.keys(stored(data).cards).sort()).toEqual(["isl-everyday-food", "isl-everyday-water"]);
  });

  it("keeps quiz history newest first and capped", () => {
    const { storage } = memoryStorage();
    const time = clock();
    const store = createProgressStore({ getStorage: () => storage, now: time.now });
    for (let i = 0; i < MAX_QUIZ_RECORDS + 5; i += 1) {
      time.set(new Date(2026, 10, 21, 9, i));
      store.recordQuiz({ direction: "en-hi", category: "all", total: 10, correct: i % 11 });
    }
    const { quizzes } = store.getSnapshot().state;
    expect(quizzes).toHaveLength(MAX_QUIZ_RECORDS);
    expect(quizzes[0].correct).toBe((MAX_QUIZ_RECORDS + 4) % 11);
    expect(quizzes[0].at > quizzes[1].at).toBe(true);
  });

  it("records one active day per calendar day of activity", () => {
    const { storage } = memoryStorage();
    const time = clock(new Date(2026, 10, 19, 23, 50));
    const store = createProgressStore({ getStorage: () => storage, now: time.now });
    store.rateSign("isl-everyday-water", "got-it");
    store.recordQuiz({ direction: "hi-en", category: "family", total: 5, correct: 5 });
    time.set(new Date(2026, 10, 20, 0, 5));
    store.setLessonPosition("family-close", 1);
    time.set(new Date(2026, 10, 22, 8, 0));
    store.completeLesson("family-close");
    expect(store.getSnapshot().state.activeDays).toEqual(["2026-11-19", "2026-11-20", "2026-11-22"]);
  });

  it("resets: clears memory and removes the stored record", () => {
    const { data, storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage, now: clock().now });
    store.toggleFavourite("isl-everyday-water");
    store.rateSign("isl-everyday-water", "got-it");
    expect(data.has(KEY)).toBe(true);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(data.size).toBe(0);
    expect(store.getSnapshot()).toEqual({ ready: true, storage: "local", state: emptyProgress() });
  });

  it("reloads after another part of the app deleted the keys", () => {
    const { data, storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage });
    store.toggleFavourite("isl-everyday-water");
    for (const key of Object.values(LEARNING_STORAGE_KEYS)) data.delete(key);
    store.reload();
    expect(store.getSnapshot().state.favourites).toEqual([]);
  });

  it("exports the progress as JSON that parses back to the same state", () => {
    const { storage } = memoryStorage();
    const store = createProgressStore({ getStorage: () => storage, now: clock().now });
    store.toggleFavourite("isl-everyday-water");
    store.rateSign("isl-everyday-water", "need-practice");
    store.recordQuiz({ direction: "en-hi", category: "all", total: 5, correct: 4 });
    store.setLessonPosition("family-close", 2);

    const payload = JSON.parse(store.exportJson()) as ProgressExport;
    expect(payload).toMatchObject({ app: "RTSLR", kind: "learning-progress", schema: PROGRESS_SCHEMA });
    expect(payload.exportedAt).toBe(new Date(2026, 10, 21, 9, 0).toISOString());
    expect(payload.progress).toEqual(store.getSnapshot().state);
    expect(parseProgress(JSON.stringify(payload.progress))).toEqual({ ok: true, state: store.getSnapshot().state });
  });
});

describe("progress store without usable storage", () => {
  const cases: [string, () => StorageLike | null][] = [
    ["no storage object", () => null],
    [
      "access throws",
      () => {
        throw new Error("SecurityError");
      },
    ],
    [
      "reads work but writes throw",
      () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => undefined,
      }),
    ],
    [
      "reads throw",
      () => ({
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
    ],
  ];

  for (const [name, getStorage] of cases) {
    it(`falls back to memory when ${name}`, () => {
      const store = createProgressStore({ getStorage, now: clock().now });
      expect(store.getSnapshot()).toMatchObject({ ready: true, storage: "memory" });
      store.toggleFavourite("isl-everyday-water");
      store.rateSign("isl-everyday-water", "got-it");
      store.recordQuiz({ direction: "en-hi", category: "all", total: 5, correct: 5 });
      const { state, storage } = store.getSnapshot();
      expect(storage).toBe("memory");
      expect(state.favourites).toEqual(["isl-everyday-water"]);
      expect(state.quizzes).toHaveLength(1);
      expect(JSON.parse(store.exportJson()).progress.favourites).toEqual(["isl-everyday-water"]);
      store.reset();
      expect(store.getSnapshot()).toMatchObject({ storage: "memory", state: emptyProgress() });
    });
  }

  it("switches to memory when a later write is refused, keeping the change", () => {
    let full = false;
    const { data, storage } = memoryStorage();
    const flaky: StorageLike = {
      ...storage,
      setItem: (key, value) => {
        if (full) throw new Error("QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    const store = createProgressStore({ getStorage: () => flaky });
    store.toggleFavourite("isl-everyday-water");
    full = true;
    store.toggleFavourite("isl-family-mother");
    expect(store.getSnapshot().storage).toBe("memory");
    expect(store.getSnapshot().state.favourites).toEqual(["isl-everyday-water", "isl-family-mother"]);
    expect(stored(data).favourites).toEqual(["isl-everyday-water"]);
  });
});

describe("validation on read", () => {
  const valid = (): ProgressState => ({
    ...emptyProgress(),
    favourites: ["isl-everyday-water"],
    savedLessons: ["family-close"],
    lessons: { "family-close": { index: 2, completedAt: null, updatedAt: "2026-11-21T03:30:00.000Z" } },
    lastLessonId: "family-close",
    cards: {
      "isl-everyday-water": {
        box: 2,
        due: "2026-11-22",
        lastRating: "got-it",
        reviews: 1,
        lastReviewedAt: "2026-11-21T03:30:00.000Z",
      },
    },
    quizzes: [{ at: "2026-11-21T03:30:00.000Z", direction: "en-hi", category: "all", total: 5, correct: 4 }],
    activeDays: ["2026-11-21"],
  });

  it("accepts a valid record unchanged", () => {
    expect(parseProgress(JSON.stringify(valid()))).toEqual({ ok: true, state: valid() });
  });

  it("drops unknown fields, removes duplicate ids and sorts days", () => {
    const record = { ...valid(), extra: "x", favourites: ["a", "a", "b"], activeDays: ["2026-11-21", "2026-11-19", "2026-11-21"] };
    const result = parseProgress(JSON.stringify(record));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.favourites).toEqual(["a", "b"]);
      expect(result.state.activeDays).toEqual(["2026-11-19", "2026-11-21"]);
      expect("extra" in result.state).toBe(false);
    }
  });

  it("rejects text that is not JSON, and oversized input", () => {
    expect(parseProgress("{not json")).toEqual({ ok: false, reason: "not_json" });
    expect(parseProgress(" ".repeat(1_000_001))).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects a missing, older-unknown or newer schema", () => {
    for (const schema of [undefined, 0, 2, "1"]) {
      expect(parseProgress(JSON.stringify({ ...valid(), schema }))).toEqual({ ok: false, reason: "unknown_schema" });
    }
  });

  const broken: [string, (state: Record<string, unknown>) => void][] = [
    ["favourites not an array", (s) => (s.favourites = "isl-everyday-water")],
    ["an id with unsafe characters", (s) => (s.favourites = ["<script>"])],
    ["a non-string id", (s) => (s.savedLessons = [7])],
    ["a negative lesson index", (s) => (s.lessons = { a: { index: -1, completedAt: null, updatedAt: "2026-11-21T03:30:00.000Z" } })],
    ["a lesson without a timestamp", (s) => (s.lessons = { a: { index: 1, completedAt: null } })],
    ["a __proto__ key", (s) => (s.cards = JSON.parse('{"__proto__": {"polluted": true}}'))],
    ["a card box out of range", (s) => (s.cards = { a: { box: 9, due: "2026-11-22", lastRating: "got-it", reviews: 1, lastReviewedAt: "2026-11-21T03:30:00.000Z" } })],
    ["a card with an impossible date", (s) => (s.cards = { a: { box: 1, due: "2026-02-31", lastRating: "got-it", reviews: 1, lastReviewedAt: "2026-11-21T03:30:00.000Z" } })],
    ["an unknown rating", (s) => (s.cards = { a: { box: 1, due: "2026-11-22", lastRating: "perfect", reviews: 1, lastReviewedAt: "2026-11-21T03:30:00.000Z" } })],
    ["a quiz with more correct than total", (s) => (s.quizzes = [{ at: "2026-11-21T03:30:00.000Z", direction: "en-hi", category: "all", total: 5, correct: 6 }])],
    ["a quiz with an unknown direction", (s) => (s.quizzes = [{ at: "2026-11-21T03:30:00.000Z", direction: "fr-en", category: "all", total: 5, correct: 1 }])],
    ["too many quizzes", (s) => (s.quizzes = Array.from({ length: MAX_QUIZ_RECORDS + 1 }, () => ({ at: "2026-11-21T03:30:00.000Z", direction: "en-hi", category: "all", total: 5, correct: 1 })))],
    ["a malformed active day", (s) => (s.activeDays = ["21/11/2026"])],
    ["lastLessonId of the wrong type", (s) => (s.lastLessonId = 4)],
  ];

  for (const [name, mutate] of broken) {
    it(`rejects ${name}`, () => {
      const record = JSON.parse(JSON.stringify(valid())) as Record<string, unknown>;
      mutate(record);
      expect(parseProgress(JSON.stringify(record))).toEqual({ ok: false, reason: "invalid_shape" });
    });
  }

  it("rejects arrays and primitives at the top level", () => {
    expect(parseProgress("[]")).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseProgress("null")).toEqual({ ok: false, reason: "invalid_shape" });
    expect(parseProgress('"text"')).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("does not pollute Object.prototype from a stored record", () => {
    parseProgress('{"schema":1,"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reports an unreadable stored record, leaves it untouched and works in memory", () => {
    const { data, storage } = memoryStorage({ [KEY]: '{"schema":99}' });
    const store = createProgressStore({ getStorage: () => storage });
    expect(store.getSnapshot()).toMatchObject({ ready: true, storage: "invalid", state: emptyProgress() });
    store.toggleFavourite("isl-everyday-water");
    expect(store.getSnapshot().state.favourites).toEqual(["isl-everyday-water"]);
    expect(store.getSnapshot().storage).toBe("invalid");
    expect(data.get(KEY)).toBe('{"schema":99}');
  });

  it("starts saving again after the user resets an unreadable record", () => {
    const { data, storage } = memoryStorage({ [KEY]: "garbage" });
    const store = createProgressStore({ getStorage: () => storage });
    expect(store.getSnapshot().storage).toBe("invalid");
    store.reset();
    expect(store.getSnapshot().storage).toBe("local");
    expect(data.has(KEY)).toBe(false);
    store.toggleFavourite("isl-everyday-water");
    expect(stored(data).favourites).toEqual(["isl-everyday-water"]);
  });
});

describe("computeStreak", () => {
  const today = "2026-11-21";

  it("is zero with no activity", () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, activeToday: false });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-11-19", "2026-11-20", "2026-11-21"], today)).toEqual({
      current: 3,
      longest: 3,
      activeToday: true,
    });
  });

  it("keeps the streak alive until the end of a day without activity yet", () => {
    expect(computeStreak(["2026-11-19", "2026-11-20"], today)).toEqual({ current: 2, longest: 2, activeToday: false });
  });

  it("breaks after a missed day", () => {
    expect(computeStreak(["2026-11-17", "2026-11-18", "2026-11-19"], today)).toEqual({
      current: 0,
      longest: 3,
      activeToday: false,
    });
  });

  it("reports the longest run separately and handles month boundaries, order and duplicates", () => {
    const days = ["2026-11-21", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29", "2026-11-21", "2026-11-20"];
    expect(computeStreak(days, today)).toEqual({ current: 2, longest: 4, activeToday: true });
  });
});
