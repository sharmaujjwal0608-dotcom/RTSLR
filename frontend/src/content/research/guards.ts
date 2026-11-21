/**
 * Hand-written validators for the research records. Each `check*` function
 * returns a list of problems (empty when the value is valid); each `is*`
 * function is the matching type guard. `parseResearchData` validates all five
 * files plus the links between them and throws on the first invalid file, so
 * a malformed record fails the build instead of reaching the page.
 */
import type {
  Dataset,
  ExperimentMetric,
  PublishedBenchmark,
  Reference,
  ResearchData,
  RoadmapItem,
  RtslrExperiment,
} from "./types";

type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Only http and https links are ever rendered as links. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Collects problems for one object, field by field. */
class Checker {
  readonly problems: string[] = [];
  constructor(private readonly rec: Rec) {}

  text(...keys: string[]): this {
    for (const key of keys) {
      if (!isText(this.rec[key])) this.problems.push(`${key}: expected a non-empty string`);
    }
    return this;
  }

  bool(...keys: string[]): this {
    for (const key of keys) {
      if (typeof this.rec[key] !== "boolean") this.problems.push(`${key}: expected true or false`);
    }
    return this;
  }

  number(...keys: string[]): this {
    for (const key of keys) {
      if (!isFiniteNumber(this.rec[key])) this.problems.push(`${key}: expected a finite number`);
    }
    return this;
  }

  count(...keys: string[]): this {
    for (const key of keys) {
      const value = this.rec[key];
      if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 0) {
        this.problems.push(`${key}: expected a whole number of 0 or more`);
      }
    }
    return this;
  }

  url(key: string): this {
    if (!isHttpUrl(this.rec[key])) this.problems.push(`${key}: expected an http(s) URL`);
    return this;
  }

  oneOf(key: string, allowed: readonly string[]): this {
    const value = this.rec[key];
    if (typeof value !== "string" || !allowed.includes(value)) {
      this.problems.push(`${key}: expected one of ${allowed.join(", ")}`);
    }
    return this;
  }

  textArray(key: string, allowEmpty: boolean): this {
    const value = this.rec[key];
    if (!Array.isArray(value) || !value.every(isText) || (!allowEmpty && value.length === 0)) {
      this.problems.push(`${key}: expected an array of non-empty strings`);
    }
    return this;
  }

  check(ok: boolean, problem: string): this {
    if (!ok) this.problems.push(problem);
    return this;
  }
}

const NOT_AN_OBJECT = ["expected an object"];

export function checkReference(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  return new Checker(value)
    .text("id", "title", "venue", "summary", "verificationNote")
    .textArray("authors", false)
    .url("url")
    .bool("verified")
    .check(
      value.year === null || (isFiniteNumber(value.year) && Number.isInteger(value.year)),
      "year: expected a whole number or null",
    ).problems;
}

export function checkDataset(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  return new Checker(value)
    .text(
      "id",
      "name",
      "signLanguage",
      "description",
      "classes",
      "size",
      "signers",
      "modality",
      "license",
      "limitations",
      "verificationNote",
    )
    .oneOf("staticOrDynamic", ["static", "dynamic", "both"])
    .url("url")
    .bool("verified", "usedByRtslr").problems;
}

export function checkPublishedBenchmark(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  return new Checker(value)
    .text("id", "referenceId", "signLanguage", "task", "method", "metricName", "dataset", "evaluationProtocol", "caveat")
    .number("metricValue")
    .check(
      value.classes === null || (isFiniteNumber(value.classes) && Number.isInteger(value.classes) && value.classes > 0),
      "classes: expected a positive whole number or null",
    ).problems;
}

export function checkRoadmapItem(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  return new Checker(value)
    .text("id", "phase", "title", "description")
    .oneOf("status", ["done", "in_progress", "planned"])
    .textArray("dependsOn", true).problems;
}

export function checkExperimentMetric(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  return new Checker(value)
    .text("name")
    .number("value")
    .check(typeof value.unit === "string", "unit: expected a string (may be empty)")
    .check(value.spread === null || isFiniteNumber(value.spread), "spread: expected a finite number or null").problems;
}

export function checkRtslrExperiment(value: unknown): string[] {
  if (!isRecord(value)) return NOT_AN_OBJECT;
  const checker = new Checker(value)
    .text("id", "experimentId", "title", "commit", "datasetVersion", "protocol", "featureVersion", "artefactsUrl")
    .count("signers", "samples")
    .number("seed")
    .check(isIsoDate(value.date), "date: expected a real date as YYYY-MM-DD")
    .check(value.notes === undefined || typeof value.notes === "string", "notes: expected a string when present");
  const metrics = value.metrics;
  if (!Array.isArray(metrics) || metrics.length === 0) {
    checker.problems.push("metrics: expected at least one metric (no entry without results)");
  } else {
    metrics.forEach((metric, index) => {
      for (const problem of checkExperimentMetric(metric)) checker.problems.push(`metrics[${index}].${problem}`);
    });
  }
  return checker.problems;
}

export const isReference = (value: unknown): value is Reference => checkReference(value).length === 0;
export const isDataset = (value: unknown): value is Dataset => checkDataset(value).length === 0;
export const isPublishedBenchmark = (value: unknown): value is PublishedBenchmark =>
  checkPublishedBenchmark(value).length === 0;
export const isRoadmapItem = (value: unknown): value is RoadmapItem => checkRoadmapItem(value).length === 0;
export const isExperimentMetric = (value: unknown): value is ExperimentMetric =>
  checkExperimentMetric(value).length === 0;
export const isRtslrExperiment = (value: unknown): value is RtslrExperiment =>
  checkRtslrExperiment(value).length === 0;

/** Thrown when a research file does not match its schema. */
export class ResearchDataError extends Error {
  constructor(
    readonly file: string,
    readonly problems: string[],
  ) {
    super(`Invalid research data in ${file}:\n- ${problems.join("\n- ")}`);
    this.name = "ResearchDataError";
  }
}

/**
 * Validates one file: an array whose records all pass `check` and whose ids
 * are unique. Returns the same array, typed.
 */
export function parseRecords<T extends { id: string }>(
  file: string,
  data: unknown,
  check: (value: unknown) => string[],
): T[] {
  if (!Array.isArray(data)) throw new ResearchDataError(file, ["expected a JSON array"]);
  const problems: string[] = [];
  const seen = new Set<string>();
  data.forEach((record: unknown, index) => {
    const label = isRecord(record) && typeof record.id === "string" ? `[${index}] ${record.id}` : `[${index}]`;
    for (const problem of check(record)) problems.push(`${label}: ${problem}`);
    if (isRecord(record) && typeof record.id === "string") {
      if (seen.has(record.id)) problems.push(`${label}: duplicate id`);
      seen.add(record.id);
    }
  });
  if (problems.length > 0) throw new ResearchDataError(file, problems);
  return data as T[];
}

export type RawResearchData = {
  references: unknown;
  datasets: unknown;
  benchmarks: unknown;
  roadmap: unknown;
  experiments: unknown;
};

/** Validates all five files and the links between them. */
export function parseResearchData(raw: RawResearchData): ResearchData {
  const references = parseRecords<Reference>("references.json", raw.references, checkReference);
  const datasets = parseRecords<Dataset>("datasets.json", raw.datasets, checkDataset);
  const benchmarks = parseRecords<PublishedBenchmark>(
    "published-benchmarks.json",
    raw.benchmarks,
    checkPublishedBenchmark,
  );
  const roadmap = parseRecords<RoadmapItem>("roadmap.json", raw.roadmap, checkRoadmapItem);
  const experiments = parseRecords<RtslrExperiment>("rtslr-experiments.json", raw.experiments, checkRtslrExperiment);

  const referenceIds = new Set(references.map((reference) => reference.id));
  const missingReferences = benchmarks
    .filter((benchmark) => !referenceIds.has(benchmark.referenceId))
    .map((benchmark) => `${benchmark.id}: referenceId "${benchmark.referenceId}" is not in references.json`);
  if (missingReferences.length > 0) throw new ResearchDataError("published-benchmarks.json", missingReferences);

  const roadmapIds = new Set(roadmap.map((item) => item.id));
  const brokenDependencies = roadmap.flatMap((item) =>
    item.dependsOn
      .filter((id) => !roadmapIds.has(id) || id === item.id)
      .map((id) => `${item.id}: dependsOn "${id}" is not another roadmap item`),
  );
  if (brokenDependencies.length > 0) throw new ResearchDataError("roadmap.json", brokenDependencies);

  return { references, datasets, benchmarks, roadmap, experiments };
}
