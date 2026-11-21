"use client";

import { Check, X } from "lucide-react";
import { SIMULATOR_DEMO_HREF, STUDIO_HREF } from "@/components/layout/navigation";
import { Badge, Card, Eyebrow, Heading, Notice, Section, StatusPill } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { ClosingCta } from "./ClosingCta";
import { HandGlyph } from "./handGeometry";
import { HandLandmarkExplorer } from "./HandLandmarkExplorer";
import { HoldToAppendDemo } from "./HoldToAppendDemo";
import { productMessages, type CapabilityStatus } from "./productMessages";

const statusTone: Record<CapabilityStatus, Tone> = {
  implemented: "success",
  experimental: "warning",
  legacy: "info",
  demo: "info",
  limited: "warning",
  device: "neutral",
  missing: "danger",
};

const segmentFill = ["bg-ink", "bg-muted", "bg-accent", "bg-accent-ink", "bg-info"];

/* ------------------------------------------------------ studio schematic */

function Callout({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={20} className="fill-accent stroke-surface" strokeWidth={3} />
      <text x={x} y={y + 7} textAnchor="middle" fontSize={20} className="fill-black font-mono font-medium">
        {n}
      </text>
    </g>
  );
}

function StudioSchematic({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 800 520" role="img" aria-label={label} className="block aspect-[800/520] w-full">
      {/* 1 · model notice */}
      <rect x={24} y={24} width={500} height={40} rx={12} className="fill-warning-soft" />
      <circle cx={46} cy={44} r={7} className="fill-warning" />
      <rect x={64} y={39} width={220} height={10} rx={5} className="fill-warning-ink" opacity={0.55} />

      {/* 2 · stage */}
      <g data-tone="ink">
        <rect x={24} y={80} width={500} height={344} rx={28} className="fill-background" />
        <HandGlyph transform="translate(96 150) scale(0.92)" bones dots />
        <HandGlyph transform="translate(270 150) scale(0.92)" bones dots mirrored />
        {/* 3 · status */}
        <rect x={44} y={100} width={150} height={30} rx={15} className="fill-surface stroke-line-strong" strokeWidth={1} />
        <circle cx={62} cy={115} r={5} className="fill-success" />
        <rect x={76} y={110} width={96} height={10} rx={5} className="fill-muted" />
      </g>

      {/* transport */}
      <rect x={24} y={444} width={176} height={52} rx={26} className="fill-ink" />
      <rect x={58} y={465} width={108} height={10} rx={5} className="fill-on-ink" />

      {/* side panel */}
      <rect x={548} y={24} width={228} height={472} rx={20} className="fill-surface stroke-line" strokeWidth={1.5} />
      <rect x={566} y={42} width={192} height={36} rx={18} className="fill-background-secondary" />
      <rect x={570} y={46} width={62} height={28} rx={14} className="fill-ink" />
      {/* 4 · candidates */}
      <rect x={566} y={102} width={96} height={30} rx={8} className="fill-ink" />
      <rect x={566} y={148} width={192} height={8} rx={4} className="fill-background-secondary" />
      <rect x={566} y={148} width={128} height={8} rx={4} className="fill-accent" />
      <g className="fill-line-strong">
        <rect x={566} y={180} width={150} height={8} rx={4} />
        <rect x={566} y={200} width={84} height={8} rx={4} />
        <rect x={566} y={220} width={46} height={8} rx={4} />
      </g>
      {/* 5 · transcript */}
      <path d="M566 258h192" className="stroke-line" strokeWidth={1.5} />
      <g className="fill-line">
        <rect x={566} y={284} width={170} height={10} rx={5} />
        <rect x={566} y={306} width={192} height={10} rx={5} />
        <rect x={566} y={328} width={120} height={10} rx={5} />
      </g>
      <rect x={566} y={444} width={90} height={34} rx={17} className="fill-none stroke-ink" strokeWidth={1.5} />
      <rect x={668} y={444} width={90} height={34} rx={17} className="fill-none stroke-ink" strokeWidth={1.5} />

      <Callout n={1} x={516} y={30} />
      <Callout n={2} x={274} y={424} />
      <Callout n={3} x={194} y={100} />
      <Callout n={4} x={768} y={160} />
      <Callout n={5} x={768} y={310} />
    </svg>
  );
}

/* ------------------------------------------------------------------ page */

export function ProductPage() {
  const t = useMessages(productMessages);
  const total = t.hands.segments.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <>
      {/* ---------------------------------------------------------- header */}
      <Section titleAs="h1" eyebrow={t.header.eyebrow} title={t.header.title} lead={t.header.lead} spacing="tight">
        <StatusPill tone="warning">{t.header.status}</StatusPill>
      </Section>

      {/* ------------------------------------------------ annotated studio */}
      <Section spacing="none" className="pb-section" title={t.specimen.title} lead={t.specimen.lead}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <figure className="lg:col-span-8">
            <div className="overflow-hidden rounded-panel border border-line bg-background-secondary p-3 shadow-float sm:p-5">
              <StudioSchematic label={t.specimen.figureLabel} />
            </div>
            <figcaption className="mt-4 text-caption text-muted">{t.specimen.caption}</figcaption>
          </figure>
          <div className="lg:col-span-4">
            <ol className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
              {t.specimen.notes.map((note, index) => (
                <li key={note.title} className="flex gap-4 border-t border-line py-5 last:border-b">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-label font-medium text-black"
                  >
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Heading as="h3" size="h4">
                      {note.title}
                    </Heading>
                    <p className="text-small text-muted">{note.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- capabilities */}
      <Section tone="surface" title={t.capabilities.title}>
        <table className="w-full border-collapse text-left">
          <thead className="hidden md:table-header-group">
            <tr>
              <th scope="col" className="w-1/4 pr-8 pb-4 text-small font-semibold text-muted">
                {t.capabilities.colWhat}
              </th>
              <th scope="col" className="pr-8 pb-4 text-small font-semibold text-muted">
                {t.capabilities.colHow}
              </th>
              <th scope="col" className="w-56 pb-4 text-small font-semibold text-muted">
                {t.capabilities.colStatus}
              </th>
            </tr>
          </thead>
          <tbody>
            {t.capabilities.rows.map((row) => (
              <tr key={row.what} className="flex flex-col gap-2 border-t border-line py-5 md:table-row md:py-0">
                <th scope="row" className="align-top text-h4 text-ink md:py-5 md:pr-8">
                  {row.what}
                </th>
                <td className="align-top text-small text-muted md:py-5 md:pr-8">{row.how}</td>
                <td className="align-top md:py-5">
                  <Badge tone={statusTone[row.status]}>{t.capabilities.status[row.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ---------------------------------------------- camera and privacy */}
      <Section tone="secondary" eyebrow={t.privacy.eyebrow} title={t.privacy.title} lead={t.privacy.lead}>
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          <div>
            <Heading as="h3" size="h3">
              {t.privacy.doesTitle}
            </Heading>
            <ul className="mt-5">
              {t.privacy.does.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line-strong/40 py-4 text-body text-ink">
                  <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-success-ink" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Heading as="h3" size="h3">
              {t.privacy.doesNotTitle}
            </Heading>
            <ul className="mt-5">
              {t.privacy.doesNot.map((item) => (
                <li key={item} className="flex gap-3 border-t border-line-strong/40 py-4 text-body text-ink">
                  <X aria-hidden="true" className="mt-1 size-5 shrink-0 text-danger-ink" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Notice tone="neutral" className="mt-10 max-w-3xl">
          {t.privacy.note}
        </Notice>
      </Section>

      {/* ------------------------------------------------ dual-hand tracking */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-5 lg:col-span-6">
            <Eyebrow>{t.hands.eyebrow}</Eyebrow>
            <Heading>{t.hands.title}</Heading>
            <p className="text-body text-muted">{t.hands.p1}</p>
            <p className="text-body text-muted">{t.hands.p2}</p>
            <p className="text-small text-muted">{t.hands.limit}</p>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-6">
            <Heading as="h3" size="h4">
              {t.hands.explorerTitle}
            </Heading>
            <HandLandmarkExplorer />
          </div>
        </div>

        <div className="mt-16 border-t border-line pt-10">
          <Heading as="h3" size="h3">
            {t.hands.vectorTitle}
          </Heading>
          <div
            role="img"
            aria-label={t.hands.vectorLabel}
            className="mt-6 flex h-10 w-full gap-0.5 overflow-hidden rounded-field"
          >
            {t.hands.segments.map((segment, index) => (
              <span
                key={segment.label}
                className={cn("h-full min-w-1.5", segmentFill[index])}
                style={{ flexGrow: segment.count, flexBasis: 0 }}
              />
            ))}
          </div>
          <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.hands.segments.map((segment, index) => (
              <li key={segment.label} className="flex items-start gap-3">
                <span aria-hidden="true" className={cn("mt-1.5 size-3 shrink-0 rounded-full", segmentFill[index])} />
                <span className="text-small text-ink">
                  <span className="font-mono font-medium">{segment.count}</span> {segment.label}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1.5 size-3 shrink-0 rounded-full border border-ink" />
              <span className="font-mono text-small font-medium text-ink">= {total}</span>
            </li>
          </ul>
        </div>
      </Section>

      {/* -------------------------------------------- text output and hold */}
      <Section tone="secondary">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-5 lg:col-span-4">
            <Eyebrow>{t.hold.eyebrow}</Eyebrow>
            <Heading>{t.hold.title}</Heading>
            <p className="text-body text-muted">{t.hold.p1}</p>
            <p className="text-body text-muted">{t.hold.p2}</p>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-8">
            <Heading as="h3" size="h4">
              {t.hold.demoTitle}
            </Heading>
            <HoldToAppendDemo />
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- languages */}
      <Section eyebrow={t.language.eyebrow} title={t.language.title}>
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
          <dl className="lg:col-span-7">
            <div className="grid gap-2 border-t border-line py-6 md:grid-cols-[10rem_1fr] md:gap-8">
              <dt className="text-h4 text-ink">{t.language.interfaceTitle}</dt>
              <dd className="text-body text-muted">{t.language.interfaceText}</dd>
            </div>
            <div className="grid gap-2 border-y border-line py-6 md:grid-cols-[10rem_1fr] md:gap-8">
              <dt className="text-h4 text-ink">{t.language.outputTitle}</dt>
              <dd className="text-body text-muted">{t.language.outputText}</dd>
            </div>
          </dl>
          <div className="lg:col-span-5">
            <Notice tone="info" title={t.language.noticeTitle}>
              {t.language.notice}
            </Notice>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ specs */}
      <Section tone="surface" title={t.specs.title} lead={t.specs.lead}>
        <Card variant="sunken" padding="lg">
          <dl className="grid gap-x-12 md:grid-cols-2">
            {t.specs.rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-6 border-b border-line-strong/40 py-4">
                <dt className="text-small text-muted">{row.label}</dt>
                <dd className="text-right font-mono text-small font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </Section>

      <ClosingCta
        title={t.cta.title}
        lead={t.cta.lead}
        primary={{ href: STUDIO_HREF, label: t.cta.primary }}
        secondary={{ href: SIMULATOR_DEMO_HREF, label: t.cta.secondary }}
      />
    </>
  );
}
