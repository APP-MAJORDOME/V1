#!/usr/bin/env bash
set -euo pipefail

# Restaure une archive créée par scripts/backup-uploads.sh.
# Usage:
#   MAJORDOME_UPLOAD_DIR=./data/uploads bash scripts/restore-uploads.sh backups/majordome-uploads-YYYYmmdd-HHMMSS.tar.gz
#   MAJORDOME_UPLOAD_DIR=/data/uploads FORCE_RESTORE=1 bash scripts/restore-uploads.sh /var/backups/majordome-uploads-xxx.tar.gz

if [[ $# -lt 1 ]]; then
  echo "[restore-uploads][error] archive .tar.gz requise en argument"
  exit 1
fi

ARCHIVE="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${MAJORDOME_UPLOAD_DIR:-${ROOT}/data/uploads}"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "[restore-uploads][error] archive introuvable: ${ARCHIVE}"
  exit 1
fi

if [[ -d "${TARGET}" && -n "$(ls -A "${TARGET}" 2>/dev/null || true)" && "${FORCE_RESTORE:-0}" != "1" ]]; then
  echo "[restore-uploads][error] cible non vide: ${TARGET}"
  echo "[restore-uploads][hint] définir FORCE_RESTORE=1 pour écraser le contenu"
  exit 1
fi

mkdir -p "${TARGET}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

tar -xzf "${ARCHIVE}" -C "${TMP}"
INNER="$(find "${TMP}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "${INNER}" ]]; then
  echo "[restore-uploads][error] archive invalide (dossier racine manquant)"
  exit 1
fi

if [[ "${FORCE_RESTORE:-0}" == "1" ]]; then
  rm -rf "${TARGET}"/*
fi
cp -a "${INNER}/." "${TARGET}/"

echo "[restore-uploads] OK -> ${TARGET}"
