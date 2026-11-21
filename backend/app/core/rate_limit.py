"""In-memory sliding-window rate limiter.

Scope and limits of this implementation:

* State lives in this process only. It is never written to disk or to the database and is lost
  on restart.
* The key is a salted hash of the client address. The salt is random per process, so the raw
  address is not kept even in memory and keys cannot be matched across restarts.
* It is correct for ONE process. With several workers or instances each one counts separately,
  so the effective limit is multiplied. For that case replace ``SlidingWindowLimiter`` with a
  shared store, for example a Redis sorted set per key (ZADD the timestamp, ZREMRANGEBYSCORE the
  expired entries, ZCARD to count, EXPIRE the key) behind the same ``hit`` method.
"""

from __future__ import annotations

import hashlib
import math
import secrets
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Request

from app.core.errors import ApiError

_SALT = secrets.token_bytes(16)


class SlidingWindowLimiter:
    """Allow at most ``limit`` hits per key in any ``window_seconds`` span. ``limit`` 0 disables."""

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        *,
        max_keys: int = 50_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window = float(window_seconds)
        self._max_keys = max_keys
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> float | None:
        """Record a hit. Returns ``None`` when allowed, else the seconds until a retry can pass."""
        if self.limit <= 0:
            return None
        now = self._clock()
        cutoff = now - self.window
        with self._lock:
            bucket = self._hits.get(key)
            if bucket is None:
                if len(self._hits) >= self._max_keys:
                    self._purge(cutoff)
                bucket = self._hits[key] = deque()
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return max(bucket[0] + self.window - now, 0.0)
            bucket.append(now)
            return None

    def _purge(self, cutoff: float) -> None:
        stale = [k for k, b in self._hits.items() if not b or b[-1] <= cutoff]
        for k in stale:
            del self._hits[k]
        if len(self._hits) >= self._max_keys:
            # Still full of active keys: drop everything rather than grow without bound.
            self._hits.clear()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_key(request: Request) -> str:
    """Salted hash of the client address, for use as a limiter key only.

    ``X-Forwarded-For`` is honoured only when the direct peer is listed in ``TRUSTED_PROXY_IPS``
    (BE-19); the right-most entry that is not itself a trusted proxy is used.
    """
    peer = request.client.host if request.client else "unknown"
    trusted: frozenset[str] = getattr(request.app.state, "trusted_proxies", frozenset())
    address = peer
    if peer in trusted:
        forwarded = request.headers.get("x-forwarded-for", "")
        for candidate in reversed([p.strip() for p in forwarded.split(",") if p.strip()]):
            if candidate not in trusted:
                address = candidate[:64]
                break
    return hashlib.blake2b(address.encode("utf-8", "replace"), key=_SALT, digest_size=16).hexdigest()


def rate_limit(group: str) -> Callable[[Request], None]:
    """FastAPI dependency that applies every limiter registered under ``group``.

    Limiters are created per application in ``create_app`` and stored on
    ``app.state.rate_limiters`` so separate app instances (tests) do not share counters.
    """

    def dependency(request: Request) -> None:
        limiters: list[SlidingWindowLimiter] = request.app.state.rate_limiters.get(group, [])
        if not limiters:
            return
        key = client_key(request)
        for limiter in limiters:
            retry_after = limiter.hit(key)
            if retry_after is not None:
                raise ApiError(
                    429,
                    "rate_limited",
                    "Too many requests. Try again later.",
                    headers={"Retry-After": str(max(1, math.ceil(retry_after)))},
                )

    return dependency
