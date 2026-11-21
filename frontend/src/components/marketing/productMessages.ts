import { defineMessages } from "@/i18n";

export type CapabilityStatus = "implemented" | "experimental" | "legacy" | "demo" | "limited" | "device" | "missing";

type Capability = { what: string; how: string; status: CapabilityStatus };

export const productMessages = defineMessages({
  en: {
    header: {
      eyebrow: "Product",
      title: "How RTSLR reads a sign",
      lead: "A camera-based studio that runs in your browser: it tracks your hands, describes their shape and adds steady, recognised signs to a transcript.",
      status: "Experimental: no validated ISL model",
    },
    specimen: {
      title: "Live recognition, part by part",
      lead: "The studio is laid out around five parts, each there to keep the result honest and readable.",
      caption: "Schematic of the studio layout. It is a diagram, not a screenshot, and the hands shown are not a sign.",
      figureLabel: "Diagram of the studio with five numbered parts, described in the list that follows.",
      notes: [
        {
          title: "The running model is always named",
          text: "A notice above the stage says which model is active: the simulator, the legacy ASL prototype or your recorded samples. None of them is validated ISL recognition.",
        },
        {
          title: "The stage shows what the tracker sees",
          text: "Landmarks are drawn over your hands, so you can tell when tracking is lost or a hand has left the frame.",
        },
        {
          title: "Status is written in words",
          text: "Camera, tracking and model state are spelled out and never signalled by colour alone.",
        },
        {
          title: "Candidates come with plain scores",
          text: "The closest matches are listed with a score. Today's models give classifier scores, not probabilities, and the wording says so.",
        },
        {
          title: "The transcript is yours",
          text: "Committed signs are appended to a transcript that you can read, have spoken, copy, export or clear.",
        },
      ],
    },
    capabilities: {
      title: "What it does, and where each part stands",
      colWhat: "What",
      colHow: "How it works",
      colStatus: "Status",
      status: {
        implemented: "Implemented",
        experimental: "Experimental",
        legacy: "Legacy, not ISL",
        demo: "Demonstration only",
        limited: "Limited",
        device: "Depends on your browser",
        missing: "Not available yet",
      } satisfies Record<CapabilityStatus, string>,
      rows: [
        {
          what: "Live recognition",
          how: "Every camera frame is tracked, described and scored inside the browser. Only steady, repeated results reach the transcript.",
          status: "experimental",
        },
        {
          what: "Dual-hand tracking",
          how: "Up to two hands are followed at once and kept apart from one frame to the next.",
          status: "implemented",
        },
        {
          what: "Coordinated two-hand features",
          how: "Two visible hands become one 156-number description that includes how the hands sit against each other.",
          status: "implemented",
        },
        {
          what: "ISL signs you teach it",
          how: "You record one-hand and two-hand samples; new poses are matched to the nearest recorded ones. It knows only what you recorded.",
          status: "experimental",
        },
        {
          what: "ASL fingerspelling letters",
          how: "Hand-written rules carried over from the first prototype. American Sign Language, one hand at a time.",
          status: "legacy",
        },
        {
          what: "Simulator",
          how: "Synthetic hand data drives the studio so it can be tried without a camera. Its output is not recognition.",
          status: "demo",
        },
        {
          what: "Text output",
          how: "Committed signs build a transcript that can be copied or exported as a file from the browser.",
          status: "implemented",
        },
        {
          what: "Speech output",
          how: "The transcript is spoken with your browser's own speech voices. If no voice is installed for a language, speech in it is unavailable.",
          status: "device",
        },
        {
          what: "Hindi output",
          how: "Shown only where a reviewed Hindi mapping exists. Where none does, the English label is shown and marked instead of a guess.",
          status: "limited",
        },
        {
          what: "Validated ISL recognition",
          how: "Needs a model trained on consented data from many signers and evaluated on signers it has never seen. That model does not exist yet.",
          status: "missing",
        },
      ] satisfies Capability[],
    },
    privacy: {
      eyebrow: "Camera and privacy",
      title: "Your camera, handled on your device",
      lead: "Recognition has no server side. That is a design decision, not a setting.",
      doesTitle: "RTSLR does",
      does: [
        "Start the camera only when you press the button for it.",
        "Process each frame inside the browser tab and then discard it.",
        "Pause the camera when the tab is hidden, and wait for you to resume it.",
        "Keep the samples you record in this browser's own storage.",
      ],
      doesNotTitle: "RTSLR does not",
      doesNot: [
        "Upload frames or hand landmarks to any server.",
        "Record video or save images from the camera.",
        "Turn the camera on by itself, or restart it without you.",
        "Send anything to the feedback service unless you write a message and submit it yourself.",
      ],
      note: "One download to know about: the hand-tracking model file is fetched when tracking first starts. Depending on how this site is deployed it comes from the site itself or from Google's public MediaPipe model storage. Nothing from your camera is sent with that request.",
    },
    hands: {
      eyebrow: "Dual-hand tracking",
      title: "Two hands are one shape, not two labels",
      p1: "Each tracked hand gives 21 landmarks. Measured from the wrist and scaled by the length of the palm, they become 63 numbers that describe the hand's shape wherever it is in the picture and however large it appears.",
      p2: "Many ISL signs are made by both hands together, and what matters is how one hand sits against the other. Labelling each hand separately and joining the two labels throws that relationship away. So when two hands are visible, RTSLR builds a single 156-number description: both hand shapes, plus how the wrists, fingertips and palms relate.",
      limit: "Known limit: the hands are ordered left to right in the picture, so if they cross over, their order swaps.",
      explorerTitle: "Explore the 21 landmarks",
      vectorTitle: "What the 156 numbers are",
      vectorLabel: "Make-up of the two-hand description, 156 numbers in total",
      segments: [
        { count: 63, label: "Shape of hand A" },
        { count: 63, label: "Shape of hand B" },
        { count: 4, label: "Wrist-to-wrist offset and distance" },
        { count: 25, label: "Distances between every pair of fingertips across the hands" },
        { count: 1, label: "How the two palms face each other" },
      ],
    },
    hold: {
      eyebrow: "Text output",
      title: "Nothing is typed by a single frame",
      p1: "Raw per-frame guesses flicker. Before anything reaches the transcript, the last 8 recognised frames are put to a vote; once enough agree, the same result has to hold for 1.2 seconds. Then exactly one entry is added and a 1-second cooldown follows.",
      p2: "A pose you keep holding is added once, not over and over: you release it before it can be added again. The hold time can be adjusted between 0.5 and 2.5 seconds in the studio.",
      demoTitle: "Feel the timing",
    },
    language: {
      eyebrow: "Languages",
      title: "English and Hindi, with a clear limit",
      interfaceTitle: "Interface",
      interfaceText:
        "Labels, notices and instructions are available in English and Hindi. Switch at any time from the header; your choice is remembered in this browser.",
      outputTitle: "Output",
      outputText:
        "Hindi output is shown only where a reviewed Hindi mapping exists for a sign. Where there is none, the English label appears and is marked as such. Fingerspelled Latin letters and digits stay as they are.",
      noticeTitle: "Interface language is not translation",
      notice:
        "Switching to Hindi changes the words on the buttons. It does not change what the recogniser can understand, and it does not make RTSLR a translator between ISL and Hindi.",
    },
    specs: {
      title: "Specification",
      lead: "Facts about the system as built. Speed and accuracy are left out because they have not been measured.",
      rows: [
        { label: "Landmarks per hand", value: "21" },
        { label: "Single-hand feature vector", value: "63-D" },
        { label: "Two-hand feature vector", value: "156-D" },
        { label: "Hands tracked at once", value: "up to 2" },
        { label: "Where it runs", value: "in your browser" },
        { label: "Vote window", value: "8 frames" },
        { label: "Hold before a sign is added", value: "1.2 s (0.5–2.5 s)" },
        { label: "Cooldown after a sign is added", value: "1 s" },
        { label: "Interface languages", value: "English, Hindi" },
        { label: "Validated ISL model", value: "none yet" },
        { label: "Speed and accuracy", value: "not measured" },
      ],
    },
    cta: {
      title: "See it running",
      lead: "The studio opens with the camera off. Start it yourself, or use the simulator.",
      primary: "Open the studio",
      secondary: "Open the simulator",
    },
  },
  hi: {
    header: {
      eyebrow: "उत्पाद",
      title: "RTSLR संकेत को कैसे पढ़ता है",
      lead: "कैमरे पर आधारित एक स्टूडियो, जो आपके ब्राउज़र में चलता है: यह आपके हाथों को ट्रैक करता है, उनके आकार का विवरण बनाता है और स्थिर, पहचाने गए संकेतों को ट्रांसक्रिप्ट में जोड़ता है।",
      status: "प्रायोगिक: कोई प्रमाणित ISL मॉडल नहीं",
    },
    specimen: {
      title: "लाइव पहचान, हिस्सा-दर-हिस्सा",
      lead: "स्टूडियो पाँच हिस्सों के इर्द-गिर्द बना है, और हर हिस्सा नतीजे को ईमानदार और पढ़ने लायक रखने के लिए है।",
      caption: "स्टूडियो की बनावट का रेखाचित्र। यह एक आरेख है, स्क्रीनशॉट नहीं, और दिखाए गए हाथ कोई संकेत नहीं हैं।",
      figureLabel: "स्टूडियो का आरेख जिसमें पाँच क्रमांकित हिस्से हैं; उनका वर्णन आगे की सूची में है।",
      notes: [
        {
          title: "चल रहे मॉडल का नाम हमेशा लिखा रहता है",
          text: "स्टेज के ऊपर एक सूचना बताती है कि कौन-सा मॉडल सक्रिय है: सिम्युलेटर, पुराना ASL प्रोटोटाइप या आपके रिकॉर्ड किए नमूने। इनमें से कोई भी प्रमाणित ISL पहचान नहीं है।",
        },
        {
          title: "स्टेज वही दिखाता है जो ट्रैकर देखता है",
          text: "आपके हाथों पर लैंडमार्क बनाए जाते हैं, ताकि आप जान सकें कि ट्रैकिंग कब छूटी या हाथ कब फ़्रेम से बाहर गया।",
        },
        {
          title: "स्थिति शब्दों में लिखी जाती है",
          text: "कैमरा, ट्रैकिंग और मॉडल की स्थिति शब्दों में बताई जाती है, केवल रंग से कभी नहीं।",
        },
        {
          title: "विकल्प सीधे-सादे स्कोर के साथ आते हैं",
          text: "सबसे नज़दीकी मिलान स्कोर के साथ दिखते हैं। आज के मॉडल वर्गीकरण स्कोर देते हैं, संभावना नहीं, और शब्द भी यही कहते हैं।",
        },
        {
          title: "ट्रांसक्रिप्ट आपकी है",
          text: "दर्ज हुए संकेत ट्रांसक्रिप्ट में जुड़ते हैं, जिसे आप पढ़ सकते हैं, सुन सकते हैं, कॉपी, निर्यात या साफ़ कर सकते हैं।",
        },
      ],
    },
    capabilities: {
      title: "यह क्या करता है, और हर हिस्सा कहाँ तक पहुँचा है",
      colWhat: "क्या",
      colHow: "कैसे काम करता है",
      colStatus: "स्थिति",
      status: {
        implemented: "बन चुका है",
        experimental: "प्रायोगिक",
        legacy: "पुराना, ISL नहीं",
        demo: "केवल प्रदर्शन",
        limited: "सीमित",
        device: "आपके ब्राउज़र पर निर्भर",
        missing: "अभी उपलब्ध नहीं",
      } satisfies Record<CapabilityStatus, string>,
      rows: [
        {
          what: "लाइव पहचान",
          how: "कैमरे का हर फ़्रेम ब्राउज़र के भीतर ट्रैक होता है, उसका विवरण बनता है और स्कोर दिया जाता है। केवल स्थिर और दोहराए गए नतीजे ट्रांसक्रिप्ट तक पहुँचते हैं।",
          status: "experimental",
        },
        {
          what: "दोनों हाथों की ट्रैकिंग",
          how: "एक साथ अधिकतम दो हाथ ट्रैक होते हैं और फ़्रेम-दर-फ़्रेम अलग-अलग पहचाने जाते हैं।",
          status: "implemented",
        },
        {
          what: "दो हाथों के समन्वित फ़ीचर",
          how: "दिख रहे दो हाथ 156 संख्याओं का एक विवरण बनते हैं, जिसमें यह भी शामिल है कि हाथ एक-दूसरे के सापेक्ष कैसे हैं।",
          status: "implemented",
        },
        {
          what: "ISL संकेत जो आप सिखाते हैं",
          how: "आप एक और दो हाथ वाले नमूने रिकॉर्ड करते हैं; नई मुद्रा का मिलान सबसे नज़दीकी नमूनों से होता है। यह केवल वही जानता है जो आपने रिकॉर्ड किया।",
          status: "experimental",
        },
        {
          what: "ASL फ़िंगरस्पेलिंग के अक्षर",
          how: "पहले प्रोटोटाइप से लिए गए, हाथ से लिखे नियम। अमेरिकी सांकेतिक भाषा, एक बार में एक हाथ।",
          status: "legacy",
        },
        {
          what: "सिम्युलेटर",
          how: "कृत्रिम हस्त-डेटा स्टूडियो को चलाता है, ताकि बिना कैमरे के आज़माया जा सके। इसका आउटपुट पहचान नहीं है।",
          status: "demo",
        },
        {
          what: "पाठ आउटपुट",
          how: "दर्ज हुए संकेतों से ट्रांसक्रिप्ट बनती है, जिसे ब्राउज़र से ही कॉपी या फ़ाइल के रूप में निर्यात किया जा सकता है।",
          status: "implemented",
        },
        {
          what: "वाणी आउटपुट",
          how: "ट्रांसक्रिप्ट आपके ब्राउज़र की अपनी आवाज़ों से बोली जाती है। किसी भाषा की आवाज़ इंस्टॉल न हो तो उस भाषा में वाणी उपलब्ध नहीं होगी।",
          status: "device",
        },
        {
          what: "हिन्दी आउटपुट",
          how: "केवल वहीं दिखता है जहाँ जाँची हुई हिन्दी मैपिंग मौजूद है। जहाँ नहीं है, वहाँ अनुमान की जगह अंग्रेज़ी लेबल दिखता है और चिह्नित रहता है।",
          status: "limited",
        },
        {
          what: "प्रमाणित ISL पहचान",
          how: "इसके लिए ऐसा मॉडल चाहिए जो कई संकेतकर्ताओं के सहमति से मिले डेटा पर प्रशिक्षित हो और उन संकेतकर्ताओं पर जाँचा गया हो जिन्हें उसने पहले नहीं देखा। ऐसा मॉडल अभी नहीं है।",
          status: "missing",
        },
      ] satisfies Capability[],
    },
    privacy: {
      eyebrow: "कैमरा और निजता",
      title: "आपका कैमरा, आपके ही डिवाइस पर सँभाला जाता है",
      lead: "पहचान का कोई सर्वर पक्ष नहीं है। यह बनावट का फ़ैसला है, कोई सेटिंग नहीं।",
      doesTitle: "RTSLR यह करता है",
      does: [
        "कैमरा तभी शुरू करता है जब आप उसका बटन दबाते हैं।",
        "हर फ़्रेम को ब्राउज़र टैब के भीतर प्रोसेस करके छोड़ देता है।",
        "टैब छिपने पर कैमरा रोक देता है और आपके दोबारा शुरू करने का इंतज़ार करता है।",
        "आपके रिकॉर्ड किए नमूने इसी ब्राउज़र के अपने स्टोरेज में रखता है।",
      ],
      doesNotTitle: "RTSLR यह नहीं करता",
      doesNot: [
        "फ़्रेम या हाथ के लैंडमार्क किसी सर्वर पर अपलोड नहीं करता।",
        "वीडियो रिकॉर्ड नहीं करता और कैमरे की तस्वीरें नहीं सहेजता।",
        "कैमरा अपने-आप चालू नहीं करता, और आपके बिना दोबारा शुरू नहीं करता।",
        "फ़ीडबैक सेवा को तब तक कुछ नहीं भेजता जब तक आप खुद संदेश लिखकर न भेजें।",
      ],
      note: "एक डाउनलोड के बारे में जान लें: हाथ ट्रैक करने वाले मॉडल की फ़ाइल ट्रैकिंग पहली बार शुरू होने पर लाई जाती है। साइट की तैनाती के अनुसार यह इसी साइट से या Google के सार्वजनिक MediaPipe मॉडल स्टोरेज से आती है। उस अनुरोध के साथ आपके कैमरे का कुछ भी नहीं भेजा जाता।",
    },
    hands: {
      eyebrow: "दोनों हाथों की ट्रैकिंग",
      title: "दो हाथ एक आकार हैं, दो लेबल नहीं",
      p1: "ट्रैक किया गया हर हाथ 21 लैंडमार्क देता है। कलाई से नापकर और हथेली की लंबाई से सामान्य करके ये 63 संख्याएँ बनते हैं, जो हाथ का आकार बताती हैं, चाहे हाथ तस्वीर में कहीं भी हो और कितना भी बड़ा दिखे।",
      p2: "ISL के कई संकेत दोनों हाथों से मिलकर बनते हैं, और असली बात यह होती है कि एक हाथ दूसरे के सापेक्ष कैसे है। हर हाथ को अलग लेबल देकर दोनों लेबल जोड़ देने से यह संबंध खो जाता है। इसलिए जब दो हाथ दिखते हैं, RTSLR 156 संख्याओं का एक ही विवरण बनाता है: दोनों हाथों का आकार, और साथ में कलाइयों, उँगलियों के सिरों और हथेलियों का आपसी संबंध।",
      limit: "ज्ञात सीमा: हाथों का क्रम तस्वीर में बाएँ से दाएँ तय होता है, इसलिए हाथ एक-दूसरे को पार करें तो उनका क्रम बदल जाता है।",
      explorerTitle: "21 लैंडमार्क देखें",
      vectorTitle: "ये 156 संख्याएँ क्या हैं",
      vectorLabel: "दो हाथों के विवरण की बनावट, कुल 156 संख्याएँ",
      segments: [
        { count: 63, label: "हाथ A का आकार" },
        { count: 63, label: "हाथ B का आकार" },
        { count: 4, label: "कलाई से कलाई का अंतर और दूरी" },
        { count: 25, label: "दोनों हाथों की उँगलियों के सिरों की हर जोड़ी के बीच की दूरी" },
        { count: 1, label: "दोनों हथेलियाँ एक-दूसरे की ओर कैसे हैं" },
      ],
    },
    hold: {
      eyebrow: "पाठ आउटपुट",
      title: "अकेला एक फ़्रेम कुछ नहीं लिखता",
      p1: "हर फ़्रेम के कच्चे अनुमान डगमगाते हैं। ट्रांसक्रिप्ट तक कुछ पहुँचने से पहले पिछले 8 पहचाने गए फ़्रेम पर मतदान होता है; पर्याप्त सहमति के बाद वही नतीजा 1.2 सेकंड टिकना चाहिए। तब ठीक एक प्रविष्टि जुड़ती है और 1 सेकंड का विराम आता है।",
      p2: "जो मुद्रा आप टिकाए रखते हैं, वह एक ही बार जुड़ती है, बार-बार नहीं: दोबारा जोड़ने से पहले उसे छोड़ना होता है। होल्ड का समय स्टूडियो में 0.5 से 2.5 सेकंड के बीच बदला जा सकता है।",
      demoTitle: "समय को महसूस करें",
    },
    language: {
      eyebrow: "भाषाएँ",
      title: "अंग्रेज़ी और हिन्दी, एक साफ़ सीमा के साथ",
      interfaceTitle: "इंटरफ़ेस",
      interfaceText:
        "लेबल, सूचनाएँ और निर्देश अंग्रेज़ी और हिन्दी में उपलब्ध हैं। हेडर से कभी भी बदलें; आपकी पसंद इसी ब्राउज़र में याद रहती है।",
      outputTitle: "आउटपुट",
      outputText:
        "हिन्दी आउटपुट केवल वहीं दिखता है जहाँ किसी संकेत के लिए जाँची हुई हिन्दी मैपिंग मौजूद है। जहाँ नहीं है, वहाँ अंग्रेज़ी लेबल दिखता है और उसी रूप में चिह्नित रहता है। फ़िंगरस्पेलिंग के रोमन अक्षर और अंक जैसे हैं वैसे ही रहते हैं।",
      noticeTitle: "इंटरफ़ेस की भाषा अनुवाद नहीं है",
      notice:
        "हिन्दी चुनने से बटनों के शब्द बदलते हैं। इससे यह नहीं बदलता कि पहचानकर्ता क्या समझ सकता है, और RTSLR इससे ISL और हिन्दी के बीच अनुवादक नहीं बन जाता।",
    },
    specs: {
      title: "विनिर्देश",
      lead: "प्रणाली जैसी बनी है, उसके तथ्य। गति और सटीकता इसमें नहीं हैं, क्योंकि उन्हें नापा नहीं गया है।",
      rows: [
        { label: "प्रति हाथ लैंडमार्क", value: "21" },
        { label: "एक हाथ का फ़ीचर वेक्टर", value: "63-D" },
        { label: "दो हाथों का फ़ीचर वेक्टर", value: "156-D" },
        { label: "एक साथ ट्रैक होने वाले हाथ", value: "अधिकतम 2" },
        { label: "कहाँ चलता है", value: "आपके ब्राउज़र में" },
        { label: "मतदान की खिड़की", value: "8 फ़्रेम" },
        { label: "संकेत जुड़ने से पहले होल्ड", value: "1.2 से. (0.5–2.5 से.)" },
        { label: "संकेत जुड़ने के बाद विराम", value: "1 से." },
        { label: "इंटरफ़ेस की भाषाएँ", value: "अंग्रेज़ी, हिन्दी" },
        { label: "प्रमाणित ISL मॉडल", value: "अभी नहीं" },
        { label: "गति और सटीकता", value: "नापी नहीं गई" },
      ],
    },
    cta: {
      title: "इसे चलते हुए देखें",
      lead: "स्टूडियो कैमरा बंद रखकर खुलता है। उसे खुद शुरू करें, या सिम्युलेटर का उपयोग करें।",
      primary: "स्टूडियो खोलें",
      secondary: "सिम्युलेटर खोलें",
    },
  },
});
