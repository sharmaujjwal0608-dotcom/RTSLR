"""Export a fitted scikit-learn pipeline to the browser format ``rtslr-model-1``.

Exportable estimators: ``Pipeline(StandardScaler, MLPClassifier[relu])`` and
``Pipeline(StandardScaler, KNeighborsClassifier[cosine, uniform])``. SVM and
Random Forest candidates are offline baselines and are not exported.

What may be exported
--------------------
* A model that meets the validation policy (`validation_decision`): real data
  with a complete manifest, a signer-independent protocol, enough unseen test
  signers, and an explicit ``--mark-validated`` from the person responsible.
  It is written with ``kind: "validated_isl"``, ``validated: true`` and a
  filled ``evaluation`` block.
* A model trained on synthetic data, for code-path tests only. It is written
  with a top-level ``"synthetic": true`` (which makes the browser loader refuse
  it), ``kind: "simulator"``, ``validated: false`` and ``evaluation: null``.

Anything else (real data, policy not met) is NOT exported: the shared contract
has no model kind for "trained but unvalidated", and shipping such a file under
the ``validated_isl`` kind would mislabel it. Fix the protocol instead.

Command line (re-export from a finished run)::

    python -m exports.export_model --run runs/my-run --out runs/my-run/browser-model.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from inference.reference import MAX_MODEL_BYTES, validate_model_document
from rtslr_ml.features import DUAL_FEATURE_DIM, FEATURE_SCHEMA_VERSION, SINGLE_FEATURE_DIM
from rtslr_ml.guards import SYNTHETIC_BANNER, assert_output_allowed

MODEL_FORMAT = "rtslr-model-1"
EXPORTABLE_KINDS = ("mlp", "knn")
#: Policy floor, not a scientific threshold: the team must set the real bar in the model card.
DEFAULT_MIN_TEST_SIGNERS = 3


class ExportError(RuntimeError):
    """The model cannot or must not be exported."""


def _number(value: float) -> float:
    """Round to 8 significant digits (float32 precision) to keep files small."""
    return float(f"{float(value):.8g}")


def _matrix(array: np.ndarray) -> list[list[float]]:
    return [[_number(v) for v in row] for row in np.asarray(array, dtype=np.float64)]


def _vector(array: np.ndarray) -> list[float]:
    return [_number(v) for v in np.asarray(array, dtype=np.float64)]


def is_exportable(pipeline: Any) -> bool:
    try:
        _split_pipeline(pipeline)
    except ExportError:
        return False
    return True


def _split_pipeline(pipeline: Any) -> tuple[StandardScaler, Any]:
    if not isinstance(pipeline, Pipeline) or len(pipeline.steps) != 2:
        raise ExportError("expected a two-step Pipeline(StandardScaler, classifier)")
    scaler, classifier = pipeline.steps[0][1], pipeline.steps[1][1]
    if not isinstance(scaler, StandardScaler):
        raise ExportError("the first pipeline step must be a StandardScaler")
    if isinstance(classifier, MLPClassifier):
        if classifier.activation != "relu":
            raise ExportError('only MLPs with activation="relu" can be exported')
    elif isinstance(classifier, KNeighborsClassifier):
        if classifier.effective_metric_ != "cosine" or classifier.weights != "uniform":
            raise ExportError('only k-NN with metric="cosine" and weights="uniform" can be exported')
    else:
        raise ExportError(f"{type(classifier).__name__} is an offline baseline and has no browser export")
    return scaler, classifier


def _mlp_layers(classifier: MLPClassifier) -> list[dict[str, Any]]:
    layers = []
    count = len(classifier.coefs_)
    for i, (coef, intercept) in enumerate(zip(classifier.coefs_, classifier.intercepts_)):
        weights = np.asarray(coef, dtype=np.float64).T  # scikit-learn stores (inputs, outputs)
        bias = np.asarray(intercept, dtype=np.float64)
        last = i == count - 1
        if last and classifier.out_activation_ == "logistic":
            # Two classes: scikit-learn has one sigmoid unit for classes_[1].
            # softmax([0, z]) == [1 - sigmoid(z), sigmoid(z)], so add a zero unit for classes_[0].
            weights = np.vstack([np.zeros_like(weights[0]), weights[0]])
            bias = np.asarray([0.0, bias[0]])
        elif last and classifier.out_activation_ != "softmax":
            raise ExportError(f"unsupported output activation {classifier.out_activation_!r}")
        layers.append({"W": _matrix(weights), "b": _vector(bias), "activation": "softmax" if last else "relu"})
    return layers


def _knn_block(classifier: KNeighborsClassifier, classes: list[str]) -> dict[str, Any]:
    vectors = np.asarray(classifier._fit_X, dtype=np.float64)  # already standardised by the pipeline
    labels = [classes[i] for i in np.asarray(classifier._y).astype(int)]
    return {
        "k": int(classifier.n_neighbors),
        "metric": "cosine",
        "samples": [{"label": label, "vector": _vector(vector)} for label, vector in zip(labels, vectors)],
    }


def validation_decision(
    *,
    synthetic: bool,
    signer_independent: bool,
    n_test_signers: int,
    mark_validated: bool,
    min_test_signers: int = DEFAULT_MIN_TEST_SIGNERS,
) -> dict[str, Any]:
    """Decide whether a model may be labelled validated, and say why."""
    reasons: list[str] = []
    if synthetic:
        reasons.append("Trained on synthetic data: never validated.")
    if not signer_independent:
        reasons.append("The evaluation protocol is not signer-independent.")
    if n_test_signers < min_test_signers:
        reasons.append(f"Only {n_test_signers} unseen test signer(s); the policy floor is {min_test_signers}.")
    if not mark_validated:
        reasons.append("Not explicitly marked validated (--mark-validated) by the person responsible for the model card.")
    validated = not reasons
    if validated:
        reasons.append(
            f"Real data, signer-independent protocol, {n_test_signers} unseen test signers, explicitly marked validated."
        )
    return {"validated": validated, "reasons": reasons, "min_test_signers": min_test_signers}


def build_model_document(
    pipeline: Pipeline,
    *,
    hands: int,
    model_id: str,
    version: str,
    name: str,
    sign_language: str,
    description: str,
    limitations: list[str],
    synthetic: bool,
    validated: bool,
    evaluation: dict[str, Any] | None,
) -> dict[str, Any]:
    """Assemble the ``rtslr-model-1`` document for a fitted pipeline."""
    scaler, classifier = _split_pipeline(pipeline)
    input_dim = SINGLE_FEATURE_DIM if hands == 1 else DUAL_FEATURE_DIM
    if scaler.mean_.shape != (input_dim,):
        raise ExportError(f"the model was fitted on {scaler.mean_.shape[0]}-D input, expected {input_dim}-D for {hands} hand(s)")
    classes = [str(c) for c in classifier.classes_]

    if synthetic and validated:
        raise ExportError("a model trained on synthetic data can never be marked validated")
    if not synthetic and not validated:
        raise ExportError(
            "This model does not meet the validation policy, so it is not exported for the browser. "
            'The contract has no model kind for "trained but unvalidated"; fix the evaluation protocol instead.'
        )
    if validated and not evaluation:
        raise ExportError("a validated model needs an evaluation block")
    if synthetic:
        evaluation = None
        if "SYNTHETIC" not in name.upper():
            name = f"SYNTHETIC TEST MODEL - {name}"
        description = f"{SYNTHETIC_BANNER} {description}".strip()

    document: dict[str, Any] = {
        "format": MODEL_FORMAT,
        "featureSchema": FEATURE_SCHEMA_VERSION,
        "info": {
            "id": model_id,
            "version": version,
            "name": name,
            "signLanguage": sign_language,
            "kind": "validated_isl" if validated else "simulator",
            "input": "single_hand_static" if hands == 1 else "dual_hand_static",
            # Softmax outputs and neighbour shares are not calibrated probabilities
            # unless calibration has been measured; none is measured by this pipeline.
            "scoreType": "classifier_score",
            "validated": validated,
            "classes": [{"classId": c, "label": c, "hands": hands, "motion": "static"} for c in classes],
            "description": description,
            "limitations": limitations,
        },
        "type": "mlp" if isinstance(classifier, MLPClassifier) else "knn",
        "inputDim": input_dim,
        "classes": classes,
        "standardizer": {"mean": _vector(scaler.mean_), "scale": _vector(scaler.scale_)},
        "evaluation": evaluation,
    }
    if isinstance(classifier, MLPClassifier):
        document["mlp"] = {"layers": _mlp_layers(classifier)}
    else:
        document["knn"] = _knn_block(classifier, classes)
    if synthetic:
        document["synthetic"] = True
    return document


def write_model_document(document: dict[str, Any], out_path: str | Path) -> Path:
    """Validate and write the document. Refuses oversized files and protected locations."""
    synthetic = document.get("synthetic") is True
    target = assert_output_allowed(out_path, synthetic)
    validate_model_document(document)
    text = json.dumps(document, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    size = len(text.encode("utf-8"))
    if size > MAX_MODEL_BYTES:
        raise ExportError(
            f"the exported model is {size / 1e6:.1f} MB; the browser accepts at most {MAX_MODEL_BYTES / 1e6:.0f} MB. "
            "Use a smaller MLP, or fewer k-NN samples."
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target


def evaluation_block(report: dict[str, Any], which: str = "exportable") -> dict[str, Any]:
    """Build the contract's ``evaluation`` block from a training report."""
    test = report[which]["test"]
    protocol = report["protocol"]
    metrics: dict[str, float] = {
        "accuracy": test["accuracy"],
        "macro_f1": test["macro_f1"],
        "n_test_samples": test["n_samples"],
        "n_test_signers": len(protocol["test_signers"]),
        "n_val_signers": len(protocol["val_signers"]),
        "n_train_signers": len(protocol["train_signers"]),
        "n_classes": test["n_classes"],
    }
    if "worst_signer" in test:
        metrics["worst_signer_accuracy"] = test["worst_signer"]["accuracy"]
    return {
        "protocol": protocol["description"],
        "metrics": metrics,
        "datasetId": report["dataset_id"],
        "date": report["date"],
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export the browser model of a finished training run.")
    parser.add_argument("--run", required=True, help="run directory written by training.train_static")
    parser.add_argument("--out", required=True, help="output JSON path (not inside frontend/ or research/)")
    parser.add_argument("--mark-validated", action="store_true", help="assert that the model card is complete and reviewed")
    parser.add_argument("--min-test-signers", type=int, default=DEFAULT_MIN_TEST_SIGNERS)
    args = parser.parse_args(argv)

    import joblib

    run_dir = Path(args.run)
    report = json.loads((run_dir / "report.json").read_text(encoding="utf-8"))
    if "exportable" not in report:
        print("This run has no browser-exportable candidate (train with --candidates including mlp or knn).", file=sys.stderr)
        return 2
    pipeline = joblib.load(run_dir / "exportable.joblib")
    synthetic = report["synthetic"] is True
    decision = validation_decision(
        synthetic=synthetic,
        signer_independent=report["protocol"]["signer_independent"],
        n_test_signers=len(report["protocol"]["test_signers"]),
        mark_validated=args.mark_validated,
        min_test_signers=args.min_test_signers,
    )
    try:
        document = build_model_document(
            pipeline,
            hands=report["hands"],
            model_id=report["model_id"],
            version=report["model_version"],
            name=report["model_name"],
            sign_language=report["sign_language"],
            description=report["model_description"],
            limitations=report["model_limitations"],
            synthetic=synthetic,
            validated=decision["validated"],
            evaluation=evaluation_block(report) if decision["validated"] else None,
        )
        path = write_model_document(document, args.out)
    except ExportError as error:
        print(f"Not exported: {error}", file=sys.stderr)
        for reason in decision["reasons"]:
            print(f"  - {reason}", file=sys.stderr)
        return 2
    print(f"wrote {path} (validated: {decision['validated']}, synthetic: {synthetic})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
