/**
 * RecognitionController: the non-React core behind `useRecognition`.
 *
 * It receives every FrameFeatures at camera rate, runs the selected model and
 * the stabiliser, and publishes an immutable snapshot at most ~10 times a
 * second (immediately for commits and phase changes). It also drives sample
 * recording for the experimental ISL model.
 *
 * Keeping this outside React means the per-frame path allocates no React
 * state and the logic can be tested with plain function calls.
 */

import type {
  CommitEvent,
  FrameFeatures,
  ModelInfo,
  SignModel,
  StabilizedState,
} from "../../types/recognition";
import { ModelLoadError } from "./models/exportedModel";
import { createModel as createRegisteredModel } from "./registry";
import {
  MAX_SAMPLES_PER_CLASS,
  SampleStoreError,
  getSampleStore,
  type NewSample,
  type SampleHands,
  type SampleStore,
} from "./sampleStore";
import { FORBIDDEN_KEYS, MAX_LABEL_LENGTH } from "./safeJson";
import { IDLE_STATE, Stabilizer, type StabilizerConfig } from "./stabilizer";
import { isFiniteVector } from "./vectorMath";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type FrameSubscribe = (callback: (features: FrameFeatures) => void) => () => void;

export type RecognitionSettings = {
  /** Results scoring below this are treated as uncertain. 0..1, default 0.75. */
  minScore?: number;
  /** Hold-to-append time in seconds. 0.5–2.5, default 1.2. */
  holdSeconds?: number;
  /** Pause after a commit, in seconds. Default 1. */
  cooldownSeconds?: number;
  /** true: a held pose commits again after every cooldown. Default false. */
  repeatWhileHeld?: boolean;
};

/**
 * - loading: the model is being loaded.
 * - ready: frames are being classified by the requested model.
 * - unavailable: the requested model does not exist (today: the validated ISL model). Not an error.
 * - error: the model exists but could not be loaded or is invalid.
 */
export type ModelLoadStatus = "loading" | "ready" | "unavailable" | "error";

export type RecordingStatus = "idle" | "waiting" | "capturing" | "saving" | "done" | "cancelled" | "error";

/** Why recording is waiting; map these to interface text. */
export type RecordingHint = "no_hands" | "hold_still" | "show_one_hand" | "show_two_hands" | null;

export type RecordingErrorCode =
  | "invalid_label"
  | "invalid_count"
  | "busy"
  | SampleStoreError["code"];

export type RecordingState = {
  status: RecordingStatus;
  classId: string | null;
  label: string | null;
  /** Hand count of the sign being recorded; null until the first capture of a new class. */
  hands: SampleHands | null;
  captured: number;
  target: number;
  /** captured / target, 0..1. */
  progress: number;
  hint: RecordingHint;
  errorCode: RecordingErrorCode | null;
  /** English detail for `errorCode`. */
  errorMessage: string | null;
};

export type RecognitionSnapshot = {
  state: StabilizedState;
  /** The model id that was asked for. */
  requestedModelId: string | null;
  /** The model currently classifying frames. Differs from the requested one when its load failed. */
  activeModelId: string | null;
  modelStatus: ModelLoadStatus;
  /** Plain-language reason when modelStatus is "unavailable" or "error". */
  modelMessage: string | null;
  /** Description of the active model, including its live class list. */
  modelInfo: ModelInfo | null;
  recording: RecordingState;
};

export type RecognitionControllerOptions = {
  store?: SampleStore;
  /** Model factory; defaults to the registry. Injected in tests. */
  createModel?: (modelId: string) => SignModel;
  /** Minimum time between published snapshots. Default 100 ms (~10 Hz). */
  publishIntervalMs?: number;
  /** Minimum time between two captured samples. Default 80 ms. */
  captureIntervalMs?: number;
};

const IDLE_RECORDING: RecordingState = {
  status: "idle",
  classId: null,
  label: null,
  hands: null,
  captured: 0,
  target: 0,
  progress: 0,
  hint: null,
  errorCode: null,
  errorMessage: null,
};

export const INITIAL_RECOGNITION_SNAPSHOT: RecognitionSnapshot = {
  state: IDLE_STATE,
  requestedModelId: null,
  activeModelId: null,
  modelStatus: "loading",
  modelMessage: null,
  modelInfo: null,
  recording: IDLE_RECORDING,
};

function toStabilizerConfig(settings: RecognitionSettings): Partial<StabilizerConfig> {
  const config: Partial<StabilizerConfig> = {};
  if (settings.minScore !== undefined) config.minScore = settings.minScore;
  if (settings.holdSeconds !== undefined) config.holdMs = settings.holdSeconds * 1000;
  if (settings.cooldownSeconds !== undefined) config.cooldownMs = settings.cooldownSeconds * 1000;
  if (settings.repeatWhileHeld !== undefined) config.repeatWhileHeld = settings.repeatWhileHeld;
  return config;
}

type ActiveRecording = {
  classId: string;
  label: string;
  target: number;
  hands: SampleHands | null;
  vectors: Float32Array[];
  lastCaptureAt: number;
};

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export class RecognitionController {
  private readonly store: SampleStore;
  private readonly makeModel: (modelId: string) => SignModel;
  private readonly publishIntervalMs: number;
  private readonly captureIntervalMs: number;
  private readonly stabilizer = new Stabilizer();
  private readonly listeners = new Set<() => void>();

  private snapshot: RecognitionSnapshot = INITIAL_RECOGNITION_SNAPSHOT;
  private model: SignModel | null = null;
  private loadToken = 0;
  private lastPublishAt = -Infinity;
  private pendingState: StabilizedState | null = null;
  private recordingJob: ActiveRecording | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private disposed = false;

  /** Called once for each committed sign. */
  onCommit: ((event: CommitEvent) => void) | null = null;

  /** Same as assigning `onCommit`; convenient from React effects. */
  setCommitHandler(handler: ((event: CommitEvent) => void) | null): void {
    this.onCommit = handler;
  }

  constructor(options: RecognitionControllerOptions = {}) {
    this.store = options.store ?? getSampleStore();
    const store = this.store;
    this.makeModel = options.createModel ?? ((id) => createRegisteredModel(id, { store }));
    this.publishIntervalMs = options.publishIntervalMs ?? 100;
    this.captureIntervalMs = options.captureIntervalMs ?? 80;
  }

  /* ---------------- external-store interface ---------------- */

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.unsubscribeStore) {
      // The experimental ISL model's class list changes when samples change.
      this.unsubscribeStore = this.store.subscribe(() => this.refreshModelInfo());
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.unsubscribeStore) {
        this.unsubscribeStore();
        this.unsubscribeStore = null;
      }
    };
  };

  readonly getSnapshot = (): RecognitionSnapshot => this.snapshot;

  private publish(patch: Partial<RecognitionSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  private refreshModelInfo(): void {
    const info = this.model?.info ?? null;
    if (info !== this.snapshot.modelInfo) this.publish({ modelInfo: info });
  }

  /* ---------------- model lifecycle ---------------- */

  /**
   * Selects a model. If loading fails, the previously active model keeps
   * running (MOD-12) and the snapshot says why the requested one is not in use.
   */
  async setModel(modelId: string): Promise<void> {
    if (this.snapshot.requestedModelId === modelId && this.snapshot.modelStatus !== "error") return;
    const token = ++this.loadToken;
    this.publish({ requestedModelId: modelId, modelStatus: "loading", modelMessage: null });

    let candidate: SignModel;
    try {
      candidate = this.makeModel(modelId);
      await candidate.load();
    } catch (error) {
      if (token !== this.loadToken || this.disposed) return;
      const unavailable = error instanceof ModelLoadError && error.code === "not_found";
      this.publish({
        modelStatus: unavailable ? "unavailable" : "error",
        modelMessage: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (token !== this.loadToken || this.disposed) {
      candidate.dispose();
      return;
    }
    this.model?.dispose();
    this.model = candidate;
    this.stabilizer.reset();
    this.pendingState = null;
    this.publish({
      activeModelId: modelId,
      modelStatus: "ready",
      modelMessage: null,
      modelInfo: candidate.info,
      state: IDLE_STATE,
    });
  }

  setSettings(settings: RecognitionSettings): void {
    this.stabilizer.setConfig(toStabilizerConfig(settings));
  }

  /** Clears temporal state (call when the camera stops). */
  reset(): void {
    this.model?.reset();
    this.stabilizer.reset();
    this.pendingState = null;
    this.publish({ state: IDLE_STATE });
  }

  dispose(): void {
    this.cancelRecording();
    this.disposed = true;
    this.loadToken += 1;
    this.model?.dispose();
    this.model = null;
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.listeners.clear();
  }

  /* ---------------- per-frame path ---------------- */

  readonly handleFrame = (features: FrameFeatures): void => {
    if (this.disposed) return;
    this.captureForRecording(features);

    const model = this.model;
    if (!model) return;
    const result = model.predict(features);
    const { state, commit } = this.stabilizer.update(result, features.timestamp);

    const previous = this.pendingState ?? this.snapshot.state;
    this.pendingState = state;
    const due = features.timestamp - this.lastPublishAt >= this.publishIntervalMs;
    const changed = state.phase !== previous.phase || state.classId !== previous.classId;
    if (commit || due || changed) {
      this.lastPublishAt = features.timestamp;
      this.pendingState = null;
      const info = model.info;
      this.publish(info === this.snapshot.modelInfo ? { state } : { state, modelInfo: info });
    }
    if (commit) this.onCommit?.(commit);
  };

  /* ---------------- sample recording ---------------- */

  private setRecording(patch: Partial<RecordingState>): void {
    const recording = { ...this.snapshot.recording, ...patch };
    recording.progress = recording.target > 0 ? Math.min(1, recording.captured / recording.target) : 0;
    this.publish({ recording });
  }

  private failRecording(errorCode: RecordingErrorCode, errorMessage: string): void {
    this.recordingJob = null;
    this.setRecording({ status: "error", hint: null, errorCode, errorMessage });
  }

  /**
   * Starts capturing `count` samples for a class from live frames. A sample is
   * taken only while every tracked hand is steady. The hand count is fixed by
   * the class if it already exists, otherwise by the first steady frame: one
   * hand records 63-D vectors, two hands record the 156-D coordinated vector.
   * Nothing is stored until all samples are captured; cancelling discards them.
   */
  startRecording(classId: string, label: string, count: number): void {
    if (this.recordingJob || this.snapshot.recording.status === "saving") {
      // Keep the running job; just tell the caller.
      this.setRecording({ errorCode: "busy", errorMessage: "A recording is already in progress." });
      return;
    }
    const cleanId = typeof classId === "string" ? classId.trim() : "";
    const cleanLabel = typeof label === "string" ? label.trim() : "";
    const base: RecordingState = { ...IDLE_RECORDING, classId: cleanId || null, label: cleanLabel || null };
    const badText = (text: string) => text.length === 0 || text.length > MAX_LABEL_LENGTH || FORBIDDEN_KEYS.has(text);
    if (badText(cleanId) || badText(cleanLabel)) {
      this.publish({
        recording: {
          ...base,
          status: "error",
          errorCode: "invalid_label",
          errorMessage: `A sign needs an id and a name of 1 to ${MAX_LABEL_LENGTH} characters.`,
        },
      });
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLES_PER_CLASS) {
      this.publish({
        recording: {
          ...base,
          status: "error",
          errorCode: "invalid_count",
          errorMessage: `The number of samples must be between 1 and ${MAX_SAMPLES_PER_CLASS}.`,
        },
      });
      return;
    }

    const job: ActiveRecording = {
      classId: cleanId,
      label: cleanLabel,
      target: count,
      hands: null,
      vectors: [],
      lastCaptureAt: -Infinity,
    };
    this.recordingJob = job;
    this.publish({ recording: { ...base, status: "waiting", target: count } });

    // An existing class fixes the hand count; look it up without blocking capture.
    void this.store.ready().then(() => {
      if (this.recordingJob !== job) return;
      const existing = this.store.getSnapshot().find((s) => s.classId === job.classId);
      if (!existing) return;
      if (job.hands !== null && job.hands !== existing.hands) {
        this.failRecording(
          "hand_count_mismatch",
          `"${job.label}" is recorded as a ${existing.hands}-hand sign; it cannot also be recorded with ${job.hands}.`,
        );
        return;
      }
      job.hands = existing.hands;
      this.setRecording({ hands: existing.hands });
    });
  }

  /** Stops the current recording and discards what was captured. */
  cancelRecording(): void {
    if (!this.recordingJob) return;
    this.recordingJob = null;
    this.setRecording({ status: "cancelled", hint: null });
  }

  /** Returns the recording panel to idle after done / cancelled / error. */
  clearRecordingStatus(): void {
    if (this.recordingJob || this.snapshot.recording.status === "saving") return;
    this.publish({ recording: IDLE_RECORDING });
  }

  private captureForRecording(features: FrameFeatures): void {
    const job = this.recordingJob;
    if (!job) return;

    const wait = (hint: RecordingHint) => {
      const current = this.snapshot.recording;
      if (current.status !== "waiting" || current.hint !== hint) this.setRecording({ status: "waiting", hint });
    };

    if (features.handCount === 0) return wait("no_hands");
    if (job.hands !== null && features.handCount !== job.hands) {
      return wait(job.hands === 1 ? "show_one_hand" : "show_two_hands");
    }
    const steady =
      features.motion.length >= features.handCount && features.motion.every((motion) => motion.isStill);
    if (!steady) return wait("hold_still");
    if (features.timestamp - job.lastCaptureAt < this.captureIntervalMs) return;

    const hands: SampleHands = features.handCount;
    const source = hands === 2 ? features.dual : (features.perHand[0]?.vector ?? null);
    const dimension = hands === 2 ? 156 : 63;
    if (!source || !isFiniteVector(source, dimension)) return wait("hold_still");

    job.hands = hands;
    job.vectors.push(Float32Array.from(source));
    job.lastCaptureAt = features.timestamp;
    this.setRecording({
      status: "capturing",
      hands,
      captured: job.vectors.length,
      hint: null,
      errorCode: null,
      errorMessage: null,
    });

    if (job.vectors.length >= job.target) void this.saveRecording(job, hands);
  }

  private async saveRecording(job: ActiveRecording, hands: SampleHands): Promise<void> {
    this.recordingJob = null;
    this.setRecording({ status: "saving" });
    const samples: NewSample[] = job.vectors.map((vector) => ({
      classId: job.classId,
      label: job.label,
      hands,
      vector,
    }));
    try {
      await this.store.addSamples(samples);
      this.setRecording({ status: "done" });
    } catch (error) {
      const code: RecordingErrorCode = error instanceof SampleStoreError ? error.code : "storage_failed";
      this.failRecording(code, error instanceof Error ? error.message : String(error));
    }
  }
}
