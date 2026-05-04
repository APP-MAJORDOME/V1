#!/usr/bin/env bash
set -euo pipefail

# Désinstalle la maintenance uploads (cron et/ou systemd).
# Usage:
#   bash scripts/uninstall-maintenance-uploads.sh --cron
#   sudo bash scripts/uninstall-maintenance-uploads.sh --systemd
#   sudo bash scripts/uninstall-maintenance-uploads.sh --all

REMOVE_CRON=0
REMOVE_SYSTEMD=0
TAG="# MAJORDOME_UPLOADS_MAINTENANCE"
UNIT_SERVICE="/etc/systemd/system/majordome-uploads-maintenance.service"
UNIT_TIMER="/etc/systemd/system/majordome-uploads-maintenance.timer"

usage() {
  cat <<'EOF'
Usage: bash scripts/uninstall-maintenance-uploads.sh [options]

Options:
  --cron         Supprime l'entrée cron de maintenance uploads
  --systemd      Supprime le service + timer systemd
  --all          Supprime cron + systemd
  -h, --help     Affiche cette aide
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cron)
      REMOVE_CRON=1
      ;;
    --systemd)
      REMOVE_SYSTEMD=1
      ;;
    --all)
      REMOVE_CRON=1
      REMOVE_SYSTEMD=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[uninstall-maintenance-uploads][error] option inconnue: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$REMOVE_CRON" -eq 0 && "$REMOVE_SYSTEMD" -eq 0 ]]; then
  echo "[uninstall-maintenance-uploads][error] aucune action demandée."
  usage
  exit 1
fi

if [[ "$REMOVE_CRON" -eq 1 ]]; then
  TMP="$(mktemp)"
  trap 'rm -f "${TMP}"' EXIT
  if crontab -l >/dev/null 2>&1; then
    crontab -l | sed "/${TAG//\//\\/}/d" >"${TMP}"
    crontab "${TMP}"
    echo "[uninstall-maintenance-uploads] cron nettoyé"
  else
    echo "[uninstall-maintenance-uploads] aucun cron utilisateur à nettoyer"
  fi
fi

if [[ "$REMOVE_SYSTEMD" -eq 1 ]]; then
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "[uninstall-maintenance-uploads][error] --systemd requiert root (sudo)."
    exit 1
  fi
  systemctl disable --now majordome-uploads-maintenance.timer >/dev/null 2>&1 || true
  systemctl stop majordome-uploads-maintenance.service >/dev/null 2>&1 || true
  rm -f "${UNIT_TIMER}" "${UNIT_SERVICE}"
  systemctl daemon-reload
  systemctl reset-failed >/dev/null 2>&1 || true
  echo "[uninstall-maintenance-uploads] systemd nettoyé"
fi

echo "[uninstall-maintenance-uploads] OK"
