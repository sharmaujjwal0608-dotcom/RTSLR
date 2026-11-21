import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadResearchData } from "@/content/research";
import { PIPELINE_STAGES } from "@/content/research/system";
import { ArchitectureExplorer } from "./ArchitectureExplorer";
import { DatasetExplorer } from "./DatasetExplorer";
import { ModelExplorer } from "./ModelExplorer";
import { PublishedBenchmarks } from "./PublishedBenchmarks";

afterEach(cleanup);

describe("ArchitectureExplorer", () => {
  it("shows the first stage and one tab per pipeline stage", () => {
    render(<ArchitectureExplorer />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(PIPELINE_STAGES.length);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0].id);
    expect(within(panel).getByText("frontend/src/features/tracking/camera.ts")).toBeTruthy();
  });

  it("selects a stage on click and shows its inputs, outputs, module path and limitations", () => {
    render(<ArchitectureExplorer />);
    fireEvent.click(screen.getByRole("tab", { name: /Stabiliser/ }));
    const panel = screen.getByRole("tabpanel", { name: /Stabiliser/ });
    expect(within(panel).getByText("frontend/src/features/recognition/stabilizer.ts")).toBeTruthy();
    for (const label of ["Inputs", "Outputs", "Module in the repository", "Known limitations"]) {
      expect(within(panel).getByText(label)).toBeTruthy();
    }
  });

  it("is operable with the arrow, Home and End keys and moves focus with the selection", () => {
    render(<ArchitectureExplorer />);
    const tabs = screen.getAllByRole("tab");
    const last = tabs[tabs.length - 1];
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowDown" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0], { key: "ArrowUp" });
    expect(last.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(last, { key: "Home" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(document.activeElement).toBe(last);
  });
});

describe("ModelExplorer", () => {
  it("shows the three things that run and the empty validated ISL slot", () => {
    render(<ModelExplorer />);
    const slot = screen.getByRole("article", { name: "Validated ISL model — none yet" });
    expect(within(slot).getByText("Does not exist")).toBeTruthy();
    expect(within(slot).getByText("What a validated ISL model requires")).toBeTruthy();
    expect(screen.getAllByText("Runs today")).toHaveLength(3);
    expect(screen.getAllByText("Classifier score, not a probability")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Legacy ASL prototype" }).textContent).toContain(
      "It does not recognise Indian Sign Language",
    );
  });
});

describe("DatasetExplorer", () => {
  const { datasets } = loadResearchData();
  const countText = (shown: number) => `Showing ${shown} of ${datasets.length} datasets`;

  it("lists every dataset with a live count, the recorded licence and 'used by RTSLR: no'", () => {
    render(<DatasetExplorer datasets={datasets} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe(countText(datasets.length));
    const entries = within(screen.getByRole("list", { name: "Datasets" })).getAllByRole("article");
    expect(entries).toHaveLength(datasets.length);
    for (const entry of entries) {
      expect(within(entry).getByText("Used by RTSLR").nextElementSibling?.textContent).toBe("No");
    }
    expect(within(entries[0]).getByText(datasets[0].license)).toBeTruthy();
    expect(within(entries[0]).getByText(datasets[0].verificationNote)).toBeTruthy();
  });

  it("updates the count when a labelled filter changes, and clears it again", () => {
    render(<DatasetExplorer datasets={datasets} />);
    const unverified = datasets.filter((item) => !item.verified).length;
    fireEvent.change(screen.getByLabelText("Verification"), { target: { value: "unverified" } });
    expect(screen.getByRole("status").textContent).toBe(countText(unverified));
    expect(within(screen.getByRole("list", { name: "Datasets" })).getAllByRole("article")).toHaveLength(unverified);

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzz-no-match" } });
    expect(screen.getByRole("status").textContent).toBe(countText(0));
    expect(screen.getByText("No dataset matches these filters")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status").textContent).toBe(countText(datasets.length));
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
});

describe("PublishedBenchmarks", () => {
  const { benchmarks, references } = loadResearchData();

  it("renders a captioned table with one row per record and scoped headers in a focusable scroll region", () => {
    render(<PublishedBenchmarks benchmarks={benchmarks} references={references} />);
    const table = screen.getByRole("table");
    expect(table.querySelector("caption")?.textContent).toMatch(/Published results from other groups/);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(benchmarks.length);
    expect(within(table).getAllByRole("columnheader").every((cell) => cell.getAttribute("scope") === "col")).toBe(true);
    expect(table.parentElement?.getAttribute("tabindex")).toBe("0");
    expect(table.parentElement?.getAttribute("aria-label")).toBeTruthy();
  });

  it("says the figures are not RTSLR measurements and omits the unsourced legacy numbers", () => {
    render(<PublishedBenchmarks benchmarks={benchmarks} references={references} />);
    expect(screen.getByText(/These are not RTSLR measurements/)).toBeTruthy();
    const values = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[5].textContent);
    expect(values).toEqual(benchmarks.map((row) => String(row.metricValue)));
    expect(values).not.toContain("96.5");
    expect(values).not.toContain("92");
  });
});
