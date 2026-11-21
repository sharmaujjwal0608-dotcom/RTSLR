/** Pure filter logic for the dataset explorer. */
import type { Dataset, DatasetMotion } from "./types";

export type VerificationFilter = "all" | "verified" | "unverified";

export type DatasetFilter = {
  /** "all" or an exact `signLanguage` value. */
  language: string;
  /** "all" or an exact `staticOrDynamic` value. */
  motion: "all" | DatasetMotion;
  verification: VerificationFilter;
  /** Free text matched against the name, classes, licence and description. */
  query: string;
};

export const EMPTY_DATASET_FILTER: DatasetFilter = {
  language: "all",
  motion: "all",
  verification: "all",
  query: "",
};

export function isFilterActive(filter: DatasetFilter): boolean {
  return (
    filter.language !== "all" ||
    filter.motion !== "all" ||
    filter.verification !== "all" ||
    filter.query.trim() !== ""
  );
}

function normalise(text: string): string {
  return text.toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

/**
 * Returns the datasets that match every active criterion, in their original
 * order. Every word of the query must occur somewhere in the searched text.
 */
export function filterDatasets(datasets: readonly Dataset[], filter: DatasetFilter): Dataset[] {
  const words = normalise(filter.query).split(" ").filter(Boolean);
  return datasets.filter((dataset) => {
    if (filter.language !== "all" && dataset.signLanguage !== filter.language) return false;
    if (filter.motion !== "all" && dataset.staticOrDynamic !== filter.motion) return false;
    if (filter.verification === "verified" && !dataset.verified) return false;
    if (filter.verification === "unverified" && dataset.verified) return false;
    if (words.length === 0) return true;
    const haystack = normalise(
      [dataset.name, dataset.classes, dataset.license, dataset.description, dataset.modality].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

const MOTION_ORDER: DatasetMotion[] = ["static", "dynamic", "both"];

/** Option values that actually occur in the data, so no filter leads nowhere. */
export function datasetFilterOptions(datasets: readonly Dataset[]): {
  languages: string[];
  motions: DatasetMotion[];
} {
  const languages = [...new Set(datasets.map((dataset) => dataset.signLanguage))].sort((a, b) => a.localeCompare(b));
  const present = new Set(datasets.map((dataset) => dataset.staticOrDynamic));
  return { languages, motions: MOTION_ORDER.filter((motion) => present.has(motion)) };
}
