AGENT: 08 — Database and Data Engineering Specialist

ASSIGNED TASK:
Data layer for the RTSLR backend: SQLAlchemy 2.x models, engine/session handling, the repository
functions named in docs/API_CONTRACTS.md, an idempotent seed (models, starter ISL curriculum
structure, research records read from research/data/*.json), Alembic environment with an initial
migration, feedback retention/deletion, tests, and docs/DATABASE.md.

OWNED FILES:
- backend/app/__init__.py
- backend/app/db/** (__init__.py, base.py, models.py, session.py, repositories.py, seed.py, seed_data/)
- backend/alembic.ini, backend/migrations/**
- backend/pytest.ini, backend/tests/__init__.py, backend/tests/db/**
- docs/DATABASE.md, docs/agent-reports/AGENT_08.md

DEPENDENCIES:
- docs/API_CONTRACTS.md ("Data layer interface"), docs/SECURITY_PRIVACY.md (BE-20 to BE-26),
  docs/MODEL_CONTRACTS.md and frontend/src/types/recognition.ts (ModelInfo values).
- research/data/*.json from Agent 07, read at seed time.
- Installed packages only: SQLAlchemy 2.1.9, Alembic 1.20.1, pytest. Nothing installed or upgraded.

IMPLEMENTED FEATURES:
- 11 tables: categories, signs, lessons, lesson_signs, model_versions, datasets,
  research_references, published_benchmarks, rtslr_experiments, roadmap_items, feedback.
  Slug primary keys for content, UUID for feedback. No camera/recording tables, no user tables.
- CHECK constraints for every enumerated value; a sign cannot be "verified" without media URL and
  source; a model cannot be flagged validated unless its kind is validated_isl.
- session.py: engine, SessionLocal, get_db(), init_db(), create_db_engine(url); DATABASE_URL with
  default sqlite:///./rtslr.db; SQLite foreign-key pragma; StaticPool for in-memory SQLite.
- repositories.py: every function in the contract with the contract's signatures, plus
  purge_feedback_older_than, purge_expired_feedback and hash_deletion_token.
  create_feedback takes one extra optional keyword, retention_days.
- Feedback: random token returned once, SHA-256 stored, hmac.compare_digest on every path, False for
  unknown id, malformed id and wrong token; real DELETE; expires_at per row.
- seed(db, research_dir=None): idempotent; 3 unvalidated models; 8 categories, 104 signs,
  16 lessons; research tables mirror the JSON files (unknown keys kept in an `extra` column);
  experiments empty.
- Alembic: alembic.ini, migrations/env.py, revision 0001 (initial schema), batch mode on SQLite.
- docs/DATABASE.md: schema, indexes with reasons, seed rules, retention policy, migrations, how
  accounts would be added, what is not verified.

FILES CREATED OR MODIFIED:
Created (none existed before):
- backend/app/__init__.py
- backend/app/db/__init__.py, base.py, models.py, session.py, repositories.py, seed.py
- backend/app/db/seed_data/models.json, backend/app/db/seed_data/curriculum.json
- backend/alembic.ini
- backend/migrations/env.py, backend/migrations/script.py.mako,
  backend/migrations/versions/20261121_0001_initial_schema.py
- backend/pytest.ini, backend/tests/__init__.py
- backend/tests/db/__init__.py, conftest.py, test_schema.py, test_seed.py, test_repositories.py,
  test_feedback.py, test_migrations.py
- docs/DATABASE.md, docs/agent-reports/AGENT_08.md

TESTS RUN:
1. backend\.venv\Scripts\python.exe -m pytest backend/tests/db   (from the repository root)
2. backend\.venv\Scripts\python.exe -m pytest backend/tests -q   (whole backend suite, including
   Agent 04's tests as they were at that moment, to check that the two halves fit)
3. alembic revision --autogenerate against an empty temporary SQLite file, to produce revision 0001.

TEST RESULTS:
1. Data layer:
   platform win32 -- Python 3.12.10, pytest-9.2.0
   backend\tests\db\test_feedback.py ............        (12)
   backend\tests\db\test_migrations.py .....             (5)
   backend\tests\db\test_repositories.py ............... (15)
   backend\tests\db\test_schema.py ........              (8)
   backend\tests\db\test_seed.py ..................      (18)
   58 passed in 11.47s
2. Whole backend suite at the time of the run: 162 passed, 1 warning in 19.67s (the warning is a
   Starlette deprecation notice about httpx in the test client, from Agent 04's side).
   Agent 04's files were still being edited, so this number is a snapshot.
3. Revision generated; the two application type decorators in it were replaced by plain
   sa.DateTime(timezone=True) and sa.String(8) by hand. test_migrations.py then confirms the
   migrated schema equals Base.metadata.create_all (columns, keys, indexes, check constraints) and
   that autogenerate reports no difference.

All tests ran on temporary SQLite files. PostgreSQL: not run (no server, no driver installed).

KNOWN LIMITATIONS:
- PostgreSQL is untested. Portable types and CHECK expressions were used, but nothing was executed
  against it. A driver (psycopg) would have to be installed; I did not install it.
- signs.hands and signs.motion are placeholders for all 104 seeded signs ("either" / "dynamic",
  attributes_verified = false). SignOut requires both fields and has no "unknown" value, so they
  could not be left null without breaking the API schema.
- It is not verified that each seeded word has an entry in the ISLRTC dictionary. source_url is the
  ISLRTC home page taken from Agent 07's records (their dictionary dataset record is verified:
  false). The source fields mean "look here", not "checked against this source".
- Hindi glosses and Hindi category/lesson titles were written by the agent and not reviewed by a
  Hindi-speaking ISL user.
- Model seed ids, version "1.0.0", and the simulator's signLanguage/input/classCount are not
  aligned with a frontend model registry (none existed when the seed was written).
- rtslr_experiments column names are a guess from EXPERIMENT_SPECS.md, because the file is empty;
  unknown keys are kept in `extra`.
- Sign search is a substring scan (leading-wildcard LIKE); fine for this vocabulary size, not for a
  full dictionary.
- "Constant time" covers the digest comparison only; timing of the delete path was not measured.
- SQLite does not overwrite deleted rows unless secure_delete is on or the file is vacuumed.
- The seed never deletes curriculum rows that were removed from curriculum.json.
- Purges are functions; scheduling them (startup and daily, BE-23) is outside the data layer.

INTEGRATION NOTES:
- For Agent 04 (already consistent with their code as read on 2026-11-21):
  - `from app.db.session import engine, SessionLocal, get_db, init_db, create_db_engine`
  - `from app.db import repositories`; `from app.db.seed import seed, SeedError`
  - `from app.db.models import Category, Sign, Lesson, LessonSign, ModelVersion, Dataset, Reference,
    PublishedBenchmark, Experiment, RoadmapItem, Feedback`; `from app.db.base import Base`
  - ORM attributes match the snake_case fields of the Out schemas, so
    `Model.model_validate(row, from_attributes=True)` works: `Sign.category` (category id),
    `Sign.hands` (1 | 2 | "either"), `Category.sign_count`, `Lesson.sign_ids`, `Lesson.order`,
    `ModelVersion.class_count`. Research rows: `row.to_record()` gives the JSON-file shape.
  - `app.db.session` reads DATABASE_URL from the environment at import time, not from
    app.core.config. Set the variable before the first import.
  - create_feedback / delete_feedback / purge_* commit themselves. Read functions do not commit.
  - delete_feedback accepts a UUID or a string id.
- For the orchestrator / Agents 01, 02, 06:
  - Consider adding `attributesVerified` to SignOut, or allowing null hands/motion, so the UI can
    avoid showing placeholder hands/motion as facts. Until then the learning UI should not display
    hands or motion for these signs.
  - Model ids in backend/app/db/seed_data/models.json should be made equal to the ids the frontend
    model registry uses (edit that JSON; the seed upserts by id and does not remove old ids).
  - backend/.gitignore (not mine) must ignore *.db, *.sqlite* (BE-14). The default URL creates
    rtslr.db in the working directory of whoever starts the API.
- Deployment: `alembic upgrade head`, then `python -m app.db.seed` (both from backend/).

STATUS: TESTED
