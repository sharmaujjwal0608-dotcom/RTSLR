import type { Metadata } from "next";
import { ProgressDashboard } from "@/components/learning/ProgressDashboard";

export const metadata: Metadata = {
  title: "Progress — Learn ISL",
  description:
    "Lessons completed, self-ratings, quiz history and streak, stored only in this browser. Export or reset your learning progress.",
};

export default function Page() {
  return <ProgressDashboard />;
}
