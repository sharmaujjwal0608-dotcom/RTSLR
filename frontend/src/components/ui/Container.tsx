import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

export type ContainerSize = "reading" | "narrow" | "page" | "wide";

const sizes: Record<ContainerSize, string> = {
  reading: "max-w-reading",
  narrow: "max-w-narrow",
  page: "max-w-page",
  wide: "max-w-wide",
};

export type ContainerProps = Omit<ComponentPropsWithoutRef<"div">, "className"> & {
  /** reading 42rem · narrow 60rem · page 80rem (default) · wide 92rem */
  size?: ContainerSize;
  as?: ElementType;
  className?: string;
};

/** Centred column with the shared page gutter. Every page section sits in one. */
export function Container({ size = "page", as: Tag = "div", className, ...rest }: ContainerProps) {
  return <Tag className={cn("mx-auto w-full px-gutter", sizes[size], className)} {...rest} />;
}
