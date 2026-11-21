# RTSLR model and feature contracts

Owner: Agent 00. Implemented by Agent 05 (tracking, features) and Agent 06 (models, Python pipeline).
The TypeScript source of truth is `frontend/src/types/recognition.ts`. The Python pipeline must
reproduce the feature layout below exactly; a shared fixture test proves parity.

## 1. Coordinate conventions

- Landmarks come from MediaPipe Hand Landmarker: 21 points per hand, `x`,`y` normalised to the image
  (origin top-left), `z` relative depth. All stored and classified landmarks are in the **unmirrored**
  camera frame. Mirroring is a display concern only.
- Before any geometry, undo image anisotropy: `x' = x * (imageWidth / imageHeight)`, `y' = y`, `z' = z * (imageWidth / imageHeight)`.
- Landmark indices: 0 wrist; thumb 1–4; index 5–8; middle 9–12; ring 13–16; little 17–20. Fingertips are `[4, 8, 12, 16, 20]`.

## 2. Single-hand vector (63-D), schema `rtslr-features-1`

For hand landmarks `p_i` (after the aspect correction):

- `palm = max(‖p_9 − p_0‖, 1e-4)` (3-D distance wrist → middle-finger MCP)
- `v[3i .. 3i+2] = (p_i − p_0) / palm` for `i = 0..20`

No handedness mirroring is applied in v1.

## 3. Coordinated dual-hand vector (156-D)

Only produced when exactly two hands are tracked. Hand **A** is the hand whose wrist has the smaller
`x` in the unmirrored frame; hand **B** is the other. MediaPipe handedness labels are *not* used for ordering.

| Index | Content |
|---|---|
| 0–62 | single-hand vector of A |
| 63–125 | single-hand vector of B |
| 126–128 | `(wristB − wristA) / s` |
| 129 | `‖wristB − wristA‖ / s` |
| 130–154 | 5×5 fingertip distances `‖tipA_i − tipB_j‖ / s`, row-major, `i` over A |
| 155 | cosine of the angle between palm normals |

`s` = mean of the two palm lengths. Palm normal = `normalize(cross(p_5 − p_0, p_17 − p_0))`.

Independently classifying each hand is **not** two-hand recognition. Two-hand ISL classes must be
classified from this 156-D vector (or a later schema), never by combining two single-hand labels.

Known limitation: if the hands cross so that their wrists swap sides, A and B swap.

## 4. Temporal window (reserved)

`FeatureWindow = { schema, frames: FrameFeatures[] (oldest first), fps }`. No v1 model consumes it.
Dynamic signs are out of scope until a sequence model is trained.

## 5. Model kinds — never blur these

| kind | What it is | Ships today |
|---|---|---|
| `legacy_asl_prototype` | Hand-tuned ASL A–Z rules ported from the original HTML. Not ISL. Scores are rule scores, not probabilities. | yes |
| `experimental_isl_user_trained` | k-NN over samples the user records in their own browser, single (63-D) and dual (156-D). Works only for the signs that user recorded. | yes |
| `validated_isl` | A trained ISL model with a documented, signer-aware evaluation. | **no** |
| `simulator` | Synthetic landmarks for demonstration. | yes |

## 6. Exported model file format (`rtslr-model-1`)

JSON, same-origin, produced by `machine-learning/` and loaded by the browser adapter:

```json
{
  "format": "rtslr-model-1",
  "featureSchema": "rtslr-features-1",
  "info": { "...": "ModelInfo" },
  "type": "mlp" | "knn",
  "inputDim": 63 | 156,
  "classes": ["A", "B"],
  "standardizer": { "mean": [], "scale": [] },
  "mlp": { "layers": [{ "W": [[]], "b": [], "activation": "relu" | "softmax" }] },
  "knn": { "k": 5, "metric": "cosine", "samples": [{ "label": "A", "vector": [] }] },
  "evaluation": { "protocol": "", "metrics": {}, "datasetId": "", "date": "" } | null
}
```

A file with `evaluation: null` must be treated as unvalidated. Loaders validate shape, finite numbers
and size before use (see docs/SECURITY_PRIVACY.md, MOD-01..12).

## 7. RecognitionResult rules

- `status: "no_hands"` when no hand is tracked.
- `status: "unsupported"` when the model cannot classify the input (e.g. two hands shown to a single-hand model, or the ISL model has no recorded classes). Give a `reason`.
- `status: "uncertain"` when the best score is below the model's threshold; `classId` is null but `candidates` may be filled.
- `scoreType` tells the UI how to word the score. Only `calibrated_probability` may be shown as a probability. Everything shipped today is `classifier_score`.

## 8. Stabiliser

Raw per-frame results feed a stabiliser: majority vote over the last 8 recognised frames → hold timer
(default 1.2 s, user adjustable 0.5–2.5 s) → one `CommitEvent` → 1 s cooldown. The same class cannot
commit twice without the hand leaving the pose or the cooldown elapsing.
