export type ClassValue = string | number | false | null | undefined | ClassValue[];

/**
 * Joins class names, skipping falsy values. It does NOT resolve Tailwind
 * conflicts: a `className` passed to a primitive is appended, so use it to
 * add layout (margin, grid placement, width), not to override the
 * primitive's own colour, padding or radius.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(" ");
}
