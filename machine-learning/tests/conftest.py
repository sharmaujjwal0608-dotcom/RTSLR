from __future__ import annotations

import json
from pathlib import Path

import pytest

from rtslr_ml.dataset import save_npz

from .synthetic import make_synthetic_dataset, make_synthetic_manifest

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def synthetic_dataset():
    return make_synthetic_dataset(n_signers=6, samples_per_class_per_signer=10, seed=0)


@pytest.fixture()
def synthetic_files(tmp_path, synthetic_dataset):
    """A synthetic dataset and its manifest on disk, in a pytest temp directory."""
    dataset_path = save_npz(synthetic_dataset, tmp_path / "synthetic.npz")
    manifest_path = tmp_path / "synthetic.manifest.json"
    manifest_path.write_text(json.dumps(make_synthetic_manifest(n_signers=6)), encoding="utf-8")
    return dataset_path, manifest_path


@pytest.fixture()
def repo_root() -> Path:
    return REPO_ROOT
