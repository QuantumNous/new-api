# new-api — 常用命令管理
#
# 前置依赖:
#   - just (https://github.com/casey/just) — 运行此文件
#   - Go 1.22+ — 后端编译与运行
#   - Bun — 前端构建与开发
#   - Docker + Docker Compose — 开发数据库与容器化部署
#
# 快速入门:
#   just                       # 列出所有命令
#   just install               # 安装所有前端依赖
#   just dev                   # 启动默认前端 dev server
#   just run                   # 直接运行 Go 后端
#   just build                 # 全量构建（前端 + Go 二进制）
#   just test                  # 运行所有 Go 测试
#
# 完整列表: just --list

# ─── Settings ────────────────────────────────────────────────────────────────

set positional-arguments := false
go-binary := "new-api"
go-package := "github.com/QuantumNous/new-api"

# ─── Build — 构建 ──────────────────────────────────────────────────────────

# 全量构建: 所有前端主题 + Go 二进制
build: build-default build-classic build-go
    @echo "✓ Full build complete"

# 构建 default 主题前端
build-default:
    @echo "→ Building web/default..."
    @cd web/default && bun run build
    @echo "✓ web/default built"

# 构建 classic 主题前端
build-classic:
    @echo "→ Building web/classic..."
    @cd web/classic && bun run build
    @echo "✓ web/classic built"

# 构建 Go 二进制（内嵌所有前端 dist）
build-go:
    @echo "→ Building {{go-binary}}..."
    @go build -o {{go-binary}} .
    @echo "✓ {{go-binary}} built"

# ─── Dev — 本地开发 ────────────────────────────────────────────────────────

# 启动 default 主题前端 dev server（HMR）
dev:
    @cd web/default && bun run dev

# 启动 classic 主题前端 dev server（HMR）
dev-classic:
    @cd web/classic && bun run dev

# 直接运行 Go 后端
run:
    @go run main.go

# 先构建再使用 Air 热加载运行 Go 后端（监听 .go 文件变化自动重启）
dev-hot: build
    @air

# 前端 dev server + Air 热加载后端（全栈开发模式）
dev-all: dev dev-hot

# 启动 Docker 开发环境（PostgreSQL + Go 后端）
dev-api:
    @docker compose -f docker-compose.dev.yml up -d

# 重建并重启 Docker 开发环境中的 Go 后端
dev-api-rebuild:
    @docker compose -f docker-compose.dev.yml up -d --build new-api

# 停止 Docker 开发环境
dev-api-down:
    @docker compose -f docker-compose.dev.yml down

# 清除 Docker 开发环境数据（含 volume）
dev-api-down-clean:
    @docker compose -f docker-compose.dev.yml down -v

# 同时启动 default + classic 两个前端 dev server
dev-web:
    @echo "→ Starting both frontend dev servers..."
    @echo "  Default: http://localhost:5173"
    @echo "  Classic: http://localhost:5174"
    @cd web/default && bun run dev -- --host 0.0.0.0 --port 5173 &
    @cd web/classic && bun run dev -- --host 0.0.0.0 --port 5174 & wait

# ─── Quality (Go) — Go 代码质量 ────────────────────────────────────────────

# 运行 Go vet 静态分析
vet:
    @go vet ./...

# 运行所有 Go 测试
test:
    @go test -count=1 ./...

# 运行短测试（跳过集成/慢测试）
test-short:
    @go test -short -count=1 ./...

# 运行指定包的测试: just test-pkg PKG="./relay/..."
test-pkg PKG="./...":
    @go test -count=1 {{PKG}}

# 格式化 Go 代码
fmt:
    @go fmt ./...

# 检查 Go 代码格式（不修改）
fmt-check:
    @test -z "$(shell gofmt -l .)" || (echo "→ 以下文件未格式化:"; gofmt -l .; exit 1)

# 整理 Go 依赖
tidy:
    @go mod tidy

# ─── Quality (Frontend) — 前端代码质量 ────────────────────────────────────

# TypeScript 类型检查: 所有主题
typecheck: typecheck-default typecheck-classic

typecheck-default:
    @cd web/default && bun run typecheck

typecheck-classic:
    @cd web/classic && bun run typecheck

# ESLint 检查: 所有主题
lint: lint-default lint-classic

lint-default:
    @cd web/default && bun run lint

lint-classic:
    @cd web/classic && bun run lint

# Prettier 格式化前端代码
format:
    @cd web/default && bun run format

# Prettier 格式检查（不修改）
format-check:
    @cd web/default && bun run format:check

# ─── Docker — 容器化 ──────────────────────────────────────────────────────

# 构建生产 Docker 镜像
docker-build:
    @docker build -t {{go-binary}}:latest .

# ─── Dependencies — 依赖安装 ──────────────────────────────────────────────

# 安装所有前端主题的依赖
install:
    @echo "→ Installing web/default dependencies..."
    @cd web/default && bun install
    @echo "→ Installing web/classic dependencies..."
    @cd web/classic && bun install
    @echo "✓ All dependencies installed"

# ─── I18n — 国际化 ─────────────────────────────────────────────────────────

# 同步 i18n 翻译文件（default 主题）
i18n-sync:
    @cd web/default && bun run i18n:sync

# ─── Maintenance — 维护 ───────────────────────────────────────────────────

# 重置本地安装向导状态（清除 setup 记录和 root 用户）
reset-setup:
    @echo "→ Resetting local setup wizard state..."
    @if docker compose -f docker-compose.dev.yml ps --services --status running | grep -qx "postgres"; then \
        echo "  Detected running docker dev PostgreSQL. Removing setup record and root users..."; \
        docker compose -f docker-compose.dev.yml exec -T postgres \
            psql -U root -d new-api \
            -c 'DELETE FROM setups;' \
            -c 'DELETE FROM users WHERE role = 100;' \
            -c "DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
        echo "  Restarting docker dev backend..."; \
        docker compose -f docker-compose.dev.yml restart new-api; \
    elif [ -f one-api.db ]; then \
        echo "  Detected local SQLite database: one-api.db"; \
        sqlite3 one-api.db \
            "DELETE FROM setups; DELETE FROM users WHERE role = 100; DELETE FROM options WHERE key IN ('SelfUseModeEnabled', 'DemoSiteEnabled');"; \
        echo "  SQLite setup state reset. Restart the local backend process before testing."; \
    else \
        echo "  No running docker dev PostgreSQL or local SQLite database found."; \
        echo "  Start the dev stack with 'just dev-api', or ensure one-api.db exists."; \
        exit 1; \
    fi

# ─── Backup — 数据库备份 ──────────────────────────────────────────────────

# 备份 SQLite 数据库（保留最近 7 份）
backup:
    @echo "→ Backing up one-api.db..."
    @mkdir -p backups
    @if [ -f one-api.db ]; then \
        cp one-api.db "backups/one-api-$(shell date +%Y%m%d-%H%M%S).db"; \
        echo "✓ Backed up to backups/"; \
        echo "→ Cleaning old backups (keeping last 7)..."; \
        ls -t backups/one-api-*.db 2>/dev/null | tail -n +8 | xargs -r rm -f; \
    else \
        echo "⚠ one-api.db not found, skipping backup"; \
    fi

# ─── Clean — 清理 ─────────────────────────────────────────────────────────

# 移除所有构建产物（自动备份数据库）
clean: backup
    @echo "→ Cleaning build artifacts..."
    @rm -f {{go-binary}}
    @rm -rf web/default/dist
    @rm -rf web/classic/dist
    @echo "✓ Cleaned"
