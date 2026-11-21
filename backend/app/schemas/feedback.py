"""Consent-managed feedback schemas.

There is deliberately no field for an image, a frame, landmarks, a name, an email address, an
IP address or a user agent, and unknown fields are rejected, so none of those can be submitted.
"""

from __future__ import annotations

import uuid

from pydantic import Field, StrictBool, field_validator

from app.schemas.common import ApiIn, ApiOut, FeedbackKind, Locale

MESSAGE_MAX = 2000
_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:\-]*$"


def _strip_control_chars(text: str) -> str:
    """Drop control characters other than newline and tab (BE-05)."""
    return "".join(ch for ch in text if ch in "\n\t" or (ord(ch) >= 32 and ord(ch) != 127))


class FeedbackIn(ApiIn):
    # ``consent`` and ``consentVersion`` are typed here and enforced in the feedback service,
    # which answers 400 (not 422) when consent is absent/false or the version is unknown (BE-20).
    consent: StrictBool = Field(
        default=False,
        description="Must be literally true. Anything else is refused and nothing is stored.",
    )
    consent_version: str | None = Field(
        default=None,
        max_length=32,
        description="Version of the consent text the user saw. Must be one the server accepts.",
    )
    kind: FeedbackKind
    message: str = Field(
        min_length=1,
        max_length=MESSAGE_MAX,
        description="Plain text, 1-2000 characters. Stored and returned as text, never as HTML.",
    )
    model_id: str | None = Field(default=None, min_length=1, max_length=96, pattern=_ID_PATTERN)
    class_id: str | None = Field(default=None, min_length=1, max_length=96, pattern=_ID_PATTERN)
    locale: Locale | None = None

    @field_validator("message")
    @classmethod
    def _clean_message(cls, value: str) -> str:
        cleaned = _strip_control_chars(value).strip()
        if not cleaned:
            raise ValueError("message must contain text")
        return cleaned


class FeedbackOut(ApiOut):
    id: uuid.UUID
    deletion_token: str = Field(
        description="Shown once. Only its hash is stored; keep it to delete this feedback later."
    )
