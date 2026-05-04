#!/usr/bin/env bash
set -euo pipefail

# Évite les alias/fonctions shell qui masquent ssh/rsync/scp (ex. zsh).
SSH_BIN="$(command -v ssh || true)"
[[ -x "${SSH_BIN:-}" ]] || SSH_BIN="/usr/bin/ssh"
RSYNC_BIN="$(command -v rsync || true)"
[[ -x "${RSYNC_BIN:-}" ]] || RSYNC_BIN="/usr/bin/rsync"
SCP_BIN="$(command -v scp || true)"
[[ -x "${SCP_BIN:-}" ]] || SCP_BIN="/usr/bin/scp"

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/majordome}"
ENV_FILE_LOCAL="${1:-.env}"
# Clé PEM AWS / EC2 : export REMOTE_SSH_KEY=~/Downloads/clef_vha.pem
REMOTE_SSH_KEY="${REMOTE_SSH_KEY:-${SSH_IDENTITY_FILE:-}}"

SSH_ARGS=()
RSYNC_SSH_CMD=""
if [[ -n "${REMOTE_SSH_KEY}" ]]; then
  REMOTE_SSH_KEY_EXPAND="${REMOTE_SSH_KEY/#\~/${HOME}}"
  if [[ ! -f "${REMOTE_SSH_KEY_EXPAND}" ]]; then
    echo "[deploy-remote][error] REMOTE_SSH_KEY file not found: ${REMOTE_SSH_KEY_EXPAND}"
    exit 1
  fi
  SSH_ARGS=(-i "${REMOTE_SSH_KEY_EXPAND}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
  RSYNC_SSH_CMD="${SSH_BIN} -i ${REMOTE_SSH_KEY_EXPAND} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

if [[ -z "${REMOTE_HOST}" || -z "${REMOTE_USER}" ]]; then
  echo "[deploy-remote][error] REMOTE_HOST and REMOTE_USER are required"
  echo "[deploy-remote][hint]  export REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu REMOTE_SSH_KEY=~/Downloads/clef_vha.pem"
  exit 1
fi

if [[ ! -f "${ENV_FILE_LOCAL}" ]]; then
  echo "[deploy-remote][error] env file not found: ${ENV_FILE_LOCAL}"
  exit 1
fi

echo "[deploy-remote] syncing code to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
"${SSH_BIN}" "${SSH_ARGS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"
if [[ -n "${RSYNC_SSH_CMD}" ]]; then
  "${RSYNC_BIN}" -az --delete -e "${RSYNC_SSH_CMD}" --exclude ".git" --exclude ".venv" ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
else
  "${RSYNC_BIN}" -az --delete --exclude ".git" --exclude ".venv" ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
fi

echo "[deploy-remote] uploading env file"
"${SCP_BIN}" "${SSH_ARGS[@]}" "${ENV_FILE_LOCAL}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env"

echo "[deploy-remote] running remote deploy"
"${SSH_BIN}" "${SSH_ARGS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "cd '${REMOTE_DIR}' && bash scripts/deploy.sh .env"

echo "[deploy-remote] success"
