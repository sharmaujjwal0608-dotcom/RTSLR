"use client";

import { useMemo, useState } from "react";
import { Badge, Button, ExternalLink, Input, Notice, Select } from "@/components/ui";
import {
  EMPTY_DATASET_FILTER,
  datasetFilterOptions,
  filterDatasets,
  isFilterActive,
  type DatasetFilter,
  type VerificationFilter,
} from "@/content/research/datasetFilter";
import type { Dataset, DatasetMotion } from "@/content/research/types";
import { defineMessages, useMessages } from "@/i18n";
import { commonMessages } from "./sections";
import { DocSection, Fact, VerifiedBadge } from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "Candidate ISL datasets found in the source survey. No files were downloaded or inspected: each entry records what its source page says, and \"unverified\" means the page could not be opened.",
    noneUsedTitle: "RTSLR uses none of these datasets",
    noneUsed:
      "No verified, freely downloadable, multi-signer dataset of static ISL letters and digits was found. A licence must be re-read on its source page before any dataset is used.",
    filters: "Filter datasets",
    search: "Search",
    searchHint: "Name, classes, licence or description",
    language: "Sign language",
    motion: "Sign type",
    verification: "Verification",
    all: "All",
    motions: { static: "Static", dynamic: "Dynamic", both: "Static and dynamic" } satisfies Record<DatasetMotion, string>,
    count: (shown: number, total: number) => `Showing ${shown} of ${total} datasets`,
    reset: "Clear filters",
    emptyTitle: "No dataset matches these filters",
    empty: "Remove a filter or clear the search to see the full list.",
    listLabel: "Datasets",
    classes: "Classes",
    size: "Size",
    signers: "Signers",
    modality: "Modality",
    licence: "Licence, as recorded",
    usedByRtslr: "Used by RTSLR",
    openSource: "Open the source page",
  },
  hi: {
    intro:
      "स्रोत सर्वेक्षण में मिले संभावित ISL डेटासेट। कोई फ़ाइल डाउनलोड या जाँची नहीं गई: हर प्रविष्टि वही दर्ज करती है जो उसके स्रोत पृष्ठ पर लिखा है, और \"असत्यापित\" का अर्थ है कि वह पृष्ठ खोला नहीं जा सका।",
    noneUsedTitle: "RTSLR इनमें से किसी डेटासेट का उपयोग नहीं करता",
    noneUsed:
      "स्थिर ISL अक्षरों और अंकों का ऐसा कोई डेटासेट नहीं मिला जो सत्यापित हो, मुफ़्त डाउनलोड हो सके और जिसमें कई संकेतकर्ता हों। किसी भी डेटासेट के उपयोग से पहले उसका लाइसेंस उसके स्रोत पृष्ठ पर दोबारा पढ़ना ज़रूरी है।",
    filters: "डेटासेट छाँटें",
    search: "खोजें",
    searchHint: "नाम, श्रेणियाँ, लाइसेंस या विवरण",
    language: "सांकेतिक भाषा",
    motion: "संकेत का प्रकार",
    verification: "सत्यापन",
    all: "सभी",
    motions: { static: "स्थिर", dynamic: "गतिशील", both: "स्थिर और गतिशील" } satisfies Record<DatasetMotion, string>,
    count: (shown: number, total: number) => `${total} में से ${shown} डेटासेट दिखाए जा रहे हैं`,
    reset: "फ़िल्टर हटाएँ",
    emptyTitle: "इन फ़िल्टरों से कोई डेटासेट मेल नहीं खाता",
    empty: "पूरी सूची देखने के लिए कोई फ़िल्टर हटाएँ या खोज साफ़ करें।",
    listLabel: "डेटासेट",
    classes: "श्रेणियाँ",
    size: "आकार",
    signers: "संकेतकर्ता",
    modality: "माध्यम",
    licence: "लाइसेंस, जैसा दर्ज है",
    usedByRtslr: "RTSLR द्वारा उपयोग",
    openSource: "स्रोत पृष्ठ खोलें",
  },
});

function DatasetEntry({ dataset }: { dataset: Dataset }) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const headingId = `${dataset.id}-name`;
  return (
    <li>
      <article aria-labelledby={headingId} className="border-b border-line py-8">
        <header className="flex flex-col gap-3">
          <h3 id={headingId} lang="en" className="text-h4 break-words text-ink">
            {dataset.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            <VerifiedBadge verified={dataset.verified} />
            <Badge plain>{dataset.signLanguage}</Badge>
            <Badge plain>{t.motions[dataset.staticOrDynamic]}</Badge>
          </div>
        </header>

        <p lang="en" className="mt-4 max-w-reading text-body text-ink">
          {dataset.description}
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Fact label={t.classes}>
            <span lang="en">{dataset.classes}</span>
          </Fact>
          <Fact label={t.signers}>
            <span lang="en">{dataset.signers}</span>
          </Fact>
          <Fact label={t.size}>
            <span lang="en">{dataset.size}</span>
          </Fact>
          <Fact label={t.modality}>
            <span lang="en">{dataset.modality}</span>
          </Fact>
          <Fact label={t.licence} className="sm:col-span-2">
            <span lang="en">{dataset.license}</span>
          </Fact>
          <Fact label={common.verificationNote} className="sm:col-span-2">
            <span lang="en">{dataset.verificationNote}</span>
          </Fact>
          <Fact label={common.limitations} className="sm:col-span-2">
            <span lang="en">{dataset.limitations}</span>
          </Fact>
          <Fact label={t.usedByRtslr}>{dataset.usedByRtslr ? common.yes : common.no}</Fact>
          <Fact label={common.source}>
            <ExternalLink href={dataset.url} newTabLabel={common.newTab} className="text-small">
              {t.openSource}
            </ExternalLink>
          </Fact>
        </dl>
      </article>
    </li>
  );
}

export function DatasetExplorer({ datasets }: { datasets: Dataset[] }) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const [filter, setFilter] = useState<DatasetFilter>(EMPTY_DATASET_FILTER);

  const options = useMemo(() => datasetFilterOptions(datasets), [datasets]);
  const shown = useMemo(() => filterDatasets(datasets, filter), [datasets, filter]);
  const update = (patch: Partial<DatasetFilter>) => setFilter((current) => ({ ...current, ...patch }));

  return (
    <DocSection id="datasets" intro={<p>{t.intro}</p>}>
      <Notice tone="warning" title={t.noneUsedTitle} className="max-w-narrow">
        {t.noneUsed}
      </Notice>

      <form
        role="search"
        aria-label={t.filters}
        onSubmit={(event) => event.preventDefault()}
        className="mt-8 grid max-w-narrow gap-5 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Input
          label={t.search}
          hint={t.searchHint}
          type="search"
          value={filter.query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <Select
          label={t.language}
          value={filter.language}
          onChange={(event) => update({ language: event.target.value })}
          options={[
            { value: "all", label: t.all },
            ...options.languages.map((language) => ({ value: language, label: language })),
          ]}
        />
        <Select
          label={t.motion}
          value={filter.motion}
          onChange={(event) => update({ motion: event.target.value as DatasetFilter["motion"] })}
          options={[
            { value: "all", label: t.all },
            ...options.motions.map((motion) => ({ value: motion, label: t.motions[motion] })),
          ]}
        />
        <Select
          label={t.verification}
          value={filter.verification}
          onChange={(event) => update({ verification: event.target.value as VerificationFilter })}
          options={[
            { value: "all", label: t.all },
            { value: "verified", label: common.verified },
            { value: "unverified", label: common.unverified },
          ]}
        />
      </form>

      <div className="mt-5 flex min-h-11 max-w-narrow flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="font-mono text-label text-ink">
          {t.count(shown.length, datasets.length)}
        </p>
        {isFilterActive(filter) ? (
          <Button variant="secondary" onClick={() => setFilter(EMPTY_DATASET_FILTER)}>
            {t.reset}
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <Notice tone="neutral" title={t.emptyTitle} className="mt-4 max-w-narrow">
          {t.empty}
        </Notice>
      ) : (
        <ul aria-label={t.listLabel} className="mt-2 flex max-w-narrow flex-col border-t border-line">
          {shown.map((dataset) => (
            <DatasetEntry key={dataset.id} dataset={dataset} />
          ))}
        </ul>
      )}
    </DocSection>
  );
}
