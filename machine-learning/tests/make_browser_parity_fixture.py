"""Regenerate ``tests/fixtures/browser-parity.synthetic.json``.

The fixture holds two small models trained on SYNTHETIC random clusters, a set
of input vectors, and the scores scikit-learn gives for them. It exists so that
the browser implementation (frontend/src/features/recognition/models/
exportedModel.ts) can be checked against scikit-learn across languages.

It is not a model of anything. Both model documents carry ``"synthetic": true``,
which makes the application's loader refuse them; the frontend test strips the
marker inside the test only.

Run from machine-learning/::

    .venv\\Scripts\\python.exe -m tests.make_browser_parity_fixture
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from exports.export_model import build_model_document
from inference.reference import predict_labels, predict_scores, validate_model_document
from rtslr_ml.guards import SYNTHETIC_BANNER, assert_output_allowed
from training.train_static import build_estimator

OUT = Path(__file__).parent / "fixtures" / "browser-parity.synthetic.json"


def _clusters(n_classes: int, dim: int, seed: int, per_class: int):
    rng = np.random.default_rng(seed)
    centres = rng.normal(0, 1.0, size=(n_classes, dim))
    X = np.concatenate([c + rng.normal(0, 0.4, size=(per_class, dim)) for c in centres])
    y = np.repeat([f"SYN-{i}" for i in range(n_classes)], per_class)
    probes = np.concatenate([X[:: per_class // 2], rng.normal(0, 1.5, size=(6, dim))])
    return X, y, probes


def build() -> dict:
    entries = []
    for name, kind, params, dim, hands, seed in (
        ("mlp-63", "mlp", {"hidden_layer_sizes": [12, 6]}, 63, 1, 21),
        ("knn-156", "knn", {"n_neighbors": 3}, 156, 2, 22),
    ):
        X, y, probes = _clusters(3, dim, seed, per_class=8)
        pipeline = build_estimator(kind, params, seed=0).fit(X, y)
        document = build_model_document(
            pipeline,
            hands=hands,
            model_id=f"synthetic-parity-{name}",
            version="0.0.0",
            name=f"parity fixture {name}",
            sign_language="ISL",
            description="Trained on random clusters for a cross-language numeric test.",
            limitations=["Synthetic test fixture. Recognises nothing."],
            synthetic=True,
            validated=False,
            evaluation=None,
        )
        probes = np.round(probes, 6)
        model = validate_model_document(document)
        scores = predict_scores(model, probes)
        # The fixture is only written if the exported document reproduces scikit-learn.
        np.testing.assert_allclose(scores, pipeline.predict_proba(probes), atol=1e-5)
        labels = predict_labels(model, probes)
        np.testing.assert_array_equal(labels, pipeline.predict(probes))
        # Keep only probes with a clear winner so float32 rounding in the browser cannot flip a tie.
        ranked = np.sort(scores, axis=1)
        clear = (ranked[:, -1] - ranked[:, -2]) > 1e-3
        entries.append(
            {
                "name": name,
                "model": document,
                "inputs": probes[clear].tolist(),
                "expectedScores": pipeline.predict_proba(probes[clear]).tolist(),
                "expectedLabels": labels[clear].tolist(),
            }
        )
    return {"synthetic": True, "note": SYNTHETIC_BANNER, "tolerance": 1e-4, "models": entries}


def main() -> int:
    target = assert_output_allowed(OUT, synthetic=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(build(), separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {target} ({target.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
