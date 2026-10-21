# 中转平台开放接口：第三方 AI 助手 OAuth 绑定与 API Key 交付

## Goal

让第三方 AI 助手（Partner）通过标准 OAuth 2.0 授权码 + PKCE 流程绑定野菜API账号，并取得该次授权专属的一把模型 API Key，用它调用 `/v1/models`、`/v1/chat/completions`。第三方原有登录体系不变；野菜API 作为授权服务器与资源服务器。

外部契约来源：`research/source-relay-partner-api-v0.2.md`（文档 v0.2，2026-10-10，下称“协议”）。本 PRD 只记录我方实现要求与验收；协议原文是对外行为的权威定义，冲突时以协议为准并在交付说明中指出。

## Background / Confirmed Facts

- 当前 `main`（`be09fdb01`）没有可用的 OAuth 授权服务器实现。`codex/client_auth`（`16f20d5d4`，落后 main 344 提交）有一套固定公共客户端 `yeschoy-desktop` 的 PKCE 实现，路径 `/api/oauth/*`，且其契约 `.trellis/spec/backend/oauth-client-pkce.md` 规定“OAuth 永不创建/返回 API Key”，与本协议冲突。
- 已有可复用基础设施：`model/auth_flow.go`（HMAC 存储的一次性短期流程、`ConsumeAuthFlowWithAction` 原子消费）、`middleware.GetBrowserSessionAuthIdentity`（只接受真实浏览器 Web Session）、`model.Token` + `common.GenerateKey()`（API Key 存储不带 `sk-` 前缀，对外展示加 `sk-`）、`setting.DefaultUseAutoGroup` 决定默认令牌分组。
- 模型接口 `/v1/models`、`/v1/chat/completions` 已存在，使用普通 API Key，无需改动。

## Key Decisions (user-confirmed 2026-10-10 / 2026-10-13)

| # | 决策 | 结论 |
|---|---|---|
| D1 | 实现基础 | 基于 `main` 独立实现 Partner OAuth；只参考 `codex/client_auth` 中通用的 PKCE 校验、表单解析、错误输出思路，不合并该分支 |
| D2 | 客户端登记 | 新建数据库表 + 管理后台页面增删改；`client_secret` 生成后只展示一次，库内只存摘要 |
| D3 | Key 策略 | 每个绑定首次领取凭证时新建一把专属 Key：无限额度、不限模型、默认分组（同注册默认令牌规则），`expired_time` = 绑定截止时间；出现在用户令牌列表，用户可禁用/删除 |
| D4 | 用户侧“已授权应用”管理页 | 2026-10-13 改为纳入本次的最小版（满足 ASVS L2 10.4.9 / 10.7.3）：安全页新增“已授权应用”区块，列表 + 取消授权 |
| D5 | 客户端管理权限 | 2026-10-13 改为 Root + 管理员：新增 Casbin 资源 `partner_oauth_client`，按风险拆分动作；管理员默认只有“查看”“启用/停用”，“新建、修改、签发/轮换密钥、删除”需 Root 在用户编辑中单独授予；Root 始终全部拥有。入口改为独立管理页（系统设置整页仅 Root 可进） |
| D5a | 高风险客户端操作二次验证 | 新建、修改（名称/回调地址/scope）、轮换密钥、删除都要求安全验证（2FA/Passkey/密码，复用现有流程），Root 与管理员相同；启用/停用不要求（停用是紧急止损） |
| D6 | 每用户令牌数上限 | 专属 Key 不受 `MaxUserTokens` 限制（协议没有对应错误码，数量受绑定次数约束） |
| D7 | 用户改密/认证版本变化 | 该用户所有绑定的 OAuth 令牌失效（需重新授权），已发放的 Key 不自动禁用，仍由用户在令牌列表管理 |
| D8 | 修改客户端 scope / 回调地址 | 只影响之后的授权，已有绑定不变；停用客户端立即阻断全部令牌；删除客户端会撤销其全部绑定并禁用对应 Key |
| D9 | 同意页地址 | `/partner-authorize?request=…`，避开现有 `/oauth/$provider` 前端路由 |

## Requirements

### R1 客户端登记（管理后台）
- 字段：显示名称、`client_id`（系统生成，URL 安全字符）、认证方式 `client_secret_basic` | `none`、登记回调地址列表、允许的 scope 子集、启用/停用状态。
- `client_secret_basic` 客户端创建或轮换密钥时生成高熵 `client_secret`（URL 安全字符），响应中只返回一次；数据库只存摘要。`none` 客户端没有密钥。
- 回调地址校验：必须是绝对 URL，无 fragment、无 userinfo；普通网页回调必须是 `https`；`none` 客户端可登记 `http://127.0.0.1/...` 或 `http://[::1]/...` 回环地址（授权时允许任意端口，其余部分精确匹配）。
- 停用客户端：授权、Token、撤销接口返回 `invalid_client`；其访问令牌在资源接口失效（`invalid_token`）。
- 权限（D5）：`read` 查看列表/详情（不含密钥）；`operate` 启用/停用；`sensitive_write` 新建、修改、轮换密钥、删除。管理员默认 `read` + `operate`；Root 是超级角色不受限；Root 可在“用户编辑 → 管理员权限”中为单个管理员授予或收回任意动作。
- `sensitive_write` 的每次操作都需要一次性安全验证凭证（D5a），凭证绑定操作类型与目标客户端，不能挪用到别的客户端或别的操作。
- 管理入口是独立页面，位于侧边栏“管理员”分组；没有 `read` 权限的管理员看不到菜单，直接访问返回 403；页面内按钮按动作权限显示。

### R2 `GET /oauth/authorize`
- 按协议第 2 节校验参数：`response_type=code`、`client_id`、`redirect_uri`（精确匹配登记值，回环例外）、`scope`（必填、空格分隔、只允许 `account:read` `credential:read` `offline_access` 且为客户端允许子集，不可重复）、`state`（32–128 个 URL 安全字符）、`code_challenge`（43 个 Base64URL 字符）、`code_challenge_method=S256`。重复参数视为 `invalid_request`。
- `client_id` 或 `redirect_uri` 不合法：服务端渲染 400 错误页，不重定向。
- 其他参数错误：重定向到回调，带 `error`、`state`（原样，若可用）、`iss`。
- 合法请求：创建 10 分钟有效的待授权请求，跳转到前端授权同意页；用户未登录时先登录再回到同意页。
- 同意页展示当前登录账号及 R10 列出的授权信息；用户整体“同意/拒绝”。同意必须来自真实浏览器 Web Session（非 PAT、非桌面会话）。
- 同意：签发 120 秒、一次性授权码，绑定用户、用户认证版本、客户端、完整 redirect_uri、code_challenge、scope；回调 `code`+`state`+`iss`。拒绝：回调 `error=access_denied`+`state`+`iss`。回调已有 Query 时追加参数。
- 授权页最终 HTML 响应设置 `Referrer-Policy: no-referrer`。

### R3 `POST /oauth/token`
- 只接受 `application/x-www-form-urlencoded`；请求体大小受限；重复参数 → `invalid_request`。
- 客户端认证严格按登记方式：`client_secret_basic` 只认 Basic 头（表单不得再带 `client_secret`）；`none` 只认表单 `client_id`（不得带 Basic 或 `client_secret`）。Basic 失败 → 401 `invalid_client` + `WWW-Authenticate: Basic realm="oauth"`；公共客户端无效 → 400 `invalid_client`。
- `authorization_code`：校验授权码（未过期、未使用、属于该客户端）、`redirect_uri` 完全相同、PKCE S256（verifier 43–128 个 unreserved 字符）。失败 → 400 `invalid_grant`。成功在同一事务内创建绑定、访问令牌、（授予 `offline_access` 时）刷新令牌。授权码重放时撤销该授权码产生的绑定（RFC 6749 §4.1.2）。
- 绑定绝对截止时间 = 签发时刻 + 30 天，刷新不延长。访问令牌有效期 = min(3600 秒, 绑定剩余)。
- 响应字段：`access_token`、`token_type=Bearer`、`expires_in`、`refresh_token`/`refresh_token_expires_in`（仅授予 `offline_access` 时）、`scope`、`binding_id`。
- `refresh_token`：必须是该绑定原客户端；严格轮换，每次返回新 AT/RT，旧 RT 立即失效；权限不扩大、`binding_id` 不变、剩余期限递减。已轮换的旧 RT 再次出现 → 撤销整个绑定并禁用关联 Key，返回 `invalid_grant`。
- 用户被禁用、改密/认证版本变化后，绑定的令牌失效（`invalid_grant` / `invalid_token`）。
- 不支持的 grant → `unsupported_grant_type`；所有响应 `Cache-Control: no-store`、`Pragma: no-cache`、`X-Request-Id`。

### R4 `POST /oauth/revoke`
- 表单 + 同 Token 接口的客户端认证。`token` 可为该客户端绑定的 AT 或 RT；`token_type_hint` 只作提示，其他值忽略。
- 可识别为本客户端绑定的令牌：撤销整个绑定（所有 AT/RT 失效，关联 Key 禁用并立即失效缓存）。
- 未知、已失效、已撤销、属于其他客户端的令牌：返回空 200（不泄露令牌状态）。客户端认证失败仍返回错误。
- 成功响应：200、空 body、`Cache-Control: no-store`。

### R5 `GET /api/integrations/v1/account`
- Bearer AT，需要 `account:read`；不接受任何 Query（有则 400 `invalid_request`）。
- 返回 `issuer`、`account_id`（稳定、不可重分配）、`display_name`、`binding_id`、`scope`、`grant_expires_at`（UTC RFC 3339）。

### R6 `POST /api/integrations/v1/credential`
- Bearer AT，需要 `credential:read`；`Content-Type` 必须是 `application/json`（否则 415 `unsupported_media_type`）；Body 必须是空对象 `{}`，不接受任何字段、不接受 Query（否则 400 `invalid_request`）。
- 首次调用为绑定新建专属 Key（D3）；同一绑定重复或并发调用返回同一把 Key，绝不新增第二把。
- Key 被删除 → 404 `credential_not_found`；被禁用 → 403 `credential_disabled`；过期 → 403 `credential_expired`；不自动补发。
- 返回 `binding_id`、`account_id`、`key_id`、`api_key`（`sk-` 前缀完整 Key）、`base_url`（`{ISSUER}/v1`）、`expires_at`（≤ `grant_expires_at`）。

### R7 资源接口通用错误
- 错误体 `{"error":{"code","message"},"request_id"}`；完全缺少认证 → 401 空体 + `WWW-Authenticate: Bearer realm="integration"`；无效令牌 → 401 JSON + `Bearer error="invalid_token"`；缺权限 → 403 + `Bearer error="insufficient_scope", scope="..."`；账号禁用 → 403 `account_disabled`。
- 敏感响应带 `no-store`/`no-cache`，所有响应带 `X-Request-Id`。

### R8 限流与可用性
- OAuth 端点与资源接口限流：429 + `Retry-After`；OAuth 端点错误值 `rate_limited`，资源接口 `error.code=rate_limited`。

### R9 Issuer 与 Host
- `ISSUER` 与 `RELAY_ORIGIN` 取系统配置的主站地址：开启推广子域名时为 `CustomDomainMainOrigin`，否则为 `ServerAddress`；精确不带末尾 `/`；公开 OAuth 与集成端点只在主站 Host 上提供，不信任请求 Host / `X-Forwarded-Host` 构造地址。

### R9a 用户侧“已授权应用”（最小版）
- 安全页（`/security`，紧跟“登录会话”区块）新增“已授权应用”区块。
- 列出当前用户所有有效（未撤销、未过期）绑定：应用名称、授予的权限、授权时间、到期时间、关联 Key（名称与状态；尚未领取时显示“未领取”）。
- 每条可“取消授权”，需二次确认；确认文案说明：取消后该应用的所有令牌立即失效，关联 Key 被禁用，若该 Key 也用于其他软件会一并失效。
- 取消授权只要求真实浏览器会话（与撤销登录会话一致，不要求二次验证）；只能撤销自己的绑定，他人或不存在的绑定一律 404。
- 取消授权复用与 `/oauth/revoke` 相同的撤销逻辑，并写审计日志。
- 不提供修改权限范围、重新领取 Key、查看已撤销历史（后续再议）。

### R10 安全与日志（目标 OWASP ASVS 5.0 L2；威胁表见 `research/security-threat-model.md`）
- 授权码、请求令牌、AT、RT、`client_secret` 只存 HMAC/摘要；比较用常量时间。
- 日志不得记录授权 Query 中的 `code`/`state`/`code_challenge`、同意页/登录跳转里的请求令牌、表单 body、`Authorization` 头、令牌、Key。
- 待授权请求绑定发起它的浏览器（HttpOnly Cookie），其他浏览器拿到链接也无法查看或同意。
- 同意页禁止被嵌入框架（`X-Frame-Options: DENY` + `frame-ancestors 'none'`）、`no-referrer`；明确展示应用名、回调域名、各项权限、30 天有效期，以及“将发放一把可消费账户余额的无限额度 Key”。每次授权都需用户明确同意。
- 客户端认证：未知 client 与错误密钥返回完全相同的错误；按 IP 和按 client_id 失败次数双重限流。
- 访问令牌只接受 `Authorization` 头，Query/表单里的 `access_token` 一律拒绝。
- 每个用户对同一客户端最多 10 个有效绑定。
- 授权同意、令牌签发、刷新令牌重放、撤销、凭证首次发放、客户端管理操作写入审计日志（不含任何秘密）；客户端管理审计记录操作人 ID 与角色。
- 同意授权不额外要求二次验证（同一会话本可直接在控制台创建无限额度 Key，二次验证不提升门槛）。
- 交付说明列出 ASVS 条目、已验证项与缺口（L3 的 DPoP/mTLS、PAR 不实现）。

## Acceptance Criteria

- [ ] 拥有 `sensitive_write` 的管理员或 Root 完成安全验证后可创建 `client_secret_basic` 与 `none` 两类客户端；密钥只显示一次；停用后三类 OAuth 端点返回 `invalid_client`。
- [ ] 权限矩阵：默认管理员能查看、启用/停用，新建/修改/轮换/删除返回 403；被授予 `sensitive_write` 后可执行；被收回 `read` 后看不到菜单且接口 403；普通用户全部 403；Root 全部可执行。缺少、过期、已用或挪用到其他客户端的安全验证凭证均被拒绝。
- [ ] 完整流程（authorize → 同意 → token → account → credential → `/v1/models` 用 api_key 成功）在两类客户端下都可走通。
- [ ] 拒绝授权回调 `error=access_denied&state&iss`；非法 client/redirect 返回 400 页面且不重定向。
- [ ] 错误 PKCE、错误 redirect_uri、过期（>120s）授权码、重复兑换授权码 → `invalid_grant`；重复兑换后该授权码产生的绑定被撤销。
- [ ] 未授予 `offline_access` 时不返回刷新令牌。
- [ ] 刷新返回新 AT/RT、`binding_id` 不变、`refresh_token_expires_in` 递减；旧 RT 再用 → `invalid_grant` 且绑定被撤销、关联 Key 被禁用。
- [ ] 并发/重复调用 credential 只产生一把 Key；Key 被禁用/删除/过期分别返回 403/404/403 对应错误码。
- [ ] revoke 本客户端 AT 或 RT 后：所有令牌失效，Key 禁用，`/v1/models` 用该 Key 被拒；未知令牌返回空 200。
- [ ] 资源接口缺认证、无效令牌、缺权限、非 JSON、非空 body、带 Query 分别得到协议规定的状态码、错误码与 `WWW-Authenticate`。
- [ ] 用户在安全页能看到自己的有效授权；取消授权后该绑定的 AT/RT 立即 401/`invalid_grant`、Key 被禁用；撤销他人绑定返回 404；PAT 调用撤销接口被拒绝。
- [ ] 安全控制：缺少或不匹配浏览器绑定 Cookie 时无法查看/同意；`/partner-authorize` 响应带禁止嵌入与 `no-referrer` 头；未知 client 与错误密钥的响应完全一致；按 client_id 的失败限流生效；Query/表单中的 `access_token` 被拒；第 11 个绑定被拒；审计日志写入且不含秘密；相关日志行不含查询参数。
- [ ] 所有新增表在 SQLite、MySQL 5.7.8+、PostgreSQL 9.6+ 真实实例（Docker）上全新建表与重复迁移通过。
- [ ] 后端测试、前端测试/类型检查/构建通过；交付说明记录命令和结果。

## Out of Scope

- “已授权应用”的权限修改、已撤销历史与重新领取 Key。
- `id_token` / OIDC、动态客户端注册、SPA 跨域取 Key、支付平台拒付回调。
- 模型接口（`/v1/*`）行为修改。
- 合并或改造 `codex/client_auth` 的 `yeschoy-desktop` OAuth。
