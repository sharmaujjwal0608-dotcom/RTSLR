from __future__ import annotations

import json
from pathlib import Path

import pytest

from .conftest import API, assert_error

RESEARCH_DATA = Path(__file__).resolve().parents[3] / "research" / "data"

MODEL_KEYS = {
    "id", "version", "name", "signLanguage", "kind", "input", "scoreType",
    "validated", "classCount", "description", "limitations",
}
SIGN_KEYS = {
    "id", "signLanguage", "labelEn", "labelHi", "category", "hands", "motion",
    "mediaStatus", "mediaUrl", "sourceName", "sourceUrl", "recognitionSupported",
}
CATEGORY_KEYS = {"id", "titleEn", "titleHi", "descriptionEn", "descriptionHi", "signCount"}
LESSON_KEYS = {"id", "categoryId", "titleEn", "titleHi", "order", "signIds"}


# ----------------------------------------------------------------------------- health


def test_health(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "1.0.0", "database": "ok"}


def test_health_reports_database_error_without_details(client_factory, empty_engine):
    # The app is bound to a database, then the engine is replaced by one whose file cannot open.
    from sqlalchemy.orm import sessionmaker

    from app.db import session as db_session

    broken = db_session.create_db_engine("sqlite:///no-such-directory-rtslr/x/y/z.db")
    client = client_factory()
    db_session.SessionLocal = sessionmaker(bind=broken)  # restored by empty_engine's monkeypatch
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "1.0.0", "database": "error"}
    broken.dispose()


# ----------------------------------------------------------------------------- models


def test_list_models(client):
    r = client.get(f"{API}/models")
    assert r.status_code == 200
    models = r.json()
    assert isinstance(models, list) and models
    for m in models:
        assert set(m) == MODEL_KEYS
        assert m["signLanguage"] in ("ISL", "ASL")
        assert isinstance(m["limitations"], list)
    # No validated ISL model exists; the API must not claim one.
    assert not any(m["validated"] for m in models)


def test_get_model_and_404(client):
    first = client.get(f"{API}/models").json()[0]
    r = client.get(f"{API}/models/{first['id']}")
    assert r.status_code == 200
    assert r.json() == first

    assert_error(client.get(f"{API}/models/no-such-model"), 404, "not_found")


def test_over_long_path_id_is_rejected(client):
    assert_error(client.get(f"{API}/models/{'m' * 97}"), 422, "validation_error")


# ----------------------------------------------------------------------------- vocabulary


def test_vocabulary_default_page(client):
    r = client.get(f"{API}/vocabulary")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"items", "total"}
    assert body["total"] >= len(body["items"]) > 0
    assert len(body["items"]) <= 50
    for sign in body["items"]:
        assert set(sign) == SIGN_KEYS
        assert sign["signLanguage"] == "ISL"  # default sign_language
        assert sign["hands"] in (1, 2, "either")
        assert sign["motion"] in ("static", "dynamic")
        assert sign["mediaStatus"] in ("verified", "pending")
        if sign["mediaStatus"] == "pending":
            assert sign["mediaUrl"] is None
        # No shipped model covers any ISL sign today.
        assert sign["recognitionSupported"] is False


def test_vocabulary_pagination(client):
    total = client.get(f"{API}/vocabulary", params={"limit": 1}).json()["total"]
    assert total >= 3

    page1 = client.get(f"{API}/vocabulary", params={"limit": 2, "offset": 0}).json()
    page2 = client.get(f"{API}/vocabulary", params={"limit": 2, "offset": 2}).json()
    assert len(page1["items"]) == 2
    assert page1["total"] == page2["total"] == total
    assert {s["id"] for s in page1["items"]}.isdisjoint({s["id"] for s in page2["items"]})

    beyond = client.get(f"{API}/vocabulary", params={"offset": total + 10}).json()
    assert beyond == {"items": [], "total": total}

    assert client.get(f"{API}/vocabulary", params={"limit": 200}).status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 201},
        {"limit": -1},
        {"limit": "many"},
        {"offset": -1},
        {"offset": 1_000_001},
        {"sign_language": "BSL"},
        {"q": "x" * 65},
        {"q": ""},
        {"category": "c" * 97},
        {"unknown_param": "1"},
    ],
)
def test_vocabulary_rejects_bad_query(client, params):
    error = assert_error(client.get(f"{API}/vocabulary", params=params), 422, "validation_error")
    assert isinstance(error["details"], list) and error["details"]
    assert set(error["details"][0]) == {"field", "problem", "type"}


def test_vocabulary_filters(client):
    categories = client.get(f"{API}/learning/categories").json()
    category = next(c for c in categories if c["signCount"] > 0)
    r = client.get(f"{API}/vocabulary", params={"category": category["id"], "limit": 200})
    body = r.json()
    assert body["total"] == category["signCount"]
    assert all(s["category"] == category["id"] for s in body["items"])

    sample = body["items"][0]
    found = client.get(f"{API}/vocabulary", params={"q": sample["labelEn"].lower()}).json()
    assert sample["id"] in {s["id"] for s in found["items"]}

    nothing = client.get(f"{API}/vocabulary", params={"q": "zzzz-no-such-sign-qqqq"}).json()
    assert nothing == {"items": [], "total": 0}

    # LIKE wildcards in the search text are literal characters, not patterns.
    assert client.get(f"{API}/vocabulary", params={"q": "%"}).json()["total"] == 0

    asl = client.get(f"{API}/vocabulary", params={"sign_language": "ASL"}).json()
    assert all(s["signLanguage"] == "ASL" for s in asl["items"])


def test_get_sign_and_404(client):
    sign = client.get(f"{API}/vocabulary", params={"limit": 1}).json()["items"][0]
    r = client.get(f"{API}/vocabulary/{sign['id']}")
    assert r.status_code == 200
    assert r.json() == sign

    assert_error(client.get(f"{API}/vocabulary/no-such-sign"), 404, "not_found")


# ----------------------------------------------------------------------------- learning


def test_categories(client):
    r = client.get(f"{API}/learning/categories")
    assert r.status_code == 200
    categories = r.json()
    assert categories
    for c in categories:
        assert set(c) == CATEGORY_KEYS
        assert isinstance(c["signCount"], int) and c["signCount"] >= 0


def test_lessons_and_category_filter(client):
    r = client.get(f"{API}/learning/lessons")
    assert r.status_code == 200
    lessons = r.json()
    assert lessons
    for lesson in lessons:
        assert set(lesson) == LESSON_KEYS
        assert isinstance(lesson["signIds"], list)

    category_id = lessons[0]["categoryId"]
    filtered = client.get(f"{API}/learning/lessons", params={"category": category_id}).json()
    assert filtered and all(x["categoryId"] == category_id for x in filtered)
    assert filtered == [x for x in lessons if x["categoryId"] == category_id]

    assert client.get(f"{API}/learning/lessons", params={"category": "no-such"}).json() == []
    assert_error(
        client.get(f"{API}/learning/lessons", params={"bogus": "1"}), 422, "validation_error"
    )


def test_get_lesson_and_404(client):
    lesson = client.get(f"{API}/learning/lessons").json()[0]
    r = client.get(f"{API}/learning/lessons/{lesson['id']}")
    assert r.status_code == 200
    assert r.json() == lesson
    # Every sign id in a lesson resolves.
    for sign_id in lesson["signIds"][:3]:
        assert client.get(f"{API}/vocabulary/{sign_id}").status_code == 200

    assert_error(client.get(f"{API}/learning/lessons/no-such-lesson"), 404, "not_found")


# ----------------------------------------------------------------------------- research


@pytest.mark.parametrize(
    ("path", "filename"),
    [
        ("datasets", "datasets.json"),
        ("references", "references.json"),
        ("benchmarks", "published-benchmarks.json"),
        ("roadmap", "roadmap.json"),
        ("experiments", "rtslr-experiments.json"),
    ],
)
def test_research_is_served_exactly_as_recorded(client, path, filename):
    recorded = json.loads((RESEARCH_DATA / filename).read_text(encoding="utf-8"))
    r = client.get(f"{API}/research/{path}")
    assert r.status_code == 200
    assert r.json() == recorded


def test_experiments_is_an_empty_list(client):
    r = client.get(f"{API}/research/experiments")
    assert r.status_code == 200
    assert r.json() == []


# ----------------------------------------------------------------------------- surface


def test_no_recognition_or_upload_endpoint_exists(client_factory):
    client = client_factory(environment="development")
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert set(paths) == {
        f"{API}/health",
        f"{API}/models",
        f"{API}/models/{{model_id}}",
        f"{API}/vocabulary",
        f"{API}/vocabulary/{{sign_id}}",
        f"{API}/learning/categories",
        f"{API}/learning/lessons",
        f"{API}/learning/lessons/{{lesson_id}}",
        f"{API}/research/datasets",
        f"{API}/research/references",
        f"{API}/research/benchmarks",
        f"{API}/research/experiments",
        f"{API}/research/roadmap",
        f"{API}/feedback",
        f"{API}/feedback/{{feedback_id}}",
    }
    writes = {
        (method, path)
        for path, operations in paths.items()
        for method in operations
        if method in ("post", "put", "patch", "delete")
    }
    assert writes == {("post", f"{API}/feedback"), ("delete", f"{API}/feedback/{{feedback_id}}")}
    assert "multipart" not in json.dumps(spec)
    assert spec["info"]["title"] == "RTSLR API"
    assert "no recognition endpoint" in spec["info"]["description"]

    for missing in ("recognize", "recognise", "predict", "inference", "frames", "upload"):
        assert_error(client.post(f"{API}/{missing}", json={}), 404, "not_found")
