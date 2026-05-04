#!/usr/bin/env bash
set -euo pipefail

# Affiche l'état de la maintenance uploads (cron/systemd/logs/backups).
# Usage:
#   bash scripts/status-maintenance-uploads.sh
#   MAJORDOME_ROOT=/opt/majordome bash scripts/status-maintenance-uploads.sh

MAJORDOME_ROOT="${MAJORDOME_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TAG="# MAJORDOME_UPLOADS_MAINTENANCE"
LOG_DIR="${LOG_DIR:-${MAJORDOME_ROOT}/logs}"
BACKUP_OUT="${BACKUP_OUT:-${MAJORDOME_ROOT}/backups}"

echo "=== MajorDome uploads maintenance status ==="
echo "root: ${MAJORDOME_ROOT}"
echo "logs: ${LOG_DIR}"
echo "backups: ${BACKUP_OUT}"
echo

echo "[cron]"
if crontab -l >/dev/null 2>&1; then
  CRON_LINE="$(crontab -l | rg "${TAG}" || true)"
  if [[ -n "${CRON_LINE}" ]]; then
    echo "installed: yes"
    echo "entry: ${CRON_LINE}"
  else
    echo "installed: no"
  fi
else
  echo "installed: no (no user crontab)"
fi
echo

echo "[systemd]"
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files 2>/dev/null | rg -q '^majordome-uploads-maintenance\.timer'; then
    echo "timer unit: present"
    echo "timer enabled: $(systemctl is-enabled majordome-uploads-maintenance.timer 2>/dev/null || echo unknown)"
    echo "timer active:  $(systemctl is-active majordome-uploads-maintenance.timer 2>/dev/null || echo unknown)"
    echo "next run:      $(systemctl show -p NextElapseUSecRealtime --value majordome-uploads-maintenance.timer 2>/dev/null || echo unknown)"
    echo "last service:  $(systemctl show -p ActiveEnterTimestamp --value majordome-uploads-maintenance.service 2>/dev/null || echo unknown)"
  else
    echo "timer unit: absent"
  fi
else
  echo "systemctl not available"
fi
echo

echo "[logs]"
LATEST_LOG="$(ls -1t "${LOG_DIR}"/uploads-maintenance-*.log 2>/dev/null | head -n 1 || true)"
if [[ -n "${LATEST_LOG}" ]]; then
  echo "latest: ${LATEST_LOG}"
  echo "tail:"
  tail -n 8 "${LATEST_LOG}" || true
else
  echo "latest: none"
fi
echo

echo "[backups]"
if [[ -d "${BACKUP_OUT}" ]]; then
  COUNT="$(ls -1 "${BACKUP_OUT}"/majordome-uploads-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')"
  echo "count: ${COUNT}"
  echo "latest 3:"
  ls -1t "${BACKUP_OUT}"/majordome-uploads-*.tar.gz 2>/dev/null | head -n 3 || true
else
  echo "directory missing"
fi
