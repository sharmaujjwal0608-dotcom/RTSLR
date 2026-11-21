from __future__ import annotations

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError, StatementError

from app.db.models import Category, ModelVersion, Sign
from app.db.session import create_db_engine, get_db, init_db

EXPECTED_TABLES = {
    "categories",
    "signs",
    "lessons",
    "lesson_signs",
    "model_versions",
    "datasets",
    "research_references",
    "published_benchmarks",
    "rtslr_experiments",
    "roadmap_items",
    "feedback",
}


def test_create_all_creates_exactly_the_documented_tables(engine):
    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES


def test_init_db_is_repeatable(tmp_path):
    eng = create_db_engine(f"sqlite:///{(tmp_path / 'init.db').as_posix()}")
    try:
        init_db(eng)
        init_db(eng)
        assert set(inspect(eng).get_table_names()) == EXPECTED_TABLES
    finally:
        eng.dispose()


def test_in_memory_sqlite_engine_shares_one_database():
    eng = create_db_engine("sqlite://")
    try:
        init_db(eng)
        with eng.connect() as conn:
            assert conn.execute(text("select count(*) from signs")).scalar() == 0
        with eng.connect() as conn:
            assert conn.execute(text("select count(*) from signs")).scalar() == 0
    finally:
        eng.dispose()


def test_no_account_or_recording_tables_and_no_tracking_columns(engine):
    inspector = inspect(engine)
    forbidden_tables = ("user", "account", "recording", "frame", "landmark", "session")
    for table in inspector.get_table_names():
        assert not any(word in table for word in forbidden_tables), table
    feedback_columns = {c["name"] for c in inspector.get_columns("feedback")}
    assert feedback_columns == {
        "id",
        "kind",
        "message",
        "consent_version",
        "consent_given_at",
        "model_id",
        "class_id",
        "locale",
        "deletion_token_hash",
        "created_at",
        "expires_at",
    }


def test_sqlite_foreign_keys_are_enforced(engine, db):
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
    db.add(Sign(id="isl-x-orphan", category_id="missing", label_en="Orphan"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_sign_defaults_and_constraints(db):
    db.add(Category(id="c1", title_en="C", title_hi="सी"))
    db.add(Sign(id="s1", category_id="c1", label_en="One"))
    db.commit()
    db.expire_all()
    sign = db.get(Sign, "s1")
    assert sign.hands == "either"
    assert sign.media_status == "pending"
    assert sign.media_url is None
    assert sign.recognition_supported is False
    assert sign.attributes_verified is False
    assert sign.category == "c1"

    sign.hands = 2
    db.commit()
    db.expire_all()
    assert db.get(Sign, "s1").hands == 2  # stored as "2", read back as int

    # "verified" without a recorded media URL and source is rejected.
    sign = db.get(Sign, "s1")
    sign.media_status = "verified"
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    db.add(Sign(id="s2", category_id="c1", label_en="Two", hands=3))
    with pytest.raises(StatementError):
        db.commit()
    db.rollback()

    db.add(Sign(id="s3", category_id="c1", label_en="Three", motion="wiggly"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_only_validated_isl_kind_can_be_flagged_validated(db):
    db.add(
        ModelVersion(
            id="m1",
            version="1",
            name="x",
            sign_language="ASL",
            kind="simulator",
            input="single_hand_static",
            score_type="classifier_score",
            validated=True,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_get_db_yields_and_closes_a_session():
    generator = get_db()
    session = next(generator)
    assert session.is_active
    with pytest.raises(StopIteration):
        next(generator)
