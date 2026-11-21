import { describe, expect, it } from "vitest";
import type { CommitEvent, SignLanguage } from "../../types/recognition";
import {
  EDIT_COALESCE_MS,
  UNDO_LIMIT,
  applyCommit,
  canUndo,
  countCharacters,
  countWords,
  createSession,
  createTranscriptState,
  missingHindiTokens,
  plainText,
  renderSegments,
  transcriptReducer,
  type TranscriptState,
} from "./transcript";
import { createVocabularyRegistry } from "./vocabulary";

let clock = 0;
function commit(label: string, signLanguage: SignLanguage = "ISL", classId = label): CommitEvent {
  clock += 100;
  return { classId, label, modelId: `model-${signLanguage.toLowerCase()}`, signLanguage, timestamp: clock };
}

function signs(labels: string[], start: TranscriptState = createTranscriptState()): TranscriptState {
  return labels.reduce((state, label) => applyCommit(state, commit(label)), start);
}

const en = (s: TranscriptState) => plainText(s.tokens, "en");
const hi = (s: TranscriptState) => plainText(s.tokens, "hi");
const edit = (s: TranscriptState, text: string, at = 1_000_000, language: "en" | "hi" = "en") =>
  transcriptReducer(s, { type: "edit", text, language, at });

describe("joining rules", () => {
  it("concatenates letters and digits into one word", () => {
    const state = signs(["C", "A", "T", "9"]);
    expect(en(state)).toBe("CAT9");
    expect(state.tokens).toHaveLength(4);
    expect(state.tokens[0]).toMatchObject({
      source: "recognition",
      kind: "letter",
      classId: "C",
      modelId: "model-isl",
      signLanguage: "ISL",
    });
  });

  it("separates words and phrases from their neighbours with one space", () => {
    expect(en(signs(["HELLO", "THANK_YOU"]))).toBe("HELLO THANK YOU");
    expect(en(signs(["A", "B", "HELLO", "C", "D"]))).toBe("AB HELLO CD");
  });

  it("marks joining spaces as automatic tokens without a class id", () => {
    const state = signs(["HELLO", "WATER"]);
    expect(state.tokens.map((t) => t.kind)).toEqual(["word", "control", "word"]);
    expect(state.tokens[1]).toMatchObject({ auto: true, classId: null, en: " ", source: "recognition" });
  });

  it("applies the SPACE control and does not stack spaces", () => {
    let state = signs(["H", "I", "SPACE", "SPACE", "M", "E"]);
    expect(en(state)).toBe("HI ME");
    state = signs(["SPACE", "HELLO"], state);
    expect(en(state)).toBe("HI ME HELLO");
  });

  it("ignores SPACE, NEWLINE and DELETE on an empty transcript", () => {
    const empty = createTranscriptState();
    expect(signs(["SPACE"], empty)).toBe(empty);
    expect(signs(["NEWLINE"], empty)).toBe(empty);
    expect(signs(["DELETE"], empty)).toBe(empty);
  });

  it("applies NEWLINE and does not add a joining space after it", () => {
    expect(en(signs(["HELLO", "NEWLINE", "WATER"]))).toBe("HELLO\nWATER");
  });

  it("DELETE removes the last token and the joining space it leaves behind", () => {
    expect(en(signs(["C", "A", "T", "DELETE"]))).toBe("CA");
    const state = signs(["HELLO", "WATER", "DELETE"]);
    expect(en(state)).toBe("HELLO");
    expect(state.tokens).toHaveLength(1);
    expect(en(signs(["HELLO", "A", "DELETE"]))).toBe("HELLO");
  });

  it("DELETE removes one typed character at a time", () => {
    let state = edit(signs(["A"]), "Aबकि");
    state = signs(["DELETE"], state);
    // "कि" is one user-perceived character (consonant + vowel sign).
    expect(en(state)).toBe("Aब");
    expect(state.tokens[0]).toMatchObject({ source: "recognition", classId: "A" });
  });

  it("resolves the legacy ASL prototype's classes by label", () => {
    let state = applyCommit(createTranscriptState(), commit("H", "ASL", "legacy-h"));
    state = applyCommit(state, commit("I", "ASL", "legacy-i"));
    expect(en(state)).toBe("HI");
    expect(state.tokens[0]).toMatchObject({ classId: "legacy-h", signLanguage: "ASL", kind: "letter" });
  });
});

describe("Hindi output", () => {
  it("uses the mapped gloss and keeps fingerspelling Latin", () => {
    const state = signs(["HELLO", "R", "A", "M"]);
    expect(en(state)).toBe("HELLO RAM");
    expect(hi(state)).toBe("नमस्ते RAM");
    // The fingerspelled letters are not transliterated into Devanagari.
    expect(state.tokens.slice(2).map((t) => t.hi)).toEqual(["R", "A", "M"]);
  });

  it("falls back to the English label and flags it when no mapping exists", () => {
    let state = signs(["HELLO"]);
    state = applyCommit(state, commit("Chai", "ISL", "user-chai"));
    expect(hi(state)).toBe("नमस्ते Chai");
    const flagged = missingHindiTokens(state.tokens);
    expect(flagged.map((t) => t.classId)).toEqual(["user-chai"]);
    const segments = renderSegments(state.tokens, "hi");
    expect(segments.map((s) => s.missingHindi)).toEqual([false, false, true]);
    expect(segments.map((s) => s.unreviewedHindi)).toEqual([true, false, false]);
    expect(renderSegments(state.tokens, "en").some((s) => s.missingHindi || s.unreviewedHindi)).toBe(false);
    expect(segments[2]).toMatchObject({ text: "Chai", start: 7, end: 11 });
  });

  it("does not offer Hindi for a word class of an ASL model", () => {
    const state = applyCommit(createTranscriptState(), commit("HELLO", "ASL"));
    expect(hi(state)).toBe("HELLO");
    expect(missingHindiTokens(state.tokens)).toHaveLength(1);
  });

  it("picks up a gloss the user adds later, without an undo step", () => {
    const registry = createVocabularyRegistry();
    registry.registerCustomClass({ classId: "user-chai", label: "Chai", signLanguage: "ISL" });
    let state = applyCommit(createTranscriptState(), commit("Chai", "ISL", "user-chai"), registry);
    expect(hi(state)).toBe("Chai");
    registry.setHindiGloss("user-chai", "ISL", "चाय");
    const before = state.past.length;
    state = transcriptReducer(state, { type: "refresh", registry });
    expect(hi(state)).toBe("चाय");
    expect(en(state)).toBe("Chai");
    expect(state.tokens[0].hiReviewed).toBe(false);
    expect(state.past.length).toBe(before);
    expect(transcriptReducer(state, { type: "refresh", registry })).toBe(state);
  });
});

describe("manual edits", () => {
  it("keeps the provenance of earlier tokens when text is appended", () => {
    let state = signs(["C", "A", "T"]);
    state = edit(state, "CATs");
    state = edit(state, "CATs!");
    expect(en(state)).toBe("CATs!");
    expect(state.tokens.map((t) => [t.source, t.en])).toEqual([
      ["recognition", "C"],
      ["recognition", "A"],
      ["recognition", "T"],
      ["manual", "s!"],
    ]);
    expect(state.tokens[3]).toMatchObject({ kind: "text", classId: null, modelId: null, hi: "s!" });
  });

  it("keeps the provenance of the rest when text is deleted at the end", () => {
    let state = signs(["HELLO", "C", "A", "T"]);
    state = edit(state, "HELLO CA");
    expect(state.tokens.map((t) => t.en)).toEqual(["HELLO", " ", "C", "A"]);
    expect(state.tokens.every((t) => t.source === "recognition")).toBe(true);
    expect(hi(state)).toBe("नमस्ते CA");
  });

  it("turns only the changed span into manual text for an edit in the middle", () => {
    let state = signs(["HELLO", "WATER", "HOME"]);
    state = edit(state, "HELLO WAITER HOME");
    expect(state.tokens.map((t) => [t.source, t.en])).toEqual([
      ["recognition", "HELLO"],
      ["recognition", " "],
      ["manual", "WAITER"],
      ["recognition", " "],
      ["recognition", "HOME"],
    ]);
    expect(hi(state)).toBe("नमस्ते WAITER घर");
  });

  it("collapses to manual text when everything is replaced", () => {
    const state = edit(signs(["C", "A", "T"]), "dog");
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]).toMatchObject({ source: "manual", kind: "text", en: "dog" });
  });

  it("always reproduces exactly the text that was typed", () => {
    const start = signs(["HELLO", "A", "B", "SPACE", "WATER"]);
    for (const text of ["", "HELLO", "HELLOAB WATER", "xHELLO AB WATERx", "HELLO  AB WATER", "HELLO AB\nWATER", "AB"]) {
      expect(en(edit(start, text))).toBe(text);
    }
  });

  it("edits the Hindi view against the Hindi text", () => {
    let state = signs(["HELLO", "WATER"]);
    state = edit(state, "नमस्ते पानी दो", 5, "hi");
    expect(hi(state)).toBe("नमस्ते पानी दो");
    expect(en(state)).toBe("HELLO WATER दो");
    expect(state.tokens.slice(0, 3).every((t) => t.source === "recognition")).toBe(true);
  });

  it("joins a recognised word to typed text with a space, and a letter without", () => {
    let state = edit(createTranscriptState(), "abc");
    state = signs(["D"], state);
    expect(en(state)).toBe("abcD");
    state = signs(["HELLO"], state);
    expect(en(state)).toBe("abcD HELLO");
  });

  it("supports manual space, new line and backspace controls", () => {
    let state = signs(["A"]);
    state = transcriptReducer(state, { type: "control", control: "space", at: 1 });
    state = transcriptReducer(state, { type: "control", control: "space", at: 2 });
    expect(en(state)).toBe("A ");
    expect(state.tokens[1]).toMatchObject({ source: "manual", kind: "control", classId: null });
    state = transcriptReducer(state, { type: "control", control: "newline", at: 3 });
    expect(en(state)).toBe("A \n");
    state = transcriptReducer(state, { type: "control", control: "delete", at: 4 });
    state = transcriptReducer(state, { type: "control", control: "delete", at: 5 });
    expect(en(state)).toBe("A");
  });
});

describe("undo and clear", () => {
  it("undoes commits one at a time", () => {
    let state = signs(["HELLO", "WATER"]);
    expect(canUndo(state)).toBe(true);
    state = transcriptReducer(state, { type: "undo" });
    expect(en(state)).toBe("HELLO");
    state = transcriptReducer(state, { type: "undo" });
    expect(en(state)).toBe("");
    expect(canUndo(state)).toBe(false);
    expect(transcriptReducer(state, { type: "undo" })).toBe(state);
  });

  it("undoes clear but not reset", () => {
    let state = signs(["C", "A", "T"]);
    state = transcriptReducer(state, { type: "clear" });
    expect(en(state)).toBe("");
    state = transcriptReducer(state, { type: "undo" });
    expect(en(state)).toBe("CAT");
    state = transcriptReducer(state, { type: "reset" });
    expect(en(state)).toBe("");
    expect(canUndo(state)).toBe(false);
  });

  it("treats a burst of typing as one undo step and a later edit as another", () => {
    let state = signs(["A"]);
    state = edit(state, "Ab", 1000);
    state = edit(state, "Abc", 1000 + EDIT_COALESCE_MS);
    state = edit(state, "Abcd", 1000 + 3 * EDIT_COALESCE_MS);
    expect(transcriptReducer(state, { type: "undo" }).tokens.map((t) => t.en).join("")).toBe("Abc");
    state = transcriptReducer(transcriptReducer(state, { type: "undo" }), { type: "undo" });
    expect(en(state)).toBe("A");
  });

  it("bounds the undo history", () => {
    let state = createTranscriptState();
    for (let i = 0; i < UNDO_LIMIT + 25; i++) state = applyCommit(state, commit("A"));
    expect(state.past).toHaveLength(UNDO_LIMIT);
    for (let i = 0; i < UNDO_LIMIT + 25; i++) state = transcriptReducer(state, { type: "undo" });
    expect(state.tokens).toHaveLength(25);
  });

  it("never mutates the previous state", () => {
    const before = signs(["HELLO"]);
    const frozen = JSON.stringify(before);
    signs(["WATER", "DELETE"], before);
    edit(before, "x");
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it("gives every token a unique id, also after undo", () => {
    let state = signs(["A", "HELLO"]);
    state = transcriptReducer(state, { type: "undo" });
    state = signs(["B", "WATER"], state);
    const ids = state.tokens.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("derived values", () => {
  it("counts words and user-perceived characters", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  HELLO   CAT\nWATER ")).toBe(3);
    expect(countCharacters("CAT")).toBe(3);
    // "नमस्ते" is 6 code points; a grapheme-aware count is smaller.
    expect(countCharacters("नमस्ते")).toBeLessThanOrEqual(6);
    expect(countCharacters("नमस्ते")).toBeGreaterThan(0);
  });

  it("builds a session with both texts and its provenance summary", () => {
    let state = signs(["HELLO"]);
    state = applyCommit(state, commit("Chai", "ISL", "user-chai"));
    state = applyCommit(state, commit("B", "ASL", "legacy-b"));
    state = edit(state, `${en(state)}!`);
    const session = createSession(state.tokens, { id: "s1", startedAt: 10, endedAt: 20, outputLanguage: "hi" });
    expect(session).toMatchObject({
      schema: "rtslr-transcript-session-1",
      id: "s1",
      text: { en: "HELLO Chai B!", hi: "नमस्ते Chai B!" },
      modelIds: ["model-isl", "model-asl"],
      signLanguages: ["ISL", "ASL"],
      missingHindiClassIds: ["user-chai"],
    });
    expect(session.tokens).not.toBe(state.tokens);
    expect(session.tokens).toEqual(state.tokens);
  });
});
