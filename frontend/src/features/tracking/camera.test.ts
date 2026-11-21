import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraController, classifyCameraError, type CameraState } from "./camera";
import {
  deferred,
  domError,
  fakeStream,
  fakeVideo,
  flush,
  installMediaDevices,
  removeMediaDevices,
  setSecureContext,
  setVisibility,
} from "./testing";

describe("CameraController", () => {
  let controller: CameraController;
  let states: CameraState[];

  beforeEach(() => {
    setSecureContext(true);
    setVisibility("visible");
    states = [];
    controller = new CameraController({ onStateChange: (s) => states.push(s) });
  });

  afterEach(() => {
    controller.dispose();
    removeMediaDevices();
  });

  it("requests video only, never audio (CAM-02)", async () => {
    const media = installMediaDevices(() => Promise.resolve(fakeStream()));
    await controller.start({ video: fakeVideo() });
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    const constraints = media.getUserMedia.mock.calls[0][0];
    expect(constraints.audio).toBe(false);
    expect(constraints.video.facingMode).toEqual({ ideal: "user" });
  });

  it("attaches the stream, plays it and becomes active", async () => {
    const stream = fakeStream();
    installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    const result = await controller.start({ video });
    expect(result).toEqual({ ok: true, stream });
    expect(video.srcObject).toBe(stream);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(controller.getState().status).toBe("active");
    expect(controller.isLive()).toBe(true);
    expect(states.map((s) => s.status)).toEqual(["requesting_permission", "active"]);
  });

  it("does not call getUserMedia until start() is called", () => {
    const media = installMediaDevices(() => Promise.resolve(fakeStream()));
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(media.enumerateDevices).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe("idle");
  });

  it("stops a stream that arrives after stop() and never attaches it (CAM-04)", async () => {
    const pending = deferred<MediaStream>();
    installMediaDevices(() => pending.promise);
    const video = fakeVideo();
    const started = controller.start({ video });
    expect(controller.getState().status).toBe("requesting_permission");

    controller.stop();
    expect(controller.getState().status).toBe("idle");

    const late = fakeStream(2);
    pending.resolve(late);
    expect(await started).toEqual({ ok: false, reason: "cancelled" });
    for (const track of late.tracks) {
      expect(track.stop).toHaveBeenCalledTimes(1);
      expect(track.readyState).toBe("ended");
    }
    expect(video.srcObject).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe("idle");
    expect(controller.isLive()).toBe(false);
  });

  it("stays idle when a cancelled request is later rejected", async () => {
    const pending = deferred<MediaStream>();
    installMediaDevices(() => pending.promise);
    const started = controller.start({ video: fakeVideo() });
    controller.stop();
    pending.reject(domError("NotAllowedError"));
    expect(await started).toEqual({ ok: false, reason: "cancelled" });
    expect(controller.getState()).toMatchObject({ status: "idle", error: null });
  });

  it("does not open a second stream for a second start while pending (CAM-05)", async () => {
    const pending = deferred<MediaStream>();
    const media = installMediaDevices(() => pending.promise);
    const video = fakeVideo();
    const first = controller.start({ video });
    const second = controller.start({ video });
    expect(second).toBe(first);
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    pending.resolve(fakeStream());
    await first;
    await controller.start({ video });
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("stops the stale stream when stop and a new start happen during the prompt", async () => {
    const first = deferred<MediaStream>();
    const second = deferred<MediaStream>();
    const queue = [first, second];
    const media = installMediaDevices(() => queue.shift()!.promise);
    const video = fakeVideo();

    const startA = controller.start({ video });
    controller.stop();
    const startB = controller.start({ video });
    expect(media.getUserMedia).toHaveBeenCalledTimes(2);

    const streamA = fakeStream();
    const streamB = fakeStream();
    first.resolve(streamA);
    expect(await startA).toEqual({ ok: false, reason: "cancelled" });
    expect(streamA.tracks[0].stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();

    second.resolve(streamB);
    expect(await startB).toEqual({ ok: true, stream: streamB });
    expect(video.srcObject).toBe(streamB);
    expect(streamB.tracks[0].stop).not.toHaveBeenCalled();
  });

  it("stops every track and detaches the video on stop() (CAM-06)", async () => {
    const stream = fakeStream(2);
    installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    await controller.start({ video });
    controller.stop();
    expect(stream.tracks.every((t) => t.readyState === "ended")).toBe(true);
    expect(video.srcObject).toBeNull();
    expect(video.pause).toHaveBeenCalled();
    expect(controller.getState().status).toBe("idle");
  });

  it.each([
    ["NotAllowedError", "permission_denied"],
    ["SecurityError", "permission_denied"],
    ["NotFoundError", "no_camera"],
    ["OverconstrainedError", "no_camera"],
    ["NotReadableError", "camera_busy"],
    ["AbortError", "camera_busy"],
    ["SomethingElse", "camera_unknown"],
  ])("maps %s to %s (CAM-15)", async (name, code) => {
    installMediaDevices(() => Promise.reject(domError(name)));
    const video = fakeVideo();
    const result = await controller.start({ video });
    expect(result).toMatchObject({ ok: false, reason: "error", error: { code, cause: name } });
    expect(controller.getState()).toMatchObject({ status: "error", error: { code } });
    expect(video.srcObject).toBeNull();
    expect(classifyCameraError(domError(name)).code).toBe(code);
  });

  it("reports an insecure context when mediaDevices is missing over http", async () => {
    removeMediaDevices();
    setSecureContext(false);
    const result = await controller.start({ video: fakeVideo() });
    expect(result).toMatchObject({ ok: false, error: { code: "insecure_context" } });
  });

  it("reports an unsupported browser when mediaDevices is missing in a secure context", async () => {
    removeMediaDevices();
    setSecureContext(true);
    const result = await controller.start({ video: fakeVideo() });
    expect(result).toMatchObject({ ok: false, error: { code: "unsupported_browser" } });
    expect(controller.getState().status).toBe("error");
  });

  it("stops the stream when video.play() rejects", async () => {
    const stream = fakeStream();
    installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    video.play.mockRejectedValueOnce(domError("NotSupportedError"));
    const result = await controller.start({ video });
    expect(result).toMatchObject({ ok: false, error: { code: "playback_failed" } });
    expect(stream.tracks[0].stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it("stops the stream if stop() is called while video.play() is pending", async () => {
    const stream = fakeStream();
    installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    const playing = deferred<void>();
    video.play.mockReturnValueOnce(playing.promise);
    const started = controller.start({ video });
    await flush();
    expect(video.srcObject).toBe(stream);
    controller.stop();
    playing.resolve();
    expect(await started).toEqual({ ok: false, reason: "cancelled" });
    expect(stream.tracks[0].readyState).toBe("ended");
    expect(video.srcObject).toBeNull();
    expect(controller.getState().status).toBe("idle");
  });

  it("stops the remaining tracks when one track ends", async () => {
    const stream = fakeStream(2);
    installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    await controller.start({ video });
    stream.tracks[0].end();
    expect(stream.tracks[1].stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(controller.getState()).toMatchObject({ status: "error", error: { code: "camera_disconnected" } });
    expect(controller.isLive()).toBe(false);
  });

  it("pauses when the tab is hidden and does not restart by itself (CAM-07)", async () => {
    const stream = fakeStream();
    const media = installMediaDevices(() => Promise.resolve(stream));
    const video = fakeVideo();
    await controller.start({ video });

    setVisibility("hidden");
    expect(controller.getState().status).toBe("paused_hidden");
    expect(stream.tracks[0].readyState).toBe("ended");
    expect(video.srcObject).toBeNull();

    setVisibility("visible");
    await flush();
    expect(controller.getState().status).toBe("paused_hidden");
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);

    // Resume is an explicit new start.
    await controller.start({ video });
    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(controller.getState().status).toBe("active");
  });

  it("stops a late stream when the tab was hidden during the prompt", async () => {
    const pending = deferred<MediaStream>();
    installMediaDevices(() => pending.promise);
    const video = fakeVideo();
    const started = controller.start({ video });
    setVisibility("hidden");
    expect(controller.getState().status).toBe("paused_hidden");
    const late = fakeStream();
    pending.resolve(late);
    expect(await started).toEqual({ ok: false, reason: "cancelled" });
    expect(late.tracks[0].stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(controller.getState().status).toBe("paused_hidden");
  });

  it("pauses on pagehide", async () => {
    const stream = fakeStream();
    installMediaDevices(() => Promise.resolve(stream));
    await controller.start({ video: fakeVideo() });
    window.dispatchEvent(new Event("pagehide"));
    expect(controller.getState().status).toBe("paused_hidden");
    expect(stream.tracks[0].readyState).toBe("ended");
  });

  it("removes its page listeners once stopped", async () => {
    installMediaDevices(() => Promise.resolve(fakeStream()));
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    await controller.start({ video: fakeVideo() });
    controller.stop();
    expect(add.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(1);
    expect(remove.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(1);
    setVisibility("hidden");
    expect(controller.getState().status).toBe("idle");
  });

  it("flips to the other camera after stopping the current stream", async () => {
    const front = fakeStream(1, "user");
    const rear = fakeStream(1, "environment");
    const queue = [front, rear];
    const media = installMediaDevices(() => Promise.resolve(queue.shift()!), 2);
    const video = fakeVideo();
    await controller.start({ video });
    await flush();
    expect(controller.getState()).toMatchObject({ facingMode: "user", canFlip: true });

    const result = await controller.flip();
    expect(result).toEqual({ ok: true, stream: rear });
    expect(front.tracks[0].readyState).toBe("ended");
    expect(media.getUserMedia.mock.calls[1][0].video.facingMode).toEqual({ ideal: "environment" });
    expect(media.getUserMedia.mock.calls[1][0].audio).toBe(false);
    expect(video.srcObject).toBe(rear);
    expect(controller.getState()).toMatchObject({ status: "active", facingMode: "environment" });
  });

  it("reports canFlip false with a single camera and ignores flip when not active", async () => {
    const media = installMediaDevices(() => Promise.resolve(fakeStream()), 1);
    expect(await controller.flip()).toEqual({ ok: false, reason: "cancelled" });
    expect(media.getUserMedia).not.toHaveBeenCalled();
    await controller.start({ video: fakeVideo() });
    await flush();
    expect(controller.getState().canFlip).toBe(false);
  });
});
