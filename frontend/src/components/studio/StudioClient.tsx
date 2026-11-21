"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, FlipHorizontal2, Play, Square } from "lucide-react";
import { Badge, Button, Container, Heading, Notice, Select, Switch, Tabs } from "@/components/ui";
import { useMessages } from "@/i18n";
import { SIMULATOR_POSES, useHandTracking, type SimulatorPose } from "@/features/tracking";
import {
  MODEL_IDS,
  listModels,
  resolveDefaultModel,
  useRecognition,
  type RegistryEntry,
} from "@/features/recognition";
import { useTranscript, vocabulary } from "@/features/language";
import type { CommitEvent, TrackedHand } from "@/types/recognition";
import { STUDIO_SETTINGS_KEY } from "@/lib/localData";
import { studioMessages } from "./messages";
import { TranscriptPanel } from "./TranscriptPanel";
import { TrainPanel } from "./TrainPanel";
import { SettingsPanel, type StudioSettings, DEFAULT_STUDIO_SETTINGS } from "./SettingsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ModelPanel } from "./ModelPanel";

function loadSettings(): StudioSettings {
  try {
    const raw = window.localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (!raw) return DEFAULT_STUDIO_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return { ...DEFAULT_STUDIO_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_STUDIO_SETTINGS;
  }
}

export function StudioClient() {
  const t = useMessages(studioMessages);
  const params = useSearchParams();
  const wantsDemo = params.get("demo") === "simulator";

  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
    setSettingsLoaded(true);
  }, []);
  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const [models, setModels] = useState<RegistryEntry[]>(() => listModels(null));
  const [modelId, setModelId] = useState<string>(MODEL_IDS.legacyAsl);
  useEffect(() => {
    let cancelled = false;
    resolveDefaultModel().then((r) => {
      if (cancelled) return;
      setModels(r.models);
      setModelId(r.modelId);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const labelRef = useRef<string | null>(null);
  const getOverlayLabel = useCallback((slot: 0 | 1, _hand: TrackedHand) => (slot === 0 ? labelRef.current : null), []);

  const tracking = useHandTracking({ getOverlayLabel, simulatorBadge: t.simulatorLabel });
  const { updateSettings: updateTracking } = tracking;
  useEffect(() => {
    if (!settingsLoaded) return;
    updateTracking({
      mirror: settings.mirror,
      showSkeleton: settings.skeleton,
      showBoundingBox: settings.bbox,
      showLabels: settings.labels,
      smoothing: { enabled: settings.smoothing },
    });
  }, [settingsLoaded, settings.mirror, settings.skeleton, settings.bbox, settings.labels, settings.smoothing, updateTracking]);

  const transcript = useTranscript();
  const [lastCommit, setLastCommit] = useState<CommitEvent | null>(null);
  const onCommit = useCallback(
    (event: CommitEvent) => {
      transcript.onCommit(event);
      setLastCommit(event);
    },
    [transcript],
  );

  const subscribe = tracking.state.source ? tracking.onFrame : null;
  const recognition = useRecognition({
    subscribe,
    modelId,
    settings: {
      minScore: settings.minScore,
      holdSeconds: settings.holdSeconds,
      repeatWhileHeld: settings.repeatWhileHeld,
    },
    onCommit,
  });
  useEffect(() => {
    labelRef.current = recognition.state.label;
  }, [recognition.state.label]);

  const { reset: resetRecognition } = recognition;
  useEffect(() => {
    if (tracking.state.status === "idle") resetRecognition();
  }, [tracking.state.status, resetRecognition]);

  // Register user-recorded classes with the vocabulary so the transcript can render them.
  useEffect(() => {
    const info = recognition.modelInfo;
    if (!info || info.kind !== "experimental_isl_user_trained") return;
    for (const c of info.classes) {
      try {
        if (!vocabulary.get(c.classId, info.signLanguage)) {
          vocabulary.registerCustomClass({ classId: c.classId, label: c.label, signLanguage: info.signLanguage });
        }
      } catch {
        /* invalid label: skip */
      }
    }
  }, [recognition.modelInfo]);

  const demoStarted = useRef(false);
  const { startSimulator } = tracking;
  useEffect(() => {
    if (wantsDemo && !demoStarted.current) {
      demoStarted.current = true;
      startSimulator({ pose: "A" });
    }
  }, [wantsDemo, startSimulator]);

  const [simPose, setSimPose] = useState<SimulatorPose>("A");
  const [simTwoHands, setSimTwoHands] = useState(false);
  const [simPaused, setSimPaused] = useState(false);

  const st = tracking.state;
  const trackingError = st.error;
  const isRunning = st.status === "running";
  const isSim = st.source === "simulator";
  const hasSource = st.source !== null && st.status !== "idle";

  const score = recognition.state.latest?.score;
  const phase = recognition.state.phase;
  const holdPct = Math.round(recognition.state.holdProgress * 100);

  const tabs = useMemo(
    () => [
      {
        id: "transcript",
        label: t.tabs.transcript,
        content: <TranscriptPanel transcript={transcript} />,
      },
      {
        id: "model",
        label: t.tabs.model,
        content: (
          <ModelPanel
            models={models}
            modelId={modelId}
            onChange={setModelId}
            status={recognition.modelStatus}
            message={recognition.modelMessage}
            info={recognition.modelInfo}
            candidates={recognition.state.latest?.candidates ?? []}
          />
        ),
      },
      {
        id: "train",
        label: t.tabs.train,
        content: (
          <TrainPanel
            recognition={recognition}
            hasSource={hasSource}
            modelId={modelId}
            onUseUserModel={() => setModelId(MODEL_IDS.islUser)}
          />
        ),
      },
      {
        id: "settings",
        label: t.tabs.settings,
        content: <SettingsPanel settings={settings} onChange={updateSettings} />,
      },
      {
        id: "history",
        label: t.tabs.history,
        content: <HistoryPanel transcript={transcript} />,
      },
    ],
    [t, transcript, models, modelId, recognition, hasSource, settings, updateSettings],
  );

  return (
    <Container size="wide" className="flex flex-col gap-6 py-8 lg:py-10">
      <div className="flex flex-col gap-3">
        <Heading size="h1">{t.title}</Heading>
        <p className="text-body text-muted">{t.lead}</p>
        <Notice tone="warning" compact>
          {t.capability}{" "}
          <Link href="/research" className="font-semibold underline underline-offset-4">
            {t.rnd}
          </Link>
          .
        </Notice>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Stage */}
        <section aria-label={t.title} className="flex flex-col gap-4 lg:col-span-8">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-panel bg-ink sm:aspect-video">
            <video ref={tracking.videoRef} className="absolute inset-0 h-full w-full" playsInline muted />
            <canvas ref={tracking.canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            {!hasSource && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-on-ink">
                <Camera aria-hidden="true" className="size-8 opacity-80" />
                <p className="text-h3 font-bold">{t.idleTitle}</p>
                <p className="max-w-[40ch] text-small opacity-80">{t.idleBody}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant="primary"
                    className="border-on-ink bg-on-ink text-ink hover:shadow-none"
                    onClick={() => void tracking.startCamera()}
                  >
                    {t.startCamera}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-on-ink text-on-ink hover:bg-on-ink hover:text-ink"
                    onClick={() => startSimulator({ pose: simPose, twoHands: simTwoHands })}
                  >
                    {t.openSimulator}
                  </Button>
                </div>
              </div>
            )}
            {isSim && (
              <p className="absolute left-3 top-3 rounded-control bg-warning-soft px-3 py-1 text-caption font-semibold text-warning-ink">
                {t.simulatorLabel}
              </p>
            )}
            {isRunning && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
                <div className="rounded-card bg-surface/95 px-4 py-3 shadow-soft">
                  <p className="text-caption font-semibold text-muted">
                    {recognition.state.label ? t.phase[phase] : st.handCount === 0 ? t.noHands : t.phase.idle}
                  </p>
                  <p className="font-mono text-h2 leading-none text-ink" aria-live="off">
                    {recognition.state.label ?? "—"}
                  </p>
                  {typeof score === "number" && (
                    <p className="text-caption text-muted">
                      {t.matchScore}: {score.toFixed(2)}
                    </p>
                  )}
                  <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-control bg-line" aria-hidden="true">
                    <div className="h-full bg-success transition-[width] duration-100" style={{ width: `${holdPct}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!hasSource ? (
              <>
                <Button variant="primary" leadingIcon={<Camera />} onClick={() => void tracking.startCamera()}>
                  {t.startCamera}
                </Button>
                <Button variant="secondary" leadingIcon={<Play />} onClick={() => startSimulator({ pose: simPose, twoHands: simTwoHands })}>
                  {t.openSimulator}
                </Button>
              </>
            ) : (
              <Button variant="primary" leadingIcon={<Square />} onClick={tracking.stop}>
                {t.stop}
              </Button>
            )}
            {st.canFlip && (
              <Button variant="secondary" leadingIcon={<FlipHorizontal2 />} onClick={() => void tracking.flip()}>
                {t.flip}
              </Button>
            )}
            {st.status === "paused_hidden" && (
              <Button variant="secondary" onClick={() => void tracking.resume()}>
                {t.resume}
              </Button>
            )}
            <p className="ml-auto text-small text-muted" role="status">
              {t.status[st.status]} · {st.handCount} {t.hands} · {st.fps} {t.fps}
            </p>
          </div>

          <p className="sr-only" aria-live="polite">
            {lastCommit ? `${t.added}: ${lastCommit.label}` : ""}
          </p>

          {st.status === "paused_hidden" && <Notice tone="info">{t.pausedHidden}</Notice>}
          {trackingError && (
            <Notice
              tone="danger"
              live="assertive"
              title={t.status.error}
              actions={
                <Button variant="secondary" size="sm" onClick={() => void tracking.startCamera()}>
                  {t.retry}
                </Button>
              }
            >
              {t.errors[trackingError.code]}
            </Notice>
          )}

          {isSim && (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-end gap-4">
                <Select
                  label={t.simulatorPose}
                  value={simPose}
                  onChange={(e) => {
                    const pose = e.target.value as SimulatorPose;
                    setSimPose(pose);
                    tracking.setSimulatorOptions({ pose, paused: false });
                    setSimPaused(false);
                  }}
                  options={SIMULATOR_POSES.map((p) => ({ value: p, label: p }))}
                />
                <Switch
                  label={t.twoHands}
                  checked={simTwoHands}
                  onChange={(e) => {
                    setSimTwoHands(e.target.checked);
                    tracking.setSimulatorOptions({ twoHands: e.target.checked });
                  }}
                />
                <Switch
                  label={t.pauseSim}
                  checked={simPaused}
                  onChange={(e) => {
                    setSimPaused(e.target.checked);
                    tracking.setSimulatorOptions({ paused: e.target.checked });
                  }}
                />
              </div>
              {modelId !== MODEL_IDS.legacyAsl && (
                <Notice
                  tone="info"
                  compact
                  actions={
                    <Button variant="secondary" size="sm" onClick={() => setModelId(MODEL_IDS.legacyAsl)}>
                      {t.switchToAsl}
                    </Button>
                  }
                >
                  {t.simAslHint}
                </Notice>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
            <Badge tone={recognition.modelInfo?.validated ? "success" : "warning"}>
              {recognition.modelInfo?.validated ? t.validated : t.notValidated}
            </Badge>
            <span>{recognition.modelInfo?.name ?? t.modelStatus[recognition.modelStatus]}</span>
            <span>· {t.scoreNote}</span>
          </div>
        </section>

        {/* Panel */}
        <aside className="lg:col-span-4">
          <Tabs items={tabs} label={t.title} defaultValue="transcript" variant="pill" />
        </aside>
      </div>
    </Container>
  );
}
