"use client";

/**
 * React binding for the tracking engine.
 *
 * Attach `videoRef` to a `<video>` and `canvasRef` to a `<canvas>` laid over
 * it (same box). Start the camera only from a click/tap/key handler.
 * Per-frame data is delivered through `onFrame`, never through React state.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { TrackingEngine, type TrackingSettingsPatch } from "./engine";
import type { SimulatorOptions } from "./simulator";
import type {
  FacingMode,
  FrameListener,
  OverlayLabelProvider,
  TrackingSettings,
  TrackingState,
} from "./types";

export type UseHandTrackingOptions = {
  /** Initial overlay/smoothing settings (read once). */
  initialSettings?: TrackingSettingsPatch;
  /** Camera used by the first `startCamera()` (read once). Default "user". */
  initialFacingMode?: FacingMode;
  /** Supplies the chip text for each tracked hand; return null for no chip. */
  getOverlayLabel?: OverlayLabelProvider | null;
  /** Translated text of the badge drawn on the canvas while simulating. */
  simulatorBadge?: string;
};

export type UseHandTrackingResult = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: TrackingState;
  settings: TrackingSettings;
  updateSettings: (patch: TrackingSettingsPatch) => void;
  /** Requests the camera and loads the model. Call from a user gesture. */
  startCamera: () => Promise<void>;
  /** Starts the labelled synthetic source. No camera is involved. */
  startSimulator: (options?: Partial<SimulatorOptions>) => void;
  /** Changes pose / two hands / paused while the simulator runs. */
  setSimulatorOptions: (patch: Partial<SimulatorOptions>) => void;
  stop: () => void;
  /** Switches front/rear camera when `state.canFlip`. Call from a user gesture. */
  flip: () => Promise<void>;
  /** Restarts the camera from `paused_hidden`. Call from a user gesture. */
  resume: () => Promise<void>;
  /** Subscribes to every processed frame, outside React. Returns unsubscribe. */
  onFrame: (listener: FrameListener) => () => void;
};

export function useHandTracking(options: UseHandTrackingOptions = {}): UseHandTrackingResult {
  const [engine] = useState(
    () => new TrackingEngine({ settings: options.initialSettings, facingMode: options.initialFacingMode }),
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
  const settings = useSyncExternalStore(engine.subscribeSettings, engine.getSettings, engine.getSettings);

  const { getOverlayLabel, simulatorBadge } = options;
  useEffect(() => {
    engine.setOverlayLabelProvider(getOverlayLabel ?? null);
  }, [engine, getOverlayLabel]);
  useEffect(() => {
    engine.setSimulatorBadge(simulatorBadge);
  }, [engine, simulatorBadge]);

  // Unmount (including a route change) stops the camera and the loop.
  useEffect(() => () => engine.stop(), [engine]);

  const startCamera = useCallback(
    () => engine.startCamera(videoRef.current, canvasRef.current),
    [engine],
  );
  const startSimulator = useCallback(
    (simulatorOptions?: Partial<SimulatorOptions>) =>
      engine.startSimulator(canvasRef.current, simulatorOptions),
    [engine],
  );

  return {
    videoRef,
    canvasRef,
    state,
    settings,
    updateSettings: engine.updateSettings,
    startCamera,
    startSimulator,
    setSimulatorOptions: engine.setSimulatorOptions,
    stop: engine.stop,
    flip: engine.flip,
    resume: engine.resume,
    onFrame: engine.onFrame,
  };
}
