import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ToneIcon, toneSoft, toneText, type Tone } from "./Badge";

export type NoticeProps = Omit<ComponentPropsWithoutRef<"div">, "title" | "className"> & {
  /** info (default) · warning · danger · success · neutral */
  tone?: Tone;
  /** Short label in bold, e.g. "Experimental" or "Legacy ASL prototype". */
  title?: ReactNode;
  /** Overrides the default tone icon. */
  icon?: ReactNode;
  /** Announce when it appears: "polite" → role="status", "assertive" → role="alert". */
  live?: "polite" | "assertive";
  /** One-line version for use inside panels and toolbars. */
  compact?: boolean;
  /** Buttons or links shown under the text. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Callout for honesty labels and system messages. Use it wherever the brief's
 * honesty rules apply: no validated ISL model, simulator output, legacy ASL
 * prototype, media pending a verified source.
 */
export function Notice({
  tone = "info",
  title,
  icon,
  live,
  compact = false,
  actions,
  className,
  children,
  ...rest
}: NoticeProps) {
  const role = live === "assertive" ? "alert" : live === "polite" ? "status" : "note";
  return (
    <div
      role={role}
      className={cn(
        "flex items-start text-ink",
        compact ? "gap-2.5 rounded-field px-3.5 py-2.5 text-caption" : "gap-4 rounded-card p-5 text-small",
        toneSoft[tone],
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn("mt-0.5 inline-flex shrink-0", compact ? "[&>svg]:size-4" : "[&>svg]:size-5", toneText[tone])}
      >
        {icon ?? <ToneIcon tone={tone} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className={cn("font-bold", toneText[tone])}>{title}</p> : null}
        {children ? <div className="[&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4">{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
