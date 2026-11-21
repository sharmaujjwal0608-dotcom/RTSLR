/**
 * Descriptions of the running system for the R&D page: pipeline stages, model
 * kinds and feature layouts. Record text is English (the source language of
 * the project documentation).
 *
 * Sources, transcribed by hand; update this file when they change:
 *  - docs/ARCHITECTURE.md and docs/MODEL_CONTRACTS.md (fixed contracts)
 *  - frontend/src/features/tracking/*, frontend/src/features/recognition/*,
 *    frontend/src/features/language/transcript.ts (module header comments)
 *  - docs/RESEARCH_NOTES.md (limitations with reference ids)
 */

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export type PipelineStageId =
  | "camera"
  | "landmarker"
  | "tracking"
  | "features"
  | "model"
  | "stabiliser"
  | "transcript";

export type PipelineStage = {
  id: PipelineStageId;
  inputs: string[];
  outputs: string[];
  /** Paths relative to the repository root. */
  modules: string[];
  limitations: string[];
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "camera",
    inputs: ["A press on \"Start camera\". The camera never starts on its own.", "A video-only stream from getUserMedia (no audio)."],
    outputs: ["Live video frames in a <video> element. Frames stay in the browser; nothing is recorded or uploaded."],
    modules: ["frontend/src/features/tracking/camera.ts"],
    limitations: [
      "Needs camera permission. The camera stops when the tab is hidden and does not restart itself.",
      "Lighting, framing, distance and camera quality are outside the system's control and their effect has not been measured.",
      "No frame rate has been measured on any device (planned: EXP-005).",
    ],
  },
  {
    id: "landmarker",
    inputs: ["One video frame per animation frame."],
    outputs: [
      "Up to two hands, each with 21 landmarks: x and y normalised to the image, z as depth relative to that hand's wrist.",
      "A Left/Right handedness label with a score for each hand.",
    ],
    modules: ["frontend/src/features/tracking/landmarker.ts", "frontend/public/mediapipe/wasm (runtime, served from the same origin)"],
    limitations: [
      "How reliably both hands are found when they touch or overlap, as two-handed ISL letters require, has not been measured by RTSLR (planned: EXP-001). One published ISL system lost 4.3% of its images to failed detection (ref-kulkarni-2026-isl-rf).",
      "The handedness label flips on a mirrored image, so it is informational only and never used to order features.",
      "Detection runs synchronously on the main thread; moving it to a Web Worker is untested.",
      "Unless NEXT_PUBLIC_HAND_MODEL_URL points to a self-hosted copy, the model file is fetched once from Google's model hosting.",
      "Hands only: face, mouth and body landmarks, which carry meaning in ISL, are not tracked.",
    ],
  },
  {
    id: "tracking",
    inputs: ["Raw detections, which MediaPipe returns in an order that can swap between frames."],
    outputs: [
      "A HandFrame: 0, 1 or 2 tracked hands in stable slots (0 and 1) with One Euro filtered landmarks, in the unmirrored camera frame.",
    ],
    modules: ["frontend/src/features/tracking/association.ts", "frontend/src/features/tracking/smoothing.ts"],
    limitations: [
      "The smoothing defaults have not been tuned against real camera footage.",
      "Slots are matched by nearest wrist position and are not tied to left or right. Behaviour when hands cross quickly has not been measured.",
      "A slot is held for a few missed frames (default 5) and then released; a longer occlusion starts a new hand identity.",
    ],
  },
  {
    id: "features",
    inputs: ["A HandFrame with its image width and height."],
    outputs: [
      "One 63-D vector per tracked hand.",
      "One 156-D coordinated vector, only when exactly two hands are tracked.",
      "A motion summary per hand (wrist path, speed, still or moving).",
    ],
    modules: ["frontend/src/features/tracking/features.ts", "frontend/src/types/recognition.ts (schema rtslr-features-1)"],
    limitations: [
      "If the hands cross so that their wrists swap sides, hands A and B swap and the 156-D vector changes.",
      "No mirroring by handedness in version 1: a left-dominant signer produces a mirrored configuration.",
      "Depth (z) is the least reliable coordinate and is relative to each hand's own wrist.",
      "Single-frame features only. The temporal window type is reserved and no model consumes it, so signs that need movement cannot be represented.",
      "No experiment has tested this layout (planned: EXP-004).",
    ],
  },
  {
    id: "model",
    inputs: ["The features of one frame."],
    outputs: [
      "A RecognitionResult: status (recognized, uncertain, unsupported or no_hands), a label, a classifier score and the best alternatives.",
    ],
    modules: ["frontend/src/features/recognition/registry.ts", "frontend/src/features/recognition/models/"],
    limitations: [
      "No validated ISL model exists. The available models are listed under \"Model explorer\".",
      "Every score shipped today is a classifier score, not a probability, and must not be read as accuracy.",
      "A model answers \"unsupported\" when it cannot classify the input, for example two hands shown to a one-hand model.",
    ],
  },
  {
    id: "stabiliser",
    inputs: ["The stream of per-frame results."],
    outputs: [
      "A stabilised state (majority label and hold progress).",
      "Exactly one CommitEvent each time a sign is held long enough.",
    ],
    modules: ["frontend/src/features/recognition/stabilizer.ts"],
    limitations: [
      "Majority vote over the last 8 recognised frames, then a hold timer (default 1.2 s, adjustable 0.5 to 2.5 s), then a 1 s cooldown. These are untuned defaults, not measured optima.",
      "The hold adds delay by design: a sign shown briefly is not committed.",
      "It works on held static poses. It does not find where signs begin and end in continuous signing.",
    ],
  },
  {
    id: "transcript",
    inputs: ["CommitEvents, plus anything the user types."],
    outputs: ["A list of tokens with their origin (recognition or manual), shown as text and available for speech and export."],
    modules: ["frontend/src/features/language/transcript.ts"],
    limitations: [
      "The transcript is a record of recognised labels. It is not a translation: nothing is reordered, inflected or corrected.",
      "ISL grammar, facial expression and use of space are not represented.",
      "Not suitable for medical, legal, emergency or other high-stakes communication.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

export type ModelKindId = "legacy_asl_prototype" | "experimental_isl_user_trained" | "simulator" | "validated_isl";
export type ModelInputId = "single_hand_static" | "single_or_dual_static" | "synthetic_frames";

export type ModelRecord = {
  kind: ModelKindId;
  /** False for the empty "validated ISL" slot. */
  exists: boolean;
  name: string;
  /** Registry id and version; null where the registry has none. */
  id: string | null;
  version: string | null;
  signLanguage: "ISL" | "ASL" | null;
  input: ModelInputId | null;
  /** Null when the entry produces no score of its own. */
  scoreType: "classifier_score" | null;
  validated: false;
  description: string;
  limitations: string[];
  /** Only for the empty slot: what must exist before it can be filled. */
  requires: string[];
  module: string;
};

/**
 * Mirrors the static `ModelInfo` of the three registered models in
 * `frontend/src/features/recognition/registry.ts` (Agent 06):
 * LEGACY_ASL_INFO (models/legacyAsl.ts), ISL_USER_INFO
 * (models/islUserTemplates.ts) and VALIDATED_ISL_PLACEHOLDER_INFO
 * (models/validatedIsl.ts). The registry is not imported here because it pulls
 * the classifiers and the browser sample store into the page bundle;
 * `system.test.ts` checks that this mirror still matches it.
 * The simulator is a frame source (features/tracking/simulator.ts), not a
 * registered model, so it has no id or version.
 */
export const MODEL_RECORDS: ModelRecord[] = [
  {
    kind: "legacy_asl_prototype",
    exists: true,
    name: "Legacy ASL fingerspelling prototype (rules)",
    id: "rtslr-legacy-asl-rules",
    version: "1.0.0",
    signLanguage: "ASL",
    input: "single_hand_static",
    scoreType: "classifier_score",
    validated: false,
    description:
      "Hand-tuned geometric rules for the one-handed American Sign Language alphabet, ported from the original prototype. It is not Indian Sign Language and has not been evaluated on any dataset.",
    limitations: [
      "American Sign Language letters only. It does not recognise Indian Sign Language.",
      "Never evaluated: no accuracy figure exists for these rules.",
      "The score is a sum of rule weights, not a probability.",
      "One hand only. When two hands are visible only the primary hand is classified.",
      "J and Z need movement. The fingertip-trail heuristics for them are weak and often fire on ordinary hand movement.",
      "Closed-fist letters (A, E, M, N, S, T) and the pairs U/V/R and I/J/Y are frequently confused. A closed fist can even score highest as P, because the downward-finger rule fires on curled fingertips.",
      "Thresholds were tuned by eye for an upright hand facing the camera; rotation, distance and camera angle change the result.",
    ],
    requires: [],
    module: "frontend/src/features/recognition/models/legacyAsl.ts",
  },
  {
    kind: "experimental_isl_user_trained",
    exists: true,
    name: "Experimental ISL — signs you recorded",
    id: "rtslr-isl-user-templates",
    version: "1.0.0",
    signLanguage: "ISL",
    input: "single_or_dual_static",
    scoreType: "classifier_score",
    validated: false,
    description:
      "Matches the current hand pose against samples you recorded in this browser (k-nearest neighbours, cosine similarity). Two-hand signs are matched as one coordinated two-hand pose. It is an experiment, not a validated ISL recogniser.",
    limitations: [
      "Not validated: no accuracy figure exists for this model.",
      "It recognises only the signs you recorded, as you made them, in similar framing. It will not generalise to other signers.",
      "Whether a recorded sign is correct ISL depends entirely on the person who recorded it; the app cannot check that.",
      "Static poses only. Signs that depend on movement, facial expression or body position cannot be represented.",
      "The score is a nearest-neighbour similarity score, not a probability.",
      "If two hands cross so that their wrists swap sides, the two-hand vector changes and the sign may not match.",
      "The rejection thresholds are untuned defaults; unknown poses can still be matched to a recorded sign.",
    ],
    requires: [],
    module: "frontend/src/features/recognition/models/islUserTemplates.ts",
  },
  {
    kind: "simulator",
    exists: true,
    name: "Simulator",
    id: null,
    version: null,
    signLanguage: null,
    input: "synthetic_frames",
    scoreType: null,
    validated: false,
    description:
      "A demonstration source of synthetic hand frames that stands in for the camera. It is not a recogniser: the selected model classifies the synthetic frames, and they are always delivered marked as simulator output.",
    limitations: [
      "The poses are the hand-drawn shapes the legacy prototype used for its ASL A-Z rules. They are not Indian Sign Language.",
      "The poses are not derived from any signer and must not be presented as recognition of real signing.",
      "It says nothing about how the pipeline behaves on a real camera, real hands or real lighting.",
    ],
    requires: [],
    module: "frontend/src/features/tracking/simulator.ts",
  },
  {
    kind: "validated_isl",
    exists: false,
    name: "Validated ISL model (not available)",
    id: "rtslr-isl-static",
    version: null,
    signLanguage: "ISL",
    input: "single_or_dual_static",
    scoreType: null,
    validated: false,
    description:
      "No validated ISL model is available. None has been trained yet: the project has no authorised ISL dataset.",
    limitations: [
      "This model does not exist yet. Nothing is recognised until a trained and evaluated model file is published.",
    ],
    requires: [
      "A sign inventory reviewed by a fluent ISL signer and checked against the ISLRTC dictionary (roadmap rm-03).",
      "Landmark data collected with informed consent from several signers, each sample carrying an anonymous signer id (rm-04).",
      "A trained model exported as an rtslr-model-1 file whose evaluation field is filled in. A file with evaluation: null is treated as unvalidated.",
      "A documented, signer-aware evaluation: accuracy on signers never seen in training, with the number of signers, the protocol and the coverage stated (EXP-002, EXP-003).",
      "Review by fluent ISL signers before any public accuracy claim (rm-12).",
    ],
    module: "frontend/src/features/recognition/models/validatedIsl.ts",
  },
];

/* ------------------------------------------------------------------ */
/* Feature layouts (docs/MODEL_CONTRACTS.md sections 1 to 3)           */
/* ------------------------------------------------------------------ */

export type FeatureBlock = {
  /** Inclusive index range in the vector. */
  from: number;
  to: number;
  content: string;
  /** Groups blocks in the strip diagram. */
  group: "hand" | "handB" | "relation";
};

export const SINGLE_HAND_DIM = 63;
export const DUAL_HAND_DIM = 156;
export const FEATURE_SCHEMA = "rtslr-features-1";

export const SINGLE_HAND_LAYOUT: FeatureBlock[] = [
  { from: 0, to: 2, content: "Wrist (landmark 0). Always 0, 0, 0 because the wrist is the origin.", group: "hand" },
  { from: 3, to: 14, content: "Thumb, landmarks 1 to 4 (x, y, z each)", group: "hand" },
  { from: 15, to: 26, content: "Index finger, landmarks 5 to 8", group: "hand" },
  { from: 27, to: 38, content: "Middle finger, landmarks 9 to 12", group: "hand" },
  { from: 39, to: 50, content: "Ring finger, landmarks 13 to 16", group: "hand" },
  { from: 51, to: 62, content: "Little finger, landmarks 17 to 20", group: "hand" },
];

export const DUAL_HAND_LAYOUT: FeatureBlock[] = [
  { from: 0, to: 62, content: "Single-hand vector of hand A (the hand whose wrist has the smaller x in the unmirrored frame)", group: "hand" },
  { from: 63, to: 125, content: "Single-hand vector of hand B", group: "handB" },
  { from: 126, to: 128, content: "Wrist offset: (wrist B − wrist A) / s", group: "relation" },
  { from: 129, to: 129, content: "Wrist distance: ‖wrist B − wrist A‖ / s", group: "relation" },
  { from: 130, to: 154, content: "5 × 5 fingertip distances ‖tip A(i) − tip B(j)‖ / s, row by row over the fingers of A", group: "relation" },
  { from: 155, to: 155, content: "Cosine of the angle between the two palm normals", group: "relation" },
];

export const FEATURE_FORMULAS = {
  aspect: "x′ = x · (width / height),  y′ = y,  z′ = z · (width / height)",
  palm: "palm = max(‖p9 − p0‖, 0.0001)",
  single: "v[3i … 3i+2] = (p(i) − p0) / palm,  i = 0 … 20",
  scale: "s = mean of the two palm lengths",
  normal: "palm normal = normalize((p5 − p0) × (p17 − p0))",
};
