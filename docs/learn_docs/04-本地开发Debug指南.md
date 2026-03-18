# 本地开发 Debug 指南

本文档介绍 new-api 本地开发环境搭建、调试技巧和常用命令。

---

## 目录

1. [环境准备](#环境准备)
2. [Docker 开发环境](#docker-开发环境)
3. [本地开发模式](#本地开发模式)
4. [调试技巧](#调试技巧)
5. [常见问题排查](#常见问题排查)

---

## 环境准备

### 1.1 系统要求

| 组件 | 要求 |
|-------|------|
| **操作系统** | macOS, Linux, Windows (WSL2) |
| **Go** | 1.25.1 或更高版本 |
| **Node.js** | 18.x 或更高版本 |
| **Bun** | 1.x（推荐，或使用 npm/pnpm） |
| **Docker** | 20.10+（用于 Docker Compose 环境） |
| **Docker Compose** | 2.x |

### 1.2 安装必要工具

```bash
# 检查 Go 版本
go version

# 检查 Node.js 版本
node --version

# 安装 Bun（推荐）
curl -fsSL https://bun.sh/install | bash

# 或使用 npm
npm install -g npm

# 或使用 pnpm
npm install -g pnpm

# 检查 Docker 版本
docker --version
docker-compose --version
```

---

## Docker 开发环境

### 2.1 启动外部服务

使用 `docker-compose-dev.yml` 启动数据库和 Redis：

```bash
cd /Users/zhai/my_project/go_lang_workspaces/new-api
docker-compose -f docker-compose-dev.yml up -d
```

### 2.2 服务说明

| 服务 | 说明 | 端口 | 用途 |
|-------|------|-------|-------|
| **postgres** | 5432 | PostgreSQL 数据库 |
| **redis** | 6379 | Redis 缓存 |
| **redis-commander** | 8081 | Redis 可视化管理（可选）|
| **pgadmin4** | 5050 | PostgreSQL 可视化管理（可选）|

### 2.3 连接信息

#### PostgreSQL
```
Host: localhost
Port: 5432
User: newapi
Password: newapi_password
Database: newapi_dev
Connection String: postgres://newapi:newapi_password@localhost:5432/newapi_dev?sslmode=disable
```

#### Redis
```
Host: localhost
Port: 6379
Connection String: redis://localhost:6379
```

### 2.4 常用 Docker 命令

```bash
# 启动所有服务
docker-compose -f docker-compose-dev.yml up -d

# 停止所有服务
docker-compose -f docker-compose-dev.yml down

# 重启某个服务
docker-compose -f docker-compose-dev.yml restart redis

# 查看日志
docker-compose -f docker-compose-dev.yml logs -f postgres

# 查看服务状态
docker-compose -f docker-compose-dev.yml ps

# 进入容器（调试用）
docker-compose -f docker-compose-dev.yml exec postgres psql -U newapi -d newapi_dev

# 清理所有数据（危险操作！）
docker-compose -f docker-compose-dev.yml down -v
```

---

## 本地开发模式

### 3.1 模式对比

| 模式 | 说明 | 前端 | 后端 | 适用场景 |
|-------|------|-------|-------|-------|
| **开发模式** | 前后端分离运行 | 独立运行 | 日常开发调试 |
| **集成模式** | 前端打包后一起 | Go 编译 | 本地测试完整功能 |

### 3.2 开发模式启动（推荐）

**启动顺序：**

1. **启动外部服务**
```bash
cd /Users/zhai/my_project/go_lang_workspaces/new-api
docker-compose -f docker-compose-dev.yml up -d
```

2. **启动后端**（新终端）
```bash
cd /Users/zhai/my_project/go_lang_workspaces/new-api
# 创建环境变量文件
cat > .env << 'EOF'
SQL_DSN=postgres://newapi:newapi_password@localhost:5432/newapi_dev?sslmode=disable
REDIS_CONN_STRING=redis://localhost:6379
SESSION_SECRET=dev-secret-key-change-in-production
GIN_MODE=debug
EOF

# 启动后端
go run main.go
```

3. **启动前端**（新终端）
```bash
cd /Users/zhai/my_project/go_lang_workspaces/new-api/web

# 使用 Bun（推荐）
bun install
bun run dev

# 或使用 npm/pnpm
pnpm install
pnpm run dev
```

### 3.3 访问地址

| 服务 | 地址 | 说明 |
|-------|------|------|
| **后端 API** | http://localhost:3000 | API 服务 |
| **前端 Dev** | http://localhost:5173 | Vite 开发服务器 |
| **Redis Commander** | http://localhost:8081 | Redis 管理（可选）|
| **pgAdmin** | http://localhost:5050 | PostgreSQL 管理（可选）|

### 3.4 集成模式启动

如果要测试完整的打包前端：

```bash
# 1. 构建前端
cd /Users/zhai/my_project/go_lang_workspaces/new-api/web
bun run build

# 2. 创建临时 dist 目录（如果有构建问题）
mkdir -p ../web/dist
cp index.html ../web/dist/

# 3. 启动后端
cd ..
go run main.go

# 访问 http://localhost:3000
```

---

## 调试技巧

### 4.1 启用调试日志

#### 方式一：环境变量

```bash
# 启用调试模式
GIN_MODE=debug go run main.go

# 启用错误日志
ERROR_LOG_ENABLED=true go run main.go
```

#### 方式二：代码中设置

在 `common/env.go` 中：
```go
var DebugEnabled = os.Getenv("GIN_MODE") == "debug"
```

### 4.2 使用 Delve 调试器

#### 安装 Delve
```bash
go install github.com/go-delve/delve/cmd/dlv@latest
```

#### 启动调试模式
```bash
# 调试模式启动（默认端口 :2345）
dlv debug main.go --headless --listen=:2345 --api-version=2

# 或使用断点
dlv debug main.go
# 在代码中设置断点后，在 Delve 提示符中使用：
(Delve) break main.go:line_number
(Delve) continue
```

#### VS Code 配置

创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Package",
      "type": "go",
      "request": "launch",
      "mode": "auto",
      "program": "${workspaceFolder}/main.go",
      "env": {
        "GIN_MODE": "debug"
      },
      "args": [],
      "showLog": true
    }
  ]
}
```

### 4.3 使用 pprof 性能分析

#### 启用 pprof

```bash
# 设置环境变量
ENABLE_PPROF=true go run main.go

# pprof 将在 http://localhost:8005 启动
```

#### 分析 CPU 性能
```bash
# 1. 生成 CPU profile
go tool pprof -http=:9999 cpu.out

# 2. 运行负载测试
ab -n 1000 -c 10 http://localhost:3000/v1/models

# 3. 在浏览器访问 http://localhost:9999 查看
```

#### 分析内存
```bash
# 1. 生成 heap profile
go tool pprof -http=:9999 heap.out

# 2. 在浏览器访问 http://localhost:9999 查看
```

### 4.4 数据库调试

#### 连接 PostgreSQL
```bash
# 使用 docker exec 连接
docker-compose -f docker-compose-dev.yml exec postgres psql -U newapi -d newapi_dev

# 常用查询
\dt                    # 列出所有表
\d+ channel            # 查看 channel 表结构
SELECT * FROM users;   # 查询用户
```

#### 连接 Redis
```bash
# 使用 redis-cli（需要安装）
redis-cli -h localhost -p 6379

# 常用命令
KEYS *                # 列出所有键
GET channel:1          # 获取通道缓存
FLUSHALL              # 清空所有数据（危险！）
```

### 4.5 日志调试

#### 查看 Gin 请求日志

在 `middleware/logger.go` 中启用详细日志：
```go
// 输出请求详情
c.Set("middleware.logger", middleware.LogDetail)
```

#### 查看系统日志

```bash
# 后端日志输出到控制台，直接查看

# 或查看文件日志（如果配置）
tail -f data/logs/new-api.log
```

### 4.6 数据库日志

启用数据库查询日志：

```go
import "gorm.io/gorm/logger"

// 在 InitDB 时配置
DB.Use(logger.Default.LogMode(logger.Info))
```

---

## 常见问题排查

### 5.1 数据库连接失败

**错误信息：**
```
failed to initialize database: dial tcp: connection refused
```

**排查步骤：**
```bash
# 1. 检查 Docker 服务状态
docker-compose -f docker-compose-dev.yml ps

# 2. 检查端口占用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# 3. 查看容器日志
docker-compose -f docker-compose-dev.yml logs postgres
docker-compose -f docker-compose-dev.yml logs redis

# 4. 重启服务
docker-compose -f docker-compose-dev.yml restart postgres redis
```

### 5.2 端口被占用

**错误信息：**
```
bind: address already in use
```

**排查步骤：**
```bash
# 查找占用端口的进程
lsof -i :3000  # 后端端口
lsof -i :5173  # 前端端口

# macOS 使用 lsof，Linux 使用 ss 或 netstat

# 杀死进程
kill -9 <PID>
```

### 5.3 前端构建失败

**错误信息：**
```
Missing "./dist/css/semi.css" specifier
```

**解决方案：**
```bash
# 方案 1：清理重装
cd web
rm -rf node_modules package-lock.json pnpm-lock.yaml
pnpm install

# 方案 2：使用开发模式，跳过构建
# 前后端独立运行，不需要构建前端

# 方案 3：降级 semi-ui 版本
pnpm add @douyinfe/semi-ui@2.68.0
```

### 5.4 Go 依赖下载慢

**问题描述：**
国内访问 `proxy.golang.org` 慢或失败。

**解决方案：**
```bash
# 设置 Go 代理
go env -w GOPROXY=https://goproxy.cn,direct

# 使用 Go 官方代理
export GOPROXY=https://proxy.golang.org,direct

# 取消代理
go env -w GOPROXY=direct
```

### 5.5 请求超时

**问题描述：**
API 请求返回超时错误。

**排查步骤：**
```bash
# 1. 检查网络连接
curl -v http://localhost:3000/api/status

# 2. 检查上游连接
curl -v https://api.openai.com

# 3. 检查数据库连接
docker-compose -f docker-compose-dev.yml exec postgres ping -c 1

# 4. 增加 STREAMING_TIMEOUT
# 在 .env 中设置
STREAMING_TIMEOUT=600
```

### 5.6 Redis 缓存问题

**检查 Redis 连接：**
```bash
# 检查后端日志
[SYS] REDIS_CONN_STRING not set, Redis is not enabled

# 正确配置环境变量
REDIS_CONN_STRING=redis://localhost:6379
```

**清空 Redis 缓存：**
```bash
# 使用 redis-cli
redis-cli -h localhost -p 6379 FLUSHALL

# 或进入容器
docker-compose -f docker-compose-dev.yml exec redis redis-cli FLUSHALL
```

---

## 开发工作流

### 6.1 典型开发流程

```mermaid
graph LR
    A[开始] --> B[启动 Docker 服务]
    B --> C[启动后端]
    C --> D[启动前端]
    D --> E[开发功能]
    E --> F[本地测试]
    F --> G[写单元测试]
    G --> H[提交代码]
    H --> I[停止服务]
```

### 6.2 快速重启脚本

创建 `dev.sh` 脚本：

```bash
#!/bin/bash

# 停止现有进程
pkill -f "go run main.go"
pkill -f "vite"
pkill -f "bun"

# 启动 Docker 服务
docker-compose -f docker-compose-dev.yml up -d

# 启动后端（后台）
go run main.go &
BACKEND_PID=$!

# 启动前端（后台）
cd web && bun run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop all"

# 等待 Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

wait
```

使用方法：
```bash
chmod +x dev.sh
./dev.sh
```

---

## IDE 配置

### 7.1 VS Code 推荐扩展

| 扩展名 | 用途 |
|---------|------|
| **Go** | Go 语言支持 |
| **Chinese (Simplified) Language Pack** | 中文语言包 |
| **ESLint** | JavaScript 代码检查 |
| **Prettier** | 代码格式化 |
| **GitLens** | Git 增强 |
| **Thunder Client** | REST API 测试 |

### 7.2 GoLand 配置

1. **导入项目**：File → Open → 选择项目目录
2. **配置 GOPATH**：Settings → Go → GOPATH 设置
3. **启用 Go Modules**：Settings → Go → Go Modules → 启用
4. **配置运行配置**：Settings → Go → Build Tags & Vendoring

---

## API 测试

### 8.1 使用 curl 测试

```bash
# 1. 获取系统状态
curl http://localhost:3000/api/status | jq .

# 2. 测试模型列表（需要 Token）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/v1/models | jq .

# 3. 测试聊天接口
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }' \
  http://localhost:3000/v1/chat/completions | jq .

# 4. 测试流式响应
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }' \
  -N http://localhost:3000/v1/chat/completions
```

### 8.2 使用 Postman/Thunder Client

1. **导入环境变量**：创建 `.env` 文件，导入 `http://localhost:3000`
2. **设置认证**：Bearer Token → 在初始化后获取
3. **保存请求集合**：保存常用的 API 请求
4. **测试不同场景**：正常、错误、限流等

---

## 性能优化

### 9.1 减少重新编译

```go
// 使用 -race 检测竞态条件
go run -race main.go

// 使用 -p 标记编译
go run -gcflags "-m=2" main.go
```

### 9.2 使用 Go build cache

```bash
# 第一次编译会缓存依赖
go build -o /dev/null ./...

# 后续编译会更快
go build -o new-api main.go
```

### 9.3 并发测试

```bash
# 使用 wrk 进行并发测试
wrk -t4s -c10 http://localhost:3000/v1/models

# 使用 ab (Apache Benchark)
ab -n 1000 -c 10 http://localhost:3000/api/status
```

---

## 相关资源

- [项目概述](./01-项目概述.md)
- [架构详解](./02-架构详解.md)
- [二次开发指南](./03-二次开发指南.md)
- [CLAUDE.md](../../CLAUDE.md) - 项目开发约定
- [官方文档](https://docs.newapi.pro)
