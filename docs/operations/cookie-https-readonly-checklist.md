# Cookie / HTTPS 只读核对清单

- **日期**：2026-07-18
- **环境**：生产 `D:\newapi` + 公网 `https://incc.qzz.io`
- **运行版本**：`v1.0.0-rc.21-34-gbbddd729` / PID **32544**
- **方法**：只读；**不输出** `.env` 密钥/SESSION_SECRET 值；不改配置、不重启服务、不登录真实账号写 Cookie
- **权威源码行为**：
  - `common/session_cookie.go` — `SESSION_COOKIE_SECURE` + `SESSION_COOKIE_TRUSTED_URL` 启动校验
  - `main.go` — `sessions.Options{ Path:/, MaxAge:30d, HttpOnly:true, Secure:env, SameSite:Strict }`
  - `trusted_proxy.go` — `TRUSTED_PROXY_CIDRS` 控制 Gin 是否信任 `X-Forwarded-For`

---

## 0. 执行摘要

| 项 | 结论 | 等级 |
|----|------|------|
| Cookie 配置键名 | 正确使用 `SESSION_COOKIE_SECURE` / `SESSION_COOKIE_TRUSTED_URL`（无错误 `SESSION_SECURE`） | 通过 |
| Secure Cookie 已启用 | `SESSION_COOKIE_SECURE=TRUE`；近期启动日志**无** “Session cookie is not secure” 警告 | 通过 |
| Trusted URL 形态 | 1 条：`https://incc.qzz.io`（https、有 host、无 userinfo/query） | 通过 |
| 与公网入口一致性 | 公网 host = `incc.qzz.io`，与 Trusted URL host 一致 | 通过 |
| HTTPS 可达 | `https://incc.qzz.io/*` 200；应用版本头匹配生产 | 通过 |
| HTTP→HTTPS | `http://incc.qzz.io/` → **301** `https://incc.qzz.io/`（Cloudflare） | 通过 |
| TLS 证书 | Let's Encrypt，CN=`incc.qzz.io`，有效至 **2026-09-25** | 通过（注意续期） |
| HSTS | 响应中 **无** `Strict-Transport-Security` | **缺口** |
| 直连 3000 | 监听 `::`；防火墙规则 **Block direct TCP 3000** 已启用 | 通过 |
| Tunnel | 服务 `Cloudflared` Running；进程存在 | 通过 |
| Trusted Proxy CIDR | 仅 `127.0.0.1/32`、`::1/128`（适合本机 cloudflared 回源） | 通过（在「仅本机回源」假设下） |
| 登录后 Set-Cookie 实测 | **未做**（避免真实登录）；属性依赖源码常量 | 残余风险 |

**总体**：生产 Cookie/HTTPS **配置与入口对齐良好**，可认为 Secure Cookie 链路在配置层已闭环。剩余主要是 **HSTS 未开**、**登录后 Cookie 属性需浏览器人工点验**、以及 **CF Access/WAF 策略未导出**。

---

## 1. 源码契约（应如何配）

### 1.1 环境变量

| 变量 | 约束（源码） |
|------|----------------|
| `SESSION_COOKIE_SECURE` | 仅 `true` / `false` / 空。空或 `false` 时 **禁止** 再设 Trusted URL |
| `SESSION_COOKIE_TRUSTED_URL` | `SECURE=true` 时**必填**；逗号分隔；每项必须是 **https + host** |
| `SESSION_SECRET` | 会话签名密钥（本清单不读值；仅确认 nonEmpty） |
| `TRUSTED_PROXY_CIDRS` | 逗号分隔 CIDR；空 = 完全不信任转发头 |

### 1.2 运行时 Cookie 选项（`main.go`）

| 属性 | 值 |
|------|-----|
| Name | `session` |
| Path | `/` |
| MaxAge | 2592000（30 天） |
| HttpOnly | **true** |
| Secure | **`SESSION_COOKIE_SECURE`** |
| SameSite | **Strict** |

### 1.3 Trusted URL 的作用边界

启动时校验 Trusted URL 列表并写入 `SessionCookieTrustedURLs`。  
本审计范围内：**Secure 开关本身由 `SESSION_COOKIE_SECURE` 全局决定**，不是按请求 Host 动态切换。Trusted URL 用于强制「开 Secure 时必须声明可信 HTTPS 入口」。

---

## 2. 生产 `.env` 只读结果（无密钥）

### 2.1 键存在性

| 键 | present | nonEmpty |
|----|---------|----------|
| `SESSION_SECRET` | 是 | 是 |
| `SESSION_COOKIE_SECURE` | 是 | 是 |
| `SESSION_COOKIE_TRUSTED_URL` | 是 | 是 |
| `TRUSTED_PROXY_CIDRS` | 是 | 是 |
| `PORT` | 是 | 是 |
| `SQLITE_PATH` | 是 | 是 |
| `FRONTEND_BASE_URL` | **否** | — |
| `CORS_ALLOWED_ORIGINS` | **否** | — |
| `METRICS_ENABLED` | **否** | — |
| `METRICS_TOKEN` | **否** | — |

说明：

- 未设 `FRONTEND_BASE_URL` / `CORS_ALLOWED_ORIGINS` 符合**同源一体化**部署，合理。
- Metrics 默认关，符合当前 `/metrics` 404 行为。

### 2.2 布尔与形态（安全可展示）

| 项 | 结果 |
|----|------|
| `SESSION_COOKIE_SECURE` | **TRUE** |
| `SESSION_COOKIE_TRUSTED_URL` 条数 | **1** |
| 条目 1 | scheme=`https` host=`incc.qzz.io` port=443 path=`/` userinfo=否 query=否 absolute=是 |
| `TRUSTED_PROXY_CIDRS` | `127.0.0.1/32`，`::1/128` |

### 2.3 与错误配置对照

| 历史问题 | 本环境 |
|----------|--------|
| 脚本写 `SESSION_SECURE`（源码不读） | `.env` **无**该键 |
| Secure=true 但缺 Trusted URL | **未出现**（两者皆 nonEmpty） |
| Trusted URL 用 http | **未出现**（仅 https） |

---

## 3. 传输与入口

### 3.1 HTTPS / HTTP

| 检查 | 结果 |
|------|------|
| `https://incc.qzz.io/livez` | 200 JSON；`x-new-api-version=v1.0.0-rc.21-34-gbbddd729` |
| `https://incc.qzz.io/` | 200 HTML；`Cache-Control: no-cache` |
| `https://incc.qzz.io/api/status` | 200 JSON |
| `https://incc.qzz.io/sign-in` | 200 HTML |
| `http://incc.qzz.io/` | **301** → `https://incc.qzz.io/`（Cloudflare） |
| `http://incc.qzz.io/livez` | 502（非 HTTPS 路径；以 301 首页为准） |
| `Strict-Transport-Security` | **响应中缺失** |

### 3.2 TLS 证书

| 项 | 值 |
|----|-----|
| Subject | CN=`incc.qzz.io` |
| Issuer | Let's Encrypt (YE2) |
| 有效期 | 2026-06-27 → **2026-09-25** |
| 算法 | sha384ECDSA |
| 剩余天数（审计日 2026-07-18） | 约 **69 天** |

建议：确认 cloudflared/源站或 CF 自动续期；到期前 14 天再查一次。

### 3.3 边缘与进程

| 项 | 结果 |
|----|------|
| Cloudflare | `Server: cloudflare`，有 `CF-RAY` |
| 本机 Tunnel | 服务 `Cloudflared` = Running；进程 cloudflared 存在 |
| 应用监听 | `:: :3000` Listen（PID 32544） |
| 防火墙 | 规则 **「New API - Block direct TCP 3000」Inbound Block Enabled** |
| 本机回环 | `127.0.0.1:3000` 可连（预期，供 Tunnel/本机） |

---

## 4. Cookie 属性（代码 + 运行时缺口）

### 4.1 代码保证（生产已 SECURE=true）

登录成功后发出的 `session` Cookie **应**为：

- `HttpOnly`
- `Secure`
- `SameSite=Strict`
- `Path=/`
- Max-Age ≈ 30 天  

### 4.2 本清单未完成的实测

| 检查 | 状态 | 原因 |
|------|------|------|
| 真实登录后 DevTools 看 `Set-Cookie` | **未做** | 避免使用真实账号/写入会话 |
| 错误密码是否 Set-Cookie | **未做** | 同上（可选用一次性测试号） |

**推荐人工 2 分钟验证（你本机浏览器）：**

1. 打开 `https://incc.qzz.io/sign-in`（无痕窗口）。  
2. 登录成功后 F12 → Application → Cookies → `https://incc.qzz.io`。  
3. 核对 `session`：
   - Secure = ✅  
   - HttpOnly = ✅  
   - SameSite = **Strict**  
   - Path = `/`  
4. 用 `http://` 无法保留该 Cookie（浏览器应拒绝 Secure Cookie）。  

### 4.3 未认证请求

| URL | Set-Cookie |
|-----|------------|
| `https://incc.qzz.io/api/user/self` 401 | 无 |
| `http://127.0.0.1:3000/api/user/self` 401 | 无 |
| `/livez` `/api/status` `/` | 无 |

符合「未建会话不写 Cookie」。

---

## 5. 代理信任与客户端 IP

| 项 | 结果 |
|----|------|
| `TRUSTED_PROXY_CIDRS` | 仅 loopback |
| 含义 | 仅当请求来自 127.0.0.1/::1 时，Gin 才采信 `X-Forwarded-For` / `X-Real-IP` |
| 与 Tunnel 匹配度 | cloudflared 本机回源时 **正确**；若改为局域网反代/多跳，需把反代出口 CIDR 写进列表 |

**风险**：CIDR 过宽 → IP 伪造；过窄且反代不在 loopback → 审计 IP 全是反代地址。当前「本机 tunnel」模型合适。

---

## 6. CORS / 同源

| 项 | 结果 |
|----|------|
| `CORS_ALLOWED_ORIGINS` | 未配置 |
| `FRONTEND_BASE_URL` | 未配置 |
| 部署形态 | 一体化 + 公网单 origin `https://incc.qzz.io` |

结论：Cookie 会话走**第一方同源**，无需为控制台扩大 CORS。若将来前后端分离且不同 origin，必须重开 CORS + 再审 SameSite/Trusted URL。

---

## 7. 核对矩阵（勾选表）

### A. 配置层（本机已代勾）

- [x] 使用 `SESSION_COOKIE_SECURE` 而非 `SESSION_SECURE`
- [x] `SESSION_COOKIE_SECURE=true`
- [x] `SESSION_COOKIE_TRUSTED_URL` 非空且全为 https
- [x] Trusted host 与公网入口 host 一致（`incc.qzz.io`）
- [x] `SESSION_SECRET` 存在且非空（值未读）
- [x] 启动日志无 “Session cookie is not secure”
- [x] `TRUSTED_PROXY_CIDRS` 存在；当前为 loopback
- [x] 公网 HTTPS 200 且版本头匹配
- [x] HTTP 首页 301 到 HTTPS
- [x] 3000 有 inbound block
- [x] cloudflared 在跑
- [ ] **HSTS 响应头**（未通过）
- [ ] **登录后 Cookie 属性浏览器点验**（待人工）
- [ ] **CF Access / WAF / Tunnel 路由只读导出**（未取控制台）
- [ ] **证书续期机制确认**（到期 2026-09-25）

### B. 建议的人工 / 控制台项

1. **浏览器 Cookie 点验**（见 §4.2）  
2. **Cloudflare Dashboard**（只读截图/导出）：
   - SSL/TLS 模式（建议 Full (strict)）  
   - Always Use HTTPS  
   - HSTS 是否在 CF 层开启（可补源站缺失）  
   - Tunnel Public Hostname → `http://127.0.0.1:3000`  
   - 是否有 Access 策略覆盖管理路径  
3. **OAuth 回调**（若启用 GitHub/OIDC 等）：回调 URL 是否仅为 `https://incc.qzz.io/...`  
4. **多入口**：若还有自定义域，必须追加到 `SESSION_COOKIE_TRUSTED_URL`（改配置需确认后重启）

---

## 8. 发现项与优先级

| ID | 发现 | 等级 | 建议 |
|----|------|------|------|
| C1 | 无 HSTS 响应头 | P1 | 在 Cloudflare 启用 HSTS（含 includeSubDomains 需谨慎）；或源站中间件添加（改代码/反代） |
| C2 | 登录后 Set-Cookie 未在本清单实测 | P1 | 管理员无痕登录点验 §4.2 |
| C3 | CF Access/WAF 无导出证据 | P1 | 控制台只读导出归档 |
| C4 | LE 证书 ~69 天到期 | P2 | 确认自动续期；到期前复查 |
| C5 | `TRUSTED_PROXY_CIDRS` 仅 loopback | 信息 | 保持；换反代拓扑时再改 |
| C6 | 3000 监听 `::` 依赖防火墙封锁 | 信息 | 保持 Block 规则；勿删除 |

**无 P0 配置错误**（在「单域名 HTTPS + 本机 Tunnel」模型下）。

---

## 9. 明确未做

- 未读取或打印 `SESSION_SECRET` 及任何密钥值  
- 未修改 `.env`、未重启进程  
- 未真实登录、未写入会话 Cookie  
- 未调用 Cloudflare API、未改 DNS/Tunnel  
- 未扫描支付/OAuth 回调完整列表（需账号与控制台）

---

## 10. 可选下一步（需你确认再执行）

1. **仅文档**：把本清单链入 `docs/operations`（可复制进仓库）。  
2. **HSTS**：CF 面板开启（推荐，无代码变更）或源站加头（需发版）。  
3. **你完成 §4.2 点验后**，把结果回填本文件「人工」一节。  
4. **OAuth 全量回调清单**（若你启用了第三方登录）。  

---

## 11. 证据索引

| 证据 | 来源 |
|------|------|
| 键名 / 布尔 / URL 形态 / CIDR | 本地 `.env` 解析（无值输出） |
| HTTPS/HTTP/HSTS/版本头 | `HttpWebRequest` + `curl -sSI` |
| TLS | `SslStream` + X509 |
| 监听/防火墙/Tunnel | `Get-NetTCPConnection` / `Get-NetFirewallRule` / `Get-Service` |
| Secure 启动警告 | 最近 3 个 `oneapi-*.log` 检索 |
| Cookie 代码 | `main.go`、`common/session_cookie.go` |

## 12. 2026-07-18 续：HSTS / 文档入库 / OAuth

| 动作 | 结果 |
|------|------|
| CF 自动开 HSTS | **未完成**：Wrangler token 无 zone_settings 写权限（403）；控制台自动化遇人机验证 |
| HSTS 操作手册 | 见同目录 `cloudflare-hsts-runbook.md`（面板点击即可，不改代码） |
| 清单入库 | 本文件位于 `src/docs/operations/` |
| OAuth 回调全量核对 | 见 `oauth-callback-domain-checklist.md` |

### OAuth 关键偏差（摘要）

- 仅 **GitHub OAuth** 启用；GitHub App 回调应登记 **`https://incc.qzz.io/oauth/github`**（不是 `/api/oauth/github`）。
- 系统 option 仍显示 `server_address=http://localhost:3000`，Passkey `rp_id=localhost` / `origins=http://localhost:3000` / `allow_insecure=true` —— **与公网 HTTPS 不一致**，需管理后台修正（本清单不写库）。

