from datetime import datetime
from sqlalchemy import ForeignKey, Index, String, Integer, Boolean, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.core.dt import utc_now_naive


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Paris")
    locale: Mapped[str] = mapped_column(String(16), default="fr-FR")


class Household(Base, TimestampMixin):
    __tablename__ = "households"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class HouseholdMember(Base, TimestampMixin):
    __tablename__ = "household_members"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(64), default="adult_member")
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferences_json: Mapped[str] = mapped_column(Text, default="{}")


class ConnectedAccount(Base, TimestampMixin):
    __tablename__ = "connected_accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(128), index=True)
    external_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scopes_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(32), default="connected")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CanonicalEvent(Base, TimestampMixin):
    __tablename__ = "canonical_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("household_members.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(64), default="general")
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Paris")
    importance: Mapped[str] = mapped_column(String(32), default="normal")
    flexibility: Mapped[str] = mapped_column(String(32), default="fixed")
    source_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload_json: Mapped[str] = mapped_column(Text, default="{}")


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_household_status_updated", "household_id", "status", "updated_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    assigned_member_id: Mapped[int | None] = mapped_column(ForeignKey("household_members.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open")
    task_type: Mapped[str] = mapped_column(String(64), default="manual_task")
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    context_tags_json: Mapped[str] = mapped_column(Text, default="[]")
    origin: Mapped[str] = mapped_column(String(64), default="manual")


class Routine(Base, TimestampMixin):
    __tablename__ = "routines"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    trigger_type: Mapped[str] = mapped_column(String(64), default="recurring")
    rrule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Opportunity(Base, TimestampMixin):
    __tablename__ = "opportunities"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(64), default="general")
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    score: Mapped[float] = mapped_column(Float, default=0.5)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new")
    recommended_action: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ActionProposal(Base, TimestampMixin):
    __tablename__ = "action_proposals"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    proposal_type: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(32), default="confirm")
    title: Mapped[str] = mapped_column(String(255))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="proposed")


class HouseholdMemoryFact(Base, TimestampMixin):
    """Faits contextualisés du foyer (injectés dans prompts agent)."""

    __tablename__ = "household_memory_facts"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    fact_text: Mapped[str] = mapped_column(Text)


class GroceryItem(Base, TimestampMixin):
    """Article de la liste de courses partagée par foyer."""

    __tablename__ = "household_grocery_items"
    __table_args__ = (Index("ix_household_grocery_items_household_done", "household_id", "done"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    label: Mapped[str] = mapped_column(String(512))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    delegated: Mapped[bool] = mapped_column(Boolean, default=False)


class HouseholdFridgeItem(Base, TimestampMixin):
    """Produit suivi dans le frigo du foyer (DLC)."""

    __tablename__ = "household_fridge_items"
    __table_args__ = (Index("ix_household_fridge_items_household_expires", "household_id", "expires_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    label: Mapped[str] = mapped_column(String(512))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    qty: Mapped[int] = mapped_column(Integer, default=1)


class HouseholdWalletCard(Base, TimestampMixin):
    __tablename__ = "household_wallet_cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    brand: Mapped[str] = mapped_column(String(255))
    points: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(32), default="#2B7A4B")


class HouseholdCoupon(Base, TimestampMixin):
    __tablename__ = "household_coupons"
    __table_args__ = (Index("ix_household_coupons_household_expires", "household_id", "expires_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    label: Mapped[str] = mapped_column(String(512))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    discount: Mapped[str] = mapped_column(String(64))


class HouseholdBudgetEnvelope(Base, TimestampMixin):
    __tablename__ = "household_budget_envelopes"
    __table_args__ = (Index("ix_household_budget_envelopes_household_slug", "household_id", "slug", unique=True),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    slug: Mapped[str] = mapped_column(String(64))
    label: Mapped[str] = mapped_column(String(255))
    spent: Mapped[int] = mapped_column(Integer, default=0)
    budget_cap: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(32), default="#6BA898")


class HouseholdMealPlan(Base, TimestampMixin):
    __tablename__ = "household_meal_plans"
    __table_args__ = (Index("ix_household_meal_plans_household_day", "household_id", "day_key", unique=True),)
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    day_key: Mapped[str] = mapped_column(String(10))
    lunch: Mapped[str] = mapped_column(Text, default="")
    dinner: Mapped[str] = mapped_column(Text, default="")
    missing_json: Mapped[str] = mapped_column(Text, default="[]")


class HouseholdMoiWellness(Base, TimestampMixin):
    """Journal, cycle et moments « pour toi » partagés au niveau du foyer."""

    __tablename__ = "household_moi_wellness"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), unique=True, index=True)
    journal_text: Mapped[str] = mapped_column(Text, default="")
    cycle_day: Mapped[int] = mapped_column(Integer, default=18)
    moments_json: Mapped[str] = mapped_column(Text, default="[]")
    sleep_hours: Mapped[float] = mapped_column(Float, default=7.0)
    moi_mood: Mapped[int] = mapped_column(Integer, default=3)
    home_mood: Mapped[int | None] = mapped_column(Integer, nullable=True)


class TaskDelegation(Base, TimestampMixin):
    """Délégation notifiée au partenaire (tâches + lien d’accusé + relances worker)."""

    __tablename__ = "task_delegations"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    partner_display_name: Mapped[str] = mapped_column(String(255))
    partner_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    task_snapshot_json: Mapped[str] = mapped_column(Text, default="[]")
    ack_token: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="sent")
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    next_reminder_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    delivery_channels_json: Mapped[str] = mapped_column(Text, default="[]")


class HouseholdDocument(Base, TimestampMixin):
    """Documents familiaux isolés par foyer (accès via JWT household_id)."""

    __tablename__ = "household_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    icon: Mapped[str] = mapped_column(String(16), default="📄")
    name: Mapped[str] = mapped_column(String(512))
    category: Mapped[str] = mapped_column(String(128), default="Divers")
    date_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    who: Mapped[str | None] = mapped_column(String(255), nullable=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_original_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    attachment_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)


class JournalEntry(Base, TimestampMixin):
    """Entrées du journal intime (privées par utilisateur, consultables par date)."""

    __tablename__ = "journal_entries"
    __table_args__ = (Index("ix_journal_entries_user_date", "user_id", "entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entry_date: Mapped[str] = mapped_column(String(10), index=True)
    content: Mapped[str] = mapped_column(Text, default="")


class UserVaultSecret(Base, TimestampMixin):
    """Identifiants chiffrés pour intégrations externes (Drive, enseignes, etc.)."""

    __tablename__ = "user_vault_secrets"
    __table_args__ = (Index("ix_user_vault_secrets_user_service", "user_id", "service_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(255))
    service_key: Mapped[str] = mapped_column(String(64), default="other")
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_blob: Mapped[str] = mapped_column(Text, default="")
    login_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int | None] = mapped_column(ForeignKey("households.id"), nullable=True, index=True)
    actor_type: Mapped[str] = mapped_column(String(64))
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
