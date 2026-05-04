#!/usr/bin/env bash
set -euo pipefail

# Produit un message compact pour notifications (Slack/Teams) à partir de check-deployment.
# - Exécute check-deployment en JSON strict (local ou remote)
# - Affiche une ligne lisible
# - Retourne le même code de sortie strict
#
# Usage:
#   bash scripts/check-deployment-alert.sh
#   bash scripts/check-deployment-alert.sh --remote
#
# Env optionnelle (Slack Incoming Webhook — JSON {"text": "..."}) :
#   MAJORDOME_DEPLOY_ALERT_WEBHOOK=https://hooks.slack.com/services/...

MODE_REMOTE=0
if [[ "${1:-}" == "--remote" ]]; then
  MODE_REMOTE=1
fi

TMP_JSON="$(mktemp)"
trap 'rm -f "${TMP_JSON}"' EXIT

set +e
if [[ "${MODE_REMOTE}" -eq 1 ]]; then
  RAW_OUTPUT="$(bash scripts/check-deployment.sh --remote --json --strict 2>&1)"
else
  RAW_OUTPUT="$(bash scripts/check-deployment.sh --json --strict 2>&1)"
fi
RC=$?
set -e

printf "%s\n" "${RAW_OUTPUT}" >"${TMP_JSON}"

JSON_LINE="$(python3 - "${TMP_JSON}" <<'PY'
import json
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
last = None
for line in text.splitlines():
    s = line.strip()
    if not s.startswith("{"):
        continue
    try:
        obj = json.loads(s)
    except Exception:
        continue
    last = obj
if last is None:
    print("{}")
else:
    print(json.dumps(last, ensure_ascii=False))
PY
)"

if [[ "${JSON_LINE}" == "{}" ]]; then
  SUMMARY="🚨 MajorDome deploy-check: sortie JSON introuvable (rc=${RC})"
else
  SUMMARY="$(python3 - <<'PY' "${JSON_LINE}" "${RC}"
import json
import sys

obj = json.loads(sys.argv[1])
rc = int(sys.argv[2])
mode = obj.get("mode", "local")
api = obj.get("api_base", "?")
health = obj.get("health_ok", False)
ready = obj.get("ready", {})
rstatus = ready.get("status", "unknown")
db = ready.get("database", False)
redis = ready.get("redis", False)
upload = ready.get("upload_dir", False)

icon = "✅" if rc == 0 else "🚨"
summary = (
    f"{icon} MajorDome deploy-check [{mode}] rc={rc} "
    f"| api={api} | health={health} | ready={rstatus} "
    f"| db={db} redis={redis} upload={upload}"
)
print(summary)
PY
)"
fi

echo "${SUMMARY}"

WEBHOOK_URL="${MAJORDOME_DEPLOY_ALERT_WEBHOOK:-}"
if [[ -n "${WEBHOOK_URL}" ]]; then
  if ! SUMMARY_FOR_WEBHOOK="${SUMMARY}" python3 - <<'PY'
import json
import os
import urllib.error
import urllib.request

url = os.environ.get("MAJORDOME_DEPLOY_ALERT_WEBHOOK", "").strip()
text = os.environ.get("SUMMARY_FOR_WEBHOOK", "")
if not url:
    raise SystemExit(0)
body = json.dumps({"text": text}).encode("utf-8")
req = urllib.request.Request(
    url,
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status not in (200, 204):
            raise RuntimeError(f"HTTP {resp.status}")
except Exception as exc:
    print(f"[check-deployment-alert] webhook POST failed: {exc}", flush=True)
    raise SystemExit(1)
PY
  then
    echo "[check-deployment-alert] webhook ignoré (voir message ci-dessus)" >&2
  fi
fi

exit "${RC}"
