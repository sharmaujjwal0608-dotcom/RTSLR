AGENT: 05 — Computer Vision and Hand Tracking Engineer

ASSIGNED TASK:
Modular hand-tracking layer for the recognition studio: camera control, MediaPipe HandLandmarker loading, smoothing, stable hand identity, feature extraction (`rtslr-features-1`: 63-D and 156-D), simulator source, overlay renderer, React hook, tests and a cross-language parity fixture.

OWNED FILES:
- `frontend/src/features/tracking/**`
- `frontend/vitest.config.ts` (designated owner; generic)
- `docs/agent-reports/AGENT_05.md`

DEPENDENCIES:
- `frontend/src/types/recognition.ts`, `docs/MODEL_CONTRACTS.md`, `docs/SECURITY_PRIVACY.md` (CAM-01..17) — coded against, not modified.
- `@mediapipe/tasks-vision` 1.2.3 (installed), wasm at `frontend/public/mediapipe/wasm` (present).
- `NEXT_PUBLIC_HAND_MODEL_URL` (optional).
- No new packages.

IMPLEMENTED FEATURES:
- `camera.ts` — `CameraController` (`start`, `stop`, `flip`, `dispose`, `isLive`). Video only, `audio: false`. Token-based cancellation; second start while pending/active reuses the attempt; stops on track `ended`, `video.play()` failure, `visibilitychange` hidden and `pagehide`; `paused_hidden` state with no auto-restart; error codes `permission_denied`, `no_camera`, `camera_busy`, `insecure_context`, `unsupported_browser`, `camera_disconnected`, `playback_failed`, `camera_unknown`. `enumerateDevices()` only after start.
- `landmarker.ts` — lazy singleton, dynamic import, wasm from `/mediapipe/wasm`, model URL from env with the prototype's Google-hosted default, `numHands: 2`, VIDEO mode, GPU then CPU fallback, load-state subscription, retry after failure, CPU preference after a GPU runtime failure.
- `smoothing.ts` — One Euro filter per landmark coordinate, per slot, configurable, reset on slot reassignment.
- `association.ts` — slot assignment by minimum total wrist distance (aspect-corrected), occlusion hold (5 frames), distance gate, duplicate-detection removal, no swap on 1→2 / 2→1.
- `features.ts` — `extractFrameFeatures`, `singleHandVector`, `dualHandVector`, `dualHandVectorOrdered`, `orderHandsAB`, `aspectCorrect`, `palmLength`, `palmNormal`, `estimateHandOrientation`, motion history helpers.
- `fixtures.ts`, `__fixtures__/feature-parity.json` (9 cases) and `__fixtures__/README.md`.
- `simulator.ts` — deterministic port of `buildSyntheticHand`, one or two hands, pause, frozen under reduced motion.
- `overlay.ts` — thin translucent bones, small dots, soft glow, optional box, label chip placed off the hand, slot marker by shape as well as colour, display-time mirroring, cover-fit, DPR-aware, simulator backdrop with a text badge. Video pixels are never drawn to the canvas.
- `engine.ts` — framework-free `TrackingEngine` (loop with `requestVideoFrameCallback` when available, otherwise rAF).
- `useHandTracking.ts` — React hook over the engine.
- `index.ts`, `README.md`, `types.ts`, `testing.ts` (test doubles).

FILES CREATED OR MODIFIED:
Created (none modified):
- `frontend/vitest.config.ts`
- `frontend/src/features/tracking/`: `types.ts`, `camera.ts`, `landmarker.ts`, `smoothing.ts`, `association.ts`, `features.ts`, `fixtures.ts`, `simulator.ts`, `overlay.ts`, `engine.ts`, `useHandTracking.ts`, `index.ts`, `testing.ts`, `README.md`
- tests: `features.test.ts`, `association.test.ts`, `smoothing.test.ts`, `camera.test.ts`, `engine.test.ts`, `simulator.test.ts`
- `frontend/src/features/tracking/__fixtures__/feature-parity.json`, `__fixtures__/README.md`

TESTS RUN:
- `npx vitest run src/features/tracking` (from `frontend/`)
- `npx tsc --noEmit -p .` (from `frontend/`)
- `npx eslint src/features/tracking vitest.config.ts`
- grep over `src/features/tracking` for `MediaRecorder|toDataURL|toBlob|captureStream|ImageCapture|innerHTML|eval(|console.|localStorage|drawImage|getImageData`

TEST RESULTS:
- Vitest: `Test Files 6 passed (6)`, `Tests 95 passed (95)`.
  Vitest prints a Vite warning that `vitest.config.ts` uses ESM syntax in a file loaded as CommonJS; it does not affect the run.
- tsc: no errors in `src/features/tracking` or `vitest.config.ts`. 7 errors exist in other agents' files (not inspected).
- eslint: exit 0, no output.
- grep: matches only in comments that list the forbidden APIs. One `getUserMedia(` call site in `frontend/src` outside tests (`camera.ts`).
- Not run: any real camera, the real MediaPipe model or wasm, any browser, Playwright, `next build`.

KNOWN LIMITATIONS:
- No real camera or real HandLandmarker was exercised. Camera and engine tests use mocked `navigator.mediaDevices` and a mocked detector.
- Smoothing (`minCutoff 1.5`, `beta 10`), association (`maxMatchDistance 0.45`, 5 held frames) and stillness (`0.5` palm lengths/s over 500 ms) defaults are untuned guesses.
- A/B swap when wrists cross (contract limitation); slots may swap after long close overlap.
- `TrackedHand.ageFrames` counts detected frames of the slot's current identity; frames missed inside the occlusion tolerance do not reset it.
- MediaPipe handedness passed through unverified; `estimateHandOrientation` palm facing depends on it.
- Default model URL is a third-party request to `storage.googleapis.com` (as specified). Hosting the model same-origin removes it.
- Detection runs on the main thread.
- The simulator poses are the legacy ASL prototype shapes, not ISL.

INTEGRATION NOTES:
- Agent 01: video and canvas must share one box; the engine sets `object-fit: cover` and the mirror transform on the video. Drive the CAM-08 indicator from `state.cameraLive`. Show the CAM-14 explanation before calling `startCamera()`. Call `startCamera`, `flip` and `resume` only from click/tap/key handlers. Translate errors by `state.error.code`. Pass a translated `simulatorBadge`. Show a visible "Simulator" label in the UI as well whenever `state.source === "simulator"`.
- Agent 06: consume `onFrame((features, { source }) => …)`. Python parity file: `frontend/src/features/tracking/__fixtures__/feature-parity.json`, shape in the README beside it. Degenerate palm normal is the zero vector (cosine 0); A/B tie goes to the lower slot.
- Agent 12: `camera.ts` is the single `getUserMedia` call site. `testing.ts` imports `vitest` and is only imported by test files.
- Orchestrator: `vitest.config.ts` triggers a Vite warning because `package.json` has no `"type": "module"`; renaming to `vitest.config.mts` would silence it. Left as `.ts` per the brief.

STATUS: TESTED (unit level only; browser and device checks listed in the tracking README and in the summary are still required)
