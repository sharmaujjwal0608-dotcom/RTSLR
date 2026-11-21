# RTSLR Experiment Specifications

Owner: Agent 07. Written 2026-11-21.

**These are plans. None of these experiments has been run and there are no RTSLR results.** `research/data/rtslr-experiments.json` is `[]` and stays empty until an experiment is actually executed and its artefacts are saved.

Background and reference IDs are in `docs/RESEARCH_NOTES.md`.

## Common rules for all experiments

**Data unit.** One sample is one frame's landmark output, stored with:

`sampleId, signerId (anonymous), sessionId, recordingId, signLabel, handsExpected (1|2), handsDetected, handedness[], landmarks[], imageWidth, imageHeight, mirrored (bool), device, featureVersion, mediapipeVersion`

No raw video is stored. Signers give informed consent and can withdraw their data.

**Splitting.**

1. Split by `signerId` before anything else.
2. Never put frames from one `recordingId` on both sides of a split.
3. Augment only training data, after splitting.
4. Fix and record random seeds.

**Metrics.**

- Top-1 accuracy and macro-F1 on held-out signers, as mean and standard deviation across folds, plus the worst signer.
- Per-class precision, recall, F1 and a confusion matrix.
- Coverage: share of frames with a prediction (hands detected and classifier not abstaining). Accuracy is reported both on covered frames and over all frames (missing frames counted as errors).
- The same metrics on a random stratified split, labelled "signer-dependent", for comparison only.

**Reporting.** Every reported number states: dataset version, number of signers, number of samples, protocol, feature version, seed. With fewer than 5 signers, results are labelled "pilot" and are not used as headline claims.

**Recording a result.** After a run, add one entry to `rtslr-experiments.json` with the experiment ID, date, commit, dataset version, protocol, metrics and a link to the saved artefacts. No entry without artefacts.

Record schema (added in the second pass; validated by `frontend/src/content/research/guards.ts`, which rejects the whole file if a record does not match):

```json
{
  "id": "run-2027-01-15-exp-002-a",
  "experimentId": "EXP-002",
  "title": "Short description of the run",
  "date": "2027-01-15",
  "commit": "git commit hash of the code that produced the result",
  "datasetVersion": "name and version of the dataset",
  "signers": 12,
  "samples": 18400,
  "protocol": "for example: leave-one-signer-out",
  "featureVersion": "rtslr-features-1",
  "seed": 1234,
  "metrics": [{ "name": "Top-1 accuracy, held-out signers", "value": 0, "unit": "%", "spread": null }],
  "artefactsUrl": "https://… or a repository path to the saved artefacts",
  "notes": "optional"
}
```

`value` is a number; `spread` is the standard deviation across folds or `null`; `unit` may be an empty string. The R&D page labels a record "pilot" when `signers` is below 5. The values above only illustrate the shape: they are not results.

**Feature vector note (second pass).** The application implements `rtslr-features-1` (63-D per hand, 156-D coordinated two-hand vector, `docs/MODEL_CONTRACTS.md`), not the 158-value `dualhand-v1` proposal named below. Experiments must state which of the two they used in `featureVersion`; EXP-004 should include `rtslr-features-1` as a variant.

**Prerequisites for all experiments.** A sign inventory reviewed by a fluent ISL signer (roadmap rm-03), collected data (rm-04) and the tested feature extractor (rm-05).

---

## EXP-001: Two-hand detection feasibility

**Question.** For each ISL letter and digit, how often does MediaPipe Hand Landmarker return the number of hands the sign needs?

**Why first.** A classifier cannot recognise a sign whose hands are not detected. One published ISL system reported letter-level detection rates as low as 79.6% (`ref-kulkarni-2026-isl-rf`). If detection fails on touching or overlapping hands, the feature design must change before training anything.

**Setup.** `numHands = 2`, default confidence thresholds (0.5), `VIDEO` mode in the browser. Each signer holds each sign for a few seconds in at least two sessions (different lighting or background).

**Measure.**

- Per sign: share of frames with `handsDetected == handsExpected`, with fewer, and with more.
- Handedness label stability: share of frames where the two hands receive the same label or the labels swap within a hold.
- Landmark jitter: frame-to-frame standard deviation of normalised landmarks during a hold.
- Repeat with detection and presence thresholds at 0.3 and 0.7.

**Output.** A per-sign table and a list of signs flagged as detection-limited.

**Decision rule.** Signs below a detection rate agreed before the run are marked "detection-limited" and reported separately in later experiments rather than silently dropped. The threshold is set by the team before data is seen; this spec does not assume a value.

---

## EXP-002: Static classifier baselines with dual-hand features

**Question.** How well do k-NN and a small MLP classify static ISL letters and digits from the `dualhand-v1` feature vector on signers never seen in training?

**Classes.** The reviewed static inventory (letters without required motion, digits), plus a "none / transition" class built from frames between signs and idle hands.

**Features.** `dualhand-v1` as defined in RESEARCH_NOTES.md section 4 (158 values).

**Models.**

| Model | Settings to search (on validation signers only) |
|---|---|
| k-NN | k in {1, 3, 5, 7}; cosine and Euclidean distance; features standardised on training data |
| MLP | 1-2 hidden layers, 64-256 units, dropout, early stopping |
| Random Forest | Offline reference baseline only, matching published work |

**Protocol.** Leave-one-signer-out when there are fewer than about 10 signers, otherwise grouped 5-fold by signer. Hyperparameters are chosen on validation signers inside the training fold, never on the test signer.

**Training-only augmentation.** Horizontal mirroring, small in-plane rotation, scale, landmark jitter.

**Report.** All common metrics, per-class results, the top confused pairs, and results split into one-handed and two-handed signs.

**Not a goal.** Matching published figures. Those come from random splits on other data (see `published-benchmarks.json`) and are not a target or a comparison baseline.

---

## EXP-003: Signer-dependent versus signer-independent gap

**Question.** How much does a random split overstate accuracy on this data?

**Method.** Using EXP-002's best configuration, evaluate under three protocols on the same data:

1. Random stratified frame-level 80/20 split (the protocol used by most published landmark papers).
2. Random split by recording (no recording on both sides, signers shared).
3. Signer-independent split (EXP-002 protocol).

Optionally add a fourth arm that augments before a random split, reproducing the leakage pattern identified in `ref-kulkarni-2026-isl-rf`, to quantify that effect.

**Report.** The three (or four) numbers side by side with the number of signers. This table is what the R&D page should show to explain why RTSLR reports signer-independent results.

**Also.** A learning curve: held-out-signer accuracy as the number of training signers grows, to estimate how many signers are needed.

---

## EXP-004: Feature ablation

**Question.** Which parts of the feature design matter? In particular, does the inter-hand block help?

**Variants (all under the EXP-002 protocol, same folds and seeds):**

| ID | Variant |
|---|---|
| F0 | Two wrist-relative 63-D blocks concatenated (126-D), as in published work |
| F1 | F0 + palm-length scaling and aspect-ratio correction |
| F2 | F1 + presence flags |
| F3 | F2 + inter-hand block (`dualhand-v1`) |
| F4 | F3 without z coordinates |
| F5 | F3 with in-plane rotation normalisation |
| F6 | F3 with slot assignment by handedness label instead of canonical mirroring |
| F7 | F3 without mirror augmentation |

**Report.** Held-out-signer accuracy and macro-F1 per variant, with the fold-wise differences against F3 (paired across folds). State plainly when a difference is within fold-to-fold variation. Break results down for two-handed signs, where the inter-hand block should matter most.

**Outcome.** A fixed feature version for the application, or a `dualhand-v2` proposal.

---

## EXP-005: Browser performance

**Question.** What frame rate and latency does the full pipeline reach in real browsers?

**Why.** The legacy prototype states "30+ FPS" without a measurement, and the only vendor latency figure is for a native Pixel 6 pipeline (`ref-mediapipe-hand-landmarker-docs`).

**Setup.** Self-hosted, version-pinned WASM and model files. Camera at a fixed resolution. Two hands in view.

**Measure, per device and browser:**

- `detectForVideo` time per frame (median, 95th percentile).
- Feature extraction and classifier time per frame.
- Delivered frames per second and dropped frames.
- Main-thread long tasks; a comparison with detection in a Web Worker if implemented.
- GPU delegate versus CPU.
- Model load time and download size.
- Sustained run of several minutes to observe thermal slowdown.

**Devices.** At least one laptop, one mid-range Android phone and one iPhone, with the browsers the product intends to support. Report device model, OS and browser version with every number.

**Output.** A table of measured figures. Any performance claim on the website must come from this table.

---

## Later experiments (outline only)

- **EXP-006 Temporal smoothing:** window length, hold-to-confirm time and abstention threshold versus letter-level error and delay in live use.
- **EXP-007 Dynamic baseline:** landmark-sequence model on INCLUDE-50 using its official split, after confirming whether that split is signer-independent.
- **EXP-008 External test:** evaluate the static model on a public static ISL set, if one with a suitable licence is obtained.

## Risks

| Risk | Mitigation |
|---|---|
| Too few signers for a meaningful estimate | Label results as pilot; show learning curve; recruit through deaf organisations |
| Sign inventory wrong or regionally biased | Review by fluent signers from more than one region before collection |
| Hands not detected when touching | EXP-001 first; consider adding pose landmarks for wrist position |
| Results presented without protocol | R&D page reads protocol and signer count from `rtslr-experiments.json` and shows them next to every number |
