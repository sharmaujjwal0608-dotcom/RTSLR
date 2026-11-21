import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: { absolute: "RTSLR — Turn signs into conversations" },
  description:
    "RTSLR is a research platform for recognising Indian Sign Language in the browser. Today it ships a legacy ASL prototype, an experimental ISL recogniser you train yourself and a simulator; no validated ISL model exists yet.",
};

export default function Page() {
  return <HomePage />;
}
