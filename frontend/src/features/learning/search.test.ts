import { describe, expect, it } from "vitest";
import { SIGNS } from "./content";
import { countByCategory, filterSigns, foldText } from "./search";

const names = (query: string, extra = {}) => filterSigns(SIGNS, { query, ...extra }).map((s) => s.en);

describe("foldText", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(foldText("  Good   MORNING ")).toBe("good morning");
  });

  it("treats nukta and chandrabindu variants as the same text", () => {
    expect(foldText("माफ़ कीजिए")).toBe(foldText("माफ कीजिए"));
    expect(foldText("फ़")).toBe(foldText("फ़")); // fa + nukta vs precomposed
    expect(foldText("हाँ")).toBe(foldText("हां"));
  });
});

describe("filterSigns", () => {
  it("returns everything in content order without a query", () => {
    expect(filterSigns(SIGNS)).toEqual([...SIGNS]);
    expect(filterSigns(SIGNS, { query: "   " })).toHaveLength(SIGNS.length);
  });

  it("matches English case-insensitively", () => {
    expect(names("WATER")).toEqual(["Water"]);
    expect(names("water")).toEqual(["Water"]);
    expect(names("good")).toEqual(["Good", "Good morning", "Good night", "Goodbye"]);
  });

  it("matches Devanagari input", () => {
    expect(names("पानी")).toEqual(["Water"]);
    expect(names("माफ")).toEqual(["Sorry"]);
    // "हां" typed with anusvara finds हाँ (exact, first) and कहाँ (contains it).
    expect(names("हां")).toEqual(["Yes", "Where"]);
    expect(names("वार")).toContain("Monday");
    expect(names("वार")).toContain("Family");
  });

  it("requires every word of the query", () => {
    expect(names("railway station")).toEqual(["Railway station"]);
    expect(names("station bus")).toEqual([]);
  });

  it("puts exact and prefix matches first", () => {
    expect(names("a")[0]).toBe("A");
    expect(names("how")).toEqual(["How", "How many"]);
  });

  it("returns nothing for an unknown word", () => {
    expect(names("zzzz")).toEqual([]);
  });

  it("filters by category", () => {
    expect(names("", { category: "questions" })).toHaveLength(8);
    expect(names("s", { category: "family" })).toEqual(["Sister", "Son", "Husband"]);
    expect(names("", { category: "all" })).toHaveLength(SIGNS.length);
  });

  it("filters by favourites, given as an array or a set", () => {
    const favourites = ["isl-everyday-water", "isl-family-mother"];
    expect(names("", { favouritesOnly: true, favourites })).toEqual(["Water", "Mother"]);
    expect(names("mo", { favouritesOnly: true, favourites: new Set(favourites) })).toEqual(["Mother"]);
    expect(names("", { favouritesOnly: true })).toEqual([]);
  });
});

describe("countByCategory", () => {
  it("counts matches per category for the query", () => {
    const all = countByCategory(SIGNS);
    expect(all.all).toBe(SIGNS.length);
    expect(all.alphabet).toBe(26);
    expect(all.numbers).toBe(10);
    const morning = countByCategory(SIGNS, { query: "morning" });
    expect(morning.all).toBe(2);
    expect(morning.greetings).toBe(1);
    expect(morning["time-and-days"]).toBe(1);
    expect(morning.places).toBe(0);
  });
});
