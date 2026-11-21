import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TextLinkProps = {
  href: string;
  children: ReactNode;
  /** Trailing arrow for "read more"-style links that stand on their own line. */
  arrow?: boolean;
  className?: string;
};

/** An internal link set in running text or on its own line. For other sites use `ExternalLink`. */
export function TextLink({ href, children, arrow = false, className }: TextLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/link inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink",
        arrow && "min-h-11",
        className,
      )}
    >
      <span>{children}</span>
      {arrow ? (
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-200 ease-calm group-hover/link:translate-x-0.5"
        />
      ) : null}
    </Link>
  );
}
