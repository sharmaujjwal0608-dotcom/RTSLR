import { describe, expect, it } from "vitest";
import {
  BOX_INTERVAL_DAYS,
  MAX_BOX,
  addDays,
  advanceQueue,
  buildQueue,
  dayKey,
  isDayKey,
  rateCard,
  summarizeCards,
  type SrsCard,
} from "./srs";

const at = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 10, 30);
};
const card = (box: number, due: string, lastRating: SrsCard["lastRating"] = "got-it"): SrsCard => ({
  box,
  due,
  lastRating,
  reviews: 1,
  lastReviewedAt: at("2026-11-01").toISOString(),
});

describe("day helpers", () => {
  it("formats the local calendar day", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-21", 0)).toBe("2026-11-21");
  });

  it("validates day keys", () => {
    expect(isDayKey("2026-11-21")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-1-1")).toBe(false);
    expect(isDayKey(20261121)).toBe(false);
  });
});

describe("rateCard", () => {
  const now = at("2026-11-21");

  it("moves a new item to box 2 on got-it, due after the interval of that box", () => {
    const next = rateCard(undefined, "got-it", now);
    expect(next.box).toBe(2);
    expect(next.due).toBe(addDays("2026-11-21", BOX_INTERVAL_DAYS[2]));
    expect(next.reviews).toBe(1);
    expect(next.lastRating).toBe("got-it");
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it("keeps a new item in box 1, due today, on need-practice", () => {
    const next = rateCard(undefined, "need-practice", now);
    expect(next.box).toBe(1);
    expect(next.due).toBe("2026-11-21");
  });

  it("climbs one box per got-it with growing gaps and stops at the top box", () => {
    let current: SrsCard | undefined;
    const gaps: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      current = rateCard(current, "got-it", now);
      gaps.push(BOX_INTERVAL_DAYS[current.box]);
    }
    expect(current?.box).toBe(MAX_BOX);
    expect(current?.reviews).toBe(7);
    expect(gaps).toEqual([1, 3, 7, 14, 14, 14, 14]);
    expect(current?.due).toBe(addDays("2026-11-21", 14));
  });

  it("drops back to box 1 on need-practice from any box", () => {
    const next = rateCard(card(5, "2026-11-21"), "need-practice", now);
    expect(next.box).toBe(1);
    expect(next.due).toBe("2026-11-21");
    expect(next.reviews).toBe(2);
  });
});

describe("buildQueue", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const today = "2026-11-21";

  it("offers never-rated items in content order when nothing is due", () => {
    expect(buildQueue(ids, {}, today, { limit: 3 })).toEqual([
      { signId: "a", reason: "new" },
      { signId: "b", reason: "new" },
      { signId: "c", reason: "new" },
    ]);
  });

  it("puts due items first: most overdue, then lowest box", () => {
    const cards = {
      b: card(3, "2026-11-21"),
      c: card(2, "2026-11-19"),
      d: card(1, "2026-11-21"),
      e: card(4, "2026-11-25"), // not due yet
    };
    expect(buildQueue(ids, cards, today)).toEqual([
      { signId: "c", reason: "due" },
      { signId: "d", reason: "due" },
      { signId: "b", reason: "due" },
      { signId: "a", reason: "new" },
      { signId: "f", reason: "new" },
    ]);
  });

  it("leaves out items scheduled for a later day", () => {
    const cards = Object.fromEntries(ids.map((id) => [id, card(3, "2026-12-01")]));
    expect(buildQueue(ids, cards, today)).toEqual([]);
    expect(buildQueue(ids, cards, "2026-12-01")).toHaveLength(6);
  });

  it("respects the session limit and the new-item limit", () => {
    const cards = { a: card(1, today), b: card(1, today) };
    expect(buildQueue(ids, cards, today, { limit: 3 }).map((e) => e.signId)).toEqual(["a", "b", "c"]);
    expect(buildQueue(ids, cards, today, { limit: 10, newLimit: 1 }).map((e) => e.signId)).toEqual(["a", "b", "c"]);
    expect(buildQueue(ids, cards, today, { limit: 1 })).toHaveLength(1);
  });

  it("ignores cards for ids that are not in the list, and inherited keys", () => {
    expect(buildQueue(["toString"], { zzz: card(1, today) }, today)).toEqual([{ signId: "toString", reason: "new" }]);
  });

  it("feeds from ratings: a rated item leaves the queue until it is due again", () => {
    const now = at(today);
    const cards: Record<string, SrsCard> = {
      a: rateCard(undefined, "got-it", now),
      b: rateCard(undefined, "need-practice", now),
    };
    expect(buildQueue(["a", "b", "c"], cards, today).map((e) => e.signId)).toEqual(["b", "c"]);
    expect(buildQueue(["a", "b", "c"], cards, addDays(today, 1)).map((e) => e.signId)).toEqual(["b", "a", "c"]);
  });
});

describe("advanceQueue", () => {
  const queue = [
    { signId: "a", reason: "new" as const },
    { signId: "b", reason: "new" as const },
  ];

  it("drops the head after got-it", () => {
    expect(advanceQueue(queue, "got-it")).toEqual([{ signId: "b", reason: "new" }]);
  });

  it("sends the head to the back after need-practice", () => {
    expect(advanceQueue(queue, "need-practice")).toEqual([
      { signId: "b", reason: "new" },
      { signId: "a", reason: "due" },
    ]);
  });

  it("ends the session when the last item is rated either way", () => {
    expect(advanceQueue([queue[0]], "need-practice")).toEqual([]);
    expect(advanceQueue([queue[0]], "got-it")).toEqual([]);
    expect(advanceQueue([], "got-it")).toEqual([]);
  });
});

describe("summarizeCards", () => {
  it("counts ratings and what is due", () => {
    const cards = {
      a: card(2, "2026-11-21"),
      b: card(1, "2026-11-20", "need-practice"),
      c: card(4, "2026-11-30"),
    };
    expect(summarizeCards(cards, "2026-11-21")).toEqual({ rated: 3, gotIt: 2, needPractice: 1, dueToday: 2 });
    expect(summarizeCards({}, "2026-11-21")).toEqual({ rated: 0, gotIt: 0, needPractice: 0, dueToday: 0 });
  });
});
