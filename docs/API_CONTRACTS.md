# RTSLR API contract (v1)

Owner: Agent 00. Implemented by Agent 04 (API) and Agent 08 (data layer).

Base path `/api/v1`. JSON only. Errors use `{ "error": { "code": string, "message": string, "details"?: any } }`.
The frontend works without the backend for everything except feedback submission; the API exists so
a mobile client and future accounts can share the same data. No camera frames or landmarks are ever sent.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ status: "ok", version, database: "ok" | "error" }` |
| GET | `/models` | List model versions (`ModelOut[]`) |
| GET | `/models/{model_id}` | One model, 404 if unknown |
| GET | `/vocabulary` | Query: `category?`, `q?`, `sign_language?` (default `ISL`), `limit` (1–200, default 50), `offset` → `{ items: SignOut[], total }` |
| GET | `/vocabulary/{sign_id}` | One sign |
| GET | `/learning/categories` | `CategoryOut[]` |
| GET | `/learning/lessons` | Query: `category?` → `LessonOut[]` |
| GET | `/learning/lessons/{lesson_id}` | Lesson with its sign ids |
| GET | `/research/datasets` | Dataset metadata |
| GET | `/research/references` | Research references |
| GET | `/research/benchmarks` | Published benchmarks (other people's results) |
| GET | `/research/experiments` | RTSLR's own experiments (empty until one is run) |
| GET | `/research/roadmap` | Roadmap items |
| POST | `/feedback` | Consent-managed feedback, rate limited |
| DELETE | `/feedback/{feedback_id}` | Header `X-Deletion-Token`; 204, or 404 for unknown id **or** wrong token |

## Schemas (Pydantic, camelCase aliases in JSON)

- `ModelOut`: `id, version, name, signLanguage ("ISL"|"ASL"), kind, input, scoreType, validated, classCount, description, limitations[]` — same meaning as `ModelInfo` in `frontend/src/types/recognition.ts`.
- `SignOut`: `id, signLanguage, labelEn, labelHi (nullable), category, hands (1|2|"either"), motion ("static"|"dynamic"), mediaStatus ("verified"|"pending"), mediaUrl (nullable), sourceName (nullable), sourceUrl (nullable), recognitionSupported (bool)`.
- `CategoryOut`: `id, titleEn, titleHi, descriptionEn, descriptionHi, signCount`.
- `LessonOut`: `id, categoryId, titleEn, titleHi, order, signIds[]`.
- `FeedbackIn`: `consent (must be true), consentVersion (known version), kind ("recognition_issue"|"content_issue"|"general"), message (1–2000 chars), modelId?, classId?, locale? ("en"|"hi")`. No images, no landmarks, no IP address or user agent stored.
- `FeedbackOut`: `id, deletionToken` (token shown once, stored hashed).

## Data layer interface (Agent 08 provides, Agent 04 calls)

Module `backend/app/db/repositories.py`, all functions take a SQLAlchemy `Session` first:

```
list_models(db) -> list[ModelVersion]
get_model(db, model_id) -> ModelVersion | None
search_signs(db, *, sign_language, category=None, q=None, limit=50, offset=0) -> tuple[list[Sign], int]
get_sign(db, sign_id) -> Sign | None
list_categories(db) -> list[Category]
list_lessons(db, category_id=None) -> list[Lesson]
get_lesson(db, lesson_id) -> Lesson | None
list_datasets(db) / list_references(db) / list_benchmarks(db) / list_experiments(db) / list_roadmap(db)
create_feedback(db, *, kind, message, consent_version, model_id, class_id, locale) -> tuple[Feedback, str]  # str = plain deletion token
delete_feedback(db, feedback_id, token) -> bool
```

`backend/app/db/session.py` exposes `get_db()` (FastAPI dependency), `engine`, `init_db()`.
`backend/app/db/seed.py` exposes `seed(db)` — idempotent; loads `research/data/*.json` and the seed
content in `backend/app/db/seed_data/`.

Database: SQLite file by default (`DATABASE_URL=sqlite:///./rtslr.db`), PostgreSQL through the same URL setting.

## Rules

- Research data is served exactly as recorded; `/research/experiments` stays empty until a real run exists.
- `recognitionSupported` is true only for signs covered by a shipped model. Today no ISL sign is.
- `mediaStatus` is `pending` unless a verified source is recorded; never fabricate a demonstration.
