"use client";

import { Check, X } from "lucide-react";
import { STUDIO_HREF } from "@/components/layout/navigation";
import { Badge, Card, Container, Eyebrow, Heading, Notice, Section } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { ClosingCta } from "./ClosingCta";

type Fit = "exploratory" | "demo" | "unsuitable";
type Scenario = { area: string; title: string; scenario: string; can: string[]; cannot: string[]; fit: Fit };

const messages = defineMessages({
  en: {
    eyebrow: "Use cases",
    title: "Where RTSLR could help, and where it cannot yet",
    lead: "Six everyday situations. For each one: a concrete scene, what RTSLR can do in it today and what it cannot do yet.",
    warningTitle: "Not for high-stakes communication",
    warning:
      "RTSLR is not validated for medical, legal, emergency or other high-stakes communication, and it does not replace qualified interpreters.",
    canTitle: "What RTSLR can do today",
    cannotTitle: "What it cannot do yet",
    fitLabel: "Suitable today?",
    fit: {
      exploratory: "Exploratory use only",
      demo: "As a demonstration only",
      unsuitable: "Not suitable for real use",
    } satisfies Record<Fit, string>,
    scenarios: [
      {
        area: "Education",
        title: "A classroom handshape exercise",
        scenario:
          "A teacher at a school for deaf children wants pupils to practise handshapes between lessons, with something that responds when a shape is held steadily.",
        can: [
          "Let a teacher or pupil record their own one-hand and two-hand samples and practise holding them until the recogniser responds.",
          "Show the tracked landmarks, so learners can see what the camera is picking up.",
        ],
        cannot: [
          "Judge whether a sign is formed correctly. It matches the samples recorded on that device, not a standard of correct ISL.",
          "Replace a teacher who signs, or assess a pupil's progress.",
        ],
        fit: "exploratory",
      },
      {
        area: "Communication assistance",
        title: "A few routine words between colleagues",
        scenario:
          "A Deaf employee and a hearing colleague who does not sign need to exchange a handful of routine words at a desk.",
        can: [
          "Turn a small personal set of signs, recorded beforehand by the signer, into text and browser speech.",
          "Keep the camera processing on the signer's own device.",
        ],
        cannot: [
          "Follow natural signing. It handles separate, held poses, not flowing sentences.",
          "Work in the other direction. It does not turn speech or text into signs.",
        ],
        fit: "exploratory",
      },
      {
        area: "Public-service interactions",
        title: "At an enquiry counter",
        scenario: "Someone comes to a ticket or enquiry counter where no member of staff signs.",
        can: [
          "Show staff and planners what browser-based recognition involves, and how much is still missing.",
        ],
        cannot: [
          "Be put to work at a counter. It has no validated ISL model and has not been tested with the public.",
          "Stand in for an interpreter or trained staff wherever a decision, a payment or a person's rights are involved.",
        ],
        fit: "unsuitable",
      },
      {
        area: "Community accessibility",
        title: "An awareness stall at a community event",
        scenario:
          "A Deaf association or a student group runs a stall to start conversations about ISL and technology.",
        can: [
          "Run the simulator on a laptop with no camera at all, so nobody is filmed.",
          "Let visitors see hand landmarks and the hold-to-add timing for themselves.",
        ],
        cannot: [
          "Represent how Deaf people sign. A hand-tracking demo is not a picture of the language or of the community.",
        ],
        fit: "demo",
      },
      {
        area: "Everyday communication",
        title: "A handful of household words",
        scenario:
          "A family wants a quick way to put a few frequently used words on a screen at home.",
        can: [
          "Recognise a small set of signs that family members record themselves, and record again when matching gets worse.",
        ],
        cannot: [
          "Work reliably from one person to the next. Samples recorded by one person may not match another person's hands.",
          "Cope without errors when the light is poor, the movement is fast or one hand hides the other.",
        ],
        fit: "exploratory",
      },
      {
        area: "Sign-language learning",
        title: "Practising alongside the lessons",
        scenario:
          "A hearing learner works through the Learn ISL area and wants to practise holding handshapes steadily.",
        can: [
          "Give feedback on steadiness: whether a pose was held long enough to register.",
          "Sit beside the learning area, whose items say whether their source is verified or pending.",
        ],
        cannot: [
          "Teach how a sign is formed. That has to come from an authoritative source and from people who sign.",
          "Tell you that your signing is correct, or that a Deaf signer would understand it.",
        ],
        fit: "exploratory",
      },
    ] satisfies Scenario[],
    limits: {
      eyebrow: "Limits",
      title: "Where RTSLR must not be used",
      text: "RTSLR is a research platform without a validated ISL model. A wrong or missing word in these situations can cause real harm, so it must not be relied on in them.",
      items: [
        { title: "Medical", text: "Consultations, consent, prescriptions, symptoms." },
        { title: "Legal", text: "Police, courts, contracts, official statements." },
        { title: "Emergency", text: "Calls for help, evacuation, safety instructions." },
        { title: "Other high-stakes moments", text: "Anything that decides a person's rights, money or safety." },
      ],
      closing: "In all of these, a qualified interpreter is needed. RTSLR does not replace one.",
    },
    cta: {
      title: "See what it does for yourself",
      lead: "The studio labels every model it runs, so you always know what you are looking at.",
      primary: "Open the studio",
      secondary: "Read how it works",
    },
  },
  hi: {
    eyebrow: "उपयोग",
    title: "RTSLR कहाँ मदद कर सकता है, और कहाँ अभी नहीं",
    lead: "रोज़मर्रा की छह स्थितियाँ। हर एक में: एक ठोस दृश्य, RTSLR आज उसमें क्या कर सकता है और अभी क्या नहीं।",
    warningTitle: "गंभीर स्थितियों की बातचीत के लिए नहीं",
    warning:
      "RTSLR चिकित्सा, क़ानूनी, आपातकालीन या किसी भी गंभीर स्थिति की बातचीत के लिए प्रमाणित नहीं है, और यह योग्य दुभाषियों की जगह नहीं लेता।",
    canTitle: "RTSLR आज क्या कर सकता है",
    cannotTitle: "यह अभी क्या नहीं कर सकता",
    fitLabel: "आज उपयुक्त है?",
    fit: {
      exploratory: "केवल आज़माने के लिए",
      demo: "केवल प्रदर्शन के रूप में",
      unsuitable: "वास्तविक उपयोग के लिए उपयुक्त नहीं",
    } satisfies Record<Fit, string>,
    scenarios: [
      {
        area: "शिक्षा",
        title: "कक्षा में हस्त-आकार का अभ्यास",
        scenario:
          "बधिर बच्चों के विद्यालय की एक शिक्षिका चाहती हैं कि विद्यार्थी पाठों के बीच हस्त-आकारों का अभ्यास करें, किसी ऐसी चीज़ के साथ जो आकार के स्थिर टिकने पर प्रतिक्रिया दे।",
        can: [
          "शिक्षक या विद्यार्थी अपने एक हाथ और दो हाथ वाले नमूने रिकॉर्ड कर सकते हैं और उन्हें तब तक टिकाने का अभ्यास कर सकते हैं जब तक पहचानकर्ता प्रतिक्रिया न दे।",
          "ट्रैक किए गए लैंडमार्क दिखाता है, ताकि सीखने वाले देख सकें कि कैमरा क्या पकड़ रहा है।",
        ],
        cannot: [
          "यह नहीं बता सकता कि संकेत सही बना है या नहीं। यह उसी डिवाइस पर रिकॉर्ड किए नमूनों से मिलान करता है, सही ISL के किसी मानक से नहीं।",
          "संकेत करने वाले शिक्षक की जगह नहीं ले सकता, न विद्यार्थी की प्रगति आँक सकता है।",
        ],
        fit: "exploratory",
      },
      {
        area: "संवाद में सहायता",
        title: "सहकर्मियों के बीच कुछ रोज़ के शब्द",
        scenario:
          "एक बधिर कर्मचारी और एक सुनने वाले सहकर्मी को, जो संकेत नहीं जानते, मेज़ पर कुछ रोज़ के शब्दों का आदान-प्रदान करना है।",
        can: [
          "संकेतकर्ता के पहले से रिकॉर्ड किए गए कुछ निजी संकेतों को पाठ और ब्राउज़र की वाणी में बदल सकता है।",
          "कैमरे की प्रोसेसिंग संकेतकर्ता के अपने डिवाइस पर ही रखता है।",
        ],
        cannot: [
          "स्वाभाविक संकेत-प्रवाह को नहीं समझ सकता। यह अलग-अलग, टिकाई गई मुद्राओं को सँभालता है, बहते वाक्यों को नहीं।",
          "उलटी दिशा में काम नहीं करता। यह वाणी या पाठ को संकेतों में नहीं बदलता।",
        ],
        fit: "exploratory",
      },
      {
        area: "सार्वजनिक सेवाएँ",
        title: "पूछताछ काउंटर पर",
        scenario: "कोई व्यक्ति ऐसे टिकट या पूछताछ काउंटर पर आता है जहाँ कोई कर्मचारी संकेत नहीं जानता।",
        can: [
          "कर्मचारियों और योजना बनाने वालों को दिखा सकता है कि ब्राउज़र में पहचान कैसे होती है, और अभी कितना कुछ बाक़ी है।",
        ],
        cannot: [
          "काउंटर पर काम में नहीं लगाया जा सकता। इसमें प्रमाणित ISL मॉडल नहीं है और इसे जनता के साथ परखा नहीं गया है।",
          "जहाँ कोई फ़ैसला, भुगतान या किसी के अधिकार जुड़े हों, वहाँ दुभाषिए या प्रशिक्षित कर्मचारी की जगह नहीं ले सकता।",
        ],
        fit: "unsuitable",
      },
      {
        area: "समुदाय में सुलभता",
        title: "सामुदायिक कार्यक्रम में जागरूकता स्टॉल",
        scenario:
          "कोई बधिर संघ या विद्यार्थियों का समूह ISL और तकनीक पर बातचीत शुरू करने के लिए स्टॉल लगाता है।",
        can: [
          "लैपटॉप पर बिना किसी कैमरे के सिम्युलेटर चला सकता है, ताकि किसी की तस्वीर न ली जाए।",
          "आने वाले लोग हाथ के लैंडमार्क और होल्ड करके जोड़ने का समय खुद देख सकते हैं।",
        ],
        cannot: [
          "यह नहीं दिखा सकता कि बधिर लोग कैसे संकेत करते हैं। हाथ ट्रैक करने का डेमो न भाषा की तस्वीर है, न समुदाय की।",
        ],
        fit: "demo",
      },
      {
        area: "रोज़मर्रा की बातचीत",
        title: "घर के कुछ गिने-चुने शब्द",
        scenario: "एक परिवार चाहता है कि घर में अक्सर काम आने वाले कुछ शब्द जल्दी से स्क्रीन पर आ सकें।",
        can: [
          "उन थोड़े-से संकेतों को पहचान सकता है जिन्हें परिवार के लोग खुद रिकॉर्ड करते हैं, और मिलान बिगड़ने पर दोबारा रिकॉर्ड करते हैं।",
        ],
        cannot: [
          "एक व्यक्ति से दूसरे व्यक्ति पर भरोसे से काम नहीं करता। एक व्यक्ति के नमूने दूसरे के हाथों से मेल न खाएँ, ऐसा हो सकता है।",
          "कम रोशनी, तेज़ हरकत या एक हाथ के दूसरे को ढकने पर बिना ग़लती के नहीं चल पाता।",
        ],
        fit: "exploratory",
      },
      {
        area: "सांकेतिक भाषा सीखना",
        title: "पाठों के साथ-साथ अभ्यास",
        scenario:
          "एक सुनने वाला विद्यार्थी 'ISL सीखें' क्षेत्र से पढ़ रहा है और हस्त-आकारों को स्थिर टिकाने का अभ्यास करना चाहता है।",
        can: [
          "स्थिरता पर प्रतिक्रिया दे सकता है: मुद्रा दर्ज होने लायक देर तक टिकी या नहीं।",
          "सीखने के क्षेत्र के साथ चलता है, जहाँ हर सामग्री पर लिखा है कि उसका स्रोत सत्यापित है या लंबित।",
        ],
        cannot: [
          "यह नहीं सिखा सकता कि संकेत कैसे बनता है। वह किसी प्रामाणिक स्रोत और संकेत करने वाले लोगों से ही आना चाहिए।",
          "यह नहीं बता सकता कि आपका संकेत सही है, या कोई बधिर संकेतकर्ता उसे समझेगा।",
        ],
        fit: "exploratory",
      },
    ] satisfies Scenario[],
    limits: {
      eyebrow: "सीमाएँ",
      title: "जहाँ RTSLR का उपयोग नहीं होना चाहिए",
      text: "RTSLR एक शोध मंच है जिसमें प्रमाणित ISL मॉडल नहीं है। इन स्थितियों में एक ग़लत या छूटा हुआ शब्द असली नुक़सान कर सकता है, इसलिए इनमें इस पर निर्भर नहीं रहना चाहिए।",
      items: [
        { title: "चिकित्सा", text: "परामर्श, सहमति, दवा के पर्चे, लक्षण।" },
        { title: "क़ानूनी", text: "पुलिस, अदालत, अनुबंध, आधिकारिक बयान।" },
        { title: "आपातकाल", text: "मदद की पुकार, निकासी, सुरक्षा निर्देश।" },
        { title: "अन्य गंभीर क्षण", text: "जो कुछ भी किसी के अधिकार, पैसे या सुरक्षा का फ़ैसला करे।" },
      ],
      closing: "इन सबमें योग्य दुभाषिए की ज़रूरत होती है। RTSLR उसकी जगह नहीं लेता।",
    },
    cta: {
      title: "खुद देखें कि यह क्या करता है",
      lead: "स्टूडियो अपने हर चल रहे मॉडल का नाम बताता है, ताकि आपको हमेशा पता रहे कि आप क्या देख रहे हैं।",
      primary: "स्टूडियो खोलें",
      secondary: "पढ़ें कि यह कैसे काम करता है",
    },
  },
});

const fitTone: Record<Fit, Tone> = { exploratory: "warning", demo: "info", unsuitable: "danger" };

export function UseCasesPage() {
  const t = useMessages(messages);

  return (
    <>
      <Section titleAs="h1" eyebrow={t.eyebrow} title={t.title} lead={t.lead} spacing="tight">
        <Notice tone="danger" title={t.warningTitle} className="max-w-3xl">
          {t.warning}
        </Notice>
      </Section>

      {/* Alternating narrative rows: the text and the panel swap sides row by row. */}
      <div className="bg-background pb-section">
        <Container>
          {t.scenarios.map((item, index) => {
            const flipped = index % 2 === 1;
            return (
              <article
                key={item.title}
                aria-labelledby={`use-case-${index}`}
                className="grid gap-x-12 gap-y-8 border-t border-line py-14 lg:grid-cols-12 lg:py-20"
              >
                <div className={cn("flex flex-col gap-5 lg:col-span-5", flipped && "lg:order-2 lg:col-start-8")}>
                  <Eyebrow>{item.area}</Eyebrow>
                  <Heading id={`use-case-${index}`}>{item.title}</Heading>
                  <p className="text-lead text-muted">{item.scenario}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-3 text-small font-semibold text-ink">
                    {t.fitLabel}
                    <Badge tone={fitTone[item.fit]}>{t.fit[item.fit]}</Badge>
                  </p>
                </div>

                <Card
                  padding="none"
                  className={cn("overflow-hidden lg:col-span-7", flipped ? "lg:order-1 lg:col-start-1" : "lg:col-start-6")}
                >
                  <div className="p-6 md:p-8">
                    <Heading as="h3" size="h4">
                      {t.canTitle}
                    </Heading>
                    <ul className="mt-4 flex flex-col gap-3">
                      {item.can.map((line) => (
                        <li key={line} className="flex gap-3 text-body text-ink">
                          <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-success-ink" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-line bg-background-secondary p-6 md:p-8">
                    <Heading as="h3" size="h4">
                      {t.cannotTitle}
                    </Heading>
                    <ul className="mt-4 flex flex-col gap-3">
                      {item.cannot.map((line) => (
                        <li key={line} className="flex gap-3 text-body text-ink">
                          <X aria-hidden="true" className="mt-1 size-5 shrink-0 text-danger-ink" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </article>
            );
          })}
        </Container>
      </div>

      <Section tone="ink" eyebrow={t.limits.eyebrow} title={t.limits.title} lead={t.limits.text}>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {t.limits.items.map((item) => (
            <li key={item.title} className="border-t border-line-strong pt-5">
              <p className="flex items-center gap-2 text-h4 text-ink">
                <X aria-hidden="true" className="size-5 shrink-0 text-danger-ink" />
                {item.title}
              </p>
              <p className="mt-2 text-small text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 max-w-[32ch] text-h3 text-ink">{t.limits.closing}</p>
      </Section>

      <ClosingCta
        title={t.cta.title}
        lead={t.cta.lead}
        primary={{ href: STUDIO_HREF, label: t.cta.primary }}
        secondary={{ href: "/product", label: t.cta.secondary }}
      />
    </>
  );
}
