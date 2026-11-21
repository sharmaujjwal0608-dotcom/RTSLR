from __future__ import annotations

import hashlib
import logging
import uuid

import pytest
from sqlalchemy import func, inspect, select

from app.db.models import Feedback

from .conftest import API, assert_error, valid_feedback

URL = f"{API}/feedback"


def _count(db) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(Feedback)) or 0


# ----------------------------------------------------------------------------- create


def test_create_feedback_happy_path(client, db):
    before = _count(db)
    body = valid_feedback(
        kind="recognition_issue",
        message="Letter B was shown as D.",
        modelId="rtslr-legacy-asl-rules",
        classId="B",
        locale="hi",
    )
    r = client.post(URL, json=body)
    assert r.status_code == 201, r.text
    out = r.json()
    assert set(out) == {"id", "deletionToken"}
    feedback_id = uuid.UUID(out["id"])
    token = out["deletionToken"]
    assert len(token) >= 32

    assert _count(db) == before + 1
    row = db.get(Feedback, feedback_id)
    assert row.kind == "recognition_issue"
    assert row.message == "Letter B was shown as D."
    assert row.consent_version == "1"
    assert row.model_id == "rtslr-legacy-asl-rules"
    assert row.class_id == "B"
    assert row.locale == "hi"
    # The token is stored hashed, never in clear.
    assert row.deletion_token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in (row.deletion_token_hash, row.message)


def test_feedback_table_has_no_column_for_sender_data(bound_db):
    columns = {c["name"] for c in inspect(bound_db).get_columns("feedback")}
    for forbidden in ("ip", "ip_address", "user_agent", "image", "frame", "landmarks", "email"):
        assert forbidden not in columns
    assert not any("ip" == c or "agent" in c or "landmark" in c for c in columns)


def test_minimal_body_and_message_bounds(client):
    assert client.post(URL, json=valid_feedback(message="x")).status_code == 201
    assert client.post(URL, json=valid_feedback(message="m" * 2000)).status_code == 201
    assert client.post(URL, json=valid_feedback(message="हिंदी में सुझाव")).status_code == 201


def test_control_characters_are_stripped_from_the_message(client, db):
    r = client.post(URL, json=valid_feedback(message="line one\nline\ttwo\x00\x07\x1b[31m"))
    assert r.status_code == 201
    row = db.get(Feedback, uuid.UUID(r.json()["id"]))
    assert row.message == "line one\nline\ttwo[31m"


# ----------------------------------------------------------------------------- consent


def _without(key: str) -> dict:
    body = valid_feedback()
    del body[key]
    return body


@pytest.mark.parametrize(
    ("body", "code"),
    [
        (_without("consent"), "consent_required"),
        (valid_feedback(consent=False), "consent_required"),
        (_without("consentVersion"), "unknown_consent_version"),
        (valid_feedback(consentVersion="999"), "unknown_consent_version"),
        (valid_feedback(consentVersion=""), "unknown_consent_version"),
    ],
)
def test_feedback_without_valid_consent_is_refused_and_not_stored(client, db, body, code):
    before = _count(db)
    assert_error(client.post(URL, json=body), 400, code)
    assert _count(db) == before


@pytest.mark.parametrize("consent", ["true", 1, "yes", None, [True]])
def test_consent_must_be_a_real_boolean(client, db, consent):
    before = _count(db)
    assert_error(client.post(URL, json=valid_feedback(consent=consent)), 422, "validation_error")
    assert _count(db) == before


def test_configured_consent_versions_are_accepted(client_factory):
    client = client_factory(consent_versions=["1", "2026-11"])
    assert client.post(URL, json=valid_feedback(consentVersion="2026-11")).status_code == 201
    assert client.post(URL, json=valid_feedback(consentVersion="1")).status_code == 201
    assert_error(
        client.post(URL, json=valid_feedback(consentVersion="2")), 400, "unknown_consent_version"
    )


# ----------------------------------------------------------------------------- validation


@pytest.mark.parametrize(
    ("body", "field"),
    [
        (valid_feedback(message="m" * 2001), "body.message"),
        (valid_feedback(message=""), "body.message"),
        (valid_feedback(message="   \n\t "), "body.message"),
        (valid_feedback(message=12345), "body.message"),
        (_without("message"), "body.message"),
        (valid_feedback(kind="praise"), "body.kind"),
        (_without("kind"), "body.kind"),
        (valid_feedback(locale="fr"), "body.locale"),
        (valid_feedback(modelId="m" * 97), "body.modelId"),
        (valid_feedback(modelId="../../etc/passwd"), "body.modelId"),
        (valid_feedback(classId="<script>"), "body.classId"),
        (valid_feedback(consentVersion="v" * 33), "body.consentVersion"),
        # Unknown fields are rejected; in particular nothing image- or landmark-like gets in.
        (valid_feedback(landmarks=[[0.1, 0.2, 0.3]]), "body.landmarks"),
        (valid_feedback(image="data:image/png;base64,AAAA"), "body.image"),
        (valid_feedback(email="someone@example.org"), "body.email"),
        (valid_feedback(userAgent="x"), "body.userAgent"),
        (valid_feedback(consent_version="1"), "body.consent_version"),
    ],
)
def test_feedback_validation_failures(client, db, body, field):
    before = _count(db)
    error = assert_error(client.post(URL, json=body), 422, "validation_error")
    assert field in {d["field"] for d in error["details"]}
    assert _count(db) == before


def test_validation_errors_do_not_echo_submitted_values(client):
    secret = "SECRET-VALUE-" + "z" * 2000
    r = client.post(URL, json=valid_feedback(message=secret, kind="SECRET-KIND"))
    assert_error(r, 422, "validation_error")
    assert "SECRET" not in r.text


@pytest.mark.parametrize("payload", ["[]", '"text"', "{not json", "null", ""])
def test_malformed_json_bodies(client, payload):
    r = client.post(URL, content=payload, headers={"Content-Type": "application/json"})
    assert_error(r, 422, "validation_error")


@pytest.mark.parametrize(
    "content_type",
    ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", None],
)
def test_only_json_bodies_are_accepted(client, db, content_type):
    before = _count(db)
    headers = {"Content-Type": content_type} if content_type else {}
    r = client.post(URL, content=b'{"consent": true}', headers=headers)
    assert_error(r, 415, "unsupported_media_type")
    assert _count(db) == before


def test_oversized_body_is_rejected_by_content_length(client, db):
    before = _count(db)
    r = client.post(URL, json=valid_feedback(message="m" * 70_000))
    assert_error(r, 413, "payload_too_large")
    assert _count(db) == before


def test_oversized_chunked_body_is_rejected_while_streaming(client, db):
    before = _count(db)

    def chunks():
        yield b'{"consent": true, "consentVersion": "1", "kind": "general", "message": "'
        for _ in range(80):
            yield b"m" * 1024
        yield b'"}'

    r = client.post(URL, content=chunks(), headers={"Content-Type": "application/json"})
    assert "content-length" not in r.request.headers
    assert_error(r, 413, "payload_too_large")
    assert _count(db) == before


# ----------------------------------------------------------------------------- delete


def _create(client) -> tuple[str, str]:
    out = client.post(URL, json=valid_feedback()).json()
    return out["id"], out["deletionToken"]


def test_delete_with_the_right_token(client, db):
    feedback_id, token = _create(client)
    before = _count(db)
    r = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": token})
    assert r.status_code == 204
    assert r.content == b""
    assert _count(db) == before - 1
    assert db.get(Feedback, uuid.UUID(feedback_id)) is None

    # A second attempt finds nothing.
    again = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": token})
    assert_error(again, 404, "not_found")


def test_wrong_token_and_unknown_id_are_indistinguishable(client, db):
    feedback_id, token = _create(client)
    before = _count(db)

    wrong = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": "not-the-token"})
    unknown = client.delete(f"{URL}/{uuid.uuid4()}", headers={"X-Deletion-Token": token})
    missing = client.delete(f"{URL}/{feedback_id}")
    empty = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": ""})
    malformed = client.delete(f"{URL}/not-a-uuid", headers={"X-Deletion-Token": token})
    too_long = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": "t" * 300})

    for response in (wrong, unknown, missing, empty, malformed, too_long):
        assert_error(response, 404, "not_found")
        assert response.json() == wrong.json()

    assert _count(db) == before
    assert db.get(Feedback, uuid.UUID(feedback_id)) is not None

    # The real token still works afterwards.
    ok = client.delete(f"{URL}/{feedback_id}", headers={"X-Deletion-Token": token})
    assert ok.status_code == 204


def test_a_token_only_deletes_its_own_feedback(client, db):
    first_id, first_token = _create(client)
    second_id, _ = _create(client)
    r = client.delete(f"{URL}/{second_id}", headers={"X-Deletion-Token": first_token})
    assert_error(r, 404, "not_found")
    assert db.get(Feedback, uuid.UUID(second_id)) is not None


def test_feedback_cannot_be_listed_or_read(client):
    feedback_id, _ = _create(client)
    assert_error(client.get(URL), 405, "method_not_allowed")
    assert_error(client.get(f"{URL}/{feedback_id}"), 405, "method_not_allowed")


# ----------------------------------------------------------------------------- logging


def test_logs_hold_no_message_token_address_or_user_agent(client):
    records: list[logging.LogRecord] = []

    class Collect(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = Collect(level=logging.DEBUG)
    app_logger = logging.getLogger("rtslr")
    app_logger.addHandler(handler)
    try:
        r = client.post(
            URL,
            json=valid_feedback(message="PRIVATE-FEEDBACK-TEXT"),
            headers={"User-Agent": "PRIVATE-AGENT/1.0"},
        )
        assert r.status_code == 201
        token = r.json()["deletionToken"]
        client.delete(f"{URL}/{r.json()['id']}", headers={"X-Deletion-Token": token})
    finally:
        app_logger.removeHandler(handler)

    text = "\n".join(record.getMessage() for record in records)
    assert "POST /api/v1/feedback 201" in text  # the access log is there
    assert r.headers["X-Request-ID"] in text
    for private in ("PRIVATE-FEEDBACK-TEXT", "PRIVATE-AGENT", token, "testclient"):
        assert private not in text
