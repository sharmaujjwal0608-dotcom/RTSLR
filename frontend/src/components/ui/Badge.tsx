import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const toneText: Record<Tone, string> = {
  neutral: "text-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
};

export const toneSoft: Record<Tone, string> = {
  /* The inset ring keeps a neutral tint visible on a `secondary` band. */
  neutral: "bg-background-secondary ring-1 ring-inset ring-line",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  info: "bg-info-soft",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/** Default icon per tone, so status never relies on colour alone. */
export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const props = { "aria-hidden": true, className, strokeWidth: 2 } as const;
  switch (tone) {
    case "success":
      return <CircleCheck {...props} />;
    case "warning":
      return <TriangleAlert {...props} />;
    case "danger":
      return <CircleX {...props} />;
    default:
      return <Info {...props} />;
  }
}

/* ------------------------------------------------------------------ Badge */

export type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "className"> & {
  tone?: Tone;
  /** Replaces the leading dot. Pass a lucide icon. */
  icon?: ReactNode;
  /** Hide the dot for purely categorical labels ("Beta", "v0.3"). Neutral tone only. */
  plain?: boolean;
  className?: string;
};

/** Small static label for a category or attribute. Text plus a dot or icon. */
export function Badge({ tone = "neutral", icon, plain = false, className, children, ...rest }: BadgeProps) {
  const showDot = !icon && !(plain && tone === "neutral");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-control px-2.5 text-label font-semibold whitespace-nowrap",
        toneSoft[tone],
        toneText[tone],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {showDot ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", toneDot[tone])} /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- StatusPill */

export type StatusPillProps = Omit<ComponentPropsWithoutRef<"span">, "className"> & {
  tone?: Tone;
  /** Overrides the default tone icon. */
  icon?: ReactNode;
  /** Announce changes to screen readers (role="status"). Use for live state. */
  live?: boolean;
  className?: string;
};

/**
 * The state of a system or item ("Camera on", "Model not loaded",
 * "Experimental"). Always an icon plus words; outlined so it reads as state
 * rather than as a category badge.
 */
export function StatusPill({ tone = "neutral", icon, live = false, className, children, ...rest }: StatusPillProps) {
  return (
    <span
      role={live ? "status" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-control border border-current/25 bg-surface px-3 text-caption font-semibold whitespace-nowrap",
        toneText[tone],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-4">
        {icon ?? <ToneIcon tone={tone} />}
      </span>
      {children}
    </span>
  );
}
