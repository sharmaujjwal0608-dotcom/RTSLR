import type { Metadata } from "next";
import { CategoryStudy } from "@/components/learning/CategoryStudy";

export const metadata: Metadata = {
  title: "Everyday words — Learn ISL",
  description:
    "Greetings, daily needs, family, question words, time and places with English and Hindi meanings, grouped into short lessons.",
};

export default function Page() {
  return <CategoryStudy variant="everyday" />;
}
