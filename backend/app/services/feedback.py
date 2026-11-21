"""Feedback rules that sit between the router and the repository.

Stored per item: kind, message, consent version and time, optional model id / class id /
locale, the hash of the deletion token, created/expiry times. Nothing about the sender is
stored: no IP address, no user agent, no image, no landmarks.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.db import repositories
from app.schemas import FeedbackIn, FeedbackOut

_MAX_TOKEN_LENGTH = 256


def create_feedback(db: Session, payload: FeedbackIn, settings: Settings) -> FeedbackOut:
    """Store feedback only with explicit consent to a consent text the server knows (BE-20)."""
    if payload.consent is not True:
        raise ApiError(
            400,
            "consent_required",
            "Feedback is stored only with consent. Send consent: true.",
        )
    if payload.consent_version is None or payload.consent_version not in settings.consent_versions:
        raise ApiError(
            400,
            "unknown_consent_version",
            "consentVersion is missing or is not a consent text version this server accepts.",
        )
    # modelId and classId are optional context. They are checked for shape and length only
    # (schema), not against the models table: recognisers run in the browser and can have ids
    # (user-trained templates, client-side model ids) that the server has no row for.

    feedback, token = repositories.create_feedback(
        db,
        kind=payload.kind,
        message=payload.message,
        consent_version=payload.consent_version,
        model_id=payload.model_id,
        class_id=payload.class_id,
        locale=payload.locale,
        retention_days=settings.feedback_retention_days,
    )
    return FeedbackOut(id=feedback.id, deletion_token=token)


def delete_feedback(db: Session, feedback_id: str, token: str | None) -> None:
    """Delete feedback when the token matches.

    A missing token, a wrong token, a malformed id and an unknown id all give the same 404, so
    the endpoint cannot be used to find out which ids exist (BE-24).
    """
    deleted = False
    if token and len(token) <= _MAX_TOKEN_LENGTH and len(feedback_id) <= 64:
        deleted = repositories.delete_feedback(db, feedback_id, token)
    if not deleted:
        raise ApiError(404, "not_found", "Feedback not found.")
