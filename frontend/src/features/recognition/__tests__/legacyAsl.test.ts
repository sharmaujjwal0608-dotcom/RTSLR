import { describe, expect, it } from "vitest";
import type { Landmark } from "../../../types/recognition";
import {
  LEGACY_ASL_MODEL_ID,
  LegacyAslModel,
  MotionTrail,
  describeHand,
  fingerState,
  scoreLegacyAslLetters,
  toIsotropic,
} from "../models/legacyAsl";
import { REASONS } from "../reasons";
import { flatHand, makeFeatures, schematicHand } from "./testUtils";

// Schematic test inputs for the rule geometry (see testUtils.schematicHand).
const FLAT_OPEN = schematicHand(["up", "up", "up", "up"], "tucked");
const INDEX_AND_THUMB = schematicHand(["up", "curled", "curled", "curled"], "out");
const TWO_SPREAD = schematicHand(["up", "up", "curled", "curled"], "tucked", [-0.07, 0.06, 0, 0]);
const THREE_UP = schematicHand(["up", "up", "up", "curled"], "tucked", [-0.07, 0, 0.07, 0]);
const FIST = schematicHand(["curled", "curled", "curled", "curled"], "side");

function predictOne(landmarks: Landmark[], model = new LegacyAslModel()) {
  return model.predict(makeFeatures(1, { hands: [flatHand(0, landmarks)] }));
}

describe("finger geometry", () => {
  it("tells extended, curled, hooked, sideways and downward fingers apart", () => {
    const up = fingerState(FLAT_OPEN, 5, 6, 7, 8);
    expect(up).toMatchObject({ extended: true, curled: false, sideways: false, pointingDown: false });

    const curled = fingerState(FIST, 5, 6, 7, 8);
    expect(curled).toMatchObject({ extended: false, curled: true });

    const hook = fingerState(schematicHand(["hook", "curled", "curled", "curled"], "tucked"), 5, 6, 7, 8);
    expect(hook).toMatchObject({ extended: false, hooked: true });

    const side = fingerState(schematicHand(["side", "curled", "curled", "curled"], "out"), 5, 6, 7, 8);
    expect(side.sideways).toBe(true);

    const down = fingerState(schematicHand(["down", "down", "curled", "curled"], "down"), 5, 6, 7, 8);
    expect(down.pointingDown).toBe(true);
  });

  it("corrects image anisotropy before measuring", () => {
    const corrected = toIsotropic([{ x: 0.5, y: 0.25, z: 0.1 }], 1280, 720);
    expect(corrected[0].x).toBeCloseTo(0.5 * (1280 / 720), 6);
    expect(corrected[0].y).toBe(0.25);
    expect(corrected[0].z).toBeCloseTo(0.1 * (1280 / 720), 6);
    expect(toIsotropic([{ x: 0.5, y: 0.25, z: 0 }], 0, 0)[0].x).toBe(0.5);
  });

  it("measures thumb distances in palm lengths, so hand size does not matter", () => {
    const small = describeHand(INDEX_AND_THUMB);
    const scaled = describeHand(INDEX_AND_THUMB.map((p) => ({ x: p.x * 0.5, y: p.y * 0.5, z: p.z * 0.5 })));
    expect(scaled.thumbToIndexTip).toBeCloseTo(small.thumbToIndexTip, 6);
    expect(scaled.indexToMiddleTip).toBeCloseTo(small.indexToMiddleTip, 6);
    expect(small.thumbOut).toBe(true);
  });
});

describe("letter rules on schematic poses", () => {
  it.each<[string, Landmark[], string]>([
    ["four straight fingers, thumb tucked", FLAT_OPEN, "B"],
    ["index up with the thumb out", INDEX_AND_THUMB, "L"],
    ["index and middle up and apart", TWO_SPREAD, "V"],
    ["index, middle and ring up and apart", THREE_UP, "W"],
  ])("%s scores highest as %s", (_name, landmarks, expected) => {
    const ranked = scoreLegacyAslLetters(describeHand(landmarks));
    expect(ranked).toHaveLength(26);
    expect(ranked[0].classId).toBe(expected);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    for (const c of ranked) {
      expect(c.score).toBeGreaterThanOrEqual(0.01);
      expect(c.score).toBeLessThanOrEqual(0.99);
    }
  });

  it("known weakness: a closed fist scores highest as P, because curled fingertips sit below the knuckles", () => {
    // Inherited from the prototype's rules; listed in the model's limitations.
    const ranked = scoreLegacyAslLetters(describeHand(FIST));
    expect(ranked[0].classId).toBe("P");
    const fistLetters = ranked.filter((c) => "AEMNST".includes(c.classId)).map((c) => c.score);
    expect(Math.max(...fistLetters)).toBeLessThan(ranked[0].score);
  });

  it("the motion flags only move the J/I and Z scores", () => {
    const little = schematicHand(["curled", "curled", "curled", "up"], "tucked");
    const still = scoreLegacyAslLetters(describeHand(little));
    const moving = scoreLegacyAslLetters(describeHand(little, { jMotion: true, zMotion: true }));
    const score = (list: typeof still, id: string) => list.find((c) => c.classId === id)!.score;
    expect(score(moving, "J")).toBeGreaterThan(score(still, "J"));
    expect(score(moving, "I")).toBeLessThan(score(still, "I"));
    expect(score(moving, "Z")).toBeGreaterThan(score(still, "Z"));
    expect(score(moving, "B")).toBe(score(still, "B"));
  });
});

describe("MotionTrail", () => {
  const at = (pinky: [number, number], index: [number, number]): Landmark[] => {
    const lm = FLAT_OPEN.map((p) => ({ ...p }));
    lm[20] = { x: pinky[0], y: pinky[1], z: 0 };
    lm[8] = { x: index[0], y: index[1], z: 0 };
    return lm;
  };

  it("reports nothing for a still hand", () => {
    const trail = new MotionTrail();
    let flags = { jMotion: true, zMotion: true };
    for (let i = 0; i < 30; i++) flags = trail.update(at([0.6, 0.5], [0.4, 0.3]), 0, i * 33);
    expect(flags).toEqual({ jMotion: false, zMotion: false });
  });

  it("flags a downward-and-sideways little-finger path and a wide index path", () => {
    const trail = new MotionTrail();
    let flags = { jMotion: false, zMotion: false };
    for (let i = 0; i < 16; i++) {
      flags = trail.update(at([0.6 + i * 0.004, 0.5 + i * 0.005], [0.4 + i * 0.006, 0.3 + (i % 4) * 0.02]), 0, i * 33);
    }
    expect(flags).toEqual({ jMotion: true, zMotion: true });
  });

  it("forgets the path after reset, a slot change, or a long gap", () => {
    const moved = (trail: MotionTrail, slot: number, start: number) => {
      let flags = { jMotion: false, zMotion: false };
      for (let i = 0; i < 16; i++) {
        flags = trail.update(at([0.6 + i * 0.004, 0.5 + i * 0.005], [0.4, 0.3]), slot, start + i * 33);
      }
      return flags;
    };
    const trail = new MotionTrail();
    expect(moved(trail, 0, 0).jMotion).toBe(true);
    trail.reset();
    expect(trail.update(at([0.9, 0.9], [0.4, 0.3]), 0, 600).jMotion).toBe(false);

    expect(moved(trail, 0, 1000).jMotion).toBe(true);
    expect(trail.update(at([0.9, 0.9], [0.4, 0.3]), 1, 1600).jMotion).toBe(false); // other hand
    expect(moved(trail, 1, 2000).jMotion).toBe(true);
    expect(trail.update(at([0.9, 0.9], [0.4, 0.3]), 1, 9000).jMotion).toBe(false); // stalled
  });
});

describe("LegacyAslModel", () => {
  it("declares itself as an unvalidated ASL prototype", () => {
    const { info } = new LegacyAslModel();
    expect(info).toMatchObject({
      id: LEGACY_ASL_MODEL_ID,
      kind: "legacy_asl_prototype",
      signLanguage: "ASL",
      scoreType: "classifier_score",
      validated: false,
      input: "single_hand_static",
    });
    expect(info.classes).toHaveLength(26);
    expect(info.classes.filter((c) => c.motion === "dynamic").map((c) => c.classId)).toEqual(["J", "Z"]);
    expect(info.classes.every((c) => c.hands === 1)).toBe(true);
    const text = info.limitations.join(" ");
    expect(text).toMatch(/does not recognise Indian Sign Language/);
    expect(text).toMatch(/J and Z/);
    expect(text).toMatch(/weak/);
    expect(text).toMatch(/closed fist/i);
  });

  it("recognises a schematic pose and fills the result contract", () => {
    const result = predictOne(INDEX_AND_THUMB);
    expect(result).toMatchObject({
      modelId: LEGACY_ASL_MODEL_ID,
      signLanguage: "ASL",
      status: "recognized",
      classId: "L",
      label: "L",
      scoreType: "classifier_score",
      handsUsed: 1,
    });
    expect(result.reason).toBeUndefined();
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
  });

  it("returns no_hands for an empty frame", () => {
    const result = new LegacyAslModel().predict(makeFeatures(0));
    expect(result).toMatchObject({ status: "no_hands", classId: null, score: null, scoreType: null, handsUsed: 0 });
  });

  it("with two hands it classifies only the primary hand and says so", () => {
    const result = new LegacyAslModel().predict(
      makeFeatures(2, { hands: [flatHand(0, FLAT_OPEN), flatHand(1, INDEX_AND_THUMB)] }),
    );
    expect(result.status).toBe("recognized");
    expect(result.classId).toBe("B"); // slot 0, not the "L" hand in slot 1
    expect(result.handsUsed).toBe(1);
    expect(result.reason).toBe(REASONS.legacyPrimaryHandOnly);
  });

  it("is uncertain when no rule clears the threshold", () => {
    // Rule scores are capped at 0.99, so a threshold above that rejects everything.
    const result = predictOne(FLAT_OPEN, new LegacyAslModel({ minScore: 0.995 }));
    expect(result).toMatchObject({ status: "uncertain", classId: null, label: null });
    expect(result.reason).toBe(REASONS.legacyNoRuleMatch);
    expect(result.score).toBeLessThan(0.995);
    expect(result.candidates[0].classId).toBe("B");
  });

  it("does not throw on a hand with missing or non-finite landmarks", () => {
    const short = predictOne(FLAT_OPEN.slice(0, 10));
    expect(short.status).toBe("unsupported");
    expect(short.reason).toBe(REASONS.legacyBadLandmarks);
    const broken = FLAT_OPEN.map((p) => ({ ...p }));
    broken[8].x = Number.NaN;
    expect(predictOne(broken).status).toBe("unsupported");
  });
});
