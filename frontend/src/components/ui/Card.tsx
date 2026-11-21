import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "outline" | "sunken" | "raised";
export type CardPadding = "none" | "sm" | "md" | "lg";

const variants: Record<CardVariant, string> = {
  /* Default: a white sheet with a hairline edge and no shadow. */
  outline: "border border-line bg-surface",
  /* A recessed well for secondary content, code and data readouts. */
  sunken: "bg-background-secondary",
  /* Reserved for things that really float: Studio panels, popovers. */
  raised: "border border-line bg-surface shadow-lift",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-5",
  md: "p-6 md:p-8",
  lg: "p-8 md:p-12",
};

export type CardProps = Omit<ComponentPropsWithoutRef<"div">, "className"> & {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Larger corner for hero-sized panels (rounded-panel instead of rounded-card). */
  panel?: boolean;
  as?: ElementType;
  className?: string;
};

/**
 * A quiet surface. It groups content; it is not a layout unit. Do not build a
 * page out of rows of identical cards: see the page specs in DESIGN_SYSTEM.md.
 */
export function Card({
  variant = "outline",
  padding = "md",
  panel = false,
  as: Tag = "div",
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        panel ? "rounded-panel" : "rounded-card",
        variants[variant],
        paddings[padding],
        className,
      )}
      {...rest}
    />
  );
}
