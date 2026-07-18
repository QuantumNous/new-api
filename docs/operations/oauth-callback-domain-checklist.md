# OAuth 回调域名只读全量核对

- **日期**：2026-07-18
- **公网入口**：`https://incc.qzz.io`
- **运行版本**：`v1.0.0-rc.21-34-gbbddd729`
- **方法**：只读 `/api/status`、源码路由与 OAuth 客户端构造；**不**读取 client secret、不发起真实 OAuth 授权、不改 GitHub App 设置

---

## 1. 生产启用了哪些身份方式

来源：本机 `GET http://127.0.0.1:3000/api/status`（字段为公开状态，不含 secret）

| 方式 | 启用 | client_id / 备注 |
|------|------|------------------|
| **GitHub OAuth** | **是** | `github_client_id=Ov23liURGuQ4SZgvLGGq`（公开 client_id） |
| Discord OAuth | 否 | client_id 空 |
| OIDC | 否 | endpoint/client_id 空 |
| LinuxDO OAuth | 否 | client_id 空 |
| Telegram OAuth | 否 | bot 名空 |
| WeChat 登录 | 否 | — |
| **Passkey** | **是** | 见 §4（当前配置指向 localhost，生产域名下不可用） |
| 密码登录 | 状态里 `password_login_enabled` 存在（本清单不展开账号策略） | |

结论：第三方 OAuth 仅 **GitHub** 需回调域名闭环；Passkey 配置与公网域名**不一致**。

---

## 2. GitHub OAuth 实际跳转链路（源码）

### 2.1 授权 URL 构造

文件：`web/default/src/lib/oauth.ts` → `buildGitHubOAuthUrl`

```text
https://github.com/login/oauth/authorize
  ?client_id=<GitHubClientId>
  &state=<from /api/oauth/state>
  &scope=user:email
```

**注意：authorize 请求未带 `redirect_uri` 参数。**  
因此 GitHub 使用 **OAuth App / GitHub App 控制台里配置的唯一 Authorization callback URL**。

### 2.2 浏览器回调（前端 SPA）

路由：`/oauth/$provider`（`web/default/src/routes/oauth/$provider.tsx`）

生产期望 URL：

```text
https://incc.qzz.io/oauth/github?code=...&state=...
```

页面再调用：

```text
GET https://incc.qzz.io/api/oauth/github?code=...&state=...
```

### 2.3 后端换票

路由：`router/api-router.go`

```text
GET /api/oauth/state          → GenerateOAuthCode（写 session oauth_state）
GET /api/oauth/:provider      → HandleOAuth（校验 state，ExchangeToken，建会话）
```

GitHub 换票：`oauth/github.go` POST `https://github.com/login/oauth/access_token`  
（body 含 client_id/client_secret/code；**无 redirect_uri 字段**，与 authorize 一致，依赖 App 默认回调）。

### 2.4 必须登记在 GitHub 上的回调

| 位置 | 应配置值 |
|------|----------|
| GitHub OAuth App → Authorization callback URL | **`https://incc.qzz.io/oauth/github`** |

| 错误配置示例 | 后果 |
|--------------|------|
| `http://localhost:3000/oauth/github` | 生产登录 redirect_uri_mismatch / 回本地 |
| `https://incc.qzz.io/api/oauth/github` | 前端路由对不上，SPA 收不到 code 展示 |
| `https://incc.qzz.io/oauth/github/`（尾斜杠不一致） | 可能 mismatch（取决于 GitHub 严格匹配） |
| 仅 HTTP | 与公网 HTTPS 不一致 |

**本审计无法读取你的 GitHub Developer Settings**；请打开  
https://github.com/settings/developers → 对应 OAuth App（client_id 前缀 `Ov23li…`）人工核对 callback 是否**精确等于**上表。

### 2.5 绑定流程

已登录用户绑定 GitHub 时仍走同一 authorize + `/oauth/github` 回调（`window.opener` 区分 bind/login）。  
Callback 仍必须是同一 URL。

---

## 3. 其他 Provider 回调模板（当前未启用，备查）

若将来打开，前端会显式带 `redirect_uri=window.location.origin/...`：

| Provider | 启用 | Authorize redirect_uri（前端） | 后端 API |
|----------|------|--------------------------------|----------|
| Discord | 否 | `{origin}/oauth/discord` | `/api/oauth/discord` |
| OIDC | 否 | `{origin}/oauth/oidc` | `/api/oauth/oidc` |
| LinuxDO | 否 | 构造函数未带 redirect_uri（与 GitHub 类似，依赖控制台默认） | `/api/oauth/linuxdo` |
| WeChat / Telegram | 否 | 非标准路由 `/api/oauth/wechat`、`/api/oauth/telegram/*` | 见 `api-router.go` |

生产 origin 固定为 `https://incc.qzz.io` 时，未来启用 Discord/OIDC 应在对应控制台登记：

- `https://incc.qzz.io/oauth/discord`
- `https://incc.qzz.io/oauth/oidc`

---

## 4. 与 OAuth 相关的系统地址字段（高优先级偏差）

`/api/status` 仍暴露：

| 字段 | 当前值 | 期望（生产） | 影响 |
|------|--------|--------------|------|
| `server_address` | `http://localhost:3000` | `https://incc.qzz.io` | 邮件链接、部分回跳、第三方文档/支付回调文案可能指错域名 |
| `passkey_rp_id` | `localhost` | `incc.qzz.io` | **公网 Passkey 无法绑定/登录** |
| `passkey_origins` | `http://localhost:3000` | `https://incc.qzz.io` | 同上 |
| `passkey_allow_insecure` | `true` | 生产应为 `false` | 与 HTTPS 生产策略不一致 |
| `passkey_login` | `true` | 可保留 true，但须先修正 rp_id/origins | 功能开关开着但配置不可用 |
| `docs_link` | `https://docs.newapi.pro` | 可保留 | 外链文档 |

**说明**：`SESSION_COOKIE_TRUSTED_URL=https://incc.qzz.io` 已正确；**业务 option 里的 ServerAddress / Passkey 仍像开发机默认值**，与 Cookie 层脱节。

### 建议修改入口（需你确认后改，本清单不自动写库）

管理后台 → 系统设置（站点 / 认证 / Passkey）或 options：

1. **Server Address / 服务器地址** → `https://incc.qzz.io`（无尾斜杠或与项目约定一致）  
2. **Passkey RP ID** → `incc.qzz.io`  
3. **Passkey Origins** → `https://incc.qzz.io`  
4. **Passkey allow insecure** → `false`  
5. 保存后**重新登录**测 Passkey；已在 localhost 注册的凭据不会自动迁移到新 rp_id  

---

## 5. Cookie / 会话与 OAuth 交叉

| 项 | 状态 |
|----|------|
| OAuth state 存 session cookie | `/api/oauth/state` 使用 `sessions` |
| Secure Cookie | 已 `SESSION_COOKIE_SECURE=true` + Trusted URL |
| SameSite=Strict | 源码默认 Strict |

**SameSite=Strict 与 OAuth：**  
GitHub 回跳是**跨站导航回到** `incc.qzz.io`。部分浏览器对「顶级导航带回第一方 Cookie」仍发送 cookie；若出现「state 无效」，需验证：

- 回调是否仍在 `https://incc.qzz.io` 第一方；  
- 是否被中间页跨站；  
- 必要时评估 `Lax`（需产品决策，不在本清单自动改）。

---

## 6. Tunnel / 域名（与回调一致）

`C:\Users\yuanjia\.cloudflared\config-incc-newapi.yml`（只读）：

```yaml
hostname: incc.qzz.io
service: http://localhost:3000
```

- 公网仅 `incc.qzz.io` → OAuth 回调只登记这一 host 即可。  
- 若将来加 `www` 或其他域名：Cookie Trusted URL、ServerAddress、Passkey origins、GitHub callback **全部**要同步扩展。

---

## 7. 核对勾选表

### 已由自动化完成

- [x] 列出已启用 OAuth/Passkey  
- [x] 从源码固定 GitHub 回调路径为 `/oauth/github`  
- [x] 后端 API 为 `/api/oauth/github`（二次调用，不是 GitHub 回调）  
- [x] 发现 `server_address` / Passkey 仍为 localhost  
- [x] Tunnel hostname = `incc.qzz.io`

### 需你人工完成

- [ ] GitHub Developer Settings 中 callback **精确**为 `https://incc.qzz.io/oauth/github`  
- [ ] 用无痕窗口点一次「Continue with GitHub」确认可回跳并登录  
- [ ] 后台改 ServerAddress + Passkey 四项后复测 Passkey  
- [ ] 若有自定义 OAuth Provider（DB 表），在后台列表中逐个核对 redirect  

---

## 8. 风险分级

| ID | 项 | 等级 |
|----|----|------|
| O1 | GitHub callback 未在本环境验证（控制台在 GitHub） | P1 人工 |
| O2 | `server_address=http://localhost:3000` | **P0/P1** 业务配置错误 |
| O3 | Passkey rp_id/origins=localhost 且 allow_insecure=true | **P0/P1** 公网 Passkey 失效/不安全默认 |
| O4 | SameSite=Strict 与 OAuth 兼容性 | P2 观察 |
| O5 | Discord/OIDC 未启用 | 信息 |

---

## 9. 明确未做

- 未读取 GitHub client secret  
- 未修改 options 数据库  
- 未代表你点击 GitHub 授权  
- 未改 Cloudflare / DNS  

---

## 11. 2026-07-18 生产执行

| 项 | 状态 |
|----|------|
| ServerAddress | **已改为** `https://incc.qzz.io`（DB options，已反映到 `/api/status`） |
| passkey.rp_id / origins | **已改为** `incc.qzz.io` / `https://incc.qzz.io` |
| passkey.allow_insecure_origin | **已改为** `false` |
| options 备份 | `D:\newapi\backups\options-before-prod-fix-20260718-162714.sql` |
| GitHub callback URL | **仍需人工**在 GitHub Developer Settings 设为 `https://incc.qzz.io/oauth/github`（API/浏览器自动化无法代改） |
| HSTS | 应用层已上线（`3830dc07`）；CF 面板可再开双保险 |

人工勾选：

- [x] GitHub OAuth App callback 已设为 `https://incc.qzz.io/oauth/github`（用户 2026-07-18 控制台截图确认）
- [x] GitHub **Homepage URL** 已改为 `https://incc.qzz.io/`（2026-07-18 本机 Chrome 代改，页面提示 Application updated successfully）
- [ ] 无痕窗口实测「Continue with GitHub」登录成功
- [ ] （可选）Passkey 在生产域名重新注册
- [ ] （可选）CF Edge Certificates 开启 HSTS（应用层 HSTS 已上线）

### GitHub OAuth App 当前快照（2026-07-18 已更新，无 secret）

| 字段 | 值 | 判定 |
|------|-----|------|
| Application name | newapi | 可保留 |
| Client ID | Ov23liURGuQ4SZgvLGGq | 与 `/api/status` 一致 |
| Homepage URL | `https://incc.qzz.io/` | **正确** |
| Authorization callback URL | `https://incc.qzz.io/oauth/github` | **正确** |
| Client secret | 控制台显示 Never used | 做一次真实登录后会变为 used |
| Device Flow | 未要求 | 可保持关闭 |

