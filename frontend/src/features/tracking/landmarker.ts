/**
 * Lazy singleton loader for the MediaPipe HandLandmarker
 * (`@mediapipe/tasks-vision` 1.2.3).
 *
 * - The library is imported dynamically, so it is not in the initial bundle.
 * - The wasm runtime is served from the same origin (`/mediapipe/wasm`,
 *   copied there by `scripts/copy-mediapipe.mjs`).
 * - The model file comes from NEXT_PUBLIC_HAND_MODEL_URL. Without it the
 *   Google-hosted float16 model is fetched once; that is the only third-party
 *   request this module can make.
 * - GPU delegate first, CPU if GPU creation fails or was reported unreliable.
 */
import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Handedness, Landmark } from "@/types/recognition";
import type { RawHandDetection, TrackingError } from "./types";

export const DEFAULT_HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";

export function getHandModelUrl(): string {
  return process.env.NEXT_PUBLIC_HAND_MODEL_URL || DEFAULT_HAND_MODEL_URL;
}

export type LandmarkerDelegate = "GPU" | "CPU";

export type LandmarkerLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  delegate: LandmarkerDelegate | null;
  error: TrackingError | null;
};

let loadState: LandmarkerLoadState = { status: "idle", delegate: null, error: null };
let instance: HandLandmarker | null = null;
let loading: Promise<HandLandmarker> | null = null;
let generation = 0;
let preferCpu = false;
const listeners = new Set<(state: LandmarkerLoadState) => void>();

function setLoadState(next: LandmarkerLoadState): void {
  loadState = next;
  for (const listener of listeners) listener(next);
}

export function getLandmarkerLoadState(): LandmarkerLoadState {
  return loadState;
}

export function subscribeLandmarkerLoadState(listener: (state: LandmarkerLoadState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "unknown error";
}

async function create(gen: number): Promise<HandLandmarker> {
  let stage = "the MediaPipe library";
  try {
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    stage = `the wasm runtime at ${MEDIAPIPE_WASM_PATH}`;
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

    const build = (delegate: LandmarkerDelegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: getHandModelUrl(), delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

    stage = "the hand model";
    let delegate: LandmarkerDelegate = preferCpu ? "CPU" : "GPU";
    let landmarker: HandLandmarker;
    try {
      landmarker = await build(delegate);
    } catch (gpuError) {
      if (delegate === "CPU") throw gpuError;
      delegate = "CPU";
      landmarker = await build("CPU");
    }

    if (gen !== generation) {
      // Disposed while loading.
      landmarker.close();
      throw new Error("hand landmarker was disposed while loading");
    }
    instance = landmarker;
    setLoadState({ status: "ready", delegate, error: null });
    return landmarker;
  } catch (err) {
    if (gen === generation) {
      loading = null;
      setLoadState({
        status: "error",
        delegate: null,
        error: {
          code: "model_load_failed",
          message: `Could not load ${stage}: ${describeError(err)}`,
          cause: err instanceof Error ? err.name : undefined,
        },
      });
    }
    throw new Error(`Hand tracking could not be loaded (${stage}): ${describeError(err)}`, { cause: err });
  }
}

/**
 * Loads the landmarker once and returns the shared instance. Concurrent calls
 * share one load. After a failure the next call tries again.
 */
export function loadHandLandmarker(): Promise<HandLandmarker> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    setLoadState({ status: "loading", delegate: null, error: null });
    loading = create(generation);
  }
  return loading;
}

/** Frees the model. The next `loadHandLandmarker()` creates a new one. */
export function disposeHandLandmarker(): void {
  generation++;
  loading = null;
  if (instance) {
    try {
      instance.close();
    } catch {
      // Already closed.
    }
    instance = null;
  }
  setLoadState({ status: "idle", delegate: null, error: null });
}

/**
 * Call when `detectForVideo` threw. Disposes the instance; if it was running
 * on the GPU delegate, the next load uses CPU.
 */
export function reportLandmarkerFailure(): void {
  if (loadState.delegate === "GPU") preferCpu = true;
  disposeHandLandmarker();
}

function toHandedness(name: string | undefined): Handedness {
  return name === "Left" || name === "Right" ? name : "Unknown";
}

/** Converts a MediaPipe result to plain detections (numbers only). */
export function toDetections(result: HandLandmarkerResult): RawHandDetection[] {
  const out: RawHandDetection[] = [];
  const hands = result.landmarks ?? [];
  for (let i = 0; i < hands.length; i++) {
    const category = result.handedness?.[i]?.[0];
    const landmarks: Landmark[] = hands[i].map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
    out.push({
      landmarks,
      handedness: toHandedness(category?.categoryName),
      handednessScore: category?.score ?? 0,
    });
  }
  return out;
}

/**
 * Runs detection on the current video frame.
 * @param timestampMs must increase strictly from call to call.
 */
export function detectHands(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): RawHandDetection[] {
  return toDetections(landmarker.detectForVideo(video, timestampMs));
}
