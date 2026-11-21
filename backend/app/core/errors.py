"""Uniform error envelope: ``{"error": {"code", "message", "details"?}}``.

Covers ``HTTPException``, request validation errors and unhandled exceptions. Nothing from the
exception itself (stack trace, SQL, file path, library name) reaches the client; the detail goes
to the server log together with the request id that is returned in ``X-Request-ID``.
"""

from __future__ import annotations

import logging
import time
import uuid
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("rtslr.api")

REQUEST_ID_HEADER = "X-Request-ID"

_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    503: "service_unavailable",
}


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(error_body(code, message, details), status_code=status_code, headers=headers)


class ApiError(StarletteHTTPException):
    """An error with a stable machine-readable code."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message
        self.details = details


def not_found(what: str) -> ApiError:
    return ApiError(404, "not_found", f"{what} not found.")


def _status_phrase(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"


async def _http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc, ApiError):
        return error_response(exc.status_code, exc.code, exc.message, exc.details, exc.headers)
    code = _CODES.get(exc.status_code, "internal_error" if exc.status_code >= 500 else "error")
    # Framework-raised details ("Not Found", "Method Not Allowed") are safe short strings.
    # Anything else, and every 5xx, gets the plain status phrase.
    if exc.status_code < 500 and isinstance(exc.detail, str) and len(exc.detail) <= 200:
        message = exc.detail
    else:
        message = _status_phrase(exc.status_code)
    return error_response(exc.status_code, code, message, headers=exc.headers)


def _field_path(loc: tuple[Any, ...] | list[Any]) -> str:
    # Field names come from the client when an unknown field is rejected, so they are bounded.
    return ".".join(str(part) for part in loc)[:120]


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field and problem only: the submitted value is never echoed back (BE-13).
    details = [
        {
            "field": _field_path(err.get("loc", ())),
            "problem": str(err.get("msg", "Invalid value"))[:200],
            "type": str(err.get("type", "invalid")),
        }
        for err in exc.errors()[:50]
    ]
    return error_response(422, "validation_error", "The request is not valid.", details)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_handler)  # type: ignore[arg-type]


class RequestContextMiddleware:
    """Request id, privacy-preserving access log and the catch-all for unhandled exceptions.

    The log line holds method, path, status, duration and request id. It never holds the client
    address, the user agent, the query string, headers or the body (BE-22).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        started = time.perf_counter()
        status_holder = {"status": 500, "started": False}

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                status_holder["started"] = True
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.lower().encode(), request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            logger.exception("unhandled error request_id=%s", request_id)
            if not status_holder["started"]:
                response = error_response(500, "internal_error", "Internal server error.")
                await response(scope, receive, send_with_id)
            else:
                raise
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "%s %s %s %.1fms request_id=%s",
                scope.get("method", "-"),
                scope.get("path", "-"),
                status_holder["status"],
                duration_ms,
                request_id,
            )
