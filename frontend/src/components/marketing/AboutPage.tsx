"use client";

import { STUDIO_HREF } from "@/components/layout/navigation";
import { Badge, Container, Eyebrow, Heading, Section } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { ClosingCta } from "./ClosingCta";
import { FeedbackForm } from "./FeedbackForm";

type Stage = "done" | "current" | "next";

const messages = defineMessages({
  en: {
    eyebrow: "About",
    title: "Built towards Indian Sign Language, and honest about how far there is to go.",
    missionTitle: "Mission",
    mission:
      "RTSLR exists to make communication between people who sign and people who do not a little easier. It starts with something small and checkable: recognising hand configurations of Indian Sign Language in an ordinary browser, with the camera feed never leaving the device.",
    motivationTitle: "Motivation",
    motivation: [
      "Most hand-recognition demos are built around the one-handed alphabet of American Sign Language. ISL is a different language, and much of its fingerspelling uses two hands.",
      "A tool that is merely relabelled for India would be wrong in ways its users could not see. We would rather build less and say exactly what it is.",
    ],
    quote: "Unknown is better than wrong.",
    visionTitle: "Product vision",
    vision: [
      "The aim is a platform with three parts that support one another: a studio where recognition runs on your device, a learning area grounded in authoritative ISL sources, and research notes that show the method, the data and the open problems.",
      "Understanding full signed sentences is a long way off. RTSLR does not pretend otherwise, and its first real milestone is deliberately narrow.",
    ],
    journeyTitle: "Development journey",
    stage: { done: "Done", current: "Where it is now", next: "Next milestone" } satisfies Record<Stage, string>,
    journey: [
      {
        stage: "done",
        title: "A single-file prototype",
        text: "RTSLR began as one HTML file: a rule-based fingerspelling demo for the ASL alphabet. It showed that hand tracking in the browser was practical, and that ASL rules could not be passed off as ISL.",
      },
      {
        stage: "current",
        title: "A modular platform aimed at ISL",
        text: "The project was rebuilt as separate parts for tracking, features, recognition, language output, learning and research. Two hands are described together, every model is labelled by what it is, and you can record your own samples.",
      },
      {
        stage: "next",
        title: "A validated ISL model",
        text: "The next step is a model that is trained and evaluated properly. That depends on data given with consent by many different signers, and on testing with signers the model has never seen. Until then nothing here is called ISL recognition without a qualifier.",
      },
    ] satisfies { stage: Stage; title: string; text: string }[],
    principlesTitle: "Accessibility principles",
    principles: [
      {
        title: "Deaf people are not a single group",
        text: "Deaf and hard-of-hearing people communicate in different ways: in ISL and its regional varieties, in speech, in writing, or in a mix of these. No one tool suits everyone, and RTSLR does not claim to.",
      },
      {
        title: "Built with, not for",
        text: "Decisions about signs, vocabulary and what counts as correct belong with people who sign. A validated model needs Deaf signers as contributors and reviewers, not only as a source of data. That work has not happened yet, and it is a condition of the next milestone.",
      },
      {
        title: "Respectful representation",
        text: "No invented signs, no hands drawn as though they were signing, and no description of how a sign is made without an authoritative source. Sign language is presented as a language, not as a problem to be fixed.",
      },
      {
        title: "Limits stated plainly",
        text: "Every model is labelled as legacy, experimental, simulated or validated, and no figure appears that was not measured. Where content is unfinished, the page says so.",
      },
    ],
    teamTitle: "Team",
    teamPending: "Team details to be added by the project owner",
    teamBadge: "Unfinished content",
    teamNote: "Names and roles are not listed yet. Nothing has been filled in on their behalf.",
    contactTitle: "Contact",
    contact:
      "No contact address has been published yet. Until the project owner adds one, this form is the way to reach the project. It has no field for a reply address, so messages cannot be answered individually.",
    cta: {
      title: "Look at the work itself",
      lead: "The studio and the research notes show where the project really stands.",
      primary: "Open the studio",
      secondary: "Read the research notes",
    },
  },
  hi: {
    eyebrow: "परिचय",
    title: "भारतीय सांकेतिक भाषा की दिशा में बना, और इस बारे में ईमानदार कि रास्ता अभी कितना बाक़ी है।",
    missionTitle: "उद्देश्य",
    mission:
      "RTSLR इसलिए है कि संकेत करने वाले और संकेत न जानने वाले लोगों के बीच बातचीत थोड़ी आसान हो। इसकी शुरुआत एक छोटी और जाँचने लायक चीज़ से होती है: साधारण ब्राउज़र में भारतीय सांकेतिक भाषा के हस्त-विन्यास पहचानना, जबकि कैमरे की तस्वीर कभी डिवाइस से बाहर नहीं जाती।",
    motivationTitle: "प्रेरणा",
    motivation: [
      "हाथ पहचानने वाले ज़्यादातर डेमो अमेरिकी सांकेतिक भाषा की एक हाथ वाली वर्णमाला पर बने हैं। ISL एक अलग भाषा है, और इसकी फ़िंगरस्पेलिंग में अक्सर दो हाथ लगते हैं।",
      "जिस उपकरण पर बस भारत का नाम चिपका दिया जाए, वह ऐसे ग़लत होगा कि उपयोग करने वालों को पता भी न चले। हम कम बनाना और साफ़ बताना बेहतर समझते हैं कि वह क्या है।",
    ],
    quote: "ग़लत होने से बेहतर है यह कहना कि पता नहीं।",
    visionTitle: "उत्पाद की परिकल्पना",
    vision: [
      "लक्ष्य एक ऐसा मंच है जिसके तीन हिस्से एक-दूसरे को सहारा दें: एक स्टूडियो जहाँ पहचान आपके डिवाइस पर चलती है, सीखने का क्षेत्र जो ISL के प्रामाणिक स्रोतों पर टिका है, और शोध नोट्स जो विधि, डेटा और खुली समस्याएँ दिखाते हैं।",
      "संकेतों में कहे गए पूरे वाक्य समझना अभी बहुत दूर है। RTSLR इसका दिखावा नहीं करता, और इसका पहला असली पड़ाव जान-बूझकर छोटा रखा गया है।",
    ],
    journeyTitle: "विकास की यात्रा",
    stage: { done: "पूरा हुआ", current: "अभी यहाँ है", next: "अगला पड़ाव" } satisfies Record<Stage, string>,
    journey: [
      {
        stage: "done",
        title: "एक फ़ाइल का प्रोटोटाइप",
        text: "RTSLR की शुरुआत एक HTML फ़ाइल से हुई: ASL वर्णमाला के लिए नियमों पर चलने वाला फ़िंगरस्पेलिंग डेमो। इससे पता चला कि ब्राउज़र में हाथों की ट्रैकिंग व्यावहारिक है, और यह भी कि ASL के नियमों को ISL कहकर नहीं चलाया जा सकता।",
      },
      {
        stage: "current",
        title: "ISL की ओर लक्षित मॉड्यूलर मंच",
        text: "परियोजना को अलग-अलग हिस्सों में दोबारा बनाया गया: ट्रैकिंग, फ़ीचर, पहचान, भाषा आउटपुट, सीखना और शोध। दो हाथों का विवरण एक साथ बनता है, हर मॉडल पर लिखा है कि वह क्या है, और आप अपने नमूने रिकॉर्ड कर सकते हैं।",
      },
      {
        stage: "next",
        title: "प्रमाणित ISL मॉडल",
        text: "अगला क़दम ऐसा मॉडल है जो ठीक से प्रशिक्षित और जाँचा गया हो। यह कई अलग-अलग संकेतकर्ताओं के सहमति से दिए गए डेटा पर, और उन संकेतकर्ताओं के साथ परीक्षण पर निर्भर है जिन्हें मॉडल ने पहले नहीं देखा। तब तक यहाँ किसी चीज़ को बिना शर्त ISL पहचान नहीं कहा जाता।",
      },
    ] satisfies { stage: Stage; title: string; text: string }[],
    principlesTitle: "सुलभता के सिद्धांत",
    principles: [
      {
        title: "बधिर लोग कोई एक समूह नहीं हैं",
        text: "बधिर और कम सुनने वाले लोग अलग-अलग तरह से संवाद करते हैं: ISL और उसकी क्षेत्रीय शैलियों में, बोलकर, लिखकर, या इनके मेल से। कोई एक उपकरण सबके लिए ठीक नहीं बैठता, और RTSLR ऐसा दावा नहीं करता।",
      },
      {
        title: "उनके साथ बनाना, उनके लिए नहीं",
        text: "संकेतों, शब्दावली और सही-ग़लत के फ़ैसले उन लोगों के हैं जो संकेत करते हैं। प्रमाणित मॉडल के लिए बधिर संकेतकर्ता योगदानकर्ता और समीक्षक के रूप में चाहिए, केवल डेटा के स्रोत के रूप में नहीं। यह काम अभी नहीं हुआ है, और अगले पड़ाव की शर्त है।",
      },
      {
        title: "सम्मानजनक प्रस्तुति",
        text: "न गढ़े हुए संकेत, न ऐसे हाथ जो संकेत करते हुए दिखाए गए हों, और न किसी प्रामाणिक स्रोत के बिना यह वर्णन कि संकेत कैसे बनता है। सांकेतिक भाषा को भाषा के रूप में रखा गया है, ठीक की जाने वाली समस्या के रूप में नहीं।",
      },
      {
        title: "सीमाएँ साफ़ शब्दों में",
        text: "हर मॉडल पर लिखा है कि वह पुराना, प्रायोगिक, कृत्रिम या प्रमाणित है, और ऐसा कोई आँकड़ा नहीं दिखता जिसे नापा न गया हो। जहाँ सामग्री अधूरी है, पन्ना यही कहता है।",
      },
    ],
    teamTitle: "टीम",
    teamPending: "टीम का विवरण परियोजना के स्वामी द्वारा जोड़ा जाएगा",
    teamBadge: "अधूरी सामग्री",
    teamNote: "नाम और भूमिकाएँ अभी सूचीबद्ध नहीं हैं। उनकी ओर से कुछ भी भरा नहीं गया है।",
    contactTitle: "संपर्क",
    contact:
      "अभी कोई संपर्क पता प्रकाशित नहीं किया गया है। जब तक परियोजना के स्वामी उसे नहीं जोड़ते, परियोजना तक पहुँचने का रास्ता यही फ़ॉर्म है। इसमें जवाब के पते का कोई खाना नहीं है, इसलिए संदेशों का अलग-अलग जवाब नहीं दिया जा सकता।",
    cta: {
      title: "काम को ही देखें",
      lead: "स्टूडियो और शोध नोट्स दिखाते हैं कि परियोजना असल में कहाँ खड़ी है।",
      primary: "स्टूडियो खोलें",
      secondary: "शोध नोट्स पढ़ें",
    },
  },
});

const stageTone: Record<Stage, Tone> = { done: "success", current: "info", next: "warning" };

export function AboutPage() {
  const t = useMessages(messages);

  return (
    <>
      {/* The letter: one narrow column, almost no chrome. */}
      <Section spacing="tight" container="narrow" aria-labelledby="about-title">
        <div className="flex flex-col gap-6">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <Heading size="h1" id="about-title" className="max-w-[18ch] break-words">
            {t.title}
          </Heading>
        </div>
      </Section>

      <Section spacing="none" container="narrow" className="pb-section" aria-label={t.missionTitle}>
        <div className="flex max-w-reading flex-col gap-5">
          <Heading size="h3" as="h2">
            {t.missionTitle}
          </Heading>
          <p className="text-lead text-ink">{t.mission}</p>

          <Heading size="h3" as="h2" className="mt-8">
            {t.motivationTitle}
          </Heading>
          {t.motivation.map((paragraph) => (
            <p key={paragraph} className="text-body text-muted">
              {paragraph}
            </p>
          ))}
        </div>

        <blockquote className="my-14 border-l-2 border-accent pl-6 md:my-20 md:pl-10">
          <p className="max-w-[20ch] text-h2 text-ink">{t.quote}</p>
        </blockquote>

        <div className="flex max-w-reading flex-col gap-5">
          <Heading size="h3" as="h2">
            {t.visionTitle}
          </Heading>
          {t.vision.map((paragraph) => (
            <p key={paragraph} className="text-body text-muted">
              {paragraph}
            </p>
          ))}
        </div>
      </Section>

      {/* Journey: a vertical timeline on a single rule. */}
      <Section tone="secondary" container="narrow" title={t.journeyTitle}>
        <ol className="relative ml-2 border-l border-line-strong">
          {t.journey.map((item) => (
            <li key={item.title} className="relative pb-12 pl-8 last:pb-0 md:pl-12">
              <span
                aria-hidden="true"
                className={
                  item.stage === "next"
                    ? "absolute top-1 -left-[0.4375rem] size-3.5 rounded-full border-2 border-ink bg-background-secondary"
                    : "absolute top-1 -left-[0.4375rem] size-3.5 rounded-full bg-ink"
                }
              />
              <div className="flex max-w-reading flex-col items-start gap-3">
                <Badge tone={stageTone[item.stage]}>{t.stage[item.stage]}</Badge>
                <Heading as="h3" size="h3">
                  {item.title}
                </Heading>
                <p className="text-body text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Principles: title column and text column, separated by hairlines. */}
      <Section container="narrow" title={t.principlesTitle}>
        <dl className="border-b border-line">
          {t.principles.map((item) => (
            <div key={item.title} className="grid gap-3 border-t border-line py-8 md:grid-cols-12 md:gap-8">
              <dt className="text-h4 text-ink md:col-span-4">{item.title}</dt>
              <dd className="text-body text-muted md:col-span-8">{item.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Team and contact as plain rows. */}
      <section aria-labelledby="about-team" className="bg-background pb-section">
        <Container size="narrow">
          <div className="grid gap-4 border-t border-line py-10 md:grid-cols-12 md:gap-8">
            <Heading id="about-team" size="h3" as="h2" className="md:col-span-4">
              {t.teamTitle}
            </Heading>
            <div className="md:col-span-8">
              <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line-strong p-6">
                <Badge tone="warning">{t.teamBadge}</Badge>
                <p className="text-h4 text-ink">{t.teamPending}</p>
                <p className="text-small text-muted">{t.teamNote}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-line pt-10 md:grid-cols-12 md:gap-8">
            <Heading id="contact" size="h3" as="h2" className="md:col-span-4">
              {t.contactTitle}
            </Heading>
            <div className="flex flex-col gap-8 md:col-span-8">
              <p className="text-body text-muted">{t.contact}</p>
              <FeedbackForm />
            </div>
          </div>
        </Container>
      </section>

      <ClosingCta
        tone="secondary"
        title={t.cta.title}
        lead={t.cta.lead}
        primary={{ href: STUDIO_HREF, label: t.cta.primary }}
        secondary={{ href: "/research", label: t.cta.secondary }}
      />
    </>
  );
}
