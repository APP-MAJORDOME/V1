# Audit des captures réelles — MajorDome, 07/07/2026

9 captures analysées (Aujourd'hui, Salon, Agenda ×2, Alfred, Moi ×2, Moi d'abord ×2). Chaque constat renvoie aux tâches de la spécification (fichier 01) et aux maquettes cibles (fichier 03). Une nouvelle tâche bloquante s'ajoute à la Phase 0 : P0-7.

## P0-7 (NOUVELLE — bloquante) : qualité du français
Constaté à l'écran :
- Accents manquants : « Creer evenement », « Generer courses depuis repas », « Ingredients manquants », « 1 tache(s) ouverte(s) ».
- Apostrophe manquante : « Ajouter depuis l application ».
- Espace manquant : « BonjourJoanne » (concaténation salutation + prénom).
- Pluriels bricolés : « 2 chose(s) à régler », « 1 ouverte(s) », « 1 terminée(s) au foyer · 0 affichée(s) ici ».
- Bug d'interpolation : « Quelles sont mes 1 priorités aujourd'hui ? ».
- Dates ISO brutes exposées : champs « 2026-07-07 », « Jours avec notes : 2026-06-01 ».

Correctifs : centraliser 100 % des chaînes dans fr.json (règle R5) avec une vraie fonction de pluralisation (« 1 chose à régler » / « 2 choses à régler ») et d'accord en genre par membre ; formater toutes les dates en langage humain (« mardi 7 juillet ») ; relecture typographique complète (accents, apostrophes, espaces insécables avant : ! ?).
CA : zéro « (s) », zéro date ISO, zéro accent ou apostrophe manquant sur l'ensemble des écrans.

## 01 — Aujourd'hui
Constaté : emoji utilisés comme icônes (calendrier, coche, glaçon) ; barres de couleur attribuées aux modules (vert Courses, jaune Coffre, orange Routines, violet Recettes) alors que la couleur doit coder les membres ; boutons ambigus (« Frigo », « Voir ») ; « Voir toutes les tâches (1) » en pointillés ; compteurs redondants sous le bloc Maintenant.
Cible (maquette 01) : trois blocs — Maintenant, Balance de la semaine, Modules (F1-4) ; iconographie unifiée (D2-2) ; la couleur code exclusivement les membres (D2-1) ; état de l'accueil cohérent et persistant.

## 02 — Salon
Constaté : « Utilisateur MajorDome » affiché comme nom d'expéditeur ; Alfred traite en lot à 08:50 des messages de 22:50 et 00:50 ; propositions = simple re-citation entre guillemets, sans type, date, assigné ni action ; Alfred en violet, hors identité visuelle ; proposition de capture sur une question ouverte (« Toussaint, on fait quoi cette année ? ») sans action détectable.
Cible (maquette 02) : chips de capture structurées (type, date parsée, assigné) validables en 1 tap (F1-2) ; capture en quasi temps réel ; Alfred membre du Salon dans l'identité maison ; filtrage des signaux faibles — une question ouverte déclenche au mieux une proposition d'événement, jamais une re-citation.

## 03 — Agenda (haut de page)
Constaté : jour vide qui exige la connexion Google/Outlook ; bloc « Journal intime » en plein agenda (doublon confirmé) ; formulaire long Titre/Début/Fin ; « Ajouter depuis l application » ; « Creer evenement ».
Cible (maquette 03) : création en langage naturel (même parseur que le Salon) ; deux événements de démonstration tant qu'aucune source n'est connectée ; filtres par membre avec pastilles de couleur ; journal retiré (il vit dans l'espace privé, F1-7).

## 03b — Agenda (bas de page)
Constaté : « Plan repas (jour) » avec date ISO et champ « Ingredients manquants (virgules) » — instruction technique dans le placeholder ; méta « Dans l'app : 1 ouverte(s) · Sur le foyer (serveur) : 1 » — le mot serveur visible ; bouton « Tout recharger depuis le serveur » (confirmé, cf. P0-1).
Cible : plan repas simplifié relié aux Recettes et au Frigo (F1-5, F1-6) ; compteurs techniques supprimés ; synchronisation silencieuse + pull-to-refresh ; tâches intégrées à la timeline du jour.

## 04 — Alfred
Constaté : « 0 notes mémorisées » ; suggestion buguée « Quelles sont mes 1 priorités aujourd'hui ? » ; ton « Coucou, je suis Alfred » ; aide technique « Photos, PDF, Word (.docx) ou texte — jusqu'à 12 Mo » ; case « Lire les réponses (navigateur) » ; grande zone vide ; micro et haut-parleur flottants déconnectés de la zone de saisie.
Cible (maquette 04) : « Mémoire du foyer · n faits » lisible et éditable ; suggestions dynamiques selon le contexte ; voix majordome (« Bien noté. », « Je m'en occupe. ») ; actions visibles et annulables (F1-3) ; une seule zone de saisie unifiée (texte, photo, voix) sans jargon.

## 05 et 06 — Moi (hub de modules)
Constaté : « Déconnexion » parmi les actions les plus visibles en haut de l'écran ; grille avec cartes orphelines ; section « Bientôt disponible — pas encore utilisables » ; Wallet en doublon de Courses & Frigo ; sous-titres télégraphiques (« Liste · DLC · wallet »).
Cible (maquette 05) : onglet renommé « Foyer » ; l'équité en tête d'écran ; sections Quotidien / Foyer en cartes uniformes ; « Gérer les modules » pour activer/désactiver les satellites (F1-6) ; compte et déconnexion relégués dans les réglages ; placeholders retirés (P0-5) ; entrée « Ton espace » privée en bas (F1-7).

## 07 et 08 — Moi d'abord (bien-être)
Constaté : humeur en emoji avec libellés féminins figés (« Épuisée », « Stressée ») ; sommeil en champ numérique brut ; « Cycle : J18 » affiché dans les « Stats bien-être hebdo » de l'onglet partagé — fuite de donnée intime ; journal avec dates ISO et renvoi confus vers l'Agenda ; « + Tâche » sur les moments pour soi ; « Tu as 1 tache(s) ouverte(s) ».
Cible (maquette 06) : espace privé accessible par l'avatar, badge « Visible uniquement par toi », protégeable par code/biométrie ; libellés d'humeur neutres (« À plat », « Sous pression ») ou accordés au genre du membre ; slider de sommeil ; cycle en accordéon privé, jamais agrégé ni affiché ailleurs ; dates humaines ; « Planifier » au lieu de « + Tâche ».

## Correspondance captures → maquettes cibles
- 01-aujourdhui.png → maquette 01 (+ 07 pour la balance)
- 02-salon.png → maquette 02
- 03-agenda-haut.png et 03b-agenda-bas.png → maquette 03
- 04-alfred.png → maquette 04
- 05-moi-grille-quotidien.png et 06-moi-grille-foyer-outils.png → maquette 05
- 07-moi-dabord-bienetre.png et 08-moi-dabord-suite.png → maquette 06
- Nouveaux écrans sans équivalent actuel : 07 Équité v2, 08-09 Onboarding, 10 Paywall.
