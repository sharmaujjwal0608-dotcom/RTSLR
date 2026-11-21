import { ArrowUpRight } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "target" | "rel" | "className"> & {
  href: string;
  /** Screen-reader suffix. Pass the Hindi string from your messages when localising. */
  newTabLabel?: string;
  /** Hide the trailing arrow (e.g. when the link wraps a logo). */
  hideIcon?: boolean;
  className?: string;
};

/**
 * A link to another site. Always opens in a new tab with
 * rel="noopener noreferrer" and says so to screen readers.
 */
export function ExternalLink({
  href,
  newTabLabel = "opens in a new tab",
  hideIcon = false,
  className,
  children,
  ...rest
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-baseline gap-1 font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink",
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {hideIcon ? null : <ArrowUpRight aria-hidden="true" className="size-[0.9em] shrink-0 self-center" />}
      <span className="sr-only"> ({newTabLabel})</span>
    </a>
  );
}
