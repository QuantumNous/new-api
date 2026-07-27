WEB_DIR = ./web/default
WEB_CLASSIC_DIR = ./web/classic
API_DIR = .
DESKTOP_DIR = ./desktop
DESKTOP_GUI_DIR = ./desktop/surfaces/gui
DEV_WEB_DEFAULT_PORT ?= 5173
DEV_WEB_CLASSIC_PORT ?= 5174
DEV_COMPOSE_FILE = docker-compose.dev.yml
DEV_POSTGRES_SERVICE = postgres
DEV_POSTGRES_DB = new-api
DEV_POSTGRES_USER = root
DEV_SQLITE_PATH ?= one-api.db

# Local API env when using docker-compose.dev.yml data plane
export SQL_DSN ?= postgresql://root:123456@127.0.0.1:5432/new-api?sslmode=disable
export REDIS_CONN_STRING ?= redis://127.0.0.1:6379/0

.PHONY: all build-web build-web-classic build-all-web start-api \
	dev-infra dev-api dev-web dev-web-local dev-web-classic dev \
	reset-setup deploy deploy-bootstrap \
	desktop-build desktop-stage desktop-publish desktop-screenshots

all: build-all-web start-api

build-web:
	@echo "Building default web..."
	@cd ./web && bun install --frozen-lockfile
	@cd $(WEB_DIR) && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$$(cat ../../VERSION 2>/dev/null || echo dev) bun run build

build-web-classic:
	@echo "Building classic web..."
	@cd ./web && bun install --frozen-lockfile
	@cd $(WEB_CLASSIC_DIR) && VITE_REACT_APP_VERSION=$$(cat ../../VERSION 2>/dev/null || echo dev) bun run build

build-all-web: build-web build-web-classic

# Host Go API (expects Postgres/Redis on localhost — run make dev-infra first if needed)
start-api:
	@echo "Starting API on host (SQL_DSN / REDIS_CONN_STRING from env or makefile defaults)..."
	@cd $(API_DIR) && go run main.go

# Local Docker: Postgres + Redis only (no app container)
dev-infra:
	@echo "Starting local Postgres + Redis (infra only)..."
	@docker compose -f $(DEV_COMPOSE_FILE) up -d
	@docker compose -f $(DEV_COMPOSE_FILE) ps

# Alias: start data plane then print how to run the API on host
dev-api: dev-infra
	@echo "Data plane ready. Run the API on the host with: make start-api"
	@echo "Or: SQL_DSN='$(SQL_DSN)' REDIS_CONN_STRING='$(REDIS_CONN_STRING)' go run main.go"

# Default local frontend → production API (https://you-box.com)
dev-web:
	@echo "Starting default web (API → $${VITE_REACT_APP_SERVER_URL:-https://you-box.com})..."
	@echo "URL: http://localhost:$(DEV_WEB_DEFAULT_PORT)"
	@cd ./web && bun install --filter ./default
	@cd $(WEB_DIR) && bun run dev -- --host 0.0.0.0 --port $(DEV_WEB_DEFAULT_PORT)

# Local frontend + local host API
dev-web-local:
	@echo "Starting default web against local API http://127.0.0.1:3000"
	@cd ./web && bun install --filter ./default
	@cd $(WEB_DIR) && VITE_REACT_APP_SERVER_URL=http://127.0.0.1:3000 bun run dev -- --host 0.0.0.0 --port $(DEV_WEB_DEFAULT_PORT)

dev-web-classic:
	@echo "Starting classic web dev server..."
	@cd ./web && bun install --filter ./classic
	@cd $(WEB_CLASSIC_DIR) && bun run dev -- --host 0.0.0.0 --port $(DEV_WEB_CLASSIC_PORT)

# Frontend only by default (production API). Full local stack: make dev-infra && make start-api & make dev-web-local
dev: dev-web

# Production: native binary on host; Postgres/Redis in Docker
deploy:
	@bash ./scripts/deploy-prod.sh

deploy-bootstrap:
	@bash ./scripts/deploy-prod.sh --bootstrap

# Desktop release: build on this machine, stage under desktop/release/<version>/, then
# publish to Cloudflare R2 (https://dl.you-box.com). Windows artifacts are built on the LAN
# Windows machine with packaging/build_windows.ps1 and copied into the same staging folder
# before `make desktop-publish`.
desktop-build:
	@cd $(DESKTOP_DIR) && bash packaging/build_dmg.sh

desktop-stage:
	@cd $(DESKTOP_DIR) && bash packaging/stage_release.sh

desktop-publish:
	@cd $(DESKTOP_DIR) && bash packaging/publish_release.sh

# Regenerate the marketing screenshots the download page uses (hermetic, no backend).
desktop-screenshots:
	@cd $(DESKTOP_GUI_DIR) && npm run screenshots

reset-setup:
	@echo "Resetting local setup wizard state..."
	@if docker compose -f $(DEV_COMPOSE_FILE) ps --services --status running | grep -qx "$(DEV_POSTGRES_SERVICE)"; then \
		echo "Detected running docker dev PostgreSQL. Removing setup record and root users..."; \
		docker compose -f $(DEV_COMPOSE_FILE) exec -T $(DEV_POSTGRES_SERVICE) \
			psql -U $(DEV_POSTGRES_USER) -d $(DEV_POSTGRES_DB) \
			-c 'DELETE FROM setups;' \
			-c 'DELETE FROM users WHERE role = 100;' \
			-c "DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
		echo "Restart host API (make start-api) so setup status is recalculated."; \
	elif db_path="$${SQLITE_PATH:-$(DEV_SQLITE_PATH)}"; db_path="$${db_path%%\?*}"; [ -f "$$db_path" ]; then \
		db_path="$${SQLITE_PATH:-$(DEV_SQLITE_PATH)}"; \
		db_path="$${db_path%%\?*}"; \
		echo "Detected local SQLite database: $$db_path"; \
		sqlite3 "$$db_path" \
			"DELETE FROM setups; DELETE FROM users WHERE role = 100; DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
		echo "SQLite setup state reset. Restart the local API process before testing the setup wizard."; \
	else \
		echo "No running docker dev PostgreSQL or local SQLite database found."; \
		echo "Start the data plane with 'make dev-infra', or set SQLITE_PATH/DEV_SQLITE_PATH."; \
		exit 1; \
	fi
