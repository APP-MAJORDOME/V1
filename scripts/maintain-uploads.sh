#!/usr/bin/env bash
set -euo pipefail

# Maintenance uploads: backup + purge + restore-check.
#
# Exemples:
#   bash scripts/maintain-uploads.sh --backup
#   bash scripts/maintain-uploads.sh --backup --prune --keep-days 14
#   bash scripts/maintain-uploads.sh --backup --restore-check
#   MAJORDOME_UPLOAD_DIR=/data/uploads BACKUP_OUT=/var/backups/majordome \
#     bash scripts/maintain-uploads.sh --backup --prune --keep-days 30 --restore-check

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${MAJORDOME_UPLOAD_DIR:-${ROOT}/data/uploads}"
OUT="${BACKUP_OUT:-${ROOT}/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DO_BACKUP=0
DO_PRUNE=0
DO_RESTORE_CHECK=0

usage() {
  cat <<'EOF'
Usage: bash scripts/maintain-uploads.sh [options]

Options:
  --backup              Crée une nouvelle archive .tar.gz des uploads
  --prune               Supprime les archives de plus de --keep-days
  --restore-check       Teste l'extraction de la dernière archive dans un dossier temporaire
  --keep-days N         Rétention (jours) pour --prune (défaut: 30)
  -h, --help            Affiche cette aide

Variables env utiles:
  MAJORDOME_UPLOAD_DIR  Dossier source des uploads (défaut: ./data/uploads)
  BACKUP_OUT            Dossier des archives (défaut: ./backups)
  KEEP_DAYS             Alternative à --keep-days
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup)
      DO_BACKUP=1
      ;;
    --prune)
      DO_PRUNE=1
      ;;
    --restore-check)
      DO_RESTORE_CHECK=1
      ;;
    --keep-days)
      shift
      [[ $# -gt 0 ]] || { echo '[maintain-uploads][error] --keep-days requiert une valeur'; exit 1; }
      KEEP_DAYS="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[maintain-uploads][error] option inconnue: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$DO_BACKUP" -eq 0 && "$DO_PRUNE" -eq 0 && "$DO_RESTORE_CHECK" -eq 0 ]]; then
  echo '[maintain-uploads][error] aucune action demandée (--backup/--prune/--restore-check)'
  usage
  exit 1
fi

if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  echo "[maintain-uploads][error] keep-days invalide: $KEEP_DAYS"
  exit 1
fi

mkdir -p "$OUT"
LAST_ARCHIVE=''

if [[ "$DO_BACKUP" -eq 1 ]]; then
  if [[ ! -d "$SRC" ]]; then
    echo "[maintain-uploads] source absente: $SRC — backup ignoré"
  else
    TS="$(date +%Y%m%d-%H%M%S)"
    LAST_ARCHIVE="${OUT}/majordome-uploads-${TS}.tar.gz"
    tar -czf "$LAST_ARCHIVE" -C "$(dirname "$SRC")" "$(basename "$SRC")"
    echo "[maintain-uploads] backup OK -> $LAST_ARCHIVE"
  fi
fi

if [[ "$DO_PRUNE" -eq 1 ]]; then
  # shellcheck disable=SC2016
  PRUNED_COUNT="$(find "$OUT" -maxdepth 1 -type f -name 'majordome-uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')"
  echo "[maintain-uploads] prune OK -> ${PRUNED_COUNT} archive(s) supprimée(s) (> ${KEEP_DAYS} jours)"
fi

if [[ "$DO_RESTORE_CHECK" -eq 1 ]]; then
  if [[ -z "$LAST_ARCHIVE" ]]; then
    LAST_ARCHIVE="$(ls -1t "$OUT"/majordome-uploads-*.tar.gz 2>/dev/null | head -n 1 || true)"
  fi
  if [[ -z "$LAST_ARCHIVE" || ! -f "$LAST_ARCHIVE" ]]; then
    echo '[maintain-uploads][error] aucune archive disponible pour restore-check'
    exit 1
  fi

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  tar -xzf "$LAST_ARCHIVE" -C "$TMP"
  INNER="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$INNER" ]]; then
    echo "[maintain-uploads][error] archive invalide: $LAST_ARCHIVE"
    exit 1
  fi
  FILES_COUNT="$(find "$INNER" -type f | wc -l | tr -d ' ')"
  echo "[maintain-uploads] restore-check OK -> $LAST_ARCHIVE (${FILES_COUNT} fichier(s) extraits en test)"
fi
