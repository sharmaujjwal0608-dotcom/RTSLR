"use client";

import { ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button, Notice, Select } from "@/components/ui";
import { CATEGORIES, SIGNS, getSign, signHref, type CategoryId } from "@/features/learning/content";
import {
  createRng,
  generateQuiz,
  isCorrect,
  quizPool,
  type QuizDirection,
  type QuizQuestion,
} from "@/features/learning/quiz";
import { useProgress } from "@/features/learning/useProgress";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { fill } from "./shared";

const messages = defineMessages({
  en: {
    intro:
      "Multiple-choice questions on what each word means in the other language. This checks your memory of meanings, which can be marked right or wrong. It does not check signing.",
    direction: "Direction",
    enHi: "English to Hindi",
    hiEn: "Hindi to English",
    category: "Words from",
    allCategories: "All categories",
    length: "Number of questions",
    start: "Start quiz",
    progress: "Question {index} of {total}",
    askHi: "What is the Hindi for “{word}”?",
    askEn: "What is the English for “{word}”?",
    check: "Check answer",
    chooseFirst: "Choose an answer, then check it.",
    correct: "Correct.",
    incorrect: "Not correct.",
    explain: "“{prompt}” means “{answer}”.",
    youChose: "You chose “{choice}”.",
    correctTag: "Correct answer",
    yourTag: "Your answer",
    next: "Next question",
    finish: "See result",
    resultTitle: "You got {correct} of {total}",
    resultSaved: "This result has been added to your quiz history on the Progress page.",
    missed: "Words to review",
    allRight: "Every answer was correct.",
    again: "Start another quiz",
    quit: "End quiz",
  },
  hi: {
    intro:
      "बहुविकल्पीय प्रश्न कि हर शब्द का दूसरी भाषा में क्या अर्थ है। इससे अर्थों की आपकी याद परखी जाती है, जिसे सही या ग़लत आँका जा सकता है। इससे संकेत करने की जाँच नहीं होती।",
    direction: "दिशा",
    enHi: "अंग्रेज़ी से हिंदी",
    hiEn: "हिंदी से अंग्रेज़ी",
    category: "शब्द किस श्रेणी से",
    allCategories: "सभी श्रेणियाँ",
    length: "प्रश्नों की संख्या",
    start: "क्विज़ शुरू करें",
    progress: "{total} में से प्रश्न {index}",
    askHi: "“{word}” को हिंदी में क्या कहते हैं?",
    askEn: "“{word}” को अंग्रेज़ी में क्या कहते हैं?",
    check: "उत्तर जाँचें",
    chooseFirst: "पहले एक उत्तर चुनें, फिर जाँचें।",
    correct: "सही।",
    incorrect: "सही नहीं।",
    explain: "“{prompt}” का अर्थ “{answer}” है।",
    youChose: "आपने “{choice}” चुना।",
    correctTag: "सही उत्तर",
    yourTag: "आपका उत्तर",
    next: "अगला प्रश्न",
    finish: "परिणाम देखें",
    resultTitle: "{total} में से {correct} सही",
    resultSaved: "यह परिणाम प्रगति पेज पर आपके क्विज़ इतिहास में जोड़ दिया गया है।",
    missed: "दोहराने के लिए शब्द",
    allRight: "हर उत्तर सही था।",
    again: "एक और क्विज़ शुरू करें",
    quit: "क्विज़ समाप्त करें",
  },
});

const QUIZ_CATEGORIES = CATEGORIES.filter((category) => quizPool(SIGNS).some((sign) => sign.category === category.id));
const LENGTHS = [5, 10, 15] as const;

type Session = {
  questions: QuizQuestion[];
  index: number;
  selected: number | null;
  checked: boolean;
  /** Selected option index per answered question. */
  answers: number[];
  finished: boolean;
};

export function MeaningQuiz() {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const { store } = useProgress();
  const groupId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);

  const [direction, setDirection] = useState<QuizDirection>("en-hi");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [length, setLength] = useState<number>(LENGTHS[0]);
  const [session, setSession] = useState<Session | null>(null);
  const [hint, setHint] = useState(false);

  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());

  const start = () => {
    const targets = category === "all" ? undefined : SIGNS.filter((sign) => sign.category === category);
    const questions = generateQuiz(SIGNS, { direction, count: length, rng: createRng(Date.now()), targets });
    setHint(false);
    setSession({ questions, index: 0, selected: null, checked: false, answers: [], finished: false });
    focusHeading();
  };

  const setup = (
    <div className="flex flex-col gap-6">
      <p className="max-w-reading text-body text-muted">{t.intro}</p>
      <div className="grid gap-5 sm:grid-cols-3">
        <Select
          label={t.direction}
          value={direction}
          onChange={(event) => setDirection(event.target.value as QuizDirection)}
          options={[
            { value: "en-hi", label: t.enHi },
            { value: "hi-en", label: t.hiEn },
          ]}
        />
        <Select
          label={t.category}
          value={category}
          onChange={(event) => setCategory(event.target.value as CategoryId | "all")}
          options={[
            { value: "all", label: t.allCategories },
            ...QUIZ_CATEGORIES.map((entry) => ({ value: entry.id, label: entry.title[locale] })),
          ]}
        />
        <Select
          label={t.length}
          value={String(length)}
          onChange={(event) => setLength(Number(event.target.value))}
          options={LENGTHS.map((value) => ({ value: String(value), label: String(value) }))}
        />
      </div>
      <div>
        <Button size="lg" icon={<ArrowRight />} onClick={start}>
          {t.start}
        </Button>
      </div>
    </div>
  );

  if (!session || session.questions.length === 0) return setup;

  const total = session.questions.length;

  if (session.finished) {
    const correct = session.answers.filter((answer, i) => isCorrect(session.questions[i], answer)).length;
    const missed = session.questions.filter((question, i) => !isCorrect(question, session.answers[i]));
    return (
      <div className="flex flex-col gap-6">
        <h3 ref={headingRef} tabIndex={-1} className="text-h2 text-ink outline-none">
          {fill(t.resultTitle, { correct, total })}
        </h3>
        <p className="text-small text-muted">{t.resultSaved}</p>
        {missed.length === 0 ? (
          <Notice tone="success">{t.allRight}</Notice>
        ) : (
          <div className="flex flex-col gap-3">
            <h4 className="text-h4 text-ink">{t.missed}</h4>
            <ul className="divide-y divide-line border-y border-line">
              {missed.map((question) => {
                const sign = getSign(question.signId);
                if (!sign) return null;
                return (
                  <li key={question.signId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                    <Link
                      href={signHref(sign.id)}
                      className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                    >
                      {sign.en}
                    </Link>
                    <span lang="hi" className="text-muted">
                      {sign.hi}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div>
          <Button
            onClick={() => {
              setSession(null);
            }}
          >
            {t.again}
          </Button>
        </div>
      </div>
    );
  }

  const question = session.questions[session.index];
  const right = session.selected !== null && isCorrect(question, session.selected);
  const isLastQuestion = session.index === total - 1;
  const answerText = question.options[question.correctIndex].text;

  const check = () => {
    if (session.selected === null) {
      setHint(true);
      return;
    }
    setHint(false);
    setSession({ ...session, checked: true, answers: [...session.answers, session.selected] });
    requestAnimationFrame(() => nextRef.current?.querySelector<HTMLElement>("button")?.focus());
  };

  const next = () => {
    if (isLastQuestion) {
      const correct = session.answers.filter((answer, i) => isCorrect(session.questions[i], answer)).length;
      store.recordQuiz({ direction: question.direction, category, total, correct });
      setSession({ ...session, finished: true });
    } else {
      setSession({ ...session, index: session.index + 1, selected: null, checked: false });
    }
    focusHeading();
  };

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <p className="font-mono text-label text-muted">{fill(t.progress, { index: session.index + 1, total })}</p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-4">
          <h3 ref={headingRef} tabIndex={-1} className="text-h3 text-ink outline-none">
            {fill(question.direction === "en-hi" ? t.askHi : t.askEn, { word: question.prompt })}
          </h3>
        </legend>
        {question.options.map((option, index) => {
          const selected = session.selected === index;
          const showCorrect = session.checked && index === question.correctIndex;
          const showWrong = session.checked && selected && !showCorrect;
          return (
            <label
              key={option.signId}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-field border px-4 py-2 text-body transition-colors duration-200 ease-calm",
                session.checked ? "cursor-default" : "cursor-pointer hover:border-ink",
                showCorrect
                  ? "border-success-ink bg-success-soft text-ink"
                  : showWrong
                    ? "border-danger-ink bg-danger-soft text-ink"
                    : selected
                      ? "border-ink bg-surface text-ink"
                      : "border-line-strong bg-surface text-ink",
              )}
            >
              <input
                type="radio"
                name={`${groupId}-q${session.index}`}
                value={index}
                checked={selected}
                disabled={session.checked}
                onChange={() => {
                  setHint(false);
                  setSession({ ...session, selected: index });
                }}
                className="size-5 shrink-0 accent-ink"
              />
              <span lang={question.optionLang} className="min-w-0 flex-1 break-words">
                {option.text}
              </span>
              {showCorrect ? (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-success-ink">
                  <Check aria-hidden="true" className="size-4" />
                  {t.correctTag}
                </span>
              ) : showWrong ? (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-danger-ink">
                  <X aria-hidden="true" className="size-4" />
                  {t.yourTag}
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      {/* Always mounted so screen readers announce the feedback when it appears. */}
      <div role="status" aria-live="polite">
        {session.checked ? (
          <Notice tone={right ? "success" : "danger"} title={right ? t.correct : t.incorrect}>
            {fill(t.explain, { prompt: question.prompt, answer: answerText })}
            {!right && session.selected !== null
              ? ` ${fill(t.youChose, { choice: question.options[session.selected].text })}`
              : null}
          </Notice>
        ) : hint ? (
          <Notice tone="info" compact>
            {t.chooseFirst}
          </Notice>
        ) : null}
      </div>

      <div ref={nextRef} className="flex flex-wrap gap-3">
        {session.checked ? (
          <Button icon={<ArrowRight />} onClick={next}>
            {isLastQuestion ? t.finish : t.next}
          </Button>
        ) : (
          <Button onClick={check}>{t.check}</Button>
        )}
        <Button variant="ghost" onClick={() => setSession(null)}>
          {t.quit}
        </Button>
      </div>
    </div>
  );
}
