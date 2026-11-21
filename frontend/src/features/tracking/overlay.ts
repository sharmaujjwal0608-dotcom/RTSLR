/**
 * Canvas overlay renderer.
 *
 * The canvas sits on top of the `<video>` element and is transparent for
 * camera input, so the picture itself is never copied into a canvas. Drawing
 * is deliberately light so the hands stay visible: thin translucent bones,
 * small dots, a soft glow, an optional box and a small label chip.
 *
 * Landmarks are always unmirrored; mirroring happens here, at display time.
 * The label text is supplied by the caller: this module never classifies.
 */
import type { HandFrame, Landmark, TrackedHand } from "@/types/recognition";
import type { FrameSource, OverlayLabelProvider, TrackingSettings } from "./types";

export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);
const PALM_POINTS = [0, 5, 9, 13, 17];

/** RGB triplets per slot. The chip also differs by marker shape. */
const SLOT_RGB: readonly [string, string] = ["45, 212, 191", "251, 191, 36"];

export type CoverTransform = { drawW: number; drawH: number; offsetX: number; offsetY: number };

/** Geometry of `object-fit: cover` for a source drawn into a destination. */
export function getCoverTransform(srcW: number, srcH: number, dstW: number, dstH: number): CoverTransform {
  const scale = Math.max(dstW / Math.max(srcW, 1), dstH / Math.max(srcH, 1));
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return { drawW, drawH, offsetX: (dstW - drawW) / 2, offsetY: (dstH - drawH) / 2 };
}

export type Point2 = { x: number; y: number };

/** Maps normalised image coordinates to canvas CSS pixels. */
export function projectLandmarks(
  landmarks: readonly Landmark[],
  transform: CoverTransform,
  mirror: boolean,
): Point2[] {
  return landmarks.map((p) => ({
    x: transform.offsetX + (mirror ? 1 - p.x : p.x) * transform.drawW,
    y: transform.offsetY + p.y * transform.drawH,
  }));
}

export type CanvasSize = { width: number; height: number; dpr: number };

/**
 * Matches the canvas backing store to its CSS size and the device pixel
 * ratio. Returns the size in CSS pixels; draw in CSS pixels after
 * `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
 */
export function syncCanvasSize(canvas: HTMLCanvasElement, maxDpr = 2): CanvasSize {
  const dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, maxDpr);
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 480;
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  return { width, height, dpr };
}

export type OverlayInput = {
  /** Frame to draw, or null to draw only the background. */
  frame: HandFrame | null;
  source: FrameSource;
  /** Mirror x at display time (front camera selfie view). */
  mirror: boolean;
  settings: Pick<TrackingSettings, "showSkeleton" | "showBoundingBox" | "showLabels">;
  getLabel?: OverlayLabelProvider | null;
  /** Text of the badge drawn while the simulator is the source. */
  simulatorBadge?: string;
  fontFamily?: string;
};

export const DEFAULT_SIMULATOR_BADGE = "SIMULATOR · synthetic hand, not a camera";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawSimulatorBackdrop(ctx: CanvasRenderingContext2D, size: CanvasSize, badge: string, font: string) {
  ctx.fillStyle = "#101014";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  const step = Math.max(28, Math.round(size.width / 16));
  ctx.beginPath();
  for (let x = step; x < size.width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size.height);
  }
  for (let y = step; y < size.height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size.width, y + 0.5);
  }
  ctx.stroke();

  ctx.font = `600 11px ${font}`;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(badge).width + 20;
  roundedRect(ctx, 12, 12, w, 24, 12);
  ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgb(253, 224, 138)";
  ctx.fillText(badge, 22, 24.5);
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  hand: TrackedHand,
  pts: Point2[],
  input: OverlayInput,
  font: string,
) {
  const rgb = SLOT_RGB[hand.slot];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX + minY + maxX + maxY)) return;

  // Soft highlight centred on the palm.
  let cx = 0;
  let cy = 0;
  for (const i of PALM_POINTS) {
    cx += pts[i].x / PALM_POINTS.length;
    cy += pts[i].y / PALM_POINTS.length;
  }
  let radius = 0;
  for (const p of pts) radius = Math.max(radius, Math.hypot(p.x - cx, p.y - cy));
  radius = Math.max(radius * 1.15, 12);
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
  glow.addColorStop(0, `rgba(${rgb}, 0.16)`);
  glow.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  if (input.settings.showSkeleton) {
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    // Dark under-stroke keeps the thin line readable on bright backgrounds.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    for (let i = 0; i < pts.length; i++) {
      const tip = FINGERTIPS.has(i);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, tip ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = tip ? `rgba(${rgb}, 0.95)` : "rgba(255, 255, 255, 0.85)";
      ctx.fill();
    }
  }

  const pad = 14;
  const bx = Math.max(4, minX - pad);
  const by = Math.max(4, minY - pad);
  const bw = Math.min(size.width - 4, maxX + pad) - bx;
  const bh = Math.min(size.height - 4, maxY + pad) - by;

  if (input.settings.showBoundingBox && bw > 0 && bh > 0) {
    roundedRect(ctx, bx, by, bw, bh, 10);
    ctx.strokeStyle = `rgba(${rgb}, 0.65)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const label = input.settings.showLabels ? input.getLabel?.(hand.slot, hand) : null;
  if (label) {
    ctx.font = `600 12px ${font}`;
    ctx.textBaseline = "middle";
    const chipH = 22;
    const marker = 14;
    const chipW = Math.min(ctx.measureText(label).width + marker + 18, size.width - 8);
    // Above the hand when there is room, otherwise below it: never on it.
    let chipY = by - chipH - 6;
    if (chipY < 4) chipY = Math.min(size.height - chipH - 4, by + bh + 6);
    const chipX = Math.max(4, Math.min(size.width - chipW - 4, bx));

    roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = "rgba(12, 12, 16, 0.72)";
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb}, 0.6)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Slot marker: a circle for slot 0, a square for slot 1 (not colour alone).
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.beginPath();
    if (hand.slot === 0) ctx.arc(chipX + 12, chipY + chipH / 2, 3.5, 0, Math.PI * 2);
    else ctx.rect(chipX + 8.5, chipY + chipH / 2 - 3.5, 7, 7);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.fillText(label, chipX + marker + 8, chipY + chipH / 2 + 0.5, chipW - marker - 14);
  }
}

/**
 * Clears the canvas and draws one frame. Call once per processed frame with
 * the size returned by `syncCanvasSize`.
 */
export function renderOverlay(ctx: CanvasRenderingContext2D, size: CanvasSize, input: OverlayInput): void {
  const font = input.fontFamily ?? "system-ui, sans-serif";
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  if (input.source === "simulator") {
    drawSimulatorBackdrop(ctx, size, input.simulatorBadge ?? DEFAULT_SIMULATOR_BADGE, font);
  }
  const frame = input.frame;
  if (!frame) return;
  const transform = getCoverTransform(frame.imageWidth, frame.imageHeight, size.width, size.height);
  for (const hand of frame.hands) {
    if (hand.landmarks.length < 21) continue;
    drawHand(ctx, size, hand, projectLandmarks(hand.landmarks, transform, input.mirror), input, font);
  }
}

/** Clears the whole canvas (used when tracking stops). */
export function clearOverlay(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
