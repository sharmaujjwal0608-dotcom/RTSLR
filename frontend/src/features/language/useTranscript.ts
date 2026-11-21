"use client";

/**
 * React binding for the transcript.
 *
 *   const transcript = useTranscript();
 *   // recognition:  stabiliser.onCommit = transcript.onCommit
 *   // editing:      <textarea {...transcript.textareaProps} />
 *
 * The live transcript lives in this component's memory and is gone on unmount.
 * Finished sessions go to the shared history store, which is memory-only unless
 * the user turned on "keep history".
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import type { CommitEvent } from "@/types/recognition";
import {
  transcriptHistory,
  type HistoryStorageError,
  type HistoryStore,
} from "./sessionHistory";
import {
  canUndo as selectCanUndo,
  countCharacters,
  countWords,
  createSession,
  createTranscriptState,
  missingHindiTokens,
  plainText,
  renderSegments,
  transcriptReducer,
  type TranscriptSegment,
  type TranscriptSession,
  type TranscriptToken,
} from "./transcript";
import { vocabulary, type OutputLanguage, type VocabularyRegistry } from "./vocabulary";

export { TRANSCRIPT_STORAGE_KEYS } from "./sessionHistory";

export type UseTranscriptOptions = {
  /** Defaults to the shared vocabulary registry. */
  registry?: VocabularyRegistry;
  /** Defaults to the shared history store. */
  history?: HistoryStore;
  /** Epoch-millisecond clock; defaults to Date.now. */
  now?: () => number;
};

export type TranscriptTextareaProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  lang: OutputLanguage;
  dir: "ltr";
};

export type UseTranscriptResult = {
  /* ---- output ---- */
  outputLanguage: OutputLanguage;
  /** Changes the OUTPUT language only (the interface language is `@/i18n`). */
  setOutputLanguage: (language: OutputLanguage) => void;
  tokens: readonly TranscriptToken[];
  /** Transcript text in the current output language. */
  text: string;
  textByLanguage: Readonly<Record<OutputLanguage, string>>;
  /** Per-token pieces of `text`, with the Hindi flags, for highlighted display. */
  segments: readonly TranscriptSegment[];
  /** Recognised tokens with no Hindi mapping (shown in English in Hindi output). */
  missingHindi: readonly TranscriptToken[];
  /** True when the Hindi output currently shows at least one English label. */
  showsMissingHindi: boolean;
  /** True when the Hindi output shows a gloss no native reader has reviewed. */
  showsUnreviewedHindi: boolean;
  characterCount: number;
  wordCount: number;
  isEmpty: boolean;

  /* ---- recognition ---- */
  /** Plug into the stabiliser's commit callback. Stable identity. */
  onCommit: (event: CommitEvent) => void;

  /* ---- editing ---- */
  /** Two-way binding. Appends and deletions at the end keep the provenance of
   *  every earlier token; an edit elsewhere turns only the changed span into
   *  manual text. */
  setText: (text: string) => void;
  textareaProps: TranscriptTextareaProps;
  insertSpace: () => void;
  insertNewLine: () => void;
  /** Removes the last unit: one recognised token or one typed character. */
  backspace: () => void;
  canUndo: boolean;
  undo: () => void;
  /** Empties the transcript (can be undone). */
  clear: () => void;

  /* ---- sessions ---- */
  /** Snapshot of the live transcript for export/copy; null when empty. */
  currentSession: () => TranscriptSession | null;
  /** Moves the live transcript into history and starts a new one. Returns the
   *  finished session, or null when the transcript was empty. */
  finishSession: () => TranscriptSession | null;
  /** Finished sessions, newest first. */
  history: readonly TranscriptSession[];
  /** False by default: history is kept in memory only. */
  keepHistory: boolean;
  /** true: persist history to localStorage. false: delete the stored copy. */
  setKeepHistory: (keep: boolean) => void;
  deleteSession: (id: string) => void;
  /** Deletes every session from memory and from storage. */
  deleteAllSessions: () => void;
  historyStorageError: HistoryStorageError | null;
};

let fallbackId = 0;
function newSessionId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  fallbackId += 1;
  return `session-${Date.now().toString(36)}-${fallbackId}`;
}

export function useTranscript(options: UseTranscriptOptions = {}): UseTranscriptResult {
  const [registry] = useState(() => options.registry ?? vocabulary);
  const [store] = useState(() => options.history ?? transcriptHistory);
  const [now] = useState(() => options.now ?? Date.now);

  const [state, dispatch] = useReducer(transcriptReducer, undefined, createTranscriptState);
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const outputLanguage = settings.outputLanguage;

  /** Epoch ms of the first change to the live transcript. */
  const startedAt = useRef<number | null>(null);
  const touch = useCallback(() => {
    const at = now();
    if (startedAt.current === null) startedAt.current = at;
    return at;
  }, [now]);

  // A Hindi gloss added to a custom class later updates tokens already shown.
  useEffect(
    () => registry.subscribe(() => dispatch({ type: "refresh", registry })),
    [registry],
  );

  const onCommit = useCallback(
    (event: CommitEvent) => {
      touch();
      dispatch({ type: "commit", event, entry: registry.resolve(event) });
    },
    [registry, touch],
  );

  const setText = useCallback(
    (text: string) => dispatch({ type: "edit", text, language: outputLanguage, at: touch() }),
    [outputLanguage, touch],
  );
  const insertSpace = useCallback(() => dispatch({ type: "control", control: "space", at: touch() }), [touch]);
  const insertNewLine = useCallback(() => dispatch({ type: "control", control: "newline", at: touch() }), [touch]);
  const backspace = useCallback(() => dispatch({ type: "control", control: "delete", at: touch() }), [touch]);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const { tokens } = state;
  const derived = useMemo(() => {
    const textByLanguage = { en: plainText(tokens, "en"), hi: plainText(tokens, "hi") };
    const text = textByLanguage[outputLanguage];
    const segments = renderSegments(tokens, outputLanguage);
    return {
      textByLanguage,
      text,
      segments,
      missingHindi: missingHindiTokens(tokens),
      showsMissingHindi: segments.some((s) => s.missingHindi),
      showsUnreviewedHindi: segments.some((s) => s.unreviewedHindi),
      characterCount: countCharacters(text),
      wordCount: countWords(text),
    };
  }, [tokens, outputLanguage]);

  const currentSession = useCallback((): TranscriptSession | null => {
    if (tokens.length === 0) return null;
    const endedAt = now();
    return createSession(tokens, {
      id: newSessionId(),
      startedAt: startedAt.current ?? endedAt,
      endedAt,
      outputLanguage,
    });
  }, [tokens, outputLanguage, now]);

  const finishSession = useCallback((): TranscriptSession | null => {
    const session = currentSession();
    if (!session) return null;
    store.add(session);
    startedAt.current = null;
    dispatch({ type: "reset" });
    return session;
  }, [currentSession, store]);

  const textareaProps = useMemo<TranscriptTextareaProps>(
    () => ({
      value: derived.text,
      onChange: (event) => setText(event.target.value),
      lang: outputLanguage,
      dir: "ltr",
    }),
    [derived.text, outputLanguage, setText],
  );

  return {
    outputLanguage,
    setOutputLanguage: store.setOutputLanguage,
    tokens,
    ...derived,
    isEmpty: tokens.length === 0,
    onCommit,
    setText,
    textareaProps,
    insertSpace,
    insertNewLine,
    backspace,
    canUndo: selectCanUndo(state),
    undo,
    clear,
    currentSession,
    finishSession,
    history: settings.sessions,
    keepHistory: settings.keepHistory,
    setKeepHistory: store.setKeepHistory,
    deleteSession: store.remove,
    deleteAllSessions: store.removeAll,
    historyStorageError: settings.storageError,
  };
}
