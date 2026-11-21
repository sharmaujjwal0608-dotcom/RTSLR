/**
 * Defensive helpers for JSON that comes from a file, the network or browser
 * storage (docs/SECURITY_PRIVACY.md MOD-06, MOD-08..MOD-12).
 *
 * Nothing here evaluates code: input is parsed with JSON.parse only and every
 * value is checked before it is used.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

export const MAX_LABEL_LENGTH = 64;
export const MAX_CLASS_COUNT = 2000;
/** 5 MB cap for JSON models and for user-imported sample files (MOD-06). */
export const MAX_JSON_BYTES = 5 * 1024 * 1024;

export type JsonObject = { [key: string]: unknown };

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Walks the parsed value and rejects any object that carries a
 * prototype-pollution key at any depth (MOD-10). JSON.parse creates
 * "__proto__" as an own property, so Object.keys does see it.
 */
export function assertNoForbiddenKeys(value: unknown, path = "$", depth = 0): void {
  if (depth > 12) throw new ValidationError(`${path}: nesting is too deep`);
  if (Array.isArray(value)) {
    // Numeric leaf arrays are the bulk of a model file: skip them quickly.
    if (value.length > 0 && typeof value[0] === "number") return;
    for (let i = 0; i < value.length; i++) assertNoForbiddenKeys(value[i], `${path}[${i}]`, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new ValidationError(`${path}: forbidden key "${key}"`);
    assertNoForbiddenKeys(value[key], `${path}.${key}`, depth + 1);
  }
}

/** Rejects unknown keys and returns the object typed as a record. */
export function expectObject(value: unknown, path: string, allowedKeys: readonly string[]): JsonObject {
  if (!isPlainObject(value)) throw new ValidationError(`${path}: expected an object`);
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new ValidationError(`${path}: forbidden key "${key}"`);
    if (!allowed.has(key)) throw new ValidationError(`${path}: unknown key "${key}"`);
  }
  return value;
}

export function expectString(value: unknown, path: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new ValidationError(`${path}: expected a string`);
  if (!allowEmpty && value.trim().length === 0) throw new ValidationError(`${path}: must not be empty`);
  if (value.length > maxLength) throw new ValidationError(`${path}: longer than ${maxLength} characters`);
  return value;
}

/** A class id or label: short, non-empty and never a prototype key. */
export function expectLabel(value: unknown, path: string): string {
  const label = expectString(value, path, MAX_LABEL_LENGTH);
  if (FORBIDDEN_KEYS.has(label)) throw new ValidationError(`${path}: "${label}" is not allowed as a label`);
  return label;
}

export function expectFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${path}: expected a finite number`);
  }
  return value;
}

export function expectInteger(value: unknown, path: string, min: number, max: number): number {
  const n = expectFiniteNumber(value, path);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${path}: expected an integer between ${min} and ${max}`);
  }
  return n;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(`${path}: expected true or false`);
  return value;
}

export function expectArray(value: unknown, path: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`${path}: expected an array`);
  if (value.length > maxLength) throw new ValidationError(`${path}: more than ${maxLength} entries`);
  return value;
}

/** Copies a JSON number array of an exact length into a typed array (MOD-13). */
export function expectFloatVector(value: unknown, path: string, length: number): Float32Array {
  if (!Array.isArray(value)) throw new ValidationError(`${path}: expected an array of numbers`);
  if (value.length !== length) {
    throw new ValidationError(`${path}: expected ${length} numbers, found ${value.length}`);
  }
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const n: unknown = value[i];
    if (typeof n !== "number" || !Number.isFinite(n)) {
      throw new ValidationError(`${path}[${i}]: expected a finite number`);
    }
    out[i] = n;
    if (!Number.isFinite(out[i])) throw new ValidationError(`${path}[${i}]: out of 32-bit float range`);
  }
  return out;
}

export function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) {
    throw new ValidationError(`${path}: expected one of ${options.join(", ")}`);
  }
  return value as T;
}

/** UTF-8 size of a string without allocating the encoded bytes twice. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/** JSON.parse with a size cap and a prototype-key sweep. Never evaluates code. */
export function parseJsonSafely(text: string, maxBytes: number, what: string): unknown {
  // text.length is a lower bound of the UTF-8 size, so this cheap test is safe.
  if (text.length > maxBytes || utf8ByteLength(text) > maxBytes) {
    throw new ValidationError(`${what} is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError(`${what} is not valid JSON`);
  }
  assertNoForbiddenKeys(parsed);
  return parsed;
}
