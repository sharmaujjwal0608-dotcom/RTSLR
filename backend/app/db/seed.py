"""Idempotent seed: ``seed(db)``.

Sources:

* ``backend/app/db/seed_data/models.json``      model versions
* ``backend/app/db/seed_data/curriculum.json``  categories, signs, lessons
* ``research/data/*.json``                      research records, read from disk
  on every call (never copied into this package)

Running it twice gives the same rows. Run from ``backend/`` with
``python -m app.db.seed`` to create the tables and seed the configured database.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import (
    Category,
    Dataset,
    Experiment,
    Lesson,
    LessonSign,
    ModelVersion,
    PublishedBenchmark,
    Reference,
    RoadmapItem,
    Sign,
)

logger = logging.getLogger(__name__)

SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
# backend/app/db/seed.py -> repository root is three levels above "db".
DEFAULT_RESEARCH_DATA_DIR = Path(__file__).resolve().parents[3] / "research" / "data"

#: file name -> model, in dependency order (references before benchmarks)
RESEARCH_FILES: tuple[tuple[str, type], ...] = (
    ("references.json", Reference),
    ("datasets.json", Dataset),
    ("published-benchmarks.json", PublishedBenchmark),
    ("rtslr-experiments.json", Experiment),
    ("roadmap.json", RoadmapItem),
)

ISLRTC_DATASET_ID = "ds-islrtc-dictionary"
ISLRTC_REFERENCE_ID = "ref-islrtc-home"


class SeedError(RuntimeError):
    """Seed input is missing or inconsistent."""


def research_data_dir(override: Optional[os.PathLike | str] = None) -> Path:
    if override is not None:
        return Path(override)
    env = os.environ.get("RTSLR_RESEARCH_DATA_DIR")
    return Path(env) if env else DEFAULT_RESEARCH_DATA_DIR


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def sign_id_for(sign_language: str, category_id: str, label_en: str) -> str:
    return f"{sign_language.lower()}-{category_id}-{_slug(label_en)}"


# --------------------------------------------------------------------------- #
# Models                                                                       #
# --------------------------------------------------------------------------- #


def _seed_models(db: Session) -> int:
    records = _load_json(SEED_DATA_DIR / "models.json")
    for order, record in enumerate(records):
        if record.get("validated") or record.get("kind") == "validated_isl":
            # No validated ISL model exists; the seed must never create one.
            raise SeedError(f"model {record.get('id')!r}: seed models must be unvalidated")
        db.merge(
            ModelVersion(
                id=record["id"],
                version=record["version"],
                name=record["name"],
                sign_language=record["signLanguage"],
                kind=record["kind"],
                input=record["input"],
                score_type=record["scoreType"],
                validated=False,
                class_count=int(record.get("classCount", 0)),
                description=record.get("description", ""),
                limitations=list(record.get("limitations", [])),
                sort_order=order,
            )
        )
    return len(records)


# --------------------------------------------------------------------------- #
# Curriculum                                                                   #
# --------------------------------------------------------------------------- #


def find_dictionary_url(research_dir: Path) -> Optional[str]:
    """Public URL of the ISLRTC dictionary as recorded by the research files.

    Returns None when neither record is present, in which case signs are seeded
    without a source.
    """
    for file_name, record_id in (
        ("datasets.json", ISLRTC_DATASET_ID),
        ("references.json", ISLRTC_REFERENCE_ID),
    ):
        path = research_dir / file_name
        if not path.is_file():
            continue
        try:
            records = _load_json(path)
        except (OSError, ValueError):
            continue
        for record in records if isinstance(records, list) else []:
            if isinstance(record, dict) and record.get("id") == record_id:
                url = record.get("url")
                if isinstance(url, str) and url.startswith("https://"):
                    return url
    return None


def _seed_curriculum(db: Session, research_dir: Path) -> dict[str, int]:
    data = _load_json(SEED_DATA_DIR / "curriculum.json")
    sign_language = data.get("signLanguage", "ISL")
    source_url = find_dictionary_url(research_dir)
    source_name = data.get("dictionarySourceName") if source_url else None

    counts = {"categories": 0, "signs": 0, "lessons": 0}
    for cat_order, cat in enumerate(data["categories"]):
        db.merge(
            Category(
                id=cat["id"],
                sign_language=sign_language,
                title_en=cat["titleEn"],
                title_hi=cat["titleHi"],
                description_en=cat.get("descriptionEn", ""),
                description_hi=cat.get("descriptionHi", ""),
                sort_order=cat_order,
            )
        )
        counts["categories"] += 1
        db.flush()

        ids_by_label: dict[str, str] = {}
        for sign_order, (label_en, label_hi) in enumerate(cat["signs"]):
            sign_id = sign_id_for(sign_language, cat["id"], label_en)
            if label_en in ids_by_label:
                raise SeedError(f"duplicate sign {label_en!r} in category {cat['id']!r}")
            ids_by_label[label_en] = sign_id
            sign = db.get(Sign, sign_id)
            if sign is None:
                # hands/motion are unsourced placeholders (attributes_verified
                # stays False); media is pending; nothing is recognised.
                sign = Sign(
                    id=sign_id,
                    hands="either",
                    motion="dynamic",
                    attributes_verified=False,
                    media_status="pending",
                    media_url=None,
                    recognition_supported=False,
                )
                db.add(sign)
            sign.sign_language = sign_language
            sign.category_id = cat["id"]
            sign.label_en = label_en
            sign.label_hi = label_hi
            sign.sort_order = sign_order
            if sign.media_status == "pending":
                # A row whose media was verified later keeps its recorded source.
                sign.source_name = source_name
                sign.source_url = source_url
            counts["signs"] += 1
        db.flush()

        for lesson_order, lesson in enumerate(cat.get("lessons", [])):
            db.merge(
                Lesson(
                    id=lesson["id"],
                    category_id=cat["id"],
                    title_en=lesson["titleEn"],
                    title_hi=lesson["titleHi"],
                    order=lesson_order,
                )
            )
            db.flush()
            try:
                wanted = [ids_by_label[label] for label in lesson["signs"]]
            except KeyError as exc:
                raise SeedError(
                    f"lesson {lesson['id']!r} refers to unknown sign {exc.args[0]!r}"
                ) from exc
            if len(set(wanted)) != len(wanted):
                raise SeedError(f"lesson {lesson['id']!r} lists a sign twice")
            db.execute(
                delete(LessonSign).where(
                    LessonSign.lesson_id == lesson["id"],
                    LessonSign.sign_id.not_in(wanted),
                )
            )
            for position, sign_id in enumerate(wanted):
                db.merge(
                    LessonSign(lesson_id=lesson["id"], sign_id=sign_id, position=position)
                )
            counts["lessons"] += 1
        db.flush()
    return counts


# --------------------------------------------------------------------------- #
# Research                                                                     #
# --------------------------------------------------------------------------- #


def _row_from_record(model: type, record: dict[str, Any], position: int):
    if not isinstance(record, dict) or not isinstance(record.get("id"), str):
        raise SeedError(f"{model.__tablename__}: every record needs a string 'id'")
    field_map: dict[str, str] = model.FIELD_MAP
    values = {attr: record[key] for key, attr in field_map.items() if key in record}
    extra = {key: value for key, value in record.items() if key not in field_map}
    return model(**values, position=position, extra=extra)


def _seed_research(db: Session, research_dir: Path) -> dict[str, int]:
    loaded: dict[type, list[dict[str, Any]]] = {}
    for file_name, model in RESEARCH_FILES:
        path = research_dir / file_name
        if not path.is_file():
            # Leave the table as it is rather than wiping it.
            logger.warning("research file not found, table left unchanged: %s", path)
            continue
        records = _load_json(path)
        if not isinstance(records, list):
            raise SeedError(f"{path}: expected a JSON array")
        ids = [r.get("id") if isinstance(r, dict) else None for r in records]
        if len(set(ids)) != len(ids):
            raise SeedError(f"{path}: duplicate ids")
        loaded[model] = records

    if PublishedBenchmark in loaded:
        if Reference in loaded:
            known = {r.get("id") for r in loaded[Reference]}
        else:
            known = set(db.scalars(select(Reference.id)))
        missing = sorted(
            {
                str(r.get("referenceId"))
                for r in loaded[PublishedBenchmark]
                if r.get("referenceId") not in known
            }
        )
        if missing:
            raise SeedError(
                "published-benchmarks.json refers to unknown references: "
                + ", ".join(missing)
            )

    counts: dict[str, int] = {}
    # Upsert in dependency order.
    for _file_name, model in RESEARCH_FILES:
        if model not in loaded:
            continue
        for position, record in enumerate(loaded[model]):
            db.merge(_row_from_record(model, record, position))
        db.flush()
        counts[model.__tablename__] = len(loaded[model])

    # The tables mirror the files: rows that are no longer recorded are removed,
    # children first.
    for _file_name, model in reversed(RESEARCH_FILES):
        if model not in loaded:
            continue
        keep = [record["id"] for record in loaded[model]]
        db.execute(delete(model).where(model.id.not_in(keep)))
    db.flush()
    return counts


# --------------------------------------------------------------------------- #
# Entry points                                                                 #
# --------------------------------------------------------------------------- #


def seed(db: Session, research_dir: Optional[os.PathLike | str] = None) -> dict[str, int]:
    """Upsert all seed content and commit. Returns row counts per table.

    ``research_dir`` overrides the location of ``research/data`` (default: the
    repository's own directory, or ``RTSLR_RESEARCH_DATA_DIR``).
    """
    directory = research_data_dir(research_dir)
    try:
        counts: dict[str, int] = {"model_versions": _seed_models(db)}
        db.flush()
        counts.update(_seed_curriculum(db, directory))
        counts.update(_seed_research(db, directory))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return counts


def main() -> None:
    from .session import SessionLocal, init_db

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    init_db()
    with SessionLocal() as db:
        counts = seed(db)
    for table, count in counts.items():
        logger.info("%-22s %d", table, count)


if __name__ == "__main__":
    main()
