"use client";

import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Badge, Button, Notice, Section, VisuallyHidden } from "@/components/ui";
import {
  ALPHABET_CATEGORY_IDS,
  EVERYDAY_CATEGORY_IDS,
  getCategory,
  lessonsInCategory,
  signHref,
  signsInCategory,
  type CategoryId,
  type Lesson,
} from "@/features/learning/content";
import { lessonAnchor, lessonStatus } from "@/features/learning/lessons";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { LessonPlayer } from "./LessonPlayer";
import { SignCard } from "./SignCard";
import { LearnNav, StorageNotice, fill } from "./shared";

const messages = defineMessages({
  en: {
    alphabetTitle: "Alphabet and numbers",
    alphabetLead:
      "The letters A to Z and the digits 0 to 9, listed as vocabulary. Fingerspelling spells a word out letter by letter, for example a name.",
    fingerspellingTitle: "ISL fingerspelling is not the ASL alphabet",
    fingerspellingBody:
      "ISL fingerspelling is largely two-handed, similar to British Sign Language, and differs from the one-handed alphabet of American Sign Language (ASL). Pictures of the ASL alphabet, which are common online, do not teach ISL letters. RTSLR has not yet confirmed from an authoritative source which ISL letters use one hand, two hands or movement, so nothing on this page shows or describes a handshape. Demonstrations are pending a verified source.",
    everydayTitle: "Everyday words",
    everydayLead:
      "Greetings, daily needs, family, question words, time and places, each with its English and Hindi meaning and grouped into short lessons.",
    pendingTitle: "Demonstrations are pending a verified source",
    pendingBody:
      "Each item links to the official ISLRTC dictionary, where you can look the sign up. These pages do not show or describe how a sign is made.",
    lessons: "Lessons",
    allItems: "All {count} items",
    items: "{count} items",
    notStarted: "Not started",
    inProgress: "In progress: item {index} of {total}",
    completed: "Completed",
    start: "Start lesson",
    resume: "Resume at item {index}",
    review: "Review lesson",
    close: "Close lesson",
    save: "Save lesson",
    unsave: "Remove from saved",
    jump: "On this page",
  },
  hi: {
    alphabetTitle: "वर्णमाला और संख्याएँ",
    alphabetLead:
      "A से Z तक के अक्षर और 0 से 9 तक के अंक, शब्दावली के रूप में। अंगुली-वर्तनी में किसी शब्द, जैसे किसी नाम, को एक-एक अक्षर करके बताया जाता है।",
    fingerspellingTitle: "ISL की अंगुली-वर्तनी ASL वर्णमाला नहीं है",
    fingerspellingBody:
      "ISL की अंगुली-वर्तनी ज़्यादातर दोनों हाथों से होती है, ब्रिटिश सांकेतिक भाषा की तरह, और अमेरिकी सांकेतिक भाषा (ASL) की एक हाथ वाली वर्णमाला से अलग है। इंटरनेट पर आम मिलने वाली ASL वर्णमाला की तस्वीरें ISL के अक्षर नहीं सिखातीं। RTSLR ने अभी किसी प्रामाणिक स्रोत से यह पुष्टि नहीं की है कि ISL के कौन से अक्षर एक हाथ, दो हाथ या गति से बनते हैं, इसलिए इस पेज पर किसी हस्त-आकार को न दिखाया गया है और न उसका वर्णन किया गया है। प्रदर्शन सत्यापित स्रोत मिलने तक लंबित हैं।",
    everydayTitle: "रोज़मर्रा के शब्द",
    everydayLead:
      "अभिवादन, रोज़ की ज़रूरतें, परिवार, प्रश्नवाचक शब्द, समय और स्थान; हर शब्द अंग्रेज़ी और हिंदी अर्थ के साथ, छोटे पाठों में बँटा हुआ।",
    pendingTitle: "प्रदर्शन सत्यापित स्रोत मिलने तक लंबित हैं",
    pendingBody:
      "हर आइटम के साथ आधिकारिक ISLRTC शब्दकोश का लिंक है, जहाँ आप संकेत देख सकते हैं। ये पन्ने न यह दिखाते हैं और न बताते हैं कि कोई संकेत कैसे बनाया जाता है।",
    lessons: "पाठ",
    allItems: "सभी {count} आइटम",
    items: "{count} आइटम",
    notStarted: "शुरू नहीं हुआ",
    inProgress: "जारी है: {total} में से आइटम {index}",
    completed: "पूरा हुआ",
    start: "पाठ शुरू करें",
    resume: "आइटम {index} से जारी रखें",
    review: "पाठ दोहराएँ",
    close: "पाठ बंद करें",
    save: "पाठ सहेजें",
    unsave: "सहेजे गए से हटाएँ",
    jump: "इस पेज पर",
  },
});

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const readServerHash = () => "";

/** Lesson id named by the URL fragment (`#lesson-<id>`), or null. */
function useLessonFromHash(): string | null {
  const hash = useSyncExternalStore(subscribeHash, readHash, readServerHash);
  const prefix = `#${lessonAnchor("")}`;
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : null;
}

export type CategoryStudyProps = { variant: "alphabet" | "everyday" };

/** `/learn/alphabet` and `/learn/everyday`: lessons and items of several categories. */
export function CategoryStudy({ variant }: CategoryStudyProps) {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { state, store } = useProgress();
  const fromHash = useLessonFromHash();
  // undefined: follow the URL fragment. null: the learner closed the lesson.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const openLessonId = chosen === undefined ? fromHash : chosen;

  const categoryIds: readonly CategoryId[] = variant === "alphabet" ? ALPHABET_CATEGORY_IDS : EVERYDAY_CATEGORY_IDS;
  const isAlphabet = variant === "alphabet";

  const lessonBlock = (lesson: Lesson) => {
    const status = lessonStatus(lesson, state);
    const open = openLessonId === lesson.id;
    const saved = state.savedLessons.includes(lesson.id);
    const title = lesson.title[locale];
    const panelId = `${lessonAnchor(lesson.id)}-panel`;
    const openLabel =
      status.status === "completed"
        ? t.review
        : status.status === "in-progress"
          ? fill(t.resume, { index: status.index + 1 })
          : t.start;

    return (
      <li key={lesson.id} id={lessonAnchor(lesson.id)} className="py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-h3 text-ink">{title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption text-muted">{fill(t.items, { count: status.total })}</span>
              {status.status === "completed" ? (
                <Badge tone="success">{t.completed}</Badge>
              ) : status.status === "in-progress" ? (
                <Badge tone="info">{fill(t.inProgress, { index: status.index + 1, total: status.total })}</Badge>
              ) : (
                <Badge>{t.notStarted}</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              leadingIcon={<Bookmark className={saved ? "fill-current" : undefined} />}
              onClick={() => store.toggleSavedLesson(lesson.id)}
            >
              {saved ? t.unsave : t.save}
              <VisuallyHidden>: {title}</VisuallyHidden>
            </Button>
            <Button
              variant={open ? "secondary" : "primary"}
              aria-expanded={open}
              aria-controls={panelId}
              icon={open ? <ChevronUp /> : <ChevronDown />}
              onClick={() => setChosen(open ? null : lesson.id)}
            >
              {open ? t.close : openLabel}
              <VisuallyHidden>: {title}</VisuallyHidden>
            </Button>
          </div>
        </div>
        <div id={panelId} hidden={!open} className="mt-6">
          {open ? <LessonPlayer lesson={lesson} /> : null}
        </div>
      </li>
    );
  };

  return (
    <>
      <Section
        titleAs="h1"
        spacing="tight"
        title={isAlphabet ? t.alphabetTitle : t.everydayTitle}
        lead={isAlphabet ? t.alphabetLead : t.everydayLead}
      >
        <div className="flex flex-col gap-8">
          <LearnNav current={variant} />
          {isAlphabet ? (
            <Notice tone="warning" title={t.fingerspellingTitle}>
              {t.fingerspellingBody}
            </Notice>
          ) : (
            <Notice tone="warning" title={t.pendingTitle}>
              {t.pendingBody}
            </Notice>
          )}
          <StorageNotice />
          <nav aria-label={t.jump}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {categoryIds.map((id) => (
                <li key={id}>
                  <a
                    href={`#category-${id}`}
                    className="inline-flex min-h-11 items-center text-small font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  >
                    {getCategory(id).title[locale]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Section>

      {categoryIds.map((id, position) => {
        const category = getCategory(id);
        const signs = signsInCategory(id);
        const symbols = id === "alphabet" || id === "numbers";
        return (
          <Section
            key={id}
            id={`category-${id}`}
            tone={position % 2 === 0 ? "surface" : "cream"}
            spacing="tight"
            title={category.title[locale]}
            lead={category.description[locale]}
          >
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="sr-only">{t.lessons}</h3>
                <ul className="divide-y divide-line border-y border-line">{lessonsInCategory(id).map(lessonBlock)}</ul>
              </div>
              <div className="flex flex-col gap-5 lg:col-span-5">
                <h3 className="text-h4 text-ink">{fill(t.allItems, { count: signs.length })}</h3>
                {symbols ? (
                  <ul className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-5">
                    {signs.map((sign) => (
                      <li key={sign.id}>
                        <Link
                          href={signHref(sign.id)}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center rounded-field py-2 border border-line-strong text-h3 text-ink transition-colors duration-200 ease-calm hover:border-ink hover:bg-ink hover:text-on-ink",
                            position % 2 === 0 ? "bg-background" : "bg-surface",
                          )}
                        >
                          {sign.en}
                          {sign.hi !== sign.en ? (
                            <span lang="hi" className="text-label font-normal">
                              {sign.hi}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="grid border-t border-line md:grid-cols-2 md:gap-5 md:border-t-0 lg:grid-cols-1 xl:grid-cols-2">
                    {signs.map((sign) => (
                      <SignCard key={sign.id} sign={sign} headingAs="h4" />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        );
      })}
    </>
  );
}
