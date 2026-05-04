# Architecture technique

## 1. Principe directeur
La vérité métier doit vivre dans MajorDome, pas dans les applications tierces. Les systèmes externes sont des **sources et des cibles**, pas le cerveau du produit.

## 2. Vue logique
```text
Clients (Web / iOS / macOS)
  -> API / BFF
    -> Identity & Household
    -> Connectors
    -> Calendar Sync
    -> Task & Routine Engine
    -> Rule Engine
    -> Agent Orchestrator
    -> Opportunity Engine
    -> Home Adapter
    -> Notification Service
    -> Audit / Logs
    -> PostgreSQL / Redis
```

## 3. Couches
### Clients
- Web pour cockpit, admin, dashboard.
- iOS/macOS pour expérience premium et bridge Apple.

### API/BFF
- auth ;
- agrégation ;
- permissions ;
- payloads UI.

### Connectors
- google ;
- microsoft ;
- apple bridge ;
- email ;
- home assistant ;
- web/rss.

### Calendar Sync
- ingestion ;
- mapping ;
- déduplication ;
- canonicalisation ;
- détection de changements.

### Task & Routine Engine
- tâches manuelles ;
- récurrentes ;
- contextuelles ;
- follow-up ;
- préparation.

### Rule Engine
- règles dures ;
- séquences simples ;
- garde-fous.

### Agent Orchestrator
- parsing intent ;
- récupération contexte ;
- sélection outils ;
- proposition / exécution.

### Opportunity Engine
- recherches planifiées ;
- scoring ;
- résumé ;
- action recommandée.

### Home Adapter
- interface unique vers maison ;
- scènes plutôt que pilotage appareil par appareil.

## 4. Décisions structurantes
### A. Source de vérité interne
Indispensable pour éviter la fragmentation.

### B. Séparation lecture / proposition / exécution
Chaque action doit être traçable.

### C. Apple via bridge local
À cause des contraintes EventKit, Apple doit passer par une app cliente bridge.

### D. Maison comme sous-système
Le produit n'est pas un clone de Home Assistant.

### E. Règles + IA
Ne pas confier le critique uniquement à un LLM.

## 5. Déploiement cible
### Local
Docker Compose.

### Staging
Backend, frontend, worker, DB managée, Redis, logs centralisés.

### Production
Services séparés, secrets managés, observabilité, scaling des workers, files d'attente réelles.
