/**
 * A simple spaced-repetition queue (Leitner boxes) driven by the learner's own
 * rating. "Got it" moves an item up one box and schedules it further away;
 * "Need practice" sends it back to box 1, due again the same day.
 *
 * The rating is a self-assessment. Nothing here judges whether a sign was made
 * correctly.
 */

export type SelfRating = "got-it" | "need-practice";

export type SrsCard = {
  /** 1 (new or needs practice) to MAX_BOX (well known). */
  box: number;
  /** Local calendar day (YYYY-MM-DD) on which the item is next due. */
  due: string;
  lastRating: SelfRating;
  /** Number of ratings given. */
  reviews: number;
  /** ISO timestamp of the last rating. */
  lastReviewedAt: string;
};

export const MAX_BOX = 5;
/** Days until the next review, by box (index 0 is unused). */
export const BOX_INTERVAL_DAYS: readonly number[] = [0, 0, 1, 3, 7, 14];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a date as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Adds whole calendar days to a day key (DST-safe: works on local dates). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** Applies a rating and returns the new card. `previous` is undefined for a new item. */
export function rateCard(previous: SrsCard | undefined, rating: SelfRating, now: Date): SrsCard {
  const today = dayKey(now);
  const box = rating === "got-it" ? Math.min(MAX_BOX, (previous?.box ?? 1) + 1) : 1;
  return {
    box,
    due: addDays(today, BOX_INTERVAL_DAYS[box]),
    lastRating: rating,
    reviews: (previous?.reviews ?? 0) + 1,
    lastReviewedAt: now.toISOString(),
  };
}

export type QueueOptions = {
  /** Maximum number of items in the session. */
  limit?: number;
  /** Maximum number of never-rated items added after the due ones. */
  newLimit?: number;
};

export type QueueEntry = { signId: string; reason: "due" | "new" };

/**
 * Builds a practice session: items that are due today or overdue (oldest due
 * date first, then lowest box), followed by items never rated, in the order of
 * `signIds`. Items scheduled for a later day are left out.
 */
export function buildQueue(
  signIds: readonly string[],
  cards: Readonly<Record<string, SrsCard>>,
  today: string,
  { limit = 12, newLimit = 8 }: QueueOptions = {},
): QueueEntry[] {
  const due: { signId: string; card: SrsCard; index: number }[] = [];
  const fresh: string[] = [];
  signIds.forEach((signId, index) => {
    const card = Object.hasOwn(cards, signId) ? cards[signId] : undefined;
    if (!card) fresh.push(signId);
    else if (card.due <= today) due.push({ signId, card, index });
  });
  due.sort((a, b) => a.card.due.localeCompare(b.card.due) || a.card.box - b.card.box || a.index - b.index);

  const queue: QueueEntry[] = due.slice(0, limit).map(({ signId }) => ({ signId, reason: "due" }));
  for (const signId of fresh.slice(0, newLimit)) {
    if (queue.length >= limit) break;
    queue.push({ signId, reason: "new" });
  }
  return queue;
}

/**
 * Session step: removes the head of the queue. After "need practice" the item
 * goes to the back so it comes round once more in the same session.
 */
export function advanceQueue(queue: readonly QueueEntry[], rating: SelfRating): QueueEntry[] {
  const [head, ...rest] = queue;
  if (!head) return [];
  return rating === "need-practice" && rest.length > 0 ? [...rest, { signId: head.signId, reason: "due" }] : rest;
}

export type SrsSummary = { rated: number; gotIt: number; needPractice: number; dueToday: number };

export function summarizeCards(cards: Readonly<Record<string, SrsCard>>, today: string): SrsSummary {
  const summary: SrsSummary = { rated: 0, gotIt: 0, needPractice: 0, dueToday: 0 };
  for (const card of Object.values(cards)) {
    summary.rated += 1;
    if (card.lastRating === "got-it") summary.gotIt += 1;
    else summary.needPractice += 1;
    if (card.due <= today) summary.dueToday += 1;
  }
  return summary;
}
