# D:\newapi 项目交付概览（更新）

- **实施起始：** 2026-07-17  
- **最后验证：** 2026-07-18（健康检查 + 登出回归 + 磁盘清理）  
- **权威源码：** `D:\newapi\src`  
- **分支：** `feat/adaptive-channel-balance-rc12`  
- **HEAD / 生产 revision：** `33be725d327813816d791d9d55a8a0d761a5566e`  
- **生产进程：** PID 19984（`new-api-fixed.exe`）  
- **公网：** `https://incc.qzz.io`  
- **Fork：** `xvyimu/new-api` 已与 HEAD 同步  

---

## 1. 当前结论（一句话）

生产已跑在含中文 UI、HSTS、Secure Cookie 配置、OAuth/Passkey 域名修正、登出加固与 SPA 运维路径修复的一体化二进制上；本地/核心公网探针与 Go 门禁通过。剩余主要是人工 UI 登出点验、CF 面板 HSTS 双保险、签名/SBOM、真实业务 E2E。

---

## 2. 架构（现行）

```text
浏览器 → Cloudflare → cloudflared Tunnel → 127.0.0.1:3000
                         └─ new-api-fixed.exe（一体化 embed，RUN_MODE/APP_PLANE 默认 all）
                              ├─ /livez /readyz /healthz
                              ├─ /api/*  /v1/*  relay 前缀…
                              └─ SPA（default 主题，中文默认）
```

可选未切换：`deploy/separated` 前后端分离镜像 + Nginx 同源反代。

唯一构建源：`D:\newapi\src`。`_qn_tmp` 仅上游参考，禁止发布。

---

## 3. 本周期已落地（相对 07-17 基线）

### 3.1 安全 / 会话 / HTTPS

| 项 | 状态 |
|----|------|
| `SESSION_COOKIE_SECURE=true` + Trusted URL=`https://incc.qzz.io` | 生产已配 |
| 应用层 HSTS `max-age=15768000`（`X-Forwarded-Proto=https`） | 已部署 |
| 3000 入站防火墙 Block | 已启用 |
| Tunnel `incc.qzz.io` → localhost:3000 | Running |
| SPA 不再把 `/metrics` 等伪装成 HTML 200 | 已部署 |
| 登出：`session` Max-Age=0 + 前端硬跳登录 + 抑制 401 噪声 | 已部署 |

### 3.2 中文与 OAuth / Passkey

| 项 | 状态 |
|----|------|
| 默认前端 locale 嵌套 `translation` 展开 | 已修 |
| 中文默认 / 忽略 navigator 英文 | 已修 |
| `ServerAddress` | `https://incc.qzz.io` |
| Passkey rp/origins | 生产域名；`allow_insecure=false` |
| GitHub callback | `https://incc.qzz.io/oauth/github` |
| GitHub Homepage | `https://incc.qzz.io/` |

### 3.3 交付缝 / CI（源码，生产仍一体化）

- `frontend_external` + `FRONTEND_MODE`
- `Dockerfile.backend` / `deploy/separated/*`
- quality：pure backend、三镜像、nginx digest 解析  
- 文档：ADR、runtime-separation、cookie/oauth/hsts 清单  

### 3.4 备份

- 日备任务 `NewAPI-SQLiteBackup` 正常（`.backup` + integrity + sha256）  
- 最新库备份：`backups/db/one-api-20260718-110210.db`  

### 3.5 磁盘

- 已清理过期 release-build / 中间诊断包 / 旧日志等  
- 本轮再删旧 `release-manifests/*`（保留当前 prod 对应 `logout-fix2-20260718`），约 **+543 MB**  
- 现 `release-manifests` ≈ 136 MB；`src` ≈ 2.0 GB（主要为 `web/node_modules`，构建需要，未删）  

---

## 4. 最新健康检查摘要（2026-07-18）

详见：`docs/healthcheck-logout-regression-20260718.md`

| 类别 | 结果 |
|------|------|
| 版本三边一致 | 通过 |
| 本机 livez/readyz/status/metrics404/logout | 通过 |
| 公网 livez/readyz/HSTS/logout cookie | 通过 |
| 公网部分路径偶发 CF 断开/403 | 边缘抖动；重试或本地直连正常 |
| `go test` router/middleware/frontend_external | 通过 |
| UI 登录→退出手测 | 建议你再点一次确认 |

---

## 5. 风险与未完成

| 优先级 | 项 | 状态 |
|--------|----|------|
| P1 | 完整 UI 登出手测 | 接口层已过；待人工 |
| P1 | CF 面板 HSTS 双保险 | 应用层已有；面板需账号操作（见 runbook） |
| P1 | Authenticode 签名 + 完整 SBOM | 未做 |
| P1 | 真实鉴权/Relay/计费/支付 E2E | 未做 |
| P2 | 前端体积 RUM 后拆包 | 预算门禁已有 |
| P2 | 非 root 容器 / 分离部署上生产 | 镜像就绪未切 |
| P2 | 证书续期（LE ~2026-09-25） | 观察 |
| 信息 | `curl -sI` HEAD 对部分 API 404 | 不影响 GET |

---

## 6. 关键路径索引

| 用途 | 路径 |
|------|------|
| 源码 | `D:\newapi\src` |
| 生产 exe | `D:\newapi\new-api-fixed.exe` |
| 数据 | `D:\newapi\data` |
| 本轮健康报告 | `D:\newapi\docs\healthcheck-logout-regression-20260718.md` |
| 优化审计 | `D:\newapi\docs\optimization-audit-2026-07-18.md` |
| Cookie/HTTPS 清单 | `src/docs/operations/cookie-https-readonly-checklist.md` |
| OAuth 清单 | `src/docs/operations/oauth-callback-domain-checklist.md` |
| HSTS runbook | `src/docs/operations/cloudflare-hsts-runbook.md` |
| 运维执行记录 | `D:\newapi\docs\ops-fix-execution-2026-07-18.md` |
| 当前发布证据目录 | `D:\newapi\release-manifests\logout-fix2-20260718\` |
| 启动/晋升 | `start-newapi-hidden.ps1` + 计划任务 `NewAPIServer` |

---

## 7. 建议下一步（需确认）

1. 你本机无痕：**登录 → 退出**，确认无 “Session expired” 连环提示。  
2. （可选）CF Edge Certificates 再开 HSTS。  
3. 签名 + SBOM 发布流程。  
4. 沙箱 E2E。  
5. 是否合并 PR #1。  

---

## 8. 回滚

- 二进制：`release-manifests\logout-fix2-20260718\` 或 `backups\releases\` 最新包  
- options：`backups\options-before-prod-fix-20260718-162714.sql`  
- 代码：fork 分支 `git revert` 对应提交  
