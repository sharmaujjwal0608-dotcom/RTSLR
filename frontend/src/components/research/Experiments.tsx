"use client";

import { FlaskConical } from "lucide-react";
import { Badge, ExternalLink } from "@/components/ui";
import { isHttpUrl } from "@/content/research/guards";
import { EXPERIMENT_PLANS, EXPERIMENT_PREREQUISITES, type ExperimentPlan } from "@/content/research/notes";
import type { RtslrExperiment } from "@/content/research/types";
import { defineMessages, useMessages } from "@/i18n";
import { commonMessages } from "./sections";
import {
  DocSection,
  Fact,
  Mono,
  ScrollRegion,
  SubHeading,
  captionClass,
  rowHeadClass,
  tableClass,
  tdClass,
  thClass,
} from "./parts";

/** EXPERIMENT_SPECS.md: with fewer than 5 signers a result is a pilot, not a headline claim. */
export const PILOT_SIGNER_THRESHOLD = 5;

const messages = defineMessages({
  en: {
    intro:
      "Only results that RTSLR itself measured belong here. Each one must state its dataset, number of signers, protocol, feature version and seed, and link to saved artefacts.",
    resultsTitle: "RTSLR results",
    emptyTitle: "No experiments have been run yet",
    empty:
      "RTSLR has no measured accuracy, latency or frame rate. A result appears here only after an experiment has been executed and its artefacts saved. Figures published by other groups are never shown in its place.",
    emptyCount: "Recorded runs",
    resultCount: (count: number) => (count === 1 ? "1 recorded run" : `${count} recorded runs`),
    pilot: "Pilot: fewer than 5 signers",
    date: "Date",
    experiment: "Experiment",
    dataset: "Dataset version",
    signers: "Signers",
    samples: "Samples",
    protocol: "Protocol",
    featureVersion: "Feature version",
    seed: "Seed",
    commit: "Commit",
    artefacts: "Artefacts",
    openArtefacts: "Open the saved artefacts",
    notes: "Notes",
    metricsCaption: (title: string) => `Measured metrics for ${title}`,
    metric: "Metric",
    value: "Value",
    spread: "Spread across folds",
    noSpread: "Not reported",
    plansTitle: "Planned experiments",
    plansIntro:
      "These are specifications, not results. None of them has been run. They say what will be measured and how, so that the protocol is fixed before any data is seen.",
    plan: "Plan, not run",
    outline: "Outline only, not run",
    hasRuns: "Run recorded above",
    question: "Question",
    measures: "What will be measured",
    scheduled: "Roadmap item",
    prerequisites: "Needed before any of them can start",
    plansLabel: "Planned experiment specifications",
  },
  hi: {
    intro:
      "यहाँ केवल वही नतीजे आते हैं जो RTSLR ने ख़ुद मापे हों। हर नतीजे के साथ उसका डेटासेट, संकेतकर्ताओं की संख्या, प्रोटोकॉल, फ़ीचर संस्करण और सीड लिखा होना चाहिए, और सहेजे गए आर्टिफ़ैक्ट का लिंक होना चाहिए।",
    resultsTitle: "RTSLR के नतीजे",
    emptyTitle: "अभी तक कोई प्रयोग नहीं किया गया है",
    empty:
      "RTSLR के पास सटीकता, विलंब या फ़्रेम दर का कोई माप नहीं है। कोई नतीजा यहाँ तभी दिखेगा जब प्रयोग वास्तव में किया जा चुका हो और उसके आर्टिफ़ैक्ट सहेजे गए हों। दूसरे समूहों के प्रकाशित आँकड़े उसकी जगह कभी नहीं दिखाए जाते।",
    emptyCount: "दर्ज रन",
    resultCount: (count: number) => `${count} दर्ज रन`,
    pilot: "पायलट: 5 से कम संकेतकर्ता",
    date: "तारीख़",
    experiment: "प्रयोग",
    dataset: "डेटासेट संस्करण",
    signers: "संकेतकर्ता",
    samples: "नमूने",
    protocol: "प्रोटोकॉल",
    featureVersion: "फ़ीचर संस्करण",
    seed: "सीड",
    commit: "कमिट",
    artefacts: "आर्टिफ़ैक्ट",
    openArtefacts: "सहेजे गए आर्टिफ़ैक्ट खोलें",
    notes: "टिप्पणियाँ",
    metricsCaption: (title: string) => `${title} के मापे गए मेट्रिक`,
    metric: "मेट्रिक",
    value: "मान",
    spread: "फ़ोल्ड के बीच फैलाव",
    noSpread: "नहीं बताया गया",
    plansTitle: "नियोजित प्रयोग",
    plansIntro:
      "ये विनिर्देश हैं, नतीजे नहीं। इनमें से कोई भी प्रयोग किया नहीं गया है। ये बताते हैं कि क्या और कैसे मापा जाएगा, ताकि डेटा देखने से पहले ही प्रोटोकॉल तय रहे।",
    plan: "योजना, किया नहीं गया",
    outline: "केवल रूपरेखा, किया नहीं गया",
    hasRuns: "रन ऊपर दर्ज है",
    question: "प्रश्न",
    measures: "क्या मापा जाएगा",
    scheduled: "रोडमैप मद",
    prerequisites: "इनमें से कोई भी शुरू होने से पहले ज़रूरी",
    plansLabel: "नियोजित प्रयोगों के विनिर्देश",
  },
});

function ExperimentRecord({ record }: { record: RtslrExperiment }) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const headingId = `${record.id}-title`;
  const caption = t.metricsCaption(record.title);
  return (
    <li>
      <article aria-labelledby={headingId} className="rounded-card border border-line bg-surface p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-label text-muted">
              {record.experimentId} <span aria-hidden="true">/</span> <time dateTime={record.date}>{record.date}</time>
            </p>
            <h4 id={headingId} lang="en" className="mt-1 text-h4 break-words text-ink">
              {record.title}
            </h4>
          </div>
          {record.signers < PILOT_SIGNER_THRESHOLD ? <Badge tone="warning">{t.pilot}</Badge> : null}
        </header>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t.dataset}>
            <span lang="en">{record.datasetVersion}</span>
          </Fact>
          <Fact label={t.signers}>
            <Mono>{record.signers}</Mono>
          </Fact>
          <Fact label={t.samples}>
            <Mono>{record.samples}</Mono>
          </Fact>
          <Fact label={t.protocol} className="sm:col-span-2 lg:col-span-3">
            <span lang="en">{record.protocol}</span>
          </Fact>
          <Fact label={t.featureVersion}>
            <Mono>{record.featureVersion}</Mono>
          </Fact>
          <Fact label={t.seed}>
            <Mono>{record.seed}</Mono>
          </Fact>
          <Fact label={t.commit}>
            <Mono>{record.commit}</Mono>
          </Fact>
        </dl>

        <div className="mt-6">
          <ScrollRegion label={caption}>
            <table className={`${tableClass} min-w-[28rem]`}>
              <caption className={captionClass}>{caption}</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    {t.metric}
                  </th>
                  <th scope="col" className={thClass}>
                    {t.value}
                  </th>
                  <th scope="col" className={thClass}>
                    {t.spread}
                  </th>
                </tr>
              </thead>
              <tbody>
                {record.metrics.map((metric) => (
                  <tr key={metric.name}>
                    <th scope="row" lang="en" className={rowHeadClass}>
                      {metric.name}
                    </th>
                    <td className={`${tdClass} font-mono text-label whitespace-nowrap`}>
                      {metric.value}
                      {metric.unit ? ` ${metric.unit}` : ""}
                    </td>
                    <td className={`${tdClass} font-mono text-label whitespace-nowrap`}>
                      {metric.spread === null ? (
                        <span className="font-sans text-small text-muted">{t.noSpread}</span>
                      ) : (
                        `± ${metric.spread}${metric.unit ? ` ${metric.unit}` : ""}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </div>

        <dl className="mt-5 grid gap-y-4">
          <Fact label={t.artefacts}>
            {isHttpUrl(record.artefactsUrl) ? (
              <ExternalLink href={record.artefactsUrl} newTabLabel={common.newTab} className="text-small">
                {t.openArtefacts}
              </ExternalLink>
            ) : (
              <Mono>{record.artefactsUrl}</Mono>
            )}
          </Fact>
          {record.notes ? (
            <Fact label={t.notes}>
              <span lang="en">{record.notes}</span>
            </Fact>
          ) : null}
        </dl>
      </article>
    </li>
  );
}

function PlanEntry({ plan, hasRuns }: { plan: ExperimentPlan; hasRuns: boolean }) {
  const t = useMessages(messages);
  const headingId = `plan-${plan.id}`;
  return (
    <li>
      <article aria-labelledby={headingId} className="border-b border-line py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h4 id={headingId} className="min-w-0 text-h4 break-words text-ink">
            <span className="mr-3 font-mono text-label font-medium text-muted">{plan.id}</span>
            <span lang="en">{plan.title}</span>
          </h4>
          {hasRuns ? (
            <Badge tone="info">{t.hasRuns}</Badge>
          ) : (
            <Badge tone="neutral">{plan.outlineOnly ? t.outline : t.plan}</Badge>
          )}
        </header>
        <dl className="mt-4 grid max-w-reading gap-y-4">
          <Fact label={t.question}>
            <span lang="en">{plan.question}</span>
          </Fact>
          {plan.measures.length > 0 ? (
            <Fact label={t.measures}>
              <ul lang="en" className="flex list-disc flex-col gap-1.5 pl-5">
                {plan.measures.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Fact>
          ) : null}
          {plan.roadmapId ? (
            <Fact label={t.scheduled}>
              <a
                href={`#${plan.roadmapId}`}
                className="font-mono text-label text-accent-ink underline decoration-line-strong underline-offset-4"
              >
                {plan.roadmapId}
              </a>
            </Fact>
          ) : null}
        </dl>
      </article>
    </li>
  );
}

/**
 * RTSLR's own results, then the planned experiment specifications. With no
 * records it renders an explicit empty state; it never falls back to
 * published figures.
 */
export function Experiments({ experiments }: { experiments: RtslrExperiment[] }) {
  const t = useMessages(messages);
  const ranIds = new Set(experiments.map((record) => record.experimentId));

  return (
    <DocSection id="experiments" intro={<p>{t.intro}</p>}>
      <div className="flex flex-col gap-14">
        <div>
          <SubHeading id="experiment-results">{t.resultsTitle}</SubHeading>
          {experiments.length === 0 ? (
            <div
              data-testid="experiments-empty"
              className="mt-5 flex max-w-narrow flex-col gap-5 rounded-card border-2 border-dashed border-line-strong p-8 sm:flex-row sm:items-start sm:gap-8"
            >
              <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-start sm:gap-2">
                <FlaskConical aria-hidden="true" className="size-8 text-accent" />
                <p className="font-mono text-label text-muted">
                  {t.emptyCount}: <span className="text-ink">0</span>
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-h3 text-ink">{t.emptyTitle}</p>
                <p className="max-w-reading text-body text-muted">{t.empty}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-3 font-mono text-label text-muted">{t.resultCount(experiments.length)}</p>
              <ul aria-labelledby="experiment-results" className="mt-5 flex max-w-narrow flex-col gap-6">
                {experiments.map((record) => (
                  <ExperimentRecord key={record.id} record={record} />
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <SubHeading id="experiment-plans">{t.plansTitle}</SubHeading>
          <p className="mt-3 max-w-reading text-body text-muted">{t.plansIntro}</p>
          <div className="mt-5 max-w-reading">
            <p className="text-caption font-semibold text-muted">{t.prerequisites}</p>
            <ul lang="en" className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-small text-ink">
              {EXPERIMENT_PREREQUISITES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <ul aria-label={t.plansLabel} className="mt-6 flex max-w-narrow flex-col border-t border-line">
            {EXPERIMENT_PLANS.map((plan) => (
              <PlanEntry key={plan.id} plan={plan} hasRuns={ranIds.has(plan.id)} />
            ))}
          </ul>
        </div>
      </div>
    </DocSection>
  );
}
