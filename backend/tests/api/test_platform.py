"""CORS, error envelope, security headers, settings guards and startup."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app

from .conftest import ALLOWED_ORIGIN, API, assert_error, make_settings, valid_feedback

OTHER_ORIGIN = "https://evil.example"


# ----------------------------------------------------------------------------- CORS


def test_cors_allowed_origin(client):
    r = client.get(f"{API}/models", headers={"Origin": ALLOWED_ORIGIN})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in r.headers
    exposed = r.headers["access-control-expose-headers"]
    assert "X-Request-ID" in exposed and "Retry-After" in exposed


def test_cors_disallowed_origin_gets_no_allow_header(client):
    r = client.get(f"{API}/models", headers={"Origin": OTHER_ORIGIN})
    assert "access-control-allow-origin" not in r.headers
    r = client.post(f"{API}/feedback", json=valid_feedback(), headers={"Origin": OTHER_ORIGIN})
    assert "access-control-allow-origin" not in r.headers


def test_cors_preflight_allowed(client):
    r = client.options(
        f"{API}/feedback/some-id",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "x-deletion-token, content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    methods = {m.strip() for m in r.headers["access-control-allow-methods"].split(",")}
    assert methods == {"GET", "POST", "DELETE", "OPTIONS"}
    allowed = r.headers["access-control-allow-headers"].lower()
    assert "x-deletion-token" in allowed and "content-type" in allowed
    assert "access-control-allow-credentials" not in r.headers


def test_cors_preflight_refused(client):
    disallowed_origin = client.options(
        f"{API}/feedback",
        headers={"Origin": OTHER_ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    assert disallowed_origin.status_code == 400
    assert "access-control-allow-origin" not in disallowed_origin.headers

    disallowed_method = client.options(
        f"{API}/feedback",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "PUT"},
    )
    assert disallowed_method.status_code == 400

    disallowed_header = client.options(
        f"{API}/feedback",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert disallowed_header.status_code == 400


def test_error_responses_carry_cors_headers_for_allowed_origin(client_factory):
    client = client_factory(rate_limit_feedback_per_minute=1)
    headers = {"Origin": ALLOWED_ORIGIN}
    not_found = client.get(f"{API}/models/nope", headers=headers)
    assert not_found.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    client.post(f"{API}/feedback", json=valid_feedback(), headers=headers)
    limited = client.post(f"{API}/feedback", json=valid_feedback(), headers=headers)
    assert limited.status_code == 429
    assert limited.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


# ----------------------------------------------------------------------------- settings


def _settings(**values: object) -> Settings:
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


def test_production_refuses_wildcard_or_empty_cors():
    with pytest.raises(ValidationError):
        _settings(environment="production", cors_allow_origins=["*"])
    with pytest.raises(ValidationError):
        _settings(environment="production", cors_allow_origins=["https://app.example.org", "*"])
    with pytest.raises(ValidationError):
        _settings(environment="production", cors_allow_origins=[])
    with pytest.raises(ValidationError):
        _settings(
            environment="production",
            cors_allow_origins=["https://app.example.org"],
            database_url="postgresql+psycopg://rtslr:CHANGE_ME@localhost:5432/rtslr",
        )
    ok = _settings(environment="production", cors_allow_origins=["https://app.example.org"])
    assert ok.is_production and ok.cors_allow_origins == ["https://app.example.org"]


def test_origins_must_be_exact_origins():
    for bad in ("app.example.org", "https://app.example.org/path", "ftp://x.example"):
        with pytest.raises(ValidationError):
            _settings(cors_allow_origins=[bad])
    assert _settings(cors_allow_origins=["https://a.example/"]).cors_allow_origins == [
        "https://a.example"
    ]


def test_settings_read_documented_environment_names(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://a.example, https://b.example")
    monkeypatch.setenv("RATE_LIMIT_FEEDBACK_PER_MINUTE", "7")
    monkeypatch.setenv("SEED_ON_STARTUP", "false")
    monkeypatch.setenv("CONSENT_VERSIONS", "1,2")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./somewhere.db")
    s = Settings(_env_file=None)
    assert s.environment == "production"
    assert s.cors_allow_origins == ["https://a.example", "https://b.example"]
    assert s.rate_limit_feedback_per_minute == 7
    assert s.seed_on_startup is False
    assert s.consent_versions == ["1", "2"]
    assert s.database_url == "sqlite:///./somewhere.db"

    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "*")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)

    # APP_ENV (the name used in SECURITY_PRIVACY.md) is accepted as well.
    monkeypatch.delenv("ENVIRONMENT")
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_docs_are_off_in_production_unless_enabled(client_factory):
    production = client_factory(environment="production", cors_allow_origins=[ALLOWED_ORIGIN])
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert_error(production.get(path), 404, "not_found")
    assert "strict-transport-security" in production.get(f"{API}/health").headers

    enabled = client_factory(
        environment="production", cors_allow_origins=[ALLOWED_ORIGIN], enable_docs=True
    )
    assert enabled.get("/openapi.json").status_code == 200

    development = client_factory(environment="development")
    assert development.get("/docs").status_code == 200
    assert "strict-transport-security" not in development.get(f"{API}/health").headers


# ----------------------------------------------------------------------------- errors


def test_error_envelope_for_404_405_422(client):
    assert_error(client.get("/"), 404, "not_found")
    assert_error(client.get(f"{API}/nothing-here"), 404, "not_found")
    assert_error(client.put(f"{API}/models", json={}), 405, "method_not_allowed")
    assert_error(client.delete(f"{API}/models/x"), 405, "method_not_allowed")
    error = assert_error(client.get(f"{API}/vocabulary?limit=abc"), 422, "validation_error")
    assert error["details"][0]["field"] == "query.limit"


def test_unhandled_exception_gives_generic_500_without_internals(app_factory):
    app = app_factory()

    @app.get("/api/v1/_boom")
    def boom() -> None:
        raise RuntimeError("SELECT * FROM secret_table at C:\\srv\\app\\secret.py")

    with TestClient(app) as client:
        r = client.get("/api/v1/_boom", headers={"Origin": ALLOWED_ORIGIN})
    error = assert_error(r, 500, "internal_error")
    assert error == {"code": "internal_error", "message": "Internal server error."}
    for leak in ("secret", "SELECT", "RuntimeError", "Traceback", ".py"):
        assert leak not in r.text
    assert len(r.headers["X-Request-ID"]) == 32
    assert r.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert r.headers["x-content-type-options"] == "nosniff"


def test_database_failure_gives_generic_500(client_factory, empty_engine):
    # empty_engine has no tables, so the query fails inside SQLAlchemy.
    client = client_factory()
    r = client.get(f"{API}/models")
    assert_error(r, 500, "internal_error")
    for leak in ("sqlite", "sqlalchemy", "model_versions", "no such table"):
        assert leak not in r.text.lower()


# ----------------------------------------------------------------------------- headers


def test_security_headers_on_success_and_error(client):
    for r in (client.get(f"{API}/health"), client.get(f"{API}/models/nope")):
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert r.headers["referrer-policy"] == "no-referrer"
        assert r.headers["cache-control"] == "no-store"
        assert "default-src 'none'" in r.headers["content-security-policy"]
        assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
        assert "camera=()" in r.headers["permissions-policy"]
        assert len(r.headers["x-request-id"]) == 32
        assert r.headers["content-type"] == "application/json"
        assert "set-cookie" not in r.headers


def test_each_request_gets_its_own_request_id(client):
    first = client.get(f"{API}/health").headers["x-request-id"]
    second = client.get(f"{API}/health").headers["x-request-id"]
    assert first != second


# ----------------------------------------------------------------------------- startup


def test_startup_creates_tables_and_seeds_when_enabled(empty_engine):
    app = create_app(make_settings(auto_create_tables=True, seed_on_startup=True))
    with TestClient(app) as client:
        assert client.get(f"{API}/health").json()["database"] == "ok"
        models = client.get(f"{API}/models").json()
        assert models
        assert client.get(f"{API}/vocabulary").json()["total"] > 0
        assert client.get(f"{API}/research/experiments").json() == []

    # Starting again on the same database does not duplicate anything (seed is idempotent).
    with TestClient(create_app(make_settings(auto_create_tables=True, seed_on_startup=True))) as c:
        assert c.get(f"{API}/models").json() == models


def test_startup_without_seed_leaves_content_empty(empty_engine):
    app = create_app(make_settings(auto_create_tables=True, seed_on_startup=False))
    with TestClient(app) as client:
        assert client.get(f"{API}/models").json() == []
        assert client.get(f"{API}/vocabulary").json() == {"items": [], "total": 0}
