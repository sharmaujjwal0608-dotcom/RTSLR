"use client";

import { ArrowUpRight, RotateCw } from "lucide-react";
import { useEffect } from "react";
import { Button, Container, Heading, Lead } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { NAV_ITEMS, STUDIO_HREF, layoutMessages } from "./navigation";

const messages = defineMessages({
  en: {
    notFoundTitle: "This page does not exist",
    notFoundLead: "The address may be mistyped, or the page may have moved. These pages do exist:",
    home: "Go to the home page",
    studio: "Open the studio",
    errorTitle: "This page could not be shown",
    errorLead:
      "Something went wrong while loading it. Your camera data is not affected: it never leaves your browser. Try again, or go back to the home page.",
    retry: "Try again",
    reference: "Error reference",
    loading: "Loading the page…",
  },
  hi: {
    notFoundTitle: "यह पन्ना मौजूद नहीं है",
    notFoundLead: "हो सकता है पता ग़लत लिखा गया हो, या पन्ना कहीं और चला गया हो। ये पन्ने मौजूद हैं:",
    home: "होम पर जाएँ",
    studio: "स्टूडियो खोलें",
    errorTitle: "यह पन्ना दिखाया नहीं जा सका",
    errorLead:
      "इसे लोड करते समय कुछ गड़बड़ हुई। आपके कैमरे के डेटा पर इसका कोई असर नहीं है: वह कभी आपके ब्राउज़र से बाहर नहीं जाता। दोबारा कोशिश करें, या होम पर लौटें।",
    retry: "दोबारा कोशिश करें",
    reference: "त्रुटि संदर्भ",
    loading: "पन्ना लोड हो रहा है…",
  },
});

export function NotFoundContent() {
  const t = useMessages(messages);
  const nav = useMessages(layoutMessages);

  return (
    <Container size="narrow" className="flex flex-1 flex-col justify-center gap-8 py-section">
      <p className="font-mono text-small text-muted">404</p>
      <Heading size="h1">{t.notFoundTitle}</Heading>
      <Lead>{t.notFoundLead}</Lead>
      <ul className="flex flex-wrap gap-3">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Button href={item.href} variant="secondary">
              {nav.nav[item.key]}
            </Button>
          </li>
        ))}
        <li>
          <Button href={STUDIO_HREF} icon={<ArrowUpRight />}>
            {t.studio}
          </Button>
        </li>
      </ul>
    </Container>
  );
}

export function ErrorContent({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useMessages(messages);
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container size="narrow" className="flex flex-1 flex-col justify-center gap-8 py-section">
      <div role="alert" className="flex flex-col gap-6">
        <Heading size="h1">{t.errorTitle}</Heading>
        <Lead>{t.errorLead}</Lead>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button size="lg" leadingIcon={<RotateCw />} onClick={() => retry()}>
          {t.retry}
        </Button>
        <Button href="/" size="lg" variant="secondary">
          {t.home}
        </Button>
      </div>
      {digest ? (
        <p className="font-mono text-label text-muted">
          {t.reference}: {digest}
        </p>
      ) : null}
    </Container>
  );
}

export function LoadingContent() {
  const t = useMessages(messages);
  return (
    <Container className="flex flex-1 flex-col justify-center py-section">
      <p role="status" className="animate-fade-in text-small font-semibold text-muted">
        {t.loading}
      </p>
    </Container>
  );
}
