import type { Metadata } from "next";
import { AboutPage } from "@/components/marketing/AboutPage";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why RTSLR exists, how it grew from a single-file ASL fingerspelling prototype into a modular platform aimed at Indian Sign Language, and the principles it is built on.",
};

export default function Page() {
  return <AboutPage />;
}
