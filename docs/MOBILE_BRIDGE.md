# Mobile bridge Apple

## Pourquoi un bridge ?
Apple Calendar, Reminders et Contacts doivent être traités via une app cliente native utilisant EventKit/Contacts, plutôt qu'attendus comme une intégration serveur aussi simple que Google/Microsoft.

## Rôle du bridge
- lire les changements locaux ;
- synchroniser vers le backend ;
- recevoir certaines écritures autorisées ;
- conserver le contrôle utilisateur sur les permissions Apple.

## Conséquence produit
Le mobile Apple n'est pas “optionnel” si MajorDome veut vraiment couvrir le trio Google / Microsoft / Apple.
