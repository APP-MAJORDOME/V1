from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
import jwt
from jwt.exceptions import PyJWTError
import redis

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)
redis_client = redis.from_url(settings.redis_url, decode_responses=True)

_BCRYPT_MAX_BYTES = 72


def _password_bytes(password: str) -> bytes:
    raw = password.encode("utf-8")
    return raw[:_BCRYPT_MAX_BYTES]


class AuthContext:
    def __init__(self, user_id: int, household_id: int, token: str, jti: str, token_type: str):
        self.user_id = user_id
        self.household_id = household_id
        self.token = token
        self.jti = jti
        self.token_type = token_type


def _create_token(*, user_id: int, household_id: int, expires_minutes: int, token_type: str) -> str:
    issued_at = datetime.now(timezone.utc)
    expire_at = issued_at + timedelta(minutes=expires_minutes)
    jti = str(uuid4())
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "household_id": household_id,
        "jti": jti,
        "type": token_type,
        "iat": int(issued_at.timestamp()),
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: int, household_id: int) -> str:
    return _create_token(
        user_id=user_id,
        household_id=household_id,
        expires_minutes=settings.jwt_expire_minutes,
        token_type="access",
    )


def create_refresh_token(*, user_id: int, household_id: int) -> str:
    return _create_token(
        user_id=user_id,
        household_id=household_id,
        expires_minutes=settings.jwt_refresh_expire_minutes,
        token_type="refresh",
    )


def hash_password(plain_password: str) -> str:
    """Hachage bcrypt standard ``$2b$...`` (anciens hashes passlib inchangés)."""
    return bcrypt.hashpw(_password_bytes(plain_password), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def _is_token_revoked(jti: str) -> bool:
    try:
        return bool(redis_client.get(f"auth:revoked:{jti}"))
    except Exception:
        return False


def revoke_token(token: str) -> None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        jti = str(payload.get("jti", ""))
        exp_value = payload.get("exp")
        if not jti or exp_value is None:
            return
        exp_ts = int(exp_value)
        ttl = max(exp_ts - int(datetime.now(timezone.utc).timestamp()), 1)
        redis_client.setex(f"auth:revoked:{jti}", ttl, "1")
    except Exception:
        return


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def get_current_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthContext:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_bearer_token", "message": "Bearer token is required."},
        )
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload.get("sub"))
        household_id = int(payload.get("household_id"))
        jti = str(payload.get("jti"))
        token_type = str(payload.get("type", "access"))
        if token_type != "access":
            raise ValueError("wrong_token_type")
        if _is_token_revoked(jti):
            raise ValueError("revoked_token")
    except (PyJWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_bearer_token", "message": "Bearer token is invalid."},
        )
    return AuthContext(
        user_id=user_id,
        household_id=household_id,
        token=credentials.credentials,
        jti=jti,
        token_type=token_type,
    )
