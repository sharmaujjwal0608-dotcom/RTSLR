"""Shared Pydantic bases and enumerations.

JSON uses camelCase; Python and the ORM use snake_case. Output models read ORM objects
directly (``from_attributes``). Input models reject unknown fields.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

SignLanguage = Literal["ISL", "ASL"]
ModelKind = Literal[
    "legacy_asl_prototype",
    "experimental_isl_user_trained",
    "validated_isl",
    "simulator",
]
ModelInput = Literal[
    "single_hand_static",
    "dual_hand_static",
    "single_or_dual_static",
    "sequence",
]
ScoreType = Literal["calibrated_probability", "classifier_score"]
Hands = Literal[1, 2, "either"]
Motion = Literal["static", "dynamic"]
MediaStatus = Literal["verified", "pending"]
FeedbackKind = Literal["recognition_issue", "content_issue", "general"]
Locale = Literal["en", "hi"]


class ApiOut(BaseModel):
    """Base for responses: camelCase in JSON, readable from ORM attributes."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ApiIn(BaseModel):
    """Base for request bodies and query models: camelCase in JSON, unknown fields rejected."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=False,
    )


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    """Envelope of every non-2xx response."""

    error: ErrorDetail
