import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_ENTRIES } from "../language/vocabulary";
import {
  ALPHABET_CATEGORY_IDS,
  CATEGORIES,
  DICTIONARY_SOURCE,
  EVERYDAY_CATEGORY_IDS,
  LESSONS,
  SIGNS,
  categoryHref,
  getLesson,
  getSign,
  lessonForSign,
  signIdFor,
  signsInCategory,
  signsInLesson,
} from "./content";

describe("learning content", () => {
  it("has the eight categories in order", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      "alphabet",
      "numbers",
      "greetings",
      "everyday",
      "family",
      "questions",
      "time-and-days",
      "places",
    ]);
    expect([...ALPHABET_CATEGORY_IDS, ...EVERYDAY_CATEGORY_IDS].sort()).toEqual(CATEGORIES.map((c) => c.id).sort());
  });

  it("gives every sign a unique, URL-safe id and both meanings", () => {
    const ids = SIGNS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sign of SIGNS) {
      expect(sign.id).toMatch(/^isl-[a-z0-9-]+$/);
      expect(sign.id).toBe(signIdFor(sign.category, sign.en));
      expect(sign.en.trim()).not.toBe("");
      expect(sign.hi.trim()).not.toBe("");
      expect(getSign(sign.id)).toBe(sign);
    }
  });

  it("ships no demonstration media and claims no recognition", () => {
    for (const sign of SIGNS) {
      expect(sign.media).toBeNull();
      expect(sign.recognition).toBe("none");
      expect(sign.source).toBe(DICTIONARY_SOURCE);
    }
    expect(DICTIONARY_SOURCE.verified).toBe(false);
    expect(DICTIONARY_SOURCE.url).toBe("https://islrtc.nic.in/");
  });

  it("lists A to Z and 0 to 9 as vocabulary items", () => {
    expect(signsInCategory("alphabet").map((s) => s.en).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(signsInCategory("numbers").map((s) => s.en).join("")).toBe("0123456789");
    expect(signsInCategory("alphabet").every((s) => s.kind === "letter" && s.hi === s.en)).toBe(true);
    expect(signsInCategory("numbers").every((s) => s.kind === "digit")).toBe(true);
  });

  it("marks only the Latin letters as needing no Hindi review", () => {
    for (const sign of SIGNS) expect(sign.hiReviewed).toBe(sign.kind === "letter");
  });

  it("builds lessons from existing signs, each sign in exactly one lesson", () => {
    const seen = new Map<string, number>();
    for (const lesson of LESSONS) {
      expect(getLesson(lesson.id)).toBe(lesson);
      expect(lesson.signIds.length).toBeGreaterThan(0);
      expect(signsInLesson(lesson)).toHaveLength(lesson.signIds.length);
      for (const id of lesson.signIds) {
        expect(getSign(id)?.category).toBe(lesson.category);
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }
    }
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const sign of SIGNS) {
      expect(seen.get(sign.id)).toBe(1);
      expect(lessonForSign(sign.id)).toBeDefined();
    }
  });

  it("routes each category to its page", () => {
    expect(categoryHref("alphabet")).toBe("/learn/alphabet");
    expect(categoryHref("numbers")).toBe("/learn/alphabet");
    expect(categoryHref("places")).toBe("/learn/everyday");
  });

  it("reuses the transcript vocabulary's Hindi glosses for word classes that overlap", () => {
    const vocabulary = new Map(
      BUILTIN_ENTRIES.filter((e) => e.signLanguage === "ISL" && (e.kind === "word" || e.kind === "phrase")).map(
        (e) => [e.classId, e.hi],
      ),
    );
    const overlap = SIGNS.filter((s) => vocabulary.has(s.classId));
    expect(overlap.length).toBeGreaterThan(20);
    for (const sign of overlap) expect(sign.hi).toBe(vocabulary.get(sign.classId));
  });
});

type SeedCategory = {
  id: string;
  signs: [string, string | null][];
  lessons: { id: string; signs: string[] }[];
};

const seedPath = resolve(process.cwd(), "../backend/app/db/seed_data/curriculum.json");
const seedSlug = (en: string) => en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

describe.skipIf(!existsSync(seedPath))("consistency with the backend seed", () => {
  const seed = existsSync(seedPath)
    ? (JSON.parse(readFileSync(seedPath, "utf8")) as { categories: SeedCategory[] })
    : { categories: [] };

  it("has the same category, sign and lesson ids", () => {
    expect(seed.categories.map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id));
    const seedSignIds = seed.categories.flatMap((c) => c.signs.map(([en]) => `isl-${c.id}-${seedSlug(en)}`));
    expect(seedSignIds).toEqual(SIGNS.map((s) => s.id));
    expect(seed.categories.flatMap((c) => c.lessons.map((l) => l.id))).toEqual(LESSONS.map((l) => l.id));
  });

  it("has the same lesson contents", () => {
    for (const category of seed.categories) {
      for (const lesson of category.lessons) {
        const mine = getLesson(lesson.id);
        expect(mine).toBeDefined();
        if (mine) expect(signsInLesson(mine).map((s) => s.en)).toEqual(lesson.signs);
      }
    }
  });

  it("differs from the seed Hindi only where documented", () => {
    const different: string[] = [];
    for (const category of seed.categories) {
      for (const [en, hi] of category.signs) {
        const sign = SIGNS.find((s) => s.category === category.id && s.en === en);
        if (sign && (hi ?? en) !== sign.hi) different.push(sign.id);
      }
    }
    // WELCOME follows the transcript vocabulary gloss ("स्वागत है"); the seed has "स्वागत".
    expect(different).toEqual(["isl-greetings-welcome"]);
  });
});
