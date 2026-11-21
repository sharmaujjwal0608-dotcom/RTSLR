"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Badge, Button, Notice, Section } from "@/components/ui";
import { LESSONS, categoryHref, getSign, isCategoryId, signHref, type Lesson } from "@/features/learning/content";
import { completedLessonCount, lessonAnchor, lessonStatus } from "@/features/learning/lessons";
import { LEARNING_STORAGE_KEYS, computeStreak } from "@/features/learning/progressStore";
import { addDays, summarizeCards } from "@/features/learning/srs";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { LearnNav, StorageNotice, fill, useCategoryTitle, useSignWords, useToday } from "./shared";

const messages = defineMessages({
  en: {
    title: "Your progress",
    lead: "Everything here is stored only in this browser. It records what you studied and how you rated yourself; it is not a measure of signing ability.",
    summary: "Summary",
    lessonsDone: "Lessons completed",
    ofTotal: "{done} of {total}",
    signsRated: "Signs self-rated",
    ratedDetail: "{got} “Got it”, {need} “Need practice”",
    dueToday: "Due for review today",
    quizzesTaken: "Quizzes taken",
    currentStreak: "Current streak",
    longestStreak: "Longest streak",
    days: "{count} days",
    oneDay: "1 day",
    streakTitle: "Last 14 days",
    streakHint: "A filled square is a day with a lesson step, a self-rating or a quiz.",
    active: "practised",
    inactive: "no activity",
    todayTag: "today",
    lessonsTitle: "Lessons",
    noLessons: "No lesson started yet.",
    startLesson: "Browse lessons",
    inProgress: "In progress: item {index} of {total}",
    completed: "Completed",
    saved: "Saved",
    quizTitle: "Quiz history",
    noQuizzes: "No quiz taken yet.",
    takeQuiz: "Take a meaning quiz",
    colDate: "Date",
    colDirection: "Direction",
    colCategory: "Words from",
    colScore: "Score",
    enHi: "English to Hindi",
    hiEn: "Hindi to English",
    allCategories: "All categories",
    score: "{correct} of {total}",
    quizTableLabel: "Quiz history table",
    favouritesTitle: "Favourite signs",
    noFavourites: "No favourites yet. Choose “Add favourite” on any sign.",
    dataTitle: "Your data",
    dataBody: "Learning progress is kept in this browser's local storage under the key shown below. It is never sent to a server.",
    exportAction: "Export progress as JSON",
    exported: "Progress exported as a JSON file.",
    exportFailed: "The browser could not create the file. Your progress is unchanged.",
    resetAction: "Reset learning progress",
    resetTitle: "Delete all learning progress?",
    resetBody:
      "This deletes favourites, saved lessons, lesson positions, self-ratings, quiz history and your streak from this browser. It cannot be undone. Export first if you want a copy.",
    resetConfirm: "Delete all learning progress",
    cancel: "Cancel",
    resetDone: "Learning progress deleted.",
  },
  hi: {
    title: "आपकी प्रगति",
    lead: "यहाँ की हर चीज़ केवल इसी ब्राउज़र में सहेजी जाती है। इसमें दर्ज है कि आपने क्या पढ़ा और खुद को कैसे आँका; यह संकेत करने की क्षमता का माप नहीं है।",
    summary: "सारांश",
    lessonsDone: "पूरे किए गए पाठ",
    ofTotal: "{total} में से {done}",
    signsRated: "स्वयं आँके गए संकेत",
    ratedDetail: "{got} “आ गया”, {need} “और अभ्यास चाहिए”",
    dueToday: "आज दोहराने के लिए",
    quizzesTaken: "दिए गए क्विज़",
    currentStreak: "मौजूदा सिलसिला",
    longestStreak: "सबसे लंबा सिलसिला",
    days: "{count} दिन",
    oneDay: "1 दिन",
    streakTitle: "पिछले 14 दिन",
    streakHint: "भरा हुआ खाना वह दिन है जब आपने पाठ का कोई चरण, स्वयं-रेटिंग या क्विज़ किया।",
    active: "अभ्यास किया",
    inactive: "कोई गतिविधि नहीं",
    todayTag: "आज",
    lessonsTitle: "पाठ",
    noLessons: "अभी कोई पाठ शुरू नहीं हुआ।",
    startLesson: "पाठ देखें",
    inProgress: "जारी है: {total} में से आइटम {index}",
    completed: "पूरा हुआ",
    saved: "सहेजा गया",
    quizTitle: "क्विज़ इतिहास",
    noQuizzes: "अभी कोई क्विज़ नहीं दिया गया।",
    takeQuiz: "अर्थ क्विज़ दें",
    colDate: "तारीख़",
    colDirection: "दिशा",
    colCategory: "शब्द किस श्रेणी से",
    colScore: "अंक",
    enHi: "अंग्रेज़ी से हिंदी",
    hiEn: "हिंदी से अंग्रेज़ी",
    allCategories: "सभी श्रेणियाँ",
    score: "{total} में से {correct}",
    quizTableLabel: "क्विज़ इतिहास तालिका",
    favouritesTitle: "पसंदीदा संकेत",
    noFavourites: "अभी कोई पसंदीदा नहीं है। किसी भी संकेत पर “पसंदीदा में जोड़ें” चुनें।",
    dataTitle: "आपका डेटा",
    dataBody: "सीखने की प्रगति इस ब्राउज़र के लोकल स्टोरेज में नीचे दी गई कुंजी के अंतर्गत रखी जाती है। इसे कभी किसी सर्वर पर नहीं भेजा जाता।",
    exportAction: "प्रगति JSON के रूप में निर्यात करें",
    exported: "प्रगति JSON फ़ाइल के रूप में निर्यात की गई।",
    exportFailed: "ब्राउज़र फ़ाइल नहीं बना सका। आपकी प्रगति जस की तस है।",
    resetAction: "सीखने की प्रगति रीसेट करें",
    resetTitle: "सीखने की सारी प्रगति हटाएँ?",
    resetBody:
      "इससे इस ब्राउज़र से पसंदीदा, सहेजे गए पाठ, पाठों की स्थिति, स्वयं-रेटिंग, क्विज़ इतिहास और आपका सिलसिला हट जाएगा। इसे वापस नहीं लाया जा सकता। प्रति चाहिए तो पहले निर्यात करें।",
    resetConfirm: "सीखने की सारी प्रगति हटाएँ",
    cancel: "रद्द करें",
    resetDone: "सीखने की प्रगति हटा दी गई।",
  },
});

const linkClass =
  "font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink";

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="flex flex-col sm:items-end">
        <span className="text-h3 text-ink">{value}</span>
        {detail ? <span className="text-caption text-muted">{detail}</span> : null}
      </dd>
    </div>
  );
}

/** Saves text as a file from memory. The data never leaves the browser. */
function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ProgressDashboard() {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { ready, state, store } = useProgress();
  const today = useToday();
  const categoryTitle = useCategoryTitle();
  const signWords = useSignWords();
  const headingId = useId();
  const resetButtonRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const dayLabel = (count: number) => (count === 1 ? t.oneDay : fill(t.days, { count }));
  const cards = summarizeCards(state.cards, today || "0000-00-00");
  const streak = computeStreak(state.activeDays, today || "0000-00-00");
  const dateFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN-u-nu-latn" : "en-IN", { dateStyle: "medium" });
  const weekdayFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "short" });

  const lastDays = today ? Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)) : [];
  const activeSet = new Set(state.activeDays);
  const toDate = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const touchedLessons: Lesson[] = LESSONS.filter(
    (lesson) => lessonStatus(lesson, state).status !== "not-started" || state.savedLessons.includes(lesson.id),
  );
  const favourites = state.favourites.flatMap((id) => {
    const sign = getSign(id);
    return sign ? [sign] : [];
  });

  const exportProgress = () => {
    try {
      downloadText(`rtslr-learning-progress-${today || "export"}.json`, store.exportJson());
      setStatus({ tone: "success", text: t.exported });
    } catch {
      setStatus({ tone: "danger", text: t.exportFailed });
    }
  };

  const reset = () => {
    store.reset();
    setConfirming(false);
    setStatus({ tone: "success", text: t.resetDone });
    requestAnimationFrame(() => resetButtonRef.current?.querySelector<HTMLElement>("button")?.focus());
  };

  return (
    <>
      <Section titleAs="h1" spacing="tight" title={t.title} lead={t.lead}>
        <div className="flex flex-col gap-8">
          <LearnNav current="progress" />
          <StorageNotice linkToProgress={false} />

          <div className="grid gap-12 lg:grid-cols-12">
            <section aria-labelledby={`${headingId}-summary`} className="lg:col-span-5">
              <h2 id={`${headingId}-summary`} className="text-h3 text-ink">
                {t.summary}
              </h2>
              <dl className="mt-4 divide-y divide-line border-y border-line">
                <Row
                  label={t.lessonsDone}
                  value={fill(t.ofTotal, { done: completedLessonCount(state), total: LESSONS.length })}
                />
                <Row
                  label={t.signsRated}
                  value={String(cards.rated)}
                  detail={cards.rated > 0 ? fill(t.ratedDetail, { got: cards.gotIt, need: cards.needPractice }) : undefined}
                />
                <Row label={t.dueToday} value={String(ready && today ? cards.dueToday : 0)} />
                <Row label={t.quizzesTaken} value={String(state.quizzes.length)} />
                <Row label={t.currentStreak} value={dayLabel(streak.current)} />
                <Row label={t.longestStreak} value={dayLabel(streak.longest)} />
              </dl>
            </section>

            <div className="flex flex-col gap-12 lg:col-span-7">
              <section aria-labelledby={`${headingId}-streak`} className="flex flex-col gap-4">
                <h2 id={`${headingId}-streak`} className="text-h3 text-ink">
                  {t.streakTitle}
                </h2>
                <ol className="grid grid-cols-7 gap-2">
                  {lastDays.map((day) => {
                    const active = activeSet.has(day);
                    const date = toDate(day);
                    return (
                      <li
                        key={day}
                        className={cn(
                          "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-field border px-1 py-2 text-center",
                          active ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-muted",
                          day === today && "outline-2 outline-offset-2 outline-accent",
                        )}
                      >
                        <span className="text-label">{weekdayFormat.format(date)}</span>
                        <span className="font-mono text-small">{date.getDate()}</span>
                        <span className="sr-only">
                          {dateFormat.format(date)}: {active ? t.active : t.inactive}
                          {day === today ? `, ${t.todayTag}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-caption text-muted">{t.streakHint}</p>
              </section>

              <section aria-labelledby={`${headingId}-lessons`} className="flex flex-col gap-4">
                <h2 id={`${headingId}-lessons`} className="text-h3 text-ink">
                  {t.lessonsTitle}
                </h2>
                {touchedLessons.length === 0 ? (
                  <div className="flex flex-col items-start gap-4">
                    <p className="text-body text-muted">{t.noLessons}</p>
                    <Button href="/learn/everyday" variant="secondary">
                      {t.startLesson}
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-line border-y border-line">
                    {touchedLessons.map((lesson) => {
                      const info = lessonStatus(lesson, state);
                      return (
                        <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <Link href={`${categoryHref(lesson.category)}#${lessonAnchor(lesson.id)}`} className={linkClass}>
                            {lesson.title[locale]}
                          </Link>
                          <span className="flex flex-wrap gap-2">
                            {state.savedLessons.includes(lesson.id) ? <Badge plain>{t.saved}</Badge> : null}
                            {info.status === "completed" ? (
                              <Badge tone="success">{t.completed}</Badge>
                            ) : info.status === "in-progress" ? (
                              <Badge tone="info">
                                {fill(t.inProgress, { index: info.index + 1, total: info.total })}
                              </Badge>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby={`${headingId}-quiz`} className="flex flex-col gap-4">
                <h2 id={`${headingId}-quiz`} className="text-h3 text-ink">
                  {t.quizTitle}
                </h2>
                {state.quizzes.length === 0 ? (
                  <div className="flex flex-col items-start gap-4">
                    <p className="text-body text-muted">{t.noQuizzes}</p>
                    <Button href="/learn/practice" variant="secondary">
                      {t.takeQuiz}
                    </Button>
                  </div>
                ) : (
                  <div
                    role="region"
                    aria-label={t.quizTableLabel}
                    tabIndex={0}
                    className="overflow-x-auto rounded-field border border-line"
                  >
                    <table className="w-full min-w-max border-collapse text-left text-small">
                      <thead>
                        <tr className="border-b border-line bg-background-secondary">
                          {[t.colDate, t.colDirection, t.colCategory, t.colScore].map((heading) => (
                            <th key={heading} scope="col" className="px-4 py-3 font-semibold text-ink">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {state.quizzes.map((quiz) => (
                          <tr key={quiz.at}>
                            <td className="px-4 py-3 text-ink">{dateFormat.format(new Date(quiz.at))}</td>
                            <td className="px-4 py-3 text-muted">{quiz.direction === "en-hi" ? t.enHi : t.hiEn}</td>
                            <td className="px-4 py-3 text-muted">
                              {isCategoryId(quiz.category) ? categoryTitle(quiz.category) : t.allCategories}
                            </td>
                            <td className="px-4 py-3 font-mono text-ink">
                              {fill(t.score, { correct: quiz.correct, total: quiz.total })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby={`${headingId}-fav`} className="flex flex-col gap-4">
                <h2 id={`${headingId}-fav`} className="text-h3 text-ink">
                  {t.favouritesTitle}
                </h2>
                {favourites.length === 0 ? (
                  <p className="text-body text-muted">{t.noFavourites}</p>
                ) : (
                  <ul className="flex flex-wrap gap-x-6 gap-y-1">
                    {favourites.map((sign) => {
                      const words = signWords(sign);
                      return (
                        <li key={sign.id}>
                          <Link href={signHref(sign.id)} className={cn(linkClass, "inline-flex min-h-11 items-center")}>
                            <span lang={words.primaryLang}>{words.primary}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="secondary" spacing="tight" title={t.dataTitle} lead={t.dataBody}>
        <div className="flex flex-col gap-6">
          <p className="font-mono text-label break-all text-ink">{LEARNING_STORAGE_KEYS.progress}</p>
          <div ref={resetButtonRef} className="flex flex-wrap gap-3">
            <Button variant="secondary" leadingIcon={<Download />} onClick={exportProgress}>
              {t.exportAction}
            </Button>
            {confirming ? null : (
              <Button
                variant="ghost"
                leadingIcon={<Trash2 />}
                onClick={() => {
                  setStatus(null);
                  setConfirming(true);
                  requestAnimationFrame(() => confirmRef.current?.focus());
                }}
              >
                {t.resetAction}
              </Button>
            )}
          </div>

          {confirming ? (
            <div ref={confirmRef} tabIndex={-1} className="max-w-reading outline-none">
              <Notice
                tone="danger"
                title={t.resetTitle}
                actions={
                  <>
                    <Button leadingIcon={<Trash2 />} onClick={reset}>
                      {t.resetConfirm}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(false)}>
                      {t.cancel}
                    </Button>
                  </>
                }
              >
                {t.resetBody}
              </Notice>
            </div>
          ) : null}

          <div role="status" aria-live="polite" className="max-w-reading">
            {status ? (
              <Notice tone={status.tone} compact>
                {status.text}
              </Notice>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}
