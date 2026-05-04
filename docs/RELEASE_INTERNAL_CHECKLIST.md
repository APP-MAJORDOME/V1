# Release interne - checklist

Cette checklist sert a valider rapidement une version "demo interne" de MajorDome.

## 1) Pre-flight environnement
- `.env` present et renseigne (`cp config/.env.example .env` si besoin)
- stack demarree (`bash scripts/dev-up.sh`)
- migrations appliquees (`bash scripts/migrate.sh`)
- services OK (`make ps` ou `docker compose -f infra/docker-compose.yml ps`)
- API accessible (`http://localhost:8000/health`)
- frontend accessible (`http://localhost:3000`)

## 2) Donnees de demo
- seed execute sans erreur:
  - `python scripts/seed_demo.py`
- login demo possible avec `demo@majordome.fr`

## 3) Smoke test API
- lancer:
  - `bash scripts/smoke-test-api.sh`
- verifier:
  - auth/login OK
  - endpoints proteges refusent sans token
  - briefing/events/tasks/conflicts/home repondent avec token

## 4) Verifications fonctionnelles UI
- connexion depuis le front OK
- briefing affiche counts et priorites
- agenda affiche des evenements
- taches ouvertes visibles
- conflits visibles si seed charge

## 5) Integrations et worker
- OAuth Google configure (si demo integration)
- `POST /api/v1/accounts/{id}/sync` fonctionne pour compte Google connecte
- logs worker sans erreurs en boucle:
  - `docker compose -f infra/docker-compose.yml logs -f worker`

## 6) Qualite minimale
- lints locaux sans nouvelles erreurs bloquantes
- tests backend critiques executes (si `pytest` installe)
- pas de secret commite dans le repo

## 7) Go / No-Go interne
- **GO** si:
  - smoke test API OK
  - UI exploitable sans blocage
  - aucun crash backend/worker
- **NO-GO** si:
  - auth indisponible
  - endpoints proteges incoherents
  - sync Google plante de facon systematique
