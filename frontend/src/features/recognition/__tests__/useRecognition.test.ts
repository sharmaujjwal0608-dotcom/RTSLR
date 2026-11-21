// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CommitEvent, FrameFeatures } from "../../../types/recognition";
import { MODEL_IDS } from "../registry";
import { MemorySampleBackend, SampleStore } from "../sampleStore";
import { useRecognition, type UseRecognitionOptions } from "../useRecognition";
import { flatHand, jitter, makeFeatures, randomVector, schematicHand } from "./testUtils";

/** A hand-rolled frame source with the shape the tracking layer provides. */
function frameSource() {
  const listeners = new Set<(features: FrameFeatures) => void>();
  return {
    subscribe: (callback: (features: FrameFeatures) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    emit: (features: FrameFeatures) => listeners.forEach((listener) => listener(features)),
    count: () => listeners.size,
  };
}

describe("useRecognition", () => {
  it("loads the selected model, publishes state and commits once", async () => {
    const source = frameSource();
    const onCommit = vi.fn<(event: CommitEvent) => void>();
    const store = new SampleStore(new MemorySampleBackend());
    const { result, unmount } = renderHook(() =>
      useRecognition({
        subscribe: source.subscribe,
        modelId: MODEL_IDS.legacyAsl,
        settings: { holdSeconds: 0.5, minScore: 0.75 },
        onCommit,
        controllerOptions: { store },
      }),
    );

    await waitFor(() => expect(result.current.modelStatus).toBe("ready"));
    expect(result.current.modelInfo).toMatchObject({ kind: "legacy_asl_prototype", signLanguage: "ASL", validated: false });
    expect(result.current.state.phase).toBe("idle");
    expect(source.count()).toBe(1);

    const pose = schematicHand(["up", "curled", "curled", "curled"], "out");
    act(() => {
      for (let t = 0; t < 3000; t += 33) source.emit(makeFeatures(1, { timestamp: t, hands: [flatHand(0, pose)] }));
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toMatchObject({ classId: "L", signLanguage: "ASL", modelId: MODEL_IDS.legacyAsl });
    expect(result.current.state).toMatchObject({ phase: "committed", classId: "L", holdProgress: 1 });

    unmount();
    expect(source.count()).toBe(0);
  });

  it("switches model and reports the missing validated ISL model without failing", async () => {
    const source = frameSource();
    const store = new SampleStore(new MemorySampleBackend());
    const { result, rerender } = renderHook((props: UseRecognitionOptions) => useRecognition(props), {
      initialProps: { subscribe: source.subscribe, modelId: MODEL_IDS.islUser, controllerOptions: { store } } as UseRecognitionOptions,
    });
    await waitFor(() => expect(result.current.modelStatus).toBe("ready"));
    expect(result.current.modelInfo?.kind).toBe("experimental_isl_user_trained");

    rerender({ subscribe: source.subscribe, modelId: MODEL_IDS.validatedIsl, controllerOptions: { store } });
    await waitFor(() => expect(result.current.modelStatus).not.toBe("loading"));
    expect(result.current.modelStatus).not.toBe("ready");
    expect(result.current.modelMessage).toContain("No validated ISL model is available");
    // The experimental model keeps running underneath.
    expect(result.current.activeModelId).toBe(MODEL_IDS.islUser);
  });

  it("records samples through the hook and the experimental model then recognises them", async () => {
    const source = frameSource();
    const store = new SampleStore(new MemorySampleBackend());
    const { result } = renderHook(() =>
      useRecognition({ subscribe: source.subscribe, modelId: MODEL_IDS.islUser, controllerOptions: { store } }),
    );
    await waitFor(() => expect(result.current.modelStatus).toBe("ready"));

    const pose = randomVector(156, 77); // arbitrary numbers standing in for a two-hand pose
    act(() => result.current.startRecording("demo", "Demo", 4));
    act(() => {
      for (let t = 100; t <= 800; t += 100) source.emit(makeFeatures(2, { timestamp: t, dual: jitter(pose, 0.01, t) }));
    });
    await waitFor(() => expect(result.current.recording.status).toBe("done"));
    expect(await store.summary()).toEqual([{ classId: "demo", label: "Demo", hands: 2, count: 4 }]);
    await waitFor(() => expect(result.current.modelInfo?.classes).toHaveLength(1));

    act(() => {
      source.emit(makeFeatures(2, { timestamp: 5000, dual: jitter(pose, 0.01, 1) }));
    });
    expect(result.current.state.latest).toMatchObject({ status: "recognized", classId: "demo", handsUsed: 2 });

    act(() => result.current.reset());
    expect(result.current.state.phase).toBe("idle");
  });
});
