# Hand tracking layer

Turns camera frames (or the simulator) into `HandFrame` and `FrameFeatures`
objects as defined in `src/types/recognition.ts` and `docs/MODEL_CONTRACTS.md`,
and draws the hand overlay. It does not classify anything.

Owner: Agent 05. Tests: `npx vitest run src/features/tracking`.

## How the pieces fit

```
user gesture
   │
useHandTracking ── React binding (refs, state via useSyncExternalStore)
   │
TrackingEngine (engine.ts) ── frame loop, session tokens, state
   ├─ CameraController (camera.ts) ── the only getUserMedia call site
   ├─ landmarker.ts ── lazy MediaPipe HandLandmarker singleton (GPU, then CPU)
   ├─ HandAssociator (association.ts) ── stable slots 0/1
   ├─ LandmarkSmoother (smoothing.ts) ── One Euro filter per coordinate
   ├─ extractFrameFeatures (features.ts) ── 63-D, 156-D, motion
   ├─ simulator.ts ── labelled synthetic source
   └─ overlay.ts ── canvas renderer
```

Per camera frame: `detectForVideo` → association → smoothing → `HandFrame`
→ `extractFrameFeatures` → `onFrame` listeners → overlay. Simulator frames skip
detection, association and smoothing.

## Using the hook

```tsx
"use client";
import { useEffect } from "react";
import { useHandTracking } from "@/features/tracking";

function Studio() {
  const tracking = useHandTracking({ getOverlayLabel: (slot) => labels.current[slot] ?? null });

  useEffect(
    () => tracking.onFrame((features, { source }) => {
      // runs every frame, outside React; feed the model here
    }),
    [tracking.onFrame],
  );

  return (
    <div style={{ position: "relative", aspectRatio: "4 / 3" }}>
      <video ref={tracking.videoRef} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <canvas ref={tracking.canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <button onClick={tracking.startCamera}>Start camera</button>
    </div>
  );
}
```

Layout contract: the video and the canvas must occupy the same box. The engine
sets `object-fit: cover` and, for the mirrored front camera, `transform:
scaleX(-1)` on the video element; the overlay uses the same cover geometry.
The canvas is transparent over camera input and opaque (dark grid plus a
"SIMULATOR" badge) for the simulator.

### `useHandTracking(options?)`

Options: `initialSettings`, `initialFacingMode`, `getOverlayLabel(slot, hand)`,
`simulatorBadge` (translated badge text).

Returns:

| Member | Meaning |
|---|---|
| `videoRef`, `canvasRef` | attach to the elements |
| `state` | `{ status, source, error, fps, handCount, facingMode, canFlip, cameraLive }` |
| `settings`, `updateSettings(patch)` | `{ mirror, showSkeleton, showBoundingBox, showLabels, smoothing }` |
| `startCamera()` | user gesture only; camera permission and model load run in parallel |
| `startSimulator(opts?)`, `setSimulatorOptions(patch)` | `{ pose, twoHands, secondPose, paused }` |
| `stop()` | stops the stream, the loop and clears the overlay |
| `flip()` | front/rear when `state.canFlip` |
| `resume()` | from `paused_hidden`, user gesture only |
| `onFrame(cb)` | `(features, { source }) => void`, returns unsubscribe |

`status`: `idle | requesting_permission | loading_model | running | paused_hidden | error`.
`source`: `"camera" | "simulator" | null`. The source is also passed with every
frame so synthetic input cannot be mistaken for camera input.

`state.cameraLive` is read from the real track state (`readyState === "live"`),
so the app-shell indicator required by CAM-08/CAM-09 can be driven from it.

`error.code`: `permission_denied`, `no_camera`, `camera_busy`,
`insecure_context`, `unsupported_browser`, `camera_disconnected`,
`playback_failed`, `camera_unknown`, `model_load_failed`, `tracking_failed`,
`not_mounted`. `error.message` is developer English; translate by code.

## Camera behaviour (docs/SECURITY_PRIVACY.md)

- `{ video, audio: false }` only. One call site (`camera.ts`).
- Each start has a token. Stop, unmount, flip, tab hide or page hide during the
  permission prompt or the model load stops the late stream without attaching it.
- A second start while one is pending or running does nothing.
- Stops on: `stop()`, unmount, `visibilitychange` to hidden, `pagehide`, a track
  `ended` event, `video.play()` rejection, a detector exception.
- After a tab hide the status is `paused_hidden`; nothing restarts until
  `resume()` is called.
- `enumerateDevices()` runs only after the camera started, to set `canFlip`.
- No `MediaRecorder`, `toDataURL`, `toBlob`, `captureStream`, `ImageCapture`,
  `drawImage` or `getImageData`. No console output of landmarks. No storage.

## Model loading

`@mediapipe/tasks-vision` is imported dynamically. The wasm runtime comes from
`/mediapipe/wasm` (same origin). The model file comes from
`NEXT_PUBLIC_HAND_MODEL_URL`; if unset, the Google-hosted
`hand_landmarker.task` (float16) is fetched. That default is a third-party
request: host the file on the app's origin to remove it.

## Features

`extractFrameFeatures(frame, history?)` implements sections 1–3 of the model
contract. `history` is a mutable wrist-trajectory buffer from
`createMotionHistory()`; without it motion is zero and `isStill` is false.
`__fixtures__/feature-parity.json` is the reference for the Python port.

Motion: wrist path over the last 500 ms divided by the mean palm length in
that window; speed is path over elapsed time; `isStill` needs at least 250 ms
of history and a speed below 0.5 palm lengths per second.

## Simulator

The poses are the 26 hand-drawn shapes of the legacy ASL prototype. They are
not ISL and not derived from any signer. Use the simulator only as a labelled
demonstration. With `prefers-reduced-motion` the synthetic hand does not move.

## Known limitations

- Nothing here has been run against a real camera or the real MediaPipe model
  in this environment. Unit tests use mocked media devices and a mocked detector.
- Smoothing, association and stillness defaults are untuned.
- If the hands cross so the wrists swap sides, hands A and B swap (contract
  limitation). Slots can also swap if two hands overlap closely for longer
  than the occlusion tolerance (5 frames).
- The occlusion tolerance is counted in frames, not time.
- A hand that is not detected is not reported, even while its slot is held.
- MediaPipe handedness is passed through unchanged. `estimateHandOrientation`
  depends on it for palm facing, and that has not been checked on a device.
- The overlay assumes the video fills its box with `object-fit: cover`.
- Detection runs on the main thread.
- `canFlip` relies on `enumerateDevices()` counting video inputs; it does not
  know whether a rear camera exists.
