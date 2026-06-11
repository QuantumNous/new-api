# Change: CC Switch 令牌导入与经典前端入口修复

> 2026-06-11 更新：本记录描述 2026-06-10 的历史实现。导入审计表和用户偏好表的活跃代码、AutoMigrate 注册以及默认模型偏好读取已在 [2026-06-11-ccswitch-import-adjustment.md](2026-06-11-ccswitch-import-adjustment.md) 中废弃；当前实现以导入专用模型缓存和固定默认 Codex 为准。

## 背景

令牌管理新增了将当前令牌导入本机 CC Switch 的能力。首次本地验证时，后端接口、数据库表和默认前端代码均已存在，但运行系统配置为 `theme.frontend=classic`，用户实际访问的是经典前端 `/console/token`。经典前端的行操作没有独立“导入”按钮，因此用户只能看到“聊天、禁用、编辑、删除”，误以为功能未生效。

该问题与代码是否提交到远程仓库无关。本地 Docker 使用当前工作区构建镜像，只要重新构建并启动容器即可包含未提交代码。

## 修改目标

- 为令牌所有者提供 CC Switch 导入选项和协议链接生成接口。
- 保证 API Key 只在后端生成最终协议链接，不在前端预先读取并拼接明文密钥。
- 在默认前端和经典前端都提供明确的“导入”入口。
- 记录最近选择的导入目标、模型和导入审计信息。
- 让新增表在应用启动时通过 GORM 自动迁移创建。
- 稳定本地 Docker 会话密钥，避免每次重建容器后旧登录 Cookie 失效。

## 修改文件

| 文件 | 修改内容 |
|---|---|
| `router/api-router.go` | 注册令牌级 CC Switch 导入选项和链接生成路由 |
| `controller/ccswitch_import.go` | 解析令牌 ID 和请求体，调用 Service 并返回响应 |
| `service/ccswitch_import.go` | 校验令牌归属、导入目标和模型，生成 `ccswitch://v1/import` 链接，保存偏好和审计 |
| `dto/ccswitch.go` | 定义导入选项、目标和链接请求/响应 DTO |
| `model/ccswitch_import.go` | 新增导入审计和用户偏好 Model 及读写方法 |
| `model/main.go` | 将两个新 Model 加入普通和快速 `AutoMigrate` 列表 |
| `controller/token_test.go` | 覆盖密钥掩码、令牌归属、协议参数、偏好和审计行为 |
| `web/default/src/features/keys/` | 默认前端新增行操作入口、弹窗、API 和类型定义 |
| `web/default/src/i18n/` | 默认前端新增导入功能的多语言文案 |
| `web/classic/src/components/table/tokens/` | 经典令牌列表新增独立“导入”按钮，并将弹窗改为调用后端导入 API |
| `web/classic/src/hooks/tokens/useTokensData.jsx` | 将经典前端 CC Switch 入口从明文令牌传递改为令牌 ID 传递 |
| `docker-compose.local.yml` | 本地完整源码构建；固定仅用于本机开发的 `SESSION_SECRET` |
| `scripts/windows/project.ps1` | 提供 Windows 下启动、停止、状态、日志、重建和健康等待命令 |
| `docs/windows-docker-development.md` | 记录本地 Docker 使用方法、数据卷、自动迁移和会话说明 |

## API 与数据变化

### API

| 方法 | 路径 | 行为 |
|---|---|---|
| `GET` | `/api/token/:id/ccswitch/import-options` | 返回掩码令牌信息、默认目标、默认模型和可用目标 |
| `POST` | `/api/token/:id/ccswitch/import-link` | 校验请求并返回一次 `ccswitch://v1/import` 协议链接 |

两个接口均位于用户鉴权的 Token 路由组内，并按当前用户 ID 查询令牌，不能导入其他用户的令牌。

### 数据库

| 表 | 用途 |
|---|---|
| `ccswitch_import_logs` | 保存用户、令牌、目标、模型、时间、IP 和 User-Agent 审计信息 |
| `user_ccswitch_preferences` | 保存用户最近使用的目标和模型，用于下次默认选择 |

两个表已加入 `model.DB.AutoMigrate(...)` 和快速迁移列表。SQLite、MySQL 和 PostgreSQL 均通过 GORM 模型迁移，不使用数据库专属建表 SQL。

## 行为变化

- 默认前端 `/keys` 的令牌行显示“Import/导入”操作。
- 经典前端 `/console/token` 的令牌行显示独立“导入”按钮，不再要求用户从“聊天”下拉菜单寻找。
- 经典前端弹窗只持有令牌 ID，打开时从后端读取掩码信息和可用目标。
- 用户确认后由后端读取完整密钥并生成协议链接，同时写入偏好和审计记录。
- 当前仅 `Codex` 目标启用；Claude Code、Hermes、OpenClaw、OpenCode 返回为未启用目标。
- 本地 Docker 重建后数据库数据继续保存在 named volume 中；固定开发会话密钥后，后续重建不会因密钥随机变化再次使 Cookie 失效。

## 保持不变的行为

- 不要求将本地代码提交或推送到远程仓库才能验证。
- 不改变现有令牌创建、编辑、启用、禁用和删除行为。
- 不修改 Relay 请求处理、计费和渠道分发逻辑。
- 不把完整 API Key 返回到导入选项接口或写入导入日志。
- 不删除现有经典前端“聊天”集成能力。

## 验证方式与结果

- `docker compose` 使用当前工作区完整构建默认前端、经典前端和 Go 后端：通过。
- 经典前端 Rsbuild 生产构建：通过，构建时间约 39 秒。
- 应用容器、PostgreSQL 和 Redis：启动成功，应用健康检查通过。
- `GET /api/status`：HTTP 200。
- PostgreSQL 实际查询确认以下表存在：
  - `ccswitch_import_logs`
  - `user_ccswitch_preferences`
- `git diff --check`：通过。
- 浏览器在容器重建后出现旧会话 401，日志显示 `securecookie: the value is not valid`；已通过固定本地 `SESSION_SECRET` 修复后续重建问题。当前旧 Cookie 需要重新登录一次才能完成交互式按钮点击验证。

## 风险与影响

- `ccswitch://` 依赖客户端已经安装 CC Switch 并注册协议；未安装时浏览器无法打开目标应用。
- 协议链接包含用于导入的 API Key，虽然不写入审计日志，但仍应避免复制到日志、聊天或公开页面。
- 当前默认模型为 `gpt-5.5`；如果用户可用模型列表不包含该模型，用户应在弹窗中选择实际可用模型。
- `AutoMigrate` 适合新增表和兼容字段，不替代删除字段、重命名字段或数据回填等显式迁移。
- `docker-compose.local.yml` 中的固定会话密钥只适用于本机开发，不应直接用于生产部署。
- 默认前端与经典前端是两套独立实现，后续调整令牌导入交互时必须同步检查两套入口。

## 后续维护入口

- 路由：`router/api-router.go`
- Controller：`controller/ccswitch_import.go`
- 业务规则与协议参数：`service/ccswitch_import.go`
- 数据模型与迁移：`model/ccswitch_import.go`、`model/main.go`
- 默认前端：`web/default/src/features/keys/`
- 经典前端：`web/classic/src/components/table/tokens/`
- 后端测试：`controller/token_test.go`
- Windows 本地启动：`scripts/windows/project.ps1`

## 待确认

- 需要用户重新登录经典前端后，最终确认“导入”按钮布局和弹窗交互符合预期。
- 需要在安装了 CC Switch 的 Windows 环境确认自定义协议最终能够拉起应用并成功导入 Codex Provider。
