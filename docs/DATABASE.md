# RTSLR database

Owner: Agent 08. Code: `backend/app/db/`. Migrations: `backend/migrations/`. Tests: `backend/tests/db/`.

SQLAlchemy 2.1 typed models, Alembic 1.20. SQLite by default, PostgreSQL through the same URL.

**Status of verification.** Everything below was run against SQLite only. No PostgreSQL server or
driver is installed in the project venv, so the PostgreSQL path has **not been run**. The models
use only portable types (`String`, `Text`, `Integer`, `Float`, `Boolean`, `JSON`, `Uuid`,
`DateTime(timezone=True)`) and portable `CHECK` expressions, but that is a design statement, not a
test result.

## 1. Configuration

| Setting | Read by | Default |
|---|---|---|
| `DATABASE_URL` | `app.db.session` at import time, `migrations/env.py` | `sqlite:///./rtslr.db` (relative to the working directory) |
| `FEEDBACK_RETENTION_DAYS` | `repositories.create_feedback` when `retention_days` is not passed | `365` |
| `RTSLR_RESEARCH_DATA_DIR` | `seed.seed` when `research_dir` is not passed | `<repo>/research/data` |

SQLite specifics handled in `session.create_db_engine`:

- `PRAGMA foreign_keys=ON` on every connection (SQLite ignores foreign keys otherwise).
- `check_same_thread=False`, because FastAPI runs sync dependencies in a thread pool.
- An in-memory URL (`sqlite://`) uses `StaticPool`, so all sessions see one database.

For any other backend the engine uses `pool_pre_ping=True`. A PostgreSQL URL needs a driver
(`psycopg`) that is not installed; installing one is a decision for the orchestrator.

## 2. Tables

Eleven tables. Content rows use stable string ids (slugs) as primary keys; feedback uses a UUID.

| Table | Model | Primary key | Purpose |
|---|---|---|---|
| `categories` | `Category` | `id` (slug) | Vocabulary categories of a sign language, English and Hindi title and description |
| `signs` | `Sign` | `id` (slug) | Vocabulary items |
| `lessons` | `Lesson` | `id` (slug) | Lessons inside a category |
| `lesson_signs` | `LessonSign` | `(lesson_id, sign_id)` | Ordered lesson to sign association (`position`) |
| `model_versions` | `ModelVersion` | `id` (slug) | Mirrors `ModelInfo` in `frontend/src/types/recognition.ts` |
| `datasets` | `Dataset` | `id` | `research/data/datasets.json` |
| `research_references` | `Reference` | `id` | `research/data/references.json` (`references` is a reserved word in SQL) |
| `published_benchmarks` | `PublishedBenchmark` | `id` | `research/data/published-benchmarks.json`; other people's results |
| `rtslr_experiments` | `Experiment` | `id` | `research/data/rtslr-experiments.json`; empty today |
| `roadmap_items` | `RoadmapItem` | `id` | `research/data/roadmap.json` |
| `feedback` | `Feedback` | `id` (UUID) | Consent-managed feedback |

Alembic adds its own `alembic_version` table.

### Relationships

```
categories 1 ──< signs            signs.category_id    -> categories.id  ON DELETE CASCADE
categories 1 ──< lessons          lessons.category_id  -> categories.id  ON DELETE CASCADE
lessons    1 ──< lesson_signs >── 1 signs               both ON DELETE CASCADE
research_references 1 ──< published_benchmarks          ON DELETE RESTRICT
```

`feedback.model_id` and `feedback.class_id` are plain strings without a foreign key on purpose:
recognisers run in the browser and can have ids the server has no row for (user-trained templates),
and a feedback row must not block or be changed by edits to the models table.

`roadmap_items.depends_on` is a JSON list of roadmap ids, as in the file. It is not a join table:
the roadmap is read whole and never queried by dependency.

### `signs`

| Column | Type | Notes |
|---|---|---|
| `id` | string | `"<language>-<category>-<slug>"`, for example `isl-greetings-hello` |
| `sign_language` | `ISL` \| `ASL` | |
| `category_id` | FK | Exposed to the API as the attribute `category` |
| `label_en` | string(64) | |
| `label_hi` | string(64), nullable | Hindi gloss (a translation of the word, not a description of the sign) |
| `hands` | `1` \| `2` \| `either` | Stored as text, read in Python as `1`, `2` or `"either"` |
| `motion` | `static` \| `dynamic` | |
| `attributes_verified` | bool | False while `hands` and `motion` are unsourced placeholders |
| `media_status` | `verified` \| `pending` | |
| `media_url`, `source_name`, `source_url` | nullable | |
| `recognition_supported` | bool | |
| `sort_order` | int | Order inside the category |

Constraint `ck_signs_verified_needs_source`: `media_status = 'verified'` is only accepted when
`media_url`, `source_name` and `source_url` are all recorded. The database refuses a "verified"
row without a source.

**`hands` and `motion` are unverified for every seeded sign.** `SignOut` in the API contract
requires both and has no value for "unknown", so the columns are `NOT NULL`. The seed writes the
placeholders `hands = "either"` and `motion = "dynamic"` and sets `attributes_verified = false`.
These are not facts about the signs. `attributes_verified` is not part of `SignOut` today; until it
is exposed (or the contract lets the two fields be null) the UI should not present hands or motion
as information about a sign. `"dynamic"` was chosen as the placeholder because it never suggests
that a static-frame recogniser covers the sign.

### `model_versions`

`id, version, name, sign_language, kind, input, score_type, validated, class_count, description,
limitations (JSON list), sort_order`. `CHECK` constraints restrict `kind`, `input`, `score_type` and
`sign_language` to the values in `recognition.ts`.

Constraint `ck_model_versions_validated_kind`: `validated` can be true only when
`kind = 'validated_isl'`. The legacy ASL prototype, the user-trained templates and the simulator
cannot be flagged as validated even by a hand-written `UPDATE`.

### Research tables

Each has the columns of its JSON file (camelCase keys become snake_case columns), plus:

- `position`: index of the record in the file, so lists come back in file order.
- `extra`: JSON object holding any key the file contains that has no column yet. Agent 07 can add a
  field to a record without a migration and it is still stored and served.

`row.to_record()` returns the record with the same keys as the JSON file. A test asserts that
`[row.to_record() for row in rows]` equals the parsed file for all five files.

`rtslr_experiments`: the file is `[]`, so no real record shape exists yet. The columns
(`experiment_id, title, date, commit, dataset_version, protocol, metrics, artefacts_url`) follow the
"Recording a result" rule in `research/experiments/EXPERIMENT_SPECS.md` and the JSON key names
(`experimentId`, `datasetVersion`, `artefactsUrl`, ...) are a guess at what the first record will
use. Keys that differ land in `extra` and are still returned by `to_record()`.

### `feedback`

| Column | Notes |
|---|---|
| `id` | Random UUID (version 4) |
| `kind` | `recognition_issue` \| `content_issue` \| `general` |
| `message` | Plain text, 1 to 2000 characters (`CHECK`) |
| `consent_version` | Version of the consent text the user saw |
| `consent_given_at` | UTC |
| `model_id`, `class_id` | Optional context, no foreign key |
| `locale` | `en` \| `hi` \| null |
| `deletion_token_hash` | SHA-256 hex digest of the deletion token |
| `created_at` | UTC |
| `expires_at` | `created_at` plus the retention period |

Not stored, and there is no column for them: IP address, user agent, cookies, device identifiers,
name, email, images, frames, landmarks. A test asserts the exact column set, so adding a column
fails the suite until the test and this document are changed.

Differences from the field list in `docs/SECURITY_PRIVACY.md` BE-21: the column names follow
`API_CONTRACTS.md` (`kind`, `message`, `class_id` instead of `category`, `text`, `sign_id`);
`app_version`, `landmarks` and `consent_scopes` do not exist because the v1 `FeedbackIn` has no such
fields and v1 has a single consent scope (feedback text).

Timestamps use `UTCDateTime`: values are converted to UTC when written and come back
timezone-aware on SQLite as well.

## 3. Indexes and why

Primary keys are indexed by the database. Additional indexes:

| Index | Query it serves |
|---|---|
| `ix_signs_sign_language_category_id_sort_order` | `GET /vocabulary`: filter by sign language, optionally by category, ordered inside the category |
| `ix_signs_category_id` | Loading a category's signs (`sign_count`), and the cascade when a category is deleted |
| `ix_signs_label_en` | Exact and prefix lookups by label; see the note on search below |
| `ix_categories_sign_language_sort_order` | Category list in display order |
| `ix_lessons_category_id_order` | `GET /learning/lessons?category=`, ordered |
| `ix_lesson_signs_lesson_id_position` | A lesson's signs in order |
| `ix_lesson_signs_sign_id` | Finding the lessons a sign is in; cascade when a sign is deleted |
| `ix_published_benchmarks_reference_id` | Benchmarks of one reference; the `RESTRICT` check when a reference is deleted |
| `ix_feedback_created_at` | `purge_feedback_older_than` |
| `ix_feedback_expires_at` | `purge_expired_feedback` |

**Search is a scan.** `search_signs(q=...)` uses `lower(label) LIKE '%q%'` on both labels. A
leading wildcard cannot use a B-tree index, so this reads every sign of the language. That is fine
for a vocabulary of hundreds or a few thousand rows. For a dictionary-sized table on PostgreSQL,
add a `pg_trgm` GIN index on the two label columns in a PostgreSQL-only migration. Not done here.

`lower()` in SQLite only folds ASCII letters. English labels are ASCII, and Devanagari has no
letter case, so the search behaves as specified for the two languages in use.

No index on the research tables beyond the primary key: they hold tens of rows and are always read
whole.

## 4. Seed content

`seed(db, research_dir=None)` in `backend/app/db/seed.py`. It commits once at the end; on any error
it rolls back and nothing is written. It returns row counts per table. It is idempotent: a test
seeds twice and compares every row of every table.

Run it by hand from `backend/`:

```
.venv\Scripts\python.exe -m app.db.seed
```

(creates missing tables with `init_db()` and then seeds the database in `DATABASE_URL`).

### Models (`seed_data/models.json`)

| id | kind | sign language | validated | class count |
|---|---|---|---|---|
| `legacy-asl-prototype` | `legacy_asl_prototype` | ASL | false | 26 |
| `experimental-isl-user-trained` | `experimental_isl_user_trained` | ISL | false | 0 |
| `simulator` | `simulator` | ASL | false | 0 |

There is no `validated_isl` row, and the seed raises `SeedError` if one is added to the file.

Things in this file that are **not verified against the frontend** (no frontend model registry
existed when it was written): the three `id` values, `version = "1.0.0"`, the simulator's
`signLanguage` and `input`, and the simulator's class count. 26 for the legacy prototype comes from
`docs/MODEL_CONTRACTS.md` ("ASL A–Z rules"). The user-trained model has 0 classes on the server
because its classes exist only in a user's browser. If the frontend uses other ids, change this
file; the seed upserts by id and does not remove the old rows.

### Curriculum (`seed_data/curriculum.json`)

8 categories, 104 signs, 16 lessons, all `ISL`:

Alphabet (26), Numbers (10), Greetings (8), Everyday (12), Family (12), Questions (8),
Time and days (16), Places (12).

What the seed asserts about a sign, and what it does not:

- It is a **vocabulary list**: an English label and a Hindi gloss. Letters have no Hindi label.
- There is no text describing how any sign is formed, anywhere in the database.
- Every sign has `media_status = "pending"`, `media_url = null`, `recognition_supported = false`,
  `attributes_verified = false`.
- `source_name = "ISLRTC ISL Dictionary"` and `source_url` point to where a learner can look the
  sign up. The URL is read at seed time from `research/data/datasets.json` (record
  `ds-islrtc-dictionary`), falling back to `references.json` (record `ref-islrtc-home`). Today that
  is `https://islrtc.nic.in/`. If neither record exists, both fields are null.
- **Not verified:** that each of the 104 words has an entry in the ISLRTC dictionary. Agent 07's
  dataset record is itself `verified: false` (the dictionary site could not be opened), and the URL
  is the ISLRTC home page, not a per-sign link. The source fields mean "look here", not "this sign
  was checked against this source". Roadmap item `rm-03` (inventory reviewed by a fluent signer)
  is the step that would change this.
- The Hindi glosses were written by the agent and have not been reviewed by a Hindi-speaking ISL
  user. "Tomorrow" and "Yesterday" are glossed "आने वाला कल" and "बीता हुआ कल" because Hindi uses
  "कल" for both.

Re-seeding updates labels, category and order of an existing sign. It does **not** reset
`hands`, `motion`, `attributes_verified`, `media_*` or `recognition_supported`, and it leaves the
source fields alone once a sign is `verified`, so data added later by a verification step survives.
The seed never deletes curriculum rows; a sign removed from the JSON stays in the database until it
is deleted by hand.

### Research

Read from `research/data/*.json` on every call; nothing is copied into the backend package.

- The tables **mirror** the files: records are upserted by id, and rows whose id is no longer in the
  file are deleted (benchmarks before references).
- A missing file leaves its table unchanged and logs a warning.
- A benchmark whose `referenceId` is not in `references.json` stops the seed with `SeedError`
  naming the id. Nothing is committed in that case.
- `rtslr_experiments` stays empty while the file is `[]`.

## 5. Feedback retention and deletion

Policy implemented by the data layer:

1. **Stored only with consent.** `create_feedback` is called by the API after it has checked
   `consent: true` and the consent version. The function records `consent_version` and
   `consent_given_at`.
2. **Deletion token.** `secrets.token_urlsafe(32)` (32 random bytes). The plain token is returned
   once; only `sha256(token)` is stored. The token cannot be recovered from the database.
3. **Deletion by the user.** `delete_feedback(db, feedback_id, token) -> bool` hashes the supplied
   token and compares it to the stored hash with `hmac.compare_digest`. For an unknown or malformed
   id it compares against a fixed dummy hash, so both failure paths do the same hash and
   comparison work, and both return `False`. The API maps `False` to 404 in both cases. Deletion is
   a real `DELETE`.
4. **Retention.** Each row gets `expires_at = created_at + retention` (argument `retention_days`,
   else `FEEDBACK_RETENTION_DAYS`, else 365 days).
   - `purge_expired_feedback(db, now=None) -> int` deletes rows past `expires_at`.
   - `purge_feedback_older_than(db, days) -> int` deletes rows created more than `days` days ago,
     whatever their `expires_at`. Use it when the retention period is shortened.
   Both return the number of rows removed. The data layer does not schedule them: BE-23 requires a
   purge at startup and at least daily, which is the API process's job (or a cron job calling one
   of these functions).
5. **Backups** must expire within the same period (BE-26). Not something the code can enforce.

What "constant time" covers: the comparison of the two digests. The primary-key lookup before it
is an ordinary indexed query, and its duration was not measured.

SQLite note: a `DELETE` frees the page but does not overwrite it unless `PRAGMA secure_delete` is
on or the file is vacuumed. Deleted feedback text can remain in the file's free pages until then.
This is not handled.

## 6. Migrations

```
cd backend
.venv\Scripts\python.exe -m alembic upgrade head      # create or update the schema
.venv\Scripts\python.exe -m alembic downgrade base    # drop everything
.venv\Scripts\python.exe -m alembic revision --autogenerate -m "describe the change"
```

- `backend/alembic.ini`, `backend/migrations/env.py`, one revision:
  `migrations/versions/20261121_0001_initial_schema.py` (revision id `0001`).
- The URL comes from `DATABASE_URL` (or `sqlalchemy.url` set on the Alembic `Config` by the caller).
- SQLite runs in batch mode (`render_as_batch`), because SQLite cannot alter constraints in place.
- The revision uses only `sqlalchemy` types, not the application's type decorators, so it keeps
  working when the models change.

`init_db()` (`Base.metadata.create_all`) is for development and tests. A database created that way
has no `alembic_version` row; run `alembic stamp head` once before using migrations on it.
Deployments should use `alembic upgrade head`.

Autogenerate does not detect changes to `CHECK` constraints. When one changes, write that part of
the migration by hand. `tests/db/test_migrations.py` compares the migrated schema with
`create_all`, including check constraints, and fails if they drift.

## 7. What is deliberately not here

**Camera data.** No table for recordings, frames, images or landmarks. Frames never leave the
browser, and user-recorded samples live in the browser's IndexedDB.

**Users and accounts.** v1 has none. To add them later:

1. New tables in a new migration: `users` (`id` UUID, `created_at`, a login identifier chosen with
   its own privacy review), and whatever the chosen sign-in method needs (for example
   `user_credentials` or `user_identities`). Nothing in the existing tables has to change.
2. Per-user data as new tables keyed by `user_id` with `ON DELETE CASCADE`, for example
   `lesson_progress (user_id, lesson_id, completed_at)` and
   `sign_progress (user_id, sign_id, ...)`. The slug primary keys of `lessons` and `signs` are
   stable, so the progress the browser keeps locally today can be uploaded by id.
3. `feedback` can gain a nullable `user_id` with `ON DELETE CASCADE`; anonymous feedback keeps
   working through the deletion token.
4. Account deletion must remove every per-user row; cascades give that by construction.
5. `docs/SECURITY_PRIVACY.md` has to be updated first: accounts add personal data, cookies or
   tokens, and CORS credentials, all of which v1 explicitly lacks.

## 8. Tests

`backend\.venv\Scripts\python.exe -m pytest backend/tests/db` — 58 tests, all on temporary SQLite
files under pytest's `tmp_path`:

- `test_schema.py`: tables created, `init_db` repeatable, in-memory engine, no account/recording
  tables, exact feedback column set, foreign keys enforced, sign and model constraints, `get_db`.
- `test_seed.py`: idempotency over all tables, the three unvalidated models, categories, every sign
  pending and unsupported, dictionary URL taken from the research files, lessons, research tables
  equal to the JSON files, re-seed after a file change, missing dictionary record, missing research
  directory, unknown reference rejected, verified sign preserved.
- `test_repositories.py`: every repository read function, including search by category, English
  (case-insensitive) and Hindi, wildcard escaping, paging and totals.
- `test_feedback.py`: create, token hashing, timestamps, retention, database constraints, delete,
  wrong token, unknown and malformed id, `compare_digest` used on every path, both purges.
- `test_migrations.py`: `alembic upgrade head` on a temporary database gives the same tables,
  columns, keys, indexes and check constraints as `Base.metadata.create_all`; autogenerate reports
  no difference; the seed runs on a migrated database; `downgrade base` removes every table.

Not tested: PostgreSQL, concurrent writers, performance at any size, and timing behaviour of the
deletion path.
