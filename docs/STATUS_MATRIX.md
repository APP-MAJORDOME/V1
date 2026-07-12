# Matrice d'état du projet

> **Attention (juin 2026)** : cette matrice est **largement dépassée** par l’implémentation actuelle (Alfred, OAuth calendriers, TaHoma, Home Assistant, trousseau, Drive manuel, deploy majordom.eu).  
> **Référence à jour** : [HUB_CONNECTIONS.md](./HUB_CONNECTIONS.md) et `GET /api/v1/integrations/hub`.

Cette matrice historique décrivait le bootstrap initial. Elle est conservée pour contexte.

| Domaine | Élément | Statut | Commentaire |
|---|---|---:|---|
| Produit | Vision générale | 90% | bien cadrée |
| Produit | Périmètre MVP | 80% | encore à verrouiller plus strictement |
| Produit | Policy d'autonomie | 40% | principes présents, pas finalisés |
| UX | Écrans majeurs décrits | 75% | docs présentes |
| UX | Front utilisable par un utilisateur final | 35% | MVP visuel, pas une expérience aboutie |
| Backend | API FastAPI | 65% | base saine, logique encore partielle |
| Backend | Modèle household | 60% | présent mais à renforcer |
| Backend | Canonical event model | 55% | amorcé |
| Backend | Détection de conflits | 35% | basique |
| Backend | Briefing | 35% | simple |
| Backend | Agent orchestration | 20% | stub / logique naïve |
| Backend | Actions assistées | 25% | structure présente, peu d'exécution réelle |
| Backend | RBAC / permissions | 10% | non industrialisé |
| Backend | Audit trail | 10% | surtout documentaire |
| Intégrations | Google Calendar | 5% | connecteur stub |
| Intégrations | Microsoft Graph | 5% | connecteur stub |
| Intégrations | Apple Calendar bridge | 5% | doc, pas d'implémentation réelle |
| Intégrations | Email | 5% | non branché |
| Intégrations | Téléphonie/SMS | 0% | absent |
| Intégrations | Home Assistant | 5% | adaptateur conceptuel |
| Intégrations | Web search / RSS | 10% | structure prévue, pas de moteur robuste |
| Worker | Tâches planifiées | 20% | boucle minimale |
| Frontend | Dashboard MVP | 45% | base présente |
| Frontend | Calendrier unifié | 20% | à enrichir fortement |
| Frontend | Command bar agentique | 15% | non aboutie |
| Mobile | iOS/macOS natif | 0% | non implémenté |
| Infra | Docker Compose | 70% | bon pour dev local |
| Infra | Kubernetes production-ready | 10% | exemples seulement |
| Sécurité | Auth de prod | 10% | insuffisant |
| Sécurité | Secrets management | 15% | à compléter |
| Observabilité | logs/metrics/traces | 10% | à construire |
| Documentation | README | 95% | source de vérité claire |
| Documentation | Architecture | 90% | propre |
| Documentation | Tiers/intégrations | 90% | claire |
| Documentation | Déploiement | 85% | bonne base |

## Légende
- **0–10%** : absent ou conceptuel
- **15–35%** : prototype / stub
- **40–65%** : base utile mais incomplète
- **70–85%** : prêt pour un chantier de build
- **90%+** : mature dans le cadre du dossier

## Message à retenir
Le dépôt est **solide comme dossier de référence et comme bootstrap technique**.
Il n'est **pas** honnête de le vendre comme une application complète déjà prête au marché.
