/**
 * Public API of the recognition layer. See README.md in this folder.
 */

export { useRecognition } from "./useRecognition";
export type { UseRecognitionOptions, UseRecognitionResult } from "./useRecognition";

export { RecognitionController, INITIAL_RECOGNITION_SNAPSHOT } from "./controller";
export type {
  FrameSubscribe,
  ModelLoadStatus,
  RecognitionControllerOptions,
  RecognitionSettings,
  RecognitionSnapshot,
  RecordingErrorCode,
  RecordingHint,
  RecordingState,
  RecordingStatus,
} from "./controller";

export {
  MODEL_IDS,
  MODEL_KIND_LABELS,
  NO_VALIDATED_ISL_MODEL,
  createModel,
  isRegisteredModelId,
  listModels,
  probeValidatedIslModel,
  resolveDefaultModel,
  selectDefaultModelId,
} from "./registry";
export type {
  DefaultModelResolution,
  ModelAvailability,
  ModelFactoryDeps,
  RegisteredModelId,
  RegistryEntry,
  ValidatedIslProbe,
} from "./registry";

export {
  MAX_SAMPLES_PER_CLASS,
  MAX_TOTAL_SAMPLE_BYTES,
  MemorySampleBackend,
  RECOGNITION_STORAGE_NAMES,
  SAMPLE_DB_NAME,
  SAMPLE_EXPORT_FORMAT,
  SampleStore,
  SampleStoreError,
  deleteSampleDatabase,
  estimateSampleBytes,
  getSampleStore,
  parseSamplesFile,
  summariseSamples,
} from "./sampleStore";
export type {
  ClassSummary,
  ImportMode,
  ImportResult,
  NewSample,
  SampleBackend,
  SampleHands,
  StoredSample,
} from "./sampleStore";

export {
  DEFAULT_STABILIZER_CONFIG,
  HOLD_MS_MAX,
  HOLD_MS_MIN,
  IDLE_STATE,
  Stabilizer,
  initialStabilizerMemory,
  normalizeStabilizerConfig,
  stepStabilizer,
} from "./stabilizer";
export type { StabilizerConfig, StabilizerMemory, StabilizerStep } from "./stabilizer";

export { LEGACY_ASL_INFO, LEGACY_ASL_MODEL_ID, LegacyAslModel } from "./models/legacyAsl";
export {
  DEFAULT_KNN_OPTIONS,
  ISL_USER_INFO,
  ISL_USER_MODEL_ID,
  IslUserTemplatesModel,
} from "./models/islUserTemplates";
export type { KnnOptions } from "./models/islUserTemplates";
export {
  EXPORTED_MODEL_FORMAT,
  ExportedSignModel,
  ModelLoadError,
  defaultModelUrlPolicy,
  loadExportedModel,
  parseExportedModelText,
  resolveAllowedModelUrl,
  scoreWithExportedModel,
  validateExportedModel,
} from "./models/exportedModel";
export type { ModelEvaluation, ModelLoadErrorCode, ModelUrlPolicy, ParsedExportedModel } from "./models/exportedModel";
export {
  VALIDATED_ISL_MODEL_ID,
  VALIDATED_ISL_MODEL_URLS,
  VALIDATED_ISL_PLACEHOLDER_INFO,
  ValidatedIslModel,
} from "./models/validatedIsl";

export { REASONS } from "./reasons";
export type { ReasonKey } from "./reasons";
export { ValidationError } from "./safeJson";
