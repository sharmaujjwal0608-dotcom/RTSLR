/**
 * Model registry: what the app can run, what each thing honestly is, and
 * which one is selected by default.
 *
 * Default selection:
 *   1. the validated ISL model, if a validated model file exists (none today);
 *   2. otherwise the legacy ASL prototype (project decision: ASL is the default
 *      sign language until a validated ISL model exists).
 * The experimental user-trained model (ASL samples) is offered separately.
 */

import type { ModelInfo, ModelKind, SignModel } from "../../types/recognition";
import { ISL_USER_INFO, ISL_USER_MODEL_ID, IslUserTemplatesModel, type KnnOptions } from "./models/islUserTemplates";
import { LEGACY_ASL_INFO, LEGACY_ASL_MODEL_ID, LegacyAslModel } from "./models/legacyAsl";
import {
  NO_VALIDATED_ISL_MODEL,
  VALIDATED_ISL_MODEL_ID,
  VALIDATED_ISL_PLACEHOLDER_INFO,
  ValidatedIslModel,
  probeValidatedIslModel,
  type ValidatedIslDeps,
  type ValidatedIslProbe,
} from "./models/validatedIsl";
import { getSampleStore, type SampleStore } from "./sampleStore";

export const MODEL_IDS = {
  validatedIsl: VALIDATED_ISL_MODEL_ID,
  islUser: ISL_USER_MODEL_ID,
  legacyAsl: LEGACY_ASL_MODEL_ID,
} as const;

export type RegisteredModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

/**
 * Short, honest badge text for each kind of model (English). The interface
 * should show the badge for the active model at all times and may translate it
 * by `kind`.
 */
export const MODEL_KIND_LABELS: Readonly<Record<ModelKind, string>> = {
  validated_isl: "Validated ISL model",
  experimental_isl_user_trained: "Experimental — trained from your own samples, not validated",
  legacy_asl_prototype: "Legacy ASL prototype — not ISL, not validated",
  simulator: "Simulator — synthetic data, not recognition",
};

export type ModelAvailability = "available" | "not_available";

export type RegistryEntry = {
  id: RegisteredModelId;
  /** Static description. For the live class list use the loaded model's `info`. */
  info: ModelInfo;
  kindLabel: string;
  availability: ModelAvailability;
  /** Set when availability is "not_available". */
  unavailableReason: string | null;
  /** True for exactly one entry: the one `selectDefaultModelId` returns. */
  isDefault: boolean;
};

export function isRegisteredModelId(id: string): id is RegisteredModelId {
  return id === MODEL_IDS.validatedIsl || id === MODEL_IDS.islUser || id === MODEL_IDS.legacyAsl;
}

/**
 * Pure default-selection rule.
 * @param validatedIslAvailable result of `probeValidatedIslModel().available` (false today).
 */
export function selectDefaultModelId(validatedIslAvailable: boolean): RegisteredModelId {
  return validatedIslAvailable ? MODEL_IDS.validatedIsl : MODEL_IDS.legacyAsl;
}

/**
 * Every model the app knows, in display order. Pass the probe result when you
 * have it; without it the validated ISL model is listed as not available,
 * which is the truth until a model file is published.
 */
export function listModels(probe?: ValidatedIslProbe | null): RegistryEntry[] {
  const validatedAvailable = probe?.available === true;
  const defaultId = selectDefaultModelId(validatedAvailable);
  const entries: Omit<RegistryEntry, "isDefault" | "kindLabel">[] = [
    {
      id: MODEL_IDS.validatedIsl,
      info: VALIDATED_ISL_PLACEHOLDER_INFO,
      availability: validatedAvailable ? "available" : "not_available",
      unavailableReason: validatedAvailable ? null : (probe?.message ?? NO_VALIDATED_ISL_MODEL),
    },
    { id: MODEL_IDS.legacyAsl, info: LEGACY_ASL_INFO, availability: "available", unavailableReason: null },
    { id: MODEL_IDS.islUser, info: ISL_USER_INFO, availability: "available", unavailableReason: null },
  ];
  return entries.map((entry) => ({
    ...entry,
    kindLabel: MODEL_KIND_LABELS[entry.info.kind],
    isDefault: entry.id === defaultId,
  }));
}

export type ModelFactoryDeps = {
  /** Sample store for the experimental ISL model. Defaults to the shared store. */
  store?: SampleStore;
  knn?: Partial<KnnOptions>;
  validatedIsl?: ValidatedIslDeps;
};

/**
 * Creates an unloaded model. Call `load()` before `predict()`.
 * Creating the validated ISL model always succeeds; its `load()` rejects with
 * ModelLoadError ("not_found") while no model file exists.
 */
export function createModel(id: string, deps: ModelFactoryDeps = {}): SignModel {
  switch (id) {
    case MODEL_IDS.validatedIsl:
      return new ValidatedIslModel(deps.validatedIsl);
    case MODEL_IDS.islUser:
      return new IslUserTemplatesModel({ ...deps.knn, store: deps.store ?? getSampleStore() });
    case MODEL_IDS.legacyAsl:
      return new LegacyAslModel();
    default:
      throw new Error(`Unknown model id "${id}"`);
  }
}

export type DefaultModelResolution = {
  modelId: RegisteredModelId;
  probe: ValidatedIslProbe;
  models: RegistryEntry[];
};

/** Probes for a validated model file and applies the default-selection rule. Never throws. */
export async function resolveDefaultModel(deps: ValidatedIslDeps = {}): Promise<DefaultModelResolution> {
  const probe = await probeValidatedIslModel(deps);
  return { modelId: selectDefaultModelId(probe.available), probe, models: listModels(probe) };
}

export { probeValidatedIslModel, NO_VALIDATED_ISL_MODEL };
export type { ValidatedIslProbe };
