# 多主域名、专属推广域名与回调链路技术设计

## 1. 设计结论

采用“最小修改 New API”的单体内聚方案：

- `yeschoy.com` 与 `yeschoy.pro` 是平级应用入口，完整共享后端数据与本任务覆盖的业务能力；两域之间不做 canonical 跳转。
- `yeschoy.com` 继续作为 OAuth 固定回调、支付服务端通知及失效 fallback 入口；这只是技术职责，不赋予产品层级。
- `*.yeschoy.io` 通过通配 DNS/TLS 与反向代理进入同一套 New API。
- 主域 allowlist 与推广 suffix 同时装入同一个 Host resolver；请求按精确主 Host 或推广子域分类，不提供二选一运行模式。
- New API 新增专属域名表、运行时 Host 解析、管理员 CLI、邀请默认值、OAuth 跨域交接和钱包充值回跳。
- 不引入应用感知网关或新的 Redis 依赖；复用现有数据库、`auth_flows`、登录 Session 与 `top_ups`。
- 所有入口共享用户、余额、订单、API Key 与权限；浏览器 Refresh Cookie 保持 Host-only，不做跨域 SSO。
- 本任务不处理多域名 Passkey、订阅套餐购买或客户白标 UI；TOTP 2FA 保持上游语义。

本轮用户复核明确将 Passkey 审查项延期到后续任务：当前路由与登录状态标志只排除 `Custom`，不保证 `.pro` 等非 callback `Main` 的 Passkey 入口已隐藏。本任务不调整该行为，也不将其表述为已经支持或验证多 RP ID。

原始设计以 commit `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db` 为基线；单推广域实现已落地，当前多主域缺陷按 2026-09-03 分支代码重新核对并记录在 `research/local-baseline.md`。`research/upstream-new-api.md` 只保留为外部历史研究。生产 image digest/commit、数据库类型、节点/Redis 拓扑、反向代理和第三方平台配置仍需在发布前只读核对。

## 2. 总体架构

```text
                         ┌──────────────────────────┐
yeschoy.com ────────────▶│                          │
yeschoy.pro ────────────▶│                          │
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
yeschoy.pro ──▶ GitHub / Linux Do ─▶ yeschoy.com OAuth callback
      ▲                                         │
      └───────── one-time origin handoff ───────┘

a.yeschoy.io ─▶ GitHub / Linux Do ─▶ yeschoy.com OAuth callback
       ▲                                      │
       └──────── one-time domain handoff ─────┘

yeschoy.pro ──▶ 易支付 / Stripe ─▶ yeschoy.com callback/webhook
      ▲                                      │
      └──────── DB-backed browser return ────┘

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
| `CUSTOM_DOMAIN_MAIN_ORIGIN` | `https://yeschoy.com` | 单一技术 callback/notify/fallback Origin；保留现有配置名与兼容语义 |
| `CUSTOM_DOMAIN_MAIN_ORIGINS` | `https://yeschoy.com,https://yeschoy.pro` | 完整、平级的主域名 Origin allowlist；为空时兼容性回退为仅 `MAIN_ORIGIN` |
| `CUSTOM_DOMAIN_CACHE_TTL_SECONDS` | `5` | 域名记录正/负缓存最大陈旧窗口 |
| `CUSTOM_DOMAIN_RESERVED_LABELS` | 内置默认 + 可追加 | 防止分配 `www/api/auth/admin/pay/callback/...` |

启动时必须 fail closed 校验：suffix 是无通配符的 DNS 名；单数/复数 main origins 均为无 userinfo/query/fragment 的精确 `https` Origin；非 callback 平级主域使用标准 HTTPS 端口，避免 hostname-based Host 上下文在回跳时丢失端口；主域名 Host 去重后均位于推广 suffix 之外；`CUSTOM_DOMAIN_MAIN_ORIGINS` 必须包含 `CUSTOM_DOMAIN_MAIN_ORIGIN`；所有主 Origin 必须逐项出现在 `SESSION_COOKIE_TRUSTED_URL`；TTL 为有上限的正整数。功能开关关闭时保留上游行为，专属域名入口由基础设施保持关闭/404。

主域列表不赋予顺序语义，除 `CUSTOM_DOMAIN_MAIN_ORIGIN` 指定的 callback/fallback Host 外，其余成员完全同构。实现不得出现针对 `yeschoy.pro` 的业务分支；`.pro` 只是首个非 callback 主域测试样例。列表设置合理上限以防异常环境变量放大启动成本，未来在上限内增加主域不需要代码或数据库迁移。

单数 callback Origin 与复数应用主域列表同时生效，不互相覆盖；Compose 中复数默认留空，由应用回退单数。`SESSION_COOKIE_TRUSTED_URL` 是 refresh/logout 的精确浏览器 Origin 信任列表，不是 Host 路由表或父域 Cookie 配置；推广 apex `yeschoy.io` 不需要加入，已启用的 `ai.yeschoy.io` 等推广域由 DomainContext 动态校验自身 HTTPS Origin。Healthcheck 对有效主域逐个发送本机 HTTP 请求并设置 Host，仅验证本机应用路由，不验证公网 DNS/TLS。完整配置、错误矩阵与断言以 [code-spec](../../spec/backend/custom-domain-callbacks.md) 为准。

基础设施职责：

- `yeschoy.com` 与 `yeschoy.pro` 都配置独立 TLS 与相同应用上游；不得把 `.pro` 301/302 canonical 到 `.com`。
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

- 新订单保存可信请求 Host：`.pro` 和推广子域必须保存原 Host；`.com` 可保存 `yeschoy.com` 或空值。
- 历史订单空值兼容为技术 fallback `yeschoy.com`。
- 此字段只决定浏览器回跳，不参与验签、金额、支付渠道或入账判断。
- 订阅订单不修改。

### 4.3 `auth_flows`

不改表结构，扩展 JSON payload 与 Purpose：

- OAuth payload 增加 `origin_host`、可选 `domain_id`、`attribution_source` 以及显式 `aff`/默认所有者上下文。`domain_id=0` 且 `origin_host` 位于主域名 allowlist 时表示平级主域来源；正数 ID 表示推广域。
- 新增一次性 `domain_login_handoff` 与 `domain_bind_handoff` Purpose，TTL 固定 120 秒；停用竞态的主站 fallback ticket 使用独立 Purpose 和更短/相同 TTL。
- Token 继续只由浏览器持有，数据库只保存 HMAC 摘要，沿用原子消费。

## 5. Host 分类与请求上下文

当前 `main.go` 在全局中间件后直接安装全部 API/relay/web 路由，`router/web-router.go` 会为普通未知路径返回 SPA，尚无 Host allowlist。新增一个全局 Host 解析入口并在所有业务路由前运行；所有调用方只能消费其结构化结果，禁止各控制器自行拼接域名：

```text
MainHost       yeschoy.com | yeschoy.pro    -> peer application context
CallbackHost   yeschoy.com                  -> fixed provider dispatcher only
ApexHost       yeschoy.io                 -> 404
CustomHost     <label>.yeschoy.io active  -> attach domain context
DisabledHost   known but disabled         -> 404 (handoff fallback endpoint excepted)
UnknownHost    unassigned subdomain        -> 404
InvalidHost    malformed/port confusion    -> 400/404
```

`CallbackHost` 不是新的 `DomainKind`，而是 `CUSTOM_DOMAIN_MAIN_ORIGIN` 对应的单一技术角色；`.com` 与 `.pro` 请求都保持 `Main` kind。所有 provider callback、reset dispatcher 与 payment return handler 必须额外校验当前 Host 精确等于 callback Host，不能因其属于主域 allowlist 就放行。

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

Resolver 内部将单个 `mainHost` 改为不可变 `mainHosts` 集合，并保留 `callbackHost`。新增共享的受信来源解析契约，供 OAuth、密码重置和支付回跳复用：

```text
ResolveStoredOrigin(domain_id, origin_host):
  domain_id == 0 -> origin_host 必须是 mainHosts 成员，返回 active
  domain_id > 0  -> 按 custom_domains 重建 Host，常量时间比对并返回 enabled
  其他组合       -> invalid
```

这样 `.pro` 不需要伪造推广域 ID，也不会获得推广 owner/邀请语义；推广域停用仍可触发 `.com` fallback。主域名是静态发布配置，移出 allowlist 属于运维下线并会立即失去应用访问能力，不设计动态停用交接。

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
- `.com`、`.pro`、A、B 分别登录、刷新和退出；共享账户数据但不共享浏览器状态。
- Access Token 继续只保存在各 Origin 的前端内存。
- `.com` 与 `.pro` 均通过静态 `SESSION_COOKIE_TRUSTED_URL` 精确放行；启动校验要求配置完整。反向代理 HTTP 上游下 `Request.TLS=nil`，动态推广域不能靠静态列表枚举，因此 DomainContext 已确认 active custom Host 时，只接受精确 `https://<host>` 的 Origin/Referer；不信任 `X-Forwarded-Proto`，也不使用 `*.yeschoy.io` 后缀放行。
- 显式停用域名后普通 refresh/logout 也不可用；所有者账号禁用但域名仍启用时，其他用户会话不受影响。

## 8. 认证流程

### 8.1 密码与 TOTP 2FA

密码登录和 TOTP/备用码完全保留上游：

- 2FA AuthFlow 仍为 5 分钟、用户/鉴权版本绑定、原子消费。
- 不增加发起域名字段或新的 2FA 分支。
- GitHub/Linux Do OAuth 不新增 TOTP 步骤。
- 启用/禁用 2FA 导致账号级 `auth_version` 变化并影响其他域名 Session，是保留的安全行为。

新增 `.com`/`.pro`/A/B 独立 Cookie 回归；多域名 Passkey 明确不在本任务范围。

### 8.2 OAuth state

从 `.pro` 或 A 创建 OAuth state：

1. Host 中间件确认请求是配置中的主域名或启用中的推广域。
2. 非空显式 `aff` 原样保存；只有推广域在 aff 为空时记录默认归属上下文，`.pro` 的 `domain_id=0` 且无默认 inviter。
3. 当发起 Host 与 callback Host 不同时（`.pro` 或 A），发起 Host 设置名为 `__Host-yeschoy_oauth_binding` 的短时 OAuth browser-binding Cookie，属性固定为 Host-only、`Path=/`、`HttpOnly`、`Secure`、`SameSite=Strict`、`Max-Age=900`；OAuth payload 只保存该随机值的 purpose-separated HMAC，不保存明文。
4. payload 保存可信 `origin_host`；`.pro` 保存 `domain_id=0`，A 保存正数推广域 ID。`.com` 同 Host callback 保留直接登录兼容路径。
5. GitHub/Linux Do 继续使用生产现有的 `yeschoy.com` 回调地址。

不得接受客户端 `return_url` 作为回跳真相。

### 8.3 OAuth 登录回调与一次性交接

当前前端 `/oauth/$provider` route 接收 provider callback，再从该页面同源请求 `/api/oauth/:provider`；后端 `HandleOAuth` 验证并消费 state、查找/创建用户后直接调用 `setupLogin`。`setupLogin` 在 API 请求 Host 上创建 `user_sessions`、写 Host-only Refresh Cookie 并返回 AuthBundle。GitHub/Linux Do 授权 URL 都不携带动态 `redirect_uri`，Linux Do token exchange 又从 callback 请求 Host 重建 `redirect_uri`，因此生产固定 callback 必须保持 `yeschoy.com/oauth/{provider}`，其 API Cookie 也只属于 `.com`。

固定 `.com` 回调完成 state/provider 校验、code exchange 与用户查找/创建。若原始 Host 是 `.com`，保持上游 `setupLogin`；若原始 Host 是 `.pro` 或推广域：

1. 不在 `.com` 写最终登录 Cookie。
2. 创建 `domain_login_handoff` AuthFlow，绑定用户、预期 auth version、目标 Host、登录方法、browser-binding HMAC 和 120 秒 TTL；后端 JSON 返回明确的 `action/target_origin/ticket` 分支，不伪装成 AuthBundle。
3. `.com` 的 `/oauth/$provider` callback route 识别该分支并跳到 state 中已验证的 `.pro` 或 A `/oauth/handoff#ticket=...`。ticket 只放 URL fragment，不进入 HTTP request、反向代理日志或 Referer。
4. 目标 Host 的 `/oauth/handoff` 返回最小 bridge 页面，读取并清除 fragment，然后同源 POST `{ticket}` 到 `/api/oauth/domain-handoff`；浏览器携带目标 Host 在步骤 8.2 设置的 binding Cookie。
5. 后端要求请求 Host、payload target、binding Cookie HMAC、预期 auth version 和目标状态全部匹配。`.pro` 通过主域 allowlist 验证且 `domain_id=0`；推广域通过数据库 ID、重建 Host 与 enabled 状态验证。
6. 先原子消费 ticket，再调用现有 `CreateLoginSessionAtAuthVersion` 创建目标 Host Session，并写目标 Host-only Refresh Cookie；Access/Refresh Token 不进入 bridge 状态。
7. handoff 页面 `window.location.replace("/")`，由现有 `bootstrapAuthentication` 在该 Host refresh 并恢复内存 Access Token。

这里的 handoff API 仍由同一个 New API 进程处理。响应属于实际目标 Host，因此 `.pro`、A、B 各自得到独立 Host-only Cookie；`.com` 不会因为承担 callback 而获得其登录状态。

browser-binding Cookie 防止攻击者把自己完成 OAuth 后得到的 ticket 发给另一浏览器，诱使对方登录攻击者账号。Cookie 不是登录凭据，只在目标 Host 的 handoff POST 时证明“这是发起同一 OAuth 流程的浏览器”，支持多个 state 时应使用稳定短期 binding，不能让后一流程覆盖前一流程。

`.pro`、A、B 可以同时使用相同 Cookie 名 `__Host-yeschoy_oauth_binding`，因为浏览器按 `(name, host, path)` 区分 Cookie，彼此不会覆盖。Cookie 名中的 `yeschoy` 只用于可读性，隔离属性来自 `__Host-`、Host-only 与 `Path=/`。

ticket 不得进入 query/path、Access/Refresh Token 不得进入任何交接 URL。handoff 页面/API 设置 `Cache-Control: no-store` 与严格 `Referrer-Policy`，日志必须脱敏 ticket；bridge 页面不得加载分析脚本，并在发起 API 请求前清除 fragment。

为避免“推广域在 callback 后、消费前被停用”的竞态，已知停用推广域只开放最小 handoff 页面/API。中间件缓存可能仍短暂显示启用，消费端必须先匹配签名 Host/domain ID，再以新建 resolver 读取的实时 enabled 状态为准，不能要求缓存 `Kind` 与实时 `Kind` 相等。实时状态为停用时不创建该 Host Session，消费原 ticket并签发只能由 `.com` callback Host 消费的短时 fallback ticket。`.pro` 是静态主域；若它在流程中被移出 allowlist，请求会被 Host guard 拒绝，浏览器需重新从仍有效入口登录。

不必为 handoff 重构整个 Session 服务为事务版本。按照上游现有 OAuth 顺序采用 fail-closed 语义：ticket 成功消费后再调用 `CreateLoginSessionAtAuthVersion`；若 Session 上限、版本变化或数据库错误导致创建失败，ticket 保持已消费，用户重新发起 OAuth。严禁先创建可用 Session 再尝试消费 ticket，以免并发重放产生多个有效 Session。

### 8.4 OAuth 账号绑定

绑定不创建新登录 Session。当前 bind callback 假定 popup 与 opener 同源，并要求 callback API 当场取得原 Session；固定 `.com` callback 与 `.pro`/A opener 不同源，必须使用两段确认：

1. `.pro` 或 A 创建的 state 继续绑定原 user、Session、provider、target Host 与 browser binding。
2. `.com` callback 没有发起 Host 的登录态，不得绕过安全检查直接写绑定；它只完成 provider code exchange、provider 身份断言和重复绑定检查，消费原 OAuth state 后签发 `domain_bind_handoff`。
3. `.com` callback route 把 popup 导航回已验证目标 Host 的 bridge；bridge 清除 fragment 后，用同源 `postMessage` 把非凭据 ticket 交给原 opener。
4. opener 使用自己内存中的 Bearer/Session 调用目标 Host 同源 bind-handoff API；Access/Refresh Token 不进入 URL 或跨窗口消息。
5. API 重新验证 active target Host、user、Session、auth version、provider 和 ticket，原子消费 ticket 后才写 provider binding。
6. popup/opener 缺失、用户/Session 不匹配、ticket 重放、主域不在 allowlist 或推广域已停用均安全失败；不得在 `.com` callback 静默完成绑定。

### 8.5 OAuth 失败或取消

回调从服务端 AuthFlow 中解析并验证 `origin_host`，使用既有 typed action 返回原域，不接受客户端任意 URL。有效 `.pro`/推广来源的登录失败返回 `domain_oauth_return`；绑定失败通过 `domain_bind_return(result=failed|cancelled|target_unavailable)` 回原域最小 bridge 通知 opener。已停用推广域的登录失败留在 callback 主域，绑定失败可通过已知停用域的最小 bridge 返回 `target_unavailable`；目标不能被可信解析时不构造任意跨域地址。

错误返回与 state 消费是两个独立契约，保留各阶段现有消费时点：

- provider disabled、token exchange/user-info 失败，以及绑定身份已占用检查失败：该分支不消费 state，但仍应向可信原域返回失败 action。
- 显式 provider callback `error`（含取消）进入处理分支、绑定目标推广域停用、原绑定 Session 失效：先消费 state，再返回失败 action。
- 登录取得 provider 身份后先消费 state，再查找/创建用户；注册策略、用户封禁等后续失败保持已消费。登录/绑定 handoff 签发失败也不恢复此前消费的 state。
- state 无效、过期、重放或原子消费失败：保留拒绝，不为错误回程绕过校验或创建 Session/绑定。

## 9. 密码重置

本地基线当前以全局 `ServerAddress` 构建重置邮件链接。修改为：

- 从 `.pro` 或有效推广域发起时，生成由服务端签名且带过期时间的 return context；签名至少绑定 purpose、origin Host、可选 domain ID、email/token 摘要和 expiry，TTL 不长于当前 10 分钟重置 token。
- 邮件链接先到 `yeschoy.com` 的固定重置分发端点；端点必须校验当前 Host 精确等于 callback Host，再通过共享受信来源解析器跳到 `.pro` 或原推广域。
- `.com` 自身发起的重置在功能开启时也以 `CUSTOM_DOMAIN_MAIN_ORIGIN` 构造链接，不能因全局 `ServerAddress` 指向其他入口而串域；功能关闭时继续使用 legacy `ServerAddress`。
- 推广域已显式停用时留在 `.com`；配置中的 `.pro` 始终返回 `.pro`。
- 重置 email/token 的现有有效期、验证和 Session 撤销行为不变。
- 不接受客户端提供完整 URL；只允许服务端解析出的 Host。缺少 return context 的历史链接继续按 `.com` 处理；存在但签名无效/过期的 context 直接失败，不能降级信任其中 Host。

## 10. 钱包充值

### 10.1 易支付

创建订单时保存 `origin_host`：

- `.pro` 与推广域订单保存经过 DomainContext 验证的实际 Host；`.com` 可继续保存空值。
- `notify_url` 继续固定指向 `yeschoy.com`，由现有签名验证与 `RechargeEpay` 幂等事务入账。
- `return_url` 改为 `yeschoy.com` 的新 ePay browser-return handler。
- handler 先要求请求 Host 精确等于 callback Host，再验证易支付参数，按 `trade_no` 读取 `top_ups.origin_host`，通过共享受信来源解析器跳到 `.pro`、有效推广域或 fallback `.com` 的 `/usage-logs`。
- handler 可以调用同一幂等结算函数，但系统不能依赖浏览器访问才能到账。
- 目标域名已显式停用/未知时回主站。

### 10.2 Stripe

创建 Checkout 前生成 reference，并保存 `origin_host`：

- `.pro` 与推广域请求的客户端 `success_url/cancel_url` 不作为信任来源，服务端保存经过验证的实际 Host。
- 服务端生成固定主站 return handler URL，携带 `trade_no` 与结果类型。
- return handler 只在 callback Host 接收请求，并按数据库订单与共享受信来源解析器选择 `.pro`、有效推广域或 fallback `.com`；它不改变余额或支付状态。
- Stripe Webhook 继续验签并调用现有幂等充值逻辑，是到账权威。
- 目标域名已显式停用/未知时回主站。

`.com` 发起的充值保持现有默认路径；`.pro` 作为平级入口持久化并恢复原 Host。订阅套餐相关控制器、订单和回跳不修改。

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
- 无 Host header poisoning：只接受规范化且在主域 allowlist 中的 Host，或已分配推广域；后端端口不对公网暴露。
- callback 角色单一：OAuth callback、密码重置 dispatcher、易支付 return/notify 与 Stripe return/webhook 使用固定 `.com` URL；应用端点再精确校验 callback Host，不能把任意 Main kind 当 callback。
- 邀请归属一致：显式 aff 走上游；域名默认归属在注册完成时重新检查 owner 状态。
- OAuth state 与 handoff ticket 短时、HMAC 摘要持久化、用途绑定、单次消费。
- Refresh Cookie Host-only；不在 URL、日志或跨窗口消息传递 Access/Refresh Token。
- 易支付和 Stripe 服务端回调继续验签；浏览器回跳不作为到账凭证。
- 新公共 callback/handoff 端点使用 CriticalRateLimit/DisableCache，并对 ticket/trade_no 日志脱敏。

## 13. 兼容、迁移与回滚

### 兼容

- 功能开关关闭时，`yeschoy.com` 行为与上游一致。
- `CUSTOM_DOMAIN_MAIN_ORIGINS` 缺失/空值时自动退化为仅包含 `CUSTOM_DOMAIN_MAIN_ORIGIN`，兼容现有单主域部署。
- `top_ups.origin_host=''` 的历史订单按技术 fallback `.com` 处理；已有推广域 Host 仍按数据库状态解析。
- OAuth payload 新字段可选，旧 state 缺失 origin 时按 `.com` callback 本地流程处理。
- 现有显式 aff、TOTP 2FA、Session 限额和支付入账语义保持不变。
- 多域名 Passkey 与订阅支付不在修改面。

### 发布顺序

1. 记录开始编码前的实际 `HEAD`/工作树，并确认生产 image digest/commit、数据库、主题、代理与 OAuth callback 实际路径；若生产与本地不一致，先重新做差异评审。
2. 发布数据库兼容迁移与功能开关，默认关闭。
3. 发布应用补丁并完成 `.com`、`.pro` 两个平级主域回归。
4. 配置 apex/wildcard DNS、TLS、Nginx 与精确代理信任。
5. 用 CLI 分配一个内部试点域名。
6. 开启功能，完成密码/OAuth/2FA/易支付/Stripe 端到端验收。
7. 扩大客户域名范围。

### 回滚

- 关闭 `CUSTOM_DOMAIN_ENABLED`，停止 wildcard 入口或把 wildcard 返回维护页/404。
- 不删除数据库列和墓碑记录；旧应用可忽略新增表/列。
- 服务端支付通知继续走 `.com`，不因推广域回滚影响入账。
- 回滚新增复数配置时可移除 `CUSTOM_DOMAIN_MAIN_ORIGINS`，系统恢复单主域；回滚前等待或引导 10 分钟 OAuth state 与支付浏览器回跳窗口，并保留 `.com` fallback handler 至所有在途流程过期。

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
