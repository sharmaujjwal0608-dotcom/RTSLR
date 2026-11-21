// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SIGNS } from "@/features/learning/content";
import { progressStore } from "@/features/learning/progressStore";
import { MeaningQuiz } from "./MeaningQuiz";

afterEach(() => {
  cleanup();
  progressStore.reset();
});

/** The Hindi meaning of the English word quoted in the question. */
function expectedAnswer(): string {
  const heading = screen.getByRole("heading", { level: 3 }).textContent ?? "";
  const word = /“(.+)”/.exec(heading)?.[1];
  const sign = SIGNS.find((entry) => entry.en === word);
  if (!sign) throw new Error(`no sign for question "${heading}"`);
  return sign.hi;
}

function start() {
  render(<MeaningQuiz />);
  fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));
}

describe("MeaningQuiz", () => {
  it("asks a question as a labelled radio group with four distinct options", () => {
    start();
    expect(screen.getByText("Question 1 of 5")).toBeDefined();
    const group = screen.getByRole("group");
    expect(group.tagName).toBe("FIELDSET");
    expect(within(group).getByRole("heading", { level: 3 }).textContent).toMatch(/^What is the Hindi for “.+”\?$/);

    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    const labels = radios.map((radio) => radio.closest("label")?.textContent);
    expect(new Set(labels).size).toBe(4);
    expect(labels).toContain(expectedAnswer());
  });

  it("has a live region that asks for a choice before checking", () => {
    start();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(status.textContent).toContain("Choose an answer, then check it.");
    expect(screen.getByText("Question 1 of 5")).toBeDefined();
  });

  it("confirms a correct answer in the live region and locks the options", () => {
    start();
    const answer = expectedAnswer();
    fireEvent.click(screen.getByRole("radio", { name: answer }));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Correct.");
    expect(status.textContent).toContain(`means “${answer}”`);
    expect(status.textContent).not.toContain("You chose");
    expect((screen.getAllByRole("radio") as HTMLInputElement[]).every((radio) => radio.disabled)).toBe(true);
    expect(screen.getByText("Correct answer")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next question" })).toBeDefined();
  });

  it("explains a wrong answer in words, not only by colour", () => {
    start();
    const answer = expectedAnswer();
    const wrong = (screen.getAllByRole("radio") as HTMLInputElement[]).find(
      (radio) => radio.closest("label")?.textContent !== answer,
    );
    if (!wrong) throw new Error("no wrong option");
    const wrongText = wrong.closest("label")?.textContent ?? "";
    fireEvent.click(wrong);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Not correct.");
    expect(status.textContent).toContain(`means “${answer}”`);
    expect(status.textContent).toContain(`You chose “${wrongText}”.`);
    expect(screen.getByText("Correct answer")).toBeDefined();
    expect(screen.getByText("Your answer")).toBeDefined();
  });

  it("runs to the end, shows the score and records it in quiz history", () => {
    start();
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByText(`Question ${i + 1} of 5`)).toBeDefined();
      // Answer the first two correctly and the rest with the first wrong option.
      const answer = expectedAnswer();
      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      const pick = radios.find((radio) => (radio.closest("label")?.textContent === answer) === i < 2);
      if (!pick) throw new Error("option missing");
      fireEvent.click(pick);
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      fireEvent.click(screen.getByRole("button", { name: i === 4 ? "See result" : "Next question" }));
    }
    expect(screen.getByRole("heading", { name: "You got 2 of 5" })).toBeDefined();
    expect(screen.getByText("Words to review")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    const { quizzes } = progressStore.getSnapshot().state;
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0]).toMatchObject({ direction: "en-hi", category: "all", total: 5, correct: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Start another quiz" }));
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeDefined();
  });

  it("asks in Hindi when the direction is reversed", () => {
    render(<MeaningQuiz />);
    fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), { target: { value: "hi-en" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Words from" }), { target: { value: "family" } });
    fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));
    const heading = screen.getByRole("heading", { level: 3 }).textContent ?? "";
    expect(heading).toMatch(/^What is the English for “.+”\?$/);
    const word = /“(.+)”/.exec(heading)?.[1];
    const sign = SIGNS.find((entry) => entry.hi === word);
    expect(sign?.category).toBe("family");
    expect(screen.getByRole("radio", { name: sign?.en })).toBeDefined();
  });

  it("does not offer the alphabet, which has no separate Hindi meaning", () => {
    render(<MeaningQuiz />);
    const options = within(screen.getByRole("combobox", { name: "Words from" })).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "all",
      "numbers",
      "greetings",
      "everyday",
      "family",
      "questions",
      "time-and-days",
      "places",
    ]);
  });
});
