/**
 * Shapes of the research records in `research/data/*.json` (owner: Agent 07).
 * The frontend reads copies made by `scripts/sync-research-data.mjs`.
 * Field names follow the JSON files exactly.
 */

export type Reference = {
  id: string;
  title: string;
  authors: string[];
  /** Null for documentation and web pages without a publication year. */
  year: number | null;
  venue: string;
  url: string;
  summary: string;
  verified: boolean;
  verificationNote: string;
};

export type DatasetMotion = "static" | "dynamic" | "both";

export type Dataset = {
  id: string;
  name: string;
  signLanguage: string;
  description: string;
  classes: string;
  size: string;
  signers: string;
  modality: string;
  staticOrDynamic: DatasetMotion;
  /** Licence wording exactly as recorded from the source page. */
  license: string;
  url: string;
  limitations: string;
  verified: boolean;
  verificationNote: string;
  usedByRtslr: boolean;
};

export type PublishedBenchmark = {
  id: string;
  referenceId: string;
  signLanguage: string;
  task: string;
  classes: number | null;
  method: string;
  /** Names the metric and its unit. Metrics differ between rows. */
  metricName: string;
  metricValue: number;
  dataset: string;
  evaluationProtocol: string;
  caveat: string;
};

export type RoadmapStatus = "done" | "in_progress" | "planned";

export type RoadmapItem = {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  dependsOn: string[];
};

export type ExperimentMetric = {
  name: string;
  value: number;
  /** For example "%" or "ms". May be empty. */
  unit: string;
  /** Standard deviation across folds, or null when there is none. */
  spread: number | null;
};

/**
 * One executed RTSLR experiment run. Schema documented in
 * `research/experiments/EXPERIMENT_SPECS.md` ("Recording a result").
 * No such record exists today: `rtslr-experiments.json` is `[]`.
 */
export type RtslrExperiment = {
  id: string;
  /** Specification this run belongs to, e.g. "EXP-002". */
  experimentId: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  commit: string;
  datasetVersion: string;
  signers: number;
  samples: number;
  protocol: string;
  featureVersion: string;
  seed: number;
  metrics: ExperimentMetric[];
  /** http(s) URL or a repository path to the saved artefacts. */
  artefactsUrl: string;
  notes?: string;
};

export type ResearchData = {
  references: Reference[];
  datasets: Dataset[];
  benchmarks: PublishedBenchmark[];
  roadmap: RoadmapItem[];
  experiments: RtslrExperiment[];
};
