import { defineMessages } from "@/i18n";

/** Primary navigation, in display order. Every href is a route that exists. */
export const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/product", key: "product" },
  { href: "/use-cases", key: "useCases" },
  { href: "/learn", key: "learn" },
  { href: "/research", key: "research" },
  { href: "/about", key: "about" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

export const STUDIO_HREF = "/studio";
/** Opens the Studio with the clearly labelled simulator source selected. */
export const SIMULATOR_DEMO_HREF = "/studio?demo=simulator";

export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const layoutMessages = defineMessages({
  en: {
    nav: {
      home: "Home",
      product: "Product",
      useCases: "Use Cases",
      learn: "Learn ISL",
      research: "R&D",
      about: "About",
    } satisfies Record<NavKey, string>,
    brandLabel: "RTSLR home",
    primaryNav: "Primary",
    getStarted: "Get Started",
    menu: "Menu",
    close: "Close",
    menuSheet: "Site menu",
    language: "Interface language",
    footerNav: "Footer",
    footerExplore: "Explore",
    footerStudio: "Recognition studio",
    footerTagline: "Real-time sign language recognition, built towards Indian Sign Language.",
    capabilityTitle: "What RTSLR is today",
    capability:
      "A research platform. It ships a legacy ASL fingerspelling prototype, an experimental ISL recogniser you train in your own browser, and a simulator. There is no validated ISL model yet, and RTSLR does not replace a qualified interpreter.",
    privacyTitle: "Privacy",
    privacy:
      "Camera processing stays in your browser. Frames are not uploaded and not recorded.",
  },
  hi: {
    nav: {
      home: "होम",
      product: "उत्पाद",
      useCases: "उपयोग",
      learn: "ISL सीखें",
      research: "शोध",
      about: "परिचय",
    } satisfies Record<NavKey, string>,
    brandLabel: "RTSLR होम",
    primaryNav: "मुख्य नेविगेशन",
    getStarted: "शुरू करें",
    menu: "मेनू",
    close: "बंद करें",
    menuSheet: "साइट मेनू",
    language: "इंटरफ़ेस की भाषा",
    footerNav: "फ़ुटर नेविगेशन",
    footerExplore: "देखें",
    footerStudio: "पहचान स्टूडियो",
    footerTagline: "रीयल-टाइम सांकेतिक भाषा पहचान, जो भारतीय सांकेतिक भाषा की दिशा में बन रही है।",
    capabilityTitle: "RTSLR आज क्या है",
    capability:
      "यह एक शोध मंच है। इसमें एक पुराना ASL फ़िंगरस्पेलिंग प्रोटोटाइप, एक प्रायोगिक ISL पहचानकर्ता जिसे आप अपने ब्राउज़र में खुद सिखाते हैं, और एक सिम्युलेटर है। अभी कोई प्रमाणित ISL मॉडल नहीं है, और RTSLR किसी योग्य दुभाषिए की जगह नहीं लेता।",
    privacyTitle: "निजता",
    privacy: "कैमरे की प्रोसेसिंग आपके ब्राउज़र में ही रहती है। फ़्रेम न अपलोड होते हैं, न रिकॉर्ड।",
  },
});
