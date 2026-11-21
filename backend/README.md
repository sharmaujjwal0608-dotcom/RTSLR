# RTSLR backend

FastAPI service for the RTSLR (Real-Time Sign Language Recognition) platform for Indian Sign
Language (ISL). It serves reference data (model metadata, vocabulary, lessons, research records)
and accepts consent-managed feedback. The contract is `docs/API_CONTRACTS.md`.

## What this API does not do, on purpose

- **No recognition endpoint.** Recognition runs entirely in the browser. The API never receives
  camera frames, images, video or hand landmarks, and no endpoint accepts a file upload,
  multipart or form body.
- **No validated ISL model.** `/models` describes what the client can run and marks each entry
  honestly; `validated` is `false` for all of them today. `/research/benchmarks` lists results
  published by other groups. `/research/experiments` lists RTSLR's own runs and is an empty
  list until a real run is recorded.
- **No accounts or authentication in v1.** Every endpoint is public. The only write endpoints
  are `POST /feedback` (explicit consent, rate limited) and `DELETE /feedback/{id}` (needs the
  deletion token). There is no endpoint that lists, reads or exports feedback.
- Not suitable for medical, legal, emergency or other high-stakes communication.

## Setup

Python 3.12. The project venv already exists at `backend/.venv` with the versions pinned in
`requirements.txt`. To recreate it elsewhere:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Optional configuration: copy `.env.example` to `.env`. Without it the defaults below apply.

## Run

From `backend/`:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

(From inside `backend/` the interpreter path is `.venv\Scripts\python.exe`.)

On startup the app creates missing tables (`AUTO_CREATE_TABLES`), loads the seed content
(`SEED_ON_STARTUP`, idempotent) and deletes feedback past its retention date.

- API base: `http://localhost:8000/api/v1`
- Interactive docs: `http://localhost:8000/docs` (off in production unless `ENABLE_DOCS=true`)

The frontend reads the API origin from `NEXT_PUBLIC_API_BASE_URL` (for example
`http://localhost:8000`) and appends `/api/v1`. That origin must be listed in
`CORS_ALLOW_ORIGINS` on this side.

## Endpoints

All under `/api/v1`. JSON only.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, version, database }`; always 200, `database` is `ok` or `error` |
| GET | `/models` | `ModelOut[]` |
| GET | `/models/{model_id}` | 404 if unknown |
| GET | `/vocabulary` | `category?`, `q?`, `sign_language?` (default `ISL`), `limit` 1-200 (default 50), `offset` >= 0 → `{ items, total }`. Unknown query parameters give 422 |
| GET | `/vocabulary/{sign_id}` | 404 if unknown |
| GET | `/learning/categories` | `CategoryOut[]` |
| GET | `/learning/lessons` | `category?` → `LessonOut[]` |
| GET | `/learning/lessons/{lesson_id}` | 404 if unknown |
| GET | `/research/datasets` | as recorded in `research/data/datasets.json` |
| GET | `/research/references` | as recorded in `references.json` |
| GET | `/research/benchmarks` | other people's published results (`published-benchmarks.json`) |
| GET | `/research/experiments` | RTSLR's own runs; `[]` today |
| GET | `/research/roadmap` | as recorded in `roadmap.json` |
| POST | `/feedback` | 201 `{ id, deletionToken }` |
| DELETE | `/feedback/{feedback_id}` | header `X-Deletion-Token`; 204, or 404 |

Response fields are camelCase. Query parameter names are snake_case as in the contract.

### Errors

Every non-2xx response has the same shape:

```json
{ "error": { "code": "validation_error", "message": "The request is not valid.", "details": [ { "field": "body.message", "problem": "String should have at most 2000 characters", "type": "string_too_long" } ] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `consent_required` | `consent` missing or `false` |
| 400 | `unknown_consent_version` | `consentVersion` missing or not in `CONSENT_VERSIONS` |
| 400 | `bad_request` | malformed `Content-Length` |
| 404 | `not_found` | unknown route or id; wrong, missing or mismatched deletion token |
| 405 | `method_not_allowed` | |
| 413 | `payload_too_large` | body above `MAX_BODY_BYTES` (declared or streamed) |
| 415 | `unsupported_media_type` | POST body that is not `application/json` |
| 422 | `validation_error` | `details` lists field and problem; submitted values are never echoed |
| 429 | `rate_limited` | with a `Retry-After` header (seconds) |
| 500 | `internal_error` | generic message only; the cause goes to the server log |

Every response has an `X-Request-ID` header; the same id is in the server log line.

One exception to the envelope: a CORS **preflight** from an origin, method or header that is not
allowed is answered by the CORS middleware with a plain-text 400. Browsers never show that body
to page code.

### Feedback

Request body (unknown fields are rejected):

| Field | Rule |
|---|---|
| `consent` | boolean, must be `true` |
| `consentVersion` | one of `CONSENT_VERSIONS` (default `"1"`) |
| `kind` | `recognition_issue` \| `content_issue` \| `general` |
| `message` | 1-2000 characters of plain text; control characters other than newline and tab are removed |
| `modelId`, `classId` | optional; letters, digits, `_ . : -`, at most 96 characters |
| `locale` | optional; `en` \| `hi` |

Stored: the fields above (without `consent` itself), the consent time, created/expiry times and
the SHA-256 hash of the deletion token. **Not stored and not logged:** IP address, user agent,
cookies, images, frames, landmarks, names or email addresses. The plain deletion token appears
once, in the `201` response; the client must keep `(id, deletionToken)` to delete later.

`DELETE /feedback/{id}` answers 404 identically for an unknown id, a malformed id, a wrong
token and a missing token, so it cannot be used to find out which ids exist.

## Environment variables

| Name | Default | Meaning |
|---|---|---|
| `ENVIRONMENT` (alias `APP_ENV`) | `development` | `development`, `test` or `production` |
| `DATABASE_URL` | `sqlite:///./rtslr.db` | SQLAlchemy URL. Read by `app/db/session.py` from the process environment; `app.main` loads `.env` first so a value in `.env` is honoured when the app is started through `app.main` |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000` | comma-separated exact origins |
| `RATE_LIMIT_FEEDBACK_PER_MINUTE` | `10` | per client, POST + DELETE `/feedback`; `0` disables |
| `RATE_LIMIT_FEEDBACK_PER_DAY` | `100` | same, per 24 hours |
| `RATE_LIMIT_READ_PER_MINUTE` | `120` | per client, all read endpoints except `/health` |
| `TRUSTED_PROXY_IPS` | empty | proxies whose `X-Forwarded-For` is trusted |
| `AUTO_CREATE_TABLES` | `true` | create missing tables at startup |
| `SEED_ON_STARTUP` | `true` | load seed content at startup |
| `CONSENT_VERSIONS` | `1` | comma-separated accepted consent text versions |
| `FEEDBACK_RETENTION_DAYS` | `365` | feedback expiry |
| `MAX_BODY_BYTES` | `65536` | request body limit |
| `ENABLE_DOCS` | `false` | serve `/docs` and `/openapi.json` in production |
| `LOG_LEVEL` | `info` | level of the `rtslr` logger |
| `RTSLR_RESEARCH_DATA_DIR` | repository `research/data` | where the seed reads research JSON (data layer setting) |

In production (`ENVIRONMENT=production`) the app refuses to start when `CORS_ALLOW_ORIGINS` is
empty or contains `*`, or when `DATABASE_URL` still contains `CHANGE_ME`. Credentials are never
allowed on cross-origin requests (`allow_credentials=False`); there are no cookies.

## Tests

```powershell
# from the project root
backend\.venv\Scripts\python.exe -m pytest backend/tests/api -q
# or from backend/
.venv\Scripts\python.exe -m pytest tests/api -q
```

The API tests use FastAPI's `TestClient` against a temporary SQLite file created under pytest's
temp directory; they do not touch `rtslr.db`. `tests/db` belongs to the data layer.

## Security notes

- **CORS is not access control.** It only tells browsers which sites may read responses. The
  write endpoints are protected by consent checks, strict validation, body limits and rate
  limits, and behave the same when called from curl.
- **Rate limiting is in memory and per process.** Counters are keyed by a salted hash of the
  client address (the salt is random per process); nothing is written to disk or the database.
  This is correct for a single process. With several workers or instances each one counts on
  its own, so the effective limit multiplies: either run one worker, or replace
  `SlidingWindowLimiter` in `app/core/rate_limit.py` with a shared store such as Redis (a
  sorted set per key). Redis is not installed and that path is not implemented.
- **Behind a reverse proxy** set `TRUSTED_PROXY_IPS`, otherwise all visitors share one budget.
- **Logs.** The app writes one line per request: method, path, status, duration, request id.
  No address, user agent, query string or body. `app.main` disables uvicorn's own access log
  because it prints client addresses; if a proxy in front logs addresses, keep those logs for
  14 days at most.
- **Response headers** on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, a
  deny-all `Content-Security-Policy` (not on the docs pages), `Permissions-Policy`, and
  `Strict-Transport-Security` in production.

## Using the API from a mobile client

A native app uses the same endpoints; CORS does not apply outside browsers.

1. On start, `GET /health`, then `GET /models`, `GET /learning/categories`,
   `GET /learning/lessons` and page through `GET /vocabulary?limit=200&offset=…` until `offset`
   reaches `total`. Cache the results on the device; the content changes rarely, and the app
   should keep working offline.
2. Run hand tracking and recognition **on the device**. There is nothing to send to this API:
   no frame, no landmark, no transcript.
3. Show `mediaStatus: "pending"` signs as "demonstration pending a verified source"; do not
   substitute a demonstration. Treat `recognitionSupported: false` as "cannot be recognised".
4. To send feedback, show the consent text for the current consent version, then
   `POST /feedback` with `consent: true`. Store `id` and `deletionToken` in secure device
   storage and offer "delete the feedback I sent" through `DELETE /feedback/{id}` with the
   `X-Deletion-Token` header.
5. Handle `429` by waiting `Retry-After` seconds, and read `error.code` rather than the message
   text.

## Deployment notes

- Set `ENVIRONMENT=production`, `CORS_ALLOW_ORIGINS` to the real frontend origin(s) and serve
  over HTTPS only (terminate TLS at a proxy; the API adds HSTS in production).
- Run without `--reload`, as a non-root user, with **one** worker unless the limiter has been
  moved to a shared store. Example:
  `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-access-log`
- Database: the SQLite file must live outside any served directory and be readable only by the
  service user. For PostgreSQL set `DATABASE_URL` and install a driver (none is installed in
  the project venv; that path has not been run). Prefer `alembic upgrade head` with
  `AUTO_CREATE_TABLES=false` for managed schemas; see the data layer documentation.
- The retention purge runs at startup only. A long-running deployment needs a daily job that
  calls `app.db.repositories.purge_expired_feedback` (not provided here).
- `Dockerfile` is a small non-root image definition. It has **not** been built or run.

## What accounts would add later

Not in v1. If accounts are introduced: an identity provider or password hashing with a vetted
library, short-lived tokens in the `Authorization` header (which must then be added to the CORS
allowed headers), per-user rate limits, authorisation checks on every new write endpoint, a
user table and migrations, an operator-only feedback export protected by a token compared in
constant time, and a privacy review before any personal data is stored.

## Layout

```
app/main.py            application factory, lifespan, middleware order
app/core/config.py     settings (pydantic-settings) and production guards
app/core/errors.py     error envelope, request id, access log, catch-all
app/core/rate_limit.py in-memory sliding-window limiter
app/core/security.py   security headers, body size and content-type limits
app/schemas/           Pydantic models (camelCase aliases)
app/api/               routers
app/services/          feedback rules
app/db/                data layer (models, session, repositories, seed) - separate owner
tests/api/             API tests
```
