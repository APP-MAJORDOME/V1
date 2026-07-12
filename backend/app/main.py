import json
import time
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi import Request
from fastapi import status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import redis
from sqlalchemy import text
from app.core.config import settings
from app.core.rate_limit import check_auth_route_rate_limits, check_rate_limit
from app.core import database as db_module
from app.core.database import Base, engine
from app.api.routes import router
from app.api.telegram_routes import router as telegram_router
from app.api.whatsapp_routes import router as whatsapp_router
from app.api.billing_routes import router as billing_router
from app.services import document_attachments as doc_attach

if settings.auto_create_tables:
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        doc_attach.upload_root().mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(json.dumps({"event": "upload_dir_mkdir_failed", "error": str(exc)}), flush=True)
    if settings.telegram_webhook_auto_register and (settings.telegram_bot_token or "").strip():
        from app.services.telegram_bot import register_webhook

        result = register_webhook()
        print(json.dumps({"event": "telegram_webhook_register", "result": result}), flush=True)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Hors quota : sondes K8s / LB, schéma OpenAPI et UI Swagger (rafraîchissements fréquents).
_RATE_LIMIT_SKIP_PATHS = frozenset({
    "/health",
    "/live",
    "/ready",
    "/openapi.json",
    "/docs",
    "/redoc",
    "/api/v1/webhooks/telegram",
    "/api/v1/webhooks/whatsapp",
    "/api/v1/webhooks/stripe",
})

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    if request.url.path not in _RATE_LIMIT_SKIP_PATHS:
        check_rate_limit(request)
        check_auth_route_rate_limits(request)
    response: Response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": elapsed_ms,
            }
        ),
        flush=True,
    )
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    # Keep geolocation/camera disabled but allow microphone for voice features.
    response.headers["Permissions-Policy"] = "geolocation=(), camera=()"
    if settings.app_env != "local":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", "http_error")
        message = detail.get("message", "Request failed.")
    else:
        code = "http_error"
        message = str(detail)
    payload = {"code": code, "message": message, "request_id": request_id}
    return JSONResponse(status_code=exc.status_code, content={"detail": payload}, headers={"X-Request-Id": request_id})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    payload = {"code": "validation_error", "message": "Invalid request payload.", "request_id": request_id}
    return JSONResponse(status_code=422, content={"detail": payload}, headers={"X-Request-Id": request_id})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    print(
        json.dumps(
            {
                "event": "unhandled_exception",
                "request_id": request_id,
                "path": request.url.path,
                "error_type": type(exc).__name__,
            }
        ),
        flush=True,
    )
    payload = {"code": "internal_error", "message": "Internal server error.", "request_id": request_id}
    return JSONResponse(status_code=500, content={"detail": payload}, headers={"X-Request-Id": request_id})


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}


@app.get("/live")
def live():
    return {"status": "alive", "env": settings.app_env}


@app.get("/ready")
def ready(response: Response):
    checks: dict[str, bool] = {"database": False, "redis": False, "upload_dir": False}

    db = db_module.SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False
    finally:
        db.close()

    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        checks["redis"] = bool(redis_client.ping())
    except Exception:
        checks["redis"] = False

    try:
        root = Path(settings.upload_dir).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        probe = root / ".majordome_upload_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        checks["upload_dir"] = True
    except OSError:
        checks["upload_dir"] = False

    all_ok = checks["database"] and checks["redis"]
    if not all_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ready" if all_ok else "degraded", "checks": checks}


app.include_router(router)
app.include_router(telegram_router)
app.include_router(whatsapp_router)
app.include_router(billing_router)
