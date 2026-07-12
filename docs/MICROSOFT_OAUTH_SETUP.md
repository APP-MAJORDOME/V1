# Connexion Outlook / Microsoft 365 (production)

## 1. Application Azure

1. [Portail Azure](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Nom : `MajorDome Production` (ou équivalent)
3. Types de comptes : **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI (Web) :
   ```
   https://api.majordom.eu/api/v1/integrations/microsoft/oauth/callback
   ```

## 2. Secrets et identifiants

- **Overview** → copier **Application (client) ID**
- **Certificates & secrets** → **New client secret** → copier la valeur (une seule fois)

## 3. Permissions API

**API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** :

- `openid`, `profile`, `offline_access`
- `User.Read`
- `Calendars.ReadWrite`

Puis **Grant admin consent** si ton tenant l’exige.

## 4. Variables sur le serveur

Dans `config/.env.ec2` (jamais commité) :

```env
MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID=<client-id>
MAJORDOME_MICROSOFT_OAUTH_CLIENT_SECRET=<secret>
MAJORDOME_MICROSOFT_OAUTH_REDIRECT_URI=https://api.majordom.eu/api/v1/integrations/microsoft/oauth/callback
MAJORDOME_MICROSOFT_OAUTH_TENANT=common
MAJORDOME_MICROSOFT_OAUTH_SCOPES="openid profile offline_access Calendars.ReadWrite User.Read"
```

Les guillemets autour de `MAJORDOME_MICROSOFT_OAUTH_SCOPES` sont importants (espaces).

Tu peux aussi placer `MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID` et `SECRET` dans le fichier `.env` à la racine du projet : `scripts/deploy-majordom-eu.sh` les copie automatiquement vers la prod si elles sont vides dans `config/.env.ec2`.

## 5. Déployer

```bash
REMOTE_HOST=majordom.eu REMOTE_USER=ubuntu REMOTE_SSH_KEY=~/Downloads/clef_vha.pem \
  bash scripts/deploy-majordom-eu.sh
```

## 6. Vérifier

1. Ouvrir https://majordom.eu/ → **Modules** → **Intégrations**
2. Le bouton **Connecter Outlook** doit être actif (plus grisé)
3. Après OAuth, l’URL contient `?microsoft_oauth=connected` puis disparaît
4. **Agenda** → **Synchroniser** pour importer les événements

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Bouton Outlook grisé | `CLIENT_ID` / `SECRET` vides ou deploy sans `.env.ec2` |
| `invalid_state` après redirect | Horloge serveur ou session expirée — réessayer |
| `exchange_failed` | Secret expiré, redirect URI différent d’Azure, ou scopes refusés |
| Agenda vide après sync | Compte connecté mais calendrier principal vide côté Microsoft |
