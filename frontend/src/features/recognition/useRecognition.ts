"use client";

/**
 * React binding for the recognition layer.
 *
 * Frames arrive through `subscribe` at camera rate and never touch React
 * state directly: the controller classifies and stabilises them and publishes
 * a snapshot roughly ten times a second (immediately on a commit or a phase
 * change). Commits are delivered through `onCommit`, exactly once per sign.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CommitEvent, ModelInfo, StabilizedState } from "../../types/recognition";
import {
  INITIAL_RECOGNITION_SNAPSHOT,
  RecognitionController,
  type FrameSubscribe,
  type ModelLoadStatus,
  type RecognitionControllerOptions,
  type RecognitionSettings,
  type RecognitionSnapshot,
  type RecordingState,
} from "./controller";

export type UseRecognitionOptions = {
  /**
   * Frame source, e.g. the tracking hook's per-frame subscription. Pass null
   * while there is no source. Keep the function identity stable between
   * renders (useCallback or a module-level function).
   */
  subscribe: FrameSubscribe | null;
  /** Id from the registry (`MODEL_IDS`). */
  modelId: string;
  settings?: RecognitionSettings;
  /** Called once per committed sign. May change between renders. */
  onCommit?: (event: CommitEvent) => void;
  /** Advanced/testing: store, model factory and timing overrides. Read once on mount. */
  controllerOptions?: RecognitionControllerOptions;
};

export type UseRecognitionResult = {
  /** Stabilised recognition state, updated at about 10 Hz. */
  state: StabilizedState;
  modelStatus: ModelLoadStatus;
  /** Why the requested model is unavailable or failed; null otherwise. */
  modelMessage: string | null;
  /** The model actually classifying frames (null before the first load). */
  modelInfo: ModelInfo | null;
  activeModelId: string | null;
  recording: RecordingState;
  /** Record `count` samples of a sign from live frames while the hand(s) are steady. */
  startRecording: (classId: string, label: string, count: number) => void;
  /** Stop recording and discard the captured samples. */
  cancelRecording: () => void;
  /** Put the recording state back to idle after done / cancelled / error. */
  clearRecordingStatus: () => void;
  /** Clear votes, hold timer and model temporal state (e.g. when the camera stops). */
  reset: () => void;
};

const getServerSnapshot = (): RecognitionSnapshot => INITIAL_RECOGNITION_SNAPSHOT;

export function useRecognition(options: UseRecognitionOptions): UseRecognitionResult {
  const { subscribe, modelId, settings, onCommit, controllerOptions } = options;

  const [controller] = useState(() => new RecognitionController(controllerOptions));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, getServerSnapshot);

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    controller.setCommitHandler((event) => onCommitRef.current?.(event));
    return () => controller.setCommitHandler(null);
  }, [controller]);

  useEffect(() => {
    void controller.setModel(modelId);
  }, [controller, modelId]);

  const minScore = settings?.minScore;
  const holdSeconds = settings?.holdSeconds;
  const cooldownSeconds = settings?.cooldownSeconds;
  const repeatWhileHeld = settings?.repeatWhileHeld;
  useEffect(() => {
    controller.setSettings({ minScore, holdSeconds, cooldownSeconds, repeatWhileHeld });
  }, [controller, minScore, holdSeconds, cooldownSeconds, repeatWhileHeld]);

  useEffect(() => {
    if (!subscribe) return;
    const unsubscribe = subscribe(controller.handleFrame);
    return () => {
      unsubscribe();
      controller.reset();
    };
  }, [controller, subscribe]);

  useEffect(() => {
    return () => {
      controller.cancelRecording();
    };
  }, [controller]);

  const startRecording = useCallback(
    (classId: string, label: string, count: number) => controller.startRecording(classId, label, count),
    [controller],
  );
  const cancelRecording = useCallback(() => controller.cancelRecording(), [controller]);
  const clearRecordingStatus = useCallback(() => controller.clearRecordingStatus(), [controller]);
  const reset = useCallback(() => controller.reset(), [controller]);

  return {
    state: snapshot.state,
    modelStatus: snapshot.modelStatus,
    modelMessage: snapshot.modelMessage,
    modelInfo: snapshot.modelInfo,
    activeModelId: snapshot.activeModelId,
    recording: snapshot.recording,
    startRecording,
    cancelRecording,
    clearRecordingStatus,
    reset,
  };
}
