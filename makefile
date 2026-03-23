FRONTEND_DIR = ./web
BACKEND_DIR = .
APP_VERSION = $(shell cat VERSION 2>/dev/null || echo dev)
GO_CACHE_DIR ?= /tmp/new-api-go-build
GO_MOD_CACHE_DIR ?= /tmp/new-api-go-mod
TMP_DIR ?= ./.tmp
LOCAL_BACKEND_PID_FILE ?= $(TMP_DIR)/local-backend.pid
LOCAL_FRONTEND_PID_FILE ?= $(TMP_DIR)/local-frontend.pid
LOCAL_TTL_PID_FILE ?= $(TMP_DIR)/local-ttl.pid
LOCAL_BACKEND_LOG ?= $(TMP_DIR)/local-backend.log
LOCAL_FRONTEND_LOG ?= $(TMP_DIR)/local-frontend.log
LOCAL_TTL_LOG ?= $(TMP_DIR)/local-ttl.log
LOCAL_SQL_DSN ?= postgresql://root:123456@127.0.0.1:5432/new-api
LOCAL_REDIS_DSN ?= redis://127.0.0.1:6379
LOCAL_TTL_MINUTES ?= 60
DOCKER_COMPOSE ?= $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; elif docker-compose version >/dev/null 2>&1; then echo "docker-compose"; fi)
LOCAL_COMPOSE ?= $(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.local.yml

.PHONY: all build-frontend start-backend verify verify-backend-test verify-backend-build verify-frontend-build verify-browser-runtime test-install test-api test-e2e upgrade-verify local-up local-down local-status local-logs

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

local-up:
	@if [ -z "$(DOCKER_COMPOSE)" ]; then echo "docker compose/docker-compose is required"; exit 1; fi
	@mkdir -p $(TMP_DIR) $(GO_CACHE_DIR) $(GO_MOD_CACHE_DIR)
	@echo "==> [local-up] starting postgres and redis via $(LOCAL_COMPOSE)"
	@$(LOCAL_COMPOSE) up -d postgres redis
	@echo "==> [local-up] waiting for postgres"
	@i=0; until docker exec postgres pg_isready -U root -d new-api >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -ge 30 ]; then echo "postgres did not become ready in time"; exit 1; fi; \
		sleep 1; \
	done
	@echo "==> [local-up] waiting for redis"
	@i=0; until docker exec redis redis-cli ping >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -ge 30 ]; then echo "redis did not become ready in time"; exit 1; fi; \
		sleep 1; \
	done
	@echo "==> [local-up] ensuring frontend dependencies"
	@cd $(FRONTEND_DIR) && bun install --frozen-lockfile
	@if [ -f $(LOCAL_BACKEND_PID_FILE) ] && kill -0 "$$(cat $(LOCAL_BACKEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "==> [local-up] backend already running (pid $$(cat $(LOCAL_BACKEND_PID_FILE)))"; \
	else \
		rm -f $(LOCAL_BACKEND_PID_FILE); \
		echo "==> [local-up] starting backend on http://127.0.0.1:3000"; \
		nohup setsid /bin/bash -lc "cd $(BACKEND_DIR) && env SQL_DSN='$(LOCAL_SQL_DSN)' REDIS_CONN_STRING='$(LOCAL_REDIS_DSN)' GOCACHE='$(GO_CACHE_DIR)' GOMODCACHE='$(GO_MOD_CACHE_DIR)' go run main.go" >$(LOCAL_BACKEND_LOG) 2>&1 < /dev/null & \
		echo $$! > $(LOCAL_BACKEND_PID_FILE); \
	fi
	@echo "==> [local-up] waiting for backend http://127.0.0.1:3000/api/status"
	@i=0; until curl -fsS http://127.0.0.1:3000/api/status >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ -f $(LOCAL_BACKEND_PID_FILE) ] && ! kill -0 "$$(cat $(LOCAL_BACKEND_PID_FILE))" >/dev/null 2>&1; then \
			echo "backend exited unexpectedly; see $(LOCAL_BACKEND_LOG)"; \
			exit 1; \
		fi; \
		if [ $$i -ge 30 ]; then echo "backend did not become ready in time; see $(LOCAL_BACKEND_LOG)"; exit 1; fi; \
		sleep 1; \
	done
	@if [ -f $(LOCAL_BACKEND_PID_FILE) ] && ! kill -0 "$$(cat $(LOCAL_BACKEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "backend is not running after readiness check; see $(LOCAL_BACKEND_LOG)"; \
		exit 1; \
	fi
	@if [ -f $(LOCAL_FRONTEND_PID_FILE) ] && kill -0 "$$(cat $(LOCAL_FRONTEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "==> [local-up] frontend already running (pid $$(cat $(LOCAL_FRONTEND_PID_FILE)))"; \
	else \
		rm -f $(LOCAL_FRONTEND_PID_FILE); \
		echo "==> [local-up] starting frontend on http://127.0.0.1:5173"; \
		nohup setsid /bin/bash -lc "cd $(FRONTEND_DIR) && bun run dev" >$(LOCAL_FRONTEND_LOG) 2>&1 < /dev/null & \
		echo $$! > $(LOCAL_FRONTEND_PID_FILE); \
	fi
	@echo "==> [local-up] waiting for frontend http://127.0.0.1:5173"
	@i=0; until curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ -f $(LOCAL_FRONTEND_PID_FILE) ] && ! kill -0 "$$(cat $(LOCAL_FRONTEND_PID_FILE))" >/dev/null 2>&1; then \
			echo "frontend exited unexpectedly; see $(LOCAL_FRONTEND_LOG)"; \
			exit 1; \
		fi; \
		if [ $$i -ge 30 ]; then echo "frontend did not become ready in time; see $(LOCAL_FRONTEND_LOG)"; exit 1; fi; \
		sleep 1; \
	done
	@if [ -f $(LOCAL_FRONTEND_PID_FILE) ] && ! kill -0 "$$(cat $(LOCAL_FRONTEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "frontend is not running after readiness check; see $(LOCAL_FRONTEND_LOG)"; \
		exit 1; \
	fi
	@if [ -f $(LOCAL_TTL_PID_FILE) ]; then \
		pid="$$(cat $(LOCAL_TTL_PID_FILE))"; \
		if kill -0 "$$pid" >/dev/null 2>&1; then kill "$$pid"; fi; \
		rm -f $(LOCAL_TTL_PID_FILE); \
	fi
	@echo "==> [local-up] scheduling auto-stop in $(LOCAL_TTL_MINUTES) minute(s)"
	@nohup setsid /bin/bash -lc "sleep $$(( $(LOCAL_TTL_MINUTES) * 60 )); cd $(CURDIR) && make local-down" >$(LOCAL_TTL_LOG) 2>&1 < /dev/null & echo $$! > $(LOCAL_TTL_PID_FILE)
	@echo "==> [local-up] ready"
	@echo "backend  http://127.0.0.1:3000"
	@echo "frontend http://127.0.0.1:5173"
	@echo "ttl      $(LOCAL_TTL_MINUTES) minute(s)"
	@echo "ssh      ssh -L 5173:127.0.0.1:5173 -L 3000:127.0.0.1:3000 <user>@<host>"

local-down:
	@echo "==> [local-down] stopping local frontend/backend"
	@if [ -f $(LOCAL_TTL_PID_FILE) ]; then \
		pid="$$(cat $(LOCAL_TTL_PID_FILE))"; \
		if kill -0 "$$pid" >/dev/null 2>&1; then kill "$$pid"; fi; \
		rm -f $(LOCAL_TTL_PID_FILE); \
	fi
	@if [ -f $(LOCAL_FRONTEND_PID_FILE) ]; then \
		pid="$$(cat $(LOCAL_FRONTEND_PID_FILE))"; \
		if kill -0 "$$pid" >/dev/null 2>&1; then kill "$$pid"; fi; \
		rm -f $(LOCAL_FRONTEND_PID_FILE); \
	fi
	@if [ -f $(LOCAL_BACKEND_PID_FILE) ]; then \
		pid="$$(cat $(LOCAL_BACKEND_PID_FILE))"; \
		if kill -0 "$$pid" >/dev/null 2>&1; then kill "$$pid"; fi; \
		rm -f $(LOCAL_BACKEND_PID_FILE); \
	fi
	@if [ -n "$(DOCKER_COMPOSE)" ]; then \
		echo "==> [local-down] stopping postgres and redis"; \
		$(LOCAL_COMPOSE) stop postgres redis; \
	fi

local-status:
	@echo "==> [local-status]"
	@if [ -f $(LOCAL_BACKEND_PID_FILE) ] && kill -0 "$$(cat $(LOCAL_BACKEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "backend  running pid=$$(cat $(LOCAL_BACKEND_PID_FILE)) http://127.0.0.1:3000"; \
	else \
		echo "backend  stopped"; \
	fi
	@if [ -f $(LOCAL_FRONTEND_PID_FILE) ] && kill -0 "$$(cat $(LOCAL_FRONTEND_PID_FILE))" >/dev/null 2>&1; then \
		echo "frontend running pid=$$(cat $(LOCAL_FRONTEND_PID_FILE)) http://127.0.0.1:5173"; \
	else \
		echo "frontend stopped"; \
	fi
	@if [ -f $(LOCAL_TTL_PID_FILE) ] && kill -0 "$$(cat $(LOCAL_TTL_PID_FILE))" >/dev/null 2>&1; then \
		echo "ttl      armed pid=$$(cat $(LOCAL_TTL_PID_FILE)) duration=$(LOCAL_TTL_MINUTES)m"; \
	else \
		echo "ttl      not armed"; \
	fi
	@if [ -n "$(DOCKER_COMPOSE)" ]; then \
		$(LOCAL_COMPOSE) ps postgres redis || true; \
	fi

local-logs:
	@echo "==> [local-logs] backend"
	@if [ -f $(LOCAL_BACKEND_LOG) ]; then tail -n 40 $(LOCAL_BACKEND_LOG); else echo "no backend log"; fi
	@echo "==> [local-logs] frontend"
	@if [ -f $(LOCAL_FRONTEND_LOG) ]; then tail -n 40 $(LOCAL_FRONTEND_LOG); else echo "no frontend log"; fi
	@echo "==> [local-logs] ttl"
	@if [ -f $(LOCAL_TTL_LOG) ]; then tail -n 40 $(LOCAL_TTL_LOG); else echo "no ttl log"; fi
