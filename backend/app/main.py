"""RTSLR API application factory.

Run from ``backend/``::

    .venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# app.db.session reads DATABASE_URL from the process environment when it is imported, so a
# local .env file has to be loaded first. Variables that are already set win.
load_dotenv(".env", override=False)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api import api_router  # noqa: E402
from app.core.config import API_PREFIX, API_VERSION, Settings, get_settings  # noqa: E402
from app.core.errors import (  # noqa: E402
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    install_error_handlers,
)
from app.core.rate_limit import SlidingWindowLimiter  # noqa: E402
from app.core.security import BodyLimitMiddleware, SecurityHeadersMiddleware  # noqa: E402
from app.db import repositories  # noqa: E402
from app.db import session as db_session  # noqa: E402

logger = logging.getLogger("rtslr.api")

DESCRIPTION = """
Read API for the RTSLR (Real-Time Sign Language Recognition) platform for Indian Sign Language
(ISL), plus one consent-managed feedback endpoint.

**There is deliberately no recognition endpoint.** Recognition runs entirely in the browser.
This API never receives camera frames, images, video or hand landmarks, and no endpoint accepts
a file upload.

**No validated ISL model exists yet.** `/models` describes what the client can run and marks
every entry honestly (`validated: false` unless a documented evaluation exists).
`/research/benchmarks` lists results published by other groups; `/research/experiments` lists
RTSLR's own runs and is empty until one has really been run.

**No accounts in v1.** Every endpoint is public. The only write endpoints are
`POST /feedback` (needs explicit consent, rate limited) and `DELETE /feedback/{id}` (needs the
deletion token returned on creation). Feedback stores no IP address and no user agent.

**Errors** always have the shape `{"error": {"code": string, "message": string, "details"?: any}}`.
Each response carries an `X-Request-ID` header for support.

RTSLR is not suitable for medical, legal, emergency or other high-stakes communication.
""".strip()

TAGS = [
    {"name": "health", "description": "Liveness and database status."},
    {"name": "models", "description": "Model versions the client can run in the browser."},
    {"name": "vocabulary", "description": "Sign vocabulary with honest media status."},
    {"name": "learning", "description": "Categories and lessons."},
    {"name": "research", "description": "Datasets, references, published benchmarks, roadmap."},
    {"name": "feedback", "description": "Consent-managed feedback and its deletion."},
]


def _configure_logging(settings: Settings) -> None:
    app_logger = logging.getLogger("rtslr")
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        app_logger.addHandler(handler)
        app_logger.propagate = False
    app_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    # Uvicorn's access log prints the client address on every request. This API keeps its own
    # access log without addresses (see RequestContextMiddleware), so uvicorn's is turned off.
    logging.getLogger("uvicorn.access").disabled = True


def _prepare_database(settings: Settings) -> None:
    if settings.auto_create_tables:
        db_session.init_db()
    db = db_session.SessionLocal()
    try:
        if settings.seed_on_startup:
            from app.db.seed import seed

            seed(db)
        # Retention: remove feedback past its expiry (BE-23). Skipped when the table is absent.
        try:
            removed = repositories.purge_expired_feedback(db)
            if removed:
                logger.info("retention purge removed %d feedback item(s)", removed)
        except Exception:
            db.rollback()
            logger.warning("retention purge skipped: feedback table not available")
    finally:
        db.close()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    _configure_logging(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        _prepare_database(settings)
        yield

    docs = settings.docs_enabled
    app = FastAPI(
        title="RTSLR API",
        description=DESCRIPTION,
        version=API_VERSION,
        openapi_tags=TAGS,
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )

    app.state.settings = settings
    app.state.trusted_proxies = frozenset(settings.trusted_proxy_ips)
    app.state.rate_limiters = {
        "feedback": [
            SlidingWindowLimiter(settings.rate_limit_feedback_per_minute, 60),
            SlidingWindowLimiter(settings.rate_limit_feedback_per_day, 86_400),
        ],
        "read": [SlidingWindowLimiter(settings.rate_limit_read_per_minute, 60)],
    }

    install_error_handlers(app)

    # Middleware added last runs first. Resulting order, outermost first:
    # CORS -> security headers -> request id / log / catch-all -> body limits -> routes.
    app.add_middleware(BodyLimitMiddleware, max_body_bytes=settings.max_body_bytes)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, production=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,  # no cookies, no accounts
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Deletion-Token"],
        expose_headers=[REQUEST_ID_HEADER, "Retry-After"],
        max_age=600,
    )

    app.include_router(api_router, prefix=API_PREFIX)
    return app


app = create_app()
