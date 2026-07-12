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
#   - Si certaines clés sont vides dans .ec2 mais présentes dans .env à la racine, on les fusionne
#     (OpenAI, Microsoft OAuth) sans écraser CORS/JWT prod.
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

env_var_nonempty() {
  local f="$1"
  local key="$2"
  [[ -f "${f}" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "${f}" 2>/dev/null | tail -1 || true)"
  [[ -n "${line}" ]] || return 1
  local v="${line#*=}"
  v="${v#\"}"
  v="${v%\"}"
  v="${v#\'}"
  v="${v%\'}"
  [[ -n "${v// /}" ]]
}

# Clés injectées depuis .env racine si vides dans .env.ec2
_MERGE_KEYS=(
  MAJORDOME_LLM_API_KEY
  MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID
  MAJORDOME_MICROSOFT_OAUTH_CLIENT_SECRET
  MAJORDOME_GOOGLE_OAUTH_CLIENT_ID
  MAJORDOME_GOOGLE_OAUTH_CLIENT_SECRET
  MAJORDOME_TELEGRAM_BOT_TOKEN
  MAJORDOME_TELEGRAM_WEBHOOK_SECRET
  MAJORDOME_WHATSAPP_ACCESS_TOKEN
  MAJORDOME_WHATSAPP_PHONE_NUMBER_ID
  MAJORDOME_WHATSAPP_APP_SECRET
  MAJORDOME_WHATSAPP_VERIFY_TOKEN
  MAJORDOME_WHATSAPP_DISPLAY_PHONE
  MAJORDOME_STRIPE_SECRET_KEY
  MAJORDOME_STRIPE_WEBHOOK_SECRET
  MAJORDOME_STRIPE_PRICE_ID
  MAJORDOME_PREMIUM_FOUNDER_CODE
)

merge_prod_env() {
  local base="${EC2_ENV}"
  local need_merge=false
  local k
  for k in "${_MERGE_KEYS[@]}"; do
    if ! env_var_nonempty "${base}" "${k}" && env_var_nonempty "${ROOT_ENV}" "${k}"; then
      need_merge=true
      break
    fi
  done
  if [[ "${need_merge}" != "true" ]]; then
    echo "${base}"
    return
  fi
  echo "[deploy-majordom-eu] Fusion .env racine → config/.env.ec2 (clés manquantes en prod uniquement)." >&2
  MERGED_ENV="$(mktemp)"
  cp "${base}" "${MERGED_ENV}"
  for k in "${_MERGE_KEYS[@]}"; do
    if ! env_var_nonempty "${MERGED_ENV}" "${k}" && env_var_nonempty "${ROOT_ENV}" "${k}"; then
      grep -v -E "^${k}=" "${MERGED_ENV}" > "${MERGED_ENV}.tmp"
      mv "${MERGED_ENV}.tmp" "${MERGED_ENV}"
      grep -E "^${k}=" "${ROOT_ENV}" | tail -1 >> "${MERGED_ENV}"
      echo "[deploy-majordom-eu]   + ${k} depuis .env racine" >&2
    fi
  done
  echo "${MERGED_ENV}"
}

if [[ -n "${DEPLOY_ENV_FILE:-}" ]]; then
  ENV_FILE="${DEPLOY_ENV_FILE}"
elif [[ ! -f "${EC2_ENV}" ]]; then
  echo "[deploy-majordom-eu] Fichier prod introuvable: ${EC2_ENV}"
  exit 1
else
  ENV_FILE="$(merge_prod_env)"
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
