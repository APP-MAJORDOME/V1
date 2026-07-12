# Hub général — connexions et APIs

Document de référence (juin 2026) aligné sur le code réel.  
API unifiée : `GET /api/v1/integrations/hub` (authentifié).

## Est-ce que tout fonctionne ?

| Bloc | Fonctionne en prod si… | État code |
|------|------------------------|-----------|
| Foyer (tâches, courses, coffre, budget) | Utilisateur connecté | **Oui** |
| Alfred texte | `MAJORDOME_LLM_API_KEY` + provider OpenAI/Anthropic | **Oui** (mock sans clé) |
| Calendriers Google / Microsoft | OAuth configuré + utilisateur a connecté | **Oui** |
| TaHoma | Identifiants dans Intégrations | **Oui** |
| Home Assistant | URL + token dans l’app (auto si `HOME_ASSISTANT_AUTO_WHEN_CONNECTED=true`) | **Oui** |
| Trousseau + Drive | Comptes en Réglages → Sécurité | **Partiel** (login + panier Playwright Carrefour, best-effort) |
| Google Home / Legrand / Shark / LSC | Home Assistant + `HOME_ADAPTER_MODE=home_assistant` | **Pont HA** |
| Verisure / Ezviz | Identifiants Intégrations | **Partiel** (armement / test caméra) |
| Documents Alfred | Réglages → base connaissances ou 📎 chat | **Oui** (coffre + analyse PDF) |
| Voix Realtime | Clé OpenAI serveur | **Oui** si `LLM_API_KEY` configurée |

La doc `STATUS_MATRIX.md` est **obsolète** (stubs 5 % alors que Google/Microsoft/HA sont implémentés).

---

## Catalogue connecteurs

### Calendrier & com

| ID | Connexion | API / doc | Route MajorDome | Impl. |
|----|-----------|-----------|-----------------|-------|
| google_calendar | OAuth2 | [Google Calendar API](https://developers.google.com/calendar/api) | `POST /integrations/google/oauth/start` | live |
| microsoft_calendar | OAuth2 | [Microsoft Graph Calendar](https://learn.microsoft.com/graph/api/resources-calendar) | `POST /integrations/microsoft/oauth/start` | live |
| apple_calendar | CalDAV (Apple ID + mot de passe app) | CalDAV | `POST /integrations/apple/connect` | partial |

### Alfred

| ID | Connexion | Variables env | Impl. |
|----|-----------|---------------|-------|
| openai_llm | Clé API | `MAJORDOME_LLM_*` | live |
| alfred_realtime | Clé OpenAI | idem + Realtime | live (si clé configurée) |
| web_search | Aucune (DuckDuckGo) | `MAJORDOME_WEB_SEARCH_ENABLED` | live |
| shopping_advisor | LLM + web | `MAJORDOME_SHOPPING_ADVISOR_ENABLED` | partial (pas d’API enseigne) |

### Retail & trousseau

| ID | Connexion | Solution réelle possible | Impl. |
|----|-----------|--------------------------|-------|
| vault_secrets | Trousseau Fernet | `MAJORDOME_VAULT_ENCRYPTION_KEY` | live |
| drive_carrefour | Trousseau + Playwright | `POST /vault/drive/carrefour/fill-cart` (best-effort) | partial |
| drive_marche_u | Manuel | Courses U — idem | partial |
| drive_leclerc | Manuel | E.Leclerc Drive — idem | partial |

**APIs enseignes :** Carrefour, Leclerc, etc. n’exposent pas d’API commande Drive grand public. Options :

1. **Partenariat B2B** (long, contractuel)
2. **Automation navigateur** (Playwright, fragile, maintenance)
3. **Extension / bookmarklet** MajorDome (remplit panier côté client)
4. **Home Assistant** + intégrations communautaires (courses limitées)

### Domotique

| ID | Connexion | API | Route | Impl. |
|----|-----------|-----|-------|-------|
| home_assistant | URL + long-lived token | [HA REST](https://developers.home-assistant.io/docs/api/rest/) | `POST /home/providers/home_assistant/connect` | live |
| tahoma | Email + MDP Somfy | Overkiz (non documenté public) | `POST /home/providers/credentials` | live |
| google_home | Pont **HA** | Entités Google/Nest dans HA | `POST /home/providers/credentials` | partial |
| legrand_control | Pont **HA** | Legrand/Netatmo via HA | idem | partial |
| verisure | Login + armement (vsure) | [python-verisure](https://github.com/persandstrom/python-verisure) | partial | partial |
| ezviz | Login (pyezviz) | Liste caméras, veille / confidentialité | `GET /home/providers/ezviz/devices`, `POST …/devices/{id}/action` | partial |
| lsc_smart_connect | Pont **HA** | Tuya/LSC via HA | idem | partial |
| sharkclean | Pont **HA** | Aspirateur via HA | idem | partial |

### Communication

| ID | Connexion | Env | Impl. |
|----|-----------|-----|-------|
| twilio_sms | SID + token | `MAJORDOME_TWILIO_*` | partial (délégations) |
| smtp_email | SMTP | `MAJORDOME_SMTP_*` | partial |

---

## Checklist mise en prod (hub complet)

1. **Secrets serveur** : `JWT_SECRET_KEY`, `VAULT_ENCRYPTION_KEY`, `LLM_API_KEY`, OAuth Google/Microsoft
2. **Domotique** : `HOME_ADAPTER_MODE=home_assistant` si HA utilisé
3. **Utilisateur** : connecter calendriers, TaHoma ou HA, trousseau Carrefour
4. **Intégrations** (app) : panneau Hub → actualiser → suivre « À brancher »
5. **Alfred** : tester commandes domotique, drive, courses

---

## Prochaines évolutions (optionnel)

1. Extension navigateur pour panier Drive (plus fiable que Playwright seul)
2. OAuth Microsoft rempli en prod (`config/.env.ec2` ou fusion au deploy)
3. API Google Home native (au lieu du pont HA uniquement)
4. Webhooks / SSE état hub temps réel
5. Refactor `page.tsx` / `routes.py` pour maintenance

---

## Fichiers code clés

| Fichier | Rôle |
|---------|------|
| `backend/app/services/hub_registry.py` | Catalogue + `build_hub_overview` |
| `backend/app/services/home.py` | TaHoma + Home Assistant |
| `backend/app/services/drive_integration.py` | Drive + panier courses |
| `backend/app/services/user_secrets_vault.py` | Trousseau |
| `frontend/components/IntegrationsOverlayPanel.tsx` | UI hub + HA + TaHoma |
