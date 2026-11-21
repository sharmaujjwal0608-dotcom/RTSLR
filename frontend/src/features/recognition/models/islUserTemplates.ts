/**
 * Experimental ISL recogniser trained by the user in their own browser.
 *
 * It is a k-nearest-neighbour matcher (cosine similarity) over the samples the
 * user recorded. It knows only those signs, only as that user made them, and
 * has no evaluation behind it. It is NOT a validated ISL model.
 *
 * Coordinated two-hand path: a sign recorded with two hands is stored as the
 * 156-D `features.dual` vector (both hand shapes plus their relative position,
 * fingertip distances and palm orientation) and is matched only when exactly
 * two hands are tracked. A sign recorded with one hand uses the 63-D vector
 * and is matched only when exactly one hand is tracked. The two sets never
 * mix, and a two-hand result is never assembled from two one-hand results.
 */

import type {
  FrameFeatures,
  ModelInfo,
  RecognitionCandidate,
  RecognitionResult,
  SignClass,
  SignModel,
} from "../../../types/recognition";
import { DUAL_FEATURE_DIM, SINGLE_FEATURE_DIM } from "../../../types/recognition";
import { REASONS } from "../reasons";
import type { SampleHands, SampleStore, StoredSample } from "../sampleStore";
import { summariseSamples } from "../sampleStore";
import { clamp, isFiniteVector, toUnitVector } from "../vectorMath";

export const ISL_USER_MODEL_ID = "rtslr-isl-user-templates";
export const ISL_USER_MODEL_VERSION = "1.0.0";

export type KnnOptions = {
  /** Neighbours that vote. Default 5 (capped by the number of samples). */
  k: number;
  /**
   * Largest cosine distance (1 − similarity) to the nearest sample that can
   * still be accepted, however varied the recorded samples are. Default 0.08.
   */
  maxDistance: number;
  /**
   * Smallest acceptance radius. Samples recorded in one steady burst are
   * almost identical, so a radius derived from them alone would reject the
   * same sign made a moment later. Default 0.02.
   */
  minDistance: number;
  /** Acceptance radius = spreadFactor × the class's own sample spread, clamped to [minDistance, maxDistance]. Default 6. */
  spreadFactor: number;
  /** The winning class needs at least this share of the similarity-weighted vote. Default 0.5. */
  minVoteShare: number;
  /** Alternatives reported per frame. Default 3. */
  maxCandidates: number;
};

/**
 * These defaults are engineering starting points. They have not been tuned on
 * data, because no ISL data exists in this project yet.
 */
export const DEFAULT_KNN_OPTIONS: KnnOptions = {
  k: 5,
  maxDistance: 0.08,
  minDistance: 0.02,
  spreadFactor: 6,
  minVoteShare: 0.5,
  maxCandidates: 3,
};

/** Samples per class used to estimate the class spread (keeps rebuilds cheap). */
const SPREAD_SAMPLE_LIMIT = 48;

type IndexedClass = {
  classId: string;
  label: string;
  /** Cosine distance within which the nearest sample counts as a match. */
  acceptDistance: number;
};

/** All samples of one hand count, as unit vectors in one flat matrix. */
export type TemplateIndex = {
  hands: SampleHands;
  dimension: number;
  sampleCount: number;
  /** sampleCount × dimension, row-major, each row unit length. */
  matrix: Float32Array;
  /** Class index (into `classes`) of each row. */
  rowClass: Uint16Array;
  classes: IndexedClass[];
};

export type KnnOutcome =
  | { status: "empty" }
  | {
      status: "recognized" | "uncertain";
      classId: string | null;
      label: string | null;
      score: number;
      nearestDistance: number;
      candidates: RecognitionCandidate[];
      reason?: string;
    };

function rowDot(matrix: Float32Array, row: number, dimension: number, unit: Float32Array): number {
  const offset = row * dimension;
  let sum = 0;
  for (let i = 0; i < dimension; i++) sum += matrix[offset + i] * unit[i];
  return sum;
}

/** Mean distance from a sample to its nearest neighbour of the same class. */
function classSpread(matrix: Float32Array, rows: number[], dimension: number): number | null {
  if (rows.length < 2) return null;
  const step = Math.max(1, Math.floor(rows.length / SPREAD_SAMPLE_LIMIT));
  const picked: number[] = [];
  for (let i = 0; i < rows.length; i += step) picked.push(rows[i]);
  if (picked.length < 2) return null;

  let total = 0;
  const probe = new Float32Array(dimension);
  for (const a of picked) {
    probe.set(matrix.subarray(a * dimension, (a + 1) * dimension));
    let best = -Infinity;
    for (const b of picked) {
      if (a === b) continue;
      const similarity = rowDot(matrix, b, dimension, probe);
      if (similarity > best) best = similarity;
    }
    total += 1 - best;
  }
  return total / picked.length;
}

/** Builds the search index for the samples recorded with `hands` hands. */
export function buildTemplateIndex(
  samples: readonly StoredSample[],
  hands: SampleHands,
  options: KnnOptions = DEFAULT_KNN_OPTIONS,
): TemplateIndex {
  const dimension = hands === 1 ? SINGLE_FEATURE_DIM : DUAL_FEATURE_DIM;
  const usable = samples.filter((s) => s.hands === hands && isFiniteVector(s.vector, dimension));

  const classIndexById = new Map<string, number>();
  const classes: IndexedClass[] = [];
  const rowsByClass: number[][] = [];
  const matrix = new Float32Array(usable.length * dimension);
  const rowClass = new Uint16Array(usable.length);

  usable.forEach((sample, row) => {
    let classIndex = classIndexById.get(sample.classId);
    if (classIndex === undefined) {
      classIndex = classes.length;
      classIndexById.set(sample.classId, classIndex);
      classes.push({ classId: sample.classId, label: sample.label, acceptDistance: options.minDistance });
      rowsByClass.push([]);
    }
    classes[classIndex].label = sample.label;
    rowsByClass[classIndex].push(row);
    rowClass[row] = classIndex;
    matrix.set(toUnitVector(sample.vector), row * dimension);
  });

  classes.forEach((cls, classIndex) => {
    const spread = classSpread(matrix, rowsByClass[classIndex], dimension);
    cls.acceptDistance =
      spread === null
        ? options.minDistance
        : clamp(spread * options.spreadFactor, options.minDistance, options.maxDistance);
  });

  return { hands, dimension, sampleCount: usable.length, matrix, rowClass, classes };
}

/**
 * Classifies one vector against an index.
 *
 * 1. Take the k most similar samples.
 * 2. Each votes for its class with weight = its similarity (never negative).
 * 3. Reject as "uncertain" when the nearest sample is further than its class's
 *    acceptance radius (an unknown pose), or when no class wins a clear share.
 *
 * score = winning vote share × similarity of the nearest sample. It is a
 * classifier score in 0..1, not a probability.
 */
export function classifyWithTemplates(
  index: TemplateIndex,
  vector: ArrayLike<number>,
  options: KnnOptions = DEFAULT_KNN_OPTIONS,
): KnnOutcome {
  if (index.sampleCount === 0) return { status: "empty" };
  if (vector.length !== index.dimension) {
    throw new Error(`Expected a ${index.dimension}-D vector, received ${vector.length}-D`);
  }

  const unit = toUnitVector(vector);
  const k = Math.max(1, Math.min(Math.floor(options.k), index.sampleCount));

  // Top-k by similarity with a small insertion-sorted buffer.
  const topSimilarity = new Float32Array(k).fill(-Infinity);
  const topRow = new Int32Array(k).fill(-1);
  for (let row = 0; row < index.sampleCount; row++) {
    const similarity = rowDot(index.matrix, row, index.dimension, unit);
    if (similarity <= topSimilarity[k - 1]) continue;
    let position = k - 1;
    while (position > 0 && topSimilarity[position - 1] < similarity) {
      topSimilarity[position] = topSimilarity[position - 1];
      topRow[position] = topRow[position - 1];
      position -= 1;
    }
    topSimilarity[position] = similarity;
    topRow[position] = row;
  }

  const votes = new Float64Array(index.classes.length);
  const bestSimilarityOfClass = new Float64Array(index.classes.length).fill(-Infinity);
  let totalVotes = 0;
  for (let i = 0; i < k; i++) {
    if (topRow[i] < 0) continue;
    const classIndex = index.rowClass[topRow[i]];
    const weight = Math.max(0, topSimilarity[i]);
    votes[classIndex] += weight;
    totalVotes += weight;
    if (topSimilarity[i] > bestSimilarityOfClass[classIndex]) bestSimilarityOfClass[classIndex] = topSimilarity[i];
  }

  const nearestSimilarity = clamp(topSimilarity[0], -1, 1);
  const nearestDistance = 1 - nearestSimilarity;
  const nearestClass = index.rowClass[topRow[0]];

  const ranked: { classIndex: number; share: number }[] = [];
  for (let c = 0; c < votes.length; c++) {
    if (votes[c] > 0) ranked.push({ classIndex: c, share: totalVotes > 0 ? votes[c] / totalVotes : 0 });
  }
  ranked.sort((a, b) => b.share - a.share);

  const candidates: RecognitionCandidate[] = ranked.slice(0, options.maxCandidates).map((entry) => ({
    classId: index.classes[entry.classIndex].classId,
    label: index.classes[entry.classIndex].label,
    score: clamp(entry.share * Math.max(0, bestSimilarityOfClass[entry.classIndex]), 0, 1),
  }));

  if (ranked.length === 0 || nearestDistance > index.classes[nearestClass].acceptDistance) {
    return {
      status: "uncertain",
      classId: null,
      label: null,
      score: candidates[0]?.score ?? 0,
      nearestDistance,
      candidates,
      reason: REASONS.islTooFar,
    };
  }

  const winner = ranked[0];
  const score = clamp(winner.share * Math.max(0, nearestSimilarity), 0, 1);
  if (winner.share < options.minVoteShare) {
    return {
      status: "uncertain",
      classId: null,
      label: null,
      score,
      nearestDistance,
      candidates,
      reason: REASONS.islAmbiguous,
    };
  }

  return {
    status: "recognized",
    classId: index.classes[winner.classIndex].classId,
    label: index.classes[winner.classIndex].label,
    score,
    nearestDistance,
    candidates,
  };
}

/* ------------------------------------------------------------------ */
/* SignModel                                                           */
/* ------------------------------------------------------------------ */

const BASE_INFO: Omit<ModelInfo, "classes"> = {
  id: ISL_USER_MODEL_ID,
  version: ISL_USER_MODEL_VERSION,
  name: "Experimental ASL — signs you recorded",
  signLanguage: "ASL",
  kind: "experimental_isl_user_trained",
  input: "single_or_dual_static",
  scoreType: "classifier_score",
  validated: false,
  description:
    "Matches the current hand pose against samples you recorded in this browser (k-nearest neighbours, cosine similarity). " +
    "Two-hand signs are matched as one coordinated two-hand pose. It is an experiment trained on your own ASL samples, not a validated recogniser.",
  limitations: [
    "Not validated: no accuracy figure exists for this model.",
    "It recognises only the signs you recorded, as you made them, in similar framing. It will not generalise to other signers.",
    "Whether a recorded sign is correct ASL depends entirely on the person who recorded it; the app cannot check that.",
    "Static poses only. Signs that depend on movement, facial expression or body position cannot be represented.",
    "The score is a nearest-neighbour similarity score, not a probability.",
    "If two hands cross so that their wrists swap sides, the two-hand vector changes and the sign may not match.",
    "The rejection thresholds are untuned defaults; unknown poses can still be matched to a recorded sign.",
  ],
};

/** Static description with an empty class list (the live list is on the loaded model). */
export const ISL_USER_INFO: ModelInfo = { ...BASE_INFO, classes: [] };

export type IslUserTemplatesOptions = Partial<KnnOptions> & {
  /** Where the recorded samples live. */
  store: SampleStore;
};

export class IslUserTemplatesModel implements SignModel {
  private readonly store: SampleStore;
  private readonly options: KnnOptions;
  private loaded = false;
  private indexedVersion = -1;
  private single: TemplateIndex;
  private dual: TemplateIndex;
  private currentInfo: ModelInfo = { ...BASE_INFO, classes: [] };

  constructor(options: IslUserTemplatesOptions) {
    const { store, ...knn } = options;
    this.store = store;
    this.options = { ...DEFAULT_KNN_OPTIONS, ...knn };
    this.single = buildTemplateIndex([], 1, this.options);
    this.dual = buildTemplateIndex([], 2, this.options);
  }

  /** Reflects the classes recorded so far; refreshed whenever the store changes. */
  get info(): ModelInfo {
    this.refreshIfStale();
    return this.currentInfo;
  }

  async load(): Promise<void> {
    await this.store.ready();
    this.loaded = true;
    this.refreshIfStale();
  }

  reset(): void {
    // No temporal state: every frame is classified on its own.
  }

  dispose(): void {
    this.loaded = false;
  }

  private refreshIfStale(): void {
    if (!this.loaded || this.indexedVersion === this.store.version) return;
    const samples = this.store.getSnapshot();
    this.single = buildTemplateIndex(samples, 1, this.options);
    this.dual = buildTemplateIndex(samples, 2, this.options);
    const classes: SignClass[] = summariseSamples(samples).map((summary) => ({
      classId: summary.classId,
      label: summary.label,
      hands: summary.hands,
      motion: "static",
    }));
    this.currentInfo = { ...BASE_INFO, classes };
    this.indexedVersion = this.store.version;
  }

  predict(features: FrameFeatures): RecognitionResult {
    this.refreshIfStale();
    const base = {
      modelId: BASE_INFO.id,
      modelVersion: BASE_INFO.version,
      signLanguage: BASE_INFO.signLanguage,
      timestamp: features.timestamp,
    } as const;
    const empty: Pick<RecognitionResult, "classId" | "label" | "score" | "scoreType" | "candidates"> = {
      classId: null,
      label: null,
      score: null,
      scoreType: null,
      candidates: [],
    };

    if (features.handCount === 0) {
      return { ...base, ...empty, status: "no_hands", handsUsed: 0 };
    }
    const unsupported = (reason: string): RecognitionResult => ({
      ...base,
      ...empty,
      status: "unsupported",
      handsUsed: 0,
      reason,
    });

    if (!this.loaded) return unsupported(REASONS.islNotLoaded);
    if (this.single.sampleCount === 0 && this.dual.sampleCount === 0) return unsupported(REASONS.islNoSamples);

    // Exactly one of the two paths runs. They never fall through to each other.
    let index: TemplateIndex;
    let vector: Float32Array | null;
    if (features.handCount === 2) {
      if (this.dual.sampleCount === 0) return unsupported(REASONS.islOnlyOneHandClasses);
      index = this.dual;
      vector = features.dual;
    } else {
      if (this.single.sampleCount === 0) return unsupported(REASONS.islOnlyTwoHandClasses);
      index = this.single;
      vector = features.perHand[0]?.vector ?? null;
    }
    if (!vector || !isFiniteVector(vector, index.dimension)) return unsupported(REASONS.islBadVector);

    const outcome = classifyWithTemplates(index, vector, this.options);
    if (outcome.status === "empty") return unsupported(REASONS.islNoSamples);

    return {
      ...base,
      classId: outcome.classId,
      label: outcome.label,
      status: outcome.status,
      score: outcome.score,
      scoreType: BASE_INFO.scoreType,
      handsUsed: index.hands,
      candidates: outcome.candidates,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    };
  }
}
