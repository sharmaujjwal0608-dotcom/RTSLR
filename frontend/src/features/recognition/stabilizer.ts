/**
 * Temporal stabiliser (docs/MODEL_CONTRACTS.md §8).
 *
 *   raw per-frame results
 *     → majority vote over the last N recognised frames
 *     → hold timer (the same majority must persist for holdMs)
 *     → exactly one CommitEvent
 *     → cooldown
 *
 * After a commit the same class is "latched": it cannot commit again while the
 * pose is still held. It is released when the pose goes away (no recognised
 * frame of that class for releaseMs, or a different class wins the vote).
 * With `repeatWhileHeld: true` the legacy behaviour applies instead: holding
 * the pose commits again after every cooldown + hold.
 *
 * The stabiliser is pure with respect to time: every step takes the current
 * time as an argument (by default the result's own timestamp), so tests can
 * drive it without timers.
 */

import type {
  CommitEvent,
  RecognitionResult,
  SignLanguage,
  StabilizedState,
  StabilizerPhase,
} from "../../types/recognition";
import { clamp } from "./vectorMath";

export type StabilizerConfig = {
  /** Recognised frames kept for the vote. Contract default 8. */
  windowSize: number;
  /** Votes the majority class needs before the hold timer may run. Default 4. */
  minVotes: number;
  /** Hold-to-append time in milliseconds. Default 1200; clamped to 500–2500. */
  holdMs: number;
  /** Pause after a commit during which nothing can commit. Default 1000. */
  cooldownMs: number;
  /** Results scoring below this are treated as "uncertain". Default 0.75 (the prototype's default). */
  minScore: number;
  /**
   * How long recognised frames may be missing (uncertain, unsupported, no
   * hands, low score) before the vote window and the hold timer are cleared.
   * Short gaps are normal: a single noisy frame should not restart a hold. Default 300.
   */
  releaseMs: number;
  /** false (default): a held pose commits once. true: it commits again after each cooldown. */
  repeatWhileHeld: boolean;
};

export const HOLD_MS_MIN = 500;
export const HOLD_MS_MAX = 2500;

export const DEFAULT_STABILIZER_CONFIG: StabilizerConfig = {
  windowSize: 8,
  minVotes: 4,
  holdMs: 1200,
  cooldownMs: 1000,
  minScore: 0.75,
  releaseMs: 300,
  repeatWhileHeld: false,
};

export function normalizeStabilizerConfig(partial: Partial<StabilizerConfig> = {}): StabilizerConfig {
  const merged = { ...DEFAULT_STABILIZER_CONFIG, ...partial };
  const windowSize = Math.max(1, Math.floor(merged.windowSize));
  return {
    windowSize,
    minVotes: clamp(Math.floor(merged.minVotes), 1, windowSize),
    holdMs: clamp(merged.holdMs, HOLD_MS_MIN, HOLD_MS_MAX),
    cooldownMs: Math.max(0, merged.cooldownMs),
    minScore: clamp(merged.minScore, 0, 1),
    releaseMs: Math.max(0, merged.releaseMs),
    repeatWhileHeld: merged.repeatWhileHeld,
  };
}

type Vote = { classId: string; label: string };

/** Everything the stabiliser remembers between frames. Treat as opaque. */
export type StabilizerMemory = {
  votes: Vote[];
  /** Time of the last frame that added a vote, or null. */
  lastVoteAt: number | null;
  holdClassId: string | null;
  holdStartedAt: number;
  cooldownUntil: number;
  /** Class committed and still held; cannot commit again until released. */
  latchedClassId: string | null;
};

export function initialStabilizerMemory(): StabilizerMemory {
  return {
    votes: [],
    lastVoteAt: null,
    holdClassId: null,
    holdStartedAt: 0,
    cooldownUntil: -Infinity,
    latchedClassId: null,
  };
}

export const IDLE_STATE: StabilizedState = {
  phase: "idle",
  classId: null,
  label: null,
  holdProgress: 0,
  latest: null,
};

export type StabilizerStep = {
  memory: StabilizerMemory;
  state: StabilizedState;
  commit: CommitEvent | null;
};

/** Most frequent class in the window; the most recent one wins a tie. */
function majorityOf(votes: Vote[]): { vote: Vote; count: number } | null {
  if (votes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.classId, (counts.get(v.classId) ?? 0) + 1);
  let best: Vote | null = null;
  let bestCount = 0;
  for (let i = votes.length - 1; i >= 0; i--) {
    const count = counts.get(votes[i].classId) ?? 0;
    if (count > bestCount) {
      best = votes[i];
      bestCount = count;
    }
  }
  return best ? { vote: best, count: bestCount } : null;
}

function isUsableRecognition(
  result: RecognitionResult,
  minScore: number,
): result is RecognitionResult & { classId: string; label: string } {
  return (
    result.status === "recognized" &&
    result.classId !== null &&
    result.label !== null &&
    result.score !== null &&
    result.score >= minScore
  );
}

/**
 * One step of the state machine. Does not mutate `memory`.
 * @param now time of this frame in milliseconds (same clock as result.timestamp).
 */
export function stepStabilizer(
  memory: StabilizerMemory,
  result: RecognitionResult,
  config: StabilizerConfig,
  now: number = result.timestamp,
): StabilizerStep {
  const next: StabilizerMemory = { ...memory, votes: memory.votes };
  const state = (phase: StabilizerPhase, vote: Vote | null, holdProgress: number): StabilizedState => ({
    phase,
    classId: vote?.classId ?? null,
    label: vote?.label ?? null,
    holdProgress,
    latest: result,
  });

  /* 1. Update the vote window. */
  if (isUsableRecognition(result, config.minScore)) {
    // A long silence before this frame (hidden tab, stalled camera) means the
    // earlier votes describe a different moment: start again from this frame.
    const stale = memory.lastVoteAt !== null && now - memory.lastVoteAt > config.releaseMs;
    if (stale) {
      next.holdClassId = null;
      next.latchedClassId = null;
    }
    const earlier = stale ? [] : memory.votes;
    next.votes = [...earlier, { classId: result.classId, label: result.label }].slice(-config.windowSize);
    next.lastVoteAt = now;
  } else if (memory.lastVoteAt === null || now - memory.lastVoteAt > config.releaseMs) {
    // The pose has gone (or was never there): forget everything about it.
    next.votes = [];
    next.lastVoteAt = null;
    next.holdClassId = null;
    next.latchedClassId = null;
  }

  const inCooldown = now < next.cooldownUntil;
  const majority = majorityOf(next.votes);

  if (!majority) {
    return { memory: next, state: state(inCooldown ? "cooldown" : "idle", null, 0), commit: null };
  }

  /* 2. A different class winning the vote releases the latch. */
  if (next.latchedClassId !== null && majority.vote.classId !== next.latchedClassId) {
    next.latchedClassId = null;
  }

  /* 3. Cooldown: show what is seen, but run no timer. */
  if (inCooldown) {
    next.holdClassId = null;
    return { memory: next, state: state("cooldown", majority.vote, 0), commit: null };
  }

  /* 4. Same pose still held after its commit: nothing more to do until release. */
  if (next.latchedClassId === majority.vote.classId) {
    next.holdClassId = null;
    return { memory: next, state: state("committed", majority.vote, 1), commit: null };
  }

  /* 5. Not enough agreement yet. */
  if (majority.count < config.minVotes) {
    next.holdClassId = null;
    return { memory: next, state: state("candidate", majority.vote, 0), commit: null };
  }

  /* 6. Hold timer. */
  if (next.holdClassId !== majority.vote.classId) {
    next.holdClassId = majority.vote.classId;
    next.holdStartedAt = now;
  }
  const progress = clamp((now - next.holdStartedAt) / config.holdMs, 0, 1);
  if (progress < 1) {
    return { memory: next, state: state("holding", majority.vote, progress), commit: null };
  }

  /* 7. Commit exactly once. */
  const commit: CommitEvent = {
    classId: majority.vote.classId,
    label: majority.vote.label,
    modelId: result.modelId,
    signLanguage: result.signLanguage as SignLanguage,
    timestamp: now,
  };
  next.holdClassId = null;
  next.cooldownUntil = now + config.cooldownMs;
  next.latchedClassId = config.repeatWhileHeld ? null : majority.vote.classId;
  return { memory: next, state: state("committed", majority.vote, 1), commit };
}

/** Stateful convenience wrapper around `stepStabilizer`. */
export class Stabilizer {
  private memory = initialStabilizerMemory();
  private config: StabilizerConfig;

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = normalizeStabilizerConfig(config);
  }

  getConfig(): StabilizerConfig {
    return this.config;
  }

  /** Changes settings without losing the current vote window. */
  setConfig(partial: Partial<StabilizerConfig>): void {
    this.config = normalizeStabilizerConfig({ ...this.config, ...partial });
  }

  /** Feed one raw result; returns the new state and a CommitEvent at most once per sign. */
  update(result: RecognitionResult, now: number = result.timestamp): { state: StabilizedState; commit: CommitEvent | null } {
    const step = stepStabilizer(this.memory, result, this.config, now);
    this.memory = step.memory;
    return { state: step.state, commit: step.commit };
  }

  /** Forget everything (camera stopped, model changed). */
  reset(): void {
    this.memory = initialStabilizerMemory();
  }
}
