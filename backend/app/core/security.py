"""Response security headers and request body limits (pure ASGI middleware)."""

from __future__ import annotations

from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import ApiError, error_response

_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

_BASE_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), display-capture=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    # Responses are small JSON documents; nothing here should sit in a shared cache.
    "Cache-Control": "no-store",
}
# The API serves JSON only, so nothing may load or be framed from its responses.
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_HSTS = "max-age=63072000; includeSubDomains"


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, production: bool = False) -> None:
        self.app = app
        self.production = production

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        # The interactive docs page loads its own script and style, so the strict policy
        # is not sent there. Docs are off in production unless ENABLE_DOCS is set.
        is_docs = path.startswith(_DOCS_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                present = {name.lower() for name, _ in message.get("headers", [])}
                headers = list(message.get("headers", []))
                extra = dict(_BASE_HEADERS)
                if not is_docs:
                    extra["Content-Security-Policy"] = _API_CSP
                if self.production:
                    extra["Strict-Transport-Security"] = _HSTS
                for name, value in extra.items():
                    if name.lower().encode() not in present:
                        headers.append((name.lower().encode(), value.encode()))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


class _BodyTooLarge(ApiError):
    def __init__(self) -> None:
        super().__init__(413, "payload_too_large", "Request body is too large.")


class BodyLimitMiddleware:
    """Reject oversized bodies with 413 and non-JSON write bodies with 415 (BE-04).

    A declared ``Content-Length`` above the limit is refused before anything is read. A body
    without a declared length (chunked) is counted while it streams and refused once it passes
    the limit. No endpoint accepts uploads, forms or multipart bodies (BE-07).
    """

    _BODY_METHODS = frozenset({"POST", "PUT", "PATCH"})

    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        declared = headers.get("content-length")
        if declared is not None:
            try:
                too_large = int(declared) > self.max_body_bytes
            except ValueError:
                response = error_response(400, "bad_request", "Invalid Content-Length header.")
                await response(scope, receive, send)
                return
            if too_large:
                response = error_response(413, "payload_too_large", "Request body is too large.")
                await response(scope, receive, send)
                return

        if scope["method"] in self._BODY_METHODS:
            media_type = headers.get("content-type", "").split(";")[0].strip().lower()
            if media_type != "application/json":
                response = error_response(
                    415, "unsupported_media_type", "Content-Type must be application/json."
                )
                await response(scope, receive, send)
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    # An HTTPException subclass, so FastAPI's body parser re-raises it as is.
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except StarletteHTTPException as exc:
            # Only reached if the exception escaped the application's own handlers.
            if isinstance(exc, _BodyTooLarge) and not response_started:
                response = error_response(413, "payload_too_large", "Request body is too large.")
                await response(scope, receive, send)
                return
            raise
