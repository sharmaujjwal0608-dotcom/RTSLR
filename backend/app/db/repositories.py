"""Query functions used by the API layer (docs/API_CONTRACTS.md).

Every function takes a SQLAlchemy ``Session`` first. Read functions do not
commit. ``create_feedback``, ``delete_feedback`` and the purge functions commit
their own transaction.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from .models import (
    Category,
    Dataset,
    Experiment,
    Feedback,
    Lesson,
    LessonSign,
    ModelVersion,
    PublishedBenchmark,
    Reference,
    RoadmapItem,
    Sign,
)

DEFAULT_FEEDBACK_RETENTION_DAYS = 365
MAX_SIGN_PAGE = 200

# --------------------------------------------------------------------------- #
# Models                                                                       #
# --------------------------------------------------------------------------- #


def list_models(db: Session) -> list[ModelVersion]:
    stmt = select(ModelVersion).order_by(ModelVersion.sort_order, ModelVersion.id)
    return list(db.scalars(stmt))


def get_model(db: Session, model_id: str) -> Optional[ModelVersion]:
    return db.get(ModelVersion, model_id)


# --------------------------------------------------------------------------- #
# Vocabulary                                                                   #
# --------------------------------------------------------------------------- #


def _like_pattern(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def search_signs(
    db: Session,
    *,
    sign_language: str,
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Sign], int]:
    """Page of signs plus the total number of matches.

    ``category`` is a category id. ``q`` is matched as a case-insensitive
    substring of the English label or the Hindi label (Devanagari has no case;
    the comparison there is a plain substring match).
    """
    limit = max(1, min(int(limit), MAX_SIGN_PAGE))
    offset = max(0, int(offset))

    conditions = [Sign.sign_language == sign_language]
    if category:
        conditions.append(Sign.category_id == category)
    needle = (q or "").strip()
    if needle:
        pattern = _like_pattern(needle.lower())
        conditions.append(
            or_(
                func.lower(Sign.label_en).like(pattern, escape="\\"),
                func.lower(Sign.label_hi).like(pattern, escape="\\"),
            )
        )

    total = db.scalar(select(func.count()).select_from(Sign).where(*conditions)) or 0
    stmt = (
        select(Sign)
        .join(Category, Category.id == Sign.category_id)
        .where(*conditions)
        .order_by(Category.sort_order, Sign.category_id, Sign.sort_order, Sign.id)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt)), int(total)


def get_sign(db: Session, sign_id: str) -> Optional[Sign]:
    return db.get(Sign, sign_id)


# --------------------------------------------------------------------------- #
# Learning                                                                     #
# --------------------------------------------------------------------------- #


def list_categories(db: Session) -> list[Category]:
    """Categories in display order, with ``signs`` loaded for ``sign_count``."""
    stmt = (
        select(Category)
        .options(selectinload(Category.signs))
        .order_by(Category.sort_order, Category.id)
    )
    return list(db.scalars(stmt))


def list_lessons(db: Session, category_id: Optional[str] = None) -> list[Lesson]:
    """Lessons in category then lesson order, with ``sign_ids`` loaded."""
    stmt = (
        select(Lesson)
        .join(Category, Category.id == Lesson.category_id)
        .options(selectinload(Lesson.sign_links))
        .order_by(Category.sort_order, Lesson.category_id, Lesson.order, Lesson.id)
    )
    if category_id:
        stmt = stmt.where(Lesson.category_id == category_id)
    return list(db.scalars(stmt))


def get_lesson(db: Session, lesson_id: str) -> Optional[Lesson]:
    stmt = (
        select(Lesson)
        .options(selectinload(Lesson.sign_links).selectinload(LessonSign.sign))
        .where(Lesson.id == lesson_id)
    )
    return db.scalars(stmt).first()


# --------------------------------------------------------------------------- #
# Research                                                                     #
# --------------------------------------------------------------------------- #


def list_datasets(db: Session) -> list[Dataset]:
    return list(db.scalars(select(Dataset).order_by(Dataset.position, Dataset.id)))


def list_references(db: Session) -> list[Reference]:
    return list(
        db.scalars(select(Reference).order_by(Reference.position, Reference.id))
    )


def list_benchmarks(db: Session) -> list[PublishedBenchmark]:
    stmt = select(PublishedBenchmark).order_by(
        PublishedBenchmark.position, PublishedBenchmark.id
    )
    return list(db.scalars(stmt))


def list_experiments(db: Session) -> list[Experiment]:
    return list(
        db.scalars(select(Experiment).order_by(Experiment.position, Experiment.id))
    )


def list_roadmap(db: Session) -> list[RoadmapItem]:
    return list(
        db.scalars(select(RoadmapItem).order_by(RoadmapItem.position, RoadmapItem.id))
    )


# --------------------------------------------------------------------------- #
# Feedback                                                                     #
# --------------------------------------------------------------------------- #


def hash_deletion_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Compared against when the id is unknown, so both failure paths do one digest
# and one constant-time comparison.
_DUMMY_TOKEN_HASH = hash_deletion_token("rtslr-no-such-feedback")


def _retention_days(explicit: Optional[int]) -> int:
    if explicit is not None:
        return int(explicit)
    raw = os.environ.get("FEEDBACK_RETENTION_DAYS", "")
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_FEEDBACK_RETENTION_DAYS
    return value if value > 0 else DEFAULT_FEEDBACK_RETENTION_DAYS


def create_feedback(
    db: Session,
    *,
    kind: str,
    message: str,
    consent_version: str,
    model_id: Optional[str] = None,
    class_id: Optional[str] = None,
    locale: Optional[str] = None,
    retention_days: Optional[int] = None,
) -> tuple[Feedback, str]:
    """Store one feedback item. Returns the row and the plain deletion token.

    The token is returned once and never stored; only its SHA-256 digest is.
    The caller must already have checked consent: calling this function is the
    record that consent was given, and ``consent_given_at`` is set to now.
    """
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    feedback = Feedback(
        id=uuid.uuid4(),
        kind=kind,
        message=message,
        consent_version=str(consent_version),
        consent_given_at=now,
        model_id=model_id,
        class_id=class_id,
        locale=locale,
        deletion_token_hash=hash_deletion_token(token),
        created_at=now,
        expires_at=now + timedelta(days=_retention_days(retention_days)),
    )
    db.add(feedback)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return feedback, token


def _as_uuid(value: Union[str, uuid.UUID, None]) -> Optional[uuid.UUID]:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def delete_feedback(
    db: Session, feedback_id: Union[str, uuid.UUID], token: Optional[str]
) -> bool:
    """Delete one feedback row if ``token`` matches. Real DELETE, no soft flag.

    Returns False for an unknown or malformed id and for a wrong token alike,
    so the API can answer 404 in both cases.
    """
    key = _as_uuid(feedback_id)
    feedback = db.get(Feedback, key) if key is not None else None
    stored_hash = feedback.deletion_token_hash if feedback else _DUMMY_TOKEN_HASH
    supplied_hash = hash_deletion_token(token if isinstance(token, str) else "")
    matches = hmac.compare_digest(stored_hash, supplied_hash)
    if feedback is None or not matches:
        return False
    db.delete(feedback)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def purge_feedback_older_than(db: Session, days: int) -> int:
    """Delete feedback created more than ``days`` days ago. Returns the count."""
    if days < 0:
        raise ValueError("days must be >= 0")
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = db.execute(delete(Feedback).where(Feedback.created_at < cutoff))
    db.commit()
    return int(result.rowcount or 0)


def purge_expired_feedback(db: Session, now: Optional[datetime] = None) -> int:
    """Delete feedback whose ``expires_at`` has passed. Returns the count."""
    moment = now or datetime.now(timezone.utc)
    result = db.execute(
        delete(Feedback).where(
            Feedback.expires_at.is_not(None), Feedback.expires_at < moment
        )
    )
    db.commit()
    return int(result.rowcount or 0)


__all__ = [
    "list_models",
    "get_model",
    "search_signs",
    "get_sign",
    "list_categories",
    "list_lessons",
    "get_lesson",
    "list_datasets",
    "list_references",
    "list_benchmarks",
    "list_experiments",
    "list_roadmap",
    "create_feedback",
    "delete_feedback",
    "purge_feedback_older_than",
    "purge_expired_feedback",
    "hash_deletion_token",
]
