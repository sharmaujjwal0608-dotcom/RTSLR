import { describe, expect, it } from "vitest";
import { DICTIONARY_SOURCE, SIGNS, getSign, type SignItem } from "./content";
import { createRng, generateQuestion, generateQuiz, isCorrect, quizPool, shuffle } from "./quiz";
import { foldText } from "./search";

const item = (id: string, en: string, hi: string, category: SignItem["category"] = "everyday"): SignItem => ({
  id,
  category,
  en,
  hi,
  kind: "word",
  media: null,
  source: DICTIONARY_SOURCE,
  recognition: "none",
  classId: en.toUpperCase(),
  hiReviewed: false,
});

const mustGet = (id: string): SignItem => {
  const sign = getSign(id);
  if (!sign) throw new Error(`unknown sign ${id}`);
  return sign;
};

describe("createRng and shuffle", () => {
  it("is deterministic for a seed and stays in [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 50 }, () => a());
    expect(values).toEqual(Array.from({ length: 50 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("shuffles without losing or changing items", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, createRng(7));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("quizPool", () => {
  it("leaves out letters, whose two meanings are the same text", () => {
    const pool = quizPool(SIGNS);
    expect(pool.some((s) => s.kind === "letter")).toBe(false);
    expect(pool).toHaveLength(SIGNS.length - 26);
  });
});

describe("generateQuiz", () => {
  for (const direction of ["en-hi", "hi-en"] as const) {
    it(`builds valid ${direction} questions for many seeds`, () => {
      for (let seed = 1; seed <= 40; seed += 1) {
        const questions = generateQuiz(SIGNS, { direction, count: 10, rng: createRng(seed) });
        expect(questions).toHaveLength(10);
        expect(new Set(questions.map((q) => q.signId)).size).toBe(10);

        for (const question of questions) {
          const target = mustGet(question.signId);
          const expected = direction === "en-hi" ? target.hi : target.en;
          expect(question.prompt).toBe(direction === "en-hi" ? target.en : target.hi);
          expect(question.options).toHaveLength(4);

          // The correct answer is present, exactly once, at correctIndex.
          expect(question.options[question.correctIndex]).toEqual({ signId: target.id, text: expected });
          expect(question.options.filter((o) => foldText(o.text) === foldText(expected))).toHaveLength(1);

          // No duplicate options, by text or by sign.
          expect(new Set(question.options.map((o) => foldText(o.text))).size).toBe(4);
          expect(new Set(question.options.map((o) => o.signId)).size).toBe(4);

          expect(isCorrect(question, question.correctIndex)).toBe(true);
          expect(isCorrect(question, (question.correctIndex + 1) % 4)).toBe(false);
        }
      }
    });
  }

  it("draws targets only from the chosen category", () => {
    const targets = SIGNS.filter((s) => s.category === "questions");
    const questions = generateQuiz(SIGNS, { direction: "en-hi", count: 20, rng: createRng(3), targets });
    expect(questions).toHaveLength(8);
    expect(questions.every((q) => mustGet(q.signId).category === "questions")).toBe(true);
  });

  it("prefers distractors from the same category", () => {
    const question = generateQuestion(mustGet("isl-family-mother"), quizPool(SIGNS), "en-hi", createRng(5));
    expect(question?.options.every((o) => mustGet(o.signId).category === "family")).toBe(true);
  });

  it("does not put the correct answer in the same position every time", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const [question] = generateQuiz(SIGNS, { direction: "en-hi", count: 1, rng: createRng(seed) });
      positions.add(question.correctIndex);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("generateQuestion with awkward pools", () => {
  it("never offers two options with the same text", () => {
    const target = item("t", "Hello", "नमस्ते");
    const pool = [target, item("a", "Namaste", "नमस्ते"), item("b", "Water", "पानी"), item("c", "Aqua", "पानी")];
    const question = generateQuestion(target, pool, "en-hi", createRng(1));
    const texts = question?.options.map((o) => o.text) ?? [];
    expect(texts).toHaveLength(2);
    expect(new Set(texts).size).toBe(2);
    expect(texts.filter((text) => text === "नमस्ते")).toHaveLength(1);
  });

  it("skips a distractor whose prompt equals the prompt of the target", () => {
    // Asked "नमस्ते", both Hello and Namaste would be right: only the target may appear.
    const target = item("t", "Hello", "नमस्ते");
    const pool = [target, item("a", "Namaste", "नमस्ते"), item("b", "Water", "पानी")];
    const question = generateQuestion(target, pool, "hi-en", createRng(1));
    expect(question?.options.map((o) => o.text).sort()).toEqual(["Hello", "Water"]);
  });

  it("returns null when no distractor exists", () => {
    const target = item("t", "Hello", "नमस्ते");
    expect(generateQuestion(target, [target], "en-hi", createRng(1))).toBeNull();
    expect(generateQuiz([target], { direction: "en-hi", count: 5, rng: createRng(1) })).toEqual([]);
  });
});
