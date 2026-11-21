"use client";

import { useSyncExternalStore } from "react";
import { progressStore, type ProgressSnapshot, type ProgressStore } from "./progressStore";

/**
 * Subscribes a component to the learning progress store. On the server and
 * during hydration it returns the empty, not-ready snapshot, so markup matches;
 * the stored progress appears right after.
 */
export function useProgress(store: ProgressStore = progressStore): ProgressSnapshot & { store: ProgressStore } {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, store };
}
