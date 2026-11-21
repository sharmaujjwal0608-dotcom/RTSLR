"""Landmark dataset format, manifest gate, label validation, inspection and cleaning.

Dataset file formats
--------------------
``.npz`` (preferred; loaded with ``allow_pickle=False``)

    labels      (N,)  unicode   class label, e.g. "A"
    signer_ids  (N,)  unicode   anonymous signer id, e.g. "s01" (never a name)
    session_ids (N,)  unicode   recording id; frames of one recording share it
    hand_count  (N,)  int8      1 or 2
    sources     (N,)  unicode   provenance, e.g. relative file path + frame number
    and EITHER raw landmarks
        landmarks   (N, 2, 21, 3) float32  MediaPipe x, y (normalised, UNMIRRORED) and z;
                                            hand index 1 is NaN when hand_count == 1
        image_sizes (N, 2) float32          width, height of the source image
    OR precomputed ``rtslr-features-1`` vectors
        features    (N, 156) float32        one-hand rows use columns 0..62, the rest NaN

``.csv`` (raw landmarks only), header:

    label,signer_id,session_id,hand_count,source,image_width,image_height,
    h0_x0,h0_y0,h0_z0,...,h0_z20,h1_x0,...,h1_z20      (h1_* empty for one hand)

Manifest (``.json``, format ``rtslr-dataset-manifest-1``): licence, consent and
provenance. Training refuses to start until every required field is filled in
(`require_training_ready`). See ``data/manifest.template.json``.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from .features import (
    DUAL_FEATURE_DIM,
    FEATURE_SCHEMA_VERSION,
    LANDMARKS_PER_HAND,
    SINGLE_FEATURE_DIM,
    dual_hand_vector,
    single_hand_vector,
)

MANIFEST_FORMAT = "rtslr-dataset-manifest-1"
MAX_LABEL_LENGTH = 64
FORBIDDEN_LABELS = frozenset({"__proto__", "constructor", "prototype"})
_PLACEHOLDERS = frozenset({"", "todo", "tbd", "fill me", "fixme", "unknown", "?", "n/a", "none", "xxx"})


class DatasetError(ValueError):
    """The dataset file is malformed."""


class ManifestError(ValueError):
    """The manifest is missing, malformed, or not ready for training."""


# --------------------------------------------------------------------------- #
# Dataset container
# --------------------------------------------------------------------------- #


@dataclass
class LandmarkDataset:
    labels: np.ndarray
    signer_ids: np.ndarray
    session_ids: np.ndarray
    hand_count: np.ndarray
    sources: np.ndarray
    landmarks: np.ndarray | None = None
    image_sizes: np.ndarray | None = None
    features: np.ndarray | None = None
    _feature_cache: np.ndarray | None = field(default=None, repr=False, compare=False)

    def __post_init__(self) -> None:
        self.labels = np.asarray(self.labels, dtype=str)
        self.signer_ids = np.asarray(self.signer_ids, dtype=str)
        self.session_ids = np.asarray(self.session_ids, dtype=str)
        self.sources = np.asarray(self.sources, dtype=str)
        self.hand_count = np.asarray(self.hand_count, dtype=np.int8)
        n = len(self.labels)
        for name in ("signer_ids", "session_ids", "hand_count", "sources"):
            if len(getattr(self, name)) != n:
                raise DatasetError(f"{name} has {len(getattr(self, name))} rows, labels has {n}")
        if not np.all(np.isin(self.hand_count, (1, 2))):
            raise DatasetError("hand_count must be 1 or 2 for every row")
        if (self.landmarks is None) == (self.features is None):
            raise DatasetError("provide exactly one of `landmarks` (+ `image_sizes`) or `features`")
        if self.landmarks is not None:
            self.landmarks = np.asarray(self.landmarks, dtype=np.float32)
            if self.landmarks.shape != (n, 2, LANDMARKS_PER_HAND, 3):
                raise DatasetError(f"landmarks must have shape ({n}, 2, 21, 3), got {self.landmarks.shape}")
            if self.image_sizes is None:
                raise DatasetError("raw landmarks need `image_sizes` (width, height) for the aspect correction")
            self.image_sizes = np.asarray(self.image_sizes, dtype=np.float32)
            if self.image_sizes.shape != (n, 2):
                raise DatasetError(f"image_sizes must have shape ({n}, 2), got {self.image_sizes.shape}")
        else:
            self.features = np.asarray(self.features, dtype=np.float32)
            if self.features.shape != (n, DUAL_FEATURE_DIM):
                raise DatasetError(f"features must have shape ({n}, 156), got {self.features.shape}")

    def __len__(self) -> int:
        return len(self.labels)

    def subset(self, index: np.ndarray) -> "LandmarkDataset":
        index = np.asarray(index)
        return LandmarkDataset(
            labels=self.labels[index],
            signer_ids=self.signer_ids[index],
            session_ids=self.session_ids[index],
            hand_count=self.hand_count[index],
            sources=self.sources[index],
            landmarks=None if self.landmarks is None else self.landmarks[index],
            image_sizes=None if self.image_sizes is None else self.image_sizes[index],
            features=None if self.features is None else self.features[index],
        )

    def all_features(self) -> np.ndarray:
        """(N, 156) float32. One-hand rows use columns 0..62 and are NaN elsewhere.

        Rows whose landmarks are unusable (non-finite, or image size not positive)
        come back as all-NaN so that inspection and cleaning can report them.
        """
        if self.features is not None:
            return self.features
        if self._feature_cache is None:
            out = np.full((len(self), DUAL_FEATURE_DIM), np.nan, dtype=np.float32)
            for i in range(len(self)):
                width, height = self.image_sizes[i]
                try:
                    if self.hand_count[i] == 1:
                        out[i, :SINGLE_FEATURE_DIM] = single_hand_vector(self.landmarks[i, 0], width, height)
                    else:
                        out[i] = dual_hand_vector(self.landmarks[i, 0], self.landmarks[i, 1], width, height)
                except ValueError:
                    out[i] = np.nan
            self._feature_cache = out
        return self._feature_cache

    def feature_matrix(self, hands: int) -> tuple[np.ndarray, np.ndarray]:
        """Features of the rows recorded with ``hands`` hands.

        Returns ``(X, rows)``: X is (M, 63) for one hand or (M, 156) for two,
        ``rows`` are the indices into this dataset.
        """
        if hands not in (1, 2):
            raise ValueError("hands must be 1 or 2")
        rows = np.flatnonzero(self.hand_count == hands)
        width = SINGLE_FEATURE_DIM if hands == 1 else DUAL_FEATURE_DIM
        return self.all_features()[rows, :width], rows

    def usable_mask(self) -> np.ndarray:
        """True for rows whose feature vector is completely finite."""
        feats = self.all_features()
        mask = np.zeros(len(self), dtype=bool)
        one = self.hand_count == 1
        mask[one] = np.all(np.isfinite(feats[one, :SINGLE_FEATURE_DIM]), axis=1)
        mask[~one] = np.all(np.isfinite(feats[~one]), axis=1)
        return mask


# --------------------------------------------------------------------------- #
# File I/O
# --------------------------------------------------------------------------- #

_REQUIRED_KEYS = ("labels", "signer_ids", "session_ids", "hand_count", "sources")


def save_npz(dataset: LandmarkDataset, path: str | Path) -> Path:
    path = Path(path)
    arrays: dict[str, np.ndarray] = {
        "labels": dataset.labels,
        "signer_ids": dataset.signer_ids,
        "session_ids": dataset.session_ids,
        "hand_count": dataset.hand_count,
        "sources": dataset.sources,
    }
    if dataset.landmarks is not None:
        arrays["landmarks"] = dataset.landmarks
        arrays["image_sizes"] = dataset.image_sizes
    else:
        arrays["features"] = dataset.features
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, **arrays)
    return path


def load_npz(path: str | Path) -> LandmarkDataset:
    with np.load(Path(path), allow_pickle=False) as data:
        missing = [k for k in _REQUIRED_KEYS if k not in data.files]
        if missing:
            raise DatasetError(f"{path}: missing arrays {missing}")
        return LandmarkDataset(
            labels=data["labels"],
            signer_ids=data["signer_ids"],
            session_ids=data["session_ids"],
            hand_count=data["hand_count"],
            sources=data["sources"],
            landmarks=data["landmarks"] if "landmarks" in data.files else None,
            image_sizes=data["image_sizes"] if "image_sizes" in data.files else None,
            features=data["features"] if "features" in data.files else None,
        )


def _csv_landmark_columns() -> list[str]:
    return [f"h{h}_{axis}{i}" for h in (0, 1) for i in range(LANDMARKS_PER_HAND) for axis in "xyz"]


CSV_HEADER = ["label", "signer_id", "session_id", "hand_count", "source", "image_width", "image_height", *_csv_landmark_columns()]


def save_csv(dataset: LandmarkDataset, path: str | Path) -> Path:
    if dataset.landmarks is None:
        raise DatasetError("the CSV format stores raw landmarks; this dataset holds features only")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(CSV_HEADER)
        for i in range(len(dataset)):
            flat = dataset.landmarks[i].reshape(-1)
            cells = ["" if np.isnan(v) else repr(float(v)) for v in flat]
            writer.writerow(
                [
                    dataset.labels[i],
                    dataset.signer_ids[i],
                    dataset.session_ids[i],
                    int(dataset.hand_count[i]),
                    dataset.sources[i],
                    repr(float(dataset.image_sizes[i, 0])),
                    repr(float(dataset.image_sizes[i, 1])),
                    *cells,
                ]
            )
    return path


def load_csv(path: str | Path) -> LandmarkDataset:
    path = Path(path)
    columns = _csv_landmark_columns()
    labels, signers, sessions, counts, sources, sizes, rows = [], [], [], [], [], [], []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in CSV_HEADER if c not in (reader.fieldnames or [])]
        if missing:
            raise DatasetError(f"{path}: missing CSV columns {missing[:5]}{'...' if len(missing) > 5 else ''}")
        for line_number, record in enumerate(reader, start=2):
            try:
                labels.append(record["label"])
                signers.append(record["signer_id"])
                sessions.append(record["session_id"])
                counts.append(int(record["hand_count"]))
                sources.append(record["source"])
                sizes.append((float(record["image_width"]), float(record["image_height"])))
                rows.append([float(record[c]) if record[c] != "" else np.nan for c in columns])
            except (TypeError, ValueError) as error:
                raise DatasetError(f"{path}, line {line_number}: {error}") from error
    landmarks = np.asarray(rows, dtype=np.float32).reshape(len(rows), 2, LANDMARKS_PER_HAND, 3)
    return LandmarkDataset(
        labels=np.asarray(labels, dtype=str),
        signer_ids=np.asarray(signers, dtype=str),
        session_ids=np.asarray(sessions, dtype=str),
        hand_count=np.asarray(counts, dtype=np.int8),
        sources=np.asarray(sources, dtype=str),
        landmarks=landmarks,
        image_sizes=np.asarray(sizes, dtype=np.float32).reshape(len(rows), 2),
    )


def load_dataset(path: str | Path) -> LandmarkDataset:
    suffix = Path(path).suffix.lower()
    if suffix == ".npz":
        return load_npz(path)
    if suffix == ".csv":
        return load_csv(path)
    raise DatasetError(f"unsupported dataset file type {suffix!r}; use .npz or .csv")


# --------------------------------------------------------------------------- #
# Manifest
# --------------------------------------------------------------------------- #


def load_manifest(path: str | Path) -> dict[str, Any]:
    try:
        manifest = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ManifestError(f"no manifest at {path}: a dataset cannot be used without one") from error
    except json.JSONDecodeError as error:
        raise ManifestError(f"{path} is not valid JSON: {error}") from error
    if not isinstance(manifest, dict):
        raise ManifestError(f"{path}: the manifest must be a JSON object")
    return manifest


def _filled(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    text = value.strip()
    return text.lower() not in _PLACEHOLDERS and not (text.startswith("<") and text.endswith(">"))


def _get(manifest: dict[str, Any], dotted: str) -> Any:
    node: Any = manifest
    for key in dotted.split("."):
        if not isinstance(node, dict) or key not in node:
            return None
        node = node[key]
    return node


_REQUIRED_TEXT = (
    "dataset_id",
    "name",
    "source.description",
    "source.collected_by",
    "licence.name",
    "licence.terms_reference",
    "consent.description",
    "consent.withdrawal_contact",
    "label_inventory.verified_by",
)
_REQUIRED_TRUE = (
    "licence.permits_model_training",
    "consent.obtained",
    "consent.covers_model_training",
    "signers.ids_are_anonymous",
)


def manifest_problems(manifest: dict[str, Any]) -> list[str]:
    """Everything that stops this manifest from authorising a training run."""
    problems: list[str] = []
    if manifest.get("format") != MANIFEST_FORMAT:
        problems.append(f'format must be "{MANIFEST_FORMAT}"')
    if manifest.get("feature_schema") != FEATURE_SCHEMA_VERSION:
        problems.append(f'feature_schema must be "{FEATURE_SCHEMA_VERSION}"')
    if manifest.get("sign_language") not in ("ISL", "ASL"):
        problems.append('sign_language must be "ISL" or "ASL"')
    if not isinstance(manifest.get("synthetic"), bool):
        problems.append("synthetic must be true or false")
    for dotted in _REQUIRED_TEXT:
        if not _filled(_get(manifest, dotted)):
            problems.append(f"{dotted} is not filled in")
    for dotted in _REQUIRED_TRUE:
        if _get(manifest, dotted) is not True:
            problems.append(f"{dotted} must be true (it is {_get(manifest, dotted)!r})")
    if not isinstance(_get(manifest, "licence.permits_model_distribution"), bool):
        problems.append("licence.permits_model_distribution must be true or false")
    count = _get(manifest, "signers.count")
    if not isinstance(count, int) or isinstance(count, bool) or count < 1:
        problems.append("signers.count must be a positive integer")

    classes = _get(manifest, "label_inventory.classes")
    if not isinstance(classes, list) or len(classes) < 2:
        problems.append("label_inventory.classes must list at least two classes")
    else:
        seen: set[str] = set()
        for i, entry in enumerate(classes):
            where = f"label_inventory.classes[{i}]"
            if not isinstance(entry, dict):
                problems.append(f"{where} must be an object")
                continue
            label = entry.get("label")
            if not isinstance(label, str) or not label.strip() or len(label) > MAX_LABEL_LENGTH or label in FORBIDDEN_LABELS:
                problems.append(f"{where}.label must be 1-{MAX_LABEL_LENGTH} characters and not a reserved word")
            elif label in seen:
                problems.append(f"{where}.label {label!r} is listed twice")
            else:
                seen.add(label)
            if entry.get("hands") not in (1, 2):
                problems.append(f"{where}.hands must be 1 or 2")
            if entry.get("motion") not in ("static", "dynamic"):
                problems.append(f'{where}.motion must be "static" or "dynamic"')
    return problems


def require_training_ready(manifest: dict[str, Any]) -> None:
    """Raise ManifestError unless licence, consent and provenance are all filled in."""
    problems = manifest_problems(manifest)
    if problems:
        raise ManifestError(
            "The dataset manifest does not authorise training yet:\n  - " + "\n  - ".join(problems)
        )


def class_inventory(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {entry["label"]: entry for entry in manifest["label_inventory"]["classes"]}


# --------------------------------------------------------------------------- #
# Label validation, inspection, cleaning
# --------------------------------------------------------------------------- #


def validate_labels(dataset: LandmarkDataset, manifest: dict[str, Any]) -> dict[str, Any]:
    """Compare the labels in the data with the manifest's verified inventory."""
    inventory = class_inventory(manifest)
    labels = dataset.labels
    unknown = Counter(str(label) for label in labels if label not in inventory)
    hand_mismatch_rows: list[int] = []
    dynamic_rows: list[int] = []
    for i, label in enumerate(labels):
        entry = inventory.get(str(label))
        if entry is None:
            continue
        if entry["hands"] != int(dataset.hand_count[i]):
            hand_mismatch_rows.append(i)
        if entry["motion"] == "dynamic":
            dynamic_rows.append(i)
    present = set(str(label) for label in labels)
    signer_count = len(set(dataset.signer_ids.tolist()))
    return {
        "unknown_labels": dict(sorted(unknown.items())),
        "unknown_label_rows": [i for i, label in enumerate(labels) if label not in inventory],
        "hand_count_mismatch_rows": hand_mismatch_rows,
        "dynamic_class_rows": dynamic_rows,
        "classes_without_samples": sorted(set(inventory) - present),
        "signers_in_data": signer_count,
        "signers_in_manifest": manifest["signers"]["count"],
        "signer_count_matches": signer_count == manifest["signers"]["count"],
        "ok": not unknown and not hand_mismatch_rows and signer_count == manifest["signers"]["count"],
    }


def _row_hashes(dataset: LandmarkDataset, decimals: int = 5) -> list[str]:
    feats = np.nan_to_num(dataset.all_features(), nan=0.0)
    rounded = np.round(feats, decimals) + 0.0  # "+ 0.0" turns -0.0 into 0.0
    return [hashlib.sha1(row.tobytes()).hexdigest() for row in rounded]


def inspect_dataset(dataset: LandmarkDataset) -> dict[str, Any]:
    """Class balance, signer coverage and duplicate report. Does not modify anything."""
    usable = dataset.usable_mask()
    by_class: dict[str, Counter] = defaultdict(Counter)
    signers_per_class: dict[str, set[str]] = defaultdict(set)
    for label, hands, signer in zip(dataset.labels, dataset.hand_count, dataset.signer_ids):
        by_class[str(label)][int(hands)] += 1
        signers_per_class[str(label)].add(str(signer))
    class_counts = {label: sum(c.values()) for label, c in by_class.items()}

    hashes = _row_hashes(dataset)
    groups: dict[str, list[int]] = defaultdict(list)
    for i, digest in enumerate(hashes):
        if usable[i]:
            groups[digest].append(i)
    duplicate_groups = [rows for rows in groups.values() if len(rows) > 1]
    conflicting = [rows for rows in duplicate_groups if len({str(dataset.labels[r]) for r in rows}) > 1]
    cross_signer = [rows for rows in duplicate_groups if len({str(dataset.signer_ids[r]) for r in rows}) > 1]

    counts = sorted(class_counts.values())
    return {
        "n_samples": len(dataset),
        "n_usable": int(usable.sum()),
        "n_non_finite": int((~usable).sum()),
        "n_classes": len(class_counts),
        "n_signers": len(set(dataset.signer_ids.tolist())),
        "n_sessions": len(set(dataset.session_ids.tolist())),
        "samples_per_class": dict(sorted(class_counts.items())),
        "hand_counts_per_class": {label: {str(h): n for h, n in sorted(c.items())} for label, c in sorted(by_class.items())},
        "classes_with_mixed_hand_counts": sorted(label for label, c in by_class.items() if len(c) > 1),
        "signers_per_class": {label: len(s) for label, s in sorted(signers_per_class.items())},
        "samples_per_signer": dict(sorted(Counter(dataset.signer_ids.tolist()).items())),
        "imbalance_ratio": (counts[-1] / counts[0]) if counts and counts[0] > 0 else None,
        "smallest_class": min(class_counts, key=class_counts.get) if class_counts else None,
        "exact_duplicate_rows": int(sum(len(rows) - 1 for rows in duplicate_groups)),
        "duplicate_groups": len(duplicate_groups),
        "duplicates_with_conflicting_labels": len(conflicting),
        "duplicates_across_signers": len(cross_signer),
    }


def clean_dataset(dataset: LandmarkDataset, manifest: dict[str, Any]) -> tuple[LandmarkDataset, dict[str, Any]]:
    """Drop rows that cannot be trusted and say exactly what was dropped.

    Removed, in this order: rows with non-finite values; rows whose label is not
    in the manifest inventory; rows whose hand count contradicts the inventory;
    rows of classes marked dynamic (this is the static pipeline); every row of a
    duplicate group whose members disagree on the label; all but the first row
    of each remaining exact-duplicate group.
    """
    report = validate_labels(dataset, manifest)
    keep = np.ones(len(dataset), dtype=bool)
    log: dict[str, Any] = {"rows_in": len(dataset)}

    non_finite = ~dataset.usable_mask()
    keep &= ~non_finite
    log["dropped_non_finite"] = int(non_finite.sum())

    def drop(rows: list[int], name: str) -> None:
        mask = np.zeros(len(dataset), dtype=bool)
        mask[rows] = True
        log[name] = int((mask & keep).sum())
        keep[mask] = False

    drop(report["unknown_label_rows"], "dropped_unknown_label")
    drop(report["hand_count_mismatch_rows"], "dropped_hand_count_mismatch")
    drop(report["dynamic_class_rows"], "dropped_dynamic_class")

    groups: dict[str, list[int]] = defaultdict(list)
    for i, digest in enumerate(_row_hashes(dataset)):
        if keep[i]:
            groups[digest].append(i)
    conflicting: list[int] = []
    repeats: list[int] = []
    for rows in groups.values():
        if len(rows) < 2:
            continue
        if len({str(dataset.labels[r]) for r in rows}) > 1:
            conflicting.extend(rows)
        else:
            repeats.extend(rows[1:])
    drop(conflicting, "dropped_conflicting_duplicates")
    drop(repeats, "dropped_exact_duplicates")

    log["rows_out"] = int(keep.sum())
    cleaned = dataset.subset(np.flatnonzero(keep))
    return cleaned, log
