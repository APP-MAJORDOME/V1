#!/usr/bin/env bash
set -euo pipefail

# Vérifie rapidement l'état du déploiement local ou distant.
# Usage:
#   bash scripts/check-deployment.sh
#   API_BASE=https://majordom.eu bash scripts/check-deployment.sh --json
#   API_BASE=https://majordom.eu bash scripts/check-deployment.sh --json --strict
#   bash scripts/check-deployment.sh --remote
#   bash scripts/check-deployment.sh --remote --json
#   bash scripts/check-deployment.sh --remote --json --strict
#
# Mode --remote: nécessite REMOTE_HOST + REMOTE_USER (+ REMOTE_SSH_KEY optionnel)

API_BASE="${API_BASE:-http://localhost:8000}"
MODE="local"
JSON_MODE=0
STRICT_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      MODE="remote"
      ;;
    --json)
      JSON_MODE=1
      ;;
    --strict)
      STRICT_MODE=1
      ;;
    local)
      MODE="local"
      ;;
    -h|--help)
      sed -n '1,28p' "$0"
      exit 0
      ;;
    *)
      echo "[check-deployment][error] argument inconnu: $1"
      echo "utiliser: [local|--remote] [--json] [--strict]"
      exit 1
      ;;
  esac
  shift
done

print_local() {
  HEALTH_OK=0
  READY_STATUS="unknown"
  READY_DB=0
  READY_REDIS=0
  READY_UPLOAD=0

  echo "[check-deployment] mode=local api=${API_BASE}"
  echo "[check-deployment] /health"
  if curl -fsS "${API_BASE}/health" >/dev/null; then
    HEALTH_OK=1
    echo "  ok"
  else
    echo "  failed"
  fi

  echo "[check-deployment] /ready"
  READY="$(curl -fsS "${API_BASE}/ready" || true)"
  if [[ -n "${READY}" ]]; then
    python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); assert p.get("status") in {"ready","degraded"}, p; print(p)' <<<"${READY}" || true
    READY_STATUS="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(p.get("status","unknown"))' <<<"${READY}" 2>/dev/null || echo unknown)"
    READY_DB="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(1 if p.get("checks",{}).get("database") else 0)' <<<"${READY}" 2>/dev/null || echo 0)"
    READY_REDIS="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(1 if p.get("checks",{}).get("redis") else 0)' <<<"${READY}" 2>/dev/null || echo 0)"
    READY_UPLOAD="$(python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(1 if p.get("checks",{}).get("upload_dir") else 0)' <<<"${READY}" 2>/dev/null || echo 0)"
  fi

  if command -v docker >/dev/null 2>&1; then
    echo "[check-deployment] docker compose ps"
    docker compose -f infra/docker-compose.yml ps || true
  fi

  if [[ -x "./scripts/status-maintenance-uploads.sh" ]]; then
    echo "[check-deployment] uploads maintenance status"
    bash ./scripts/status-maintenance-uploads.sh || true
  fi

  if [[ "${JSON_MODE}" -eq 1 ]]; then
    CHECK_API_BASE="${API_BASE}" \
    CHECK_HEALTH_OK="${HEALTH_OK}" \
    CHECK_READY_STATUS="${READY_STATUS}" \
    CHECK_READY_DB="${READY_DB}" \
    CHECK_READY_REDIS="${READY_REDIS}" \
    CHECK_READY_UPLOAD="${READY_UPLOAD}" \
    python3 - <<'PY'
import json
import os
print(json.dumps({
  "mode": "local",
  "api_base": os.environ.get("CHECK_API_BASE", ""),
  "health_ok": os.environ.get("CHECK_HEALTH_OK", "0") == "1",
  "ready": {
    "status": os.environ.get("CHECK_READY_STATUS", "unknown"),
    "database": os.environ.get("CHECK_READY_DB", "0") == "1",
    "redis": os.environ.get("CHECK_READY_REDIS", "0") == "1",
    "upload_dir": os.environ.get("CHECK_READY_UPLOAD", "0") == "1",
  }
}))
PY
  fi

  if [[ "${STRICT_MODE}" -eq 1 ]]; then
    # Exit codes:
    # 2 => health KO
    # 3 => ready status != ready
    # 4 => database check false
    # 5 => redis check false
    # 6 => upload_dir check false
    if [[ "${HEALTH_OK}" -ne 1 ]]; then
      echo "[check-deployment][strict] health KO"
      exit 2
    fi
    if [[ "${READY_STATUS}" != "ready" ]]; then
      echo "[check-deployment][strict] ready status=${READY_STATUS}"
      exit 3
    fi
    if [[ "${READY_DB}" -ne 1 ]]; then
      echo "[check-deployment][strict] database check KO"
      exit 4
    fi
    if [[ "${READY_REDIS}" -ne 1 ]]; then
      echo "[check-deployment][strict] redis check KO"
      exit 5
    fi
    if [[ "${READY_UPLOAD}" -ne 1 ]]; then
      echo "[check-deployment][strict] upload_dir check KO"
      exit 6
    fi
  fi
}

print_remote() {
  REMOTE_HOST="${REMOTE_HOST:-}"
  REMOTE_USER="${REMOTE_USER:-}"
  REMOTE_SSH_KEY="${REMOTE_SSH_KEY:-${SSH_IDENTITY_FILE:-}}"
  REMOTE_DIR="${REMOTE_DIR:-/opt/majordome}"
  [[ -n "${REMOTE_HOST}" && -n "${REMOTE_USER}" ]] || {
    echo "[check-deployment][error] REMOTE_HOST et REMOTE_USER requis en mode --remote"
    exit 1
  }

  SSH_ARGS=()
  if [[ -n "${REMOTE_SSH_KEY}" ]]; then
    KEY_EXPANDED="${REMOTE_SSH_KEY/#\~/${HOME}}"
    [[ -f "${KEY_EXPANDED}" ]] || { echo "[check-deployment][error] clé SSH introuvable: ${KEY_EXPANDED}"; exit 1; }
    SSH_ARGS=(-i "${KEY_EXPANDED}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
  fi

  echo "[check-deployment] mode=remote host=${REMOTE_USER}@${REMOTE_HOST} dir=${REMOTE_DIR}"
  REMOTE_JSON_FLAG=""
  if [[ "${JSON_MODE}" -eq 1 ]]; then
    REMOTE_JSON_FLAG=" --json"
  fi
  REMOTE_STRICT_FLAG=""
  if [[ "${STRICT_MODE}" -eq 1 ]]; then
    REMOTE_STRICT_FLAG=" --strict"
  fi
  ssh "${SSH_ARGS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "cd '${REMOTE_DIR}' && bash scripts/check-deployment.sh${REMOTE_JSON_FLAG}${REMOTE_STRICT_FLAG}"
}

case "${MODE}" in
  local)
    print_local
    ;;
  remote)
    print_remote
    ;;
  *)
    echo "[check-deployment][error] mode inconnu: ${MODE}"
    exit 1
    ;;
esac

echo "[check-deployment] done"
