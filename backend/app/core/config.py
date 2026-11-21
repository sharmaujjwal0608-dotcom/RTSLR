"""Application settings, read once from the environment (and an optional ``.env`` file).

Every setting has a safe development default. In production the settings object refuses to
build when the CORS allow-list is empty or contains a wildcard, or when the database URL still
holds a placeholder (SECURITY_PRIVACY.md BE-09, BE-15).
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_VERSION = "1.0.0"
API_PREFIX = "/api/v1"

_PLACEHOLDER_MARKERS = ("CHANGE_ME", "changeme", "<password>")


def _split_list(value: object) -> object:
    """Accept ``a,b,c`` or a JSON array for list settings."""
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            return json.loads(text)
        return [part.strip() for part in text.split(",") if part.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # ENVIRONMENT is the documented name; APP_ENV is accepted because SECURITY_PRIVACY.md uses it.
    environment: Literal["development", "test", "production"] = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV"),
    )
    database_url: str = Field(default="sqlite:///./rtslr.db", min_length=1)

    cors_allow_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # Feedback write limits (POST and DELETE /feedback share them). 0 disables a limit.
    rate_limit_feedback_per_minute: int = Field(
        default=10,
        ge=0,
        le=10_000,
        validation_alias=AliasChoices(
            "RATE_LIMIT_FEEDBACK_PER_MINUTE", "RATE_LIMIT_WRITE_PER_MINUTE"
        ),
    )
    rate_limit_feedback_per_day: int = Field(
        default=100,
        ge=0,
        le=1_000_000,
        validation_alias=AliasChoices("RATE_LIMIT_FEEDBACK_PER_DAY", "RATE_LIMIT_WRITE_PER_DAY"),
    )
    rate_limit_read_per_minute: int = Field(default=120, ge=0, le=100_000)

    # Proxies whose X-Forwarded-For header is trusted. Empty: use the socket address.
    trusted_proxy_ips: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # Create missing tables at startup (development). With Alembic-managed databases set false.
    auto_create_tables: bool = True
    # Load the seed content at startup (idempotent).
    seed_on_startup: bool = True

    # Feedback rows are deleted this many days after they were created.
    feedback_retention_days: int = Field(default=365, ge=1, le=3650)

    # Consent text versions the API accepts for feedback.
    consent_versions: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["1"],
        validation_alias=AliasChoices("CONSENT_VERSIONS", "CONSENT_VERSION"),
    )

    max_body_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    enable_docs: bool = False
    log_level: str = Field(default="info", max_length=16)

    @field_validator("cors_allow_origins", "trusted_proxy_ips", "consent_versions", mode="before")
    @classmethod
    def _parse_lists(cls, value: object) -> object:
        return _split_list(value)

    @field_validator("consent_versions")
    @classmethod
    def _check_consent_versions(cls, value: list[str]) -> list[str]:
        cleaned = [str(v).strip() for v in value if str(v).strip()]
        if not cleaned:
            raise ValueError("CONSENT_VERSIONS must name at least one consent text version")
        for version in cleaned:
            if len(version) > 32:
                raise ValueError("a consent version is at most 32 characters")
        return cleaned

    @field_validator("cors_allow_origins")
    @classmethod
    def _check_origins(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for origin in value:
            origin = origin.strip().rstrip("/")
            if origin == "*":
                cleaned.append(origin)
                continue
            parts = urlsplit(origin)
            if parts.scheme not in ("http", "https") or not parts.netloc or parts.path:
                raise ValueError(
                    "CORS_ALLOW_ORIGINS entries must be exact origins such as "
                    "https://app.example.org (scheme and host, no path)"
                )
            cleaned.append(origin)
        return cleaned

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if self.environment == "production":
            if not self.cors_allow_origins:
                raise ValueError("CORS_ALLOW_ORIGINS must list the frontend origin(s) in production")
            if "*" in self.cors_allow_origins:
                raise ValueError("CORS_ALLOW_ORIGINS must not contain '*' in production")
            if any(marker in self.database_url for marker in _PLACEHOLDER_MARKERS):
                raise ValueError("DATABASE_URL still contains a placeholder value")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_enabled(self) -> bool:
        return (not self.is_production) or self.enable_docs


@lru_cache
def get_settings() -> Settings:
    """Process-wide settings. Tests build their own ``Settings`` and pass it to ``create_app``."""
    return Settings()
