import { describe, expect, it } from "vitest";
import {
  ResearchDataError,
  checkDataset,
  checkRtslrExperiment,
  isDataset,
  isHttpUrl,
  isPublishedBenchmark,
  isReference,
  isRoadmapItem,
  isRtslrExperiment,
  parseRecords,
  parseResearchData,
} from "./guards";
import { loadResearchData } from "./index";
import type { Dataset, PublishedBenchmark, Reference, RoadmapItem, RtslrExperiment } from "./types";

const reference: Reference = {
  id: "ref-test",
  title: "A test reference",
  authors: ["A. Author"],
  year: null,
  venue: "Test venue",
  url: "https://example.org/paper",
  summary: "Summary.",
  verified: true,
  verificationNote: "Opened.",
};

const dataset: Dataset = {
  id: "ds-test",
  name: "Test set",
  signLanguage: "ISL",
  description: "Description.",
  classes: "26 letters",
  size: "100 images",
  signers: "3",
  modality: "RGB images",
  staticOrDynamic: "static",
  license: "licence not stated on source page",
  url: "https://example.org/data",
  limitations: "Small.",
  verified: false,
  verificationNote: "Not verified.",
  usedByRtslr: false,
};

const benchmark: PublishedBenchmark = {
  id: "pb-test",
  referenceId: "ref-test",
  signLanguage: "ISL",
  task: "Static alphabet classification",
  classes: 26,
  method: "Landmarks + classifier",
  metricName: "Accuracy (%)",
  metricValue: 90,
  dataset: "Private",
  evaluationProtocol: "Random split",
  caveat: "Not an RTSLR result.",
};

const roadmapItem: RoadmapItem = {
  id: "rm-a",
  phase: "Phase 0",
  title: "Title",
  description: "Description.",
  status: "planned",
  dependsOn: [],
};

/** Shape-only fixture for tests. Not a result. */
const experiment: RtslrExperiment = {
  id: "run-test-1",
  experimentId: "EXP-002",
  title: "Fixture run",
  date: "2027-01-15",
  commit: "abc1234",
  datasetVersion: "fixture-v0",
  signers: 3,
  samples: 120,
  protocol: "leave-one-signer-out",
  featureVersion: "rtslr-features-1",
  seed: 7,
  metrics: [{ name: "Fixture metric", value: 12.5, unit: "%", spread: null }],
  artefactsUrl: "research/artefacts/fixture",
};

describe("record guards", () => {
  it("accept well-formed records", () => {
    expect(isReference(reference)).toBe(true);
    expect(isDataset(dataset)).toBe(true);
    expect(isPublishedBenchmark(benchmark)).toBe(true);
    expect(isPublishedBenchmark({ ...benchmark, classes: null })).toBe(true);
    expect(isRoadmapItem(roadmapItem)).toBe(true);
    expect(isRoadmapItem({ ...roadmapItem, status: "in_progress" })).toBe(true);
    expect(isRtslrExperiment(experiment)).toBe(true);
  });

  it("reject non-objects", () => {
    for (const value of [null, undefined, "x", 3, [], [reference]]) {
      expect(isReference(value)).toBe(false);
      expect(isDataset(value)).toBe(false);
      expect(isPublishedBenchmark(value)).toBe(false);
      expect(isRoadmapItem(value)).toBe(false);
      expect(isRtslrExperiment(value)).toBe(false);
    }
  });

  it("reject references with wrong field types", () => {
    expect(isReference({ ...reference, authors: "A. Author" })).toBe(false);
    expect(isReference({ ...reference, authors: [] })).toBe(false);
    expect(isReference({ ...reference, year: "2020" })).toBe(false);
    expect(isReference({ ...reference, verified: "yes" })).toBe(false);
    expect(isReference({ ...reference, title: "  " })).toBe(false);
  });

  it("reject links that are not http(s)", () => {
    expect(isHttpUrl("https://example.org")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,x")).toBe(false);
    expect(isHttpUrl("/relative")).toBe(false);
    expect(isHttpUrl(42)).toBe(false);
    expect(isReference({ ...reference, url: "javascript:alert(1)" })).toBe(false);
    expect(isDataset({ ...dataset, url: "ftp://example.org/x" })).toBe(false);
  });

  it("reject datasets with an unknown sign type or a missing verification note", () => {
    expect(isDataset({ ...dataset, staticOrDynamic: "moving" })).toBe(false);
    const withoutNote: Record<string, unknown> = { ...dataset };
    delete withoutNote.verificationNote;
    expect(checkDataset(withoutNote)).toEqual(["verificationNote: expected a non-empty string"]);
    expect(isDataset({ ...dataset, usedByRtslr: "no" })).toBe(false);
  });

  it("reject benchmarks whose value is not a finite number", () => {
    expect(isPublishedBenchmark({ ...benchmark, metricValue: "98.1" })).toBe(false);
    expect(isPublishedBenchmark({ ...benchmark, metricValue: Number.NaN })).toBe(false);
    expect(isPublishedBenchmark({ ...benchmark, classes: 0 })).toBe(false);
  });

  it("reject roadmap items with an unknown status", () => {
    expect(isRoadmapItem({ ...roadmapItem, status: "finished" })).toBe(false);
    expect(isRoadmapItem({ ...roadmapItem, dependsOn: [1] })).toBe(false);
  });

  it("reject experiments without metrics, provenance or a real date", () => {
    expect(isRtslrExperiment({ ...experiment, metrics: [] })).toBe(false);
    expect(isRtslrExperiment({ ...experiment, artefactsUrl: "" })).toBe(false);
    expect(isRtslrExperiment({ ...experiment, signers: 2.5 })).toBe(false);
    expect(isRtslrExperiment({ ...experiment, date: "2027-02-30" })).toBe(false);
    expect(isRtslrExperiment({ ...experiment, date: "15 Jan 2027" })).toBe(false);
    expect(
      checkRtslrExperiment({ ...experiment, metrics: [{ name: "m", value: "high", unit: "", spread: null }] }),
    ).toEqual(["metrics[0].value: expected a finite number"]);
  });
});

describe("parseRecords", () => {
  it("returns the records when all are valid", () => {
    expect(parseRecords("datasets.json", [dataset], checkDataset)).toEqual([dataset]);
    expect(parseRecords("rtslr-experiments.json", [], checkRtslrExperiment)).toEqual([]);
  });

  it("throws with the file name, the record and the field", () => {
    const bad = { ...dataset, id: "ds-bad", license: "" };
    let failure: unknown;
    try {
      parseRecords("datasets.json", [dataset, bad], checkDataset);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ResearchDataError);
    expect((failure as ResearchDataError).file).toBe("datasets.json");
    expect((failure as ResearchDataError).problems).toEqual(["[1] ds-bad: license: expected a non-empty string"]);
  });

  it("rejects a non-array and duplicate ids", () => {
    expect(() => parseRecords("datasets.json", { datasets: [] }, checkDataset)).toThrowError(/expected a JSON array/);
    expect(() => parseRecords("datasets.json", [dataset, dataset], checkDataset)).toThrowError(/duplicate id/);
  });
});

describe("parseResearchData", () => {
  const valid = {
    references: [reference],
    datasets: [dataset],
    benchmarks: [benchmark],
    roadmap: [roadmapItem, { ...roadmapItem, id: "rm-b", dependsOn: ["rm-a"] }],
    experiments: [],
  };

  it("accepts a consistent set of files", () => {
    const data = parseResearchData(valid);
    expect(data.benchmarks).toHaveLength(1);
    expect(data.experiments).toEqual([]);
  });

  it("rejects a benchmark that cites an unknown reference", () => {
    expect(() =>
      parseResearchData({ ...valid, benchmarks: [{ ...benchmark, referenceId: "ref-missing" }] }),
    ).toThrowError(/ref-missing/);
  });

  it("rejects a roadmap item that depends on an unknown item or on itself", () => {
    expect(() => parseResearchData({ ...valid, roadmap: [{ ...roadmapItem, dependsOn: ["rm-zz"] }] })).toThrowError(
      /rm-zz/,
    );
    expect(() => parseResearchData({ ...valid, roadmap: [{ ...roadmapItem, dependsOn: ["rm-a"] }] })).toThrowError(
      /rm-a/,
    );
  });
});

describe("loadResearchData (the synced copies of research/data)", () => {
  const data = loadResearchData();

  it("loads and validates all five files", () => {
    expect(data.references.length).toBeGreaterThan(0);
    expect(data.datasets.length).toBeGreaterThan(0);
    expect(data.benchmarks.length).toBeGreaterThan(0);
    expect(data.roadmap.length).toBeGreaterThan(0);
    expect(Array.isArray(data.experiments)).toBe(true);
  });

  it("records no dataset as used by RTSLR and none without a verification note", () => {
    expect(data.datasets.filter((item) => item.usedByRtslr)).toEqual([]);
    expect(data.datasets.every((item) => item.verificationNote.length > 0)).toBe(true);
  });

  it("labels every published benchmark as not an RTSLR result", () => {
    for (const row of data.benchmarks) expect(row.caveat).toMatch(/not an RTSLR result/);
  });

  it("returns the same validated object on repeated calls", () => {
    expect(loadResearchData()).toBe(data);
  });
});
