/**
 * Typed loader for the research records shown on /research.
 *
 * The JSON files under `./data` are copies of `RTSLR/research/data/*.json`
 * made by `frontend/scripts/sync-research-data.mjs`. Do not edit the copies.
 * No browser-only code is imported here, so server components can use it.
 */
import datasetsJson from "./data/datasets.json";
import benchmarksJson from "./data/published-benchmarks.json";
import referencesJson from "./data/references.json";
import roadmapJson from "./data/roadmap.json";
import experimentsJson from "./data/rtslr-experiments.json";
import { parseResearchData } from "./guards";
import type { ResearchData } from "./types";

let cached: ResearchData | null = null;

/** Validates on first use and throws `ResearchDataError` if a file is malformed. */
export function loadResearchData(): ResearchData {
  cached ??= parseResearchData({
    references: referencesJson,
    datasets: datasetsJson,
    benchmarks: benchmarksJson,
    roadmap: roadmapJson,
    experiments: experimentsJson,
  });
  return cached;
}

/** Date on which the sources were last checked (docs/RESEARCH_NOTES.md, header). */
export const SOURCES_CHECKED_ON = "2026-11-21";

export * from "./types";
export { ResearchDataError } from "./guards";
