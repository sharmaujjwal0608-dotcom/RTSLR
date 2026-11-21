import { describe, expect, it } from "vitest";
import { openHand, seededRandom } from "./fixtures";
import { DEFAULT_SMOOTHING, LandmarkSmoother, OneEuroFilter } from "./smoothing";

const params = { minCutoff: 1, beta: 0, dCutoff: 1 };

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
}

describe("OneEuroFilter", () => {
  it("returns the first sample unchanged", () => {
    expect(new OneEuroFilter(params).filter(0.42, 1000)).toBe(0.42);
  });

  it("leaves a constant signal constant", () => {
    const f = new OneEuroFilter(params);
    for (let i = 0; i < 20; i++) expect(f.filter(0.3, i * 33)).toBeCloseTo(0.3, 12);
  });

  it("matches the closed form for the second sample", () => {
    // beta = 0: cutoff = 1 Hz, dt = 0.1 s -> r = 2*pi*0.1, alpha = r / (r + 1).
    const f = new OneEuroFilter(params);
    f.filter(0, 0);
    const r = 2 * Math.PI * 0.1;
    expect(f.filter(1, 100)).toBeCloseTo(r / (r + 1), 12);
  });

  it("reduces jitter on a noisy steady signal", () => {
    const rnd = seededRandom(1);
    const f = new OneEuroFilter(DEFAULT_SMOOTHING);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 200; i++) {
      const v = 0.5 + (rnd() - 0.5) * 0.01;
      raw.push(v);
      out.push(f.filter(v, i * 33));
    }
    expect(variance(out.slice(20))).toBeLessThan(variance(raw.slice(20)) * 0.5);
  });

  it("lags less with a higher beta when the signal moves", () => {
    const run = (beta: number) => {
      const f = new OneEuroFilter({ minCutoff: 1, beta, dCutoff: 1 });
      let last = 0;
      for (let i = 0; i <= 30; i++) last = f.filter(i * 0.02, i * 33);
      return Math.abs(0.6 - last);
    };
    expect(run(20)).toBeLessThan(run(0));
  });

  it("converges to a step and starts over after reset", () => {
    const f = new OneEuroFilter(params);
    f.filter(0, 0);
    let v = 0;
    for (let i = 1; i <= 200; i++) v = f.filter(1, i * 33);
    expect(v).toBeCloseTo(1, 3);
    f.reset();
    expect(f.filter(5, 10_000)).toBe(5);
  });

  it("ignores non-increasing timestamps and non-finite input", () => {
    const f = new OneEuroFilter(params);
    f.filter(1, 100);
    expect(f.filter(9, 100)).toBe(1);
    expect(f.filter(9, 50)).toBe(1);
    expect(f.filter(Number.NaN, 200)).toBe(1);
  });
});

describe("LandmarkSmoother", () => {
  it("returns 21 new landmark objects and does not mutate the input", () => {
    const s = new LandmarkSmoother();
    const hand = openHand();
    const copy = JSON.stringify(hand);
    const out = s.smooth(0, hand, 0);
    expect(out).toHaveLength(21);
    expect(out[0]).not.toBe(hand[0]);
    expect(out).toEqual(hand);
    expect(JSON.stringify(hand)).toBe(copy);
  });

  it("keeps the two slots independent", () => {
    const s = new LandmarkSmoother({ ...DEFAULT_SMOOTHING, beta: 0 });
    s.smooth(0, openHand(0.2), 0);
    const first = s.smooth(1, openHand(0.8), 33);
    expect(first[0].x).toBe(0.8);
    const lagged = s.smooth(0, openHand(0.4), 33);
    expect(lagged[0].x).toBeGreaterThan(0.2);
    expect(lagged[0].x).toBeLessThan(0.4);
  });

  it("does not blend a new hand with the old one after a slot reset", () => {
    const s = new LandmarkSmoother({ ...DEFAULT_SMOOTHING, beta: 0 });
    s.smooth(0, openHand(0.2), 0);
    s.reset(0);
    expect(s.smooth(0, openHand(0.8), 33)[0].x).toBe(0.8);
  });

  it("passes values through when disabled and restarts cleanly when re-enabled", () => {
    const s = new LandmarkSmoother({ ...DEFAULT_SMOOTHING, beta: 0 });
    s.smooth(0, openHand(0.2), 0);
    s.configure({ ...DEFAULT_SMOOTHING, beta: 0, enabled: false });
    expect(s.smooth(0, openHand(0.9), 33)[0].x).toBe(0.9);
    s.configure({ ...DEFAULT_SMOOTHING, beta: 0, enabled: true });
    expect(s.smooth(0, openHand(0.5), 66)[0].x).toBe(0.5);
  });
});
