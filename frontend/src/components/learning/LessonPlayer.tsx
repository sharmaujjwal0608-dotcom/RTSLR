"use client";

import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { signHref, signsInLesson, type Lesson } from "@/features/learning/content";
import { lessonStatus } from "@/features/learning/lessons";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { SignMedia } from "./SignMedia";
import { FavouriteButton, fill, useSignWords } from "./shared";

const messages = defineMessages({
  en: {
    step: "Item {index} of {total}",
    previous: "Previous item",
    next: "Next item",
    complete: "Mark lesson complete",
    completedTitle: "Lesson complete",
    completedBody:
      "You have gone through every word in “{lesson}”. This records that you studied the list; it does not certify that you can sign these words.",
    practise: "Practise these words",
    restart: "Start lesson again",
    signPage: "Open the page for “{word}”",
    alsoMeans: "Also written as",
  },
  hi: {
    step: "{total} में से आइटम {index}",
    previous: "पिछला आइटम",
    next: "अगला आइटम",
    complete: "पाठ को पूरा चिह्नित करें",
    completedTitle: "पाठ पूरा हुआ",
    completedBody:
      "आपने “{lesson}” का हर शब्द देख लिया है। इससे केवल यह दर्ज होता है कि आपने सूची पढ़ी; यह प्रमाणित नहीं करता कि आप इन शब्दों के संकेत कर सकते हैं।",
    practise: "इन शब्दों का अभ्यास करें",
    restart: "पाठ फिर से शुरू करें",
    signPage: "“{word}” का पेज खोलें",
    alsoMeans: "दूसरी भाषा में",
  },
});

/**
 * Steps through the items of one lesson. The position is kept in the progress
 * store, so reopening the lesson (in this visit or a later one) resumes at the
 * same item.
 */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { state, store } = useProgress();
  const signWords = useSignWords();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  const signs = signsInLesson(lesson);
  const { index, total, status } = lessonStatus(lesson, state);
  const sign = signs[index];
  if (!sign) return null;
  const words = signWords(sign);
  const isLast = index >= total - 1;

  const goTo = (next: number) => {
    setJustCompleted(false);
    store.setLessonPosition(lesson.id, next);
    // Move focus to the new item so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const complete = () => {
    store.completeLesson(lesson.id);
    setJustCompleted(true);
    requestAnimationFrame(() => doneRef.current?.focus());
  };

  const restart = () => {
    setJustCompleted(false);
    store.restartLesson(lesson.id);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-label text-muted">{fill(t.step, { index: index + 1, total })}</p>
        {/* A text progress bar: position is also stated in words above. */}
        <ol aria-hidden="true" className="flex gap-1">
          {signs.map((entry, position) => (
            <li
              key={entry.id}
              className={position <= index ? "h-1 flex-1 rounded-control bg-ink" : "h-1 flex-1 rounded-control bg-line"}
            />
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-1">
        <h4 ref={headingRef} tabIndex={-1} lang={words.primaryLang} className="text-h2 break-words text-ink outline-none">
          {words.primary}
        </h4>
        {words.secondary ? (
          <p className="text-lead text-muted">
            <span className="sr-only">{t.alsoMeans}: </span>
            <span lang={words.secondaryLang}>{words.secondary}</span>
          </p>
        ) : null}
      </div>

      <SignMedia sign={sign} headingAs="h4" showWord={false} />

      <div className="flex flex-wrap items-center gap-3">
        <FavouriteButton sign={sign} />
        <Link
          href={signHref(sign.id)}
          className="text-small font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {fill(t.signPage, { word: sign.en })}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        {index > 0 ? (
          <Button variant="secondary" leadingIcon={<ArrowLeft />} onClick={() => goTo(index - 1)}>
            {t.previous}
          </Button>
        ) : null}
        {isLast ? (
          <Button leadingIcon={<Check />} onClick={complete}>
            {t.complete}
          </Button>
        ) : (
          <Button icon={<ArrowRight />} onClick={() => goTo(index + 1)}>
            {t.next}
          </Button>
        )}
      </div>

      <div ref={doneRef} tabIndex={-1} role="status" aria-live="polite" className="outline-none">
        {status === "completed" && (justCompleted || isLast) ? (
          <Notice
            tone="success"
            title={t.completedTitle}
            actions={
              <>
                <Button href="/learn/practice">{t.practise}</Button>
                <Button variant="secondary" leadingIcon={<RotateCcw />} onClick={restart}>
                  {t.restart}
                </Button>
              </>
            }
          >
            {fill(t.completedBody, { lesson: lesson.title[locale] })}
          </Notice>
        ) : null}
      </div>
    </div>
  );
}
