AGENT: 04 — Backend Architecture Engineer

ASSIGNED TASK:
Implement the FastAPI application for docs/API_CONTRACTS.md (v1) with the backend requirements of
docs/SECURITY_PRIVACY.md section 6: app factory, settings, error envelope, rate limiting, security
middleware, Pydantic schemas, routers, feedback service, API tests, README, .env.example,
requirements.txt, Dockerfile.

OWNED FILES:
- backend/app/main.py
- backend/app/core/** (config.py, errors.py, rate_limit.py, security.py)
- backend/app/schemas/** (common.py, content.py, research.py, feedback.py)
- backend/app/api/** (deps.py, health.py, models.py, vocabulary.py, learning.py, research.py, feedback.py)
- backend/app/services/** (feedback.py)
- backend/tests/api/**
- backend/README.md, backend/.env.example, backend/requirements.txt, backend/Dockerfile
- docs/agent-reports/AGENT_04.md

DEPENDENCIES:
- Agent 08 data layer: app.db.session (get_db, engine, SessionLocal, init_db, create_db_engine),
  app.db.repositories, app.db.seed.seed, app.db.models. Their real modules were present; the API
  tests run against them (no fake repository was needed).
- research/data/*.json (read by the seed; the research tests compare API output with these files).
- No new packages. python-dotenv (already installed with pydantic-settings) is imported directly.

IMPLEMENTED FEATURES:
- Endpoints under /api/v1: GET /health, /models, /models/{model_id}, /vocabulary,
  /vocabulary/{sign_id}, /learning/categories, /learning/lessons, /learning/lessons/{lesson_id},
  /research/datasets, /research/references, /research/benchmarks, /research/experiments,
  /research/roadmap; POST /feedback (201); DELETE /feedback/{feedback_id} (204/404).
- No recognition, upload or feedback-read endpoint exists; a test asserts the exact path set.
- Settings (pydantic-settings): ENVIRONMENT (alias APP_ENV), DATABASE_URL, CORS_ALLOW_ORIGINS,
  RATE_LIMIT_FEEDBACK_PER_MINUTE, RATE_LIMIT_FEEDBACK_PER_DAY, RATE_LIMIT_READ_PER_MINUTE,
  TRUSTED_PROXY_IPS, AUTO_CREATE_TABLES, SEED_ON_STARTUP, CONSENT_VERSIONS,
  FEEDBACK_RETENTION_DAYS, MAX_BODY_BYTES, ENABLE_DOCS, LOG_LEVEL. Production refuses to start with
  empty or "*" CORS or a CHANGE_ME database URL. allow_credentials=False.
- Error envelope {error:{code,message,details?}} for HTTPException, validation errors (field +
  problem, no submitted values) and unhandled exceptions (generic 500, cause only in the log).
  X-Request-ID header on every response.
- In-memory sliding-window rate limiter (per process, keyed by a salted hash of the client
  address, never persisted): feedback per minute and per day (POST and DELETE share it), read
  endpoints per minute; 429 with Retry-After. X-Forwarded-For honoured only for TRUSTED_PROXY_IPS.
- Security middleware: response headers (nosniff, DENY, no-referrer, no-store, deny-all CSP,
  Permissions-Policy, HSTS in production); 413 for bodies above MAX_BODY_BYTES (declared or
  chunked); 415 for non-JSON POST bodies.
- Feedback: consent must be boolean true and consentVersion known, otherwise 400 and nothing is
  stored; unknown fields rejected (so no image/landmark/email field can be sent); message 1-2000
  chars with control characters stripped; deletion token returned once, stored hashed by the data
  layer; delete answers the same 404 for unknown id, malformed id, wrong token and missing token.
- Access log without client address, user agent, query string or body; uvicorn's access log is
  disabled in app.main because it prints addresses.
- Lifespan: init_db() when AUTO_CREATE_TABLES, seed() when SEED_ON_STARTUP, then
  purge_expired_feedback() (retention, BE-23, startup only).
- /docs, /redoc, /openapi.json off in production unless ENABLE_DOCS=true.

FILES CREATED OR MODIFIED:
Created (all new): backend/app/main.py; backend/app/core/{__init__,config,errors,rate_limit,security}.py;
backend/app/schemas/{__init__,common,content,research,feedback}.py;
backend/app/api/{__init__,deps,health,models,vocabulary,learning,research,feedback}.py;
backend/app/services/{__init__,feedback}.py;
backend/tests/api/{__init__,conftest,test_read_endpoints,test_feedback,test_rate_limit,test_platform}.py;
backend/README.md; backend/.env.example; backend/requirements.txt; backend/Dockerfile;
docs/agent-reports/AGENT_04.md. No file outside the owned paths was edited.

TESTS RUN:
1. backend\.venv\Scripts\python.exe -m pytest backend/tests/api -q   (from the project root)
2. .venv\Scripts\python.exe -m pytest tests/api -q                    (from backend/)
3. backend\.venv\Scripts\python.exe -m pytest backend/tests -q        (whole backend suite, to check
   that the API tests and Agent 08's tests/db coexist in one session)
4. Manual smoke run: uvicorn app.main:app --port 8010 from backend/ with DATABASE_URL pointing at a
   temporary SQLite file outside the repository, then curl.

TEST RESULTS:
1. "104 passed, 1 warning in 4.88s"
2. "104 passed, 1 warning in 4.08s"
3. "162 passed, 1 warning in 19.41s" (104 API tests + 58 data-layer tests as they stood at that moment)
   The warning in all three: StarletteDeprecationWarning "Using `httpx` with `starlette.testclient`
   is deprecated; install `httpx2` instead." (raised by the installed FastAPI/Starlette test client).
4. Smoke run (real output, shortened where marked):
   - GET /api/v1/health -> HTTP 200 {"status":"ok","version":"1.0.0","database":"ok"} with headers
     x-request-id, x-content-type-options: nosniff, x-frame-options: DENY, referrer-policy:
     no-referrer, cache-control: no-store, content-security-policy: default-src 'none'; ...
   - GET /api/v1/models -> HTTP 200, JSON array of 3 seeded models starting with
     {"id":"legacy-asl-prototype",...,"signLanguage":"ASL","kind":"legacy_asl_prototype",...,
     "validated":false,"classCount":26,...} (output truncated at 900 characters when captured)
   - GET /api/v1/research/experiments -> HTTP 200 []
   - GET /api/v1/vocabulary?limit=1 -> {"items":[{"id":"isl-alphabet-a",...,"mediaStatus":"pending",
     "mediaUrl":null,...,"recognitionSupported":false}],"total":104}
   - POST /api/v1/feedback without consent -> HTTP 400 {"error":{"code":"consent_required",...}}
   - GET /api/v1/recognize -> HTTP 404 {"error":{"code":"not_found","message":"Not Found"}}
   - Server log: one line per request (method, path, status, duration, request id), no addresses.
   The server was stopped afterwards (port 8010 confirmed free) and the temporary database removed;
   no *.db file exists in the repository.
Not run: the Dockerfile (not built), PostgreSQL (no driver installed), any multi-worker setup.

KNOWN LIMITATIONS:
- Rate limiting is per process and in memory. More than one worker/instance multiplies the
  effective limit; a shared store (Redis) is described but not implemented.
- The retention purge runs at startup only; there is no daily job.
- modelId/classId on feedback are validated for shape and length only, not against the models
  table (BE-03 not met for these two fields): the frontend's legacy model id
  ("rtslr-legacy-asl-rules" in frontend/src/features/recognition/models/legacyAsl.ts) differs from
  the seeded id ("legacy-asl-prototype"), and user-trained classes exist only in the browser.
- BE-12 asks for request_id inside the error body; the fixed contract defines only
  code/message/details, so the id is returned in the X-Request-ID header instead.
- A refused CORS preflight gets Starlette's plain-text 400, not the JSON envelope.
- BE-25 (operator export with ADMIN_TOKEN) and BE-20's optional landmark consent are not
  implemented: no such endpoints or fields exist in v1.
- app.db.session reads DATABASE_URL from the process environment at import. app.main loads .env
  first so that .env works for the server; the Settings.database_url field is validated (production
  placeholder guard) but the engine is built by the data layer, not from Settings.

INTEGRATION NOTES:
- Deviations from / additions to API_CONTRACTS.md:
  1. POST /feedback returns 201 (the contract does not name a status).
  2. Missing/false consent and missing/unknown consentVersion return 400 (codes consent_required,
     unknown_consent_version) as SECURITY_PRIVACY.md BE-20 requires; a non-boolean consent returns 422.
  3. Extra status codes not listed in the contract: 413, 415, 429 (all with the envelope).
  4. GET /vocabulary and GET /learning/lessons reject unknown query parameters with 422; offset is
     capped at 1,000,000.
  5. Research records carry exactly the keys of research/data/*.json (already camelCase there).
  Everything else follows the contract; limit is 1-200 as the contract says (not BE-02's 100).
- Frontend: base URL env is NEXT_PUBLIC_API_BASE_URL (origin, e.g. http://localhost:8000); paths are
  under /api/v1. Send Content-Type: application/json on POST. Keep (id, deletionToken) from the 201
  response; send the token in X-Deletion-Token on DELETE. Read error.code; on 429 honour
  Retry-After. X-Request-ID and Retry-After are exposed to browser code through CORS. The frontend
  origin must be in CORS_ALLOW_ORIGINS (default http://localhost:3000). consentVersion accepted by
  default is "1".
- Model id mismatch (see limitations): the frontend and the seed should agree on model ids if
  /models is to be joined with client-side models. Owners: frontend recognition agent / Agent 08.
- Agent 08: Alembic and `python -m app.db.seed` do not load .env (only app.main does). Root
  .gitignore covers *.db and .env but not *.sqlite/*.sqlite3 or .env.* (BE-14) — owner of the root
  .gitignore to decide.
- Run the server with one worker and --no-access-log in production (see backend/README.md).

STATUS: TESTED
