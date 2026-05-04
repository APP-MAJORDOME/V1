#!/usr/bin/env bash
set -euo pipefail

# Exécute la maintenance complète à distance (dans le repo déjà déployé).
# Usage:
#   REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu bash scripts/maintenance-remote.sh
#   REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu REMOTE_SSH_KEY=~/Downloads/clef_vha.pem REMOTE_DIR=/opt/majordome bash scripts/maintenance-remote.sh

# Évite les alias/fonctions shell qui masquent ssh.
SSH_BIN="$(command -v ssh || true)"
[[ -x "${SSH_BIN:-}" ]] || SSH_BIN="/usr/bin/ssh"

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/majordome}"
REMOTE_SSH_KEY="${REMOTE_SSH_KEY:-${SSH_IDENTITY_FILE:-}}"

SSH_ARGS=()
if [[ -n "${REMOTE_SSH_KEY}" ]]; then
  REMOTE_SSH_KEY_EXPAND="${REMOTE_SSH_KEY/#\~/${HOME}}"
  if [[ ! -f "${REMOTE_SSH_KEY_EXPAND}" ]]; then
    echo "[maintenance-remote][error] REMOTE_SSH_KEY file not found: ${REMOTE_SSH_KEY_EXPAND}"
    exit 1
  fi
  SSH_ARGS=(-i "${REMOTE_SSH_KEY_EXPAND}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
fi

if [[ -z "${REMOTE_HOST}" || -z "${REMOTE_USER}" ]]; then
  echo "[maintenance-remote][error] REMOTE_HOST and REMOTE_USER are required"
  echo "[maintenance-remote][hint] export REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu REMOTE_SSH_KEY=~/Downloads/clef_vha.pem"
  exit 1
fi

echo "[maintenance-remote] running remote maintenance on ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
"${SSH_BIN}" "${SSH_ARGS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "cd '${REMOTE_DIR}' && make maintenance-full"
echo "[maintenance-remote] success"
