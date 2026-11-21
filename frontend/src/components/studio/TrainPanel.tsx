"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button, Input, Notice, Select } from "@/components/ui";
import { useMessages } from "@/i18n";
import {
  MODEL_IDS,
  getSampleStore,
  summariseSamples,
  type SampleHands,
  type UseRecognitionResult,
} from "@/features/recognition";
import { vocabulary } from "@/features/language";
import { studioMessages } from "./messages";

const EMPTY_SAMPLES: readonly never[] = [];

function downloadJson(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function TrainPanel({
  recognition,
  hasSource,
  modelId,
  onUseUserModel,
}: {
  recognition: UseRecognitionResult;
  hasSource: boolean;
  modelId: string;
  onUseUserModel: () => void;
}) {
  const t = useMessages(studioMessages);
  const store = getSampleStore();
  const samples = useSyncExternalStore(store.subscribe.bind(store), store.getSnapshot.bind(store), () => EMPTY_SAMPLES);
  const classes = summariseSamples(samples);

  const [label, setLabel] = useState("");
  const [hindi, setHindi] = useState("");
  const [hands, setHands] = useState<SampleHands>(1);
  const [count, setCount] = useState(15);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rec = recognition.recording;
  const busy = rec.status === "waiting" || rec.status === "capturing" || rec.status === "saving";

  const statusNotice =
    rec.status === "done" ? t.recDone
    : rec.status === "cancelled" ? t.recCancelled
    : rec.status === "error" ? `${t.recError}: ${rec.errorMessage ?? rec.errorCode ?? ""}`
    : null;

  const start = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const classId = trimmed.toUpperCase().replace(/\s+/g, "_");
    try {
      vocabulary.registerCustomClass({ classId, label: trimmed, signLanguage: "ASL", hi: hindi.trim() || null });
    } catch {
      /* label too long etc.: the controller reports invalid_label */
    }
    setNotice(null);
    recognition.startRecording(classId, trimmed, count);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted">{t.trainIntro}</p>
      {!hasSource && <Notice tone="info" compact>{t.needSource}</Notice>}
      <Input label={t.trainLabel} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} disabled={busy} />
      <Input label={t.trainHindi} value={hindi} onChange={(e) => setHindi(e.target.value)} maxLength={60} lang="hi" disabled={busy} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t.trainHands}
          value={String(hands)}
          onChange={(e) => setHands(Number(e.target.value) as SampleHands)}
          options={[
            { value: "1", label: t.oneHand },
            { value: "2", label: t.twoHandsOpt },
          ]}
          disabled={busy}
        />
        <Input
          label={t.trainCount}
          type="number"
          min={5}
          max={60}
          value={count}
          onChange={(e) => setCount(Math.max(5, Math.min(60, Number(e.target.value) || 15)))}
          disabled={busy}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {busy ? (
          <Button variant="secondary" onClick={recognition.cancelRecording}>
            {t.cancel}
          </Button>
        ) : (
          <Button variant="primary" onClick={start} disabled={!hasSource || !label.trim()}>
            {t.record}
          </Button>
        )}
      </div>
      {busy && (
        <div role="status" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 text-small">
          <p className="font-semibold text-ink">
            {t.recording} “{rec.label}” {rec.captured}/{rec.target}
          </p>
          {rec.hint && <p className="text-muted">{t.hint[rec.hint]}</p>}
          <div className="h-1.5 overflow-hidden rounded-control bg-line" aria-hidden="true">
            <div className="h-full bg-success transition-[width]" style={{ width: `${Math.round(rec.progress * 100)}%` }} />
          </div>
        </div>
      )}
      {(notice ?? statusNotice) && (
        <Notice tone={rec.status === "error" ? "danger" : "success"} compact live="polite">
          {notice ?? statusNotice}
        </Notice>
      )}

      {modelId !== MODEL_IDS.islUser && classes.length > 0 && (
        <Notice
          tone="info"
          compact
          actions={
            <Button variant="secondary" size="sm" onClick={onUseUserModel}>
              {t.switchToUser}
            </Button>
          }
        >
          {t.trainUsesUserModel}
        </Notice>
      )}

      <div>
        <p className="text-small font-semibold text-ink">{t.recorded}</p>
        {classes.length === 0 ? (
          <p className="text-small text-muted">{t.noClasses}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {classes.map((c) => (
              <li key={c.classId} className="flex items-center justify-between gap-3 py-2 text-small">
                <span className="text-ink">
                  <span className="font-semibold">{c.label}</span> · {c.hands === 2 ? t.twoHandsOpt : t.oneHand} · {c.count} {t.samples}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void store.removeClass(c.classId)}>
                  {t.deleteClass}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={classes.length === 0}
          onClick={async () => downloadJson("rtslr-samples.json", await store.exportJson())}
        >
          {t.exportSamples}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          {t.importSamples}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="sr-only"
          aria-label={t.importSamples}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const r = await store.importJson(await file.text(), "merge");
              setNotice(`${t.importDone}: ${r.classes} / ${r.samples}`);
            } catch (err) {
              setNotice(`${t.importFailed}: ${(err as Error).message}`);
            }
            e.target.value = "";
          }}
        />
        <Button variant="ghost" size="sm" disabled={classes.length === 0} onClick={() => void store.clearAll()}>
          {t.clearAll}
        </Button>
      </div>
    </div>
  );
}
