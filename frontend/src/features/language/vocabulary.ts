/**
 * RTSLR label vocabulary: maps a recognised class id to the text shown in the
 * transcript, per OUTPUT language.
 *
 * What this is NOT: a translator. An entry glosses one class label. It says
 * nothing about ISL grammar, and a sequence of entries is a sequence of labels.
 *
 * Hindi rules (see README.md):
 *  - `hi` is filled only by an explicit mapping written here or typed by the
 *    user. Nothing is machine-generated at runtime.
 *  - `hi: null` means "no Hindi mapping": the English label is shown and flagged.
 *  - Latin fingerspelled letters and digits stay Latin in Hindi output. They are
 *    never transliterated letter by letter into Devanagari.
 *  - Built-in Hindi glosses for words are `hiReviewed: false` until a native
 *    Hindi reader who also knows ISL glossing conventions signs them off.
 */

import type { SignLanguage } from "@/types/recognition";

export type OutputLanguage = "en" | "hi";
export const OUTPUT_LANGUAGES: readonly OutputLanguage[] = ["en", "hi"];

export type VocabularyKind = "letter" | "digit" | "word" | "phrase" | "control";
export type ControlAction = "space" | "delete" | "newline";

export type VocabularyEntry = {
  classId: string;
  signLanguage: SignLanguage;
  kind: VocabularyKind;
  /** Text shown in English output. Empty for control entries. */
  en: string;
  /** Text shown in Hindi output, or null when no mapping exists. */
  hi: string | null;
  /** True only when a qualified native reader has reviewed `hi`. */
  hiReviewed: boolean;
  /** Present only when kind is "control". */
  control?: ControlAction;
  /** builtin: shipped here. user: registered at runtime. inferred: no entry
   *  existed, built on the fly from the model's own label. */
  origin: "builtin" | "user" | "inferred";
};

export const MAX_LABEL_LENGTH = 64;

export const CONTROL_CLASS_IDS = {
  space: "SPACE",
  delete: "DELETE",
  newline: "NEWLINE",
} as const satisfies Record<ControlAction, string>;

const SIGN_LANGUAGES: readonly SignLanguage[] = ["ISL", "ASL"];

/* ------------------------------------------------------------------ */
/* Normalisation and validation                                        */
/* ------------------------------------------------------------------ */

/** Case- and separator-insensitive key for a class id or label. */
export function normalizeClassId(value: string): string {
  return value.normalize("NFC").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

const ALIASES: ReadonlyMap<string, string> = new Map([
  ["DEL", "DELETE"],
  ["BACKSPACE", "DELETE"],
  ["NEW_LINE", "NEWLINE"],
  ["ENTER", "NEWLINE"],
  ["THANKS", "THANK_YOU"],
]);

function canonicalId(value: string): string {
  const id = normalizeClassId(value);
  return ALIASES.get(id) ?? id;
}

/** Removes control characters, collapses whitespace, trims, NFC-normalises. */
export function cleanLabel(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type GlossValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "too_long" };

/** Validates a Hindi gloss typed by the user. It is stored exactly as typed
 *  (after whitespace clean-up); it is never altered or "corrected". */
export function validateHindiGloss(input: string): GlossValidation {
  const value = cleanLabel(input);
  if (value.length === 0) return { ok: false, reason: "empty" };
  if (value.length > MAX_LABEL_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, value };
}

function inferKind(label: string): VocabularyKind {
  if (/^[A-Za-z]$/.test(label)) return "letter";
  if (/^[0-9]$/.test(label)) return "digit";
  return /\s/.test(label) ? "phrase" : "word";
}

/* ------------------------------------------------------------------ */
/* Built-in entries                                                    */
/* ------------------------------------------------------------------ */

type Seed = Omit<VocabularyEntry, "signLanguage" | "origin">;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");

/** Latin letters and digits: `hi` equals `en` by rule (Latin stays Latin). This
 *  is a display rule, not a gloss, so there is nothing to review. */
const SYMBOL_SEEDS: Seed[] = [
  ...LETTERS.map((c): Seed => ({ classId: c, kind: "letter", en: c, hi: c, hiReviewed: true })),
  ...DIGITS.map((c): Seed => ({ classId: c, kind: "digit", en: c, hi: c, hiReviewed: true })),
];

const CONTROL_SEEDS: Seed[] = [
  { classId: CONTROL_CLASS_IDS.space, kind: "control", control: "space", en: "", hi: "", hiReviewed: true },
  { classId: CONTROL_CLASS_IDS.delete, kind: "control", control: "delete", en: "", hi: "", hiReviewed: true },
  { classId: CONTROL_CLASS_IDS.newline, kind: "control", control: "newline", en: "", hi: "", hiReviewed: true },
];

function word(classId: string, hi: string, kind: "word" | "phrase" = "word"): Seed {
  return { classId, kind, en: classId.replace(/_/g, " "), hi, hiReviewed: false };
}

/**
 * Starter glosses for common everyday labels. Each `hi` is a Hindi gloss of the
 * ENGLISH LABEL, chosen by a non-native author: every one is `hiReviewed: false`
 * and listed in README.md for native review. None of this describes how a sign
 * is formed, and none of it is evidence that any model recognises these signs.
 */
const WORD_SEEDS: Seed[] = [
  // Greetings and courtesy
  word("HELLO", "नमस्ते"),
  word("NAMASTE", "नमस्ते"),
  word("GOOD_MORNING", "सुप्रभात", "phrase"),
  word("GOOD_NIGHT", "शुभ रात्रि", "phrase"),
  word("THANK_YOU", "धन्यवाद", "phrase"),
  word("PLEASE", "कृपया"),
  word("SORRY", "माफ़ कीजिए"),
  word("WELCOME", "स्वागत है"),
  word("HOW_ARE_YOU", "आप कैसे हैं?", "phrase"),
  // Yes / no
  word("YES", "हाँ"),
  word("NO", "नहीं"),
  // Family
  word("MOTHER", "माँ"),
  word("FATHER", "पिता"),
  word("BROTHER", "भाई"),
  word("SISTER", "बहन"),
  word("FAMILY", "परिवार"),
  word("FRIEND", "दोस्त"),
  // Number words (digits 0-9 are separate "digit" entries)
  word("ONE", "एक"),
  word("TWO", "दो"),
  word("THREE", "तीन"),
  word("FOUR", "चार"),
  word("FIVE", "पाँच"),
  word("SIX", "छह"),
  word("SEVEN", "सात"),
  word("EIGHT", "आठ"),
  word("NINE", "नौ"),
  word("TEN", "दस"),
  // Days
  word("MONDAY", "सोमवार"),
  word("TUESDAY", "मंगलवार"),
  word("WEDNESDAY", "बुधवार"),
  word("THURSDAY", "गुरुवार"),
  word("FRIDAY", "शुक्रवार"),
  word("SATURDAY", "शनिवार"),
  word("SUNDAY", "रविवार"),
  word("TODAY", "आज"),
  // Everyday
  word("WATER", "पानी"),
  word("FOOD", "खाना"),
  word("HOME", "घर"),
  word("HELP", "मदद"),
];

/**
 * Letters, digits and control tokens are valid for both the legacy ASL
 * prototype and user-defined ISL classes. Word glosses are registered for ISL
 * only: the ASL prototype is a fingerspelling demo with no word classes.
 */
export const BUILTIN_ENTRIES: readonly VocabularyEntry[] = Object.freeze([
  ...SIGN_LANGUAGES.flatMap((signLanguage) =>
    [...SYMBOL_SEEDS, ...CONTROL_SEEDS].map(
      (seed): VocabularyEntry => Object.freeze({ ...seed, signLanguage, origin: "builtin" }),
    ),
  ),
  ...WORD_SEEDS.map(
    (seed): VocabularyEntry => Object.freeze({ ...seed, signLanguage: "ISL", origin: "builtin" }),
  ),
]);

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export type ClassRef = { classId: string; label: string; signLanguage: SignLanguage };

export type CustomClassInput = {
  classId: string;
  /** English label the user gave the class. */
  label: string;
  signLanguage: SignLanguage;
  /** Defaults to an inference from the label (single letter, single digit,
   *  contains a space => phrase, otherwise word). */
  kind?: Exclude<VocabularyKind, "control">;
  /** Hindi gloss typed by the user. Omit or pass null for "no Hindi mapping". */
  hi?: string | null;
};

export type VocabularyRegistry = {
  /** Exact lookup by class id and sign language (ids are case-insensitive). */
  get(classId: string, signLanguage: SignLanguage): VocabularyEntry | undefined;
  /** Never fails: class id, then the model's label, then an inferred entry
   *  with `hi: null` (letters/digits keep their Latin form). */
  resolve(ref: ClassRef): VocabularyEntry;
  /** Adds or replaces a runtime entry for a user-recorded class. Throws
   *  RangeError on an empty/over-long label or gloss. */
  registerCustomClass(input: CustomClassInput): VocabularyEntry;
  /** Sets or clears the user's Hindi gloss on a runtime entry. Returns
   *  undefined when no runtime entry exists (built-ins cannot be edited). */
  setHindiGloss(classId: string, signLanguage: SignLanguage, hi: string | null): VocabularyEntry | undefined;
  /** Removes a runtime entry. Built-ins cannot be removed. */
  remove(classId: string, signLanguage: SignLanguage): boolean;
  list(signLanguage?: SignLanguage): VocabularyEntry[];
  /** Notified after every runtime change. */
  subscribe(listener: () => void): () => void;
};

function keyOf(classId: string, signLanguage: SignLanguage): string {
  return `${signLanguage}:${canonicalId(classId)}`;
}

export function createVocabularyRegistry(
  builtins: readonly VocabularyEntry[] = BUILTIN_ENTRIES,
): VocabularyRegistry {
  const builtin = new Map<string, VocabularyEntry>();
  const user = new Map<string, VocabularyEntry>();
  const listeners = new Set<() => void>();
  for (const entry of builtins) builtin.set(keyOf(entry.classId, entry.signLanguage), entry);

  const emit = () => listeners.forEach((l) => l());

  const get: VocabularyRegistry["get"] = (classId, signLanguage) => {
    const key = keyOf(classId, signLanguage);
    return user.get(key) ?? builtin.get(key);
  };

  return {
    get,

    resolve({ classId, label, signLanguage }) {
      const byId = get(classId, signLanguage);
      if (byId) return byId;
      const clean = cleanLabel(label) || cleanLabel(classId);
      const byLabel = clean ? get(clean, signLanguage) : undefined;
      if (byLabel) return byLabel;
      const kind = inferKind(clean);
      const symbol = kind === "letter" || kind === "digit";
      const en = symbol ? clean.toUpperCase() : clean;
      return {
        classId,
        signLanguage,
        kind,
        en,
        hi: symbol ? en : null,
        hiReviewed: symbol,
        origin: "inferred",
      };
    },

    registerCustomClass(input) {
      const en = cleanLabel(input.label);
      if (en.length === 0 || en.length > MAX_LABEL_LENGTH) {
        throw new RangeError(`Class label must be 1-${MAX_LABEL_LENGTH} characters.`);
      }
      if (cleanLabel(input.classId).length === 0) throw new RangeError("Class id must not be empty.");
      const kind = input.kind ?? inferKind(en);
      const symbol = kind === "letter" || kind === "digit";
      let hi: string | null = symbol ? en.toUpperCase() : null;
      if (!symbol && input.hi != null) {
        const checked = validateHindiGloss(input.hi);
        if (!checked.ok) throw new RangeError(`Hindi gloss is ${checked.reason}.`);
        hi = checked.value;
      }
      const entry: VocabularyEntry = Object.freeze({
        classId: input.classId,
        signLanguage: input.signLanguage,
        kind,
        en: symbol ? en.toUpperCase() : en,
        hi,
        // A gloss typed by the user is the user's own wording, not a reviewed one.
        hiReviewed: symbol,
        origin: "user",
      });
      user.set(keyOf(entry.classId, entry.signLanguage), entry);
      emit();
      return entry;
    },

    setHindiGloss(classId, signLanguage, hi) {
      const key = keyOf(classId, signLanguage);
      const current = user.get(key);
      if (!current || current.kind === "letter" || current.kind === "digit") return undefined;
      let next: string | null = null;
      if (hi !== null) {
        const checked = validateHindiGloss(hi);
        if (!checked.ok) throw new RangeError(`Hindi gloss is ${checked.reason}.`);
        next = checked.value;
      }
      const entry: VocabularyEntry = Object.freeze({ ...current, hi: next, hiReviewed: false });
      user.set(key, entry);
      emit();
      return entry;
    },

    remove(classId, signLanguage) {
      const removed = user.delete(keyOf(classId, signLanguage));
      if (removed) emit();
      return removed;
    },

    list(signLanguage) {
      const merged = new Map([...builtin, ...user]);
      const all = [...merged.values()];
      return signLanguage ? all.filter((e) => e.signLanguage === signLanguage) : all;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Shared registry used by the studio. Custom classes register themselves here. */
export const vocabulary: VocabularyRegistry = createVocabularyRegistry();

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

export type RenderedGloss = {
  text: string;
  /** True when Hindi was requested and the English label is shown instead. */
  missingHindi: boolean;
  /** True when Hindi text is shown but has not been reviewed by a native reader. */
  unreviewedHindi: boolean;
};

export function renderGloss(
  entry: Pick<VocabularyEntry, "en" | "hi" | "hiReviewed">,
  language: OutputLanguage,
): RenderedGloss {
  if (language === "en") return { text: entry.en, missingHindi: false, unreviewedHindi: false };
  if (entry.hi === null) return { text: entry.en, missingHindi: true, unreviewedHindi: false };
  return { text: entry.hi, missingHindi: false, unreviewedHindi: !entry.hiReviewed };
}

/** Built-in Hindi glosses still waiting for native review. */
export function listUnreviewedHindi(registry: VocabularyRegistry = vocabulary): VocabularyEntry[] {
  return registry.list().filter((e) => e.origin === "builtin" && e.hi !== null && !e.hiReviewed);
}
