import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Product",
  description:
    "How RTSLR works: on-device camera handling, dual-hand tracking with a coordinated 156-D feature vector, hold-to-append text output and English/Hindi options. Experimental; no validated ISL model yet.",
};

export default function Page() {
  return <ProductPage />;
}
