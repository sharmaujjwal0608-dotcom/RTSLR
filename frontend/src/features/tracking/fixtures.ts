/**
 * Deterministic landmark fixtures for tests and for the cross-language parity
 * file. These are geometric test shapes, not depictions of any sign.
 */
import type { HandFrame, Handedness, Landmark, TrackedHand } from "@/types/recognition";
import { extractFrameFeatures, orderHandsAB } from "./features";

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Small seeded PRNG (mulberry32) so fixtures never depend on Math.random. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The hand-computed case. Every landmark sits on the wrist except four.
 * With a 200 x 100 image (aspect 2) the expected 63-D vector is
 * `MINIMAL_HAND_EXPECTED` below; the derivation is in features.test.ts.
 */
export function minimalHand(offsetX = 0, offsetY = 0): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.25, y: 0.5, z: 0 }));
  lm[5] = { x: 0.2, y: 0.3, z: 0 };
  lm[8] = { x: 0.2, y: 0.1, z: 0 };
  lm[9] = { x: 0.25, y: 0.3, z: 0 };
  lm[17] = { x: 0.3, y: 0.3, z: 0.05 };
  return lm.map((p) => ({ x: r6(p.x + offsetX), y: r6(p.y + offsetY), z: p.z }));
}

export const MINIMAL_IMAGE = { imageWidth: 200, imageHeight: 100 } as const;

/** Non-zero entries of the expected vector for `minimalHand()` at 200 x 100. */
export const MINIMAL_HAND_EXPECTED: Record<number, [number, number, number]> = {
  5: [-0.5, -1, 0],
  8: [-0.5, -2, 0],
  9: [0, -1, 0],
  17: [0.5, -1, 0.5],
};

/** An open, upright hand shape with plausible proportions. */
export function openHand(centerX = 0.5, wristY = 0.8, scale = 1, flipX = false): Landmark[] {
  const rel: [number, number, number][] = [
    [0, 0, 0],
    [-0.08, -0.08, -0.02], [-0.13, -0.17, -0.03], [-0.17, -0.2, -0.04], [-0.19, -0.27, -0.05],
    [-0.07, -0.26, 0], [-0.07, -0.37, -0.01], [-0.07, -0.47, -0.01], [-0.07, -0.56, -0.02],
    [0, -0.28, 0], [0, -0.39, -0.01], [0, -0.49, -0.01], [0, -0.58, -0.02],
    [0.07, -0.26, 0], [0.07, -0.37, -0.01], [0.07, -0.47, -0.01], [0.07, -0.56, -0.02],
    [0.13, -0.22, 0], [0.14, -0.33, -0.01], [0.15, -0.43, -0.01], [0.16, -0.52, -0.02],
  ];
  const sx = flipX ? -1 : 1;
  return rel.map(([x, y, z]) => ({
    x: r6(centerX + sx * x * scale),
    y: r6(wristY + y * scale),
    z: r6(z * scale),
  }));
}

/** A pseudo-random but anatomically meaningless hand: good for layout tests. */
export function randomHand(seed: number, centerX = 0.5, centerY = 0.5): Landmark[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: 21 }, () => ({
    x: r6(centerX + (rnd() - 0.5) * 0.3),
    y: r6(centerY + (rnd() - 0.5) * 0.3),
    z: r6((rnd() - 0.5) * 0.1),
  }));
}

export function trackedHand(
  slot: 0 | 1,
  landmarks: Landmark[],
  handedness: Handedness = "Unknown",
  ageFrames = 1,
): TrackedHand {
  return { slot, handedness, handednessScore: handedness === "Unknown" ? 0 : 1, landmarks, ageFrames };
}

export function handFrame(
  hands: TrackedHand[],
  imageWidth = 640,
  imageHeight = 480,
  timestamp = 0,
): HandFrame {
  return { timestamp, imageWidth, imageHeight, hands };
}

/* ------------------------------------------------------------------ */
/* Cross-language parity file                                          */
/* ------------------------------------------------------------------ */

export type ParityCase = {
  name: string;
  description: string;
  imageWidth: number;
  imageHeight: number;
  hands: { slot: 0 | 1; landmarks: [number, number, number][] }[];
  expected: {
    handCount: 0 | 1 | 2;
    perHand: { slot: 0 | 1; vector: number[] }[];
    dual: number[] | null;
    /** Which slot became hand A / hand B, or null when there is no dual vector. */
    dualOrder: { a: 0 | 1; b: 0 | 1 } | null;
  };
};

export type ParityFile = {
  schema: "rtslr-features-1";
  description: string;
  tolerance: number;
  cases: ParityCase[];
};

export const PARITY_INPUTS: { name: string; description: string; frame: HandFrame }[] = [
  {
    name: "no_hands",
    description: "Empty frame.",
    frame: handFrame([], 640, 480),
  },
  {
    name: "minimal_single_aspect_2",
    description: "Hand-computed single hand, 200x100 image.",
    frame: handFrame([trackedHand(0, minimalHand())], 200, 100),
  },
  {
    name: "minimal_dual_aspect_2",
    description: "Hand-computed pair: the minimal hand and a copy shifted by +0.5 in x.",
    frame: handFrame([trackedHand(0, minimalHand()), trackedHand(1, minimalHand(0.5))], 200, 100),
  },
  {
    name: "open_single_4x3",
    description: "Open hand shape, 640x480.",
    frame: handFrame([trackedHand(0, openHand())], 640, 480),
  },
  {
    name: "open_single_portrait",
    description: "Open hand shape in a portrait 720x1280 image, tracked in slot 1.",
    frame: handFrame([trackedHand(1, openHand(0.4, 0.7, 0.8))], 720, 1280),
  },
  {
    name: "open_dual_16x9",
    description: "Two open hands; slot 0 is on the left, so slot 0 is hand A.",
    frame: handFrame(
      [trackedHand(0, openHand(0.3, 0.8, 0.9, true)), trackedHand(1, openHand(0.7, 0.75, 1))],
      1280,
      720,
    ),
  },
  {
    name: "open_dual_16x9_slots_reversed",
    description: "Same hands with the slots exchanged: slot 1 is hand A. The dual vector is unchanged.",
    frame: handFrame(
      [trackedHand(0, openHand(0.7, 0.75, 1)), trackedHand(1, openHand(0.3, 0.8, 0.9, true))],
      1280,
      720,
    ),
  },
  {
    name: "random_dual_4x3",
    description: "Two pseudo-random point sets (seeds 11 and 29).",
    frame: handFrame(
      [trackedHand(0, randomHand(11, 0.62, 0.5)), trackedHand(1, randomHand(29, 0.31, 0.45))],
      640,
      480,
    ),
  },
  {
    name: "degenerate_zero_palm",
    description: "All 21 landmarks coincide: palm clamps to 1e-4, every component is 0.",
    frame: handFrame(
      [trackedHand(0, Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })))],
      640,
      480,
    ),
  },
];

export function buildParityFile(): ParityFile {
  return {
    schema: "rtslr-features-1",
    description:
      "Feature parity fixture generated by frontend/src/features/tracking/features.test.ts. Do not edit by hand.",
    tolerance: 1e-5,
    cases: PARITY_INPUTS.map(({ name, description, frame }) => {
      const features = extractFrameFeatures(frame);
      let dualOrder: ParityCase["expected"]["dualOrder"] = null;
      if (frame.hands.length === 2) {
        const { a, b } = orderHandsAB(frame.hands[0], frame.hands[1]);
        dualOrder = { a: a.slot, b: b.slot };
      }
      return {
        name,
        description,
        imageWidth: frame.imageWidth,
        imageHeight: frame.imageHeight,
        hands: frame.hands.map((h) => ({
          slot: h.slot,
          landmarks: h.landmarks.map((p) => [p.x, p.y, p.z] as [number, number, number]),
        })),
        expected: {
          handCount: features.handCount,
          perHand: features.perHand.map((p) => ({ slot: p.slot, vector: Array.from(p.vector) })),
          dual: features.dual ? Array.from(features.dual) : null,
          dualOrder,
        },
      };
    }),
  };
}
