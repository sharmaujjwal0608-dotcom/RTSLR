import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrameFeatures } from "@/types/recognition";
import { TrackingEngine } from "./engine";
import { openHand } from "./fixtures";
import {
  deferred,
  fakeStream,
  fakeVideo,
  flush,
  installMediaDevices,
  removeMediaDevices,
  setSecureContext,
  setVisibility,
} from "./testing";
import type { FrameMeta, RawHandDetection } from "./types";

const landmarkerMock = vi.hoisted(() => ({
  load: vi.fn(),
  detect: vi.fn(),
  reportFailure: vi.fn(),
}));

vi.mock("./landmarker", () => ({
  loadHandLandmarker: landmarkerMock.load,
  detectHands: landmarkerMock.detect,
  reportLandmarkerFailure: landmarkerMock.reportFailure,
}));

/** Manual animation-frame queue. */
function installRaf() {
  let nextId = 1;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue.delete(id);
  });
  return {
    pending: () => queue.size,
    step(now: number) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(now);
    },
  };
}

const fakeCanvas = () =>
  ({ getContext: () => null, width: 0, height: 0, clientWidth: 640, clientHeight: 480 }) as unknown as HTMLCanvasElement;

const detection = (x: number): RawHandDetection => ({
  landmarks: openHand(x),
  handedness: "Right",
  handednessScore: 0.9,
});

describe("TrackingEngine", () => {
  let raf: ReturnType<typeof installRaf>;
  let engine: TrackingEngine;
  let frames: { features: FrameFeatures; meta: FrameMeta }[];

  beforeEach(() => {
    raf = installRaf();
    setSecureContext(true);
    setVisibility("visible");
    landmarkerMock.load.mockReset().mockResolvedValue({});
    landmarkerMock.detect.mockReset().mockReturnValue([]);
    landmarkerMock.reportFailure.mockReset();
    engine = new TrackingEngine();
    frames = [];
    engine.onFrame((features, meta) => frames.push({ features, meta }));
  });

  afterEach(() => {
    engine.dispose();
    removeMediaDevices();
    vi.unstubAllGlobals();
  });

  it("starts idle with no source", () => {
    expect(engine.getState()).toMatchObject({ status: "idle", source: null, error: null, handCount: 0 });
  });

  describe("simulator", () => {
    it("delivers frames labelled as simulator and never touches the camera", () => {
      const media = installMediaDevices(() => Promise.resolve(fakeStream()));
      engine.startSimulator(fakeCanvas(), { pose: "B", twoHands: true });
      expect(engine.getState()).toMatchObject({ status: "running", source: "simulator", cameraLive: false });

      raf.step(1000);
      raf.step(1033);
      expect(frames).toHaveLength(2);
      expect(frames.every((f) => f.meta.source === "simulator")).toBe(true);
      expect(frames[1].features.handCount).toBe(2);
      expect(frames[1].features.dual).toHaveLength(156);
      expect(engine.getState().handCount).toBe(2);
      expect(media.getUserMedia).not.toHaveBeenCalled();
      expect(landmarkerMock.load).not.toHaveBeenCalled();
    });

    it("reports no hands while paused and stops delivering after stop()", () => {
      engine.startSimulator(fakeCanvas());
      raf.step(0);
      engine.setSimulatorOptions({ paused: true });
      raf.step(33);
      expect(frames[1].features.handCount).toBe(0);
      expect(engine.getState().handCount).toBe(0);

      engine.stop();
      expect(raf.pending()).toBe(0);
      raf.step(66);
      expect(frames).toHaveLength(2);
      expect(engine.getState()).toMatchObject({ status: "idle", source: null });
    });

    it("stops calling a listener after it unsubscribes", () => {
      const listener = vi.fn();
      const off = engine.onFrame(listener);
      engine.startSimulator(fakeCanvas());
      raf.step(0);
      off();
      raf.step(33);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("publishes fps about twice a second without a state change per frame", () => {
      const onState = vi.fn();
      engine.startSimulator(fakeCanvas());
      raf.step(0);
      engine.subscribe(onState);
      for (let i = 1; i <= 20; i++) raf.step(i * 40);
      expect(engine.getState().fps).toBe(25);
      expect(onState.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe("camera", () => {
    it("reports an error instead of starting when the elements are not mounted", async () => {
      const media = installMediaDevices(() => Promise.resolve(fakeStream()));
      await engine.startCamera(null, null);
      expect(engine.getState()).toMatchObject({ status: "error", error: { code: "not_mounted" } });
      expect(media.getUserMedia).not.toHaveBeenCalled();
    });

    it("goes through permission, model loading and running, then delivers camera frames", async () => {
      const stream = fakeStream();
      installMediaDevices(() => Promise.resolve(stream));
      const model = deferred<object>();
      landmarkerMock.load.mockReturnValue(model.promise);
      landmarkerMock.detect.mockReturnValue([detection(0.4)]);
      const video = fakeVideo();
      const statuses: string[] = [];
      engine.subscribe(() => statuses.push(engine.getState().status));

      const started = engine.startCamera(video, fakeCanvas());
      expect(engine.getState()).toMatchObject({ status: "requesting_permission", source: "camera" });
      await flush(10);
      expect(engine.getState()).toMatchObject({ status: "loading_model", cameraLive: true });
      model.resolve({});
      await started;
      expect(engine.getState()).toMatchObject({ status: "running", source: "camera" });
      expect(new Set(statuses)).toEqual(new Set(["requesting_permission", "loading_model", "running"]));

      (video as unknown as { currentTime: number }).currentTime = 0.1;
      raf.step(100);
      expect(frames).toHaveLength(1);
      expect(frames[0].meta.source).toBe("camera");
      expect(frames[0].features.handCount).toBe(1);
      expect(frames[0].features.perHand[0]).toMatchObject({ slot: 0, handedness: "Right" });
      expect(frames[0].features.frame).toMatchObject({ imageWidth: 640, imageHeight: 480 });

      // Same video time again: no new frame is processed.
      raf.step(116);
      expect(frames).toHaveLength(1);
      expect(video.style.transform).toBe("scaleX(-1)");
    });

    it("stops the stream when stop() is called while the model is loading", async () => {
      const stream = fakeStream();
      installMediaDevices(() => Promise.resolve(stream));
      const model = deferred<object>();
      landmarkerMock.load.mockReturnValue(model.promise);
      const video = fakeVideo();

      const started = engine.startCamera(video, fakeCanvas());
      await flush(10);
      expect(engine.getState().status).toBe("loading_model");
      engine.stop();
      expect(stream.tracks[0].readyState).toBe("ended");
      expect(video.srcObject).toBeNull();

      model.resolve({});
      await started;
      expect(engine.getState()).toMatchObject({ status: "idle", source: null, cameraLive: false });
      expect(raf.pending()).toBe(0);
    });

    it("stops a late stream when stop() is called during the permission prompt", async () => {
      const pending = deferred<MediaStream>();
      installMediaDevices(() => pending.promise);
      const video = fakeVideo();
      const started = engine.startCamera(video, fakeCanvas());
      engine.stop();
      const late = fakeStream();
      pending.resolve(late);
      await started;
      expect(late.tracks[0].stop).toHaveBeenCalled();
      expect(video.srcObject).toBeNull();
      expect(engine.getState().status).toBe("idle");
      expect(raf.pending()).toBe(0);
    });

    it("ignores a second startCamera while one is in progress", async () => {
      const pending = deferred<MediaStream>();
      const media = installMediaDevices(() => pending.promise);
      const video = fakeVideo();
      const canvas = fakeCanvas();
      const first = engine.startCamera(video, canvas);
      await engine.startCamera(video, canvas);
      expect(media.getUserMedia).toHaveBeenCalledTimes(1);
      pending.resolve(fakeStream());
      await first;
      await engine.startCamera(video, canvas);
      expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it("reports a model problem, not a camera problem, and stops the camera", async () => {
      const stream = fakeStream();
      installMediaDevices(() => Promise.resolve(stream));
      landmarkerMock.load.mockRejectedValue(new Error("Hand tracking could not be loaded"));
      const video = fakeVideo();
      await engine.startCamera(video, fakeCanvas());
      expect(engine.getState()).toMatchObject({
        status: "error",
        error: { code: "model_load_failed" },
        cameraLive: false,
      });
      expect(stream.tracks[0].readyState).toBe("ended");
      expect(video.srcObject).toBeNull();
    });

    it("surfaces a denied permission with its own code", async () => {
      const denied = new Error("denied");
      denied.name = "NotAllowedError";
      installMediaDevices(() => Promise.reject(denied));
      await engine.startCamera(fakeVideo(), fakeCanvas());
      expect(engine.getState()).toMatchObject({ status: "error", error: { code: "permission_denied" } });
    });

    it("stops the camera when the detector throws", async () => {
      const stream = fakeStream();
      installMediaDevices(() => Promise.resolve(stream));
      landmarkerMock.detect.mockImplementation(() => {
        throw new Error("graph failed");
      });
      const video = fakeVideo();
      await engine.startCamera(video, fakeCanvas());
      (video as unknown as { currentTime: number }).currentTime = 0.1;
      raf.step(100);
      expect(engine.getState()).toMatchObject({ status: "error", error: { code: "tracking_failed" } });
      expect(stream.tracks[0].readyState).toBe("ended");
      expect(landmarkerMock.reportFailure).toHaveBeenCalledTimes(1);
      expect(raf.pending()).toBe(0);
    });

    it("pauses on tab hide, cancels the loop and resumes only on request", async () => {
      const media = installMediaDevices(() => Promise.resolve(fakeStream()));
      const video = fakeVideo();
      await engine.startCamera(video, fakeCanvas());
      expect(raf.pending()).toBe(1);

      setVisibility("hidden");
      expect(engine.getState()).toMatchObject({ status: "paused_hidden", source: null, cameraLive: false });
      expect(raf.pending()).toBe(0);

      setVisibility("visible");
      await flush(10);
      expect(engine.getState().status).toBe("paused_hidden");
      expect(media.getUserMedia).toHaveBeenCalledTimes(1);

      await engine.resume();
      expect(engine.getState().status).toBe("running");
      expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    });

    it("switching to the simulator stops the camera", async () => {
      const stream = fakeStream();
      installMediaDevices(() => Promise.resolve(stream));
      await engine.startCamera(fakeVideo(), fakeCanvas());
      engine.startSimulator(fakeCanvas());
      expect(stream.tracks[0].readyState).toBe("ended");
      expect(engine.getState()).toMatchObject({ status: "running", source: "simulator", cameraLive: false });
    });

    it("keeps slot identity when the detector swaps its output order", async () => {
      installMediaDevices(() => Promise.resolve(fakeStream()));
      const video = fakeVideo();
      await engine.startCamera(video, fakeCanvas());
      const setTime = (t: number) => ((video as unknown as { currentTime: number }).currentTime = t);

      landmarkerMock.detect.mockReturnValue([detection(0.3), detection(0.7)]);
      setTime(0.1);
      raf.step(100);
      landmarkerMock.detect.mockReturnValue([detection(0.7), detection(0.3)]);
      setTime(0.2);
      raf.step(133);

      const xs = frames.map((f) => f.features.frame.hands.map((h) => h.landmarks[0].x));
      expect(xs[1][0]).toBeCloseTo(xs[0][0], 5);
      expect(xs[1][1]).toBeCloseTo(xs[0][1], 5);
      expect(frames[1].features.frame.hands.map((h) => h.ageFrames)).toEqual([2, 2]);
    });
  });
});
