import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon after the label, e.g. `<ArrowUpRight />`. Sized and hidden from assistive tech here. */
  icon?: ReactNode;
  /** Icon before the label. */
  leadingIcon?: ReactNode;
  /** Stretch to the container width (mobile CTAs). */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps | "href"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps | "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-calm " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-on-ink shadow-soft hover:shadow-lift",
  secondary: "border-ink bg-transparent text-ink hover:bg-ink hover:text-on-ink",
  ghost: "border-transparent bg-transparent text-ink hover:bg-ink/8",
};

/* md and lg meet the 44px touch target. sm (36px) is for dense Studio toolbars only. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-4 text-small",
  md: "h-11 gap-2 px-6 text-small",
  lg: "h-14 gap-2.5 px-8 text-body",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "[&>svg]:size-3.5",
  md: "[&>svg]:size-4",
  lg: "[&>svg]:size-[1.125rem]",
};

function Icon({ size, trailing, children }: { size: ButtonSize; trailing?: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 transition-transform duration-200 ease-calm",
        iconSizes[size],
        trailing && "group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The one button. Renders a Next `<Link>` when `href` is given, otherwise a
 * `<button type="button">`. For links to other sites use `<ExternalLink>`.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    icon,
    leadingIcon,
    fullWidth,
    className,
    children,
    ...rest
  } = props;

  const classes = cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
  const content = (
    <>
      {leadingIcon ? <Icon size={size}>{leadingIcon}</Icon> : null}
      <span>{children}</span>
      {icon ? (
        <Icon size={size} trailing>
          {icon}
        </Icon>
      ) : null}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <Link {...(rest as Omit<ButtonAsLink, keyof CommonProps>)} className={classes}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button type={type} {...buttonRest} className={classes}>
      {content}
    </button>
  );
}
