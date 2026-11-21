from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np
import pytest
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from evaluation.evaluate import evaluate_predictions, render_markdown
from exports.export_model import (
    ExportError,
    build_model_document,
    is_exportable,
    validation_decision,
    write_model_document,
)
from inference.reference import ModelFormatError, load_model_json, predict_labels, predict_scores, validate_model_document
from rtslr_ml.guards import OutputLocationError, assert_output_allowed, write_json, write_text
from training.train_static import build_estimator

FIXTURE = Path(__file__).parent / "fixtures" / "browser-parity.synthetic.json"


def clusters(n_classes: int, dim: int, seed: int = 0, per_class: int = 30):
    """Random clusters. Not sign data."""
    rng = np.random.default_rng(seed)
    centres = rng.normal(0, 1.0, size=(n_classes, dim))
    X = np.concatenate([c + rng.normal(0, 0.35, size=(per_class, dim)) for c in centres])
    y = np.repeat([f"SYN-{i}" for i in range(n_classes)], per_class)
    return X, y


def export(pipeline, hands, **overrides):
    arguments = dict(
        hands=hands,
        model_id="test-model",
        version="0.0.1",
        name="unit test",
        sign_language="ISL",
        description="Random clusters.",
        limitations=["Test only."],
        synthetic=True,
        validated=False,
        evaluation=None,
    )
    arguments.update(overrides)
    return build_model_document(pipeline, **arguments)


@pytest.mark.parametrize(("n_classes", "dim", "hands"), [(4, 63, 1), (3, 156, 2), (2, 63, 1)])
def test_mlp_export_matches_scikit_learn(tmp_path, n_classes, dim, hands):
    X, y = clusters(n_classes, dim, seed=n_classes)
    pipeline = build_estimator("mlp", {"hidden_layer_sizes": [16, 8]}, seed=0).fit(X, y)
    path = write_model_document(export(pipeline, hands), tmp_path / "m.json")
    model = load_model_json(path)

    probe = np.concatenate([X, np.random.default_rng(9).normal(0, 2, size=(50, dim))])
    np.testing.assert_allclose(predict_scores(model, probe), pipeline.predict_proba(probe), atol=1e-5)
    np.testing.assert_array_equal(predict_labels(model, probe), pipeline.predict(probe))
    np.testing.assert_allclose(predict_scores(model, probe).sum(axis=1), 1.0, atol=1e-9)

    document = json.loads(path.read_text(encoding="utf-8"))
    assert [layer["activation"] for layer in document["mlp"]["layers"]] == ["relu", "relu", "softmax"]
    assert len(document["mlp"]["layers"][0]["W"]) == 16 and len(document["mlp"]["layers"][0]["W"][0]) == dim
    assert len(document["mlp"]["layers"][-1]["W"]) == n_classes  # two classes: sigmoid unit expanded to softmax
    assert document["classes"] == sorted(set(y))
    assert "knn" not in document


@pytest.mark.parametrize("k", [1, 5])
def test_knn_export_matches_scikit_learn(tmp_path, k):
    X, y = clusters(4, 156, seed=5)
    pipeline = build_estimator("knn", {"n_neighbors": k}, seed=0).fit(X, y)
    model = load_model_json(write_model_document(export(pipeline, 2), tmp_path / "k.json"))
    probe = np.concatenate([X, np.random.default_rng(3).normal(0, 1.5, size=(60, 156))])
    np.testing.assert_array_equal(predict_labels(model, probe), pipeline.predict(probe))
    np.testing.assert_allclose(predict_scores(model, probe), pipeline.predict_proba(probe), atol=1e-9)


def test_only_browser_models_are_exportable():
    X, y = clusters(3, 63)
    assert is_exportable(build_estimator("mlp", {"hidden_layer_sizes": [8]}, 0).fit(X, y))
    assert is_exportable(build_estimator("knn", {"n_neighbors": 3}, 0).fit(X, y))
    for kind, params in (("svm", {"C": 1.0}), ("rf", {"n_estimators": 10})):
        pipeline = build_estimator(kind, params, 0).fit(X, y)
        assert not is_exportable(pipeline)
        with pytest.raises(ExportError, match="offline baseline"):
            export(pipeline, 1)
    assert isinstance(build_estimator("svm", {"C": 1.0}, 0).steps[1][1], SVC)
    assert isinstance(build_estimator("rf", {"n_estimators": 10}, 0).steps[1][1], RandomForestClassifier)

    tanh = Pipeline([("s", StandardScaler()), ("c", MLPClassifier(hidden_layer_sizes=(4,), activation="tanh", max_iter=50, random_state=0))]).fit(X, y)
    with pytest.raises(ExportError, match="relu"):
        export(tanh, 1)
    euclidean = Pipeline([("s", StandardScaler()), ("c", KNeighborsClassifier(n_neighbors=3))]).fit(X, y)
    with pytest.raises(ExportError, match="cosine"):
        export(euclidean, 1)
    with pytest.raises(ExportError, match="StandardScaler"):
        export(Pipeline([("a", MLPClassifier()), ("b", MLPClassifier())]), 1)
    with pytest.raises(ExportError, match="156-D"):
        export(build_estimator("knn", {"n_neighbors": 3}, 0).fit(X, y), 2)
    with pytest.raises(ValueError):
        build_estimator("xgboost", {}, 0)


def test_export_honesty_rules():
    X, y = clusters(3, 63)
    pipeline = build_estimator("knn", {"n_neighbors": 3}, 0).fit(X, y)
    evaluation = {"protocol": "p", "metrics": {"accuracy": 0.5}, "datasetId": "d", "date": "2026-01-01"}

    synthetic = export(pipeline, 1, evaluation=evaluation)  # an evaluation passed for synthetic data is dropped
    assert synthetic["synthetic"] is True and synthetic["evaluation"] is None
    assert synthetic["info"]["kind"] == "simulator" and synthetic["info"]["validated"] is False
    assert synthetic["info"]["name"].startswith("SYNTHETIC TEST MODEL")
    assert "SYNTHETIC DATA" in synthetic["info"]["description"]

    with pytest.raises(ExportError, match="never be marked validated"):
        export(pipeline, 1, synthetic=True, validated=True, evaluation=evaluation)
    with pytest.raises(ExportError, match="not exported for the browser"):
        export(pipeline, 1, synthetic=False, validated=False)
    with pytest.raises(ExportError, match="evaluation block"):
        export(pipeline, 1, synthetic=False, validated=True, evaluation=None)

    real = export(pipeline, 1, synthetic=False, validated=True, evaluation=evaluation)
    assert "synthetic" not in real
    assert real["info"]["kind"] == "validated_isl" and real["evaluation"] == evaluation


def test_validation_policy():
    ok = validation_decision(synthetic=False, signer_independent=True, n_test_signers=3, mark_validated=True)
    assert ok["validated"] is True
    cases = [
        dict(synthetic=True, signer_independent=True, n_test_signers=5, mark_validated=True),
        dict(synthetic=False, signer_independent=False, n_test_signers=5, mark_validated=True),
        dict(synthetic=False, signer_independent=True, n_test_signers=2, mark_validated=True),
        dict(synthetic=False, signer_independent=True, n_test_signers=5, mark_validated=False),
    ]
    for case in cases:
        decision = validation_decision(**case)
        assert decision["validated"] is False and decision["reasons"]


def test_oversized_export_is_refused(tmp_path):
    X, y = clusters(3, 156, per_class=1600)
    pipeline = build_estimator("knn", {"n_neighbors": 3}, 0).fit(X, y)
    with pytest.raises(ExportError, match="at most 5 MB"):
        write_model_document(export(pipeline, 2), tmp_path / "big.json")
    assert not (tmp_path / "big.json").exists()


def test_reference_loader_rejects_malformed_documents(tmp_path):
    X, y = clusters(3, 63)
    good = export(build_estimator("mlp", {"hidden_layer_sizes": [4]}, 0).fit(X, y), 1)
    validate_model_document(good)

    def broken(mutate):
        document = copy.deepcopy(good)
        mutate(document)
        return document

    mutations = [
        lambda d: d.update(format="rtslr-model-0"),
        lambda d: d.update(featureSchema="x"),
        lambda d: d.update(inputDim=126),
        lambda d: d.update(extra=1),
        lambda d: d.update(classes=["a"]),
        lambda d: d.update(classes=["__proto__", "b", "c"]),
        lambda d: d.update(type="onnx"),
        lambda d: d["standardizer"].update(scale=[0.0] * 63),
        lambda d: d["standardizer"].update(mean=[0.0] * 62),
        lambda d: d["mlp"]["layers"][0].update(activation="tanh"),
        lambda d: d["mlp"]["layers"][-1].update(activation="relu"),
        lambda d: d["mlp"]["layers"][0]["W"][0].__setitem__(0, float("nan")),
        lambda d: d["mlp"]["layers"][0]["W"][0].pop(),
        lambda d: d["mlp"]["layers"][0].update(b=[0.0]),
        lambda d: d["mlp"]["layers"].pop(),
        lambda d: d.update(knn={"k": 1, "metric": "cosine", "samples": []}),
        lambda d: d.update(evaluation={"protocol": "p", "metrics": {"a": "high"}, "datasetId": "d", "date": "x"}),
    ]
    for i, mutate in enumerate(mutations):
        with pytest.raises(ModelFormatError):
            validate_model_document(broken(mutate))
            pytest.fail(f"mutation {i} was accepted")
    with pytest.raises(ModelFormatError):
        validate_model_document([good])
    with pytest.raises(ValueError, match="63-D"):
        predict_scores(validate_model_document(good), np.zeros((2, 156)))


def test_guards_keep_artefacts_out_of_protected_folders(tmp_path, repo_root):
    for inside in ("frontend/public/models/x.json", "research/data/rtslr-experiments.json", "docs/x.md", "backend/x.json"):
        for synthetic in (True, False):
            with pytest.raises(OutputLocationError):
                assert_output_allowed(repo_root / inside, synthetic)
    assert assert_output_allowed(tmp_path / "ok.json", True) == (tmp_path / "ok.json").resolve()
    assert assert_output_allowed(repo_root / "machine-learning" / "runs" / "x" / "report.json", True)

    with pytest.raises(ValueError, match='"synthetic": true'):
        write_json(tmp_path / "a.json", {"x": 1}, synthetic=True)
    with pytest.raises(ValueError):
        write_json(tmp_path / "a.json", {"synthetic": True}, synthetic=False)
    with pytest.raises(ValueError):
        write_json(tmp_path / "a.json", {"synthetic": True, "x": float("nan")}, synthetic=True)
    with pytest.raises(ValueError, match="SYNTHETIC"):
        write_text(tmp_path / "a.md", "# report", synthetic=True)
    assert not (tmp_path / "a.json").exists() or (tmp_path / "a.json").read_text() == ""
    write_json(tmp_path / "b.json", {"synthetic": True}, synthetic=True)
    assert json.loads((tmp_path / "b.json").read_text(encoding="utf-8")) == {"synthetic": True}


def test_evaluation_metrics_on_a_hand_made_example():
    y_true = ["a", "a", "a", "b", "b", "c"]
    y_pred = ["a", "a", "b", "b", "b", "a"]
    signers = ["s1", "s1", "s2", "s2", "s2", "s2"]
    hands = [1, 1, 1, 2, 2, 2]
    result = evaluate_predictions(y_true, y_pred, ["a", "b", "c"], signers, hands)
    assert result["accuracy"] == pytest.approx(4 / 6)
    assert result["per_class"]["a"] == {"precision": pytest.approx(2 / 3), "recall": pytest.approx(2 / 3), "f1": pytest.approx(2 / 3), "support": 3}
    assert result["per_class"]["b"]["precision"] == pytest.approx(2 / 3) and result["per_class"]["b"]["recall"] == 1.0
    assert result["per_class"]["c"] == {"precision": 0.0, "recall": 0.0, "f1": 0.0, "support": 1}
    assert result["macro_f1"] == pytest.approx((2 / 3 + 0.8 + 0.0) / 3)
    assert result["confusion_matrix"]["rows_true_cols_predicted"] == [[2, 1, 0], [0, 2, 0], [1, 0, 0]]
    assert result["per_signer"]["s1"]["accuracy"] == 1.0
    assert result["per_signer"]["s2"]["accuracy"] == pytest.approx(0.5)
    assert result["worst_signer"] == {"signer_id": "s2", "accuracy": pytest.approx(0.5)}
    assert result["by_hand_count"]["one_hand"] == {"n_samples": 3, "accuracy": pytest.approx(2 / 3), "macro_f1": pytest.approx(result["by_hand_count"]["one_hand"]["macro_f1"])}
    assert result["by_hand_count"]["two_hand"]["accuracy"] == pytest.approx(2 / 3)
    with pytest.raises(ValueError):
        evaluate_predictions([], [], ["a"])
    with pytest.raises(ValueError):
        evaluate_predictions(["a"], ["a", "b"], ["a", "b"])

    report = {
        "synthetic": True,
        "run_name": "unit",
        "protocol": {"description": "d", "signer_independent": False, "train_signers": [], "val_signers": [], "test_signers": [], "notes": ["n"]},
        "selected": {"kind": "knn", "params": {"n_neighbors": 1}, "test": result},
    }
    markdown = render_markdown(report)
    assert "SYNTHETIC DATA" in markdown and "Signer-independent: **NO**" in markdown and "| **c** | 1 | 0 | 0 |" in markdown


def test_committed_browser_parity_fixture_still_matches_the_reference():
    """Regression test for the fixture the frontend's exportedModel test reads."""
    if not FIXTURE.is_file():
        pytest.skip("fixture not generated yet: run `python -m tests.make_browser_parity_fixture`")
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["synthetic"] is True
    assert {entry["model"]["type"] for entry in fixture["models"]} == {"mlp", "knn"}
    for entry in fixture["models"]:
        assert entry["model"]["synthetic"] is True
        model = validate_model_document(entry["model"])
        inputs = np.asarray(entry["inputs"])
        np.testing.assert_allclose(predict_scores(model, inputs), np.asarray(entry["expectedScores"]), atol=1e-6)
        assert predict_labels(model, inputs).tolist() == entry["expectedLabels"]
