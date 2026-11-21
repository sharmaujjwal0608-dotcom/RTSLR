/**
 * A schematic open hand with the 21 MediaPipe hand landmarks, for diagrams.
 *
 * It is a neutral, relaxed open hand used only to show where the landmarks
 * sit. It does not depict any sign in any sign language.
 *
 * Coordinates live in a 200 × 250 box. Index order follows
 * docs/MODEL_CONTRACTS.md: 0 wrist; thumb 1–4; index 5–8; middle 9–12;
 * ring 13–16; little 17–20.
 */

export const HAND_VIEWBOX = { width: 200, height: 250 } as const;

export type HandPoint = { x: number; y: number };

export const HAND_POINTS: readonly HandPoint[] = [
  { x: 100, y: 226 },
  { x: 72, y: 206 },
  { x: 50, y: 180 },
  { x: 36, y: 152 },
  { x: 25, y: 126 },
  { x: 72, y: 130 },
  { x: 64, y: 96 },
  { x: 60, y: 71 },
  { x: 57, y: 49 },
  { x: 97, y: 122 },
  { x: 96, y: 85 },
  { x: 96, y: 57 },
  { x: 96, y: 33 },
  { x: 120, y: 128 },
  { x: 126, y: 94 },
  { x: 129, y: 69 },
  { x: 131, y: 48 },
  { x: 141, y: 143 },
  { x: 153, y: 117 },
  { x: 160, y: 98 },
  { x: 165, y: 81 },
];

/** Skeleton edges between landmark indices (the usual hand-landmark topology). */
export const HAND_BONES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export const FINGERTIP_INDICES: readonly number[] = [4, 8, 12, 16, 20];

/** Landmark names as published for MediaPipe Hand Landmarker, by index. */
export const LANDMARK_IDS: readonly string[] = [
  "WRIST",
  "THUMB_CMC",
  "THUMB_MCP",
  "THUMB_IP",
  "THUMB_TIP",
  "INDEX_FINGER_MCP",
  "INDEX_FINGER_PIP",
  "INDEX_FINGER_DIP",
  "INDEX_FINGER_TIP",
  "MIDDLE_FINGER_MCP",
  "MIDDLE_FINGER_PIP",
  "MIDDLE_FINGER_DIP",
  "MIDDLE_FINGER_TIP",
  "RING_FINGER_MCP",
  "RING_FINGER_PIP",
  "RING_FINGER_DIP",
  "RING_FINGER_TIP",
  "PINKY_MCP",
  "PINKY_PIP",
  "PINKY_DIP",
  "PINKY_TIP",
];

export type FingerKey = "wrist" | "thumb" | "index" | "middle" | "ring" | "little";

export function fingerOf(index: number): FingerKey {
  if (index === 0) return "wrist";
  if (index <= 4) return "thumb";
  if (index <= 8) return "index";
  if (index <= 12) return "middle";
  if (index <= 16) return "ring";
  return "little";
}

export type HandGlyphProps = {
  /** SVG transform for placing the 200 × 250 hand inside a larger drawing. */
  transform?: string;
  /** Thick rounded strokes that read as the shape of a hand. */
  silhouette?: boolean;
  /** Thin skeleton lines between landmarks. */
  bones?: boolean;
  /** The 21 landmark dots. */
  dots?: boolean;
  /** Flip horizontally (the other hand). */
  mirrored?: boolean;
};

/** Decorative hand for inline SVG illustrations. Render inside an `<svg aria-hidden>`. */
export function HandGlyph({ transform, silhouette = true, bones = false, dots = false, mirrored = false }: HandGlyphProps) {
  const flip = mirrored ? `translate(${HAND_VIEWBOX.width} 0) scale(-1 1)` : undefined;
  return (
    <g transform={transform}>
      <g transform={flip}>
        {silhouette ? (
          <g className="stroke-accent-soft" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none">
            {HAND_BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={HAND_POINTS[a].x} y1={HAND_POINTS[a].y} x2={HAND_POINTS[b].x} y2={HAND_POINTS[b].y} />
            ))}
            <path
              className="fill-accent-soft"
              d={`M${HAND_POINTS[0].x} ${HAND_POINTS[0].y} L${HAND_POINTS[1].x} ${HAND_POINTS[1].y} L${HAND_POINTS[5].x} ${HAND_POINTS[5].y} L${HAND_POINTS[9].x} ${HAND_POINTS[9].y} L${HAND_POINTS[13].x} ${HAND_POINTS[13].y} L${HAND_POINTS[17].x} ${HAND_POINTS[17].y} Z`}
            />
          </g>
        ) : null}
        {bones ? (
          <g className="stroke-ink" strokeWidth={2} strokeLinecap="round">
            {HAND_BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={HAND_POINTS[a].x} y1={HAND_POINTS[a].y} x2={HAND_POINTS[b].x} y2={HAND_POINTS[b].y} />
            ))}
          </g>
        ) : null}
        {dots ? (
          <g className="fill-surface stroke-ink" strokeWidth={2}>
            {HAND_POINTS.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r={4.5} />
            ))}
          </g>
        ) : null}
      </g>
    </g>
  );
}
