"use client";

import { ErrorContent } from "@/components/layout/SystemPages";

/* Next 16: the error boundary receives `retry` (re-fetch and re-render the segment). */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} />;
}
