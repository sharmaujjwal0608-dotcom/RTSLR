from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.config import API_VERSION
from app.schemas import HealthOut

logger = logging.getLogger("rtslr.api")

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut, summary="Service and database status")
def health(db: DbSession) -> HealthOut:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        # The reason goes to the server log only.
        logger.exception("health check: database query failed")
        database = "error"
    return HealthOut(status="ok", version=API_VERSION, database=database)
