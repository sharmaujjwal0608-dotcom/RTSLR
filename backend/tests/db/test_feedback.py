from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.db import repositories as repo
from app.db.models import Feedback


def make(db, **overrides):
    values = dict(
        kind="general",
        message="The lesson list is easy to follow.",
        consent_version="1",
        model_id=None,
        class_id=None,
        locale=None,
    )
    values.update(overrides)
    return repo.create_feedback(db, **values)


def count(db) -> int:
    return len(db.scalars(select(Feedback)).all())


def test_create_feedback_stores_only_the_hash_of_the_token(db, engine):
    feedback, token = make(
        db,
        kind="recognition_issue",
        model_id="legacy-asl-prototype",
        class_id="A",
        locale="hi",
    )
    assert isinstance(feedback.id, uuid.UUID)
    assert len(token) >= 40
    assert feedback.deletion_token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert feedback.deletion_token_hash != token

    # The plain token is nowhere in the stored row.
    with engine.connect() as conn:
        row = conn.execute(text("select * from feedback")).mappings().one()
    assert token not in [str(v) for v in row.values()]
    assert row["kind"] == "recognition_issue"
    assert row["model_id"] == "legacy-asl-prototype"
    assert row["class_id"] == "A"
    assert row["locale"] == "hi"
    assert row["consent_version"] == "1"


def test_create_feedback_sets_consent_and_retention_timestamps(db):
    before = datetime.now(timezone.utc)
    feedback, _ = make(db, retention_days=30)
    after = datetime.now(timezone.utc)
    db.expire_all()
    stored = db.get(Feedback, feedback.id)
    assert stored.created_at.tzinfo is not None
    assert before <= stored.created_at <= after
    assert stored.consent_given_at == stored.created_at
    assert stored.expires_at - stored.created_at == timedelta(days=30)


def test_default_retention_is_365_days_and_env_overrides(db, monkeypatch):
    monkeypatch.delenv("FEEDBACK_RETENTION_DAYS", raising=False)
    feedback, _ = make(db)
    assert feedback.expires_at - feedback.created_at == timedelta(days=365)
    monkeypatch.setenv("FEEDBACK_RETENTION_DAYS", "10")
    feedback, _ = make(db)
    assert feedback.expires_at - feedback.created_at == timedelta(days=10)


def test_each_feedback_gets_its_own_id_and_token(db):
    (a, token_a), (b, token_b) = make(db), make(db)
    assert a.id != b.id
    assert token_a != token_b


def test_invalid_kind_locale_and_message_are_rejected_by_the_database(db):
    for bad in (
        {"kind": "spam"},
        {"locale": "fr"},
        {"message": ""},
        {"message": "x" * 2001},
    ):
        with pytest.raises(IntegrityError):
            make(db, **bad)
    assert count(db) == 0
    make(db, message="x" * 2000)
    assert count(db) == 1


def test_delete_feedback_with_the_right_token(db):
    feedback, token = make(db)
    other, _ = make(db)
    assert repo.delete_feedback(db, feedback.id, token) is True
    db.expire_all()
    assert db.get(Feedback, feedback.id) is None
    assert db.get(Feedback, other.id) is not None
    # A second attempt finds nothing.
    assert repo.delete_feedback(db, feedback.id, token) is False


def test_delete_feedback_accepts_the_id_as_a_string(db):
    feedback, token = make(db)
    assert repo.delete_feedback(db, str(feedback.id), token) is True
    assert count(db) == 0


def test_delete_feedback_token_mismatch_returns_false_and_keeps_the_row(db):
    feedback, token = make(db)
    other, other_token = make(db)
    for wrong in ("", "wrong", token + "x", token[:-1], other_token, None):
        assert repo.delete_feedback(db, feedback.id, wrong) is False
    assert count(db) == 2


def test_delete_feedback_unknown_or_malformed_id_returns_false(db):
    _, token = make(db)
    assert repo.delete_feedback(db, uuid.uuid4(), token) is False
    assert repo.delete_feedback(db, str(uuid.uuid4()), token) is False
    assert repo.delete_feedback(db, "not-a-uuid", token) is False
    assert repo.delete_feedback(db, "", token) is False
    assert count(db) == 1


def test_delete_feedback_compares_in_constant_time(db, monkeypatch):
    calls = []
    real = hmac.compare_digest

    def spy(a, b):
        calls.append((a, b))
        return real(a, b)

    monkeypatch.setattr(repo.hmac, "compare_digest", spy)
    feedback, token = make(db)

    assert repo.delete_feedback(db, feedback.id, "wrong") is False
    assert repo.delete_feedback(db, uuid.uuid4(), token) is False  # unknown id
    assert repo.delete_feedback(db, feedback.id, token) is True
    # compare_digest ran on every path, always on two SHA-256 hex digests.
    assert len(calls) == 3
    assert all(len(a) == len(b) == 64 for a, b in calls)


def _age(db, feedback, days):
    moment = datetime.now(timezone.utc) - timedelta(days=days)
    row = db.get(Feedback, feedback.id)
    row.created_at = moment
    db.commit()


def test_purge_feedback_older_than(db):
    old, _ = make(db, message="old")
    edge, _ = make(db, message="edge")
    new, _ = make(db, message="new")
    _age(db, old, 400)
    _age(db, edge, 29)

    assert repo.purge_feedback_older_than(db, 365) == 1
    db.expire_all()
    assert db.get(Feedback, old.id) is None
    assert count(db) == 2

    assert repo.purge_feedback_older_than(db, 365) == 0
    assert repo.purge_feedback_older_than(db, 30) == 0
    assert repo.purge_feedback_older_than(db, 28) == 1
    db.expire_all()
    assert db.get(Feedback, edge.id) is None
    assert db.get(Feedback, new.id) is not None

    with pytest.raises(ValueError):
        repo.purge_feedback_older_than(db, -1)


def test_purge_expired_feedback(db):
    short, _ = make(db, retention_days=1)
    long, _ = make(db, retention_days=365)
    assert repo.purge_expired_feedback(db) == 0
    future = datetime.now(timezone.utc) + timedelta(days=2)
    assert repo.purge_expired_feedback(db, now=future) == 1
    db.expire_all()
    assert db.get(Feedback, short.id) is None
    assert db.get(Feedback, long.id) is not None
