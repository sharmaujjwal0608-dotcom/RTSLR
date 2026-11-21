"use client";

import { ArrowRight, Bookmark, X } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Badge, Button, Input, Notice, Section, Select, Tabs, VisuallyHidden } from "@/components/ui";
import {
  CATEGORIES,
  LESSONS,
  SIGNS,
  categoryHref,
  getSign,
  type CategoryId,
  type Lesson,
} from "@/features/learning/content";
import { completedLessonCount, lessonAnchor, lessonStatus, lessonToContinue } from "@/features/learning/lessons";
import { computeStreak } from "@/features/learning/progressStore";
import { countByCategory, filterSigns } from "@/features/learning/search";
import { summarizeCards } from "@/features/learning/srs";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { SignCard } from "./SignCard";
import { LearnNav, StorageNotice, fill, useCategoryTitle, useToday } from "./shared";

const messages = defineMessages({
  en: {
    title: "Learn ISL vocabulary",
    lead: "Browse {count} everyday words, letters and numbers with their English and Hindi meanings, work through short lessons, and practise recalling them.",
    honestyTitle: "No sign demonstrations yet",
    honestyBody:
      "RTSLR has no licensed, verified images or videos of ISL signs, so these pages do not show or describe how any sign is made. Each word links to the official ISLRTC dictionary instead. Demonstrations will appear here once a verified source is in place.",
    continueTitle: "Continue where you left off",
    continueBody: "{lesson}: item {index} of {total}",
    continueAction: "Resume lesson",
    search: "Search signs",
    searchHint: "Type in English or Hindi, for example “water” or “पानी”.",
    clearSearch: "Clear search",
    category: "Category",
    allCategories: "All categories",
    progressTitle: "Your progress",
    lessonsDone: "Lessons completed",
    ofTotal: "{done} of {total}",
    signsRated: "Signs self-rated",
    streak: "Current streak",
    days: "{count} days",
    oneDay: "1 day",
    seeProgress: "See all progress",
    viewLabel: "What to browse",
    tabSigns: "Signs",
    tabLessons: "Lessons",
    tabFavourites: "Favourites",
    resultCount: "{count} signs",
    resultOne: "1 sign",
    noResultsTitle: "No sign matches “{query}”",
    noResultsBody: "Check the spelling, try the other language, or clear the search to see every sign.",
    noCategoryFavourites: "No favourites in this category.",
    noFavouritesTitle: "No favourites yet",
    noFavouritesBody: "Choose “Add favourite” on any sign to keep it here for quick review.",
    items: "{count} items",
    notStarted: "Not started",
    inProgress: "In progress: item {index} of {total}",
    completed: "Completed",
    openLesson: "Open lesson",
    saveLesson: "Save lesson",
    unsaveLesson: "Remove from saved",
    practiceTitle: "Ready to practise?",
    practiceBody: "Test your recall of meanings, rate yourself on signs you have looked up, or read what camera practice in the Studio can and cannot tell you.",
    practiceAction: "Go to practice",
  },
  hi: {
    title: "ISL शब्दावली सीखें",
    lead: "रोज़मर्रा के {count} शब्द, अक्षर और संख्याएँ उनके अंग्रेज़ी और हिंदी अर्थ के साथ देखें, छोटे पाठ पूरे करें और उन्हें याद करने का अभ्यास करें।",
    honestyTitle: "संकेतों के प्रदर्शन अभी उपलब्ध नहीं हैं",
    honestyBody:
      "RTSLR के पास ISL संकेतों की लाइसेंस-प्राप्त, सत्यापित तस्वीरें या वीडियो नहीं हैं, इसलिए ये पन्ने न यह दिखाते हैं और न बताते हैं कि कोई संकेत कैसे बनाया जाता है। इसकी जगह हर शब्द के साथ आधिकारिक ISLRTC शब्दकोश का लिंक है। सत्यापित स्रोत मिलने पर प्रदर्शन यहाँ दिखेंगे।",
    continueTitle: "जहाँ छोड़ा था वहीं से जारी रखें",
    continueBody: "{lesson}: {total} में से आइटम {index}",
    continueAction: "पाठ जारी रखें",
    search: "संकेत खोजें",
    searchHint: "अंग्रेज़ी या हिंदी में लिखें, जैसे “water” या “पानी”।",
    clearSearch: "खोज साफ़ करें",
    category: "श्रेणी",
    allCategories: "सभी श्रेणियाँ",
    progressTitle: "आपकी प्रगति",
    lessonsDone: "पूरे किए गए पाठ",
    ofTotal: "{total} में से {done}",
    signsRated: "स्वयं आँके गए संकेत",
    streak: "मौजूदा सिलसिला",
    days: "{count} दिन",
    oneDay: "1 दिन",
    seeProgress: "पूरी प्रगति देखें",
    viewLabel: "क्या देखना है",
    tabSigns: "संकेत",
    tabLessons: "पाठ",
    tabFavourites: "पसंदीदा",
    resultCount: "{count} संकेत",
    resultOne: "1 संकेत",
    noResultsTitle: "“{query}” से कोई संकेत नहीं मिला",
    noResultsBody: "वर्तनी जाँचें, दूसरी भाषा में लिखकर देखें, या सभी संकेत देखने के लिए खोज साफ़ करें।",
    noCategoryFavourites: "इस श्रेणी में कोई पसंदीदा नहीं है।",
    noFavouritesTitle: "अभी कोई पसंदीदा नहीं है",
    noFavouritesBody: "किसी भी संकेत पर “पसंदीदा में जोड़ें” चुनें, ताकि वह जल्दी दोहराने के लिए यहाँ रहे।",
    items: "{count} आइटम",
    notStarted: "शुरू नहीं हुआ",
    inProgress: "जारी है: {total} में से आइटम {index}",
    completed: "पूरा हुआ",
    openLesson: "पाठ खोलें",
    saveLesson: "पाठ सहेजें",
    unsaveLesson: "सहेजे गए से हटाएँ",
    practiceTitle: "अभ्यास के लिए तैयार हैं?",
    practiceBody: "अर्थ याद हैं या नहीं यह परखें, जिन संकेतों को आपने देखा है उन पर खुद को आँकें, या पढ़ें कि स्टूडियो में कैमरे से अभ्यास आपको क्या बता सकता है और क्या नहीं।",
    practiceAction: "अभ्यास पर जाएँ",
  },
});

type CategoryFilter = CategoryId | "all";

export function LearnOverview() {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const categoryTitle = useCategoryTitle();
  const { ready, state, store } = useProgress();
  const today = useToday();
  const groupId = useId();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const favourites = useMemo(() => new Set(state.favourites), [state.favourites]);
  const results = useMemo(() => filterSigns(SIGNS, { query, category }), [query, category]);
  const counts = useMemo(() => countByCategory(SIGNS, { query }), [query]);
  const favouriteSigns = useMemo(
    () => filterSigns(SIGNS, { query, category, favouritesOnly: true, favourites }),
    [query, category, favourites],
  );
  const lessons = category === "all" ? LESSONS : LESSONS.filter((lesson) => lesson.category === category);

  const resume = ready ? lessonToContinue(state) : undefined;
  const resumeStatus = resume ? lessonStatus(resume, state) : undefined;
  const streak = today ? computeStreak(state.activeDays, today).current : 0;
  const rated = today ? summarizeCards(state.cards, today).rated : 0;

  const countLabel = (count: number) => (count === 1 ? t.resultOne : fill(t.resultCount, { count }));
  const dayLabel = (count: number) => (count === 1 ? t.oneDay : fill(t.days, { count }));
  const filterOptions: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: t.allCategories },
    ...CATEGORIES.map((entry) => ({ id: entry.id, label: entry.title[locale] })),
  ];

  const emptySearch = (
    <Notice
      tone="neutral"
      title={fill(t.noResultsTitle, { query: query.trim() })}
      actions={
        <Button variant="secondary" leadingIcon={<X />} onClick={() => setQuery("")}>
          {t.clearSearch}
        </Button>
      }
    >
      {t.noResultsBody}
    </Notice>
  );

  const signsPanel = (
    <div className="flex flex-col gap-6">
      <p role="status" aria-live="polite" className="text-small font-semibold text-muted">
        {countLabel(results.length)}
      </p>
      {results.length === 0 ? (
        emptySearch
      ) : (
        <ul className="grid border-t border-line md:grid-cols-2 md:gap-5 md:border-t-0 xl:grid-cols-3">
          {results.map((sign) => (
            <SignCard key={sign.id} sign={sign} />
          ))}
        </ul>
      )}
    </div>
  );

  const lessonRow = (lesson: Lesson) => {
    const status = lessonStatus(lesson, state);
    const saved = state.savedLessons.includes(lesson.id);
    const title = lesson.title[locale];
    return (
      <li key={lesson.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-h4 text-ink">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge plain>{categoryTitle(lesson.category)}</Badge>
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
            {saved ? t.unsaveLesson : t.saveLesson}
            <VisuallyHidden>: {title}</VisuallyHidden>
          </Button>
          <Button
            variant="secondary"
            href={`${categoryHref(lesson.category)}#${lessonAnchor(lesson.id)}`}
            icon={<ArrowRight />}
          >
            {t.openLesson}
            <VisuallyHidden>: {title}</VisuallyHidden>
          </Button>
        </div>
      </li>
    );
  };

  const favouritesPanel =
    state.favourites.filter((id) => getSign(id)).length === 0 ? (
      <Notice tone="neutral" title={t.noFavouritesTitle}>
        {t.noFavouritesBody}
      </Notice>
    ) : favouriteSigns.length === 0 ? (
      query.trim() ? (
        emptySearch
      ) : (
        <p className="text-body text-muted">{t.noCategoryFavourites}</p>
      )
    ) : (
      <ul className="grid border-t border-line md:grid-cols-2 md:gap-5 md:border-t-0 xl:grid-cols-3">
        {favouriteSigns.map((sign) => (
          <SignCard key={sign.id} sign={sign} />
        ))}
      </ul>
    );

  return (
    <>
      <Section titleAs="h1" spacing="tight" title={t.title} lead={fill(t.lead, { count: SIGNS.length })}>
        <div className="flex flex-col gap-8">
          <LearnNav current="overview" />
          <Notice tone="warning" title={t.honestyTitle}>
            {t.honestyBody}
          </Notice>
          <StorageNotice />

          {resume && resumeStatus ? (
            <div className="flex flex-col gap-4 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-h4 text-ink">{t.continueTitle}</h2>
                <p className="text-small text-muted">
                  {fill(t.continueBody, {
                    lesson: resume.title[locale],
                    index: resumeStatus.index + 1,
                    total: resumeStatus.total,
                  })}
                </p>
              </div>
              <Button href={`${categoryHref(resume.category)}#${lessonAnchor(resume.id)}`} icon={<ArrowRight />}>
                {t.continueAction}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <Input
              type="search"
              label={t.search}
              hint={t.searchHint}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="md:max-w-xl md:flex-1"
            />
            {/* Below lg the rail is replaced by this picker. */}
            <Select
              label={t.category}
              className="md:w-64 lg:hidden"
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
              options={filterOptions.map((option) => ({
                value: option.id,
                label: `${option.label} (${counts[option.id]})`,
              }))}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <aside className="hidden flex-col gap-8 lg:sticky lg:top-header lg:col-span-3 lg:flex lg:self-start lg:pt-6">
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-3 text-small font-semibold text-ink">{t.category}</legend>
                {filterOptions.map((option) => {
                  const selected = option.id === category;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 border-l-2 pr-2 pl-3 text-small transition-colors duration-200 ease-calm",
                        selected ? "border-ink font-semibold text-ink" : "border-line text-muted hover:text-ink",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${groupId}-category`}
                        value={option.id}
                        checked={selected}
                        onChange={() => setCategory(option.id)}
                        className="size-4 shrink-0 accent-ink"
                      />
                      <span className="min-w-0 flex-1 break-words">{option.label}</span>
                      <span className="font-mono text-label text-muted">{counts[option.id]}</span>
                    </label>
                  );
                })}
              </fieldset>

              <section aria-labelledby={`${groupId}-progress`} className="flex flex-col gap-3 border-t border-line pt-6">
                <h2 id={`${groupId}-progress`} className="text-small font-semibold text-ink">
                  {t.progressTitle}
                </h2>
                <dl className="flex flex-col gap-2 text-small">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{t.lessonsDone}</dt>
                    <dd className="font-semibold text-ink">
                      {fill(t.ofTotal, { done: completedLessonCount(state), total: LESSONS.length })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{t.signsRated}</dt>
                    <dd className="font-semibold text-ink">{rated}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{t.streak}</dt>
                    <dd className="font-semibold text-ink">{dayLabel(streak)}</dd>
                  </div>
                </dl>
                <Link
                  href="/learn/progress"
                  className="self-start text-small font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  {t.seeProgress}
                </Link>
              </section>
            </aside>

            <div className="min-w-0 lg:col-span-9">
              <Tabs
                variant="underline"
                label={t.viewLabel}
                items={[
                  { id: "signs", label: t.tabSigns, content: signsPanel },
                  {
                    id: "lessons",
                    label: t.tabLessons,
                    content: <ul className="divide-y divide-line border-y border-line">{lessons.map(lessonRow)}</ul>,
                  },
                  { id: "favourites", label: t.tabFavourites, content: favouritesPanel },
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="secondary" spacing="tight" title={t.practiceTitle} lead={t.practiceBody}>
        <Button href="/learn/practice" size="lg" icon={<ArrowRight />}>
          {t.practiceAction}
        </Button>
      </Section>
    </>
  );
}
