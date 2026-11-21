"use client";

/**
 * RTSLR interface localisation core (English / Hindi).
 *
 * This is INTERFACE localisation only. It says nothing about whether a sign
 * can be translated into Hindi; that is decided by features/language.
 *
 * Usage, co-located with each component or feature:
 *
 *   const messages = defineMessages({
 *     en: { title: "Learn ISL" },
 *     hi: { title: "आईएसएल सीखें" },
 *   });
 *   const t = useMessages(messages);   // t.title
 *
 * Owned by Agent 00; Agent 10 reviews Hindi copy.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "hi";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

const STORAGE_KEY = "rtslr.locale";

type I18nValue = { locale: Locale; setLocale: (l: Locale) => void };
const I18nContext = createContext<I18nValue>({ locale: "en", setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always render "en" first so server and client markup match, then adopt
  // the stored preference after mount.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "hi" || stored === "en") setLocaleState(stored);
    } catch {
      /* storage unavailable: stay on the default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Identity helper that forces `hi` to have the same keys as `en`. */
export function defineMessages<T extends Record<string, unknown>>(m: { en: T; hi: T }) {
  return m;
}

export function useMessages<T>(m: { en: T; hi: T }): T {
  const { locale } = useI18n();
  return m[locale];
}
