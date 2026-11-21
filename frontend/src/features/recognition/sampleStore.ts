/**
 * Storage for the samples a user records for the experimental ISL model.
 *
 * What is stored: landmark-derived number vectors (63-D for a one-hand sign,
 * 156-D coordinated vector for a two-hand sign), the class id and label the
 * user typed, the hand count and a timestamp. No image, frame or thumbnail is
 * ever stored (docs/SECURITY_PRIVACY.md LOC-02).
 *
 * Where: IndexedDB database `rtslr-samples`. When IndexedDB is missing or
 * refuses to open (private windows, blocked storage) the store falls back to
 * memory and reports `persistent === false`. localStorage is not used.
 *
 * Everything read back from storage or from an imported file is validated
 * before use (MOD-09..MOD-12): storage can be edited by anyone with access to
 * the browser profile.
 */

import {
  DUAL_FEATURE_DIM,
  FEATURE_SCHEMA_VERSION,
  SINGLE_FEATURE_DIM,
} from "../../types/recognition";
import {
  MAX_CLASS_COUNT,
  MAX_JSON_BYTES,
  ValidationError,
  expectArray,
  expectFloatVector,
  expectInteger,
  expectLabel,
  expectObject,
  expectString,
  isPlainObject,
  parseJsonSafely,
} from "./safeJson";

/* ------------------------------------------------------------------ */
/* Names and limits (used by the "delete all my local data" control)   */
/* ------------------------------------------------------------------ */

export const SAMPLE_DB_NAME = "rtslr-samples";
export const SAMPLE_DB_VERSION = 1;
export const SAMPLE_OBJECT_STORE = "samples";

/** Every browser-storage name this feature creates. */
export const RECOGNITION_STORAGE_NAMES = {
  indexedDbDatabases: [SAMPLE_DB_NAME] as readonly string[],
  localStorageKeys: [] as readonly string[],
  sessionStorageKeys: [] as readonly string[],
  cacheStorageNames: [] as readonly string[],
} as const;

export const SAMPLE_EXPORT_FORMAT = "rtslr-samples-1";
export const SAMPLE_RECORD_VERSION = 1;
/** docs/SECURITY_PRIVACY.md §8.1: 200 samples per sign, 20 MB in total. */
export const MAX_SAMPLES_PER_CLASS = 200;
export const MAX_TOTAL_SAMPLE_BYTES = 20 * 1024 * 1024;
/** A stored number costs about 8 bytes as a JSON-like double. */
const BYTES_PER_NUMBER = 8;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SampleHands = 1 | 2;

export type StoredSample = {
  id: string;
  classId: string;
  label: string;
  hands: SampleHands;
  /** 63 numbers when hands === 1, 156 when hands === 2. */
  vector: Float32Array;
  /** Date.now() when the sample was recorded or imported. */
  createdAt: number;
};

export type NewSample = {
  classId: string;
  label: string;
  hands: SampleHands;
  vector: ArrayLike<number>;
};

export type ClassSummary = {
  classId: string;
  label: string;
  hands: SampleHands;
  count: number;
};

export type ImportMode = "merge" | "replace";
export type ImportResult = { classes: number; samples: number };

export class SampleStoreError extends Error {
  constructor(
    message: string,
    readonly code: "class_full" | "storage_full" | "hand_count_mismatch" | "invalid_sample" | "storage_failed",
  ) {
    super(message);
    this.name = "SampleStoreError";
  }
}

/** The raw record as written to IndexedDB (plain JSON-like values only). */
type RawRecord = {
  id: string;
  schema: string;
  recordVersion: number;
  classId: string;
  label: string;
  hands: number;
  vector: number[];
  createdAt: number;
};

/** Minimal persistence interface; IndexedDB and memory both implement it. */
export interface SampleBackend {
  readonly persistent: boolean;
  getAll(): Promise<unknown[]>;
  putMany(records: RawRecord[]): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function expectedDimension(hands: SampleHands): number {
  return hands === 1 ? SINGLE_FEATURE_DIM : DUAL_FEATURE_DIM;
}

function expectHands(value: unknown, path: string): SampleHands {
  if (value !== 1 && value !== 2) throw new ValidationError(`${path}: hands must be 1 or 2`);
  return value;
}

/** Validates one record read back from storage. Throws ValidationError. */
export function parseStoredRecord(value: unknown): StoredSample {
  const record = expectObject(value, "record", [
    "id",
    "schema",
    "recordVersion",
    "classId",
    "label",
    "hands",
    "vector",
    "createdAt",
  ]);
  if (record.schema !== FEATURE_SCHEMA_VERSION) {
    throw new ValidationError(`record: unknown feature schema "${String(record.schema)}"`);
  }
  if (record.recordVersion !== SAMPLE_RECORD_VERSION) {
    throw new ValidationError(`record: unknown record version "${String(record.recordVersion)}"`);
  }
  const hands = expectHands(record.hands, "record.hands");
  return {
    id: expectString(record.id, "record.id", 80),
    classId: expectLabel(record.classId, "record.classId"),
    label: expectLabel(record.label, "record.label"),
    hands,
    vector: expectFloatVector(record.vector, "record.vector", expectedDimension(hands)),
    createdAt: expectInteger(record.createdAt, "record.createdAt", 0, Number.MAX_SAFE_INTEGER),
  };
}

function toRawRecord(sample: StoredSample): RawRecord {
  return {
    id: sample.id,
    schema: FEATURE_SCHEMA_VERSION,
    recordVersion: SAMPLE_RECORD_VERSION,
    classId: sample.classId,
    label: sample.label,
    hands: sample.hands,
    vector: Array.from(sample.vector),
    createdAt: sample.createdAt,
  };
}

function validateNewSample(sample: NewSample, index: number): Omit<StoredSample, "id" | "createdAt"> {
  const path = `sample[${index}]`;
  try {
    const hands = expectHands(sample.hands, `${path}.hands`);
    return {
      classId: expectLabel(sample.classId, `${path}.classId`),
      label: expectLabel(sample.label, `${path}.label`).trim(),
      hands,
      vector: expectFloatVector(Array.from(sample.vector), `${path}.vector`, expectedDimension(hands)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SampleStoreError(message, "invalid_sample");
  }
}

type ParsedImportClass = { classId: string; label: string; hands: SampleHands; vectors: Float32Array[] };

/**
 * Validates an exported samples file. Nothing is applied here; the caller
 * decides what to do with the fully validated result (MOD-12).
 */
export function parseSamplesFile(text: string): ParsedImportClass[] {
  const parsed = parseJsonSafely(text, MAX_JSON_BYTES, "The samples file");
  const root = expectObject(parsed, "$", ["format", "featureSchema", "exportedAt", "classes"]);
  if (root.format !== SAMPLE_EXPORT_FORMAT) {
    throw new ValidationError(`This is not an RTSLR samples file (expected format "${SAMPLE_EXPORT_FORMAT}").`);
  }
  if (root.featureSchema !== FEATURE_SCHEMA_VERSION) {
    throw new ValidationError(
      `The samples were recorded with feature schema "${String(root.featureSchema)}"; this app uses "${FEATURE_SCHEMA_VERSION}".`,
    );
  }
  if (root.exportedAt !== undefined) expectString(root.exportedAt, "$.exportedAt", 40);

  const classes = expectArray(root.classes, "$.classes", MAX_CLASS_COUNT);
  const seen = new Set<string>();
  let totalBytes = 0;
  const result: ParsedImportClass[] = [];

  classes.forEach((entry, i) => {
    const path = `$.classes[${i}]`;
    const item = expectObject(entry, path, ["classId", "label", "hands", "vectors"]);
    const classId = expectLabel(item.classId, `${path}.classId`);
    if (seen.has(classId)) throw new ValidationError(`${path}: class "${classId}" appears twice`);
    seen.add(classId);
    const hands = expectHands(item.hands, `${path}.hands`);
    const dimension = expectedDimension(hands);
    const rawVectors = expectArray(item.vectors, `${path}.vectors`, MAX_SAMPLES_PER_CLASS);
    if (rawVectors.length === 0) throw new ValidationError(`${path}.vectors: a class needs at least one sample`);
    const vectors = rawVectors.map((v, j) => expectFloatVector(v, `${path}.vectors[${j}]`, dimension));
    totalBytes += vectors.length * dimension * BYTES_PER_NUMBER;
    if (totalBytes > MAX_TOTAL_SAMPLE_BYTES) throw new ValidationError("The samples file exceeds the 20 MB storage limit.");
    result.push({ classId, label: expectLabel(item.label, `${path}.label`).trim(), hands, vectors });
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* Backends                                                            */
/* ------------------------------------------------------------------ */

export class MemorySampleBackend implements SampleBackend {
  readonly persistent = false;
  private readonly records = new Map<string, RawRecord>();

  /** `seed` lets tests start from arbitrary (even corrupt) stored content. */
  constructor(private readonly seed: unknown[] = []) {}

  async getAll(): Promise<unknown[]> {
    return [...this.seed, ...this.records.values()];
  }
  async putMany(records: RawRecord[]): Promise<void> {
    for (const record of records) this.records.set(record.id, record);
  }
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) this.records.delete(id);
    const doomed = new Set(ids);
    for (let i = this.seed.length - 1; i >= 0; i--) {
      const item = this.seed[i];
      if (isPlainObject(item) && typeof item.id === "string" && doomed.has(item.id)) this.seed.splice(i, 1);
    }
  }
  async clear(): Promise<void> {
    this.records.clear();
    this.seed.length = 0;
  }
  close(): void {}
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IndexedDbSampleBackend implements SampleBackend {
  readonly persistent = true;
  private constructor(private db: IDBDatabase | null) {}

  static open(factory: IDBFactory): Promise<IndexedDbSampleBackend> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(SAMPLE_DB_NAME, SAMPLE_DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAMPLE_OBJECT_STORE)) {
          db.createObjectStore(SAMPLE_OBJECT_STORE, { keyPath: "id" });
        }
      };
      request.onblocked = () => reject(new Error("IndexedDB open was blocked by another tab"));
      request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened"));
      request.onsuccess = () => {
        const backend = new IndexedDbSampleBackend(request.result);
        // Let another tab (or the delete-all control) delete or upgrade the database.
        request.result.onversionchange = () => backend.close();
        resolve(backend);
      };
    });
  }

  private store(mode: IDBTransactionMode): { tx: IDBTransaction; store: IDBObjectStore } {
    if (!this.db) throw new Error("The sample database is closed");
    const tx = this.db.transaction(SAMPLE_OBJECT_STORE, mode);
    return { tx, store: tx.objectStore(SAMPLE_OBJECT_STORE) };
  }

  async getAll(): Promise<unknown[]> {
    const { store } = this.store("readonly");
    return requestToPromise<unknown[]>(store.getAll());
  }
  async putMany(records: RawRecord[]): Promise<void> {
    const { tx, store } = this.store("readwrite");
    for (const record of records) store.put(record);
    await transactionDone(tx);
  }
  async deleteMany(ids: string[]): Promise<void> {
    const { tx, store } = this.store("readwrite");
    for (const id of ids) store.delete(id);
    await transactionDone(tx);
  }
  async clear(): Promise<void> {
    const { tx, store } = this.store("readwrite");
    store.clear();
    await transactionDone(tx);
  }
  close(): void {
    this.db?.close();
    this.db = null;
  }
}

/** IndexedDB when it works, memory otherwise. Never throws. */
export async function openDefaultSampleBackend(): Promise<SampleBackend> {
  const factory: IDBFactory | undefined =
    typeof globalThis !== "undefined" ? (globalThis as { indexedDB?: IDBFactory }).indexedDB : undefined;
  if (!factory) return new MemorySampleBackend();
  try {
    return await IndexedDbSampleBackend.open(factory);
  } catch {
    return new MemorySampleBackend();
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let idCounter = 0;
function newSampleId(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  idCounter += 1;
  return `s-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export type SampleStoreListener = () => void;

export class SampleStore {
  private samples: StoredSample[] = [];
  private invalidRecords = 0;
  private loaded = false;
  private loading: Promise<void> | null = null;
  private backend: SampleBackend | null;
  private readonly listeners = new Set<SampleStoreListener>();
  private revision = 0;
  /** Serialises writes so that concurrent calls cannot interleave. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * @param backend a backend, or nothing to pick IndexedDB with a memory fallback on first use.
   * @param now injected clock for tests.
   */
  constructor(
    backend?: SampleBackend,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.backend = backend ?? null;
  }

  /** True when samples survive a reload. Meaningful after `ready()`. */
  get persistent(): boolean {
    return this.backend?.persistent ?? false;
  }

  /** Number of stored records that failed validation and are being ignored (LOC-09). */
  get invalidRecordCount(): number {
    return this.invalidRecords;
  }

  /** Increases on every change; cheap change detection for consumers. */
  get version(): number {
    return this.revision;
  }

  /** Loads and validates stored samples once. Safe to call repeatedly. */
  ready(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loading) {
      this.loading = (async () => {
        if (!this.backend) this.backend = await openDefaultSampleBackend();
        let raw: unknown[];
        try {
          raw = await this.backend.getAll();
        } catch {
          // Storage is unreadable: keep working in memory rather than failing recognition.
          this.backend.close();
          this.backend = new MemorySampleBackend();
          raw = [];
        }
        const valid: StoredSample[] = [];
        let invalid = 0;
        for (const record of raw) {
          try {
            valid.push(parseStoredRecord(record));
          } catch {
            invalid += 1;
          }
        }
        valid.sort((a, b) => a.createdAt - b.createdAt);
        this.samples = valid;
        this.invalidRecords = invalid;
        this.loaded = true;
        this.bump();
      })();
    }
    return this.loading;
  }

  subscribe(listener: SampleStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Current samples (oldest first). The array is replaced, never mutated. */
  getSnapshot(): readonly StoredSample[] {
    return this.samples;
  }

  async list(classId?: string): Promise<StoredSample[]> {
    await this.ready();
    return classId === undefined ? [...this.samples] : this.samples.filter((s) => s.classId === classId);
  }

  /** One entry per class with its label, hand count and sample count. */
  async summary(): Promise<ClassSummary[]> {
    await this.ready();
    return summariseSamples(this.samples);
  }

  async count(classId?: string): Promise<number> {
    return (await this.list(classId)).length;
  }

  /**
   * Adds samples in one transaction. All of them are stored or none.
   * Rejects with SampleStoreError when a class would mix hand counts, when a
   * class is full (200) or when the total would pass 20 MB.
   */
  addSamples(newSamples: NewSample[]): Promise<StoredSample[]> {
    return this.enqueue(async () => {
      const validated = newSamples.map(validateNewSample);
      const handsByClass = new Map<string, SampleHands>();
      const countByClass = new Map<string, number>();
      for (const s of this.samples) {
        handsByClass.set(s.classId, s.hands);
        countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
      }
      let bytes = estimateBytes(this.samples);
      const stamped: StoredSample[] = [];
      const timestamp = this.now();
      for (const sample of validated) {
        const existingHands = handsByClass.get(sample.classId);
        if (existingHands !== undefined && existingHands !== sample.hands) {
          throw new SampleStoreError(
            `"${sample.label}" is recorded as a ${existingHands}-hand sign; a ${sample.hands}-hand sample cannot be added to it.`,
            "hand_count_mismatch",
          );
        }
        handsByClass.set(sample.classId, sample.hands);
        const nextCount = (countByClass.get(sample.classId) ?? 0) + 1;
        if (nextCount > MAX_SAMPLES_PER_CLASS) {
          throw new SampleStoreError(
            `"${sample.label}" already has ${MAX_SAMPLES_PER_CLASS} samples. Delete some before recording more.`,
            "class_full",
          );
        }
        countByClass.set(sample.classId, nextCount);
        bytes += sample.vector.length * BYTES_PER_NUMBER;
        if (bytes > MAX_TOTAL_SAMPLE_BYTES) {
          throw new SampleStoreError("Sample storage is full (20 MB). Delete some samples first.", "storage_full");
        }
        stamped.push({ ...sample, id: newSampleId(), createdAt: timestamp });
      }
      await this.write((backend) => backend.putMany(stamped.map(toRawRecord)));
      this.samples = [...this.samples, ...stamped];
      this.bump();
      return stamped;
    });
  }

  addSample(sample: NewSample): Promise<StoredSample> {
    return this.addSamples([sample]).then((added) => added[0]);
  }

  /** Removes one sample. Resolves to false when the id is unknown. */
  removeSample(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      if (!this.samples.some((s) => s.id === id)) return false;
      await this.write((backend) => backend.deleteMany([id]));
      this.samples = this.samples.filter((s) => s.id !== id);
      this.bump();
      return true;
    });
  }

  /** Removes every sample of a class. Resolves to the number removed. */
  removeClass(classId: string): Promise<number> {
    return this.enqueue(async () => {
      const ids = this.samples.filter((s) => s.classId === classId).map((s) => s.id);
      if (ids.length === 0) return 0;
      await this.write((backend) => backend.deleteMany(ids));
      this.samples = this.samples.filter((s) => s.classId !== classId);
      this.bump();
      return ids.length;
    });
  }

  /** Deletes every stored sample, including records that failed validation. */
  clearAll(): Promise<void> {
    return this.enqueue(async () => {
      await this.write((backend) => backend.clear());
      this.samples = [];
      this.invalidRecords = 0;
      this.bump();
    });
  }

  /** JSON text of all samples, for a local download (LOC-08). */
  async exportJson(): Promise<string> {
    await this.ready();
    const classes = summariseSamples(this.samples).map((summary) => ({
      classId: summary.classId,
      label: summary.label,
      hands: summary.hands,
      vectors: this.samples.filter((s) => s.classId === summary.classId).map((s) => Array.from(s.vector)),
    }));
    return JSON.stringify({
      format: SAMPLE_EXPORT_FORMAT,
      featureSchema: FEATURE_SCHEMA_VERSION,
      exportedAt: new Date(this.now()).toISOString(),
      classes,
    });
  }

  /**
   * Imports a file produced by `exportJson`. The whole file is validated first
   * and is applied completely or not at all. "merge" adds to what is stored;
   * "replace" deletes the current samples first.
   */
  importJson(text: string, mode: ImportMode = "merge"): Promise<ImportResult> {
    return this.enqueue(async () => {
      const classes = parseSamplesFile(text);
      const base = mode === "replace" ? [] : this.samples;
      const handsByClass = new Map<string, SampleHands>();
      const countByClass = new Map<string, number>();
      for (const s of base) {
        handsByClass.set(s.classId, s.hands);
        countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1);
      }
      const timestamp = this.now();
      const incoming: StoredSample[] = [];
      for (const cls of classes) {
        const existingHands = handsByClass.get(cls.classId);
        if (existingHands !== undefined && existingHands !== cls.hands) {
          throw new ValidationError(
            `Class "${cls.classId}" is a ${existingHands}-hand sign here but a ${cls.hands}-hand sign in the file.`,
          );
        }
        if ((countByClass.get(cls.classId) ?? 0) + cls.vectors.length > MAX_SAMPLES_PER_CLASS) {
          throw new ValidationError(
            `Importing would give class "${cls.classId}" more than ${MAX_SAMPLES_PER_CLASS} samples.`,
          );
        }
        for (const vector of cls.vectors) {
          incoming.push({
            id: newSampleId(),
            classId: cls.classId,
            label: cls.label,
            hands: cls.hands,
            vector,
            createdAt: timestamp,
          });
        }
      }
      if (estimateBytes(base) + estimateBytes(incoming) > MAX_TOTAL_SAMPLE_BYTES) {
        throw new ValidationError("Importing would exceed the 20 MB sample storage limit.");
      }
      await this.write(async (backend) => {
        if (mode === "replace") await backend.clear();
        await backend.putMany(incoming.map(toRawRecord));
      });
      this.samples = [...base, ...incoming];
      if (mode === "replace") this.invalidRecords = 0;
      this.bump();
      return { classes: classes.length, samples: incoming.length };
    });
  }

  /** Closes the database connection (call before deleting the database). */
  close(): void {
    this.backend?.close();
    this.backend = null;
    this.samples = [];
    this.invalidRecords = 0;
    this.loaded = false;
    this.loading = null;
    this.bump();
  }

  private async write(action: (backend: SampleBackend) => Promise<void>): Promise<void> {
    if (!this.backend) throw new SampleStoreError("Sample storage is not open.", "storage_failed");
    try {
      await action(this.backend);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new SampleStoreError(`The browser could not save the change (${detail}).`, "storage_failed");
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.ready()).then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private bump(): void {
    this.revision += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

export function summariseSamples(samples: readonly StoredSample[]): ClassSummary[] {
  const byClass = new Map<string, ClassSummary>();
  for (const s of samples) {
    const entry = byClass.get(s.classId);
    if (entry) {
      entry.count += 1;
      entry.label = s.label; // the most recent label wins
    } else {
      byClass.set(s.classId, { classId: s.classId, label: s.label, hands: s.hands, count: 1 });
    }
  }
  return [...byClass.values()];
}

function estimateBytes(samples: readonly { vector: Float32Array }[]): number {
  let total = 0;
  for (const s of samples) total += s.vector.length * BYTES_PER_NUMBER;
  return total;
}

/** Approximate storage used by the samples, for the "Your data" page. */
export function estimateSampleBytes(samples: readonly StoredSample[]): number {
  return estimateBytes(samples);
}

/**
 * Deletes the sample database entirely. Close every SampleStore first
 * (`store.close()`); resolves to "blocked" when another tab keeps it open.
 */
export function deleteSampleDatabase(): Promise<"deleted" | "blocked" | "unavailable"> {
  const factory: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) return Promise.resolve("unavailable");
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.deleteDatabase(SAMPLE_DB_NAME);
    } catch {
      resolve("unavailable");
      return;
    }
    request.onsuccess = () => resolve("deleted");
    request.onerror = () => resolve("unavailable");
    request.onblocked = () => resolve("blocked");
  });
}

let sharedStore: SampleStore | null = null;
/** The app-wide store (IndexedDB with memory fallback). */
export function getSampleStore(): SampleStore {
  if (!sharedStore) sharedStore = new SampleStore();
  return sharedStore;
}
