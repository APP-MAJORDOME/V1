# Executive summary

## Positionnement
MajorDome est conçu comme un **majordome numérique familial** : une couche d'orchestration qui agrège les systèmes du quotidien, comprend le contexte, propose des actions et, à terme, exécute une partie de ces actions avec validation adaptée.

## Problème adressé
Les familles utilisent déjà des briques utiles : Google Calendar, Outlook, Apple Calendar, assistants vocaux, rappels, emails, parfois domotique. Le problème n'est pas l'absence d'outils, mais l'absence d'une **couche de coordination et d'anticipation** capable de :
- consolider les calendriers ;
- détecter les conflits ;
- préparer les actions avant qu'un problème arrive ;
- suivre les routines ;
- remonter des opportunités externes utiles ;
- générer un minimum de charge mentale en moins.

## Ce que le produit doit devenir
- unifier les calendriers Google / Microsoft / Apple ;
- gérer tâches et routines de foyer ;
- produire des briefings réellement utiles ;
- préparer mails, messages, appels et rappels ;
- lancer des recherches web récurrentes ;
- proposer des opportunités ;
- commander la maison si cela aide le quotidien ;
- respecter strictement la séparation perso / pro / foyer.

## Ce que ce dépôt apporte aujourd'hui
- un cadre produit propre ;
- un backend et un frontend MVP de départ ;
- une infra locale ;
- des docs utilisables ;
- une base crédible pour lancer la V1.

## Ce que ce dépôt n'apporte pas encore
- les intégrations critiques en réel ;
- l'agent complet ;
- la sécurité production ;
- l'observabilité ;
- l'industrialisation.

## Décision stratégique recommandée
Construire MajorDome en trois vagues :
1. **noyau agenda / tâches / briefing / actions assistées** ;
2. **veille proactive / opportunités / follow-up** ;
3. **maison, mobile bridge Apple, exécution plus autonome**.
