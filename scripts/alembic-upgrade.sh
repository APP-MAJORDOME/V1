#!/usr/bin/env bash
# Applique les migrations Alembic du backend (MAJORDOME_DATABASE_URL requis, ex. depuis .env).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/backend"
PY="${PYTHON:-python3.12}"
echo "[alembic-upgrade] cwd=$(pwd) python=${PY}"
exec "${PY}" -m alembic upgrade head
