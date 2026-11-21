"""Engine and session handling.

``DATABASE_URL`` is read from the environment when this module is imported.
Default: ``sqlite:///./rtslr.db`` (relative to the process working directory).
A PostgreSQL URL (for example ``postgresql+psycopg://user:pass@host/db``) goes
through the same code path; no PostgreSQL driver is installed in the project
venv, so that path has not been executed.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .base import Base

DEFAULT_DATABASE_URL = "sqlite:///./rtslr.db"


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL


def _enable_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    try:
        # SQLite ignores foreign keys unless this is set on every connection.
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def create_db_engine(url: str | None = None, *, echo: bool = False) -> Engine:
    """Build an engine for ``url`` (default: ``DATABASE_URL``)."""
    url = url or get_database_url()
    parsed = make_url(url)
    kwargs: dict = {"echo": echo}

    if parsed.get_backend_name() == "sqlite":
        # FastAPI runs sync dependencies in a thread pool.
        kwargs["connect_args"] = {"check_same_thread": False}
        if parsed.database in (None, "", ":memory:"):
            # One shared connection, otherwise every checkout is a new empty DB.
            kwargs["poolclass"] = StaticPool
    else:
        kwargs["pool_pre_ping"] = True

    new_engine = create_engine(url, **kwargs)
    if parsed.get_backend_name() == "sqlite":
        event.listen(new_engine, "connect", _enable_sqlite_pragmas)
    return new_engine


engine: Engine = create_db_engine()
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine, autoflush=False, expire_on_commit=False
)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(bind: Engine | None = None) -> None:
    """Create any missing tables from the models (development and tests).

    Deployments should run ``alembic upgrade head`` instead. A database created
    here has no ``alembic_version`` row; run ``alembic stamp head`` once before
    using migrations on it.
    """
    from . import models  # noqa: F401  (registers the tables on Base.metadata)

    Base.metadata.create_all(bind=bind or engine)


__all__ = [
    "DEFAULT_DATABASE_URL",
    "SessionLocal",
    "create_db_engine",
    "engine",
    "get_database_url",
    "get_db",
    "init_db",
]
