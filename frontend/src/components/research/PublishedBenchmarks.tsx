"use client";

import { ExternalLink, Notice } from "@/components/ui";
import { LEGACY_AUDIT, LEGACY_AUDIT_NOTES } from "@/content/research/notes";
import type { PublishedBenchmark, Reference } from "@/content/research/types";
import { defineMessages, useMessages } from "@/i18n";
import { commonMessages } from "./sections";
import {
  DocSection,
  ReferenceLink,
  ScrollRegion,
  SubHeading,
  VerifiedBadge,
  captionClass,
  rowHeadClass,
  tableClass,
  tdClass,
  thClass,
} from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "What other groups have published for landmark-based sign recognition. The table is in the order the sources were audited. It is not a ranking.",
    warningTitle: "These are not RTSLR measurements, and they cannot be compared with each other",
    warning1:
      "Every row is another group's published result, on that group's own dataset, class list and evaluation protocol. The metrics differ too: classification accuracy, detection mAP, detection rate, character error rate and a relative decrease all appear here.",
    warning2:
      "A higher number in one row does not mean a better method than a lower number in another. Most alphabet results use a random split in which the same signers appear in training and test data, which overstates what an unseen signer would get. RTSLR has no result of its own to place beside them.",
    caption: "Published results from other groups, with dataset, protocol and caveat for every value",
    method: "Method",
    language: "Sign language",
    task: "Task",
    classes: "Classes",
    dataset: "Dataset",
    metric: "Metric",
    value: "Published value",
    protocol: "Evaluation protocol",
    caveat: "Caveat",
    source: "Source",
    legacy: "In the legacy prototype",
    notInLegacy: "Not in the legacy prototype",
    appearedAs: "Appeared as",
    found: "Verification found",
    openSource: "Open the source",
    noClasses: "Not a fixed class set",
    legacyTitle: "What the audit of the legacy prototype found",
  },
  hi: {
    intro:
      "लैंडमार्क-आधारित संकेत पहचान पर दूसरे समूहों ने क्या प्रकाशित किया है। तालिका उसी क्रम में है जिसमें स्रोत जाँचे गए। यह कोई रैंकिंग नहीं है।",
    warningTitle: "ये RTSLR के माप नहीं हैं, और इनकी आपस में तुलना नहीं की जा सकती",
    warning1:
      "हर पंक्ति किसी दूसरे समूह का प्रकाशित नतीजा है — उसी समूह के अपने डेटासेट, श्रेणी-सूची और मूल्यांकन प्रोटोकॉल पर। मेट्रिक भी अलग-अलग हैं: वर्गीकरण सटीकता, डिटेक्शन mAP, डिटेक्शन दर, अक्षर त्रुटि दर और सापेक्ष गिरावट, सब यहाँ हैं।",
    warning2:
      "एक पंक्ति की बड़ी संख्या का अर्थ यह नहीं कि वह तरीक़ा दूसरी पंक्ति की छोटी संख्या वाले तरीक़े से बेहतर है। वर्णमाला के ज़्यादातर नतीजे ऐसे रैंडम विभाजन पर हैं जिसमें वही संकेतकर्ता प्रशिक्षण और परीक्षण, दोनों में होते हैं; इससे अनदेखे संकेतकर्ता पर मिलने वाला नतीजा बढ़ा-चढ़ाकर दिखता है। इनके साथ रखने के लिए RTSLR के पास अपना कोई नतीजा नहीं है।",
    caption: "दूसरे समूहों के प्रकाशित नतीजे — हर मान के साथ डेटासेट, प्रोटोकॉल और चेतावनी",
    method: "विधि",
    language: "सांकेतिक भाषा",
    task: "कार्य",
    classes: "श्रेणियाँ",
    dataset: "डेटासेट",
    metric: "मेट्रिक",
    value: "प्रकाशित मान",
    protocol: "मूल्यांकन प्रोटोकॉल",
    caveat: "चेतावनी",
    source: "स्रोत",
    legacy: "पुराने प्रोटोटाइप में",
    notInLegacy: "पुराने प्रोटोटाइप में नहीं था",
    appearedAs: "इस रूप में था",
    found: "सत्यापन में मिला",
    openSource: "स्रोत खोलें",
    noClasses: "श्रेणियों का तय समूह नहीं",
    legacyTitle: "पुराने प्रोटोटाइप की जाँच में क्या मिला",
  },
});

export function PublishedBenchmarks({
  benchmarks,
  references,
}: {
  benchmarks: PublishedBenchmark[];
  references: Reference[];
}) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const referenceById = new Map(references.map((reference) => [reference.id, reference]));

  return (
    <DocSection id="benchmarks" intro={<p>{t.intro}</p>}>
      <Notice tone="danger" title={t.warningTitle} className="mb-8 max-w-narrow">
        <div className="flex flex-col gap-2">
          <p>{t.warning1}</p>
          <p>{t.warning2}</p>
        </div>
      </Notice>

      <ScrollRegion label={t.caption}>
        <table className={`${tableClass} min-w-[112rem]`}>
          <caption className={captionClass}>{t.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${thClass} w-[16rem]`}>
                {t.method}
              </th>
              <th scope="col" className={thClass}>
                {t.language}
              </th>
              <th scope="col" className={`${thClass} w-[11rem]`}>
                {t.task}
              </th>
              <th scope="col" className={thClass}>
                {t.classes}
              </th>
              <th scope="col" className={`${thClass} w-[14rem]`}>
                {t.dataset}
              </th>
              <th scope="col" className={`${thClass} w-[10rem]`}>
                {t.metric}
              </th>
              <th scope="col" className={thClass}>
                {t.value}
              </th>
              <th scope="col" className={`${thClass} w-[16rem]`}>
                {t.protocol}
              </th>
              <th scope="col" className={`${thClass} w-[22rem]`}>
                {t.caveat}
              </th>
              <th scope="col" className={`${thClass} w-[12rem]`}>
                {t.source}
              </th>
              <th scope="col" className={`${thClass} w-[18rem]`}>
                {t.legacy}
              </th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row) => {
              const reference = referenceById.get(row.referenceId);
              const legacy = LEGACY_AUDIT[row.id];
              return (
                <tr key={row.id}>
                  <th scope="row" lang="en" className={rowHeadClass}>
                    {row.method}
                  </th>
                  <td lang="en" className={tdClass}>
                    {row.signLanguage}
                  </td>
                  <td lang="en" className={tdClass}>
                    {row.task}
                  </td>
                  <td className={`${tdClass} font-mono text-label`}>
                    {row.classes === null ? (
                      <span className="font-sans text-small text-muted">{t.noClasses}</span>
                    ) : (
                      row.classes
                    )}
                  </td>
                  <td lang="en" className={tdClass}>
                    {row.dataset}
                  </td>
                  <td lang="en" className={tdClass}>
                    {row.metricName}
                  </td>
                  <td className={`${tdClass} font-mono text-label whitespace-nowrap`}>{row.metricValue}</td>
                  <td lang="en" className={tdClass}>
                    {row.evaluationProtocol}
                  </td>
                  <td lang="en" className={`${tdClass} text-muted`}>
                    {row.caveat}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-col items-start gap-2">
                      {reference ? (
                        <>
                          <ExternalLink href={reference.url} newTabLabel={common.newTab} className="text-small">
                            {t.openSource}
                          </ExternalLink>
                          <VerifiedBadge verified={reference.verified} />
                        </>
                      ) : null}
                      <ReferenceLink id={row.referenceId} />
                    </div>
                  </td>
                  <td className={tdClass}>
                    {legacy ? (
                      <dl className="flex flex-col gap-2">
                        <div>
                          <dt className="text-caption font-semibold text-muted">
                            {t.appearedAs}
                          </dt>
                          <dd lang="en">{legacy.appearedAs}</dd>
                        </div>
                        <div>
                          <dt className="text-caption font-semibold text-muted">
                            {t.found}
                          </dt>
                          <dd lang="en">{legacy.finding}</dd>
                        </div>
                      </dl>
                    ) : (
                      <span className="text-muted">{t.notInLegacy}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollRegion>

      <div className="mt-10 max-w-reading">
        <SubHeading>{t.legacyTitle}</SubHeading>
        <ul lang="en" className="mt-4 flex list-disc flex-col gap-2 pl-5 text-body text-ink">
          {LEGACY_AUDIT_NOTES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </DocSection>
  );
}
