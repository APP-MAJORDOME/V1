#!/usr/bin/env bash
set -euo pipefail

# Wrapper production: charge .env, exécute la maintenance uploads et écrit un log daté.
# Exemples:
#   bash scripts/run-maintenance-uploads.sh
#   KEEP_DAYS=14 BACKUP_OUT=/var/backups/majordome bash scripts/run-maintenance-uploads.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"
LOG_DIR="${LOG_DIR:-${ROOT}/logs}"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/uploads-maintenance-$(date +%Y%m%d).log"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# Valeurs par défaut "prod-like"; peuvent être surchargées via .env/env.
export BACKUP_OUT="${BACKUP_OUT:-${ROOT}/backups}"
export KEEP_DAYS="${KEEP_DAYS:-30}"

echo "[$(date -Iseconds)] start uploads maintenance" | tee -a "${LOG_FILE}"
if bash "${ROOT}/scripts/maintain-uploads.sh" --backup --prune --keep-days "${KEEP_DAYS}" --restore-check >>"${LOG_FILE}" 2>&1; then
  echo "[$(date -Iseconds)] success uploads maintenance" | tee -a "${LOG_FILE}"
else
  rc=$?
  echo "[$(date -Iseconds)] failure uploads maintenance (exit=${rc})" | tee -a "${LOG_FILE}"
  exit "${rc}"
fi
