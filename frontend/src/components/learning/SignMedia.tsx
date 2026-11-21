"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, ExternalLink, Select, Switch } from "@/components/ui";
import type { MediaCaptionTrack, SignItem, SignMedia as SignMediaEntry } from "@/features/learning/content";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { fill, SourceBadge, useSignWords } from "./shared";

const messages = defineMessages({
  en: {
    pendingTitle: "Demonstration pending verified source",
    pendingBody:
      "RTSLR has no licensed, verified image or video of this sign, so none is shown and the sign is not described here. Until one is added, look it up in the official dictionary.",
    lookUpVerified: "Look up “{word}” in the official ISLRTC dictionary",
    lookUpUnverified: "Look up “{word}” in the official dictionary (link not verified from our network)",
    lookUpHint:
      "The link opens the website of the Indian Sign Language Research and Training Centre (ISLRTC), which links to its ISL dictionary. Search there for the word.",
    newTab: "opens in a new tab",
    verifiedBadge: "Verified source",
    replay: "Replay",
    speed: "Playback speed",
    speedNormal: "Normal",
    captions: "Captions",
    captionLanguage: "Caption language",
    noCaptions: "This video has no caption track.",
    credit: "Credit",
    licence: "Licence",
    source: "Source",
    sourceLink: "View the original",
    verifiedOn: "Checked against the source on",
    videoLabel: "Demonstration video: {word}",
  },
  hi: {
    pendingTitle: "प्रदर्शन सत्यापित स्रोत मिलने तक लंबित",
    pendingBody:
      "RTSLR के पास इस संकेत की कोई लाइसेंस-प्राप्त, सत्यापित तस्वीर या वीडियो नहीं है, इसलिए यहाँ न कुछ दिखाया गया है और न संकेत का वर्णन किया गया है। जब तक वह नहीं जुड़ता, इसे आधिकारिक शब्दकोश में देखें।",
    lookUpVerified: "“{word}” को आधिकारिक ISLRTC शब्दकोश में देखें",
    lookUpUnverified: "“{word}” को आधिकारिक शब्दकोश में देखें (लिंक हमारे नेटवर्क से सत्यापित नहीं है)",
    lookUpHint:
      "यह लिंक भारतीय सांकेतिक भाषा अनुसंधान एवं प्रशिक्षण केंद्र (ISLRTC) की वेबसाइट खोलता है, जहाँ से उसके ISL शब्दकोश का लिंक मिलता है। वहाँ शब्द खोजें।",
    newTab: "नए टैब में खुलता है",
    verifiedBadge: "सत्यापित स्रोत",
    replay: "फिर से चलाएँ",
    speed: "चलाने की गति",
    speedNormal: "सामान्य",
    captions: "कैप्शन",
    captionLanguage: "कैप्शन की भाषा",
    noCaptions: "इस वीडियो में कैप्शन ट्रैक नहीं है।",
    credit: "श्रेय",
    licence: "लाइसेंस",
    source: "स्रोत",
    sourceLink: "मूल सामग्री देखें",
    verifiedOn: "स्रोत से मिलान की तारीख़",
    videoLabel: "प्रदर्शन वीडियो: {word}",
  },
});

export const PLAYBACK_RATES = [0.5, 0.75, 1] as const;

export type SignMediaProps = {
  sign: SignItem;
  /** Heading level for the pending title, to fit the surrounding outline. */
  headingAs?: "h2" | "h3" | "h4";
  /** Set false where the word is already the heading right above the slot. */
  showWord?: boolean;
  className?: string;
};

/**
 * The media slot of a sign. With `sign.media === null` (every shipped item) it
 * shows a designed "pending verified source" plate and a link to the official
 * dictionary. With a media entry it shows the image, or the video with replay,
 * playback-speed and caption controls, plus credit, licence and source.
 */
export function SignMedia({ sign, headingAs = "h2", showWord = true, className }: SignMediaProps) {
  return sign.media ? (
    <VerifiedMedia sign={sign} media={sign.media} className={className} />
  ) : (
    <PendingMedia sign={sign} headingAs={headingAs} showWord={showWord} className={className} />
  );
}

/* ---------------------------------------------------------------- pending */

function PendingMedia({ sign, headingAs: Heading = "h2", showWord = true, className }: SignMediaProps) {
  const t = useMessages(messages);
  const words = useSignWords()(sign);
  const label = sign.source.verified ? t.lookUpVerified : t.lookUpUnverified;

  return (
    <div
      data-media-state="pending"
      className={cn(
        "grid overflow-hidden rounded-panel border border-line bg-surface",
        showWord && "md:min-h-80 md:grid-cols-5",
        className,
      )}
    >
      {/* The plate: the word itself, set large. It stands where the demonstration will go. */}
      {showWord ? (
        <div className="flex flex-col justify-between gap-8 bg-background-secondary p-6 md:col-span-2 md:p-8">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          <p className="flex flex-col gap-2">
            <span lang={words.primaryLang} className="text-h1 break-words text-ink">
              {words.primary}
            </span>
            {words.secondary ? (
              <span lang={words.secondaryLang} className="text-h3 break-words text-muted">
                {words.secondary}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-start justify-center gap-4 p-6 md:col-span-3 md:p-8">
        <SourceBadge sign={sign} />
        <Heading className="text-h4 text-ink">{t.pendingTitle}</Heading>
        <p className="max-w-reading text-small text-muted">{t.pendingBody}</p>
        <p className="text-small">
          <ExternalLink href={sign.source.url} newTabLabel={t.newTab}>
            {fill(label, { word: sign.en })}
          </ExternalLink>
        </p>
        <p className="max-w-reading text-caption text-muted">{t.lookUpHint}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- verified */

function MediaCredit({ media }: { media: SignMediaEntry }) {
  const t = useMessages(messages);
  return (
    <figcaption className="flex flex-col gap-3 p-6 md:p-8">
      <Badge tone="success" className="self-start">
        {t.verifiedBadge}
      </Badge>
      <dl className="grid gap-x-6 gap-y-2 text-caption sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-ink">{t.credit}</dt>
        <dd className="text-muted">{media.credit}</dd>
        <dt className="font-semibold text-ink">{t.licence}</dt>
        <dd className="text-muted">
          {media.licence.url ? (
            <ExternalLink href={media.licence.url} newTabLabel={t.newTab}>
              {media.licence.name}
            </ExternalLink>
          ) : (
            media.licence.name
          )}
        </dd>
        <dt className="font-semibold text-ink">{t.source}</dt>
        <dd className="text-muted">
          <ExternalLink href={media.sourceUrl} newTabLabel={t.newTab}>
            {t.sourceLink}
          </ExternalLink>
        </dd>
        <dt className="font-semibold text-ink">{t.verifiedOn}</dt>
        <dd className="font-mono text-muted">{media.verifiedOn}</dd>
      </dl>
    </figcaption>
  );
}

function VerifiedMedia({ sign, media, className }: { sign: SignItem; media: SignMediaEntry; className?: string }) {
  const { locale } = useI18n();
  return (
    <figure
      data-media-state="verified"
      className={cn("overflow-hidden rounded-panel border border-line bg-surface", className)}
    >
      {media.type === "image" ? (
        /* Verified media is a same-origin static file of unknown dimensions. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={media.src} alt={media.alt[locale]} className="aspect-video w-full bg-background-secondary object-contain" />
      ) : (
        <VideoPlayer sign={sign} media={media} />
      )}
      <MediaCredit media={media} />
    </figure>
  );
}

function pickTrack(tracks: readonly MediaCaptionTrack[], language: string): MediaCaptionTrack | undefined {
  return tracks.find((track) => track.srcLang === language) ?? tracks[0];
}

/**
 * Browsers pick a `default` track automatically only once per video, so a
 * track mounted later (captions switched back on, language changed) is shown
 * explicitly. Only the track that should be visible is ever rendered.
 */
function showTrack(element: HTMLTrackElement | null): void {
  if (element?.track) element.track.mode = "showing";
}

function VideoPlayer({ sign, media }: { sign: SignItem; media: SignMediaEntry }) {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState<number>(1);
  const hasCaptions = media.captions.length > 0;
  const [captionsOn, setCaptionsOn] = useState(hasCaptions);
  const [chosenLang, setChosenLang] = useState<string | null>(null);
  const activeTrack = captionsOn ? pickTrack(media.captions, chosenLang ?? locale) : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, [rate]);

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.playbackRate = rate;
    // play() rejects when the browser blocks it; the native controls remain.
    void Promise.resolve(video.play()).catch(() => undefined);
  };

  return (
    <div>
      <video
        ref={videoRef}
        src={media.src}
        poster={media.poster}
        controls
        playsInline
        preload="metadata"
        aria-label={fill(t.videoLabel, { word: sign.en })}
        className="aspect-video w-full bg-ink object-contain"
      >
        {activeTrack ? (
          <track
            ref={showTrack}
            key={activeTrack.src}
            kind="captions"
            src={activeTrack.src}
            srcLang={activeTrack.srcLang}
            label={activeTrack.label}
            default
          />
        ) : null}
      </video>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-line p-6 md:px-8">
        <Button variant="secondary" leadingIcon={<RotateCcw />} onClick={replay}>
          {t.replay}
        </Button>
        <Select
          label={t.speed}
          className="min-w-40"
          value={String(rate)}
          onChange={(event) => setRate(Number(event.target.value))}
          options={PLAYBACK_RATES.map((value) => ({
            value: String(value),
            label: value === 1 ? `1× (${t.speedNormal})` : `${value}×`,
          }))}
        />
        {hasCaptions ? (
          <>
            <Switch
              label={t.captions}
              className="min-w-40"
              checked={captionsOn}
              onChange={(event) => setCaptionsOn(event.target.checked)}
            />
            {media.captions.length > 1 ? (
              <Select
                label={t.captionLanguage}
                className="min-w-40"
                value={activeTrack?.srcLang ?? pickTrack(media.captions, chosenLang ?? locale)?.srcLang}
                disabled={!captionsOn}
                onChange={(event) => setChosenLang(event.target.value)}
                options={media.captions.map((track) => ({ value: track.srcLang, label: track.label }))}
              />
            ) : null}
          </>
        ) : (
          <p className="text-caption text-muted">{t.noCaptions}</p>
        )}
      </div>
    </div>
  );
}
