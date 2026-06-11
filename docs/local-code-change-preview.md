# 本地修改代码后查看效果

本文记录 Windows 本地 Docker 环境下，修改代码后重新启动项目并查看效果的常用流程。

## 适用场景

- 已经按 `docs/windows-docker-development.md` 启动过本地环境。
- 修改了 Go 后端、默认前端 `web/default/` 或经典前端 `web/classic/` 代码。
- 想用当前工作区代码重新构建镜像，并在浏览器访问本地效果。

## 推荐流程

在项目根目录打开 PowerShell：

```powershell
cd D:\work\new-api
```

查看当前改动，确认不会误覆盖他人或自己未完成的文件：

```powershell
git status --short
```

重新构建并启动项目：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 restart
```

启动成功后访问：

```text
http://localhost:3000
```

`restart` 会执行以下操作：

1. 停止当前本地 Docker 容器。
2. 使用当前工作区代码重新构建应用镜像。
3. 启动 PostgreSQL、Redis 和应用容器。
4. 等待 `http://localhost:3000/api/status` 健康检查通过。

普通 `restart` 会保留 Docker named volumes 中的 PostgreSQL、Redis 和应用数据。

## 常用检查命令

查看容器状态：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 status
```

查看实时日志：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 logs
```

手动检查应用健康状态：

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/status' -TimeoutSec 10
```

停止项目，但保留数据卷：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 stop
```

忽略 Docker 构建缓存，完整重建应用镜像：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 rebuild
```

## 什么时候用哪个命令

| 场景 | 命令 |
|---|---|
| 第一次启动或只是恢复已有容器 | `start` |
| 修改代码后看新效果 | `restart` |
| 怀疑 Docker 构建缓存导致旧代码仍被使用 | `rebuild` |
| 只想看当前是否在运行 | `status` |
| 启动失败或页面异常，需要看后端日志 | `logs` |
| 暂时不用本地环境 | `stop` |

## Docker Desktop 未就绪时

如果启动时看到类似下面的错误：

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

说明 Docker Engine 还没有启动完成。处理方式：

1. 打开 Docker Desktop，等待界面显示 Engine 已运行。
2. 或在 PowerShell 中启动 Docker Desktop：

```powershell
Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
```

然后再次执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 restart
```

首次安装 Docker Desktop 后，如果一直停在 Starting，通常需要重启 Windows 一次。

## 前端修改的额外验证

如果修改了默认前端 `web/default/`，建议在 `web/default/` 下运行：

```powershell
bun run typecheck
bun run lint
bun run build:check
```

如果改了用户可见文案或翻译文件，还应运行：

```powershell
bun run i18n:sync
```

本地 Docker 构建会打包前端产物，但这些命令能更早发现类型、lint、构建配置和 i18n 问题。

## 后端修改的额外验证

如果修改了 Go 代码，建议先格式化改动文件：

```powershell
gofmt -w <changed.go files>
```

再运行受影响包测试：

```powershell
go test ./path/to/affected/package
```

如果改动涉及 model、relay、middleware、billing、database、auth 等共享逻辑，建议扩大到：

```powershell
go test ./...
```

## 本次启动记录

- 本地访问地址：`http://localhost:3000`
- 健康检查地址：`http://localhost:3000/api/status`
- 本地 Compose 文件：`docker-compose.local.yml`
- Windows 启动脚本：`scripts/windows/project.ps1`
- 数据保留方式：普通 `restart` 和 `stop` 不删除 Docker named volumes
