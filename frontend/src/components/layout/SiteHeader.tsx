"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button, Container } from "@/components/ui";
import { useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { LanguageSwitch } from "./LanguageSwitch";
import { NAV_ITEMS, STUDIO_HREF, isActiveRoute, layoutMessages } from "./navigation";

/* ------------------------------------------------------ external stores */

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}
const getScrolled = () => window.scrollY > 4;

const DESKTOP_QUERY = "(min-width: 64rem)"; /* Tailwind `lg` */
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
const serverFalse = () => false;

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
    (element) => element.getClientRects().length > 0,
  );
}

/* --------------------------------------------------------------- header */

function HeaderView({ pathname }: { pathname: string | null }) {
  const t = useMessages(layoutMessages);
  const sheetId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButtonId = useId();

  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, serverFalse);
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktop, serverFalse);

  /* The sheet remembers the route it was opened on, so any route change
     (link, back/forward) closes it without an effect. */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === (pathname ?? "") && !isDesktop;

  const close = useCallback((returnFocus: boolean) => {
    setOpenedOn(null);
    if (returnFocus) document.getElementById(menuButtonId)?.focus();
  }, [menuButtonId]);

  useEffect(() => {
    if (!open) return;

    /* Scroll lock, and everything outside the header becomes inert. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const outside = [document.getElementById("main"), document.querySelector<HTMLElement>("[data-site-footer]")].filter(
      (element): element is HTMLElement => element !== null,
    );
    for (const element of outside) element.inert = true;

    /* Move focus into the sheet. */
    const sheet = sheetRef.current;
    if (sheet) focusableIn(sheet)[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab") return;
      const header = headerRef.current;
      if (!header) return;
      /* Trap: the header bar (wordmark, language, Close) and the sheet form one loop. */
      const items = focusableIn(header);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!(current instanceof HTMLElement) || !header.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const element of outside) element.inert = false;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-40 border-b bg-background transition-colors duration-200 ease-calm",
        scrolled || open ? "border-line" : "border-transparent",
      )}
    >
      <Container size="wide" className="flex h-header items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={t.brandLabel}
          className="inline-flex h-11 items-center rounded-field text-h3 font-extrabold text-ink"
        >
          RTSLR
        </Link>

        <nav aria-label={t.primaryNav} className="hidden lg:block">
          <ul className="flex items-center gap-1 xl:gap-3">
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="group/nav inline-flex h-11 items-center rounded-field px-3 text-small font-semibold text-ink"
                  >
                    <span
                      className={cn(
                        "border-b-2 py-1 transition-colors duration-200 ease-calm",
                        active ? "border-ink" : "border-transparent group-hover/nav:border-line-strong",
                      )}
                    >
                      {t.nav[item.key]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitch />
          <Button href={STUDIO_HREF} icon={<ArrowUpRight />} className="hidden lg:inline-flex">
            {t.getStarted}
          </Button>
          <Button
            id={menuButtonId}
            variant="secondary"
            className="lg:hidden"
            leadingIcon={open ? <X /> : <Menu />}
            aria-expanded={open}
            aria-controls={sheetId}
            onClick={() => (open ? close(false) : setOpenedOn(pathname ?? ""))}
          >
            {open ? t.close : t.menu}
          </Button>
        </div>
      </Container>

      {/* Mobile sheet: full-screen, cream, below the header bar. */}
      <div
        ref={sheetRef}
        id={sheetId}
        hidden={!open}
        className={cn(
          "fixed inset-x-0 top-header bottom-0 z-40 overflow-y-auto overscroll-contain bg-background lg:hidden",
          open && "animate-fade-in",
        )}
      >
        <Container className="flex min-h-full flex-col justify-between gap-10 pt-6 pb-8">
          <nav aria-label={t.menuSheet}>
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <li key={item.href} className="border-b border-line">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => close(false)}
                      className="flex min-h-14 items-center justify-between gap-4 py-3 text-h2 break-words text-ink"
                    >
                      <span className={cn(active && "underline decoration-2 underline-offset-8")}>
                        {t.nav[item.key]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Button href={STUDIO_HREF} size="lg" fullWidth icon={<ArrowUpRight />} onClick={() => close(false)}>
            {t.getStarted}
          </Button>
        </Container>
      </div>
    </header>
  );
}

function HeaderWithPathname() {
  return <HeaderView pathname={usePathname()} />;
}

/**
 * Sticky site header: wordmark, primary navigation with the current route
 * marked, language switch and the "Get Started" action. Below `lg` the links
 * move into a full-screen sheet behind a "Menu" button.
 *
 * `usePathname` can suspend on routes with unknown dynamic params (Next 16,
 * cacheComponents), so the route-aware header sits in a Suspense boundary
 * whose fallback is the same header without an active item.
 */
export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderView pathname={null} />}>
      <HeaderWithPathname />
    </Suspense>
  );
}
