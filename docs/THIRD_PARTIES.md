# Intégrations tierces

## 1. Règle produit
Le produit ne doit pas dépendre de 20 intégrations dès le départ. Les tiers sont classés par criticité.

## 2. Tier 1 — incontournables MVP
### Google Calendar
Rôle : calendrier perso / foyer / écosystème Google.

### Microsoft Graph Calendar
Rôle : calendrier pro / Microsoft 365.

### Apple Calendar / Reminders / Contacts
Rôle : univers Apple, via bridge local.

### Email provider
Rôle : drafts, envoi, suivi des relances.

### Push notifications
Rôle : diffusion des alertes et briefings.

### Web search / RSS
Rôle : veille opportunités.

### Home Assistant
Rôle : exécution maison côté scènes / états / capteurs.

## 3. Tier 2 — utile après MVP
### Doctolib ou équivalent santé
Seulement si le cas d'usage prouve sa valeur.

### Agrégateur bancaire
Seulement pour rappels/abonnements/échéances, pas pour ambition “banque universelle” au départ.

### Énergie / opérateurs
Pour alertes consommation et anomalies.

## 4. Tier 3 — à traiter beaucoup plus tard
- SMS / téléphonie enrichie ;
- assurances ;
- mutuelles ;
- e-commerce / colis ;
- services publics complexes ;
- écoles selon pays/zone.

## 5. Politique de choix d'un tiers
Avant d'intégrer un tiers, valider :
- valeur utilisateur ;
- robustesse API ;
- stabilité ;
- coût ;
- surface RGPD ;
- maintien dans le temps.

## 6. Recommandation d'ordre d'intégration
1. Google Calendar
2. Microsoft Graph
3. Apple bridge
4. Email drafts
5. Web/RSS
6. Home Assistant
7. reste plus tard
