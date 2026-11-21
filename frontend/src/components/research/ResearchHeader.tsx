"use client";

import { Notice, Section } from "@/components/ui";
import { defineMessages, useI18n, useMessages } from "@/i18n";

const messages = defineMessages({
  en: {
    title: "Research and development",
    lead: "The working notebook behind RTSLR: how the pipeline is built, which sources were checked, what has been measured and what has not.",
    checked: "Sources last checked",
    references: "References recorded",
    verifiedOf: "verified",
    datasets: "ISL datasets surveyed",
    usedByRtslr: "used by RTSLR",
    experiments: "RTSLR experiments run",
    statusTitle: "No validated ISL model exists",
    status:
      "RTSLR has no ISL dataset, no trained ISL model and no measured accuracy, latency or frame rate. Every figure on this page comes from another group's publication and is labelled with its source. It is not suitable for medical, legal, emergency or other high-stakes communication.",
    languageTitle: "Research records are in English",
    language: "",
  },
  hi: {
    title: "शोध और विकास",
    lead: "RTSLR की कार्य-पुस्तिका: पाइपलाइन कैसे बनी है, कौन-से स्रोत जाँचे गए, क्या मापा गया है और क्या नहीं।",
    checked: "स्रोत अंतिम बार जाँचे गए",
    references: "दर्ज संदर्भ",
    verifiedOf: "सत्यापित",
    datasets: "सर्वेक्षित ISL डेटासेट",
    usedByRtslr: "RTSLR द्वारा उपयोग में",
    experiments: "RTSLR के किए गए प्रयोग",
    statusTitle: "कोई सत्यापित ISL मॉडल मौजूद नहीं है",
    status:
      "RTSLR के पास न कोई ISL डेटासेट है, न प्रशिक्षित ISL मॉडल, और न ही सटीकता, विलंब या फ़्रेम दर का कोई माप। इस पृष्ठ का हर आँकड़ा किसी अन्य समूह के प्रकाशन से लिया गया है और उसके स्रोत के साथ दिखाया गया है। यह चिकित्सा, क़ानूनी, आपातकालीन या अन्य गंभीर संचार के लिए उपयुक्त नहीं है।",
    languageTitle: "शोध अभिलेख अंग्रेज़ी में हैं",
    language:
      "इस पृष्ठ के शीर्षक और लेबल हिंदी में हैं। शोध अभिलेख — शीर्षक, सारांश, सीमाएँ, चेतावनियाँ और लाइसेंस की शब्दावली — अपनी मूल भाषा अंग्रेज़ी में ही दिखाए गए हैं, ताकि अनुवाद में उनका अर्थ न बदले।",
  },
});

export type ResearchHeaderProps = {
  checkedOn: string;
  referenceCount: number;
  verifiedReferenceCount: number;
  datasetCount: number;
  datasetsUsed: number;
  experimentCount: number;
};

export function ResearchHeader({
  checkedOn,
  referenceCount,
  verifiedReferenceCount,
  datasetCount,
  datasetsUsed,
  experimentCount,
}: ResearchHeaderProps) {
  const t = useMessages(messages);
  const { locale } = useI18n();

  const facts: [string, string][] = [
    [t.checked, checkedOn],
    [t.references, `${referenceCount} (${verifiedReferenceCount} ${t.verifiedOf})`],
    [t.datasets, `${datasetCount} (${datasetsUsed} ${t.usedByRtslr})`],
    [t.experiments, String(experimentCount)],
  ];

  return (
    <Section titleAs="h1" title={t.title} lead={t.lead} spacing="tight">
      <dl className="grid gap-x-10 gap-y-4 border-y border-line py-5 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-caption text-muted">{label}</dt>
            <dd className="font-mono text-label text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex max-w-narrow flex-col gap-4">
        <Notice tone="warning" title={t.statusTitle}>
          {t.status}
        </Notice>
        {locale === "hi" ? (
          <Notice tone="info" title={t.languageTitle}>
            {t.language}
          </Notice>
        ) : null}
      </div>
    </Section>
  );
}
