/**
 * Feature extraction, schema `rtslr-features-1`.
 *
 * Implements docs/MODEL_CONTRACTS.md sections 1-3 exactly. The Python
 * pipeline is checked against `__fixtures__/feature-parity.json`, which is
 * generated from this file. All arithmetic is done in float64 and stored as
 * float32.
 */
import {
  DUAL_FEATURE_DIM,
  FEATURE_SCHEMA_VERSION,
  LANDMARKS_PER_HAND,
  SINGLE_FEATURE_DIM,
  type FrameFeatures,
  type HandFrame,
  type HandMotion,
  type Handedness,
  type Landmark,
  type TrackedHand,
} from "@/types/recognition";

export type Vec3 = { x: number; y: number; z: number };

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;
/** Lower bound of the palm length, in aspect-corrected units. */
export const MIN_PALM_LENGTH = 1e-4;

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Section 1: x' = x * (w / h), y' = y, z' = z * (w / h). */
export function aspectCorrect(
  landmarks: readonly Landmark[],
  imageWidth: number,
  imageHeight: number,
): Vec3[] {
  const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  return landmarks.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norm(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** `max(|p9 - p0|, 1e-4)` for aspect-corrected points. */
export function palmLength(points: readonly Vec3[]): number {
  return Math.max(norm(sub(points[9], points[0])), MIN_PALM_LENGTH);
}

/**
 * `normalize(cross(p5 - p0, p17 - p0))` for aspect-corrected points.
 * A degenerate hand (zero cross product) yields the zero vector, which makes
 * the palm-normal cosine 0.
 */
export function palmNormal(points: readonly Vec3[]): Vec3 {
  const a = sub(points[5], points[0]);
  const b = sub(points[17], points[0]);
  const c = {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
  const n = norm(c);
  if (!(n > 1e-12)) return { x: 0, y: 0, z: 0 };
  return { x: c.x / n, y: c.y / n, z: c.z / n };
}

export type PalmFacing = "camera" | "away" | "edge_on" | "unknown";
export type PointingDirection = "up" | "down" | "sideways";

export type HandOrientation = {
  /** Which way the palm faces. Needs a Left/Right label; "unknown" without one. */
  palmFacing: PalmFacing;
  /** Direction wrist -> middle-finger base in the image plane. */
  pointing: PointingDirection;
  normal: Vec3;
  /** Unit vector wrist -> middle-finger base (aspect-corrected). */
  direction: Vec3;
};

/**
 * Rough orientation estimate. Heuristic, not part of the feature schema.
 *
 * The palm normal's z sign is read together with the handedness label
 * (smaller z is closer to the camera): for a subject's right hand the normal
 * points toward the camera when the palm does, for a left hand it is the
 * reverse. A wrong handedness label therefore flips camera/away.
 */
export function estimateHandOrientation(
  landmarks: readonly Landmark[],
  imageWidth: number,
  imageHeight: number,
  handedness: Handedness = "Unknown",
): HandOrientation {
  const pts = aspectCorrect(landmarks, imageWidth, imageHeight);
  const normal = palmNormal(pts);
  const d = sub(pts[9], pts[0]);
  const len = norm(d);
  const direction = len > 1e-12 ? { x: d.x / len, y: d.y / len, z: d.z / len } : { x: 0, y: 0, z: 0 };

  let pointing: PointingDirection = "sideways";
  if (Math.abs(direction.y) >= Math.abs(direction.x)) pointing = direction.y <= 0 ? "up" : "down";

  let palmFacing: PalmFacing = "unknown";
  if (handedness !== "Unknown") {
    if (Math.abs(normal.z) < 0.35) palmFacing = "edge_on";
    else {
      const towardCamera = handedness === "Right" ? normal.z < 0 : normal.z > 0;
      palmFacing = towardCamera ? "camera" : "away";
    }
  }
  return { palmFacing, pointing, normal, direction };
}

/* ------------------------------------------------------------------ */
/* Vectors                                                             */
/* ------------------------------------------------------------------ */

function assertHand(landmarks: readonly Landmark[]): void {
  if (landmarks.length !== LANDMARKS_PER_HAND) {
    throw new RangeError(`expected ${LANDMARKS_PER_HAND} landmarks, got ${landmarks.length}`);
  }
}

function writeSingle(points: readonly Vec3[], out: Float32Array, offset: number): number {
  const palm = palmLength(points);
  const w = points[0];
  for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
    out[offset + i * 3] = (points[i].x - w.x) / palm;
    out[offset + i * 3 + 1] = (points[i].y - w.y) / palm;
    out[offset + i * 3 + 2] = (points[i].z - w.z) / palm;
  }
  return palm;
}

/** Section 2: the 63-D single-hand vector. */
export function singleHandVector(
  landmarks: readonly Landmark[],
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  assertHand(landmarks);
  const out = new Float32Array(SINGLE_FEATURE_DIM);
  writeSingle(aspectCorrect(landmarks, imageWidth, imageHeight), out, 0);
  return out;
}

/**
 * Section 3 ordering: A is the hand whose wrist has the smaller unmirrored x.
 * On an exact tie the first argument is A.
 */
export function orderHandsAB<T extends { landmarks: readonly Landmark[] }>(
  first: T,
  second: T,
): { a: T; b: T } {
  return second.landmarks[0].x < first.landmarks[0].x
    ? { a: second, b: first }
    : { a: first, b: second };
}

/**
 * Section 3 layout for hands already ordered as A and B. Most callers want
 * `dualHandVector`, which orders them first.
 */
export function dualHandVectorOrdered(
  a: readonly Landmark[],
  b: readonly Landmark[],
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  assertHand(a);
  assertHand(b);
  const pa = aspectCorrect(a, imageWidth, imageHeight);
  const pb = aspectCorrect(b, imageWidth, imageHeight);
  const out = new Float32Array(DUAL_FEATURE_DIM);
  const palmA = writeSingle(pa, out, 0);
  const palmB = writeSingle(pb, out, SINGLE_FEATURE_DIM);
  const s = (palmA + palmB) / 2;

  const rel = sub(pb[0], pa[0]);
  out[126] = rel.x / s;
  out[127] = rel.y / s;
  out[128] = rel.z / s;
  out[129] = norm(rel) / s;

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      out[130 + i * 5 + j] = norm(sub(pa[FINGERTIP_INDICES[i]], pb[FINGERTIP_INDICES[j]])) / s;
    }
  }

  const na = palmNormal(pa);
  const nb = palmNormal(pb);
  out[155] = na.x * nb.x + na.y * nb.y + na.z * nb.z;
  return out;
}

/** Section 3: the 156-D coordinated vector for two hands given in any order. */
export function dualHandVector(
  first: readonly Landmark[],
  second: readonly Landmark[],
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  const { a, b } = orderHandsAB({ landmarks: first }, { landmarks: second });
  return dualHandVectorOrdered(a.landmarks, b.landmarks, imageWidth, imageHeight);
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

export type MotionOptions = {
  /** Length of the wrist trajectory window in milliseconds. */
  windowMs: number;
  /** The window must span at least this long before a hand can be "still". */
  minStillMs: number;
  /** Mean wrist speed (palm lengths per second) below which a hand is still. */
  stillSpeed: number;
};

/** Untuned defaults (see README, known limitations). */
export const DEFAULT_MOTION: MotionOptions = { windowMs: 500, minStillMs: 250, stillSpeed: 0.5 };

type WristSample = { t: number; x: number; y: number; z: number; palm: number };

/** Mutable per-slot wrist trajectory buffer used by `extractFrameFeatures`. */
export type MotionHistory = {
  options: MotionOptions;
  slots: [WristSample[], WristSample[]];
  lastAge: [number, number];
};

export function createMotionHistory(options: Partial<MotionOptions> = {}): MotionHistory {
  return { options: { ...DEFAULT_MOTION, ...options }, slots: [[], []], lastAge: [0, 0] };
}

export function resetMotionHistory(history: MotionHistory, slot?: 0 | 1): void {
  for (const s of slot === undefined ? ([0, 1] as const) : [slot]) {
    history.slots[s] = [];
    history.lastAge[s] = 0;
  }
}

function updateMotion(
  history: MotionHistory,
  hand: TrackedHand,
  points: readonly Vec3[],
  timestamp: number,
): HandMotion {
  const { windowMs, minStillMs, stillSpeed } = history.options;
  let samples = history.slots[hand.slot];
  const last = samples[samples.length - 1];
  // A slot whose age did not grow, or whose clock went backwards, holds a new hand.
  if (hand.ageFrames <= history.lastAge[hand.slot] || (last && timestamp <= last.t)) samples = [];
  history.lastAge[hand.slot] = hand.ageFrames;

  samples.push({ t: timestamp, x: points[0].x, y: points[0].y, z: points[0].z, palm: palmLength(points) });
  while (samples.length > 1 && timestamp - samples[0].t > windowMs) samples.shift();
  history.slots[hand.slot] = samples;

  let path = 0;
  let palmSum = 0;
  for (let i = 0; i < samples.length; i++) {
    palmSum += samples[i].palm;
    if (i > 0) {
      path += Math.hypot(
        samples[i].x - samples[i - 1].x,
        samples[i].y - samples[i - 1].y,
        samples[i].z - samples[i - 1].z,
      );
    }
  }
  const meanPalm = palmSum / samples.length;
  const spanMs = samples[samples.length - 1].t - samples[0].t;
  const wristPath = path / meanPalm;
  const wristSpeed = spanMs > 0 ? wristPath / (spanMs / 1000) : 0;
  return {
    slot: hand.slot,
    wristPath,
    wristSpeed,
    isStill: spanMs >= minStillMs && wristSpeed < stillSpeed,
  };
}

/* ------------------------------------------------------------------ */
/* Frame features                                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds the `FrameFeatures` for one frame.
 *
 * @param frame hands ordered by slot, landmarks unmirrored.
 * @param history wrist trajectory buffer; it is updated in place. Without it
 *   every hand reports zero motion and `isStill: false`.
 */
export function extractFrameFeatures(frame: HandFrame, history?: MotionHistory): FrameFeatures {
  const hands = frame.hands.slice(0, 2);
  const perHand: FrameFeatures["perHand"] = [];
  const motion: HandMotion[] = [];

  for (const hand of hands) {
    assertHand(hand.landmarks);
    const points = aspectCorrect(hand.landmarks, frame.imageWidth, frame.imageHeight);
    const vector = new Float32Array(SINGLE_FEATURE_DIM);
    writeSingle(points, vector, 0);
    perHand.push({ slot: hand.slot, handedness: hand.handedness, vector });
    motion.push(
      history
        ? updateMotion(history, hand, points, frame.timestamp)
        : { slot: hand.slot, wristPath: 0, wristSpeed: 0, isStill: false },
    );
  }

  const dual =
    hands.length === 2
      ? dualHandVector(hands[0].landmarks, hands[1].landmarks, frame.imageWidth, frame.imageHeight)
      : null;

  return {
    schema: FEATURE_SCHEMA_VERSION,
    timestamp: frame.timestamp,
    handCount: hands.length as 0 | 1 | 2,
    perHand,
    dual,
    motion,
    frame,
  };
}
