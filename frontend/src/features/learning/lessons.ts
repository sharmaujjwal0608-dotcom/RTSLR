/** Pure helpers that read lesson progress out of the stored state. */

import { LESSONS, type Lesson } from "./content";
import type { ProgressState } from "./progressStore";

export type LessonStatus = {
  status: "not-started" | "in-progress" | "completed";
  /** Item to show when the lesson is opened (0-based, always in range). */
  index: number;
  total: number;
};

export function lessonStatus(lesson: Lesson, state: ProgressState): LessonStatus {
  const total = lesson.signIds.length;
  const entry = Object.hasOwn(state.lessons, lesson.id) ? state.lessons[lesson.id] : undefined;
  if (!entry) return { status: "not-started", index: 0, total };
  const index = Math.min(Math.max(0, entry.index), Math.max(0, total - 1));
  return { status: entry.completedAt ? "completed" : "in-progress", index, total };
}

export function completedLessonCount(state: ProgressState, lessons: readonly Lesson[] = LESSONS): number {
  return lessons.filter((lesson) => lessonStatus(lesson, state).status === "completed").length;
}

/** The unfinished lesson the learner touched last, if it still exists. */
export function lessonToContinue(state: ProgressState, lessons: readonly Lesson[] = LESSONS): Lesson | undefined {
  if (!state.lastLessonId) return undefined;
  const lesson = lessons.find((entry) => entry.id === state.lastLessonId);
  return lesson && lessonStatus(lesson, state).status === "in-progress" ? lesson : undefined;
}

/** Anchor of a lesson row on its category page. */
export function lessonAnchor(lessonId: string): string {
  return `lesson-${lessonId}`;
}
