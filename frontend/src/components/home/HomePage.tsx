"use client";

import {
  ArrowUpRight,
  Camera,
  Hand,
  Languages,
  PencilLine,
  Play,
  Timer,
  Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import { HeroArtwork } from "@/components/hero3d";
import { NAV_ITEMS, SIMULATOR_DEMO_HREF, STUDIO_HREF } from "@/components/layout/navigation";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { TextLink } from "@/components/marketing/TextLink";
import {
  Badge,
  Button,
  Card,
  Container,
  Eyebrow,
  Heading,
  Lead,
  Notice,
  Reveal,
  Section,
} from "@/components/ui";
import type { Tone } from "@/components/ui";
import { useMessages } from "@/i18n";
import { homeMessages } from "./homeMessages";
import { PipelineDemo } from "./PipelineDemo";

const todayTones: Tone[] = ["info", "warning", "info", "danger"];

const featureIcons: ReactNode[] = [
  <Camera key="camera" />,
  <Hand key="hand" />,
  <PencilLine key="teach" />,
  <Timer key="timer" />,
  <Languages key="languages" />,
  <Volume2 key="speech" />,
];

const href = Object.fromEntries(NAV_ITEMS.map((item) => [item.key, item.href])) as Record<
  (typeof NAV_ITEMS)[number]["key"],
  string
>;

export function HomePage() {
  const t = useMessages(homeMessages);

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section aria-labelledby="home-title" className="bg-background">
        <Container
          size="wide"
          className="grid items-center gap-x-8 gap-y-12 pt-10 pb-section-tight lg:min-h-[calc(100svh-var(--header-height))] lg:grid-cols-12 lg:py-16"
        >
          <div className="flex flex-col items-start gap-8 lg:col-span-7">
            <Reveal y={0}>
              <Notice tone="warning" compact>
                {t.hero.status}
              </Notice>
            </Reveal>
            <Reveal delay={0.06}>
              <Heading size="display" id="home-title" className="max-w-[12ch] break-words">
                {t.hero.title}
              </Heading>
            </Reveal>
            <Reveal delay={0.14}>
              <Lead>{t.hero.lead}</Lead>
            </Reveal>
            <Reveal delay={0.22} className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button href={STUDIO_HREF} size="lg" icon={<ArrowUpRight />}>
                  {t.hero.primary}
                </Button>
                <Button href={SIMULATOR_DEMO_HREF} size="lg" variant="secondary" icon={<Play />}>
                  {t.hero.demo}
                </Button>
              </div>
              <p className="text-caption text-muted">{t.hero.demoNote}</p>
            </Reveal>
          </div>

          {/* Fixed aspect ratio: the artwork can load late without moving the page. */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto aspect-square w-full max-w-[min(100%,60vw)] min-w-56 lg:max-w-none">
              <div className="absolute inset-0">
                <HeroArtwork />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------- what works today */}
      <Section id="today" spacing="none" contained={false} aria-labelledby="today-title">
        <Container className="grid gap-10 border-t border-line py-section-tight lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-5 lg:col-span-4">
            <Heading id="today-title">{t.today.title}</Heading>
            <p className="max-w-[40ch] text-body text-muted">{t.today.lead}</p>
          </div>
          <div className="flex flex-col gap-8 lg:col-span-8">
            <dl className="border-b border-line">
              {t.today.items.map((item, index) => (
                <div
                  key={item.title}
                  className="grid gap-x-8 gap-y-3 border-t border-line py-6 md:grid-cols-[16rem_1fr]"
                >
                  <dt className="flex flex-col items-start gap-3">
                    <Badge tone={todayTones[index]}>
                      {item.badge}
                    </Badge>
                    <span className="text-h4 text-ink">{item.title}</span>
                  </dt>
                  <dd className="text-body text-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
            <Notice tone="warning" title={t.today.noticeTitle}>
              {t.today.notice}
            </Notice>
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------- product introduction */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Eyebrow>{t.intro.eyebrow}</Eyebrow>
            <Heading size="h1" as="h2" className="max-w-[18ch]">
              {t.intro.statement}
            </Heading>
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-12">
            <p className="text-body text-muted">{t.intro.p1}</p>
            <p className="text-body text-muted">{t.intro.p2}</p>
            <TextLink href={href.product} arrow className="self-start">
              {t.intro.link}
            </TextLink>
          </div>
        </div>
      </Section>

      {/* ------------------------------------- recognition demonstration */}
      <Section tone="secondary" title={t.pipeline.title} lead={t.pipeline.lead}>
        <PipelineDemo />
      </Section>

      {/* ---------------------------------------------------- how it works */}
      <Section title={t.how.title} lead={t.how.lead}>
        <ol className="grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.steps.map((step, index) => (
            <li key={step.title} className="relative border-t border-line-strong pt-9 pr-8">
              <span
                aria-hidden="true"
                className="absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full bg-ink font-mono text-label font-medium text-on-ink"
              >
                {index + 1}
              </span>
              <Heading as="h3" size="h4">
                {step.title}
              </Heading>
              <p className="mt-2 text-small text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------------------------------------------- key features */}
      <Section tone="surface" title={t.features.title}>
        <ul className="grid gap-x-12 md:grid-cols-2">
          {t.features.items.map((item, index) => (
            <li key={item.title} className="flex gap-5 border-t border-line py-7">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink [&>svg]:size-5"
              >
                {featureIcons[index]}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Heading as="h3" size="h4">
                  {item.title}
                </Heading>
                <p className="text-small text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------- about ISL */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
              <Eyebrow>{t.isl.eyebrow}</Eyebrow>
              <Heading>{t.isl.title}</Heading>
              <Lead>{t.isl.lead}</Lead>
              <TextLink href={href.learn} arrow className="self-start">
                {t.isl.link}
              </TextLink>
            </div>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            {t.isl.points.map((point) => (
              <div key={point.title} className="border-t border-line py-7 last:border-b">
                <Heading as="h3" size="h3">
                  {point.title}
                </Heading>
                <p className="mt-3 text-body text-muted">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------ use cases · learning · R&D previews */}
      <Section tone="secondary" title={t.explore.title}>
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Card panel padding="lg" className="flex h-full flex-col justify-between gap-12">
              <div className="flex flex-col gap-4">
                <p className="text-small font-semibold text-accent-ink">{t.explore.useCases.label}</p>
                <Heading as="h3" size="h2" className="max-w-[16ch]">
                  {t.explore.useCases.title}
                </Heading>
                <p className="max-w-[44ch] text-body text-muted">{t.explore.useCases.text}</p>
              </div>
              <div>
                <Button href={href.useCases} variant="secondary" icon={<ArrowUpRight />}>
                  {t.explore.useCases.link}
                </Button>
              </div>
            </Card>
          </Reveal>
          <div className="flex flex-col lg:col-span-5">
            {([t.explore.learn, t.explore.research] as const).map((item, index) => (
              <div
                key={item.title}
                className="flex flex-1 flex-col items-start justify-center gap-3 border-t border-line-strong py-8 last:border-b"
              >
                <p className="text-small font-semibold text-accent-ink">{item.label}</p>
                <Heading as="h3" size="h3">
                  {item.title}
                </Heading>
                <p className="text-small text-muted">{item.text}</p>
                <TextLink href={index === 0 ? href.learn : href.research} arrow>
                  {item.link}
                </TextLink>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- privacy */}
      <Section tone="ink" aria-labelledby="privacy-title">
        <div className="flex flex-col gap-14">
          <div className="flex flex-col gap-6">
            <Eyebrow>{t.privacy.eyebrow}</Eyebrow>
            <Heading size="h1" as="h2" id="privacy-title" className="max-w-[20ch]">
              {t.privacy.statement}
            </Heading>
          </div>
          <ul className="grid gap-8 md:grid-cols-3">
            {t.privacy.facts.map((fact) => (
              <li key={fact.title} className="border-t border-line-strong pt-5">
                <p className="text-h4 text-ink">{fact.title}</p>
                <p className="mt-1.5 text-small text-muted">{fact.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------- CTA */}
      <ClosingCta
        title={t.cta.title}
        lead={t.cta.lead}
        primary={{ href: STUDIO_HREF, label: t.cta.primary }}
        secondary={{ href: SIMULATOR_DEMO_HREF, label: t.cta.secondary }}
      />
    </>
  );
}
