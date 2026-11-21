/**
 * Simulator: a labelled demonstration source of synthetic `HandFrame`s.
 *
 * Ported from `buildSyntheticHand` in the legacy prototype. The poses are the
 * hand-drawn shapes that prototype used for its ASL A-Z rule classifier. They
 * are NOT Indian Sign Language, are not derived from any signer, and must not
 * be presented as recognition of real signing. Frames from this module are
 * always delivered with `source: "simulator"`.
 */
import type { HandFrame, Landmark, TrackedHand } from "@/types/recognition";

type FingerShape = "up" | "side" | "down" | "hook" | "curled" | "curved" | "pinch";
type ThumbShape =
  | "out" | "side" | "front" | "tucked" | "pinch" | "up_mid"
  | "under_m" | "under_n" | "under_t" | "down" | "c_gap";

const POSES = {
  A: ["curled", "curled", "curled", "curled", "side"],
  B: ["up", "up", "up", "up", "tucked"],
  C: ["curved", "curved", "curved", "curved", "c_gap"],
  D: ["up", "curled", "curled", "curled", "front"],
  E: ["curled", "curled", "curled", "curled", "tucked"],
  F: ["pinch", "up", "up", "up", "pinch"],
  G: ["side", "curled", "curled", "curled", "out"],
  H: ["side", "side", "curled", "curled", "tucked"],
  I: ["curled", "curled", "curled", "up", "tucked"],
  J: ["curled", "curled", "curled", "up", "tucked"],
  K: ["up", "up", "curled", "curled", "up_mid"],
  L: ["up", "curled", "curled", "curled", "out"],
  M: ["curled", "curled", "curled", "curled", "under_m"],
  N: ["curled", "curled", "curled", "curled", "under_n"],
  O: ["pinch", "curved", "curved", "curled", "pinch"],
  P: ["down", "down", "curled", "curled", "down"],
  Q: ["down", "curled", "curled", "curled", "down"],
  R: ["up", "up", "curled", "curled", "tucked"],
  S: ["curled", "curled", "curled", "curled", "front"],
  T: ["curled", "curled", "curled", "curled", "under_t"],
  U: ["up", "up", "curled", "curled", "tucked"],
  V: ["up", "up", "curled", "curled", "tucked"],
  W: ["up", "up", "up", "curled", "tucked"],
  X: ["hook", "curled", "curled", "curled", "tucked"],
  Y: ["curled", "curled", "curled", "up", "out"],
  Z: ["up", "curled", "curled", "curled", "tucked"],
} as const satisfies Record<string, readonly [FingerShape, FingerShape, FingerShape, FingerShape, ThumbShape]>;

/** A pose of the legacy ASL prototype (not an ISL sign). */
export type SimulatorPose = keyof typeof POSES;

export const SIMULATOR_POSES = Object.keys(POSES) as SimulatorPose[];

export const SIMULATOR_IMAGE = { imageWidth: 640, imageHeight: 480 } as const;

const SPREAD: Partial<Record<SimulatorPose, [number, number, number, number]>> = {
  V: [-0.07, 0.06, 0, 0],
  W: [-0.07, 0, 0.07, 0],
  K: [-0.06, 0.05, 0, 0],
  P: [-0.06, 0.05, 0, 0],
  R: [0.04, -0.04, 0, 0],
  U: [0.025, -0.025, 0, 0],
};

export type SyntheticHandOptions = {
  /** Horizontal position of the wrist, 0..1. */
  centerX?: number;
  /** Clock in milliseconds. The same time always gives the same hand. */
  timeMs?: number;
  /** Reflect the hand about its wrist so it reads as the other hand. */
  flip?: boolean;
};

/** Deterministic port of the legacy `buildSyntheticHand`. */
export function buildSyntheticHand(pose: SimulatorPose, options: SyntheticHandOptions = {}): Landmark[] {
  const { centerX = 0.5, timeMs = 0, flip = false } = options;
  const t = timeMs * 0.003;
  const lm: Landmark[] = new Array(21);
  let cx = centerX;
  let cy = 0.8;
  if (pose === "J") {
    cx += Math.sin(t) * 0.04;
    cy += Math.cos(t) * 0.04;
  }
  if (pose === "Z") {
    cx += Math.sin(t * 1.4) * 0.05;
    cy += Math.sin(t * 0.7) * 0.04;
  }
  const at = (dx: number, dy: number, z: number): Landmark => ({ x: cx + dx, y: cy + dy, z });

  lm[0] = at(0, 0, 0);
  lm[1] = at(-0.08, -0.08, -0.02);
  lm[2] = at(-0.13, -0.17, -0.03);
  lm[5] = at(-0.07, -0.26, 0);
  lm[9] = at(0, -0.28, 0);
  lm[13] = at(0.07, -0.26, 0);
  lm[17] = at(0.13, -0.22, 0);

  const setFinger = (mcpIdx: number, dx: number, shape: FingerShape) => {
    const mcp = lm[mcpIdx];
    const rel = (x: number, y: number, z: number): Landmark => ({ x: mcp.x + x, y: mcp.y + y, z });
    let pts: [Landmark, Landmark, Landmark];
    switch (shape) {
      case "up":
        pts = [rel(dx * 0.35, -0.11, -0.01), rel(dx * 0.68, -0.21, -0.01), rel(dx, -0.3, -0.02)];
        break;
      case "side":
        pts = [rel(-0.09, -0.01, -0.01), rel(-0.17, -0.01, -0.01), rel(-0.24, -0.01, -0.02)];
        break;
      case "down":
        pts = [rel(dx * 0.3, 0.09, -0.02), rel(dx * 0.6, 0.17, -0.02), rel(dx * 0.9, 0.24, -0.03)];
        break;
      case "hook":
        pts = [rel(0, -0.09, -0.02), rel(0, -0.12, -0.05), rel(0, -0.06, -0.07)];
        break;
      case "curled":
        pts = [rel(0, -0.04, -0.04), rel(0, 0.05, -0.05), rel(0, 0.09, -0.03)];
        break;
      case "curved":
        pts = [rel(-0.03, -0.09, -0.03), rel(-0.07, -0.1, -0.05), rel(-0.1, -0.05, -0.05)];
        break;
      default:
        pts = [rel(-0.02, -0.07, -0.03), at(-0.09, -0.3, -0.06), at(-0.11, -0.26, -0.07)];
    }
    [lm[mcpIdx + 1], lm[mcpIdx + 2], lm[mcpIdx + 3]] = pts;
  };

  const THUMBS: Record<ThumbShape, [[number, number, number], [number, number, number]]> = {
    out: [[-0.2, -0.21, -0.03], [-0.27, -0.24, -0.03]],
    side: [[-0.12, -0.26, -0.03], [-0.11, -0.33, -0.03]],
    front: [[-0.06, -0.2, -0.06], [0.01, -0.22, -0.08]],
    tucked: [[-0.05, -0.2, -0.04], [0.02, -0.19, -0.05]],
    pinch: [[-0.13, -0.23, -0.05], [-0.11, -0.26, -0.07]],
    up_mid: [[-0.06, -0.27, -0.04], [-0.03, -0.36, -0.05]],
    under_m: [[0.04, -0.2, -0.04], [0.09, -0.22, -0.04]],
    under_n: [[0.02, -0.2, -0.04], [0.06, -0.24, -0.04]],
    under_t: [[-0.07, -0.22, -0.04], [-0.05, -0.28, -0.05]],
    down: [[-0.11, -0.12, -0.04], [-0.12, -0.05, -0.05]],
    c_gap: [[-0.17, -0.2, -0.04], [-0.19, -0.27, -0.05]],
  };

  const cfg = POSES[pose];
  const dxs = SPREAD[pose] ?? [0, 0, 0, 0.03];
  setFinger(5, dxs[0], cfg[0]);
  setFinger(9, dxs[1], cfg[1]);
  setFinger(13, dxs[2], cfg[2]);
  setFinger(17, dxs[3], cfg[3]);
  const [t3, t4] = THUMBS[cfg[4]];
  lm[3] = at(...t3);
  lm[4] = at(...t4);

  // Tiny drift so the hand does not look frozen.
  const jx = Math.sin(t * 0.7) * 0.002;
  const jy = Math.cos(t * 0.9) * 0.002;
  return lm.map((p) => ({ x: (flip ? 2 * cx - p.x : p.x) + jx, y: p.y + jy, z: p.z }));
}

export type SimulatorOptions = {
  pose: SimulatorPose;
  /** Show a second synthetic hand. */
  twoHands: boolean;
  /** Pose of the second hand. Defaults to the same pose. */
  secondPose?: SimulatorPose;
  /** While paused the simulator produces frames with no hands. */
  paused: boolean;
};

export const DEFAULT_SIMULATOR_OPTIONS: SimulatorOptions = { pose: "A", twoHands: false, paused: false };

export type SimulatorSource = {
  readonly source: "simulator";
  getOptions(): SimulatorOptions;
  setOptions(patch: Partial<SimulatorOptions>): void;
  /**
   * @param timestamp performance.now()-style clock in milliseconds.
   * @param poseTimeMs clock that drives the pose drift; defaults to
   *   `timestamp`. Pass a constant to freeze the hand (reduced motion).
   */
  nextFrame(timestamp: number, poseTimeMs?: number): HandFrame;
  reset(): void;
};

/**
 * Creates the synthetic frame source. Slot 0 is drawn as a subject's left
 * hand on the right of the unmirrored image; the optional slot 1 is its
 * reflection on the left. `handedness` reflects how the shape was drawn.
 */
export function createSimulatorSource(initial: Partial<SimulatorOptions> = {}): SimulatorSource {
  let options: SimulatorOptions = { ...DEFAULT_SIMULATOR_OPTIONS, ...initial };
  let ages: [number, number] = [0, 0];

  return {
    source: "simulator",
    getOptions: () => options,
    setOptions(patch) {
      const next = { ...options, ...patch };
      if (!next.twoHands) ages[1] = 0;
      if (next.paused) ages = [0, 0];
      options = next;
    },
    reset() {
      ages = [0, 0];
    },
    nextFrame(timestamp, poseTimeMs = timestamp) {
      const hands: TrackedHand[] = [];
      if (!options.paused) {
        const two = options.twoHands;
        hands.push({
          slot: 0,
          handedness: "Left",
          handednessScore: 1,
          landmarks: buildSyntheticHand(options.pose, { centerX: two ? 0.7 : 0.5, timeMs: poseTimeMs }),
          ageFrames: ++ages[0],
        });
        if (two) {
          hands.push({
            slot: 1,
            handedness: "Right",
            handednessScore: 1,
            landmarks: buildSyntheticHand(options.secondPose ?? options.pose, {
              centerX: 0.3,
              timeMs: poseTimeMs,
              flip: true,
            }),
            ageFrames: ++ages[1],
          });
        }
      }
      return { timestamp, ...SIMULATOR_IMAGE, hands };
    },
  };
}
