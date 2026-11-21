"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Badge, Button, Notice, VisuallyHidden } from "@/components/ui";
import { getCategory, type CategoryId, type SignItem } from "@/features/learning/content";
import { dayKey } from "@/features/learning/srs";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";

/** Replaces `{name}` placeholders in a message. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/* ------------------------------------------------------------------ today */

function subscribeToday(onChange: () => void): () => void {
  // A tab left open overnight picks up the new day when it is shown again.
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const readToday = () => dayKey(new Date());
const readServerToday = () => "";

/** Local calendar day (YYYY-MM-DD); "" on the server and during hydration. */
export function useToday(): string {
  return useSyncExternalStore(subscribeToday, readToday, readServerToday);
}

/* ------------------------------------------------------------- navigation */

const navMessages = defineMessages({
  en: {
    label: "Learn ISL sections",
    overview: "All signs",
    alphabet: "Alphabet and numbers",
    everyday: "Everyday words",
    practice: "Practice",
    progress: "Progress",
  },
  hi: {
    label: "ISL सीखें के अनुभाग",
    overview: "सभी संकेत",
    alphabet: "वर्णमाला और संख्याएँ",
    everyday: "रोज़मर्रा के शब्द",
    practice: "अभ्यास",
    progress: "प्रगति",
  },
});

export type LearnSection = "overview" | "alphabet" | "everyday" | "practice" | "progress";

const NAV: readonly { id: LearnSection; href: string }[] = [
  { id: "overview", href: "/learn" },
  { id: "alphabet", href: "/learn/alphabet" },
  { id: "everyday", href: "/learn/everyday" },
  { id: "practice", href: "/learn/practice" },
  { id: "progress", href: "/learn/progress" },
];

/** Sub-navigation shared by every learning page. `current` is omitted on sign pages. */
export function LearnNav({ current, className }: { current?: LearnSection; className?: string }) {
  const t = useMessages(navMessages);
  return (
    <nav aria-label={t.label} className={cn("-mx-1 overflow-x-auto px-1 py-1", className)}>
      <ul className="inline-flex min-w-max items-center gap-6 border-b border-line">
        {NAV.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 px-0.5 text-small font-semibold whitespace-nowrap transition-colors duration-200 ease-calm",
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t[item.id]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------- storage notice */

const storageMessages = defineMessages({
  en: {
    memoryTitle: "Progress is not being saved",
    memoryBody:
      "This browser is blocking local storage, so your progress stays only until you close or reload this tab. Everything else on these pages works.",
    invalidTitle: "Saved progress could not be read",
    invalidBody:
      "The learning data stored in this browser is damaged or comes from a newer version of RTSLR. It has been left untouched, and new progress is kept only for this visit. Reset it on the Progress page to start saving again.",
    openProgress: "Open the Progress page",
  },
  hi: {
    memoryTitle: "प्रगति सहेजी नहीं जा रही है",
    memoryBody:
      "यह ब्राउज़र लोकल स्टोरेज को रोक रहा है, इसलिए आपकी प्रगति केवल तब तक रहेगी जब तक आप यह टैब बंद या रीलोड नहीं करते। इन पन्नों पर बाकी सब कुछ काम करता है।",
    invalidTitle: "सहेजी गई प्रगति पढ़ी नहीं जा सकी",
    invalidBody:
      "इस ब्राउज़र में सहेजा गया सीखने का डेटा ख़राब है या RTSLR के किसी नए संस्करण का है। उसे जैसा है वैसा छोड़ा गया है, और नई प्रगति केवल इस बार के लिए रखी जा रही है। दोबारा सहेजना शुरू करने के लिए प्रगति पेज पर उसे रीसेट करें।",
    openProgress: "प्रगति पेज खोलें",
  },
});

/** Visible notice when progress cannot be saved. Renders nothing when storage works. */
export function StorageNotice({ className, linkToProgress = true }: { className?: string; linkToProgress?: boolean }) {
  const t = useMessages(storageMessages);
  const { ready, storage } = useProgress();
  if (!ready || storage === "local") return null;
  const invalid = storage === "invalid";
  return (
    <Notice
      tone="warning"
      title={invalid ? t.invalidTitle : t.memoryTitle}
      className={className}
      actions={
        invalid && linkToProgress ? (
          <Button href="/learn/progress" variant="secondary">
            {t.openProgress}
          </Button>
        ) : undefined
      }
    >
      {invalid ? t.invalidBody : t.memoryBody}
    </Notice>
  );
}

/* -------------------------------------------------------------- favourite */

const favouriteMessages = defineMessages({
  en: { add: "Add favourite", remove: "Remove favourite" },
  hi: { add: "पसंदीदा में जोड़ें", remove: "पसंदीदा से हटाएँ" },
});

/** Toggles a sign in the favourites list. The label states what the press will do. */
export function FavouriteButton({ sign, className }: { sign: SignItem; className?: string }) {
  const t = useMessages(favouriteMessages);
  const { state, store } = useProgress();
  const active = state.favourites.includes(sign.id);
  return (
    <Button
      variant="ghost"
      className={className}
      leadingIcon={<Star className={active ? "fill-current" : undefined} />}
      onClick={() => store.toggleFavourite(sign.id)}
    >
      {active ? t.remove : t.add}
      <VisuallyHidden>: {sign.en}</VisuallyHidden>
    </Button>
  );
}

/* ------------------------------------------------------------ small parts */

const labelMessages = defineMessages({
  en: {
    pending: "Pending verified source",
    verified: "Verified source",
    letter: "Letter",
    digit: "Digit",
    word: "Word",
    phrase: "Phrase",
  },
  hi: {
    pending: "सत्यापित स्रोत लंबित",
    verified: "सत्यापित स्रोत",
    letter: "अक्षर",
    digit: "अंक",
    word: "शब्द",
    phrase: "वाक्यांश",
  },
});

/** Source state of a sign's demonstration: words plus an icon, never colour alone. */
export function SourceBadge({ sign }: { sign: SignItem }) {
  const t = useMessages(labelMessages);
  return sign.media ? <Badge tone="success">{t.verified}</Badge> : <Badge tone="warning">{t.pending}</Badge>;
}

export function useKindLabel(): (kind: SignItem["kind"]) => string {
  const t = useMessages(labelMessages);
  return (kind) => t[kind];
}

export function useCategoryTitle(): (category: CategoryId) => string {
  const { locale } = useI18n();
  return (category) => getCategory(category).title[locale];
}

export type SignWords = {
  primary: string;
  primaryLang: "en" | "hi";
  /** null when both meanings are the same text (letters). */
  secondary: string | null;
  secondaryLang: "en" | "hi";
};

/** Orders the two meanings for the interface language. */
export function useSignWords(): (sign: SignItem) => SignWords {
  const { locale } = useI18n();
  return (sign) => {
    const other = locale === "en" ? "hi" : "en";
    return {
      primary: sign[locale],
      primaryLang: locale,
      secondary: sign.en === sign.hi ? null : sign[other],
      secondaryLang: other,
    };
  };
}
