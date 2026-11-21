"""Reference inference for ``rtslr-model-1`` files, in plain NumPy.

This is the specification of what the browser must compute
(frontend/src/features/recognition/models/exportedModel.ts). It reads the
exported JSON, not the scikit-learn object, so a test that compares its output
with scikit-learn proves that the exported file itself reproduces the model.

Conventions (identical to the browser):

* ``standardizer``: ``x' = (x - mean) / scale``; ``null`` means identity.
* ``mlp.layers[i].W`` has one row per output unit: ``y = W @ x + b``.
  Hidden layers are ReLU; the last layer is softmax with one unit per class.
* ``knn.samples[].vector`` is already standardised. The k nearest by cosine
  distance vote uniformly; a tie goes to the class listed first in ``classes``.

Command line::

    python -m inference.reference --model browser-model.json --features vectors.npy
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence

import numpy as np

MODEL_FORMAT = "rtslr-model-1"
FEATURE_SCHEMA = "rtslr-features-1"
MAX_MODEL_BYTES = 5 * 1024 * 1024
ALLOWED_TOP_LEVEL_KEYS = frozenset(
    {"format", "featureSchema", "info", "type", "inputDim", "classes", "standardizer", "mlp", "knn", "evaluation", "synthetic"}
)
FORBIDDEN_KEYS = frozenset({"__proto__", "constructor", "prototype"})


class ModelFormatError(ValueError):
    """The file is not a well-formed rtslr-model-1 document."""


def _finite_array(value: Any, shape: tuple[int, ...], where: str) -> np.ndarray:
    try:
        array = np.asarray(value, dtype=np.float64)
    except (TypeError, ValueError) as error:
        raise ModelFormatError(f"{where}: not a numeric array") from error
    if array.shape != shape:
        raise ModelFormatError(f"{where}: expected shape {shape}, got {array.shape}")
    if not np.all(np.isfinite(array)):
        raise ModelFormatError(f"{where}: contains NaN or infinite values")
    return array


def validate_model_document(doc: Any) -> dict[str, Any]:
    """Check a parsed model document and return it with NumPy arrays under ``_arrays``.

    Mirrors the browser's checks (shape, finite numbers, allowed keys and
    activations). ``synthetic`` is the one key the browser refuses outright and
    this reference accepts, because the pipeline tests run on synthetic data.
    """
    if not isinstance(doc, dict):
        raise ModelFormatError("the model document must be a JSON object")
    unknown = set(doc) - ALLOWED_TOP_LEVEL_KEYS
    if unknown:
        raise ModelFormatError(f"unknown top-level keys: {sorted(unknown)}")
    if doc.get("format") != MODEL_FORMAT:
        raise ModelFormatError(f'format must be "{MODEL_FORMAT}"')
    if doc.get("featureSchema") != FEATURE_SCHEMA:
        raise ModelFormatError(f'featureSchema must be "{FEATURE_SCHEMA}"')
    input_dim = doc.get("inputDim")
    if input_dim not in (63, 156):
        raise ModelFormatError("inputDim must be 63 or 156")
    classes = doc.get("classes")
    if not isinstance(classes, list) or len(classes) < 2 or len(classes) > 2000:
        raise ModelFormatError("classes must list between 2 and 2000 class ids")
    for label in classes:
        if not isinstance(label, str) or not label.strip() or len(label) > 64 or label in FORBIDDEN_KEYS:
            raise ModelFormatError(f"invalid class id {label!r}")
    if len(set(classes)) != len(classes):
        raise ModelFormatError("duplicate class id")
    if not isinstance(doc.get("info"), dict):
        raise ModelFormatError("info must be an object")

    arrays: dict[str, Any] = {}
    standardizer = doc.get("standardizer")
    if standardizer is not None:
        if not isinstance(standardizer, dict) or set(standardizer) != {"mean", "scale"}:
            raise ModelFormatError("standardizer must have exactly mean and scale")
        arrays["mean"] = _finite_array(standardizer["mean"], (input_dim,), "standardizer.mean")
        arrays["scale"] = _finite_array(standardizer["scale"], (input_dim,), "standardizer.scale")
        if np.any(arrays["scale"] <= 0):
            raise ModelFormatError("standardizer.scale must be greater than zero")

    kind = doc.get("type")
    if kind == "mlp":
        if doc.get("knn") is not None:
            raise ModelFormatError('knn must be absent when type is "mlp"')
        layers = (doc.get("mlp") or {}).get("layers")
        if not isinstance(layers, list) or not layers or len(layers) > 8:
            raise ModelFormatError("mlp.layers must hold 1 to 8 layers")
        previous = input_dim
        parsed = []
        for i, layer in enumerate(layers):
            if not isinstance(layer, dict) or set(layer) != {"W", "b", "activation"}:
                raise ModelFormatError(f"mlp.layers[{i}] must have exactly W, b and activation")
            last = i == len(layers) - 1
            expected_activation = "softmax" if last else "relu"
            if layer["activation"] != expected_activation:
                raise ModelFormatError(f'mlp.layers[{i}].activation must be "{expected_activation}"')
            if not isinstance(layer["W"], list) or not layer["W"]:
                raise ModelFormatError(f"mlp.layers[{i}].W must be a non-empty matrix")
            out_dim = len(layer["W"])
            weights = _finite_array(layer["W"], (out_dim, previous), f"mlp.layers[{i}].W")
            bias = _finite_array(layer["b"], (out_dim,), f"mlp.layers[{i}].b")
            parsed.append((weights, bias, layer["activation"]))
            previous = out_dim
        if previous != len(classes):
            raise ModelFormatError("the last layer must have one unit per class")
        arrays["layers"] = parsed
    elif kind == "knn":
        if doc.get("mlp") is not None:
            raise ModelFormatError('mlp must be absent when type is "knn"')
        knn = doc.get("knn")
        if not isinstance(knn, dict) or set(knn) != {"k", "metric", "samples"}:
            raise ModelFormatError("knn must have exactly k, metric and samples")
        if knn["metric"] != "cosine":
            raise ModelFormatError('knn.metric must be "cosine"')
        k = knn["k"]
        if not isinstance(k, int) or isinstance(k, bool) or not 1 <= k <= 50:
            raise ModelFormatError("knn.k must be an integer from 1 to 50")
        samples = knn["samples"]
        if not isinstance(samples, list) or len(samples) < k or len(samples) > 20000:
            raise ModelFormatError("knn.samples must hold between k and 20000 samples")
        index = {label: i for i, label in enumerate(classes)}
        labels = []
        for i, sample in enumerate(samples):
            if not isinstance(sample, dict) or set(sample) != {"label", "vector"} or sample["label"] not in index:
                raise ModelFormatError(f"knn.samples[{i}] is malformed or has an unknown label")
            labels.append(index[sample["label"]])
        matrix = _finite_array([s["vector"] for s in samples], (len(samples), input_dim), "knn.samples[].vector")
        norms = np.linalg.norm(matrix, axis=1)
        if np.any(norms < 1e-12):
            raise ModelFormatError("knn.samples contains a zero vector")
        arrays["knn_unit"] = matrix / norms[:, None]
        arrays["knn_labels"] = np.asarray(labels, dtype=int)
        arrays["k"] = k
    else:
        raise ModelFormatError('type must be "mlp" or "knn"')

    evaluation = doc.get("evaluation")
    if evaluation is not None:
        if not isinstance(evaluation, dict) or set(evaluation) != {"protocol", "metrics", "datasetId", "date"}:
            raise ModelFormatError("evaluation must have exactly protocol, metrics, datasetId and date")
        if not isinstance(evaluation["metrics"], dict):
            raise ModelFormatError("evaluation.metrics must be an object")
        for name, value in evaluation["metrics"].items():
            if name in FORBIDDEN_KEYS or isinstance(value, bool) or not isinstance(value, (int, float)) or not np.isfinite(value):
                raise ModelFormatError(f"evaluation.metrics[{name!r}] must be a finite number")
    return {**doc, "_arrays": arrays}


def load_model_json(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    size = path.stat().st_size
    if size > MAX_MODEL_BYTES:
        raise ModelFormatError(f"{path} is {size} bytes; the limit for a browser model is {MAX_MODEL_BYTES}")
    return validate_model_document(json.loads(path.read_text(encoding="utf-8")))


def _standardize(model: dict[str, Any], X: np.ndarray) -> np.ndarray:
    arrays = model["_arrays"]
    if "mean" in arrays:
        return (X - arrays["mean"]) / arrays["scale"]
    return X


def predict_scores(model: dict[str, Any], X) -> np.ndarray:
    """Per-class scores, shape (N, n_classes), in ``model['classes']`` order."""
    X = np.atleast_2d(np.asarray(X, dtype=np.float64))
    if X.shape[1] != model["inputDim"]:
        raise ValueError(f"expected {model['inputDim']}-D vectors, got {X.shape[1]}-D")
    arrays = model["_arrays"]
    Z = _standardize(model, X)
    if model["type"] == "mlp":
        activations = Z
        for weights, bias, activation in arrays["layers"]:
            activations = activations @ weights.T + bias
            if activation == "relu":
                activations = np.maximum(activations, 0.0)
            else:
                shifted = activations - activations.max(axis=1, keepdims=True)
                exponent = np.exp(shifted)
                activations = exponent / exponent.sum(axis=1, keepdims=True)
        return activations

    norms = np.linalg.norm(Z, axis=1, keepdims=True)
    unit = np.divide(Z, norms, out=np.zeros_like(Z), where=norms > 1e-12)
    similarity = unit @ arrays["knn_unit"].T
    k = arrays["k"]
    nearest = np.argsort(-similarity, axis=1, kind="stable")[:, :k]
    scores = np.zeros((X.shape[0], len(model["classes"])))
    for row in range(X.shape[0]):
        np.add.at(scores[row], arrays["knn_labels"][nearest[row]], 1.0 / k)
    return scores


def predict_labels(model: dict[str, Any], X) -> np.ndarray:
    """Predicted class ids. ``argmax`` picks the first class on a tie, as the browser does."""
    scores = predict_scores(model, X)
    return np.asarray(model["classes"], dtype=str)[np.argmax(scores, axis=1)]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the NumPy reference inference on a file of feature vectors.")
    parser.add_argument("--model", required=True, help="rtslr-model-1 JSON file")
    parser.add_argument("--features", required=True, help=".npy file of shape (N, 63) or (N, 156)")
    args = parser.parse_args(argv)
    model = load_model_json(args.model)
    X = np.load(args.features, allow_pickle=False)
    scores = predict_scores(model, X)
    for row, label in zip(scores, predict_labels(model, X)):
        print(f"{label}\t{row.max():.6f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
