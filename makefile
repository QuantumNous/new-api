FRONTEND_DIR = ./web
BACKEND_DIR = .
BIN_DIR = ./bin

.PHONY: all build-frontend start-backend tools clean-tools

all: build-frontend start-backend

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && bun install && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run main.go &

# 编译渠道管理工具
tools:
	@echo "Building channel management tools..."
	@mkdir -p $(BIN_DIR)
	@go build -o $(BIN_DIR)/channel-health-check ./cmd/channel-health-check
	@go build -o $(BIN_DIR)/channel-batch-manager ./cmd/channel-batch-manager
	@echo "Tools built successfully:"
	@echo "  - $(BIN_DIR)/channel-health-check"
	@echo "  - $(BIN_DIR)/channel-batch-manager"

# 清理编译的工具
clean-tools:
	@echo "Cleaning tools..."
	@rm -f $(BIN_DIR)/channel-health-check
	@rm -f $(BIN_DIR)/channel-batch-manager
