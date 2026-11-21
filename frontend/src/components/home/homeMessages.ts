import { defineMessages } from "@/i18n";

export const homeMessages = defineMessages({
  en: {
    hero: {
      title: "Turn Signs into Conversations.",
      lead: "An intelligent platform designed to recognize Indian Sign Language and help turn supported signs into text and speech.",
      primary: "Try Live Translation",
      demo: "Watch Demo",
      status: "Research preview: no validated ISL model yet",
      demoNote: "The demo opens the labelled simulator. No camera is needed.",
    },
    today: {
      title: "What works today",
      lead: "RTSLR is a research platform, not a finished translator. This is exactly what you can run right now.",
      items: [
        {
          badge: "Legacy ASL prototype",
          title: "ASL fingerspelling prototype",
          text: "The original demo for American Sign Language letters, kept for reference. It uses hand-written rules rather than a trained model, and it is not ISL.",
        },
        {
          badge: "Experimental",
          title: "An ISL recogniser you train yourself",
          text: "Record your own one-hand and two-hand samples in your browser and RTSLR matches new poses against them. It knows only the signs you recorded, the way you recorded them.",
        },
        {
          badge: "Simulator",
          title: "Simulator",
          text: "Synthetic hand data that drives the whole studio without a camera, so you can see how it behaves. Its output is not recognition.",
        },
        {
          badge: "Not available yet",
          title: "A validated ISL model",
          text: "No trained ISL model with a documented evaluation across different signers exists yet. It is the next milestone.",
        },
      ],
      noticeTitle: "Nothing here is validated ISL translation",
      notice:
        "Do not rely on RTSLR for medical, legal, emergency or other high-stakes communication. It does not replace a qualified interpreter.",
    },
    intro: {
      eyebrow: "The product",
      statement: "A studio in your browser that follows your hands and writes down the signs it recognises.",
      p1: "RTSLR tracks your hands through the camera, describes their shape as numbers and compares that description with the signs a model knows. Recognised signs build a transcript you can read, hear spoken aloud or export.",
      p2: "It is being built for Indian Sign Language, where many signs need both hands working together. That is why two hands are treated as one coordinated shape and never as two separate guesses.",
      link: "See how the product works",
    },
    pipeline: {
      title: "From camera to transcript",
      lead: "Five steps run for every frame, all of them on your device.",
    },
    how: {
      title: "How you use it",
      lead: "Four steps from opening the studio to having text you can use.",
      steps: [
        {
          title: "Open the studio",
          text: "Choose the camera or the simulator. The camera starts only when you press the button for it.",
        },
        {
          title: "Pick or teach a model",
          text: "Use the labelled prototype, or record a few samples of your own signs with one hand or two.",
        },
        {
          title: "Hold a sign steady",
          text: "Keep the pose for a little over a second. Once it has held, a single entry is added.",
        },
        {
          title: "Use the text",
          text: "Read the transcript, have your browser speak it, or copy and export it.",
        },
      ],
    },
    features: {
      title: "What it is built to do",
      items: [
        {
          title: "Runs in your browser",
          text: "Hand tracking and recognition run on your device. There is no recognition server to send video to.",
        },
        {
          title: "Two hands, read together",
          text: "Up to two hands are tracked and described as one coordinated shape, which is what two-handed signs need.",
        },
        {
          title: "Teach it your signs",
          text: "Record samples in the studio and try them straight away. They are kept in this browser only.",
        },
        {
          title: "Steady before it types",
          text: "Voting, a hold timer and a cooldown keep flickering guesses out of the transcript.",
        },
        {
          title: "English and Hindi interface",
          text: "Switch the interface language at any time. Hindi output appears only where a reviewed mapping exists.",
        },
        {
          title: "Text, speech and export",
          text: "The transcript can be read on screen, spoken by your browser's voice or exported as text.",
        },
      ],
    },
    isl: {
      eyebrow: "About ISL",
      title: "Indian Sign Language is a language, not a code",
      lead: "What ISL is, and is not, decides what this project may honestly claim.",
      points: [
        {
          title: "It has its own grammar",
          text: "ISL grew within the Indian Deaf community. It is not Hindi or English made with the hands; it has its own grammar and vocabulary.",
        },
        {
          title: "Much of its fingerspelling uses two hands",
          text: "Many letters of the ISL manual alphabet are formed with both hands together, unlike the one-handed alphabet of ASL. A system built for one cannot simply be relabelled for the other.",
        },
        {
          title: "Fingerspelling is not translation",
          text: "Spelling a word letter by letter is one part of signing, not the whole of it. Recognising letters is not the same as understanding signed sentences.",
        },
        {
          title: "Meaning is not only in the hands",
          text: "Facial expression, body posture and the use of space carry meaning too. A system that sees only hands cannot read that part of the language.",
        },
      ],
      link: "Start with the ISL basics",
    },
    explore: {
      title: "Go further",
      useCases: {
        label: "Use cases",
        title: "Classrooms, counters and everyday conversations",
        text: "Six situations, each with what RTSLR can do in it today and what it cannot do yet.",
        link: "Read the use cases",
      },
      learn: {
        label: "Learn ISL",
        title: "Alphabet, everyday vocabulary and practice",
        text: "Every item says whether its source is verified or still pending.",
        link: "Open the learning area",
      },
      research: {
        label: "R&D",
        title: "Method, datasets and open problems",
        text: "The research notes and roadmap, with every figure attributed to where it came from.",
        link: "Read the research notes",
      },
    },
    privacy: {
      eyebrow: "Privacy",
      statement: "Your camera feed never leaves your browser.",
      facts: [
        { title: "Starts only when you click", text: "The camera never turns on by itself." },
        { title: "Nothing uploaded or recorded", text: "Frames are processed in memory and then discarded." },
        { title: "Stops when the tab is hidden", text: "Switch tabs and the camera is released." },
      ],
    },
    cta: {
      title: "Try it with your own hands",
      lead: "Open the studio with your camera, or start with the simulator if you would rather not use one.",
      primary: "Try Live Translation",
      secondary: "Open the simulator",
    },
  },
  hi: {
    hero: {
      title: "संकेतों को बातचीत में बदलें।",
      lead: "एक बुद्धिमान मंच, जिसे भारतीय सांकेतिक भाषा को पहचानने और समर्थित संकेतों को पाठ और वाणी में बदलने में मदद के लिए बनाया गया है।",
      primary: "लाइव अनुवाद आज़माएँ",
      demo: "डेमो देखें",
      status: "शोध पूर्वावलोकन: अभी कोई प्रमाणित ISL मॉडल नहीं",
      demoNote: "डेमो में साफ़ तौर पर चिह्नित सिम्युलेटर खुलता है। कैमरे की ज़रूरत नहीं।",
    },
    today: {
      title: "आज क्या काम करता है",
      lead: "RTSLR एक शोध मंच है, तैयार अनुवादक नहीं। अभी आप ठीक यही चला सकते हैं।",
      items: [
        {
          badge: "पुराना ASL प्रोटोटाइप",
          title: "ASL फ़िंगरस्पेलिंग प्रोटोटाइप",
          text: "अमेरिकी सांकेतिक भाषा के अक्षरों का मूल डेमो, जो संदर्भ के लिए रखा गया है। यह प्रशिक्षित मॉडल नहीं, हाथ से लिखे नियमों पर चलता है, और यह ISL नहीं है।",
        },
        {
          badge: "प्रायोगिक",
          title: "ISL पहचानकर्ता जिसे आप खुद सिखाते हैं",
          text: "अपने ब्राउज़र में एक हाथ और दो हाथ वाले नमूने रिकॉर्ड करें; RTSLR नई मुद्राओं का मिलान उन्हीं से करता है। यह केवल वही संकेत जानता है जो आपने रिकॉर्ड किए, और वैसे ही जैसे आपने किए।",
        },
        {
          badge: "सिम्युलेटर",
          title: "सिम्युलेटर",
          text: "कृत्रिम हस्त-डेटा, जो बिना कैमरे के पूरा स्टूडियो चलाता है ताकि आप उसका व्यवहार देख सकें। इसका आउटपुट पहचान नहीं है।",
        },
        {
          badge: "अभी उपलब्ध नहीं",
          title: "प्रमाणित ISL मॉडल",
          text: "ऐसा कोई प्रशिक्षित ISL मॉडल अभी नहीं है जिसका अलग-अलग संकेतकर्ताओं पर दर्ज किया गया मूल्यांकन हो। यही अगला पड़ाव है।",
        },
      ],
      noticeTitle: "यहाँ कुछ भी प्रमाणित ISL अनुवाद नहीं है",
      notice:
        "चिकित्सा, क़ानूनी, आपातकालीन या किसी भी गंभीर स्थिति की बातचीत के लिए RTSLR पर निर्भर न रहें। यह योग्य दुभाषिए की जगह नहीं लेता।",
    },
    intro: {
      eyebrow: "उत्पाद",
      statement: "आपके ब्राउज़र में एक स्टूडियो, जो आपके हाथों को देखता है और पहचाने गए संकेत लिखता जाता है।",
      p1: "RTSLR कैमरे से आपके हाथों को ट्रैक करता है, उनके आकार को संख्याओं में बदलता है और उस विवरण की तुलना उन संकेतों से करता है जिन्हें मॉडल जानता है। पहचाने गए संकेतों से एक ट्रांसक्रिप्ट बनती है, जिसे आप पढ़ सकते हैं, सुन सकते हैं या निर्यात कर सकते हैं।",
      p2: "इसे भारतीय सांकेतिक भाषा के लिए बनाया जा रहा है, जहाँ कई संकेतों में दोनों हाथ साथ काम करते हैं। इसीलिए दो हाथों को एक समन्वित आकार माना जाता है, दो अलग-अलग अनुमान कभी नहीं।",
      link: "देखें कि उत्पाद कैसे काम करता है",
    },
    pipeline: {
      title: "कैमरे से ट्रांसक्रिप्ट तक",
      lead: "हर फ़्रेम पर पाँच चरण चलते हैं, और सभी आपके डिवाइस पर।",
    },
    how: {
      title: "इसे कैसे उपयोग करें",
      lead: "स्टूडियो खोलने से लेकर उपयोग लायक पाठ तक चार चरण।",
      steps: [
        {
          title: "स्टूडियो खोलें",
          text: "कैमरा या सिम्युलेटर चुनें। कैमरा तभी शुरू होता है जब आप उसका बटन दबाते हैं।",
        },
        {
          title: "मॉडल चुनें या सिखाएँ",
          text: "चिह्नित प्रोटोटाइप का उपयोग करें, या एक या दो हाथों से अपने संकेतों के कुछ नमूने रिकॉर्ड करें।",
        },
        {
          title: "संकेत को स्थिर रखें",
          text: "मुद्रा को एक सेकंड से थोड़ा अधिक टिकाए रखें। टिकने के बाद एक ही प्रविष्टि जुड़ती है।",
        },
        {
          title: "पाठ का उपयोग करें",
          text: "ट्रांसक्रिप्ट पढ़ें, ब्राउज़र से बुलवाएँ, या कॉपी और निर्यात करें।",
        },
      ],
    },
    features: {
      title: "इसे क्या करने के लिए बनाया गया है",
      items: [
        {
          title: "आपके ब्राउज़र में चलता है",
          text: "हाथों की ट्रैकिंग और पहचान आपके डिवाइस पर चलती है। वीडियो भेजने के लिए कोई पहचान सर्वर है ही नहीं।",
        },
        {
          title: "दोनों हाथ, एक साथ पढ़े जाते हैं",
          text: "अधिकतम दो हाथ ट्रैक होते हैं और एक समन्वित आकार के रूप में दर्ज होते हैं, जैसा दो हाथ वाले संकेतों को चाहिए।",
        },
        {
          title: "इसे अपने संकेत सिखाएँ",
          text: "स्टूडियो में नमूने रिकॉर्ड करें और तुरंत आज़माएँ। वे केवल इसी ब्राउज़र में रहते हैं।",
        },
        {
          title: "लिखने से पहले स्थिरता",
          text: "मतदान, होल्ड टाइमर और विराम के कारण डगमगाते अनुमान ट्रांसक्रिप्ट में नहीं पहुँचते।",
        },
        {
          title: "अंग्रेज़ी और हिन्दी इंटरफ़ेस",
          text: "इंटरफ़ेस की भाषा कभी भी बदलें। हिन्दी आउटपुट वहीं दिखता है जहाँ जाँची हुई मैपिंग मौजूद है।",
        },
        {
          title: "पाठ, वाणी और निर्यात",
          text: "ट्रांसक्रिप्ट स्क्रीन पर पढ़ी जा सकती है, ब्राउज़र की आवाज़ में सुनी जा सकती है या पाठ के रूप में निर्यात की जा सकती है।",
        },
      ],
    },
    isl: {
      eyebrow: "ISL के बारे में",
      title: "भारतीय सांकेतिक भाषा एक भाषा है, कोई कूट नहीं",
      lead: "ISL क्या है और क्या नहीं, इसी से तय होता है कि यह परियोजना ईमानदारी से क्या दावा कर सकती है।",
      points: [
        {
          title: "इसका अपना व्याकरण है",
          text: "ISL भारत के बधिर समुदाय के बीच विकसित हुई। यह हाथों से बोली गई हिन्दी या अंग्रेज़ी नहीं है; इसका अपना व्याकरण और शब्द-भंडार है।",
        },
        {
          title: "इसकी फ़िंगरस्पेलिंग में अक्सर दो हाथ लगते हैं",
          text: "ISL वर्णमाला के कई अक्षर दोनों हाथों से मिलकर बनते हैं, जबकि ASL की वर्णमाला एक हाथ की है। एक के लिए बनी प्रणाली पर बस दूसरे का नाम नहीं चिपकाया जा सकता।",
        },
        {
          title: "फ़िंगरस्पेलिंग अनुवाद नहीं है",
          text: "किसी शब्द को अक्षर-दर-अक्षर बताना संकेत करने का एक हिस्सा है, पूरी भाषा नहीं। अक्षर पहचानना संकेतों में कहे गए वाक्य समझने के बराबर नहीं है।",
        },
        {
          title: "अर्थ केवल हाथों में नहीं होता",
          text: "चेहरे के भाव, शरीर की मुद्रा और स्थान का उपयोग भी अर्थ रखते हैं। जो प्रणाली केवल हाथ देखती है, वह भाषा का यह हिस्सा नहीं पढ़ सकती।",
        },
      ],
      link: "ISL की बुनियादी बातों से शुरू करें",
    },
    explore: {
      title: "और आगे",
      useCases: {
        label: "उपयोग",
        title: "कक्षाएँ, काउंटर और रोज़मर्रा की बातचीत",
        text: "छह स्थितियाँ, और हर एक में यह कि RTSLR आज क्या कर सकता है और अभी क्या नहीं।",
        link: "उपयोग के उदाहरण पढ़ें",
      },
      learn: {
        label: "ISL सीखें",
        title: "वर्णमाला, रोज़मर्रा के शब्द और अभ्यास",
        text: "हर सामग्री पर लिखा है कि उसका स्रोत सत्यापित है या अभी लंबित।",
        link: "सीखने का क्षेत्र खोलें",
      },
      research: {
        label: "शोध",
        title: "विधि, डेटासेट और खुली समस्याएँ",
        text: "शोध नोट्स और आगे की योजना, जहाँ हर आँकड़े के साथ उसका स्रोत दिया गया है।",
        link: "शोध नोट्स पढ़ें",
      },
    },
    privacy: {
      eyebrow: "निजता",
      statement: "आपके कैमरे की तस्वीर कभी आपके ब्राउज़र से बाहर नहीं जाती।",
      facts: [
        { title: "आपके क्लिक पर ही शुरू", text: "कैमरा कभी अपने-आप चालू नहीं होता।" },
        { title: "न अपलोड, न रिकॉर्ड", text: "फ़्रेम मेमोरी में प्रोसेस होते हैं और फिर हटा दिए जाते हैं।" },
        { title: "टैब छिपते ही बंद", text: "टैब बदलते ही कैमरा छोड़ दिया जाता है।" },
      ],
    },
    cta: {
      title: "अपने हाथों से आज़माएँ",
      lead: "स्टूडियो को कैमरे के साथ खोलें, या कैमरा न चलाना चाहें तो सिम्युलेटर से शुरू करें।",
      primary: "लाइव अनुवाद आज़माएँ",
      secondary: "सिम्युलेटर खोलें",
    },
  },
});
