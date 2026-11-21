from __future__ import annotations

import numpy as np
import pytest

from rtslr_ml.splits import (
    SignerLeakError,
    SplitError,
    assert_no_signer_overlap,
    has_signer_ids,
    leave_one_signer_out,
    random_split,
    signer_group_kfold,
    signer_holdout_split,
)


def toy(n_signers: int = 6, per_class: int = 5):
    signers, labels, sessions = [], [], []
    for s in range(n_signers):
        for label in ("x", "y", "z"):
            for k in range(per_class):
                signers.append(f"s{s}")
                labels.append(label)
                sessions.append(f"s{s}-{label}-{k % 2}")
    return np.asarray(signers), np.asarray(labels), np.asarray(sessions)


def test_holdout_keeps_signers_apart():
    signers, labels, _ = toy()
    split = signer_holdout_split(signers, labels, n_val_signers=1, n_test_signers=2, seed=3)
    train, val, test = (set(signers[i]) for i in (split.train, split.val, split.test))
    assert len(train) == 3 and len(val) == 1 and len(test) == 2
    assert not (train & val) and not (train & test) and not (val & test)
    assert len(split.train) + len(split.val) + len(split.test) == len(labels)
    assert split.protocol.signer_independent is True
    assert split.protocol.name == "signer_holdout"
    assert sorted(split.protocol.test_signers) == sorted(test)
    assert "signer-independent" in split.protocol.describe()
    assert any("noisy" in note for note in split.protocol.notes)  # 2 test signers: says so
    assert_no_signer_overlap(split, signers)


def test_holdout_is_deterministic_per_seed():
    signers, labels, _ = toy()
    a = signer_holdout_split(signers, labels, seed=1)
    b = signer_holdout_split(signers, labels, seed=1)
    assert a.protocol.test_signers == b.protocol.test_signers
    np.testing.assert_array_equal(a.train, b.train)
    seeds = {tuple(signer_holdout_split(signers, labels, seed=s).protocol.test_signers) for s in range(12)}
    assert len(seeds) > 1


def test_holdout_needs_enough_signers():
    signers, labels, _ = toy(n_signers=2)
    with pytest.raises(SplitError, match="leave one for training"):
        signer_holdout_split(signers, labels, n_val_signers=1, n_test_signers=1)
    with pytest.raises(SplitError):
        signer_holdout_split(*toy()[:2], n_val_signers=0)


def test_holdout_rejects_a_class_unseen_in_training():
    signers, labels, _ = toy(n_signers=3)
    labels = labels.copy()
    labels[signers == "s0"] = "only-s0"
    with pytest.raises(SplitError, match="not in training"):
        for seed in range(20):  # some seed puts s0 outside the training part
            signer_holdout_split(signers, labels, seed=seed)


def test_overlap_check_catches_a_leak():
    signers, labels, _ = toy()
    split = signer_holdout_split(signers, labels, seed=0)
    split.test = np.append(split.test, split.train[0])
    with pytest.raises(SignerLeakError):
        assert_no_signer_overlap(split, signers)


def test_group_kfold_holds_out_every_signer_once():
    signers, _, _ = toy(n_signers=7)
    folds = signer_group_kfold(signers, n_splits=3, seed=0)
    assert len(folds) == 3
    held_out = [set(signers[test]) for _, test in folds]
    assert set.union(*held_out) == set(signers)
    assert sum(len(h) for h in held_out) == 7
    for train, test in folds:
        assert not set(signers[train]) & set(signers[test])
    with pytest.raises(SplitError):
        signer_group_kfold(signers, n_splits=8)


def test_leave_one_signer_out():
    signers, _, _ = toy(n_signers=4)
    folds = leave_one_signer_out(signers)
    assert len(folds) == 4
    assert all(len(set(signers[test])) == 1 for _, test in folds)
    with pytest.raises(SplitError):
        leave_one_signer_out(np.asarray(["only"] * 5))


def test_random_split_is_refused_when_signer_ids_exist():
    signers, labels, sessions = toy()
    assert has_signer_ids(signers)
    with pytest.raises(SignerLeakError, match="leak signers"):
        random_split(labels, signers, sessions, seed=0)


def test_random_split_override_is_recorded_as_signer_dependent():
    signers, labels, sessions = toy()
    split = random_split(labels, signers, sessions, seed=0, allow_signer_leak=True)
    assert split.protocol.signer_independent is False
    assert split.protocol.name == "random_split"
    assert "NOT signer-independent" in split.protocol.describe()
    assert any("signer-dependent" in note for note in split.protocol.notes)
    # Whole recording sessions stay on one side.
    for a, b in ((split.train, split.val), (split.train, split.test), (split.val, split.test)):
        assert not set(sessions[a]) & set(sessions[b])
    assert len(split.train) + len(split.val) + len(split.test) == len(labels)


def test_random_split_without_signer_ids_still_cannot_claim_independence():
    _, labels, sessions = toy()
    one_signer = np.asarray(["anon"] * len(labels))
    assert not has_signer_ids(one_signer)
    split = random_split(labels, one_signer, sessions, seed=0)
    assert split.protocol.signer_independent is False
    assert any("cannot be established" in note for note in split.protocol.notes)
