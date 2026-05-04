import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force a local sqlite DB for tests before importing app modules.
TEST_DB_PATH = Path(__file__).resolve().parent / "test_auth_scope.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.models.models import Base  # noqa: E402


engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.SessionLocal = TestingSessionLocal
Base.metadata.create_all(bind=engine)


def _cleanup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _login(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "test12345", "full_name": "Test User"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_requires_bearer_token_for_protected_routes():
    client = TestClient(app)
    response = client.get("/api/v1/events")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "missing_bearer_token"


def test_integrations_capabilities_returns_apple_caldav_flag():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "cap@majordome.test")
    r = client.get("/api/v1/integrations/capabilities", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert "apple_caldav_available" in data
    assert isinstance(data["apple_caldav_available"], bool)


def test_tasks_summary_returns_counts():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "summary@majordome.test")
    r = client.get("/api/v1/tasks/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["open_count"] == 0
    assert data["done_count"] == 0
    assert isinstance(data["open_count"], int)
    assert isinstance(data["done_count"], int)


def test_create_task_complete_and_summary_updates():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "tasksflow@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Acheter du lait", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    task_id = created.json()["id"]

    s1 = client.get("/api/v1/tasks/summary", headers=headers).json()
    assert s1["open_count"] == 1
    assert s1["done_count"] == 0

    open_rows = client.get("/api/v1/tasks?status=open&limit=10", headers=headers).json()
    assert len(open_rows) == 1
    assert open_rows[0]["id"] == task_id

    done = client.post(f"/api/v1/tasks/{task_id}/complete", headers=headers, json={})
    assert done.status_code == 200
    assert done.json()["status"] == "done"

    s2 = client.get("/api/v1/tasks/summary", headers=headers).json()
    assert s2["open_count"] == 0
    assert s2["done_count"] == 1


def test_patch_task_invalid_assignee_returns_400():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "badassign@majordome.test", "password": "test12345", "full_name": "X"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/v1/tasks", headers=headers, json={"title": "T", "task_type": "manual_task"})
    assert created.status_code == 200
    tid = created.json()["id"]
    pr = client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"assigned_member_id": 99_999})
    assert pr.status_code == 400
    assert pr.json()["detail"]["code"] == "invalid_assignee"


def test_patch_task_assign_to_household_member():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "assignok@majordome.test", "password": "test12345", "full_name": "Owner"},
    )
    assert login.status_code == 200
    body = login.json()
    token = body["access_token"]
    hid = body["household_id"]
    headers = {"Authorization": f"Bearer {token}"}
    mem = client.post(
        f"/api/v1/households/{hid}/members",
        headers=headers,
        json={"display_name": "Partenaire", "role": "partner_adult"},
    )
    assert mem.status_code == 200
    mid = mem.json()["id"]
    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Pour le partenaire", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    tid = created.json()["id"]
    patched = client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"assigned_member_id": mid})
    assert patched.status_code == 200
    assert patched.json()["assigned_member_id"] == mid


def test_patch_task_clears_assignee_with_null():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "clearassign@majordome.test", "password": "test12345", "full_name": "Owner"},
    )
    assert login.status_code == 200
    body = login.json()
    token = body["access_token"]
    hid = body["household_id"]
    headers = {"Authorization": f"Bearer {token}"}
    mem = client.post(
        f"/api/v1/households/{hid}/members",
        headers=headers,
        json={"display_name": "Alex", "role": "partner_adult"},
    )
    mid = mem.json()["id"]
    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Désassigner", "task_type": "manual_task"},
    )
    tid = created.json()["id"]
    assert (
        client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"assigned_member_id": mid}).status_code == 200
    )
    cleared = client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"assigned_member_id": None})
    assert cleared.status_code == 200
    assert cleared.json().get("assigned_member_id") is None


def test_memory_fact_create_list_delete():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "memoryfact@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/memory/facts",
        headers=headers,
        json={"fact_text": "Allergie arachides — épipen dans le sac à dos."},
    )
    assert created.status_code == 200
    fid = created.json()["id"]
    listed = client.get("/api/v1/memory/facts", headers=headers).json()
    assert any(x["id"] == fid for x in listed)
    deleted = client.delete(f"/api/v1/memory/facts/{fid}", headers=headers)
    assert deleted.status_code == 200
    listed2 = client.get("/api/v1/memory/facts", headers=headers).json()
    assert not any(x["id"] == fid for x in listed2)


def test_partner_inbox_returns_json_list():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "partnerinbox@majordome.test")
    r = client.get("/api/v1/tasks/partner-inbox", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_partner_inbox_query_returns_task_assigned_to_matching_member():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "pinboxfilter@majordome.test", "password": "test12345", "full_name": "Owner"},
    )
    assert login.status_code == 200
    body = login.json()
    token = body["access_token"]
    hid = body["household_id"]
    headers = {"Authorization": f"Bearer {token}"}
    mem = client.post(
        f"/api/v1/households/{hid}/members",
        headers=headers,
        json={"display_name": "Sam Dupont", "role": "partner_adult"},
    )
    assert mem.status_code == 200
    mid = mem.json()["id"]
    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Course Sam", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    tid = created.json()["id"]
    assert client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"assigned_member_id": mid}).status_code == 200
    rows = client.get("/api/v1/tasks/partner-inbox", params={"partner_name": "Sam"}, headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["id"] == tid


def test_partner_delegation_notify_owner_assigns_lists_and_public_ack():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "delegowner@majordome.test", "password": "test12345", "full_name": "Owner"},
    )
    assert login.status_code == 200
    body = login.json()
    token = body["access_token"]
    hid = body["household_id"]
    headers = {"Authorization": f"Bearer {token}"}
    mem = client.post(
        f"/api/v1/households/{hid}/members",
        headers=headers,
        json={"display_name": "Alex Partenaire", "role": "partner_adult"},
    )
    assert mem.status_code == 200
    mid = mem.json()["id"]
    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Rappel délégation", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    tid = created.json()["id"]
    notify = client.post(
        "/api/v1/delegations/partner-notify",
        headers=headers,
        json={
            "partner_name": "Alex",
            "partner_contact": None,
            "items": [{"task_id": tid, "title": "Rappel délégation"}],
        },
    )
    assert notify.status_code == 200
    nbody = notify.json()
    assert nbody["channels"] == ["log"]
    assert nbody["tasks_assigned"] == 1
    assert nbody["status"] == "sent"
    assert "ack_url" in nbody and "/public/partner-delegations/" in nbody["ack_url"]

    tasks = client.get("/api/v1/tasks?status=open", headers=headers).json()
    match = next((t for t in tasks if t["id"] == tid), None)
    assert match is not None
    assert match["assigned_member_id"] == mid

    dels = client.get("/api/v1/delegations", headers=headers).json()
    assert any(d["partner_display_name"] == "Alex" and d["status"] == "sent" for d in dels)

    path = urlparse(nbody["ack_url"]).path
    ack1 = client.get(path)
    assert ack1.status_code == 200
    assert "accusé" in ack1.text.lower()
    ack2 = client.get(path)
    assert ack2.status_code == 200
    assert "déjà" in ack2.text.lower() or "deja" in ack2.text.lower()


def test_partner_delegation_notify_non_owner_forbidden():
    _cleanup_db()
    client = TestClient(app)
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "delowna@majordome.test", "password": "test12345", "full_name": "A"},
    )
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "delownb@majordome.test", "password": "test12345", "full_name": "B"},
    )
    assert login_a.status_code == 200 and login_b.status_code == 200
    hid_a = login_a.json()["household_id"]
    uid_b = login_b.json()["user_id"]
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    created = client.post(
        "/api/v1/tasks",
        headers=headers_a,
        json={"title": "Tâche foyer A", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    tid = created.json()["id"]
    forged = create_access_token(user_id=uid_b, household_id=hid_a)
    bad = client.post(
        "/api/v1/delegations/partner-notify",
        headers={"Authorization": f"Bearer {forged}"},
        json={"partner_name": "X", "partner_contact": None, "items": [{"task_id": tid, "title": "X"}]},
    )
    assert bad.status_code == 403
    assert bad.json()["detail"]["code"] == "delegation_forbidden"


def test_households_list_get_one_and_members_empty_then_synced():
    _cleanup_db()
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "hhlist@majordome.test", "password": "test12345", "full_name": "Proprio"},
    )
    assert login.status_code == 200
    hid = login.json()["household_id"]
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    listed = client.get("/api/v1/households", headers=headers).json()
    assert len(listed) >= 1
    assert any(h["id"] == hid for h in listed)

    one = client.get(f"/api/v1/households/{hid}", headers=headers)
    assert one.status_code == 200
    assert one.json()["id"] == hid

    before = client.get("/api/v1/household/members", headers=headers).json()
    assert before == []

    synced = client.post(
        "/api/v1/household/profile/sync-members",
        headers=headers,
        json={"primary_name": "Jo", "partner_name": "Pat", "child_name": ""},
    )
    assert synced.status_code == 200
    body = synced.json()
    assert len(body) == 2
    roles = {m["display_name"]: m["role"] for m in body}
    assert roles["Jo"] == "primary_adult"
    assert roles["Pat"] == "partner_adult"

    members = client.get("/api/v1/household/members", headers=headers).json()
    assert len(members) == 2


def test_household_profile_sync_empty_names_returns_empty_list():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "syncempty@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/household/profile/sync-members",
        headers=headers,
        json={"primary_name": "", "partner_name": "", "child_name": ""},
    )
    assert r.status_code == 200
    assert r.json() == []


def test_get_other_users_household_returns_404():
    _cleanup_db()
    client = TestClient(app)
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "hha@majordome.test", "password": "test12345", "full_name": "A"},
    )
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "hhb@majordome.test", "password": "test12345", "full_name": "B"},
    )
    assert login_a.status_code == 200 and login_b.status_code == 200
    hid_b = login_b.json()["household_id"]
    token_a = login_a.json()["access_token"]
    r = client.get(f"/api/v1/households/{hid_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "household_not_found"


def test_household_profile_sync_forbidden_for_non_owner_token():
    _cleanup_db()
    client = TestClient(app)
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "syncown@majordome.test", "password": "test12345", "full_name": "A"},
    )
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "syncother@majordome.test", "password": "test12345", "full_name": "B"},
    )
    assert login_a.status_code == 200 and login_b.status_code == 200
    hid_a = login_a.json()["household_id"]
    uid_b = login_b.json()["user_id"]
    forged = create_access_token(user_id=uid_b, household_id=hid_a)
    r = client.post(
        "/api/v1/household/profile/sync-members",
        headers={"Authorization": f"Bearer {forged}"},
        json={"primary_name": "X", "partner_name": "", "child_name": ""},
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "household_forbidden"


def test_tasks_open_pagination_limit_and_offset():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "taskpage@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    ids = []
    for title in ("Tâche A", "Tâche B", "Tâche C"):
        r = client.post("/api/v1/tasks", headers=headers, json={"title": title, "task_type": "manual_task"})
        assert r.status_code == 200
        ids.append(r.json()["id"])
    p0 = client.get("/api/v1/tasks?status=open&limit=2&offset=0", headers=headers).json()
    p1 = client.get("/api/v1/tasks?status=open&limit=2&offset=2", headers=headers).json()
    assert len(p0) == 2
    assert len(p1) == 1
    # Tri updated_at desc, id desc → la dernière créée en premier
    assert p0[0]["id"] == ids[2]
    assert p0[1]["id"] == ids[1]
    assert p1[0]["id"] == ids[0]


def test_routines_list_create_and_list():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "routines@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/routines", headers=headers).json() == []
    created = client.post(
        "/api/v1/routines",
        headers=headers,
        json={"name": "Rangement samedi", "trigger_type": "weekly", "config_json": "{}", "enabled": True},
    )
    assert created.status_code == 200
    rid = created.json()["id"]
    rows = client.get("/api/v1/routines", headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["id"] == rid
    assert rows[0]["name"] == "Rangement samedi"


def test_opportunities_list_create_and_list():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "opps@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/opportunities", headers=headers).json() == []
    created = client.post(
        "/api/v1/opportunities",
        headers=headers,
        json={
            "title": "Aide à la garde",
            "summary": "Piste locale",
            "category": "family",
            "score": 0.7,
        },
    )
    assert created.status_code == 200
    oid = created.json()["id"]
    rows = client.get("/api/v1/opportunities", headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["id"] == oid
    assert rows[0]["title"] == "Aide à la garde"


def test_agent_interpret_returns_structured_payload():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "agentinterp@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/agent/interpret",
        headers=headers,
        json={"command": "écris un mail au médecin pour un rendez-vous"},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("intent"), str) and data["intent"].strip()
    assert isinstance(data.get("mode"), str) and data["mode"].strip()
    assert isinstance(data.get("proposal"), dict)


def test_agent_act_returns_not_implemented_with_preview():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "agentact@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/agent/act",
        headers=headers,
        json={"command": "mail pour l'école"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "not_implemented"
    preview = data.get("preview")
    assert isinstance(preview, dict)
    assert isinstance(preview.get("intent"), str) and preview["intent"].strip()


def test_agent_debordee_fallback_when_no_llm():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "debordee@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    titles = [f"Tâche numéro {i}" for i in range(1, 9)]
    r = client.post(
        "/api/v1/agent/debordee",
        headers=headers,
        json={"task_titles": titles, "primary_name": "Jo", "partner_name": "Pat", "child_name": "Léo"},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["critique"], list)
    assert isinstance(data["deleguer"], list)
    assert isinstance(data["supprimer"], list)
    assert isinstance(data["message"], str)
    assert len(data["critique"]) <= 2
    assert data["message"]


def test_integrations_status_has_core_providers():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "integstatus@majordome.test")
    r = client.get("/api/v1/integrations/status", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    providers = {x["provider"] for x in rows}
    assert providers >= {"google_calendar", "apple_calendar", "home_assistant", "openai_llm"}
    for row in rows:
        assert "configured" in row and "connected" in row and "status" in row


def test_patch_task_reopen_after_complete():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "patchtask@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Rouvrir moi", "task_type": "manual_task"},
    )
    assert created.status_code == 200
    tid = created.json()["id"]
    assert client.post(f"/api/v1/tasks/{tid}/complete", headers=headers, json={}).status_code == 200
    patched = client.patch(f"/api/v1/tasks/{tid}", headers=headers, json={"status": "open"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "open"
    s = client.get("/api/v1/tasks/summary", headers=headers).json()
    assert s["open_count"] == 1
    assert s["done_count"] == 0


def test_delete_local_event_removes_from_list():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "eventdel@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=15)
    end = start + timedelta(hours=1)
    payload = {
        "title": "RDV à supprimer",
        "starts_at": start.isoformat().replace("+00:00", "Z"),
        "ends_at": end.isoformat().replace("+00:00", "Z"),
    }
    created = client.post("/api/v1/events", json=payload, headers=headers)
    assert created.status_code == 200
    eid = created.json()["id"]
    assert len(client.get("/api/v1/events", headers=headers).json()) == 1
    deleted = client.delete(f"/api/v1/events/{eid}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json().get("status") == "deleted"
    assert client.get("/api/v1/events", headers=headers).json() == []


def test_delete_event_other_household_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token_a = _login(client, "evdelA@majordome.test")
    token_b = _login(client, "evdelB@majordome.test")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    start = datetime.now(timezone.utc) + timedelta(days=12)
    end = start + timedelta(hours=1)
    created = client.post(
        "/api/v1/events",
        headers=headers_a,
        json={
            "title": "Foyer A seulement",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert created.status_code == 200
    eid = created.json()["id"]
    r = client.delete(f"/api/v1/events/{eid}", headers=headers_b)
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "event_not_found"


def test_events_create_and_sync_provider_none():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evsync@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=20)
    end = start + timedelta(hours=2)
    r = client.post(
        "/api/v1/events/create-and-sync",
        headers=headers,
        json={
            "title": "Création locale sync",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
            "provider": "none",
            "timezone": "Europe/Paris",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Création locale sync"
    assert data.get("category") == "general"


def test_events_create_and_sync_invalid_payload_and_range():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evinval@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    r1 = client.post(
        "/api/v1/events/create-and-sync",
        headers=headers,
        json={"title": "", "starts_at": "2026-01-01T10:00:00Z", "ends_at": "2026-01-01T11:00:00Z"},
    )
    assert r1.status_code == 400
    assert r1.json()["detail"]["code"] == "invalid_event_payload"
    start = datetime.now(timezone.utc) + timedelta(days=5)
    r2 = client.post(
        "/api/v1/events/create-and-sync",
        headers=headers,
        json={
            "title": "Plage invalide",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": start.isoformat().replace("+00:00", "Z"),
            "provider": "none",
        },
    )
    assert r2.status_code == 400
    assert r2.json()["detail"]["code"] == "invalid_event_range"


def test_doctolib_summary_matches_doctolib_in_event_text():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "docto@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=8)
    end = start + timedelta(hours=1)
    client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "title": "Consultation",
            "description": "Lien https://doctolib.fr/xyz",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    s = client.get("/api/v1/events/doctolib/summary", headers=headers).json()
    assert s["count"] >= 1
    assert s["status"] == "connected_via_calendar"
    assert isinstance(s["events"], list) and len(s["events"]) >= 1


def test_accounts_home_assistant_create_list_and_sync_stub():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "acctha@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/accounts", headers=headers).json() == []
    created = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={"provider": "home_assistant", "external_account_id": "http://ha.local:8123", "status": "connected"},
    )
    assert created.status_code == 200
    aid = created.json()["id"]
    listed = client.get("/api/v1/accounts", headers=headers).json()
    assert len(listed) == 1
    assert listed[0]["provider"] == "home_assistant"
    sync = client.post(f"/api/v1/accounts/{aid}/sync", headers=headers)
    assert sync.status_code == 200
    assert sync.json()["status"] == "sync_stub_ok"


def test_home_scene_invalid_id_returns_400():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "homescene@majordome.test")
    r = client.post("/api/v1/home/scenes/not valid!/execute", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_scene_id"


def test_home_scene_execute_returns_status_payload():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "homesceneok@majordome.test")
    r = client.post(
        "/api/v1/home/scenes/soir/execute",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("scene_id") == "soir"
    assert data.get("status") in ("executed_mock", "executed", "execution_failed")


def test_patch_task_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "task404@majordome.test")
    r = client.patch(
        "/api/v1/tasks/999999",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "open"},
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "task_not_found"


def test_complete_task_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "taskcomplete404@majordome.test")
    r = client.post("/api/v1/tasks/999999/complete", headers={"Authorization": f"Bearer {token}"}, json={})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "task_not_found"


def test_delete_memory_fact_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "mem404@majordome.test")
    r = client.delete("/api/v1/memory/facts/999999", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "memory_fact_not_found"


def test_delete_memory_fact_other_household_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token_a = _login(client, "memA@majordome.test")
    token_b = _login(client, "memB@majordome.test")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    created = client.post(
        "/api/v1/memory/facts",
        headers=headers_a,
        json={"fact_text": "Secret du foyer A uniquement."},
    )
    assert created.status_code == 200
    fid = created.json()["id"]
    r = client.delete(f"/api/v1/memory/facts/{fid}", headers=headers_b)
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "memory_fact_not_found"


def test_put_event_update_and_sync_updates_local_event():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evupdate@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=7)
    end = start + timedelta(hours=1)
    created = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "title": "Titre initial",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert created.status_code == 200
    eid = created.json()["id"]
    new_start = start + timedelta(days=1)
    new_end = new_start + timedelta(hours=1)
    updated = client.put(
        f"/api/v1/events/{eid}/update-and-sync",
        headers=headers,
        json={
            "title": "Titre mis à jour",
            "starts_at": new_start.isoformat().replace("+00:00", "Z"),
            "ends_at": new_end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Titre mis à jour"


def test_public_partner_delegation_ack_unknown_token_returns_404():
    _cleanup_db()
    client = TestClient(app)
    r = client.get("/api/v1/public/partner-delegations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ack")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "delegation_not_found"


def test_create_second_household_and_list_two():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "twohh@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    listed1 = client.get("/api/v1/households", headers=headers).json()
    assert len(listed1) == 1
    second = client.post("/api/v1/households", headers=headers, json={"name": "Résidence secondaire"})
    assert second.status_code == 200
    assert second.json()["name"] == "Résidence secondaire"
    listed2 = client.get("/api/v1/households", headers=headers).json()
    assert len(listed2) == 2
    names = {h["name"] for h in listed2}
    assert "Résidence secondaire" in names


def test_put_event_conflict_when_expected_updated_at_is_stale():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evconfl@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=21)
    end = start + timedelta(hours=1)
    created = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "title": "Version initiale",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert created.status_code == 200
    body = created.json()
    eid = body["id"]
    starts_raw = body["starts_at"]
    ends_raw = body["ends_at"]
    assert (
        client.put(
            f"/api/v1/events/{eid}/update-and-sync",
            headers=headers,
            json={"title": "Mise à jour intermédiaire", "starts_at": starts_raw, "ends_at": ends_raw},
        ).status_code
        == 200
    )
    # Horodatage client obsolète par rapport au serveur → verrouillage optimiste.
    conflict = client.put(
        f"/api/v1/events/{eid}/update-and-sync",
        headers=headers,
        json={
            "title": "Devrait échouer",
            "starts_at": starts_raw,
            "ends_at": ends_raw,
            "expected_updated_at": "2000-01-01T00:00:00Z",
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "event_conflict"


def test_put_event_invalid_expected_updated_at_returns_400():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evinvexp@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=22)
    end = start + timedelta(hours=1)
    created = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "title": "Evt",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    body = created.json()
    eid = body["id"]
    r = client.put(
        f"/api/v1/events/{eid}/update-and-sync",
        headers=headers,
        json={
            "title": "X",
            "starts_at": body["starts_at"],
            "ends_at": body["ends_at"],
            "expected_updated_at": "pas-une-date-iso",
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_expected_updated_at"


def test_sync_account_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "sync404@majordome.test")
    r = client.post("/api/v1/accounts/999999/sync", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "account_not_found"


def test_patch_document_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "doc404@majordome.test")
    r = client.patch(
        "/api/v1/documents/999999",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Nope"},
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "document_not_found"


def test_tasks_list_rejects_invalid_status_query():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "taskbadq@majordome.test")
    r = client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {token}"}, params={"status": "maybe"})
    assert r.status_code == 422


def test_apple_connect_requires_credentials():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "appleneed@majordome.test")
    r = client.post(
        "/api/v1/integrations/apple/connect",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "apple_credentials_required"


def test_apple_connect_returns_503_when_caldav_unavailable_patched():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "apple503@majordome.test")
    with patch("app.api.routes.CALDAV_AVAILABLE", False):
        r = client.post(
            "/api/v1/integrations/apple/connect",
            headers={"Authorization": f"Bearer {token}"},
            json={"apple_id": "test@icloud.com", "app_password": "app-specific-password"},
        )
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "apple_caldav_missing"


def test_home_assistant_connect_requires_credentials():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "haneed@majordome.test")
    r = client.post(
        "/api/v1/integrations/home-assistant/connect",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "home_assistant_credentials_required"


def test_create_household_member_unknown_household_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "memberhh404@majordome.test")
    r = client.post(
        "/api/v1/households/999999/members",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "X", "role": "adult_member"},
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "household_not_found"


def test_documents_bootstrap_idempotent():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "docboot@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(
        "/api/v1/documents/bootstrap",
        headers=headers,
        json={"prenom": "Jo", "partenaire": "Pat", "enfant": "Léo"},
    )
    assert first.status_code == 200
    assert first.json()["created"] > 0
    second = client.post(
        "/api/v1/documents/bootstrap",
        headers=headers,
        json={"prenom": "Jo", "partenaire": "Pat", "enfant": "Léo"},
    )
    assert second.status_code == 200
    assert second.json()["created"] == 0


def test_events_create_and_sync_unsupported_provider_returns_400():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evprov@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=30)
    end = start + timedelta(hours=1)
    r = client.post(
        "/api/v1/events/create-and-sync",
        headers=headers,
        json={
            "title": "Sync impossible",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
            "provider": "fantasy_calendar",
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "provider_not_supported_for_write"


def test_login_rejects_household_id_not_owned():
    _cleanup_db()
    client = TestClient(app)
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "loginowna@majordome.test", "password": "test12345", "full_name": "A"},
    ).status_code == 200
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "loginownb@majordome.test", "password": "test12345", "full_name": "B"},
    )
    assert login_b.status_code == 200
    hid_b = login_b.json()["household_id"]
    r = client.post(
        "/api/v1/auth/login",
        json={
            "email": "loginowna@majordome.test",
            "password": "test12345",
            "full_name": "A",
            "household_id": hid_b,
        },
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "household_forbidden"


def test_google_oauth_start_returns_400_when_not_configured():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "goauthcfg@majordome.test")
    with patch.object(settings, "google_oauth_client_id", ""), patch.object(settings, "google_oauth_client_secret", ""):
        r = client.post(
            "/api/v1/integrations/google/oauth/start",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "google_oauth_not_configured"


def test_put_event_update_unknown_id_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "evput404@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now(timezone.utc) + timedelta(days=4)
    end = start + timedelta(hours=1)
    r = client.put(
        "/api/v1/events/999999/update-and-sync",
        headers=headers,
        json={
            "title": "N existe pas",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "event_not_found"


def test_put_event_update_other_household_returns_404():
    _cleanup_db()
    client = TestClient(app)
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "evputha@majordome.test", "password": "test12345", "full_name": "A"},
    )
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "evputhb@majordome.test", "password": "test12345", "full_name": "B"},
    )
    assert login_a.status_code == 200 and login_b.status_code == 200
    headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}
    headers_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}
    start = datetime.now(timezone.utc) + timedelta(days=18)
    end = start + timedelta(hours=1)
    created = client.post(
        "/api/v1/events",
        headers=headers_a,
        json={
            "title": "Événement A",
            "starts_at": start.isoformat().replace("+00:00", "Z"),
            "ends_at": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert created.status_code == 200
    body = created.json()
    eid = body["id"]
    r = client.put(
        f"/api/v1/events/{eid}/update-and-sync",
        headers=headers_b,
        json={
            "title": "Intrusion",
            "starts_at": body["starts_at"],
            "ends_at": body["ends_at"],
        },
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "event_not_found"


def test_delete_document_not_found_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "docdel404@majordome.test")
    r = client.delete("/api/v1/documents/999999", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "document_not_found"


def test_download_document_attachment_when_missing_returns_404():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "attmissing@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"name": "Sans pièce jointe", "category": "Divers"},
    )
    assert created.status_code == 200
    doc_id = created.json()["id"]
    r = client.get(f"/api/v1/documents/{doc_id}/attachment", headers=headers)
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "attachment_not_found"


def test_delete_document_attachment_when_none_still_ok():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "attdelok@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"name": "Doc sans fichier", "category": "Divers"},
    )
    assert created.status_code == 200
    doc_id = created.json()["id"]
    r = client.delete(f"/api/v1/documents/{doc_id}/attachment", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == doc_id
    assert data.get("attachment_original_name") is None
    assert data.get("attachment_size_bytes") is None


def test_accounts_microsoft_calendar_sync_returns_stub():
    _cleanup_db()
    client = TestClient(app)
    token = _login(client, "msftstub@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={"provider": "microsoft_calendar", "external_account_id": "ms-id", "status": "connected"},
    )
    assert created.status_code == 200
    aid = created.json()["id"]
    sync = client.post(f"/api/v1/accounts/{aid}/sync", headers=headers)
    assert sync.status_code == 200
    assert sync.json()["status"] == "sync_stub_ok"


def test_household_scoping_isolation_between_users():
    _cleanup_db()
    client = TestClient(app)

    token_a = _login(client, "a@majordome.test")
    token_b = _login(client, "b@majordome.test")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # GET /events ne renvoie qu’une fenêtre ~90 jours : dates dans cette fenêtre.
    start = datetime.now(timezone.utc) + timedelta(days=10)
    end = start + timedelta(hours=1)
    event_payload = {
        "title": "Rendez-vous A",
        "starts_at": start.isoformat().replace("+00:00", "Z"),
        "ends_at": end.isoformat().replace("+00:00", "Z"),
    }
    create_event = client.post("/api/v1/events", json=event_payload, headers=headers_a)
    assert create_event.status_code == 200

    events_a = client.get("/api/v1/events", headers=headers_a)
    events_b = client.get("/api/v1/events", headers=headers_b)
    assert events_a.status_code == 200
    assert events_b.status_code == 200
    assert len(events_a.json()) == 1
    assert len(events_b.json()) == 0
