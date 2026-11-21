"use client";

import { defineMessages } from "@/i18n";

/** Section ids, in document order. They are also the URL fragments. */
export const SECTION_IDS = [
  "overview",
  "architecture",
  "models",
  "features",
  "datasets",
  "experiments",
  "benchmarks",
  "references",
  "roadmap",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** Section titles, shared by the contents list and the section headings. */
export const sectionTitles = defineMessages<Record<SectionId, string>>({
  en: {
    overview: "Research overview",
    architecture: "Architecture explorer",
    models: "Model explorer",
    features: "Feature specification",
    datasets: "Dataset explorer",
    experiments: "Experiments",
    benchmarks: "Published benchmarks",
    references: "References",
    roadmap: "Roadmap",
  },
  hi: {
    overview: "शोध का सार",
    architecture: "आर्किटेक्चर एक्सप्लोरर",
    models: "मॉडल एक्सप्लोरर",
    features: "फ़ीचर विनिर्देश",
    datasets: "डेटासेट एक्सप्लोरर",
    experiments: "प्रयोग",
    benchmarks: "प्रकाशित बेंचमार्क",
    references: "संदर्भ",
    roadmap: "रोडमैप",
  },
});

/** Labels used by more than one section. */
export const commonMessages = defineMessages({
  en: {
    verified: "Verified",
    unverified: "Unverified",
    verificationNote: "Verification note",
    newTab: "opens in a new tab",
    source: "Source",
    limitations: "Known limitations",
    yes: "Yes",
    no: "No",
    notStated: "Not stated",
    scrollHint: "Scroll sideways to see every column.",
  },
  hi: {
    verified: "सत्यापित",
    unverified: "असत्यापित",
    verificationNote: "सत्यापन टिप्पणी",
    newTab: "नए टैब में खुलता है",
    source: "स्रोत",
    limitations: "ज्ञात सीमाएँ",
    yes: "हाँ",
    no: "नहीं",
    notStated: "नहीं बताया गया",
    scrollHint: "सभी कॉलम देखने के लिए बग़ल में स्क्रॉल करें।",
  },
});
