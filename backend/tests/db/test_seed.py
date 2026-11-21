from __future__ import annotations

import json
import shutil

import pytest
from sqlalchemy import select

from app.db import repositories as repo
from app.db.base import Base
from app.db.models import (
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
from app.db.seed import SeedError, find_dictionary_url, seed

from .conftest import load_research

EXPECTED_CATEGORY_TITLES = [
    "Alphabet",
    "Numbers",
    "Greetings",
    "Everyday",
    "Family",
    "Questions",
    "Time and days",
    "Places",
]


def snapshot(db) -> dict[str, list[tuple]]:
    db.expire_all()
    data = {}
    for table in Base.metadata.sorted_tables:
        rows = db.execute(select(table)).all()
        data[table.name] = sorted(tuple(map(repr, row)) for row in rows)
    return data


def test_seed_is_idempotent(db):
    first_counts = seed(db)
    first = snapshot(db)
    second_counts = seed(db)
    second = snapshot(db)
    assert first_counts == second_counts
    assert first == second
    assert first["signs"], "seed produced no signs"


def test_models_are_the_three_real_unvalidated_entries(seeded):
    models = seeded.scalars(select(ModelVersion)).all()
    assert {m.kind for m in models} == {
        "legacy_asl_prototype",
        "experimental_isl_user_trained",
        "simulator",
    }
    assert len(models) == 3
    assert all(m.validated is False for m in models)
    assert not [m for m in models if m.kind == "validated_isl"]
    legacy = next(m for m in models if m.kind == "legacy_asl_prototype")
    assert legacy.sign_language == "ASL"
    assert all(isinstance(m.limitations, list) and m.limitations for m in models)


def test_categories_have_english_and_hindi_titles(seeded):
    categories = repo.list_categories(seeded)
    assert [c.title_en for c in categories] == EXPECTED_CATEGORY_TITLES
    for category in categories:
        assert category.title_hi and category.title_hi != category.title_en
        assert category.description_en and category.description_hi
        assert category.sign_count > 0


def test_every_sign_is_pending_unsupported_and_unverified(seeded, research_dir):
    signs = seeded.scalars(select(Sign)).all()
    assert len(signs) > 50
    url = find_dictionary_url(research_dir)
    for sign in signs:
        assert sign.sign_language == "ISL"
        assert sign.media_status == "pending"
        assert sign.media_url is None
        assert sign.recognition_supported is False
        assert sign.attributes_verified is False
        assert sign.hands == "either"
        assert sign.source_url == url
        assert sign.source_name == ("ISLRTC ISL Dictionary" if url else None)
        assert sign.label_en


def test_dictionary_url_comes_from_the_research_files(research_dir):
    recorded = {
        r["id"]: r["url"]
        for name in ("datasets.json", "references.json")
        for r in load_research(name)
    }
    expected = recorded.get("ds-islrtc-dictionary") or recorded.get("ref-islrtc-home")
    assert find_dictionary_url(research_dir) == expected


def test_lessons_reference_existing_signs_in_order(seeded):
    lessons = repo.list_lessons(seeded)
    assert lessons
    sign_ids = set(seeded.scalars(select(Sign.id)))
    covered = set()
    for lesson in lessons:
        assert lesson.sign_ids, lesson.id
        assert set(lesson.sign_ids) <= sign_ids
        positions = [link.position for link in lesson.sign_links]
        assert positions == list(range(len(positions)))
        covered |= set(lesson.sign_ids)
    assert covered == sign_ids  # every seeded sign belongs to a lesson


@pytest.mark.parametrize(
    ("file_name", "model"),
    [
        ("datasets.json", Dataset),
        ("references.json", Reference),
        ("published-benchmarks.json", PublishedBenchmark),
        ("roadmap.json", RoadmapItem),
        ("rtslr-experiments.json", Experiment),
    ],
)
def test_research_tables_mirror_the_json_files(seeded, file_name, model):
    recorded = load_research(file_name)
    rows = seeded.scalars(select(model).order_by(model.position)).all()
    assert [row.to_record() for row in rows] == recorded


def test_experiments_stay_empty_while_the_file_is_empty(seeded):
    if load_research("rtslr-experiments.json") != []:
        pytest.skip("an experiment has been recorded")
    assert repo.list_experiments(seeded) == []


def _copy_research(research_dir, tmp_path):
    target = tmp_path / "research-data"
    shutil.copytree(research_dir, target)
    return target


def _rewrite(path, transform):
    data = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps(transform(data), ensure_ascii=False), encoding="utf-8")


def test_reseed_follows_changes_in_the_research_files(db, research_dir, tmp_path):
    target = _copy_research(research_dir, tmp_path)
    seed(db, research_dir=target)
    before = db.scalars(select(RoadmapItem)).all()
    removed_id = before[-1].id

    def change(items):
        items = items[:-1]
        items[0]["title"] = "Changed title"
        items[0]["newField"] = {"kept": True}
        return items

    _rewrite(target / "roadmap.json", change)
    seed(db, research_dir=target)
    db.expire_all()

    assert db.get(RoadmapItem, removed_id) is None
    first = repo.list_roadmap(db)[0]
    assert first.title == "Changed title"
    assert first.to_record()["newField"] == {"kept": True}
    assert len(repo.list_roadmap(db)) == len(before) - 1


def test_seed_without_dictionary_record_leaves_source_null(db, research_dir, tmp_path):
    target = _copy_research(research_dir, tmp_path)
    _rewrite(
        target / "datasets.json",
        lambda items: [i for i in items if i["id"] != "ds-islrtc-dictionary"],
    )
    _rewrite(
        target / "published-benchmarks.json",
        lambda items: [i for i in items if i["referenceId"] != "ref-islrtc-home"],
    )
    _rewrite(
        target / "references.json",
        lambda items: [i for i in items if i["id"] != "ref-islrtc-home"],
    )
    seed(db, research_dir=target)
    signs = db.scalars(select(Sign)).all()
    assert signs
    assert all(s.source_name is None and s.source_url is None for s in signs)


def test_missing_research_directory_still_seeds_content(db, tmp_path):
    counts = seed(db, research_dir=tmp_path / "does-not-exist")
    assert counts["model_versions"] == 3
    assert repo.list_datasets(db) == []
    assert db.scalars(select(Category)).all()


def test_benchmark_with_unknown_reference_is_rejected(db, research_dir, tmp_path):
    target = _copy_research(research_dir, tmp_path)

    def change(items):
        items[0]["referenceId"] = "ref-does-not-exist"
        return items

    _rewrite(target / "published-benchmarks.json", change)
    with pytest.raises(SeedError, match="ref-does-not-exist"):
        seed(db, research_dir=target)
    # Nothing was committed.
    assert db.scalars(select(ModelVersion)).all() == []


def test_reseed_keeps_a_sign_that_was_verified_later(seeded):
    sign = seeded.scalars(select(Sign)).first()
    sign.media_status = "verified"
    sign.media_url = "https://example.org/media/sign.mp4"
    sign.source_name = "Example verified source"
    sign.source_url = "https://example.org/source"
    seeded.commit()
    seed(seeded)
    seeded.expire_all()
    again = seeded.get(Sign, sign.id)
    assert again.media_status == "verified"
    assert again.media_url == "https://example.org/media/sign.mp4"
    assert again.source_name == "Example verified source"


def test_reseed_does_not_duplicate_lesson_links(seeded):
    before = len(seeded.scalars(select(LessonSign)).all())
    lessons_before = len(seeded.scalars(select(Lesson)).all())
    seed(seeded)
    assert len(seeded.scalars(select(LessonSign)).all()) == before
    assert len(seeded.scalars(select(Lesson)).all()) == lessons_before
