"use client";

import { ASSUMPTIONS, ESTABLISHED_FACTS } from "@/content/research/notes";
import { defineMessages, useMessages } from "@/i18n";
import {
  DocSection,
  Mono,
  ReferenceLink,
  ScrollRegion,
  SubHeading,
  captionClass,
  rowHeadClass,
  tableClass,
  tdClass,
  thClass,
} from "./parts";

const messages = defineMessages({
  en: {
    goalTitle: "What RTSLR is trying to do",
    goal1:
      "RTSLR aims to recognise Indian Sign Language (ISL) from an ordinary camera, in the browser, without sending video anywhere. Hand landmarks are extracted on the device and classified there.",
    goal2:
      "The first milestone is deliberately narrow: static ISL fingerspelling and digits, evaluated on signers the model has never seen. It is not \"ISL recognition\". Signs that depend on movement, the face or the body are outside what a hands-only, single-frame pipeline can represent.",
    goal3:
      "Today the pipeline runs end to end, but only with a legacy ASL rule set, with samples a user records in their own browser, or with a simulator. None of these is validated ISL recognition.",
    establishedTitle: "What is established",
    establishedIntro: "Statements read on a source that was opened. The ids link to the reference list.",
    assumedTitle: "What is assumed",
    assumedIntro:
      "These statements are used in planning but were not verified against a source. Each one names the work that would settle it.",
    assumptionsCaption: "Open and unsupported assumptions, from the research notes (section 9)",
    colId: "No.",
    colAssumption: "Assumption",
    colWhy: "Why it is unverified",
    colResolve: "How to resolve it",
    noSource: "RTSLR dataset survey (see Dataset explorer)",
  },
  hi: {
    goalTitle: "RTSLR क्या करने की कोशिश कर रहा है",
    goal1:
      "RTSLR का लक्ष्य साधारण कैमरे से, ब्राउज़र के भीतर ही, भारतीय सांकेतिक भाषा (ISL) को पहचानना है — वीडियो कहीं भेजे बिना। हाथ के लैंडमार्क डिवाइस पर ही निकाले जाते हैं और वहीं वर्गीकृत होते हैं।",
    goal2:
      "पहला पड़ाव जान-बूझकर सीमित रखा गया है: स्थिर ISL फ़िंगरस्पेलिंग और अंक, जिनका मूल्यांकन ऐसे संकेतकर्ताओं पर हो जिन्हें मॉडल ने पहले कभी नहीं देखा। यह \"ISL पहचान\" नहीं है। जो संकेत गति, चेहरे या शरीर पर निर्भर हैं, वे केवल हाथों और एक फ़्रेम पर आधारित पाइपलाइन की पहुँच से बाहर हैं।",
    goal3:
      "आज पाइपलाइन शुरू से अंत तक चलती है, पर केवल पुराने ASL नियमों के साथ, उपयोगकर्ता द्वारा अपने ब्राउज़र में रिकॉर्ड किए गए नमूनों के साथ, या सिम्युलेटर के साथ। इनमें से कोई भी सत्यापित ISL पहचान नहीं है।",
    establishedTitle: "क्या स्थापित है",
    establishedIntro: "ऐसे कथन जो खोले गए स्रोत पर पढ़े गए। आईडी संदर्भ सूची से जुड़ी हैं।",
    assumedTitle: "क्या माना गया है",
    assumedIntro:
      "ये कथन योजना बनाने में इस्तेमाल हुए हैं, पर किसी स्रोत से सत्यापित नहीं किए गए। हर कथन के साथ वह काम लिखा है जिससे वह तय होगा।",
    assumptionsCaption: "खुली और असमर्थित मान्यताएँ, शोध टिप्पणियों (अनुभाग 9) से",
    colId: "क्र.",
    colAssumption: "मान्यता",
    colWhy: "असत्यापित क्यों है",
    colResolve: "कैसे तय होगा",
    noSource: "RTSLR का डेटासेट सर्वेक्षण (डेटासेट एक्सप्लोरर देखें)",
  },
});

export function Overview() {
  const t = useMessages(messages);
  return (
    <DocSection id="overview">
      <div className="flex flex-col gap-14">
        <div>
          <SubHeading>{t.goalTitle}</SubHeading>
          <div className="mt-4 flex max-w-reading flex-col gap-4 text-body text-ink">
            <p>{t.goal1}</p>
            <p>{t.goal2}</p>
            <p>{t.goal3}</p>
          </div>
        </div>

        <div>
          <SubHeading>{t.establishedTitle}</SubHeading>
          <p className="mt-3 max-w-reading text-body text-muted">{t.establishedIntro}</p>
          <ul className="mt-6 flex max-w-narrow flex-col border-t border-line">
            {ESTABLISHED_FACTS.map((fact) => (
              <li key={fact.statement} className="flex flex-col gap-2 border-b border-line py-4">
                <p lang="en" className="max-w-reading text-body text-ink">
                  {fact.statement}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  {fact.referenceIds.length > 0 ? (
                    fact.referenceIds.map((id) => <ReferenceLink key={id} id={id} />)
                  ) : (
                    <a
                      href="#datasets"
                      className="text-caption text-accent-ink underline decoration-line-strong underline-offset-4"
                    >
                      {t.noSource}
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SubHeading>{t.assumedTitle}</SubHeading>
          <p className="mt-3 mb-6 max-w-reading text-body text-muted">{t.assumedIntro}</p>
          <ScrollRegion label={t.assumptionsCaption}>
            <table className={`${tableClass} min-w-[44rem]`}>
              <caption className={captionClass}>{t.assumptionsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    {t.colId}
                  </th>
                  <th scope="col" className={thClass}>
                    {t.colAssumption}
                  </th>
                  <th scope="col" className={thClass}>
                    {t.colWhy}
                  </th>
                  <th scope="col" className={thClass}>
                    {t.colResolve}
                  </th>
                </tr>
              </thead>
              <tbody lang="en">
                {ASSUMPTIONS.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>
                      <Mono>{item.id}</Mono>
                    </td>
                    <th scope="row" className={rowHeadClass}>
                      {item.assumption}
                    </th>
                    <td className={`${tdClass} text-muted`}>{item.whyUnverified}</td>
                    <td className={tdClass}>{item.howToResolve}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </div>
      </div>
    </DocSection>
  );
}
