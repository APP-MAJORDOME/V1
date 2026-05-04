#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde le répertoire des piè jointes du coffre (hôte ou variable d’env).
# Usage :
#   MAJORDOME_UPLOAD_DIR=./data/uploads bash scripts/backup-uploads.sh
#   MAJORDOME_UPLOAD_DIR=/data/uploads BACKUP_OUT=/var/backups/majordome bash scripts/backup-uploads.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${MAJORDOME_UPLOAD_DIR:-${ROOT}/data/uploads}"
OUT="${BACKUP_OUT:-${ROOT}/backups}"

if [[ ! -d "${SRC}" ]]; then
  echo "[backup-uploads] répertoire absent ou vide : ${SRC} — rien à archiver."
  exit 0
fi

mkdir -p "${OUT}"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${OUT}/majordome-uploads-${TS}.tar.gz"

tar -czf "${ARCHIVE}" -C "$(dirname "${SRC}")" "$(basename "${SRC}")"
echo "[backup-uploads] OK → ${ARCHIVE}"
