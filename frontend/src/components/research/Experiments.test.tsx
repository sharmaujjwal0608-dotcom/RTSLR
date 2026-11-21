import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isRtslrExperiment } from "@/content/research/guards";
import { EXPERIMENT_PLANS } from "@/content/research/notes";
import type { RtslrExperiment } from "@/content/research/types";
import { I18nProvider } from "@/i18n";
import { Experiments } from "./Experiments";

afterEach(cleanup);

/**
 * MOCK records, used only in this test to prove that the component renders
 * real records. The values are invented fixtures, not RTSLR results.
 */
const mockRuns: RtslrExperiment[] = [
  {
    id: "mock-run-1",
    experimentId: "EXP-002",
    title: "Mock k-NN baseline",
    date: "2027-01-15",
    commit: "0a1b2c3",
    datasetVersion: "mock-landmarks-v1",
    signers: 12,
    samples: 18400,
    protocol: "Leave-one-signer-out (mock)",
    featureVersion: "mock-features-1",
    seed: 1234,
    metrics: [
      { name: "Mock top-1 accuracy, held-out signers", value: 12.5, unit: "%", spread: 3.25 },
      { name: "Mock coverage", value: 0.5, unit: "", spread: null },
    ],
    artefactsUrl: "https://example.org/artefacts/mock-run-1",
    notes: "Mock note.",
  },
  {
    id: "mock-run-2",
    experimentId: "EXP-001",
    title: "Mock detection pilot",
    date: "2027-02-01",
    commit: "4d5e6f7",
    datasetVersion: "mock-landmarks-v0",
    signers: 3,
    samples: 900,
    protocol: "Per-sign detection rate (mock)",
    featureVersion: "mock-features-0",
    seed: 1,
    metrics: [{ name: "Mock detection rate", value: 42, unit: "%", spread: null }],
    artefactsUrl: "research/artefacts/mock-run-2",
  },
];

const realPlans = EXPERIMENT_PLANS.filter((plan) => !plan.outlineOnly).length;

describe("Experiments, with no records (the current state)", () => {
  it("shows the designed empty state and no result", () => {
    render(<Experiments experiments={[]} />);
    expect(screen.getByText("No experiments have been run yet")).toBeTruthy();
    expect(screen.getByTestId("experiments-empty").textContent).toContain("Recorded runs: 0");
    // Without a record there is no metrics table and no artefact link.
    expect(screen.queryAllByRole("table")).toHaveLength(0);
    expect(screen.queryByText("Open the saved artefacts")).toBeNull();
  });

  it("lists every planned experiment, each labelled as a plan that was not run", () => {
    render(<Experiments experiments={[]} />);
    const plans = screen.getByRole("list", { name: "Planned experiment specifications" });
    const items = within(plans).getAllByRole("article");
    expect(items).toHaveLength(EXPERIMENT_PLANS.length);
    for (const item of items) {
      expect(item.textContent).toMatch(/Plan, not run|Outline only, not run/);
    }
    expect(within(plans).getAllByText("Plan, not run")).toHaveLength(realPlans);
    expect(screen.getByText(/These are specifications, not results/)).toBeTruthy();
  });

  it("labels the section with its single level-2 heading", () => {
    render(<Experiments experiments={[]} />);
    const section = screen.getByRole("region", { name: "Experiments" });
    expect(within(section).getByRole("heading", { level: 2, name: "Experiments" })).toBeTruthy();
    expect(within(section).getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });
});

describe("Experiments, with records (mock data)", () => {
  it("uses fixtures that satisfy the record guard", () => {
    expect(mockRuns.every(isRtslrExperiment)).toBe(true);
  });

  it("renders each record with its provenance next to the numbers", () => {
    render(<Experiments experiments={mockRuns} />);
    expect(screen.queryByText("No experiments have been run yet")).toBeNull();
    expect(screen.queryByTestId("experiments-empty")).toBeNull();
    expect(screen.getByText("2 recorded runs")).toBeTruthy();

    const first = screen.getByRole("article", { name: "Mock k-NN baseline" });
    for (const text of [
      "mock-landmarks-v1",
      "12",
      "18400",
      "Leave-one-signer-out (mock)",
      "mock-features-1",
      "1234",
      "0a1b2c3",
      "Mock note.",
    ]) {
      expect(within(first).getByText(text), text).toBeTruthy();
    }
    expect(within(first).getByText("2027-01-15").getAttribute("datetime")).toBe("2027-01-15");
  });

  it("renders metrics as a real table with a caption, header scopes, value, unit and spread", () => {
    render(<Experiments experiments={mockRuns} />);
    const table = screen.getByRole("table", { name: "Measured metrics for Mock k-NN baseline" });
    expect(table.querySelector("caption")).not.toBeNull();
    const columnHeaders = within(table).getAllByRole("columnheader");
    expect(columnHeaders.map((cell) => cell.textContent)).toEqual(["Metric", "Value", "Spread across folds"]);
    expect(columnHeaders.every((cell) => cell.getAttribute("scope") === "col")).toBe(true);

    const row = within(table).getByRole("row", { name: /Mock top-1 accuracy/ });
    expect(within(row).getByRole("rowheader").getAttribute("scope")).toBe("row");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["12.5 %", "± 3.25 %"]);

    const noSpread = within(table).getByRole("row", { name: /Mock coverage/ });
    expect(within(noSpread).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["0.5", "Not reported"]);
  });

  it("labels a run with fewer than 5 signers as a pilot, and only that run", () => {
    render(<Experiments experiments={mockRuns} />);
    const pilot = screen.getByRole("article", { name: "Mock detection pilot" });
    expect(within(pilot).getByText("Pilot: fewer than 5 signers")).toBeTruthy();
    const full = screen.getByRole("article", { name: "Mock k-NN baseline" });
    expect(within(full).queryByText("Pilot: fewer than 5 signers")).toBeNull();
  });

  it("links http(s) artefacts safely and prints repository paths as text", () => {
    render(<Experiments experiments={mockRuns} />);
    const link = screen.getByRole("link", { name: /Open the saved artefacts/ });
    expect(link.getAttribute("href")).toBe("https://example.org/artefacts/mock-run-1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    const pilot = screen.getByRole("article", { name: "Mock detection pilot" });
    expect(within(pilot).queryByRole("link")).toBeNull();
    expect(within(pilot).getByText("research/artefacts/mock-run-2")).toBeTruthy();
  });

  it("marks the plans that have a recorded run and keeps the others labelled as plans", () => {
    render(<Experiments experiments={mockRuns} />);
    const plans = screen.getByRole("list", { name: "Planned experiment specifications" });
    expect(within(plans).getAllByText("Run recorded above")).toHaveLength(2);
    expect(within(plans).getAllByText("Plan, not run")).toHaveLength(realPlans - 2);
  });
});

describe("Experiments in Hindi", () => {
  it("translates labels and keeps record text in English, marked as English", async () => {
    window.localStorage.setItem("rtslr.locale", "hi");
    try {
      render(
        <I18nProvider>
          <Experiments experiments={[]} />
        </I18nProvider>,
      );
      expect(await screen.findByText("अभी तक कोई प्रयोग नहीं किया गया है")).toBeTruthy();
      expect(screen.getByText("Two-hand detection feasibility").getAttribute("lang")).toBe("en");
    } finally {
      window.localStorage.removeItem("rtslr.locale");
    }
  });
});
