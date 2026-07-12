# MajorDome — Mise à niveau Fond & Forme (v1 → v2)

Document d'exécution destiné à une IA de développement (Claude Code ou équivalent). Basé sur l'audit exhaustif écran par écran du 07/07/2026 (onboarding, Aujourd'hui, Salon, Agenda, Alfred, Moi et ses ~15 modules, Paramètres).

**État constaté :** MVP avancé, riche en fonctions mais dilué, avec des fuites techniques vers l'utilisateur final, des placeholders visibles, des doublons, et aucune couche de monétisation.
**Objectif de cette v2 :** un produit resserré autour d'une promesse unique, digne de confiance, visuellement signé, et prêt à encaisser.

---

## Prompt de démarrage (à coller à ton IA avec ce document)

> Tu es chargé de mettre à niveau l'application MajorDome en suivant ce document à la lettre. Exécute les phases dans l'ordre strict : Phase 0, puis 1, puis 2, puis 3. Traite une tâche à la fois (elles ont des identifiants P0-x, F1-x, D2-x, M3-x), fais un commit par tâche, et ne considère une tâche terminée que lorsque tous ses critères d'acceptation (CA) passent. Les Règles transverses R1 à R6 s'appliquent à chaque écran que tu touches. Si une tâche entre en conflit avec le code existant, propose la solution la plus proche de l'intention du document avant d'implémenter. Commence par me lister les tâches de la Phase 0 avec ton estimation, puis attaque P0-1.

---

## Règles transverses (s'appliquent à CHAQUE écran touché)

- **R1 — Zéro vocabulaire technique visible.** Termes interdits dans toute l'interface : env, .env, OAuth, redéploie(r), backend, serveur, Playwright, Azure, RAG, cookie, sessionStorage, "brancher", noms de variables, chemins de fichiers.
- **R2 — Écrans vides utiles.** Chaque état vide affiche : 1 icône + 1 phrase d'invitation + 1 bouton d'action. Un écran vide est une invitation à agir, jamais une impasse.
- **R3 — Feedback immédiat.** Toute action utilisateur produit un retour visible en moins de 300 ms (toast, coche animée, changement d'état).
- **R4 — Tout côté serveur.** Les données du foyer sont stockées serveur et partagées entre appareils. Fin des stockages "sur cet appareil" (seules les préférences d'affichage peuvent rester locales).
- **R5 — Aucune chaîne en dur.** 100 % des textes passent par `fr.json` (préparation i18n). Formats de date, heure et devise via une librairie de locale.
- **R6 — Titres propres.** `title` de page = « {Nom de l'écran} — MajorDome ». Jamais « MajorDome — MajorDome ».

---

## 0. Le cap produit (à lire avant de coder)

### Promesse unique
**« MajorDome est le cerveau partagé du foyer : il capte la charge mentale là où elle naît (les conversations, les mails, les photos), la rend visible, et aide à la répartir équitablement. »**

Tout ce qui suit sert cette phrase. Une fonctionnalité qui ne la sert pas devient un satellite optionnel ou disparaît.

### Les 3 piliers (tout le reste est satellite)
1. **CAPTURER** — Salon + Alfred : une phrase, une photo, un email deviennent tâche, événement ou course en un tap.
2. **VOIR** — Aujourd'hui + Balance du foyer : ce qui compte maintenant, et qui porte quoi cette semaine.
3. **RÉÉQUILIBRER** — Famille & équité : suggestions concrètes de transfert, rituel hebdomadaire, ton coopératif.

### Architecture cible : Cœur + Satellites + Privé
- **Cœur (toujours actif)** : Aujourd'hui, Salon, Agenda + Tâches, Alfred, Courses & Frigo, Coffre, Équité.
- **Satellites (activables selon le profil du foyer)** : Recettes, Routines, Poubelles, Anniversaires, Courrier IA, Budget, Maison/domotique, Souvenirs.
- **Espace privé (par membre, jamais partagé)** : Humeur, Sommeil, Cycle, Journal intime, Moments pour toi.

### Navigation cible
5 onglets conservés mais recomposés : **Aujourd'hui · Salon · Agenda · Alfred · Foyer**.
« Moi » devient « Foyer » (le hub des modules du foyer). L'espace personnel migre derrière l'avatar en haut d'écran, avec badge de confidentialité (voir F1-7). Un FAB « + » global complète la navigation (voir D2-2).

### « Adaptable partout, pour tout le monde »
Deux mécanismes, pas un produit fourre-tout :
1. **Profils de foyer** à l'onboarding (Famille avec enfants / Parent solo / Couple / Colocation / Aidant familial) qui préconfigurent les satellites actifs. On ne montre pas tout à tout le monde.
2. **i18n préparée dès maintenant** (R5) : lancement FR, extension EN sans refonte.

---

## PHASE 0 — Confiance & hygiène (BLOQUANT avant tout le reste)

L'app stocke des passeports, des avis d'imposition, des données d'enfants. La confiance n'est pas une feature, c'est le prérequis pour faire payer un foyer. Rien de la Phase 1 ne doit sortir tant que la Phase 0 n'est pas terminée.

### P0-1 ⚡ Purge du vocabulaire technique
Supprimer ou remplacer sur tous les écrans (Paramètres > Connexions, Intégrations, Agenda, Maison…) :

| Constaté à l'écran | Remplacement |
|---|---|
| `MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID`, `.env`, `docs/MICROSOFT_OAUTH_SETUP.md`, « redéploie », « clés Azure » | Supprimés. La connexion Outlook devient un bouton « Connecter Outlook » qui gère tout, ou affiche « Bientôt disponible » si non prête. |
| « Marquer connecté » | Supprimé (l'état de connexion est détecté, pas déclaré). |
| « Tout recharger depuis le serveur » | Supprimé. Synchronisation automatique silencieuse + geste pull-to-refresh. |
| « pas encore branché au backend » | Écran « Bientôt » propre (voir P0-5). |
| Mentions Playwright, OAuth, RAG, états techniques du serveur | Jamais visibles. États humains : « Connecté ✓ », « Connecter », « Bientôt ». |

**CA :** une recherche insensible à la casse des termes interdits (R1) dans les textes rendus de l'app retourne zéro résultat.

### P0-2 Secrets & mots de passe (critique)
- Aucun champ ne doit être pré-rempli ou affiché avec un identifiant ou un mot de passe (constaté : Apple ID + mot de passe en clair dans Paramètres > Connexions).
- Le « Trousseau mots de passe » d'enseignes est **désactivé par feature flag en production** tant que ne sont pas livrés : chiffrement fort avec clé par foyer, masquage total à l'affichage, page d'explication du fonctionnement. Recommandation : reporter cette fonctionnalité après le lancement — le rapport risque/valeur est mauvais pour une v1.

**CA :** aucun secret visible dans le DOM ni dans les réponses API ; flag trousseau = off en production.

### P0-3 ⚡ Titres de pages
Corriger « MajorDome — MajorDome » (constaté sur Maison, Poubelles, Souvenirs, Anniversaires, Notifications). Appliquer R6 partout.

**CA :** les 25+ écrans respectent R6.

### P0-4 Stockage serveur unifié
Les Anniversaires (aujourd'hui « sur cet appareil ») et la liste des anniversaires deviennent des données du foyer côté serveur. L'ordre des modules de l'accueil peut rester une préférence par appareil.

**CA :** deux appareils connectés au même foyer voient exactement les mêmes anniversaires.

### P0-5 Placeholders assumés
Maison (domotique), Notifications, Souvenirs : au choix (a) retirés du build de production, ou (b) remplacés par un écran « Bientôt » propre : icône + « Ce module arrive bientôt. » + bouton « Me prévenir ». Aucune chip non fonctionnelle cliquable (Éclairage, Chauffage, Volets…).

**CA :** aucun écran de production ne contient de fonction factice ni de texte d'excuse technique.

### P0-6 RGPD & confiance affichée
- Suppression de compte en self-service (Paramètres > Compte), double confirmation + délai de grâce de 14 jours.
- Export des données du foyer (archive JSON + fichiers du coffre).
- Politique de confidentialité complète publiée + contact DPO.
- Bandeau « Données hébergées en Union européenne » visible sur l'écran Coffre et la page de connexion.

**CA :** parcours de suppression testé de bout en bout ; export téléchargeable ; liens visibles depuis le Coffre et les Paramètres.

---

## PHASE 1 — Le fond (recentrage produit)

### F1-1 Équité v2 — LE chantier n°1
C'est la promesse de l'app et aujourd'hui son écran le plus pauvre (une barre 100/0/0 et un champ de notification). Objectif : en faire le tableau de bord que personne d'autre ne propose.

**Modèle de données.** Chaque tâche et événement porte :
- un **poids** : durée estimée en minutes (défaut 15, modifiable) ;
- une **catégorie** : Enfants, Maison, Courses & repas, Administratif, École & social, Autre ;
- un **type de charge** : *Exécution* (qui l'a fait) ET *Planification* (qui l'a créée, organisée, anticipée). Point clé du produit : la charge mentale, c'est surtout la planification — elle doit compter dans la balance. C'est ce que ni Cozi ni FamilyWall ne mesurent.

**Écran « Famille & équité ».**
- Hero « La semaine du foyer » : balance visuelle des membres (dans leurs couleurs), pourcentages pondérés par le poids, distinction exécution / planification (double barre ou toggle).
- Tendance sur 4 semaines (mini-graphe) + ventilation par catégorie.
- **Suggestions de rééquilibrage** : 2-3 cartes concrètes générées (ex. « Les courses reviennent à Joanne depuis 3 semaines — proposer à Alexandre ? ») avec bouton « Proposer » → notification au membre, la tâche bascule à l'acceptation.
- **Conseil de foyer** : rituel hebdomadaire (défaut dimanche 18h, réglable). Alfred poste dans le Salon un résumé de la semaine + 3 propositions de transfert validables en un tap.
- Remplacer le champ « notifier le partenaire (mobile/email) » par le vrai système d'invitation de membres.

**Ton.** Coopératif, jamais culpabilisant. L'objectif affiché est l'équilibre du foyer, pas un classement. Interdits : rouge accusateur, notions de « retard », comparaisons négatives entre membres.

**CA :** créer 5 tâches réparties → la balance reflète poids, catégories et planification ; un transfert de tâche se fait en 2 taps depuis l'écran ; le conseil de foyer poste bien dans le Salon à l'heure choisie.

### F1-2 Captures Alfred v2 (Salon)
Aujourd'hui, les captures se contentent de re-citer le message. Objectif : montrer l'action, pas la phrase.

- Sous tout message analysé, une **chip de capture structurée** : icône du type détecté (Événement / Tâche / Course), titre reformulé, date-heure parsée, membre assigné suggéré, et trois actions : **✓ Ajouter · ✎ Modifier · ✕ Ignorer**.
- Validation en un tap → toast « ✓ Ajouté à l'agenda » → l'élément existe réellement dans Agenda / Tâches / Courses.
- **Alfred est un membre du Salon** : il poste le briefing du matin et le conseil de foyer. Ses messages sont visuellement distincts (avatar majordome, fond légèrement teinté).
- Ajouter l'envoi de photos dans le Salon (une photo de mot d'école déclenche une capture, même parcours).

**CA :** « Léo dentiste samedi 10h » → chip Événement « Dentiste — Léo », sam. 10:00, assigné Léo ; validation en 1 tap ; visible dans l'Agenda ; parcours complet < 10 secondes.

### F1-3 Alfred proactif
Passer d'un assistant qui répond à un majordome qui anticipe.

- **Briefing du matin** (heure réglable, défaut 7h00) : résumé du jour (événements, tâches urgentes, alertes frigo/DLC, météo) posté dans le Salon + notification push.
- **Préparation du dimanche** : aperçu de la semaine à venir + proposition de répartition (lié à F1-1).
- **Suggestions de chat dynamiques** selon le contexte (matin : « Briefe-moi sur la journée » ; produit périmé : « Que faire avec le frigo ? » ; vendredi : « Prépare la liste de courses du week-end »). Fin des 4 suggestions statiques.
- **Journal d'actions** : quand Alfred agit, il l'affiche (« ✓ Lait ajouté à la liste ») et un historique « Actions d'Alfred » est consultable.
- Renommer « 0 notes mémorisées » → « **Mémoire du foyer** », avec un écran listant les faits mémorisés, modifiables et supprimables.
- Historique des conversations accessible.

**CA :** le briefing part à l'heure choisie ; chaque action IA a un feedback visible ; la mémoire est lisible et éditable par le foyer.

### F1-4 Aujourd'hui v2
- **3 blocs maximum** : ① *Maintenant* (urgences réelles : périmés, retards, RDV dans moins de 2h) ② *Balance de la semaine* (mini-équité, tap → module complet) ③ *Raccourcis modules* personnalisés (le mode « Personnaliser » existant est conservé).
- **Cohérence d'état** : une alerte disparaît quand le problème est résolu (produit retiré ou consommé), pas quand l'écran a été visité. Règle générale : l'accueil reflète l'état réel du foyer, il n'est jamais « imprévisible ».
- **Un seul point de saisie de l'humeur** : dans l'espace privé (retirer le doublon de l'accueil ; un raccourci discret peut y mener).

**CA :** aller-retour vers le Frigo sans résoudre → l'alerte reste ; résolution → l'alerte disparaît partout, y compris des compteurs.

### F1-5 Modules cœur — finitions
- **Courses & Frigo** : bouton « + Ajouter au frigo » (nom, quantité, DLC) ; **scan de code-barres** (caméra) pour pré-remplir ; cocher un article acheté propose son ajout au frigo avec DLC ; cartes de fidélité affichables en **code-barres/QR plein écran, luminosité max** (utilisable en caisse).
- **Agenda** : création rapide en langage naturel (même parseur que le Salon) ; **2 événements d'exemple en mode démo** tant qu'aucune source n'est connectée (au lieu d'un écran vide qui exige Google/Outlook) ; retrait du bloc « Journal intime » (il vit dans l'espace privé) ; synchronisation silencieuse (cf. P0-1).
- **Coffre** : les échéances (passeport, assurance…) génèrent automatiquement une tâche à J-30, assignable ; badge « à renouveler » remonté sur Aujourd'hui. Le Coffre est déjà le module le plus abouti : ne pas le refondre, le connecter.

**CA :** parcours « scanner un produit → présent au frigo avec DLC » < 20 s ; une échéance de document crée une tâche visible dans l'Agenda.

### F1-6 Satellites — dégraisser et dédupliquer
- **Wallet** : supprimer l'entrée dupliquée du hub (une seule vérité : Courses & Frigo > Wallet).
- **Journal intime et humeur** : une seule instance, dans l'espace privé (suppression des doublons Agenda et Accueil).
- **Budget** : devient un satellite optionnel activable, retiré de l'écran principal.
- **Recettes** : génération par Alfred selon le frigo et l'anti-gaspi (« Propose 3 dîners avec ce qui expire »), ajout de recettes personnelles, mode cuisine pas-à-pas plein écran, étapes de préparation complètes. Pas de photos manquantes : illustrations cohérentes par défaut.
- **Routines** : création / édition / suppression, vue semaine (le sous-titre l'annonce déjà), assignation par membre. Le streak est conservé.
- **Maison / domotique** : reporté ou satellite « avancé » (cf. P0-5). Ce n'est pas un pilier de la v2.

**CA :** plus aucun doublon d'entrée dans le hub ; chaque satellite est activable/désactivable depuis Foyer > « Gérer les modules ».

### F1-7 Espace privé « Moi » (confidentialité par design)
Le mélange actuel vie de foyer / intimité (cycle, journal) dans un même écran est un risque de confiance majeur en multi-membres.

- Accessible via l'avatar en haut d'écran, protégeable par code ou biométrie, badge permanent « Visible uniquement par toi ».
- Contenu : Humeur, Sommeil, Cycle, Journal intime, Moments pour toi, Stats bien-être.
- Aucune de ces données n'apparaît dans le Salon, l'équité ou tout écran partagé. Alfred ne les évoque qu'en conversation privée avec le membre concerné.

**CA :** depuis le compte d'un autre membre du foyer, aucune donnée privée n'est visible ni accessible par API.

### F1-8 Onboarding v2 (10 écrans → 4 + 1 action)
1. **Promesse** (une phrase) + choix du **type de foyer** (Famille / Parent solo / Couple / Coloc / Aidant) → préconfigure les satellites.
2. **Membres** : prénoms + une couleur par membre (la couleur suit le membre partout dans l'app).
3. **Invitation** : lien de partage WhatsApp/SMS pour le·la partenaire (viralité au jour 1 ; étape passable).
4. **Première capture guidée** : dans le Salon, l'app invite à écrire « essaie : “dentiste Léa mardi 15h” » → chip → validation → « C'est exactement ça, MajorDome. » → arrivée sur Aujourd'hui.

Import d'agenda (Google/Apple/Outlook) proposé à la première visite de l'Agenda, pas pendant l'onboarding.

**CA :** chrono onboarding < 3 minutes ; événement analytics sur la capture guidée (cible : ≥ 60 % des nouveaux foyers la valident).

### F1-9 i18n & adaptabilité (préparation, pas traduction)
- Extraction de 100 % des chaînes vers `fr.json` (R5) ; formats date/heure/devise via librairie de locale.
- Textes genrés paramétrés par membre : « Épuisé·e » adapté au genre déclaré, ou formulation neutre (« À plat »). Constaté : libellés au féminin figé (« Épuisée / Stressée »).

**CA :** basculer la locale en en-US ne casse aucun layout (fallback fr) ; les libellés d'humeur s'accordent au membre connecté.

---

## PHASE 2 — La forme (design system + refonte visuelle)

### D2-1 Design tokens (fichier unique `tokens.css` / `theme.ts`)
Le terracotta `#C96B4A` est conservé : c'est l'identité existante. La signature visuelle ne viendra donc pas de la couleur (combinaison crème + terracotta très répandue) mais de deux choses propres à MajorDome : **la typographie « majordome »** et **la balance du foyer** comme élément graphique récurrent.

- **Couleurs** : primaire `#C96B4A` (terracotta) ; fond `#FAF6F2` (crème) ; surface `#FFFFFF` ; encre `#2A211C` ; encre secondaire `#6E5F56` ; succès `#4A8F6D` ; alerte `#D9822B` ; danger `#C0392B` (réservé aux actions destructives).
- **Couleurs membres** (le code visuel central de l'app, présent sur avatars, événements, tâches, bulles, balance) : 6 teintes accessibles et distinctes, ex. `#C96B4A`, `#4A7C8F`, `#7C8F4A`, `#8F4A7C`, `#B8860B`, `#5D6D7E`.
- **Typographie** : display serif à caractère (Fraunces ou Libre Caslon) réservée aux titres H1/H2 et aux messages d'Alfred — c'est elle qui porte la personnalité « majordome ». Inter (ou police système) pour tout le reste. Échelle : 28 / 22 / 17 / 15 / 13.
- **Formes** : radius 16 (cartes) / 24 (modales) / pill (chips) ; une seule ombre douce `0 2px 12px rgba(42,33,28,.08)` ; espacements sur base 4 (4/8/12/16/24/32).
- **Mode sombre** : prévu par les tokens (pas obligatoire en v2, mais aucune couleur en dur).

**CA :** zéro couleur, taille ou ombre en dur dans les composants ; tout passe par les tokens.

### D2-2 Librairie de composants unifiée
- `CarteModule` (icône, titre, badge, barre de couleur), `ChipCapture` (cf. F1-2), `BalanceEquite`, `EmptyState` (R2), `Toast`, `LigneListe` (checkbox + swipe), `SkeletonLoader`.
- **FAB « + » global** présent sur Aujourd'hui, Agenda et Foyer, ouvrant 4 actions : Événement · Tâche · Course · Photo → Alfred. C'est la « règle des 2 taps » pour toutes les saisies fréquentes.
- Skeleton loaders sur tous les écrans à données ; jamais de spinner plein écran.

**CA :** les 5 onglets n'utilisent que des composants de la librairie ; aucun bouton ou champ « par défaut navigateur » visible.

### D2-3 Refonte écran par écran
- **Aujourd'hui** : hero de salutation sur fond crème, 3 blocs (F1-4), carte « Maintenant » avec liseré alerte, mini-balance de la semaine.
- **Salon** : bulles teintées à 12 % de la couleur du membre, avatars à initiales, messages d'Alfred typographiés en display, chips de capture sous les messages, champ de saisie avec micro et photo.
- **Agenda** : timeline du jour avec pastilles couleur membre, barre de semaine sticky, création via FAB, événements d'exemple en mode démo.
- **Alfred** : en-tête « Mémoire du foyer (n) », suggestions dynamiques en chips horizontales, cartes d'action dans les réponses (« ✓ Ajouté »), accès à l'historique.
- **Foyer (ex-Moi)** : sections Quotidien / Foyer / Outils en cartes uniformes, « Gérer les modules » en bas, carte compte réduite (avatar → espace privé, engrenage → réglages).
- **Équité** : le plus gros investissement visuel de la v2 — balance animée, graphe de tendance, cartes de suggestions (F1-1). C'est l'écran de démo et de conversion.
- **Coffre** : conservé (déjà abouti) ; ajout du bandeau UE et du statut des échéances.
- **Paramètres** : 3 onglets conservés mais réécrits en langage humain ; états de connexion limités à « Connecté ✓ / Connecter / Bientôt ».

**CA :** revue visuelle des 25+ écrans : aucun écran « brut », aucun jargon, chaque écran vide conforme à R2.

### D2-4 Microcopy — la voix du majordome
- Ton : tutoiement, chaleureux, bref, orienté service. Alfred dit « Bien noté. », « Je m'en occupe. », « Voici le programme du jour. ».
- Un bouton dit exactement ce qu'il fait (« Ajouter à l'agenda », pas « Valider ») et garde le même nom dans tout le parcours (le bouton « Proposer » produit un toast « Proposé à Alexandre »).
- Empty states écrits comme des invitations (« Le frigo ne connaît encore rien. Scanne un premier produit. »).
- Interdits : jargon (R1), culpabilisation, rafales de points d'exclamation.

**CA :** relecture complète de `fr.json` ; échantillon de 20 écrans conforme à la voix.

### D2-5 Accessibilité & robustesse
- Contrastes AA, cibles tactiles ≥ 44 px, focus visibles, labels de formulaires, `prefers-reduced-motion` respecté.
- Lecture hors-ligne des dernières données (cache) ; erreurs réseau humaines (« Connexion perdue — tes modifications seront synchronisées. »).

**CA :** audit Lighthouse accessibilité ≥ 90 ; en mode avion, l'app affiche les dernières données connues.

---

## PHASE 3 — Monétisation (brancher proprement, pousser plus tard)

Constat : aucune couche de monétisation aujourd'hui. On la construit maintenant, on ne l'active à grande échelle que lorsque la rétention J30 est prouvée sur les foyers pilotes.

### M3-1 Freemium par foyer (jamais par utilisateur)
- **Gratuit** — tout le cœur pour tout le foyer, avec limites : 15 captures Alfred / mois, briefing hebdomadaire (pas quotidien), coffre 100 Mo, équité simple (balance sans suggestions ni conseil), 2 satellites actifs.
- **Premium Foyer — 6,90 €/mois ou 59 €/an** : Alfred illimité + proactif quotidien, suggestions d'équité + conseil de foyer, coffre 5 Go + rappels d'échéances, Courrier IA, intégrations (Doctolib, drives, calendriers), satellites illimités.
- **Offre fondatrice** (foyers pilotes) : 3,90 €/mois à vie ou 39 €/an, badge « Foyer fondateur ».

Le levier de conversion est Alfred : le plafond de captures crée le manque au moment où l'habitude est installée.

### M3-2 Paywall doux
- Compteur discret de captures restantes (visible à partir de 5).
- À 0 : écran de conversion qui montre la valeur déjà reçue (« Alfred a capturé 15 choses ce mois-ci — environ 2 h de charge mentale en moins ») avec le choix mensuel/annuel.
- Jamais de blocage des données existantes ; résiliation en 2 taps depuis les Paramètres ; aucun dark pattern.

### M3-3 Gisements ultérieurs (post-traction, ne rien coder maintenant)
1. Affiliation drives / livraison depuis la liste de courses (Carrefour, U, Leclerc — les connecteurs existent déjà).
2. Recommandations d'optimisation via Courrier IA et Coffre (mutuelle, assurances, télécom) — modèle comparateur avec commission, uniquement sur opt-in explicite.
3. B2B2C : MajorDome comme avantage salarié (QVT / parentalité) et marque blanche mutuelles.

**CA Phase 3 :** paiement (Stripe : checkout + portail client) branché ; feature flags par tier testés ; parcours upgrade, downgrade et résiliation fonctionnels.

---

## Ordre d'exécution recommandé

1. **Phase 0 complète** (P0-1 → P0-6) — une semaine max, tout est bloquant.
2. **F1-2** Captures v2 (le « wow ») → **F1-1** Équité v2 (la promesse) → **F1-4** Aujourd'hui v2.
3. **F1-8** Onboarding v2 → **F1-7** Espace privé → **F1-3** Alfred proactif.
4. **D2-1** Tokens → **D2-2** Composants → **D2-3** Écran par écran → **D2-4** Microcopy → **D2-5** A11y.
5. **F1-5 / F1-6** Finitions modules et déduplication → **F1-9** i18n.
6. **M3-1 → M3-2** — activer seulement quand la rétention J30 est mesurée sur les pilotes.

---

## Definition of Done globale (à vérifier avant tout lancement)

- Recherche des termes interdits (R1) dans l'UI = 0 résultat.
- 0 mot de passe ou identifiant affiché ; trousseau désactivé en production.
- Tous les titres conformes (R6) ; 0 placeholder sauvage ; 0 module en doublon.
- Parcours critiques chronométrés : capture Salon < 10 s ; ajout d'une course < 5 s ; onboarding < 3 min.
- Un foyer de test à 3 membres sur 2 appareils : données identiques partout, données privées invisibles entre membres.
- Suppression de compte et export de données fonctionnels ; politique de confidentialité publiée ; bandeau UE visible sur le Coffre.
- Retirer le `noindex` du site vitrine au moment du lancement public.

---

## Annexe (ajout du 07/07/2026)
Les captures réelles de l'app ont été auditées : voir le fichier `02-audit-captures-reelles.md` du dossier, qui ajoute la tâche bloquante **P0-7 (qualité du français)** à la Phase 0 et précise les correctifs écran par écran. Les cibles visuelles sont dans `03-maquettes-v2.html`.
