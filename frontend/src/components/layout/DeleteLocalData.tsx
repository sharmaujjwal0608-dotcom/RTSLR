"use client";

import { useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { useMessages } from "@/i18n";
import { deleteAllLocalData, type DeleteReport } from "@/lib/localData";
import { studioMessages } from "@/components/studio/messages";

/** Footer control: confirmation dialog, then wipes every rtslr.* storage. */
export function DeleteLocalData() {
  const t = useMessages(studioMessages);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [report, setReport] = useState<DeleteReport | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-small font-semibold text-ink underline decoration-transparent underline-offset-4 transition-colors hover:decoration-ink"
        onClick={() => dialogRef.current?.showModal()}
      >
        {t.deleteLocal}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,28rem)] rounded-panel border border-line bg-surface p-6 text-ink shadow-float backdrop:bg-ink/40"
        aria-labelledby="delete-local-title"
      >
        <h2 id="delete-local-title" className="text-h3 font-bold">
          {t.deleteLocal}
        </h2>
        <p className="mt-2 text-small text-muted">{t.deleteLocalBody}</p>
        {report && (
          <Notice tone={report.errors.length ? "warning" : "success"} compact live="polite">
            {t.deleteLocalDone} ({report.localStorageKeys} keys, {report.databases.length} db)
            {report.errors.length > 0 && ` — ${report.errors.join("; ")}`}
          </Notice>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => dialogRef.current?.close()}>
            {t.close}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setReport(await deleteAllLocalData());
              setBusy(false);
            }}
          >
            {t.deleteLocalConfirm}
          </Button>
        </div>
      </dialog>
    </>
  );
}
