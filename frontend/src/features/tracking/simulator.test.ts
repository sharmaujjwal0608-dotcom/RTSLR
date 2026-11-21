import { describe, expect, it } from "vitest";
import { extractFrameFeatures } from "./features";
import { getCoverTransform, projectLandmarks } from "./overlay";
import { SIMULATOR_POSES, buildSyntheticHand, createSimulatorSource } from "./simulator";

describe("simulator", () => {
  it("builds 21 finite landmarks for every pose, deterministically", () => {
    expect(SIMULATOR_POSES).toHaveLength(26);
    for (const pose of SIMULATOR_POSES) {
      const a = buildSyntheticHand(pose, { timeMs: 1234 });
      expect(a).toHaveLength(21);
      expect(a.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(true);
      expect(buildSyntheticHand(pose, { timeMs: 1234 })).toEqual(a);
    }
  });

  it("reflects the hand about its wrist when flipped", () => {
    const plain = buildSyntheticHand("B", { centerX: 0.5 });
    const flipped = buildSyntheticHand("B", { centerX: 0.5, flip: true });
    for (let i = 0; i < 21; i++) {
      expect(flipped[i].x - flipped[0].x).toBeCloseTo(-(plain[i].x - plain[0].x), 12);
      expect(flipped[i].y).toBeCloseTo(plain[i].y, 12);
    }
  });

  it("produces one hand, two hands or none, with stable slots and growing age", () => {
    const sim = createSimulatorSource({ pose: "L" });
    expect(sim.source).toBe("simulator");
    expect(sim.nextFrame(0).hands.map((h) => h.slot)).toEqual([0]);

    sim.setOptions({ twoHands: true, secondPose: "V" });
    const two = sim.nextFrame(33);
    expect(two.hands.map((h) => [h.slot, h.ageFrames])).toEqual([[0, 2], [1, 1]]);
    // Slot 1 is drawn on the left of the unmirrored image.
    expect(two.hands[1].landmarks[0].x).toBeLessThan(two.hands[0].landmarks[0].x);
    expect(extractFrameFeatures(two).dual).toHaveLength(156);

    sim.setOptions({ paused: true });
    expect(sim.nextFrame(66).hands).toEqual([]);
    sim.setOptions({ paused: false });
    expect(sim.nextFrame(99).hands.map((h) => h.ageFrames)).toEqual([1, 1]);
  });

  it("freezes the pose when given a constant pose clock", () => {
    const sim = createSimulatorSource({ pose: "J" });
    const a = sim.nextFrame(100, 0);
    const b = sim.nextFrame(900, 0);
    expect(b.hands[0].landmarks).toEqual(a.hands[0].landmarks);
    expect(b.timestamp).toBe(900);
  });
});

describe("overlay geometry", () => {
  it("computes an object-fit: cover transform", () => {
    // 4:3 source in a 16:9 box: full width, cropped top and bottom.
    expect(getCoverTransform(640, 480, 1600, 900)).toEqual({ drawW: 1600, drawH: 1200, offsetX: 0, offsetY: -150 });
    // 16:9 source in a square box: full height, cropped left and right.
    const t = getCoverTransform(1280, 720, 300, 300);
    expect(t.drawH).toBeCloseTo(300, 9);
    expect(t.offsetX).toBeCloseTo(-(t.drawW - 300) / 2, 9);
  });

  it("mirrors x at display time only", () => {
    const t = getCoverTransform(640, 480, 640, 480);
    const lm = [{ x: 0.25, y: 0.5, z: 0 }];
    expect(projectLandmarks(lm, t, false)).toEqual([{ x: 160, y: 240 }]);
    expect(projectLandmarks(lm, t, true)).toEqual([{ x: 480, y: 240 }]);
    expect(lm[0].x).toBe(0.25);
  });
});
