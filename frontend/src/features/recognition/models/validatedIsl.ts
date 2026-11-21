/**
 * Validated ISL model slot.
 *
 * NO VALIDATED ISL MODEL EXISTS TODAY. This class is the place one will plug
 * in: it looks for up to two exported files (a one-hand model on 63-D vectors
 * and a two-hand model on 156-D coordinated vectors) under the site's own
 * /models/isl/ folder, and accepts a file only when it carries an evaluation
 * block and is marked validated. With no acceptable file, `load()` rejects
 * with ModelLoadError code "not_found" and the message NO_VALIDATED_ISL_MODEL.
 *
 * Routing is by hand count: one tracked hand goes to the one-hand model, two
 * tracked hands go to the two-hand model as a single coordinated vector. The
 * two models are never combined into one answer.
 */

import type { FrameFeatures, ModelInfo, RecognitionResult, SignModel } from "../../../types/recognition";
import { REASONS } from "../reasons";
import {
  ExportedSignModel,
  ModelLoadError,
  defaultModelUrlPolicy,
  loadExportedModel,
  type ModelUrlPolicy,
  type ParsedExportedModel,
} from "./exportedModel";

export const VALIDATED_ISL_MODEL_ID = "rtslr-isl-static";

/** Fixed, same-origin addresses built by the app itself (MOD-02). */
export const VALIDATED_ISL_MODEL_URLS = {
  oneHand: "/models/isl/static-one-hand.json",
  twoHand: "/models/isl/static-two-hand.json",
} as const;

export const NO_VALIDATED_ISL_MODEL =
  "No validated ISL model is available. None has been trained yet: the project has no authorised ISL dataset.";

export const VALIDATED_ISL_PLACEHOLDER_INFO: ModelInfo = {
  id: VALIDATED_ISL_MODEL_ID,
  version: "0.0.0",
  name: "Validated ISL model (not available)",
  signLanguage: "ISL",
  kind: "validated_isl",
  input: "single_or_dual_static",
  scoreType: "classifier_score",
  validated: false,
  classes: [],
  description: NO_VALIDATED_ISL_MODEL,
  limitations: ["This model does not exist yet. Nothing is recognised until a trained and evaluated model file is published."],
};

export type ValidatedIslPart = {
  url: string;
  /**
   * loaded: accepted. missing: no file at the address (the normal state today).
   * rejected: a file exists but failed a check. unreachable: the address could not be checked.
   */
  status: "loaded" | "missing" | "rejected" | "unreachable";
  /** Why a present file was not accepted, or how the download failed. */
  detail: string | null;
};

export type ValidatedIslProbe = {
  available: boolean;
  /** Plain statement for the interface. */
  message: string;
  oneHand: ValidatedIslPart;
  twoHand: ValidatedIslPart;
};

export type ValidatedIslDeps = {
  policy?: ModelUrlPolicy;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  urls?: { oneHand: string; twoHand: string };
};

type LoadedPart = { part: ValidatedIslPart; model: ParsedExportedModel | null };

function pageOrigin(): string {
  const location = (globalThis as { location?: { origin?: string } }).location;
  if (!location?.origin || location.origin === "null") {
    throw new ModelLoadError("Model files can only be loaded in the browser.", "blocked_url");
  }
  return location.origin;
}

async function loadPart(url: string, expectedDim: number, deps: ValidatedIslDeps): Promise<LoadedPart> {
  try {
    const policy = deps.policy ?? defaultModelUrlPolicy(pageOrigin());
    const model = await loadExportedModel(url, { policy, fetchImpl: deps.fetchImpl, signal: deps.signal });
    if (model.inputDim !== expectedDim) {
      return { model: null, part: { url, status: "rejected", detail: `Expected a ${expectedDim}-D model, found ${model.inputDim}-D.` } };
    }
    if (model.info.signLanguage !== "ISL") {
      return { model: null, part: { url, status: "rejected", detail: "The file is not an ISL model." } };
    }
    if (!model.info.validated || model.evaluation === null) {
      return {
        model: null,
        part: { url, status: "rejected", detail: "The file carries no documented evaluation, so it is not treated as validated." },
      };
    }
    return { model, part: { url, status: "loaded", detail: null } };
  } catch (error) {
    const code = error instanceof ModelLoadError ? error.code : "invalid";
    const detail = error instanceof Error ? error.message : String(error);
    const status =
      code === "not_found"
        ? "missing"
        : code === "network" || code === "http_error" || code === "blocked_url"
          ? "unreachable"
          : "rejected";
    return { model: null, part: { url, status, detail } };
  }
}

async function loadParts(deps: ValidatedIslDeps): Promise<{ one: LoadedPart; two: LoadedPart; probe: ValidatedIslProbe }> {
  const urls = deps.urls ?? VALIDATED_ISL_MODEL_URLS;
  const [one, two] = await Promise.all([loadPart(urls.oneHand, 63, deps), loadPart(urls.twoHand, 156, deps)]);
  const available = one.model !== null || two.model !== null;
  const details = (status: ValidatedIslPart["status"]) =>
    [...new Set([one.part, two.part].filter((p) => p.status === status).map((p) => p.detail))].join(" ");
  const rejected = details("rejected");
  const unreachable = details("unreachable");
  let message = "A validated ISL model file is available.";
  if (!available) {
    message = NO_VALIDATED_ISL_MODEL;
    if (rejected) message += ` A model file was found but could not be used: ${rejected}`;
    if (unreachable) message += ` The model location could not be checked: ${unreachable}`;
  }
  return { one, two, probe: { available, message, oneHand: one.part, twoHand: two.part } };
}

/** Checks whether a usable validated ISL model file exists. Never throws. */
export async function probeValidatedIslModel(deps: ValidatedIslDeps = {}): Promise<ValidatedIslProbe> {
  return (await loadParts(deps)).probe;
}

export class ValidatedIslModel implements SignModel {
  private oneHand: ExportedSignModel | null = null;
  private twoHand: ExportedSignModel | null = null;
  private currentInfo: ModelInfo = VALIDATED_ISL_PLACEHOLDER_INFO;

  constructor(private readonly deps: ValidatedIslDeps = {}) {}

  get info(): ModelInfo {
    return this.currentInfo;
  }

  async load(): Promise<void> {
    const { one, two, probe } = await loadParts(this.deps);
    if (!probe.available) {
      const statuses = [probe.oneHand.status, probe.twoHand.status];
      const code = statuses.includes("rejected") ? "invalid" : statuses.includes("unreachable") ? "network" : "not_found";
      throw new ModelLoadError(probe.message, code);
    }
    this.oneHand = one.model ? new ExportedSignModel({ parsed: one.model }) : null;
    this.twoHand = two.model ? new ExportedSignModel({ parsed: two.model }) : null;
    const parts = [one.model, two.model].filter((m): m is ParsedExportedModel => m !== null);
    const first = parts[0].info;
    this.currentInfo = {
      id: VALIDATED_ISL_MODEL_ID,
      version: parts.map((m) => m.info.version).join("+"),
      name: parts.length === 1 ? first.name : "Validated ISL static signs (one-hand and two-hand models)",
      signLanguage: "ISL",
      kind: "validated_isl",
      input: parts.length === 2 ? "single_or_dual_static" : first.input,
      // Only call scores probabilities when every part does.
      scoreType: parts.every((m) => m.info.scoreType === "calibrated_probability") ? "calibrated_probability" : "classifier_score",
      validated: true,
      classes: parts.flatMap((m) => m.info.classes),
      description: parts.map((m) => m.info.description).join(" "),
      limitations: [...new Set(parts.flatMap((m) => m.info.limitations))],
    };
  }

  reset(): void {
    this.oneHand?.reset();
    this.twoHand?.reset();
  }

  dispose(): void {
    this.oneHand = null;
    this.twoHand = null;
    this.currentInfo = VALIDATED_ISL_PLACEHOLDER_INFO;
  }

  predict(features: FrameFeatures): RecognitionResult {
    const base: Omit<RecognitionResult, "status" | "handsUsed"> = {
      modelId: this.currentInfo.id,
      modelVersion: this.currentInfo.version,
      signLanguage: this.currentInfo.signLanguage,
      timestamp: features.timestamp,
      classId: null,
      label: null,
      score: null,
      scoreType: null,
      candidates: [],
    };
    if (features.handCount === 0) return { ...base, status: "no_hands", handsUsed: 0 };

    const part = features.handCount === 2 ? this.twoHand : this.oneHand;
    if (!part) {
      const reason =
        !this.oneHand && !this.twoHand
          ? NO_VALIDATED_ISL_MODEL
          : features.handCount === 2
            ? REASONS.exportedNeedsOneHand
            : REASONS.exportedNeedsTwoHands;
      return { ...base, status: "unsupported", handsUsed: 0, reason };
    }
    const result = part.predict(features);
    return { ...result, modelId: this.currentInfo.id, modelVersion: this.currentInfo.version };
  }
}
