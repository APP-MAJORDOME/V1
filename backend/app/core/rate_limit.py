import hashlib

import redis
from fastapi import HTTPException, Request, status

from app.core.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)


def _client_fingerprint(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
    raw = f"{ip}:{request.url.path}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    return forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")


def check_auth_route_rate_limits(request: Request) -> None:
    """Quota séparé par IP sur login / refresh (en plus du quota global API)."""
    if request.method != "POST":
        return
    path = request.url.path
    if path == "/api/v1/auth/login":
        bucket = "auth_login"
        max_requests = settings.rate_limit_auth_login_per_minute
    elif path == "/api/v1/auth/refresh":
        bucket = "auth_refresh"
        max_requests = settings.rate_limit_auth_refresh_per_minute
    else:
        return
    ip = _client_ip(request)
    fp = hashlib.sha256(ip.encode("utf-8")).hexdigest()[:24]
    key = f"rate_limit:{bucket}:{fp}"
    try:
        current = redis_client.incr(key)
        if current == 1:
            redis_client.expire(key, 60)
        if current > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limited", "message": "Too many authentication attempts. Please retry later."},
            )
    except HTTPException:
        raise
    except Exception:
        return


def check_rate_limit(request: Request) -> None:
    bucket = "global"
    fingerprint = _client_fingerprint(request)
    key = f"rate_limit:{bucket}:{fingerprint}"
    max_requests = settings.rate_limit_requests_per_minute
    try:
        current = redis_client.incr(key)
        if current == 1:
            redis_client.expire(key, 60)
        if current > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limited", "message": "Too many requests. Please retry later."},
            )
    except HTTPException:
        raise
    except Exception:
        # Fail-open to preserve availability if Redis is unavailable.
        return
