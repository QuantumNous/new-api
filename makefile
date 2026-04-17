.DEFAULT_GOAL := help

FRONTEND_DIR := web
BACKEND_DIR := .
RELEASE_DIR := release
VERSION := $(strip $(file <VERSION))
GO_BUILD_FLAGS := -trimpath

ifeq ($(OS),Windows_NT)
SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -ExecutionPolicy Bypass -Command
FRONTEND_BUILD_CMD = Set-Location '$(FRONTEND_DIR)'; $$env:DISABLE_ESLINT_PLUGIN = 'true'; $$env:VITE_REACT_APP_VERSION = '$(VERSION)'; bun install; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; bun run build; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
RUN_BACKEND_CMD = Set-Location '$(BACKEND_DIR)'; go run . --log-dir ./logs
BUILD_LINUX_AMD64_CMD = $$env:CGO_ENABLED = '0'; $$env:GOOS = 'linux'; $$env:GOARCH = 'amd64'; go build $(GO_BUILD_FLAGS) -ldflags "$(LDFLAGS)" -o "$(RELEASE_DIR)/linux-amd64/new-api"; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
BUILD_LINUX_ARM64_CMD = $$env:CGO_ENABLED = '0'; $$env:GOOS = 'linux'; $$env:GOARCH = 'arm64'; go build $(GO_BUILD_FLAGS) -ldflags "$(LDFLAGS)" -o "$(RELEASE_DIR)/linux-arm64/new-api"; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
PACKAGE_LINUX_AMD64_CMD = tar.exe -czf "$(RELEASE_DIR)/new-api-linux-amd64.tar.gz" -C "$(RELEASE_DIR)/linux-amd64" .; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
PACKAGE_LINUX_ARM64_CMD = tar.exe -czf "$(RELEASE_DIR)/new-api-linux-arm64.tar.gz" -C "$(RELEASE_DIR)/linux-arm64" .; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
ENSURE_DIR = New-Item -ItemType Directory -Force -Path "$(1)" | Out-Null
COPY_FILE = Copy-Item -Force -LiteralPath "$(1)" -Destination "$(2)"
REMOVE_DIR = if (Test-Path -LiteralPath "$(1)") { Remove-Item -Recurse -Force -LiteralPath "$(1)" }
else
FRONTEND_BUILD_CMD = cd "$(FRONTEND_DIR)" && bun install && DISABLE_ESLINT_PLUGIN=true VITE_REACT_APP_VERSION="$(VERSION)" bun run build
RUN_BACKEND_CMD = cd "$(BACKEND_DIR)" && go run . --log-dir ./logs
BUILD_LINUX_AMD64_CMD = CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build $(GO_BUILD_FLAGS) -ldflags "$(LDFLAGS)" -o "$(RELEASE_DIR)/linux-amd64/new-api"
BUILD_LINUX_ARM64_CMD = CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build $(GO_BUILD_FLAGS) -ldflags "$(LDFLAGS)" -o "$(RELEASE_DIR)/linux-arm64/new-api"
PACKAGE_LINUX_AMD64_CMD = tar -czf "$(RELEASE_DIR)/new-api-linux-amd64.tar.gz" -C "$(RELEASE_DIR)/linux-amd64" .
PACKAGE_LINUX_ARM64_CMD = tar -czf "$(RELEASE_DIR)/new-api-linux-arm64.tar.gz" -C "$(RELEASE_DIR)/linux-arm64" .
ENSURE_DIR = mkdir -p "$(1)"
COPY_FILE = cp "$(1)" "$(2)"
REMOVE_DIR = rm -rf "$(1)"
endif

LDFLAGS := -s -w -X 'github.com/QuantumNous/new-api/common.Version=$(VERSION)'

.PHONY: help all dev run build-frontend build-linux build-linux-amd64 build-linux-arm64 package-linux package-linux-amd64 package-linux-arm64 clean

help:
	@echo "Available targets:"
	@echo "  make dev                  Build frontend assets and run the backend locally"
	@echo "  make run                  Run the backend locally"
	@echo "  make build-frontend       Install frontend deps and build web/dist"
	@echo "  make build-linux-amd64    Cross-compile Linux amd64 binary into release/"
	@echo "  make build-linux-arm64    Cross-compile Linux arm64 binary into release/"
	@echo "  make build-linux          Build both Linux targets"
	@echo "  make package-linux-amd64  Package Linux amd64 release tar.gz"
	@echo "  make package-linux-arm64  Package Linux arm64 release tar.gz"
	@echo "  make package-linux        Package both Linux release tar.gz files"
	@echo "  make clean                Remove release artifacts"

all: build-frontend

dev: build-frontend run

run:
	@echo "Starting backend..."
	@$(call ENSURE_DIR,$(BACKEND_DIR)/logs)
	@$(RUN_BACKEND_CMD)

build-frontend:
	@echo "Building frontend..."
	@$(FRONTEND_BUILD_CMD)

build-linux: build-linux-amd64 build-linux-arm64

build-linux-amd64: build-frontend
	@echo "Building linux/amd64..."
	@$(call ENSURE_DIR,$(RELEASE_DIR)/linux-amd64)
	@$(BUILD_LINUX_AMD64_CMD)
	@$(call COPY_FILE,.env.example,$(RELEASE_DIR)/linux-amd64/.env.example)
	@$(call COPY_FILE,new-api.service,$(RELEASE_DIR)/linux-amd64/new-api.service)

build-linux-arm64: build-frontend
	@echo "Building linux/arm64..."
	@$(call ENSURE_DIR,$(RELEASE_DIR)/linux-arm64)
	@$(BUILD_LINUX_ARM64_CMD)
	@$(call COPY_FILE,.env.example,$(RELEASE_DIR)/linux-arm64/.env.example)
	@$(call COPY_FILE,new-api.service,$(RELEASE_DIR)/linux-arm64/new-api.service)

package-linux: package-linux-amd64 package-linux-arm64

package-linux-amd64: build-linux-amd64
	@echo "Packaging linux/amd64..."
	@$(PACKAGE_LINUX_AMD64_CMD)

package-linux-arm64: build-linux-arm64
	@echo "Packaging linux/arm64..."
	@$(PACKAGE_LINUX_ARM64_CMD)

clean:
	@echo "Cleaning release artifacts..."
	@$(call REMOVE_DIR,$(RELEASE_DIR))
