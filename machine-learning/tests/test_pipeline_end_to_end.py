"""The whole static pipeline, end to end, on SYNTHETIC data.

These tests prove that the code path works: manifest gate -> inspection ->
cleaning -> features -> signer-aware split -> training -> evaluation -> export
-> inference parity. The numbers they produce describe random clusters and
mean nothing about sign language. Assertions therefore check structure,
protocol and consistency - never that an accuracy is "good".
"""

from __future__ import annotations

import json

import joblib
import numpy as np
import pytest

from evaluation import evaluate as evaluate_cli
from exports import export_model as export_cli
from inference.reference import load_model_json, predict_labels, predict_scores
from rtslr_ml.dataset import load_dataset, save_npz
from rtslr_ml.guards import OutputLocationError
from training import train_static
from training.train_static import run_training

from .synthetic import ONE_HAND_CLASSES, TWO_HAND_CLASSES, make_synthetic_dataset, make_synthetic_manifest

FAST = ("knn", "mlp")


def find_key(node, key):
    """Every value stored under `key` anywhere in a nested JSON structure."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == key:
                yield v
            yield from find_key(v, key)
    elif isinstance(node, list):
        for item in node:
            yield from find_key(item, key)


@pytest.mark.parametrize(("hands", "expected_classes", "dim"), [(1, ONE_HAND_CLASSES, 63), (2, TWO_HAND_CLASSES, 156)])
def test_full_pipeline_on_synthetic_data(synthetic_files, tmp_path, hands, expected_classes, dim):
    dataset_path, manifest_path = synthetic_files
    out = tmp_path / f"run-{hands}"
    report = run_training(
        dataset_path,
        manifest_path,
        hands,
        out,
        seed=0,
        candidates=("knn", "mlp", "svm", "rf"),
        n_val_signers=1,
        n_test_signers=2,
        cv_folds=3,
        date="2026-01-01",
    )

    # Every artefact says it is synthetic.
    assert report["synthetic"] is True
    stored = json.loads((out / "report.json").read_text(encoding="utf-8"))
    assert stored["synthetic"] is True
    assert json.loads((out / "split.json").read_text(encoding="utf-8"))["synthetic"] is True
    markdown = (out / "report.md").read_text(encoding="utf-8")
    assert "SYNTHETIC DATA" in markdown
    assert "Signer-independent: **yes**" in markdown

    # Only the requested hand count was used.
    assert report["hands"] == hands and report["input_dim"] == dim
    assert report["classes"] == sorted(expected_classes)
    assert report["n_samples_used"] == 180

    # Protocol: whole signers held out, recorded in the report.
    protocol = report["protocol"]
    assert protocol["name"] == "signer_holdout" and protocol["signer_independent"] is True
    assert len(protocol["train_signers"]) == 3 and len(protocol["val_signers"]) == 1 and len(protocol["test_signers"]) == 2
    assert not set(protocol["train_signers"]) & set(protocol["test_signers"])
    assert not set(protocol["train_signers"]) & set(protocol["val_signers"])
    assert report["split_sizes"] == {"train": 90, "val": 30, "test": 60}

    # All four candidate families were fitted and ranked on validation signers.
    kinds = {c["kind"] for c in report["candidates"]}
    assert kinds == {"knn", "mlp", "svm", "rf"}
    scores = [c["val_macro_f1"] for c in report["candidates"]]
    assert scores == sorted(scores, reverse=True)
    assert report["selected"]["kind"] == report["candidates"][0]["kind"]

    # Evaluation block is complete and internally consistent.
    test = report["selected"]["test"]
    assert test["n_samples"] == 60 and test["n_signers"] == 2
    assert set(test["per_signer"]) == set(protocol["test_signers"])
    assert set(test["per_class"]) == set(expected_classes)
    matrix = np.asarray(test["confusion_matrix"]["rows_true_cols_predicted"])
    assert matrix.shape == (3, 3) and matrix.sum() == 60
    assert test["accuracy"] == pytest.approx(np.trace(matrix) / 60)
    assert 0.0 <= test["macro_f1"] <= 1.0
    assert test["worst_signer"]["signer_id"] in protocol["test_signers"]
    other = "two_hand" if hands == 1 else "one_hand"
    this = "one_hand" if hands == 1 else "two_hand"
    assert test["by_hand_count"][this]["n_samples"] == 60
    assert test["by_hand_count"][other]["n_samples"] == 0
    assert report["signer_cross_validation"]["n_folds"] == 3

    # Never validated, whatever the score.
    assert report["validation_decision"]["validated"] is False
    assert any("synthetic" in r.lower() for r in report["validation_decision"]["reasons"])

    # Export exists, is marked synthetic, and reproduces scikit-learn.
    assert report["browser_export"]["written"] is True
    exported = json.loads((out / "browser-model.json").read_text(encoding="utf-8"))
    assert exported["synthetic"] is True
    assert exported["format"] == "rtslr-model-1" and exported["featureSchema"] == "rtslr-features-1"
    assert exported["inputDim"] == dim
    assert exported["info"]["validated"] is False
    assert exported["info"]["kind"] == "simulator"
    assert exported["info"]["scoreType"] == "classifier_score"
    assert exported["evaluation"] is None
    assert "SYNTHETIC" in exported["info"]["name"]
    assert all(c["hands"] == hands for c in exported["info"]["classes"])
    assert report["export_parity"]["passed"] is True
    assert report["export_parity"]["label_agreement"] == 1.0

    # Independent parity check from the files on disk.
    pipeline = joblib.load(out / "exportable.joblib")
    cleaned = load_dataset(dataset_path)
    X, rows = cleaned.feature_matrix(hands)
    model = load_model_json(out / "browser-model.json")
    np.testing.assert_array_equal(predict_labels(model, X), pipeline.predict(X).astype(str))
    if exported["type"] == "mlp":
        np.testing.assert_allclose(predict_scores(model, X), pipeline.predict_proba(X), atol=1e-4)

    # No absolute paths or personal identifiers beyond the fake signer ids leak into the report.
    assert all(str(s).startswith("fake-signer-") for s in find_key(stored, "signer_id"))


def test_runs_are_reproducible_with_a_fixed_seed(synthetic_files, tmp_path):
    dataset_path, manifest_path = synthetic_files
    first = run_training(dataset_path, manifest_path, 2, tmp_path / "a", seed=7, candidates=FAST, date="2026-01-01")
    second = run_training(dataset_path, manifest_path, 2, tmp_path / "b", seed=7, candidates=FAST, date="2026-01-01")
    assert first["protocol"]["test_signers"] == second["protocol"]["test_signers"]
    assert first["candidates"] == second["candidates"]
    assert first["selected"]["test"] == second["selected"]["test"]
    a = json.loads((tmp_path / "a" / "browser-model.json").read_text(encoding="utf-8"))
    b = json.loads((tmp_path / "b" / "browser-model.json").read_text(encoding="utf-8"))
    assert a == b


def test_training_refuses_an_incomplete_manifest(synthetic_files, tmp_path):
    dataset_path, _ = synthetic_files
    manifest = make_synthetic_manifest()
    manifest["consent"]["obtained"] = False
    manifest["licence"]["name"] = ""
    bad = tmp_path / "bad.manifest.json"
    bad.write_text(json.dumps(manifest), encoding="utf-8")
    out = tmp_path / "never"
    assert train_static.main(["--dataset", str(dataset_path), "--manifest", str(bad), "--hands", "1", "--out", str(out)]) == 2
    assert not out.exists()
    assert train_static.main(["--dataset", str(dataset_path), "--manifest", str(tmp_path / "missing.json"), "--hands", "1", "--out", str(out)]) == 2
    assert not out.exists()


def test_synthetic_artefacts_cannot_be_written_into_the_app_or_research_folders(synthetic_files, repo_root):
    dataset_path, manifest_path = synthetic_files
    for forbidden in (
        repo_root / "frontend" / "public" / "models" / "isl",
        repo_root / "research" / "data",
        repo_root / "research" / "experiments" / "synthetic-run",
    ):
        with pytest.raises(OutputLocationError):
            run_training(dataset_path, manifest_path, 1, forbidden, candidates=("knn",))
    experiments = repo_root / "research" / "data" / "rtslr-experiments.json"
    if experiments.is_file():
        assert "synthetic-pytest-clusters" not in experiments.read_text(encoding="utf-8")
    assert not (repo_root / "frontend" / "public" / "models" / "isl" / "report.json").exists()


def test_random_split_needs_an_explicit_override_and_can_never_be_validated(synthetic_files, tmp_path):
    dataset_path, manifest_path = synthetic_files
    out = tmp_path / "random"
    report = run_training(
        dataset_path, manifest_path, 1, out, candidates=("knn",), allow_random_split=True, mark_validated=True
    )
    assert report["protocol"]["name"] == "random_split"
    assert report["protocol"]["signer_independent"] is False
    assert report["validation_decision"]["validated"] is False
    assert any("not signer-independent" in r for r in report["validation_decision"]["reasons"])
    assert "Signer-independent: **NO**" in (out / "report.md").read_text(encoding="utf-8")


def test_real_data_path_withholds_the_browser_export_until_the_policy_is_met(tmp_path):
    """Uses the synthetic numbers with a manifest that says "not synthetic" to
    exercise the real-data branch. Nothing here is a real result; the run lives
    only in pytest's temp directory."""
    dataset = make_synthetic_dataset(n_signers=8, samples_per_class_per_signer=6, seed=3)
    dataset_path = save_npz(dataset, tmp_path / "d.npz")
    manifest_path = tmp_path / "m.json"
    manifest_path.write_text(json.dumps(make_synthetic_manifest(n_signers=8, synthetic=False)), encoding="utf-8")

    # Policy not met (1 test signer, not marked): no browser model is written.
    held = run_training(dataset_path, manifest_path, 2, tmp_path / "held", candidates=FAST, n_test_signers=1)
    assert held["synthetic"] is False
    assert held["validation_decision"]["validated"] is False
    assert held["browser_export"]["written"] is False
    assert "not exported" in held["browser_export"]["reason"]
    assert not (tmp_path / "held" / "browser-model.json").exists()
    assert (tmp_path / "held" / "report.json").exists()  # the evaluation itself is still reported

    # Enough unseen signers but not explicitly marked: still withheld.
    unmarked = run_training(dataset_path, manifest_path, 2, tmp_path / "unmarked", candidates=FAST, n_val_signers=2, n_test_signers=3)
    assert unmarked["browser_export"]["written"] is False

    # Policy met: export carries the evaluation block and the protocol text.
    passed = run_training(
        dataset_path, manifest_path, 2, tmp_path / "passed", candidates=FAST, n_val_signers=2, n_test_signers=3, mark_validated=True, date="2026-02-02"
    )
    assert passed["validation_decision"]["validated"] is True
    exported = json.loads((tmp_path / "passed" / "browser-model.json").read_text(encoding="utf-8"))
    assert "synthetic" not in exported
    assert exported["info"]["kind"] == "validated_isl" and exported["info"]["validated"] is True
    assert exported["info"]["scoreType"] == "classifier_score"
    evaluation = exported["evaluation"]
    assert set(evaluation) == {"protocol", "metrics", "datasetId", "date"}
    assert "signer-independent" in evaluation["protocol"]
    assert evaluation["metrics"]["n_test_signers"] == 3
    assert evaluation["metrics"]["accuracy"] == passed["exportable"]["test"]["accuracy"]
    assert evaluation["date"] == "2026-02-02"
    assert passed["export_parity"]["passed"] is True


def test_command_line_train_evaluate_and_export(synthetic_files, tmp_path, capsys):
    dataset_path, manifest_path = synthetic_files
    out = tmp_path / "cli-run"
    code = train_static.main(
        ["--dataset", str(dataset_path), "--manifest", str(manifest_path), "--hands", "2", "--out", str(out), "--candidates", "knn,mlp", "--seed", "1"]
    )
    printed = capsys.readouterr().out
    assert code == 0
    assert "SYNTHETIC DATA" in printed
    assert "signer-independent" in printed
    assert "export parity passed: True" in printed

    assert evaluate_cli.main(["--run", str(out), "--dataset", str(dataset_path), "--manifest", str(manifest_path)]) == 0
    again = json.loads((out / "re-evaluation" / "report.json").read_text(encoding="utf-8"))
    original = json.loads((out / "report.json").read_text(encoding="utf-8"))
    assert again["synthetic"] is True
    assert again["selected"]["test"]["accuracy"] == original["selected"]["test"]["accuracy"]
    assert again["selected"]["test"]["confusion_matrix"] == original["selected"]["test"]["confusion_matrix"]

    target = tmp_path / "re-export.json"
    assert export_cli.main(["--run", str(out), "--out", str(target)]) == 0
    assert json.loads(target.read_text(encoding="utf-8")) == json.loads((out / "browser-model.json").read_text(encoding="utf-8"))

    assert train_static.main(["--dataset", str(dataset_path), "--manifest", str(manifest_path), "--hands", "2", "--out", str(tmp_path / "x"), "--candidates", "xgboost"]) == 2
