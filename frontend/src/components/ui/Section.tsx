import { useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container, type ContainerSize } from "./Container";
import { Eyebrow, Heading, Lead, type HeadingSize } from "./Typography";

export type SectionTone = "cream" | "secondary" | "surface" | "ink";
export type SectionSpacing = "default" | "tight" | "none";

const tones: Record<SectionTone, string> = {
  cream: "bg-background",
  secondary: "bg-background-secondary",
  surface: "bg-surface",
  /* data-tone="ink" re-scopes the tokens, so bg-background is black here. */
  ink: "bg-background text-ink",
};

const spacings: Record<SectionSpacing, string> = {
  default: "py-section",
  tight: "py-section-tight",
  none: "",
};

export type SectionProps = Omit<ComponentPropsWithoutRef<"section">, "title" | "className"> & {
  /** cream (page default) · secondary (alternate band) · surface (white) · ink (inverse) */
  tone?: SectionTone;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /** Heading element for `title`. Use "h1" only for a page's first section. */
  titleAs?: "h1" | "h2" | "h3";
  /** Visual size of `title`. Defaults to h1 for an h1, otherwise h2. */
  titleSize?: HeadingSize;
  /** Header alignment. Left is the default; centre only short closing sections. */
  align?: "start" | "center";
  /** Content placed beside the header on wide screens (a link, a control). */
  aside?: ReactNode;
  spacing?: SectionSpacing;
  container?: ContainerSize;
  /** Set false to lay out full-bleed children yourself. */
  contained?: boolean;
  className?: string;
};

/**
 * A page band: background tone, vertical rhythm, container and an optional
 * header (eyebrow, title, lead). The section is labelled by its title.
 */
export function Section({
  tone = "cream",
  eyebrow,
  title,
  lead,
  titleAs = "h2",
  titleSize,
  align = "start",
  aside,
  spacing = "default",
  container = "page",
  contained = true,
  className,
  children,
  ...rest
}: SectionProps) {
  const headingId = useId();
  const hasHeader = Boolean(eyebrow || title || lead);

  const header = hasHeader ? (
    <header
      className={cn(
        "flex flex-col gap-8 md:flex-row md:items-end md:justify-between",
        align === "center" && "md:flex-col md:items-center",
        children ? "mb-12 md:mb-16" : null,
      )}
    >
      <div className={cn("flex max-w-3xl flex-col gap-5", align === "center" && "items-center text-center")}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {title ? (
          <Heading as={titleAs} size={titleSize ?? (titleAs === "h1" ? "h1" : "h2")} id={headingId}>
            {title}
          </Heading>
        ) : null}
        {lead ? <Lead>{lead}</Lead> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  ) : null;

  const body = (
    <>
      {header}
      {children}
    </>
  );

  return (
    <section
      data-tone={tone === "ink" ? "ink" : undefined}
      aria-labelledby={title && !rest["aria-label"] ? headingId : undefined}
      className={cn(tones[tone], spacings[spacing], className)}
      {...rest}
    >
      {contained ? <Container size={container}>{body}</Container> : body}
    </section>
  );
}
