/**
 * Search and filter over the sign list. Pure functions, no React.
 *
 * Matching is case-insensitive and works on both the English and the Hindi
 * meaning. Devanagari input is folded so that common keyboard variants find
 * the same word: a missing nukta ("माफ" finds "माफ़") and anusvara typed for
 * chandrabindu ("हां" finds "हाँ").
 */

import type { CategoryId, SignItem } from "./content";

const NUKTA = /़/g;
const CHANDRABINDU = /ँ/g;
const JOINERS = /[‌‍]/g;

/** Folds text for comparison. NFD first so precomposed nukta letters split. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(NUKTA, "")
    .replace(CHANDRABINDU, "ं")
    .replace(JOINERS, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type SignFilter = {
  query?: string;
  /** "all" or undefined: every category. */
  category?: CategoryId | "all";
  /** When true, only ids present in `favourites` are kept. */
  favouritesOnly?: boolean;
  favourites?: ReadonlySet<string> | readonly string[];
};

function matchesQuery(sign: SignItem, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = `${foldText(sign.en)} ${foldText(sign.hi)}`;
  return tokens.every((token) => haystack.includes(token));
}

/** Rank: exact match, then prefix, then anywhere. Lower is better. */
function rank(sign: SignItem, folded: string): number {
  const en = foldText(sign.en);
  const hi = foldText(sign.hi);
  if (en === folded || hi === folded) return 0;
  if (en.startsWith(folded) || hi.startsWith(folded)) return 1;
  return 2;
}

/**
 * Returns the signs that match every part of the filter. Without a query the
 * original order is kept; with one, exact and prefix matches come first.
 */
export function filterSigns(signs: readonly SignItem[], filter: SignFilter = {}): SignItem[] {
  const folded = foldText(filter.query ?? "");
  const tokens = folded.length > 0 ? folded.split(" ") : [];
  const favourites =
    filter.favourites instanceof Set ? filter.favourites : new Set<string>(filter.favourites ?? []);

  const matched = signs.filter((sign) => {
    if (filter.category && filter.category !== "all" && sign.category !== filter.category) return false;
    if (filter.favouritesOnly && !favourites.has(sign.id)) return false;
    return matchesQuery(sign, tokens);
  });

  if (tokens.length === 0) return matched;
  return matched
    .map((sign, index) => ({ sign, index, score: rank(sign, folded) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.sign);
}

/** Number of matches per category for the current query (rail counts). */
export function countByCategory(
  signs: readonly SignItem[],
  filter: Omit<SignFilter, "category"> = {},
): Record<CategoryId | "all", number> {
  const counts = {
    all: 0,
    alphabet: 0,
    numbers: 0,
    greetings: 0,
    everyday: 0,
    family: 0,
    questions: 0,
    "time-and-days": 0,
    places: 0,
  } satisfies Record<CategoryId | "all", number>;
  for (const sign of filterSigns(signs, { ...filter, category: "all" })) {
    counts.all += 1;
    counts[sign.category] += 1;
  }
  return counts;
}
