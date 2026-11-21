# feature-parity.json

Cross-language fixture for feature schema `rtslr-features-1`
(`docs/MODEL_CONTRACTS.md` sections 1–3). The TypeScript implementation in
`../features.ts` generates it; the Python pipeline must reproduce every
expected vector from the same inputs.

Do not edit the JSON by hand. To regenerate it after a deliberate change:

```
cd frontend
UPDATE_FIXTURES=1 npx vitest run src/features/tracking/features.test.ts
```

(PowerShell: `$env:UPDATE_FIXTURES = "1"; npx vitest run src/features/tracking/features.test.ts`.)
Without that variable the test fails if the file and the code disagree.

## Shape

```jsonc
{
  "schema": "rtslr-features-1",
  "description": "…",
  "tolerance": 0.00001,          // suggested absolute tolerance per component
  "cases": [
    {
      "name": "minimal_dual_aspect_2",
      "description": "…",
      "imageWidth": 200,         // pixels; aspect = imageWidth / imageHeight
      "imageHeight": 100,
      "hands": [                 // 0, 1 or 2 hands, ordered by slot
        {
          "slot": 0,             // tracking slot, NOT the A/B order
          "landmarks": [[x, y, z], …]   // 21 rows, raw MediaPipe-style values,
                                        // unmirrored, before aspect correction
        }
      ],
      "expected": {
        "handCount": 2,
        "perHand": [             // same order as "hands"
          { "slot": 0, "vector": [/* 63 numbers */] }
        ],
        "dual": [/* 156 numbers */],     // null unless exactly two hands
        "dualOrder": { "a": 0, "b": 1 }  // slots chosen as hand A and hand B; null without dual
      }
    }
  ]
}
```

## Rules the expected values follow

- Arithmetic is float64; results are stored as float32 and written as the
  float32 values. Compare with the absolute `tolerance`, not exactly.
- Aspect correction first: `x' = x * w/h`, `y' = y`, `z' = z * w/h`.
- `palm = max(‖p9 − p0‖, 1e-4)` (3-D, corrected). `vector[3i..3i+2] = (p_i − p_0) / palm`.
- Hand A is the hand with the smaller raw wrist `x`. On an exact tie the hand
  listed first (lower slot) is A.
- `s` = mean of the two clamped palm lengths. Indices 126–128 `(wristB − wristA)/s`,
  129 its length, 130–154 fingertip distances `‖tipA_i − tipB_j‖/s` row-major
  with `i` over A, tips `[4, 8, 12, 16, 20]`, 155 the palm-normal cosine.
- Palm normal = `normalize(cross(p5 − p0, p17 − p0))`. If the cross product has
  length ≤ 1e-12 the normal is the zero vector, so the cosine is 0.

## Cases

`no_hands`, two hand-computed cases (`minimal_*`, derivation in
`../features.test.ts`), open-hand shapes at 4:3, portrait and 16:9, the same
pair with slots exchanged (the dual vector must not change), a pseudo-random
pair, and a degenerate hand whose 21 points coincide.

The landmark sets are geometric test shapes. They do not depict any sign.
