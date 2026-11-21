"""Fixtures for the data-layer tests: every test gets its own SQLite file."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.seed import DEFAULT_RESEARCH_DATA_DIR, seed
from app.db.session import create_db_engine

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture()
def db_url(tmp_path) -> str:
    return f"sqlite:///{(tmp_path / 'rtslr-test.db').as_posix()}"


@pytest.fixture()
def engine(db_url):
    eng = create_db_engine(db_url)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as session:
        yield session


@pytest.fixture()
def seeded(db):
    seed(db)
    return db


@pytest.fixture(scope="session")
def research_dir() -> Path:
    return DEFAULT_RESEARCH_DATA_DIR


def load_research(name: str) -> list[dict]:
    with (DEFAULT_RESEARCH_DATA_DIR / name).open(encoding="utf-8") as handle:
        return json.load(handle)
