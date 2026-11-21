"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { SECTION_IDS, sectionTitles, type SectionId } from "./sections";

const messages = defineMessages({
  en: { contents: "On this page", jump: "Jump to section" },
  hi: { contents: "इस पृष्ठ पर", jump: "अनुभाग पर जाएँ" },
});

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

/** Tracks which document section is currently near the top of the viewport. */
function useActiveSection(): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>(SECTION_IDS[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && isSectionId(entry.target.id)) setActive(entry.target.id);
        }
      },
      // A band in the upper part of the viewport: the section crossing it is "current".
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return [active, setActive];
}

/**
 * In-page contents for the R&D document: a compact sticky jump menu below
 * `lg`, a sticky list from `lg`. Render it as a direct child of the element
 * that wraps the whole document so the sticky positioning spans every section.
 */
export function ResearchContents() {
  const t = useMessages(messages);
  const titles = useMessages(sectionTitles);
  const [active, setActive] = useActiveSection();
  const selectId = useId();

  function jumpTo(id: SectionId) {
    setActive(id);
    // Changing the fragment scrolls natively (respecting scroll-margin and
    // reduced motion) and keeps the address shareable.
    window.location.hash = id;
    document.getElementById(id)?.focus({ preventScroll: true });
  }

  return (
    <>
      <div className="sticky top-header z-10 -mx-gutter mb-10 flex items-center gap-3 border-b border-line bg-background px-gutter py-3 lg:hidden">
        <label htmlFor={selectId} className="shrink-0 text-small font-semibold text-ink">
          {t.jump}
        </label>
        <div className="relative min-w-0 flex-1">
          <select
            id={selectId}
            value={active}
            onChange={(event) => {
              if (isSectionId(event.target.value)) jumpTo(event.target.value);
            }}
            className="h-11 w-full appearance-none rounded-field border border-line-strong bg-surface pr-10 pl-3 text-small text-ink hover:border-ink"
          >
            {SECTION_IDS.map((id, index) => (
              <option key={id} value={id}>
                {index + 1}. {titles[id]}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          />
        </div>
      </div>

      <nav aria-label={t.contents} className="hidden lg:col-span-3 lg:block">
        <div className="sticky top-header max-h-[calc(100svh-var(--header-height))] overflow-y-auto pt-10 pb-8">
          <p className="mb-4 text-small font-semibold text-ink">{t.contents}</p>
          <ol className="flex flex-col border-l border-line">
            {SECTION_IDS.map((id, index) => {
              const current = id === active;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={current ? "location" : undefined}
                    onClick={() => setActive(id)}
                    className={cn(
                      "-ml-px flex items-baseline gap-3 border-l-2 py-2 pl-4 text-small transition-colors duration-200 ease-calm",
                      current
                        ? "border-ink font-semibold text-ink"
                        : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    <span aria-hidden="true" className="w-5 shrink-0 font-mono text-label">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{titles[id]}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
