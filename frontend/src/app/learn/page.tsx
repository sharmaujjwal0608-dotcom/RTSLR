import type { Metadata } from "next";
import { LearnOverview } from "@/components/learning/LearnOverview";

export const metadata: Metadata = {
  title: "Learn ISL",
  description:
    "Browse Indian Sign Language vocabulary with English and Hindi meanings, short lessons and recall practice. Sign demonstrations are pending a verified source.",
};

export default function Page() {
  return <LearnOverview />;
}
