#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[deploy][error] env file not found: ${ENV_FILE}"
  echo "[deploy][hint] copy config/.env.prod.example to ${ENV_FILE} and fill values"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy][error] docker is required but not installed"
  exit 1
fi

echo "[deploy] using env file: ${ENV_FILE}"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

echo "[deploy] build and start services"
docker compose -f infra/docker-compose.yml --env-file "${ENV_FILE}" up --build -d

echo "[deploy] apply database migrations"
for migration in infra/migrations/*.sql; do
  if [[ -f "${migration}" ]]; then
    echo "[deploy]   → ${migration}"
    bash scripts/migrate.sh "${migration}"
  fi
done

if [[ "${MAJORDOME_ENABLE_DEMO_SEED:-false}" == "true" ]]; then
  echo "[deploy] seed demo dataset (idempotent enough for local/staging)"
  if command -v python3 >/dev/null 2>&1; then
    python3 scripts/seed_demo.py || true
  else
    echo "[deploy] python3 missing locally, skipping seed"
  fi
else
  echo "[deploy] skip demo seed (enable with MAJORDOME_ENABLE_DEMO_SEED=true)"
fi

echo "[deploy] run smoke test"
attempt=1
max_attempts=6
until bash scripts/smoke-test-api.sh; do
  if [[ "${attempt}" -ge "${max_attempts}" ]]; then
    echo "[deploy][error] smoke test failed after ${max_attempts} attempts"
    exit 1
  fi
  echo "[deploy] smoke test failed (attempt ${attempt}/${max_attempts}), retry in 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "[deploy] success"
