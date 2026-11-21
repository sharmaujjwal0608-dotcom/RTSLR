/**
 * Learning feature: content, search, quiz, spaced repetition and progress.
 *
 * For the global "delete my local data" control:
 *   import { LEARNING_STORAGE_KEYS, LEARNING_STORAGE_PREFIX, progressStore } from "@/features/learning";
 *   Object.values(LEARNING_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
 *   progressStore.reload();
 * or simply call `progressStore.reset()`.
 */

export * from "./content";
export * from "./search";
export * from "./quiz";
export * from "./srs";
export * from "./progressStore";
export { useProgress } from "./useProgress";
