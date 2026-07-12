import json
import re
from datetime import datetime, timedelta
from secrets import token_urlsafe
from urllib.parse import urlencode

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
import redis
from sqlalchemy.orm import Session
from app.core.auth_cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
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
from app.connectors.microsoft_calendar import (
    create_microsoft_event,
    exchange_microsoft_code_for_tokens,
    microsoft_oauth_authorize_url,
    sync_microsoft_events,
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
    HouseholdSalonMessage,
    HouseholdCapture,
    TaskDelegation,
    GroceryItem,
    HouseholdFridgeItem,
    HouseholdWalletCard,
    HouseholdCoupon,
    HouseholdBudgetEnvelope,
    HouseholdMealPlan,
    HouseholdMoiWellness,
    JournalEntry,
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
    JoinHouseholdRequest,
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
    FridgeItemRead,
    FridgeItemCreate,
    FridgeItemPatch,
    WalletCardRead,
    WalletCardCreate,
    WalletCardPatch,
    CouponRead,
    CouponCreate,
    CouponPatch,
    BudgetEnvelopeRead,
    BudgetEnvelopeCreate,
    BudgetEnvelopePatch,
    MealPlanRead,
    MealPlanUpsert,
    MoiWellnessRead,
    MoiWellnessPut,
    JournalEntryRead,
    JournalEntryCreate,
    JournalEntryUpdate,
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
    HomeProvidersResponse,
    HomeDeviceControlRequest,
    HomeDeviceControlResponse,
    HomeAssistantDiagnosticResponse,
    HomeProviderTestResponse,
    HomeProviderDevicesResponse,
    HomeProviderDeviceActionRequest,
    HomeProviderDeviceActionResponse,
    HomeDeviceGroupsResponse,
    HomeDeviceGroupUpsertRequest,
    HomeDeviceGroupMembersUpdateRequest,
    HomeDeviceGroupRenameRequest,
    HomeDeviceGroupDuplicateRequest,
    HomeDeviceGroupActionRequest,
    HomeDeviceGroupActionResponse,
    HomeAssistantConnectRequest,
    HomeProviderConnectRequest,
    HomeProviderCredentialsUpsertRequest,
    GoogleOAuthStartResponse,
    GoogleOAuthCallbackResponse,
    HomeAssistantConnectResponse,
    IntegrationCapabilitiesResponse,
    HubOverviewResponse,
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
    UserVaultSecretRead,
    UserVaultSecretsListResponse,
    UserVaultSecretCreate,
    UserVaultSecretPatch,
    UserVaultSecretRevealResponse,
    VerisureAlarmRequest,
    DriveAutomateLoginResponse,
    DriveFillCartResponse,
    DrivePrepareResponse,
    DriveStatusListResponse,
    HouseholdSalonMessageCreate,
    HouseholdSalonMessageRead,
    HouseholdCaptureRead,
    HouseholdCapturePatch,
    HouseholdSalonAnalyzeResponse,
    HouseholdCaptureApplyResponse,
    HouseholdBirthdayRead,
    HouseholdBirthdayCreate,
    AccountDeletionStatusRead,
    AccountExportResponse,
)
from app.services.briefing import build_today_briefing
from app.services.agent import analyze_debordee, interpret_command
from app.services.agent_executor import execute_agent_act
from app.services.alfred_household import build_household_answer, command_wants_household_answer
from app.services.shopping_advisor import build_shopping_plan_response, command_wants_shopping_plan
from app.services.alfred_attachments import ALFRED_ATTACHMENT_MIME, analyze_alfred_attachment, resolve_attachment_mime
from app.services.realtime_voice import RealtimeVoiceError, build_alfred_realtime_instructions, exchange_realtime_webrtc_sdp
from app.services.conflicts import detect_conflicts
from app.services import document_attachments as doc_attach
from app.services.document_storage_usage import household_attachment_bytes_used
from app.services.household_documents import default_document_templates
from app.services.vault_crypto import vault_encryption_enabled
from app.services.drive_integration import (
    automate_drive_login,
    fill_drive_cart,
    list_drive_status,
    prepare_drive_session,
)
from app.services.verisure_control import execute_verisure_alarm_by_action
from app.services.hub_registry import build_hub_overview
from app.services.household_salon import (
    analyze_salon_conversation,
    create_salon_message,
    list_household_captures,
    list_salon_messages,
    patch_capture_status,
    seed_salon_demo,
)
from app.services.household_equity import compute_household_equity
from app.services.household_proactive import get_household_invite_info, run_proactive_household_tick
from app.services.household_join import (
    find_household_by_invite_code,
    join_household_by_code,
    list_household_ids_for_user,
    preview_invite,
    user_has_household_access,
)
from app.services.subscription import can_create_capture, get_subscription_status, increment_capture_usage
from app.services.household_birthdays import (
    create_household_birthday,
    delete_household_birthday,
    list_household_birthdays,
)
from app.services.account_privacy import (
    cancel_account_deletion,
    deletion_grace_ends_at,
    export_household_data,
    request_account_deletion,
)
from app.services.user_secrets_vault import (
    create_user_vault_secret,
    delete_user_vault_secret,
    list_user_vault_secrets,
    reveal_user_vault_secret_password,
    update_user_vault_secret,
)
from app.services.household_profile_members import resolve_partner_member, sync_members_from_profile_names
from app.services.partner_delegation import build_message_body, deliver_partner_delegation
from app.services.home import (
    get_home_status,
    execute_scene,
    get_home_providers,
    execute_device_control,
    connect_home_assistant,
    diagnose_home_assistant,
    connect_home_provider,
    upsert_home_provider_credentials,
    test_home_provider_connection,
    list_provider_devices,
    execute_provider_device_action,
    list_device_groups,
    upsert_device_group,
    delete_device_group,
    update_device_group_members,
    rename_device_group,
    duplicate_device_group,
    execute_device_group_action,
)

router = APIRouter(prefix="/api/v1")
google_oauth_states: dict[str, dict[str, int]] = {}
microsoft_oauth_states: dict[str, dict[str, int]] = {}
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


def set_oauth_state(state: str, user_id: int, household_id: int, provider: str = "google") -> None:
    value = json.dumps({"user_id": user_id, "household_id": household_id})
    fallback = google_oauth_states if provider == "google" else microsoft_oauth_states
    try:
        redis_client.setex(f"oauth:{provider}:state:{state}", settings.oauth_state_ttl_seconds, value)
    except Exception:
        fallback[state] = {"user_id": user_id, "household_id": household_id}


def pop_oauth_state(state: str, provider: str = "google") -> dict[str, int] | None:
    fallback = google_oauth_states if provider == "google" else microsoft_oauth_states
    try:
        key = f"oauth:{provider}:state:{state}"
        value = redis_client.get(key)
        if value:
            redis_client.delete(key)
            parsed = json.loads(value)
            return {"user_id": int(parsed["user_id"]), "household_id": int(parsed["household_id"])}
    except Exception:
        pass
    return fallback.pop(state, None)


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
    microsoft = by_provider.get("microsoft_calendar")
    apple = by_provider.get("apple_calendar")
    home_assistant = by_provider.get("home_assistant")
    telegram = by_provider.get("telegram")
    whatsapp = by_provider.get("whatsapp")

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
            "provider": "microsoft_calendar",
            "configured": bool(settings.microsoft_oauth_client_id and settings.microsoft_oauth_client_secret),
            "connected": microsoft is not None and microsoft.status == "connected",
            "status": microsoft.status if microsoft else "not_connected",
        },
        {
            "provider": "apple_calendar",
            "configured": CALDAV_AVAILABLE,
            "connected": apple is not None and apple.status == "connected",
            "status": apple.status if apple else "not_connected",
        },
        {
            "provider": "home_assistant",
            "configured": bool(
                settings.home_assistant_auto_when_connected
                or settings.home_adapter_mode == "home_assistant"
            ),
            "connected": home_assistant is not None and home_assistant.status == "connected",
            "status": home_assistant.status if home_assistant else "not_connected",
        },
        {
            "provider": "openai_llm",
            "configured": _llm_ready,
            "connected": _llm_ready,
            "status": _llm_status,
        },
        {
            "provider": "telegram",
            "configured": bool((settings.telegram_bot_token or "").strip()),
            "connected": telegram is not None and telegram.status == "connected",
            "status": telegram.status if telegram else "not_connected",
        },
        {
            "provider": "whatsapp",
            "configured": bool(
                (settings.whatsapp_access_token or "").strip()
                and (settings.whatsapp_phone_number_id or "").strip()
            ),
            "connected": whatsapp is not None and whatsapp.status == "connected",
            "status": whatsapp.status if whatsapp else "not_connected",
        },
    ]


@router.get("/integrations/capabilities", response_model=IntegrationCapabilitiesResponse)
def integrations_capabilities(_auth: AuthContext = Depends(get_current_auth_context)):
    key = (settings.llm_api_key or "").strip()
    prov = (settings.llm_provider or "").lower()
    llm_ready = prov in {"openai", "chatgpt", "anthropic", "claude"} and bool(key)
    return IntegrationCapabilitiesResponse(
        apple_caldav_available=CALDAV_AVAILABLE,
        microsoft_oauth_configured=bool(
            settings.microsoft_oauth_client_id and settings.microsoft_oauth_client_secret
        ),
        google_oauth_configured=bool(
            settings.google_oauth_client_id and settings.google_oauth_client_secret
        ),
        drive_automation_enabled=bool(settings.drive_automation_enabled),
        home_assistant_auto_when_connected=bool(settings.home_assistant_auto_when_connected),
        llm_configured=llm_ready,
        realtime_configured=llm_ready,
        vault_secrets_enabled=bool(settings.vault_secrets_enabled),
        telegram_configured=bool((settings.telegram_bot_token or "").strip()),
        whatsapp_configured=bool(
            (settings.whatsapp_access_token or "").strip()
            and (settings.whatsapp_phone_number_id or "").strip()
        ),
    )


@router.get("/integrations/hub", response_model=HubOverviewResponse)
def integrations_hub_overview(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return build_hub_overview(db=db, user_id=auth.user_id)


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


@router.post("/integrations/home-assistant/connect", response_model=HomeAssistantConnectResponse)
def connect_home_assistant_route(
    payload: HomeAssistantConnectRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    account = connect_home_assistant(
        db=db,
        user_id=auth.user_id,
        base_url=payload.base_url,
        access_token=payload.access_token,
    )
    diag = diagnose_home_assistant(db=db, user_id=auth.user_id)
    return HomeAssistantConnectResponse(
        id=account.id,
        provider=account.provider,
        status=account.status,
        diagnostic=diag,
    )


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


@router.post("/integrations/microsoft/oauth/start", response_model=GoogleOAuthStartResponse)
def start_microsoft_oauth(auth: AuthContext = Depends(get_current_auth_context)):
    if not settings.microsoft_oauth_client_id or not settings.microsoft_oauth_client_secret:
        raise api_error("microsoft_oauth_not_configured", "Microsoft OAuth is not configured.", 400)

    state = token_urlsafe(24)
    set_oauth_state(state=state, user_id=auth.user_id, household_id=auth.household_id, provider="microsoft")
    return GoogleOAuthStartResponse(
        authorization_url=microsoft_oauth_authorize_url(state),
        state=state,
    )


@router.get("/integrations/microsoft/oauth/callback")
def microsoft_oauth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    rid = getattr(request.state, "request_id", None)
    redirect_base = settings.frontend_base_url.rstrip("/")

    state_context = pop_oauth_state(state, provider="microsoft")
    if state_context is None:
        log_event("oauth_microsoft_callback", request_id=rid, outcome="failure", reason="invalid_oauth_state")
        return RedirectResponse(url=f"{redirect_base}/?microsoft_oauth=error&reason=invalid_state", status_code=303)

    try:
        tokens = exchange_microsoft_code_for_tokens(code)
    except Exception:
        log_event("oauth_microsoft_callback", request_id=rid, outcome="failure", reason="token_exchange_failed")
        return RedirectResponse(url=f"{redirect_base}/?microsoft_oauth=error&reason=exchange_failed", status_code=303)

    account = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == state_context["user_id"],
            ConnectedAccount.provider == "microsoft_calendar",
        )
        .first()
    )
    if account is None:
        account = ConnectedAccount(
            user_id=state_context["user_id"],
            provider="microsoft_calendar",
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
        "oauth_microsoft_callback",
        request_id=rid,
        outcome="success",
        user_id=state_context["user_id"],
        account_id=account.id,
        provider=account.provider,
    )
    return RedirectResponse(url=f"{redirect_base}/?microsoft_oauth=connected", status_code=303)


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
        if household is None or not user_has_household_access(
            db, user_id=user.id, household_id=requested_household_id
        ):
            raise api_error("household_forbidden", "You cannot access this household.", 403)
        return household
    ids = list_household_ids_for_user(db, user.id)
    if ids:
        household = db.get(Household, ids[0])
        if household is not None:
            return household
    household = Household(name=f"Foyer de {user.full_name}", owner_user_id=user.id)
    db.add(household)
    db.commit()
    db.refresh(household)
    return household


def _apply_invite_code(db: Session, *, user: User, invite_code: str | None) -> Household | None:
    cleaned = (invite_code or "").strip()
    if not cleaned:
        return None
    try:
        return join_household_by_code(db, user=user, invite_code=cleaned)
    except ValueError:
        raise api_error("invite_not_found", "Code d'invitation invalide ou expiré.", 404) from None


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


@router.get("/public/household/invite/{code}")
def public_household_invite_preview(code: str, db: Session = Depends(get_db)):
    return preview_invite(db, code)


@router.post("/auth/register", response_model=LoginResponse)
def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    rid = getattr(request.state, "request_id", None)
    email = _normalize_auth_email(payload.email)
    fp = email_fingerprint(email)
    if db.query(User).filter(User.email == email).first() is not None:
        log_event("auth_register", request_id=rid, outcome="failure", reason="email_already_registered", email_fp=fp)
        raise api_error("email_already_registered", "An account with this email already exists.", 409)
    # Valider l'invitation avant de créer le compte
    if (payload.invite_code or "").strip():
        if find_household_by_invite_code(db, payload.invite_code or "") is None:
            log_event("auth_register", request_id=rid, outcome="failure", reason="invite_not_found", email_fp=fp)
            raise api_error("invite_not_found", "Code d'invitation invalide ou expiré.", 404)
    user = User(email=email, password_hash=hash_password(payload.password), full_name=payload.full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    joined = _apply_invite_code(db, user=user, invite_code=payload.invite_code)
    login_response = _issue_login_tokens(
        db, user=user, household_id=joined.id if joined is not None else None
    )
    set_auth_cookies(response, access_token=login_response.access_token, refresh_token=login_response.refresh_token)
    log_event(
        "auth_register",
        request_id=rid,
        outcome="success",
        email_fp=fp,
        user_id=user.id,
        household_id=login_response.household_id,
        joined_via_invite=bool(joined),
    )
    return login_response


@router.post("/auth/login", response_model=LoginResponse)
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
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

    joined = _apply_invite_code(db, user=user, invite_code=payload.invite_code)
    target_household_id = joined.id if joined is not None else payload.household_id

    try:
        login_response = _issue_login_tokens(db, user=user, household_id=target_household_id)
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
        household_id=login_response.household_id,
        joined_via_invite=bool(joined),
    )
    set_auth_cookies(response, access_token=login_response.access_token, refresh_token=login_response.refresh_token)
    return login_response


@router.post("/auth/join", response_model=LoginResponse)
def join_household(
    request: Request,
    payload: JoinHouseholdRequest,
    response: Response,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """Compte déjà connecté : rattache au foyer invité et renouvelle les tokens."""
    rid = getattr(request.state, "request_id", None)
    user = db.get(User, auth.user_id)
    if user is None:
        raise api_error("invalid_credentials", "User not found.", 401)
    joined = _apply_invite_code(db, user=user, invite_code=payload.invite_code)
    assert joined is not None
    login_response = _issue_login_tokens(db, user=user, household_id=joined.id)
    set_auth_cookies(response, access_token=login_response.access_token, refresh_token=login_response.refresh_token)
    log_event(
        "auth_join",
        request_id=rid,
        outcome="success",
        user_id=user.id,
        household_id=login_response.household_id,
    )
    return login_response


@router.post("/auth/refresh", response_model=RefreshTokenResponse)
def auth_refresh(request: Request, response: Response, payload: RefreshTokenRequest | None = None):
    rid = getattr(request.state, "request_id", None)
    refresh_raw = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_COOKIE)
    if not refresh_raw:
        log_event("auth_refresh", request_id=rid, outcome="failure", reason="missing_refresh_token")
        raise api_error("invalid_refresh_token", "Refresh token is invalid.", 401)
    try:
        token_payload = decode_token(refresh_raw)
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
    revoke_token(refresh_raw)
    new_access_token = create_access_token(user_id=user_id, household_id=household_id)
    new_refresh_token = create_refresh_token(user_id=user_id, household_id=household_id)
    set_auth_cookies(response, access_token=new_access_token, refresh_token=new_refresh_token)
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
    response: Response,
    payload: LogoutRequest | None = None,
    auth: AuthContext = Depends(get_current_auth_context),
):
    rid = getattr(request.state, "request_id", None)
    revoke_token(auth.token)
    refresh_raw = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_COOKIE)
    if refresh_raw:
        revoke_token(refresh_raw)
    clear_auth_cookies(response)
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
    ids = list_household_ids_for_user(db, auth.user_id)
    if not ids:
        return []
    rows = db.query(Household).filter(Household.id.in_(ids)).all()
    by_id = {h.id: h for h in rows}
    return [by_id[i] for i in ids if i in by_id]


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
    if not item or not user_has_household_access(db, user_id=auth.user_id, household_id=household_id):
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
    if not household or not user_has_household_access(db, user_id=auth.user_id, household_id=household_id):
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


@router.get("/household/salon/messages", response_model=list[HouseholdSalonMessageRead])
def household_salon_messages(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
    seed_if_empty: bool = Query(True),
):
    if seed_if_empty and not list_salon_messages(db, auth.household_id, limit=1):
        seed_salon_demo(db, auth)
    return list_salon_messages(db, auth.household_id)


@router.post("/household/salon/messages", response_model=HouseholdSalonMessageRead)
def household_salon_post_message(
    payload: HouseholdSalonMessageCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = create_salon_message(db, auth, payload.text)
    analyze_salon_conversation(db, auth.household_id)
    return row


@router.post("/household/salon/analyze", response_model=HouseholdSalonAnalyzeResponse)
def household_salon_analyze(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    n = analyze_salon_conversation(db, auth.household_id)
    return HouseholdSalonAnalyzeResponse(
        captures_created=n,
        message=f"{n} capture(s) générée(s)." if n else "Aucune nouvelle capture détectée.",
    )


@router.get("/household/salon/captures", response_model=list[HouseholdCaptureRead])
def household_salon_captures(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
    status: str | None = Query(None),
):
    return list_household_captures(db, auth.household_id, status=status)


@router.patch("/household/salon/captures/{capture_id}", response_model=HouseholdCaptureApplyResponse)
def household_salon_capture_patch(
    capture_id: int,
    payload: HouseholdCapturePatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    out = patch_capture_status(db, auth, capture_id, payload.status)
    if out is None:
        raise api_error("capture_not_found", "Capture introuvable.", 404)
    apply_info = out.get("apply") if isinstance(out.get("apply"), dict) else None
    msg = "Capture mise à jour."
    extra: dict = {}
    if payload.status == "approved" and isinstance(apply_info, dict):
        msg = str(apply_info.get("message") or msg)
        extra = apply_info
    return HouseholdCaptureApplyResponse(
        capture_id=capture_id,
        status=payload.status,
        message=msg,
        payload=extra,
    )


@router.get("/household/birthdays", response_model=list[HouseholdBirthdayRead])
def household_birthdays_list(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return list_household_birthdays(db, auth.household_id)


@router.post("/household/birthdays", response_model=HouseholdBirthdayRead)
def household_birthdays_create(
    payload: HouseholdBirthdayCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return create_household_birthday(
        db,
        auth.household_id,
        name=payload.name,
        birthday_date=payload.birthday_date,
        notes=payload.notes,
    )


@router.delete("/household/birthdays/{birthday_id}")
def household_birthdays_delete(
    birthday_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not delete_household_birthday(db, auth.household_id, birthday_id):
        raise api_error("birthday_not_found", "Anniversaire introuvable.", 404)
    return {"status": "deleted"}


@router.get("/household/equity")
def household_equity(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
    mode: str = Query("combined"),
):
    return compute_household_equity(db, auth.household_id, mode=mode)


@router.post("/household/equity/propose-transfer")
def household_equity_propose_transfer(
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    task_id = int(payload.get("task_id") or 0)
    to_member_id = int(payload.get("to_member_id") or 0)
    task = db.get(Task, task_id)
    if task is None or task.household_id != auth.household_id:
        raise api_error("task_not_found", "Tâche introuvable.", 404)
    to_member = db.get(HouseholdMember, to_member_id)
    if to_member is None or to_member.household_id != auth.household_id:
        raise api_error("member_not_found", "Membre introuvable.", 404)
    task.assigned_member_id = to_member_id
    db.commit()
    create_salon_message(
        db,
        auth,
        f"Proposition acceptée : « {task.title} » est maintenant assignée à {to_member.display_name}.",
    )
    return {"status": "ok", "task_id": task.id, "assigned_to": to_member.display_name}


@router.get("/household/subscription")
def household_subscription(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    from app.services.stripe_billing import billing_public_status

    return billing_public_status(db, auth.household_id)


@router.get("/household/invite")
def household_invite_link(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return get_household_invite_info(db, auth.household_id)


@router.post("/household/proactive/tick")
def household_proactive_tick(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return run_proactive_household_tick(db, auth.household_id)


@router.patch("/household/profile")
def household_profile_patch(
    payload: dict,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    hh = db.get(Household, auth.household_id)
    if hh is None:
        raise api_error("household_not_found", "Foyer introuvable.", 404)
    if "household_type" in payload:
        hh.household_type = str(payload["household_type"])[:64]
    if "briefing_hour" in payload:
        hh.briefing_hour = max(5, min(11, int(payload["briefing_hour"])))
    db.commit()
    return {"household_type": hh.household_type, "briefing_hour": hh.briefing_hour}


@router.get("/account/export", response_model=AccountExportResponse)
def account_export_data(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return AccountExportResponse(
        export=export_household_data(db, auth.user_id, auth.household_id),
    )


@router.get("/account/deletion-status", response_model=AccountDeletionStatusRead)
def account_deletion_status(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    user = db.get(User, auth.user_id)
    requested = user.deletion_requested_at if user else None
    return AccountDeletionStatusRead(
        deletion_requested_at=requested,
        grace_ends_at=deletion_grace_ends_at(requested) if requested else None,
    )


@router.post("/account/request-deletion", response_model=AccountDeletionStatusRead)
def account_request_deletion(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    requested = request_account_deletion(db, auth.user_id)
    return AccountDeletionStatusRead(
        deletion_requested_at=requested,
        grace_ends_at=deletion_grace_ends_at(requested),
    )


@router.post("/account/cancel-deletion", response_model=AccountDeletionStatusRead)
def account_cancel_deletion(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    cancel_account_deletion(db, auth.user_id)
    return AccountDeletionStatusRead(deletion_requested_at=None, grace_ends_at=None)


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
    if item.provider == "microsoft_calendar":
        result = sync_microsoft_events(db=db, account=item, household_id=auth.household_id)
        if not result.ok:
            raise api_error("microsoft_sync_failed", result.message or "Microsoft sync failed.", 502)
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
    elif provider == "microsoft_calendar":
        account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == auth.user_id,
                ConnectedAccount.provider == "microsoft_calendar",
            )
            .first()
        )
        if account is None:
            raise api_error("microsoft_account_not_connected", "Microsoft Calendar account is not connected.", 400)
        result = create_microsoft_event(
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
            raise api_error("microsoft_create_failed", "Failed to create event on Microsoft Calendar.", 502)
        event.source_provider = "microsoft_calendar"
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
    if not household or not user_has_household_access(db, user_id=auth.user_id, household_id=auth.household_id):
        raise api_error(
            "delegation_forbidden",
            "Tu n’as pas accès à ce foyer pour envoyer une délégation.",
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


@router.get("/fridge/items", response_model=list[FridgeItemRead])
def list_fridge_items(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdFridgeItem)
        .filter(HouseholdFridgeItem.household_id == auth.household_id)
        .order_by(HouseholdFridgeItem.expires_at.asc(), HouseholdFridgeItem.id.asc())
        .limit(500)
        .all()
    )


@router.post("/fridge/items", response_model=FridgeItemRead)
def create_fridge_item(
    payload: FridgeItemCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    label = payload.label.strip()
    if not label:
        raise api_error("invalid_fridge_label", "Le libellé est requis.", 400)
    row = HouseholdFridgeItem(
        household_id=auth.household_id,
        label=label,
        expires_at=payload.expires_at,
        qty=payload.qty,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/fridge/items/{item_id}", response_model=FridgeItemRead)
def patch_fridge_item(
    item_id: int,
    payload: FridgeItemPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdFridgeItem, item_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("fridge_item_not_found", "Produit introuvable.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and data["label"] is not None:
        data["label"] = data["label"].strip()
        if not data["label"]:
            raise api_error("invalid_fridge_label", "Le libellé est requis.", 400)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/fridge/items/{item_id}")
def delete_fridge_item(
    item_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdFridgeItem, item_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("fridge_item_not_found", "Produit introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/wallet/cards", response_model=list[WalletCardRead])
def list_wallet_cards(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdWalletCard)
        .filter(HouseholdWalletCard.household_id == auth.household_id)
        .order_by(HouseholdWalletCard.brand.asc(), HouseholdWalletCard.id.asc())
        .limit(100)
        .all()
    )


@router.post("/wallet/cards", response_model=WalletCardRead)
def create_wallet_card(
    payload: WalletCardCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    brand = payload.brand.strip()
    if not brand:
        raise api_error("invalid_wallet_brand", "La marque est requise.", 400)
    row = HouseholdWalletCard(
        household_id=auth.household_id,
        brand=brand,
        points=payload.points,
        color=payload.color,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/wallet/cards/{card_id}", response_model=WalletCardRead)
def patch_wallet_card(
    card_id: int,
    payload: WalletCardPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdWalletCard, card_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("wallet_card_not_found", "Carte introuvable.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "brand" in data and data["brand"] is not None:
        data["brand"] = data["brand"].strip()
        if not data["brand"]:
            raise api_error("invalid_wallet_brand", "La marque est requise.", 400)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/wallet/cards/{card_id}")
def delete_wallet_card(
    card_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdWalletCard, card_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("wallet_card_not_found", "Carte introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/wallet/coupons", response_model=list[CouponRead])
def list_coupons(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdCoupon)
        .filter(HouseholdCoupon.household_id == auth.household_id)
        .order_by(HouseholdCoupon.expires_at.asc(), HouseholdCoupon.id.asc())
        .limit(200)
        .all()
    )


@router.post("/wallet/coupons", response_model=CouponRead)
def create_coupon(
    payload: CouponCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    label = payload.label.strip()
    if not label:
        raise api_error("invalid_coupon_label", "Le libellé est requis.", 400)
    discount = payload.discount.strip()
    if not discount:
        raise api_error("invalid_coupon_discount", "La réduction est requise.", 400)
    row = HouseholdCoupon(
        household_id=auth.household_id,
        label=label,
        expires_at=payload.expires_at,
        discount=discount,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/wallet/coupons/{coupon_id}", response_model=CouponRead)
def patch_coupon(
    coupon_id: int,
    payload: CouponPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdCoupon, coupon_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("coupon_not_found", "Coupon introuvable.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and data["label"] is not None:
        data["label"] = data["label"].strip()
        if not data["label"]:
            raise api_error("invalid_coupon_label", "Le libellé est requis.", 400)
    if "discount" in data and data["discount"] is not None:
        data["discount"] = data["discount"].strip()
        if not data["discount"]:
            raise api_error("invalid_coupon_discount", "La réduction est requise.", 400)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/wallet/coupons/{coupon_id}")
def delete_coupon(
    coupon_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(HouseholdCoupon, coupon_id)
    if not row or row.household_id != auth.household_id:
        raise api_error("coupon_not_found", "Coupon introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


_DAY_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _meal_plan_to_read(row: HouseholdMealPlan) -> MealPlanRead:
    try:
        missing = json.loads(row.missing_json or "[]")
        if not isinstance(missing, list):
            missing = []
        missing = [str(x).strip() for x in missing if str(x).strip()]
    except json.JSONDecodeError:
        missing = []
    return MealPlanRead(
        id=row.id,
        household_id=row.household_id,
        day_key=row.day_key,
        lunch=row.lunch or "",
        dinner=row.dinner or "",
        missing=missing,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/budget/envelopes", response_model=list[BudgetEnvelopeRead])
def list_budget_envelopes(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == auth.household_id)
        .order_by(HouseholdBudgetEnvelope.slug.asc(), HouseholdBudgetEnvelope.id.asc())
        .limit(50)
        .all()
    )


@router.post("/budget/envelopes", response_model=BudgetEnvelopeRead)
def create_budget_envelope(
    payload: BudgetEnvelopeCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    slug = payload.slug.strip().lower()
    label = payload.label.strip()
    if not slug or not label:
        raise api_error("invalid_budget_envelope", "Slug et libellé requis.", 400)
    existing = (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == auth.household_id, HouseholdBudgetEnvelope.slug == slug)
        .first()
    )
    if existing:
        raise api_error("budget_envelope_exists", "Cette enveloppe existe déjà.", 409)
    row = HouseholdBudgetEnvelope(
        household_id=auth.household_id,
        slug=slug,
        label=label,
        spent=payload.spent,
        budget_cap=payload.budget_cap,
        color=payload.color,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/budget/envelopes/{slug}", response_model=BudgetEnvelopeRead)
def patch_budget_envelope(
    slug: str,
    payload: BudgetEnvelopePatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    key = slug.strip().lower()
    row = (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == auth.household_id, HouseholdBudgetEnvelope.slug == key)
        .first()
    )
    if not row:
        raise api_error("budget_envelope_not_found", "Enveloppe introuvable.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and data["label"] is not None:
        data["label"] = data["label"].strip()
        if not data["label"]:
            raise api_error("invalid_budget_envelope", "Le libellé est requis.", 400)
    for key_name, value in data.items():
        setattr(row, key_name, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/budget/envelopes/{slug}")
def delete_budget_envelope(
    slug: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    key = slug.strip().lower()
    row = (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == auth.household_id, HouseholdBudgetEnvelope.slug == key)
        .first()
    )
    if not row:
        raise api_error("budget_envelope_not_found", "Enveloppe introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/meal-plans", response_model=list[MealPlanRead])
def list_meal_plans(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    rows = (
        db.query(HouseholdMealPlan)
        .filter(HouseholdMealPlan.household_id == auth.household_id)
        .order_by(HouseholdMealPlan.day_key.desc(), HouseholdMealPlan.id.desc())
        .limit(120)
        .all()
    )
    return [_meal_plan_to_read(r) for r in rows]


@router.put("/meal-plans/{day_key}", response_model=MealPlanRead)
def upsert_meal_plan(
    day_key: str,
    payload: MealPlanUpsert,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    key = day_key.strip()
    if not _DAY_KEY_RE.match(key):
        raise api_error("invalid_meal_day", "Date invalide (YYYY-MM-DD).", 400)
    missing = [str(x).strip() for x in payload.missing if str(x).strip()][:50]
    row = (
        db.query(HouseholdMealPlan)
        .filter(HouseholdMealPlan.household_id == auth.household_id, HouseholdMealPlan.day_key == key)
        .first()
    )
    if row:
        row.lunch = payload.lunch.strip()
        row.dinner = payload.dinner.strip()
        row.missing_json = json.dumps(missing, ensure_ascii=False)
    else:
        row = HouseholdMealPlan(
            household_id=auth.household_id,
            day_key=key,
            lunch=payload.lunch.strip(),
            dinner=payload.dinner.strip(),
            missing_json=json.dumps(missing, ensure_ascii=False),
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return _meal_plan_to_read(row)


@router.delete("/meal-plans/{day_key}")
def delete_meal_plan(
    day_key: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    key = day_key.strip()
    if not _DAY_KEY_RE.match(key):
        raise api_error("invalid_meal_day", "Date invalide (YYYY-MM-DD).", 400)
    row = (
        db.query(HouseholdMealPlan)
        .filter(HouseholdMealPlan.household_id == auth.household_id, HouseholdMealPlan.day_key == key)
        .first()
    )
    if not row:
        raise api_error("meal_plan_not_found", "Plan repas introuvable.", 404)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


_DEFAULT_MOI_MOMENTS = [
    {"id": "m1", "label": "20 min de marche sans téléphone", "done": False},
    {"id": "m2", "label": "10 min respiration / méditation", "done": False},
    {"id": "m3", "label": "Lire 15 pages ce soir", "done": False},
]


def _normalize_moments(raw: list) -> list[dict]:
    out: list[dict] = []
    for item in raw[:30]:
        if not isinstance(item, dict):
            continue
        mid = str(item.get("id", "")).strip()
        label = str(item.get("label", "")).strip()
        if not mid or not label:
            continue
        out.append({"id": mid, "label": label, "done": bool(item.get("done"))})
    return out or list(_DEFAULT_MOI_MOMENTS)


def _moi_wellness_to_read(row: HouseholdMoiWellness) -> MoiWellnessRead:
    try:
        parsed = json.loads(row.moments_json or "[]")
        moments = _normalize_moments(parsed if isinstance(parsed, list) else [])
    except json.JSONDecodeError:
        moments = list(_DEFAULT_MOI_MOMENTS)
    return MoiWellnessRead(
        household_id=row.household_id,
        journal=row.journal_text or "",
        cycle_day=row.cycle_day,
        moments=moments,
        sleep_hours=float(row.sleep_hours if row.sleep_hours is not None else 7),
        moi_mood=int(row.moi_mood if row.moi_mood is not None else 3),
        home_mood=row.home_mood,
        updated_at=row.updated_at,
    )


def _get_or_create_moi_wellness(db: Session, household_id: int, user_id: int) -> HouseholdMoiWellness:
    row = (
        db.query(HouseholdMoiWellness)
        .filter(HouseholdMoiWellness.household_id == household_id, HouseholdMoiWellness.user_id == user_id)
        .first()
    )
    if row:
        return row
    legacy = (
        db.query(HouseholdMoiWellness)
        .filter(HouseholdMoiWellness.household_id == household_id, HouseholdMoiWellness.user_id.is_(None))
        .first()
    )
    if legacy:
        legacy.user_id = user_id
        db.commit()
        db.refresh(legacy)
        return legacy
    row = HouseholdMoiWellness(
        household_id=household_id,
        user_id=user_id,
        journal_text="",
        cycle_day=18,
        moments_json=json.dumps(_DEFAULT_MOI_MOMENTS, ensure_ascii=False),
        sleep_hours=7.0,
        moi_mood=3,
        home_mood=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/moi/wellness", response_model=MoiWellnessRead)
def get_moi_wellness(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    row = _get_or_create_moi_wellness(db, auth.household_id, auth.user_id)
    return _moi_wellness_to_read(row)


@router.put("/moi/wellness", response_model=MoiWellnessRead)
def put_moi_wellness(
    payload: MoiWellnessPut,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = _get_or_create_moi_wellness(db, auth.household_id, auth.user_id)
    moments = _normalize_moments([m.model_dump() for m in payload.moments])
    row.journal_text = payload.journal.strip()
    row.cycle_day = payload.cycle_day
    row.moments_json = json.dumps(moments, ensure_ascii=False)
    row.sleep_hours = float(payload.sleep_hours)
    row.moi_mood = int(payload.moi_mood)
    row.home_mood = payload.home_mood
    db.commit()
    db.refresh(row)
    return _moi_wellness_to_read(row)


_DAY_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_day_key(day: str) -> str:
    key = (day or "").strip()
    if not _DAY_KEY_RE.match(key):
        raise api_error("invalid_day_key", "Date invalide (format AAAA-MM-JJ).", 400)
    return key


def _maybe_import_legacy_journal(
    db: Session,
    auth: AuthContext,
    entries: list[JournalEntry],
) -> list[JournalEntry]:
    if entries:
        return entries
    wellness = (
        db.query(HouseholdMoiWellness)
        .filter(HouseholdMoiWellness.household_id == auth.household_id)
        .first()
    )
    legacy = (wellness.journal_text or "").strip() if wellness else ""
    if len(legacy) < 2:
        return entries
    today = datetime.now().strftime("%Y-%m-%d")
    row = JournalEntry(
        household_id=auth.household_id,
        user_id=auth.user_id,
        entry_date=today,
        content=legacy[:12000],
    )
    db.add(row)
    if wellness:
        wellness.journal_text = ""
    db.commit()
    db.refresh(row)
    return [row]


@router.get("/journal/entries", response_model=list[JournalEntryRead])
def list_journal_entries(
    from_day: str | None = Query(default=None, alias="from"),
    to_day: str | None = Query(default=None, alias="to"),
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    q = db.query(JournalEntry).filter(
        JournalEntry.user_id == auth.user_id,
        JournalEntry.household_id == auth.household_id,
    )
    if from_day:
        q = q.filter(JournalEntry.entry_date >= _validate_day_key(from_day))
    if to_day:
        q = q.filter(JournalEntry.entry_date <= _validate_day_key(to_day))
    rows = q.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).limit(400).all()
    rows = _maybe_import_legacy_journal(db, auth, rows)
    return [
        JournalEntryRead(
            id=r.id,
            entry_date=r.entry_date,
            content=r.content or "",
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/journal/entries", response_model=JournalEntryRead, status_code=201)
def create_journal_entry(
    payload: JournalEntryCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    day = _validate_day_key(payload.entry_date)
    content = payload.content.strip()
    if not content:
        raise api_error("journal_empty", "Écris au moins une phrase.", 400)
    row = JournalEntry(
        household_id=auth.household_id,
        user_id=auth.user_id,
        entry_date=day,
        content=content[:12000],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return JournalEntryRead(
        id=row.id,
        entry_date=row.entry_date,
        content=row.content,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.patch("/journal/entries/{entry_id}", response_model=JournalEntryRead)
def update_journal_entry(
    entry_id: int,
    payload: JournalEntryUpdate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(JournalEntry, entry_id)
    if not row or row.user_id != auth.user_id or row.household_id != auth.household_id:
        raise api_error("journal_not_found", "Entrée introuvable.", 404)
    if payload.entry_date is not None:
        row.entry_date = _validate_day_key(payload.entry_date)
    if payload.content is not None:
        text = payload.content.strip()
        if not text:
            raise api_error("journal_empty", "Écris au moins une phrase.", 400)
        row.content = text[:12000]
    db.commit()
    db.refresh(row)
    return JournalEntryRead(
        id=row.id,
        entry_date=row.entry_date,
        content=row.content,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete("/journal/entries/{entry_id}", status_code=204)
def delete_journal_entry(
    entry_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    row = db.get(JournalEntry, entry_id)
    if not row or row.user_id != auth.user_id or row.household_id != auth.household_id:
        raise api_error("journal_not_found", "Entrée introuvable.", 404)
    db.delete(row)
    db.commit()
    return Response(status_code=204)


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
    return DocumentStorageSummary(
        used_bytes=used,
        quota_bytes=quota_bytes,
        encryption_at_rest=vault_encryption_enabled(),
    )


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
        body = doc_attach.read_bytes(row.attachment_storage_key)
    except FileNotFoundError:
        raise api_error("attachment_missing", "Fichier absent du serveur.", 404)
    except ValueError:
        raise api_error("attachment_corrupt", "Fichier chiffré illisible (clé serveur ?).", 500)
    fname = row.attachment_original_name or "piece-jointe"
    media = row.attachment_mime or "application/octet-stream"
    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


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
    if command_wants_shopping_plan(payload.command):
        return build_shopping_plan_response(
            payload.command,
            db,
            auth.household_id,
            memory_lines=mem,
            user_id=auth.user_id,
        )
    if command_wants_household_answer(payload.command):
        return build_household_answer(
            payload.command,
            db,
            auth.household_id,
            auth.user_id,
            memory_lines=mem,
        )
    return interpret_command(payload.command, memory_lines=mem)


@router.post("/agent/analyze-file", response_model=AgentInterpretResponse)
async def agent_analyze_file(
    file: UploadFile = File(...),
    command: str = Form(default=""),
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    """Analyse une photo ou un document (PDF, Word, texte) pour Alfred."""
    max_bytes = max(1, settings.attachment_max_mb) * 1024 * 1024
    body = await file.read()
    if len(body) > max_bytes:
        raise api_error("attachment_too_large", "Fichier trop volumineux.", 413)
    if len(body) < 8:
        raise api_error("attachment_empty", "Fichier vide.", 400)
    orig = Path(file.filename or "piece-jointe").name.replace("\x00", "")[:255] or "piece-jointe"
    mime = resolve_attachment_mime(orig, file.content_type)
    if mime not in ALFRED_ATTACHMENT_MIME:
        raise api_error(
            "attachment_type_not_allowed",
            "Type non autorisé (JPEG, PNG, WebP, GIF, PDF, Word DOCX ou texte).",
            415,
        )
    mem = household_memory_lines(db, auth.household_id)
    return analyze_alfred_attachment(body, mime, orig, command[:4000], mem)


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
    return execute_agent_act(
        payload.command,
        db,
        auth,
        mem,
        force_execute=bool(payload.force_execute),
    )


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


@router.get("/home/providers", response_model=HomeProvidersResponse)
def home_providers(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return get_home_providers(db=db, user_id=auth.user_id)


@router.post("/home/providers/home_assistant/connect", response_model=HomeAssistantConnectResponse)
def home_assistant_connect(
    payload: HomeAssistantConnectRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    account = connect_home_assistant(
        db=db,
        user_id=auth.user_id,
        base_url=payload.base_url,
        access_token=payload.access_token,
    )
    diag = diagnose_home_assistant(db=db, user_id=auth.user_id)
    return HomeAssistantConnectResponse(
        id=account.id,
        provider=account.provider,
        status=account.status,
        diagnostic=diag,
    )


@router.post("/home/providers/connect", response_model=ConnectedAccountRead)
def home_provider_connect(
    payload: HomeProviderConnectRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    account = connect_home_provider(
        db=db,
        user_id=auth.user_id,
        provider=payload.provider,
        external_account_id=payload.external_account_id,
        status=payload.status,
    )
    if account is None:
        raise api_error("provider_not_supported", "Provider domotique non supporté.", 400)
    return account


@router.post("/home/providers/credentials", response_model=ConnectedAccountRead)
def home_provider_credentials(
    payload: HomeProviderCredentialsUpsertRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    account = upsert_home_provider_credentials(
        db=db,
        user_id=auth.user_id,
        provider=payload.provider,
        username=payload.username,
        password=payload.password,
        pin=payload.pin,
        access_token=payload.access_token,
        base_url=payload.base_url,
        external_account_id=payload.external_account_id,
    )
    if account is None:
        raise api_error("provider_not_supported", "Provider domotique non supporté.", 400)
    return account


@router.get("/home/providers/home_assistant/diagnostic", response_model=HomeAssistantDiagnosticResponse)
def home_assistant_diagnostic(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return diagnose_home_assistant(db=db, user_id=auth.user_id)


@router.get("/home/providers/{provider}/test", response_model=HomeProviderTestResponse)
def home_provider_test(
    provider: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return test_home_provider_connection(db=db, user_id=auth.user_id, provider=provider)


@router.post("/home/providers/verisure/alarm", response_model=HomeProviderTestResponse)
def verisure_alarm_action(
    payload: VerisureAlarmRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    out = execute_verisure_alarm_by_action(
        db,
        auth.user_id,
        payload.action,
        pin=payload.pin,
    )
    return HomeProviderTestResponse(
        provider="verisure",
        status=str(out.get("status") or "failed"),
        message=str(out.get("message") or "Action Verisure terminée."),
    )


@router.get("/home/providers/{provider}/devices", response_model=HomeProviderDevicesResponse)
def home_provider_devices(
    provider: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return list_provider_devices(db=db, user_id=auth.user_id, provider=provider)


@router.post(
    "/home/providers/{provider}/devices/{device_id}/action",
    response_model=HomeProviderDeviceActionResponse,
)
def home_provider_device_action(
    provider: str,
    device_id: str,
    payload: HomeProviderDeviceActionRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return execute_provider_device_action(
        db=db,
        user_id=auth.user_id,
        provider=provider,
        device_id=device_id,
        action=payload.action,
    )


@router.get("/home/device-groups", response_model=HomeDeviceGroupsResponse)
def home_device_groups(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return list_device_groups(db=db, user_id=auth.user_id)


@router.put("/home/device-groups/{group_name}", response_model=HomeDeviceGroupsResponse)
def home_device_group_upsert(
    group_name: str,
    payload: HomeDeviceGroupUpsertRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return upsert_device_group(
        db=db,
        user_id=auth.user_id,
        group_name=group_name,
        provider=payload.provider,
        device_ids=payload.device_ids,
    )


@router.delete("/home/device-groups/{group_name}", response_model=HomeDeviceGroupsResponse)
def home_device_group_delete(
    group_name: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return delete_device_group(db=db, user_id=auth.user_id, group_name=group_name)


@router.post("/home/device-groups/{group_name}/members", response_model=HomeDeviceGroupsResponse)
def home_device_group_members_update(
    group_name: str,
    payload: HomeDeviceGroupMembersUpdateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return update_device_group_members(
        db=db,
        user_id=auth.user_id,
        group_name=group_name,
        operation=payload.operation,
        provider=payload.provider,
        device_ids=payload.device_ids,
    )


@router.post("/home/device-groups/{group_name}/rename", response_model=HomeDeviceGroupsResponse)
def home_device_group_rename(
    group_name: str,
    payload: HomeDeviceGroupRenameRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return rename_device_group(
        db=db,
        user_id=auth.user_id,
        group_name=group_name,
        new_name=payload.new_name,
    )


@router.post("/home/device-groups/{group_name}/duplicate", response_model=HomeDeviceGroupsResponse)
def home_device_group_duplicate(
    group_name: str,
    payload: HomeDeviceGroupDuplicateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return duplicate_device_group(
        db=db,
        user_id=auth.user_id,
        group_name=group_name,
        new_name=payload.new_name,
    )


@router.post("/home/device-groups/{group_name}/action", response_model=HomeDeviceGroupActionResponse)
def home_device_group_action(
    group_name: str,
    payload: HomeDeviceGroupActionRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return execute_device_group_action(
        db=db,
        user_id=auth.user_id,
        group_name=group_name,
        action=payload.action,
    )


@router.post("/home/devices/control", response_model=HomeDeviceControlResponse)
def home_device_control(
    payload: HomeDeviceControlRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    return execute_device_control(
        db=db,
        user_id=auth.user_id,
        provider=payload.provider,
        capability=payload.capability,
        action=payload.action,
        target=payload.target,
    )


@router.post("/home/scenes/{scene_id}/execute", response_model=HomeSceneResponse)
def home_scene(scene_id: str, auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    if not re.fullmatch(r"[a-zA-Z0-9_\-]{1,64}", scene_id):
        raise api_error("invalid_scene_id", "Scene id format is invalid.", 400)
    return execute_scene(scene_id, db=db, user_id=auth.user_id)


@router.get("/vault/secrets", response_model=UserVaultSecretsListResponse)
def vault_secrets_list(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    return list_user_vault_secrets(db=db, user_id=auth.user_id)


@router.post("/vault/secrets", response_model=UserVaultSecretRead)
def vault_secret_create(
    payload: UserVaultSecretCreate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    try:
        return create_user_vault_secret(
            db=db,
            user_id=auth.user_id,
            label=payload.label,
            service_key=payload.service_key,
            username=payload.username,
            password=payload.password,
            login_url=payload.login_url,
            notes=payload.notes,
        )
    except ValueError as exc:
        if str(exc) == "label_required":
            raise api_error("label_required", "Le libellé du secret est obligatoire.", 400)
        raise


@router.patch("/vault/secrets/{secret_id}", response_model=UserVaultSecretRead)
def vault_secret_patch(
    secret_id: int,
    payload: UserVaultSecretPatch,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    try:
        out = update_user_vault_secret(
            db=db,
            user_id=auth.user_id,
            secret_id=secret_id,
            label=payload.label,
            service_key=payload.service_key,
            username=payload.username,
            password=payload.password,
            login_url=payload.login_url,
            notes=payload.notes,
        )
    except ValueError as exc:
        if str(exc) == "label_required":
            raise api_error("label_required", "Le libellé du secret est obligatoire.", 400)
        raise
    if out is None:
        raise api_error("secret_not_found", "Secret introuvable.", 404)
    return out


@router.delete("/vault/secrets/{secret_id}")
def vault_secret_delete(
    secret_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    if not delete_user_vault_secret(db=db, user_id=auth.user_id, secret_id=secret_id):
        raise api_error("secret_not_found", "Secret introuvable.", 404)
    return {"status": "deleted"}


@router.post("/vault/secrets/{secret_id}/reveal", response_model=UserVaultSecretRevealResponse)
def vault_secret_reveal(
    secret_id: int,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    out = reveal_user_vault_secret_password(db=db, user_id=auth.user_id, secret_id=secret_id)
    if out is None:
        raise api_error("secret_not_found", "Secret introuvable.", 404)
    return out


@router.get("/vault/drive/status", response_model=DriveStatusListResponse)
def vault_drive_status(
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    return list_drive_status(db=db, user_id=auth.user_id)


@router.post("/vault/drive/{service_key}/prepare", response_model=DrivePrepareResponse)
def vault_drive_prepare(
    service_key: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    return prepare_drive_session(
        db=db,
        user_id=auth.user_id,
        service_key=service_key,
        household_id=auth.household_id,
    )


@router.post("/vault/drive/{service_key}/automate-login", response_model=DriveAutomateLoginResponse)
def vault_drive_automate_login(
    service_key: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    return automate_drive_login(db=db, user_id=auth.user_id, service_key=service_key)


@router.post("/vault/drive/{service_key}/fill-cart", response_model=DriveFillCartResponse)
def vault_drive_fill_cart(
    service_key: str,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    if not settings.vault_secrets_enabled:
        raise api_error("vault_disabled", "Cette fonctionnalité n'est pas encore disponible.", 403)
    return fill_drive_cart(
        db=db,
        user_id=auth.user_id,
        service_key=service_key,
        household_id=auth.household_id,
    )
