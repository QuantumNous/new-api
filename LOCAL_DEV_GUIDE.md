# Windows 本地开发启动指南

## 1. 环境准备

### 必需环境

| 工具 | 版本要求 | 用途 | 下载地址 |
|------|---------|------|---------|
| **Go** | >= 1.25.1 | 后端编译运行 | https://go.dev/dl/ |
| **Bun** | latest | 前端包管理 & 构建 | https://bun.sh/ |
| **Git** | any | 版本管理 | https://git-scm.com/ |

### 可选环境

| 工具 | 用途 | 说明 |
|------|------|------|
| **Redis** | 缓存 & 频率限制 | 不配置则使用内存缓存，单机开发可不装 |
| **MySQL / PostgreSQL** | 生产级数据库 | 不配置则默认使用 SQLite（零配置） |
| **Node.js** | 备选前端运行时 | 优先用 Bun，Node 也可以 |

### 验证安装

```bash
go version        # 应显示 go1.25.1 或更高
bun --version     # 应显示版本号
git --version
```

---

## 2. 项目结构概览

```
new-api/
├── main.go              # 后端入口
├── web/                 # React 前端（Vite + Semi Design）
├── .env.example         # 环境变量模板
├── go.mod               # Go 依赖
└── web/package.json     # 前端依赖
```

---

## 3. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

### 最小化配置（SQLite，无 Redis）

`.env` 文件只需要确保以下内容：

```env
# 端口号（默认 3000）
# PORT=3000

# 调试模式（开发建议开启）
DEBUG=true
GIN_MODE=debug

# 启用内存缓存（推荐）
MEMORY_CACHE_ENABLED=true
```

> 不配置 `SQL_DSN` 时，默认使用 SQLite，数据库文件生成在运行目录下 `one-api.db`。
> 不配置 `REDIS_CONN_STRING` 时，Redis 自动禁用，使用内存缓存。

### 使用 MySQL

```env
SQL_DSN=root:password@tcp(127.0.0.1:3306)/new_api?parseTime=true&charset=utf8mb4
```

### 使用 PostgreSQL

```env
SQL_DSN=postgres://user:password@127.0.0.1:5432/new_api?sslmode=disable
```

### 使用 Redis（可选）

```env
REDIS_CONN_STRING=redis://localhost:6379/0
```

---

## 4. 启动前端（开发模式）

```bash
cd web
bun install          # 安装依赖
bun run dev          # 启动 Vite 开发服务器
```

前端开发服务器默认监听 `http://localhost:5173`，并自动将 `/api`、`/mj`、`/pg` 请求代理到后端 `http://localhost:3000`。

---

## 5. 启动后端

### 方式 A：直接运行（推荐开发用）

```bash
# 在项目根目录
go run main.go
```

### 方式 B：编译后运行

```bash
go build -o new-api.exe .
./new-api.exe
```

### 方式 C：指定端口

```bash
go run main.go --port 3000
```

后端默认监听 `http://localhost:3000`。

---

## 6. 访问系统

| 地址 | 说明 |
|------|------|
| `http://localhost:5173` | 前端开发页面（有热更新） |
| `http://localhost:3000` | 后端 API（前端 build 后也从这里访问完整系统） |

### 默认管理员账号

首次启动系统会自动创建管理员账号：

- 用户名：`root`
- 密码：`123456`

> 首次登录后请立即修改密码。

---

## 7. 构建生产版本

```bash
# 1. 构建前端
cd web
bun run build        # 生成 web/dist/

# 2. 构建后端（会嵌入前端静态文件）
cd ..
go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=v1.0.0'" -o new-api.exe .

# 3. 运行
./new-api.exe
```

生产版本只需运行单个可执行文件，前端静态文件已通过 `go:embed` 嵌入。

---

## 8. 常见问题

### Q: `go run` 报错 `web/dist` 找不到

后端代码通过 `//go:embed web/dist` 嵌入前端文件。开发时如果 `web/dist` 目录不存在，需要先构建前端：

```bash
cd web && bun run build && cd ..
```

或者创建一个空的占位目录和文件：

```bash
mkdir -p web/dist
echo "" > web/dist/index.html
```

### Q: Redis 连接失败

不设置 `REDIS_CONN_STRING` 环境变量即可跳过 Redis。系统会自动回退到内存缓存。

### Q: 前端修改后没有热更新

确认使用 `bun run dev` 启动的前端开发服务器（5173 端口），而不是直接访问后端 3000 端口。

### Q: 数据库文件在哪里

SQLite 默认在运行目录下生成 `one-api.db` 文件。可通过 `SQLITE_PATH` 环境变量自定义路径。

### Q: Windows 下 CGO 相关报错

SQLite 驱动使用的是纯 Go 实现（`glebarez/sqlite`），不需要 CGO，无需安装 GCC。

---

## 9. 环境变量速查表

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 后端监听端口 |
| `DEBUG` | `false` | 调试模式 |
| `GIN_MODE` | `release` | Gin 框架模式（开发用 `debug`） |
| `SQL_DSN` | 空（用 SQLite） | MySQL/PostgreSQL 连接字符串 |
| `SQLITE_PATH` | `one-api.db` | SQLite 数据库路径 |
| `LOG_SQL_DSN` | 空（同主库） | 日志数据库连接字符串（可分库） |
| `REDIS_CONN_STRING` | 空（不用 Redis） | Redis 连接字符串 |
| `MEMORY_CACHE_ENABLED` | `false` | 启用内存缓存 |
| `SYNC_FREQUENCY` | `60` | 缓存同步频率（秒） |
| `SESSION_SECRET` | 随机生成 | 会话密钥（生产环境必须设置） |
| `RELAY_TIMEOUT` | `0` | 请求超时（秒，0=不限） |
| `STREAMING_TIMEOUT` | `300` | 流式响应超时（秒） |
| `BATCH_UPDATE_ENABLED` | `false` | 批量更新 |
| `NODE_TYPE` | `master` | 节点类型（master/slave） |

---

## 10. 推荐开发流程

```
终端 1（后端）:  go run main.go
终端 2（前端）:  cd web && bun run dev
浏览器:         http://localhost:5173
```

前后端分离开发，前端 Vite 自动代理 API 请求到后端，修改前端代码即时热更新，修改后端代码需重启 `go run`。
