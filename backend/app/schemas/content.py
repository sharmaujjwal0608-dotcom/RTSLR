"""Models, vocabulary and learning schemas (docs/API_CONTRACTS.md)."""

from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.common import (
    ApiIn,
    ApiOut,
    Hands,
    MediaStatus,
    ModelInput,
    ModelKind,
    Motion,
    ScoreType,
    SignLanguage,
)


class HealthOut(ApiOut):
    status: Literal["ok"] = "ok"
    version: str
    database: Literal["ok", "error"]


class ModelOut(ApiOut):
    """Same meaning as ``ModelInfo`` in frontend/src/types/recognition.ts.

    ``validated`` is true only for a model with a documented, reproducible evaluation.
    """

    id: str
    version: str
    name: str
    sign_language: SignLanguage
    kind: ModelKind
    input: ModelInput
    score_type: ScoreType
    validated: bool
    class_count: int
    description: str
    limitations: list[str]


class SignOut(ApiOut):
    """A vocabulary item. It does not describe how the sign is formed."""

    id: str
    sign_language: SignLanguage
    label_en: str
    label_hi: str | None
    category: str
    hands: Hands
    motion: Motion
    media_status: MediaStatus
    media_url: str | None
    source_name: str | None
    source_url: str | None
    recognition_supported: bool


class VocabularyPage(ApiOut):
    items: list[SignOut]
    total: int


class VocabularyQuery(ApiIn):
    """Query parameters of ``GET /vocabulary``. Unknown parameters are rejected."""

    # Query parameter names are the snake_case names in the contract, not camelCase.
    model_config = ConfigDict(extra="forbid", alias_generator=None)

    category: str | None = Field(default=None, min_length=1, max_length=96)
    q: str | None = Field(default=None, min_length=1, max_length=64)
    sign_language: SignLanguage = "ISL"
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0, le=1_000_000)


class LessonsQuery(ApiIn):
    model_config = ConfigDict(extra="forbid", alias_generator=None)

    category: str | None = Field(default=None, min_length=1, max_length=96)


class CategoryOut(ApiOut):
    id: str
    title_en: str
    title_hi: str
    description_en: str
    description_hi: str
    sign_count: int


class LessonOut(ApiOut):
    id: str
    category_id: str
    title_en: str
    title_hi: str
    order: int
    sign_ids: list[str]
