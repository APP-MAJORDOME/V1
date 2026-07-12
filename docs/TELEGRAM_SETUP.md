# Telegram — Alfred via bot

## 1. Créer le bot

1. Ouvre Telegram et cherche **@BotFather**
2. Envoie `/newbot`, choisis un nom et un identifiant (ex. `majordome_alfred_bot`)
3. Copie le **token** (format `123456789:AAH...`)

## 2. Variables serveur

Dans `config/.env.ec2` (prod) ou `.env` (local) :

```env
MAJORDOME_TELEGRAM_BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAJORDOME_TELEGRAM_WEBHOOK_SECRET=une-chaine-secrete-longue
MAJORDOME_PUBLIC_API_BASE_URL=https://api.majordom.eu
MAJORDOME_TELEGRAM_WEBHOOK_AUTO_REGISTER=true
```

Au déploiement, le backend enregistre automatiquement le webhook vers  
`https://api.majordom.eu/api/v1/webhooks/telegram`.

Tu peux aussi forcer l’enregistrement :

```bash
curl -X POST https://api.majordom.eu/api/v1/integrations/telegram/register-webhook \
  -H "Authorization: Bearer <token>"
```

## 3. Lier ton compte Majordome

1. Ouvre https://majordom.eu/ → **Paramètres** → **Connexions** → **Telegram**
2. Clique **Générer un code de liaison**
3. Ouvre le lien Telegram (ou envoie `/start CODE` au bot)
4. Le bot confirme la connexion

## 4. Utilisation

Envoie des messages texte au bot, par exemple :

- « ajoute du lait aux courses »
- « qu’est-ce qu’on mange ce soir ? »
- « rappelle-moi de sortir les poubelles demain »

Commandes bot : `/help`, `/status`, `/disconnect`

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Bouton Telegram grisé | `MAJORDOME_TELEGRAM_BOT_TOKEN` vide |
| Bot ne répond pas | Webhook non enregistré ou mauvaise URL API publique |
| Code expiré | Regénère un code (validité ~10 min) |
| 403 webhook | `MAJORDOME_TELEGRAM_WEBHOOK_SECRET` différent de celui configuré chez Telegram |
