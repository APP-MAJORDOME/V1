from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class APIError(BaseModel):
    code: str
    message: str


class HouseholdRead(BaseModel):
    id: int
    name: str
    owner_user_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HouseholdMemberRead(BaseModel):
    id: int
    household_id: int
    display_name: str
    role: str
    birth_year: int | None = None
    preferences_json: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectedAccountRead(BaseModel):
    """Compte connecté exposé à l’API — sans secrets OAuth (stockés côté serveur uniquement)."""

    id: int
    user_id: int | None = None
    provider: str
    external_account_id: str | None = None
    status: str
    last_sync_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CanonicalEventRead(BaseModel):
    id: int
    household_id: int | None = None
    member_id: int | None = None
    title: str
    description: str | None = None
    location: str | None = None
    category: str
    starts_at: datetime
    ends_at: datetime
    timezone: str
    importance: str
    flexibility: str
    source_provider: str | None = None
    source_event_id: str | None = None
    raw_payload_json: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskRead(BaseModel):
    id: int
    household_id: int | None = None
    assigned_member_id: int | None = None
    title: str
    description: str | None = None
    status: str
    task_type: str
    due_at: datetime | None = None
    recurrence_rule: str | None = None
    context_tags_json: str
    origin: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskSummaryResponse(BaseModel):
    open_count: int
    done_count: int


class RoutineRead(BaseModel):
    id: int
    household_id: int | None = None
    name: str
    trigger_type: str
    rrule: str | None = None
    config_json: str
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OpportunityRead(BaseModel):
    id: int
    household_id: int | None = None
    category: str
    title: str
    summary: str
    score: float
    source_url: str | None = None
    status: str
    recommended_action: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountSyncResponse(BaseModel):
    account_id: int
    provider: str
    status: str


class ConflictItem(BaseModel):
    event_a: int
    event_b: int
    title_a: str
    title_b: str
    starts_at: str
    next_starts_at: str
    overlap_minutes: int | None = None
    severity: str | None = None


class EventConflictsResponse(BaseModel):
    conflicts: list[ConflictItem]


class TodayBriefingResponse(BaseModel):
    generated_at: str
    events_count: int
    tasks_count: int
    opportunities_count: int
    conflicts_count: int | None = None
    highlights: list[str]
    priorities: list[str] | None = None


class AgentInterpretResponse(BaseModel):
    intent: str
    mode: str
    proposal: dict[str, Any]
    explanation: str


class AgentActResponse(BaseModel):
    status: str
    preview: AgentInterpretResponse
    message: str | None = None
    result: dict[str, Any] | None = None


class HomeStatusResponse(BaseModel):
    mode: str
    lights_on: int
    energy_alert: bool
    robot_last_run_hours: int
    recommended_actions: list[str]


class HomeSceneResponse(BaseModel):
    scene_id: str
    status: str


class GoogleOAuthStartResponse(BaseModel):
    authorization_url: str
    state: str


class GoogleOAuthCallbackResponse(BaseModel):
    status: str
    account_id: int
    provider: str


class IntegrationStatusResponse(BaseModel):
    provider: str
    configured: bool
    connected: bool
    status: str


class IntegrationCapabilitiesResponse(BaseModel):
    """Capacités réelles du serveur (pas les préférences utilisateur)."""

    apple_caldav_available: bool


class DocumentStorageSummary(BaseModel):
    used_bytes: int
    quota_bytes: int | None = None


class HouseholdDocumentRead(BaseModel):
    id: int
    household_id: int
    icon: str
    name: str
    category: str
    date_label: str | None = None
    expires_at: datetime | None = None
    who: str | None = None
    urgent: bool = False
    notes: str | None = None
    attachment_original_name: str | None = None
    attachment_mime: str | None = None
    attachment_size_bytes: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HouseholdDocumentCreate(BaseModel):
    icon: str = "📄"
    name: str = Field(min_length=1, max_length=512)
    category: str = Field(default="Divers", max_length=128)
    date_label: str | None = Field(default=None, max_length=128)
    expires_at: datetime | None = None
    who: str | None = Field(default=None, max_length=255)
    urgent: bool = False
    notes: str | None = None


class HouseholdDocumentUpdate(BaseModel):
    icon: str | None = Field(default=None, max_length=16)
    name: str | None = Field(default=None, max_length=512)
    category: str | None = Field(default=None, max_length=128)
    date_label: str | None = Field(default=None, max_length=128)
    expires_at: datetime | None = None
    who: str | None = Field(default=None, max_length=255)
    urgent: bool | None = None
    notes: str | None = None


class DocumentBootstrapRequest(BaseModel):
    prenom: str = Field(default="Joanne", max_length=80)
    partenaire: str = Field(default="Alexandre", max_length=80)
    enfant: str = Field(default="Léa", max_length=80)


class DocumentBootstrapResponse(BaseModel):
    created: int


class HouseholdCreate(BaseModel):
    name: str


class HouseholdMemberCreate(BaseModel):
    display_name: str
    role: str = "adult_member"
    birth_year: int | None = None


class ConnectedAccountCreate(BaseModel):
    provider: Literal["google_calendar", "microsoft_calendar", "apple_calendar", "home_assistant"]
    external_account_id: str | None = None
    status: Literal["connected", "reauth_required", "disconnected"] = "connected"


class EventCreate(BaseModel):
    household_id: int | None = None
    member_id: int | None = None
    title: str
    description: str | None = None
    location: str | None = None
    category: str = "general"
    starts_at: datetime
    ends_at: datetime
    timezone: str = "Europe/Paris"
    importance: str = "normal"
    flexibility: str = "fixed"
    source_provider: str | None = None
    source_event_id: str | None = None


class TaskCreate(BaseModel):
    household_id: int | None = None
    assigned_member_id: int | None = None
    title: str
    description: str | None = None
    task_type: str = "manual_task"
    due_at: datetime | None = None
    recurrence_rule: str | None = None


class TaskPatch(BaseModel):
    """Mise à jour partielle ; n’envoyer que les champs à modifier."""

    assigned_member_id: int | None = None
    status: Literal["open", "done"] | None = None


class GroceryItemRead(BaseModel):
    id: int
    household_id: int
    label: str
    done: bool
    delegated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GroceryItemCreate(BaseModel):
    label: str = Field(min_length=1, max_length=512)


class GroceryItemPatch(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=512)
    done: bool | None = None
    delegated: bool | None = None


class FridgeItemRead(BaseModel):
    id: int
    household_id: int
    label: str
    expires_at: datetime
    qty: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FridgeItemCreate(BaseModel):
    label: str = Field(min_length=1, max_length=512)
    expires_at: datetime
    qty: int = Field(default=1, ge=1, le=999)


class FridgeItemPatch(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=512)
    expires_at: datetime | None = None
    qty: int | None = Field(None, ge=1, le=999)


class WalletCardRead(BaseModel):
    id: int
    household_id: int
    brand: str
    points: int
    color: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WalletCardCreate(BaseModel):
    brand: str = Field(min_length=1, max_length=255)
    points: int = Field(default=0, ge=0, le=9_999_999)
    color: str = Field(default="#2B7A4B", min_length=4, max_length=32)


class WalletCardPatch(BaseModel):
    brand: str | None = Field(None, min_length=1, max_length=255)
    points: int | None = Field(None, ge=0, le=9_999_999)
    color: str | None = Field(None, min_length=4, max_length=32)


class CouponRead(BaseModel):
    id: int
    household_id: int
    label: str
    expires_at: datetime
    discount: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CouponCreate(BaseModel):
    label: str = Field(min_length=1, max_length=512)
    expires_at: datetime
    discount: str = Field(min_length=1, max_length=64)


class CouponPatch(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=512)
    expires_at: datetime | None = None
    discount: str | None = Field(None, min_length=1, max_length=64)


class BudgetEnvelopeRead(BaseModel):
    id: int
    household_id: int
    slug: str
    label: str
    spent: int
    budget_cap: int
    color: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetEnvelopeCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=255)
    spent: int = Field(default=0, ge=0, le=9_999_999)
    budget_cap: int = Field(default=0, ge=0, le=9_999_999)
    color: str = Field(default="#6BA898", min_length=4, max_length=32)


class BudgetEnvelopePatch(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=255)
    spent: int | None = Field(None, ge=0, le=9_999_999)
    budget_cap: int | None = Field(None, ge=0, le=9_999_999)
    color: str | None = Field(None, min_length=4, max_length=32)


class MealPlanRead(BaseModel):
    id: int
    household_id: int
    day_key: str
    lunch: str
    dinner: str
    missing: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MealPlanUpsert(BaseModel):
    lunch: str = Field(default="", max_length=2000)
    dinner: str = Field(default="", max_length=2000)
    missing: list[str] = Field(default_factory=list)


class MoiMomentItem(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=512)
    done: bool = False


class MoiWellnessRead(BaseModel):
    household_id: int
    journal: str
    cycle_day: int
    moments: list[MoiMomentItem]
    sleep_hours: float
    moi_mood: int
    home_mood: int | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class MoiWellnessPut(BaseModel):
    journal: str = Field(default="", max_length=8000)
    cycle_day: int = Field(default=18, ge=1, le=28)
    moments: list[MoiMomentItem] = Field(default_factory=list)
    sleep_hours: float = Field(default=7, ge=3, le=11)
    moi_mood: int = Field(default=3, ge=0, le=4)
    home_mood: int | None = Field(default=None, ge=0, le=4)


class JournalEntryRead(BaseModel):
    id: int
    entry_date: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryCreate(BaseModel):
    entry_date: str = Field(min_length=10, max_length=10)
    content: str = Field(min_length=1, max_length=12000)


class JournalEntryUpdate(BaseModel):
    entry_date: str | None = Field(default=None, min_length=10, max_length=10)
    content: str | None = Field(default=None, min_length=1, max_length=12000)


class RoutineCreate(BaseModel):
    household_id: int | None = None
    name: str
    trigger_type: str = "recurring"
    rrule: str | None = None
    config_json: str = "{}"
    enabled: bool = True


class OpportunityCreate(BaseModel):
    household_id: int | None = None
    category: str = "general"
    title: str
    summary: str
    score: float = Field(default=0.5, ge=0, le=1)
    source_url: str | None = None
    recommended_action: str | None = None


class AgentCommand(BaseModel):
    command: str = Field(min_length=1, max_length=4000)
    household_id: int | None = None


class AgentRealtimeWebRtcRequest(BaseModel):
    """SDP offer WebRTC pour une session OpenAI Realtime (voix native)."""

    sdp: str = Field(min_length=10, max_length=200_000)
    assistant_display_name: str = Field(default="Alfred", max_length=80)
    extra_memory_notes: list[str] = Field(default_factory=list, max_length=24)


class AgentRealtimeWebRtcResponse(BaseModel):
    sdp: str


class AgentRealtimeStatusResponse(BaseModel):
    """Indique si la voix Realtime peut être utilisée (clé OpenAI présente côté serveur)."""

    configured: bool
    model: str
    voice: str


class DebordeeRequest(BaseModel):
    task_titles: list[str] = Field(default_factory=list, max_length=80)
    primary_name: str = Field(default="Joanne", max_length=80)
    partner_name: str = Field(default="Alexandre", max_length=80)
    child_name: str = Field(default="Léa", max_length=80)


class DebordeeResponse(BaseModel):
    critique: list[str]
    deleguer: list[str]
    supprimer: list[str]
    message: str


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = "Utilisateur MajorDome"
    household_id: int | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = "Utilisateur MajorDome"


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    household_id: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class LogoutResponse(BaseModel):
    status: str


class PartnerDelegationItem(BaseModel):
    task_id: int | None = None
    title: str = Field(min_length=1, max_length=512)


class PartnerDelegationNotifyRequest(BaseModel):
    partner_name: str = Field(min_length=1, max_length=120)
    partner_contact: str | None = Field(default=None, max_length=255)
    items: list[PartnerDelegationItem] = Field(min_length=1, max_length=25)


class PartnerDelegationNotifyResponse(BaseModel):
    id: int
    ack_url: str
    status: str
    channels: list[str]
    message_preview: str
    tasks_assigned: int = 0


class HouseholdMembersProfileSyncRequest(BaseModel):
    """Prénoms du profil famille local — alignés sur les membres du foyer pour inbox partenaire et attribution."""

    primary_name: str = Field(default="", max_length=80)
    partner_name: str = Field(default="", max_length=80)
    child_name: str = Field(default="", max_length=80)


class HouseholdMemoryFactCreate(BaseModel):
    fact_text: str = Field(min_length=3, max_length=500)


class HouseholdMemoryFactRead(BaseModel):
    id: int
    household_id: int
    fact_text: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartnerDelegationRead(BaseModel):
    id: int
    household_id: int
    partner_display_name: str
    partner_contact: str | None = None
    task_snapshot_json: str = "[]"
    status: str
    acknowledged_at: datetime | None = None
    last_sent_at: datetime | None = None
    reminder_count: int = 0
    next_reminder_at: datetime | None = None
    delivery_channels_json: str = "[]"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
