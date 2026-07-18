# new-api 优化审计与执行计划

- **审计日期**：2026-07-18
- **权威源码**：`D:\newapi\src`
- **分支 / HEAD**：`feat/adaptive-channel-balance-rc12` / `6ce0799034e836180031953f83cc7dab4f1d6e08`
- **生产二进制**：`D:\newapi\new-api-fixed.exe`
- **生产 PID**：33016（审计时）
- **生产 SHA-256**：`75450924043c1f19f53357d9399772ccb8b5a2a794bfab33a945d0d493603e37`
- **嵌入 revision**：`6ce0799034e836180031953f83cc7dab4f1d6e08`（与 HEAD 一致）
- **公网入口**：`https://incc.qzz.io`
- **范围边界**：不读 `.env` 值、不读业务表数据/日志正文；不改生产 DB；本审计后的代码修复可部署，但须单独记录。

---

## 1. 测试方法与证据

### 1.1 已执行的自动化 / 本地门禁

| 门禁 | 命令 / 方式 | 结果 |
|------|-------------|------|
| Router 单测 | `go test ./router -count=1` | pass |
| 纯后端构建测试 | `go test -tags frontend_external . -count=1` | pass |
| Vet | `go vet ./router .` | clean |
| 默认前端类型检查 | `bun run typecheck`（`web/default`） | pass |
| 中文 locale 结构 | 解析 `zh.json` nested `translation` 键数 | 5182；`Home=主页`，`Sign in=登录` |
| PR CI | GitHub Actions run `29634700553` | go/web/image **全绿** |

### 1.2 运行时探针（本机 127.0.0.1:3000）

| 路径 | HTTP | Content-Type / 说明 |
|------|------|---------------------|
| `/livez` | 200 | `application/json` `{"plane":"all","status":"ok"}` |
| `/readyz` | 200 | `application/json` `{"status":"ok"}` |
| `/healthz` | 200 | JSON 存活（兼容） |
| `/api/status` | 200 | JSON 管理状态 |
| `/v1/models`（无 Token） | **401** | 预期鉴权失败 |
| `/api/no-such` | **404** | API 未匹配 |
| `/unknown-page-xyz` | 200 HTML | SPA NoRoute 回退（预期对前端路由） |
| **`/metrics`** | **200 HTML SPA** | **异常：未启用 metrics 时不应伪装成页面** |
| **`/frontend-healthz`** | **200 HTML SPA** | 分离 Nginx 才有该端点；一体机误匹配到 SPA |

### 1.3 公网探针

| 路径 | 结果 |
|------|------|
| `https://incc.qzz.io/livez` | 200 |
| `https://incc.qzz.io/readyz` | 200 |
| `https://incc.qzz.io/api/status` | 200 |
| 浏览器自动化访问首页/登录 | 触发 **Cloudflare 人机验证**（自动化环境）；此前已用浏览器验证中文 UI 通过 |

### 1.4 配置键名（仅键名，无值）

生产 `.env` 已包含：

- `PORT`
- `SQLITE_PATH`
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_TRUSTED_URL`
- `TRUSTED_PROXY_CIDRS`

说明：Cookie 相关键名已与源码对齐（不再使用错误的 `SESSION_SECURE`）。

### 1.5 备份与恢复

| 项 | 状态 |
|----|------|
| 计划任务 `NewAPI-SQLiteBackup` | Ready；每日 03:30；上次 2026-07-18 11:02:10；`LastTaskResult=0` |
| 备份脚本 | `D:\newapi\scripts\backup-sqlite.ps1`（`.backup` + integrity + sha256） |
| 最新备份文件 | `backups/db/one-api-20260718-110210.db` + `.sha256` |
| 恢复演练记录 | `backups/restore-tests/restore-20260718-112444.json` 存在 |
| sqlite3 工具 | `D:\newapi\tools\sqlite\sqlite3.exe` 存在 |

### 1.6 前端中文

| 项 | 状态 |
|----|------|
| 默认主题 i18n 嵌套展开 | 已修（`6ce07990`） |
| 默认主题默认中文 / 忽略 navigator | 已修（`cfff28c1`） |
| 浏览器实测首页中文 | 此前通过（主页/控制台/模型广场/登录等） |
| 经典主题 locale 结构 | 文件为 `{translation:{...}}`，**静态 resources 导入方式与 i18next 兼容**（与 default 的 custom backend 不同） |

### 1.7 磁盘与清理

清理后约释放 1.59GB+；生产 exe/data/src 保留。`src` 仍约 2GB（含 node_modules/dist，属构建依赖）。

---

## 2. 架构现状（简图）

```text
浏览器 / Tunnel / Cloudflare
        │
        ▼
 new-api-fixed.exe  (一体化 embed，RUN_MODE/APP_PLANE 默认 all)
        │
        ├─ /livez /readyz /healthz
        ├─ /api/*  /v1/*  /mj /pg /suno /kling /jimeng ...
        └─ SPA NoRoute + 静态资源 (web/default|classic dist)
```

可选未部署路径：

```text
frontend Nginx (:8080) ──反代──► backend (:3000, FRONTEND_MODE=disabled, -tags frontend_external)
```

---

## 3. 问题清单（按优先级）

### P0 — 必须尽快

#### P0-1 SPA NoRoute 吞掉运维/指标路径

- **现象**：`METRICS_ENABLED` 未开时，`GET /metrics` 返回 **200 + index.html**，而不是 404/503。
- **根因**：`router/web-router.go` 的 `NoRoute` 仅排除 `/v1`、`/api`、`/assets` 前缀；`/metrics` 未注册时落入 SPA。
- **影响**：
  - 监控误判「有页面」；
  - 扫描器/编排以为指标端点存在；
  - 与 fail-closed metrics 设计意图不一致（启用但无 token 应为 503，未启用应为明确非 HTML 失败）。
- **证据**：本机探针 Content-Type `text/html`。
- **建议修复**：NoRoute 对明确的后端/运维前缀直接 `404` JSON（或现有 `RelayNotFound`），至少包括：
  - `/metrics`
  - `/livez` `/readyz` `/healthz`（已注册时不会落到 NoRoute；防御性仍可列）
  - `/v1beta`、`/mj`、`/pg`、`/suno`、`/kling`、`/jimeng`、`/dashboard`（billing 兼容路径若未挂到 api 组则需核对）
- **验证**：`curl -i /metrics` → 非 HTML；启用 metrics 无 token → 503；有 token → 200 文本指标。
- **风险**：低；仅改变未注册路径的失败形态。
- **置信度**：高。

#### P0-2 生产 Secure Cookie / HTTPS 闭环仍依赖环境证据

- **现象**：键名已正确配置，但本审计**不读取值**，无法证明：
  - `SESSION_COOKIE_SECURE=true` 是否在公网 HTTPS 下启用；
  - `SESSION_COOKIE_TRUSTED_URL` 是否完整包含 `https://incc.qzz.io` 等入口；
  - Tunnel/Access/WAF catch-all 是否存在。
- **影响**：会话 Cookie 明文风险、OAuth 回调失败或过宽信任。
- **建议**：在**不打印密钥**前提下做只读核对清单（管理员本地执行）：检查 Secure/SameSite 属性、回调 URL 列表、Cloudflare 策略导出。
- **本轮是否自动改生产 `.env`**：**否**（高风险，需单独确认）。
- **置信度**：高（键名）；配置正确性未证。

### P1 — 高收益

#### P1-1 供应链：签名 + 完整 SBOM

- **现状**：exe `Authenticode=NotSigned`；仅有 Go module CycloneDX（非前端完整 SBOM）。
- **建议**：clean build → 签名 → Go SBOM + 前端 lockfile SBOM → 写入 release manifest。
- **阻塞**：证书/策略选择。
- **置信度**：高。

#### P1-2 真实业务 E2E

- **现状**：单测/门禁强；未用沙箱凭据跑 鉴权→Relay→计费→支付→调度。
- **建议**：隔离 staging + 合成账户 + 预算上限。
- **置信度**：高。

#### P1-3 前端体积

- **现状**：默认前端产物仍很大（构建日志 index/async 数 MB 级）；预算门禁已存在。
- **建议**：RUM/瀑布后再拆 VChart/Shiki/Mermaid 等。
- **置信度**：体积高；用户影响中。

#### P1-4 非 root 容器

- **现状**：一体化 Dockerfile 仍默认 root 运行；分离前端已用 unprivileged Nginx。
- **建议**：staging 验证 volume 权限后改 USER。
- **置信度**：高。

#### P1-5 Cloudflare 对自动化/部分地区挑战

- **现象**：browser-act 访问公网触发「正在进行安全验证」。
- **影响**：自动化巡检、部分用户体验。
- **建议**：对 `/livez`/`/readyz` 放行；管理后台保持挑战；记录 Ray ID 策略。
- **置信度**：中（需 CF 控制台）。

### P2 — 中期

| ID | 项 | 说明 |
|----|----|------|
| P2-1 | SQLite 容量/连接池 | 无基准前不改默认 100/1000 |
| P2-2 | 经典前端类型/a11y | 渐进 `checkJs` + axe |
| P2-3 | 分离部署上线 | 镜像与 compose 已就绪，生产仍一体化 |
| P2-4 | `src` 体积 | node_modules/dist 占磁盘；可选清理后 CI/本地重装 |
| P2-5 | `/frontend-healthz` 一体机语义 | 一体机可显式 404，避免与分离部署混淆 |

### 已关闭（本周期）

| 项 | 状态 |
|----|------|
| 前后端交付缝 + CI 三镜像 | 完成 |
| 中文默认 + locale 嵌套展开 | 完成并部署 |
| 可信代理 fail-closed / metrics token fail-closed 源码 | 已有 |
| SQLite 日备 + 恢复演练文件 | 有 |
| 磁盘临时产物清理 | 已做一轮 |

---

## 4. 目标设定（本轮最优执行）

在**不改生产密钥/不碰 DB 数据**前提下，本轮只做：

1. **落地 P0-1**：修复 SPA NoRoute 误吞 `/metrics` 及同类后端前缀；补回归测试。  
2. **补文档**：本审计文件 + 运维注意点写入 `runtime-separation` 交叉链接。  
3. **本地验证**：`go test ./router`、构建标签测试。  
4. **推送 fork**。  
5. **生产部署**：因属安全/运维语义修复，**构建并 promote 到线上**（与中文修复同一发布通道），验证 `/metrics` 不再返回 HTML。  
6. **不自动改** `.env` Cookie 真值、不启用 metrics、不上分离镜像（除非后续确认）。

成功标准：

- `GET /metrics`（默认未启用）→ **404**（或非 HTML），不再是 SPA。  
- `/livez` `/readyz` `/api/status` 仍 200。  
- `/v1/models` 无 Token 仍 401。  
- 首页中文仍正常。  
- 测试通过并推送到 fork。

---

## 5. 回滚

- 二进制：`backups/releases` 中保留的最新旧包，或 `release-manifests/zh-unwrap-20260718` 对应包。  
- 代码：`git revert` NoRoute 提交。  
- 配置：未改 `.env` 则无配置回滚。

---

## 6. 明确不做（除非再次确认）

- 读取或修改 `.env` 中的密钥/Cookie 真值  
- 开启 `METRICS_ENABLED` 并配置 token  
- 切换生产到前后端分离 compose  
- 代码签名采购与实施  
- 真实上游收费 E2E  

---

## 8. 本轮执行记录（2026-07-18 续）

| 目标 | 结果 |
|------|------|
| 文档 | 本文件 |
| P0-1 SPA NoRoute 修复 | 提交 `bbddd729`，已推 fork，已部署生产 |
| 生产 PID | **32544** |
| 生产 SHA-256 | `d1120e03acd4498cf008bb71441cc07734f7fc0901a3639ce94904b21b35090c` |
| `/metrics` | **404** 非 HTML（修复前为 200 HTML） |
| `/frontend-healthz` | **404** 非 HTML |
| `/livez` `/readyz` `/api/status` | 200 JSON |
| `/v1/models` | 401 |
| `/console` | 200 HTML（SPA 正常） |
| 测试 | `go test ./router` 通过（含 `TestIsNonSPARequestPath`、`TestEmbeddedFrontendDoesNotServeSPAForMetrics`） |

### 未在本轮执行

- 修改生产 Cookie 真值 / Tunnel 策略
- 启用 metrics token
- 签名与完整 SBOM
- 真实业务 E2E
- 前后端分离上生产

### 下一步建议（需确认）

1. 只读核对 `SESSION_COOKIE_SECURE` / `TRUSTED_URL` 与公网 HTTPS 是否一致  
2. 沙箱 E2E 矩阵  
3. 签名 + SBOM 发布流程  
4. 前端体积 RUM 后拆包  

