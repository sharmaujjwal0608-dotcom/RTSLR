"use client";

import { ArrowUpRight, Camera, ListChecks, Repeat } from "lucide-react";
import { Button, Notice, Section, Tabs } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { MeaningQuiz } from "./MeaningQuiz";
import { SelfPractice } from "./SelfPractice";
import { LearnNav, StorageNotice } from "./shared";

const messages = defineMessages({
  en: {
    title: "Practice",
    lead: "Three ways to practise. Only the first is marked right or wrong, because only meanings can be checked here.",
    tabsLabel: "Practice type",
    quizTab: "Meaning quiz",
    selfTab: "Self-check",
    cameraTab: "Camera",
    quizTitle: "Meaning quiz",
    selfTitle: "Self-check practice",
    cameraTitle: "Practise with the camera",
    cameraIntro:
      "The Studio is RTSLR's camera workspace. It can help you repeat a sign the same way each time. It cannot tell you whether the sign is correct ISL.",
    canTitle: "What the Studio can do",
    can1: "Let you record your own samples of a sign, after you have learned it from the official dictionary or a teacher.",
    can2: "Compare a later attempt with those samples, using an experimental recogniser, and tell you whether the attempt matches your own recording.",
    can3: "Run in your browser: camera frames are processed on your device and are not uploaded.",
    cannotTitle: "What it cannot do",
    cannot1: "Tell you whether your sign is correct ISL. A match only means you were consistent with yourself; if your recording was wrong, a matching attempt is wrong in the same way.",
    cannot2: "Recognise ISL in general. RTSLR has no trained or validated ISL recognition model.",
    cannot3: "Replace a teacher or a fluent signer, who can see things a hand-tracking camera does not, such as facial expression and body position.",
    warningTitle: "Consistency practice, not verification",
    warningBody:
      "Treat a match in the Studio as “the same as my recording”, never as “correct”. Do not rely on it for medical, legal, emergency or other high-stakes communication.",
    openStudio: "Open the Studio",
  },
  hi: {
    title: "अभ्यास",
    lead: "अभ्यास के तीन तरीके। केवल पहले में सही या ग़लत बताया जाता है, क्योंकि यहाँ केवल अर्थों की जाँच हो सकती है।",
    tabsLabel: "अभ्यास का प्रकार",
    quizTab: "अर्थ क्विज़",
    selfTab: "स्वयं-जाँच",
    cameraTab: "कैमरा",
    quizTitle: "अर्थ क्विज़",
    selfTitle: "स्वयं-जाँच अभ्यास",
    cameraTitle: "कैमरे के साथ अभ्यास करें",
    cameraIntro:
      "स्टूडियो RTSLR का कैमरा कार्यक्षेत्र है। यह किसी संकेत को हर बार एक जैसा दोहराने में आपकी मदद कर सकता है। यह नहीं बता सकता कि संकेत सही ISL है या नहीं।",
    canTitle: "स्टूडियो क्या कर सकता है",
    can1: "किसी संकेत को आधिकारिक शब्दकोश या शिक्षक से सीखने के बाद, आपको उसके अपने नमूने रिकॉर्ड करने देता है।",
    can2: "एक प्रायोगिक पहचानकर्ता की मदद से बाद के प्रयास की तुलना उन नमूनों से करता है और बताता है कि प्रयास आपकी अपनी रिकॉर्डिंग से मेल खाता है या नहीं।",
    can3: "आपके ब्राउज़र में चलता है: कैमरे के फ़्रेम आपके डिवाइस पर ही प्रोसेस होते हैं और अपलोड नहीं किए जाते।",
    cannotTitle: "यह क्या नहीं कर सकता",
    cannot1: "यह नहीं बता सकता कि आपका संकेत सही ISL है। मेल खाने का अर्थ केवल इतना है कि आपने खुद को दोहराया; अगर आपकी रिकॉर्डिंग ग़लत थी, तो मेल खाता प्रयास भी उसी तरह ग़लत है।",
    cannot2: "सामान्य रूप से ISL नहीं पहचान सकता। RTSLR के पास कोई प्रशिक्षित या प्रमाणित ISL पहचान मॉडल नहीं है।",
    cannot3: "किसी शिक्षक या धाराप्रवाह संकेतकर्ता की जगह नहीं ले सकता, जो वह देख सकते हैं जो हाथ ट्रैक करने वाला कैमरा नहीं देखता, जैसे चेहरे के भाव और शरीर की स्थिति।",
    warningTitle: "एकरूपता का अभ्यास, सत्यापन नहीं",
    warningBody:
      "स्टूडियो में मेल को “मेरी रिकॉर्डिंग जैसा” समझें, “सही” कभी नहीं। चिकित्सा, क़ानूनी, आपातकालीन या अन्य गंभीर संचार के लिए इस पर निर्भर न रहें।",
    openStudio: "स्टूडियो खोलें",
  },
});

function CameraPractice() {
  const t = useMessages(messages);
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-reading text-body text-muted">{t.cameraIntro}</p>
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-3">
          <h3 className="text-h4 text-ink">{t.canTitle}</h3>
          <ul className="divide-y divide-line border-y border-line text-small text-ink">
            {[t.can1, t.can2, t.can3].map((line) => (
              <li key={line} className="py-3">
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-h4 text-ink">{t.cannotTitle}</h3>
          <ul className="divide-y divide-line border-y border-line text-small text-ink">
            {[t.cannot1, t.cannot2, t.cannot3].map((line) => (
              <li key={line} className="py-3">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Notice tone="warning" title={t.warningTitle}>
        {t.warningBody}
      </Notice>
      <div>
        <Button href="/studio" size="lg" icon={<ArrowUpRight />}>
          {t.openStudio}
        </Button>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function PracticeHub() {
  const t = useMessages(messages);
  return (
    <Section titleAs="h1" spacing="tight" title={t.title} lead={t.lead}>
      <div className="flex flex-col gap-8">
        <LearnNav current="practice" />
        <StorageNotice />
        <Tabs
          label={t.tabsLabel}
          items={[
            {
              id: "quiz",
              label: t.quizTab,
              icon: <ListChecks />,
              content: (
                <Panel title={t.quizTitle}>
                  <MeaningQuiz />
                </Panel>
              ),
            },
            {
              id: "self",
              label: t.selfTab,
              icon: <Repeat />,
              content: (
                <Panel title={t.selfTitle}>
                  <SelfPractice />
                </Panel>
              ),
            },
            {
              id: "camera",
              label: t.cameraTab,
              icon: <Camera />,
              content: (
                <Panel title={t.cameraTitle}>
                  <CameraPractice />
                </Panel>
              ),
            },
          ]}
        />
      </div>
    </Section>
  );
}
