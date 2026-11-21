# RTSLR machine-learning pipeline

Owner: Agent 06.

## Status, exactly

- **No ISL dataset is on this machine. No ISL model has been trained. No metric exists.**
- The static-sign pipeline below is implemented and tested end to end on **synthetic** data (random clusters with fake signer ids, generated inside the test suite). That proves the code path. It says nothing about sign language recognition.
- Two stages are written but **have not been executed**, because their dependencies are not installed and there is nothing to run them on:
  - `preprocessing/extract_landmarks.py` (needs `mediapipe`, `opencv-python`)
  - `training/train_sequence.py` (needs `torch`; dynamic signs)

## Workflow

```
authorised dataset
  → manifest gate (licence + consent)        rtslr_ml/dataset.py
  → landmark extraction                      preprocessing/extract_landmarks.py   [not executed]
  → inspection                               rtslr_ml/dataset.py: inspect_dataset
  → cleaning + label validation              rtslr_ml/dataset.py: clean_dataset, validate_labels
  → feature engineering (63-D / 156-D)       rtslr_ml/features.py
  → signer-aware split                       rtslr_ml/splits.py
  → training + selection on validation signers   training/train_static.py
  → evaluation on unseen test signers        evaluation/evaluate.py
  → export to rtslr-model-1                  exports/export_model.py
  → inference parity (export vs scikit-learn)    inference/reference.py
  → regression tests                         tests/
```

## Setup

Python 3.12 virtual environment at `machine-learning/.venv` with the packages in `requirements.txt` (NumPy, SciPy, scikit-learn, pytest). Run every command from `machine-learning/`:

```
.venv\Scripts\python.exe -m pytest
```

## Running each stage

### 0. Manifest (required before anything else)

Copy `data/manifest.template.json`, fill in every field, and keep it next to the dataset. Training and extraction refuse to start while any of these is missing or false: licence name and terms, `licence.permits_model_training`, `consent.obtained`, `consent.covers_model_training`, a withdrawal contact, anonymous signer ids, the signer count, who verified the labels, and the class inventory (`label`, `hands` 1 or 2, `motion` static or dynamic).

The class inventory must come from a fluent ISL signer or an ISL authority. This project has not confirmed which ISL letters are one-handed, two-handed or need movement (docs/RESEARCH_NOTES.md, assumptions A1 and A2).

### 1. Landmark extraction — not executed

```
pip install -r requirements-extract.txt        (separate environment; not installed here)
python -m preprocessing.extract_landmarks --index data/index.csv --media-root D:\isl-raw ^
    --manifest data/isl.manifest.json --hand-model models\hand_landmarker.task ^
    --out data/isl.npz --every-nth-frame 5
```

Writes the landmark `.npz` and an extraction report with the hand-detection rate per class. Use the same `hand_landmarker.task` version as the browser. Known train/serve differences to measure once real data exists: the browser smooths landmarks and runs MediaPipe in video mode; this script uses image mode on raw frames.

If the dataset already comes as landmarks, skip this stage and write the `.npz` or `.csv` directly (format in `rtslr_ml/dataset.py`).

### 2–8. Inspect, clean, split, train, evaluate, export

One command runs all of it for one hand count:

```
python -m training.train_static --dataset data/isl.npz --manifest data/isl.manifest.json ^
    --hands 2 --out runs/isl-two-hand-v1 --seed 0 ^
    --n-val-signers 2 --n-test-signers 3 --cv-folds 5
```

- `--hands 1` trains on 63-D single-hand vectors; `--hands 2` on the 156-D coordinated two-hand vector. Two-hand signs are learned as a whole and are never assembled from two one-hand predictions. Train one model per hand count.
- Candidates: k-NN (cosine), MLP, RBF SVM, Random Forest, each a `StandardScaler` pipeline with fixed seeds. The grids in `CANDIDATE_GRID` are small starting points, not tuned values.
- Split: whole signers are held out for validation and for test. A random split is refused when signer ids exist. `--allow-random-split` overrides this; the report then says "NOT signer-independent" and the model can never be marked validated.
- Selection uses validation signers only. Test signers are scored once, after selection.
- Output in the run directory: `report.json`, `report.md` (protocol, cleaning log, candidate table, accuracy, macro-F1, per-class precision/recall, confusion matrix, per-signer and one-hand/two-hand breakdowns, optional grouped cross-validation), `split.json`, `model.joblib` (selected), `exportable.joblib` and `browser-model.json` (best MLP or k-NN, when export is allowed), and the parity result.

Re-evaluate or re-export a finished run:

```
python -m evaluation.evaluate --run runs/isl-two-hand-v1 --dataset data/isl.npz --manifest data/isl.manifest.json
python -m exports.export_model --run runs/isl-two-hand-v1 --out runs/isl-two-hand-v1/browser-model.json --mark-validated
python -m inference.reference --model runs/isl-two-hand-v1/browser-model.json --features vectors.npy
```

### Dynamic signs — specified, not executed

`training/train_sequence.py` holds the design (GRU and temporal-CNN over feature windows), the dataset format and a training loop. It has never run. `rtslr-model-1` has no layer types for it and the browser has no adapter; both need a contract change first.

## When is a model "validated"?

`exports/export_model.py: validation_decision` requires all of:

1. real data (manifest `synthetic: false`) with a complete manifest;
2. a signer-independent protocol;
3. at least `--min-test-signers` unseen test signers (default 3; this is a policy floor, not a scientific threshold — set the real bar in the model card);
4. an explicit `--mark-validated` from the person responsible, after the model card is filled in and reviewed.

Only then is `browser-model.json` written with `kind: "validated_isl"`, `validated: true` and an `evaluation` block. A real-data model that does not meet the policy is **not exported**: the shared contract has no model kind for "trained but unvalidated", and the browser would have to mislabel it.

Scores are always exported as `classifier_score`. Calibration is not measured by this pipeline, so nothing may be shown as a probability.

## Synthetic artefacts

Anything produced from a manifest with `synthetic: true` carries `"synthetic": true` (reports, split file, model file) and a banner in Markdown. `rtslr_ml/guards.py` refuses to write any pipeline artefact inside `frontend/`, `research/`, `backend/` or `docs/`. The browser loader refuses any model file with a top-level `synthetic` key. Synthetic numbers must never be copied into `research/data/rtslr-experiments.json`.

`tests/fixtures/browser-parity.synthetic.json` is the one committed synthetic artefact: two tiny models on random clusters, used only to check that the browser's forward pass matches scikit-learn. Regenerate it with `python -m tests.make_browser_parity_fixture`.

## Publishing a model (manual, reviewed)

1. Fill in `MODEL_CARD_TEMPLATE.md` for the run and have it reviewed, including by a fluent ISL signer.
2. Copy `browser-model.json` to `frontend/public/models/isl/static-one-hand.json` or `static-two-hand.json` by hand. The pipeline will not do this.
3. Add the experiment to `research/data/rtslr-experiments.json` with the protocol and signer counts from `report.json`.
4. The app then lists the validated model as available and selects it by default; until then it says no validated ISL model is available.

## What the first real model needs

1. An **authorised** ISL dataset of static signs with consent that covers model training, and a licence that allows distributing the trained model. None of the datasets in `research/data/datasets.json` is used by RTSLR today; the word-level ones (INCLUDE, CISLR, iSign) are dynamic video and do not cover a static alphabet.
2. **Anonymous signer ids and session ids** on every sample, from enough signers to hold out at least three for test and one or two for validation, ideally including left-handed signers and more than one region.
3. A **class inventory verified by a fluent ISL signer**: label, one or two hands, static or dynamic.
4. Raw media plus `mediapipe`/`opencv-python` in a separate environment to run extraction, or landmarks already in this project's format, in the unmirrored camera frame with image sizes.
5. One training run per hand count, the detection-rate report from extraction next to the accuracy figures, a completed and reviewed model card, and `--mark-validated`.

## Feature parity

`rtslr_ml/features.py` must equal `frontend/src/features/tracking/features.ts`. `tests/test_features.py` reads `frontend/src/features/tracking/__fixtures__/feature-parity.json` and asserts equality to 1e-5; it is skipped with a clear message if that file is missing.

## Layout

```
rtslr_ml/        features.py  dataset.py  splits.py  guards.py
preprocessing/   extract_landmarks.py            (not executed)
training/        train_static.py  train_sequence.py (not executed)
evaluation/      evaluate.py
exports/         export_model.py
inference/       reference.py
tests/           synthetic.py + pytest suite + fixtures/
data/            manifest.template.json (datasets are never committed)
runs/            run outputs (ignored)
```
