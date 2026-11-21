import { describe, expect, it } from "vitest";
import { ModelLoadError, defaultModelUrlPolicy } from "../models/exportedModel";
import { NO_VALIDATED_ISL_MODEL, VALIDATED_ISL_MODEL_URLS, ValidatedIslModel } from "../models/validatedIsl";
import {
  MODEL_IDS,
  MODEL_KIND_LABELS,
  createModel,
  isRegisteredModelId,
  listModels,
  probeValidatedIslModel,
  resolveDefaultModel,
  selectDefaultModelId,
} from "../registry";
import { MemorySampleBackend, SampleStore } from "../sampleStore";
import { makeFeatures } from "./testUtils";

const policy = defaultModelUrlPolicy("https://app.example");
const notFound = (async () => new Response("Not found", { status: 404 })) as typeof fetch;

/** A structurally valid one-hand model file with made-up weights (test only). */
function oneHandFile(overrides: Record<string, unknown> = {}): string {
  const zeros = (n: number) => new Array<number>(n).fill(0);
  return JSON.stringify({
    format: "rtslr-model-1",
    featureSchema: "rtslr-features-1",
    info: {
      id: "file-model",
      version: "9.9.9",
      name: "Unit-test file",
      signLanguage: "ISL",
      kind: "validated_isl",
      input: "single_hand_static",
      scoreType: "classifier_score",
      validated: true,
      classes: [
        { classId: "p", label: "P", hands: 1, motion: "static" },
        { classId: "q", label: "Q", hands: 1, motion: "static" },
      ],
      description: "Made-up weights for a unit test.",
      limitations: ["Unit-test fixture."],
    },
    type: "mlp",
    inputDim: 63,
    classes: ["p", "q"],
    standardizer: null,
    mlp: { layers: [{ W: [zeros(63).map((_, i) => (i === 0 ? 5 : 0)), zeros(63)], b: [0, 0], activation: "softmax" }] },
    evaluation: { protocol: "unit test", metrics: { n: 0 }, datasetId: "none", date: "2026-01-01" },
    ...overrides,
  });
}

function serving(files: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const body = files[path];
    return body === undefined ? new Response("Not found", { status: 404 }) : new Response(body, { status: 200 });
  }) as typeof fetch;
}

describe("registry", () => {
  it("lists the three models with honest kinds, and the validated ISL model as not available", () => {
    const models = listModels();
    expect(models.map((m) => [m.id, m.info.kind, m.info.signLanguage, m.availability])).toEqual([
      [MODEL_IDS.validatedIsl, "validated_isl", "ISL", "not_available"],
      [MODEL_IDS.islUser, "experimental_isl_user_trained", "ISL", "available"],
      [MODEL_IDS.legacyAsl, "legacy_asl_prototype", "ASL", "available"],
    ]);
    expect(models[0].unavailableReason).toBe(NO_VALIDATED_ISL_MODEL);
    expect(models[0].info.validated).toBe(false);
    expect(models.every((m) => m.info.validated === false)).toBe(true);
    expect(models.every((m) => m.info.scoreType === "classifier_score")).toBe(true);
    expect(models.map((m) => m.kindLabel)).toEqual([
      MODEL_KIND_LABELS.validated_isl,
      MODEL_KIND_LABELS.experimental_isl_user_trained,
      MODEL_KIND_LABELS.legacy_asl_prototype,
    ]);
    expect(MODEL_KIND_LABELS.legacy_asl_prototype).toMatch(/not ISL/);
    expect(MODEL_KIND_LABELS.experimental_isl_user_trained).toMatch(/not validated/);
  });

  it("defaults to the experimental ISL model today and never to the ASL prototype", () => {
    expect(selectDefaultModelId(false)).toBe(MODEL_IDS.islUser);
    expect(selectDefaultModelId(true)).toBe(MODEL_IDS.validatedIsl);
    const defaults = listModels().filter((m) => m.isDefault);
    expect(defaults.map((m) => m.id)).toEqual([MODEL_IDS.islUser]);
  });

  it("creates each registered model and rejects unknown ids", () => {
    const store = new SampleStore(new MemorySampleBackend());
    expect(createModel(MODEL_IDS.islUser, { store }).info.kind).toBe("experimental_isl_user_trained");
    expect(createModel(MODEL_IDS.legacyAsl).info.kind).toBe("legacy_asl_prototype");
    expect(createModel(MODEL_IDS.validatedIsl).info.kind).toBe("validated_isl");
    expect(() => createModel("nope")).toThrow(/Unknown model id/);
    expect(isRegisteredModelId(MODEL_IDS.islUser)).toBe(true);
    expect(isRegisteredModelId("__proto__")).toBe(false);
  });
});

describe("validated ISL model slot", () => {
  it("with no model file: probe says so plainly, default stays experimental", async () => {
    const probe = await probeValidatedIslModel({ policy, fetchImpl: notFound });
    expect(probe.available).toBe(false);
    expect(probe.message).toBe(NO_VALIDATED_ISL_MODEL);
    expect(probe.oneHand).toMatchObject({ url: VALIDATED_ISL_MODEL_URLS.oneHand, status: "missing" });
    expect(probe.twoHand.status).toBe("missing");

    const resolved = await resolveDefaultModel({ policy, fetchImpl: notFound });
    expect(resolved.modelId).toBe(MODEL_IDS.islUser);
    expect(resolved.models[0].availability).toBe("not_available");
  });

  it("with no model file: load() rejects with not_found and predict stays honest", async () => {
    const model = new ValidatedIslModel({ policy, fetchImpl: notFound });
    await expect(model.load()).rejects.toMatchObject({ name: "ModelLoadError", code: "not_found", message: NO_VALIDATED_ISL_MODEL });
    const result = model.predict(makeFeatures(1));
    expect(result).toMatchObject({ status: "unsupported", classId: null, reason: NO_VALIDATED_ISL_MODEL });
    expect(model.info.validated).toBe(false);
  });

  it("never throws when there is no browser origin (server render)", async () => {
    const probe = await probeValidatedIslModel({ fetchImpl: notFound });
    expect(probe.available).toBe(false);
  });

  it("does not accept a file without an evaluation block as validated", async () => {
    const fetchImpl = serving({ [VALIDATED_ISL_MODEL_URLS.oneHand]: oneHandFile({ evaluation: null }) });
    const probe = await probeValidatedIslModel({ policy, fetchImpl });
    expect(probe.available).toBe(false);
    expect(probe.oneHand.status).toBe("rejected");
    expect(probe.message).toMatch(/no documented evaluation/);
    const model = new ValidatedIslModel({ policy, fetchImpl });
    await expect(model.load()).rejects.toBeInstanceOf(ModelLoadError);
    await expect(model.load()).rejects.toMatchObject({ code: "invalid" });
  });

  it("does not accept a synthetic, malformed or wrong-dimension file", async () => {
    for (const body of [
      JSON.stringify({ ...JSON.parse(oneHandFile()), synthetic: true }),
      "{not json",
      oneHandFile({ inputDim: 156 }),
    ]) {
      const probe = await probeValidatedIslModel({ policy, fetchImpl: serving({ [VALIDATED_ISL_MODEL_URLS.oneHand]: body }) });
      expect(probe.available).toBe(false);
      expect(probe.oneHand.status).toBe("rejected");
    }
    // A valid one-hand file served at the two-hand address is refused as well.
    const swapped = await probeValidatedIslModel({ policy, fetchImpl: serving({ [VALIDATED_ISL_MODEL_URLS.twoHand]: oneHandFile() }) });
    expect(swapped.available).toBe(false);
    expect(swapped.twoHand.detail).toMatch(/156-D/);
  });

  it("when a validated file is published it becomes the default and routes by hand count", async () => {
    const fetchImpl = serving({ [VALIDATED_ISL_MODEL_URLS.oneHand]: oneHandFile() });
    const resolved = await resolveDefaultModel({ policy, fetchImpl });
    expect(resolved.modelId).toBe(MODEL_IDS.validatedIsl);
    expect(resolved.models.find((m) => m.isDefault)?.id).toBe(MODEL_IDS.validatedIsl);

    const model = createModel(MODEL_IDS.validatedIsl, { validatedIsl: { policy, fetchImpl } });
    await model.load();
    expect(model.info).toMatchObject({ id: MODEL_IDS.validatedIsl, kind: "validated_isl", validated: true, version: "9.9.9" });

    const vector = new Float32Array(63);
    vector[0] = 1;
    const one = model.predict(makeFeatures(1, { vectors: [vector] }));
    expect(one).toMatchObject({ status: "recognized", classId: "p", modelId: MODEL_IDS.validatedIsl, handsUsed: 1 });
    // Only a one-hand model exists: two hands are unsupported, not guessed per hand.
    const two = model.predict(makeFeatures(2, { vectors: [vector, vector] }));
    expect(two.status).toBe("unsupported");
    expect(two.classId).toBeNull();
  });
});
