# Project Context

## 当前状态

- 初始化时间：2026-06-12
- 当前分支状态：`master...origin/master [ahead 1]`
- 当前工作区已有变更：`AGENTS.md`、`README.md` 已修改；`.agents/REVIEW_SECURITY.md`、`.agents/WORKFLOW.md`、`scripts/codex-check.ps1` 为未跟踪文件。
- 本文档只记录项目上下文，不代表已验证所有命令均可在当前机器成功运行。

## 技术栈

- 后端：Go module `github.com/QuantumNous/new-api`，`go.mod` 声明 `go 1.25.1`。
- HTTP 框架：Gin，路由集中在 `router/`。
- 数据访问：GORM，支持 SQLite、MySQL、PostgreSQL；可配置独立日志数据库。
- 缓存与后台任务：Redis、内存缓存、渠道缓存、配额/订阅/模型刷新等后台任务。
- 认证与安全：Session、JWT、OAuth/OIDC、自定义 OAuth、Passkey、2FA、权限中间件、请求限流。
- Relay 网关：OpenAI/Claude/Gemini 等多 Provider 请求转换、渠道分发、计费、日志和响应适配。
- 默认前端：`web/default`，React 19、TypeScript、Rsbuild、TanStack Router、React Query、Zustand、Tailwind CSS、Base UI/shadcn 风格组件。
- 经典前端：`web/classic`，React、JS/JSX、Rsbuild、Semi UI、react-router-dom。
- 前端包管理：`web/bun.lock`，workspace 包含 `default` 与 `classic`。
- 桌面封装：`electron/`，Electron 与 electron-builder，使用 npm lockfile。
- 部署：Docker、Docker Compose、Windows 本地 Docker 脚本、systemd service。

## 主要目录

- `main.go`：服务入口，初始化资源、后台任务、Gin Server，并嵌入两套前端产物。
- `router/`：API、Relay、Dashboard、Video、Web 静态资源路由注册。
- `controller/`：请求解析、权限后的业务编排和响应输出。
- `service/`：业务逻辑层，包括渠道选择、计费、订阅、任务、OAuth、文件处理等。
- `model/`：GORM 模型、数据库初始化、迁移、查询与缓存。
- `relay/`：AI 请求/响应转换、Provider adaptor、流式处理和异步任务适配。
- `middleware/`：鉴权、限流、日志、请求体处理、路由标记、渠道分发。
- `setting/`：系统配置、模型配置、倍率、支付、性能和运营配置。
- `common/`：环境变量、日志、JSON、Redis、缓存、配额等通用能力。
- `constant/`、`dto/`、`types/`：常量、请求响应结构和跨模块类型。
- `oauth/`、`i18n/`：OAuth Provider 注册与后端国际化。
- `pkg/`：相对独立的内部包，例如 billing expression、缓存和性能指标。
- `web/default/`：默认管理后台，按 `routes/` 与 `features/` 组织。
- `web/classic/`：经典主题后台，按 `pages/`、`components/`、`helpers/`、`hooks/` 组织。
- `electron/`：桌面应用主进程、预加载脚本和打包配置。
- `docs/`：项目说明、安装、OpenAPI、结构图和变更资料。
- `scripts/`：项目辅助脚本；当前包含 Codex 检查脚本和 Windows Docker 脚本。

## 常用命令

### 统一检查

```powershell
.\scripts\codex-check.ps1
```

### 后端

```powershell
go run main.go
go test ./...
```

### 前端依赖

```powershell
cd web
bun install --frozen-lockfile
```

### 默认前端

```powershell
cd web/default
bun run dev -- --host 0.0.0.0 --port 5173
bun run typecheck
bun run lint
bun run build:check
bun run build
```

Windows 下若 Bun CLI 不在 PATH，可直接调用 Rsbuild：

```powershell
node node_modules\@rsbuild\core\bin\rsbuild.js build
```

### 经典前端

```powershell
cd web/classic
bun run dev -- --host 0.0.0.0 --port 5174
bun run lint
bun run build
```

Windows 下若 Bun CLI 不在 PATH，可直接调用 Rsbuild：

```powershell
node node_modules\@rsbuild\core\bin\rsbuild.js build
```

### Makefile

```powershell
make dev-api
make dev-web
make dev
make build-all-frontends
make all
```

### Docker

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml up -d --build new-api
docker compose up -d
```

### Windows 本地 Docker 脚本

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 start
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 restart
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 status
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 logs
```

### Electron

```powershell
cd electron
npm run dev-app
npm run build
```

## 关键业务模块

- 系统初始化与配置：`main.go`、`model/setup.go`、`setting/`、`controller/setup.go`。
- 用户与认证：`controller/user.go`、`middleware/auth.go`、`oauth/`、`service/passkey/`。
- 渠道管理：`controller/channel*.go`、`service/channel*.go`、`model/channel*.go`。
- Token 管理：`controller/token.go`、`model/token.go`、`service/ccswitch_import.go`。
- Relay 请求处理：`router/relay-router.go`、`controller/relay.go`、`relay/`。
- 计费与配额：`service/billing*.go`、`service/quota.go`、`pkg/billingexpr/`、`relay/helper/price.go`。
- 支付与订阅：`controller/topup*.go`、`controller/subscription*.go`、`service/waffo_pancake.go`、`model/subscription.go`。
- 日志与统计：`controller/log.go`、`controller/usedata.go`、`model/log.go`、`model/usedata*.go`。
- 默认管理后台：`web/default/src/routes/`、`web/default/src/features/`、`web/default/src/lib/api.ts`。
- 经典管理后台：`web/classic/src/pages/`、`web/classic/src/helpers/api.js`。

## 运行与验证方式

- 后端通用验证优先使用 `go test ./...`，小范围改动可先跑受影响包。
- 默认前端改动优先跑 `bun run typecheck`、`bun run lint`、`bun run build:check`。
- 经典前端改动优先跑 `bun run lint` 与 `bun run build`。
- 用户可见改动应通过 `http://localhost:3000` 或前端 dev server 做人工验收。
- Docker 本地环境的健康检查地址是 `http://localhost:3000/api/status`。
- `project.ps1 restart` 会先停止容器再构建镜像；不要在构建中途退出，否则需重新执行 `restart` 才能恢复本地站点。

## 注意事项

- 当前 `README.md` 处于已修改状态，内容像 Codex 规则包说明；项目说明主要参考 `README.en.md`、`docs/project-map.md` 和源码配置。
- `main.go` 使用 `//go:embed` 嵌入 `web/default/dist` 与 `web/classic/dist`，直接运行后端前应确认前端产物或占位文件存在。
- 涉及数据库、认证、支付、Relay、文件读写、Webhook、密钥和 CI/CD 的改动属于高风险，需要先集中确认。
- 不读取或输出真实 `.env`、证书、私钥、生产密钥；仅可参考 `.env.example`。
- 现有测试主要是 Go 测试，当前扫描到 44 个 `*_test.go` 文件；前端测试文件未作为主要验证入口出现。

## 主要依据

- `go.mod`
- `main.go`
- `makefile`
- `Dockerfile`
- `Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `README.en.md`
- `docs/project-map.md`
- `docs/windows-docker-development.md`
- `docs/local-code-change-preview.md`
- `web/package.json`
- `web/default/package.json`
- `web/default/rsbuild.config.ts`
- `web/default/eslint.config.js`
- `web/default/.prettierrc`
- `web/default/components.json`
- `web/classic/package.json`
- `web/classic/rsbuild.config.ts`
- `electron/package.json`
