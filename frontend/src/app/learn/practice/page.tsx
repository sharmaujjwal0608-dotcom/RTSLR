import type { Metadata } from "next";
import { PracticeHub } from "@/components/learning/PracticeHub";

export const metadata: Metadata = {
  title: "Practice — Learn ISL",
  description:
    "Meaning-recall quizzes, self-rated sign practice with spaced repetition, and what camera practice in the Studio can and cannot tell you.",
};

export default function Page() {
  return <PracticeHub />;
}
