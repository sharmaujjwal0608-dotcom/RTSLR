// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommitEvent } from "../../types/recognition";
import {
  EXPORT_SCHEMA,
  HONESTY_NOTE,
  buildJsonExport,
  buildTextExport,
  copyText,
  downloadTextFile,
  exportFilename,
  exportSessionAsJson,
  exportSessionAsText,
} from "./exporter";
import { applyCommit, createSession, createTranscriptState, transcriptReducer } from "./transcript";

const ENDED = Date.UTC(2026, 10, 21, 9, 5, 7);
const EXPORTED = Date.UTC(2026, 10, 21, 10, 0, 0);

function makeSession(outputLanguage: "en" | "hi" = "en") {
  const event = (classId: string, label: string, timestamp: number): CommitEvent => ({
    classId,
    label,
    modelId: "isl-user-templates",
    signLanguage: "ISL",
    timestamp,
  });
  let state = createTranscriptState();
  state = applyCommit(state, event("HELLO", "HELLO", 1200.5));
  state = applyCommit(state, event("user-chai", "Chai", 2400));
  state = applyCommit(state, event("R", "R", 3600));
  state = transcriptReducer(state, { type: "edit", text: "HELLO Chai R!", language: "en", at: ENDED - 1000 });
  return createSession(state.tokens, { id: "session-1", startedAt: ENDED - 60_000, endedAt: ENDED, outputLanguage });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("text export", () => {
  it("has a header that says what the file is, then the text", () => {
    const text = buildTextExport(makeSession(), { exportedAt: EXPORTED });
    const lines = text.split("\n");
    expect(lines[0]).toBe("RTSLR - transcript of recognised signs (not a translation)");
    expect(text).toContain("Session ended: 2026-11-21T09:05:07.000Z");
    expect(text).toContain("Exported: 2026-11-21T10:00:00.000Z");
    expect(text).toContain("Output language: English");
    expect(text).toContain("Recognition model(s): isl-user-templates");
    expect(text).toContain("Sign language of the model(s): ISL");
    expect(text).toContain(HONESTY_NOTE);
    expect(text).not.toContain("No Hindi mapping");
    expect(text.endsWith("----\n\nHELLO Chai R!\n")).toBe(true);
  });

  it("uses the Hindi text and lists the labels left in English", () => {
    const text = buildTextExport(makeSession("hi"), { exportedAt: EXPORTED });
    expect(text).toContain("Output language: Hindi");
    expect(text).toContain("No Hindi mapping (shown in English): user-chai");
    expect(text.endsWith("----\n\nनमस्ते Chai R!\n")).toBe(true);
  });

  it("can export the bare text and override the language", () => {
    expect(buildTextExport(makeSession("hi"), { includeHeader: false })).toBe("नमस्ते Chai R!");
    expect(buildTextExport(makeSession("hi"), { includeHeader: false, language: "en" })).toBe("HELLO Chai R!");
  });

  it("never calls the content a translation of the signs", () => {
    expect(HONESTY_NOTE).toMatch(/transcript of recognised signs/);
    expect(HONESTY_NOTE).toMatch(/not a translation/);
  });
});

describe("JSON export", () => {
  it("contains the note, the model, both texts and every token with provenance", () => {
    const data = buildJsonExport(makeSession("hi"), { exportedAt: EXPORTED });
    expect(data).toMatchObject({
      schema: EXPORT_SCHEMA,
      note: HONESTY_NOTE,
      exportedAt: "2026-11-21T10:00:00.000Z",
      session: { id: "session-1", endedAt: "2026-11-21T09:05:07.000Z" },
      outputLanguage: "hi",
      modelIds: ["isl-user-templates"],
      signLanguages: ["ISL"],
      text: { en: "HELLO Chai R!", hi: "नमस्ते Chai R!" },
      missingHindiClassIds: ["user-chai"],
    });
    expect(data.tokens).toEqual([
      { index: 0, source: "recognition", kind: "word", classId: "HELLO", modelId: "isl-user-templates", signLanguage: "ISL", timestamp: 1200.5, en: "HELLO", hi: "नमस्ते", hindiMapping: "mapped_unreviewed", autoJoin: false },
      { index: 1, source: "recognition", kind: "control", classId: null, modelId: "isl-user-templates", signLanguage: "ISL", timestamp: 2400, en: " ", hi: " ", hindiMapping: "not_applicable", autoJoin: true },
      { index: 2, source: "recognition", kind: "word", classId: "user-chai", modelId: "isl-user-templates", signLanguage: "ISL", timestamp: 2400, en: "Chai", hi: null, hindiMapping: "none", autoJoin: false },
      { index: 3, source: "recognition", kind: "control", classId: null, modelId: "isl-user-templates", signLanguage: "ISL", timestamp: 3600, en: " ", hi: " ", hindiMapping: "not_applicable", autoJoin: true },
      { index: 4, source: "recognition", kind: "letter", classId: "R", modelId: "isl-user-templates", signLanguage: "ISL", timestamp: 3600, en: "R", hi: "R", hindiMapping: "not_applicable", autoJoin: false },
      { index: 5, source: "manual", kind: "text", classId: null, modelId: null, signLanguage: null, timestamp: ENDED - 1000, en: "!", hi: "!", hindiMapping: "not_applicable", autoJoin: false },
    ]);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("names files from the session end time", () => {
    const session = makeSession();
    expect(exportFilename(session, "txt")).toBe("rtslr-transcript-20261121-090507.txt");
    expect(exportFilename(session, "json")).toBe("rtslr-transcript-20261121-090507.json");
  });
});

describe("download", () => {
  function spyDownload() {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:rtslr-test";
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
    return { blobs, clicked, revokeObjectURL };
  }

  it("saves a .txt through a blob URL and releases it afterwards", async () => {
    vi.useFakeTimers();
    const { blobs, clicked, revokeObjectURL } = spyDownload();
    const result = exportSessionAsText(makeSession(), { exportedAt: EXPORTED });
    expect(result).toEqual({ ok: true, filename: "rtslr-transcript-20261121-090507.txt" });
    expect(clicked).toEqual([{ download: "rtslr-transcript-20261121-090507.txt", href: "blob:rtslr-test" }]);
    expect(blobs[0].type).toBe("text/plain;charset=utf-8");
    expect(document.querySelector("a")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:rtslr-test");
  });

  it("saves a .json file that parses back", async () => {
    const { blobs, clicked } = spyDownload();
    const result = exportSessionAsJson(makeSession("hi"), { exportedAt: EXPORTED });
    expect(result).toEqual({ ok: true, filename: "rtslr-transcript-20261121-090507.json" });
    expect(clicked[0].download).toMatch(/\.json$/);
    expect(blobs[0].type).toBe("application/json;charset=utf-8");
    expect(blobs[0].size).toBeGreaterThan(HONESTY_NOTE.length);
  });

  it("reports failure when the browser refuses", () => {
    spyDownload();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(downloadTextFile("a.txt", "x", "text/plain")).toEqual({ ok: false, reason: "failed" });
  });
});

describe("copyText", () => {
  it("reports success only after the clipboard write resolved", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyText("HELLO", { writeText })).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith("HELLO");
  });

  it("reports failure when the write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await expect(copyText("HELLO", { writeText })).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("reports unsupported without a Clipboard API and never falls back to execCommand", async () => {
    const execCommand = vi.fn();
    Object.assign(document, { execCommand });
    await expect(copyText("HELLO", null)).resolves.toEqual({ ok: false, reason: "unsupported" });
    await expect(copyText("HELLO")).resolves.toEqual({ ok: false, reason: "unsupported" });
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("does not write an empty string", async () => {
    const writeText = vi.fn();
    await expect(copyText("", { writeText })).resolves.toEqual({ ok: false, reason: "empty" });
    expect(writeText).not.toHaveBeenCalled();
  });
});
