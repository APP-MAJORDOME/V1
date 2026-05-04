#!/usr/bin/env bash
set -euo pipefail

# Installe un service + timer systemd pour la maintenance uploads MajorDome.
# Usage:
#   sudo bash scripts/install-maintenance-systemd.sh
#   sudo SYSTEMD_ON_CALENDAR="*-*-* 03:17:00" MAJORDOME_ROOT=/opt/majordome bash scripts/install-maintenance-systemd.sh

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[install-maintenance-systemd][error] exécuter en root (sudo)."
  exit 1
fi

MAJORDOME_ROOT="${MAJORDOME_ROOT:-/opt/majordome}"
RUNNER="${MAJORDOME_ROOT}/scripts/run-maintenance-uploads.sh"
ENV_FILE="${ENV_FILE:-${MAJORDOME_ROOT}/.env}"
SYSTEMD_ON_CALENDAR="${SYSTEMD_ON_CALENDAR:-*-*-* 03:17:00}"
UNIT_SERVICE="/etc/systemd/system/majordome-uploads-maintenance.service"
UNIT_TIMER="/etc/systemd/system/majordome-uploads-maintenance.timer"

if [[ ! -x "${RUNNER}" ]]; then
  echo "[install-maintenance-systemd][error] runner introuvable ou non exécutable: ${RUNNER}"
  echo "[install-maintenance-systemd][hint] vérifier le déploiement dans ${MAJORDOME_ROOT}"
  exit 1
fi

cat >"${UNIT_SERVICE}" <<EOF
[Unit]
Description=MajorDome uploads maintenance (backup/prune/restore-check)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${MAJORDOME_ROOT}
Environment=ENV_FILE=${ENV_FILE}
ExecStart=/usr/bin/env bash ${RUNNER}
User=root
Group=root
Nice=10

[Install]
WantedBy=multi-user.target
EOF

cat >"${UNIT_TIMER}" <<EOF
[Unit]
Description=Run MajorDome uploads maintenance daily

[Timer]
OnCalendar=${SYSTEMD_ON_CALENDAR}
Persistent=true
RandomizedDelaySec=120
Unit=majordome-uploads-maintenance.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now majordome-uploads-maintenance.timer
systemctl restart majordome-uploads-maintenance.timer

echo "[install-maintenance-systemd] OK"
echo "[install-maintenance-systemd] Timer: $(systemctl show -p NextElapseUSecRealtime --value majordome-uploads-maintenance.timer || true)"
echo "[install-maintenance-systemd] Run test: systemctl start majordome-uploads-maintenance.service"
