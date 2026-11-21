/**
 * Meaning-recall quiz: "what is the Hindi for this English word?" and the
 * reverse. This checks vocabulary meaning only, which is checkable. It does not
 * and cannot check how a sign is made.
 */

import type { SignItem } from "./content";
import { foldText } from "./search";

export type QuizDirection = "en-hi" | "hi-en";

export type QuizOption = {
  /** Sign id this option's text belongs to. */
  signId: string;
  text: string;
};

export type QuizQuestion = {
  signId: string;
  direction: QuizDirection;
  prompt: string;
  /** Language of the prompt and of the options, for `lang` attributes. */
  promptLang: "en" | "hi";
  optionLang: "en" | "hi";
  options: readonly QuizOption[];
  /** Index into `options`. */
  correctIndex: number;
};

export type Rng = () => number;

/** Small deterministic generator (mulberry32) so quizzes can be tested. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Items that can be asked: the two meanings must differ. Letters are excluded
 * because their Hindi form is the same Latin letter.
 */
export function quizPool(signs: readonly SignItem[]): SignItem[] {
  return signs.filter((sign) => foldText(sign.en) !== foldText(sign.hi));
}

const promptOf = (sign: SignItem, direction: QuizDirection) => (direction === "en-hi" ? sign.en : sign.hi);
const answerOf = (sign: SignItem, direction: QuizDirection) => (direction === "en-hi" ? sign.hi : sign.en);

export const MIN_OPTIONS = 2;

/**
 * Builds one multiple-choice question. Distractors come from the same category
 * first (harder), then from the rest. No two options share a text, and no
 * distractor shares the target's prompt (it would also be a right answer).
 * Returns null when the pool cannot supply at least one distractor.
 */
export function generateQuestion(
  target: SignItem,
  pool: readonly SignItem[],
  direction: QuizDirection,
  rng: Rng,
  optionCount = 4,
): QuizQuestion | null {
  const answer = answerOf(target, direction);
  const usedAnswers = new Set([foldText(answer)]);
  const targetPrompt = foldText(promptOf(target, direction));

  const candidates = [
    ...shuffle(pool.filter((s) => s.category === target.category), rng),
    ...shuffle(pool.filter((s) => s.category !== target.category), rng),
  ];

  const distractors: QuizOption[] = [];
  for (const candidate of candidates) {
    if (distractors.length >= optionCount - 1) break;
    if (candidate.id === target.id) continue;
    if (foldText(promptOf(candidate, direction)) === targetPrompt) continue;
    const text = answerOf(candidate, direction);
    const key = foldText(text);
    if (usedAnswers.has(key)) continue;
    usedAnswers.add(key);
    distractors.push({ signId: candidate.id, text });
  }
  if (distractors.length < MIN_OPTIONS - 1) return null;

  const options = shuffle([{ signId: target.id, text: answer }, ...distractors], rng);
  return {
    signId: target.id,
    direction,
    prompt: promptOf(target, direction),
    promptLang: direction === "en-hi" ? "en" : "hi",
    optionLang: direction === "en-hi" ? "hi" : "en",
    options,
    correctIndex: options.findIndex((option) => option.signId === target.id),
  };
}

export type QuizConfig = {
  direction: QuizDirection;
  /** Number of questions wanted; fewer are returned when the pool is small. */
  count: number;
  rng: Rng;
  /** Signs the questions are drawn from. Defaults to the whole pool. */
  targets?: readonly SignItem[];
};

/** Builds a quiz with no repeated target. `pool` supplies the distractors. */
export function generateQuiz(pool: readonly SignItem[], config: QuizConfig): QuizQuestion[] {
  const eligible = quizPool(pool);
  const targets = shuffle(quizPool(config.targets ?? eligible), config.rng);
  const questions: QuizQuestion[] = [];
  for (const target of targets) {
    if (questions.length >= config.count) break;
    const question = generateQuestion(target, eligible, config.direction, config.rng);
    if (question) questions.push(question);
  }
  return questions;
}

export function isCorrect(question: QuizQuestion, selectedIndex: number): boolean {
  return selectedIndex === question.correctIndex;
}
