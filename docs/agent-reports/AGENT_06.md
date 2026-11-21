# AGENT 06 report

```
AGENT: 06 — Machine Learning and ISL Model Engineer

ASSIGNED TASK:
  (A) Browser recognition layer in frontend/src/features/recognition: honest model kinds (legacy ASL
      rules, experimental ISL trained by the user with a coordinated two-hand path, loader for exported
      rtslr-model-1 files), sample storage, temporal stabiliser, registry, useRecognition hook, tests.
  (B) Python pipeline in machine-learning: dataset format and manifest gate, inspection, cleaning,
      feature engineering, signer-aware splitting, training, evaluation, export, inference parity,
      regression tests on synthetic data only.

OWNED FILES:
  frontend/src/features/recognition/**
  machine-learning/** (except .venv)
  docs/agent-reports/AGENT_06.md

DEPENDENCIES:
  Contracts (read-only): frontend/src/types/recognition.ts, docs/MODEL_CONTRACTS.md,
  docs/SECURITY_PRIVACY.md (MOD-01..13, LOC-01..10).
  Agent 05: FrameFeatures type and frontend/src/features/tracking/__fixtures__/feature-parity.json
  (read by the Python parity test); frontend/vitest.config.ts (used as is). No code is imported from
  the tracking folder.
  No package was added. zod is present only as a transitive dependency, so validation is hand-written.

IMPLEMENTED FEATURES:
  Browser
  - legacyAsl.ts: A–Z geometric rules ported as readable functions (fingerState, MotionTrail,
    describeHand, 26 weighted rule lists). kind legacy_asl_prototype, ASL, classifier_score,
    validated false. One hand only; with two hands it classifies slot 0 and says so in `reason`.
    J/Z trail heuristics kept and listed as weak.
  - islUserTemplates.ts: k-NN (cosine, k configurable) over user samples. One-hand classes use the
    63-D vector and only when one hand is tracked; two-hand classes use the 156-D dual vector and only
    when two hands are tracked. The sets never mix. No samples -> "unsupported" with a reason.
    Rejection: nearest sample beyond the class's acceptance radius, or no class with half the vote,
    gives "uncertain".
  - exportedModel.ts: rtslr-model-1 loader and inference (MLP forward pass, cosine k-NN) with URL
    allow-list on the parsed URL, credentials "omit", redirect "error", 5 MB cap before and during
    download, JSON.parse only, strict schema, finite-number and shape checks, prototype-key rejection,
    typed arrays. evaluation: null forces validated false. A top-level "synthetic" key is refused.
  - validatedIsl.ts: slot for a validated model (one-hand and two-hand files, routed by hand count).
    No file exists; load() rejects with "not_found" and the message "No validated ISL model is
    available...".
  - sampleStore.ts: IndexedDB "rtslr-samples" with in-memory fallback (no localStorage); add / remove /
    list / summary / per-class hand count / caps (200 per class, 20 MB) / validated export and import /
    clear all; records re-validated on read; storage names exported for the delete-all control.
  - stabilizer.ts: pure, time-injected state machine (vote window 8, min votes 4, hold timer with
    progress, single CommitEvent, cooldown, latch until release, optional repeat while held, grace for
    short uncertain gaps, stall protection).
  - registry.ts: model list with honest labels, factory, default = validated ISL if a validated file
    exists, otherwise experimental ISL; the ASL prototype is never the default.
  - controller.ts + useRecognition.ts: per-frame path outside React, snapshots at about 10 Hz,
    onCommit, model load status (loading / ready / unavailable / error; a failed load leaves the
    previous model running), sample recording from steady frames only.
  Python
  - rtslr_ml/features.py (63-D, 156-D), dataset.py (.npz / CSV format, manifest gate, label
    validation, inspection, cleaning), splits.py (signer hold-out, grouped k-fold, leave-one-signer-
    out, random split refused unless overridden), guards.py (synthetic flag and protected folders).
  - training/train_static.py (k-NN, SVM, Random Forest, MLP; CLI; selection on validation signers;
    fixed seeds), evaluation/evaluate.py (accuracy, macro-F1, per-class, confusion matrix, per-signer,
    one-hand vs two-hand, JSON + Markdown with protocol), exports/export_model.py (rtslr-model-1,
    validation policy), inference/reference.py (NumPy forward pass from the exported JSON).
  - preprocessing/extract_landmarks.py and training/train_sequence.py: written, guarded imports,
    NOT EXECUTED.
  - README.md, MODEL_CARD_TEMPLATE.md, data/manifest.template.json, requirements*.txt.

FILES CREATED OR MODIFIED:
  frontend/src/features/recognition/: index.ts, useRecognition.ts, controller.ts, registry.ts,
    sampleStore.ts, stabilizer.ts, safeJson.ts, vectorMath.ts, reasons.ts, README.md,
    models/{legacyAsl,islUserTemplates,exportedModel,validatedIsl}.ts,
    __tests__/{stabilizer,islUserTemplates,exportedModel,sampleStore,legacyAsl,registry,controller,
    useRecognition}.test.ts, __tests__/testUtils.ts
  machine-learning/: README.md, MODEL_CARD_TEMPLATE.md, pytest.ini, .gitignore, requirements.txt,
    requirements-extract.txt, requirements-sequence.txt, data/{README.md,manifest.template.json},
    rtslr_ml/{__init__,features,dataset,splits,guards}.py, preprocessing/extract_landmarks.py,
    training/{train_static,train_sequence}.py, evaluation/evaluate.py, exports/export_model.py,
    inference/reference.py, tests/{conftest,synthetic,make_browser_parity_fixture,test_features,
    test_dataset,test_splits,test_pipeline_end_to_end,test_export_and_reference,
    test_not_executed_stages}.py, tests/fixtures/browser-parity.synthetic.json
  docs/agent-reports/AGENT_06.md
  Nothing outside these paths was created or edited.

TESTS RUN:
  1. frontend: npx vitest run src/features/recognition
  2. frontend: npx tsc --noEmit -p .   (filtered to features/recognition)
  3. frontend: npx eslint src/features/recognition
  4. machine-learning: .venv\Scripts\python.exe -m pytest
  5. machine-learning: CLI smoke runs in a scratch directory outside the repository
     (train_static on synthetic data; train_static with the unfilled manifest template;
     train_static with --out inside frontend/public; train_sequence; extract_landmarks).
  NOT RUN: next build, next dev, Playwright, any browser session with a camera, landmark
  extraction, sequence training, anything on real sign data.

TEST RESULTS:
  1. Vitest: "Test Files 8 passed (8)  Tests 193 passed (193)". Includes the cross-language check
     that the browser MLP and k-NN reproduce scikit-learn's scores for the synthetic fixture models.
  2. tsc: 0 errors in features/recognition.
  3. eslint: exit 0, no findings.
  4. pytest: "81 passed in 8.62s" (0 skipped). Includes the feature-parity test against Agent 05's
     fixture (9 cases: 12 single-hand vectors, 4 dual vectors, tolerance 1e-5) and the end-to-end
     static pipeline for one-hand and two-hand models.
  5. Smoke runs: synthetic run exit 0, "export parity passed: True", "validated: False";
     template manifest exit 2 listing 15 unfilled fields; output inside frontend/public refused,
     exit 2, nothing written; train_sequence and extract_landmarks exit 3 with the
     missing-dependency message.
  Every number produced by the synthetic runs describes random clusters and is not a recognition
  result. None was written to research/data/rtslr-experiments.json (still []) or frontend/public.

KNOWN LIMITATIONS:
  - No ISL dataset, no trained ISL model, no accuracy, latency or user figure of any kind.
  - Nothing here was exercised with a real camera or real hands. The k-NN acceptance radius
    (cosine distance 0.02–0.08), vote share 0.5, stabiliser release 300 ms and capture interval 80 ms
    are untuned defaults.
  - The stabiliser's 300 ms release window assumes at least about 4 frames per second; below that a
    hold never completes.
  - Legacy ASL port: x is aspect-corrected before the rules (contract §1), so behaviour can differ
    from the old page on non-square video. A closed fist scores highest as "P" (inherited rule
    weakness, covered by a test and listed in the model's limitations). I/Y tie on some poses.
  - IndexedDB code paths are covered only through the in-memory backend in tests (no fake IndexedDB
    package is installed); the real IndexedDB backend has not been run in a browser.
  - extract_landmarks.py and train_sequence.py have never been executed. Sequence models have no
    export format and no browser adapter.
  - Extraction uses MediaPipe image mode on raw frames; the browser uses smoothed landmarks in video
    mode. This train/serve difference is unmeasured.
  - A real-data model that fails the validation policy is not exported for the browser, because the
    ModelKind contract has no "trained but unvalidated" kind.
  - MOD-09 in SECURITY_PRIVACY.md names vector dimensions "63 or 126"; MODEL_CONTRACTS.md and the
    types say 63 and 156. The code follows the model contract (63 / 156).
  - MOD-07 (SHA-256 pinning) is not implemented for JSON models; it is specified for the hand model.

INTEGRATION NOTES:
  - Studio UI (Agent 01): import from "@/features/recognition". Pass the tracking hook's `onFrame`
    as `subscribe` (stable identity). Call resolveDefaultModel() once to get the default model id and
    the list for the picker. Treat modelStatus "unavailable" as a normal state and show modelMessage.
    Always show MODEL_KIND_LABELS[modelInfo.kind]; never show a score as a probability or accuracy.
  - Strings are English (ModelInfo text, REASONS, kind labels, recording errors). REASONS values and
    RecordingState.hint / errorCode are stable keys for Hindi translation in the UI layer.
  - Recording UI must tell the user the app cannot check whether a recorded sign is correct ISL, and
    should disable "record" while recording.status is waiting / capturing / saving.
  - "Your data" page and delete-all control: use getSampleStore().summary(), estimateSampleBytes(),
    invalidRecordCount (LOC-09: offer export or delete when > 0), exportJson(), importJson(), then
    getSampleStore().close() and deleteSampleDatabase(); names are in RECOGNITION_STORAGE_NAMES.
    `persistent === false` means samples live in memory only and the UI should say so.
  - Import UI: cap the file at 5 MB before reading it; importJson re-checks.
  - CSP / hosting: validated models are fetched same-origin from /models/isl/static-one-hand.json and
    /models/isl/static-two-hand.json. Today both return 404, which is expected (two 404 requests are
    made when the probe runs).
  - Research pages (Agent 07): rtslr-experiments.json must stay empty until a real run exists. The
    report.json of a real run has the protocol and signer counts to copy.
  - Orchestrator: consider a ModelKind for "trained, not validated", and a format version for
    sequence models, before either is needed.

STATUS: TESTED
```
