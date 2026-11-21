# AGENT 10 Report

## AGENT

Agent 10 - Language and Speech Engineer

## ASSIGNED TASK

Build the text and speech layer of the recognition studio: turn committed sign labels into an editable English/Hindi transcript with speech, copy and export, without presenting any of it as translation of sign language.

## OWNED FILES

- `frontend/src/features/language/**`
- `docs/agent-reports/AGENT_10.md`

## DEPENDENCIES

- `frontend/src/types/recognition.ts` (`CommitEvent`, `SignLanguage`) - type imports only.
- `frontend/src/i18n/index.tsx` (`defineMessages`) - imported by `messages.ts`; not modified.
- `frontend/vitest.config.ts` (Agent 05) - used as is.
- `docs/SECURITY_PRIVACY.md` - CAM-18, FE-06, section 8 (LOC-01, LOC-04, LOC-09, transcript history row), MOD-10/MOD-12.
- No new packages.

## IMPLEMENTED FEATURES

- `vocabulary.ts`: typed `VocabularyEntry`, registry with lookup by class id and sign language (case/separator-insensitive, aliases), built-ins for A-Z, 0-9 and SPACE/DELETE/NEWLINE (ASL and ISL), 39 starter word/phrase glosses for ISL (all `hiReviewed: false`), runtime custom classes with `hi: null` unless the user types a gloss, `resolve()` that falls back from class id to model label to an inferred entry.
- `transcript.ts`: pure reducer with token provenance, joining rules (letters concatenate, words/phrases get one joining space as an explicit `auto` token, control tokens act), prefix/suffix-preserving manual edits, bounded undo (50 steps, typing coalesced), clear/reset, gloss refresh, per-language text, segments with `missingHindi`/`unreviewedHindi` flags, counts, `applyCommit(state, event)`, `createSession`.
- `sessionHistory.ts`: history + settings store (memory by default; `localStorage` only after opt-in; 50 entries / 30 days; delete-one, delete-all; validation of stored data; `storageError` states), exported `TRANSCRIPT_STORAGE_KEYS`.
- `useTranscript.ts`: hook with output language, `onCommit`, textarea binding, manual controls, undo/clear, counts, `currentSession`/`finishSession`, history API.
- `speech.ts` + `useSpeech.ts`: feature detection, async voice loading (`voiceschanged`), local-first voice selection for `en-IN`/`en-*` and `hi-IN`, `network`/`networkOnly` flags, a consent gate that refuses network voices until accepted, speak/pause/resume/stop, rate, state `idle|speaking|paused|unsupported`, cancel on unmount, script-based routing (Devanagari to the Hindi voice, Latin to the English voice), fingerspelled words spoken as words and isolated letters as letters.
- `exporter.ts`: `.txt` and `.json` export through a Blob download with the honesty note, per-token provenance and model ids; `copyText()` that reports success only when `clipboard.writeText` resolved (no `execCommand` fallback).
- `messages.ts`: 94 English/Hindi interface keys for the transcript panel, `outputLanguageNames`, `formatMessage`.
- `README.md`: public API and the language principles, including the rule that Latin fingerspelling is not transliterated into Devanagari.

## FILES CREATED OR MODIFIED

Created (all under `frontend/src/features/language/`):

- `vocabulary.ts`, `transcript.ts`, `sessionHistory.ts`, `useTranscript.ts`, `speech.ts`, `useSpeech.ts`, `exporter.ts`, `messages.ts`, `index.ts`, `README.md`
- `vocabulary.test.ts`, `transcript.test.ts`, `sessionHistory.test.ts`, `speech.test.ts`, `exporter.test.ts`, `hooks.test.ts`

Created: `docs/agent-reports/AGENT_10.md`. No file outside the owned paths was modified.

## TESTS RUN

From `frontend/`:

1. `npx vitest run src/features/language`
2. `npx tsc --noEmit -p .` (looked only at errors under `src/features/language`)
3. `npx eslint src/features/language`

Not run: `next build`, `next dev`, Playwright, any real browser. Speech was exercised only against a mocked `speechSynthesis`; no real voice was ever used. Download and clipboard were exercised only in jsdom with mocks.

## TEST RESULTS

1. Vitest 5.1.1: `Test Files 6 passed (6)`, `Tests 116 passed (116)`. First run had 2 failures (one wrong test assertion; one real bug: a `DOMException` quota error was classified as "unavailable" because it is not `instanceof Error` in jsdom - fixed in `sessionHistory.ts`). Vitest prints a Vite warning about `vitest.config.ts` being ESM in a CommonJS package; that file is Agent 05's.
2. `tsc`: 0 errors in `src/features/language`. 7 errors elsewhere in the project (other agents' files, not inspected).
3. ESLint: exit code 0, no warnings.

## KNOWN LIMITATIONS

- Every built-in Hindi word gloss and all Hindi interface copy in `messages.ts` were written by a non-native author and are unreviewed. The list with open questions is in the README.
- Class id conventions are not fixed in `docs/MODEL_CONTRACTS.md`. Built-in ids are my choice (`A`, `7`, `SPACE`, `THANK_YOU`); models with other ids still work through the label fallback, but only if `CommitEvent.label` is the letter/word itself.
- History uses `localStorage`; `docs/SECURITY_PRIVACY.md` section 8.1 names IndexedDB for transcript history. Limits and opt-in behaviour follow that section. Turning "keep history" off deletes the stored copy; the in-memory list of the current page stays until deleted or reloaded.
- The custom-class registry is in memory only; nothing here persists a user's Hindi gloss.
- `localService` is taken from the browser as reported. Pause/resume depend on the engine. Chromium's cut-off of long network-voice utterances is not worked around.
- Lower-casing runs of capitals for speech also affects typed acronyms.
- Recognition token timestamps are `performance.now()` values (as given in `CommitEvent`), manual ones are epoch ms; the JSON export says so.
- No UI component is included; Agent 01 renders the panel.

## INTEGRATION NOTES

- Agent 01: import from `@/features/language` (or the individual modules). Call the panel "Transcript of recognised signs" (`panelSubtitle`) and show `notTranslationShort`/`notTranslationBody`. Show the `noHindiMapping` flag for segments with `missingHindi` and `hindiNotReviewed` for `unreviewedHindi`. Do not show information by colour alone. Render speech controls only when `speech.ready`; when `speak()` returns `network_consent_required`, show `networkVoiceWarning` and call `acceptNetworkVoice()` then `speak()` again from the user's click. On `no_voice` show `speechNoVoice`.
- Agents 05/06: pass the stabiliser's `CommitEvent` to `useTranscript().onCommit`. For control gestures use class ids or labels `SPACE`, `DELETE`/`DEL`, `NEWLINE`. For user-recorded classes call `vocabulary.registerCustomClass(...)` on create/load and persist the user's Hindi gloss with the class.
- Agent 12 / storage registry: add `rtslr.transcript.keepHistory`, `rtslr.transcript.history`, `rtslr.transcript.outputLanguage` (exported as `TRANSCRIPT_STORAGE_KEYS`). The delete-all control should also call `transcriptHistory.removeAll()` to empty the in-memory list. Please confirm whether `localStorage` is acceptable for transcript history or IndexedDB is required.
- Proposals for `frontend/src/i18n/index.tsx` (not edited):
  1. Move `formatMessage` (placeholder substitution) into the i18n core so every feature uses the same one.
  2. `I18nProvider` sets `document.documentElement.lang` to the interface locale. Content in another language (the transcript textarea in Hindi output, Hindi glosses inside an English interface) needs its own `lang` attribute; `textareaProps` already sets it, and components that render segments should do the same.
  3. Consider listening to the `storage` event so two open tabs do not disagree on the locale.
  4. Hindi copy across the app should get one native review pass together with this feature's glosses.

## STATUS

TESTED
