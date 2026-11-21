import { describe, expect, it } from "vitest";
import { DUAL_FEATURE_DIM, SINGLE_FEATURE_DIM } from "../../../types/recognition";
import {
  DEFAULT_KNN_OPTIONS,
  ISL_USER_MODEL_ID,
  IslUserTemplatesModel,
  buildTemplateIndex,
  classifyWithTemplates,
} from "../models/islUserTemplates";
import { REASONS } from "../reasons";
import { MemorySampleBackend, SampleStore, type NewSample, type StoredSample } from "../sampleStore";
import { cosineDistance } from "../vectorMath";
import { jitter, makeFeatures, randomVector } from "./testUtils";

// Arbitrary cluster centres. They are random numbers, not sign data.
const ONE_A = randomVector(SINGLE_FEATURE_DIM, 1);
const ONE_B = randomVector(SINGLE_FEATURE_DIM, 2);
const TWO_X = randomVector(DUAL_FEATURE_DIM, 3);
const TWO_Y = randomVector(DUAL_FEATURE_DIM, 4);

function cluster(classId: string, hands: 1 | 2, centre: Float32Array, count: number, seed: number): NewSample[] {
  return Array.from({ length: count }, (_, i) => ({
    classId,
    label: classId.toUpperCase(),
    hands,
    vector: jitter(centre, 0.02, seed + i),
  }));
}

function stored(samples: NewSample[]): StoredSample[] {
  return samples.map((s, i) => ({ ...s, id: `id-${i}`, createdAt: i, vector: Float32Array.from(s.vector) }));
}

async function modelWith(samples: NewSample[]): Promise<{ model: IslUserTemplatesModel; store: SampleStore }> {
  const store = new SampleStore(new MemorySampleBackend());
  if (samples.length > 0) await store.addSamples(samples);
  const model = new IslUserTemplatesModel({ store });
  await model.load();
  return { model, store };
}

describe("k-NN over templates", () => {
  const samples = stored([...cluster("a", 1, ONE_A, 8, 10), ...cluster("b", 1, ONE_B, 8, 50)]);
  const index = buildTemplateIndex(samples, 1);

  it("builds one index per hand count and ignores the other", () => {
    expect(index.sampleCount).toBe(16);
    expect(index.dimension).toBe(63);
    expect(buildTemplateIndex(samples, 2).sampleCount).toBe(0);
  });

  it("recognises a pose close to a recorded class", () => {
    const outcome = classifyWithTemplates(index, jitter(ONE_A, 0.02, 999));
    expect(outcome.status).toBe("recognized");
    if (outcome.status !== "recognized") return;
    expect(outcome.classId).toBe("a");
    expect(outcome.score).toBeGreaterThan(0.9);
    expect(outcome.score).toBeLessThanOrEqual(1);
    expect(outcome.candidates[0].classId).toBe("a");
  });

  it("is scale invariant (cosine)", () => {
    const outcome = classifyWithTemplates(index, jitter(ONE_B, 0.02, 7).map((v) => v * 3.5));
    expect(outcome.status === "recognized" && outcome.classId).toBe("b");
  });

  it("rejects an unknown pose as uncertain instead of naming the nearest class", () => {
    const unknown = randomVector(SINGLE_FEATURE_DIM, 4242);
    const outcome = classifyWithTemplates(index, unknown);
    expect(outcome.status).toBe("uncertain");
    if (outcome.status !== "uncertain") return;
    expect(outcome.classId).toBeNull();
    expect(outcome.reason).toBe(REASONS.islTooFar);
    expect(outcome.nearestDistance).toBeGreaterThan(DEFAULT_KNN_OPTIONS.maxDistance);
    expect(outcome.candidates.length).toBeGreaterThan(0); // alternatives are still listed
  });

  it("rejects a pose halfway between two classes", () => {
    const between = ONE_A.map((v, i) => (v + ONE_B[i]) / 2);
    const outcome = classifyWithTemplates(index, between);
    expect(outcome.status).toBe("uncertain");
  });

  it("the acceptance radius follows the class spread but stays within its bounds", () => {
    const tight = buildTemplateIndex(stored(cluster("a", 1, ONE_A, 8, 10)), 1);
    expect(tight.classes[0].acceptDistance).toBeGreaterThanOrEqual(DEFAULT_KNN_OPTIONS.minDistance);
    expect(tight.classes[0].acceptDistance).toBeLessThanOrEqual(DEFAULT_KNN_OPTIONS.maxDistance);

    const loose = buildTemplateIndex(
      stored(Array.from({ length: 8 }, (_, i) => ({ classId: "a", label: "A", hands: 1 as const, vector: jitter(ONE_A, 0.6, i) }))),
      1,
    );
    expect(loose.classes[0].acceptDistance).toBe(DEFAULT_KNN_OPTIONS.maxDistance);

    const single = buildTemplateIndex(stored(cluster("a", 1, ONE_A, 1, 10)), 1);
    expect(single.classes[0].acceptDistance).toBe(DEFAULT_KNN_OPTIONS.minDistance);
  });

  it("k is configurable and capped by the number of samples", () => {
    const tiny = buildTemplateIndex(stored(cluster("a", 1, ONE_A, 2, 10)), 1);
    const outcome = classifyWithTemplates(tiny, ONE_A, { ...DEFAULT_KNN_OPTIONS, k: 50 });
    expect(outcome.status).toBe("recognized");
  });

  it("with k = 1 the nearest sample decides", () => {
    const mixed = stored([...cluster("a", 1, ONE_A, 1, 10), ...cluster("b", 1, ONE_B, 6, 50)]);
    const idx = buildTemplateIndex(mixed, 1);
    const probe = jitter(ONE_A, 0.005, 3);
    expect(cosineDistance(probe, ONE_A)).toBeLessThan(0.001);
    const outcome = classifyWithTemplates(idx, probe, { ...DEFAULT_KNN_OPTIONS, k: 1 });
    expect(outcome.status === "recognized" && outcome.classId).toBe("a");
  });

  it("throws on a vector of the wrong dimension", () => {
    expect(() => classifyWithTemplates(index, new Float32Array(156))).toThrow(/63-D/);
  });
});

describe("IslUserTemplatesModel", () => {
  it("is labelled as an experimental, unvalidated ISL model", async () => {
    const { model } = await modelWith([]);
    expect(model.info).toMatchObject({
      id: ISL_USER_MODEL_ID,
      kind: "experimental_isl_user_trained",
      signLanguage: "ISL",
      scoreType: "classifier_score",
      validated: false,
      input: "single_or_dual_static",
    });
    expect(model.info.limitations.join(" ")).toMatch(/not validated/i);
  });

  it("returns unsupported with a clear reason when nothing is recorded", async () => {
    const { model } = await modelWith([]);
    const result = model.predict(makeFeatures(1, { vectors: [ONE_A] }));
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe(REASONS.islNoSamples);
    expect(result.classId).toBeNull();
    expect(result.score).toBeNull();
  });

  it("returns unsupported before load()", () => {
    const model = new IslUserTemplatesModel({ store: new SampleStore(new MemorySampleBackend()) });
    expect(model.predict(makeFeatures(1)).reason).toBe(REASONS.islNotLoaded);
  });

  it("returns no_hands for an empty frame", async () => {
    const { model } = await modelWith(cluster("a", 1, ONE_A, 5, 10));
    const result = model.predict(makeFeatures(0));
    expect(result.status).toBe("no_hands");
    expect(result.handsUsed).toBe(0);
  });

  it("matches a one-hand class from the 63-D vector", async () => {
    const { model } = await modelWith([...cluster("a", 1, ONE_A, 6, 10), ...cluster("b", 1, ONE_B, 6, 50)]);
    const result = model.predict(makeFeatures(1, { vectors: [jitter(ONE_B, 0.02, 5)], timestamp: 42 }));
    expect(result).toMatchObject({
      status: "recognized",
      classId: "b",
      label: "B",
      handsUsed: 1,
      scoreType: "classifier_score",
      signLanguage: "ISL",
      modelId: ISL_USER_MODEL_ID,
      timestamp: 42,
    });
  });

  it("matches a two-hand class from the 156-D coordinated vector", async () => {
    const { model } = await modelWith([...cluster("x", 2, TWO_X, 6, 10), ...cluster("y", 2, TWO_Y, 6, 50)]);
    const result = model.predict(makeFeatures(2, { dual: jitter(TWO_Y, 0.02, 5) }));
    expect(result).toMatchObject({ status: "recognized", classId: "y", handsUsed: 2 });
  });

  it("never matches a one-hand class when two hands are shown, even if each hand looks like it", async () => {
    const { model } = await modelWith(cluster("a", 1, ONE_A, 6, 10));
    // Both hands carry exactly the recorded one-hand pose.
    const result = model.predict(makeFeatures(2, { vectors: [ONE_A, ONE_A], dual: TWO_X }));
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe(REASONS.islOnlyOneHandClasses);
    expect(result.classId).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("never matches a two-hand class when one hand is shown", async () => {
    const { model } = await modelWith(cluster("x", 2, TWO_X, 6, 10));
    const result = model.predict(makeFeatures(1, { vectors: [TWO_X.slice(0, 63)] }));
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe(REASONS.islOnlyTwoHandClasses);
  });

  it("with both kinds recorded, the hand count alone selects the candidate set", async () => {
    const { model } = await modelWith([
      ...cluster("a", 1, ONE_A, 6, 10),
      ...cluster("x", 2, TWO_X, 6, 50),
    ]);
    const one = model.predict(makeFeatures(1, { vectors: [jitter(ONE_A, 0.02, 1)] }));
    expect(one).toMatchObject({ status: "recognized", classId: "a", handsUsed: 1 });
    expect(one.candidates.every((c) => c.classId === "a")).toBe(true);

    // Two hands whose per-hand vectors both equal class "a": still judged only on the dual vector.
    const two = model.predict(makeFeatures(2, { vectors: [ONE_A, ONE_A], dual: jitter(TWO_X, 0.02, 2) }));
    expect(two).toMatchObject({ status: "recognized", classId: "x", handsUsed: 2 });
    expect(two.candidates.every((c) => c.classId === "x")).toBe(true);

    const unknownTwo = model.predict(makeFeatures(2, { vectors: [ONE_A, ONE_A], dual: TWO_Y }));
    expect(unknownTwo.status).toBe("uncertain");
    expect(unknownTwo.classId).toBeNull();
  });

  it("gives uncertain for an unknown pose", async () => {
    const { model } = await modelWith(cluster("a", 1, ONE_A, 6, 10));
    const result = model.predict(makeFeatures(1, { vectors: [randomVector(63, 777)] }));
    expect(result.status).toBe("uncertain");
    expect(result.reason).toBe(REASONS.islTooFar);
    expect(result.scoreType).toBe("classifier_score");
  });

  it("reports a malformed vector as unsupported instead of throwing", async () => {
    const { model } = await modelWith(cluster("a", 1, ONE_A, 6, 10));
    const bad = Float32Array.from(ONE_A);
    bad[5] = Number.NaN;
    expect(model.predict(makeFeatures(1, { vectors: [bad] })).reason).toBe(REASONS.islBadVector);
    expect(model.predict(makeFeatures(1, { vectors: [new Float32Array(10)] })).reason).toBe(REASONS.islBadVector);
  });

  it("picks up newly recorded and deleted classes without reloading", async () => {
    const { model, store } = await modelWith(cluster("a", 1, ONE_A, 6, 10));
    expect(model.info.classes.map((c) => c.classId)).toEqual(["a"]);

    await store.addSamples(cluster("x", 2, TWO_X, 6, 50));
    expect(model.info.classes).toEqual([
      { classId: "a", label: "A", hands: 1, motion: "static" },
      { classId: "x", label: "X", hands: 2, motion: "static" },
    ]);
    expect(model.predict(makeFeatures(2, { dual: TWO_X })).classId).toBe("x");

    await store.removeClass("x");
    expect(model.predict(makeFeatures(2, { dual: TWO_X })).status).toBe("unsupported");
  });
});
