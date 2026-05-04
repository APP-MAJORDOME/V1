#!/usr/bin/env bash
# Déploiement complet vers le VPS (ex. majordom.eu).
# Prérequis : Docker local OU Docker sur la machine distante, SSH par clé, rsync.
#
# Usage sur TA machine (avec tes clés SSH) :
#   cd majordome-refonte_chatgpt
#   export REMOTE_HOST=13.63.50.21        # ou majordom.eu
#   export REMOTE_USER=ubuntu              # souvent ubuntu sur Ubuntu AMI ; ec2-user sur Amazon Linux
#   export REMOTE_SSH_KEY=~/Downloads/clef_vha.pem
#   export REMOTE_DIR=/opt/majordome      # optionnel
#   export DEPLOY_ENV_FILE=/chemin/vers/.env   # optionnel — fichier exact envoyé sur le VPS
#   bash scripts/deploy-majordom-eu.sh
#
# Comportement par défaut :
#   - On déploie config/.env.ec2 (réglages prod : CORS majordom.eu, JWT, DB Docker…).
#   - Si MAJORDOME_LLM_API_KEY est vide dans .ec2 mais présente dans .env à la racine (ex. clé
#     configurée dans Cursor), on injecte uniquement cette ligne pour le fichier envoyé au VPS.
#   Ne pas envoyer tout le .env local tel quel : il contient souvent CORS localhost → casse la prod.
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

EC2_ENV="${ROOT}/config/.env.ec2"
ROOT_ENV="${ROOT}/.env"
MERGED_ENV=""
cleanup_merged() {
  if [[ -n "${MERGED_ENV}" && -f "${MERGED_ENV}" ]]; then
    rm -f "${MERGED_ENV}"
  fi
}
trap cleanup_merged EXIT

llm_key_value_in_file() {
  local f="$1"
  [[ -f "${f}" ]] || return 1
  local line
  line="$(grep -E '^MAJORDOME_LLM_API_KEY=' "${f}" 2>/dev/null | tail -1 || true)"
  [[ -n "${line}" ]] || return 1
  local v="${line#MAJORDOME_LLM_API_KEY=}"
  v="${v#\"}"
  v="${v%\"}"
  v="${v#\'}"
  v="${v%\'}"
  [[ -n "${v// /}" ]]
}

if [[ -n "${DEPLOY_ENV_FILE:-}" ]]; then
  ENV_FILE="${DEPLOY_ENV_FILE}"
elif [[ ! -f "${EC2_ENV}" ]]; then
  echo "[deploy-majordom-eu] Fichier prod introuvable: ${EC2_ENV}"
  exit 1
elif llm_key_value_in_file "${EC2_ENV}"; then
  ENV_FILE="${EC2_ENV}"
elif llm_key_value_in_file "${ROOT_ENV}"; then
  echo "[deploy-majordom-eu] Clé OpenAI trouvée dans .env racine → fusion avec config/.env.ec2 (sans écraser CORS/JWT prod)."
  MERGED_ENV="$(mktemp)"
  grep -v -E '^MAJORDOME_LLM_API_KEY=' "${EC2_ENV}" > "${MERGED_ENV}"
  grep -E '^MAJORDOME_LLM_API_KEY=' "${ROOT_ENV}" | tail -1 >> "${MERGED_ENV}"
  ENV_FILE="${MERGED_ENV}"
else
  ENV_FILE="${EC2_ENV}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[deploy-majordom-eu] Fichier env introuvable: ${ENV_FILE}"
  exit 1
fi

if [[ -z "${REMOTE_HOST:-}" || -z "${REMOTE_USER:-}" ]]; then
  echo "[deploy-majordom-eu] Définis REMOTE_HOST et REMOTE_USER, par exemple :"
  echo "  export REMOTE_HOST=majordom.eu REMOTE_USER=ubuntu"
  exit 1
fi

echo "[deploy-majordom-eu] Build frontend local (vérif)…"
(cd frontend && npm ci --silent 2>/dev/null || npm install --silent)
(cd frontend && npm run build)

echo "[deploy-majordom-eu] Env: ${ENV_FILE} → ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR:-/opt/majordome}"
bash scripts/deploy-remote.sh "${ENV_FILE}"

echo "[deploy-majordom-eu] Terminé. Ouvre https://majordom.eu/ (Ctrl+F5 pour forcer le rechargement du cache)."
