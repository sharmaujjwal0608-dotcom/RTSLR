# Recognition layer

Owner: Agent 06. Turns `FrameFeatures` (from `features/tracking`) into stabilised, committed signs.

**There is no validated ISL model.** What runs today:

| Model id | Kind | Language | What it is |
|---|---|---|---|
| `rtslr-isl-user-templates` | `experimental_isl_user_trained` | ISL | k-NN over samples the user records in this browser. Default. Not validated. |
| `rtslr-legacy-asl-rules` | `legacy_asl_prototype` | ASL | The prototype's hand-tuned A–Z rules. Not ISL. Not validated. |
| `rtslr-isl-static` | `validated_isl` | ISL | Slot for a trained, evaluated model. **No file exists**, so it reports "not available". |

Every model has `validated: false` and `scoreType: "classifier_score"`. Show `MODEL_KIND_LABELS[info.kind]` next to any result, and never word a score as a probability or an accuracy.

Import from `@/features/recognition`.

## `useRecognition`

```ts
function useRecognition(options: {
  subscribe: ((cb: (f: FrameFeatures) => void) => () => void) | null; // e.g. tracking's `onFrame`; keep its identity stable
  modelId: string;                       // one of MODEL_IDS
  settings?: {
    minScore?: number;                   // 0..1, default 0.75
    holdSeconds?: number;                // 0.5..2.5, default 1.2
    cooldownSeconds?: number;            // default 1
    repeatWhileHeld?: boolean;           // default false: a held pose commits once
  };
  onCommit?: (event: CommitEvent) => void; // exactly once per committed sign
  controllerOptions?: RecognitionControllerOptions; // tests: store, model factory, timings (read once)
}): {
  state: StabilizedState;                // ~10 Hz; immediate on commit or phase change
  modelStatus: "loading" | "ready" | "unavailable" | "error";
  modelMessage: string | null;           // why the requested model is unavailable / failed
  modelInfo: ModelInfo | null;           // the model actually running, with its live class list
  activeModelId: string | null;          // differs from modelId when the requested model could not load
  recording: RecordingState;
  startRecording: (classId: string, label: string, count: number) => void;
  cancelRecording: () => void;           // discards what was captured
  clearRecordingStatus: () => void;      // back to "idle" after done / cancelled / error
  reset: () => void;                     // clear votes, hold timer, model state
};
```

- `modelStatus: "unavailable"` is the normal answer for `rtslr-isl-static` today. It is a state to show, not an error screen. The previously active model keeps running (`activeModelId`).
- `state.phase`: `idle` → `candidate` → `holding` (`holdProgress` 0..1) → `committed` → `cooldown`. After a commit the phase stays `committed` while the same pose is held; the pose must be released before it can commit again (unless `repeatWhileHeld`).
- `state.latest` is the raw per-frame `RecognitionResult` (status, candidates, `reason`). `reason` values are the constants in `REASONS`; compare with `===` to translate.

### Recording samples

```ts
type RecordingState = {
  status: "idle" | "waiting" | "capturing" | "saving" | "done" | "cancelled" | "error";
  classId: string | null; label: string | null;
  hands: 1 | 2 | null;        // fixed by the class if it exists, else by the first steady frame
  captured: number; target: number; progress: number; // 0..1
  hint: "no_hands" | "hold_still" | "show_one_hand" | "show_two_hands" | null;
  errorCode: "invalid_label" | "invalid_count" | "busy" | "class_full" | "storage_full"
           | "hand_count_mismatch" | "invalid_sample" | "storage_failed" | null;
  errorMessage: string | null;
};
```

`startRecording(classId, label, count)` captures `count` (1–200) vectors from live frames, only while every tracked hand has `motion.isStill`, at most one per 80 ms. One hand records the 63-D vector; two hands record the 156-D coordinated vector. Nothing is stored until all samples are captured. The app does not know whether what the user records is correct ISL: say so in the recording UI.

## `registry`

```ts
const MODEL_IDS: { validatedIsl: "rtslr-isl-static"; islUser: "rtslr-isl-user-templates"; legacyAsl: "rtslr-legacy-asl-rules" };
const MODEL_KIND_LABELS: Record<ModelKind, string>;       // honest badge text (English)
const NO_VALIDATED_ISL_MODEL: string;                     // the sentence to show

function listModels(probe?: ValidatedIslProbe | null): RegistryEntry[];
// RegistryEntry = { id, info, kindLabel, availability: "available" | "not_available", unavailableReason, isDefault }

function selectDefaultModelId(validatedIslAvailable: boolean): RegisteredModelId; // false → islUser; never legacyAsl
function probeValidatedIslModel(deps?): Promise<ValidatedIslProbe>;               // never throws
function resolveDefaultModel(deps?): Promise<{ modelId; probe; models: RegistryEntry[] }>;
function createModel(id: string, deps?: { store?; knn?; validatedIsl? }): SignModel; // call load() before predict()
function isRegisteredModelId(id: string): id is RegisteredModelId;
```

Typical start-up: `const { modelId, models } = await resolveDefaultModel()` in an effect, render `models` as the model picker (disable `not_available` entries and show `unavailableReason`), pass `modelId` to `useRecognition`.

The validated slot looks for `/models/isl/static-one-hand.json` (63-D) and `/models/isl/static-two-hand.json` (156-D). A file is accepted only if it passes validation, carries an `evaluation` block and has `validated: true`. Publishing such a file is a manual, reviewed step (see `machine-learning/README.md`).

## `sampleStore`

```ts
const SAMPLE_DB_NAME = "rtslr-samples";
const RECOGNITION_STORAGE_NAMES: { indexedDbDatabases: ["rtslr-samples"]; localStorageKeys: []; sessionStorageKeys: []; cacheStorageNames: [] };
const MAX_SAMPLES_PER_CLASS = 200; const MAX_TOTAL_SAMPLE_BYTES = 20 MB;

function getSampleStore(): SampleStore;           // shared instance: IndexedDB, memory fallback
function deleteSampleDatabase(): Promise<"deleted" | "blocked" | "unavailable">;

class SampleStore {
  constructor(backend?: SampleBackend, now?: () => number);
  readonly persistent: boolean;                   // false = memory fallback, lost on reload
  readonly invalidRecordCount: number;            // stored records that failed validation (ignored, not deleted)
  readonly version: number;
  ready(): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly StoredSample[];
  list(classId?: string): Promise<StoredSample[]>;
  summary(): Promise<{ classId; label; hands: 1 | 2; count }[]>;
  count(classId?: string): Promise<number>;
  addSamples(samples: NewSample[]): Promise<StoredSample[]>;   // all or nothing
  addSample(sample: NewSample): Promise<StoredSample>;
  removeSample(id: string): Promise<boolean>;
  removeClass(classId: string): Promise<number>;
  clearAll(): Promise<void>;
  exportJson(): Promise<string>;                                // format "rtslr-samples-1"
  importJson(text: string, mode?: "merge" | "replace"): Promise<{ classes; samples }>; // validated first; all or nothing
  close(): void;
}
```

A sample is `{ id, classId, label, hands, vector: Float32Array, createdAt }`: numbers derived from landmarks, never pixels. A class has one hand count; mixing is refused.

**Delete-all control:** `getSampleStore().close()`, then `deleteSampleDatabase()` (or delete every name in `RECOGNITION_STORAGE_NAMES.indexedDbDatabases`). `"blocked"` means another tab holds the database open.

## Other exports

- `Stabilizer`, `stepStabilizer`, `normalizeStabilizerConfig`, `DEFAULT_STABILIZER_CONFIG` — the pure, time-injected state machine (window 8, min votes 4, hold 1200 ms, cooldown 1000 ms, release 300 ms).
- `RecognitionController` — the non-React core of the hook (`subscribe`, `getSnapshot`, `handleFrame`, `setModel`, `setSettings`, recording methods).
- `LegacyAslModel`, `IslUserTemplatesModel`, `ExportedSignModel`, `ValidatedIslModel`.
- `loadExportedModel`, `parseExportedModelText`, `validateExportedModel`, `scoreWithExportedModel`, `resolveAllowedModelUrl`, `defaultModelUrlPolicy`, `ModelLoadError`.

## Decisions worth knowing

- **Two hands are one input.** A two-hand class is matched only from `features.dual` when exactly two hands are tracked; a one-hand class only from the 63-D vector when exactly one is tracked. Two one-hand results are never combined.
- **Unknown poses are rejected.** The k-NN gives `uncertain` when the nearest sample is further than the class's acceptance radius (`spreadFactor ×` the class's own spread, clamped to cosine distance 0.02–0.08) or when no class wins half the vote. These defaults are untuned: no data exists to tune them on.
- **`rtslr-model-1` conventions** (fixed here and in `machine-learning/exports/export_model.py`): `W` has one row per output unit; hidden layers `relu`, last layer `softmax`; `standardizer` applied first (`null` = identity); k-NN sample vectors are already standardised, uniform vote, ties to the earlier class. Input dimension is 63 or 156.
- **Model-file safety:** same-origin `/models/` only (checked on the parsed URL), `credentials: "omit"`, `redirect: "error"`, 5 MB cap before and during download, `JSON.parse` only, strict schema with unknown keys rejected, finite numbers, prototype keys rejected, weights in typed arrays. A file with a top-level `synthetic` key is refused. Validation is hand-written rather than zod, because zod is not a declared dependency of this package.
- **Legacy ASL port:** x is aspect-corrected before the rules run (the prototype did not), so results can differ from the old page on non-square video. A closed fist can score highest as "P"; this weakness comes from the original rules and is listed in the model's limitations.

## Tests

```
npx vitest run src/features/recognition
```

`exportedModel.test.ts` also reads `machine-learning/tests/fixtures/browser-parity.synthetic.json` (two models trained on random clusters) and checks that this implementation reproduces scikit-learn's scores; it is skipped if that file is absent.
