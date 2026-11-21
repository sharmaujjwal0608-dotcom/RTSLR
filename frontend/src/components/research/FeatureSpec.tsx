"use client";

import { Notice } from "@/components/ui";
import {
  DUAL_HAND_LAYOUT,
  FEATURE_FORMULAS,
  FEATURE_SCHEMA,
  SINGLE_HAND_LAYOUT,
  type FeatureBlock,
} from "@/content/research/system";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  DocSection,
  Mono,
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
    intro:
      "A model never sees pixels. It sees one of two vectors computed from the landmarks, defined by a fixed contract so that training code and the browser produce identical numbers.",
    schema: "Schema",
    steps: "How a hand becomes numbers",
    step1: "Undo the image's aspect ratio, so a unit of x is as long as a unit of y:",
    step2: "Measure the palm, from the wrist (landmark 0) to the base of the middle finger (landmark 9):",
    step3: "Move the wrist to the origin and divide every landmark by the palm length:",
    singleTitle: "Single-hand vector, 63 values",
    singleCaption: "Layout of the 63-D single-hand vector (21 landmarks × x, y, z)",
    dualTitle: "Coordinated two-hand vector, 156 values",
    dualLead:
      "Produced only when exactly two hands are tracked. Hand A is the hand whose wrist is further left in the unmirrored frame; MediaPipe's left/right labels are not used.",
    dualCaption: "Layout of the 156-D coordinated two-hand vector",
    stripLabel: "Proportions of the 156 values: 126 describe the two hand shapes, 30 describe how the hands relate.",
    colIndex: "Index",
    colSize: "Values",
    colContent: "Content",
    where: "Where",
    whyTitle: "Why two hand labels are not two-hand recognition",
    why1:
      "Each 63-value block is centred on its own wrist and scaled by its own palm. It describes the shape of one hand and nothing about where that hand is.",
    why2:
      "Classify each hand on its own and you get two one-hand labels. What separates two-handed signs — where the hands touch, how far apart they are, how the palms face each other — was never in the input, so no rule for combining the two labels can recover it.",
    why3:
      "Indices 126 to 155 carry exactly that relation. Two-hand classes are therefore classified from the 156-value vector as one configuration, never by combining two single-hand labels. The legacy prototype's \"dual-hand\" mode was two independent one-handed ASL recognisers, which is why it cannot be relabelled as ISL.",
    limitTitle: "Untested design",
    limit:
      "No experiment has evaluated this layout. If the hands cross so that their wrists swap sides, A and B swap. The research notes propose a different 158-value layout with presence flags; comparing the two is part of planned experiment EXP-004.",
  },
  hi: {
    intro:
      "मॉडल कभी पिक्सेल नहीं देखता। वह लैंडमार्क से निकाले गए दो वेक्टरों में से एक देखता है, जिनकी परिभाषा एक तय अनुबंध में है ताकि प्रशिक्षण कोड और ब्राउज़र बिल्कुल एक जैसी संख्याएँ बनाएँ।",
    schema: "स्कीमा",
    steps: "हाथ संख्याओं में कैसे बदलता है",
    step1: "छवि के आस्पेक्ट अनुपात को हटाएँ, ताकि x की एक इकाई y की एक इकाई जितनी लंबी हो:",
    step2: "हथेली नापें — कलाई (लैंडमार्क 0) से मध्यमा उँगली के आधार (लैंडमार्क 9) तक:",
    step3: "कलाई को मूल बिंदु पर ले जाएँ और हर लैंडमार्क को हथेली की लंबाई से भाग दें:",
    singleTitle: "एक हाथ का वेक्टर, 63 मान",
    singleCaption: "63-D एक-हाथ वेक्टर की बनावट (21 लैंडमार्क × x, y, z)",
    dualTitle: "दोनों हाथों का समन्वित वेक्टर, 156 मान",
    dualLead:
      "यह तभी बनता है जब ठीक दो हाथ ट्रैक हो रहे हों। हाथ A वह है जिसकी कलाई बिना-मिरर फ़्रेम में ज़्यादा बाईं ओर है; MediaPipe के बाएँ/दाएँ लेबल इस्तेमाल नहीं होते।",
    dualCaption: "156-D समन्वित दो-हाथ वेक्टर की बनावट",
    stripLabel: "156 मानों का अनुपात: 126 मान दोनों हाथों के आकार बताते हैं, 30 मान हाथों का आपसी संबंध।",
    colIndex: "सूचकांक",
    colSize: "मान",
    colContent: "सामग्री",
    where: "जहाँ",
    whyTitle: "दो हाथों के अलग-अलग लेबल, दो-हाथ पहचान क्यों नहीं हैं",
    why1:
      "63 मानों का हर खंड अपनी ही कलाई पर केंद्रित है और अपनी ही हथेली से मापा गया है। वह एक हाथ का आकार बताता है, यह नहीं कि वह हाथ कहाँ है।",
    why2:
      "हर हाथ को अलग-अलग वर्गीकृत करने पर एक-एक हाथ के दो लेबल मिलते हैं। दो-हाथ वाले संकेतों को जो चीज़ अलग करती है — हाथ कहाँ छूते हैं, कितनी दूर हैं, हथेलियाँ एक-दूसरे की ओर कैसे हैं — वह इनपुट में कभी थी ही नहीं, इसलिए दो लेबलों को जोड़ने का कोई नियम उसे वापस नहीं ला सकता।",
    why3:
      "सूचकांक 126 से 155 ठीक यही संबंध रखते हैं। इसलिए दो-हाथ वाली श्रेणियाँ 156 मानों के वेक्टर से एक ही विन्यास के रूप में वर्गीकृत होती हैं, दो एक-हाथ लेबलों को जोड़कर कभी नहीं। पुराने प्रोटोटाइप का \"ड्यूल-हैंड\" मोड दो स्वतंत्र एक-हाथ ASL पहचानकर्ता थे; इसी कारण उसे ISL नहीं कहा जा सकता।",
    limitTitle: "बिना परखा डिज़ाइन",
    limit:
      "किसी प्रयोग ने इस बनावट का मूल्यांकन नहीं किया है। अगर हाथ इस तरह एक-दूसरे को पार करें कि कलाइयाँ जगह बदल लें, तो A और B बदल जाते हैं। शोध टिप्पणियाँ उपस्थिति-संकेतों वाली 158 मानों की एक अलग बनावट प्रस्तावित करती हैं; दोनों की तुलना नियोजित प्रयोग EXP-004 का हिस्सा है।",
  },
});

const blockSize = (block: FeatureBlock) => block.to - block.from + 1;
const blockRange = (block: FeatureBlock) => (block.from === block.to ? `${block.from}` : `${block.from}–${block.to}`);

const groupFill: Record<FeatureBlock["group"], string> = {
  hand: "bg-ink text-on-ink",
  handB: "bg-background-secondary text-ink",
  relation: "bg-accent-soft text-ink",
};

function LayoutTable({ caption, blocks }: { caption: string; blocks: FeatureBlock[] }) {
  const t = useMessages(messages);
  return (
    <ScrollRegion label={caption}>
      <table className={`${tableClass} min-w-[32rem]`}>
        <caption className={captionClass}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              {t.colIndex}
            </th>
            <th scope="col" className={thClass}>
              {t.colSize}
            </th>
            <th scope="col" className={thClass}>
              {t.colContent}
            </th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.from}>
              <th scope="row" className={`${rowHeadClass} font-mono text-label whitespace-nowrap`}>
                {blockRange(block)}
              </th>
              <td className={`${tdClass} font-mono text-label`}>{blockSize(block)}</td>
              <td lang="en" className={tdClass}>
                {block.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

/** The 156 values drawn to scale; the table below carries the same information as text. */
function DualStrip() {
  const t = useMessages(messages);
  return (
    <figure className="mt-6">
      <div aria-hidden="true" className="flex h-12 overflow-hidden rounded-field border border-line-strong">
        {DUAL_HAND_LAYOUT.map((block) => (
          <div
            key={block.from}
            style={{ flexGrow: blockSize(block) }}
            className={cn(
              "flex min-w-5 basis-0 items-center justify-center border-r border-line-strong font-mono text-label last:border-r-0",
              groupFill[block.group],
            )}
          >
            {blockSize(block)}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-caption text-muted">{t.stripLabel}</figcaption>
    </figure>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <code className="mt-2 block overflow-x-auto rounded-field bg-background-secondary px-4 py-3 font-mono text-label whitespace-nowrap text-ink">
      {children}
    </code>
  );
}

export function FeatureSpec() {
  const t = useMessages(messages);
  return (
    <DocSection
      id="features"
      intro={
        <>
          <p>{t.intro}</p>
          <p>
            {t.schema}: <Mono>{FEATURE_SCHEMA}</Mono>
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-14">
        <div className="max-w-narrow">
          <SubHeading>{t.steps}</SubHeading>
          <ol className="mt-5 flex list-decimal flex-col gap-5 pl-5 text-body text-ink">
            <li>
              {t.step1}
              <Formula>{FEATURE_FORMULAS.aspect}</Formula>
            </li>
            <li>
              {t.step2}
              <Formula>{FEATURE_FORMULAS.palm}</Formula>
            </li>
            <li>
              {t.step3}
              <Formula>{FEATURE_FORMULAS.single}</Formula>
            </li>
          </ol>
        </div>

        <div className="max-w-narrow">
          <SubHeading className="mb-5">{t.singleTitle}</SubHeading>
          <LayoutTable caption={t.singleCaption} blocks={SINGLE_HAND_LAYOUT} />
        </div>

        <div className="max-w-narrow">
          <SubHeading>{t.dualTitle}</SubHeading>
          <p className="mt-3 max-w-reading text-body text-muted">{t.dualLead}</p>
          <DualStrip />
          <div className="mt-6">
            <LayoutTable caption={t.dualCaption} blocks={DUAL_HAND_LAYOUT} />
          </div>
          <p className="mt-4 text-small text-muted">{t.where}:</p>
          <Formula>{FEATURE_FORMULAS.scale}</Formula>
          <Formula>{FEATURE_FORMULAS.normal}</Formula>
        </div>

        <div className="max-w-reading">
          <SubHeading>{t.whyTitle}</SubHeading>
          <div className="mt-4 flex flex-col gap-4 text-body text-ink">
            <p>{t.why1}</p>
            <p>{t.why2}</p>
            <p>{t.why3}</p>
          </div>
          <Notice tone="warning" title={t.limitTitle} className="mt-6">
            {t.limit}
          </Notice>
        </div>
      </div>
    </DocSection>
  );
}
