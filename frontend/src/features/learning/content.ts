/**
 * RTSLR learning content: categories, sign items and lessons.
 *
 * What this file is: a vocabulary list with English and Hindi meanings, grouped
 * into lessons. What it is NOT: a description of how any sign is formed. RTSLR
 * holds no verified ISL demonstration media, so every shipped item has
 * `media: null`, and no validated ISL model exists, so every item has
 * `recognition: "none"`.
 *
 * Ids match the backend seed (`backend/app/db/seed_data/curriculum.json` and
 * `sign_id_for` in `backend/app/db/seed.py`): `isl-<category>-<slug of English>`.
 * `classId` matches Agent 10's vocabulary (`features/language/vocabulary.ts`).
 *
 * Hindi: letters stay Latin (they are not glossed). Every other `hi` is a gloss
 * of the English label written by a non-native author and is pending native
 * review (`hiReviewed: false`).
 */

import type { VocabularyKind } from "@/features/language/vocabulary";

export type LocalizedText = { en: string; hi: string };

export type CategoryId =
  | "alphabet"
  | "numbers"
  | "greetings"
  | "everyday"
  | "family"
  | "questions"
  | "time-and-days"
  | "places";

export type SignKind = Exclude<VocabularyKind, "control">;

/** A WebVTT text track for a demonstration video. */
export type MediaCaptionTrack = {
  /** Same-origin path to a .vtt file. */
  src: string;
  srcLang: "en" | "hi";
  /** Shown in the caption language picker, e.g. "English". */
  label: string;
};

/**
 * Verified demonstration media for one sign. Add an entry only when the file
 * comes from an authoritative ISL source and the licence allows RTSLR to show it.
 * See docs/agent-reports/AGENT_09.md for the checklist.
 */
export type SignMedia = {
  type: "image" | "video";
  /** Same-origin path (the CSP allows media and images from 'self' only). */
  src: string;
  /** Text alternative, taken from or checked against the cited source. */
  alt: LocalizedText;
  /** Video only: still shown before playback. Same-origin path. */
  poster?: string;
  /** Video only. May be empty when the video has no speech or text to caption. */
  captions: readonly MediaCaptionTrack[];
  /** Who made the demonstration, e.g. "ISLRTC, DEPwD, MSJ&E, Government of India". */
  credit: string;
  licence: { name: string; url?: string };
  /** Page the media was taken from. */
  sourceUrl: string;
  /** ISO date on which a named reviewer checked the media against the source. */
  verifiedOn: string;
};

/** Where a learner can look a sign up today. */
export type SignSource = {
  /** Id in research/data/datasets.json. */
  id: string;
  /** Id in research/data/references.json. */
  referenceId: string;
  name: LocalizedText;
  url: string;
  /** False while the dictionary pages have not been opened from RTSLR's network. */
  verified: boolean;
};

export type SignItem = {
  id: string;
  category: CategoryId;
  en: string;
  hi: string;
  kind: SignKind;
  /** null until verified demonstration media exists. Never invent one. */
  media: SignMedia | null;
  source: SignSource;
  /** No validated ISL recognition exists for any item. */
  recognition: "none";
  /** Class id used by the transcript vocabulary. */
  classId: string;
  /** False: the Hindi gloss has not been reviewed by a native reader. */
  hiReviewed: boolean;
};

export type Category = {
  id: CategoryId;
  title: LocalizedText;
  description: LocalizedText;
};

export type Lesson = {
  id: string;
  category: CategoryId;
  title: LocalizedText;
  /** Ordered sign ids. */
  signIds: readonly string[];
};

/**
 * The ISLRTC dictionary, as recorded by Agent 07 in research/data/datasets.json
 * (`ds-islrtc-dictionary`, `verified: false`). The URL is the ISLRTC home page
 * (opened on 2026-11-21, `ref-islrtc-home`), which links to the dictionary. The
 * dictionary site itself refused the connection from RTSLR's network.
 */
export const DICTIONARY_SOURCE: SignSource = Object.freeze({
  id: "ds-islrtc-dictionary",
  referenceId: "ref-islrtc-home",
  name: {
    en: "ISLRTC Indian Sign Language Dictionary",
    hi: "ISLRTC भारतीय सांकेतिक भाषा शब्दकोश",
  },
  url: "https://islrtc.nic.in/",
  verified: false,
});

export const SIGN_LANGUAGE = "ISL";

/* ------------------------------------------------------------------ */
/* Source tables                                                       */
/* ------------------------------------------------------------------ */

type LessonSeed = { id: string; en: string; hi: string; signs: readonly string[] };
type CategorySeed = {
  id: CategoryId;
  title: LocalizedText;
  description: LocalizedText;
  /** [English, Hindi]. A null Hindi means "keep the Latin symbol". */
  signs: readonly (readonly [string, string | null])[];
  lessons: readonly LessonSeed[];
};

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const SEEDS: readonly CategorySeed[] = [
  {
    id: "alphabet",
    title: { en: "Alphabet", hi: "वर्णमाला" },
    description: {
      en: "The letters A to Z, used for fingerspelling names and words.",
      hi: "A से Z तक के अक्षर, जिनसे नाम और शब्दों की वर्तनी की जाती है।",
    },
    signs: letters.map((c) => [c, null] as const),
    lessons: [
      { id: "alphabet-a-i", en: "Letters A to I", hi: "अक्षर A से I", signs: letters.slice(0, 9) },
      { id: "alphabet-j-r", en: "Letters J to R", hi: "अक्षर J से R", signs: letters.slice(9, 18) },
      { id: "alphabet-s-z", en: "Letters S to Z", hi: "अक्षर S से Z", signs: letters.slice(18) },
    ],
  },
  {
    id: "numbers",
    title: { en: "Numbers", hi: "संख्याएँ" },
    description: { en: "The digits 0 to 9.", hi: "0 से 9 तक के अंक।" },
    signs: [
      ["0", "शून्य"], ["1", "एक"], ["2", "दो"], ["3", "तीन"], ["4", "चार"],
      ["5", "पाँच"], ["6", "छह"], ["7", "सात"], ["8", "आठ"], ["9", "नौ"],
    ],
    lessons: [
      { id: "numbers-0-4", en: "Numbers 0 to 4", hi: "संख्याएँ 0 से 4", signs: ["0", "1", "2", "3", "4"] },
      { id: "numbers-5-9", en: "Numbers 5 to 9", hi: "संख्याएँ 5 से 9", signs: ["5", "6", "7", "8", "9"] },
    ],
  },
  {
    id: "greetings",
    title: { en: "Greetings", hi: "अभिवादन" },
    description: {
      en: "Words for meeting people and being polite.",
      hi: "लोगों से मिलने और शिष्टाचार के शब्द।",
    },
    signs: [
      ["Hello", "नमस्ते"], ["Good morning", "सुप्रभात"], ["Good night", "शुभ रात्रि"],
      // Agent 10's vocabulary gloss for WELCOME ("स्वागत है") is used here.
      ["Welcome", "स्वागत है"], ["Thank you", "धन्यवाद"], ["Please", "कृपया"],
      ["Sorry", "माफ़ कीजिए"], ["Goodbye", "अलविदा"],
    ],
    lessons: [
      {
        id: "greetings-meeting",
        en: "Meeting people",
        hi: "लोगों से मिलना",
        signs: ["Hello", "Good morning", "Good night", "Welcome", "Goodbye"],
      },
      { id: "greetings-polite", en: "Polite words", hi: "शिष्टाचार के शब्द", signs: ["Thank you", "Please", "Sorry"] },
    ],
  },
  {
    id: "everyday",
    title: { en: "Everyday", hi: "रोज़मर्रा" },
    description: { en: "Common words for daily life.", hi: "रोज़ के जीवन के आम शब्द।" },
    signs: [
      ["Yes", "हाँ"], ["No", "नहीं"], ["Help", "मदद"], ["Water", "पानी"], ["Food", "खाना"],
      ["Home", "घर"], ["Work", "काम"], ["Name", "नाम"], ["Friend", "दोस्त"], ["Good", "अच्छा"],
      ["Bad", "बुरा"], ["Money", "पैसा"],
    ],
    lessons: [
      {
        id: "everyday-basics",
        en: "Basic words",
        hi: "बुनियादी शब्द",
        signs: ["Yes", "No", "Help", "Good", "Bad", "Name"],
      },
      {
        id: "everyday-needs",
        en: "Daily needs",
        hi: "रोज़ की ज़रूरतें",
        signs: ["Water", "Food", "Home", "Work", "Friend", "Money"],
      },
    ],
  },
  {
    id: "family",
    title: { en: "Family", hi: "परिवार" },
    description: { en: "Words for family members.", hi: "परिवार के सदस्यों के शब्द।" },
    signs: [
      ["Family", "परिवार"], ["Mother", "माँ"], ["Father", "पिता"], ["Brother", "भाई"],
      ["Sister", "बहन"], ["Son", "बेटा"], ["Daughter", "बेटी"], ["Grandfather", "दादा"],
      ["Grandmother", "दादी"], ["Husband", "पति"], ["Wife", "पत्नी"], ["Child", "बच्चा"],
    ],
    lessons: [
      {
        id: "family-close",
        en: "Close family",
        hi: "निकट परिवार",
        signs: ["Family", "Mother", "Father", "Brother", "Sister", "Son", "Daughter"],
      },
      {
        id: "family-wider",
        en: "Wider family",
        hi: "बड़ा परिवार",
        signs: ["Grandfather", "Grandmother", "Husband", "Wife", "Child"],
      },
    ],
  },
  {
    id: "questions",
    title: { en: "Questions", hi: "प्रश्न" },
    description: { en: "Question words.", hi: "प्रश्नवाचक शब्द।" },
    signs: [
      ["What", "क्या"], ["Who", "कौन"], ["Where", "कहाँ"], ["When", "कब"], ["Why", "क्यों"],
      ["How", "कैसे"], ["Which", "कौन सा"], ["How many", "कितने"],
    ],
    lessons: [
      {
        id: "questions-words",
        en: "Question words",
        hi: "प्रश्नवाचक शब्द",
        signs: ["What", "Who", "Where", "When", "Why", "How", "Which", "How many"],
      },
    ],
  },
  {
    id: "time-and-days",
    title: { en: "Time and days", hi: "समय और दिन" },
    description: {
      en: "Words for time and the days of the week.",
      hi: "समय और सप्ताह के दिनों के शब्द।",
    },
    signs: [
      ["Today", "आज"], ["Tomorrow", "आने वाला कल"], ["Yesterday", "बीता हुआ कल"], ["Morning", "सुबह"],
      ["Evening", "शाम"], ["Night", "रात"], ["Week", "सप्ताह"], ["Month", "महीना"], ["Year", "साल"],
      ["Monday", "सोमवार"], ["Tuesday", "मंगलवार"], ["Wednesday", "बुधवार"], ["Thursday", "गुरुवार"],
      ["Friday", "शुक्रवार"], ["Saturday", "शनिवार"], ["Sunday", "रविवार"],
    ],
    lessons: [
      {
        id: "time-words",
        en: "Time words",
        hi: "समय के शब्द",
        signs: ["Today", "Tomorrow", "Yesterday", "Morning", "Evening", "Night", "Week", "Month", "Year"],
      },
      {
        id: "time-days-of-week",
        en: "Days of the week",
        hi: "सप्ताह के दिन",
        signs: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
    ],
  },
  {
    id: "places",
    title: { en: "Places", hi: "स्थान" },
    description: { en: "Words for places you visit.", hi: "आने-जाने की जगहों के शब्द।" },
    signs: [
      ["School", "स्कूल"], ["Hospital", "अस्पताल"], ["Market", "बाज़ार"], ["Shop", "दुकान"],
      ["Office", "दफ़्तर"], ["Bank", "बैंक"], ["Temple", "मंदिर"], ["Railway station", "रेलवे स्टेशन"],
      ["Bus stop", "बस स्टॉप"], ["City", "शहर"], ["Village", "गाँव"], ["India", "भारत"],
    ],
    lessons: [
      {
        id: "places-town",
        en: "Around town",
        hi: "शहर में",
        signs: ["School", "Hospital", "Market", "Shop", "Office", "Bank", "Temple"],
      },
      {
        id: "places-travel",
        en: "Travel and regions",
        hi: "यात्रा और क्षेत्र",
        signs: ["Railway station", "Bus stop", "City", "Village", "India"],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Derived, frozen collections                                         */
/* ------------------------------------------------------------------ */

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Same rule as `sign_id_for` in backend/app/db/seed.py. */
export function signIdFor(category: CategoryId, en: string): string {
  return `${SIGN_LANGUAGE.toLowerCase()}-${category}-${slug(en)}`;
}

function kindOf(en: string): SignKind {
  if (/^[A-Z]$/.test(en)) return "letter";
  if (/^[0-9]$/.test(en)) return "digit";
  return /\s/.test(en) ? "phrase" : "word";
}

export const CATEGORIES: readonly Category[] = Object.freeze(
  SEEDS.map(({ id, title, description }) => Object.freeze({ id, title, description })),
);

export const SIGNS: readonly SignItem[] = Object.freeze(
  SEEDS.flatMap((category) =>
    category.signs.map(([en, hi]): SignItem => {
      const kind = kindOf(en);
      return Object.freeze({
        id: signIdFor(category.id, en),
        category: category.id,
        en,
        hi: hi ?? en,
        kind,
        media: null,
        source: DICTIONARY_SOURCE,
        recognition: "none",
        classId: en.toUpperCase().replace(/[\s-]+/g, "_"),
        // Letters are not glossed, so there is nothing to review.
        hiReviewed: kind === "letter",
      });
    }),
  ),
);

export const LESSONS: readonly Lesson[] = Object.freeze(
  SEEDS.flatMap((category) =>
    category.lessons.map(
      (lesson): Lesson =>
        Object.freeze({
          id: lesson.id,
          category: category.id,
          title: { en: lesson.en, hi: lesson.hi },
          signIds: Object.freeze(lesson.signs.map((en) => signIdFor(category.id, en))),
        }),
    ),
  ),
);

const SIGN_BY_ID: ReadonlyMap<string, SignItem> = new Map(SIGNS.map((sign) => [sign.id, sign]));
const LESSON_BY_ID: ReadonlyMap<string, Lesson> = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
const CATEGORY_BY_ID: ReadonlyMap<string, Category> = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getSign(id: string): SignItem | undefined {
  return SIGN_BY_ID.get(id);
}

export function getLesson(id: string): Lesson | undefined {
  return LESSON_BY_ID.get(id);
}

export function getCategory(id: CategoryId): Category {
  // Every CategoryId has an entry: CATEGORIES is built from the same table.
  return CATEGORY_BY_ID.get(id) as Category;
}

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_BY_ID.has(value);
}

export function signsInCategory(category: CategoryId): SignItem[] {
  return SIGNS.filter((sign) => sign.category === category);
}

export function lessonsInCategory(category: CategoryId): Lesson[] {
  return LESSONS.filter((lesson) => lesson.category === category);
}

export function signsInLesson(lesson: Lesson): SignItem[] {
  return lesson.signIds.flatMap((id) => {
    const sign = SIGN_BY_ID.get(id);
    return sign ? [sign] : [];
  });
}

/** The first lesson that teaches a sign, if any. */
export function lessonForSign(signId: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.signIds.includes(signId));
}

/** Categories shown on /learn/alphabet; the rest are on /learn/everyday. */
export const ALPHABET_CATEGORY_IDS: readonly CategoryId[] = ["alphabet", "numbers"];
export const EVERYDAY_CATEGORY_IDS: readonly CategoryId[] = [
  "greetings",
  "everyday",
  "family",
  "questions",
  "time-and-days",
  "places",
];

/** Route that lists the lessons of a category. */
export function categoryHref(category: CategoryId): string {
  return ALPHABET_CATEGORY_IDS.includes(category) ? "/learn/alphabet" : "/learn/everyday";
}

export function signHref(signId: string): string {
  return `/learn/sign/${signId}`;
}

/** Picks the text for the interface language. */
export function localize(text: LocalizedText, locale: "en" | "hi"): string {
  return text[locale];
}
