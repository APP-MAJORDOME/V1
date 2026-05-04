# Déploiement

## 1. Objectif
Fournir un chemin simple pour :
- lancer le projet en local ;
- préparer un staging ;
- structurer une future prod.

## 2. Local
### Étapes
```bash
cp config/.env.example .env
bash scripts/dev-up.sh
bash scripts/migrate.sh
```

### Déploiement automatisé (local/staging)
```bash
# pour prod-like, partir de config/.env.prod.example
bash scripts/deploy.sh .env
```

Note:
- en production, `MAJORDOME_AUTO_CREATE_TABLES=false` et les schémas DB doivent être appliqués par migration.

### Coffre documents — fichiers (Docker / VPS)
- Le backend stocke les pièces jointes sous `MAJORDOME_UPLOAD_DIR` (Compose : volume nommé `majordome_uploads` monté sur `/data/uploads`).
- Quota global par foyer : `MAJORDOME_ATTACHMENT_QUOTA_MB_PER_HOUSEHOLD` (mettre `0` pour désactiver).
- Sauvegarde ponctuelle du dossier : `bash scripts/backup-uploads.sh` (voir variables `MAJORDOME_UPLOAD_DIR`, `BACKUP_OUT` dans le script).
- Restauration : `bash scripts/restore-uploads.sh <archive.tar.gz>` (utiliser `FORCE_RESTORE=1` si le dossier cible n'est pas vide).
- Maintenance groupée : `bash scripts/maintain-uploads.sh --backup --prune --keep-days 30 --restore-check`.
- Wrapper quotidien (log + chargement `.env`) : `bash scripts/run-maintenance-uploads.sh`.
- Installation cron (ex: chaque nuit) : `CRON_SCHEDULE="17 3 * * *" bash scripts/install-maintenance-cron.sh`.
- Installation systemd timer (recommandé serveur Linux) : `sudo SYSTEMD_ON_CALENDAR="*-*-* 03:17:00" MAJORDOME_ROOT=/opt/majordome bash scripts/install-maintenance-systemd.sh`.
- Vérifier le timer: `systemctl status majordome-uploads-maintenance.timer` puis `systemctl list-timers | rg majordome-uploads-maintenance`.
- Rollback / désinstallation: `bash scripts/uninstall-maintenance-uploads.sh --cron` ou `sudo bash scripts/uninstall-maintenance-uploads.sh --systemd` (ou `--all`).
- Statut opérationnel synthétique (cron/systemd/logs/backups): `bash scripts/status-maintenance-uploads.sh`.

### Déploiement distant (VPS/serveur)
```bash
export REMOTE_HOST=your.server.tld
export REMOTE_USER=ubuntu
export REMOTE_DIR=/opt/majordome
bash scripts/deploy-remote.sh .env
```

### Vérifications
- API répond sur `:8000`
- docs OpenAPI accessibles
- frontend répond sur `:3000`
- DB et Redis démarrés
- migration DB appliquée (`password_hash` sur `users`)
- check global local: `bash scripts/check-deployment.sh`
- check global local JSON: `bash scripts/check-deployment.sh --json`
- check global local strict (alerting): `bash scripts/check-deployment.sh --strict` ou `--json --strict`
- check global serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] bash scripts/check-deployment.sh --remote`
- check global serveur JSON: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] bash scripts/check-deployment.sh --remote --json`
- check global serveur strict (alerting): `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] bash scripts/check-deployment.sh --remote --strict` (ou `--json --strict`)
- raccourci make local: `make check-deploy`
- raccourci make local JSON: `make check-deploy-json`
- raccourci make serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote`
- raccourci make serveur JSON: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-json`
- raccourci make local strict: `make check-deploy-strict` ou `make check-deploy-json-strict`
- raccourci make serveur strict: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-strict` ou `...-json-strict`
- décoder un code de sortie strict: `make check-deploy-decode CODE=2`
- message compact notification (local): `make check-deploy-alert`
- même chose + envoi Slack (Incoming Webhook) : `MAJORDOME_DEPLOY_ALERT_WEBHOOK=https://hooks.slack.com/... make check-deploy-alert`
- message compact notification (serveur): `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] make check-deploy-remote-alert` (+ `MAJORDOME_DEPLOY_ALERT_WEBHOOK` pour Slack)
- run complet local: `make maintenance-full`
- run complet serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] [REMOTE_DIR=/opt/majordome] make maintenance-full-remote`
- script équivalent run complet serveur: `REMOTE_HOST=... REMOTE_USER=... [REMOTE_SSH_KEY=...] [REMOTE_DIR=/opt/majordome] bash scripts/maintenance-remote.sh`

## 3. Variables d'environnement minimales
- `APP_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `OPENAI_API_KEY` (plus tard si agent réel)
- `GOOGLE_*` (quand OAuth réel)
- `MICROSOFT_*`

## 4. Recommandation staging
- frontend séparé ;
- backend séparé ;
- worker séparé ;
- Postgres managé ;
- Redis managé ;
- secrets managés ;
- logs centralisés.

## 5. Recommandation production
- TLS ;
- rotation de secrets ;
- sauvegardes ;
- migrations ;
- monitoring ;
- traces ;
- alerting ;
- file d'attente réelle.

## 6. Ce que les manifests k8s actuels signifient
Les manifests présents dans le dépôt sont des **exemples de structure**, pas une stack prête production.

## 7. Check-list avant un vrai déploiement internet
- auth et RBAC finalisés ;
- secrets sortis des fichiers locaux ;
- migrations DB propres ;
- healthchecks ;
- protection rate limit ;
- logs et audit ;
- politique données perso/pro/foyer ;
- connecteurs réels ;
- tests end-to-end ;
- runbooks incident.
