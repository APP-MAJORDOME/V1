"""Jetons de session en cookies HttpOnly (complément au Bearer JSON)."""

from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "majordome_access"
REFRESH_COOKIE = "majordome_refresh"


def _cookie_secure() -> bool:
    return settings.app_env not in ("local", "test")


def set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    common = {
        "httponly": True,
        "secure": _cookie_secure(),
        "samesite": "lax",
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=settings.jwt_expire_minutes * 60,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=settings.jwt_refresh_expire_minutes * 60,
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/")
