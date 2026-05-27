import json
import re
from datetime import datetime, timedelta
from secrets import token_urlsafe
from urllib.parse import urlencode

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
import redis
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.dt import utc_now_naive
from app.core.structured_log import email_fingerprint, log_event
from app.core.security import (
    AuthContext,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_auth_context,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)
from app.connectors.base import ConnectorResult
from app.connectors.apple_bridge import (
    CALDAV_AVAILABLE,
    create_apple_event,
    delete_apple_event,
    sync_apple_events,
    update_apple_event,
)
from app.connectors.google_calendar import (
    create_google_event,
    delete_google_event,
    exchange_google_code_for_tokens,
    sync_google_events,
    update_google_event,
)
from app.models.models import (
    User,
    Household,
    HouseholdMember,
    ConnectedAccount,
    CanonicalEvent,
    Task,
    Routine,
    Opportunity,
    HouseholdDocument,
    HouseholdMemoryFact,
    TaskDelegation,
    GroceryItem,
)
from app.schemas.schemas import (
    HouseholdCreate,
    HouseholdMemberCreate,
    ConnectedAccountCreate,
    EventCreate,
    TaskCreate,
    TaskPatch,
    RoutineCreate,
    OpportunityCreate,
    AgentCommand,
    AgentRealtimeWebRtcRequest,
    AgentRealtimeWebRtcResponse,
    AgentRealtimeStatusResponse,
    LoginRequest,
    RegisterRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    LogoutRequest,
    LogoutResponse,
    APIError,
    HouseholdRead,
    HouseholdMemberRead,
    ConnectedAccountRead,
    CanonicalEventRead,
    TaskRead,
    TaskSummaryResponse,
    GroceryItemRead,
    GroceryItemCreate,
    GroceryItemPatch,
    RoutineRead,
    OpportunityRead,
    AccountSyncResponse,
    EventConflictsResponse,
    TodayBriefingResponse,
    AgentInterpretResponse,
    AgentActResponse,
    DebordeeRequest,
    DebordeeResponse,
    HomeStatusResponse,
    HomeSceneResponse,
    GoogleOAuthStartResponse,
    GoogleOAuthCallbackResponse,
    IntegrationCapabilitiesResponse,
    IntegrationStatusResponse,
    HouseholdDocumentRead,
    HouseholdDocumentCreate,
    HouseholdDocumentUpdate,
    DocumentBootstrapRequest,
    DocumentBootstrapResponse,
    DocumentStorageSummary,
    PartnerDelegationNotifyRequest,
    PartnerDelegationNotifyResponse,
    PartnerDelegationRead,
    HouseholdMemoryFactCreate,
    HouseholdMemoryFactRead,
    HouseholdMembersProfileSyncRequest,
)
from app.services.briefing import build_today_briefing
from app.services.agent import analyze_debordee, interpret_command
from app.services.realtime_voice import RealtimeVoiceError, build_alfred_realtime_instructions, exchange_realtime_webrtc_sdp
from app.services.conflicts import detect_conflicts
from app.services import document_attachments as doc_attach
from app.services.document_storage_usage import household_attachment_bytes_used
from app.services.household_documents import default_document_templates
from app.services.household_profile_members import resolve_partner_member, sync_members_from_profile_names
from app.services.partner_delegation import build_message_body, deliver_partner_delegation
from app.services.home import get_home_status, execute_scene

router = APIRouter(prefix="/api/v1")
google_oauth_states: dict[str, dict[str, int]] = {}
redis_client = redis.from_url(settings.redis_url, decode_responses=True)

_ATTACHMENT_ALLOWED_MIME = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"})

_APPLE_CALDAV_MISSING_USER_MSG = (
    "Le paquet Python « caldav » manque sur le serveur. Installe les dépendances du backend "
    "(pip install -r requirements.txt) puis redémarre l’API."
)


def api_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(status_code=status_code, detail=APIError(code=code, message=message).model_dump())


def _apple_connector_failure_exc(result: ConnectorResult) -> HTTPException | None:
    """Erreur lisible quand le connecteur Apple refuse (ex. dépendance caldav absente sur le serveur)."""
    if result.ok:
        return None
    if result.message == "caldav_not_installed":
        return api_error("apple_caldav_missing", _APPLE_CALDAV_MISSING_USER_MSG, 503)
    return None


def household_memory_lines(db: Session, household_id: int, limit: int = 36) -> list[str]:
    rows = (
        db.query(HouseholdMemoryFact)
        .filter(HouseholdMemoryFact.household_id == household_id)
        .order_by(HouseholdMemoryFact.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [r.fact_text.strip() for r in rows if r.fact_text and r.fact_text.strip()]


def parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def _parse_expected_updated_at(payload: dict) -> datetime | None:
    raw = payload.get("expected_updated_at")
    if raw in (None, ""):
        return None
    try:
        return parse_iso_datetime(str(raw))
    except Exception:
        raise api_error("invalid_expected_updated_at", "expected_updated_at must be a valid ISO datetime.", 400)


def set_oauth_state(state: str, user_id: int, household_id: int) -> None:
    value = json.dumps({"user_id": user_id, "household_id": household_id})
    try:
        redis_client.setex(f"oauth:google:state:{state}", settings.oauth_state_ttl_seconds, value)
    except Exception:
        google_oauth_states[state] = {"user_id": user_id, "household_id": household_id}


def pop_oauth_state(state: str) -> dict[str, int] | None:
    try:
        key = f"oauth:google:state:{state}"
        value = redis_client.get(key)
        if value:
            redis_client.delete(key)
            parsed = json.loads(value)
            return {"user_id": int(parsed["user_id"]), "household_id": int(parsed["household_id"])}
    except Exception:
        pass
    return google_oauth_states.pop(state, None)


@router.post("/integrations/google/oauth/start", response_model=GoogleOAuthStartResponse)
def start_google_oauth(auth: AuthContext = Depends(get_current_auth_context)):
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise api_error("google_oauth_not_configured", "Google OAuth is not configured.", 400)

    state = token_urlsafe(24)
    set_oauth_state(state=state, user_id=auth.user_id, household_id=auth.household_id)
    query = urlencode(
        {
            "client_id": settings.google_oauth_client_id,
            "redirect_uri": settings.google_oauth_redirect_uri,
            "response_type": "code",
            "scope": settings.google_oauth_scopes,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return GoogleOAuthStartResponse(
        authorization_url=f"https://accounts.google.com/o/oauth2/v2/auth?{query}",
        state=state,
    )


@router.get("/integrations/status", response_model=list[IntegrationStatusResponse])
def integrations_status(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    accounts = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == auth.user_id).all()
    by_provider = {a.provider: a for a in accounts}
    google = by_provider.get("google_calendar")
    apple = by_provider.get("apple_calendar")
    home_assistant = by_provider.get("home_assistant")

    _key = (settings.llm_api_key or "").strip()
    _prov = settings.llm_provider.lower()
    _openai_family = _prov in {"openai", "chatgpt"}
    _anthropic_family = _prov in {"anthropic", "claude"}
    _llm_ready = (_openai_family or _anthropic_family) and bool(_key)
    _llm_status = (
        "openai_ready"
        if _openai_family and _llm_ready
        else ("anthropic_ready" if _anthropic_family and _llm_ready else "mock_or_unconfigured")
    )

    return [
        {
            "provider": "google_calendar",
            "configured": bool(settings.google_oauth_client_id and settings.google_oauth_client_secret),
            "connected": google is not None and google.status == "connected",
            "status": google.status if google else "not_connected",
        },
        {
            "provider": "apple_calendar",
            "configured": CALDAV_AVAILABLE,
            "connected": apple is not None and apple.status == "connected",
            "status": apple.status if apple else "not_connected",
        },
        {
            "provider": "home_assistant",
            "configured": settings.home_adapter_mode == "home_assistant",
            "connected": home_assistant is not None and home_assistant.status == "connected",
            "status": home_assistant.status if home_assistant else "not_connected",
        },
        {
            "provider": "openai_llm",
            "configured": _llm_ready,
            "connected": _llm_ready,
            "status": _llm_status,
        },
    ]


@router.get("/integrations/capabilities", response_model=IntegrationCapabilitiesResponse)
def integrations_capabilities(_auth: AuthContext = Depends(get_current_auth_context)):
    return IntegrationCapabilitiesResponse(apple_caldav_available=CALDAV_AVAILABLE)


@router.post("/integrations/apple/connect", response_model=ConnectedAccountRead)
def connect_apple_calendar(
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    apple_id = str(payload.get("apple_id") or "").strip()
    app_password = str(payload.get("app_password") or "").strip()
    calendar_url = str(payload.get("calendar_url") or "").strip()
    if not apple_id or not app_password:
        raise api_error("apple_credentials_required", "Apple ID and app password are required.", 400)
    if not CALDAV_AVAILABLE:
        raise api_error("apple_caldav_missing", _APPLE_CALDAV_MISSING_USER_MSG, 503)

    account = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == auth.user_id,
            ConnectedAccount.provider == "apple_calendar",
        )
        .first()
    )
    secret_payload = {"apple_id": apple_id, "app_password": app_password}
    if calendar_url:
        secret_payload["calendar_url"] = calendar_url
    if account is None:
        account = ConnectedAccount(
            user_id=auth.user_id,
            provider="apple_calendar",
            status="connected",
            scopes_json=json.dumps(secret_payload),
        )
        db.add(account)
    else:
        account.scopes_json = json.dumps(secret_payload)
        account.status = "connected"
    db.commit()
    db.refresh(account)
    return account


@router.post("/integrations/home-assistant/connect", response_model=ConnectedAccountRead)
def connect_home_assistant(
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    base_url = str(payload.get("base_url") or "").strip().rstrip("/")
    access_token = str(payload.get("access_token") or "").strip()
    if not base_url or not access_token:
        raise api_error("home_assistant_credentials_required", "Home Assistant base_url and access_token are required.", 400)

    account = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == auth.user_id,
            ConnectedAccount.provider == "home_assistant",
        )
        .first()
    )
    secret_payload = {"base_url": base_url, "access_token": access_token}
    if account is None:
        account = ConnectedAccount(
            user_id=auth.user_id,
            provider="home_assistant",
            status="connected",
            scopes_json=json.dumps(secret_payload),
        )
        db.add(account)
    else:
        account.scopes_json = json.dumps(secret_payload)
        account.status = "connected"
    db.commit()
    db.refresh(account)
    return account


@router.get("/integrations/google/oauth/callback")
def google_oauth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    rid = getattr(request.state, "request_id", None)
    redirect_base = settings.frontend_base_url.rstrip("/")

    state_context = pop_oauth_state(state)
    if state_context is None:
        log_event("oauth_google_callback", request_id=rid, outcome="failure", reason="invalid_oauth_state")
        return RedirectResponse(url=f"{redirect_base}/?google_oauth=error&reason=invalid_state", status_code=303)

    try:
        tokens = exchange_google_code_for_tokens(code)
    except Exception:
        log_event("oauth_google_callback", request_id=rid, outcome="failure", reason="token_exchange_failed")
        return RedirectResponse(url=f"{redirect_base}/?google_oauth=error&reason=exchange_failed", status_code=303)

    account = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == state_context["user_id"],
            ConnectedAccount.provider == "google_calendar",
        )
        .first()
    )
    if account is None:
        account = ConnectedAccount(
            user_id=state_context["user_id"],
            provider="google_calendar",
            status="connected",
            scopes_json=json.dumps(tokens),
        )
        db.add(account)
    else:
        account.scopes_json = json.dumps(tokens)
        account.status = "connected"
    db.commit()
    db.refresh(account)
    log_event(
        "oauth_google_callback",
        request_id=rid,
        outcome="success",
        user_id=state_context["user_id"],
        account_id=account.id,
        provider=account.provider,
    )
    return RedirectResponse(url=f"{redirect_base}/?google_oauth=connected", status_code=303)


def _normalize_auth_email(email: str) -> str:
    return email.strip().lower()


def _resolve_household_for_user(
    db: Session,
    *,
    user: User,
    requested_household_id: int | None,
) -> Household:
    if requested_household_id is not None:
        household = db.get(Household, requested_household_id)
        if household is None or household.owner_user_id != user.id:
            raise api_error("household_forbidden", "You cannot access this household.", 403)
        return household
    household = db.query(Household).filter(Household.owner_user_id == user.id).order_by(Household.id.asc()).first()
    if household is None:
        household = Household(name=f"Foyer de {user.full_name}", owner_user_id=user.id)
        db.add(household)
        db.commit()
        db.refresh(household)
    return household


def _issue_login_tokens(db: Session, *, user: User, household_id: int | None = None) -> LoginResponse:
    household = _resolve_household_for_user(db, user=user, requested_household_id=household_id)
    token = create_access_token(user_id=user.id, household_id=household.id)
    refresh_token = create_refresh_token(user_id=user.id, household_id=household.id)
    return LoginResponse(
        access_token=token,
        refresh_token=refresh_token,
        user_id=user.id,
        household_id=household.id,
    )


@router.post("/auth/register", response_model=LoginResponse)
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    rid = getattr(request.state, "request_id", None)
    email = _normalize_auth_email(payload.email)
    fp = email_fingerprint(email)
    if db.query(User).filter(User.email == email).first() is not None:
        log_event("auth_register", request_id=rid, outcome="failure", reason="email_already_registered", email_fp=fp)
        raise api_error("email_already_registered", "An account with this email already exists.", 409)
    user = User(email=email, password_hash=hash_password(payload.password), full_name=payload.full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    response = _issue_login_tokens(db, user=user)
    log_event(
        "auth_register",
        request_id=rid,
        outcome="success",
        email_fp=fp,
        user_id=user.id,
        household_id=response.household_id,
    )
    return response


@router.post("/auth/login", response_model=LoginResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    rid = getattr(request.state, "request_id", None)
    email = _normalize_auth_email(payload.email)
    fp = email_fingerprint(email)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        log_event("auth_login", request_id=rid, outcome="failure", reason="invalid_credentials", email_fp=fp)
        raise api_error("invalid_credentials", "Invalid email or password.", 401)
    if user.password_hash is None:
        user.password_hash = hash_password(payload.password)
        db.commit()
        db.refresh(user)
    elif not verify_password(payload.password, user.password_hash):
        log_event(
            "auth_login",
            request_id=rid,
            outcome="failure",
            reason="invalid_credentials",
            email_fp=fp,
        )
        raise api_error("invalid_credentials", "Invalid email or password.", 401)

    try:
        response = _issue_login_tokens(db, user=user, household_id=payload.household_id)
    except HTTPException as exc:
        if exc.detail and isinstance(exc.detail, dict) and exc.detail.get("code") == "household_forbidden":
            log_event(
                "auth_login",
                request_id=rid,
                outcome="failure",
                reason="household_forbidden",
                email_fp=fp,
                user_id=user.id,
                requested_household_id=payload.household_id,
            )
        raise

    log_event(
        "auth_login",
        request_id=rid,
        outcome="success",
        email_fp=fp,
        user_id=user.id,
        household_id=response.household_id,
        is_new_user=False,
    )
    return response


@router.post("/auth/refresh", response_model=RefreshTokenResponse)
def auth_refresh(request: Request, payload: RefreshTokenRequest):
    rid = getattr(request.state, "request_id", None)
    try:
        token_payload = decode_token(payload.refresh_token)
        token_type = str(token_payload.get("type"))
        if token_type != "refresh":
            raise ValueError("invalid_token_type")
        jti = str(token_payload.get("jti", ""))
        if is_token_revoked(jti):
            raise ValueError("revoked_token")
        user_id = int(token_payload.get("sub"))
        household_id = int(token_payload.get("household_id"))
    except Exception:
        log_event("auth_refresh", request_id=rid, outcome="failure", reason="invalid_refresh_token")
        raise api_error("invalid_refresh_token", "Refresh token is invalid.", 401)
    revoke_token(payload.refresh_token)
    new_access_token = create_access_token(user_id=user_id, household_id=household_id)
    new_refresh_token = create_refresh_token(user_id=user_id, household_id=household_id)
    log_event(
        "auth_refresh",
        request_id=rid,
        outcome="success",
        user_id=user_id,
        household_id=household_id,
    )
    return RefreshTokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/auth/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    auth: AuthContext = Depends(get_current_auth_context),
):
    rid = getattr(request.state, "request_id", None)
    revoke_token(auth.token)
    if payload and payload.refresh_token:
        revoke_token(payload.refresh_token)
    log_event(
        "auth_logout",
        request_id=rid,
        outcome="success",
        user_id=auth.user_id,
        household_id=auth.household_id,
    )
    return LogoutResponse(status="logged_out")


@router.get("/households", response_model=list[HouseholdRead])
def list_households(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return db.query(Household).filter(Household.owner_user_id == auth.user_id).all()


@router.post("/households", response_model=HouseholdRead)
def create_household(
    payload: HouseholdCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = Household(name=payload.name, owner_user_id=auth.user_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/households/{household_id}", response_model=HouseholdRead)
def get_household(
    household_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = db.get(Household, household_id)
    if not item or item.owner_user_id != auth.user_id:
        raise api_error("household_not_found", "Household not found.", 404)
    return item


@router.post("/households/{household_id}/members", response_model=HouseholdMemberRead)
def create_member(
    household_id: int,
    payload: HouseholdMemberCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    household = db.get(Household, household_id)
    if not household or household.owner_user_id != auth.user_id:
        raise api_error("household_not_found", "Household not found.", 404)
    item = HouseholdMember(household_id=household_id, display_name=payload.display_name, role=payload.role, birth_year=payload.birth_year)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/household/profile/sync-members", response_model=list[HouseholdMemberRead])
def sync_household_members_from_profile(
    payload: HouseholdMembersProfileSyncRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """Crée ou met à jour Joanne / partenaire / enfant comme HouseholdMember (pour inbox partenaire et rôles)."""
    hh = db.get(Household, auth.household_id)
    if not hh or hh.owner_user_id != auth.user_id:
        raise api_error(
            "household_forbidden",
            "Seul le propriétaire du foyer peut synchroniser les membres depuis le profil.",
            403,
        )
    if not any(
        [
            payload.primary_name.strip(),
            payload.partner_name.strip(),
            payload.child_name.strip(),
        ]
    ):
        return []
    rows = sync_members_from_profile_names(
        db,
        household_id=auth.household_id,
        primary_name=payload.primary_name,
        partner_name=payload.partner_name,
        child_name=payload.child_name,
    )
    return rows


@router.get("/household/members", response_model=list[HouseholdMemberRead])
def list_current_household_members(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == auth.household_id)
        .order_by(HouseholdMember.id.asc())
        .all()
    )


@router.get("/accounts", response_model=list[ConnectedAccountRead])
def list_accounts(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return db.query(ConnectedAccount).filter(ConnectedAccount.user_id == auth.user_id).all()


@router.post("/accounts", response_model=ConnectedAccountRead)
def create_account(
    payload: ConnectedAccountCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = ConnectedAccount(
        user_id=auth.user_id,
        provider=payload.provider,
        external_account_id=payload.external_account_id,
        status=payload.status,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/accounts/{account_id}/sync", response_model=AccountSyncResponse)
def sync_account(
    account_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = db.get(ConnectedAccount, account_id)
    if not item or item.user_id != auth.user_id:
        raise api_error("account_not_found", "Connected account not found.", 404)
    if item.provider == "google_calendar":
        result = sync_google_events(db=db, account=item, household_id=auth.household_id)
        if not result.ok:
            raise api_error("google_sync_failed", result.message or "Google sync failed.", 502)
        return {"account_id": account_id, "provider": item.provider, "status": result.message}
    if item.provider == "apple_calendar":
        result = sync_apple_events(db=db, account=item, household_id=auth.household_id)
        if not result.ok:
            exc = _apple_connector_failure_exc(result)
            if exc:
                raise exc
            raise api_error("apple_sync_failed", result.message or "Apple sync failed.", 502)
        return {"account_id": account_id, "provider": item.provider, "status": result.message}
    return {"account_id": account_id, "provider": item.provider, "status": "sync_stub_ok"}


@router.get("/events", response_model=list[CanonicalEventRead])
def list_events(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    now = utc_now_naive()
    horizon = now + timedelta(days=90)
    return (
        db.query(CanonicalEvent)
        .filter(
            CanonicalEvent.household_id == auth.household_id,
            CanonicalEvent.starts_at >= now,
            CanonicalEvent.starts_at < horizon,
        )
        .order_by(CanonicalEvent.starts_at.asc())
        .all()
    )


@router.get("/events/doctolib/summary")
def doctolib_summary(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    now = utc_now_naive()
    horizon = now + timedelta(days=120)
    events = (
        db.query(CanonicalEvent)
        .filter(
            CanonicalEvent.household_id == auth.household_id,
            CanonicalEvent.starts_at >= now,
            CanonicalEvent.starts_at < horizon,
        )
        .order_by(CanonicalEvent.starts_at.asc())
        .all()
    )
    matched = []
    for event in events:
        blob = " ".join(
            [
                str(event.title or ""),
                str(event.description or ""),
                str(event.location or ""),
            ]
        ).lower()
        if "doctolib" in blob:
            matched.append(
                {
                    "id": event.id,
                    "title": event.title,
                    "starts_at": event.starts_at.isoformat(),
                    "source_provider": event.source_provider,
                }
            )
    return {
        "count": len(matched),
        "events": matched[:10],
        "status": "connected_via_calendar" if len(matched) > 0 else "no_doctolib_event_detected",
    }


@router.post("/events", response_model=CanonicalEventRead)
def create_event(
    payload: EventCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    event_data = payload.model_dump()
    event_data["household_id"] = auth.household_id
    item = CanonicalEvent(**event_data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/events/create-and-sync", response_model=CanonicalEventRead)
def create_event_and_sync(
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    title = str(payload.get("title") or "").strip()
    starts_at_raw = str(payload.get("starts_at") or "").strip()
    ends_at_raw = str(payload.get("ends_at") or "").strip()
    if not title or not starts_at_raw or not ends_at_raw:
        raise api_error("invalid_event_payload", "title, starts_at and ends_at are required.", 400)
    starts_at = parse_iso_datetime(starts_at_raw)
    ends_at = parse_iso_datetime(ends_at_raw)
    if ends_at <= starts_at:
        raise api_error("invalid_event_range", "ends_at must be greater than starts_at.", 400)

    provider = str(payload.get("provider") or "none")
    description = str(payload.get("description") or "") or None
    location = str(payload.get("location") or "") or None
    timezone = str(payload.get("timezone") or "Europe/Paris")

    event = CanonicalEvent(
        household_id=auth.household_id,
        title=title,
        description=description,
        location=location,
        category="calendar_sync" if provider != "none" else "general",
        starts_at=starts_at,
        ends_at=ends_at,
        timezone=timezone,
    )
    db.add(event)

    if provider == "google_calendar":
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "google_calendar")
            .first()
        )
        if account is None:
            raise api_error("google_account_not_connected", "Google Calendar account is not connected.", 400)
        result = create_google_event(
            db=db,
            account=account,
            title=title,
            starts_at=starts_at,
            ends_at=ends_at,
            description=description,
            location=location,
            timezone=timezone,
        )
        if not result.ok:
            raise api_error("google_create_failed", "Failed to create event on Google Calendar.", 502)
        event.source_provider = "google_calendar"
        event.source_event_id = str(result.payload.get("event_id") or "")
        event.raw_payload_json = json.dumps(result.payload.get("raw") or {})
    elif provider == "apple_calendar":
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "apple_calendar")
            .first()
        )
        if account is None:
            raise api_error("apple_account_not_connected", "Apple Calendar account is not connected.", 400)
        result = create_apple_event(
            account=account,
            title=title,
            starts_at=starts_at,
            ends_at=ends_at,
            description=description,
            location=location,
        )
        if not result.ok:
            exc = _apple_connector_failure_exc(result)
            if exc:
                raise exc
            raise api_error("apple_create_failed", "Échec de création sur Apple Calendar.", 502)
        event.source_provider = "apple_calendar"
        event.source_event_id = str(result.payload.get("event_id") or "")
        event.raw_payload_json = json.dumps(result.payload)
    elif provider != "none":
        raise api_error("provider_not_supported_for_write", "This provider is not yet supported for write sync.", 400)

    db.commit()
    db.refresh(event)
    return event


@router.put("/events/{event_id}/update-and-sync", response_model=CanonicalEventRead)
def update_event_and_sync(
    event_id: int,
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    event = db.get(CanonicalEvent, event_id)
    if not event or event.household_id != auth.household_id:
        raise api_error("event_not_found", "Event not found.", 404)
    expected_updated_at = _parse_expected_updated_at(payload)
    if expected_updated_at is not None and event.updated_at.replace(microsecond=0) != expected_updated_at.replace(microsecond=0):
        raise api_error(
            "event_conflict",
            "Cet evenement a ete modifie ailleurs. Recharge l agenda puis reapplique tes changements.",
            409,
        )

    title = str(payload.get("title") or event.title).strip()
    starts_at = parse_iso_datetime(str(payload.get("starts_at") or event.starts_at.isoformat()))
    ends_at = parse_iso_datetime(str(payload.get("ends_at") or event.ends_at.isoformat()))
    if ends_at <= starts_at:
        raise api_error("invalid_event_range", "ends_at must be greater than starts_at.", 400)
    description = str(payload.get("description") or event.description or "") or None
    location = str(payload.get("location") or event.location or "") or None
    timezone = str(payload.get("timezone") or event.timezone or "Europe/Paris")

    event.title = title
    event.starts_at = starts_at
    event.ends_at = ends_at
    event.description = description
    event.location = location
    event.timezone = timezone

    if event.source_provider == "google_calendar" and event.source_event_id:
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "google_calendar")
            .first()
        )
        if account is None:
            raise api_error("google_account_not_connected", "Google Calendar account is not connected.", 400)
        result = update_google_event(
            db=db,
            account=account,
            event_id=event.source_event_id,
            title=title,
            starts_at=starts_at,
            ends_at=ends_at,
            description=description,
            location=location,
            timezone=timezone,
        )
        if not result.ok:
            raise api_error("google_update_failed", "Failed to update event on Google Calendar.", 502)
    if event.source_provider == "apple_calendar" and event.source_event_id:
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "apple_calendar")
            .first()
        )
        if account is None:
            raise api_error("apple_account_not_connected", "Apple Calendar account is not connected.", 400)
        result = update_apple_event(
            account=account,
            event_id=event.source_event_id,
            title=title,
            starts_at=starts_at,
            ends_at=ends_at,
            description=description,
            location=location,
        )
        if not result.ok:
            exc = _apple_connector_failure_exc(result)
            if exc:
                raise exc
            raise api_error("apple_update_failed", "Échec de mise à jour sur Apple Calendar.", 502)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}")
def delete_event_and_sync(
    event_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    event = db.get(CanonicalEvent, event_id)
    if not event or event.household_id != auth.household_id:
        raise api_error("event_not_found", "Event not found.", 404)

    if event.source_provider == "google_calendar" and event.source_event_id:
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "google_calendar")
            .first()
        )
        if account is None:
            raise api_error("google_account_not_connected", "Google Calendar account is not connected.", 400)
        result = delete_google_event(db=db, account=account, event_id=event.source_event_id)
        if not result.ok:
            raise api_error("google_delete_failed", "Failed to delete event on Google Calendar.", 502)
    if event.source_provider == "apple_calendar" and event.source_event_id:
        account = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == auth.user_id, ConnectedAccount.provider == "apple_calendar")
            .first()
        )
        if account is None:
            raise api_error("apple_account_not_connected", "Apple Calendar account is not connected.", 400)
        result = delete_apple_event(account=account, event_id=event.source_event_id)
        if not result.ok:
            exc = _apple_connector_failure_exc(result)
            if exc:
                raise exc
            raise api_error("apple_delete_failed", "Échec de suppression sur Apple Calendar.", 502)

    db.delete(event)
    db.commit()
    return {"status": "deleted"}


@router.get("/events/conflicts", response_model=EventConflictsResponse)
def get_event_conflicts(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    now = utc_now_naive()
    horizon = now + timedelta(days=30)
    events = (
        db.query(CanonicalEvent)
        .filter(
            CanonicalEvent.household_id == auth.household_id,
            CanonicalEvent.starts_at >= now,
            CanonicalEvent.starts_at < horizon,
        )
        .order_by(CanonicalEvent.starts_at.asc())
        .all()
    )
    return {"conflicts": detect_conflicts(events)}


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    status_filter: str | None = Query(None, alias="status", pattern="^(open|done)$"),
    limit: int | None = Query(None, ge=1, le=200),
    offset: int | None = Query(None, ge=0, le=50_000),
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """Liste les tâches du foyer. Sans paramètres : comportement historique (tout, ordre par défaut).

    Avec `status`, `limit` et/ou `offset` : tri par `updated_at` décroissant pour faciliter l’historique paginé.
    """
    q = db.query(Task).filter(Task.household_id == auth.household_id)
    scoped = status_filter is not None or limit is not None or offset is not None
    if status_filter:
        q = q.filter(Task.status == status_filter)
    if scoped:
        q = q.order_by(Task.updated_at.desc().nulls_last(), Task.id.desc())
    if offset is not None:
        q = q.offset(offset)
    if limit is not None:
        q = q.limit(limit)
    return q.all()


@router.get("/tasks/summary", response_model=TaskSummaryResponse)
def tasks_summary(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    hid = auth.household_id
    open_count = db.query(Task).filter(Task.household_id == hid, Task.status == "open").count()
    done_count = db.query(Task).filter(Task.household_id == hid, Task.status == "done").count()
    return TaskSummaryResponse(open_count=open_count, done_count=done_count)


@router.get("/tasks/partner-inbox", response_model=list[TaskRead])
def partner_task_inbox(
    partner_name: str = Query("", max_length=80),
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """Tâches ouvertes pour le partenaire : assignées à ce membre si trouvé, sinon file commune récente."""
    pn = partner_name.strip()
    member = None
    if pn:
        member = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == auth.household_id,
                HouseholdMember.display_name.ilike(f"%{pn}%"),
            )
            .order_by(HouseholdMember.id.asc())
            .first()
        )
    base = db.query(Task).filter(Task.household_id == auth.household_id, Task.status == "open")
    if member:
        assigned = (
            base.filter(Task.assigned_member_id == member.id)
            .order_by(Task.due_at.asc().nulls_last(), Task.id.asc())
            .limit(25)
            .all()
        )
        if assigned:
            return assigned
    return base.order_by(Task.due_at.asc().nulls_last(), Task.id.asc()).limit(18).all()


@router.post("/tasks", response_model=TaskRead)
def create_task(
    payload: TaskCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    task_data = payload.model_dump()
    task_data["household_id"] = auth.household_id
    item = Task(**task_data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/tasks/{task_id}/complete", response_model=TaskRead)
def complete_task(
    task_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = db.get(Task, task_id)
    if not item or item.household_id != auth.household_id:
        raise api_error("task_not_found", "Task not found.", 404)
    item.status = "done"
    db.commit()
    db.refresh(item)
    return item


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def patch_task(
    task_id: int,
    payload: TaskPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    item = db.get(Task, task_id)
    if not item or item.household_id != auth.household_id:
        raise api_error("task_not_found", "Task not found.", 404)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return item
    if "assigned_member_id" in updates:
        aid = updates["assigned_member_id"]
        if aid is not None:
            member = db.get(HouseholdMember, aid)
            if not member or member.household_id != auth.household_id:
                raise api_error(
                    "invalid_assignee",
                    "Ce membre n’appartient pas à ton foyer.",
                    400,
                )
        item.assigned_member_id = aid
    if "status" in updates:
        item.status = updates["status"]
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/delegations/partner-notify", response_model=PartnerDelegationNotifyResponse)
def partner_delegation_notify(
    payload: PartnerDelegationNotifyRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    household = db.get(Household, auth.household_id)
    if not household or household.owner_user_id != auth.user_id:
        raise api_error(
            "delegation_forbidden",
            "Seul le propriétaire du foyer peut envoyer une notification de délégation.",
            403,
        )

    snap = [{"task_id": it.task_id, "title": it.title.strip()} for it in payload.items]

    tasks_assigned = 0
    partner_member = resolve_partner_member(db, auth.household_id, payload.partner_name.strip())
    if partner_member:
        for it in payload.items:
            tid = it.task_id
            if tid is None or tid <= 0:
                continue
            task = db.get(Task, tid)
            if not task or task.household_id != auth.household_id or task.status != "open":
                continue
            task.assigned_member_id = partner_member.id
            db.add(task)
            tasks_assigned += 1

    token_tok = token_urlsafe(32)
    row = TaskDelegation(
        household_id=auth.household_id,
        created_by_user_id=auth.user_id,
        partner_display_name=payload.partner_name.strip(),
        partner_contact=(payload.partner_contact or "").strip() or None,
        task_snapshot_json=json.dumps(snap, ensure_ascii=False),
        ack_token=token_tok,
        status="sent",
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    channels = deliver_partner_delegation(db, row, is_reminder=False)
    preview = build_message_body(
        partner_name=row.partner_display_name,
        items=snap,
        ack_token=row.ack_token,
        prefix="",
    )[:500]

    base = settings.public_api_base_url.rstrip("/")
    ack = f"{base}/api/v1/public/partner-delegations/{row.ack_token}/ack"
    return PartnerDelegationNotifyResponse(
        id=row.id,
        ack_url=ack,
        status=row.status,
        channels=channels,
        message_preview=preview,
        tasks_assigned=tasks_assigned,
    )


@router.get("/delegations", response_model=list[PartnerDelegationRead])
def list_partner_delegations(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(TaskDelegation)
        .filter(TaskDelegation.household_id == auth.household_id)
        .order_by(TaskDelegation.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/public/partner-delegations/{token}/ack")
def public_ack_partner_delegation(token: str, db: Session = Depends(get_db)):
    row = db.query(TaskDelegation).filter(TaskDelegation.ack_token == token).first()
    if not row:
        raise api_error("delegation_not_found", "Lien invalide.", 404)
    if row.acknowledged_at:
        html = "<html><meta charset='utf-8'><body><p>Accusé déjà enregistré. Merci&nbsp;!</p></body></html>"
        return HTMLResponse(content=html, media_type="text/html; charset=utf-8")
    row.acknowledged_at = utc_now_naive()
    row.status = "acknowledged"
    row.next_reminder_at = None
    db.add(row)
    db.commit()
    html = "<html><meta charset='utf-8'><body><p>Merci — accusé enregistré dans MajorDome.</p></body></html>"
    return HTMLResponse(content=html, media_type="text/html; charset=utf-8")


@router.get("/memory/facts", response_model=list[HouseholdMemoryFactRead])
def list_memory_facts(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdMemoryFact)
        .filter(HouseholdMemoryFact.household_id == auth.household_id)
        .order_by(HouseholdMemoryFact.updated_at.desc())
        .limit(80)
        .all()
    )


@router.post("/memory/facts", response_model=HouseholdMemoryFactRead)
def create_memory_fact(
    payload: HouseholdMemoryFactCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    fact = payload.fact_text.strip()
    row = HouseholdMemoryFact(
        household_id=auth.household_id,
        created_by_user_id=auth.user_id,
        fact_text=fact,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/memory/facts/{fact_id}")
def delete_memory_fact(
    fact_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdMemoryFact, fact_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("memory_fact_not_found", "Fait introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/grocery/items", response_model=list[GroceryItemRead])
def list_grocery_items(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(GroceryItem)
        .filter(GroceryItem.household_id == auth.household_id)
        .order_by(GroceryItem.done.asc(), GroceryItem.updated_at.desc(), GroceryItem.id.desc())
        .limit(500)
        .all()
    )


@router.post("/grocery/items", response_model=GroceryItemRead)
def create_grocery_item(
    payload: GroceryItemCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    label = payload.label.strip()
    if not label:
        raise api_error("invalid_grocery_label", "Le libellé est requis.", 400)
    existing = (
        db.query(GroceryItem)
        .filter(
            GroceryItem.household_id == auth.household_id,
            GroceryItem.label.ilike(label),
            GroceryItem.done.is_(False),
        )
        .first()
    )
    if existing:
        return existing
    row = GroceryItem(household_id=auth.household_id, label=label, done=False, delegated=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/grocery/items/{item_id}", response_model=GroceryItemRead)
def patch_grocery_item(
    item_id: int,
    payload: GroceryItemPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(GroceryItem, item_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("grocery_item_not_found", "Article introuvable.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and data["label"] is not None:
        data["label"] = data["label"].strip()
        if not data["label"]:
            raise api_error("invalid_grocery_label", "Le libellé est requis.", 400)
    for key, value in data.items():
        setattr(row, key, value)
    if data.get("done") is True:
        row.delegated = False
    db.commit()
    db.refresh(row)
    return row


@router.delete("/grocery/items/done")
def clear_done_grocery_items(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    (
        db.query(GroceryItem)
        .filter(GroceryItem.household_id == auth.household_id, GroceryItem.done.is_(True))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "cleared"}


@router.delete("/grocery/items/{item_id}")
def delete_grocery_item(
    item_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(GroceryItem, item_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("grocery_item_not_found", "Article introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/documents", response_model=list[HouseholdDocumentRead])
def list_documents(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdDocument)
        .filter(HouseholdDocument.household_id == auth.household_id)
        .order_by(HouseholdDocument.updated_at.desc(), HouseholdDocument.id.desc())
        .all()
    )


@router.get("/documents/storage-summary", response_model=DocumentStorageSummary)
def documents_storage_summary(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    used = household_attachment_bytes_used(db, auth.household_id)
    qmb = settings.attachment_quota_mb_per_household
    quota_bytes = qmb * 1024 * 1024 if qmb and qmb > 0 else None
    return DocumentStorageSummary(used_bytes=used, quota_bytes=quota_bytes)


@router.post("/documents", response_model=HouseholdDocumentRead)
def create_document(
    payload: HouseholdDocumentCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    row = HouseholdDocument(
        household_id=auth.household_id,
        created_by_user_id=auth.user_id,
        **data,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/documents/{document_id}", response_model=HouseholdDocumentRead)
def update_document(
    document_id: int,
    payload: HouseholdDocumentUpdate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdDocument, document_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("document_not_found", "Document introuvable.", 404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.post("/documents/{document_id}/attachment", response_model=HouseholdDocumentRead)
async def upload_document_attachment(
    document_id: int,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdDocument, document_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("document_not_found", "Document introuvable.", 404)
    max_bytes = max(1, settings.attachment_max_mb) * 1024 * 1024
    body = await file.read()
    if len(body) > max_bytes:
        raise api_error("attachment_too_large", "Fichier trop volumineux.", 413)
    ctype = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if ctype not in _ATTACHMENT_ALLOWED_MIME:
        raise api_error(
            "attachment_type_not_allowed",
            "Type non autorisé (JPEG, PNG, WebP, GIF ou PDF).",
            415,
        )
    orig = Path(file.filename or "piece-jointe").name.replace("\x00", "")[:255] or "piece-jointe"
    old_key = row.attachment_storage_key
    used = household_attachment_bytes_used(db, auth.household_id)
    old_sz = row.attachment_size_bytes or 0
    projected = used - old_sz + len(body)
    qmb = settings.attachment_quota_mb_per_household
    if qmb and qmb > 0:
        cap = qmb * 1024 * 1024
        if projected > cap:
            raise api_error(
                "attachment_quota_exceeded",
                f"Quota stockage du foyer dépassé ({qmb} Mo au total). Supprime une pièce jointe ou augmente MAJORDOME_ATTACHMENT_QUOTA_MB_PER_HOUSEHOLD.",
                413,
            )
    try:
        key = doc_attach.save_bytes(auth.household_id, body)
    except OSError:
        raise api_error("attachment_storage_failed", "Impossible d'enregistrer le fichier.", 500)
    doc_attach.delete_file(old_key)
    row.attachment_storage_key = key
    row.attachment_original_name = orig
    row.attachment_mime = ctype
    row.attachment_size_bytes = len(body)
    db.commit()
    db.refresh(row)
    return row


@router.get("/documents/{document_id}/attachment")
def download_document_attachment(
    document_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdDocument, document_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("document_not_found", "Document introuvable.", 404)
    if not row.attachment_storage_key:
        raise api_error("attachment_not_found", "Aucune pièce jointe.", 404)
    try:
        path = doc_attach.path_for_storage_key(row.attachment_storage_key)
    except ValueError:
        raise api_error("attachment_corrupt", "Référence fichier invalide.", 500)
    if not path.is_file():
        raise api_error("attachment_missing", "Fichier absent du serveur.", 404)
    fname = row.attachment_original_name or "piece-jointe"
    media = row.attachment_mime or "application/octet-stream"
    return FileResponse(path, media_type=media, filename=fname)


@router.delete("/documents/{document_id}/attachment", response_model=HouseholdDocumentRead)
def remove_document_attachment(
    document_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdDocument, document_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("document_not_found", "Document introuvable.", 404)
    doc_attach.delete_file(row.attachment_storage_key)
    row.attachment_storage_key = None
    row.attachment_original_name = None
    row.attachment_mime = None
    row.attachment_size_bytes = None
    db.commit()
    db.refresh(row)
    return row


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdDocument, document_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("document_not_found", "Document introuvable.", 404)
    doc_attach.delete_file(row.attachment_storage_key)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": document_id}


@router.post("/documents/bootstrap", response_model=DocumentBootstrapResponse)
def bootstrap_documents(
    payload: DocumentBootstrapRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(HouseholdDocument)
        .filter(HouseholdDocument.household_id == auth.household_id)
        .count()
    )
    if existing > 0:
        return DocumentBootstrapResponse(created=0)
    templates = default_document_templates(
        prenom=payload.prenom,
        partenaire=payload.partenaire,
        enfant=payload.enfant,
    )
    for t in templates:
        db.add(
            HouseholdDocument(
                household_id=auth.household_id,
                created_by_user_id=auth.user_id,
                **t,
            )
        )
    db.commit()
    return DocumentBootstrapResponse(created=len(templates))


@router.get("/routines", response_model=list[RoutineRead])
def list_routines(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return db.query(Routine).filter(Routine.household_id == auth.household_id).all()


@router.post("/routines", response_model=RoutineRead)
def create_routine(
    payload: RoutineCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    routine_data = payload.model_dump()
    routine_data["household_id"] = auth.household_id
    item = Routine(**routine_data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/opportunities", response_model=list[OpportunityRead])
def list_opportunities(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(Opportunity)
        .filter(Opportunity.household_id == auth.household_id)
        .order_by(Opportunity.score.desc())
        .all()
    )


@router.post("/opportunities", response_model=OpportunityRead)
def create_opportunity(
    payload: OpportunityCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    opportunity_data = payload.model_dump()
    opportunity_data["household_id"] = auth.household_id
    item = Opportunity(**opportunity_data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/briefings/today", response_model=TodayBriefingResponse)
def today_briefing(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return build_today_briefing(db, household_id=auth.household_id)


@router.post("/agent/interpret", response_model=AgentInterpretResponse)
def agent_interpret(
    payload: AgentCommand,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    mem = household_memory_lines(db, auth.household_id)
    return interpret_command(payload.command, memory_lines=mem)


@router.post("/agent/debordee", response_model=DebordeeResponse)
def agent_debordee(
    payload: DebordeeRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    mem = household_memory_lines(db, auth.household_id)
    result = analyze_debordee(
        task_titles=payload.task_titles,
        primary_name=payload.primary_name.strip() or "Joanne",
        partner_name=payload.partner_name.strip() or "Alexandre",
        child_name=payload.child_name.strip() or "Léa",
        memory_lines=mem,
    )
    return DebordeeResponse(
        critique=result.get("critique") or [],
        deleguer=result.get("deleguer") or [],
        supprimer=result.get("supprimer") or [],
        message=result.get("message") or "",
    )


@router.post("/agent/act", response_model=AgentActResponse)
def agent_act(
    payload: AgentCommand,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    mem = household_memory_lines(db, auth.household_id)
    return {"status": "not_implemented", "preview": interpret_command(payload.command, memory_lines=mem)}


@router.get("/agent/realtime/status", response_model=AgentRealtimeStatusResponse)
def agent_realtime_status(auth: AuthContext = Depends(get_current_auth_context)):
    key_ok = bool(settings.llm_api_key and settings.llm_api_key.strip())
    return AgentRealtimeStatusResponse(
        configured=key_ok,
        model=settings.llm_realtime_model,
        voice=settings.llm_realtime_voice,
    )


@router.post("/agent/realtime/webrtc", response_model=AgentRealtimeWebRtcResponse)
def agent_realtime_webrtc(
    payload: AgentRealtimeWebRtcRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """
    Échange SDP WebRTC avec OpenAI Realtime (voix native).
    Le navigateur envoie l’offer ; le backend renvoie l’answer après appel à POST /v1/realtime/calls.
    """
    if not settings.llm_api_key or not settings.llm_api_key.strip():
        raise api_error(
            "realtime_not_configured",
            "Voix temps réel indisponible : ajoute MAJORDOME_LLM_API_KEY (clé OpenAI avec accès Realtime) dans le .env du serveur, puis redémarre les conteneurs.",
            503,
        )
    mem = household_memory_lines(db, auth.household_id)
    notes = [str(x).strip() for x in payload.extra_memory_notes if str(x).strip()][:24]
    name = payload.assistant_display_name.strip() or "Alfred"
    instructions = build_alfred_realtime_instructions(name, mem, notes)
    try:
        answer_sdp = exchange_realtime_webrtc_sdp(payload.sdp, instructions)
    except RealtimeVoiceError as exc:
        raise api_error("realtime_voice_failed", str(exc), 502) from exc
    return AgentRealtimeWebRtcResponse(sdp=answer_sdp)


@router.get("/home/status", response_model=HomeStatusResponse)
def home_status(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return get_home_status(db=db, user_id=auth.user_id)


@router.post("/home/scenes/{scene_id}/execute", response_model=HomeSceneResponse)
def home_scene(scene_id: str, auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    if not re.fullmatch(r"[a-zA-Z0-9_\-]{1,64}", scene_id):
        raise api_error("invalid_scene_id", "Scene id format is invalid.", 400)
    return execute_scene(scene_id, db=db, user_id=auth.user_id)
