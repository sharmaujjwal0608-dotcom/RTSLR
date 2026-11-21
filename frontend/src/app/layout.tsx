import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope, Noto_Sans_Devanagari } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { I18nProvider } from "@/i18n";
import "./globals.css";

/* Fonts are self-hosted by next/font: no request leaves the site at runtime. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
  // Only needed once the interface is switched to Hindi.
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    template: "%s — RTSLR",
    default: "RTSLR — Real-time Indian Sign Language recognition",
  },
  description:
    "RTSLR is a research platform for Indian Sign Language (ISL): a camera-based recognition studio that runs in your browser, an ISL learning area and open R&D notes.",
  applicationName: "RTSLR",
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${devanagari.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-ink">
        {/* <Reveal> content must stay visible when scripts do not run. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-control focus-visible:bg-ink focus-visible:px-5 focus-visible:py-3 focus-visible:text-small focus-visible:font-semibold focus-visible:text-on-ink"
        >
          Skip to main content
        </a>
        <I18nProvider>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
