#!/usr/bin/env bash
set -euo pipefail

# Installe (ou remplace) une entrée cron pour la maintenance uploads.
# Exemples:
#   bash scripts/install-maintenance-cron.sh
#   CRON_SCHEDULE="5 2 * * *" ENV_FILE=/opt/majordome/.env bash scripts/install-maintenance-cron.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SCHEDULE="${CRON_SCHEDULE:-17 3 * * *}"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"
RUNNER="${ROOT}/scripts/run-maintenance-uploads.sh"
TAG="# MAJORDOME_UPLOADS_MAINTENANCE"
ENTRY="${CRON_SCHEDULE} ENV_FILE=${ENV_FILE} bash ${RUNNER} ${TAG}"

if [[ ! -f "${RUNNER}" ]]; then
  echo "[install-maintenance-cron][error] runner introuvable: ${RUNNER}"
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

if crontab -l >/dev/null 2>&1; then
  crontab -l | sed "/${TAG//\//\\/}/d" >"${TMP}"
fi
echo "${ENTRY}" >>"${TMP}"

crontab "${TMP}"
echo "[install-maintenance-cron] OK"
echo "[install-maintenance-cron] entry: ${ENTRY}"
