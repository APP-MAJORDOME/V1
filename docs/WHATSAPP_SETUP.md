# WhatsApp — télécommande Alfred

Même principe que Telegram : lier ton numéro WhatsApp à ton compte Majordome, puis envoyer des messages texte à Alfred (courses, tâches, agenda…).

## Prérequis Meta

1. Compte [Meta for Developers](https://developers.facebook.com/)
2. App **Business** + produit **WhatsApp** → Cloud API
3. Un **Phone Number ID** (numéro test ou business)
4. Un **token d’accès** permanent (System User) ou temporaire pour démarrer
5. **App Secret** (Paramètres → Base) pour signer le webhook
6. Un **Verify Token** libre (chaîne secrète que tu choisis)

## Variables d’environnement

Dans `.env` / `config/.env.ec2` :

```bash
MAJORDOME_WHATSAPP_ACCESS_TOKEN=EAAxxxx...
MAJORDOME_WHATSAPP_PHONE_NUMBER_ID=123456789012345
MAJORDOME_WHATSAPP_APP_SECRET=xxxxxxxx
MAJORDOME_WHATSAPP_VERIFY_TOKEN=une-chaine-secrete-longue
# Numéro affiché pour le lien wa.me (optionnel, E.164)
MAJORDOME_WHATSAPP_DISPLAY_PHONE=+33612345678
MAJORDOME_PUBLIC_API_BASE_URL=https://api.majordom.eu
```

Puis redéployer.

## Webhook Meta

Dans la console WhatsApp → Configuration :

| Champ | Valeur |
|-------|--------|
| Callback URL | `https://api.majordom.eu/api/v1/webhooks/whatsapp` |
| Verify token | même valeur que `MAJORDOME_WHATSAPP_VERIFY_TOKEN` |
| Abonnements | `messages` |

Meta envoie un GET de vérification (challenge) puis les messages en POST (signature `X-Hub-Signature-256`).

## Liaison utilisateur

1. App Majordome → **Paramètres → Connexions → WhatsApp**
2. **Générer un code de liaison** (valide 10 min)
3. Ouvrir le lien `wa.me` (si numéro configuré) **ou** envoyer le code en message au numéro Majordome
4. Alfred confirme la liaison

Commandes utiles une fois lié : `aide`, `statut`, `déconnecter`.

## Limites WhatsApp

- Fenêtre de **24 h** après le dernier message utilisateur : réponses libres OK
- Hors fenêtre : templates Meta requis (non gérés ici — l’utilisateur doit écrire d’abord)
- Texte uniquement pour l’instant

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Bouton WhatsApp « Bientôt » | Token ou Phone Number ID manquant |
| Verify webhook échoue | `VERIFY_TOKEN` différent de Meta |
| 403 POST webhook | `APP_SECRET` incorrect / signature |
| Pas de réponse | numéro non lié, ou hors fenêtre 24 h |
