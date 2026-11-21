/**
 * Interface strings (English / Hindi) for the studio's transcript panel.
 *
 * These are INTERFACE strings. A Hindi interface is not Hindi translation of
 * sign language; the wording below says so to the user in both languages.
 *
 *   import { languageMessages } from "@/features/language/messages";
 *   const t = useMessages(languageMessages);
 *
 * Placeholders in braces ({count}, {language}, ...) are filled with
 * `formatMessage`. The Hindi copy was written by a non-native author and needs
 * the same native review as the vocabulary glosses.
 */

import { defineMessages } from "../../i18n";

export const languageMessages = defineMessages({
  en: {
    /* Panel */
    panelTitle: "Transcript",
    panelSubtitle: "Transcript of recognised signs",
    transcriptLabel: "Transcript of recognised signs (editable)",
    transcriptPlaceholder: "Recognised signs appear here. You can also type.",
    emptyTranscript: "Nothing recognised yet. Hold a sign steady to add it, or type here.",

    /* Honesty */
    notTranslationTitle: "This is not a translation",
    notTranslationBody:
      "RTSLR lists the labels of the signs it recognises, in the order they were recognised. Indian Sign Language has its own grammar, so this list is not an English or Hindi sentence, and fingerspelling a word is not translating it. Check the text before you use it.",
    notTranslationShort: "A list of recognised sign labels, not a translation.",
    highStakesWarning: "Do not rely on this for medical, legal or emergency communication.",

    /* Output language */
    outputLanguageLabel: "Output language",
    outputLanguageHelp:
      "Changes the text of the transcript only. The interface language is set separately.",
    outputEnglish: "English",
    outputHindi: "हिन्दी",
    hindiOutputExplainer:
      "Hindi appears only for signs that have a Hindi label entered by a person. Other labels stay in English, and fingerspelled letters stay in Latin letters.",

    /* Hindi flags */
    noHindiMapping: "No Hindi mapping",
    noHindiMappingDetail: "No Hindi label has been entered for this sign, so the English label is shown.",
    noHindiMappingSummary: "{count} label(s) have no Hindi mapping and are shown in English.",
    hindiNotReviewed: "Hindi label not yet reviewed",
    hindiNotReviewedDetail: "This Hindi label has not been checked by a native Hindi reader.",
    addHindiGloss: "Add a Hindi label",
    hindiGlossLabel: "Hindi label for “{label}”",
    hindiGlossHelp: "Type the Hindi word yourself. RTSLR does not generate it.",
    saveHindiGloss: "Save label",
    removeHindiGloss: "Remove Hindi label",
    glossEmpty: "Type a label first.",
    glossTooLong: "The label is too long (64 characters at most).",

    /* Token provenance */
    sourceRecognition: "Recognised sign",
    sourceManual: "Typed",

    /* Editing */
    edit: "Edit",
    doneEditing: "Done",
    clear: "Clear",
    clearConfirm: "Clear the transcript?",
    undo: "Undo",
    nothingToUndo: "Nothing to undo",
    insertSpace: "Space",
    insertNewLine: "New line",
    backspace: "Delete last",
    characterCount: "{count} characters",
    wordCount: "{count} words",

    /* Speech */
    speak: "Speak",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    speechRate: "Speaking speed",
    speechVoice: "Voice",
    speechVoiceAuto: "Automatic (on-device voice preferred)",
    speechVoiceLocal: "on this device",
    speechVoiceNetwork: "online",
    speechSpeaking: "Speaking",
    speechPaused: "Speech paused",
    speechStopped: "Speech stopped",
    speechUnsupported: "This browser cannot read text aloud.",
    speechNothingToSpeak: "There is no text to speak.",
    speechNoVoice: "No {language} voice is installed in this browser, so this text cannot be read aloud.",
    speechFailed: "The text could not be read aloud.",
    speechReadsLabels: "Speech reads the transcript text aloud. It does not translate.",
    networkVoiceTitle: "This voice works online",
    networkVoiceWarning:
      "No on-device {language} voice was found. If you continue, the transcript text may be sent to your browser vendor’s speech service to be read aloud.",
    networkVoiceAccept: "Continue and speak",
    networkVoiceDecline: "Do not speak",

    /* Copy */
    copy: "Copy",
    copySuccess: "Transcript copied.",
    copyFailed: "Could not copy. Your browser blocked access to the clipboard.",
    copyUnsupported: "Copying is not available in this browser. Select the text and copy it yourself.",
    copyEmpty: "There is nothing to copy.",

    /* Export */
    exportLabel: "Export",
    exportText: "Download as text (.txt)",
    exportJson: "Download with details (.json)",
    exportJsonHelp: "Includes each token, where it came from and the model used.",
    exportSuccess: "Saved {filename}.",
    exportFailed: "The file could not be saved.",
    exportEmpty: "There is nothing to export.",

    /* History */
    historyTitle: "Session history",
    finishSession: "Finish session",
    finishSessionHelp: "Moves this transcript to the history and starts a new one.",
    sessionFinished: "Session moved to history.",
    historyEmpty: "No finished sessions yet.",
    historyMemoryNote: "History is kept only until you close or reload this page.",
    keepHistory: "Keep history on this device",
    keepHistoryHelp:
      "Off by default. When on, up to 50 sessions from the last 30 days are saved in this browser, unencrypted. Anyone who uses this browser profile can read them. Nothing is uploaded.",
    keepHistoryOn: "History will be saved in this browser.",
    keepHistoryOff: "Saved history deleted from this browser.",
    sessionLabel: "Session of {date}",
    sessionModels: "Model: {models}",
    sessionTypedOnly: "Typed text only",
    openSession: "Show",
    deleteSession: "Delete session",
    deleteSessionDone: "Session deleted.",
    deleteAllSessions: "Delete all history",
    deleteAllConfirm: "Delete every saved session? This cannot be undone.",
    deleteAllDone: "All history deleted.",
    historyInvalid:
      "The saved history could not be read, so it was left untouched and new sessions are not being saved. Delete all history to start again.",
    historyUnavailable: "This browser did not allow saving, so history stays in memory only.",
    historyQuota: "The browser’s storage is full, so history could not be saved.",
  },
  hi: {
    /* Panel */
    panelTitle: "ट्रांसक्रिप्ट",
    panelSubtitle: "पहचाने गए संकेतों की ट्रांसक्रिप्ट",
    transcriptLabel: "पहचाने गए संकेतों की ट्रांसक्रिप्ट (बदली जा सकती है)",
    transcriptPlaceholder: "पहचाने गए संकेत यहाँ दिखेंगे। आप टाइप भी कर सकते हैं।",
    emptyTranscript: "अभी कुछ नहीं पहचाना गया। जोड़ने के लिए संकेत को स्थिर रखें, या यहाँ टाइप करें।",

    /* Honesty */
    notTranslationTitle: "यह अनुवाद नहीं है",
    notTranslationBody:
      "RTSLR जिन संकेतों को पहचानता है, उनके लेबल उसी क्रम में दिखाता है जिस क्रम में वे पहचाने गए। भारतीय सांकेतिक भाषा का अपना व्याकरण है, इसलिए यह सूची अंग्रेज़ी या हिन्दी का वाक्य नहीं है, और किसी शब्द को उँगलियों से अक्षर-अक्षर दिखाना उसका अनुवाद नहीं है। इस्तेमाल करने से पहले पाठ जाँच लें।",
    notTranslationShort: "पहचाने गए संकेतों के लेबल की सूची, अनुवाद नहीं।",
    highStakesWarning: "चिकित्सा, क़ानूनी या आपातकालीन बातचीत के लिए इस पर निर्भर न रहें।",

    /* Output language */
    outputLanguageLabel: "आउटपुट की भाषा",
    outputLanguageHelp: "इससे सिर्फ़ ट्रांसक्रिप्ट का पाठ बदलता है। इंटरफ़ेस की भाषा अलग से चुनी जाती है।",
    outputEnglish: "English",
    outputHindi: "हिन्दी",
    hindiOutputExplainer:
      "हिन्दी सिर्फ़ उन संकेतों के लिए दिखती है जिनका हिन्दी लेबल किसी व्यक्ति ने दर्ज किया है। बाक़ी लेबल अंग्रेज़ी में रहते हैं, और उँगलियों से दिखाए गए अक्षर रोमन लिपि में ही रहते हैं।",

    /* Hindi flags */
    noHindiMapping: "हिन्दी लेबल उपलब्ध नहीं",
    noHindiMappingDetail: "इस संकेत के लिए कोई हिन्दी लेबल दर्ज नहीं है, इसलिए अंग्रेज़ी लेबल दिखाया गया है।",
    noHindiMappingSummary: "{count} लेबल के लिए हिन्दी उपलब्ध नहीं है; वे अंग्रेज़ी में दिखाए गए हैं।",
    hindiNotReviewed: "हिन्दी लेबल की जाँच बाक़ी है",
    hindiNotReviewedDetail: "इस हिन्दी लेबल की जाँच अभी किसी हिन्दी-भाषी ने नहीं की है।",
    addHindiGloss: "हिन्दी लेबल जोड़ें",
    hindiGlossLabel: "“{label}” के लिए हिन्दी लेबल",
    hindiGlossHelp: "हिन्दी शब्द ख़ुद टाइप करें। RTSLR इसे अपने आप नहीं बनाता।",
    saveHindiGloss: "लेबल सहेजें",
    removeHindiGloss: "हिन्दी लेबल हटाएँ",
    glossEmpty: "पहले लेबल टाइप करें।",
    glossTooLong: "लेबल बहुत लंबा है (अधिकतम 64 अक्षर)।",

    /* Token provenance */
    sourceRecognition: "पहचाना गया संकेत",
    sourceManual: "टाइप किया गया",

    /* Editing */
    edit: "बदलें",
    doneEditing: "हो गया",
    clear: "साफ़ करें",
    clearConfirm: "ट्रांसक्रिप्ट साफ़ करें?",
    undo: "पिछला बदलाव वापस लें",
    nothingToUndo: "वापस लेने के लिए कुछ नहीं है",
    insertSpace: "स्पेस",
    insertNewLine: "नई पंक्ति",
    backspace: "आख़िरी हटाएँ",
    characterCount: "{count} अक्षर",
    wordCount: "{count} शब्द",

    /* Speech */
    speak: "बोलकर सुनाएँ",
    pause: "रोकें",
    resume: "जारी रखें",
    stop: "बंद करें",
    speechRate: "बोलने की गति",
    speechVoice: "आवाज़",
    speechVoiceAuto: "अपने आप (डिवाइस की आवाज़ को प्राथमिकता)",
    speechVoiceLocal: "इसी डिवाइस पर",
    speechVoiceNetwork: "ऑनलाइन",
    speechSpeaking: "बोला जा रहा है",
    speechPaused: "बोलना रुका हुआ है",
    speechStopped: "बोलना बंद किया गया",
    speechUnsupported: "यह ब्राउज़र पाठ को बोलकर नहीं सुना सकता।",
    speechNothingToSpeak: "बोलने के लिए कोई पाठ नहीं है।",
    speechNoVoice: "इस ब्राउज़र में {language} की कोई आवाज़ उपलब्ध नहीं है, इसलिए यह पाठ बोलकर नहीं सुनाया जा सकता।",
    speechFailed: "पाठ बोलकर नहीं सुनाया जा सका।",
    speechReadsLabels: "यह सुविधा ट्रांसक्रिप्ट का पाठ बोलकर सुनाती है। यह अनुवाद नहीं करती।",
    networkVoiceTitle: "यह आवाज़ ऑनलाइन काम करती है",
    networkVoiceWarning:
      "डिवाइस पर {language} की कोई आवाज़ नहीं मिली। आगे बढ़ने पर ट्रांसक्रिप्ट का पाठ बोलकर सुनाने के लिए आपके ब्राउज़र की कंपनी की स्पीच सेवा को भेजा जा सकता है।",
    networkVoiceAccept: "आगे बढ़ें और सुनाएँ",
    networkVoiceDecline: "न सुनाएँ",

    /* Copy */
    copy: "कॉपी करें",
    copySuccess: "ट्रांसक्रिप्ट कॉपी हो गई।",
    copyFailed: "कॉपी नहीं हो सकी। ब्राउज़र ने क्लिपबोर्ड इस्तेमाल करने की अनुमति नहीं दी।",
    copyUnsupported: "इस ब्राउज़र में कॉपी की सुविधा उपलब्ध नहीं है। पाठ चुनकर ख़ुद कॉपी करें।",
    copyEmpty: "कॉपी करने के लिए कुछ नहीं है।",

    /* Export */
    exportLabel: "एक्सपोर्ट",
    exportText: "टेक्स्ट फ़ाइल डाउनलोड करें (.txt)",
    exportJson: "पूरी जानकारी के साथ डाउनलोड करें (.json)",
    exportJsonHelp: "इसमें हर टोकन, उसका स्रोत और इस्तेमाल किया गया मॉडल शामिल है।",
    exportSuccess: "{filename} सहेजी गई।",
    exportFailed: "फ़ाइल सहेजी नहीं जा सकी।",
    exportEmpty: "एक्सपोर्ट करने के लिए कुछ नहीं है।",

    /* History */
    historyTitle: "सत्रों का इतिहास",
    finishSession: "सत्र समाप्त करें",
    finishSessionHelp: "यह ट्रांसक्रिप्ट इतिहास में चली जाएगी और नई ट्रांसक्रिप्ट शुरू होगी।",
    sessionFinished: "सत्र इतिहास में जोड़ दिया गया।",
    historyEmpty: "अभी कोई समाप्त सत्र नहीं है।",
    historyMemoryNote: "इतिहास सिर्फ़ तब तक रहता है जब तक आप यह पेज बंद या रीलोड नहीं करते।",
    keepHistory: "इतिहास इस डिवाइस पर रखें",
    keepHistoryHelp:
      "शुरू में बंद रहता है। चालू करने पर पिछले 30 दिनों के अधिकतम 50 सत्र इस ब्राउज़र में बिना एन्क्रिप्शन के सहेजे जाते हैं। इस ब्राउज़र प्रोफ़ाइल का इस्तेमाल करने वाला कोई भी व्यक्ति इन्हें पढ़ सकता है। कुछ भी अपलोड नहीं होता।",
    keepHistoryOn: "इतिहास अब इस ब्राउज़र में सहेजा जाएगा।",
    keepHistoryOff: "सहेजा गया इतिहास इस ब्राउज़र से हटा दिया गया।",
    sessionLabel: "{date} का सत्र",
    sessionModels: "मॉडल: {models}",
    sessionTypedOnly: "सिर्फ़ टाइप किया गया पाठ",
    openSession: "दिखाएँ",
    deleteSession: "सत्र हटाएँ",
    deleteSessionDone: "सत्र हटा दिया गया।",
    deleteAllSessions: "पूरा इतिहास हटाएँ",
    deleteAllConfirm: "सभी सहेजे गए सत्र हटाएँ? इसे वापस नहीं लाया जा सकता।",
    deleteAllDone: "पूरा इतिहास हटा दिया गया।",
    historyInvalid:
      "सहेजा गया इतिहास पढ़ा नहीं जा सका, इसलिए उसे जैसा था वैसा छोड़ दिया गया है और नए सत्र सहेजे नहीं जा रहे हैं। नए सिरे से शुरू करने के लिए पूरा इतिहास हटाएँ।",
    historyUnavailable: "इस ब्राउज़र ने सहेजने की अनुमति नहीं दी, इसलिए इतिहास सिर्फ़ मेमोरी में रहेगा।",
    historyQuota: "ब्राउज़र का स्टोरेज भर गया है, इसलिए इतिहास सहेजा नहीं जा सका।",
  },
});

export type LanguageMessages = (typeof languageMessages)["en"];
export type LanguageMessageKey = keyof LanguageMessages;

/** Names of the output languages, for the {language} placeholder, keyed by
 *  interface locale then output language. */
export const outputLanguageNames = defineMessages({
  en: { en: "English", hi: "Hindi" },
  hi: { en: "अंग्रेज़ी", hi: "हिन्दी" },
});

/** Replaces `{name}` placeholders. Unknown placeholders are left as written. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole,
  );
}
