# Windows Docker 本地启动

此方式使用 Docker Desktop 在容器内构建当前工作区的 Go 后端和 React 前端，不要求 Windows 单独安装 Go 或 Bun。

Docker Desktop 首次安装完成后，如果界面长期停在 `Starting`，请先重启 Windows 一次。安装程序新增或更新 WSL 组件后，Docker Engine 可能必须经过系统重启才能完成初始化。

## 首次启动

在项目根目录打开 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 start
```

首次执行会在缺少本地应用镜像时自动下载 Bun、Go、PostgreSQL、Redis 等基础镜像并编译项目，耗时会明显长于后续启动。完成后访问：

```text
http://localhost:3000
```

## 常用命令

```powershell
# 查看容器状态
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 status

# 查看实时日志，按 Ctrl+C 退出日志查看，不会停止项目
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 logs

# 停止项目，保留数据库数据
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 stop

# 重新构建并启动，适用于修改源码后
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 restart

# 忽略构建缓存，完整重建应用镜像
powershell -ExecutionPolicy Bypass -File .\scripts\windows\project.ps1 rebuild
```

## 数据和自动建表

- PostgreSQL、Redis 和应用数据保存在 Docker named volumes 中，普通 `stop`、`restart` 不会删除。
- 应用启动时会执行 GORM `AutoMigrate`。已经登记到迁移列表中的新 Model 会自动创建对应表或补充字段。
- `CCSwitchImportLog` 和 `UserCCSwitchPreference` 已登记，目标表名分别是 `ccswitch_import_logs` 和 `user_ccswitch_preferences`。
- `AutoMigrate` 不等于完整的数据库版本迁移工具。涉及删除字段、重命名字段、数据回填或复杂索引变更时，仍应编写显式迁移逻辑。
