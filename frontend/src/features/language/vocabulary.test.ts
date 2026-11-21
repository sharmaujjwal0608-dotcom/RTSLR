import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_ENTRIES,
  createVocabularyRegistry,
  listUnreviewedHindi,
  normalizeClassId,
  renderGloss,
  validateHindiGloss,
  vocabulary,
} from "./vocabulary";

describe("built-in vocabulary", () => {
  it("has letters A-Z and digits 0-9 for both ASL and ISL", () => {
    for (const signLanguage of ["ASL", "ISL"] as const) {
      for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const entry = vocabulary.get(c, signLanguage);
        expect(entry, `${signLanguage} ${c}`).toMatchObject({ kind: "letter", en: c });
      }
      for (const c of "0123456789") {
        expect(vocabulary.get(c, signLanguage)).toMatchObject({ kind: "digit", en: c });
      }
    }
  });

  it("keeps Latin letters and digits Latin in Hindi output", () => {
    for (const entry of BUILTIN_ENTRIES) {
      if (entry.kind !== "letter" && entry.kind !== "digit") continue;
      expect(entry.hi).toBe(entry.en);
      expect(entry.hi).not.toMatch(/[ऀ-ॿ]/);
    }
    expect(renderGloss(vocabulary.get("A", "ISL")!, "hi")).toEqual({
      text: "A",
      missingHindi: false,
      unreviewedHindi: false,
    });
  });

  it("has control tokens with aliases", () => {
    expect(vocabulary.get("SPACE", "ASL")).toMatchObject({ kind: "control", control: "space" });
    expect(vocabulary.get("del", "ASL")).toMatchObject({ kind: "control", control: "delete" });
    expect(vocabulary.get("new line", "ISL")).toMatchObject({ kind: "control", control: "newline" });
  });

  it("marks every built-in Hindi word gloss as not reviewed", () => {
    const words = BUILTIN_ENTRIES.filter((e) => e.kind === "word" || e.kind === "phrase");
    expect(words.length).toBeGreaterThan(20);
    for (const entry of words) {
      expect(entry.hiReviewed, entry.classId).toBe(false);
      expect(entry.hi, entry.classId).toMatch(/[ऀ-ॿ]/);
      expect(entry.signLanguage).toBe("ISL");
    }
    expect(listUnreviewedHindi().length).toBe(words.length);
  });

  it("does not offer word glosses for the ASL prototype", () => {
    expect(vocabulary.get("HELLO", "ASL")).toBeUndefined();
    expect(vocabulary.get("HELLO", "ISL")).toMatchObject({ en: "HELLO", hi: "नमस्ते" });
  });

  it("looks up ids case- and separator-insensitively", () => {
    expect(normalizeClassId("  thank-you ")).toBe("THANK_YOU");
    expect(vocabulary.get("thank you", "ISL")).toMatchObject({ kind: "phrase", en: "THANK YOU", hi: "धन्यवाद" });
  });
});

describe("resolve", () => {
  const registry = createVocabularyRegistry();

  it("falls back to the model label when the class id is unknown", () => {
    const entry = registry.resolve({ classId: "asl-legacy-07", label: "g", signLanguage: "ASL" });
    expect(entry).toMatchObject({ kind: "letter", en: "G", hi: "G" });
  });

  it("returns the English label with hi null for an unmapped class", () => {
    const entry = registry.resolve({ classId: "user-1", label: "Chai", signLanguage: "ISL" });
    expect(entry).toMatchObject({ kind: "word", en: "Chai", hi: null, hiReviewed: false, origin: "inferred" });
    expect(renderGloss(entry, "hi")).toEqual({ text: "Chai", missingHindi: true, unreviewedHindi: false });
    expect(renderGloss(entry, "en")).toEqual({ text: "Chai", missingHindi: false, unreviewedHindi: false });
  });

  it("flags an unreviewed built-in gloss", () => {
    const entry = registry.resolve({ classId: "WATER", label: "WATER", signLanguage: "ISL" });
    expect(renderGloss(entry, "hi")).toEqual({ text: "पानी", missingHindi: false, unreviewedHindi: true });
  });

  it("is not confused by prototype keys", () => {
    const entry = registry.resolve({ classId: "__proto__", label: "constructor", signLanguage: "ISL" });
    expect(entry).toMatchObject({ en: "constructor", hi: null, origin: "inferred" });
  });
});

describe("custom classes", () => {
  it("registers with hi null unless the user typed a gloss", () => {
    const registry = createVocabularyRegistry();
    const plain = registry.registerCustomClass({ classId: "u1", label: "Chai", signLanguage: "ISL" });
    expect(plain).toMatchObject({ kind: "word", en: "Chai", hi: null, hiReviewed: false, origin: "user" });
    const typed = registry.registerCustomClass({
      classId: "u2",
      label: "My school",
      signLanguage: "ISL",
      hi: "  मेरा   स्कूल ",
    });
    expect(typed).toMatchObject({ kind: "phrase", hi: "मेरा स्कूल", hiReviewed: false });
    expect(registry.get("u2", "ISL")).toBe(typed);
  });

  it("sets and clears the user's Hindi gloss and notifies subscribers", () => {
    const registry = createVocabularyRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    registry.registerCustomClass({ classId: "u1", label: "Chai", signLanguage: "ISL" });
    expect(registry.setHindiGloss("u1", "ISL", "चाय")).toMatchObject({ hi: "चाय", hiReviewed: false });
    expect(registry.setHindiGloss("u1", "ISL", null)).toMatchObject({ hi: null });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    registry.remove("u1", "ISL");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(registry.get("u1", "ISL")).toBeUndefined();
  });

  it("does not let built-ins be edited or removed", () => {
    const registry = createVocabularyRegistry();
    expect(registry.setHindiGloss("HELLO", "ISL", "हैलो")).toBeUndefined();
    expect(registry.remove("HELLO", "ISL")).toBe(false);
    expect(registry.get("HELLO", "ISL")?.hi).toBe("नमस्ते");
  });

  it("lets a user class shadow a built-in id, and restores it on removal", () => {
    const registry = createVocabularyRegistry();
    registry.registerCustomClass({ classId: "HELLO", label: "Hello", signLanguage: "ISL" });
    expect(registry.get("HELLO", "ISL")).toMatchObject({ origin: "user", hi: null });
    registry.remove("HELLO", "ISL");
    expect(registry.get("HELLO", "ISL")).toMatchObject({ origin: "builtin" });
  });

  it("keeps a custom single letter Latin and ignores a Devanagari gloss for it", () => {
    const registry = createVocabularyRegistry();
    const entry = registry.registerCustomClass({ classId: "u-a", label: "a", signLanguage: "ISL", hi: "ए" });
    expect(entry).toMatchObject({ kind: "letter", en: "A", hi: "A" });
    expect(registry.setHindiGloss("u-a", "ISL", "ए")).toBeUndefined();
  });

  it("rejects empty and over-long labels and glosses", () => {
    const registry = createVocabularyRegistry();
    expect(() => registry.registerCustomClass({ classId: "u", label: "  ", signLanguage: "ISL" })).toThrow(RangeError);
    expect(() =>
      registry.registerCustomClass({ classId: "u", label: "x".repeat(65), signLanguage: "ISL" }),
    ).toThrow(RangeError);
    expect(validateHindiGloss(" \u0000 ")).toEqual({ ok: false, reason: "empty" });
    expect(validateHindiGloss("क".repeat(65))).toEqual({ ok: false, reason: "too_long" });
    expect(validateHindiGloss(" चाय\n")).toEqual({ ok: true, value: "चाय" });
  });
});
