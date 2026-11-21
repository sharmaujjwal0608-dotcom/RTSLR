import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../safeJson";
import {
  MAX_SAMPLES_PER_CLASS,
  MemorySampleBackend,
  RECOGNITION_STORAGE_NAMES,
  SAMPLE_DB_NAME,
  SAMPLE_EXPORT_FORMAT,
  SampleStore,
  SampleStoreError,
  parseSamplesFile,
  parseStoredRecord,
  type NewSample,
} from "../sampleStore";
import { randomVector } from "./testUtils";

const one = (classId: string, seed: number): NewSample => ({
  classId,
  label: classId.toUpperCase(),
  hands: 1,
  vector: randomVector(63, seed),
});
const two = (classId: string, seed: number): NewSample => ({
  classId,
  label: classId.toUpperCase(),
  hands: 2,
  vector: randomVector(156, seed),
});

function newStore(seed: unknown[] = []): SampleStore {
  let clock = 1_700_000_000_000;
  return new SampleStore(new MemorySampleBackend(seed), () => clock++);
}

describe("storage names", () => {
  it("start with rtslr and use no localStorage", () => {
    expect(SAMPLE_DB_NAME.startsWith("rtslr")).toBe(true);
    expect(RECOGNITION_STORAGE_NAMES.indexedDbDatabases).toEqual([SAMPLE_DB_NAME]);
    expect(RECOGNITION_STORAGE_NAMES.localStorageKeys).toEqual([]);
  });
});

describe("SampleStore", () => {
  it("adds, lists and counts samples by class", async () => {
    const store = newStore();
    await store.addSamples([one("a", 1), one("a", 2), two("x", 3)]);
    expect(await store.count()).toBe(3);
    expect(await store.count("a")).toBe(2);
    expect((await store.list("x"))[0].vector).toHaveLength(156);
    expect(await store.summary()).toEqual([
      { classId: "a", label: "A", hands: 1, count: 2 },
      { classId: "x", label: "X", hands: 2, count: 1 },
    ]);
  });

  it("stores vectors only, as Float32Array copies", async () => {
    const store = newStore();
    const source = randomVector(63, 9);
    const saved = await store.addSample({ classId: "a", label: "A", hands: 1, vector: source });
    expect(saved.vector).toBeInstanceOf(Float32Array);
    expect(saved.vector).not.toBe(source);
    expect(Object.keys(saved).sort()).toEqual(["classId", "createdAt", "hands", "id", "label", "vector"]);
  });

  it("refuses a second hand count for an existing class", async () => {
    const store = newStore();
    await store.addSample(one("a", 1));
    await expect(store.addSample(two("a", 2))).rejects.toMatchObject({ code: "hand_count_mismatch" });
    expect(await store.count("a")).toBe(1);
  });

  it("rejects vectors of the wrong length or with non-finite numbers", async () => {
    const store = newStore();
    await expect(
      store.addSample({ classId: "a", label: "A", hands: 1, vector: new Float32Array(156) }),
    ).rejects.toBeInstanceOf(SampleStoreError);
    const bad = randomVector(63, 1);
    bad[3] = Number.POSITIVE_INFINITY;
    await expect(store.addSample({ classId: "a", label: "A", hands: 1, vector: bad })).rejects.toMatchObject({
      code: "invalid_sample",
    });
    await expect(store.addSample({ ...one("__proto__", 1) })).rejects.toMatchObject({ code: "invalid_sample" });
    expect(await store.count()).toBe(0);
  });

  it("adds a batch completely or not at all", async () => {
    const store = newStore();
    await expect(store.addSamples([one("a", 1), two("a", 2)])).rejects.toMatchObject({ code: "hand_count_mismatch" });
    expect(await store.count()).toBe(0);
  });

  it("enforces the per-class cap", async () => {
    const store = newStore();
    await store.addSamples(Array.from({ length: MAX_SAMPLES_PER_CLASS }, (_, i) => one("a", i)));
    await expect(store.addSample(one("a", 999))).rejects.toMatchObject({ code: "class_full" });
    expect(await store.count("a")).toBe(MAX_SAMPLES_PER_CLASS);
  });

  it("removes a sample, a class, and everything", async () => {
    const store = newStore();
    const [first] = await store.addSamples([one("a", 1), one("a", 2), one("b", 3)]);
    expect(await store.removeSample(first.id)).toBe(true);
    expect(await store.removeSample("missing")).toBe(false);
    expect(await store.count("a")).toBe(1);
    expect(await store.removeClass("a")).toBe(1);
    expect(await store.removeClass("a")).toBe(0);
    await store.clearAll();
    expect(await store.count()).toBe(0);
    expect(await store.summary()).toEqual([]);
  });

  it("notifies subscribers and bumps the version on every change", async () => {
    const store = newStore();
    await store.ready();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.version;
    await store.addSample(one("a", 1));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.version).toBeGreaterThan(before);
    unsubscribe();
    await store.clearAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("persists through the backend: a second store sees the same samples", async () => {
    const backend = new MemorySampleBackend();
    const first = new SampleStore(backend);
    await first.addSamples([one("a", 1), two("x", 2)]);
    const second = new SampleStore(backend);
    expect(await second.summary()).toEqual([
      { classId: "a", label: "A", hands: 1, count: 1 },
      { classId: "x", label: "X", hands: 2, count: 1 },
    ]);
    expect(second.persistent).toBe(false); // memory backend: lost on reload, and it says so
  });

  it("ignores corrupt stored records, counts them, and does not crash", async () => {
    const good = {
      id: "ok",
      schema: "rtslr-features-1",
      recordVersion: 1,
      classId: "a",
      label: "A",
      hands: 1,
      vector: Array.from(randomVector(63, 1)),
      createdAt: 5,
    };
    const store = newStore([
      good,
      { ...good, id: "short", vector: [1, 2, 3] },
      { ...good, id: "nan", vector: good.vector.map(() => null) },
      { ...good, id: "future", recordVersion: 99 },
      { ...good, id: "schema", schema: "something-else" },
      { ...good, id: "extra", image: "data:image/png;base64,AAAA" },
      "not an object",
      null,
    ]);
    expect(await store.count()).toBe(1);
    expect(store.invalidRecordCount).toBe(7);
    await store.clearAll();
    expect(store.invalidRecordCount).toBe(0);
  });
});

describe("export and import", () => {
  it("round-trips samples through JSON", async () => {
    const source = newStore();
    await source.addSamples([one("a", 1), one("a", 2), two("x", 3)]);
    const text = await source.exportJson();
    const parsed = JSON.parse(text) as { format: string; featureSchema: string; classes: { vectors: number[][] }[] };
    expect(parsed.format).toBe(SAMPLE_EXPORT_FORMAT);
    expect(parsed.featureSchema).toBe("rtslr-features-1");
    expect(parsed.classes.map((c) => c.vectors.length)).toEqual([2, 1]);

    const target = newStore();
    expect(await target.importJson(text)).toEqual({ classes: 2, samples: 3 });
    expect(await target.summary()).toEqual(await source.summary());
    const a = (await source.list("a"))[0].vector;
    const b = (await target.list("a"))[0].vector;
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it("merge adds to existing samples; replace discards them first", async () => {
    const source = newStore();
    await source.addSamples([one("a", 1)]);
    const text = await source.exportJson();

    const merged = newStore();
    await merged.addSamples([one("a", 5), one("b", 6)]);
    await merged.importJson(text, "merge");
    expect(await merged.count("a")).toBe(2);
    expect(await merged.count("b")).toBe(1);

    const replaced = newStore();
    await replaced.addSamples([one("b", 6)]);
    await replaced.importJson(text, "replace");
    expect((await replaced.summary()).map((s) => s.classId)).toEqual(["a"]);
  });

  const file = (classes: unknown, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ format: SAMPLE_EXPORT_FORMAT, featureSchema: "rtslr-features-1", classes, ...extra });
  const vec63 = Array.from(randomVector(63, 1));

  it.each([
    ["not JSON", "{oops"],
    ["wrong format", JSON.stringify({ format: "other", featureSchema: "rtslr-features-1", classes: [] })],
    ["wrong feature schema", JSON.stringify({ format: SAMPLE_EXPORT_FORMAT, featureSchema: "v0", classes: [] })],
    ["unknown top-level key", file([], { script: "alert(1)" })],
    ["wrong vector length", file([{ classId: "a", label: "A", hands: 1, vectors: [[1, 2, 3]] }])],
    ["a 126-D two-hand vector", file([{ classId: "a", label: "A", hands: 2, vectors: [new Array(126).fill(0.1)] }])],
    ["a string in a vector", file([{ classId: "a", label: "A", hands: 1, vectors: [[...vec63.slice(0, 62), "1"]] }])],
    ["a null in a vector", file([{ classId: "a", label: "A", hands: 1, vectors: [[...vec63.slice(0, 62), null]] }])],
    ["hands = 3", file([{ classId: "a", label: "A", hands: 3, vectors: [vec63] }])],
    ["an over-long label", file([{ classId: "a", label: "x".repeat(65), hands: 1, vectors: [vec63] }])],
    ["an empty class", file([{ classId: "a", label: "A", hands: 1, vectors: [] }])],
    ["a duplicate class", file([
      { classId: "a", label: "A", hands: 1, vectors: [vec63] },
      { classId: "a", label: "A", hands: 1, vectors: [vec63] },
    ])],
    ["a constructor class id", file([{ classId: "constructor", label: "A", hands: 1, vectors: [vec63] }])],
    [
      "a __proto__ key",
      `{"format":"${SAMPLE_EXPORT_FORMAT}","featureSchema":"rtslr-features-1","classes":[{"classId":"a","label":"A","hands":1,"vectors":[],"__proto__":{"polluted":true}}]}`,
    ],
    ["too many samples in a class", file([{ classId: "a", label: "A", hands: 1, vectors: new Array(201).fill(vec63) }])],
  ])("rejects a file with %s", (_name, text) => {
    expect(() => parseSamplesFile(text)).toThrow(ValidationError);
  });

  it("rejects an oversized file before parsing it", () => {
    const huge = `{"format":"${SAMPLE_EXPORT_FORMAT}","pad":"${"x".repeat(5 * 1024 * 1024)}"}`;
    expect(() => parseSamplesFile(huge)).toThrow(/5 MB/);
  });

  it("does not pollute Object.prototype", () => {
    try {
      parseSamplesFile('{"__proto__":{"polluted":true},"format":"rtslr-samples-1"}');
    } catch {
      /* expected */
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("a rejected import changes nothing", async () => {
    const store = newStore();
    await store.addSamples([one("a", 1)]);
    const conflicting = file([
      { classId: "b", label: "B", hands: 1, vectors: [vec63] },
      { classId: "a", label: "A", hands: 2, vectors: [new Array(156).fill(0.5)] },
    ]);
    await expect(store.importJson(conflicting, "merge")).rejects.toBeInstanceOf(ValidationError);
    expect(await store.summary()).toEqual([{ classId: "a", label: "A", hands: 1, count: 1 }]);
    // The store keeps working after the failure.
    await store.addSample(one("a", 2));
    expect(await store.count("a")).toBe(2);
  });

  it("parseStoredRecord accepts exactly the record shape the store writes", () => {
    const record = {
      id: "x",
      schema: "rtslr-features-1",
      recordVersion: 1,
      classId: "a",
      label: "A",
      hands: 2,
      vector: new Array(156).fill(0.25),
      createdAt: 1,
    };
    expect(parseStoredRecord(record).vector).toHaveLength(156);
    expect(() => parseStoredRecord({ ...record, hands: 1 })).toThrow(ValidationError);
  });
});
