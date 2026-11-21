"use client";

import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Container, ExternalLink, Heading, Notice } from "@/components/ui";
import {
  categoryHref,
  getSign,
  lessonForSign,
  signHref,
  signsInCategory,
} from "@/features/learning/content";
import { lessonAnchor } from "@/features/learning/lessons";
import { BOX_INTERVAL_DAYS, type SelfRating } from "@/features/learning/srs";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { SignMedia } from "./SignMedia";
import {
  FavouriteButton,
  LearnNav,
  SourceBadge,
  StorageNotice,
  fill,
  useCategoryTitle,
  useKindLabel,
  useSignWords,
} from "./shared";

const messages = defineMessages({
  en: {
    back: "All signs",
    details: "Details",
    english: "English",
    hindi: "Hindi",
    hindiPending: "Hindi wording is pending review by a native reader.",
    type: "Type",
    category: "Category",
    lesson: "Lesson",
    demonstration: "Demonstration",
    demoPending: "None yet. Pending a verified source.",
    demoVerified: "Shown above, from a verified source.",
    recognition: "Automatic recognition",
    recognitionNone: "None. RTSLR has no validated ISL model, so it cannot check this sign.",
    sourceTitle: "Where to look this sign up",
    sourceVerified: "The official dictionary of the Indian Sign Language Research and Training Centre (ISLRTC).",
    sourceUnverified:
      "The official dictionary is published by the Indian Sign Language Research and Training Centre (ISLRTC). We opened the ISLRTC website and it links to the dictionary, but the dictionary pages themselves could not be opened from our network, so this link is not verified.",
    sourceLink: "ISLRTC website",
    newTab: "opens in a new tab",
    rateTitle: "Rate yourself",
    rateBody:
      "After you have looked the sign up and tried it, record how it went. This is your own judgement; RTSLR cannot check your signing.",
    gotIt: "Got it",
    needPractice: "Need practice",
    lastRating: "Your last rating: {rating}. Next review: {due}.",
    savedToday: "Saved. It is due for practice again today.",
    savedTomorrow: "Saved. Next review tomorrow.",
    savedLater: "Saved. Next review in {days} days.",
    previous: "Previous: {word}",
    next: "Next: {word}",
    siblings: "More in this category",
  },
  hi: {
    back: "सभी संकेत",
    details: "विवरण",
    english: "अंग्रेज़ी",
    hindi: "हिंदी",
    hindiPending: "हिंदी शब्द की समीक्षा किसी मूल भाषी पाठक द्वारा होनी बाकी है।",
    type: "प्रकार",
    category: "श्रेणी",
    lesson: "पाठ",
    demonstration: "प्रदर्शन",
    demoPending: "अभी नहीं। सत्यापित स्रोत मिलने तक लंबित।",
    demoVerified: "ऊपर दिखाया गया है, सत्यापित स्रोत से।",
    recognition: "स्वचालित पहचान",
    recognitionNone: "नहीं। RTSLR के पास कोई प्रमाणित ISL मॉडल नहीं है, इसलिए वह इस संकेत की जाँच नहीं कर सकता।",
    sourceTitle: "यह संकेत कहाँ देखें",
    sourceVerified: "भारतीय सांकेतिक भाषा अनुसंधान एवं प्रशिक्षण केंद्र (ISLRTC) का आधिकारिक शब्दकोश।",
    sourceUnverified:
      "आधिकारिक शब्दकोश भारतीय सांकेतिक भाषा अनुसंधान एवं प्रशिक्षण केंद्र (ISLRTC) प्रकाशित करता है। हमने ISLRTC की वेबसाइट खोली और वहाँ शब्दकोश का लिंक है, लेकिन शब्दकोश के पन्ने हमारे नेटवर्क से नहीं खुल सके, इसलिए यह लिंक सत्यापित नहीं है।",
    sourceLink: "ISLRTC वेबसाइट",
    newTab: "नए टैब में खुलता है",
    rateTitle: "खुद को आँकें",
    rateBody:
      "संकेत देखने और आज़माने के बाद दर्ज करें कि कैसा रहा। यह आपका अपना आकलन है; RTSLR आपके संकेत की जाँच नहीं कर सकता।",
    gotIt: "आ गया",
    needPractice: "और अभ्यास चाहिए",
    lastRating: "आपकी पिछली रेटिंग: {rating}। अगली बार: {due}।",
    savedToday: "सहेजा गया। यह आज फिर अभ्यास के लिए आएगा।",
    savedTomorrow: "सहेजा गया। अगली बार कल।",
    savedLater: "सहेजा गया। अगली बार {days} दिन बाद।",
    previous: "पिछला: {word}",
    next: "अगला: {word}",
    siblings: "इस श्रेणी में और",
  },
});

const linkClass =
  "font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
      <dt className="text-small font-semibold text-ink">{label}</dt>
      <dd className="text-small text-muted sm:col-span-2">{children}</dd>
    </div>
  );
}

/** `/learn/sign/[id]`: media stage on top, meanings and source below. */
export function SignDetail({ signId }: { signId: string }) {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { ready, state, store } = useProgress();
  const categoryTitle = useCategoryTitle();
  const kindLabel = useKindLabel();
  const signWords = useSignWords();
  const [saved, setSaved] = useState("");

  const sign = getSign(signId);
  if (!sign) return null;

  const words = signWords(sign);
  const lesson = lessonForSign(sign.id);
  const siblings = signsInCategory(sign.category);
  const position = siblings.findIndex((entry) => entry.id === sign.id);
  const previous = position > 0 ? siblings[position - 1] : undefined;
  const next = position < siblings.length - 1 ? siblings[position + 1] : undefined;
  const card = ready && Object.hasOwn(state.cards, sign.id) ? state.cards[sign.id] : undefined;

  const rate = (rating: SelfRating) => {
    const days = BOX_INTERVAL_DAYS[store.rateSign(sign.id, rating).box];
    setSaved(days === 0 ? t.savedToday : days === 1 ? t.savedTomorrow : fill(t.savedLater, { days }));
  };

  return (
    <Container size="narrow" className="flex flex-col gap-10 py-section-tight">
      <div className="flex flex-col gap-6">
        <LearnNav />
        <Link href="/learn" className={`${linkClass} inline-flex min-h-11 items-center gap-2 self-start text-small`}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t.back}
        </Link>
      </div>

      <SignMedia sign={sign} headingAs="h2" />

      <div className="flex max-w-reading flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge plain>{categoryTitle(sign.category)}</Badge>
            <Badge plain>{kindLabel(sign.kind)}</Badge>
            <SourceBadge sign={sign} />
          </div>
          <Heading size="h1" lang={words.primaryLang} className="break-words">
            {words.primary}
          </Heading>
          {words.secondary ? (
            <p lang={words.secondaryLang} className="text-h3 text-muted">
              {words.secondary}
            </p>
          ) : null}
          <FavouriteButton sign={sign} className="-ml-3 self-start" />
        </div>

        <StorageNotice />

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 text-ink">{t.details}</h2>
          <dl className="divide-y divide-line border-y border-line">
            <DetailRow label={t.english}>
              <span lang="en" className="text-ink">
                {sign.en}
              </span>
            </DetailRow>
            <DetailRow label={t.hindi}>
              <span lang="hi" className="text-ink">
                {sign.hi}
              </span>
              {sign.hiReviewed ? null : <span className="block text-caption">{t.hindiPending}</span>}
            </DetailRow>
            <DetailRow label={t.type}>{kindLabel(sign.kind)}</DetailRow>
            <DetailRow label={t.category}>
              <Link href={`${categoryHref(sign.category)}#category-${sign.category}`} className={linkClass}>
                {categoryTitle(sign.category)}
              </Link>
            </DetailRow>
            {lesson ? (
              <DetailRow label={t.lesson}>
                <Link href={`${categoryHref(lesson.category)}#${lessonAnchor(lesson.id)}`} className={linkClass}>
                  {lesson.title[locale]}
                </Link>
              </DetailRow>
            ) : null}
            <DetailRow label={t.demonstration}>{sign.media ? t.demoVerified : t.demoPending}</DetailRow>
            <DetailRow label={t.recognition}>{t.recognitionNone}</DetailRow>
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-ink">{t.sourceTitle}</h2>
          <p className="text-body text-muted">{sign.source.verified ? t.sourceVerified : t.sourceUnverified}</p>
          <p className="text-body">
            <ExternalLink href={sign.source.url} newTabLabel={t.newTab}>
              {t.sourceLink}
            </ExternalLink>
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-h3 text-ink">{t.rateTitle}</h2>
          <p className="text-body text-muted">{t.rateBody}</p>
          <div className="flex flex-wrap gap-3">
            <Button leadingIcon={<Check />} onClick={() => rate("got-it")}>
              {t.gotIt}
            </Button>
            <Button variant="secondary" leadingIcon={<RotateCcw />} onClick={() => rate("need-practice")}>
              {t.needPractice}
            </Button>
          </div>
          <div role="status" aria-live="polite">
            {saved ? (
              <Notice tone="success" compact>
                {saved}
              </Notice>
            ) : null}
          </div>
          {card ? (
            <p className="text-caption text-muted">
              {fill(t.lastRating, {
                rating: card.lastRating === "got-it" ? t.gotIt : t.needPractice,
                due: card.due,
              })}
            </p>
          ) : null}
        </section>

        {previous || next ? (
          <nav aria-label={t.siblings} className="flex flex-wrap justify-between gap-3 border-t border-line pt-6">
            {previous ? (
              <Button variant="secondary" href={signHref(previous.id)} leadingIcon={<ArrowLeft />}>
                {fill(t.previous, { word: previous[locale] })}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="secondary" href={signHref(next.id)} icon={<ArrowRight />}>
                {fill(t.next, { word: next[locale] })}
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </Container>
  );
}
