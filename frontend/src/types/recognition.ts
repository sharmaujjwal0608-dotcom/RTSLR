/**
 * RTSLR shared recognition contracts.
 *
 * Owned by Agent 00 (orchestrator). Tracking (Agent 05), models (Agent 06),
 * language (Agent 10) and the studio UI (Agent 01) all code against this file.
 * Do not change it without the orchestrator; add feature-local types in your
 * own folder instead.
 *
 * The matching prose specification is docs/MODEL_CONTRACTS.md.
 */

/* ------------------------------------------------------------------ */
/* Landmarks and tracking                                              */
/* ------------------------------------------------------------------ */

/** One MediaPipe hand landmark. x and y are normalised to the image (0..1,
 *  origin top-left, UNMIRRORED camera frame); z is MediaPipe's relative depth. */
export type Landmark = { x: number; y: number; z: number };

export const LANDMARKS_PER_HAND = 21;

export type Handedness = "Left" | "Right" | "Unknown";

/** A hand after identity association and smoothing. */
export type TrackedHand = {
  /** Stable slot for this hand across frames (0 or 1). A hand keeps its slot
   *  while it stays tracked; slots are not tied to left/right. */
  slot: 0 | 1;
  /** As reported by MediaPipe for the unmirrored frame. Informational only:
   *  never use it to order features (see docs/MODEL_CONTRACTS.md). */
  handedness: Handedness;
  handednessScore: number;
  /** 21 smoothed landmarks in unmirrored image coordinates. */
  landmarks: Landmark[];
  /** Number of consecutive frames this slot has been tracked. */
  ageFrames: number;
};

export type HandFrame = {
  /** performance.now() of the processed video frame, in milliseconds. */
  timestamp: number;
  imageWidth: number;
  imageHeight: number;
  /** 0, 1 or 2 hands, ordered by slot. */
  hands: TrackedHand[];
};

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

export const FEATURE_SCHEMA_VERSION = "rtslr-features-1";
export const SINGLE_FEATURE_DIM = 63;
export const DUAL_FEATURE_DIM = 156;

/** Motion summary for one hand over the recent trajectory window. */
export type HandMotion = {
  slot: 0 | 1;
  /** Path length of the wrist over the window, in palm lengths. */
  wristPath: number;
  /** Mean wrist speed over the window, in palm lengths per second. */
  wristSpeed: number;
  /** True when the hand is steady enough for static-sign classification. */
  isStill: boolean;
};

export type FrameFeatures = {
  schema: typeof FEATURE_SCHEMA_VERSION;
  timestamp: number;
  handCount: 0 | 1 | 2;
  /** One 63-D vector per tracked hand, ordered by slot. */
  perHand: { slot: 0 | 1; handedness: Handedness; vector: Float32Array }[];
  /** 156-D coordinated two-hand vector; null unless exactly two hands. */
  dual: Float32Array | null;
  motion: HandMotion[];
  /** Raw frame the features came from (for legacy geometric rules/overlays). */
  frame: HandFrame;
};

/** Reserved for dynamic-sign models. Not consumed by any v1 model. */
export type FeatureWindow = {
  schema: typeof FEATURE_SCHEMA_VERSION;
  /** Oldest first. */
  frames: FrameFeatures[];
  /** Nominal sampling rate of the window. */
  fps: number;
};

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

export type SignLanguage = "ISL" | "ASL";

/**
 * What a model really is. The UI must show this distinction at all times.
 * - legacy_asl_prototype: the ported hand-tuned ASL rule classifier.
 * - experimental_isl_user_trained: templates the user recorded in this browser.
 * - validated_isl: a trained ISL model with a documented evaluation. None ships today.
 * - simulator: synthetic landmarks for demonstration only.
 */
export type ModelKind =
  | "legacy_asl_prototype"
  | "experimental_isl_user_trained"
  | "validated_isl"
  | "simulator";

export type ScoreType = "calibrated_probability" | "classifier_score";

export type SignClass = {
  classId: string;
  /** Canonical English label, e.g. "A" or "HELLO". */
  label: string;
  hands: 1 | 2 | "either";
  motion: "static" | "dynamic";
};

export type ModelInfo = {
  id: string;
  version: string;
  name: string;
  signLanguage: SignLanguage;
  kind: ModelKind;
  input: "single_hand_static" | "dual_hand_static" | "single_or_dual_static" | "sequence";
  scoreType: ScoreType;
  /** True only for a model with a documented, reproducible evaluation. */
  validated: boolean;
  /** Classes this model can output right now (may be empty). */
  classes: SignClass[];
  description: string;
  limitations: string[];
};

export type RecognitionStatus = "recognized" | "uncertain" | "unsupported" | "no_hands";

export type RecognitionCandidate = {
  classId: string;
  label: string;
  score: number;
};

/** Output of every model for every processed frame. */
export type RecognitionResult = {
  modelId: string;
  modelVersion: string;
  signLanguage: SignLanguage;
  classId: string | null;
  label: string | null;
  status: RecognitionStatus;
  /** Meaning depends on scoreType. Never present it as "accuracy". */
  score: number | null;
  scoreType: ScoreType | null;
  timestamp: number;
  /** Number of hands the decision used. */
  handsUsed: 0 | 1 | 2;
  /** Best alternatives, highest score first (may be empty). */
  candidates: RecognitionCandidate[];
  /** Human-readable reason when status is "unsupported" or "uncertain". */
  reason?: string;
};

export interface SignModel {
  readonly info: ModelInfo;
  /** Load weights/templates. Must reject with a meaningful Error on failure. */
  load(): Promise<void>;
  /** Pure with respect to inputs except for internal temporal state. */
  predict(features: FrameFeatures): RecognitionResult;
  /** Clear temporal state (called when the camera stops or model changes). */
  reset(): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Stabilised output (what the transcript consumes)                    */
/* ------------------------------------------------------------------ */

export type StabilizerPhase = "idle" | "candidate" | "holding" | "committed" | "cooldown";

export type StabilizedState = {
  phase: StabilizerPhase;
  /** Majority label over the vote window, or null. */
  classId: string | null;
  label: string | null;
  /** 0..1 progress of the hold-to-append timer. */
  holdProgress: number;
  /** Latest raw result that produced this state. */
  latest: RecognitionResult | null;
};

/** Emitted exactly once each time a sign is committed to the transcript. */
export type CommitEvent = {
  classId: string;
  label: string;
  modelId: string;
  signLanguage: SignLanguage;
  timestamp: number;
};
