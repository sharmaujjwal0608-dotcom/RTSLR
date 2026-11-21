"""Shared FastAPI dependencies and response documentation."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_db
from app.schemas.common import ErrorResponse


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_app_settings)]


def error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    """OpenAPI entries for the error envelope."""
    descriptions = {
        400: "Request refused (for example: consent missing or consent version unknown)",
        404: "Not found",
        413: "Request body too large",
        415: "Content-Type is not application/json",
        422: "Validation error",
        429: "Rate limit exceeded; see the Retry-After header",
    }
    return {
        code: {"model": ErrorResponse, "description": descriptions.get(code, "Error")}
        for code in status_codes
    }
