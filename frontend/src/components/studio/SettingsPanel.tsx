"use client";

import { Slider, Switch } from "@/components/ui";
import { useMessages } from "@/i18n";
import { studioMessages } from "./messages";

export type StudioSettings = {
  holdSeconds: number;
  minScore: number;
  repeatWhileHeld: boolean;
  mirror: boolean;
  skeleton: boolean;
  bbox: boolean;
  labels: boolean;
  smoothing: boolean;
};

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  holdSeconds: 1.2,
  minScore: 0.75,
  repeatWhileHeld: false,
  mirror: true,
  skeleton: true,
  bbox: false,
  labels: true,
  smoothing: true,
};

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: StudioSettings;
  onChange: (patch: Partial<StudioSettings>) => void;
}) {
  const t = useMessages(studioMessages);
  return (
    <div className="flex flex-col gap-5">
      <Slider
        label={t.holdSeconds}
        min={0.5}
        max={2.5}
        step={0.1}
        value={settings.holdSeconds}
        onValueChange={(v) => onChange({ holdSeconds: v })}
        unit="s"
        formatValue={(v) => v.toFixed(1)}
      />
      <Slider
        label={t.minScore}
        min={0.5}
        max={0.95}
        step={0.05}
        value={settings.minScore}
        onValueChange={(v) => onChange({ minScore: v })}
        formatValue={(v) => v.toFixed(2)}
      />
      <Switch label={t.repeatWhileHeld} checked={settings.repeatWhileHeld} onChange={(e) => onChange({ repeatWhileHeld: e.target.checked })} />
      <Switch label={t.mirror} checked={settings.mirror} onChange={(e) => onChange({ mirror: e.target.checked })} />
      <Switch label={t.skeleton} checked={settings.skeleton} onChange={(e) => onChange({ skeleton: e.target.checked })} />
      <Switch label={t.bbox} checked={settings.bbox} onChange={(e) => onChange({ bbox: e.target.checked })} />
      <Switch label={t.labels} checked={settings.labels} onChange={(e) => onChange({ labels: e.target.checked })} />
      <Switch label={t.smoothing} checked={settings.smoothing} onChange={(e) => onChange({ smoothing: e.target.checked })} />
      <p className="text-caption text-muted">{t.settingsNote}</p>
    </div>
  );
}
