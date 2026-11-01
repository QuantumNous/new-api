# Design：合作方服务端密钥接入（子账号首次使用自动开户）

需求与决策见 `prd.md`（D1–D22）。本文给出边界、数据模型、接口契约、关键流程和取舍。所有路径、函数名以 2026-10-28 的 `main`（`88e0b8077`）为准。

## 1. 边界

| 层 | 新增 | 复用（不改语义） |
|---|---|---|
| 认证 | `client_credentials` 授权、服务端密钥（最多 2 把）、服务端访问令牌、IP 白名单 | `partner_oauth_clients`（身份与启停）、`/oauth/token` 入口、`PartnerOAuthClientAuthLimited` 失败限流 |
| 账号 | `partner_accounts` 映射、子账号创建函数 | `users`、`recordWalletRefundCreditTx`（零额开户事件）、Key（`tokens`） |
| 充值 | `partner_account_payment_orders`、ZPay `mapi.php` 下单 | `InsertOnlineTopUpTx`、`EpayNotify` 入账、返现排除 `partner_oauth`、金额与容量校验函数 |
| 查询 | 消耗明细（白名单字段） | `logs` 表 `idx_user_id_id` 索引 |
| 审计 | 新 action | `partner_oauth_authorization_logs` |

**不改的东西：**
- 现有 OAuth 授权码流程和 `/api/integrations/v1/*`；
- `partner_oauth_payment_orders` 的约束；
- `partner_oauth_clients` 的表结构。

本任务只**新增表**，不对已有表做 `ALTER`。

## 2. 数据模型（全部新表）

### 2.1 `partner_server_configs`（每个合作方一行，与 client 一对一）

| 字段 | 说明 |
|---|---|
| `client_id` varchar(64) unique | 对应 `partner_oauth_clients.client_id` |
| `enabled` bool | 服务端模式开关。布尔默认值不写进 GORM tag，由代码设置（AGENTS 7.4） |
| `account_group` varchar(64) | 子账号的用户分组。启用时校验该分组存在于 `GroupRatio` |
| `ip_allowlist` text | JSON 数组，元素为 IP 或 CIDR；为空表示不限制 |
| `max_accounts` int | 默认 100000 |
| `accounts_per_minute` int | 默认 60 |
| `suspended_at` bigint | 合作方停用时间；0 表示正常 |
| `created_at` / `updated_at` | |

把配置放在单独的表里，而不是给 `partner_oauth_clients` 加列，是为了让线上已有的表零迁移。开户时会对这一行加行锁（`lockForUpdate`），用来串行检查上限和速率。

### 2.2 `partner_server_secrets`

| 字段 | 说明 |
|---|---|
| `id` | |
| `client_id` varchar(64) index | |
| `secret_hash` char(64) unique | SHA-256（与现有 client secret 同一方式；密钥本身是 32 字节随机数，属于高熵密钥） |
| `status` varchar(16) | `active` / `revoked` |
| `created_at` / `revoked_at` | |

- 同一个合作方最多 2 把 `active` 密钥；签发第 3 把时返回 409，要求先吊销一把。
- 密钥格式为 `pss_` 加 64 位十六进制，只在签发时展示一次。
- **为什么不复用 OAuth 的 client secret：** 那把密钥供授权码流程使用，可能配置在别的系统里。两者分开后，一边泄露不会牵连另一边。

### 2.3 `partner_server_tokens`

| 字段 | 说明 |
|---|---|
| `token_hash` char(64) unique | |
| `client_id` varchar(64) index | |
| `secret_id` int64 | 签发时使用的密钥。吊销密钥时，同时吊销由它签发的令牌 |
| `expires_at` bigint index | 1 小时 |
| `created_at` | |

- 令牌格式为 `pst_` 加随机串，不发刷新令牌。
- 过期 24 小时后，由现有的过期令牌清理任务一并删除（新增一个同类清理函数）。

### 2.4 `partner_accounts`

| 字段 | 说明 |
|---|---|
| `id` | |
| `client_id` varchar(64) | |
| `external_user_id` varchar(64) | 原文，仅用于展示和返回 |
| `external_user_id_hash` char(64) | `sha256(external_user_id)` 的小写十六进制。唯一索引建在 `(client_id, external_user_id_hash)` 上 |
| `user_id` int unique | |
| `status` varchar(16) | `active` / `disabled`（合作方通过接口停用）/ `admin_disabled`（管理员停用） |
| `suspended_by_partner` bool | 合作方停用时，由我们禁用的账号标记为 true；恢复时只处理这些账号 |
| `token_id` int | 当前 Key |
| `created_at` / `updated_at` | |

**为什么唯一键用哈希：** MySQL 默认的排序规则不区分大小写，而 D18 要求区分大小写。如果写成 MySQL 专用的 `COLLATE utf8mb4_bin`，SQLite 和 PostgreSQL 会建表失败。小写十六进制的哈希在三种数据库下比较结果都一致，所以把唯一键建在哈希上，原文另存一列。

### 2.5 `partner_account_payment_orders`

| 字段 | 说明 |
|---|---|
| `id` | |
| `client_id` varchar(64) | `(client_id, idempotency_key_hash)` 唯一 |
| `idempotency_key_hash` char(64) | |
| `request_hash` char(64) | `external_user_id`、`amount`、`payment_method` 的摘要 |
| `partner_account_id` int64 index | |
| `user_id` int | |
| `top_up_id` int unique | |
| `requested_amount` bigint | |
| `qr_code` text | ZPay 返回的二维码内容，用于幂等重放 |
| `pay_url` text | ZPay 返回的支付链接（没有二维码时使用） |
| `created_at` bigint | 与 `partner_account_id` 组成索引，用于限流计数 |

`qr_code` 和 `pay_url` 都是收款链接，不写进任何日志，只通过接口返回给合作方。

## 3. 认证

### 3.1 换取令牌

```text
POST /oauth/token
Authorization: Basic base64(client_id:server_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=partner:accounts
```

- 在现有 `PartnerOAuthToken` 的 grant 分支里新增 `client_credentials`（RFC 6749 §4.4）。这个分支**不调用** `authenticatePartnerOAuthClient`，改用服务端密钥逐把比对：对全部 `active` 密钥用 `hmac.Equal` 比较；客户端不存在时与一个占位哈希比较，保证耗时一致。
- 检查顺序：
  1. 合作方存在、client 已启用、服务端模式已启用、未处于停用状态；
  2. 请求 IP 在白名单内（IP 由 `c.ClientIP()` 取得，依赖网关的可信代理配置，交付说明里要写明）；
  3. 密钥匹配。

  任何一项失败都统一返回 `401 invalid_client`，并计入 `POA-CLIENT-FAIL` 失败限流。
- 成功返回 `{"access_token","token_type":"Bearer","expires_in":3600,"scope":"partner:accounts"}`。
- `scope` 只接受 `partner:accounts`。这个 scope 不出现在 OAuth 同意页上，也不能通过授权码流程申请。

### 3.2 `PartnerServerBearer` 中间件

- 只接受 Header 里的 Bearer；Query 里带 `access_token` 时返回 400。
- 查令牌：未过期；签发它的密钥仍是 `active`；client 已启用；服务端模式已启用且未停用；请求 IP 在白名单内。白名单在每个请求上都检查，所以令牌被盗后从别的 IP 也用不了。
- 按 client 限流：每分钟 3000 次（常量，后续需要再做成可配置）。
- **IP 白名单是可选的**（2026-10-28 用户决定，见 `security-review.md` H1）：
  - 为空时不限制来源；后台在白名单为空时显示风险提示，接入文档强烈建议配置。
  - 白名单只对经过主站入口（Cloudflare → nginx）的请求可靠。WireGuard `8009` 的 TCP 直通入口能伪造 `X-Forwarded-For`（M2）；修复属于运维侧事项，不在本任务范围内。
- 把 `PartnerServerPrincipal{Client, Config}` 放进请求上下文。

### 3.3 管理员操作密钥

- 新增 `POST /api/partner-oauth/clients/{id}/server-secrets`（签发）和 `DELETE .../server-secrets/{secret_id}`（吊销）。
- 两者都要求 Casbin `partner_oauth_client.sensitive_write` 和二次验证，与现有的轮换 OAuth secret 一致。
- 吊销密钥时，同一个事务里删除由它签发的令牌。

## 4. 接口（`/api/partner/v1`）

公共约定：
- 路由组为 `RouteTag("api")`、`PartnerOAuthRequestID`、`PartnerOAuthNoStore`，每个 IP 每分钟最多 1200 次请求，再加上 `PartnerServerBearer`。
- 错误体与 `/api/integrations/v1` 相同：`{"error":{"code","message"},"request_id"}`。
- 只在主站 Host 提供服务（`ensurePartnerOAuthHost`）。
- 路径里的 `{eid}` 即 `external_user_id`，必须满足 `^[A-Za-z0-9._-]{32,64}$`，否则返回 `400 invalid_external_user_id`。
- **不允许浏览器跨域调用**（L1）：引擎级 `CORS()` 会给所有路由加 `Access-Control-Allow-Origin: *`。本路由组和 `client_credentials` 响应要删除 CORS 响应头，`OPTIONS` 预检返回 403。这样合作方如果误把密钥放进前端，会在联调时直接失败。

| 方法 | 路径 | 自动开户 | 幂等 | 说明 |
|---|---|---|---|---|
| GET | `/accounts/{eid}` | 否（未知 ID 返回 404 `account_not_found`） | — | `account_id`、`external_user_id`、`status`、`quota`、`used_quota`、`amount`、`currency`、`currency_symbol`、`quota_per_unit`、`created_at` |
| POST | `/accounts/{eid}/credential` | **是** | 天然幂等：同一账号总是返回当前那把 Key | 返回 `key_id`、`api_key`、`base_url`、`created_at`；请求体为 `{}` |
| POST | `/accounts/{eid}/credential/rotate` | 否 | 必须带 `Idempotency-Key` | 请求体 `{"revoke_old":"after_grace"\|"immediately"}`，默认 `after_grace`；返回新 Key，以及旧 Key 的 `old_key_expires_at` |
| POST | `/accounts/{eid}/disable` | 否 | 天然幂等 | 子账号状态改为 `disabled`，禁用该用户 |
| POST | `/accounts/{eid}/enable` | 否 | 天然幂等 | 只恢复 `disabled`（合作方停用的），`admin_disabled` 返回 403 |
| GET | `/payment/options` | — | — | 字段同现有 `/api/integrations/v1/payment/options`，`pay_money` 按合作方的 `account_group` 计算 |
| POST | `/accounts/{eid}/payment/orders` | **是** | 必须带 `Idempotency-Key` | 请求体 `{"amount":int,"payment_method":"alipay\|wxpay\|…","client_ip"?:string}`；返回 201 `{order_id,status,amount,currency,pay_money,pay_currency,payment_method,qr_code?,pay_url?,created_at}` |
| GET | `/payment/orders/{order_id}` | — | — | 只能查本合作方的订单，否则 404；不返回 `qr_code` 和 `pay_url` |
| GET | `/accounts/{eid}/usage` | 否 | — | 消耗明细，见 §6 |

**两条说明**
- 为什么"领 Key"不要求 `Idempotency-Key`：同一账号总是返回同一把 Key，重试本身没有副作用；开户由唯一约束保证只开一次。
- 为什么"轮换"必须带：重试一次就会多轮换一次，导致合作方刚拿到的 Key 被作废。
- **领 Key 可以反复返回明文**（2026-10-28 用户决定，H1），以便合作方随时取回。补偿措施：
  - 领 Key 和轮换共用一个按合作方计算的限流：每分钟 120 次，超出返回 `429 rate_limited` 并写审计 `partner_account.credential_rate_limited`（每分钟最多一条）；
  - 管理员可以一键吊销全部 Key（§5.7）。
- 消耗明细单独限流：每个合作方每分钟 60 次（M3）。

## 5. 关键流程

### 5.1 自动开户（`EnsurePartnerAccountTx`）

在调用方的事务里执行：
1. 按 `(client_id, external_user_id_hash)` 查找，找到就直接返回。
2. 没找到时，`lockForUpdate` 锁住 `partner_server_configs` 行，然后再查一次，防止并发请求在加锁前都看到"不存在"。
3. 在锁内检查两项：该合作方的子账号总数是否小于 `max_accounts`；过去 60 秒内创建的数量是否小于 `accounts_per_minute`（按 `created_at` 计数，存在数据库里，进程重启也不会丢）。超限分别返回 `429 account_limit_reached` 和 `429 rate_limited`（带 `Retry-After`）。
4. 创建 `users` 行：
   - `Username = "pa_" + 16 位随机字符`，重名时重试（总长 19，不超过 20 的限制）；
   - `DisplayName` 取合作方名称，截断到 20；
   - `Password`、`Email` 都为空；
   - `Role = RoleCommonUser`、`Status = Enabled`、`Group = account_group`、`Quota = 0`；
   - `AffCode` 随机生成；`Setting` 用默认值。

   **不走 `user.Insert`**，从而不发注册赠额、不写注册赠额日志、不处理邀请人。但仍然调用 `prepareForInsert`，并写入 `recordWalletRefundCreditTx(tx, user, opening, "registration", 0, 0, "")`，与零赠额的普通注册一致，返现契约不需要修改。
5. 创建 `partner_accounts` 行。如果唯一约束冲突（来自不经过锁的并发路径），回滚后重新查询并返回已有记录。
6. 事务提交后写审计日志 `partner_account.create`。

### 5.2 子账号不能登录

| 路径 | 拦截依据 |
|---|---|
| 密码登录、注册即登录 | 密码为空，`ValidateAndFill` 直接拒绝（[model/user.go:1152](../../../model/user.go)） |
| 找回密码、邮箱验证码登录 | 没有邮箱 |
| GitHub、OIDC、Telegram 等第三方登录 | 没有绑定任何第三方身份；绑定操作需要先登录，而子账号登录不了 |
| Passkey、2FA | 注册都需要已登录的会话 |
| 个人访问令牌 | 创建需要已登录的会话 |
| **管理员给子账号设密码或邮箱** | **需要新增拦截**：管理员更新用户的接口发现目标是子账号时，拒绝修改密码和邮箱，返回明确错误 |

每一条都写一个回归测试，断言无法登录、或无法设置密码和邮箱（AGENTS 6.2）。

### 5.3 Key

- **签发：** 锁住 `partner_accounts` 行。已有 `token_id` 时返回那把 Key；它已被禁用时返回 `403 credential_disabled`，不会补发。没有时新建：
  - `Token{UserId, Name: "partner:"+client 名称（截断）, ExpiredTime: -1, UnlimitedQuota: true, Group: "auto", AutoGroups: [account_group, "default"]}`；
  - 不受 `MaxUserTokens` 限制，因为每个子账号只有一把。
- **分组：** Key 设为 `auto`，并按顺序 `[专用分组, default]` 选择。请求先走专用分组的渠道，没有对应模型时退到 default。前提是运营已配置好：
  - `GroupSpecialUsableGroup[account_group]` 包含 `+:default`（全局可用分组里已经有 default 时可以不配）；
  - 两个分组都在 `GroupRatio` 里；
  - 如需单独定价，配置 `GroupGroupRatio[account_group][default]`。

  启用服务端模式时，后台校验 `account_group` 存在于 `GroupRatio`；`default` 是否可用只给出提示。
- **轮换：** 在一个事务里新建 Key，`partner_accounts.token_id` 指向新 Key。旧 Key 的处理：
  - `immediately`：状态改为禁用，并失效 Key 缓存；
  - `after_grace`：把 `ExpiredTime` 设为当前时间加 24 小时。复用现有的过期检查（[model/token.go:233](../../../model/token.go)），不需要定时任务。

  同一账号上一把旧 Key 仍在宽限期内时，再次轮换会把它立即作废，保证任何时候最多两把有效。

### 5.4 停用与恢复

**子账号级别（接口 disable/enable、管理员停用）**
- 修改 `partner_accounts.status`，同时修改 `users.status`；
- 失效用户缓存和 Key 缓存（`InvalidateUserTokensCache`，与 `ManageUser` 的做法相同）；
- 模型请求在认证时检查用户状态（[middleware/auth.go:594](../../../middleware/auth.go)），用户被禁用后所有 Key 立即失效。

**合作方级别（现有接口 `POST /api/partner-oauth/clients/{id}/status`）**
- **停用：** 状态接口只写 `suspended_at` 并删除合作方快照，此后服务端接口立即全部拒绝，接口随即返回。批量禁用在后台 goroutine 中执行（L3）：按 500 条一批，对 `status=active` 且 `users.status=enabled` 的子账号禁用用户、设置 `suspended_by_partner=true`、失效缓存。
  - 批处理可以重入：进程重启后，由启动时的检查（或下一次触发）对比 `suspended_at` 与 `suspended_by_partner` 继续执行；
  - 进度（已处理 / 总数）保存在内存中，并通过后台接口查看；
  - 同一合作方同时只运行一个批处理，用进程内锁实现（单实例部署成立；以后扩成多实例时要改为数据库锁）。

  10 万个账号大约需要几十秒到几分钟，这段时间里模型 Key 还能用。这是已知的时间窗口，写进契约。
- **恢复：** 清空 `suspended_at`，然后按批对 `suspended_by_partner=true` 且 `status=active` 的子账号：启用用户、清除标记、失效缓存。
- **不会误恢复：**
  - 合作方通过接口停用的（`disabled`）和管理员停用的（`admin_disabled`）不会被恢复；
  - 管理员在合作方停用期间用通用的 `ManageUser` 禁用某个子账号时，同时把 `partner_accounts.status` 改为 `admin_disabled`（需要给 `ManageUser` 加这一处联动），这样恢复时也会跳过它。
- **为什么改用户状态，而不在模型请求时检查合作方状态：** 模型请求的认证是热路径，每个请求都多查一次合作方会增加开销。停用合作方是少见操作，批量改状态的代价更低。

**删除合作方（D13）：** 合作方名下有子账号时，现有的删除接口返回 `409 partner_has_accounts`，只能停用。

### 5.5 充值下单

1. 校验 `Idempotency-Key`。按 `(client_id, key_hash)` 查到已有订单时：请求体摘要不同返回 409；相同则走重放（第 4 步）。
2. 校验支付方式和金额（直接复用现有函数：`getMinTopup`、`validateTopUpQuotaCapacity`、`getPayMoney(amount, account_group)`、`cashbackBaseQuotaFromTopUpAmount`）；支付合规或 Epay 不可用时返回 503（复用 `partnerEpayMethodAvailable`）。
3. 在一个事务里：
   - 自动开户（§5.1）；
   - 检查子账号状态为 `active`；
   - 限流：每个子账号 1 小时最多 20 单、30 分钟内最多 5 笔未付款；每个合作方 1 小时最多 2000 单；
   - `InsertOnlineTopUpTx`，其中 `IneligibleReason = partner_oauth`；
   - 写订单关联行，此时 `qr_code` 和 `pay_url` 为空。
4. 事务提交后调用 ZPay `mapi.php`：
   - POST 表单字段：`pid`、`type`、`out_trade_no`、`notify_url`（与 submit 下单相同）、`name`、`money`、`clientip`、`device=pc`、`sign_type=MD5`，签名用 `epay.GenerateParamsWithError`；
   - 超时 10 秒；只接受 `code==1`；
   - 优先取 `qrcode`，没有时取 `payurl`；`img` 字段忽略（它是第三方托管的图片地址）；
   - 把结果写回订单关联行，然后返回 201。
5. ZPay 调用失败时返回 `503 payment_unavailable`，订单保持 pending、没有二维码。合作方用同一个 Key 重试时，会对这笔订单重新调用 `mapi.php`。

   第一次其实成功但响应丢失时，ZPay 对同一订单号会返回同一笔订单（`O_id` 不变）和新的支付宝链接，不报重复（Q16 联调确认），所以重试直接拿到二维码。
6. 入账：完全沿用 `EpayNotify` → `rechargeEpayWithSource`，不改。

出站调用约束（L5）：
- 只有 `PayAddress` 是 `https` 时才调用 `mapi.php`，否则返回 503，并写一条不含敏感信息的服务端错误日志；
- 同一个请求内不自动重试；
- `qrcode`、`payurl` 和 ZPay 的响应原文都不写入任何日志；
- 不使用 ZPay 的订单查询接口 `api.php?act=order`，因为它要求把商户密钥放在 URL 里。

### 5.7 应急：吊销合作方全部 Key

用于怀疑合作方密钥已经泄露、Key 可能被批量导出的情况（H1）。

- 管理员接口：`POST /api/partner-oauth/clients/{id}/server-keys/revoke-all`，要求 Casbin `sensitive_write` 加二次验证。
- 执行方式与 §5.4 相同（后台、分批、可重入）：
  - 把该合作方所有子账号当前的 Key 和宽限中的旧 Key 立即作废，并失效 Key 缓存；
  - 子账号本身保持 `active`，余额不变。
- 之后合作方调用领 Key 接口会得到 `403 credential_disabled`；调用轮换（`immediately`）会签发新 Key。因此轮换接口在当前 Key 已被禁用时也必须可用。
- 通常与吊销服务端密钥、改配 IP 白名单一起使用，处置步骤写进运维手册。
- 审计 `partner_server.keys_revoke_all`。

**订单号生成：** 沿用 `USR{userId}NO{随机}{时间戳}`。

**为什么不在事务里调用 ZPay：** 不能一边持有行锁一边等外部网络请求。

### 5.6 订单查询

按 `trade_no` 找到 `top_ups`，再要求关联行的 `client_id` 与当前合作方一致，否则返回 404。返回字段同 OAuth 版本，不含 `qr_code` 和 `pay_url`。

## 6. 消耗明细

```text
GET /api/partner/v1/accounts/{eid}/usage?start_time=&end_time=&page=1&page_size=50
```

- `start_time` 和 `end_time` 是 Unix 秒，时间跨度不超过 31 天，默认最近 24 小时；`start_time` 不能早于当前时间往前 90 天（M3）；`page_size` 取 1–100；单独限流，每个合作方每分钟 60 次。
- 查询条件 `logs.user_id = 子账号 AND type = LogTypeConsume`，走 `idx_user_id_id` 索引，按 `id DESC` 分页。
- 返回字段白名单：`created_at`、`model_name`、`prompt_tokens`、`completion_tokens`、`quota`、`use_time`、`is_stream`、`request_id`。**不返回** `content`、`ip`、`channel`、`group`、`other`、`token_name`。
- 生产日志库与主库同在 PostgreSQL（D19）。代码通过 `LOG_DB` 访问，不写方言 SQL，因此独立日志库和 ClickHouse 也能用，但本任务只验证 PostgreSQL，交付说明会写明。
- 本期不做按天汇总，合作方可以按需自行累加。

## 7. 审计

在 `partner_oauth_authorization_logs` 的 action 白名单里新增：

`partner_server.token_issue`、`partner_server.token_issue_failed`、`partner_server.auth_denied`、`partner_server.keys_revoke_all`、`partner_account.credential_rate_limited`、`partner_server.secret_issue`、`partner_server.secret_revoke`、`partner_server.ip_denied`、`partner_account.create`、`partner_account.credential_issue`、`partner_account.credential_rotate`、`partner_account.disable`、`partner_account.enable`、`partner_account.payment_order_create`、`partner_server.suspend`、`partner_server.resume`

- `TargetUserId` 填子账号的用户 ID；`BindingId` 留空。
- 不记录 `external_user_id` 原文，避免把合作方的标识带进日志；排查时可以通过用户 ID 关联。
- **成功和失败的令牌签发都记录**（ASVS 16.3.1，M1）。频率大约每个合作方每小时一次。
- **`PartnerServerBearer` 拒绝的请求**（令牌无效、IP 不在白名单、合作方停用）按“合作方 + 原因”每分钟最多写一条 `partner_server.auth_denied`（ASVS 16.3.2），防止日志被刷爆；`client_id` 不存在时不写入，只依靠每个 IP 的限流。
- 普通查询成功不写审计日志。

## 8. 管理后台（前端）

- 合作方编辑页新增“服务端接入”区块，包括：启用开关、专用分组下拉框（选项来自 `GroupRatio`）、IP 白名单、子账号上限、每分钟开户上限；密钥列表（签发后只展示一次，可以吊销）。复用现有的合作方表单和 secret 展示组件。
- 新增"子账号"列表：按合作方筛选，显示 `external_user_id`、用户 ID、状态、余额、创建时间；支持管理员停用和恢复。
- 用户列表给子账号加"合作方子账号"标记，并支持按合作方筛选（D23）。
- 2FA 统计（`GetTwoFAStats`，[model/twofa.go:339](../../../model/twofa.go)）的总用户数排除 `partner_accounts` 中的用户（D23）。
- 文案按七种语言提供 i18n。

## 9. 安全对照（OWASP）

| 主题 | 依据 | 本设计的做法 |
|---|---|---|
| 客户端认证 | ASVS 5.0 V10（OAuth and OIDC）、OAuth 2.0 Cheat Sheet | `client_credentials` 只允许机密客户端，使用 Basic；令牌短期有效、只存哈希；scope 与授权码流程隔离 |
| 密钥管理 | ASVS 5.0 V13（Configuration）、Secrets Management Cheat Sheet | 高熵随机密钥、只展示一次、只存哈希；两把并存轮换；吊销后同时吊销其签发的令牌 |
| 暴力破解与枚举 | ASVS 5.0 V6（Authentication）、Authentication Cheat Sheet | 失败统一返回 `invalid_client`，比较耗时一致，按 client 计失败次数限流 |
| 授权 | ASVS 5.0 V8（Authorization） | 所有查询都同时限定在 `client_id` 下；其他合作方的 `external_user_id` 和订单都返回 404 |
| 审计 | ASVS 5.0 V16（Security Logging and Error Handling）、Logging Cheat Sheet | §7；不记录密钥、令牌、Key、二维码 |
| 传输 | ASVS 5.0 V12 | 只在主站 HTTPS 上提供；`no-store` |

逐项审查结论、用户决定和已接受的风险见 `security-review.md`。交付时按 ASVS 5.0 的具体条目号逐条列出已验证项与缺口。目前已知的待验证项：
- `c.ClientIP()` 在生产反向代理后能否取到真实来源 IP（关系到 IP 白名单是否有效）；
- 合作方停用后，批量禁用完成前的时间窗口。

## 10. 缓存

现状：
- 生产配置了 Redis（`REDIS_CONN_STRING`），单实例部署；
- 项目已有混合缓存 `pkg/cachex.HybridCache`（Redis 可用时用 Redis，否则用进程内 LRU；用例见 `model/subscription.go`）；
- 模型 Key 和用户已有带写入保护的 Redis 缓存（`model/token_cache.go`、`model/user_cache.go`）。

选型原则：
- 修改后需要通过“主动删除缓存”来生效的数据，用 `HybridCache`，这样以后扩成多实例也能正确失效（AGENTS §1）；
- 纯进程内缓存只用于**永不变化**的数据，多实例下也不会读到旧值。

### 10.0 首期范围（2026-10-28 用户确认）

**首期缓存“合作方快照”和“服务端访问令牌”两项。** 子账号映射不缓存：用到它的接口都还要查数据库（写操作要在事务里锁住同一行，读操作要读状态、余额或日志），缓存只能省一次按唯一索引的查询；而且以后做删除或合并子账号时，还得记得同步清理它。已付款订单的缓存留到后续再做。§10.3 列出的现有缓存失效是正确性要求，首期必须做。

合作方快照是一个对象，按 `client_id` 存在 `HybridCache` 中，有效期 60 秒：

| 字段 | 来源 | 用途 |
|---|---|---|
| `client_id`、`name` | `partner_oauth_clients` | 识别合作方；`name` 用于给新 Key 命名 |
| `client_enabled` | `partner_oauth_clients.status` | client 被停用时拒绝所有服务端请求 |
| `server_enabled` | `partner_server_configs.enabled` | 服务端接入开关 |
| `suspended` | `partner_server_configs.suspended_at != 0` | 合作方停用中，拒绝所有服务端请求 |
| `account_group` | `partner_server_configs.account_group` | 计算付款方式的价格（`/payment/options`） |
| `ip_allowlist` | `partner_server_configs.ip_allowlist`，预先解析成 CIDR 列表 | 每个请求的 IP 白名单检查 |
| `active_secret_ids` | `partner_server_secrets` 中 `status=active` 的 ID 列表（**不含哈希**） | 判断令牌是不是由仍然有效的密钥签发的 |

**快照里没有的：**
- 密钥哈希。换令牌时的密钥校验总是直接查数据库。
- `max_accounts`、`accounts_per_minute`，以及开户时使用的 `account_group`。开户在事务里锁住配置行后直接读数据库，以数据库为准，快照只用于鉴权和展示。
- 令牌、子账号、订单的任何数据。服务端访问令牌单独缓存，见下文。

**读取位置：** `PartnerServerBearer` 每个请求先按哈希查令牌（先查令牌缓存，没有命中再查数据库），再从快照判断：令牌的 `secret_id` 是否在 `active_secret_ids` 中、client 和服务端接入是否启用、是否处于停用状态、IP 是否在白名单内。`POST /oauth/token` 的 `client_credentials` 分支频率很低，全部查数据库，不读快照。

**主动删除（在数据库事务提交之后）：**
- 编辑合作方（名称、状态）；
- 修改服务端配置（开关、分组、白名单、上限）；
- 签发或吊销服务端密钥；
- 停用或恢复合作方；
- 删除合作方。

删除失败只记录服务端日志，靠 60 秒有效期兜底。所以安全相关的变更（吊销密钥、停用）最坏 60 秒后生效。这个上限写进契约。

**服务端访问令牌缓存：** 键为 `token_hash`，值为 `client_id`、`secret_id`、`expires_at`，存在 `HybridCache` 中；有效期取“令牌剩余时间”与 5 分钟中较小的值。令牌签发后不再变化，所以不需要主动删除。密钥吊销后，由快照的 `active_secret_ids` 拒绝该密钥签发的令牌；即使令牌缓存还在，请求也通不过。不缓存“令牌不存在”的结果，避免有人用随机令牌把缓存塞满。

**收益：** 鉴权阶段的数据库查询从每个请求 4 次（令牌、密钥、client、配置）降到 0 次（两个缓存都命中时）。

### 10.1 要缓存的（完整清单；首期只做前两行，子账号映射决定不做，已付款订单后续再做）

| 数据 | 缓存方式 | 有效期 | 失效时机 | 理由 |
|---|---|---|---|---|
| 合作方快照：client 状态、服务端配置、有效密钥 ID 列表 | `HybridCache`，键为 `client_id` | 60 秒 | 后台修改配置、启停 client、签发或吊销密钥、停用或恢复合作方时主动删除 | 每个服务端接口请求都要读；只有管理员会改。60 秒有效期兜底主动删除失败的情况 |
| 服务端访问令牌：`token_hash` 对应的 `client_id`、`secret_id`、`expires_at` | `HybridCache` | 取令牌剩余时间与 5 分钟中较小的值 | 无需主动删除：令牌记录签发后不再变，吊销密钥时通过上一行的“有效密钥 ID 列表”判定失效 | 省掉每个请求查令牌表的一次查询 |
| 子账号映射：`(client_id, external_user_id_hash)` 对应的 `partner_account_id` 和 `user_id` | 进程内 LRU（`hot` 包，容量 20000） | 不过期，只按 LRU 淘汰 | 不需要：映射一旦建立就不会变，本期也不支持删除 | 读接口每次都要把外部 ID 换成用户 ID。只缓存“已存在”的结果 |
| 已付款订单的查询结果 | `HybridCache`，键为 `order_id` | 10 分钟 | 不需要：`success` 是终态 | 可得会轮询，付款后可能还会多查几次 |
| IP 白名单解析结果（CIDR 列表） | 跟随合作方快照一起缓存 | 同快照 | 同快照 | 避免每个请求都重新解析 |

### 10.2 不缓存的

| 数据 | 理由 |
|---|---|
| 子账号状态、当前 Key | 写操作（领 Key、轮换、下单、停用）都在事务里加锁读取，必须以数据库为准。读接口多一次按主键查询，成本可以忽略 |
| 子账号余额 | 账号查询接口直接读数据库，与现有 `/balance` 一致。不使用用户额度缓存，因为它在额度变动期间有写入保护（`ErrUserQuotaMutationPending`）的语义，只适合扣费路径 |
| “不存在”的查询结果 | 自动开户后必须立刻能查到，缓存“不存在”会导致刚开的账号返回 404 |
| 幂等键、开户上限和速率、下单限流 | 正确性依赖在事务内加锁计数；放进缓存会在并发时超限 |
| 换取令牌时的密钥校验 | 频率很低（每个合作方大约每小时一次），而且必须实时：吊销后立即生效 |
| 未付款订单的状态 | 要第一时间看到回调入账的结果；轮询频率低，每次两条带索引的查询 |
| 消耗明细 | 按时间范围分页查询，命中率低，而且要求数据新鲜 |
| 付款方式 | 本来就是从内存里的系统设置计算的 |

### 10.3 必须正确失效的现有缓存

不是新增缓存，而是本任务的写操作必须调用现有的失效函数，否则缓存会读到旧值：

| 操作 | 必须失效 |
|---|---|
| 停用、恢复子账号；合作方批量停用与恢复 | 用户缓存（状态）和该用户的 Key 缓存（`InvalidateUserTokensCache`），与 `ManageUser` 的做法相同 |
| 立即作废旧 Key | 该 Key 的缓存（`invalidateTokenCacheForMutation`） |
| 宽限轮换，即修改旧 Key 的 `ExpiredTime` | 同样要失效该 Key 的缓存：缓存里存着旧的过期时间，不失效的话旧 Key 宽限期满后仍然可用 |

### 10.4 限流计数

沿用现有实现：Redis 固定窗口计数，Redis 不可用时退回进程内计数（`partnerOAuthRateTake`、`PartnerOAuthClientAuthLimited`）。新增的计数键：按合作方的接口限流（3000/分钟）、领 Key 和轮换（120/分钟）、消耗明细（60/分钟）、令牌换取失败计数，以及审计写入的节流（每个合作方、每种原因每分钟一条）。开户速率和下单限流按 §5.1、§5.5 的设计，在数据库事务内计数，不放进 Redis。

### 10.5 预期收益

每个服务端接口请求原本要查 4 次数据库（令牌、密钥、client、配置）。令牌和合作方快照命中缓存后，鉴权阶段不再访问数据库。业务本身的查询照常执行。

按每个合作方每分钟最多 3000 次请求计算，PostgreSQL 不缓存也承受得住，所以这部分缓存属于降低开销，不是必需项。如果要缩小首期范围，可以先只做“合作方快照”这一项，它的收益最大，实现也最简单。

## 11. 兼容、上线与回滚

- **迁移：** 只新增 5 张表，加入主库的迁移列表。在 PostgreSQL（Docker）上验证：全新建表、从当前线上版本 `88e0b8077` 升级、重复迁移两次。
- **上线顺序：**
  1. 部署代码；此时所有合作方的服务端模式默认关闭，对线上没有影响；
  2. 运营创建专用分组并挂上渠道；
  3. 管理员为可得启用服务端模式、签发密钥；
  4. 联调 Q16（ZPay 返回值）；
  5. 可得删除收集密码的表单，切换到新接口。
- **回滚：** 关闭可得的服务端模式即可立即停止全部新接口。代码回滚时新表保留，不删数据。已经开出的子账号和 Key：模型请求仍按普通用户和 Key 处理，余额不受影响；如需同时停用，回滚前先停用合作方。
- **契约：** 实现完成后新建 `.trellis/spec/backend/partner-server-accounts.md`，并在 `partner-oauth.md` 里加交叉引用（Phase 3.3）。
