#!/usr/bin/env bash
# Vérifie l'état des intégrations Majordome en production.
set -euo pipefail

API="${API_BASE:-https://api.majordom.eu}"
EMAIL="${MAJORDOME_CHECK_EMAIL:-demo@majordome.fr}"
PASSWORD="${MAJORDOME_CHECK_PASSWORD:-demo12345}"

LOGIN=$(curl -fsS -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Check\"}")
TOKEN=$(echo "$LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

echo "=== Capacités serveur ($API) ==="
curl -fsS "$API/api/v1/integrations/capabilities" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== Hub intégrations (connecteurs non prêts pour Alfred) ==="
HUB_JSON=$(curl -fsS "$API/api/v1/integrations/hub" -H "Authorization: Bearer $TOKEN")
echo "$HUB_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('Résumé:', d.get('summary'))
print()
for c in d.get('connectors', []):
    if not c.get('ready_for_alfred'):
        hint = c.get('status_hint') or ''
        print(f\"- {c['label']:28} configured={c.get('configured')} connected={c.get('connected')}  {hint}\")
"

echo ""
echo "=== Domotique (providers) ==="
curl -fsS "$API/api/v1/home/providers" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
