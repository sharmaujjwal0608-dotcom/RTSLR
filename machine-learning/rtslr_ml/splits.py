"""Signer-aware data splitting.

Why: if one person's hands appear in both training and test data, a model can
score well by recognising that person, camera and background. The headline
number of this project is therefore always measured on signers that were never
seen in training (docs/RESEARCH_NOTES.md section 7).

Rules implemented here:

* Splits are made by signer (hold-out, grouped k-fold, leave-one-signer-out).
* A random split is refused when signer ids are present, unless the caller
  passes ``allow_signer_leak=True``. Even then the protocol is recorded as
  ``signer_independent: false`` and no model trained that way can be marked
  validated.
* A random split still keeps every recording session on one side, because
  frames of one recording are near-duplicates.
* The protocol (which signers went where, seed, caveats) travels with every report.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np


class SignerLeakError(ValueError):
    """A split would put the same signer on both sides."""


class SplitError(ValueError):
    """The requested split cannot be made from this data."""


@dataclass
class SplitProtocol:
    name: str
    signer_independent: bool
    seed: int | None
    train_signers: list[str] = field(default_factory=list)
    val_signers: list[str] = field(default_factory=list)
    test_signers: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def describe(self) -> str:
        if self.signer_independent:
            return (
                f"{self.name}: signer-independent. Train signers {len(self.train_signers)}, "
                f"validation signers {len(self.val_signers)}, test signers {len(self.test_signers)}; "
                f"no signer appears in more than one part. Seed {self.seed}."
            )
        return (
            f"{self.name}: NOT signer-independent (signers overlap between parts). "
            f"Results are signer-dependent and over-optimistic. Seed {self.seed}."
        )


@dataclass
class Split:
    train: np.ndarray
    val: np.ndarray
    test: np.ndarray
    protocol: SplitProtocol


def unique_signers(signer_ids) -> list[str]:
    return sorted({str(s) for s in np.asarray(signer_ids).tolist()})


def has_signer_ids(signer_ids) -> bool:
    """True when the data distinguishes at least two signers."""
    return len(unique_signers(signer_ids)) > 1


def assert_no_signer_overlap(split: Split, signer_ids) -> None:
    signer_ids = np.asarray(signer_ids, dtype=str)
    parts = {
        "train": set(signer_ids[split.train].tolist()),
        "val": set(signer_ids[split.val].tolist()),
        "test": set(signer_ids[split.test].tolist()),
    }
    for a, b in (("train", "val"), ("train", "test"), ("val", "test")):
        shared = parts[a] & parts[b]
        if shared:
            raise SignerLeakError(f"signers {sorted(shared)} appear in both {a} and {b}")


def _check_class_coverage(labels: np.ndarray, split: Split) -> None:
    train_classes = set(labels[split.train].tolist())
    for name, index in (("validation", split.val), ("test", split.test)):
        missing = sorted(set(labels[index].tolist()) - train_classes)
        if missing:
            raise SplitError(
                f"classes {missing} occur in the {name} part but not in training; "
                "choose another seed or collect these classes from more signers"
            )
    if len(train_classes) < 2:
        raise SplitError("the training part has fewer than two classes")


def signer_holdout_split(
    signer_ids,
    labels,
    n_val_signers: int = 1,
    n_test_signers: int = 1,
    seed: int = 0,
) -> Split:
    """Hold out whole signers for validation and for test."""
    signer_ids = np.asarray(signer_ids, dtype=str)
    labels = np.asarray(labels, dtype=str)
    signers = unique_signers(signer_ids)
    if n_val_signers < 1 or n_test_signers < 1:
        raise SplitError("at least one validation signer and one test signer are required")
    if len(signers) < n_val_signers + n_test_signers + 1:
        raise SplitError(
            f"{len(signers)} signer(s) cannot give {n_val_signers} validation + {n_test_signers} test "
            "signers and still leave one for training"
        )
    order = list(np.random.default_rng(seed).permutation(signers))
    test_signers = sorted(order[:n_test_signers])
    val_signers = sorted(order[n_test_signers : n_test_signers + n_val_signers])
    train_signers = sorted(order[n_test_signers + n_val_signers :])

    split = Split(
        train=np.flatnonzero(np.isin(signer_ids, train_signers)),
        val=np.flatnonzero(np.isin(signer_ids, val_signers)),
        test=np.flatnonzero(np.isin(signer_ids, test_signers)),
        protocol=SplitProtocol(
            name="signer_holdout",
            signer_independent=True,
            seed=seed,
            train_signers=train_signers,
            val_signers=val_signers,
            test_signers=test_signers,
        ),
    )
    assert_no_signer_overlap(split, signer_ids)
    _check_class_coverage(labels, split)
    if len(test_signers) < 3:
        split.protocol.notes.append(
            f"Only {len(test_signers)} test signer(s): the estimate is noisy. State the signer count next to every figure."
        )
    return split


def signer_group_kfold(signer_ids, n_splits: int, seed: int = 0) -> list[tuple[np.ndarray, np.ndarray]]:
    """Grouped k-fold: every signer is in the held-out part exactly once."""
    signer_ids = np.asarray(signer_ids, dtype=str)
    signers = unique_signers(signer_ids)
    if n_splits < 2 or n_splits > len(signers):
        raise SplitError(f"n_splits must be between 2 and the number of signers ({len(signers)})")
    order = list(np.random.default_rng(seed).permutation(signers))
    folds = [order[i::n_splits] for i in range(n_splits)]
    result = []
    for held_out in folds:
        mask = np.isin(signer_ids, held_out)
        result.append((np.flatnonzero(~mask), np.flatnonzero(mask)))
    return result


def leave_one_signer_out(signer_ids) -> list[tuple[np.ndarray, np.ndarray]]:
    signers = unique_signers(signer_ids)
    if len(signers) < 2:
        raise SplitError("leave-one-signer-out needs at least two signers")
    return signer_group_kfold(signer_ids, n_splits=len(signers), seed=0)


def random_split(
    labels,
    signer_ids,
    session_ids=None,
    val_fraction: float = 0.15,
    test_fraction: float = 0.15,
    seed: int = 0,
    allow_signer_leak: bool = False,
) -> Split:
    """Random split. Refused when signer ids exist unless explicitly overridden."""
    labels = np.asarray(labels, dtype=str)
    signer_ids = np.asarray(signer_ids, dtype=str)
    if has_signer_ids(signer_ids) and not allow_signer_leak:
        raise SignerLeakError(
            "This dataset has signer ids, so a random split would leak signers between training and test "
            "and inflate the result. Use a signer-aware split, or pass allow_signer_leak=True "
            "(--allow-random-split) to get a number that must be labelled signer-dependent."
        )
    if not (0 < val_fraction < 1 and 0 < test_fraction < 1 and val_fraction + test_fraction < 1):
        raise SplitError("val_fraction and test_fraction must be positive and sum to less than 1")

    n = len(labels)
    groups = np.asarray(session_ids, dtype=str) if session_ids is not None else np.arange(n).astype(str)
    unique_groups = sorted(set(groups.tolist()))
    notes = []
    if len(unique_groups) < 3:
        groups = np.arange(n).astype(str)
        unique_groups = sorted(set(groups.tolist()))
        notes.append("Fewer than three recording sessions: rows were split individually, so near-duplicate frames may sit on both sides.")
    else:
        notes.append("Whole recording sessions were kept on one side.")
    order = list(np.random.default_rng(seed).permutation(unique_groups))
    n_test = max(1, int(round(len(order) * test_fraction)))
    n_val = max(1, int(round(len(order) * val_fraction)))
    if n_test + n_val >= len(order):
        raise SplitError("not enough rows or sessions for the requested fractions")
    test_groups, val_groups = order[:n_test], order[n_test : n_test + n_val]

    test_mask = np.isin(groups, test_groups)
    val_mask = np.isin(groups, val_groups)
    signer_dependent = has_signer_ids(signer_ids)
    if signer_dependent:
        notes.append("Signers overlap between parts: this is a signer-dependent result and cannot support a validation claim.")
    else:
        notes.append("The data has no signer ids, so signer independence cannot be established.")
    split = Split(
        train=np.flatnonzero(~test_mask & ~val_mask),
        val=np.flatnonzero(val_mask),
        test=np.flatnonzero(test_mask),
        protocol=SplitProtocol(name="random_split", signer_independent=False, seed=seed, notes=notes),
    )
    _check_class_coverage(labels, split)
    return split
