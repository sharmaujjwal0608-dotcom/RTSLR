from __future__ import annotations

from starlette.requests import Request

from app.core.rate_limit import SlidingWindowLimiter, client_key

from .conftest import API, assert_error, valid_feedback

URL = f"{API}/feedback"


# ----------------------------------------------------------------------------- limiter unit


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_sliding_window_allows_limit_then_blocks_then_recovers():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(3, 60, clock=clock)

    assert [limiter.hit("a") for _ in range(3)] == [None, None, None]
    retry = limiter.hit("a")
    assert retry is not None and 59.9 < retry <= 60

    # Another client is unaffected.
    assert limiter.hit("b") is None

    clock.now += 30
    assert limiter.hit("a") is not None
    assert 29.9 < limiter.hit("a") <= 30  # refused hits do not extend the window

    clock.now += 30.1  # the first three hits have left the window
    assert limiter.hit("a") is None


def test_window_slides_rather_than_resetting():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(2, 60, clock=clock)
    assert limiter.hit("a") is None  # t=0
    clock.now += 40
    assert limiter.hit("a") is None  # t=40
    clock.now += 25  # t=65: only the first hit expired
    assert limiter.hit("a") is None
    assert limiter.hit("a") is not None


def test_zero_limit_disables_and_key_table_is_bounded():
    assert all(SlidingWindowLimiter(0, 60).hit("a") is None for _ in range(100))

    clock = FakeClock()
    limiter = SlidingWindowLimiter(5, 60, max_keys=10, clock=clock)
    for i in range(10):
        limiter.hit(f"k{i}")
    clock.now += 61
    limiter.hit("new")  # purges the ten expired keys
    assert len(limiter._hits) == 1
    for i in range(50):
        limiter.hit(f"active{i}")
    assert len(limiter._hits) <= 10


def _request(app, peer: str, forwarded: str | None = None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request(
        {"type": "http", "method": "GET", "path": "/", "headers": headers,
         "client": (peer, 1234), "app": app}
    )


def test_client_key_is_hashed_and_forwarded_header_needs_a_trusted_proxy(app_factory):
    app = app_factory()
    direct = client_key(_request(app, "203.0.113.7"))
    assert "203.0.113.7" not in direct and len(direct) == 32
    assert client_key(_request(app, "203.0.113.7")) == direct
    assert client_key(_request(app, "203.0.113.8")) != direct
    # Untrusted peer: the header is ignored, so it cannot be used to dodge the limit.
    assert client_key(_request(app, "203.0.113.7", "198.51.100.1")) == direct

    proxied = app_factory(trusted_proxy_ips=["10.0.0.1"])
    via_proxy = client_key(_request(proxied, "10.0.0.1", "198.51.100.1, 10.0.0.1"))
    assert via_proxy == client_key(_request(proxied, "198.51.100.1"))
    assert via_proxy != client_key(_request(proxied, "10.0.0.1"))


# ----------------------------------------------------------------------------- endpoint


def test_feedback_returns_429_after_the_limit(client_factory):
    client = client_factory(rate_limit_feedback_per_minute=3)
    for _ in range(3):
        assert client.post(URL, json=valid_feedback()).status_code == 201

    r = client.post(URL, json=valid_feedback())
    assert_error(r, 429, "rate_limited")
    assert 1 <= int(r.headers["Retry-After"]) <= 60

    # DELETE shares the same budget, and reads are not affected.
    blocked = client.delete(f"{URL}/anything", headers={"X-Deletion-Token": "t"})
    assert_error(blocked, 429, "rate_limited")
    assert client.get(f"{API}/models").status_code == 200
    assert client.get(f"{API}/health").status_code == 200


def test_rejected_requests_also_count_towards_the_limit(client_factory):
    client = client_factory(rate_limit_feedback_per_minute=2)
    assert client.post(URL, json=valid_feedback(consent=False)).status_code == 400
    assert client.post(URL, json={"nonsense": True}).status_code == 422
    assert_error(client.post(URL, json=valid_feedback()), 429, "rate_limited")


def test_daily_limit(client_factory):
    client = client_factory(rate_limit_feedback_per_minute=100, rate_limit_feedback_per_day=2)
    assert client.post(URL, json=valid_feedback()).status_code == 201
    assert client.post(URL, json=valid_feedback()).status_code == 201
    r = client.post(URL, json=valid_feedback())
    assert_error(r, 429, "rate_limited")
    assert int(r.headers["Retry-After"]) > 3600


def test_read_limit(client_factory):
    client = client_factory(rate_limit_read_per_minute=2)
    assert client.get(f"{API}/models").status_code == 200
    assert client.get(f"{API}/research/roadmap").status_code == 200
    r = client.get(f"{API}/vocabulary")
    assert_error(r, 429, "rate_limited")
    assert "Retry-After" in r.headers
    assert client.get(f"{API}/health").status_code == 200  # health is never limited


def test_each_app_instance_has_its_own_counters(client_factory):
    first = client_factory(rate_limit_feedback_per_minute=1)
    second = client_factory(rate_limit_feedback_per_minute=1)
    assert first.post(URL, json=valid_feedback()).status_code == 201
    assert first.post(URL, json=valid_feedback()).status_code == 429
    assert second.post(URL, json=valid_feedback()).status_code == 201
