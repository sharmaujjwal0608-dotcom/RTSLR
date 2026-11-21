import type { Metadata } from "next";
import { UseCasesPage } from "@/components/marketing/UseCasesPage";

export const metadata: Metadata = {
  title: "Use cases",
  description:
    "Six everyday situations, each with what RTSLR can do today and what it cannot do yet. Not validated for medical, legal, emergency or other high-stakes communication.",
};

export default function Page() {
  return <UseCasesPage />;
}
