"""Fixtures for the API tests.

Every test runs against a temporary SQLite file. ``app.db.session`` builds its engine when it
is imported, so the fixtures point that module's ``engine`` and ``SessionLocal`` at the
temporary database for the duration of each test instead of relying on import order.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Callable, Iterator
from pathlib import Path

# Before anything imports app.db.session: never let a test run touch ./rtslr.db.
_FALLBACK_DIR = tempfile.mkdtemp(prefix="rtslr-api-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(_FALLBACK_DIR, 'fallback.db').as_posix()}")

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.core.config import Settings  # noqa: E402
from app.db import session as db_session  # noqa: E402
from app.main import create_app  # noqa: E402

ALLOWED_ORIGIN = "http://localhost:3000"
API = "/api/v1"


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    shutil.rmtree(_FALLBACK_DIR, ignore_errors=True)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "cors_allow_origins": [ALLOWED_ORIGIN],
        "rate_limit_feedback_per_minute": 1000,
        "rate_limit_feedback_per_day": 100_000,
        "rate_limit_read_per_minute": 100_000,
        "trusted_proxy_ips": [],
        "auto_create_tables": False,
        "seed_on_startup": False,
        "consent_versions": ["1"],
        "max_body_bytes": 65_536,
        "enable_docs": False,
        "log_level": "info",
        "feedback_retention_days": 365,
        "database_url": "sqlite:///unused-in-tests.db",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


def _make_engine(path: Path) -> Engine:
    return db_session.create_db_engine(f"sqlite:///{path.as_posix()}")


@pytest.fixture(scope="session")
def seeded_engine(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Engine]:
    """One seeded temporary database shared by the read tests."""
    from app.db.seed import seed

    engine = _make_engine(tmp_path_factory.mktemp("rtslr-db") / "api.db")
    db_session.init_db(bind=engine)
    with Session(engine) as db:
        seed(db)
    yield engine
    engine.dispose()


def _bind(monkeypatch: pytest.MonkeyPatch, engine: Engine) -> None:
    monkeypatch.setattr(db_session, "engine", engine)
    monkeypatch.setattr(
        db_session,
        "SessionLocal",
        sessionmaker(bind=engine, autoflush=False, expire_on_commit=False),
    )


@pytest.fixture()
def bound_db(seeded_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Engine:
    _bind(monkeypatch, seeded_engine)
    return seeded_engine


@pytest.fixture()
def empty_engine(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    """A temporary database with no tables, bound as the application's database."""
    engine = _make_engine(tmp_path / "empty.db")
    _bind(monkeypatch, engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def app_factory(bound_db: Engine) -> Callable[..., FastAPI]:
    def factory(**overrides: object) -> FastAPI:
        return create_app(make_settings(**overrides))

    return factory


@pytest.fixture()
def client_factory(app_factory: Callable[..., FastAPI]) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def factory(**overrides: object) -> TestClient:
        client = TestClient(app_factory(**overrides))
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture()
def client(client_factory: Callable[..., TestClient]) -> TestClient:
    return client_factory()


@pytest.fixture()
def db(bound_db: Engine) -> Iterator[Session]:
    with Session(bound_db) as session:
        yield session


def assert_error(response, status: int, code: str) -> dict:
    """Check the uniform error envelope and return the ``error`` object."""
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert set(error) <= {"code", "message", "details"}
    assert error["code"] == code
    assert isinstance(error["message"], str) and error["message"]
    return error


def valid_feedback(**overrides: object) -> dict:
    body: dict[str, object] = {
        "consent": True,
        "consentVersion": "1",
        "kind": "general",
        "message": "The lesson list is easy to follow.",
    }
    body.update(overrides)
    return body
