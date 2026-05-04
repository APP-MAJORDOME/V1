# Développement local (sans Docker). Ex.: `make test-backend` ou `make ci-local`
PYTHON ?= python3.12

.PHONY: test-backend typecheck-frontend build-frontend ci-local ci-local-full alembic-current alembic-upgrade alembic-upgrade-docker

test-backend:
	cd backend && $(PYTHON) -m pytest -q

typecheck-frontend:
	cd frontend && npm run typecheck

build-frontend:
	cd frontend && npm run build

ci-local: test-backend typecheck-frontend
	@echo "OK — backend pytest + frontend tsc"

ci-local-full: test-backend typecheck-frontend build-frontend
	@echo "OK — backend pytest + frontend tsc + next build"

# Vérifications avant docker compose (à lancer sur ta machine).
.PHONY: preflight
preflight: ci-local-full
	@echo ""
	@echo "→ Avec Docker démarré : bash scripts/deploy.sh .env"
	@echo "→ Vers un VPS        : REMOTE_HOST=… REMOTE_USER=… bash scripts/deploy-remote.sh .env"

alembic-current:
	@echo "Utilise MAJORDOME_DATABASE_URL (ex. export depuis .env)."; \
	cd backend && $(PYTHON) -m alembic current

alembic-upgrade:
	PYTHON="$(PYTHON)" bash scripts/alembic-upgrade.sh

# Nécessite les conteneurs `docker compose up` (service backend).
alembic-upgrade-docker:
	docker compose -f infra/docker-compose.yml exec -T backend python -m alembic upgrade head

up:
	docker compose -f infra/docker-compose.yml up --build -d

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f

ps:
	docker compose -f infra/docker-compose.yml ps

smoke:
	bash scripts/smoke-test-api.sh

migrate:
	bash scripts/migrate.sh

deploy:
	bash scripts/deploy.sh

deploy-remote:
	bash scripts/deploy-remote.sh .env

# Déploiement prod majordom.eu (nécessite REMOTE_HOST, REMOTE_USER et Docker sur le serveur).
deploy-majordom-eu:
	bash scripts/deploy-majordom-eu.sh

uploads-backup:
	bash scripts/backup-uploads.sh

uploads-restore:
	bash scripts/restore-uploads.sh

uploads-maintain:
	bash scripts/maintain-uploads.sh --backup --prune --keep-days 30 --restore-check

uploads-status:
	bash scripts/status-maintenance-uploads.sh

uploads-install-cron:
	bash scripts/install-maintenance-cron.sh

uploads-install-systemd:
	sudo bash scripts/install-maintenance-systemd.sh

uploads-uninstall:
	bash scripts/uninstall-maintenance-uploads.sh --all

check-deploy:
	bash scripts/check-deployment.sh

check-deploy-json:
	bash scripts/check-deployment.sh --json

check-deploy-strict:
	bash scripts/check-deployment.sh --strict

check-deploy-json-strict:
	bash scripts/check-deployment.sh --json --strict

check-deploy-decode:
	bash scripts/check-deployment-exit-code.sh $(CODE)

check-deploy-alert:
	bash scripts/check-deployment-alert.sh

check-deploy-remote:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make check-deploy-remote"; \
		exit 1; \
	fi
	bash scripts/check-deployment.sh --remote

check-deploy-remote-json:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make check-deploy-remote-json"; \
		exit 1; \
	fi
	bash scripts/check-deployment.sh --remote --json

check-deploy-remote-strict:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make check-deploy-remote-strict"; \
		exit 1; \
	fi
	bash scripts/check-deployment.sh --remote --strict

check-deploy-remote-json-strict:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make check-deploy-remote-json-strict"; \
		exit 1; \
	fi
	bash scripts/check-deployment.sh --remote --json --strict

check-deploy-remote-alert:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make check-deploy-remote-alert"; \
		exit 1; \
	fi
	bash scripts/check-deployment-alert.sh --remote

maintenance-full:
	@echo "== MajorDome maintenance full (local) =="
	bash scripts/maintain-uploads.sh --backup --prune --keep-days 30 --restore-check
	bash scripts/status-maintenance-uploads.sh
	bash scripts/check-deployment.sh

maintenance-full-remote:
	@if [ -z "$$REMOTE_HOST" ] || [ -z "$$REMOTE_USER" ]; then \
		echo "REMOTE_HOST et REMOTE_USER sont requis."; \
		echo "Exemple: REMOTE_HOST=13.63.50.21 REMOTE_USER=ubuntu [REMOTE_SSH_KEY=~/Downloads/key.pem] make maintenance-full-remote"; \
		exit 1; \
	fi
	@echo "== MajorDome maintenance full (remote) =="
	bash scripts/maintenance-remote.sh
