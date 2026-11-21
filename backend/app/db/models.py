"""RTSLR database models (SQLAlchemy 2.x typed mappings).

Content tables use stable string identifiers (slugs) as primary keys so that the
seed, the frontend and the research JSON can all refer to the same row.
Feedback uses a random UUID.

Deliberately absent: tables for camera recordings, frames or landmarks, and any
user/account table. See docs/DATABASE.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, ClassVar, Optional, Union

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .base import Base

# --------------------------------------------------------------------------- #
# Allowed values (mirrors docs/API_CONTRACTS.md and frontend recognition.ts)   #
# --------------------------------------------------------------------------- #

SIGN_LANGUAGES = ("ISL", "ASL")
HANDS_VALUES = ("1", "2", "either")
MOTION_VALUES = ("static", "dynamic")
MEDIA_STATUSES = ("verified", "pending")
MODEL_KINDS = (
    "legacy_asl_prototype",
    "experimental_isl_user_trained",
    "validated_isl",
    "simulator",
)
MODEL_INPUTS = (
    "single_hand_static",
    "dual_hand_static",
    "single_or_dual_static",
    "sequence",
)
SCORE_TYPES = ("calibrated_probability", "classifier_score")
FEEDBACK_KINDS = ("recognition_issue", "content_issue", "general")
FEEDBACK_LOCALES = ("en", "hi")
FEEDBACK_MESSAGE_MAX = 2000

SLUG = 96  # max length of a content identifier


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class HandsType(TypeDecorator):
    """Stores hands as '1' | '2' | 'either'; Python side is 1 | 2 | 'either'.

    This matches ``SignOut.hands`` in the API contract, so a Pydantic model
    with ``Literal[1, 2, "either"]`` can read the attribute directly.
    """

    impl = String(8)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value)
        if text not in HANDS_VALUES:
            raise ValueError(f"hands must be 1, 2 or 'either', got {value!r}")
        return text

    def process_result_value(self, value: Any, dialect: Any) -> Union[int, str, None]:
        if value is None:
            return None
        return int(value) if value in ("1", "2") else value


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC timestamps on every backend.

    SQLite has no timezone support and returns naive values; this type converts
    to UTC on the way in and re-attaches UTC on the way out.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: Any, dialect: Any) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


# --------------------------------------------------------------------------- #
# Learning content                                                             #
# --------------------------------------------------------------------------- #


class Category(Base):
    """A vocabulary category of one sign language (Alphabet, Greetings, ...)."""

    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint(_in("sign_language", SIGN_LANGUAGES), name="sign_language"),
        Index("ix_categories_sign_language_sort_order", "sign_language", "sort_order"),
    )

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    sign_language: Mapped[str] = mapped_column(String(8), default="ISL")
    title_en: Mapped[str] = mapped_column(String(120))
    title_hi: Mapped[str] = mapped_column(String(120))
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_hi: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    signs: Mapped[list["Sign"]] = relationship(
        back_populates="category_obj",
        order_by="Sign.sort_order, Sign.id",
        cascade="all, delete-orphan",
    )
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="category_obj",
        order_by="Lesson.order, Lesson.id",
        cascade="all, delete-orphan",
    )

    @property
    def sign_count(self) -> int:
        """Number of signs in the category (``CategoryOut.signCount``)."""
        return len(self.signs)


class Sign(Base):
    """One vocabulary item. Not a description of how the sign is formed."""

    __tablename__ = "signs"
    __table_args__ = (
        CheckConstraint(_in("sign_language", SIGN_LANGUAGES), name="sign_language"),
        CheckConstraint(_in("hands", HANDS_VALUES), name="hands"),
        CheckConstraint(_in("motion", MOTION_VALUES), name="motion"),
        CheckConstraint(_in("media_status", MEDIA_STATUSES), name="media_status"),
        # "verified" is only allowed when both the media and its source are recorded.
        CheckConstraint(
            "media_status = 'pending' OR "
            "(media_url IS NOT NULL AND source_name IS NOT NULL AND source_url IS NOT NULL)",
            name="verified_needs_source",
        ),
        Index(
            "ix_signs_sign_language_category_id_sort_order",
            "sign_language",
            "category_id",
            "sort_order",
        ),
        Index("ix_signs_category_id", "category_id"),
        Index("ix_signs_label_en", "label_en"),
    )

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    sign_language: Mapped[str] = mapped_column(String(8), default="ISL")
    category_id: Mapped[str] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE")
    )
    label_en: Mapped[str] = mapped_column(String(64))
    label_hi: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    # hands/motion are NOT NULL because SignOut requires a value. For seeded rows
    # they are placeholders: see attributes_verified.
    hands: Mapped[Union[int, str]] = mapped_column(HandsType, default="either")
    motion: Mapped[str] = mapped_column(String(8), default="dynamic")
    #: False while hands/motion are unsourced placeholders.
    attributes_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    media_status: Mapped[str] = mapped_column(String(8), default="pending")
    media_url: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    source_name: Mapped[Optional[str]] = mapped_column(String(200), default=None)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    recognition_supported: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category_obj: Mapped[Category] = relationship(back_populates="signs")

    @property
    def category(self) -> str:
        """Category id (``SignOut.category``)."""
        return self.category_id


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        Index("ix_lessons_category_id_order", "category_id", "order"),
    )

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    category_id: Mapped[str] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE")
    )
    title_en: Mapped[str] = mapped_column(String(160))
    title_hi: Mapped[str] = mapped_column(String(160))
    order: Mapped[int] = mapped_column("order", Integer, default=0)

    category_obj: Mapped[Category] = relationship(back_populates="lessons")
    sign_links: Mapped[list["LessonSign"]] = relationship(
        back_populates="lesson",
        order_by="LessonSign.position",
        cascade="all, delete-orphan",
    )

    @property
    def sign_ids(self) -> list[str]:
        """Sign ids in lesson order (``LessonOut.signIds``)."""
        return [link.sign_id for link in self.sign_links]

    @property
    def signs(self) -> list[Sign]:
        return [link.sign for link in self.sign_links]


class LessonSign(Base):
    """Ordered lesson <-> sign association."""

    __tablename__ = "lesson_signs"
    __table_args__ = (
        Index("ix_lesson_signs_lesson_id_position", "lesson_id", "position"),
        Index("ix_lesson_signs_sign_id", "sign_id"),
    )

    lesson_id: Mapped[str] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True
    )
    sign_id: Mapped[str] = mapped_column(
        ForeignKey("signs.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    lesson: Mapped[Lesson] = relationship(back_populates="sign_links")
    sign: Mapped[Sign] = relationship()


# --------------------------------------------------------------------------- #
# Models                                                                       #
# --------------------------------------------------------------------------- #


class ModelVersion(Base):
    """Mirrors ``ModelInfo`` in frontend/src/types/recognition.ts."""

    __tablename__ = "model_versions"
    __table_args__ = (
        CheckConstraint(_in("sign_language", SIGN_LANGUAGES), name="sign_language"),
        CheckConstraint(_in("kind", MODEL_KINDS), name="kind"),
        CheckConstraint(_in("input", MODEL_INPUTS), name="input"),
        CheckConstraint(_in("score_type", SCORE_TYPES), name="score_type"),
        CheckConstraint("class_count >= 0", name="class_count_non_negative"),
        # Only a model of kind validated_isl may ever be flagged as validated.
        CheckConstraint(
            "NOT validated OR kind = 'validated_isl'", name="validated_kind"
        ),
    )

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    version: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(160))
    sign_language: Mapped[str] = mapped_column(String(8))
    kind: Mapped[str] = mapped_column(String(40))
    input: Mapped[str] = mapped_column(String(32))
    score_type: Mapped[str] = mapped_column(String(32))
    validated: Mapped[bool] = mapped_column(Boolean, default=False)
    class_count: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    limitations: Mapped[list[str]] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# --------------------------------------------------------------------------- #
# Research records (shapes follow research/data/*.json)                        #
# --------------------------------------------------------------------------- #


class ResearchRecordMixin:
    """Shared behaviour of tables loaded from research/data/*.json.

    ``position`` keeps the order of the source file. ``extra`` keeps any key the
    file contains that has no column yet, so nothing recorded is dropped.
    ``to_record()`` returns the record with the same keys as the JSON file.
    """

    #: JSON key -> column attribute
    FIELD_MAP: ClassVar[dict[str, str]] = {}

    position: Mapped[int] = mapped_column(Integer, default=0)
    extra: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    def to_record(self) -> dict[str, Any]:
        record = {key: getattr(self, attr) for key, attr in self.FIELD_MAP.items()}
        record.update(self.extra or {})
        return record


class Dataset(ResearchRecordMixin, Base):
    __tablename__ = "datasets"

    FIELD_MAP = {
        "id": "id",
        "name": "name",
        "signLanguage": "sign_language",
        "description": "description",
        "classes": "classes",
        "size": "size",
        "signers": "signers",
        "modality": "modality",
        "staticOrDynamic": "static_or_dynamic",
        "license": "license",
        "url": "url",
        "limitations": "limitations",
        "verified": "verified",
        "usedByRtslr": "used_by_rtslr",
    }

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    sign_language: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text, default="")
    classes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    size: Mapped[Optional[str]] = mapped_column(Text, default=None)
    signers: Mapped[Optional[str]] = mapped_column(Text, default=None)
    modality: Mapped[Optional[str]] = mapped_column(Text, default=None)
    static_or_dynamic: Mapped[Optional[str]] = mapped_column(String(32), default=None)
    license: Mapped[Optional[str]] = mapped_column(Text, default=None)
    url: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    limitations: Mapped[Optional[str]] = mapped_column(Text, default=None)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    used_by_rtslr: Mapped[bool] = mapped_column(Boolean, default=False)


class Reference(ResearchRecordMixin, Base):
    # "references" is a reserved word in SQL, hence the table name.
    __tablename__ = "research_references"

    FIELD_MAP = {
        "id": "id",
        "title": "title",
        "authors": "authors",
        "year": "year",
        "venue": "venue",
        "url": "url",
        "summary": "summary",
        "verified": "verified",
        "verificationNote": "verification_note",
    }

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    authors: Mapped[list[str]] = mapped_column(JSON, default=list)
    year: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    venue: Mapped[Optional[str]] = mapped_column(Text, default=None)
    url: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    summary: Mapped[str] = mapped_column(Text, default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_note: Mapped[Optional[str]] = mapped_column(Text, default=None)

    benchmarks: Mapped[list["PublishedBenchmark"]] = relationship(
        back_populates="reference"
    )


class PublishedBenchmark(ResearchRecordMixin, Base):
    """A result published by someone else. Never an RTSLR result."""

    __tablename__ = "published_benchmarks"
    __table_args__ = (
        Index("ix_published_benchmarks_reference_id", "reference_id"),
    )

    FIELD_MAP = {
        "id": "id",
        "referenceId": "reference_id",
        "signLanguage": "sign_language",
        "task": "task",
        "classes": "classes",
        "method": "method",
        "metricName": "metric_name",
        "metricValue": "metric_value",
        "dataset": "dataset",
        "evaluationProtocol": "evaluation_protocol",
        "caveat": "caveat",
    }

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    reference_id: Mapped[str] = mapped_column(
        ForeignKey("research_references.id", ondelete="RESTRICT")
    )
    sign_language: Mapped[str] = mapped_column(String(32))
    task: Mapped[str] = mapped_column(Text)
    classes: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    method: Mapped[str] = mapped_column(Text)
    metric_name: Mapped[str] = mapped_column(String(120))
    metric_value: Mapped[Optional[float]] = mapped_column(Float, default=None)
    dataset: Mapped[Optional[str]] = mapped_column(Text, default=None)
    evaluation_protocol: Mapped[Optional[str]] = mapped_column(Text, default=None)
    caveat: Mapped[Optional[str]] = mapped_column(Text, default=None)

    reference: Mapped[Reference] = relationship(back_populates="benchmarks")


class Experiment(ResearchRecordMixin, Base):
    """An experiment RTSLR actually ran. Empty until a real run is recorded.

    research/data/rtslr-experiments.json is ``[]`` today, so no record shape
    exists yet. The columns follow the "Recording a result" rule in
    research/experiments/EXPERIMENT_SPECS.md; anything else lands in ``extra``.
    """

    __tablename__ = "rtslr_experiments"

    FIELD_MAP = {
        "id": "id",
        "experimentId": "experiment_id",
        "title": "title",
        "date": "date",
        "commit": "commit",
        "datasetVersion": "dataset_version",
        "protocol": "protocol",
        "metrics": "metrics",
        "artefactsUrl": "artefacts_url",
    }

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    experiment_id: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    title: Mapped[Optional[str]] = mapped_column(Text, default=None)
    date: Mapped[Optional[str]] = mapped_column(String(32), default=None)
    commit: Mapped[Optional[str]] = mapped_column("commit", String(64), default=None)
    dataset_version: Mapped[Optional[str]] = mapped_column(Text, default=None)
    protocol: Mapped[Optional[str]] = mapped_column(Text, default=None)
    metrics: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=None)
    artefacts_url: Mapped[Optional[str]] = mapped_column(String(500), default=None)


class RoadmapItem(ResearchRecordMixin, Base):
    __tablename__ = "roadmap_items"

    FIELD_MAP = {
        "id": "id",
        "phase": "phase",
        "title": "title",
        "description": "description",
        "status": "status",
        "dependsOn": "depends_on",
    }

    id: Mapped[str] = mapped_column(String(SLUG), primary_key=True)
    phase: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32))
    depends_on: Mapped[list[str]] = mapped_column(JSON, default=list)


# --------------------------------------------------------------------------- #
# Feedback                                                                     #
# --------------------------------------------------------------------------- #


class Feedback(Base):
    """Consent-managed feedback.

    Never add columns for IP address, user agent, images, frames or landmarks.
    The deletion token is stored only as a SHA-256 hex digest.
    """

    __tablename__ = "feedback"
    __table_args__ = (
        CheckConstraint(_in("kind", FEEDBACK_KINDS), name="kind"),
        CheckConstraint(
            f"length(message) >= 1 AND length(message) <= {FEEDBACK_MESSAGE_MAX}",
            name="message_length",
        ),
        CheckConstraint(
            f"locale IS NULL OR {_in('locale', FEEDBACK_LOCALES)}", name="locale"
        ),
        Index("ix_feedback_created_at", "created_at"),
        Index("ix_feedback_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)
    consent_version: Mapped[str] = mapped_column(String(32))
    consent_given_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    model_id: Mapped[Optional[str]] = mapped_column(String(SLUG), default=None)
    class_id: Mapped[Optional[str]] = mapped_column(String(SLUG), default=None)
    locale: Mapped[Optional[str]] = mapped_column(String(16), default=None)
    deletion_token_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, default=None)


__all__ = [
    "Base",
    "Category",
    "Sign",
    "Lesson",
    "LessonSign",
    "ModelVersion",
    "Dataset",
    "Reference",
    "PublishedBenchmark",
    "Experiment",
    "RoadmapItem",
    "Feedback",
]
