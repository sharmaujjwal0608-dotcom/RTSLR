/**
 * RTSLR transcript store: a pure reducer over a list of tokens with provenance.
 *
 * The transcript is a record of recognised sign LABELS plus whatever the user
 * typed. It is not a translation and this module never reorders, inflects or
 * "fixes" what was recognised.
 *
 * Joining rules
 *  - Letters and digits concatenate with whatever precedes them, so a run of
 *    fingerspelled letters forms one word ("C","A","T" -> "CAT").
 *  - A word or phrase is separated from its neighbours by one space. The space
 *    is a real token (`auto: true`) inserted at commit time, so the text is
 *    always the plain concatenation of the tokens.
 *  - Control classes act: SPACE appends a space, NEWLINE a line break, DELETE
 *    removes the last unit (one token, or one character of typed text).
 *
 * Every function here is pure: time and ids come in through the action/state.
 */

import type { CommitEvent, SignLanguage } from "@/types/recognition";
import {
  vocabulary,
  type ControlAction,
  type OutputLanguage,
  type VocabularyEntry,
  type VocabularyKind,
  type VocabularyRegistry,
} from "./vocabulary";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TokenSource = "recognition" | "manual";
/** "text" is free text typed by the user. */
export type TokenKind = VocabularyKind | "text";

export type TranscriptToken = {
  id: string;
  source: TokenSource;
  kind: TokenKind;
  /** Null for manual tokens and for automatic joining spaces. */
  classId: string | null;
  modelId: string | null;
  signLanguage: SignLanguage | null;
  /**
   * recognition: `CommitEvent.timestamp` (performance.now() of the frame, ms
   * since page load). manual: the `at` value of the action (epoch ms).
   */
  timestamp: number;
  /** Text in English output. */
  en: string;
  /** Text in Hindi output; null = no Hindi mapping (English is shown, flagged). */
  hi: string | null;
  hiReviewed: boolean;
  /** True for a joining space the reducer inserted around a word/phrase. */
  auto?: true;
};

export type TranscriptState = {
  tokens: readonly TranscriptToken[];
  /** Undo stack, oldest first, at most UNDO_LIMIT entries. */
  past: readonly (readonly TranscriptToken[])[];
  nextId: number;
  /** `at` of the last text edit, used to coalesce typing into one undo step. */
  lastEditAt: number | null;
};

export type TranscriptAction =
  | { type: "commit"; event: CommitEvent; entry: VocabularyEntry }
  | { type: "edit"; text: string; language: OutputLanguage; at: number }
  | { type: "control"; control: ControlAction; at: number }
  | { type: "refresh"; registry: VocabularyRegistry }
  | { type: "undo" }
  /** Empties the transcript; can be undone. */
  | { type: "clear" }
  /** Empties the transcript and the undo stack (used when a session is finished). */
  | { type: "reset" };

export const UNDO_LIMIT = 50;
/** Text edits closer together than this share one undo step. */
export const EDIT_COALESCE_MS = 800;

export function createTranscriptState(): TranscriptState {
  return { tokens: [], past: [], nextId: 1, lastEditAt: null };
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

export function tokenText(token: TranscriptToken, language: OutputLanguage): string {
  return language === "hi" ? (token.hi ?? token.en) : token.en;
}

export function isMissingHindi(token: TranscriptToken): boolean {
  return token.hi === null;
}

export function plainText(tokens: readonly TranscriptToken[], language: OutputLanguage): string {
  let out = "";
  for (const token of tokens) out += tokenText(token, language);
  return out;
}

export type TranscriptSegment = {
  tokenId: string;
  text: string;
  /** UTF-16 offsets into `plainText(tokens, language)`. */
  start: number;
  end: number;
  source: TokenSource;
  kind: TokenKind;
  /** Hindi output only: the English label is shown because no mapping exists. */
  missingHindi: boolean;
  /** Hindi output only: a Hindi gloss is shown that no native reader reviewed. */
  unreviewedHindi: boolean;
};

export function renderSegments(
  tokens: readonly TranscriptToken[],
  language: OutputLanguage,
): TranscriptSegment[] {
  let offset = 0;
  return tokens.map((token) => {
    const text = tokenText(token, language);
    const start = offset;
    offset += text.length;
    return {
      tokenId: token.id,
      text,
      start,
      end: offset,
      source: token.source,
      kind: token.kind,
      missingHindi: language === "hi" && token.hi === null,
      unreviewedHindi: language === "hi" && token.hi !== null && !token.hiReviewed,
    };
  });
}

/** Recognition tokens that have no Hindi mapping. */
export function missingHindiTokens(tokens: readonly TranscriptToken[]): TranscriptToken[] {
  return tokens.filter((t) => t.source === "recognition" && t.hi === null);
}

type SegmenterLike = { segment(input: string): Iterable<{ segment: string }> };
type SegmenterCtor = new (locale?: string, options?: { granularity: "grapheme" }) => SegmenterLike;

function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Segmenter) {
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** User-perceived characters (a Devanagari syllable such as "कि" counts once
 *  where Intl.Segmenter exists; code points otherwise). */
export function countCharacters(text: string): number {
  return graphemes(text).length;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function canUndo(state: TranscriptState): boolean {
  return state.past.length > 0;
}

/* ------------------------------------------------------------------ */
/* Reducer internals                                                   */
/* ------------------------------------------------------------------ */

const endsWithSpace = (text: string) => text === "" || /\s$/.test(text);
const isWordish = (token: TranscriptToken | undefined) =>
  token !== undefined && (token.kind === "word" || token.kind === "phrase");

function pushPast(state: TranscriptState): TranscriptState["past"] {
  const past = [...state.past, state.tokens];
  return past.length > UNDO_LIMIT ? past.slice(past.length - UNDO_LIMIT) : past;
}

/** Commits `tokens` as the new list with one undo step. */
function withTokens(state: TranscriptState, tokens: TranscriptToken[], nextId: number): TranscriptState {
  return { tokens, past: pushPast(state), nextId, lastEditAt: null };
}

function manualText(id: string, text: string, at: number): TranscriptToken {
  return {
    id,
    source: "manual",
    kind: "text",
    classId: null,
    modelId: null,
    signLanguage: null,
    timestamp: at,
    en: text,
    hi: text,
    hiReviewed: true,
  };
}

function removeLastUnit(tokens: readonly TranscriptToken[]): TranscriptToken[] {
  const next = [...tokens];
  const last = next[next.length - 1];
  if (!last) return next;
  if (last.kind === "text") {
    const rest = graphemes(last.en).slice(0, -1).join("");
    if (rest === "") next.pop();
    else next[next.length - 1] = { ...last, en: rest, hi: rest };
  } else {
    next.pop();
  }
  // A joining space has no meaning once the word it joined is gone.
  while (next.length > 0 && next[next.length - 1].auto) next.pop();
  return next;
}

type Origin = Pick<TranscriptToken, "source" | "classId" | "modelId" | "signLanguage" | "timestamp">;

function applyControl(state: TranscriptState, control: ControlAction, origin: Origin): TranscriptState {
  const { tokens } = state;
  if (tokens.length === 0) return state;
  if (control === "delete") return withTokens(state, removeLastUnit(tokens), state.nextId);
  // Collapse repeated spaces: a held SPACE sign must not pad the transcript.
  if (control === "space" && endsWithSpace(plainText(tokens, "en"))) return state;
  const text = control === "space" ? " " : "\n";
  const token: TranscriptToken = {
    id: `t${state.nextId}`,
    ...origin,
    kind: "control",
    en: text,
    hi: text,
    hiReviewed: true,
  };
  return withTokens(state, [...tokens, token], state.nextId + 1);
}

function applyCommitAction(state: TranscriptState, event: CommitEvent, entry: VocabularyEntry): TranscriptState {
  const origin: Origin = {
    source: "recognition",
    classId: event.classId,
    modelId: event.modelId,
    signLanguage: event.signLanguage,
    timestamp: event.timestamp,
  };
  if (entry.kind === "control") {
    return entry.control ? applyControl(state, entry.control, origin) : state;
  }
  if (entry.en === "") return state;

  const tokens = [...state.tokens];
  let nextId = state.nextId;
  const last = tokens[tokens.length - 1];
  const wordish = entry.kind === "word" || entry.kind === "phrase";
  const needsJoin =
    last !== undefined && !endsWithSpace(tokenText(last, "en")) && (wordish || isWordish(last));
  if (needsJoin) {
    tokens.push({
      id: `t${nextId++}`,
      ...origin,
      classId: null,
      kind: "control",
      en: " ",
      hi: " ",
      hiReviewed: true,
      auto: true,
    });
  }
  tokens.push({
    id: `t${nextId++}`,
    ...origin,
    kind: entry.kind,
    en: entry.en,
    hi: entry.hi,
    hiReviewed: entry.hiReviewed,
  });
  return withTokens(state, tokens, nextId);
}

/**
 * Replaces the text of the transcript as shown in `language` with `text`,
 * keeping every token that lies wholly inside the unchanged prefix or the
 * unchanged suffix. Only the changed middle becomes manual text, so typing or
 * deleting at the end never touches the provenance of earlier tokens.
 */
function applyEdit(state: TranscriptState, text: string, language: OutputLanguage, at: number): TranscriptState {
  const old = plainText(state.tokens, language);
  if (text === old) return state;

  const max = Math.min(old.length, text.length);
  let prefix = 0;
  while (prefix < max && old.charCodeAt(prefix) === text.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  while (
    suffix < max - prefix &&
    old.charCodeAt(old.length - 1 - suffix) === text.charCodeAt(text.length - 1 - suffix)
  ) {
    suffix++;
  }

  const segments = renderSegments(state.tokens, language);
  let head = 0; // tokens [0, head) are kept
  while (head < segments.length && segments[head].end <= prefix) head++;
  let tail = segments.length; // tokens [tail, n) are kept
  while (tail > head && segments[tail - 1].start >= old.length - suffix) tail--;

  const headEnd = head > 0 ? segments[head - 1].end : 0;
  const tailLength = tail < segments.length ? old.length - segments[tail].start : 0;
  const middle = text.slice(headEnd, text.length - tailLength);

  let nextId = state.nextId;
  const tokens: TranscriptToken[] = state.tokens.slice(0, head);
  if (middle !== "") {
    const before = tokens[tokens.length - 1];
    if (before && before.kind === "text") {
      // Keep typing in the same manual token instead of growing the list.
      const merged = before.en + middle;
      tokens[tokens.length - 1] = { ...before, en: merged, hi: merged, timestamp: at };
    } else {
      tokens.push(manualText(`t${nextId++}`, middle, at));
    }
  }
  for (const token of state.tokens.slice(tail)) {
    const before = tokens[tokens.length - 1];
    if (before && before.kind === "text" && token.kind === "text") {
      const merged = before.en + token.en;
      tokens[tokens.length - 1] = { ...before, en: merged, hi: merged };
    } else {
      tokens.push(token);
    }
  }

  const coalesce =
    state.lastEditAt !== null && at >= state.lastEditAt && at - state.lastEditAt <= EDIT_COALESCE_MS;
  return {
    tokens,
    past: coalesce ? state.past : pushPast(state),
    nextId,
    lastEditAt: at,
  };
}

function applyRefresh(state: TranscriptState, registry: VocabularyRegistry): TranscriptState {
  let changed = false;
  const tokens = state.tokens.map((token) => {
    if (token.source !== "recognition" || token.classId === null || token.signLanguage === null) return token;
    if (token.kind !== "word" && token.kind !== "phrase") return token;
    const entry = registry.resolve({
      classId: token.classId,
      label: token.en,
      signLanguage: token.signLanguage,
    });
    if (entry.hi === token.hi && entry.hiReviewed === token.hiReviewed) return token;
    changed = true;
    return { ...token, hi: entry.hi, hiReviewed: entry.hiReviewed };
  });
  // Not an undo step: the user did not change the transcript.
  return changed ? { ...state, tokens } : state;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function transcriptReducer(state: TranscriptState, action: TranscriptAction): TranscriptState {
  switch (action.type) {
    case "commit":
      return applyCommitAction(state, action.event, action.entry);
    case "edit":
      return applyEdit(state, action.text, action.language, action.at);
    case "control":
      return applyControl(state, action.control, {
        source: "manual",
        classId: null,
        modelId: null,
        signLanguage: null,
        timestamp: action.at,
      });
    case "refresh":
      return applyRefresh(state, action.registry);
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        tokens: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        nextId: state.nextId,
        lastEditAt: null,
      };
    }
    case "clear":
      return state.tokens.length === 0 ? state : withTokens(state, [], state.nextId);
    case "reset":
      return { tokens: [], past: [], nextId: state.nextId, lastEditAt: null };
  }
}

/**
 * Applies one stabilised recognition commit. The class is resolved through the
 * vocabulary registry; an unknown class keeps the model's own English label and
 * gets `hi: null`.
 */
export function applyCommit(
  state: TranscriptState,
  event: CommitEvent,
  registry: VocabularyRegistry = vocabulary,
): TranscriptState {
  return transcriptReducer(state, { type: "commit", event, entry: registry.resolve(event) });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export const SESSION_SCHEMA = "rtslr-transcript-session-1";

/** A finished (or snapshotted) transcript. */
export type TranscriptSession = {
  schema: typeof SESSION_SCHEMA;
  id: string;
  /** Epoch milliseconds. */
  startedAt: number;
  endedAt: number;
  /** Output language selected when the session was finished. */
  outputLanguage: OutputLanguage;
  text: { en: string; hi: string };
  tokens: TranscriptToken[];
  /** Distinct models that contributed recognition tokens, in first-use order. */
  modelIds: string[];
  signLanguages: SignLanguage[];
  /** Distinct class ids shown in English inside the Hindi text. */
  missingHindiClassIds: string[];
};

export function createSession(
  tokens: readonly TranscriptToken[],
  meta: { id: string; startedAt: number; endedAt: number; outputLanguage: OutputLanguage },
): TranscriptSession {
  const modelIds = new Set<string>();
  const signLanguages = new Set<SignLanguage>();
  const missing = new Set<string>();
  for (const token of tokens) {
    if (token.source !== "recognition") continue;
    if (token.modelId !== null) modelIds.add(token.modelId);
    if (token.signLanguage !== null) signLanguages.add(token.signLanguage);
    if (token.hi === null && token.classId !== null) missing.add(token.classId);
  }
  return {
    schema: SESSION_SCHEMA,
    id: meta.id,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    outputLanguage: meta.outputLanguage,
    text: { en: plainText(tokens, "en"), hi: plainText(tokens, "hi") },
    tokens: tokens.map((t) => ({ ...t })),
    modelIds: [...modelIds],
    signLanguages: [...signLanguages],
    missingHindiClassIds: [...missing],
  };
}
