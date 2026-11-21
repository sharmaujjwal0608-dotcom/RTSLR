/**
 * Test-only builders. Vectors here are arbitrary numbers, not sign data.
 */
import type {
  FrameFeatures,
  Landmark,
  RecognitionResult,
  TrackedHand,
} from "../../../types/recognition";
import { DUAL_FEATURE_DIM, SINGLE_FEATURE_DIM } from "../../../types/recognition";

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomVector(dimension: number, seed: number): Float32Array {
  const next = rng(seed);
  const out = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) out[i] = next() * 2 - 1;
  return out;
}

/** `base` plus small noise: stands in for "the same pose again". */
export function jitter(base: Float32Array, amount: number, seed: number): Float32Array {
  const next = rng(seed);
  return base.map((v) => v + (next() * 2 - 1) * amount);
}

export function flatHand(slot: 0 | 1 = 0, landmarks?: Landmark[]): TrackedHand {
  return {
    slot,
    handedness: "Unknown",
    handednessScore: 0,
    landmarks: landmarks ?? Array.from({ length: 21 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5, z: 0 })),
    ageFrames: 10,
  };
}

export type FeatureOptions = {
  timestamp?: number;
  /** One 63-D vector per hand. */
  vectors?: Float32Array[];
  dual?: Float32Array | null;
  still?: boolean;
  hands?: TrackedHand[];
  imageWidth?: number;
  imageHeight?: number;
};

export function makeFeatures(handCount: 0 | 1 | 2, options: FeatureOptions = {}): FrameFeatures {
  const timestamp = options.timestamp ?? 0;
  const slots = ([0, 1] as const).slice(0, handCount);
  const hands = options.hands ?? slots.map((slot) => flatHand(slot));
  return {
    schema: "rtslr-features-1",
    timestamp,
    handCount,
    perHand: slots.map((slot, i) => ({
      slot,
      handedness: "Unknown",
      vector: options.vectors?.[i] ?? randomVector(SINGLE_FEATURE_DIM, 1000 + slot),
    })),
    dual: handCount === 2 ? (options.dual === undefined ? randomVector(DUAL_FEATURE_DIM, 2000) : options.dual) : null,
    motion: slots.map((slot) => ({ slot, wristPath: 0, wristSpeed: 0, isStill: options.still ?? true })),
    frame: {
      timestamp,
      imageWidth: options.imageWidth ?? 480,
      imageHeight: options.imageHeight ?? 480,
      hands,
    },
  };
}

export function recognized(classId: string, timestamp: number, score = 0.9): RecognitionResult {
  return {
    modelId: "test-model",
    modelVersion: "0",
    signLanguage: "ISL",
    classId,
    label: classId.toUpperCase(),
    status: "recognized",
    score,
    scoreType: "classifier_score",
    timestamp,
    handsUsed: 1,
    candidates: [{ classId, label: classId.toUpperCase(), score }],
  };
}

export function notRecognized(
  status: "uncertain" | "unsupported" | "no_hands",
  timestamp: number,
): RecognitionResult {
  return {
    modelId: "test-model",
    modelVersion: "0",
    signLanguage: "ISL",
    classId: null,
    label: null,
    status,
    score: status === "uncertain" ? 0.2 : null,
    scoreType: status === "uncertain" ? "classifier_score" : null,
    timestamp,
    handsUsed: 0,
    candidates: [],
    reason: status === "no_hands" ? undefined : "test",
  };
}

/* ------------------------------------------------------------------ */
/* Synthetic hand poses for the legacy ASL rules                        */
/* ------------------------------------------------------------------ */

type FingerPose = "up" | "side" | "down" | "hook" | "curled";
type ThumbPose = "out" | "side" | "tucked" | "down";

/**
 * A schematic upright hand in image coordinates (wrist at the bottom), after
 * the prototype's own synthetic hand. It is a geometric test input for the
 * rules, not a depiction of how any sign is formed.
 */
export function schematicHand(
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose],
  thumb: ThumbPose,
  spread: [number, number, number, number] = [0, 0, 0, 0.03],
  center = { x: 0.5, y: 0.8 },
): Landmark[] {
  const { x: cx, y: cy } = center;
  const lm: Landmark[] = new Array<Landmark>(21);
  lm[0] = { x: cx, y: cy, z: 0 };
  lm[1] = { x: cx - 0.08, y: cy - 0.08, z: -0.02 };
  lm[2] = { x: cx - 0.13, y: cy - 0.17, z: -0.03 };
  lm[5] = { x: cx - 0.07, y: cy - 0.26, z: 0 };
  lm[9] = { x: cx, y: cy - 0.28, z: 0 };
  lm[13] = { x: cx + 0.07, y: cy - 0.26, z: 0 };
  lm[17] = { x: cx + 0.13, y: cy - 0.22, z: 0 };

  const setFinger = (mcpIndex: number, dx: number, pose: FingerPose) => {
    const mcp = lm[mcpIndex];
    const offsets: Record<FingerPose, [number, number][]> = {
      up: [
        [dx * 0.35, -0.11],
        [dx * 0.68, -0.21],
        [dx, -0.3],
      ],
      side: [
        [-0.09, -0.01],
        [-0.17, -0.01],
        [-0.24, -0.01],
      ],
      down: [
        [dx * 0.3, 0.09],
        [dx * 0.6, 0.17],
        [dx * 0.9, 0.24],
      ],
      hook: [
        [0, -0.09],
        [0, -0.12],
        [0, -0.06],
      ],
      curled: [
        [0, -0.04],
        [0, 0.05],
        [0, 0.09],
      ],
    };
    offsets[pose].forEach(([ox, oy], i) => {
      lm[mcpIndex + 1 + i] = { x: mcp.x + ox, y: mcp.y + oy, z: -0.02 };
    });
  };
  setFinger(5, spread[0], fingers[0]);
  setFinger(9, spread[1], fingers[1]);
  setFinger(13, spread[2], fingers[2]);
  setFinger(17, spread[3], fingers[3]);

  const thumbs: Record<ThumbPose, [[number, number], [number, number]]> = {
    out: [
      [-0.2, -0.21],
      [-0.27, -0.24],
    ],
    side: [
      [-0.12, -0.26],
      [-0.11, -0.33],
    ],
    tucked: [
      [-0.05, -0.2],
      [0.02, -0.19],
    ],
    down: [
      [-0.11, -0.12],
      [-0.12, -0.05],
    ],
  };
  lm[3] = { x: cx + thumbs[thumb][0][0], y: cy + thumbs[thumb][0][1], z: -0.04 };
  lm[4] = { x: cx + thumbs[thumb][1][0], y: cy + thumbs[thumb][1][1], z: -0.05 };
  return lm;
}
