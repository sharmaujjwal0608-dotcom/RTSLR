# RTSLR Research Notes

Owner: Agent 07 (Research and Development). Sources checked on 2026-11-21.

**Status of RTSLR itself:** RTSLR has no ISL dataset, no trained ISL model and no experimental results. Every number in this document comes from someone else's publication and is labelled with its source. Reference IDs (`ref-...`) point to `research/data/references.json`.

Two kinds of statement appear below and are kept apart:

- **Sourced**: read on a page that was opened; the reference ID is given.
- **Assumption**: engineering judgement or general background that was not checked against a source in this pass. All of these are collected in section 9.

---

## 1. ISL versus ASL: what matters for engineering

| Point | What the sources say | Source |
|---|---|---|
| ISL is its own language | ISL was developed by the Indian deaf community and was not borrowed from another country. | `ref-nios-isl-history` |
| Fingerspelling is two-handed | ISL uses two-handed fingerspelling similar to British Sign Language, with minor differences such as A, E, I, O, U. Apart from fingerspelling, ISL signs differ significantly from BSL. | `ref-nios-isl-history`, `ref-wikipedia-ipsl` |
| ASL influence exists but is limited | International Sign and ASL influence some current ISL usage (examples given: SHOW, TEAM, FAMILY). | `ref-nios-isl-history` |
| Regional variation | Several regional varieties are described (Delhi, Bombay, Calcutta, Bangalore-Madras and others). | `ref-wikipedia-ipsl`, `ref-nios-isl-history` |
| Meaning is not only in the hands | Mouth patterns, facial expression, body posture, head position and eye gaze are part of the language, and space is used grammatically. | `ref-wikipedia-ipsl` |
| Fingerspelling is under-resourced | A 2025 workshop paper calls ISL fingerspelling severely under-resourced and its baseline reaches an 82.91% character error rate on continuous fingerspelling. | `ref-kirandevraj-2025-isl-fingerspelling` |

Consequences for RTSLR:

1. **The legacy prototype cannot be re-labelled as ISL.** It runs ASL one-handed rules on each hand independently. ISL letters are mostly formed by both hands together, so the unit of classification must be the two-hand configuration, not one hand.
2. **Hands touch and overlap.** Two-handed letters put one hand on or in front of the other. A published ISL landmark system lost 4.3% of images to failed hand detection overall and far more on specific letters (H 79.6%, Z 82.5%, X 88.6%, V 90.0% detection) (`ref-kulkarni-2026-isl-rf`). Detection failure must be measured per sign before any classifier work (EXP-001).
3. **Which hand is dominant varies.** A left-handed signer mirrors the configuration. Features must not depend on which physical hand plays which role (section 4).
4. **A sign inventory must come from an ISL authority.** The ISLRTC dictionary is the official reference (`ref-islrtc-home`). The exact list of letters that are one-handed, two-handed or need motion was *not* confirmed from a source in this pass and must be fixed with a fluent signer.
5. **Hand landmarks alone cannot cover the whole language.** Signs that depend on face, body location or mouth pattern are out of reach for a hands-only pipeline. RTSLR should describe its first milestone as "static ISL fingerspelling and digits", not "ISL recognition".

---

## 2. Static and dynamic signs

- **Static sign**: recognisable from one frame (a hand configuration held still). Suited to per-frame classifiers such as k-NN or an MLP on landmark features.
- **Dynamic sign**: defined by movement over time. Needs a sequence of frames.

What the sources say about ISL specifically:

- A published ISL alphabet system treats all 26 letters as static but states that H and J are conventionally articulated with motion, and lists C, M, N, H, Z as its weakest letters (`ref-kulkarni-2026-isl-rf`).
- An earlier ISL system separated 33 static hand poses (k-NN) from 12 dynamic gestures (HMM) (`ref-shenoy-2018-isl-realtime`).
- The word-level datasets (INCLUDE, CISLR, FDMSE-ISL) are all dynamic video.

Plan: start with the static subset, flag motion-dependent letters in the inventory instead of forcing them into a static classifier, and report them separately.

Even a static classifier needs temporal handling in a live stream: transitions between signs produce frames that match no class. Published systems use majority voting over a short window (10 frames in `ref-kulkarni-2026-isl-rf`). RTSLR needs a "no sign / transition" outcome and a hold-to-confirm rule. Window length is a parameter to tune, not a known value.

---

## 3. Landmark normalisation

What MediaPipe Hand Landmarker gives (`ref-mediapipe-hand-landmarker-docs`, `ref-mediapipe-hand-landmarker-web`):

- 21 landmarks per hand, index 0 = wrist, 20 = little-finger tip.
- `landmarks`: x and y normalised to [0, 1] by image width and height; z is depth relative to that hand's wrist.
- `worldLandmarks`: metres, origin at **that hand's** geometric centre.
- `handedness`: Left/Right with a score, referring to the subject's hand; a mirrored image inverts the label.
- `numHands` defaults to 1 and must be set to 2.

Two facts from the documentation shape the design:

- **x and y are not on the same scale.** They are divided by width and height separately, so on a 16:9 frame a unit of x is longer than a unit of y. Multiply x by the frame aspect ratio (or convert to pixels) before computing any distance or angle.
- **World landmarks cannot relate the two hands.** Each hand's world coordinates are centred on that hand. The relative position of the hands must be computed from the image-space landmarks. Likewise, z is relative to each hand's own wrist, so z differences between hands are not meaningful.

Proposed per-hand normalisation (the legacy prototype's approach, with the aspect fix):

1. Convert x to isotropic units (x multiplied by width/height).
2. Translate so the wrist (landmark 0) is the origin.
3. Divide by palm length, the distance from wrist (0) to middle-finger MCP (9).
4. Optional: rotate in the image plane so the wrist-to-middle-MCP vector points up. This removes in-plane tilt but may erase orientation differences that separate two signs. Test both (EXP-004).

Published landmark systems use the same idea with small variations: wrist-relative coordinates (`ref-kulkarni-2026-isl-rf`), centre-relative coordinates scaled by the bounding box (`ref-kumar-2023-mediapipe-cnn-asl`). None of them reports a comparison between normalisation choices, so the best choice for ISL is open.

---

## 4. Dual-hand feature design

The published 126-D ISL feature is two wrist-relative 63-D blocks concatenated, zero-padded when one hand is missing (`ref-kulkarni-2026-isl-rf`). Because each block is centred on its own wrist, that vector contains **no information about where the hands are relative to each other**. Two signs with the same hand shapes but different contact points would look identical. RTSLR's coordinated vector adds that information.

Proposed vector, version `dualhand-v1` (a proposal to be tested, not a validated design):

| Block | Size | Content |
|---|---|---|
| Hand A shape | 63 | Normalised landmarks of hand A (section 3) |
| Hand B shape | 63 | Normalised landmarks of hand B, zeros if absent |
| Presence | 2 | 1/0 flag for each hand, so zeros are not mistaken for a real pose |
| Wrist offset | 2 | (x, y) of wrist B minus wrist A, isotropic, divided by the mean palm length of the two hands |
| Palm-centre distance | 1 | Distance between palm centres, same scaling |
| Relative orientation | 2 | sin and cos of the angle between the two wrist-to-middle-MCP vectors |
| Fingertip cross-distances | 25 | Distances between the 5 fingertips of A and the 5 fingertips of B, same scaling |

Total 158 values. The inter-hand blocks are zero when only one hand is present.

> **Correction (second pass, 2026-11-21): the application does not implement `dualhand-v1`.** The fixed project
> contract (`docs/MODEL_CONTRACTS.md`, schema `rtslr-features-1`, implemented in
> `frontend/src/features/tracking/features.ts`) defines a **156-value** coordinated vector instead: two 63-D
> hand blocks, a 3-D wrist offset, the wrist distance, 25 fingertip cross-distances and the cosine of the angle
> between palm normals. It differs from the proposal above in four ways: no presence flags (the vector is only
> produced when exactly two hands are tracked), a 3-D rather than 2-D wrist offset, a palm-normal cosine instead
> of the in-plane sin/cos pair, and hand A chosen by the smaller wrist x in the unmirrored frame rather than by
> canonical mirroring. Neither layout has experimental support. `dualhand-v1` remains a research proposal;
> EXP-004 should compare it against `rtslr-features-1`. Where this document or the experiment specifications say
> "the application's feature vector", read `rtslr-features-1` (156-D).

Design questions that the experiments must answer:

- **Slot assignment.** Which hand is A? Options: (a) by MediaPipe handedness label, (b) by image position (leftmost wrist first), (c) canonicalise by mirroring left-dominant samples. Handedness labels flip with mirroring and can be wrong when hands overlap; position order flips when hands cross. Option (c) plus mirror augmentation is the starting choice.
- **Mirror invariance.** Add a horizontally mirrored copy of each training sample so left- and right-dominant signers map to the same class.
- **Depth.** z is the least reliable coordinate and is per-hand. Test with and without z (EXP-004).
- **Missing hand.** When a two-handed sign yields one detected hand, the classifier should abstain rather than guess; presence flags make this learnable.
- **Usefulness of the inter-hand block.** No source was found that measures its benefit for ISL. EXP-004 is designed to measure it.

---

## 5. Classifier options for static signs

| Option | Why consider it | Risk |
|---|---|---|
| k-NN on the feature vector | No training step, works with a few samples per class, easy to run in the browser, supports per-user calibration (as the legacy prototype does) | Cost grows with stored samples; sensitive to feature scaling; tends to memorise signers |
| Small MLP | Small, fast, exportable to the browser | Needs more data; overfits to signers if the split is not signer-aware |
| Random Forest / gradient boosting | Used by published landmark systems (`ref-kulkarni-2026-isl-rf`, `ref-owo-ai-xgboost-asl`) | Harder to run in the browser than an MLP; useful as an offline baseline |

Published accuracies for these methods are all above 98% but come from random splits on single private or one-handed datasets (see `published-benchmarks.json`). They say that landmark features separate classes well under easy conditions. They do not predict what RTSLR will get on unseen signers.

---

## 6. Sequence modelling options for dynamic signs

| Option | Evidence found | Note |
|---|---|---|
| HMM over per-frame features | Used for 12 ISL gestures (`ref-shenoy-2018-isl-realtime`) | Classical, light, small vocabularies |
| LSTM / GRU over landmark sequences | Used for ASL letters with MediaPipe (`ref-sundar-2022-mediapipe-lstm-asl`, abstract only) | Small and browser-friendly |
| Transformer over keypoints | The INCLUDE code base trains a transformer on MediaPipe Hands and BlazePose keypoints (repository README at github.com/AI4Bharat/INCLUDE) | More data needed |
| Graph networks over a skeleton | HWGAT reports 93.86% top-1 on 2,002 ISL words with a signer-independent split (`ref-patra-2024-hwgat-fdmse`) | Strongest ISL evidence found; heavier |
| Pose-based pretraining | OpenHands reports that self-supervised pretraining on unlabelled Indian-SL pose data helps low-resource recognition (`ref-selvaraj-2021-openhands`) | Route to benefit from public ISL pose data |
| One-shot / prototype matching | CISLR baseline (`ref-joshi-2022-cislr`) | Fits vocabularies with one example per sign |

Open problems that sequence models add: finding where a sign starts and ends in a live stream, handling different signing speeds, and continuous fingerspelling, where the only ISL baseline found is very weak (`ref-kirandevraj-2025-isl-fingerspelling`).

Dynamic word-level signs are likely to need body and face landmarks as well as hands. That is a separate cost and accuracy study (roadmap item rm-11).

---

## 7. Signer-independent evaluation

**Why it matters.** If the same person appears in training and test data, the model can score well by recognising that person's hands, camera and background. A study on sign language detection found a relative accuracy drop of 4.17% and 6.27% on two corpora once signer overlap was removed, and argues existing benchmarks are over-optimistic (`ref-pal-2023-signer-overlap`; different task and languages, cited for the principle).

**What the audited sources did:**

| Source | Protocol |
|---|---|
| `ref-kulkarni-2026-isl-rf` (ISL, 98.12%) | Random stratified 80/20 split applied **after** 3x augmentation; signer count not stated |
| `ref-kumar-2023-mediapipe-cnn-asl` (ASL, 99.95%) | Random 80/20 split |
| `ref-owo-ai-xgboost-asl` (ASL, 98.43%) | Random stratified 80/20 split |
| `ref-alsharif-2025-yolov11-asl` (ASL, mAP 98.2%) | 80/10/10 split; signers not discussed in the text read |
| `ref-patra-2024-hwgat-fdmse` (ISL words, 93.86%) | Signer-independent: 10 / 2 / 8 signers, no overlap |

Only one of the audited results is signer-independent, and it is not for the alphabet.

**Rules for RTSLR experiments:**

1. Every sample carries an anonymous signer ID and a session ID.
2. Split by signer first. Augment after splitting, and only the training part. Splitting after augmentation leaks near-duplicates into the test set.
3. Frames from one recording are near-duplicates. Never place frames of the same recording on both sides of a split.
4. Headline metric: accuracy on signers never seen in training (leave-one-signer-out, or grouped k-fold when there are enough signers). Report mean, spread and the worst signer.
5. Report the random-split number next to it, labelled as signer-dependent, so the gap is visible.
6. Report coverage: the share of frames where detection failed or the classifier abstained. Accuracy computed only on frames with detected hands hides detection failures.
7. Report macro-F1 and a confusion matrix; overall accuracy hides weak classes.
8. With few signers the estimate is noisy. State the number of signers next to every figure.

---

## 8. Browser inference constraints

Sourced facts:

- The web API is `@mediapipe/tasks-vision`; it loads a WASM runtime and a `hand_landmarker.task` model bundle (`ref-mediapipe-hand-landmarker-web`).
- Web running modes are `IMAGE` and `VIDEO`. Web tasks run synchronously; the documentation recommends `VIDEO` mode called from `requestAnimationFrame` so each paint processes the latest frame (`ref-mediapipe-hand-landmarker-web`).
- `delegate: "GPU"` can be requested (`ref-mediapipe-hand-landmarker-web`).
- The only latency published in the documentation is for a Pixel 6 phone: 17.12 ms CPU, 12.27 ms GPU (`ref-mediapipe-hand-landmarker-docs`). No browser figure is published there.
- One paper reports about 70.9 ms per frame on a laptop CPU for a heavier MediaPipe + YOLOv11 pipeline, alongside a 1.3 ms figure in its results table, without explaining the gap (`ref-alsharif-2025-yolov11-asl`). Published latency numbers need the same scrutiny as accuracy numbers.

Engineering consequences:

- Because detection is synchronous, it occupies the main thread while it runs. Moving it to a Web Worker is an option to evaluate; it was not tested and is listed as an assumption.
- The legacy prototype's "30+ FPS" statement has no measurement behind it. RTSLR must measure frame rate on real devices (EXP-005) before stating one.
- Model and WASM files should be self-hosted with a pinned version rather than loaded from a CDN `@latest` URL, so behaviour does not change underneath a trained classifier.
- The classifier must consume exactly the features used in training. One shared, versioned feature extractor (`dualhand-v1`) with unit tests is required; a mismatch silently destroys accuracy.
- Front cameras are often displayed mirrored. Mirroring flips the handedness label (`ref-mediapipe-hand-landmarker-web`). Decide once whether features are computed on the raw or the mirrored frame and keep training and inference consistent.
- Privacy: keep video on the device and store landmarks only. Landmarks are still personal data collected from identifiable people and need consent.

---

## 9. Open and unsupported assumptions

These statements are used in planning but were **not** verified against a source in this pass.

| # | Assumption | Why unverified | How to resolve |
|---|---|---|---|
| A1 | Most ISL letters are two-handed, with a small number one-handed | Sources confirm fingerspelling is two-handed and BSL-like; none read gave a per-letter list | Build the inventory with a fluent signer and the ISLRTC dictionary (rm-03) |
| A2 | Which ISL letters need motion | One paper says H and J; no authoritative per-letter source read | Same as A1 |
| A3 | MediaPipe detects both hands reliably enough when they touch or overlap | Only evidence is one paper's per-letter detection rates on a private dataset | EXP-001 |
| A4 | The inter-hand feature block improves recognition | No source measures it for ISL | EXP-004 |
| A5 | Wrist-centred, palm-length scaling is the best normalisation | Carried over from the ASL prototype; no comparison found | EXP-004 |
| A6 | Mirroring makes left- and right-dominant signing equivalent | Reasonable but untested; individual signs could differ | EXP-004 and signer review |
| A7 | k-NN or a small MLP is sufficient for static ISL signs | Published high accuracies come from random splits | EXP-002, EXP-003 |
| A8 | Real-time frame rate is achievable in the browser on mid-range phones | No browser latency source; prototype's 30+ FPS is unmeasured | EXP-005 |
| A9 | A Web Worker would remove main-thread blocking | Not tested; not stated in the documentation read | EXP-005 |
| A10 | INCLUDE has 7 signers | From two papers' comparison tables, not from the dataset's own page | Read the INCLUDE paper |
| A11 | The ISLRTC dictionary has about 10,000 terms | News reports only; the dictionary site could not be opened | Re-check the dictionary site (rm-02) |
| A12 | Fingerspelling in ISL is used mainly for names and terms without a sign | General background (search extract only) | Ask fluent signers; affects product scope |
| A13 | Regional variation does not change the alphabet and digits | Not checked | Ask fluent signers from more than one region |
| A14 | The legacy table's "ISL hard pairs: C, M, N, H, Z" generalises | It is one paper's result on one private dataset | Replace with RTSLR's own confusion matrix once measured |
| A15 | The legacy table's "ISL features: 126-D / Holistic" | 126-D matches one paper; nothing read supports "Holistic" as a requirement for the alphabet | Decide after EXP-004 |

---

## 10. Audit of the legacy prototype's R&D tab

File: `basic version.html`, R&D tab (lines 358-443) and chart (lines 1159-1193).

### Four reference links

| Prototype claim | Finding | Status |
|---|---|---|
| arXiv:2305.05296, "99.95% accuracy across 26 ASL alphabet letters using MediaPipe landmarks + CNN" | Abstract says 99.95%; 26 classes; MediaPipe features. The results section of the same paper says 100%, and the classifier takes 42 landmark values. Random 80/20 split. Preprint. | Matches the abstract; the paper is internally inconsistent |
| Valentinetemi GitHub, "98.43% accuracy across 28 ASL classes using 63 wrist-normalized MediaPipe keypoints", titled "+ XGBoost" | README: XGBoost 98.43%, 28 classes, 63 features. "Wrist-normalized" specifically was not confirmed (README says normalised). Self-reported, no paper. | Matches, minor wording unconfirmed |
| IRJMETS, "98.12% accuracy across 26 ISL classes with Random Forest (95.7% landmark detection on 31,200 images)" | All three figures match the paper. The paper splits after augmentation and does not state the signer count, which the prototype does not mention. | Matches; important caveats omitted |
| MDPI Sensors 25/7/2138, "98.2% mAP@0.5 on 130,000 annotated ASL images" | MDPI page returned HTTP 403; the PubMed Central copy of the same article confirms mAP@0.5 0.982 and 130,000 images. | Matches |

### Benchmark chart (seven bars)

| Bar | Value | Finding |
|---|---|---|
| MediaPipe + CNN (ASL) | 99.95 | Sourced (arXiv:2305.05296) |
| MediaPipe + LSTM (ASL) | 99.0 | **No citation in the prototype.** Probably Sundar and Bagyammal 2022, whose abstract reports 99%; that link is an inference |
| Owo AI XGBoost (ASL) | 98.43 | Sourced (GitHub README) |
| YOLOv11 + MediaPipe (ASL) | 98.2 | Sourced, but it is mAP@0.5, not accuracy |
| MediaPipe + RF (ISL) | 98.12 | Sourced (IRJMETS) |
| MediaPipe + ML (ASL) | 96.5 | **No source found. Do not carry over.** |
| 2-Hand ISL + CNN | 92.0 | **No source found. Do not carry over.** |

### Other problems

- The chart puts classification accuracy and detection mAP on one axis and ranks results from different datasets, class counts and protocols. That comparison is not valid.
- The chart heading says "peer-reviewed and open-source"; one source is a preprint and one is a GitHub README.
- "30+ FPS" is stated without a measurement.
- "Dual-Hand" in the prototype means two independent one-handed ASL recognisers, not two-handed ISL signs.
- The ASL vs ISL table cites no sources. Its ISL column is partly traceable to the IRJMETS paper (C, M, N, H, Z; 126-D); "Holistic" and the motion list "H, J, Z" are not fully supported (the paper names H and J as motion letters).

Recommendation for the new R&D pages: show published results as a table with dataset, protocol and caveat columns from `published-benchmarks.json`, not as a ranked bar chart, and show RTSLR results only from `rtslr-experiments.json` (currently empty).
