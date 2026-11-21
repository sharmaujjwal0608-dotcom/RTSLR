import { describe, expect, it } from "vitest";
import {
  EMPTY_DATASET_FILTER,
  datasetFilterOptions,
  filterDatasets,
  isFilterActive,
  type DatasetFilter,
} from "./datasetFilter";
import type { Dataset } from "./types";

function make(id: string, patch: Partial<Dataset>): Dataset {
  return {
    id,
    name: id,
    signLanguage: "ISL",
    description: "",
    classes: "",
    size: "",
    signers: "",
    modality: "RGB video",
    staticOrDynamic: "dynamic",
    license: "licence not stated on source page",
    url: "https://example.org",
    limitations: "",
    verified: true,
    verificationNote: "note",
    usedByRtslr: false,
    ...patch,
  };
}

const datasets: Dataset[] = [
  make("words", { name: "Word videos", classes: "263 word signs", license: "CC BY 4.0" }),
  make("letters", {
    name: "Fingerspelling images",
    classes: "A-Z and digits",
    staticOrDynamic: "static",
    license: "Creative Commons Attribution",
    modality: "RGB images",
  }),
  make("dictionary", { name: "Dictionary", staticOrDynamic: "both", verified: false }),
  make("asl", { name: "Other language set", signLanguage: "ASL", staticOrDynamic: "static", verified: false }),
];

const ids = (filter: Partial<DatasetFilter>) =>
  filterDatasets(datasets, { ...EMPTY_DATASET_FILTER, ...filter }).map((item) => item.id);

describe("filterDatasets", () => {
  it("returns everything, in order, for the empty filter", () => {
    expect(ids({})).toEqual(["words", "letters", "dictionary", "asl"]);
  });

  it("filters by sign language", () => {
    expect(ids({ language: "ASL" })).toEqual(["asl"]);
    expect(ids({ language: "ISL" })).toEqual(["words", "letters", "dictionary"]);
  });

  it("filters by sign type using the exact recorded value", () => {
    expect(ids({ motion: "static" })).toEqual(["letters", "asl"]);
    expect(ids({ motion: "dynamic" })).toEqual(["words"]);
    expect(ids({ motion: "both" })).toEqual(["dictionary"]);
  });

  it("filters by verification state", () => {
    expect(ids({ verification: "verified" })).toEqual(["words", "letters"]);
    expect(ids({ verification: "unverified" })).toEqual(["dictionary", "asl"]);
  });

  it("combines criteria with AND", () => {
    expect(ids({ motion: "static", verification: "verified" })).toEqual(["letters"]);
    expect(ids({ language: "ASL", verification: "verified" })).toEqual([]);
  });

  it("searches name, classes, licence, description and modality, ignoring case and extra spaces", () => {
    expect(ids({ query: "FINGERSPELLING" })).toEqual(["letters"]);
    expect(ids({ query: "  cc   by " })).toEqual(["words"]);
    expect(ids({ query: "digits" })).toEqual(["letters"]);
    expect(ids({ query: "images" })).toEqual(["letters"]);
    expect(ids({ query: "no such thing" })).toEqual([]);
  });

  it("requires every word of the query", () => {
    expect(ids({ query: "word videos" })).toEqual(["words"]);
    expect(ids({ query: "word images" })).toEqual([]);
  });

  it("does not mutate its input", () => {
    const before = datasets.map((item) => item.id);
    ids({ motion: "static" });
    expect(datasets.map((item) => item.id)).toEqual(before);
  });
});

describe("isFilterActive", () => {
  it("is false for the empty filter and for a whitespace-only query", () => {
    expect(isFilterActive(EMPTY_DATASET_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_DATASET_FILTER, query: "   " })).toBe(false);
  });

  it("is true when any criterion is set", () => {
    expect(isFilterActive({ ...EMPTY_DATASET_FILTER, language: "ISL" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_DATASET_FILTER, motion: "static" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_DATASET_FILTER, verification: "unverified" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_DATASET_FILTER, query: "x" })).toBe(true);
  });
});

describe("datasetFilterOptions", () => {
  it("offers only values that occur in the data", () => {
    expect(datasetFilterOptions(datasets)).toEqual({
      languages: ["ASL", "ISL"],
      motions: ["static", "dynamic", "both"],
    });
    expect(datasetFilterOptions([datasets[0]])).toEqual({ languages: ["ISL"], motions: ["dynamic"] });
    expect(datasetFilterOptions([])).toEqual({ languages: [], motions: [] });
  });
});
