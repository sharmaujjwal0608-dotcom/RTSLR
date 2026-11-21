/**
 * Small numeric helpers shared by the recognition models.
 * Everything here is pure and allocation-light: it runs once per video frame.
 */

export type NumericVector = ArrayLike<number>;

export function l2Norm(v: NumericVector): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/** Returns a unit-length copy. A zero vector stays zero. */
export function toUnitVector(v: NumericVector): Float32Array {
  const out = new Float32Array(v.length);
  const norm = l2Norm(v);
  if (norm < 1e-12) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

export function dot(a: NumericVector, b: NumericVector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Cosine similarity in [-1, 1]; 0 when either vector has no length. */
export function cosineSimilarity(a: NumericVector, b: NumericVector): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length mismatch (${a.length} vs ${b.length})`);
  }
  const na = l2Norm(a);
  const nb = l2Norm(b);
  if (na < 1e-12 || nb < 1e-12) return 0;
  return dot(a, b) / (na * nb);
}

/** Cosine distance in [0, 2]. */
export function cosineDistance(a: NumericVector, b: NumericVector): number {
  return 1 - cosineSimilarity(a, b);
}

export function isFiniteVector(v: NumericVector, expectedLength?: number): boolean {
  if (expectedLength !== undefined && v.length !== expectedLength) return false;
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) return false;
  }
  return true;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Numerically stable softmax, written into `out` (may alias `logits`). */
export function softmaxInto(logits: Float32Array, out: Float32Array): void {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
}
