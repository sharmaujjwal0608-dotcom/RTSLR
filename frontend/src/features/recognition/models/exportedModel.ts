/**
 * Loader and inference for trained models exported by `machine-learning/`
 * in the `rtslr-model-1` JSON format (docs/MODEL_CONTRACTS.md §6).
 *
 * No such model ships today. When the file is missing the loader reports
 * `ModelLoadError` with code "not_found", which the registry turns into the
 * plain statement "no validated ISL model is available".
 *
 * Conventions fixed here and mirrored by machine-learning/exports/export_model.py:
 *  - `mlp.layers[i].W` has one row per OUTPUT unit: y = W·x + b.
 *  - Hidden layers use "relu"; the last layer uses "softmax" and has one unit per class.
 *  - `standardizer` is applied first: x' = (x − mean) / scale. `null` means identity.
 *  - `knn.samples[].vector` is already standardised. Neighbours vote uniformly;
 *    ties go to the class that comes first in `classes` (scikit-learn's rule).
 *
 * Security (docs/SECURITY_PRIVACY.md): MOD-01 URL allow-list on the parsed URL,
 * MOD-03 fetch options, MOD-06 size cap, MOD-08 JSON.parse only, MOD-09 schema
 * and finite-number checks, MOD-10 no prototype keys, MOD-12 all-or-nothing,
 * MOD-13 weights in typed arrays and a fixed activation allow-list.
 */

import type {
  FrameFeatures,
  ModelInfo,
  RecognitionCandidate,
  RecognitionResult,
  SignClass,
  SignModel,
} from "../../../types/recognition";
import { DUAL_FEATURE_DIM, FEATURE_SCHEMA_VERSION, SINGLE_FEATURE_DIM } from "../../../types/recognition";
import { REASONS } from "../reasons";
import {
  MAX_CLASS_COUNT,
  MAX_JSON_BYTES,
  ValidationError,
  expectArray,
  expectBoolean,
  expectFiniteNumber,
  expectFloatVector,
  expectInteger,
  expectLabel,
  expectObject,
  expectString,
  isPlainObject,
  oneOf,
  parseJsonSafely,
} from "../safeJson";
import { isFiniteVector, l2Norm, softmaxInto } from "../vectorMath";

export const EXPORTED_MODEL_FORMAT = "rtslr-model-1";
export const MAX_MODEL_BYTES = MAX_JSON_BYTES;
const MAX_LAYERS = 8;
const MAX_LAYER_UNITS = 4096;
const MAX_TOTAL_WEIGHTS = 2_000_000;
const MAX_KNN_SAMPLES = 20_000;
const MAX_KNN_K = 50;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type ModelLoadErrorCode =
  | "not_found"
  | "blocked_url"
  | "network"
  | "http_error"
  | "too_large"
  | "invalid"
  | "synthetic";

export class ModelLoadError extends Error {
  constructor(
    message: string,
    readonly code: ModelLoadErrorCode,
  ) {
    super(message);
    this.name = "ModelLoadError";
  }
}

/* ------------------------------------------------------------------ */
/* Parsed model                                                        */
/* ------------------------------------------------------------------ */

export type DenseLayer = {
  inputSize: number;
  outputSize: number;
  /** outputSize × inputSize, row-major. */
  weights: Float32Array;
  bias: Float32Array;
  activation: "relu" | "softmax";
};

export type ModelEvaluation = {
  protocol: string;
  /** Flat name → number map with no prototype. */
  metrics: Readonly<Record<string, number>>;
  datasetId: string;
  date: string;
};

export type ParsedExportedModel = {
  info: ModelInfo;
  type: "mlp" | "knn";
  inputDim: typeof SINGLE_FEATURE_DIM | typeof DUAL_FEATURE_DIM;
  /** Class ids in output order. */
  classes: string[];
  labels: string[];
  mean: Float32Array | null;
  scale: Float32Array | null;
  layers: DenseLayer[] | null;
  knn: {
    k: number;
    sampleCount: number;
    /** sampleCount × inputDim unit vectors (standardised space). */
    matrix: Float32Array;
    rowClass: Uint16Array;
  } | null;
  evaluation: ModelEvaluation | null;
};

const TOP_LEVEL_KEYS = [
  "format",
  "featureSchema",
  "info",
  "type",
  "inputDim",
  "classes",
  "standardizer",
  "mlp",
  "knn",
  "evaluation",
] as const;

const INFO_KEYS = [
  "id",
  "version",
  "name",
  "signLanguage",
  "kind",
  "input",
  "scoreType",
  "validated",
  "classes",
  "description",
  "limitations",
] as const;

function parseInfo(value: unknown, classIds: string[], inputDim: number): { info: ModelInfo; labels: string[] } {
  const raw = expectObject(value, "$.info", INFO_KEYS);
  const rawClasses = expectArray(raw.classes, "$.info.classes", MAX_CLASS_COUNT);
  if (rawClasses.length !== classIds.length) {
    throw new ValidationError("$.info.classes: must list the same classes as $.classes, in the same order");
  }
  const expectedHands = inputDim === SINGLE_FEATURE_DIM ? 1 : 2;
  const classes: SignClass[] = rawClasses.map((entry, i) => {
    const path = `$.info.classes[${i}]`;
    const item = expectObject(entry, path, ["classId", "label", "hands", "motion"]);
    const classId = expectLabel(item.classId, `${path}.classId`);
    if (classId !== classIds[i]) throw new ValidationError(`${path}.classId: expected "${classIds[i]}"`);
    if (item.hands !== expectedHands) {
      throw new ValidationError(`${path}.hands: a ${inputDim}-D model can only have ${expectedHands}-hand classes`);
    }
    if (item.motion !== "static") throw new ValidationError(`${path}.motion: this format holds static signs only`);
    return { classId, label: expectLabel(item.label, `${path}.label`), hands: expectedHands, motion: "static" };
  });

  const expectedInput = inputDim === SINGLE_FEATURE_DIM ? "single_hand_static" : "dual_hand_static";
  const input = oneOf(raw.input, "$.info.input", ["single_hand_static", "dual_hand_static"] as const);
  if (input !== expectedInput) throw new ValidationError(`$.info.input: expected "${expectedInput}" for inputDim ${inputDim}`);

  const limitations = expectArray(raw.limitations, "$.info.limitations", 50).map((item, i) =>
    expectString(item, `$.info.limitations[${i}]`, 500),
  );

  const info: ModelInfo = {
    id: expectLabel(raw.id, "$.info.id"),
    version: expectString(raw.version, "$.info.version", 32),
    name: expectString(raw.name, "$.info.name", 120),
    signLanguage: oneOf(raw.signLanguage, "$.info.signLanguage", ["ISL", "ASL"] as const),
    // A trained model file may only claim to be a validated ISL model; the
    // other kinds are built into the app and never come from a file.
    kind: oneOf(raw.kind, "$.info.kind", ["validated_isl"] as const),
    input,
    scoreType: oneOf(raw.scoreType, "$.info.scoreType", ["calibrated_probability", "classifier_score"] as const),
    validated: expectBoolean(raw.validated, "$.info.validated"),
    classes,
    description: expectString(raw.description, "$.info.description", 2000, true),
    limitations,
  };
  return { info, labels: classes.map((c) => c.label) };
}

function parseStandardizer(value: unknown, inputDim: number): { mean: Float32Array; scale: Float32Array } | null {
  if (value === null) return null;
  const raw = expectObject(value, "$.standardizer", ["mean", "scale"]);
  const mean = expectFloatVector(raw.mean, "$.standardizer.mean", inputDim);
  const scale = expectFloatVector(raw.scale, "$.standardizer.scale", inputDim);
  for (let i = 0; i < scale.length; i++) {
    if (!(scale[i] > 0)) throw new ValidationError(`$.standardizer.scale[${i}]: must be greater than zero`);
  }
  return { mean, scale };
}

function parseMlp(value: unknown, inputDim: number, classCount: number): DenseLayer[] {
  const raw = expectObject(value, "$.mlp", ["layers"]);
  const rawLayers = expectArray(raw.layers, "$.mlp.layers", MAX_LAYERS);
  if (rawLayers.length === 0) throw new ValidationError("$.mlp.layers: at least one layer is required");

  let previous = inputDim;
  let totalWeights = 0;
  const layers: DenseLayer[] = rawLayers.map((entry, i) => {
    const path = `$.mlp.layers[${i}]`;
    const layer = expectObject(entry, path, ["W", "b", "activation"]);
    const isLast = i === rawLayers.length - 1;
    const activation = oneOf(layer.activation, `${path}.activation`, ["relu", "softmax"] as const);
    if (isLast && activation !== "softmax") throw new ValidationError(`${path}.activation: the last layer must be "softmax"`);
    if (!isLast && activation !== "relu") throw new ValidationError(`${path}.activation: hidden layers must be "relu"`);

    const rows = expectArray(layer.W, `${path}.W`, MAX_LAYER_UNITS);
    const outputSize = rows.length;
    if (outputSize === 0) throw new ValidationError(`${path}.W: a layer needs at least one unit`);
    totalWeights += outputSize * previous;
    if (totalWeights > MAX_TOTAL_WEIGHTS) throw new ValidationError("$.mlp: too many weights");

    const weights = new Float32Array(outputSize * previous);
    rows.forEach((row, r) => {
      weights.set(expectFloatVector(row, `${path}.W[${r}]`, previous), r * previous);
    });
    const bias = expectFloatVector(layer.b, `${path}.b`, outputSize);
    const parsed: DenseLayer = { inputSize: previous, outputSize, weights, bias, activation };
    previous = outputSize;
    return parsed;
  });

  if (previous !== classCount) {
    throw new ValidationError(`$.mlp: the last layer has ${previous} units but there are ${classCount} classes`);
  }
  return layers;
}

function parseKnn(value: unknown, inputDim: number, classIds: string[]): NonNullable<ParsedExportedModel["knn"]> {
  const raw = expectObject(value, "$.knn", ["k", "metric", "samples"]);
  const k = expectInteger(raw.k, "$.knn.k", 1, MAX_KNN_K);
  if (raw.metric !== "cosine") throw new ValidationError('$.knn.metric: only "cosine" is supported');
  const samples = expectArray(raw.samples, "$.knn.samples", MAX_KNN_SAMPLES);
  if (samples.length < k) throw new ValidationError("$.knn.samples: fewer samples than k");
  if (samples.length * inputDim > MAX_TOTAL_WEIGHTS * 2) throw new ValidationError("$.knn.samples: too many values");

  const classIndex = new Map<string, number>(classIds.map((id, i) => [id, i]));
  const matrix = new Float32Array(samples.length * inputDim);
  const rowClass = new Uint16Array(samples.length);
  samples.forEach((entry, row) => {
    const path = `$.knn.samples[${row}]`;
    const sample = expectObject(entry, path, ["label", "vector"]);
    const label = expectLabel(sample.label, `${path}.label`);
    const index = classIndex.get(label);
    if (index === undefined) throw new ValidationError(`${path}.label: "${label}" is not in $.classes`);
    const vector = expectFloatVector(sample.vector, `${path}.vector`, inputDim);
    const norm = l2Norm(vector);
    if (norm < 1e-12) throw new ValidationError(`${path}.vector: a zero vector has no direction for cosine distance`);
    for (let i = 0; i < inputDim; i++) matrix[row * inputDim + i] = vector[i] / norm;
    rowClass[row] = index;
  });
  return { k, sampleCount: samples.length, matrix, rowClass };
}

function parseEvaluation(value: unknown): ModelEvaluation | null {
  if (value === null) return null;
  const raw = expectObject(value, "$.evaluation", ["protocol", "metrics", "datasetId", "date"]);
  if (!isPlainObject(raw.metrics)) throw new ValidationError("$.evaluation.metrics: expected an object");
  const names = Object.keys(raw.metrics);
  if (names.length > 200) throw new ValidationError("$.evaluation.metrics: too many entries");
  const metrics: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const name of names) {
    expectLabel(name, "$.evaluation.metrics key");
    metrics[name] = expectFiniteNumber(raw.metrics[name], `$.evaluation.metrics.${name}`);
  }
  return {
    protocol: expectString(raw.protocol, "$.evaluation.protocol", 4000),
    metrics: Object.freeze(metrics),
    datasetId: expectString(raw.datasetId, "$.evaluation.datasetId", 120),
    date: expectString(raw.date, "$.evaluation.date", 40),
  };
}

/**
 * Validates an already parsed JSON value and converts it into typed arrays.
 * Throws ValidationError (or ModelLoadError "synthetic"); never returns a
 * partly valid model.
 */
export function validateExportedModel(value: unknown): ParsedExportedModel {
  if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "synthetic")) {
    throw new ModelLoadError(
      "This file is marked as a synthetic pipeline-test artefact. It was not trained on sign data and will not be loaded.",
      "synthetic",
    );
  }
  const root = expectObject(value, "$", TOP_LEVEL_KEYS);
  if (root.format !== EXPORTED_MODEL_FORMAT) {
    throw new ValidationError(`$.format: expected "${EXPORTED_MODEL_FORMAT}"`);
  }
  if (root.featureSchema !== FEATURE_SCHEMA_VERSION) {
    throw new ValidationError(`$.featureSchema: expected "${FEATURE_SCHEMA_VERSION}"`);
  }
  const type = oneOf(root.type, "$.type", ["mlp", "knn"] as const);
  if (root.inputDim !== SINGLE_FEATURE_DIM && root.inputDim !== DUAL_FEATURE_DIM) {
    throw new ValidationError(`$.inputDim: expected ${SINGLE_FEATURE_DIM} or ${DUAL_FEATURE_DIM}`);
  }
  const inputDim = root.inputDim;

  const classes = expectArray(root.classes, "$.classes", MAX_CLASS_COUNT).map((c, i) => expectLabel(c, `$.classes[${i}]`));
  if (classes.length < 2) throw new ValidationError("$.classes: a classifier needs at least two classes");
  if (new Set(classes).size !== classes.length) throw new ValidationError("$.classes: duplicate class id");

  const { info, labels } = parseInfo(root.info, classes, inputDim);
  const standardizer = parseStandardizer(root.standardizer ?? null, inputDim);
  const evaluation = parseEvaluation(root.evaluation ?? null);

  let layers: DenseLayer[] | null = null;
  let knn: ParsedExportedModel["knn"] = null;
  if (type === "mlp") {
    if (root.knn !== undefined && root.knn !== null) throw new ValidationError('$.knn: must be absent when type is "mlp"');
    layers = parseMlp(root.mlp, inputDim, classes.length);
  } else {
    if (root.mlp !== undefined && root.mlp !== null) throw new ValidationError('$.mlp: must be absent when type is "knn"');
    knn = parseKnn(root.knn, inputDim, classes);
  }

  // A file without an evaluation block is unvalidated whatever it claims, and a
  // score is only called a probability when an evaluation backs the model.
  const validated = info.validated && evaluation !== null;
  const honestInfo: ModelInfo = {
    ...info,
    validated,
    scoreType: evaluation === null ? "classifier_score" : info.scoreType,
  };

  return {
    info: honestInfo,
    type,
    inputDim,
    classes,
    labels,
    mean: standardizer?.mean ?? null,
    scale: standardizer?.scale ?? null,
    layers,
    knn,
    evaluation,
  };
}

/** Parses model JSON text: size cap, JSON.parse, prototype-key sweep, schema. */
export function parseExportedModelText(text: string): ParsedExportedModel {
  try {
    return validateExportedModel(parseJsonSafely(text, MAX_MODEL_BYTES, "The model file"));
  } catch (error) {
    if (error instanceof ModelLoadError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const tooLarge = /larger than/.test(message);
    throw new ModelLoadError(`The model file is not valid: ${message}`, tooLarge ? "too_large" : "invalid");
  }
}

/* ------------------------------------------------------------------ */
/* URL policy and fetching                                             */
/* ------------------------------------------------------------------ */

export type ModelUrlPolicy = {
  /** Origin of the page, e.g. window.location.origin. */
  pageOrigin: string;
  /** Places a model may come from. The path must start with pathPrefix. */
  allowed: { origin: string; pathPrefix: string }[];
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Same origin under /models/, plus the configured API origin when given. */
export function defaultModelUrlPolicy(pageOrigin: string, apiBaseUrl?: string): ModelUrlPolicy {
  const allowed = [{ origin: pageOrigin, pathPrefix: "/models/" }];
  if (apiBaseUrl) {
    try {
      const api = new URL(apiBaseUrl);
      const prefix = api.pathname.endsWith("/") ? api.pathname : `${api.pathname}/`;
      allowed.push({ origin: api.origin, pathPrefix: `${prefix}models/` });
    } catch {
      // An unparsable API URL simply adds nothing to the allow-list.
    }
  }
  return { pageOrigin, allowed };
}

/**
 * MOD-01: decides on the PARSED url (protocol, origin, path prefix), never on
 * a substring. Returns the absolute URL to fetch or throws ModelLoadError.
 */
export function resolveAllowedModelUrl(url: string, policy: ModelUrlPolicy): URL {
  let parsed: URL;
  try {
    parsed = new URL(url, policy.pageOrigin);
  } catch {
    throw new ModelLoadError("The model address is not a valid URL.", "blocked_url");
  }
  const isLocal = LOCAL_HOSTNAMES.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    throw new ModelLoadError("Model files must be loaded over https.", "blocked_url");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new ModelLoadError("Model addresses must not contain credentials.", "blocked_url");
  }
  const permitted = policy.allowed.some((entry) => {
    let origin: string;
    try {
      origin = new URL(entry.origin).origin;
    } catch {
      return false;
    }
    return parsed.origin === origin && parsed.pathname.startsWith(entry.pathPrefix);
  });
  if (!permitted) {
    throw new ModelLoadError("Model files can only be loaded from this site's own model folder.", "blocked_url");
  }
  return parsed;
}

async function readBodyWithCap(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ModelLoadError("The model file is larger than the 5 MB limit.", "too_large");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new ModelLoadError("The model file is larger than the 5 MB limit.", "too_large");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ModelLoadError("The model file is larger than the 5 MB limit.", "too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export type LoadExportedModelOptions = {
  policy: ModelUrlPolicy;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  signal?: AbortSignal;
};

/**
 * Fetches and validates a model file. Rejects with ModelLoadError:
 * "not_found" for 404/410 (the normal state today), "blocked_url", "network",
 * "http_error", "too_large", "invalid" or "synthetic".
 */
export async function loadExportedModel(url: string, options: LoadExportedModelOptions): Promise<ParsedExportedModel> {
  const target = resolveAllowedModelUrl(url, options.policy);
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new ModelLoadError("This browser cannot download model files.", "network");

  let response: Response;
  try {
    response = await doFetch(target.href, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      signal: options.signal,
    });
  } catch {
    throw new ModelLoadError("The model file could not be downloaded.", "network");
  }
  if (response.status === 404 || response.status === 410) {
    throw new ModelLoadError("No model file exists at this address.", "not_found");
  }
  if (!response.ok) {
    throw new ModelLoadError(`The model download failed (HTTP ${response.status}).`, "http_error");
  }
  const text = await readBodyWithCap(response, options.maxBytes ?? MAX_MODEL_BYTES);
  return parseExportedModelText(text);
}

/* ------------------------------------------------------------------ */
/* Inference                                                           */
/* ------------------------------------------------------------------ */

function standardize(model: ParsedExportedModel, vector: ArrayLike<number>): Float32Array {
  const out = new Float32Array(model.inputDim);
  if (model.mean && model.scale) {
    for (let i = 0; i < out.length; i++) out[i] = (vector[i] - model.mean[i]) / model.scale[i];
  } else {
    for (let i = 0; i < out.length; i++) out[i] = vector[i];
  }
  return out;
}

function forwardMlp(layers: DenseLayer[], input: Float32Array): Float32Array {
  let activations = input;
  for (const layer of layers) {
    const next = new Float32Array(layer.outputSize);
    for (let row = 0; row < layer.outputSize; row++) {
      let sum = layer.bias[row];
      const offset = row * layer.inputSize;
      for (let i = 0; i < layer.inputSize; i++) sum += layer.weights[offset + i] * activations[i];
      next[row] = sum;
    }
    if (layer.activation === "relu") {
      for (let i = 0; i < next.length; i++) if (next[i] < 0) next[i] = 0;
    } else {
      softmaxInto(next, next);
    }
    activations = next;
  }
  return activations;
}

function voteKnn(model: ParsedExportedModel, input: Float32Array): Float32Array {
  const knn = model.knn!;
  const dimension = model.inputDim;
  const norm = l2Norm(input);
  const scores = new Float32Array(model.classes.length);
  const k = knn.k;
  const topSimilarity = new Float64Array(k).fill(-Infinity);
  const topRow = new Int32Array(k).fill(-1);
  for (let row = 0; row < knn.sampleCount; row++) {
    let similarity = 0;
    const offset = row * dimension;
    for (let i = 0; i < dimension; i++) similarity += knn.matrix[offset + i] * input[i];
    similarity = norm > 1e-12 ? similarity / norm : 0;
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
  for (let i = 0; i < k; i++) if (topRow[i] >= 0) scores[knn.rowClass[topRow[i]]] += 1 / k;
  return scores;
}

/**
 * Per-class scores for one feature vector, in `model.classes` order.
 * MLP: softmax outputs. k-NN: share of the k neighbours.
 */
export function scoreWithExportedModel(model: ParsedExportedModel, vector: ArrayLike<number>): Float32Array {
  if (vector.length !== model.inputDim) {
    throw new Error(`Expected a ${model.inputDim}-D vector, received ${vector.length}-D`);
  }
  const input = standardize(model, vector);
  return model.type === "mlp" ? forwardMlp(model.layers!, input) : voteKnn(model, input);
}

/** Index of the highest score; the first one wins a tie. */
export function argmax(scores: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  return best;
}

export type ExportedSignModelOptions = {
  /** Best score below this gives "uncertain". Default 0.5. */
  minScore?: number;
  maxCandidates?: number;
};

/** Where an ExportedSignModel gets its weights from. */
export type ExportedModelSource =
  | { parsed: ParsedExportedModel }
  | ({ url: string; info: ModelInfo } & LoadExportedModelOptions);

export class ExportedSignModel implements SignModel {
  private model: ParsedExportedModel | null;
  private readonly placeholderInfo: ModelInfo | null;
  private readonly minScore: number;
  private readonly maxCandidates: number;

  constructor(
    private readonly source: ExportedModelSource,
    options: ExportedSignModelOptions = {},
  ) {
    this.model = "parsed" in source ? source.parsed : null;
    this.placeholderInfo = "parsed" in source ? null : source.info;
    this.minScore = options.minScore ?? 0.5;
    this.maxCandidates = options.maxCandidates ?? 3;
  }

  /** Before `load()` resolves this is the caller's placeholder description. */
  get info(): ModelInfo {
    return this.model?.info ?? this.placeholderInfo!;
  }

  get evaluation(): ModelEvaluation | null {
    return this.model?.evaluation ?? null;
  }

  /** Rejects with ModelLoadError; a failed load leaves no partial model behind. */
  async load(): Promise<void> {
    if (this.model || "parsed" in this.source) return;
    const { url, info: _info, ...options } = this.source;
    void _info;
    this.model = await loadExportedModel(url, options);
  }

  reset(): void {}

  dispose(): void {
    if (!("parsed" in this.source)) this.model = null;
  }

  predict(features: FrameFeatures): RecognitionResult {
    const info = this.info;
    const base = {
      modelId: info.id,
      modelVersion: info.version,
      signLanguage: info.signLanguage,
      timestamp: features.timestamp,
    } as const;
    const empty: Pick<RecognitionResult, "classId" | "label" | "score" | "scoreType" | "candidates"> = {
      classId: null,
      label: null,
      score: null,
      scoreType: null,
      candidates: [],
    };
    const unsupported = (reason: string): RecognitionResult => ({
      ...base,
      ...empty,
      status: "unsupported",
      handsUsed: 0,
      reason,
    });

    if (features.handCount === 0) return { ...base, ...empty, status: "no_hands", handsUsed: 0 };
    const model = this.model;
    if (!model) return unsupported("The model has not been loaded.");

    let vector: Float32Array | null;
    let handsUsed: 1 | 2;
    if (model.inputDim === SINGLE_FEATURE_DIM) {
      if (features.handCount !== 1) return unsupported(REASONS.exportedNeedsOneHand);
      vector = features.perHand[0]?.vector ?? null;
      handsUsed = 1;
    } else {
      if (features.handCount !== 2) return unsupported(REASONS.exportedNeedsTwoHands);
      vector = features.dual;
      handsUsed = 2;
    }
    if (!vector || !isFiniteVector(vector, model.inputDim)) return unsupported(REASONS.exportedBadVector);

    const scores = scoreWithExportedModel(model, vector);
    const order = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a] || a - b);
    const candidates: RecognitionCandidate[] = order.slice(0, this.maxCandidates).map((i) => ({
      classId: model.classes[i],
      label: model.labels[i],
      score: scores[i],
    }));
    const best = order[0];
    const recognized = scores[best] >= this.minScore;

    return {
      ...base,
      classId: recognized ? model.classes[best] : null,
      label: recognized ? model.labels[best] : null,
      status: recognized ? "recognized" : "uncertain",
      score: scores[best],
      scoreType: info.scoreType,
      handsUsed,
      candidates,
      ...(recognized ? {} : { reason: REASONS.exportedLowScore }),
    };
  }
}
