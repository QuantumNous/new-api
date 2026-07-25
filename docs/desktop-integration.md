# BoxAI 桌面端：OpenWorker Fork 集成方案

- 状态：实施中（方案已评审通过）
- 上游：https://github.com/andrewyng/openworker （MIT，Copyright 2024 Andrew Ng）
- 产品命名：**BoxAI 桌面端**，全线使用 BoxAI 品牌
- 仓库策略：独立 fork 仓库 `dev-fan-sophon/boxai-desktop`，保留 `upstream` remote 定期 rebase
- 连接器 broker：自建 Cloudflare Worker（小 QQ 账号 `123592844@qq.com's Account`）

---

## 0. 核心架构

OpenWorker 的云端由两套独立子系统组成：

| 子系统 | OpenWorker 现状 | BoxAI 方案 |
|--|--|--|
| 模型供给 | 用户自带各厂商 key，`openai` provider 支持自定义 `base_url` | 裁剪为唯一 provider，指向 `https://you-box.com/v1` |
| 账号身份 | Auth0 PKCE（`opencoworker.us.auth0.com`） | **BoxAI 成为 IdP**：设备码流 + 签发 RS256 JWT |
| 连接器 OAuth broker | `api.openworker.com`（闭源，仅客户端契约可逆向） | 自建 Cloudflare Worker，用 BoxAI 的 JWKS 验签 |
| Slack/GitHub 入站 relay | AWS API Gateway WebSocket | Cloudflare Durable Objects WebSocket |

关键点：BoxAI 签发 JWT 后，一套认证同时解决三件事 —— 桌面端登录、broker 鉴权、自动下发 relay API key。

```
┌──────────────────────────────────────────────────┐
│  BoxAI Desktop (Tauri + React + Python sidecar)   │
└────┬──────────────┬───────────────┬───────────────┘
     │ 设备码登录     │ Bearer JWT     │ Bearer sk-xxx
     ▼              ▼               ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────────┐
│ BoxAI Go    │ │ CF Worker    │ │ BoxAI /v1/*      │
│ /api/device │ │ broker       │ │ 网关(计费/限流)   │
│ /api/token  │ │ +DO relay    │ │                  │
│ JWKS        │◄┘ 验签          │ └──────────────────┘
└─────────────┘   D1 存连接元数据
```

### OpenWorker 架构速览

- `coworker/`：Python FastAPI 本地 agent server（引擎、provider、连接器、MCP、自动化），PyInstaller onedir 打包为 sidecar
- `surfaces/gui/`：React GUI + Tauri (Rust) 外壳；外壳负责起 sidecar，并注入 `__COWORKER_HTTP__` / `__COWORKER_WS__`
- GUI 与本地 server 之间无 token，仅靠 loopback 绑定 + Origin 白名单
- aisuite 仅用于文件/git toolkits，不在 LLM 调用关键路径（git commit pin，非 PyPI 版本）
- GUI 无 i18n 框架，全英文硬编码

---

## 1. BoxAI 后端新增（Go）

### 1.1 JWT 签发 + JWKS — `service/jwt_issuer.go`

- RS256 密钥对首次启动自动生成，PEM 存 option 表（复用 `model/option.go`）
- Claims：`iss=https://you-box.com`，`aud=https://api.you-box.com`，`sub=<user_id>`，`email`，`exp=1h`
- `GET /.well-known/jwks.json` 公开暴露公钥，CF Worker 无需回源即可验签

### 1.2 设备授权流 — `controller/device_auth.go`

| 端点 | 鉴权 | 行为 |
|--|--|--|
| `POST /api/device/code` | 公开 | 生成 `device_code` + `user_code`，Redis 存 10 分钟，返回 `{device_code,user_code,verification_uri,interval,expires_in}` |
| `POST /api/device/token` | 公开 | 轮询。返回 `authorization_pending` / `slow_down` / `expired_token` / `access_denied`，成功返回 `{access_token,refresh_token,expires_in,user_id,api_key,base_url}` |
| `GET /api/device/info?user_code=` | UserAuth | 授权页读取待确认请求信息 |
| `POST /api/device/approve` | UserAuth | 用户确认。**同时通过 `model.Token` 层直接创建名为 `BoxAI Desktop` 的 relay token 并取回明文 key** |
| `POST /api/device/refresh` | 公开 | refresh_token 换新 JWT |

Redis key 前缀 `device_auth:`，无 Redis 时降级到内存缓存。复用 `common.GenerateKey()`、`middleware.UserAuth`。

背景（现状盘点）：
- BoxAI 只是 OAuth 客户端（github/discord/oidc/linuxdo），不是 IdP，此前无 device code / magic link
- 管理 API 需 session cookie 或用户 access_token + 强制 `New-Api-User` 头（`middleware/auth.go` authHelper）
- `POST /api/token`（`controller/token.go` AddToken）不返回 key，需再调 `POST /api/token/:id/key`；设备流内部直接走 `model.Token` 层避免多次往返
- `/v1/models`（`controller/model.go` ListModels）已按 token model_limits + 用户分组过滤，天然适配

### 1.3 授权确认页 — `web/default/src/routes/device.tsx`

未登录先跳登录并回带 `user_code`；展示"BoxAI 桌面端请求访问你的账号"+ 权限说明 + 确认/拒绝。文案走现有 i18n（6 语言）。

### 1.4 `/api/status` 增加 `desktop_download_url`、`desktop_min_version`

---

## 2. Cloudflare Worker Broker

部署位置：`api-desktop.you-box.com`（Worker）+ `relay.you-box.com`（Durable Object）+ D1。
契约来自客户端代码逆向（`coworker/cloud.py`、`server/app.py`、`connectors/`、`tests/`）；broker 服务端不开源，HTML 回调页行为为推断，需实证。

### 2.1 核心（一期必须）

| 端点 | 说明 |
|--|--|
| JWT 中间件 | 拉 BoxAI `/.well-known/jwks.json` 缓存验签，校验 `aud` / `exp` |
| `GET /v1/me` | 从 claims 直出 `{user:{email,user_id}}` |
| `POST /v1/oauth/{provider}/start` | 入参 `{connector, redirect, app_state, access?, flow?}` → `{authorize_url}`。provider 映射：gmail/google_calendar/google_drive→google，slack，notion，attio，hubspot，github，outlook→microsoft |
| OAuth 回调页 | 换 token 后返回 HTML **自动 form-POST 到 `redirect`**（即 `http://127.0.0.1:<port>/oauth/callback`） |
| `POST /v1/oauth/{provider}/refresh` | `{refresh_token, connection_id, connector}` → `{access_token, expires_in, refresh_token?}` |
| `POST /v1/github/token` | `{installation_id}` → `{token, expires_at}`（GitHub App JWT 换 installation token，客户端内存缓存约 1h） |
| `GET /v1/connections` | `{connections:[{connection_id, connector, status, tenant_metadata}]}`，客户端仅处理 `connector=github` 且 `status=connected` |
| disconnect 系列 | `/v1/connections/{id}/disconnect`、`/v1/relay/github/disconnect` `{installation_id}`、`/v1/relay/slack/uninstall` `{team_id}`（best-effort） |

form-POST 字段（客户端 `managed_profile_from_callback` 消费）：

- 通用：`access_token, refresh_token, scope, connection_id, provider, account, account_id, expires_in, connector, app_state`
- HubSpot 额外：`hub_id, sandbox`
- Slack 额外：`team_id, bot_user_id, slack_user_id, team_domain`（并置 `slack:default` 为 `mode=relay`）
- GitHub 分支：不带 `access_token`，改用 `installation_id, account_login, account_type, github_login, repo_selection`

GitHub App 必须开启 **Request user authorization (OAuth) during installation**：`state` 只能证明这个浏览器发起过流程，不能证明用户真的在 GitHub 完成了授权，而 App JWT 可以读取该 App 的任意 installation。回调因此强制要求 `code`，把 query 里的 `installation_id` 与 `GET /user/installations` 求交集后才写路由表；否则任何注册用户都能把别人组织的 installation 绑到自己名下并换取 installation token。

### 2.2 不实现

- `POST /v1/telemetry/events` —— 隐私与品牌纯度考虑，直接砍掉
- `/v1/personas/gallery*` —— 一期砍掉，二期做成 BoxAI 自己的模板市场
- `GET /v1/auth/callback` —— 改用设备码后不需要 Auth0 bounce

### 2.3 一期连接器范围

Google（Gmail / Calendar / Drive）、Slack、Notion、GitHub，覆盖约 80% 场景。其余连接器保留手工填 token 路径。
实施顺序：先跑通 Google 单点端到端验证契约，再铺开其余三个。

---

## 3. Relay WebSocket（Durable Object）

`wss://relay.you-box.com/connect`，握手头 `Authorization: Bearer <JWT>`。客户端只收不发，断线约 2s 重连。

链路：Slack Events API / GitHub App Webhook → Worker 验签 → D1 路由表（user ↔ team_id / installation_id）→ 对应 DO → push。
出站回复（发 Slack 消息、GitHub 评论）由桌面端直连厂商 API，不经 broker。

帧格式（必须严格对齐客户端解析器）：

```json
// Slack 事件
{"provider":"slack","team_id":"T1","address":"slack:T1:C1","channel":"C1","event_id":"Ev-","event":{}}
// 控制帧
{"kind":"revoked","team_id":"T1"}
{"kind":"missed","team_id":"T1","channel":"C1","count":2}
{"kind":"interactivity","team_id":"T2","interaction":{}}
// GitHub
{"provider":"github","installation_id":"..","owner_repo":"org/repo","number":123,"title":"..","body":"..","kind":"mention","sender":".."}
```

---

## 4. Fork 侧改造

### 4.1 模型层锁定（防绕过计费）

| 文件 | 改动 |
|--|--|
| `coworker/providers/registry.py` | `DESCRIPTORS`（现有 openai/anthropic/gemini + 9 家兼容厂商 + ollama）裁剪为仅 `boxai`；`_build_boxai` 硬编码 `base_url`；`api_key` 由登录写入 SecretStore `provider:boxai`，UI 无输入框 |
| `coworker/providers/matrix.py` | `MATRIX` 改为启动时拉 `GET /v1/models`，本地缓存 + 失败回退静态列表 |
| `coworker/providers/router.py` | 默认 provider 改 `boxai`，剥离 `anthropic:` / `gemini:` 前缀路由 |
| `pyproject.toml` | 移除 `anthropic`、`google-genai` 依赖（减包体积 + 断绕过路径） |

必须裁**后端** `DESCRIPTORS`：仅隐藏 UI 无效，用户可 curl 本地 REST 配原生厂商 key 白嫖。

### 4.2 认证层替换

| 文件 | 改动 |
|--|--|
| `coworker/cloud.py` | `begin_login` 改设备码（弹浏览器到 `you-box.com/device?code=XXXX`）+ 按 interval 轮询；`complete_login` 存 JWT + refresh 到 `cloud:auth`，并把 `api_key` 写入 `provider:boxai`；`_refresh` 打 BoxAI；删除 telemetry / gallery 客户端 |
| `coworker/config.py` | `cloud_base_url=https://api-desktop.you-box.com`；删 `cloud_auth_domain/client_id/audience`；`cloud_relay_ws_url=wss://relay.you-box.com/connect` |
| `coworker/server/app.py` | 删 `GET /auth/callback`、`/v1/cloud/telemetry`、gallery 路由；保留 `POST /oauth/callback` 并**新增 `app_state` 校验**（修上游安全弱点：恶意本地进程可注入连接器 token） |
| GUI `CloudSignIn.tsx` / `Onboarding.tsx` / `ProviderSetup.tsx` / `ManageTabs.tsx` | 登录改为展示 user_code + 轮询态；provider 页改为"已登录，模型由 BoxAI 提供" |

### 4.3 品牌化

约 230 个文件含品牌字符串。生产面优先，测试 / e2e 跟随机械替换。

| 面 | 具体改动 |
|--|--|
| Tauri | `tauri.conf.json`：`productName=BoxAI`、`identifier=com.youbox.desktop`、`publisher=BoxAI`、updater endpoints → `https://download.you-box.com/latest.json`、替换 minisign `pubkey` |
| 图标资产 | `src-tauri/icons/` 全套（32/64/128/128@2x/icns/ico/tray + Windows Square 30~310 + StoreLogo）、`packaging/dmg-background.{png,@2x,tiff}`（构建实际用 tiff，需重新生成）、`Icon.tsx` 内联 SVG 标识 |
| 原生壳 | `lib.rs`：窗口标题、托盘 tooltip / 菜单、日志名；`Info.plist` 5 条 NS*UsageDescription |
| 包标识 | `Cargo.toml`（openworker-desktop、ocw-stt）、`package.json`（openworker-gui）、`pyproject.toml` console scripts（openworker / openworker-server / openworker-connectors → boxai / boxai-agent / boxai-connectors）、`packaging/*.spec` |
| UI 文案 | 约 80–150 处品牌串：`App/Sidebar/Onboarding/SettingsView/UpdateBanner/ScheduledView/GalleryModal/RightRail/Composer/connectors/*`；persona taxonomy "Coworker" / "Ops Coworker" 统一 BoxAI 语汇；Slack bot `@BoxAI` |
| 状态目录 | `~/.config/coworker` → `~/.config/boxai`、`%APPDATA%\coworker` → `\boxai`、`COWORKER_*` → `BOXAI_*`、scratch `~/OpenWorker` → `~/BoxAI`、注入变量 `__BOXAI_HTTP__` / `__BOXAI_WS__`、事件 `boxai:*`、localStorage keys。**Python `secrets.py` 与 Rust `lib.rs` 必须同步**（全新产品，无迁移负担） |
| 清理 | 删 `ui-mocks/`、`docs/assets/`；重写 README；**保留上游 LICENSE 与版权声明**（MIT 合规前提） |
| 内部包名 | Python 包 `coworker/` 保留不改（约 50 模块 + 80 测试文件引用），仅改用户可见入口 |

### 4.4 中文化 i18n

GUI 无 i18n 框架，约 400–700 条硬编码英文（`App.tsx` ~75KB、`Sidebar.tsx` ~60KB、`SettingsView.tsx` ~29KB 等约 45 个组件）。

- 引入 `i18next` + `react-i18next`，locale 文件 `surfaces/gui/src/i18n/locales/{en,zh}.json`，扁平 JSON、英文原文作 key（与 BoxAI web 前端约定一致）
- 一期只做中 / 英双语，其余 4 语言二期
- Python 侧用户可见文案（`connectors/catalog_copy.py`、`descriptors.py`、错误提示）加轻量 locale 映射

---

## 5. 签名与分发

| 项 | 方案 |
|--|--|
| 更新源 | `download.you-box.com/latest.json` → Cloudflare R2 + Worker（小 QQ 账号） |
| 签名密钥 | 新 minisign 密钥对；公钥入 `tauri.conf.json`，私钥入 CI `TAURI_SIGNING_PRIVATE_KEY` |
| macOS | Apple Developer 证书 + notarytool 公证（`packaging/build_dmg.sh` 流程完整，仅换 `APPLE_*` secrets）；bundle id 变更即全新 App |
| Windows | 上游未签名（SmartScreen 警告）；需购 Authenticode / EV 证书，`packaging/build_windows.ps1` 新增签名步骤 |
| 产物名 | `packaging/make_update_manifest.py` + `.github/workflows/release.yml`：`OpenWorker-*` → `BoxAI-macos-arm64.app.tar.gz` / `BoxAI-windows-setup.exe` / `BoxAI-*.dmg` |
| 发布前检查 | 版本号三处对齐（`tauri.conf.json` / release tag / manifest） |

---

## 6. 里程碑

| 阶段 | 内容 | 工期 |
|--|--|--|
| A | 方案落盘 + fork + M0 冒烟验证 | 0.5–1d |
| B | BoxAI 设备码认证后端 + 授权页 | 3–4d |
| C | Fork 侧 provider 锁定 + 认证层替换 | 3–4d |
| D | 品牌化 | 2–3d |
| E | 中文化 i18n（中 / 英） | 2–3d |
| F | CF Worker broker（Google 先行） | 3–5d |
| G | Relay WebSocket（DO） | 2–3d |
| H | 签名与分发流水线 | 2–3d + 证书采购周期 |

总计约 3–4 周工程时间。前置外部依赖：App 图标设计、Apple / Windows 证书、Slack App + GitHub App + Google / Notion OAuth App 注册。

---

## 7. 验收标准

1. 全新机器安装 → 点登录 → 浏览器确认 → 回到 App 已登录，模型列表即该用户在 BoxAI 的可用模型
2. 发起带 shell + 文件写入 + 审批门控的完整任务，产出可打开的交付物；BoxAI 后台可见对应消费日志与配额扣减
3. 用户在 BoxAI 网页后台可见并可吊销 `BoxAI Desktop` token，吊销后桌面端立即失效
4. 一键授权 Gmail 与 Slack，`@BoxAI` 在 Slack 频道提及可触发桌面端会话并回帖
5. 界面无任何 OpenWorker / Coworker 残留字样；中英双语可切换
6. macOS 已签名公证（Gatekeeper 无警告）；自动更新可从 `download.you-box.com` 拉到新版本
7. 无法通过任何路径（UI / 本地 REST / 配置文件）配置非 BoxAI 的模型供给

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|--|--|--|
| 上游高频迭代（beta，活跃合 PR） | rebase 冲突 | 最小补丁集策略，改动集中在 `providers/*`、`cloud.py`、`config.py`、品牌文件；CI 每周自动 rebase 检测 |
| broker 契约为客户端逆向 | 字段可能不准 | 阶段 F 先做 Google 单点实证再铺开 |
| 计费绕过 | 收入漏洞 | 后端 DESCRIPTORS 硬裁 + 移除非 openai SDK + 本地 REST `app_state` 校验 |
| 安装包 150–300MB | 转化率 | 移除 anthropic / google SDK，`COWORKER_EXPERIMENTAL=0` 剥离实验模块，目标约 150MB |
| Agent 具备终端执行与文件读写 | 安全责任 | 保留上游 approval-gated 机制、默认最严权限、补免责声明 |
| Windows 无签名 | SmartScreen 拦截 | 采购 EV 证书 |
| macOS bundle ID 变更 | 无法从 OpenWorker 升级 | 全新产品，无需兼容 |

---

## 9. 待办

- [x] 方案评审
- [ ] A2 fork 仓库建立
- [ ] A3 M0 冒烟验证
- [ ] B 设备码认证后端
- [ ] 设计出图（App 图标全套、DMG 背景、SVG 标识）
- [ ] Apple Developer / Windows Authenticode 证书采购
- [ ] Slack App、GitHub App、Google / Notion OAuth App 注册（broker 用）
