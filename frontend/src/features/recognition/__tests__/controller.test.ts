import { describe, expect, it, vi } from "vitest";
import type { CommitEvent, FrameFeatures, ModelInfo, RecognitionResult, SignModel } from "../../../types/recognition";
import { RecognitionController, type RecognitionSnapshot } from "../controller";
import { ModelLoadError } from "../models/exportedModel";
import { ISL_USER_MODEL_ID } from "../models/islUserTemplates";
import { NO_VALIDATED_ISL_MODEL } from "../models/validatedIsl";
import { MODEL_IDS } from "../registry";
import { MemorySampleBackend, SampleStore } from "../sampleStore";
import { jitter, makeFeatures, randomVector, recognized } from "./testUtils";

const FRAME_MS = 33;

/** A model that always answers with the class named in `current`. */
function scriptedModel(id: string, current: { classId: string | null }): SignModel {
  const info: ModelInfo = {
    id,
    version: "0",
    name: id,
    signLanguage: "ISL",
    kind: "simulator",
    input: "single_hand_static",
    scoreType: "classifier_score",
    validated: false,
    classes: [],
    description: "",
    limitations: [],
  };
  return {
    info,
    load: async () => undefined,
    reset: vi.fn(),
    dispose: vi.fn(),
    predict: (features: FrameFeatures): RecognitionResult =>
      current.classId
        ? { ...recognized(current.classId, features.timestamp), modelId: id }
        : { ...recognized("x", features.timestamp), status: "no_hands", classId: null, label: null, score: null, modelId: id },
  };
}

function newStore(): SampleStore {
  return new SampleStore(new MemorySampleBackend());
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe("RecognitionController: recognition", () => {
  it("loads a model, stabilises frames and emits exactly one commit", async () => {
    const current = { classId: "a" as string | null };
    const controller = new RecognitionController({ store: newStore(), createModel: (id) => scriptedModel(id, current) });
    const commits: CommitEvent[] = [];
    controller.onCommit = (event) => commits.push(event);
    const snapshots: RecognitionSnapshot[] = [];
    controller.subscribe(() => snapshots.push(controller.getSnapshot()));

    expect(controller.getSnapshot().modelStatus).toBe("loading");
    await controller.setModel("m1");
    expect(controller.getSnapshot()).toMatchObject({ modelStatus: "ready", activeModelId: "m1", requestedModelId: "m1" });
    expect(controller.getSnapshot().modelInfo?.id).toBe("m1");

    snapshots.length = 0;
    for (let t = 0; t < 5000; t += FRAME_MS) controller.handleFrame(makeFeatures(1, { timestamp: t }));

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ classId: "a", modelId: "m1", signLanguage: "ISL" });
    expect(controller.getSnapshot().state.phase).toBe("committed");

    // 152 frames in 5 s must not become 152 React updates: about 10 per second.
    expect(snapshots.length).toBeGreaterThan(40);
    expect(snapshots.length).toBeLessThan(62);
  });

  it("applies settings to the stabiliser", async () => {
    const current = { classId: "a" as string | null };
    const controller = new RecognitionController({ store: newStore(), createModel: (id) => scriptedModel(id, current) });
    const commits: CommitEvent[] = [];
    controller.onCommit = (event) => commits.push(event);
    await controller.setModel("m1");

    controller.setSettings({ holdSeconds: 0.5, cooldownSeconds: 0.5, repeatWhileHeld: true });
    for (let t = 0; t < 3000; t += FRAME_MS) controller.handleFrame(makeFeatures(1, { timestamp: t }));
    expect(commits.length).toBeGreaterThanOrEqual(2);

    commits.length = 0;
    controller.reset();
    controller.setSettings({ minScore: 0.95 }); // scripted score is 0.9
    for (let t = 10_000; t < 13_000; t += FRAME_MS) controller.handleFrame(makeFeatures(1, { timestamp: t }));
    expect(commits).toHaveLength(0);
  });

  it("reports the missing validated ISL model as unavailable and keeps the previous model running", async () => {
    const store = newStore();
    const controller = new RecognitionController({ store });
    await controller.setModel(MODEL_IDS.legacyAsl);
    expect(controller.getSnapshot().modelInfo?.kind).toBe("legacy_asl_prototype");

    // No fetch stub: in the test runtime there is no page origin, so no file can be found.
    await controller.setModel(MODEL_IDS.validatedIsl);
    const snapshot = controller.getSnapshot();
    expect(snapshot.requestedModelId).toBe(MODEL_IDS.validatedIsl);
    expect(["unavailable", "error"]).toContain(snapshot.modelStatus);
    expect(snapshot.modelMessage).toContain("No validated ISL model is available");
    expect(snapshot.activeModelId).toBe(MODEL_IDS.legacyAsl);
    expect(snapshot.modelInfo?.kind).toBe("legacy_asl_prototype");
  });

  it("maps not_found to 'unavailable' and other load failures to 'error'", async () => {
    const failing = (code: "not_found" | "invalid"): SignModel => ({
      ...scriptedModel("f", { classId: null }),
      load: async () => {
        throw new ModelLoadError(code === "not_found" ? NO_VALIDATED_ISL_MODEL : "bad file", code);
      },
    });
    const controller = new RecognitionController({
      store: newStore(),
      createModel: (id) => failing(id === "missing" ? "not_found" : "invalid"),
    });
    await controller.setModel("missing");
    expect(controller.getSnapshot()).toMatchObject({ modelStatus: "unavailable", modelMessage: NO_VALIDATED_ISL_MODEL, activeModelId: null });
    await controller.setModel("broken");
    expect(controller.getSnapshot()).toMatchObject({ modelStatus: "error", modelMessage: "bad file" });
    // Frames without an active model are ignored, not crashed on.
    expect(() => controller.handleFrame(makeFeatures(1))).not.toThrow();
  });

  it("the latest setModel call wins when loads overlap", async () => {
    let releaseSlow: () => void = () => undefined;
    const slow: SignModel = {
      ...scriptedModel("slow", { classId: "a" }),
      load: () => new Promise<void>((resolve) => (releaseSlow = resolve)),
    };
    const controller = new RecognitionController({
      store: newStore(),
      createModel: (id) => (id === "slow" ? slow : scriptedModel(id, { classId: "a" })),
    });
    const first = controller.setModel("slow");
    await controller.setModel("fast");
    releaseSlow();
    await first;
    expect(controller.getSnapshot().activeModelId).toBe("fast");
    expect(slow.dispose).toHaveBeenCalled();
  });
});

describe("RecognitionController: sample recording", () => {
  const POSE = randomVector(63, 5);
  const DUAL_POSE = randomVector(156, 6);

  async function setup() {
    const store = newStore();
    const controller = new RecognitionController({ store, captureIntervalMs: 80 });
    await controller.setModel(ISL_USER_MODEL_ID);
    controller.subscribe(() => undefined); // like a mounted component
    return { store, controller };
  }

  it("captures only steady frames, spaced out, and saves when the count is reached", async () => {
    const { store, controller } = await setup();
    controller.startRecording("hello", "Hello", 5);
    await flush();
    expect(controller.getSnapshot().recording).toMatchObject({ status: "waiting", target: 5, captured: 0 });

    let t = 0;
    const frame = (still: boolean) =>
      controller.handleFrame(makeFeatures(1, { timestamp: (t += FRAME_MS), still, vectors: [jitter(POSE, 0.01, t)] }));

    for (let i = 0; i < 10; i++) frame(false);
    expect(controller.getSnapshot().recording).toMatchObject({ status: "waiting", hint: "hold_still", captured: 0 });

    controller.handleFrame(makeFeatures(0, { timestamp: (t += FRAME_MS) }));
    expect(controller.getSnapshot().recording.hint).toBe("no_hands");

    frame(true);
    expect(controller.getSnapshot().recording).toMatchObject({ status: "capturing", captured: 1, hands: 1, progress: 0.2 });
    frame(true); // 33 ms later: too soon for another sample
    expect(controller.getSnapshot().recording.captured).toBe(1);

    for (let i = 0; i < 40 && controller.getSnapshot().recording.status === "capturing"; i++) frame(true);
    await flush();
    expect(controller.getSnapshot().recording).toMatchObject({ status: "done", captured: 5, progress: 1 });

    const saved = await store.list("hello");
    expect(saved).toHaveLength(5);
    expect(saved.every((s) => s.hands === 1 && s.vector.length === 63 && s.label === "Hello")).toBe(true);

    // The experimental model now knows the class, and the controller published its new info.
    expect(controller.getSnapshot().modelInfo?.classes).toEqual([
      { classId: "hello", label: "Hello", hands: 1, motion: "static" },
    ]);
    controller.clearRecordingStatus();
    expect(controller.getSnapshot().recording.status).toBe("idle");
  });

  it("records a two-hand sign from the 156-D coordinated vector", async () => {
    const { store, controller } = await setup();
    controller.startRecording("both", "Both", 3);
    for (let t = 100; t <= 600; t += 100) {
      controller.handleFrame(makeFeatures(2, { timestamp: t, dual: jitter(DUAL_POSE, 0.01, t) }));
    }
    await flush();
    const saved = await store.list("both");
    expect(saved).toHaveLength(3);
    expect(saved.every((s) => s.hands === 2 && s.vector.length === 156)).toBe(true);
    expect(controller.getSnapshot().recording).toMatchObject({ status: "done", hands: 2 });
  });

  it("locks the hand count at the first capture and waits when it changes", async () => {
    const { store, controller } = await setup();
    controller.startRecording("both", "Both", 3);
    controller.handleFrame(makeFeatures(2, { timestamp: 100, dual: DUAL_POSE }));
    controller.handleFrame(makeFeatures(1, { timestamp: 200, vectors: [POSE] }));
    expect(controller.getSnapshot().recording).toMatchObject({ status: "waiting", hint: "show_two_hands", captured: 1 });
    controller.handleFrame(makeFeatures(2, { timestamp: 300, dual: DUAL_POSE }));
    controller.handleFrame(makeFeatures(2, { timestamp: 400, dual: DUAL_POSE }));
    await flush();
    expect(await store.count("both")).toBe(3);
  });

  it("an existing class keeps its hand count: one-hand frames are not added to a two-hand sign", async () => {
    const { store, controller } = await setup();
    await store.addSample({ classId: "both", label: "Both", hands: 2, vector: DUAL_POSE });
    controller.startRecording("both", "Both", 2);
    await flush();
    expect(controller.getSnapshot().recording.hands).toBe(2);
    for (let t = 100; t <= 500; t += 100) controller.handleFrame(makeFeatures(1, { timestamp: t, vectors: [POSE] }));
    expect(controller.getSnapshot().recording).toMatchObject({ status: "waiting", hint: "show_two_hands", captured: 0 });
    expect(await store.count("both")).toBe(1);
  });

  it("cancel discards what was captured", async () => {
    const { store, controller } = await setup();
    controller.startRecording("hello", "Hello", 5);
    controller.handleFrame(makeFeatures(1, { timestamp: 100, vectors: [POSE] }));
    controller.handleFrame(makeFeatures(1, { timestamp: 200, vectors: [POSE] }));
    controller.cancelRecording();
    expect(controller.getSnapshot().recording.status).toBe("cancelled");
    for (let t = 300; t <= 900; t += 100) controller.handleFrame(makeFeatures(1, { timestamp: t, vectors: [POSE] }));
    await flush();
    expect(await store.count()).toBe(0);
  });

  it("skips malformed vectors", async () => {
    const { store, controller } = await setup();
    controller.startRecording("hello", "Hello", 1);
    const bad = Float32Array.from(POSE);
    bad[0] = Number.NaN;
    controller.handleFrame(makeFeatures(1, { timestamp: 100, vectors: [bad] }));
    controller.handleFrame(makeFeatures(2, { timestamp: 200, dual: null }));
    expect(controller.getSnapshot().recording.captured).toBe(0);
    await flush();
    expect(await store.count()).toBe(0);
  });

  it.each([
    ["", "Hello", 5, "invalid_label"],
    ["hello", "   ", 5, "invalid_label"],
    ["__proto__", "Hello", 5, "invalid_label"],
    ["hello", "x".repeat(65), 5, "invalid_label"],
    ["hello", "Hello", 0, "invalid_count"],
    ["hello", "Hello", 2.5, "invalid_count"],
    ["hello", "Hello", 201, "invalid_count"],
  ])("rejects startRecording(%j, %j, %j) with %s", async (classId, label, count, code) => {
    const { controller } = await setup();
    controller.startRecording(classId, label, count);
    expect(controller.getSnapshot().recording).toMatchObject({ status: "error", errorCode: code });
    controller.handleFrame(makeFeatures(1, { timestamp: 100 }));
    expect(controller.getSnapshot().recording.captured).toBe(0);
  });

  it("reports a storage refusal as an error and stores nothing extra", async () => {
    const { store, controller } = await setup();
    await store.addSamples(Array.from({ length: 199 }, (_, i) => ({ classId: "hello", label: "Hello", hands: 1 as const, vector: randomVector(63, i) })));
    controller.startRecording("hello", "Hello", 2);
    controller.handleFrame(makeFeatures(1, { timestamp: 100, vectors: [POSE] }));
    controller.handleFrame(makeFeatures(1, { timestamp: 200, vectors: [POSE] }));
    await flush();
    expect(controller.getSnapshot().recording).toMatchObject({ status: "error", errorCode: "class_full" });
    expect(await store.count("hello")).toBe(199);
  });
});
