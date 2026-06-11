# 开发文档 / Development Guide

<p align="center">
  <strong>简体中文</strong> |
  <a href="./DEVELOPMENT.zh_TW.md">繁體中文</a> |
  <a href="./DEVELOPMENT.md">English</a> |
  <a href="./DEVELOPMENT.fr.md">Français</a> |
  <a href="./DEVELOPMENT.ja.md">日本語</a>
</p>

本文档面向开发者，说明如何在本地运行和开发 new-api 项目。

## 环境要求

- **Go**: 1.22+ (项目使用 1.25.1)
- **Bun**: 前端包管理器（优先于 npm/yarn）
- **数据库**: SQLite（默认）/ MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **Docker** (可选): 用于容器化开发环境

## 快速启动

### 方式一：本地开发（推荐）

> **前置要求**：由于 Go 使用 `//go:embed` 嵌入前端文件，首次启动前必须先构建一次前端，否则会报错。

#### 1. 首次启动准备

```bash
# 构建前端（生成 dist 目录，避免 go:embed 报错）
cd web/default
bun install
bun run build
cd ../..

# 立即删除构建产物（避免后端提供静态文件）
rm -rf web/default/dist web/classic/dist
```

#### 2. 启动后端

```bash
# 安装 Go 依赖
go mod download

# 启动后端服务（使用 SQLite）
go run main.go
```

后端默认运行在 `http://localhost:3000`，数据存储在 `one-api.db`

#### 3. 启动前端

```bash
# 进入前端目录
cd web/default

# 安装依赖
bun install

# 启动开发服务器
bun run dev
```

前端开发服务器运行在 `http://localhost:5173`，会自动代理后端请求到 3000 端口。

### 方式二：使用 Makefile

```bash
# 同时启动后端和前端（Docker + 前端开发服务器）
make dev

# 仅启动后端（Docker Compose）
make dev-api

# 仅启动前端
make dev-web

# 启动经典前端
make dev-web-classic
```

## 前端开发

### 可用命令

在 `web/default/` 目录下：

```bash
bun run dev          # 启动开发服务器 (http://localhost:5173)
bun run build        # 生产构建
bun run preview      # 预览生产构建
bun run typecheck    # TypeScript 类型检查
bun run lint         # ESLint 代码检查
bun run format       # Prettier 格式化代码
bun run format:check # 检查代码格式
bun run i18n:sync    # 同步国际化翻译
```

### 技术栈

- **React 19** + **TypeScript**
- **Rsbuild** - 构建工具
- **Base UI** - 组件库
- **Tailwind CSS** - 样式
- **TanStack Router** - 路由
- **TanStack Query** - 数据请求
- **i18next** - 国际化（支持 en/zh/fr/ru/ja/vi）

### 国际化开发

翻译文件位于 `web/default/src/i18n/locales/{lang}.json`。添加或修改翻译后，运行：

```bash
bun run i18n:sync
```

## 后端开发

### 数据库配置

#### SQLite（默认）

无需配置，直接运行 `go run main.go` 即可。

#### MySQL

```bash
# 设置环境变量
export SQL_DSN="root:password@tcp(localhost:3306)/newapi"

# 启动后端
go run main.go
```

#### PostgreSQL（Docker 开发环境）

```bash
# 使用 docker-compose.dev.yml 启动
make dev-api
```

### 项目结构

```
.
├── router/        # HTTP 路由
├── controller/    # 请求处理器
├── service/       # 业务逻辑
├── model/         # 数据模型（GORM）
├── relay/         # AI API 中继/代理
│   └── channel/   # 各提供商适配器 (openai/, claude/, gemini/ 等)
├── middleware/    # 中间件（认证、限流、CORS 等）
├── setting/       # 配置管理
├── common/        # 工具函数
├── dto/           # 数据传输对象
├── constant/      # 常量定义
├── i18n/          # 后端国际化（en/zh）
└── web/           # 前端项目
    ├── default/   # 默认前端（React 19）
    └── classic/   # 经典前端（React 18）
```

### 开发规范

详见 [CLAUDE.md](../../CLAUDE.md)，重点：

1. **JSON 操作**：必须使用 `common/json.go` 中的封装函数
2. **数据库兼容**：代码必须同时兼容 SQLite/MySQL/PostgreSQL
3. **包管理器**：前端优先使用 Bun

## 构建生产版本

```bash
# 构建前端
make build-all-frontends

# 构建后端
go build -o new-api main.go

# 或使用 Docker
docker build -t new-api .
```

## 调试工具

### 重置设置向导

```bash
make reset-setup
```

此命令会清除数据库中的设置和管理员账户，用于重新测试初始化向导。

## 常见问题

### go:embed 报错：no matching files found

**问题**：启动后端时报错 `pattern web/*/dist: no matching files found`

**原因**：`main.go` 使用 `//go:embed` 在编译时嵌入前端文件，如果 `dist` 目录不存在会报错。

**解决**：
```bash
# 先构建前端生成 dist
cd web/default && bun install && bun run build && cd ../..

# 立即删除避免占用
rm -rf web/default/dist web/classic/dist

# 启动后端
go run main.go
```

### 端口冲突

- 后端默认端口：3000
- 前端开发服务器：5173
- 经典前端：5174

**问题**：前端启动时提示 `Port 3000 is occupied`

**原因**：Rsbuild 默认尝试使用 3000 端口，但被后端占用。

**解决**：已在 `rsbuild.config.ts` 中配置 `port: 5173`，直接运行 `bun run dev` 即可。

### 数据库迁移

GORM 会自动执行迁移。首次运行时会自动创建所有表。

### 前端代理配置

前端开发服务器已配置代理，API 请求会自动转发到后端 `http://localhost:3000`。

## 相关文档

- [项目约定 (CLAUDE.md)](../../CLAUDE.md)
- [用户文档](https://docs.newapi.pro/zh/docs)
- [API 文档](https://docs.newapi.pro/zh/docs/api)

## 贡献指南

欢迎贡献！提交 PR 前请确保：

1. 代码通过 lint 检查
2. 遵循项目约定（见 CLAUDE.md）
3. 测试通过
4. 提交信息清晰

---

**技术支持**: [support@quantumnous.com](mailto:support@quantumnous.com)
