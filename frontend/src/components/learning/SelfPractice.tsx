"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Notice, Select } from "@/components/ui";
import { CATEGORIES, SIGNS, getSign, type CategoryId } from "@/features/learning/content";
import {
  BOX_INTERVAL_DAYS,
  advanceQueue,
  buildQueue,
  type QueueEntry,
  type SelfRating,
} from "@/features/learning/srs";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { SignMedia } from "./SignMedia";
import { fill, useSignWords, useToday } from "./shared";

const messages = defineMessages({
  en: {
    intro:
      "You see a word. Look the sign up in the official dictionary, make it yourself, then say honestly how it went. Words you mark “Need practice” come back sooner; words you mark “Got it” come back after a longer gap.",
    selfTitle: "You are the judge",
    selfBody:
      "RTSLR cannot see or assess your signing here. Your rating is your own judgement, and it only decides when a word is shown again.",
    category: "Words from",
    allCategories: "All categories",
    queueStatus: "{due} due for review today, {fresh} not practised yet",
    start: "Start practice session",
    nothing: "Nothing is due in this selection today and every word has been rated. Choose another category or come back tomorrow.",
    step: "{left} left in this session",
    due: "Due for review",
    fresh: "New word",
    prompt: "Make the sign for this word",
    gotIt: "Got it",
    needPractice: "Need practice",
    savedToday: "Saved “{word}”. It will come back later in this session or today.",
    savedLater: "Saved “{word}”. Next review in {days} days.",
    savedTomorrow: "Saved “{word}”. Next review tomorrow.",
    doneTitle: "Session finished",
    doneBody: "You rated {count} words: {got} “Got it”, {need} “Need practice”.",
    again: "Start another session",
    end: "End session",
  },
  hi: {
    intro:
      "आपको एक शब्द दिखेगा। उसका संकेत आधिकारिक शब्दकोश में देखें, खुद बनाएँ, फिर ईमानदारी से बताएँ कि कैसा रहा। जिन शब्दों पर आप “और अभ्यास चाहिए” चुनते हैं वे जल्दी लौटते हैं; जिन पर “आ गया” चुनते हैं वे ज़्यादा अंतराल के बाद लौटते हैं।",
    selfTitle: "निर्णय आपका है",
    selfBody:
      "RTSLR यहाँ आपके संकेत न देख सकता है और न आँक सकता है। आपकी रेटिंग आपका अपना आकलन है, और उससे केवल यह तय होता है कि शब्द दोबारा कब दिखेगा।",
    category: "शब्द किस श्रेणी से",
    allCategories: "सभी श्रेणियाँ",
    queueStatus: "आज दोहराने के लिए {due}, अभी तक अभ्यास नहीं किए गए {fresh}",
    start: "अभ्यास सत्र शुरू करें",
    nothing: "इस चयन में आज कुछ बाकी नहीं है और हर शब्द आँका जा चुका है। कोई दूसरी श्रेणी चुनें या कल वापस आएँ।",
    step: "इस सत्र में {left} बाकी",
    due: "दोहराने के लिए",
    fresh: "नया शब्द",
    prompt: "इस शब्द का संकेत बनाएँ",
    gotIt: "आ गया",
    needPractice: "और अभ्यास चाहिए",
    savedToday: "“{word}” सहेजा गया। यह इसी सत्र में या आज फिर आएगा।",
    savedLater: "“{word}” सहेजा गया। अगली बार {days} दिन बाद।",
    savedTomorrow: "“{word}” सहेजा गया। अगली बार कल।",
    doneTitle: "सत्र पूरा हुआ",
    doneBody: "आपने {count} शब्द आँके: {got} “आ गया”, {need} “और अभ्यास चाहिए”।",
    again: "एक और सत्र शुरू करें",
    end: "सत्र समाप्त करें",
  },
});

type Session = { queue: QueueEntry[]; got: number; need: number; lastMessage: string };

export function SelfPractice() {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { state, store } = useProgress();
  const today = useToday();
  const signWords = useSignWords();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [session, setSession] = useState<Session | null>(null);

  const ids = useMemo(
    () => SIGNS.filter((sign) => category === "all" || sign.category === category).map((sign) => sign.id),
    [category],
  );
  // The preview counts everything; the session itself is capped by buildQueue.
  const preview = today ? buildQueue(ids, state.cards, today, { limit: ids.length, newLimit: ids.length }) : [];
  const dueCount = preview.filter((entry) => entry.reason === "due").length;
  const freshCount = preview.length - dueCount;

  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());

  const start = () => {
    if (!today) return;
    setSession({ queue: buildQueue(ids, state.cards, today), got: 0, need: 0, lastMessage: "" });
    focusHeading();
  };

  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        <p className="max-w-reading text-body text-muted">{t.intro}</p>
        <Notice tone="info" title={t.selfTitle} className="max-w-reading">
          {t.selfBody}
        </Notice>
        <Select
          label={t.category}
          className="sm:max-w-xs"
          value={category}
          onChange={(event) => setCategory(event.target.value as CategoryId | "all")}
          options={[
            { value: "all", label: t.allCategories },
            ...CATEGORIES.map((entry) => ({ value: entry.id, label: entry.title[locale] })),
          ]}
        />
        <p role="status" aria-live="polite" className="text-small font-semibold text-ink">
          {today ? fill(t.queueStatus, { due: dueCount, fresh: freshCount }) : null}
        </p>
        {today && preview.length === 0 ? (
          <Notice tone="neutral">{t.nothing}</Notice>
        ) : (
          <div>
            <Button size="lg" icon={<ArrowRight />} onClick={start}>
              {t.start}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const head = session.queue[0];
  const sign = head ? getSign(head.signId) : undefined;

  if (!head || !sign) {
    return (
      <div className="flex flex-col gap-6">
        <h3 ref={headingRef} tabIndex={-1} className="text-h2 text-ink outline-none">
          {t.doneTitle}
        </h3>
        <p className="text-body text-muted">
          {fill(t.doneBody, { count: session.got + session.need, got: session.got, need: session.need })}
        </p>
        <div>
          <Button leadingIcon={<RotateCcw />} onClick={() => setSession(null)}>
            {t.again}
          </Button>
        </div>
      </div>
    );
  }

  const words = signWords(sign);

  const rate = (rating: SelfRating) => {
    const card = store.rateSign(sign.id, rating);
    const days = BOX_INTERVAL_DAYS[card.box];
    const template = days === 0 ? t.savedToday : days === 1 ? t.savedTomorrow : t.savedLater;
    setSession({
      queue: advanceQueue(session.queue, rating),
      got: session.got + (rating === "got-it" ? 1 : 0),
      need: session.need + (rating === "need-practice" ? 1 : 0),
      lastMessage: fill(template, { word: sign.en, days }),
    });
    focusHeading();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-label text-muted">{fill(t.step, { left: session.queue.length })}</p>
        <Badge tone={head.reason === "due" ? "info" : "neutral"}>{head.reason === "due" ? t.due : t.fresh}</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-small font-semibold text-muted">{t.prompt}</p>
        <h3 ref={headingRef} tabIndex={-1} lang={words.primaryLang} className="text-h1 break-words text-ink outline-none">
          {words.primary}
        </h3>
        {words.secondary ? (
          <p lang={words.secondaryLang} className="text-lead text-muted">
            {words.secondary}
          </p>
        ) : null}
      </div>

      <SignMedia sign={sign} headingAs="h4" showWord={false} />

      <div className="flex flex-wrap gap-3">
        <Button size="lg" leadingIcon={<Check />} onClick={() => rate("got-it")}>
          {t.gotIt}
        </Button>
        <Button size="lg" variant="secondary" leadingIcon={<RotateCcw />} onClick={() => rate("need-practice")}>
          {t.needPractice}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => setSession(null)}>
          {t.end}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-small text-muted">
        {session.lastMessage}
      </p>
    </div>
  );
}
