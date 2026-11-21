import { describe, expect, it } from "vitest";
import type { CommitEvent, RecognitionResult, StabilizedState } from "../../../types/recognition";
import {
  DEFAULT_STABILIZER_CONFIG,
  Stabilizer,
  initialStabilizerMemory,
  normalizeStabilizerConfig,
  stepStabilizer,
} from "../stabilizer";
import { notRecognized, recognized } from "./testUtils";

const FRAME_MS = 33;

/** Feeds frames from `from` (inclusive) to `to` (exclusive) and collects what happened. */
function feed(
  stabilizer: Stabilizer,
  from: number,
  to: number,
  make: (t: number) => RecognitionResult,
): { commits: CommitEvent[]; states: StabilizedState[]; last: StabilizedState } {
  const commits: CommitEvent[] = [];
  const states: StabilizedState[] = [];
  for (let t = from; t < to; t += FRAME_MS) {
    const { state, commit } = stabilizer.update(make(t));
    states.push(state);
    if (commit) commits.push(commit);
  }
  return { commits, states, last: states[states.length - 1] };
}

describe("stabilizer", () => {
  it("stays idle without hands and reports the latest raw result", () => {
    const s = new Stabilizer();
    const { last, commits } = feed(s, 0, 500, (t) => notRecognized("no_hands", t));
    expect(last.phase).toBe("idle");
    expect(last.classId).toBeNull();
    expect(last.holdProgress).toBe(0);
    expect(last.latest?.status).toBe("no_hands");
    expect(commits).toHaveLength(0);
  });

  it("goes candidate → holding → one commit → cooldown", () => {
    const s = new Stabilizer({ holdMs: 1200, cooldownMs: 1000 });
    const first = s.update(recognized("a", 0));
    expect(first.state.phase).toBe("candidate"); // 1 vote < minVotes 4
    expect(first.state.classId).toBe("a");

    const early = feed(s, FRAME_MS, 600, (t) => recognized("a", t));
    expect(early.last.phase).toBe("holding");
    expect(early.last.holdProgress).toBeGreaterThan(0.3);
    expect(early.last.holdProgress).toBeLessThan(0.6);
    expect(early.commits).toHaveLength(0);

    // The hold timer starts at the 4th vote (t = 99) and needs 1200 ms.
    const rest = feed(s, 600 + FRAME_MS - (600 % FRAME_MS), 1500, (t) => recognized("a", t));
    expect(rest.commits).toHaveLength(1);
    expect(rest.commits[0]).toMatchObject({ classId: "a", label: "A", modelId: "test-model", signLanguage: "ISL" });
    expect(rest.commits[0].timestamp).toBeGreaterThanOrEqual(99 + 1200);
    expect(rest.commits[0].timestamp).toBeLessThan(99 + 1200 + FRAME_MS);
    expect(rest.last.phase).toBe("cooldown");
    expect(rest.last.holdProgress).toBe(0);
  });

  it("holdProgress never decreases while one pose is held", () => {
    const s = new Stabilizer();
    const { states } = feed(s, 0, 1250, (t) => recognized("a", t));
    const holding = states.filter((st) => st.phase === "holding").map((st) => st.holdProgress);
    expect(holding.length).toBeGreaterThan(10);
    for (let i = 1; i < holding.length; i++) expect(holding[i]).toBeGreaterThanOrEqual(holding[i - 1]);
  });

  it("commits a held pose exactly once however long it is held", () => {
    const s = new Stabilizer();
    const { commits, last } = feed(s, 0, 10_000, (t) => recognized("a", t));
    expect(commits).toHaveLength(1);
    expect(last.phase).toBe("committed"); // latched: waiting for release
    expect(last.holdProgress).toBe(1);
  });

  it("commits again after the pose is released and shown again", () => {
    const s = new Stabilizer();
    expect(feed(s, 0, 3000, (t) => recognized("a", t)).commits).toHaveLength(1);
    const gap = feed(s, 3000, 3500, (t) => notRecognized("no_hands", t));
    expect(gap.last.phase).toBe("idle");
    expect(feed(s, 3500, 6000, (t) => recognized("a", t)).commits).toHaveLength(1);
  });

  it("with repeatWhileHeld the pose commits again after every cooldown + hold", () => {
    const s = new Stabilizer({ repeatWhileHeld: true, holdMs: 1000, cooldownMs: 1000 });
    // First commit at ~1.1 s, then one every ~2 s: 1.1, 3.1, 5.1, 7.1, 9.1.
    const { commits } = feed(s, 0, 10_000, (t) => recognized("a", t));
    expect(commits).toHaveLength(5);
    for (let i = 1; i < commits.length; i++) {
      expect(commits[i].timestamp - commits[i - 1].timestamp).toBeGreaterThanOrEqual(2000);
    }
  });

  it("a short uncertain blip does not restart the hold", () => {
    const s = new Stabilizer();
    feed(s, 0, 660, (t) => recognized("a", t));
    const blip = feed(s, 660, 660 + 3 * FRAME_MS, (t) => notRecognized("uncertain", t)); // 99 ms < releaseMs
    expect(blip.last.phase).toBe("holding");
    const after = feed(s, 759, 1400, (t) => recognized("a", t));
    expect(after.commits).toHaveLength(1);
    expect(after.commits[0].timestamp).toBeLessThan(99 + 1200 + 2 * FRAME_MS);
  });

  it("a long gap clears the window and the hold starts again", () => {
    const s = new Stabilizer();
    feed(s, 0, 990, (t) => recognized("a", t));
    const gap = feed(s, 990, 1500, (t) => notRecognized("unsupported", t));
    expect(gap.last.phase).toBe("idle");
    const again = feed(s, 1500, 2500, (t) => recognized("a", t));
    expect(again.commits).toHaveLength(0); // needs a full new hold
    expect(again.last.phase).toBe("holding");
  });

  it("treats results below minScore as uncertain", () => {
    const s = new Stabilizer({ minScore: 0.8 });
    const { commits, last } = feed(s, 0, 4000, (t) => recognized("a", t, 0.7));
    expect(commits).toHaveLength(0);
    expect(last.phase).toBe("idle");
    expect(last.latest?.classId).toBe("a"); // the raw result is still passed through
  });

  it("changing the pose restarts the hold for the new class", () => {
    const s = new Stabilizer();
    feed(s, 0, 990, (t) => recognized("a", t));
    const switched = feed(s, 990, 2100, (t) => recognized("b", t));
    // "b" needs a majority of the 8-frame window first, then a full hold.
    expect(switched.commits).toHaveLength(0);
    expect(switched.last.classId).toBe("b");
    const done = feed(s, 2100, 2700, (t) => recognized("b", t));
    expect(done.commits.map((c) => c.classId)).toEqual(["b"]);
  });

  it("a different pose can commit after the cooldown without a release", () => {
    const s = new Stabilizer();
    expect(feed(s, 0, 1500, (t) => recognized("a", t)).commits).toHaveLength(1);
    const { commits } = feed(s, 1500, 5000, (t) => recognized("b", t));
    expect(commits.map((c) => c.classId)).toEqual(["b"]);
  });

  it("nothing commits during the cooldown", () => {
    const s = new Stabilizer({ holdMs: 500, cooldownMs: 2000 });
    const first = feed(s, 0, 700, (t) => recognized("a", t));
    expect(first.commits).toHaveLength(1);
    const commitTime = first.commits[0].timestamp;
    const during = feed(s, 726, commitTime + 1900, (t) => recognized("b", t));
    expect(during.commits).toHaveLength(0);
    expect(during.last.phase).toBe("cooldown");
    expect(during.last.classId).toBe("b");
  });

  it("does not commit instantly when frames resume after a stall", () => {
    const s = new Stabilizer();
    feed(s, 0, 400, (t) => recognized("a", t));
    const resumed = s.update(recognized("a", 60_000));
    expect(resumed.commit).toBeNull();
    expect(resumed.state.phase).toBe("candidate");
  });

  it("clamps the hold time to 0.5–2.5 s and keeps minVotes inside the window", () => {
    expect(normalizeStabilizerConfig({ holdMs: 10 }).holdMs).toBe(500);
    expect(normalizeStabilizerConfig({ holdMs: 99_999 }).holdMs).toBe(2500);
    expect(normalizeStabilizerConfig({ windowSize: 3, minVotes: 9 }).minVotes).toBe(3);
    expect(DEFAULT_STABILIZER_CONFIG).toMatchObject({ windowSize: 8, holdMs: 1200, cooldownMs: 1000 });
  });

  it("reset forgets the vote window", () => {
    const s = new Stabilizer();
    feed(s, 0, 990, (t) => recognized("a", t));
    s.reset();
    expect(s.update(recognized("a", 1000)).state.phase).toBe("candidate");
  });

  it("stepStabilizer is pure: the memory passed in is not changed", () => {
    const config = normalizeStabilizerConfig();
    const memory = initialStabilizerMemory();
    const frozen = JSON.stringify(memory);
    const step = stepStabilizer(memory, recognized("a", 0), config);
    expect(JSON.stringify(memory)).toBe(frozen);
    expect(step.memory.votes).toHaveLength(1);
    // An explicit clock overrides the result's timestamp.
    const later = stepStabilizer(step.memory, recognized("a", 0), config, 50);
    expect(later.memory.lastVoteAt).toBe(50);
  });
});
