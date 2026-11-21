# Model card: `<model id>` version `<x.y.z>`

Fill in every section from `report.json` / `report.md` of the training run. Write "not measured" where something was not measured; do not estimate. A model is not marked validated until this card is complete and reviewed.

## 1. Summary

- Model id and version:
- Run directory and date:
- What it does, in one sentence (for example: "classifies N static two-hand ISL signs from hand landmarks"):
- What it does **not** do (dynamic signs, sentences, facial grammar, other sign languages):
- Status: validated / not validated. If not, why:

## 2. Intended use

- Intended users and setting:
- Out of scope: medical, legal, emergency and any other high-stakes communication; identifying people; use without the user seeing the uncertainty.

## 3. Data

- Dataset id and name (from the manifest):
- Source and who collected it:
- Licence and terms reference; does it permit training and distributing this model?
- Consent: how it was obtained, what it covers, how a signer withdraws:
- Number of signers; how ids were anonymised:
- Signer demographics that were recorded (handedness, region, age band), or "not recorded":
- Recording conditions (cameras, lighting, backgrounds, distance):
- Class inventory and who verified it (name the fluent signer(s) or authority):
- Classes excluded and why (dynamic, too few signers, detection failures):

## 4. Preprocessing

- MediaPipe hand model file and version (must match the browser):
- `mediapipe` and `opencv-python` versions:
- Frame sampling (`--every-nth-frame`), mirroring handling:
- Hand-detection rate per class (from the extraction report):
- Cleaning log (rows dropped and why):
- Feature schema: `rtslr-features-1`, input dimension 63 or 156:

## 5. Evaluation protocol

- Split type and seed (must be signer-independent for a validated model):
- Signers in train / validation / test:
- Was augmentation used? If yes, was it applied after splitting and to training data only?
- How the model was selected (validation signers only) and how many candidates were tried:
- How many times the test set was used:

## 6. Results on unseen signers

| Metric | Value | Samples | Signers |
|---|---|---|---|
| Accuracy | | | |
| Macro-F1 | | | |
| Worst signer accuracy | | | |
| Per-signer accuracy, mean ± standard deviation | | | |

- Per-class precision and recall: attach the table.
- Confusion matrix: attach it. Name the most confused pairs.
- One-hand versus two-hand breakdown (if both were evaluated):
- Grouped cross-validation by signer (mean, standard deviation, worst fold), if run:
- Signer-dependent (random-split) figure for comparison, labelled as such, if run:
- Coverage: share of frames with failed detection, and share the model rejected as uncertain:

## 7. Model

- Type (MLP or k-NN) and parameters:
- Exported file, size, SHA-256:
- Export parity: label agreement and maximum score difference against scikit-learn:
- Score type: `classifier_score`. If calibration was measured, give the method and the expected calibration error; otherwise "not calibrated".

## 8. Live behaviour (measured separately, in the browser)

- Devices and browsers tested:
- Frames per second and latency:
- Stabiliser settings used:
- False commits per minute on non-sign movement:

## 9. Limitations and risks

- Known weak classes and conditions:
- Groups of signers not represented in the data:
- What happens with signs outside the class list:
- Privacy: landmarks are personal data; how they are stored and for how long:

## 10. Review

- Reviewed by (engineering):
- Reviewed by (fluent ISL signer / Deaf community reviewer):
- Date and decision:
