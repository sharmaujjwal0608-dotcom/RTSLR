"""Safety rails that keep synthetic (code-path test) artefacts out of anything
the application or the research pages could present as a result.

Rules enforced here:

* Every artefact made from synthetic data carries ``"synthetic": true``.
* A synthetic artefact may never be written inside ``frontend/`` (so it cannot
  reach ``frontend/public/``) or inside ``research/`` (so it cannot reach
  ``research/data/rtslr-experiments.json``).
* Real-data artefacts are also kept out of those folders by this pipeline:
  publishing a model or an experiment record is a deliberate, reviewed, manual
  step (see README.md, "Publishing a model").
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# machine-learning/rtslr_ml/guards.py -> repository root is two levels above the package.
REPO_ROOT = Path(__file__).resolve().parents[2]
PROTECTED_DIRS = (REPO_ROOT / "frontend", REPO_ROOT / "research", REPO_ROOT / "backend", REPO_ROOT / "docs")
SYNTHETIC_BANNER = (
    "SYNTHETIC DATA - this artefact was produced from randomly generated numbers to test the code path. "
    "It says nothing about sign language recognition and must not be reported as a result."
)


class OutputLocationError(RuntimeError):
    """Raised when an artefact would be written somewhere it must not go."""


def _is_inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def assert_output_allowed(path: str | Path, synthetic: bool) -> Path:
    """Return the resolved path, or raise if the pipeline must not write there."""
    resolved = Path(path).resolve()
    for protected in PROTECTED_DIRS:
        if _is_inside(resolved, protected):
            kind = "A synthetic artefact" if synthetic else "A pipeline artefact"
            raise OutputLocationError(
                f"{kind} must not be written inside {protected} (got {resolved}). "
                "Write to machine-learning/runs/ or a scratch directory; publishing is a manual, reviewed step."
            )
    return resolved


def write_json(path: str | Path, payload: dict[str, Any], synthetic: bool) -> Path:
    """Write a JSON artefact. Refuses protected locations and forces the synthetic flag to be truthful."""
    target = assert_output_allowed(path, synthetic)
    if synthetic and payload.get("synthetic") is not True:
        raise ValueError("an artefact made from synthetic data must carry \"synthetic\": true")
    if not synthetic and payload.get("synthetic") is True:
        raise ValueError("payload says synthetic but the caller says it is not")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    return target


def write_text(path: str | Path, text: str, synthetic: bool) -> Path:
    target = assert_output_allowed(path, synthetic)
    if synthetic and "SYNTHETIC" not in text:
        raise ValueError("a text artefact made from synthetic data must say SYNTHETIC")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target
