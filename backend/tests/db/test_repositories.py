from __future__ import annotations

from app.db import repositories as repo
from app.db.models import Category, Sign

from .conftest import load_research


def test_list_models_and_get_model(seeded):
    models = repo.list_models(seeded)
    assert [m.id for m in models] == [
        "legacy-asl-prototype",
        "experimental-isl-user-trained",
        "simulator",
    ]
    one = repo.get_model(seeded, "simulator")
    assert one is not None and one.kind == "simulator"
    assert repo.get_model(seeded, "validated-isl") is None


def test_search_signs_returns_page_and_total(seeded):
    items, total = repo.search_signs(seeded, sign_language="ISL", limit=5, offset=0)
    assert len(items) == 5
    assert total > 50
    # First page starts with the first category in display order.
    assert [s.label_en for s in items] == ["A", "B", "C", "D", "E"]

    page2, total2 = repo.search_signs(seeded, sign_language="ISL", limit=5, offset=5)
    assert total2 == total
    assert [s.label_en for s in page2] == ["F", "G", "H", "I", "J"]

    everything, _ = repo.search_signs(seeded, sign_language="ISL", limit=200)
    assert len(everything) == total
    assert len({s.id for s in everything}) == total

    beyond, total3 = repo.search_signs(
        seeded, sign_language="ISL", limit=10, offset=total + 5
    )
    assert beyond == [] and total3 == total


def test_search_signs_filters_by_sign_language(seeded):
    items, total = repo.search_signs(seeded, sign_language="ASL")
    assert items == [] and total == 0


def test_search_signs_filters_by_category(seeded):
    items, total = repo.search_signs(seeded, sign_language="ISL", category="numbers")
    assert total == 10 == len(items)
    assert {s.category for s in items} == {"numbers"}
    assert [s.label_en for s in items] == [str(n) for n in range(10)]

    none, zero = repo.search_signs(seeded, sign_language="ISL", category="nope")
    assert none == [] and zero == 0


def test_search_signs_is_case_insensitive_on_english(seeded):
    for query in ("hello", "HELLO", "hElLo", "  hello  "):
        items, total = repo.search_signs(seeded, sign_language="ISL", q=query)
        assert total == 1, query
        assert items[0].label_en == "Hello"

    items, total = repo.search_signs(seeded, sign_language="ISL", q="GOOD")
    labels = {s.label_en for s in items}
    assert {"Good", "Good morning", "Good night", "Goodbye"} <= labels
    assert total == len(items)


def test_search_signs_matches_hindi_labels(seeded):
    items, total = repo.search_signs(seeded, sign_language="ISL", q="नमस्ते")
    assert total == 1 and items[0].label_en == "Hello"

    items, total = repo.search_signs(seeded, sign_language="ISL", q="वार")
    assert {"Monday", "Sunday", "Family"} <= {s.label_en for s in items}


def test_search_signs_combines_category_and_query(seeded):
    items, total = repo.search_signs(
        seeded, sign_language="ISL", category="family", q="mother"
    )
    assert {s.label_en for s in items} == {"Mother", "Grandmother"}
    assert total == 2


def test_search_signs_treats_like_wildcards_literally(seeded):
    seeded.add(Category(id="misc", title_en="Misc", title_hi="विविध", sort_order=99))
    seeded.add(Sign(id="isl-misc-100", category_id="misc", label_en="100%"))
    seeded.commit()
    items, total = repo.search_signs(seeded, sign_language="ISL", q="%")
    assert total == 1 and items[0].id == "isl-misc-100"
    items, total = repo.search_signs(seeded, sign_language="ISL", q="_")
    assert total == 0 and items == []


def test_search_signs_clamps_limit_and_offset(seeded):
    items, total = repo.search_signs(seeded, sign_language="ISL", limit=0, offset=-3)
    assert len(items) == 1
    items, _ = repo.search_signs(seeded, sign_language="ISL", limit=10_000)
    assert len(items) == min(total, repo.MAX_SIGN_PAGE)


def test_get_sign(seeded):
    sign = repo.get_sign(seeded, "isl-greetings-hello")
    assert sign is not None
    assert (sign.label_en, sign.label_hi, sign.category) == ("Hello", "नमस्ते", "greetings")
    assert repo.get_sign(seeded, "isl-alphabet-a").label_hi is None
    assert repo.get_sign(seeded, "missing") is None


def test_list_categories_in_order_with_counts(seeded):
    categories = repo.list_categories(seeded)
    assert [c.id for c in categories] == [
        "alphabet",
        "numbers",
        "greetings",
        "everyday",
        "family",
        "questions",
        "time-and-days",
        "places",
    ]
    counts = {c.id: c.sign_count for c in categories}
    assert counts["alphabet"] == 26
    assert counts["numbers"] == 10
    _, total = repo.search_signs(seeded, sign_language="ISL")
    assert sum(counts.values()) == total


def test_list_lessons_and_category_filter(seeded):
    lessons = repo.list_lessons(seeded)
    assert lessons[0].id == "alphabet-a-i"
    assert [lesson.order for lesson in lessons if lesson.category_id == "alphabet"] == [0, 1, 2]

    only = repo.list_lessons(seeded, "numbers")
    assert [lesson.id for lesson in only] == ["numbers-0-4", "numbers-5-9"]
    assert only[0].sign_ids == [f"isl-numbers-{n}" for n in range(5)]
    assert repo.list_lessons(seeded, "nope") == []


def test_get_lesson(seeded):
    lesson = repo.get_lesson(seeded, "greetings-polite")
    assert lesson is not None
    assert lesson.category_id == "greetings"
    assert lesson.title_hi
    assert [s.label_en for s in lesson.signs] == ["Thank you", "Please", "Sorry"]
    assert lesson.sign_ids == [s.id for s in lesson.signs]
    assert repo.get_lesson(seeded, "missing") is None


def test_research_lists_follow_file_order(seeded):
    assert [d.id for d in repo.list_datasets(seeded)] == [
        r["id"] for r in load_research("datasets.json")
    ]
    assert [r.id for r in repo.list_references(seeded)] == [
        r["id"] for r in load_research("references.json")
    ]
    benchmarks = repo.list_benchmarks(seeded)
    assert [b.id for b in benchmarks] == [
        r["id"] for r in load_research("published-benchmarks.json")
    ]
    assert all(b.reference is not None for b in benchmarks)
    assert [i.id for i in repo.list_roadmap(seeded)] == [
        r["id"] for r in load_research("roadmap.json")
    ]
    assert [e.id for e in repo.list_experiments(seeded)] == [
        r["id"] for r in load_research("rtslr-experiments.json")
    ]


def test_research_lists_are_empty_before_seeding(db):
    assert repo.list_datasets(db) == []
    assert repo.list_references(db) == []
    assert repo.list_benchmarks(db) == []
    assert repo.list_experiments(db) == []
    assert repo.list_roadmap(db) == []
    assert repo.list_models(db) == []
    assert repo.list_categories(db) == []
    assert repo.list_lessons(db) == []
