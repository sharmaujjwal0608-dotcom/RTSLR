/**
 * Legacy ASL A–Z prototype.
 *
 * A port of the hand-tuned geometric rules from the original single-file demo
 * ("basic version.html": fingerMetrics, detectMotionTrail, classifyGeometricASL).
 * It is ASL fingerspelling, NOT Indian Sign Language, and it has never been
 * evaluated on any dataset. Scores are sums of rule weights, not probabilities.
 *
 * Differences from the original, all deliberate:
 *  - x is multiplied by imageWidth / imageHeight before any geometry
 *    (docs/MODEL_CONTRACTS.md §1). The original measured distances in
 *    anisotropic image units, so its hand-tuned thresholds were implicitly
 *    fitted to one camera aspect ratio.
 *  - It classifies one hand only. The original ran the same one-hand rules on
 *    each hand and called that "dual hand"; that is not two-hand recognition.
 *  - The motion trail is cleared when the hand is lost or replaced.
 */

import type {
  FrameFeatures,
  Landmark,
  ModelInfo,
  RecognitionCandidate,
  RecognitionResult,
  SignClass,
  SignModel,
  TrackedHand,
} from "../../../types/recognition";
import { LANDMARKS_PER_HAND } from "../../../types/recognition";
import { REASONS } from "../reasons";

export const LEGACY_ASL_MODEL_ID = "rtslr-legacy-asl-rules";
export const LEGACY_ASL_MODEL_VERSION = "1.0.0";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Letters whose ASL form needs movement; the trail heuristics for them are weak. */
export const LEGACY_ASL_MOTION_LETTERS: readonly string[] = ["J", "Z"];

const PINKY_TRAIL_LENGTH = 16;
const INDEX_TRAIL_LENGTH = 18;
/** A gap this long between frames means the trail no longer describes one movement. */
const TRAIL_MAX_GAP_MS = 500;

type Point = { x: number; y: number };

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function distance2d(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Undo image anisotropy so that x and y share one unit (image heights). */
export function toIsotropic(landmarks: readonly Landmark[], imageWidth: number, imageHeight: number): Landmark[] {
  const aspect = imageHeight > 0 && imageWidth > 0 ? imageWidth / imageHeight : 1;
  return landmarks.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));
}

export type FingerState = {
  /** Tip far from the wrist and the finger close to a straight line. */
  extended: boolean;
  /** Tip pulled back towards the palm. */
  curled: boolean;
  /** Partly raised but bent. */
  hooked: boolean;
  /** Tip clearly below its knuckle in the image. */
  pointingDown: boolean;
  /** Finger runs more horizontally than vertically. */
  sideways: boolean;
};

export function fingerState(
  lm: readonly Landmark[],
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number,
): FingerState {
  const wrist = lm[0];
  const mcp = lm[mcpIndex];
  const pip = lm[pipIndex];
  const dip = lm[dipIndex];
  const tip = lm[tipIndex];

  const tipToWrist = distance2d(wrist, tip);
  const pipToWrist = distance2d(wrist, pip);
  const mcpToWrist = Math.max(distance2d(wrist, mcp), 1e-4);
  const extensionRatio = tipToWrist / mcpToWrist;
  const chainLength = distance2d(mcp, pip) + distance2d(pip, dip) + distance2d(dip, tip);
  const straightness = distance2d(mcp, tip) / Math.max(chainLength, 1e-4);

  return {
    extended: extensionRatio > 1.36 && straightness > 0.83 && tipToWrist > pipToWrist * 1.05,
    curled: extensionRatio < 1.18 || tipToWrist < pipToWrist * 1.02,
    hooked: extensionRatio >= 1.15 && extensionRatio <= 1.38 && straightness < 0.8,
    pointingDown: tip.y > mcp.y + 0.04,
    sideways: Math.abs(tip.x - mcp.x) > Math.abs(tip.y - mcp.y) * 1.15,
  };
}

/* ------------------------------------------------------------------ */
/* Motion trail (J and Z)                                              */
/* ------------------------------------------------------------------ */

export type MotionFlags = { jMotion: boolean; zMotion: boolean };

/**
 * Very rough fingertip-trail heuristics. "J" fires when the little fingertip
 * has drifted down and sideways; "Z" fires when the index fingertip has covered
 * a wide enough box. Neither looks at the shape of the path, so ordinary hand
 * movement triggers both. Kept only because the prototype had them.
 */
export class MotionTrail {
  private pinky: Point[] = [];
  private index: Point[] = [];
  private lastTimestamp: number | null = null;
  private lastSlot: number | null = null;

  reset(): void {
    this.pinky = [];
    this.index = [];
    this.lastTimestamp = null;
    this.lastSlot = null;
  }

  update(lm: readonly Landmark[], slot: number, timestamp: number): MotionFlags {
    const gapTooLong = this.lastTimestamp !== null && timestamp - this.lastTimestamp > TRAIL_MAX_GAP_MS;
    if (gapTooLong || (this.lastSlot !== null && this.lastSlot !== slot)) this.reset();
    this.lastTimestamp = timestamp;
    this.lastSlot = slot;

    this.pinky.push({ x: lm[20].x, y: lm[20].y });
    if (this.pinky.length > PINKY_TRAIL_LENGTH) this.pinky.shift();
    this.index.push({ x: lm[8].x, y: lm[8].y });
    if (this.index.length > INDEX_TRAIL_LENGTH) this.index.shift();

    return { jMotion: this.detectJ(), zMotion: this.detectZ() };
  }

  private detectJ(): boolean {
    if (this.pinky.length < 10) return false;
    const first = this.pinky[0];
    const last = this.pinky[this.pinky.length - 1];
    return last.y - first.y > 0.045 && Math.abs(last.x - first.x) > 0.03;
  }

  private detectZ(): boolean {
    if (this.index.length < 12) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of this.index) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return maxX - minX > 0.06 && maxY - minY > 0.05;
  }
}

/* ------------------------------------------------------------------ */
/* Hand description used by the letter rules                           */
/* ------------------------------------------------------------------ */

export type HandShape = {
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  little: FingerState;
  /** Thumb tip far from both the index and the little-finger knuckle. */
  thumbOut: boolean;
  /** Thumb tip above the index knuckle and above its own last joint. */
  thumbUp: boolean;
  /** Thumb tip below the thumb base (hand pointing down). */
  thumbBelowBase: boolean;
  /** Thumb tip is not far below the index middle joint (A-like fist). */
  thumbBesideIndex: boolean;
  /** Index tip is not far below the thumb tip (E-like curl). */
  indexTipAboveThumb: boolean;
  /** Distances in palm lengths (wrist → middle knuckle, 2-D). */
  thumbToIndexTip: number;
  thumbToMiddleTip: number;
  thumbToIndexKnuckle: number;
  thumbToLittleKnuckle: number;
  thumbToRingKnuckle: number;
  thumbToIndexJoint: number;
  thumbToMiddleJoint: number;
  indexToMiddleTip: number;
  middleToRingTip: number;
  motion: MotionFlags;
};

const NO_MOTION: MotionFlags = { jMotion: false, zMotion: false };

/** `lm` must already be isotropic (see toIsotropic). */
export function describeHand(lm: readonly Landmark[], motion: MotionFlags = NO_MOTION): HandShape {
  const palm = Math.max(distance2d(lm[0], lm[9]), 1e-4);
  const inPalms = (a: number, b: number) => distance2d(lm[a], lm[b]) / palm;

  const thumbToIndexKnuckle = inPalms(4, 5);
  const thumbToLittleKnuckle = inPalms(4, 17);

  return {
    index: fingerState(lm, 5, 6, 7, 8),
    middle: fingerState(lm, 9, 10, 11, 12),
    ring: fingerState(lm, 13, 14, 15, 16),
    little: fingerState(lm, 17, 18, 19, 20),
    thumbOut: thumbToIndexKnuckle > 0.54 && thumbToLittleKnuckle > 0.86,
    thumbUp: lm[4].y < lm[5].y && lm[4].y < lm[3].y,
    thumbBelowBase: lm[4].y > lm[2].y,
    thumbBesideIndex: lm[4].y < lm[6].y + 0.04,
    indexTipAboveThumb: lm[8].y < lm[4].y + 0.04,
    thumbToIndexTip: inPalms(4, 8),
    thumbToMiddleTip: inPalms(4, 12),
    thumbToIndexKnuckle,
    thumbToLittleKnuckle,
    thumbToRingKnuckle: inPalms(4, 13),
    thumbToIndexJoint: inPalms(4, 6),
    thumbToMiddleJoint: inPalms(4, 10),
    indexToMiddleTip: inPalms(8, 12),
    middleToRingTip: inPalms(12, 16),
    motion,
  };
}

/* ------------------------------------------------------------------ */
/* Letter rules                                                        */
/* ------------------------------------------------------------------ */

/** One weighted condition: the weight counts when the condition holds. */
type Clause = [condition: boolean, weight: number];
type LetterRule = (s: HandShape) => Clause[];

/** A finger that is neither straight nor closed (the C curve). */
const halfOpen = (f: FingerState) => !f.extended && !f.curled;

/**
 * The original rule table, weight for weight. Each letter is a short list of
 * conditions; the score is the sum of the weights that hold, clamped to
 * 0.01..0.99. Several fist letters (A, E, M, N, S, T) differ only in the last
 * clause, which is why the prototype confuses them.
 */
const LETTER_RULES: Readonly<Record<string, LetterRule>> = {
  A: (s) => [
    [s.index.curled, 0.22],
    [s.middle.curled, 0.22],
    [s.ring.curled, 0.22],
    [s.little.curled, 0.2],
    [s.thumbToMiddleJoint > 0.42 && s.thumbBesideIndex, 0.14],
  ],
  B: (s) => [
    [s.index.extended, 0.2],
    [s.middle.extended, 0.2],
    [s.ring.extended, 0.2],
    [s.little.extended, 0.2],
    [s.indexToMiddleTip < 0.34, 0.1],
    [!s.thumbOut, 0.1],
  ],
  C: (s) => [
    [halfOpen(s.index), 0.22],
    [halfOpen(s.middle), 0.22],
    [halfOpen(s.ring), 0.18],
    [s.thumbToIndexTip > 0.36 && s.thumbToIndexTip < 0.98, 0.24],
    [s.thumbToMiddleTip > 0.4, 0.14],
  ],
  D: (s) => [
    [s.index.extended && !s.index.sideways && !s.index.pointingDown, 0.32],
    [s.middle.curled, 0.2],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.thumbToMiddleTip < 0.55, 0.12],
  ],
  E: (s) => [
    [s.index.curled, 0.2],
    [s.middle.curled, 0.2],
    [s.ring.curled, 0.2],
    [s.little.curled, 0.2],
    [s.thumbToIndexTip < 0.46 && s.indexTipAboveThumb, 0.2],
  ],
  F: (s) => [
    [s.thumbToIndexTip < 0.34, 0.34],
    [s.middle.extended, 0.22],
    [s.ring.extended, 0.22],
    [s.little.extended, 0.22],
  ],
  G: (s) => [
    [s.index.extended && s.index.sideways, 0.36],
    [s.thumbOut, 0.2],
    [s.middle.curled, 0.15],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.14],
  ],
  H: (s) => [
    [s.index.extended && s.index.sideways, 0.26],
    [s.middle.extended && s.middle.sideways, 0.26],
    [s.indexToMiddleTip < 0.28, 0.18],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.15],
  ],
  I: (s) => [
    [s.little.extended, 0.35],
    [s.index.curled, 0.2],
    [s.middle.curled, 0.2],
    [s.ring.curled, 0.15],
    [!s.motion.jMotion, 0.1],
  ],
  J: (s) => [
    [s.little.extended, 0.34],
    [s.index.curled, 0.18],
    [s.middle.curled, 0.18],
    [s.ring.curled, 0.1],
    [s.motion.jMotion, 0.2],
  ],
  K: (s) => [
    [s.index.extended && !s.index.pointingDown, 0.22],
    [s.middle.extended && !s.middle.pointingDown, 0.22],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.indexToMiddleTip >= 0.22 && s.thumbUp, 0.2],
  ],
  L: (s) => [
    [s.thumbOut, 0.28],
    [s.index.extended && !s.index.sideways, 0.28],
    [s.middle.curled, 0.15],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.14],
  ],
  M: (s) => [
    [s.index.curled, 0.18],
    [s.middle.curled, 0.18],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.thumbToLittleKnuckle < 0.55 && s.thumbToRingKnuckle < 0.45, 0.28],
  ],
  N: (s) => [
    [s.index.curled, 0.18],
    [s.middle.curled, 0.18],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.thumbToRingKnuckle < 0.48 && s.thumbToLittleKnuckle >= 0.55, 0.28],
  ],
  O: (s) => [
    [s.thumbToIndexTip < 0.32, 0.32],
    [s.thumbToMiddleTip < 0.45, 0.22],
    [!s.index.extended, 0.16],
    [!s.middle.extended, 0.15],
    [!s.little.extended, 0.15],
  ],
  P: (s) => [
    [s.index.pointingDown, 0.3],
    [s.middle.pointingDown, 0.26],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.15],
    [s.indexToMiddleTip > 0.16, 0.14],
  ],
  Q: (s) => [
    [s.index.pointingDown, 0.34],
    [s.thumbBelowBase, 0.22],
    [s.middle.curled, 0.15],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.14],
  ],
  R: (s) => [
    [s.index.extended, 0.24],
    [s.middle.extended, 0.24],
    [s.indexToMiddleTip < 0.15, 0.26],
    [s.ring.curled, 0.13],
    [s.little.curled, 0.13],
  ],
  S: (s) => [
    [s.index.curled, 0.2],
    [s.middle.curled, 0.2],
    [s.ring.curled, 0.2],
    [s.little.curled, 0.2],
    [s.thumbToMiddleJoint <= 0.44 && s.thumbToIndexJoint > 0.36, 0.2],
  ],
  T: (s) => [
    [s.index.curled, 0.2],
    [s.middle.curled, 0.2],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.thumbToIndexJoint <= 0.36 && s.thumbToMiddleJoint <= 0.38, 0.24],
  ],
  U: (s) => [
    [s.index.extended, 0.25],
    [s.middle.extended, 0.25],
    [s.ring.curled, 0.18],
    [s.little.curled, 0.18],
    [s.indexToMiddleTip >= 0.15 && s.indexToMiddleTip < 0.26, 0.14],
  ],
  V: (s) => [
    [s.index.extended, 0.24],
    [s.middle.extended, 0.24],
    [s.ring.curled, 0.16],
    [s.little.curled, 0.16],
    [s.indexToMiddleTip >= 0.28 && !s.thumbUp, 0.2],
  ],
  W: (s) => [
    [s.index.extended, 0.24],
    [s.middle.extended, 0.24],
    [s.ring.extended, 0.24],
    [s.little.curled, 0.2],
    [s.middleToRingTip > 0.18, 0.08],
  ],
  X: (s) => [
    [s.index.hooked, 0.38],
    [s.middle.curled, 0.22],
    [s.ring.curled, 0.2],
    [s.little.curled, 0.2],
  ],
  Y: (s) => [
    [s.thumbOut, 0.28],
    [s.little.extended, 0.28],
    [s.index.curled, 0.15],
    [s.middle.curled, 0.15],
    [s.ring.curled, 0.14],
  ],
  Z: (s) => [
    [s.index.extended, 0.34],
    [s.middle.curled, 0.16],
    [s.ring.curled, 0.15],
    [s.little.curled, 0.15],
    [s.motion.zMotion, 0.2],
  ],
};

function ruleScore(clauses: Clause[]): number {
  let total = 0;
  for (const [holds, weight] of clauses) if (holds) total += weight;
  return Math.max(0.01, Math.min(0.99, total));
}

/** Scores all 26 letters, highest first. Ties keep alphabetical order. */
export function scoreLegacyAslLetters(shape: HandShape): RecognitionCandidate[] {
  return LETTERS.map((letter) => ({
    classId: letter,
    label: letter,
    score: ruleScore(LETTER_RULES[letter](shape)),
  })).sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* SignModel                                                           */
/* ------------------------------------------------------------------ */

const CLASSES: SignClass[] = LETTERS.map((letter) => ({
  classId: letter,
  label: letter,
  hands: 1,
  motion: LEGACY_ASL_MOTION_LETTERS.includes(letter) ? "dynamic" : "static",
}));

export const LEGACY_ASL_INFO: ModelInfo = {
  id: LEGACY_ASL_MODEL_ID,
  version: LEGACY_ASL_MODEL_VERSION,
  name: "Legacy ASL fingerspelling prototype (rules)",
  signLanguage: "ASL",
  kind: "legacy_asl_prototype",
  input: "single_hand_static",
  scoreType: "classifier_score",
  validated: false,
  classes: CLASSES,
  description:
    "Hand-tuned geometric rules for the one-handed American Sign Language alphabet, ported from the original prototype. " +
    "It is not Indian Sign Language and has not been evaluated on any dataset.",
  limitations: [
    "American Sign Language letters only. It does not recognise Indian Sign Language.",
    "Never evaluated: no accuracy figure exists for these rules.",
    "The score is a sum of rule weights, not a probability.",
    "One hand only. When two hands are visible only the primary hand is classified.",
    "J and Z need movement. The fingertip-trail heuristics for them are weak and often fire on ordinary hand movement.",
    "Closed-fist letters (A, E, M, N, S, T) and the pairs U/V/R and I/J/Y are frequently confused. A closed fist can even score highest as P, because the downward-finger rule fires on curled fingertips.",
    "Thresholds were tuned by eye for an upright hand facing the camera; rotation, distance and camera angle change the result.",
  ],
};

export type LegacyAslOptions = {
  /** Best rule score below this gives status "uncertain". Default 0.5. */
  minScore?: number;
  /** How many alternatives to report. Default 3. */
  maxCandidates?: number;
};

function hasUsableLandmarks(hand: TrackedHand): boolean {
  if (!Array.isArray(hand.landmarks) || hand.landmarks.length !== LANDMARKS_PER_HAND) return false;
  return hand.landmarks.every(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
  );
}

export class LegacyAslModel implements SignModel {
  readonly info: ModelInfo = LEGACY_ASL_INFO;
  private readonly minScore: number;
  private readonly maxCandidates: number;
  private readonly trail = new MotionTrail();

  constructor(options: LegacyAslOptions = {}) {
    this.minScore = options.minScore ?? 0.5;
    this.maxCandidates = options.maxCandidates ?? 3;
  }

  async load(): Promise<void> {
    // Rules are code: there is nothing to download.
  }

  reset(): void {
    this.trail.reset();
  }

  dispose(): void {
    this.trail.reset();
  }

  predict(features: FrameFeatures): RecognitionResult {
    const base = {
      modelId: this.info.id,
      modelVersion: this.info.version,
      signLanguage: this.info.signLanguage,
      timestamp: features.timestamp,
    } as const;

    const hands = features.frame.hands;
    if (hands.length === 0) {
      this.trail.reset();
      return {
        ...base,
        classId: null,
        label: null,
        status: "no_hands",
        score: null,
        scoreType: null,
        handsUsed: 0,
        candidates: [],
      };
    }

    // hands are ordered by slot; the primary hand is the lowest slot.
    const primary = hands[0];
    if (!hasUsableLandmarks(primary)) {
      this.trail.reset();
      return {
        ...base,
        classId: null,
        label: null,
        status: "unsupported",
        score: null,
        scoreType: null,
        handsUsed: 0,
        candidates: [],
        reason: REASONS.legacyBadLandmarks,
      };
    }

    const lm = toIsotropic(primary.landmarks, features.frame.imageWidth, features.frame.imageHeight);
    const motion = this.trail.update(lm, primary.slot, features.timestamp);
    const ranked = scoreLegacyAslLetters(describeHand(lm, motion));
    const candidates = ranked.slice(0, this.maxCandidates);
    const best = ranked[0];
    const twoHands = hands.length > 1;

    if (best.score < this.minScore) {
      return {
        ...base,
        classId: null,
        label: null,
        status: "uncertain",
        score: best.score,
        scoreType: this.info.scoreType,
        handsUsed: 1,
        candidates,
        reason: twoHands
          ? `${REASONS.legacyNoRuleMatch} ${REASONS.legacyPrimaryHandOnly}`
          : REASONS.legacyNoRuleMatch,
      };
    }

    return {
      ...base,
      classId: best.classId,
      label: best.label,
      status: "recognized",
      score: best.score,
      scoreType: this.info.scoreType,
      handsUsed: 1,
      candidates,
      ...(twoHands ? { reason: REASONS.legacyPrimaryHandOnly } : {}),
    };
  }
}
