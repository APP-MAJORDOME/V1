# Sécurité et vie privée

## 1. Nature du risque
MajorDome manipule potentiellement :
- calendriers ;
- identité familiale ;
- tâches du quotidien ;
- données de maison ;
- emails ;
- historique d'actions ;
- données potentiellement sensibles selon les intégrations futures.

## 2. Principes obligatoires
- minimisation des données ;
- séparation des espaces perso / pro / foyer ;
- consentement explicite par intégration ;
- journalisation des actions ;
- révocation simple ;
- chiffrement en transit et au repos ;
- politique d'accès par rôle.

## 3. Ce qui manque aujourd'hui
- RBAC robuste ;
- audit trail complet ;
- gestion fine des tokens tiers ;
- observabilité sécurité ;
- processus de rotation de secrets ;
- data retention policy finalisée.

## 4. Politique recommandée
### Perso / pro / foyer
Chaque source doit être taggée, scoppée et gouvernée.

### Actions agentiques
L'agent ne doit jamais passer directement de “lecture” à “exécution” sans politique explicite.

### Logs
Tracer :
- qui a demandé quoi ;
- quelles données ont été lues ;
- quelle suggestion a été générée ;
- quelle exécution a eu lieu.

## 5. RGPD
À préparer sérieusement avant toute commercialisation :
- registre de traitements ;
- base légale ;
- DPA sous-traitants ;
- droits d'accès/suppression ;
- politique de conservation.
