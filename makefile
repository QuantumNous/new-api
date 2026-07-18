WEB_DIR = ./web/default
WEB_CLASSIC_DIR = ./web/classic
API_DIR = .
DEV_WEB_DEFAULT_PORT ?= 5173
DEV_WEB_CLASSIC_PORT ?= 5174
DEV_COMPOSE_FILE = docker-compose.dev.yml
DEV_POSTGRES_SERVICE = postgres
DEV_API_SERVICE = new-api
DEV_POSTGRES_DB = new-api
DEV_POSTGRES_USER = root
DEV_SQLITE_PATH ?= one-api.db

.PHONY: all check-build-root check-version build-web build-web-classic build-all-web start-api dev dev-api dev-api-rebuild dev-web dev-web-classic reset-setup build-backend docker-integrated docker-backend docker-frontend docker-separated

all: build-all-web start-api

check-build-root:
	@test "$$(git rev-parse --show-prefix)" = "" || (echo "Run make from the authoritative repository root." && exit 1)
	@test "$$(basename "$$(git rev-parse --show-toplevel)")" != "_qn_tmp" || (echo "Refusing to build from the upstream reference tree." && exit 1)

check-version: check-build-root
	@test -s VERSION || (echo "VERSION must not be empty." && exit 1)

build-web: check-version
	@echo "Building default web..."
	@cd ./web && bun install --frozen-lockfile
	@cd $(WEB_DIR) && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat ../../VERSION) bun run build

build-web-classic: check-version
	@echo "Building classic web..."
	@cd ./web && bun install --frozen-lockfile
	@cd $(WEB_CLASSIC_DIR) && VITE_REACT_APP_VERSION=$(cat ../../VERSION) bun run build

build-all-web: build-web build-web-classic

# Pure backend binary without embedding web/*/dist (requires FRONTEND_MODE=disabled|redirect at runtime).
build-backend: check-version
	@echo "Building pure backend (tags=frontend_external)..."
	@go build -trimpath -buildvcs=true -tags frontend_external \
		-ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$$(cat VERSION)'" \
		-o new-api-backend .

docker-integrated: check-build-root
	@echo "Building integrated image..."
	@docker build --tag new-api:local .

docker-backend: check-build-root
	@echo "Building pure backend image..."
	@docker build -f Dockerfile.backend --tag new-api-backend:local .

docker-frontend: check-build-root
	@echo "Building separated frontend image..."
	@docker build -f deploy/separated/Dockerfile.frontend --tag new-api-frontend:local .

docker-separated: docker-backend docker-frontend
	@echo "Separated images ready: new-api-backend:local new-api-frontend:local"

start-api: check-build-root
	@echo "Starting api dev server..."
	@cd $(API_DIR) && go run . &

dev-api:
	@echo "Starting api services (docker)..."
	@docker compose -f $(DEV_COMPOSE_FILE) up -d

dev-api-rebuild:
	@echo "Rebuilding and starting api service (docker)..."
	@docker compose -f $(DEV_COMPOSE_FILE) up -d --build $(DEV_API_SERVICE)

dev-web:
	@echo "Starting default web dev server..."
	@echo "Default web: http://localhost:$(DEV_WEB_DEFAULT_PORT)"
	@cd ./web && bun install --filter ./default
	@cd $(WEB_DIR) && bun run dev -- --host 0.0.0.0 --port $(DEV_WEB_DEFAULT_PORT)

dev-web-classic:
	@echo "Starting classic web dev server..."
	@cd ./web && bun install --filter ./classic
	@cd $(WEB_CLASSIC_DIR) && bun run dev -- --host 0.0.0.0 --port $(DEV_WEB_CLASSIC_PORT)

dev: dev-api dev-web

reset-setup:
	@echo "Resetting local setup wizard state..."
	@if docker compose -f $(DEV_COMPOSE_FILE) ps --services --status running | grep -qx "$(DEV_POSTGRES_SERVICE)"; then \
		echo "Detected running docker dev PostgreSQL. Removing setup record and root users..."; \
		docker compose -f $(DEV_COMPOSE_FILE) exec -T $(DEV_POSTGRES_SERVICE) \
			psql -U $(DEV_POSTGRES_USER) -d $(DEV_POSTGRES_DB) \
			-c 'DELETE FROM setups;' \
			-c 'DELETE FROM users WHERE role = 100;' \
			-c "DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
		echo "Restarting docker dev api so setup status is recalculated..."; \
		docker compose -f $(DEV_COMPOSE_FILE) restart $(DEV_API_SERVICE); \
	elif db_path="$${SQLITE_PATH:-$(DEV_SQLITE_PATH)}"; db_path="$${db_path%%\?*}"; [ -f "$$db_path" ]; then \
		db_path="$${SQLITE_PATH:-$(DEV_SQLITE_PATH)}"; \
		db_path="$${db_path%%\?*}"; \
		echo "Detected local SQLite database: $$db_path"; \
		sqlite3 "$$db_path" \
			"DELETE FROM setups; DELETE FROM users WHERE role = 100; DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
		echo "SQLite setup state reset. Restart the local api process before testing the setup wizard."; \
	else \
		echo "No running docker dev PostgreSQL or local SQLite database found."; \
		echo "Start the dev stack with 'make dev-api', or set SQLITE_PATH/DEV_SQLITE_PATH to your local SQLite database."; \
		exit 1; \
	fi
