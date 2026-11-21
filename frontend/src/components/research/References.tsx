"use client";

import { ExternalLink } from "@/components/ui";
import type { Reference } from "@/content/research/types";
import { defineMessages, useMessages } from "@/i18n";
import { commonMessages } from "./sections";
import { DocSection, Mono, VerifiedBadge } from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "Every source the research notes rely on. \"Verified\" means the page was opened and the recorded facts were read on it; the note says how far that reading went. \"Unverified\" means the page could not be opened.",
    count: (total: number, verified: number) => `${total} references: ${verified} verified, ${total - verified} unverified`,
    listLabel: "Reference list",
    noYear: "no date",
    summary: "What it says",
  },
  hi: {
    intro:
      "वे सभी स्रोत जिन पर शोध टिप्पणियाँ टिकी हैं। \"सत्यापित\" का अर्थ है कि पृष्ठ खोला गया और दर्ज तथ्य उसी पर पढ़े गए; टिप्पणी बताती है कि कितना पढ़ा गया। \"असत्यापित\" का अर्थ है कि पृष्ठ खोला नहीं जा सका।",
    count: (total: number, verified: number) =>
      `${total} संदर्भ: ${verified} सत्यापित, ${total - verified} असत्यापित`,
    listLabel: "संदर्भ सूची",
    noYear: "तारीख़ नहीं",
    summary: "इसमें क्या कहा गया है",
  },
});

export function References({ references }: { references: Reference[] }) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const verified = references.filter((reference) => reference.verified).length;

  return (
    <DocSection id="references" intro={<p>{t.intro}</p>}>
      <p className="font-mono text-label text-ink">{t.count(references.length, verified)}</p>
      <ol aria-label={t.listLabel} className="mt-5 flex max-w-narrow flex-col border-t border-line">
        {references.map((reference) => (
          <li
            key={reference.id}
            id={reference.id}
            tabIndex={-1}
            className="flex scroll-mt-40 flex-col gap-3 border-b border-line py-6 outline-none target:bg-accent-soft lg:scroll-mt-28"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Mono className="text-muted">{reference.id}</Mono>
              <VerifiedBadge verified={reference.verified} />
            </div>
            <p lang="en" className="text-h4 break-words text-ink">
              <ExternalLink href={reference.url} newTabLabel={common.newTab}>
                {reference.title}
              </ExternalLink>
            </p>
            <p className="text-small text-muted">
              <span lang="en">{reference.authors.join(", ")}</span>
              {" ("}
              {reference.year ?? t.noYear}
              {"). "}
              <span lang="en">{reference.venue}</span>
            </p>
            <dl className="flex max-w-reading flex-col gap-3">
              <div>
                <dt className="text-caption font-semibold text-muted">{t.summary}</dt>
                <dd lang="en" className="mt-1 text-small text-ink">
                  {reference.summary}
                </dd>
              </div>
              <div>
                <dt className="text-caption font-semibold text-muted">{common.verificationNote}</dt>
                <dd lang="en" className="mt-1 text-small text-ink">
                  {reference.verificationNote}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </DocSection>
  );
}
