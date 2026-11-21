/**
 * Copy and export for transcripts. Everything happens in the browser: files are
 * built in memory and saved through a `blob:` URL; nothing is uploaded.
 *
 * Every export states what the content is: a transcript of recognised signs,
 * not a translation.
 */

import type { TranscriptSession, TranscriptToken } from "./transcript";
import type { OutputLanguage } from "./vocabulary";

export const EXPORT_SCHEMA = "rtslr-transcript-export-1";

/** Fixed English wording written into every exported file. */
export const HONESTY_NOTE =
  "This is a transcript of recognised signs: a sequence of labels produced by an " +
  "experimental recogniser, plus any text typed by the user. It is not a translation " +
  "of sign language, it does not reflect sign-language grammar, and it may contain " +
  "recognition errors. Hindi text appears only where an explicit label mapping exists; " +
  "other labels are left in English. Do not rely on it for medical, legal, emergency " +
  "or other high-stakes communication.";

const LANGUAGE_NAME: Record<OutputLanguage, string> = { en: "English", hi: "Hindi" };

export type ExportOptions = {
  /** Output language of the text; defaults to the session's own. */
  language?: OutputLanguage;
  /** Export time in epoch ms; defaults to Date.now(). */
  exportedAt?: number;
};

export type TextExportOptions = ExportOptions & {
  /** false = only the transcript text, no header. Default true. */
  includeHeader?: boolean;
};

/* ------------------------------------------------------------------ */
/* Formatting (pure)                                                   */
/* ------------------------------------------------------------------ */

const iso = (ms: number) => new Date(ms).toISOString();

export function buildTextExport(session: TranscriptSession, options: TextExportOptions = {}): string {
  const language = options.language ?? session.outputLanguage;
  const text = session.text[language];
  if (options.includeHeader === false) return text;
  const lines = [
    "RTSLR - transcript of recognised signs (not a translation)",
    `Session started: ${iso(session.startedAt)}`,
    `Session ended: ${iso(session.endedAt)}`,
    `Exported: ${iso(options.exportedAt ?? Date.now())}`,
    `Output language: ${LANGUAGE_NAME[language]}`,
    `Recognition model(s): ${session.modelIds.length > 0 ? session.modelIds.join(", ") : "none (typed text only)"}`,
    `Sign language of the model(s): ${session.signLanguages.length > 0 ? session.signLanguages.join(", ") : "n/a"}`,
  ];
  if (language === "hi" && session.missingHindiClassIds.length > 0) {
    lines.push(`No Hindi mapping (shown in English): ${session.missingHindiClassIds.join(", ")}`);
  }
  lines.push("", HONESTY_NOTE, "", "----", "", text, "");
  return lines.join("\n");
}

export type ExportedToken = {
  index: number;
  source: TranscriptToken["source"];
  kind: TranscriptToken["kind"];
  classId: string | null;
  modelId: string | null;
  signLanguage: TranscriptToken["signLanguage"];
  timestamp: number;
  en: string;
  hi: string | null;
  hindiMapping: "mapped_reviewed" | "mapped_unreviewed" | "none" | "not_applicable";
  autoJoin: boolean;
};

export type TranscriptExport = {
  schema: typeof EXPORT_SCHEMA;
  note: string;
  exportedAt: string;
  session: { id: string; startedAt: string; endedAt: string };
  outputLanguage: OutputLanguage;
  modelIds: string[];
  signLanguages: TranscriptSession["signLanguages"];
  text: { en: string; hi: string };
  missingHindiClassIds: string[];
  timestampNote: string;
  tokens: ExportedToken[];
};

function hindiMapping(token: TranscriptToken): ExportedToken["hindiMapping"] {
  if (token.source === "manual" || token.kind === "control") return "not_applicable";
  // Latin letters and digits stay Latin by rule; that is not a Hindi gloss.
  if (token.kind === "letter" || token.kind === "digit") return "not_applicable";
  if (token.hi === null) return "none";
  return token.hiReviewed ? "mapped_reviewed" : "mapped_unreviewed";
}

export function buildJsonExport(session: TranscriptSession, options: ExportOptions = {}): TranscriptExport {
  return {
    schema: EXPORT_SCHEMA,
    note: HONESTY_NOTE,
    exportedAt: iso(options.exportedAt ?? Date.now()),
    session: { id: session.id, startedAt: iso(session.startedAt), endedAt: iso(session.endedAt) },
    outputLanguage: options.language ?? session.outputLanguage,
    modelIds: [...session.modelIds],
    signLanguages: [...session.signLanguages],
    text: { ...session.text },
    missingHindiClassIds: [...session.missingHindiClassIds],
    timestampNote:
      "Token timestamps: for source 'recognition', milliseconds since the page loaded " +
      "(performance.now() of the committed frame); for source 'manual', Unix epoch milliseconds.",
    tokens: session.tokens.map((token, index) => ({
      index,
      source: token.source,
      kind: token.kind,
      classId: token.classId,
      modelId: token.modelId,
      signLanguage: token.signLanguage,
      timestamp: token.timestamp,
      en: token.en,
      hi: token.hi,
      hindiMapping: hindiMapping(token),
      autoJoin: token.auto === true,
    })),
  };
}

/** `rtslr-transcript-YYYYMMDD-HHMMSS.<ext>` in UTC, from the session end time. */
export function exportFilename(session: TranscriptSession, extension: "txt" | "json"): string {
  const stamp = iso(session.endedAt).slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `rtslr-transcript-${stamp}.${extension}`;
}

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

export type DownloadResult = { ok: true; filename: string } | { ok: false; reason: "unsupported" | "failed" };

/** Saves text as a file through a temporary `blob:` URL. Call from a click. */
export function downloadTextFile(filename: string, content: string, mimeType: string): DownloadResult {
  if (
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return { ok: false, reason: "unsupported" };
  }
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, filename };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    // Give the browser a moment to start the download before releasing the blob.
    if (url !== null) {
      const created = url;
      setTimeout(() => URL.revokeObjectURL(created), 1000);
    }
  }
}

export function exportSessionAsText(session: TranscriptSession, options: TextExportOptions = {}): DownloadResult {
  return downloadTextFile(exportFilename(session, "txt"), buildTextExport(session, options), "text/plain");
}

export function exportSessionAsJson(session: TranscriptSession, options: ExportOptions = {}): DownloadResult {
  const body = `${JSON.stringify(buildJsonExport(session, options), null, 2)}\n`;
  return downloadTextFile(exportFilename(session, "json"), body, "application/json");
}

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

export type CopyResult = { ok: true } | { ok: false; reason: "empty" | "unsupported" | "denied" };

/**
 * Writes text to the clipboard (write only, never read; call from a click).
 * Resolves `{ ok: true }` only after the browser confirmed the write (FE-06).
 * There is deliberately no `document.execCommand("copy")` fallback: its result
 * cannot be trusted, which is how the legacy page reported "Copied!" wrongly.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | null | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.clipboard,
): Promise<CopyResult> {
  if (text === "") return { ok: false, reason: "empty" };
  if (!clipboard || typeof clipboard.writeText !== "function") return { ok: false, reason: "unsupported" };
  try {
    await clipboard.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false, reason: "denied" };
  }
}
