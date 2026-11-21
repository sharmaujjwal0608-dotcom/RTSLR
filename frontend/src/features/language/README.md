# features/language

The text and speech layer of the recognition studio: committed sign labels become an editable English/Hindi transcript that can be spoken, copied and exported.

Owner: Agent 10. Consumers: the studio UI (Agent 01), recognition (Agents 05/06) through `CommitEvent`.

## Language principles

These are design constraints. Code and copy in this folder must keep them true.

1. **A transcript, never a translation.** Indian Sign Language has its own grammar. What this layer holds is the sequence of labels a recogniser produced, in the order it produced them, plus anything the user typed. The UI calls it a "transcript of recognised signs". No module here reorders, inflects or completes the text.
2. **Fingerspelling is not translation.** A run of recognised letters is joined into a word because that is what the signer spelled, not because anything was translated.
3. **Interface language and output language are separate.** `@/i18n` decides the language of buttons and help text. `useTranscript().outputLanguage` decides the text of the transcript. A Hindi interface is not evidence of ISL-to-Hindi translation, and the two settings are stored under different keys.
4. **Hindi comes only from an explicit mapping.** Hindi text appears only where a `VocabularyEntry` has a `hi` value that a person wrote: either in `vocabulary.ts` or typed by the user for their own class. Nothing generates Hindi at runtime.
5. **No mapping means English, flagged.** When `hi` is `null` the English label is shown in Hindi output and marked "no Hindi mapping" (`TranscriptSegment.missingHindi`, `missingHindi` on the hook, `missingHindiClassIds` in exports).
6. **Latin fingerspelling stays Latin in Hindi mode.** Letters A-Z and digits 0-9 are never transliterated letter by letter into Devanagari: "R", "A", "M" is `RAM` in Hindi output, not `रम` or `आर ए एम`. Letter-by-letter transliteration would invent a Hindi spelling nobody signed.
7. **Unreviewed is said out loud.** Every built-in Hindi word gloss is `hiReviewed: false` until a native Hindi reader familiar with ISL glossing signs it off. The flag is exposed (`unreviewedHindi`) so the UI can show it. A gloss typed by the user is also `hiReviewed: false`.
8. **Speech reads text.** Speech synthesis reads the transcript aloud; it adds no meaning. It prefers on-device voices and will not use a network voice until the user has been warned and accepted.

Built-in word glosses exist for ISL only. The legacy ASL prototype is a fingerspelling demo; a word class from an ASL model gets no Hindi.

## Modules

| File | What it is |
|------|------------|
| `vocabulary.ts` | Class id -> label mapping, built-in entries, runtime registry |
| `transcript.ts` | Pure reducer over tokens with provenance; derived text; sessions |
| `sessionHistory.ts` | Session history + transcript settings store (memory first, opt-in storage) |
| `useTranscript.ts` | React hook over the reducer and the history store |
| `speech.ts` | Web Speech wrapper: voices, selection, text preparation, store |
| `useSpeech.ts` | React hook over the speech store |
| `exporter.ts` | `.txt` / `.json` export and clipboard copy |
| `messages.ts` | English/Hindi interface strings for the transcript panel |
| `index.ts` | Re-exports everything above |

## Public API

### vocabulary

```ts
type OutputLanguage = "en" | "hi";
type VocabularyKind = "letter" | "digit" | "word" | "phrase" | "control";
type ControlAction = "space" | "delete" | "newline";

type VocabularyEntry = {
  classId: string; signLanguage: SignLanguage; kind: VocabularyKind;
  en: string; hi: string | null; hiReviewed: boolean;
  control?: ControlAction;                       // kind === "control" only
  origin: "builtin" | "user" | "inferred";
};

const vocabulary: VocabularyRegistry;            // shared registry
function createVocabularyRegistry(builtins?: readonly VocabularyEntry[]): VocabularyRegistry;

type VocabularyRegistry = {
  get(classId: string, signLanguage: SignLanguage): VocabularyEntry | undefined;
  resolve(ref: { classId: string; label: string; signLanguage: SignLanguage }): VocabularyEntry;
  registerCustomClass(input: {
    classId: string; label: string; signLanguage: SignLanguage;
    kind?: "letter" | "digit" | "word" | "phrase"; hi?: string | null;
  }): VocabularyEntry;                           // throws RangeError on bad label/gloss
  setHindiGloss(classId: string, signLanguage: SignLanguage, hi: string | null): VocabularyEntry | undefined;
  remove(classId: string, signLanguage: SignLanguage): boolean;
  list(signLanguage?: SignLanguage): VocabularyEntry[];
  subscribe(listener: () => void): () => void;
};

function renderGloss(entry, language: OutputLanguage): { text: string; missingHindi: boolean; unreviewedHindi: boolean };
function validateHindiGloss(input: string): { ok: true; value: string } | { ok: false; reason: "empty" | "too_long" };
function listUnreviewedHindi(registry?: VocabularyRegistry): VocabularyEntry[];
function normalizeClassId(value: string): string;
const BUILTIN_ENTRIES: readonly VocabularyEntry[];
const CONTROL_CLASS_IDS: { space: "SPACE"; delete: "DELETE"; newline: "NEWLINE" };
const MAX_LABEL_LENGTH = 64;
```

Lookup is case- and separator-insensitive (`"thank-you"`, `"Thank You"` and `"THANK_YOU"` are the same id). Aliases: `DEL`/`BACKSPACE` -> `DELETE`, `NEW_LINE`/`ENTER` -> `NEWLINE`, `THANKS` -> `THANK_YOU`.

`resolve` never fails: it tries the class id, then the model's label, then builds an `origin: "inferred"` entry from the label with `hi: null` (a single Latin letter or digit keeps its Latin form). This is why the legacy ASL classifier works whatever class ids it uses, as long as its label is the letter.

Built-in class ids: `A`-`Z`, `0`-`9`, `SPACE`, `DELETE`, `NEWLINE` (ASL and ISL); and for ISL only `HELLO`, `NAMASTE`, `GOOD_MORNING`, `GOOD_NIGHT`, `THANK_YOU`, `PLEASE`, `SORRY`, `WELCOME`, `HOW_ARE_YOU`, `YES`, `NO`, `MOTHER`, `FATHER`, `BROTHER`, `SISTER`, `FAMILY`, `FRIEND`, `ONE`-`TEN`, `MONDAY`-`SUNDAY`, `TODAY`, `WATER`, `FOOD`, `HOME`, `HELP`. Presence in this list says nothing about whether any model recognises the sign.

User-recorded classes: call `vocabulary.registerCustomClass({ classId, label, signLanguage })` when the class is created or loaded. `hi` stays `null` until the user types one (`setHindiGloss`). The registry is in memory; whoever persists custom classes (Agent 06) should persist the user's Hindi gloss with them and re-register on load.

### transcript

```ts
type TranscriptToken = {
  id: string;
  source: "recognition" | "manual";
  kind: VocabularyKind | "text";
  classId: string | null; modelId: string | null; signLanguage: SignLanguage | null;
  timestamp: number;        // recognition: CommitEvent.timestamp; manual: epoch ms
  en: string; hi: string | null; hiReviewed: boolean;
  auto?: true;              // joining space inserted by the reducer
};

function createTranscriptState(): TranscriptState;
function transcriptReducer(state: TranscriptState, action: TranscriptAction): TranscriptState;
function applyCommit(state: TranscriptState, event: CommitEvent, registry?: VocabularyRegistry): TranscriptState;

type TranscriptAction =
  | { type: "commit"; event: CommitEvent; entry: VocabularyEntry }
  | { type: "edit"; text: string; language: OutputLanguage; at: number }
  | { type: "control"; control: ControlAction; at: number }
  | { type: "refresh"; registry: VocabularyRegistry }
  | { type: "undo" } | { type: "clear" } | { type: "reset" };

function plainText(tokens, language): string;
function renderSegments(tokens, language): TranscriptSegment[];   // offsets + missingHindi / unreviewedHindi
function missingHindiTokens(tokens): TranscriptToken[];
function countCharacters(text: string): number;                   // grapheme clusters where available
function countWords(text: string): number;
function canUndo(state): boolean;
function createSession(tokens, meta: { id; startedAt; endedAt; outputLanguage }): TranscriptSession;
const UNDO_LIMIT = 50; const EDIT_COALESCE_MS = 800;
```

Joining rules:

- Letters and digits concatenate with what precedes them: `C`,`A`,`T` -> `CAT`.
- A word or phrase is separated from its neighbours by one space: `A`,`B`,`HELLO`,`C` -> `AB HELLO C`. The space is a real token (`auto: true`, `classId: null`), so the text is always the plain concatenation of the tokens.
- `SPACE` appends a space (ignored at the start or after whitespace), `NEWLINE` a line break, `DELETE` removes the last unit (one recognised token, or one typed character) and any joining space left dangling.

Editing: `edit` compares the new text with the current text in the given output language. Tokens wholly inside the unchanged prefix or suffix are kept with their provenance; only the changed span becomes one `source: "manual"` token. Typing or deleting at the end therefore never disturbs earlier tokens; replacing everything collapses to manual text. Manual text is shown as typed in both output languages.

Undo: every commit, control, clear and edit is one step (edits within 800 ms of each other share a step); the stack holds 50 steps. `clear` can be undone; `reset` cannot.

### useTranscript

```ts
function useTranscript(options?: {
  registry?: VocabularyRegistry; history?: HistoryStore; now?: () => number;
}): {
  outputLanguage: OutputLanguage;
  setOutputLanguage(language: OutputLanguage): void;
  tokens: readonly TranscriptToken[];
  text: string;
  textByLanguage: { en: string; hi: string };
  segments: readonly TranscriptSegment[];
  missingHindi: readonly TranscriptToken[];
  showsMissingHindi: boolean;
  showsUnreviewedHindi: boolean;
  characterCount: number; wordCount: number; isEmpty: boolean;

  onCommit(event: CommitEvent): void;            // stable identity

  setText(text: string): void;
  textareaProps: { value: string; onChange(e: ChangeEvent<HTMLTextAreaElement>): void; lang: OutputLanguage; dir: "ltr" };
  insertSpace(): void; insertNewLine(): void; backspace(): void;
  canUndo: boolean; undo(): void; clear(): void;

  currentSession(): TranscriptSession | null;    // snapshot for copy/export
  finishSession(): TranscriptSession | null;     // move to history, start a new transcript
  history: readonly TranscriptSession[];         // newest first
  keepHistory: boolean;                          // false by default
  setKeepHistory(keep: boolean): void;
  deleteSession(id: string): void;
  deleteAllSessions(): void;
  historyStorageError: "unavailable" | "invalid" | "quota" | null;
};

const TRANSCRIPT_STORAGE_KEYS = {
  keepHistory: "rtslr.transcript.keepHistory",   // "1" only after opt-in
  history: "rtslr.transcript.history",           // present only while keepHistory is on
  outputLanguage: "rtslr.transcript.outputLanguage",
};
```

Storage behaviour:

- The live transcript is never written to storage.
- Finished sessions live in a module-level store, so they survive client-side navigation and are gone on reload.
- Only `setKeepHistory(true)` writes history to `localStorage`: at most 50 sessions, none older than 30 days (expired ones are removed when the store loads). `setKeepHistory(false)` deletes the stored copy at once; the in-memory list of the current page stays until the user deletes it or reloads.
- The output language is written only when the user changes it.
- Stored history is validated when read; a record that fails is reported as `"invalid"` and left untouched until the user deletes history.
- All keys start with `rtslr`, so a delete-all that removes `rtslr`-prefixed keys covers them. To also empty the in-memory list call `transcriptHistory.removeAll()` (or `deleteAllSessions()`).

### speech / useSpeech

```ts
type SpeechState = "idle" | "speaking" | "paused" | "unsupported";
type VoiceChoice = { voice: SpeechSynthesisVoice | null; local: boolean; network: boolean; networkOnly: boolean; match: "region" | "language" | "none" };
type SpeakResult =
  | { ok: true; segments: number; usedNetworkVoice: boolean }
  | { ok: false; reason: "unsupported" | "empty" | "no_voice" | "network_consent_required"; language?: OutputLanguage };

function isSpeechSupported(): boolean;
function loadVoices(synth: SpeechSynthesis, timeoutMs?: number): Promise<SpeechSynthesisVoice[]>;
function selectVoice(voices, language: OutputLanguage, preferredVoiceURI?: string | null): VoiceChoice;
function prepareSpeech(text: string, language: OutputLanguage): { text: string; language: OutputLanguage }[];
function createSpeechStore(env?: { synth?: SpeechSynthesis | null; createUtterance?(text: string): SpeechSynthesisUtterance }): SpeechStore;

function useSpeech(options?: { store?: SpeechStore }): {
  ready: boolean; supported: boolean; state: SpeechState;
  voices: readonly SpeechSynthesisVoice[];
  voice: { en: VoiceChoice; hi: VoiceChoice };
  networkVoice: { en: boolean; hi: boolean };    // show the warning when true
  networkVoiceAccepted: boolean; acceptNetworkVoice(): void;
  rate: number; setRate(rate: number): void;     // clamped to 0.5 - 2
  selectedVoiceURI: { en: string | null; hi: string | null };
  setVoice(language: OutputLanguage, voiceURI: string | null): void;
  speak(text: string, language: OutputLanguage): SpeakResult;
  pause(): void; resume(): void; stop(): void;
  error: string | null;
};
```

- Voice order: local `en-IN`/`hi-IN`, local other region, network `en-IN`/`hi-IN`, network other region. A voice of another language is never substituted; `speak` returns `no_voice` instead.
- A voice counts as local only when `localService === true`. If the chosen voice is not local (or the browser lists no voices at all, so the engine's choice cannot be inspected), `speak` returns `network_consent_required` and says nothing. Show `networkVoiceWarning`, and on the user's confirmation call `acceptNetworkVoice()` then `speak` again. The acceptance lives in memory only.
- Each word is spoken by the voice of its script: Devanagari by the Hindi voice, Latin by the English voice. In Hindi output, fingerspelled words and unmapped labels are still read by the English voice.
- Fingerspelled words are spoken as words: runs of two or more capitals are lower-cased before speaking (`CAT` -> "cat"). An isolated capital is left as is and read as a letter.
- Speech started by a store is cancelled when its last subscriber unmounts.
- `ready` is false during server render and the first client render; render speech controls after `ready`.

### exporter

```ts
function buildTextExport(session: TranscriptSession, options?: { language?: OutputLanguage; exportedAt?: number; includeHeader?: boolean }): string;
function buildJsonExport(session: TranscriptSession, options?: { language?: OutputLanguage; exportedAt?: number }): TranscriptExport;
function exportFilename(session: TranscriptSession, extension: "txt" | "json"): string;   // rtslr-transcript-YYYYMMDD-HHMMSS.ext (UTC)
function exportSessionAsText(session, options?): DownloadResult;
function exportSessionAsJson(session, options?): DownloadResult;
function downloadTextFile(filename: string, content: string, mimeType: string): DownloadResult;
function copyText(text: string, clipboard?: Pick<Clipboard, "writeText"> | null): Promise<CopyResult>;

type DownloadResult = { ok: true; filename: string } | { ok: false; reason: "unsupported" | "failed" };
type CopyResult = { ok: true } | { ok: false; reason: "empty" | "unsupported" | "denied" };
const HONESTY_NOTE: string;  const EXPORT_SCHEMA = "rtslr-transcript-export-1";
```

Both formats carry the honesty note. The JSON adds every token with its provenance (`source`, `classId`, `modelId`, `signLanguage`, `timestamp`, `hindiMapping`, `autoJoin`), the model ids and both texts. `copyText` resolves `ok: true` only after `navigator.clipboard.writeText` resolved; there is no `execCommand` fallback. Call all of these from a click handler. `DownloadResult.ok` means the download was handed to the browser, not that the user saved the file.

### messages

```ts
const languageMessages: { en: LanguageMessages; hi: LanguageMessages };   // use with useMessages()
const outputLanguageNames: { en: { en; hi }; hi: { en; hi } };            // for the {language} placeholder
function formatMessage(template: string, values: Record<string, string | number>): string;
```

Keys with placeholders: `noHindiMappingSummary {count}`, `hindiGlossLabel {label}`, `characterCount {count}`, `wordCount {count}`, `speechNoVoice {language}`, `networkVoiceWarning {language}`, `exportSuccess {filename}`, `sessionLabel {date}`, `sessionModels {models}`.

## Wiring sketch

```tsx
const transcript = useTranscript();
const speech = useSpeech();
const t = useMessages(languageMessages);

// recognition -> transcript
stabiliser.onCommit = transcript.onCommit;

<textarea aria-label={t.transcriptLabel} {...transcript.textareaProps} />

const onSpeak = () => {
  const result = speech.speak(transcript.text, transcript.outputLanguage);
  if (!result.ok && result.reason === "network_consent_required") openNetworkVoiceDialog(result.language);
};
const onCopy = async () => toast((await copyText(transcript.text)).ok ? t.copySuccess : t.copyFailed);
const onExport = () => { const s = transcript.currentSession(); if (s) exportSessionAsJson(s); };
```

## Tests

```
npx vitest run src/features/language
```

## Hindi glosses awaiting native review

All of these are `hiReviewed: false`. They gloss the English label only; they do not describe a sign.

| Class id | Hindi | Question for the reviewer |
|----------|-------|---------------------------|
| HELLO, NAMASTE | नमस्ते | Both labels map to the same gloss; acceptable? |
| GOOD_MORNING | सुप्रभात | Formal; is शुभ प्रभात or a plain नमस्ते preferred? |
| GOOD_NIGHT | शुभ रात्रि | |
| THANK_YOU | धन्यवाद | Or शुक्रिया? |
| PLEASE | कृपया | |
| SORRY | माफ़ कीजिए | Or क्षमा कीजिए / माफ़ करना; register and nuqta spelling |
| WELCOME | स्वागत है | Greeting sense only, not "you're welcome" |
| HOW_ARE_YOU | आप कैसे हैं? | Gendered/number-marked verb; a label gloss cannot agree with the addressee |
| YES / NO | हाँ / नहीं | |
| MOTHER / FATHER | माँ / पिता | Register mismatch (माँ informal, पिता formal); माता/पिता or माँ/पापा? |
| BROTHER / SISTER | भाई / बहन | |
| FAMILY / FRIEND | परिवार / दोस्त | Or मित्र? |
| ONE ... TEN | एक दो तीन चार पाँच छह सात आठ नौ दस | छह vs छः |
| MONDAY ... SUNDAY | सोमवार मंगलवार बुधवार गुरुवार शुक्रवार शनिवार रविवार | गुरुवार vs बृहस्पतिवार; रविवार vs इतवार |
| TODAY | आज | |
| WATER / FOOD / HOME / HELP | पानी / खाना / घर / मदद | खाना vs भोजन; मदद vs सहायता |

The Hindi interface copy in `messages.ts` was also written by a non-native author and needs the same review.

## Known limitations

- `localService` is reported by the browser; this module cannot verify it.
- Pause/resume depend on the browser's speech engine; some engines (notably on Android) ignore `pause()`.
- Lower-casing runs of capitals also affects typed acronyms ("NASA" is spoken as a word).
- `countCharacters` uses `Intl.Segmenter` where available, otherwise code points, so Devanagari counts differ slightly between browsers.
- History uses `localStorage`, not IndexedDB (docs/SECURITY_PRIVACY.md section 8.1 names IndexedDB); limits and opt-in behaviour follow that section.
