#!/usr/bin/env bash
set -euo pipefail
#
# Déploiement public (VPS) comme décrit dans docs/DEPLOYMENT.md —
# à lancer depuis TON Mac/Linux où SSH et Docker distants fonctionnent.
#
# Usage typique (copier `.env` de prod ou utiliser la config EC2 du dépôt) :
#
#   export REMOTE_HOST=51.xx.xx.xx    # ou l’IP/host du VPS qui sert majordom.eu / majordome.eu
#   export REMOTE_USER=ec2-user       # ou ubuntu, selon l’AMI
#   export REMOTE_DIR=/opt/majordome
#   export REMOTE_SSH_KEY=~/.ssh/ta-clef.pem   # si nécessaire
#
#   cd "$(dirname "$0")/.."
#   bash scripts/deploy-public-remote.sh config/.env.ec2
#
# Le fichier env doit contenir NEXT_PUBLIC_API_BASE=https://api.<ton-domaine>
# pour que le front Docker soit compilé avec la bonne URL API.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

ENV_FILE="${1:-config/.env.ec2}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[deploy-public-remote][error] fichier env introuvable : ${ENV_FILE}"
  echo "[hint] cp config/.env.prod.example .env && éditer, ou passer config/.env.ec2"
  exit 1
fi

if [[ -z "${REMOTE_HOST:-}" || -z "${REMOTE_USER:-}" ]]; then
  echo "[deploy-public-remote][error] REMOTE_HOST et REMOTE_USER sont obligatoires"
  echo "[hint] export REMOTE_HOST=… REMOTE_USER=ec2-user [REMOTE_SSH_KEY=~/.ssh/key.pem]"
  exit 1
fi

exec bash scripts/deploy-remote.sh "${ENV_FILE}"
