import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DUAL_FEATURE_DIM,
  FEATURE_SCHEMA_VERSION,
  SINGLE_FEATURE_DIM,
  type Landmark,
} from "@/types/recognition";
import {
  aspectCorrect,
  createMotionHistory,
  dualHandVector,
  dualHandVectorOrdered,
  estimateHandOrientation,
  extractFrameFeatures,
  orderHandsAB,
  palmLength,
  palmNormal,
  singleHandVector,
} from "./features";
import {
  MINIMAL_HAND_EXPECTED,
  MINIMAL_IMAGE,
  buildParityFile,
  handFrame,
  minimalHand,
  openHand,
  randomHand,
  trackedHand,
} from "./fixtures";

const W = 640;
const H = 480;

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>, digits = 5) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) expect(actual[i]).toBeCloseTo(expected[i], digits);
}

const translate = (lm: Landmark[], dx: number, dy: number, dz = 0) =>
  lm.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz }));

/** Uniform scale about the wrist. */
const scaleAboutWrist = (lm: Landmark[], k: number) =>
  lm.map((p) => ({
    x: lm[0].x + (p.x - lm[0].x) * k,
    y: lm[0].y + (p.y - lm[0].y) * k,
    z: lm[0].z + (p.z - lm[0].z) * k,
  }));

describe("single-hand vector (63-D)", () => {
  it("has 63 finite components with the wrist at the origin", () => {
    for (const hand of [openHand(), randomHand(3), minimalHand()]) {
      const v = singleHandVector(hand, W, H);
      expect(v).toBeInstanceOf(Float32Array);
      expect(v.length).toBe(SINGLE_FEATURE_DIM);
      expect(Array.from(v).every(Number.isFinite)).toBe(true);
      expect(Array.from(v.slice(0, 3))).toEqual([0, 0, 0]);
    }
  });

  it("places the middle-finger base at unit distance from the wrist", () => {
    const v = singleHandVector(randomHand(7), W, H);
    expect(Math.hypot(v[27], v[28], v[29])).toBeCloseTo(1, 5);
  });

  it("is invariant to translation", () => {
    const hand = randomHand(5);
    expectClose(singleHandVector(translate(hand, 0.17, -0.09, 0.03), W, H), singleHandVector(hand, W, H));
  });

  it("is invariant to uniform scale", () => {
    const hand = openHand();
    expectClose(singleHandVector(scaleAboutWrist(hand, 0.37), W, H), singleHandVector(hand, W, H));
    expectClose(singleHandVector(scaleAboutWrist(hand, 2.5), W, H), singleHandVector(hand, W, H));
  });

  it("applies the aspect correction to x and z but not y", () => {
    expect(aspectCorrect([{ x: 0.5, y: 0.25, z: 0.1 }], 200, 100)).toEqual([{ x: 1, y: 0.25, z: 0.2 }]);

    // The same physical shape seen in a square and in a 2:1 image: x and z
    // shrink by half in normalised units. The corrected vectors must agree.
    const square = randomHand(9);
    const wide = square.map((p) => ({ x: p.x / 2, y: p.y, z: p.z / 2 }));
    expectClose(singleHandVector(wide, 200, 100), singleHandVector(square, 100, 100));
    // Without the correction they would differ.
    expect(
      Array.from(singleHandVector(wide, 100, 100)).some(
        (c, i) => Math.abs(c - singleHandVector(square, 100, 100)[i]) > 1e-3,
      ),
    ).toBe(true);
  });

  it("matches the hand-computed case exactly", () => {
    // 200x100 image, aspect 2. Wrist (0.25, 0.5, 0).
    // p9 - p0 = (0, -0.2, 0)            -> palm = 0.2
    // p5 - p0 = (-0.05*2, -0.2, 0)      -> (-0.5, -1, 0)
    // p8 - p0 = (-0.05*2, -0.4, 0)      -> (-0.5, -2, 0)
    // p17 - p0 = (0.05*2, -0.2, 0.05*2) -> (0.5, -1, 0.5)
    const v = singleHandVector(minimalHand(), MINIMAL_IMAGE.imageWidth, MINIMAL_IMAGE.imageHeight);
    const expected = new Array(SINGLE_FEATURE_DIM).fill(0);
    for (const [index, xyz] of Object.entries(MINIMAL_HAND_EXPECTED)) {
      expected.splice(Number(index) * 3, 3, ...xyz);
    }
    expectClose(v, expected, 6);
  });

  it("clamps a zero-length palm instead of dividing by zero", () => {
    const flat = Array.from({ length: 21 }, () => ({ x: 0.4, y: 0.4, z: 0 }));
    expect(Array.from(singleHandVector(flat, W, H)).every((c) => c === 0)).toBe(true);
    expect(palmLength(aspectCorrect(flat, W, H))).toBe(1e-4);
  });

  it("rejects a hand without 21 landmarks", () => {
    expect(() => singleHandVector(openHand().slice(0, 20), W, H)).toThrow(RangeError);
  });
});

describe("dual-hand vector (156-D)", () => {
  const left = openHand(0.3, 0.8, 0.9, true);
  const right = openHand(0.7, 0.75, 1);

  it("has 156 finite components laid out as A, B, relation", () => {
    const d = dualHandVector(left, right, 1280, 720);
    expect(d.length).toBe(DUAL_FEATURE_DIM);
    expect(Array.from(d).every(Number.isFinite)).toBe(true);
    expectClose(d.slice(0, 63), singleHandVector(left, 1280, 720));
    expectClose(d.slice(63, 126), singleHandVector(right, 1280, 720));
  });

  it("orders A and B by unmirrored wrist x, not by argument or slot order", () => {
    expect(orderHandsAB({ landmarks: right }, { landmarks: left }).a.landmarks).toBe(left);
    expectClose(dualHandVector(right, left, 1280, 720), dualHandVector(left, right, 1280, 720), 7);

    const f1 = extractFrameFeatures(handFrame([trackedHand(0, left), trackedHand(1, right)], 1280, 720));
    const f2 = extractFrameFeatures(handFrame([trackedHand(0, right), trackedHand(1, left)], 1280, 720));
    expect(Array.from(f2.dual!)).toEqual(Array.from(f1.dual!));
    // perHand stays ordered by slot.
    expectClose(f2.perHand[0].vector, f1.perHand[1].vector, 7);
  });

  it("has a positive wrist offset along x and a matching distance", () => {
    const d = dualHandVector(right, left, 1280, 720);
    expect(d[126]).toBeGreaterThan(0);
    expect(d[129]).toBeCloseTo(Math.hypot(d[126], d[127], d[128]), 5);
  });

  it("transposes the fingertip matrix and negates the offset when A and B are exchanged", () => {
    const a = randomHand(11, 0.3);
    const b = randomHand(29, 0.7);
    const ab = dualHandVectorOrdered(a, b, W, H);
    const ba = dualHandVectorOrdered(b, a, W, H);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) expect(ba[130 + j * 5 + i]).toBeCloseTo(ab[130 + i * 5 + j], 5);
    }
    for (let k = 126; k < 129; k++) expect(ba[k]).toBeCloseTo(-ab[k], 5);
    expect(ba[129]).toBeCloseTo(ab[129], 5);
    expect(ba[155]).toBeCloseTo(ab[155], 5);
    expectClose(ba.slice(0, 63), ab.slice(63, 126));
  });

  it("is invariant to translating and scaling both hands together", () => {
    const base = dualHandVector(left, right, W, H);
    expectClose(dualHandVector(translate(left, 0.05, -0.1), translate(right, 0.05, -0.1), W, H), base);
    const k = 0.5;
    const about = (lm: Landmark[]) => lm.map((p) => ({ x: p.x * k, y: p.y * k, z: p.z * k }));
    expectClose(dualHandVector(about(left), about(right), W, H), base, 4);
  });

  it("matches the hand-computed pair exactly", () => {
    // B is A shifted by +0.5 in x on a 200x100 image: wristB - wristA = (1, 0, 0).
    // Both palms are 0.2, so s = 0.2 -> offset (5, 0, 0), distance 5.
    // Tips of A relative to wrist A: tip 8 at (-0.1, -0.4, 0), the others at 0.
    //   same finger          : |(1, 0)|      = 1        -> 5
    //   A index vs B other   : |(-1.1, -0.4)| = sqrt(1.37) -> 5.852350
    //   A other vs B index   : |(-0.9, 0.4)|  = sqrt(0.97) -> 4.924429
    const d = dualHandVector(minimalHand(0.5), minimalHand(), 200, 100);
    expectClose(d.slice(126, 130), [5, 0, 0, 5], 5);
    const expected: number[] = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        expected.push(i === j ? 5 : i === 1 ? Math.sqrt(1.37) / 0.2 : j === 1 ? Math.sqrt(0.97) / 0.2 : 5);
      }
    }
    expectClose(d.slice(130, 155), expected, 4);
    expect(d[155]).toBeCloseTo(1, 6);
    expect(Math.sqrt(1.37) / 0.2).toBeCloseTo(5.85235, 5);
    expect(Math.sqrt(0.97) / 0.2).toBeCloseTo(4.924429, 5);
  });

  it("reports the cosine between palm normals", () => {
    const flipped = openHand(0.7, 0.8, 1, true);
    const d = dualHandVector(openHand(0.3), flipped, 100, 100);
    expect(d[155]).toBeCloseTo(-1, 5);
    const n = palmNormal(aspectCorrect(openHand(), 100, 100));
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 10);
  });
});

describe("extractFrameFeatures", () => {
  it("handles zero, one and two hands", () => {
    const none = extractFrameFeatures(handFrame([]));
    expect(none).toMatchObject({ schema: FEATURE_SCHEMA_VERSION, handCount: 0, perHand: [], dual: null, motion: [] });

    const frame = handFrame([trackedHand(1, openHand(), "Right")], W, H, 42);
    const one = extractFrameFeatures(frame);
    expect(one.handCount).toBe(1);
    expect(one.timestamp).toBe(42);
    expect(one.dual).toBeNull();
    expect(one.perHand[0]).toMatchObject({ slot: 1, handedness: "Right" });
    expect(one.frame).toBe(frame);

    const two = extractFrameFeatures(handFrame([trackedHand(0, openHand(0.3)), trackedHand(1, openHand(0.7))]));
    expect(two.handCount).toBe(2);
    expect(two.dual?.length).toBe(DUAL_FEATURE_DIM);
    expect(two.perHand.map((p) => p.slot)).toEqual([0, 1]);
  });

  it("measures wrist motion in palm lengths and flags a steady hand", () => {
    const history = createMotionHistory({ windowMs: 500, minStillMs: 250, stillSpeed: 0.5 });
    const hand = openHand(0.5, 0.8); // palm length 0.28 in a square image
    let f = extractFrameFeatures(handFrame([trackedHand(0, hand, "Unknown", 1)], 100, 100, 0), history);
    expect(f.motion[0]).toEqual({ slot: 0, wristPath: 0, wristSpeed: 0, isStill: false });

    for (let i = 1; i <= 10; i++) {
      f = extractFrameFeatures(handFrame([trackedHand(0, hand, "Unknown", i + 1)], 100, 100, i * 40), history);
    }
    expect(f.motion[0].isStill).toBe(true);
    expect(f.motion[0].wristSpeed).toBe(0);

    // Move 0.028 (0.1 palm lengths) every 40 ms: 2.5 palm lengths per second.
    const moving = createMotionHistory();
    for (let i = 0; i <= 10; i++) {
      f = extractFrameFeatures(
        handFrame([trackedHand(0, translate(hand, 0.028 * i, 0), "Unknown", i + 1)], 100, 100, i * 40),
        moving,
      );
    }
    expect(f.motion[0].wristSpeed).toBeCloseTo(2.5, 3);
    expect(f.motion[0].wristPath).toBeCloseTo(1, 3);
    expect(f.motion[0].isStill).toBe(false);
  });

  it("restarts the trajectory when a slot is given to a new hand", () => {
    const history = createMotionHistory();
    for (let i = 0; i < 5; i++) {
      extractFrameFeatures(handFrame([trackedHand(0, openHand(0.2), "Unknown", i + 1)], 100, 100, i * 40), history);
    }
    const f = extractFrameFeatures(handFrame([trackedHand(0, openHand(0.8), "Unknown", 1)], 100, 100, 200), history);
    expect(f.motion[0].wristPath).toBe(0);
  });
});

describe("orientation helper", () => {
  it("reports pointing direction from wrist to middle-finger base", () => {
    const up = openHand();
    expect(estimateHandOrientation(up, W, H).pointing).toBe("up");
    const down = up.map((p) => ({ x: p.x, y: 1.6 - p.y, z: p.z }));
    expect(estimateHandOrientation(down, W, H).pointing).toBe("down");
    const side = up.map((p) => ({ x: 0.5 + (p.y - 0.8), y: 0.5 + (p.x - 0.5), z: p.z }));
    expect(estimateHandOrientation(side, W, H).pointing).toBe("sideways");
  });

  it("needs a handedness label to decide which way the palm faces", () => {
    const hand = openHand(); // thumb at smaller x, fingers up: normal z is positive
    expect(estimateHandOrientation(hand, W, H).palmFacing).toBe("unknown");
    expect(estimateHandOrientation(hand, W, H, "Left").palmFacing).toBe("camera");
    expect(estimateHandOrientation(hand, W, H, "Right").palmFacing).toBe("away");
    expect(estimateHandOrientation(openHand(0.5, 0.8, 1, true), W, H, "Right").palmFacing).toBe("camera");
  });
});

describe("feature-parity.json", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "feature-parity.json");

  const serialise = (value: unknown) =>
    // Pretty-print, but keep each numeric array on one line.
    JSON.stringify(value, null, 2).replace(/\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g, (_, body: string) =>
      `[${body.replace(/\s+/g, " ")}]`,
    ) + "\n";

  it("is up to date with the TypeScript implementation", () => {
    const current = buildParityFile();
    if (!existsSync(path) || process.env.UPDATE_FIXTURES === "1") {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, serialise(current), "utf8");
    }
    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(current)));
  });

  it("contains vectors of the contract lengths", () => {
    const file = buildParityFile();
    expect(file.cases.length).toBeGreaterThan(5);
    for (const c of file.cases) {
      for (const h of c.expected.perHand) expect(h.vector.length).toBe(SINGLE_FEATURE_DIM);
      if (c.expected.dual) expect(c.expected.dual.length).toBe(DUAL_FEATURE_DIM);
      expect(c.expected.dual === null).toBe(c.hands.length !== 2);
    }
  });
});
