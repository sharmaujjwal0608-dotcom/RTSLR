"""The Alembic migration must build the same schema as Base.metadata."""

from __future__ import annotations

import re

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect

from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.seed import seed
from app.db.session import create_db_engine

from .conftest import BACKEND_DIR


def alembic_config(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    config.attributes["configure_logger"] = False
    return config


def _normalise(sql: str) -> str:
    return re.sub(r"[\s\"`()]", "", sql or "").lower()


def describe(engine) -> dict:
    """Structural description of a live database, independent of how it was built."""
    inspector = inspect(engine)
    schema = {}
    for table in inspector.get_table_names():
        if table == "alembic_version":
            continue
        schema[table] = {
            "columns": {
                c["name"]: (str(c["type"]), c["nullable"])
                for c in inspector.get_columns(table)
            },
            "primary_key": inspector.get_pk_constraint(table)["constrained_columns"],
            "foreign_keys": sorted(
                (
                    tuple(fk["constrained_columns"]),
                    fk["referred_table"],
                    tuple(fk["referred_columns"]),
                    (fk.get("options") or {}).get("ondelete"),
                    fk["name"],
                )
                for fk in inspector.get_foreign_keys(table)
            ),
            "indexes": sorted(
                (ix["name"], tuple(ix["column_names"]), bool(ix["unique"]))
                for ix in inspector.get_indexes(table)
            ),
            "checks": sorted(
                (ck["name"], _normalise(ck["sqltext"]))
                for ck in inspector.get_check_constraints(table)
            ),
        }
    return schema


@pytest.fixture()
def migrated(tmp_path):
    url = f"sqlite:///{(tmp_path / 'migrated.db').as_posix()}"
    command.upgrade(alembic_config(url), "head")
    engine = create_db_engine(url)
    yield url, engine
    engine.dispose()


def test_upgrade_head_creates_the_same_tables_as_metadata(migrated):
    _, engine = migrated
    tables = set(inspect(engine).get_table_names())
    assert tables - {"alembic_version"} == set(Base.metadata.tables)
    assert "alembic_version" in tables


def test_migrated_schema_is_identical_to_create_all(migrated, tmp_path):
    _, migrated_engine = migrated
    reference = create_db_engine(f"sqlite:///{(tmp_path / 'create-all.db').as_posix()}")
    try:
        Base.metadata.create_all(reference)
        expected = describe(reference)
        actual = describe(migrated_engine)
        assert set(actual) == set(expected)
        for table in expected:
            assert actual[table] == expected[table], table
        # Sanity: the comparison really saw constraints and indexes.
        assert expected["signs"]["checks"] and expected["signs"]["indexes"]
        assert expected["signs"]["foreign_keys"]
    finally:
        reference.dispose()


def test_autogenerate_finds_no_difference_after_upgrade(migrated):
    _, engine = migrated
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection, opts={"compare_type": True, "render_as_batch": True}
        )
        diff = compare_metadata(context, Base.metadata)
    assert diff == []


def test_seed_runs_on_a_migrated_database(migrated):
    from sqlalchemy.orm import sessionmaker

    _, engine = migrated
    with sessionmaker(bind=engine)() as db:
        counts = seed(db)
        assert counts["model_versions"] == 3
        assert counts["signs"] > 50


def test_downgrade_base_removes_every_table(migrated):
    url, engine = migrated
    command.downgrade(alembic_config(url), "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
