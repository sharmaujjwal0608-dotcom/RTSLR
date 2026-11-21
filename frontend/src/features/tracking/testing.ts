/**
 * Test doubles for camera tests. Imported by *.test.ts files only; nothing
 * here touches a real camera.
 */
import { vi } from "vitest";

export class FakeTrack extends EventTarget {
  readonly kind = "video";
  readyState: "live" | "ended" = "live";
  constructor(private readonly facingMode?: string) {
    super();
  }
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  getSettings = () => (this.facingMode ? { facingMode: this.facingMode } : {});
  /** Simulates the device being unplugged or the permission being revoked. */
  end(): void {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

export type FakeStream = MediaStream & { tracks: FakeTrack[] };

export function fakeStream(trackCount = 1, facingMode?: string): FakeStream {
  const tracks = Array.from({ length: trackCount }, () => new FakeTrack(facingMode));
  return { tracks, getTracks: () => tracks, getVideoTracks: () => tracks } as unknown as FakeStream;
}

export type FakeVideo = HTMLVideoElement & { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };

export function fakeVideo(): FakeVideo {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 0,
    style: {},
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  } as unknown as FakeVideo;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function domError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

export type MediaDevicesMock = {
  getUserMedia: ReturnType<typeof vi.fn>;
  enumerateDevices: ReturnType<typeof vi.fn>;
};

/** Installs a mocked `navigator.mediaDevices`; pass null to remove it. */
export function installMediaDevices(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  videoInputs = 1,
): MediaDevicesMock {
  const mock: MediaDevicesMock = {
    getUserMedia: vi.fn(getUserMedia),
    enumerateDevices: vi.fn(() =>
      Promise.resolve(Array.from({ length: videoInputs }, () => ({ kind: "videoinput" }))),
    ),
  };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: mock });
  return mock;
}

export function removeMediaDevices(): void {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
}

export function setSecureContext(value: boolean): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

export function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Lets pending promise callbacks run. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
