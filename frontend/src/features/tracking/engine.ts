/**
 * TrackingEngine: the framework-free core behind `useHandTracking`.
 *
 * Owns the camera controller, the frame loop, identity association,
 * smoothing, feature extraction and the overlay. React state only receives
 * coarse status changes; per-frame data goes to `onFrame` listeners directly.
 *
 * Nothing but landmark numbers leaves this class.
 */
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { FrameFeatures, HandFrame, TrackedHand } from "@/types/recognition";
import { HandAssociator } from "./association";
import { CameraController, type CameraState } from "./camera";
import { createMotionHistory, extractFrameFeatures, resetMotionHistory } from "./features";
import { detectHands, loadHandLandmarker, reportLandmarkerFailure } from "./landmarker";
import { clearOverlay, renderOverlay, syncCanvasSize } from "./overlay";
import { createSimulatorSource, type SimulatorOptions, type SimulatorSource } from "./simulator";
import { DEFAULT_SMOOTHING, LandmarkSmoother } from "./smoothing";
import type {
  FacingMode,
  FrameListener,
  FrameSource,
  OverlayLabelProvider,
  TrackingError,
  TrackingSettings,
  TrackingState,
} from "./types";

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  mirror: true,
  showSkeleton: true,
  showBoundingBox: false,
  showLabels: true,
  smoothing: DEFAULT_SMOOTHING,
};

export type TrackingSettingsPatch = Partial<Omit<TrackingSettings, "smoothing">> & {
  smoothing?: Partial<TrackingSettings["smoothing"]>;
};

export type TrackingEngineOptions = {
  settings?: TrackingSettingsPatch;
  facingMode?: FacingMode;
};

type LoopHandle = { kind: "raf" | "rvfc"; id: number };

const FPS_INTERVAL_MS = 500;

function mergeSettings(base: TrackingSettings, patch: TrackingSettingsPatch = {}): TrackingSettings {
  return { ...base, ...patch, smoothing: { ...base.smoothing, ...patch.smoothing } };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class TrackingEngine {
  private state: TrackingState;
  private settings: TrackingSettings;
  private readonly stateListeners = new Set<() => void>();
  private readonly settingsListeners = new Set<() => void>();
  private readonly frameListeners = new Set<FrameListener>();

  private readonly camera: CameraController;
  private readonly associator = new HandAssociator();
  private readonly smoother: LandmarkSmoother;
  private readonly history = createMotionHistory();

  /** Bumped whenever the running session ends or changes; stale async work
   *  and stale loop callbacks compare against it and give up. */
  private run = 0;
  private loop: LoopHandle | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private landmarker: HandLandmarker | null = null;
  private simulator: SimulatorSource | null = null;
  private getLabel: OverlayLabelProvider | null = null;
  private simulatorBadge: string | undefined;

  private lastVideoTime = -1;
  private lastDetectTs = 0;
  private fpsFrames = 0;
  private fpsSince = 0;

  constructor(options: TrackingEngineOptions = {}) {
    this.settings = mergeSettings(DEFAULT_TRACKING_SETTINGS, options.settings);
    this.smoother = new LandmarkSmoother(this.settings.smoothing);
    this.state = {
      status: "idle",
      source: null,
      error: null,
      fps: 0,
      handCount: 0,
      facingMode: options.facingMode ?? "user",
      canFlip: false,
      cameraLive: false,
    };
    this.camera = new CameraController({ onStateChange: (cs) => this.onCameraState(cs) });
  }

  /* ------------------------- subscriptions ------------------------- */

  readonly getState = (): TrackingState => this.state;
  readonly getSettings = (): TrackingSettings => this.settings;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  };

  readonly subscribeSettings = (listener: () => void): (() => void) => {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  };

  /** Per-frame subscription. Called once for every processed frame, outside
   *  React. Returns an unsubscribe function. */
  readonly onFrame = (listener: FrameListener): (() => void) => {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  };

  readonly setOverlayLabelProvider = (provider: OverlayLabelProvider | null): void => {
    this.getLabel = provider;
  };

  readonly setSimulatorBadge = (text: string | undefined): void => {
    this.simulatorBadge = text;
  };

  readonly updateSettings = (patch: TrackingSettingsPatch): void => {
    this.settings = mergeSettings(this.settings, patch);
    this.smoother.configure(this.settings.smoothing);
    this.applyVideoStyle();
    for (const listener of this.settingsListeners) listener();
  };

  /* ---------------------------- actions ---------------------------- */

  /**
   * Starts the camera and loads the hand model in parallel. Call from a user
   * gesture. A call while the camera is already starting or running is ignored.
   */
  readonly startCamera = async (
    video: HTMLVideoElement | null,
    canvas: HTMLCanvasElement | null,
  ): Promise<void> => {
    if (!video || !canvas) {
      this.failWith({ code: "not_mounted", message: "The video and canvas elements are not mounted." });
      return;
    }
    const { status, source } = this.state;
    if (
      source === "camera" &&
      (status === "requesting_permission" || status === "loading_model" || status === "running")
    ) {
      return;
    }

    this.endSession();
    const run = this.run;
    this.video = video;
    this.attachCanvas(canvas);
    video.style.objectFit = "cover";

    const model = loadHandLandmarker();
    model.catch(() => undefined); // handled below; avoids an unhandled rejection

    const started = await this.camera.start({ video, facingMode: this.state.facingMode });
    if (run !== this.run || !started.ok) return;

    this.set({ status: "loading_model", source: "camera", cameraLive: this.camera.isLive() });
    let landmarker: HandLandmarker;
    try {
      landmarker = await model;
    } catch (err) {
      if (run !== this.run) return;
      this.failWith({
        code: "model_load_failed",
        message: err instanceof Error ? err.message : "The hand model could not be loaded.",
      });
      return;
    }
    if (run !== this.run || this.camera.getState().status !== "active") return;

    this.landmarker = landmarker;
    this.beginRunning("camera", run);
  };

  readonly startSimulator = (
    canvas: HTMLCanvasElement | null,
    options: Partial<SimulatorOptions> = {},
  ): void => {
    if (!canvas) {
      this.failWith({ code: "not_mounted", message: "The canvas element is not mounted." });
      return;
    }
    this.endSession();
    this.camera.stop();
    this.attachCanvas(canvas);
    this.simulator = createSimulatorSource(options);
    this.beginRunning("simulator", this.run);
  };

  readonly setSimulatorOptions = (patch: Partial<SimulatorOptions>): void => {
    this.simulator?.setOptions(patch);
  };

  readonly getSimulatorOptions = (): SimulatorOptions | null => this.simulator?.getOptions() ?? null;

  readonly stop = (): void => {
    this.endSession();
    this.camera.stop();
    this.set({
      status: "idle",
      source: null,
      error: null,
      fps: 0,
      handCount: 0,
      canFlip: false,
      cameraLive: false,
    });
  };

  /** Switches front/rear camera. Call from a user gesture. */
  readonly flip = async (): Promise<void> => {
    if (this.state.source !== "camera" || this.state.status !== "running" || !this.state.canFlip) return;
    this.cancelLoop();
    this.resetPipeline();
    const run = ++this.run;
    const flipped = await this.camera.flip();
    if (run !== this.run || !flipped.ok) return;
    this.beginRunning("camera", run);
  };

  /** Restarts the camera after a tab-hide pause. Call from a user gesture. */
  readonly resume = (): Promise<void> => {
    if (this.state.status !== "paused_hidden") return Promise.resolve();
    return this.startCamera(this.video, this.canvas);
  };

  /** Stops everything. The engine can be started again afterwards. */
  readonly dispose = (): void => {
    this.stop();
  };

  /* --------------------------- internals --------------------------- */

  private onCameraState(cs: CameraState): void {
    switch (cs.status) {
      case "requesting_permission":
        this.set({
          status: "requesting_permission",
          source: "camera",
          error: null,
          facingMode: cs.facingMode,
          canFlip: false,
          cameraLive: false,
          handCount: 0,
          fps: 0,
        });
        break;
      case "active":
        this.set({ facingMode: cs.facingMode, canFlip: cs.canFlip, cameraLive: this.camera.isLive() });
        this.applyVideoStyle();
        break;
      case "paused_hidden":
        this.endSession();
        this.set({
          status: "paused_hidden",
          source: null,
          error: null,
          fps: 0,
          handCount: 0,
          canFlip: false,
          cameraLive: false,
        });
        break;
      case "error":
        this.endSession();
        this.set({
          status: "error",
          source: null,
          error: cs.error,
          fps: 0,
          handCount: 0,
          canFlip: false,
          cameraLive: false,
        });
        break;
      case "idle":
        break;
    }
  }

  private failWith(error: TrackingError): void {
    this.endSession();
    this.camera.stop();
    this.set({
      status: "error",
      source: null,
      error,
      fps: 0,
      handCount: 0,
      canFlip: false,
      cameraLive: false,
    });
  }

  /** Cancels the loop and invalidates pending async work. Does not touch the
   *  camera stream: callers stop it themselves when they need to. */
  private endSession(): void {
    this.run++;
    this.cancelLoop();
    this.resetPipeline();
    this.simulator = null;
    this.landmarker = null;
    if (this.canvas) clearOverlay(this.canvas);
  }

  private resetPipeline(): void {
    this.associator.reset();
    this.smoother.resetAll();
    resetMotionHistory(this.history);
    this.lastVideoTime = -1;
    this.fpsFrames = 0;
    this.fpsSince = 0;
  }

  private attachCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvas !== canvas) {
      this.canvas = canvas;
      this.ctx = null;
    }
    if (!this.ctx) {
      try {
        this.ctx = canvas.getContext("2d");
      } catch {
        this.ctx = null;
      }
    }
  }

  private mirrorActive(): boolean {
    return this.state.source === "camera" && this.settings.mirror && this.state.facingMode === "user";
  }

  /** Mirrors the video element with CSS so the picture matches the overlay. */
  private applyVideoStyle(): void {
    if (!this.video) return;
    this.video.style.transform = this.mirrorActive() ? "scaleX(-1)" : "";
  }

  private beginRunning(source: FrameSource, run: number): void {
    this.set({
      status: "running",
      source,
      error: null,
      fps: 0,
      handCount: 0,
      cameraLive: source === "camera" && this.camera.isLive(),
      canFlip: source === "camera" && this.camera.getState().canFlip,
    });
    this.applyVideoStyle();
    this.schedule(run);
  }

  private schedule(run: number): void {
    const video = this.video;
    if (
      this.state.source === "camera" &&
      video &&
      typeof video.requestVideoFrameCallback === "function"
    ) {
      this.loop = {
        kind: "rvfc",
        id: video.requestVideoFrameCallback((now) => this.tick(run, now, true)),
      };
    } else {
      this.loop = { kind: "raf", id: requestAnimationFrame((now) => this.tick(run, now, false)) };
    }
  }

  private cancelLoop(): void {
    const loop = this.loop;
    this.loop = null;
    if (!loop) return;
    if (loop.kind === "rvfc") this.video?.cancelVideoFrameCallback?.(loop.id);
    else cancelAnimationFrame(loop.id);
  }

  private tick(run: number, now: number, isVideoFrame: boolean): void {
    if (run !== this.run) return;
    this.loop = null;
    if (this.state.source === "simulator") this.simulatorFrame(now);
    else this.cameraFrame(now, isVideoFrame);
    if (run === this.run) this.schedule(run);
  }

  private simulatorFrame(now: number): void {
    const simulator = this.simulator;
    if (!simulator) return;
    // With reduced motion the pose is frozen; timestamps still advance.
    const frame = simulator.nextFrame(now, prefersReducedMotion() ? 0 : now);
    this.deliver(frame, "simulator", now);
  }

  private cameraFrame(now: number, isVideoFrame: boolean): void {
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    if (!isVideoFrame) {
      if (video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = video.currentTime;
    }

    // detectForVideo needs strictly increasing timestamps.
    const timestamp = Math.max(now, this.lastDetectTs + 0.01);
    this.lastDetectTs = timestamp;

    let detections;
    try {
      detections = detectHands(landmarker, video, timestamp);
    } catch (err) {
      // Any error after the stream exists stops the camera (CAM-06).
      reportLandmarkerFailure();
      this.failWith({
        code: "tracking_failed",
        message: err instanceof Error ? err.message : "Hand tracking failed.",
        cause: err instanceof Error ? err.name : undefined,
      });
      return;
    }

    const result = this.associator.update(detections, video.videoWidth / video.videoHeight);
    for (const slot of [...result.resetSlots, ...result.releasedSlots]) {
      this.smoother.reset(slot);
      resetMotionHistory(this.history, slot);
    }
    const hands: TrackedHand[] = result.hands.map((h) => ({
      slot: h.slot,
      handedness: h.detection.handedness,
      handednessScore: h.detection.handednessScore,
      landmarks: this.smoother.smooth(h.slot, h.detection.landmarks, timestamp),
      ageFrames: h.ageFrames,
    }));

    this.deliver(
      { timestamp, imageWidth: video.videoWidth, imageHeight: video.videoHeight, hands },
      "camera",
      now,
    );
  }

  private deliver(frame: HandFrame, source: FrameSource, now: number): void {
    const features: FrameFeatures = extractFrameFeatures(frame, this.history);
    const run = this.run;
    for (const listener of this.frameListeners) {
      try {
        listener(features, { source });
      } catch (err) {
        // A faulty listener must not stop the camera loop; report it without
        // logging any landmark data.
        queueMicrotask(() => {
          throw err;
        });
      }
    }
    if (run !== this.run) return; // a listener stopped tracking

    if (this.canvas && this.ctx) {
      renderOverlay(this.ctx, syncCanvasSize(this.canvas), {
        frame,
        source,
        mirror: this.mirrorActive(),
        settings: this.settings,
        getLabel: this.getLabel,
        simulatorBadge: this.simulatorBadge,
      });
    }

    this.fpsFrames++;
    if (this.fpsSince === 0) {
      this.fpsSince = now;
      this.fpsFrames = 0;
    }
    const patch: Partial<TrackingState> = {};
    const elapsed = now - this.fpsSince;
    if (elapsed >= FPS_INTERVAL_MS) {
      patch.fps = Math.round((this.fpsFrames * 1000) / elapsed);
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
    if (features.handCount !== this.state.handCount) patch.handCount = features.handCount;
    if (source === "camera") {
      const live = this.camera.isLive();
      if (live !== this.state.cameraLive) patch.cameraLive = live;
      const canFlip = this.camera.getState().canFlip;
      if (canFlip !== this.state.canFlip) patch.canFlip = canFlip;
    }
    this.set(patch);
  }

  private set(patch: Partial<TrackingState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof TrackingState)[]) {
      if (patch[key] !== this.state[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.stateListeners) listener();
  }
}
