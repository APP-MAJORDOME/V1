# MajorDome — dossier de référence

MajorDome est un projet de **majordome numérique familial** : un assistant qui agrège les calendriers, suit les tâches et routines, produit des briefings utiles, prépare des actions concrètes et, à terme, orchestre la maison et la veille proactive.

Ce dépôt n'est pas présenté comme une application commerciale déjà terminée. Il constitue un **dossier de référence complet + un socle technique de démarrage** pour construire le produit proprement.

---

## 1) Ce que contient réellement ce dépôt

### Oui, présent dans le dépôt
- un **backend FastAPI** lançable en local ;
- un **frontend Next.js MVP** ;
- un **worker Python minimal** ;
- une **infrastructure locale Docker Compose** ;
- un **modèle de données initial** ;
- une **base de routes API** pour les objets métier principaux ;
- des **docs produit, architecture, déploiement, sécurité, roadmap** ;
- une **cartographie des intégrations tierces** ;
- des **scripts de bootstrap et de démo**.

### Non, pas encore implémenté complètement
- l'authentification/autorisation de niveau production ;
- les connecteurs réels Google Calendar / Microsoft Graph ;
- le bridge Apple natif EventKit/Contacts/Reminders ;
- l'agent LLM outillé de production ;
- la veille web industrielle avec déduplication forte et scoring avancé ;
- la téléphonie, le SMS et les emails réels ;
- l'intégration maison effective vers Home Assistant / Apple Home ;
- les protections RGPD, sécurité, audit et observabilité de niveau production.

### Position honnête du projet
**MajorDome est aujourd'hui un socle de cadrage + bootstrap technique crédible.**
Il ne faut pas le présenter comme un produit fini, mais comme une base sérieuse pour lancer un build V1.

---

## 2) À qui sert ce dépôt

Ce dépôt peut être utilisé pour :
- cadrer le produit et son périmètre ;
- briefer une équipe de développement ;
- servir de base de prototype technique ;
- préparer un chantier MVP ;
- aligner produit / tech / design / infra ;
- préparer une démonstration ou un dossier investisseur plus honnête.

---

## 3) Structure du dépôt

```text
majordome-refonte/
├── README.md
├── CHANGELOG.md
├── .gitignore
├── brand/
│   └── logo/
├── docs/
│   ├── EXECUTIVE_SUMMARY.md
│   ├── PRODUCT_DOSSIER.md
│   ├── STATUS_MATRIX.md
│   ├── ARCHITECTURE.md
│   ├── API_SPEC.md
│   ├── DB_SCHEMA.md
│   ├── THIRD_PARTIES.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY_PRIVACY.md
│   ├── RUNBOOKS.md
│   ├── ROADMAP.md
│   ├── UX_SCREENS.md
│   ├── MOBILE_BRIDGE.md
│   ├── INTEGRATION_STRATEGY.md
│   └── adr/
│       ├── 0001-source-of-truth.md
│       └── 0002-apple-bridge.md
├── backend/
├── worker/
├── frontend/
├── infra/
├── scripts/
├── config/
└── examples/
```

---

## 4) Lecture recommandée

Si tu ouvres ce dépôt pour la première fois, lis dans cet ordre :
1. `docs/EXECUTIVE_SUMMARY.md`
2. `docs/STATUS_MATRIX.md`
3. `docs/PRODUCT_DOSSIER.md`
4. `docs/ARCHITECTURE.md`
5. `docs/THIRD_PARTIES.md`
6. `docs/DEPLOYMENT.md`

---

## 5) Vision produit

MajorDome ne doit pas être “une to-do list de plus” ni “un hub domotique de plus”.
Le produit vise à devenir une **couche d'orchestration familiale intelligente** qui :
- unifie Google / Microsoft / Apple Calendar ;
- crée et suit les tâches récurrentes et contextuelles ;
- détecte les conflits et oublis ;
- génère des briefings utiles ;
- prépare des brouillons d'actions (mail, message, appel, rappel) ;
- fait de la veille proactive sur des opportunités ;
- pilote la maison seulement quand cela aide réellement ;
- limite la multiplication des applications et dépendances.

---

## 6) État réel des briques

| Brique | Statut |
|---|---|
| Backend API MVP | présent |
| Frontend web MVP | présent |
| Worker minimal | présent |
| Modèle household / tâches / événements | présent |
| Détection de conflits basique | présent |
| Briefing quotidien simple | présent |
| Agent conversationnel de production | absent |
| Connecteurs Google réels | absent |
| Connecteurs Microsoft réels | absent |
| Bridge Apple réel | absent |
| Home Assistant réel | absent |
| Auth & RBAC de prod | absent |
| Observabilité de prod | absent |

La matrice détaillée est dans `docs/STATUS_MATRIX.md`.

---

## 7) Stack du socle

### Backend
- Python 3.12+
- FastAPI
- SQLAlchemy 2
- Pydantic 2
- PostgreSQL
- Redis

### Frontend
- Next.js 14
- React
- TypeScript

### Worker
- Python
- boucle simple / scheduler minimal

### Infra
- Docker Compose
- Nginx reverse proxy
- manifests Kubernetes d'exemple

### IA cible
- LLM pour interprétation et génération
- orchestration d'outils
- mémoire structurée
- garde-fous d'exécution

---

## 8) Lancement local

### Pré-requis
- Docker
- Docker Compose
- Node.js si tu lances le front hors conteneur
- Python 3.12 si tu lances l'API localement sans Docker

### Variables d'environnement
```bash
cp config/.env.example .env
```

### Démarrage
```bash
bash scripts/dev-up.sh
```

### Arrêt
```bash
bash scripts/dev-down.sh
```

### URLs utiles
- Frontend : `http://localhost:3000`
- API : `http://localhost:8000`
- OpenAPI : `http://localhost:8000/docs`
- Liveness : `http://localhost:8000/live`
- Readiness : `http://localhost:8000/ready`

### Observabilité API
- chaque réponse inclut `X-Request-Id`
- les erreurs API incluent `detail.request_id` pour corrélation avec les logs backend

### Démo en 5 minutes (avec auth)
1. lancer la stack:
```bash
bash scripts/dev-up.sh
```
1.b appliquer la migration DB:
```bash
bash scripts/migrate.sh
```
2. injecter des données démo:
```bash
python scripts/seed_demo.py
```
3. ouvrir le frontend:
- `http://localhost:3000`
4. se connecter avec:
- email: `demo@majordome.fr`
- mot de passe: `demo12345`
5. vérifier les endpoints protégés:
- login: `POST /api/v1/auth/login`
- refresh: `POST /api/v1/auth/refresh`
- logout: `POST /api/v1/auth/logout`
- briefing: `GET /api/v1/briefings/today` avec `Authorization: Bearer <token>`
6. lancer un smoke test API:
```bash
bash scripts/smoke-test-api.sh
```

### Release interne
- checklist: `docs/RELEASE_INTERNAL_CHECKLIST.md`
- smoke test: `make smoke`
- migration DB: `make migrate`
- deploy script: `make deploy` (ou `bash scripts/deploy.sh .env`)
- deploy remote: `make deploy-remote` (avec `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_DIR`)
- maintenance uploads: `make uploads-maintain`, statut `make uploads-status`
- vérification post-déploiement locale: `make check-deploy`
- vérification post-déploiement locale JSON: `make check-deploy-json`
- vérification post-déploiement locale stricte (codes retour pour alerting): `make check-deploy-strict` ou `make check-deploy-json-strict`
- décodage code strict: `make check-deploy-decode CODE=2`
- sortie notification compacte (Slack/Teams): `make check-deploy-alert` (webhook Slack optionnel : `MAJORDOME_DEPLOY_ALERT_WEBHOOK=...` avant la commande)
- vérification post-déploiement serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote`
- vérification post-déploiement serveur JSON: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-json`
- vérification post-déploiement serveur stricte: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-strict` (ou `...-json-strict`)
- sortie notification serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-alert` (webhook : exporter aussi `MAJORDOME_DEPLOY_ALERT_WEBHOOK`)
- run complet local (maintenance + statut + checks): `make maintenance-full`
- run complet serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] [REMOTE_DIR=/opt/majordome] make maintenance-full-remote`
- script dédié run complet serveur: `bash scripts/maintenance-remote.sh`

---

## 9) Ce qu'il faut construire ensuite

### Priorité immédiate
1. auth + household scoping ;
2. sync réel Google et Microsoft ;
3. canonical calendar ;
4. détection de conflits robuste ;
5. tâches/routines contextuelles ;
6. command bar avec vrai agent outillé ;
7. saved searches + opportunités ;
8. drafts email/message/appel ;
9. bridge Apple ;
10. intégration maison via adaptateur unique.

### À ne pas faire trop tôt
- brancher 20 applications secondaires ;
- construire une domotique riche avant le noyau agenda/tâches/agent ;
- prétendre que l'IA “fait tout” sans politique d'action ;
- confondre prototype et V1 production.

---

## 10) Fichiers critiques

- `docs/STATUS_MATRIX.md` : vérité terrain sur ce qui est implémenté vs prévu.
- `docs/THIRD_PARTIES.md` : tous les tiers et leur rôle.
- `docs/DEPLOYMENT.md` : comment lancer et déployer proprement.
- `docs/INTEGRATION_STRATEGY.md` : ordre d'intégration recommandé.
- `docs/MOBILE_BRIDGE.md` : point clé Apple.

---

## 11) Règle de communication autour du projet

Quand MajorDome est présenté à un tiers, utiliser cette phrase :

> MajorDome est aujourd'hui un produit fortement cadré avec un prototype technique structuré et exécutable en local. Les intégrations critiques, l'agent complet et l'industrialisation restent à construire avant une mise en production.

---

## 12) Licence et usage

Projet propriétaire. Les assets, documents, schémas et code présents ici sont destinés au cadrage, au prototypage et à la construction du produit MajorDome.
