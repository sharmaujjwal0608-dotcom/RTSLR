/**
 * Tuning constants for the Home hero artwork. Everything a designer is likely
 * to adjust lives here: colours, light levels, camera, layout of the floating
 * forms and motion amplitudes.
 *
 * World units: the composition is designed inside a square of
 * `DESIGN_SIZE` units centred on the origin. `Rig` scales it to "contain"
 * inside the canvas, so the artwork never crops when the box changes shape.
 */

export type Vec3 = [number, number, number];

/** Mirrors the design tokens in `src/app/globals.css` (canvas cannot read CSS variables cheaply). */
export const PALETTE = {
  ivory: "#efe6d9",
  ivoryLight: "#f6eee2",
  clay: "#d79c72", // --accent
  ink: "#1c1a18", // --ink, lifted a little so shading stays readable
  surface: "#ffffff", // --surface
  chipEdge: "#e5ded5", // --line
  shadow: "74, 52, 30", // rgb of the warm elevation shadows
} as const;

export const CAMERA = {
  fov: 30,
  position: [0, 0.9, 9.6] as Vec3,
  near: 0.1,
  far: 40,
};

/** Side of the square the composition must fit in (world units). Raise to add margin. */
export const DESIGN_SIZE = 5.3;

export const LIGHTS = {
  hemisphere: { sky: "#fff6ea", ground: "#d9c4ab", intensity: 0.5 },
  key: { position: [-3.5, 5, 6] as Vec3, color: "#fffaf3", intensity: 2.8 },
  rim: { position: [4.5, 2.5, -5] as Vec3, color: "#ffdcc0", intensity: 2.2 },
  fill: { position: [5, -1, 4] as Vec3, color: "#f3ebe0", intensity: 0.55 },
  /** Procedural environment (drei Lightformers, rendered once, no network). */
  env: {
    dome: "#8f8479",
    key: { position: [-4, 5, 6] as Vec3, scale: [6, 6, 1] as Vec3, color: "#fff6ea", intensity: 3 },
    rim: { position: [6, 2, -5] as Vec3, scale: [3, 7, 1] as Vec3, color: "#ffe2cc", intensity: 2 },
    fill: { position: [5, -2, 5] as Vec3, scale: [5, 3, 1] as Vec3, color: "#ffffff", intensity: 1 },
  },
};

export const MOTION = {
  /** Seconds for the entrance of the whole group. */
  entrance: 1.6,
  /** Idle drift of the whole group (world units / radians). */
  floatY: 0.045,
  swayY: 0.05,
  /** Pointer parallax: maximum rotation in radians. Keep small. */
  parallaxY: 0.14,
  parallaxX: 0.07,
  /** Response over the first viewport-height of page scroll. */
  scrollLift: 0.3,
  scrollTilt: 0.1,
  /** Higher = snappier easing toward the pointer target. */
  damping: 3,
};

/** Pose of the hand inside the composition. */
export const HAND_POSE = {
  position: [-0.1, -0.25, 0] as Vec3,
  rotation: [-0.1, -0.35, 0.06] as Vec3,
  scale: 1.18,
};

/** Catmull-Rom control points of the two ribbons. */
export const RIBBONS: { points: Vec3[]; radius: number; tone: "clay" | "ivory" }[] = [
  {
    tone: "clay",
    radius: 0.05,
    points: [
      [-1.9, -1.25, 0.6],
      [-0.6, -1.05, 1.3],
      [1.0, -0.6, 0.9],
      [1.5, 0.0, -0.4],
      [0.5, 0.38, -1.2],
      [-1.0, 0.78, -0.9],
      [-1.85, 1.2, 0.1],
      [-1.6, 1.9, 0.7],
    ],
  },
  {
    tone: "ivory",
    radius: 0.036,
    points: [
      [0.6, -1.75, 0.9],
      [1.6, -1.5, 0.3],
      [2.1, -0.5, -0.5],
      [1.8, 0.6, -1.0],
      [0.9, 1.5, -1.1],
      [0.0, 2.0, -0.6],
    ],
  },
];

export const SOLIDS = {
  claySphere: { position: [-1.35, -0.55, 0.3] as Vec3, radius: 0.24 },
  torus: { position: [1.85, 0.75, -0.2] as Vec3, radius: 0.24, tube: 0.085 },
  inkBox: { position: [-1.15, 1.6, 0.3] as Vec3, size: 0.26 },
  inkDot: { position: [-0.75, -1.75, 0.8] as Vec3, radius: 0.065 },
  clayDot: { position: [-0.55, 2.05, 0.3] as Vec3, radius: 0.08 },
};

export type ChipSymbol = "bubble" | "text" | "wave";

export const CHIPS: { symbol: ChipSymbol; position: Vec3; rotation: Vec3 }[] = [
  { symbol: "bubble", position: [1.3, 1.35, 0.8], rotation: [0.05, -0.25, -0.1] },
  { symbol: "wave", position: [-1.65, 0.15, 0.9], rotation: [0, 0.3, 0.08] },
  { symbol: "text", position: [1.4, -1.25, 1.0], rotation: [-0.05, -0.2, 0.09] },
];

export const CHIP_SIZE = 0.58;

export const GROUND_SHADOW = { y: -2.1, width: 4.2, depth: 1.5, opacity: 0.28 };
