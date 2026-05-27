#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@majordome.fr}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo12345}"

echo "[smoke] API base: ${API_BASE}"

echo "[smoke] health"
HEALTH_RESPONSE="$(curl -fsS "${API_BASE}/health")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("status")=="ok", p' <<< "${HEALTH_RESPONSE}"

echo "[smoke] openapi schema"
OPENAPI="$(curl -fsS "${API_BASE}/openapi.json")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("openapi"); paths=p.get("paths") or {}; assert "/api/v1/auth/login" in paths; assert "/health" in paths; assert "/live" in paths; assert "/ready" in paths' <<< "${OPENAPI}"

echo "[smoke] live"
LIVE_RESPONSE="$(curl -fsS "${API_BASE}/live")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("status")=="alive", p' <<< "${LIVE_RESPONSE}"

echo "[smoke] ready"
READY_RESPONSE="$(curl -fsS "${API_BASE}/ready")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("status")=="ready", p; c=p.get("checks",{}); assert c.get("database") is True, p; assert c.get("redis") is True, p; assert c.get("upload_dir") is True, p' <<< "${READY_RESPONSE}"

echo "[smoke] protected endpoint without token should fail"
NO_TOKEN_RESPONSE="$(curl -s "${API_BASE}/api/v1/events")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); detail=p.get("detail",{}); assert detail.get("code")=="missing_bearer_token", p; assert isinstance(detail.get("request_id"), str) and detail["request_id"], p' <<< "${NO_TOKEN_RESPONSE}"

echo "[smoke] request id header propagation"
REQUEST_ID_HEADER_VALUE="smoke-test-request-id"
REQUEST_ID_CAPTURE="$(curl -s -D - -o /dev/null "${API_BASE}/health" -H "X-Request-Id: ${REQUEST_ID_HEADER_VALUE}")"
python3 -c 'import sys; lines=[line.strip() for line in sys.stdin.read().splitlines() if line.strip()]; headers={k.strip().lower():v.strip() for line in lines if ":" in line for k,v in [line.split(":",1)]}; assert headers.get("x-request-id")==sys.argv[1], headers' "${REQUEST_ID_HEADER_VALUE}" <<< "${REQUEST_ID_CAPTURE}"

echo "[smoke] login"
LOGIN_RESPONSE="$(curl -fsS -X POST "${API_BASE}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\",\"full_name\":\"Demo User\"}")"

TOKEN="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("token_type")=="bearer", p; assert p.get("user_id"), p; assert p.get("household_id"), p; assert p.get("refresh_token"), p; print(p["access_token"])' <<< "${LOGIN_RESPONSE}")"
REFRESH_TOKEN="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(p["refresh_token"])' <<< "${LOGIN_RESPONSE}")"
if [[ -z "${TOKEN}" ]]; then
  echo "[smoke][error] empty token"
  exit 1
fi
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

echo "[smoke] refresh token"
REFRESH_RESPONSE="$(curl -fsS -X POST "${API_BASE}/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"${REFRESH_TOKEN}\"}")"
NEW_TOKEN="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("token_type")=="bearer", p; print(p["access_token"])' <<< "${REFRESH_RESPONSE}")"
ROTATED_REFRESH="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(p.get("refresh_token") or "")' <<< "${REFRESH_RESPONSE}")"
if [[ -n "${ROTATED_REFRESH}" ]]; then
  REFRESH_TOKEN="${ROTATED_REFRESH}"
fi
AUTH_HEADER="Authorization: Bearer ${NEW_TOKEN}"

echo "[smoke] briefing"
BRIEFING_RESPONSE="$(curl -fsS "${API_BASE}/api/v1/briefings/today" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); required=["generated_at","events_count","tasks_count","opportunities_count","highlights"]; [(_ for _ in ()).throw(AssertionError((k,p))) for k in required if k not in p]' <<< "${BRIEFING_RESPONSE}"

echo "[smoke] agent interpret"
AGENT_INTERP="$(curl -fsS -X POST "${API_BASE}/api/v1/agent/interpret" \
  -H "${AUTH_HEADER}" -H "Content-Type: application/json" \
  -d '{"command":"mail rapide au pédiatre"}')"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("intent"), str) and p["intent"].strip(); assert isinstance(p.get("proposal"), dict)' <<< "${AGENT_INTERP}"

echo "[smoke] agent realtime status"
REALTIME_ST="$(curl -fsS "${API_BASE}/api/v1/agent/realtime/status" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("configured"), bool); assert isinstance(p.get("voice"), str) and p["voice"].strip(); assert isinstance(p.get("model"), str) and p["model"].strip()' <<< "${REALTIME_ST}"

echo "[smoke] events"
EVENTS_RESPONSE="$(curl -fsS "${API_BASE}/api/v1/events" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in e and "title" in e for e in p)' <<< "${EVENTS_RESPONSE}"

echo "[smoke] events doctolib summary"
DOCTO="$(curl -fsS "${API_BASE}/api/v1/events/doctolib/summary" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("count"), int); assert isinstance(p.get("events"), list); assert p.get("status") in ("connected_via_calendar","no_doctolib_event_detected"), p' <<< "${DOCTO}"

echo "[smoke] tasks"
TASKS_RESPONSE="$(curl -fsS "${API_BASE}/api/v1/tasks" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in t and "title" in t for t in p)' <<< "${TASKS_RESPONSE}"

echo "[smoke] tasks summary"
TASKS_SUMMARY="$(curl -fsS "${API_BASE}/api/v1/tasks/summary" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("open_count"), int); assert isinstance(p.get("done_count"), int)' <<< "${TASKS_SUMMARY}"

echo "[smoke] integrations capabilities"
CAPABILITIES="$(curl -fsS "${API_BASE}/api/v1/integrations/capabilities" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("apple_caldav_available"), bool)' <<< "${CAPABILITIES}"

echo "[smoke] integrations status"
INT_STATUS="$(curl -fsS "${API_BASE}/api/v1/integrations/status" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list) and len(p)>=4; prov={x["provider"] for x in p}; assert "apple_calendar" in prov; assert all("configured" in x and "connected" in x for x in p)' <<< "${INT_STATUS}"

echo "[smoke] connected accounts"
ACCOUNTS="$(curl -fsS "${API_BASE}/api/v1/accounts" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in a and "provider" in a for a in p)' <<< "${ACCOUNTS}"

echo "[smoke] memory facts list"
MEMORY_FACTS="$(curl -fsS "${API_BASE}/api/v1/memory/facts" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p' <<< "${MEMORY_FACTS}"

echo "[smoke] partner inbox"
PARTNER_INBOX="$(curl -fsS "${API_BASE}/api/v1/tasks/partner-inbox" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p' <<< "${PARTNER_INBOX}"

echo "[smoke] delegations list"
DELEGATIONS="$(curl -fsS "${API_BASE}/api/v1/delegations" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in x and "status" in x for x in p)' <<< "${DELEGATIONS}"

echo "[smoke] households"
HOUSEHOLDS="$(curl -fsS "${API_BASE}/api/v1/households" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list) and len(p)>=1 and "id" in p[0] and "name" in p[0], p' <<< "${HOUSEHOLDS}"

echo "[smoke] household members"
HH_MEMBERS="$(curl -fsS "${API_BASE}/api/v1/household/members" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in m and "role" in m for m in p)' <<< "${HH_MEMBERS}"

echo "[smoke] routines"
ROUTINES="$(curl -fsS "${API_BASE}/api/v1/routines" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in r and "name" in r for r in p)' <<< "${ROUTINES}"

echo "[smoke] opportunities"
OPPS="$(curl -fsS "${API_BASE}/api/v1/opportunities" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p; (len(p)==0) or all("id" in o and "title" in o for o in p)' <<< "${OPPS}"

echo "[smoke] conflicts"
CONFLICTS_RESPONSE="$(curl -fsS "${API_BASE}/api/v1/events/conflicts" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert "conflicts" in p and isinstance(p["conflicts"],list), p' <<< "${CONFLICTS_RESPONSE}"

echo "[smoke] home status"
HOME_RESPONSE="$(curl -fsS "${API_BASE}/api/v1/home/status" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); required=["mode","lights_on","energy_alert","robot_last_run_hours","recommended_actions"]; [(_ for _ in ()).throw(AssertionError((k,p))) for k in required if k not in p]' <<< "${HOME_RESPONSE}"

echo "[smoke] home scene execute (stub)"
SCENE_EXEC="$(curl -fsS -X POST "${API_BASE}/api/v1/home/scenes/soir/execute" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("scene_id")=="soir"; assert p.get("status") in ("executed_mock","executed","execution_failed"), p' <<< "${SCENE_EXEC}"

echo "[smoke] documents list"
DOCS_LIST="$(curl -fsS "${API_BASE}/api/v1/documents" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p,list), p' <<< "${DOCS_LIST}"

echo "[smoke] documents storage summary"
STORE_SUM="$(curl -fsS "${API_BASE}/api/v1/documents/storage-summary" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert isinstance(p.get("used_bytes"), int); assert ("quota_bytes" in p)' <<< "${STORE_SUM}"

echo "[smoke] document attachment upload + download + delete"
CREATE_DOC="$(curl -fsS -X POST "${API_BASE}/api/v1/documents" \
  -H "${AUTH_HEADER}" -H "Content-Type: application/json" \
  -d '{"icon":"📎","name":"Smoke pièce jointe","category":"Divers","urgent":false}')"
DOC_ID="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(int(p["id"]))' <<< "${CREATE_DOC}")"
PNG_TMP="$(mktemp)"
python3 -c "import base64,sys; sys.stdout.buffer.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))" > "${PNG_TMP}"
curl -fsS -X POST "${API_BASE}/api/v1/documents/${DOC_ID}/attachment" \
  -H "${AUTH_HEADER}" -F "file=@${PNG_TMP};type=image/png" >/dev/null
PNG_OUT="$(mktemp)"
curl -fsS "${API_BASE}/api/v1/documents/${DOC_ID}/attachment" -H "${AUTH_HEADER}" -o "${PNG_OUT}"
python3 -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); assert p.stat().st_size>=32, p.stat().st_size' "${PNG_OUT}"
curl -fsS -X DELETE "${API_BASE}/api/v1/documents/${DOC_ID}" -H "${AUTH_HEADER}" >/dev/null
rm -f "${PNG_TMP}" "${PNG_OUT}"

echo "[smoke] logout"
LOGOUT_RESPONSE="$(curl -fsS -X POST "${API_BASE}/api/v1/auth/logout" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"${REFRESH_TOKEN}\"}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("status")=="logged_out", p' <<< "${LOGOUT_RESPONSE}"

echo "[smoke] revoked token should fail"
REVOKED_RESPONSE="$(curl -s "${API_BASE}/api/v1/events" -H "${AUTH_HEADER}")"
python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); detail=p.get("detail",{}); assert detail.get("code")=="invalid_bearer_token", p; assert isinstance(detail.get("request_id"), str) and detail["request_id"], p' <<< "${REVOKED_RESPONSE}"

echo "[smoke] OK - core API payloads and contracts are healthy"
