"""Evaluation: metrics, breakdowns and report writing.

Reported for every evaluation:

* accuracy and macro-F1 (overall accuracy hides weak classes);
* per-class precision, recall, F1 and support;
* the confusion matrix;
* a per-signer breakdown with the worst signer named;
* a one-hand versus two-hand breakdown;
* the evaluation protocol, verbatim, including whether it is signer-independent.

Reports are written as JSON and Markdown. A report made from synthetic data
carries ``"synthetic": true`` and a banner, and cannot be written into
``frontend/`` or ``research/`` (see rtslr_ml/guards.py).

Command line (re-evaluates a saved run on its own held-out test signers)::

    python -m evaluation.evaluate --run runs/my-run --dataset data.npz --manifest manifest.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support

from rtslr_ml.guards import SYNTHETIC_BANNER, write_json, write_text


def _summary(y_true: np.ndarray, y_pred: np.ndarray, classes: Sequence[str]) -> dict[str, Any]:
    return {
        "n_samples": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)) if len(y_true) else None,
        "macro_f1": float(f1_score(y_true, y_pred, labels=list(classes), average="macro", zero_division=0))
        if len(y_true)
        else None,
    }


def evaluate_predictions(
    y_true,
    y_pred,
    classes: Sequence[str],
    signer_ids=None,
    hand_count=None,
) -> dict[str, Any]:
    """Compute all metrics for one set of predictions.

    ``classes`` fixes the label order of the confusion matrix. Macro-F1 averages
    over every class in ``classes``; a class with no test samples and no
    predictions contributes 0, which is the conservative reading.
    """
    y_true = np.asarray(y_true, dtype=str)
    y_pred = np.asarray(y_pred, dtype=str)
    if y_true.shape != y_pred.shape:
        raise ValueError("y_true and y_pred must have the same length")
    if len(y_true) == 0:
        raise ValueError("cannot evaluate zero samples")
    classes = [str(c) for c in classes]

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0
    )
    matrix = confusion_matrix(y_true, y_pred, labels=classes)
    result: dict[str, Any] = {
        **_summary(y_true, y_pred, classes),
        "n_classes": len(classes),
        "per_class": {
            label: {
                "precision": float(precision[i]),
                "recall": float(recall[i]),
                "f1": float(f1[i]),
                "support": int(support[i]),
            }
            for i, label in enumerate(classes)
        },
        "confusion_matrix": {"labels": classes, "rows_true_cols_predicted": matrix.astype(int).tolist()},
        "predictions_outside_known_classes": int(np.sum(~np.isin(y_pred, classes))),
    }

    if signer_ids is not None:
        signer_ids = np.asarray(signer_ids, dtype=str)
        per_signer = {}
        for signer in sorted(set(signer_ids.tolist())):
            mask = signer_ids == signer
            per_signer[signer] = _summary(y_true[mask], y_pred[mask], classes)
        result["per_signer"] = per_signer
        result["n_signers"] = len(per_signer)
        worst = min(per_signer, key=lambda s: per_signer[s]["accuracy"])
        accuracies = [v["accuracy"] for v in per_signer.values()]
        result["worst_signer"] = {"signer_id": worst, "accuracy": per_signer[worst]["accuracy"]}
        result["signer_accuracy_mean"] = float(np.mean(accuracies))
        result["signer_accuracy_std"] = float(np.std(accuracies))

    if hand_count is not None:
        hand_count = np.asarray(hand_count).astype(int)
        by_hands = {}
        for hands, name in ((1, "one_hand"), (2, "two_hand")):
            mask = hand_count == hands
            by_hands[name] = _summary(y_true[mask], y_pred[mask], classes) if mask.any() else {"n_samples": 0, "accuracy": None, "macro_f1": None}
        result["by_hand_count"] = by_hands
    return result


def cross_validate_by_signer(
    make_estimator: Callable[[], Any],
    X: np.ndarray,
    y: np.ndarray,
    signer_ids: np.ndarray,
    folds: list[tuple[np.ndarray, np.ndarray]],
) -> dict[str, Any]:
    """Refit on each fold's training signers and score the held-out signers."""
    y = np.asarray(y, dtype=str)
    scores = []
    for train_index, test_index in folds:
        if len(set(y[train_index].tolist())) < 2:
            continue
        estimator = make_estimator()
        estimator.fit(X[train_index], y[train_index])
        predicted = estimator.predict(X[test_index])
        scores.append(
            {
                "held_out_signers": sorted(set(np.asarray(signer_ids, dtype=str)[test_index].tolist())),
                "n_samples": int(len(test_index)),
                "accuracy": float(accuracy_score(y[test_index], predicted)),
                "macro_f1": float(f1_score(y[test_index], predicted, average="macro", zero_division=0)),
            }
        )
    if not scores:
        raise ValueError("no usable folds")
    accuracies = [s["accuracy"] for s in scores]
    return {
        "n_folds": len(scores),
        "folds": scores,
        "accuracy_mean": float(np.mean(accuracies)),
        "accuracy_std": float(np.std(accuracies)),
        "accuracy_min": float(np.min(accuracies)),
        "macro_f1_mean": float(np.mean([s["macro_f1"] for s in scores])),
    }


# --------------------------------------------------------------------------- #
# Report rendering
# --------------------------------------------------------------------------- #


def _pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.2f}%"


def render_markdown(report: dict[str, Any]) -> str:
    """Human-readable report. ``report`` is the dictionary written by train_static."""
    synthetic = report.get("synthetic") is True
    lines: list[str] = [f"# Evaluation report: {report.get('run_name', 'run')}", ""]
    if synthetic:
        lines += [f"> **{SYNTHETIC_BANNER}**", ""]
    protocol = report.get("protocol", {})
    lines += [
        "## Protocol",
        "",
        f"- Dataset: `{report.get('dataset_id')}` ({'SYNTHETIC' if synthetic else 'real'})",
        f"- Sign language: {report.get('sign_language')}",
        f"- Input: {report.get('hands')}-hand static vectors ({report.get('input_dim')}-D, schema `{report.get('feature_schema')}`)",
        f"- Split: {protocol.get('description', 'not recorded')}",
        f"- Signer-independent: **{'yes' if protocol.get('signer_independent') else 'NO'}**",
        f"- Train / validation / test signers: {len(protocol.get('train_signers', []))} / "
        f"{len(protocol.get('val_signers', []))} / {len(protocol.get('test_signers', []))}",
        f"- Seed: {report.get('seed')}",
        f"- Date: {report.get('date')}",
    ]
    for note in protocol.get("notes", []):
        lines.append(f"- Note: {note}")
    lines.append("")

    cleaning = report.get("cleaning")
    if cleaning:
        lines += ["## Cleaning", ""]
        lines += [f"- {key}: {value}" for key, value in cleaning.items()]
        lines.append("")

    candidates = report.get("candidates", [])
    if candidates:
        lines += [
            "## Model selection (validation signers only)",
            "",
            "| Candidate | Parameters | Validation accuracy | Validation macro-F1 |",
            "|---|---|---|---|",
        ]
        for c in candidates:
            lines.append(f"| {c['kind']} | `{json.dumps(c['params'], sort_keys=True)}` | {_pct(c['val_accuracy'])} | {_pct(c['val_macro_f1'])} |")
        lines.append("")

    for title, key in (("Selected model", "selected"), ("Browser-exportable model", "exportable")):
        block = report.get(key)
        if not block:
            continue
        test = block["test"]
        lines += [
            f"## {title}: {block['kind']} `{json.dumps(block['params'], sort_keys=True)}`",
            "",
            f"Test set: {test['n_samples']} samples from {test.get('n_signers', 'n/a')} unseen signer(s)."
            if protocol.get("signer_independent")
            else f"Test set: {test['n_samples']} samples (signers overlap with training).",
            "",
            f"- Accuracy: {_pct(test['accuracy'])}",
            f"- Macro-F1: {_pct(test['macro_f1'])}",
        ]
        if "worst_signer" in test:
            lines.append(f"- Worst signer: `{test['worst_signer']['signer_id']}` at {_pct(test['worst_signer']['accuracy'])}")
            lines.append(f"- Per-signer accuracy: mean {_pct(test['signer_accuracy_mean'])}, standard deviation {test['signer_accuracy_std'] * 100:.2f} points")
        lines += ["", "| Class | Precision | Recall | F1 | Support |", "|---|---|---|---|---|"]
        for label, m in test["per_class"].items():
            lines.append(f"| {label} | {_pct(m['precision'])} | {_pct(m['recall'])} | {_pct(m['f1'])} | {m['support']} |")
        lines.append("")
        if "per_signer" in test:
            lines += ["| Signer | Samples | Accuracy | Macro-F1 |", "|---|---|---|---|"]
            for signer, m in test["per_signer"].items():
                lines.append(f"| {signer} | {m['n_samples']} | {_pct(m['accuracy'])} | {_pct(m['macro_f1'])} |")
            lines.append("")
        if "by_hand_count" in test:
            lines += ["| Hands | Samples | Accuracy | Macro-F1 |", "|---|---|---|---|"]
            for name, m in test["by_hand_count"].items():
                lines.append(f"| {name.replace('_', '-')} | {m['n_samples']} | {_pct(m['accuracy'])} | {_pct(m['macro_f1'])} |")
            lines.append("")
        matrix = test["confusion_matrix"]
        lines += ["Confusion matrix (rows: true class, columns: predicted class)", "", "| | " + " | ".join(matrix["labels"]) + " |", "|---|" + "---|" * len(matrix["labels"])]
        for label, row in zip(matrix["labels"], matrix["rows_true_cols_predicted"]):
            lines.append(f"| **{label}** | " + " | ".join(str(v) for v in row) + " |")
        lines.append("")

    cv = report.get("signer_cross_validation")
    if cv:
        lines += [
            "## Grouped cross-validation by signer",
            "",
            f"- Folds: {cv['n_folds']}",
            f"- Accuracy: mean {_pct(cv['accuracy_mean'])}, standard deviation {cv['accuracy_std'] * 100:.2f} points, worst fold {_pct(cv['accuracy_min'])}",
            f"- Macro-F1 mean: {_pct(cv['macro_f1_mean'])}",
            "",
        ]

    validation = report.get("validation_decision")
    if validation:
        lines += ["## Validation status", "", f"- Marked validated: **{'yes' if validation['validated'] else 'no'}**"]
        lines += [f"- {reason}" for reason in validation["reasons"]]
        lines.append("")

    lines += [
        "## Not measured here",
        "",
        "- Coverage: frames where hand detection failed never reach this classifier. Measure detection rate per sign separately.",
        "- Live behaviour: these are per-frame results on stored landmarks, not end-to-end recognition in a browser.",
        "",
    ]
    return "\n".join(lines)


def write_report(report: dict[str, Any], out_dir: str | Path) -> tuple[Path, Path]:
    """Write ``report.json`` and ``report.md`` into ``out_dir``."""
    synthetic = report.get("synthetic") is True
    out_dir = Path(out_dir)
    json_path = write_json(out_dir / "report.json", report, synthetic=synthetic)
    md_path = write_text(out_dir / "report.md", render_markdown(report), synthetic=synthetic)
    return json_path, md_path


# --------------------------------------------------------------------------- #
# CLI: re-evaluate a saved run
# --------------------------------------------------------------------------- #


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-evaluate a saved training run on its recorded test rows.")
    parser.add_argument("--run", required=True, help="run directory written by training.train_static")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out", help="where to write the new report (default: <run>/re-evaluation)")
    args = parser.parse_args(argv)

    import joblib

    from rtslr_ml.dataset import clean_dataset, load_dataset, load_manifest, require_training_ready

    run_dir = Path(args.run)
    stored = json.loads((run_dir / "report.json").read_text(encoding="utf-8"))
    manifest = load_manifest(args.manifest)
    require_training_ready(manifest)
    if manifest["synthetic"] != stored.get("synthetic"):
        print("The manifest and the stored report disagree about whether the data is synthetic.", file=sys.stderr)
        return 2
    dataset, _ = clean_dataset(load_dataset(args.dataset), manifest)
    X, rows = dataset.feature_matrix(stored["hands"])
    signers = dataset.signer_ids[rows]
    test_signers = stored["protocol"]["test_signers"]
    if not test_signers:
        print("The stored run has no held-out test signers; re-run training with a signer-aware split.", file=sys.stderr)
        return 2
    mask = np.isin(signers, test_signers)
    model = joblib.load(run_dir / "model.joblib")
    metrics = evaluate_predictions(
        dataset.labels[rows][mask], model.predict(X[mask]), stored["classes"], signers[mask], dataset.hand_count[rows][mask]
    )
    report = {**stored, "run_name": f"{stored.get('run_name', 'run')} (re-evaluation)"}
    report["selected"] = {**stored["selected"], "test": metrics}
    report.pop("exportable", None)
    json_path, md_path = write_report(report, args.out or run_dir / "re-evaluation")
    print(f"accuracy {metrics['accuracy']:.4f}  macro-F1 {metrics['macro_f1']:.4f}  ({metrics['n_samples']} samples)")
    print(f"wrote {json_path} and {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
