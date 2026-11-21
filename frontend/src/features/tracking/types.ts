/**
 * Feature-local types for the tracking layer. Shared contracts live in
 * `@/types/recognition`; nothing here changes them.
 */
import type { FrameFeatures, Handedness, Landmark, TrackedHand } from "@/types/recognition";

/** Where a frame came from. Carried next to every frame so synthetic input can
 *  never be mistaken for camera input. */
export type FrameSource = "camera" | "simulator";

export type FacingMode = "user" | "environment";

/** One hand as reported by the detector, before identity association. */
export type RawHandDetection = {
  /** 21 landmarks in unmirrored image coordinates. */
  landmarks: Landmark[];
  handedness: Handedness;
  handednessScore: number;
};

export type TrackingStatus =
  | "idle"
  | "requesting_permission"
  | "loading_model"
  | "running"
  | "paused_hidden"
  | "error";

export type CameraErrorCode =
  /** NotAllowedError / SecurityError: the user or a policy refused the camera. */
  | "permission_denied"
  /** NotFoundError / OverconstrainedError: no suitable camera. */
  | "no_camera"
  /** NotReadableError / AbortError: another application holds the camera. */
  | "camera_busy"
  /** The page is not served over HTTPS or localhost. */
  | "insecure_context"
  /** The browser has no getUserMedia. */
  | "unsupported_browser"
  /** A live track ended (device unplugged or permission revoked). */
  | "camera_disconnected"
  /** The stream was obtained but the video element could not play it. */
  | "playback_failed"
  | "camera_unknown";

export type TrackingErrorCode =
  | CameraErrorCode
  /** The hand model or its wasm runtime failed to load. Not a camera problem. */
  | "model_load_failed"
  /** The detector threw while processing a frame. */
  | "tracking_failed"
  /** startCamera was called before the video/canvas elements were mounted. */
  | "not_mounted";

export type TrackingError = {
  code: TrackingErrorCode;
  /** Developer-oriented English text. The UI should translate by `code`. */
  message: string;
  /** `name` of the underlying DOMException/Error when there is one. */
  cause?: string;
};

export type SmoothingSettings = {
  enabled: boolean;
  /** One Euro minimum cutoff in Hz: lower = steadier when the hand is still. */
  minCutoff: number;
  /** One Euro speed coefficient: higher = less lag when the hand moves. */
  beta: number;
  /** Cutoff in Hz of the derivative low-pass. */
  dCutoff: number;
};

export type TrackingSettings = {
  /** Mirror the display for the front camera. Landmarks stay unmirrored. */
  mirror: boolean;
  showSkeleton: boolean;
  showBoundingBox: boolean;
  showLabels: boolean;
  smoothing: SmoothingSettings;
};

export type TrackingState = {
  status: TrackingStatus;
  /** Source of the frames being produced, or null when nothing runs. */
  source: FrameSource | null;
  error: TrackingError | null;
  /** Processed frames per second, refreshed about twice a second. */
  fps: number;
  handCount: 0 | 1 | 2;
  facingMode: FacingMode;
  /** True when a camera is running and more than one video input exists. */
  canFlip: boolean;
  /** True while at least one camera track is really live (CAM-09). */
  cameraLive: boolean;
};

export type FrameMeta = { source: FrameSource };

export type FrameListener = (features: FrameFeatures, meta: FrameMeta) => void;

/** Returns the text for the chip next to a hand, or null for no chip.
 *  The tracking layer never classifies: the consumer supplies this. */
export type OverlayLabelProvider = (slot: 0 | 1, hand: TrackedHand) => string | null;
