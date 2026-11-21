import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioClient } from "@/components/studio/StudioClient";
import { LoadingContent } from "@/components/layout/SystemPages";

export const metadata: Metadata = {
  title: "Recognition Studio",
  description:
    "Camera-based sign recognition that runs entirely in your browser. Default model: the legacy ASL fingerspelling prototype. No validated ISL model exists yet.",
};

export default function StudioPage() {
  return (
    <Suspense fallback={<LoadingContent />}>
      <StudioClient />
    </Suspense>
  );
}
