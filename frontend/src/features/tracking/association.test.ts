import { describe, expect, it } from "vitest";
import { HandAssociator } from "./association";
import { openHand } from "./fixtures";
import type { RawHandDetection } from "./types";

const det = (x: number, y = 0.8, tag: "Left" | "Right" | "Unknown" = "Unknown"): RawHandDetection => ({
  landmarks: openHand(x, y),
  handedness: tag,
  handednessScore: 1,
});

const slotsByX = (hands: { slot: 0 | 1; detection: RawHandDetection }[]) =>
  Object.fromEntries(hands.map((h) => [h.slot, h.detection.landmarks[0].x]));

describe("HandAssociator", () => {
  it("gives the first hand slot 0 and counts its age", () => {
    const a = new HandAssociator();
    const r1 = a.update([det(0.5)]);
    expect(r1.hands).toHaveLength(1);
    expect(r1.hands[0]).toMatchObject({ slot: 0, ageFrames: 1, isNew: true });
    expect(r1.resetSlots).toEqual([0]);
    const r2 = a.update([det(0.51)]);
    expect(r2.hands[0]).toMatchObject({ slot: 0, ageFrames: 2, isNew: false });
    expect(r2.resetSlots).toEqual([]);
  });

  it("returns no hands for an empty frame", () => {
    expect(new HandAssociator().update([])).toEqual({ hands: [], resetSlots: [], releasedSlots: [] });
  });

  it("keeps slots when the detector swaps its array order", () => {
    const a = new HandAssociator();
    a.update([det(0.3), det(0.7)]);
    for (let i = 0; i < 6; i++) {
      const r = a.update(i % 2 === 0 ? [det(0.7), det(0.3)] : [det(0.3), det(0.7)]);
      expect(slotsByX(r.hands)).toEqual({ 0: 0.3, 1: 0.7 });
      expect(r.hands.map((h) => h.slot)).toEqual([0, 1]);
      expect(r.resetSlots).toEqual([]);
    }
  });

  it("follows hands by position even if handedness labels flicker", () => {
    const a = new HandAssociator();
    a.update([det(0.3, 0.8, "Left"), det(0.7, 0.8, "Right")]);
    const r = a.update([det(0.71, 0.8, "Left"), det(0.31, 0.8, "Right")]);
    expect(slotsByX(r.hands)).toEqual({ 0: 0.31, 1: 0.71 });
  });

  it("adds a second hand without moving the first (1 -> 2)", () => {
    const a = new HandAssociator();
    a.update([det(0.7)]);
    // The new hand comes first in the detector's array.
    const r = a.update([det(0.2), det(0.7)]);
    expect(slotsByX(r.hands)).toEqual({ 0: 0.7, 1: 0.2 });
    expect(r.resetSlots).toEqual([1]);
    expect(r.hands.find((h) => h.slot === 0)).toMatchObject({ ageFrames: 2, isNew: false });
    expect(r.hands.find((h) => h.slot === 1)).toMatchObject({ ageFrames: 1, isNew: true });
  });

  it("keeps the remaining hand in its slot when one leaves (2 -> 1)", () => {
    const a = new HandAssociator();
    a.update([det(0.3), det(0.7)]);
    const r = a.update([det(0.7)]);
    expect(r.hands).toHaveLength(1);
    expect(r.hands[0]).toMatchObject({ slot: 1, ageFrames: 2 });
    expect(r.resetSlots).toEqual([]);
  });

  it("holds a slot through a short occlusion and resumes the same identity", () => {
    const a = new HandAssociator({ maxMissedFrames: 3 });
    a.update([det(0.3), det(0.7)]);
    a.update([det(0.3), det(0.7)]);
    for (let i = 0; i < 3; i++) {
      const r = a.update([det(0.7)]);
      expect(r.releasedSlots).toEqual([]);
    }
    const back = a.update([det(0.32), det(0.7)]);
    expect(slotsByX(back.hands)).toEqual({ 0: 0.32, 1: 0.7 });
    expect(back.resetSlots).toEqual([]);
    expect(back.hands[0]).toMatchObject({ slot: 0, ageFrames: 3, isNew: false });
  });

  it("releases a slot after the tolerance and treats a later hand as new", () => {
    const a = new HandAssociator({ maxMissedFrames: 2 });
    a.update([det(0.3), det(0.7)]);
    expect(a.update([det(0.7)]).releasedSlots).toEqual([]);
    expect(a.update([det(0.7)]).releasedSlots).toEqual([]);
    expect(a.update([det(0.7)]).releasedSlots).toEqual([0]);
    const r = a.update([det(0.3), det(0.7)]);
    expect(r.resetSlots).toEqual([0]);
    expect(r.hands[0]).toMatchObject({ slot: 0, ageFrames: 1, isNew: true });
    expect(r.hands[1]).toMatchObject({ slot: 1, isNew: false });
  });

  it("starts a new identity when a hand appears far from a held slot", () => {
    const a = new HandAssociator({ maxMatchDistance: 0.2, maxMissedFrames: 5 });
    a.update([det(0.1, 0.9)]);
    a.update([]); // slot 0 held
    const r = a.update([det(0.9, 0.3)]);
    expect(r.hands[0]).toMatchObject({ slot: 1, ageFrames: 1, isNew: true });
    expect(r.resetSlots).toEqual([1]);
  });

  it("evicts a held slot when two new hands need both slots", () => {
    const a = new HandAssociator({ maxMatchDistance: 0.1 });
    a.update([det(0.5, 0.5)]);
    a.update([]);
    const r = a.update([det(0.1, 0.9), det(0.9, 0.9)]);
    expect(r.hands.map((h) => h.slot)).toEqual([0, 1]);
    expect(r.resetSlots).toEqual([0, 1]);
    expect(r.hands.every((h) => h.isNew && h.ageFrames === 1)).toBe(true);
  });

  it("chooses the assignment with the smallest total distance when hands move", () => {
    const a = new HandAssociator();
    a.update([det(0.4), det(0.6)]);
    // Both moved right; a greedy nearest match would give 0.55 to slot 1.
    const r = a.update([det(0.75), det(0.55)]);
    expect(slotsByX(r.hands)).toEqual({ 0: 0.55, 1: 0.75 });
  });

  it("uses aspect-corrected distance", () => {
    // In a 4:1 image a 0.1 step in x is 0.4 image heights.
    const a = new HandAssociator({ maxMatchDistance: 0.3 });
    a.update([det(0.4)], 4);
    expect(a.update([det(0.5)], 4).resetSlots).toHaveLength(1);
    const b = new HandAssociator({ maxMatchDistance: 0.3 });
    b.update([det(0.4)], 1);
    expect(b.update([det(0.5)], 1).resetSlots).toEqual([]);
  });

  it("drops a duplicate detection of the same hand and extra hands", () => {
    const a = new HandAssociator();
    expect(a.update([det(0.5), det(0.505)]).hands).toHaveLength(1);
    expect(a.update([det(0.2), det(0.5), det(0.8)]).hands).toHaveLength(2);
  });

  it("forgets everything on reset", () => {
    const a = new HandAssociator();
    a.update([det(0.3), det(0.7)]);
    a.reset();
    const r = a.update([det(0.7)]);
    expect(r.hands[0]).toMatchObject({ slot: 0, ageFrames: 1, isNew: true });
  });
});
