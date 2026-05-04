#!/usr/bin/env bash
set -euo pipefail
[ -f .env ] || cp config/.env.example .env
docker compose -f infra/docker-compose.yml up --build -d
