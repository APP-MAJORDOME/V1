#!/usr/bin/env bash
set -euo pipefail
cp -n config/.env.example .env || true
echo "Bootstrap terminé. Édite .env si nécessaire."
