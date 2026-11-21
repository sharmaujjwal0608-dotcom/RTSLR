"""Synthetic landmark data for code-path tests.

THIS IS NOT SIGN DATA. Each "class" is a cloud of random points around a random
centre, with made-up signer ids. Its only purpose is to exercise the pipeline.
Class names start with ``SYN`` so nobody can mistake them for signs, and every
artefact derived from it carries ``"synthetic": true``.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from rtslr_ml.dataset import LandmarkDataset

ONE_HAND_CLASSES = ("SYN1-A", "SYN1-B", "SYN1-C")
TWO_HAND_CLASSES = ("SYN2-A", "SYN2-B", "SYN2-C")
IMAGE_SIZE = (640.0, 480.0)


def make_synthetic_dataset(
    n_signers: int = 6,
    samples_per_class_per_signer: int = 10,
    seed: int = 0,
    one_hand_classes=ONE_HAND_CLASSES,
    two_hand_classes=TWO_HAND_CLASSES,
) -> LandmarkDataset:
    """Random clusters of raw "landmarks" with fake signer ids."""
    rng = np.random.default_rng(seed)
    labels, signers, sessions, counts, sources, landmarks = [], [], [], [], [], []

    def centre(x_centre: float) -> np.ndarray:
        points = rng.uniform(-0.12, 0.12, size=(21, 3))
        points[:, 0] += x_centre
        points[:, 1] += 0.5
        points[:, 2] *= 0.3
        return points

    centres: dict[str, np.ndarray] = {}
    for label in one_hand_classes:
        hand = np.full((2, 21, 3), np.nan)
        hand[0] = centre(0.5)
        centres[label] = hand
    for label in two_hand_classes:
        centres[label] = np.stack([centre(0.3), centre(0.7)])

    for s in range(n_signers):
        signer = f"fake-signer-{s:02d}"
        for label, base in centres.items():
            hands = 1 if label in one_hand_classes else 2
            signer_style = rng.normal(0.0, 0.01, size=base.shape)  # stands in for between-signer variation
            for k in range(samples_per_class_per_signer):
                sample = base + signer_style + rng.normal(0.0, 0.004, size=base.shape)
                labels.append(label)
                signers.append(signer)
                sessions.append(f"{signer}-{label}-take{k % 2}")
                counts.append(hands)
                sources.append(f"synthetic/{signer}/{label}/{k}")
                landmarks.append(sample)

    n = len(labels)
    return LandmarkDataset(
        labels=np.asarray(labels),
        signer_ids=np.asarray(signers),
        session_ids=np.asarray(sessions),
        hand_count=np.asarray(counts, dtype=np.int8),
        sources=np.asarray(sources),
        landmarks=np.asarray(landmarks, dtype=np.float32),
        image_sizes=np.tile(np.asarray(IMAGE_SIZE, dtype=np.float32), (n, 1)),
    )


def make_synthetic_manifest(
    n_signers: int = 6,
    one_hand_classes=ONE_HAND_CLASSES,
    two_hand_classes=TWO_HAND_CLASSES,
    synthetic: bool = True,
) -> dict[str, Any]:
    """A complete manifest for the synthetic data (or, with synthetic=False, a stand-in used to test the real-data code path)."""
    return {
        "format": "rtslr-dataset-manifest-1",
        "feature_schema": "rtslr-features-1",
        "dataset_id": "synthetic-pytest-clusters",
        "name": "Synthetic random clusters generated inside the test suite",
        "sign_language": "ISL",
        "synthetic": synthetic,
        "source": {
            "description": "Random numbers from numpy.random.default_rng; not recorded from any person.",
            "collected_by": "pytest (machine-learning/tests/synthetic.py)",
            "url": "",
        },
        "licence": {
            "name": "Not applicable - generated numbers",
            "terms_reference": "machine-learning/tests/synthetic.py",
            "permits_model_training": True,
            "permits_model_distribution": False,
            "attribution": "",
        },
        "consent": {
            "obtained": True,
            "description": "Not applicable - no person is involved in synthetic data.",
            "covers_model_training": True,
            "withdrawal_contact": "Not applicable - no person is involved.",
        },
        "signers": {"count": n_signers, "ids_are_anonymous": True},
        "label_inventory": {
            "verified_by": "Not applicable - class names are arbitrary SYN labels, not signs.",
            "classes": [{"label": c, "hands": 1, "motion": "static"} for c in one_hand_classes]
            + [{"label": c, "hands": 2, "motion": "static"} for c in two_hand_classes],
        },
        "notes": "SYNTHETIC. Proves the code path only.",
    }
