"use client";

import type { ReactNode } from "react";
import { Badge, Heading } from "@/components/ui";
import { useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { SECTION_IDS, commonMessages, sectionTitles, type SectionId } from "./sections";

/**
 * One numbered section of the R&D document. The section is focusable from
 * script only (tabIndex -1) so the jump menu can move focus to it.
 */
export function DocSection({
  id,
  intro,
  children,
}: {
  id: SectionId;
  /** Paragraph(s) under the heading, capped at reading width. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  const titles = useMessages(sectionTitles);
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-40 border-t border-line pt-10 outline-none lg:scroll-mt-28"
    >
      <p aria-hidden="true" className="mb-3 font-mono text-label text-muted">
        {String(SECTION_IDS.indexOf(id) + 1).padStart(2, "0")}
      </p>
      <Heading id={headingId} size="h2" className="break-words">
        {titles[id]}
      </Heading>
      {intro ? <div className="mt-5 flex max-w-reading flex-col gap-4 text-body text-muted">{intro}</div> : null}
      <div className="mt-10">{children}</div>
    </section>
  );
}

/** Sub-heading inside a section. */
export function SubHeading({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <Heading as="h3" size="h3" id={id} className={cn("break-words", className)}>
      {children}
    </Heading>
  );
}

/**
 * Horizontally scrollable, keyboard-focusable wrapper for a wide table, so
 * the table never widens the page.
 */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  const common = useMessages(commonMessages);
  return (
    <div>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-card border border-line bg-surface"
      >
        {children}
      </div>
      <p className="mt-2 text-caption text-muted lg:hidden">{common.scrollHint}</p>
    </div>
  );
}

/** Shared table styling: hairline rows, top-aligned cells, sentence-case headers. */
export const tableClass = "w-full border-collapse text-left text-small";
export const captionClass = "border-b border-line px-4 py-3 text-left text-caption text-muted";
export const thClass = "border-b border-line-strong px-4 py-3 align-bottom text-caption font-semibold text-ink";
export const tdClass = "border-b border-line px-4 py-3 align-top text-ink";
export const rowHeadClass = "border-b border-line px-4 py-3 align-top text-left font-semibold text-ink";

/** Verified / unverified, as words plus an icon dot (never colour alone). */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  const common = useMessages(commonMessages);
  return <Badge tone={verified ? "success" : "warning"}>{verified ? common.verified : common.unverified}</Badge>;
}

/** Mono id that links to an entry in the reference list on the same page. */
export function ReferenceLink({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      className="font-mono text-label break-all text-accent-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink"
    >
      {id}
    </a>
  );
}

/** A label/value pair inside a `<dl>`. */
export function Fact({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-caption font-semibold text-muted">{label}</dt>
      <dd className="text-small break-words text-ink">{children}</dd>
    </div>
  );
}

/** Machine identifiers: paths, ids, versions. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-label break-all text-ink", className)}>{children}</span>;
}
