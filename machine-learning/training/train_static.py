"""Train static-sign classifiers on landmark features with a signer-aware protocol.

Workflow (each step refuses to continue when its precondition fails)::

    manifest gate  ->  load  ->  inspect  ->  clean + label validation
      ->  features (63-D one-hand OR 156-D two-hand)  ->  signer-aware split
      ->  fit candidates on TRAIN signers  ->  select on VALIDATION signers
      ->  evaluate once on TEST signers  ->  reports  ->  browser export (if allowed)
      ->  inference parity check (exported JSON vs scikit-learn)

One run trains one model for one hand count. Two-hand signs are learned from
the coordinated 156-D vector as a whole; they are never built from two
one-hand predictions.

Example::

    python -m training.train_static --dataset data/isl.npz --manifest data/isl.manifest.json \
        --hands 2 --out runs/isl-two-hand-v1 --seed 0 --n-val-signers 2 --n-test-signers 3
"""

from __future__ import annotations

import argparse
import datetime as _dt
import sys
import warnings
from pathlib import Path
from typing import Any, Sequence

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import accuracy_score, f1_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from evaluation.evaluate import cross_validate_by_signer, evaluate_predictions, write_report
from exports.export_model import (
    DEFAULT_MIN_TEST_SIGNERS,
    ExportError,
    build_model_document,
    evaluation_block,
    is_exportable,
    validation_decision,
    write_model_document,
)
from inference.reference import load_model_json, predict_labels, predict_scores
from rtslr_ml.dataset import (
    ManifestError,
    clean_dataset,
    inspect_dataset,
    load_dataset,
    load_manifest,
    require_training_ready,
    validate_labels,
)
from rtslr_ml.features import DUAL_FEATURE_DIM, FEATURE_SCHEMA_VERSION, SINGLE_FEATURE_DIM
from rtslr_ml.guards import assert_output_allowed, write_json
from rtslr_ml.splits import (
    SignerLeakError,
    SplitError,
    has_signer_ids,
    random_split,
    signer_group_kfold,
    signer_holdout_split,
)

#: Small, fixed grids. They are starting points, not tuned values: no ISL data exists yet.
CANDIDATE_GRID: dict[str, list[dict[str, Any]]] = {
    "knn": [{"n_neighbors": 1}, {"n_neighbors": 5}, {"n_neighbors": 9}],
    "mlp": [{"hidden_layer_sizes": [64]}, {"hidden_layer_sizes": [128, 64]}],
    "svm": [{"C": 1.0}, {"C": 10.0}],
    "rf": [{"n_estimators": 200}],
}
#: Preference order when validation scores tie: simplest to explain first.
_TIE_ORDER = ("knn", "mlp", "svm", "rf")
PARITY_TOLERANCE = 1e-4


def build_estimator(kind: str, params: dict[str, Any], seed: int, n_train: int | None = None) -> Pipeline:
    """A ``Pipeline(StandardScaler, classifier)`` with every random seed fixed."""
    if kind == "knn":
        k = int(params["n_neighbors"])
        if n_train is not None:
            k = max(1, min(k, n_train))
        classifier: Any = KNeighborsClassifier(n_neighbors=k, metric="cosine", algorithm="brute", weights="uniform")
    elif kind == "mlp":
        classifier = MLPClassifier(
            hidden_layer_sizes=tuple(params["hidden_layer_sizes"]),
            activation="relu",
            solver="adam",
            max_iter=int(params.get("max_iter", 800)),
            random_state=seed,
        )
    elif kind == "svm":
        classifier = SVC(kernel="rbf", C=float(params["C"]), gamma="scale", random_state=seed)
    elif kind == "rf":
        classifier = RandomForestClassifier(n_estimators=int(params["n_estimators"]), random_state=seed, n_jobs=1)
    else:
        raise ValueError(f"unknown candidate kind {kind!r}; choose from {sorted(CANDIDATE_GRID)}")
    return Pipeline([("standardizer", StandardScaler()), ("classifier", classifier)])


def fit_candidates(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    kinds: Sequence[str],
    seed: int,
) -> list[dict[str, Any]]:
    """Fit every candidate on the training signers and score it on the validation signers."""
    results = []
    for kind in kinds:
        for params in CANDIDATE_GRID[kind]:
            estimator = build_estimator(kind, params, seed, n_train=len(X_train))
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always", ConvergenceWarning)
                estimator.fit(X_train, y_train)
            predicted = estimator.predict(X_val)
            results.append(
                {
                    "kind": kind,
                    "params": params,
                    "val_accuracy": float(accuracy_score(y_val, predicted)),
                    "val_macro_f1": float(f1_score(y_val, predicted, average="macro", zero_division=0)),
                    "converged": not any(issubclass(w.category, ConvergenceWarning) for w in caught),
                    "exportable": is_exportable(estimator),
                    "_estimator": estimator,
                }
            )
    results.sort(key=lambda r: (-r["val_macro_f1"], -r["val_accuracy"], _TIE_ORDER.index(r["kind"])))
    return results


def _public(candidate: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in candidate.items() if not k.startswith("_")}


def check_export_parity(document_path: Path, pipeline: Pipeline, X: np.ndarray) -> dict[str, Any]:
    """Prove that the exported JSON reproduces scikit-learn on the given rows."""
    model = load_model_json(document_path)
    reference_labels = predict_labels(model, X)
    sklearn_labels = pipeline.predict(X).astype(str)
    agreement = float(np.mean(reference_labels == sklearn_labels))
    result: dict[str, Any] = {
        "n_samples": int(len(X)),
        "label_agreement": agreement,
        "tolerance": PARITY_TOLERANCE,
    }
    if hasattr(pipeline, "predict_proba"):
        difference = float(np.max(np.abs(predict_scores(model, X) - pipeline.predict_proba(X))))
        result["max_abs_score_difference"] = difference
        result["passed"] = agreement == 1.0 and difference <= PARITY_TOLERANCE
    else:
        result["passed"] = agreement == 1.0
    return result


def run_training(
    dataset_path: str | Path,
    manifest_path: str | Path,
    hands: int,
    out_dir: str | Path,
    *,
    seed: int = 0,
    candidates: Sequence[str] = ("knn", "mlp", "svm", "rf"),
    n_val_signers: int = 1,
    n_test_signers: int = 1,
    allow_random_split: bool = False,
    cv_folds: int = 0,
    mark_validated: bool = False,
    min_test_signers: int = DEFAULT_MIN_TEST_SIGNERS,
    model_id: str | None = None,
    model_version: str = "0.1.0",
    date: str | None = None,
) -> dict[str, Any]:
    """Run the whole static pipeline and return the report dictionary."""
    if hands not in (1, 2):
        raise ValueError("hands must be 1 or 2")
    unknown = [c for c in candidates if c not in CANDIDATE_GRID]
    if unknown or not candidates:
        raise ValueError(f"unknown candidates {unknown}; choose from {sorted(CANDIDATE_GRID)}")

    # 1. Manifest gate: no licence / consent, no training.
    manifest = load_manifest(manifest_path)
    require_training_ready(manifest)
    synthetic = manifest["synthetic"] is True
    out_dir = assert_output_allowed(out_dir, synthetic)

    # 2-4. Load, inspect, validate labels, clean.
    raw = load_dataset(dataset_path)
    inspection_before = inspect_dataset(raw)
    label_report = validate_labels(raw, manifest)
    dataset, cleaning_log = clean_dataset(raw, manifest)
    inspection_after = inspect_dataset(dataset) if len(dataset) else None

    # 5. Features for the requested hand count only.
    X, rows = dataset.feature_matrix(hands)
    y = dataset.labels[rows]
    signers = dataset.signer_ids[rows]
    sessions = dataset.session_ids[rows]
    if len(rows) == 0:
        raise ValueError(f"the cleaned dataset has no {hands}-hand samples")
    if len(set(y.tolist())) < 2:
        raise ValueError(f"the cleaned dataset has fewer than two {hands}-hand classes")

    # 6. Signer-aware split (random only when explicitly allowed).
    if has_signer_ids(signers) and not allow_random_split:
        split = signer_holdout_split(signers, y, n_val_signers=n_val_signers, n_test_signers=n_test_signers, seed=seed)
    else:
        split = random_split(y, signers, sessions, seed=seed, allow_signer_leak=allow_random_split)
    protocol = split.protocol.to_dict()
    protocol["description"] = split.protocol.describe()

    # 7. Fit on train signers, select on validation signers only.
    results = fit_candidates(X[split.train], y[split.train], X[split.val], y[split.val], candidates, seed)
    selected = results[0]
    exportable = next((r for r in results if r["exportable"]), None)
    classes = sorted(set(y[split.train].tolist()))

    # 8. Test signers are used once per reported model, after selection.
    def test_block(candidate: dict[str, Any]) -> dict[str, Any]:
        predicted = candidate["_estimator"].predict(X[split.test])
        metrics = evaluate_predictions(
            y[split.test], predicted, classes, signers[split.test], dataset.hand_count[rows][split.test]
        )
        return {**_public(candidate), "test": metrics}

    run_name = out_dir.name
    report: dict[str, Any] = {
        "format": "rtslr-training-report-1",
        "synthetic": synthetic,
        "run_name": run_name,
        "date": date or _dt.date.today().isoformat(),
        "seed": seed,
        "dataset_id": manifest["dataset_id"],
        "dataset_name": manifest["name"],
        "sign_language": manifest["sign_language"],
        "licence": manifest["licence"]["name"],
        "feature_schema": FEATURE_SCHEMA_VERSION,
        "hands": hands,
        "input_dim": SINGLE_FEATURE_DIM if hands == 1 else DUAL_FEATURE_DIM,
        "classes": classes,
        "n_samples_used": int(len(rows)),
        "inspection_before_cleaning": inspection_before,
        "label_validation": {k: v for k, v in label_report.items() if not k.endswith("_rows")},
        "cleaning": cleaning_log,
        "inspection_after_cleaning": inspection_after,
        "protocol": protocol,
        "split_sizes": {"train": int(len(split.train)), "val": int(len(split.val)), "test": int(len(split.test))},
        "candidates": [_public(r) for r in results],
        "selected": test_block(selected),
        "model_id": model_id or f"rtslr-isl-static-{'one' if hands == 1 else 'two'}-hand",
        "model_version": model_version,
    }
    if exportable is not None:
        report["exportable"] = test_block(exportable)
        report["exportable"]["is_selected_model"] = exportable is selected

    if cv_folds and has_signer_ids(signers):
        folds = signer_group_kfold(signers, n_splits=cv_folds, seed=seed)
        report["signer_cross_validation"] = cross_validate_by_signer(
            lambda: build_estimator(selected["kind"], selected["params"], seed), X, y, signers, folds
        )

    decision = validation_decision(
        synthetic=synthetic,
        signer_independent=split.protocol.signer_independent,
        n_test_signers=len(split.protocol.test_signers),
        mark_validated=mark_validated,
        min_test_signers=min_test_signers,
    )
    report["validation_decision"] = decision
    report["model_name"] = f"RTSLR ISL static {'one' if hands == 1 else 'two'}-hand signs"
    report["model_description"] = (
        f"{'k-NN' if exportable and exportable['kind'] == 'knn' else 'MLP'} on {report['input_dim']}-D "
        f"{'single-hand' if hands == 1 else 'coordinated two-hand'} landmark vectors, "
        f"trained on dataset {manifest['dataset_id']}."
    )
    report["model_limitations"] = [
        "Static signs only; signs that need movement, facial expression or body position are not covered.",
        f"Recognises only these {len(classes)} classes; any other pose is forced into one of them unless the score threshold rejects it.",
        "Evaluated per frame on stored landmarks; frames where hand detection fails are not counted.",
        "Scores are classifier scores, not calibrated probabilities.",
        "Not for medical, legal, emergency or other high-stakes communication.",
    ]

    # 9. Persist models and the split.
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(selected["_estimator"], out_dir / "model.joblib")
    write_json(
        out_dir / "split.json",
        {"synthetic": synthetic, "protocol": protocol, "hands": hands, "seed": seed},
        synthetic=synthetic,
    )

    # 10. Browser export + parity, only when allowed.
    export_info: dict[str, Any] = {"written": False, "path": None, "reason": None}
    if exportable is None:
        export_info["reason"] = "No browser-exportable candidate (mlp or knn) was trained."
    else:
        joblib.dump(exportable["_estimator"], out_dir / "exportable.joblib")
        try:
            document = build_model_document(
                exportable["_estimator"],
                hands=hands,
                model_id=report["model_id"],
                version=model_version,
                name=report["model_name"],
                sign_language=manifest["sign_language"],
                description=report["model_description"],
                limitations=report["model_limitations"],
                synthetic=synthetic,
                validated=decision["validated"],
                evaluation=evaluation_block(report) if decision["validated"] else None,
            )
            path = write_model_document(document, out_dir / "browser-model.json")
            export_info = {"written": True, "path": path.name, "reason": None}
            report["export_parity"] = check_export_parity(path, exportable["_estimator"], X[split.test])
        except ExportError as error:
            export_info["reason"] = str(error)
    report["browser_export"] = export_info

    write_report(report, out_dir)
    return report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Train and evaluate static-sign classifiers with a signer-aware protocol.",
    )
    parser.add_argument("--dataset", required=True, help="landmark dataset (.npz or .csv)")
    parser.add_argument("--manifest", required=True, help="dataset manifest with licence and consent filled in")
    parser.add_argument("--hands", required=True, type=int, choices=(1, 2), help="1 = 63-D one-hand model, 2 = 156-D two-hand model")
    parser.add_argument("--out", required=True, help="run directory (not inside frontend/ or research/)")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--candidates", default="knn,mlp,svm,rf", help="comma-separated: knn,mlp,svm,rf")
    parser.add_argument("--n-val-signers", type=int, default=1)
    parser.add_argument("--n-test-signers", type=int, default=1)
    parser.add_argument("--cv-folds", type=int, default=0, help="also run grouped k-fold by signer for the selected model")
    parser.add_argument(
        "--allow-random-split",
        action="store_true",
        help="override: split at random although signer ids exist. The result is signer-dependent and can never be validated.",
    )
    parser.add_argument("--mark-validated", action="store_true", help="assert that the model card is complete and reviewed")
    parser.add_argument("--min-test-signers", type=int, default=DEFAULT_MIN_TEST_SIGNERS)
    parser.add_argument("--model-id")
    parser.add_argument("--model-version", default="0.1.0")
    args = parser.parse_args(argv)

    try:
        report = run_training(
            args.dataset,
            args.manifest,
            args.hands,
            args.out,
            seed=args.seed,
            candidates=[c.strip() for c in args.candidates.split(",") if c.strip()],
            n_val_signers=args.n_val_signers,
            n_test_signers=args.n_test_signers,
            allow_random_split=args.allow_random_split,
            cv_folds=args.cv_folds,
            mark_validated=args.mark_validated,
            min_test_signers=args.min_test_signers,
            model_id=args.model_id,
            model_version=args.model_version,
        )
    except (ManifestError, SignerLeakError, SplitError, ValueError, RuntimeError) as error:
        print(f"Training did not run: {error}", file=sys.stderr)
        return 2

    selected = report["selected"]
    banner = "[SYNTHETIC DATA - code-path test only] " if report["synthetic"] else ""
    print(f"{banner}protocol: {report['protocol']['description']}")
    print(f"{banner}selected {selected['kind']} {selected['params']}: test accuracy {selected['test']['accuracy']:.4f}, macro-F1 {selected['test']['macro_f1']:.4f}")
    print(f"validated: {report['validation_decision']['validated']}")
    export = report["browser_export"]
    print(f"browser export: {'written to ' + export['path'] if export['written'] else 'not written - ' + str(export['reason'])}")
    if "export_parity" in report:
        print(f"export parity passed: {report['export_parity']['passed']}")
    print(f"report: {Path(args.out) / 'report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
