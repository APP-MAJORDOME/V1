#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE="${1:-infra/migrations/20260428_add_user_password_hash.sql}"

if [[ ! -f "${MIGRATION_FILE}" ]]; then
  echo "[migrate][error] migration file not found: ${MIGRATION_FILE}"
  exit 1
fi

if [[ -n "${MAJORDOME_DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "[migrate] applying ${MIGRATION_FILE} via MAJORDOME_DATABASE_URL"
  psql "${MAJORDOME_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_FILE}"
  echo "[migrate] done"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "[migrate] applying ${MIGRATION_FILE} via docker compose postgres service"
  docker compose -f infra/docker-compose.yml exec -T postgres \
    psql -U majordome -d majordome -v ON_ERROR_STOP=1 -f - < "${MIGRATION_FILE}"
  echo "[migrate] done"
  exit 0
fi

echo "[migrate][error] neither MAJORDOME_DATABASE_URL nor docker is available"
exit 1
