# 专属推广域名与回调链路技术设计

## 1. 设计结论

采用“最小修改 New API”的单体内聚方案：

- `yeschoy.com` 继续作为主站、OAuth 固定回调入口及支付服务端通知入口。
- `*.yeschoy.io` 通过通配 DNS/TLS 与反向代理进入同一套 New API。
- New API 新增专属域名表、运行时 Host 解析、管理员 CLI、邀请默认值、OAuth 跨域交接和钱包充值回跳。
- 不引入应用感知网关或新的 Redis 依赖；复用现有数据库、`auth_flows`、登录 Session 与 `top_ups`。
- 所有入口共享用户、余额、订单、API Key 与权限；浏览器 Refresh Cookie 保持 Host-only，不做跨域 SSO。
- 首版不处理 Passkey、订阅套餐购买或客户白标 UI；TOTP 2FA 保持上游语义。

本设计的实现基线是当前仓库 commit `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db`，已按本地代码重新核对；`research/upstream-new-api.md` 只保留为外部历史研究，`research/local-baseline.md` 是实施权威。生产 image digest/commit、数据库类型、节点/Redis 拓扑、反向代理和第三方平台配置仍需在发布前只读核对。

## 2. 总体架构

```text
                         ┌──────────────────────────┐
yeschoy.com ────────────▶│                          │
a.yeschoy.io ───────────▶│  Nginx / ingress         │
b.yeschoy.io ───────────▶│  TLS + preserve Host     │
                         │                          │
yeschoy.io ── 404        └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │  Patched New API         │
                         │  - domain guard/cache    │
                         │  - attribution resolver  │
                         │  - OAuth handoff         │
                         │  - payment return router │
                         └────────────┬─────────────┘
                                      │
                              shared DB / Redis*

* Redis remains optional exactly as upstream; this feature does not require it.
```

外部流程：

```text
a.yeschoy.io ─▶ GitHub / Linux Do ─▶ yeschoy.com OAuth callback
       ▲                                      │
       └──────── one-time domain handoff ─────┘

a.yeschoy.io ─▶ 易支付 / Stripe ─▶ yeschoy.com callback/webhook
       ▲                                      │
       └──────── DB-backed browser return ────┘
```

## 3. 配置边界

建议新增配置，名称在实现时按实际设置体系调整：

| 配置 | 建议值 | 用途 |
|---|---|---|
| `CUSTOM_DOMAIN_ENABLED` | `false` 默认 | 总功能开关，支持安全回滚 |
| `CUSTOM_DOMAIN_SUFFIX` | `yeschoy.io` | 只接受一级专属子域名 |
| `CUSTOM_DOMAIN_MAIN_ORIGIN` | `https://yeschoy.com` | 回调、停用回退与默认主站 |
| `CUSTOM_DOMAIN_CACHE_TTL_SECONDS` | `5` | 域名记录正/负缓存最大陈旧窗口 |
| `CUSTOM_DOMAIN_RESERVED_LABELS` | 内置默认 + 可追加 | 防止分配 `www/api/auth/admin/pay/callback/...` |

启动时必须 fail closed 校验：suffix 是无通配符的 DNS 名；main origin 是无 userinfo/query/fragment 的精确 `https` Origin；两者不能相同或互为专属 Host；TTL 为有上限的正整数。功能开关关闭时主站保留当前行为，专属域名入口由基础设施保持关闭/404。

基础设施职责：

- `yeschoy.io` 与 `*.yeschoy.io` 证书必须都覆盖；通配证书本身不覆盖 apex。
- apex `yeschoy.io` 在反向代理直接返回 `404`，应用层同时保留防御性拒绝。
- wildcard server block 必须保留外部 `Host`；不得让客户端直连应用端口。
- 仅配置实际反向代理 IP/CIDR 为 New API `TRUSTED_PROXIES`。
- 默认 server block 拒绝未知 SNI/Host；不信任客户端自行提供的 `X-Forwarded-Host`。

## 4. 数据模型

### 4.1 `custom_domains`

建议模型：

```text
id                bigint/int primary key
label             varchar(63) not null unique
owner_user_id     int not null, indexed, immutable after insert
active_owner_id   int nullable unique
enabled           bool not null default false
created_at        timestamp
updated_at        timestamp
disabled_at       timestamp nullable
```

约束与原因：

- `label` 只存小写 ASCII 一级标签，不复制完整 Host。
- `owner_user_id` 是所有权真相来源；不复制长期 `aff_code`。
- 启用时 `active_owner_id = owner_user_id`，停用时为 `NULL`。唯一索引在 SQLite、MySQL 与 PostgreSQL 中允许多个 `NULL`，可移植地保证“一位客户最多一个启用域名”。
- `label` 永久唯一；停用记录是墓碑，`owner_user_id` 不允许修改。
- 所有者账号禁用/删除不改变 `enabled`，页面继续服务；只暂停域名默认邀请归属。
- 显式执行 `domain disable` 才使域名不可访问并返回 `404`。

CLI 和模型层必须在同一事务内检查状态并写入 `enabled/active_owner_id/disabled_at`，数据库唯一索引作为最后防线。

### 4.2 `top_ups`

钱包充值订单新增：

```text
origin_host varchar(255) not null default ''
```

- 新订单保存可信请求 Host；主站订单可保存 `yeschoy.com` 或空值并按主站解释。
- 历史订单空值兼容为主站。
- 此字段只决定浏览器回跳，不参与验签、金额、支付渠道或入账判断。
- 订阅订单不修改。

### 4.3 `auth_flows`

不改表结构，扩展 JSON payload 与 Purpose：

- OAuth payload 增加 `origin_host`、`domain_id`、`attribution_source` 以及显式 `aff`/默认所有者上下文。
- 新增一次性 `domain_login_handoff` 与 `domain_bind_handoff` Purpose，TTL 固定 120 秒；停用竞态的主站 fallback ticket 使用独立 Purpose 和更短/相同 TTL。
- Token 继续只由浏览器持有，数据库只保存 HMAC 摘要，沿用原子消费。

## 5. Host 分类与请求上下文

当前 `main.go` 在全局中间件后直接安装全部 API/relay/web 路由，`router/web-router.go` 会为普通未知路径返回 SPA，尚无 Host allowlist。新增一个全局 Host 解析入口并在所有业务路由前运行；所有调用方只能消费其结构化结果，禁止各控制器自行拼接域名：

```text
MainHost       yeschoy.com
ApexHost       yeschoy.io                 -> 404
CustomHost     <label>.yeschoy.io active  -> attach domain context
DisabledHost   known but disabled         -> 404 (handoff fallback endpoint excepted)
UnknownHost    unassigned subdomain        -> 404
InvalidHost    malformed/port confusion    -> 400/404
```

规范化规则：

- 转小写、移除合法端口与末尾点；拒绝用户信息、路径、控制字符和多值 Host。
- 只允许一个标签加精确 suffix；不接受 `x.a.yeschoy.io`。
- 标签遵循 DNS ASCII 规则并检查保留名单。
- 不从 `X-Forwarded-Host` 推导客户身份。

运行时上下文建议包含：

```go
type DomainContext struct {
    Kind        DomainKind
    Host        string
    DomainID    int64
    OwnerUserID int
    Enabled     bool
}
```

域名记录使用短 TTL 正/负缓存，默认最大陈旧 5 秒；邀请归属时必须重新读取所有者当前状态，不能依赖缓存中的旧用户状态。

## 6. 邀请归属契约

共享一个 `ResolveRegistrationInviter`，密码注册与 OAuth 新用户创建不得各自实现规则：

```text
if explicit aff is non-empty:
    调用上游 GetUserIdByAffCode
    保留上游错误处理：查不到 -> inviter_id = 0
    不回退域名所有者
else if request is an enabled custom domain:
    重新读取 owner 用户
    owner status enabled -> inviter_id = owner_user_id
    owner disabled/deleted -> inviter_id = 0
else:
    inviter_id = 0（主站保持上游行为）
```

现有 `GetUserIdByAffCode` 未按 `status` 过滤；显式推广码仍完全沿用该语义。本任务只给“没有显式 aff”增加域名默认值。

密码注册在创建用户事务前解析。OAuth state 保存来源类型；如果来源是域名默认值，必须在 OAuth 真正创建新用户时再次检查域名与所有者状态。已有用户登录永不修改 `inviter_id`。

## 7. 浏览器 Session 与 OriginGuard

- 保留当前 `new_api_refresh` Host-only、`HttpOnly`、`Secure`、`SameSite=Strict` Cookie 与 `/api/user/auth` Path，不设置 `Domain=.yeschoy.io`。
- A、B、主站分别登录、刷新和退出；共享账户数据但不共享浏览器状态。
- Access Token 继续只保存在各 Origin 的前端内存。
- 当前 `SessionCookieOriginGuard` 已支持 TLS 直连的精确同源和静态 `SESSION_COOKIE_TRUSTED_URL`，但反向代理 HTTP 上游下 `Request.TLS=nil`，不能靠静态列表枚举动态专属域名。扩展为：DomainContext 已确认 active custom Host 时，只接受精确 `https://<host>` 的 Origin/Referer；不信任 `X-Forwarded-Proto`，也不使用 `*.yeschoy.io` 后缀放行。
- 显式停用域名后普通 refresh/logout 也不可用；所有者账号禁用但域名仍启用时，其他用户会话不受影响。

## 8. 认证流程

### 8.1 密码与 TOTP 2FA

密码登录和 TOTP/备用码完全保留上游：

- 2FA AuthFlow 仍为 5 分钟、用户/鉴权版本绑定、原子消费。
- 不增加发起域名字段或新的 2FA 分支。
- GitHub/Linux Do OAuth 不新增 TOTP 步骤。
- 启用/禁用 2FA 导致账号级 `auth_version` 变化并影响其他域名 Session，是保留的安全行为。

只新增 A/B/主站独立 Cookie 与专属域名回归测试。

### 8.2 OAuth state

从 A 创建 OAuth state：

1. Host 中间件确认 A 是有效域名。
2. 非空显式 `aff` 原样保存；为空时记录域名默认归属上下文。
3. A 设置名为 `__Host-yeschoy_oauth_binding` 的短时 OAuth browser-binding Cookie，属性固定为 Host-only、`Path=/`、`HttpOnly`、`Secure`、`SameSite=Strict`、`Max-Age=900`；OAuth payload 只保存该随机值的 purpose-separated HMAC，不保存明文。`__Host-` 前缀要求响应不得设置 `Domain`，由浏览器强制 Host 隔离。
4. payload 保存 `origin_host=a.yeschoy.io`。
5. GitHub/Linux Do 继续使用生产现有的 `yeschoy.com` 回调地址。

不得接受客户端 `return_url` 作为回跳真相。

### 8.3 OAuth 登录回调与一次性交接

当前前端 `/oauth/$provider` route 接收 provider callback，再从该页面同源请求 `/api/oauth/:provider`；后端 `HandleOAuth` 验证并消费 state、查找/创建用户后直接调用 `setupLogin`。`setupLogin` 在 API 请求 Host 上创建 `user_sessions`、写 Host-only Refresh Cookie并返回 AuthBundle。GitHub/Linux Do 授权 URL 都不携带动态 `redirect_uri`，Linux Do token exchange 又从 callback 请求 Host 重建 `redirect_uri`，因此生产固定 callback 必须保持 `yeschoy.com/oauth/{provider}`，其 API Cookie 也只属于主站。

主站回调完成 state/provider 校验、code exchange 与用户查找/创建。若原始 Host 是主站，保持上游 `setupLogin`；若是专属域名：

1. 不在主站写最终登录 Cookie。
2. 创建 `domain_login_handoff` AuthFlow，绑定用户、预期 auth version、目标 Host、登录方法、browser-binding HMAC 和 120 秒 TTL；后端 JSON 返回明确的 `action/target_origin/ticket` 分支，不伪装成 AuthBundle。
3. 主站现有 `/oauth/$provider` callback route 识别该分支并执行 `window.location.replace("https://a.yeschoy.io/oauth/handoff#ticket=...")`。ticket 只放 URL fragment，不进入 HTTP request、反向代理日志或 Referer。
4. A 的 `/oauth/handoff` 返回一个不加载主 SPA、分析脚本或第三方资源的最小 bridge 页面，并配置严格 CSP。页面第一时间读取并清除 fragment，然后同源 POST `{ticket}` 到 `/api/oauth/domain-handoff`；浏览器自动携带 A 在步骤 8.2 设置的 binding Cookie。
5. A 后端要求请求 Host、payload target、binding Cookie HMAC、预期 auth version 和 domain 状态全部匹配；先原子消费 ticket，再调用现有 `CreateLoginSessionAtAuthVersion` 创建 A Session。
6. A 后端写 Host-only Refresh Cookie，只返回成功/安全 fallback 结果，不把 Access/Refresh Token放入 bridge 页面状态。
7. handoff 页面 `window.location.replace("/")`。上游根路由现有 `beforeLoad -> bootstrapAuthentication -> /api/user/auth/refresh` 自动携带 A Cookie、获取标准 AuthBundle 并恢复内存 Access Token。

这里的 handoff API 是同一套 New API 新增的后端路由，不是额外服务。浏览器访问 A 的页面/API 时仍由同一个 New API 进程处理，但 HTTP 响应属于 A，因此未设置 `Domain` 的 Cookie 会成为 `a.yeschoy.io` Host-only Cookie。

browser-binding Cookie 防止攻击者把自己完成 OAuth 后得到的 ticket 发给另一浏览器，诱使对方登录攻击者账号。Cookie 不是登录凭据，只在 A 的 handoff POST 时证明“这是发起同一 OAuth 流程的浏览器”，支持多个 state 时应使用稳定短期 binding 或可并发的数据结构，不能让后一流程覆盖前一流程。

A、B 可以同时使用相同 Cookie 名 `__Host-yeschoy_oauth_binding`，因为浏览器实际按 `(name, host, path)` 区分 Cookie：A 的值只发给 `a.yeschoy.io`，B 的值只发给 `b.yeschoy.io`，两者互不覆盖。Cookie 名中的 `yeschoy` 只用于可读性，隔离属性来自 `__Host-`、Host-only 与 `Path=/`。

ticket 不得进入 query/path、Access/Refresh Token 不得进入任何交接 URL。handoff 页面/API 设置 `Cache-Control: no-store` 与严格 `Referrer-Policy`，日志必须脱敏 ticket；bridge 页面不得加载分析脚本，并在发起 API 请求前清除 fragment。

为避免“域名在 callback 后、消费前被停用”的竞态，已知停用域名只开放最小 handoff 页面/API。A 后端先验证 ticket 与 binding，但不创建 A Session；它消费原 ticket并签发只能由主站消费的短时 fallback ticket，然后页面 replace 到主站 handoff。其他路径仍 `404`。

不必为 handoff 重构整个 Session 服务为事务版本。按照上游现有 OAuth 顺序采用 fail-closed 语义：ticket 成功消费后再调用 `CreateLoginSessionAtAuthVersion`；若 Session 上限、版本变化或数据库错误导致创建失败，ticket 保持已消费，用户重新发起 OAuth。严禁先创建可用 Session 再尝试消费 ticket，以免并发重放产生多个有效 Session。

### 8.4 OAuth 账号绑定

绑定不创建新登录 Session。当前 bind callback 假定 popup 与 opener 同源，并要求 callback API 当场取得原 Session；固定主站 callback 与 A opener 不同源，必须改为两段确认：

1. A 创建的 state 继续绑定原 user、Session、provider、target Host 与 browser binding。
2. 主站 callback 没有 A 的登录态，不得绕过安全检查直接写绑定；它只完成 provider code exchange、provider 身份断言和重复绑定检查，消费原 OAuth state 后签发 `domain_bind_handoff`。
3. 主站 callback route 把 popup 导航到 `https://a.yeschoy.io/oauth/handoff#ticket=...`；A bridge 清除 fragment 后，用同源 `postMessage` 把非凭据 ticket 交给原 A opener。
4. A opener 使用自己内存中的 Bearer/Session 调用 A 同源 bind-handoff API；Access/Refresh Token 不进入 URL或跨窗口消息。
5. API 重新验证 active target Host、user、Session、auth version、provider 和 ticket，原子消费 ticket 后才写 provider binding。
6. popup/opener 缺失、用户/Session 不匹配、ticket 重放或目标域名停用均安全失败；不得在主站静默完成绑定。

### 8.5 OAuth 失败或取消

回调通过 state 中的可信 `origin_host` 返回安全错误码；不回显任意 provider URL。目标域名已显式停用时返回主站。错误/取消也消费原 OAuth state，防止重放。

## 9. 密码重置

本地基线当前以全局 `ServerAddress` 构建重置邮件链接。修改为：

- 从有效专属域名发起时，生成由服务端签名且带过期时间的 return context；签名至少绑定 purpose、origin Host、email/token 摘要和 expiry，TTL 不长于当前 10 分钟重置 token。
- 邮件链接先到 `yeschoy.com` 的固定重置分发端点；该端点验证签名后跳到原专属域名重置页。
- 原域名已显式停用则留在主站。
- 重置 email/token 的现有有效期、验证和 Session 撤销行为不变。
- 不接受客户端提供完整 URL；只允许服务端解析出的 Host。缺少 return context 的历史主站链接继续落主站；存在但签名无效/过期的 context 直接失败，不能降级信任其中 Host。

## 10. 钱包充值

### 10.1 易支付

创建订单时保存 `origin_host`：

- `notify_url` 继续固定指向 `yeschoy.com`，由现有签名验证与 `RechargeEpay` 幂等事务入账。
- `return_url` 改为 `yeschoy.com` 的新 ePay browser-return handler。
- handler 验证易支付参数，按 `trade_no` 读取 `top_ups.origin_host`，然后跳到对应 `/usage-logs`。
- handler 可以调用同一幂等结算函数，但系统不能依赖浏览器访问才能到账。
- 目标域名已显式停用/未知时回主站。

### 10.2 Stripe

创建 Checkout 前生成 reference，并保存 `origin_host`：

- 专属域名请求的客户端 `success_url/cancel_url` 不作为信任来源。
- 服务端生成固定主站 return handler URL，携带 `trade_no` 与结果类型。
- return handler 只按数据库订单选择目标并跳转，不改变余额或支付状态。
- Stripe Webhook 继续验签并调用现有幂等充值逻辑，是到账权威。
- 目标域名已显式停用/未知时回主站。

主站发起的充值保持现有默认路径。订阅套餐相关控制器、订单和回跳不修改。

## 11. 管理 CLI

不开发管理 UI。沿用当前 `new-api plugin ...` 顶层命令风格，新增 `new-api domain ...`：

```text
new-api domain assign <label> --owner-user-id <id>
new-api domain enable <label>
new-api domain disable <label>
new-api domain show <label>
new-api domain list [--enabled|--disabled]
```

规则：

- `assign` 校验用户存在、标签格式、保留名、label 永久唯一和 owner 当前无其他启用域名。
- 禁用不删除记录；启用只能恢复原 owner。
- owner 账号状态不自动更改域名 `enabled`。
- 每次变更输出结构化审计日志且不打印凭据/DSN。
- CLI 使用与 HTTP 相同的领域服务，但只初始化 env/logger/主数据库和所需配置，不启动 HTTP server、后台任务、Redis 或完整应用生命周期。不鼓励裸 SQL；紧急 SQL 需人工审核且接受最多缓存 TTL 的生效延迟。

## 12. 安全属性

必须保持：

- 无开放重定向：所有目标 Host 来自域名表、OAuth state、订单或服务端签名上下文。
- 无 Host header poisoning：只接受规范化主站/已分配域名；后端端口不对公网暴露。
- 邀请归属一致：显式 aff 走上游；域名默认归属在注册完成时重新检查 owner 状态。
- OAuth state 与 handoff ticket 短时、HMAC 摘要持久化、用途绑定、单次消费。
- Refresh Cookie Host-only；不在 URL、日志或跨窗口消息传递 Access/Refresh Token。
- 易支付和 Stripe 服务端回调继续验签；浏览器回跳不作为到账凭证。
- 新公共 callback/handoff 端点使用 CriticalRateLimit/DisableCache，并对 ticket/trade_no 日志脱敏。

## 13. 兼容、迁移与回滚

### 兼容

- 功能开关关闭时，`yeschoy.com` 行为与上游一致。
- `top_ups.origin_host=''` 的历史订单按主站处理。
- OAuth payload 新字段可选，旧 state 缺失 origin 时按主站处理。
- 现有显式 aff、TOTP 2FA、Session 限额和主站支付保持语义。
- Passkey 与订阅支付不在修改面。

### 发布顺序

1. 以本地 `d68bc3ad...` 为实现基线，并确认生产 image digest/commit、数据库、主题、代理与 OAuth callback 实际路径；若生产与本地不一致，先重新做差异评审。
2. 发布数据库兼容迁移与功能开关，默认关闭。
3. 发布应用补丁并完成主站回归。
4. 配置 apex/wildcard DNS、TLS、Nginx 与精确代理信任。
5. 用 CLI 分配一个内部试点域名。
6. 开启功能，完成密码/OAuth/2FA/易支付/Stripe 端到端验收。
7. 扩大客户域名范围。

### 回滚

- 关闭 `CUSTOM_DOMAIN_ENABLED`，停止 wildcard 入口或把 wildcard 返回维护页/404。
- 不删除数据库列和墓碑记录；旧应用可忽略新增表/列。
- 服务端支付通知继续走主站，不因专属域名回滚影响入账。
- 回滚前等待或引导 10 分钟 OAuth state 与支付浏览器回跳窗口，保留主站 fallback handler 至所有在途流程过期。

## 14. 方案取舍

| 方案 | 结论 | 原因 |
|---|---|---|
| 纯 DNS/Nginx | 拒绝 | 无法保证邀请默认值、OAuth 原域恢复和订单回跳 |
| 外置应用感知网关 | 拒绝 | New API 零修改但增加 Cookie/Origin/支付状态安全边界与运维组件 |
| 每客户独立部署 | 拒绝 | 与共享系统目标冲突，运维与数据一致性成本高 |
| OAuth 动态直回每个子域 | 拒绝 | 依赖 provider wildcard/多应用，Linux Do redirect URI 脆弱 |
| 最小 New API 补丁 | 采用 | 业务状态与用户、AuthFlow、订单同库，测试与排障边界最清楚 |

## 15. 证据来源

- 本地实现基线与逐项锚点：`research/local-baseline.md`（commit `d68bc3ad...`）。
- 外部历史研究与 OAuth/WebAuthn 资料：`research/upstream-new-api.md`。
- GitHub OAuth redirect 安全：[GitHub Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)。
