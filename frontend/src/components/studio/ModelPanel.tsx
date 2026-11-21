"use client";

import { Badge, Notice, Select } from "@/components/ui";
import { useMessages } from "@/i18n";
import type { ModelLoadStatus, RegistryEntry } from "@/features/recognition";
import type { ModelInfo, RecognitionCandidate } from "@/types/recognition";
import { studioMessages } from "./messages";

export function ModelPanel({
  models,
  modelId,
  onChange,
  status,
  message,
  info,
  candidates,
}: {
  models: RegistryEntry[];
  modelId: string;
  onChange: (id: string) => void;
  status: ModelLoadStatus;
  message: string | null;
  info: ModelInfo | null;
  candidates: RecognitionCandidate[];
}) {
  const t = useMessages(studioMessages);
  const selected = models.find((m) => m.id === modelId);
  return (
    <div className="flex flex-col gap-4">
      <Select
        label={t.modelSelect}
        value={modelId}
        onChange={(e) => onChange(e.target.value)}
        options={models.map((m) => ({
          value: m.id,
          label: `${m.info.name} (${m.info.signLanguage})${m.isDefault ? ` — ${t.modelDefault}` : ""}${
            m.availability === "not_available" ? ` — ${t.modelUnavailable}` : ""
          }`,
        }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status === "ready" ? "success" : status === "error" ? "danger" : "neutral"}>{t.modelStatus[status]}</Badge>
        {selected && <Badge tone={selected.info.validated ? "success" : "warning"}>{selected.kindLabel}</Badge>}
      </div>
      {message && <Notice tone={status === "error" ? "danger" : "info"} compact>{message}</Notice>}
      {selected && (
        <div className="flex flex-col gap-2 text-small text-muted">
          <p className="text-ink">{selected.info.description}</p>
          <p className="font-semibold text-ink">{t.limitations}</p>
          <ul className="list-disc space-y-1 pl-5">
            {selected.info.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {info && (
            <p>
              {t.classes}: {info.classes.length > 0 ? info.classes.map((c) => c.label).join(", ") : "—"}
            </p>
          )}
        </div>
      )}
      {candidates.length > 0 && (
        <div>
          <p className="text-small font-semibold text-ink">{t.candidates}</p>
          <ul className="mt-1 flex flex-col gap-1 font-mono text-small text-muted">
            {candidates.slice(0, 3).map((c) => (
              <li key={c.classId} className="flex justify-between">
                <span>{c.label}</span>
                <span>{c.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-caption text-muted">{t.scoreNote}</p>
    </div>
  );
}
