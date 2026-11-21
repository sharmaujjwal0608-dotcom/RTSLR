import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ExportedSignModel,
  MAX_MODEL_BYTES,
  ModelLoadError,
  argmax,
  defaultModelUrlPolicy,
  loadExportedModel,
  parseExportedModelText,
  resolveAllowedModelUrl,
  scoreWithExportedModel,
  validateExportedModel,
} from "../models/exportedModel";
import { REASONS } from "../reasons";
import { makeFeatures } from "./testUtils";

/* ------------------------------------------------------------------ */
/* A tiny hand-made MLP whose output can be computed on paper           */
/* ------------------------------------------------------------------ */

const zeros = (n: number) => new Array<number>(n).fill(0);
const row = (n: number, entries: Record<number, number>) => {
  const out = zeros(n);
  for (const [i, v] of Object.entries(entries)) out[Number(i)] = v;
  return out;
};

const INFO = {
  id: "test-mlp",
  version: "0.0.1",
  name: "Hand-made test network",
  signLanguage: "ISL",
  kind: "validated_isl",
  input: "single_hand_static",
  scoreType: "classifier_score",
  validated: true,
  classes: [
    { classId: "c0", label: "Zero", hands: 1, motion: "static" },
    { classId: "c1", label: "One", hands: 1, motion: "static" },
  ],
  description: "Weights written by hand for a unit test. Not trained on anything.",
  limitations: ["Test fixture."],
};

const EVALUATION = { protocol: "none (unit-test fixture)", metrics: { n: 0 }, datasetId: "none", date: "2026-01-01" };

/**
 * standardizer: x0' = (x0 − 1) / 2, everything else unchanged
 * hidden (relu): h0 = x0' − x1,  h1 = x2 + 0.5
 * output (softmax): z = [h0 − h1, h1 − h0]
 */
function tinyMlp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: "rtslr-model-1",
    featureSchema: "rtslr-features-1",
    info: INFO,
    type: "mlp",
    inputDim: 63,
    classes: ["c0", "c1"],
    standardizer: { mean: row(63, { 0: 1 }), scale: zeros(63).map((_, i) => (i === 0 ? 2 : 1)) },
    mlp: {
      layers: [
        { W: [row(63, { 0: 1, 1: -1 }), row(63, { 2: 1 })], b: [0, 0.5], activation: "relu" },
        { W: [[1, -1], [-1, 1]], b: [0, 0], activation: "softmax" },
      ],
    },
    evaluation: EVALUATION,
    ...overrides,
  };
}

function input(entries: Record<number, number>): Float32Array {
  return Float32Array.from(row(63, entries));
}

describe("MLP forward pass", () => {
  const model = validateExportedModel(tinyMlp());

  it("matches the value computed by hand", () => {
    // x0'=0.5, h0=relu(0.5−0.5)=0, h1=relu(0.25+0.5)=0.75, z=[−0.75, 0.75]
    // p1 = 1 / (1 + e^−1.5) = 0.8175744762
    const p = scoreWithExportedModel(model, input({ 0: 2, 1: 0.5, 2: 0.25 }));
    expect(p[0]).toBeCloseTo(0.1824255238, 6);
    expect(p[1]).toBeCloseTo(0.8175744762, 6);
    expect(p[0] + p[1]).toBeCloseTo(1, 6);
    expect(argmax(p)).toBe(1);
  });

  it("applies relu: a negative hidden unit contributes nothing", () => {
    // x0'=(9−1)/2=4, h0=relu(4−0)=4, h1=relu(−3+0.5)=0, z=[4,−4], p0=1/(1+e^−8)
    const p = scoreWithExportedModel(model, input({ 0: 9, 2: -3 }));
    expect(p[0]).toBeCloseTo(0.9996646499, 6);
  });

  it("treats a null standardizer as identity", () => {
    const plain = validateExportedModel(tinyMlp({ standardizer: null }));
    // h0=relu(2−0.5)=1.5, h1=0.75, z=[0.75,−0.75]
    const p = scoreWithExportedModel(plain, input({ 0: 2, 1: 0.5, 2: 0.25 }));
    expect(p[0]).toBeCloseTo(0.8175744762, 6);
  });

  it("keeps weights in typed arrays", () => {
    expect(model.layers?.[0].weights).toBeInstanceOf(Float32Array);
    expect(model.layers?.[0].weights).toHaveLength(2 * 63);
    expect(model.mean).toBeInstanceOf(Float32Array);
  });

  it("rejects a vector of the wrong size", () => {
    expect(() => scoreWithExportedModel(model, new Float32Array(156))).toThrow(/63-D/);
  });
});

describe("k-NN inference", () => {
  const unit = (i: number) => row(63, { [i]: 1 });
  const knnFile = (k: number) =>
    tinyMlp({
      type: "knn",
      mlp: undefined,
      standardizer: null,
      knn: {
        k,
        metric: "cosine",
        samples: [
          { label: "c0", vector: unit(0) },
          { label: "c0", vector: row(63, { 0: 1, 1: 0.1 }) },
          { label: "c1", vector: unit(1) },
          { label: "c1", vector: row(63, { 1: 2, 0: 0.2 }) },
          { label: "c1", vector: row(63, { 1: 1, 2: 0.1 }) },
        ],
      },
    });

  it("votes uniformly over the k nearest by cosine distance", () => {
    const model = validateExportedModel(knnFile(3));
    expect(Array.from(scoreWithExportedModel(model, input({ 0: 5 })))).toEqual([
      expect.closeTo(2 / 3, 6),
      expect.closeTo(1 / 3, 6),
    ]);
    expect(Array.from(scoreWithExportedModel(model, input({ 1: 0.01 })))).toEqual([0, expect.closeTo(1, 6)]);
  });

  it("gives a tie to the class listed first, like scikit-learn", () => {
    const model = validateExportedModel(knnFile(4));
    // Nearest four to e0: two of c0, then two of c1 → 0.5 / 0.5.
    const scores = scoreWithExportedModel(model, input({ 0: 1 }));
    expect(scores[0]).toBeCloseTo(0.5, 6);
    expect(argmax(scores)).toBe(0);
  });
});

describe("validation (MOD-09, MOD-10, MOD-13)", () => {
  const layers = () => (tinyMlp().mlp as { layers: Record<string, unknown>[] }).layers;

  it("accepts the reference file", () => {
    const model = validateExportedModel(tinyMlp());
    expect(model.info.validated).toBe(true);
    expect(model.evaluation?.metrics.n).toBe(0);
    expect(Object.getPrototypeOf(model.evaluation?.metrics)).toBeNull();
  });

  it("treats evaluation: null as unvalidated whatever the file claims", () => {
    const model = validateExportedModel(
      tinyMlp({ evaluation: null, info: { ...INFO, validated: true, scoreType: "calibrated_probability" } }),
    );
    expect(model.info.validated).toBe(false);
    expect(model.info.scoreType).toBe("classifier_score");
  });

  it("refuses a file marked synthetic", () => {
    expect(() => validateExportedModel({ ...tinyMlp(), synthetic: true })).toThrow(ModelLoadError);
    try {
      parseExportedModelText(JSON.stringify({ ...tinyMlp(), synthetic: true }));
      expect.unreachable();
    } catch (error) {
      expect((error as ModelLoadError).code).toBe("synthetic");
    }
  });

  it.each<[string, () => unknown]>([
    ["a wrong format", () => tinyMlp({ format: "rtslr-model-2" })],
    ["a wrong feature schema", () => tinyMlp({ featureSchema: "v0" })],
    ["an unknown top-level key", () => ({ ...tinyMlp(), code: "alert(1)" })],
    ["an unsupported inputDim (126)", () => tinyMlp({ inputDim: 126 })],
    ["an unknown model type", () => tinyMlp({ type: "onnx" })],
    ["one class only", () => tinyMlp({ classes: ["c0"] })],
    ["duplicate classes", () => tinyMlp({ classes: ["c0", "c0"] })],
    ["a __proto__ class id", () => tinyMlp({ classes: ["__proto__", "c1"] })],
    ["a non-string class", () => tinyMlp({ classes: ["c0", 7] })],
    ["a 65-character class id", () => tinyMlp({ classes: ["c0", "x".repeat(65)] })],
    ["info.classes that disagree with classes", () => tinyMlp({ info: { ...INFO, classes: [INFO.classes[1], INFO.classes[0]] } })],
    ["a two-hand class in a 63-D model", () => tinyMlp({ info: { ...INFO, classes: [{ ...INFO.classes[0], hands: 2 }, INFO.classes[1]] } })],
    ["an input type that contradicts inputDim", () => tinyMlp({ info: { ...INFO, input: "dual_hand_static" } })],
    ["a model kind a file may not claim", () => tinyMlp({ info: { ...INFO, kind: "legacy_asl_prototype" } })],
    ["an unknown info key", () => tinyMlp({ info: { ...INFO, onload: "x" } })],
    ["a standardizer of the wrong length", () => tinyMlp({ standardizer: { mean: zeros(62), scale: zeros(63).fill(1) } })],
    ["a zero scale", () => tinyMlp({ standardizer: { mean: zeros(63), scale: zeros(63) } })],
    ["a NaN-like weight (null)", () => {
      const l = layers();
      (l[0].W as (number | null)[][])[0][5] = null;
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["a string weight", () => {
      const l = layers();
      (l[0].W as (number | string)[][])[1][0] = "1";
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["a weight outside float32 range", () => {
      const l = layers();
      (l[0].b as number[])[0] = 1e300;
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["a ragged weight matrix", () => {
      const l = layers();
      (l[0].W as number[][])[1] = zeros(62);
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["a bias of the wrong length", () => {
      const l = layers();
      l[0].b = [0];
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["layers that do not chain", () => {
      const l = layers();
      l[1].W = [[1, -1, 0], [-1, 1, 0]];
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["an output size different from the class count", () => {
      const l = layers();
      l[1].W = [[1, -1]];
      l[1].b = [0];
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["an activation outside the allow-list", () => {
      const l = layers();
      l[0].activation = "tanh";
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["a last layer that is not softmax", () => {
      const l = layers();
      l[1].activation = "relu";
      return tinyMlp({ mlp: { layers: l } });
    }],
    ["no layers", () => tinyMlp({ mlp: { layers: [] } })],
    ["both mlp and knn", () => tinyMlp({ knn: { k: 1, metric: "cosine", samples: [] } })],
    ["a knn metric other than cosine", () => tinyMlp({ type: "knn", mlp: undefined, knn: { k: 1, metric: "euclidean", samples: [{ label: "c0", vector: row(63, { 0: 1 }) }] } })],
    ["a knn sample with an unknown label", () => tinyMlp({ type: "knn", mlp: undefined, knn: { k: 1, metric: "cosine", samples: [{ label: "zz", vector: row(63, { 0: 1 }) }] } })],
    ["fewer knn samples than k", () => tinyMlp({ type: "knn", mlp: undefined, knn: { k: 3, metric: "cosine", samples: [{ label: "c0", vector: row(63, { 0: 1 }) }] } })],
    ["a zero knn vector", () => tinyMlp({ type: "knn", mlp: undefined, knn: { k: 1, metric: "cosine", samples: [{ label: "c0", vector: zeros(63) }] } })],
    ["a non-numeric metric", () => tinyMlp({ evaluation: { ...EVALUATION, metrics: { accuracy: "99%" } } })],
    ["an unknown evaluation key", () => tinyMlp({ evaluation: { ...EVALUATION, note: "x" } })],
    ["an array instead of an object", () => [tinyMlp()]],
  ])("rejects a file with %s", (_name, build) => {
    expect(() => validateExportedModel(build())).toThrow();
  });

  it("rejects prototype-pollution keys anywhere in the text and pollutes nothing", () => {
    const text = JSON.stringify(tinyMlp()).replace('"evaluation":{', '"evaluation":{"__proto__":{"polluted":1},');
    expect(() => parseExportedModelText(text)).toThrow(/forbidden key/);
    const metricsText = JSON.stringify(tinyMlp()).replace('"metrics":{', '"metrics":{"constructor":1,');
    expect(() => parseExportedModelText(metricsText)).toThrow(ModelLoadError);
    expect(({} as { polluted?: number }).polluted).toBeUndefined();
  });

  it("rejects text over the 5 MB cap and text that is not JSON", () => {
    const big = `{"format":"rtslr-model-1","pad":"${"x".repeat(MAX_MODEL_BYTES)}"}`;
    expect(() => parseExportedModelText(big)).toThrow(/5 MB/);
    try {
      parseExportedModelText(big);
    } catch (error) {
      expect((error as ModelLoadError).code).toBe("too_large");
    }
    expect(() => parseExportedModelText("<!doctype html><html>404</html>")).toThrow(/not valid JSON/);
  });
});

describe("URL allow-list (MOD-01)", () => {
  const policy = defaultModelUrlPolicy("https://app.example");

  it("allows the site's own /models/ folder", () => {
    expect(resolveAllowedModelUrl("/models/isl/static-one-hand.json", policy).href).toBe(
      "https://app.example/models/isl/static-one-hand.json",
    );
    expect(resolveAllowedModelUrl("https://app.example/models/x.json", policy).pathname).toBe("/models/x.json");
  });

  it.each([
    "https://evil.example/models/x.json",
    "//evil.example/models/x.json",
    "https://evil.example/https://app.example/models/x.json",
    "https://app.example.evil.example/models/x.json",
    "https://app.example@evil.example/models/x.json",
    "https://user:pw@app.example/models/x.json",
    "http://app.example/models/x.json",
    "/models/../secret.json",
    "/api/models/x.json",
    "/modelsx/x.json",
    "javascript:alert(1)",
    "data:application/json,{}",
    "blob:https://app.example/123",
    "https://app.example:8443/models/x.json",
  ])("blocks %s", (url) => {
    try {
      resolveAllowedModelUrl(url, policy);
      expect.unreachable(`should have blocked ${url}`);
    } catch (error) {
      expect(error).toBeInstanceOf(ModelLoadError);
      expect((error as ModelLoadError).code).toBe("blocked_url");
    }
  });

  it("allows http only for localhost", () => {
    const local = defaultModelUrlPolicy("http://localhost:3000");
    expect(resolveAllowedModelUrl("/models/x.json", local).href).toBe("http://localhost:3000/models/x.json");
  });

  it("adds the configured API origin with its own models prefix", () => {
    const withApi = defaultModelUrlPolicy("https://app.example", "https://api.example/v1");
    expect(resolveAllowedModelUrl("https://api.example/v1/models/x.json", withApi).origin).toBe("https://api.example");
    expect(() => resolveAllowedModelUrl("https://api.example/other/x.json", withApi)).toThrow(ModelLoadError);
  });
});

describe("loadExportedModel (MOD-03, MOD-06, MOD-12)", () => {
  const policy = defaultModelUrlPolicy("https://app.example");
  const okText = JSON.stringify(tinyMlp());

  it("fetches without credentials, refuses redirects, and returns a validated model", async () => {
    const fetchImpl = vi.fn(async () => new Response(okText, { status: 200 }));
    const model = await loadExportedModel("/models/m.json", { policy, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(model.classes).toEqual(["c0", "c1"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://app.example/models/m.json");
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
  });

  it("does not call fetch for a blocked URL", async () => {
    const fetchImpl = vi.fn();
    await expect(
      loadExportedModel("https://evil.example/models/m.json", { policy, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "blocked_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing file as not_found, not as a crash", async () => {
    const fetchImpl = async () => new Response("Not found", { status: 404 });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({
      name: "ModelLoadError",
      code: "not_found",
    });
  });

  it("maps other failures to their own codes", async () => {
    const http500 = async () => new Response("boom", { status: 500 });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: http500 as typeof fetch })).rejects.toMatchObject({ code: "http_error" });
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: offline as typeof fetch })).rejects.toMatchObject({ code: "network" });
    const html = async () => new Response("<html></html>", { status: 200 });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: html as typeof fetch })).rejects.toMatchObject({ code: "invalid" });
    const corrupt = async () => new Response(JSON.stringify(tinyMlp({ inputDim: 64 })), { status: 200 });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: corrupt as typeof fetch })).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects on Content-Length before reading the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull: () => undefined, cancel });
    const fetchImpl = async () =>
      new Response(body, { status: 200, headers: { "content-length": String(MAX_MODEL_BYTES + 1) } });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({ code: "too_large" });
  });

  it("aborts the stream when the bytes read pass the cap", async () => {
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024).fill(32);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 50) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const fetchImpl = async () => new Response(body, { status: 200 });
    await expect(loadExportedModel("/models/m.json", { policy, fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({ code: "too_large" });
    expect(sent).toBeLessThan(12); // stopped soon after 5 MB, not after all 50 MB
  });
});

describe("ExportedSignModel", () => {
  const parsed = validateExportedModel(tinyMlp());

  it("recognises with one hand and reports honest metadata", () => {
    const model = new ExportedSignModel({ parsed });
    const result = model.predict(makeFeatures(1, { vectors: [input({ 0: 2, 1: 0.5, 2: 0.25 })], timestamp: 7 }));
    expect(result).toMatchObject({
      status: "recognized",
      classId: "c1",
      label: "One",
      handsUsed: 1,
      scoreType: "classifier_score",
      modelId: "test-mlp",
      timestamp: 7,
    });
    expect(result.score).toBeCloseTo(0.8175744762, 6);
    expect(result.candidates.map((c) => c.classId)).toEqual(["c1", "c0"]);
  });

  it("is unsupported for two hands on a one-hand model, and no_hands for none", () => {
    const model = new ExportedSignModel({ parsed });
    expect(model.predict(makeFeatures(2))).toMatchObject({ status: "unsupported", reason: REASONS.exportedNeedsOneHand });
    expect(model.predict(makeFeatures(0)).status).toBe("no_hands");
  });

  it("is uncertain below its threshold", () => {
    const model = new ExportedSignModel({ parsed }, { minScore: 0.9 });
    const result = model.predict(makeFeatures(1, { vectors: [input({ 0: 2, 1: 0.5, 2: 0.25 })] }));
    expect(result).toMatchObject({ status: "uncertain", classId: null, reason: REASONS.exportedLowScore });
    expect(result.candidates[0].classId).toBe("c1");
  });

  it("a failed load leaves the model unloaded and predict stays safe", async () => {
    const model = new ExportedSignModel({
      url: "/models/m.json",
      info: parsed.info,
      policy: defaultModelUrlPolicy("https://app.example"),
      fetchImpl: (async () => new Response("nope", { status: 404 })) as typeof fetch,
    });
    await expect(model.load()).rejects.toMatchObject({ code: "not_found" });
    expect(model.predict(makeFeatures(1)).status).toBe("unsupported");
  });
});

/* ------------------------------------------------------------------ */
/* Cross-language parity with the Python reference implementation      */
/* ------------------------------------------------------------------ */

type ParityFixture = {
  synthetic: true;
  models: { name: string; model: Record<string, unknown>; inputs: number[][]; expectedScores: number[][]; expectedLabels: string[] }[];
};

// Vitest runs with the frontend folder as the working directory.
const parityPath = resolve(process.cwd(), "..", "machine-learning", "tests", "fixtures", "browser-parity.synthetic.json");

describe("parity with machine-learning/inference/reference.py", () => {
  it.skipIf(!existsSync(parityPath))("reproduces scikit-learn's outputs for the synthetic fixture models", () => {
    const fixture = JSON.parse(readFileSync(parityPath, "utf-8")) as ParityFixture;
    expect(fixture.synthetic).toBe(true);
    expect(fixture.models.length).toBeGreaterThan(0);
    for (const entry of fixture.models) {
      // The exporter marks synthetic files so that the app refuses them.
      expect(() => validateExportedModel(entry.model)).toThrow(/synthetic/);

      // For this numeric check only, drop the marker and the "simulator" kind.
      const { synthetic: _synthetic, ...rest } = entry.model as { synthetic: boolean; info: Record<string, unknown> };
      void _synthetic;
      const model = validateExportedModel({ ...rest, info: { ...rest.info, kind: "validated_isl" } });
      expect(model.info.validated).toBe(false);

      entry.inputs.forEach((vector, i) => {
        const scores = scoreWithExportedModel(model, vector);
        const expected = entry.expectedScores[i];
        for (let c = 0; c < expected.length; c++) expect(Math.abs(scores[c] - expected[c])).toBeLessThan(1e-4);
        expect(model.classes[argmax(scores)]).toBe(entry.expectedLabels[i]);
      });
    }
  });
});
