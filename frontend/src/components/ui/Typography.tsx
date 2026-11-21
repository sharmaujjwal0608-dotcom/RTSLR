import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------- Heading */

export type HeadingSize = "display" | "h1" | "h2" | "h3" | "h4";

const headingSizes: Record<HeadingSize, string> = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-h4",
};

const defaultTag: Record<HeadingSize, "h1" | "h2" | "h3" | "h4"> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
};

export type HeadingProps = Omit<ComponentPropsWithoutRef<"h2">, "className"> & {
  /** Visual size. `display` is for the one hero headline of a page. */
  size?: HeadingSize;
  /** Semantic element. Defaults to the tag matching `size` (display → h1). */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
  className?: string;
};

/** Size and semantics are separate: pick `as` for the outline, `size` for the look. */
export function Heading({ size = "h2", as, className, ...rest }: HeadingProps) {
  const Tag: ElementType = as ?? defaultTag[size];
  return <Tag className={cn(headingSizes[size], "text-ink", className)} {...rest} />;
}

/* ---------------------------------------------------------------- Eyebrow */

export type EyebrowProps = Omit<ComponentPropsWithoutRef<"p">, "className"> & {
  as?: "p" | "span" | "div";
  className?: string;
};

/**
 * Short line above a heading that names the section's subject. Sentence
 * case, never all caps. Leave it out when the heading already says it.
 */
export function Eyebrow({ as: Tag = "p", className, children, ...rest }: EyebrowProps) {
  return (
    <Tag
      className={cn("flex items-center gap-3 text-small font-semibold text-accent-ink", className)}
      {...rest}
    >
      <span aria-hidden="true" className="h-px w-8 shrink-0 bg-accent" />
      <span>{children}</span>
    </Tag>
  );
}

/* ------------------------------------------------------------------- Lead */

export type LeadProps = Omit<ComponentPropsWithoutRef<"p">, "className"> & { className?: string };

/** Intro paragraph under a heading. Capped near 60 characters per line. */
export function Lead({ className, ...rest }: LeadProps) {
  return <p className={cn("max-w-[60ch] text-lead text-muted", className)} {...rest} />;
}

/* -------------------------------------------------------------------- Kbd */

export type KbdProps = Omit<ComponentPropsWithoutRef<"kbd">, "className"> & { className?: string };

/** A keyboard key, e.g. `<Kbd>Space</Kbd>`. */
export function Kbd({ className, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-line-strong bg-surface px-1.5 font-mono text-label font-medium text-ink",
        className,
      )}
      {...rest}
    />
  );
}

/* --------------------------------------------------------- VisuallyHidden */

export type VisuallyHiddenProps = Omit<ComponentPropsWithoutRef<"span">, "className"> & {
  as?: "span" | "div" | "p" | "h2" | "h3";
};

/** Text for screen readers only (icon-only controls, table captions, live regions). */
export function VisuallyHidden({ as: Tag = "span", ...rest }: VisuallyHiddenProps) {
  return <Tag className="sr-only" {...rest} />;
}
