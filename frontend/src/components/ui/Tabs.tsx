"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  /** Stable id, unique within this Tabs instance. */
  id: string;
  label: ReactNode;
  /** Optional icon before the label. */
  icon?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  /** Accessible name of the tab list, e.g. "Recognition mode". */
  label: string;
  /** Controlled selected id. */
  value?: string;
  /** Initial id when uncontrolled. Defaults to the first enabled tab. */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** pill: segmented control (default). underline: page-level sub-navigation. */
  variant?: "pill" | "underline";
  className?: string;
  panelClassName?: string;
};

/**
 * WAI-ARIA tabs with a roving tabindex: Tab enters the list on the selected
 * tab, Left/Right/Home/End move and select, Tab leaves to the panel.
 * Panels stay mounted (hidden) so their state survives switching.
 */
export function Tabs({
  items,
  label,
  value,
  defaultValue,
  onValueChange,
  variant = "pill",
  className,
  panelClassName,
}: TabsProps) {
  const baseId = useId();
  const firstEnabled = items.find((item) => !item.disabled)?.id;
  const [internal, setInternal] = useState(defaultValue ?? firstEnabled);
  const requested = value ?? internal;
  const selected = items.some((item) => item.id === requested) ? requested : firstEnabled;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.id === selected);
    if (enabled.length === 0) return;

    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % enabled.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    select(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div className={className}>
      {/* The list scrolls sideways on narrow screens instead of wrapping. */}
      <div className="-mx-1 overflow-x-auto px-1 py-1">
        <div
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className={cn(
            "inline-flex min-w-max items-center",
            variant === "pill"
              ? "gap-1 rounded-control border border-line bg-background-secondary p-1"
              : "gap-6 border-b border-line",
          )}
        >
          {items.map((item) => {
            const isSelected = item.id === selected;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(item.id, node);
                  else tabRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${item.id}`}
                aria-selected={isSelected}
                aria-controls={`${baseId}-panel-${item.id}`}
                tabIndex={isSelected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => select(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 text-small font-semibold whitespace-nowrap transition-colors duration-200 ease-calm disabled:opacity-45",
                  variant === "pill"
                    ? cn(
                        "h-10 rounded-control px-4",
                        isSelected ? "bg-ink text-on-ink" : "text-muted hover:text-ink",
                      )
                    : cn(
                        "-mb-px h-11 border-b-2 px-0.5",
                        isSelected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                      ),
                )}
              >
                {item.icon ? (
                  <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-4">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
          className={cn("mt-6 rounded-card", panelClassName)}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
