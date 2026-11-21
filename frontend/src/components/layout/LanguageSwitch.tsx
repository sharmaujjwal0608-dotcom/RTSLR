"use client";

import { LOCALES, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { layoutMessages } from "./navigation";

const SHORT: Record<string, string> = { en: "EN", hi: "हि" };

/**
 * English / हिन्दी interface switch. Two toggle buttons in a group: the
 * pressed one is the current language (state is carried by `aria-pressed`
 * and the filled pill, not by colour alone).
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const t = useMessages(layoutMessages);

  return (
    <div
      role="group"
      aria-label={t.language}
      className={cn("inline-flex shrink-0 items-center rounded-control border border-line-strong", className)}
    >
      {LOCALES.map(({ code, label }) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            aria-label={label}
            onClick={() => setLocale(code)}
            className={cn(
              "inline-flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-small font-semibold transition-colors duration-200 ease-calm",
              active ? "bg-ink text-on-ink" : "text-ink hover:bg-ink/8",
            )}
          >
            <span aria-hidden="true" className="sm:hidden">
              {SHORT[code] ?? code}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
