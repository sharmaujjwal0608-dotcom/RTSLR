/**
 * One Euro filtering of hand landmarks (Casiez, Roussel, Vogel, CHI 2012).
 *
 * A first-order low-pass whose cutoff rises with speed: steady when the hand
 * is still, responsive when it moves. One filter per landmark coordinate,
 * per slot. Filters are reset whenever a slot is reassigned to a new hand.
 */
import { LANDMARKS_PER_HAND, type Landmark } from "@/types/recognition";
import type { SmoothingSettings } from "./types";

/** Defaults chosen for coordinates normalised to 0..1. They have not been
 *  tuned against real camera footage (see README, known limitations). */
export const DEFAULT_SMOOTHING: SmoothingSettings = {
  enabled: true,
  minCutoff: 1.5,
  beta: 10,
  dCutoff: 1,
};

export type OneEuroParams = Pick<SmoothingSettings, "minCutoff" | "beta" | "dCutoff">;

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const r = 2 * Math.PI * cutoffHz * dtSeconds;
  return r / (r + 1);
}

export class OneEuroFilter {
  private hasValue = false;
  private prevValue = 0;
  private prevDerivative = 0;
  private prevTime = 0;

  constructor(private params: OneEuroParams) {}

  setParams(params: OneEuroParams): void {
    this.params = params;
  }

  reset(): void {
    this.hasValue = false;
    this.prevDerivative = 0;
  }

  /** @param timeMs monotonically increasing timestamp in milliseconds. */
  filter(value: number, timeMs: number): number {
    if (!Number.isFinite(value)) return this.hasValue ? this.prevValue : value;
    if (!this.hasValue) {
      this.hasValue = true;
      this.prevValue = value;
      this.prevTime = timeMs;
      this.prevDerivative = 0;
      return value;
    }
    const dt = (timeMs - this.prevTime) / 1000;
    if (!(dt > 0)) return this.prevValue;

    const rawDerivative = (value - this.prevValue) / dt;
    const aD = smoothingFactor(this.params.dCutoff, dt);
    const derivative = this.prevDerivative + aD * (rawDerivative - this.prevDerivative);

    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(derivative);
    const a = smoothingFactor(cutoff, dt);
    const filtered = this.prevValue + a * (value - this.prevValue);

    this.prevValue = filtered;
    this.prevDerivative = derivative;
    this.prevTime = timeMs;
    return filtered;
  }
}

/** Smooths the 21 landmarks of up to two slots. */
export class LandmarkSmoother {
  private settings: SmoothingSettings;
  private readonly filters: [OneEuroFilter[], OneEuroFilter[]];

  constructor(settings: SmoothingSettings = DEFAULT_SMOOTHING) {
    this.settings = { ...settings };
    const make = () =>
      Array.from({ length: LANDMARKS_PER_HAND * 3 }, () => new OneEuroFilter(this.settings));
    this.filters = [make(), make()];
  }

  configure(settings: SmoothingSettings): void {
    const wasEnabled = this.settings.enabled;
    this.settings = { ...settings };
    for (const slotFilters of this.filters) {
      for (const f of slotFilters) f.setParams(this.settings);
    }
    // Turning smoothing back on must not blend with stale state.
    if (!wasEnabled && settings.enabled) this.resetAll();
  }

  reset(slot: 0 | 1): void {
    for (const f of this.filters[slot]) f.reset();
  }

  resetAll(): void {
    this.reset(0);
    this.reset(1);
  }

  /** Returns new landmark objects; the input is never mutated. */
  smooth(slot: 0 | 1, landmarks: readonly Landmark[], timeMs: number): Landmark[] {
    if (!this.settings.enabled) return landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    const filters = this.filters[slot];
    const count = Math.min(landmarks.length, LANDMARKS_PER_HAND);
    const out: Landmark[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const p = landmarks[i];
      out[i] = {
        x: filters[i * 3].filter(p.x, timeMs),
        y: filters[i * 3 + 1].filter(p.y, timeMs),
        z: filters[i * 3 + 2].filter(p.z, timeMs),
      };
    }
    return out;
  }
}
