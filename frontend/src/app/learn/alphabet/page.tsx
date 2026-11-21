import type { Metadata } from "next";
import { CategoryStudy } from "@/components/learning/CategoryStudy";

export const metadata: Metadata = {
  title: "Alphabet and numbers — Learn ISL",
  description:
    "The letters A to Z and digits 0 to 9 as ISL vocabulary items. ISL fingerspelling is largely two-handed and differs from ASL; demonstrations are pending a verified source.",
};

export default function Page() {
  return <CategoryStudy variant="alphabet" />;
}
