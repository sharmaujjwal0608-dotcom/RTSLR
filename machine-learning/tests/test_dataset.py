from __future__ import annotations

import copy
import json

import numpy as np
import pytest

from rtslr_ml.dataset import (
    DatasetError,
    LandmarkDataset,
    ManifestError,
    clean_dataset,
    inspect_dataset,
    load_csv,
    load_dataset,
    load_manifest,
    load_npz,
    manifest_problems,
    require_training_ready,
    save_csv,
    save_npz,
    validate_labels,
)

from .synthetic import ONE_HAND_CLASSES, TWO_HAND_CLASSES, make_synthetic_dataset, make_synthetic_manifest


def small() -> LandmarkDataset:
    return make_synthetic_dataset(n_signers=3, samples_per_class_per_signer=2, seed=1)


def test_synthetic_dataset_shape(synthetic_dataset):
    n = 6 * 10 * 6
    assert len(synthetic_dataset) == n
    assert synthetic_dataset.landmarks.shape == (n, 2, 21, 3)
    one_hand = synthetic_dataset.hand_count == 1
    assert np.all(np.isnan(synthetic_dataset.landmarks[one_hand, 1]))
    assert np.all(np.isfinite(synthetic_dataset.landmarks[~one_hand]))


def test_feature_matrix_separates_one_and_two_hand_rows(synthetic_dataset):
    X1, rows1 = synthetic_dataset.feature_matrix(1)
    X2, rows2 = synthetic_dataset.feature_matrix(2)
    assert X1.shape == (180, 63) and X2.shape == (180, 156)
    assert set(synthetic_dataset.labels[rows1]) == set(ONE_HAND_CLASSES)
    assert set(synthetic_dataset.labels[rows2]) == set(TWO_HAND_CLASSES)
    assert not set(rows1) & set(rows2)
    assert np.all(np.isfinite(X1)) and np.all(np.isfinite(X2))
    with pytest.raises(ValueError):
        synthetic_dataset.feature_matrix(3)


def test_npz_round_trip(tmp_path):
    dataset = small()
    loaded = load_npz(save_npz(dataset, tmp_path / "d.npz"))
    np.testing.assert_array_equal(loaded.labels, dataset.labels)
    np.testing.assert_array_equal(loaded.signer_ids, dataset.signer_ids)
    np.testing.assert_array_equal(loaded.landmarks, dataset.landmarks)
    np.testing.assert_array_equal(loaded.all_features(), dataset.all_features())


def test_csv_round_trip(tmp_path):
    dataset = small()
    loaded = load_csv(save_csv(dataset, tmp_path / "d.csv"))
    np.testing.assert_array_equal(loaded.labels, dataset.labels)
    np.testing.assert_array_equal(loaded.hand_count, dataset.hand_count)
    np.testing.assert_array_equal(loaded.landmarks, dataset.landmarks)  # NaN-aware, exact float32 round trip
    np.testing.assert_array_equal(loaded.image_sizes, dataset.image_sizes)
    assert isinstance(load_dataset(tmp_path / "d.csv"), LandmarkDataset)


def test_features_only_dataset(tmp_path):
    dataset = small()
    features_only = LandmarkDataset(
        labels=dataset.labels,
        signer_ids=dataset.signer_ids,
        session_ids=dataset.session_ids,
        hand_count=dataset.hand_count,
        sources=dataset.sources,
        features=dataset.all_features(),
    )
    loaded = load_npz(save_npz(features_only, tmp_path / "f.npz"))
    assert loaded.landmarks is None
    np.testing.assert_array_equal(loaded.feature_matrix(2)[0], dataset.feature_matrix(2)[0])
    with pytest.raises(DatasetError):
        save_csv(loaded, tmp_path / "f.csv")


def test_malformed_datasets_are_rejected(tmp_path):
    dataset = small()
    with pytest.raises(DatasetError):
        LandmarkDataset(dataset.labels, dataset.signer_ids[:-1], dataset.session_ids, dataset.hand_count, dataset.sources, dataset.landmarks, dataset.image_sizes)
    with pytest.raises(DatasetError):
        LandmarkDataset(dataset.labels, dataset.signer_ids, dataset.session_ids, np.full(len(dataset), 3), dataset.sources, dataset.landmarks, dataset.image_sizes)
    with pytest.raises(DatasetError):
        LandmarkDataset(dataset.labels, dataset.signer_ids, dataset.session_ids, dataset.hand_count, dataset.sources)
    with pytest.raises(DatasetError):
        LandmarkDataset(dataset.labels, dataset.signer_ids, dataset.session_ids, dataset.hand_count, dataset.sources, dataset.landmarks)
    np.savez(tmp_path / "bad.npz", labels=dataset.labels)
    with pytest.raises(DatasetError):
        load_npz(tmp_path / "bad.npz")
    with pytest.raises(DatasetError):
        load_dataset(tmp_path / "data.parquet")


# --------------------------------------------------------------------------- #
# Manifest gate
# --------------------------------------------------------------------------- #


def test_complete_manifest_passes():
    manifest = make_synthetic_manifest()
    assert manifest_problems(manifest) == []
    require_training_ready(manifest)


def test_the_shipped_template_does_not_authorise_training(repo_root):
    template = load_manifest(repo_root / "machine-learning" / "data" / "manifest.template.json")
    problems = manifest_problems(template)
    assert any("licence.name" in p for p in problems)
    assert any("consent.obtained" in p for p in problems)
    assert any("licence.permits_model_training" in p for p in problems)
    with pytest.raises(ManifestError, match="does not authorise training"):
        require_training_ready(template)


@pytest.mark.parametrize(
    ("path", "value", "expected"),
    [
        (("licence", "name"), "", "licence.name"),
        (("licence", "name"), "TODO", "licence.name"),
        (("licence", "terms_reference"), "<url>", "licence.terms_reference"),
        (("licence", "permits_model_training"), False, "licence.permits_model_training"),
        (("licence", "permits_model_training"), "yes", "licence.permits_model_training"),
        (("licence", "permits_model_distribution"), None, "licence.permits_model_distribution"),
        (("consent", "obtained"), False, "consent.obtained"),
        (("consent", "covers_model_training"), False, "consent.covers_model_training"),
        (("consent", "description"), "  ", "consent.description"),
        (("consent", "withdrawal_contact"), "unknown", "consent.withdrawal_contact"),
        (("signers", "ids_are_anonymous"), False, "signers.ids_are_anonymous"),
        (("signers", "count"), 0, "signers.count"),
        (("source", "collected_by"), "tbd", "source.collected_by"),
        (("label_inventory", "verified_by"), "", "label_inventory.verified_by"),
        (("label_inventory", "classes"), [], "label_inventory.classes"),
        (("label_inventory", "classes"), [{"label": "A", "hands": 3, "motion": "static"}, {"label": "A", "hands": 1, "motion": "x"}], "label_inventory.classes"),
        (("format",), "v0", "format"),
        (("feature_schema",), "other", "feature_schema"),
        (("synthetic",), "no", "synthetic"),
        (("sign_language",), "BSL", "sign_language"),
        (("dataset_id",), "", "dataset_id"),
    ],
)
def test_each_missing_field_blocks_training(path, value, expected):
    manifest = copy.deepcopy(make_synthetic_manifest())
    node = manifest
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value
    problems = manifest_problems(manifest)
    assert any(expected in p for p in problems), problems
    with pytest.raises(ManifestError):
        require_training_ready(manifest)


def test_missing_or_broken_manifest_file(tmp_path):
    with pytest.raises(ManifestError, match="cannot be used without one"):
        load_manifest(tmp_path / "absent.json")
    (tmp_path / "broken.json").write_text("{", encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(tmp_path / "broken.json")
    (tmp_path / "list.json").write_text(json.dumps([1]), encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(tmp_path / "list.json")


# --------------------------------------------------------------------------- #
# Label validation, inspection, cleaning
# --------------------------------------------------------------------------- #


def corrupted() -> tuple[LandmarkDataset, dict]:
    """The small dataset with one of each problem planted in it."""
    base = small()  # 3 signers x 6 classes x 2 = 36 rows
    labels = base.labels.astype("<U32")  # wide enough for the planted label
    hand_count = base.hand_count.copy()
    landmarks = base.landmarks.copy()
    signers = base.signer_ids.copy()

    labels[0] = "NOT-IN-INVENTORY"
    one_hand_rows = np.flatnonzero(base.hand_count == 1)
    two_hand_rows = np.flatnonzero(base.hand_count == 2)
    # A two-hand row relabelled as a one-hand class: hand count contradicts the inventory.
    labels[two_hand_rows[0]] = ONE_HAND_CLASSES[0]
    # Non-finite landmark.
    landmarks[one_hand_rows[2], 0, 4, 1] = np.inf
    # Exact duplicate of another row (same label).
    landmarks[one_hand_rows[4]] = landmarks[one_hand_rows[3]]
    labels[one_hand_rows[4]] = labels[one_hand_rows[3]]
    # Duplicate with a conflicting label, recorded under another signer.
    landmarks[two_hand_rows[5]] = landmarks[two_hand_rows[2]]
    labels[two_hand_rows[5]] = TWO_HAND_CLASSES[1] if labels[two_hand_rows[2]] != TWO_HAND_CLASSES[1] else TWO_HAND_CLASSES[2]
    signers[two_hand_rows[5]] = "fake-signer-02" if signers[two_hand_rows[2]] != "fake-signer-02" else "fake-signer-01"

    dataset = LandmarkDataset(labels, signers, base.session_ids, hand_count, base.sources, landmarks, base.image_sizes)
    return dataset, make_synthetic_manifest(n_signers=3)


def test_label_validation_reports_every_problem():
    dataset, manifest = corrupted()
    report = validate_labels(dataset, manifest)
    assert report["unknown_labels"] == {"NOT-IN-INVENTORY": 1}
    assert report["unknown_label_rows"] == [0]
    assert len(report["hand_count_mismatch_rows"]) == 1
    assert report["signer_count_matches"] is True
    assert report["ok"] is False
    assert validate_labels(small(), manifest)["ok"] is True

    wrong_count = make_synthetic_manifest(n_signers=9)
    assert validate_labels(small(), wrong_count)["signer_count_matches"] is False


def test_classes_marked_dynamic_are_flagged_and_dropped():
    dataset = small()
    manifest = make_synthetic_manifest(n_signers=3)
    manifest["label_inventory"]["classes"][0]["motion"] = "dynamic"
    report = validate_labels(dataset, manifest)
    assert len(report["dynamic_class_rows"]) == 6
    cleaned, log = clean_dataset(dataset, manifest)
    assert log["dropped_dynamic_class"] == 6
    assert ONE_HAND_CLASSES[0] not in set(cleaned.labels)


def test_inspection_reports_balance_and_duplicates():
    clean_report = inspect_dataset(small())
    assert clean_report["n_samples"] == 36
    assert clean_report["n_classes"] == 6
    assert clean_report["n_signers"] == 3
    assert clean_report["samples_per_class"] == {c: 6 for c in sorted(ONE_HAND_CLASSES + TWO_HAND_CLASSES)}
    assert clean_report["signers_per_class"][ONE_HAND_CLASSES[0]] == 3
    assert clean_report["imbalance_ratio"] == 1.0
    assert clean_report["exact_duplicate_rows"] == 0
    assert clean_report["classes_with_mixed_hand_counts"] == []

    dataset, _ = corrupted()
    report = inspect_dataset(dataset)
    assert report["n_non_finite"] == 1
    assert report["exact_duplicate_rows"] == 2
    assert report["duplicates_with_conflicting_labels"] == 1
    assert report["duplicates_across_signers"] >= 1
    assert report["classes_with_mixed_hand_counts"] == [ONE_HAND_CLASSES[0]]
    assert report["imbalance_ratio"] > 1.0


def test_cleaning_removes_exactly_the_planted_problems():
    dataset, manifest = corrupted()
    cleaned, log = clean_dataset(dataset, manifest)
    assert log == {
        "rows_in": 36,
        "dropped_non_finite": 1,
        "dropped_unknown_label": 1,
        "dropped_hand_count_mismatch": 1,
        "dropped_dynamic_class": 0,
        "dropped_conflicting_duplicates": 2,
        "dropped_exact_duplicates": 1,
        "rows_out": 30,
    }
    assert len(cleaned) == 30
    after = inspect_dataset(cleaned)
    assert after["n_non_finite"] == 0
    assert after["exact_duplicate_rows"] == 0
    assert validate_labels(cleaned, manifest)["unknown_labels"] == {}
    assert validate_labels(cleaned, manifest)["hand_count_mismatch_rows"] == []

    untouched, clean_log = clean_dataset(small(), manifest)
    assert clean_log["rows_out"] == clean_log["rows_in"] == len(untouched) == 36
