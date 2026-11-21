import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/SystemPages";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <NotFoundContent />;
}
