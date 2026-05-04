#!/usr/bin/env bash
set -euo pipefail

# Traduit les codes de sortie strict de check-deployment en message lisible.
# Usage:
#   bash scripts/check-deployment-exit-code.sh 0
#   bash scripts/check-deployment-exit-code.sh 2

CODE="${1:-}"
if [[ -z "${CODE}" ]]; then
  echo "usage: bash scripts/check-deployment-exit-code.sh <code>"
  exit 1
fi

case "${CODE}" in
  0) echo "OK: déploiement sain (health + ready + dépendances)";;
  1) echo "Erreur d'usage / argument invalide";;
  2) echo "Health KO: endpoint /health inaccessible ou invalide";;
  3) echo "Ready KO: status != ready";;
  4) echo "Ready check KO: database=false";;
  5) echo "Ready check KO: redis=false";;
  6) echo "Ready check KO: upload_dir=false";;
  *) echo "Code non documenté: ${CODE}";;
esac
