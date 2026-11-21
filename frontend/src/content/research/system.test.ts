import { describe, expect, it } from "vitest";
import { listModels } from "@/features/recognition/registry";
import { DUAL_FEATURE_DIM, FEATURE_SCHEMA_VERSION, SINGLE_FEATURE_DIM } from "@/types/recognition";
import { loadResearchData } from "./index";
import { ASSUMPTIONS, ESTABLISHED_FACTS, EXPERIMENT_PLANS, LEGACY_AUDIT } from "./notes";
import {
  DUAL_HAND_DIM,
  DUAL_HAND_LAYOUT,
  FEATURE_SCHEMA,
  MODEL_RECORDS,
  PIPELINE_STAGES,
  SINGLE_HAND_DIM,
  SINGLE_HAND_LAYOUT,
  type FeatureBlock,
} from "./system";

function expectContiguous(blocks: FeatureBlock[], dim: number) {
  let next = 0;
  for (const block of blocks) {
    expect(block.from).toBe(next);
    expect(block.to).toBeGreaterThanOrEqual(block.from);
    next = block.to + 1;
  }
  expect(next).toBe(dim);
}

describe("feature layouts", () => {
  it("match the dimensions and schema of the shared contract", () => {
    expect(SINGLE_HAND_DIM).toBe(SINGLE_FEATURE_DIM);
    expect(DUAL_HAND_DIM).toBe(DUAL_FEATURE_DIM);
    expect(FEATURE_SCHEMA).toBe(FEATURE_SCHEMA_VERSION);
  });

  it("cover every index exactly once", () => {
    expectContiguous(SINGLE_HAND_LAYOUT, SINGLE_HAND_DIM);
    expectContiguous(DUAL_HAND_LAYOUT, DUAL_HAND_DIM);
  });
});

describe("model records", () => {
  it("mirror the static ModelInfo of the recognition registry", () => {
    const registry = listModels();
    for (const entry of registry) {
      const record = MODEL_RECORDS.find((candidate) => candidate.id === entry.id);
      expect(record, entry.id).toBeDefined();
      if (!record) continue;
      expect(record.kind).toBe(entry.info.kind);
      expect(record.signLanguage).toBe(entry.info.signLanguage);
      expect(record.input).toBe(entry.info.input);
      expect(record.description).toBe(entry.info.description);
      expect(record.limitations).toEqual(entry.info.limitations);
      expect(record.validated).toBe(entry.info.validated);
      expect(record.exists).toBe(entry.availability === "available");
      if (record.exists) {
        expect(record.name).toBe(entry.info.name);
        expect(record.version).toBe(entry.info.version);
        expect(record.scoreType).toBe(entry.info.scoreType);
      }
    }
    // The simulator is the only record that is not a registered model.
    expect(MODEL_RECORDS.filter((record) => record.id === null).map((record) => record.kind)).toEqual(["simulator"]);
    expect(MODEL_RECORDS).toHaveLength(registry.length + 1);
  });

  it("never marks anything as validated and keeps the validated ISL slot empty", () => {
    expect(MODEL_RECORDS.every((record) => record.validated === false)).toBe(true);
    const slot = MODEL_RECORDS.find((record) => record.kind === "validated_isl");
    expect(slot?.exists).toBe(false);
    expect(slot?.requires.length).toBeGreaterThan(0);
  });
});

describe("links from the transcribed notes into the JSON records", () => {
  const data = loadResearchData();
  const referenceIds = new Set(data.references.map((item) => item.id));
  const roadmapIds = new Set(data.roadmap.map((item) => item.id));
  const benchmarkIds = new Set(data.benchmarks.map((item) => item.id));

  it("cites only references that exist", () => {
    for (const fact of ESTABLISHED_FACTS) {
      for (const id of fact.referenceIds) expect(referenceIds.has(id), id).toBe(true);
    }
  });

  it("points experiment plans at roadmap items that exist", () => {
    for (const plan of EXPERIMENT_PLANS) {
      if (plan.roadmapId) expect(roadmapIds.has(plan.roadmapId), plan.roadmapId).toBe(true);
    }
  });

  it("attaches legacy audit findings only to benchmarks that exist", () => {
    for (const id of Object.keys(LEGACY_AUDIT)) expect(benchmarkIds.has(id), id).toBe(true);
  });

  it("has unique ids for assumptions, plans and pipeline stages", () => {
    for (const ids of [
      ASSUMPTIONS.map((item) => item.id),
      EXPERIMENT_PLANS.map((item) => item.id),
      PIPELINE_STAGES.map((item) => item.id as string),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
