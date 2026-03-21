FRONTEND_DIR = ./web
BACKEND_DIR = .
APP_VERSION = $(shell cat VERSION 2>/dev/null || echo dev)
GO_CACHE_DIR ?= /tmp/new-api-go-build
GO_MOD_CACHE_DIR ?= /tmp/new-api-go-mod

.PHONY: all build-frontend start-backend verify verify-backend-test verify-backend-build verify-frontend-build verify-browser-runtime test-install test-api test-e2e upgrade-verify

all: build-frontend start-backend

verify: verify-frontend-build verify-backend-test verify-backend-build upgrade-verify test-api test-e2e
	@echo "==> [verify] completed"

verify-backend-test:
	@echo "==> [backend:test] go test ./..."
	@mkdir -p $(GO_CACHE_DIR) $(GO_MOD_CACHE_DIR)
	@cd $(BACKEND_DIR) && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) go test ./...

verify-backend-build:
	@echo "==> [backend:build] go build ./..."
	@mkdir -p $(GO_CACHE_DIR) $(GO_MOD_CACHE_DIR)
	@cd $(BACKEND_DIR) && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) go build ./...

upgrade-verify:
	@echo "==> [upgrade:verify] go test -tags=upgradeverify ./model -run '^TestUpgradeCompatibility'"
	@mkdir -p $(GO_CACHE_DIR) $(GO_MOD_CACHE_DIR)
	@cd $(BACKEND_DIR) && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) go test -tags=upgradeverify ./model -run '^TestUpgradeCompatibility'

verify-frontend-build:
	@echo "==> [frontend:install] bun install --frozen-lockfile"
	@cd $(FRONTEND_DIR) && bun install --frozen-lockfile
	@echo "==> [frontend:build] bun run build"
	@cd $(FRONTEND_DIR) && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(APP_VERSION) bun run build

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && bun install --frozen-lockfile && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(APP_VERSION) bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run main.go &

verify-browser-runtime:
	@echo "==> [browser:install] bun run test:install"
	@cd $(FRONTEND_DIR) && bun run test:install

test-install:
	@echo "Installing Playwright browser runtime..."
	@cd $(FRONTEND_DIR) && bun run test:install

test-api:
	@echo "Running API baseline tests..."
	@cd $(FRONTEND_DIR) && PLAYWRIGHT_SKIP_FRONTEND_SETUP=1 bun run test:api

test-e2e:
	@echo "Running E2E baseline tests..."
	@cd $(FRONTEND_DIR) && PLAYWRIGHT_SKIP_FRONTEND_SETUP=1 bun run test:e2e
