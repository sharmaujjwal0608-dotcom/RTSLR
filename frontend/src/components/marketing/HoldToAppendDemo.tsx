"use client";

import { Hand, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button, Card, Kbd, Notice } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";

/* The Studio stabiliser's defaults (docs/MODEL_CONTRACTS.md §8). */
const WINDOW_SIZE = 8;
const MIN_VOTES = 4;
const HOLD_MS = 1200;
const COOLDOWN_MS = 1000;
const RELEASE_MS = 300;
/* Demo only: how often a "frame" arrives while the button is held. This is
   not a measured camera frame rate. */
const DEMO_FRAME_MS = 70;
const MAX_COMMITS = 12;

type Phase = "idle" | "voting" | "holding" | "cooldown" | "latched";

type View = { phase: Phase; votes: number; hold: number; cooldown: number; commits: number };

const INITIAL_VIEW: View = { phase: "idle", votes: 0, hold: 0, cooldown: 0, commits: 0 };

const messages = defineMessages({
  en: {
    pad: "Press and hold",
    padHint: "Hold the button, or focus it and hold",
    reset: "Clear",
    votes: "Vote",
    votesValue: (n: number) => `${n} of ${WINDOW_SIZE} frames agree, ${MIN_VOTES} needed`,
    hold: "Hold",
    holdValue: "1.2 s",
    cooldown: "Cooldown",
    cooldownValue: "1 s",
    output: "Committed",
    outputEmpty: "Nothing committed yet. Keep the button down until the hold bar fills.",
    token: (n: number) => `commit ${n}`,
    disclaimer:
      "Your press stands in for a steady hand pose. No camera and no recognition are involved; only the timing is real.",
    phase: {
      idle: "Waiting for input",
      voting: "Voting: do recent frames agree?",
      holding: "Holding: keep it steady",
      cooldown: "Committed once. Cooldown: nothing can commit",
      latched: "Still held: release before it can commit again",
    } satisfies Record<Phase, string>,
  },
  hi: {
    pad: "दबाकर रखें",
    padHint: "बटन दबाए रखें, या उस पर फ़ोकस करके दबाए रखें",
    reset: "साफ़ करें",
    votes: "मतदान",
    votesValue: (n: number) => `${WINDOW_SIZE} में से ${n} फ़्रेम सहमत, ${MIN_VOTES} ज़रूरी`,
    hold: "होल्ड",
    holdValue: "1.2 से.",
    cooldown: "विराम",
    cooldownValue: "1 से.",
    output: "दर्ज हुआ",
    outputEmpty: "अभी कुछ दर्ज नहीं हुआ। होल्ड पट्टी भरने तक बटन दबाए रखें।",
    token: (n: number) => `दर्ज ${n}`,
    disclaimer:
      "आपका दबाना एक स्थिर हस्त-मुद्रा की जगह ले रहा है। इसमें न कैमरा है, न कोई पहचान; केवल समय वास्तविक है।",
    phase: {
      idle: "इनपुट की प्रतीक्षा",
      voting: "मतदान: क्या हाल के फ़्रेम सहमत हैं?",
      holding: "होल्ड: स्थिर रखें",
      cooldown: "एक बार दर्ज हुआ। विराम: अभी कुछ दर्ज नहीं होगा",
      latched: "अब भी दबा है: दोबारा दर्ज होने से पहले छोड़ें",
    } satisfies Record<Phase, string>,
  },
});

const phaseTone: Record<Phase, Tone> = {
  idle: "neutral",
  voting: "info",
  holding: "warning",
  cooldown: "success",
  latched: "neutral",
};

function Meter({ label, value, fraction, active }: { label: string; value: string; fraction: number; active: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-small font-semibold", active ? "text-ink" : "text-muted")}>{label}</span>
        <span className="font-mono text-label text-muted">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-control border border-line-strong bg-surface" aria-hidden="true">
        <div className="h-full origin-left bg-ink" style={{ transform: `scaleX(${fraction})` }} />
      </div>
    </div>
  );
}

/**
 * Hold-to-append timing demo. Pressing and holding the button plays the
 * Studio stabiliser's sequence with its real default timings:
 * vote → 1.2 s hold → one commit → 1 s cooldown, and no second commit until
 * the press is released. It involves no camera and no recognition.
 */
export function HoldToAppendDemo({ className }: { className?: string }) {
  const t = useMessages(messages);
  const [view, setView] = useState<View>(INITIAL_VIEW);

  const machine = useRef({
    down: false,
    downSince: 0,
    upAt: 0,
    holdStart: null as number | null,
    cooldownUntil: 0,
    latched: false,
    commits: 0,
    frame: 0,
  });

  const tick = useCallback(function step(now: number) {
    const m = machine.current;
    let phase: Phase = "idle";
    let votes = 0;
    let hold = 0;
    let cooldown = 0;

    /* A short gap does not reset a hold, the same as in the Studio. */
    const present = m.down || now - m.upAt < RELEASE_MS;
    if (!present) {
      m.holdStart = null;
      m.latched = false;
    }

    if (now < m.cooldownUntil) {
      phase = "cooldown";
      votes = WINDOW_SIZE;
      hold = 1;
      cooldown = 1 - (m.cooldownUntil - now) / COOLDOWN_MS;
    } else if (present && m.latched) {
      phase = "latched";
      votes = WINDOW_SIZE;
    } else if (present) {
      votes = Math.min(WINDOW_SIZE, Math.floor((now - m.downSince) / DEMO_FRAME_MS) + 1);
      if (votes < MIN_VOTES) {
        phase = "voting";
      } else {
        m.holdStart ??= now;
        hold = Math.min(1, (now - m.holdStart) / HOLD_MS);
        if (hold >= 1) {
          m.commits = Math.min(MAX_COMMITS, m.commits + 1);
          m.cooldownUntil = now + COOLDOWN_MS;
          m.latched = true;
          m.holdStart = null;
          phase = "cooldown";
        } else {
          phase = "holding";
        }
      }
    }

    setView((previous) => {
      const next: View = {
        phase,
        votes,
        hold: Math.round(hold * 100) / 100,
        cooldown: Math.round(cooldown * 100) / 100,
        commits: m.commits,
      };
      return previous.phase === next.phase &&
        previous.votes === next.votes &&
        previous.hold === next.hold &&
        previous.cooldown === next.cooldown &&
        previous.commits === next.commits
        ? previous
        : next;
    });

    m.frame = present || now < m.cooldownUntil ? requestAnimationFrame(step) : 0;
  }, []);

  const press = useCallback(() => {
    const m = machine.current;
    if (m.down) return;
    const now = performance.now();
    /* A press after a real release starts a fresh vote. */
    if (now - m.upAt >= RELEASE_MS) m.downSince = now;
    m.down = true;
    if (!m.frame) m.frame = requestAnimationFrame(tick);
  }, [tick]);

  const release = useCallback(() => {
    const m = machine.current;
    if (!m.down) return;
    m.down = false;
    m.upAt = performance.now();
  }, []);

  useEffect(() => {
    const m = machine.current;
    return () => {
      if (m.frame) cancelAnimationFrame(m.frame);
      m.frame = 0;
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) press();
  }

  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    release();
  }

  function reset() {
    const m = machine.current;
    m.commits = 0;
    setView((previous) => ({ ...previous, commits: 0 }));
  }

  const { phase } = view;

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col gap-6 p-6 md:p-8">
          <div className="min-h-16">
            <Notice tone={phaseTone[phase]} live="polite" compact>
              <span className="font-semibold">{t.phase[phase]}</span>
            </Notice>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn("text-small font-semibold", phase === "voting" ? "text-ink" : "text-muted")}>
                  {t.votes}
                </span>
                <span className="font-mono text-label text-muted">{t.votesValue(view.votes)}</span>
              </div>
              <div className="grid grid-cols-8 gap-1.5" aria-hidden="true">
                {Array.from({ length: WINDOW_SIZE }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2.5 rounded-control border border-line-strong",
                      index < view.votes ? "bg-ink" : "bg-surface",
                    )}
                  />
                ))}
              </div>
            </div>
            <Meter label={t.hold} value={t.holdValue} fraction={view.hold} active={phase === "holding"} />
            <Meter label={t.cooldown} value={t.cooldownValue} fraction={view.cooldown} active={phase === "cooldown"} />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              leadingIcon={<Hand />}
              className="touch-none"
              onPointerDown={(event) => {
                if (event.button === 0) press();
              }}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              onBlur={release}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
            >
              {t.pad}
            </Button>
            <p className="text-caption text-muted">
              {t.padHint} <Kbd>Space</Kbd>
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 border-t border-line bg-background-secondary p-6 md:p-8 lg:border-t-0 lg:border-l">
          <div className="flex flex-col gap-3">
            <div className="flex min-h-9 items-center justify-between gap-4">
              <p className="text-small font-semibold text-ink">{t.output}</p>
              {view.commits > 0 ? (
                <Button variant="ghost" size="md" leadingIcon={<RotateCcw />} onClick={reset}>
                  {t.reset}
                </Button>
              ) : null}
            </div>
            <div className="min-h-28">
              {view.commits === 0 ? (
                <p className="text-small text-muted">{t.outputEmpty}</p>
              ) : (
                <ol className="flex flex-wrap gap-2">
                  {Array.from({ length: view.commits }, (_, index) => (
                    <li
                      key={index}
                      className="rounded-control border border-line-strong bg-surface px-3 py-1 font-mono text-label text-ink"
                    >
                      {t.token(index + 1)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <p className="text-caption text-muted">{t.disclaimer}</p>
        </div>
      </div>
    </Card>
  );
}
