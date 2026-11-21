/**
 * CameraController: the single place in the app that calls getUserMedia
 * (docs/SECURITY_PRIVACY.md CAM-02 to CAM-07, CAM-09, CAM-15, CAM-17).
 *
 * - Video only, never audio.
 * - Every start attempt carries a token. If stop(), flip(), a tab hide or a
 *   page hide happens while the permission prompt is pending, the stream that
 *   arrives late is stopped immediately and never attached.
 * - A second start() while one is pending or active returns the same attempt
 *   and does not open a second stream.
 * - The camera stops on track `ended`, on any error after the stream exists,
 *   when the tab becomes hidden and on `pagehide`. It never restarts itself:
 *   the state becomes `paused_hidden` and the UI offers Resume.
 * - No recording or frame export API is used anywhere in this module.
 */
import type { CameraErrorCode, FacingMode, TrackingError } from "./types";

export type CameraStatus = "idle" | "requesting_permission" | "active" | "paused_hidden" | "error";

export type CameraState = {
  status: CameraStatus;
  facingMode: FacingMode;
  error: TrackingError | null;
  /** More than one video input exists (known only once a camera is active). */
  canFlip: boolean;
};

export type CameraStartOptions = {
  facingMode?: FacingMode;
  /** Element the stream is attached to and played in. */
  video: HTMLVideoElement;
};

export type CameraStartResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "error"; error: TrackingError };

export type CameraControllerOptions = {
  onStateChange?: (state: CameraState) => void;
};

const ERROR_BY_NAME: Record<string, CameraErrorCode> = {
  NotAllowedError: "permission_denied",
  PermissionDeniedError: "permission_denied",
  SecurityError: "permission_denied",
  NotFoundError: "no_camera",
  DevicesNotFoundError: "no_camera",
  OverconstrainedError: "no_camera",
  NotReadableError: "camera_busy",
  TrackStartError: "camera_busy",
  AbortError: "camera_busy",
};

const ERROR_MESSAGES: Record<CameraErrorCode, string> = {
  permission_denied: "Camera permission was denied.",
  no_camera: "No suitable camera was found.",
  camera_busy: "The camera could not be read; another application may be using it.",
  insecure_context: "Camera access needs a secure context (HTTPS or localhost).",
  unsupported_browser: "This browser does not support camera access.",
  camera_disconnected: "The camera stopped: it was disconnected or its permission was revoked.",
  playback_failed: "The camera stream could not be played.",
  camera_unknown: "The camera could not be started.",
};

export function cameraError(code: CameraErrorCode, cause?: unknown): TrackingError {
  const name =
    typeof cause === "object" && cause !== null && "name" in cause
      ? String((cause as { name: unknown }).name)
      : undefined;
  return { code, message: ERROR_MESSAGES[code], ...(name ? { cause: name } : {}) };
}

/** Maps a getUserMedia rejection to a distinct error code (CAM-15). */
export function classifyCameraError(err: unknown): TrackingError {
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  return cameraError(ERROR_BY_NAME[name] ?? "camera_unknown", err);
}

function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track that cannot be stopped is already dead.
    }
  }
}

export class CameraController {
  private state: CameraState = { status: "idle", facingMode: "user", error: null, canFlip: false };
  private attempt = 0;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private pending: Promise<CameraStartResult> | null = null;
  private trackCleanups: (() => void)[] = [];
  private pageListenersOn = false;

  constructor(private readonly options: CameraControllerOptions = {}) {}

  getState(): CameraState {
    return this.state;
  }

  /** The stream currently attached, or null. */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /** True while at least one track of the open stream is really live. */
  isLive(): boolean {
    return !!this.stream && this.stream.getTracks().some((t) => t.readyState === "live");
  }

  /**
   * Requests the camera. Must be called from a user gesture (CAM-01).
   * Never rejects: failures and cancellations come back in the result.
   */
  start(options: CameraStartOptions): Promise<CameraStartResult> {
    if (this.state.status === "requesting_permission" && this.pending) return this.pending;
    if (this.state.status === "active" && this.stream) {
      return Promise.resolve({ ok: true, stream: this.stream });
    }
    const facingMode = options.facingMode ?? this.state.facingMode;
    const pending = this.begin(options.video, facingMode);
    this.pending = pending;
    void pending.finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    return pending;
  }

  /** Stops everything and returns to `idle`. Safe to call at any time. */
  stop(): void {
    this.release();
    this.setState({ status: "idle", error: null, canFlip: false });
  }

  /**
   * Switches between the front and rear camera. Call from a user gesture.
   * Only acts while a camera is active; the old stream is stopped first.
   */
  flip(): Promise<CameraStartResult> {
    const video = this.video;
    if (this.state.status !== "active" || !video) {
      return Promise.resolve({ ok: false, reason: "cancelled" });
    }
    const next: FacingMode = this.state.facingMode === "user" ? "environment" : "user";
    this.release();
    this.pending = null;
    return this.start({ video, facingMode: next });
  }

  /** Stops the camera and removes every listener. */
  dispose(): void {
    this.stop();
  }

  /* ---------------------------------------------------------------- */

  private async begin(video: HTMLVideoElement, facingMode: FacingMode): Promise<CameraStartResult> {
    this.release();
    const token = ++this.attempt;
    this.video = video;

    const nav = typeof navigator === "undefined" ? undefined : navigator;
    if (!nav?.mediaDevices || typeof nav.mediaDevices.getUserMedia !== "function") {
      const insecure = typeof window !== "undefined" && window.isSecureContext === false;
      return this.fail(cameraError(insecure ? "insecure_context" : "unsupported_browser"), facingMode);
    }

    this.setState({ status: "requesting_permission", facingMode, error: null, canFlip: false });
    this.addPageListeners();

    let stream: MediaStream;
    try {
      stream = await nav.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      if (token !== this.attempt) return { ok: false, reason: "cancelled" };
      return this.fail(classifyCameraError(err), facingMode);
    }

    if (token !== this.attempt) {
      // Stale attempt: stop the late stream, never attach it (CAM-04).
      stopStream(stream);
      return { ok: false, reason: "cancelled" };
    }

    this.stream = stream;
    for (const track of stream.getTracks()) {
      const onEnded = () => {
        if (this.stream === stream) this.fail(cameraError("camera_disconnected"), this.state.facingMode);
      };
      track.addEventListener("ended", onEnded);
      this.trackCleanups.push(() => track.removeEventListener("ended", onEnded));
    }

    try {
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      if (token !== this.attempt) return { ok: false, reason: "cancelled" };
      return this.fail(cameraError("playback_failed", err), facingMode);
    }
    if (token !== this.attempt) return { ok: false, reason: "cancelled" };

    const reported = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
    const actual: FacingMode =
      reported === "user" || reported === "environment" ? reported : facingMode;
    this.setState({ status: "active", facingMode: actual, error: null });
    void this.detectFlip(token);
    return { ok: true, stream };
  }

  /** Counts video inputs. Runs only after the camera started (CAM-17);
   *  nothing about the devices is stored. */
  private async detectFlip(token: number): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (token !== this.attempt || this.state.status !== "active") return;
      const canFlip = devices.filter((d) => d.kind === "videoinput").length > 1;
      if (canFlip !== this.state.canFlip) this.setState({ canFlip });
    } catch {
      // Unknown device count: leave flipping off.
    }
  }

  private fail(error: TrackingError, facingMode: FacingMode): CameraStartResult {
    this.release();
    this.setState({ status: "error", facingMode, error, canFlip: false });
    return { ok: false, reason: "error", error };
  }

  /** Invalidates the current attempt and frees the stream, the video element
   *  and all listeners. Does not change the public status. */
  private release(): void {
    this.attempt++;
    for (const cleanup of this.trackCleanups) cleanup();
    this.trackCleanups = [];
    stopStream(this.stream);
    this.stream = null;
    if (this.video) {
      try {
        this.video.pause();
      } catch {
        // Nothing was playing.
      }
      this.video.srcObject = null;
    }
    this.removePageListeners();
  }

  private readonly onVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") this.pauseHidden();
  };

  private readonly onPageHide = () => this.pauseHidden();

  private pauseHidden(): void {
    const { status } = this.state;
    if (status !== "active" && status !== "requesting_permission") return;
    this.release();
    this.setState({ status: "paused_hidden", error: null, canFlip: false });
  }

  private addPageListeners(): void {
    if (this.pageListenersOn || typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.onPageHide);
    this.pageListenersOn = true;
  }

  private removePageListeners(): void {
    if (!this.pageListenersOn) return;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pagehide", this.onPageHide);
    this.pageListenersOn = false;
  }

  private setState(patch: Partial<CameraState>): void {
    this.state = { ...this.state, ...patch };
    this.options.onStateChange?.(this.state);
  }
}
