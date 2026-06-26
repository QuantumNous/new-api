# 本地启动检查与说明

本文基于 `2026-05-07` 在当前 Windows 工作站上的实际检查结果整理。

## 1. 项目本地启动需要什么

如果你要用“本地源码 + 本地进程”的方式启动这个项目，至少需要：

- `Go 1.22+`
- `Bun`
- `Node.js`
- `Git`

可选但常见的配套环境：

- `Docker / Docker Compose`
- `Redis`
- `MySQL` 或 `PostgreSQL`

## 2. 这个项目本地怎么启动

### 方案 A：集成启动，直接访问 `http://localhost:3000`

这是本次补充的 `start.bat` / `restart.bat` 走的方案。

流程是：

1. 检查 `go`、`bun`、`node`、`powershell`
2. 若缺少 `.env`，自动生成一份本地默认配置
3. 使用 `bun` 安装前端依赖
4. 构建 `web/default/dist`
5. 构建 `web/classic/dist`
6. 构建后端 `new-api.exe`
7. 后台启动服务并写入 PID / 日志

说明：

- `main.go` 通过 `go:embed` 直接嵌入 [main.go](/D:/LearningDocument/prClone项目/ResNewApi/new-api/main.go:38) 中的 `web/default/dist` 和 `web/classic/dist`
- 因此在本地直接启动 Go 服务前，前端产物必须先存在
- 未配置 `SQL_DSN` 时，项目会自动回落到 SQLite，默认可直接本地跑起来

### 方案 B：前后端分离联调

开发前端页面时，也可以使用仓库自带的开发模式：

1. `docker compose -f docker-compose.dev.yml up -d`
2. `cd web/default`
3. `bun install`
4. `bun run dev`

此时前端开发服务默认走代理到后端 `3000` 端口：

- [web/default/rsbuild.config.ts](/D:/LearningDocument/prClone项目/ResNewApi/new-api/web/default/rsbuild.config.ts:14)
- [web/classic/vite.config.js](/D:/LearningDocument/prClone项目/ResNewApi/new-api/web/classic/vite.config.js:94)

## 3. 本机环境检查结果

### 已具备

- `Go`：`go1.26.2`
- `Bun`：`1.3.13`
- `Node.js`：`v24.13.0`
- `Git`：`2.53.0.windows.3`
- `Docker`：`29.4.1`

### 当前未在 PATH 中发现

- `redis-server`
- `mysql`

说明：

- 这不会阻塞最小可用启动，因为项目默认可以使用 SQLite
- 如果后续你要验证 Redis 缓存、MySQL 兼容性、或使用 `docker-compose.dev.yml` 的开发环境，再补这两项即可

## 4. 当前配置与产物状态

检查时发现：

- 根目录没有 `.env`
- `web/default/dist` 不存在
- `web/classic/dist` 不存在
- `web/default/node_modules` 不存在
- `web/classic/node_modules` 不存在

这说明仓库目前还没有完成“第一次本地构建”。

## 5. 首次启动后的默认行为

`start.bat` 首次运行时会自动生成 `.env`，默认写入：

- `PORT=3000`
- `SQLITE_PATH=data/new-api.db?_busy_timeout=30000`
- `SESSION_SECRET=<随机值>`
- `CRYPTO_SECRET=<随机值>`
- `TZ=Asia/Shanghai`

默认数据库文件会落在 `data/new-api.db`。

## 6. 新增脚本

### `start.bat`

用途：首次启动或常规启动本地服务。

常用方式：

- `start.bat`
- `start.bat rebuild`

说明：

- `start.bat` 默认只在缺少前端 `dist` 时构建前端
- `start.bat rebuild` 会强制重建前端资源
- 后端每次都会重新 `go build`

### `stop.bat`

用途：停止本地启动的 `new-api` 进程。

停止顺序：

1. 优先按 `.runtime/new-api.pid` 停止
2. 再兜底清理占用当前 `PORT` 的监听进程

### `restart.bat`

用途：先停止，再重新启动。

常用方式：

- `restart.bat`
- `restart.bat rebuild`

## 7. 运行日志与进程文件

脚本运行后会使用这些目录：

- 日志目录：`logs/`
- 运行时目录：`.runtime/`

关键文件：

- `.runtime/new-api.exe`
- `.runtime/new-api.pid`
- `logs/new-api.out.log`
- `logs/new-api.err.log`

## 8. 你现在可以怎么用

如果只是尽快跑起来，直接在仓库根目录执行：

```bat
start.bat
```

如果已经在运行，想重新拉起：

```bat
restart.bat
```

如果你刚修改了前端代码，希望连 `dist` 一起重建：

```bat
restart.bat rebuild
```

## 9. PowerShell 里的一个注意点

如果你在 `PowerShell` 里直接输入：

```powershell
start
```

它执行的不是当前目录下的 `start.bat`，而是 PowerShell 自带的 `Start-Process` 别名，所以看起来会像“弹出一个新终端窗口”，但并没有按你预期调用脚本。

正确写法是：

```powershell
.\start.bat
.\stop.bat
.\restart.bat
```

如果你不想记 `.\`，也可以直接使用这些不冲突的别名脚本：

```bat
run-local.bat
stop-local.bat
restart-local.bat
```
