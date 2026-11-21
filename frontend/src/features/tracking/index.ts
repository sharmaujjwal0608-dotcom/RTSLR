/** Public API of the tracking layer. See README.md in this folder. */
export { useHandTracking } from "./useHandTracking";
export type { UseHandTrackingOptions, UseHandTrackingResult } from "./useHandTracking";

export { TrackingEngine, DEFAULT_TRACKING_SETTINGS } from "./engine";
export type { TrackingEngineOptions, TrackingSettingsPatch } from "./engine";

export type {
  CameraErrorCode,
  FacingMode,
  FrameListener,
  FrameMeta,
  FrameSource,
  OverlayLabelProvider,
  RawHandDetection,
  SmoothingSettings,
  TrackingError,
  TrackingErrorCode,
  TrackingSettings,
  TrackingState,
  TrackingStatus,
} from "./types";

export {
  FINGERTIP_INDICES,
  MIN_PALM_LENGTH,
  DEFAULT_MOTION,
  aspectCorrect,
  createMotionHistory,
  dualHandVector,
  dualHandVectorOrdered,
  estimateHandOrientation,
  extractFrameFeatures,
  orderHandsAB,
  palmLength,
  palmNormal,
  resetMotionHistory,
  singleHandVector,
} from "./features";
export type {
  HandOrientation,
  MotionHistory,
  MotionOptions,
  PalmFacing,
  PointingDirection,
  Vec3,
} from "./features";

export { CameraController, classifyCameraError } from "./camera";
export type { CameraStartOptions, CameraStartResult, CameraState, CameraStatus } from "./camera";

export {
  DEFAULT_HAND_MODEL_URL,
  MEDIAPIPE_WASM_PATH,
  disposeHandLandmarker,
  getHandModelUrl,
  getLandmarkerLoadState,
  loadHandLandmarker,
  subscribeLandmarkerLoadState,
} from "./landmarker";
export type { LandmarkerDelegate, LandmarkerLoadState } from "./landmarker";

export { DEFAULT_ASSOCIATION, HandAssociator } from "./association";
export type { AssociatedHand, AssociationOptions, AssociationResult } from "./association";

export { DEFAULT_SMOOTHING, LandmarkSmoother, OneEuroFilter } from "./smoothing";

export {
  DEFAULT_SIMULATOR_OPTIONS,
  SIMULATOR_IMAGE,
  SIMULATOR_POSES,
  buildSyntheticHand,
  createSimulatorSource,
} from "./simulator";
export type { SimulatorOptions, SimulatorPose, SimulatorSource, SyntheticHandOptions } from "./simulator";

export {
  DEFAULT_SIMULATOR_BADGE,
  HAND_CONNECTIONS,
  clearOverlay,
  getCoverTransform,
  projectLandmarks,
  renderOverlay,
  syncCanvasSize,
} from "./overlay";
export type { CanvasSize, CoverTransform, OverlayInput } from "./overlay";
